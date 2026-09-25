> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-14；2026-09-24 复核修正（rulings §4.17；复核报告 M10：软删除后以原 id 恢复、线程回到原锚点）；2026-09-25（§4.19：D-COMMENTS-PKG 包归属与 Y 路径 `resources['comments.threads']`，见文末修订） | 依赖：charter v0.1；ADR-0020「协同撤销语义」

# ADR-0031 评论的存储位置与锚定：Postgres 实体 + id/RelativePosition 锚点（不进 CRDT）

## 状态

提议 **v0.2**（2026-09-15 修订：依 PRD PD-04（用户裁决「协同模式下评论存于 Snapshot（ResourceHook）为事实源」）、CO-04 与架构 04 §8「comments 插件经 ResourceHook 建模」，事实源从 Postgres 改为 Snapshot 内 `ResourceHook`；Postgres 表降为镜像读模型。下文「决策」与「备选方案」第一行的 v0.1 论证已被本修订取代，保留以示演进）。

## 决策修订（v0.2）

1. **事实源**：评论线程/回复/解决状态/锚点存放在 Snapshot 的 `ResourceHook` 命名空间 `comments.threads`，按 04 §2.7 的 `resources: Record<命名空间, { version, data }>` 落位为 `resources['comments.threads'] = { version, data: { threads, replies } }`（Y.Doc 顶层 `resources` 下的同名键）：`threads: EntityTable<ThreadId, { anchor, resolved, resolvedBy, createdBy, createdAt, order }>`、`replies: EntityTable<ReplyId, { threadId, authorId, body, mentions[], createdAt, editedAt, deletedAt, order }>`。该 hook 由 iso 包 `@cordexjs/comments` 注册（文档类型盲，02 §4.12c）。这使评论：随文档导入/导出往返（现代评论部件 `modernComment_*.xml` + `commentAuthors.xml` 的编解码归 `ooxml-pptx`，A 线 04）、在单人模式（无服务端）可用、离线可写、随快照/版本恢复。
2. **权限**：CRDT 本身不能执行作者级规则，改由**服务端软门禁**（ADR-0034 补充）执行：`commenter` 的 update 只允许触及 `resources['comments.threads']` 路径（与 ADR-0034 路径级规则的前缀逐字一致）；创建/编辑/删除回复要求 `authorId === session.userId`（owner 可删任何）；`resolved` 由 commenter+ 修改；越权路径 → 服务端还原旧值（repair）并计数，达阈值隔离。`viewer` 的任何 update 仍被硬门禁拒绝。
3. **撤销**：`comments.threads` 命名空间排除在 `UndoManager` 作用域之外（评论操作是命令但不可撤销；UI 提供「删除」而非撤销）。
4. **镜像**：Postgres `comments` 表为**读模型**（08 §16.6）：服务端 Room 观察 `resources['comments.threads']` 变更后 upsert（按 `comments.` 前缀识别，不识别文档类型，rulings §4.18 FE-01），用于跨文档查询（@我）、集成方 webhook、审计与运维；从不作为写路径。
5. **锚点、分离、通知**：不变（下文 §3–§4）；事件按 PRD 定稿 `comment/added|replied|resolved|reopened|deleted|mentioned`（10 §11），由 `@cordexjs/comments` 在观察到本地/远端变更时发出，正文可配置脱敏。
6. **导入**：打开含评论的 pptx 时评论以只读显示（作者名来自 `commentAuthors`），「导入为可编辑线程」把只读评论转成 `resources['comments.threads']` 实体（P1）；导出默认写回现代评论部件（可关，PD-04）。
7. **规模**：单文档 ≤ 5,000 线程、单线程 ≤ 500 回复（CO-04）→ `resources['comments.threads']` ≈ 2 MB 上限，纳入 06 §9.1 的文档体积预算；面板查询直接读内存 CRDT（≤ 300 ms）。

## 背景

评论需要：作者身份与权限（只有作者/owner 可删、commenter 可创建）、通知、审计、跨版本存活；锚定到幻灯片/形状/文本范围；目标被删除后仍可见（「已分离」）。CRDT 内的数据无法可靠执行作者级权限（任何编辑者都能改任何键）。

## 决策

