> 状态：草稿 | 负责：架构-类型治理 | 更新：2026-09-14；2026-09-24（复核修正，rulings §4.17：M18 锚点 `-oce` → `-cordex`） | 依赖：charter v0.1

# 05 · 运行时边界（parse, don't validate）

本篇执行 D2（Standard Schema/zod 边界校验）与「parse, don't validate」的机械化：哪些边界**必须**校验、schema 与类型的单一来源关系、品牌类型清单、Result 与异常的分工。本篇管辖**运行时值**穿越信任边界时的类型收窄；编译期约束见 [01](./01-tsconfig-baseline.md)/[02](./02-lint-rules.md)，包间依赖边界见 [03](./03-boundaries.md)。

---

## 1. 必须校验的边界清单

「边界」定义：数据来源不受本进程内类型系统约束的任何交界——外部输入、跨进程/跨网络传输、跨版本持久化读取、跨信任域（第三方插件）。以下边界**没有例外**，缺少校验点即判定为违规：

| 边界 | 校验时机 | Schema 归属包 | 校验后进入的类型 |
|---|---|---|---|
| 插件 `Config` | `ctx.plugin(plugin, config)` 加载期，cordis 内建（Standard Schema 原生支持，primer §3.2） | 各插件 `contracts/*.schema.ts` | 插件内部使用的强类型 `Config` |
| REST DTO（请求体/查询参数/路径参数） | Nest 控制器边界（`apps/server`），入站方向 | `@cordexjs/protocol` | Nest handler 的强类型参数 |
| WS 消息（客户端↔服务端两个方向） | 协同网关收到/发出每一帧时（`server-collab`），**双向**校验——协同是长连接、双向不可信通道，不能假设"我方发出的消息不需要自证" | `@cordexjs/protocol` | `collab-core` 定义的内部消息类型 |
| `FormatCodec` 解码输出（`ooxml-pptx` 等） | 从 OPC/XML 结构映射进 `model-*` 运行时对象图的那一步 | `ooxml-core`/各 `ooxml-*` 包的 `contracts/*.schema.ts` | `model-*` 的强类型模型节点 |
| Snapshot 载入 | `DocumentStore` 从持久化字节/JSON 反序列化为运行时模型之前 | `model-core`（`schemaVersion` 分发 + 各版本 schema） | 当前运行时 `schemaVersion` 对应的模型类型 |
| `localStorage`/`IndexedDB` 读取（客户端草稿缓存、离线队列） | 读取后立即，赋值给任何应用状态之前 | 对应功能所在包（如 `collab-core` 的离线队列） | 该功能的内部状态类型 |
| URL 参数（深链接：文档 id、幻灯片序号、评论锚点） | 路由参数解析后立即 | `@cordexjs/protocol` 或 `apps/web` 路由层的本地 schema | 品牌类型（`UnitId`/`SlideId` 等，见 §4） |

判定理由（为什么 OOXML 解码输出也算"边界"）：`.pptx` 文件是任意来源的输入（用户上传、第三方生成、格式不规范的历史文件），XML 结构在类型系统看来是 `unknown`（`ooxml-core` 的 XML 解析结果本身是命名空间感知但**结构无知**的节点树），从这棵树"认领"出符合 `model-slide` 结构的强类型对象，正是一次典型的 parse 操作——`ooxml-pptx` 对不认识的子树执行「不透明保留」（章程 D7）本身就是 parse 失败时的降级路径，而不是校验失败后的报错路径，这是本项目与"REST DTO 校验失败即拒绝"这类边界的关键差异，§5 展开。

---

## 2. Standard Schema / zod 的放置约定

