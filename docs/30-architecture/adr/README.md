# ADR 索引

> 状态：草稿 | 负责：总编排（合并自三条架构子线） | 更新：2026-09-24（rulings §4.15 章程 §10 Q1–Q10 裁决回写：0020/0021/0022/0026/0029/0035 转已接受，新增 0037）；2026-09-24 复核修正（rulings §4.17：0013/0017/0020/0022/0025/0026/0029/0031/0034/0035/0037 按复核报告机械修正清单与 D1–D5 回写）；2026-09-25（矛盾收口，rulings §4.18：0002–0010/0011–0017/0020–0023/0025–0027/0029/0030/0032–0035/0037 按 15 项决策、23 项默认值与机械修正回写，已接受 ADR 以「2026-09-25 修订（rulings §4.18 <id>）」就地注记并保留「原：…作废」）；2026-09-25（§4.19：0020/0023/0025/0026/0029/0030/0031/0033/0034/0035/0037 按三条设计线收口与 D-M2-CONTENT、INC-09、C-06、D-COMMENTS-PKG 回写，已接受 ADR 以「修订 2026-09-25（§4.19）」追加记录）；2026-09-26（§4.20）（TX-01+BE-10：预留的 0038 登记为 version-restore-undo（提议）并建骨架；0004/0005/0017/0020/0034/0037/0040/0046 按遗留小项收口回写：FE-01、FE-03/FE-04、FE-18+TX-06、TX-11、TX-13、BE-11+TX-12）；2026-09-26（§4.21：登记 0018 editor-element-model-and-insert-commands、0019 xml-lexer-and-fidelity-tree、0036 chart-rendering-and-editing、0039 collab-server-hocuspocus、0049 dependency-admission-and-license-tiers；0023 标「部分被 0039 取代」；0008/0017/0021/0022/0024/0025/0027/0028/0029/0030/0032/0033/0034/0035 标 2026-09-26 修订；新增图 1）；2026-09-26（§4.21 整合：0008 行补决策 8、9 (b)(d)(e)、10 修订要点；0021 行补 URL 转码与公式 MathJax SVG；0036、0049 标已接受）；2026-09-26（§4.21 复核：0039 转已接受；0035 描述改为默认文档哈希偏好亲和） | 依赖：charter v0.2
> 编号分配（章程 §8）：0001–0019 结构线；0020–0039 运行时线；0040–0049 类型治理线。M0 阶段 ADR 默认为**提议**状态，进入 M1 前经评审转为「已接受」；已由用户裁决的在下表「章程关联」列标「已接受」及依据（0017：rulings §4.7；0020/0021/0022/0026/0029/0035/0037：rulings §4.15；0019/0036/0039/0049：rulings §4.21）；§4.21 新增的其余 ADR 以用户裁决为起草基线，状态以各 ADR 文件为准；跨线分歧的裁决见 `docs/00-charter/rulings-2026-09-14.md`。

## 模板

每份 ADR 依次包含：**状态**（提议 / 已接受 / 已否决 / 已替代）、**背景**、**决策**、**备选方案与放弃原因**、**后果（正 / 负）**、**如何被机械验证**、**关联**（章程条目、Univer K/A 编号、相关文档）。

## 2026-09-26 新增与修订一览（rulings §4.21）

本轮新增 5 份 ADR，并修订 15 份既有 ADR（其中 0023 部分被 0039 取代）；各行的修订要点写在下方三张索引表的标题列末尾。

**图 1 §4.21 新增 ADR 与被修订 ADR 的关系**

```mermaid
flowchart LR
  a18["0018 可追加元素模型与插入命令"]
  a19["0019 XML 词法与保真树"]
  a36["0036 图表渲染与编辑"]
  a39["0039 协同服务端采用 Hocuspocus 4"]
  a49["0049 依赖准入与许可分级"]
  a23["0023 传输与协议"]
  hooks["0024、0025、0029、0033、0034、0035：挂点按 Hocuspocus 钩子改写"]
  a32["0032 FracKey 键格式"]
  a08["0008 不透明保留：关系部件写回"]
  a21["0021 渲染介质：canvas 预处理用途"]
  a17["0017 UI 单点表补登"]
  d13["章程 D13 许可口径"]
  ops["0022 DB 访问层与 Fastify、0030 观测随 Nest 12"]
  txt["0027 断行表、0028 EditContext spike"]
  a39 -->|"部分取代"| a23
  a39 -->|"改写挂点"| hooks
  a18 -->|"表格行列 order 用 FracKey"| a32
  a18 -->|"音视频插入不写 p:timing"| a08
  a19 -->|"决策 5 结构不变原样写回"| a08
  a36 -->|"只读渲染走 DOM/SVG"| a21
  a49 -->|"取代原口径"| d13
  a49 -->|"准入四处同步"| a17
  a49 -.->|"复用裁决的其余落点"| ops
  a49 -.->|"复用裁决的其余落点"| txt
```

