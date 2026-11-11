> 状态：草稿 v0.1 | 负责：架构-模块（阶段二，M-03） | 更新：2026-09-18；2026-09-24（rulings §4.15）；2026-09-24（复核修正，rulings §4.17 D2：编辑期超上限常量映射到 `document.quota_exceeded{dimension}`）；2026-09-25（补图）；2026-09-25（矛盾收口，rulings §4.18）；2026-09-25（§4.19）；2026-09-26（§4.20）；2026-09-26（§4.21：模型与命令文件落点——`sp.ts` 补 `isTextBox`、`pic.ts` 补 `media` 与 `BlipFill.alpha/svgMediaId`、`non-visual.ts` 补 `decorative`、`theme.ts` 补只读 `objectDefaults`；表格归一化与不变量 I-TBL1/I-TBL2、空组不变量 I-GRP1；新增 9 个 Mutation、33 个命令、1 个 Operation 与 13 个文件；`chart.*` 定 M3；`Hyperlink.target` 判别联合、`UnknownShape.source`、`Slide.showMasterShapes`、`Presentation.firstSlideNum`）；2026-09-26（§4.21 整合：§2.6 登记 50/18 §28 第二批薄命令与参数扩展（含 setBodyProperties、bringToFront/sendToBack）、setHeaderFooter 的 date 形状与确定性 id、setHyperlink 端点寻址、insertFreeform 改收拟合几何、flipShapes 加 reroute、ConnectorPatch 字段、resetPicture 改 pixelSize；§2.1 登记 I-PH1 与 fillPlaceholder 前置；§2.2 FracKey 改 rocicorp 键格式、BlipFill 补 external 与 effects；mutations/chart 写法对齐 30/05；新增 text-search.ts、invariants/placeholder.ts、section-commands.ts 三个文件（127 个））；2026-09-26（§4.21 复核：setBorders 参数统一为 `borders: {preset; line}`）；2026-09-30（§4.21 剩余缺口样张回写 · 整合：§2.6 `slide.table.setBorders` 的 `preset` 按设计 03-30 样张的 10 个预设给出枚举，以 03-30 §13 第 16 条用户确认为准）；2026-09-30（§4.22 设计待决收口：§2.6 `setBorders` 的 10 值 `preset` 定稿；`splitCell` 注明只拆合并格、按行列数拆分推迟及触发条件）；2026-10-04（design-language-v3 第 0 批：§1.1 不做项改为工具条 / 检查器贡献；§2.6 采纳理由的测试名改为 `toolbar-spec.test.ts`；§12 建议行改为工具条与检查器绑定（rulings §4.25 DS-1、DS-5））；2026-10-07（design-language-v3 第 1 批：§2.6 `slide.reorderSlides` 参数由 `{slideId;after?}` 改为 `{slideIds;after?}`，多选整体拖动与跨节拖动为一个事务（设计 03-14 §3.2、50/10 §6）；Operation `slide.chart.openDataEditor` 的语义按 rulings §4.25 DS-26、TB-12 写明缺省只展开检查器「数据」分区、`expanded:true` 才是加宽到 400 的数据面板；§5 `query/text-search.ts` 与 §9 第二批命令测试行按 rulings §4.25 TB-27 改为 M2 只查幻灯片内容、不含演讲者备注（50/18 FND-01 同批删去 `includeNotes`）；文件数不变）；2026-10-08（design-language-v3 第 1 批收口：§2.6 增「第三批」两个薄命令——`slide.renameMaster{masterId; name}`（母版改名，`master.setProperties` 的薄命令、与 `renameLayout` 对称，M3，rulings §4.25 TB-46）与 `slide.setShapeOpacity{shapeIds; alpha}`（形状「不透明度」同时写填充与描边颜色的 alpha、一步撤销，TB-47），契约同步 30/05 §14.4；`master.setProperties` 的 patch 增 `name`；§0、§3 命令计数 109 → 111，§5 `shape-commands.ts` 19 → 20、`master-commands.ts` 6 → 7；§9 增测试行；文件数不变）；2026-10-15（design-language-v3 第 2 批：§2.6 Operation `slide.chart.openDataEditor` 行的数据面板宽度按 rulings §4.25 TB-60 改为 max(400, 检查器当前宽度)、开着时分隔条不可拖、关闭后回到原宽；命令、参数与文件数不变）；2026-10-22（design-language-v3 第 3 批：§2.6 `slide.setZoom` 一行注明 slide-ui 注册的两个无参别名 `slide.zoomToFit`、`slide.zoomTo100`——只转调本条、命令 id 不在本包，免得撞号（rulings §4.25 TB-149，30/05 §7）；本包命令数与文件数不变）；2026-11-04（design-language-v3 母版视图改版：§1.2 术语「范围条」一行改为「编辑对象」——窗格选中即编辑对象，原称范围条的「版式 / 母版」两态取消（rulings §4.25 DS-146）；§2.6 `slide.selectMasterOrLayout` 的需求落点由范围条改为母版窗格选中，并注明 slide-ui 另注册的两个无参 Operation `slide.openPlaceholderMenu`、`slide.viewLayoutPages` 不在本包（TB-207，30/05 §7）；`slide.renameMaster` 的界面入口改为母版窗格就地改名与母版检查器「名称」字段（DS-150 ①）；命令、参数、本包命令数与文件数不变，需求编号、优先级与里程碑不变）；2026-11-05（prd-v3-current：§2.3 `planLayoutChange` 对 PRD 07-masters 的出处由行号改为按内容引用 ML-02「占位符重匹配规则」，L0；§12 G-8 引用的 PRD ML-03 原文改为现行措辞「内容族的上限未定，待架构 30/04 §12.1 补表」；命令、参数、本包命令数与文件数不变） | 依赖：00-module-map.md M-03、charter v0.2 §4/§5.2 `model-slide` 行/§5.5、30-architecture 04 §3/§4/§6/§8/§9/§12、05 §7/§13、02 §4.8、rulings-2026-09-14 §4.10、PRD `10-prd/03-features/07-masters-layouts-and-themes.md`、ADR-0006/0008/0011/0013/0014/0032、rulings §4.25 DS-146、DS-150、TB-200、TB-207

# 03 幻灯片领域模型（限界上下文 BC-06 幻灯片领域模型）

## 0. 一页总览

| 项 | 值 |
|---|---|
| 职责一句话 | 幻灯片对象模型（Presentation/Master/Layout/Slide/Shape 树/TextBody/Theme）的归一化实体表、幻灯片 Mutation 与 Command、样式继承链纯函数、母版/版式/主题引用完整性不变量与 `reassignTo` 语义、`slides` 只读服务 |
| 覆盖的上下文 | BC-06 幻灯片领域模型 |
| 承载包 / 目录 | `@cordexjs/model-slide`（层带 V-model，秩 15，iso），`packages/model-slide/src/` |
| cordis 形态 | plugin（主插件只读部分 + `editing` 编辑子插件，两段式加载） |
| 运行位置 | 两端（浏览器 + `server-headless` 的 Node cordis 宿主加载同一份源码） |
| 上游（依赖） | M-02（`@cordexjs/kernel`/`@cordexjs/shared`/`@cordexjs/model-core`：`DocumentType`、`DocumentStore`/`StoreOp`、Command/Mutation/Operation 三分法、`Snapshot`/`Persisted<T>`、`ResourceHook`、`permissions`、`drawing/` 共享绘图词汇） |
| 下游（被依赖） | M-04（`ooxml-pptx` 对本包做 ACL）、M-07（`slide-render` 读 `slides` 服务）、M-10（`slide-ui` 消费命令与只读服务）、M-11（预设装配挂载本包）、M-13（`model-doc`/`model-sheet` 的样板） |
| 对外服务 | `ctx.slides`（UnitScope 内，只读投影 + 便捷命令封装，见 04 §3.4） |
| 贡献点 | 提供：`slide.shapeKind`；向 BC-05 贡献条目：`core.documentType`（1 个：`slide`）、`core.mutation`（51 个，M3 起 56 个，§2.6；2026-09-26 rulings §4.21 由 46/47 上修）、`core.command`（111 个，含 5 个 Operation，§2.6——2026-09-25 增 `slide.duplicateShapes`、`slide.applyAutofit` 后为 75；2026-09-26 rulings §4.21 新增 33 个命令与 1 个 Operation，其中 13 个 M3 起可用；14 §1 C-03 新增 18 个后由 55 上修，`slide.setNotes` 待 M3；2026-10-08 由 109 增 `slide.renameMaster`、`slide.setShapeOpacity`，rulings §4.25 TB-46、TB-47；§2.6「第二批」薄命令另列，沿用原口径未并入本数）、`core.migration`（M1 为空表但注册） |
| doc / sheet 通用性 | vertical（`bundle=slide`；对应 BC-29 规划位的 `model-doc`/`model-sheet`，铁律 2 强制互不 import） |
| 批次 | 1 |

### 0.1 图示

**图 0-1 模块包关系与上下游**

```mermaid
flowchart LR
  m02["M-02 内核与文档内核"]
  subgraph bc06["BC-06 幻灯片领域模型"]
    pkgModelSlide["@cordexjs/model-slide"]
  end
  m04["M-04 ooxml-pptx 编解码"]
  m07["M-07 slide-render 幻灯片渲染"]
  m10["M-10 slide-ui 幻灯片 UI"]
  m11["M-11 预设装配"]
  m13["M-13 model-doc 与 model-sheet"]
  m02 -- "DocumentType DocumentStore StoreOp Command Mutation Operation 三分法 Snapshot ResourceHook permissions drawing 词汇" --> pkgModelSlide
  pkgModelSlide -- "PresentationBody 六表 ACL 边界" --> m04
  pkgModelSlide -- "ctx.slides 只读服务 ChangeSet.touched" --> m07
  pkgModelSlide -- "commands.execute ctx.slides" --> m10
  pkgModelSlide -. "样板模式参照" .-> m13
  m11 -- "两段式装配 plugin 与 editing" --> pkgModelSlide
```

怎么读：本包只有一个上游 M-02（文档内核契约），下游扇出到编解码、渲染、UI 与预设装配四个方向；`model-doc`/`model-sheet` 与本包是"参照样板"而非依赖关系（铁律 2 互不 import）。

## 1. 限界上下文与边界

### 1.1 职责与非职责

**做什么**：
- 定义 `PresentationBody` 归一化实体表（`presentation`/`masters`/`layouts`/`slides`/`themes`/`shapes`/`media`/`opaqueParts`）及其判别联合形状（`Shape`=`Sp|Pic|GrpSp|CxnSp|GraphicFrame|UnknownShape`），全部字段为 `Persisted<T>`（04 §7）。
- 定义幻灯片专属 `Mutation` 判别联合与其 `lower()` 纯函数（语义变更 → `StoreOp[]`，ADR-0013），以及 `Command`/`Operation` 定义（参数 schema、能力位、`undoable`）。
- 定义样式继承链解析纯函数（Run→Paragraph→TextBody→Shape→Layout 占位符→Master 占位符→Master.textStyles→Presentation.defaultTextStyle→Theme，04 §6）与母版/版式/主题的重匹配/重置/依赖反查纯函数（04 §12.2）。
- 定义引用完整性不变量 `I-ML2`…`I-ML8`（check/repair 纯函数，ADR-0034 的 slide 实例，04 §12.3）与 `validateChangeSet` 的映射配置。
- 向 `core.documentType` 贡献 `slideDocumentType`（`id:'slide'`），向 `slide.shapeKind` 贡献内建形状类型（`sp`/`pic`/`grpSp`/`cxnSp`/`graphicFrame:table|chart|ole|diagram`/`unknown`）。
- 提供 `slides`（UnitScope 内只读服务）：`body()`/`slide(id)`/`shape(id)`/`order()`/`shapesOf()`/`resolved.*`/`exec.*`（便捷命令封装，内部仍 `commands.execute`）。
- 承载 `extensions`（`OpaqueXml[]`）不透明槽——**每个已建模实体都有**，但只是槽位声明与合并/序列化的类型面；槽内 XML 字符串的产生/解析属于 M-04。

**不做什么（指向负责模块）**：
- 不做 Store 事务执行、命令管线（resolve/validate/waterfall/transact/history/audit）、权限判定、Snapshot 编解码与迁移调度、`ResourceHook` 收集——全部是 M-02 `model-core` 的职责；本包只**贡献**类型化条目。
- 不做任何 XML 解析/生成、OPC 包读写、不透明保留的字节级算法——是 M-04（`ooxml-core`/`ooxml-pptx`）的 ACL 职责；本包不出现任何 XML 类型，只暴露 `extensions: OpaqueXml[]` 槽供 M-04 读写。
- 不做场景合成、命中测试、脏区渲染——是 M-07（`slide-render`）的职责；本包只暴露只读 `slides` 服务与 `ChangeSet.touched`。
- 不做 CRDT 映射、awareness、离线队列——是 M-05（`collab-*`）与 M-02（`store-yjs`）的职责；本包的 `Mutation`/`lower()` 对协同模式无感知，并发语义只以「Store 层 LWW + 不变量修复」表达（04 §12.3、05 §13.4）。
- 不做任何 UI 组件、工具条 / 检查器贡献、快捷键——是 M-10（`slide-ui`）的职责。
- 不做图表可编辑数据模型（M1–M2 仅 `Chart.partRef` 占位 + `ooxml-core/chartml` 只读解析，M3 起 `Chart.data` 才在本包建模，charter D16）。

### 1.2 通用语言

复用 charter §4.1 核心术语：`DocumentType`、`Model`、`DocumentStore`、`StoreOp`、`Mutation`、`Command`、`Operation`、`Transaction`、`Origin`、`ChangeSet`、`Snapshot`、`Derived<T>`/`Persisted<T>`、`ResourceHook`、`FormatCodec`、`Scene`/`SceneProvider`、同构类、层带。本上下文特有术语：

| 术语 | 定义 | 对应类型名 |
|---|---|---|
| Presentation | 聚合根，单例，承载页序/母版序/默认文本样式/属性 | `Presentation`（`PresentationBody.presentation`） |
| 归一化实体表 | 有身份对象按 `Record<Id, Entity>` 存储，顺序由 `order: FracKey` 字段承载，引用用 id | `PresentationBody` 的六张表 |
| 占位符继承 | 页/版式上占位符形状的可继承字段缺省即向上查链解析，不烘焙 | `PlaceholderRef`、`InheritableField`、`ResolvedRunProperties` 等 |
| `reassignTo` | 删除被引用版式/母版时，显式指定重指目标以避免 fail-closed 拒绝；`deleteLayout` 的是目标版式，`deleteMaster` 的是目标母版（逐页按 `defaultLayoutOf` 取对应 `type` 的版式，rulings §4.20 FE-23） | `deleteLayout({ layoutId, reassignTo?: LayoutId })`、`deleteMaster({ masterId, reassignTo?: MasterId })` |
| 默认版式 | 版式/母版删除或悬空修复时的回退目标，按 30/04 §12.3 I-ML2 链选取：原母版下同 `type` 的首个版式 → 该母版首个版式 → 首个母版的首个版式，跳过墓碑与 `exclude` 中的版式（rulings §4.20 FE-03） | `defaultLayoutOf(body, {masterId, type?, exclude?})`（`domain/invariants/reassign.ts`）：命令层 `reassignTo`、I-ML2 修复与 ADR-0034「`layoutId` 不存在」修复共用同一符号 |
| FracKey 排序 | 同容器内形状/页/版式/母版的顺序键，`compare = (order, id)`，无数组下标 | `Shape.order`/`Slide.order`/`SlideLayout.order`/`SlideMaster.order: FracKey` |
| 编辑对象 | 母版视图中窗格选中的母版或版式：窗格选中即编辑对象（不改变模型，Operation 级；2026-11-04 起，rulings §4.25 DS-146） | `slide.selectMasterOrLayout` Operation 与 `editTargetKind` 上下文键 |
| 表格归一化（2026-09-26，rulings §4.21） | 表格的列、行、格是按 id 的三张记录表，行列顺序由 `order: FracKey` 承载，格键为 `RowId:ColId`；删除行列写墓碑 | `Table.columns/rows/cells`、`CellKey`（30/04 §3.8） |
| 插入命令（2026-09-26，rulings §4.21） | 新增元素的命令族：统一经规模守卫、一个事务按需 `media.add` + `shape.insert`、插入后选中为事务外 Operation | `application/commands/insert-common.ts` 的 `planInsert` |

### 1.3 上下文映射

| 相邻上下文 | 关系类型 | ACL / 落点文件 | 传递的契约 |
|---|---|---|---|
| BC-05 文档内核（上游） | Customer–Supplier（本包为下游 Conformist，对 `DocumentType`/`DocumentStore`/`CommandDef`/`MutationDef` 无议价权） | `model-core/src/{unit,store,command,snapshot}/*.ts` | `DocumentType<PresentationBody>`、`StoreOp`、`Result<T,E>` |
| BC-02 共享基础设施（上游，经 BC-05 转发） | Shared Kernel | `model-core/src/drawing/*.ts` | `Color`/`Fill`/`Line`/`Transform`/`FontRef`/`TextBody` 等值对象原型 |
| BC-08 PPTX 编解码（下游） | **Anticorruption Layer**（`ooxml-pptx` 是 ACL，本包对其是「被翻译的领域语言」一侧） | `ooxml-pptx/src/{import,export}/*.ts` | `PresentationBody` ↔ PresentationML（本包从不出现 XML 类型） |
| BC-12 幻灯片渲染（下游） | Customer–Supplier（`slide-render` 是客户，只读 `slides` 服务） | `slide-render/src/scene/slide-scene-provider.ts` | `SlidesService`（04 §3.4）、`ChangeSet.touched` |
| BC-15 幻灯片 UI（下游） | Customer–Supplier | `slide-ui/src/**` | `commands.execute()`、`ctx.slides` |
| BC-09 协同（客户端）/BC-05 store-yjs（水平，间接） | Conformist（本包的 Mutation/lower 对协同透明，不感知 CRDT） | — | `StoreOp`（Yjs 映射细节属于 06 号协同文档 `06-collaboration.md`） |
| BC-29 doc/sheet 扩展占位（同层带兄弟） | **Separate Ways**（铁律 2 强制） | — | 无共享类型（仅共享水平层 BC-02/05/07/10/11/13/14） |

## 2. 领域模型

### 2.1 聚合与实体

**聚合根**：`PresentationBody`——即一个 `slide` 类型 `Unit` 的 `DocumentStore.state()`；聚合边界由 `slideDocumentType.invariants` 守护，事务边界由 M-02 的 `store.transact` 提供（本包不重新实现事务）。聚合内是六张归一化实体表，引用关系用 id + `order: FracKey`（无嵌套树、无数组下标，04 §3.1）。

| 实体 | ID 品牌类型 | 关键不变量（04 §12.3；id 见下表） | 并发 / CRDT 合并语义 |
|---|---|---|---|
| `Presentation`（单例，非表条目） | — | `masters` 非空（I-ML5） | 各字段独立键 LWW；`defaultTextStyle`/`properties` 整对象替换式 LWW |
| `SlideMaster` | `MasterId` | `themeId ∈ themes`（I-ML4）；被 ≥1 母版引用的主题不可裸删（I-ML6 反向） | 新增/删除为顶层键 LWW；A 删除母版与 B 同时把某版式指向该母版 → 墓碑期读时容错、硬删时 I-ML3 修复（同下一行，rulings §4.20 FE-04） |
| `SlideLayout` | `LayoutId` | `masterId ∈ masters`（I-ML3） | A 删除版式（已确认，无 `reassignTo` 时 fail-closed 拒绝，见 §2.6）与 B 同时把页 `layoutId` 指向该版式，收敛后页引用的是墓碑版式 → **墓碑期读时容错**：页的 `layoutId` 保持不变（并发写落在墓碑上不丢），渲染、导出、样式链与 `impactCount` 读取时以 `defaultLayoutOf` 的结果替代（`impactCount` 不计墓碑目标），客户端发 `collab/soft-conflict{type:'delete-vs-reference'}`（50/11 §10）；A 撤销删除即恢复显示原版式；TTL 硬删作业在**同一事务**内按 I-ML2 链写修复并 `materialize` 占位符（`collab/repair{rule:'dangling-layout'}`，只写一次；04 §12.3、05 §13.4 场景 1，rulings §4.15 Q3、§4.20 FE-03/FE-04） |
| `Slide` | `SlideId` | `layoutId ∈ layouts`（I-ML2） | `order`/`layoutId` 单键 LWW；同位并发插入按 `(order, id)` 全序（ADR-0032），无需 rebase |
| `Shape`（判别联合） | `ShapeId` | `containerId` 存在、`parentId` 同容器（I-ML8）；占位符引用有效（I-ML7 软） | `order`+`parentId` 单键 LWW（移动/换组/调 z 序皆是 `set`，ADR-0032）；A 重置占位符覆盖与 B 移动同占位符并发 → 同键 LWW，双方各自可撤销自己的部分（05 §13.4 场景 2）；删除为**软删除**（`_deleted` 墓碑，rulings §4.15 Q3）：A 删除与 B 编辑并发 → B 的编辑保留在墓碑实体上，A 撤销删除即带着 B 的编辑恢复；A 撤销时若同一键已被 B 后写则跳过并提示（M-02 §2.5） |
| `Theme` | `ThemeId` | 至少被一个母版引用（I-ML6，否则诊断 `THEME_UNREFERENCED_DROPPED`） | `colorScheme`/`fontScheme` **逐槽位**（12 槽 / 4 槽）LWW，非整对象覆盖（05 §13.1 `setColors`/`setFonts`） |
| `MediaRef` | `MediaId` | 无孤儿校验（共享目标保留，04 §5.2） | `BlobRef` 内容寻址，不可变、天然无冲突 |
| `OpaquePartRef`（`opaqueParts` 表） | `PartName`（string） | 不校验，透传 | 整键 LWW；删除页时级联清理其独占 opaque part，共享目标保留 |

**`reassignTo` 与悬空引用兜底的分工**（04 §12.3 末段、05 §13.2/§13.4）：命令层是**第一道 fail-closed 前置**——`slide.deleteLayout`/`slide.deleteMaster` 在目标被引用且未提供 `reassignTo` 时直接返回 `err(LAYOUT_IN_USE | MASTER_IN_USE)`，不产生事务；提供 `reassignTo` 时，重指引用页与删除动作在**同一个事务**内完成，执行后入撤销栈、可一次撤销（rulings §4.20 FE-05：Q11 修订为「确认后可撤销」——确认对话框保留、文案删去「操作不可撤销」，执行后给带 [撤销] 的 Toast；撤销时各页引用回退、版式以原 id 复活，协同下他人后写的键按 Q3 跳过并提示；墓碑 24 h 硬删后该步整步跳过）。不变量 `I-ML2`/`I-ML3` 是**第二道兜底**——只在命令层前置被绕过的场景生效：(a) 协同并发（A 删除已确认、B 同时施加引用，CRDT 合并后引用指向墓碑；墓碑期读时容错，TTL 硬删作业同事务写修复，见 §2.1 表 `SlideLayout` 行）；(b) 服务端软门禁批量修复（ADR-0034，import/migrate 路径不经命令层）。两道机制的重指目标选取函数必须是**同一个纯函数**——`defaultLayoutOf(body, {masterId, type?, exclude?})`（`domain/invariants/reassign.ts`，30/04 §12.3 I-ML2 链：原母版下同 `type` 的首个版式 → 该母版首个版式 → 首个母版的首个版式，跳过墓碑与 `exclude`；rulings §4.20 FE-03），否则用户确认对话框里承诺的行为与实际收敛结果会不一致。

**删除母版的目标规则（rulings §4.20 FE-23，PRD G-73 结案）**：`slide.deleteMaster{masterId, reassignTo?: MasterId}` 的 `reassignTo` 是目标**母版**；每个受影响页取 `defaultLayoutOf(body, {masterId: reassignTo, type: 原版式的 type})`（目标母版同 `type` 的首个版式 → 目标母版首个版式），被删母版及其版式一并写墓碑，整个删除是一个事务；UI 不加母版选择器，确认对话框默认取按 `order` 排序的首个剩余母版。

