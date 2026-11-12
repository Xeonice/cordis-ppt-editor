> 状态：草稿 | 负责：架构-类型治理 | 更新：2026-09-14 | 依赖：charter v0.1

# ADR-0042：禁 `enum`，用 `as const` 对象与联合类型

## 状态

提议中（M0 蓝图阶段）。

## 背景

两条独立但相互加强的理由：

1. **产品史证据**：[lessons A3](../../00-charter/reference-univer-lessons.md) —— Univer 把文档类型固化为 protobuf 闭合枚举（8 个值，4 个厂商预留位），导致第三方无法新增文档类型，与章程 R5（"后续扩展 doc、excel"，`DocumentType` 必须是开放贡献点）直接矛盾。枚举（无论是 TS `enum` 还是 protobuf enum）的本质是"编译期固化的封闭集合"，与"运行期可扩展的注册表"是两种不同的建模工具，混用是问题的根源。
2. **TypeScript 语言层面的独立理由**：TS 的 `enum` 有若干与本项目其余工具链选择相冲突的特性——数字枚举产生反向映射（运行时体积/行为的隐藏面）；`const enum` 需要跨文件内联信息，与 `isolatedModules`（[01](../09-type-discipline/01-tsconfig-baseline.md)）不兼容；`enum` 整体不属于 TS 5.8 引入的 `erasableSyntaxOnly` 语法子集（"仅靠擦除类型即可编译"），与本项目 `packages/*` 强制开启该选项的姿态冲突。即使 Univer 报告从未发生过，这条决策在本项目的工具链前提下也成立。

## 决策

1. **禁止** `enum`（数字枚举与字符串枚举均禁止），在 `packages/*` 通过 `erasableSyntaxOnly: true`（[01§2.3](../09-type-discipline/01-tsconfig-baseline.md#23-r7-专项isolateddeclarations-与-verbatimmodulesyntax)）升级为编译错误，在全仓库通过 `no-restricted-syntax`（[02§3](../09-type-discipline/02-lint-rules.md#3-禁用清单--具体规则映射)）在编辑期先行拦截。
2. **封闭小集合**（值的全集已知且不期望第三方扩展，如"对齐方式" `left`/`center`/`right`，OOXML 规范本身定义的封闭枚举）：用 `as const` 数组/对象 + 派生联合类型：

   ```ts
   // 示意
   const Alignment = { Left: 'left', Center: 'center', Right: 'right' } as const
   type Alignment = (typeof Alignment)[keyof typeof Alignment]
   ```

   这一模式保留了 `enum`唯一真正不可替代的优点——"同时产出一组值和一个类型"——而不引入 `enum` 的运行时/编译期特殊语义。
3. **开放可扩展集合**（`DocumentType`、`ContributionPoint` 的 `kind`/`id`，任何第三方可注册新成员的场景）：**不**用联合类型（哪怕是手写的、不断增长的联合），直接用 `string`（必要时是模板字面量类型约束格式，如贡献点 id 的 `` `${string}.${string}` ``）+ 运行时注册表校验唯一性。理由：联合类型即使不是 `enum`，只要是"编译期列出全部成员"，就仍然是封闭集合，无法达成"第三方在不改动本包源码的前提下新增一个合法值"这一目标——这是 A3 问题的**本质**（封闭 vs 开放），不是"用了 enum 这个关键字"的表面问题，替换成一个手写的封闭联合类型并不能解决 Univer 的原始问题。
4. **协议层**（[@cordexjs/protocol](../09-type-discipline/05-runtime-boundaries.md)）：涉及跨网络传输的分类值统一用字符串 id，不用 `z.nativeEnum`（该 API 要求先有一个 TS `enum` 作为输入，与本 ADR 禁 `enum` 的决策矛盾），改用 `z.enum([...])`（zod 原生的字符串字面量联合校验，不依赖 TS `enum`）描述封闭协议字段，`z.string()` + 运行时注册表校验描述开放字段。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 允许 `const enum`（无运行时体积/性能更好） | 需要跨文件内联信息，与 `isolatedModules`（单文件可转译）语义冲突；即使可行，`const enum` 在库代码中历来是 TS 官方与社区都不建议的模式（消费方 `isolatedModules` 配置不一致会直接报错），风险与收益不成比例 |
| 用 `z.nativeEnum` 桥接一个仍然存在的 TS `enum` | 治标不治本——`z.nativeEnum` 的输入本身就是一个 `enum`，意味着这条路径下 `enum` 依然存在于代码库里，只是多包了一层 zod，没有解决本 ADR 要解决的问题 |
| 完全不用任何"值+类型"双重产出模式，分类值全部裸 `string` 字面量类型，值本身单独在别处定义 | 对**封闭**小集合而言不必要地增加了"类型定义"与"值定义"两处需要保持同步的地方，正是 [05§3](../09-type-discipline/05-runtime-boundaries.md#3-schema-即类型源)「schema/单一来源」原则要规避的分裂模式；`as const` 对象一步产出两者，没有理由放弃这一点便利 |

## 后果

**正面**：分类值在协议边界天然是可直接 JSON 序列化的原始类型，无需额外编解码；`DocumentType`/贡献点 `kind` 类的开放集合在类型层面就"看起来"是开放的（`string`），不会诱使开发者假设"所有可能值已经穷尽在这个联合类型里"而写出隐性依赖封闭性的代码（如对某联合类型做无 `default` 分支的 `switch`，误以为已穷尽）。

**负面**：失去了 TS 数字 `enum` 的"反向查找"（数字→键名）便利性与 IDE 对 `enum` 成员的某些原生重构支持；封闭集合场景下团队需要适应 `as const` 对象的写法而非更熟悉的 `enum` 语法。

## 如何被机械验证

- `enum` 关键字：`no-restricted-syntax`（[02§3](../09-type-discipline/02-lint-rules.md#3-禁用清单--具体规则映射)，编辑期）+ `erasableSyntaxOnly`（[01§2.3](../09-type-discipline/01-tsconfig-baseline.md#23-r7-专项isolateddeclarations-与-verbatimmodulesyntax)，`packages/*` 编译期零豁免）。
- 协议字段禁 `z.nativeEnum`：代码评审（`contracts/*.schema.ts` 内聚约定使这类调用在评审中容易被发现；未设独立 AST 规则，风险可控——`z.nativeEnum` 的调用点极少且集中在 `contracts/` 目录）。

## 关联

- [lessons A3](../../00-charter/reference-univer-lessons.md)；章程 R5（`DocumentType` 开放贡献点）。
- [01-tsconfig-baseline.md §2.3](../09-type-discipline/01-tsconfig-baseline.md#23-r7-专项isolateddeclarations-与-verbatimmodulesyntax)（`erasableSyntaxOnly`）、[02-lint-rules.md §3](../09-type-discipline/02-lint-rules.md#3-禁用清单--具体规则映射)。
