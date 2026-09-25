# 12 查看器、嵌入形态与 /render 页
> 状态：v0.1 | 负责：前端设计线 | 更新：2026-09-25；2026-09-25（§4.19）；2026-09-26（§4.20） | 依赖：[02 应用壳](02-app-shell-routing-and-session.md)、[03 预设装配](03-preset-assembly-and-plugins.md)、[05 渲染](05-rendering-and-thumbnails.md)、[15 事件与遥测](15-events-errors-and-telemetry.md)、[30/02 §4.21b](../30-architecture/02-layering-and-packages.md)、[30/07 §10、§14.5](../30-architecture/07-rendering.md)、[ADR-0010](../30-architecture/adr/0010-preset-vs-loader-composition.md)、[ADR-0015](../30-architecture/adr/0015-single-execution-entry-and-non-executable-mutations.md)、[ADR-0026](../30-architecture/adr/0026-headless-rendering-and-thumbnails.md)、[40/11](../40-modules/11-preset-assembly-and-app-shell.md) §3.3–§3.5、§6、§7、[设计 25 查看器壳](../20-design/03-screens/25-viewer-preset-shell.md)、[PRD 05 嵌入与集成](../10-prd/03-features/05-embedding-and-integration.md) EM-01/02/03/06/08/17、PRD OF-14、[rulings](../00-charter/rulings-2026-09-14.md) §4.10 Q18、§4.12 U-03、§4.15 Q2/Q8、§4.18 BE-04/FE-08/FE-09/UX-19

本文是三类只读形态、嵌入形态 A–F 与 `/render` 页前端职责的唯一事实源；**`/render` 的 ready 判据只在本文 §11 定义**，其它文档一律链接。嵌入 `postMessage` 的消息语义也归本文（文件路径登记在 protocol `embed/messages.ts`，由 M-02 登记）。

**本文不写**（只链接）：renderer sidecar 进程、信任区、内部 RPC、注入编排、池与背压、超时与重试（[60/06](../60-backend/06-modules-jobs-import-export-thumbnails.md) §9–§10）；查看器与编辑器共用的渲染管线（[05](05-rendering-and-thumbnails.md)）；事件名、载荷与合并规则（[15](15-events-errors-and-telemetry.md)）；CSP 正文（[14](14-client-security.md) §2）；体积数值与 chunk 地图（[13](13-performance-and-bundling.md) §6）；preset 清单本体（[40/11](../40-modules/11-preset-assembly-and-app-shell.md) §3）。

## 1. 三种只读形态与选择规则

| 形态 | 装配 | 入口 | 在协同房间内 | 实时看到修改 | React | 体积 | 里程碑 |
|---|---|---|---|---|---|---|---|
| **查看器壳** | `preset-slide-viewer` + 框架无关壳 | `apps/web` `/documents/:id/view`（只留给 M1 查看器与嵌入）、嵌入形态 C | 否 | 否（打开时的快照或字节） | 无 | ≤ 350 KB | M1 |
| **查看者变体** | `preset-slide-collab`，`EditorHost mode='view'` | `apps/web` `/documents/:id`（viewer 角色） | 是，计入 50 个查看者名额，只上报视图 | 是，含在场 | 有 | 编辑器 + 协同 | M3 |
| **`/render` 页** | `preset-slide-viewer`，去壳、关惰性 | renderer sidecar 中的 headless Chromium | 否 | 否（注入的状态） | 不渲染 UI | 同查看器基线 | M3 |

查看者变体是编辑器的只读呈现：评审外观去掉「评论 / 高亮」等创建类按钮，只保留跳转与阅读评论，模式下拉只列「只读浏览」与放映（rulings §4.18 UX-19；界面差异见 [10](10-editor-shell-and-interaction.md) §3）。评审模式（commenter）不是只读形态，不在本表。

**图 1 三种只读形态的选择**

```mermaid
flowchart TB
  need["需要只读地呈现一份幻灯片"] --> who{"谁在看"}
  who -- "服务端作业：缩略图、PDF" --> render["/render 页：viewer 去壳、关惰性、只接受注入"]
  who -- "人在浏览器里看" --> where{"在哪里"}
  where -- "apps/web 中打开服务端文档，角色为 viewer" --> viewVariant["查看者变体：/documents/:id，协同编辑器 mode 为 view"]
  where -- "M1 本地文件、集成方预览、无服务端" --> shellViewer["查看器壳：preset-slide-viewer 与 mount"]
  where -- "集成方页面嵌入" --> embedForm{"是否需要实时协同"}
  embedForm -- "否，只要预览" --> shellViewer
  embedForm -- "是" --> embedEditor["形态 A 或 E，以 view 模式打开编辑器"]
```

怎么读：自上而下是判断顺序；菱形是分支问题，边上文字是回答；叶子节点是应选用的形态。唯一会进入协同房间的只读形态是查看者变体（及以 view 模式嵌入的编辑器）。

依据：rulings §4.18 UX-19；[30/02](../30-architecture/02-layering-and-packages.md) §4.21b；ADR-0026 决策 1。

## 2. `preset-slide-viewer`

- **两道只读保证**（ADR-0015 决策 4）：① 清单**不含** `@cordexjs/model-slide/editing`，编辑命令与变更贡献不存在 → `COMMAND_NOT_FOUND`（depcruise `cordex-viewer-no-editing` 与 `no-editing-graph.test.ts` 双查依赖图与构建图）；② `read-only` 权限策略为 `required` 条目、不可 `exclude`，即使被 `override` 强行装入 editing，执行编辑命令也得到 `PERMISSION_DENIED`。
- **能力位**：策略只放行 `doc.read`；`allowExport` 为真时另放行 `doc.export`；`allowExport` 默认关，集成方显式开启（rulings §4.12 U-03）。
- **无 React**：不装 `ui-core` / `ui-react` / `slide-ui` / `collab-*` / `local-presence`；壳是框架无关 TS + CSS（§3）。manifest 的 `forbids` 列表含 `react`、`react-dom`。
- **历史**：`model-core.historyLimit: 0`（不建撤销栈）。
- **体积**：基线 ≤ 350 KB gzip（PRD OF-14 / EM-07），分解表在 [40/11](../40-modules/11-preset-assembly-and-app-shell.md) §3.4，门禁与 chunk 规则见 [13](13-performance-and-bundling.md) §6；惰性件不计基线。

