> 状态：草稿 | 负责：产品 | 更新：2026-09-17；2026-09-24（rulings §4.15：T-0 去租户；Q6 EM-03 改 OIDC（JWT/API Key 降 M4）、EM-10 单组织 + 文档级 RLS；Q2 形态 A/B 口径与 CSP/Trusted Types 路径；Q4/Q7 EM-14 客户端安全基线与 `externalResources`；Q10 EM-04 SeaweedFS）；2026-09-24（rulings §4.16 Q12：许可证已裁决 Apache-2.0）；2026-09-24（复核修正，rulings §4.17） | 依赖：charter v0.2；rulings §4.15、§4.16

# 功能域 05：嵌入与集成（面向集成方）

> 需求编号前缀 `EM-`。集成方 = 把 SDK 嵌入自家产品的工程团队（前端 + 后端）。本文件定义「把编辑器放进自己的产品」需要的一切：嵌入方式、鉴权、存储、事件、主题、按需加载、升级。服务端部署与运维见 `06-server-and-ops.md`；插件开发见 `04-plugin-sdk.md`。

---

## 0. 本域的产品立场

1. **SDK 优先**（章程关键词一）：交付的是 `Preset` + 插件 + 内核，`apps/web` 只是组装样例。集成方不应该需要复制 `apps/web` 的任何代码才能嵌入。
2. **身份由外置 OIDC IdP 拥有（服务端不持有密码），存储与业务由集成方/部署方拥有；SDK 拥有文档模型、编辑与协同**。边界上的一切通过 Definition/Provider（可替换）或回调（事件）交互，不通过全局变量或 DOM 约定。
3. **默认安全、默认离线（无外呼）、默认无遥测**：SDK 不主动联网（除集成方配置的协同端点与资源 URL，以及文档内 `http(s)` 外链资源——后者默认自动加载，部署配置 `externalResources` 可收紧为 `confirm`/`never`，见 EM-14），遥测默认 no-op（PD-10）。
4. **按需加载是产品承诺**（规避 Univer A33）：只看不编辑的场景不该为编辑器、协同、图表付出体积。

---

## 1. 嵌入形态一览

```
 形态                      包                          适用                      里程碑
 ───────────────────────── ─────────────────────────── ───────────────────────── ──────
 A. React 组件 <EditorHost>  @cordexjs/ui-react + preset-*    React ^19 宿主（React 18 走 B/E）M2
 B. 框架无关挂载函数         @cordexjs/ui-core + render-dom    Vue/Angular/Svelte/原生     M2（宿主自绘 UI，不带 React）
 C. 只读查看器               preset-slide-viewer          文档预览、评论查看          M1
 D. Headless（浏览器/Node）   kernel + model-* + ooxml-*   批处理、校验、模板填充      M1（Node：M3 server-headless）
 E. iframe 嵌入 apps/web      apps/web 部署              最快 PoC、强隔离            M3（P2）
 F. Web Component 包装        @cordexjs/ui-webc（未来）        无框架、跨团队              M4+（P2）
```

- 形态 B（rulings §4.15 Q2）：宿主自绘 UI，只消费 `ui-core` 贡献点的声明式部分；装配时排除 `ui-react` 与 `slide-ui`（`FRAMEWORK_FREE_EXCLUDES`），因此不带入 React/Radix。M2 只交付 React 绑定（章程 D10）；B 的验收是「`ui-core` 与各 `*-ui` 的 domain/application 层不 import React（depcruise 规则）+ `examples/embed-vanilla` 实现 `UiRenderer('vanilla')` 并通过 UI 渲染契约测试 + 产物中不含 react/radix 模块（bundle 断言）」。

---

## 2. 需求

### EM-01 嵌入与初始化

