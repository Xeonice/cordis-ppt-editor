> 状态：草稿 | 负责：产品 | 更新：2026-09-15；2026-09-24（rulings §4.15：T-0 去租户——公共属性删 `tenantId`、配额错误码去 `tenant.` 域；Q3 撤销跳过与「恢复我的值」计数；Q5 `doc.elements` 分桶含墓碑）；2026-09-24（rulings §4.16 Q15：MT-01 拒绝率含 `format.macro_rejected`）；2026-09-24（复核修正，rulings §4.17） | 依赖：charter v0.2；rulings §4.15、§4.16

# 06 指标与埋点

> 指标编号前缀 `MT-`。埋点对应章程 L0 的 `telemetry` 服务（D11）；事件命名遵循 `<域>/<动作>`；遥测事件**镜像**运行时事件（EM-05）并追加度量属性，不另起一套命名（规避 Univer A8 的多套事件机制）。遥测默认 no-op（PD-10），集成方通过 `telemetry.sink` Provider 接入自家管道；本文定义**我们希望集成方能采集到什么**以及**我们自己的参考应用采集什么**。

---

## 0. 原则

1. **不采集内容**：文档文本、图片、评论正文、文件名一律不进遥测；只采集结构性度量（数量、时长、类型、错误码）。用户/文档标识使用不透明 id（OIDC 主体或集成方传入），并在 SDK 内再做一次单向哈希（可关闭）。
2. **事件即契约**：每个遥测事件有 schema（Standard Schema）、版本、隐私分级；schema 变更走 Changesets；未声明的事件被扫描器拒绝。
3. **能被回答的问题才埋**：每个事件至少服务于一个指标（§1/§2）或一个告警（SV-10）。
4. **采样可配**：高频事件（`render/frame`、`collab/latency`）默认采样 1%；错误与生命周期事件不采样。

---

## 1. 北极星与一级指标

### 1.1 北极星：周成功编辑会话数（WSES，Weekly Successful Editing Sessions）

- 定义：单周内满足以下全部条件的会话数：`unit/opened` 成功 → ≥ 1 个 `store/transaction`（来源 = 本地）→ 会话内无 `error/raised{severity:"fatal"}` → 会话结束前有 `unit/saved` 或（协同）`collab/synced` 且待同步 = 0。
- 为什么：它同时要求「打得开」「能编辑」「不崩」「不丢」，是 SDK 价值链的完整闭环；比 DAU 更能反映产品是否真的被用来干活。
- 里程碑：M2 起可计算（单人）；M3 起含协同会话。
- 配套（查看器场景）：周成功查看会话数（WSVS）= `unit/opened` 成功 + 停留 ≥ 10 s + 无 fatal。

### 1.2 一级指标（MT-01 … MT-08）

| 编号 | 指标 | 定义 | 目标（初始） | 里程碑 |
|---|---|---|---|---|
| MT-01 | 打开成功率 | `unit/opened` / (`unit/opened` + `unit/open-failed`)，排除 `format.unsupported_binary`、`format.encrypted`、`format.macro_rejected`（单列为「拒绝率」） | ≥ 99.5% | M1 |
| MT-02 | 保真指数 | 每会话降级元素数 / 总元素数 的加权平均（`render/element-degraded` + `render/element-failed` + `render/font-fallback`） | ≤ 2%（T2 语料对照 ≤ 3%） | M1 |
| MT-03 | 首屏时间 TTFS | `open()` → `render/first-paint`，按文稿规模分桶（≤ 20 页 / 21–50 / 51–200） | p75：≤ 1.0 s / ≤ 1.5 s / ≤ 3.0 s | M1 |
| MT-04 | 崩溃自由会话率 | 无 `error/raised{fatal}` 的会话占比 | ≥ 99.5% | M2 |
| MT-05 | 编辑转化率 | 有 ≥ 1 个本地 `store/transaction` 的会话 / 可编辑会话（有 `doc.write`） | 基线观察，M3 设目标 | M2 |
| MT-06 | 同步健康率 | 协同会话中 `collab/synced` 后从未进入 `offline` 且软冲突 ≤ 2 的占比 | ≥ 95% | M3 |
| MT-07 | 导出成功率 | `export/completed` / (`completed` + `failed`) | ≥ 99.5% | M2 |
| MT-08 | 集成与插件采用 | 活跃集成方数（按 `sdk.integratorId`）、活跃第三方插件数（按 `plugin/loaded` 去重的非官方插件 id） | M4 设目标 | M4 |

