> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-14 | 依赖：charter v0.1

# ADR-0021 渲染介质：DOM/SVG 优先，Canvas 为可选 RenderTarget

## 状态

提议（默认值；章程 §2.3、§6.2、§10 Q4）。

## 背景

- 需要：高保真、任意缩放清晰、IME/a11y、插件易于贡献新元素渲染、可测试（DOM 可断言）、服务端可复用同一代码生成缩略图。
- 先例：Google Slides（DOM/SVG）、pptx-viewer（CSS/DOM）、pptx-renderer（HTML/SVG，以 PowerPoint 为 oracle）；Univer 是 Canvas 引擎且引擎内混入产品组件（A1/A5）。
- 规模：Q5 ≤ 200 页；单页元素通常 ≤ 100，极端 ≤ 1,000。

## 决策

1. 主画布：**SVG 图形 + 自绘文本行（SVG `<text>`）**，容器为 HTML；坐标单位 px@96dpi（EMU/9525），缩放用容器 `transform`。
2. `RenderTarget` 是贡献点；`dom` 为默认 Provider；`canvas` 作为可选 Provider（缩略图栅格化、放映、超大页面的应急路径），M1–M3 不实现。
3. 文本编辑宿主与文本排版策略分别由 ADR-0028、ADR-0027 决定（均与介质选择耦合：自绘文本行需要自有断行）。
4. 虚拟化：只挂载可见页（± 1）；缩略图独立 Provider（07 §8）。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| Canvas 优先（Univer/Figma 路线） | 需要自研文本光栅化、命中测试、a11y 树、IME 宿主、高 DPI 与缩放重绘管理；插件贡献门槛高（需了解绘制 API 而非产出节点）；测试只能像素比较；章程 §2.3 明确非目标 |
| HTML/CSS 文本（浏览器排版）+ SVG 图形 | 浏览器排版与 PowerPoint 语义（autofit/anchor/多栏/禁则）不一致；行模型不可读取导致命中/光标/缩略图不一致（详见 ADR-0027） |
| WebGL/WebGPU | 过度设计；文本与 a11y 问题同 Canvas 且更甚 |
| `foreignObject` 承载 HTML 文本 | Safari 稳定性问题；与 SVG 滤镜/裁切交互差；截图路径（headless）中 foreignObject 有已知渲染差异 |

## 后果

正面：清晰缩放；DOM 可检查可测试；插件写 SVG 节点即可；服务端 headless Chromium 复用同一代码（ADR-0026）；a11y 有挂点。

负面 / 代价：
- 极端页面（≥ 1,000 元素）SVG 性能下降：缓解为虚拟化 + 帧时间切片（07 §2.2）+ canvas Provider 作为应急；预算：1,000 元素页首帧 ≤ 200 ms。
- SVG 滤镜（阴影/发光/3D）保真有限：M1–M3 按章程 Q7 「保留不编辑」，用近似或位图回退。
- 文本需自有断行（ADR-0027）。

## 补充（v0.2）：PRD NF-01 与 02 契约的对齐

- 契约签名以 02 §4.14–4.16 为准（`Scene/SceneNode/SceneProvider/RenderTarget/ElementRenderer`），本 ADR 只决定介质；术语对照见 07 §14.1。
- 极端页面门禁（PRD）：DX-1000（1 页 1,000 形状）首页可见 ≤ 2.5 s、交互 ≥ 30 fps；DX-DEEP（组合嵌套 8 层）无额外预算但走同一虚拟化/时间切片路径；SVG 路线在 RM-A 上满足这些值是本 ADR 的量化前提，perf 场景 `dx-1000` 持续验证；不满足时的应急路径是 `canvas` RenderTarget（契约已预留，M1–M3 不实现）。
- 体积门禁（PRD 1.5）：查看器 preset ≤ 350 KB gzip；SVG 路线无第三方绘制库，`render-dom + slide-render` 目标 ≤ 120 KB；图表渲染拆为 `@oce/slide-render-chart`（S6 已批准）惰性加载 ≤ 400 KB。
- 客户端 PNG 导出走 `RenderTarget.toImage`（SVG 序列化 → Image → Canvas），预算单页 ≤ 300 ms @1920；需内联媒体为 data URI。

## 如何被机械验证

- 视觉 oracle（11 §7）门禁类别通过。
- 性能基准（11 §9）：`drag-fps`、`zoom-fps`、`open-200p` 达预算。
- `render.target` 贡献点存在且 `runRenderTargetConformance` 对 `dom` 通过；M1 验收「render-dom 可被 no-op Provider 替换后仍启动」由 e2e 断言。
- lint：engine-render/render-dom/slide-render 内禁止 `ctx.waterfall`（A30）。

## 关联

章程 §2.3、Q4、Q8；Univer A1/A4/A5/A28/A30；ADR-0026/0027/0028；架构 07。