**软删除墓碑与规模上限（rulings §4.15 Q3/Q5）**：
- **墓碑**：`slides`/`shapes`/`layouts`/`masters`/`themes` 五张实体表的删除一律写 `_deleted: Tombstone`（M-02 `store/tombstone.ts`），实体 id 稳定、行不移除；级联删除（删页连带其形状、删版式连带其形状、删母版连带版式与形状）对每个被级联实体各写一个墓碑，撤销时一并清除。独占 opaque part（备注页、图表部件等）的级联清理推迟到服务端 TTL 硬删除（默认 24h，M-09 单写者执行）；导出（M-04）与渲染（M-07）经 `filterLive()` 视墓碑实体为不存在。
- **读路径过滤**：`domain/query/selectors.ts`/`traverse.ts` 的全部公开选择器默认只返回存活实体。指向墓碑实体的关系分两类处理（rulings §4.20 FE-04，30/04 §3.1a(3) 与 §12.3）：**包含关系**（`containerId`、`parentId`）指向墓碑 → 引用者一并视为已删除（I-ML8 等按既有 repair 规则）；**引用关系**（`layoutId`、`masterId`、`themeId`）指向墓碑 → I-ML2…I-ML4 在**墓碑期读时容错**，不写修复，读路径以替代目标求值（`layoutId` 用 `defaultLayoutOf`，母版、主题按 30/04 §12.3 对应链），只在服务端 TTL 硬删作业的同一事务内写修复（每个引用只修一次）。消费方同样按替代目标读：M-07 `SceneProvider`、M-04 导出编码器解析 `layoutId` 时调用 `defaultLayoutOf`，导出的 pptx 中该页引用存活版式；`impactCount` 不计墓碑目标。只有 `element-limits.ts` 的计数与协同/快照路径读原始表。
- **规模上限（部署可调）**：`maxSlides` 200、`maxElementsPerSlide` 1,000、`maxElementsPerDoc` 20,000（软警告 15,000）为默认值，来自部署配置、可完全调整（超出性能保证包络时告警，性能承诺不再成立）。**计数口径**：`shapes` 表全部行（含母版/版式上的形状、组合形状本身与其每个子形状各计 1），**墓碑计入**；`maxSlides` 计 `slides` 表全部行（含墓碑）。命令层守卫：会新增实体的命令（`addSlide`/`duplicateSlide`/`insertShape`/`insertPicture`/`insertTable`/`pasteShapes`/`insertLayout`/`insertMaster`/`applyLayout` 的占位符 `materialize`，以及 2026-09-26 rulings §4.21 新增的 `fillPlaceholder`/`insertFreeform`/`insertMedia`/`insertIcons`/`insertChart`/`setHeaderFooter` 等，统一经 `application/commands/insert-common.ts` 的 `planInsert`）在 `transact` 前按「提交后计数」判定，超限返回 `err(SLIDE_LIMIT_EXCEEDED \| ELEMENT_LIMIT_EXCEEDED)` 且无事务——两常量映射到 protocol 错误码 `document.quota_exceeded`（常量 `DOCUMENT_QUOTA_EXCEEDED`，M-02 `errors/codes.ts`；详情 `{dimension, limit, actual}`，HTTP 409，命令守卫拒绝、**不关连接**，rulings §4.17 D2）：`SLIDE_LIMIT_EXCEEDED` → `dimension:'slides'`，`ELEMENT_LIMIT_EXCEEDED` → `dimension:'elementsPerSlide'`（单页超限）或 `'elementsTotal'`（文档总元素超限）；达软警告线时命令成功但附诊断。不变量层 `I-LIM1` 只报告（协同并发合并后可能越线），**不 repair**（不能替用户删内容）。超出系统天花板的导入由 M-04 在解析期直接拒绝（渐进打开时在首批回传之前，`format.quota_exceeded`，与本段 `document.quota_exceeded`、存储侧 `storage.quota_exceeded` 三码并列；拒绝线是天花板，不是性能保证包络，rulings §4.18 UX-13），不进入本包。

**表格归一化、组合与连接符规则（2026-09-26，rulings §4.21，ADR-0018 决策 6、8、9）**：
- **表格**：`GraphicFrame{graphic:{kind:'table'}}` 内的 `Table` 改为 `columns: Record<ColId,{order,width}>`、`rows: Record<RowId,{order,height}>`、`cells: Record<CellKey,TableCell>` 三张记录表（30/04 §3.8）；删行删列写墓碑、格随之不可见；合并在锚格记 `gridSpan`/`rowSpan`、被覆盖格记 `hMerge`/`vMerge`。不变量 **I-TBL1**（每个存活行在每个存活列上都有格，缺格补空格）与 **I-TBL2**（跨度合法，越界收缩、孤立标记清除）在 `domain/invariants/table.ts`，服务端软门禁 `system('repair')` 执行，客户端读时容错。M2 只插入与改单元格文字，结构与样式 M3；归一化形态最迟 M3 前落地，建议 M1 导入即采用（尚无代码，零迁移）。
- **组合**：**I-GRP1** 没有存活子元素的组视为已删除——`slide.deleteShapes` 删掉组内最后一个存活子元素时同事务给组写墓碑，并发造成的空组由 `repair` 写墓碑（`domain/invariants/group.ts`）；`shape.ungroup` 的 `lower()` 用 `domain/geometry/group-transform.ts` 的 `foldChildTransform` 把子元素变换折算回容器坐标（组旋转且子元素非等比时丢弃斜切并诊断）。
- **连接符**：端点引用经 `slide.cxnSp.setConnections` 写，新引用不得指向墓碑；受影响连接符的几何由调用方以 `reroute` 参数传入、与变换同事务写回，显示与导出以派生几何为准（30/05 §14.5）；目标为墓碑时保留引用。
- **内容占位符**：`slide.fillPlaceholder` 以同一 `PlaceholderRef`、同一 `order` 替换空占位；删除带内容族引用的元素时同事务补回空占位（ADR-0018 决策 10）。前置检查（2026-09-26 整合，50/21 §3）：目标空占位 `Sp` 已是墓碑（他人刚填入）时改为普通插入并 toast。
- **软不变量 I-PH1**（2026-09-26 整合，50/21 §3，ADR-0018 决策 10）：同页同 `(type, idx)` 的存活内容族占位符至多一个；两人并发填入同一占位符时两者都保留，由服务端软门禁修复一次——保留 `(order, id)` 最小者，其余 `materialize` 为普通元素（`domain/invariants/placeholder.ts`；客户端读时容错，不写修复）。

**图 2-1 幻灯片领域对象关系**

```mermaid
classDiagram
  class Presentation {
    +masters: MasterId 顺序表
    +slideOrder: FracKey
    +defaultTextStyle: TextStyle
  }
  class SlideMaster {
    +id: MasterId
    +themeId: ThemeId
    +order: FracKey
  }
  class SlideLayout {
    +id: LayoutId
    +masterId: MasterId
  }
  class Slide {
    +id: SlideId
    +layoutId: LayoutId
  }
  class Shape {
    +id: ShapeId
    +containerId: string
    +order: FracKey
  }
  class TextBody {
    +bodyProperties: BodyProperties
    +paragraphs: Paragraph 顺序表
  }
  class Theme {
    +id: ThemeId
    +colorScheme: ColorScheme
    +fontScheme: FontScheme
  }
  Presentation --> SlideMaster : masters
  SlideLayout --> SlideMaster : masterId
  SlideMaster --> Theme : themeId
  Slide --> SlideLayout : layoutId
  Shape --> Slide : containerId
  Shape --> TextBody : textBody
```

怎么读：六张归一化实体表都用 id 引用而非嵌套包含——`SlideLayout`/`Slide`/`SlideMaster` 三箭头体现的正是 `I-ML2`/`I-ML3`/`I-ML4` 引用完整性不变量；`Shape` 到 `TextBody` 的关系对应 `mutations/text.ts` 的 `shapes/id/textBody` 路径。

### 2.2 值对象

| 名称 | 字段摘要 | 校验 schema | 所在文件 | 来源 |
|---|---|---|---|---|
| `Color`/`Fill`/`Line`/`EffectList`/`Geometry`/`Transform`/`FontRef`/`Hyperlink`/`OpaqueXml`/`OpaquePartRef`/文本基元 | 见 04 §4.3 DrawingML 映射表 | `model-core/src/drawing/schema/*.ts` | `domain/model/drawing/index.ts`（**re-export，不重定义**） | Shared Kernel（BC-02，经 BC-05 转发） |
| `ShapeProperties` | `transform?/geometry?/fill?/line?/effects?/scene3d?: OpaqueXml/shape3d?: OpaqueXml/blackWhiteMode?` | zod，全字段可选（缺省即继承，I-ML1） | `domain/model/drawing/shape-properties.ts` | 本包 |
| `ShapeStyle` | `lineRef/fillRef/effectRef/fontRef`（各 `{ idx; color: Color }`） | zod | `domain/model/drawing/shape-style.ts` | 本包 |
| `Background` | `{kind:'properties';fill;effects?;shadeToTitle}\|{kind:'reference';idx;color}` | zod 判别联合 | `domain/model/drawing/background.ts` | 本包 |
| `PlaceholderRef` | `type: PlaceholderType; index?; orientation?; size?; hasCustomPrompt` | zod | `domain/model/shape/placeholder.ts` | 本包 |
| `NonVisualProps` | `name/hidden/description?/title?/decorative?/hyperlink?/placeholder?/locks?`（`decorative` 新增（§4.21），对应 `adec:decorative`） | zod | `domain/model/shape/non-visual.ts` | 本包 |
| `BlipFill`（2026-09-26 补字段） | `mediaId?/external?/svgMediaId?/sourceRect?/mode/alpha?/effects?/extensions`（`svgMediaId`、`alpha` 新增（§4.21）；整合时按 ADR-0018 决策 5 补来源二选一 `mediaId` 与 `external:{target}`、只读 `effects`，30/04 §3.7） | zod | `domain/model/shape/pic.ts` | 本包 |
| `PicMedia`（2026-09-26 补列） | `kind:'video'\|'audio'; mediaId?; external?: {target}; extensions`（播放属性不建模） | zod | `domain/model/shape/pic.ts` | 本包 |
| `ObjectDefaults`（新增（§4.21）） | `spDef?/lnDef?/txDef?`，各为 `{properties?; bodyProperties?; listStyle?; style?; extensions}`；M2 只读，无写入 Mutation | zod | `domain/model/theme.ts` | 本包 |
| `TableProperties`/`TableColumn`/`TableRow`/`TableCell`（2026-09-26 改为归一化） | 见 30/04 §3.8：`columns`/`rows` 带 `order: FracKey` 与 `_deleted?`，`cells` 键为 `RowId:ColId`，锚格 `gridSpan/rowSpan`、被覆盖格 `hMerge/vMerge` | zod | `domain/model/shape/table.ts` | 本包 |
| `ChartData`（M3，新增（§4.21）） | `type`（五类）、`variant`、`categories`/`series` 记录表（带 `order` 与 `_deleted?`）、`title?/legend?/dataLabels?/numFmt?`（30/04 §3.9） | zod | `domain/model/shape/chart.ts` | 本包 |
| `ConnectionRef`（新增（§4.21）） | `{shapeId; index}`：连接符端点引用 | zod | `domain/model/shape/cxn-sp.ts` | 本包 |
| `ShapeCapabilities`（2026-09-26 扩展） | `text/resize/rotate/group/connect` + 新增 `adjust/crop/lockAspectDefault/editPoints/fillable`（30/04 §3.3） | 类型（非 zod） | `domain/shape-kind/shape-kind.point.ts` | 本包 |
| `CommonSlideData` | `name?/background?/controls?: OpaqueXml/customData?: OpaqueXml/extensions` | zod | `domain/model/common-slide-data.ts` | 本包 |
| `ColorMap` | `Record<ColorMapKey, SchemeColorName>` | zod | `domain/model/theme.ts` | 本包 |
| `BodyProperties`/`ParagraphProperties`/`RunProperties`/`ListStyle`/`Bullet` | 见 04 §3.2 | zod（各字段可选，继承） | `domain/model/text/*.ts` | 本包（TextBody 骨架来自 drawing，段落/字符级细化在本包） |
| `DocumentProperties` | `core`（建模）+ `app`/`custom`: `OpaquePartRef` | zod | `domain/model/properties.ts` | 本包 |
| `OoxmlIds` | `{ cNvPrId?: number; creationId?: string }` | zod | `src/ids.ts` | 本包（ADR-0014，OOXML id 作数据保留） |
| `FracKey` | 2026-09-26 起为 ADR-0032 修订的 rocicorp 键格式：整数头 + base-62 小数（码元序比较、小数末位非 `'0'`），命令层 `between(a?,b?)` 另加 2 位随机后缀，导入与 rekey 用确定性键；`compareOrder` 按 `(order, id)`（原「base62 字符串 + 随机后缀」作废） | 品牌类型，非 zod（构造函数校验） | `@cordexjs/shared/order.ts`（引用，不重定义） | Shared Kernel |

### 2.3 领域服务

> 全部为纯函数：只读 `body`/`chain`/`changeSet`，无 IO、无随机、无时钟；浏览器与 `server-headless` 复用同一份源码（04 §6.3）。

| 函数 | 签名（草案） | 所在文件 | 两端共用 |
|---|---|---|---|
| `buildChain` | `(body, shapeId, paragraph, run) => StyleChain` | `domain/style/inheritance-chain.ts` | 是 |
| `resolveRunProperties` | `(chain: StyleChain) => ResolvedRunProperties`（全字段非 optional） | `domain/style/resolve-run.ts` | 是 |
| `resolveParagraphProperties` | `(chain: StyleChain) => ResolvedParagraphProperties` | `domain/style/resolve-paragraph.ts` | 是 |
| `resolveShapeVisual` | `(body, shapeId) => ResolvedShapeVisual`（style refs → theme.formatScheme） | `domain/style/resolve-shape.ts` | 是 |
| `resolveColor` | `(color: Color, ctx: {theme; colorMap; override?}) => Rgba` | `domain/style/resolve-color.ts` | 是 |
| `createStyleCache`/`invalidate` | `() => StyleCache`；`invalidate(cache, changeSet: ChangeSet) => void`（按 `touched` 命中形状/母版/版式/主题失效，含子孙与反向索引） | `domain/style/cache.ts` | 是 |
| `placeholderFamily` | `(type: PlaceholderType) => PlaceholderFamily`；2026-09-26 起族取值按 PRD ML-03 改为 `'text' \| 'content' \| 'footer' \| 'other'`（原 `footerLike` 等四分法作废，rulings §4.21 R-d-73，30/04 §12.2） | `domain/style/placeholder-match.ts` | 是 |
| `canChangePlaceholderType`/`compatiblePlaceholderTypes`（新增（§4.21）） | `(from, to) => boolean`：同族或 obj 与文本族互转才允许；`(type) => readonly PlaceholderType[]`：PRD ML-02 规则 (3) 的兼容类型 | `domain/style/placeholder-match.ts` | 是 |
| `defaultStyleFor`（新增（§4.21）） | `(kind: 'shape' \| 'line' \| 'textBox', theme: Theme) => { style?: ShapeStyle; properties?: ShapeProperties; bodyProperties?: BodyProperties }`：`objectDefaults.spDef/lnDef/txDef` → PowerPoint 内建 `p:style` 取值链，只返回引用 | `domain/style/object-defaults.ts` | 是 |
| `liveColumns`/`liveRows`/`cellAt`/`cellKey`（新增（§4.21）） | 表格读视图：按 `(order, id)` 排序并过滤墓碑；`cellAt` 缺格返回空格（I-TBL1 读时容错） | `domain/query/table-grid.ts` | 是 |
| `foldChildTransform`（新增（§4.21）） | `(group: GrpSp, child: Shape) => Transform`：取消组合时把子元素变换折算回容器坐标（2×3 仿射；斜切丢弃并诊断） | `domain/geometry/group-transform.ts` | 是 |
| `matchPlaceholder` | `(target, candidates) => ShapeId \| undefined` | `domain/style/placeholder-match.ts` | 是 |
| `planLayoutChange` | `(body, slideId, newLayoutId) => readonly PlaceholderRemap[]`，供 `slide.applyLayout` 命令生成确定性 Mutation。三种 action（rulings §4.18 CO-18，依 PRD 07-masters ML-02「占位符重匹配规则」(1)–(3) 与架构 04 §12）：`inherit`——找到匹配（PRD 规则 (1)–(3)）即取此值，**不论形状有无显式 `transform`**：已有的显式覆盖（含 `transform`）原样保留、未覆盖字段随新版式继承；匹配到的 `(type, idx)` 与现有 `PlaceholderRef` 不同时改写 ref（此时不是「无 Mutation」）。`materialize`——找不到匹配：按 `InheritableField` 全集把旧版式解析值（`transform`、`geometry`、`fill`、`line`、`effects`、`bodyProperties`、`listStyle`）写成显式值，并移除 `PlaceholderRef`（脱离占位符，导出不再带 `p:ph`）。`keep`——非占位符形状不动 | `domain/style/placeholder-match.ts` | 是 |
| `planReset` | `(body, slideId) => readonly {shapeId; clear: InheritableField[]}[]` | `domain/style/placeholder-match.ts` | 是 |
| `masterTextStyleKind` | `(type?: PlaceholderType) => 'title'\|'body'\|'other'` | `domain/style/effective.ts` | 是 |
| `inheritedParagraphProperties` | `(body, shapeId, level: 0..8) => ResolvedParagraphProperties` | `domain/style/effective.ts` | 是 |
| `resolvePlaceholderBox` | `(body, shapeId) => Transform` | `domain/style/effective.ts` | 是 |
| `effectiveBackground` | `(body, id: SlideId\|LayoutId\|MasterId) => Background \| undefined` | `domain/style/effective.ts` | 是 |
| `effectiveColorMap` | `(body, id: SlideId\|LayoutId) => ColorMap` | `domain/style/effective.ts` | 是 |
| `dependentsOf` | `(body, id: LayoutId\|MasterId\|ThemeId) => readonly (SlideId\|LayoutId)[]`（渲染脏映射与缓存失效的反向索引） | `domain/style/effective.ts` | 是 |
| `getSlide`/`getShape`/`getMasterOf`/`getPlaceholderOnLayout`/`slidesInOrder`/`shapesOf`/`childrenOf` | 对 `body` 的纯读取，结果按 `(order, id)` 排序 + 派生排序缓存 | `domain/query/selectors.ts` | 是 |
| `walkShapes`/`pathOfShape` | `(body, rootIds, visitor) => void`（深度优先、z 序）；`(body, shapeId) => Path` | `domain/query/traverse.ts` | 是 |
| `slideDocumentType.invariants[].check/repair` | 见 §2.1 不变量表；`{ id; check(body): Violation[]; repair?(body, violations): PresentationBody }` | `domain/invariants/index.ts` | 是（服务端软门禁 ADR-0034 复用） |
| `validateChangeSet` | `(view: ReadonlyStoreView, changeSet: ChangeSet) => Result<void, Violation[]>`（按 `touched` 前缀选取相关不变量求值） | `domain/invariants/validate-change-set.ts` | 是 |
| `defaultLayoutOf` | `(body, opts: {masterId: MasterId; type?: SlideLayout['type']; exclude?: readonly LayoutId[]}) => LayoutId \| undefined`：30/04 §12.3 I-ML2 链——`masterId` 下同 `type` 的首个版式 → `masterId` 首个版式 → 首个母版的首个版式，按 `(order, id)` 取首个，跳过墓碑与 `exclude`（`undefined` 只在全文档无存活版式时出现，I-ML5 下不应发生）；命令层 `reassignTo` 计算、I-ML2 修复、ADR-0034 修复、M-07/M-04 读时替代与 slide-ui 共用同一符号（rulings §4.20 FE-03/FE-04/FE-23） | `domain/invariants/reassign.ts` | 是 |
| `createEmptyPresentation` | `() => PresentationBody`（默认主题 + 1 母版 + 若干版式 + 1 空白页） | `domain/create-empty.ts` | 是 |
| `diffBodies` | `(a, b: PresentationBody) => readonly SlideMutation[]`（M3 版本恢复：`documentType.diff` 钩子的实现） | `application/diff.ts` | 是 |

### 2.4 领域事件

| 事件 | 载荷（草案） | 发布者文件 | 典型订阅者 |
|---|---|---|---|
| `slide/slide-added` | `{ unitId; slideId: SlideId }` | `interface/services/slides.service.ts`（内部订阅 `store/transaction`，按 `touched` 前缀分类派生，非跨包订阅） | `slide-ui`（缩略图窗格增量渲染） |
| `slide/slide-removed` | `{ unitId; slideIds: readonly SlideId[] }` | `interface/services/slides.service.ts`（内部订阅 `store/transaction`，按 `touched` 前缀分类派生，非跨包订阅） | `slide-ui`、`slide-render`（缩略图缓存清理） |
| `slide/shape-added` | `{ unitId; containerId: SlideId\|LayoutId\|MasterId; shapeId: ShapeId }` | `interface/services/slides.service.ts`（内部订阅 `store/transaction`，按 `touched` 前缀分类派生，非跨包订阅） | `slide-ui`（属性面板/大纲树） |
| `slide/shape-removed` | `{ unitId; containerId; shapeIds: readonly ShapeId[] }` | `interface/services/slides.service.ts`（内部订阅 `store/transaction`，按 `touched` 前缀分类派生，非跨包订阅） | `slide-ui` |
| `slide/shape-changed` | `{ unitId; shapeId: ShapeId; touched: readonly Path[] }` | `interface/services/slides.service.ts`（内部订阅 `store/transaction`，按 `touched` 前缀分类派生，非跨包订阅） | `slide-ui`（属性面板即时刷新，粒度细于 `store/transaction`） |
| `slide/layout-added`（**新增建议**） | `{ unitId; masterId: MasterId; layoutId: LayoutId }` | `interface/services/slides.service.ts`（内部订阅 `store/transaction`，按 `touched` 前缀分类派生，非跨包订阅） | `slide-ui` 母版缩略图窗格 |
| `slide/layout-removed`（**新增建议**） | `{ unitId; layoutIds: readonly LayoutId[] }` | `interface/services/slides.service.ts`（内部订阅 `store/transaction`，按 `touched` 前缀分类派生，非跨包订阅） | `slide-ui` 母版缩略图窗格 |
| `slide/master-added`（**新增建议**） | `{ unitId; masterId: MasterId }` | `interface/services/slides.service.ts`（内部订阅 `store/transaction`，按 `touched` 前缀分类派生，非跨包订阅） | `slide-ui` 母版缩略图窗格 |
| `slide/master-removed`（**新增建议**） | `{ unitId; masterIds: readonly MasterId[] }` | `interface/services/slides.service.ts`（内部订阅 `store/transaction`，按 `touched` 前缀分类派生，非跨包订阅） | `slide-ui` 母版缩略图窗格 |
| `slide/theme-changed`（**新增建议**） | `{ unitId; themeId: ThemeId; slot: 'colors'\|'fonts'\|'variant' }` | `interface/services/slides.service.ts`（内部订阅 `store/transaction`，按 `touched` 前缀分类派生，非跨包订阅） | `slide-ui`（设计/主题面板） |
| `slide/autofit-changed`（2026-09-25 登记，50/06 §7） | `{ unitId; shapeId: ShapeId; fontScale?: number; lnSpcReduction?: number; height?: Emu }` | 声明在本包 `events.ts`（`slide` 域）；**发布者**是 slide-render（M-07 §2.4：文本事务提交后的那一帧比较算得的 autofit 结果与模型值，不同才发，只在正在编辑该形状的本机发） | slide-ui `text-editing.ts`（执行 `slide.applyAutofit`，并入同一撤销单元） |

charter §5.5 与 module-map BC-06 行只登记前 5 个事件（面向页/形状）；后 5 个是本文档为 ML-01…ML-04 新增的建议（§12 记录），使母版/版式/主题结构性变化无需下游订阅粗粒度 `store/transaction` 再自行 diff。若总编排认为应统一走 `store/transaction`，本包届时删除对应 `events.ts` 常量与派生逻辑即可（不影响模型字段）。

**图 2-3 细粒度事件派生时序**

```mermaid
sequenceDiagram
  participant store as store-memory 或 store-yjs
  participant slidesSvc as slides.service 本 Unit 内部订阅
  participant cache as domain/style/cache.ts
  participant consumers as slide-ui 与 slide-render
  store-->>slidesSvc: store/transaction 携带 ChangeSet
  slidesSvc->>cache: invalidate 按 touched 命中形状 母版 版式 主题
  slidesSvc->>slidesSvc: 按 touched 路径前缀分类
  slidesSvc-->>consumers: slide/slide-added 或 slide-removed
  slidesSvc-->>consumers: slide/shape-added 或 shape-removed 或 shape-changed
  slidesSvc-->>consumers: 新增建议 slide/layout-* master-* theme-changed
  Note over store,consumers: 同一 Unit 内部订阅 非跨包 Events 订阅
```

