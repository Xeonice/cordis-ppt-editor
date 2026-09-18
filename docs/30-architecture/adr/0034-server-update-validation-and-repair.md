> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-14 | 依赖：charter v0.1

# ADR-0034 服务端对 update 的校验：硬门禁拒绝 + 软门禁补偿修复（不回滚、不分叉）

## 状态

提议。

## 背景

CRDT update 是不透明二进制；服务端无法在应用前知道其语义。数据层不能信任任意客户端（schema/不变量是渲染与导出的前提），但 CRDT 又要求所有端收敛：单点「拒绝并回滚」会造成分叉。

## 决策

1. **硬门禁（应用前，O(1)/O(帧)）**：信封/zod/大小/速率（L1）、角色与锁定（L2）、`decodeUpdateV2` 可解析与结构数上限（L3）。失败 → 不广播不落库，返回错误或关闭（06 §11）。
2. **软门禁（应用后）**：在服务端 Unit 上 `applyUpdate` → `ChangeSet.paths` → `documentType.validateChangeSet(paths)`（zod schema，A 线 04）+ 不变量检查（无父子环、`parentId` 存在、`layoutId` 存在、`order` 合法、`schemaVersion`/`epoch` 未改、id 与键一致）。违规 → **RepairPlanner** 生成补偿 Mutation 事务（origin `repair`），本地应用并广播；同时向来源 session 发 `CONTROL.repair{reason, paths}`，计数；同一 session 10 分钟 ≥ 5 次 → 4409 隔离。
3. 修复规则是**确定性纯函数**（输入：当前状态 + 违规路径 → 输出：Mutation 列表），客户端 observe 时对「环/孤儿」两类也执行同一规则（结果一致，因为规则与输入相同）；其他规则只在服务端执行。
4. 硬门禁失败与软门禁修复都进入 `audit_log`（`collab.update_rejected` / `collab.repaired`）与指标。
5. 校验成本预算：软门禁 ≤ 5 ms p95/update（只校验变更路径，不全量）。

## 修复规则表（初版）

| 违规 | 修复 |
|---|---|
| 父子环 | 环上 id 字典序最大者 `parentId=null` |
| `parentId` 指向不存在的形状 | `parentId=null` |
| `layoutId` 不存在 | 置为该 master 的第一个 layout；若无 master → 文档首个 layout |
| `order` 非法字串 | 重新生成为集合末尾键 |
| `meta.schemaVersion`/`epoch` 被改 | 写回服务端已知值 |
| 实体 `id` 键与内部 `id` 不一致 | 内部 `id` 写回键值 |
| schema 类型错误（如 `xfrm.off.x` 非数字） | 恢复为该键上一个合法值（服务端 Unit 保存的前值）或删除该键（可选属性） |

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 拒绝并断开（不广播） | 客户端本地已应用，且可能已通过其他路径（离线合并后的 step2）传播 → 分叉 |
| 完全信任客户端 | 渲染/导出代码会因非法数据崩溃或产出坏文件 |
| OT 风格服务端变换/重写 update | 需要解析并改写 Yjs 结构，脆弱且与 CRDT 语义冲突 |
| 只在客户端校验 | 恶意/有 bug 的客户端绕过 |
| 全量校验每次 update | O(文档) 成本；改为按变更路径 |

## 后果

正面：全网收敛且数据合法；恶意/故障客户端可被隔离；修复可审计。

负面 / 代价：被修复的用户会看到自己的操作被「纠正」（低频；UI 提示）；服务端需要持有模型（Unit）→ 内存成本（06 §14 预算 40 MB/房间）；修复规则需与 A 线 schema 同步演进（放在 model-slide，服务端只调用）。

## 补充（v0.2）：与 PRD CO-12 的分歧、可配置模式、路径级权限规则

- **分歧**：PRD CO-12 写「服务端对每条 update 做权限校验，不做内容语义校验；恶意 update 导致的模型异常由客户端『解码失败即忽略并上报』处理」。本 ADR 的反对理由：(1) CRDT update 一旦被服务端应用并扇出，非法结构就永久存在于所有副本中，客户端「忽略」无法把它从他人的文档里移除；(2) 服务端自身（导出、缩略图、迁移作业）也消费该模型，会因非法数据失败；(3) 评论的作者级规则（ADR-0031 v0.2）与 commenter 的路径限制只能在服务端执行。因此**保留软门禁**，但降低推行成本：
- **配置 `softGate.mode`**：`repair`（默认，M3）——执行不变量与权限路径修复；`report-only`——只校验并计数/告警不修复；`off`。`softGate.schemaMode` 单独控制 zod 类型校验（M3 默认 `report-only`，避免 schema 演进期误修复）。**待总编排裁决（06 P8）**。
- **新增修复规则（路径级权限）**：

| 违规 | 修复 |
|---|---|
| `commenter` 的 update 触及 `resources.comments.*` 以外路径 | 用 Y 事件携带的旧值还原（`Y.Map` 事件 `changes.keys[k].oldValue`；`Y.Text` 反向 delta）；计数 |
| 回复/线程实体的 `authorId ≠ session.userId`（创建或修改他人评论） | 还原/删除该实体（owner 除外）；计数 |
| 触及 `meta.*`（`schemaVersion`/`epoch`）或 `resources.<其他插件命名空间>` 而无相应能力位（`caps[]`） | 还原旧值；计数 |

- 修复事务 origin = `system('repair')`（06 §18.2 对 A 线的 `Origin` 增补）；`CONTROL.repair` 与审计不变。

## 如何被机械验证

- 单测（server-collab gate）：每条硬门禁有拒绝用例且无广播；每条修复规则有输入/输出黄金用例；隔离阈值。
- collab-sim 变体：注入 5% 非法 update，所有端最终一致且合法。
- 性能：软门禁 p95 ≤ 5 ms（bench）。
- 审计：修复/拒绝事件出现在 `audit_log`（集成）。

## 关联

章程 D12、D7（不透明保留不受修复影响：Opaque 只校验为字串）；ADR-0020/0032；架构 06 §11、08 §3.1。
