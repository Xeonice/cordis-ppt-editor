# ADR-0012 权限 fail-closed 的放置：命令管线（含 Mutation 级）+ 服务端网关

> 状态：草稿 | 负责：架构-结构 | 更新：2026-09-15 | 依赖：charter v0.1

## 状态

提议。

## 背景

章程 D12：fail-closed，无显式允许即拒绝；检查点在 `commands` 执行管线与服务端网关两处。Univer 的权限是 C 级项：检查分散在 UI、命令、协同各处且默认放行。PRD：命令声明所需能力位，未声明即拒绝（CO-05）；权限变更传播 ≤ 2 s（CO-05）；角色 `viewer/commenter/editor/owner` 是能力位的预设组合；`permission/changed`、`permission/denied` 是公开事件。

## 决策

1. **能力位词汇在 `protocol`**（`permissions/actions.ts`，字面量联合，禁 enum）；角色 → 能力位集合的映射也在 `protocol`（服务端与客户端共用一份）。词汇采用 PRD 的形式：`doc.read` / `doc.comment` / `doc.write` / `doc.export` / `doc.manage` / `history.read` / `history.restore` …（第三方按章程 D15 扩展为 `<vendor>:<域>.<action>`，vendor = npm scope 去 `@`）。
2. **命令必须声明能力位**：`CommandDef.permission: readonly Capability[]` **必填、非空、AND 语义**（全部满足才放行；rulings §4.2 Q-T8）；`OperationDef` 默认 `['doc.read']`（可覆盖）；按参数细化到资源的检查放在 `MutationDef.permission?(m)`；lint `command-declares-capability` + manifest 记录 `permissions`（PS-01）。
3. **检查点 ①：命令管线**（客户端与 `server-headless` 共用）：`waterfall 'command/execute'` 的 prepend 监听器 `permissions.check({ principal, unitId, action })`；**Mutation 级二次检查**在 `tx.mutate` 内（`MutationDef.permission?(m)` 可细化到资源，如「只能改自己的评论」）。deny → `PERMISSION_DENIED`（不调用 `next`）。
4. **检查点 ②：服务端网关**（08/ADR-0029）：REST guard（Nest）与 WS 房间（join / 每个 update / awareness）按同一能力位词汇判定；网关是**最终权威**——客户端检查只是快速失败与 UX。
5. **不在 Store 检查**：Store 文档类型盲且接收远端 CRDT update（已由网关授权）；在 Store 层无法区分「本地未授权」与「远端已授权」。
6. **决策合成**：`PermissionsService.check`：任一策略 `deny` → deny；无任一 `allow` → deny；否则 allow。策略经 `core.permissionPolicy` 贡献；**零策略 = 全部拒绝**（这就是 fail-closed 的机械形式；`preset-*` 显式加入 `allowAll`/角色策略，查看器 preset 加入 `readOnly` 策略）。
7. **远端权限变更**：网关下发（06 帧 `permission-changed`）→ collab 层调用 `permissions.applyRemoteDecisions(unitId, decisions)` → 服务更新快照并 **emit `permission/changed(unitId, { added, removed })`**；下一次 `commands.execute` 即生效；UI 上下文键 `isReadOnly` 等据此刷新。事件名统一为 `permission/changed`（不再有 `collab/permission-changed`，见 README §7）。传播预算 ≤ 2 s 由 06 的遥测 `propagationMs` 度量。
8. **UI 只做提示不做决定**：按钮禁用来自 `permissions.check` 的同一结果（`when` 子句上下文键），不另写逻辑。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 只在 UI 层禁用按钮 | 可绕过（API/插件/快捷键）；Univer 教训 |
| 在 Store `transact` 检查 | 拒绝远端 update；Store 需要认识 principal 与文档语义 |
| 默认允许、显式拒绝（fail-open） | 违反 D12；新增命令忘记声明即放行 |
| 服务端唯一检查点（客户端不查） | 每次操作往返；离线不可用；UX 差 |
| 能力位定义在 model-core | 服务端不依赖 model-core（LS 依赖上限）；协议词汇属 protocol |

## 后果

- 正：一套词汇、两处检查、一个事件；新增命令必声明；查看器 preset 天然只读（无编辑命令 + readOnly 策略双保险，ADR-0015）。
- 负：命令作者多写一行 `permission`；细粒度资源权限需要 Mutation 级函数（可选）。

## 如何被机械验证

- lint `command-declares-capability`；扫描器 `capabilities-in-protocol`（命令/Mutation 引用的能力位必须来自 `protocol` 字面量集合，或带 `<vendor>:` 前缀且与声明包的 npm scope 机械对应，章程 D15）。
- `command-harness`：零策略 → 全部 `PERMISSION_DENIED`；`denyAll` 覆盖 `allowAll`；Mutation 级拒绝回滚整个事务。
- model-core `__tests__/permissions.test.ts`：`applyRemoteDecisions` 后 `permission/changed` 恰发一次且随后命令被拒。
- 服务端 e2e（08/11）：viewer token 的 WS update 被拒 + `permission/denied{surface:'ws'}`；权限降级 ≤ 2 s 内客户端命令被拒。

## 关联

章程 D12、§5.4；PRD CO-05、EM-05、07 术语「能力位/角色」；05 §3；06 §权限；ADR-0029（B）；ADR-0015。
