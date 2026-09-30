# 15 客户端事件、错误与遥测

> 状态：v0.1 | 负责：前端设计线 | 更新：2026-09-25；2026-09-25（§4.19）；2026-09-26（§4.20）；2026-09-26（§4.21 整合：traceparent 的载体由 CONTROL.auth 改为 Auth 帧 token JSON（§6.2、图、V13、里程碑行））；2026-09-26（§4.21 Remap：原 30/08 引用按 60-backend/README §6.1 改指新位置，30/08 已删除） | 依赖：30-architecture/10 §1–§5、§11；PRD 05 EM-05/EM-12/EM-13；PRD 06；PRD 04 NF-11；ADR-0011、ADR-0030；rulings §5、§4.11 C-24/C-25、§4.17 D5、§4.18 BE-30/UX-02、§4.20 FE-10/FE-16；60-backend/18

本文是浏览器侧事件、错误与遥测的唯一事实源：三类事件的边界、前端发布者与订阅者、宿主事件桥、浏览器中的错误模型与错误边界、客户端错误上报管线、OTel Web、产品事件的前端发布方、同意与默认、诊断。命名规则、日志字段与脱敏规则、错误码格式与 HTTP / WS 映射、公开事件定稿表留在 [30/10](../30-architecture/10-observability-and-errors.md)（§1–§3、§11.1）；`/telemetry/*` 控制器、限流、Collector 路由、服务端 span 与指标统一名表归 [60/18](../60-backend/18-observability-and-ops-endpoints.md)；产品事件清单的权威是 [PRD 06](../10-prd/06-metrics-and-analytics.md) §3.2，本文只登记前端发布方。

## 0. 分工速查

| 主题 | 本文 | 引用 |
|---|---|---|
| 事件命名规则、公开事件定稿表与载荷 | §1 摘要 | 30/10 §11.1；载荷形状以 40/02 §2.4、40/05 §2.4、40/06 §2.4 为准 |
| 错误码格式、域清单、HTTP / WS 映射 | — | 30/10 §1.1、§1.4 |
| 错误码 → 用户文案与建议动作 | §4 | 文案本身在各包 locales（50/16 §1） |
| 上报端点、限流、体积上限、Collector | §6、§7 只写浏览器侧 | 60/18 §9；路由表 60/15 §3.14 |
| 嵌入通道（postMessage 消息与桥的装配） | §3 只写事件语义 | [50/12](./12-viewer-embedding-and-render-page.md) §9–§10、[50/14](./14-client-security.md) §11 |
| 设置抽屉中的两个诊断开关 | §9 语义 | 界面位置 [50/10](./10-editor-shell-and-interaction.md) §10 |

## 1. 事件三类

| 类 | 载体 | 命名 | 语义 | 登记与校验 |
|---|---|---|---|---|
| A cordis 公开事件 | `ctx.emit` / `ctx.on`（`Events` 接口声明合并） | `<域>/<动作>`，域在章程 §5.5 保留域或带 `<vendor>:` 前缀 | 进程内、同步、不采样；订阅返回 disposer；载荷不含文档文本（评论正文除外，可配置脱敏） | lint `cordex/events-must-be-declared`（含域白名单规则 3） |
| B 应用壳私有事件 | `apps/web/src/domain/app-events.ts` 的 typed `EventTarget` | `app/<动作>` | 只在 `apps/web` 内使用；章程 §5.5 把 `app` 单列为应用壳私有域，禁止 `packages/*` 使用 | 不经上述 lint；`packages/*` 本就不能 import `apps/*`（depcruise） |
| C 遥测事件 | `ctx.telemetry.event(name, props)`，经 `defineTelemetryEvents` 登记 | 沿用 PRD 06 的 `<域>/<动作>`；分「镜像 A 类事件」与「遥测专用」两种 | 可采样、附公共属性、经 `telemetry.sink` 出口；出厂 no-op | lint `cordex/telemetry-events-must-be-declared` + 扫描器 `scan-telemetry-events` |

- **A 类定稿集合**：以 30/10 §11.1 为准；PRD EM-05 表补 `store/undo-skipped`（M3，载荷 `{ skipped: UndoSkip[]; wholeStep: boolean }`）。依据：MECH-INC 中 INC-32（rulings §4.17 D5；30/10 §11.1）。
- **B 类集合**：`app/navigated{from,to}`、`app/session-changed{state}`、`app/online-changed{online}`、`app/document-opened{documentId,documentType}`、`app/document-closed{documentId,dirtyDiscarded}`、`app/preferences-changed{keys}`、`app/intent{target}`（40/11 §2.4；定义在 50/02 的应用壳内，本文只列出供遥测与桥引用）。
- **C 类以 PRD 06 为权威**：30/10 §3.4 中 `doc_opened` 一类 snake_case 旧名作废，PRD 06 §3.2 按 INC-33 应逐行标「镜像」或「遥测专用」；PRD 当前只标了部分行，完整分类以本文 §8 为准，待回写 PRD 06。遥测专用名（如 `session/*`、`search/*`、`clipboard/*`）不受章程 §5.5 保留域约束，由遥测登记表扫描。依据：MECH-INC 中 INC-33（PRD 06 为遥测清单权威，30/10 §3.4 自述）。
- **`render/frame` 与 `perf/frame` 并存，不是改名**：`render/frame(unitId, stats{ pages, elementsUpdated, ms, overrun, pendingDirty })` 是 A 类进程内事件（`/render` 页 ready 判据读 `pendingDirty`，50/12 §11）；`perf/frame{ frameMs, interaction, pages, elementsUpdated, overrun }` 是由它抽样派生的遥测专用事件。rulings §5 表中「`render/frame` vs `perf/frame`」一行已被 §4.11 C-25 覆盖。依据：INC-08（rulings §4.11 C-25 + §4.18 FE-09 + 30/10 §11.1）。

**图 1 事件三类与流向**

```mermaid
flowchart LR
  sdk["SDK 各包"]
  shell["apps/web 应用壳"]
  subgraph a["A 类：cordis 公开事件"]
    ev["Events 声明：域/动作，进程内，不采样"]
    rf["render/frame：含 pendingDirty"]
  end
  subgraph b["B 类：应用壳私有"]
    appev["app/*：typed EventTarget"]
  end
  subgraph c["C 类：遥测事件"]
    mirror["镜像：登记 mirrorOf 与投影函数"]
    only["遥测专用：session/*、perf/* 等"]
  end
  plugins["插件与 UI：ctx.on 原样订阅"]
  bridge["宿主事件桥：公开订阅，见 §3"]
  sink["telemetry.sink：出厂 no-op"]
  sdk -->|"ctx.emit"| ev
  sdk -->|"ctx.emit"| rf
  shell --> appev
  ev --> plugins
  ev --> bridge
  ev -->|"有 sink 时才订阅"| mirror
  rf -.->|"交互期间抽样派生 perf/frame"| only
  sdk -->|"telemetry.event"| only
  appev -->|"应用状态与遥测"| shell
  mirror -->|"公共属性、采样、批量"| sink
  only -->|"公共属性、采样、批量"| sink
```

