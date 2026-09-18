# ADR-0010 preset（程序化）与 loader（配置驱动）的分工

> 状态：草稿 | 负责：架构-结构 | 更新：2026-09-15 | 依赖：charter v0.1

## 状态

提议。

## 背景

cordis 提供两种组合方式：程序化 `ctx.plugin()`（任何环境）与 `@cordisjs/plugin-loader`（读取 `cordis.yml`，稳定 id、`disabled`、`group/isolate`、HMR；面向 Node 文件系统）。章程把「产品的形状」定义为 preset（`preset-slide`、`preset-slide-collab`；总编排追加 `preset-slide-viewer`），并要求 SDK 优先、按需加载（PRD EM-07：查看器 ≤ 350 KB、图表渲染器为惰性块）。primer 已定：浏览器用 preset；服务端是否用 loader由本 ADR 决定。

## 决策

1. **preset 是唯一的一等组合形态**（浏览器与 `server-headless` 都用）：一个函数插件 `createXxxPreset(options)`，`apply` 内以**无序集合**挂载 `PresetEntry[]`，每项带稳定 `id`（对应 loader 的 id 概念，供 `fiber.update` 局部重配置与诊断）。
2. **惰性条目**：`PresetEntry.lazy?: () => Promise<Plugin>` + `activateWhen: { contributionSeen: { point; key } } | { event } | 'manual'`。示例：图表渲染器条目在 `SceneProvider` 首次产出 `kind: 'graphicFrame:chart'` 节点时动态 import（独立 chunk，PRD ≤ 400 KB）；语言包在 `i18n/locale-changed` 时加载。惰性条目未加载前对应元素走占位渲染（`unknown`）。
3. **可插拔口径的机械化**：`options.exclude: PluginId[]`、`options.override: Record<PluginId, Plugin>`；`preset-*` 的 `__tests__` 对每个 Provider 逐一 `exclude` 并断言 host 可启动（章程 §5.4；PRD `pluggable:m1`：`store=noop` → `unit/open-failed{code}` 非崩溃；`render.target=noop` → `unit/opened`、画布空）。
4. **loader**：仅 `server-headless` 可选启用（`createHeadlessHost({ composition: { kind: 'loader', configPath } })`），用于运维按 YAML 增删插件与 HMR 调试；默认关闭，浏览器**永不**引入 loader（R12 例外只对 `server-headless`）。
5. **三个 preset 的组成**（详见 02 §4.21）：
   - `preset-slide-viewer`：kernel（host 自带）+ model-core + store-memory + model-slide（主入口，不含 editing 子插件）+ ooxml-pptx + engine-layout + engine-render + render-dom + slide-render + i18n + design(css) + 只读权限策略 + 极简查看器壳（框架无关）；惰性：图表渲染器、语言包。
   - `preset-slide`：viewer 全部 + `@oce/model-slide/editing`（命令与变更）+ ui-core + ui-react + slide-ui + collab-core(local presence)。
   - `preset-slide-collab`：preset-slide 以 store-yjs 替换 store-memory + collab-yjs + collab-transport-ws；presence 由 collab-yjs 提供。
6. **PresetReport**：`apply` 不 await 单个条目；全部挂载后 `allSettled` 汇总 ACTIVE/PENDING/FAILED（03 §8），供扩展面板（PRD PS-11）与 `plugin/*` 遥测事件。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 浏览器也用 loader（YAML/JSON 配置驱动） | loader 面向文件系统与动态 import 字符串；无法 tree-shake；浏览器体积预算不允许；配置校验发生在运行时而非编译期 |
| 只有一个大 preset + 运行时开关 | 违背按需加载；查看器会带上编辑器代码（350 KB 不可达） |
| 每个插件由集成方手工 `ctx.plugin`（无 preset） | 30+ 插件的正确组合是产品知识，不应转嫁；preset 也是「移除 Provider 仍可启动」测试的落点 |
| 图表渲染器从 M1 就独立成包 | 总编排已接受 `@oce/slide-render-chart`（V-render，dom）但定为 **M3 起拆出**；M1–M2 以 `@oce/slide-render/chart` 子路径 + 惰性条目实现同等隔离（独立 chunk、可 exclude），M3 拆包时 preset 条目只改 import 路径 |

## 后果

- 正：一种组合心智；惰性边界显式且可测；查看器/编辑器/协同三档体积可门禁；服务端保留配置驱动能力。
- 负：`lazy` 条目引入「未加载期间的占位」状态，需 UI 文案与遥测（`plugin/loaded` 延迟）；`activateWhen` 是新概念（保持只有三种触发形式）。

## 如何被机械验证

- `preset-*/__tests__/pluggable.test.ts`：exclude 矩阵。
- `preset-*/__tests__/order-independence.test.ts`：条目随机顺序 100 次结果一致。
- `preset-*/__tests__/lazy.test.ts`：图表条目在无图表文档中**不**加载（网络/import 计数为 0），遇到图表时加载一次。
- CI 体积门禁（PRD EM-07）：三档组合 gzip 预算，超 5% 失败（`tooling/scanners/bundle-budget`，09-07）。
- depcruise R12：`@cordisjs/plugin-loader` 只允许出现在 `server-headless`。

## 关联

章程 §4 Preset、§5.4；primer §3.6；PRD OF-14、EM-07、PS-11、CS-11；03 §9；02 §4.21。