怎么读：一次 Store 事务只产生一个 `store/transaction`，本包在同一订阅里先让样式缓存按 `touched` 失效，再按路径前缀派生更细粒度的 `slide/*` 事件，使下游无需自行 diff 粗粒度事务；最后一行是本文档新增建议的五个母版/版式/主题事件。

依据：本节上表与说明；§3 主插件「事件：订阅」行。

### 2.5 仓储 / 存储契约

本包**不定义新的存储 Definition**——复用 BC-05 的 `DocumentStore<PresentationBody>`（签名见架构 04 §2.2，Provider 为 `store-memory`/`store-yjs`）；本包在存储这一层只贡献两件事，且不重复实现 `runDocumentStoreConformance`：

| Definition / 套件 | 方法签名草案 | 默认 Provider / 归属 | 契约套件 |
|---|---|---|---|
| `DocumentStore<PresentationBody>`（上游，M-02 定义） | `state/get/transact/observe/undo/redo/toSnapshotBody/load/dirty`（04 §2.2） | `store-memory`（默认）/`store-yjs`（协同） | `runDocumentStoreConformance`（`model-core/testing`）；本包只提供 `createStore(createEmptyPresentation())` 作为其一个实例化输入，不重新实现 |
| `core.documentType` 条目 `'slide'` | `DocumentType<PresentationBody>`（04 §2.1：`bodySchema`/`shape: BodyShapeHints`/`invariants`/`validateChangeSet`/`diff`） | 本包 `infrastructure/document-type.ts` 唯一贡献 | `runSlideModelConformance`（本包 `testing/conformance.ts`，**新增建议**，见 §12） |
| `slide.shapeKind` 贡献点 | `ShapeKindDef<T>`（04 §3.3：`schema`/`createDefault`/`capabilities`/`describe`） | 本包 `domain/shape-kind/builtin.ts` 贡献内建 7 类；第三方可扩展 | 内建于 `runSlideModelConformance`（逐 kind 校验） |

`runSlideModelConformance` 与 `run<Definition>Conformance` 的命名差异是有意的：`DocumentType` 是贡献点条目而非 Definition/Provider 对，验证的是「这一份文档类型贡献是否自洽」（`bodySchema` 覆盖全部实体、`invariants[].repair` 幂等、`shapeKind` 注册齐全、每个 `lower()` 纯且确定性），供 `model-doc`/`model-sheet` 复制本包模式时对照写 `runDocModelConformance`/`runSheetModelConformance`（§8）。

### 2.6 应用服务与命令

**能力位与逆操作的通用规则（不逐行重复）**：全部幻灯片 `MutationDef` 均未覆盖 `permission()`，能力位继承发起它的 Command（下表「能力位」列）；全部 Mutation 的逆操作**均为 Store 推导**（ADR-0007，05 §5：`set`→`set(旧值)`/`delete`、`insert`→`remove`、`text`→`invert(delta)`），无一手写 `inverse`/`undo` 字段。**所有 `.remove` 类 Mutation 的 `lower()` 产出 `set(<实体路径>._deleted, Tombstone)`**（级联实体逐个写），不再对实体行发 `delete`；其逆操作自然是 `delete(<实体路径>._deleted)`（rulings §4.15 Q3，`StoreOp` 仍 5 种）（`MutationDef.schema` 为 `strictObject`，出现即校验失败）。事务边界由发起的 Command 决定（见 Command 表「事务边界」列）；Mutation 本身不能独立于事务存在。

**Mutation 清单**（按文件分组；type id 为三段式 `slide.<entity>.<verb>`，由 `scan-command-capabilities` 规则 (c) 校验——原名 `command-id-format`，TD-099，rulings §4.18 GV-15）：

| 文件 | type id | 参数要点（草案） | `lower()` 要点 |
|---|---|---|---|
| `mutations/slide.ts` | `slide.slide.insert`/`.remove`/`.setOrder`/`.setHidden`/`.setBackground`；2026-09-26 新增（§4.21）`slide.slide.setProperties` | `{slide: Slide}`（含 `order`）/`{slideIds}`/`{slideId;order:FracKey}`/`{slideId;hidden}`/`{slideId;background}`/`{slideId;patch:{showMasterShapes?}}` | 各自 `set(['slides',id],...)`；`remove` 写页及其形状的墓碑，独占 `notesId`/图表等 opaque part 的清理推迟到服务端 TTL 硬删除（04 §5.2、rulings §4.15 Q3） |
| `mutations/shape.ts` | `shape.insert`/`.remove`/`.setOrder`/`.setTransform`/`.setProperties`/`.setStyle`/`.group`/`.ungroup`；2026-09-26 新增（§4.21）`shape.setNonVisual`/`shape.patchKindData`/`pic.setBlipFill`/`cxnSp.setConnections` | `{shape:Shape}`（含 `containerId/parentId/order`）/`{shapeIds}`/`{shapeId;order:FracKey;parentId?}`/`{shapeId;transform}`/`{shapeId;patch:Partial<ShapeProperties>}`/…；新增四个见 30/05 §14.2 | `set(['shapes',id],...)`；`setOrder` 单键（+ 可选 `parentId`，进出组）；无数组下标（ADR-0013）；`ungroup` 用 `foldChildTransform` 折算子元素变换；新增四个均逐字段 `set/delete`，`patchKindData` 先按该 kind 的 schema 校验 |
| `mutations/text.ts` | `text.applyDelta`/`paragraph.setProperties`/`run.setProperties`/`textBody.setBodyProperties` | `{shapeId;paragraph?;delta:TextDelta}`/`{shapeId;paragraph;patch}`/`{shapeId;paragraph;run;patch}`/`{shapeId;patch}` | `text(['shapes',id,'textBody',...], delta)`；属性类走 `set` |
| `mutations/table.ts` | `table.insertRow`/`.removeRow`/`.insertColumn`/`.removeColumn`/`.setCellProperties`/`.merge`/`.split`；2026-09-26 新增（§4.21）`table.setTableProperties`/`table.setSizes`（M3） | 2026-09-26 起按 id 寻址（rulings §4.21 q-table-depth）：`{shapeId; rowId; order; height; cells}`/`{shapeId; rowIds}`/`{shapeId; colId; order; width; cells}`/`{shapeId; colIds}`/`{shapeId; cells: CellKey[]; patch}`/`{shapeId; anchor; gridSpan; rowSpan}`/`{shapeId; anchor}`；新增两个见 30/05 §14.2 | 全部对 `columns`/`rows`/`cells` 记录表逐键 `set`；删行删列写 `_deleted` 墓碑；原「`insert`/`remove` 原子列表 `columnWidths`/`rows`」作废（30/04 §3.8） |
| `mutations/media.ts` | `media.add` | `{mediaId; blob: BlobRef; contentType}` | `set(['media',id], ref)`（BlobRef 注册，不含字节） |
| `mutations/chart.ts`（M3，2026-09-26 新增（§4.21）） | `slide.chart.setData`/`slide.chart.setOptions`（与 30/05 §14.2 同一写法） | `{shapeId; patch}`（30/05 §14.2） | 对 `graphic.chart.data` 逐键 `set`；类别、系列删除写墓碑；`setOptions` 的 `type` 只允许五类 |
| `mutations/layout.ts` | `layout.insert`/`.remove`/`.setName`/`.setOrder`/`.setProperties`/`.setBackground`；`slide.setLayout`（携带 `remap`）；`shape.clearOverrides`/`shape.setPlaceholder` | `{layout:SlideLayout;shapes:Shape[]}`/`{layoutId}`（前置：无页引用）/`{layoutId;name}`/…/`{slideId;layoutId;remap:PlaceholderRemap[]}`（05 §13.1）/`{shapeId;fields:InheritableField[]}`/`{shapeId;placeholder\|null}` | `remove` 对版式及 `containerId==layoutId` 的形状逐个写墓碑（读视图枚举）；`clearOverrides` 逐字段 `delete`（重置=恢复继承） |
| `mutations/master.ts` | `master.insert`/`.remove`/`.setOrder`/`.setTheme`/`.setProperties`/`.setBackground`/`.setTextStyle` | `{master;layouts;shapes;theme?}`/`{masterId}`（前置：无版式被引用）/…/`setProperties` 为 `{masterId;patch:{preserve?;colorMap?;headerFooter?;name?}}`（`name` 写母版的 `commonSlide.name`，2026-10-08 为 `slide.renameMaster` 增，rulings §4.25 TB-46，30/05 §13.1）/`{masterId;kind:'title'\|'body'\|'other';level:0..8;patch}` | `remove` 对母版、其版式与形状逐个写墓碑；`setTextStyle` 合并在 `lower` 内按当前视图计算（确定性，05 §13.1） |
| `mutations/theme.ts` | `theme.insert`/`.remove`/`.setColors`/`.setFonts` | `{theme:Theme}`/`{themeId}`（前置：无母版引用）/`{themeId;colors:Partial<ColorScheme>}`/`{themeId;fonts:Partial<FontScheme>}` | `setColors`/`setFonts` **逐槽位** `set(['themes',id,'colorScheme',slot])`，非整体覆盖 |
| `mutations/lower.ts` | （非 Mutation 定义，工具） | — | `bodyPath.slides(id).shapes…` 路径构造辅助，供以上全部 `lower()` 复用（ADR-0013） |

**Command 清单**（`permission` 默认 `['doc.write']`，只读或视图态命令另注；覆盖 ED-02/03/04/05/06/07/08/10/11/13 与 ML-01…ML-04）：

| id | 语义 | 能力位 | 事务边界 | 涉及 Mutation | 文件 / 需求 |
|---|---|---|---|---|---|
| `slide.addSlide` | `{layoutId?;after?}` 新建页（默认版式=当前页版式） | `doc.write` | 一个事务 | `slide.slide.insert` | `slide-commands.ts` / ED-11 |
| `slide.deleteSlides` | `{slideIds}` | `doc.write` | 一个事务 | `slide.slide.remove` | `slide-commands.ts` / ED-11 |
| `slide.duplicateSlide` | `{slideId}` 复制页与其形状（新 id） | `doc.write` | 一个事务 | `slide.slide.insert` | `slide-commands.ts` / ED-11 |
| `slide.reorderSlides` | `{slideIds;after?}`：把一页或多页（多选整体拖动、跨节拖动、缩略图右键「移动 ▸」与 `Mod+Shift+↑/↓`）移到 `after` 之后，保持所选页的相对次序，新 `order` 经 `between` 逐页计算（2026-10-07 由 `{slideId;after?}` 改，设计 03-14 §3.2，50/10 §6） | `doc.write` | 一个事务、一个撤销步 | `slide.slide.setOrder`×N | `slide-commands.ts` / ED-11 |
| `slide.insertShape` | `{containerId;kind;box;preset?;textBox?:{wrap};from?;to?;action?}`（2026-09-26 扩参数，rulings §4.21：预设名、文本框换行方式、线条两点（页坐标或 `ConnectionRef`）、动作按钮默认动作）；经 `planInsert` 守卫与取默认样式 | `doc.write` | 一个事务；与 `setAction`（动作按钮）或空文本框自动删除合并为一步 | `shape.insert` | `shape-commands.ts` / ED-05 |
| `slide.deleteShapes` | `{shapeIds}`；2026-09-26 增同事务规则：删除带内容族 `PlaceholderRef` 的元素时补回空占位符，删掉组内最后一个存活子元素时给组写墓碑（I-GRP1） | `doc.write` | 一个事务 | `shape.remove`（+`shape.insert`） | `shape-commands.ts` / ED-08 |
| `slide.moveShapes`/`resizeShapes`/`rotateShapes` | `{shapeIds;...;reroute?:ConnectorPatch[]}`（拖拽连续帧首选一个命令收口，05 §8；`reroute` 为 2026-09-26 扩参数：受影响连接符几何由交互层用 engine-layout 算好传入，30/05 §14.5；`ConnectorPatch = {shapeId; offset; extent; flipH; flipV; rotation; preset; adj}`，字段与 40/06 的 `ConnectorRoute` 对齐） | `doc.write` | 一个事务（形状与连接符一起） | `shape.setTransform`×N | `shape-commands.ts` / ED-05、ED-28 |
| `slide.duplicateShapes`（2026-09-25 登记，`Mod`+拖动复制，50/10 §7.2） | `{shapeIds; dx; dy}`：复制为新 id 并按位移放置 | `doc.write` | 一个事务、一个撤销步；新增实体计入规模守卫 | `shape.insert`×N | `shape-commands.ts` / ED-05 |
| `slide.applyAutofit`（2026-09-25 登记，50/06 §7） | `{shapeId; fontScale?; lnSpcReduction?; height?}`：autofit 回写的薄命令，只由正在编辑该形状的本机在收到 `slide/autofit-changed` 后执行，label 与触发它的键入相同以并入同一撤销单元；打开 / 查看 / 放映 / `/render` 永不回写 | `doc.write` | 一个事务 | `textBody.setBodyProperties`、`shape.setTransform`（复用既有 Mutation） | `text-commands.ts` / ED-02/ED-24 |
| `slide.setFill`/`slide.setLine` | `{shapeIds;fill\|line}` | `doc.write` | 一个事务 | `shape.setProperties`/`.setStyle` | `shape-commands.ts` / ED-06 |
| `slide.bringForward`/`sendBackward` | `{shapeIds}` | `doc.write` | 一个事务 | `shape.setOrder`×N | `shape-commands.ts` / ED-08 |
| `slide.group`/`ungroup` | `{shapeIds}`/`{groupId}` | `doc.write` | 一个事务 | `shape.group`/`.ungroup` | `shape-commands.ts` / ED-08 |
| `slide.insertText`/`deleteText` | `{target: TextTarget; paragraph; offset; text\|range; replace?}`，`TextTarget = {shapeId} \| {shapeId; cell:{rowId, colId}} \| {slideId; notes:true}`（2026-09-26 单元格改按 id，原 `cell:[row,col]` 下标作废，rulings §4.21 q-table-depth）（2026-09-25 扩到表格单元格与备注，50/06 §6；旧 `{shapeId; paragraph; offset}` 即 `target:{shapeId}`）。分段与软换行都经 `TextDelta` 表达：分段 = 在 `offset` 处插入段落分隔（`split-paragraph`，产生新 `a:p`，新段继承原段 `pPr`），软换行 = 嵌入 `a:br`（`line-break`，段内换行、不产生新段）；`replace` 存在时同一事务先删后插 | `doc.write` | 一个事务 | `text.applyDelta`（单元格走 `table` 同族 Mutation 的文本分支，备注走 `slide.setNotes` 同族的字符级分支，M3） | `text-commands.ts` / ED-02/ED-10/ED-13/ED-18 |
| `slide.toggleBold`/`setFontSize`/`setAlignment`/`setBullet` | `{shapeId;range;...}` | `doc.write` | 一个事务 | `run.setProperties`/`paragraph.setProperties` | `text-commands.ts` / ED-03/ED-04 |
| `slide.insertPicture` | `{containerId;box;blob;fallbackBlob?}`（`fallbackBlob` 为 2026-09-26 扩参数：SVG 的 PNG 回退） | `doc.write` | 一个事务（含 `media.add`+`shape.insert`） | `media.add`+`shape.insert` | `picture-commands.ts` / ED-07 |
| `slide.replacePicture`/`crop` | `{shapeId;blob;fallbackBlob?;pixelSize}`/`{shapeId;rect?;fit?:'fill'\|'fit';pixelSize?}`（`fallbackBlob`、`fit`、`pixelSize` 为 2026-09-26 扩参数，50/23 提出） | `doc.write` | 一个事务 | `media.add?`/`pic.setBlipFill`（+`shape.setTransform`；2026-09-26 由 `shape.setProperties` 改用） | `picture-commands.ts` / ED-07 |
| `slide.insertTable` | `{containerId;box;rows;cols;styleId?}`：生成归一化表格（行列 id 与键由命令生成），默认样式 `{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}` + `firstRow`、`bandRow` | `doc.write` | 一个事务 | `shape.insert`（`graphicFrame:table`） | `table-commands.ts` / ED-10（M2，rulings §4.21 q-table-depth） |
| `slide.table.insertRow`/`removeRow`/`insertColumn`/`removeColumn`/`setCellProperties`/`mergeCells`/`splitCell` | 见 `mutations/table.ts`；按 `rowId`/`colId` 寻址；`splitCell{shapeId; cell}` 只拆回合并前的格，普通格按行列数拆分推迟（DF-04，触发条件：M3 之后出现明确用户需求时再议，届时扩 `rows?`/`cols?`，见 rulings §4.22） | `doc.write` | 一个事务 | 同名 `table.*` | `table-commands.ts` / ED-10（M3） |
| `slide.applyLayout` | `{slideIds;layoutId}`：逐页 `planLayoutChange` → `slide.slide.setLayout`；结果含每页脱离占位符（`materialize`）的元素数 `{perSlide: {slideId; detached: number}[]}`，供 Q13 Toast 计数 N（rulings §4.20 FE-24） | `doc.write` | **一页一事务**（撤销粒度按页，05 §13.2） | `slide.setLayout`×N | `layout-commands.ts` / ML-02 |
| `slide.resetSlide` | `{slideIds}`：`planReset` → `shape.clearOverrides`（仅占位符形状） | `doc.write` | 一个事务 | `shape.clearOverrides` | `layout-commands.ts` / ML-02 |
| `slide.resetPlaceholderFields`（2026-09-26 登记，rulings §4.20 FE-24，50/11 §11） | `{shapeId; fields: InheritableField[]}`：只清所列字段的覆盖、恢复继承 | `doc.write` | 一个事务、一步撤销 | `shape.clearOverrides`（与 `resetSlide` 共用，不新增 Mutation） | `layout-commands.ts` / ML-02 |
| `slide.setLayoutBackground` | `{layoutId;background}` | `doc.write` | 一个事务 | `layout.setBackground` | `layout-commands.ts` / ML-03 |
| `slide.insertLayout`/`duplicateLayout` | `{masterId;after?;type?;name?}`/`{layoutId}` | `doc.write` | 一个事务 | `layout.insert` | `layout-commands.ts` / ML-03 |
| `slide.deleteLayout` | `{layoutId \| layoutIds; reassignTo?: LayoutId}`：多选删除为一个事务（rulings §4.20 FE-24）；`reassignTo` 由调用方以 `defaultLayoutOf(body, {masterId, type, exclude: 被删集合})` 计算（FE-03） | `doc.write` | **fail-closed**：被引用且无 `reassignTo` → `err(LAYOUT_IN_USE)`，无事务；带 `reassignTo` → 一个事务（重指 + 删除不可分），入撤销栈、一步撤销即各页引用回退、版式以原 id 复活（rulings §4.20 FE-05，Q11 修订：确认后可撤销） | `layout.remove`（+`slide.setLayout`×N） | `layout-commands.ts` / ML-03、Q11 |
| `slide.renameLayout`/`reorderLayouts` | `{layoutId;name}`/`{layoutId;after?}` | `doc.write` | 一个事务 | `layout.setName`/`.setOrder` | `layout-commands.ts` / ML-03 |
| `slide.addPlaceholder`/`removePlaceholder`/`updatePlaceholder` | `{containerId;type;index?;box}`/`{shapeId}`/`{shapeId;...;lstStyle?}`（`lstStyle` 为占位符级别文本样式，不新增命令 id，rulings §4.20 FE-24）；`addPlaceholder` 前置校验同类占位符上限（Q16） | `doc.write` | 一个事务；超限 → `err(PLACEHOLDER_LIMIT_EXCEEDED)` 无事务 | `shape.insert`/`.remove`/`setPlaceholder` | `layout-commands.ts` / ML-03、Q16 |
| `slide.setMasterBackground` | `{masterId;background}` | `doc.write` | 一个事务 | `master.setBackground` | `master-commands.ts` / ML-03 |
| `slide.setMasterTextStyle` | `{masterId;kind;level;patch}` | `doc.write` | 一个事务 | `master.setTextStyle` | `master-commands.ts` / ML-03 |
| `slide.insertMaster`/`duplicateMaster` | `{}`/`{masterId}` | `doc.write` | 一个事务 | `master.insert` | `master-commands.ts` / ML-03 |
| `slide.deleteMaster` | `{masterId;reassignTo?: MasterId}`：`reassignTo` 是目标母版，每个受影响页取 `defaultLayoutOf(body, {masterId: reassignTo, type: 原版式的 type})`（目标母版同 `type` 首个 → 目标母版首个）；UI 默认取按 `order` 排序的首个剩余母版（rulings §4.20 FE-23） | `doc.write` | fail-closed 同 `deleteLayout`（`err(MASTER_IN_USE)` 或一个事务：逐页重指 + 母版及其版式写墓碑）；可撤销同 `deleteLayout`（FE-05） | `master.remove`（+`slide.setLayout`×N） | `master-commands.ts` / ML-03、Q11 |
| `slide.setThemeColors`/`setThemeFonts` | `{themeId;...}` | `doc.write` | 一个事务 | `theme.setColors`/`.setFonts` | `theme-commands.ts` / ML-04 |
| `slide.applyTheme` | `{masterId;theme:Theme\|ThemeId}` | `doc.write` | 一个事务（新增主题+切换、旧主题无引用则删除，同一事务） | `theme.insert`+`master.setTheme`(+`theme.remove`) | `theme-commands.ts` / ML-04 |
| `slide.setCurrentSlide`/`setSelection`/`setZoom`（Operation） | 视图状态 | `doc.read`（默认） | 不入历史 | 无 | `operations.ts` / ED-22；`setZoom` 另有两个无参别名 `slide.zoomToFit`、`slide.zoomTo100`，由 slide-ui 注册、只转调本条，不在本包（2026-10-22，rulings §4.25 TB-149，30/05 §7、40/10 §3） |
| `slide.chart.openDataEditor`（Operation，2026-09-26 新增（§4.21），M3） | `{shapeId; expanded?}`：缺省展开检查器「数据」分区（插入图表后由 UI 自动执行，不进数据面板）；`expanded:true` 打开数据面板——检查器栏加宽到 max(400, 检查器当前宽度)（检查器为缺省 280 时即加宽到 400；开着时检查器分隔条不可拖，关闭后回到原宽，2026-10-15，rulings §4.25 TB-60）、整栏换成完整数据网格，紧凑形态为画布底部 Sheet（rulings §4.25 DS-26；「数据面板」只指后者，TB-12；50/24） | `doc.read`（默认） | 不入历史 | 无 | `operations.ts` / ED-15 |
| `slide.selectMasterOrLayout`（Operation） | `{unitId;targetId:MasterId\|LayoutId}`：母版视图当前编辑目标，`editTargetKind` 上下文键；母版窗格选中即调用（窗格选中即编辑对象，2026-11-04，rulings §4.25 DS-146）。母版视图命令面板「母版」一类的两条另有无参 Operation `slide.openPlaceholderMenu`、`slide.viewLayoutPages`，由 slide-ui 注册、命令 id 不在本包，免得撞号（TB-207，30/05 §7） | `doc.read` | 不入历史；`broadcast:true` | 无 | `operations.ts` / ML-01 母版窗格选中（05 §13.3） |

**以下 14 条目 / 18 个命令 id 为新增（14-cross-module-review.md §1 C-03，M-10/G-13 指出 UI 需要但本表原未列出；采纳理由：`toolbar-spec.test.ts`（原名 `ribbon-spec.test.ts`）断言 `commandId ∈ 已注册命令`，缺失即 UI 控件永久 `disabled`）。逆操作来源统一遵循 §2.6 开篇通则（Store 推导，无一手写）；除 `slide.setNotes` 外，其余全部复用既有 Mutation，是「既有 Mutation 的薄命令」，不新增 `application/mutations/*` 定义**：