怎么读：SDK 只发 A 类事件与遥测专用事件，应用壳只发 B 类事件；A 类事件被插件与宿主事件桥原样订阅，只有登记了镜像的事件才会被遥测服务投影成 C 类，并且只在存在 sink 时订阅（无 sink 时零开销）。
依据：ADR-0011 决策 5–6；30/10 §3.1、§11.1；PRD 06 §5 图 5-1。

**镜像实现**：遥测登记表（kernel `defineTelemetryEvents`，40/02 §4）的条目为 `{ name, version, mirrorOf?, project?, sample, privacy, schema }`，字段与 PRD 06 §5「事件 schema 注册表」一致（名称、版本、属性 schema、隐私级、采样率）。kernel 的 `telemetry` 服务在至少挂有一个 `telemetry.sink` 时，按 `mirrorOf` 订阅对应的 A 类事件，用 `project(payload)` 取出度量属性（如 `durationMs`、`pagesParsed`），再附公共属性、采样、交给 sink；各包不手写镜像代码。

## 2. 前端发布者与订阅者总表

载荷字段以 30/10 §11.1 与 40 各模块 §2.4 为准，本表只登记浏览器内谁发、谁收。

| 域 | 事件 | 发布方（包 · 文件） | 主要前端订阅方 | 里程碑 |
|---|---|---|---|---|
| unit | `unit/opened`、`unit/loaded`、`unit/open-progress`、`unit/open-failed`、`unit/closed`、`unit/dirty-changed`、`unit/saved`、`unit/migrated` | model-core · `unit/unit-plugin.ts`、`unit/units.service.ts`、`migration/migrations.service.ts` | 应用壳 `EditorPageState` 与最近文档（经桥）；ui-core `unitLoaded` 键；打开进度 UI | M1 / M2 |
| command | `command/executed`、`command/rejected`、`command/failed`、`command/audited` | model-core · `command/pipeline.ts`、`command/audit.ts` | ui-core 上下文键与状态栏；ui-react 通知模板 `command-failed` / `permission-denied` | M2 |
| store | `store/transaction`（公开订阅节流 50 ms）、`store/loaded`、`store/undo-skipped` | store-memory / store-yjs Provider | `SceneProvider.diff`（进程内原样）；应用壳回调式保存（经桥，节流）；撤销跳过提示条（[50/04](./04-document-commands-and-undo.md)） | M2 / M3 |
| history | `history/changed` | model-core · `history/history.service.ts` | ui-core `canUndo` / `canRedo` | M2 |
| selection | `selection/changed` | model-core · `selection/selection.service.ts` | ui-core 上下文键；presence 广播 | M2 |
| view | `view/page-changed`、`view/zoom-changed` | engine-render · Viewport 服务（唯一发布者，编辑器与查看器共用） | 查看器壳页码、放映 `?page=` 同步、桥（EM-05） | M1 / M2 |
| view | `view/mode-changed` | ui-core · `application/operations/view-set-mode.ts` | `viewMode` 键、母版视图会话记忆、presence 广播 | M2 |
| render | `render/first-paint`、`render/frame`、`render/element-failed`、`render/element-degraded`、`render/font-fallback`、`render/page-mounted`、`render/page-unmounted` | engine-render · `render.service.ts`；render-dom · `paint/painter.ts`、`fonts/font-face-loader.ts`、`target/dom-render-target.ts` | `/render` 页 ready 判定（全量）；保真摘要；`render/element-failed` → `errors.report`；`perf/frame` 派生 | M1 |
| layout | `layout/fonts-ready`、`layout/measurer-changed` | render-dom / engine-layout | `/render` 页字体结算；度量缓存失效 | M1 |
| export | `export/started`、`export/completed`、`export/failed` | model-core · `format/formats.service.ts` | 导出对话框进度与重试 | M2 |
| collab | `collab/state-changed`、`collab/synced`、`collab/soft-conflict`、`collab/auth-failed`、`collab/reconnect`、`collab/update-rejected`、`collab/repair`（`collab/backpressure` 按 30/10 §11.1 降为客户端指标 `cordex_collab_outbound_queued`，`collab/latency` 为遥测专用事件，二者都不是 cordis 事件、不提请章程 §5.5，§7.2、§8） | collab-yjs · `session-driver.ts`、`sync/yjs-sync-engine.ts`、`permission/permission-gate.ts`；collab-transport-ws · `handshake.ts`（经 SessionDriver 转发） | 协同状态胶囊与横幅（[50/07](./07-collaboration-client.md)）；`collab/auth-failed{code:'collab.unauthenticated'}` 与换票 401 一样进入「登录已过期」流程，不走重连（50/07 §8、50/02 §5） | M2（`collab/soft-conflict` 随多人协同体验层 M3；rulings §4.19 D-M2-CONTENT） |
| presence | `presence/joined`、`presence/left`、`presence/changed` | collab-yjs · `awareness/presence.service.ts` | 在场头像、远端光标覆盖层、在场播报（50/16 §8） | M3 |
| permission | `permission/changed`、`permission/denied` | model-core · `permission/permissions.service.ts`（唯一发布者） | ui-core `isReadOnly` 与 `can.<capability>`；应用壳更新角色与模式下拉的可选项，不改 `EditorHost mode`（[50/10](./10-editor-shell-and-interaction.md) §3.1，rulings §4.20 FE-10） | M2 / M3 |
| comment | `comment/added`、`comment/replied`、`comment/resolved`、`comment/reopened`、`comment/deleted`、`comment/mentioned`；载荷 `{threadId, replyId?, authorId, mentioned?, anchorSummary, origin:'local'\|'remote', body?}` | `comments` 包（iso，文档类型盲；rulings §4.19 D-COMMENTS-PKG） | 评论面板、画布评论钉、通知偏好（[50/08](./08-comments-and-version-history.md) §8） | M3 |
| plugin | `plugin/loaded`、`plugin/failed`、`plugin/incompatible` | kernel · `failure-isolation.ts`、`manifest/verify.ts` | 插件管理器页；ui-react 贡献错误边界文案 | M2 |
| error | `error/raised` | kernel · `services/errors.service.ts` | 应用壳 `AppErrorBoundary`（`severity:'fatal'`）；遥测镜像 | M1 |
| i18n | `i18n/locale-changed` | i18n · `services/i18n.service.ts` | ui-react 重渲染；ui-core 标题缓存 | M2 |
| ui | `ui/context-key-changed`、`ui/panel-opened`、`ui/panel-closed`、`ui/shortcut-conflict`、`ui/theme-changed` | ui-core · `context-keys.service.ts`、`panel-operations.ts`、`shortcuts.service.ts`、`theme.service.ts` | ui-react；集成方宿主同步主题 | M2 |
| slide | `slide/thumbnail-updated` | slide-render · `application/services/thumbnail.service.ts` | slide-ui 缩略图侧栏、母版缩略图窗格 | M1 / M2 |
| slide | `slide/show-changed` | slide-ui · `application/present.ts` | 应用壳全屏控制、放映舞台 | M2 |
| contribution | `contribution/changed` | kernel · `contribution/set.ts` | ui-react 贡献渲染器刷新与诊断 | M1 |

`comment/*` 的发布方为 iso 包 `@cordexjs/comments`（ResourceHook `comments.threads`，文档类型盲），slide 专属锚点、检查器评论页签与画布评论钉由 slide-ui 贡献。依据：rulings §4.19 D-COMMENTS-PKG；INC-39（命名空间 `comments.*`，rulings §4.18 FE-01）。

