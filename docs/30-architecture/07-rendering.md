> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-18（§11 按 14 §1 C-12 改「三处 LRU」为「四处」） | 依赖：charter v0.1

# 07 渲染（Rendering）：DOM/SVG 管线、贡献点运行时、布局引擎、脏区、命中测试、文本编辑宿主、缩略图、性能预算、服务端 headless

> 读者：实现 `@oce/engine-layout`、`@oce/engine-render`、`@oce/render-dom`、`@oce/slide-render`、`@oce/server-headless`（缩略图部分）的工程师。
> 章程锚点：§2.3（不做 Canvas 优先）、§5.2 L5/L6 包边界、§6.2 ADR-0021、§10 Q4/Q8、Univer A1/A4/A5（引擎对文档类型盲）、A28（脏区必须被消费）、A29（缓存淘汰必须接线）、A30（渲染热路径无拦截链）、A32（无第二份编辑缓冲）、A11（逐元素错误隔离）。
> 相关 ADR：0021（渲染介质）、0026（headless 渲染与缩略图）、0027（文本度量策略）、0028（文本编辑宿主）。
> 样式继承链解析（Element→Placeholder→Layout→Master→Theme）是 model-slide 的纯函数，见架构 04；本文只定义渲染层如何**缓存与失效**它的结果。

---

## 0. 一页总览

```
 store.observe(ChangeSet.paths)                                   viewport / selection / presence 变化
        │                                                                     │
        ▼                                                                     ▼
 ┌─────────────────────── engine-render（iso，对幻灯片无知） ─────────────────────────────┐
 │ DirtyTracker ── paths → DirtyRegion{unitId, pageId, elementIds|'page'|'all', reason} │
 │ FrameScheduler ── rAF/宏任务合并 → 一帧一次 flush（帧预算 8 ms 脚本）                  │
 │ StyleCache ── (pageId, elementId) → 已解析样式，反向依赖索引驱动失效，LRU 淘汰       │
 │ Viewport ── 缩放/滚动/可见页集合（虚拟化）                                            │
 │ HitTester ── bail 事件链（覆盖层优先）→ 几何命中（纯函数）                             │
 │ 贡献点 render.target（RenderTarget）· render.element（ElementRenderer）· render.overlay │
 └───────────────────────────────────────────────────────────────────────────────────────┘
        │ 查表（kind, target）→ ElementRenderer                          │
        ▼                                                                 ▼
 ┌── render-dom（dom）───────────────────────┐    ┌── slide-render（dom，垂直束）────────────────────┐
 │ DomRenderTarget：Surface/Layer/PageView    │    │ 页合成：composeSlide()（04）→ master/layout 层缓存 │
 │ SVG 图元 API（path/fill/stroke/clip/text）  │    │ ElementRenderer：sp/pic/grpSp/cxnSp/graphicFrame  │
 │ OverlayLayer：选中框/手柄/远端光标/评论钉    │    │ 缩略图 Provider：dom-scaled / server-png           │
 │ TextInputHost：隐藏 textarea + IME + 自绘光标│    │ 放映模式                                          │
 │ FontFaceLoader、MediaCache(LRU, Blob URL)   │    │                                                   │
 └───────────────────────────────────────────┘    └───────────────────────────────────────────────────┘
        ▲
 engine-layout（iso）：文本度量与断行（Measurer 可插拔）、prstGeom→path、单位换算、字体回退表
```

---

## 1. 渲染介质决策与坐标系（ADR-0021）

- **主画布 = SVG（图形）+ 自绘文本行（SVG `<text>`）**，容器为 HTML。选 SVG 而非 Canvas：任意缩放清晰、DOM 可检查/可测试（Playwright 断言节点属性）、a11y 有挂点、插件贡献一个 kind 的渲染器只需产出 SVG 节点、无自绘命中/无重绘管理负担。Canvas 保留为 `RenderTarget` 的可选 Provider（缩略图栅格化、放映）。
- **单位**：模型是 `Emu`；SVG 用户单位 = **px@96dpi**（1 px = 9525 EMU），`viewBox = 0 0 W H`（如 960×540），缩放用容器 `transform: scale(z)`，保持 SVG 内数值量级稳定（避免 EMU 级大数导致的精度/抗锯齿问题）。字号 `sz`（百分点）→ px = sz/100 × 96/72。
- **层叠**：每个 `PageView` 三层容器：`master-layer` / `layout-layer` / `slide-layer`（各一 `<svg>`），上面再叠 `overlay-layer`（`<svg>` + 少量 HTML）与 `text-input-host`（隐藏）。母版/版式层对同版式的多个页共享 DOM 模板（`cloneNode(true)`）。

---

## 2. `@oce/engine-render`（iso）：契约与管线

### 2.1 贡献点（草案；ContributionPoint 机制见架构 03）

```ts
// render.target —— 输出介质
interface RenderTarget {
  id: 'dom' | 'canvas' | string
  createSurface(host: unknown, opts: SurfaceOptions): Surface        // dom: host 为 HTMLElement；canvas: OffscreenCanvas
}
interface Surface {
  mountPage(pageId: PageId, layers: readonly LayerSpec[]): PageView
  unmountPage(pageId: PageId): void
  readonly pages: ReadonlyMap<PageId, PageView>
  dispose(): void
}
interface PageView {
  layer(id: LayerId): LayerHandle                                    // 'master' | 'layout' | 'page' | 'overlay'
  setTransform(scale: number, offset: Point): void
  setSize(size: Size): void
}
// render.element —— 按 kind 注册的元素渲染器；引擎对 kind 无知（A5）
interface ElementRenderer<TModel = unknown, TStyle = unknown> {
  kind: string                                                        // 'sp' | 'pic' | … | 第三方
  target: RenderTarget['id']
  mount(ctx: ElementRenderContext<TStyle>, model: TModel, layer: LayerHandle): ElementInstance<TModel>
}
interface ElementInstance<TModel> {
  update(model: TModel, changed: ReadonlySet<PathKey>, style: unknown): void   // 只收到该元素的脏路径（A28）
  hitTest?(point: Point): boolean                                              // 可选的精确命中（否则用几何盒）
  dispose(): void
}
// render.overlay —— 覆盖层贡献（选中框、手柄、远端光标、评论钉、参考线）
interface OverlayRenderer { id: string; zIndex: number; mount(ctx: OverlayContext, layer: LayerHandle): OverlayInstance }
```

- 渲染器选择 = `Map<`${kind}/${target}`, ElementRenderer>` **查表**，无链式拦截（A30）。找不到渲染器 → `kind:'unknown'` 的占位渲染器（虚线框 + kind 文本），并 `errors.report('render.renderer_missing')` 一次/kind。
- 每个元素 `mount/update` 包在 try/catch：异常 → 该元素替换为错误占位符（红色虚线框），`errors.report('render.element_failed', {kind, elementId})`，**不**影响同页其他元素（A11；借鉴 pptx-renderer 的逐节点隔离）。