- 优先级：P0 | 目标里程碑：M2（M1 为查看器） | 依赖能力：`kernel.createHost`、`Preset`、`UnitScope`、`Plugin.Config`（Standard Schema）
- 用户故事：作为集成方前端工程师，我希望 ≤ 20 行代码把编辑器放进我的页面，并能在同一页放多个实例。
- 验收标准：
  - 「5 分钟快速开始」：安装一个 preset 包 + 一个 UI 绑定包，创建宿主、打开字节、挂载到容器；示例可复制运行。
  - 初始化配置经 Standard Schema 校验，错误在启动前抛出（不部分激活），错误信息含字段路径。
  - 同页 ≥ 4 个编辑器实例（各自 `Unit`）互不干扰：快捷键按焦点实例分派、样式不泄漏（CSS 作用域前缀或 Shadow DOM，P1）、事件按实例订阅。
  - 销毁：`dispose()` 后无残留 DOM、timer、WS、blob URL（`fiber.getEffects()` 为空）；20 次创建/销毁循环内存增长 ≤ 5%。
  - 容器尺寸变化（`ResizeObserver`）自动重排；最小可用尺寸 640 × 400 px，低于时进入紧凑模式（设计 03）。
  - SSR：SDK 包在服务端 import 不抛错（`dom` 包在无 DOM 环境下惰性初始化，P2）。

### EM-02 打开、保存与文档来源

- 优先级：P0 | 目标里程碑：M2 | 依赖能力：`FormatCodec`、`Unit`、`unit/*` 事件
- 验收标准：
  - 输入：`ArrayBuffer`/`Blob`/`File`/`ReadableStream`/URL（带自定义 `fetch` 与请求头回调）；输出：`exportPptx(): Promise<Blob>`、`exportSnapshot(): Snapshot`、`exportImage(pageIndex, options)`。
  - 保存策略由集成方选择：(a) 回调式——SDK 在 dirty + 触发条件（Mod+S / 自动保存 / 主动调用）时调用 `onSave(bytes | snapshot)`；(b) 协同式——由服务端快照负责，集成方不处理字节（CO-01）。
  - `Snapshot` 可作为「热保存」格式（比 pptx 导出快 ≥ 5 倍），带 `schemaVersion`，旧快照打开时自动迁移并上报 `unit/migrated`。
  - 打开进度、dirty 状态、保存结果均有事件（EM-05）。

### EM-03 鉴权与身份对接

- 优先级：P0 | 目标里程碑：M3（OIDC；单人模式 M2 仅需身份信息）/ M4（集成方签名 JWT、API Key） | 依赖能力：`protocol` 鉴权握手、`permissions`、`collab-transport-ws`
- 用户故事：作为集成方，我已有自己的登录体系（任意标准 OIDC IdP），我希望服务端直接信任它，不要求我迁移用户或让服务端保存密码。
- 验收标准（rulings §4.15 Q6）：
  - 客户端：集成方提供 `getToken(): Promise<string>` 回调（Ticket 60 s 单次；集成方签名 JWT ≤ 1 h（M4）。M3 只返回 OIDC 登录后换取的一方 Ticket；ADR-0029）与 `user: { id, displayName, avatarUrl?, color? }`；SDK 在握手与刷新时调用；不持久化令牌。
  - 服务端 M1–M3：`apps/server` Auth 模块**只认 OIDC**（可接任意 OIDC IdP；docker-compose 可选内置 **Casdoor**，国内 IM 登录经 Casdoor 代理）；服务端不持有密码与凭据；用户以 `(issuer, sub)` 标识，首次登录 JIT 建号。
  - 服务端 M4：新增「集成方签名 JWT」与「API Key」两种模式（JWKS 验签；首次出现的主体 JIT 建影子用户）；JWT claims 约定（草案）：`sub`、`doc`、`caps[]`（能力位）、`exp`（单组织，无租户声明）。
  - 权限来源：M3 为服务端文档权限（章程 D12，撤销 ≤ 2 s 通过推送实现，CO-05）；M4 起可配置为从 JWT claims 读或回调集成方权限服务（缓存 ≤ 60 s）。
  - 注册策略为部署级开关 `auth.selfSignup`（默认关：管理员在 IdP 建号；文档分享邀请只对已存在账号生效，rulings §4.17 D1）；分享链接始终要求登录（CO-15）。
  - 单人模式（无服务端）：集成方直接传入能力位；SDK 客户端管线据此 fail-closed。
  - 鉴权失败错误码：`server.auth.invalid_token`、`server.auth.expired`、`server.auth.forbidden`（HTTP 401/401/403，WS 4401/4401/4403；架构 10 §11.2），均触发 `error/raised` 且不泄露内部细节。

