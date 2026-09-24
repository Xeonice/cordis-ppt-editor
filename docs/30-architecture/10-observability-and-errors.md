> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-14；2026-09-24（rulings §4.15：T-0 去租户——删 `cordex.tenant_id` 日志字段与 `tenant.quota_exceeded`，改 `document.quota_exceeded`；Q10 日志默认进 OTel Collector，Loki/Grafana 为 AGPL 可选 profile；Q3 `store/undo-skipped` 事件）；2026-09-24（rulings §4.16 Q15：§1.4 登记 `format.macro_rejected` → 415）；2026-09-24（复核修正，rulings §4.17：D2 `document.quota_exceeded` 定为编辑期上限码、WS 关闭码改「—」、§1.4 登记配额三码 `dimension` 取值表；H6 登记 `format.encrypted`；D5/M-02 `store/undo-skipped` 载荷 `{skipped, wholeStep}` 与单独计数） | 依赖：charter v0.1

# 10 观测性与错误（Observability & Errors）：错误码体系、结构化日志、telemetry、诊断、客户端上报

> 读者：所有包的实现者（错误与日志是横切约束）；实现 kernel `errors`/`telemetry`/`logger` 适配器的工程师；运维。
> 章程锚点：D11（`errors`/`telemetry`/`logger` 为 L0 服务，M1 起接入；禁止裸 `throw new Error`）、§5.4（基础服务可替换、移除后降级 no-op）、§5.5（服务名 `errors`/`telemetry`/`logger`）、Univer A24（声明零实现）、A25（dispose 门禁被删）、A11（一崩全崩）、A16（豁免需登记）。
> 相关 ADR：0030（观测栈）。kernel 的目录结构由 A 线在 02/03 定型；本文列出运行时线对 kernel 三个服务的**契约要求**与期望的文件位置（提请 A 线采纳）。

---

## 0. 一页总览

```
                 ┌──────────────── @cordexjs/kernel（L0）────────────────┐
  插件代码 ────►  │ ctx.errors    create / raise / wrap / report / assert │ ──► Reporter Provider（控制台 | Sentry | 服务端 API）
                 │ ctx.logger(name)  结构化字段 + 脱敏 + 采样            │ ──► Sink Provider（console | pino | ring buffer + 上报）
                 │ ctx.telemetry span / metric / event                  │ ──► OTel SDK Provider（浏览器 OTLP/HTTP | Node OTLP/gRPC）
                 │ diagnostics   dumpFiberTree / effects / pending / contributions │
                 └────────────────────────────────────────────────────┘
  Fiber apply 抛错 ──► 内核捕获 → FAILED + errors.report（不传播到兄弟 Fiber，A11）
  渲染器抛错 ──► 元素占位 + errors.report（07）
  Nest 层 ──► CordexExceptionFilter → problem+json（映射表在 protocol）
```

三条铁律：
1. **没有裸错误**：生产代码中 `throw new Error(...)`/`new Error(...)`/`throw '...'` 被 lint 禁止（由 09-02 承接）；只能 `throw ctx.errors.create(code, details)`、`return err(...)` 或 `invariant(...)`。
2. **没有无主日志**：`console.*` 在包内被禁止（测试与 tooling 除外）；只能 `ctx.logger(name)`。
3. **每个配置项有读取点、每个指标有消费者**（A26/A24）：`telemetry` 声明的 span/metric 名称都在本文清单中，且各有一个仪表盘/告警或测试引用；扫描器核对（09-06）。

---

## 1. 错误码体系

### 1.1 编码格式

- 代码为**字串字面量** `<domain>.<snake_case_name>`，如 `collab.forbidden`、`store.target_missing`、`format.pptx.invalid_package`。domain ≤ 2 段，与包/服务域一致：`kernel` `store` `command` `permission` `format` `ooxml` `layout` `render` `slide` `collab` `transport` `presence` `headless` `storage` `server.auth` `server.documents` `server.media` `server.jobs` `document`（`tenant` 域随 rulings §4.15 T-0 删除；配额/规模类错误按阶段分三码：导入 `format.quota_exceeded`、编辑期 `document.quota_exceeded`、存储 `storage.quota_exceeded`，见 §1.4 取值表，rulings §4.17 D2）。
- 不用数字编号（A3：避免闭合枚举与人为分配冲突）；不用 TS `enum`（lint 禁止）。
- 每个错误码在其所属包的 `errors.ts` 中通过声明合并注册到 `ErrorCodes` 接口，携带 `details` 类型：

