# ADR-0017 UI 组件库选型：shadcn/ui 复制模式（Radix + Tailwind 4 + Lucide + Geist）

> 状态：已接受 | 负责：架构-结构 | 更新：2026-09-24；2026-09-24 复核修正（rulings §4.17；复核报告 M17：depcruise 规则名统一）；2026-09-25（矛盾收口，rulings §4.18：措辞对齐，语义不变） | 依赖：charter v0.1（D10 修订见 charter v0.2；裁决 `docs/00-charter/rulings-2026-09-14.md` §4.7、§4.11 C-21/C-22、§4.15 Q2/Q9、§4.18 GV-14/GV-15）

## 状态

已接受（用户指令，2026-09-15；总编排裁决 §4.7；章程 D10 与 §5.3 规则 4 已修订）。2026-09-24 用户裁决章程 §10 Q2 = **React 19**（rulings §4.15），本 ADR 的前提由「D10 已定」升级为「Q2 已裁」；同日按 C-21/C-22、`40-modules/14` §5.3 与 Q9 回写决策 1–5，见文末「修订 2026-09-24」。

## 背景

设计线先后产出手工样式套件 `20-design/kit/` 与规范 09 v1，用户评审认为「缺少一套完整且可遵循的设计规范，稿件不精致」，并明确要求「组件应直接复用成熟组件，如 shadcn」。手工套件已删除；设计 playground `docs/20-design/playground/`（Vite 8 + React 19 + TS strict，`components.json` style `radix-nova`，已复制 45 个 shadcn 组件）成为设计稿的唯一基准，也是 `@cordexjs/ui-react` 的种子。章程 D10 已定 React 19，`ui-core` 无 React；K7 要求 `@cordexjs/design` 对 SDK 零依赖并以 CSS 变量为单向契约。

## 决策

