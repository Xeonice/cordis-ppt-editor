> 状态：草稿 | 负责：架构-类型治理 | 更新：2026-09-14 | 依赖：charter v0.1

# ADR-0043：Result 与异常的边界

## 状态

提议中（M0 蓝图阶段）。

## 背景

一个代码库如果在"函数失败时怎么通知调用方"这件事上没有统一约定，会同时长出两套心智负担：调用方永远不确定"这个函数会不会抛"，防御性 `try/catch` 与"忘了 catch 导致未处理拒绝"两种反模式并存。本项目的失败模式天然分两类，值得分别处理：一类是**预期内、业务语义上的失败**（用户输入不合法、网络请求失败、权限被拒绝、OOXML 里出现不认识的结构）——这类失败是正常业务流程的一部分，调用方通常需要针对具体失败原因做不同处理；另一类是**程序员错误/不变量违反**（"这不应该发生"：内部状态机进入未定义分支、贡献点 key 冲突、断言失败）——这类失败意味着代码本身有 bug 或环境处于不一致状态，继续执行没有意义。cordis 框架自身已经在这两类失败上做出了示范：`ValidationError`/`CordisError`（cordis-api-fiber.md）都是**抛出**的，且都对应"配置不合法"/"在已销毁的 Fiber 上创建 effect"这类程序员错误或环境不一致，不是"业务上可预期、需要调用方分支处理"的失败。

## 决策

1. **预期失败 → `Result<T, E>`**：判别联合 `{ ok: true, value: T } | { ok: false, error: E }`（或等价形态），定义于 `@oce/shared`。[05§1](../09-type-discipline/05-runtime-boundaries.md#1-必须校验的边界清单) 列出的每个运行时边界（Config 校验业务侧后果、REST/WS DTO 处理、`FormatCodec` 解析、Snapshot 载入）的失败路径统一走 `Result`。调用方**必须**处理两态——[01](../09-type-discipline/01-tsconfig-baseline.md) 的 `strict` 家族通过判别联合的穷尽性检查间接强制这一点。
2. **程序员错误/不变量违反 → 类型化异常**：`throw`，且抛出的必须是继承自 `OceError`（基类的具体形态与错误码取值域由架构-运行时条线 B 的 10-observability 提供，见「关联」）的实例，不是裸 `throw new Error(...)`（[02§3](../09-type-discipline/02-lint-rules.md#3-禁用清单--具体规则映射)）。
3. **例外**：插件 `Config` 校验失败沿用 cordis 原生行为——`ctx.plugin()` 拒绝、抛 `ValidationError`——不重新包装成 `Result`。理由：这一失败发生在"插件能否启动"这个比"插件已启动、运行期处理一份业务数据"更早、更根本的时机，性质上更接近"程序员/运维配置错误"而非"业务流程的一个分支"，与 cordis 框架自身的处理方式保持一致，避免在框架已有约定之上另造一套语义不同的包装。
4. **边界转换**：任何未被捕获的类型化异常，到达以下三个终点之一时必须被转换为该终点的标准错误呈现形式，不得原样穿透给不知情的调用方：cordis Fiber `apply` 顶层（cordis 内建捕获，转为 `FAILED` 状态并上报 `errors` 服务）、Nest 全局异常过滤器（`apps/server`）、React 错误边界（`apps/web`）。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 全部失败统一用异常（包括预期失败） | 调用方无法从函数签名看出"这个函数可能因为业务原因失败，需要处理"——异常是"隐藏的返回路径"，容易被忘记 `catch`；且与本项目"strict 穷尽性检查"的类型安全工具链脱节（`try/catch` 的错误类型天然是 `unknown`，见 `useUnknownInCatchVariables`，无法像 `Result` 的 `E` 分支一样被联合类型穷尽检查强制处理） |
| 全部失败统一用 `Result`（包括不变量违反） | 会把"这不应该发生"的程序员错误伪装成一个"正常的业务分支"，掩盖真正的 bug；且大量传播 `Result` 会让不关心这类错误的中间层代码被迫层层转发一个它们无法有意义处理的错误态，增加噪音 |
| 引入第三方 Result/Either 库（如 `fp-ts`/`neverthrow`） | 增加一个有一定学习曲线的函数式编程依赖，与团队既有的直接式（非函数式管道）代码风格摩擦较大；本项目的 `Result` 需求足够简单（两态判别联合 + 少量组合子），`@oce/shared` 自行定义可以保持依赖面最小、类型签名对该项目量身定制 |

## 后果

**正面**：函数签名本身就声明了"这里可能有业务失败"（返回类型含 `Result`）还是"这里只应该在不该发生的情况下抛"（无 `Result` 包装、可能抛类型化异常），调用方按签名就能判断需要写多少防御代码；`Result` 与 `strict` 类型检查的穷尽性检查天然配合，遗漏处理失败分支是编译错误而非运行时才发现。

**负面**：与很多工程师熟悉的"全部用 `try/catch`"心智模型不同，需要一定适应期；`Result` 在跨多层函数调用时需要显式传播（除非引入 `?.`/管道语法糖，本项目不引入以保持简单），比"让异常自己往上冒泡"多一点样板代码。

## 如何被机械验证

- 裸 `throw new Error`：`no-restricted-syntax`（[02§3](../09-type-discipline/02-lint-rules.md#3-禁用清单--具体规则映射)）。
- `catch` 变量类型：`useUnknownInCatchVariables`（[01](../09-type-discipline/01-tsconfig-baseline.md)）。
- `Result` 判别联合的穷尽处理：tsc `strict` 家族（[01](../09-type-discipline/01-tsconfig-baseline.md)）。
- `OceError` 子类必须携带 `code` 字段：类型契约由本子线定义，具体校验点待架构-运行时 B 的错误码基类落地后由 [02](../09-type-discipline/02-lint-rules.md) 补充一条类型感知规则（当前记录为跨条线依赖，见任务汇报）。

## 关联

- [05-runtime-boundaries.md §5](../09-type-discipline/05-runtime-boundaries.md#5-result-类型与异常的边界)（本 ADR 的详细边界清单与例外说明）。
- cordis primer §3.2（`ValidationError`）、cordis-api-fiber.md（`CordisError`）——两者都是本 ADR"程序员错误走异常"决策的框架先例。
- 章程 D11（禁止裸 `throw`）；架构-运行时 B 的 10-observability（错误码取值体系，本 ADR 只约束类型契约，不定义取值域）。