```ts
// 草案：packages/collab-core/src/errors.ts
declare module '@cordexjs/kernel' {
  interface ErrorCodes {
    'collab.forbidden':        { unitId: UnitId; role: Role; action: string }
    'collab.room_full':        { unitId: UnitId; limit: number }
    'collab.schema_too_new':   { unitId: UnitId; server: number; client: number }
    'collab.bad_frame':        { frameType?: number; reason: string }
  }
}
export const collabErrors = defineErrors({          // 运行时元数据（严重度、可重试、默认 i18n key）
  'collab.forbidden':      { severity: 'warning', retryable: false, user: true },
  'collab.room_full':      { severity: 'warning', retryable: true,  user: true },
  'collab.schema_too_new': { severity: 'error',   retryable: false, user: true },
  'collab.bad_frame':      { severity: 'error',   retryable: false, user: false },
})
```

- 扫描器（09-06）：任何 `errors.create('x.y', …)` 的 `'x.y'` 必须在 `ErrorCodes` 中声明；未声明即编译失败（类型层）+ 扫描器统计每个 domain 的码数。

### 1.2 错误类层次（刻意扁平）

```
CordexError<C extends ErrorCode>            code / details: ErrorCodes[C] / severity / retryable / user / cause? / fingerprint / context{unitId?, traceId?}
├── CordexValidationError                   code = '<domain>.validation_failed'；issues: StandardSchemaV1.Issue[]（D2 边界校验失败）
├── CordexAggregateError                    code = 'kernel.aggregate'；errors: CordexError[]（parallel 事件多失败、批量作业）
└── CordexInvariantError                    code = 'kernel.invariant_violation'；由 invariant() 产生；severity 'fatal'；表示程序错误
```

- 不为每个 domain 建子类；分类靠 `code`/`severity`/`user`（是否可向用户展示）。理由：子类层次会诱导 `instanceof` 分支，而 `code` 判别联合能被穷尽检查。
- 与 cordis：`CordisError`/`ValidationError` 在 kernel 边界被 `wrap` 为 `kernel.cordis_error` / `kernel.config_invalid`。

### 1.3 `Result` vs `throw` 的使用边界

| 情形 | 用法 | 理由 |
|---|---|---|
| 纯函数/iso 库的**预期失败**（解析、编解码、校验、几何求值、路径定位） | `Result<T, CordexError>`（`@cordexjs/shared`：`ok/err/map/andThen/unwrapOr/collect`） | 可组合、可穷尽、不依赖异常栈 |
| 服务方法的**外部失败**（网络、存储、浏览器 API） | `Promise<Result<…>>`；只有在调用方无法继续时由调用方 `raise` | 让调用方决定重试/降级 |
| **程序错误**（不变量被破坏、不可能分支） | `invariant(cond, 'kernel.invariant_violation', details)` → throw | 立刻暴露；不进入 Result |
| **边界层**（插件 `apply`、命令执行、Nest handler、job processor） | 允许 `throw CordexError`；边界统一捕获：内核 → Fiber `FAILED`；commands → `command/failed` 事件；Nest → filter；job → 重试/死信 | 边界是唯一把 Result 转成异常的地方 |
| 第三方异常 | `ctx.errors.wrap(cause, code, details)` | 保留 `cause` 链 |

替代写法速查（禁止 → 允许）：`throw new Error('x')` → `throw ctx.errors.create('domain.name', {...})`；`if (!x) throw …` → `invariant(x, …)` 或 `return err(...)`；`catch (e) { throw e }` → `catch (e) { throw ctx.errors.wrap(e, 'domain.name') }`；`console.error(e)` → `ctx.errors.report(e)`。

### 1.4 到 HTTP / WS 的映射（`protocol/src/errors/http-map.ts`）

