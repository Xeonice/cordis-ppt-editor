# 05 命令与历史：命令三分法、执行管线、Mutation 类型化与降级、Store 推导逆操作、协同撤销、失败传播

> 状态：草稿 | 负责：架构-结构 | 更新：2026-09-15；2026-09-24（rulings §4.15 Q3：§6 与 §13.4 协同撤销语义统一为「同键被他人后写 → 跳过并提示；整步被跳过 → 停下不连撤；删除 = 软删除墓碑 + TTL」，写入 DocumentStore 中性契约；Q5 `maxElementsPerDoc` 命令守卫）；2026-09-24（复核修正，rulings §4.17：D4 撤销永不复活他人删除的元素；D5/M2 `store/undo-skipped` 载荷 `{skipped, wholeStep}` 并单独统计；M3 撤销契约用例名照抄 M-02 §2.5；D2 编辑期超限 `document.quota_exceeded{dimension}`） | 依赖：charter v0.1
> 继承 Univer K1（命令三分法，「最正确的一项」），规避其缺陷 #3（手写逆操作）与 `return false` 2,244 次的失败静默。签名为「草案」。

---

## 1. 三分法的精确契约（D4）

| 概念 | 是什么 | 能读 | 能写 | 同步性 | 序列化 | 历史 | 权限 | 网络 |
|---|---|---|---|---|---|---|---|---|
| **Command** | 用户意图；读状态、计算、在**一个事务**内产出若干 Mutation | Store、服务 | 只能经 `tx.mutate()` | 异步（`Promise<Result>`） | 参数可序列化；命令本身不传输 | 一个事务 = 一个撤销单元 | 命令级检查 | 不上网络 |
| **Mutation** | **唯一**改 Store 的操作；语义化、确定性 | 传入的只读视图 | 经 `lower()` 变为 `StoreOp[]` 被 Store 应用 | 同步、纯 | **必须**可序列化（审计/回放/测试） | 逆操作由 Store 在 `StoreOp` 层推导，**禁止手写** | Mutation 级二次检查 | 不上网络（协同传 CRDT update） |
| **Operation** | 视图状态变化：选区、缩放、当前页、面板开合 | 服务 | 只改 UnitScope 的视图服务（`selection`、`render.viewport`、`ui`） | 同步或异步 | 可序列化（presence 广播） | **不**入历史 | 一般无需 | 可作为 presence 广播 |

**类型层面的强制**（不是约定）：
- `CommandDef.handler(ctx, params, tx)` 拿到 `Transaction`；`OperationDef.handler(ctx, params)` **没有** `tx`，且 `OperationDef` 所在文件由 lint 禁止 import 任何 `MutationDef`（`operation-has-no-tx`）。
- `Mutation` 对象本身没有 `execute` 方法，也没有 `undo` 字段；`MutationDef.schema` 是 `strictObject`，出现 `undo`/`inverse` 键即校验失败（ADR-0007 的机械化）。
- 只有 `Transaction.mutate` 能应用 Mutation；`Transaction` 只在 `store.transact` 回调内存在，而 `store.transact` 只由 `commands` 服务的管线调用（`store.transact` 在生产代码中的调用点由扫描器限定为 `model-core/command/pipeline.ts` 一处，ADR-0015）。

---

## 2. 定义类型（草案）