- 每个校验边界对应的 schema 定义在**该边界所属包**的 `contracts/*.schema.ts`（primer §5.3 文件约定的延伸——`contracts/` 目录本就用于存放 Definition 与 schema）。
- **禁止**跨包复制 schema 描述同一形状；若两个包需要校验结构相同的数据，共享 schema 应上提到两者共同依赖的更低层包（通常是 `@cordexjs/protocol` 或 `@cordexjs/shared`），而不是各自维护一份。
- zod 版本锁定为 **zod 4 系列**（2025 年发布，原生实现 Standard Schema 规范；相对 zod 3 有解析性能与包体积的显著改善，详见下方 Sources）——本项目以此版本作为 D2「默认 zod」的具体化。锁定方式与其余关键第三方依赖一致，由 [03 §4](./03-boundaries.md#4-knip--manypkg--syncpack-的分工) 的 manypkg 保证全工作区版本唯一。

---

## 3. Schema 即类型源

**规则**：任何描述一个运行时边界形状的 TypeScript 类型，必须通过 `z.infer<typeof XSchema>`（或等价的 `StandardSchemaV1.InferOutput<typeof XSchema>`）推导得到，不允许手写一份"看起来一样"的 `interface`/`type`。

**理由**：手写副本是本项目里"声明了但没执行"（[lessons A16-A27](../../00-charter/reference-univer-lessons.md) 类问题的下一站）最容易发生的地方——schema 加了一个字段、忘记同步接口，两边在评审时都"看起来没问题"（改 schema 的 PR 看不到接口定义，改接口的 PR 看不到 schema），直到运行时数据形状与编译期类型断言不一致才暴露。

**机械执行**：[02 §4.11 `cordex/schema-type-must-be-inferred`](./02-lint-rules.md#411-cordexschema-type-must-be-inferred新增超出建议清单)。这条规则的检测范围是"同文件内手写同名类型"，对"两个不同名字但结构雷同"的手写副本无能为力——这是已知盲区，缓解手段是代码评审 + `contracts/` 目录的内聚约定（同一形状没有理由分两个文件描述）。

**与 `exactOptionalPropertyTypes` 的交互**：见 [01 §3](./01-tsconfig-baseline.md#3-与-zod-推导类型的交互exactoptionalpropertytypes)。

---

## 4. 品牌类型（Branded Types）

### 4.1 模式

```ts
// 示意，定义于 @cordexjs/shared
type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand }

type Emu = Brand<number, 'Emu'>          // OOXML 内部长度单位（1/914400 英寸）
type Pt = Brand<number, 'Pt'>            // 字号/描边宽度等使用的 point 单位
type UnitId = Brand<string, 'UnitId'>    // 打开的文档实例 id
type SlideId = Brand<string, 'SlideId'>
type ShapeId = Brand<string, 'ShapeId'>
```

模式扩展到任何新增 id/度量类型时遵循同一约定：数值型度量用 `Brand<number, TName>`，标识符用 `Brand<string, TName>`（模板字面量类型如 `` `${string}` `` 不额外嵌套，除非该 id 本身有结构化前缀需求，如 [09](./09-plugin-type-contracts.md) 的贡献点 id `` `${string}.${string}` ``——那是一个独立的、非品牌化的模板字面量类型场景，不要混淆两者）。

### 4.2 构造函数

每个品牌类型配一个同名小写开头的构造函数与一个 zod schema，两者在 `@cordexjs/shared` 内相邻定义：

```ts
// 示意
const EmuSchema = /* z.number().int() 与合法范围的组合 */
function toEmu(value: number): Emu { /* 校验 + 品牌化 */ }
```

构造函数是**唯一**合法的"裸值 → 品牌类型"入口；除 `@cordexjs/shared` 自身外，其余包不得对品牌类型使用 `as`（本就被 [02](./02-lint-rules.md) 全局禁止）或重新定义构造逻辑。

### 4.3 执行边界的诚实说明

品牌类型一旦被**使用**（函数签名声明形参为 `Emu` 而非 `number`），类型系统本身即closes the loop——由于 `as`/`any`/`!` 均已被 [02](./02-lint-rules.md) 与 [ADR-0041](../adr/0041-assertion-policy.md) 禁止，绕过构造函数、直接把裸 `number` 传给期望 `Emu` 的形参在**这种情况下**是编译错误，无需额外的扫描器。

本项目**无法机械保证**的是：一个**新**函数签名在设计时是否"记得"用品牌类型而不是裸 `number`/`string`（例如某个新写的坐标计算函数，作者忘记把参数类型声明为 `Emu` 而写成了 `number`）——这是概念性判断（"这个参数在语义上是不是一个 EMU 长度"），不是可 AST 化的规则。缓解手段：

1. 新增/修改的公开函数签名在 [04](./04-api-surface.md) 的 `.api.md` diff 里必然可见，代码评审是实际的把关点。
2. `contracts/*.ts` 文件（Definition 的聚集地）是品牌类型使用密度最高的地方，[02 §4.6](./02-lint-rules.md#46-cordexcontribution-file-naming) 的内聚约束间接提高了评审者在同一处看到"这里所有 id 都该是品牌类型"的概率。

### 4.4 派生字段标记（`Derived<T>`）

响应架构-结构条线对 `Derived<T>` 类型测试的需求，本节把 [lessons A6](../../00-charter/reference-univer-lessons.md)（"模型即快照，无持久层 vs 运行时层边界，派生字段混入持久化"）转写为与品牌类型同构的类型级标记模式，而非新发明一套机制：

```ts
// 示意，定义于 @cordexjs/model-core
type Derived<T> = T & { readonly __derived: true }
```

`Model`（运行时对象图，章程 §4 术语）里任何计算得出、不应写入 Snapshot 的字段，类型标注为 `Derived<T>`（如"渲染缓存的包围盒""样式继承解析后的最终值"）。Snapshot 类型**不是**手写的、与 Model 分开维护的另一份接口（那会重蹈 [05 §3](#3-schema-即类型源)"手写副本漂移"的覆辙），而是通过一个映射类型从 Model 类型**结构性剔除**全部 `Derived<T>` 字段推导得到：

```ts
// 示意
type Persisted<M> = { [K in keyof M as M[K] extends Derived<any> ? never : K]: M[K] }
type SlideSnapshot = Persisted<SlideModel>   // 派生字段在这里已经不存在，不是"被忽略"，是类型上不存在
```

这使得"派生字段混入持久化"从一个**需要靠评审/测试抓的运行时 bug**，变成一个**类型上不可表达**的状态——把一个包含 `Derived<T>` 字段的 Model 对象直接赋值给 `Persisted<M>` 类型的变量，如果没有真正经过 `Persisted<M>` 的构造路径（剔除多余字段），多余属性检查（excess property check，仅在对象字面量直接赋值时生效）或结构兼容性检查会在常见的误用形态下报错；更根本的保证来自"Snapshot 编解码器的返回类型就是 `Persisted<M>`，其字段集合由类型系统推导，不由作者手写"这一约定本身。

**类型测试**（[09 §6](./09-plugin-type-contracts.md#6-类型测试的组织方式) 组织约定下的具体案例）：每个含 `Derived<T>` 字段的 Model 类型，配一条 `*.type-test.ts` 断言 `keyof Persisted<M>` 不包含该派生字段名（`expectTypeOf<keyof Persisted<SlideModel>>().not.toEqualTypeOf<'boundingBoxCache'>()` 一类写法，示意），以及一条 `@ts-expect-error` 负例：直接把一个包含派生字段的字面量赋值给 `Persisted<M>` 类型的变量应编译失败。

---

## 5. Result 类型与异常的边界

完整决策见 [ADR-0043](../adr/0043-result-vs-exceptions.md)；本节给出边界处的具体分工。

- **预期失败**（用户输入不合法、网络请求失败、权限被拒绝、OOXML 解析遇到不认识的结构）：函数签名返回 `Result<T, E>`（判别联合：成功/失败两态），调用方**必须**处理两态（[02](./02-lint-rules.md) 的 `strict-type-checked` 预设本身通过穷尽性检查间接强制这一点——忽略判别联合的一支在 `switch`/`if` 收窄后若还有未处理分支，`noFallthroughCasesInSwitch`/返回值类型不匹配会报错）。§1 表格里的每一个校验边界，其校验失败路径统一走 `Result`，**不**抛异常——插件 `Config` 校验失败是唯一例外（cordis 原生行为：`ValidationError` 在 `ctx.plugin()` 层面就是 throw/reject，见 cordis primer §3.2，本项目不重新包装这一层，因为它发生在插件"能否启动"这个更早、更根本的时机，与"插件已启动、运行期处理一份不合法数据"是不同性质的失败）。
- **程序员错误/不变量违反**（"这不应该发生"：内部状态机进入了未定义分支、`fiber.getEffects()` 在断言应为空时非空、贡献点 key 冲突）：throw，且必须是继承自 `CordexError` 的类型化异常（不是裸 `throw new Error`，见 [02 §3](./02-lint-rules.md#3-禁用清单--具体规则映射)）。cordis 自身的 `CordisError`/`ValidationError` 正是这一类异常的先例（`ctx.effect()` 在 Fiber 已销毁时抛 `CordisError('INACTIVE_EFFECT')`——这是"调用方违反了生命周期契约"，不是"用户输入了脏数据"）。
- **异常在边界处的转换**：任何未被捕获的类型化异常，在到达以下三个终点之一时必须被转换为该终点的标准错误呈现形式，不得原样穿透：Fiber `apply` 顶层（cordis 内建捕获 + 转为 `FAILED` 状态，primer 决策表相关行为）、Nest 全局异常过滤器（`apps/server`）、React 错误边界（`apps/web`）。三个终点的错误码呈现体系由架构-运行时条线 B 的 10-observability 文档定义；本篇只约束"异常必须是类型化的、必须携带一个来自封闭 union 的 `code` 字段"这一**类型契约**，不定义具体错误码取值——该值域的所有权与本篇的交接需求见本次任务汇报的「跨条线要求」。

---

## 6. 与 cordis Standard Schema 的对接

- 插件 `Config` 字段直接声明为 zod schema（`Config: MyConfigSchema`）——cordis 4 原生识别 `StandardSchemaV1`，zod 4 原生实现该协议，中间**不需要**适配层。
- 校验时机与失败形态完全由 cordis 决定（primer §3.2："配置校验失败抛 `ValidationError`（聚合 Standard Schema issues）"），本篇不重新发明；[02 §4.9](./02-lint-rules.md#49-cordexconfig-fields-must-be-read) 与 [06 scan-config-usage](./06-scanners.md#7-scan-config-usage) 保证的是"schema 字段被使用"，不是"schema 校验本身被触发"（后者是 cordis 框架保证的，不需要本项目重复校验）。
- Manifest（`cordex-manifest.json`）本身也是一个边界产物（从源码生成、被 CI 与未来的插件市场工具读取），同样应以 zod schema 定义（`ManifestSchema`），`type Manifest = z.infer<typeof ManifestSchema>`，与 §3「schema 即类型源」规则自洽。细节见 [09 §3](./09-plugin-type-contracts.md#3-manifest-类型与-json-schema)。

---

## 7. 如何被机械验证（汇总）

| 声明 | 验证方式 | 失败信息来源 |
|---|---|---|
| §1 清单的每个边界都有 schema 校验 | 代码评审 + [06 scan-manifest](./06-scanners.md#6-scan-manifest)（对 `FormatCodec`/`DocumentStore` 等 Definition 实现的输入输出做符号级扫描，检测是否存在校验调用） | scan-manifest 报告；本项属该扫描器的已知覆盖率限制之一，详见 06 |
| 类型即 schema 推导 | [02 `cordex/schema-type-must-be-inferred`](./02-lint-rules.md#411-cordexschema-type-must-be-inferred新增超出建议清单) | ESLint 诊断 |
| 品牌类型不被绕过 | [02](./02-lint-rules.md) 的 `as`/`any`/`!` 禁令（间接） | ESLint 诊断 + [06 scan-type-escapes](./06-scanners.md#1-scan-type-escapes) 预算 |
| 裸 `throw new Error` 不出现 | [02 §3](./02-lint-rules.md#3-禁用清单--具体规则映射) `no-restricted-syntax` | ESLint 诊断 |
| Result 判别联合被穷尽处理 | tsc `strict` 家族的穷尽性检查（[01](./01-tsconfig-baseline.md)） | tsc 诊断 |
| 派生字段不进入 Snapshot | `Derived<T>`/`Persisted<M>` 类型结构（[§4.4](#44-派生字段标记derivedt)）+ [09 §6](./09-plugin-type-contracts.md#6-类型测试的组织方式) 类型测试 | tsc 诊断 / Vitest `--typecheck` 诊断 |

---

Sources（zod 4 / Standard Schema 现状，检索于 2026-09-14，用于确定本篇 §2 的版本锁定依据）：
- [Zod v4 Available with Major Performance Improvements and Introduction of Zod Mini - InfoQ](https://www.infoq.com/news/2025/08/zod-v4-available/)
- [Zod 4 and Standard Schema support in the TypeScript SDK - Inngest](https://www.inngest.com/changelog/2025-09-26-zod-4-standard-schema-support)
- [For library authors | Zod](https://zod.dev/library-authors)
