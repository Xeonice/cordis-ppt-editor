# 参考基线：从《Univer 架构评估》提炼的继承与规避清单

> 状态：v0.1 | 负责：总编排 | 更新：2026-09-14 | 依赖：charter v0.1
> 来源：用户提供的《Univer 架构评估》报告（2026-09-14，基线 univer `b3547d403`，59 包 / 91.5 万行，8 路并行分析 + 14 路模块通读，4 处缺陷已复现）。
> 用法：下游文档引用本文条目时写编号（如「继承 K3」「规避 A7」）。

---

## 1. 报告的核心论点（一句话）

> **Univer 在每一类问题上都至少做对过一次，但没有任何机制保证那个正确做法被一致采用。**

这直接决定了本项目 R7（类型规约 + 约束机制）的设计哲学：**每一条规范都必须有对应的机械执行点，并且「规范↔执行」的对应关系本身要被 CI 校验**。靠人的纪律的架构，在团队扩张或换人时会滑坡（报告：82% 提交来自 3 人）。

---

## 2. 继承清单（Univer 做对的骨架）

| 编号 | Univer 做法 | 报告评价 | 我们的对应机制 | 落实位置 |
|---|---|---|---|---|
| K1 | 命令三分法 Command / Mutation / Operation，一切修改走命令 | 「最正确的一项」；Mutation 成为协同冲突解决的最小单元，撤销/协作/日志/权限共用一条链路 | 章程 D4；Mutation 唯一改 Store；命令管线内置权限检查点 | 架构 05 |
| K2 | per-unit 子注入器 | 骨架可信任的部分 | `UnitScope`：`ctx.isolate()` 隔离每个文档单元的 store/history/selection/render/presence | 架构 03 |
| K3 | 逻辑包与 UI 包分离（`sheets` vs `sheets-ui`） | 骨架可信任 | 垂直束拆为 `model-slide`（iso）/ `slide-render`（dom）/ `slide-ui`（dom） | 章程 §5.2 |
| K4 | 包依赖严格 DAG：79 包零循环、零向上依赖、扇出封顶 12 | A−（87/100） | dependency-cruiser 规则：无环、只向下、文档类型盲；CI 阻断 | 类型治理 03 |
| K5 | Disposable 纪律：86.3% 覆盖，`disposeWithMe` 1,042 处 | A− | cordis `ctx.effect()` 天然拥有清理；扫描器禁止 effect 之外的原生 timer/listener | primer §4；类型治理 06 |
| K6 | IResourceHook：单一持久化钩子，模板字面量类型强制命名 | A− | `ResourceHook`：命名空间 `` `${pluginId}.${string}` `` 类型约束，集中容错 | 架构 04 |
| K7 | 主题：单一 `<style>` 注入 + CSS 变量，`design` 包对 SDK 零依赖 | A− | `@cordexjs/design` 零依赖 SDK；token 覆盖颜色**及**间距/字号/z-index/动效（修补 Univer 的 D 级「非颜色 token」） | 设计 04 |
| K8 | i18n：从 en-US 反推编译期 key 类型 | B+ | `@cordexjs/i18n` 从 zh-CN 源反推 key 类型，缺 key 编译失败 | 架构 02 |
| K9 | 构建期 AST 推导依赖并回写 package.json → 0 phantom dep | 依赖卫生 | `knip` + `manypkg`/`syncpack` + depcruise 的 `no-orphans`/`not-in-pkg` 规则 | 类型治理 03/07 |
| K10 | facade 边界有 4 条自定义 lint + 构建期 external | 自洽 | 我们不做 facade 猴子补丁；公共 API 由 api-extractor 基线守护 | 类型治理 04 |
| K11 | `Plugin.static type` 与 `registerRenderModule(type, dep)` 用类型键索引而非 switch | 真正可复用的四层之一 | ContributionPoint 全部按类型键索引；内核零 switch-on-doc-type | 架构 03 |

---

## 3. 规避清单（Univer 的缺陷及我们的反制）

### 3.1 结构性缺陷

