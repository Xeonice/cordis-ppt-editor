> 状态：草稿 | 负责：架构-类型治理 | 更新：2026-09-14 | 依赖：charter v0.1

# ADR-0044：ESLint 与 Biome 的职责切分

## 状态

提议中（M0 蓝图阶段）。

## 背景

章程 D9 同时选定"ESLint（typescript-eslint 类型感知规则）+ Biome 格式化"，但没有规定两者的边界——这是一个真实的坑：ESLint 的 `stylistic-type-checked` 预设与 Biome 的格式化规则在若干规则上语义重叠（如引号风格、尾逗号），若两边都开启且配置不一致，会出现"ESLint 认为对、Biome 改回错"的振荡，或反之，团队会在两个工具之间来回改动同一段代码。同时，Biome 目前的定位是**不做跨文件类型感知分析**（它的 linter 只做语法/单文件语义分析，速度优势正来自不需要构建/查询 TS 类型信息），这意味着本方案要求的绝大多数自定义规则（[02](../09-type-discipline/02-lint-rules.md) 的 `oce/*`，几乎全部依赖类型信息或跨文件/包元数据）**只能**用 ESLint 实现，Biome 在架构治理这一维度上没有可替代性。

## 决策

**判定规则**（详见 [02§6](../09-type-discipline/02-lint-rules.md#6-eslint-与-biome-的职责切分)）：

1. 需要 TS 类型信息（跨符号/跨文件类型解析）的规则 → ESLint（typescript-eslint 预设 + `oce/*`）。
2. 纯粹关于空白/引号/分号/换行/尾逗号/import 排序等"文本形状"的规则 → Biome，且**格式化器覆盖一切**（不留给开发者选择，`biome format --write` 是唯一权威）。
3. 本项目特有的架构/命名/文件组织约束，即使不需要类型信息（如文件名与内容的匹配关系）→ 仍归 ESLint 自定义规则（`oce/*`），不拆分到 Biome——保持全部架构类规则集中在一处，避免"部分架构规则归 Biome、部分归 ESLint"的心智负担。
4. `stylistic-type-checked` 预设中与 Biome 格式化域重叠的具体规则（如缩进、引号相关子规则）在 ESLint 侧**关闭**，只保留该预设里"需要类型信息、且不是纯格式化"的部分（如 `consistent-type-imports`——它需要判断一个导入符号是否仅作为类型使用，这需要类型检查器，不是纯文本形状问题）。

自动修复权限：架构/语义类问题（`oce/*` 与 typescript-eslint 的语义规则）**不提供**自动修复——修复这类问题需要理解意图，机械改写风险高（[02](../09-type-discipline/02-lint-rules.md) 已逐条说明）；格式问题（Biome 管辖的一切）**始终**自动修复，且是 `pre-commit` 阶段的第一步（[07](../09-type-discipline/07-hooks-and-ci.md)），开发者不需要（也不应该）手动对齐格式。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 只用 ESLint，不引入 Biome | 与章程 D9 冲突（D9 已明确选型）；即使重新评估，ESLint 的格式化能力（经由 `eslint-plugin-prettier` 之类的桥接）比原生格式化器慢一个数量级，在 monorepo 规模下 `pre-commit` 时间预算（[07](../09-type-discipline/07-hooks-and-ci.md)）会承压 |
| 只用 Biome，不引入 ESLint | Biome 当前不提供跨文件类型感知的 lint 能力，本方案的核心机制（`oce/*` 自定义规则、typescript-eslint 的 `strict-type-checked`）无法迁移；等于放弃 R7 的大半机械化手段，不可接受 |
| 两者规则全量开启，允许重叠 | 会产生规则振荡（见背景），且没有实际收益——重叠规则的"额外覆盖"价值为零，只有"配置漂移导致两个工具打架"的额外风险 |

## 后果

**正面**：`pre-commit` 里格式化步骤（Biome）极快且无需人工判断，架构/语义判断集中在 ESLint 一处，心智负担单一；两个工具没有重叠职责，不会互相冲突。

**负面**：需要持续维护"重叠规则关闭表"（[02§2.1](../09-type-discipline/02-lint-rules.md#21-偏离表)），当 typescript-eslint 或 Biome 升级引入新的重叠规则时，需要人工发现并追加到该表——这一同步目前没有自动化机制，记录为已知维护成本。

## 如何被机械验证

- `policy-check` 校验 ESLint 解析配置中不包含已声明"归 Biome"的规则（[02§7](../09-type-discipline/02-lint-rules.md#7-如何被机械验证汇总)——当前实现方式为对照 [02§6](../09-type-discipline/02-lint-rules.md#6-eslint-与-biome-的职责切分) 判定表逐条核对配置文件，重叠表维护本身仍是人工纪律，见「后果」）。
- `pre-commit`（[07](../09-type-discipline/07-hooks-and-ci.md)）的步骤顺序（Biome 先于 ESLint）本身保证格式问题不会先被 ESLint 判定为错误。

## 关联

- 章程 D9（工具链：ESLint 类型感知规则 + Biome 格式化）。
- [02-lint-rules.md §6](../09-type-discipline/02-lint-rules.md#6-eslint-与-biome-的职责切分)（判定规则原文）、[07-hooks-and-ci.md §2.1](../09-type-discipline/07-hooks-and-ci.md#21-pre-commit目标总预算-15-秒仅作用于暂存文件)（步骤顺序）。