| 码（前缀/示例） | HTTP | WS 关闭码 | problem+json `type` |
|---|---|---|---|
| `*.validation_failed` | 400 | 4400 | `/errors/validation` |
| `server.auth.unauthenticated` | 401 | 4401 | — |
| `permission.denied` / `collab.forbidden` | 403 | 4403 | — |
| `server.documents.not_found` / `collab.doc_not_found` | 404 | 4404 | — |
| `collab.schema_too_new` | 409 | 4426 | — |
| `collab.room_full` | 503 | 4503 | — |
| `*.payload_too_large` | 413 | 4413 | — |
| `*.rate_limited` | 429 | 4429 | — |
| `format.quota_exceeded`（导入超规模天花板，直接拒绝导入，rulings §4.15 Q5） | 413 | — | `details: { dimension, limit, actual }` |
| `format.encrypted`（加密包：`EncryptionInfo` CFB 容器，M1–M4 拒绝导入并提示先去除密码，rulings §4.16 Q15；登记于 `ooxml-core` errors，检测点在导入校验的魔数/容器判定阶段、先于 `format.pptx.invalid_package`，见 40-modules/04） | 415 | — | `details: { container: 'cfb' }`；取 415 理由同 `format.macro_rejected`：加密包不是 OOXML zip 媒体类型；**不得**回落为 `format.pptx.invalid_package`；用户文案「文件已加密，请先去除密码后再导入」 |
| `format.macro_rejected`（`.pptm` / macroEnabled 主内容类型 / 含 `vbaProject.bin` 的宏包直接拒绝导入，rulings §4.16 Q15；登记于 `ooxml-core` errors，检测见 40-modules/04 §2.6） | 415 | — | `details: { reason: 'extension' \| 'content_type' \| 'vba_part' }`；取 415 而非 422：拒绝依据是**文件类型本身**（宏启用的媒体类型不受理），而非内容语义校验失败——与 `format.unsupported_binary` 同类；用户文案「请另存为 .pptx 后再导入」 |
| `document.quota_exceeded`（**编辑期**上限码：编辑中新增页/元素触及天花板，命令守卫拒绝，rulings §4.17 D2；M-03 的 `SLIDE_LIMIT_EXCEEDED`/`ELEMENT_LIMIT_EXCEEDED` 常量映射到本码） | 409 | —（命令守卫拒绝、**不关连接**；4429 专属速率限制） | `details: { dimension, limit, actual }` |
| `storage.quota_exceeded`（部署级存储/每用户文档数配额） | 413（上传）/ 429 | — | `details: { dimension, limit, actual }` |
| `kernel.invariant_violation` 及未知 | 500 | 1011 | `/errors/internal`（不泄漏 details） |

**配额三码并列与 `dimension` 取值表**（rulings §4.17 D2；各处——PRD 06、设计 13、40-modules/03/04/08/12——照抄本表，不另起名）：

| 码 | 阶段 | `dimension` 取值 | 说明 |
|---|---|---|---|
| `format.quota_exceeded` | 导入（服务端 `import.processor` / 客户端 Worker 解析） | `slides` \| `elementsPerSlide` \| `elementsTotal` \| `fileSize` | 超天花板直接拒绝导入，不创建文档；`fileSize` 为单文件（含媒体）上限，默认 200 MB |
| `document.quota_exceeded` | 编辑期（命令守卫） | `slides` \| `elementsPerSlide` \| `elementsTotal`（与导入同名） | 409，命令被拒、连接保持；墓碑计入 `elementsTotal` |
| `storage.quota_exceeded` | 存储（上传/新建文档） | `bytes` \| `documents` | 部署级存储字节与每用户文档数 |

`problem+json` 字段：`type/title/status/detail/instance/code/traceId/retryable`；`details` 只有 `user:true` 的错误才回传。

### 1.5 `errors` 服务 API（草案；kernel 提供，Provider 可替换）

```ts
interface ErrorsService {
  create<C extends ErrorCode>(code: C, details: ErrorCodes[C], opts?: { cause?: unknown; severity?; retryable? }): CordexError<C>
  wrap<C extends ErrorCode>(cause: unknown, code: C, details: ErrorCodes[C]): CordexError<C>
  raise<C extends ErrorCode>(code: C, details: ErrorCodes[C]): never
  report(error: unknown, context?: ErrorContext): void       // 去重（fingerprint）、采样、脱敏，转交 Reporter
  isOce(value: unknown): value is CordexError
  onReport(listener: (e: CordexError, ctx: ErrorContext) => void): Disposable   // 供 UI 通知、telemetry 计数
}
interface ErrorReporter { report(e: CordexError, ctx: ErrorContext): void }        // Provider：console / sentry / server-api
```