---

## 2. 健康指标（MT-10 … MT-24）

| 编号 | 指标 | 数据源 | 阈值 / 用途 |
|---|---|---|---|
| MT-10 | 键入延迟 p95 | `perf/input-latency`（采样） | ≤ 50 ms；超出触发性能调查 |
| MT-11 | 交互帧率 | `perf/frame`（采样，拖动/缩放期间） | p95 帧 ≤ 33 ms |
| MT-12 | 命令失败率 | `command/failed` / `command/executed` | ≤ 0.1% |
| MT-13 | 命令拒绝（权限）率 | `command/rejected{reason:"permission"}` | 观察 UI 是否正确禁用（应接近 0） |
| MT-14 | 撤销使用率 | `command/executed{id:"history.undo"}` / 全部命令 | 体验信号：> 15% 提示误操作多 |
| MT-15 | 软冲突率 | `collab/soft-conflict` / 协同会话·小时（服务端指标 `cordex_collab_soft_conflicts_total{type}`）；撤销被跳过 `store/undo-skipped` 单独统计、不计入（rulings §4.17 D5） | ≤ 0.5 次/会话·小时 |
| MT-16 | 重连率与离线时长 | `collab/reconnect`、`collab/state-changed` 时长 | 网络质量诊断 |
| MT-17 | 同步延迟 p95 | `collab/latency`（采样） | ≤ 400 ms |
| MT-18 | 评论使用 | `comment/added`、`comment/resolved`、解决时长 | 协作深度 |
| MT-19 | 插件失败率 | `plugin/failed` / `plugin/loaded` | ≤ 0.5%；按插件 id 排名 |
| MT-20 | 插件加载耗时 | `plugin/loaded{durationMs}` | p95 ≤ 200 ms |
| MT-21 | 内存峰值 | `perf/memory`（会话结束采样） | 与 NF-01 对照 |
| MT-22 | 功能使用分布 | `command/executed{id}` 计数 | 优先级校准；识别从未使用的功能 |
| MT-23 | 错误码 Top-N | `error/raised{code}` | 每周复盘 |
| MT-24 | 服务端 SLO | SV-10 指标 | 可用性 99.9%、广播 p95 ≤ 100 ms、导入/导出成功率 ≥ 99.5% |

---

## 3. 埋点事件清单

### 3.1 公共属性（每个事件自动附带）

| 属性 | 说明 | 隐私级 |
|---|---|---|
| `ts` | 事件时间（客户端单调时钟 + 会话起点） | P0 |
| `sessionId` | 会话随机 id（每次宿主创建） | P0 |
| `unitId` | `Unit` 哈希（可关闭） | P1 |
| `deploymentId` / `integratorId` | 部署或集成方传入的不透明 id（单组织，无租户维度，rulings §4.15 T-0） | P1 |
| `userId` | 用户 id（OIDC `(issuer, sub)` 或集成方传入）的哈希（可关闭） | P1 |
| `sdk.version` / `preset` / `pluginsHash` | 版本、preset 名、已加载插件 id 集合哈希 | P0 |
| `env.browser` / `env.os` / `env.viewport` / `env.dpr` / `env.hardwareConcurrency` / `env.deviceMemory` | 环境 | P0 |
| `doc.pages` / `doc.elements` / `doc.sizeBucket` / `doc.producer` | 文稿规模分桶与生产者（`app.xml` Application，不含标题）；`doc.elements` 为文档总元素（含墓碑），分桶边界对齐 Q5 包络与天花板（6,000 / 15,000 / 20,000） | P0 |
| `mode` | `viewer` / `editor` / `collab` / `headless` | P0 |

隐私级：P0 = 无任何标识；P1 = 伪匿名标识；P2 = 内容 —— **禁止**。

### 3.2 事件表

> 列「触发」为触发条件；「属性」为除公共属性外的载荷；「里程碑」为事件首次存在的里程碑；「服务」为对应的指标/告警。运行时事件名以裁决记录 §5 与架构 10 §11.1 定稿表为准；标「遥测专用」者只存在于遥测登记表。

