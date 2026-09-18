# ADR-0013 Mutation 降级与 `StoreOp` 原语集（5 种；有序实体用 fractional index）

> 状态：草稿 | 负责：架构-结构 | 更新：2026-09-15 | 依赖：charter v0.1

## 状态

提议（与运行时线 ADR-0020/0032 对齐：有序实体集合 = 实体表 + `order: FracKey`，Mutation 载荷禁止数组下标）。

## 背景

D4 要求 Mutation 是唯一改 Store 的途径且逆操作由 Store 推导；文档类型盲要求 Store 不认识任何文档类型的 Mutation。两者相加意味着必须存在一个**文档类型无关的中间层**：Store 只理解少量结构原语，文档类型贡献的 Mutation 降级为原语。同时 ADR-0032 决定顺序不以数组下标表达（并发移动安全）。

## 决策

1. **五种原语**（`model-core/store/ops.ts`）：
   ```
   set(path, value) · delete(path) · insert(path, index, items) · remove(path, index, count) · text(path, delta)
   ```
   - `insert/remove` **只用于无身份的值列表**（`columnWidths: Emu[]`、渐变 stops、tab stops、`paragraphs[]` 若不走 Y.Text）；
   - **有身份的集合**（页、母版、版式、形状、媒体、节、评论…）= 实体表 `Record<id, entity>` + 实体属性 `order: FracKey`；「移动」= `set([...,'order'], key)`；**不存在 `move` 原语**（ADR-0032）。
   - `text` 的 delta 与 Y.Text 同形（insert/retain/delete + attributes）。
2. **Mutation 载荷禁止数组下标与相对位置**：意图「插到 X 之后」在**命令层**转为具体键：`const order = between(prev?.order, next?.order)`（`@oce/shared/order`，含 2 字符随机后缀）→ Mutation 携带最终 `order`。这样 `lower()` 保持**纯且确定**（同一 Mutation 任何时候降级结果相同），随机性与 id 生成一样只发生在命令层。
3. **`lower(mutation, view): Result<StoreOp[], LowerError>`** 是文档类型贡献的纯函数（`core.mutation`）：可读当前视图以校验存在性与构造路径；不得读服务、时间、随机。
4. **逆操作在原语层**：`set`↔`set/delete`、`insert`↔`remove`（需被删项）、`text`↔`invert(delta, oldText)`；Provider 在应用前读旧值。
5. **路径**：`Path = (string | number | { id })[]`；`{id}` 选择器只用于无身份值列表中按 `id` 字段查找的特例（原则上不需要）；实体表按键定位。
6. **DirtyTracker** 按路径前缀工作；实体表使脏映射直接（`['shapes', id]` → 所在部件经 `containerId` 反查）。
7. **Snapshot 中 `order` 键原样保留**（不转数组），使 `toSnapshotBody()` ≡ `state()` 的契约成立、memory 与 yjs 一致、导入不必重新生成键；人类可读的数组视图由调试工具即时计算（对 ADR-0032 第 6 条的建议，见 README §7）。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| Store 直接理解 Mutation | 文档知识进水平层（A1）；每个 Provider × 每种 Mutation 实现 |
| 只有 JSON Patch（RFC 6902） | 无富文本 delta；`move` 在 CRDT 下不安全；`test` 语义与事务不合 |
| 保留 `move` 原语、由 Provider 定义并发语义 | memory 与 yjs 语义分叉；ADR-0032 已用 `order` 键消除 move 的必要性 |
| 有序集合用数组 + 下标 | 并发插入/移动冲突（06 I4）；实体身份随删除+插入丢失 |
| `lower` 内生成 `order` 键 | 破坏 lower 的纯度（随机后缀）；改为命令层生成 |

## 后果

- 正：Store 契约永远不变（12 的盲性论证核心）；memory/yjs 语义一致；Mutation 可回放；顺序并发安全。
- 负：命令作者需要用 `between` 计算键（提供 `slides.order.after(x)` 助手）；渲染层需要按 `(order, id)` 维护排序缓存；无身份值列表仍有下标（可接受：它们不参与并发移动语义，且事务内解析）。

## 如何被机械验证

- 类型测试：`Mutation` schema 无 `index`/`toIndex` 字段（扫描器 `no-index-in-mutation`，06 I4）；`StoreOp` 联合恰 5 成员。
- property test：`apply(inverse(apply(s, op))) ≡ s`；随机 Mutation 序列后 `bodySchema` 通过。
- `lower` 确定性测试：同一 Mutation 对同一视图两次降级结果深等。
- `runDocumentStoreConformance`：并发 `order` 写入在 memory 与 yjs 收敛一致（协同分节由 06 补全）。
- `@oce/shared/order` 单测（ADR-0032 列出）。

## 关联

章程 D4、R5；Univer A1/A2、缺陷 #3；ADR-0007、ADR-0020、ADR-0032；04 §2.3、§3.1；05 §4；06 I4。