| id | 语义 | 能力位 | 事务边界 | 涉及 Mutation | 文件 / 需求 |
|---|---|---|---|---|---|
| `slide.pasteShapes` | `{containerId;shapes:Shape[]}`：粘贴一或多个形状（重新分配 id，位置取剪贴板坐标或视口居中） | `doc.write` | 一个事务 | `shape.insert`×N（既有） | `shape-commands.ts` / ED-05 |
| `slide.setFontFamily` | `{shapeId;range;fontFamily:string}` | `doc.write` | 一个事务 | `run.setProperties`（既有） | `text-commands.ts` / ED-03 |
| `slide.toggleItalic`/`toggleUnderline`/`toggleStrikethrough` | `{shapeId;range}`（与既有 `toggleBold` 同形，各自切换 `RunProperties` 对应布尔字段） | `doc.write` | 一个事务 | `run.setProperties`（既有） | `text-commands.ts` / ED-03 |
| `slide.setTextColor`/`setTextHighlight` | `{shapeId;range;color:Color\|null}` | `doc.write` | 一个事务 | `run.setProperties`（既有） | `text-commands.ts` / ED-03 |
| `slide.clearRunFormatting` | `{shapeId;range}`：清空 Run 级覆盖字段，恢复继承链解析值（非写入硬编码默认值） | `doc.write` | 一个事务 | `run.setProperties`（既有，patch 全字段置 `undefined`） | `text-commands.ts` / ED-03 |
| `slide.setIndentLevel` | `{shapeId;paragraph;level:0..8}` | `doc.write` | 一个事务 | `paragraph.setProperties`（既有） | `text-commands.ts` / ED-04 |
| `slide.setLineSpacing` | `{shapeId;paragraph;spacing}` | `doc.write` | 一个事务 | `paragraph.setProperties`（既有） | `text-commands.ts` / ED-04 |
| `slide.setEffect` | `{shapeIds;effects:EffectList}` | `doc.write` | 一个事务 | `shape.setProperties`（既有，`patch.effects`） | `shape-commands.ts` / ED-06 |
| `slide.alignShapes`/`distributeShapes` | `{shapeIds;align:'left'\|'center'\|'right'\|'top'\|'middle'\|'bottom'}`/`{shapeIds;axis:'horizontal'\|'vertical'}`（相对选区包围盒） | `doc.write` | 一个事务 | `shape.setTransform`×N（既有） | `shape-commands.ts` / ED-08 |
| `slide.setSlideBackground` | `{slideId;background;blob?}`（`blob` 为 2026-09-26 扩参数：图片背景同事务 `media.add`） | `doc.write` | 一个事务 | `slide.setBackground`（既有）（+`media.add`） | `slide-commands.ts` / ED-11、ED-20 |
| `slide.setSlideHidden` | `{slideId;hidden}`：放映时跳过该页 | `doc.write` | 一个事务 | `slide.setHidden`（既有） | `slide-commands.ts` / ED-11 |
| `slide.setLayoutProperties` | `{layoutId;showMasterSp:boolean}`：是否显示继承自母版的占位符/装饰形状 | `doc.write` | 一个事务 | `layout.setProperties`（既有） | `layout-commands.ts` / ML-03 |
| `slide.setMasterProperties` | `{masterId;preserve:boolean}`：母版即使暂无版式引用也保留，不参与悬空回收 | `doc.write` | 一个事务 | `master.setProperties`（既有） | `master-commands.ts` / ML-03 |
| `slide.setNotes`（M3） | `{slideId;notes:TextBody}`：讲义备注文本 | `doc.write` | 一个事务 | `slide.setNotes`（**新增 Mutation**，随备注从纯 `notesId` opaque part 提升为建模字段时一并落地；M1/M2 不实现） | `slide-commands.ts` / M3 |

**以下 33 个命令 id 为 2026-09-26 新增（rulings §4.21，ADR-0018；前端总览 50-frontend/19 §5，契约 30/05 §14.4；另有 Operation `slide.chart.openDataEditor` 见上表）**。逆操作同 §2.6 开篇通则（Store 推导）；新增元素的命令都经 `insert-common.ts` 的 `planInsert`（规模守卫、`order` 置顶、`creationId` 与名称生成、默认样式取 `defaultStyleFor`）：

| id | 语义 | 能力位 | 事务边界 | 涉及 Mutation | 文件 / 需求 / 里程碑 |
|---|---|---|---|---|---|
| `slide.insertField` | `{target: TextTarget; paragraph; offset; field:{type}}`：插入页码或日期时间字段 | `doc.write` | 一个事务 | `text.applyDelta`（embed） | `header-footer-commands.ts` / OF 支持矩阵 / M2 P2 |
| `slide.setHeaderFooter` | `{slideIds \| 'all'; date?: {mode:'auto'; type:'datetime1'…'datetime13'} \| {mode:'fixed'; text} \| null; slideNumber; footer?; hideOnTitle}`：逐页增删页脚族占位符并写文本（`date` 的展开规则见 50/21 §4.3 图 4-1）；新建页脚族占位符的 id 为 `deriveNodeId('hf', slideId, type)`，页上已有同类存活占位符时复用、确定性 id 的实体是墓碑时复活（ADR-0014 决策 9、ADR-0018 决策 10）；`'all'` 等 `unit/loaded` | `doc.write` | 一个事务 | `shape.insert`/`.remove` + `text.applyDelta` | `header-footer-commands.ts` / M2 P2 |
| `slide.setHyperlink` | `{target:{shapeIds} \| {shapeId; range}; link: Hyperlink \| null}`；`range` 的端点与 `slide.insertText` 同用 `TextTarget` 寻址，因而可指向表格单元格里的文字（2026-09-26 整合，50/20 §4 ⑧）；只写 http/https/mailto/tel | `doc.write` | 一个事务 | `run.setProperties` / `shape.setNonVisual` | `alt-text-and-hyperlink-commands.ts` / ED-19 / M2 P1 |
| `slide.setAltText` | `{shapeId; description?; title?; decorative?}` | `doc.write` | 一个事务 | `shape.setNonVisual` | `alt-text-and-hyperlink-commands.ts` / ED-26 / M2 P1 |
| `slide.setAction` | `{shapeId; click; hover?}`：动作按钮操作设置（悬停 P2） | `doc.write` | 一个事务（插入动作按钮时与 `insertShape` 同事务） | `shape.setNonVisual` | `alt-text-and-hyperlink-commands.ts` / ED-05 / M2 P1 |
| `slide.setSlideProperties` | `{slideIds; showMasterShapes}`：页级「隐藏背景图形」（50/21 提出） | `doc.write` | 一个事务 | `slide.setProperties` | `slide-commands.ts` / ED-20 / M2 P1 |
| `slide.fillPlaceholder` | `{shapeId; content: picture \| table \| chart \| media}` | `doc.write` | 一个事务 | `shape.remove` + `media.add?` + `shape.insert` | `fill-placeholder-commands.ts` / ML-03 / 图片 M2 P1、表格 M2、图表 M3、媒体 P2 |
| `slide.setAdjustValues`/`changeShape`/`flipShapes` | `{shapeId; adj}`/`{shapeIds; preset}`/`{shapeIds; axis; reroute?: ConnectorPatch[]}`（翻转会移动连接点，`reroute` 同 `moveShapes`，2026-09-26 整合，50/22） | `doc.write` | 一个事务 | `shape.setProperties`/`shape.setTransform` | `shape-commands.ts` / ED-05 / P1、P1、P0 |
| `slide.insertFreeform` | `{containerId; box; geometry: Geometry.custom; closed}`：点列简化与贝塞尔拟合在 slide-ui `application/freeform.ts` 完成，命令只收拟合好的几何写 `custGeom`（2026-09-26 整合，50/22 §5 ⑧；原「`path:{points, closed, curve}`、命令内简化」作废） | `doc.write` | 一个事务 | `shape.insert` | `shape-commands.ts` / ED-05 边界 / P2 |
| `slide.setLineEnds`/`connectEnds`/`changeConnectorType` | `{shapeId; start?; end?}`/`{shapeId; start?; end?; reroute?}`/`{shapeIds; preset}` | `doc.write` | 一个事务 | `shape.setProperties`/`cxnSp.setConnections`+`shape.setTransform`/`shape.setProperties` | `connector-commands.ts` / ED-06、ED-28 / P0、P1、P1 |
| `slide.setPictureTransparency`/`resetPicture`/`compressPicture`/`setPictureFill` | `{shapeIds; alpha}`/`{shapeId; pixelSize?}`（恢复原始像素尺寸，2026-09-26 整合由 `size` 改名，50/23 §11）/`{items:{shapeId; blob}[]; maxEdge}`（重编码在交互层）/`{shapeIds; blob; mode}` | `doc.write` | 一个事务 | `pic.setBlipFill`（+`shape.setTransform`、`media.add`、`shape.setProperties`） | `picture-commands.ts` / ED-07、ED-06 / P0、P0、P1、P2 |
| `slide.insertMedia`/`replacePoster` | `{containerId; box; kind; blob; poster?}`（不写 `p:timing`）/`{shapeId; blob}` | `doc.write` | 一个事务 | `media.add` + `shape.insert` / `pic.setBlipFill` | `media-commands.ts` / P2、M2 P1 |
| `slide.insertIcons`/`recolorSvg` | `{containerId; items:{blob; fallbackBlob; name}[]}`/`{items:{shapeId; blob; fallbackBlob}[]; color}` | `doc.write` | 一个事务 | `media.add` + `shape.insert` / `pic.setBlipFill` | `media-commands.ts` / M3 P2 |
| `slide.table.clearCells` | `{shapeId; cells: CellKey[]}`：多格选区按 Delete 清空文字（50/24 提出） | `doc.write` | 一个事务 | `text.applyDelta`（逐格） | `table-commands.ts` / ED-10 / M2 |
| `slide.table.setStyle`/`resizeColumn`/`resizeRow`/`setBorders` | `{shapeId; styleId?; flags?}`/`{shapeId; colId; width}`/`{shapeId; rowId; height}`/`{shapeId; cells; borders: {preset; line}}`（`preset`：`'none' \| 'all' \| 'outer' \| 'inner' \| 'innerH' \| 'innerV' \| 'top' \| 'bottom' \| 'left' \| 'right'`，命令展开为各格边框；2026-09-26 复核统一 50/18、50/24、50/19、30/05；2026-09-30 按设计 03-30 §6.4 样张的 10 个预设细化，原按类写的「单条 / 全部 / 内部 / 外部 / 无」作废，同日定稿，rulings §4.22） | `doc.write` | 一个事务 | `table.setTableProperties`/`table.setSizes`/`table.setCellProperties` | `table-commands.ts` / ED-10 / M3 |
| `slide.insertChart` | `{containerId; box; chartType; variant?; data?}`；`enablement: slide.hasChartEditor` | `doc.write` | 一个事务 | `shape.insert` | `chart-commands.ts` / ED-15 / M3 P1 |
| `slide.chart.setData`/`setType`/`setTitle`/`setLegend`/`setDataLabels` | `{shapeId; patch}`/`{shapeId; chartType; variant?}`/… | `doc.write` | 一个事务 | `chart.setData`/`chart.setOptions` | `chart-commands.ts` / ED-15 / M3 P1 |

**第二批：能力补齐的薄命令（2026-09-26 整合登记，出自 50-frontend/18 §28，契约同步 30/05 §14.4）**。全部是既有 Mutation 的薄命令，不新增 `MutationDef`（节命令随 30/04 §3.7 的节建模落地时在 `mutations/slide.ts` 追加节的 Mutation，同一既有文件）；逆操作同 §2.6 开篇通则：

| id | 语义 | 能力位 | 事务边界 | 涉及 Mutation | 文件 / 能力 / 里程碑 |
|---|---|---|---|---|---|
| `slide.setLocks` | `{shapeIds; locks: Partial<ShapeLocks>}` | `doc.write` | 一个事务 | `shape.setNonVisual` | `shape-commands.ts` / SEL-05、SEL-15 / M2 P0（等比）、P2（锁定界面） |
| `slide.setShapesHidden` / `reorderShapes` / `renameShape` | `{shapeIds; hidden}` / `{shapeId; after}` / `{shapeId; name}`（选择窗格） | `doc.write` | 一个事务 | `shape.setNonVisual` / `shape.setOrder` / `shape.setNonVisual` | `shape-commands.ts` / SEL-06、ARR-04 / M2 P2、P2、P1 |
| `slide.bringToFront` / `sendToBack` | `{shapeIds}`（`Mod+Shift+]` / `[` 的目标命令） | `doc.write` | 一个事务 | `shape.setOrder`×N | `shape-commands.ts` / ARR-01 / M2 P0 |
| `slide.setGuides` | `{guides}`（30/04 §3.7 `Presentation.guides`） | `doc.write` | 一个事务 | 随参考线建模定 | `slide-commands.ts` / ALN-04 / M2 P2 |
| `slide.setBaseline` / `setCaps` | `{shapeId; range; baseline \| cap}` | `doc.write` | 一个事务 | `run.setProperties` | `text-commands.ts` / TXT-05 / M2 P0 |
| `slide.setParagraphSpacing` / `setIndent` | `{shapeId; paragraphs; …}` | `doc.write` | 一个事务 | `paragraph.setProperties` | `text-commands.ts` / TXT-06 / M2 P0 |
| `slide.setBodyProperties` | `{shapeIds; patch}`：文本框锚点、内边距、自动换行、竖排、分栏（50/20 提出，TXT-08/09 缺口；ADR-0018 决策 10） | `doc.write` | 一个事务 | `textBody.setBodyProperties` | `text-commands.ts` / TXT-08、TXT-11、TXT-15 / M2 P0 |
| `slide.setAutofitMode` | `{shapeIds; mode}` | `doc.write` | 一个事务 | `textBody.setBodyProperties` | `text-commands.ts` / TXT-09 / M2 P1 |
| `slide.setCharSpacing` | `{shapeId; range; spc}` | `doc.write` | 一个事务 | `run.setProperties` | `text-commands.ts` / TXT-13 / M2 P2 |
| `slide.applyFormat` | 格式刷落刷 | `doc.write` | 一个事务 | `run.setProperties`、`shape.setProperties` | `text-commands.ts` / TXT-18 / M2 P2 |
| `slide.setShapeStyle` | `{shapeIds; style: ShapeStyleRef}`，同事务清显式覆盖（快速样式） | `doc.write` | 一个事务 | `shape.setStyle` | `shape-commands.ts` / FMT-07 / M2 P1 |
| `slide.setObjectDefaults` | 设为默认形状 | `doc.write` | 一个事务 | 主题写入，M3 后定 | `theme-commands.ts` / FMT-09 / P2 |
| `slide.setPictureAdjust` | 亮度、对比度、灰度、重新着色（写 `BlipFill.effects`） | `doc.write` | 一个事务 | `pic.setBlipFill` | `picture-commands.ts` / PIC-05 / M2 P2 |
| `slide.addSection` / `renameSection` / `removeSection` / `moveSection` | `{beforeSlideId; name}` / `{sectionId; name}` / `{sectionId; withSlides}` / `{sectionId; after}`（`moveSection` 一个事务改节与页的 `order`） | `doc.write` | 一个事务 | 节 Mutation（随 30/04 §3.7 建模） | `section-commands.ts` / SLD-05 / M3 |
| `slide.pasteSlides` | `{after; slides; mode: 'useDestinationTheme' \| 'keepSource'}`；受规模守卫与 200 页上限 | `doc.write` | 一个事务 | `slide.slide.insert`、`layout.insert`、`master.insert`、`media.add`、`shape.insert` | `slide-commands.ts` / SLD-06 / M3 P1 |
| `slide.setSlideSize` / `setDocumentProperties` | `{width; height; scale}` / 标题、主题、作者、关键词 | `doc.write` | 一个事务 | 演示文稿属性，P2 时定 | `slide-commands.ts` / SLD-07、EXP-06 / M2 P2 |
| `slide.replaceAll` | `{matches; replacement}`；匹配由 `domain/query/text-search.ts` 的纯函数算出 | `doc.write` | 一个事务 | `text.applyDelta`×N | `text-commands.ts` / FND-02 / M2 P1 |

第二批参数扩展：`alignShapes` / `distributeShapes` 增 `relativeTo: 'auto' | 'selection' | 'page'`（ALN-02）；`setFontFamily` 增 `script: 'latin' | 'ea' | 'cs'`（TXT-04）；`setAlignment` 增取值 `dist`（TXT-06）；`setBullet` 增 `preset? / startAt? / color? / size?`（TXT-07）；`crop` 的 `fit`（PIC-06）与 `insertPicture` 的 `fallbackBlob`（INS-07）见上表。

**第三批：design-language-v3 第 1 批回写登记的薄命令（2026-10-08，rulings §4.25 TB-46、TB-47；UI 入口见 40/10 §2.6，契约同步 30/05 §14.4）**。两条都是既有 Mutation 的薄命令，不新增 `MutationDef`；逆操作同 §2.6 开篇通则：

| id | 语义 | 能力位 | 事务边界 | 涉及 Mutation | 文件 / 需求 / 里程碑 |
|---|---|---|---|---|---|
| `slide.renameMaster` | `{masterId; name}`：母版改名（母版窗格就地改名——双击名称或右键「重命名」——与母版检查器「名称」字段，设计 03-26 §3、§5；2026-11-04，rulings §4.25 DS-150 ①），与 `slide.renameLayout` 对称；名称唯一性与长度由界面校验、在行内提示（TB-200） | `doc.write` | 一个事务 | `master.setProperties`（既有，`patch.name`） | `master-commands.ts` / ML-03 / M3 |
| `slide.setShapeOpacity` | `{shapeIds; alpha}`：形状「不透明度」，OOXML 形状没有整体不透明度，因此同一事务内同时写填充与描边颜色的 alpha；滑块拖动只预览、松手一次命令 | `doc.write` | 一个事务、一个撤销步 | `shape.setProperties`（既有，`patch.fill` / `patch.line` 的颜色 alpha） | `shape-commands.ts` / ED-06 / M2（随形状检查器「不透明度」节，50/22 ⑦） |

远期（M4+，不登记）：`slide.convertSmartArtToShapes`、`slide.insertEquation`/`setEquation`、`slide.applyWordArtStyle`、`slide.setTextWarp`、`slide.downloadOleObject`、`slide.replaceOleObject`（候选 Mutation `slide.ole.setPayload`）、`slide.insertPhotoAlbum{after?, layoutId?, items, titleFromName?}`（50/23 提出，M4+ 立项时登记）。

**渐进打开期间的全文类命令守卫（rulings §4.18 CO-12）**：M-02 渐进打开时，`unit/opened` 之后到 `unit/loaded` 之前 `unit.loadState==='partial'`，后续页仍以 `system('import')` 批次追加。需要看到全部页才能算对的命令在执行前 `await units.whenLoaded(unitId)`（等待期间命令面显示忙态，可取消）：`slide.reorderSlides`、`slide.addSlide`/`slide.duplicateSlide`（跨页重排与新页 `order` 都要读相邻页的 `FracKey`，未到达的页会让键落错位置）、`slide.deleteLayout`/`slide.deleteMaster`/`slide.applyTheme`（引用检查必须覆盖全部页）、`slide.applyLayout` 的多页批量、`slide.setHeaderFooter` 的「全部应用」（2026-09-26，rulings §4.21）；UI 入口读上下文键 `unitLoaded`（M-10 登记）禁用或显示等待。全选、查找替换（M-10）与 `core.export`（M-02/M-11）按同一判据由各自属主守卫。只作用于已装载页的局部命令（形状、文本、当前页属性）不受影响。守卫落在 `application/commands/index.ts` 的汇总处，按命令 id 白名单统一包装，不散落到各命令文件。

与水平层的边界：`view.setMode`（切普通/母版/演讲者视图）定义在 `ui-core`（文档类型盲，`ui-core/application/operations/view-set-mode.ts`，M-10，见 14-cross-module-review.md §1 C-01），本包只通过 `slideDocumentType.viewModes = ['normal','master','presenter']` 声明合法取值，不在本包重复定义命令。

**图 2-2 版式应用 重置与删除流程**

```mermaid
flowchart TB
  startApply["slide.applyLayout 提交 slideIds 与 layoutId"]
  planChange["逐页调用 planLayoutChange"]
  setLayoutMutation["slide.setLayout 逐页一个事务"]
  startReset["slide.resetSlide 提交 slideIds"]
  planReset["调用 planReset"]
  clearOverrides["shape.clearOverrides 恢复继承"]
  startDelete["slide.deleteLayout 提交 layoutId 与可选 reassignTo"]
  checkRef["该版式是否仍被引用"]
  noReassign["未提供 reassignTo"]
  hasReassign["提供 reassignTo"]
  failClosed["返回 err LAYOUT_IN_USE 不产生事务"]
  txDelete["同一事务 重指引用页并 layout.remove"]
  invariantFallback["I-ML2 与 I-ML3 兜底 墓碑期读时容错 硬删或软门禁时按 defaultLayoutOf 链修复"]
  startApply --> planChange --> setLayoutMutation
  startReset --> planReset --> clearOverrides
  startDelete --> checkRef
  checkRef --> noReassign
  checkRef --> hasReassign
  noReassign --> failClosed
  hasReassign --> txDelete
  txDelete -. "命令层前置被绕过时" .-> invariantFallback
```

怎么读：命令层是第一道 fail-closed 前置（无 `reassignTo` 直接拒绝，不产生事务；带 `reassignTo` 的删除入撤销栈、可一步撤销）；`I-ML2`/`I-ML3` 不变量是第二道兜底，只在协同并发或服务端批量修复绕过命令层时才生效——协同并发下墓碑期只读时容错，TTL 硬删时才写修复；两者的重指目标选取函数是同一个 `defaultLayoutOf`（rulings §4.20 FE-03/FE-04/FE-05）。

**图 2-4 新增实体命令的规模守卫时序**

```mermaid
sequenceDiagram
  participant caller as 调用方 slide-ui 等
  participant commands as M-02 commands 服务
  participant guard as 命令层规模守卫 element-limits
  participant store as DocumentStore
  caller->>commands: execute 新增实体命令 如 slide.addSlide
  commands->>guard: transact 前按提交后计数判定 上限取 Config.limits 墓碑计入
  alt 超 maxSlides 或 maxElementsPerSlide 或 maxElementsPerDoc
    guard-->>commands: err SLIDE_LIMIT_EXCEEDED 或 ELEMENT_LIMIT_EXCEEDED
    commands-->>caller: document.quota_exceeded dimension limit actual 409 无事务 不关连接
  else 未超限
    commands->>store: transact 内 tx.mutate 对应 Mutation
    store->>store: lower 产出 StoreOp
    store-->>commands: TransactionRecord
    opt 达软警告线 默认 15000
      commands-->>caller: 命令成功 附诊断
    end
  end
  Note over guard,store: 协同并发合并后越线由不变量 I-LIM1 只报告 不 repair
```

怎么读：守卫在事务开始前按「提交后计数」拒绝，因而超限时不产生任何事务与撤销记录；`SLIDE_LIMIT_EXCEEDED` 映射 `dimension:'slides'`，`ELEMENT_LIMIT_EXCEEDED` 映射 `elementsPerSlide` 或 `elementsTotal`，与导入期 `format.quota_exceeded`、存储 `storage.quota_exceeded` 三码并列。

依据：§2.1「软删除墓碑与规模上限」段；§3 编辑子插件 `Config.limits`；rulings §4.15 Q5、§4.17 D2。

## 3. cordis 插件定义

本包导出两个插件，两段式加载（ADR-0015 只读双保险之一）：`@cordexjs/model-slide`（主插件，只读部分）与 `@cordexjs/model-slide/editing`（编辑子插件，独立 chunk）；`preset-slide-viewer` 只加载前者。

**主插件 `@cordexjs/model-slide`**

| 项 | 值 |
|---|---|
| 插件名 / `name` | `@cordexjs/model-slide` |
| `inject`（必需） | `['contributions', 'documentTypes']` |
| `provide` | 无（`slides` 服务经 `unitPlugins` 在 UnitScope 内按 Unit 挂载，非根 `provide`） |
| 贡献点：提供 | `core.documentType`（key `'slide'`，载荷 `DocumentType<PresentationBody>`，`conflict:'error'`）；`core.migration`（M1 空表但注册，A23）；`slide.shapeKind`（内建 `sp`/`pic`/`grpSp`/`cxnSp`/`graphicFrame:table`/`graphicFrame:chart`/`graphicFrame:ole`/`graphicFrame:diagram`/`unknown` 共 9 项） |
| 贡献点：消费 | 无（自身是 `slide.shapeKind` 的定义者） |
| 事件：发布 | `slide/slide-added`/`.removed`、`slide/shape-added`/`.removed`/`.changed`（+ §2.4 新增建议 5 项） |
| 事件：订阅 | `store/transaction`（每 Unit 内部，驱动样式缓存失效与 §2.4 事件派生；非跨包订阅） |
| 配置 schema | 无专属 Config |
| 生命周期 | `ready`：向 `core.documentType`/`slide.shapeKind` 注册（Fiber effect，卸载自动撤销，ADR-0006）；`dispose`：随 Fiber 清理，无手工资源；不依赖任何 `PENDING` 服务 |
| Manifest 片段 | `{"name":"@cordexjs/model-slide","provides":[],"contributes":{"core.documentType":["slide"],"slide.shapeKind":["sp","pic","grpSp","cxnSp","graphicFrame:table","graphicFrame:chart","graphicFrame:ole","graphicFrame:diagram","unknown"]},"isomorphism":"iso"}` |

