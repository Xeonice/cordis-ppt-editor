> 状态：草稿 v3.1 | 负责：设计（总编排起草） | 更新：2026-09-18 | 依赖：charter v0.2（D10 修订）、04-design-system v0.5、10 审计、11 提案、rulings §4.8–§4.10（Q9–Q20）

# 09 设计规范（Design Specification）—— shadcn Rhea + Liquid Glass 材质层

> v3.0 变更（用户裁决路线 B）：组件层继续 100% 复用 shadcn/ui，但基础风格由 `radix-nova` 改为 **`radix-rhea`**（shadcn 2026-05，紧凑版 Luma，macOS Tahoe 几何）；新增**材质层**（玻璃 token、`@utility glass/glass-strong`、浮层 data-slot 规则、退化与性能规则）与**四层层次模型**；应用壳改为悬浮玻璃卡布局；主色去紫；字体保留 Geist。本规范只定义：主题 token → shadcn 变量映射、OCE 元素 → shadcn 组件映射、组合模式与页面模板、材质与层次。唯一可执行基准仍是 `docs/20-design/playground/`（`/styleguide` 展示组件与材质状态）。

> v3.1 修订（2026-09-18）：按 rulings §4.9–§4.10（Q9–Q20）与 playground 现状回写——母版视图口径（同一编辑器；左栏"母版缩略图窗格"；检查器仅禁用"评论"；`Mod+Alt+M`；退出四种方式；仅编辑模式且视口 ≥ 1024 提供入口，Q12）；编辑器应用栏右侧顺序与「⋯」更多菜单（Q14 / Q20）；「切换」页签 M1–M3 只读展示（Q15）；查看器可选缩略图条与备注抽屉（Q18）；断点统一 1024 / 640（Q19，不再 768）；账户菜单为「设置」唯一入口、快捷键面板三入口；Ribbon 组间距 / 尺寸、属性行、纸面 / 迷你工具条 / 母版提示条 / 文档列表 / 缩略图项类名、`--canvas-glow` 取值、宿主防线位置按代码回写；Sheet 圆角留白、`contain: paint` / `data-interacting`、退化规则全覆盖标注"待实现"。

---

## 0. 原则

| 编号 | 规则 |
|---|---|
| S-01 | **复用优先**：能用 shadcn 组件解决的不自定义；hover/active/focus/disabled/aria 状态由 shadcn + Radix 提供，稿件与实现不得重写 |
| S-02 | **只在组合层做定制**：Ribbon、缩略图栏、母版缩略图窗格、画布覆盖层、检查器属性行等是 shadcn 组件的组合（`src/components/editor/*`），不是新组件库 |
| S-03 | **主题即契约**：`@oce/design` 交付 shadcn 主题变量 + OCE 扩展变量（语义色、画布、纸面、舞台、协作者色、**材质**）；组件不读裸色值 |
| S-04 | **Tailwind 工具类，不写组件 CSS**：只允许 `index.css` 里的 token、`@utility` 与 `[data-slot]` 规则；画布内文档内容（位置/尺寸/字号/颜色）是数据，允许内联样式 |
| S-05 | **风格 `radix-rhea`**：Lucide 图标、Geist 字体（CJK 回退系统字体）、紧凑尺寸；不混用第二套图标、字体或风格 |
| S-06 | **一屏实心 primary ≤ 3 处**；语义色文字用 `*-foreground`，图标/描边用主色，底色用 `*-muted` |
| S-07 | playground 与 03-screens 冲突时以 playground 为准并回写文档；新增界面先在 `registry.ts` 登记 |
| S-08 | **材质只用于控件层与浮层**（工具卡、侧栏卡、状态胶囊、菜单、弹层、对话框）；内容层（幻灯片纸面、缩略图内容、母版画布）永远不透明；玻璃不叠玻璃 |
| S-09 | **层次靠留白与材质，不靠线**：禁止边到边的实色分区线（`border-b/r/t`、`divide-y`）；列表内部允许 `border-foreground/5` 发丝线；"越浮越圆" |

---

## 1. 基础（主题与 Tailwind）

### 1.1 shadcn 变量映射（取值见 04 §2.2/§2.3/§9）