- **Fiber 集成**：kernel 在 `internal/error`（cordis 事件）上监听：`apply` 抛错 → `report` + `fiber/failed(name, error)` 事件；兄弟 Fiber 不受影响（单测：注入抛错插件，其余功能可用，A11）。
- 去重：`fingerprint = hash(code + 归一化 message + 顶层 stack frame)`；同 fingerprint 60 s 内最多上报 1 次 + 计数。
- 移除 Provider：`report` 降级为 `ctx.logger('errors').error`；不抛。

---

## 2. 结构化日志

### 2.1 命名与级别

- `ctx.logger('<pkg>:<component>')`，如 `collab-yjs:sync`、`server-collab:room`、`render-dom:fonts`；名称字串只能是常量（扫描器）。
- 级别：`debug`（开发/诊断，生产默认关闭）、`info`（生命周期与业务里程碑，低频）、`warn`（可恢复异常、降级）、`error`（需人工关注）。**热路径（每帧/每 update）禁止 `info` 及以上**；用 `debug` + 采样或用指标。
- API（kernel 在 cordis logger 之上的适配）：`logger.info(msg: string, fields?: LogFields)`；`logger.child(fields)` 绑定上下文字段；不接受插值对象作为 msg（`msg` 是低基数模板，变量进 `fields`）。

### 2.2 字段规范（OTel 语义约定风格，`cordex.*` 为自定义）

| 字段 | 类型 | 来源 |
|---|---|---|
| `time` `level` `logger` `msg` | 基础 | sink |
| `trace_id` `span_id` | string | 当前 span（自动注入） |
| `cordex.unit_id` `cordex.room_id` `cordex.session_id` | string | UnitScope / Room / Session（`child` 绑定） |
| `cordex.user_id`（已哈希） `cordex.request_id` `cordex.job_id` | string | 请求上下文（`ctx.extend` 元数据；单组织部署无租户字段，T-0） |
| `cordex.plugin` `cordex.fiber_uid` | string/number | 由 kernel 从 `ctx.fiber` 注入 |
| `cordex.error_code` `cordex.error_fingerprint` | string | errors.report |
| `duration_ms` `bytes` `count` | number | 计时/大小 |
| `cordex.command_id` `cordex.mutation_kind` | string | 命令管线 |

### 2.3 脱敏（sink 前统一执行，`kernel/logger/redact.ts`）

- **从不记录文档内容**：任何 `text`/`body`/`update`/`state`/`snapshot` 字段被拒绝（开发模式抛 `kernel.log_content_forbidden`，生产模式替换为 `[redacted:content]`）。
- 用户标识：邮箱/姓名 → sha256 前 12 位；IP → /24 掩码；token/ticket/cookie/authorization → `[redacted]`。
- 路径类字段（`StorePath`）允许，但富文本偏移不携带文本。

### 2.4 Sink Provider

| 环境 | Provider | 行为 |
|---|---|---|
| 浏览器开发 | `console` | 彩色、含 fields |
| 浏览器生产 | `ring-buffer`（最近 500 条 `debug+`）+ 上报 | 仅在 `errors.report` 触发时把环形缓冲随错误一起上报（§6） |
| Node | `pino`（JSON 行）→ stdout → OTel Collector（Loki 为显式开启的 AGPL 可选 profile，rulings §4.15 Q10） | `level ≥ info`；`debug` 按 logger 名开关（环境变量 `CORDEX_LOG_DEBUG=collab-yjs:*`） |

---

## 3. Telemetry（OTel）

### 3.1 服务 API（草案）

```ts
interface TelemetryService {
  span<T>(name: SpanName, attrs: SpanAttrs[typeof name], fn: (span: SpanHandle) => T): T          // 同步/异步均可
  counter(name: MetricName).add(n, labels)
  histogram(name: MetricName).record(v, labels)
  gauge(name: MetricName).set(v, labels)
  event(name: EventName, props: EventProps[typeof name]): void                                     // 产品埋点（PRD 06）
  context(): { traceparent?: string }                                                              // 传播到 WS CONTROL/HTTP 头/job 数据
}
```

`SpanName`/`MetricName`/`EventName` 通过声明合并登记（同错误码机制）；未登记名称编译失败。移除 Provider → no-op（§5.4）。

### 3.2 Span 清单（名称、关键属性、所在包）

