# 项目章程（Charter）—— 基于 cordis 的可插拔办公文档 SDK 与在线协同编辑器

> 状态：v0.2 草稿（M0 蓝图阶段） | 负责：总编排（Orchestrator） | 更新：2026-09-18（D10 术语、§5.2 补应用栏 ⋯/头像）
> 读者：产品 / 设计 / 架构 / 类型治理各条线的 agent 与人类评审者。
> 本文是所有下游文档（PRD、设计稿、架构文档）的**共同输入**。下游文档不得与本文冲突；若有异议，写入各自 README 的「对章程的异议/建议」段落，由总编排裁决后回写本文。
> v0.2 变更：吸收五条线的异议与建议（裁决明细见 [rulings-2026-09-14.md](./rulings-2026-09-14.md)）：垂直束改为「层带」并给出机械化秩表（§5.1/§5.3）；新增 `preset-slide-viewer`、`collab-offline-idb`、`slide-render-chart` 三包（§5.2）；`package.json#oce` 字段规范（§5.2）；依赖规则第 8 条「束间隔离」（§5.3）；服务名/贡献点 id 定稿与第三方前缀规则（§5.5）；D7/D8/D9/D11/D12 补充与 D14–D16 新增（§6.1）；里程碑 M2/M3 微调（§7）；术语表扩充（§4）；待用户决策扩至 Q20（§10）。v0.2 与 v0.1 兼容（只增不改语义），下游标注「依赖：charter v0.1」的文档无需重写。

---

## 0. 一句话定义

> 一个 **以 cordis 4 为内核、每一层都可插拔** 的办公文档 SDK：先做 **PowerPoint（.pptx）的直接读取、高保真渲染与在线协同编辑**，并以同一套内核在后续扩展到 Word（.docx）与 Excel（.xlsx）。

三个关键词：

| 关键词 | 含义 | 反例（我们不做的） |
|---|---|---|
| **SDK 优先** | 交付的是可嵌入的内核 + 插件 + 预设（preset），应用（apps/web）只是一个组装样例 | 只做一个不可拆的 Web 应用 |
| **每一级可插拔** | 内核、文档模型、存储、格式、协同、渲染、UI、服务端模块全部是 cordis 插件；任何一级都能被替换/移除而系统仍能启动 | 只在「功能层」允许插件，底座写死 |
| **文档类型盲（doc-type blind）** | 水平层（内核/存储/协同/渲染引擎/UI 基座）不知道「幻灯片」是什么；幻灯片、文档、表格是垂直插件束 | Univer 式「core 里放了 3.4 万行 sheets/docs 模型」 |

---

## 1. 背景与参考基线

- 参考对象：**Univer**（dream-num/univer，Apache-2.0，14.3k stars）。我们参考的是其 **架构骨架**，不是其实现。用户提供的《Univer 架构评估》报告（2026-09-14，基线 b3547d403）是主要依据，提炼见 [reference-univer-lessons.md](./reference-univer-lessons.md)。
- 内核框架：**cordis 4**（cordiverse/cordis，npm `cordis@4.0.0-rc.10`，2026-09-08 发布；论文 *A Programming Paradigm for Spatiotemporal Composability*，arXiv 2608.25512）。用法基线见 [cordis-primer.md](./cordis-primer.md)。
- pptx 生态现状（2026-09）：不存在成熟的「读→编辑→无损写回」TS 库。可借鉴的对象与其可借鉴点：
  - `ChristopherVR/pptx-viewer`（Apache-2.0，93★）：CSS/DOM 渲染、判别联合元素类型、EMU 内部单位、Element→Placeholder→Layout→Master→Theme 样式解析链、Strict↔Transitional 命名空间归一化、Yjs 协同雏形。
  - `aiden0z/pptx-renderer`（Apache-2.0，112★）：高保真 HTML/SVG 渲染，**以 PowerPoint 真机导出为 oracle 的视觉回归测试**（SSIM/IoU），SafeXmlNode 空安全遍历，逐节点错误隔离，懒解析。
  - `@hokkyss/pptx`（MIT，新生）：品牌类型单位（`Emu`/`Inches`/`Points`）、同构、reader/writer/core 三分包。
  - `PPTist`（AGPL-3.0，9.3k★）：**仅作交互参考，禁止引入代码**（许可证不兼容）。
  - Univer `packages/slides`：alpha 级，不作实现参考。

---

## 2. 目标与非目标

### 2.1 本阶段（M0 蓝图）目标

1. 产出可评审的 **PRD、设计稿、架构文档、类型治理方案**，细致到目录级别（每个目录/文件写什么）。
2. 固化 **不可协商的硬约束**（§3）与 **术语**（§4），使后续实现不必反复讨论。
3. 形成 **里程碑骨架**（§7）与 **待用户决策清单**（§10）。

### 2.2 产品长期目标

- 直接打开 `.pptx`，高保真渲染，多人实时协同编辑，导出为合法 `.pptx` 且未修改部分**零丢失**。
- 第三方可以在**不改内核**的前提下：新增元素类型、新增渲染方式、新增 UI 面板/菜单、替换存储/协同/鉴权实现、新增文档类型。
- 同一套内核在浏览器与 Node（NestJS 服务端）中运行同一份模型/格式代码。

### 2.3 非目标（明确不做）

- 不做 Canvas 优先的通用绘图引擎（先 DOM/SVG，见 §6）。
- 不做 `.ppt`（97-2003 二进制）读写。
- 动画/切换效果：M1–M3 **渲染结束态、不播放、原样保留与回写**；播放为 M4+ 的 P2；编辑不在 M1–M3 范围。
- 不做移动端「整包复刻」；移动端是变化点插件（Univer 教训 A7）。
- 不做插件的安全沙箱（cordis 的 isolate 不是安全边界，见 primer）；插件信任模型为「同源可信」，第三方插件走审核/签名而非运行时隔离。

---

## 3. 硬约束（来自用户要求，逐条具体化）