1. **复制模式，不是 npm 组件库依赖**：用 shadcn CLI（4.21，`radix-nova` 预设）把组件源码复制进 `@cordexjs/ui-react/src/components/ui/`，`components.json` 入库；复制件是**我们的代码**，但结构不手改——升级与修补走 `pnpm dlx shadcn@4.21.0 diff` → 重新 `add`/合并（03 CI 有 diff 报告；2026-09-24 起不再写 `npx`——Q9 `devEngines onFail:error` 下仓库根目录 `npx` 会失败，且 CLI 版本须显式钉住）。
2. **分工**：Radix（`radix-ui` 单包）提供语义、键盘行为与可访问性；Tailwind 4 工具类提供样式（`@tailwindcss/vite` 用于 playground/浏览器测试，`@tailwindcss/cli` 用于库构建产出 `lib/styles.css`）；Lucide 图标；Geist 字体（`@fontsource-variable/geist`）；`cn()` = clsx + tailwind-merge（`clsx`、`tailwind-merge`、`class-variance-authority` 在 catalog **精确锁版本**，并登记进章程 §5.3 规则 4 单点引入表）。
3. **`@cordexjs/design` 只交付主题变量 CSS**：`theme.css`（shadcn 变量 `--background/--primary/--ring/--radius/--sidebar-*…` + Cordex 扩展变量，**一律裸名**——`--glass-*`/`--layer-*`/`--duration-*`/`--ease-*`/`--control-h-*`/`--text-2xs` 等：画布、参考线、选区、协作者色、层级、动效、密度；**`--cordex-*` 前缀作废**，C-22）与 `tailwind-theme.css`（Tailwind 4 `@theme inline` 注册片段）。它不含组件、图标、运行时 JS；组件依赖全部落在 `ui-react`（与 `*-ui`）。**主题变量是 `design` 与 `ui-react` 之间的唯一契约**（K7 零依赖原则不变，方向仍是 ui-react → design）。
4. **ui-react 提供槽位宿主与原语；具体内容由 `*-ui` 贡献**（14 §5.3 M-10/G-8）：`ui-react/src/components/editor/` 只放壳层槽位宿主（Ribbon、ThumbnailRail 的 `rail` slot、SlideCanvas、Inspector、StatusBar、NotesBar、DesignBar、CommandPalette、Dialogs/Notifications、presence 的宿主外壳），只组合 `ui/*`，不重写原子组件；领域内容（如 `MasterThumbnails` 母版缩略图窗格）归 `slide-ui`（14 O-7，rulings §4.15 Q2 再次确认）；`*-ui` 垂直束包通过子路径 `@cordexjs/ui-react/ui` 使用原子组件（R8 禁深引用，因此显式导出该子路径）。
5. **`ui-core` 仍无 React、无 Radix/Tailwind**：它只定义贡献点、输入管线与 `UiRenderer` Definition；主题切换由 `theme` 服务把 theme/density 写为根元素属性（ui-react 的 `ThemeBridge` 读取；不使用 next-themes）。**三种主题选择器长期等价**，写成明文契约（C-21）：`.dark`（shadcn 生态默认）、`[data-cordex-theme="dark"]`（SDK 自有命名空间）、宿主 `[data-theme="dark"]`（嵌入场景），另以 `prefers-color-scheme` 兜底；`ui-core` 同时写 `.dark` 与 `data-cordex-theme`；密度仍为 `data-cordex-density`。
6. **单一副本**：M2 启动时 playground 的 `src/components/ui/*`、`lib/utils.ts`、`hooks/use-mobile.ts`、`index.css` 迁入 `ui-react`，随后 playground 改为依赖 workspace 的 `@cordexjs/ui-react`；全仓只允许一份复制件（检查 `single-shadcn-copy` 校验，见「如何被机械验证」）。
7. **画布隔离**：Tailwind preflight 只在 `ui-react/styles/index.css` 引入一次；`render-dom` 的内容层用自身 `layers.css` 显式设定 svg/img/video 的 display/尺寸，不依赖也不受 preflight 影响；`*-ui` 的样式入口只引 `tailwindcss/theme` + `tailwindcss/utilities`（无 preflight），避免重复重置。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 自建组件套件（`20-design/kit/`，已尝试） | 精致度与可访问性成本高、无成熟社区基准；用户评审否决并已删除 |
| MUI / Ant Design / Chakra / Mantine（npm 依赖型组件库） | 主题系统与我们的 CSS 变量契约冲突（CSS-in-JS 或专有 token）；体积大（EM-07 编辑器 ≤ 900 KB 预算）；样式覆盖靠层叠而非源码可控；升级破坏面不可控 |
| Radix Themes | 预设视觉过强、token 体系封闭，与 `@cordexjs/design` 双 token 源 |
| Headless UI / React Aria + 自写样式 | 仍需自写全部视觉；shadcn 正是「Radix 语义 + 已写好的 Tailwind 视觉」的复制起点 |
| 把 shadcn 复制件放进 `@cordexjs/design` | 违反 K7（design 将依赖 React/Radix/Tailwind）；design 应保持零依赖、可被非 React 绑定复用 |

## 后果

- 正：设计稿即真实组件页面（playground `/styleguide` 是状态基准）；可访问性与键盘行为由 Radix 提供并经 axe 校验；组件代码在仓内可审、可定制；主题一处定义（CSS 变量）对 ui-react、`*-ui`、apps 同时生效；`*-ui` 与第三方插件 UI 复用同一原子集。
- 负：复制件的升级是**我们的责任**（`pnpm dlx shadcn@4.21.0 diff` 有噪音，需人工合并；CI 只报告不阻断，稳定后升为阻断）；Tailwind 类名内联于组件源码（视觉定制只允许通过 CSS 变量与 `cn()` 追加类，不改复制件结构）；新增第三方依赖集中在 ui-react（体积经 EM-07 门禁）；preflight 与画布内容层需隔离测试；`radix-ui` 单包处于快速迭代期，锁版本由 catalog 管理。

## 如何被机械验证