`comment/*` 的**正文默认脱敏**（rulings §4.20 FE-16，登记同步 30/10 §11.1）：载荷省略 `body`、只给正文长度；集成方显式开启 `comments` 包选项 `comments.events.includeBody` 才带正文；跨 origin 的 postMessage 另按 §3 ③ 规则默认不转发正文。`origin` 区分本地与远端变更，建议集成方只对 `origin:'local'` 发通知（每条评论只在作者端触发一次，50/08 §8）。

`view/page-changed` 与 `view/zoom-changed` 的发布方依据：VIEW-EVENTS（Viewport 归 engine-render，30/07 §2.3；40/11 §12 G-9 结案）。

**顺序与合并**

1. 同一 Unit 内的事件按发生顺序同步分发；`store/transaction` 先于对应的 `command/executed`（EM-05）。
2. 进程内订阅（`ctx.on`，插件与 UI）收到的是逐条原始事件，不合并。
3. 公开订阅面（§3 的集成方回调与 postMessage）对 `store/transaction` 与 `render/frame` 做 **50 ms 尾沿节流**：窗口内只投递最后一条，载荷形状不变、不增字段；需要逐条数据的集成方应写插件用 `ctx.on`，或读遥测。
4. 跨 Unit 不保证顺序；`app/*` 与 A 类事件之间不保证顺序（应用壳只依赖自己收到的顺序）。

## 3. 宿主事件桥

`apps/web/src/application/host/host-event-bridge.ts` 在 `createEditorHost` 返回后逐个 `ctx.on` 订阅下表事件，disposer 交给 host 的 `dispose()`；事件名与载荷完全沿用 A 类定稿，不改名、不增字段（40/11 §2.4）。集成方在形态 A–D 使用同一个公开订阅面（`CreateEditorHostParams.callbacks.onEvent` 或直接 `ctx.on`，通道见 50/12 §10）。

| 接收方 | 形态 | 收到什么 | 节流 | 跨边界处理 |
|---|---|---|---|---|
| ① 应用状态 | apps/web | `unit/*`、`export/*`、`collab/state-changed`、`permission/changed`、`plugin/*`、`error/raised` | 否 | 同 realm，原样 |
| ② 集成方回调 `callbacks.onEvent` | A–D（50/12 §10） | 下表「公开」列 | §2 第 3 条 | 同 realm，原样（载荷本就不含文档文本） |
| ③ `postMessage` 到父页面 | E | 与 ② 相同（下表「公开」列），封装为 `cordex:event` 消息（消息形状在 protocol `embed/messages.ts`，50/12 §9） | 同上 | 去掉 `cause` 与堆栈；评论正文默认不转发；不含令牌与预签名 URL（50/14 §11.1） |

| 域 | 编辑器页 | `/render` 页 | 公开（② / ③） |
|---|---|---|---|
| unit | 全量 | `unit/opened`、`unit/open-failed` | 全量 |
| command / history / selection | 全量 | 不订阅 | 全量；`selection/changed` 由集成方选择是否订阅 |
| store | `store/transaction`（节流）、`store/undo-skipped` | 不订阅 | 同左 |
| view | 全量 | 不订阅 | 全量 |
| render / layout | 只转发 `render/element-degraded`、`render/element-failed`、`render/font-fallback` | 全量（ready 判定，50/12 §11） | `render/first-paint`、`render/frame`（节流）、降级三件 |
| export | 全量 | 不订阅 | 全量 |
| collab / presence | 全量（M3） | 不订阅 | 全量 |
| comment / permission | 全量 | 不订阅 | 全量；`comment/*` 正文按 ③ 规则 |
| plugin / error | 全量 | `error/raised` | 全量 |

**图 2 宿主事件桥转发**

```mermaid
flowchart LR
  host["cordis host：A 类事件"]
  bridge["host-event-bridge：逐个 ctx.on，disposer 交 dispose"]
  throttle["公开订阅节流：store/transaction、render/frame 50 ms 尾沿"]
  state["① 应用状态：EditorPageState、保存态、toast、错误页"]
  cb["② 集成方回调 callbacks.onEvent：形态 A–D"]
  redact["跨 origin 处理：去 cause 与堆栈，评论正文默认不转发"]
  pm["③ postMessage：形态 E，targetOrigin 为已校验父页面"]
  parent["父页面"]
  host --> bridge
  bridge -->|"进程内，不节流"| state
  bridge --> throttle
  throttle --> cb
  throttle --> redact --> pm --> parent
```

怎么读：桥只有一个订阅入口，按接收方分三路；应用状态走不节流的直连路径，两条公开路径先过同一个节流器，其中跨 origin 的一路再做脱敏，发送目标永远是已校验的父页面源。
依据：40/11 §2.4；PRD 05 EM-05；50/14 §11.1。

## 4. 浏览器中的错误模型

### 4.1 类型与边界

- **`CordexError`**（30/10 §1.2）：`code`、`details`、`severity`（`fatal` / `error` / `warning`）、`retryable`、`user`（能否向用户展示）、`cause`、`fingerprint`、`context{ unitId?, traceId? }`。子类只有校验、聚合、不变量三种，分类靠 `code` 与属性而不是 `instanceof`。
- **`Result` 与 `throw` 的边界**以 30/10 §1.3 为准：纯函数与 iso 库返回 `Result`；浏览器 API 与网络失败返回 `Promise<Result>`；只有插件 `apply`、命令执行、Worker 消息处理这类边界把 `Result` 转成异常。
- **REST 错误**：服务端返回 problem+json，`infrastructure/api/http.ts` 解析为 `ErrorEnvelope`（`code`、`detail`、`traceId`、`retryable`、`details?`）。码联合在 protocol `errors/codes.ts`，HTTP / WS 映射在 `errors/http-map.ts`，信封在 `rest/problem.ts`。依据：INC-11/INC-13（60-backend/15 §1、30/10 正文 > 40）。
- **网络不可达与超时**映射为 protocol 已登记的 `transport` 域码（码名由 M-02 `errors/codes.ts` 登记，`apps/**` 不新造码：`apps/**` 不得声明合并 `ErrorCodes`，40/11 §10）。
- **WS 关闭码**的定义在 30/06 §6.5，客户端据此的行为在 50/07。

### 4.2 错误码 → 文案与建议动作

依据：ERR-COPY（PRD 05 EM-12 + rulings §4.18 GV-15：对不上的名字落为既有扫描器子规则）。