| shadcn 变量 | 亮色 | 暗色 | 用途 |
|---|---|---|---|
| `--background` / `--foreground` | #FFFFFF / #1A2030 | #151A26 / #F1F3F8 | 不透明面板与其文字（玻璃面板另见 §6） |
| `--card` / `--popover` | #FFFFFF | #1C2233 | 退化态（不支持/关闭透明时）的面板底 |
| `--primary` / `--primary-foreground` | **#3A5CE6** / #FFFFFF | **#6B93FF** / #101425 | 主按钮、选中态、当前页环、链接；去紫后的蓝靛（04 §9） |
| `--secondary` | #F5F6F8 | **#262E40** | 次要按钮底（暗色须比表面亮，2026-09-16 极性修正） |
| `--muted` / `--muted-foreground` | #F5F6F8 / **#5F6B80** | **#232A3B** / **#8A94A6** | 输入底、说明文字。暗色 `--muted` 原 #0F1420 比表面更暗，使 Rhea 的填充式选中态呈"凹陷黑洞"（用户截图），改为比玻璃表面（≈#192031）更亮；muted-foreground 在其上 4.68:1 |
| `--accent` | #EEF0F4 | **#2C3548** | 菜单项/列表 hover 高亮（比 muted 再亮一档） |
| `--destructive` | #D92D20 | #F0685E | 删除类操作 |
| `--border` | #E4E7EC | **#2A3245** | 仅列表内发丝线与退化态边框（S-09） |
| `--input` | **#DFE3EA** | #6B7689 | **字段填充基色**：Rhea 的 Input/Select/Textarea/InputGroup 用 `bg-input/50` 填充（浅色叠白 ≈ #EFF1F5，iOS 三级填充的蓝灰版），`border-transparent`；原 #8A93A2 是按描边 3:1 取的，叠白后成重灰、像禁用态（2026-09-16 用户截图） |
| `--border-control` | #757F8F | #6B7689 | 描边型控件（`ToggleGroup variant="outline"`、主题切换等）的边界。亮色 2026-09-18 由 #A3ABB9（白底 2.3:1）提高为 #757F8F：白底 4.05:1 / 画布 #EEF1F8 3.58:1 / 字段填充 #DFE3EA 3.14:1，满足 WCAG 1.4.11（用户裁决，rulings §4.10 Q21）；暗色 #6B7689 在画布 3.97:1 / 面板 3.54:1 / muted 3.12:1，仅在 accent 悬停面上 2.68:1（M2 复核） |
| `--ring` | #3A5CE6 | **#7DA2FF** | 焦点环 |
| `--radius` | 0.5rem | 同 | 派生刻度见 §1.4；Rhea 组件按 `--radius-*` 与 `rounded-full` 取值 |
| `--sidebar-*` | 同 background/accent/primary | 同暗色 | 仅 Sidebar 组件；缩略图栏/检查器实际用 §6 材质 |

### 1.2 OCE 扩展变量（已注册为 Tailwind 颜色或工具类）

| 变量 | 类名示例 | 用途 |
|---|---|---|
| `--success` / `--warning` / `--info`（各含 `-foreground`、`-muted`） | `text-success-foreground`、`bg-warning-muted` | 已同步/已解决、离线/评论钉、同步中/母版视图徽标 |
| `--canvas` + `--canvas-glow` | `bg-canvas`（body 与画布视口自动叠加光斑） | **背景层**：亮 #EEF1F8 / 暗 #101523 + 低饱和径向光斑 |
| `--doc-paper` / `--doc-ink` | `bg-doc-paper`、`text-doc-ink` | 幻灯片纸面与默认文字（不随主题） |
| `--stage` / `--stage-chrome` / `--stage-foreground` | `bg-stage` | 放映舞台与控制条（不随主题） |
| `--presence-1…12` | `ring-presence-2`、`border-presence-5` | 仅头像环、远端光标与选区 |
| `--glass-bg` / `--glass-bg-strong` / `--glass-border-color` / `--glass-blur` / `--glass-shadow` | `glass`、`glass-strong`（`@utility`） | **材质层**，取值与退化见 §6 |

### 1.3 字体与字阶

- 字族（用户裁决保留 Geist）：`'Geist Variable'` → `-apple-system, BlinkMacSystemFont, 'Segoe UI'` → `'PingFang SC', 'Microsoft YaHei'`；数字全局 `tabular-nums`。
- 字阶：`text-xs` 12 说明/状态/字段标签 · `text-sm` 14 UI 默认 · `text-base` 16 semibold 分区与对话框标题 · `text-xl` 20 页面与空态标题 · `text-2xs` 11 **仅**徽标/键帽/画布标签/Ribbon 组标题。层级靠 `font-medium/semibold` 与 `text-muted-foreground`，不靠字号；标题 600、正文 400，避免 500 泛滥。

### 1.4 间距、圆角、层级、图标、动效

- **间距**：Tailwind 4pt 阶；悬浮卡之间 `gap-2`（8px），壳外边距 `p-2`；卡内 `p-3/p-4`；Ribbon 组内 `gap-1`，组间 `gap-1.5`（6px，`RibbonRoot` 内容区 `gap-1.5 px-2 py-1`；原 `gap-2` 作废）。
- **圆角刻度（越浮越圆）**：控件（按钮、输入、分段、徽标）`rounded-full`（Rhea 默认）；菜单项、列表行、缩略图卡 `rounded-lg`；弹层、卡片、侧栏卡、工具卡 `rounded-2xl`；对话框、Sheet `rounded-3xl`（Rhea 默认更大者取其大）；纸面 `rounded`（4px，`SlideCanvas.tsx:76`；原 `rounded-md` 作废）。同心规则：内元素圆角 = 外圆角 − 内边距。
- **层级**：两级阴影——浮层/悬浮卡用 `--glass-shadow`；控件本身无阴影。分隔遵守 S-09。
- **图标**：Lucide；按钮内 16（`size-4`），Ribbon 大按钮 20；主操作"图标 + 文字"，次操作纯图标 + `Tooltip`；仅图标按钮 `aria-label`；装饰性图标 `aria-hidden`；图标按钮静止态有可辨识圆底（Rhea ghost 默认）。
- **动效**：悬停/按下 150–200ms ease-out；浮层出现 200ms（缩放 .96→1 + 淡入，组件自带）；`prefers-reduced-motion` 全局 1ms（index.css）。