**图 2 查看器只读的两道保证**

```mermaid
flowchart LR
  cmd["commands.execute 编辑命令，如 slide.insertShape"] --> lookup{"core.command 中有此命令？"}
  lookup -- "没有：viewer 不装 editing" --> notFound["COMMAND_NOT_FOUND，第一道"]
  lookup -- "有：被 override 强行装入" --> policy{"read-only 权限策略"}
  policy -- "能力位不是 doc.read，也不是已放行的 doc.export" --> denied["PERMISSION_DENIED，第二道"]
  policy -- "doc.read，或 allowExport 时的 doc.export" --> allowed["执行只读或导出操作"]
  build["构建期：depcruise cordex-viewer-no-editing 与构建图断言"] -. "保证第一道成立" .-> lookup
```

怎么读：从左到右是一次命令执行经过的两道检查；虚线表示第一道在构建期就被依赖规则与构建图断言锁住，第二道在运行期由不可排除的权限策略兜底。

依据：ADR-0015 决策 4；[40/11](../40-modules/11-preset-assembly-and-app-shell.md) §3.3 `read-only` 列、§3.4。

## 3. 查看器壳 `viewer-shell`

`preset-slide-viewer/src/shell/**` 是框架无关的 TS + CSS（基础控件用 `[data-slot]` 类，复用 `@cordexjs/design` token，不复用 ui-react 的 React 复制件；壳本身 ≤ 15 KB）。外观以设计 25 与 playground `/viewer` 为准，本节定行为。

**句柄**：`createSlideViewerPreset(options)` 返回 `Preset & { mount(container: HTMLElement): ViewerHandle }`，

```ts
interface ViewerHandle {
  goToPage(slideId: string): void              // 等价于工具条跳页
  setZoom(zoom: number | 'fit-contain' | 'fit-width'): void
  dispose(): void                              // 卸载 DOM、ResizeObserver 与订阅；不销毁 host
}
```

- **挂载时序**：`mount()` 可早于 `units.open`，先显示加载骨架；`unit/opened` 后把当前 Unit 的 `render` 挂到画布容器；host 内有多个 Unit 时显示最近打开的一个（查看器按单 Unit 使用）。
- **页码与缩放**：订阅 engine-render `Viewport` 发布的 `view/page-changed`、`view/zoom-changed`（依据：VIEW-EVENTS，authority：Viewport 归 engine-render，30/07 §2.3）；查看器壳不自行维护第二份页码。
- **工具条**：上一页 / 下一页、页码输入、缩放 10–400% 与适应窗口、全屏、搜索（M2 P1）、ⓘ 保真摘要、备注按钮（仅 `notes:true`）。
- **键盘**：←/→、PageUp/PageDown 翻页，Home/End 首末页，`+` / `-` 与 `Mod+滚轮` 缩放，`F` 全屏，`Esc` 退出全屏（备注抽屉打开时先关抽屉）；工具条按钮全部 `Tab` 可达。
- **超链接**：`hyperlinks:'new-tab'`（默认）时外链在新窗口打开（`noopener,noreferrer`，只放行 http(s) 与 mailto，白名单见 [14](14-client-security.md) §5），页内跳转链接调用 `goToPage`；`'ignore'` 时不响应。不劫持宿主页面导航。
- **保真摘要**：计数来自 `unit/opened` 的导入诊断与 `render/element-degraded`；「查看详情」只在宿主提供 `callbacks.onOpenDetails` 时可点。
- **加载与失败**：`unit/open-progress` → 容器内骨架（不跳转）；`unit/open-failed` → 容器内失败态，文案按错误码取 `errors.<code>`（[15](15-events-errors-and-telemetry.md) §4），「下载原文件」只在宿主提供 `callbacks.onDownloadOriginal` 时出现，否则不留占位。
- **窄屏**：< 640 px 工具条收敛为翻页、缩放、「⋯」（内含全屏 / 搜索 / ⓘ / 缩略图开关），命中区 ≥ 44 px，支持双指缩放与平移；< 320 px 工具条可折为两行，优先保证画布可见。

**图 3 查看器壳挂载与惰性可选件激活**

```mermaid
sequenceDiagram
  participant hostApp as 宿主页面或 ViewerPage
  participant preset as preset-slide-viewer
  participant shell as viewer-shell
  participant units as units 服务
  participant render as engine-render Viewport
  participant lazy as 惰性可选件 chunk
  hostApp->>preset: createSlideViewerPreset，thumbnails 与 notes 按需
  hostApp->>shell: mount container，先显示骨架
  hostApp->>units: units.open，source 为 bytes 或 snapshot
  units-->>shell: unit/open-progress，更新骨架
  units-->>shell: unit/opened
  shell->>render: 画布挂到容器，适应窗口
  opt thumbnails 或 notes 或 search 为真
    shell->>lazy: manual 激活，动态 import
    lazy-->>shell: 缩略图条、备注抽屉或搜索面板就绪
  end
  render-->>shell: view/page-changed 与 view/zoom-changed
  shell->>shell: 更新页码与缩放显示
```