| # | 用户要求 | 具体化为可检查的约束 |
|---|---|---|
| R1 | 参考 Univer SDK 设计规划 editor | 继承：命令三分法、per-unit 作用域、逻辑/UI 分包、严格 DAG 依赖、Disposable 纪律。规避：内核边界错位、104 个 register*、声明不执行、闭合文档类型枚举、手写逆操作、DI override 接缝、猴子补丁 facade、全局可变注册表。见 lessons 文档 |
| R2 | cordis 插件机制，**每一级都可插拔** | 每个包要么是 cordis 插件，要么是被插件加载的纯库；任一层存在 ≥1 个「定义（Definition）」与可替换的「提供者（Provider）」；`apps/*` 只做组装与传输壳，零**编辑器领域逻辑**（命令/模型/协同/渲染不得出现在 apps）；应用壳自身的页面（文档列表、分享与权限、插件管理器宿主页）属于应用，允许存在 |
| R3 | editor 分层合理 | §5 的分层网格 + 依赖规则由 dependency-cruiser 机械执行；违反即 CI 失败 |
| R4 | 前后端，后端 NestJS，考虑协同 | `apps/server` 为 NestJS 11；协同网关、导入导出、快照持久化、鉴权均为 Nest 模块并内嵌 cordis 宿主复用同构包 |
| R5 | 后续扩展 doc、excel | 水平层「文档类型盲」；`DocumentType` 为开放注册的 contribution point，不是枚举；M5 用 `model-doc`/`model-sheet` 骨架验证 |
| R6 | 直接读取 pptx，在线协同编辑 | OPC/OOXML 层同构；未建模部分**不透明保留（opaque preservation）**到部件级与节点级；协同以 CRDT 为单一事实源 |
| R7 | TS 强类型规约 + 约束机制（hooks、扫描脚本） | tsconfig 最严格集 + typescript-eslint strict-type-checked + 自研扫描器 + lefthook + CI 门禁；**每条规范必须对应一个机械执行点**，且有「规范↔执行」矩阵被 CI 校验（Univer 的核心教训） |

---

## 4. 术语表（所有文档必须使用）

### 4.1 核心术语

| 术语 | 英文标识 | 定义 |
|---|---|---|
| 内核 | `kernel` | 对 cordis 4 的薄封装，唯一允许 `import 'cordis'` 的包；提供 ContributionPoint、Manifest、错误/日志/遥测基础服务、`createIsolatedScope` |
| 插件 | `Plugin` | cordis 的可挂载生命周期单元（函数/类/对象三种形态）；本项目默认函数插件 |
| 纤程 | `Fiber` | 一个插件的一次运行实例（cordis 概念），拥有 effect 清理与状态机 |
| 服务 | `Service` | 挂在 `ctx.<name>` 上的命名能力，有 Definition（契约）/ Provider（实现）/ Consumer（使用方）三角色 |
| 贡献点 | `ContributionPoint` | 内核提供的**唯一**注册抽象：类型化、带 schema、由 effect 拥有生命周期、可静态列举。替代 Univer 的 104 个 `register*` |
| 清单 | `Manifest` | 插件包的静态描述：provides / injects / contributes / events / isomorphism class；由源码生成，不运行即可知道插件贡献了什么 |
| 文档单元 | `Unit` | 一份打开的文档实例（一个 pptx 即一个 Unit）；拥有独立作用域（UnitScope）；由 `model-core` 的 `units` 服务管理 |
| 单元作用域 | `UnitScope` | 通过 kernel 的 `createIsolatedScope`（内部对约定服务集逐个 `ctx.isolate()`）为每个 Unit 隔离出的服务域（`store`、`history`、`selection`、`render`、`presence` 等按单元隔离），保证同页多文档互不污染 |
| 文档类型 | `DocumentType` | 开放注册的垂直能力束（slide / doc / sheet），声明其模型、编解码器、单元插件 |
| 模型 | `Model` | 运行时文档对象图（类型化），通过 `DocumentStore` 读写 |
| 存储 | `DocumentStore` | 模型的事务化读写接口（`transact`/`observe`/`undo`/`redo`，带 `Origin`）；只理解 `StoreOp` 原语；Provider 有 `store-memory`、`store-yjs` |
| 存储原语 | `StoreOp` | Store 唯一理解的 5 种结构操作：`set`/`delete`/`insert`/`remove`/`text`（无 `move`：有身份实体的顺序由 `order: FracKey` 字段承载，移动即 `set`；原子数组用 `remove`+`insert`）；逆操作在此层由 Provider 推导 |
| 降级 | lowering | 文档类型贡献的纯函数 `lower(mutation, view) → StoreOp[]`，把语义 Mutation 变成原语 |
| 命令 | `Command` | 用户意图；可读状态、计算，然后在一个事务内执行若干 Mutation；不同步；返回 `Result`，不返回 boolean |
| 变更 | `Mutation` | **唯一**修改 Store 的操作；可序列化、确定性、可权限校验、可审计；只能在事务内产生，外部不可直接执行；逆操作由 Store 推导（不手写） |
| 操作 | `Operation` | 视图状态变化（选区、缩放、当前页）；不持久化，可作为 presence 广播 |
| 事务 | `Transaction` | 一组 Mutation 的原子应用单元，也是撤销/重做粒度；携带 `Origin` |
| 来源 | `Origin` | 事务来源：`local(clientId)` / `remote` / `system(import|migration)` / `repair` / `replay`；撤销只作用于 `local` |
| 变更集 | `ChangeSet` | 一次事务触及的 `StoreOp[]` + 派生脏路径集合，供渲染与编解码做脏追踪 |
| 快照 | `Snapshot` | 模型的持久化形态（JSON，带 `schemaVersion`）；与运行时模型有**显式编解码边界**；只含 `BlobRef`，不含二进制 |
| 快照包 | `SnapshotBundle` | `Snapshot` + 内容寻址 Blob 集合 |
| Blob 引用 | `BlobRef` | `{ hash, size, contentType }`，指向 `BlobStore` 中的不可变字节 |
| 派生类型 | `Derived<T>` | 类型级品牌，标记不得进入 Snapshot 的派生字段；`Persisted<T>` 将其剔除 |
| 资源钩子 | `ResourceHook` | 插件把自有数据挂进 Snapshot 的唯一途径（命名空间由模板字面量类型约束） |
| 编解码器 | `FormatCodec` | 外部格式 ↔ 模型的导入/导出器（如 `ooxml-pptx`），按 MIME 注册到 `core.format` 贡献点 |
| 部件 | `Part` | OPC 包内的一个 zip 条目（xml/媒体），带关系（rels）与内容类型 |
| 不透明保留 | opaque preservation | 部件级：未建模 Part 以原始字节保留（`OpaquePartRef`）；节点级：已建模节点内未建模的属性/子元素/`extLst` 以 `OpaqueXml` 槽保留并带插入锚点；导出时干净部件 verbatim，只重生成脏部件 |
| 脏追踪器 | `DirtyTracker` | 模型路径前缀 ↔ Part 名映射；决定导出时哪些部件 verbatim、哪些重生成 |
| 场景 | `Scene` / `SceneNode` | 渲染引擎唯一认识的输入：`{ id, kind, bbox, transform, zIndex, children?, data }`；引擎对 `kind` 无知 |
| 场景提供者 | `SceneProvider` | 文档类型贡献（`render.scene`）：把 Unit 的某一页/视图构造成 `Scene`，并把 `ChangeSet` 映射为脏节点 |
| 渲染目标 | `RenderTarget` | 渲染引擎的输出介质（dom / svg / canvas），贡献点 `render.target` |
| 元素渲染器 | `ElementRenderer` | 按 `kind` 注册的渲染贡献（`render.element`） |
| 文本度量器 | `TextMeasurer` | `engine-layout` 的 Definition（`layout.measurer`）；Provider：`render-dom` 的 canvas 度量、`server-headless` 的字体解析度量 |
| 预设 | `Preset` | 一组插件 + 默认配置的组合，是「产品」的形状（`preset-slide`、`preset-slide-collab`、`preset-slide-viewer`） |
| 在场信息 | `Presence` / `Awareness` | 协作者光标、选区、当前页等非持久状态 |
| 同构类 | isomorphism class | 包的运行环境声明：`iso`（浏览器+Node，无 DOM 无 node 内建）/ `dom`（仅浏览器）/ `node`（仅 Node） |
| 层带 | band | 垂直束包的层位标签：`V-model`/`V-codec`/`V-render`/`V-ui`，各有可依赖的水平层上限（§5.1） |
| 夹具文档类型 | `fixture` | `model-core/testing` 提供的测试专用 `DocumentType`，用于验证文档类型盲 |