| span | 属性 | 位置 |
|---|---|---|
| `unit.open` | doc_type, source_kind, bytes | model-core |
| `format.import` / `format.export` | codec, bytes, parts, warnings | ooxml-pptx |
| `command.execute` | command_id, mutations, undoable | model-core（05） |
| `store.transaction` | origin_kind, paths | store-* |
| `render.frame` | pages, elements_updated, overrun | engine-render |
| `render.page_compose` | page_id, elements | slide-render |
| `layout.text_body` | chars, lines, autofit_iterations | engine-layout |
| `collab.bootstrap` | http_ms, step2_bytes | collab-yjs |
| `collab.sync_roundtrip` | bytes | collab-yjs（抽样） |
| `server.room.load` | doc_id, snapshot_bytes, updates | server-collab |
| `server.collab.update` | bytes, gate_result | server-collab |
| `server.snapshot.compact` | pending, bytes | server-collab |
| `thumbnail.render` | slides, ms_per_slide | server-headless |
| `job.<kind>` | attempts | apps/server |
| HTTP/DB/Valkey（Redis 协议） | 自动仪表化（`@opentelemetry/instrumentation-*`） | apps/server |

传播：HTTP `traceparent` 头；WS 的 CONTROL.auth 携带 `traceparent` 建立会话父 span，每个 update 帧不建 span（用指标 + 1% 抽样 span）；BullMQ job 数据带 `traceparent`。

### 3.3 Metric 清单（Prometheus 命名；单位在名内）

| 指标 | 类型 | 标签 | 消费者（仪表盘/告警） |
|---|---|---|---|
| `cordex_render_frame_ms` | histogram | mode | 前端性能面板；预算门禁（11） |
| `cordex_render_elements_updated_total` | counter | kind | A28 监控 |
| `cordex_command_latency_ms` | histogram | command_id | — |
| `cordex_collab_update_bytes` | histogram | direction | 容量 |
| `cordex_collab_roundtrip_ms` | histogram | — | SLO |
| `cordex_collab_session_transitions_total` | counter | from,to | 稀疏重连告警 |
| `cordex_collab_pending_updates` | gauge | — | 客户端「未同步」提示 |
| `cordex_collab_rooms_active` / `cordex_collab_clients` | gauge | instance | 容量告警 |
| `cordex_collab_persist_latency_ms` | histogram | — | SLO |
| `cordex_collab_updates_rejected_total` | counter | reason | 安全告警 |
| `cordex_collab_repairs_total` | counter | rule | 数据质量告警 |
| `cordex_store_undo_skipped_total` | counter | whole_step(true/false) | 撤销跳过面板（与软冲突率分开，rulings §4.17 D5） |
| `cordex_ydoc_bytes` / `cordex_ydoc_structs` | gauge | doc（抽样） | epoch 触发（06 §9.4） |
| `cordex_snapshot_bytes` / `cordex_snapshot_compactions_total` | histogram/counter | kind | 存储 |
| `cordex_ws_connections` | gauge | instance | HPA |
| `cordex_import_duration_ms` / `cordex_export_duration_ms` / `cordex_thumbnail_duration_ms` | histogram | — | 作业 SLO |
| `cordex_fiber_state` | gauge | plugin,state | PENDING/FAILED 告警 |
| `cordex_effects_live` | gauge | plugin | 泄漏告警（A25） |
| `cordex_cache_events_total` | counter | cache,event(hit/miss/evict) | A29 |
| `cordex_errors_total` | counter | code,severity | 错误率告警 |

### 3.4 产品事件（`telemetry.event`，与 PRD 06 对应）

最小集合（PRD 06 为权威清单，此处定义命名与去标识规则）：`doc_opened{doc_type, source, slides}`、`doc_exported`、`edit_committed{command_id}`（按会话抽样 10%）、`collab_joined{clients}`、`collab_reconnected`、`collab_conflict_notice{kind}`（06 §8 #2/#3 的提示展示）、`plugin_loaded{plugin}`、`perf_budget_exceeded{metric}`、`perf/frame{ ms, pages, elements, overrun }`（总编排定稿：由 cordis 事件 `render/frame` 派生的**遥测事件**，抽样 ≤ 1%，不是 cordis 事件）。规则：不含文档内容与自由文本；用户 id 哈希；事件 schema 为 zod（`protocol/telemetry`）。

---

## 4. 诊断