| 事件 | 触发 | 属性 | 隐私 | 里程碑 | 服务 |
|---|---|---|---|---|---|
| `session/started` | 宿主创建 | `entry`（集成入口形态 A–F） | P0 | M1 | 会话计数 |
| `session/ended` | 宿主销毁 / 页面隐藏 ≥ 30 s | `durationMs`, `transactions`, `fatal` | P0 | M1 | WSES、MT-04 |
| `unit/opened` | 打开成功 | `durationMs`, `source`（buffer/url/stream/snapshot）, `conformance`, `contentType`, `pagesParsed`, `lazy` | P0 | M1 | MT-01、MT-03 |
| `unit/open-progress` | 阶段变化（仅采样 10%） | `stage`, `percent`, `elapsedMs` | P0 | M1 | 打开漏斗 |
| `unit/open-failed` | 打开失败 | `code`, `stage`, `durationMs` | P0 | M1 | MT-01、MT-23 |
| `unit/closed` | 关闭 | `durationMs`, `dirtyAtClose` | P0 | M1 | |
| `unit/dirty-changed` | dirty 切换 | `dirty` | P0 | M2 | |
| `unit/saved` | 保存回调成功 / 快照落盘 | `kind`（pptx/snapshot/collab）, `durationMs`, `bytes` | P0 | M2 | WSES |
| `unit/save-failed` | 保存失败 | `code`, `retryable` | P0 | M2 | MT-23 |
| `unit/migrated` | 快照迁移 | `fromVersion`, `toVersion`, `durationMs` | P0 | M2 | 迁移健康 |
| `render/first-paint` | 首页可见 | `elapsedMs`, `page`, `elements` | P0 | M1 | MT-03 |
| `render/page-rendered` | 任一页首次渲染（采样 10%） | `page`, `durationMs`, `elements` | P0 | M1 | 性能 |
| `render/element-degraded` | 降级渲染 | `kind`, `reason`（emf-no-preview / 3d-flattened / effect-approx / smartart-no-dsp / math-fallback / unsupported-media …） | P0 | M1 | MT-02 |
| `render/element-failed` | 渲染抛错 | `kind`, `code` | P0 | M1 | MT-02、MT-23 |
| `render/font-fallback` | 字体回退 | `requestedFont`（字体名不视为内容）, `fallbackFont`, `scope`（latin/ea/cs/sym） | P0 | M1 | MT-02 |
| `perf/frame` | 交互期间帧时间（采样 1%；**派生自 cordis 事件 `render/frame`**，帧级数据只走遥测） | `frameMs`, `interaction`（drag/zoom/scroll/type） | P0 | M2 | MT-11 |
| `perf/input-latency` | 键入到绘制（采样 5%） | `latencyMs`, `ime` | P0 | M2 | MT-10 |
| `perf/memory` | 会话结束 / 每 5 min（采样） | `heapUsedMB`, `pages`, `elements` | P0 | M1 | MT-21 |
| `perf/long-task` | 主线程任务 > 50 ms | `durationMs`, `phase` | P0 | M1 | 性能 |
| `command/executed` | 命令成功 | `id`, `durationMs`, `elementsAffected`, `source`（ui/shortcut/api/plugin/palette） | P0 | M2 | MT-12、MT-14、MT-22 |
| `command/rejected` | 命令被管线拒绝 | `id`, `reason`（permission/validation/selection/readonly） | P0 | M2 | MT-13 |
| `command/failed` | 命令抛错回滚 | `id`, `code` | P0 | M2 | MT-12、MT-23 |
| `store/transaction` | 事务提交（高频合并 ≥ 50 ms） | `origin.kind`（local / remote / system / replay）, `origin.via`（undo / redo）, `origin.reason`（load / import / migration / repair / restore）, `mutations`, `count` | P0 | M2 | WSES、MT-05 |
| `history/undo` / `history/redo` | 撤销/重做（遥测专用；运行时事件为 `history/changed`） | `steps`, `skipped`（整步被跳过的步数，停下不连撤）, `keysSkipped`（因他人后写被跳过的键数，rulings §4.15 Q3） | P0 | M2 | MT-14 |
| `selection/changed` | 选区变化（采样 10%） | `kinds`（元素类型集合）, `count` | P0 | M2 | 功能使用 |
| `view/page-changed` | 翻页 | `from`, `to`, `method`（click/key/thumb/link/follow） | P0 | M1 | 导航行为 |
| `view/zoom-changed` | 缩放 | `zoom`, `method` | P0 | M2 | |
| `view/mode-changed` | 编辑 ↔ 放映 ↔ 母版视图 | `mode`, `durationMsInPrev` | P0 | M2 | 放映使用 |
| `export/started` / `export/completed` / `export/failed` | 导出 | `format`, `pages`, `durationMs`, `bytes`, `code`, `side`（client/server） | P0 | M2 | MT-07 |
| `search/performed` | 查找 | `resultCount`, `durationMs`（不含查询词） | P0 | M2 | 功能使用 |
| `clipboard/pasted` | 粘贴 | `mime`（internal/image/html/text）, `elements` | P0 | M2 | 功能使用 |
| `collab/state-changed` | 会话状态机迁移 | `from`, `to`, `reason`, `durationMsInPrev` | P0 | M3 | MT-06、MT-16 |
| `collab/synced` | 初始/重连同步完成 | `durationMs`, `updatesApplied`, `initial` | P0 | M3 | 初始同步时长 |
| `collab/latency` | 往返延迟（采样 1%） | `rttMs`, `applyMs` | P0 | M3 | MT-17 |
| `collab/soft-conflict` | 软冲突检测 | `type`（text-same-pos/prop-lww/delete-vs-edit/reorder）, `resolvedBy`（auto/restore-my-value/restore-element） | P0 | M3 | MT-15 |
| `store/undo-skipped` | 协同撤销被跳过（rulings §4.17 D5：**单独统计，不是 `collab/soft-conflict` 的 type，不计入软冲突率 MT-15**） | `skipped`（本次被跳过的键数）, `wholeStep`（整步被跳过、停下不连撤）；遥测只统计跳过次数与整步跳过次数，不含路径内容 | P0 | M3 | MT-14 旁注、撤销体验 |
| `collab/reconnect` | 重连尝试 | `attempt`, `backoffMs`, `success`, `queued` | P0 | M3 | MT-16 |
| `collab/auth-failed` | 握手失败 | `code` ∈ collab.unauthenticated / forbidden / doc_not_found / schema_too_new / protocol_mismatch / room_full；`protocol_mismatch` 时附 `client`, `server` 版本 | P0 | M3 | 安全告警、升级健康 |
| `collab/update-rejected` | 服务端硬门禁拒绝本地 update（降权/锁定窗口） | `reason`, `rejectedTransactions` | P0 | M3 | 权限即时性、体验信号 |
| `collab/repair` | 服务端软门禁修复触及本地 | `rule`, `paths`（路径数） | P0 | M3 | 数据完整性（`cordex_collab_repairs_total{rule}`） |
| `presence/joined` / `presence/left` | 协作者进出 | `participants`（当前人数） | P0 | M3 | 协作规模 |
| `presence/follow` | 跟随开始/结束 | `durationMs` | P0 | M3 | 功能使用 |
| `comment/added` / `comment/replied` / `comment/resolved` / `comment/reopened` / `comment/deleted` | 评论操作 | `anchorKind`（page/element/text）, `threadDepth`, `hasMention`（不含正文） | P0 | M3 | MT-18 |
| `comment/orphaned` | 锚点元素被删 | `anchorKind` | P0 | M3 | 体验信号 |
| `history/version-created` / `history/version-restored` / `history/version-previewed` | 版本历史 | `kind`（auto/named）, `ageMs` | P0 | M3 | 功能使用 |
| `permission/changed` | 能力位变化 | `added`, `removed`, `propagationMs` | P0 | M3 | CO-05 ≤ 2 s |
| `permission/denied` | 服务端拒绝 | `capability`, `surface`（rest/ws） | P0 | M3 | 安全告警 |
| `plugin/loaded` | 插件 ACTIVE | `pluginId`, `version`, `official`, `durationMs`, `contributions` | P0 | M2 | MT-08、MT-20 |
| `plugin/failed` | 插件 FAILED | `pluginId`, `version`, `code`, `phase`（config/apply/runtime） | P0 | M2 | MT-19 |
| `plugin/incompatible` | 版本协商失败 | `pluginId`, `required`, `actual` | P0 | M2 | 升级健康 |
| `plugin/pending` | 进入 PENDING 超过 5 s | `pluginId`, `missing`（服务名） | P0 | M2 | 诊断 |
| `ui/panel-toggled` | 面板开关 | `panelId`, `open` | P0 | M2 | 功能使用 |
| `ui/ribbon-tab-changed` | 页签切换 | `tabId` | P0 | M2 | 功能使用 |
| `ui/shortcut-used` | 快捷键触发 | `commandId`, `scope` | P0 | M2 | 功能使用 |
| `ui/theme-changed` | 主题/密度切换 | `theme`, `density` | P0 | M2 | |
| `i18n/missing-key` | 缺 key | `key`, `locale` | P0 | M2 | 质量 |
| `error/raised` | 任一类型化错误 | `code`, `severity`, `retryable`, `surface`, `pluginId?` | P0 | M1 | MT-04、MT-23 |
| `a11y/screen-reader-detected` | 检测到辅助技术（启发式，可关闭） | `hint` | P0 | M2 | a11y 使用 |
| `quota/exceeded` | 配额拒绝（遥测专用；派生自 `error/raised{code: format.quota_exceeded | document.quota_exceeded | storage.quota_exceeded | collab.room_full}`；`dimension` 取值照抄架构 10 §3 取值表：`slides` / `elementsPerSlide` / `elementsTotal` / `fileSize`，存储为 `bytes` / `documents`） | `code`, `dimension`, `limit` | P0 | M3 | SV-08 |