- 文案键为 `errors.<code>.title` 与 `errors.<code>.action`（如 `errors.format.quota_exceeded.title`）。文案遵循设计 07 §7「发生了什么 + 能做什么」两段式，不把错误码当标题给最终用户；码与 `traceId` 放在可展开的「查看详情」里。
- `details` 的字段按 ICU 占位符插值（如 `{limit}`、`{actual}`、`{dimension, select, slides {页数} elementsPerSlide {单页元素数} other {元素总数}}`）。
- **谁提供文案**：声明错误码的包在自己的 `locales/*.json` 中以命名空间 `errors.<domain>` 贡献对应键（`i18n.bundle` 的键为 `${namespace}:${locale}`，按域分命名空间可避免多个包互相 `replace`）；protocol 登记的码（`server.*`、`transport.*`、`collab` 线上码）由 `@cordexjs/i18n` 自带的语言包提供，这样无 host 页面（登录、列表、设置）也能显示（50/16 §3）。集成方可按键覆盖（EM-08）。
- **机械约束**：`defineErrors` 表与 protocol `errors/codes.ts` 中 `user:true` 的每个码，都必须在 zh-CN 与 en-US 中同时有 `.title` 与 `.action`——作为扫描器 `scan-contributions` 规则 (f) 的子规则执行（不新增扫描器）。
- `user:false` 的码一律显示通用文案 `errors.generic.{title, action}`，并附「查看详情」。

### 4.3 属性 → 呈现层级

呈现层级（横幅 > Toast > FieldError > 状态胶囊）与各组件的外观以 50/10 §11 为准，本表只给出错误属性到层级的映射：

| 条件 | 呈现 | 上报 |
|---|---|---|
| `severity:'fatal'` 或未被任何边界接住 | `AppErrorBoundary` 错误页：说明、「重新加载」、「复制诊断信息」（§10） | 是 |
| 页面级失败（打开失败、host 创建失败） | 编辑器页 `failed{code}` 态：重试 / 返回首页；可只读打开时提供「只读打开」 | 是 |
| `user:true` 且 `retryable:true` | Toast 带「重试」；表单字段错误用 FieldError | `error` 及以上 |
| `user:true` 且 `retryable:false` | 横幅或对话框，给出 `action` 文案对应的动作 | `error` 及以上 |
| `severity:'warning'` | Toast 3.5 s | 按 §6 采样 |
| `user:false` | 通用文案 Toast +「查看详情」 | 是 |

几个常见码的去向（文案以语言包为准）：

| 码 | 去向 |
|---|---|
| `server.auth.expired` | 「登录已过期」流程，不走重连（UX-02，50/02 §4） |
| `server.auth.csrf_rejected` | 横幅「请求被拒绝，请刷新页面后重试」 |
| `permission.denied` | Toast「需要编辑权限」（ui-react `permission-denied` 模板） |
| `document.quota_exceeded` | Toast，带 `dimension` 与上限，命令被拒、连接保持 |
| `format.quota_exceeded` / `format.limit_exceeded` | 导入失败态，带上限与实际值 |
| `format.encrypted` / `format.macro_rejected` | 导入失败态：「文件已加密，请先去除密码后再导入」/「请另存为 .pptx 后再导入」 |
| `storage.quota_exceeded` | 上传或新建失败对话框 |
| `collab.room_full` | 横幅「协作人数已满」；是否降为只读或排队重试由 50/07 的会话状态机决定 |
| 403 且 `details.reason` 为 `share_link.expired` / `share_link.revoked` | 「链接已失效」页（INC-20，50/02 §11） |

## 5. 错误边界拓扑

一个错误只在最近的边界被接住，不向兄弟单元扩散（章程 A11；30/10 §1.3）。

| 边界 | 位置 | 接住什么 | 用户看到 | 上报 |
|---|---|---|---|---|
| 元素级 | render-dom `paint/painter.ts` 的 try/catch | 单个元素渲染抛错 | 该元素位置显示占位；发 `render/element-failed` | `errors.report` |
| 贡献项级 | ui-react `ContributionRenderer` 逐项 ErrorBoundary | 插件贡献的面板、分组、状态栏项、覆盖层渲染抛错 | 按设计 06 §3 降级：面板换错误卡片、页签自动隐藏、状态栏项淡出、状态栏「插件」图标变警告并计数 | 是，带 `pluginId` |
| Fiber 级 | kernel `failure-isolation.ts` | 插件 `apply` 抛错 | 该插件 `FAILED`，其余照常；插件管理器页显示；`PresetReport` 记录 | 是，`plugin/failed` |
| 命令级 | model-core 命令管线 | 命令执行抛错 | 事务回滚；ui-react `command-failed` Toast | 是，`command/failed` |
| Worker 级 | 导入解析、导出、EMF Worker 的消息处理 | 解析或编码失败 | `unit/open-failed{code, stage}` 或 `export/failed` 对应的失败态 | 是 |
| 页面级 | apps/web `EditorPage` 等页面边界 | host 创建失败、页面渲染抛错 | `EditorPageState.failed{code}`：重试 / 只读打开 / 返回首页 | 是 |
| 应用级 | apps/web `AppErrorBoundary` + 路由 `errorElement` | 以上都未接住的渲染错误、`error/raised{severity:'fatal'}` | 错误页：「重新加载」「复制诊断信息」 | 是 |
| 全局兜底 | apps/web 注册 `window` 的 `error` 与 `unhandledrejection` | 异步回调中的未捕获异常 | 不打断界面；必要时 Toast | 是，包装为 kernel 已登记的未知错误码（30/10 §1.4 末行） |

协同会话的连接失败、降权、离线不是「错误边界」问题，由 50/07 的会话状态机处理并以横幅表达；鉴权过期由 50/02 的会话状态机处理。

**图 3 错误边界拓扑与降级**

```mermaid
flowchart TB
  el["元素渲染抛错"]
  contrib["插件贡献项渲染抛错"]
  apply["插件 apply 抛错"]
  cmd["命令执行抛错"]
  worker["Worker 解析或编码失败"]
  page["页面或 host 创建失败"]
  unhandled["未捕获异步异常"]
  bEl["元素占位 + render/element-failed"]
  bContrib["逐项 ErrorBoundary：按设计 06 §3 降级"]
  bFiber["Fiber FAILED：兄弟插件不受影响"]
  bCmd["事务回滚 + command-failed Toast"]
  bWorker["unit/open-failed 或 export/failed 失败态"]
  bPage["EditorPageState.failed：重试、只读打开、返回首页"]
  bApp["AppErrorBoundary：重新加载、复制诊断信息"]
  report["errors.report：去重、采样、脱敏，见 §6"]
  el --> bEl
  contrib --> bContrib
  apply --> bFiber
  cmd --> bCmd
  worker --> bWorker
  page --> bPage
  bPage -.->|"页面边界自身失败"| bApp
  unhandled --> report
  bEl & bContrib & bFiber & bCmd & bWorker & bPage & bApp --> report
```

怎么读：上排是七类错误源，中间是各自最近的边界及其降级表现，只有页面边界自身失败时才上升到应用级错误页；所有边界最终都汇入同一个 `errors.report`。
依据：30/10 §0、§1.3；设计 06 §3；40/11 §4.4（`AppErrorBoundary`）。

## 6. 客户端错误上报管线

依据：30/10 §1.5、§2.3、§2.4、§5；rulings §4.18 BE-30（端点要求登录、errors ≤ 64 KiB）；TELEMETRY-DEFAULT（apps/web 错误上报默认开）。端点语义与限流见 60/18 §9，路由见 60/15 §3.14。

**管线组成**