---

## 2. 组件映射（OCE 元素 → shadcn 组件，Rhea 复制件）

| OCE 元素 | shadcn 组件 | 变体 / 尺寸 | 备注 |
|---|---|---|---|
| 主按钮 / 次要 / 幽灵 / 危险 | `Button` | `default` / `secondary`（或 `outline`）/ `ghost` / `destructive`；尺寸 `xs · sm · default · lg` 以 Rhea 复制件为准 | 一个对话框只一个 `default` |
| 图标按钮 | `Button size="icon-sm"/"icon"` + `Tooltip` | `ghost` 默认 | 必须 `aria-label` |
| 分段控制（普通/母版、亮/暗/系统、密度） | `ToggleGroup type="single"` | `size="sm"`，胶囊；选中态由 `[data-slot="toggle-group-item"][data-state="on"]` 规则显式化（浅色前景 8% 底、暗色白 14% 底 + 内高光） | 2–4 项；更多用 Tabs。**普通/母版切换常驻 Ribbon 页签行右侧**（用户裁决 2026-09-16），不再放缩略图栏顶部；仅编辑模式（有 `doc.write`）且视口 ≥ 1024 渲染，评审 / 放映 / 窄屏不显示（Q12） |
| 开关 / 复选 / 单选 | `Switch` / `Checkbox` / `RadioGroup` + `Label` | — | 单选列表 ≥ 3 项且带说明时改选项卡片（`Card` + 勾选角标） |
| 文本 / 数值输入 | `Input`（`inputMode="decimal"` + `tabular-nums`） | Rhea 填充式胶囊；状态：静止 `bg-input/50` → 悬停 64% → 聚焦转 `--card`（暗色白 10%）+ ring，由 `[data-slot]` 规则统一 | 单位用 `InputGroupAddon` |
| 带图标 / 组合输入 | `InputGroup` + `InputGroupAddon` + `InputGroupInput` | — | 搜索、邀请三件套 |
| 下拉选择 | `Select`（Ribbon 内 `SelectTrigger size="sm"`，宽度按内容：字体 `w-36`、字号 `w-16`） | — | 内容自动玻璃化 |
| 字段 | `Field` + `FieldLabel` + `FieldDescription` + `FieldError`，成组 `FieldGroup` | — | 占位符不作标签 |
| 滑块 | `Slider` | — | 值用 12px tabular |
| 页签（Ribbon / 检查器 / 设置） | `Tabs` + 默认 `TabsList`（Rhea 胶囊分段） | **唯一一套**；禁 `variant="line"` 与自绘底边 | 插件页签 `text-primary`；单页签时左对齐、不撑满 |
| 筛选 chip | `Toggle size="sm"` 或 `ToggleGroup type="multiple"` | — | `aria-pressed` 由组件提供 |
| 徽标 / 计数 / 状态 | `Badge` | `secondary` 计数 · `outline` 状态 · 语义色 `bg-*-muted text-*-foreground` | 状态栏状态一律徽标化 |
| 头像 + 在场环 | `Avatar` + `AvatarGroup`；环 `ring-2 ring-presence-N ring-offset-2 ring-offset-transparent` | 28 / 24 / 20 | 玻璃底上 offset 用 transparent |
| 工具提示 | `Tooltip`（`delayDuration={400}`） | 深色玻璃胶囊（不随主题翻转） | 快捷键用 `Kbd` |
| 菜单 / 右键 / 菜单栏 | `DropdownMenu` / `ContextMenu` / `Menubar` | 危险项 `variant="destructive"` | 自动玻璃化（§6.3） |
| 弹出面板 / 提示卡 | `Popover` / `HoverCard` | — | 自动玻璃化 |
| 对话框 / 确认 / 抽屉 | `Dialog` / `AlertDialog` / `Sheet` / `Drawer` | 遮罩 `bg-black/20 + blur` | 不可撤销才用 `AlertDialog`；Sheet 朝内一侧 `rounded-l-3xl` + 顶底 8px 留白为**待实现（M2）**：须以 `[data-slot="sheet-content"]` 规则写入 `index.css`（playground 当前为 Rhea 默认贴边形态，`Settings.tsx` / `EditorShell.tsx` 均未加类） |
| Toast | `sonner`：`toast(msg, { action })` | 3.5s / 带操作 5s | 删除即 toast + 撤销 |
| 横幅 | `Alert`（语义变体 + `glass` 或 `bg-*-muted`），`mx-2 mt-2 rounded-2xl` | — | 不贴边平铺 |
| 命令面板 | `Command` 置于 `CommandDialog` | — | `Mod+Shift+P` |
| 母版缩略图窗格 | 与缩略图项同款卡片：母版一张大缩略图（编号 · 母版 · 名称），版式为缩进 16px、左侧连接线的小缩略图，标签在卡上方（名称 + 页数/未使用） | 选中 `ring-2 ring-primary ring-offset-2` | **不是文字树**（PowerPoint 母版视图左栏仍是缩略图，2026-09-16 用户反馈） |
| 缩略图项 | 原生 `<button type="button">`（`relative rounded-xl outline-none`，`aria-current` / `aria-label`）包一张 `MiniSlide`（`aspect-video rounded-[inherit] bg-doc-paper`）；页码标签在卡上方（`text-xs tabular-nums`，当前页 `font-semibold text-primary` + "· 当前"）；右上角警告 / 评论计数 `Badge`（`h-4 text-2xs`）；不是 shadcn `Button`（`ThumbnailRail.tsx` `SlideRow`，2026-09-18 按代码回写） | 静止 `ring-1 ring-border hover:ring-ring`；当前页 `ring-2 ring-primary ring-offset-2 ring-offset-transparent`；`focus-visible:ring-2 focus-visible:ring-ring` | 母版窗格的 `MasterThumb` 同款（`role="option"` + `aria-selected`）；隐藏页叠加斜纹 + 50% 透明；加载态才用 `Skeleton` |
| 检查器分区 | `Accordion type="multiple"` + `inspector-groups`（两层色阶，2026-09-17 由三层收敛：玻璃面板直接承载白色分组卡 `.oce-group`（`--card` + 发丝描边 6% + 极淡投影；暗色白 5%/描边 6%）→ 灰色字段 `bg-input/50` → 文字；`.oce-well` 仅保留布局，不着色）：每个分区一张 `rounded-xl` 卡，分区间距 10px，触发器高 36 / 内边距 10×12、12px 半粗淡色标题，内容内边距 0 12 12，行距 10px；折叠分区与展开分区同一形态 | 标记类加在 `<Accordion>` 根元素上，选择器须同时匹配自身与后代（2026-09-16 用户反馈"少了间距"的根因） | — |
| 属性行 | `PropertyRow`：`flex items-center gap-2 py-1`；标签列 `w-14 shrink-0 text-xs text-muted-foreground`（56px 固定）；控件区 `flex min-w-0 flex-1 items-center gap-1.5 *:min-w-0`（子项 `min-w-0`，防字段固有宽度撑出横向滚动，2026-09-17）；原 `grid grid-cols-[2.5rem_1fr]` 作废 | 字段 `h-7 text-xs`；`NumberField` = `Input inputMode="decimal" tabular-nums` + 绝对定位后缀 | 成对 `PropertyRowPair`：同一行两个 `flex min-w-0 flex-1` 半区，各带内联短标签（X/Y、宽/高） |
| 颜色块 | `Button size="icon" variant="outline"` + 色块 + `Popover` | 28 | `aria-label` 含当前值 |
| 进度 / 骨架 / 加载 | `Progress`（离边缘留白、圆角轨道）/ `Skeleton`（仅真实加载）/ `Spinner` | — | >300ms 才显示 |
| 空态 | `Empty` 系列 | — | 一个操作 |
| 列表项 / 卡片 | `Item` / `Card`（Rhea 默认圆角，不再手写 `rounded-*` 改小） | — | 文档列表用 `Card` |
| 表格 / 可拖分栏 / 滚动区 / 面包屑 / 键帽 | `Table` / `ResizablePanelGroup orientation="horizontal"`（手柄静止透明，悬停/聚焦显色）/ `ScrollArea` / `Breadcrumb` / `Kbd` | — | — |
| 品牌 | `Brand`（`BrandMark` SVG：主色圆角方块内的 16:9 幻灯片 + 字标 "OCE 幻灯片"） | 28px 标 + 14px 字标 | 首页侧栏、文档列表顶栏、目录页统一使用；不借用 Palette 等泛用图标 |
| 当前用户菜单 | `UserMenu`（`DropdownMenu`；`row` 首页侧栏底部整行触发 / `avatar` 顶栏头像触发——文档列表顶栏与**编辑器族全部路由的应用栏右侧末位**共用同一 `avatar` 形态，Q14） | 头像 28，无在场环 | 菜单项：设置（`Mod+,`）/ 键盘快捷键（`Mod+/`）/ 帮助中心 / 退出登录。「设置」的**唯一**入口（侧栏、顶栏不再单独放"设置"按钮，2026-09-17 用户：重了；T-07 导航卡亦不含"设置"）；快捷键面板则保持**三个入口**：Ribbon 页签行右侧「?」、本菜单「键盘快捷键」、`Mod+/`（rulings §4.10："唯一入口"只对「设置」成立） |
| 大幅面幻灯片内容 | `SlideContent`（组合层，真实文字、cqw 缩放） | — | 放映、查看器、无选区演示的画布 |