| 能力 | API / 入口 | 说明 |
|---|---|---|
| Fiber 树 dump | `dumpFiberTree(ctx) → { name, uid, state, children[] }`；`GET /internal/diagnostics/fibers` | 从 `ctx.registry` 遍历 runtimes/fibers |
| effect 树 dump | `fiber.getEffects()` 聚合；`GET /internal/diagnostics/effects?plugin=` | 卸载后应为空（A25 断言函数 `assertNoLiveEffects`） |
| PENDING 检视器 | `listPending(ctx) → [{ fiber, missing: string[] }]` | 用 `Inject.resolve(plugin.inject)` 与 `ctx.get(name)` 比对得出缺失服务名；dev 面板 500 ms 后提示；服务端 `/readyz` 附带 |
| 贡献点清单 | `ctx.contributions(point)` + `listContributionPoints(ctx)`；`GET /internal/diagnostics/contributions` | 与 Manifest 对比差异（ADR-0003） |
| 协同诊断 | `ctx.collab.session(unitId).stats` + `yjsBackend.stats()`；dev 面板「协同」页 | 状态、pending、state vector 摘要、最近帧 |
| 渲染诊断 | `ctx.render.stats()`：帧时长直方、脏区计数、缓存命中率、已挂载页 | dev 面板「渲染」页 |
| 开发者面板 | `ui.panel` 贡献 `cordex.devtools`（仅 `import.meta.env.DEV` 或 `?cordex-devtools=1`） | 由 slide-ui/ui-react 承载，数据来自上述 API |
| CLI | `cordex-headless diag <file.pptx>`：导入 → validate → 报告 | server-headless |

---

## 5. 客户端错误上报

- 端点：`POST /api/v1/telemetry/errors`（DTO：`protocol/telemetry/client-report.ts`），批量 ≤ 20 条/请求，节流 1 req/10 s，`sendBeacon` 兜底。
- 载荷：`{ code, message(脱敏), fingerprint, stack(源映射前), appVersion, pluginManifestHash, unitId?, sessionId?, traceId?, breadcrumbs: ring-buffer 最近 50 条日志（脱敏）, env{ua, viewport, memory?} }`。
- 服务端：写入日志管道并转发到错误平台（Sentry Provider 可选）；source map 在 CI 上传（09-07）。
- 采样：`severity ≥ error` 100%；`warning` 10%；同 fingerprint 客户端 60 s 去重。
- 隐私：见 §2.3；用户可在设置里关闭「诊断上报」（产品确认 O2）。

---

## 6. 对 kernel 目录的期望（提请 A 线纳入 02/03）

```
packages/kernel/src/
├── errors/{cordex-error.ts, define-errors.ts, errors.service.ts, invariant.ts, fingerprint.ts, reporters/console.reporter.ts}
├── logger/{logger.service.ts（cordis logger 适配 + fields）, redact.ts, sinks/{console.sink.ts, ring-buffer.sink.ts}}   // pino sink 在 apps/server 适配器
├── telemetry/{telemetry.service.ts, names.ts（登记接口）, noop.provider.ts}                                              // OTel Provider 在 apps/web、apps/server 适配器
├── diagnostics/{dump-fiber-tree.ts, list-pending.ts, assert-no-live-effects.ts, list-contribution-points.ts}
└── augment.ts（ErrorCodes / SpanAttrs / MetricName / EventProps 的登记接口）
```

---

## 7. 与 Univer 的对照与机械验证

| 编号 | Univer | 本项目 | 机械验证 |
|---|---|---|---|
| A24 | `ILogContext`/错误码/telemetry 零实现、1 个消费者 | 三服务 M1 接入；每个 span/metric 有消费者登记 | 扫描器：`telemetry.span('x')` 的 `'x'` 必在 §3.2/3.3 登记表且有 `consumer` 字段；`console.*` 与裸 `Error` lint 报错（09-02/06） |
| A25 | dispose 门禁文档被删 | `assertNoLiveEffects` 是每个插件生命周期测试的必含断言；`cordex_effects_live` 告警 | 测试模板（11 §4）+ 扫描器检查每个 `plugin.ts` 有对应 lifecycle 测试 |
| A11 | 一崩全崩 | Fiber FAILED 隔离 + 元素级隔离 | 单测：抛错插件/渲染器不影响其余 |
| A16 | 门禁 warn 全失效 | 所有规则 `error`；豁免 `// cordex-allow(<rule>): <issue-url>` 计数进预算 | 09-06 |
| D 级观测 | — | 错误码/日志字段/指标名三张登记表由类型系统 + 扫描器守护 | 类型测试 + 扫描器 |

