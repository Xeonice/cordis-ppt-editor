> 状态：草稿 | 负责：架构-类型治理 | 更新：2026-09-14 | 依赖：charter v0.1

# ADR-0045：采用 `isolatedDeclarations`

## 状态

提议中（M0 蓝图阶段）。

## 背景

章程 D9 已把 `isolatedDeclarations` 列为工具链决策的一部分；本 ADR 补齐"为什么"与"代价是什么"，因为它是本方案里对**日常写代码手感**影响最大的一个编译选项，值得单独记录取舍依据而不是只在 [01](../09-type-discipline/01-tsconfig-baseline.md) 里当作一行配置带过。`isolatedDeclarations` 要求"每个导出声明的类型只能从该声明自身的语法确定"，即 `.d.ts` 生成不依赖跨文件类型推断。本项目是一个多包 monorepo（章程 §5.2 列出的包数量在 M5 阶段会明显增长），`.d.ts` 生成速度与 IDE 里"跳转到类型定义"的响应速度会随包数增长而变得敏感。

## 决策

`packages/*`（可发布的 SDK 包）全部开启 `isolatedDeclarations: true`（[01§2.3](../09-type-discipline/01-tsconfig-baseline.md#23-r7-专项isolateddeclarations-与-verbatimmodulesyntax)）。`apps/*`（终端应用，不发布、不经过 [04](../09-type-discipline/04-api-surface.md) 的 api-extractor 流程）不强制——该选项的收益（可被单文件工具并行生成 `.d.ts`）只有在"这个包的类型会被其他工具消费"时才有意义，`apps/*` 没有这个消费场景。

具体的写法后果（哪些导出需要显式类型标注）见 [09§5](../09-type-discipline/09-plugin-type-contracts.md#5-isolateddeclarations-下的导出约束)：字面量/`as const`/`new` 具名类的初始化器通常可省略标注，函数调用（尤其是泛型函数调用，如 `defineContributionPoint(...)`）产生的导出值必须显式标注。

采用起点：本项目是绿地代码库（M0 阶段无生产代码），**不存在"迁移现有代码"的成本**——`isolatedDeclarations` 从第一行生产代码起就是既定写法，不是后补的严格化。这与多数讨论 `isolatedDeclarations` 采用成本的文章（通常语境是"给存量代码库加上这个选项"）处境不同，本 ADR 的"成本"部分因此主要讨论**长期的编写体感成本**，而非一次性迁移成本。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 不开启，继续用普通的跨文件类型推断生成 `.d.ts` | 与章程 D9 冲突；放弃"单文件可并行生成声明文件"的能力，在包数增长（M5）后 `tsc` 全量 `.d.ts` 生成时间会退化为与全项目类型检查同量级，而不是可独立加速的子任务 |
| 只在部分"体积较大"的包开启，其余包不开启 | 不一致的规则比一致但更严格的规则更难维护——开发者需要记住"这个包要不要显式标注类型"，心智负担高于"所有 SDK 包统一要求"；且 [09](../09-type-discipline/09-plugin-type-contracts.md) 的贡献点/Manifest 写法约定需要在全部包间保持一致，局部开启会制造两套书写规范 |

## 后果

**正面**：`.d.ts` 生成可单文件并行、不依赖完整类型检查通过，构建管线里"类型检查"与"声明文件生成"可以解耦（互不阻塞）；每个公开 API 的类型在源码里"自证"，不需要跳转到实现或依赖编译器推断才能确认对外类型是什么，这本身也提升了代码评审时的可读性——评审者看 diff 就能看到公开类型的变化，不需要额外跑一次 `tsc` 才能发现类型层面的隐性改动。

**负面**：贡献点/Manifest 一类由函数调用产生的导出值需要显式重复标注返回类型，存在"类型标注与实现签名不同步"的新失配可能（如果 `defineContributionPoint` 的返回类型签名变了，显式标注处不会自动更新，会变成一个需要人工发现的类型错误——但这本身是 `isolatedDeclarations` 用意所在：变化必须在编译期被看见，不能悄悄流过）；对习惯了"依赖类型推断、少写标注"的工程师有一定手感调整成本。

## 如何被机械验证

- `isolatedDeclarations: true`（[01§2.3](../09-type-discipline/01-tsconfig-baseline.md#23-r7-专项isolateddeclarations-与-verbatimmodulesyntax)），违反即编译失败，无豁免通道（编译器强制，不支持逐文件关闭）。
- 贡献点/Manifest 显式标注约定：[09§5](../09-type-discipline/09-plugin-type-contracts.md#5-isolateddeclarations-下的导出约束)，同样由编译器强制，本子线不额外发明校验层。

## 关联

- 章程 D9；[01-tsconfig-baseline.md §2.3](../09-type-discipline/01-tsconfig-baseline.md#23-r7-专项isolateddeclarations-与-verbatimmodulesyntax)、[09-plugin-type-contracts.md §5](../09-type-discipline/09-plugin-type-contracts.md#5-isolateddeclarations-下的导出约束)。
- [ADR-0046](./0046-native-typescript-compiler-evaluation.md)（`isolatedDeclarations` 与单文件转译工具链的关系，是评估 tsgo 采用路径时需要重新核对的兼容点之一）。