### 4.2 协同与服务端术语

| 术语 | 定义 |
|---|---|
| Room | 服务端为一份文档维护的协同会话集合与其 Y.Doc 副本（= 服务端 Unit） |
| Session | 一个客户端与一个 Room 的连接生命周期 |
| Ticket | 短时签名凭据，用于 WS 握手，携带角色与权限版本 |
| Update / StateVector | Yjs 的二进制增量 / 各 client 已知时钟向量 |
| Compaction | 用一个快照替换其前的 update 序列 |
| Repair | 服务端软门禁（schema/不变量修复）发出的补偿事务（origin=`repair`） |
| FracKey | fractional index 字符串，用于有序集合的并发插入/移动 |
| Version | 一次命名或自动快照，构成版本历史 |
| Soft Conflict（软冲突） | CRDT 收敛后语义上仍需提示用户的并发情形（如「你正在编辑的页被他人删除」） |

### 4.3 产品与质量术语

| 术语 | 定义 |
|---|---|
| Support Level（支持级） | pptx 特性支持矩阵的取值：`P` 仅保留 / `V~` 近似查看 / `V` 查看 / `E~` 有限编辑 / `E` 编辑 / `✗` 不支持 |
| Oracle / Corpus | 以 PowerPoint 真机导出为基线的视觉/结构对照 / 用于保真与回归测试的 pptx 语料库 |
| Integrator（集成方） | 把 SDK 嵌入自家产品的工程团队 |
| 角色 | `owner` / `editor` / `commenter` / `viewer`（权限模型的四个内置角色，能力位见 PRD CO 域） |

---

## 5. 架构基线

### 5.1 分层 × 文档类型 网格（核心图）与秩表

```
                     水平层（文档类型盲，可被任一垂直束复用）
 层号  层名          包（@oce/*，占位 scope）                                  同构类     秩
 ───── ───────────── ─────────────────────────────────────────────────────────── ───────── ──
 L0    基础          shared · kernel · protocol · i18n                            iso        0
 L1    文档内核      model-core · store-memory · store-yjs                        iso       10
 L3    格式基础      ooxml-core                                                   iso       30
 L4    协同          collab-core · collab-yjs · collab-transport-ws               iso       40
                     collab-offline-idb                                           dom       40
 L5    引擎          engine-layout · engine-render                                iso       50
                     render-dom                                                   dom       50
 LS    服务端        server-collab · server-storage · server-headless             node      58
 L7    UI 基座       design · ui-core · ui-react                                  dom       70
 L8    组装          preset-slide · preset-slide-collab · preset-slide-viewer     dom       80
                     apps/web (dom) · apps/server (node)

                     垂直束（每束横跨四个层带；束与束之间互不依赖）
                 ┌───────────────┬───────────────┬───────────────┐
 层带     上限   │  slide (M1-)  │  doc (M5)     │  sheet (M5)   │  同构类   秩
 V-model  ≤L1   │ model-slide   │ model-doc     │ model-sheet   │  iso     15
 V-codec  ≤L3   │ ooxml-pptx    │ ooxml-docx    │ ooxml-xlsx    │  iso     35
 V-render ≤L5   │ slide-render  │ doc-render    │ sheet-render  │  dom     55
                │ slide-render-chart (M3 起，可选) │              │  dom     55
 V-ui     ≤L7   │ slide-ui      │ doc-ui        │ sheet-ui      │  dom     75
                 └───────────────┴───────────────┴───────────────┘

 铁律 1（文档类型盲）：水平层的任何包 **不得** import 任何垂直束的包。
 铁律 2（束间隔离）：不同 bundle 的垂直束包互不 import（如 model-slide ✗→ model-doc）。
 铁律 3（只向下）：rank(import 目标) ≤ rank(自身)；垂直束同束内按层带向下（V-ui → V-render → V-codec → V-model）。
 铁律 4（同构类）：node 不得 import dom；iso 只能 import iso；dom 可 import iso/dom。
 说明：LS 秩 58 允许 server-* 依赖 L5 的 iso 包（engine-layout、engine-render 契约）；render-dom 由铁律 4 拦截。
```

### 5.2 包清单（v0.2，占位 scope `@oce`，见 §10 Q1）

> 架构-结构条线在 `02-layering-and-packages.md` 中把每个包细化到**目录级**；此处只定边界与职责，不得更名（除非经章程修订）。