### EM-04 存储对接

- 优先级：P0 | 目标里程碑：M2（字节回调）/ M3（服务端 Provider） | 依赖能力：`server-storage` Definition + Provider（S3 兼容，compose 默认 SeaweedFS / 本地）、资源上传通道（CO-12）
- 验收标准：
  - 前端：文档字节来源与去向由集成方掌握（EM-02）；图片/媒体插入时的二进制走「资源上传回调」`uploadAsset(file) → { url | assetId }`（协同模式必需，单人模式可选：不提供则内嵌到 pptx）。
  - 服务端：`blobStore` 服务的 Provider 座可替换（任意 S3 兼容服务——自托管 compose 默认 SeaweedFS、本地文件系统、集成方自定义），接口含 put/get/head/delete/presign；切换 Provider 只改配置并通过 `runBlobStoreConformance`。
  - 元数据（文档、版本、评论索引、审计）默认 Postgres（ADR-0022）；集成方可只用 SDK 的协同网关而自管元数据（P2，需公开表结构与迁移脚本）。
  - 大文件：≥ 10 MB 上传走分片/预签名直传，不经 Nest 进程内存。

### EM-05 事件回调

- 优先级：P0 | 目标里程碑：M2 | 依赖能力：`Events` 接口声明（章程 §5.5，扫描器保证）、`telemetry`
- 用户故事：作为集成方，我希望订阅编辑器的关键事件来驱动我的业务（自动保存、活动流、通知、埋点）。
- 验收标准：
  - 公开事件（`<域>/<动作>`；已按裁决记录 §5 与架构 10 §11.1 定稿）：

| 域 | 事件 | 载荷要点 | 里程碑 |
|---|---|---|---|
| unit | `unit/opened`、`unit/open-progress`、`unit/open-failed`、`unit/closed`、`unit/dirty-changed`、`unit/saved`、`unit/migrated` | unitId、阶段/百分比、错误码、schemaVersion | M1/M2 |
| command | `command/executed`、`command/rejected`、`command/failed`、`command/audited` | 命令 id、耗时、拒绝原因（权限/校验）、审计摘要 | M2 |
| store | `store/transaction`（公开订阅 ≥ 50 ms 合并）、`store/loaded` | 事务 id、`origin{kind, via?}`（`local(via: undo/redo)` / `remote` / `system(load/import/migration/repair/restore)` / `replay`）、影响元素数 | M2 |
| history | `history/changed` | canUndo / canRedo / depth | M2 |
| selection | `selection/changed` | 选区摘要（类型、数量、页；无文本） | M2 |
| view | `view/page-changed`、`view/zoom-changed`、`view/mode-changed`（编辑/放映/母版） | | M2 |
| render | `render/first-paint`、`render/frame`（帧完成；公开订阅 ≥ 50 ms 合并，帧级数据只走遥测 `perf/frame`）、`render/element-degraded`、`render/element-failed`、`render/font-fallback` | 页、kind、原因、字体名 | M1 |
| layout | `layout/fonts-ready`、`layout/measurer-changed` | 字体族、度量器 id | M1 |
| export | `export/started`、`export/completed`、`export/failed` | 格式、页数、耗时、字节数 | M2 |
| collab | `collab/state-changed`、`collab/synced`、`collab/soft-conflict`、`collab/auth-failed`、`collab/reconnect`、`collab/update-rejected`、`collab/repair` | 状态、类型、code、reason、paths | M3 |
| presence | `presence/joined`、`presence/left`、`presence/changed` | clientId、用户 id、页 | M3 |
| comment | `comment/added`、`comment/replied`、`comment/resolved`、`comment/reopened`、`comment/deleted`、`comment/mentioned` | 线程 id、作者、被提及用户、锚点摘要（正文可配置脱敏） | M3 |
| permission | `permission/changed`、`permission/denied` | 能力位差异、被拒命令 | M3 |
| plugin | `plugin/loaded`、`plugin/failed`、`plugin/incompatible` | 插件 id、版本、错误码 | M2 |
| error | `error/raised` | 错误码（点式，EM-12）、severity、可重试性、关联 unitId | M1 |

  - 事件载荷不含文档文本内容（评论正文除外，且可配置脱敏）；所有事件类型化、可在 TS 中订阅；订阅返回 disposer（`ctx.on` 语义）。
  - 事件顺序保证：同一 `Unit` 内按发生顺序；`store/transaction` 在 `command/executed` 之前。
  - `waterfall` 拦截点（如命令执行前置钩子）属命令管线内部契约（架构 05），不在公开事件表中。
  - 定稿说明：`render/element-failed`、`permission/changed` 为定稿名（取代草稿期的 `render/error`、`collab/permission-changed`）；`render/painted` 不采纳；遥测事件 `perf/frame` 由 cordis 事件 `render/frame` 派生（见 `06-metrics-and-analytics.md`）；第三方插件事件须带 `<vendor>:` 前缀（章程 §5.5）。

