> 状态：草稿 | 负责：产品 | 更新：2026-09-19（OF-14 按 2026-09-18 裁决 Q18 补可选缩略图条 / 备注抽屉口径）；2026-09-24（rulings §4.15：Q7 保真落点——动画结束态按场景、AlternateContent 建模变换、EMF/WMF M2 栅格化、SmartArt/OLE/chartex/未知 graphicData 落点、外链资源自动加载 + `externalResources`、受限字体规则、竖排/RTL 分阶段；Q8 包内封面与 `thumbnail.jpeg` 导出口径；Q4 RenderTarget 口径；U-06 图表五类；Q14 Strict 行残留修正）；2026-09-24（rulings §4.16 Q15：`.pptm` 直接拒绝导入 `format.macro_rejected`、加密与签名行标已裁决、OF-02 验收改写）；2026-09-24（复核修正，rulings §4.17） | 依赖：charter v0.2；rulings §4.10 Q18、§4.15、§4.16

# 功能域 01：打开 / 渲染 / 保真 / 导出

> 需求编号前缀 `OF-`。本文件是 M1「打开与保真」里程碑的主要验收来源，也是后续所有里程碑的保真底线。支持等级、参照物、语料库等术语见 `../README.md`「术语补充」。

---

## 0. 本域的产品立场

1. **保真是分层承诺，不是一句口号**：对每一种 pptx 特性，我们只承诺三件事之一——「查看」「编辑」「仅保留」——并且写清楚在哪个里程碑达到。没写的不承诺。
2. **未修改零丢失是底线，不是目标**：任何我们不理解的 Part / XML 子树 / 属性，都必须原样回写（章程 D7、R6）。用户打开一个文件再原样导出，不能损坏任何东西——包括我们根本不渲染的东西。
3. **降级要可见、可诊断**：渲染不了的元素显示占位框并上报 `render/element-degraded`，绝不静默丢失（继承 pptx-renderer 的逐节点错误隔离；规避 Univer A11）。
4. **以 PowerPoint 真机导出为参照物（oracle）**：保真度量对比的是 PowerPoint 365 导出的 PNG/PDF，而不是我们自己的截图（继承 pptx-renderer 的方法论）。

---

## 1. 支持等级与矩阵读法

| 等级 | 含义 | 验收方式 |
|---|---|---|
| `P` 仅保留 | 不渲染（或渲染占位），但导出时原样写回，零丢失 | 部件级 diff（见 §4） |
| `V~` 近似查看 | 降级渲染（静态预览图 / 扁平化 / 近似效果），不承诺 SSIM 阈值 | 人工抽检 + 不崩溃 |
| `V` 查看 | 高保真渲染，达到 §4 的 SSIM / 文本度量阈值 | 视觉回归套件 |
| `E~` 部分编辑（章程 §4.3 称「有限编辑」） | 仅备注中列出的属性子集可编辑，导出正确 | 编辑往返测试 |
| `E` 编辑 | 可通过 UI 与命令修改，导出后 PowerPoint 正确显示 | 编辑往返测试 + oracle |
| `✗` 拒绝 | 识别后拒绝打开并返回类型化错误码（仅用于文件级） | 错误码测试 |

- 等级是**累积**的：`E` 蕴含 `V` 蕴含 `P`。
- 矩阵单元格写的是「到该里程碑末达到的等级」，括号内为优先级；空单元格表示与左侧相同。
- `P` 是从 M1 起对**所有**特性的默认底线；矩阵中不再重复写「P」的行，代表该行在 M1 至少为 `P`。
- 「M4+」表示 M4 或 M5 排期，具体由里程碑评审决定；M4/M5 的主线是插件 SDK 与多文档类型，保真提升为副线。

---

## 2. pptx 特性支持矩阵

### 2.1 包与文件级

| 特性 | M1 | M2 | M3 | M4+ | 边界 / 备注 |
|---|---|---|---|---|---|
| `.pptx`（ECMA-376 Transitional） | V (P0) | E (P0) | | | 主线格式 |
| `.pptx`（ISO 29500 Strict 命名空间） | V (P0) | E (P1) | | | 加载时归一化为 Transitional 语义；有编辑时的导出策略已裁决（章程 Q14 = 方案 C，rulings §4.12 U-02）：保持原一致性类，脏部件反向映射写回 Strict；方案 B「整包 Transitional」仅作反向映射失败时的异常兜底，见 OF-18 |
| `.pptm`（含 `vbaProject.bin`） | ✗ (P0) | | | | **拒绝导入**（章程 Q15，rulings §4.16，偏离原默认「宏部件不透明保留 + 导出保持 `.pptm`」）：按扩展名、`macroEnabled` 主内容类型或包内 `vbaProject.bin` 任一命中即返回 `format.macro_rejected`，提示「请另存为 .pptx 后再导入」；宏永不执行、不保留 |
| `.ppsx` / `.potx` | V (P1) | E (P2) | | | 同 OPC 结构；导出保持原内容类型 |
| `.ppt`（97-2003 二进制） | ✗ (P0) | | | | 错误码 `format.unsupported_binary`；章程 §2.3 非目标 |
| 加密包（`EncryptionInfo` CFB 容器） | ✗ (P0) | | | | 错误码 `format.encrypted`，提示先去除密码；M1–M4 拒绝（章程 Q15 已裁决，rulings §4.16） |
| 损坏 / 非 zip / 缺 `[Content_Types].xml` | ✗ (P0) | | | | 错误码 `format.pptx.invalid_package`，`details.part` 为首个失败部件路径 |
| 超出 ZIP 安全限制 | ✗ (P0) | | | | 错误码 `format.limit_exceeded`，限制值见 OF-24 |
| `[Content_Types].xml` / `_rels` 完整性 | V (P0) | | | | 导出时所有部件有内容类型、所有关系可解析 |
| `docProps/core.xml` / `app.xml` / `custom.xml` | P (P0) | V (P2) | E~ (P2) | | M2 属性对话框只读；标题/作者可编辑为 P2 |
| `docProps/thumbnail.jpeg` | P (P0) | E (P1) | | | M2 起兼作服务端文档卡片的过渡封面（服务端只做 JPEG 头校验、不解码，SV-04，rulings §4.15 Q8）。导出：该部件是 `encode()` 的显式输入——有脏部件时按**第一张非隐藏页**重生成（可关闭）；零编辑往返不重生成；源包无此部件且未提供输入时不新增，缺省保留原部件（保证 SV-02 浏览器/Node 导出确定性） |
| `mc:AlternateContent` | V (P0)；删除 E~ (P0) | E~ (P1，移动/缩放) | | | 选择首个受支持 `mc:Choice`，否则 `mc:Fallback`，原分支全部保留（`cx:` chartex 例外，见 §2.6）；编辑策略见备注 A |
| 任意元素上的 `extLst` / 未知属性 / 未知子元素 | P (P0) | | | | **元素级不透明保留**：脏部件重生成时仍必须带回（见 OF-18） |
| `customXml/` 部件 | P (P0) | | | | |
| `_xmlsignatures/` 数字签名 | P (P0) | P + 提示 (P2) | | | 任何修改都会使签名失效；M2 起打开签名文件提示「编辑将使签名失效」，不移除（章程 Q15 已裁决，rulings §4.16；U-05 诊断码） |
| `webextensions/`、`ppt/tags/`、`ppt/slideUpdateInfo/` | P (P0) | | | | |