怎么读：自上而下是时间顺序；`opt` 段只在宿主打开对应选项时发生，选项为假时不发请求、不留占位；页码显示只跟随 `Viewport` 事件。

依据：设计 25；[40/11](../40-modules/11-preset-assembly-and-app-shell.md) §3.3 `viewer-shell` 列；VIEW-EVENTS。

## 4. 惰性可选件

| 可选件 | 选项（默认） | 激活 | 行为要点 | chunk 上限 |
|---|---|---|---|---|
| 缩略图条 `viewer-thumbnails` | `thumbnails: false` | `'manual'`，由壳在选项为真时触发 | 画布下方横向条；点击跳页，条内 ←/→ 移焦、Enter 跳转；视口附近懒渲染，≥ 50 页虚拟化；单页失败显示页码灰块；文档只有 1 页时不显示；< 640 px 改为「⋯」内开关、以顶部抽屉呈现 | 20 KB |
| 备注抽屉 `viewer-notes` | `notes: false` | 同上 | 桌面右侧非模态抽屉（宽 320），窄屏底部抽屉（40vh）；只读纯文本、保留换行；翻页时保持打开并切换内容；无备注显示「本页没有备注」 | 10 KB |
| 搜索 `viewer-search` | `search: false` | 同上 | 与编辑器查找面板同一交互，不含替换区（M2 P1） | 15 KB |

三者都**不计入 350 KB 基线**；选项为假时不渲染入口、不留占位、不发请求（rulings §4.10 Q18）。`allowExport` 默认关（U-03）；开启后集成方可经 `commands.execute(unitId, 'core.export', { format:'pptx' })` 在浏览器内导出，壳本身不增加导出入口（设计 25 未设该控件）。

## 5. 嵌入形态 A–F 决策表

集成方先按宿主技术栈选形态，再取对应入口与排除集。SDK 对宿主 React 声明 peer `^19.0`（rulings §4.15 Q2），**React 18 宿主走形态 B 或 E**。

| 宿主情况 | 形态 | 入口 | options 要点 | 排除集 | 体积口径（[13](13-performance-and-bundling.md) §6） | 里程碑 |
|---|---|---|---|---|---|---|
| React 19 应用，要完整编辑器 | A | `@cordexjs/ui-react` `<EditorHost>` + `createSlidePreset` / `createSlideCollabPreset` | `theme.injectCss:true` + `cssNonce`；`shell.onIntent`；`i18n.bundles`；协同时 `collab.getToken` | 无 | 编辑器 ≤ 900 KB，协同增量 ≤ 200 KB | M2 |
| Vue、Angular、Svelte、原生或 React 18，要编辑 | B | `createSlidePreset({ exclude: FRAMEWORK_FREE_EXCLUDES })` + `render.attach` + 宿主自绘 UI | 同 A，去掉 React 相关项 | `FRAMEWORK_FREE_EXCLUDES = { ui-react, slide-ui }` | 产物不含 react / radix 模块 | M2 |
| 只要预览 | C | `createSlideViewerPreset(options)` → `preset.mount(el)` | `thumbnails`、`notes`、`search`、`fit`、`allowExport`、`hyperlinks`、`callbacks` | viewer 本身不含编辑与 UI 包 | ≤ 350 KB | M1 |
| 批处理、校验、模板填充（浏览器内） | D | `createSlidePreset({ exclude: HEADLESS_EXCLUDES, permissions: { capabilities } })` | 无 UI、无画布 | `HEADLESS_EXCLUDES`（清单本体在 preset-slide `config/headless.ts`，[40/11](../40-modules/11-preset-assembly-and-app-shell.md) §5.1） | — | M1（浏览器）；Node 端为 `server-headless`（[60/06](../60-backend/06-modules-jobs-import-export-thumbnails.md) §8），M3 |
| 最快接入、强隔离 | E | `apps/web` `/embed/:id?mode=view\|edit` 的 iframe + `postMessage` 桥 | `cordex:init` 消息（§9） | — | 同 `apps/web` | M3 P2 |
| 要 Web Component | F | `@cordexjs/ui-webc`（未来包装层） | preset API 不变 | — | — | M4+ |

**图 4 嵌入形态 A–F 与各自入口**

```mermaid
flowchart LR
  hostApp["集成方宿主"] --> stack{"宿主技术栈与需求"}
  stack -- "React 19，完整编辑器" --> formA["A：EditorHost 与 createSlidePreset 或 collab preset"]
  stack -- "其它框架或 React 18，要编辑" --> formB["B：排除 ui-react 与 slide-ui，宿主自绘 UI"]
  stack -- "只要预览" --> formC["C：createSlideViewerPreset 与 mount"]
  stack -- "无界面批处理" --> formD["D：排除 UI 与画布，commands 与 core.export"]
  stack -- "最快接入，强隔离" --> formE["E：iframe 嵌入 apps/web 的 /embed/:id"]
  stack -- "Web Component，未来" --> formF["F：ui-webc 包装层"]
  formB -. "契约" .-> vanilla["UiRenderer vanilla 与 runUiRendererConformance"]
  formE -. "消息" .-> bridge["postMessage 桥：cordex:init、ready、event"]
  formD -. "Node 端" .-> serverHeadless["server-headless，属 60/06"]
```

怎么读：左侧菱形按宿主情况分流到六种形态；虚线指向该形态额外需要满足的契约或所在的另一条设计线。

依据：PRD EM-01 §1 嵌入形态一览；rulings §4.15 Q2；[40/11](../40-modules/11-preset-assembly-and-app-shell.md) §6 嵌入形态表。

## 6. 形态 A 集成要点