### EM-06 主题与外观定制

- 优先级：P0 | 目标里程碑：M2 | 依赖能力：`@cordexjs/design` token（CSS 变量单向契约，继承 Univer K7 并扩展到间距/字号/z-index/动效）、`theme` 服务、`ui.theme` 贡献点
- 用户故事：作为集成方，我希望编辑器看起来像我产品的一部分：品牌色、圆角、字体、暗色模式一致。
- 验收标准：
  - 全部视觉属性 token 化（颜色、间距、字号、圆角、阴影、z-index、动效时长/曲线）；集成方通过 CSS 变量覆盖或 `theme` 服务传入 token 对象；运行时切换 ≤ 100 ms 无闪烁。
  - 内置 light/dark + `prefers-color-scheme` 跟随，并响应宿主 `data-theme` 标记；高对比（`forced-colors`）可用（NF-05）；材质层（玻璃面板）在 `prefers-reduced-transparency: reduce` 或不支持 `backdrop-filter` 时退化为不透明面板（设计 09 v3.0 §6.3；NF-01 §1.5）。
  - 组件基座：shadcn/ui `radix-rhea` 复制件 + `@cordexjs/design` 主题变量（章程 D10、ADR-0017）；主色亮 `#3A5CE6` / 暗 `#6B93FF`（rulings §4.8）。
  - 密度：`comfortable`/`compact` 两档（设计 04）。
  - 字体：UI 字体族可配置；画布内容字体不受 UI 主题影响（内容保真优先）。
  - 图标可替换（图标集作为 token 引用，P1）。
  - z-index：编辑器所有浮层使用 token 化层级，集成方可整体平移以适配自家浮层；浮层默认渲染到编辑器容器内（可选 `portal` 到 body）。
  - 样式隔离：所有类名带前缀；P1 提供 Shadow DOM 模式。

### EM-07 按需加载与体积

- 优先级：P0 | 目标里程碑：M2 | 依赖能力：`Preset` 组合、垂直束按需加载、动态 import 的贡献
- 验收标准（gzip，不含字体与集成方自带依赖；初始预算，M2 校准）：

