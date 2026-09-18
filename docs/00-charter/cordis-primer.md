# cordis 4 使用基线（本项目视角）

> 状态：v0.1 | 负责：总编排 | 更新：2026-09-14 | 依赖：charter v0.1
> 事实来源：npm `cordis@4.0.0-rc.10`（2026-09-08，cordiverse/cordis，deps: `@standard-schema/spec`, `cosmokit`）；`@cordisjs/plugin-loader@1.0.0-rc.7`；cordiverse 仓库 `packages/`: core, create, group, hmr, include, loader, logger-console, timer, utils；生成式 API 目录（context/fiber/events/registry/service）与《Cordis System Guide for Coding Agents》（2026-08-24 快照）。
> 注意：`@deepseek-ai/cordis@4.0.2` 是 DeepSeek Harness 的 vendored 分支，**本项目使用上游 `cordis`**；示例中出现的 `'@deepseek-ai/cordis'` 一律读作 `'cordis'`。
> API 处于 rc，**只有 `@oce/kernel` 允许直接 import**，其余包通过 kernel 的 re-export 使用类型与工具。

---

## 1. 两个形式概念（论文 arXiv 2608.25512）

| 概念 | 含义 | 在本项目中的体现 |
|---|---|---|
| **时间可组合性**（temporal） | 组件移除时能**完全撤销**其副作用 | 每个注册（贡献、监听、timer、DOM 节点、WS 连接）都由 `ctx.effect()` 拥有；插件卸载后 `fiber.getEffects()` 为空是单测断言 |
| **空间可组合性**（spatial） | 组件能**声明**并**反应式**管理对其他组件的依赖 | `inject` 声明硬依赖；Provider 更换时消费者自动重跑；缺依赖进入 `PENDING` 而非报错 |

---

## 2. 对象模型（勿混淆）

```
Plugin（定义：函数 / 类 / {apply} 对象）
   │ ctx.plugin(plugin, config)
   ▼
Fiber（一次运行实例）─ 拥有：子 Context、effect 清理栈、依赖快照、子 Fiber、状态机
   │
   ├── Context（作用域化的能力环境；proxy：属性读走服务解析；extend/isolate/intercept 派生子 ctx）
   ├── Service（挂在 ctx.<name> 上的命名能力；Definition/Provider/Consumer 三角色）
   └── Registry（插件运行时与 Fiber 的登记；诊断用）
```

Fiber 状态机（rc.10 实际导出）：

```
PENDING ──deps ready──► LOADING ──► ACTIVE
   ▲                        │            │ 依赖/Provider 变化、restart/update/HMR
   │                        └─► FAILED   ▼
   └────────────────────────────── UNLOADING ──► PENDING（依赖缺失但仍挂载）
                                              ──► LOADING（依赖已满足，新一轮）
                                              ──► DISPOSED（显式永久销毁）
```

- `PENDING` **不是错误**：表示「已挂载但声明的环境不存在」。诊断时先看状态再怀疑 `apply`。
- 不存在 `INACTIVE` 枚举；不存在通用 `ctx.fork()`。

---

## 3. API 摘要（以 rc.10 生成式文档为准）

### 3.1 Context

| API | 语义 | 本项目用途 |
|---|---|---|
| `ctx.extend(meta?)` | 派生带额外元数据的子 ctx（原型继承，不改父） | 给 UnitScope 挂 `unit` 元数据 |
| `ctx.isolate(name, label?)` | 为服务 `name` 建独立解析域；同 label 可合并 | **UnitScope 的实现手段**：`store`/`history`/`selection`/`render`/`presence` 按单元隔离 |
| `ctx.intercept(name, config)` | 为子树中的插件合并服务级配置 | 预设对某服务的局部配置（如只读模式下的 `commands`） |
| `ctx.get(name, strict=true)` | 无 inject 要求地读服务；strict 只返回活跃 Provider | **可选依赖**的读取方式 |
| `ctx.set(name, value)` | 覆盖已提供的服务值（仅提供者 Fiber 可调） | 内核内部 |
| `ctx.provide(name, value)` → disposer | 以当前 Fiber 为所有者注册服务；同域重复抛错 | 轻量服务（无需 Service 类） |
| `ctx.accessor(name, {get,set?})` | 计算属性 | 内核内部 |
| `ctx.mixin(name, keys)` | 把服务成员转发到 ctx（如 `ctx.on` → `ctx.events.on`） | **仅内核**使用（规避 Univer A12） |
| `ctx.root` / `ctx.fiber` / `ctx.events` / `ctx.logger` / `ctx.registry` / `ctx.reflect` | 内建 | `ctx.logger(name)` 取命名 logger |
| `Context.is(value)` | 跨 realm 判定 ctx | 测试工具 |

### 3.2 Registry / Plugin