- depcruise `third-party-single-entry`（R5 扩展，章程 §5.3 规则 4）：`react`、`radix-ui`、`class-variance-authority`、`clsx`、`tailwind-merge`、`lucide-react`、`tailwindcss`（含 `@tailwindcss/*`）、`tw-animate-css`、`cmdk`、`sonner`、`react-resizable-panels`、`@fontsource-variable/geist` 仅允许出现在 `@cordexjs/ui-react` 与 `*-ui`（`cordex.layer == 'V-ui'`）；**例外：`apps/web` 放行 `react`、`react-dom`、`react-router`、`tailwindcss`、`@tailwindcss/*`**（rulings §4.15 Q2），`react-router` 仅限 `apps/web`；`ui-core` 出现任一即失败（R14 `ui-core-no-framework` 扩展）；`vaul` 与 `next-themes` 全仓不得出现（2026-09-24）。
- depcruise R17 `shadcn-ui-dir-private`：`@cordexjs/ui-react/ui` 子路径与 `ui-react/src/components/ui/**` 只允许被 `ui-react` 自身、`*-ui` 包与 `apps/*` import；水平层/模型/渲染包 import 即失败。
- depcruise R18 `design-css-only`：`@cordexjs/design` 的 `dependencies` 为空，`src/**` 无 React/Radix/Tailwind import；`exports` 只含类型入口与 `.css`。
- 检查 `shadcn-components-sync`（测试断言 `packages/ui-react/src/__tests__/shadcn-copy.test.ts`，test job，TD-091；非独立扫描器，见 09-type-discipline/08 §11）：`components.json` 存在且 `style == 'radix-rhea'`（2026-09-16 起；原 `radix-nova`）；`src/components/ui/*.tsx` 文件集合与 `ui/index.ts` 桶文件导出一致；scanners job 的 `shadcn-diff` 步骤运行 `pnpm dlx shadcn@4.21.0 diff` 并产出报告（M2 稳定后升为阻断）。
- 检查 `single-shadcn-copy`（测试断言 `packages/ui-react/src/__tests__/shadcn-copy.test.ts`，test job，TD-091；非独立扫描器，见 09-type-discipline/08 §11）：全仓 `components/ui/button.tsx` 等复制件路径只存在于 `packages/ui-react`（playground 迁移后）。
- 检查 `theme-vars-contract`（测试断言 `packages/design/src/__tests__/theme-vars-contract.test.ts`，TD-092；非独立扫描器，见 09-type-discipline/08 §11）：`ui-react`/`*-ui`/`apps` 中出现的每个 Cordex 扩展变量（裸名）与 `@theme inline` 注册名必须在 `@cordexjs/design/theme.css` 中声明，**`--cordex-*` 前缀出现即失败**（C-22）；`theme.css` 必须同时含 `.dark`、`[data-cordex-theme="dark"]`、`[data-theme="dark"]` 三选择器与 `prefers-color-scheme` 兜底（C-21）；`design/__tests__` 对 light/dark/high-contrast 全部前景/背景配对做 WCAG AA 对比度校验。
- Playwright + axe：playground/ui-react `/styleguide` 路由的全部组件状态零 a11y 违规；视觉 oracle 在「带 ui-react 样式」与「无 UI 样式」两种环境下画布渲染像素一致（preflight 隔离回归）。
- CI 体积门禁（EM-07）：编辑器组合 ≤ 900 KB gzip（不含 React 本体）。

## 关联

章程 D10（修订）、§5.3 规则 4、K7；rulings 2026-09-14 §4.7、§4.3（`data-cordex-density`）；PRD EM-06/EM-07、PS-02（`ui.theme`）；设计 04（token 映射）、09 v2.0（shadcn 映射版）、playground；02 §4.17/§4.19/§7；03 §3.6（`ui.*` 贡献点）；ADR-0006（贡献点）、ADR-0010（preset 体积）。

## 修订 2026-09-16：风格 Rhea + 材质层（用户裁决路线 B）