---

## 3. 组合模式（`src/components/editor/*`）

| 模式 | 组成 | 尺寸 / 材质 |
|---|---|---|
| 悬浮工具卡 | `AppBar` + `Ribbon` 合成一张 `glass-strong rounded-2xl`；应用栏与页签之间发丝线；Ribbon 页签为胶囊分段，页签行右侧常驻 **视图模式分段（普通/母版，`ViewModeSwitch`；仅编辑模式且视口 ≥ 1024 渲染，Q12）** + 主题切换 + 帮助「?」（`CircleHelp`，快捷键面板三入口之一，`Mod+/`）；组用 `rounded-xl bg-foreground/[.03]` 柔和底 + 组标题 `text-[11px] leading-none text-muted-foreground/70`（= `text-2xs`，11px），组间 `gap-1.5`（6px）无竖线。**高度节奏（2026-09-17）**：页签行 36px（`h-9`），页签内容区固定 91px（`h-[91px] py-1`），组 `self-stretch` 等高 83px；组内小控件统一 28px（`h-7` / `size="sm"` / `icon-sm`），堆叠列行距 4px，大按钮 = 两行 = 60px（`h-[60px]`），下拉与分段同为 28px；复选框堆叠为 3×20px 或 2×28px；主题卡 84×60、变体色块 44×28；禁止 24px（`h-6`）与 32px 混排。**排布**：每组 = 左侧大按钮 + 右侧一列两行小控件（开始页签范式），不行列混排；图标一律 Lucide 线性（不用彩色方块/红圈等异质图示，红色只出现在 `text-destructive` 的线性图标或菜单项上） | 应用栏 48 + 页签行 36 + 内容区 91（组 83）；小控件 28 / 大按钮 56×60（`w-14 h-[60px]`）；原"组 60"作废 |
| 侧栏卡 / 检查器卡 | `ResizablePanel` 内 `glass-strong rounded-2xl overflow-hidden`；缩略图栏直接从分节/缩略图列表开始（模式切换已移至 Ribbon）；母版视图下同一窗格显示母版大缩略图 + 缩进的版式缩略图；检查器 `Tabs` 胶囊 + `ScrollArea` + `Accordion`（`inspector-groups`） | 宽 240 / 300（`EditorShell` 默认 `thumbnailRailWidth=240` / `inspectorWidth=300`，像素；可拖 160–420 / 240–720；版本历史 560；原 168 / 280 作废）；根节点无底色（材质来自卡） |
| 画布区 | 透明视口，`bg-canvas` 光斑透出；纸面 `bg-doc-paper text-doc-ink rounded shadow-md`（4px 圆角；chrome 内唯一允许阴影的对象，`SlideCanvas.tsx:76`；原 `rounded-md shadow-2xl` 作废）；默认 `zoom="fit"`（`ZoomValue = number \| "fit" \| "fit-width"`），缩放条为底部居中 `glass rounded-full` 胶囊（`mx-auto mb-2 px-3 py-1.5`：− / 滑块 / + / 百分比 / 模式下拉） | 视口 `p-6`（`overflow-auto`），fit 留 16px 余量 |
| 画布覆盖层 | 选中框 `border-[1.5px] border-primary` + 8 个 10px 圆形手柄（`size-2.5 rounded-full border-[1.5px] border-primary bg-doc-paper shadow-sm`）+ 可选旋转手柄，标签 `bg-primary text-2xs` 胶囊；远端选区 `border-[1.5px] border-dashed border-presence-N` + `outline-doc-paper` 外描边 + 12% 填充；远端光标 SVG + 胶囊标签；评论钉 24 `bg-warning-foreground` + 白描边 + `shadow-sm`（规范值；playground `CommentPin` 现为 `bg-warning shadow-md`，白字 11px 仅 4.0:1，不达 04 §2.5，待改回）；迷你工具条 `glass-strong rounded-xl p-1 gap-0.5`（`MiniToolbar`，原 `rounded-full` 作废）；继承占位符 `border border-dashed border-muted-foreground/50` + 「母版 · 名称」小徽标 | 浮动标签共用一套语言 |
| 状态胶囊 | `StatusBar` = `mx-2 mb-2 h-8 rounded-full glass-strong`；状态用 `Badge` 语义色胶囊；备注栏 `NotesBar` = `mx-2 mb-2 rounded-2xl glass-strong` | 高 32 |
| 反馈分层 | `Alert`（连接/权限，玻璃横幅）> `sonner` > `FieldError` > 状态胶囊 | 同一事件只用一层 |
| 空 / 加载 / 错误 | `Empty` / `Skeleton` shimmer（仅加载）/ `Alert variant="destructive"` + 重试 | 高度与真实内容一致 |

