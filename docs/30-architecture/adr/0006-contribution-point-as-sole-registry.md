# ADR-0006 ContributionPoint 作为唯一注册抽象

> 状态：草稿 | 负责：架构-结构 | 更新：2026-09-14；2026-09-25（矛盾收口，rulings §4.18） | 依赖：charter v0.1；裁决 `docs/00-charter/rulings-2026-09-14.md` §4.14 K-3、§4.18 GV-15/GV-18/GV-24

## 状态

提议。

## 背景

Univer 有 104 个不同的 `register*` 方法名、7 套事件机制、6 个语义重叠的 `intercept*`（A8），94 处顶层副作用注册与全局可变注册表（A10），无清单（A9）。做对的部分是「用类型键索引而非 switch」（K11）。章程 D3：全代码库只有一种注册——ContributionPoint。

## 决策

1. **唯一 API**：`defineContributionPoint(spec)` / `ctx.contribute(point, item)` / `ctx.contributions(point)`（03 §3）。
2. **贡献是 effect**：由当前 Fiber 拥有，卸载自动撤销；不存在「注销」API 之外的手工 `Map.delete`。
3. **贡献项被 schema parse**：进入表前校验并填默认值；失败进诊断而不抛出（坏贡献不拖垮插件，A11）。
4. **唯一键 + 冲突策略**：`key(item)` 必填；`conflict: 'error'`（默认：拒绝后来的那一项、记 `duplicate` 诊断，`ctx.contribute` 不抛异常）或 `'replace'`（用于覆盖；**须在贡献点定义时显式声明**，当前取值以 03 §3.6 总表 conflict 列为准：`ui.*`、`render.element`、`render.overlay`、`i18n.bundle`）。
5. **反应式读取**：`observe()` / `contribution/changed`；消费方不缓存快照跨激活期使用。
6. **静态可列举**：manifest-gen 依赖 `ctx.contribute(<Ident>, …)` 与 `defineContributionPoint({ id })` 两个可识别形态。
7. **禁止**：内核之外定义 `register*` 方法；模块级可变 `Map/Set/数组`；`ctx.provide` 用于多项集合；用事件模拟注册。
8. **贡献点表**按 host（进程内、每 `createHost` 一份），不按 Unit；Unit 差异用 UnitScope 服务。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 每个服务自带 `register*`（Univer） | 命名与语义发散；无统一诊断与清单；生命周期各自为政 |
| VS Code 式 `package.json#contributes` 纯声明 | 我们的贡献含代码（handler/renderer），声明与代码双份必脱节 |
| 用 cordis `ctx.provide('render.element:sp', …)` 每项一个服务 | 服务是单例能力、名字空间扁平；无 schema、无集合语义、`keyof Context` 爆炸 |
| 用 `ctx.on('contribute/x')` 事件收集 | 事件是「发生」不是「声明」；不可静态列举；后来的消费者拿不到早先的贡献 |

## 后果

- 正：一种心智模型；诊断/清单/生命周期统一；第三方扩展路径唯一且可审核。
- 负：所有集合型扩展都要先 `defineContributionPoint`（多写 5 行 schema）；`conflict:'replace'` 的顺序语义需要谨慎（后挂载者覆盖）。

## 如何被机械验证

- lint `no-register-methods`：`packages/**`（kernel 除外）禁止定义名匹配 `/^register[A-Z]/`、`/^addXxxHandler$/` 等方法（规则表在 09-02）。
- lint `no-module-level-mutable-state`：模块顶层禁止 `let`、可变 `Map/Set/Array` 实例（`as const` 常量除外）。
- 扫描器 `scan-contributions` 规则 (a)（09-type-discipline/06 §3，TD-089）：`ctx.contribute` 第一参数必须是标识符且解析到 `defineContributionPoint` 调用（原名 `contribute-static-ident`，2026-09-25 按正式名改写，rulings §4.18 GV-15，对照见 08 §11）。
- kernel `__tests__/contribution.test.ts`：schema 拒绝 → 诊断且插件仍 ACTIVE；重复键 → 后者被拒、记 `duplicate` 诊断并 `errors.report`、`ctx.contribute` 不抛异常并返回 no-op disposer（与 03 §3.3 一致，rulings §4.18 GV-18）；卸载 → 表中移除并触发 `removed`；`replace` 语义。
- api-extractor 基线：`ContributionPoint`/`ReadonlyContributionSet` 是 kernel 公共 API 的一部分，变更可见。

## 关联

章程 D3、§4 ContributionPoint、§5.5；Univer A8/A9/A10、K11；03 §3；ADR-0003。

## 修订 2026-09-25（rulings §4.18 GV-24 / GV-18 / GV-15）

- **replace 允许清单**（GV-24，依 K-3「'replace' 须在贡献点定义时显式声明」）：决策 4 不再手写清单，改为「以 03 §3.6 总表 conflict 列为准（当前 `ui.*`、`render.element`、`render.overlay`、`i18n.bundle`）」。原文「`'replace'`（仅 `ui.*`/`i18n.bundle`，用于覆盖）」与 K-3、03:179–180 的三处清单互不一致且都不完整，作废；rulings K-3 原文不改，只在回写记录注明「当前允许」以 03 §3.6 为准。
- **重复键语义**（GV-18）：默认 `conflict:'error'` 只拒绝后来的那一项并记 `duplicate` 诊断，`ctx.contribute` 不抛异常（坏贡献不拖垮插件，A11）；09-type-discipline/09 §1.2 的 `DuplicateContributionError` 写法以 03 §3.3 与本 ADR 为准作废。
- **扫描器名**（GV-15）：`contribute-static-ident` 并入 `scan-contributions` 规则 (a)。
