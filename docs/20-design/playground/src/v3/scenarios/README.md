# v3 场景（scenarios）

v3 样张按界面规格（`docs/20-design/03-screens/NN`）拆成**场景**：一个场景是 v3 编辑器的一组**状态**，每个状态用一份编辑器配置描述「此刻编辑器长什么样」（当前页、选中对象、检查器分区、画布叠加层、打开的弹层 / 对话框 / 菜单、工具条当前工具、视图……）。

- 行为、状态与边界情况以 03-screens 为准；视觉以 v3（rulings §4.25 DS-1…DS-63）为准。旧版 `src/routes/`、`src/components/` 只作状态与内容的参考，不改、不照抄其视觉。
- 编辑器与 Hub 用 `import.meta.glob('./scenarios/**/*.scenario.tsx', { eager: true })` **自动发现**场景（`src/v3/scenario-registry.ts`），不需要在任何共享文件里登记。
- 打开：`#/v3/editor?state=<场景 id>.<状态 id>&theme=dark|light`（只写 `state=<场景 id>` 取第一个状态；写错时编辑器顶部出现错误横幅，列出可用的 id）。旧的 `state=empty|shape|text|shapes-menu` 与 `view=grid` 行为不变，且**优先解析**：场景 id 不能取这四个名字（03-16 的文本场景因此叫 `text-edit`）。
- Hub 按场景的 `batch`（缺省 1）分组，自动生成「第 1 批 · 编辑器族」「第 2 批 · 协作族」（第 3 批同理）的卡片与暗 / 亮链接，还没有场景的批次不显示；id 以 `_` 开头的场景（如 `_kit`）不展示。**第 2 批的场景一律写 `batch: 2`**，否则会混进第 1 批（已拍板）的分组。
- 第 2 批（协作族）2026-10-15 拍板（rulings §4.25 DS-38…DS-63），拍板后的改动见 §3c（备选状态标「未采纳」、第 1 批画面按裁决改的地方），文档回写中新裁的 DS-64…DS-70 与 TB-77…TB-84 的补改见 §3d。第 3 批（应用壳族）的页面级宿主（`#/v3/<宿主>`）、新共享件与约定见 §3e。第 2 批新增的底座见 §3a：评论页签插槽 `inspector.commentsBody`、检查器整栏面板 `InspectorTakeover` / `inspector.takeover`、身份色 12 色与 `toneOf(userId)`；第 2 批集成阶段把 6 组重复的局部件并进了底座（§3b：底座命令、检查器页签受控、整栏面板初值、横幅叠放与离线横幅、对话框初始焦点、缩略图角标、面板状态块等），写新场景前先看 §3b，不要再在场景里复制一份。

## 1. 并行纪律

- **只在自己的目录里新建文件**：`src/v3/scenarios/<场景 id>/`。不改共享代码（`Editor.tsx`、`editor/*`、`kit/*`、`ui.tsx`、`v3.css`、`types.ts`、`scenario-registry.ts`、`SlideArt.tsx`…）。配置与 kit 不够用时先用逃生口（`regions`、函数形式的插槽），仍不够就在交付说明里写明缺什么，由集成阶段补。
- 不提交、不推送、不 stash / reset；不跑 `npm run build`。
- 第 2 批场景写 `batch: 2`（§3a），截图放 `v3-shots/batch2/`（§8）。
- 类型检查：`npx tsc -p tsconfig.app.json --noEmit`。别人的目录可能正在改，只看自己目录的报错：`npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep 'src/v3/scenarios/<场景 id>/'`。
- 预览：`npx vite --port <分配的端口> --strictPort`（开发服务器，不写 dist），用完关掉。
- 所有场景都被 eager 导入：**模块顶层不要做可能抛错的事**（只写常量、组件、`inspectorSection` 注册），语法错误会让所有人的编辑器白屏，保存前先过类型检查。

## 2. 新建一个场景

```
src/v3/scenarios/find-replace/
  find-replace.scenario.tsx   ← 默认导出 defineScenario({...})（文件名必须以 .scenario.tsx 结尾）
  FindBar.tsx                 ← 场景自己的组件、自定义页、检查器分区，随意拆文件
```

命名：

| 项 | 规则 | 例 |
|---|---|---|
| 场景 id | 小写 kebab-case、全局唯一、不含 `.`；与界面规格的主题对应；不用旧状态名 `empty` / `shape` / `text` / `shapes-menu` | `find-replace`、`table`、`text-edit` |
| 状态 id | 小写 kebab-case、场景内唯一；第一个是默认态 | `default`、`no-match`、`readonly`、`m2-disabled` |
| 检查器分区 id | `<场景 id>.<分区>` | `table.cell-fill` |
| 自定义选中种类 | 真实种类直接用（见 §4）；场景私有的加前缀 | `table-cell`、`find-replace-hit` |
| 自定义锚点 | `<场景 id>.<名字>` | `table.border-menu` |

最小示例：

```tsx
// src/v3/scenarios/find-replace/find-replace.scenario.tsx
import { ChevronDown, ChevronUp, Search, X } from "lucide-react"
import { FloatingPanel, HoverBox, ICON, IconButton, TextField } from "../../kit"
import { defineScenario } from "../types"

function FindBar({ count }: { count: string }) {
  return (
    <div className="flex items-center gap-1">
      <TextField aria="查找" defaultValue="营收" leading={<Search {...ICON} className="shrink-0" />} trailing={<span className="text-[11px] leading-none text-(--v3-text-2) tabular-nums">{count}</span>} className="flex-1" />
      <IconButton label="上一个" kbd="⇧↵"><ChevronUp {...ICON} /></IconButton>
      <IconButton label="下一个" kbd="↵"><ChevronDown {...ICON} /></IconButton>
      <IconButton label="关闭" kbd="Esc"><X {...ICON} /></IconButton>
    </div>
  )
}

export default defineScenario({
  id: "find-replace",
  title: "查找与替换",
  specs: ["03-21"],
  summary: "画布右上角浮动条，命中项在幻灯片上高亮",
  editor: { stage: { cursor: false } },          // 场景内各状态共用
  states: [
    {
      id: "default",
      title: "有匹配",
      note: "03-21 状态「有匹配」：当前命中填充高亮，其余描边",
      editor: {
        slide: 4,
        canvasOverlay: <FloatingPanel label="查找和替换" className="w-[340px] p-2"><FindBar count="1/5" /></FloatingPanel>,
        slideOverlay: <HoverBox fill box={{ x: 6.6, y: 10.6, w: 9.8, h: 10.6 }} />,
      },
    },
    { id: "no-match", title: "无匹配", editor: { canvasOverlay: <FloatingPanel label="查找和替换" className="w-[340px] p-2"><FindBar count="0/0" /></FloatingPanel> } },
  ],
})
```

完整可运行的示例见 `_kit.scenario.tsx`（每个 kit 组件一个状态）：`#/v3/editor?state=_kit.<状态>`，状态有 `popover-toolbar`、`popover-inspector`、`menu`、`context-menu`、`dialog`、`dialog-confirm`、`floating-panel`、`toast`、`banner-info`、`banner-warning`、`banner-error`、`controls`、`canvas`、`deck`，第 2 批底座另有 `comments-body`（评论页签插槽）、`takeover`（检查器整栏面板）、`tones`（身份色 12 色核对表）。

## 3. 场景与编辑器配置（`scenarios/types.ts`）

```ts
defineScenario({
  id, title, specs: ["03-30"], summary?, batch?: 1 | 2 | 3, hidden?,
  provides?: { "doc.history": "default" },  // 这个场景演示哪些底座命令（命令 → 状态 id；按模式分开写 { edit, review, viewer }），见 §3b「底座命令」
  editor?: EditorConfig,                 // 场景级默认
  states: [{ id, title, note?, editor?: EditorConfig }],
})
```

状态级 `editor` 覆盖场景级（`mergeConfig`：顶层字段替换；`toolbar`、`rail`、`inspector`、`stage`、`regions`、`data` 逐字段合并）。全部字段都可省，省略即编辑器默认样子（第 2 页、无选中、选择工具、单页、备注展开、检查器「设计」页签）。

| 字段 | 作用 | 备注 |
|---|---|---|
| `mode` | `"edit"`（缺省）/ `"review"` / `"viewer"` | 评审 / 只读浏览：工具条换成评审条 / 浏览条，左栏不提供新建，检查器只读并注明「只读 · 评审模式下不可编辑」/「只读 · 你只有查看权限」，主菜单里改文档的命令不可用（02 §6.2）。各项仍可单独覆盖。**评审态一律用它，不要自己隐藏工具条或拼评审条** |
| `view` | `"single"` / `"grid"` | URL 的 `view` 仍是唯一状态源：Hub 链接带 `view=grid`；手写链接没带时挂载后补上，之后可自由切换 |
| `deck` | 文档幻灯片 | 缺省示例文档 6 页；用 `deckWith()` 改页、加页（§6） |
| `slide` | 当前页页码 | 缺省 2 |
| `selection` | 选中对象种类 | 决定检查器分区（§4）。示例第 2 页 + `"shape"` 画要点卡选中框；第 1 页 + `"text"` 画标题文字编辑态 |
| `toolbar` | `{ tool?, shapesOpen?, shapesView?, shapesActive?, hidden?, collapse?, disabled?, tip?, comments?, canEdit?, hint?, menu?, moreItems? }` | `moreItems` 换掉工具条「更多」的条目（缺省底座 `moreMenu`）：在 layers 里静态打开同一份「更多」的状态（插件很多时的收纳 TB-31，plugins.more-few / more-many / alt-more-one-sub）把同一份条目也给底座，关掉后再从工具条打开（点按或 ↵）内容与载入时一致，登记过的面板照常接上。锚在工具按钮上的弹层打开时，把对应工具设为当前（强调色底）。底座工具条的「图片 ▾」「表格」网格、「图表」类型菜单与「更多」在任何状态里点了都会打开（条目与 insert / table / chart 定稿同一份，见下「工具条面板登记」）；`menu: "image" \| "table" \| "chart"` 让底座的这个弹层一出现就打开（场景自己在 layers 里画弹层时不要再写）。网格视图打开时工具强制回到选择。`shapesView: "library"` 形状弹层直接显示完整形状库（`shapesActive` 当前插入工具；点常用 4 × 3 或形状库里的格子，底座收起弹层并记下插入工具）；`disabled: { text: "需要编辑权限" }` 工具留在原位不可用（整组用 `lockTools(原因, { except, select })`）；`tip: { tool: "chart", lines }` 演示原因：该工具的提示一出现就展开，用户第一次点按或按键后收起；评审条 `comments` 计数（缺省文档评论总数）、`canEdit: false` 不显示「返回编辑」、`hint` 只放一句只读提示；`hidden` 临时收起（画布仍留位置，`collapse: true` 才不留）；`hide: ["comment"]` 某个创建工具这一刻根本没有（贡献点 when 为假，如 M2 未装评论包）：不渲染、不留位、单键无效（与 `disabled` 的「在、但暂不可用」不同）。工具单键 V / T / S / C（ED-16）底座已接好 |
| `rail` | `{ status?, selected?, hidden?, list?, newSlide?, viewToggle?, menu? }` | `status` 换「✓ 已同步」（用 `RailStatus`；非缺省时网格左上胶囊也显示紧凑形态）；`selected` 多选高亮；`hidden` 隐藏页（03-14 画法）；`list` 换整个缩略图列表（用 `RailList` + `RailThumb`，后者有 `hidden` / `dragging`）；`newSlide: false` 不渲染新建行、`{ reason }` 不可用、`{ label, menu, plusLabel, anchor }` 换文字与普通菜单（母版视图「新建版式 ▾」）；缺省「▾」打开版式画廊（03-14，与检查器「版式」同一个组件），`{ popover: { defaultOpen: true } }` 让它一出现就打开，`popover.content` 换弹层内容；`viewToggle: false / { reason }`；`menu` 定制主菜单（`MainMenuOptions`：`canEdit`、`master`、各子菜单、`gridGuides`）；`readonlyDegraded: "需要编辑权限"` 编辑模式已降权（03-12 readonly-degraded，DS-15）：主菜单（编辑 / 插入 / 排列 / 母版视图）与缩略图右键（左栏与网格）里改文档的命令不可用并写原因（不隐藏、仍可聚焦；主菜单逐项写在右侧，缩略图右键整组同因、写在菜单顶部一行，评审 / 只读浏览的缩略图右键同此，原因按模式取「评审模式下不可用」/「只有查看权限」，rulings §4.25 TB-22）；`drawer: true` 作为紧凑形态抽屉渲染（宽度固定、没有分隔条，narrow 场景用） |
| `inspector` | `{ tab?, title?, sections?, hide?, notice?, noticeIn?, readOnly?, disabled?, locked?, share?, commentsTab?, collaborators?, body?, commentsBody?, takeover?, takeoverOpen?, drawer? }` | 见 §4；`commentsBody` 换「评论」页签的内容、`takeover` 整栏换成面板、`takeoverOpen: false` 面板已声明但状态出现时先收着（第 2 批，见 §3a / §3b）；`share` 是「分享」按钮的宿主声明（顶行、网格胶囊、紧凑胶囊同一个按钮，rulings §4.25 TB-161）：不写 = 宿主传了 onShare（M3 起），可用；kit `SHARE_LATER` = M2，留在原位、不可用、工具提示「分享 · 后续版本提供」（DS-137）；`false` = 宿主两样都不传，不渲染；`share: { reason }` 只有「分享」不可用（顶行与网格胶囊同一个按钮，如文档已被删除；整栏不可用用 `locked`）；`tab` 是初始页签，之后场景可用 `useInspectorTab()` 从外面切（§3b）；`drawer: true` 作为紧凑形态抽屉渲染（宽度固定、没有分隔条） |
| `stage` | `{ notes?, notesText?, cursor?, commentPins? }` | `cursor: false` 去掉远端协作者光标（菜单、对话框类状态建议去掉，减少干扰）；`commentPins: true` 底座画布照常画示例文档的评论钉（kit `DeckCommentPins`，坐标只有 `editor/deck.tsx` 的 `DECK_PINS` 一份：第 4 页 3 枚，点钉切到检查器「评论」页签；状态声明了整栏面板（`inspector.takeover`：版本历史、保真报告、个人插件面板的整栏备选）且正开着时，检查器被面板占着、没有页签，点钉先收起面板（kit `closeWithFocusBack`，焦点留在钉上、不经过 body）再切页签，与点「关闭」后再点「评论」同一结果——面板收起时要清的场景状态由场景按面板开关自己清（保真报告的定位高亮即如此，`fidelity/canvas.tsx` 的 `useLocateEndsWithReport`），底座只管开关与页签（第 2 批第 7 轮）；换了内容的页、没有评论包——`inspector.commentsTab: false` 或 `toolbar.hide` 含 comment——时不画，钉在右上方时远端光标让到两组柱子之间，同第 1 批评审态）。rulings §4.25 DS-43「编辑模式照常显示评论钉」：第 2 批场景（版本历史、分享、插件、保真、离线与冲突）在场景级打开，第 1 批编辑态停在第 4 页的画面同样打开（查找替换、插入、幻灯片管理三个场景的场景级，narrow.compact-find 的状态级，§3c）；换了内容但版面与原样页相同、评论仍锚在原处的页写 `DeckSlide.pins` 沿用同一组钉（查找替换「全部替换」后的第 4 页：`deckWith({ 4: { render, pins: DECK_PINS[4] } })`）；评论场景自己画可交互的钉，不打开 |
| `slideOverlay` | 画在当前页幻灯片上 | 父元素就是幻灯片框，百分比定位；**ReactNode 形式只在初始页与初始选中时显示**（用户换页 / 点空白就消失），要自己控制就写函数 `(ctx) => …` |
| `canvasOverlay` | 画布列里绝对定位 | `FloatingPanel`、`Toasts`、画布提示 |
| `banner` | 画布列顶部横幅 | `Banner`；单页与网格视图都显示（网格里两个胶囊整体下移）；它把高度写进 `--v3-banner-h`，顶部浮动面板自动让开 |
| `layers` | 打开的浮层 | `Popover`、`Menu`、`ContextMenu`、`Dialog`（都挂到 v3 根节点并按锚点定位）。放普通元素需自己加 `pointer-events-auto` |
| `regions` | 整块替换 `leftRail` / `stage` / `inspector` / `toolbar` / `grid` | `(ctx, defaults) => ReactNode`，`defaults.xxx()` 是默认渲染，可包一层或拼着用；`defaults.leftRail / inspector / toolbar(覆盖)` 可以传一份配置盖在状态配置上（如母版视图 `d.leftRail({ list, newSlide, viewToggle: false, menu })`、`d.inspector({ body, commentsTab })`）。先用配置，配置不够再用它 |
| `data` | 状态私有数据 | 分区里 `props.data`，其他组件 `useEditor().data` |
| `panels` | `{ rail?, inspector?, notes?, active? }` | 面板尺寸（03-20）：左栏 160–420（缺省 240）、检查器 240–480（缺省 280，PRD ED-12）、备注 64–320（缺省 120）；桌面形态下三条分隔条可拖、按文档记在本机，状态写了的值优先；`active` 让某条分隔条显示拖动中的样子 |
| `masterView` | `false` / `{ open?, frameRegions? }` | 母版视图（2026-10-28 起是编辑器宿主的全局模式，见 §3f）：不写时这个状态有母版入口、载入时在普通视图，能不能进入由宿主判；`open: true` 载入时已在母版视图（`master-view.*`、`narrow.compact-master*`、`offline-conflict.master-*`）；`frameRegions: true` 本状态的 `regions` 是形态外框（narrow 的紧凑抽屉与胶囊），母版视图里照常套在母版区域外面；`false` 没有母版入口（查看器 preset）。场景级与状态级逐字段合并 |

插槽（`slideOverlay` / `canvasOverlay` / `banner` / `layers` / `rail.list`）都可以写成 `(ctx: EditorCtx) => ReactNode`。组件内部用 `useEditor()`（`kit` 导出）读写编辑器：

```ts
const { slide, current, goTo, selection, setSelection, tool, setTool, view, setView, notes, setNotes, deck, theme, data, initial } = useEditor()
```

## 3a. 第 2 批（协作族）底座

评论、版本历史、分享、插件、保真报告、离线与冲突 6 个场景并行时共用的件。场景文件写 `batch: 2`；只在自己的目录里新建文件，下面这些都从 `../../kit` 与 `../types` 拿。

### 评论页签插槽：`inspector.commentsBody`

`InspectorConfig.commentsBody?: Slot` 换掉检查器「评论」页签的内容；外框（协作行、页签行、缩放）仍是底座的，`notice` / `noticeIn` 照常（`noticeIn: "all"` 时说明行在它上方）。不传时是评论场景登记的缺省面板（rulings §4.25 TB-82，2026-10-15 起：`registerCommentsBody`，comments.scenario.tsx 的 `DefaultCommentsBody`——第 2 批评论面板，线程数据缺省取示例文档原样 `deck`），第 1 批编辑态点钉、第 2 批版本历史等场景点钉或手动切到「评论」页签时都是它；一出现就停在「评论」页签的状态都自己写了 `commentsBody`，所以任何初始画面不变。没有登记时退回原来本页评论的静态列表。

- 内容放在一个**占满滚动区高度的纵向 flex 容器**里（滚动区就是检查器的滚动区）：回复框要贴底就给它 `mt-auto`；列表超高时整体滚动，筛选行 / 回复框要常驻就 `sticky top-0` / `sticky bottom-0` 并铺 `bg-(--v3-panel)`。
- 一出现就停在评论页签写 `tab: "comments"`；要随用户操作变化就写函数插槽或在组件里读 `useEditor()` / `useSceneState`。
- 列表用 `Section`（节间分隔线靠 `last:` 规则）：列表外包一层 div，最后一条的下边线才会去掉，不与回复框的上边线叠成 2px。

```tsx
import { Avatar, Button, PanelTitle, Section, TextArea, toneOf } from "../../kit"

function CommentsPanel() {
  return (
    <>
      <PanelTitle>第 4 页 · 2 条评论</PanelTitle>
      <div>{/* 线程列表：每条一个 <Section>，作者头像 <Avatar name tone={toneOf(userId)} size={20} /> */}</div>
      <div className="mt-auto flex flex-col gap-2 border-t border-(--v3-border) px-4 py-3">
        <TextArea aria="回复" placeholder="回复…" rows={2} />
        <Button variant="primary" className="self-end">发送</Button>
      </div>
    </>
  )
}

states: [{ id: "default", title: "…", editor: { slide: 4, inspector: { tab: "comments", commentsBody: <CommentsPanel /> } } }]
```

结构示例：`#/v3/editor?state=_kit.comments-body`（只示结构，评论的视觉与条目由评论场景定稿）。

### 检查器整栏面板：`InspectorTakeover` 与 `inspector.takeover`

整栏面板的先例是图表「编辑数据」（rulings §4.25 DS-26）：检查器栏临时加宽（缺省 400）、整栏换成面板；**协作行（协作者 · 放映 · 分享）原样不动**，「设计 / 评论」页签行换成面板标题行（标题 · 可选说明 · actions · 「收起到检查器」· 「关闭」Esc）。外框是 kit 的 `InspectorTakeover`（`src/v3/kit/InspectorTakeover.tsx`，图表数据面板已改用它、外观逐像素不变），版本历史、插件面板这类整栏面板都用它，不要再自己拼 `<aside>`。

| 属性 | 说明 |
|---|---|
| `title` | 标题（13px 600，要短，不换行） |
| `subtitle?` | 标题下一行说明（12px text-2，单行截断）；有它时标题行高 56，没有时 44（与页签行同高） |
| `actions?` | 标题行右侧、「收起」「关闭」之前的按钮（`IconButton`，28px） |
| `onCollapse?` | 给了才出「收起到检查器」（`Minimize2`） |
| `onClose?` | 「关闭」（× · Esc）；缺省收起状态声明的面板（见下）并交还焦点——先交出焦点、再收起（kit `closeWithFocusBack`），焦点不经过 body。**在 regions 里自己渲染时必须传**，交还焦点同样用 `closeWithFocusBack(收起, 锚点)` |
| `escape?` | Esc 等同「关闭」（缺省 true）：document 捕获阶段，浮层开着时不响应，处理后 `preventDefault`。面板里有自己的 Esc 规则（如先清空搜索）就在内容组件里同样挂捕获阶段监听、处理后 `e.preventDefault()`（内容先于面板注册，先执行）；整套逐层规则自己管的传 false（图表） |
| `autoFocus?` | 用户打开时焦点移进内容区第一个可聚焦项，没有就给「关闭」（缺省 true）；场景状态里一出现就开着的不抢焦点。焦点不在 body 停留：打开它的控件随面板一起换掉时（检查器里的按钮、随之收起的提示条）在布局阶段就交过去；从菜单打开时，条目卸载的那一刻就交过去（不绕回触发按钮，§3b「菜单打开面板时的焦点」） |
| `returnFocus?` | 缺省「关闭」之后焦点交给的锚点（如 `"doc-menu"`：从文档菜单打开的版本历史），缺省交给画布（焦点本来就在别处时不动） |
| `width?` | 栏宽，缺省 400（DS-26） |
| `label?` | 整栏的读屏名，缺省取 `title` 的文字 |
| `footer?` | 底部固定区（帮助、主操作），上方 1px 分隔线、内边距 16 / 12 |
| `bodyClassName?` | 内容区（纵向滚动、占满剩余高度）的补充类名，如 `"flex flex-col gap-3 px-4 py-3"`；缺省不加内边距（`Section` 自带） |

两种用法：

1. **状态直接声明（推荐）**：`InspectorConfig.takeover?: Slot`。状态一出现，检查器整栏就换成它；「关闭」/ Esc 收起后检查器回到常规页签。开关是场景内共享状态 `useTakeoverOpen(): [open, setOpen]`（每次进入状态复位为 `inspector.takeoverOpen`，缺省开；先收着的写 `takeoverOpen: false`，§3b），场景里自己的入口（菜单项、按钮）用 `setOpen(true)` 再打开。场景级声明了、某个状态不要时写 `takeover: null`。

   ```tsx
   import { InspectorTakeover, Section } from "../../kit"

   function HistoryPanel() {
     return (
       <InspectorTakeover title="版本历史" returnFocus="doc-menu" width={320}>
         <Section>…</Section>
       </InspectorTakeover>
     )
   }

   states: [{ id: "default", title: "…", editor: { inspector: { takeover: <HistoryPanel /> } } }]
   ```

2. **随场景状态开关**（如图表数据面板随「展开」打开）：在 `regions.inspector` 里自己判断，开着时返回 `<InspectorTakeover onClose={…} />`，否则 `d.inspector()`（见 `chart/DataPanel.tsx`）。

示例：`#/v3/editor?state=_kit.takeover`（关闭后画布左上角有「重新打开整栏面板」，演示 `useTakeoverOpen`）。协作行单独要用时是 kit 的 `InspectorTopRow`（`collaborators`、`locked`）。整栏面板只管桌面形态；紧凑形态的抽屉里不加宽（图表在紧凑形态改用底部 Sheet，D-17）。

### 身份色 12 色与 `toneOf(userId)`

PRD CO-03「按用户 id 稳定哈希分配 12 色板」（设计 05 §2、04 §2.4）：`Tone` 由 5 色补足到 12 色，`v3.css` 新增 `--v3-tone-olive` / `-iris` / `-lake` / `-rose` / `-denim` / `-plum` / `-moss`（**第 2 批补足，rulings §4.25 DS-42 定稿**；与原 5 色同一口径：低饱和、白字 4.60–4.64:1，对暗 canvas ≥ 3.59、亮 canvas ≥ 4.22、白纸面 ≥ 4.60）。`TONE_BG` / `TONE_BORDER` / `TONE_SOFT`、`Avatar`、`RemoteCursor`、`PresenceTag`、`RemoteSelection`、`RemoteTextSelection`、`CommentPin` 都已支持 12 色。

- `TONES`：12 色的哈希顺序（= 产品 `--presence-1…12`）：slate sand sage clay mist olive iris lake rose denim plum moss（相邻两色 OKLab ΔE ≥ 8，撞色顺延不会落到相近的色上）。
- `toneOf(userId): Tone`：`TONES[fnv1a32(userId) % 12]`，FNV-1a 32 位与 `packages/shared` 的 `fnv1a` 同一算法；同一个 id 永远同一色。
- `assignTones(userIds): Tone[]`：同屏一组人按在场顺序取色，撞色顺延到下一个未占用的索引（同一 id 多会话取同一色，满 12 人后复用）。头像组、在线列表、评论作者列表这类「同屏多人」用它。
- 示例里的固定人物（`ME` slate、`WANG` sand、`LI` sage、`ZHANG` clay，`data.ts`）保持写死的色，第 1 批画面不变；第 2 批新加的人物用 `toneOf` / `assignTones`，或照 `main-states/presence.tsx` 写死。

```tsx
import { assignTones, toneOf, type Person } from "../../kit"

const CHEN: Person = { name: "陈静", tone: toneOf("u-chen") }
const [a, b, c] = assignTones(["u-chen", "u-liu", "u-sun"])   // u-sun 与 u-liu 哈希撞色（clay），顺延为 mist
```

核对表：`#/v3/editor?state=_kit.tones`（检查器列出 12 色的取值与对比度，画布底一排头像、幻灯片上 12 个远端光标与名签）。

## 3b. 第 2 批集成并入底座的件（写新场景前先看这里）

6 组场景各自做过的局部版本已收进底座，场景改用底座的件、外观不变（与改前逐像素对拍）。新场景直接用它们，不要再在场景目录里复制一份。

### 底座命令：`useEditorCommand(id, handler)`（`kit/commands.ts`）

底座外框里的固定入口是静态配置、拿不到场景状态；选了 / 点了之后发一个命令，场景在任意常驻组件（画布叠加层、浮层宿主）里登记处理函数接住（挂载期间有效，换场景状态即清空）。取代原来在 `document` 上听点按、发自定义 DOM 事件的做法。

没有登记处理函数时：有场景用 `provides` 声明演示这个命令（`defineScenario({ provides: { "doc.history": "default" } })`，命令 → 状态 id），编辑器就转到那个场景状态（沿用主题与强调色、单页视图；由用户操作触发，kit `carryInteraction` 让新状态里随之打开的面板照常接住焦点），不静默无响应（ED-30）——如在评论、保真样张里选文档菜单「版本历史」，转到 `version-history.default`。兜底由 `Editor.tsx` 经 `setCommandFallback(store, fn)` 登记（场景不用管）；当前就是声明它的场景时不跳转。

- **按模式分开写**：同一个命令在评审 / 只读浏览里打开的东西不一样时写 `{ edit, review, viewer }`（缺的模式取 `edit` 的），兜底按当前状态的 `mode` 取——如分享 `{ edit: "default", review: "no-permission", viewer: "no-permission" }`：查看者点「分享」转到非所有者的「谁能访问」，不转到所有者视角。
- **带上入口、焦点不掉到 body**：转场时带上触发它的固定入口（kit `COMMAND_ENTRY`：文档菜单 `doc-menu`、主菜单 `main-menu`、`share`），新状态里用 kit `arrivedVia()` 取——打开着的面板没有别的来源可交回时，关闭后焦点交回这个入口（保真报告即如此；版本历史、分享、插件面板本来就交回各自的入口）。菜单收起、整个编辑器换成新状态的这几帧里，焦点由 `holdFocusDuring()` 交给画布，新状态里的面板 / 对话框挂上后接走。
- 现在声明了的：`doc.history` → `version-history.default`；`share` → `share.default`（评审、只读浏览 `share.no-permission`）；`plugins` → `plugins.default`（评审、只读浏览 `plugins.readonly`，03-09 §4.5）；`file.fidelity` → `fidelity.report`（评审、只读浏览 `fidelity.viewer-role`）。`file.export`（主菜单「文件 › 导出…」）还没有演示它的样张（通用导出对话框的样张随第 3 批补，rulings §4.25 DS-62），照旧只关菜单；没有场景声明的命令都照旧：菜单只关闭、按钮没有动作。

