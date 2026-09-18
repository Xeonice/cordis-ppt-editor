> 状态：草稿 | 负责：架构-类型治理 | 更新：2026-09-14 | 依赖：charter v0.1

# 02 · Lint 规则集

本篇定义 `tooling/eslint-config/` 的全部规则语义：typescript-eslint 类型感知预设的启用姿态与偏离项、禁用清单到具体规则名的映射、21 条自定义 `oce/*` 规则的完整规格（原建议清单 10 条 + 本子线新增 1 条 `schema-type-must-be-inferred` + 响应 PRD/架构-结构/架构-运行时条线新增需求追加的 10 条，见 §4.12–§4.21），以及 ESLint 与 Biome 的职责切分。格式化规则**不**在本篇（见 [ADR-0044](../adr/0044-eslint-and-biome-split.md) 与 §6）。依赖方向类规则的**权威**判定在 [03-boundaries.md](./03-boundaries.md)（dependency-cruiser）；本篇的同类规则是编辑期的快速代理，两者关系见每条规则的「与 depcruise 的关系」说明。

---

## 1. `tooling/eslint-config/` 目录树

```
tooling/eslint-config/
├── package.json                内部包 @oce-tooling/eslint-config；devDependency 供各 packages/*、apps/* 引用
├── index.ts                    组合入口：导出一个 flat config 数组工厂 createConfig(pkgMeta)
│                                （pkgMeta 来自 packages/03-boundaries 定义的 package.json#oce 元数据）
├── base.ts                     语言选项：parserOptions.project（指向调用方 tsconfig）、ignore 列表、
│                                 typescript-eslint strict-type-checked + stylistic-type-checked 装配与偏离
├── rules/
│   ├── type-safety.ts          禁 any/as/!/@ts-ignore/Function/object/{}/enum/namespace 等（§3）
│   ├── restricted-imports.ts   §5 单点引入表 → no-restricted-imports 的按包 overrides 生成器
│   ├── restricted-globals.ts   §5 iso 同构全局名单 → no-restricted-globals 配置
│   └── style.ts                console/prototype/裸 throw/debugger 等语义类禁用（非格式化，见 §6 归属判断）
├── eslint-plugin-oce/          自定义规则插件（内部 npm 包 @oce-tooling/eslint-plugin-oce）
│   ├── package.json
│   ├── index.ts                规则注册表 + `recommended`/`strict` 两档导出 config
│   ├── rules/
│   │   ├── no-register-methods-outside-kernel.ts
│   │   ├── no-module-level-mutable-state.ts
│   │   ├── effect-owned-resources.ts
│   │   ├── events-must-be-declared.ts
│   │   ├── services-must-be-declared.ts
│   │   ├── contribution-file-naming.ts
│   │   ├── no-provider-import-in-consumer.ts
│   │   ├── deprecated-must-have-removal-version.ts
│   │   ├── config-fields-must-be-read.ts
│   │   ├── no-mixin-outside-kernel.ts
│   │   ├── schema-type-must-be-inferred.ts
│   │   ├── no-doc-type-literals.ts
│   │   ├── no-unit-scoped-inject-at-root.ts
│   │   ├── no-boolean-command-result.ts
│   │   ├── telemetry-events-must-be-declared.ts
│   │   ├── command-must-declare-capabilities.ts
│   │   ├── no-index-in-mutation.ts
│   │   ├── no-waterfall-in-render-hot-path.ts
│   │   ├── capability-vocabulary-single-source.ts
│   │   ├── store-transact-in-commands-only.ts
│   │   └── nest-controller-dto-from-protocol.ts
│   └── __tests__/
│       ├── no-register-methods-outside-kernel.test.ts
│       ├── no-module-level-mutable-state.test.ts
│       ├── effect-owned-resources.test.ts
│       ├── events-must-be-declared.test.ts
│       ├── services-must-be-declared.test.ts
│       ├── contribution-file-naming.test.ts
│       ├── no-provider-import-in-consumer.test.ts
│       ├── deprecated-must-have-removal-version.test.ts
│       ├── config-fields-must-be-read.test.ts
│       ├── no-mixin-outside-kernel.test.ts
│       ├── schema-type-must-be-inferred.test.ts
│       ├── no-doc-type-literals.test.ts
│       ├── no-unit-scoped-inject-at-root.test.ts
│       ├── no-boolean-command-result.test.ts
│       ├── telemetry-events-must-be-declared.test.ts
│       ├── command-must-declare-capabilities.test.ts
│       ├── no-index-in-mutation.test.ts
│       ├── no-waterfall-in-render-hot-path.test.ts
│       ├── capability-vocabulary-single-source.test.ts
│       ├── store-transact-in-commands-only.test.ts
│       └── nest-controller-dto-from-protocol.test.ts
└── biome-boundary.md            速查表：某条规则该找 ESLint 还是 Biome（人类可读镜像，机器权威见 ADR-0044）
```

