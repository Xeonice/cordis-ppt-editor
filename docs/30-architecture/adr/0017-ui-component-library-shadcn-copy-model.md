# ADR-0017 UI 组件库选型：shadcn/ui 复制模式（Radix + Tailwind 4 + Lucide + Geist）

> 状态：已接受 | 负责：架构-结构 | 更新：2026-09-18 | 依赖：charter v0.1（D10 修订见 charter v0.2；裁决 `docs/00-charter/rulings-2026-09-14.md` §4.7）

## 状态

已接受（用户指令，2026-09-15；总编排裁决 §4.7；章程 D10 与 §5.3 规则 4 已修订）。

## 背景

设计线先后产出手工样式套件 `20-design/kit/` 与规范 09 v1，用户评审认为「缺少一套完整且可遵循的设计规范，稿件不精致」，并明确要求「组件应直接复用成熟组件，如 shadcn」。手工套件已删除；设计 playground `docs/20-design/playground/`（Vite 8 + React 19 + TS strict，`components.json` style `radix-nova`，已复制 45 个 shadcn 组件）成为设计稿的唯一基准，也是 `@oce/ui-react` 的种子。章程 D10 已定 React 19，`ui-core` 无 React；K7 要求 `@oce/design` 对 SDK 零依赖并以 CSS 变量为单向契约。

## 决策

1. **复制模式，不是 npm 组件库依赖**：用 shadcn CLI（4.21，`radix-nova` 预设）把组件源码复制进 `@oce/ui-react/src/components/ui/`，`components.json` 入库；复制件是**我们的代码**，但结构不手改——升级与修补走 `npx shadcn diff` → 重新 `add`/合并（03 CI 有 diff 报告）。
2. **分工**：Radix（`radix-ui` 单包）提供语义、键盘行为与可访问性；Tailwind 4 工具类提供样式（`@tailwindcss/vite` 用于 playground/浏览器测试，`@tailwindcss/cli` 用于库构建产出 `lib/styles.css`）；Lucide 图标；Geist 字体（`@fontsource-variable/geist`）；`cn()` = clsx + tailwind-merge。
3. **`@oce/design` 只交付主题变量 CSS**：`theme.css`（shadcn 变量 `--background/--primary/--ring/--radius/--sidebar-*…` + OCE 扩展 `--oce-*`：画布、参考线、选区、协作者色、层级、动效、密度）与 `tailwind-theme.css`（Tailwind 4 `@theme inline` 注册片段）。它不含组件、图标、运行时 JS；组件依赖全部落在 `ui-react`（与 `*-ui`）。**主题变量是 `design` 与 `ui-react` 之间的唯一契约**（K7 零依赖原则不变，方向仍是 ui-react → design）。
4. **OCE 特有组合**放在 `ui-react/src/components/editor/`（Ribbon、ThumbnailRail、MasterThumbnails（母版缩略图窗格，在 ThumbnailRail 内）、SlideCanvas、Inspector、StatusBar、NotesBar、DesignBar、CommandPalette、Dialogs/Notifications、presence），只组合 `ui/*`，不重写原子组件；`*-ui` 垂直束包通过子路径 `@oce/ui-react/ui` 使用原子组件（R8 禁深引用，因此显式导出该子路径）。
5. **`ui-core` 仍无 React、无 Radix/Tailwind**：它只定义贡献点、输入管线与 `UiRenderer` Definition；主题切换由 `theme` 服务把 theme/density 写为根元素属性 `data-oce-theme`/`data-oce-density`（ui-react 的 `ThemeBridge` 读取；不使用 next-themes）。
6. **单一副本**：M2 启动时 playground 的 `src/components/ui/*`、`lib/utils.ts`、`hooks/use-mobile.ts`、`index.css` 迁入 `ui-react`，随后 playground 改为依赖 workspace 的 `@oce/ui-react`；全仓只允许一份复制件（扫描器校验）。
7. **画布隔离**：Tailwind preflight 只在 `ui-react/styles/index.css` 引入一次；`render-dom` 的内容层用自身 `layers.css` 显式设定 svg/img/video 的 display/尺寸，不依赖也不受 preflight 影响；`*-ui` 的样式入口只引 `tailwindcss/theme` + `tailwindcss/utilities`（无 preflight），避免重复重置。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 自建组件套件（`20-design/kit/`，已尝试） | 精致度与可访问性成本高、无成熟社区基准；用户评审否决并已删除 |
| MUI / Ant Design / Chakra / Mantine（npm 依赖型组件库） | 主题系统与我们的 CSS 变量契约冲突（CSS-in-JS 或专有 token）；体积大（EM-07 编辑器 ≤ 900 KB 预算）；样式覆盖靠层叠而非源码可控；升级破坏面不可控 |
| Radix Themes | 预设视觉过强、token 体系封闭，与 `@oce/design` 双 token 源 |
| Headless UI / React Aria + 自写样式 | 仍需自写全部视觉；shadcn 正是「Radix 语义 + 已写好的 Tailwind 视觉」的复制起点 |
| 把 shadcn 复制件放进 `@oce/design` | 违反 K7（design 将依赖 React/Radix/Tailwind）；design 应保持零依赖、可被非 React 绑定复用 |

## 后果

- 正：设计稿即真实组件页面（playground `/styleguide` 是状态基准）；可访问性与键盘行为由 Radix 提供并经 axe 校验；组件代码在仓内可审、可定制；主题一处定义（CSS 变量）对 ui-react、`*-ui`、apps 同时生效；`*-ui` 与第三方插件 UI 复用同一原子集。
- 负：复制件的升级是**我们的责任**（`npx shadcn diff` 有噪音，需人工合并；CI 只报告不阻断，稳定后升为阻断）；Tailwind 类名内联于组件源码（视觉定制只允许通过 CSS 变量与 `cn()` 追加类，不改复制件结构）；新增第三方依赖集中在 ui-react（体积经 EM-07 门禁）；preflight 与画布内容层需隔离测试；`radix-ui` 单包处于快速迭代期，锁版本由 catalog 管理。