```ts
interface CommandDef<P = unknown, R = void> {
  readonly type: 'command'
  readonly id: `${string}.${string}`                       // 'slide.insertShape'、'core.export'
  readonly documentType?: string                            // 省略 = 应用级或类型盲命令
  readonly schema: StandardSchemaV1<unknown, P>            // 参数（parse, don't validate）
  readonly permission: readonly Capability[]               // **必填、非空、AND 语义**（全部能力位满足才放行；rulings §4.2 Q-T8；PRD CO-05：未声明即拒绝；lint `command-declares-capability`）；只读命令显式 `['doc.read']`；词汇来自 protocol：'doc.read' | 'doc.comment' | 'doc.write' | 'doc.export' | 'doc.manage' | 'history.read' | 'history.restore' | `${string}:${string}.${string}`（第三方 `<vendor>:<域>.<action>`，章程 D15）；需按参数细化资源时用 `MutationDef.permission?(m)`（Mutation 级）
  readonly undoable?: boolean                               // 默认 true；false = 事务不入历史（如「保存」）
  readonly label?: I18nKey                                  // 历史条目显示名
  handler(ctx: Context /* UnitScope ctx 或 root ctx */, params: P, tx: Transaction): Promise<R> | R
}
interface OperationDef<P = unknown> {
  readonly type: 'operation'
  readonly id: `${string}.${string}`
  readonly documentType?: string
  readonly schema: StandardSchemaV1<unknown, P>
  readonly permission?: readonly Capability[]               // 默认 ['doc.read']（AND 语义同上）
  readonly broadcast?: boolean                              // true = 变化作为 presence 广播（06）
  handler(ctx: Context, params: P): Promise<void> | void     // 无 tx
}
interface MutationDef<M extends Mutation = Mutation> {
  readonly type: M['type']                                  // 'slide.shape.insert'
  readonly documentType: string
  readonly schema: StandardSchemaV1<unknown, M>            // strictObject
  lower(mutation: M, view: ReadonlyStoreView): Result<readonly StoreOp[], LowerError>   // 纯函数；可读当前状态以计算索引
  permission?(mutation: M): PermissionRequest['action'] | { action; resource }            // 默认继承命令的 action
  describe(mutation: M): string                             // 审计文本
}
interface Mutation { readonly type: `${string}.${string}.${string}`; readonly unitId: UnitId }
```

`ReadonlyStoreView` = `{ state(): Persisted<S>; get(path) }`（无写方法）。

---

## 3. 执行管线（waterfall 阶段）

```
 commands.execute(unitId, id, params, opts)
   │
   ├─ ① resolve      contributions(core.command).get(id)  → 缺 → err(COMMAND_NOT_FOUND)
   │                  unitId != null → units.get(unitId)   → 缺 → err(UNIT_NOT_FOUND)；documentType 不匹配 → err(COMMAND_NOT_APPLICABLE)
   ├─ ② validate     def.schema.parse(params)             → 失败 → err(INVALID_PARAMS, issues)
   │
   ├─ ③ waterfall 'command/execute'(request, next)        ← **唯一拦截链**（A8/A30）
   │     ├─ [prepend] permission-gate：permissions.check({ principal, unitId, action: def.permission }) → deny → err(PERMISSION_DENIED)（fail-closed；不调用 next）
   │     ├─ telemetry：span 计时（调用 next）
   │     ├─ …第三方 waterfall 监听器（必须 next()，否则视为否决并被审计记录为 VETOED）
   │     └─ [内建最内层 next] ④
   │
   ├─ ④ transact     Operation：直接 handler(ctx, params)；跳到 ⑦
   │                  Command：store.transact(tx => handler(ctx, params, tx), { origin: local(clientId), label: def.id, undoable })
   │                    tx.mutate(m)：
   │                       a. contributions(core.mutation).get(m.type) → 缺 → MUTATION_UNKNOWN
   │                       b. def.schema.parse(m) → 失败 → MUTATION_INVALID
   │                       c. permissions.check(mutationDef.permission?.(m) ?? 命令 action) → deny → PERMISSION_DENIED（Mutation 级二次检查，D12）
   │                       d. ops = lower(m, view) → 失败 → LOWER_FAILED
   │                       e. store 应用 ops，记录 inverse（Provider 内部）
   │                    handler 抛错 / 任一 mutate 失败且 handler 未处理 → 整个事务回滚 → err(HANDLER_FAILED | MUTATION_REJECTED)
   │
   ├─ ⑤ history      undoable → history.push(record)（策略层可能与上一条合并）
   ├─ ⑥ events       store 已 emit 'store/transaction'(changeSet)；此处 emit 'command/executed'(unitId, id, params, result)
   └─ ⑦ audit        最外层 waterfall 监听器（append）：构造 AuditRecord{ principal, unitId, commandId, mutationTypes, result, at } → emit 'command/audited'
                     失败路径：①–③ 阶段拒绝 → emit 'command/rejected'(unitId, id, reason ∈ not-found|validation|permission|readonly)（不 errors.report，只遥测计数）；④ 阶段失败/回滚 → emit 'command/failed'(unitId, id, error) + errors.report
```

### 3.1 请求与结果类型