服务端事件（Prometheus/OTel 指标为主，见 SV-10）；审计事件（SV-07）**不是**遥测，不进本表。

---

## 4. 漏斗与仪表盘

### 4.1 打开漏斗（M1）

```
 session/started ──► unit/open-progress(unzip) ──► (parse-presentation) ──► (parse-slide) ──► render/first-paint ──► 停留 ≥ 10 s
      100%                 ≥ 99.9%                      ≥ 99.8%                 ≥ 99.7%              ≥ 99.5%（MT-01）        观察
```

### 4.2 编辑漏斗（M2）

```
 unit/opened(editor) ──► selection/changed ──► command/executed(首个) ──► store/transaction ≥ 5 ──► unit/saved
       100%                  观察                  MT-05                      深度编辑率                  WSES
```

### 4.3 协同漏斗（M3）

```
 collab/state-changed(connecting) ──► synced ──► 首个远端事务可见 ──► 会话内无 offline ──► 待同步=0 结束
            100%                       ≥ 99%           观察                  MT-06                 WSES
```

### 4.4 仪表盘（参考应用与内部）

| 仪表盘 | 受众 | 内容 |
|---|---|---|
| 产品总览 | 产品/管理 | WSES、WSVS、MT-01…08 趋势、功能使用 Top-20 |
| 保真 | 产品/架构 | MT-02 分 `kind`/`reason`、字体回退 Top-20、按生产者分布 |
| 性能 | 架构 | MT-03/10/11/21 分桶与 p50/p75/p95、long-task 分布 |
| 协同 | 架构/运维 | MT-06/15/16/17、房间规模分布、重连原因 |
| 插件 | SDK 团队 | MT-08/19/20、PENDING 缺失服务 Top、incompatible 版本对 |
| 服务端 | 运维 | SV-10 指标与告警 |

---

## 5. 实施要求

| 要求 | 口径 | 里程碑 |
|---|---|---|
| 事件 schema 注册表 | 每个事件在 `telemetry` 的 schema 表中声明（名称、版本、属性 schema、隐私级、采样率）；扫描器拒绝未注册事件 | M1 |
| 隐私审查 | 新事件/属性合入前经隐私检查清单（无内容、无明文标识）；CI 用属性名黑名单（`text`、`title`、`name`、`content`、`url`、`email`）初筛 | M1 |
| 默认 no-op | SDK 出厂不发送任何遥测；参考应用 `apps/web` 以显式配置开启 | M1 |
| 采样与批量 | 客户端本地缓冲 ≤ 5 s 或 ≤ 50 事件批量发送；页面隐藏时 `sendBeacon` | M2 |
| 与 telemetry.sink 契约 | 事件对象 + 公共属性 → Provider；提供 OTel 示例（PS-04） | M2 |
| 指标计算文档 | 每个 MT 指标的 SQL/查询定义随参考应用发布 | M3 |
| 事件量预算 | 每会话·小时 ≤ 500 事件（采样后）；超出告警 | M2 |