- **风格**：`components.json` 的 `style` 由 `radix-nova` 改为 `radix-rhea`（shadcn 2026-05，紧凑版 Luma，macOS Tahoe 几何：胶囊控件、无边框填充输入、大圆角面板、柔和高度）。切换方式：改 `style` 后 `pnpm dlx shadcn@4.21.0 add -o -y <全部组件>` 重生成；复制件本身保持不改。
- **材质层与覆盖策略**：玻璃材质、悬浮层次、字体栈等在 `@cordexjs/design` 的 `theme.css`（token + `@utility glass/glass-strong` + 退化）与 `ui-react/styles/index.css` 的 `[data-slot=…]` 规则中表达；**优先用 data-slot 规则而非编辑 `src/components/ui/*`**，使 `shadcn add -o` 升级不会覆盖定制。确需改复制件时文件头标 `// Cordex override`，检查 `shadcn-overrides`（测试断言 `packages/ui-react/src/__tests__/shadcn-copy.test.ts`，test job，TD-091；非独立扫描器，见 09-type-discipline/08 §11）列出清单并在 `shadcn diff` 报告中单列。
- **组合层**：`EditorShell`/`AppBar`/`Ribbon`/`ThumbnailRail`/`Inspector`/`StatusBar`/`NotesBar`/`SlideCanvas` 改为悬浮玻璃卡布局（`p-2 gap-2`、`glass-strong rounded-2xl`、状态胶囊、画布 `zoom="fit"` 默认）。
- **主色**：亮 `#3A5CE6` / 暗 `#6B93FF`（去紫，见设计 04 §9）。
- **新增机械验证**：`theme-vars-contract` 覆盖 `--glass-*`；`design/__tests__` 对玻璃面板（strong 档）上的前景/背景配对做对比度校验；Playwright 在 `prefers-reduced-transparency: reduce` 下截图断言面板为不透明 `--card`；性能门禁：同屏 `backdrop-filter` 元素 ≤ 4（`/styleguide` 与 `/editor` 路由计数断言）。
- 关联：rulings §4.8；设计 09 v3.0、10（审计）、11（提案）。
- **2026-09-18 术语修订**：编辑器组合 `MasterTree` → `MasterThumbnails`（母版缩略图窗格：与 PowerPoint 一致仍是缩略图而非文字树，每个母版一张大缩略图、其版式为缩进的小缩略图，在 `ThumbnailRail` 内切换显示；playground `ThumbnailRail.tsx` 同名组件）；组件基座口径（`radix-rhea`，原 `radix-nova`）已在结构线 README / 02 同步（rulings §4.10）。

## 修订 2026-09-24：Q2 裁决 React 19 与机械回写（rulings §4.15 Q2/Q9，§4.11 C-21/C-22）