怎么读：左侧五个节点是本轮新增的 ADR，箭头指向它们修订或取代的既有 ADR 与章程条目，边上的字是修订内容；虚线表示同一轮复用裁决（R-d 默认值）顺带修订的 ADR，与 0049 没有条文上的依赖。
依据：rulings §4.21 裁决表与「被修订的既有裁决与 ADR」表。

## 结构线（0001–0019）

| 编号 | 标题 | 章程关联 |
|---|---|---|
| [0001](./0001-declaration-merging-bridge.md) | 声明合并桥接：插件只 `declare module '@cordexjs/kernel'`（含 spike 矩阵 S1–S8 与退路） | §6.2、primer §5.2 |
| [0002](./0002-versioning-strategy.md) | 版本策略：L0–L1 lockstep + 插件独立 semver + `peerDependencies` 加载期校验（失配即 FAILED）；内部依赖 `workspace:` 协议（peer `workspace:^`、其余 `workspace:*`） | §6.2、Q1 |
| [0003](./0003-manifest-generation.md) | Manifest：静态分析生成、入库、CI 与运行时三方一致性 | §6.2、A9 |
| [0004](./0004-monorepo-and-build-toolchain.md) | monorepo 与构建工具链：pnpm 11 双锁 + Turborepo；Node 26；lockfile-guard；库 `tsc -b`；apps Vite；Changesets | D9、Q9（包管理器/Node 已裁，rulings §4.15） |
| [0005](./0005-unit-scope-via-isolate.md) | UnitScope 的实现：Unit = 插件 Fiber + `createIsolatedScope` 服务集 | §4、K2、裁决 C-4 |
| [0006](./0006-contribution-point-as-sole-registry.md) | ContributionPoint 作为唯一注册抽象 | D3、A8、A10、K11 |
| [0007](./0007-document-store-and-derived-undo.md) | DocumentStore 契约与 Store 推导的逆操作 | D4、D5、K1 |
| [0008](./0008-opaque-preservation.md) | 不透明保留（部件级 + 节点级）与脏部件重生成；Strict C 案（U-02）；Relationship 全保留仅 http(s) 可激活；不透明修改白名单；**修订 2026-09-26（§4.21）**：决策 5 改为关系与内容类型集合都未变时原样写回、变了才由 PartTable 重生成（X:q-content-types，与 ADR-0019 决策 5 一致），决策 8 按 ADR-0019 决策 8 细化（必需部件畸形归 `format.pptx.invalid_package`）；决策 9 白名单增 (d) `tableStyles.xml` 追加内置样式定义（M3）、(e) 副本的 id 与关系重映射，(b) 扩到裸 `p:contentPart` 的 `p:xfrm`；音视频插入不写 `p:timing`、不扩写入白名单（q-media-insert）；决策 10 只读项增缩放定位 Fallback 的 `hlinkClick` 与 OMML 线性文本，SmartArt「转换为形状」是一次性物化、不形成第二份可编辑模型（q-smartart） | D7、R6、Q14、Q7 |
| [0009](./0009-snapshot-schema-version-and-migrations.md) | Snapshot `schemaVersion`、迁移注册表与 schema 哈希锁 | D6、A23、裁决 Q-T9 |
| [0010](./0010-preset-vs-loader-composition.md) | preset（程序化）与 loader（配置驱动）的分工；惰性条目 | primer §3.6 |
| [0011](./0011-errors-telemetry-as-l0-services.md) | `errors`/`telemetry` 作为 L0 服务；`errors.sink`/`telemetry.sink` 为贡献点 | D11、A24 |
| [0012](./0012-permission-fail-closed-placement.md) | 权限 fail-closed 的放置：命令管线（含 Mutation 级）+ 服务端网关；`CommandDef.permission` 必填 | D12、裁决 Q-T8 |
| [0013](./0013-mutation-lowering-and-store-ops.md) | Mutation 降级与 `StoreOp` 原语集（5 种；有序实体用 `order: FracKey`；实体删除 = 软删除墓碑） | D4、A2、裁决「原语数」、Q3 |
| [0014](./0014-stable-ids.md) | 稳定 id：CRDT 友好 `NodeId`（UUIDv7）与 OOXML id 的双向映射 | R6 |
| [0015](./0015-single-execution-entry-and-non-executable-mutations.md) | 单一执行入口：Command 与 Operation 都经 `commands.execute`；Mutation 不可外部执行 | D4、D12 |
| [0016](./0016-doc-type-blindness-verification.md) | 文档类型盲的验证：夹具文档类型、水平层测试隔离与水平层冻结 | R5、M5 |
| [0017](./0017-ui-component-library-shadcn-copy-model.md) | UI 组件库选型：shadcn/ui 复制模式（Radix + Tailwind 4 + Lucide + Geist）；`@cordexjs/design` 只交付主题变量 CSS；组件依赖全部在 ui-react/`*-ui`；React 19；**修订 2026-09-26（§4.21）**：单点表补登 react-colorful（patch 为静态 CSS）、colord、@tanstack/react-virtual、pragmatic-drag-and-drop、react-hook-form、htmlparser2，react-resizable-panels 升 4.13.3，`cn` 维持 clsx + tailwind-merge 并加 codemod（R-d-11…R-d-20） | 已接受（用户指令 2026-09-15；D10 修订、rulings §4.7；2026-09-24 Q2 React 19，rulings §4.15） |
| [0018](./0018-editor-element-model-and-insert-commands.md) | 可追加元素的模型补全与插入命令族（editor-element-model-and-insert-commands，2026-09-26 新增）：插入命令通用流程与守卫（一次插入一个撤销步）、新增命令与 Mutation、`ShapeKindDef.capabilities` 扩展、`objectDefaults` 只读建模、新元素只写 `p:style` 引用、线条落 `p:cxnSp`；表格 M2 可插入并改单元格文字、M3 前归一化为 `columns`/`rows`/`cells` 三张 Record + FracKey（不变量 I-TBL1、I-TBL2）；连接符跟随与空组规则 | rulings §4.21（q-table-depth、q-media-insert、q-extra-inserts、R-d-61…R-d-78）、D4、D7 |
| [0019](./0019-xml-lexer-and-fidelity-tree.md) | XML 词法与保真树（xml-lexer-and-fidelity-tree，2026-09-26 新增，A-2 定案）：词法、保真树与序列化全部自研，抽为 L0 零依赖包 `@cordexjs/xml`；`scan`（不建树计数与限额）与 `parseDocument`（整树）两个入口，都支持 write/end 与按时间片让出；`XmlLimits` 为 XML 限额唯一定义处，DOCTYPE 一律拒绝，超限 `format.limit_exceeded{limit, actual}`、全部走 Result；门禁为脏部件 c14n 等价；关系与内容类型零编辑原样写回；saxes 与 libxml2-wasm 只作差分 oracle | 已接受（rulings §4.21 X:q-xml-lexer、X:q-xml-package、X:q-content-types）、§5.1–§5.2、D7 |