**编辑子插件 `@cordexjs/model-slide/editing`**

| 项 | 值 |
|---|---|
| 插件名 / `name` | `@cordexjs/model-slide/editing`（子路径导出） |
| `inject`（必需） | `['contributions', 'commands']` |
| `provide` | 无 |
| 贡献点：提供 | `core.mutation`（51 个，M3 起 56 个，key=`type`，见 §2.6；2026-09-26 rulings §4.21 由 46/47 上修）；`core.command`（111 个，含 5 个 Operation，key=`id`，见 §2.6；2026-10-08 由 109 增 `renameMaster`、`setShapeOpacity`，rulings §4.25 TB-46、TB-47——2026-09-25 增 `slide.duplicateShapes`、`slide.applyAutofit` 后为 75，2026-09-26 rulings §4.21 增 33 个命令与 1 个 Operation；14 §1 C-03） |
| 贡献点：消费 | 无 |
| 事件：发布 / 订阅 | 无独立（命令执行的 `command/*` 由 M-02 `commands` 服务发出） |
| 配置 schema | `Config{ limits: { maxSlides: 200; maxElementsPerSlide: 1000; maxElementsPerDoc: 20000; softWarnElementsPerDoc: 15000; softWarnSlides: 150 } }`（`softWarnSlides` 2026-09-25 登记：页数软警告 150，PRD 06 SV-08，由部署键 `scale.softWarnPages` 注入，60/17；超过只提示、不拒绝，UI 见 50/04 §10）——默认值为性能保证包络，宿主从部署配置注入、可完全调整（rulings §4.15 Q5）；只被命令层守卫读取 |
| 生命周期 | `ready` 时批量 `ctx.contribute(core.mutation, m)`/`ctx.contribute(core.command, c)`；`preset-slide-viewer` **不加载本插件**——即使命令管线被绕过调用，`core.mutation`/`core.command` 表里也不存在任何幻灯片写操作（ADR-0015 两道只读保证之一，另一道见 09-04） |
| Manifest 片段 | `{"name":"@cordexjs/model-slide/editing","provides":[],"contributes":{"core.mutation":["slide.slide.insert","…"],"core.command":["slide.addSlide","…"]},"isomorphism":"iso"}` |

**图 3-1 贡献点与服务流向**

```mermaid
flowchart LR
  pluginMain["@cordexjs/model-slide 主插件"]
  pluginEditing["@cordexjs/model-slide/editing 编辑子插件"]
  pointDocType["core.documentType 条目 slide"]
  pointShapeKind["slide.shapeKind 九项内建"]
  pointMutation["core.mutation 51 个，M3 起 56 个"]
  pointCommand["core.command 111 个含 5 个 Operation"]
  serviceSlides["ctx.slides 只读服务"]
  pluginMain -- "贡献" --> pointDocType
  pluginMain -- "贡献" --> pointShapeKind
  pluginEditing -- "贡献" --> pointMutation
  pluginEditing -- "贡献" --> pointCommand
  pointDocType -- "供 documentTypes 服务解析" --> serviceSlides
  pointCommand -- "commands.execute 内部封装" --> serviceSlides
```

怎么读：只读服务 `ctx.slides` 同时依赖主插件贡献的文档类型条目与编辑子插件贡献的命令表；`preset-slide-viewer` 不加载编辑子插件时，`core.mutation`/`core.command` 表里不存在任何幻灯片写操作。

## 4. 目录树（完整到文件）

> 顶层按 00-module-map §1 的 DDD 对照表组织为 `domain/`/`application/`/`infrastructure/`/`interface/`/`testing/`（与 02 §4.8 现存扁平结构的映射关系、差异原因见 §12 G-1）。共 124 个源文件（含 3 个 `__tests__`；2026-09-26 增 `domain/invariants/reassign.ts`，rulings §4.20 FE-03；同日 rulings §4.21 增 13 个：`domain/geometry/group-transform.ts`、`domain/query/table-grid.ts`、`domain/invariants/{table,group}.ts`、`domain/style/object-defaults.ts`、`application/mutations/chart.ts`、`application/commands/{insert-common,connector-commands,alt-text-and-hyperlink-commands,header-footer-commands,fill-placeholder-commands,media-commands,chart-commands}.ts`），超出章程估计的 90–110 区间，原因是可追加元素的命令按族分文件（§12 2026-09-26 回写）；整合阶段再增 3 个：`domain/query/text-search.ts`、`domain/invariants/placeholder.ts`、`application/commands/section-commands.ts`（50-frontend/18 §28 第二批命令与 I-PH1），合计 127 个。**14 §1 C-03 新增的 18 个命令 id 不增加文件数**——全部落在既有 `application/commands/*.ts` 五个文件内（仅 `slide.setNotes` 需在 M3 于 `application/mutations/slide.ts` 追加一个 `MutationDef`，同一既有文件，不新增文件），故本节文件数估计维持不变。

**图 4-1 model-slide 分层依赖**

```mermaid
flowchart LR
plugin["src/plugin.ts 主插件"]
editing["src/editing.ts 编辑子插件"]
index["src/index.ts 公共面"]
commands["application/commands"]
mutations["application/mutations"]
diff["application/diff.ts"]
docType["infrastructure/document-type.ts"]
migrations["infrastructure/migrations"]
sharding["infrastructure/snapshot/sharding.ts"]
iface["interface/services/slides.service.ts"]
domain["domain 详见图 4-2"]
testing["testing"]
modelCore["@cordexjs/model-core"]
plugin --> docType
plugin -- "shape-kind" --> domain
editing --> mutations
editing --> commands
index --> iface
commands --> mutations
commands -- "placeholder-match selection" --> domain
mutations --> domain
mutations -- "StoreOp TextDelta BlobRef" --> modelCore
diff --> domain
diff -- "构造 Mutation" --> mutations
docType -- "schema invariants create-empty" --> domain
docType --> diff
migrations -- "Migration" --> modelCore
sharding -- "BlobRef SnapshotBundle" --> modelCore
iface -- "query style" --> domain
iface -- "commands store 类型" --> modelCore
testing --> docType
testing -- "invariants shape-kind builders" --> domain
```

怎么读：箭头为目录间 import 方向；主插件只经 `document-type.ts` 与 `shape-kind` 贡献只读部分，两个插件中只有编辑子插件注册 `application/mutations` 与 `application/commands`（查看器不加载它即不存在任何写操作）；`src/index.ts` 另按 §5 再导出 `domain`、`mutations`、`commands` 与 `document-type` 的公共面，为免交叉未画；`domain` 不依赖本包其他层。

依据：§5 各文件「允许依赖」列。

**图 4-2 model-slide domain 内部依赖**

```mermaid
flowchart LR
model["domain/model 实体表与判别联合"]
schema["domain/model/schema"]
styleDir["domain/style 继承链解析"]
query["domain/query selectors traverse"]
invariants["domain/invariants"]
shapeKind["domain/shape-kind"]
geometry["domain/geometry 组合折算"]
selection["domain/selection.ts"]
createEmpty["domain/create-empty.ts"]
modelCore["@cordexjs/model-core"]
shared["@cordexjs/shared"]
schema --> model
styleDir --> model
styleDir -- "selectors" --> query
styleDir -- "cache.ts ChangeSet" --> modelCore
query --> model
query -- "filterLive isTombstoned" --> modelCore
invariants --> model
invariants --> query
invariants -- "effective dependentsOf" --> styleDir
shapeKind --> model
geometry --> model
selection --> model
selection -- "Selection" --> modelCore
createEmpty --> model
model -- "BlobRef drawing Transform Hyperlink Derived" --> modelCore
model -- "FracKey" --> shared
```

怎么读：箭头为 import 方向；`domain/model` 是唯一被全部子目录依赖的底座，样式继承链依赖查询层、不变量又复用样式层的 `dependentsOf`；公开选择器经 `model-core` 的 `filterLive`/`isTombstoned` 过滤墓碑，只有 `invariants/element-limits.ts` 的计数读原始表（墓碑计入）；2026-09-26 新增的 `domain/geometry` 只被 `mutations/shape.ts` 的 `ungroup` 使用，表格读视图 `query/table-grid.ts` 与表格不变量 `invariants/table.ts` 分别落在查询层与不变量层。

依据：§5 domain 各文件「允许依赖」列。

```text
packages/model-slide/
├── package.json                      # cordex: { layer:'V-model', bundle:'slide', iso:'iso', role:'plugin', publicEntry:['.','./editing','./testing'], stability:'beta' }（§4.18 FE-04）
├── tsconfig.json
├── tsconfig.test.json
├── vitest.config.ts
├── api-extractor.json
├── etc/
│   └── model-slide.api.md
├── README.md
├── CHANGELOG.md
├── cordex-manifest.json                 # 构建产物（src/manifest.ts 序列化）
├── src/
│   ├── index.ts                      # 公共 API 面（§6）
│   ├── plugin.ts                     # 主插件：只读部分（§3）
│   ├── editing.ts                    # 编辑子插件（§3；子路径 `./editing`）
│   ├── manifest.ts
│   ├── slide.contribution.ts         # declare module 增强 + 贡献点/事件声明
│   ├── ids.ts                        # 品牌 id（MasterId/LayoutId/…）+ OoxmlIds
│   ├── events.ts                     # 事件名常量（§2.4）
│   ├── errors.ts                     # 错误码：LAYOUT_IN_USE(slide.layout_in_use)/MASTER_IN_USE(slide.master_in_use)/PLACEHOLDER_LIMIT_EXCEEDED(slide.placeholder_limit_exceeded)/SLIDE_LIMIT_EXCEEDED、ELEMENT_LIMIT_EXCEEDED(→document.quota_exceeded{dimension}，§4.17 D2)…（TS 常量 UPPER_SNAKE、值点式，14 §1 C-16 通则，域=slide）
│   ├── domain/                       # 聚合 / 实体 / 值对象 / 领域服务 / 领域事件类型（DDD domain 层）
│   │   ├── model/                    # 归一化实体表与判别联合（聚合根 + 实体 + 值对象）
│   │   │   ├── index.ts              # PresentationBody 与全部实体类型的桶导出
│   │   │   ├── body.ts               # PresentationBody（04 §3.1）
│   │   │   ├── presentation.ts
│   │   │   ├── master.ts
│   │   │   ├── layout.ts
│   │   │   ├── slide.ts
│   │   │   ├── common-slide-data.ts
│   │   │   ├── theme.ts
│   │   │   ├── media.ts
│   │   │   ├── properties.ts
│   │   │   ├── extensions.ts         # OpaqueSlot/OpaqueXml/OpaquePartRef 槽类型
│   │   │   ├── derived.ts            # Derived<T> 字段清单
│   │   │   ├── shape/
│   │   │   │   ├── shape.ts          # Shape 判别联合 + ShapeBase
│   │   │   │   ├── non-visual.ts
│   │   │   │   ├── sp.ts
│   │   │   │   ├── pic.ts
│   │   │   │   ├── grp-sp.ts
│   │   │   │   ├── cxn-sp.ts
│   │   │   │   ├── graphic-frame.ts
│   │   │   │   ├── table.ts
│   │   │   │   ├── chart.ts          # M1–M2 partRef 占位；M3 起 data
│   │   │   │   ├── ole.ts
│   │   │   │   ├── diagram.ts
│   │   │   │   ├── unknown.ts
│   │   │   │   └── placeholder.ts    # PlaceholderRef
│   │   │   ├── text/
│   │   │   │   ├── text-body.ts
│   │   │   │   ├── body-properties.ts
│   │   │   │   ├── paragraph.ts
│   │   │   │   ├── paragraph-properties.ts
│   │   │   │   ├── run.ts
│   │   │   │   ├── run-properties.ts
│   │   │   │   ├── list-style.ts
│   │   │   │   └── bullet.ts
│   │   │   ├── drawing/              # re-export model-core/drawing + slide 特有组合值对象
│   │   │   │   ├── index.ts
│   │   │   │   ├── shape-properties.ts
│   │   │   │   ├── shape-style.ts
│   │   │   │   ├── background.ts
│   │   │   │   └── slide-hyperlink.ts
│   │   │   └── schema/               # zod schema，按领域分组而非逐类型 1:1（§2.2、§12 G-3）
│   │   │       ├── index.ts          # bodySchema 组合 + schema-lock 哈希源
│   │   │       ├── presentation.schema.ts
│   │   │       ├── masters-layouts-slides.schema.ts
│   │   │       ├── shape.schema.ts
│   │   │       ├── text.schema.ts
│   │   │       └── theme-drawing.schema.ts
│   │   ├── style/                    # 领域服务：样式继承链解析纯函数（§2.3）
│   │   │   ├── placeholder-match.ts
│   │   │   ├── object-defaults.ts    # defaultStyleFor()：objectDefaults → 内建 p:style 取值链（§4.21）
│   │   │   ├── effective.ts
│   │   │   ├── inheritance-chain.ts
│   │   │   ├── resolve-run.ts
│   │   │   ├── resolve-paragraph.ts
│   │   │   ├── resolve-shape.ts
│   │   │   ├── resolve-color.ts
│   │   │   └── cache.ts
│   │   ├── query/                    # 领域服务：只读查询与遍历
│   │   │   ├── selectors.ts
│   │   │   ├── table-grid.ts         # 表格读视图：liveColumns/liveRows/cellAt（§4.21 归一化）
│   │   │   ├── text-search.ts        # 查找的纯函数：findMatches()（FND-01/02，§4.21 整合）
│   │   │   └── traverse.ts
│   │   ├── invariants/               # 领域服务：引用完整性不变量（ADR-0034 的 slide 实例）
│   │   │   ├── index.ts              # I-ML2…I-ML8 + 基础不变量（无环/order 合法）+ I-LIM1
│   │   │   ├── element-limits.ts     # SlideLimits、countElements()（墓碑计入）、checkLimits()（§4.15 Q5）
│   │   │   ├── reassign.ts           # defaultLayoutOf()：I-ML2 链唯一选取函数（§4.20 FE-03/FE-23）
│   │   │   ├── table.ts              # I-TBL1 格覆盖、I-TBL2 跨度合法（§4.21）
│   │   │   ├── group.ts              # I-GRP1 空组视为删除（§4.21）
│   │   │   ├── placeholder.ts        # I-PH1 同页同 (type, idx) 存活内容族占位符至多一个（§4.21 整合）
│   │   │   └── validate-change-set.ts
│   │   ├── geometry/                 # 领域服务：模型内的几何折算（§4.21）
│   │   │   └── group-transform.ts    # foldChildTransform()：取消组合的变换折算
│   │   ├── shape-kind/               # slide.shapeKind 贡献点定义与内建注册
│   │   │   ├── shape-kind.point.ts
│   │   │   └── builtin.ts
│   │   ├── selection.ts              # SlideSelectionAnchor（04 §3.6）
│   │   └── create-empty.ts           # createEmptyPresentation()
│   ├── application/                  # Mutation 定义 + lower()、Command 定义、查询编排（DDD application 层）
│   │   ├── mutations/
│   │   │   ├── index.ts              # allSlideMutations: MutationDef[]
│   │   │   ├── slide.ts
│   │   │   ├── shape.ts
│   │   │   ├── text.ts
│   │   │   ├── table.ts
│   │   │   ├── media.ts
│   │   │   ├── chart.ts              # M3：chart.setData/setOptions（§4.21）
│   │   │   ├── layout.ts             # 含 slide.setLayout + shape.clearOverrides/setPlaceholder
│   │   │   ├── master.ts
│   │   │   ├── theme.ts
│   │   │   └── lower.ts              # bodyPath 构造辅助，供以上 lower() 复用
│   │   ├── commands/
│   │   │   ├── index.ts              # allSlideCommands
│   │   │   ├── insert-common.ts      # planInsert()：插入守卫、order 置顶、creationId 与名称、默认样式（§4.21）
│   │   │   ├── slide-commands.ts
│   │   │   ├── shape-commands.ts
│   │   │   ├── text-commands.ts
│   │   │   ├── picture-commands.ts
│   │   │   ├── table-commands.ts
│   │   │   ├── connector-commands.ts          # 线条端点与连接符（§4.21）
│   │   │   ├── alt-text-and-hyperlink-commands.ts   # 替代文本、超链接、动作设置（§4.21）
│   │   │   ├── header-footer-commands.ts      # 页眉页脚与字段（§4.21）
│   │   │   ├── fill-placeholder-commands.ts   # 空内容占位符填入与删除补回（§4.21）
│   │   │   ├── media-commands.ts              # 音视频、海报、图标（§4.21）
│   │   │   ├── chart-commands.ts              # M3：插入图表与 chart.*（§4.21）
│   │   │   ├── section-commands.ts            # M3：节的增删改与移动（§4.21 整合，50/18 SLD-05）
│   │   │   ├── layout-commands.ts    # 含 master/theme 之外的 ML-02/03 命令
│   │   │   ├── master-commands.ts
│   │   │   ├── theme-commands.ts
│   │   │   └── operations.ts         # 视图态 Operation（§2.6 末）
│   │   └── diff.ts                   # diffBodies()（documentType.diff，M3 版本恢复）
│   ├── infrastructure/               # DocumentType 贡献、迁移、Snapshot 分片编解码（DDD infrastructure 层）
│   │   ├── document-type.ts          # slideDocumentType: DocumentType<PresentationBody>
│   │   ├── migrations/
│   │   │   └── index.ts              # slide 的 Migration 列表（M1 空数组但注册，A23）
│   │   └── snapshot/
│   │       └── sharding.ts           # 大 body 的 BlobRef 分片扩展点（新增建议，§8/§12 G-5）
│   ├── interface/                    # 对外接口：slides 服务、UnitScope 内句柄（DDD interface 层）
│   │   ├── index.ts                  # 桶导出 SlidesService 类型与 exec.* 便捷契约
│   │   └── services/
│   │       └── slides.service.ts     # SlidesService（'slides'，UnitScope 内挂载）
│   ├── testing/                      # 契约套件与夹具（子路径导出 `./testing`）
│   │   ├── index.ts
│   │   ├── builders.ts               # presentation().slide().shape(...).build()
│   │   ├── fixtures.ts               # 典型 body：单页文本/母版继承/分组/表格
│   │   └── conformance.ts            # runSlideModelConformance（新增建议，§2.5）
│   └── __tests__/                    # 同位测试（02 §4.0 惯例，非独立顶层 tests/，见 §9）
│       ├── lifecycle.test.ts             # 插件包必含（defineLifecycleSuite）
│       ├── mutations-property.test.ts    # property：任意合法 Mutation 序列后 bodySchema.parse 通过
│       └── invariants-repair.test.ts     # property：随机破坏 body → repair 一次即 check 为空、再次无变化
```

每个顶层目录一句职责：`domain/` 不依赖 `application`/`infrastructure`/`interface`（只依赖 M-02 的类型与 `@cordexjs/shared`）；`application/` 依赖 `domain/`，产出 `MutationDef[]`/`CommandDef[]`；`infrastructure/` 依赖 `domain/`+`application/`，组装成 `DocumentType` 贡献；`interface/` 依赖 `domain/`（只读查询），不依赖 `application/` 的命令实现细节（`exec.*` 走 `ctx.commands.execute`，不直接调用 handler）；`testing/` 依赖以上全部，供包外契约测试与夹具复用。

## 5. 文件职责表

> 逐文件一行，与 §4 一一对应；「允许依赖」省略 `@cordexjs/kernel`/`@cordexjs/shared`（全部文件隐式可用，除 `domain/model/**` 类型文件不引入 `@cordexjs/kernel`）。测试文件另见 §9。

**根配置（9）**

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `package.json` | 包元数据与 `cordex` 字段 | — | — | `layer:'V-model' bundle:'slide' iso:'iso' role:'plugin'` |
| `tsconfig.json` | extends `tooling/tsconfig/iso.json` | — | — | `isolatedDeclarations:true` |
| `tsconfig.test.json` | 测试专用 tsconfig | — | — | include `__tests__`/`testing` |
| `vitest.config.ts` | 测试运行配置 | — | — | environment: node（iso 包） |
| `api-extractor.json` | API 报告配置 | — | — | mainEntry `lib/index.d.ts` |
| `etc/model-slide.api.md` | api-extractor 基线报告 | — | — | 入库，PR diff 必审 |
| `README.md` | 包职责与公共 API 概览 | — | — | manifest-gen 写入标记区 |
| `CHANGELOG.md` | 版本记录 | — | — | Changesets 生成 |
| `cordex-manifest.json` | 静态插件清单产物 | — | — | 由 `src/manifest.ts` 序列化 |

**`src/` 顶层（8）**

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `src/index.ts` | 公共 API 面唯一入口 | 见 §6 | `domain/*`、`application/mutations/index`、`application/commands/index`、`infrastructure/document-type`、`interface` | 禁止副作用（`sideEffects:false`） |
| `src/plugin.ts` | 主插件（只读部分） | `name/inject/provide/apply` | `infrastructure/document-type`、`domain/shape-kind` | §3 |
| `src/editing.ts` | 编辑子插件 | `name/inject/apply` | `application/mutations (index)`、`application/commands (index)` | 子路径 `./editing`，独立 chunk |
| `src/manifest.ts` | 生成物 | `manifest: Manifest` | — | 头部标记 generated |
| `src/slide.contribution.ts` | `declare module '@cordexjs/kernel'` 增强 + 贡献点导出 | `Context.slides`、`Events`、`ShapeKindPoint` | `domain/shape-kind/shape-kind.point` | 无运行时 import（lint `contribution-file-purity`） |
| `src/ids.ts` | 品牌 id 与 OOXML id 类型 | `MasterId/LayoutId/SlideId/ShapeId/ThemeId/MediaId/NotesId`、`OoxmlIds` | `@cordexjs/shared`（`NodeId`/`Brand`） | 基于 `NodeId` 细分 |
| `src/events.ts` | 事件名常量 | 与 `slide.contribution.ts` 一致的字符串字面量表 | — | lint `cordex/events-must-be-declared` 校验（原名 `events-declared`，GV-15） |
| `src/errors.ts` | 本包错误码 | `LAYOUT_IN_USE`/`MASTER_IN_USE`/`PLACEHOLDER_LIMIT_EXCEEDED`/`PLACEHOLDER_TYPE_INCOMPATIBLE`/`SLIDE_LIMIT_EXCEEDED`/`ELEMENT_LIMIT_EXCEEDED` | `@cordexjs/kernel`（`defineErrors`） | §2.6 命令 fail-closed 路径引用；点式值（14 §1 C-16 通则）：`slide.layout_in_use`/`slide.master_in_use`/`slide.placeholder_limit_exceeded`/`slide.placeholder_type_incompatible`；`SLIDE_LIMIT_EXCEEDED`/`ELEMENT_LIMIT_EXCEEDED`（rulings §4.15 Q5 编辑期守卫）**不另立点式值**（原 `slide.slide_limit_exceeded`/`slide.element_limit_exceeded` 作废），映射到 protocol 错误码 `document.quota_exceeded`（常量 `DOCUMENT_QUOTA_EXCEEDED`，M-02 `errors/codes.ts`；详情 `{dimension, limit, actual}`，HTTP 409，命令守卫拒绝、**不关连接**，rulings §4.17 D2）：`SLIDE_LIMIT_EXCEEDED` → `dimension:'slides'`，`ELEMENT_LIMIT_EXCEEDED` → `dimension:'elementsPerSlide'`（单页超限）或 `'elementsTotal'`（文档总元素超限）；二者是本包的映射常量而非独立错误码，故不违反 C-16「值全文件唯一」；导入期超包络是 M-04 的 `format.quota_exceeded`，不在本包 |