### 2.2 帧管线

```
ChangeSet.paths ──► DirtyTracker.mark(paths)          路径前缀 → DirtyRegion 归类：
                     │                                  slides/<S>/shapes/<E>/… → {page S, element E}
                     │                                  slides/<S>/(layoutId|background|order) → {page S, 'page'}
                     │                                  layouts/<L>/… → 所有 layoutId=L 的已挂载页（反向索引）
                     │                                  masters/<M>|themes/<T>/… → 所有相关页（反向索引）
                     ▼
              FrameScheduler.request()                 合并到下一帧（requestAnimationFrame；Node 下 setImmediate）
                     ▼ flush()
              for page in Viewport.visible ∩ dirty:     不可见页只记脏、不渲染（虚拟化）
                 StyleCache.invalidate(region)          反向依赖索引 → 精确失效
                 PageRenderer.render(page, region)      垂直束提供（slide-render）：合成 → 逐元素 mount/update/dispose
              Thumbnails.notify(dirtyPages)             缩略图 Provider 自己去抖
              telemetry.span('render.frame', {pages, elements, ms})
```

- **帧预算**：脚本 ≤ 8 ms/帧（留给浏览器样式/布局/绘制 ≥ 8 ms）；超过预算时 `FrameScheduler` 把剩余脏页顺延到下一帧（时间切片，按可见性优先级），不会掉帧到 < 30 fps。
- **A28 反制测试**（`engine-render/__tests__/dirty-consumed.test.ts`）：用 spy 渲染器挂 100 个元素，改 1 个元素的 1 个属性，断言 `update` 恰被调用 1 次且 `changed` 集合等于该路径；改 `layoutId` 断言 `page` 级重合成但已有元素实例被**复用**（`mount` 不再调用）。
- **A29 反制测试**：`StyleCache` 上限 = 已挂载页的元素数 × 2，塞入 3× 后断言 `evicted` 计数 > 0 且命中率统计可读；`MediaCache` 同理（按字节 LRU，默认 256 MiB）。

### 2.3 Viewport 与虚拟化

- `Viewport`（UnitScope 服务 `render` 的一部分）：`zoom`、`scroll`、`mode: 'single' | 'continuous' | 'grid' | 'show'`、`visiblePages()`（含 overscan 1 页）。
- 只对可见页 `mountPage`；离开视口 + 超时 5 s → `unmountPage`（DOM 释放，元素实例 dispose），其 dirty 记录保留为 `'all'`，下次可见时全量重建。
- 单页编辑模式下同时挂载的页 ≤ 3（当前 ± 1）；连续滚动模式 ≤ 6。缩略图侧栏的可见项 ≤ 12（见 §8）。

### 2.4 目录结构（`packages/engine-render/`）

```
packages/engine-render/
├── package.json                      deps: @oce/kernel @oce/engine-layout @oce/shared；iso（无 DOM 类型；rAF 通过注入的 Scheduler 抽象）
├── src/
│   ├── index.ts
│   ├── plugin.ts                     name='engine-render'；provide=['render']（UnitScope）；注册贡献点定义；Config
│   ├── manifest.ts
│   ├── config.ts                     zod：{ frameBudgetMs: 8, overscanPages: 1, unmountDelayMs: 5000, styleCache: { maxEntriesFactor: 2 }, mediaCache: { maxBytes: 256 MiB } }
│   ├── render.contribution.ts        defineContributionPoint：render.target / render.element / render.overlay；Context { render: RenderService }；Events：render/frame（进程内消费；遥测事件 perf/frame 由其派生）、render/element-failed、render/page-mounted|unmounted
│   ├── contracts/
│   │   ├── render-target.ts          RenderTarget/Surface/PageView/LayerHandle/LayerSpec
│   │   ├── element-renderer.ts       ElementRenderer/ElementInstance/ElementRenderContext（含 style、layout 服务、media 解析器、errors）
│   │   ├── overlay.ts                OverlayRenderer/OverlayInstance/OverlayContext（selection、presence、viewport 只读句柄）
│   │   ├── page-renderer.ts          PageRenderer Definition：垂直束实现「一页如何由模型合成为元素列表并驱动渲染器」
│   │   ├── hit-test.ts               HitTester 契约；'render/hit-test' bail 事件签名
│   │   └── dirty.ts                  DirtyRegion/PathKey/归类规则接口（归类规则由垂直束通过 PageRenderer.classify(paths) 提供，引擎不识别 'slides'）
│   ├── services/
│   │   └── render.service.ts         RenderService（name 'render'）：attach(surface) / viewport / scheduler / caches / stats；组合下列模块
│   ├── scheduler/
│   │   ├── frame-scheduler.ts        请求合并、时间切片、优先级（可见 > 近邻 > 其他）；Scheduler 抽象（rAF | setImmediate | 手动步进用于测试）
│   │   └── dirty-tracker.ts          路径 → DirtyRegion；页/元素级去重；反向索引（layout/master/theme → pages）由 PageRenderer.dependencies() 提供
│   ├── cache/
│   │   ├── style-cache.ts            (pageId, elementId) → ResolvedStyle；依赖键集合；invalidateByPath；LRU；统计（hits/misses/evicted）
│   │   ├── media-cache.ts            sha256 → 已解码资源句柄（Blob URL 或 ImageBitmap 由 target 决定）；字节 LRU；引用计数与 revoke 钩子
│   │   └── lru.ts                    通用 LRU（带 onEvict 回调，测试可断言调用）
│   ├── viewport/
│   │   └── viewport.ts               zoom/scroll/mode/visiblePages；fit-to-width/height 计算；变化事件
│   ├── hit-test/
│   │   ├── hit-tester.ts             bail 链（overlay 优先）→ 几何命中：逆变换 → 包围盒 → 可选 instance.hitTest（精确路径）
│   │   └── geometry.ts               旋转/翻转矩阵、包围盒、点-多边形（Path 采样）纯函数
│   ├── registry/
│   │   └── renderer-table.ts         贡献点 → `${kind}/${target}` 查表；unknown 占位；contribution/changed 时重建表（effect 拥有）
│   ├── errors.ts                     render.renderer_missing / render.element_failed / render.target_missing / render.frame_overrun
│   └── __tests__/
│       ├── dirty-consumed.test.ts    A28 反制
│       ├── cache-eviction.test.ts    A29 反制
│       ├── scheduler.test.ts         合并、时间切片、优先级（手动步进 Scheduler）
│       ├── hit-test.test.ts          旋转/翻转/组合下命中
│       ├── error-isolation.test.ts   抛错渲染器 → 占位符，其余元素正常（A11）
│       └── lifecycle.test.ts         attach/detach 后无 effect；多 Unit 各自 render 服务
└── testing/
    └── index.ts                      `@oce/engine-render/testing`：ManualScheduler、SpyRenderer(kind)、FakeSurface（记录 DOM 操作而不需要 DOM）、runRenderTargetConformance(factory)、runElementRendererConformance(renderer, fixtures)
```

