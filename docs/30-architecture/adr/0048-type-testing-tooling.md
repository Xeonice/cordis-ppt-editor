> 状态：草稿 | 负责：架构-类型治理 | 更新：2026-09-14；2026-09-25（矛盾收口，rulings §4.18） | 依赖：charter v0.1

# ADR-0048：类型测试工具选型

## 状态

提议中（M0 蓝图阶段）。

## 背景

本方案多处依赖"类型测试"（断言某段代码**应该**编译通过、某段代码**应该**编译失败）作为机械验证手段：[09§6](../09-type-discipline/09-plugin-type-contracts.md#6-类型测试的组织方式) 的贡献点/Manifest 类型契约测试、[09§7](../09-type-discipline/09-plugin-type-contracts.md#7-provider-一致性套件的类型接口) 的 Provider 契约套件（`run<Definition>Conformance`）的类型断言部分、[lessons A14](../../00-charter/reference-univer-lessons.md)（幽灵泛型）相关的反例测试。社区常见方案有三类：独立工具 `tsd`（基于注释指令 `// $ExpectType`）、独立库 `expect-type`（`expectTypeOf` API，不依赖特定测试运行器）、以及 Vitest 内建的类型测试能力（同样提供 `expectTypeOf`/`assertType`，与 `expect-type` 同源但直接集成进 Vitest 的 `--typecheck` 运行模式）。章程 D9 已经选定 Vitest 作为测试运行时。

## 决策

采用 **Vitest 内建的 `expectTypeOf`/`assertType`**（`vitest --typecheck` 运行模式），不引入 `tsd` 或独立的 `expect-type` 包作为额外依赖。

理由：D9 已经为运行时测试选定 Vitest；如果类型测试再引入一套独立工具（`tsd`）和独立 CLI，团队需要同时维护两套测试组织约定（文件命名、`describe`/`it` 与 `tsd` 的注释指令语法不同）、两套 CI 步骤、两次工具学习成本。Vitest 内建能力在 API 层面（`expectTypeOf`）与独立的 `expect-type` 包几乎一致（同一作者/同源实现），选择 Vitest 内建版本可以获得相同的断言表达力，同时不新增一个独立包依赖（減少 [知knip](../09-type-discipline/03-boundaries.md#4-knip--manypkg--syncpack-的分工) 需要追踪的依赖面，也避免 [ADR-0041](./0041-assertion-policy.md#后果) 提到的"依赖面增长与许可证审查成本不成正比"这一顾虑在类型测试工具选型上重演）。

组织约定（详见 [09§6](../09-type-discipline/09-plugin-type-contracts.md#6-类型测试的组织方式)）：`*.type-test.ts` 文件，独立的 CI job `test-typecheck`（[07§3](../09-type-discipline/07-hooks-and-ci.md#3-ci-工作流矩阵)），不与常规 `test` job 混合运行（类型测试失败信息是 tsc 诊断，运行时测试失败信息是断言差异，混合会拖慢排查）。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| `tsd`（`// $ExpectType` 注释指令风格） | 独立 CLI、独立断言语法，与 Vitest 的 `describe`/`it` 组织方式不统一，团队要在两套语法间切换；`tsd` 的注释指令风格在重构时（如批量改名）不便于 IDE 辅助（普通字符串断言比结构化注释更容易被"查找替换"工具处理，但这也不是决定性因素，主要放弃理由仍是"多一套独立工具链"） |
| 独立 `expect-type` 包 + 手动接入 Vitest | 与 Vitest 内建版本能力高度重合（同源实现），额外引入一个包除了"版本可以独立于 Vitest 升级"外没有实质收益，而"独立于 Vitest 升级"在本项目里不是一个真实需求（本项目统一锁定 Vitest 版本，见 [03§4](../09-type-discipline/03-boundaries.md#4-knip--manypkg--syncpack-的分工) 的关键依赖版本一致性要求） |
| 不做类型测试，只靠"业务代码编译通过"间接验证类型契约 | 无法覆盖**负向**场景——"这段代码应该编译失败"这一类断言（如"贡献点 schema 要求某字段必填，遗漏时应该报类型错误"）没有对应的正面代码路径可以间接验证；[lessons A17](../../00-charter/reference-univer-lessons.md)（负向测试是准入门槛）同样适用于类型层面的规则，不能只验证"合法用法能编译"而不验证"非法用法真的不能编译" |

## 后果

**正面**：类型测试与运行时测试共用同一工具链、同一组织心智（`describe`/`it`），学习成本低；`test-typecheck` 作为独立 job 与常规 `test` 分离，不会因为类型检查耗时拖慢运行时测试的反馈速度。

**负面**：`vitest --typecheck` 模式本身仍需要跑一次 tsc 类型检查，与 [07](../09-type-discipline/07-hooks-and-ci.md) 的 `typecheck` job（`tsc --build`）在"做了同一件事"的观感上有重叠——两者实际检查的对象不同（`typecheck` job 检查全部生产代码是否类型正确；`test-typecheck` 额外检查`*.type-test.ts`里的正向/负向断言是否成立，是对类型契约的**主动测试**而非被动编译），但需要在团队文档/入职材料里讲清楚两者的区别，避免被误认为冗余步骤而被随手删掉一个。

## 如何被机械验证

- `test-typecheck` job 存在且在每个 PR 运行（[07§3](../09-type-discipline/07-hooks-and-ci.md#3-ci-工作流矩阵)）。
- `@ts-expect-error` 类型测试负例必须带说明（[09§6](../09-type-discipline/09-plugin-type-contracts.md#6-类型测试的组织方式)，机制同 [02§3](../09-type-discipline/02-lint-rules.md#3-禁用清单--具体规则映射) 的 `ban-ts-comment` 配置）。

## 关联

- 章程 D9（Vitest）；[09-plugin-type-contracts.md §6](../09-type-discipline/09-plugin-type-contracts.md#6-类型测试的组织方式)、§7（Provider 契约套件；2026-09-25 按章程 `run<Definition>Conformance` 命名统一，原「合规套件」作废，rulings §4.18 GV-19）。
- [lessons A14](../../00-charter/reference-univer-lessons.md)（幽灵泛型，类型测试覆盖的典型反例场景之一）。