- **挂载**：`<EditorHost host unitId mode layout slots documentTitle onNavigateBack onRename onSignOut />`（props 以 ui-react 为准，[40/10](../40-modules/10-ui-shell-and-slide-ui.md) §6）；`mode` 由集成方按角色给出（`edit` / `review` / `view`）。
- **样式与 CSP**：宿主页没有静态引入主题 CSS 时取 `theme.injectCss:true`；宿主启用严格 CSP 时必须把本次响应的 nonce 传给 `theme.cssNonce`，并在页面输出同值的 `<meta name="cordex-nonce">` 供第三方运行时样式读取（nonce 链见 [14](14-client-security.md) §3）。
- **壳意图**：实现 `shell.onIntent`，把导出、版本历史、插件管理器等意图映射到宿主自己的导航或对话框（[03](03-preset-assembly-and-plugins.md) §8）；不实现时菜单项点击无效果。
- **文案**：`i18n.bundles` 传宿主文案（`app` 命名空间）；内置文案可按 key 覆盖（EM-08）。
- **层级与浮层**：编辑器浮层使用 `--layer-*` token，宿主可在编辑器根节点上整体平移层级以适配自家浮层；浮层默认渲染在编辑器容器内，可选 portal 到 `body`（EM-06）。
- **样式隔离**：类名前缀与根节点作用域（[09](09-ui-system-and-theming.md) §10），Shadow DOM 模式为 P1。
- **多实例**：同页 ≥ 4 个编辑器各用一个 host（[03](03-preset-assembly-and-plugins.md) §6.1）；快捷键只分派给焦点所在实例；`dispose()` 后无残留 DOM、计时器、WS 与 blob URL，20 次创建 / 销毁内存增长 ≤ 5%（EM-01）。
- **尺寸**：`ResizeObserver` 驱动重排；最小可用 640 × 400 px，更小进入紧凑态。
- **保存策略**（EM-02）：回调式——订阅 `unit/dirty-changed`，在 `Mod+S` / 自动保存 / 主动调用时 `core.export` 得到字节或导出 Snapshot，交给集成方存储；协同式——服务端快照负责，集成方不处理字节。

## 7. 形态 B：宿主自绘 UI

- 装配：`createSlidePreset({ exclude: FRAMEWORK_FREE_EXCLUDES })`，同时排除 `ui-react` 与 `slide-ui`，bundle 内零 React / Radix；`ui-core` 照常装载，十个 `ui.*` 贡献点照常注册。
- 宿主读取 ui-core 的视图模型（Ribbon 树、检查器分区、状态栏、命令面板、右键菜单，[09](09-ui-system-and-theming.md) §7）自行绘制，所有动作一律 `commands.execute`；画布用 `render.attach(container)`。
- `examples/embed-vanilla` 提供最小 `UiRenderer('vanilla')`：只挂画布与宿主容器、不渲染 `ui.*` 贡献，并实例化 `runUiRendererConformance`（[40/10](../40-modules/10-ui-shell-and-slide-ui.md) §2.5），结果计入可插拔证据（[70/02](../70-testing/02-contract-suites-and-pluggability.md) §7、§10）。
- 验收：`ui-core` 与各 `*-ui` 的 `domain` / `application` 层不 import React（depcruise `cordex-ui-bundle-core-framework-free`）；形态 B 构建产物中无 react / radix 模块（bundle 断言）。

## 8. 形态 D：浏览器 headless

- 装配：`createSlidePreset({ exclude: HEADLESS_EXCLUDES, permissions: { capabilities } })`，去掉 UI 与画布渲染，保留模型、编解码与命令；因缺少画布而缺席的能力以诊断出现，不影响导入与导出。
- 用法：`units.open({ source:{ kind:'bytes', bytes } })` → 若干 `commands.execute(unitId, …)` → `commands.execute(unitId, 'core.export', { format:'pptx' })` 得到字节；权限由集成方直接传能力位，客户端管线 fail-closed（EM-03 单人模式）。
- 约束：不访问 DOM（`headless.test.ts` 在 happy-dom 下断言无 DOM 调用）；Node 端批处理不用本形态，而用 `server-headless`。

## 9. 形态 E：`/embed/:id` 与 `postMessage` 桥

依据：MECH-INC 中的 INC-36（authority：已接受 ADR、rulings、30 正文优先于 40）——`embed/messages.ts` 进 M-02 目录树（M3 P2）；M3 的 `/embed` 只接受会话登录，`cordex:token` 握手标注 M4。

**登录与站点约束**

- M3 只认 `apps/web` 自己的 cookie 会话。会话 cookie 为 `SameSite=Lax`（[60/02](../60-backend/02-auth-chain.md) §4），**跨站 iframe 中不会被携带**，因此 M3 的形态 E 只支持与部署同站（same-site，例如同一注册域下的内网子域）的宿主；跨站宿主等 M4 的 `cordex:token` 握手（集成方签名 JWT，EM-03）。
- iframe 内没有会话时不做顶层 OIDC 跳转（IdP 通常禁止被嵌入）：页面显示「请在新窗口登录」，按 [02](02-app-shell-routing-and-session.md) §5 的弹窗流程登录，收到 `cordex-auth` 广播后重新加载 iframe 内容；同时向父页发 `cordex:auth-required`。
- `/embed` 响应的 `frame-ancestors` 取部署配置 `web.embed.allowedHostOrigins`（[60/17](../60-backend/17-deployment-and-config.md) §5，环境变量 `CORDEX_WEB_EMBED_ALLOWED_ORIGINS`，默认空即 `'none'`），其余路由保持 `frame-ancestors 'none'`（[14](14-client-security.md) §2、§11）；同一份值渲染进 RuntimeConfig `embed.allowedHostOrigins`（[02](02-app-shell-routing-and-session.md) §3），作为下文 postMessage 桥的 origin 允许列表。