**`domain/model/`（12，实体表与聚合根）**

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `domain/model/index.ts` | 桶导出 | 全部实体/值对象类型 | 本目录内文件 | 供 `application`/`interface`/`testing` 统一引入 |
| `domain/model/body.ts` | 聚合根实体表 | `PresentationBody` | `master/layout/slide/theme/shape/media/extensions` | 04 §3.1 |
| `domain/model/presentation.ts` | 单例配置实体 | `Presentation` | `theme.ts`（无，仅类型引用）、`text/list-style` | `conformance`/`sections`/`properties`；2026-09-26 增只读 `firstSlideNum?`（30/04 §3.7） |
| `domain/model/master.ts` | 母版实体 | `SlideMaster` | `common-slide-data`、`text/list-style` | ML-01/03（04 §12.1） |
| `domain/model/layout.ts` | 版式实体 | `SlideLayout` | `common-slide-data` | `showMasterShapes`/`preserve`/`userDrawn` |
| `domain/model/slide.ts` | 页实体 | `Slide` | `common-slide-data` | `hidden`/`notesId?`；2026-09-26 增 `showMasterShapes?`（`p:sld@showMasterSp`） |
| `domain/model/common-slide-data.ts` | 页/版式/母版共用容器数据 | `CommonSlideData` | `drawing/background` | 形状不在此（按 `containerId` 反查） |
| `domain/model/theme.ts` | 主题实体 | `Theme`、`ColorMap`、`ObjectDefaults`（2026-09-26 新增） | `drawing (re-export)`、`text/*`（`objectDefaults` 的文本属性） | 12 槽色板 + 字体方案；`objectDefaults` M2 只读建模（30/04 §3.7） |
| `domain/model/media.ts` | 媒体引用 | `MediaRef` | `@cordexjs/model-core`（`BlobRef`） | 不含字节 |
| `domain/model/properties.ts` | 文档属性 | `DocumentProperties` | `extensions.ts` | `app`/`custom` 为 `OpaquePartRef` |
| `domain/model/extensions.ts` | 不透明槽类型 | `OpaqueSlot`、`OpaqueXml`、`OpaquePartRef` | `@cordexjs/model-core`（`drawing/opaque` re-export） | 全部已建模实体持有 |
| `domain/model/derived.ts` | 派生字段清单 | 标注集合（文档用途，非运行时） | `@cordexjs/model-core`（`Derived<T>`） | 04 §7 |

**`domain/model/shape/`（13，形状判别联合）**

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `shape/shape.ts` | 形状判别联合 + 公共基形 | `Shape`、`ShapeBase` | `non-visual.ts`、各 kind 文件、`@cordexjs/shared`（`FracKey`） | `kind` 为判别字段 |
| `shape/non-visual.ts` | 非可视属性 | `NonVisualProps`、`ShapeLocks` | `@cordexjs/model-core`（`Hyperlink`） | `placeholder?: PlaceholderRef`；2026-09-26 补 `decorative?` |
| `shape/sp.ts` | 普通形状 | `Sp` | `drawing/shape-properties`、`drawing/shape-style`、`text/text-body` | `useBackgroundFill`；`isTextBox?`（`p:cNvSpPr@txBox`，2026-09-26 补列，30/04 §4.2） |
| `shape/pic.ts` | 图片形状 | `Pic`、`BlipFill`、`PicMedia` | `media.ts` | `sourceRect?`/`stretch\|tile`；2026-09-26 补 `BlipFill.alpha?`/`svgMediaId?` 与 `Pic.media?: PicMedia`（30/04 §3.7） |
| `shape/grp-sp.ts` | 组合形状 | `GrpSp`、`GroupTransform` | `@cordexjs/model-core`（`Transform`） | 子形状按 `parentId` 反查，无 `childIds` |
| `shape/cxn-sp.ts` | 连接线 | `CxnSp`、`ConnectionRef` | `shape.ts`（`ShapeId` 引用） | `startConnection?/endConnection?: ConnectionRef`；线条与箭头插入也落此（R-d-64） |
| `shape/graphic-frame.ts` | 图形容器 | `GraphicFrame` | `table.ts`/`chart.ts`/`ole.ts`/`diagram.ts` | `graphic` 判别联合 |
| `shape/table.ts` | 表格 | `Table`、`TableProperties`、`TableColumn`、`TableRow`、`TableCell`、`CellKey` | `text/text-body`、`@cordexjs/shared`（`FracKey`） | 2026-09-26 改为归一化：`columns`/`rows`/`cells` 记录表（30/04 §3.8）；原 `columnWidths: Emu[]` 原子列表作废 |
| `shape/chart.ts` | 图表 | `Chart`、`ChartData`（M3） | `extensions.ts`（`OpaquePartRef`）、`@cordexjs/shared`（`FracKey`） | M1–M2 只有 `partRef`（不透明）；M3 起 `data?: ChartData`（五类，30/04 §3.9） |
| `shape/ole.ts` | OLE 嵌入 | `Ole` | `extensions.ts`、`media.ts` | `progId`/`preview?: { media: MediaId; contentType }`——由 M-04 `ole.ts` 从 `mc:Fallback` 的 `p:pic` 提取，M1 渲染预览图（EMF/WMF 预览 M2 由 M-07 惰性栅格化；rulings §4.15 Q7） |
| `shape/diagram.ts` | SmartArt | `Diagram` | `extensions.ts` | 只读保留：`dataPart`/`drawingPart?: PartName`（`dsp:drawing` 由 M-07 经 `ooxml-core` 只读解析渲染，rulings §4.15 Q7）；原 `fallbackShapeIds?` **删除**（不再把 drawing 物化成模型形状，避免与只读解析双源） |
| `shape/unknown.ts` | 未知形状兜底 | `UnknownShape` | `extensions.ts`、`@cordexjs/model-core`（`Transform`） | `mc:AlternateContent` 等；新增 `transform: Transform`（取所选分支 `xfrm`）与 `renderHint: 'fallback-pic'\|'fallback-shapes'\|'placeholder'`（rulings §4.15 Q7，PD-18 结案；2026-09-26 裸 `p:contentPart` 也映射到此，`renderHint:'placeholder'`，R-d-76；同日增只读标签 `source?: 'math'\|'model3d'\|'ink'\|'zoom'\|'chartex'\|'contentPart'\|'other'`，50/25 提出）：删除整体移除（M1 P0），移动/缩放写 `transform`、由 M-04 回写到每个分支（M2 P1）；其余内容仍不透明 |
| `shape/placeholder.ts` | 占位符引用值对象 | `PlaceholderRef`、`PlaceholderType` | — | ML-01…03 核心字段 |

**`domain/model/text/`（8）与 `drawing/`（5）**

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `text/text-body.ts` | 文本容器 | `TextBody` | `body-properties.ts`、`paragraph.ts` | ED-02/03 |
| `text/body-properties.ts` | 文本框属性 | `BodyProperties` | — | `autofit: none\|normal\|shape`（ED-24） |
| `text/paragraph.ts` | 段落 | `Paragraph`、`Inline` | `paragraph-properties.ts`、`run.ts` | `endProperties?` |
| `text/paragraph-properties.ts` | 段落属性 | `ParagraphProperties` | `bullet.ts` | `level:0..8` |
| `text/run.ts` | 行内元素 | `Run`、`LineBreak`、`Field` | `run-properties.ts` | 判别字段 `kind` |
| `text/run-properties.ts` | 字符属性 | `RunProperties` | `@cordexjs/model-core`（`Fill`/`FontRef`/`Hyperlink`） | ED-03 |
| `text/list-style.ts` | 列表样式 | `ListStyle` | `paragraph-properties.ts` | `levels: Partial<Record<0..8,…>>` |
| `text/bullet.ts` | 项目符号 | `Bullet` | `media.ts`（图片项目符号） | ED-04 |
| `drawing/index.ts` | re-export 入口 | `Color/Fill/Line/EffectList/Geometry/Transform/FontRef` 等 | `@cordexjs/model-core/drawing` | **不重定义**，Shared Kernel |
| `drawing/shape-properties.ts` | 形状可继承视觉属性 | `ShapeProperties` | `drawing/index.ts` | 全字段可选（I-ML1） |
| `drawing/shape-style.ts` | 样式引用 | `ShapeStyle` | `drawing/index.ts`（`Color`） | `lineRef/fillRef/effectRef/fontRef` |
| `drawing/background.ts` | 背景 | `Background` | `drawing/index.ts` | 判别联合 |
| `drawing/slide-hyperlink.ts` | 内部超链接解释 | `resolveInternalHyperlink` | `@cordexjs/model-core`（`Hyperlink`） | 2026-09-26 起解释 `Hyperlink.target` 判别联合（30/04 §3.7）：`slide` 分支与 `show` 分支（`first\|last\|next\|previous\|lastViewed\|end`，R-d-77 补后两项）；原字符串形态 `slide:<SlideId>` 作废 |

**`domain/model/schema/`（6，zod schema，按领域分组）**

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `schema/index.ts` | `bodySchema` 组合入口 | `presentationBodySchema` | 本目录内 5 个 schema 文件 | schema-lock 哈希源（ADR-0009） |
| `schema/presentation.schema.ts` | `Presentation` 校验 | `presentationSchema` | `model/presentation.ts` | — |
| `schema/masters-layouts-slides.schema.ts` | 母版/版式/页校验 | `masterSchema/layoutSchema/slideSchema` | `model/{master,layout,slide,common-slide-data}.ts` | 三者共用 `commonSlideData` 校验 |
| `schema/shape.schema.ts` | 形状判别联合校验 | `shapeSchema` | `model/shape/*.ts` | 含 `slide.shapeKind` 贡献的第三方 schema 合并点 |
| `schema/text.schema.ts` | 文本校验 | `textBodySchema` | `model/text/*.ts` | — |
| `schema/theme-drawing.schema.ts` | 主题与 drawing 组合校验 | `themeSchema` | `model/theme.ts`、`model/drawing/*.ts` | — |

**`domain/style/`（9）、`domain/query/`（4）、`domain/invariants/`（7）、`domain/geometry/`（1）、`domain/shape-kind/`（2）、`domain/` 根（2）**

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `style/placeholder-match.ts` | 占位符匹配与版式重匹配计划 | `placeholderFamily/matchPlaceholder/planLayoutChange/planReset` | `domain/model`、`domain/query/selectors` | 04 §12.2；ML-02 |
| `style/object-defaults.ts` | 新元素默认样式取值（2026-09-26 新增，rulings §4.21 R-d-63） | `defaultStyleFor` | `domain/model`（`Theme.objectDefaults`） | `objectDefaults` → PowerPoint 内建 `p:style`；只返回引用，不烤解析值 |
| `style/effective.ts` | 母版继承与反向索引 | `masterTextStyleKind/inheritedParagraphProperties/resolvePlaceholderBox/effectiveBackground/effectiveColorMap/dependentsOf` | `domain/model`、`domain/query/selectors` | ML-03 即时更新的反向索引来源 |
| `style/inheritance-chain.ts` | 构建解析链 | `buildChain` | `style/placeholder-match`、`style/effective` | 04 §6.1 七级链 |
| `style/resolve-run.ts` | 字符属性解析 | `resolveRunProperties` | `style/inheritance-chain` | 结果全字段必填 |
| `style/resolve-paragraph.ts` | 段落属性解析 | `resolveParagraphProperties` | `style/inheritance-chain` | 结果全字段必填 |
| `style/resolve-shape.ts` | 形状视觉解析 | `resolveShapeVisual` | `domain/model`（`Theme.formatScheme`） | style refs → theme |
| `style/resolve-color.ts` | 颜色解析 | `resolveColor` | `domain/model`（`ColorMap`） | scheme→clrMap→theme→修饰符 |
| `style/cache.ts` | 样式缓存与失效 | `createStyleCache/invalidate` | `@cordexjs/model-core`（`ChangeSet`） | LRU 5000，淘汰需被测试（A29） |
| `query/selectors.ts` | 只读选择器 | `getSlide/getShape/getMasterOf/getPlaceholderOnLayout/slidesInOrder/shapesOf/childrenOf` | `domain/model`、`@cordexjs/model-core`（`filterLive`/`isTombstoned`） | 结果按 `(order,id)` 排序 + 派生缓存；默认过滤 `_deleted` 墓碑实体（rulings §4.15 Q3） |
| `query/table-grid.ts` | 表格读视图（2026-09-26 新增） | `liveColumns/liveRows/cellAt/cellKey` | `domain/model`、`@cordexjs/model-core`（`filterLive`） | 按 `(order,id)` 排序、过滤墓碑；缺格返回空格（I-TBL1 读时容错）；M-04 导出与 M-07 渲染共用 |
| `query/text-search.ts` | 查找（2026-09-26 整合新增，50/18 FND-01/02） | `findMatches(body, query, options) → Match[]` | `domain/model`、`domain/query/{selectors,table-grid}` | 纯函数：跨页、形状与表格单元格的文本匹配（大小写、全字）；M2 只查幻灯片内容、不含演讲者备注，查找面板也不设「含备注」选项（rulings §4.25 TB-27，2026-10-07；原「与备注」作废）；`Match` 以 `TextTarget` + 段落与偏移定位；`slide.replaceAll` 用它的结果 |
| `query/traverse.ts` | 遍历 | `walkShapes/pathOfShape` | `domain/model` | 深度优先、z 序；跳过墓碑实体及其子树 |
| `invariants/element-limits.ts` | 规模上限（新增，rulings §4.15 Q5） | `SlideLimits`（2026-09-25 增 `softWarnSlides`）、`DEFAULT_SLIDE_LIMITS`、`countElements(body)`、`checkLimits(body, delta, limits)` | `domain/model` | 计数读原始表（墓碑计入，母版/版式形状与组合形状均计）；命令层守卫与 `I-LIM1` 共用同一函数；数值由插件 `Config.limits` 注入，不硬编码于调用点 |
| `invariants/reassign.ts` | 默认版式选取（新增，rulings §4.20 FE-03） | `defaultLayoutOf(body, {masterId, type?, exclude?})` | `domain/model`、`domain/query/selectors` | 30/04 §12.3 I-ML2 链，跳过墓碑与 `exclude`；命令层 `reassignTo`、I-ML2 修复、ADR-0034 修复、`deleteMaster` 逐页选取（FE-23）与 M-07/M-04/M-10 读时替代共用；slide-ui 不得自行实现（40/14 N-21） |
| `invariants/table.ts` | 表格不变量（2026-09-26 新增，rulings §4.21 q-table-depth） | `tableCoverage`（I-TBL1）、`tableSpans`（I-TBL2） | `domain/model`、`domain/query/table-grid` | 缺格补空格（键与内容确定）；越界跨度收缩、孤立合并标记清除；repair 幂等 |
| `invariants/group.ts` | 空组不变量（2026-09-26 新增，R-d-78） | `emptyGroup`（I-GRP1） | `domain/model`、`domain/query/selectors` | 无存活子元素的组写墓碑，只写一次 |
| `invariants/placeholder.ts` | 内容族占位符唯一（2026-09-26 整合新增，50/21 §3、ADR-0018 决策 10） | `placeholderUnique`（I-PH1，软） | `domain/model`、`domain/style/placeholder-match` | 同页同 `(type, idx)` 存活内容族占位符至多一个；修复保留 `(order, id)` 最小者，其余 `materialize`；只由服务端软门禁执行，客户端读时容错 |
| `invariants/index.ts` | 不变量注册表 | `slideInvariants: Invariant<PresentationBody>[]`（I-ML2…I-ML8 + I-LIM1 + I-TBL1/I-TBL2/I-GRP1 + I-PH1（软，2026-09-26 整合）+ 基础项；I-LIM1 仅报告不 repair） | `domain/model`、`domain/query/selectors`、`style/effective`（`dependentsOf`） | ADR-0034 slide 实例，04 §12.3 |
| `invariants/validate-change-set.ts` | 变更集校验映射 | `validateChangeSet` | `invariants/index.ts` | 默认实现来自 model-core，此处只配置前缀映射 |
| `geometry/group-transform.ts` | 取消组合的变换折算（2026-09-26 新增） | `foldChildTransform` | `domain/model` | 2×3 仿射只在本包用于折算；与 engine-layout 渲染矩阵共用测试向量；斜切丢弃并诊断 |
| `shape-kind/shape-kind.point.ts` | 贡献点类型 | `ShapeKindPoint`、`ShapeKindDef<T>`、`ShapeCapabilities` | `domain/model/shape` | 04 §3.3；2026-09-26 `capabilities` 扩五位、`createDefault(box, opts?)`，`opts` 含 `preset`（形状库条目的 `prst`，50/22） |
| `shape-kind/builtin.ts` | 内建形状类型注册 | `builtinShapeKinds` | `shape-kind.point.ts`、`domain/model/shape/*` | `sp/pic/grpSp/cxnSp/graphicFrame:*/unknown` |
| `domain/selection.ts` | 选区锚点 | `SlideSelectionAnchor` | `@cordexjs/model-core`（`Selection<A>`）、`domain/model/shape` | 04 §3.6 |
| `domain/create-empty.ts` | 空白文档构造 | `createEmptyPresentation` | `domain/model`、`domain/model/theme` | 默认主题+1 母版+若干版式+1 空白页 |

**`application/mutations/`（11）**

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `mutations/index.ts` | Mutation 汇总 | `allSlideMutations: MutationDef[]` | 本目录内 9 个定义文件 | `editing.ts` 唯一读取点 |
| `mutations/slide.ts` | 页级 Mutation | 7 个 `MutationDef`（§2.6；2026-09-26 增 `slide.setProperties`）；M3 起 8 个（+`slide.setNotes`，14 §1 C-03） | `domain/model`、`@cordexjs/model-core`（`StoreOp`） | — |
| `mutations/shape.ts` | 形状级 Mutation | 12 个 `MutationDef`（2026-09-26 增 `shape.setNonVisual`、`shape.patchKindData`、`pic.setBlipFill`、`cxnSp.setConnections`） | `domain/model`、`domain/geometry/group-transform`、`domain/shape-kind`（kind schema）、`@cordexjs/model-core`（`StoreOp`） | 含 `group`/`ungroup` |
| `mutations/text.ts` | 文本 Mutation | 4 个 `MutationDef` | `domain/model`、`@cordexjs/model-core`（`TextDelta`） | ED-02/03/04/13 |
| `mutations/table.ts` | 表格 Mutation | 9 个 `MutationDef`（2026-09-26 增 `table.setTableProperties`、`table.setSizes`，M3） | `domain/model`、`domain/query/table-grid`、`@cordexjs/model-core`（`TextDelta`） | ED-10；按 `rowId`/`colId` 寻址，删行删列写墓碑 |
| `mutations/media.ts` | 媒体注册 Mutation | 1 个 `MutationDef` | `domain/model`、`@cordexjs/model-core`（`BlobRef`） | 不含字节 |
| `mutations/chart.ts` | 图表数据 Mutation（M3，2026-09-26 新增） | 2 个 `MutationDef`（`chart.setData`、`chart.setOptions`） | `domain/model` | ED-15；类别、系列删除写墓碑 |
| `mutations/layout.ts` | 版式/占位符 Mutation | 9 个 `MutationDef`（含 `slide.setLayout`） | `domain/model`、`domain/style/placeholder-match`（remap 类型） | ML-02/03 |
| `mutations/master.ts` | 母版 Mutation | 7 个 `MutationDef` | `domain/model` | ML-03 |
| `mutations/theme.ts` | 主题 Mutation | 4 个 `MutationDef` | `domain/model` | ML-04，逐槽位 `set` |
| `mutations/lower.ts` | `lower()` 路径构造辅助 | `bodyPath` 工具 | `@cordexjs/shared`（`Path`） | 供以上全部复用 |

**`application/commands/`（18）与 `application/diff.ts`（1）**

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `commands/index.ts` | Command/Operation 汇总 | `allSlideCommands: (CommandDef\|OperationDef)[]` | 本目录内 16 个定义文件（`insert-common.ts` 是工具，不含命令；`section-commands.ts` 为 2026-09-26 整合新增） | `editing.ts` 唯一读取点；对全文类命令统一包 `whenLoaded` 守卫（§2.6，rulings §4.18 CO-12） |
| `commands/insert-common.ts` | 插入命令公共部分（2026-09-26 新增，ADR-0018 决策 1） | `planInsert` | `domain/invariants/element-limits`、`domain/style/object-defaults`、`@cordexjs/shared`（`order.between`、`newNodeId`） | 规模守卫前置计数、`order` 置顶、`creationId` GUID 与「类型 + 序号」名称、默认样式；全部新增元素的命令共用 |
| `commands/slide-commands.ts` | 页管理命令 | `slide.addSlide/deleteSlides/duplicateSlide/reorderSlides`+`setSlideBackground/setSlideHidden`（14 §1 C-03 新增）+`setNotes`（M3 新增）+`setSlideProperties`（2026-09-26）＝8 个（§12 G-7 说明移除 `changeLayout`） | `application/mutations/slide`、`@cordexjs/shared`（`order.between`） | ED-11 |
| `commands/shape-commands.ts` | 形状编辑命令 | 11 个 `CommandDef`＋4 个新增（`pasteShapes`/`setEffect`/`alignShapes`/`distributeShapes`，14 §1 C-03）＋4 个（`setAdjustValues`/`changeShape`/`flipShapes`/`insertFreeform`，2026-09-26 rulings §4.21）＋1 个（`setShapeOpacity`，2026-10-08 rulings §4.25 TB-47）＝20 个 | `application/mutations/shape`、`commands/insert-common`、`commands/fill-placeholder-commands`（删除补回） | ED-05/06/08 |
| `commands/text-commands.ts` | 文本编辑命令 | 6 个 `CommandDef`＋9 个新增（`setFontFamily`/`toggleItalic`/`toggleUnderline`/`toggleStrikethrough`/`setTextColor`/`setTextHighlight`/`clearRunFormatting`/`setIndentLevel`/`setLineSpacing`，14 §1 C-03）＝15 个 | `application/mutations/text` | ED-02/03/04/13 |
| `commands/picture-commands.ts` | 图片命令 | 3 个 `CommandDef`＋4 个（`setPictureTransparency`/`resetPicture`/`compressPicture`/`setPictureFill`，2026-09-26）＝7 个 | `application/mutations/{media,shape}`、`commands/insert-common` | ED-07、ED-06 |
| `commands/table-commands.ts` | 表格命令 | 8 个 `CommandDef`＋5 个（`table.clearCells`（M2）与 `table.setStyle`/`resizeColumn`/`resizeRow`/`setBorders`（M3），2026-09-26）＝13 个 | `application/mutations/table`、`commands/insert-common` | ED-10；插入 M2，结构与样式 M3 |
| `commands/connector-commands.ts` | 线条与连接符命令（2026-09-26 新增） | 3 个：`setLineEnds`/`connectEnds`/`changeConnectorType` | `application/mutations/shape` | ED-06、ED-28 |
| `commands/alt-text-and-hyperlink-commands.ts` | 非可视属性命令（2026-09-26 新增） | 3 个：`setAltText`/`setHyperlink`/`setAction` | `application/mutations/{shape,text}` | ED-26、ED-19、ED-05 |
| `commands/header-footer-commands.ts` | 页眉页脚与字段（2026-09-26 新增） | 2 个：`setHeaderFooter`/`insertField` | `application/mutations/{shape,text}`、`commands/insert-common` | M2 P2 |
| `commands/fill-placeholder-commands.ts` | 内容占位符填入（2026-09-26 新增） | 1 个：`fillPlaceholder`；导出 `restoreEmptyPlaceholder` 供 `deleteShapes` 同事务补回 | `application/mutations/{shape,media}`、`commands/insert-common`、`domain/style/placeholder-match` | ML-03 |
| `commands/media-commands.ts` | 音视频与图标（2026-09-26 新增） | 4 个：`insertMedia`/`replacePoster`/`insertIcons`/`recolorSvg` | `application/mutations/{shape,media}`、`commands/insert-common` | P2、M2 P1、M3 P2 |
| `commands/chart-commands.ts` | 图表命令（M3，2026-09-26 新增） | 6 个：`insertChart`/`chart.setData`/`setType`/`setTitle`/`setLegend`/`setDataLabels` | `application/mutations/{shape,chart}`、`commands/insert-common` | ED-15 |
| `commands/section-commands.ts` | 节命令（M3，2026-09-26 整合新增，50/18 SLD-05） | 4 个：`addSection`/`renameSection`/`removeSection`/`moveSection` | `application/mutations/slide` | 节 Mutation 随 30/04 §3.7 的节建模落在 `mutations/slide.ts`；`moveSection` 一个事务改节与页的 `order` |
| `commands/layout-commands.ts` | 版式与占位符命令 | 11 个 `CommandDef`（含 `applyLayout`/`resetSlide`/`deleteLayout`）＋1 个新增（`setLayoutProperties`，14 §1 C-03）＋`resetPlaceholderFields`（2026-09-26，rulings §4.20 FE-24）＝13 个 | `application/mutations/layout`、`domain/style/placeholder-match`、`domain/invariants/reassign` | ML-02/03、Q11、Q16；`deleteLayout` 支持 `layoutIds` 批量单事务、可撤销（FE-05/FE-24） |
| `commands/master-commands.ts` | 母版命令 | 5 个 `CommandDef`＋1 个新增（`setMasterProperties`，14 §1 C-03）＋1 个（`renameMaster`，2026-10-08 rulings §4.25 TB-46）＝7 个 | `application/mutations/master`、`domain/invariants/reassign` | ML-03、Q11；`deleteMaster` 逐页按 `defaultLayoutOf({masterId: reassignTo, type})` 选取（FE-23） |
| `commands/theme-commands.ts` | 主题命令 | 3 个 `CommandDef` | `application/mutations/theme` | ML-04 |
| `commands/operations.ts` | 视图态 Operation | `slide.setCurrentSlide/setSelection/setZoom/selectMasterOrLayout`＋`slide.chart.openDataEditor`（2026-09-26，M3） | `domain/selection` | 不入历史；`broadcast` 见 §2.6 |
| `application/diff.ts` | 版本恢复差分 | `diffBodies` | `domain/model`、`application/mutations/*`（构造 Mutation） | M3；`documentType.diff` 钩子实现 |