1. 评论是**服务端实体**（`comments` 表，08 §5），经 REST 读写（commenter+），服务端执行作者/角色权限与审计。
2. **锚点**：`{ slideId, shapeId?, range?: { anchor, head }（Y.RelativePosition base64）, snapshotSeq }`；服务端只校验格式（不解码 CRDT），客户端解析位置（`store.resolveStablePosition`）。
3. **分离**：客户端在 observe 到目标实体被删除时不改评论；渲染时解析失败 → 显示在「已分离评论」列表（P6）；服务端在压缩任务中批量重算 `anchor_state`（用 headless Unit 解析，M4 可选）。
4. **实时性**：评论变化通过 room 的 `CONTROL.event{ type:'comments.changed', threadId }` 通知在线客户端（复用协同通道，B4 待决），客户端再 REST 拉取。
5. **导出**：评论以 OOXML `p:cm`（modern comments `p188:cm`）写回 pptx 由 ooxml-pptx 在导出时从 REST 数据合成（A 线 04 决定是否支持；M3 默认导出为传统评论部件）。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 评论存入 Y.Doc（`resources.comments`） | 无法执行作者级权限（fail-closed 的反面）；离线客户端可篡改他人评论；进入撤销栈与文档体积；与 CRDT 修复语义纠缠 |
| 混合：线程在 PG、锚点在 Y.Doc | 两处一致性问题；锚点本身用 RelativePosition 已能随 CRDT 稳定，不需入 Doc |
| 绝对位置锚点（段落/字符偏移） | 并发编辑后失效 |
| 独立 SSE/WS 通道通知 | 多一条连接；复用房间控制帧更简单（可替换） |

## 后果

正面：权限与审计正确；评论独立于文档纪元/快照；可跨恢复存活（锚点失效即分离）。

负面 / 代价：锚点解析在客户端（离线时不可解析新评论——可接受）；RelativePosition 在 epoch 切换后失效 → 换纪元时需重算锚点（06 §9.4 的成本之一）；导出评论需 A 线 codec 支持。

## 如何被机械验证

- e2e：commenter 可创建、不可删他人；editor 删除目标形状后评论进入「已分离」列表；**墓碑 TTL 内恢复形状（删除方撤销或「恢复元素」）以原 id 恢复，线程自动回到原锚点**；TTL 到期硬删除后才永久分离（2026-09-24 复核修正，随 ADR-0020 软删除墓碑、id 稳定；原「恢复形状（新 id）不自动重新附着」作废）。
- 单测：锚点 schema（zod）拒绝超长/非 base64；解析失败路径返回 `detached`。
- 集成：评论变更 ≤ 1 s 到达其他在线客户端（控制帧）。

## 修订 2026-09-25（rulings §4.19 D-COMMENTS-PKG；决策 INC-39）

1. **包归属**：评论客户端插件为新增 iso 包 `@cordexjs/comments`（横向能力、文档类型盲：threads / replies 实体、ResourceHook `comments.threads`、`comments.*` 命令、`comment/*` 事件、锚点抽象由文档类型经贡献点 `comments.anchorResolver` 提供 resolver），M3 装入 `preset-slide-collab`；slide 专属锚点解析、检查器评论页签、画布评论钉由 `slide-ui` 贡献（02 §4.12c、§4.20）。决策修订 v0.2 中的「comments 插件」即此包。
2. **Y 路径写法统一**：v0.2 中 `resources.comments`、`resources.comments.*` 的写法一律改为 `resources['comments.threads']`（命名空间 `comments.threads`，其 `data` 内含 `threads` 与 `replies` 两张实体表），与 04 §2.7、ADR-0034 路径级规则与 60-backend/07、60-backend/16 的软门禁放行前缀逐字一致；`slide-comments.threads` 的旧写法作废（命名空间不得带文档类型前缀，rulings §4.18 FE-01）。
3. **写入门槛**：commenter 能写 CRDT 是本 ADR 成立的前提，网关 SYNC 写入门槛相应为 ≥ commenter、写入范围由软门禁路径规则限定（ADR-0029 决策 3 修订 2026-09-25，06 §10–§11）。
4. **实时通知**：原决策 4 的 `CONTROL.event{ type:'comments.changed', threadId }` 以 06 §6.3 为准：`event{ name:'comments.changed', payload:{ threadIds[] } }`（决策 SG-03）；评论 REST 只读，唯一写入口是 CRDT（经 `CommentMirrorObserver` 镜像）。

## 关联

章程 D12、M3；ADR-0024（RelativePosition）、0023（控制帧）、0029（写入门槛）、0034（路径级规则）；架构 02 §4.12c、04 §2.7、06 §6.3/§7/§11、08 §2/§5；60-backend/07；50-frontend/08。