| 命令 | 入口 | 谁接 |
|---|---|---|
| `doc.history`（另有 `doc.rename` / `doc.copy`） | 文档菜单（文件名 ▾；网格视图在左上胶囊） | 版本历史：打开整栏面板（网格视图先回单页，同「文件 › 保真报告」；面板关闭后焦点交给单页里的文件名）；别的场景没有登记时转到版本历史场景（`provides`） |
| `file.fidelity` / `file.export` | 主菜单「文件 › 保真报告 / 导出…」 | 保真报告：打开整栏面板（网格视图先回单页）；别的场景没有登记时 `file.fidelity` 转到保真报告场景（`provides`），`file.export` 还没有演示它的样张（随第 3 批补，DS-62） |
| `plugins` | 主菜单「插件…」 | 插件：打开个人插件面板；别的场景没有登记时转到插件场景（`provides`） |
| `share` | 检查器顶行、网格右上胶囊的「分享」（不可用时不发） | 分享：打开分享对话框；别的场景没有登记时转到分享场景（`provides`）。分享场景另把所有者端待处理的访问申请数写进场景仓 `v3.share.pending`（与对话框「访问申请 N」同一份数据，批准 / 拒绝后随之减少，别的场景不写、缺省 0），「分享」按钮（底座 `ShareButton`，检查器顶行与网格胶囊同一个）读它：值 > 0 且按钮可用时右上角带 8px 强调色小圆点（不用红色，Q3），读屏名与工具提示「分享（N 个待处理的访问申请）」（DS-48，`share.request-pending`）。读写都用 kit `useSharePending()`（键 `SHARE_PENDING_KEY`，做法同 `useInspectorTab`），不要直接写键名 |
| `comment.prev` / `comment.next` | 评审条 / 浏览条的「上一处 / 下一处评论」（`CommentNav` 没传 `onPrev` / `onNext` 时） | 评论：按页码与落点定位 |

```tsx
function VhController() {
  const [, setOpen] = useTakeoverOpen()
  useEditorCommand("doc.history", () => setOpen(true))
  return null
}
```

主菜单的 `onPlugins` / `onExport` / `onFidelity`（`MainMenuOptions`，静态打开的 `MainMenuLayer` 同样）显式传了时以传入的为准；静态打开的文档菜单（场景自己画的 `Menu anchor="doc-menu"`）条目自带 `onSelect`。

### 菜单打开面板时的焦点

焦点永远不掉到 body（07 §2）。从菜单打开整栏面板时，Radix 选中条目时同步渲染（flushSync）：面板在菜单还开着时就挂上，菜单随后收起、条目卸载，焦点会先掉到 body，再被菜单在下一个任务里还给触发按钮（读屏先念一遍文件名 / 主菜单，再念面板里的落点）。kit `holdFocusDuring(ms, to)` 接住这一刻：之后 ms 毫秒内焦点一旦要掉到 body，就在同一个任务末尾（微任务，早于下一帧）交给 `to()` 给的落点（已经挂上时），没有落点时交给画布；菜单交还焦点时见到焦点已被接走就不再抢（`keepMovedFocus`）。

- 单页：`InspectorTakeover` 的 `autoFocus` 已经这样做（落点是内容区第一个可聚焦项）；打开它的控件随面板一起换掉的（检查器里的「保真详情」、随报告收起的提示条与轻提示按钮），面板在布局阶段就把焦点接过去。自己管落点的面板（版本历史 `autoFocus={false}`）在处理命令时调 `holdFocusDuring(1500, () => 落点)`。
- 还要先切视图的（网格里选文档菜单「版本历史」、主菜单「文件 › 保真报告」先回单页再开面板）：菜单先收起、视图走 URL 晚几帧才提交，调 `holdFocusDuring()`（不给落点），这几帧里焦点交给画布列（两种视图共用的 `main`），面板挂上后再接走。命令兜底转到别的样张时同此。
- 收起面板：先交出焦点、再卸载——kit `closeWithFocusBack(收起, 锚点, 面板根元素)`：交回处已在页面上（文件名、主菜单按钮、横幅按钮、画布上的占位）就先聚焦它再收起；它要随收起才重新挂上（检查器常规页签里的按钮、重新出现的提示条按钮）就同步提交收起（flushSync）、在同一个任务里交过去；没有交回处时焦点在面板里就先交给画布。`InspectorTakeover` 缺省的「关闭」/ Esc、保真报告、插件整页面板、版本历史左栏备选都用它（图表数据面板是第 1 批，未改）。

底座主菜单、文档菜单（`ui.tsx` 的 `V3Menu`）关闭时，焦点已被新打开的面板 / 对话框接走就不再抢回触发按钮（`keepMovedFocus`，kit `Menu` / `ContextMenu` 的锚定形态原本就如此）。所以整栏面板用 `InspectorTakeover` 缺省的 `autoFocus` 即可，不必再「等菜单交还焦点之后延迟 60ms 再打开 / 再聚焦」。自己画的非模态面板要接焦点：挂载那一刻不要直接聚焦（从菜单顶层条目打开时菜单还开着、它的焦点圈定会把焦点拽回去），用上面的 `holdFocusDuring(…, 落点)` 接住条目卸载的那一刻，再在挂载后排到下一个任务兜一次（`setTimeout(…, 0)`，同 `InspectorTakeover`）。

### 检查器：页签受控与整栏面板初值

- `useInspectorTab(): [tab, setTab]`：检查器「设计 / 评论」页签是场景状态（初值 `inspector.tab`），场景可以从外面切——如点评论钉定位线程时切到「评论」（01 §2.3 唯一允许自动切页签的场景；DS-44 未采纳的备选 `comments.alt-tool-tab` 另演示「评论工具按下时切到「评论」、工具回到「选择」时恢复按下之前的页签」，由状态数据 `toolSwitchesTab` 打开，切页签不移焦点，焦点正在要被换掉的页签内容里时先交给要显示的页签按钮）。检查器卸载再挂载（网格 ↔ 单页、紧凑抽屉开合）后仍停在原页签；状态没有「评论」页签（`commentsTab: false`）时切过去也只显示「设计」。
- `inspector.takeoverOpen`：状态声明了整栏面板（`takeover`）但出现时先收着（缺省 true）。编辑器挂载时写进场景仓，左栏、画布、检查器第一次读到的就是它；场景里的入口用 `useTakeoverOpen()` 打开。保真报告（缺省收着、轻提示 / 主菜单 / 右键打开）与版本历史的入口状态都用它，不要再在 `regions.inspector` 里自己开关、或挂载后用 effect 收起。

### 横幅：叠放、离线横幅、成功浅底、窄屏竖排

- `BannerStack`：两条横幅叠放（模式横幅常驻在上、其余横幅在下：母版视图 TB-14、版本预览），由这一层把总高度写进 `--v3-banner-h`。
- `OfflineBanner`（`OFFLINE_TEXT`）：离线横幅只有一份（第 1 批 main-states.offline 拍板的文案与画法），`actions` / `children` 换按钮与正文。DS-41 未采纳的选项「离线横幅也改中性底」的画面（`offline-conflict.alt-offline-neutral`）由场景用 `Banner tone="info"` + `icon`（同一个 `CloudOff`、警告色）拼出，kit 的 `OfflineBanner` 不变（DS-41：离线、降权、隔离、登录已过期仍用浅底）。
- `PluginBanner`（kit，rulings §4.25 DS-41）：不阻断的插件横幅（缺少插件、插件启动失败）——中性底 + 状态色图标（缺少插件警告色拼图、启动失败危险色 `CircleAlert`），读屏 role=status；第 1 批 main-states 的 4 个插件横幅与第 2 批 plugins 场景用同一个件，文案与按钮由调用处给。启动失败的标题与说明行用 kit `failedPluginsCopy(names)`（DS-55：一个插件写「插件「X」未能启动」、说明行「暂时不可用，其余功能照常」；多个写「N 个插件启动失败」、说明行列名字）。
- 横幅高度：rulings §4.25 DS-75（2026-10-16）统一为 40（含 1px 底边）——带按钮的上下内边距由 6 改为 5，按钮 28 垂直居中，只有文字或只带 × 的照旧；多行照常撑高（§3e）。原「未统一、推迟到第 3 批」一条作废。
- 浅底横幅（离线、降权等）上可用的次按钮：细边（`--v3-btn-line`，与分隔线同档）压在浅底上几乎看不出（暗色离线「立即重连」约 1.02:1、亮色降权约 1.01:1），按钮只靠文字、位置与悬停底识别，是 DS-41 保留浅底的代价之一：DS-41 定为维持现画法（加强次按钮的边线或底色未采纳），kit 不改，场景里不要各自加边。
- 降权横幅的正文（03-12 G-51 新写法，rulings §4.25 DS-58）只有一份：`scenarios/offline-conflict/banners.tsx` 的 `REJECTED_TEXT`，第 2 批各处（离线与冲突、版本历史 degraded-menu）与第 1 批 main-states.degraded / degraded-menu / degraded-thumb-menu 都从那里取。
- `Banner tone="success"`：成功浅底（只给要与中性提示区分的确认；主推仍是中性底 + 成功色图标）。`Banner stack`：一行放不下时按钮换到文案下方独占一行、触控高 44。仅查看形态（手机与平板）：横幅在最顶上，按钮只在一行放不下时才换到文案下方；触控形态按钮照常 44、横幅随之撑高（高 40 只指非触控形态，rulings §4.25 TB-172）。
- `Banner role`：缺省按色调（错误 alert，其余 status）；`"none"` 不作为 live 区（不写 role）——横幅已经播报过、之后随用户自己的操作改了内容时用（如「登录已过期」点了「重新登录」，进行中的一句由场景常驻的 polite 区播报一次，横幅不再以 alert 整条重读；同一件事只走一条读屏通道）。
- 面板 / 对话框里的状态说明（离线、只读）用 `InspectorNotice`，不要把 `Banner` 放进面板或对话框（横幅只在横幅通道）。

### 对话框与菜单

- **画法（rulings §4.25 DS-142，2026-10-23 按 Figma 统一）**：kit `Dialog` 标题栏 40（标题 13px 600、左内边距 16；× 24、右内边距 8——按 Figma Import 对话框截图量取，× 字形右缘与标题字左缘到外框都约 16）、圆角 12（confirm 变体同此）、× 用正文色 `--v3-text`（悬停底同图标按钮 panel-2）；按钮仍是 28 单档（DS-76）、主操作仍是品牌蓝（DS-2）。kit `Drawer` 的标题行与它是同一画法，随之改为 40、右内边距 8、× 正文色（抽屉贴边，不加圆角）；kit `BottomSheet`（手机的模态底部面板）的标题行是触控画法（48 高、44 的关闭），不改。宽度档 `size`：sm 360 / md 480（缺省）/ lg 640，另有导入对话框专用的 `import` 560（TB-179）。对话框内容带 `data-v3-dialog="default|confirm"`（只为核对与检查脚本，不改外观）。第 1–3 批开着对话框的状态画面随之变，清单见 §3e「第 3 批拍板后的现状」的「评审修改」一段。
- **关闭时焦点已有去处就不再移动**（2026-10-23）：Radix 在内容卸载后的下一个任务补发 onCloseAutoFocus，kit `Dialog`、`Drawer`、`BottomSheet` 这时先看 kit `focusSettledElsewhere()`——焦点已落在页面里可用的元素上（不是 body、连在文档里、不在 inert 区域里、不在这一层里，也不是画布 / 主区这类兜底落点——`rescueFocus`、`holdFocusDuring` 换状态时临时停放焦点的地方，停在那里时照旧交给触发处或 `returnFocus` 锚点）就不动。对话框随整页一起卸载（操作后转到别的页面）时，新页面在布局阶段落好的焦点不再被这次补发的交还抢到画布或已卸载的旧入口（导入对话框评审时发现）。
- `Dialog initialFocus`：用户打开时的初始焦点——`auto`（缺省）正文第一个控件 · `dialog` 对话框本身（如插件面板「不自动聚焦第一个开关」）· `secondary` / `primary` 底栏的次 / 主按钮（危险确认先落在「取消 / 留下」，50/10 规则 3）。场景状态里一出现就打开的仍落在对话框本身。
- `Dialog anchor`：竖直位置——`center`（缺省）视口居中 · `top` 顶部锚定（距顶 max(64px, 12vh)、只向下伸展，最大高随之扣掉）。内容会增减的对话框用 `top`（分享：加载完成、邀请成功、出错、访问申请、人多时的搜索框、收紧确认多一行），标题与输入框不随内容高度上下移动；其余对话框照旧居中。
- `Dialog` 的模态内容带 `aria-modal="true"`（Radix 已把框外内容设为 aria-hidden，规格要求再写明，不改外观）；非模态的面板（如手机评论底部面板）不加。
- `Dialog returnFocus`：关闭后焦点先回打开前的焦点元素；它已随菜单卸载（如右键菜单里的「查看详情」打开的对话框）时回到这个锚点。值可以随状态变（插件面板从缺插件占位的右键菜单打开时是那个占位，缺省主菜单按钮）。
- `Menu` 单选项 `closeOnSelect: true`：选值的下拉（角色、链接权限、有效期）选了即收起；缺省不收（为账户菜单换主题而设）。
- 对话框里一出现就展开的下拉（`Menu trigger` + `open` / `defaultOpen`）：kit `Menu` 自己等对话框挂好之后再展开，排在对话框之上、焦点进菜单；不要再写「延迟 60ms 再打开」。
- 文档菜单（文件名 ▾，底座 `DocMenu`）单独用 `sideOffset` 0：顶边贴住文件名下沿，把下面的同步状态行整行盖住（离开 4 会切在那一行字的半中间）；其余菜单仍离触发处 4。场景里静态打开文档菜单（`Menu anchor="doc-menu"`，如版本历史的 `DocMenuLayer`）同样写 `sideOffset={0}`。
- **关闭时焦点不在 body 停一帧**（第 2 批第 6 轮集成，kit `useFocusBackOnClose(open, back, onReturned?)`）：Radix 在浮层内容卸载后的下一个任务里才交还焦点（`onCloseAutoFocus` 在 FocusScope 卸载时 `setTimeout 0` 才发），这中间焦点在 body 上（逐帧采样 13–30ms）。kit `Dialog`、`ContextMenu`、`Menu`（锚定与普通下拉）、`Popover`，底座 `V3Menu`（文档菜单等）、主菜单都已接上：open 由 true 变 false、或这一层整个卸载时，在同一个任务末尾（两层微任务：排在 `holdFocusDuring` 的交接之后）把焦点交给与 `onCloseAutoFocus` 同一规则的落点；焦点已被别处接走（菜单项打开的对话框 / 面板）就不动，没人操作过时也不动。指针点外面关的（第 2 批第 7 轮之后补）：焦点在 pointerdown 里交回触发处之后，同一次按压的 mousedown 落在 html / body 上（模态下拉开着时 body 是 `pointer-events: none`），默认动作会把焦点又移到 body（绘制前采样 6–34ms）；对话框里的下拉同理，mousedown 落在对话框遮罩上。交回成功且按压未结束时，kit 在这一次按压里拦下「目标没有可聚焦祖先」的 mousedown 的默认动作（`keepFocusThroughPress`，pointerup 即解除），点到别的控件或可聚焦区域照常聚焦。自己画的会卸载的浮层同样用它，不要再靠 `onCloseAutoFocus` 单独交还；不是浮层、但操作会让触发元素卸载的（如版本历史的「返回当前版本」、命名表单的保存 / 取消、「重试」），在改状态之前先把焦点交给等效位置（`focusRowNow`），或 `flushSync` 提交后在同一个任务里交。

### 左栏：缩略图角标与状态行说明

- `RailThumb comments`：数字（缺省 `slide.comments`，工具提示「N 条评论」），或评论场景的实时计数 `{ n 未解决数, resolved 已解决数, tipOpen }`（工具提示「N 条未解决 · 另有 M 条已解决」）；`RailThumb warn`：以占位显示的元素数（03-13 缩略图级，警告浅底 + 警告色图标）；`RailThumb warnLevel`：这一页最严重一条的级别（缺省 `warning`，第 1 批缺插件角标即此；`danger` = 有无法解析的内容，危险浅底 + 危险色 `FileWarning`、读屏名「N 处内容无法解析」，与保真报告条目、页级提示条同一个图标；保真场景按报告数据 `worstLevelOn` 推导后传入，第 2 批第 6 轮集成）。两个角标在右上角并排（警示在左、评论在右，不重叠），读屏名带上两者（「第 4 页，3 条评论」，07 §3）。不要再用 `children` 画角标、也不要再写 `slide={{ ...s, comments: 0 }}` 压掉底座角标。
- `RailStatus hint`：状态行的悬停说明（03-12「hover 说明」）——文字可聚焦，说明向下展开、数组按句分行；`hintOpen` 演示用（状态一出现就展开，用户第一次点按或按键后收起）。

### 工具条

- `toolbar.hide`（见 §3 表）；`ReviewToolbar` / `ViewerToolbar` 的 `nav`（`onPrev` / `onNext` / `emptyReason`，`CommentNavWiring`）与 `ReviewToolbar locked`（打开中整条不可用）——评论场景的实时计数与翻页用它们，不要再复制一份评审条。

### 面板里的小件

| 件 | 用途 |
|---|---|
| `PanelState` | 面板 / 对话框里整块的状态：加载失败、面板不可用、没有差异——图标 20（`tone` danger / neutral / success）· 标题 13px 600 · 说明 12px text-2 · 操作（次按钮「重试」）· 补充说明，居中、上下 48。只有一句话的空列表用 `EmptyNote` |
| `LoadingRow` | 加载中的一行（转圈 14 + 一句话，role=status；列表里左对齐行高 32，`center` 整块居中）。程序转交焦点的落点（如分享「重试」后）写 `focusable`（tabIndex −1）与 `label`（读屏名，role=status 不从内容取名，焦点落下时才念得出「正在加载…」）；`data-*` 等其余属性原样落在这一行上，外观不变 |
| `Section` / `FoldSection` 的 `count`、`titleId`、`owner` | 节标题后的计数（12px text-2）；节标题 id（控件 `aria-labelledby` 指向它）；插件贡献的分区带归属标识（`owner: { plugin, vendor }`，06 §2.12）。`FoldSection headAnchor` 给标题行按钮挂锚点（对话框关闭后焦点交回）。内容自己排版时 `bodyClassName="block"` |
| `Phrases` | 中文长句按词组换行（每段不折行、段间可断），说明与确认文案用 |
| `Switch` | 开关（role=switch，安静样式：关 = 槽色淡底、开 = 强调色底；不可用写原因） |
| `AvatarStack` | 列表里「谁」的一组头像叠放（16 / 20 / 24） |
| `Attribution` | 插件归属标识（12px Blocks 图标 + 工具提示），分区以外的地方（页签、标题行）用 |
| `scrollIntoPanel(el, { align, offset, ifNeeded })` | 只滚面板自己的滚动区（不要用 `scrollIntoView`：它会连带滚动设了 `overflow: hidden` 的页面根节点，整个编辑器被推上去） |
| `useDemoOpen()` | 演示用的「一出现就展开、用户第一次点按或按键后收起」 |

- **列表里的折叠 / 展开行：kit `FoldRow`**（第 2 批的统一画法，第 6 轮集成时并入底座）：设计 04 只规定了检查器的可折叠分区（`FoldSection`：标题行整行可点、右侧 ▾），没有列表折叠行，按集成定的口径统一，第 2 批拍板时一并定下、登记进 04 §2.14——高 32、箭头在前（`ChevronRight` 12、描边 1.5，展开转 90°，`motion-reduce:transition-none` 减少动态效果时不转场）、文字 12px text-2（悬停铺 panel-2、文字转主色）、箭头左缘与列表正文左缘对齐（16）、箭头与文字间距 6、整行一个按钮、`aria-expanded`。悬停底的形状随所在列表的行：缺省是通栏行（行内左右 16，评论列表），`inset` 是左右内缩 8、圆角 6 的行（列表容器自带 8，版本列表）；`disabled` 置灰（text-3、不铺悬停底、`aria-disabled`，如版本历史离线缓存）；`touch` 是仅查看形态的触控尺寸（高 44、13px、箭头 16，没有悬停底）。用它的：评论「已解决 N」（`comments/Thread.tsx` 的 `ResolvedFold`，手机面板 `phone.tsx` 用 `touch`），版本历史的月份行、自动版本组行与「最近删除」（`version-history/HistoryPanel.tsx` 的 `VhFoldRow`，`inset`）。新场景直接用它，不要另起一种。列表末尾「加载更早版本」这类「再取一页」的行不是折叠行（没有 `aria-expanded`），但用同一种安静行画法（第 2 批第 7 轮，`HistoryPanel.tsx` 的 `ListEnd`）：ghost 按钮、高 32、不满宽不描边，前面一个 12px 图标（`History`，描边 1.5）与折叠行的箭头同一列，文字 12px 常规字重、次级文字色，悬停铺 panel-2 并转主色；不要用主文字色 500（与命名版本「主文字色 + 下一行说明」几乎一样），下面的说明行与它隔开 12。

### 状态参数与新增状态（第 2 批第 6 轮）

画面差别一律用状态数据或场景级参数表达，不按状态名判断（README §1 纪律）。本轮新增或改动的参数：

| 参数 | 在哪 | 作用 | 用它的状态 |
|---|---|---|---|
| `stage.commentPins` | 场景级 `editor.stage`（底座） | 画布照常画示例文档的评论钉（§3 `stage` 行）；整栏面板开着时点钉先收起面板再切到「评论」（第 7 轮） | 版本历史、分享、插件、保真、离线与冲突五个场景（第 4 页：`version-history.no-access`、`plugins.sections-few` / `sections-many` / `alt-sections-expanded`、`fidelity.locate-page`）；第 1 批查找替换、插入、幻灯片管理三个场景（场景级）与 `narrow.compact-find`（状态级），DS-43，§3c |
| `data.toolSwitchesTab` | 评论 | 评论工具按下时检查器切到「评论」、回到「选择」时恢复（DS-44 未采纳的备选，§3b「检查器：页签受控」） | `comments.alt-tool-tab` |
| `data.textEdit` | 评论 | 编辑文字时对选中的文字发起评论：画布画文字编辑态（文本框 1px 强调色描边 + 选区），撰写时工具仍是「选择」，发表或取消后回到文字编辑（DS-44 写明的例外） | `comments.compose-text` |
| `data.chipHold` | 保真 | 页级提示条的演示定格在出现后（用户第一次点按或按键后才计时，§9） | `fidelity.page-hint`、`external-confirm`、`parse-hint` |
| `data.share.requests` + `closed` | 分享 | 对话框关着、有待处理的访问申请：「分享」按钮带小圆点（`useSharePending`） | `share.request-pending`（`share.access-requests` 对话框开着，遮罩后的按钮同样带点） |
| `OfflineBanner neutral`（场景件） | 离线与冲突 | 离线横幅用中性底 + 警告色图标（DS-41 未采纳的选项，kit 不变） | `offline-conflict.alt-offline-neutral` |

本轮新增的状态：`comments.alt-tool-tab`（DS-44 未采纳的备选）、`share.request-pending`（DS-48）、`offline-conflict.alt-offline-neutral`（DS-41 未采纳的选项）、`fidelity.parse-hint`（DS-51：整页无法解析时提示条用危险色图标）。

## 3c. 第 2 批拍板后的改动（2026-10-15，rulings §4.25 DS-38…DS-63）

第 2 批 25 题（拍板清单第 n 题 = DS-(37+n)）全部按推荐裁决；DS-63：拍板时画给用户对照的备选状态留在样张里。样张里的说法随之改为已定的 DS 编号：推荐即已定，备选即未采纳。真正推迟的写成推迟（不写「待拍板」）：横幅高度 40 / 41 的统一（DS-62，第 3 批样张出现横幅前拍板；2026-10-16 DS-75 定为 40，见 §3e）、主菜单「文件 › 导出…」的通用导出对话框样张（随第 3 批补）、紧凑形态里整栏面板的落位（DS-38）、平板评论面板的落位（DS-46）、第 13 位起头像的序号角标（DS-42），都随第 3 批。

**未采纳的备选状态（DS-63）**：第 2 批六个场景里 id 以 `alt-` 开头的 27 个状态，标题前缀「未采纳 · 」（原「备选 · 」去掉），note 开头一句「未采纳：DS-xx 定为推荐（<推荐状态 id>）。」，其后保留原说明（「第 n 题的备选」改为「DS-xx 未采纳的备选」）；路由不变，实现以推荐状态为准。

| 场景 | 未采纳的状态 → 定为推荐的状态 |
|---|---|
| comments | `alt-filter-menu` → `default`（DS-43）· `alt-compose-panel`、`alt-tool-tab` → `compose`（DS-44）· `alt-panel-composer` → `default`（DS-45）· `alt-load-failed` → `all`（DS-53：不设面板级加载失败，只画单条线程的「锚点无法解析」）· `alt-tablet-compose` → `tablet`（DS-46） |
| version-history | `alt-rail-list` → `preview`（DS-38、DS-39）· `alt-wide` → `preview`（DS-38）· `alt-confirm-dialog` → `restore-confirm`（DS-40）· `alt-duplicate` → `preview`（DS-57：不做「以此版本创建副本」） |
| share | `alt-remove-x` → `role-menu`（DS-40）· `alt-link-url` → `default`（DS-47） |
| plugins | `alt-missing-resizable` → `missing-selected`（DS-52）· `alt-takeover` → `default`、`alt-takeover-failed` → `failed`、`alt-panel-tab` → `panel`（DS-38）· `alt-more-one-sub` → `more-many`、`alt-sections-expanded` → `sections-many`（DS-49） |
| fidelity | `alt-dialog` → `report`（DS-38）· `alt-banner` → `default`、`alt-indicator` → `file-menu`（DS-51） |
| offline-conflict | `alt-recovered-soft` → `recovered`、`alt-soft-paler` / `alt-offline-neutral` → `offline-no-network`、`alt-soft-paler-danger` → `soft-danger-pending`（DS-41）· `alt-offline-copy` → `offline-no-network`（DS-59）· `alt-access-revoked-banner` → `access-revoked`（DS-50） |

拍板清单里标备选的第 1 批现样状态（main-states.plugin-failed / plugin-missing / degraded / review、narrow.compact-comments 等）不是备选状态，标题不加「未采纳」，按下表改成已定画法。

**第 1 批画面按裁决改的地方**（第 1 批已拍板，只改裁决点名的画面，其余像素不动；改过的状态 note 末尾写「（2026-10-15 按 rulings §4.25 DS-xx 改）」）：

| DS | 改了哪些状态 | 怎么改、用的件 |
|---|---|---|
| DS-41 | main-states.plugin-missing / plugin-missing-undeclared / plugin-missing-version / plugin-failed | 缺少插件、插件启动失败横幅由警告 / 危险浅底改为中性底加状态色图标（警告色拼图 / 危险色 `CircleAlert`），文案与按钮不变：kit `PluginBanner`（§3b「横幅」），第 2 批 plugins 场景的横幅改用同一个件、画面不变。离线、降权横幅仍是浅底；plugin-settings 本来就是中性底 |
| DS-43 | find-replace.default / no-match / replace / replaced / replaced-partial / searching，insert.header-footer / header-footer-missing，slide-management.deleted / hidden / thumb-menu-hidden，narrow.compact-find | 编辑模式照常显示评论钉：查找替换、插入、幻灯片管理场景级 `stage.commentPins: true`，narrow.compact-find 状态级；「全部替换」后的第 4 页换了内容、版面不变，写 `DeckSlide.pins: DECK_PINS[4]` 沿用同一组钉（底座 `deckPinsOf` 先取页自己的 pins）。评审、只读浏览与仅查看形态不变 |
| DS-44 | context-menu.canvas、undo-clipboard.paste-options | 画布空白处右键加一组「添加评论 C」（「更换版式… · 重置页…」之后、插件分组之前）：`slides-selection/menus.tsx` 的 `CANVAS_MENU` 加这一组，`withComment(items, onSelect)` 接上「选了即进入评论工具」（`ctx.setTool("comment")`，与按 C 相同）；粘贴选项展开的那一份（`BlankCanvasMenu`）同样加在「重置页…」之后。第 2 批评论场景的画布菜单改为直接取 `CANVAS_MENU`（条目与次序不变），选了接着在当前页放页级临时钉、打开撰写框 |
| DS-46 | narrow.narrow-comments（仅查看形态的「评论」底部面板，narrow 各状态打开评论时都是它） | 换成第 2 批评论场景的手机评论面板：`comments/phone.tsx` 的 `PhoneCommentsSheet`（标题写未解决数、「已解决 N」折叠行、「回复」、常驻撰写区与「解决评论请在更大窗口中进行」）与 `PhonePins`（CommentLayer 触控形态的评论钉），`narrow/viewer.tsx` 原来的只读列表与 `narrow/data.ts` 的 `THREADS` 删去；点钉定位的播报经 `CommentAnnouncer` |
| DS-48 | main-states.open-failed-access | 「申请访问」接上留言弹层：阻断页换成分享场景的 `NoAccessPage`（`share/RequestAccess.tsx`，同一布局与文案，弹层与 share.request-access 同一个件；发送后按钮不可用、页内写「已发送申请，等待文档所有者批准」）；初始画面不变 |
| DS-52 | main-states.plugin-missing / -undeclared / -version 第 6 页与左栏第 6 页缩略图；第 2 批 offline-conflict.priority-yield 借用的同一页 | 二维码占位由「二维码形状 / 原因 / 内容已保留」三行改为「二维码形状」+「原因，内容已保留」两行：`main-states/slides.tsx` 的 `QrSlide` 改用底座 `DegradedPlaceholder`（与保真占位同一画法），第 2 批 plugins 缺多个插件的文档（`MISSING_DECK` 第 6 页）改为直接用这一页（画面不变） |
| DS-58 | main-states.degraded / degraded-menu / degraded-thumb-menu | 降权横幅正文改为「3 项更改未被保存；文档已重新载入服务端版本，撤销历史已清空」：取 `offline-conflict/banners.tsx` 的 `REJECTED_TEXT`（第 2 批同一条横幅的同一份原文） |
| DS-62 | main-states.review / commenter / viewer，narrow.compact-comments（main-states.review-design 的「评论」页签切过去时同样是它，画面不变） | 评论页签由「第 4 页 · 3 条评论」平铺列表换成第 2 批评论面板：comments 场景导出的 `DECK_COMMENTS`（评论面板 `CommentsPanel`、画布评论钉 `CommentLayer`、左栏实时角标 `CommentRailList`、轻提示、播报与删除确认）+ 评审条 / 浏览条 `ReviewBar` / `ViewerBar`（`regions.toolbar`，「上一处 / 下一处评论」接上定位、计数实时）；角色按状态写 `data.role`（review editor、commenter commenter、viewer viewer）。线程数据是示例文档原样（comments/model.ts 的 dataset `deck`：第 4 页 3 条、都未解决，与底座 `DECK_PINS` 的 3 枚钉、缩略图角标「3」、评审条「3 条评论」一致），所以这几个画面只有评论页签变了；没有已解决的线程，「已解决 N」一行不出现 |

