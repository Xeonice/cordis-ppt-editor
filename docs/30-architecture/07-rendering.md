> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-18（§11 按 14 §1 C-12 改「三处 LRU」为「四处」）；2026-09-24（rulings §4.15：Q4 DOM/SVG 单实现、canvas 三角色、toImage 主线程 + Web 字体 M2 spike、推翻 offscreen-canvas Provider、§14.6 删「导出在 Worker」；Q7 图表按 D16 与五类、SmartArt dsp 只读渲染、OLE 预览、EMF/WMF M2 惰性栅格化、chartex 占位、外链资源自动加载可收紧、文档内 SVG 只作图像上下文；Q5 堆预算与 20,000 元素关系；Q8 缩略图 M2 包内封面 / M3 renderer sidecar）；2026-09-24（rulings §4.16 Q19：R3 服务端字体包结案）；2026-09-24（复核修正，rulings §4.17：M13 renderer 契约 `render/sidecar.ts`、客户端 `remote-renderer.client.ts`、配置 `headless.mode/endpoint` 以 ADR-0037 为准；L11 服务端缩略图描述改 640 px WebP）；2026-09-25（补图）；2026-09-25（矛盾收口，rulings §4.18：CO-19 §0–§5、§7 统一换用 v0.2 契约名（SceneProvider / Scene / DirtySet / ElementRenderer.render·update(handle, node) / TextMeasurer，Provider `canvas`/`node-font`/`fixed`）；CO-01/CO-02 DX-1000 回退顺序与 200 ms 只作内部分解目标（§1）；FE-18 render-dom 不依赖 design（§0、§3.2）；GV-20 契约套件名（§2.4、§4.3、§5.4）；GV-21 章程锚点层带写法；CO-12/CO-11 打开管线首批装载后台追加、`unit/loaded`、`prioritize` 消息（§14.2）；FE-09 `/render` ready 判据（§10）；BE-04 renderer 注入单一路径）；2026-09-25（§4.19：§4.1 母版 / 版式占位符按 PowerPoint 行为一律不绘制（D-TEST-INFRA 视觉基线为 PowerPoint 365）；`layoutAlgoVersion` 统一命名（§5.1、§10）；§7、§8、§10 改为摘要 + 链接 50-frontend/05、10、12 与 60-backend/06）；2026-09-25（设计线拆分：§2.4、§3.2、§4.3、§5.4 目录树改链 40-modules/06、07；§6 保留 ADR-0028 决策段，其余链 50-frontend/06；§9、§14.6 链 50-frontend/13 与 70-testing/09；§14.2 浏览器侧流程链 50-frontend/04 §2；§14.4 链 50-frontend/05；§14.7 链 60-backend/06） | 依赖：charter v0.1

# 07 渲染（Rendering）：DOM/SVG 管线、贡献点运行时、布局引擎、脏区、命中测试、文本编辑宿主、缩略图、性能预算、服务端 headless

> 读者：实现 `@cordexjs/engine-layout`、`@cordexjs/engine-render`、`@cordexjs/render-dom`、`@cordexjs/slide-render`、`@cordexjs/server-headless`（缩略图部分）的工程师。
> 章程锚点：§2.3（不做 Canvas 优先）、§5.2 L5/V-render 包边界、§6.2 ADR-0021、§10 Q4/Q8、Univer A1/A4/A5（引擎对文档类型盲）、A28（脏区必须被消费）、A29（缓存淘汰必须接线）、A30（渲染热路径无拦截链）、A32（无第二份编辑缓冲）、A11（逐元素错误隔离）。
> 相关 ADR：0021（渲染介质）、0026（headless 渲染与缩略图）、0027（文本度量策略）、0028（文本编辑宿主）。
> 样式继承链解析（Element→Placeholder→Layout→Master→Theme）是 model-slide 的纯函数，见架构 04；本文只定义渲染层如何**缓存与失效**它的结果。

---

## 0. 一页总览

**渲染一页总览**

```mermaid
flowchart TB
  observeIn["store.observe：ChangeSet.paths"]
  viewIn["viewport / selection / presence 变化"]
  subgraph engineRender["engine-render：iso，对幻灯片无知"]
    dirty["脏集合并：SceneProvider.diff 产出 DirtySet{nodeIds, full, changed?}，FrameScheduler 合并"]
    scheduler["FrameScheduler：rAF / 宏任务合并 → 一帧一次 flush，帧预算 8 ms 脚本"]
    styleCache["StyleCache：Scene 节点 → 已解析样式，反向依赖索引驱动失效，LRU 淘汰"]
    viewport["Viewport：缩放 / 滚动 / 可见页集合，虚拟化"]
    hit["HitTester：bail 事件链，覆盖层优先 → 几何命中，纯函数"]
    points["贡献点：render.scene 即 SceneProvider、render.target 即 RenderTarget、render.element 即 ElementRenderer、render.overlay"]
  end
  subgraph renderDom["render-dom：dom"]
    domTarget["DomRenderTarget：mount 得 TargetHandle，内部实现 PageView / LayerHandle"]
    svgApi["SVG 图元 API：path / fill / stroke / clip / text"]
    overlay["OverlayLayer：选中框 / 手柄 / 远端光标 / 评论钉"]
    textHost["TextInputHost：隐藏 textarea + IME + 自绘光标"]
    fontMedia["FontFaceLoader、MediaCache：LRU，Blob URL"]
  end
  subgraph slideRender["slide-render：dom，垂直束"]
    compose["SceneProvider slide：composeSlide 见 04 → Scene，master / layout 模板层缓存"]
    elements["ElementRenderer：sp / pic / grpSp / cxnSp / graphicFrame"]
    thumbs["缩略图 Provider：dom-scaled / raster / server-png"]
    show["放映模式"]
  end
  engineLayout["engine-layout：iso，文本度量与断行，TextMeasurer 可插拔，prstGeom → path，单位换算，字体回退表"]
  observeIn --> engineRender
  viewIn --> engineRender
  engineRender -- "查表 targetId:kind → ElementRenderer" --> renderDom
  engineRender -- "查表 targetId:kind → ElementRenderer" --> slideRender
  engineLayout --> renderDom
```

怎么读：上方两个输入驱动 engine-render；engine-render 只持有契约、调度、缓存与命中，按 `${targetId}:${kind}` 查表把绘制交给 render-dom（输出介质）与 slide-render（幻灯片垂直束）；engine-layout 为 render-dom 提供度量与几何。本文 §0–§7 使用 v0.2 契约名（§14.1 对照表保留旧名到新名的映射，rulings §4.18 CO-19）。

**渲染相关包依赖**

```mermaid
flowchart TB
  slideRender["@cordexjs/slide-render：dom，垂直束"]
  renderDom["@cordexjs/render-dom：dom"]
  engineRender["@cordexjs/engine-render：iso"]
  engineLayout["@cordexjs/engine-layout：iso"]
  modelSlide["@cordexjs/model-slide"]
  ooxmlCore["@cordexjs/ooxml-core"]
  kernel["@cordexjs/kernel"]
  shared["@cordexjs/shared"]
  serverHeadless["@cordexjs/server-headless：LS，node"]
  slideRender --> modelSlide & engineRender & renderDom & engineLayout
  slideRender -- "仅用于只读解析 chartml 与 diagram drawing" --> ooxmlCore
  renderDom --> engineRender & engineLayout
  engineRender --> kernel & engineLayout & shared
  engineLayout --> shared
  serverHeadless -- "允许：iso 契约" --> engineLayout
  serverHeadless -- "允许：iso 契约" --> engineRender
  serverHeadless -. "禁止 import" .-> renderDom
```