```ts
interface CommandRequest<P> { unitId: UnitId | null; id: string; params: P; principal: Principal; origin: Origin; meta?: JsonObject; signal?: AbortSignal }
type CommandResult<R> = Result<{ value: R; transaction?: TransactionRecord }, CommandError>
interface CommandError extends CordexError { code: 'command.not_found' | 'command.unit_not_found' | 'command.not_applicable' | 'command.invalid_params' | 'command.permission_denied' | 'command.vetoed' | 'command.handler_failed' | 'command.mutation_rejected' | 'command.store_unavailable' }
// 点式错误码（10 §1.1、rulings §4.3）；本文管线图与正文中的大写名（COMMAND_NOT_FOUND 等）是 `defineErrors('command', …)` 生成表的源码标识符，运行时字符串即上述点式码
```

### 3.2 `commands` 服务（草案）

```ts
interface CommandsService {
  execute<P, R>(unitId: UnitId | null, id: string, params: P, opts?: { signal?: AbortSignal; meta?: JsonObject }): Promise<CommandResult<R>>
  has(id: string): boolean
  describe(id: string): CommandDescriptor | undefined     // id/documentType/permission/undoable/label（UI 用）
  observe(listener: (e: CommandExecution) => void): () => void
}
```

`unitId` 显式传入（A-6）：应用级命令（打开文件、切换主题）传 `null`；单元命令传 id，管线用 `units.get(unitId).ctx` 作为 handler 的 `ctx`，使 `ctx.store/history/selection/render` 解析到该 Unit。

### 3.3 为什么只有一条拦截链

Univer 有 7 套事件机制与 6 个语义重叠的 `intercept*`（A8），渲染热路径穿过 ~20 个拦截器（A30）。这里：`waterfall 'command/execute'` 是全系统**唯一**的环绕式拦截点；Store 层无拦截；渲染层无拦截（查表）。监听器不调用 `next()` 即否决（cordis 语义），审计会记录 `VETOED` 与监听器所属 Fiber 名——「忘了 next」会在测试与日志中立刻暴露（指南 §46）。

---

## 4. Mutation 类型化与降级（ADR-0013）

### 4.1 判别联合按文档类型贡献

```ts
// model-slide/mutations/shape.ts（草案）
type SlideMutation =
  | { type: 'slide.shape.insert'; unitId; shape: Shape /* 含 containerId、parentId、order: FracKey */ }
  | { type: 'slide.shape.remove'; unitId; shapeIds: readonly ShapeId[] }
  | { type: 'slide.shape.setOrder'; unitId; shapeId; order: FracKey; parentId?: ShapeId | null }     // z 序移动 / 进出组：单键写入
  | { type: 'slide.shape.setTransform'; unitId; shapeId; transform: Transform }
  | { type: 'slide.shape.setProperties'; unitId; shapeId; patch: Partial<ShapeProperties> }
  | { type: 'slide.text.applyDelta'; unitId; shapeId; paragraph?: number; delta: TextDelta }
  | { type: 'slide.slide.insert'; unitId; slide: Slide /* 含 order */; shapes: readonly Shape[] }
  | { type: 'slide.slide.setOrder'; unitId; slideId; order: FracKey }
  | …
// 载荷中**没有** index/toIndex（06 I4、ADR-0032）：命令层用 `between(prev?.order, next?.order)`（`@cordexjs/shared/order`）把「插到 X 之后」变成具体 order 键；lower() 因而保持纯且确定。
```

- 每个成员一个 `MutationDef`，贡献到 `core.mutation`；`type` 三段式 `<documentType>.<entity>.<verb>`（扫描器校验命名）。
- 第三方插件可贡献新 Mutation（如 `slide-comments.thread.add`），无需改 `model-slide`。
- 水平层对联合无知：`commands` 只按 `m.type` 查表。

### 4.2 `lower()` 的规则

- **纯函数**：只读 `view`，不读服务、不读时间、不生成随机 id（id 必须在 Command 中生成并放入 Mutation，保证 Mutation 可回放）。
- 输出 `StoreOp[]`，路径基于归一化实体表：`shape.insert` → 一条 `set(['shapes', id], shape)`（形状自带 `containerId`/`parentId`/`order`）；`shape.setOrder` → `set(['shapes', id, 'order'], key)`（+ 可选 `set([..., 'parentId'], p)`）；`slide.setOrder` → `set(['slides', id, 'order'], key)`。没有数组下标操作（ADR-0013）。
- 失败可传播：容器不存在、索引越界 → `Result.err(LowerError)`，事务回滚。
- 测试：property test「任意合法 Mutation 序列 → body 仍满足 `bodySchema`」；每个 `lower` 有确定性快照测试。

### 4.3 为什么不让 Store 直接理解 Mutation