> 备注 A（rulings §4.15 Q7，同时结案 PD-18）：`mc:AlternateContent` 内的对象（公式、墨迹、3D、缩放定位、chartex 等）**建模变换**——模型为其保存一个 transform 字段与只读渲染提示（选中的分支、Fallback 图片 rId→`BlobRef`），导出时同步回写各分支的 `xfrm`。**删除 M1 P0**（按 OF-13），**整体移动/缩放 M2 P1**；对象内部不可编辑，进入时给出提示；内部编辑为 M4+ P2。对不透明内容的修改只限 ADR-0008 决策 9 的白名单（时序引用清理、分支 `xfrm` 同步、孤儿嵌入部件清理），每条配往返测试。

### 2.2 演示文稿级

| 特性 | M1 | M2 | M3 | M4+ | 边界 / 备注 |
|---|---|---|---|---|---|
| 页面尺寸 / 方向（`p:sldSz`） | V (P0) | E (P2) | | | 改尺寸时元素缩放策略：默认「不缩放内容」 |
| 母版 / 版式继承链（Element → Placeholder → Layout → Master → Theme） | V (P0) | V (P0，母版视图只读，ML-01；版式应用/重置 ML-02) | E (P0，ML-03) | | M1 母版/版式部件建模与往返（`sldMasterIdLst`/`sldLayoutIdLst` 顺序保持）；M2 母版视图与版式应用；M3 母版与版式编辑；需求正文见 `07-masters-layouts-and-themes.md` |
| 主题（配色 / 字体 / 效果 / 格式方案） | V (P0) | | E~ (P1，ML-04) | | M3 主题色 / 主题字体 / 变体 / 从模板应用可编辑，效果方案仅查看（ML-04）；主题效果矩阵 `fmtScheme` 引用（`p:style`）M1 解析 |
| 颜色映射与覆盖（`p:clrMap`、`p:clrMapOvr`） | V (P0) | | | | |
| 节（`p14:sectionLst`） | P (P0) | V (P1) | E (P2) | | M2 缩略图侧栏分组显示；M3 新增/重命名/重排 |
| 讲义母版 / 备注母版 | P (P0) | | | V~ (P2，ML-05) | M1–M3 不透明保留；M4 备注页 / 讲义预览（ML-05） |
| `presProps` / `viewProps` / 自定义放映 | P (P0) | | | | |
| `tableStyles.xml`（含 74 种内置样式 GUID） | V (P0) | | E (P1) | | 表格渲染依赖；M3 可套用内置样式 |
| 隐藏幻灯片（`show="0"`） | V (P0) | E (P0) | | | 编辑态显示「已隐藏」标记；放映跳过 |
| 页码 / 日期 / 页脚字段（`a:fld`） | V (P0) | E~ (P2) | | | 页码按当前位置计算；`datetime` 自动字段显示存储文本 |
| 内嵌字体（`p:embeddedFontLst`、混淆 `.fntdata`） | P (P0) | V (P1) | | | M2 解混淆并注入 `FontFace`；受 OF-25 资源上限约束；不支持新增内嵌字体 |
| 参考线（`p15:sldGuideLst`） | P (P0) | V (P2) | | | |

### 2.3 幻灯片级

| 特性 | M1 | M2 | M3 | M4+ | 边界 / 备注 |
|---|---|---|---|---|---|
| 背景（纯色 / 渐变 / 图片 / 图案 / `bgRef` 主题引用） | V (P0) | E (P1) | | | M2 可设置纯色 / 渐变 / 图片背景，含「应用到全部」 |
| 切换效果（`p:transition`） | P (P0) | | | V (P2) | 放映播放为 M4 P2（章程 §2.3 v0.2）；编辑为章程非目标 |
| 动画 / 计时（`p:timing`） | P (P0) | | | V (P2) | 同上。「结束态」按场景区分（rulings §4.15 Q7）：**编辑态、缩略图、PDF/PNG 导出 = 静态全部可见**（与 PowerPoint 编辑视图及其导出一致，oracle 可直接比对）；**放映 = 主序列可见性终态**——只重放 `mainSeq` 中 `p:set` 对 visibility 的设置，交互序列触发的进入元素保持隐藏（M2 P1，成本超出可降 P2） |
| 演讲者备注（`p:notes` 文本） | V (P0) | E (P1) | | | 备注页中非正文占位符的形状仅保留 |
| 旧式评论（`p:cmLst` + `commentAuthors`） | P (P0) | | V (P1) | | 只读展示；新评论写入现代评论部件 |
| 现代评论（`p188:cmLst`，`ppt/comments/modernComment_*.xml`） | P (P0) | | E (P1) | | 协同评论的导入/导出通道，详见 `03-collaboration.md` CO-04 与 PD-04 |
| 幻灯片级 `extLst`（`p14:creationId` 等） | P (P0) | | | | `creationId` 在复制页时需重新生成 |
| 版式指派 | V (P0) | E (P1) | | | 更换版式时占位符按 `type`/`idx` 重新匹配 |

### 2.4 元素：形状（`p:sp`）与连接符（`p:cxnSp`）

