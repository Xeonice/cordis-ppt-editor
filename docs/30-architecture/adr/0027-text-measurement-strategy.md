> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-14 | 依赖：charter v0.1

# ADR-0027 文本度量与断行策略

## 状态

提议。

## 背景

PowerPoint 文本语义（`normAutofit fontScale/lnSpcReduction`、`spAutoFit`、`anchor`、多栏、`wrap=none`、缩进/悬挂/项目符号、`spcPct` 行距、CJK 禁则、竖排）要求确定的行几何用于命中、光标、选区矩形、缩略图一致；服务端（headless）与客户端要一致；engine-layout 为 iso 包，度量器必须可插拔（章程 §5.2）。

## 决策

1. **自己断行（layout-then-paint）**：`engine-layout.layoutTextBody()` 产出 `LineBox[]`（行 y、run x 推进、字形高度）；渲染只绘制已定位的行（`<text>/<tspan x>`）。
2. **度量器 Definition `Measurer`**，两个 Provider：
   - `canvas`（render-dom）：`OffscreenCanvas.getContext('2d').measureText`（含 `fontBoundingBoxAscent/Descent`），字体回退由浏览器实际执行；**客户端与 headless Chromium 都用它**，故两端一致。
   - `fontkit`（server-headless，可选，M4+）：Node 解析字体文件的 advance/OS2 度量，用于无浏览器路径（PDF 导出、校验）；标注「近似一致」。
3. 一致性保障：受控字体集（回退表 07 §5.3，客户端与服务端同一 JSON；度量兼容替身 Carlito/Caladea/Liberation）+ 字体就绪后再度量（`document.fonts.load`）+ `layoutAlgorithmVersion` 进入缩略图缓存键。
4. 断行：UAX#14 机会点（`Intl.Segmenter` 可用时用之，否则内置表）+ CJK 禁则 + run 边界重置字距；autofit 迭代 ≤ 6 次（二分 fontScale）。
5. 度量缓存：按 `(fontKey, word)` LRU 50k 条，淘汰有测试（A29）。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 浏览器 CSS 排版（HTML 文本） | 行模型不可读（只能 Range 反推）；autofit 仍要自测量；两端一致性不可控；与 SVG 图形层混排复杂（ADR-0021） |
| 全部用 fontkit/opentype.js 在两端度量 | 浏览器端需下载字体文件（无法用系统字体）、无 shaping（连字/复杂文种）；体积与性能差 |
| HarfBuzz（harfbuzzjs WASM）两端 shaping | 最精确，但 WASM 体积 ~1 MB、字体文件需可得、复杂度高；作为 M5+ 对复杂文种（阿拉伯/天城文）的升级路径保留 |
| 服务端不做度量（缩略图用客户端上传） | 见 ADR-0026 |

## 后果

正面：几何确定、可测试（FixedWidthMeasurer 使布局测试确定性）、两端一致、与 PowerPoint 语义贴近。

负面 / 代价：
- 自研排版复杂度：M1 覆盖西文/CJK 水平文本 + 基本项目符号 + autofit；竖排/复杂文种延后。
- 与 PowerPoint 的差异来源仍存在（字体替身度量差异、kerning）：视觉 oracle 文本类别阈值放宽至 SSIM ≥ 0.93/0.90。
- `Intl.Segmenter` 在旧浏览器缺失 → 内置回退表（体积 ~20 KB）。

## 补充（v0.2）：Node 端度量与服务端 PDF/缩略图的关系、命名对齐、OF-05 指标

- **命名**：度量器 Definition 为 `TextMeasurer`，贡献点 `layout.measurer`（02 §4.13）；Provider id：`canvas`（render-dom）、`node-font`（server-headless，opentype/fontkit 解析字体文件）、`fixed`（testing）。本 ADR 前文的 `Measurer`/`fontkit` 读作 `TextMeasurer`/`node-font`。
- **服务端缩略图与 PDF 不使用 Node 度量**：二者在 headless Chromium 中运行同一渲染代码，度量器是 `canvas`，与客户端逐像素一致（ADR-0026）。
- **导出从不重新排版**：`ooxml-pptx.encode` 是 Snapshot（+ 基线包）的纯函数，不读取 `layout` 服务（L3 也不允许 import L5）。排版结果中需要落盘的量（`a:normAutofit@fontScale/@lnSpcReduction`、`spAutoFit` 增高后的 `xfrm.ext`）由**编辑端**在布局时作为 Mutation 写回模型；因此服务端导出与客户端导出字节级一致（SV-02）不依赖任何度量器。
- **`node-font` 的用途**：`server-headless.tasks.validate/diagnostics` 中的溢出/换行诊断报告、未来无浏览器的 PDF 路径；标注「近似一致」（advance 误差 ≤ 1%，无 shaping）。它是可选 Provider：缺失时 `layout` 服务 `PENDING`，不影响导入/导出/迁移任务。
- **OF-05 门禁指标**：语料库文本框「行数一致率 ≥ 95%」「行首字符一致率 ≥ 90%」（参照字体可用）作为视觉 oracle 文本类别的结构断言（从 DOM 行模型读取，11 §17）；`render/font-fallback` 事件携带缺失字体名（不含文本）；`Intl.Segmenter` 不可用时退化为按字符断行且不崩溃。
- **回退链顺序**（OF-05）：文档内嵌字体 → 集成方提供字体（`fontFaces`）→ 同度量替代表（07 §5.3）→ 系统默认。

## 如何被机械验证

- `runMeasurerConformance` 对 `canvas` 与 `fontkit` 通过；两者对同一字体的 advance 误差 ≤ 1%（近似一致声明的量化）。
- 断行黄金用例（`engine-layout/__tests__`）：给定 FixedWidthMeasurer 的确定输出；CJK 禁则用例。
- 视觉 oracle 文本类别 gated。
- 缩略图一致性：服务端 PNG vs 客户端截图像素差 ≤ 0.5%（ADR-0026）。

## 关联

章程 §5.2 engine-layout；Univer A4；ADR-0021/0026/0028；架构 07 §5。