第 2 批随之变的：plugins.panel-failed / failed-reshow 只有一个插件失败，横幅标题按 DS-55 写「插件「现场投票」未能启动」「插件「数据图表增强」未能启动」、说明行只写「暂时不可用，其余功能照常」（kit `failedPluginsCopy`；多个失败仍写「N 个插件启动失败」+ 说明行列名字）；offline-conflict.priority-yield 第 6 页的占位随 DS-52 变两行。DS-60 的第 1 批 narrow.narrow（在线）画面不变。

## 3d. 第 2 批回写中的补改（2026-10-15，rulings §4.25 DS-64…DS-70、TB-77…TB-84）

第 2 批文档回写中用户新裁的 DS-64…DS-70 与总编排裁定的技术口径，样张随之补改（总编排的补改单 `b2/wb/sample-followup.md`）。新增 3 个状态：`fidelity.degraded-menu-review`、`share.link-expired`、`share.no-permission-link`。

| 依据 | 改了哪些状态 / 件 | 怎么改 |
|---|---|---|
| DS-64 | fidelity：新增 degraded-menu-review，viewer-role 与 degraded-menu 的说明；plugins.missing-menu 的说明；底座 `editor/inspector/degraded.tsx`、kit `Menu.tsx` | 评审、只读浏览与降权下「无法显示的对象」与缺插件元素的右键照常出菜单（禁用而不隐藏，§4.22 D-10）：`degradedMenuItems` 加 `readOnly`（`degradedReadOnly(ctx)` 按模式取），走 `readOnlyMenu`——剪切、粘贴、原位复制、排列、组合、编辑替代文本…与删除留在原位不可用，顶部一行说明（03-05 §4），「复制」与详情入口照常，「添加评论」只在评审（有评论权限）时可用。保真占位与缺插件占位的右键、⇧F10 / 菜单键在各模式都打开它（原「只在编辑模式挂、⇧F10 不出菜单、焦点留在占位」作废），关闭后焦点回到占位。`readOnlyMenu` 上移到 kit；`EditorCtx` 加 `readonlyDegraded`（状态的 `rail.readonlyDegraded`） |
| DS-65、TB-79、TB-84 | comments.compose、mention 的说明；`comments/canvas.tsx`（`DraftKeeper`、`DraftComposer`、临时钉）、`comments/store.ts`（`useKeptDrafts`、`Draft.restored`）、kit `Popover`（`autoFocus`） | 写了内容的浮动撰写框遇到换页（或进网格视图）：撰写框与临时钉随旧页收起，草稿按页留在场景状态（写的字随输入写回 `draft.text`），回到单页的那一页时原样恢复（内容与 @ 提及都在）、标 `restored`——不抢焦点（焦点留在换页的地方，点临时钉或在钉上按 Tab 进撰写框），也不改评论工具；收起时焦点若在框里，先交给画布再卸载（不经过 body）；kit `Popover` 关闭时焦点已经有去处（用户点的缩略图）就不再拉回锚点。空撰写框换页即放弃；离开场景或切换状态（相当于关闭文档）即丢弃。不新增静态状态 |
| DS-66 | 新增 share.link-expired；`share/LinkBlock.tsx` | 链接到期等同收紧：所有者再打开时链接权限「仅邀请的用户可访问」、没有有效期下拉，说明行「只有上面列出的人能打开此链接，原链接已于 10 月 15 日到期。打开链接需要先登录。」（`LinkSeed.expired` 取期限的到期日）；再放宽生成新链接，这句随之消失（DS-47） |
| DS-69 | 新增 share.no-permission-link；share.no-permission 的说明；`share/LinkBlock.tsx` `ReadonlyLink`、`ShareDialog.tsx` | 非所有者的只读一行按当前链接权限画：链接授予角色时写「登录用户凭链接可查看」、说明行与所有者相同，「复制链接」复制分享链接；仅邀请时复制文档地址（share.no-permission 画面不变） |
| DS-67、DS-68 | share.request-access-sent、access-requests 的说明；`share/RequestAccess.tsx` 注释 | 「通知由集成方发给所有者」补「依据 DS-67 的 Webhook 事件 access_request.created」；拒绝不告知申请人（DS-68）；访问申请写「后端已登记访问申请端点（60/15 §3.4）」 |
| DS-70 | version-history.empty 的说明 | 首条按来源写：导入「导入自『文件名.pptx』」（样张示例）、新建空白「新建演示文稿」、从模板「从模板『〈模板名〉』新建」、创建副本「创建自『〈原文档名〉』的副本」；画面不变 |
| TB-71 | share.alt-link-url 的说明 | 不显示链接地址的理由改为「为简洁，同 Figma；复制时取当前有效链接的令牌」 |
| TB-77、TB-96 | plugins.failed / alt-takeover-failed 展开的失败详情；`plugins/data.ts` `DIAGNOSTICS`、`plugins/store.ts` `copyDiag` | 演示错误码改为架构 30/10 登记的 `kernel.plugin_failed`，失败详情另写一行「阶段」（启动 / 贡献，`details.phase` activate / contribution）；原 `plugin.activate_failed`、`plugin.contribution_failed` 作废。「复制诊断信息」复制四行：`plugin: <id>@<版本>`、`code: kernel.plugin_failed`、`phase: activate`（或 `contribution`）、`traceId`（TB-96；原三行） |
| TB-78 | plugins.failed、failed-admin、retrying、alt-takeover-failed 的「我的界面插件」组；`plugins/store.ts` | 两组都按启动失败 → 版本不兼容 → 等待依赖排在组内最前（原来只排了「本部署统一启用」）：演示激光笔由第 2 行排到第 1 行；行随状态变化挪动时焦点在同一个任务里交给这一行的开关 |
| TB-82 | 底座 `editor/Inspector.tsx`（`registerCommentsBody`）、comments.scenario.tsx（`DefaultCommentsBody`）、`comments/store.ts`（`DatasetFallback`） | 见 §3a：其余状态切到「评论」页签时也是第 2 批评论面板，不改初始画面；底座画的评论钉与左栏角标仍是第 1 批的静态件（TB-83：其余第 1 批编辑态翻到第 4 页时的评论钉随第 3 批） |
| 03-12 §2.6 | plugins 的 FailedBanner（failed、failed-admin、retrying、banner-queue、failed-reshow、alt-takeover-failed）、main-states.plugin-failed | 启动失败横幅的 × 读屏名「关闭提示」（kit Banner 缺省「关闭横幅」），画面不变 |
| 03-10 §2 | fidelity 各处说明与注释 | 「03-10 §113」（旧稿行号）改为「03-10 §2」 |

核对过、没有改的：context-menu.canvas 与 undo-clipboard.paste-options 的「添加评论 C」一组本来就在「网格与参考线 · 更换版式… · 重置页…」一组之后、插件分组之前（paste-options 那一份没有插件分组），03-05 §1.2 与 §5 第 3 行一致。

## 3e. 第 3 批（应用壳族）：页面级宿主与新共享件（2026-10-16，rulings §4.25 DS-71…DS-78、TB-101…TB-106）

第 3 批的文档列表、模板库、管理页、登录与错误页、嵌入不在编辑器里，底座加了**页面级宿主**；场景照旧是 `defineScenario`，多一个 `host` 字段，配置写在 `page` 里（编辑器宿主的场景照旧写 `editor`）。场景写 `batch: 3`。

### 宿主与路由

| 宿主 `host` | 路由 | 画法 | 状态配置 |
|---|---|---|---|
| `editor`（缺省） | `#/v3/editor?state=场景.状态` | 编辑器（第 1、2 批全部场景） | `editor`（EditorConfig，§3） |
| `home` | `#/v3/home?state=场景.状态` | 应用壳；不带 state 是已拍板首页 | `page.shell` / `page.body`（缺省 body 是已拍板首页内容 `HomeBody`） |
| `documents` · `templates` · `admin/plugins` | `#/v3/documents?…`、`#/v3/templates?…`、`#/v3/admin/plugins?…` | 应用壳（首页那套左栏 220 + 顶栏 56 + 横幅通道，kit `ShellLayout`） | `page.shell` / `page.body` / `page.overlay` |
| `page` | `#/v3/page?state=场景.状态` | 整屏 bare：画布底色、无导航（登录页、回调与错误页） | `page.body`（常放 kit `BlockingPage`） |
| `embed` | `#/v3/embed?state=场景.状态&frame=宽x高` | 中性「宿主页面」外框 + iframe 容器（DS-73） | `page.embed`（容器尺寸与 iframe 里的页面） |

- 参数照旧：`theme=dark|light`、`accent=blue|violet|coral`；状态 id 写法同前（kebab-case，`<场景>.<状态>`，只写场景取第一个状态）。
- **宿主随状态走**：`Scenario.host` 是场景缺省，`ScenarioState.host` 可单独覆盖（如账户菜单在首页与编辑器各有几态）。在别的宿主路由上打开一个状态会自动转到它的宿主（参数原样带上），所以截图脚本照旧写 `#/v3/editor?state=…` 也能拍到；`scenarioHref` 与 `window.__V3_SCENARIOS__[].states[].href` 已按宿主生成（另有 `host` 字段）。
- 不带 state 时：`home` 是已拍板首页；其余宿主打开第一个声明了它的 Hub 场景（还没有就退到 `_kit` 的示例，再没有就是「找不到场景状态」横幅与写法）。state 写错时同编辑器：顶部「找不到场景状态」错误横幅，列出可用的场景 / 状态。
- Hub 的「第 3 批 · 应用壳族」分组常驻，第一张卡是各宿主的链接，场景卡接在后面（场景写 `batch: 3` 即出现）。

### 页面宿主的配置（`scenarios/types.ts` `PageConfig`，状态级逐字段覆盖场景级：`mergePage`）

```tsx
import { BlockingPage, Button, usePage, useSceneState } from "../../kit"
import { defineScenario } from "../types"

export default defineScenario({
  id: "documents", title: "文档列表", specs: ["03-01"], batch: 3, host: "documents",
  page: { shell: { current: "recent", title: "最近" } },
  states: [
    { id: "default", title: "最近", note: "…", page: { body: <DocList /> } },
    { id: "trash", title: "回收站", note: "…", page: { shell: { current: "trash", title: "回收站", actions: null }, body: <Trash /> } },
    { id: "login", title: "登录页", note: "…", host: "page", page: { body: <BlockingPage icon={…} title="…" actions={<Button variant="primary">…</Button>} /> } },
  ],
})
```

- `page.shell`：kit `ShellLayout` 的属性（见下表），应用壳四个宿主用；宿主缺省：home `{ current: "home", title: "首页" }`、documents `{ current: "recent", title: "最近" }`（DS-79：不带筛选落「最近」）、templates `{ current: "home", title: "模板" }`（DS-72：模板库是首页的下一层）、admin/plugins `{ current: null, title: "插件", actions: null }`。
- `page.body`：应用壳是顶栏（与横幅）以下的内容（放在滚动区里，内边距缺省 `px-8 pt-6 pb-8`，`shell.bodyClassName` 可换）；page 宿主是整屏内容（父元素是画布底色的纵向 flex，`BlockingPage` 自己居中）。
- `page.overlay`：主区（`relative`）里绝对定位的东西，如轻提示 `<Toasts bottom={24}>`（应用壳没有底部工具条，离底 24）。
- `page.layers`：浮层（`Dialog`、`Drawer`、`Menu`…，自己挂到 v3 根节点）。
- `page.embed`：`{ size: [宽, 高], src: { host, state?, params? }, label? }`。iframe 加载同一个 playground 的别的宿主路由（带 `embedded=1`，主题与强调色沿用外层），视口就是容器尺寸，编辑器按真实视口取形态；URL 参数 `frame=640x360` 临时改尺寸。外框 panel 底、一行「宿主页面（演示容器，不代表任何真实产品）」+ 尺寸、1px 虚线表示容器边界。iframe 里读 `useV3Params().embedded` 区分。
- `page.data` 与 `usePage()`：`usePage()` 返回 `{ host, scenarioId, stateId, data, theme, accent, scene }`（页面宿主里没有 `useEditor()`）；`useSceneState` 在页面宿主里照常用（每次换状态新建一个仓、复位「有没有人操作过」，同编辑器）。
- 插槽可以写函数 `(ctx) => …`（`ctx` 即 `usePage()` 那一份）。

### 新共享件（都从 `../../kit` 导入）

| 件 | 用在 | 接口 |
|---|---|---|
| `ShellLayout` | 应用壳（宿主自动包；场景一般只写 `page.shell`） | `current`（左栏当前项 id，null 不标）· `nav`（缺省 `SHELL_NAV`：首页 / 最近 / 我的文档 / 与我共享 / 回收站，DS-79）· `onNav`（缺省 `shellNav` 跨宿主跳转：首页回 `#/v3/home`，其余进 `documents.<视图>`）· `navSlot`（整块换掉主导航，如管理页的管理导航：给了就不渲染缺省的主导航）· `title` · `actions`（缺省 `ShellDefaultActions`：「导入 .pptx」在原页上打开「导入」对话框 DS-140 +「新建演示文稿」，null 不放）· `headerStart`（标题左侧，如 DS-87 的「显示导航」开关）· `banner` + `bannerAt`（`main` 顶栏之下、只横跨主区，DS-92；`top` 是未采纳的备选；两条用 `BannerStack`）· `search`（缺省 `ShellSearch` 搜索框下拉 + ⌘K 聚焦，DS-80；false 或自己的节点）· `help`（缺省 `ShellHelpMenu` 帮助菜单，DS-89；false 或自己的节点）· `accountMenuOpen`（用户行的账户菜单一出现就打开）· `accountMenu`（`AccountMenuOptions`：按角色 / 里程碑 / 嵌入增减缺省条目，如 `{ milestone: "M3", admin: true }`）· `accountMenuItems`（整份换条目）· `currentAria` · `rail`（false 不渲染左栏，窄屏抽屉自己用 `ShellRail` 画）· `bodyClassName` · `overlay`。主区是 `data-v3-anchor="canvas"`（tabIndex −1），浮层关闭后的焦点兜底落在这里、不掉到 body |
| `ShellRail` / `ShellNavButton` / `ShellDefaultActions` / `SHELL_NAV` / `shellNav` | 左栏单独用（DS-87 抽屉）、自己拼顶栏 | `ShellRail` 取 `ShellLayout` 的左栏属性（current、nav、onNav、navSlot、search、help、accountMenu…、className）；`ShellDefaultActions { reason?, busy? }`：离线等原因时两个按钮留在原位不可用并写原因，`busy` 时「新建演示文稿」转圈 +「正在创建…」——画布底上的主按钮不可用 / 进行中都是 kit 主按钮的不可用态（DS-123）；「导入 .pptx」带锚点 `import.entry`（kit `IMPORT_ENTRY`）与 aria-haspopup=dialog，点了经 kit `useOpenImportDialog()` 在原页上打开导入对话框（从选文件开始），关闭后焦点回到它（DS-140、TB-179；开始页与文档列表的各状态里都能点开） |
| `ShellSearch` | 应用壳左栏的搜索框（缺省就是它）、手机形态主区里的那一个 | `initial`（一出现就有的检索词，下拉随之开着）· `results`（放在搜索结果页 `documents.search` 上：检索词取地址的 `q`、下拉收着，× / Esc 清空并回到搜索前的页面 `from`）· `touch`（44 高、13px，不写 ⌘K；下拉同桌面、行高 44，TB-130）。下拉是前 5 条 +「查看全部结果」（进 `documents.search`），组合框键盘：↓ / ↑ · ↵ · Esc 先收起再清空（设计 07 §1.2，DS-80） |
| `ShellHelpMenu` / `shellHelpItems` | 左栏「帮助」 | `configured`（集成方配置了帮助链接，缺省 true）· `open`；条目只列配置了的、新标签页打开、带外链图标（Menu 条目 `external`），「键盘快捷键 ⌘/」始终在、发底座命令 `help.shortcuts`（DS-89）· `touch`（触控形态「键盘快捷键」不写 ⌘/，TB-154） |
| `DocumentCard` / `SharedAvatars` / `OwnerAvatar` / `DocCardData` / `cardLabel` / `useDocHref` | 首页最近、文档列表、回收站、搜索结果（DS-81 同一个件） | 第 3 批转正时并入了原 `documents/DocCard` 的能力：`doc` · `view` grid / list · `href`（缺省按我的角色链到编辑器的对应形态，TB-108）· `onOpen` · `menu`（「⋯」，DS-81）· `menuOpen` · `meta` / `metaCols` · `trailing` · `badge` · `coverNode` · `inert`（回收站）· `dim` · `disabled`（原因，如离线）· `label` · `editing`（内联重命名）· `demo` hover / focus · `touch` · `hidePin` · `anchor` / `menuAnchor`；固定图钉、角色徽标、右键 / ⇧F10 菜单、DS-83 的第二行与共享头像口径都在件里。卡片自己渲染 `<li>`，外面用 kit `CardList`（网格 / 列表，键盘 TB-107）。只给 doc 时与已拍板首页逐像素一致 |
| `AccountMenu` / `AccountMenuLayer` / `accountMenuItems` / `AccountMenuOptions` | 开始页用户行、编辑器头像、文档列表（DS-18：三处同一份） | `AccountMenu { trigger, side, align, defaultOpen?, items?, options? }`；`AccountMenuLayer { items?, options? }` 锚在编辑器的 `account`；条目就是 `accountMenuItems(options, run)`（DS-89 / DS-90 / DS-91：头部 ┊ 主题三项 ┊ 偏好设置… ⌘, · 键盘快捷键 ⌘/ ·（管理员）管理 · 帮助中心 ↗ ┊ 退出登录；M2 不显示「个人资料…」）。`options`：`milestone` M2 / M3 · `admin` · `themes` 2 / 3（2 是 DS-90 未采纳的备选）· `profile` auto / hidden / disabled（disabled 是 DS-91 未采纳的原推荐）· `help` · `embedded` · `themeLocked`。「偏好设置…」「键盘快捷键」「退出登录」发底座命令（`account.preferences` / `help.shortcuts` / `account.logout`）。`touch`：触控形态（手机与平板）菜单项不写键位提示——「偏好设置…」不写 ⌘,、「键盘快捷键」不写 ⌘/（TB-154、TB-164，开始页手机抽屉传它）；`embedded`：iframe 嵌入里宿主没在 cordex:init 的 intents 声明 sign-out 时「退出登录」留在原位不可用（TB-145，样张都按没声明画） |
| `BlockingPage` | 登录页、错误页（`#/v3/page`）、编辑器打开失败（`regions.stage`）、嵌入里的阻断页 | 由第 1 批「打开失败」页提升（`main-states/panels` 的 `OpenFailedPage` 现转出它，画面不变）：`icon`（32、strokeWidth 1.5）· `context`（标题上方一行）· `title` · children（说明，最宽 420）· `notice`（主按钮上方一行，如登录失败的内联错误 DS-120）· `actions`（画布底上的主按钮不可用 / 进行中照用 kit 主按钮的不可用态，DS-123）· `hint`（按钮下方弱提示，如 DS-119）· `headingId` · `focusOnArrive`（缺省 true：经站内跳转到达时焦点落在第一个按钮；自己定落点的页面传 false） |
| `Drawer` | 管理员插件详情（DS-94）、设置的未采纳备选（DS-113） | 右侧贴边整高，标题行 40、× 正文色（与 kit Dialog 标题栏同一画法，DS-142）：`title` · `description` · children · `footer` · `width`（缺省 480）· `modal`（缺省 true：遮罩 + 焦点圈定；false：无遮罩、点外面不关）· `open` / `defaultOpen` / `onOpenChange` · `returnFocus` · `initialFocus` auto / dialog · `label` · `bodyClassName`。焦点规则同 `Dialog` |
| `Toasts bottom` | 应用壳的轻提示 | `<Toasts bottom={24}>`：没有底部工具条的页面离底 24（缺省 74 是编辑器工具条上方） |
| `usePage` / `usePageMaybe` / `PageCtx` | 页面宿主里的组件 | 见上 |
| `DropOverlay` | 开始页、文档列表的拖入落区（TB-180） | 放进 `page.overlay`；拖入 .pptx 时盖住主区：画布底上内缩 16 的落区框，强调色 1px 虚线 + 淡底（panel 上叠 `--v3-accent-soft`，与导入对话框的拖入悬停同色，DS-141、TB-180；直接叠在画布底上时亮色说明行对底只有 4.25:1，叠在 panel 上 4.58:1；原中性的 `--v3-border-control` 虚线作废）、圆角 8；松开即打开导入对话框的上传态（kit `useOpenImportDialog()("uploading")`，焦点落在「取消」），拖出窗口或 Esc 收起，导入对话框开着时不出现。drop-import 两态一出现就是拖着的样子，可以真的从桌面拖文件进来 |
| kit `importDialog`：`registerImportDialog` · `ImportDialogLayer` · `useImportDialogState` · `useOpenImportDialog` · `IMPORT_ENTRY` · `IMPORT_DIALOG_KEY` | 「导入」对话框（DS-140、TB-179…TB-181） | 对话框本身在导入场景（`scenarios/import/dialog.tsx` 的 `ImportDialog`：正文、文案与示例数据都是导入场景的），import.scenario.tsx 在模块加载时登记给底座（`registerImportDialog`，同 `registerDocShareLayer` 的做法，底座不依赖场景代码）；页面宿主在应用壳四个宿主（home、documents、templates、admin/plugins）里挂 `ImportDialogLayer`，关着时不出 DOM。开关与阶段在场景仓 `import.dialog`（`useImportDialogState()` 读写 `{ open, phase }`，phase 为 pick / dragover / uploading / parsing / failed；登记的对话框在同一份里加自己的字段），初值按状态数据：写了 `page.data.importDialog` 即一出现就开着（导入场景的 `ImportDialogSeed`：`phase`、`failure`、`cause`、`percent`、`stage`、`detailsOpen`、`dash`、`form: "sheet"`、`entryOnly`）。底座的两个入口：`ShellDefaultActions` 的「导入 .pptx」（`useOpenImportDialog()("pick")`）与 `DropOverlay` 松开（`"uploading"`）。外框 560 × 406（kit Dialog `size="import"`，固定高由对话框给；标题栏 40） |
| `BottomSheet` | 手机（< 640）的模态底部面板：偏好设置（settings.phone，TB-118）与导入（import.dialog-phone，TB-181） | 2026-10-23 由 `scenarios/settings/sheet.tsx` 的 `SettingsSheet` 并入（画法逐像素相同）：`title` · `description` · `closeLabel` · `open` / `onOpenChange` · `returnFocus` · `dismissOnOutside`（缺省 true；false 点遮罩不关，导入的上传与解析中，TB-180）· children。贴底、上圆角 12、把手 40 × 4、标题行 48 + 44 的关闭（触控画法，DS-142 不改）、最宽 560、上沿离视口顶至少 24；遮罩、焦点圈定、aria-modal；打开时焦点落在面板本身，关闭后回到打开前的焦点元素或 `returnFocus` 锚点 |
| `FileTypeIcon` / `FILE_TYPE_ICON_SIZE` / `hasFileTypeIcon` | 导出对话框的格式行、导入对话框上传与解析阶段的文件名前、「导出本地副本」对话框的 .pptx 一行（DS-143、TB-182） | `<FileTypeIcon type="pptx" />`：Tabler Icons（npm `@tabler/icons` 3.49.0，MIT）的 file-type-ppt / png / svg / pdf 原件，`type` 写格式 id；没有专属图标的类型（插件贡献的格式）画通用 file 字形（TB-182）。缺省 20px、描边 1.5（原件 2）、currentColor（颜色由所在行给：RadioRow 图标插槽可用 text-2、不可用 text-3，选中不变色）、aria-hidden；出处、版本、许可证与原文件名写在文件头。图上字样是「PPT」，名称照旧写「PowerPoint（.pptx）」（DS-143）。设计 04 §2.14「单一图标家族」只为文件类型图标开这一个例外；「导出本地副本」的 .json 一行用 lucide `FileBraces` |
| `HomeBody`（`src/v3/HomeBody.tsx`）· `RecentSection` · `TemplateRow` | 首页宿主的缺省主区（已拍板首页，第 3 批转正时换成原 home/HomeMain 的画法，DS-79 / DS-83） | 读 `page.data`（`HomeData`：`milestone`、`recent`、`offline`、`creating`、`form`…）；叠在开始页上的状态写 `body: <HomeBody />` |
| 文档库公共件（`kit/library.tsx`）：`ViewSwitch` · `ListHead` · `CardList` · `Quoted` · `EmptyBlock` · `docCardMenu` · `cardAnchor` · `openDoc` · `useLibraryOps` · `LibraryToasts` · `LibraryLayers` · `registerDocShareLayer` | 首页最近与文档列表（由文档组并入） | `docCardMenu(doc, 视图, handlers, { offline?, trashM2?, pinned?, shareLater? })` 按视图与角色给「⋯」条目（DS-81、DS-82；`shareLater`：M2 的「分享…」留在原位、不可用，标 M3、右侧「后续版本提供」，DS-137——开始页 `HomeBody` 按 `milestone`、文档列表按 LibData `milestone` 给，两处缺省都是 M2）；`useLibraryOps(seed)` 给移到回收站 / 恢复 / 重命名 / 固定等操作与轻提示；`LibraryToasts` 放 `page.overlay`、`LibraryLayers` 放 `page.layers`（永久删除确认、分享；分享对话框由文档场景经 `registerDocShareLayer` 登记） |
| `roving` / `useRovingGrid` / `rovingItemIn` / `ROVING_ATTR` | 卡片网格与列表的键盘（TB-107） | 列表外层 `useRovingGrid(ref)`，每张卡片里的可聚焦元素带 `{...roving}`：只有一项在 Tab 顺序里，方向键 / Home / End 移动 |
| `formatChord` / `joinAlternatives` | 快捷键面板、命令面板里的键位写法（TB-106） | `formatChord("Mod+Shift+E", "mac")` 写 ⇧⌘E，`"win"` 写 Ctrl+Shift+E |
| `useGoTo` / `goToState` / `stateHref` / `stateExists` / `firstState` | 跳到别的样张状态（沿用主题与强调色） | `goToState(host, state, extra?, { carry?, entry?, replace? })`；`useGoTo()(state, { host, replace })`；`stateHref` 只算地址 |
| `Dialog` 的 `busy` / `dismissOnOutside` / `closeLabel` · Menu 条目 `external` · `RailThumb` 的 `pending` | 模板库「正在创建…」、导出生成中与导入上传、解析中点遮罩不关（DS-101、TB-180）、帮助菜单外链（DS-89）、导入的缩略图占位 | `busy`：主按钮转圈、不可用；`dismissOnOutside={false}`：点遮罩不关；`closeLabel`：× 的读屏名与提示（如「取消导出」）；`external`：右侧 12px 外链图标；`pending`：缩略图还没生成，原位一块 panel-2 中性块 |
| `PageJumpHint` / `PageJumpInput` | 放映跳页与编辑器的页导航提示条（TB-104，同一个件） | `PageJumpHint { digits, total, exists, esc? }` · `PageJumpInput { total, pages, onCommit, onClose }` |
| `PagePlaceholder` / `PAGE_PLACEHOLDER` | 整页渲染失败、无法解析的页（DS-52） | `{ icon, title, reason, page }` |
| `StageScope` | 放映舞台与压在舞台上的界面件（03-11） | 舞台里另开一个 `data-v3-theme="dark"` 的作用域（强调色跟随界面）；舞台 token `--v3-stage` / `--v3-stage-black` / `--v3-stage-white` 在 `v3.css`（两套主题同值） |
| `FollowBar` / `FollowFrame` / `EditorFollow` / `FOLLOW_KEY` | 编辑器与放映的跟随（DS-106；两处统一「停止跟随」，TB-113） | 他人的头像缺省是「跟随 〈姓名〉」按钮（`Collaborators`），正在跟随的人写在场景状态 `FOLLOW_KEY`；编辑器常驻 `EditorFollow`（跟随条 + 画布身份色外框）；放映里 `FollowBar { person, mode: following / free / lost, onStop?, onResync?, touch? }` |
| `CommandPalette` / `searchPalette` / `PaletteItem` | 命令面板（DS-117：不加遮罩、层级 `--layer-command-palette` 盖过对话框；TB-106、TB-117） | 受控件：`ui` / `set`（`{ open, query, active, announce }`）· `commands` · `common`（「常用」的固定清单）· `reasonFor` · `onRun` · `platform`；命令面板样张是它的薄宿主；条目 `external`：外链（新标签页打开，标题后 12px 外链图标，如「帮助中心」），只在集成方配置了链接时列出（TB-132，命令面板样张 `paletteCommands({ helpConfigured })`、状态数据 `cHelpConfigured: false` 时没有这一条） |
| 底座命令（`kit/commands.ts`，第 3 批补） | `account.preferences` · `account.logout` · `help.shortcuts` · `help.command-palette` · `present` · `present.fromStart`，⇧⌘E 发 `file.export` | 菜单、按钮与 ⌘, ⌘/ ⌘K ⇧F5 F5 ⇧⌘E 都发命令（`useBaseKeys` 挂在 window 冒泡阶段：场景挂在 document 上、已 preventDefault 的同键先于底座）；场景用 `useEditorCommand` 接住，没人接时按 `defineScenario` 的 `provides` 转到演示它的样张（设置、快捷键、命令面板、放映，shell-pages 的 `account.logout` 转登录页） |
| `CollaboratorsConfig`（`inspector.collaborators`，网格胶囊同一份）· `PresencePerson` · `Avatar` 的 `seq` / `seqAt` · `AvatarBadge` | 检查器协作行的头像组与「+N」在线列表 | `people`（人可带 `seq` 同色序号 DS-132、`badge` / `label`、`follow`）· `extra`（「+N」）· `following`（跟随的初值）· `list`（「+N」弹层的内容，按状态给，如 presence-scale 的 20 人列表）· `listOpen`；`seq` 挂 kit `AvatarBadge`（头像组挂在可见段的底部中线、在线列表在右下；24 配 14、20 配 12，TB-124） |
| `exportReasonOf` | 主菜单「文件 › 导出…」的置灰（DS-105） | 按模式、编辑权限与降权给原因：查看者「只有查看权限」、评审者与编辑中被降权「需要编辑权限」；底座主菜单与 ⇧⌘E 都读它 |
| `SHARE_LATER` / `ShareConfig` / `shareReasonOf` / `ShareButton` | 检查器顶行、网格右上胶囊、紧凑形态右上胶囊的「分享」（同一个按钮，DS-137、TB-161） | 宿主声明写在 `inspector.share`（§3）：不写可用（M3，宿主传 onShare）· `SHARE_LATER` M2 原位不可用、工具提示「分享 · 后续版本提供」、不带待处理圆点、点了不发命令 · `false` 不渲染 · `{ reason }` 其他原因；Editor 把算好的样子放进 `EditorCtx.shareReason`（undefined 可用、字符串原因、null 不渲染），自拼胶囊时读它。判为 M2 的状态见下文「第三段」 |
| 场景之间共用的件（从对应场景目录导入） | 查看器、嵌入、文档横幅、窄屏复核 | `fidelity/viewer.tsx` 的 `ViewerSummary { rows?, footer?, details? }`（DS-110：ⓘ 卡接条目）· `narrow/viewer.tsx` 的 `Sheet`（`handoff`、`stopPointer`）/ `TouchIcon` / `useSwipe` / `TouchPagerBar`（DS-111：查看器窄屏同一套）· `find-view-undo/FindReplace` 的 `FindPanel` `placement` auto / top-center / plain · `comments/phone.tsx` 的 `PhoneCommentsSheet` `layout` sheet / stacked / sidebar 与 `TabletViewer`（DS-131；嵌入里撰写区上方一句改「当前区域太窄，暂不能解决评论」，DS-112）· `offline-conflict` 的 `paused()` / `readonly()` / `PAUSED_DIM`（暂时不能编辑、只读加入两种编辑器形态）、`UnsyncedConfirm { kind: leave / refresh / logout, cause: offline / auth / paused / server / drift }`、`LeaveGuard`、`ExportLayer` · `plugins/poll.tsx` 的 `usePollPanel` · `offline-conflict/banners.tsx` 的 `EXPORT_COPY`（导出本地副本说明的第二句与「已导出本地副本」正文按原因：降权 / 换账号「获得编辑权限后…」、换纪元 / 更改过大「可以对照重做」、文档已删除「可以另存为新文档」、离线 / 退出登录「恢复连接后可以对照重做」、其余中性句，DS-129、TB-139）与 `dialogs.tsx` 的 `REDO_BY_CAUSE`（离开 / 刷新 / 退出登录确认按原因取第二句）· `share/RequestAccess.tsx` 的 `request.later`（M2：「申请访问」留在原位、不可用、工具提示「申请访问 · 后续版本提供」，不弹留言弹层，TB-156） |