**消息表**（字段语义归本文；schema 文件为 protocol `embed/messages.ts`；所有消息带 `v: 1`）

| 方向 | 类型 | 字段 | 时机与处理 |
|---|---|---|---|
| 父 → iframe | `cordex:init` | `mode?: 'view' \| 'edit'`、`locale?`、`theme?: 'light' \| 'dark' \| 'system'` | 父页收到 `cordex:ready` 后发送；iframe 只接受一次，之后以它的 `origin` 作为唯一对端 |
| 父 → iframe | `cordex:set-theme` | `theme` | 随时；等价于用户切换主题 |
| 父 → iframe | `cordex:go-to-page` | `slideId` | 随时；不存在的页忽略 |
| 父 → iframe | `cordex:token`（M4） | `token` | 集成方签名 JWT，M3 收到即回 `cordex:error` |
| iframe → 父 | `cordex:ready` | `appVersion`、`documentId` | iframe 脚本就绪、桥已监听；发往允许列表中与 `document.referrer` 同源的那一项，找不到则不发 |
| iframe → 父 | `cordex:event` | `name`、`payload` | 宿主事件桥转发的公开事件（§10），名单与脱敏规则见 [15](15-events-errors-and-telemetry.md) §3 |
| iframe → 父 | `cordex:intent` | `target` | 需要宿主处理的壳意图（例如「返回」） |
| iframe → 父 | `cordex:auth-required` | — | iframe 内无会话 |
| iframe → 父 | `cordex:error` | `code`、`detail?` | 打开失败、协议版本不符等；`code` 为 protocol 已登记错误码 |

**安全规则**：iframe 只处理 `event.source === window.parent` 且 `event.origin` 在允许列表内的消息，`init` 之后只认同一 `origin`；发送一律写明 `targetOrigin`，**从不使用 `'*'`**；消息体只含可结构化克隆的 JSON（不含函数、DOM、令牌以外的凭据），未知 `type` 与 `v` 不符的消息丢弃并计数。

**集成方 iframe 属性要求**：`sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads"`（会话 cookie 与存储需要 `allow-same-origin`，登录弹窗与外链需要 `allow-popups`，导出需要 `allow-downloads`）；`allow="fullscreen; clipboard-read; clipboard-write"`；`referrerpolicy="strict-origin-when-cross-origin"`。

**图 5 形态 E 的握手与事件转发**

```mermaid
sequenceDiagram
  participant parent as 集成方父页
  participant frame as apps/web 的 /embed/:id
  participant bridge as post-message-bridge
  participant host as 编辑器 host
  parent->>frame: 创建 iframe，带 sandbox 与 allow 属性
  frame->>bridge: 启动，监听 message
  bridge->>parent: cordex:ready，targetOrigin 为允许列表中的宿主源
  parent->>bridge: cordex:init，mode 与 locale 与 theme
  bridge->>bridge: 校验 source 为 parent、origin 在允许列表、v 为 1
  alt 已有会话
    bridge->>host: 按 mode 打开文档，view 或 edit
    host-->>bridge: unit/opened 等公开事件
    bridge->>parent: cordex:event，按 15 的名单与脱敏规则
  else 无会话
    bridge->>parent: cordex:auth-required
    frame->>frame: 弹窗登录，收到 cordex-auth 广播后重载
  end
  parent->>bridge: cordex:go-to-page slideId
  bridge->>host: 视口定位到该页
```

怎么读：自上而下是时间顺序；`cordex:init` 之后桥只认该消息的来源；`alt` 两支对应 iframe 内是否已有同站会话。

依据：INC-36；PRD EM-01 形态 E、EM-03；[40/11](../40-modules/11-preset-assembly-and-app-shell.md) §13 Q-1、Q-10。

## 10. 宿主事件桥与 15 的分工

`apps/web/src/application/host/host-event-bridge.ts` 在 `createEditorHost` 返回后对公开事件逐个 `ctx.on`（只读订阅、不 `emit`，disposer 交 `dispose()`），转发给 `apps/web` 自身与形态 E 的父页；形态 A–D 不经过 `apps/web`，集成方在自己的组合根直接订阅。**事件名、载荷、合并（≥ 50 ms）与脱敏规则归 [15](15-events-errors-and-telemetry.md) §1–§3**；本文只定通道。

| 接收方 | 适用形态 | 通道 | 过滤与顺序 |
|---|---|---|---|
| 应用状态 | `apps/web` 自身 | `EditorPageState` reducer、保存态、toast，应用私有 `app/*` 事件（typed `EventTarget`） | 全量；同一 Unit 内保持事件发生顺序 |
| 集成方 | A、B、C、D | 不经本桥：集成方在自己的组合根对 host 直接 `ctx.on`（公开事件名单同 15 §3） | 集成方自选；回调抛错被捕获并上报，不影响其它订阅者 |
| iframe 父页 | E | `cordex:event` 消息（§9） | 只转发 15 登记的公开事件；评论正文等按 15 的脱敏开关处理；合并后的帧按原顺序发送 |

## 11. `/render` 页前端职责（ready 判据唯一源）

`/render` 是 `apps/web` 的一个路由，静态包内置在 renderer 镜像中，由 headless Chromium 加载（ADR-0026 决策 1）。页面**只接受注入、零外呼、无任何拉取端点**（rulings §4.18 BE-04）：`local`（worker 内 Playwright）与 `remote`（renderer sidecar）两种模式都由编排方调用 `window.__cordex.inject`，页面只有这一条路径。sidecar 进程、内部 RPC、注入编排、池与背压、每页 10 s 超时与重试见 [60/06](../60-backend/06-modules-jobs-import-export-thumbnails.md) §9–§10。

### 11.1 查询参数与启动

`RenderPageQuery`（schema 在 protocol `render/page.ts`）：