怎么读：实线是 `package.json` 声明或 §14.5 允许的依赖，全部指向秩不高于自身的包，且 iso 包从不指向 dom 包；虚线是分层规则明确禁止的依赖（node 包不得 import dom 包）。M3 起图表渲染从 slide-render 拆为 `@cordexjs/slide-render-chart`（§13 S6），图中未单列。render-dom 不依赖 `@cordexjs/design`（章程秩表：L5 不得依赖 L7；§3.2 已按此改，覆盖层主题色直接写 CSS 变量名字符串）。
依据：本文 §2.4、§3.2、§4.3、§5.4、§14.5。

---

## 1. 渲染介质决策与坐标系（ADR-0021）

- **DOM/SVG 单实现**（rulings §4.15 Q4，ADR-0021 已接受）：主画布 = SVG（图形）+ 自绘文本行（SVG `<text>`），容器为 HTML。编辑、查看、放映、可见缩略图、服务端缩略图与 PDF **共用同一套 SVG 渲染**，不存在第二套渲染实现。选 SVG 而非 Canvas：任意缩放清晰、DOM 可检查/可测试（Playwright 断言节点属性）、a11y 有挂点、插件贡献一个 kind 的渲染器只需产出 SVG 节点、无自绘命中/无重绘管理负担。
- **canvas 只承担三个角色**：① `toImage` 的栅格化画板（主线程：游离 DOM → SVG 序列化 → `Image` → `<canvas>`，§8）；② `measureText` 度量器（`measurer-canvas.ts`，§5）；③ 为 `render.target` 预留的 `RenderTarget` 座位（`id:'canvas'`，当前无 Provider）。「缩略图/放映走 canvas」的旧口径删除；14 §5.4 对 offscreen-canvas Provider 的采纳被推翻。
- **可替换性验证**：M3 末用一个最小 canvas Provider（只画矩形/图片/单行文本）跑 `runRenderTargetConformance`，证明 `render.target` 契约不含 DOM 偏置；它不进入产品。
- **DX-1000 回退规则**（按序执行，依据 ADR-0021 修订 2，rulings §4.18 CO-01）：单页 1,000 元素（DX-1000）若不达标，① 先做合成层优化（独立合成层、`content-visibility`、减少滤镜与 `<tspan>`）；② 仍不达标，再做静态层栅格化（SVG/DOM 路线内的最后手段：会碰上 Web 字体问题并破坏一元素一 DOM 节点）；③ 仍不达标才**仅在查看/放映**启用 canvas Provider；编辑态始终 DOM/SVG。**对外门禁只有 DX-1000**：首页可见 ≤ 2.5 s、交互 ≥ 30 fps；原「≤ 200 ms」只是引擎内部的分解目标（场景构建 + 首次挂载），不作门禁（ADR-0021 修订 1，rulings §4.18 CO-02）。
- **文档内 SVG 只以图像上下文渲染**：`asvg:svgBlip`、SVG 媒体一律经 `<image href=blob:…>` 渲染（浏览器在图像上下文中不执行脚本、不加载外部资源）；禁止以 `innerHTML`/`insertAdjacentHTML`/`DOMParser` 把文档内容注入 DOM（09-08 TD-081）。
- **单位**：模型是 `Emu`；SVG 用户单位 = **px@96dpi**（1 px = 9525 EMU），`viewBox = 0 0 W H`（如 960×540），缩放用容器 `transform: scale(z)`，保持 SVG 内数值量级稳定（避免 EMU 级大数导致的精度/抗锯齿问题）。字号 `sz`（百分点）→ px = sz/100 × 96/72。
- **层叠**：每个 `PageView`（render-dom 的内部实现名；对外契约是 `RenderTarget.mount()` 返回的 `TargetHandle`，§2.1）三层容器：`master-layer` / `layout-layer` / `slide-layer`（各一 `<svg>`），上面再叠 `overlay-layer`（`<svg>` + 少量 HTML）与 `text-input-host`（隐藏）。母版/版式层对同版式的多个页共享 DOM 模板（`cloneNode(true)`）。

**PageView 的 DOM 分层**

```mermaid
flowchart TB
  surface[".cordex-surface：宿主元素内的 Surface"] --> page[".cordex-page：带 data-page-id，一个 PageView"]
  page --> master["svg.master：master-layer"]
  page --> layout["svg.layout：layout-layer"]
  page --> slide["svg.page：slide-layer"]
  page --> overlayLayer["svg.overlay：overlay-layer，svg + 少量 HTML"]
  page --> textHost["div.text-host：text-input-host，隐藏"]
  template["母版 / 版式 DOM 模板：同版式多页共享"] -. "cloneNode true" .-> master
  template -. "cloneNode true" .-> layout
```

怎么读：实线是 DOM 父子关系，五个子层按 master、layout、page、overlay、text-host 的顺序由底到顶叠放；虚线表示母版层与版式层由共享模板克隆而来，不逐页重渲。
依据：本文 §1 层叠、§3.1 职责。

---

## 2. `@cordexjs/engine-render`（iso）：契约与管线

### 2.1 贡献点（草案；ContributionPoint 机制见架构 03）

```ts
// 签名以 02 §4.13–4.16 与 40-modules/06 §2.5 为准（rulings §4.18 CO-19）；本块只作管线说明
// render.scene —— 文档类型把模型合成为 Scene（key = documentType；引擎对「幻灯片」无知，A5）
interface SceneProvider {
  readonly documentType: string
  build(unitScope: UnitScopeHandle, view: ViewDescriptor): Scene
  diff(changeSet: ChangeSetLike, prev: Scene): DirtySet               // 路径归类是垂直束的知识
}
interface Scene { id: string; size: { w: Emu; h: Emu }; nodes: SceneNode[]; background?: SceneNode }
interface SceneNode { id: NodeId; kind: string; bbox: Rect; transform: Transform; zIndex: number; children?: SceneNode[]; data: unknown; revision: number }
interface DirtySet { nodeIds: ReadonlySet<NodeId>; full: boolean; changed?: ReadonlyMap<NodeId, PathKey[]> }   // 必须被 paint 消费（A28）
// render.target —— 输出介质（key = id）
interface RenderTarget {
  readonly id: string                                                  // 'dom'（唯一实现）| 'canvas'（预留座位，M3 末仅以最小 Provider 验证契约，§1）
  mount(container: unknown, opts?: MountOptions): TargetHandle         // 每个已挂载页一个句柄；PageView/LayerHandle 是 render-dom 内部实现名
  paint(scene: Scene, dirty: DirtySet): void
  hitTest(point: Point): HitResult | null
  toImage?(scene: Scene, opts: ToImageOptions): Promise<Blob | Uint8Array>   // 只在主线程（§8）
  dispose(): void
}
interface TargetHandle { readonly pageId: NodeId; setTransform(zoom: number, pan: Point): void; setSize(size: Size): void; dispose(): void }
// render.element —— 按 `${targetId}:${kind}` 注册的元素渲染器；无状态查表项
interface ElementRenderer<TData = unknown> {
  readonly targetId: string
  readonly kind: string                                                // 'sp' | 'pic' | … | 第三方
  render(node: SceneNode & { data: TData }, ctx: RenderContext): ElementHandle
  update(handle: ElementHandle, node: SceneNode & { data: TData }): void   // 只对 DirtySet 中的节点调用（A28）
  dispose(handle: ElementHandle): void
}
// render.overlay —— 覆盖层贡献（选中框、手柄、远端光标、评论钉、参考线）
interface OverlayRenderer { readonly id: string; readonly zIndex: number; mount(ctx: OverlayContext, target: TargetHandle): OverlayInstance }
```

- 渲染器选择 = `Map<`${targetId}:${kind}`, ElementRenderer>` **查表**，无链式拦截（A30）。找不到渲染器 → `kind:'unknown'` 的占位渲染器（虚线框 + kind 文本），并 `errors.report('render.renderer_missing')` 一次/kind。
- 每个节点的 `render/update` 包在 try/catch：异常 → 该元素替换为错误占位符（红色虚线框），`errors.report('render.element_failed', {kind, elementId})`，**不**影响同页其他元素（A11；借鉴 pptx-renderer 的逐节点隔离）。