---

## 3. `@oce/render-dom`（dom）：RenderTarget Provider

### 3.1 职责

- HTML/SVG 输出：`DomSurface` 在宿主元素内创建 `.oce-surface > .oce-page[data-page-id] > (svg.master, svg.layout, svg.page, svg.overlay, div.text-host)`。
- 图元 API（供垂直束渲染器使用，避免每个渲染器手写 DOM）：`svg.path()/rect()/image()/text()/group()/clipPath()/gradient()/pattern()`，返回带 `set(attrs)` 的薄句柄；属性 diff 由句柄做（只写变化的 attribute）。
- `FontFaceLoader`：把 `engine-layout` 的字体请求（`FontRequest{family, weight, style}`）解析为 `FontFace` 加载（嵌入字体 `fntdata` 由 ooxml-pptx 反混淆后以 `BlobRef` 提供；宿主字体经配置 URL），`document.fonts.load` 完成后触发 `layout/fonts-ready(families)` → 相关文本元素标脏重排。
- `MediaResolver`：`BlobRef` → `blob:` URL（`MediaCache` 持有，revoke 在淘汰/页卸载时；借鉴 pptx-renderer 的 Blob URL 生命周期）。
- `OverlayLayer` 与 `TextInputHost`（§6/§7）。

### 3.2 目录结构（`packages/render-dom/`）

```
packages/render-dom/
├── package.json                      deps: @oce/engine-render @oce/engine-layout @oce/design(仅 CSS 变量名常量) ；dom
├── src/
│   ├── index.ts
│   ├── plugin.ts                     name='render-dom'；inject=['render','layout']；contribute render.target{ id:'dom' }；contribute render.overlay（selection/handles/remote-cursors）
│   ├── manifest.ts
│   ├── config.ts                     zod：{ pixelRatioCap: 3, textHost: { imeCandidateOffsetPx: 2 }, overlays: { remoteCursorFadeMs: 3000 } }
│   ├── target/
│   │   ├── dom-render-target.ts      RenderTarget Provider：createSurface
│   │   ├── dom-surface.ts            Surface：页容器管理、ResizeObserver（effect 拥有）、DPR 变化监听
│   │   ├── dom-page-view.ts          PageView：三层 svg + overlay + text-host；setTransform → CSS transform；模板层克隆
│   │   └── layer-handle.ts           LayerHandle：z-order 插入（按 FracKey 比较后 insertBefore）、批量 DocumentFragment 提交
│   ├── primitives/
│   │   ├── svg.ts                    图元句柄工厂（属性 diff、命名空间、`<defs>` 管理）
│   │   ├── paint.ts                  fill/stroke → SVG 属性/`<linearGradient>`/`<pattern>`/`<image>` 平铺；混合模式与不透明度
│   │   ├── text-lines.ts             engine-layout 的 TextLayout → `<text>`/`<tspan>`（每行一 `<text>`，run 为 `<tspan x=…>`；下划线/删除线用 `<line>`）
│   │   └── clip.ts                   几何裁切、图片 srcRect 裁切
│   ├── fonts/
│   │   ├── font-face-loader.ts       FontFace 加载、去重、失败回退、fonts-ready 事件
│   │   └── measurer-canvas.ts        engine-layout Measurer Provider：OffscreenCanvas.measureText（+ fontBoundingBox）缓存（ADR-0027）
│   ├── media/
│   │   └── media-resolver.ts         BlobRef → blob: URL；接入 engine-render MediaCache；`<image>` decode 事件
│   ├── overlay/
│   │   ├── overlay-layer.ts          覆盖层 svg 管理；zIndex 排序
│   │   ├── selection-overlay.ts      选中框（含旋转）、8 个缩放手柄 + 旋转手柄、调整点（adj 手柄由几何提供）
│   │   ├── remote-presence-overlay.ts 远端选区色框 + 名字标签 + 文本光标（RelativePosition → 行/列 → 像素）
│   │   ├── guides-overlay.ts         智能参考线/对齐线（由交互层提供数据）
│   │   └── comment-pins-overlay.ts   评论钉（数据来自 comments 客户端服务；无则不挂）
│   ├── text-host/
│   │   ├── text-input-host.ts        隐藏 textarea 宿主：聚焦管理、事件转发（beforeinput/input/composition*/keydown）→ 编辑意图对象
│   │   ├── ime-composition.ts        组合态：瞬态覆盖层文本 + 候选窗定位（把 textarea 移到光标像素位置）
│   │   ├── caret-renderer.ts         自绘光标（闪烁 timer 归 effect）、本地选区高亮（overlay）
│   │   └── a11y-mirror.ts            屏幕阅读器镜像：当前段落文本同步到 textarea 值 + aria-* 描述；只读时 role=document 的语义树
│   ├── errors.ts                     render.dom.font_load_failed / render.dom.media_decode_failed
│   └── __tests__/                    vitest browser mode（Chromium）：图元属性 diff、层克隆、字体回退、IME 组合事件序列（合成事件）、覆盖层坐标
└── testing/
    └── index.ts                      `@oce/render-dom/testing`：mountTestSurface(html)、snapshotSvg(page)（规范化后的 SVG 字串用于快照测试）、FakeFontFace
```

---

## 4. `@oce/slide-render`（dom，垂直束）：页合成与元素渲染器

### 4.1 页合成（master → layout → slide）

1. `composeSlide(store, slideId)`（model-slide 纯函数，架构 04）返回 `CompositeSlide { background, layers: { master: Element[], layout: Element[], slide: Element[] }, dependencies: { themeId, masterId, layoutId } }`：已按 `showMasterSp`、占位符覆盖规则（slide 有同 idx/type 占位符则隐藏 layout/master 的对应占位符）与 `(parentId, z)` 展开成绘制顺序。
2. `SlidePageRenderer`（实现 engine-render 的 `PageRenderer`）：
   - `master`/`layout` 层：以 `(layoutId, showMasterSp, themeVersion)` 为键缓存**渲染后的 DOM 模板**（`LayerTemplateCache`，LRU 32 项），新页挂载时 `cloneNode`；相关路径脏时失效并重渲一次、再广播给共享它的页。
   - `slide` 层：按元素 id 做 keyed reconcile：新增 → `mount`；删除 → `dispose`；`z`/`parentId` 变化 → 只移动 DOM 节点；属性变化 → `update(changed)`。
   - `background`：单独的 `<rect>` + paint，属于 `page` 级脏。
3. `classify(paths)`：把 `StorePath` 归类为 DirtyRegion（这是垂直束的知识，engine-render 不认识 `slides`）。