| 参数 | 取值 | 说明 |
|---|---|---|
| `renderId` | string | **只作日志关联**，不是凭据（`RenderStateToken` 已取消） |
| `documentType` | string | 只透传给 `resolveDocumentType`，页面不含文档类型分支 |
| `mode` | `thumbnail` \| `image` \| `print` | 缩略图截图、按页位图导出（页面行为同 `thumbnail`，尺寸由编排方的视口与 `deviceScaleFactor` 决定）或 PDF 打印；与 [60/06](../60-backend/06-modules-jobs-import-export-thumbnails.md) §10.3 的 `mode` 同一取值集 |
| `slides` | 逗号分隔的 slideId，可省 | 所请求页集合 P；省略即全部页 |
| `deviceScaleFactor` | `1` \| `2` \| `3` | 与编排方的视口设置一致 |
| `fontProfile` | string | 字体档 id，须与镜像预装的一致 |
| `layoutAlgoVersion` | number | 断行算法版本，须与本包一致，否则失败 |

- `main.tsx` 识别 `/render` 后走独立启动路径：**不读取 `RuntimeConfig`**（renderer 镜像内没有部署配置），`appVersion` 取构建期常量；不初始化 REST 客户端、遥测网络 sink、应用 i18n 与 UI 样式；错误只经 `window.__cordex.error` 与控制台（由编排方采集）。
- `RenderQuery` 守卫校验失败 → `window.__cordex.error({ code:'render.bad_query' })`，状态 `failed`。

### 11.2 `RenderPageState`

**图 6 RenderPageState**

```mermaid
stateDiagram-v2
  [*] --> booting: 加载静态包，解析查询参数
  booting --> awaitingInject: 查询合法，安装 window.__cordex.inject
  booting --> failed: 查询非法，render.bad_query
  awaitingInject --> opening: inject 载荷校验通过
  awaitingInject --> failed: 60 s 未注入 render.state_expired，或载荷与版本不符
  opening --> painting: unit/opened 且 unit/loaded，render.attach 到 stage
  opening --> failed: unit/open-failed
  painting --> ready: ready 判据成立，调用 window.__cordex.ready
  painting --> failed: 致命 error/raised
  ready --> [*]
  failed --> [*]
```

怎么读：方框是页面状态，箭头上是触发条件与错误码；`ready` 与 `failed` 都是终态，进入后页面忽略此后的一切事件与注入；注入等待 60 s 是页面常量，每页 10 s 渲染超时由编排方在注入之后计时，两者分开计（rulings §4.18 FE-09）。

依据：[40/11](../40-modules/11-preset-assembly-and-app-shell.md) §2.1；ADR-0026 决策 1、6；rulings §4.18 BE-04、FE-09。

### 11.3 `window.__cordex` 接口

| 成员 | 方向 | 语义 |
|---|---|---|
| `inject(payload)` | 编排方 → 页面 | 只在 `awaitingInject` 接受一次，重复调用忽略并记日志；`payload` 类型为 protocol `RenderStateResponse`：`state`（`encoding: 'snapshot-json'` + 字节，即 `snapshot/envelope.ts` 的 JSON，页面以 `units.open({ source:{ kind:'state', encoding:'snapshot-json', bytes } })` 打开；viewer 装配的 `store-memory` 只接受 `snapshot-json`（[30/03](../30-architecture/03-kernel-and-plugin-model.md) §5.3），`apps/web` 按 R9 也不能引入 `store-yjs`，因此 Y 状态到快照的转换由编排方完成，[60/06](../60-backend/06-modules-jobs-import-export-thumbnails.md) §10.3 的 `state.encoding` 待对齐，§12.3）、`media[]`（`sha256`、`mime`、字节）、`fonts[]`（文档内嵌字体：`family`、`weight`、`style`、字节）、`appVersion`；字节以 base64 字符串传入（`page.evaluate` 参数只保证 JSON 可序列化）；`fontProfile` 本体预装在镜像中，不经注入 |
| `ready(result)` | 页面 → 编排方 | 恰好调用一次：`{ pageIds, layoutAlgoVersion, fontProfile, diagnostics }`，`diagnostics` 按页给出降级元素数、失败元素数、字体回退、`missing`（请求了但不存在的页） |
| `error(result)` | 页面 → 编排方 | 恰好调用一次：`{ code, traceId? }`，`code` 为 protocol 已登记的错误码 |
| `state` | 只读 | 当前 `RenderPageState`，供编排方轮询兜底 |

`ready` / `error` 由编排方在导航前以 `exposeBinding` 或初始化脚本预置；页面只调用、不定义它们。载荷校验失败与 `appVersion` 不一致需要两个新码（建议名 `render.bad_payload`、`render.version_mismatch`），由总编排按 INC-10 一次登记进 [30/10](../30-architecture/10-observability-and-errors.md) §1，登记前暂用 `render.bad_query` 并在 `detail` 注明原因。

### 11.4 装配与舞台

- 装配：`createEditorHost({ preset:'view', documentType, source, viewer:{ exclude:['viewer-shell','design-css'], lazy:{ charts:false, locales:false }, allowExport:false } })`（`preset` 取文档类型无关的键，[02](02-app-shell-routing-and-session.md) §6、[03](03-preset-assembly-and-plugins.md) §5）；不挂 `<EditorHost>`，UI 包与协同包不进入 `/render` 的 chunk（[03](03-preset-assembly-and-plugins.md) §4）。
- 资源：注入的媒体按 `sha256` 写入 `MediaCache`（blob URL），本页的媒体解析器**禁止网络回退**，缺失即元素占位并计入诊断；注入的内嵌字体以 `FontFace` 注册到 `document.fonts`；外链资源一律占位（服务端永不加载外链）。
- 舞台：`#stage` 下每个所请求页一个 `[data-cordex-page="<slideId>"]` 容器，按页序排列；`thumbnail` 模式下编排方按该选择器截图，`print` 模式下各页之间分页、由编排方以幻灯片尺寸调用打印（尺寸与像素规则见 [05](05-rendering-and-thumbnails.md) §10 与 [60/06](../60-backend/06-modules-jobs-import-export-thumbnails.md) §11）。
- 所请求页不存在：不计入 P，在 `diagnostics` 中标 `missing`；P 为空时 `error({ code:'render.bad_query' })`。