---

## 4. 页面模板

| 模板 | 结构 |
|---|---|
| T-01 编辑器壳 | 根 `bg-canvas p-2 gap-2 flex-col`：悬浮工具卡 / `ResizablePanelGroup`（侧栏卡 240px · 画布区 · 检查器卡 300px，**像素而非百分比**，版本历史 560px；手柄 `w-2` 静止透明、悬停 `bg-foreground/10`）/ 备注卡 / 状态胶囊；只读/评审态 Ribbon 位置用 `ReadonlyRibbonNotice` 40px 细条或评审工具条，不留空卡。**应用栏右侧顺序（Q14，`AppBar.tsx`）**：在场头像堆叠 · 竖分隔 · 「分享」`Button variant="outline" size="sm"` · 模式下拉 `Select size="sm" w-32`（编辑 / 评审模式；二者由路由作为 `children` 传入）· 「⋯」更多 `DropdownMenu`（`MoreMenu`，Q20：导出…（`Mod+E`）/ 保真报告 / 版本历史 / 插件管理器 / 分隔 / 重命名 / 创建副本；「开发者」仅开发模式显示，playground 不展示）· 账户头像 `UserMenu variant="avatar"`（编辑器族全部路由共用，`showAccount` 默认开）；侧栏收起时应用栏再补 `PanelLeft` / `PanelRight` 打开按钮（见断点）。**Ribbon「切换」页签（Q15，`TransitionTab`）**：M1–M3 只读展示——「切换效果 · 只读」组 `ToggleGroup disabled` 显示当前页保留的效果名，「计时 · 只读」组显示时长与换片方式（`readOnly disabled`），说明组「已保留原文件的切换效果，M1–M3 暂不可编辑」；不提供「应用到全部」「自动换片」等可编辑控件。**断点（Q19，`useBreakpoint()`：`BREAKPOINT_DESKTOP=1024` / `BREAKPOINT_COMPACT=640`，以 01 §6 表为准；原 768 与旧 `useIsMobile` 口径作废）**：≥ 1024 完整三栏；**紧凑态（640–1024）**缩略图栏收为 `glass-strong w-11`（44px）图标条、点击 `PanelLeft` 展开为 `Sheet side="left" w-72`，检查器默认收起、由应用栏右端 `PanelRight` 打开 `Sheet side="right" w-80`（不挤压画布），Ribbon 低优先级按钮进「更多」溢出（playground 未做）；**仅查看态（< 640）**顶部 `role="status"` `glass h-9 rounded-2xl` 提示条「仅查看：窄屏下不提供完整编辑 UI」，两侧栏都只走 `Sheet`（缩略图栏由应用栏 `PanelLeft` 打开），Ribbon 收为 48px 查看态工具条（翻页 / 缩放 / 评论 / 更多；playground 仍渲染完整 Ribbon，待做） |
| T-02 母版视图 | **同一个编辑器，不是专用模式**（对齐 PowerPoint 幻灯片母版视图）：同壳；应用栏 `Badge`（母版视图）+「改动将影响 N 页」徽标；Ribbon 在最左插入"母版"页签（强调色），开始/插入/切换/视图/插件页签照常可用，仅隐藏"设计"页签（主题/背景控件在母版页签「主题」组，Q10）；页签行右侧视图模式分段处于"母版"档；母版页签最右为独立的"关闭"组（`RibbonGroup` + `RibbonBigButton`，`CircleX` 线性图标 `text-destructive` + "关闭母版视图"，对应 PowerPoint 的 Close 组），不与主题组混排；检查器四个页签中**仅"评论"禁用**（`disabledTabs={["comments"]}`，`aria-disabled` + tooltip "母版与版式不支持评论"），属性/历史/插件照常；左栏为**母版缩略图窗格**（母版大缩略图 + 缩进 16px、左侧连接线的版式缩略图，同款卡片，非文字树）；画布上方范围 / 提示条 `glass mx-2 mt-2 h-9 rounded-2xl px-4 text-xs`（不换行；原 `rounded-full` 作废）。**入口与可用范围（Q9 / Q12）**：仅编辑模式（有 `doc.write`）且视口 ≥ 1024 提供入口——页签行分段、视图页签「窗口」组「母版视图」按钮、快捷键 `Mod+Alt+M`；评审 / 放映 / 窄屏下分段不显示、视图页签按钮禁用并 tooltip 说明原因（`masterEntry` = `enabled` / `review` / `narrow`，文案「评审模式下不可用」/「需要 ≥ 1024 宽度」）、快捷键无效；已在母版视图中时缩窄窗口不强制退出。**退出四种方式**：母版页签「关闭」组 / 页签行分段切回「普通」/ `Esc` / 再按 `Mod+Alt+M`；退出后回到进入前的页与检查器页签（会话记忆，不写入文档；playground 已实现「关闭」组与分段两种，`Esc` / 再按快捷键退出与 `Mod+Alt+M` 入口按键尚未绑定，待补） |
| T-03 文档列表 | 一张 `glass-strong rounded-2xl px-4 py-2.5 sm:px-6` 顶卡（`flex-wrap`：`Brand` + `InputGroup` 搜索 + 筛选 `Tabs`（全部 / 我拥有 / 共享给我 / 最近，胶囊分段；原 `ToggleGroup` 作废）+ 右侧 导入 .pptx / 新建 + 主题切换 + `UserMenu` 头像）+ `Card` 网格按断点列 `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`（原 `auto-fill minmax(240px)` 作废）；卡内缩略图用 `MiniSlide` 线框示意，底部 标题 / 所有者 · 时间 / 「仅查看」徽标 / 协作者 `AvatarGroup` / 「更多」菜单 |
| T-04 只读查看器 | 顶部 `glass-strong rounded-2xl mx-2 mt-2 h-11 px-3` 工具卡（翻页、页码输入 + 总页数、缩放 − / 百分比 / +、全屏、搜索、导入摘要 `Popover`；宿主开启备注时追加「备注」切换按钮）+ 画布 `zoom="fit"`（`hideZoomBar`）。**可选缩略图条与备注抽屉（Q18，按 PRD OF-14）**：`preset-slide-viewer` 初始化参数 `thumbnails` / `notes`，默认全关，关时对应 UI 不渲染、代码按需加载、不计入 350 KB 基线——缩略图条为底部横向 `glass-strong mx-2 mb-2 h-20 rounded-2xl px-3` 条（`role="listbox"`，同款 `MiniSlide` 卡，当前页 `ring-2 ring-primary`）；备注抽屉为非模态 `Sheet side="right" w-80`（标题「备注 · 第 N 页」，无备注时「本页没有备注」） |
| T-05 放映 | `bg-stage`；控制条 `bg-stage-chrome/80 backdrop-blur-lg rounded-full`，按翻页 / 视图 / 退出分组；顶部信息条同款小胶囊 |
| T-07 应用首页 | 左 224px（`w-56`）`glass-strong rounded-2xl p-3` 导航卡（品牌、主导航、底部 `UserMenu variant="row"` 账户行；不含"设置"，设置只从账户菜单进入）+ 主区 max-w 1024：新建卡网格（16:9，`minmax(150px,1fr)`）/ 最近列表（`.oce-group`）/ 指南卡网格（`minmax(220px,1fr)`）；编辑器"返回"落到此页 |
| T-06 设置 | `Sheet side="right"` `w-80`（玻璃；`rounded-l-3xl` + 顶底 8px 留白**待实现（M2）**，经 `[data-slot="sheet-content"]` 规则实现，见 §2 对话框行），头部标题 + "个人偏好，不影响协作者；关闭即保存"，右上 × / Esc / 点遮罩均为关闭，**关闭 = 返回打开它的页面**（不切到别的抽屉）；内容区 `.oce-well m-3 p-3`，分组用 `.oce-group p-3`；主题/密度用 `ToggleGroup` |