### 4.2 元素渲染器（`render.element` 贡献，target `dom`）

| kind | 内容 | 关键点 |
|---|---|---|
| `sp` | 几何 + 填充/线 + 文本 | `prstGeom` → `engine-layout` 的路径生成（含 adj 手柄）；`custGeom` 解析；文本走 §5 布局后由 `text-lines` 绘制 |
| `pic` | 图片 | `srcRect` 裁切、`stretch/tile`、几何裁切（图片形状）、EMF/WMF **不**内置矢量渲染：用包内预览位图，否则占位（章程 Q7 口径） |
| `grpSp` | 组合 | 只产生一个 `<g transform>`（chOff/chExt → 子坐标映射）；子元素由合成结果扁平化后各自渲染进该 `<g>` |
| `cxnSp` | 连接线 | 几何同 sp；端点由 `stCxn/endCxn` 解析到目标形状连接点（布局纯函数），目标移动时因依赖索引标脏 |
| `graphicFrame/table` | 表格 | 行列尺寸、合并单元格、表格样式（tblStyle）继承（04）、单元格文本走 §5 |
| `graphicFrame/chart` | 图表 | M1–M2：渲染包内预览位图（若有）否则占位；M3：图表数据建模后的最小 SVG 渲染（bar/line/pie）作为独立渲染器 kind `graphicFrame/chart` 由 `slide-render-chart` 子模块提供（可拆包） |
| `graphicFrame/ole`、SmartArt(`dgm`) | 保留不编辑 | 渲染回退位图/占位符 |
| `unknown` | — | 由 engine-render 占位 |

所有渲染器都是**无状态查表项**：每个元素实例只持有自己的 DOM 句柄与上次模型引用。

### 4.3 目录结构（`packages/slide-render/`）

```
packages/slide-render/
├── package.json                      deps: @oce/model-slide @oce/engine-render @oce/render-dom @oce/engine-layout；dom
├── src/
│   ├── index.ts
│   ├── plugin.ts                     name='slide-render'；inject=['render','layout','slides']；contribute render.element × N、PageRenderer、thumbnails Provider
│   ├── manifest.ts
│   ├── config.ts                     zod：{ layerTemplateCache: 32, thumbnails: { provider: 'dom-scaled' | 'server-png', width: 192, debounceMs: 300, maxMounted: 12 }, charts: { enabled: true } }
│   ├── slide-render.contribution.ts  Context { thumbnails: ThumbnailService }（UnitScope）；Events：slide/thumbnail-updated、slide/show-changed
│   ├── page/
│   │   ├── slide-page-renderer.ts    PageRenderer 实现：合成、keyed reconcile、classify、dependencies
│   │   ├── layer-template-cache.ts   master/layout 模板缓存（LRU + 失效 + 统计）
│   │   └── background.ts            背景绘制
│   ├── elements/
│   │   ├── sp.renderer.ts
│   │   ├── pic.renderer.ts
│   │   ├── grp-sp.renderer.ts
│   │   ├── cxn-sp.renderer.ts
│   │   ├── table.renderer.ts
│   │   ├── chart.renderer.ts         预览位图 + M3 最小图表
│   │   ├── fallback.renderer.ts      ole/dgm/未知 graphic：预览位图或占位
│   │   └── shared/
│   │       ├── geometry.ts           模型 geom → engine-layout 路径 + 文本内接矩形（txRect）
│   │       ├── paint-resolver.ts     已解析样式（04）→ render-dom paint 参数（颜色变换 lumMod/tint/alpha 等由 04 的 color 纯函数完成）
│   │       └── text-body.ts          txBody → engine-layout.layoutTextBody → text-lines；autofit 循环（normAutofit fontScale/lnSpcReduction）
│   ├── thumbnails/
│   │   ├── thumbnail.service.ts      ThumbnailService：get(slideId) → { url | element, version }；订阅 dirtyPages；去抖；Provider 选择
│   │   ├── dom-scaled.provider.ts    可见缩略图 = 独立小 Surface 挂载页（复用模板层）+ CSS scale；≤ maxMounted，IntersectionObserver 驱动
│   │   └── server-png.provider.ts    从 `GET /api/v1/documents/:id/thumbnails/:slideId?seq=` 取 PNG（08/ADR-0026）；本地脏页在 PNG 到达前用 dom-scaled 兜底
│   ├── show/
│   │   └── slideshow.ts              放映模式：Viewport.mode='show'、全屏、键盘翻页、黑屏/白屏；动画/切换不播放（Q7），预留贡献点 slide.showTransition
│   ├── errors.ts                     slide.render.*（geometry_unsupported、chart_preview_missing）
│   └── __tests__/
│       ├── compose-reconcile.test.ts 版式切换复用元素实例；z 变化只移动节点
│       ├── elements/*.test.ts        每个渲染器的 SVG 快照（规范化）+ runElementRendererConformance
│       ├── template-cache.test.ts    共享版式的页在 layout 改动后同时更新（且仅重渲模板一次）
│       ├── autofit.test.ts           normAutofit/spAutoFit 收敛（≤ 6 次迭代）
│       └── thumbnails.test.ts        去抖、maxMounted、Provider 切换
└── testing/
    └── index.ts                      `@oce/slide-render/testing`：renderSlideToSvgString(snapshot, slideId)（headless 断言用）、fixtures（覆盖每个 kind 的最小 Snapshot）
```

---

## 5. `@oce/engine-layout`（iso）：度量与断行（ADR-0027）

### 5.1 策略：自己断行（layout-then-paint），度量器可插拔

- **为什么不用浏览器 CSS 排版文本**：PowerPoint 语义（`normAutofit` 的 `fontScale`/`lnSpcReduction`、`spAutoFit` 增高、`anchor`/`anchorCtr`、多栏 `numCol`、`wrap="none"`、缩进/悬挂/项目符号、`spcPct` 行距、东亚标点禁则、竖排）需要确定的几何来做命中、选区矩形、光标位置与缩略图一致性；CSS 排版的结果不可读取为行模型（只能用 Range 反推，代价高且不稳定），且服务端/客户端结果难以逐像素一致。
- **度量器 Definition**（`Measurer`）：`measure(text, font) → { advances: Float32Array; ascent; descent; lineGap }`，两个 Provider：
  - `canvas`（render-dom）：`OffscreenCanvas.measureText`，含实际字体回退行为，**客户端与 headless Chromium 都用它**，因此两端一致（同字体集）。
  - `fontkit`（server-headless，可选，M4+）：Node 解析字体文件计算 advance，用于**无浏览器**的服务端路径（例如导出 PDF/校验），标注为「近似一致」（无 shaping 差异保证）。