**元素渲染器查表与错误隔离**

```mermaid
flowchart LR
  node["待渲染节点：SceneNode.kind"] --> lookup{"查表 Map：targetId:kind → ElementRenderer"}
  lookup -- "命中" --> mount["render 或 update，包在 try/catch 内"]
  lookup -- "未命中" --> unknown["kind:'unknown' 占位渲染器：虚线框 + kind 文本"]
  unknown --> reportMissing["errors.report render.renderer_missing，每个 kind 一次"]
  mount -- "正常" --> done["该元素完成"]
  mount -- "抛错" --> errPlaceholder["替换为错误占位符：红色虚线框"]
  errPlaceholder --> reportFailed["errors.report render.element_failed，携带 kind、elementId"]
  errPlaceholder -. "不影响" .-> siblings["同页其他元素照常渲染"]
```

怎么读：选择渲染器是一次查表而非拦截链（A30）；两条失败路径都只替换当前元素并上报一次错误码，虚线强调同页其他元素不受影响（A11）。

### 2.2 帧管线

**帧管线：路径归类**

```mermaid
flowchart LR
  paths["ChangeSet.touched"] --> mark["SceneProvider.diff：路径前缀 → DirtySet 归类，垂直束实现"]
  mark -- "slides/S/shapes/E/…" --> r1["页 S 的 Scene：nodeIds 含 E"]
  mark -- "slides/S/ 下的 layoutId、background、order" --> r2["页 S 的 Scene：full"]
  mark -- "layouts/L/…" --> r3["所有 layoutId=L 的已挂载页，经反向索引"]
  mark -- "masters/M/… 或 themes/T/…" --> r4["所有相关页，经反向索引"]
```

怎么读：边上的文字是路径前缀（S、E、L、M、T 分别代表页、元素、版式、母版、主题 id），箭头指向归类出的 `DirtySet`；归类规则由 slide-render 的 `SceneProvider.diff` 提供，engine-render 不识别 `slides`。

**帧管线：一帧的执行顺序**

```mermaid
flowchart TB
  mark["invalidate DirtySet：来自 SceneProvider.diff"] --> request["FrameScheduler.request：mergeDirtySet 合并到下一帧，requestAnimationFrame，Node 下 setImmediate"]
  request -- "flush" --> loop{"for page in Viewport.visible ∩ dirty"}
  loop -- "不可见页" --> skip["只记脏、不渲染：虚拟化"]
  loop -- "可见且脏的页" --> invalidate["StyleCache.invalidate dirty：反向依赖索引 → 精确失效"]
  invalidate --> pageRender["RenderTarget.paint scene, dirty：逐节点 ElementRenderer.render / update / dispose"]
  pageRender -- "本帧所有页处理完后" --> notify["Thumbnails.notify dirtyPages：缩略图 Provider 自己去抖"]
  notify --> span["telemetry.span render.frame：pages、elements、ms"]
```

怎么读：自上而下是一次 flush 内的步骤；菱形按可见性分流，只有可见且脏的页进入失效与渲染，不可见页的脏标记保留到下次可见（§2.3）。

- **帧预算**：脚本 ≤ 8 ms/帧（留给浏览器样式/布局/绘制 ≥ 8 ms）；超过预算时 `FrameScheduler` 把剩余脏页顺延到下一帧（时间切片，按可见性优先级），不会掉帧到 < 30 fps。
- **A28 反制测试**（`engine-render/__tests__/dirty-consumed.test.ts`）：用 spy 渲染器挂 100 个元素，改 1 个元素的 1 个属性，断言 `update` 恰被调用 1 次且 `DirtySet.changed` 中该节点的路径等于该路径；改 `layoutId` 断言整页（`full`）重合成但已有元素句柄被**复用**（`render` 不再调用，只调 `update`）。
- **A29 反制测试**：`StyleCache` 上限 = 已挂载页的元素数 × 2，塞入 3× 后断言 `evicted` 计数 > 0 且命中率统计可读；`MediaCache` 同理（按字节 LRU，默认 256 MiB）。

### 2.3 Viewport 与虚拟化

- `Viewport`（UnitScope 服务 `render` 的一部分）：`zoom`、`scroll`、`mode: 'single' | 'continuous' | 'grid' | 'show'`、`visiblePages()`（含 overscan 1 页）。
- 只对可见页 `RenderTarget.mount`（得到该页的 `TargetHandle`）；离开视口 + 超时 5 s → `TargetHandle.dispose()`（DOM 释放，元素句柄 dispose），其脏记录保留为 `full`，下次可见时全量重建。
- 单页编辑模式下同时挂载的页 ≤ 3（当前 ± 1）；连续滚动模式 ≤ 6。缩略图侧栏的可见项 ≤ 12（见 §8）。

### 2.4 目录结构（`packages/engine-render/`）

文件级目录与文件职责以 [40-modules/06](../40-modules/06-layout-and-render-engine.md) §4–§5 为唯一源（2026-09-25 设计线拆分，本节原目录树删除）。本文只固定包级约束：iso（无 DOM 类型，rAF 经注入的 `Scheduler` 抽象）；依赖 `kernel`、`engine-layout`、`shared`；`plugin.ts` 以 `provide=['render']`（UnitScope）定义 `render.scene` / `render.target` / `render.element` / `render.overlay` 四个贡献点；`./testing` 子路径提供 `ManualScheduler`、`SpyRenderer`、`RecordingTarget` 与 `runRenderTargetConformance`（不设 ElementRenderer 契约套件，40-modules/06 G-8）。帧管线、视口与缓存的浏览器侧行为见 [50-frontend/05](../50-frontend/05-rendering-and-thumbnails.md) §2–§4、§13；契约套件的用例与运行矩阵见 [70-testing/02](../70-testing/02-contract-suites-and-pluggability.md) §7.1。

---

## 3. `@cordexjs/render-dom`（dom）：RenderTarget Provider

### 3.1 职责

- HTML/SVG 输出：`DomRenderTarget.mount()` 在宿主元素内创建 `.cordex-surface > .cordex-page[data-page-id] > (svg.master, svg.layout, svg.page, svg.overlay, div.text-host)`，返回该页的 `TargetHandle`；`DomSurface`/`PageView`/`LayerHandle` 是本包内部实现名，不进 `render.target` 契约（§14.1）。
- 图元 API（供垂直束渲染器使用，避免每个渲染器手写 DOM）：`svg.path()/rect()/image()/text()/group()/clipPath()/gradient()/pattern()`，返回带 `set(attrs)` 的薄句柄；属性 diff 由句柄做（只写变化的 attribute）。
- `FontFaceLoader`：把 `engine-layout` 的字体请求（`FontRequest{family, weight, style}`）解析为 `FontFace` 加载（嵌入字体 `fntdata` 由 ooxml-pptx 反混淆后以 `BlobRef` 提供；宿主字体经配置 URL），`document.fonts.load` 完成后触发 `layout/fonts-ready(families)` → 相关文本元素标脏重排。
- `MediaResolver`：`BlobRef` → `blob:` URL（`MediaCache` 持有，revoke 在淘汰/页卸载时；借鉴 pptx-renderer 的 Blob URL 生命周期）。
- `OverlayLayer` 与 `TextInputHost`（§6/§7）。

### 3.2 目录结构（`packages/render-dom/`）