### 随第 3 批改的已拍板画面（底座组，2026-10-16）

- **DS-75 横幅统一高 40（含 1px 底边）**：kit `Banner` 带按钮的上下内边距 6 → 5（按钮 28 在 39 高的行里垂直居中），只有文字或只带 × 的照旧；多行照常撑高。第 1、2 批带按钮的横幅状态各矮 1px（横幅以下整体上移 1px），布局与文案不动；逐像素基线已按有意改动重存（`b2/r9/run-all.sh` 用的新基线见 §8）。横幅本体带 `data-v3-banner`（只为核对：把它的内边距临时改回 6 时与改前逐像素一致）。§3b 原「横幅高度未统一」一条作废。
- **TB-103**：三处「放映」按钮（检查器协作行、网格右上胶囊、紧凑形态右上胶囊）的工具提示改为「从当前页放映 ⇧F5」（`editor/chrome.tsx` 的 `PRESENT_TIP` / `PRESENT_KBD`，三处同一份）；按钮读屏名仍是「放映」，不可用时提示照旧写原因。
- **DS-78**：主菜单「文件 › 导出…」显示 ⇧⌘E（`FILE_ITEMS`；⌘E 留给居中对齐）。

### 第 3 批的约定

- 场景写 `batch: 3`、`host`；状态 id kebab-case；note 写这一态的规格（依据的 DS / TB / PRD 与对应文档）。拍板时画给用户对照、没有采用的画法留在样张里（DS-63）：`alt-<名>`，标题「未采纳 · 」，note 开头「未采纳（DS-xx 定为〈采纳的画法〉）：…」；用户采纳的备选转正、改成正式状态 id（见下文「状态改名与删除」）。
- 只改自己名下的文件；要改共享件时先在场景目录写局部件，返回值 `kitRequests` 写明要并入哪里、为什么（第 3 批样张组交付时的 kitRequests 已按 `S/b3/integ/kit-triage.md` 分流，拍板后随转正并入底座，见下文）。
- 下面的 `S` 指检查与截图用的会话工作目录（不在仓库里，路径随会话而定；§8 的截图目录同一处）。
- 截图：`S/v3-shots/batch3/<场景>-<状态>-{dark,light}.png`（DPR 2、1600 × 1000，特殊视口登记在 `S/final-sweep/vp.js`，键「场景.状态」）。脚本 `node S/v3-shots/batch3/shoot.cjs <端口> <场景> [状态,…] [--w 宽 --h 高]`（按 `__V3_SCENARIOS__` 的 href 拍，页面级宿主照常；控制台有 error / warning 时退出码 2）。
- 构建与预览：几组并行时不要都往 `playground/dist` 构建（互相覆盖）：各自 `npx tsc -p tsconfig.app.json`（只做类型检查、不写文件）+ `npx vite build --outDir <自己的目录> --emptyOutDir`，再 `node S/final-sweep/serve.cjs <目录> <自己的端口>`（监听 127.0.0.1）。用了 `npm run build` 的，完了把进了 git 的 `tsconfig.app.tsbuildinfo` 还原（`git checkout -- tsconfig.app.tsbuildinfo`）。8791 上是底座交付时的构建（`playground/dist`）。
- 自查：`node S/b3/base/kit-sweep.cjs <端口> <场景> [状态,…]`（版面分析：横向 / 纵向溢出、中文 < 12px、「找不到场景状态」、控制台；每态新会话、暗亮各一次，视口按 `vp.js`；不写状态取全部）；底座回归 `node S/b3/base/base-check.cjs <端口>`（宿主与路由、新共享件、TB-103、DS-78、DS-75，33 条；改了已拍板首页的以集成为准）；整轮 `bash S/b2/r9/run-all.sh`（约 70 分钟，第 1、2 批不回退，集成时跑）。

### 第 3 批拍板后的现状（2026-10-22 转正，rulings §4.25 DS-79…DS-136、TB-107…TB-129）

用户 2026-10-21 至 10-22 逐题裁决第 3 批（DS-79…DS-136；DS-80、DS-91、DS-96、DS-98、DS-123 采纳的是备选），总编排定技术口径 TB-107…TB-129。样张分两段转正：第一段把 kitRequests 按裁决并进底座、改第 1、2 批按裁决变化的已拍板画面并重存逐像素基线；第二段改第 3 批场景（DS-63 标注、采纳了备选的 5 题转正、删去并入底座后的场景局部件与变通写法，画面不变）；第三段（收尾）补齐回写中新裁的 DS-137、DS-138 与技术口径 TB-130…TB-162，以及前两段的遗留项（见下文「第三段」）；第四段只改说明、标题与注释（另有放映「更多」触控不写键位一处），对上 TB-163…TB-175 与已写好的文档（见下文「第四段」）。原「第 3 批样张组交付后的约定（2026-10-21 集成）」一节按这里改写，仍然有效的几条留在下面。

**第 3 批的场景**（都写 `batch: 3`；状态数含未采纳的备选与对照，转正后共 273 个可见状态；2026-10-23 评审修改后 279 个，见下文「评审修改」一段）

| 场景 | 宿主 | 状态 | 依据 |
|---|---|---|---|
| `documents` | documents（DS-82、DS-85 的三态在 editor） | 32 | 文档列表、搜索、回收站（DS-79…DS-88、DS-92、DS-98） |
| `home` | home | 21 | 首页补态（不带 state 的已拍板首页就是底座的 `HomeBody`）、TB-101 `admin-denied` |
| `account-menu` | home（两态在 editor） | 7 | DS-89…DS-91；嵌入里的「退出登录」与 DS-112 的区别写在 `embedded-logout` |
| `templates` | templates | 7 | DS-72、DS-93 |
| `import` · `export` | import 的导入对话框各态在 home（`dialog-documents` 在 documents），其余在 editor；export 在 editor | 18 · 23 | DS-99…DS-105、DS-78、TB-126；2026-10-23 起导入对话框与格式图标 DS-140…DS-143、TB-179…TB-183（DS-97、DS-98 被 DS-140 取代） |
| `present` · `viewer` | editor（regions 整块替换） | 18 · 23 | DS-106…DS-111、TB-102、TB-104、TB-111…TB-114 |
| `embed` | embed | 11 | DS-73 全套、DS-112、TB-115；iframe 里的页面是隐藏场景 `embed-frame`（6 态，Hub 不展示；登录与失败四态 host page，`editor-menu`、`compact-menu` 两态 host editor） |
| `settings` · `shortcuts` · `command-palette` | editor（`from-home`、`settings.phone` 在 home） | 12 · 14 · 2 | DS-113…DS-117、TB-105、TB-106、TB-116…TB-118 |
| `admin-plugins` | admin/plugins | 28 | DS-86、DS-92、DS-94…DS-96、TB-119…TB-121；任一状态带 `&plugin=<插件 id>` 即深链 |
| `shell-pages` | page（4 态在 editor） | 22 | DS-71、DS-118…DS-125、TB-122 |
| `doc-banners` · `narrow-review` · `presence-scale` · `quiet-leftovers` | editor | 13 · 12 · 5 · 11 | DS-126…DS-136、TB-124、TB-125（quiet-leftovers 是 TB-58 四项「现画法 / 改后」的对照） |

**状态改名与删除**（第二段）

- `documents.alt-search-dropdown` → `documents.search-dropdown`（DS-80 采纳原备选：开始页与文档列表的搜索框都是下拉，正式态）；`documents.search` 留作「查看全部结果」进入的结果页，原推荐「边输边搜、主区换成结果页」写进它的 note 作为未采纳说明。
- `import.alt-drop-page` → `import.drop-page`（DS-98 采纳原备选：「导入 .pptx」先进导入页，正式态，排在 import 的第一个）；开始页与文档列表的拖入落区照常保留。（2026-10-23 DS-98 被 DS-140 取代，`import.drop-page` 随整屏导入各态删去，见下文「评审修改」）
- `account-menu.profile-m2` → `account-menu.alt-profile-m2`（DS-91 采纳原备选「M3 前不显示」，原推荐「M2 原位不可用并标 M3」改为未采纳）；`account-menu.alt-profile-hidden` 并入 `member` 后删除（`member`、`editor`、`embedded-logout`、`alt-theme-two` 的 M2 菜单都不显示「个人资料…」）。
- DS-96 采纳原备选：管理页被拒横幅去掉「只看被拒插件」（所有出现被拒横幅的状态），横幅只陈述事实，不另留一态。
- DS-123 采纳原备选「kit 不可用态」：第 3 批曾改成 outline 的画布底主按钮不可用 / 进行中（`shell-pages.login-redirecting`、`embed-frame.auth-popup-open`、开始页与文档列表离线时的「新建演示文稿」、`home.creating`、`templates.creating`）改回 kit 主按钮的不可用态（进行中加转圈）。
- 其余状态 id 不变。按推荐采纳的题只把 note 里的「拍板候选 Pn」「TB（总编排…）Tn」换成 DS / TB 编号；没采用的一侧标「未采纳 · 」（DS-63）。`alt-*` 之外，quiet-leftovers 的 `view-toggle-now`、`view-toggle-grid-now`、`notes-now`、`lock-ratio-now`（DS-133 / DS-134 / DS-136 采用改后）与 `notes-after-text3`、`handle-after`（DS-134 的另一档、DS-135 维持现画法）同样标「未采纳 · 」，id 不变。

**并入底座、从场景里删去的局部件与变通写法**（画面不变；新件的接口见上表）

- documents：`shell.tsx`（壳、帮助菜单与搜索框 → kit `ShellLayout` / `ShellHelpMenu` / `ShellSearch`）、`DocCard.tsx`（→ kit `DocumentCard`）、`covers.tsx` 与 `docs-data.ts`（→ `src/v3/library.ts`、`DocCover.tsx`）、`DropOverlay.tsx`（→ kit `DropOverlay`）、`roving.ts`（→ kit `roving`）；`Library.tsx` 改用 kit 文档库公共件，`alts.tsx` 只剩三个未采纳备选的主区。
- home：`HomeMain.tsx` 的壳与主区（→ 底座缺省壳与 `HomeBody`），只剩 `homeData`、`HOME_SHELL` / `HOME_PAGE` / `homeShell` 与窄屏的 `NavToggle` / `HomeDrawer`。
- account-menu：`items.tsx`（→ `accountMenuItems(options)`，状态按角色 / 里程碑 / 嵌入给 `shell.accountMenu` 或 `AccountMenuLayer options`）。
- present：`follow.tsx`（→ kit Follow 件，`editor-following` 用底座的 `collaborators.following`）、`scope.tsx`（→ kit `StageScope`）；`stage.tsx` 的本地跳页提示与输入（→ kit `PageJumpHint` / `PageJumpInput`）与捕获阶段的「放映」按钮、F5 监听（→ 底座命令 `present` / `present.fromStart`）；`slides.tsx` 的渲染失败页（→ kit `PagePlaceholder`）。
- viewer：`narrow.tsx` 复制的底部面板、触控按钮、轻扫与浮动翻页条（→ `narrow/viewer.tsx` 导出的同一份）与查找条的定位偏移（→ `FindPanel placement="plain"`）；`summary.tsx` 的 `SummaryCard`（→ `ViewerSummary` 接 rows / footer / details）。
- settings · shortcuts · command-palette：`shortcuts/nav.ts` 的模块级命令表、主菜单接线 `WIRED_HELP`、⌘ 键监听与本地跳转（→ 底座命令与 kit `useGoTo`），只剩带参数发命令的 `useAppWiring` / `useRunApp`；`home-backdrop.tsx` 在捕获阶段接点按的做法（→ 底座命令）；命令面板本体（→ kit `CommandPalette`，第一段）。
- import：本地「到达时聚焦第一个按钮」（→ `BlockingPage focusOnArrive`；拖放页自己落在「选择文件…」）、缩略图占位 `placeholderOf`（→ `RailThumb pending`）、本地跳转（→ kit `useGoTo`）。
- export：document 上的 ⇧⌘E 监听（→ 底座命令 `file.export`）、换「文件」条目的 `fileItemsWithoutExport`（→ `exportReasonOf`）。
- templates：本地漫游与跳转（→ kit `roving` / `useRovingGrid` / `goToState`）；预览对话框的「正在创建…」用 `Dialog busy`。
- admin-plugins：左栏借 `search` 插槽、`nav: []` 加 className 隐藏空导航（→ `ShellRail navSlot`）。
- embed · shell-pages：画布底主按钮进行中切到 outline 的局部写法（DS-123）；`LogoutConfirm` 自己画的确认框（→ 第 2 批 `UnsyncedConfirm` 加 kind `logout`，并接住底座命令 `account.logout`）。
- doc-banners：照抄的 `paused()` / `readonly()` / `PAUSED_DIM`（→ offline-conflict 导出）与照抄的确认框（→ `UnsyncedConfirm` 原因 `drift` 与 `LeaveGuard`）。
- narrow-review：本地 `usePollPanel`（→ plugins 导出）；`BelowBanner`（→ 紧凑抽屉自己读横幅总高，第一段）。
- presence-scale：`RosterLayer`（在 document 捕获阶段拦下「+N」的点按，→ `collaborators.list` / `listOpen`）与本地角标件（→ kit `AvatarBadge`、`Avatar seq`）。
- quiet-leftovers：「改后」三项的覆盖样式与 `geometry-after.tsx`（底座就是改后）；反过来给未采纳的「现画法」四态加覆盖，`geometry-now.tsx` 留一份原画法的「位置与大小」。

**第 1、2 批随转正改的已拍板画面**（第一段逐张核对后重存了逐像素基线，清单与做法见 `S/b3/battery/README.md` §8）

- 应用壳与首页：左栏第 5 项「回收站」（DS-79）、搜索框下拉（DS-80）、帮助菜单（DS-89）、账户菜单（DS-90 / DS-91）、卡片第二行与菜单（DS-81 / DS-83）、首页主区换成 `HomeBody`；`_kit` 的壳、卡片、账户菜单示例随之变。
- 编辑器：评审者、查看者的文件名不再是菜单触发器（DS-82）；主菜单「文件 › 导出…」按权限置灰（DS-105）；「帮助 › 帮助中心」外链（DS-89）；账户菜单（DS-90 / DS-91）；他人头像是跟随按钮（DS-106）；`fidelity.viewer-shell` 换成查看器桌面壳（DS-110）；紧凑抽屉从横幅下沿开始（DS-130）；`comments.tablet` 竖屏上下排开（DS-131）；在线列表最窄 256、按内容加宽（DS-132）；视图切换改分段（DS-133）、备注区凹陷底（DS-134）、锁定比例未锁时断开的链（DS-136）。
- 第二段没有再改第 1、2 批的画面（对第一段的最终构建逐像素对拍，只剩已知的抖动与截图失真）：kit `ShellSearch` 改成组合框、加结果页形态，搜索框的画法不变（输入框的字号与行高写在同一段里，免得 `leading-none` 被字号类合并掉、输入文字下沉 1px）；`comments/phone.tsx` 加的嵌入分支只在 `embedded=1` 时走。

- 第三段（DS-137、TB-138 / DS-139；逐像素基线随之重存，见 `S/b3/battery/README.md` §11）：判为 M2 的状态里「分享」原位不可用（第 1 批 16 态、第 2 批 `comments.m2-no-package` 与 `plugins.m2`，名单见下文「第三段」）；`version-history.degraded-menu` 文档菜单「创建副本」不可用。DS-129、TB-121、DS-138 的改动在缺省画面里看不到（导出之后、展开核心组件、翻到没有备注的页才出现）。
- 第四段没有改第 1、2 批的画面：只动第 3 批的标题、note 与注释，另有 `present/stage.tsx`「更多」触控不写键位（只有放映场景用它）；构建产物里只有场景注册块与 Hub 块变了，底座各块逐字节相同。

**第三段（收尾，2026-10-22：回写中新裁的 DS-137、DS-138，技术口径 TB-130…TB-162，与前两段的遗留项）**

- TB-138：编辑中被降权时文档菜单「重命名」「创建副本」「版本历史」三项都留在原位、不可用，写「需要编辑权限」（底座 `docMenuEntries` 的降权分支，与「文件 › 导出…」同一规则；登录已过期、隔离态等暂时不能编辑的状态经同一个 `readonlyDegraded` 走这一支，原因写各自那一句）。前两段留下的「创建副本要不要跟着不可用」由此结案：用户 2026-10-22 确认改为不可用（DS-139，取代第 1 批拍板时的样张修正「降权时创建副本照常」），未保存的更改仍从降权横幅「导出为本地副本」带走。
- DS-137 + TB-161：「分享」的宿主声明写 `inspector.share`（上表 `SHARE_LATER`），卡片菜单是 `docCardMenu` 的 `shareLater`。里程碑按各态的 note / data 判：开始页（`HomeBody` 缺省 M2，`m3-more-templates`、`admin-denied` 是 M3）与文档列表（LibData 缺省 M2；`trash`、`purge-confirm`、`purging`、`share-from-card` 是 M3）；编辑器里判为 M2 的——第 1 批 `main-states.review-empty`、`main-states.account-menu`、`main-states.account-menu-grid`、`slide-management.section-menu`、`master-view.m2-locked`、`table` 里 data 写 M2 的 10 态（grid、placeholder-grid、table-dialog、table-dialog-error、inserted、inserted-free、cell-nav、m2-range、m2-menu、readonly）、`chart.m2-disabled`，第 2 批 `comments.m2-no-package`、`plugins.m2`，第 3 批 `account-menu.editor`、`export`（ExportSeed 缺省 M2；标 M3 的四态照常可用）、`settings`（telemetry 是 M3、embedded-locked 是 SDK 单人 preset，维持现画法）。其余不写里程碑的状态维持现画法（「分享」可用）。`documents.offline`、`home.offline`、`documents.card-menu`、`card-menu-reader`、`share-from-card`、`home.card-menu` 的 note 里的 M3 行为改写为「M2 不可用、M3 起…」。
- DS-138：备注为空一律「这一页没有演讲者备注」（`narrow/viewer.tsx` 仅查看形态与 `comments/phone.tsx` 手机、平板的备注卡；查看器与桌面只读态原本就是这一句）。
- TB-156：`RequestAccessButton` 的 `request.later`（M2：原位不可用、工具提示「申请访问 · 后续版本提供」、不弹留言弹层）；现有阻断页各态（第 1 批 open-failed-access、第 2 批 share / offline-conflict、第 3 批 link-expired 等）都没写明是 M2，维持 M3 的画法。
- DS-129 + TB-139：`EXPORT_COPY` / `REDO_BY_CAUSE`（上表）；第 2 批 `too-large`、`doc-deleted` 与离线、登录已过期、隔离态、服务器保存延迟各态导出后的文案按原因换；`doc-banners` 换纪元与 `shell-pages` 退出登录原先各写一份，改为取同一张表（文字不变）。
- TB-121：个人插件面板（plugins）的插件标识改为 cordis 插件 id（`comments`、`kernel`…；`model-slide`、`ooxml-pptx` 写 `@cordexjs/…`；英文语言包 `locale-packs`），与管理页同一份数据（`admin-plugins/data.ts` 不再经包名转换）；「复制诊断信息」的 `plugin:` 一行与去管理页的深链 `plugin=` 随之是插件 id。
- 其余口径：TB-132 命令面板「帮助中心」只在配置了链接时列出、带外链图标；TB-154 触控形态的帮助菜单与账户菜单不写键位提示（`touch`）；TB-136 / TB-159、TB-145、TB-149、TB-162 写进注释与 note，TB-153、TB-155、TB-133 写进 note，TB-134 写进放映「更多」的注释（没有单画的状态）；TB-130 的「手机与触控同用下拉、行高 44」：kit `ShellSearch` 触控时「查看全部结果」一行改 44（文档行本来就是 44；没有状态把触控下拉开着，截图不变）。
- `import.drop-page` 到达时焦点落在拖放区里的主按钮「选择文件…」（维持样张现状；03-13「入口与流程」随后已对齐，见第四段）。（2026-10-23 这一态随 DS-140 删去）
- 路由登记 `src/routes/registry.ts`：v3 改为第 0–3 批都已拍板，登记第 3 批页面级宿主（spec 不写「03-screens/」，不影响 `docs/_tools/gen-docs-site.py` 的界面 → 路由映射）。
- 第 3 批 note 里的复验与评审代号（g4-xx、g7-rv-xx、复验 Nn、XG-xx、AP-xx、摸底缺口等）删去出处或换成 DS 编号，规格不变。
- 回归（`S/b3/battery/README.md` §11）：第 1、2 批的有意变化（上文「第三段」那一条）逐张核对后重存了四份逐像素基线，检查断言按 TB-138、TB-121 改了三处；整轮 20 步全部通过；第 3 批 19 个场景（含隐藏的 embed-frame）版面扫描 558 项无问题，`S/v3-shots/batch3-final/` 由最终构建重拍（这一段没有状态改名或删除）。

**第四段（收尾，2026-10-22：TB-163…TB-175 与文档组、独立复核报来的说明；只改说明、标题与注释，画面不变）**

- TB-165 / TB-170：`home.phone` 标题改「手机（< 640）」、`home.phone-drawer` 改「手机 · 导航抽屉展开」；`home.phone`、`home.compact`、`documents.compact` 写明平板（触控、≥ 640）的左栏与列数按窗口宽度（≥ 1024 左栏常驻、四列；640–1024 抽屉、三列），网格 / 列表切换与「最近」的排序照常、搜索框随左栏（44、不写 ⌘K），其余照触控形态；`HomeBody` 的 `form` 与 `RecentSection` 的 `touch`、kit `ShellSearch` / `DocumentCard` 的 `touch`、`HomeMain` 抽屉的注释同一口径（形态仍由 `data.form` 显式给，代码不变；样张没有单画平板）。
- TB-163：「触控设备」只指平板。逐处核对了说明与注释里的「触控设备」「在电脑上编辑」「在更大窗口中编辑」，只有 `narrow/data.ts` 的「嵌入又是触控时」改成平板、并写明手机不论是否触控都按窗口窄写；`editor/breakpoint.ts` 的仅查看判据（< 640 或 pointer: coarse，DS-17）与登录页的触控判据（03-33 §1.3）不变。
- TB-164：触控形态的账户菜单与帮助菜单不写 ⌘/、⌘,（第三段已做，复核通过；引用 TB-154 写 ⌘, 的几处改引 TB-164）；放映「更多」的「白屏 W」「跳至页码… 数字 ↵」在触控形态（`present.phone`、`phone-landscape`）不画键位，桌面照常——这两态的截图里菜单没开着，画面不变。
- 导出与导入：`export.failed` 写明浏览器生成的图片某一页走了运行时页级回退时同样进失败态、保真占位照常导出（TB-166），两种原因句「有一页暂时无法生成…」（`render.page_failed`，TB-173）与「生成文件时超时…」（`headless.render_timeout`，TB-175；样张画的仍是这一句）；`export.png` 写 PNG 页数上限初值（1280 px 200 页、1920 px 100 页、3840 px 25 页，TB-148），`export.svg` 写 SVG 不设分档上限（TB-152）；`import.drop-page` 写明手机与平板直接打开 /import 照常显示导入页（TB-167；2026-10-23 这一态随 DS-140 删去，TB-167 由 TB-181 修订）。
- 其余口径：`documents.recent` 与 kit `DocumentCard` 写卡片第二行缺项时的写法（TB-171，样张数据不变）；kit `Banner stack` 与上文横幅一条改为「仅查看形态（手机与平板）」（TB-172）；`admin-plugins.declared` 写定部署时校验在主端口开始监听之前做完、界面上不会出现这一态、只读画法只作兜底（60/15 §3.15，03-32 §5.1、§14；状态保留）。
- 待办写法收口：第 3 批说明与注释里的「回写时」「随之回写」「随回写」「由文档组按这里对齐」「样张补」之类（present、viewer、import、export、settings、shortcuts、admin-plugins、shell-pages、presence-scale、doc-banners、documents、home 三十余处）改成定稿写法、引用已写好的文档小节；`shell-pages.app-error` 标题改为 03-33 §3 的「页面出错了」（与页面上的标题一致）；`src/routes/registry.ts` 的 /v3/editor、/v3/home 改为 DS-79…DS-139。
- 不另补状态：TB-156 的 M2「申请访问」画法在共享件 `request.later` 里（第三段临时实测过），不单出一态；不写里程碑的编辑器状态维持「分享」可用的 M3 画法（名单见第三段）。
- 回归（`S/b3/battery/README.md` §12）：第 3 批全部 558 张对第三段最终构建逐像素对拍 0 差（1 张一次性抖动，复拍两次 0 差）；19 个场景版面扫描 558 项无问题；第三段行为核对 44/44，放映「更多」触控键位另核 3/3；DS-63 标注与旧说法复扫干净（第 3 批可见 273 态）；改 README 后单跑 basecheck 32/32、dscheck 63/63、fucheck 64/64、verify-r7 48/48，README 要求的字串都在。没有画面变化，`S/v3-shots/batch3-final/` 不重拍。

**评审修改（2026-10-23，rulings §4.25 DS-140…DS-143、TB-179…TB-183）**

用户在第 3 批文档评审中提出两处修改（导入改为 Figma 式对话框、导出格式加文件类型图标），2026-10-23 拍板：DS-140 导入全程在对话框里（取代 DS-97 整屏导入过渡页、DS-98 整屏导入页）、DS-141 落区静止用安静虚线、DS-142 全站对话框按 Figma 统一（用户选了备选，第 1–3 批全部对话框随之改）、DS-143 导出格式用 Tabler 文件类型图标；总编排技术口径 TB-179…TB-183。评审时画的样张随之转正：