| 编号 | Univer 问题 | 证据 | 我们的反制 | 机械验证 |
|---|---|---|---|---|
| A1 | 内核边界错位：`core` 7.9 万行里 3.4 万行是 sheets/docs 模型；`engine-render` 66% 是三产品专用组件 | 报告 §00 ①、§1.2 | 水平层「文档类型盲」；`engine-render` 只有契约与管线，元素渲染器由垂直束贡献 | depcruise：水平层禁 import 垂直束 |
| A2 | 共享基座是第一个产品的形状：`unitId + subUnitId` 两级寻址是 workbook 模型，docs 只能 `subUnitId = unitId` | §1.2 | `model-core` 只定义 `Unit` 与 `DocumentStore`，寻址由各 `DocumentType` 自定义（类型参数化） | 设计评审 + 类型测试 |
| A3 | 文档类型固化为 protobuf 闭合枚举（8 值，4 个厂商预留），第三方无法新增 | 决策 #2 | `DocumentType` 是开放贡献点；协议里用字符串 id + schema 注册，不用枚举 | protocol 中禁止 `enum`（lint） |
| A4 | 布局 skeleton 基类放在 core，三层继承跨三包，导致 sheets 切不断渲染依赖 | 决策 #5 | 布局在 `engine-layout`（iso，纯函数度量），模型包不 import 引擎 | depcruise + iso 冒烟 |
| A5 | 渲染引擎内置三产品组件，`IRange` 出现在通用绘制契约 | 决策 #6 | `ElementRenderer<T>` 泛型贡献；通用契约只认 `kind: string` 与几何盒 | api-extractor 基线 |
| A6 | 模型即快照，无「持久层 vs 运行时层」边界，派生字段混入持久化 | 决策 #10 | Snapshot 编解码显式；派生数据标注 `derived` 且不进 Snapshot；`schemaVersion` 必填 | 快照 schema 校验测试 |
| A7 | 移动端整包复刻（7 个 mobile-plugin.ts） | 决策 #11 | 移动端为 `ui.*` 贡献点的变化点插件，不复刻 | 设计 06；架构 03 |

### 3.2 扩展点治理

| 编号 | Univer 问题 | 证据 | 我们的反制 | 机械验证 |
|---|---|---|---|---|
| A8 | 104 个不同的 `register*` 方法名、7 套事件机制、6 个语义重叠的 `intercept*` | §00 ② | 唯一注册抽象 ContributionPoint；事件只用 cordis 五种分发模式；拦截只用 `waterfall` | lint 禁止内核外定义 `register*` 方法；扫描器统计 |
| A9 | 无 manifest、无清单、无 schema，不运行系统无法知道插件贡献了什么 | §00 ② | `Manifest` 静态生成（provides/injects/contributes/events/iso class），CI 校验与运行时一致 | ADR-0003；扫描器 |
| A10 | 全局可变注册表 + 94 处顶层副作用注册 + 76 处原型覆写；同页多实例互相污染；`Registry.delete()` 越界（D1） | 风险地图「高」 | 禁止模块级可变状态；注册必须在 `ctx.effect` 内；UnitScope 隔离 | lint `no-module-level-mutable-state`（自定义）；多实例测试 |
| A11 | 插件零隔离，一个崩溃即全局崩溃 | 决策 #12 | 每个 Fiber 的 `apply` 异常被内核捕获并转为 `FAILED` 状态 + `errors` 上报，不传播到兄弟插件；渲染器逐元素错误隔离（借鉴 pptx-renderer） | 单测：注入抛错插件，系统其余功能可用 |
| A12 | Facade 用原型 monkey-patch 组装，加载顺序敏感 | 决策 #8 | 无 facade；对外 API = kernel + 服务契约；`ctx.mixin` 只在内核使用 | lint 禁止 `prototype` 赋值 |
| A13 | DI override 作为开源/闭源接缝；`IExecutionOptions` 含闭源标志 | §3.2 | 无闭源接缝；协同为开放 Provider；执行选项只含公开语义 | 评审 |
| A14 | 84% DI 注册是不可替换的具体类；`ComponentType<T> = any` | §04 类型契约 | 服务必有 Definition 接口；UI 组件类型全泛型化；`any` 预算为 0（生产代码） | type-coverage + 扫描器 |
| A15 | 注册时序靠 4 ms 定时窗口掩盖 | §1.3 | cordis `inject` 反应式依赖：缺依赖进入 `PENDING`，不靶时序 | primer MUST NOT #1 |

### 3.3 「声明了但没执行」清单（我们的每一项都要有执行点）