文件级目录以 [40-modules/06](../40-modules/06-layout-and-render-engine.md) §4–§5 为唯一源（2026-09-25 设计线拆分，本节原目录树删除）。包级约束：dom；依赖 `engine-render`、`engine-layout`，**不依赖** `@cordexjs/design`（L5 不得依赖 L7，覆盖层主题色直接写 CSS 变量名字符串，rulings §4.18 FE-18）；`plugin.ts` 以 `inject=['render','layout']` 贡献 `render.target{ id:'dom' }`、`layout.measurer{ id:'canvas' }` 与 `render.overlay`（选区与手柄、远端光标、参考线、评论钉）；`DomSurface` / `PageView` / `LayerHandle` 只是内部实现名，不进契约（§14.1）。字体、媒体与覆盖层的浏览器侧实现见 [50-frontend/05](../50-frontend/05-rendering-and-thumbnails.md) §5、§7–§8；文本输入宿主见 §6 与 [50-frontend/06](../50-frontend/06-text-editing-and-ime.md)。

---

## 4. `@cordexjs/slide-render`（dom，垂直束）：页合成与元素渲染器

### 4.1 页合成（master → layout → slide）

1. `SlideSceneProvider`（`slide-render/scene/slide-scene-provider.ts`，实现 engine-render 的 `SceneProvider('slide')`）的 `build(unitScope, view)` 调 model-slide 的合成纯函数 `composeSlide`（架构 04，输入 `slides.resolved.*` 与 `layout` 服务），产出一个 `Scene`：母版/版式/页三层 = 同一个 `Scene`，节点带 `data.layer` 标签；已按 `showMasterSp`、占位符规则与 `(parentId, z)` 展开成绘制顺序。**占位符规则按 PowerPoint 行为**（2026-09-25 修订）：普通页上，母版与版式的**占位符一律不绘制**（它们只作为页上同类占位符的继承来源与空占位的提示文本来源），只绘制母版与版式的**非占位符形状**（受 `showMasterSp` 控制）；页上的占位符（含继承而来的几何与样式）由 slide 层绘制。原规则「页上有同 (type, idx) 占位符才遮蔽 layout/master 的对应占位符」作废——它会在普通页上画出版式的空占位符，与 PowerPoint 365 视觉基线系统性不符（PRD OF-20，rulings §4.19 D-TEST-INFRA），且使模板层依赖页内容、`LayerTemplateKey` 无法跨页共享。母版视图（ML-01）编辑母版 / 版式本身时，占位符作为被编辑对象绘制，不受本规则约束；`dependencies`（themeId、masterId、layoutId）用于反向索引。
2. 绘制由 dom target 的 `paint(scene, dirty)` 驱动：
   - `master`/`layout` 层：以 `(layoutId, showMasterSp, themeVersion)` 为键缓存**渲染后的 DOM 模板**（`LayerTemplateCache`，LRU 32 项，dom target 内部优化），新页挂载时 `cloneNode`；相关路径脏时失效并重渲一次、再广播给共享它的页。
   - `slide` 层：按节点 id 做 keyed reconcile：新增 → `ElementRenderer.render(node, ctx)`；删除 → `dispose(handle)`；`z`/`parentId` 变化 → 只移动 DOM 节点；属性变化 → `update(handle, node)`（`DirtySet.changed` 给出属性级精度）。
   - `background`：`Scene.background` 节点，单独的 `<rect>` + paint，属于整页（`full`）脏。
3. `diff(changeSet, prev)`：把 `ChangeSet.touched` 的 `StorePath` 归类为 `DirtySet`（这是垂直束的知识，engine-render 不认识 `slides`）。

**页合成与三层渲染**

```mermaid
flowchart TB
  compose["SlideSceneProvider.build：调 composeSlide，model-slide 纯函数"] --> composite["Scene：三层节点带 data.layer 标签，background 节点，dependencies 为 themeId / masterId / layoutId"]
  composite --> rules["已按 showMasterSp、占位符规则与 parentId、z 展开成绘制顺序：普通页上母版与版式的占位符一律不绘制，只画其非占位符形状"]
  rules --> renderer["dom RenderTarget.paint scene, dirty"]
  renderer --> tplLayers["master / layout 层"]
  renderer --> slideLayer["slide 层：按节点 id 做 keyed reconcile"]
  renderer --> bg["background 节点：单独 rect + paint，整页脏"]
  tplLayers --> tplCache["LayerTemplateCache：键为 layoutId、showMasterSp、themeVersion，LRU 32 项"]
  tplCache --> clone["新页挂载时 cloneNode"]
  tplCache --> invalidate["相关路径脏：失效并重渲一次，再广播给共享它的页"]
  slideLayer --> added["新增 → ElementRenderer.render"]
  slideLayer --> removed["删除 → dispose handle"]
  slideLayer --> moved["z 或 parentId 变化 → 只移动 DOM 节点"]
  slideLayer --> changed["属性变化 → update handle, node"]
```

怎么读：自上而下是一页从模型到 DOM 的合成路径；`Scene` 交给 dom target 的 `paint` 后分三路处理三类内容，模板层走缓存与克隆，slide 层走按 id 的最小化协调。模板层只含母版与版式的非占位符形状，与页内容无关，所以同一 `(layoutId, showMasterSp, themeVersion)` 的模板可在所有页间共享。

### 4.2 元素渲染器（`render.element` 贡献，target `dom`）

| kind | 内容 | 关键点 |
|---|---|---|
| `sp` | 几何 + 填充/线 + 文本 | `prstGeom` → `engine-layout` 的路径生成（含 adj 手柄）；`custGeom` 解析；文本走 §5 布局后由 `text-lines` 绘制 |
| `pic` | 图片 | `srcRect` 裁切、`stretch/tile`、几何裁切（图片形状）；EMF/WMF：M1 显示占位 + 诊断，**M2（P1）起经 emf-converter（Apache-2.0）在惰性 Worker chunk 中栅格化**为位图显示（chunk 不计入查看器 350 KB 基线；记录数/像素/耗时受 OF-24 上限约束；server-headless 用同一份代码），矢量渲染放 M4+；外链图片（`r:link`，仅 http(s)）默认自动加载，受部署配置 `externalResources`（`auto`\|`confirm`\|`never`）收紧，`never`/加载失败显示占位并记 degraded 原因 `external-resource-blocked`（rulings §4.15 Q7） |
| `grpSp` | 组合 | 只产生一个 `<g transform>`（chOff/chExt → 子坐标映射）；子元素由合成结果扁平化后各自渲染进该 `<g>` |
| `cxnSp` | 连接线 | 几何同 sp；端点由 `stCxn/endCxn` 解析到目标形状连接点（布局纯函数），目标移动时因依赖索引标脏 |
| `graphicFrame/table` | 表格 | 行列尺寸、合并单元格、表格样式（tblStyle）继承（04）、单元格文本走 §5 |
| `graphicFrame/chart` | 图表 | **按章程 D16**：M1–M2 `c:chart` 部件不透明保留，渲染器经 `ooxml-core/chartml` **只读解析**部件与缓存数据（`numCache`/`strCache`/轴/图例/标题）直接绘制 SVG（查看 SSIM ≥ 0.80，PRD OF-09）。M3 起数据建模与编辑，可编辑类型为**五类 bar / line / pie / area / scatter**（U-06），由 `slide-render-chart` 提供。`cx:chart`（chartex）：直接显示占位 + 诊断 `chartex-unsupported`，**不**渲染其 Fallback 文本 |
| SmartArt（`dgm`） | 保留不编辑 | `ooxml-core` M1 只读解析 `dsp:drawing` 部件（含 `dsp:txXfrm`），复用 `sp` 画笔渲染其形状与文本；drawing 部件缺失时才占位 + 诊断 |
| `graphicFrame/ole` | 保留不编辑 | 显示 `Ole.preview`（`mc:Fallback` 中的 `p:pic`，由 ooxml-pptx 导入时提取）走 `pic` 路径；预览为 EMF/WMF 时同 `pic` 行；无预览时才占位 |
| `unknown` | — | 由 engine-render 占位 |

所有渲染器都是**无状态查表项**：状态只在 `render()` 返回的 `ElementHandle` 里（DOM 句柄与上次节点 revision），渲染器对象本身不持有实例。