| 特性 | M1 | M2 | M3 | M4+ | 边界 / 备注 |
|---|---|---|---|---|---|
| 预设几何 `prstGeom`（187 种 + `avLst` 调整值） | V (P0) | E (P0) | | | M1：187/187 由规范 `presetShapeDefinitions.xml` 机械编译，语料库出现频次前 60 种逐一视觉验证；M2 插入图库 ≥ 60 种，调整手柄 P1 |
| 自定义几何 `custGeom`（含 `gd` 公式、圆弧、贝塞尔、多 path） | V (P0) | E~ (P1) | | | 编辑仅移动 / 缩放 / 旋转，不做顶点编辑 |
| 变换（`a:xfrm` off/ext/rot/flipH/flipV） | V (P0) | E (P0) | | | |
| 纯色填充（srgb/scheme/sys/prst/hsl + 全部颜色修饰符） | V (P0) | E (P0) | | | 修饰符：`lumMod/lumOff/tint/shade/alpha/satMod/hueMod` 等全集 |
| 渐变填充（线性 / 路径，多 stop，`tileRect`） | V (P0) | E~ (P1) | | | 路径渐变近似为椭圆径向；M2 编辑线性渐变 stop |
| 图片填充（拉伸 / 平铺） | V (P0) | E~ (P2) | | | |
| 图案填充（54 种 `prst` 图案） | V (P0) | E~ (P2) | | | 全部 54 种以矢量图案实现 |
| 无填充 / 组合填充（`grpFill`） | V (P0) | E (P0) | | | |
| 线条（宽度 / 颜色 / 虚线 / 端点 / 连接 / 复合线 / 箭头首尾） | V (P0) | E (P0) | | | 复合线（`cmpd`）编辑 P2 |
| 外阴影 | V (P0) | E~ (P1) | | | M2 提供预设阴影 |
| 内阴影 / 发光 / 柔化边缘 / 映像 | V~ (P0) | | V (P2) | | 映像使用矢量镜像近似 |
| 3D（`sp3d`、`scene3d`、棱台、进深） | V~ (P0) | | | | 扁平化渲染，属性原样保留；编辑不提供 |
| 占位符继承（`p:ph` type/idx） | V (P0) | E (P0) | | | 编辑占位符内容时不写回继承来的属性，只写显式覆盖 |
| 主题样式引用（`p:style` 的 lnRef/fillRef/effectRef/fontRef） | V (P0) | E (P0) | | | 编辑时保留引用，只追加显式覆盖 |
| 超链接与动作（`a:hlinkClick`/`hlinkHover`、`ppaction://`） | V (P0) | E (P1) | | | M2 可设置 URL 与「跳转到页」；其他动作保留 |
| 锁定（`a:spLocks`）与隐藏（`hidden="1"`） | V (P0) | E~ (P1) | | | 编辑器默认尊重锁（noMove/noResize/noGrp…），可在属性面板解锁（P2） |
| 替代文本（`descr`/`title`） | V (P0) | E (P1) | | | 用于可访问性树 |
| 连接符（直线 / 肘形 / 曲线，`stCxn`/`endCxn`） | V (P0) | E~ (P1) | E (P1) | | M2：作为形状移动，端点可连接/断开；M3：端点随目标移动自动重算路径 |

### 2.5 元素：图片（`p:pic`）与媒体

| 特性 | M1 | M2 | M3 | M4+ | 边界 / 备注 |
|---|---|---|---|---|---|
| PNG / JPEG / GIF / BMP / WebP | V (P0) | E (P0) | | | GIF 显示首帧（编辑态）/ 动画（放映） |
| SVG（`asvg:svgBlip` + PNG 回退） | V (P0) | E (P0) | | | 优先 SVG；插入 SVG 时同时生成 PNG 回退（P1） |
| TIFF | V~ (P1) | | V (P2) | | 浏览器不解码，M1 显示占位；M3 起客户端解码 |
| EMF / WMF | V~ (P0) | V (P1，栅格化) | | V (P2，矢量) | M1：优先使用包内位图/PDF 预览，无预览显示占位框；**M2 惰性栅格化**（emf-converter，Apache-2.0，Worker 惰性 chunk，不计入查看器 350 KB 基线；记录数/像素/耗时上限见 OF-24；headless 用同一份代码；同样用于 OLE 的 EMF 预览，rulings §4.15 Q7）；矢量渲染为 M4+ |
| 裁剪（`a:srcRect`） | V (P0) | E (P1) | | | 矩形裁剪；按形状裁剪的编辑为 P2 |
| 图片效果（`alphaModFix`、亮度/对比度 `lum`、灰度、双色调、`biLevel`） | V (P0) | E~ (P2) | | | 灰度/亮度/对比度/透明度 M1 精确；双色调近似 |
| 图片形状遮罩（`prstGeom` 非矩形） | V (P0) | E~ (P2) | | | |
| 3D 模型（`am3d`，.glb/.gltf） | V~ (P0) | | | | 显示海报回退图；不加载 3D 引擎 |
| 墨迹（`inkml` / `p14:ink`） | V~ (P0) | | | | 通过 `mc:Fallback` 图片显示 |
| 视频（mp4/h264、webm；`p14:media`、`a:videoFile`） | V (P0) | E~ (P1) | | | 编辑态显示海报帧；放映播放；M2 可移动/缩放/替换海报，插入本地视频 P2 |
| 音频（mp3/m4a/wav） | V (P0) | E~ (P1) | | | 同上 |
| 外部链接媒体（`TargetMode="External"` 的视频/音频） | V (P0) | | | | 外部关系**全部原样保留**，仅 `http(s)` 目标可激活（D7）；默认**自动加载**（`preload="none"`，rulings §4.15 Q7 用户选择）；部署配置 `externalResources`（`auto` 默认 / `confirm` / `never`）可收紧，CSP `media-src` 随配置收紧（EM-14）；在线视频只显示海报，点击在新标签打开；服务端与 headless 永不加载（渲染为占位） |
| 外部链接图片（`r:link`） | V (P0) | | | | 同上：仅 `http(s)` 可激活，默认自动加载，`externalResources` 可收紧为 `confirm`/`never`（CSP `img-src` 随之收紧）；`confirm`/`never` 或加载失败时显示占位；服务端缩略图/PDF 一律占位，且不计入页内容哈希（SV-04） |
| 旧式格式（wmv/avi/wma）与 DRM | V~ (P0) | | | | 仅海报，提示浏览器不支持 |
| 媒体剪辑 / 淡入淡出（`p14:trim`/`fade`） | P (P0) | | | | |

### 2.6 元素：组合（`p:grpSp`）、表格、图表、SmartArt、OLE

