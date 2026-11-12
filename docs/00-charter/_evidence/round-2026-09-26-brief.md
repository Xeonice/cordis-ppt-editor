# 本轮裁决简报（rulings §4.21 草案输入，2026-09-26）

> 这是所有写作 agent 的唯一口径来源。旧文档内容与本简报冲突的，一律按本简报改写；本简报没写到的细节，按三份证据文件中对应的条目执行：
> - R = docs/00-charter/_evidence/reuse-arch-elements-plan-2026-09-26.json（复用、架构分层、能力与元素；questions / defaults，下文记作 R-d-NN / docPlan / frontendReuse / backendReuse / elementDesign / capabilities / architecture / revisionLog）
> - H = docs/00-charter/_evidence/hocuspocus-adoption-2026-09-26.json（Hocuspocus 采用；questions / defaults，下文记作 H-d-NN / docPlan / adr 草稿 / map / ver）
> - X = docs/00-charter/_evidence/xml-parser-research-2026-09-26.json（XML 解析；requirements / benchmark / verification / recommendation.docChanges）

## 0. 用户本轮诉求（原话）

1. 「对于前端部分，后端部分，理论上有能够复用的组件，应该尽可能用可复用成熟组件」
2. 「对于架构，我理解应该是一份总架构，接下来是前端架构和后端架构」
3. 「还是前端部分，没有说清楚编辑器的每个能力，前端计划怎么实现，尤其是追加元素的部分，至少要满足需要追加什么东西，有什么作用，每个元素应该怎么设计」

## 1. 用户裁决（23 题，2026-09-26 交互确认）

| # | 议题 | 裁决 |
|---|---|---|
| q-arch-reorg | 架构重组方式 | 方案 B：30 只留总架构，50/01、60/01 就地升格为前端架构、后端架构（推荐） |
| q-license-tiers | 许可白名单分级 | 分级附表：宽松类视同放行，OFL 限字体、CC0 限数据与内置源码、MPL-2.0 限未修改依赖（推荐） |
| q-table-depth | 表格编辑深度 | M2 可插入并改单元格文字，结构与样式 M3；M3 前把表格改为 Record + FracKey 归一化模型（推荐） |
| q-chart-route | 图表渲染路线 | d3-scale / d3-shape / d3-array（ISC）做底层，按 OOXML 语义自研布局（推荐） |
| q-db-access | DB 访问层 | drizzle-orm 0.45.x + 手写 schema，漂移检查改为直查 pg_catalog（含分区父表）（推荐） |
| q-ws-gateway | 协同 WS 接入 | 改用 Hocuspocus 4 作 Room 框架（用户选择，非推荐项；原推荐为自挂 upgrade + ws noServer、Room 维持 ADR-0023 自研） |
| q-xml-lexer | XML 解析器 | 自研词法与保真树（推荐；经专项实测调研后裁决，见 X 组） |
| q-nest-major | Nest 主版本 | M1 直接上 Nest 12（用户选择，非推荐项；原推荐 M1 锁 11.2.x） |
| q-media-insert | 音视频插入 | 插入维持 P2，插入时不写 p:timing，导出后靠 PowerPoint 媒体控件点播（推荐） |
| q-smartart | SmartArt 深度 | M4+ 先做「转换为形状」（一次性物化为组合），节点文字编辑之后再评估（推荐） |
| q-equation | 公式路线 | M4+ 立项：基于自有 XML 树自研 OMML↔MathML，MathJax 4 输出 SVG 惰性渲染（推荐） |
| q-frackey | 分数索引算法 | 内置 rocicorp 算法源码（CC0，注明出处），改写 ADR-0032 决策 2 的键格式（推荐） |
| q-webhook-sig | Webhook 签名 | 改为 Standard Webhooks（webhook-id、webhook-timestamp、webhook-signature: v1,base64），用 node:crypto 实现（推荐） |
| q-extra-inserts | PRD 外插入项 | 图标与符号进 M3 P2，截图与相册 M4+ P2，录屏不做（推荐） |
| H:q-hp-persist-ack | 持久化与确认 | 逐帧落库+两级ack（推荐） |
| H:q-hp-fanout | 多实例扇出 | Redis扩展+文档哈希（推荐） |
| H:q-hp-provider | 客户端 provider | 用官方provider（推荐） |
| H:q-hp-server-tx | 服务端事务顺序 | 低频先落库，修复先广播（推荐） |
| H:q-hp-awareness-tick | 满员在场合并 | 包装出站合并（推荐） |
| H:q-hp-step2-cap | 长离线差量上限 | step2单设16MiB（推荐） |
| X:q-xml-lexer | XML 解析器 | 自研词法与保真树（推荐）。ooxml-core 运行时不引任何 XML 依赖。提供两个入口：scan（不建树，负责计数与限额）和 parseDocument（建整树），都支持 write/end 与按时间片让出。saxes 6.0.0 与 libxml2-wasm 只作 devDependency 差分 oracle，输入要限深、限长。@rgrove/parse-xml 5 作退路。工作量约 20 人日 ±30%，须接入 W3C XML Conformance 的 not-wf/wf 与 Namespaces 子集 |
| X:q-content-types | [Content_Types].xml 与 .rels 零编辑写回 | 结构不变就原样写回（推荐）。关系与内容类型集合都没变时写回原字节，变了才由 PartTable 重生成；序列化器只需 c14n 等价，不必逐字节复现。改 ADR-0008 决策 5、30/02:683、30/04:717（§5.3）、40/04:165，与 30/04 §5.4、70/03 统一 |
| X:q-xml-package | 解析器归属 | 抽出独立 iso 包 `@cordexjs/xml`（推荐）：L0 · 秩 0 · iso · library，零运行时依赖（不依赖任何包，shared 也不依赖）。ooxml-core 的依赖上限由「shared, model-core」改为「shared, xml, model-core」。apps/server 的媒体模块（SVG 消毒）可以依赖 `@cordexjs/xml`，server-app-thin 规则白名单加这一项。词法器、保真树、序列化、XmlLimits 以及合规与差分测试都放在这个包里；ooxml-core 保留 OOXML 专属层：OPC、namespaces（Strict↔Transitional 48 对）、normalize、mce、c14n（测试用） |