### 4.3 目录结构（`packages/slide-render/`）

文件级目录以 [40-modules/07](../40-modules/07-slide-rendering.md) §4–§5 为唯一源（2026-09-25 设计线拆分，本节原目录树删除）。包级约束：dom，垂直束；依赖 `model-slide`、`engine-render`、`render-dom`、`engine-layout`，以及 `ooxml-core`（仅用于只读解析 chartml 与 diagram drawing，rulings §4.15 Q7 修订 §4.11 C-28）；`plugin.ts` 以 `inject=['render','layout','slides']` 贡献 `render.element × N`、`render.scene`（SceneProvider `'slide'`）与缩略图 Provider。元素渲染器的错误隔离与降级、缩略图 Provider、放映渲染的浏览器侧行为见 [50-frontend/05](../50-frontend/05-rendering-and-thumbnails.md) §3、§9–§12 与 [50-frontend/10](../50-frontend/10-editor-shell-and-interaction.md) §9。

---

## 5. `@cordexjs/engine-layout`（iso）：度量与断行（ADR-0027）

### 5.1 策略：自己断行（layout-then-paint），度量器可插拔

- **为什么不用浏览器 CSS 排版文本**：PowerPoint 语义（`normAutofit` 的 `fontScale`/`lnSpcReduction`、`spAutoFit` 增高、`anchor`/`anchorCtr`、多栏 `numCol`、`wrap="none"`、缩进/悬挂/项目符号、`spcPct` 行距、东亚标点禁则、竖排）需要确定的几何来做命中、选区矩形、光标位置与缩略图一致性；CSS 排版的结果不可读取为行模型（只能用 Range 反推，代价高且不稳定），且服务端/客户端结果难以逐像素一致。
- **度量器 Definition**（`TextMeasurer`，贡献点 `layout.measurer`，key = id；签名以 40-modules/06 §2.5 为准）：`measure(text, font) → MeasureResult`（advance、ascent、descent、lineGap）、`supports(font)`，三个 Provider：
  - `canvas`（render-dom）：`OffscreenCanvas.measureText`，含实际字体回退行为，**客户端与 headless Chromium 都用它**，因此两端一致（同字体集）。
  - `node-font`（server-headless）：Node 端以 opentype/fontkit 一类库解析字体文件计算 advance（fontkit 只是实现手段，不是 Provider id），用于**无浏览器**的服务端路径（例如导出校验），标注为「近似一致」（无 shaping 差异保证）。
  - `fixed`（`engine-layout/testing`）：每字等宽的确定性度量，供单测使用。
- 断行算法：按 UAX#14 行断机会（`Intl.Segmenter` 或内置表）+ 东亚禁则；run 边界为字距重置点（与 PowerPoint 行为一致）；每行输出 `LineBox { y, ascent, descent, runs: [{ x, text, attrs }] }`。
- **一致性策略**：字体集受控（§5.3）+ 度量缓存键含 `fontKey + text`（按 word 缓存）+ 版本化的 `layoutAlgoVersion`（engine-layout 断行算法版本，与 ADR-0026 决策 5 同名）进入缩略图缓存键（服务端缩略图（640 px WebP）与客户端算法版本不一致时以客户端为准并触发重生成）。

### 5.2 API（草案）

```ts
interface LayoutService {                                 // ctx.layout（根作用域）
  layoutTextBody(body: TextBodyModel, box: Rect, style: ResolvedTextStyle, opts: { autofit: AutofitSpec }): TextLayout
  presetGeometry(name: string, adj: Record<string, number>, box: Rect): GeometryPath   // 187 种 prstGeom（编译期表）
  customGeometry(spec: CustomGeometrySpec, box: Rect): GeometryPath
  fonts: FontFallbackTable                                // 请求族 → 候选族（含度量兼容替身）
  measurer(): TextMeasurer                                // 当前 Provider（layout.measurer 贡献点）
}
interface TextLayout { lines: LineBox[]; contentHeight: number; overflow: boolean; fontScale: number; lnSpcReduction: number; caretMap: CaretMap }
```

### 5.3 字体回退表（客户端与服务端共用同一份 JSON）

| 请求 | 替身（度量兼容） | 说明 |
|---|---|---|
| Calibri | Carlito | 度量兼容开源字体（SIL OFL） |
| Cambria | Caladea | 同上 |
| Arial/Helvetica | Liberation Sans | 同上 |
| Times New Roman | Liberation Serif | 同上 |
| Courier New | Liberation Mono | 同上 |
| 微软雅黑/宋体/黑体 等 CJK | Noto Sans CJK SC / Noto Serif CJK SC | 度量不完全兼容，标注为 `approx` |
| 主题 `+mj-lt`/`+mn-lt`/`+mj-ea`/`+mn-ea` | 由 04 的主题解析替换为实际族后再查表 | — |

嵌入字体（`ppt/fonts/*.fntdata`）优先于回退表，单个 ≤ 20 MB、总计 ≤ 60 MB（PRD OF-17）；`fsType` 为受限（restricted / preview & print）的嵌入字体**只用于只读渲染**（查看、放映、缩略图），进入编辑态的文本框改用回退字体（rulings §4.15 Q7）；许可证不允许再分发的字体不会进入服务端字体包（运维清单）。

### 5.4 目录结构（`packages/engine-layout/`）

文件级目录以 [40-modules/06](../40-modules/06-layout-and-render-engine.md) §4–§5 为唯一源（2026-09-25 设计线拆分，本节原目录树删除）。包级约束：iso（`Intl.Segmenter` 可用性检测 + 内置回退表）；只依赖 `shared`；`plugin.ts` 以 `provide=['layout']` 定义 `layout.measurer` 贡献点，缺 Provider 时停在 PENDING（符合 primer）；187 种 `prstGeom` 公式表由 tooling 从 `presetShapeDefinitions.xml` 生成；`./testing` 提供 `FixedWidthMeasurer`（Provider id `fixed`）与 `runTextMeasurerConformance`（用例见 [70-testing/02](../70-testing/02-contract-suites-and-pluggability.md) §7.2）。度量与断行、字体供给的浏览器侧行为见 [50-frontend/05](../50-frontend/05-rendering-and-thumbnails.md) §6–§7。

---

## 6. 文本编辑宿主（ADR-0028）

### 6.1 决策：**单一隐藏 `textarea` + 自绘光标/选区**，不用每个文本框 `contenteditable`

决策与取舍以 [ADR-0028](adr/0028-text-editing-host.md) 为准：渲染完全由自有断行（§5）控制，编辑态与只读态像素一致；输入事件直接转为 `text.insert/delete/format` Mutation，没有第二份编辑缓冲（A32）；IME 经 `compositionstart/update/end` 与 `beforeinput`（`insertCompositionText`）完整支持，组合中的文字只进瞬态覆盖层，`compositionend` 才写一次 Store；a11y 以镜像补足（textarea 值 = 当前段落文本，只读时暴露 `role=document` 语义树），局限是屏幕阅读器按段落朗读（Google Slides 同类方案）。`TextInputHost` 是可替换 Definition，Provider `hidden-textarea`（默认）与 `contenteditable-mirror`（备选），R-M2-1 spike 后定稿（§14.1）。

### 6.2 事件 → Mutation 流

进入与退出编辑态、事件分流与意图链、IME 组合与候选窗定位、光标与选区、重排与 autofit 回写、表格单元格与备注、协同下的文本以及 R-M2-1 spike 的验收矩阵，唯一源是 [50-frontend/06](../50-frontend/06-text-editing-and-ime.md)（2026-09-25 设计线拆分，原对比表与事件流图迁出）。跨端约束保留三条：