- **底座**：kit `Dialog` 新画法——标题栏 40、圆角 12、× 正文色，另加导入专用的 `size="import"` 560 档（§3b「对话框与菜单」）；kit `Drawer` 的标题行同一画法、同改；关闭时焦点已落在页面里可用的元素上就不再移动（kit `focusSettledElsewhere`，Dialog / Drawer / BottomSheet）；新件 kit `importDialog`（导入对话框的登记、开关与两个入口）、`BottomSheet`（由 settings/sheet.tsx 并入）、`FileTypeIcon`（Tabler，TB-182），接口见上表；`ShellDefaultActions` 的「导入 .pptx」打开导入对话框；`DropOverlay` 拖入高亮改强调色、松开打开对话框的上传态（TB-180）；页面宿主在应用壳四个宿主里挂 `ImportDialogLayer`；`v3.css` 控件语义 token 的注释补 DS-141 的落区例外。只为核对加的 DOM 标记：`data-v3-dialog`（kit 对话框与变体）、`data-v3-sheet`（kit 底部面板）、`data-v3-file-type`（文件类型图标），不改外观。
- **import（17 → 18）**：
  - 转正（去掉「评审修改 · 」前缀，标题照内容写，排在场景最前，note 开头引 DS-140…DS-142、TB-179…TB-182）：`dialog`「导入对话框（开始页）」、`dialog-documents`「导入对话框（文档列表）」、`dialog-dragover`、`dialog-uploading`、`dialog-parsing`、`dialog-failed-network`、`dialog-failed-invalid-package`、`dialog-failed-quota`、`dialog-phone`「导入对话框 · 手机底部面板（< 640）」。外框 560 × 406（标杆 Figma 560 × 404，差在它的外框边是 0.5px；TB-179 原写的固定高 414 是标题栏 48 时的值），落区 494 × 316（有底栏的阶段 494 × 263）；上传与解析阶段的文件名前加 20px .pptx 图标（TB-182）；手机底部面板改用 kit `BottomSheet dismissOnOutside`，原来借的透明接收层删去。
  - 改名：`dialog-dash-control` → `alt-dialog-dash-control`「未采纳 · 落区虚线用控件边界色」（DS-141）；`alt-dialog-entry-only` 标题改「未采纳 · 只把入口换成对话框」（DS-140；它要去的整屏过渡页已删，样张里选好文件只关闭对话框、焦点回到顶栏「导入 .pptx」）。
  - 删去：整屏旧画法 `drop-page`、`uploading`、`server-parsing`、`failed-unsupported`、`failed-invalid-package`、`failed-quota`、`failed-network`、`failed-too-complex`、`failed-storage` 与 DS-97 的未采纳备选 `alt-in-shell`（同第 1 批评审修改删去原画法的先例）；它们的文案与按错误码的规则并进对话框各失败态的 note（不支持的格式、文件过于复杂、存储不足用 `dialog-failed-invalid-package` 的画法、只换文案，`data.ts` 的 `OTHER_FAILURES`、`FOLDED`）。`pages.tsx` 里只给整屏用的件（导入页、过渡页与进度行 `UploadRow`、整屏失败页、阻断页上的「复制诊断信息」与「返回文档列表」、`useImportSeed`）一并删去，`TechDetails`、`QuotaTable`、`diagnosticsText`、`FILES` 与 DS-99 的两种打开画法保留；`snapshot-opening`、`alt-open-blocking` 等其余状态不动。
- **export（18 → 23）**：格式行缺省就带 Tabler 文件类型图标（选项页各态画面随之变），插件格式没有专属图标时用通用 file 字形（TB-182）；评审态 `icons-tabler-m3` 转正为 `m3-pdf`「选 PDF · 插件格式同屏（M3）」（现有状态里没有 PDF 选中又带插件格式行的画面），`icons-tabler`、`icons-tabler-png` 与 default、png 重复、删去；未采纳的 `alt-icons-phosphor` / `-m3`、`alt-icons-bootstrap` / `-m3` 标题改「未采纳 · 格式图标 · …」（DS-143），原件留在 `fileTypeIcons.tsx`；彩色那套 `alt-icons-color` / `-m3` 与 Untitled UI 原件删去（TB-183：授权不明，不保留原件；`S/b3/rev2/export/vendor/untitledui-file-icons` 同删）。
- **offline-conflict**：「导出本地副本」对话框的 .pptx 一行加 Tabler 图标、.json 一行加 lucide `FileBraces`（20、描边 1.5），同导出对话框的格式行（TB-182）。
- **settings**：`sheet.tsx` 并入 kit `BottomSheet`，`settings.phone` 画面不变。**home / documents**：note 里「「导入 .pptx」先进导入页」改为打开导入对话框；`drop-import` 两态的落区改强调色（TB-180）。
- **有意变化的范围**（供整轮回归核对；按首屏里开着 kit 对话框或抽屉逐态统计，对 10-22 最终构建对拍）：
  - DS-142（对话框标题栏、圆角、×）：第 1 批 14 态——insert.header-footer、header-footer-missing、icons、icons-empty、image-url，layout-picker.reset-confirm，master-view.delete-confirm、delete-master-confirm，shape-library.action-settings、action-slide，table.table-dialog、table-dialog-error，text-edit.link-dialog、link-invalid；第 2 批 48 态——comments.delete-thread，fidelity.alt-dialog，offline-conflict.degraded-export、leave-confirm、refresh-confirm，plugins 对话框形态 14 态，share 27 态，version-history.alt-confirm-dialog、purge-confirm；第 3 批 61 态——account-menu.profile-dialog，admin-plugins 12 态（含详情抽屉 4 态），doc-banners.version-drift-refresh，documents.purge-confirm、share-from-card，export 19 态，import 对话框 10 态，narrow-review.compact-plugins-dialog，settings 10 态（含抽屉备选 alt-drawer），shell-pages.logout-unsynced-confirm，shortcuts.alt-dialog，templates.creating、offline、preview；底座示例 `_kit.dialog`、`dialog-confirm`、`drawer`、`drawer-nonmodal`。对话框里一出现就展开的下拉随正文上移 8（share.link-expiry、link-menu）。
  - DS-143、TB-182（文件类型图标）：export 选项页各态（default、png、svg、custom-range-error、unsynced-client、unsynced-offline、degraded-note、unsynced-server、plugin-format、m3-pdf），import.dialog-uploading、dialog-parsing，offline-conflict.degraded-export。
  - TB-180（DropOverlay）：home.drop-import、documents.drop-import。
  - 其余画面不变：home、documents 的其余各态与 settings.phone、offline-conflict 其余各态逐像素 0 差（顶栏「导入 .pptx」只多了锚点与 aria-haspopup）。

**底座能力（推迟项组改，2026-10-21 集成，现行）**

- **评论钉缺省开（TB-83）**：`stage.commentPins` 不写时，以编辑模式起步的状态都画示例文档的评论钉（DS-43）；评审 / 只读浏览起步的状态由场景自己画（第 1 批评审态用 `CommentLayer`），评论场景与 `DECK_COMMENTS` 写 `stage.commentPins: false` 免得画两份。钉与左栏、网格的评论角标读评论场景登记的线程数据（kit `registerCommentPins`，同 `registerCommentsBody` 的做法；状态没写 dataset 时取「deck」），点钉切到「评论」页签并定位那一条、焦点留在钉上；解决一条后钉与角标同步减少。上文 §3 `stage` 行「`commentPins: true` 才画」的写法以这里为准。
- **同一状态里切换编辑 / 评审（TB-84、TB-87）**：`EditorCtx.setMode`（主菜单「视图 › 模式」与评审条「返回编辑」都走它），不重新挂载编辑器，撰写中的评论框与内容保留；切换后，状态自己的 `regions.toolbar` 只用于它声明的那个模式，另一个模式用底座缺省工具条（返回编辑后焦点在「选择」）。
- **单页 ↔ 网格切换的焦点**：`changeView` 先把焦点交给画布列再换视图，入口在过渡里卸载时焦点不再落到 body（左栏、胶囊、主菜单、网格 Enter / 双击、网格里按 T 都已复测）。
- **头像角标**：第 3 批转正后是 kit `AvatarBadge`（`Avatar` 给 `seq` 就画，读屏名「姓名，同色第 N 位」，DS-132）；`badge` / `label` 两个口子保留给自定义角标（presence-scale 未采纳的「两种角标都上头像」用它）。

**放映、查看器、嵌入**

- 放映舞台不随界面亮暗：kit `StageScope`（第 3 批转正时由 `present/scope.tsx` 并入）在舞台里另开一个 `data-v3-theme="dark"` 的作用域（强调色跟随界面），舞台 token `--v3-stage` #0A0A0A（舞台底与留边）、`--v3-stage-black` #000000（黑屏、结束页）、`--v3-stage-white` #FFFFFF（白屏）在 `v3.css`。
- 嵌入外框（`page.embed`）加 `frameLabel`：右侧尺寸说明缺省「iframe 宽 × 高」；形态 C（查看器挂在宿主自己的 div 里，不是 iframe）写「容器 640 × 360」。
- `specs` 只认 `NN-NN`（界面文档编号）：没有界面文档的场景写 `[]`（嵌入），写「50/12」这类会在每个页面打一条 console.error。
- 放映与查看器没单独画的可选态（link-hover、media、windowed、degraded-element、fullscreen、tiny）与理由写在 `present.scenario.tsx`、`viewer.scenario.tsx` 的文件头注释里；其余各组「可选、没另画」的态同样写在各自场景文件头。

**截图与检查**

- 特殊视口都登记在 `S/final-sweep/vp.js`（键「场景.状态」，第 3 批新增 30 个：紧凑 1000 × 760、手机 390 × 844、平板 820 × 1180 / 1180 × 820、新窗口登录回调 520 × 680 等）；值写四个数时第 3、4 个是截图时鼠标的位置（`viewer.alt-narrow-toolbar` 停在 (195, 640)，免得拍成顶部条按钮的悬停态），`shoot.cjs` 读它。
- 10-16 → 10-21 闲置期间 `S` 被系统清空过，检查脚本与基线已按会话记录还原：整轮检查的用法、各步含义与跳过项见 `S/b3/battery/README.md`；第 1、2 批逐像素基线改在 10-21 冻结的构建 `S/b3/base1021/dist` 上重拍（目录名不变：`b2/repair-r3/b1-base-b3`、`b1-base-b3b`，`b3/base/b2-base-b3`、`b2-base-b3b`）。旧轮次的 dist 已不存在，跨轮对拍的断言打印 SKIP、不计入通过数。
- `base-check.cjs` 的 H3：模板库、管理页已有场景，不带 state 时打开该宿主的第一个场景（不再出「还没有场景」）；写错 state 的两条照旧。
- 转正后的全量截图：`S/v3-shots/batch3-final/<场景>-<状态>-{dark,light}.png`（`OUT=S/v3-shots/batch3-final PORT=<端口> bash S/b3/integ/shoot-b3.sh`）；转正前的样张组截图仍在 `S/v3-shots/batch3/`。

## 3f. 母版视图接成宿主的全局模式（2026-10-28，母版视图改版第一步）

起因：用户 2026-10-23 反馈母版视图「切换不过去」——原来的母版视图只是 `master-view` 场景用 `regions` 包出来的一层场景内开关（场景仓键 `masters.mv.in`），底座主菜单的「母版视图」在别的状态里没有回调，⌥⌘M 与 Esc 只挂在母版横幅里。第一步把它接成编辑器宿主（`Editor.tsx`）的全局模式，现有画面由适配层包住、画法不改；第二步把适配层换成按标杆重做的件，宿主与两份契约不动。依据：rulings §4.25 DS-144，第一步的各处取法 2026-11-03 按推荐确认（DS-161…DS-169）；宿主的接口与入口判定以前端 50/11 §2、§3 为准。

**宿主与两份契约**（`src/v3/editor/master/`，新增源文件已登记 40/10 §3a）

- `types.ts`：一、`EditorCtx.masterView`（`MasterViewMode`）——`on`、`session`、`entry`（能不能进入：`ok` / `reason` / `silent`）、`memory`（会话记忆）、`target`，与 `enter(via, target?)`、`exit(via, opts?)`、`toggle(via)`；`target` 形如 `{ layout?, placeholder?: { type, index? } }`（「转到版式」「编辑版式」用），`opts` 形如 `{ slide?, slides? }`（「在普通视图查看引用页」用）。二、`MasterViewImpl`——`Rail` / `Stage` / `Inspector` / `Toolbar` / `Banner` / `Overlay?` 与 `onEnter` / `onExit` / `onEscape` / `entryFocus`。
- `registry.ts`：`registerMasterView(impl)` / `getMasterView()`，做法同 `registerCommentsBody`；第一步登记的是 `masters-themes/master-impl.tsx`（适配层：把 `MasterRail` / `MasterStage` / `MasterChrome` 的件按 `MasterViewImpl` 登记，逐字段同原来的 regions 写法）。
- `mode.ts`：`masterEntryOf()`（能否进入，按状态配置与运行时事实判，不按状态 id）、原因文案常量 `MASTER_REASON` / `EMBED_MASTER_REASON` / `TABLET_MASTER_REASON`（由 `narrow/data.ts` 迁入，原处改为转出）、`masterMenuOption()`（主菜单条目的缺省）、`useMasterEntryGuard(reason, { silent?, form? })`（场景组件挂载期间声明「现在不能进入」；`form` 标明这条说的是形态，外壳用）、滚动位置的读写（左栏、网格、放大后的画布）。
- `host.tsx`：`MasterModeKeys`（⌥⌘M、Esc 逐层）、`MasterModeToast`（不可用原因的轻提示）、`masterRegions()`（母版视图里的区域决策与横幅叠放）。
- `src/v3/editor/palette-host.ts`：`registerPaletteHost`，命令面板样张把宿主组件登记成编辑器的缺省命令面板。
- kit 导出 `useMasterViewMode`、`useMasterEntryGuard`、`registerMasterView`、`registerPaletteHost`、三个原因常量与 `MasterViewMode` 等类型；`setCommandBefore`（命令前置钩子）在 `kit/commands.ts`。

**状态怎样写**

- 载入时就在母版视图里的演示态写 `masterView: { open: true }`（`master-view` 场景级、narrow 两个紧凑母版态、offline-conflict 两态），不再写 `regions` 包 `InMaster`、不再写 `banner: <MasterBar />`；`master-view.entry` 写 `open: false`。原 `data.mvIn` 删去。
- 母版横幅由宿主画在横幅通道最上面；状态还有别的横幅时只写那一条（如 `<OfflineBanner />`），宿主用 `BannerStack` 叠在母版横幅下面（TB-14）。
- 会话内被降权是会话级事实：写 `rail.readonlyDegraded: "需要编辑权限"`（`master-view.readonly`、`offline-conflict.master-degraded`），母版件的只读改读 `useEditor().readonlyDegraded`，原 `data.mvReadOnly` 删去；退出后普通视图同样是降权态，再按 ⌥⌘M 只提示原因。
- 形态外框：narrow 场景级写 `masterView: { frameRegions: true }`，母版视图里它的 `regions` 照常调用、拿到的 `defaults` 是母版区域；紧凑形态下母版视图用现有的 `Master*` 外框（`compact-features.tsx`）。其余状态的 `regions` 在母版视图里一律不用（版本历史、图表、设计主题等的区域替换只属于普通视图）。
- 没有编辑器外壳的状态：`masterView: false`（查看器 preset），或写了 `toolbar.collapse` 的阻断页；放映进行中由舞台声明 silent 守卫（`useMasterEntryGuard("放映中", { silent: true })`）。这些状态里 ⌥⌘M 既不进入也不提示，命令面板不挂。

**能否进入（`masterEntryOf`，按顺序取第一条；先后以 50/11 §3 为准：模式先于权限、权限先于形态）**

1. 没有入口（silent）：`masterView: false`、没有登记母版实现、silent 守卫在场，或 `toolbar.collapse`（仅查看形态 `data.form` 为 narrow 的例外：要说明原因；外壳挂载期间声明了带原因的守卫时同样例外，如手机 / 平板的仅查看外壳，见下「修复第 1 轮」）。
2. 模式与权限：评审「评审模式下不可用」、查看者「只有查看权限」，再看会话内被降权 `rail.readonlyDegraded`（「需要编辑权限」）。同一状态里切到评审（主菜单「视图 › 模式」，TB-83）后，紧凑形态里也先写评审的原因。
3. 外壳声明的形态（`useMasterEntryGuard(reason, { form: true })`）：紧凑形态的外壳 `CompactStage` 在就声明「在更大窗口中编辑」（嵌入里「当前区域太窄，暂不可用」），手机 / 平板的仅查看外壳按设备声明（`useViewOnlyMasterGuard`）；借用紧凑外框的状态不必各自再写。
4. 状态显式写的 `rail.menu.master.reason`（借用紧凑外框的状态写的「在更大窗口中编辑」）：外壳不在时（这些状态的网格视图）由它说明。
5. 场景守卫的原因：版本历史面板开着（含正在预览旧版本）「关闭版本历史后可用」（`version-history/chrome.tsx` 的 `VhController`）。
6. `inspector.locked`（打开中「文档打开后可用」）。
7. 形态：`data.form` 为 compact / 以 narrow 开头 / auto（按真实视口）——窗口窄（< 640）「在更大窗口中编辑」、触控「在电脑上编辑」、紧凑「在更大窗口中编辑」，嵌入只改写「在更大窗口中编辑」那一句；`data.form` 不写时按桌面判（底座外壳只有桌面画法）。

已在母版视图里时 `entry` 恒为可用（降权、缩到紧凑后仍能退出）。主菜单「母版视图」、命令面板与 ⌥⌘M 的轻提示取同一条（50/11 §3「实现上」段）。

**入口、出口与恢复**

- 入口：主菜单「视图 › 母版视图」（左栏、网格胶囊、紧凑胶囊与抽屉、静态打开的 `MainMenuLayer` 都由 `masterMenuOption` 给缺省，以宿主的 `entry` 为准：可进入时 `onToggle`、不可进入时写 `entry` 的原因；外壳或状态显式传的 `master` 只补宿主没给的字段）、⌥⌘M、命令面板「母版视图」。从网格视图进入时按单页结构画，URL 的 `view=grid` 留着。
- 出口：横幅「关闭母版视图」、主菜单同一位置、⌥⌘M、画布无选中时 Esc（浮层 → 抽屉 → 整栏面板 → 画布浮动层（查找和替换面板、页导航提示条，见下「修复第 3 轮」）→ 母版内部选中 → 退出，焦点在输入框、菜单、对话框里不触发）；自动退出：主菜单「视图 › 模式 › 评审」、窗口缩到 < 640（只在 `data.form` 为 auto 的状态里会变）、F5 / ⇧F5 / 「放映」（命令前置钩子先退出母版视图，再交给放映的处理函数或转到 `present.default`）。缩到紧凑形态、被降权都不退出。
- 恢复（会话记忆，只在内存里）：页、检查器页签、左栏缩略图列表或网格的滚动、放大后画布自己的滚动（`view-zoom` 的固定比例，缩放比例本身在场景仓里、进出都留着）、视图（URL 承担）；选区清空，焦点交给画布。进入时检查器回到「设计」、工具回到「选择」、停止跟随；状态声明的整栏面板（`inspector.takeover` 开着的，如保真报告）2026-11-04 起进入时不关、只在母版视图里不画，退出后恢复到进入前的样子（当前项、内容区滚动、展开的页码；放过的定位高亮不重放，DS-162），依附选中对象的整栏面板随选区清空收起、不恢复；焦点落在窗格里选中的那一行。可以进入时宿主先清掉还在显示的 ⌥⌘M 不可用轻提示（DS-163）；母版视图里普通视图的入口留在原位、不可用（DS-157）。这几处的做法见 §3g「拍板后的现状」。
- 退出时重新显示的整栏面板不抢焦点（焦点照常交给画布）；kit `canvasFocusTarget()` 在画布接不住焦点时（母版视图的画布外框、放大后的滚动画布没有 tabindex）返回画布列 main，关浮层、命令面板时焦点不再停在 body，普通视图的落点不变。
- ⌥⌘M 不可用时出轻提示「母版视图：〈原因〉」（3.5 秒，同一原因连按不另出一条；与状态里已在显示的轻提示叠放、新的在下，见下「补完」）；模态对话框开着时不响应；菜单或弹层开着时先收起再切换。
- 命令面板在每个编辑器状态原地打开（⌘K、主菜单「帮助 › 命令面板…」）：`command-palette` 场景的 layers 不再自己挂一份，状态用 `data.cOpen: true` 一出现就开着；面板里「母版视图」接宿主，母版视图里是「关闭母版视图」，不可用时写同一原因、↵ 只播报、面板不关；母版视图里「网格视图」「备注」「评论」三条写与主菜单同一口径的原因。

以上各处取法用户 2026-11-03 已按推荐项确认（rulings §4.25 DS-161…DS-169）；整栏面板与 ⌥⌘M 轻提示两处按确认的结果改过（见上）。

**修复第 1 轮（2026-10-28）**

- 有评论草稿时进出母版视图：⌥⌘M 或命令面板真要切换时（`closeOverlaysThen` 的 `switching`；不可用、只提示原因时不算），焦点在输入框里先直接交给画布（失焦即提交，不先失焦到 body），按下时焦点已在 body 上的同样先交给画布；从按下到切换提交由 `holdFocusDuring` 兜住，切换后宿主再交给落点。发一下 Esc 后浮层一点没变（写了内容的评论撰写框按设计不接 Esc）就不再空等，直接切换。
- 评论场景的 `DraftKeeper` 把母版视图当成离开了单页（同网格视图，TB-84）：写了内容的撰写框随进入收起、草稿按页留着，退出回到这一页时原样恢复、标成 `restored`——不抢焦点（焦点照常交给画布）、@ 候选不再弹出。
- 手机 / 平板的仅查看外壳（`comments/phone.tsx` 的 `PhoneViewer`、`TabletViewer`，状态写了 `toolbar.collapse`、没写 `data.form`）挂载期间用 kit `useViewOnlyMasterGuard(device)` 声明原因（`editor/master/mode.ts`，原因的先后仍由 `formReasonOf` 给）：手机「在更大窗口中编辑」、嵌入里「当前区域太窄，暂不可用」；平板「在电脑上编辑」，嵌入里也是。设备取外壳演示的那一种（状态的 `data.device`，`PhoneViewer` 缺省手机），与外壳顶部状态行同一口径，不看真实视口、不按状态 id。这些状态里 ⌥⌘M 说明原因，命令面板原地打开、「母版视图」写同一原因（查看者先看模式：「只有查看权限」）。
- kit `openOverlays()`（`kit/layer.ts`）：与 `overlayOpen()` 同一判据，返回开着的那些元素，`closeOverlaysThen` 用它判断最上面一层接没接 Esc。

**修复第 2 轮（2026-10-29）**

- `closeOverlaysThen` 判断「这一下 Esc 最上面一层接没接」时连浮层的子树一起比（`host.tsx` 的 `layerSnapshot`：开着的浮层取整棵子树，工具提示仍只取 `data-state`）。分享对话框的行内确认与邀请联想、导出对话框在等待同步 / 排队 / 生成中退回选项，这类 Esc 由浮层里面的子件接住，浮层自己的 `data-state` 不变：原来被当成「不接」，经命令面板执行「母版视图」时对话框没收起就切了过去；现在算「接了」，接着发下一下，对话框收起后再进入，焦点落在窗格里选中的那一行。写了内容的评论撰写框不接 Esc、子树不变，照旧发一下就切换。⌥⌘M 在模态对话框开着时仍不响应。

**修复第 3 轮（2026-10-29）**

- 母版视图里照画状态的 `canvasOverlay`，查找和替换面板这类画布浮动层随之带进母版视图；它们不是 Radix 浮层，`overlayOpen()` 认不出，原来第一下 Esc 越过面板直接退出母版视图、面板留到了普通视图（「转到第 N 页」提示条则是一下 Esc 同时清掉提示条并退出，退了两级）。
- kit `useCanvasEscape(active, take)`（`kit/layer.ts`）：画布浮动层开着时登记「这一下 Esc 接不接」（接住就收起并返回 true）。母版视图的宿主（`MasterModeKeys`）在 Radix 浮层、抽屉、整栏面板之后，母版内部选中与退出之前问它们（`takeCanvasEscape`，后开先问），接住就到此为止：第一下 Esc 收起查找面板、仍在母版视图，第二下才退出。由宿主在捕获阶段直接问，焦点在窗格选中行时自动弹出的工具提示不会先吞掉这一下。
- 登记的是 `find-view-undo/FindReplace.tsx` 的 `FindPanel`（接不接与它自己的 Esc 监听同一条判断）与 `find-view-undo/PageJump.tsx` 的提示条；普通视图里各层照旧由自己的监听处理，行为不变。只在焦点在面板里才接 Esc 的键盘快捷键面板不登记：焦点在画布上时 Esc 照常退出母版视图。
- 2026-11-04 转正后（DS-158、TB-204）：进入时这些画布浮动层各自收起、母版视图里不画；母版视图里再按 ⌘F、⌘/ 或敲数字打开的归母版视图，Esc 仍按上面的次序逐层收起，退出时一并收起（`useDismissOnMasterToggle`，见 §3g「拍板后的现状」）。

**修复第 4 轮（2026-10-29）**

- 不可用原因的先后按 50/11 §3：`masterEntryOf` 先看模式与权限，再看形态。原来状态显式写的 `rail.menu.master.reason` 排在模式之前，借用紧凑外框的状态在同一状态里切到评审后，三处都写「在更大窗口中编辑」；外壳的形态守卫与场景守卫一起按挂载先后排在显式原因之后。现在外壳守卫带 `form` 标记，排在显式原因之前（外壳知道自己是不是画在嵌入里）。
- `masterMenuOption` 以宿主的 `entry` 为准（显式传的 `master` 只补宿主没给的字段）：紧凑胶囊与抽屉的主菜单原来用显式写的形态原因盖住宿主的原因，切到评审后菜单写「在更大窗口中编辑」、⌥⌘M 与命令面板写「评审模式下不可用」。载入时没有哪个状态同时是紧凑形态又是评审 / 查看者 / 降权，不在嵌入里时外壳守卫与显式原因是同一句，编辑模式下的字不变。
- 会话记忆补上放大后画布自己的滚动（`MasterMemory.stageScroll`，`mode.ts` 的 `readStageScroll` / `writeStageScroll`）：单页视图里进入时读 `[data-v3-anchor="stage"]` 的 `scrollLeft` / `scrollTop`，退出提交后（重新挂载的画布按自己的初值复位之后）与左栏滚动一起写回；只在滚动过时写，适应窗口的画布不碰。

**补完（2026-10-29，第 5 轮复验之前；复验 1–4 轮的非阻断项里属于第一步的部分）**

- 第二步直接换件用得上的三处接口：`MasterViewImpl.entryFocus(scene, ed, target)` 与 `onEnter` 同参（「转到版式」带了占位符目标时，实现可以把焦点交给画布上那个占位符；适配层照旧返回窗格选中行）；紧凑形态的母版外框（`narrow/compact-features.tsx` 的 `MasterRailDrawer` / `MasterInspectorDrawer` / `MasterCompactStage` / `MasterCompactToolbar`）四块都经 `d` 取（`d` 在母版视图里就是登记的母版实现），不再直接引用 masters-themes 的件、也不往 `over` 里另塞窗格与检查器内容；`exit(via, { slides })` 退回网格视图时网格也画出这些页（底座 `GridView` 的 `selected`：与当前页同样的 2px 强调色环、页码不变色，同网格多选的已有画法），换页即清掉。画法不变。
- 「找不到场景状态」的页面按没有编辑器外壳处理（silent：⌥⌘M 不进入、不提示，命令面板不挂）。
- 底座工具条的图片 / 表格 / 图表弹层开着哪一个记在场景仓（`editor/Toolbar.tsx` 的 `TOOL_MENU_KEY`）：状态的 `toolbar.menu` 是演示初值，只在载入后第一次读取时生效，宿主进出母版视图时与形状弹层一起收起；母版往返后工具条重新挂上不再按初值弹出（同「单页 → 网格 → 单页」往返）。
- 命令面板在母版视图里：「单页视图」与「幻灯片」一组（新建、复制、更换版式、隐藏、上移、下移）同「网格视图」写「母版视图下不可用」、↵ 只播报。
- ⌥⌘M 的轻提示 3.5 秒；显示期间宿主在画布列 main 上写 `--v3-toast-push`，kit `Toasts` 缺省落点的其余几叠整体上移，新的这条在最下面。宿主把焦点交给画布时与 kit `canvasFocusTarget()` 同一落点（放大后的滚动画布没有 tabindex，交给画布列 main，退出后不再在滚动画布上画焦点环）。

**修复第 5 轮（2026-10-30）**

- 紧凑形态里抽屉开着时退出母版视图：抽屉由形态外框在进出母版视图时收起（`narrow/form.ts` 的 `useCloseDrawerOnMasterToggle`），收起后胶囊上的「显示幻灯片列表」「显示检查器」重新挂上；原来它们按场景仓的 `narrow.handoff`（用户点开抽屉时置真）自动聚焦，把宿主刚交给画布的焦点抢走。现在进出母版视图收起抽屉时一并把 `handoff` 复位为 false（同图表数据、投票两个底部 Sheet 收起抽屉时的做法）：焦点照常由宿主交给落点（退出：画布；进入：窗格里选中的那一行）。用户自己点抽屉角上的「收起…」或按 Esc 收起抽屉时照旧把焦点交给胶囊上的开关。

**修复第 6 轮（2026-10-30）**

- 网格视图一侧进出母版视图时同样收起抽屉、复位 `handoff`。原来「开关变了」由每块外框自己的 ref 记着，只有切换前后都挂着的一块看得到：从网格进入时宿主按单页结构画，单页的外框（`StageRegion`）在这次提交里才挂上；退出回网格时单页的外框（`StageRegion`、`MasterCompactStage`）随之卸下、换成网格的外框（`GridRegion`），钩子都不执行——母版窗格抽屉留到之后回单页时自己弹开、焦点被胶囊上的开关拿走，开合过抽屉之后经网格进入、再缩到紧凑时焦点也被开关抢走。现在 `useCloseDrawerOnMasterToggle` 把收过时的开关记在场景仓（`narrow.masterSeen`，一条当作共用 ref 用的记录：只在布局副作用里读、改，改写不通知订阅者、不多画；第一次读取时记下当时的开关，载入不算一次进出），单页与网格两块外框都调用它：这次提交里新挂上的一块也看得到「开关已变、还没收」，补做一次；先执行的一块收过了，后面的读到新值、不再重复。切到评审时工具条换成底座缺省，不靠工具条的外框。只看运行时的开关，不按状态 id；普通视图里单页 / 网格往返、跨断点的行为不变。

## 3g. 母版视图按标杆重做（2026-10-30，母版视图改版第二步）

用户 2026-10-23 选「按标杆重新设计母版视图」（rulings §4.25 DS-144；标杆：PowerPoint 幻灯片母版、Google Slides「编辑主题」、Keynote「编辑幻灯片版式」）。第二步把第一步的适配层换成按推荐方向「同壳上下文条 · 点哪编辑哪」重做的件，宿主（`Editor.tsx`）与两份契约（`editor/master/types.ts`、`EditorCtx.masterView`）不动。画面以设计 03-26 为准，实现要点见前端 50/11。下面是母版件、数据键与对比变体的用法；新状态一览接在本节末尾，2026-11-04 转正后的改动见本节末「拍板后的现状」。