## 2. 关键口径（写作时必须一致）

- **架构三件套**
  - 分工：30-architecture/01 是总架构，全仓唯一一份，跨端。50-frontend/01 就地升格为前端架构：改标题，现有节号不动，新节用 §1a、§4a、§5a、§5b 插入。60-backend/01 同法升格为后端架构，新节用 §0、§1a。阅读路径固定为 30/01 → 50/01 → 60/01。
  - 30/08 撤销：内容迁到 30/01 §3 与 60/01 §0，其余引用改指 60/xx。改引用和删文件由后续 Remap 阶段统一做，写作阶段不要删 30/08，也不要改别人文件里的 30/08 引用。
  - 30/07：缩为「渲染跨端契约」，§3–§4 迁到 50/01 §4a，§4.2 元素渲染器表迁到 50/19。迁移时由接收方从原文件拷贝改写，删除方只删原文并留一行桩链接。
  - M1–M4 里程碑边界表只在 30/01 保留一份。文档站分区改名为「总架构 / 前端架构与设计 / 后端架构与设计」。（R-d-01…R-d-09）
- **新文档编号**：平铺，不建子目录。
  - 前端：50/17 前端复用组件清单；50/18 编辑器能力实现总表；50/19 可追加元素目录·总览与通用设计；50/20 文本类；50/21 结构类；50/22 形状与线条；50/23 媒体类；50/24 表格与图表；50/25 只读与不透明类。
  - 后端：60/19 后端复用组件清单。
