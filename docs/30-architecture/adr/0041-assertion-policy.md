> 状态：草稿 | 负责：架构-类型治理 | 更新：2026-09-14 | 依赖：charter v0.1

# ADR-0041：断言策略（`as` / `!` 禁用与替代模式）

## 状态

提议中（M0 蓝图阶段）。

## 背景

类型断言（`as X`、尖括号断言 `<T>x`）与非空断言（`x!`）是"开发者比编译器更懂"的声明——它们不触发任何运行时检查，纯粹是告诉类型检查器"相信我"。这与 [01-tsconfig-baseline.md](../09-type-discipline/01-tsconfig-baseline.md) 启用的 `strictNullChecks`/`noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` 等选项的本意直接冲突：这些选项存在的目的就是让"这里可能是 undefined/可能不存在"在编译期可见，而断言是绕开这份可见性最常见、成本最低的手段——一旦允许，严格选项的实际保护力会被大量侵蚀，团队会在感受到严格选项的"摩擦"时下意识地用断言把它压下去，而不是处理根因。cordis 生态本身的错误处理示例（`ValidationError`/`CordisError`，见 cordis-api-fiber.md）也从未依赖断言，走的是类型守卫/显式抛出的路线，与本 ADR 的方向一致。

## 决策

1. **禁止** `as X`（`X` 非 `const`）、尖括号断言 `<T>x`、非空断言 `x!`。机械执行见 [02-lint-rules.md §3](../09-type-discipline/02-lint-rules.md#3-禁用清单--具体规则映射)。
2. **不禁止** `as const`（字面量收窄，不产生"未经检查的类型跃迁"）与 `satisfies`（校验字面量是否符合某类型，同时**保留**原有的、更精确的推断类型——这是 `satisfies` 与 `as` 的关键区别：`as` 会把值的类型**替换**为断言目标类型（可能比实际类型更宽或完全错误且编译器不再检查），`satisfies` 只是**校验**兼容性、不改变推断结果，因此不构成"未经检查的信任点"）。
3. **替代模式**（按适用场景）：

   | 场景 | 替代方案 |
   |---|---|
   | "这个值经过校验后一定是某个更窄的类型" | 类型守卫函数（`function isFoo(x: unknown): x is Foo`）+ `if` 收窄 |
   | "这里不可能是 undefined，但类型上看起来可能" | 断言函数（`function assertDefined<T>(x: T, msg?: string): asserts x is NonNullable<T>`，定义于 `@oce/shared`）——与 `!` 的关键区别：断言函数**在运行时真的检查**，检查失败时抛出类型化异常（[05§5](../09-type-discipline/05-runtime-boundaries.md#5-result-类型与异常的边界)），而 `!` 是无检查的静默信任；两者对类型系统的效果相似，对运行时正确性的保障截然不同 |
   | 外部/不可信数据进入类型化世界 | Standard Schema 解析（[05](../09-type-discipline/05-runtime-boundaries.md)），parse 后得到的类型是"真的检查过"的，不是断言出来的 |
   | `noUncheckedIndexedAccess` 触发的 `T \| undefined` | 显式判空分支，或 `??`/可选链，视语义决定 fallback 还是继续向上抛出 |
   | 品牌类型构造 | 专用构造函数（[05§4](../09-type-discipline/05-runtime-boundaries.md#4-品牌类型branded-types)），内部做范围/格式校验后返回品牌类型——构造函数内部实现允许（且必须）做真正的校验，不是简单包一层 `as`（构造函数本身的实现如需要临时的类型层过渡手段，走 `oce-allow` 逐案登记并计入 [ADR-0040](./0040-type-budgets-and-ratchet.md) 预算，不豁免） |

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 允许 `as`，但要求紧邻注释说明理由 | 注释不是机器可验证的安全性保证，本质上等于没有约束——审阅者容易对"看起来合理的注释"放行，而注释本身不能证明断言是安全的 |
| 只禁非空断言 `!`，放开 `as` | `as` 的破坏力不比 `!` 小，反而更常被滥用做"整体换型"（把一个对象断言成完全不同结构的接口），比 `!`（只影响 nullability）影响面更广 |
| 引入第三方"安全断言"辅助库封装断言逻辑 | 本质上只是把断言包了一层更好看的外壳，没有改变"底层仍是未经检查断言"的事实，还额外增加一个依赖面（与 D13 许可证审查、knip 依赖卫生的维护成本不成正比） |

## 后果

**正面**：每一次"我确信这里的类型是什么"都被迫写成一个可读、可单测、可复用的函数调用（类型守卫/断言函数），而不是一个内联的、无法单独测试的类型系统旁路；`noUncheckedIndexedAccess` 等严格选项的实际保护力不会被断言悄悄抵消。

**负面**：迁移初期改动量较大，尤其是习惯了其他项目用 `as`/`!` 快速"消灭红线"的工程师会有摩擦；缓解手段是 `@oce/shared` 尽早提供 `assertDefined`/常用类型守卫工具函数库，降低"写一个类型守卫"的边际成本。

## 如何被机械验证

- [02-lint-rules.md §3](../09-type-discipline/02-lint-rules.md#3-禁用清单--具体规则映射)：`no-restricted-syntax`（`TSAsExpression`/`TSTypeAssertion`/`TSNonNullExpression`）。
- [06 scan-type-escapes](../09-type-discipline/06-scanners.md#2-scan-type-escapes)：统计与预算比对（[ADR-0040](./0040-type-budgets-and-ratchet.md)）。

## 关联

- R7；[ADR-0040](./0040-type-budgets-and-ratchet.md)（预算机制承载本 ADR 无法立即归零的场景）。
- [05-runtime-boundaries.md §4](../09-type-discipline/05-runtime-boundaries.md#4-品牌类型branded-types)（品牌类型构造函数是断言函数模式的具体应用）。
- cordis primer §3.2（`ValidationError` 的类型化错误路线，非断言路线的框架先例）。