1. **kernel `errors` 服务**：`fingerprint = hash(code + 归一化 message + 顶层栈帧)`；同一 fingerprint 60 s 内只交给 sink 一次并累加计数；采样 `severity` 为 `error` 及以上 100%、`warning` 10%；脱敏按 30/10 §2.3（内容字段拒绝、邮箱与姓名哈希、令牌类字段 `[redacted]`）。
2. **环形缓冲**：生产环境 logger sink 为 `ring-buffer`，保留最近 500 条 `debug` 及以上的结构化日志；上报时取最近 50 条、再次脱敏后作为 breadcrumbs。
3. **sink 选择**：`apps/web/src/application/host/sinks.ts` 按 §9 的开关选择 `errors.sink`：开发为 `console`；生产且会话已登录且 `diagnostics.errorReports` 生效时为 `server-api`；否则 `no-op`。登录前的页面（登录页、配置错误页）只写控制台（ADR-0030 决策 1）。
4. **`server-api` sink 的发送队列**：

| 规则 | 取值 |
|---|---|
| 批量 | 每请求 ≤ 20 条；序列化后 ≤ 60 KiB（留出头部余量，服务端上限 64 KiB） |
| 节流 | 每 10 s 至多 1 次请求 |
| 队列上限 | 100 条；满时丢最旧并累计 `dropped`，下一批带上 |
| 单条上限 | ≤ 16 KiB：`stack` 截断到 8 KiB，breadcrumbs 从最旧开始删直到放得下 |
| 请求头 | `X-Cordex-Request: 1`（CSRF，50/14 §8）、`traceparent`（§7） |
| 页面隐藏 | `pagehide` 或 `visibilitychange` 为 `hidden` 时用 `fetch(..., { keepalive: true })` 补发队列头部（keepalive 请求体总量受浏览器 64 KiB 限制）；不使用 `navigator.sendBeacon`，因其不能附带 CSRF 请求头 |
| 204 | 移除已发送项 |
| 401 | 丢弃本批、不重试；sink 暂停直到收到 `app/session-changed{state:'authenticated'}` |
| 413 | 本批对半拆分重发一次，仍失败则丢弃 |
| 429 | 按 `Retry-After` 退避，保留队列 |
| 5xx 或网络错误 | 指数退避重试，至多 3 次后丢弃 |

5. **载荷**：`ClientErrorReport`（protocol `rest/telemetry.ts`；字段为 `code`、脱敏后的 `message`、`fingerprint`、源映射前的 `stack`、`appVersion`、`pluginManifestHash`、`unitId?`、`sessionId?`、`traceId?`、`breadcrumbs`、`env{ ua, viewport, memory? }`），字段定义以 protocol 文件为准，本文不复写。
6. **URL 脱敏**：载荷与 breadcrumbs 中出现的任何 URL 只保留 origin 与路径模板（`/documents/:id`），去掉 query 与 fragment（分享令牌在 fragment 里，50/14 §8）；`X-Cordex-Share-Token` 永不出现。
7. **源映射**：生产构建产出 hidden source map，由 CI 上传供服务端反解（60/18），浏览器不加载 `.map`。

**图 4 客户端错误上报（环形缓冲 → 批量 → keepalive 兜底）**

```mermaid
sequenceDiagram
  participant C as 调用方或错误边界
  participant E as kernel errors 服务
  participant L as 环形缓冲 500 条
  participant S as apps/web server-api sink
  participant API as telemetry errors 端点
  C->>E: errors.report(err, ctx)
  E->>E: fingerprint 60 s 去重，按 severity 采样，脱敏
  E->>L: 取最近 50 条作 breadcrumbs
  E->>S: report(err, ctx)
  S->>S: 入队，上限 100，满则丢最旧并计数
  loop 每 10 s 至多一次
    S->>API: POST 至多 20 条，带 X-Cordex-Request 与 traceparent
    alt 204
      API-->>S: 移除已发送项
    else 401
      API-->>S: 丢弃本批，暂停到会话恢复
    else 429 或 5xx 或网络错误
      API-->>S: 退避重试，至多 3 次
    end
  end
  Note over S,API: pagehide 时以 fetch keepalive 补发队列头部，不用 sendBeacon
```

怎么读：去重、采样与脱敏在 kernel 内完成，sink 只负责排队与发送；401 表示会话已失效，丢弃且不重试，其余失败按退避重试；页面隐藏时用 keepalive 请求把队列头部补发出去。
依据：30/10 §1.5、§2.4、§5；ADR-0030 决策 1；50/14 §8。

## 7. OTel Web

依据：ADR-0030 决策 1、5、6（浏览器 `sdk-trace-web` 经 OTLP/HTTP 代理；登记制；traces 头采样 10%）；rulings §4.18 BE-30（otlp 代理 ≤ 512 KiB 且只转发 traces）；30/10 §3.2 传播规则；INC-03/04/05（`traceparent` 是 Auth 帧 token JSON 的可选字段）。

- **只在 apps/web 装配**：SDK 包只依赖 kernel 的 no-op 契约；OTel Web SDK（约 40–60 KB gzip）是 `apps/web` 的惰性 chunk，只有 §9 的开关允许导出浏览器 span 时才加载（chunk 登记见 [50/13](./13-performance-and-bundling.md)）。
- **`traceparent` 始终生成**：即使不导出浏览器 span，`apps/web` 也为每个用户操作（打开文档、导出、保存等）生成 W3C `traceparent`（生成器极小，不需要 OTel SDK），用于把错误报告与服务端 trace 串起来。它不含任何身份或内容，数据只进部署方自己的服务端。
- **传播**：
  - HTTP：发往同源 `apiBase` 的请求带 `traceparent` 头；发往存储源的预签名请求**不带**（避免改变签名与触发跨源预检）。
  - WS：Auth 帧 token JSON 的可选字段 `traceparent` 建立会话父 span；update 帧不携带、不逐帧建 span（服务端用指标 + 1% 抽样 span，30/10 §3.2）。
  - 错误报告：`ClientErrorReport.traceId` 取当前操作的 trace id。
- **采样**：头采样比例 10%（ADR-0030 决策 6，与服务端 `telemetry.traces.sampleRatio` 默认值一致，60/18 §3），`traceparent` 的 sampled 位按此决定；浏览器侧不另设部署项。
- **导出**：`BatchSpanProcessor` → `POST /api/v1/telemetry/otlp`，单次导出体积控制在 512 KiB 以内，带 `X-Cordex-Request: 1`；401 时停止导出直到会话恢复；413 / 429 按 §6 同样规则处理。浏览器只导出 traces，不导出 metrics 与 logs（代理只转发 traces）。
- **浏览器指标不出网络**：§7.2 的指标只在进程内聚合，消费者是开发者面板、性能测试与 `perf/*` 遥测事件；运维看板上的量由服务端指标（60/18）或产品事件表达。

**图 5 traceparent 从浏览器到服务端**

```mermaid
sequenceDiagram
  participant U as 用户操作
  participant W as apps/web
  participant A as api 角色
  participant G as collab 网关
  participant O as otlp 代理
  participant C as OTel Collector
  U->>W: 打开文档
  W->>W: 生成 traceparent，sampled 位按头采样决定
  W->>A: GET 文档详情与最新快照，请求头带 traceparent
  A->>A: 自动仪表化的 HTTP span 以其为父
  W->>G: Auth 帧，token JSON 携带 traceparent
  G->>G: 建立会话父 span，update 帧不逐帧建 span
  opt 浏览器 span 导出已开启
    W->>O: POST /api/v1/telemetry/otlp，只含 traces
    O->>C: 转发 traces
  end
  W->>A: 错误上报，traceId 取自同一操作
  Note over W,C: 同一 trace id 串起浏览器 span、服务端 span 与错误报告
```