| 特性 | M1 | M2 | M3 | M4+ | 边界 / 备注 |
|---|---|---|---|---|---|
| 组合（嵌套、`chOff/chExt` 子坐标系、组级填充/效果） | V (P0) | E (P0) | | | M2：组合/取消组合、双击进入子元素编辑（P1） |
| 表格网格 / 行高 / 列宽 / 合并（`gridSpan`/`rowSpan`/`hMerge`/`vMerge`） | V (P0) | E~ (P1) | E (P1) | | M2 单元格文本编辑；M3 行列增删、合并拆分、尺寸调整 |
| 表格样式（内置 74 种 + 文档自定义；`firstRow`/`bandRow` 等标志） | V (P0) | | E (P1) | | |
| 单元格填充 / 边框（含对角线 `lnTlToBr`/`lnBlToTr`） / 内边距 / 锚点 / 竖排 | V (P0) | | E (P1) | | 对角线边框 M1 为 P1 |
| 图表类型：柱/条（簇状/堆积/百分比）、折线、面积、饼/环、散点、气泡、雷达、股价 | V (P0) | | E~ (P1) | | M1–M2 只读解析 `c:chart` 部件与缓存（章程 D16；解析器在 `ooxml-core`），不以包内预览位图代替；阈值见 §4；M3 可编辑类型 bar / line / pie / area / scatter 五类（章程 Q18 已裁决，rulings §4.12 U-06），其余仅查看，范围见 ED-15 |
| 组合图表 / 次坐标轴 | V (P1) | | | | |
| 3D 图表 / 曲面 / 地图图表 | V~ (P0) | | | | 3D → 2D 回退；曲面/地图使用缓存图片（若有）否则占位 |
| Office 2016 新图表 chartex（`cx:`：瀑布、直方、箱形、漏斗、旭日、树状） | P (P0) | | | V~ 评估 (P2) | M1–M3 只保留，渲染为带诊断的占位并上报 `render/element-degraded{reason:"chartex-unsupported"}`；不选其 `mc:Fallback`（其内容是「此图表在你的版本中不可用」文本）；M4+ 再评估近似渲染（rulings §4.15 Q7） |
| 图表数据缓存（`c:numCache`/`c:strCache`）与内嵌工作簿 | V (P0) | | E~ (P1) | | 编辑写回缓存；内嵌 `.xlsx` 处理策略见 PD-06 |
| 图表标题 / 图例 / 坐标轴 / 数据标签 / 趋势线 / 误差线 | V (P0) | | E~ (P2) | | M3 编辑标题与图例位置 P1；轴范围与标签 P2；趋势线仅显示 |
| 图表样式部件（`chartStyle`/`colors`） | V~ (P0) | | | | |
| SmartArt（`dgm:` data/layout/colors/quickStyle + `dsp:drawing`） | V (P0) | | | E~ (P2) | M1 通过 PowerPoint 预计算的 `dsp:drawing` 渲染（覆盖语料库 ≥ 95% 的 SmartArt）；`dsp:drawing` 由 `ooxml-core` 只读解析（含 `dsp:txXfrm`），`slide-render` 渲染（章程 §5.2 依赖上限含 `ooxml-core`）；无 `dsp` 部件时显示占位并上报；整体移动/缩放/删除允许（PD-18 已结案，rulings §4.15 Q7）；内部不可编辑并提示；节点文本编辑为 M4+ |
| OLE 嵌入对象（`p:oleObj`，`embeddings/*`） | V~ (P0) | | | E~ (P2) | M1 显示预览图：从 `mc:Fallback` 中的 `p:pic` 提取为 OLE 预览（预览为 EMF 时 M2 起栅格化，§2.5）；整体移动/缩放/删除（OLE 的 VML 锚点同步需在语料上验证）；内部不可编辑；M4+ 允许下载/替换负载 |
| 链接 OLE 对象 | V~ (P0) | | | | 仅预览图；链接目标不加载、不激活（外部关系原样保留） |
| 未知 `a:graphicData`（未识别的 `uri`） | P (P0) | | | | 有 `mc:Fallback` 图片时 V~，否则占位 + `render/element-degraded`；删除/移动按备注 A 口径 |
| ActiveX 控件（`p:controls`） | P (P0) | | | | |
| 旧式 VML 绘图（`legacyDrawing`） | P (P0) | | | | 有回退图片时 V~ |
| 缩放定位 / 节缩放（`p14:` zoom 部件） | V~ (P0) | | | | 回退图片 |

### 2.7 文本（`a:txBody` / `a:p` / `a:r`）

| 特性 | M1 | M2 | M3 | M4+ | 边界 / 备注 |
|---|---|---|---|---|---|
| 段落属性（对齐 l/ctr/r/just/dist、缩进 `marL/indent`、段前后距、行距 `spcPct/spcPts`、级别 0–8） | V (P0) | E (P0) | | | 继承链含母版 `titleStyle/bodyStyle/otherStyle` 与 `lstStyle` |
| 项目符号：字符 / 自动编号（全部 `autonum` 方案含 CJK） / 图片项目符号 / `buNone` / 符号字体 / 尺寸 / 颜色 | V (P0) | E (P0) | | | M2：切换项目符号 / 编号、升降级；方案选择 P1；图片项目符号编辑 P2；Wingdings/Symbol 字体缺失时按映射表回退到 Unicode（P1） |
| 字符属性：字体（latin/ea/cs/sym + 主题字体 `+mj-*`/`+mn-*`）、字号、粗斜体、下划线（17 种）、删除线（单/双）、大写/小型大写、上下标、字距 `spc`、`kern` | V (P0) | E (P0) | | | 下划线：单/双/波浪精确，其余近似；M2 编辑：字体/字号/B/I/U/删除线/上下标/颜色/大写；字距 P2 |
| 字符颜色 / 高亮（`a:highlight`）/ 渐变文字 / 描边文字 / 文字效果 | V (P0) 纯色与高亮；V~ 其他 | E (P0) 纯色 + 高亮 | | V (P2) | 渐变/描边/阴影文字为近似 |
| 字段（`a:fld`：页码 / 日期时间） | V (P0) | E~ (P2) | | | |
| 超链接 run（`a:hlinkClick`） | V (P0) | E (P1) | | | |
| 换行（`a:br`）、制表位（`a:tabLst`） | V (P0) | E (P0) | | | |
| 文本框属性：锚点（t/ctr/b，`anchorCtr`）、内边距、自动换行、旋转 `rot`、`upright` | V (P0) | E (P1) | | | |
| 竖排文本（`vert`/`vert270`/`eaVert`/`wordArtVert`） | V (P0) 前二；V~ 后二 | E~ (P2) | | | 分阶段（rulings §4.15 Q7，ADR-0027）：M1 `vert`/`vert270` 以文本框旋转实现，`eaVert` 近似；竖排编辑为 M2 E~ (P2)，不承诺 P0/P1 |
| 分栏（`numCol`/`spcCol`） | V (P1) | E~ (P2) | | | |
| 自动调整：`normAutofit`（`fontScale`/`lnSpcReduction`）/ `spAutoFit` / 不调整 | V (P0) | E (P1) | | | M1 按存储值渲染；M2 编辑后重新计算 `fontScale`（允许与 PowerPoint 差 1 档）与形状增长 |
| 艺术字变形（`prstTxWarp`） | V~ (P0) | | | V (P2) | M1 渲染为未变形文本 |
| 行断行与度量：拉丁词换行、CJK 禁则、全角标点压缩 | V (P0) | | | | 度量阈值见 §4.3 |
| 双向文本（`rtl="1"`、阿拉伯/希伯来） | V (P1) | | | E~ (P2) | M1 查看依赖浏览器原生 bidi（每行一个 `<text>` 块、run 不设 x，由浏览器重排）；RTL 编辑与 HarfBuzz shaping 放到 M4/M5（rulings §4.15 Q7） |
| 公式（`m:oMath` 于 `a14:m`） | V~ (P0) | | | V (P2) | M1 优先使用 `mc:Fallback` 图片；无回退渲染为纯文本；M4+ 提供 MathML 子集 |
| 查找 / 替换 | – | E (P1) | | | 见 ED-13 |

---

## 3. 需求

### OF-01 打开 pptx（客户端）

