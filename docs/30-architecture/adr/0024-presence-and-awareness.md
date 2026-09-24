> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-24 | 依赖：charter v0.1；裁决 `docs/00-charter/rulings-2026-09-14.md` §4.13 S-1、§4.15 Q5

# ADR-0024 Presence / Awareness 模型

## 状态

提议。

## 背景

章程术语「在场信息 Presence/Awareness」：协作者光标、选区、当前页等非持久状态；Operation（视图状态变化）可作为 presence 广播（§4）。设计线 20-design/05 需要远端光标/选区/头像/「正在编辑」。规模：≤ 20 编辑者 + 观看者。

## 决策

1. 采用 **y-protocols/awareness** 作为传输与合并机制（每 client 一个 LWW 状态 + 时钟，30 s 超时），经信封 `AWARENESS` 帧传输；服务端持有房间级 Awareness 用于给新加入者全量、断开时广播移除。
2. 状态 schema 在 `@cordexjs/protocol/collab/awareness.ts` 用 zod 定义（06 §7.1）：`user`、`client`、`view`、`selection`、`caret`（`Y.RelativePosition` base64）、`editing`、`idle`、`ts`；单状态 ≤ 2 KiB；非法状态服务端丢弃并计数。
3. `presence` 是 **UnitScope 服务**（Definition 在 collab-core，Provider 在 collab-yjs）：`setLocal(patch)`、`remotes`（反应式只读）、事件 `presence/changed`。
4. 频率：光标/选区 20 Hz 上限，其余 2 Hz；`idle` 60 s；观看者也可发 awareness（用于「谁在看」）。
5. 文本光标用 RelativePosition：并发编辑后仍指向同一字符；渲染层用 `store.resolveStablePosition` → `CaretMap`（07 §7）。
6. 不持久化、不审计内容；只审计 join/leave（服务端会话记录）。
7. 「软锁」：不做排他锁；`editing` 字段驱动 UI 提示（P1 待决）。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 把 presence 放进 Y.Doc | 会进入持久化与撤销栈、放大文档体积、离线时产生垃圾；Yjs 官方也把 awareness 与 doc 分离 |
| 自定义 CONTROL JSON presence | 重复实现 awareness 的时钟/超时/合并；y-protocols 已成熟且可被现成客户端互操作 |
| 仅服务端 Redis presence（无 CRDT 元数据） | 需要服务端为每客户端维护状态并做扇出去重；awareness 协议已提供这些语义 |
| 绝对偏移光标 | 并发插入后错位 |

## 后果

正面：几乎零自研；与 y-websocket 生态兼容；RelativePosition 复用到评论锚点（ADR-0031）。

负面 / 代价：awareness 无权限过滤（所有房间成员可见所有人的状态）→ 若产品需要「部分观看者不显示」（S-1 起不存在匿名观看者），由服务端在扇出时过滤（awareness relay 支持按 role 掩码，M3 可选）；高频光标在 20 人房间 ≈ 400 帧/s 扇出，服务端 CPU 可忽略但移动端流量需节流（已定 20 Hz）。

## 补充（v0.2）：与 05 `Selection<A>` 及 PRD 的对齐

- `AwarenessState.selection: SerializedSelection` **就是** `Selection<A>.serialize()` 的输出（05：`broadcast: true` 的 Operation 经 `presence` 序列化广播；02 §4.11 `awareness.ts`）。collab-core 不解释其内容；`DocumentType.selectionKinds` 对应的 schema 负责校验。幻灯片序列化形态：`{ kind: 'slides'|'shapes'|'text'|'tableCells', slideId, ids[], range?: { anchor, head } }`（`range` 为 RelativePosition base64）；本 ADR 原 `selection`/`caret` 两字段合并于此。
- 服务名：`ctx.selection`（UnitScope）已由总编排批准补进章程 §5.5；presence 从它读取本地选区。
- 事件定稿：`presence/joined`、`presence/left`、`presence/changed`（PRD EM-05）。
- 预算：presence 传播 p95 ≤ 200 ms（NF-01 1.6）；awareness 节流 ≥ 50 ms（SV-05）。
- CO-08 第二行的「X 也在编辑此文本框」是**预防性**提示：当远端 `SerializedSelection.kind === 'text'` 且目标形状相同即显示（presence 的一部分，不是锁）。
- 20 人房间的头像折叠与覆盖层密度由设计线 20-design/05 决定；presence 服务只保证 `remotes` 的完整性与顺序稳定（按 `client.id`）。

## 如何被机械验证

- 单测：节流器在 1 s 内最多 20 帧；超时 30 s 后 `remotes` 移除；非法 schema 被丢弃并计数 `cordex_collab_awareness_dropped_total`。
- conformance：新加入者 1 s 内拿到全量在场状态；断开后其他端 ≤ 1 s 移除（服务端主动广播）。
- e2e：双浏览器远端光标位置在并发键入后仍跟随同一字符（截图 + DOM 断言）。

## 关联

章程 §4 Presence/Operation、§5.5 `presence` 服务；ADR-0023/0031；架构 06 §7、07 §7；设计 20-design/05。

## 修订 2026-09-24：满员房间的服务端 awareness 合并 tick（rulings §4.15 Q5）

- Q5 性能包络含「20 编辑者 + 50 查看者」同房间；逐帧扇出在满员时约 70 × 20 Hz 入帧 × 70 出方向，移动端与服务端出口压力不可忽略。改为：**服务端 awareness 合并 tick**（每 tick 把该房间的 awareness 变更合并为一帧再扇出，tick 间隔与 SV-05「节流 ≥ 50 ms」一致），并且**查看者只上报 `view`**（视口/当前页），不上报光标与选区。
- 房间名额按用户计（同一用户多标签页只占 1 名额，ADR-0035 修订），awareness 仍按连接（clientID）维护，展示层按 `userId` 合并头像。
- 机械验证：满员房间（20 + 50）扇出压测纳入 11-testing §9；单测断言查看者 awareness 载荷只含 `view` 字段，其他字段被服务端丢弃并计数。