## 运行时线（0020–0039）

| 编号 | 标题 | 章程关联 |
|---|---|---|
| [0020](./0020-crdt-selection.md) | CRDT 选型：Yjs 13.6.x 精确锁版本（Loro 为已评估替代，阈值重评）；有序实体移动语义；CO-08 逐行收敛表；协同撤销中性契约（跳过并提示 / 整步跳过即停 / 软删除墓碑 + TTL；撤销永不复活他人删除的元素，D4；`store/undo-skipped` 单独统计，D5） | 已接受（Q3，rulings §4.15）、§6.2 |
| [0021](./0021-rendering-medium.md) | 渲染介质：DOM/SVG 单实现，Canvas 仅作栅格化/度量/预留 RenderTarget；DX-1000 回退规则；客户端安全基线；**修订 2026-09-26（§4.21）**：canvas 补第 ④ 角色「媒体与图标预处理」（图片压缩、GIF 首帧、SVG 与图标 PNG 回退、海报帧、来自 URL 图片的 CORS 转码；R-d-23、q-extra-inserts）；公式 M4+ 走 MathJax 4 输出 SVG、以图像上下文渲染，不走 foreignObject（q-equation） | 已接受（Q4，rulings §4.15）、§6.2 |
| [0022](./0022-server-storage.md) | 服务端存储栈：Postgres 18 + Valkey（Redis 协议）+ SeaweedFS（S3 兼容）；单组织去租户；文档级 RLS；**修订 2026-09-26（§4.21）**：B1 定为 drizzle-orm 0.45.x + 手写 schema，漂移检查直查 pg_catalog（含分区父表），B2 定为 Fastify 5；Drizzle 1.0 M2 前评估（q-db-access） | 已接受（Q10/Q6/T-0，rulings §4.15）、§6.2 |
| [0023](./0023-transport-and-protocol.md) | 协同传输与协议：WebSocket + y-protocols 负载 + CONTROL 控制面；权限变更 ≤ 2 s；两级 ack（逐帧 FIFO 对应、step2 视同一帧）；重连 30 s 转离线、离线周期回连；Room 七态；CONTROL 成员补全与关闭码 1011 / 4427 / 4428、随协同后端 M2 交付（§4.19）；**部分被 ADR-0039 取代（2026-09-26，§4.21）**：决策 1（Nest ws 适配器与客户端自研传输）、决策 3（1 字节信封与 CONTROL 专用帧）、决策 4 的「首帧必须 auth、认证前 SYNC 即 4401」、决策 7 的重连 step2 切块；决策 2、5、6、8 与两级 ack 语义保留 | §6.2、S-3a |
| [0024](./0024-presence-and-awareness.md) | Presence / Awareness 模型；`Selection<A>` 序列化即载荷；满员房间服务端合并 tick；**修订 2026-09-26（§4.21）**：中继由 Hocuspocus Document 承担，beforeHandleAwareness 校验、盖章与只读剥离；满员合并改为包装 `Connection.send`、只合并 awareness 帧（H:q-hp-awareness-tick） | §4、Q5 |
| [0025](./0025-update-persistence-and-compaction.md) | Update 持久化与快照压缩策略；PG 故障溢写期两级 ack、降级期照常广播、溢写按实例回放；墓碑 TTL 硬删除作业（「彻底删除元素」复用同一事务）；**修订 2026-09-26（§4.21）**：落库挂 beforeSync（先落库再应用与广播），ack 经 Stateless 下发；版本恢复、彻底删除、墓碑清扫低频先落库，软门禁修复先广播；不用 onStoreDocument 持久化，只作压缩节拍（H:q-hp-persist-ack、H:q-hp-server-tx） | Q17、S-3a、Q3 |
| [0026](./0026-headless-rendering-and-thumbnails.md) | 服务端 headless 渲染与缩略图（含 PDF）：独立零出站 renderer sidecar；两种模式都只经注入（RenderStateToken 拉取已取消）；按页内容哈希失效；640 px WebP；M2 包内 `thumbnail.jpeg`；D200 ≤ 90 s；不用 sharp | 已接受（Q8，rulings §4.15） |
| [0027](./0027-text-measurement-strategy.md) | 文本度量与断行策略（导出从不重排）；竖排/RTL 分阶段；受限字体仅只读渲染；**修订 2026-09-26（§4.21）**：决策 4 断行表由 tooling 从最新 UCD 生成、linebreak 只作对照；RTL 与复杂文种（M4/M5）用 harfbuzzjs + bidi-js（R-d-27、R-d-28） | §5.4 度量、Q7 |
| [0028](./0028-text-editing-host.md) | 文本编辑宿主：单一隐藏 textarea + 自绘光标/选区；`TextInputHost` 为包内可插拔点（14 §5.3）；IME spike 计划；**修订 2026-09-26（§4.21）**：EditContext 作第三实现并入 R-M2-1 spike（R-d-31） | M2 风险 |
| [0029](./0029-gateway-authorization.md) | 协同网关鉴权与授权：短票据握手 + 每帧角色检查 + 权限版本传播；单组织去租户；OIDC（可选 Casdoor），JWT/API Key 降 M4；`auth.selfSignup` 默认关；无待接受邀请表（D1）；分享链接解析归权限模块、票据 `lnk` 与 WS 重算（§4.18 BE-02）；SYNC 写入门槛 ≥ commenter、`auth.refresh` 只重新绑定（§4.19）；扫描器 `scan-doc-access-via-permission` + 文档级 RLS（`check-rls-coverage`）两道防线（D3）；**修订 2026-09-26（§4.21）**：决策 2 改为 Auth 帧 token JSON + 认证前有界排队 + 适配层 5 s 期限，删严格首帧三条；`auth.refresh` = sendToken → onTokenSync；PermissionSync 扩展与连接污染规则（H-d-04、H-d-05、H-d-08、H-d-09） | 已接受（D12、Q6/T-0，rulings §4.15） |
| [0030](./0030-observability-stack.md) | 观测性技术栈：OpenTelemetry 全链路 + pino + Prometheus（Sentry 可选 Provider）；Grafana/Loki 为 AGPL 可选 profile；**修订 2026-09-26（§4.21）**：Nest 12 下 OTel 以 `node --import` 预加载注册，nestjs-core 仪表化暂不可用、由 @fastify/otel + 手工 span 补齐，instrumentation 按需挑选；`/metrics` 用 exporter-prometheus（q-nest-major、R-d-47、R-d-48） | D11、Q10 |
| [0031](./0031-comments-and-anchors-storage.md) | 评论存储：Snapshot `ResourceHook` 为事实源、Postgres 为镜像；id/RelativePosition 锚点（v0.2 修订）；墓碑 TTL 内以原 id 恢复、线程回到原锚点（2026-09-24 复核修正）；包 `@cordexjs/comments`、Y 路径 `resources['comments.threads']`（§4.19 D-COMMENTS-PKG） | PRD CO-04 |
| [0032](./0032-ordered-collections-fractional-index.md) | 有序集合的并发语义：实体表 + fractional index；Snapshot 保留 `order` 键；墓碑保留键；**修订 2026-09-26（§4.21）**：决策 2 键格式改为内置 rocicorp fractional-indexing 算法（CC0，注明出处）——整数头 + 随机后缀，后缀避开以 '0' 结尾（q-frackey）；表格行列 order 也用 FracKey（ADR-0018） | 裁决 A-9、Q3 |
| [0033](./0033-offline-persistence.md) | 离线队列与本地持久化：`collab-offline-idb`（dom），collab-yjs 保持 iso；内存队列随协同后端 M2 交付（基础重连）、离线体验 M3、跨刷新持久化 M4（对齐 PRD 05 §0.3）；**修订 2026-09-26（§4.21）**：OfflineStore 与 provider 内部 messageQueue 无关（重建 WS 时被清空，靠 step1/step2 补齐），不采用 y-indexeddb，M4 自写 idb 适配（ADR-0039、R-d-26） | §5.2 |
| [0034](./0034-server-update-validation-and-repair.md) | 服务端对 update 的校验：硬门禁拒绝 + 软门禁补偿修复（不回滚、不分叉）；墓碑不变量；溢写期门禁时序；**修订 2026-09-26（§4.21）**：挂点改为 L1 在适配层、L2/L3 在 beforeSync（`Y.decodeUpdate`，V1）、L4 在 afterHandleMessage；拒绝改为连接污染规则（H-d-09、H-d-10） | D12、裁决 P8、Q3、S-3a |
| [0035](./0035-gateway-horizontal-scaling.md) | 协同网关横向扩展：多副本房间 + Redis 协议扇出（Valkey），默认文档哈希偏好亲和（非会话粘性，非正确性前提；原「不依赖房间亲和」）；按文档实测权重准入、多副本相乘；**修订 2026-09-26（§4.21）**：M3 扇出改用 extension-redis 并加固，决策 7 按 documentId 哈希偏好亲和由可选改为默认（非会话粘性，亲和不是正确性前提）；停机 drainAll 自写（H:q-hp-fanout、H-d-21、H-d-22） | 已接受（Q5/Q10，rulings §4.15） |
| [0036](./0036-chart-rendering-and-editing.md) | 图表渲染与编辑路线（chart-rendering-and-editing，2026-09-26 新增）：d3-scale / d3-shape / d3-array（ISC）做底层、按 OOXML 语义自研布局（manualLayout、Excel 自动刻度、堆积、饼图标签避让）；M1 只读（SSIM ≥ 0.80，惰性子路径 `./chart`），M3 插入与五类编辑（数据网格 @tanstack/react-table 9 + shadcn Table，内嵌 xlsx 自研最小写出器 + numfmt）。本号原预留给 identity-and-tenant-isolation，因 T-0 去租户未开设 | 已接受（rulings §4.21 q-chart-route）、D16、U-06 |
| [0037](./0037-deployment-topology-and-packaging.md) | 部署拓扑与交付件：同镜像按 `CORDEX_ROLE`（all/api/collab/worker/renderer）运行（逐模块装配矩阵以 60-backend/01 §5 为准）；反代按 `/api`、`/collab` 分流并以 `idp.*`、`s3.*` 子域暴露 IdP 与对象存储；compose 组件与许可（D13 镜像主组件白名单，AGPL 仅可选 profile）；最低主机规格；M3 出口（断网 e2e、digest、SBOM、许可门禁）；M4 P1（离线包、多架构、Helm） | 已接受（Q10，rulings §4.15）、D13 |
| [0038](./0038-version-restore-undo.md) | 版本恢复可撤销（version-restore-undo，**提议**）：持有 Room 的实例内单事务、不加锁、走命令管线（不用 `revertTo`）；按「当前值是否仍出自恢复事务 struct 范围」判定他人后写（不比较值）；恢复时删掉的元素以原 id 复活；「谁能撤销」「可撤销时效」待定稿交互拍板。主笔 M-02，会签 M-05、M-09；M2 出口评审前定稿，未定稿则 M3 版本恢复（CO-07）不开工 | U-07、N1、Q3（rulings §4.20 TX-01+BE-10） |
| [0039](./0039-collab-server-hocuspocus.md) | 协同服务端采用 Hocuspocus 4（collab-server-hocuspocus，2026-09-26 新增，**部分取代 ADR-0023**，吸收 WS 接入）：Hocuspocus 类嵌入 Nest（Fastify）底层 HTTP server 的 upgrade（ws noServer），一 WS 一文档；握手、门禁、持久化、awareness 校验与控制面挂在钩子与扩展上；逐帧落库 + 两级 ack（Stateless 下发）、连接污染规则、step2 单设 16 MiB；M3 extension-redis + 按文档哈希偏好亲和；客户端官方 provider + 自有调度器与 FIFO 胶水；版本精确钉 4.7.0 | 已接受（rulings §4.21 q-ws-gateway（用户选择的非推荐项）与 H:q-hp-* 六题）、S-3a |