| 包 | 层/层带 | 同构 | 职责边界 | 依赖上限 |
|---|---|---|---|---|
| `@oce/shared` | L0 | iso | 纯工具、品牌类型（`Emu`、`Pt`、`UnitId`、`SlideId`、`NodeId`…）、`Result` 类型、断言；**零依赖 cordis**；零领域知识 | — |
| `@oce/kernel` | L0 | iso | 唯一 import `cordis`；re-export `Context/Service/Plugin` 类型；`createHost`；`defineContributionPoint`/`ctx.contribute`/`ctx.contributions`；Manifest 类型与校验；`errors`/`telemetry` 服务与 logger 适配；`createIsolatedScope`（文档无关）；Disposable 与诊断工具 | shared |
| `@oce/protocol` | L0 | iso | 前后端共享契约：REST DTO、WS 消息、错误码、权限能力位；全部为 Standard Schema（zod 4）定义并导出推导类型；禁止 `enum` | shared |
| `@oce/i18n` | L0 | iso | 从 zh-CN 源文件反推**编译期 key 类型**；`ctx.i18n` 服务；`i18n.bundle` 贡献点 | kernel |
| `@oce/model-core` | L1 | iso | `Unit`/`UnitScope`/`units` 服务、`DocumentType` 贡献点、`DocumentStore` Definition 与 `StoreOp`、Command/Mutation/Operation + `commands` 服务（单一执行入口）、`history`、`Transaction`/`Origin`/`ChangeSet`、`Snapshot`/`SnapshotBundle` 编解码 + `schemaVersion` + `core.migration`、`ResourceHook`（`core.resource`）、`permissions`（fail-closed，`core.permissionPolicy`）、`core.format` 贡献点、通用 `Selection<A>` 类型、`drawing/`（DrawingML 共享绘图词汇的运行时类型与 schema，无 XML、无文档类型知识）、`testing/`（`fixture` 文档类型、conformance 套件） | kernel, shared, protocol |
| `@oce/store-memory` | L1 | iso | `DocumentStore` Provider：不可变结构共享快照，事务级撤销 | model-core |
| `@oce/store-yjs` | L1 | iso | `DocumentStore` Provider：Y.Doc 映射、`UndoManager`（按 origin）、update 编码；公共 API 不暴露 `Y.*` 类型 | model-core |
| `@oce/model-slide` | V-model | iso | Presentation/Master/Layout/Slide/Shape 树/TextBody/Theme 模型；幻灯片 Mutation 及其 `lower()`；样式继承链解析（纯函数）；`OpaqueXml`/`extensions` 槽；`validateChangeSet`/修复规则（服务端与客户端共用）；`testing/` | model-core |
| `@oce/ooxml-core` | L3 | iso | OPC（zip/`[Content_Types]`/rels）、命名空间感知 XML（自研最小保真 DOM）、Strict↔Transitional 归一化、DrawingML 编解码（类型来自 model-core/drawing）、`DirtyTracker` 与不透明保留引擎、`testing/`（`diffPackage` 与规范化器） | shared, model-core |
| `@oce/ooxml-pptx` | V-codec | iso | PresentationML ↔ model-slide 的 `FormatCodec`；占位符与继承；媒体部件 | ooxml-core, model-slide |
| `@oce/collab-core` | L4 | iso | Definition：`collab` 服务契约（session/room 状态机、awareness 模型、权限检查点、`OfflineStore` 接口）、`collabTransport` Definition | model-core, protocol |
| `@oce/collab-yjs` | L4 | iso | Provider：y-protocols 同步 + awareness，依赖 store-yjs 的 Y.Doc | collab-core, store-yjs |
| `@oce/collab-transport-ws` | L4 | iso | `collabTransport` Provider：WebSocket 传输、重连退避、Ticket 握手 | collab-core |
| `@oce/collab-offline-idb` | L4 | dom | `OfflineStore` Provider：IndexedDB 实现；唯一 import `y-indexeddb`（或自写适配） | collab-core |
| `@oce/engine-layout` | L5 | iso | `TextMeasurer` Definition（`layout.measurer`）、断行、字体回退、预设几何（OOXML prstGeom → path）、单位换算 | shared |
| `@oce/engine-render` | L5 | iso | 渲染契约与管线：`Scene`、`render.scene`/`render.target`/`render.element`/`render.overlay` 贡献点、视口/缩放、脏区与虚拟化、命中测试契约；**对幻灯片无知** | kernel, engine-layout |
| `@oce/render-dom` | L5 | dom | `RenderTarget` Provider：HTML/SVG 输出、图层、覆盖层宿主、IME 文本输入宿主、浏览器 canvas `TextMeasurer` Provider | engine-render, engine-layout |
| `@oce/slide-render` | V-render | dom | 幻灯片 `SceneProvider` 与元素渲染器（sp/pic/grpSp/cxnSp/graphicFrame: table/ole；图表 M1–M2 只读解析 `c:chart` 部件渲染）、母版/版式/页合成、缩略图 | model-slide, engine-render, render-dom |
| `@oce/slide-render-chart` | V-render | dom | M3 起从 slide-render 拆出的可选图表渲染/编辑插件，隔离图表库体积 | slide-render |
| `@oce/design` | L7 | dom | 设计 token（颜色/间距/字号/圆角/阴影/z-index/动效/密度，CSS 变量 `--oce-*`）+ 原子组件（纯 CSS 类 + 最小 TS）；**零依赖 SDK** | — |
| `@oce/ui-core` | L7 | dom | 框架无关的壳：`ui.*` 贡献点、输入管线 → 命令、视图模型；无 React；只允许 import `@oce/design` 的 `css/tokens.css` 与 type-only token 名 | kernel, model-core, design(仅 token) |
| `@oce/ui-react` | L7 | dom | React 19 绑定：把 ui-core 贡献渲染成组件；`<EditorHost>` | ui-core, design |
| `@oce/slide-ui` | V-ui | dom | 幻灯片专属 UI 贡献：插入/格式 ribbon 页签、缩略图侧栏、属性面板、放映模式 | slide-render, ui-react |
| `@oce/preset-slide` | L8 | dom | 单人 pptx 打开/编辑/导出的插件束 + 默认配置 | 上述 |
| `@oce/preset-slide-collab` | L8 | dom | preset-slide + 协同（store-yjs 替换 store-memory，加 collab-*） | 上述 |
| `@oce/preset-slide-viewer` | L8 | dom | 只读查看器：无编辑 UI、无 collab；体积预算见 PRD OF-14 | 上述 |
| `@oce/server-collab` | LS | node | cordis 插件（提供 `collabServer`）：房间、awareness 广播、update 持久化与 Compaction、软门禁修复、跨实例 pub/sub；与 Nest 解耦 | collab-core, store-yjs, protocol |
| `@oce/server-storage` | LS | node | `BlobStore` Definition 与 Provider（S3 兼容/本地）；唯一允许 import S3 SDK 的 server 包 | shared |
| `@oce/server-headless` | LS | node | Node 中的 cordis 宿主（`createHost`）：加载 iso 插件做导入/导出/校验/迁移；Node 字体 `TextMeasurer` Provider；缩略图（headless Chromium）适配 | kernel, model-*, ooxml-*, engine-layout |
| `apps/web` | L8 | dom | Vite + React 应用壳：登录、**开始页（新建/模板/最近/指南入口，PRD AS-01）**、文档列表、账户菜单（设置/快捷键/帮助/退出）、编辑器应用栏「⋯」更多菜单与账户头像（rulings §4.10 Q14/Q20，2026-09-18）、分享/权限入口、版本入口、编辑器路由、`/render` headless 渲染页；仅组装 preset | preset-* |
| `apps/server` | L8 | node | NestJS 11：Auth、Tenants&Users、Documents、Storage、CollabGateway、ImportExport、Snapshots、Thumbnails、Comments、Audit、Health 模块；pg/redis/s3 等 IO 适配器以 cordis 插件形式放在对应模块目录 | server-*, protocol |
| `tooling/*` | — | node | eslint-config、tsconfig、depcruise 规则、api-extractor 配置、扫描脚本、policy 矩阵校验器、changeset 配置 | — |