```ts
ctx.plugin<P extends Plugin>(plugin: P, ...args: Spread<GetPluginConfig<P>>): Fiber & PromiseLike<Fiber>
ctx.inject(deps: Inject, callback: Plugin.Function<void>): Fiber & PromiseLike<Fiber>   // = ctx.plugin({ inject, apply })

interface Plugin.Base<T> {
  name?: string                       // 诊断/日志名
  Config?: StandardSchemaV1<any, T>   // 启动前校验（Standard Schema：zod/valibot/arktype/schemastery 皆可）
  inject?: Inject                     // 硬依赖：数组或 { name: interceptConfig }
  provide?: string | string[]         // 声明提供的服务名（Service 与 loader 读取）
  intercept?: Dict<boolean>           // 声明消费哪些服务的 intercept 配置
}
// 三种形态：函数 (ctx, config) => any | 类 new (ctx, config) | 对象 { apply(ctx, config) }
```

- `await ctx.plugin(...)` 在加载完成后 settle，配置或启动错误会 reject。
- 配置校验失败抛 `ValidationError`（聚合 Standard Schema issues）。

### 3.3 Fiber

| API | 语义 |
|---|---|
| `ctx.effect(execute, label?)` | 立即执行 `execute`，收集其返回的 disposer（单个 / Promise / 同步或异步可迭代逐个 yield），Fiber 卸载或手动 dispose 时**逆序**运行；对已销毁 Fiber 调用抛 `CordisError('INACTIVE_EFFECT')` |
| `fiber.await()` | 等待稳定并重抛启动错误 |
| `fiber.dispose()` | 永久销毁 |
| `fiber.restart()` | 以当前配置重载 |
| `fiber.update(config, noSave?)` | 校验新配置后重启（先走 `internal/update` waterfall，HMR 可接管） |
| `fiber.getEffects()` | 返回带 label 的 effect 树（诊断；**卸载后应为空**） |
| `fiber.state` / `fiber.uid` / `fiber.config` / `fiber.store` / `fiber.inertia` | 状态、id、已校验配置、依赖快照、进行中的过渡 |

### 3.4 Events（五种分发模式，本项目只允许这五种）

| 模式 | 语义 | 本项目用法 |
|---|---|---|
| `emit` | 同步广播，忽略返回值 | 通知类事件（`unit/opened`） |
| `parallel` | 并发等待全部 | 多个异步观察者（保存前钩子） |
| `serial` | 顺序 await，直到有人 bail | 有序异步决策 |
| `bail` | 同步顺序，首个非空返回即停 | 同步决策（命中测试链） |
| `waterfall` | 洋葱模型，最后一个参数是 `next` | **唯一的拦截机制**（命令执行管线、权限、审计）；监听器不调 `next` 即为否决，必须显式 |

`ctx.on(name, listener, { prepend?, global? })` / `ctx.once` 返回 disposer；监听器**本身就是 effect**，随 Fiber 卸载。类型化：`declare module 'cordis' { interface Events { 'slide/shape-added'(unitId: UnitId, shapeId: ShapeId): void } }`。

### 3.5 Service

```ts
class SlidesService extends Service {
  constructor(ctx: Context) { super(ctx, 'slides') }   // 运行时注册 ctx.slides
}
declare module 'cordis' { interface Context { slides: SlidesService } }  // 编译期告知
```

静态 symbol：`Service.init`（构造后运行）、`Service.check`（可用性谓词）、`Service.config`（intercept 配置幽灵类型）、`Service.invoke`（使服务可调用，如 `ctx.logger()`）、`Service.extend`、`Service.tracker`、`Service.resolveConfig`。

### 3.6 Loader（`@cordisjs/plugin-loader`）

- 以配置（`cordis.yml`）描述插件树：`{ id, name, config, disabled?, group?, isolate? }`；**稳定 id** 让 loader 能 diff 并做局部挂载/卸载/重配置；HMR（`@cordisjs/plugin-hmr`）= 卸载 + 重载，靠 effect 清理保证幂等。
- Loader 面向 Node 文件系统。**本项目决定**：浏览器端用 preset（程序化组合）；服务端 `server-headless` 可选用 loader 做配置驱动组合（ADR 由架构-结构条线决定）。

---

## 4. 本项目铁律（在 cordis 指南 MUST/MUST NOT 基础上收紧）