- 断行算法：按 UAX#14 行断机会（`Intl.Segmenter` 或内置表）+ 东亚禁则；run 边界为字距重置点（与 PowerPoint 行为一致）；每行输出 `LineBox { y, ascent, descent, runs: [{ x, text, attrs }] }`。
- **一致性策略**：字体集受控（§5.3）+ 度量缓存键含 `fontKey + text`（按 word 缓存）+ 版本化的 `layoutAlgorithmVersion` 进入缩略图缓存键（服务端 PNG 与客户端算法版本不一致时以客户端为准并触发重生成）。

### 5.2 API（草案）

```ts
interface LayoutService {                                 // ctx.layout（根作用域）
  layoutTextBody(body: TextBodyModel, box: Rect, style: ResolvedTextStyle, opts: { autofit: AutofitSpec }): TextLayout
  presetGeometry(name: string, adj: Record<string, number>, box: Rect): GeometryPath   // 187 种 prstGeom（编译期表）
  customGeometry(spec: CustomGeometrySpec, box: Rect): GeometryPath
  fonts: FontFallbackTable                                // 请求族 → 候选族（含度量兼容替身）
  measurer: Measurer                                      // 当前 Provider
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

嵌入字体（`ppt/fonts/*.fntdata`）优先于回退表；许可证不允许再分发的字体不会进入服务端字体包（运维清单）。

### 5.4 目录结构（`packages/engine-layout/`）

```
packages/engine-layout/
├── package.json                      deps: @oce/shared；iso（Intl.Segmenter 可用性检测 + 内置回退表）
├── src/
│   ├── index.ts
│   ├── plugin.ts                     name='engine-layout'；provide=['layout']；inject 可选 measurer（ctx.get('measurer')，缺失 → PENDING 等待 Provider，符合 primer）
│   ├── manifest.ts
│   ├── config.ts                     zod：{ fallbackTable: FontFallbackTable(默认内置), measureCache: { maxEntries: 50_000 }, autofit: { maxIterations: 6 } }
│   ├── layout.contribution.ts        Context { layout: LayoutService; measurer: Measurer }
│   ├── contracts/
│   │   ├── measurer.ts               Measurer Definition + FontKey 规范化
│   │   ├── text-layout.ts            TextBodyModel(引擎视角的最小结构，与 model-slide 解耦：paragraphs[]→runs[]→attrs)、LineBox、CaretMap
│   │   └── geometry.ts               GeometryPath（命令序列 + 文本矩形 + 连接点 + adj 手柄描述）
│   ├── text/
│   │   ├── shaper.ts                 run 切分（字体/脚本/方向）、字体回退到具体族
│   │   ├── line-breaker.ts           UAX#14 机会点 + CJK 禁则 + wrap=none + 强制换行(br)
│   │   ├── paragraph-layout.ts       缩进/悬挂/项目符号/对齐/行距（spcPct/spcPts）/段前后
│   │   ├── body-layout.ts            多栏、anchor、insets、autofit 迭代
│   │   ├── caret-map.ts              (段落, 偏移) ↔ (行, x)；用于光标/选区/命中
│   │   └── measure-cache.ts          LRU（A29 测试）
│   ├── geometry/
│   │   ├── preset-table.ts           187 种 prstGeom 的公式表（由 tooling 从 presetShapeDefinitions.xml 生成，生成脚本在 tooling/）
│   │   ├── formula-eval.ts           OOXML 几何公式求值（gd/avLst/gdLst/ahLst/cxnLst）
│   │   ├── custom-geometry.ts        custGeom 路径
│   │   └── path-builder.ts           → SVG path 字串 / 采样多边形（命中）
│   ├── fonts/
│   │   ├── fallback-table.ts         默认表 + 合并策略
│   │   └── font-key.ts               family/weight/style/size → 规范化键
│   ├── units.ts                      Emu/Pt/px 换算（品牌类型来自 @oce/shared）
│   ├── errors.ts                     layout.measurer_missing / layout.geometry_formula_error
│   └── __tests__/                    断行黄金用例（含 CJK/混排/禁则）、几何表全量求值不抛错、autofit 收敛、度量缓存淘汰
└── testing/
    └── index.ts                      `@oce/engine-layout/testing`：FixedWidthMeasurer（每字等宽，确定性）、runMeasurerConformance(factory)
```

---

## 6. 文本编辑宿主（ADR-0028）

### 6.1 决策：**单一隐藏 `textarea` + 自绘光标/选区**，不用每个文本框 `contenteditable`

| 维度 | 每文本框 contenteditable | 单一隐藏 textarea + 自绘（采用） |
|---|---|---|
| 与自有断行的一致性 | 浏览器会自行排版，与 §5 的行模型冲突；`foreignObject` 内 contenteditable 在 Safari 不稳定 | 渲染完全由我们控制，编辑态与只读态像素一致 |
| 协同映射 | DOM MutationObserver → 文本操作的反推极易出错（这正是 ProseMirror 的复杂度来源） | 输入事件直接转为 `text.insert/delete/format` Mutation（A32：无第二份编辑缓冲） |
| IME | 原生支持好 | `compositionstart/update/end` + `beforeinput`（`insertCompositionText`）可完整支持；组合中文字以**瞬态覆盖层**显示，`compositionend` 才提交事务；候选窗位置靠把 textarea 定位到光标像素处 |
| a11y | 原生语义最好 | 需要镜像：textarea 值 = 当前段落文本，选区同步；`aria-activedescendant` 指向当前形状；只读模式暴露 `role=document` 语义树（`a11y-mirror.ts`）。**局限**：屏幕阅读器只能按段落朗读（Google Slides 采用同类方案） |
| 移动端 | 好 | 虚拟键盘由 textarea 聚焦触发；可用 |
| 先例 | Notion/Quill 类 | Google Slides/Docs、Figma、VS Code（Monaco） |

### 6.2 事件 → Mutation 流

```
keydown(非字符) ──► 命令（方向键/删除/回车/快捷键）→ commands.execute（05）
beforeinput(insertText/deleteContent*/insertParagraph) ──► text.* Mutation（一个事务；captureTimeout 合并撤销）
compositionstart ──► 进入组合态：记录锚点 RelativePosition，覆盖层渲染组合串
compositionupdate ──► 只更新覆盖层（不写 Store）
compositionend ──► 一次 text.insert 事务
paste ──► 命令层：HTML/纯文本/OOXML 剪贴板 → Mutation 批
```

- 光标位置 = `StablePosition`（06 §2.2）→ `CaretMap` → 像素；远端光标同理（presence）。
- 文本编辑期间的重排：只重排被编辑的 txBody（元素级脏）；autofit 迭代上限 6 次；预算：键入 → 屏幕 ≤ 16 ms（p95 ≤ 33 ms）。

---

## 7. 命中测试与覆盖层

- **命中链**：`ctx.bail('render/hit-test', point, ctx)`：覆盖层（手柄 > 评论钉 > 远端光标标签）优先返回 `HitResult{ kind:'handle'|'pin'|…}`；无人接管 → `HitTester.geometric()`：视口逆变换 → 页坐标 → 自顶层 `z` 逆序遍历 `(包围盒 + 旋转逆变换)` → 命中候选再问 `instance.hitTest`（精确路径采样，Path2D `isPointInPath` 在 dom 可用；Node 用多边形）→ 返回 `ShapeId`；组合：先命中子元素，按「组合选择规则」（首次点击选组，双击进组）由交互层决定。
- 覆盖层数据源：`selection`（A 线 UnitScope 服务）、`presence.remotes`、comments 客户端服务（可选）。覆盖层**不**参与内容脏区：它们订阅各自数据源，独立的 `overlay` 层重绘不触发内容渲染（测试：改变选区不会调用任何 ElementInstance.update）。
- 远端光标渲染：`caret.anchor/head`（RelativePosition）→ `store.resolveStablePosition` → `CaretMap` → 像素；目标形状未挂载/不可见时只显示头像于页缩略图。

---

## 8. 缩略图与放映模式

| 方案 | 何时用 | 成本 |
|---|---|---|
| `dom-scaled`（缩放 DOM 克隆） | M1/M2 默认；可见缩略图 ≤ 12 个，IntersectionObserver 驻留 | 每个 ≈ 一页 DOM；模板层共享；更新 = 与主页面共享的合成结果重挂 |
| `server-png`（Q8） | M3 起：非可见/全览网格/文档列表封面；来自 server-headless 的 PNG（ADR-0026） | 网络请求 + 缓存；本地脏页在 PNG 到达前用 dom-scaled 兜底 |
| `canvas-raster`（本地栅格化） | 备选（未采用）：SVG 序列化 → `<img>` → canvas；受 `blob:` 外链限制需内联图片为 data URI | 大图内联成本高；放弃，写入 ADR-0026 备选 |

放映模式：`Viewport.mode='show'` + Fullscreen API；渲染同一 Surface（fit 到屏幕）；不播放动画/切换（Q7）；预留 `slide.showTransition` 贡献点（M4+）。

---

## 9. 性能预算与测量方式

| 场景 | 预算 | 测量 |
|---|---|---|
| 首页可见（30 页/20 MB 文档，下载完成后） | ≤ 1.5 s p75 | Playwright trace：`unit/opened` → 首个 `render/frame`（`performance.mark`） |
| 首页可见（200 页） | ≤ 3.0 s p75 | 同上 |
| 键入 → 玻璃 | ≤ 16 ms p50，≤ 33 ms p95 | `beforeinput` 时间戳 → 该帧 `render/frame` 结束 |
| 拖拽形状 | ≥ 55 fps（帧脚本 ≤ 8 ms） | trace 帧统计 |
| 缩放/滚动 | ≥ 55 fps | 同上 |
| 切页（已缓存模板） | ≤ 50 ms 至绘制 | `viewport/changed` → `render/frame` |
| 单属性变更 | 恰 1 个元素 `update`；≤ 5 ms | 单测（A28）+ trace |
| 版式变更 | 页级重合成 ≤ 30 ms（30 元素） | bench |
| 内存（200 页，含 12 缩略图） | 堆 ≤ 300 MB；MediaCache ≤ 256 MiB | `performance.memory`/Playwright CDP `HeapProfiler` |
| 缩略图刷新延迟 | ≤ 300 ms 去抖后 ≤ 100 ms | e2e |
| 字体到达后重排 | ≤ 1 帧内标脏，重排仅涉及该字体的文本 | 单测 |

预算文件：`test/perf/budgets.json`；门禁规则与噪声控制见 11 §9。

---

## 10. 服务端 headless 渲染路径（Q8，ADR-0026）

```
BullMQ job thumbnails.render{docId, snapshotSeq, slideIds?}
  → server-headless ThumbnailRenderer：Playwright Chromium 池（每进程 2 页面）
  → page.goto(<web 构建的 /render 路由>?token=…)         同一份 preset-slide（viewer 模式，无 UI、无协同）
  → 页面拉取快照（GET /internal/render/:token/state）→ 打开 Unit → 逐页 mount → 等待 fonts-ready + render/frame 静止
  → page.screenshot(clip=页容器, deviceScaleFactor=2) → PNG → S3 → thumbnails 表 upsert