- 优先级：P0 | 目标里程碑：M1 | 依赖能力：`FormatCodec`（`ooxml-pptx`）、`Unit`/`UnitScope`、`DocumentStore`、`errors`、`telemetry`
- 用户故事：作为编辑者，我希望把一个 `.pptx` 文件（本地选择 / 拖入 / URL / 集成方传入的字节）在浏览器里直接打开并看到与 PowerPoint 一致的内容，以便无需安装 Office 即可查看和编辑。
- 验收标准：
  - Given 一个合法 `.pptx`（语料库 T1/T2 任一），When 通过 `ArrayBuffer`/`Blob`/`ReadableStream`/URL 任一输入打开，Then 触发 `unit/opened`，当前页渲染完成，且无 `error/raised`（`severity=fatal`）。
  - Given 打开进行中，When 集成方通过 `AbortSignal` 取消，Then 在 ≤ 500 ms 内释放全部资源（`fiber.getEffects()` 为空），不产生半打开的 `Unit`。
  - Given 打开进行中，Then 每 ≥ 250 ms 或每完成 5% 至少上报一次进度事件 `unit/open-progress`（阶段：`unzip`/`parse-presentation`/`parse-slide`/`decode-media`/`render-first`）。
  - 指标：语料库 T1+T2 打开成功率 100%；打开时长满足 `04-non-functional-requirements.md` NF-01。
- 边界：同一页面可同时打开 ≥ 4 个 `Unit` 且互不影响（UnitScope 隔离，规避 Univer A10）。

### OF-02 文件类型识别、拒绝与错误码

- 优先级：P0 | 目标里程碑：M1 | 依赖能力：`FormatCodec` 的 `formats` 贡献点（按 MIME 注册）、`errors`
- 用户故事：作为集成方，我希望 SDK 对不支持或损坏的文件给出稳定的类型化错误码，以便我在自家产品里显示合适的提示与埋点。
- 验收标准：
  - Given `.ppt`（CFB 二进制），Then 拒绝并返回 `format.unsupported_binary`，耗时 ≤ 100 ms（只读文件头）。
  - Given 加密包，Then 返回 `format.encrypted`；Given 非 zip / 缺 `[Content_Types].xml` / 缺 `ppt/presentation.xml`，Then 返回 `format.pptx.invalid_package` 并附 `details.part`。
  - Given `.ppsx`/`.potx`，Then 按 pptx 打开，`unit.meta.contentType` 记录原内容类型，导出时保持。
  - Given `.pptm`，或任意扩展名但主内容类型为 `application/vnd.ms-powerpoint.*.macroEnabled.*`、或包内含 `vbaProject.bin`，Then 拒绝并返回 `format.macro_rejected`，界面提示「请另存为 .pptx 后再导入」；不解析幻灯片、不保留宏部件（章程 Q15，rulings §4.16）。
  - Given Strict 命名空间文件，Then 打开成功，`unit.meta.conformance = "strict"`。
  - 全部错误码为点式 `<domain>.<snake_case_name>`（架构 10 §1.1），通过声明合并登记到 `ErrorCodes` 并有 i18n 文案；错误码列表由 CI 与文档同步（架构 10）。

### OF-03 渐进加载与懒解析

- 优先级：P0 | 目标里程碑：M1 | 依赖能力：`FormatCodec` 懒解析能力、`engine-render` 视口/虚拟化、`RenderTarget`
- 用户故事：作为编辑者，打开 200 页的演示文稿时，我希望 1–3 秒内看到第一页并能翻页，而不是等全部解析完。
- 验收标准：
  - Given 参考文稿 D200，When 打开，Then 首页可见时间与全部解析完成时间满足 NF-01（首屏 ≤ 3.0 s，后台全解析 ≤ 20 s）。
  - Given 用户跳转到未解析的页，Then 该页优先解析并在 ≤ 300 ms 内可见（p75）。
  - Given 媒体（图片/视频）不在视口，Then 不解码其字节（懒媒体）；进入视口前 1.5 个视口高度预取。
  - 解析顺序：`presentation.xml` → 母版/版式/主题 → 首页与相邻页 → 缩略图队列 → 其余页（后台，可被用户导航抢占）。

### OF-04 样式继承链解析

- 优先级：P0 | 目标里程碑：M1 | 依赖能力：`model-slide` 样式继承纯函数、`ooxml-core` DrawingML 编解码
- 用户故事：作为编辑者，我希望占位符文字的字体/颜色/项目符号与 PowerPoint 完全一致，即使它们是从母版继承来的。
- 验收标准：
  - Given 语料库 T1 中「继承专项」子集（≥ 40 个文件，覆盖：占位符 `type`/`idx` 匹配、`lstStyle` 各级、`p:style` 四类引用、`clrMapOvr`、主题字体 `+mj/+mn` 与 `ea/cs` 脚本选择、`bgRef`），Then 解析结果与 oracle 属性表逐项一致率 100%（属性表由 python-pptx 或 PowerPoint COM 导出，架构 11 定义）。
  - Given 任一属性未在链上任何层定义，Then 使用 ECMA-376 规定的默认值（如字号 18pt、`algn=l`），不得使用「看起来合理」的值。

### OF-05 文本渲染保真与字体

- 优先级：P0 | 目标里程碑：M1 | 依赖能力：`engine-layout`（度量器可插拔、字体回退）、`render-dom`
- 用户故事：作为编辑者，我希望文本的换行位置、行数、对齐与 PowerPoint 一致，以便排版不会「跑版」。
- 验收标准：
  - Given 参照字体可用（oracle 与浏览器使用相同字体文件），Then 语料库文本框「行数一致率」≥ 95%，「行首字符一致率」≥ 90%（度量方法见 NF-02）。
  - Given 字体不可用，Then 按回退链（文档内嵌字体 → 集成方提供字体 → 同度量替代表 → 系统默认）选择，并上报 `render/font-fallback`（含缺失字体名，不含文本内容）。
  - Given CJK 文本，Then 禁则（行首禁止标点、行尾禁止开括号）与全角标点处理与 PowerPoint 一致（专项语料 ≥ 20 个）。
  - `Intl.Segmenter` 不可用时退化为按字符断行，且不崩溃。

### OF-06 形状与几何

- 优先级：P0 | 目标里程碑：M1 | 依赖能力：`engine-layout` 预设几何编译、`ElementRenderer`（`slide-render`）
- 验收标准：
  - 187 种 `prstGeom` 全部可渲染（含 `avLst` 调整值与 `gd` 公式求值），CI 用 187 个单形状文件与 oracle 比对：IoU（形状填充区域）≥ 0.95。
  - `custGeom` 命令集（`moveTo/lnTo/arcTo/quadBezTo/cubicBezTo/close` + 多 path + `fill="none"`/`stroke="0"`/`extrusionOk`）全覆盖。
  - 填充 / 线条 / 阴影按矩阵 §2.4 达标；未支持的效果组合退化为扁平渲染并保留属性。