- `TextInputHost` 只产出中性编辑意图（`TextEditIntent`），把意图变成 Mutation 并调用 `commands.execute` 是上层（slide-ui）的职责，渲染层保持文档类型盲。
- 光标位置 = `StablePosition`（06 §2.2）→ `CaretMap` → 像素；远端光标同理（presence）。
- 文本编辑期间只重排被编辑的 txBody（元素级脏），autofit 迭代上限 6 次；键入 → 屏幕的预算见 §9。

---

## 7. 命中测试与覆盖层

命中链、覆盖层与远端光标的实现唯一源是 [50-frontend/05](../50-frontend/05-rendering-and-thumbnails.md) §5（画布交互见 [50-frontend/10](../50-frontend/10-editor-shell-and-interaction.md) §7）。跨端约束保留三条：

- **命中链**：`ctx.bail('render/hit-test', point, ctx)`——覆盖层（手柄 > 评论钉 > 远端光标标签）优先接管；无人接管时 `RenderTarget.hitTest(point)` 先用 dom 的 `elementFromPoint → data-cordex-node`，几何命中（视口逆变换、`z` 逆序、旋转逆变换、精确路径采样）只作回退（§14.1）；组合的选择规则由交互层决定。
- **覆盖层不参与内容脏区**：覆盖层订阅 `selection`、`presence.remotes`、`comments` 服务等各自数据源，独立的 `overlay` 层重绘不触发内容渲染（测试：改变选区不会调用任何 `ElementRenderer.update`）。
- **远端光标**：`caret.anchor/head`（RelativePosition）→ `store.resolveStablePosition` → 像素；目标不可见时只在页缩略图显示头像。

---

## 8. 缩略图与放映模式

缩略图 Provider 的选用、`raster` 的 Web 字体 spike 与 DX-1000 回退的唯一源是 [50-frontend/05](../50-frontend/05-rendering-and-thumbnails.md) §10、§13；放映舞台见 [50-frontend/10](../50-frontend/10-editor-shell-and-interaction.md) §9 与 50-frontend/05 §12。跨端口径：

| 来源 | 用途 | 里程碑 |
|---|---|---|
| `dom-scaled`（缩放 DOM 克隆） | 可见缩略图的唯一方案；可见项 ≤ 12 个（`maxMounted`），模板层共享 | M1 起 |
| `raster`（主线程 `toImage`） | 复制为图片、导出单页 PNG；不做 Worker 版本；Web 字体在图像上下文不可用列为 M2 位图 spike，结论前不用于封面与批量 PNG | M2 |
| 包内封面 | 文档列表卡片过渡封面：服务端导入时取 `docProps/thumbnail.jpeg`（只做 JPEG 头校验不解码），标 `provisional`；无该部件显示占位 | M2（随服务端导入，rulings §4.19 D-M2-CONTENT） |
| `server-png`（ADR-0026） | 文档列表封面、全览网格、批量 PNG、分享预览：renderer sidecar 生成 640 px WebP（按需 1280 px），按页内容哈希失效；客户端读取为 `ETag = contentHash` + `private, no-cache`；本地脏页在图到达前用 `dom-scaled` 兜底 | M3 前半段 |

- offscreen-canvas 缩略图 Provider 已被推翻（rulings §4.15 Q4），canvas 只作 `raster` 的栅格画板。
- 放映：`Viewport.mode='show'` + Fullscreen API，渲染同一 Surface（DOM/SVG），不走 canvas、不播放动画/切换（Q7）；静态场景全部元素可见，放映按主动画序列的可见性终态显示（`p:timing` 只读解析，M2 P1）；预留 `slide.showTransition` 贡献点（M4+）。

---

## 9. 性能预算与测量方式

渲染侧预算的数值（首页可见、键入到玻璃、拖拽与缩放帧率、切页、单属性变更、内存与 MediaCache、缩略图刷新）以 [50-frontend/13](../50-frontend/13-performance-and-bundling.md) §2–§5、§12 为唯一源；测量方法、`test/perf/budgets.json` 的 `gate` / `target` 与 `envelope` / `ceiling` 两档、噪声控制与门禁规则以 [70-testing/09](../70-testing/09-performance-and-capacity.md) 为唯一源（2026-09-25 设计线拆分，原预算表迁出）。本文保留两条跨端口径：

- 门禁值取 PRD NF-01（RM-A，p75/p95），本文与 50/13 的更严值只作 `target`（§14.6）。
- 300 MB 客户端堆预算只对性能保证包络（D200 ≈ 6,000 元素）承诺；系统天花板 20,000 元素时只保证「能打开、能编辑、不崩」，DX-20K 参考文稿只做监测、不设门禁（rulings §4.15 Q5）。

---

## 10. 服务端 headless 渲染路径（Q8，ADR-0026）

renderer sidecar、内部 RPC（传输、Ed25519 签名、注入清单、超时与池）与缩略图 / PDF 编排的唯一源是 [60-backend/06](../60-backend/06-modules-jobs-import-export-thumbnails.md) §8–§11（决策 SG-01）；`/render` 页的前端职责与 **ready 判据唯一源**是 [50-frontend/12](../50-frontend/12-viewer-embedding-and-render-page.md) §11；决策见 ADR-0026 与 ADR-0037。跨端约束：

- **注入是唯一路径**（rulings §4.18 BE-04）：`local`（worker 内 Playwright `page.evaluate`）与 `remote`（renderer sidecar 收到 RPC 后在页内调用）都由编排方调用 `window.__cordex.inject` 注入 state、资源与字体；`/render` 页零外呼，查询参数只带 `renderId` 作日志关联。机械验证：两种模式各跑一次 e2e，断言 `/render` 页网络请求数为 0。
- **ready 判据**（rulings §4.18 FE-09）：关闭惰性加载；所请求页全部 `render/page-mounted` ∧ 这些页的字体请求全部结算 ∧ 此后一次 `render/frame` 的 `pendingDirty` 为 0（10 §11.1）；注入等待超时（默认 60 s）与每页 10 s 渲染超时分开计。
- **同一渲染代码、同一字体包、同一布局算法版本** ⇒ 与客户端像素级一致（视觉 oracle 同时校验两端，70-testing/04）。
- **失效按页内容哈希**：输入 = 页子树 + 版式/母版/主题依赖闭包 + 媒体 BlobRef + slideSize + 页序号 + 内嵌字体集合 + `layoutAlgoVersion` + `fontProfile`；外链一律占位且不计入；压缩之后只把哈希变化的页入队。
- **安全与隔离**：renderer 零出站（服务端永不加载外链）、非 root、沙箱、无凭据，只接受 worker 的鉴权 RPC；不用 sharp（D13），服务端对不可信图片不解码。
- **里程碑**：M2 只有服务端导入时取出的包内过渡封面（不渲染）；renderer 缩略图 M3 前半段，PDF M3 后半段（§14.7）。

---

## 11. 与 Univer 的对照

| 编号 | Univer | 本项目 |
|---|---|---|
| A1/A5 | engine-render 66% 是产品组件；`IRange` 进通用契约 | engine-render 只有契约/调度/缓存/命中；元素渲染全在垂直束；契约只认 `kind`、几何盒、路径 |
| A4 | 布局基类跨三包继承 | engine-layout 纯函数 + TextMeasurer Definition；模型包不 import 引擎 |
| A28 | 脏矩形无人读 | SceneProvider.diff 产出 DirtySet → RenderTarget.paint 消费；反制测试 |
| A29 | 缓存淘汰未接线 | 四处 LRU：StyleCache / MediaCache / measure-cache（engine 侧）+ LayerTemplateCache（slide-render 侧），均有淘汰测试与统计指标（2026-09-18 由「三处」改，14 §1 C-12） |
| A30 | 热路径穿 20 个拦截器 | 渲染器查表；`waterfall` 在 engine-render/render-dom/slide-render 中被 lint 禁止（由 09-02 承接） |
| A11 | 一崩全崩 | 元素级 try/catch + 占位符 + errors 上报 |
| A32 | 三模型两边界 | 隐藏输入直写 Store；组合文本为瞬态覆盖层 |