若 `store-yjs` 要为每种 Mutation 写一份 Y 操作，文档类型知识就进了水平层（A1），且新 Mutation 需改 Store。五种原语让 Store 永远不变（12 §3 的证明）。

---

## 5. 逆操作由 Store 推导（ADR-0007；Univer 缺陷 #3 的反制）

| 原语 | 逆 | 推导时机 |
|---|---|---|
| `set(path, v)` | 原键存在 → `set(path, old)`；不存在 → `delete(path)` | 应用前读旧值 |
| `delete(path)` | `set(path, old)` | 同上 |
| `insert(path, i, items)` | `remove(path, i, items.length)` | 直接 |
| `remove(path, i, n)` | `insert(path, i, removedItems)` | 应用前读被删项 |
| `text(path, delta)` | `invert(delta, oldText)` | 应用前读旧文本 |
| （移动）`set([..., 'order'], key)` | `set([..., 'order'], oldKey)` | 移动只是 `set`：并发下 LWW，无重复无丢失（ADR-0032） |

- `store-memory`：`apply-op.ts` 返回 `{ next, inverse }`；`TransactionRecord.inverse` = 逆序拼接。
- `store-yjs`：由 `Y.UndoManager` 在 CRDT 层完成（不需要 inverse ops），但 `TransactionRecord.inverse` 仍由 `apply-op` 计算并保留用于审计/回放的一致性（契约套件只断言撤销后状态，不断言 inverse 数组内容）。
- 机械验证：lint `no-inverse-in-mutation`（Mutation 类型/Def 中禁止 `undo|inverse|revert` 字段与方法）；`runDocumentStoreConformance`：`transact` 后 `undo` 深等于事务前 `state()`；property：`apply(inverse(apply(s, op))) ≡ s`。

为什么不像 Univer：Univer 为每个 Mutation 手写 `undoMutations`，2,244 处 `return false` 使失败原因不可见。这里逆操作零手写、失败为类型化 `Result`。

---

## 6. 协同下的撤销（按 origin 只撤本地）

- 每个客户端的 `Origin = local(clientId)`；远端更新到达时以 `remote` origin 应用（store-yjs：Y.Doc 的远端 update；store-memory 在协同模式下不使用）。
- `history.undo()` → `store.undo(local(clientId))`：只撤本地事务；`store-yjs` 的 `UndoManager.trackedOrigins = {localOrigin}`；`store-memory` 的历史栈按 origin 过滤。
- **协同撤销语义（rulings §4.15 Q3，不跟随 CRDT 库默认）**：写入 `DocumentStore` 契约的中性字段 `undo.remoteConflict: 'skip'`（字段名与 CRDT 无关），store-yjs 与 store-memory 同语义，由 `runDocumentStoreConformance`「中性撤销语义」分节（用例名以 40-modules/02 §2.5 为准：`remote-conflict-skip`、`undo-skip-no-cascade`、`soft-delete-tombstone`、`delete-vs-edit-undo`、`read-path-filters-tombstone`）验收：
  1. **同一键被他人后写 → 跳过并提示**：撤销单元中某个 `set` 的目标键在本地事务之后已被远端写过，该键**不回退**（不覆盖他人）；其余未被他人触碰的键照常回退。被跳过的键经事件 `store/undo-skipped(unitId, { skipped: UndoSkip[], wholeStep })` 报告（载荷以 40-modules/02 §2.4 为准；该事件**单独统计**跳过次数与整步跳过次数，不计入 `collab/soft-conflict` 软冲突率，rulings §4.17 D5），UI 以提示条告知，并提供「恢复我的值」——这是一个**新的本地事务**（重新写回本地旧值，进入历史栈），不是撤销的延续。
  2. **整步被跳过 → 停下不连撤**：若一个撤销单元的全部键都被跳过（实际无任何回退），本次 `history.undo()` 返回 `ok({ applied: false, skipped })` 并停止，**不**继续撤销更早的一步（Yjs 默认会「连撤两步」，由 undo 包装层阻断）。
  3. **删除 = 软删除墓碑**：用户删除有身份实体写 `_deleted` 墓碑而非删键（04 §3.1a），删除方撤销 = 清除墓碑、同一 id 复活；与并发编辑不会产生重复元素。**撤销目标已被他人删除（墓碑 TTL 内亦然）→ 跳过并提示，不看 TTL**：撤销永不复活他人删除的元素，恢复由删除方撤销或「恢复元素」（新事务）完成（rulings §4.17 D4）。墓碑 TTL（默认 24 h）后硬删除；文档擦除与「立即彻底删除」不等 TTL。
  4. 文本 `text` op 的撤销按 CRDT 字符级语义回退本地插入/删除，远端插入保留（字符级无「同键」概念，不触发跳过）。
  - U-07 版本恢复撤销（version-restore-undo）以本语义为基线，不采用「revertTo 整体回滚」式实现（它绕过 D4）。
