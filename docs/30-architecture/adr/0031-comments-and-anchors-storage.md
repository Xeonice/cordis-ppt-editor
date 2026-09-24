> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-14；2026-09-24 复核修正（rulings §4.17；复核报告 M10：软删除后以原 id 恢复、线程回到原锚点） | 依赖：charter v0.1；ADR-0020「协同撤销语义」

# ADR-0031 评论的存储位置与锚定：Postgres 实体 + id/RelativePosition 锚点（不进 CRDT）

## 状态

提议 **v0.2**（2026-09-15 修订：依 PRD PD-04（用户裁决「协同模式下评论存于 Snapshot（ResourceHook）为事实源」）、CO-04 与架构 04 §8「comments 插件经 ResourceHook 建模」，事实源从 Postgres 改为 Snapshot 内 `ResourceHook`；Postgres 表降为镜像读模型。下文「决策」与「备选方案」第一行的 v0.1 论证已被本修订取代，保留以示演进）。

## 决策修订（v0.2）

1. **事实源**：评论线程/回复/解决状态/锚点存放在 Snapshot 的 `ResourceHook` 命名空间 `comments.*`（Y.Doc 顶层 `resources.comments`：`threads: EntityTable<ThreadId, { anchor, resolved, resolvedBy, createdBy, createdAt, order }>`、`replies: EntityTable<ReplyId, { threadId, authorId, body, mentions[], createdAt, editedAt, deletedAt, order }>`）。这使评论：随文档导入/导出往返（现代评论部件 `modernComment_*.xml` + `commentAuthors.xml` 的编解码归 `ooxml-pptx`/comments 插件，A 线 04）、在单人模式（无服务端）可用、离线可写、随快照/版本恢复。
2. **权限**：CRDT 本身不能执行作者级规则，改由**服务端软门禁**（ADR-0034 补充）执行：`commenter` 的 update 只允许触及 `resources.comments.*` 路径；创建/编辑/删除回复要求 `authorId === session.userId`（owner 可删任何）；`resolved` 由 commenter+ 修改；越权路径 → 服务端还原旧值（repair）并计数，达阈值隔离。`viewer` 的任何 update 仍被硬门禁拒绝。
3. **撤销**：`comments.*` 命名空间排除在 `UndoManager` 作用域之外（评论操作是命令但不可撤销；UI 提供「删除」而非撤销）。
4. **镜像**：Postgres `comments` 表为**读模型**（08 §16.6）：服务端 Room 观察 `resources.comments.*` 变更后 upsert，用于跨文档查询（@我）、集成方 webhook、审计与运维；从不作为写路径。
5. **锚点、分离、通知**：不变（下文 §3–§4）；事件按 PRD 定稿 `comment/added|replied|resolved|reopened|deleted|mentioned`（10 §11），由 comments 插件在观察到本地/远端变更时发出，正文可配置脱敏。
6. **导入**：打开含评论的 pptx 时评论以只读显示（作者名来自 `commentAuthors`），「导入为可编辑线程」把只读评论转成 `resources.comments` 实体（P1）；导出默认写回现代评论部件（可关，PD-04）。
7. **规模**：单文档 ≤ 5,000 线程、单线程 ≤ 500 回复（CO-04）→ `resources.comments` ≈ 2 MB 上限，纳入 06 §9.1 的文档体积预算；面板查询直接读内存 CRDT（≤ 300 ms）。

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

## 关联

章程 D12、M3；ADR-0024（RelativePosition）、0023（控制帧）；架构 06 §7、08 §2/§5。