**`infrastructure/`（3）、`interface/`（2）、`testing/`（4）、`src/__tests__/`（3）**

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `infrastructure/document-type.ts` | 组装 `DocumentType` 贡献 | `slideDocumentType: DocumentType<PresentationBody>` | `domain/model/schema`、`domain/invariants`、`application/diff`、`domain/create-empty` | `plugin.ts` 唯一读取点 |
| `infrastructure/migrations/index.ts` | 迁移注册表 | `slideMigrations: Migration[]` | `@cordexjs/model-core`（`Migration`） | M1 空数组但注册（A23） |
| `infrastructure/snapshot/sharding.ts` | 大 body 分片扩展点 | `shardBody?/unshardBody?`（M1 直通实现） | `@cordexjs/model-core`（`BlobRef`/`SnapshotBundle`） | 新增建议，落地 00 §6.3 第 4 点，见 §8/§12 G-5 |
| `interface/index.ts` | 接口层桶导出 | `SlidesService` 类型、`exec.*` 契约 | `interface/services/slides.service` | 供 `src/index.ts` re-export |
| `interface/services/slides.service.ts` | UnitScope 内只读服务 | `SlidesService`（`body/slide/shape/order/shapesOf/resolved/exec`） | `domain/query`、`domain/style`、`@cordexjs/model-core`（`commands`/`store` 类型） | 04 §3.4；`exec.*` 内部仍 `ctx.commands.execute` |
| `testing/index.ts` | 测试辅助桶导出 | `builders`/`fixtures`/`conformance` re-export | 本目录内文件 | `./testing` 子路径入口 |
| `testing/builders.ts` | 构造器 | `presentation().slide().shape(...).text(...).build()` | `domain/model`、`domain/create-empty` | 链式 API |
| `testing/fixtures.ts` | 典型 body 夹具 | `singleTextSlideBody`/`inheritedMasterBody`/`groupedShapesBody`/`tableBody` | `testing/builders.ts` | M-04/M-07 契约测试复用 |
| `testing/conformance.ts` | 文档类型级契约套件 | `runSlideModelConformance(createBody)`（新增建议，§2.5） | `infrastructure/document-type`、`domain/invariants`、`domain/shape-kind` | 供 `model-doc`/`model-sheet` 对照实现 |
| `src/__tests__/lifecycle.test.ts` | 插件生命周期契约 | — | `@cordexjs/kernel/testing`（`defineLifecycleSuite`） | 插件包必含（02 §4.0） |
| `src/__tests__/mutations-property.test.ts` | Mutation 合法性 property test | — | `testing/*`、`fast-check` | 任意合法 Mutation 序列后 `bodySchema.parse` 通过 |
| `src/__tests__/invariants-repair.test.ts` | 修复幂等 property test | — | `domain/invariants`、`fast-check` | 随机破坏 body → repair 一次即净、再次无变化 |

## 6. 对外 API 面

`src/index.ts` 导出（类型为主；`Mutation`/`Command` 定义只在 `editing.ts` 内部向贡献点注册，根导出只给类型与纯函数，供 `slide-render`/`slide-ui` 直接调用只读能力而不必经 `commands.execute`）：

- **类型**：`PresentationBody`、`Presentation`、`SlideMaster`、`SlideLayout`、`Slide`、`Shape`（`Sp|Pic|GrpSp|CxnSp|GraphicFrame|UnknownShape`）、`Theme`、`TextBody`、`PlaceholderRef`/`PlaceholderType`、`MasterId/LayoutId/SlideId/ShapeId/ThemeId/MediaId`、`SlideSelectionAnchor`、`ResolvedRunProperties`/`ResolvedParagraphProperties`/`ResolvedShapeVisual`、`SlidesService`、`PlaceholderRemap`、`InheritableField`。
- **值**：`createEmptyPresentation`、`buildChain`/`resolveRunProperties`/`resolveParagraphProperties`/`resolveShapeVisual`/`resolveColor`、`placeholderFamily`/`matchPlaceholder`/`planLayoutChange`/`planReset`、`dependentsOf`、`createStyleCache`、`defaultLayoutOf`（2026-09-26 新增，rulings §4.20 FE-03：slide-ui、slide-render、ooxml-pptx 从根入口 import 同一符号，不各自实现）。
- **子路径导出**：`./editing`（编辑子插件，见 §3）、`./testing`（契约套件与夹具，见 §2.5/§9）。`package.json#cordex.publicEntry` 登记为 `['.', './editing', './testing']`，与 `exports` key 集合逐一相等；跨包 import 只能走这三条（rulings §4.18 FE-04）。
- **api-extractor 稳定级**：`beta`（M1）——`ShapeProperties`/`extensions` 槽字段随 M2/M3 细化的概率高；`PresentationBody` 六张表的**键名**一经发布视为 `stable`（`ooxml-pptx`/`slide-render` 大量硬编码路径前缀，改名属破坏性变更）。

**关键类型契约草案**（≤ 40 行）：

```ts
export interface PresentationBody {
  presentation: Presentation
  masters: Record<MasterId, SlideMaster>
  layouts: Record<LayoutId, SlideLayout>
  slides: Record<SlideId, Slide>
  themes: Record<ThemeId, Theme>
  shapes: Record<ShapeId, Shape>
  media: Record<MediaId, MediaRef>
  opaqueParts: Record<PartName, OpaquePartRef>
}

export type Shape = Sp | Pic | GrpSp | CxnSp | GraphicFrame | UnknownShape
export interface ShapeBase {
  id: ShapeId; kind: Shape['kind']
  containerId: SlideId | LayoutId | MasterId
  parentId: ShapeId | null
  order: FracKey
  nonVisual: NonVisualProps; ooxml: OoxmlIds; extensions: OpaqueSlot
}

export interface SlidesService {
  body(): PresentationBody
  slide(id: SlideId): Slide | undefined
  shape(id: ShapeId): Shape | undefined
  order(): readonly SlideId[]
  shapesOf(container: SlideId | LayoutId | MasterId): readonly ShapeId[]
  resolved: {
    run(shapeId: ShapeId, paragraph: number, run: number): ResolvedRunProperties
    shape(shapeId: ShapeId): ResolvedShapeVisual
  }
}

export declare function createEmptyPresentation(): PresentationBody
export declare function planLayoutChange(
  body: PresentationBody, slideId: SlideId, newLayoutId: LayoutId
): readonly PlaceholderRemap[]
```

## 7. 前后端与运行时

本包是纯 iso 包，**不存在 Provider 变体**——不像 `store-memory`/`store-yjs` 那样有可替换实现；浏览器与 `server-headless` 加载同一份源码（module-map §5 行）。

| 场景 | 接入路径 | 说明 |
|---|---|---|
| 浏览器（编辑） | `preset-slide`/`preset-slide-collab` 装配（本包不被 `apps/web` 直接 import） | `plugin.ts`+`editing.ts` 均加载 |
| 浏览器（查看器） | `preset-slide-viewer` | 只加载 `plugin.ts`（ADR-0015 两道只读保证之一） |
| 服务端（导入/导出/校验/迁移） | `apps/server` 的 `cordis-host/preset-server.ts` 选定插件清单（含本包 `plugin.ts`+`editing.ts`），交 `createHeadlessHost({ plugins })` 装配；`server-headless` 自身文档类型盲、不 import 本包（rulings §4.18 FE-01） | 命令管线以 `principal:system` 执行（05 §11） |
| 服务端（协同房间） | `server-collab` 经 `store-yjs` 持有 body，命令管线在 Room 内以真实 principal 执行 | 本包对协同模式无感知（§1.3 Conformist） |

进程间契约：本包**不出现在** `@cordexjs/protocol` 的任何 REST DTO / WS 帧里——`PresentationBody` 只经 `Snapshot.body`（M-02 的 JSON 编解码边界）或 CRDT update 字节跨进程，前后端各自 import 本包源码解释这些字节，不存在「序列化本包类型直接传输」的路径。母版/版式/主题相关错误码（`LAYOUT_IN_USE` 等）经 `CommandError.data` 透传，最终落在 protocol 的通用 `ErrorEnvelope` 里（该壳对 `LAYOUT_IN_USE` 语义无知）。

## 8. doc / sheet 扩展缝

本包是 `model-doc`/`model-sheet` 的**样板**（module-map §6.2）。

| 文件 / 目录 | 标注 | 复制到 doc/sheet 时怎么变 |
|---|---|---|
| `domain/model/**` | slide 专属 | 完全重写：doc 是 `blocks` 有序序列，sheet 是稀疏 `cells` 字符串键（`<sheet>:<r>:<c>`）；`domain/model/drawing/` 对 `@cordexjs/model-core/drawing` 的 re-export 模式不变 |
| `domain/style/**` | slide 专属算法，**模式**可复制 | 占位符/母版继承是 PowerPoint 语义，不直接复用；但「纯函数 + revision 缓存 + `invalidate(changeSet)`」（`style/cache.ts`）这一结构原样复制 |
| `domain/query/**`、`domain/invariants/**` | 垂直束模板 | 目录名、`Invariant<S>{check,repair}` 签名照抄；内容按各自领域重写 |
| `domain/shape-kind/**` | slide 专属概念（sheet 无对应物，doc 可能有 `blockKind`） | sheet 大概率不需要；doc 若需要按同一贡献点模式（`doc.blockKind`）新增 |
| `application/mutations/**`、`application/commands/**` | 垂直束模板 | 目录结构、三段式 id 约定（`<docType>.<entity>.<verb>`）、能力位默认值原样复制；具体 type 集合重写 |
| `infrastructure/document-type.ts` | 垂直束模板 | `DocumentType<S>` 组装骨架复制，`bodySchema`/`shape: BodyShapeHints`/`invariants` 换成各自领域的 |
| `infrastructure/migrations/index.ts` | 垂直束模板 | 空表起步，模式相同 |
| `infrastructure/snapshot/sharding.ts` | **主要为 sheet 预留**（新增建议） | slide 当前是直通实现；`model-sheet` 的巨大 `cells` 表是本文件真正要解决的场景，对应 module-map §6.3 第 4 点 |
| `interface/services/*.service.ts` | 垂直束模板 | 改名 `docs.service.ts`/`sheets.service.ts`；只读投影 + `exec.*` 模式复制 |
| `testing/conformance.ts` | 垂直束模板 | `runSlideModelConformance` → `runDocModelConformance`/`runSheetModelConformance`，断言项模式相同 |
| `src/plugin.ts`/`editing.ts` 两段式加载 | 垂直束模板 | 「只读主插件 + 编辑子插件」拆分模式原样复制，供各自 viewer 预设复用 ADR-0015 |
| `PlaceholderRef`、`SlideMaster.textStyles`、`reassignTo` 语义 | slide 专属，**不复制** | doc/sheet 没有「母版/版式」概念；sheet 若需要「样式集」，另起纯函数而非硬套占位符匹配算法 |

铁律 2（束间隔离）在本包的落地：`domain/**`/`application/**` 不 import 任何 `model-doc`/`model-sheet` 类型；`__tests__`/`testing/` 只使用本包自己的夹具，不反向依赖未来的 doc/sheet 测试夹具；本包会被 M-13 的 `horizontal-freeze` 排除在「冻结对象」之外（本包本身就是垂直束，不是被冻结的水平层）。

## 9. 测试布局

物理位置遵循 02 §4.0 包模板的**同位测试**约定（`src/__tests__/` + `testing/` 子路径），不是独立的顶层 `tests/` 目录；下表按逻辑类别映射到 §4/§5 已列的物理文件：

**测试布局映射图**

```mermaid
flowchart LR
subgraph logical["逻辑类别"]
unit["unit 单测"]
contract["contract 契约"]
lifecycle["lifecycle 生命周期"]
fixtures["fixtures 夹具"]
end
subgraph physical["物理位置"]
domainunit["domain/** 同级隐式单测"]
applicationunit["application/** 同级隐式单测"]
mutationsproperty["src/__tests__/mutations-property.test.ts"]
invariantsrepair["src/__tests__/invariants-repair.test.ts"]
conformance["testing/conformance.ts"]
lifecycletest["src/__tests__/lifecycle.test.ts"]
builders["testing/builders.ts"]
fixturests["testing/fixtures.ts"]
end
unit --> domainunit
unit --> applicationunit
contract --> mutationsproperty
contract --> invariantsrepair
contract --> conformance
lifecycle --> lifecycletest
fixtures --> builders
fixtures --> fixturests
```

怎么读：本包无独立顶层 `tests/` 目录，物理位置均落在 §4/§5 已列文件内；`unit/` 的同级隐式单测未在 §4 逐一列出 `.test.ts`，遵循包内惯例；`testing/conformance.ts` 供本包与下游调用；`lifecycle` 测试用 `defineLifecycleSuite`，是插件包强制项；`fixtures` 经 `./testing` 子路径导出，供 M-04/M-07/M-10/M-13 复用。

| 测试类别 | 覆盖内容 | 源文件 | 补充 |
|---|---|---|---|
| unit | 每个纯函数（`resolveRunProperties`/`planLayoutChange`/`dependentsOf`/`matchPlaceholder`…）的确定性与边界用例；`defaultLayoutOf`（rulings §4.20 FE-03/FE-23）：三级回退、跳过墓碑与 `exclude`、删除母版首个版式时 `reassignTo` ≠ 被删版式、`deleteMaster` 目标母版有同 `type` 版式时每页 `type` 不变、没有时落目标母版首个版式 | `domain/style/**`、`domain/query/**`、`domain/invariants/**`；`defaultLayoutOf` 的显式文件 `src/domain/invariants/__tests__/reassign.test.ts`（70/05 §7.1 `ml/default-layout-of-chain`，2026-09-26 登记） | 同级隐式单测，不在 §4 目录树重复标注 |
| property | `lower()` 纯度、`repair` 幂等、`bodySchema` 往返；`planLayoutChange` 两条（rulings §4.18 CO-18）：带显式 `transform` 的占位符换版式后位置不变、`materialize` 后文本渲染快照不变（不只比包围盒） | `src/__tests__/mutations-property.test.ts`、`invariants-repair.test.ts` | fast-check（`@cordexjs/shared/testing` + 本包 `testing/builders.ts`） |
| contract | 文档类型级契约套件 | `testing/conformance.ts`（`runSlideModelConformance`） | 本包 `__tests__` 与 M-04（往返后再跑一次）共同调用 |
| lifecycle | 插件生命周期、`preset-slide-viewer` 不加载 `editing.ts` | `src/__tests__/lifecycle.test.ts` | `defineLifecycleSuite`（02 §4.0） |
| 命令层集成 | `commands.execute` 端到端（权限/事务/审计）；渐进打开期间全文类命令等 `unit/loaded` 后才执行（rulings §4.18 CO-12）；rulings §4.20：带 `reassignTo` 的 `deleteLayout`/`deleteMaster` 执行后撤销栈深度 +1、`core.undo` 一步恢复各页引用与版式（同一 id，FE-05）；`deleteMaster` 整个删除一个事务（FE-23）；`deleteLayout{layoutIds}` 批量单事务、`resetPlaceholderFields` 一步撤销且只清所列字段、`applyLayout` 结果计数与 Toast N 一致（FE-24）；property：`deleteLayout(reassignTo)` 结果与 I-ML2 修复一致（FE-03） | 依赖 M-02 `command-harness.ts`；本包只提供 `slideDocumentType` 作为输入；FE-05/FE-23/FE-24 用例文件 `src/__tests__/master-layout-delete.test.ts`（70/05 §7.1 `ml/*`，store-memory 与 store-yjs 各一次），property 文件 `src/__tests__/master-layout-property.test.ts`（70/05 §10）；两者不调用 kit，按 70/01 §4 归 `test/unit`（2026-09-26 登记） | `LAYOUT_IN_USE`/`reassignTo` 用例见 05 §12 |
| 协同模拟（`test/collab-sim`，70/05） | rulings §4.20 FE-04：「A 删 L、B 同时对 P 应用 L」两端收敛；TTL 内 `P.layoutId` 仍为 L 且渲染用替代版式；A 撤销后 P 显示 L；硬删后 `P.layoutId` 等于 `defaultLayoutOf` 结果且修复只写一次；导出 pptx 中 P 引用存活版式；FE-05：撤销被引用版式删除时他人已改的页只跳过该键并提示 | 根 `test/collab-sim/`（不在本包） | 场景 id 以 70/05 为准 |
| 可追加元素（2026-09-26，rulings §4.21） | `planInsert`：插入超限不开事务（单页 999/1,000/1,001、全文 19,999/20,000/20,001 含墓碑）、一次插入一个撤销步、空文本框退出与插入合并、`fillPlaceholder` 与删除补回各一步；I-TBL1/I-TBL2、I-GRP1 的 property（随机并发插删行列、合并拆分、删除组内元素后 `repair` 一次即净、再次无变化）；`foldChildTransform` 与 engine-layout 共用测试向量；`defaultStyleFor` 只返回引用 | 同级隐式单测 + `src/__tests__/mutations-property.test.ts`、`invariants-repair.test.ts` 扩用例 | 协同收敛场景在 `test/collab-sim`（70/05） |
| 第二批命令与 I-PH1（2026-09-26 整合） | `findMatches` 覆盖形状与单元格、不含备注（rulings §4.25 TB-27，原「与备注」作废），大小写与全字选项；`replaceAll` 一个事务、一步撤销；节命令：`moveSection` 后页序与节序一致、`removeSection{withSlides:false}` 页归入前一节；I-PH1：并发填入同一占位符后 `repair` 一次保留 `(order, id)` 最小者，再次无变化 | 同级隐式单测（`domain/query/text-search`、`application/commands/section-commands`）+ `src/__tests__/invariants-repair.test.ts` 扩用例 | 协同场景「两人同时填入同一空内容占位符」在 `test/collab-sim`（70/05） |
| 第三批命令（2026-10-08，rulings §4.25 TB-46、TB-47） | `renameMaster` 一个事务、一步撤销，只改母版名、不影响版式与页；`setShapeOpacity` 多选一个事务，填充与描边颜色的 alpha 同时改、一步撤销即两者都回退，导出写回颜色 alpha | 同级隐式单测（`application/commands/{master,shape}-commands`）；命令层用例走 M-02 `command-harness.ts` | — |
| fixtures | 单页文本/母版继承/分组/表格四类典型 body | `testing/fixtures.ts` | M-07/M-10/M-13 复用；表格夹具按归一化形态（2026-09-26） |

覆盖率门槛与证据归档以 [70/01 §8](../70-testing/01-strategy-and-layers.md) 为准，性能预算以 [70/09](../70-testing/09-performance-and-capacity.md) 为准（rulings §4.20 TX-10，原引架构 11 改指）；样式解析缓存淘汰测试见 §2.3 `style/cache.ts`（A29）。

## 10. 机械约束

| 规则 | 机制 | 依据 |
|---|---|---|
| `package.json#cordex` | `{layer:'V-model', bundle:'slide', iso:'iso', role:'plugin', stability:'beta'}` | 02 §4.0.1 schema |
| 只向下依赖 | R2：本包只能 import 秩 ≤15 的包（`kernel`/`shared`/`protocol`/`model-core`） | depcruise |
| 垂直束隔离 | R4 `cordex-bundle-isolation`：不得 import `model-doc`/`model-sheet` | depcruise（铁律 2） |
| 水平层反向保护 | R3：本包受保护，水平层不得反向 import 本包 | depcruise（铁律 1；本包是被保护对象） |
| 不出现 XML 类型 | 本包不依赖 `ooxml-core`，物理上不可能引入 XML 类型（ACL 边界见 04 §5） | depcruise（无直接依赖边） |
| 单位品牌 | `no-px-in-model`（`Px` 出现在 `domain/model/**` 即错误）；`no-magic-emu`（禁裸 914400 字面量） | tsc + eslint（04 §8/§11） |
| Mutation 无 `inverse` | `no-inverse-in-mutation`；`MutationDef.schema` 为 `strictObject` | lint + 契约测试（ADR-0007） |
| Mutation 无数组下标 | `cordex/no-index-in-mutation`（TD-065） | lint（02-lint-rules §4.17，05 §12） |
| 命令能力位必填 | `command-declares-capability` | lint（05 §12） |
| 命令 id / Mutation type 命名 | `command-id-format`：`<domain>.<name>` / `<docType>.<entity>.<verb>` | 扫描器 `scan-command-capabilities` 规则 (c)（05 §12；原名 `command-id-format`，TD-099，rulings §4.18 GV-15） |
| 失败不用 boolean | `no-boolean-command-result` | lint |
| 事件先声明后使用 | `cordex/events-must-be-declared`（08 §11 对照名 `events-declared`；`src/events.ts` 与 `slide.contribution.ts` 一致） | lint（rulings §4.18 GV-15） |
| 版式/母版删除 fail-closed | 无 `reassignTo` → `LAYOUT_IN_USE`/`MASTER_IN_USE` 且无事务；带 → 一次撤销恢复（rulings §4.20 FE-05：Q11 修订为确认后可撤销，`CommandDef.undoable` 不改） | `command-harness` 契约测试（05 §12） |
| 默认版式单一选取函数 | `defaultLayoutOf` 只在 `domain/invariants/reassign.ts` 定义；slide-ui、slide-render、ooxml-pptx 从 `@cordexjs/model-slide` 根入口 import（rulings §4.20 FE-03） | 评审 + slide-ui `edit-target.test.ts` 断言使用同一导出符号（M-10 §9） |
| 删除即墓碑（rulings §4.15 Q3） | 全部 `.remove` 类 `lower()` 只产出 `set(…._deleted)`，不对实体行发 `delete`/`remove` | `runSlideModelConformance` 的 lower 纯度分节 + property 测试 |
| 插入命令单一守卫（2026-09-26，rulings §4.21） | 新增元素的命令一律经 `commands/insert-common.ts` 的 `planInsert`；`creationId`、名称、行列 id 只在命令里生成 | 评审 + `command-harness` 断言各插入命令超限时无事务 |
| 表格按 id 寻址（2026-09-26） | `table.*` Mutation 载荷无下标、无 `columnWidths` 数组 | lint `cordex/no-index-in-mutation` + schema-lock |
| 规模上限守卫（rulings §4.15 Q5） | 新增实体的命令超限返回 `SLIDE_LIMIT_EXCEEDED`/`ELEMENT_LIMIT_EXCEEDED`（→ `document.quota_exceeded{dimension, limit, actual}`，rulings §4.17 D2）且无事务；墓碑计入；上限值只来自 `Config.limits` | `command-harness` 契约测试 + 边界用例（19,999/20,000/20,001，含墓碑） |
| `testing/` 不进生产 | `no-testing-in-prod`：`domain/**`/`application/**`/`infrastructure/**`/`interface/**` 不得 import `./testing` | depcruise（02 §4.0.2） |
| API 报告 | `etc/model-slide.api.md` 入库，PR diff 必审 | api-extractor + CI |
| 类型治理 | 品牌类型 / `Result` / 禁 `enum`（`PlaceholderType`/`LayoutType` 等用 const 对象） | 09-type-discipline（ADR-0042/0047） |

## 11. 里程碑与实施顺序

**M0 骨架**（与 M-01 工具链并行）：根配置 9 个文件 + `src/{index,plugin,manifest,slide.contribution,ids,events,errors}.ts`；`domain/model/**`（全部实体/值对象类型）+ `schema/**`（`bodySchema` 的地基）；`domain/{create-empty,selection}.ts`；`infrastructure/document-type.ts`（先挂空 `invariants`/`migrations`，跑通 `core.documentType` 贡献链路）；`testing/{builders,fixtures}.ts`。验收：`pnpm --filter @cordexjs/model-slide build` 通过；`slideDocumentType.bodySchema.parse(createEmptyPresentation())` 成功；最小 host 内 `ctx.documentTypes.get('slide')` 可取到条目。