- `history` 策略层：
  - 合并（coalesce）：同 `label`、同 origin、间隔 < `coalesceMs`（默认 500ms）的连续文本事务合并为一个撤销单元；
  - 分组：`history.beginGroup(label) … endGroup()` 把多个命令并成一个撤销单元（如拖拽过程）；
  - 容量：默认 200 条；淘汰有测试；
  - 事件 `history/changed(unitId, { canUndo, canRedo, depth })` 驱动 UI 上下文键。
- `undoable: false` 的命令（导出、保存）不入栈。

---

## 7. Operation 与 presence

- Operation 只改视图服务；`selection.set()` 触发 `selection/changed`；`broadcast: true` 的 Operation 的效果由 `presence` 服务序列化广播（`Selection.serialize`），细节见 06。
- Operation 也走 `commands.execute`（同一入口、同一权限门、同一审计；ADR-0015），但跳过 ④ 的事务与 ⑤ 历史。
- 远端 presence 不产生 Operation：它直接更新 `presence` 服务状态（不是本地视图状态）。

---

## 8. 批量与事务边界

| 场景 | 做法 |
|---|---|
| 一个用户动作触发多个 Mutation | 一个 Command、一个 `tx`、多次 `tx.mutate` → 一个撤销单元 |
| 一个用户动作由多个命令组成（拖拽：连续 setTransform） | `history.beginGroup()`；或以一个 `slide.moveShapes` 命令收口（首选） |
| 命令调用命令 | 允许：`ctx.commands.execute(...)` 在 handler 内调用会开启**新事务**（嵌套事务被 Store 拒绝 `STORE_NESTED_TRANSACTION`）；因此复合命令应当直接 `tx.mutate`，而不是递归执行子命令（lint 提示 `no-nested-execute-in-handler`，warning 级→M2 起 error） |
| 导入/迁移写入 | `origin = system(...)`，`undoable: false`，不经命令管线（唯一例外，且只在 `units.open` 内部；扫描器允许列表） |
| 跨 Unit 命令 | 不支持（每个命令绑定一个 unitId 或 null）；复制粘贴分两条命令 |
| 新增元素触及规模上限（rulings §4.15 Q5） | 命令守卫在 ③ 之后、④ 之前检查 `maxElementsPerDoc`（默认 20,000，软警告 15,000，墓碑计入）与单页 1,000、页数 200：超限 → `command/rejected{ reason: 'validation' }` + `document.quota_exceeded{ dimension, limit, actual }`（编辑期上限码，409、不关连接，`dimension` 取值见 10 §1.4，rulings §4.17 D2），不开事务；数字来自部署配置（04 §5.5） |

---

## 9. 失败原因可传播

- 所有入口返回 `Result<T, CordexError>`（`shared/result.ts`）；禁止 `boolean` 结果（lint `no-boolean-command-result`：`CommandDef.handler` 返回类型不得为 `boolean`；`commands.execute` 调用处不得用 `if (!ok)` 模式——以类型 `Result` 强制解构）。
- 每个失败码都有 `data`（issues、mutationType、fiber 名），`errors.report` 统一上报（PERMISSION_DENIED 只发 `permission/denied` 事件与遥测计数，不作为错误上报，避免噪音）。
- UI 层 `useCommand(id)` 返回 `{ run, lastError }`，通知组件把错误码映射为 i18n 文案（`i18n` key = 错误码）。
- 审计记录含 `result: 'ok' | code`。

---

## 10. 事件清单（本文相关）