---

## 8. 待决事项

| # | 事项 | 默认 | 决策人 |
|---|---|---|---|
| O1 | 错误平台：自建（OTel logs）vs Sentry | OTel 全链路 + Sentry 可选 Provider | 运维 |
| O2 | 客户端诊断上报是否需用户同意开关 | 提供开关，默认开 | 产品/法务 |
| O3 | 日志保留期 | 14 天热、90 天冷 | 运维 |
| O4 | `debug` 日志在生产是否允许按文档/用户开启 | 允许（环境变量 + 5 分钟 TTL；单组织部署无租户维度） | 运维 |

## 9. 对章程的异议/建议

- **S9**：D11 建议补充「`console.*` 在包内禁止；错误码/span/metric 名称通过声明合并登记并由扫描器校验」以把 A24 的反制写成章程级约束。

## 10. 跨条线要求

- A 线（kernel）：按 §1.5/§2/§3.1/§4/§6 提供三服务与诊断 API；Fiber `apply` 异常转 `FAILED` 并 `errors.report`；`ErrorCodes/SpanAttrs/MetricName/EventProps` 登记接口位于 `@cordexjs/kernel` 的 augment。
- 类型治理线：lint 禁裸 `Error`/`console`/`enum`；扫描器校验错误码/span/metric 登记与消费者；lifecycle 测试存在性检查。
- 产品：PRD 06 埋点清单以 §3.4 命名规则落地；O2。

---

## 11. v0.2 补充：公开事件名定稿提案（EM-05 ↔ 03/10）、PRD 错误码映射、05 §11 的落地

> 追加于产品线与 A 线落盘之后。事件登记表本体在 03（kernel `Events` 增强）；本节是运行时线对「一套定稿名」的提案，供总编排合并；PRD EM-05 表在定稿后同步。

### 11.1 公开事件定稿提案（`<域>/<动作>`；全部在 `Events` 接口声明，扫描器 `events-declared` 校验）

| 域 | 事件（定稿） | 分发 | 载荷要点 | 发出者 | 取代（PRD / A 线 / 本线草稿） |
|---|---|---|---|---|---|
| unit | `unit/opened` `unit/open-progress` `unit/open-failed` `unit/closed` `unit/dirty-changed` `unit/saved` `unit/migrated` | emit | unitId、阶段/百分比、code、schemaVersion | model-core | – |
| command | `command/executed` `command/rejected` `command/failed` `command/audited` | emit | id、durationMs、reason、审计摘要 | 命令管线（05） | – |
| store | `store/transaction`（公开订阅 ≥ 50 ms 合并）、`store/loaded` | emit | transactionId、`origin{ kind, via? }`、touched 数、影响元素数 | store Provider | 本线 `store/history-changed` → `history/changed` |
| history | `history/changed` | emit | canUndo / canRedo / depth | history | – |
| store | `store/undo-skipped` | emit | `{ skipped: UndoSkip[]; wholeStep: boolean }`（载荷以 40-modules/02 §2.4 为准；撤销时同键已被他人后写而跳过，rulings §4.15 Q3） | store Provider | – |
| selection / view | `selection/changed`；`view/page-changed` `view/zoom-changed` `view/mode-changed` | emit | 摘要（类型、数量、页；无文本） | `selection` / viewport | – |
| render | `render/first-paint` `render/frame`（cordis 事件，进程内消费）`render/element-failed` `render/element-degraded` `render/font-fallback` | emit | unitId、pageId、kind、reason、font；`render/frame` 载荷 `{ pages, elementsUpdated, ms, overrun }` | engine-render / render-dom | 总编排定稿：弃 02 的 `render/painted`；遥测事件 `perf/frame` 由 `render/frame` 派生（§3.4，抽样），不是 cordis 事件；A `render/error` 与本线 `render/element-error` → `render/element-failed` |
| layout | `layout/fonts-ready` `layout/measurer-changed` | emit | families / measurerId | render-dom / engine-layout | – |
| export | `export/started` `export/completed` `export/failed` | emit | format、pages、ms、bytes | formats | – |
| collab | `collab/state-changed` `collab/synced` `collab/soft-conflict` `collab/auth-failed` `collab/reconnect` `collab/update-rejected` `collab/repair` | emit | prev/next、type、code、reason、paths | collab-yjs | 本线 `collab/session-state` 与 A `collab/status-changed` → `collab/state-changed`；本线 `collab/rejected` → `collab/update-rejected`；`collab/backpressure` 降为指标 |
| presence | `presence/joined` `presence/left` `presence/changed` | emit | clientId、userId、page | presence | – |
| permission | `permission/changed` `permission/denied` | emit | 能力位差异、被拒命令 id | **`permissions` 服务唯一发出**（`applyRemoteDecisions` 之后 / 命令管线拒绝时） | 本线与 A 线的 `collab/permission-changed` 弃用；collab-yjs 不发权限事件 |
| comment | `comment/added` `comment/replied` `comment/resolved` `comment/reopened` `comment/deleted` `comment/mentioned` | emit | threadId、authorId、mentioned、锚点摘要（正文可配置脱敏） | comments 插件（观察 `resources.comments.*`） | – |
| plugin | `plugin/loaded` `plugin/failed` `plugin/incompatible` | emit | id、version、code | kernel | – |
| error | `error/raised` | emit | code、severity、retryable、unitId? | `errors.report` | – |