### 11.5 ready 判据（唯一定义）

依据：rulings §4.18 FE-09（规格空白默认值，用户确认）；INC-08（authority：rulings §4.11 C-25 + §4.18 FE-09 + 30/10 §11.1）——`render/frame(unitId, stats{ pages, elementsUpdated, ms, overrun, pendingDirty })` 是进程内事件，ready 判据读 `pendingDirty`；遥测事件 `perf/frame` 与之并存，不是改名。

记所请求页集合为 P（§11.4 去掉不存在的页之后），`isRenderReady` 在以下四条**同时**成立时为真：

1. **装载完成**：已收到 `unit/opened` 与 `unit/loaded`（快照与状态源下二者几乎同时发生；分批装载只出现在字节源，rulings §4.18 CO-12）。
2. **页全部挂载**：对 P 中每一页都收到过 `render/page-mounted{ pageId }`。
3. **字体全部结算**：engine-layout 的只读查询 `fontsSettled(P)` 为真——P 中每一页记录的每个字体请求都已到达、超时或失败，某页没有需要加载的字体即视为已结算（接口与结算口径见 [05](05-rendering-and-thumbnails.md) §7.3 第 6 条）。页面在每次 `layout/fonts-ready` 与 `render/frame` 之后重读该状态；判据**不依赖**每页各出现一次 `render/font-fallback`（该事件在同一 Unit 内按 `(requested, reason)` 去重上报，后面的页可能不再出现，05 §7.2）。
4. **此后一帧无待绘**：记 t0 为条件 2 与 3 首次同时成立的时刻，t0 之后出现一次 `render/frame` 且 `stats.pendingDirty === 0`；render 服务提供只读 `hasPendingWork()` 时，也可在 t0 之后的下一个动画帧检查其为 `false`，两种方式等价。

判定为真时调用一次 `window.__cordex.ready(...)`，状态进入 `ready`。元素级降级与失败（`render/element-degraded`、`render/element-failed`）**不阻塞** ready，只计入 `diagnostics`；`lazy.charts:false` 保证图表渲染器随首屏装载，不会在 ready 之后出现惰性重绘。判定逻辑是 `domain/render-page-state.ts` 中的纯函数 `isRenderReady(events, P)`，输入为按时间排序的事件序列，便于用固定事件序列做单元测试。

### 11.6 零外呼的口径

- **计数区间**：自进入 `awaitingInject` 起到 `ready` 或 `failed` 止，页面发起的网络请求数必须为 **0**——包括 `fetch`、XHR、WebSocket、EventSource、`sendBeacon`、图片与字体请求。`booting` 阶段只允许加载本页静态包（HTML、JS、CSS），来源限于镜像内置的同一静态源，测试同时断言没有其它源。
- **实现手段**：`/render` 启动路径不创建 REST 客户端与遥测网络 sink；媒体解析器禁网络回退；字体只来自预装的 `fontProfile` 与注入的 `FontFace`；外链资源一律占位；`lazy` 全部关闭使首屏之后不再加载 chunk。
- **第二道防线**：[14](14-client-security.md) §2.3 的 `/render` CSP 变体（`connect-src 'none'`）；网络层零出站由 sidecar 的信任区保证（[60/06](../60-backend/06-modules-jobs-import-export-thumbnails.md) §9）。
- **两种模式各测一次**：`local` 与 `remote` 下 `render-page.spec` 都断言上述请求数为 0（rulings §4.18 BE-04）。

**图 7 /render 从注入到 ready（前端侧）**

```mermaid
sequenceDiagram
  participant orch as 编排方，page.evaluate 或 sidecar
  participant page as RenderPage
  participant host as viewer 装配，惰性关闭
  participant layout as engine-layout
  participant render as engine-render
  orch->>page: 打开 /render，查询参数含 renderId 与 slides
  Note over page: booting 后进入 awaitingInject，开始 60 s 页面常量计时
  orch->>page: window.__cordex.inject 状态、媒体、内嵌字体
  page->>host: 媒体写入 MediaCache，字体注册 FontFace，units.open
  host-->>page: unit/opened 与 unit/loaded
  page->>render: render.attach 到 stage，只挂所请求页
  render-->>page: render/page-mounted，逐页
  layout-->>page: layout/fonts-ready，字体到达、超时或失败后
  page->>layout: 读 fontsSettled P，为真即字体全部结算
  Note over page: t0：页全部挂载且字体全部结算
  render-->>page: render/frame，stats.pendingDirty 为 0，发生在 t0 之后
  page->>orch: window.__cordex.ready，pageIds 与逐页诊断
  Note over orch: 编排方按 data-cordex-page 截图或打印，每页 10 s 由编排方计时
```

怎么读：自上而下是时间顺序；字体晚到时会触发重排与新的脏区，因此必须等到 t0 之后出现一帧 `pendingDirty` 为 0 才算就绪；整个过程页面不向任何地址发请求。

依据：rulings §4.18 FE-09、BE-04；INC-08；[30/07](../30-architecture/07-rendering.md) §10；ADR-0026 决策 6。

## 12. 机械验证与里程碑

### 12.1 机械验证