### OF-07 图片与媒体

- 优先级：P0 | 目标里程碑：M1 | 依赖能力：`ElementRenderer`、`ooxml-core` 媒体部件与 blob 生命周期
- 验收标准：
  - 位图格式按矩阵 §2.5；`srcRect` 裁剪像素级正确（IoU ≥ 0.98）。
  - EMF/WMF：M1 有内嵌位图预览时显示预览，否则显示带图标的占位框并上报 `render/element-degraded{kind:"pic",reason:"emf-no-preview"}`；M2（P1）起按需加载栅格化 chunk 渲染，超出 OF-24 的 EMF 上限时回到占位并上报。
  - 媒体：编辑态显示海报帧；放映态可播放浏览器支持的编解码。
  - 外链资源（外链图片 `r:link`、外链音视频、链接 OLE）：外部关系全部原样保留，仅 `http(s)` 可激活；默认 `externalResources = auto` 自动加载（媒体 `preload="none"`）；部署配置为 `confirm` 时显示占位并在用户确认来源域名后加载，为 `never` 时一律占位；CSP 的 `img-src`/`media-src` 随配置收紧（EM-14）。服务端与 headless 渲染永不加载外链。
  - 所有 blob URL 归属 `Unit`，关闭后 100% 释放（测试断言 `URL.revokeObjectURL` 调用数等于创建数）。

### OF-08 表格

- 优先级：P0 | 目标里程碑：M1 | 依赖能力：`ElementRenderer`、`tableStyles` 解析
- 验收标准：
  - 8 案例原生矩阵（继承 pptx-renderer 的口径）+ 语料库表格子集：SSIM ≥ 0.90（表格区域裁剪比对）。
  - 合并单元格、条件边框（`firstRow/lastRow/bandRow/firstCol/lastCol/bandCol`）、显式清除边框、对角线边框全部覆盖。

### OF-09 图表

- 优先级：P0（查看） | 目标里程碑：M1（查看）/ M3（编辑） | 依赖能力：`ElementRenderer`（M1–M2 位于 `slide-render` 的惰性图表块；M3 起拆为可选插件 `slide-render-chart`，章程 §5.2）、`c:chart` 部件的不透明保留
- 用户故事：作为编辑者，我希望图表在浏览器里显示正确的数据与类型，即使坐标轴/图例布局与 PowerPoint 略有差异。
- 验收标准（章程 D16）：
  - **M1–M2**：`c:chart` 部件不透明保留；渲染器**只读解析**部件与缓存数据（`c:numCache`/`c:strCache`）以满足查看：矩阵 §2.6 的类型全部可渲染；数据点数值与类别 100% 来自缓存；单图表页 SSIM ≥ 0.80 且「数据墨迹区域 IoU」≥ 0.85（继承 pptx-renderer 的 plot-bound/data-ink 诊断）。不要求 M1–M2 在 `model-slide` 中建立可编辑的图表模型。
  - **M3 起**：数据模型与编辑（`slide-render-chart`）；可编辑类型为 bar / line / pie / area / scatter 五类（章程 Q18 已裁决，rulings §4.12 U-06），其余类型仅查看；编辑范围见 ED-15。
  - chartex（`cx:`）不在本条 M1 验收范围：只保留并显示诊断占位（矩阵 §2.6）。
  - 图表渲染块缺席（插件未加载或惰性块加载失败）时显示占位框，其余功能不受影响（可插拔证据）。
  - 图表渲染库许可须为 Apache-2.0/MIT（章程 D13）；图表代码块按需加载，体积预算见 NF-01。

### OF-10 SmartArt

- 优先级：P0（查看） | 目标里程碑：M1 | 依赖能力：`ElementRenderer`、元素级不透明保留
- 验收标准：
  - 有 `dsp:drawing` 部件的 SmartArt：M1 必须渲染（`ooxml-core` 只读解析 `dsp:drawing`，含 `dsp:txXfrm`），SSIM ≥ 0.85；无 `dsp` 部件：占位框 + 上报。
  - 整体移动/缩放/删除（M2）后导出，PowerPoint 打开时 SmartArt 仍可正常编辑（`dgm` 四部件与 `dsp` 部件关系完整）。

### OF-11 备注、评论、节的读取

- 优先级：P0（保留）/ P1（查看） | 目标里程碑：M1 / M2 / M3 | 依赖能力：`FormatCodec`、`ResourceHook`
- 验收标准：
  - 备注文本 M1 可在备注面板显示；备注页其它形状保留。
  - 旧式与现代评论部件 M1 完整保留；M3 只读展示旧式评论、读写现代评论（见 CO-04）。
  - 节列表 M1 保留；M2 缩略图分组显示。

### OF-12 动画、切换、OLE、3D、墨迹等的保留

- 优先级：P0 | 目标里程碑：M1 | 依赖能力：元素级 + 部件级不透明保留
- 验收标准：
  - 语料库 T1「保留专项」子集（≥ 30 个文件：每种保留类特性至少 3 个），Given 打开后不做任何编辑导出，Then 部件级 diff 零差异（§4.1）。
  - Given 对同页其它元素做编辑后导出，Then 该页 `p:timing`/`p:transition`/`extLst` 子树规范化后逐字节一致，且引用的元素 id（`spid`）仍有效。
  - Given 删除一个被动画引用的元素，Then 导出时从 `p:timing` 中移除对应引用（或整段时序失效时移除该 `p:par`），PowerPoint 打开无修复提示。

### OF-13 错误隔离与降级渲染

- 优先级：P0 | 目标里程碑：M1 | 依赖能力：`engine-render` 逐元素错误边界、`errors`、`telemetry`
- 验收标准：
  - Given 一页中某元素渲染抛错，Then 该元素显示占位框（带「无法渲染」图标与 i18n 文案），同页其余元素与其它页正常；上报 `render/element-failed{kind, code}`。
  - Given 某个 `ElementRenderer` 插件整体加载失败（进入 `FAILED`），Then 其 kind 的元素全部占位，其余功能可用（规避 Univer A11）。
  - 降级/失败元素在编辑器中可选中、可移动、可删除，但内部不可编辑。
  - 「保真诊断面板」（M2，P1）列出当前文档所有降级项及原因。

### OF-14 只读查看模式