怎么读：浏览器为一次用户操作生成一个 `traceparent`，经 HTTP 头与 WS 首帧传给服务端；浏览器自己的 span 只有在导出开关打开时才经代理进入 Collector，但错误报告始终带同一个 trace id，因此即使不导出浏览器 span 也能在服务端 trace 中定位。
依据：30/10 §3.2；ADR-0030；60/18 §3、§9。

### 7.1 浏览器 span 清单（迁自 30/10 §3.2 的客户端条目）

名称经 `SpanName` 声明合并登记，由扫描器 `scan-observability-identifiers` 核对登记与消费者。服务端 span 见 60/18 §3。

| span | 关键属性 | 所在包 | 采样 |
|---|---|---|---|
| `unit.open` | `doc_type`、`source_kind`、`bytes` | model-core | 头采样 |
| `format.import` / `format.export` | `codec`、`bytes`、`parts`、`warnings` | ooxml-pptx（Worker 内计时，主线程建 span） | 头采样 |
| `command.execute` | `command_id`、`mutations`、`undoable` | model-core | 头采样 |
| `store.transaction` | `origin_kind`、`paths` | store-memory / store-yjs | 1%（热路径） |
| `render.frame` | `pages`、`elements_updated`、`overrun` | engine-render | 1% |
| `render.page_compose` | `page_id`、`elements` | slide-render | 头采样 |
| `layout.text_body` | `chars`、`lines`、`autofit_iterations` | engine-layout | 1% |
| `collab.bootstrap` | `http_ms`、`step2_bytes` | collab-yjs | 头采样 |
| `collab.sync_roundtrip` | `bytes` | collab-yjs | 1% |

### 7.2 浏览器指标（迁自 30/10 §3.3 的客户端条目）

名称经 `MetricName` 登记，命名规则见 30/10 §3.3；服务端指标统一名表在 60/18 §4，二者不重名。

| 指标 | 类型 | 标签 | 消费者 |
|---|---|---|---|
| `cordex_render_frame_ms` | histogram | `mode` | 开发者面板「渲染」页；性能测试（[70/09](../70-testing/09-performance-and-capacity.md)）；`perf/frame` |
| `cordex_render_elements_updated_total` | counter | `kind` | 开发者面板；A28 反制测试 |
| `cordex_command_latency_ms` | histogram | `command_id` | 开发者面板；性能测试 |
| `cordex_collab_roundtrip_ms` | histogram | — | 开发者面板「协同」页；`collab/latency` |
| `cordex_collab_session_transitions_total` | counter | `from`、`to` | 开发者面板；`collab/state-changed` 遥测 |
| `cordex_collab_pending_updates` | gauge | — | 协同状态胶囊的「未同步」判定输入（50/07） |
| `cordex_collab_outbound_queued` | gauge | — | 开发者面板「协同」页、诊断包；出站背压（原 `collab/backpressure` 事件降为本指标，30/10 §11.1，50/07 §5） |
| `cordex_collab_soft_conflicts_total` | counter | `type` | 开发者面板；`collab/soft-conflict` 遥测（MT-15）。服务端 `/metrics` 不含此项（60/18 §4.3） |
| `cordex_store_undo_skipped_total` | counter | `whole_step` | 开发者面板；`store/undo-skipped` 遥测（与软冲突率分开，rulings §4.17 D5；服务端 `/metrics` 不含此项，60/18 §4.3） |
| `cordex_fiber_state` | gauge | `plugin`、`state` | 开发者面板 PENDING / FAILED 检视 |
| `cordex_effects_live` | gauge | `plugin` | 生命周期测试 `assertNoLiveEffects`；开发者面板 |
| `cordex_cache_events_total` | counter | `cache`、`event` | 开发者面板「渲染」页缓存命中率 |
| `cordex_errors_total` | counter | `code`、`severity` | 开发者面板；`error/raised` 遥测 |

## 8. 产品事件与指标

依据：MECH-INC 中 INC-33（PRD 06 §3.2 为权威清单，逐行标「镜像」或「遥测专用」）；rulings §4.17 D5（`store/undo-skipped` 单独统计、不计入软冲突率 MT-15）；PRD 06 §0、§3.1、§5。

**公共属性**（PRD 06 §3.1）由 kernel `telemetry` 服务统一附加；`unitId`、`userId` 以 sha256 取前 12 位哈希（30/10 §2.3），可整体关闭；隐私级只允许 P0 / P1，P2（内容）禁止。

**镜像 A 类事件**（登记表条目带 `mirrorOf`，属性由 `project` 投影）：

| 域 | 镜像的事件 | 采样 | 里程碑 |
|---|---|---|---|
| unit | `unit/opened`、`unit/loaded`、`unit/open-failed`、`unit/closed`、`unit/dirty-changed`、`unit/saved`、`unit/migrated`；`unit/open-progress` | 不采样；`open-progress` 10% | M1 / M2 |
| render | `render/first-paint`、`render/element-degraded`、`render/element-failed`、`render/font-fallback` | 不采样 | M1 |
| command / store | `command/executed`、`command/rejected`、`command/failed`；`store/transaction`（合并 ≥ 50 ms）；`store/undo-skipped` | 不采样 | M2 / M3 |
| selection / view | `selection/changed`；`view/page-changed`、`view/zoom-changed`、`view/mode-changed` | `selection/changed` 10%，其余不采样 | M1 / M2 |
| export | `export/started`、`export/completed`、`export/failed` | 不采样 | M2 |
| collab / presence | `collab/state-changed`、`collab/synced`、`collab/soft-conflict`、`collab/reconnect`、`collab/auth-failed`、`collab/update-rejected`、`collab/repair`；`presence/joined`、`presence/left` | 不采样 | M2（`collab/soft-conflict`、`presence/*` M3） |
| comment / permission | `comment/added`、`comment/replied`、`comment/resolved`、`comment/reopened`、`comment/deleted`；`permission/changed`、`permission/denied` | 不采样；评论不含正文 | M3 |
| plugin / error / ui | `plugin/loaded`、`plugin/failed`、`plugin/incompatible`；`error/raised`；`ui/theme-changed` | 不采样 | M1 / M2 |

**遥测专用**（没有对应的 A 类事件，由发布方直接 `telemetry.event`）：

