# ADR-0015 单一执行入口：Command 与 Operation 都经 `commands.execute`；Mutation 不可外部执行

> 状态：草稿 | 负责：架构-结构 | 更新：2026-09-14 | 依赖：charter v0.1

## 状态

提议。

## 背景

Univer 的 `commandService.executeCommand` 可执行 Command、Mutation、Operation 三种，导致：协同回放的远端 Mutation 也要过权限（于是加旗标绕过，`IExecutionOptions` 含闭源标志，A13）；UI 直接执行 Mutation 绕过命令语义；权限检查点不唯一。D4/D12 要求 Mutation 是唯一改 Store 的途径且权限在管线检查。

## 决策

1. **一个入口**：`commands.execute(unitId, id, params)` 接受 `CommandDef` 与 `OperationDef`（同一贡献点 `core.command`，`type` 判别）。Operation 走同一 resolve/validate/permission/audit，跳过事务与历史。
2. **Mutation 不可执行**：没有 `executeMutation`；Mutation 只能由 `Transaction.mutate` 在命令事务内应用；`Transaction` 只存在于 `store.transact` 回调，而 `store.transact` 的生产调用点被扫描器限定为 `model-core/command/pipeline.ts`（命令）与 `model-core/unit/unit-plugin.ts`（`load`，origin=system）。
3. **远端变更不是 Mutation**：协同远端更新以 CRDT update 进入 Store（origin=remote），不经命令管线，也不需要绕过权限（网关已授权，ADR-0012）。因此不存在「回放旗标」。
4. **只读查看器的双保险**：`preset-slide-viewer` 不加载 `@cordexjs/model-slide/editing`（命令与变更贡献缺席 → `COMMAND_NOT_FOUND`），并加入 `readOnly` 权限策略（即使加载了编辑命令也 `PERMISSION_DENIED`）。
5. **执行选项只含公开语义**：`{ signal?: AbortSignal; meta?: JsonObject }`；没有 `skipPermission`/`fromCollab` 之类旗标（A13）。
6. **命令调用命令**：允许但开启新事务（嵌套事务被 Store 拒绝）；复合命令应直接 `tx.mutate`（lint 提示）。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 三种都可执行（Univer） | 权限绕过旗标、UI 直改模型、审计不完整 |
| Command 与 Operation 分两个服务 | 两套校验/权限/审计代码；UI 需区分调用哪个 |
| 允许插件直接调用 `store.transact` | 绕过权限与审计；Univer「一切修改走命令」的正确部分被破坏 |
| 远端 update 也包装为 Mutation 过管线 | 需要绕过权限的旗标；CRDT 已保证收敛，重复语义 |

## 后果

- 正：权限/审计/遥测有且只有一条路径；Mutation 无法被绕过；查看器只读有两道机械保证。
- 负：所有修改都要写成 Command（哪怕一行）；`store.transact` 的调用点白名单需维护（很短）。

## 如何被机械验证

- 扫描器 `store-transact-callsites`：`\.transact\(` 在生产代码中仅允许两处。
- 扫描器 `no-execution-flags`：`commands.execute` 的 opts 类型不得新增键（api-extractor 基线 + 类型测试）。
- `preset-slide-viewer/__tests__/readonly.test.ts`：执行 `slide.insertShape` → `COMMAND_NOT_FOUND`；强行 override 加载 editing 后 → `PERMISSION_DENIED`。
- `command-harness`：Operation 不产生 `store/transaction`、不入历史、经过权限门。
- lint `operation-has-no-tx`。

## 关联

章程 D4、D12；Univer K1、A13；05 §1、§3、§8；ADR-0012；PRD OF-14。