```

- 与客户端**同一渲染代码、同一字体包、同一布局算法版本** ⇒ 像素级一致（视觉 oracle 在 11 中同时校验客户端与服务端输出）。
- 预算：≤ 400 ms/页 p95 @ 1280×720×2；单 job ≤ 200 页 ≤ 60 s；失败重试 3 次；去重键 `(docId, snapshotSeq)`。
- 安全：渲染页面运行在无网络策略的 Chromium（仅允许访问 apps/server 内部地址）；外部图片链接不加载。

---

## 11. 与 Univer 的对照

| 编号 | Univer | 本项目 |
|---|---|---|
| A1/A5 | engine-render 66% 是产品组件；`IRange` 进通用契约 | engine-render 只有契约/调度/缓存/命中；元素渲染全在垂直束；契约只认 `kind`、几何盒、路径 |
| A4 | 布局基类跨三包继承 | engine-layout 纯函数 + Measurer Definition；模型包不 import 引擎 |
| A28 | 脏矩形无人读 | DirtyTracker → PageRenderer 消费；反制测试 |
| A29 | 缓存淘汰未接线 | 四处 LRU：StyleCache / MediaCache / measure-cache（engine 侧）+ LayerTemplateCache（slide-render 侧），均有淘汰测试与统计指标（2026-09-18 由「三处」改，14 §1 C-12） |
| A30 | 热路径穿 20 个拦截器 | 渲染器查表；`waterfall` 在 engine-render/render-dom/slide-render 中被 lint 禁止（由 09-02 承接） |
| A11 | 一崩全崩 | 元素级 try/catch + 占位符 + errors 上报 |
| A32 | 三模型两边界 | 隐藏输入直写 Store；组合文本为瞬态覆盖层 |

---

## 12. 待决事项

| # | 事项 | 默认 | 决策人 |
|---|---|---|---|
| R1 | 图表 M3 的最小可编辑渲染范围（bar/line/pie 以外） | 仅三类，其余位图 | 产品 |
| R2 | a11y 目标级别（WCAG 2.2 AA 的哪些条款在 M2 必达） | 键盘可达 + 基本朗读 | 产品/设计 |
| R3 | 服务端字体包清单与许可 | Noto + Liberation + Carlito/Caladea | 运维/法务 |
| R4 | headless 渲染页放在 apps/web 的 `/render` 路由还是独立 `apps/render-page` | apps/web 路由（无章程改动） | 架构 A |
| R5 | 缩略图默认 Provider 在 M3 是否切到 server-png | 可见项 dom-scaled，其余 server-png | 产品 |

## 13. 对章程的异议/建议

- **S5（由章程 v0.2 的 `package.json#oce.iso` 逐包字段解决）**：`engine-render` 为 `iso`，`render-dom` 为 `dom`。
- **S6（已批准，进入章程 v0.2）**：`slide-render` 的图表渲染在 M3 拆为 `@oce/slide-render-chart`（V-render，dom，可选插件，惰性 ≤ 400 KB），避免图表库体积进入基础束（A33）。