## 如何被机械验证

- depcruise `third-party-single-entry`（R5 扩展，章程 §5.3 规则 4）：`react`、`radix-ui`、`class-variance-authority`、`clsx`、`tailwind-merge`、`lucide-react`、`tailwindcss`（含 `@tailwindcss/*`）、`tw-animate-css`、`cmdk`、`sonner`、`vaul`、`react-resizable-panels`、`@fontsource-variable/geist` 仅允许出现在 `@oce/ui-react` 与 `*-ui`（`oce.layer == 'V-ui'`）；`ui-core` 出现任一即失败（R14 `ui-core-no-framework` 扩展）。
- depcruise R17 `shadcn-ui-dir-private`：`@oce/ui-react/ui` 子路径与 `ui-react/src/components/ui/**` 只允许被 `ui-react` 自身、`*-ui` 包与 `apps/*` import；水平层/模型/渲染包 import 即失败。
- depcruise R18 `design-css-only`：`@oce/design` 的 `dependencies` 为空，`src/**` 无 React/Radix/Tailwind import；`exports` 只含类型入口与 `.css`。
- 扫描器 `shadcn-components-sync`：`components.json` 存在且 `style == 'radix-rhea'`（2026-09-16 起；原 `radix-nova`）；`src/components/ui/*.tsx` 文件集合与 `ui/index.ts` 桶文件导出一致；CI job `shadcn-diff` 运行 `npx shadcn diff` 并产出报告（M2 稳定后升为阻断）。
- 扫描器 `single-shadcn-copy`：全仓 `components/ui/button.tsx` 等复制件路径只存在于 `packages/ui-react`（playground 迁移后）。
- 扫描器 `theme-vars-contract`：`ui-react`/`*-ui`/`apps` 中出现的每个 `--oce-*` 变量与 `@theme inline` 注册名必须在 `@oce/design/theme.css` 中声明；`design/__tests__` 对 light/dark/high-contrast 全部前景/背景配对做 WCAG AA 对比度校验。
- Playwright + axe：playground/ui-react `/styleguide` 路由的全部组件状态零 a11y 违规；视觉 oracle 在「带 ui-react 样式」与「无 UI 样式」两种环境下画布渲染像素一致（preflight 隔离回归）。
- CI 体积门禁（EM-07）：编辑器组合 ≤ 900 KB gzip（不含 React 本体）。

## 关联

章程 D10（修订）、§5.3 规则 4、K7；rulings 2026-09-14 §4.7、§4.3（`data-oce-density`）；PRD EM-06/EM-07、PS-02（`ui.theme`）；设计 04（token 映射）、09 v2.0（shadcn 映射版）、playground；02 §4.17/§4.19/§7；03 §3.6（`ui.*` 贡献点）；ADR-0006（贡献点）、ADR-0010（preset 体积）。

## 修订 2026-09-16：风格 Rhea + 材质层（用户裁决路线 B）

- **风格**：`components.json` 的 `style` 由 `radix-nova` 改为 `radix-rhea`（shadcn 2026-05，紧凑版 Luma，macOS Tahoe 几何：胶囊控件、无边框填充输入、大圆角面板、柔和高度）。切换方式：改 `style` 后 `npx shadcn add -o -y <全部组件>` 重生成；复制件本身保持不改。
- **材质层与覆盖策略**：玻璃材质、悬浮层次、字体栈等在 `@oce/design` 的 `theme.css`（token + `@utility glass/glass-strong` + 退化）与 `ui-react/styles/index.css` 的 `[data-slot=…]` 规则中表达；**优先用 data-slot 规则而非编辑 `src/components/ui/*`**，使 `shadcn add -o` 升级不会覆盖定制。确需改复制件时文件头标 `// OCE override`，扫描器 `shadcn-overrides` 列出清单并在 `shadcn diff` 报告中单列。
- **组合层**：`EditorShell`/`AppBar`/`Ribbon`/`ThumbnailRail`/`Inspector`/`StatusBar`/`NotesBar`/`SlideCanvas` 改为悬浮玻璃卡布局（`p-2 gap-2`、`glass-strong rounded-2xl`、状态胶囊、画布 `zoom="fit"` 默认）。
- **主色**：亮 `#3A5CE6` / 暗 `#6B93FF`（去紫，见设计 04 §9）。
- **新增机械验证**：`theme-vars-contract` 覆盖 `--glass-*`；`design/__tests__` 对玻璃面板（strong 档）上的前景/背景配对做对比度校验；Playwright 在 `prefers-reduced-transparency: reduce` 下截图断言面板为不透明 `--card`；性能门禁：同屏 `backdrop-filter` 元素 ≤ 4（`/styleguide` 与 `/editor` 路由计数断言）。
- 关联：rulings §4.8；设计 09 v3.0、10（审计）、11（提案）。
- **2026-09-18 术语修订**：编辑器组合 `MasterTree` → `MasterThumbnails`（母版缩略图窗格：与 PowerPoint 一致仍是缩略图而非文字树，每个母版一张大缩略图、其版式为缩进的小缩略图，在 `ThumbnailRail` 内切换显示；playground `ThumbnailRail.tsx` 同名组件）；组件基座口径（`radix-rhea`，原 `radix-nova`）已在结构线 README / 02 同步（rulings §4.10）。