| 组合 | 初始加载预算 | 说明 |
|---|---|---|
| 查看器（preset-slide-viewer：kernel + model + ooxml + layout + render-dom + slide-render） | ≤ 350 KB | 不含图表渲染块 |
| 编辑器（preset-slide + ui-react + slide-ui） | ≤ 900 KB | 不含 React 本体（peer） |
| 协同增量（store-yjs + collab-* + 评论/presence UI） | ≤ 200 KB | yjs 单点引入 |
| 图表渲染器（惰性块） | ≤ 400 KB | 首次遇到图表元素时加载 |
| 单个语言包 | ≤ 30 KB | 惰性 |
| 单个示例插件 | ≤ 50 KB | |

  - 惰性边界：图表渲染器、放映模式、母版视图、版本历史 UI、导出 PDF、每个语言包、每个非默认 `ElementRenderer` 插件均为独立块；首屏不加载。
  - 包为 ESM、`sideEffects: false`（除必要样式入口）、显式 `exports`（无 `./*` 通配，Univer A27）、`publint`/`attw` 通过；支持 Vite、webpack 5、Rspack、Next.js（客户端组件）。
  - CI 体积门禁：任一组合超预算 5% 失败；报告每个 PR 的体积变化。

### EM-08 UI 裁剪与扩展

- 优先级：P0 | 目标里程碑：M2 | 依赖能力：`ui.*` 贡献点、`ctx.intercept`（子树级配置）、`permissions`
- 验收标准：
  - 可隐藏/禁用任一内置 ribbon 页签、分组、按钮、面板、右键项、快捷键（按 id，配置化）；可整体隐藏 ribbon / 缩略图栏 / 备注 / 状态栏。
  - 可通过贡献点新增自家按钮/面板（无需写「插件包」，允许在宿主代码内以内联插件形式贡献）。
  - 只读嵌入：一个配置项进入查看模式（等价于无 `doc.write`），UI 自动收敛。
  - Headless：不加载 UI 绑定，仅画布 + 命令 API，集成方自绘工具栏（形态 B/D）。
  - 内置文案可覆盖（按 i18n key）。

### EM-09 程序化 API（命令与模型）

- 优先级：P0 | 目标里程碑：M2 | 依赖能力：`commands` 服务、`DocumentStore.observe`、`Snapshot`
- 用户故事：作为集成方，我希望从我的业务代码执行编辑（如「把封面标题替换为客户名」）并读取模型（如「列出所有图片」）。
- 验收标准：
  - 执行命令：`commands.execute(id, params)`，参数经 schema 校验，权限 fail-closed，返回结果或类型化错误；批量命令可合成一个 `Transaction`。
  - 读取模型：只读、类型化的遍历 API（页、元素、文本、备注、评论）；`store.observe` 订阅变化（按路径过滤）。
  - 模板填充：headless 下按占位符类型/名称替换文本与图片（继承 @hokkyss/pptx 的模板能力思路），批量 100 份 D50 ≤ 60 s（Node）。
  - 公共 API 由 api-extractor 基线守护（Univer A21）；`internal` 标记的 API 不在类型入口导出。

### EM-10 服务端集成方式

- 优先级：P0 | 目标里程碑：M3 | 依赖能力：`apps/server`（NestJS 11）、`server-*` 包、`protocol`（zod schema → OpenAPI）
- 验收标准：
  - 两种方式：(a) 部署参考服务 `apps/server`（自托管 docker-compose 洁净栈，Q10；不提供自营 SaaS）并通过 REST/WS 集成；(b) 在自有 Nest 应用中 import `server-*` 模块（Collab Gateway、ImportExport、Snapshots、Thumbnails、Audit），自带 Auth。
  - `protocol` 生成 OpenAPI 3.1 与 TS 客户端；WS 消息 schema 有文档；错误码统一。
  - 单组织（rulings §4.15 T-0）：一次部署 = 一个组织，接口与数据模型中没有租户概念；数据访问兜底 = 文档权限检查（章程 D12）+ **文档级 Postgres RLS**（Q6）。将来若做 SaaS 另立项。
  - 反向代理/WS 粘性与跨实例 pub/sub 要求写入部署指南（SV-09）。