| 编号 | Univer 声明 | 实际 | 我们的执行点 |
|---|---|---|---|
| A16 | 复杂度门禁已配置 | CI `--quiet` 使 warn 全失效，458 处豁免 | CI 禁止 `--quiet`；所有规则为 `error`；豁免需 `// cordex-allow(<rule>): <issue-url>` 且扫描器统计预算 |
| A17 | 穿透/barrel import 规则有 docstring | 实现是 no-op | 规则必须有**负向测试**（故意违规样例）才允许进入配置；类型治理 02 |
| A18 | SAST（Semgrep）有 workflow | key 在 main、开发在 dev → 从不运行 | CI 全部在 PR 上运行；`policy-check` 校验每个门禁 job 在 PR 触发器中 |
| A19 | 覆盖率不下降 | `patch: off` | patch 覆盖率阈值；新代码无测试即失败 |
| A20 | 同构（ISOMORPHIC.md） | 0 个 node 测试、core 20% 文件触碰 DOM | iso 包 tsconfig 无 `dom` lib + `node --import` 冒烟 + `no-restricted-globals` |
| A21 | API 稳定性四级策略 | 无 api-extractor、无 `.api.md` | api-extractor 基线入库，PR diff 必审 |
| A22 | 废弃流程 | `deprecate()` 调用 0 | `@deprecated` 必带移除版本，扫描器在到期版本失败 |
| A23 | `schemaVersion` | 全仓 1 个迁移函数 | `migrations` 注册表 + 迁移测试语料 |
| A24 | `ILogContext`/错误码/telemetry | 零实现、包外引用 0、1 个消费者 | L0 服务从 M1 接入；裸 `throw new Error` 被 lint 禁止 |
| A25 | 内存/dispose 门禁文档 | 被重构删除 | 单测断言 `fiber.getEffects()` 卸载后为空；e2e 内存预算 |
| A26 | 规模保护配置 | 消费点 `not implemented yet` | 配置项必须有读取点（扫描器：Config schema 字段 ↔ 引用） |
| A27 | `exports: "./*"` 类型指向根 index，编译过、运行崩（D2，59/59 包） | 已复现 | exports 显式枚举；`publint` + `attw` 门禁 |

### 3.4 性能与运行时

| 编号 | Univer 问题 | 我们的反制 |
|---|---|---|
| A28 | 脏矩形算完没人读（D3）；任意 mutation 全量 `makeDirty` | 渲染引擎的脏区必须被消费：单测断言局部变更只重绘受影响元素 |
| A29 | 缓存淘汰写好未接线（D4） | 每个缓存有淘汰策略与**被调用**的测试 |
| A30 | 渲染热路径穿过 ~20 个插件拦截器 | 拦截链只在命令层（`waterfall`），渲染热路径无拦截器；渲染贡献是查表不是链 |
| A31 | Worker 里第二份模型靠 27 条白名单收敛 | 单一事实源（CRDT）；Worker 只做纯计算并接收 update |
| A32 | 编辑态跨三个模型两个异步边界 | 文本编辑直接作用于 Store 的富文本类型（Y.Text）；无第二份编辑缓冲 |
| A33 | 包体积：任一插件闭包 103 万行；emoji locale 638 KB | 依赖只向下 + 按需加载的垂直束；locale 资源按需 |
| A34 | `@grpc/grpc-js` 类型引用被声明为运行依赖，下游多 7.4 MB | `knip` + 类型专用依赖进 `devDependencies`；`attw` 检查 |

---

## 4. 报告的修复建议如何转化为我们的「出生即有」项

| 报告 ROI 建议 | 我们的默认状态 |
|---|---|
| CI 去掉 `--quiet` | 从第一天禁止 |
| dependency-cruiser | M0 就位（类型治理 03） |
| `node -e "import(...)"` 冒烟 | 每个 iso 包的 CI job |
| api-extractor + `.api.md` | M0 就位，M1 起有基线 |
| 统一 ContributionPoint + 生成式清单 | 内核第一个能力（架构 03，ADR-0003） |
| 显式 exports | 包模板即显式 |

---

## 5. 对采用方判断的借用

报告结论二：Univer 是「库的插件化」，不是「应用的扩展生态」，因为它假设扩展与宿主一起编译打包，主动放弃了 manifest、懒激活与运行时卸载。

我们的定位介于两者之间：**编译期组合为主（preset），但保留运行时挂载/卸载能力**（cordis Fiber 天然支持），并以 Manifest 提供可发现性。安全沙箱明确不做（见章程 §2.3），但要做到「一个插件失败不拖垮系统」（A11）。