**登记处与件**（`masters-themes/`；除 `ThemeParts.tsx` 的「主题颜色与字体」两种视图共用外，都是母版视图里才画的件）

- `master-impl.tsx`：原地重写为第二步母版件的登记处（仍仅演示、不迁移）——`Rail` 用窗格 `MasterPane`，`Banner` 用上下文条 `MasterContextBar`，`Inspector` 的「设计」页签用 `MasterInspectorBody`，`Toolbar` 用 `MasterToolbar`，`Overlay` 用 `MasterOverlay`；`onEnter` / `onExit` 清运行时键，`onEscape` 的先后：拖拽中 → 工具态回到「选择」→ 提示文本编辑 → 焦点在窗格时交给画布外框 → 取消占位符 / 形状选中 → 交回宿主退出。`Rail` 不写主菜单的配置 `menu`：状态的 `rail.menu`（如集成方没配帮助链接的 `helpConfigured: false`）在母版视图里原样生效，「视图 › 关闭母版视图」由底座主菜单按宿主的 `masterView` 给。
- `MasterChrome.tsx`：上下文条（「母版视图 ┊ 对象 ┊ 说明」，说明段放不下时整段换到第二行、与对象段左缘对齐，换行时它前面的竖分隔不画；出现时是 kit 横幅缺省的播报区、念一次，之后对象段或说明段随用户自己的操作（如窗格里换选中）改了，就换成 kit 横幅的不播报写法，不再整条重读）、工具条（「占位符 ▾」排第 2，菜单图标是虚线框里叠类型图形的 `PhTypeIcon`，「已包含」按当前对象上的占位符算）、检查器内容（顶行最多两行：权限行 + 对象行；面板标题只写类型）、`MasterOverlay`（轻提示、母版键位 P / T / S / ⌘M / ⌘D、删除确认框）、确认框件 `DeleteLayoutDialog({ layout })` / `DeleteLayoutsDialog()` / `DeleteMasterDialog({ master })` / `ExportUnusedDialog()`（文案的页数、页码、名称都由数据算）、`MasterHintDemo`、`EntryMenu`。
- `MasterRail.tsx`：窗格 `MasterPane`（listbox 键盘、就地改名、拖拽重排与在场头像、加载行与失败行）、`masterRailNewLayout(v)`（「新建版式 ▾ / +」；底座左栏这一行不接动作，窗格在 document 上接点按）、右键菜单的条目 `layoutMenuItems(layout, v)` / `masterMenuItems(master, v)`（「保留母版」是自画的勾选条目；版式行菜单里的「插入版式」「复制版式」做完后焦点跟着新的选中行，同窗格里按 ⌘M / ⌘D 与同一菜单的「删除版式」）。状态里写 `layers: <LayoutContextMenu layout="…" />` / `<MasterContextMenu master="…" />` 即「载入后这一行的右键菜单开着」：它只写场景仓的菜单键，菜单由窗格画，与指针右键、⇧F10 同一份。窗格行的名称（版式行与母版行）均衡折行：折成几行时各行字数相近，末行不会只剩一个字，不截断、不加省略号；浏览器的均衡算法管不到的长名称（行数多到它不再均衡）、末行又只剩一个字时，这一行改用避免孤字的折行——由画出来的末行判，名称、字重或宽度变了重新判。
- `master-sections.tsx`：检查器分区（版式 / 母版 / 占位符 / 多选，节序同普通视图「版式 → 主题 → 背景」）、顶行件 `TopReason`、名称整段不断行的 `keepQuoted` 与按词组换行的 `phrases`。「名称」字段的红字说明由分区自己画（字段只拿布尔值画红色描边，输入框指向说明行），出现、消失红字时输入框不重新挂载，焦点留在字段里。字号、颜色等文本样式取画布实际的画法（`mv-state` 的 `textStyleOf`），不写死。选中母版上的普通形状（`mvShapes` / `mvShapeSel`）时检查器是底座「矩形」的分区与节序，其中位置与大小、快速样式、填充按这个形状的输入算（`withMasterShape`：框换成 pt，同画布上的尺寸角标；填充取画布同一个内容 token；输入里没有主题样式时写「未套用样式」），状态里不用写 `inspector.sections`。
- `MasterStage.tsx`：画布（几何、标注层、选中与角标、多选卡片、加载与失败）。标注层的类型名同一画面只用一种落位：先试全部写在框外上方（下沿离框 2），放不全时再试全部嵌在上边框，取能全部放下的那一种，都放不全时取放下最多的那一种；横向先左（框左缘 + 8）后右（框右缘 − 8），左边碰到品牌短线这类母版图形或角标时靠右；放不下的那几枚不画，也不改用另一种落位。标注层等量到的几何稳定了再定落位：系统开了「减少动态效果」时全局给每个元素 1ms 的过渡（`index.css`），量的对象（内容层、选中框、锁签）上还有过渡在跑就等它们结束再量，不靠固定延时；换对象（窗格换版式或母版）时 `LayoutArt` 的内容层与标注层都换一组新节点；字号覆盖去掉（「重置为母版值」）或主题预览换了字体时标注层也重量。M2 锁签与类型名同一遍定落位（`lockPlan`）：框里左下 → 框里右下 → 框下方（先靠左、再靠右）→ 框上方（先靠左、再靠右），取第一个不碰撞的；外扩 2 后碰到别的框线、任何一行提示文字、母版图形与普通形状、角标或出了幻灯片就算碰撞，框里的两个落位还要框放得下（高、宽各不小于锁签加 2 × 4）；都碰撞就不画，原因仍在上下文条与检查器顶行。类型名给锁签让位，压到的图标条省去。`mv-state.ts`：`useMasterView()` 与全部规则函数（`mvReasonOf`、`contextObjectOf`、`contextDetailOf`、`deckUsage` / `usageOf`、`selectionAfterDelete`、`renameErrorOf`、`toastTextOf` 等）。键盘——选中一个占位符、焦点在画布外框或这个占位符自己的点选区上时按 Enter，进入提示文本编辑，插入符落在文本末尾（画出来的最后一段），级别跟随同双击；M2、降权、继承项不进入，原因（与双击同一判法）写进画布外框里的读屏播报区；编辑中再按 Enter 不再进入；焦点在别的占位符点选区上时 Enter 仍是选中它。退出编辑仍是 Esc。选中的占位符不再画标注层的灰色框线，由选中框画在同一个框上（同普通对象）。双击不可编辑的占位符（M2、降权、继承项）同样不进入，原因与 Enter 同一判法、同一句子（`startText` 不进入时交回这一句），写进同一个读屏播报区。多选画布上点按卡片（或焦点在卡片上按 Enter、空格）回到单选时，先把焦点交给画布外框 `stage` 再换回单张幻灯片，焦点不经过页面本身。轻提示「撤销」恢复选中时，先结束删除时起的焦点保持，焦点随后交给画布外框（删除后 1 秒内、1 秒后按都一样）。
- `ThemeParts.tsx` 的 `ThemeControl`：「主题颜色与字体」两种视图一律盖在检查器栏上、宽随检查器（DS-155）；只有对比场景写 `mvVariant.themePop = "anchor"` 时画未采纳的原画法（原：贴「调整主题」向左、定宽 300）。另有 `disabledReason`（母版视图 M2：卡片只展示、「调整主题」留在原位不可用）与 `adjustTipOpen`。kit `Popover` 加了可选的 `cover="inspector"`，不传时位置、尺寸与 DOM 都同原来。盖检查器栏时，弹层从页签行下沿一直铺到检查器栏底（与视口下沿取小，高不随内容缩短），检查器原有内容一处都不露；这时 `ThemeEditor` 是纵向三段——页头（标题 · 颜色 / 字体）与底栏（说明 · 取消 · 应用）固定，中间的色槽、编辑区或字体在弹层里滚动，底栏贴弹层底。弹层贴窗口的角与页签行下的那个角都不圆，只画左边线（与检查器的栏分隔线同一列像素），浮层阴影照旧。紧凑抽屉里同一规则。盖检查器栏时页头、中间区与底栏的左右内距取检查器节内容的同一个类名（与 `ui.tsx` 的节、检查器页签行一样），弹层页头标题与下面检查器节标题左缘对齐；分隔线随之伸到弹层两边。底栏放不下「说明 · 取消 · 应用」一行时（检查器 240 宽，或说明是较长的「改动会实时预览…」时的紧凑抽屉），两枚按钮照原口径一起换到下一行、靠右；「字体」页的说明拆成两个短句、各自不断行。定宽画法只留给对比场景的原位置。
- 底座的几处：`editor/layouts/LayoutArt.tsx` 加两种画法 `prompts="canvas"`（母版画布的内容层：不画框，内容盒带 `data-mv-ph`，文本每一级一段、带 `data-mv-level`）与 `prompts="thumb"`（同一份内容 + 一种细线框，放不下的行整行不画；用于窗格与多选卡片，2026-11-04 起也用于普通视图的版式画廊、「版式」字段与重置确认，DS-149），参数 `omit` / `shapes` / `override` / `boxes` / `name` 只对这两种生效；`thumbFrames` 缺省 `line`，`none` / `legacy` 只给对比场景的缩略图对照板。`prompts="master"`（改版前的版式缩略画法）转正后没有调用方，留着、产品迁移不带。`LEVELS` 原样，另起数值表 `LEVELS_META`（两张表是否一致由第二步的检查脚本读源码自检）；新建页内容占位符提示的数值表 `SLIDE_BODY_PROMPT_META` 同一做法。`editor/layouts/data.ts` 加新文档的缺省母版 `NEW_DOC_MASTERS` 与 4 种版式种类（`MASTERS` 不动）；2026-11-04 再加 2 种版式种类「内容与图片」「两栏内容与图片」（只在场景自带的母版里，几何在 `LayoutArt` 的 `placeholdersFor`）、场景母版的取法 `mastersOfSet` 与拼版式定义的 `layoutDef`，见「拍板后的现状」「转到版式」一条。`editor/inspector/builtin.tsx` 的 `BG_TYPES_FOLLOW` 四项都是图标（「跟随母版」用母版视图的图标）。`editor/master/mode.ts` 的 `MASTER_VIEW_ICON` 是母版视图的图标（上下文条、背景「跟随母版」、普通视图「编辑版式」共用这一处）。`thumb` 画法的内容盒在块方向（横排上下、竖排左右）多留一截裁切边（这个占位符里最大一段字号的一半，至少 1 px），排版仍按占位符框（整行取舍不变）：极小的缩略图里中文字顶会越出框一点，不再被削平。`thumb` 画法的框线在块方向的起始一边（横排是上边、竖排是右边）画在框外、与框隔开半个像素，其余几边仍在框内：极小的缩略图里标题与首行文字的字顶不压线，并排的框之间照旧留空。普通形状的填充 token 表 `ART_FILL_TOKEN`（画布与母版视图检查器「填充」同读）。`BackgroundControl` 版式「跟随母版」时颜色字段的不可用原因：整节不可用时取那一句（如 M2），本来可编辑时才写「改成「纯色」等方式后可改颜色」。

**状态怎样写**（母版视图里的演示态与入口态；各态的画面见设计 03-26 §6）

- 载入即在母版视图的状态沿用场景级 `masterView: { open: true }`，在 `data` 里写下表的键（只写输入）。右键菜单与确认框写成种子件放进 `layers`：`<LayoutContextMenu layout="office-title-only" />` / `<MasterContextMenu master="office" />`（载入后这一行的右键菜单开着；没选中这一行时先单选它）、`<DeleteLayoutDialog layout="office-title-only" />` / `<DeleteLayoutsDialog />`（读当前多选）/ `<DeleteMasterDialog master="office" />`（载入时确认框开着，关掉一次后进出母版视图不再自己弹出）。文案里的页数、页码、名称、版式数都由数据算，状态里不写。
- 母版视图里的轻提示写 `data.mvToast`（种子：一出现就在、不自己收起），不往 `canvasOverlay` 里放；应用主题后的「已应用主题「X」，影响 N 页」也由 `MasterOverlay` 画（N 取当前母版的用量）。
- 删除演示态（删除之后选中谁）只写删除前的选中 `mvSelBefore` 与 `mvRemoved` / `mvToast`，不写 `mvPane`、不写 `selection`：选中由规则算出，`MasterOverlay` 挂上时按算出的选中对齐一次编辑器的选中种类。
- ⌥⌘M 不可用的演示：不可进入的普通视图态写 `canvasOverlay: <MasterHintDemo />`（只在宿主的 `masterView.entry.ok` 为假时请求进入，提示文案由宿主按原因给）。
- 普通视图态（入口、导出前提示等）一律从底座 `NORMAL` 起写，再叠自己的字段：

  ```ts
  /** 母版视图场景的场景级配置是母版视图的（selection: KIND.layout、masterView.open: true）；mergeConfig 对状态没写的顶层字段沿用场景级的值 */
  const NORMAL: EditorConfig = { selection: "none", masterView: { open: false } }
  // 例：{ id: "export-unused", editor: { ...NORMAL, data: { mvPreserve: { simple: false } }, layers: <ExportUnusedDialog /> } }
  ```

  不从它起写时，普通视图的检查器按「版式」种类取分区，画出母版视图的「版式」分区。`ExportUnusedDialog` 就是这样的普通视图态用的：取「保留母版」关闭且没有页面使用的母版，一个都没有就不出。

**数据键**（状态 `data` 里只写输入；页数、页码、名称、原因、可用与否、删除之后选中谁一律由规则算出）

| 键 | 含义 |
|---|---|
| `mvPane` `mvPh` `mvMulti` `mvStatus` `mvM2` `mvRemoved` `mvUnsaved` `mvPhMenu` | 窗格选中、选中的占位符、多选、加载状态、M2、已删的版式、未提交改动、「占位符 ▾」菜单开着（同第一步） |
| `mvOverride` | `{ ph, level, size }`：版式上覆盖的字号（pt），画布、缩略图与检查器一起体现；「重置为母版值」后不再生效 |
| `mvSelBefore` | 删除前选中的版式（删除演示态不写 `mvPane` / `selection`，选中由规则算） |
| `mvMasters` | 数据集：`default` 示例文档的两个母版 · `new-doc` 新文档的缺省母版（11 个版式）· `single` 只留首个母版；或直接给一份母版清单（场景自带的母版，如 text-edit 的 `TEXT_EDIT_MASTERS`，场景级写一次）。普通视图的版式画廊、「版式」字段与按页认版式（`layoutOfSlide`）读同一份（`editor/layouts/data.ts` 的 `mastersOfSet`） |
| `mvNames` `mvRename` | 改名（空串即「未命名版式 n」）/ 就地改名进行中的输入 |
| `mvPreserve` | 「保留母版」（缺省：导入的母版为真） |
| `mvDrag` `mvPresence` | 拖拽重排进行中 `{ id, to, at }`（跨母版是否禁止由数据算）/ 在场 `{ layout, who }[]` |
| `mvMove` `mvRemote` `mvCaret` `mvMenu` | 拖动占位符中 / 他人改了一个几何字段 / 提示文本编辑的插入符级别 / 检查器里展开的下拉（`ph-type`） |
| `mvShapes` `mvShapeSel` `mvRemovedPh` | 母版、版式上的普通形状与其选中 / 已删的占位符 |
| `mvToast` | 轻提示种子（`deleted` `reassigned` `ph-removed` `committed` `limit` `remote-deleted` `theme-applied`；文案由数据算） |
| `mvTip` | 演示：某个工具提示一出现就开着（`edit-layout`、`theme-adjust`） |
| `mvVariant` | 打开未采纳的备选画法，只在对比场景里写（DS-63、DS-173）：`bar`（`toolbar` = 工具条末端的模式段）· `scope`（`segment` = 上下文条里的范围分段）· `ph`（`hover` / `legacy`）· `themePop`（`anchor` = 原位置） |

**对比变体**（`data.mvVariant`，只在对比场景 `master-view-options` 里写，打开未采纳的备选画法；推荐画法一律不写，实现以推荐状态为准，DS-63、DS-173）

- `bar: "toolbar"`：不画上下文条（横幅通道空出来），工具条末端加模式段「母版视图 · 完成」（「完成」= 关闭母版视图），检查器面板标题下多一行说明（同上下文条的说明段）。
- `scope: "segment"`：上下文条的对象段前加「版式 │ 母版」分段（编辑范围（DS-146 作废的范围单选）独立于窗格选中项，窗格选中版式、范围切到母版时母版行写「正在编辑」；窗格选中母版时「版式」档原位不可用）；对象段与降权说明用原句。
- `ph: "hover"`：本版式的框不写类型名、选中时框上方贴一枚类型标签（下沿离框 4，按「左对齐 → 右对齐 → 居中」取第一个不碰撞的，左右对齐时离框角留出手柄的宽（按画出来的手柄取，没有手柄时贴框角）：碰到母版图形与普通形状、角标、别的框线、提示文字首行或出了幻灯片就换下一个，都碰撞就不画；类型名给它让位）；`ph: "legacy"`：本版式实线、继承项虚线加框外「母版 · 类型」，幻灯片右上方外侧画图例。
- `themePop: "anchor"`：「主题颜色与字体」画在原位置（原：贴「调整主题」向左、定宽 300，盖住画布右侧）。

**不变式**

- 普通视图里随转正改的件（2026-11-04）：检查器「版式」节标题右侧有「编辑版式」，版式画廊、「版式」字段与重置确认的缩略是 `thumb` 画法，「主题颜色与字体」盖检查器栏，快捷键面板列出母版视图的三行；kit `Popover` 不传 `cover` 时同原来，检查器与紧凑胶囊的缩放读数在普通视图里仍量 `slide`（母版视图里量 `master-view.slide`）。
- 母版视图里幻灯片与普通视图缺省几何同大，只下移横幅通道的高度（画布外框同普通视图，下面放一块与备注区同高的隐形占位，按 `--v3-banner-h` 往上让）。
- 母版视图的件只在母版视图里画（导出前提示的 `ExportUnusedDialog` 与 `MasterHintDemo` 是放进普通视图态的两件），读的数据键都以 `mv` 开头；普通视图的状态不用写它们（「转到版式」读的是 `data.placeholder`，见本节末）。例外是 `mvMasters`：场景自带母版时普通视图也读它（版式画廊、「版式」字段、「转到版式」与进入后的母版视图同一份），如 text-edit。

**锚点与 DOM 标记**（检查脚本可以依赖）：`master-view.slide`（母版画布的幻灯片框）、`master-view.ph-<占位符 id>` / `master-view.shape-<形状 id>` / `master-view.card-<版式 id>`（点选区与多选卡片）、`master-view.layout-<版式 id>` / `master-view.master-<母版 id>`（窗格行，另带 `data-mv-row`；行里的缩略图带 `data-mv-thumb`）、`master-view.new-layout` 与 `master-view.new-layout-plus`、`master-view.tool-placeholder`、`master-view.edit-in-master`、`master-view.view-in-normal`、`master-view.ph-type`、`master-view.theme-card` / `master-view.theme-adjust`；标注层的 `data-mv-label`、`data-mv-obstacle`，canvas 画法的 `data-mv-ph`、`data-mv-level` 与 `data-mv-graphic`（母版图形与普通形状；类型名不压在它们上面），thumb 画法的 `data-layout-art="thumb"`。画布外框 `stage` 里的读屏播报区 `span[role="status"]`（只在就绪、单选时画；Enter 或双击进不了提示文本编辑时写原因）。对比场景里未采纳的备选 1 选中时的类型标签带 `data-mv-hover-tag`（幻灯片框的直接子元素）；M2 锁签的落位层带 `data-mv-lock`，对读屏隐藏（同标注层的框线与类型名，原因由检查器顶行与画布外框的读屏播报区给；都碰撞时不在页面上）。

**新状态一览**（第二步新增 33 态；原有 22 态的 id 不变，画法换成上面的件——`context-menu`、`master-context-menu`、`delete-confirm`、`delete-master-confirm` 的静态菜单与确认框换成种子件，`delete-undo` 改写删除前的选中 `mvSelBefore` 与轻提示 `mvToast`，`unsaved` 加 `mvMove`，紧凑母版外框不再为范围行让出 28）

- 入口（普通视图态，从 `NORMAL` 起写）：`master-view.entry-inspector`（检查器「编辑版式」）· `goto-layout`（占位符检查器顶行「转到版式」）· `from-grid`（网格胶囊的主菜单）· `entry-blocked`（评审模式下按 ⌥⌘M 只出一条原因）· `shortcuts`（快捷键面板里母版视图的三个键）。
- 菜单与面板：`master-view.view-menu`（主菜单「视图 › 关闭母版视图」）· `help-menu`（「帮助 › 关于母版继承」）· `palette`（命令面板里的「母版」类命令，`command-palette/commands.ts` 的 `MASTER_COMMANDS`，只在母版视图里列）。
- M2：`master-view.m2-default` · `m2-edit-master` · `m2-inherited` · `m2-theme`（数据 `mvM2` + `inspector.share: SHARE_LATER`）。
- 编辑：`master-view.master-text-level`（提示文本编辑与级别跟随）· `placeholder-more`（「类型」下拉、方向与大小）· `master-shape`（母版上的普通形状：右侧整高的品牌浅色竖条，选中后检查器是普通形状的分区）。
- 窗格：`master-view.new-doc`（数据集 `new-doc`）· `long-names`（长名与未命名）· `rename-inline`（就地改名）· `reorder` / `reorder-blocked`（拖拽重排、拖到别的母版）· `readonly-menu`（降权时的右键菜单）· `single-master-menu`（只剩一个母版）。
- 删除与提示：`master-view.multi-delete-confirm` · `delete-reassigned` · `delete-placeholder` · `committed` · `limit-toast`。
- 协同：`master-view.presence` · `remote-deleted` · `remote-updated`。
- 导出：`master-view.export-unused`（普通视图态，从 `NORMAL` 起写）。
- 紧凑与仅查看：`narrow.compact-master-inspector`（视口 1000 × 760，检查器抽屉；外框同 `compact-master`，网格一侧沿用场景级外框）· `narrow.viewonly-master-key`（视口 390 × 844，仅查看形态按 ⌥⌘M，挂 `MasterHintDemo`）。
- 不按 1600 × 1000 截的新状态有三个：上面两个与对比场景的 `master-view-options.bar-toolbar-compact`（视口 1000 × 760）；截图、版面扫描都按各自视口（登记在 `S/final-sweep/vp.js`，键「场景.状态」）。

**对比场景** `master-view-options`（14 态）：推荐与备选并排的对照，照 DS-63 保留（DS-173）：没有采纳的状态标题前加「未采纳 · 」、说明开头写由哪条 DS 定为推荐，推荐的状态说明写「已采纳」与同一画法的状态；只写对比变体 `mvVariant`，两个普通视图态取被对照状态的整份配置；各态的画面与结论对设计 03-26 §6.9，转正时的改法见下文「拍板后的现状」。

### 拍板后的现状（2026-11-04 转正，rulings §4.25 DS-144…DS-177）

用户 2026-10-23 选按标杆重做母版视图（DS-144，未采用推荐）；2026-11-02 至 11-03 逐题拍板第一步与第二步的 42 题，均按推荐（DS-145…DS-172）；回写中 2026-11-04 又裁决五题，均按推荐（DS-173…DS-177）。总编排定技术口径 TB-186…TB-210。样张随之转正：落到普通视图的五项提议改为缺省、删去提议开关；拍板用的对比场景照 DS-63 保留；补做拍板时选定、样张原来没画的几处——母版视图里普通视图的入口不可用、浮动层进出时收起，以及第一步复验时提出、2026-11-03 一并确认的几条。画面以设计 03-26 为准（对比画法见 03-26 §6.9），入口与宿主的行为以前端 50/11 §2、§3 为准。

**五项提议改为缺省**（提议开关 `editor/master/proposals.ts` 与 kit 的转出删去，状态数据里不再写开关；40/10 §3a 登记已删）

- 「编辑版式」（DS-147）：检查器无选中时「版式」节标题右侧的 24px 动作，图标同上下文条（`MASTER_VIEW_ICON`，TB-186），工具提示「编辑版式 ⌥⌘M」；点了进入母版视图并选中本页的版式。可编辑、`disabled`、只读三条分支画在同一个动作位，可用与否与原因取宿主的 `masterView.entry`，与主菜单「母版视图」同一条；只读展示（评审、查看者、降权）时也留在原位、不可用（DS-15 的例外）；没有母版视图入口（`entry.silent`）时整个动作位不画。kit `useEditLayoutAction(layout)`（`editor/layouts/LayoutGallery.tsx`）给内置分区与状态私有的「版式」节变体共用（offline-conflict 软冲突 I 的 `LayoutRemoteSection`）。
- 「转到版式」（DS-147、DS-174、TB-205）：只在选中对象本身是占位符形状时出——空占位符，以及来自版式占位符的标题与文本框（含正在编辑文字）；填进占位符的表格、图表、图片与媒体按各自对象的分区，不出这一行。检查器顶行由分区 `INHERITANCE_NOTICE_SECTION`（`masters-themes/slide-sections.tsx`，种类 `placeholder-empty` 与 `text`）按状态数据 `placeholder` 画；版式按状态数据里的母版找（与进入后窗格读同一份），文档里找不到这个版式时整行不画。选中文本时，状态只写「哪一页、版式上哪个占位符」（`text-edit/inspector.tsx` 的 `placeholderOrigin(页, 占位符 id)`），类型、索引与版式名由版式数据算；同时选中同一版式的几个占位符时只写版式，点「转到版式」只选中版式。文本这一类画到 16 个文本态：text-edit 12 态（编辑中、列表、字体、颜色、链接等）、insert 两态、`context-menu.text` 与 `offline-conflict.conflict-same-text`；空占位符这一类画到 `master-view.goto-layout` 与 text-edit 的 5 个空占位符态（选中、图标条键盘焦点、窄栏折叠、表格网格、评审只读；评审只读一态照画、动作不可用并写原因）。text-edit 用场景自带的母版数据：场景级 `data.mvMasters` 写 `TEXT_EDIT_MASTERS`（`text-edit/pages.tsx`：示例文档的两个母版，Office 母版末尾多第 7 页用的「内容与图片」「两栏内容与图片」）；这两个版式的几何在 `LayoutArt` 的 `placeholdersFor`（框取第 7 页画面上的占位符，「内容与图片」左内容的高取版式值 348，第 7 页上改成了 360），种类在 `editor/layouts/data.ts` 的 `LayoutKind`。空占位符那几态的「转到版式」、第 7 页的「版式」字段（原来按回退写「标题和内容」，2026-11-04 起写「内容与图片」）、点「转到版式」进入后的母版视图（窗格是这份母版、多这两个版式，选中对应的版式与占位符，用量算到第 7 页）都按它画；`layoutOfSlide` 与母版视图的用量（`deckUsage` → `slideLayoutId`）按场景的母版认，text-edit 里版式画廊的 Office 组也多这两个版式。全局示例母版 `MASTERS` 不动（母版视图各态仍是 7 个版式，别的场景里版式画廊仍是 12 张卡）。
- 版式缩略（DS-149、TB-191）：版式画廊卡片、「版式」字段的 32 × 18 缩略与重置确认的预览一律 `prompts="thumb"`，同母版视图窗格（同一份内容 + 一种细线框，放不下的行整行省去）；新建幻灯片的画廊是同一张卡片，一起变。
- 「主题颜色与字体」盖检查器栏（DS-155、TB-193）：普通视图与母版视图同一画法；`ThemeControl` 去掉 `placement` 参数，只有对比场景写 `mvVariant.themePop = "anchor"` 时画原位置。「字体」页的说明在盖栏的宽度里拆成两个短句，各自不断行（宽够时仍是一行）。
- 快捷键面板的母版视图三行（DS-150 ②、DS-152、TB-196）：「插入版式（母版视图）⌘M」在全局组「新建幻灯片」之后，「占位符（母版视图）P」在工具组末尾，「复制版式（母版窗格）⌘D」在左栏缩略图与网格组「复制幻灯片」之后；写在 `shortcuts/data.ts` 的 `BUILTIN_GROUPS`，`builtinGroups` 不再收 `masterRows`。开始页的静态表同样列出；搜「母版」列这三行与「母版视图」。
- `goto-layout` 图标条的位置：`GOTO_PROMPT_PT` 由 `LayoutArt` 新建页画法的数值表 `SLIDE_BODY_PROMPT_META` 算出（上内距 + 两行字号 × 行高 + 行间，换成 pt，约 84.9），不再写死 88。

**对比场景照 DS-63 保留**（DS-173）

- `master-view-options` 的 14 态与路由不变：没有采纳的标题前加「未采纳 · 」，说明开头写「未采纳：DS-x 定为推荐（〈推荐状态 id〉）。」；推荐的标题不变，说明开头写「已采纳（DS-x），与 〈状态 id〉 同一画法。」；「缩略图三种」写明第 1 列已采纳、第 2、3 列未采纳，板上的列标题保持对比时的写法（「现画法」指改版前的画法）。场景标题与 id 不改，`summary` 写推荐已采纳、备选照 DS-63 保留。
- 未采纳的画法只由对比变体 `mvVariant` 打开（见上文「对比变体」），推荐画法不写它，实现以推荐状态为准。备选的代码路径都留着：`ScopeSegment` 与 `mvScope`、`MV_KEYS.scope`，工具条模式段，`tagPlan`、`Legend`、实线与 `outsideOnly`，`ThumbFrames` 的 `none` / `legacy`，`ThemeControl` 的原位置与 `ThemeEditor` 的定宽画法。
- 两个普通视图态（`gallery-thumbs`、`theme-normal`）取被对照状态的整份配置，采纳的画法就是缺省，不另写开关；它们随普通视图一起多了「编辑版式」（`theme-normal` 里被弹层盖住）。

**母版视图里普通视图的入口留在原位、不可用**（DS-157、DS-177、TB-200、TB-203）

