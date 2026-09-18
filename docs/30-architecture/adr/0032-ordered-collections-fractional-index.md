> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-14 | 依赖：charter v0.1

# ADR-0032 有序集合的并发语义：实体表 + fractional index（不用数组）

## 状态

提议（ADR-0020 的子决策；同时约束 store-memory 与 store-yjs，因其是 `DocumentStore` 原语 `Ordered` 的语义）。

## 背景

幻灯片顺序、形状 z-order、组合内顺序、节顺序都需要并发安全的「移动」。候选：Yjs `Y.Array`（无原生 move：移动 = 删除 + 插入，并发移动同一元素 → 重复或丢失）；未发布的 y-move；Loro movable list；fractional index（Figma 等采用）。

## 决策

1. 所有有序实体集合 = `EntityTable`（`Y.Map<id, Record>`）+ 每个实体的 `order: FracKey`（字串）。**排序键 `(order, id)`** 提供全序与确定性平局处理。
2. `FracKey` 生成（`@oce/shared/order`，纯函数、iso）：base-62 字母表、`between(a, b)` 生成介于两者的最短键并**追加 2 字符随机后缀**（降低并发同位插入产生相同键的概率；相同键也不影响正确性，只影响直觉顺序）。首个键 `'V'`（中点）。
3. **移动 = 单键写入**（`set(entities/<id>/order, key)`；`StoreOp` 无 `move` 原语），并发移动同一实体 → LWW，一份实体、一个位置。**并发插入同一间隙** → 两个实体都存在，按 `(order, id)` 排序，各端一致。
4. **键长治理**：键长 > 64 字符时（长期在同一间隙反复插入的病态情况），由服务端在房间 `draining`/无编辑者时执行「重排键（rekey）」事务（origin `maintenance`）为该集合重新分配等距键；客户端不主动 rekey（避免与并发移动竞争）。
5. 跨父移动（进出组）：`parentId` 单键 LWW + `order` 在新父下重新生成；父子环由修复规则处理（06 §8 #5）。
6. Snapshot 中的顺序**保留 `order: FracKey` 键**（总编排裁决，采 A 线 ADR-0013 第 7 条），不转数组：`load`/`toSnapshotBody` 原样搬运键，无「生成等距键 / 排序还原」步骤；只有导出到 OOXML 时由编解码器按 `(order, id)` 排序产生 `sldIdLst`/`spTree` 的顺序。
7. Mutation 载荷禁止数组下标（06 I4）：键由**命令层**经 `@oce/shared/order` 计算（`between(prev.order, next.order)`），Mutation 携带**最终键**，`lower()` 保持纯函数——插入 → `set(entities/<id>, record{ order })`、移动 → `set(entities/<id>/order, key)`、删除 → `delete(entities/<id>)`；Store 不解析下标。`StoreOp` 定为 5 原语（`set/delete/insert/remove/text`，总编排裁决）：**弃用 `move`** 的原因是有身份实体的顺序已由键承载，原子数组极少移动且 `Y.Array` 无原生 move——`remove` + `insert` 即可，其并发重复的已知风险由幂等规则与 rekey 兜底；索引式 `insert/remove` 只用于非身份数组。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| `Y.Array` 删除+插入 | 并发移动同一元素产生两份或零份；删除+插入使实体失去身份（引用/评论锚点断裂） |
| y-move / Yjs 原生 move | 未发布 |
| Loro movable list | 需切换 CRDT（ADR-0020） |
| 链表 CRDT（自研 prev 指针） | 环/断链修复复杂度高于 fractional index 的键长问题 |
| 服务端全序（顺序由服务端仲裁） | 离线不可用；违背 CRDT 单一事实源 |

## 后果

正面：移动是最小写入；实体身份稳定；实现简单且 store-memory 可同构实现；确定性排序便于 fuzz 断言。

负面 / 代价：键长可能增长（rekey 治理）；并发同位插入的相对顺序由 id 决定（非用户直觉，但一致）；需要为 `order` 建排序缓存（渲染层每页维护已排序数组，observe 到 `order` 变化时增量插入）。

## 补充（v0.2）：与 04 `StoreOp` 与 Snapshot 形态的对齐

- Snapshot 与两种 Store **都保留 `order: FracKey` 键**（ADR-0013 第 7 条）：页序/形状序/表格行列/段落都是实体表 + 键；store-memory 与 store-yjs 只是键的容器不同，读视图都按 `(order, id)` 排序。二者对 `runDocumentStoreConformance` 的所有用例（含协同分节）结果相同。
- 键由命令层经 `@oce/shared/order` 计算，Mutation 携带最终键，`lower()` 纯函数（06 §18.1）；`TransactionRecord.ops` 因 `set` 自带键而天然可回放，无需锚点字段。
- 协同分节新增两条用例：「并发同位插入按 `(order, id)` 全序一致」「rekey 后顺序不变」。
- 哪些数组是「有序实体列表」由 `bodySchema` 注解（`ordered-entities`）决定，其余数组按原子值整体 LWW——对 A 线的 schema 要求。
- 例外：`paragraphs` 在 `Y.XmlFragment` 中无键序，段落移动 = `remove` + `insert`（06 §18.1），由修复规则处理并发重复。

## 如何被机械验证

- `@oce/shared/order` 单测：`between` 的字典序性质、最短性、随机后缀分布；100 万次随机插入键长统计（p99 ≤ 32）。
- `runDocumentStoreConformance`：并发移动/插入用例对 memory 与 yjs 一致。
- collab-sim：随机移动/插入 fuzz 下所有端顺序一致；病态同位插入 10k 次后 rekey 结果顺序不变。
- 类型测试：Mutation schema 无 `index` 字段。

## 关联

ADR-0020；章程 D4/D6；Univer A2（寻址不绑定产品）；架构 06 §1、§8。