- **Q2 结案**：UI 框架 = **React 19**（收口 D10）。依据：rulings §4.8 选定的 `radix-rhea` 风格只有 shadcn/ui 的 React 版提供（shadcn-vue 2.8.x / Reka UI 不支持 Rhea）；画布由框架无关的 `render-dom` 渲染，查看器与服务端 `/render` 都不加载 React，换框架没有收益。catalog 锁 `react` 19.3.x；SDK UI 对集成方宿主的 peer 为 **`react ^19.0`**（lint 禁止 `ui-react`/`*-ui` 使用 19.1 之后新增的 API，CI 覆盖 19.0.x 与最新版；React 18 宿主走形态 B/E）；`apps/web` 自身可用 19.3 能力。
- **「可换」改写为可验证范围**：`ui-core` 与 `ui.*` 条目 schema 不依赖框架；`*-ui/src/{domain,application}/**` 禁止 import `react`、`react-dom`、`radix-ui`、`@cordexjs/ui-react`（新增 depcruise 路径规则）；换框架需重写 `ui-react`、各 `*-ui` 的 `ui/` 层与第三方 custom 组件（ui-vue 需同时提供对应的 `*-ui`）。
- **形态 B（框架无关嵌入）= 宿主自绘 UI**：`FRAMEWORK_FREE_EXCLUDES` 加入 `slide-ui`（此前只排除 `ui-react`，slide-ui 仍会带入 React/Radix）；`examples/embed-vanilla` 实现最小 `UiRenderer('vanilla')` 并跑 `runUiRendererConformance`。
- **第三方插件 UI** = 声明式条目为主；高级形态允许 React 组件（`ComponentRef`），必须经 `ContributionRenderer` 的 ErrorBoundary 并通过 `axeCheck` 夹具；随 M4 Stable 冻结 `ui.*` schema。
- **复制件清单调整**：`drawer.tsx` 与 `vaul`（上游 README 声明已停止维护，playground 无引用）**不迁移**；`sonner.tsx` 标注 `// Cordex override`，改读 `ThemeBridge`、去掉 `next-themes`（后者只被 sonner 使用），并改为静态引入其 `styles.css`。
- **严格 CSP / Trusted Types**（EM-14，M2 P0）：M2 贯通 CSP nonce（Radix 组件传 nonce；Radix select/scroll-area 以 `dangerouslySetInnerHTML` 注入常量 `<style>`，sonner 运行时追加 `<style>`，改动过的复制件标 `// Cordex override`）；Trusted Types M2 **report-only** → M3 **强制**（default policy 按哈希只放行已知常量 CSS）；Playwright 门禁：CSP/TT 违规数为 0。
- **命令写法**（Q9）：本 ADR 中所有 `npx shadcn …` 已改为 `pnpm dlx shadcn@4.21.0 …`。
- **决策 2–5 回写**：见正文决策 2（cn 精确锁版本）、3（`--cordex-*` 作废，C-22）、4（槽位宿主，14 §5.3 M-10/G-8、O-7）、5（三选择器等价，C-21）；§5.3 规则 4 为 `apps/web` 放行 `react`/`react-dom`/`react-router`/`tailwindcss`/`@tailwindcss/*`。
- **新增机械验证**：depcruise `cordex-ui-bundle-core-framework-free`（上述 `*-ui` 路径规则；全仓统一名，登记于 40-modules/01 depcruise 规则表，对应 TD-082；原名 `ui-domain-framework-free` 作废，2026-09-24 复核修正）；检查 `shadcn-overrides` 清单含 `sonner.tsx`；全仓无 `vaul`/`next-themes`；lint `react-19-0-api-floor`；Playwright CSP/TT 违规计数门禁（M2 report-only 计数、M3 强制）。
- 关联：rulings §4.15 Q2/Q9、§4.11 C-21/C-22；`40-modules/14` §4.1 O-7、§5.3；40-modules/10 §3/§6、11（FRAMEWORK_FREE_EXCLUDES、CSP）；PRD 05-embedding 形态 A/B、EM-14/EM-15、04-plugin-sdk。

## 变更记录 2026-09-25（rulings §4.18 GV-14 / GV-15：措辞对齐，语义不变）

- **CI job 名**（GV-14）：「如何被机械验证」中的「CI job `shadcn-diff`」改为「scanners job 的 `shadcn-diff` 步骤」，对齐 09-type-discipline/07 §3 的 13 个 job 名封闭集合；报告 → M2 稳定后阻断的节奏不变。
- **扫描器名**（GV-15）：`shadcn-components-sync`、`single-shadcn-copy`、`theme-vars-contract`、`shadcn-overrides` 原写作「扫描器」，但不在 09-type-discipline/06 的十四个扫描器之列；本 ADR 改称「检查」，按 09-type-discipline/08 §11 对照表落为测试断言：`shadcn-components-sync`、`single-shadcn-copy`、`shadcn-overrides` 为 `packages/ui-react/src/__tests__/shadcn-copy.test.ts`（test job，TD-091），`theme-vars-contract` 为 `packages/design/src/__tests__/theme-vars-contract.test.ts`（TD-092）。检查内容、适用范围与失败条件均不变。