- **新 ADR 编号**
  - 0018：可追加元素的模型补全与插入命令族，含表格归一化。
  - 0019：XML 词法与保真树，A-2 定案，含 XmlLimits 表与 @cordexjs/xml。
  - 0036：图表渲染与编辑路线，d3-scale / d3-shape / d3-array + 自研 OOXML 布局。
  - 0039：协同服务端采用 Hocuspocus 4，部分取代 ADR-0023，吸收 WS 接入；以 H 的 adr 草稿为底稿。
  - 0049：依赖准入与许可分级。
  - 原复用计划拟用 0039 写的三项另行落地：B1 DB 访问层与 B2 Fastify 写进 ADR-0022 修订；Nest 12 写进章程 D8 与 ADR-0030 修订（OTel 启动方式）。
- **许可分级**（ADR-0049，同时改写章程 D13 口径）
  - 视同放行：宽松类许可，包括 MIT、Apache-2.0、BSD-2/3、ISC、0BSD、BlueOak-1.0.0、MIT-0、Zlib、Python-2.0 等。
  - 限定用途：OFL-1.1 只用于字体资产；CC0-1.0 只用于数据文件和内置源码（例如内置 rocicorp fractional-indexing 算法，须注明出处）；MPL-2.0 只允许不修改的依赖（axe-core、mtx-decompressor 可用）。
  - 仍然禁止：LGPL、GPL、AGPL、SSPL、BUSL、Unlicense，以及更强的 copyleft。
  - 例外：@sesamecare-oss/redlock 1.4.0 的 package.json 标 UNLICENSED，但 LICENSE.md 是 MIT，按附证据的例外登记。