| 事件 | 模式 | 载荷 | 发出者 |
|---|---|---|---|
| `command/execute` | waterfall | `(request, next) → Promise<CommandResult>` | `commands` |
| `command/executed` | emit | `(unitId, id, params, result)` | `commands` |
| `command/rejected` | emit | `(unitId, id, reason)`（管线 ①–③ 拒绝：not-found / validation / permission / readonly） | `commands` |
| `command/failed` | emit | `(unitId, id, error)`（④ 阶段 handler/事务失败并回滚） | `commands` |
| `command/audited` | emit | `(record: AuditRecord)` | `commands`（audit 监听器） |
| `store/transaction` | emit | `(unitId, changeSet)` | `store` Provider |
| `store/loaded` | emit | `(unitId)` | `store` Provider |
| `history/changed` | emit | `(unitId, { canUndo; canRedo; depth })` | `history` |
| `store/undo-skipped` | emit | `(unitId, { skipped: UndoSkip[]; wholeStep: boolean })`（以 40-modules/02 §2.4 为准；单独统计、不计入软冲突率，rulings §4.17 D5）（撤销时同键已被他人后写而跳过；`wholeStep` 表示整步被跳过并已停止，§6） | `store` Provider（undo 包装层） |
| `selection/changed` | emit | `(unitId, selection)` | `selection` |
| `view/mode-changed` | emit | `(unitId, mode, prev)`（`view.setMode` Operation 之后；10 §11） | `ui`（view.setMode handler） |
| `permission/denied` | emit | `(request, decision)` | `permissions` |
| `permission/changed` | emit | `(unitId, { added: Capability[]; removed: Capability[] })`（本地策略变化或网关下发 `applyRemoteDecisions` 后；唯一发出者） | `permissions` |

全部在 `model-core.contribution.ts` 的 `Events` 增强中声明（扫描器 `events-declared`）。

---

## 11. 对运行时线（B）的契约要求

- 06：`store-yjs` 的 `transact` 必须把 `origin` 传给 `Y.Doc.transact`；`UndoManager` 只跟踪本地 origin；远端 update 应用后必须 emit `store/transaction`（origin=remote）以驱动渲染脏区；服务端网关拒绝的 update 如何回滚本地（06 决定，接口：`collab` 发 `collab/rejected(unitId, reason)` → `history` 可选回退）。
- 08：服务端 `import-export`、`migrate` 任务经 `server-headless` 调用命令管线（`principal = system`），权限策略为服务端策略；审计记录落库。
- 10：`command/audited`、`command/failed`、`permission/denied` 的落地（日志字段、遥测指标名）。
- 11：`command-harness` 与 `runDocumentStoreConformance` 的运行矩阵。

---

## 12. 机械验证清单

| 规则 | 机制 |
|---|---|
| Mutation 是唯一改 Store 的途径 | 扫描器：`store.transact(` 调用点仅 `model-core/command/pipeline.ts` 与 `unit-plugin.ts`（load）；`tx.mutate` 只在 `CommandDef.handler` 词法内 |
| Operation 不能改 Store | 类型：`OperationDef.handler` 无 `tx`；lint `operation-has-no-tx` |
| 无手写逆操作 | lint `no-inverse-in-mutation`；`MutationDef.schema` strictObject |
| 失败不用 boolean | lint `no-boolean-command-result` |
| 权限 fail-closed | `command-harness` 测试：无策略 → 全部 `PERMISSION_DENIED`；`denyAll` 覆盖 `allowAll` |
| waterfall 监听器忘记 next 会被发现 | 审计 `VETOED` 记录 + kernel `waterfall-contract.test.ts`（指南 §128） |
| 只撤本地 | 契约套件协同分节：两 store 同步后各自 undo 只回退自己的事务 |
| 不覆盖他人、整步跳过即停、删除可复活（§6，rulings §4.15 Q3） | 契约套件「中性撤销语义」分节用例（名称照抄 40-modules/02 §2.5）`remote-conflict-skip`、`undo-skip-no-cascade`、`soft-delete-tombstone`、`delete-vs-edit-undo`、`read-path-filters-tombstone`（store-memory 与 store-yjs 同一套）；40-modules/05 确定性用例 + fuzz |
| 事件先声明后使用 | 扫描器 `events-declared` |
| 命令 id / Mutation type 命名 | 扫描器 `command-id-format`（`<domain>.<name>`、`<docType>.<entity>.<verb>`） |
| 嵌套事务被拒 | 契约套件 `STORE_NESTED_TRANSACTION` |
| 命令必须声明能力位 | lint `command-declares-capability`；扫描器 `capabilities-in-protocol`（能力位字面量必须来自 protocol，或带 `<vendor>:` 前缀且 vendor 与声明包的 npm scope 一致，章程 D15） |
| Mutation 载荷无数组下标 | 扫描器 `no-index-in-mutation`（06 I4） |
| 权限变更单一发出者 | 扫描器：`emit('permission/changed'` 只允许出现在 `model-core/permission/permissions.service.ts` |
| 版式删除 fail-closed（§13.2） | `command-harness`：被引用版式 `deleteLayout` 无 `reassignTo` → `LAYOUT_IN_USE` 且无事务；带 `reassignTo` → 单事务、撤销一次恢复引用与版式 |
| `view.setMode` 文档类型盲 | 类型/运行时测试：`mode ∉ documentType.viewModes` → `INVALID_PARAMS`；`fixture` 类型只接受 `'normal'` |