### MUST
1. 每个硬依赖都写进 `inject`；可选能力用 `ctx.get()` 或依赖门控的子插件。判断口径：「没有这个服务，插件的行为还完整吗？」否 → inject。
2. 激活期创建的**每一个**资源都必须可清理并归属 Fiber（`ctx.effect`）：timer、DOM 监听、WS、Observer、缓存、贡献。
3. 假定同一插件在一个进程内可激活多次（多 Unit、HMR）；禁止模块级可变状态。
4. 部署/环境相关的值进 `Config`（Standard Schema）并在启动前校验；**先失败，不部分激活**。
5. 需要可替换的能力必须走 Definition / Provider / Consumer 三角色；Consumer 不得 import 具体 Provider。
6. `waterfall` 监听器除非有意否决，否则必须调用 `next()`。
7. 测试卸载/重载，不只测试启动：断言 `getEffects()` 卸载后为空、无重复注册。
8. 自定义服务名与事件名带域前缀（`slide/…`、`ui.ribbon`），避免碰撞。

### MUST NOT
1. 依赖 yaml/数组顺序保证就绪。
2. 在 effect 之外留下原生 timer/listener/watcher。
3. 跨激活期缓存 Provider 引用（Provider 更换会重跑消费者；缓存会指向陈旧实例）。
4. 把 `PENDING` 当错误。
5. 把 `isolate` 当安全沙箱（它只是解析域）。
6. 发明 `ctx.fork()`。
7. 在内核之外调用 `ctx.mixin` / 原型赋值。
8. 假定插件销毁能撤销**外部**历史（已发出的网络请求、已写入的文件）。

### 选择机制的决策表（面向实现者）

| 需要 | 用 |
|---|---|
| 可独立挂载/卸载的行为 | 插件 |
| 直接可调用的能力 | Service |
| 硬依赖 | `inject` |
| 可选能力 | `ctx.get()` / 依赖门控子插件 |
| 带清理的原生资源 | `ctx.effect()` |
| 观察运行时事件 | `ctx.on` |
| 多个异步观察者需全部完成 | `parallel` |
| 有序决策链 | `serial` / `bail` |
| 环绕式拦截/策略 | `waterfall` |
| 一族可替换实现 | Definition + Provider + Consumer |
| 每个子树一个 Provider | `ctx.isolate()`（UnitScope） |
| 子树级服务配置 | `ctx.intercept()` |
| 运行时组合变化 | preset 重组 / loader 配置 |

---

## 5. 本项目在 cordis 之上的约定（由 `@oce/kernel` 提供）

### 5.1 kernel 的职责边界

```
@oce/kernel
├── re-export: Context, Service, Plugin, Fiber, Events（类型）, CordisError, ValidationError
├── createHost(options): 创建根 ctx，预装 errors/telemetry/logger 适配、ContributionService、ManifestService
├── defineContributionPoint<T>({ id, schema, key })  → ContributionPoint<T>
├── ctx.contribute(point, item)        → 由 effect 拥有，Fiber 卸载自动撤销
├── ctx.contributions(point)           → 只读反应式集合（+ 事件 `contribution/changed`）
├── Manifest 类型 + 运行时一致性校验（与生成的 oce-manifest.json 对比）
├── createIsolatedScope(ctx, { services, meta })：文档无关的隔离工具，对一组服务名逐个 isolate 并 extend 元数据；
│   Unit/UnitScope/units 服务属于 model-core，由其调用本工具构造 UnitScope（章程 v0.2 裁决 C-4）
└── 诊断：dumpFiberTree(ctx)、assertNoLiveEffects(fiber)
```

### 5.2 声明合并的桥接（ADR-0001，需 spike）

目标：插件包只写 `declare module '@oce/kernel'`，不直接依赖 `cordis` 类型。设想：

```ts
// @oce/kernel/src/augment.ts（草案）
export interface Events {}    // 本项目事件表
export interface Context {}   // 本项目服务表
declare module 'cordis' {
  interface Events extends import('./augment').Events {}
  interface Context extends import('./augment').Context {}
}
// 插件侧：
declare module '@oce/kernel' {
  interface Events { 'slide/shape-added'(unitId: UnitId, shapeId: ShapeId): void }
  interface Context { slides: SlidesService }
}
```

风险：接口继承 + 模块增强的组合是否在所有下游 tsconfig（尤其 `isolatedDeclarations`）下稳定；spike 任务列入 M0 收尾。若不可行，退路是允许 `declare module 'cordis'` 但由 lint 限定只能出现在 `*.contribution.ts` 文件且该文件不得含运行时 import。

### 5.3 插件文件约定（类型治理条线细化检查）

```
packages/<pkg>/src/
├── index.ts               仅 re-export 公共 API（api-extractor 入口）
├── plugin.ts              export const name / inject / Config / apply（函数插件）
├── manifest.ts            export const manifest: Manifest（类型化；生成 json 的源）
├── *.contribution.ts      declare module '@oce/kernel' 增强 + 贡献点定义
├── services/*.service.ts  Service 子类（Provider）
├── contracts/*.ts         Definition：接口、请求/结果类型、schema
└── __tests__/             含「卸载后无 effect」「缺依赖进入 PENDING」「Provider 替换」用例
```