本节只写断言；执行方式归 [70/06](../70-testing/06-frontend-component-and-e2e.md)、[70/02](../70-testing/02-contract-suites-and-pluggability.md)、[70/10](../70-testing/10-security-testing.md)，CI 步骤名以 [70/12](../70-testing/12-ci-gates-mapping.md) 为准。

| 断言 | 落点 | 执行点 |
|---|---|---|
| viewer 执行 `slide.insertShape` → `COMMAND_NOT_FOUND`；`override` 装入 editing 后 → `PERMISSION_DENIED`；`core.command` 中无 `slide.*`；`exclude:['read-only']` 抛 `PRESET_REQUIRED_ENTRY` | `preset-slide-viewer` `readonly.test.ts`、`pluggable.test.ts` | `test/unit`、`test/contract` |
| viewer 源码依赖图与构建图不含 editing、`ui-*`、`slide-ui`、`collab-*`、`react` | depcruise `cordex-viewer-no-editing`、`no-editing-graph.test.ts` | `depcruise` job、`test/unit` |
| viewer 基线 ≤ 350 KB，惰性件各自不超上限 | `config/bundle-budget.json` | `scanners/scan-bundle-budget` |
| `thumbnails:false` 时无 `viewer-thumbnails` 请求；为真时挂载后加载一次 | `lazy.test.ts` | `test/unit` |
| 查看器壳工具条 ARIA、翻页 / 缩放 / 全屏键、< 640 px 折叠、失败态按钮随回调存在性出现 | `shell.test.ts`（happy-dom） | `test/unit` |
| `preset-slide-viewer` 打开成功、无编辑命令；M3 起查看者变体为编辑器只读变体（viewer 角色进 `/documents/:id` 为 `mode='view'`，无创建类按钮） | e2e `viewer-readonly`（[70/12](../70-testing/12-ci-gates-mapping.md) §4 第 2 条） | `e2e/smoke` |
| 查看器翻页、缩放、全屏；可选件开关 | e2e 查看器 | `e2e/full-compose` |
| 查看器与查看者变体页 axe 零严重违规 | e2e a11y | `e2e/a11y` |
| 查看者变体计入查看者名额（查看者名额也满时按 [07](07-collaboration-client.md) §9 的 4503 行处理） | e2e 查看者名额 | `e2e/full-compose` |
| 形态 B 产物不含 react / radix；`UiRenderer('vanilla')` 通过 `runUiRendererConformance` | bundle 断言、`examples/embed-vanilla` 测试 | `test/contract` |
| 形态 D 不访问 DOM，`core.export` 可用 | `preset-slide` `headless.test.ts` | `test/unit` |
| 嵌入桥：非允许源与非父窗口的消息被丢弃；发送从不使用 `'*'`；`init` 之后只认同一源 | `post-message-bridge.test.ts` | `test/unit` |
| `isRenderReady`：字体晚到时，重排帧 `pendingDirty` 为 0 之前不 ready；元素失败不阻塞；缺页标 `missing` | `domain/render-page-state.test.ts`（固定事件序列） | `test/unit` |
| `/render` 在 `local` 与 `remote` 两种模式下自 `awaitingInject` 起请求数为 0 | renderer 零出站用例 | `e2e/smoke` 第 12 条 renderer-egress（[70/12](../70-testing/12-ci-gates-mapping.md) §4） |
| `/render` 在 ready 判据成立后才截图；注入超时与每页超时分别计数 | e2e `render-page.spec` | `e2e/full-compose`；视觉比对见 [70/04](../70-testing/04-visual-oracle.md) |

### 12.2 里程碑

| 里程碑 | 本文范围 |
|---|---|
| M1 | `preset-slide-viewer` 与查看器壳（形态 C）、`/documents/:id/view`、形态 D（浏览器）、两道只读保证与 350 KB 门禁 |
| M2 | 形态 A、形态 B（`embed-vanilla`）、查看器搜索（P1）、`examples/embed-react` / `embed-vanilla` / `headless-node`（EM-17，各 ≤ 200 行） |
| M3 | 查看者只读变体（UX-19）、`/render`（随服务端缩略图前半段）、形态 E（P2，仅同站会话） |
| M4 | `cordex:token` 握手与跨站形态 E；形态 F 起步 |

### 12.3 未决与回写

| 项 | 状态 | 处理 |
|---|---|---|
| 新错误码 `render.bad_payload`、`render.version_mismatch` | 待登记 | 总编排按 INC-10 登记进 30/10 §1；登记前暂用 `render.bad_query` |
| 注入载荷与 RPC 的对齐 | 已关闭 | [60/06](../60-backend/06-modules-jobs-import-export-thumbnails.md) §10.3 已改为 `snapshot-json`，字体资源带 `family` / `weight` / `style`，与 §11.3 一致 |
| `/embed` 允许宿主源的配置键 | 已关闭 | `web.embed.allowedHostOrigins`（[60/17](../60-backend/17-deployment-and-config.md) §5），同值进 RuntimeConfig `embed.allowedHostOrigins`（§9） |
| 回写 40/11（由总编排执行） | 已回写（[40/11](../40-modules/11-preset-assembly-and-app-shell.md) §12「2026-09-25 回写」，rulings §4.20 FE-17） | §2.1 `RenderPageState` 与 §2.4 render / layout 行、§6 嵌入形态表、§7「`/render` 页与 M-09 / M-12 的契约」改为「摘要 + 链接本文 §11」（含 `mode` 增 `image`、注入 `state` 只收 `snapshot-json`）；§2.4「集成方回调（形态 A/E）」改为本文 §10 的分工；§13 Q-10 结案（消息语义见本文 §9） |
| 回写 30/07 §10 与 ADR-0026 决策 6 | 待回写 | ready 判据段落改为引用本文 §11.5 |