- 主菜单「文件 › 保真报告」「编辑 › 重置页…」与顶层「插件…」、文档菜单「版本历史」，以及命令面板的同名四条（「常用」里的「版本历史」同样）：置灰，写「母版视图下不可用」；选了不跳走、不开面板，命令面板里 ↵ 只播报、面板不关。同时又被降权时也写这句，其余编辑项仍写「需要编辑权限」。判定分别在 `kit/mainMenu.tsx`（`offInMaster`：按条目 id 处理，状态自己传的「文件」「编辑」条目同样生效；原因常量 `UNAVAILABLE_IN_MASTER`）、`editor/chrome.tsx`（`docMenuEntries` 的 `inMaster`，左栏、网格胶囊、紧凑外框都经 `DocMenu`）与 `command-palette/CommandPalette.tsx`（`IN_MASTER_REASON`，排在 `reasonFor` 之前）。
- 头像组的「跟随」（检查器协作行与紧凑胶囊）：外观不变——身份色不变灰，只去掉悬停外圈；`aria-disabled`，读屏名「跟随 〈姓名〉（母版视图下不可用）」，工具提示「跟随 〈姓名〉 · 母版视图下不可用」，点了不跟随，母版视图里也不画跟随中的外圈。「+N」在线列表各行同此（`main-states/panels.tsx`、`presence-scale/people.tsx`）：行的外观不变、只去掉悬停底色，读屏名在原来的后面加「（母版视图下不可用）」，工具提示朝左弹向画布；列表底部的说明在母版视图里写「母版视图下不能跟随协作者」（普通视图仍是「点按协作者即可跟随其视图」）。三处读同一个判定 `useFollowOffReason()`（`editor/chrome.tsx`）。在线列表按初值开着的（载入即开着；进出母版视图时检查器整块换过、头像组重新挂上，列表按缺省开合重开，DS-169）不把焦点移进列表，焦点照 DS-166 落在窗格里选中的那一行；用户点「+N」打开的照常移进第一行（`editor/chrome.tsx` 的 `Collaborators`）。kit `EditorFollow` 在母版视图里不画跟随条与画布外框（兜底：宿主进入时已停止跟随，DS-167）。

**浮动层进出时各自收起**（DS-158、TB-204）

- 钩子 `useDismissOnMasterToggle(active, dismiss)`（`editor/master/mode.ts`，kit 转出）：画布上的浮动层声明「这一层开着没有」与「怎么收起」，从普通视图进入或退出母版视图时自己收起；只改开关、不交还焦点，焦点由宿主在同一次提交里交给落点。首次挂载不算（载入即开着的演示态照常开着），切换那次提交里才挂上的件也不算；不在编辑器里（开始页上的同一个件）时什么都不做。
- 接了它的：kit `Toast`（含带「撤销」的）、查找和替换面板（`find-view-undo/FindReplace.tsx`）、跳页提示条（`PageJump.tsx`）、键盘快捷键面板（`ShortcutsHost`）、`_kit` 的示例查找浮动条。按场景状态画、同一位置复用的轻提示宿主另在自己那一层清掉驱动它的状态（`LayoutToasts`、`ChartToasts`），否则往返之后同一位置的下一条画不出来；不靠补 `onClose`（给了 `onClose` 的 kit 轻提示会多画一个 ×）。保真的页级提示条在母版视图里按「不在单页」处理（`fidelity/canvas.tsx` 的 `PageChip`）；整栏面板收起后的「重新打开」（`_kit.takeover`）在母版视图里不画。
- 主题轻提示（场景仓 `masters.theme.toast`，两种视图各画一份）：母版实现的 `onEnter` / `onExit` 清掉它，普通视图的 `ThemeToast` 在母版视图里不画。
- 母版视图里再按 ⌘F、⌘/ 或敲数字打开的归母版视图，Esc 照 §3f「修复第 3 轮」的次序逐层收起，退出时一并收起；退出后普通视图不再弹出进入前开着的这些层（同 DS-169）。离开确认、导出等对话框的宿主不受影响，状态的 `canvasOverlay` 与 `layers` 照常挂着。

**第一步复验时提出、2026-11-03 一并确认的几条**（DS-162、DS-163、DS-168、DS-170、DS-171）

- 整栏面板（DS-162）：进入时不关（宿主不再写 `TAKEOVER_KEY`），母版实现的检查器传 `takeover: null`，母版视图里不画；退出后照原样显示、不抢焦点——内容区滚动由会话记忆还原（`MasterMemory.takeoverOpen` / `takeoverScroll`，`mode.ts` 的 `REGION_ROOT.takeover`；样张宿主整块换检查器，做不到不卸载，改为记下滚动再写回；产品照前端 50/11 只隐藏、不卸载，整栏面板不进会话记忆），用户「定位」放过的画布高亮不重放（场景仓 `fidelity.flash-played`；没人操作过的静态样张照旧停在高亮），「查看全部页码」展开与否记在场景仓（`fidelity.all-pages`，报告收起后清空），报告打开时的「滚到这一条」滚过即清掉。依附选中对象的整栏面板（图表数据面板、插件面板等）随选区清空收起、不恢复。
- ⌥⌘M 不可用的轻提示（DS-163）：可以进入时，宿主先清掉还在显示的这一条。
- 跨断点（DS-168）：断点一变，焦点在被收起的左栏、检查器或抽屉里（或已掉到 body）时交给画布，`handoff` 同时复位（`narrow/form.ts` 的 `useCloseOnFormChange`；只在页面有焦点时做，嵌入的 iframe 不抢宿主页面的焦点）。
- 紧凑形态开着抽屉时切网格（DS-170）：单页 ↔ 网格一变就收抽屉、`handoff` 复位（`useCloseDrawerOnViewChange`，场景仓记 `narrow.viewSeen`，同 `narrow.masterSeen` 的做法；单页与网格两块外框、紧凑工具条都挂）。
- 查找框刚聚焦时的 Esc（DS-171）：查找面板挂上就登记 `useEscapeThroughTooltip`（面板关着时不做事），收起中的工具提示不再接走第一下 Esc；普通视图与母版视图同此。

**其余**

- `v3.css` 删去已作废的 token `--v3-scope-on`（DS-146，代码早已不引用）。
- `LayoutArt` 的 `prompts="master"`（改版前的版式缩略画法）留着，转正后没有调用方，产品迁移不带。
- 说明与注释：指占位符的「正文」改「文本」，去掉提到已作废的 Ribbon、状态栏的否定句；第一步取法的几处说明改写成已定的 rulings 编号（DS-161、DS-162、DS-163、DS-165）；注释里第一步的接线依据改指文档的归属节（前端 50/11 §2、§3，设计 03-26 §1.1），改版的题号改写成 DS 编号（DS-145…DS-156）；注释与本文不写会话工作目录的路径。
- M2 锁签对读屏隐藏（`MasterStage.tsx` 的 `LockTag`：落位层 `aria-hidden`；DS-156、TB-194），只改 DOM，像素不变。
- `useMasterView()` 删去第一步留下的三个兼容字段 `inMaster`、`impactPages`、`removed`（全仓没有读者）。
- 状态标题与说明：`layout-picker.readonly` 改「评审模式 · 画廊入口不出现」，说明补「编辑版式」留在原位、不可用（DS-147）。

**仍成立的已知限制**

- 「占位符 ▾」菜单项上按 Enter 插入还没做，样张也不画放置中的占位符（文档已写键盘等价，TB-202）。
- 上下文条各段之间读屏不停顿、几段连读（文档已写分句读法，TB-199）。
- `Mod+Alt+M` 只在 Chrome 上测过，Safari 与系统菜单下是否被拦截没有验证。
- 编辑器仅查看形态外接键盘按 ⌘K 照常打开命令面板；要不要保留未定（03-24 §10，随后续批次定）。
- 选中占位符时的尺寸角标（kit 件，普通视图同一个）可能压到相邻的字或母版图形，也可能伸出幻灯片；类型名与锁签已给它让位，角标本身不避让（50/11 §11.4）。
- 小画布（800 × 600、1000 × 700 一档）页脚一行与部分内容框不写类型名（DS-148 子题）。
- 小窗口下 M2 部分占位符不画锁签（DS-156 子题）。
- 开着「减少动态效果」时，换对象或点选后类型名晚 1–2 帧出现，落位不错（样张量 DOM、等过渡；正式实现按数据里的几何算，TB-188）。
- 常开的工具提示贴着窗口右缘（`entry-inspector` 的「编辑版式」、`m2-theme` 的「调整主题」）；窗格行键盘聚焦时的工具提示会盖到幻灯片左缘（kit 件原有）。
- 「删除母版」只做到确认框：点「删除」只关框，母版还在，也没有轻提示；未被引用的母版同样弹确认框（03-26 §8 写的是未被引用的直接删除并给可撤销轻提示）。
- 普通视图 `main-states.presence`、`design-themes.colors` 里，在画布内第一个可聚焦元素上按 Enter 后焦点落到 body（普通视图原有）。
- 轻提示「撤销」之后焦点经过 body 一帧（kit Toast 卸载按钮那一帧，普通视图同样）。
- 紧凑形态的左栏抽屉里，主菜单按抽屉自己的配置画，状态单独配的菜单项（`rail.menu`，如没配帮助链接时隐藏帮助项）不生效：宿主只做浅替换，普通视图的紧凑抽屉同样。
- 窗格里很长的版式名第二行可能以全角「（」起头，读起来像缩进半格（`master-view.long-names`）；均衡折行不认中文词边界，「两栏内容与图片」折成「两栏内 / 容与图片」（从 text-edit 点「转到版式」进入后的窗格），与已拍板的「标题和 / 竖排文字」同一规则。
- 母版窗格里用键盘重排版式后不播报新位置（文档写的是播报新位置，03-26 §9，同 03-14 幻灯片重排）。
- text-edit 场景自带母版里补的「内容与图片」「两栏内容与图片」两个版式，几何取自第 7 页的画面：内容框与图片框的底边离页脚一行只有约 2 pt，页脚的类型名因此放不下、不写；「内容与图片」左内容框取版式值 348、右图片框取 360，两框底边差 12 pt。只用于演示「转到版式」，不进全局示例母版。
- 进入母版视图后约 1 秒内按 ⌘F 再按 Esc，查找面板一下就关，但焦点落在窗格选中行而不是画布（进入时的焦点保护期接管了这次失焦；超过约 1 秒后照常落在画布，不经过 body）。
- 紧凑形态的母版视图里，左上外角开关仍读「显示幻灯片列表 / 收起幻灯片列表」，抽屉的区域名仍是「幻灯片列表」，里面却是母版与版式列表（第 1 批起就这样；只影响读屏，画面不受影响）。
- 上下文条在放不下时，说明段换到第二行后比对象段左缘右移约 9 px（换行时竖分隔只是隐藏、仍占位；`master-view.long-names` 在 1000 × 760 下可见），设计 03-26 §6.3 写的是与对象段左缘对齐；对象段自己一行放不下时会在「」之外折行，说明段随之落到第三行，03-26 §6.3 没写这种情形。两处都是第二步起就有的样张画法。
- 90 宽的窗格缩略图里，品牌短线贴住下面框的上边线，「比较」小标题框与内容框的线并成一条：框线移到框外、让字顶不压线的代价（TB-191）。
- 导出前提示「未使用的母版「X」将被移除」里「移除」用品牌蓝主按钮；要不要改危险样式实现时再定（03-26 §10）。
- 查看器里按需才挂上的查找面板：它挂上之前就已开着的工具提示仍会先接走第一下 Esc（编辑器里的查找面板随编辑器挂着，没有这个问题）。
- 紧凑形态里点左上胶囊的「网格」切到网格视图后焦点落在 body（胶囊里的切换不移焦点，普通视图原有）。
- 普通视图里「+N」在线列表的行点了不进入跟随（05 §1a 写的是点按某人进入跟随；样张原有的缺口）。

**有意变化的范围**（供整轮回归核对；按规则算，不按状态 id 列）

- 普通视图：检查器「版式」节可见时节标题右侧多「编辑版式」、32 × 18 缩略改 `thumb` 画法；版式画廊或重置确认开着时卡片与预览改 `thumb`；「主题颜色与字体」开着时改盖检查器栏；快捷键面板开着、列表里出现母版视图三行时多这三行；选中占位符形状（空占位符，或来自版式占位符的标题与文本框）时检查器顶行多「转到版式」，下面的内容下移约 63 px，锚在检查器上的弹层与菜单随之下移、放不下时改向上展开；text-edit 第 7 页的「版式」字段由回退的「标题和内容」改为「内容与图片」（缩略随之换，样张遗留修正）；`goto-layout` 的图标条上移约 1.6 pt。
- 母版视图：主菜单顶层可见时「插件…」写原因（菜单随之加宽、展开的子菜单右移），命令面板结果里有那四条时那几行变；头像组与在线列表的「跟随」只改 DOM（`aria-*` 与悬停外圈的类），像素不变；M2 锁签的落位层对读屏隐藏，同样只改 DOM。
- 只在交互之后出现：浮动层进出时收起、整栏面板往返照原样、跨断点交出焦点、抽屉随视图收起、查找框第一下 Esc 就关、⌥⌘M 轻提示进入时清掉、主题轻提示不跟到另一边；母版视图里「+N」在线列表的底部说明写「母版视图下不能跟随协作者」，列表按缺省开合重开时不抢焦点（普通视图里单页 ↔ 网格往返重开时同样不再抢焦点）；从 text-edit 点「转到版式」进入后窗格是场景自带的母版（多「内容与图片」「两栏内容与图片」），text-edit 里版式画廊的 Office 组多这两个版式；版式画廊按状态的 `mvMasters` 列分组，数据集是 `new-doc`、`single` 的母版视图态退出后打开画廊，列的是那份数据集（与窗格一致，原来固定列示例文档的两个母版）。
- 只有 Hub 与状态清单的文字变、画面不变：`layout-picker.readonly` 的标题与说明。

## 4. 检查器分区（`ui.inspectorSection`）

检查器只管当前选中对象的属性（DS-1）。分区按**选中种类**注册，编辑器按 `order` 排序渲染；内置的三种选中态也走这套（`editor/inspector/builtin.tsx`）：

| 种类 | 面板标题 | 分区 id 与 order |
|---|---|---|
| `none` | 幻灯片 N | `slide.layout` 10（版式画廊，见下）· `slide.theme` 20 · `slide.background` 30（DS-20：原「页面颜色」并入「背景」，`BackgroundControl`）· `slide.playback` 40（切换 M2 只读、放映时跳过此页，`data.slideHidden` / `data.transition`） |
| `shape` | 矩形 | `shape.align` 0（top，标题上方）· `shape.geometry` 10（位置与大小）· `shape.style` 20（快速样式，DS-31：`data.quickStyle` 当前样式、`data.quickStylesOpen` 样式库一出现就打开、`data.quickStyleHover` 演示悬停读数）· `shape.fill` 30（「图片」P2 不可用，TB-43）· `shape.stroke` 40 · `shape.shadow` 50（「内阴影」P2 不可用）· `shape.opacity` 60 · `shape.action` 70（`data.shapeAction`） |
| `text` | 文本 | `text.font` 10 · `text.paragraph` 20 · `text.color` 30 · `text.list` 40 · `text.box` 50（03-16 定稿的五个分区，`editor/inspector/text.tsx`） |

- **位置与大小**：所有对象（形状、组合、多选、连接符、图片、视频、表格、图表、占位符、母版占位符）一律用 kit 的 `GeometrySection`——同一套字段网格（X / Y ┊ W / H + 锁定比例 ┊ 旋转 + 翻转）、同一种单位（`LENGTH_UNIT`：样张按 pt 书写、产品按设置的度量单位显示，rulings §4.25 DS-27，§4.22 SR-4 结案；长度文字用 `len(v)`）、缺省展开；只读时是 StaticRow（位置 / 大小 / 旋转三行）。选项：`disabled`（已锁定移动、降权）、`sizeDisabled`（M3 提供）、`rotate` / `flip` / `ratio`、`overrides`（逐项继承 + 重置）、`remote`（远端覆盖正在输入的字段）、`note`。不要再自己拼「位置」「尺寸」两节。
- **快速样式**：形状检查器「填充」节上方一行 6 格主题样式缩略 + ▾（整行一个按钮；缩略去掉白衬底、形状铺满格子，外圈 `--v3-swatch-line`，TB-56），点按 / Enter / Space / ↓ 在本节里、缩略行下方原位展开 7 列 × 6 行 42 格样式库（`QuickStyleSection`，DS-31；DS-34 改为原位展开，原「贴检查器左缘的弹层」作废：下方各节下移、不遮挡画布，节标题右侧出现「收起样式库」，收起按钮 / 再点缩略行 / Esc 收起、焦点回缩略行；03-02 §4.2、04 §4.1a、07 §1.2b）；别的形状（新插入的形状、多选、组合里的子对象）用同一个组件，`stateKey` 分开记、`initial` 给当前样式（`null` 为没有当前格）。要点卡换样式后，画布、左栏与网格里的卡片经编辑器外层的 `--qs-*` 变量一起换样。
- **背景**：普通页、设计主题、母版、版式都用 kit 的 `BackgroundControl`（分段 + 颜色字段「色块 · 色值 · 色槽名」+ 主题色块快捷项；版式多一项「跟随母版」，`theme` 换主题、`extra` 加「隐藏背景图形」）。
- **文本分区的值**从 `data.text`（`Partial<TextData>`）读，缺省是示例第 1 页标题（`TEXT_TITLE`）；正文段落用 `data: { text: { ...TEXT_BODY_L2, … } }`（另有 `TEXT_BODY_L1`、新建文本框 `TEXT_NEW_BOX`，都从 kit 导出）。不要再自己定义一套文本分区。
- **版式**：`slide.layout` 是 `SelectTrigger` + 版式画廊（`editor/layouts/LayoutGallery.tsx`，03-27 按母版分组、搜索、重置确认与可撤销提示；与左栏「新建幻灯片 ▾」的 03-14 版式库是同一个组件，`mode` 为 `change` / `new`）。各状态的初值写在 `data`：`lpOpen`、`lpQuery`、`lpSelected`、`lpSingle`（单母版）、`lpDeleted`、`lpReset`、`lpToast`、`lpApplied`、`lpUnmatched`（`LayoutPickerData`）；版式的真实渲染只有底座 `LayoutArt` 一份（`prompts`：`thumb` 版式画廊卡片、「版式」字段的 32 × 18 缩略与重置确认的预览，同母版视图窗格，DS-149 · `canvas` 母版视图画布 · `slide` 新建页上的空占位符 · `none` 缩略图里的新建页 · `master` 改版前的版式缩略画法，转正后没有调用方）。节标题右侧是「编辑版式」（锚点 `layout-edit`，DS-147）：可编辑、`disabled`、只读三条分支都画在同一个动作位，可用与否与原因取宿主的 `masterView.entry`（只读时留在原位、不可用，DS-15 的例外），没有母版视图入口（`entry.silent`）时整个动作位不画；状态私有的「版式」节变体用 kit `useEditLayoutAction(layout)` 取同一个动作（如 offline-conflict 软冲突 I）。

种类取值以 50/10 §5 的 `selectionKind` 为准：`none`、`shape`（即 50/10 的 shapes）、`text`、`picture`、`media`、`table`、`table-cell`、`chart`、`placeholder-empty`、`group`、`connector`、`degraded`、`mixed`；母版视图用 `layout`、`master`。一个真实种类由**负责它的场景**注册（如 `table` / `table-cell` 归表格场景），别的场景要用就直接设 `selection: "table-cell"`，不重复注册。`degraded`（无法显示的对象：保真降级、缺插件元素）由底座注册（`editor/inspector/degraded.tsx`，第 2 批集成统一）：对象说明 · 位置与大小（不旋转、不翻转）· 对象自己的其余节，内容由场景写在 `data.degraded`（kit 类型 `DegradedInfo`）。对象说明与第 1 批图表「此类型仅支持查看」（`chart/inspector.tsx` 的 ReadonlyTypeSection）同一画法（rulings §4.25 DS-52）：中性 Info 图标（text-2）· 12px 600 标题 · 一句 text-2 说明（原因与「已原样保留」，不写「可以移动、缩放…」——能做什么由画布手柄与右键菜单表达）· 次按钮入口（底座 `DegradedDetailButton`：次按钮 + 14px 外链图标 + 文字，与第 1 批图表「保真详情」同一颗；场景只给文字、点按与锚点，第 2 批统一——原来降级对象的入口不带图标、图表那颗带，与 DS-52「同一画法」对不上）；图标由底座统一给，`DegradedInfo.about` 不再有 `icon`。纸面上的占位也只有一份：同文件的 `DegradedPlaceholder`（虚线框 + 类型图标 + 一行标题 + 一行原因，「内容已保留」并进原因行；尺寸 cqw、颜色 `--s-*`；保真占位与缺插件占位共用，从 kit 导出（第 2 批第 6 轮集成），场景从 `../../kit` 引入；第 1 批 main-states 缺插件三个状态第 6 页的二维码占位也用它，`main-states/slides.tsx` 的 `QrSlide`——DS-52，2026-10-15 由三行改为两行，第 2 批 plugins 缺多个插件的文档与 offline-conflict.priority-yield 用同一页）。两种占位的右键菜单也只有一份（第 2 批第 4 轮由保真场景上移，保真菜单外观不变）：`degradedMenuItems({ detail, altReason })`——剪切 · 复制 · 粘贴 · 原位复制 ┊ 排列 ▸ · 组合（单选不可用）┊ 编辑替代文本…（不可用，原因按对象写）· 添加评论 C ┊ 详情入口（保真「查看保真详情」、缺插件「查看详情」）┊ 删除（50/25 §2.5「能摆放」）；静态打开与键盘打开用同一落点 `DEGRADED_MENU_AT`，占位按钮的 `onKeyDown` 调 `openContextMenuFromKey(e)`，⇧F10 / 菜单键就在那里打开右键的同一份菜单（kit ContextMenu 只听 contextmenu 事件）；评审、只读浏览与降权照常出这份菜单，编辑类命令不可用（rulings §4.25 DS-64，即 §4.22 D-10；`degradedMenuItems({ …, readOnly: degradedReadOnly(ctx) })` 走 kit `readOnlyMenu` 的画法，顶部说明按 03-05 §4：评审「评审模式：编辑类命令需要编辑权限」、只读浏览「只有查看权限」、降权取 `rail.readonlyDegraded`「需要编辑权限」；「复制」与详情入口照常，「添加评论」只在有评论权限时可用；见 fidelity.degraded-menu-review。原「只在编辑模式挂」作废）。落点可以按对象换（`openContextMenuFromKey(e, at)` 与 `ContextMenu at` 传同一个）：缺插件的二维码占位只有页宽约 1/5，底座落点会让菜单压住选中框下方居中的尺寸角标，改贴在占位右缘展开（`plugins/degraded.tsx` 的 `QR_MENU_AT`，静态与键盘同一处）。同一页有几个同类占位时，选中的那一个的位置与大小用 `useDegradedGeometry()` 写进来（初值 `data.degraded.geometry`，点选另一个时写 `ptOf(它的 box)`），检查器「位置与大小」与画布尺寸角标读同一份。

```tsx
import { Cols, inspectorPanel, inspectorSections, NumberField, Section, type InspectorCtx } from "../../kit"

function CellFillSection({ readOnly, data }: InspectorCtx) {
  return (
    <Section title="单元格" anchor="section-table.cell">
      <Cols>
        <NumberField label="边距" defaultValue="0.25" unit="cm" aria="单元格边距" disabled reason="M3 提供" />
      </Cols>
    </Section>
  )
}

inspectorPanel({ kind: "table-cell", title: "单元格" })
inspectorSections([
  { id: "table.cell", kinds: ["table-cell"], order: 10, component: CellFillSection },
  { id: "table.text", kinds: ["table", "table-cell"], order: 20, component: TableTextSection },
])
```

- 分区组件返回一个或几个 `<Section>`（`ui.tsx`），**不要外包 div**（节间分隔线靠 `Section` 的 `last:` 规则）；可以用 hooks。默认收起的分区用 `FoldSection`。
- 内置分区里加插一节：注册同种类、order 落在空位（如 `shape` 的 35）。
- 状态级定制（只在当前选中种类 = 状态的 `selection` 时生效）：
  - `inspector.sections: ["shape.align", MY_GEOMETRY_WITH_ERROR, "shape.fill"]`：只显示这些、按此顺序；可直接写分区定义，做状态私有的变体（如校验错误、混合值）。
  - `inspector.hide: ["shape.shadow"]`、`inspector.title: "2 个对象"`（`null` 不显示标题行）。
- 与选中无关：`inspector.notice: <InspectorNotice>…</InspectorNotice>`（面板顶部说明行，`noticeIn: "all"` 时「评论」页签也显示）；`inspector.tab: "comments"`。
- 只读与不可用是两回事：`readOnly`（评审 / 浏览，`mode` 会设上；编辑权限被降级也用它，DS-15）= 本来就不能改，分区只列属性与当前值、不画字段外形与禁用控件（内置「幻灯片」「矩形」「文本」各节用 `StaticRow`，`label` 是左侧 64px 标签列），顶部一行说明权限；`disabled: "原因"`（打开中等暂时状态）= 暂时不能用，字段留在原位、aria-disabled、工具提示写原因（分区从 `InspectorCtx.disabled` 读）；`locked: "原因"` = 整栏暂不可用（打开中：放映、分享、页签、缩放也不可用）。
- 外框：`collaborators: { people, extra }` 换头像组（`extra` > 0 时末尾「+N」，锚点 `collaborators-more`；`people: []` 不显示）；`commentsTab: false` 不显示「评论」页签、`{ reason }` 留在原位但不可用；`body` 换掉「设计」页签的内容（如母版视图）、`commentsBody` 换掉「评论」页签的内容（§3a），外框仍用底座的；`takeover` 把整栏换成面板（`InspectorTakeover`，§3a）。缩放读数是实测比例（幻灯片显示宽 ÷ 1280，与网格同口径）。

## 5. kit 组件（`src/v3/kit/`，统一从 `../../kit` 导入）