### EM-11 国际化对接

- 优先级：P1 | 目标里程碑：M2 | 依赖能力：`i18n` 服务、`i18n.bundle` 贡献点
- 验收标准：初始化指定语言或跟随浏览器；运行时切换（≤ 200 ms）；覆盖任意 key；新增语言包（插件形式）；日期/数字格式用 `Intl`；文案缺失回退 zh-CN 并上报 `i18n/missing-key`（开发模式抛错）。

### EM-12 错误处理与诊断

- 优先级：P0 | 目标里程碑：M1 | 依赖能力：`errors` 服务（类型化错误码，禁止裸 `throw new Error`，章程 D11）、`logger`
- 验收标准：
  - 所有对外错误为类型化对象：`code`（点式 `<domain>.<snake_case_name>`，如 `format.limit_exceeded`、`server.auth.expired`、`collab.room_full`；架构 10 §1.1，PRD 早期斜杠码已全部替换，映射见架构 10 §11.2）、`severity`（`fatal/error/warning`）、`retryable`、`user`（可否向用户展示）、`details`（结构化、无敏感数据）、`cause`。
  - 错误码表随文档发布并由 CI 与源码同步；每个错误码有 i18n 文案与建议动作。
  - `errors` 为可替换 Provider：默认控制台；可接 Sentry 等（章程 §5.4）。
  - 诊断包：`diagnostics.dump()` 输出 Fiber 树、插件清单、版本、最近 200 条事件、性能标记（不含文档内容），用于支持工单。
  - 日志结构化（JSON）、按 `Unit` 打标、级别可配。

### EM-13 遥测对接

- 优先级：P1 | 目标里程碑：M2 | 依赖能力：`telemetry` 服务 + `telemetry.sink` Provider
- 验收标准：默认 no-op（PD-10）；集成方接入自家管道（OTel 示例见 PS-04）；事件清单与属性 schema 见 `06-metrics-and-analytics.md`；采样率可配；隐私：无文档内容、无明文用户名（用集成方传入的不透明 id）。

### EM-14 安全与 CSP 约束

- 优先级：P0 | 目标里程碑：M2 | 依赖能力：`render-dom`、`ooxml-core` 输入限制（OF-24）
- 验收标准：
  - 本条是一份**客户端安全基线**（M2 P0，rulings §4.15 Q2/Q4/Q7 合并）：
  - 在严格 CSP 下工作：`script-src 'self'`（无 `unsafe-eval`/`unsafe-inline` 脚本）；样式以 CSS 变量与类名注入，需要内联样式时走 **CSP nonce（M2）**；**Trusted Types：M2 report-only → M3 强制**；Worker 以同源脚本加载（`blob:` Worker 可选；EMF 栅格化 chunk 同样同源）。
  - 内容安全：文档内 SVG（`asvg:svgBlip` 等）**只以图像上下文渲染**（`<img>` / SVG `<image>`），禁止以 `innerHTML`/`insertAdjacentHTML`/`DOMParser` 注入文档内容（由类型治理扫描器强制）；客户端 SVG 处理归属渲染层（M-07）；超链接协议白名单；粘贴内容清洗（ED-17）。
  - 外链资源（OF 矩阵 §2.5）：外部关系全部原样保留，仅 `http(s)` 可激活；部署配置 `externalResources = auto`（默认，用户选择）/ `confirm` / `never`，CSP 的 `img-src`/`media-src` 随配置收紧；`never` 即满足「不许外呼」的安全要求。默认 `auto` 会向外链域名暴露查看者 IP 与打开行为，集成检查清单（EM-18）须提示。服务端与 headless 永不加载外链。
  - 无第三方外呼：SDK 不加载 CDN 资源、不发遥测（除集成方配置与上述外链资源）。
  - 可在 `sandbox` iframe（`allow-scripts allow-same-origin`）内运行；剪贴板/全屏等需要的权限在文档列出。
  - 依赖：许可证白名单（D13）、`npm audit`/OSV 门禁、SBOM 随发布提供（P1）。