**`package.json#oce` 字段（规范）**：

```jsonc
"oce": {
  "layer": "L1",              // L0|L1|L3|L4|L5|L7|L8|LS|V-model|V-codec|V-render|V-ui
  "iso": "iso",               // iso|dom|node
  "bundle": "slide",          // slide|doc|sheet；当且仅当 layer 以 V- 开头时必填
  "stability": "beta"         // 可选：stable|beta|experimental（包级 API 稳定级，供 api-extractor 与 Changesets 分组）
}
```
schema 位于 `tooling/depcruise/oce-field.schema.json`；depcruise 与扫描器以此为唯一元数据来源。

### 5.3 依赖规则（由 dependency-cruiser + eslint `no-restricted-imports`/`no-restricted-globals` 强制）

1. **无环**：包级与文件级均不允许循环依赖。
2. **只向下**：`rank(to) ≤ rank(from)`，秩表见 §5.1（L0=0、L1=10、V-model=15、L3=30、V-codec=35、L4=40、L5=50、V-render=55、LS=58、L7=70、V-ui=75、L8=80）。
3. **文档类型盲**：水平层包不得 import 垂直束包。
4. **第三方库单点引入**：`cordis` 仅 `kernel`；`yjs`/`y-protocols` 仅 `store-yjs`/`collab-yjs`/`server-collab`；`lib0` 仅 `collab-yjs`/`server-collab`；`y-indexeddb` 仅 `collab-offline-idb`；`react`、`radix-ui`、`class-variance-authority`、`lucide-react`、`tailwindcss` 仅 `ui-react` 与 `*-ui`（shadcn 复制件所在）；`@nestjs/*` 仅 `apps/server`；`pg`/`ioredis`/S3 SDK 仅 `apps/server` 的适配器目录与 `server-storage`。
5. **同构隔离**：`iso` 包 tsconfig 不含 `dom` lib、禁止 `node:*`；`node` 不得 import `dom`；CI 以 `node --import` 冒烟每个 iso 包（Univer 教训 A20）。
6. **三角色**：Provider 之间互不 import；Consumer 只 import Definition。特例：`ui-core` 对 `@oce/design` 只允许 `css/tokens.css` 与 type-only 引用。
7. **无深引用**：跨包只能走 `exports` 显式子路径 `.` 与 `./testing`；`./testing` 只能被测试代码与其他包的 `testing/` 引用；禁止 `@oce/x/src/*`；禁止 `"./*"`/`"./lib/*"` 通配 exports（Univer 缺陷 D2）。
8. **束间隔离**：`oce.bundle` 不同的包互不 import。

### 5.4 每一级的「可插拔」如何体现（R2 验收口径）

| 层 | Definition（契约） | 默认 Provider | 可替换为 | 移除后系统能否启动 |
|---|---|---|---|---|
| 内核基础服务 | `errors`/`telemetry`/`logger` | 控制台实现 | Sentry/OTel 实现 | 是（降级为 no-op） |
| 存储 | `DocumentStore` | store-memory | store-yjs / 未来 store-loro | 否（必需，但任一 Provider 皆可） |
| 文档类型 | `core.documentType` 贡献点 | slide | doc / sheet / 第三方 | 是：打开未知类型以错误码 `format.no_document_type` 失败（错误码为点式，事件名为 `域/动作`，见 D11 与架构 10），宿主仍运行 |
| 格式 | `core.format` 贡献点 | ooxml-pptx | 其他格式、JSON | 是（无法打开文件） |
| 协同 | `collab` / `collabTransport` / `OfflineStore` | collab-yjs + ws + idb | webrtc 传输 / 其他 CRDT | 是（单人模式） |
| 渲染 | `render.target`/`render.element`/`render.scene` | render-dom + slide-render | canvas / 第三方元素 | 是（空白画布） |
| 度量 | `layout.measurer` | render-dom canvas 度量 | server-headless 字体度量 | 否（必需，任一 Provider） |
| UI | ui-core 贡献点 | ui-react | ui-vue（未来） | 是（headless） |
| 服务端 | Nest 模块 + `BlobStore` Provider | Postgres/Redis/S3 | 任意 S3/Kafka | 按模块 |

### 5.5 统一的服务名、事件名与贡献点 id

- **服务名**（`ctx.<name>`）：全局——`units`、`documentTypes`、`commands`、`formats`、`resources`、`migrations`、`permissions`、`collab`、`collabTransport`、`layout`、`ui`、`shortcuts`、`i18n`、`theme`、`errors`、`telemetry`、`logger`（cordis 内建）；UnitScope 内——`store`、`history`、`selection`、`render`、`presence`；服务端——`collabServer`、`blobStore`；垂直束——`slides`。
- **事件名**：`<域>/<动作>`，如 `unit/opened`、`command/executed`、`store/transaction`、`collab/synced`、`permission/changed`、`render/element-failed`、`slide/shape-added`。事件必须在 `Events` 接口中声明，否则扫描器报错。遥测事件另有登记表（PRD 06 / 架构 10）。
- **贡献点 id**（camelCase）：`core.documentType`、`core.format`（导出专用编解码器亦在此，`canImport:false`）、`core.command`（可执行定义）、`core.mutation`、`core.migration`、`core.resource`、`core.permissionPolicy`、`render.scene`、`render.target`、`render.element`、`render.overlay`、`layout.measurer`、`i18n.bundle`、`errors.sink`、`telemetry.sink`、`ui.ribbon`、`ui.toolbar`、`ui.panel`、`ui.contextMenu`、`ui.shortcut`、`ui.command`（命令的**呈现元数据**：title/icon/when/keybinding）、`ui.statusBar`、`ui.dialog`、`ui.notification`、`ui.theme`、`slide.shapeKind`。完整 schema 见架构 03 §3.6。协同传输与 Blob 存储**不是**贡献点，而是 `collabTransport`/`blobStore` 服务的 Provider 座。
- **契约套件命名**：`run<Definition>Conformance`（如 `runDocumentStoreConformance`、`runFormatCodecConformance`），由 Definition 所在包的 `./testing` 子路径导出。
- **第三方前缀规则**：第一方保留域为 `core`、`render`、`layout`、`ui`、`collab`、`format`、`unit`、`store`、`command`、`permission`、`i18n`、`perf`、`slide`、`doc`、`sheet`。第三方插件的事件名与贡献点 id 必须以其 npm scope（去 `@`）为前缀：事件 `<vendor>:<域>/<动作>`，贡献点 `<vendor>:<域>.<名>`；扫描器拒绝无前缀的非保留域。