- **Nest 12**（用户选择）
  - 版本：@nestjs/* 统一用 12.x，包括 core/common/platform-fastify 12.1.0、testing 12.1.0、config 12.0.x、schedule 12.0.x、bullmq 12.0.0、terminus 12.1.x。nestjs-pino 5.2.x 已支持 12。nestjs-zod 不支持 12，但本来就不用，OpenAPI 由 zod-openapi 在构建期生成。
  - 构建：Nest 12 是纯 ESM，apps/server 构建改为 ESM。
  - 观测：OTel 改为用 `node --import` 预加载注册。@opentelemetry/instrumentation-nestjs-core 0.68 不支持 12，Nest 层 span 暂由 @fastify/otel 加手工 span 补齐，待上游支持后再启用。
  - 同步修改：章程 D8、R4、§5.2，30/09-type-discipline/01，ADR-0030，60/01、60/17、60/18。
- **DB 访问层**：drizzle-orm 0.45.x + 手写 schema/*.ts。漂移检查改为直查 pg_catalog（含 relkind 'p' 的分区父表），不用 drizzle-kit pull。Drizzle 1.0 的破坏性变更须在 M2 前评估。HTTP 适配器用 Fastify 5。
- **Webhook 签名**：采用 Standard Webhooks，头为 webhook-id / webhook-timestamp / webhook-signature: v1,<base64>，多个签名空格分隔，天然支持密钥轮换。用 node:crypto 实现（约 15 行），不引 standardwebhooks 包。旧头 X-Cordex-Signature 废止，登记进 terms.json。
- **协同**：Hocuspocus 4.7.0，精确钉版本。按 H 的 summary、defaults H-d-01…H-d-32 和 adr 草稿执行。
  - 持久化与确认：逐帧落库，beforeSync 先落库取 seq；两级 ack 经 Stateless ack{tier,seq} 下发。
  - 多实例：M3 装 extension-redis，反代按 documentId 一致性哈希。§4.15 Q10 的「无粘性」改写为「按文档哈希偏好亲和、非会话粘性」。
  - 客户端：用官方 @hocuspocus/provider，加自有调度器与 FIFO 胶水。
  - 服务端事务：版本恢复、彻底删除、墓碑清扫在复制文档上先落库再应用；软门禁修复先广播。
  - 满员 awareness：包装 Connection.send，只合并 awareness 帧。
  - 长离线：step2 单设 16 MiB 上限，update 仍 ≤1 MiB，超限返回 4413 后导出重载；§4.18 CO-10「先切块」改写。
  - 拒绝语义：连接污染规则（H-d-09）。文档名用 docId:epoch（H-d-14）。
  - 自研项调整：原复用默认 R-d-38 中「FanoutBus 自研」改为 M3 由 extension-redis 承担，其余自研项保留。
  - ioredis 版本：extension-redis 自带 ioredis ~5.6.1。写作时以 H 证据和 scratchpad/hocuspocus/src 源码为准，核实能否注入外部 ioredis 实例；能注入就统一用 6.0.x，不能就允许两版并存，并在 60/19 与许可 / 单版本规则里登记例外。
- **表格**
  - 里程碑：M2 可插入表格并编辑单元格文字；行列插删、合并拆分和样式放 M3。
  - 模型：M3 前改为归一化结构：`columns: Record<ColId,{order: FracKey, width}>`、`rows: Record<RowId,{order: FracKey, height}>`、`cells: Record<"RowId:ColId", TableCell>`。合并在锚格上记 gridSpan/rowSpan，被合并格加标记；导出时按 order 排序重建 a:tbl。
  - 校验：不变量 I-TBL1（每行的有效格覆盖全部列）与 I-TBL2（跨度合法）作兜底。
  - 落点：写入 ADR-0018，并同步 30/04、40/03 与 30/06 的 Yjs 映射。
- **图表**
  - 渲染：d3-scale / d3-shape / d3-array（ISC，约 30 KB）加自研 OOXML 布局，覆盖 manualLayout、Excel 自动刻度、堆积和饼图标签避让。
  - 里程碑：M1 只读渲染（SSIM ≥ 0.80）；M3 五类编辑，数据网格用 @tanstack/react-table 9 + shadcn Table，内嵌 xlsx 用自研最小写出器加 numfmt。图表插入定在 M3，删掉设计 04 的「M1/M2 可插入静态图表」。
  - 落点：ADR-0036。
- **分数索引**：内置 rocicorp fractional-indexing 的算法源码（CC0，注明出处），改写 ADR-0032 决策 2 的键格式：整数头 + 随机后缀，后缀避开以 '0' 结尾。
- **元素范围**
  - 音视频：插入维持 P2，插入时不写 p:timing。
  - 图标与符号：M3 P2；图标用 lucide-static（ISC），符号用自建 Unicode 表。
  - 屏幕截图与相册：M4+ P2；录屏不做。
  - SmartArt：M4+ 先做「转换为形状」。
  - 公式：M4+ 基于 @cordexjs/xml 的树自研 OMML↔MathML，渲染用 MathJax 4 输出 SVG、惰性加载（字体数据许可待核）。
  - 非目标：SmartArt、OLE、3D、墨迹、缩放定位、录屏都不提供插入；自定义几何的顶点编辑也是非目标（R-d-75）。
- **XML 口径**
  - 保真：门禁是脏部件 c14n 等价，逐字节一致只靠 verbatim。实体原文、引号风格、<a/> 写法、属性顺序、注释和 PI 都是期望项。
  - 安全与限额：DOCTYPE 一律拒绝，错误码沿用 60/06 现行的 format.limit_exceeded 口径，具体 limit 键由 ADR-0019 定。深度、属性数、文本长度、属性值长度都在词法层计数，超限返回 format.limit_exceeded{limit, actual}；全部走 Result。
  - 编码：输入是字节，按 BOM 与 encoding 声明嗅探 UTF-8/UTF-16；TextDecoder(fatal) 的错误映射到登记码。
  - 限额单一来源：XML 限额只在 ADR-0019 的 XmlLimits 表里定义一次。PRD 01:612、50/14:446、60/06:357/366、60/17:469、70/10:102–104 都改为引用这张表，不再各自重述数值。
  - 错误码登记：30/10 的错误码目录登记 format.malformed_xml。
- **前端复用默认**：按 R-d-10…R-d-35、R-d-61…R-d-78 执行。
  - 采用的库：react-colorful（pnpm patch 改为静态 CSS）、colord/culori、@tanstack/react-virtual、pragmatic-drag-and-drop、react-hook-form + standardSchemaResolver、htmlparser2（惰性加载）、comlink、p-queue、emf-converter 4.x、idb 自写适配、UCD 断行表生成、harfbuzzjs + bidi-js（M4/M5）。
  - 维持自研：选择手柄、吸附、缩放平移、裁剪、连接符、快捷键；文本宿主维持 ADR-0028，EditContext 作第三实现进 spike。
  - **凡是「维持自研」的，必须写明为什么没有合适的成熟库**（用户要求尽可能复用）。
- **后端复用默认**：按 R-d-36…R-d-60 执行，冲突项按上面的 Nest 12、Hocuspocus、Webhook 口径修正：R-d-47 的 nestjs-core instrumentation 改为暂不可用；R-d-60 的 require(esm) 口径随 ESM 构建改写。

## 3. 写作规则（每个 agent 必须遵守）

1. **文件归属**：只改分配给你的文件。需要别的文件配合的，写进返回值的 handoff 列表，不要自己改。只新建分配给你的文件。除 P 组外不改 playground。
2. **文档风格**
   - 全部用中文，沿用该文件现有的结构、编号与术语。
   - 状态头 `> 状态：… | 更新：…` 追加一项 `2026-09-26（§4.21：<改了什么，短句>）`，不改其它历史项。
   - 新建文档照同目录已有文档的头部格式（状态、负责、更新、依赖），依赖行写真实的上游路径与章节。
3. **引用**
   - 链接用相对路径。带目录前缀的章节引用写成「50/19 §3」「60-backend/05 §2」这类格式，目标章节必须存在；新文档之间互相引用时，章节号要与你写出的标题一致。
   - 引用其它 agent 正在新建的文档时，只链接到文件，不带 #锚点、不带 §，避免失配。
   - 改完跑 `python3 docs/_tools/check-links.py <你改的文件>`，要求 0 失配。
4. **图**：多画 Mermaid（用户要求图要多）。
   - 类型只用 flowchart / stateDiagram-v2 / sequenceDiagram / classDiagram / erDiagram。
   - 引号：flowchart、class、ER、state 的节点标签加引号；sequenceDiagram 的参与者别名与 stateDiagram 的迁移标签不加引号。
   - 规模与禁用：单图 ≤40 行、≤25 个节点；不用 click/style/classDef/init。
   - 图名与说明：每张图上一行写加粗图名，下面一段以「怎么读：」开头。
   - 校验：改完跑 `PLAYWRIGHT_MODULE=/private/tmp/claude-501/-Users-douglasdong-orca-projects-cordis-ppt-editor/99c8e3a1-9bed-4d05-993f-0eb38ac410f4/scratchpad/node_modules/playwright node docs/_tools/mermaid-check.cjs <你改的文件>`，要求 0 invalid。
5. **术语**：更名（标识符、事件名、头名、包名等）写进返回值 renames（旧名 → 正名 → 出处），由总编排登记进 terms.json。改完跑 `python3 docs/_tools/check-terms.py <你改的文件>`。
6. **长文分段落盘**：新建或大段改写时，先 Write ≤120 行，之后每次 Edit 追加 ≤120 行，避免单次长输出被判停。
7. **前台同步**：禁止后台命令、Monitor、等待通知。不提交 git。
8. **不硬编码、不编造**：版本号、许可证以证据文件或 `npm view` 核实为准；PRD 编号、设计稿编号、命令 id 沿用现有文档，新增的写明「新增（§4.21）」。
9. **40-modules/01–13 的结构**：改动后跑 `python3 docs/_tools/validate-module.py <文件>`，保持通过（§0…§13 齐全、§4 文件数 = §5 行数）。
10. **60-backend 的 SQL 围栏**：改了就在返回值 notes 里注明，Check 阶段统一跑 ddl-check。