**M1 首个可运行切片**：补齐 `domain/query/**`、`domain/style/**`（先只要 04 §6 七级链跑通，不含 ML 继承细化）、`application/mutations/{slide,shape,text}.ts`、`application/commands/{slide,shape,text}-commands.ts`、`domain/shape-kind/**`、`src/editing.ts`；`domain/invariants/**` 只建基础项（无父子环、`order` 合法、`containerId` 存在）+ `element-limits.ts`（守卫与 I-LIM1）；全部 `.remove` 类 Mutation 按墓碑语义实现、选择器过滤墓碑（rulings §4.15 Q3/Q5 均属 M1 数据形状，后补即破坏快照兼容）；`testing/conformance.ts` 初版 + `src/__tests__/*`。

切片语义（对应任务书要求「打开 pptx 夹具的模型 → 移动形状 → 撤销」）：pptx 导入本身是 M-04 的职责，本包在此切片中的验收边界是——`slideDocumentType` 描述的 body 能被 M-04 导入结果 `load` 进 `store-memory`；`shape.setTransform` 的 `MutationDef.lower()` 产出正确 `StoreOp`；`slide.moveShapes` 命令经 M-02 命令管线执行后 `store.undo(local)` 能精确回到移动前状态（深等于）。三者拼起来即「打开 → 移动 → 撤销」链路里**本包负责的那一段**。

验收命令（草案）：
```bash
pnpm --filter @cordexjs/model-slide build
pnpm --filter @cordexjs/model-slide test src/__tests__/mutations-property.test.ts
pnpm --filter @cordexjs/model-slide test -- --grep "runSlideModelConformance"
pnpm --filter @cordexjs/model-slide test -- --grep "moveShapes.*undo"
# command-harness 用例：insertShape → moveShapes → undo → state() 深等于 moveShapes 之前
```

**M2**：`application/mutations/{table,media,layout,master}.ts`、`commands/{picture,table,layout,master}-commands.ts`；`domain/invariants/**` 补全 I-ML2…I-ML7；`domain/style/{placeholder-match,effective}.ts`；`infrastructure/snapshot/sharding.ts`（直通实现）——覆盖 ML-01/ML-02（P0）与 ED-05…ED-11。验收：`slide.applyLayout`/`slide.resetSlide`/`slide.deleteLayout(reassignTo)` 的 `command-harness` 用例全绿；母版视图只读穿透测试（占位符可选中不可编辑，M2 范围）。

**M2 补（2026-09-26，rulings §4.21）**：`commands/{insert-common,connector-commands,alt-text-and-hyperlink-commands,header-footer-commands,fill-placeholder-commands,media-commands}.ts`、`domain/{style/object-defaults,query/table-grid,invariants/table,invariants/group,geometry/group-transform}.ts`；`shape.ts` 的四个新 Mutation；表格归一化形态（建议 M1 导入即采用）与 `insertTable`（插入 + 单元格文字）。P2 项（`insertFreeform`、`insertMedia`、`setPictureFill`、`setHeaderFooter`、`insertField`）不阻塞 M2 出口。

**M3**：`application/mutations/theme.ts`、`commands/theme-commands.ts`、`application/diff.ts`；`domain/model/shape/chart.ts` 的 `data` 字段（ED-15）与 `mutations/chart.ts`、`commands/chart-commands.ts`；表格结构与样式命令（`table.*`、`table.setTableProperties`、`table.setSizes`）；`insertIcons`、`recolorSvg`（P2）；`domain/invariants` 补全 I-ML8；`layout-commands.ts`/`master-commands.ts` 剩余项（占位符增删上限、多选批量删除前置）——覆盖 ML-03/ML-04。验收：`slide.deleteMaster(reassignTo)`/`slide.applyTheme` 撤销一致性；`diffBodies` 往返测试（版本恢复）。

## 12. 与现有文档的差异与追加建议

| # | 涉及文档 | 差异 / 发现 | 追加建议（不直接生效） |
|---|---|---|---|
| G-1 | `02-layering-and-packages.md` §4.8 vs 本文档 §4 | 02 §4.8 给出的是扁平结构（`model/`/`mutations/`/`commands/`/`services/`/`style/`/`query/`/`invariants/`/`shape-kind/` 直接在 `src/` 下），本文档按 00-module-map §1 的 DDD 对照表把同一批文件收拢进 `domain/`/`application/`/`infrastructure/`/`interface/` 四个顶层目录；文件名与职责未变，只改父目录路径 | 若总编排采纳 DDD 顶层目录作为物理事实源，02 §4.8 需要同步改写；若否，本文档 §4/§5 的路径前缀需整体回退为扁平结构（属于机械替换，不影响本文档其余内容的正确性）。两种方案二选一，不建议长期并存导致代码生成器歧义 |
| G-2 | `02-layering-and-packages.md` §4.8 vs §4.0 包模板 | §4.8 的树未列出 `events.ts`/`errors.ts`，但 §4.0 通用包模板明确要求每个包都有这两个文件；`model-slide` 确实需要（`LAYOUT_IN_USE`/`MASTER_IN_USE` 等错误码、5+5 个事件常量） | 本文档已按模板补齐（§4/§5）；建议 02 §4.8 的树同步补上这两行，避免其它模块规划 agent 误以为 model-slide 没有专属错误码 |
| G-3 | `02-layering-and-packages.md` §4.8 `schema/` 行 | 02 §4.8 只写「`schema/` 每个实体的 zod schema」，未定颗粒度；本文档按「按领域分组（6 个文件）」而非逐类型 1:1（≈30+ 个文件）落地，以控制维护成本 | 若类型治理条线认为「完整到文件」要求逐类型 1:1，需在 09-type-discipline 补一条颗粒度基线并回写本文档 §4/§5；当前按分组处理，一致性由 `bodySchema` 组合处的类型测试兜底 |
| G-4 | 04 §2.5 契约套件命名约定、02 §4.0.2 | `run<Definition>Conformance` 命名约定面向 Definition/Provider 对；`DocumentType` 是贡献点条目而非 Definition，严格讲不适用该约定。本文档新增 `runSlideModelConformance` 并在 §2.5 说明命名差异原因 | 建议 02 §4.0.2 或 04 号文档补一条「文档类型级契约套件」命名规则（`run<DocType>ModelConformance`），使 M-13 的 `model-doc`/`model-sheet` 有明文可依，而不是靠本文档单点示范 |
| G-5 | 00-module-map §6.3 第 4 点、04 §2.5 | `SnapshotBundle.body` 的 `$ref: BlobRef` 分片扩展点在章程/module-map 只是「已内建的参数化点」，未指定落在哪个文件；本文档新增 `infrastructure/snapshot/sharding.ts` 作为 slide 束的具体落点（M1 直通实现） | 建议 M-02（`model-core`）与 M-13（`model-sheet`）规划 agent 确认分片协议的具体接口形状（谁调用 `shardBody`：`codec.ts` 还是 `store.toSnapshotBody()`），避免各垂直束各自发明不兼容的分片格式 |
| G-6 | charter §5.5、00-module-map BC-06 行 | 权威事件表只登记 `slide/slide-added`/`.removed`/`shape-added`/`.removed`/`.changed` 5 个；本文档 §2.4 为 ML-01…ML-04 新增建议 `slide/layout-added`/`.removed`、`master-added`/`.removed`、`theme-changed` | 需总编排在 charter §5.5 或事件总表中正式裁定是否采纳；若否，删除本包 `events.ts` 对应 5 个常量与其派生逻辑即可，模型字段不受影响 |
| G-7 | 02 §4.8 `commands/slide-commands.ts` vs 05 §13.2 `layout-commands.ts` | 02 §4.8 在 `slide-commands.ts` 列出 `slide.changeLayout`；05 §13.2（更晚、ML 专项）在 `layout-commands.ts` 定义语义相近但签名不同的 `slide.applyLayout`（`{slideIds;layoutId}`，一页一事务）。本文档 §2.6/§5 采用 `slide.applyLayout` 为唯一权威，从 `slide-commands.ts` 移除 `changeLayout` | 建议 02 §4.8 同步删除 `changeLayout`，避免下游（M-10 `slide-ui`）的工具条与检查器绑定时误对接两个语义重叠的命令 id |
| G-8 | PRD `07-masters-layouts-and-themes.md` ML-03（Q16）、架构 04 | PRD 只给出占位符上限的**描述性规则**（标题/居中标题、日期、页脚、页码各至多 1 个；「内容族的上限未定，待架构 30/04 §12.1 补表」），但架构 04 全文未给出具体数字表 | 建议 04 号文档补一张「占位符类型 → 数量上限」表，被本包 `domain/invariants/index.ts`（新增建议条目 `I-ML9`）与 `addPlaceholder` 命令前置校验共同引用；本文档暂只声明校验点存在，数值留白 |
| G-9 | PRD `07-masters-layouts-and-themes.md` ML-03「母版管理」段原文 | PRD 原文自述「目标版式选取细则待设计 26 补稿（登记于 G-73 待补）」——`slide.deleteMaster(reassignTo)` 跨母版重指到哪个版式尚未定案 | ~~本文档 §2.6 暂沿用与 `deleteLayout` 相同的「该母版首个版式」规则占位~~ **已结案（2026-09-26，rulings §4.20 FE-23）**：`reassignTo?: MasterId` 为目标母版，每个受影响页取 `defaultLayoutOf(body, {masterId: reassignTo, type: 原版式的 type})`，整个删除一个事务；§2.1、§2.6 已改写，PRD G-73 结案 |

### 2026-09-18 收敛（回写员 R1，依据 `14-cross-module-review.md` §1 全部 30 条推荐裁定）

本次收敛落实的裁定编号与本文档改动位置：

| 裁定 | 改动位置 | 摘要 |
|---|---|---|
| C-03 | §2.6（新增 14 行 / 18 个命令 id）、§0/§1（命令计数 55→73）、§3（Manifest 片段计数）、§4（文件数不受影响的说明）、§5（`slide-commands.ts`/`shape-commands.ts`/`text-commands.ts`/`layout-commands.ts`/`master-commands.ts` 五行计数） | 补齐 M-10/G-13 指出的 UI 需要但清单缺失的命令；除 `slide.setNotes`（M3 新增 Mutation）外全部复用既有 Mutation |
| C-01 | §2.6 末尾（`view.setMode` 归属说明补充具体文件路径） | 确认定义在 `ui-core/application/operations/view-set-mode.ts`（M-10），本包不重复定义 |
| C-16 | §4（`src/errors.ts` 目录树注释）、§5（`src/errors.ts` 文件行） | 四个本包错误码补齐点式值（域前缀 `slide.`），对齐 TS 常量 `UPPER_SNAKE`/值点式双轨通则 |

**C-04 不适用**：`slide/show-changed` 事件由 M-07（`07-slide-rendering.md`）定义与发布，本文档全篇未提及该事件，无需同步。

### 2026-09-24 回写（rulings §4.15，章程 §10 Q1–Q10 裁决）

| 裁决 | 改动位置 | 摘要 |
|---|---|---|
| Q3 撤销语义 | §2.1（实体表 `Shape` 行、新增「软删除墓碑与规模上限」段）、§2.6（通用规则段、`slide`/`layout`/`master` 三个 Mutation 行）、§5（`query/selectors.ts`/`traverse.ts`）、§10、§11 | 五张实体表删除一律写 `_deleted` 墓碑（`StoreOp` 仍 5 种）；读路径默认过滤；独占 opaque part 清理推迟到服务端 TTL 硬删除；delete-vs-edit 编辑保留 |
| Q5 规模上限 | §2.1 同段、§3 编辑子插件 `Config.limits`、§4/§5 新增 `domain/invariants/element-limits.ts`、`src/errors.ts` 两个错误码、§10 | 200 页 / 单页 1,000 / 文档总元素 20,000（软警告 15,000），部署配置完全可调；墓碑计入；命令层 fail-closed + I-LIM1 只报告 |
| Q7 保真落点 | §5 `shape/ole.ts`、`shape/diagram.ts`、`shape/unknown.ts` | `Ole.preview` 来自 `mc:Fallback` 的 `p:pic`；删除 `Diagram.fallbackShapeIds`，改记 `drawingPart`；`UnknownShape` 增加 `transform` 与 `renderHint`（PD-18 结案） |

需要其他文件配合：M-02 §2.5（中性撤销语义、`store/tombstone.ts`，已同步回写）；M-04（`UnknownShape.transform/renderHint`、`Ole.preview`、`Diagram.drawingPart` 的填充，及其 `import-envelope.ts` 元素计数口径与本文档 §2.1 一致——`shapes` 全表含母版/版式、组合形状与子形状各计 1）；M-07（经 `filterLive()` 渲染；`renderHint` 消费；`p:timing` 只读视图若需由本包建模，另行登记）；M-09（TTL 硬删除单写者与级联 opaque part 清理）；30-architecture/04 §12（不变量表补 I-LIM1）。


### 2026-09-24 复核修正（rulings §4.17）

| 裁决 | 改动位置 | 摘要 |
|---|---|---|
| D2 编辑期超上限错误码 | §2.1「规模上限」段、§4/§5 `src/errors.ts`、§10 规模上限守卫行 | `SLIDE_LIMIT_EXCEEDED`/`ELEMENT_LIMIT_EXCEEDED` 不再有独立点式值（`slide.slide_limit_exceeded`/`slide.element_limit_exceeded` 作废），改为映射到 protocol 的 `document.quota_exceeded{dimension, limit, actual}`（409，命令守卫拒绝、不关连接）；`dimension` 取值 `slides`/`elementsPerSlide`/`elementsTotal`，与 30-architecture/10 §1.4 取值表一致；与 `format.quota_exceeded`（导入，M-04）、`storage.quota_exceeded`（存储，M-08）三码并列 |

### 2026-09-25 回写（rulings §4.19 三条设计线拆分与遗留取舍）

| 依据 | 改动位置 | 摘要 |
|---|---|---|
| PRD 06 SV-08（页数软警告 150）、50/04 §13 | §3 编辑子插件 `Config.limits`、§5 `element-limits.ts` | 增 `softWarnSlides: 150`，由部署键 `scale.softWarnPages` 注入（60/17） |
| 50/06 §6–§7、§12（F69） | §2.4、§2.6 | `slide.insertText`/`deleteText` 目标扩到表格单元格与备注（`TextTarget`），写明分段与软换行的 `TextDelta` 表达；登记 `slide/autofit-changed` 事件（发布者 slide-render）与 `slide.applyAutofit` 薄命令 |
| 50/10 §7.2 | §2.6 | 登记 `slide.duplicateShapes{shapeIds, dx, dy}`（`Mod`+拖动复制，一次命令一个撤销步） |
| PRD 05 §0.2（§4.19 修订） | §2.6 | 备注编辑 `slide.setNotes` 维持 M3（ED-18 P1，与 PRD 05 一致） |

### 2026-09-26 回写（rulings §4.20 遗留小项收口）

| 依据 | 改动位置 | 摘要 |
|---|---|---|
| FE-03（默认版式统一为 I-ML2 链） | §1.2 默认版式、§2.1 `SlideLayout` 行与分工段、§2.3、图 2-2、§4/§5 新增 `domain/invariants/reassign.ts`、§6、§9、§10 | `defaultLayoutOf(body, {masterId, type?, exclude?})`：原母版同 `type` 首个 → 该母版首个 → 首个母版首个，跳过墓碑与 `exclude`；唯一定义处，slide-ui/slide-render/ooxml-pptx 从根入口 import |
| FE-04（墓碑期读时容错） | §2.1 `SlideMaster`/`SlideLayout` 行、「读路径过滤」段、§9 协同模拟行 | 引用关系指向墓碑时不写修复，读路径以替代目标求值；只在 TTL 硬删作业同事务写修复；包含关系仍视同已删除 |
| FE-05（被引用版式、母版删除确认后可撤销，Q11 修订） | §2.1 分工段、§2.6 `deleteLayout`/`deleteMaster` 行、图 2-2 怎么读、§9、§10、§13 Q7 结案 | 保留确认对话框、入撤销栈、带 [撤销] 的 Toast；`CommandDef.undoable` 不改 |
| FE-23（删除母版的目标版式） | §2.1 新增「删除母版的目标规则」段、§2.6 `deleteMaster` 行、§5 `master-commands.ts`、§9、§12 G-9 与 §13 Q6 结案 | `reassignTo?: MasterId` 为目标母版，逐页 `defaultLayoutOf({masterId: reassignTo, type})`，一个事务；UI 默认按 `order` 首个剩余母版 |
| FE-24（50/11 §11 其余待登记） | §2.6 新增 `slide.resetPlaceholderFields`、`deleteLayout` 批量、`applyLayout` 结果计数、`updatePlaceholder` 的 `lstStyle`；§5 `layout-commands.ts`（12 → 13 个） | 与 `resetSlide` 共用 `shape.clearOverrides`；批量删除一个事务；`themePreview` 登记在 M-07 |
| TX-10 ⑤ | §9 末段 | 覆盖率改指 70/01 §8、性能预算改指 70/09 |

### 2026-09-26 回写（rulings §4.21 可追加元素的模型补全与插入命令族）

| 依据 | 改动位置 | 摘要 |
|---|---|---|
| q-table-depth、ADR-0018 决策 6 | §1.2、§2.1、§2.2、§2.6（`table.*` 行、`insertTable`、`TextTarget.cell`）、§4/§5（`shape/table.ts`、`query/table-grid.ts`、`invariants/table.ts`）、§9、§10、§11 | 表格改 `columns`/`rows`/`cells` 记录表；I-TBL1/I-TBL2；M2 插入与单元格文字、M3 结构样式 |
| R-d-71、ADR-0018 决策 2 | §0、§2.6 新增 33 个命令表、1 个 Operation 与既有行参数扩展、§3 计数、§4/§5 新增 13 个文件 | Mutation 46/47 → 51/56，命令 75 → 109（含 Operation 4 → 5）；`setSlideProperties`、`table.clearCells`、`chart.openDataEditor`、`slide.setProperties` 来自族文档 50/21、50/24 |
| R-d-63、ADR-0018 决策 4 | §2.2 `ObjectDefaults`、§2.3 `defaultStyleFor`、§5 `theme.ts`、`style/object-defaults.ts` | `objectDefaults` M2 只读建模；新元素只写 `p:style` 引用 |
| docPlan 40/03、ADR-0018 决策 5、7 | §2.2 `NonVisualProps`/`BlipFill`/`PicMedia`、§5 `sp.ts`/`pic.ts`/`non-visual.ts`/`unknown.ts` | 补列 `isTextBox`、`Pic.media`、`BlipFill.alpha/svgMediaId`、`decorative`；裸 `p:contentPart` → `UnknownShape` |
| R-d-78、ADR-0018 决策 8、9 | §2.1 规则段、§2.3 `foldChildTransform`、§2.6 `moveShapes`/`deleteShapes`、§5 `invariants/group.ts`、`geometry/group-transform.ts` | 连接符 `reroute` 同事务写回；空组 I-GRP1；取消组合折算 |
| R-d-69、ADR-0018 决策 10 | §2.1、§2.6 `fillPlaceholder`、`deleteShapes`、§5 `fill-placeholder-commands.ts` | 空内容占位符填入保留 `PlaceholderRef`；删除补回空占位 |
| R-d-73 | §2.3 `placeholderFamily` 与两个新纯函数 | 占位符族按 PRD ML-03：`text`/`content`/`footer`/`other` |
| R-d-77、族文档 50/20、50/21、50/25 | §5 `slide-hyperlink.ts`、`slide.ts`、`presentation.ts`、`shape/unknown.ts` | `Hyperlink.target` 判别联合（`show` 分支补 `lastViewed`、`end`）；`Slide.showMasterShapes`；只读 `Presentation.firstSlideNum`；只读 `UnknownShape.source` |
| q-chart-route、q-media-insert、q-extra-inserts | §2.2 `ChartData`、§2.6、§11 | 图表插入与编辑 M3；音视频插入 P2 不写 `p:timing`；图标 M3 P2 |

## 13. 未决问题

| # | 问题 | 推荐默认值 | 影响范围 |
|---|---|---|---|
| Q1 | §4 的 DDD 顶层目录（`domain`/`application`/`infrastructure`/`interface`）与 02 §4.8 现存扁平目录，哪个是最终物理路径的事实源（G-1） | 采用 DDD 分层作为物理路径事实源——总编排指令与 00-module-map §1 的 DDD 对照表明确要求本包作为 `model-doc`/`model-sheet` 样板，物理落地更利于代码生成器与新人按目录名定位聚合/应用/基础设施边界 | 本文档 §4/§5 全部路径前缀；02 §4.8 是否需要同步改写；M-13 样板复制的起点 |
| Q2 | `domain/model/schema/` 按领域分组（6 个文件）还是逐类型 1:1（≈30+ 个文件）（G-3） | 分组——降低维护成本，一致性由 `bodySchema` 组合处的类型测试兜底 | 是否满足总编排「完整到文件」的粒度要求；若否需拆分并相应上调本包预计文件数（可能超出 90–110 区间） |
| Q3 | `runSlideModelConformance` 的契约边界是否需要覆盖协同并发场景（04 §12.3「并发下由 I-ML2 兜底」提到的悬空引用） | 暂不覆盖——并发合并测试放在 M-05/M-09（协同/服务端）契约套件的协同分节，本包 `runSlideModelConformance` 只覆盖单机（本地事务）场景的不变量与 lower 纯度 | M-05（`collab-*`）、M-09（服务端软门禁）规划 agent 需在其契约套件里显式引用本包 `domain/invariants` 的 `repair` 函数并补协同分节 |
| Q4 | §2.4 新增建议的 5 个 `slide/layout-*`/`master-*`/`theme-changed` 事件是否采纳（G-6） | 采纳——避免下游 UI 订阅粗粒度 `store/transaction` 再自行 diff；若担心事件表膨胀，可先只上 `slide/master-added`/`.removed`（母版数量变化最影响 UI 布局），版式/主题变化暂缓 | charter §5.5 事件总表；`slide-ui`（M-10）母版缩略图窗格的实现方式 |
| Q5 | 占位符类型计数上限的具体数值（G-8：标题类=1 已明确，但内容族/媒体族上限缺表） | 推荐由架构-结构条线在 04 号文档补一张表，本包 `I-ML9` 与 `addPlaceholder` 引用同一常量表，避免命令层与不变量层各自硬编码不同数字 | 04 §12.1 需补表；本包 `domain/invariants/index.ts`、`application/commands/layout-commands.ts` |
| Q6 | ~~`slide.deleteMaster(reassignTo)` 的跨母版目标版式选取函数最终细则（G-9，依赖设计 26 补稿）~~ **（结案，2026-09-26，rulings §4.20 FE-23）** | `reassignTo` 是目标母版；逐页取 `defaultLayoutOf(body, {masterId: reassignTo, type: 原版式的 type})`（目标母版同 `type` 首个 → 目标母版首个，与 `deleteLayout`、I-ML2 同一函数）；整个删除一个事务；UI 默认取按 `order` 排序的首个剩余母版，对话框文案「N 个页面将改用剩余母版中对应的版式」 | 本文档 §2.1 CRDT 合并语义表、§2.6 `slide.deleteMaster` 行；PRD 07 `G-73` 待补项 |
| Q7 | ~~母版/版式/主题删除采用墓碑后，`deleteLayout`/`deleteMaster` 带 `reassignTo` 的「Q11 不可撤销」口径与「可一次撤销」表述（§2.1 末段 vs §2.6 表）是否统一为「可撤销」~~ **（结案，2026-09-26，rulings §4.20 FE-05）** | 按推荐统一为可撤销（用户裁决「确认后可撤销」，记为 Q11 修订）：保留确认对话框（撤销栈只在会话内有效、墓碑 24 h 后硬删），文案删去「操作不可撤销」；执行后入撤销栈并给带 [撤销] 的 Toast；撤销时各页引用回退、版式以原 id 复活，他人后写的键按 Q3 跳过并提示；`CommandDef.undoable` 不改 | §2.1、§2.6 `slide.deleteLayout`/`deleteMaster` 行；PRD 07 ML-03 |
| Q8 | 表格行列与图表类别、系列的墓碑（2026-09-26，§4.21）由谁硬删 | 由服务端墓碑清扫一并处理（扫描 `shapes.*.graphic` 下带 `_deleted` 的记录，与实体墓碑同一 TTL）；在此之前墓碑行列只增不减、计入快照体积 | M-09 `tombstone-sweeper.ts`、60-backend/05 §8 |