| 组件 | 放在 | 要点 |
|---|---|---|
| `Popover` | `layers` | 锚定弹层。`anchor` 推断位置：工具按钮 → 向上居中、离工具条 8px；检查器里 → 贴检查器左缘 8px 向左、与控件顶端对齐；左栏里 → 贴左栏右缘向右；其余向下。`label` 必填（无可见标题时）；`className` 定宽与内边距（缺省 `p-1`）。场景状态里一出现就打开的不抢焦点（截图干净）；**用户（键盘或指针）打开的把焦点移进第一个可聚焦项**（`autoFocus={false}` 不移：给不是用户此刻打开的弹层，如换页回来恢复的评论撰写框，TB-79），Tab / ⇧Tab 在层内循环，Esc 关闭后焦点回触发处（焦点已经有去处时不再拉回，2026-10-15 补，同 `useFocusBackOnClose`）；点外面 / Esc 关 |
| `Menu` | `layers` 或任意处 | 锚定（`anchor`）或普通下拉（`trigger`）。条目：普通项（`kbd`、`hint`、`tag`、`disabled` + `reason`、`danger`、`icon`）、`checkbox`、`radio`、`sub`（`items` 或自定义 `content`）、`separator`、`label`、`note`、`custom`。`openPath={["arrange"]}` 静态展开子菜单 |
| `ContextMenu` | `layers` | `at={{ anchor: "slide", x: 0.8, y: 0.6 }}` 静态打开在锚点内某点；在 `target`（缺省同 `at.anchor`）上右键会在指针处重开 |
| `Dialog` | `layers` | 居中、12px 圆角、panel 底、浮层阴影；标题栏 40（标题 13px 600、× 正文色，DS-142）；`primary` / `secondary` / `footer` / `footerStart`；`variant="confirm"` 为紧凑确认框（危险操作 `primary: { danger: true }`）；尺寸 `sm 360` / `md 480` / `lg 640`，导入专用 `import 560`（TB-179） |
| `BottomSheet` · `FileTypeIcon` · `importDialog`（`registerImportDialog` / `useOpenImportDialog`…） | 见 §3e | 2026-10-23 新件：手机的模态底部面板（偏好设置与导入）、文件类型图标（Tabler，DS-143）、「导入」对话框的底座接口（DS-140） |
| `FloatingPanel` | `canvasOverlay` | 画布浮动面板（查找替换、数据面板）：`placement` top-right（缺省）/ top-left / top-center / bottom-right / bottom-left；圆角 8，横条式可 `radius={12}` |
| `Toasts` + `Toast` | `canvasOverlay`（应用壳放 `page.overlay`，`bottom={24}`） | 底部工具条上方居中（`bottom` 换离底距离，缺省 74），层级 z-[15]（工具条的弹层盖住提示）；`tone` neutral / info / success / warning / error，`action="撤销"` 或 `actions={[{ label }, …]}`（两个以上选择），`description` 第二行说明，`onClose`。读屏：每条轻提示自己是唯一的播报区（`role=status`，错误为 `alert`），容器 `Toasts` 不再是 `aria-live`（第 2 批第 6 轮集成：原来两层嵌套，同一句进两个播报区）；出现后的两帧里内容先挡在无障碍树外再放进来（`useRevealAfterMount`），读屏看到的是已在的播报区里出现了内容，外观不变。同一件事不要再另用一个播报区重复播报 |
| `Banner` | `banner`（应用壳放 `page.shell.banner`） | `tone` info / warning / error，`title` + 正文 + `actions`（用 `Button variant="secondary"`：次按钮透明底 + 细边，DS-37；原建议的 outline 作废）+ `onClose`（`closeLabel` 换 × 的可读名称）；不截断，可换行；同时只放一条；高 40 含底边（DS-75） |
| `MainMenuLayer` / `mainMenuItems` | `layers` | 主菜单（统一的一份，底座 MainMenu 也用它）：返回首页 ┊ 文件 · 编辑 · 视图 · 插入 · 排列 ┊ 插件… ┊ 帮助（DS-18；替换 ⇧⌘H、链接 ⇧⌘K）；「文件」是导出… · 保真报告 · 幻灯片大小…（P2 不可用，DS-31，`FILE_ITEMS`），母版视图中「帮助」多「关于母版继承」（TB-15，`helpItems`）。`openPath` 静态展开，`edit`（`editItems({ undo, redo })`）/ `insert` / … 换子菜单，`gridGuides` 接网格与参考线的状态，`master` 母版视图条目，`canEdit`，`onHome` / `onPlugins`（MainMenuLayer 的「返回首页」缺省已接好）。**不要自己拼主菜单** |
| `PaperScope` | 叠加层里 | 白色纸面上的界面件（占位符图标条、上传占位里的按钮）：整套亮色 token，`--paper-accent` 是当前主题强调色 |
| `InspectorTakeover` / `useTakeoverOpen` | `inspector.takeover` 或 `regions.inspector` | 检查器整栏面板（DS-26 先例）：栏宽缺省 400、协作行不动、标题行（说明 · actions · 收起到检查器 · 关闭 Esc）、内容区滚动、可选 footer；属性与两种用法见 §3a。协作行单独用是 `InspectorTopRow` |
| `TONES` / `toneOf` / `assignTones` / `fnv1a32` | 任意处 | 身份色 12 色板的哈希顺序、按用户 id 稳定取色、同屏撞色顺延（§3a）；`Tone` 已是 12 色 |
| `DegradedInfo`（`data.degraded`） | 状态 data | 「无法显示的对象」的检查器内容（§4）：标题、对象说明（一句标题 · 说明 · 入口按钮；图标统一中性 Info，由底座给；入口按钮用同文件的 `DegradedDetailButton`——次按钮 + 14px 外链图标，与第 1 批图表「保真详情」同一颗，场景只给文字与点按）、位置与大小、其余节；纸面占位用同文件的 `DegradedPlaceholder` |
| `degradedMenuItems` / `degradedReadOnly` / `DEGRADED_MENU_AT` / `openContextMenuFromKey` | `ContextMenu` 的 items / 落点 / 占位的 onKeyDown | 「无法显示的对象」的右键菜单（保真占位与缺插件元素同一份，§4）；`readOnly: degradedReadOnly(ctx)` 是评审 / 只读浏览 / 降权的只读形态（DS-64，`EditorCtx.readonlyDegraded` 取状态的 `rail.readonlyDegraded`）；`openContextMenuFromKey` 也可给别的画布对象用：焦点在对象上按 ⇧F10 / 菜单键时在给定落点派发 contextmenu |
| `readOnlyMenu` / `READONLY_MENU_NOTE` | 任意菜单的 items | 菜单的只读形态（03-05 §4「禁用而不隐藏」）：`readOnlyMenu(items, 保留可用的 id, 顶部说明)`，编辑类命令留在原位不可用、同一原因写在顶部一行、删除不用危险色；`READONLY_MENU_NOTE` 是画布与对象右键的三种说明（评审 / 只读浏览 / 降权）。2026-10-15 由 slides-selection/menus.tsx 上移到 kit（那里转出，引用不变） |
| `useDegradedGeometry` | 场景的点选处理 | 选中的「无法显示的对象」的位置与大小（场景状态，初值 `data.degraded.geometry`）：同一页有几个同类占位时，点选另一个就写进它的值（`ptOf(box)`），检查器「位置与大小」与画布尺寸角标读同一份（§4） |
| `useEditorCommand` / `useInspectorTab` / `BannerStack` / `OfflineBanner` / `PanelState` / `Phrases` / `Switch` / `AvatarStack` / `Attribution` / `scrollIntoPanel` / `useDemoOpen` / `keepMovedFocus` / `holdFocusDuring` / `closeWithFocusBack` / `COMMAND_ENTRY` / `arrivedVia` | 见 §3b | 第 2 批集成并入底座的件：底座命令、检查器页签受控、横幅叠放与离线横幅、面板状态块、长句分段、开关、头像叠放、插件归属、面板内滚动、演示常开、菜单关闭不抢焦点、菜单打开 / 收起面板时焦点不经过 body、命令兜底转场带上入口 |
| `FoldRow` / `useSharePending` / `useFocusBackOnClose` / `useRevealAfterMount` / `DeckCommentPins` / `DECK_PINS` / `DegradedPlaceholder` | 见 §3b、§3、§4 | 第 2 批第 6 轮集成并入底座的件：列表折叠行（评论「已解决 N」与版本历史共用）、「分享」按钮的待处理访问申请数、浮层关闭时同步交还焦点、播报区「先挂空、下一帧填内容」的读屏版（轻提示与页级提示条）、示例文档的评论钉（`stage.commentPins`）、降级对象的纸面占位 |
| `TableGridPicker` | `Popover`（`p-2`） | 插入表格网格（工具条「表格」与占位符的表格图标共用，`note` 加一行说明；占位符打开的在图标正下方居中、距 8，03-16 §6.6）；未选格 1px `--v3-border-control` 内描边（TB-35；DS-35 改安静样式后仍保留，≥ 3:1） |
| `PlaceholderIconBar` | `PaperScope` 里 | 空内容占位符的快速插入图标条（文本、表格、图表场景共用）：`enabled` 已开放的项（缺省 `PH_M2_ENABLED`，图表 M3 用 `PH_M3_ENABLED`）、`anchors` 各项锚点、`popups` 弹出类型（表格缺省 dialog）、`pressedKind` 弹层开着的那一项、`onPick`；未开放的项禁用而不隐藏、挂里程碑标记 |
| `useSceneState(key, init)` | 组件里 | 场景内跨区域共享的状态（左栏、画布、检查器、浮层读写同一份；换状态即复位），key 带场景前缀；按状态取初值就读 `useEditor().data`（如 `data.find`、`data.zoom`）。**不要再写模块级 store 或自己的包装** |
| `LayoutArt` / `LayoutGallery` / `useLayoutPicker` | 任意处 | 版式的真实渲染与版式画廊（见 §4「版式」）；`LayoutToasts`、`ResetDialog` 底座已挂好，场景不用再放 |
| `useBreakpoint()` | 组件里 | 视口断点形态 `desktop` / `compact`（640–1024）/ `narrow`（< 640 或 pointer: coarse），与 50/09 detectBreakpoint 同源 |
| 检查器控件 | 分区里 | 输入类字段一律 `FIELD_FRAME` 外框（只铺 panel-2 淡底、不描边，悬停出一道与分隔线同档的细边，不可用时底再降一档；DS-35 修订 DS-9 的「1px `--v3-border-control` 独立边界」；聚焦 / 报错只换这条线的颜色），下拉与点开选择的字段用 `SELECT_FRAME`（透明底 + 细边、悬停铺 panel-2），自己画字段时也用它们。ui.tsx 已有：`Field`、`MenuField`、`SelectTrigger`、`Segmented`（可受控；`role` group / radiogroup / tablist；单项 `disabled` + `reason` + `tag`）、`ToggleStrip`、`Swatch`、`Section`（`tag`、`bodyClassName`）、`PanelTitle`、`Cols`、`Button`（含 `danger`；`secondary` 是透明底 + 细边的次按钮，DS-37）、`IconButton`（24 / 28 / 36，触控 44；`tipOpen` / `tipLines` 提示常开并分行）、`Tip`（`open` 常开、`lines` 按句分行）、`ColorRow`。新增：`NumberField`（`unit`、`mixed`「多个值」、`error`、`disabled` + `reason`）、`TextField`（`disabled` + `reason`、`error`、`onKeyDown`）、`TextArea`（`max` 字数）、`ColorField`（任意色值、色块是按钮）、`ColorChip`、`SwatchPicker`、`Slider`、`SliderField`、`Checkbox`、`CheckRow`、`RadioRow` / `RadioDot`、`Progress`、`FoldSection`（`tag`）、`PropRow`、`InspectorNotice`、`EmptyNote`、`Tag`（M3 / P2）、`Kbd`、`KeyCap`、`StaticRow`（只读的一行，`label` 标签列、`leading` 色块 / 缩略）。**不可用一律用 `disabled` + `reason`**（MenuField、Segmented、ToggleStrip、CheckRow、TextField、TextArea、Button、IconButton 都支持：aria-disabled、仍可聚焦、工具提示「名称 · 原因」，FE-06），不要自己写 text-3 的静态复刻 |
| 画布叠加件 | `slideOverlay` | `SelectionBox`（`handles` corners / all / none、`label` 尺寸、`dashed`）、`Marquee`、`HoverBox`（`fill`）、`Guide`（参考线 / 间距，`label`）、`SizeTag`、`CanvasTag`（中性提示）、`FloatingBar` + `BarDivider`（只用作裁剪模式的出口「取消 / 完成」，挡住点击冒泡；对象不设上下文 / 迷你工具条，DS-13、DS-22）、`HitArea`（让自定义页的对象可点选；`anchor` 给锚点名——右键菜单的 target、关闭后焦点交回处，`onKeyDown` 接键盘，如 ⇧F10 打开右键菜单）、协作者：`RemoteCursor`、`PresenceTag`、`RemoteSelection`、`RemoteTextSelection`、`CommentPin`（`touch` 把点按区扩到 44），身份色用 `TONE_BG` / `TONE_BORDER` / `TONE_SOFT`（12 色；按用户 id 取色用 `toneOf` / `assignTones`，§3a）。位置写 `box={{ x, y, w, h }}`（幻灯片百分比，`px(x, y, w, h)` 可把 960 × 540 坐标换成百分比，反过来 `ptOf(box)` 换回 pt，检查器与画布写同一组数时用）或 `at="left-[..] top-[..] …"` |

### 浮层的补充约定

- 锚定打开的 `Popover` / `Menu`（`anchor` 模式）会给锚点元素加 `data-v3-open`，触发器显示按下态（与 Radix 触发器自己打开时的 `data-state=open` 同一外观）；不要再用 `regions` 包一层给按钮补底色。
- kit 浮层都挡住了 React 事件冒泡：从 `slideOverlay` 里打开的弹层 / 菜单 / 对话框，点里面不会触发画布的「点空白取消选中」。
- `Popover` 有 `onEscapeKeyDown`、`onInteractOutside`（`e.preventDefault()` 不关闭，如「Esc 先清空搜索」「点的是触发器本身」）与 `collisionPadding`；`Menu` 有 `onInteractOutside`。浮层里的关闭按钮用 `useLayerClose()` / `LayerClose`；自己画的非模态小卡用 `useEscapeThroughTooltip` 让 Esc 不被自动弹出的工具提示吞掉。
- `regions` 插槽第二个参数的类型 `RegionDefaults` 也从 kit 导出。
- `Menu` 的不可用项是 aria-disabled、**仍可聚焦**（键盘能停上去听到原因），右侧原因、快捷键、分组小标题与说明行是可读信息（text-2，DS-9）；`note` 可以是多行节点、可带 `tag`，给了 `id` 时同面板里没写 `reason` 的不可用项自动 `aria-describedby` 指向它；`label` 可带 `tag`。
- `ContextMenu` 的 `target` 以 `*` 结尾是锚点名前缀（如 `"thumb-*"`），`onTarget(锚点名)` 可以同步切页。
- 自定义工具条（如母版视图换掉「评论」）用底座的公共件拼：`ToolbarShell`、`SelectTool`、`ToolButton`、`MoreTool`、`ToolbarDivider`、`ToolbarLabel`、`CommentNav`，外观自动与底座一致。不可用口径：打开中 / 加载中 / 加载失败整条不可用（含「选择」）；降权 / 里程碑未开放时「选择」可用、其余留在原位写原因（`lockTools(原因, { select: true })`）。
- **工具条面板登记**（`registerToolLayer(id, Component)`，与 `inspectorSection` 同一做法，场景模块顶层登记一次）：`chart`（工具条「图表」的类型菜单，受控 `open` / `onOpenChange`）、`table:dialog`（网格 ›「插入表格…」）、`image:url`、`more:header-footer`、`more:icon`、`more:symbol`、`more:date`、`shape:action`（检查器「操作」）、`presence:list`（头像组「+N」的在线列表）。没有登记的条目选了只关菜单。静态打开的插入菜单用 `useWiredMenu(items, prefix)` 接上同一批面板。
- **焦点**：判断「场景状态里一出现就打开」还是「用户打开」靠 kit 的 `userHasInteracted()`（document 捕获阶段听 keydown / pointerdown / click，编辑器重新挂载时复位）：没人操作过时 Popover / Dialog 不抢焦点，操作过之后一律把焦点移进浮层（条件渲染的浮层每次打开都是新挂载，不能靠挂载时机判断）。浮层关闭后焦点交回触发处——锚定 `Menu` / `ContextMenu` / `Popover` 交回锚点（不可聚焦的容器交给其中第一个控件，画布里的交给画布），`Dialog` 交回打开前的焦点元素，没有时交给 `returnFocus` 锚点、再没有就交给画布（`Stage` 带 tabIndex −1）；`Popover` 贴一组元素定位、真正的触发器是其中一个按钮时用 `returnFocus`。自己画的非模态层关闭后调 `rescueFocus()`（kit），不让焦点掉到 body。交还在浮层内容卸载的同一个任务里完成（kit `useFocusBackOnClose`，§3b「对话框与菜单」），不在 body 上停一帧。
- **Esc 逐层退出、不越级**（50/10 §7.1）：最上层的浮层先关（kit `overlayOpen()` 判断有没有打开着的 Radix 浮层或已展开的弹出触发器，页面上一直在的 `role="listbox"`、工具提示都不算），再轮到抽屉（紧凑形态，`data-v3-drawer`）、数据面板 / Sheet（先放弃格内未提交的输入、焦点留在格内）、母版视图的取消选中与退出。自己监听 Esc 的组件：见到浮层开着就不动；轮到自己时 `e.preventDefault()`，下一级见到 `defaultPrevented` 就不再响应；要赶在工具提示（Radix 会先吞掉 Esc）之前处理就挂 document 捕获阶段，并用 `overlayOpen()` 自查上面还有没有一层。
- **画布浮动层与母版视图的 Esc**：放在 `canvasOverlay` 里、自己监听 Esc 收起的非模态浮动层（不是 Radix 浮层，如 `FloatingPanel` 做的面板、画布顶部的提示条），开着时再用 kit `useCanvasEscape(active, take)` 登记同一条判断——母版视图的宿主在退出之前先问它们，Esc 才不会越过它们直接退出（§3f「修复第 3 轮」）。只在焦点在自己里面才响应 Esc 的面板不用登记。
- **缩略图右键**：底座在左栏与网格的缩略图上都有右键菜单（`thumbMenu`，⇧F10 / 菜单键也能开）；场景自己挂了同一锚点的 `ContextMenu` 时让给场景。网格里 ← → ↑ ↓ / Home / End 在页间移动焦点。
- **账户菜单**：自己的头像（锚点 `account`）总在头像组第一个、与他人隔开并带常驻外圈；静态打开用 `AccountMenuLayer`。主菜单静态打开时 `MainMenuLayer highlight="母版视图"` 把某一项设为当前项。

### 锚点（`data-v3-anchor`，`kit/anchor.ts` 的 `ANCHORS`）

| 区域 | 锚点名 |
|---|---|
| 底部工具条 | `toolbar`、`tool-select`、`tool-text`、`tool-shapes`、`tool-image`、`tool-table`、`tool-chart`、`tool-comment`、`tool-more`；评审条另有 `tool-highlight` |
| 左栏 / 网格左上胶囊 | `rail`（单页的整栏）、`main-menu`、`view-toggle`、`doc-menu`、`sync-status`、`new-slide`（新建幻灯片 ▾，网格里是「+ 新建幻灯片」）、`new-slide-plus`、`thumb-<n>`（第 n 页缩略图，单页 / 网格都叫这个） |
| 画布 | `canvas`（画布列）、`stage`（画布）、`slide`（当前页幻灯片框）、`notes`（备注框） |
| 检查器 / 网格右上胶囊 | `inspector`（单页的整栏）、`collaborators`（「+N」为 `collaborators-more`）、`present`、`share`、`zoom`、`tab-design`、`tab-comments` |
| 检查器顶行 | 另有 `account`（自己的头像，点开账户菜单，DS-18） |
| 内置分区 | `section-<分区 id>`（如 `section-shape.fill`）、`layout-field`、`theme-card`、`theme-adjust`、`background-color`、`background-image`、`quick-styles`（快速样式缩略行）、`fill-color`、`font-latin`、`font-ea`、`text-color`、`text-highlight`、`list-bullets`、`list-numbering` |

找不到锚点时浮层不渲染，1 秒后控制台警告 `[v3 kit] 找不到锚点「…」`。自己画的控件加 `data-v3-anchor="<场景 id>.<名字>"`（`Section`、`Field`、`MenuField`、`NumberField`、`TextField`、`ColorField` 都有 `anchor` 属性）即可被锚定。

## 6. 自定义页（deck）

缩略图与内容用真实渲染，不用骨架条（Q8）。要表格页、图表页、空占位符页时，用 `deckWith` 改页或加页，左栏缩略图、网格、画布自动同步：

```tsx
import { deckWith, SlideFooter, SlideTitle } from "../../kit"

function QuarterTable() {
  return (
    <>
      <SlideTitle>季度明细</SlideTitle>
      <div className="absolute inset-x-[7cqw] top-[19cqw] text-[2.1cqw] leading-none">…</div>
      <SlideFooter page={3} />
    </>
  )
}

editor: {
  deck: deckWith({ 3: { name: "季度明细", render: ({ where, selection }) => <QuarterTable /> } }),   // 换第 3 页
  // deckWith({}, [{ n: 7, name: "附录", layout: "仅标题", render: () => <Appendix /> }])            // 追加第 7 页
  slide: 3,
  selection: "table",
}
```

`render` 的内容画在 16:9 的 `SlideFrame` 里：根元素 `absolute` 定位，字号、间距、线宽一律用 `cqw`（1cqw = 幻灯片宽的 1%），颜色用 `.v3-slide` 的 `--s-ink`、`--s-body`、`--s-mute`、`--s-line`、`--s-card`、`--s-brand`、`--s-brand-soft`、`--s-brand-mid`、`--s-note`。`where` 区分画布 / 缩略图 / 网格；画布上的选中、编辑态用 `slideOverlay` 画，缩略图里就不会出现。

## 7. 设计约束速查（rulings §4.25 DS-1…DS-37 · 质量门 Q1–Q10，`docs/80-process/01` §4）

- **颜色（Q3）**：中性灰阶；品牌蓝 `--v3-accent` 只给主操作、当前工具、选中（含勾选框、选中色块外圈、选中框与参考线）与按下的开关（B / I / U / S、上下标、查找的 Aa 与 ab：强调色淡底 `--v3-toggle-on`，DS-36）；状态色 `--v3-danger` / `--v3-warning` / `--v3-success`（及 `-soft` 浅底）只在对应状态出现；身份色 `--v3-tone-*`（12 色）只给头像、远端光标与名签、远端选区、评论钉与「谁」的色点，不挪作状态或分类语义（设计 04 §2.4）；文档内容颜色不受限。
- **形状（Q4）**：圆角只用 4（控件、缩略图）/ 6（按钮）/ 8（弹层、备注框）/ 12（浮动工具条、胶囊、对话框——对话框 2026-10-23 由 8 改 12，DS-142）；无药丸按钮（头像、色点除外）；无卡片套卡片；ribbon 与底部状态栏均已废弃（DS-1、DS-6），对象也不设迷你工具条（DS-13、DS-22）。
- **材质（Q5）**：无渐变背景、光晕、毛玻璃；只有浮层带阴影（`--v3-shadow`），面板贴边、1px 分隔（`--v3-border`：暗 #444、亮 #E5E5E5）。
- **密度（Q6）**：控件 28px、工具条按钮 36px；检查器节 `px-4 py-3`、节标题 12px 600；左缘对齐。
- **文字（Q7）**：字号 11（只给数字与西文）/ 12 / 13 / 16，含中文 ≥ 12px（`hasCjk` 可判断）；无截断、溢出、重叠。专有名词、引号内的名称、代码串用 `whitespace-nowrap` 包起来，避免断在中间（如 `<span className="whitespace-nowrap">「标题和内容」</span>`）。
- **对比度（DS-9，WCAG AA）**：`--v3-text-3` 只给占位与不可用项，可读信息（标签、单位、计数、说明、「多个值」、快捷键提示）用 `--v3-text-2`；带文字的强调色实底（主按钮、尺寸角标）用 `--v3-accent-solid`；`--v3-border-control`（仍 ≥ 3:1）只给「边框就是控件本身」或身份标记的：勾选框、单选圈、滑块把手、拖动把手、滚动条、插入表格网格空格（TB-35）、自己头像外圈与虚线落区（导入的落区除外：静止时用 `--v3-border`、拖入悬停用强调色虚线加淡底，DS-141、TB-180）。
- **控件画法（DS-35…DS-37，修订 DS-9 的「输入框加 1px 独立边界」；样张原来的 `controls` 参数与原画法已删除）**：组件只引用 `v3.css` 的控件语义 token、不直接写 `--v3-border-control`——输入 `--v3-field-*`（淡底、不描边，悬停出细边）、下拉 `--v3-select-*`（透明底 + 细边）、分段 `--v3-seg-*`（槽不描边，选中块面板色 + 细边、贴边，TB-55；开关组保留 2px 间距）、开关按下 `--v3-toggle-on`（强调色淡底）、按钮按下与页签选中 `--v3-on-*`（只铺淡底）、次按钮 `--v3-btn-*`（透明底 + 细边）；细边与分隔线同档（`--v3-border`）。控件边界不再要求 3:1，靠底色、标签与当前值识别；选中 / 按下另有非颜色线索 `v3-on-cue`（文字 500、图标描边 2）。
- **token（Q10）**：只用 `v3.css` 的变量（`--v3-canvas`、`--v3-panel`、`--v3-panel-2/3`、`--v3-border`、`--v3-text`、`--v3-text-2/3`、`--v3-accent`、`--v3-accent-soft`、`--v3-sel`、`--v3-shadow`、`--v3-scrim`、状态色、导入批注的中性评论钉 `--v3-pin-neutral`（第 2 批第 6 轮新增，取值与原先借用的工具提示底相同、画面不变，不再借用 `--v3-tooltip-bg`）…），不写死 UI 颜色与尺寸；图标 lucide 16px / 描边 1.5（`ICON`），工具条 20px（`ICON_LG`）；文件类型图标是唯一的例外家族（Tabler Icons，kit `FileTypeIcon`，DS-143、TB-182）。
- **双主题（Q9）**：每个状态都看暗、亮两套。
- **文档主题**：内置 5 套（简约 / 商务 / 暗色 / 学术 / 活力）与开始页模板是同一份数据（`editor/layouts/data.ts` 的 `BUILTIN_THEMES`，DS-33），每套 3 个变体（DS-32）；在幻灯片外层或幻灯片本身加 `themeOf(id).className`（`mt-theme-<id>`）即换上该主题的 `--s-*` 与底色（`THEME_CSS`，`V3Root` 挂一次）；示例文档自带的 Office 不在内置清单里。
- 结构：左栏 240、检查器 280、底部浮动工具条只放创建工具；其余命令进主菜单 / 右键 / ⌘K / 快捷键（Q2 入口唯一：同一操作在常驻界面上只有一个入口）。

## 8. 截图约定

- 路径（`S` 是会话工作目录，见 §3e「第 3 批的约定」）：第 1 批 `S/v3-shots/batch1/<场景id>-<状态id>-<dark|light>.png`；**第 2 批** `S/v3-shots/batch2/<场景id>-<状态id>-<dark|light>.png`（每个状态暗、亮各一张；参数同下）
- **第 3 批**：`S/v3-shots/batch3/<场景id>-<状态id>-<dark|light>.png`（DPR 2、1600 × 1000，参数同下；页面级宿主的状态按 `__V3_SCENARIOS__` 的 href 拍，脚本 `v3-shots/batch3/shoot.cjs`）。第 1、2 批逐像素基线 2026-10-16 随 DS-75 重存：`b2/repair-r3/b1-base-b3`、`b1-base-b3b`（第 1 批）与 `b3/base/b2-base-b3`、`b2-base-b3b`（第 2 批），`b2/r9/run-all.sh` 用它们
- 参数：视口 1600 × 1000（窄屏形态按其宽度截：紧凑 1024 以下、仅查看 390 × 844）、deviceScaleFactor 2、`locale: "zh-CN"`、`chromium.launch({ channel: "chrome" })`；`networkidle` + `document.fonts.ready` + 500ms；截图前鼠标移到 (800, 5)，避免悬停态。
- **第 2 批按各自视口截的状态**：`comments.compact` 800 × 1000；`comments.tablet`、`comments.alt-tablet-compose` 820 × 1180；`comments.phone`、`comments.phone-reply`、`comments.phone-viewer`、`offline-conflict.narrow-offline` 390 × 844。鼠标停在视口上沿中点（`batch2/shoot.cjs` 缺省 `--mouse` 取 `min(800, 宽/2),5`），窄视口里不会悬停到按钮上。
- **narrow 场景各状态要按各自的视口截**（`shoot.cjs` 加 `--w --h`）：`compact`、`compact-inspector` 1024 × 768；`compact-rail`、`compact-comments` 800 × 1000；`compact-chart-data`、`compact-master`、`compact-master-pane`、`compact-find` 1000 × 760；`narrow`、`narrow-comments`、`narrow-slides`、`narrow-more` 390 × 844（DPR 2 即 780 × 1688）；`responsive` 缺省 1600 × 1000。不带 `--w --h` 会按桌面视口截出放大的查看器，不是形态本身。截完用 `identify`-类检查确认像素尺寸，并看一眼有没有整幅画面被重复平铺（一次捕获失真，重截即恢复；同一状态在 390 × 844 的 DPR 1 / 2 / 3、触控模拟、先 1600 × 1000 再缩窄、整页截图下都正常，页面没有溢出）。
- 预览服务器要绑 127.0.0.1：`npx vite --port <端口> --strictPort --host 127.0.0.1`（只写 `--port` 时 vite 监听 localhost 的 IPv6，脚本连 127.0.0.1 会连不上）。
- 现成脚本（自动从页面的 `window.__V3_SCENARIOS__` 读取场景与状态，汇总控制台 error / warning）：

  ```bash
  node $S/v3-shots/batch1/shoot.cjs <端口> <场景 id> [状态1,状态2] [--themes dark,light]
  # 第 2 批：同一脚本的副本，输出缺省写到 batch2/
  node $S/v3-shots/batch2/shoot.cjs <端口> <场景 id> [状态1,状态2] [--themes dark,light]
  ```

- 第 2 批交付前逐张过 Q1–Q10，标杆是 Figma Slides（评论钉与评论列表、线程内回复与解决、版本历史、分享对话框、插件管理都以它的克制程度为准；与标杆同尺寸对照截图是项目约定）。共享代码只在集成阶段改，改完要回归第 1 批：与改前逐像素比对，差异 > 0.5% 视为回归。

- Playwright：1.63.0，用检查脚本的同一份安装（另一个会话工作目录里的 `node_modules/playwright`，路径写在各轮检查的说明里；2026-10-05 被系统清理过一次，已重装）；备用 `S/pw/node_modules/playwright`。两处都坏了就在自己的工作目录里 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright`（用系统 Chrome，不下浏览器）。
- 截完逐张自审：对照 03-screens 的状态清单与 Q1–Q10，暗亮两套都看。

## 9. 常见问题

- **弹层没出现**：锚点名写错或锚点不在当前视图里（如单页视图里没有网格胶囊）；看控制台的 `[v3 kit]` 警告。
- **截图里出现焦点环 / 工具提示**：kit 浮层在场景状态里打开时不抢焦点；自己写的组件不要 `autoFocus`。
- **叠加层在用户点了别处后还在**：ReactNode 形式的 `slideOverlay` 会自动隐藏；`canvasOverlay` / `layers` 是常驻的，需要随状态变化就写函数并读 `useEditor()`。
- **检查器显示「还没有注册检查器分区」**：`selection` 用了新种类但没 `inspectorSections` 注册。
- **画面上的数字与西文**：11px 只给纯数字 / 西文（页码、百分比、快捷键），中文混排一律 12px 起。
- **整个编辑器被「推上去」一截**：用了 `scrollIntoView`，它连带滚动了设 `overflow: hidden` 的页面根节点。改用 kit `scrollIntoPanel`（§3b）。
- **整页多出一截纵向滚动（扫描报 vOverflow）**：面板里有绝对定位的元素（`sr-only` 的播报区最常见）却没有定位的祖先，它按初始包含块排在静态位置、把 html 撑高了。给面板内容包一层 `relative`（整栏面板的滚动区里那一层），它就随滚动区裁住（保真报告即如此）。
- **从菜单打开的面板拿不到焦点、或焦点先在 body / 触发按钮上停一两帧**：底座菜单关闭时已不抢回被新面板接走的焦点（§3b「菜单打开面板时的焦点」）；用 `holdFocusDuring(…, 落点)` 接住条目卸载的那一刻，挂载后再排到下一个任务兜一次（`setTimeout(…, 0)`），不要靠更长的延时去等。收起面板用 `closeWithFocusBack`（先交出焦点再卸载）。
- **画布顶部的提示条撞位**（约定，第 2 批集成定）：`CanvasHint` 同一位置只放一条——模式 / 操作提示（裁剪、格式刷、评论工具…）优先，页级提示（保真报告「本页有 N 处内容无法完整显示」）在模式提示出现时让位；新场景两种同时可能出现时按此处理。页级提示本身是一闪而过的（rulings §4.25 DS-51，`fidelity/canvas.tsx` 的 PageChip / ChipShell）：本会话每页只在第一次进入时出现，约 5 秒后淡出（减少动态效果时到点直接隐藏），悬停或焦点在里面时停住、移开后重新计时，不设 ×；报告开着时不出，选中降级对象时让位、之后不再补出（从它自己的「查看详情」打开的报告关上后接着显示，焦点回到「查看详情」）；提示条本身是 status · polite 区，出现时播报一次，不另设播报区（`CanvasHint announce="next-frame"`：出现后的两帧里内容先挡在无障碍树外再放进来，读屏看到的是已在的播报区里出现了内容，播报最稳，外观不变；第 1 批的模式提示条仍是缺省的 `inline`）；静态样张用状态数据 `chipHold` 把演示定格在出现后（用户第一次点按或按键后才计时）。第 2 批的整页无法解析另有 `fidelity.parse-hint`（提示条用危险色图标），`parse-failed` 一出现报告就开着、提示条不出。
- **横幅放进了面板或对话框**：面板 / 对话框里的状态说明用 `InspectorNotice`；`Banner` 只在横幅通道（§3b）。
