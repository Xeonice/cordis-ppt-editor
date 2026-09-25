# ADR-0001 声明合并桥接：插件只 `declare module '@cordexjs/kernel'`

> 状态：草稿 | 负责：架构-结构 | 更新：2026-09-14；2026-09-25（§4.19：类型测试后缀按 T-NAMING 改为 `*.type-test.ts`） | 依赖：charter v0.1

## 状态

提议（需 M0 收尾 spike 验证；spike 未通过则启用退路 B）。

## 背景

cordis 的类型化依赖 TypeScript 声明合并：服务经 `declare module 'cordis' { interface Context { slides: SlidesService } }`，事件经 `interface Events { 'slide/shape-added'(...): void }`。章程 D1 要求只有 `@cordexjs/kernel` import `cordis`；若插件包直接 `declare module 'cordis'`，它们就在类型层依赖了 rc 阶段的第三方模块名，cordis 升级或 vendored 分支（`@deepseek-ai/cordis`）会波及全部插件。同时 TypeScript **不允许通过 re-export 增强**（`export type { Context } from 'cordis'` 后对 `@cordexjs/kernel` 的 `Context` 做 `declare module` 增强不会合并进 cordis 的 `Context`）。

## 决策

kernel 定义**自有的可增强接口**，并让 cordis 的接口 `extends` 它们（桥接方向：cordis → cordex）：

```ts
// @cordexjs/kernel/src/augment.ts（草案）
export interface Events {}       // 本项目事件表（空，供增强）
export interface Context {}      // 本项目服务表
export interface I18nKeys {}     // i18n key 表（K8）
declare module 'cordis' {
  interface Events extends import('./augment').Events {}
  interface Context extends import('./augment').Context {}
}
```

插件侧：

```ts
// packages/model-slide/src/slide.contribution.ts
declare module '@cordexjs/kernel' {
  interface Context { slides: SlidesService }
  interface Events { 'slide/shape-added'(unitId: UnitId, shapeId: ShapeId): void }
}
```

运行时 `ctx` 仍是 cordis 的 `Context`；因为 cordis `Context extends CordexContext`，`ctx.slides` 与 `ctx.on('slide/shape-added', …)` 均被正确类型化。插件包对 `cordis` 无任何 import（值或类型）。

## Spike 计划（M0 收尾，1–2 天）

最小仓库：`kernel`、`plugin-a`（提供服务 + 事件）、`consumer`（只 import kernel 类型与 plugin-a 类型），tsconfig 使用 `isolatedDeclarations: true`、`verbatimModuleSyntax`、项目引用、`tsc -b`。验证矩阵：

| # | 断言 | 通过标准 |
|---|---|---|
| S1 | `consumer` 中 `ctx.slides` 类型正确，`ctx.on('slide/shape-added', (u, s) => …)` 参数推导正确 | tsc 无错；`expectTypeOf` 通过 |
| S2 | cordis rc.10 的 `Events`/`Context` 是否带类型参数（若为 `interface Events<C extends Context>`，`extends` 子句需匹配） | 若带参数，改写为 `interface Events<C> extends CordexEvents<C>`，S1 仍通过 |
| S3 | `Service` 子类 `super(ctx, 'slides')` 的 name 参数是否受 `keyof Context` 约束；增强后是否可用 | tsc 无错 |
| S4 | `isolatedDeclarations` 下 `*.contribution.ts` 的 `.d.ts` 逐文件产出保留增强 | `lib/*.d.ts` 含 `declare module '@cordexjs/kernel'`；下游 `consumer` 用 `lib` 而非 `src` 编译通过 |
| S5 | api-extractor 对含 `declare module` 增强的入口报告不崩溃、不吞掉增强 | 报告生成；增强在 `.api.md` 中可见或被显式标注为不纳入 |
| S6 | 双 host / 双 realm 下 `Context.is` 仍成立（运行时，无关类型） | 通过 |
| S7 | 循环引用：增强中引用 `Context` 自身（如 `SlidesService` 持有 `ctx: Context`） | tsc 无错 |
| S8 | 一个包的增强对未 import 该包类型的消费者**不可见**（避免全局污染）；显式 `import type {} from '@cordexjs/model-slide'` 后可见 | 两个方向均符合预期 |

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| A：插件直接 `declare module 'cordis'` | 全部插件类型依赖第三方 rc 模块名；vendored 分支不兼容；违反 D1 |
| B（退路）：允许 `declare module 'cordis'` 但 lint 限定只能出现在 `*.contribution.ts`，且该文件不得含运行时 import | 仍是对 cordis 的类型依赖，但被隔离到单文件、可机械替换（sed 级迁移）。**若 spike S1–S5 任一失败则采用** |
| C：kernel 用泛型 `Context<TServices, TEvents>` 手工组合，不用声明合并 | 与 cordis 的 `ctx` 类型不兼容，需要大量 cast；违背 cordis 惯用法 |
| D：运行时代码生成类型（从 manifest 生成 `.d.ts`） | 增加构建阶段耦合；IDE 体验差 |

## 后果

- 正：插件零 cordis 依赖；kernel 可在不改插件的情况下切换 cordis 版本/分支；`I18nKeys` 同机制解决 K8。
- 负：多一层间接，错误信息里出现 `CordexContext`；spike 若发现 rc 接口带类型参数需跟随调整。

## 如何被机械验证

- depcruise R12：非 kernel 包 import `cordis` → error（含 `import type`）。
- lint `contribution-file-purity`：`declare module` 只允许在 `*.contribution.ts`，且该文件只含 `import type`。
- kernel `__tests__/augment.type-test.ts`（2026-09-25 按 ADR-0048 / 决策 T-NAMING 改后缀，原 `*.test-d.ts` 废止）：类型测试 S1/S7/S8。
- CI 在 `tsc -b` 与 api-extractor 双通道验证 S4/S5。

## 关联

章程 §6.2 ADR-0001、D1；primer §5.2；Univer A12（facade 猴子补丁的反面：我们用类型系统而非原型）。