---

## 12. 待决事项

| # | 事项 | 默认 | 决策人 |
|---|---|---|---|
| R1 | ~~图表 M3 的最小可编辑渲染范围~~ | **已结案**（rulings §4.12 U-06、§4.15 Q7）：可编辑五类 bar / line / pie / area / scatter；其余类型按 D16 只读解析渲染，chartex 占位 | — |
| R2 | a11y 目标级别（WCAG 2.2 AA 的哪些条款在 M2 必达） | 键盘可达 + 基本朗读 | 产品/设计 |
| R3 | ~~服务端字体包清单与许可~~ | **已结案**（章程 Q19，rulings §4.16）：内置 Noto（含 CJK）+ Liberation + Carlito/Caladea（均开源），随 renderer 镜像发布；**部署方可挂载自有授权字体目录**；不内置商业字体 | — |
| R4 | headless 渲染页放在 apps/web 的 `/render` 路由还是独立 `apps/render-page` | apps/web 路由（无章程改动） | 架构 A |
| R5 | ~~缩略图默认 Provider 在 M3 是否切到 server-png~~ | **已结案**（rulings §4.15 Q4/Q8）：可见项 dom-scaled；M2 封面取包内 thumbnail.jpeg；M3 起列表封面/网格/批量走 server-png（renderer sidecar） | — |

## 13. 对章程的异议/建议

- **S5（由章程 v0.2 的 `package.json#cordex.iso` 逐包字段解决）**：`engine-render` 为 `iso`，`render-dom` 为 `dom`。
- **S6（已批准，进入章程 v0.2）**：`slide-render` 的图表渲染在 M3 拆为 `@cordexjs/slide-render-chart`（V-render，dom，可选插件，惰性 ≤ 400 KB），避免图表库体积进入基础束（A33）。

## 术语补充

| 术语 | 定义 |
|---|---|
| TargetHandle | `RenderTarget.mount()` 为每个已挂载页返回的句柄；dom target 内部以 Surface / PageView / LayerHandle 实现 |
| DirtySet | `SceneProvider.diff` 产出的脏节点集合（`nodeIds`、`full`、可选 `changed`；旧名 DirtyRegion） |
| TextMeasurer | 文本度量 Provider（`layout.measurer`：`canvas`、`node-font`、`fixed`；旧名 Measurer） |
| LayerTemplate | 母版/版式层渲染结果的可克隆 DOM 模板 |
| CaretMap | 文本偏移 ↔ 像素的双向映射 |
| Overlay | 不属于文档内容的覆盖层（选中、手柄、presence、评论钉） |

---

## 14. v0.2 补充：与架构 02/04 契约的对齐、PRD（NF-01/ED/PD/SV）条目的承接、章程 v0.2 裁决

> 追加于 A 线 02/04 与产品线落盘之后。签名以 02/04 为准，本文负责管线与性能；凡与前文冲突处以本节为准。2026-09-25 起 §0–§7 正文、代码块、目录树与图已按 §14.1 换用新名（rulings §4.18 CO-19），§14.1 表保留作旧名对照。

### 14.1 术语与签名对齐（02 §4.13–4.16、04 §10）

| 本文 v0.1 | 02/04（以之为准） | 说明 |
|---|---|---|
| `PageRenderer`（合成 + classify + dependencies） | `SceneProvider`（贡献点 `render.scene`，key = documentType）：`build(unitScope, view) → Scene`、`diff(changeSet, prev) → DirtySet` | `slide-render/scene/slide-scene-provider.ts` 实现 `SceneProvider('slide')`，输入 `slides.resolved.*` 与 `layout` 服务 |
| `CompositeSlide` / 元素 | `Scene` / `SceneNode{ id, kind, bbox, transform, zIndex, children?, data, revision }` | 母版/版式/页三层 = 一个 `Scene`，节点带 `data.layer` 标签，便于 dom target 做模板层缓存 |
| `DirtyRegion{ page, elementIds }` | `DirtySet{ nodeIds, full }` | **对 A 线的增补请求**：`DirtySet` 增加可选 `changed?: Map<NodeId, PathKey[]>`；否则渲染器只能整节点重绘（仍满足 A28「只重绘该形状」，但丢失属性级最小更新） |
| `ElementRenderer.mount` / `ElementInstance.update(model, changed, style)` | `ElementRenderer<TData>{ targetId, kind, render(node, ctx) → ElementHandle, update(handle, node), dispose(handle) }`，key `${targetId}:${kind}` | `node.data` = 已解析样式 + 布局输入，由 SceneProvider 产出 |
| `Surface` / `PageView` / `LayerHandle` | `RenderTarget{ mount(container) → TargetHandle, paint(scene, dirty), hitTest, toImage?, dispose }` | 每个已挂载页一个 `TargetHandle`（虚拟化窗口 ≤ 3/6）；模板层克隆是 dom target 内部优化 |
| `Measurer` / 服务 `measurer` | `TextMeasurer`，贡献点 `layout.measurer`（key = id：`canvas`、`node-font`、`fixed`） | `ctx.layout.measurer()` 取当前 Provider；原 Provider `fontkit` 并入 `node-font`（fontkit 只是实现说明）；本文正文已直接用 `TextMeasurer`（CO-19） |
| 事件 `render/frame`、`render/element-error` | 总编排定稿：cordis 事件 `render/frame(unitId, stats)`（进程内消费）+ 遥测事件 `perf/frame`（由前者派生，10 §3.4）；`render/element-failed`（保留）、`render/first-paint`、`render/element-degraded`、`render/font-fallback`；02 的 `render/painted` 弃用 | `render/frame` 每帧一次，只供进程内订阅（渲染统计、devtools、缩略图去抖）；对外只暴露 `perf/frame` 遥测事件（抽样）与 `render/first-paint`；本文各处 `render/element-error` 读作 `render/element-failed` |
| 命中：几何优先 | dom target：`elementFromPoint → data-cordex-node`，几何回退（旋转盒/组合） | 契约 `hitTest(point) → HitResult{ nodeId, region, local }` 不变；`bail` 链 overlay → target |
| 隐藏 `textarea` 宿主 | 02 `render-dom/layers/ime-host.ts` 写作 contenteditable | 由 ADR-0028 决定：`TextInputHost` 为可替换 Definition，Provider `hidden-textarea`（默认）与 `contenteditable-mirror`（备选），spike 后定稿（R-M2-1） |
| 缩略图 `dom-scaled` | `RenderTarget.toImage`（SVG 序列化 → Image → Canvas）用于客户端 PNG 导出 | `toImage` **只在主线程**执行（rulings §4.15 Q4），必须把 `blob:` 图片内联为 data URI（SVG-as-image 不允许外链）；Web 字体在图像上下文不可用列为 M2 spike；可见缩略图始终用 `dom-scaled`；封面与批量 PNG 在 spike 结论前走 M2 包内封面 / M3 server-png（renderer sidecar，ADR-0026） |
| 贡献点 id | camelCase（章程 v0.2）：`render.target`、`render.element`、`render.scene`、`render.overlay`、`layout.measurer`、`slide.shapeKind`、`slide.showTransition` | 本文命名已符合 |

### 14.2 打开管线：Worker 解析、分片加载与主线程预算（NF-01）

浏览器侧的打开流程（Worker 分批回传、首批装载与后台追加、跳转抢占、进度 UI 与 `unitLoaded` 约束的入口表）以 [50-frontend/04](../50-frontend/04-document-commands-and-undo.md) §2 为唯一源，打开路径的预算分解以 [50-frontend/13](../50-frontend/13-performance-and-bundling.md) §2 为准（2026-09-25 设计线拆分，原时序图迁出）。本节保留契约与跨端约束：