规则：载荷不含文档文本（评论正文除外且可脱敏）；同一 Unit 内按发生顺序；`store/transaction` 先于 `command/executed`；`waterfall` 拦截点（如 `command/before-execute`）属 05 管线内部契约，不进公开表；公开事件订阅返回 disposer（`ctx.on` 语义）。

### 11.2 PRD 斜杠形式错误码 → 定稿码（§1.1 格式）

| PRD | 定稿 | HTTP / WS |
|---|---|---|
| `auth/invalid-token` `auth/expired` `auth/forbidden` | `server.auth.invalid_token` `server.auth.expired` `server.auth.forbidden` | 401 / 401 / 403；4401 / 4401 / 4403 |
| `collab/auth-failed` | 事件 `collab/auth-failed`，载荷 code ∈ `collab.unauthenticated \| collab.forbidden \| collab.doc_not_found \| collab.schema_too_new \| collab.protocol_mismatch \| collab.room_full` | 见 06 §6.5（`protocol_mismatch` = 4427） |
| `format/limit-exceeded{limit, actual}` | `format.limit_exceeded` | 413 |
| `collab/soft-conflict{type}` | 事件（非错误）；指标 `cordex_collab_soft_conflicts_total{type}`；`type` **不含** `undo-skipped`——撤销跳过走 `store/undo-skipped` 单独统计（rulings §4.17 D5） | – |
| `collab/reconnect{reason:"server-shutdown"}` | 事件 `collab/reconnect`，reason ∈ `server-shutdown \| network \| auth-refresh \| capacity` | – |

### 11.3 05 §11 要求的落地（日志字段 / 指标名）

| 事件 | 日志字段（§2.2 规范） | 指标 |
|---|---|---|
| `command/audited` | `cordex.command_id` `cordex.unit_id` `cordex.user_id`（哈希）`cordex.mutations` `cordex.elements` `cordex.veto?` | `cordex_commands_total{command_id,result}` |
| `command/failed` | + `cordex.error_code` `cordex.error_fingerprint` | `cordex_command_failures_total{command_id,code}` |
| `permission/denied` | + `cordex.permission_action` `cordex.role` | `cordex_permission_denied_total{action}` |
| `collab/soft-conflict` | `cordex.conflict_type` | `cordex_collab_soft_conflicts_total{type}`（CO-08 健康指标；**不含**撤销跳过，rulings §4.17 D5） |
| `store/undo-skipped` | `cordex.undo_skipped_keys`（`skipped.length`）`cordex.whole_step` | `cordex_store_undo_skipped_total{whole_step}`（**单独统计**跳过次数与整步跳过次数，不计入软冲突率，rulings §4.17 D5） |
| `collab/update-rejected` / `collab/repair` | `cordex.reason` `cordex.rule` | `cordex_collab_updates_rejected_total{reason}` / `cordex_collab_repairs_total{rule}` |
| awareness 丢弃 | – | `cordex_collab_awareness_dropped_total{reason}` |