| 事件 | 前端发布方 | 采样 | 里程碑 |
|---|---|---|---|
| `session/started`、`session/ended` | kernel `host.ts`（宿主创建；宿主销毁或页面隐藏 ≥ 30 s） | 不采样 | M1 |
| `render/page-rendered` | engine-render `render.service.ts` | 10% | M1 |
| `perf/frame` | engine-render `render.service.ts`，由 `render/frame` 派生（见下） | 1%，只取交互期间的帧 | M2 |
| `perf/input-latency` | render-dom 文本输入宿主（按键到绘制） | 5% | M2 |
| `perf/memory`、`perf/long-task` | render-dom 性能观察器（API 不可用时不发） | 会话结束与每 5 min；long-task 受事件量预算约束 | M1 |
| `history/undo`、`history/redo` | model-core `history.service.ts` | 不采样 | M2 |
| `search/performed` | slide-ui 查找替换（不含查询词） | 不采样 | M2 |
| `clipboard/pasted` | ui-core 剪贴板管线 | 不采样 | M2 |
| `collab/latency{rttMs, applyMs}` | collab-yjs（50/07 §14） | 1%（PRD 06 高频事件默认，可配置） | M2 |
| `presence/follow` | ui-react 在场跟随 | 不采样 | M3 |
| `comment/orphaned` | `comments` 包 | 不采样 | M3 |
| `history/version-created`、`history/version-restored`、`history/version-previewed` | 版本历史 UI（50/08） | 不采样 | M3 |
| `plugin/pending` | kernel 诊断（PENDING 超过 5 s） | 不采样 | M2 |
| `ui/panel-toggled`、`ui/ribbon-tab-changed`、`ui/shortcut-used` | ui-core | 不采样 | M2 |
| `i18n/missing-key` | i18n 服务（每个 key 每会话一次） | 不采样 | M2 |
| `unit/save-failed` | model-core `units.service.ts` | 不采样 | M2 |
| `a11y/screen-reader-detected` | ui-react（启发式，可关闭） | 不采样 | M2 |
| `quota/exceeded` | kernel `telemetry` 服务，由 `error/raised` 的四个配额码（三个 `quota_exceeded` 与 `collab.room_full`）派生 | 不采样 | M3 |

- **`perf/frame` 的 `interaction`**：engine-render 不认识 UI 交互。ui-core 的拖拽与键入管线在交互开始与持续期间调用 render 服务的 `noteInteraction(kind)`，Viewport 在缩放与滚动时自行标记；只有距最近一次标记 ≤ 250 ms 的帧才进入 1% 抽样，`interaction` 取该标记（`drag` / `zoom` / `scroll` / `type`）。该方法登记在 [50/05](./05-rendering-and-thumbnails.md) 的 RenderService 契约（待回写）。
- **批量与预算**：客户端缓冲 ≤ 5 s 或 ≤ 50 条批量交给 sink；页面隐藏时用 `fetch` keepalive 补发；采样后每会话·小时 ≤ 500 条，超出时先丢采样类事件并计数（PRD 06 §5）。
- **隐私初筛**：登记表的属性名不得出现 `text`、`title`、`name`、`content`、`url`、`email`（PRD 06 §5），作为扫描器 `scan-telemetry-events` 的新增子规则（不新增扫描器，待回写 09-type-discipline/06 §10）。
- **apps/web 的产品事件出口**：产品遥测开启时，apps/web 的 sink 把每个事件编码为 OTLP traces 中的零时长 span（span 名为 `product.<事件名>`，带标记属性 `cordex.product_event = true`，其余属性为载荷与公共属性，60/18 §9.2），经同一个 otlp 代理进入 Collector；不新增端点。Collector 按标记属性经 spanmetrics connector 把这类 span 转为 Prometheus 计数与时延直方图，不进入 trace 存储，路由以 [60/18](../60-backend/18-observability-and-ops-endpoints.md) §9.2 为准。集成方使用自己的 `telemetry.sink` 时不受此约束（PRD 06 §5「与 telemetry.sink 契约」）。
- **指标口径**：WSES、MT-01…MT-24 的计算以 PRD 06 为准；本文只保证上表事件按其属性与采样发出。

## 9. 同意与默认

依据：TELEMETRY-DEFAULT（30/10 §5 错误上报默认开；PRD NF-11 / PD-10 产品遥测默认关；二者分属两类，不冲突）；rulings §4.12 U-16（开发者菜单 gating）。

| 数据 | SDK 出厂 | apps/web 默认 | 用户开关 | 去向 |
|---|---|---|---|---|
| 客户端错误上报（`errors.report` → `server-api` sink） | 不出网络：`createHost` 默认自带 console `errors.sink`，`defaultSinks:false` 时为 no-op（40/02 §4） | **开**（需已登录） | `diagnostics.errorReports` | 部署方自己的服务端（60/18）；不含文档内容、身份去标识 |
| 产品遥测（`telemetry.event`，含 `perf/*`） | no-op | **关** | `diagnostics.productTelemetry`（用户主动开启） | 部署方自己的服务端 |
| 浏览器 span 导出 | no-op | 随 `diagnostics.productTelemetry` | 同上 | 同上 |
| `traceparent` 生成与传播 | 由集成方决定 | 始终 | 无（不含身份与内容，只进部署方服务端） | 部署方服务端 |
| 控制台日志 | 仅开发构建 | 仅开发构建 | 无 | 本机 |

- **两级开关**：部署级是 RuntimeConfig 静态项 `telemetry`（字段表在 50/02 §3）：`errorReportsDefault`、`productTelemetryDefault` 是两个用户开关在用户未作选择时的默认值，`otlp` 决定是否启用 `/telemetry/otlp` 出口（该端点 M3）。用户级是 `Preferences.diagnostics.errorReports` 与 `Preferences.diagnostics.productTelemetry`，存于 `cordex.prefs`（键空间见 50/02 §10）。生效值：错误上报 = 用户开关；产品遥测与浏览器 span 导出 = `otlp` ∧ 用户开关；`otlp:false` 时设置抽屉不显示产品遥测开关（界面见 50/10 §10）。
- **即时生效**：关闭任一开关后立即清空对应队列、卸载对应 sink；开启只影响此后产生的数据。
- **集成方**（形态 A–E）：SDK 出厂不向任何网络端点发送数据（`telemetry.sink` 为 no-op，`errors.sink` 只写控制台），集成方经 `telemetry.sink` / `errors.sink` 贡献自己的出口并负责用户告知（PRD NF-11）。

## 10. 诊断

依据：30/10 §4；PRD 05 EM-12（`diagnostics.dump()`）；rulings §4.12 U-16。服务端诊断端点（`/internal/diagnostics/*`，内部端口、运维令牌）归 60/18 §8，浏览器不访问。

| 能力 | 入口 | 数据来源 | 备注 |
|---|---|---|---|
| 开发者面板 | `ui.panel` 贡献 `cordex.devtools`，由 ui-react 承载；惰性 chunk，不进首屏预算（50/13） | 下列各页 | 显示条件：`import.meta.env.DEV` 或 `RuntimeConfig.features.developerMenu`（二者取或，U-16）；`?cordex-devtools=1` 只在开发构建生效 |
| Fiber 页 | 面板 | `dumpFiberTree(ctx)` | 名称、uid、状态、子树 |
| effects 页 | 面板 | `fiber.getEffects()` 聚合 | 卸载后应为空（`assertNoLiveEffects`） |
| PENDING 检视 | 面板；进入 PENDING 500 ms 后提示 | `listPending(ctx)` | 缺失的服务名 |
| 贡献页 | 面板 | `listContributionPoints(ctx)` 与 Manifest 对比 | 差异高亮 |
| 协同页 | 面板 | 会话 `stats`、`yjsBackend.stats()` | 状态、pending、state vector 摘要、最近帧类型与大小（不含内容） |
| 渲染页 | 面板 | `ctx.render.stats()` | 帧时长直方、脏区计数、缓存命中、已挂载页 |
| 诊断包 | `diagnostics.dump()`；`AppErrorBoundary` 的「复制诊断信息」 | Fiber 树、插件清单与版本、最近 200 条事件的名称与非内容属性、性能标记 | 不含文档内容与令牌；以 JSON 复制到剪贴板，超过 256 KiB 时截断最旧事件 |
| e2e 诊断通道 | RuntimeConfig 开关 `diagnostics.e2eTrace`（字段表在 50/02 §3，默认 `false`） | 为真时 telemetry Provider 写 `performance.mark` 事件轨迹（命名见 50/13 §2.2），`diagnostics.dump()` 在无开发者菜单时也可调用 | 只读；只在 dev 构建与测试部署（e2e 预览服务器、测试 compose 栈）生效，生产部署配置的 schema 拒绝其为真（与 `auth.mode:'none'` 同类约束，部署侧登记在 60/17 §5）；供 70/06 §3.5 的内部状态断言使用 |