- **包络先于装载**：Worker 在回传首批之前完成规模包络计数（页数、单页元素、总元素），超系统天花板整体拒绝（`format.quota_exceeded`），不会装到一半才失败（rulings §4.18 CO-12）。
- **首批装载、后台追加**（CO-12）：首批 `store.load` 后立即发 `unit/opened`（可渲染、可编辑）；后续批次以 origin `system('import')`（04 的 Origin 定义）追加，只新增实体键、不改已有键，不入撤销栈，ooxml-core 的导出脏部件追踪（DirtyTracker）忽略该来源（打开 200 页后零编辑导出 = 零脏部件）；全部到齐后发 `unit/loaded`（已登记进事件表）。`loaded` 之前，全选、查找替换、导出、跨页重排等全文类命令等待或禁用（M-03 命令守卫）。契约落点：40-modules/02 的 `FormatCodec.importProgressive() → ProgressiveImport{ first, batches, prioritize, cancel, done }` 与 `units.prioritize(unitId, entityId)` / `units.whenLoaded`；40-modules/04 的 `ooxml-pptx` `infrastructure/import/import.worker.ts` 与 `batch-protocol.ts`（消息 `start / batch / prioritize / cancel / done / error`）。
- **跳转抢占**（rulings §4.18 CO-11）：「未解析页」指 Worker 尚未解析到的页，只重排主线程装载队列解决不了；主线程发 `prioritize{ slideId }` 给 Worker，Worker 完成当前页后先解析该页所在批次，主线程同时把已解析未装载的批次提到装载队首。
- **Worker 只做纯计算**且不持有可写模型（A31/D5）：解析结果进入主线程 Store；导出同理，`formats.export` 在 Worker 中对 `store.exportSnapshot()` 的结构化克隆副本运行（NF-01 1.4「导出期间 UI 可编辑」），基线包字节由 Worker 持有。无 Worker 环境（旧宿主、Node 主线程）下同一代码在主线程分片执行，行为等价只是更慢。
- **协同模式不走本路径**：协同打开时 Y 状态由 HTTP 快照 bootstrap（06 §9.1），不经 Worker 分批解析。

### 14.3 连接符路径重算（ED-28）

- M2：`cxnSp` 端点由 `stCxn/endCxn{ id, idx }` 解析到目标形状 `cxnLst` 连接点（`engine-layout/geometry` 从预设几何表得到连接点坐标与法向）；SceneProvider 维护「连接符 → 目标形状」依赖索引，目标 `xfrm` 变化 → 连接符节点进入 `DirtySet`；直线连接符端点跟随。
- M3：`engine-layout/geometry/connector-routing.ts`：`bentConnector2–5` / `curvedConnector2–5` 的调整值（`adj1…`）按 PowerPoint 规则由两端连接点坐标与法向重算（纯函数）；结果由命令层在端点变化时作为 Mutation 写回 `geom.adj`（导出一致）。预算：≤ 1 ms/连接符；每页 ≤ 50 连接符。

### 14.4 图表与内嵌工作簿（PD-06；S6 已批准：`@cordexjs/slide-render-chart`，V-render，dom，惰性 ≤ 400 KB）

- **决策口径**：M1–M2（章程 D16）图表部件不透明保留，渲染器经 `ooxml-core/chartml` 只读解析部件与缓存数据后绘制 SVG（查看 SSIM ≥ 0.80，OF-09），内嵌 `.xlsx` 原样保留，`cx:chart`（chartex）占位 + `chartex-unsupported` 诊断；M3 由 `slide-render-chart` 渲染并编辑五类 bar / line / pie / area / scatter（A-11、U-06），编辑数据时写图表数据缓存（`c:numCache/strCache`）并把图表部件与其 `embeddings/*.xlsx` 标脏，默认「重生成最小内嵌工作簿」（单工作表：类别列 + 序列列，与 `c:f` 引用一致），数据未变则原字节回写；工作簿生成器归 `ooxml-core` / `ooxml-pptx`。
- **落点**：图表渲染器的占位、惰性加载与降级状态见 [50-frontend/05](../50-frontend/05-rendering-and-thumbnails.md) §9，图表 chunk 的触发与体积预算见 [50-frontend/13](../50-frontend/13-performance-and-bundling.md) §6，文件落点见 40-modules/07（2026-09-25 设计线拆分）。

### 14.5 服务端渲染与分层规则（章程 v0.2 层号编码）

`server-headless`（`package.json#cordex = { layer: 'LS', iso: 'node' }`）允许依赖 `engine-layout` 与 `engine-render` 的 **iso** 契约（L5），**不得** import `render-dom`（dom）；缩略图/PDF 的实际绘制发生在 headless Chromium 加载的 `apps/web` `/render` 路由页面内（ADR-0026），`server-headless` 只编排；Chromium 运行在独立 renderer sidecar（`CORDEX_ROLE=renderer`，零出站、无凭据），`/render` 静态包内置于 renderer 镜像，state 与资源经鉴权内部 RPC 注入（§10，rulings §4.15 Q8/Q10）。slide-render 允许依赖 `ooxml-core` 仅用于只读解析 chartml 与 diagram drawing（rulings §4.15 Q7 修订 §4.11 C-28）。

### 14.6 性能预算：与 PRD NF-01 的对照（差异以本文技术判断为准并注明）

PRD NF-01 门禁值与更严 `target` 的逐项对照（首页可见与可交互、缩略图就绪、后台解析、跳页、主线程长任务、帧率、键入与 IME 延迟、命令与撤销、命中与吸附、重绘范围、内存、导出、体积、搜索替换与主题切换）以 [50-frontend/13](../50-frontend/13-performance-and-bundling.md) §1、§12 为唯一源；`test/perf/budgets.json` 的汇编、一致性检查与门禁规则以 [70-testing/09](../70-testing/09-performance-and-capacity.md) §2、§10 为准（2026-09-25 设计线拆分，原对照表迁出）。本文保留三条技术判断：

- 键入延迟（p50 ≤ 16 / p95 ≤ 33 ms）与已解析页跳转（≤ 50 ms）取比 PRD 更严的 `target`：自绘文本行的重排只涉及一个 txBody，RM-A 可达；PRD 值为 `gate`。
- 客户端 pptx 编码在 Worker 中对快照副本运行（§14.2），满足「导出期间可编辑」；PNG 在 SVG 路线下无法在 Worker 内完成（需要 DOM 布局与序列化），单页 PNG 走主线程 `toImage` 并按页分片（每片 ≤ 50 ms），全量 PNG 自 M3 起走 server-png（rulings §4.15 Q4）；M2 位图 spike 结论前，客户端 PNG 预算只对「单页、无 Web 字体依赖」场景门禁。
- 内存拆成可分别测量的两项（heap ≤ 300 MB + MediaCache ≤ 256 MiB），总量在 PRD 700 MB 内；20 次打开 / 关闭 heap 增长 ≤ 5%、`getEffects()` 为空、blob URL 泄漏 0。

### 14.7 服务端 PDF（PD-16 / SV-02）

**M3 后半段**交付，与缩略图共用 renderer 池、分队列：renderer sidecar 中的 headless Chromium 加载 `/render?mode=print` 后按幻灯片尺寸 `page.pdf(...)`，字体由 Chromium 子集嵌入；渲染代码与客户端一致，度量器为 Chromium canvas（ADR-0027 补充）；自研矢量 PDF 为后续（PD-16 裁决）。队列、RPC 字段、超时与重试的唯一源是 [60-backend/06](../60-backend/06-modules-jobs-import-export-thumbnails.md) §1、§7.2、§10；D50 ≤ 10 s（p95）的测量见 [70-testing/09](../70-testing/09-performance-and-capacity.md) §6，与 PowerPoint 导出 PDF 的逐页 SSIM ≥ 0.85 见 [70-testing/04](../70-testing/04-visual-oracle.md) §1（2026-09-25 设计线拆分）。