---

## 13. 母版 / 版式 / 主题命令族（ML-01…ML-04；模型支撑与纯函数见 04 §12）

### 13.1 Mutation 族（`model-slide/mutations/{layout,master,theme}.ts` + `shape.ts` 扩展；三段式命名，载荷无下标）

| type | 载荷（草案） | `lower` 要点 |
|---|---|---|
| `slide.slide.setLayout` | `{ slideId; layoutId; remap: PlaceholderRemap[] }`（`remap` 由命令经 `planLayoutChange` 计算并**携带**，Mutation 保持确定性） | `set(['slides', id, 'layoutId'])`；对 `materialize` 项 `set(['shapes', sid, 'properties', 'transform'], …)` 等显式化 |
| `slide.shape.clearOverrides` | `{ shapeId; fields: InheritableField[] }` | 逐字段 `delete(['shapes', id, 'properties', field])`（重置 = 恢复继承） |
| `slide.master.setBackground` / `slide.layout.setBackground` | `{ id; background: Background \| null }` | `set/delete([..., 'commonSlide', 'background'])` |
| `slide.master.setTextStyle` | `{ masterId; kind: 'title' \| 'body' \| 'other'; level: 0..8; patch: Partial<ParagraphProperties> }` | `set(['masters', id, 'textStyles', kind, 'levels', level], merged)`（合并在 `lower` 内按当前视图计算，确定性） |
| `slide.layout.insert` / `slide.layout.remove` | `{ layout: SlideLayout /* 含 order、masterId */; shapes: Shape[] }` / `{ layoutId }`（前置：无页引用） | 实体表写入；remove 级联删除 `containerId == layoutId` 的形状（`lower` 读视图枚举） |
| `slide.layout.setName` / `setOrder` / `setProperties` | `{ layoutId; name }` / `{ layoutId; order: FracKey }` / `{ layoutId; patch: { showMasterShapes?; preserve?; userDrawn?; type? } }` | 单键 `set` |
| `slide.master.insert` / `remove` / `setOrder` / `setTheme` / `setProperties` | `{ master; layouts; shapes; theme? }` / `{ masterId }`（前置：无版式被页引用）/ `{ masterId; order }` / `{ masterId; themeId }` / `{ masterId; patch: { preserve?; colorMap?; headerFooter? } }` | 实体表写入；remove 级联版式与形状 |
| `slide.shape.setPlaceholder` | `{ shapeId; placeholder: PlaceholderRef \| null }` | `set/delete(['shapes', id, 'nonVisual', 'placeholder'])`；占位符**增删**复用 `slide.shape.insert/remove`（`containerId` = 版式/母版） |
| `slide.theme.insert` / `slide.theme.remove` | `{ theme }` / `{ themeId }`（前置：无母版引用） | 实体表写入 |
| `slide.theme.setColors` / `slide.theme.setFonts` | `{ themeId; colors: Partial<ColorScheme> }` / `{ themeId; fonts: Partial<FontScheme> }` | 逐槽位 `set(['themes', id, 'colorScheme', slot])`（12 槽位各自 LWW，不整体覆盖） |

### 13.2 Command 族（`model-slide/commands/{layout,master,theme}-commands.ts`；`permission: ['doc.write']`，集成方策略可按 `resource: { kind: 'master' \| 'layout' \| 'theme' }` 收紧）