## 类型治理线（0040–0049）

| 编号 | 标题 | 章程关联 |
|---|---|---|
| [0040](./0040-type-budgets-and-ratchet.md) | 类型预算与 Ratchet（只减不增） | §6.2、R7 |
| [0041](./0041-assertion-policy.md) | 断言策略：`as`/`!` 禁用与替代模式（`as const`/`satisfies` 例外） | R7 |
| [0042](./0042-no-enums-const-objects.md) | 禁 `enum`，用 `as const` 对象与联合类型；协议用字符串 id | A3 |
| [0043](./0043-result-vs-exceptions.md) | Result 与异常的边界（与 10 错误码体系对接） | D11 |
| [0044](./0044-eslint-and-biome-split.md) | ESLint（类型感知规则）与 Biome（格式化）的职责切分 | D9 |
| [0045](./0045-isolated-declarations.md) | 采用 `isolatedDeclarations` | D9 |
| [0046](./0046-native-typescript-compiler-evaluation.md) | TS 7 原生编译器（tsgo）评估计划 | — |
| [0047](./0047-branded-primitive-types.md) | 品牌原始类型（`Emu`/`Pt`/`UnitId`/`NodeId`…） | §4 |
| [0048](./0048-type-testing-tooling.md) | 类型测试工具选型 | 09-09 |
| [0049](./0049-dependency-admission-and-license-tiers.md) | 依赖准入与许可分级（dependency-admission-and-license-tiers，2026-09-26 新增）：许可分级附表（宽松类视同放行；OFL-1.1 限字体、CC0-1.0 限数据文件与内置源码、MPL-2.0 限不修改的依赖；LGPL、GPL、AGPL、SSPL、BUSL、Unlicense 及更强 copyleft 禁止）；逐包例外附证据；新增依赖四处同步；停更判定与 minimumReleaseAge；传递依赖与 devDependency 同扫（TD-050） | 已接受（rulings §4.21 q-license-tiers、R-d-10）；取代章程 D13 原口径 |