- 优先级：P0 | 目标里程碑：M1 | 依赖能力：`Preset`（`preset-slide` 的 viewer 子集）、`permissions`
- 用户故事：作为集成方，我希望只引入「查看器」就能展示 pptx，不带任何编辑 UI 与编辑代码。
- 验收标准：
  - `preset-slide-viewer`（已纳入章程 v0.2 §5.2，**依赖已满足**；M1 验收含「`preset-slide-viewer` 可用」）：仅含打开 + 渲染插件，无编辑 UI、无 collab，体积满足 NF-01；无 `commands` 可执行的编辑命令。
  - `allowExport` 默认关，集成方显式开启（rulings §4.12 U-03）：未开启时不出现导出入口、`doc.export` 能力位不放行；开启方式与权限模型见 M-11 §2.5/§4.3。
  - 查看模式支持：翻页、缩放（10–400%）、适应窗口、缩略图导航、备注查看、文本搜索（M2 P1）、超链接点击。其中**缩略图导航（缩略图条）与备注查看（备注抽屉）为可选能力**（2026-09-18 Q18）：默认关闭，由宿主选项开启（选项名以架构 02 / EM-02 配置口径为准），开启后按需加载，其代码与资源**不计入 350 KB gzip 基线**（NF-01）；未开启时查看器不渲染任何相关入口。设计 03-screens/25 与 playground `#/viewer` 已补两者。

### OF-15 缩略图（客户端）

- 优先级：P0 | 目标里程碑：M1 | 依赖能力：`slide-render` 缩略图、`engine-render` 缩放渲染
- 验收标准：
  - 侧栏缩略图为按比例缩放的 DOM/SVG 渲染（非位图），仅对视口内 + 上下各 10 项挂载；每项 ≤ 40 ms（p75）。
  - 文档卡片封面不由客户端生成（rulings §4.15 Q8）：M2 取包内 `docProps/thumbnail.jpeg`（无则占位，SV-04）；M3 起由服务端 headless 渲染 640 px WebP。客户端在本机可用 dom-scaled 缓存覆盖过时的包内封面。
  - 客户端位图导出（PNG，OF-19）M2：每页 ≤ 150 ms，1280 px 宽；toImage 路径的 Web 字体问题列 M2 spike，结论出来前客户端缩略图只用 dom-scaled。
  - 编辑后 ≤ 500 ms 内缩略图更新（脏页驱动，规避 Univer A28）。

### OF-16 文本搜索

- 优先级：P1 | 目标里程碑：M2 | 依赖能力：`Model` 文本索引（模型级，非 DOM）
- 验收标准：搜索基于模型（未挂载页也能命中）；结果含页索引、元素 id、片段与包围盒；跳转并高亮元素级包围盒；D200 全文搜索 ≤ 200 ms。

### OF-17 内嵌字体加载

- 优先级：P1 | 目标里程碑：M2 | 依赖能力：`ooxml-core` 字体部件解混淆、`engine-layout` 字体注册、OF-25 资源上限
- 验收标准：`.fntdata` 解混淆并以 `FontFace` 注入 `Unit` 作用域；关闭 `Unit` 后卸载；超出上限（单字体 ≤ 20 MB，总计 ≤ 60 MB，处理时长 ≤ 3 s；全仓以本条为内嵌字体上限的唯一口径）时跳过并上报 `render/font-fallback`。
- 许可位（OS/2 `fsType`，rulings §4.15 Q7，fail-closed）：「受限（Restricted）」与「仅预览/打印」字体**只用于只读渲染**（查看、放映、缩略图、PDF，含服务端）；编辑态中用到它的文本改用回退字体并上报 `render/font-fallback{reason:"font-license"}`，文档仍可编辑（协同时不因一个字体把所有人锁成只读；代价是编辑态与查看态字形可能不一致，诊断面板列出）；导出时内嵌字体部件原样保留，不新增内嵌。

### OF-18 不透明保留与导出 pptx

- 优先级：P0 | 目标里程碑：M1（零编辑往返）/ M2（编辑后导出） | 依赖能力：`ooxml-core` 脏部件追踪、元素级 `extensions` 槽、`FormatCodec` 导出、`Snapshot` 编解码边界
- 用户故事：作为编辑者，我希望导出的文件在 PowerPoint 里打开不报修复，并且我没碰过的内容一个字节都不变。
- 验收标准：
  - **零编辑往返**：Given 语料库 T1+T2 任一文件，When 打开后直接导出，Then 部件集合相同、每个部件字节相同（§4.1 定义），zip 元数据（时间戳、压缩级别）允许不同。
  - **编辑后导出**：Given 仅编辑第 k 页的一个文本，Then 只有第 k 页部件（及必要的 `[Content_Types].xml`/rels/`docProps/thumbnail`）被重生成，其余部件字节相同；重生成部件通过 ECMA-376 Transitional XSD 校验；规范化 XML diff 仅位于被编辑的 `a:p`/`a:r` 子树。
  - **元素级保留**：Given 被编辑元素带 `extLst`/未知属性/未知子元素，Then 重生成后全部保留且顺序符合 schema 序列要求。
  - **新增部件**：插入图片/媒体时新部件命名不与现有冲突（`image<N>.<ext>`，N 取最大值+1），内容类型与 rels 同步更新。
  - **互操作**：导出文件在 PowerPoint 365（Windows/macOS，当前通道）打开无修复提示：语料库 100%；LibreOffice Impress 24.x 可打开不崩溃（best-effort，记录差异）。
  - **Strict 输入**（章程 §10 Q14 已裁决：方案 C，2026-09-19，rulings §4.12 U-02）：方案 C「保持原一致性类」——脏部件反向映射写回 Strict，未触碰部件字节相同；**M1 即支持 Strict 完整写回**（反向映射表 + 字节级验证）；方案 B「整包转 Transitional」仅作反向映射失败时的异常兜底，并在导出报告中说明。无论方案：零编辑往返字节相同、PowerPoint 365 打开无修复。
  - 导出在 Worker 中执行，不阻塞 UI（D50 ≤ 3 s，D200 ≤ 12 s）。

### OF-19 导出为图片 / PDF / SVG（客户端）

- 优先级：P1 | 目标里程碑：M2（PNG/SVG）/ M3 后半段（PDF，服务端为主） | 依赖能力：`RenderTarget('dom')` 的 SVG 序列化 / toImage 栅格化（章程 §6.2 渲染介质 = DOM/SVG 单实现）、`server-headless`（PDF，独立 renderer sidecar）
- 验收标准：
  - 单页 / 选定页 / 全部页导出 PNG（宽度可选 1280/1920/3840）与 SVG（自包含，字体以 `@font-face` 内嵌为可选）。
  - 批量 PNG 从 M3 起走服务端（server-png）。
  - 客户端 PDF 为 P2（矢量优先）；服务端 PDF（M3 后半段，rulings §4.15 Q8）通过 headless Chromium 打印，与 oracle PDF 的逐页 SSIM ≥ 0.85。
  - 导出结果不含协同覆盖层（光标、选区、评论锚点）。

### OF-20 视觉回归语料库与 oracle 流程