---

## 5. 遵循方式

1. **playground 是唯一基准**：`src/routes/*` 每条路由对应一个界面文档；`/styleguide` 展示组件与材质状态；构建产物发布为 artifact。
2. **实现规则**：`components.json` `style: "radix-rhea"`；只用 `src/components/ui/*`（shadcn 复制件，**不改**）与 Tailwind 工具类；组件级视觉定制一律写成 `index.css` 的 `[data-slot=…]` 规则或 `@utility`，使 `npx shadcn add -o` 升级不覆盖；确需改复制件时文件头标 `// OCE override` 并进入扫描清单。
3. **宿主防线**：`body` 的 `color / font-family / font-size / line-height / background` 必须以**未分层**规则写在 `index.css` 的 `@layer` 之外（当前位于 `index.css` 后段、字段 token / `.oce-well` 井层规则之前；其后不得再出现任何 `body` 选择器，可 grep 校验）——嵌入宿主（claude.ai artifact 查看器等）会给 `body` 注入未分层的 `color:#141413; font:14px -apple-system…; background:#faf9f5`，而 `@layer base` 里的声明在层叠上永远输给它，暗色下所有继承色文字会变成近黑（2026-09-16 用户截图，已用宿主外壳本地复现并修复）。验收时必须用 `scripts/host-wrap.py` 生成宿主外壳版再截图，不能只看 `dist/index.html`。
4. **审查清单**：仅图标按钮有 `aria-label`；输入有可见 `Label`；对话框有标题与描述；删除走可撤销 toast；一屏实心 primary ≤ 3；无边到边分区线；Tab 只有胶囊一套；同屏 `backdrop-filter` 元素 ≤ 4；玻璃面板文字对比 ≥ 4.5:1（§6.5）；`prefers-reduced-transparency` 下面板不透明；亮暗主题各过一遍；`npm run build` 通过（TS strict）。
5. **与产品代码的关系**：playground 的 `components/ui` 与 `components/editor` 是 `@oce/ui-react` 的种子；`@oce/design` 交付 `index.css` 中的主题变量 + 材质 token + `@utility`；`ui-react/styles` 承载 data-slot 规则；`ui-core` 的贡献点渲染为这些组合组件。
6. **与 03-screens 的关系**：界面文档保留线框、状态与交互说明；头部"设计基准"行指向本规范与 playground 路由，不再重复尺寸。