每条自定义规则的测试文件使用 `@typescript-eslint/rule-tester`（支持类型感知规则的 `RuleTester`），结构固定为 `valid: RuleTester.ValidTestCase[]` 与 `invalid: RuleTester.InvalidTestCase[]`。**没有 `invalid` 用例（负向测试）的规则不得合入 `index.ts` 的导出表**——这是 [lessons A17](../../00-charter/reference-univer-lessons.md) 的直接执行点，机械校验见 [06 scan-policy](./06-scanners.md#9-scan-policy)（它会解析 `eslint-plugin-oce/rules/*.ts` 的规则名清单，逐一确认 `__tests__/` 下有同名文件且该文件的 `invalid` 数组非空；缺失则 `policy-check` job 失败，信息形如 `[scan-policy] rule 'oce/no-mixin-outside-kernel' has no negative test in __tests__/no-mixin-outside-kernel.test.ts`）。

---

## 2. typescript-eslint 预设姿态

**基线姿态**：`strict-type-checked` 与 `stylistic-type-checked` 两个预设**全部规则设为 `error`**（非 `warn`——本项目不存在 `warn` 级别，见 [README](./README.md) 的「无 --quiet」原则与 [lessons A16](../../00-charter/reference-univer-lessons.md)）。`base.ts` 不逐条重复列出预设自带的规则，只列出**偏离表**（关闭、加严、改参数）；未出现在偏离表里的预设规则一律维持预设默认（在 `error` 级别下）。

### 2.1 偏离表

| 规则 | 预设默认 | 本项目调整 | 理由 |
|---|---|---|---|
| `@typescript-eslint/no-explicit-any` | `warn`（`recommended`）/ 未强制 error | **error，且不接受任何 `ignoreRestArgs` 例外** | R7 核心；显式 `any` 的机械预算见 [06 scan-type-escapes](./06-scanners.md#1-scan-type-escapes) |
| `@typescript-eslint/no-unsafe-*` 系列（`no-unsafe-argument`/`assignment`/`call`/`member-access`/`return`） | `strict-type-checked` 内已是 `error` | 维持 `error`，**不下调** | 这是 `any` 在类型系统里"扩散"的唯一检测点：显式 `any` 被禁止后，`no-unsafe-*` 拦截"any 从未类型化的第三方库偷渡进来"这一条剩余通道 |
| `@typescript-eslint/consistent-type-imports` | `stylistic` 内为 `error`，`fixStyle` 默认 `separate-declarations` | `fixStyle: 'top-level'` 改为按文件场景配置：`*.contribution.ts` 强制 `inline-type-imports: false`（禁止内联 `import { type X }`，必须整条 `import type`），其余文件维持 `separate-declarations` | `*.contribution.ts` 的"零运行时导入"约束（见 §4.6/[09](./09-plugin-type-contracts.md)）要求该文件里任何 `import` 语句本身就是可疑信号，整条 `import type` 便于人工/脚本快速扫描该文件是否有非 type 导入 |
| `@typescript-eslint/no-non-null-assertion` | `recommended` 内 `error` | 维持 `error`；补充 `no-restricted-syntax` 精确匹配 `TSNonNullExpression` 以获得统一的 `oce-allow` 引用格式（见 §3） | 统一豁免格式需要 |
| `@typescript-eslint/restrict-template-expressions` | `strict-type-checked` `error`，默认禁止 `any`/`unknown`/对象等插入模板字符串 | 追加 `allowNumber: true, allowBoolean: true`，其余维持默认禁止 | 事件名/服务名/贡献点 id 大量使用模板字面量类型拼接（`` `${域}.${名}` ``），数字/布尔值插值在诊断信息里常见且安全 |
| `@typescript-eslint/no-unused-vars` | `error` | 追加 `argsIgnorePattern: '^_'`、`varsIgnorePattern: '^_'`、`caughtErrorsIgnorePattern: '^_'` | 与 [01](./01-tsconfig-baseline.md#22-超出-strict-的额外严格项本表是-d9最严格集的主体) 的 tsc `noUnusedLocals`/`noUnusedParameters` 互为编辑期/编译期双保险；下划线前缀是"有意暂不使用"的标准约定，用于占位形参（如 waterfall 监听器不需要用到 `next` 之外的某个参数） |
| `@typescript-eslint/no-empty-function` | `stylistic-type-checked` `error` | 追加 `allow: ['arrowFunctions']` 且仅当该空箭头函数**直接是 `ctx.effect()` 的 disposer 返回值**时豁免（通过 `no-empty-function` 的 `allow` 选项做不到这么精确，实际由该场景总是有清理逻辑而非空函数来保证；此偏离仅为文档记录，未来若发现误报再收紧） | 记录待观察项，非当前必须变更 |
| `@typescript-eslint/naming-convention` | 预设不强制 | 新增（非预设自带，视为本项目对 `stylistic-type-checked` 的补充）：接口/类型别名 `PascalCase`；类型参数 `PascalCase` 且长度 >1（禁止裸 `T`/`K`，要求 `TItem`/`TKey` 一类的语义化命名，除非是 3 型参数以内的通用工具函数）；品牌类型（见 [05](./05-runtime-boundaries.md)）以外禁止 `type X = string` 这种"裸别名不带品牌"的隐式约定 | 提升贡献点/服务泛型代码的可读性；与 lessons A14（`ComponentType<T> = any` 一类"幽灵泛型"）直接对应——命名约定虽不能杜绝幽灵泛型，但能让**未使用**的类型参数在代码评审里更显眼 |

### 2.2 明确关闭的预设规则

| 规则 | 关闭理由 |
|---|---|
| `@typescript-eslint/no-magic-numbers`（若预设未来启用） | 与 OOXML 单位换算（EMU/Point 转换常数）、布局引擎的几何计算冲突过大；改用 code review + 品牌类型（[05](./05-runtime-boundaries.md)）承担"防止裸数字越界"的职责 |
| `@typescript-eslint/sort-type-constituents` | 与团队既有的"按语义分组而非字母序"排列联合类型的约定冲突；交给 Biome 的 import/成员排序能力处理**可排序的**部分，联合类型顺序不做机械约束 |

不在此表出现的预设规则一律保持预设默认设置与 `error` 级别；新增/调整偏离项需在 PR 中更新本表，`policy-check` 不校验偏离表本身的完整性（这是文档纪律而非机械门禁——机械门禁只能验证"配置文件里实际生效的规则集"，无法验证"文档是否如实描述了它"；这是 README「待决事项」记录的已知盲区之一）。

---

## 3. 禁用清单 → 具体规则映射

| 禁止项 | 规则 | 例外 |
|---|---|---|
| `any`（显式） | `@typescript-eslint/no-explicit-any` | 无（生产代码预算为 0；测试 fixture 需要构造"故意错误类型"时用 `oce-allow`） |
| `any` 扩散（隐式经第三方库） | `@typescript-eslint/no-unsafe-argument`/`no-unsafe-assignment`/`no-unsafe-call`/`no-unsafe-member-access`/`no-unsafe-return` | 无 |
| 非空断言 `!` | `@typescript-eslint/no-non-null-assertion` + `no-restricted-syntax`（`TSNonNullExpression`，用于统一失败信息格式） | `oce-allow` + 说明；替代方案见 [ADR-0041](../adr/0041-assertion-policy.md) |
| 类型断言 `as`（除 `as const`/`satisfies`） | `no-restricted-syntax`，选择器 `TSAsExpression:not([typeAnnotation.type='TSTypeReference'][typeAnnotation.typeName.name='const'])`（语义：匹配所有 `as X`，`as const` 因其 `typeAnnotation` 是特殊的 `const` 关键字节点被结构性排除） | `as const`、`satisfies`（`satisfies` 是独立语法节点 `TSSatisfiesExpression`，本身不在禁止之列）、`oce-allow` |
| `@ts-ignore` | `@typescript-eslint/ban-ts-comment` 配置 `ts-ignore: true`（完全禁止，不接受任何形式） | 无例外——`@ts-ignore` 与 `@ts-expect-error` 的核心区别是前者在类型错误消失后不会自动报错、会悄悄变成死注释，本项目**不允许**这一失效模式存在 |
| `@ts-expect-error` 无说明 | `@typescript-eslint/ban-ts-comment` 配置 `ts-expect-error: { descriptionFormat: '^: (oce-allow\\(.+\\): .+|TS-\\d+ .+)' }` | 必须带 `oce-allow` 引用（架构性豁免）或 `TS-<issue> <原因>` 格式（临时性、已建卡跟踪的类型系统限制，如第三方库声明文件缺陷） |
| `Function` 类型 | `@typescript-eslint/ban-types`（或其后继 `no-restricted-types`，随 typescript-eslint 版本变化，语义不变） | 用具体函数签名或 `(...args: unknown[]) => unknown` 替代 |
| `object` / `{}` 类型 | 同上 | `object` 用 `Record<string, unknown>` 或具体接口替代；`{}` 用 `Record<string, never>`（真正的"空对象"）或 `unknown` 替代 |
| `enum` | `no-restricted-syntax`（`TSEnumDeclaration`）+ 编译期 `erasableSyntaxOnly`（[01](./01-tsconfig-baseline.md#23-r7-专项isolateddeclarations-与-verbatimmodulesyntax)，`packages/*` 强制） | 无例外；详见 [ADR-0042](../adr/0042-no-enums-const-objects.md) |
| `namespace`/`module` 的运行时用法 | `no-restricted-syntax`（`TSModuleDeclaration[body.body.length>0]` 排除仅含 `interface`/`type` 声明的合并场景；纯类型声明合并——即 `declare module '@oce/kernel' { interface Events {...} }`——不受影响） | 类型声明合并（[09](./09-plugin-type-contracts.md)）不受限；带可执行语句的 `namespace Foo { export function bar() {} }` 一类禁止 |
| 裸 `throw new Error(...)` | `no-restricted-syntax`，选择器 `ThrowStatement > NewExpression[callee.name='Error']`（同时覆盖 `TypeError`/`RangeError` 等内建 Error 子类的字面量构造） | 必须 `throw` 一个继承自 `OceError`（[05](./05-runtime-boundaries.md#4-result-类型与异常的边界) / [ADR-0043](../adr/0043-result-vs-exceptions.md)，类型契约由架构-运行时 B 的错误码体系提供基类）的实例 |
| `console.*` | `no-console`（全禁，不设 `allow` 列表） | 结构化 `logger` 服务（primer/章程 D11）替代；测试文件同样禁止，测试断言失败信息用测试框架自身的报告机制 |
| `debugger` 语句 | `no-debugger`（**零豁免**，不接受 `oce-allow`——这是用户全局开发纪律的强制项，见 [07](./07-hooks-and-ci.md#2-lefthook-阶段) 的 pre-commit 说明） | 无 |
| `prototype` 赋值 | `no-restricted-syntax`，选择器覆盖 `AssignmentExpression[left.property.name='prototype']` 与 `MemberExpression[property.name='prototype'] = ...` 的成员赋值形态 | 仅 `packages/kernel/src/**` 允许（`ctx.mixin` 的内部实现），由 `oce/no-mixin-outside-kernel`（§4.10）而非本条 ESLint 内建规则承担"外部包用了就报错"的语义，本条 `no-restricted-syntax` 是**全局**兜底（含 `kernel` 自身文件命名不规范时的兜底），两者共同覆盖 primer MUST NOT #7 |
| 第三方库单点引入 | `no-restricted-imports`（§5.1 生成） | 见 §5.1 |
| 同构全局越界 | `no-restricted-globals`（§5.2 生成，仅 iso 包） | 见 §5.2 |
| 自造框架核心方法（如 `ctx.fork()`） | `no-restricted-properties`，配置为禁止定义或调用属性名匹配一份"cordis 保留名单"（`fork` 等 primer 明确排除的 API）的成员，作用域为除 `packages/kernel/src/**` 外的全部包；与 `oce/contribution-file-naming`（§4.6）共同限制"合法的 `declare module 'cordis'`/`'@oce/kernel'` 增强范围"——后者管住"在哪个文件可以做声明合并"，本条管住"声明合并里不能凭空发明框架已明确不存在的核心 API" | primer MUST NOT #6 的直接执行点；`oce-allow` 可用但预算恒为 0（该名单本身极小且稳定，出现豁免大概率意味着 cordis 版本升级引入了同名新 API，需先核实而非绕过） |

---

## 4. 自定义规则：`eslint-plugin-oce`

**共同设计原则**：凡是"事实分散在多个文件才能判断"的规范（Provider/Consumer 关系、Config 字段是否被读取），本插件只做**同文件/单符号的启发式检测**，给出编辑期的即时反馈；**跨文件的权威裁决**交给 [06-scanners.md](./06-scanners.md) 对应的扫描器或 [03-boundaries.md](./03-boundaries.md) 的 dependency-cruiser 规则，CI 以扫描器/depcruise 的结果为准。每条规则下方标注它与哪个权威裁决者配对。

**共同豁免格式**：`// oce-allow(<rule-id>): <issue-url>`，`<rule-id>` 为不带 `oce/` 前缀的规则名（如 `oce-allow(no-mixin-outside-kernel): https://github.com/.../issues/123`）。豁免不是免检——每条豁免计入 [06 scan-type-escapes](./06-scanners.md#1-scan-type-escapes) 或对应扫描器的预算统计，受 [ADR-0040](../adr/0040-type-budgets-and-ratchet.md) 的 ratchet 约束。全部 21 条规则均**不提供自动修复**（`fixable: undefined`）：它们检测的是架构/语义违规，机械改写有很高概率产出"能通过 lint 但语义错误"的代码（例如把 `register*` 方法机械改名成别的前缀并不能让它真正变成一个 ContributionPoint）；自动修复只属于 Biome 管辖的纯格式化范畴（[ADR-0044](../adr/0044-eslint-and-biome-split.md)）。

### 4.1 `oce/no-register-methods-outside-kernel`

- **目的**：D3（唯一注册抽象）；规避 [lessons A8](../../00-charter/reference-univer-lessons.md)（104 个 `register*`）。
- **检测方式（AST）**：扫描 `FunctionDeclaration`/`MethodDefinition`/对象字面量属性中值为函数的成员，标识符匹配 `/^register[A-Z]/`；同时扫描类似 `SomeClass.prototype.registerXxx = function` 的赋值形态。文件路径**不**匹配 `packages/kernel/src/**` 时报错。
- **自动修复**：无（改名不解决语义问题——真正的修复是改用 `defineContributionPoint`/`ctx.contribute`）。
- **负向测试样例**：`packages/model-slide/src/services/shape.service.ts` 内定义 `registerShapeKind(kind) { ... }` → 报错，信息含"使用 ctx.contribute(shapeKindPoint, ...) 替代"；同一函数体移动到 `packages/kernel/src/host.ts` → 通过。
- **与权威裁决者的关系**：本规则本身就是权威（纯语法/路径判断，无需跨文件事实），不需要配对扫描器。

### 4.2 `oce/no-module-level-mutable-state`

- **目的**：primer MUST #3（禁止假定插件单实例）；规避 [lessons A10](../../00-charter/reference-univer-lessons.md)（94 处顶层副作用注册）。
- **检测方式（AST）**：模块顶层（`Program.body` 直接子节点）出现 `let`/`var` 声明；或顶层 `const` 绑定到 `NewExpression`（`new Map()`/`new Set()`/`new WeakMap()` 等）、数组字面量、对象字面量（非 `as const` 且非通过 `Object.freeze` 包裹）。豁免：测试文件（`__tests__/**`）、`kernel` 内的诊断/单例工具（有限白名单，需 `oce-allow` 逐一登记而非目录级豁免，保持可审计）。
- **自动修复**：无。
- **负向测试样例**：`const cache = new Map<UnitId, Snapshot>()` 写在模块顶层 → 报错；同样的 `new Map()` 写在 `export const plugin: Plugin.Function = (ctx) => { const cache = new Map(); ... }` 函数体内部（每次插件 `apply` 时新建）→ 通过；`const cache = () => new Map()`（工厂函数，调用者各自持有实例）→ 通过。
- **与权威裁决者的关系**：本规则的假阳性来源主要是"顶层 const 绑定到一个从未被跨激活期共享的只读查找表"（例如 `as const` 常量表本身没问题，已被结构性排除）；不需要额外扫描器兜底，误报由 `oce-allow` 个案豁免。

### 4.3 `oce/effect-owned-resources`

- **目的**：primer MUST #2；继承 [lessons K5](../../00-charter/reference-univer-lessons.md)（Disposable 纪律）。
- **检测方式（AST）**：调用表达式匹配一份可配置的"原生资源构造器"名单（`setTimeout`/`setInterval`/`requestAnimationFrame`/`addEventListener`/`new MutationObserver`/`new ResizeObserver`/`new IntersectionObserver`/`new WebSocket`/`new BroadcastChannel`）时，向上遍历祖先节点，要求存在一个祖先 `CallExpression`，其 `callee` 是 `*.effect`（成员表达式的属性名为 `effect`）且当前节点位于该调用**第一个参数**（返回 disposer 的函数）的函数体内。未找到这样的祖先则报错。
- **自动修复**：无。
- **负向测试样例**：`apply(ctx) { window.addEventListener('resize', onResize) }`（无包裹）→ 报错；`apply(ctx) { ctx.effect(() => { window.addEventListener('resize', onResize); return () => window.removeEventListener('resize', onResize) }) }` → 通过。
- **与权威裁决者的关系**：配对 [06 scan-effects](./06-scanners.md#3-scan-effects)——本规则只能证明"资源获取调用**在词法上**被 `ctx.effect` 包裹"，无法证明"卸载后该资源真的被释放"（运行时事实）；scan-effects 审计每个定义了 effect 的包是否存在断言 `fiber.getEffects()` 卸载后为空的测试用例，把primer MUST #7 的"测试卸载"落到实处。

### 4.4 `oce/events-must-be-declared`（含域白名单子检测，响应架构-结构条线 `event-domain-whitelist`）

- **目的**：章程 §5.5（事件必须在 `Events` 接口声明）+ 域命名空间治理——防止第三方插件的事件域与未来新增的第一方域碰撞（如第三方插件先用了 `comment/` 域，第一方后续也想加评论功能）。
- **检测方式（AST + 类型信息）**：对 `ctx.emit`/`ctx.parallel`/`ctx.serial`/`ctx.bail`/`ctx.waterfall`/`ctx.on`/`ctx.once` 的调用，取事件名参数（`emit`/`parallel`/`serial`/`bail`/`waterfall` 为第一个参数，或第二个参数当第一个参数是 `thisArg` 时——通过参数个数与首参类型区分）：
  1. 若该参数不是字符串字面量（`Literal`/模板字面量的静态部分），直接报错——**动态事件名禁止**，因为静态类型检查（`keyof Events`）在这种写法下会退化为宽泛的 `string`，等于关闭了 primer §3.4 描述的编译期事件表校验。
  2. 若是字符串字面量，用类型检查器解析当前上下文的 `Events` 接口（含声明合并后的增强），确认该字面量是其一个 key；这一步 TS 本身已经会报类型错误，规则的增量价值是给出**指向本项目文档**的更友好信息，以及在 §5.5 命名模式（`<域>/<动作>`）不匹配时报错（TS 类型系统本身不检查命名风格）。
  3. **域白名单**：事件名 `<域>` 段必须满足以下二选一——(i) 属于一份第一方保留域清单（`tooling/policy/event-domains.json`，草案路径，列出 `unit`/`command`/`store`/`slide`/`doc`/`sheet`/`collab`/`ui`/`presence` 等已知第一方域，随水平层/垂直束新增而追加，变更走 PR 评审）；(ii) 匹配 `^[a-z][a-zA-Z0-9-]*:` 前缀（`<vendor>:` 形式，第三方插件必须以自己的厂商/插件标识作为前缀，如 `acme-plugin:widget/added`）。不满足任一条件（如裸用一个不在清单里的域、且没有 `:` 前缀）报错。
- **自动修复**：无。
- **负向测试样例**：`ctx.emit(eventName, unitId)`（`eventName` 是变量）→ 报错；`ctx.emit('shapeAdded', unitId)`（驼峰而非 `域/动作`，即使已在某处声明）→ 报错；`ctx.emit('widget/added', ...)`（`widget` 域既不在第一方清单也无 `vendor:` 前缀，疑似第三方插件未加前缀）→ 报错；`ctx.emit('slide/shape-added', unitId, shapeId)`（`slide` 在第一方清单，已在 `*.contribution.ts` 声明合并）→ 通过；`ctx.emit('acme-plugin:widget/added', ...)` → 通过。
- **与权威裁决者的关系**：规则 1-2 是权威（类型信息可在单文件内完整解析）；规则 3（域白名单）依赖 `event-domains.json` 这一外部清单文件，理论上可能漂移（清单没更新、新域已经在别处用了但清单未同步），机械层面这一漂移由 [06 scan-policy](./06-scanners.md#9-scan-policy) 的元数据 schema 校验族兜底覆盖不到（清单内容本身不是 schema 能校验的"合法性"问题，是"完整性"问题）——记录为已知盲区，见 README 待决事项。

### 4.5 `oce/services-must-be-declared`

- **目的**：章程 §5.5（服务名固定表 + 声明合并校验）。
- **检测方式**：与 4.4 同构，作用于 `ctx.get`/`ctx.set`/`ctx.provide`/`ctx.isolate`/`ctx.intercept` 的服务名参数与 `Plugin.inject`/`provide` 字段的字符串（含对象形式 `inject: { store: {...} }` 的 key）。命名模式校验为"固定服务名表"（`units`/`documentTypes`/`store`/`commands`/`history`/`formats`/`resources`/`migrations`/`permissions`/`collab`/`presence`/`layout`/`render`/`ui`/`shortcuts`/`i18n`/`theme`/`errors`/`telemetry`/`logger`）+ 垂直束服务的 `<bundle>Xxx` camelCase 模式（如 `slides`），而非自由的域前缀模式（服务名不像事件名允许自由扩展域前缀，因为服务名要挂在 `ctx.<name>` 上，命名空间比事件更贵）。
- **自动修复**：无。
- **负向测试样例**：`inject: [serviceNameVar]`（动态）→ 报错；`ctx.get('slideStore')`（不在固定表也不匹配 `<bundle>Xxx` 模式）→ 报错；`inject: ['store', 'history']` → 通过。
- **与权威裁决者的关系**：权威（同 4.4 的理由）。

### 4.6 `oce/contribution-file-naming`

- **目的**：primer §5.3 插件文件约定。
- **检测方式**：
  1. 任意文件若包含顶层 `declare module '@oce/kernel' { ... }` 或调用 `defineContributionPoint(`，文件名必须匹配 `*.contribution.ts`；否则报错。
  2. 反向约束：文件名匹配 `*.contribution.ts` 的文件中，除 `import type` 外不得出现任何值导入（`ImportDeclaration` 且无 `importKind: 'type'` 且说明符列表非空）；也不得出现任何可执行语句（`ExpressionStatement`/`VariableDeclaration` 绑定到非 `defineContributionPoint(...)` 调用的其他运行时构造）——保证该文件在打包时可被视为"零运行时体积"。
  3. `plugin.ts` 文件必须导出符合 `Plugin.Function`/`Plugin.Constructor`/`Plugin.Object` 形状之一的默认或命名导出，且若导出 `Config`，其值必须是 `import`（非本地重新定义）自 `contracts/*.schema.ts` 的 Standard Schema——**不允许**在 `plugin.ts` 内联定义 schema（保持"契约与装配分离"，也让 `oce/schema-type-must-be-inferred` §4.11 的检查范围稳定聚焦在 `contracts/`）。
  4. `manifest.ts` 文件必须导出 `const manifest: Manifest`（类型标注是硬性的——呼应 [09 §5](./09-plugin-type-contracts.md#5-isolateddeclarations-下的导出约束) 的 `isolatedDeclarations` 要求）。
- **自动修复**：无（涉及文件重命名，ESLint fixer 不操作文件系统路径）。
- **负向测试样例**：`shape-kind.ts`（非 `.contribution.ts`）内出现 `declare module '@oce/kernel'` → 报错；`shape-kind.contribution.ts` 内 `import { ShapeKindService } from '../services/shape-kind.service'`（值导入）→ 报错；同文件改为 `import type { ShapeKindService } from '../services/shape-kind.service'` 并只调用 `defineContributionPoint(...)` → 通过。
- **与权威裁决者的关系**：配对 [06 scan-contributions](./06-scanners.md#2-scan-contributions)——本规则保证"文件形状正确"，scan-contributions 保证"内容与 manifest.ts / 生成的 `oce-manifest.json` 一致"（跨文件事实）。

### 4.7 `oce/no-provider-import-in-consumer`

- **目的**：章程 §5.3 规则 6（三角色）。
- **检测方式（AST + 包元数据）**：读取当前文件所属包的 `package.json#oce.role`；若为 `consumer` 且 `compositionRoot` 不为 `true`（元数据 schema 见 [03 §2](./03-boundaries.md#2-包元数据-schema)），解析每条 `import`/动态 `import()` 的目标模块归属包，若目标包 `oce.role === 'provider'`，报错。
- **自动修复**：无。
- **负向测试样例**：`packages/slide-render`（role: consumer, compositionRoot: false）内 `import { YjsStore } from '@oce/store-yjs'` → 报错，信息含"consumer 只能依赖 Definition（@oce/model-core），具体 Provider 由 preset 组装"；同文件改为 `import type { DocumentStore } from '@oce/model-core'` → 通过；`packages/preset-slide-collab`（`compositionRoot: true`）内导入 `@oce/store-yjs` → 通过。
- **与权威裁决者的关系**：本规则是**代理**，权威在 [03](./03-boundaries.md#6-规则-6三角色) 的 `oce-role-provider-no-cross-import`/`oce-role-consumer-definition-only` dependency-cruiser 规则——depcruise 看到的是整个包图（含本规则看不到的动态 import、re-export 链、类型剥离后的构建产物依赖），是 CI 阻断的最终依据；本规则只提供编辑器内的即时红线。

### 4.8 `oce/deprecated-must-have-removal-version`

- **目的**：规避 [lessons A22](../../00-charter/reference-univer-lessons.md)（废弃流程声明了但 `deprecate()` 调用为 0）。
- **检测方式**：任意导出声明（函数/类/接口/类型别名/常量）的 JSDoc 含 `@deprecated` 标签时，同一 JSDoc 块必须存在 `@removeIn <token>` 标签，`token` 匹配 `^M[0-9]+$`（里程碑，如 `M4`）或合法 semver（`^\d+\.\d+\.\d+$`）。
- **自动修复**：无。
- **负向测试样例**：`/** @deprecated 用 newFn 替代 */ export function oldFn() {}` → 报错（缺 `@removeIn`）；追加 `@removeIn M4` → 通过。
- **与权威裁决者的关系**：配对 [06 scan-deprecations](./06-scanners.md#8-scan-deprecations)——本规则保证"格式合规"，scan-deprecations 保证"到期后真的失败"（跨时间维度的事实，无法在单次 lint 运行中判断"现在是否已到 M4"，需要扫描器读取当前里程碑/版本状态）。

### 4.9 `oce/config-fields-must-be-read`

- **目的**：规避 [lessons A26](../../00-charter/reference-univer-lessons.md)（规模保护配置的消费点 "not implemented yet"）。
- **检测方式（同文件启发式）**：在 `contracts/*.schema.ts` 文件内，对每个 `z.object({...})` 顶层字段名，在**同一 `plugin.ts` 文件**（通过固定的相对路径约定 `../plugin.ts` 定位；跨包/跨目录布局不在本规则覆盖范围）中搜索是否存在 `config.<field>` 或解构 `{ <field> }`/`{ <field>: renamed }` 的引用；未找到则报警（注意：这是**同文件**启发式，天然会漏掉"字段在 `services/*.service.ts` 里被消费"的常见情况）。
- **自动修复**：无。
- **负向测试样例**：`ConfigSchema = z.object({ maxUndoStackSize: z.number() })`，`plugin.ts` 全文不出现 `maxUndoStackSize` → 报错；`plugin.ts` 内 `const { maxUndoStackSize } = config` → 通过。
- **与权威裁决者的关系**：配对 [06 scan-config-usage](./06-scanners.md#7-scan-config-usage)——本规则的漏报率较高（明确记录，见 §4 段首"共同设计原则"），**CI 阻断以 scan-config-usage 的全包跨文件扫描为准**；本规则仅作为编辑器内的早期提示，不代表通过本规则就等于满足规范。

### 4.10 `oce/no-mixin-outside-kernel`

- **目的**：primer MUST NOT #7；规避 [lessons A12](../../00-charter/reference-univer-lessons.md)（原型 monkey-patch facade）。
- **检测方式**：调用 `ctx.mixin(`（成员表达式属性名为 `mixin`）或对 `*.prototype.<name>` 的赋值/`Object.defineProperty(X.prototype, ...)`，文件路径不匹配 `packages/kernel/src/**` 时报错。
- **自动修复**：无。
- **负向测试样例**：`packages/ui-core/src/plugin.ts` 内 `ctx.mixin('shortcuts', ['on'])` → 报错；同调用出现在 `packages/kernel/src/host.ts` → 通过。
- **与权威裁决者的关系**：与 §3 的通用 `prototype` 赋值 `no-restricted-syntax` 规则组合覆盖（该通用规则捕获**所有**路径的 `prototype` 赋值语法，本规则额外捕获 `ctx.mixin` 这一 cordis 特有 API 且给出更精确的"仅 kernel 例外"信息）；不需要额外扫描器。

### 4.11 `oce/schema-type-must-be-inferred`（新增，超出建议清单）

- **新增理由**：D2「Standard Schema（默认 zod）… 边界校验」隐含「schema 即类型源」——[05 §3](./05-runtime-boundaries.md#3-schema-即类型源) 把它列为硬规则，但建议清单里的 10 条规则均未覆盖"类型是否真的从 schema 推导而来、而非手写副本"这一失配点，故补充第 11 条。
- **目的**：防止 `contracts/*.schema.ts` 里出现手写接口与 zod schema 描述同一形状却随时间漂移（字段增删只改了一边）。
- **检测方式**：在 `contracts/*.schema.ts` 文件内，对每个顶层 `export const <Name>Schema = z.object(...)`（或 `z.union`/`z.discriminatedUnion` 等顶层 Standard Schema 构造），要求同文件内存在 `export type <Name> = z.infer<typeof <Name>Schema>`（或 `StandardSchemaV1.InferOutput<typeof <Name>Schema>`，两种推导写法皆可）；若文件内存在与 `<Name>` 同名但类型是**手写字面量**（`interface <Name>` 或 `type <Name> = { ... }` 而非 `z.infer<...>`）的声明，报错。
- **自动修复**：无。
- **负向测试样例**：`export const SlideConfigSchema = z.object({ maxPages: z.number() })` 与 `export interface SlideConfig { maxPages: number }`（手写、未用 `z.infer`）并存 → 报错；改为 `export type SlideConfig = z.infer<typeof SlideConfigSchema>` → 通过。
- **与权威裁决者的关系**：权威（同文件内可判定，不存在跨文件漂移场景——如果类型和 schema 分处两个文件，那本身已经违反 §4.6 `oce/contribution-file-naming` 对 `contracts/*.ts` 内聚性的隐含要求）。

### 4.12 `oce/no-doc-type-literals`（新增，响应架构-结构条线 `no-doc-type-literals`）

- **目的**：章程 R5/§5.1（"文档类型盲"）在**值**层面的对偶——[03](./03-boundaries.md) 的 `oce-doc-type-blind` depcruise 规则只能拦住水平层 `import` 垂直束**包**；一个水平层文件完全可以不 `import` 任何垂直束包，却硬编码一个恰好等于某个文档类型 id 的字符串字面量做比较（如 `if (kind === 'slide') { ... }`），这种"认识具体文档类型"的耦合不经过依赖图，import 图规则看不见它。
- **检测方式（AST + 包元数据）**：读取工作区内全部包 `package.json#oce.bundle` 出现过的取值集合，作为"已知文档类型 id"名单（**自动从元数据派生，不手工维护**——手工维护的名单本身会漂移，见 §5 的教训）；在 `oce.bundle` 为空（水平层）的包内，扫描 `BinaryExpression`（`===`/`==`/`!==`/`!=`）与 `SwitchCase` 的字面量操作数，若其值等于名单中的某个 id，报错。
- **自动修复**：无。
- **负向测试样例**：`packages/engine-render/src/dispatch.ts` 内 `if (unit.documentType === 'slide') { ... }` → 报错（`engine-render` 是水平层，`'slide'` 是已知 `bundle` 取值）；同样的比较出现在 `packages/model-slide/src/**`（`bundle: 'slide'` 自身）→ 通过（一个垂直束认识自己的 id 不是耦合）；水平层代码改为 `ctx.documentTypes.get(unit.documentType).render(...)`（经贡献点查表分发，不做字面量比较）→ 通过。
- **与权威裁决者的关系**：本规则是权威（名单本身由元数据自动派生，不存在"名单没跟上"的漂移风险；检测范围是单文件语法匹配，不需要跨文件事实）。

### 4.13 `oce/no-unit-scoped-inject-at-root`（新增，响应架构-结构条线 `no-unit-scoped-inject-at-root`）

- **目的**：primer §5.1 的 `UnitScope` 约定（由 model-core 的 `units` 经 kernel `createIsolatedScope` 构造；`openUnitScope` 一词已废弃，裁决 C-4）——`store`/`history`/`selection`/`render`/`presence`（章程 §5.5 固定服务名表中标注为"UnitScope 内"的服务）只在 `ctx.isolate()` 隔离出的每文档作用域内有意义；在根 Context（预设组装、尚未打开任何文档的阶段）`inject`/`ctx.get()` 这些服务名，语义上是错误的（要么永远拿不到、要么会污染跨文档共享的解析域）。
- **检测方式（AST，启发式）**：`Plugin.Base.inject`（数组或对象字面量）或 `ctx.get(...)` 调用中出现固定的 UnitScope 服务名（`store`/`history`/`selection`/`render`/`presence`）时，向上查找当前代码路径是否被 `openUnitScope(...)` 调用"覆盖"——具体判定：该 `inject`/`ctx.get` 所在的插件定义，其**装配点**（在 `compositionRoot: true` 的包内被 `ctx.plugin(...)` 挂载的位置）是否位于某个 `openUnitScope(ctx, unit)` 返回的子 `ctx` 之下。这一判定需要一定的调用图追踪，比本文件其余规则更依赖启发式，**已知会有漏报**（如经过多层函数间接转发 `ctx` 的场景）。
- **自动修复**：无。
- **负向测试样例**：`apps/web/src/bootstrap.ts`（`compositionRoot: true`）内 `ctx.plugin({ inject: ['store'], apply(ctx) {...} })` 直接挂在根 `ctx` 上、不经过 `openUnitScope` → 报错；同样的插件改为在 `openUnitScope(ctx, unit)` 返回的子 `ctx` 上挂载 → 通过。
- **与权威裁决者的关系**：本规则是**代理**，非权威——UnitScope 的实际挂载拓扑是运行时组合关系，静态分析只能做有限的词法层追踪；权威裁决依赖 primer/架构-结构条线 03-kernel-and-plugin-model.md 里对 `openUnitScope` 挂载点的运行时断言测试（该测试的组织方式由架构-结构条线拥有，本子线只提供编辑期的早期提示）。**本规则的精确检测逻辑依赖架构-结构条线确认 `openUnitScope` 的最终 API 形态**，记录为跨条线依赖（见任务汇报）。

### 4.14 `oce/no-boolean-command-result`（新增，响应架构-结构条线 `no-boolean-command-result`）

- **目的**：章程 D4（命令三分法）——Command 处理器如果返回裸 `boolean`，调用方只知道"成功/失败"，丢失了"为什么失败"（校验错误、权限拒绝、冲突）与"成功产生了什么"（应产出的 Mutation 列表）这两类本应由类型携带的信息；这是 [ADR-0043](../adr/0043-result-vs-exceptions.md)「Result 优于裸布尔/裸异常」原则在 Command 这一具体场景的应用。
- **检测方式（类型感知）**：对匹配 `commands/*.command.ts` 文件命名约定（与 primer 既有的 `services/*.service.ts` 同构）中导出的 Command 处理函数，解析其返回类型（`isolatedDeclarations` 已强制显式标注，见 [01](./01-tsconfig-baseline.md)）；若返回类型是 `boolean`、`Promise<boolean>`，或结构上等价于"只有两个布尔态、不携带其他信息"的联合，报错。
- **自动修复**：无。
- **负向测试样例**：`export function execute(ctx: CommandContext): boolean { ... }` → 报错；返回类型改为 `Result<Mutation[], CommandError>` → 通过。
- **与权威裁决者的关系**：权威（返回类型标注在 `isolatedDeclarations` 下总是显式可见，单文件可判定）。

### 4.15 `oce/telemetry-events-must-be-declared`（新增，响应 PRD `06-metrics-and-analytics.md` 埋点需求）

- **目的**：PRD 埋点清单要求"未在注册表声明的 telemetry 事件名拒绝"；机制上与 §4.4 `oce/events-must-be-declared` 同构，但作用于**产品遥测事件**（如 `document_opened`、`shape_inserted` 一类分析埋点），这是与 cordis 框架 `Events`（`ctx.emit`/`ctx.on` 那一套，[02§4.4](#44-oceevents-must-be-declared)）**不同的命名空间**——遥测事件经由 `ctx.telemetry.track(name, payload)`（L0 服务，章程 D11）发出，不是 cordis `Events` 接口的成员，不能用同一条规则处理（`Events` 走 TS 声明合并做编译期 key 校验；遥测事件表是一份独立维护的注册表，因为它对应的是产品/PRD 侧的埋点需求变化频率，与框架事件的变化频率、评审归属都不同）。
- **检测方式（AST + 注册表）**：`ctx.telemetry.track(...)` 调用的事件名参数必须是字符串字面量（禁止动态拼接，理由同 §4.4）；该字面量必须存在于中心化注册表（`packages/kernel/src/telemetry/events.ts`，草案路径，导出一份 `as const` 数组，与 PRD `06-metrics-and-analytics.md` 的埋点清单一一对应，由产品条线与本子线共同维护）；命名模式为 `<域>_<动作>`（snake_case，与遥测行业惯例一致，刻意不同于 cordis `Events` 的 `<域>/<动作>` 与贡献点的 `<域>.<名>`，三套命名空间用三种分隔符肉眼可辨）。
- **自动修复**：无。
- **负向测试样例**：`ctx.telemetry.track('DocOpened', {...})`（大小写/命名模式不符）→ 报错；`ctx.telemetry.track(eventNameVar, {...})`（动态）→ 报错；`ctx.telemetry.track('document_opened', {...})`（在注册表中）→ 通过。
- **与权威裁决者的关系**：配对新增 [06 scan-telemetry-events](./06-scanners.md#10-scan-telemetry-events)——本规则保证调用点合规，scan-telemetry-events 额外做反向核对（注册表里声明的事件是否真的被调用、是否与 PRD 埋点清单一一对应）。

### 4.16 `oce/command-must-declare-capabilities`（新增，响应 PRD CO-05 fail-closed 权限要求；架构-结构条线别名 `command-declares-capability`）

- **目的**：章程 D12（fail-closed：无显式允许即拒绝）在 Command 执行管线的类型侧落点——每个 Command 必须**显式**声明其所需的权限能力位，"没写"不能被当成"不需要权限"，必须是编译期就能看到的强制字段。
- **字段名对齐说明**：架构-结构条线的 `CommandDef` 设计（`03-kernel-and-plugin-model.md`）把该字段命名为 `permission`（单数）；本规则原草案用的是 `capabilities`（复数数组）。**字段名以架构-结构条线的 `CommandDef` 类型定义为准**——本规则检测 `CommandDef` 实际声明的字段名（无论最终是 `permission: CapabilityBit`/`permission: CapabilityBit[]` 单值还是数组形态），不在本文档里固定假设其形状；下方检测方式描述用 `permission` 记述，取值是否为数组由 `CommandDef` 的类型定义决定，本规则透传该类型、不重新约束。
- **检测方式**：与 §4.14 同一批 `commands/*.command.ts` 文件，要求导出的 `CommandDef` 对象包含非空/非默认值的 `permission` 字段（`CapabilityBit` 是一个封闭字符串字面量联合，权威定义位置见 [4.19](#419-ocecapability-vocabulary-single-source新增响应架构-结构条线-capabilities-in-protocol)——本规则只消费其类型，不定义它）；字段缺失、为空数组（若为数组形态）、或取值不在 `CapabilityBit` 封闭集合内，报错。**fail-closed 的具体体现**：即使一个 Command 确实"任何登录用户都可执行"，也必须显式声明一个代表"公开/无特殊权限"的能力位（如 `'public'`），而不是省略字段——省略与"公开"在本规则下是两种不同的、都需要显式表达的状态，省略永远是错误。
- **自动修复**：无。
- **负向测试样例**：`export const insertShapeCommand: CommandDef = { execute, /* 无 permission 字段 */ }` → 报错；`permission: []`（若为数组形态的空数组）→ 报错；`permission: 'slide.editShape'`/`permission: ['slide.editShape']` → 通过。
- **与权威裁决者的关系**：配对新增 [06 scan-command-capabilities](./06-scanners.md#11-scan-command-capabilities)——本规则保证声明存在且取值合法，scan-command-capabilities 做跨文件的一致性核对（贡献到 `commands` 贡献点的每个 Command 是否都能追溯到一个满足本规则的声明，防止"声明了 permission 字段但从未真正贡献注册、走了另一条未经检查的执行路径"这类绕过）。

### 4.17 `oce/no-index-in-mutation`（新增，响应架构-运行时/架构-结构条线共同提出，同名 `no-index-in-mutation`）

- **目的**：D4（命令三分法，Mutation 是唯一改 Store 的途径，逆操作由 Store 自动推导）在 Mutation 载荷形状上的两条延伸约束，合并为一条规则的两个子检测（都是"Mutation 定义对象的字段级禁止"，AST 特征高度相似，合并维护成本更低）：(a) Mutation 的 schema 禁止出现名为 `index` 的字段——数组下标在并发编辑（CRDT）下不是稳定标识，两个并发的插入操作可能对"下标 3"这同一个数字有完全不同的意图，必须用稳定 id/fractional index 一类的结构代替；(b) Mutation 的类型定义禁止出现 `inverse` 字段——逆操作必须由 Store 在应用 Mutation 时自动推导（章程 D4/[lessons K1](../../00-charter/reference-univer-lessons.md)"最正确的一项"），手写 `inverse` 字段意味着逆操作与正向操作可能在演化中失配，是 D4 明确要规避的模式。
- **检测方式（AST + 类型信息）**：对 `contracts/*.schema.ts` 内匹配 Mutation 命名约定（如 `*MutationSchema`）的 `z.object({...})`，禁止顶层字段名为 `index`（大小写不敏感，含 `Index`/`itemIndex` 一类明显是数组下标语义的命名——这部分依赖命名启发式，非精确 AST 匹配，可能有漏报，记录为已知限制）；对 `Mutation`/`*Mutation` 命名约定的类型别名/接口，禁止出现字段名 `inverse`。
- **自动修复**：无。
- **负向测试样例**：`InsertShapeMutationSchema = z.object({ index: z.number(), shape: ShapeSchema })` → 报错（`index` 字段）；改为 `z.object({ afterId: ShapeIdSchema.nullable(), shape: ShapeSchema })`（稳定锚点 + 插入位置语义，而非下标）→ 通过；`interface MoveShapeMutation { shapeId: ShapeId; inverse: MoveShapeMutation }` → 报错（`inverse` 字段）。
- **与权威裁决者的关系**：权威（同文件/同类型定义内可判定，不需要跨文件事实）。

### 4.18 `oce/no-waterfall-in-render-hot-path`（新增，响应架构-运行时条线，规避 [lessons A30](../../00-charter/reference-univer-lessons.md)）

- **目的**：[lessons A30](../../00-charter/reference-univer-lessons.md)（Univer 渲染热路径穿过约 20 个插件拦截器）——章程的立场是 `waterfall`（唯一的拦截机制，primer §3.4）只应出现在命令执行管线，渲染热路径的性能预算不允许每帧、每元素走一条可被任意插件插入拦截逻辑的链路；渲染贡献必须是**查表**（按 `kind` 索引到 `ElementRenderer`），不是**拦截链**。
- **检测方式**：文件路径匹配 `packages/(engine-render|render-dom|slide-render)/src/**`（后续新增的 `doc-render`/`sheet-render` 等同类垂直渲染包，按同一命名模式`*-render`自动纳入，检测逻辑基于包元数据 `oce.layer === 'L5'`（水平渲染契约层）或 `oce.layer === 'V-render'`（垂直渲染层）判定，不是硬编码这三个包名）内，调用 `ctx.waterfall(...)` 报错。
- **自动修复**：无。
- **负向测试样例**：`packages/slide-render/src/paint.ts` 内 `ctx.waterfall('render/beforePaint', shape, next)` → 报错；同样的拦截需求改为在 `commands` 管线（如 `packages/model-core`）触发、渲染层只消费命令产生的状态变化 → 通过。
- **与权威裁决者的关系**：权威（路径 + 包元数据 + 调用点匹配，单文件可判定）。

### 4.19 `oce/capability-vocabulary-single-source`（新增，响应架构-结构条线 `capabilities-in-protocol`）

- **目的**：`CapabilityBit` 封闭集合（[4.16](#416-ocecommand-must-declare-capabilities新增响应-prd-co-05-fail-closed-权限要求-架构-结构条线别名-command-declares-capability) 消费的权限词汇表）必须只有**一个**权威定义位置——`@oce/protocol`，防止多个包各自声明一份"看起来一样"的能力位联合类型导致语义漂移（与 [05§3](./05-runtime-boundaries.md#3-schema-即类型源)"schema 即类型源"同一哲学在权限词汇场景的应用）。
- **检测方式**：全局扫描顶层类型别名/接口声明匹配 `CapabilityBit`（或约定的等价名）；若在 `packages/protocol/**` 之外的任何文件出现该名字的**声明**（而非 `import`），报错。
- **自动修复**：无。
- **负向测试样例**：`packages/model-core/src/permissions.ts` 内 `export type CapabilityBit = 'slide.editShape' | ...`（重复声明）→ 报错；改为 `import type { CapabilityBit } from '@oce/protocol'` → 通过。
- **与权威裁决者的关系**：权威（全局符号声明位置扫描，不需要运行时/跨图事实）。

### 4.20 `oce/store-transact-in-commands-only`（新增，响应架构-结构条线 `store-transact-callsites`）

- **目的**：D4"Mutation 是唯一改 Store 的途径"若只停留在"文档说了算"，`store.transact(...)` 依然可以被任何代码（如一个 UI 事件处理器）直接调用而绕过 Command 层——本规则把这条架构约束落到调用点级别的机械检查。
- **检测方式（启发式，同 [4.13](#413-oceno-unit-scoped-inject-at-root新增响应架构-结构条线-no-unit-scoped-inject-at-root) 的调用图追踪类型）**：调用 `<expr>.transact(` 且 `<expr>` 的类型可判定为 `DocumentStore`（或其具体实现）时，要求该调用点位于 `commands/*.command.ts` 文件内、或 `model-core`/`model-*` 包内 Command 执行管线自身的实现文件内；出现在 `*-ui`/`ui-react`/事件处理器等消费侧代码中即报错。**已知漏报**：经过多层函数转发 `store` 引用后再调用 `transact` 的场景，与 4.13 的已知限制同源。
- **自动修复**：无。
- **负向测试样例**：`packages/slide-ui/src/toolbar.tsx` 内按钮 `onClick` 处理器直接 `ctx.store.transact((tx) => { tx.insertShape(...) })` → 报错，信息含"UI 层应 dispatch 一个 Command，而不是直接操作 Store"；同样的逻辑改为 `ctx.commands.execute('slide.insertShape', {...})`，由 Command 内部调用 `transact` → 通过。
- **与权威裁决者的关系**：代理，非权威——权威裁决依赖架构-结构条线 `05-command-and-history.md` 对命令管线边界的运行时设计与对应测试；本规则的精确度同样待该设计的具体 API 形态确认后收敛（跨条线依赖）。

### 4.21 `oce/nest-controller-dto-from-protocol`（新增，响应架构-运行时条线，仅 `apps/server` 适用）

- **目的**：[05 §1](./05-runtime-boundaries.md#1-必须校验的边界清单)"REST DTO"边界校验清单在 Nest 控制器写法上的具体化——`apps/server` 的 Controller 方法的请求体/查询参数/返回值类型必须来自 `@oce/protocol`，不得在控制器文件内联手写一份"看起来一样"的 DTO 接口（重蹈 schema/类型分裂的覆辙，参见 [ADR-0042](../adr/0042-no-enums-const-objects.md) 同类哲学）。这是本文档体系里**唯一**一条主要作用于 `apps/server`（而非 `packages/*`）的自定义规则，范围收窄声明见下。
- **检测方式（类型信息）**：`apps/server/src/**/*.controller.ts` 内，`@Body()`/`@Query()`/`@Param()` 装饰的参数类型与方法返回类型（含 `Promise<T>` 的 `T`），必须是从 `@oce/protocol` 导入的类型引用（直接引用或 `Pick`/`Omit` 等工具类型包裹一个从 `@oce/protocol` 导入的类型），不得是本文件内联声明的 `interface`/`type` 字面量。
- **自动修复**：无。
- **负向测试样例**：`@Post() create(@Body() body: { title: string }) {}`（内联字面量类型）→ 报错；改为 `@Body() body: CreateDocumentRequest`（`CreateDocumentRequest` 从 `@oce/protocol` 导入）→ 通过。
- **与权威裁决者的关系**：权威（单文件类型信息可判定）；与 [01§6](./01-tsconfig-baseline.md#6-appsserver-的受限例外-nestjson) 的 `apps/server` 受限例外并列——都是"`apps/server` 有自己的一组专属规则，不与 `packages/*` 共享"这一设计的具体体现。

---

## 5. 单点引入与同构全局：生成规则的语义

### 5.1 `no-restricted-imports`（章程 §5.3 规则 4）

`rules/restricted-imports.ts` 维护一张静态表（非自动派生，人工维护，变更需 PR 评审）：

| 模块（含子路径通配） | 唯一允许的包（或包内子路径） |
|---|---|
| `cordis` | `packages/kernel` |
| `yjs` | `packages/store-yjs`、`packages/collab-yjs`、`packages/server-collab` |
| `y-protocols`、`y-protocols/*` | `packages/collab-yjs`、`packages/server-collab` |
| `lib0`、`lib0/*` | `packages/store-yjs`、`packages/collab-yjs`、`packages/server-collab`（Yjs 生态工具库，与 `yjs` 同等对待，章程 v0.2 §5.3 单点引入补充项） |
| `y-indexeddb` | `packages/store-yjs`（客户端离线持久化，仅在 store-yjs 的浏览器 Provider 路径使用；`server-collab` 不需要，不在允许列表内） |
| `react`、`react-dom`、`react-dom/*` | `packages/ui-react`、匹配 `packages/*-ui` 的包（`slide-ui`/`doc-ui`/`sheet-ui`） |
| `@nestjs/*` | `apps/server` |
| `pg` | `packages/server-storage`；`apps/server/src/adapters/**`（章程 v0.2 §5.3 单点引入补充项；见下方"路径级例外"说明） |
| `ioredis` | `packages/server-storage`；`apps/server/src/adapters/**` |
| `@aws-sdk/*` | `packages/server-storage/src/providers/s3/**`（S3 Provider 实现，包内路径级限定，非整包放开）；`apps/server/src/adapters/**` |

**路径级例外**：本表绝大多数行以"包"为授权粒度，`pg`/`ioredis`/`@aws-sdk/*` 三行例外地以**包内子路径**授权（`server-storage/src/providers/s3/**`、`apps/server/src/adapters/**`），这是因为：(a) `@aws-sdk` 只应被 `server-storage` 内**特定**的 S3 Provider 实现看到，同包内的其他 Provider（本地磁盘/MinIO 兼容层）不应该、也不需要依赖 AWS 专有 SDK；(b) `apps/server` 是组装层（章程 §5.2），但持久化客户端的**实例化**（连接串解析、连接池配置）天然发生在 Nest 模块的 provider 工厂里，这部分代码被归入约定的 `adapters/` 子目录，与该目录外的路由/控制器代码（不应直接碰数据库客户端）区分对待。`index.ts` 装配 flat config 时对这三行使用 glob 粒度的 `files` 匹配（而非整包 glob），其余行仍是整包粒度。`server-collab`/`server-headless`（`LS` 层其余两个包）**不**出现在 `pg`/`ioredis`/`@aws-sdk` 任何一行的允许列表——它们需要持久化/缓存能力时，走 `server-storage` 暴露的 Definition（Blob 存储抽象，章程 §5.2），不得直接引入数据库/缓存客户端库，这是三角色（Definition/Provider/Consumer）原则在"第三方持久化 SDK"这一具体场景的体现。

`index.ts` 在装配 flat config 时，为表中每一行生成"除允许包外全局禁止"的 overrides：对不在允许列表内的每个包的 `files` glob，追加一条 `no-restricted-imports` 配置项，`message` 固定引用本表所在文档锚点。失败信息示例：

```
error  'yjs' import is restricted from being used except in
       packages/store-yjs, packages/collab-yjs, packages/server-collab.
       See docs/30-architecture/09-type-discipline/02-lint-rules.md §5.1
  @typescript-eslint/no-restricted-imports
```

与 [03](./03-boundaries.md#5-规则-4第三方库单点引入) 的 depcruise 同名语义规则互为代理/权威关系（同 §4.7 的模式）：ESLint 版本是编辑期反馈，depcruise 版本覆盖构建产物与类型-only 导入等 ESLint 未必触达的路径，是 CI 最终依据。

### 5.2 `no-restricted-globals`（章程 §5.3 规则 5，同构隔离三重保障之一）

`rules/restricted-globals.ts` **仅对 `package.json#oce.iso === 'iso'` 的包**生效（`dom`/`node` 包不配置本规则——理由见 [03 §4](./03-boundaries.md#4-同构隔离的三重保障)：这两类包的环境假设是被允许的，风险仅存在于自称"同构"却偷偷依赖某一方环境的 `iso` 包）。禁止名单：

```
浏览器方向：window, document, navigator, localStorage, sessionStorage,
            indexedDB, XMLHttpRequest, HTMLElement, MutationObserver,
            ResizeObserver, IntersectionObserver, requestAnimationFrame
Node 方向： process, Buffer, __dirname, __filename, require, module, global
两者共同：  fetch（iso 包不得假设网络能力；网络访问必须经由 inject 声明的服务，
            而不是环境提供的全局——这是 cordis primer MUST #1 在"能力访问"层面的延伸）
```

失败信息示例：

```
error  'window' is restricted: packages/engine-layout is an iso package
       and must not assume a DOM/Node environment. Inject a capability
       instead. See docs/30-architecture/09-type-discipline/02-lint-rules.md §5.2
  no-restricted-globals
```

---

## 6. ESLint 与 Biome 的职责切分

完整决策与备选方案见 [ADR-0044](../adr/0044-eslint-and-biome-split.md)。本篇只给出**判定规则**（`biome-boundary.md` 的内容镜像）：

| 判定问题 | 是 → | 否 → |
|---|---|---|
| 该规则是否需要读取 TS 类型信息（跨符号/跨文件的类型解析）？ | ESLint（typescript-eslint 或 `oce/*`） | 继续下一问 |
| 该规则是否纯粹关于空白/引号/分号/换行/尾逗号/import 排序等"文本形状"？ | Biome（格式化器，写入即生效，无需人工决策） | 继续下一问 |
| 该规则是否是本项目特有的架构/命名/文件组织约束，且不需要类型信息（如 §4.6 的文件名约束的"文件名匹配"部分）？ | ESLint 自定义规则（`oce/*`）——保持所有架构类规则集中在一处，避免"部分架构规则归 Biome、部分归 ESLint"的心智负担 | 默认归 ESLint |

`debugger`/`console.*` 属于"语义类禁用"（判定问题 1 为否、问题 2 为否、问题 3 为否——它们不需要类型信息，也不是文本形状，也不是本项目特有架构约束，而是通用的运行时卫生规则），按默认落在 ESLint（`no-debugger`/`no-console` 本身是 ESLint 核心规则，Biome 虽也有等价规则 `noDebugger`/`noConsole`，但本项目选择**不**在两个工具里重复配置同一条通用规则，统一收口在 ESLint，避免两份配置漂移）。

---

## 7. 如何被机械验证（汇总）

| 声明 | 验证方式 | 失败信息来源 |
|---|---|---|
| 预设规则全部 `error`、无 `warn` | `policy-check` 读取 `eslint --print-config` 的解析结果，断言不存在 `severity: 1`（warn）的规则项 | scan-policy 报告 |
| 每条 `oce/*` 规则都有负向测试 | `policy-check`（§1 已述） | scan-policy 报告 |
| 豁免计入预算 | [06 scan-type-escapes](./06-scanners.md#1-scan-type-escapes) | 见 06 |
| lint 本身在 CI 上以 `error` 阻断且不允许 `--quiet` | [07](./07-hooks-and-ci.md#3-ci-工作流矩阵) `lint` job | 见 07 |