## 11. 机械验证与里程碑

本节只写断言；测试层级、夹具与阈值判定归 70，CI 步骤名以 [70/12](../70-testing/12-ci-gates-mapping.md) 为准。

| # | 断言 | 执行（70 文件 · CI 步骤） |
|---|---|---|
| V1 | 每个 `ctx.emit` / `ctx.on` 的事件名都在 `Events` 中声明，域在保留域清单内或带 `<vendor>:` 前缀 | lint `cordex/events-must-be-declared` · `lint` |
| V2 | 每个 `telemetry.event` 的事件名在登记表中，且登记的事件至少有一个发出点；属性名不含黑名单词 | lint `cordex/telemetry-events-must-be-declared` + 扫描器 `scan-telemetry-events` · `scanners` |
| V3 | 错误码、span、指标名都已登记且有消费者 | 扫描器 `scan-observability-identifiers` · `scanners` |
| V4 | 包内无 `console.*`、无裸 `Error` | `no-console`、`no-restricted-syntax` · `lint` |
| V5 | `user:true` 的错误码在 zh-CN 与 en-US 中都有 `errors.<code>.title` 与 `.action` | 扫描器 `scan-contributions` 规则 (f) 子规则 · `scanners` |
| V6 | 无 sink 时 `telemetry` / `errors` 为 no-op 且不订阅镜像事件；sink 抛错不传播；两个 sink 都收到 | kernel `sinks.test.ts` · `test/unit` |
| V7 | 去重与采样：同 fingerprint 60 s 内只交给 sink 一次；`warning` 采样 10%（FixedClock、SeededRandom，[70/11](../70-testing/11-test-data-fixtures-and-determinism.md)） | `test/unit` |
| V8 | 顺序：同一 Unit 内 `store/transaction` 先于 `command/executed`；公开订阅对 `store/transaction`、`render/frame` 的 50 ms 尾沿节流只投递最后一条且载荷不变 | `test/unit`、`test/contract` |
| V9 | 上报管线：401 丢弃且不重试、会话恢复后继续；413 拆半一次；页面隐藏时发出 keepalive 请求且带 `X-Cordex-Request`；单条与单批体积上限 | `test/unit`（msw） |
| V10 | 脱敏：上报载荷与 breadcrumbs 不含文档内容字段、邮箱明文、分享令牌、query 与 fragment | `test/unit`；70/10 SEC-CL-04 · `e2e/full-compose` |
| V11 | 默认值：apps/web 登录后产生错误时只有 `/api/v1/telemetry/errors` 请求；产品遥测关闭时对 `/api/v1/telemetry/otlp` 的请求数为 0；登录前不发任何上报请求 | 70/10 SEC-CL-06、70/06 §10.3 · `e2e/full-compose` |
| V12 | 错误边界隔离：注入抛错插件、抛错贡献项、抛错元素渲染器后，其余功能可用，UI 按设计 06 §3 降级 | 70/06 §2 · `test/unit`、`e2e/full-compose` |
| V13 | trace 贯穿：一次「打开 → 加入房间 → 编辑」中，HTTP 头与 Auth 帧 token 的 `traceparent` 属于同一 trace；错误报告带该 trace id | 70/07 · `test/server-integration` |

**里程碑**

| 里程碑 | 交付 |
|---|---|
| M1 | kernel `errors` / `telemetry` / `logger` 三服务与 no-op sink；A 类事件 unit / render / layout / plugin / error 域；错误码目录生成；元素级与 Fiber 级错误边界；V1–V8 阻断 |
| M2 | apps/web：宿主事件桥与节流、`AppErrorBoundary` 与页面边界、贡献项逐项边界；错误码文案与 V5；客户端错误上报管线对接 `POST /telemetry/errors`（该端点 M2，60/15 §3.14）；`traceparent` 生成与 HTTP 传播；CSP 报告端点对接（50/14 §4.5）；开发者面板与 `diagnostics.dump()`、e2e 诊断开关 `diagnostics.e2eTrace`（§10）；协同会话域事件（§2 collab 行）、`collab/latency` 遥测与 `cordex_collab_outbound_queued` 指标，Auth 帧 token 携带 `traceparent`（服务端文档自 M2 起经协同网关持久化，rulings §4.19 D-M2-CONTENT）；产品事件登记表覆盖 PRD 06 的 M1–M2 行；V9–V13 阻断 |
| M3 | `POST /telemetry/otlp` 上线（60/15 §3.14）后开放可选的浏览器 span 导出与产品事件出口；多人协同体验层的事件与遥测（`collab/soft-conflict`、`presence/*`）；评论、权限域事件与遥测 |
| M4 | 插件事件与遥测的第三方前缀规则进入插件模板；形态 E 跨站场景的事件转发随 `cordex:token` |

**待回写（由总编排执行）**

1. 30/10 §3.2、§3.3 的客户端条目改为引用本文 §7.1、§7.2；§3.4 改为引用本文 §8 与 PRD 06；§5 管线部分改为引用本文 §6（端点部分引用 60/18）。
2. 30/10 §5 与 PRD 06 §5 的「sendBeacon」改为「`fetch` keepalive」（CSRF 请求头，50/14 §8）。
3. 09-type-discipline/02 §4.15 与 06 §10 规则 (c) 仍写遥测事件名为 snake_case `<域>_<动作>`，与 PRD 06、ADR-0011 决策 6、INC-33 的 `<域>/<动作>` 冲突，需改为 `<域>/<动作>`；同处调用写法 `ctx.telemetry.track` 统一为 30/10 §3.1 的 `telemetry.event`。
4. 50/05 登记 `RenderService.noteInteraction(kind)`；40/06 §2.4 `perf/frame` 行的派生说明改引本文 §8。
5. 09-type-discipline/06 §10 登记属性名黑名单子规则（产品事件的 Collector 路由已以 60/18 §9.2 为准，§8）。
6. 40/02 §4.4 登记 `@cordexjs/i18n` 自带 protocol 错误码文案（`errors.server.*`、`errors.transport.*` 等命名空间）；i18n 的依赖上限只有 kernel（章程 §5.2），文案以 JSON 按码名键入、不 import protocol，码表一致性由 `scan-contributions` 规则 (f) 的子规则核对。