| id | 语义 | 需求 |
|---|---|---|
| `slide.applyLayout` | `{ slideIds; layoutId }`：每页 `planLayoutChange` → `slide.slide.setLayout`；**一页一事务**（撤销粒度按页） | ML-02 |
| `slide.resetSlide` | `{ slideIds }`：`planReset` → `slide.shape.clearOverrides`（仅占位符形状） | ML-02 |
| `slide.setMasterBackground` / `slide.setLayoutBackground` | 母版视图中的背景编辑 | ML-03 |
| `slide.setMasterTextStyle` | `{ masterId; kind; level; patch }` | ML-03 |
| `slide.insertLayout` | `{ masterId; after?: LayoutId; type?; name? }`：从母版占位符生成新版式；`order` 经 `between` 计算 | ML-03 |
| `slide.duplicateLayout` | 复制版式与形状（新 `NodeId`；`ooxml` id 清空，导出分配） | ML-03 |
| `slide.deleteLayout` | `{ layoutId; reassignTo?: LayoutId }`：被引用且无 `reassignTo` → `err(LAYOUT_IN_USE)`；否则同一事务内先重指再删除（04 §12.3） | ML-03 |
| `slide.renameLayout` / `slide.reorderLayouts` | `{ layoutId; name }` / `{ layoutId; after?: LayoutId }` | ML-03 |
| `slide.addPlaceholder` / `slide.removePlaceholder` / `slide.updatePlaceholder` | `{ containerId: LayoutId \| MasterId; type; index?; box }` / `{ shapeId }` / `{ shapeId; placeholder?; transform?; bodyProperties? }`；母版占位符是版式占位符的继承源 | ML-03 |
| `slide.deleteMaster` / `slide.duplicateMaster` / `slide.insertMaster` | 删除前置：无版式被页引用（否则 `MASTER_IN_USE`，可带 `reassignTo`）；复制含版式、形状与主题引用 | ML-03 |
| `slide.setThemeColors` / `slide.setThemeFonts` | `{ themeId; … }` | ML-04 |
| `slide.applyTheme` | `{ masterId; theme: Theme \| ThemeId }`：新主题 → `theme.insert` + `master.setTheme`；旧主题无引用 → `theme.remove`（同一事务） | ML-04 |

### 13.3 视图态 Operation

| id | 载荷 | 说明 |
|---|---|---|
| `view.setMode`（**水平层**，定义在 ui-core，文档类型盲） | `{ unitId; mode: string }`；`mode` 必须 ∈ `DocumentType.viewModes`（slide：`'normal' \| 'master' \| 'presenter'`），否则 `INVALID_PARAMS` | 更新上下文键 `viewMode`；`render.setView({ mode })`；emit `view/mode-changed`；不入历史；`broadcast: true`（presence 可显示「正在编辑母版」） |
| `slide.selectMasterOrLayout`（**垂直束**；即总编排所称 `view.selectMasterOrLayout`——载荷含 slide 专有的 `MasterId \| LayoutId`，故落在 `slide` 域） | `{ unitId; targetId: MasterId \| LayoutId }` | 母版视图中的当前编辑目标；上下文键 `editTargetKind ∈ slide \| layout \| master`；`render.setView({ mode: 'master', target })`；选区切换到该容器 |

### 13.4 协同下的撤销与冲突语义要点（详见 06 §8，B 线）

- 母版/版式/主题都是实体表条目：编辑 = 单键 LWW；撤销按 origin 只撤本地，且遵循 §6 的跳过/停止语义；撤销母版编辑会使全部依赖页重绘（`dependentsOf` → 渲染脏映射）。
- 冲突面（06 需覆盖）：(1) **删除 vs 引用**：A 删版式（写墓碑）、B 同时应用该版式 → 合并后引用指向墓碑 → 不变量 I-ML2 修复（04 §12.3）+ `collab/soft-conflict{ type: 'delete-vs-reference' }`；A 撤销删除 = 清除墓碑，B 的引用重新有效；(2) **重置 vs 移动**：A `clearOverrides(transform)` 与 B `setTransform` 并发 → 同键 LWW，后写者胜；先写者撤销时该键已被他人后写 → **跳过并提示**（§6 第 1 条，可选「恢复我的值」新事务），后写者撤销则正常回退自己的写入；若先写者的撤销单元只含这一键 → 整步被跳过、停下不连撤（§6 第 2 条）；(3) **主题槽位**：`colorScheme.*` 逐槽位 LWW；(4) **版式复制 vs 母版删除**：新版式 `masterId` 指向被删母版 → I-ML3 修复。
- 母版视图是**视图态**（Operation），不锁内容；可选软锁（PRD PD-19，awareness 级）由 06 定。
- 事务边界：`applyLayout` 一页一事务；`deleteLayout(reassignTo)`、`applyTheme` 各为一个原子事务（重指/换主题 + 删除不可分）。