---

## 6. 材质与层次（v3.0 新增）

### 6.1 四层层次模型

```
┌ 浮层   glass-strong：菜单 / 弹出 / 对话框 / 命令面板 / 工具提示 ─────┐
│ 控件层 glass-strong：悬浮工具卡 · 侧栏卡 · 检查器卡 · 状态胶囊 · 横幅   │
│         glass       ：画布缩放胶囊 · 画布上的浮动面板（查找、迷你工具条）│
│ 内容层 不透明：幻灯片纸面 · 缩略图内容 · 母版画布 · 放映舞台内容        │
└ 背景层 bg-canvas + canvas-glow：柔和渐变 + 低饱和光斑，供玻璃透出 ────┘
```

规则：控件层之上再出现浮层时，浮层用 strong 且控件层不额外加模糊；同屏玻璃元素 ≤ 4；内容层永远不透明（HIG：玻璃属于导航/控件层）。

### 6.2 材质 token（可执行定义：`playground/src/index.css`）

| token | 亮 | 暗 |
|---|---|---|
| `--glass-bg` | `rgba(255,255,255,.72)` | `rgba(28,34,52,.62)` |
| `--glass-bg-strong` | `rgba(255,255,255,.84)` | `rgba(28,34,52,.78)` |
| `--glass-border-color` | `rgba(255,255,255,.55)` | `rgba(255,255,255,.10)` |
| `--glass-blur` | `blur(24px) saturate(150%)` | 同（暗色可降至 140%） |
| `--glass-shadow` | 内高光 `inset 0 1px 0 rgba(255,255,255,.7)` + rim `0 0 0 1px rgba(15,20,40,.08)` + `0 8px 32px rgba(20,25,50,.10), 0 1px 2px rgba(20,25,50,.06)` | 内高光 `inset 0 1px 0 rgba(255,255,255,.08)` + rim `0 0 0 1px rgba(0,0,0,.35)`（iOS 27 暗色边缘）+ `0 12px 40px rgba(0,0,0,.45)` |
| `--canvas` / `--canvas-glow` | `#EEF1F8`；光斑 = `radial-gradient(760px 520px at 16% 10%, rgba(74,84,225,.13), transparent 60%)` + `radial-gradient(680px 480px at 88% 84%, rgba(14,138,122,.10), transparent 60%)` + 底层 `linear-gradient(165deg, #EEF1F8 0%, #E9ECF5 46%, #EEF3F3 100%)`（`index.css` L205–208；原"靛蓝 6% / 青 5%"作废） | `#101523`；光斑 = `radial-gradient(760px 520px at 16% 8%, rgba(111,121,238,.18), transparent 60%)` + `radial-gradient(680px 480px at 88% 86%, rgba(59,198,130,.11), transparent 60%)` + `linear-gradient(165deg, #101523 0%, #0B0F19 100%)`（L220–223） |