- 优先级：P0 | 目标里程碑：M1 | 依赖能力：架构 11 测试策略（PRD 只定义产品验收口径）
- 验收标准：
  - 语料库分层：T1 「规范语料」≥ 80 个手工构造文件（每个矩阵行至少 1 个）；T2 「真实语料」≥ 200 个脱敏真实文件（覆盖 ≥ 5 种生产者：PowerPoint Win/Mac、Google Slides 导出、Keynote 导出、WPS、LibreOffice）；T3 「压力语料」≥ 10 个（D200、单页 1000 元素、200 MB 媒体、深度嵌套组合 ≥ 8 层）。
  - 每个语料文件带 oracle 产物（PowerPoint 导出 PNG @1280px + PDF）与 SHA-256 指纹；CI 报告按矩阵行聚合 SSIM 中位数与 P10。
  - 阈值不达标即 CI 失败；阈值只能收紧不能放松（ratchet，同类型治理 ADR-0040 精神），例外需 `cordex-allow` 标注与 issue。

### OF-21 演示文稿元信息与文件属性

- 优先级：P2 | 目标里程碑：M2 | 依赖能力：`FormatCodec`（docProps）
- 验收标准：属性对话框显示标题/作者/创建时间/修改时间/页数/字数（只读）；编辑标题/作者为 P2；导出时 `dcterms:modified` 仅在有编辑时更新。

### OF-22 从模板 / 空白新建

- 优先级：P1 | 目标里程碑：M2 | 依赖能力：`FormatCodec`、`Preset` 自带默认模板
- 验收标准：新建空白文稿（16:9，默认 Office 主题，一个标题页）≤ 300 ms；从 `.potx` 新建保留全部母版/版式；生成文件在 PowerPoint 打开无修复。

### OF-23 打开 URL 与断点续传

- 优先级：P2 | 目标里程碑：M2 | 依赖能力：集成方存储回调（见 `05-embedding-and-integration.md` EM-04）
- 验收标准：支持 `Range` 请求分块下载（可选），下载进度纳入 `unit/open-progress`；失败重试 3 次指数退避。

### OF-24 输入安全限制

- 优先级：P0 | 目标里程碑：M1 | 依赖能力：`ooxml-core` OPC 解析限制、`errors`
- 验收标准（默认值，集成方可收紧不可放宽超过 2 倍）：zip 条目数 ≤ 4,000；单条目解压 ≤ 64 MiB；总解压 ≤ 512 MiB；媒体总量 ≤ 256 MiB；XML 嵌套深度 ≤ 256；实体扩展禁用；图表点数每序列 ≤ 10,000；位图预览 ≤ 16,777,216 像素。EMF/WMF 栅格化（M2，rulings §4.15 Q7）：单文件记录数、输出像素（≤ 上述位图预览像素上限）与单文件耗时（在 Worker 中可中止）设上限，初始值由 M2 spike 定并回填本条；超限回到占位。超限返回 `format.limit_exceeded{limit, actual}`（HTTP 413）。（参考 pptx-renderer `RECOMMENDED_ZIP_LIMITS`，按章程 Q5 放宽。）
- 文档规模天花板（200 页 / 单页 1,000 元素 / 文档总元素 20,000）由服务端导入执行，超出直接拒绝 `format.quota_exceeded{dimension, limit, actual}`，见 SV-08（rulings §4.15 Q5）。

### OF-25 宿主字体供给

- 优先级：P0 | 目标里程碑：M1 | 依赖能力：`engine-layout` 字体注册 Definition（Provider 可替换）
- 验收标准：集成方可按字体族提供 `FontFace` 源（字节或 URL）与同度量替代表；SDK 不内置 CJK 字体（PD-12）；缺失字体在「保真诊断面板」列出。

---

## 4. 保真度量口径（产品验收定义；测试实现见架构 11）

### 4.1 部件级 diff（结构保真）

| 情形 | 判定 |
|---|---|
| 零编辑往返 | 导出包的部件路径集合 == 源；每个部件 SHA-256 相同；`[Content_Types].xml` 与所有 `.rels` 亦相同。zip 本身的条目顺序、时间戳、压缩方法不计入 |
| 编辑后：未触碰部件 | 字节相同 |
| 编辑后：脏部件 | (a) XML 良构且通过对应 XSD；(b) C14N + 属性排序 + 忽略无意义空白后的 diff 仅落在被编辑元素子树；(c) 被编辑元素的未知属性/子元素/`extLst` 全部保留；(d) 元素 id（`cNvPr@id`）在部件内唯一且被引用处一致 |
| 编辑后：派生部件 | 允许变化的白名单：`docProps/core.xml`（`dcterms:modified`）、`docProps/app.xml`（页数/字数）、`docProps/thumbnail.jpeg`、`[Content_Types].xml`（新增类型）、被新增/删除部件影响的 `.rels` |
| 删除页 | 页部件及其独占的 rels 目标（媒体、图表、备注）被移除；共享目标保留；无孤儿部件（除非源文件本就有） |

### 4.2 视觉保真（SSIM，与 PowerPoint 365 导出 PNG @1280px 比对，灰度 + 彩色直方图）

| 语料类别 | 中位数 | P10 | 备注 |
|---|---|---|---|
| 纯文本页 | ≥ 0.92 | ≥ 0.85 | 参照字体可用 |
| 形状 / 填充 / 线条 | ≥ 0.95 | ≥ 0.88 | |
| 图片 | ≥ 0.95 | ≥ 0.90 | 排除 EMF 无预览 |
| 表格 | ≥ 0.90 | ≥ 0.82 | |
| 图表 | ≥ 0.80 | ≥ 0.70 | 另加数据墨迹 IoU ≥ 0.85 |
| SmartArt（有 dsp） | ≥ 0.85 | ≥ 0.75 | |
| 效果 / 3D（近似） | ≥ 0.75 | 无 | 仅监控不门禁 |
| 全语料（T1+T2） | ≥ 0.90 | ≥ 0.80 | M1 门禁 |

以上为初始预算，M1 中期以实测校准一次；校准只能收紧。

### 4.3 文本度量（补充 SSIM 对文本不敏感的缺陷）

- 行数一致率 ≥ 95%（文本框级，oracle 行数来自 PowerPoint COM/AppleScript 导出的行信息或 PDF 文本提取）。
- 行首字符一致率 ≥ 90%。
- 文本框包围盒 IoU ≥ 0.85（`spAutoFit` 形状）。

### 4.4 互操作

- PowerPoint 365 Win/Mac 打开无修复提示：100%。
- 重新用 PowerPoint 保存后再用我们打开：不崩溃，SSIM 不低于首次打开的 0.98 倍（稳定性回归）。

---

## 5. 与其它域的接口

| 本域产出 | 消费方 |
|---|---|
| 支持矩阵的 `E` 等级 | `02-editing.md` 的编辑需求以此为上限 |
| 错误码与降级事件 | `06-metrics-and-analytics.md` 事件清单；`05-embedding-and-integration.md` EM-12 |
| 语料库与阈值 | `04-non-functional-requirements.md` NF-02；`05-milestones-and-scope.md` M1 验收 |
| 服务端导出 | `06-server-and-ops.md` SV-02 |