## 术语补充

| 术语 | 定义 |
|---|---|
| Surface / PageView / Layer | RenderTarget 的三级输出容器 |
| DirtyRegion | 页/元素级脏标记，含原因 |
| Measurer | 文本度量 Provider |
| LayerTemplate | 母版/版式层渲染结果的可克隆 DOM 模板 |
| CaretMap | 文本偏移 ↔ 像素的双向映射 |
| Overlay | 不属于文档内容的覆盖层（选中、手柄、presence、评论钉） |

---

## 14. v0.2 补充：与架构 02/04 契约的对齐、PRD（NF-01/ED/PD/SV）条目的承接、章程 v0.2 裁决

> 追加于 A 线 02/04 与产品线落盘之后。签名以 02/04 为准，本文负责管线与性能；凡与前文冲突处以本节为准。

### 14.1 术语与签名对齐（02 §4.13–4.16、04 §10）

| 本文 v0.1 | 02/04（以之为准） | 说明 |
|---|---|---|
| `PageRenderer`（合成 + classify + dependencies） | `SceneProvider`（贡献点 `render.scene`，key = documentType）：`build(unitScope, view) → Scene`、`diff(changeSet, prev) → DirtySet` | `slide-render/scene/slide-scene-provider.ts` 实现 `SceneProvider('slide')`，输入 `slides.resolved.*` 与 `layout` 服务 |
| `CompositeSlide` / 元素 | `Scene` / `SceneNode{ id, kind, bbox, transform, zIndex, children?, data, revision }` | 母版/版式/页三层 = 一个 `Scene`，节点带 `data.layer` 标签，便于 dom target 做模板层缓存 |
| `DirtyRegion{ page, elementIds }` | `DirtySet{ nodeIds, full }` | **对 A 线的增补请求**：`DirtySet` 增加可选 `changed?: Map<NodeId, PathKey[]>`；否则渲染器只能整节点重绘（仍满足 A28「只重绘该形状」，但丢失属性级最小更新） |
| `ElementRenderer.mount` / `ElementInstance.update(model, changed, style)` | `ElementRenderer<TData>{ targetId, kind, render(node, ctx) → ElementHandle, update(handle, node), dispose(handle) }`，key `${targetId}:${kind}` | `node.data` = 已解析样式 + 布局输入，由 SceneProvider 产出 |
| `Surface` / `PageView` / `LayerHandle` | `RenderTarget{ mount(container) → TargetHandle, paint(scene, dirty), hitTest, toImage?, dispose }` | 每个已挂载页一个 `TargetHandle`（虚拟化窗口 ≤ 3/6）；模板层克隆是 dom target 内部优化 |
| `Measurer` / 服务 `measurer` | `TextMeasurer`，贡献点 `layout.measurer`（key = id：`canvas`、`node-font`、`fixed`） | `ctx.layout.measurer()` 取当前 Provider；本文各处 `Measurer` 读作 `TextMeasurer` |
| 事件 `render/frame`、`render/element-error` | 总编排定稿：cordis 事件 `render/frame(unitId, stats)`（进程内消费）+ 遥测事件 `perf/frame`（由前者派生，10 §3.4）；`render/element-failed`（保留）、`render/first-paint`、`render/element-degraded`、`render/font-fallback`；02 的 `render/painted` 弃用 | `render/frame` 每帧一次，只供进程内订阅（渲染统计、devtools、缩略图去抖）；对外只暴露 `perf/frame` 遥测事件（抽样）与 `render/first-paint`；本文各处 `render/element-error` 读作 `render/element-failed` |
| 命中：几何优先 | dom target：`elementFromPoint → data-oce-node`，几何回退（旋转盒/组合） | 契约 `hitTest(point) → HitResult{ nodeId, region, local }` 不变；`bail` 链 overlay → target |
| 隐藏 `textarea` 宿主 | 02 `render-dom/layers/ime-host.ts` 写作 contenteditable | 由 ADR-0028 决定：`TextInputHost` 为可替换 Definition，Provider `hidden-textarea`（默认）与 `contenteditable-mirror`（备选），spike 后定稿（R-M2-1） |
| 缩略图 `dom-scaled` | `RenderTarget.toImage`（SVG 序列化 → Image → Canvas）用于客户端 PNG 导出与缩略图 | `toImage` 必须把 `blob:` 图片内联为 data URI（SVG-as-image 不允许外链）；可见缩略图默认仍用 `dom-scaled`；PNG 导出走 `toImage`，服务端走 headless（ADR-0026） |
| 贡献点 id | camelCase（章程 v0.2）：`render.target`、`render.element`、`render.scene`、`render.overlay`、`layout.measurer`、`slide.shapeKind`、`slide.showTransition` | 本文命名已符合 |

### 14.2 打开管线：Worker 解析、分片加载与主线程预算（NF-01）

```
main: units.open(bytes)                                worker（同一 iso 插件束：ooxml-core / ooxml-pptx / model-slide 校验；无 store 写入）
  ├─ 转移 ArrayBuffer ───────────────────────────────► parse：zip 索引（A-13：全量内存 + 懒解压媒体）→ 主题/母版/版式 → 首页 → 其余页（按 `order` 键顺序每批 8 页）
  │◄── unit/open-progress{ stage, pct } ◄─────────────┤ 每批以结构化克隆返回 SnapshotBody 片段；媒体字节按需 Transferable
  ├─ store.load(首批) → render/first-paint      门禁：D50 ≤ 1.5 s、D200 ≤ 3.0 s、DX-1000 ≤ 2.5 s、DX-MEDIA ≤ 3.0 s（RM-A p75）
  ├─ 后续批次经 scheduler.yield() / MessageChannel 分片进入 store，每片 ≤ 50 ms（NF-01「主线程最长阻塞任务 ≤ 50 ms」）
  └─ 跳转到未解析页 → 该页批次提升到队首（≤ 300 ms 可见）；已解析页 ≤ 100 ms（本文内部目标 ≤ 50 ms）
```

- Worker 只做**纯计算**且不持有可写模型（A31/D5）：解析结果进入主线程 Store；导出同理——`formats.export` 在 Worker 中对 `store.exportSnapshot()` 的结构化克隆副本运行（NF-01 1.4「导出期间 UI 可编辑」），基线包字节由 Worker 持有。
- 无 Worker 环境（旧宿主、Node 主线程）：同一代码在主线程分片执行，行为等价只是更慢。
- 度量：`unit/open-progress` 阶段时间戳 + `PerformanceObserver('longtask')` 在 perf 场景断言无 > 50 ms 任务。