---

## 6. 关键决策：已定 vs 待 ADR

### 6.1 已定（章程级，不再讨论）

| 决策 | 内容 | 依据 |
|---|---|---|
| D1 内核 | cordis 4（`cordis@4.0.0-rc.10`）锁版本，仅 kernel 引入；跟随 rc 升级由 kernel 吸收 | R2；API 尚在 rc，需隔离风险 |
| D2 配置与边界校验 | Standard Schema（zod 4）用于插件 Config、WS/REST DTO、编解码输出、Snapshot 载入；「parse, don't validate」；`z.infer` 为类型单一来源 | cordis 4 原生支持 Standard Schema；R7 |
| D3 注册抽象 | 全代码库只有一种注册：ContributionPoint；禁止自建 `register*`/全局 `Map` 注册表 | Univer 104 个 register* 教训 |
| D4 命令三分法 | Command / Mutation / Operation；Mutation 是唯一改 Store 的途径，只能在事务内产生；语义 Mutation 经 `lower()` 降级为 `StoreOp`；逆操作由 Store 推导，禁止手写；命令返回 `Result` 不返回 boolean | Univer 最正确的一项 + 缺陷 #3 |
| D5 事实源 | 运行时模型通过 `DocumentStore` 读写，协同模式下 CRDT 文档是唯一事实源；不存在第二份模型 | Univer Worker 双模型不一致教训 |
| D6 持久化边界 | Snapshot 与运行时模型有显式编解码；二进制以 `BlobRef` 引用；`schemaVersion` + 迁移注册表从 M1 起存在；派生字段标 `Derived<T>` 不入 Snapshot | Univer 决策 #10 |
| D7 保真策略 | 部件级 + **节点级**不透明保留、脏部件重生成；「未修改零丢失」是 M1 验收；口径：零编辑时字节相同；有编辑时未触碰部件字节相同、脏部件 XSD 有效、规范化 diff 限于编辑子树、派生部件白名单 | R6；PRD CS-01/CS-06 |
| D8 后端 | NestJS 11 作为传输壳；业务逻辑在 `server-*` 包；Nest 内嵌 cordis 宿主复用 iso 插件；pg/redis/s3 等 IO 适配器以 cordis 插件形式置于 `apps/server` 对应模块目录 | R4 |
| D9 monorepo 与工具链 | pnpm 10（corepack 锁定，lefthook 拒绝其他 lockfile）+ Turborepo；TS ≥ 5.9 最严格集 + `isolatedDeclarations`；库 `tsc -b` 未打包 ESM，apps Vite；Vitest（dom 包默认 happy-dom，布局/IME 用例走 browser mode）；Playwright；Changesets；ESLint（typescript-eslint 类型感知）+ Biome 格式化 | R7 |
| D10 UI 框架与组件库 | React 19（ui-core 无 React；框架在绑定层可换）；组件层**直接复用 shadcn/ui**（`radix-rhea` 风格，2026-09-16 起，原 `radix-nova`；rulings §4.8：Radix 语义与键盘行为、Lucide 图标、Geist 字体）以 CLI 复制进 `@oce/ui-react/src/components/ui/`，样式为 Tailwind 4 工具类；`@oce/design` 交付 shadcn 主题变量 + OCE 扩展变量；OCE 特有组合（Ribbon、缩略图栏、母版缩略图窗格、画布覆盖层、检查器）在 `ui-react/src/components/editor/`；设计 playground（`docs/20-design/playground/`）是 ui-react 的种子与设计稿的唯一基准 | Univer 同选型；用户要求复用成熟组件（2026-09-15）；见 Q2 |
| D11 观测性 | `errors`（类型化错误码，禁止裸 `throw new Error`）、`telemetry`、结构化 `logger` 为 L0 服务，从 M1 起接入；包内禁止 `console.*`；错误码/span/metric/遥测事件名通过声明合并登记并由扫描器校验 | Univer D 级项 |
| D12 权限 | fail-closed：无显式允许即拒绝；检查点在 `commands` 执行管线（含 Mutation 级）与服务端网关两处；服务端软门禁（schema/不变量修复）是数据完整性边界，与权限边界并列 | Univer C 级项 |
| D13 许可 | 全部依赖须为 MIT/Apache-2.0/BSD/ISC 兼容；AGPL 代码禁止引入 | 见 §1 |
| D14 分层编码 | 垂直束用层带 `V-*` 而非层号；`package.json#oce = { layer, iso, bundle? }` 为唯一分层元数据；秩表见 §5.1 | 结构线 C-1、类型治理 Q-T1 |
| D15 命名 | 贡献点 id 与服务名 camelCase；第三方前缀规则见 §5.5 | PRD CS-07、结构线 C-3 |
| D16 图表策略 | M1–M2：`c:chart` 部件不透明保留，渲染器只读解析部件与缓存数据以满足查看（SSIM ≥ 0.80）；M3 起数据模型与编辑（`slide-render-chart`） | PRD OF-09 与结构线 A-11 的合并 |

### 6.2 待 ADR

ADR 索引与状态以 `docs/30-architecture/adr/README.md` 为准（结构 0001–0019、运行时 0020–0039、类型治理 0040–0049）。章程只记录**默认倾向**，用户可否决：

| 议题 | 默认倾向 | ADR |
|---|---|---|
| CRDT 选型 | Yjs；有序集合用 FracKey；Loro 为已评估替代 | 0020、0032 |
| 渲染介质 | DOM/SVG 优先；缩略图/放映可走 canvas | 0021 |
| 服务端存储 | Postgres（元数据 + update 追加表 + Compaction）、Redis、S3 兼容 | 0022、0025 |
| 协同传输与协议 | WebSocket + y-protocols 帧；Ticket 握手；权限变更 ≤ 2 s 生效 | 0023、0029 |
| 声明合并策略 | kernel 桥接 `Events`/`Context`，插件只 `declare module '@oce/kernel'`；需 spike | 0001 |
| 版本策略 | L0–L1 lockstep；垂直束与 Provider 独立 semver；peer 加载期校验失配即 FAILED | 0002 |
| 插件清单 | 静态分析生成并入库，CI 无 diff，运行时比对 | 0003 |
| 类型预算 | `any`/`as`/`!`/`@ts-*` 计数预算只减不增 | 0040 |
| Strict 一致性类写回 | 脏部件写 Transitional、干净部件 verbatim、记录 `conformance`（产品倾向整包转 Transitional，见 Q14） | 0008 |