### EM-15 版本升级与兼容

- 优先级：P0 | 目标里程碑：M2 | 依赖能力：ADR-0002、`migrations`
- 验收标准：语义化版本；水平层 lockstep（一个版本号）；升级指南按次版本；`Snapshot` 向后兼容读（旧 → 新自动迁移），向前不承诺；弃用 API 在类型层标记并在 ≥ 1 个次版本后移除；每次发布附兼容矩阵（浏览器、Node（基线 26）、React（`^19.0`）、插件 API、CSP/Trusted Types 要求）。

### EM-16 许可与合规

- 优先级：P0 | 目标里程碑：M1 | 依赖能力：—
- 验收标准：SDK 许可证 **Apache-2.0**（已裁决，README PD-21 / 章程 Q12，rulings §4.16；根 `LICENSE` + `NOTICE`，可发布包 `license: Apache-2.0`）；第三方 NOTICE 随包；无 AGPL 代码（D13；PPTist 仅作交互参考）；借用 Apache-2.0 代码保留署名。

### EM-17 参考集成与快速开始

- 优先级：P0 | 目标里程碑：M2 | 依赖能力：`apps/web`
- 验收标准：`apps/web` 演示登录、**开始页（AS-01：新建 / 模板 / 最近 / 指南）、账户菜单（AS-06）**、文档列表、打开/编辑/导出、（M3）分享与协同；`examples/embed-react`、`examples/embed-vanilla`（形态 B 最小示例）、`examples/headless-node`；每个示例 ≤ 200 行且 CI 可运行。

### EM-18 集成检查清单（文档交付物）

- 优先级：P1 | 目标里程碑：M3 | 依赖能力：—
- 验收标准：文档站提供「上线前检查清单」：CSP、字体供给（OF-25）、令牌刷新、资源上传、自动保存策略、配额、错误上报、a11y 声明、浏览器矩阵、备份。

---

## 3. 集成方用户故事汇总

| 编号 | 故事 | 对应需求 |
|---|---|---|
| US-I-01 | 我想在我的 React 后台里预览客户上传的 pptx | EM-01 形态 C、EM-07 |
| US-I-02 | 我想让用户在我的产品里编辑并保存回我的对象存储 | EM-02、EM-04 |
| US-I-03 | 我要用我们自己的 SSO 与权限系统 | EM-03、CO-05 |
| US-I-04 | 我要编辑器看起来像我们的品牌 | EM-06 |
| US-I-05 | 我要在有人评论时给被 @ 的人发通知 | EM-05 `comment/mentioned` |
| US-I-06 | 我要隐藏「图表」按钮，加一个「插入产品图」按钮 | EM-08 |
| US-I-07 | 我要在服务端批量把 1,000 份模板填上客户名 | EM-09 模板填充、SV-13 |
| US-I-08 | 我们的安全团队要求严格 CSP 且不许外呼（`externalResources = never`） | EM-14 |
| US-I-09 | 我想知道升级 SDK 会不会坏 | EM-15 |
| US-I-10 | 我要把协同网关跑在我们的 K8s 里（M3 为 compose；Helm 为 M4 P1） | EM-10、SV-09 |

---

## 4. 与其它域的接口

| 本域产出 | 消费方 |
|---|---|
| 事件清单 | `06-metrics-and-analytics.md`（遥测事件镜像运行时事件）、架构 10 |
| 体积预算 | NF-01；架构 02 分包 |
| 鉴权 claims 草案 | SV-06；架构 08；`protocol` |
| 主题 token 要求 | 设计 04 |
| 嵌入形态 B（框架无关） | 架构 02 `ui-core` 无 React 的验收 |