### 14.3 连接符路径重算（ED-28）

- M2：`cxnSp` 端点由 `stCxn/endCxn{ id, idx }` 解析到目标形状 `cxnLst` 连接点（`engine-layout/geometry` 从预设几何表得到连接点坐标与法向）；SceneProvider 维护「连接符 → 目标形状」依赖索引，目标 `xfrm` 变化 → 连接符节点进入 `DirtySet`；直线连接符端点跟随。
- M3：`engine-layout/geometry/connector-routing.ts`：`bentConnector2–5` / `curvedConnector2–5` 的调整值（`adj1…`）按 PowerPoint 规则由两端连接点坐标与法向重算（纯函数）；结果由命令层在端点变化时作为 Mutation 写回 `geom.adj`（导出一致）。预算：≤ 1 ms/连接符；每页 ≤ 50 连接符。

### 14.4 图表与内嵌工作簿（PD-06；S6 已批准：`@oce/slide-render-chart`，V-render，dom，惰性 ≤ 400 KB）

- M1–M2：图表部件不透明保留，渲染包内预览图（缺失 → 占位）；内嵌 `.xlsx` 原样保留。
- M3：`slide-render-chart` 渲染 bar/line/pie 数据模型（A-11）；编辑数据 → 命令写图表数据缓存（`c:numCache/strCache`）并把图表部件与其 `embeddings/*.xlsx` 标脏；**默认策略「重生成最小内嵌工作簿」**（单工作表：类别列 + 序列列，与 `c:f` 引用一致），使 PowerPoint「编辑数据」可用；数据未变则原字节回写。工作簿生成器归 `ooxml-core`/`ooxml-pptx`（A 线），本文只定策略与触发点。

### 14.5 服务端渲染与分层规则（章程 v0.2 层号编码）

`server-headless`（`package.json#oce = { layer: 'LS', iso: 'node' }`）允许依赖 `engine-layout` 与 `engine-render` 的 **iso** 契约（L5），**不得** import `render-dom`（dom）；缩略图/PDF 的实际绘制发生在 headless Chromium 加载的 `apps/web` `/render` 路由页面内（ADR-0026），`server-headless` 只编排。

### 14.6 性能预算：与 PRD NF-01 的对照（差异以本文技术判断为准并注明）

| 指标 | PRD NF-01（门禁；RM-A，p75/p95） | 本文目标 | 差异说明 |
|---|---|---|---|
| 首页可见 D50 / D200 | ≤ 1.5 s / ≤ 3.0 s（`open()` 起，字节已在内存） | 同 | 一致；DX-1000 ≤ 2.5 s、DX-MEDIA ≤ 3.0 s 一并采纳 |
| 首页可交互 | ≤ 2.0 / 3.5 s | 同 | 采纳（本文 v0.1 缺此项） |
| 视口内缩略图就绪 / 全部缩略图 | ≤ 2.5 / 4.0 s；≤ 4 / 15 s | 同 | 采纳；全部缩略图为后台任务，可被导航抢占 |
| 后台全部解析完成 | ≤ 6 / 20 s | 同 | 采纳；Worker 分批 |
| 跳转到未解析 / 已解析页 | ≤ 300 / 100 ms | 已解析页 ≤ 50 ms（模板已缓存） | **本文更严**，作为 `target` |
| 主线程最长任务 | ≤ 50 ms | 同 | 采纳；Long Tasks 断言 |
| 拖动/缩放/平移 | ≥ 55 fps，p95 帧 ≤ 33 ms（≤ 300 元素）；DX-1000 ≥ 30 fps | 帧脚本 ≤ 8 ms | 等价表达（8 ms 脚本 + 浏览器 8 ms ≈ 16 ms/帧） |
| 键入延迟（keydown → paint） | p95 ≤ 50 ms | p50 ≤ 16 / p95 ≤ 33 ms | **本文更严**：自绘文本行的重排只涉及一个 txBody，RM-A 可达；PRD 值为 `gate` |
| IME 组合更新 | p95 ≤ 80 ms | 同 | 采纳 |
| 命令执行 / 批量 100 元素 / 撤销 | ≤ 10 / 100 / 50 ms | 同 | 采纳（05 命令管线 + 本文渲染） |
| 命中 / 吸附与参考线 | ≤ 2 / 4 ms | 同 | 采纳 |
| 局部变更重绘范围 | 仅受影响元素 + 覆盖层 | 同（A28 反制测试） | 一致 |
| 缩略图更新 | ≤ 500 ms | 去抖 300 ms + 渲染 ≤ 100 ms | 一致 |
| 缩略图栏滚动（200 页） | ≥ 55 fps | 同 | 采纳（虚拟化 ≤ 12 挂载） |
| 内存 D50 / D200 稳态 | ≤ 250 / 700 MB（JS heap + 可回收资源） | heap ≤ 300 MB + MediaCache ≤ 256 MiB + DOM | 总量在 700 MB 内；本文拆成可分别测量的两项；峰值 ≤ 350 MB / 1.0 GB 采纳 |
| 20 次打开/关闭 heap 增长 | ≤ 5% | 同 | **采纳 5%**（取代本文 e2e 中的 10%）；`getEffects()` 为空、blob URL 泄漏 0 一并采纳 |
| 导出（客户端 Worker） | pptx ≤ 3 / 12 s；PNG 单页 ≤ 300 ms @1920；全量 ≤ 15 / 60 s @1280；导出期间可编辑 | 同 | 采纳；导出在 Worker（14.2） |
| 体积（gzip） | 查看器 ≤ 350 KB、编辑器 ≤ 900 KB、协同增量 ≤ 200 KB、图表 ≤ 400 KB（惰性）；超 5% 失败 | 同 | 采纳；Yjs 全家 ≈ 60–80 KB 在协同增量内；图表拆包（S6） |
| 文本搜索 / 全部替换 / 主题切换 | ≤ 200 / 500 / 100 ms | 同 | 采纳（搜索走模型索引，不走 DOM） |

`test/perf/budgets.json` 以本表为源：`gate` = PRD 值，`target` = 本文更严值（11 §17）。

### 14.7 服务端 PDF（PD-16 / SV-02）

headless Chromium 加载 `/render?mode=print` → `page.pdf({ width: slideW, height: slideH, printBackground: true })`；页面尺寸 = 幻灯片尺寸（16:9 或原始比例），字体由 Chromium 子集嵌入；D50 ≤ 10 s（p95）；与 PowerPoint 导出 PDF 逐页 SSIM ≥ 0.85（11 §17）。自研矢量 PDF 为后续（PD-16 裁决）。渲染代码与客户端一致，度量器为 Chromium canvas（ADR-0027 补充）。