---

## 7. 里程碑骨架（产品条线细化验收标准）

```
 M0 蓝图 ──► M1 打开与保真 ──► M2 单人编辑 ──► M3 协同 ──► M4 插件 SDK 公开 ──► M5 多文档类型孵化
 (本阶段)    viewer+round-trip   命令/撤销/导出     Yjs+Nest      manifest/文档/示例    model-doc/sheet 骨架
```

| 里程碑 | 一句话验收 | 必含的「可插拔」证据 |
|---|---|---|
| M0 | PRD/设计/架构/类型治理文档通过评审；仓库目录骨架与全部门禁配置就位（无业务代码） | 规范↔执行矩阵 CI 校验通过 |
| M1 | 任意合法 pptx：打开 → 高保真只读渲染 → 未修改导出与原文件语义等价（D7 口径）；`preset-slide-viewer` 可用 | store-memory 与 render-dom 均可被 no-op Provider 替换后仍能启动 |
| M2 | 文本/形状/图片/幻灯片增删排序/属性编辑/撤销重做/导出；表格单元格文本编辑（P1）；基础放映（P1，无动画）；性能预算达标 | 第三方示例插件新增一种元素渲染与一个 ribbon 按钮，零改内核 |
| M3 | 多人实时协同、presence、权限、评论、离线重连；服务端导入/导出/快照；服务端缩略图（前半段）；表格结构编辑；图表数据编辑 | store-yjs 替换 store-memory 仅改 preset 配置 |
| M4 | 插件开发指南、manifest、示例仓库、版本协商、兼容性测试套件；动画播放（P2） | 外部团队按文档独立完成一个插件（≤ 2 人日） |
| M5 | `model-doc`/`model-sheet` 骨架通过「文档类型盲」验证：水平层零改动（文件哈希冻结） | dependency-cruiser 报告零横向依赖 |

---

## 8. 文档树（本阶段交付物，目录级）

```
docs/
├── README.md                         文档地图、阅读顺序、状态约定
├── 00-charter/                       共同输入（总编排负责）
│   ├── charter.md                    本文
│   ├── reference-univer-lessons.md   Univer 继承/规避清单 → 我们的机制 → 落实位置
│   ├── cordis-primer.md              cordis 4 API 摘要 + 本项目用法铁律
│   └── rulings-2026-09-14.md         对各条线异议/建议的逐条裁决记录（采纳/否决/待用户）
├── 10-prd/                           产品条线
│   ├── README.md                     PRD 总览、范围声明、待决事项、对章程的异议、术语补充
│   ├── 01-background-and-goals.md    背景、问题陈述、目标与非目标、成功指标
│   ├── 02-personas-and-scenarios.md  角色（编辑者/评审者/插件开发者/集成方/运维）、核心场景、用户故事
│   ├── 03-features/                  功能需求，每个域一文件（含用户故事、验收标准、优先级、里程碑）
│   │   ├── 01-open-and-fidelity.md   打开/渲染/保真/导出 + pptx 特性支持矩阵
│   │   ├── 02-editing.md             文本/形状/图片/表格/页管理/属性/撤销重做/快捷键
│   │   ├── 03-collaboration.md       实时协同/presence/评论/权限/离线/版本历史/软冲突表
│   │   ├── 04-plugin-sdk.md          面向插件开发者的产品需求（manifest、示例、文档、兼容）
│   │   ├── 05-embedding-and-integration.md  SDK 嵌入、鉴权对接、存储对接、事件回调
│   │   └── 06-server-and-ops.md      服务端能力、运维、审计、配额
│   ├── 04-non-functional-requirements.md 性能预算、保真指标、可用性、安全、可访问性、i18n、浏览器矩阵
│   ├── 05-milestones-and-scope.md    M0–M5 的范围、验收、依赖与风险
│   └── 06-metrics-and-analytics.md   北极星指标、埋点需求（对应 telemetry 服务）
├── 20-design/                        设计条线
│   ├── README.md                     设计原则、范围、待决事项、对章程的异议
│   ├── 01-information-architecture.md 编辑器 IA：区域划分、层级、导航模型、三种模式
│   ├── 02-user-flows.md              打开/编辑/协同/冲突/离线/导出/插件启用等关键流程
│   ├── 03-screens/                   每个页面/面板一文件（ASCII 线框 + 状态 + 交互说明）
│   ├── 04-design-system.md           token 体系（对应 @oce/design）、组件清单、主题/暗色、密度
│   ├── 05-collaboration-ux.md        presence、远端光标/选区、软冲突可视化、评论、版本历史、离线态
│   ├── 06-extensibility-ux.md        插件如何贡献 UI：ui.* 槽位规范与视觉约束
│   ├── 07-accessibility-and-i18n.md  键盘导航、屏幕阅读器、IME、RTL、文案规范
│   └── prototype/index.html          低保真可点击 HTML 原型（单文件，可发布为 artifact）
└── 30-architecture/                  架构条线（结构 / 运行时 / 类型治理三条子线）
    ├── README.md                     架构总览入口、原则、文档索引、待决事项、ADR 索引
    ├── 01-overview.md                C4 L1/L2、原则、端到端数据流
    ├── 02-layering-and-packages.md   分层网格、全部包**目录级**结构、依赖规则
    ├── 03-kernel-and-plugin-model.md kernel 封装、ContributionPoint、Manifest、UnitScope、生命周期、preset
    ├── 04-document-model.md          model-core 抽象、model-slide 模型、OOXML 映射、不透明保留、样式继承、迁移
    ├── 05-command-and-history.md     命令三分法、事务、降级、自动逆操作、权限检查点、审计
    ├── 06-collaboration.md           CRDT 映射、同步协议、presence、离线、权限即时性、软冲突语义
    ├── 07-rendering.md               渲染管线、Scene、RenderTarget/ElementRenderer、度量、命中测试、缩略图、性能预算
    ├── 08-backend-nestjs.md          Nest 模块图、cordis 宿主、存储、导入导出、网关、鉴权、部署拓扑
    ├── 09-type-discipline/           类型治理子线（README + 01 tsconfig / 02 lint / 03 boundaries / 04 api-surface / 05 runtime-boundaries / 06 scanners / 07 hooks-and-ci / 08 policy-enforcement-matrix / 09 plugin-type-contracts）
    ├── 10-observability-and-errors.md 错误码体系、日志、遥测、诊断
    ├── 11-testing-strategy.md        单测/契约测试/同构冒烟/视觉 oracle/协同模拟/插件兼容套件
    ├── 12-extension-to-doc-and-sheet.md 文档类型盲验证方案、model-doc/sheet 骨架
    └── adr/                          ADR-0001…（结构 0001-0019、运行时 0020-0039、类型治理 0040-0049）+ README 索引
```