取值原则：桌面编辑器文字密集，采用 iOS 27"降低默认透明度"的方向（ui-ux-pro-max glassmorphism 条目的 15–30% 白只适用于鲜艳背景的营销页，**不采纳**）。

### 6.3 应用方式

- 工具类：`glass`、`glass-strong`（Tailwind 4 `@utility`）。**声明顺序硬规则**：`-webkit-backdrop-filter` 必须写在 `backdrop-filter` 之前——Tailwind 4/Lightning CSS 对同一属性的前缀/标准声明去重时只保留最后一条，写反会把标准属性丢掉，Chrome 不认 `-webkit-` 前缀，结果是"半透明但不模糊"（2026-09-16 实测：编译产物只剩 `-webkit-backdrop-filter`，`getComputedStyle().backdropFilter === 'none'`）。CI 门禁：编译后的 CSS 必须同时含 `backdrop-filter:var(--glass-blur)` 与 `-webkit-` 版本。
- 浮层自动化：`[data-slot="popover-content" | "dropdown-menu-content" | "dropdown-menu-sub-content" | "context-menu-content" | "context-menu-sub-content" | "select-content" | "dialog-content" | "alert-dialog-content" | "sheet-content" | "drawer-content" | "menubar-content" | "menubar-sub-content" | "hover-card-content" | "command"]` → strong 材质；遮罩 `[data-slot="*-overlay"]` → `bg-black/20 + blur(4px)`；`[data-slot="tooltip-content"]` → 深色玻璃胶囊。
- 退化（硬规则）：`@media (prefers-reduced-transparency: reduce)` 与 `@supports not (backdrop-filter: blur(1px))` **两种退化都必须同时覆盖** `.glass` / `.glass-strong` **与全部浮层 data-slot**（上一条清单，两处清单须保持一致），退化为不透明 `var(--card)` + `border-color: var(--border)`，并把 `box-shadow` 由 `--glass-shadow`（含内高光与 rim）换为普通阴影 `0 1px 2px rgb(0 0 0 / .08), 0 8px 24px rgb(0 0 0 / .12)`、`backdrop-filter: none`；`tooltip-content` 保持不透明深色 `#141622`；遮罩失去模糊后加深为 `rgb(0 0 0 / .40)`。两块内容相同、分别对应两个触发条件（已实现：`index.css` "§6.3 退化规则"两块，2026-09-18）。`prefers-contrast: more` 时描边改 `var(--border-strong)`（待实现）。

### 6.4 性能规则

- 同屏 `backdrop-filter` 元素 ≤ 4（壳 3 块 + 1 个浮层）；画布区不加玻璃。
- 玻璃面板 `contain: paint`（**待实现，M2**）；`ResizablePanel` 拖拽期间与画布缩放动画期间允许临时切换为不透明（`data-interacting` 属性 + `[data-interacting] .glass*` 规则，**待实现，M2**），结束后恢复。
- 不使用 SVG 折射（`feDisplacementMap`）与扫光动画；玻璃是静态材质。

### 6.5 对比核算（计算值，`design/__tests__` 机械校验为准）

| 文字 / 材质（背后为背景层） | 亮 | 暗 |
|---|---|---|
| `--foreground` on `glass-strong` | ≈ 16:1 | ≈ 14.7:1 |
| `--muted-foreground` on `glass-strong` | ≈ 4.9:1 ✓ | ≈ 5.4:1 ✓（暗色 muted 由 #7C8697 提亮为 #8A94A6，原值 ≈ 4.45:1 不达标） |
| `--muted-foreground` on `glass`（72%/62%） | ≈ 4.8:1 ✓（仅允许承载非正文：缩放数字、胶囊标签） | 不允许承载 muted 正文 |
| `--primary` 文字 on `glass-strong` | ≈ 5.3:1 ✓ | ≈ 6.0:1 ✓ |

背后内容比背景层更深（如暗色纸面）时对比会下降，因此 strong 面板不得叠在纸面之上；画布上的浮动面板（`glass`）只放图标与短标签。