---

## 9. 条线分工与写作规范

### 9.1 分工

| 条线 | agent 角色 | 产出目录 | 不得触碰 |
|---|---|---|---|
| 产品 | 资深产品经理（SDK/协同编辑领域） | `docs/10-prd/` | 其他目录 |
| 设计 | UI/UX 设计师（编辑器与设计系统） | `docs/20-design/` | 其他目录 |
| 架构-结构 | 架构师 A（结构） | `30-architecture/{README,01,02,03,04,05,12}.md`、`adr/0001-0019`、`adr/README.md` | 09 子目录、06/07/08/10/11 |
| 架构-运行时 | 架构师 B（运行时） | `30-architecture/{06,07,08,10,11}.md`、`adr/0020-0039` | 09 子目录、A 的文件 |
| 架构-类型治理 | TypeScript 治理专家 | `30-architecture/09-type-discipline/*`、`adr/0040-0049` | 其他文件 |
| 总编排 | Orchestrator | `00-charter/*`、`docs/README.md`、`adr/README.md` 合并、跨线裁决 | 各条线正文（只做一致性修订） |

### 9.2 写作规范（全部条线）

1. **语言**：中文正文，英文标识符/包名/文件名；文件名 kebab-case，带两位序号。
2. **状态头**：每个 md 的首行或标题后第一行为引用块：`> 状态：草稿 | 负责：<条线> | 更新：2026-09-14 | 依赖：charter v0.x`。
3. **目录级细化**：凡涉及代码结构，给出目录树，**每个目录/文件一行说明其内容与职责**；不写实现代码，接口/类型可给「签名级草案」并标注「草案」。
4. **图**：优先 ASCII（终端可读）；复杂状态机/时序可附 mermaid。
5. **术语**：只用 §4 词表；新术语在本条线 README 的「术语补充」中定义，经裁决后回写 §4。
6. **决策纪律**：与章程冲突不得擅改，写入 README「对章程的异议/建议」；未决事项写入 README「待决事项」并标注需要谁决策。
7. **可验收**：需求写验收标准（Given/When/Then 或可度量指标）；架构写「如何被机械验证」；设计写「状态与边界情况」。
8. **引用**：引用外部库/论文写出名称与版本/日期；引用 Univer 教训时写编号（见 lessons 文档）。
9. **不越界**：不修改其他条线目录；不创建 `docs/` 之外的文件（仓库代码骨架在 M0 后半段另行创建）。

---

## 10. 待用户决策（agent 按默认值推进，用户可随时否决）

| # | 问题 | 当前默认 | 影响 |
|---|---|---|---|
| Q1 | 项目代号与 npm scope | 占位 `@oce`（Office Collaborative Editor） | 全部包名 |
| Q2 | UI 框架 | React 19 | ui-react / *-ui 包 |
| Q3 | CRDT | Yjs（Loro 备选） | store-yjs / collab-yjs / server-collab |
| Q4 | 渲染介质 | DOM/SVG 优先 | render-dom / slide-render |
| Q5 | 规模目标 | 单文档 ≤ 200 页、≤ 20 并发编辑者、≤ 50 只读查看者/文档、单页元素 ≤ 1,000、单文件 ≤ 200 MB（含媒体） | 性能预算与存储设计 |
| Q6 | 鉴权/租户 | OIDC 对接 + 多租户元数据隔离 | apps/server Auth 模块 |
| Q7 | 保真范围 | 动画/切换/SmartArt/OLE 在 M1–M3 仅「保留不编辑」；图表 M1–M2 只读解析查看、M3 起可编辑数据 | PRD 03-features |
| Q8 | 服务端缩略图 | M3 前半段起用 headless Chromium；M1/M2 由客户端生成 | server-headless |
| Q9 | 包管理器 | pnpm 10（corepack 锁定；用户全局 `packageManager` 指向 yarn，需确认无冲突） | 工具链 |
| Q10 | 部署形态 | 单体 Nest + Postgres + Redis + MinIO 的 docker-compose；K8s 为后续 | 运维需求 |
| Q11 | M4 外部试点团队来源 | 待定 | M4 验收「外部团队 ≤ 2 人日完成一个插件」 |
| Q12 | 仓库自身许可证 | 建议 Apache-2.0（SDK 场景的专利授权） | 第三方插件生态、依赖审查基线 |
| Q13 | 里程碑周期 | 建议 M1–M5 = 8 / 10 / 12 / 6 / 6 周 | 排期 |
| Q14 | Strict 一致性类文件有编辑时的导出 | 架构推荐「方案 C：保持原一致性类（反向映射写回 Strict）」为目标，「方案 B：整包转 Transitional」为自动回退；产品原倾向 B。两案均满足「未修改零丢失」的两条硬要求，C 额外保住未触碰部件字节相同 | 保真承诺表述、PRD OF 域、ADR-0008 |
| Q15 | 加密 pptx、`.pptm` 宏、数字签名文件 | M1–M4 拒绝加密文件；宏原样保留不执行；签名文件编辑后提示签名失效 | 安全/合规 |
| Q16 | 排他编辑锁（形状级/页级） | 不做，只有 awareness 软提示 | 协同 UX |
| Q17 | 版本与数据保留 | 自动快照每 10 min 或 500 updates、保留 30 天；命名快照永久；update 追加表 7 天；导入原件 30 天 | 存储成本、合规 |
| Q18 | 图表 M3 可编辑范围 | bar/line/pie 三类，其余仅查看 | slide-render-chart |
| Q19 | 服务端字体包与许可 | Noto + Liberation + Carlito/Caladea；不内置 CJK 商业字体 | 服务端渲染保真、法务 |
| Q20 | 移动端范围与 a11y 目标 | 桌面优先；平板只读评审；M2 a11y 必达「键盘可达 + 基本朗读」，WCAG 2.2 AA 分阶段 | 设计/PRD NF |
