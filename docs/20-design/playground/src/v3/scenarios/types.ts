import type { ReactNode } from "react"
import type { Person } from "../data"
import type { EditorCtx } from "../editor/context"
import type { CollaboratorsConfig, ShareConfig } from "../editor/chrome"
import type { DeckSlide } from "../editor/deck"
import type { InspectorSectionDef, SelectionKind } from "../editor/inspector/registry"
import type { NewSlideOption } from "../editor/LeftRail"
import type { ToolId, ToolKey, ToolMenuId } from "../editor/Toolbar"
import type { EditorCommand } from "../kit/commands"
import type { MainMenuOptions } from "../kit/mainMenu"
import type { MenuSpec } from "../kit/Menu"
import type { ShellLayoutProps } from "../kit/ShellLayout"
import type { PageCtx } from "../page/context"
import type { V3Host, V3View } from "../params"

/**
 * 场景（scenario）：一份界面规格（docs/20-design/03-screens/NN）在 v3 编辑器里的一组状态。
 * 每个场景一个文件 src/v3/scenarios/<场景 id>/<场景 id>.scenario.tsx，默认导出 defineScenario({...})；
 * 编辑器与 Hub 用 import.meta.glob 自动发现，不需要在任何共享文件里登记。
 * 打开方式：#/v3/editor?state=<场景 id>.<状态 id>&theme=dark|light（只写场景 id 时取第一个状态）；第 3 批的页面级宿主写 #/v3/<宿主>?state=…（host）。
 * 用法与约定见同目录 README.md。
 */
export interface Scenario {
  /** 场景 id：小写 kebab-case、全局唯一、不含「.」，如 "find-replace"。以「_」开头的场景（如 _kit）不在 Hub 展示 */
  id: string
  /** Hub 卡片标题，如「查找与替换」 */
  title: string
  /** 对应的界面规格编号，如 ["03-21"]；第一个用于 Hub 排序 */
  specs: string[]
  /** 一句话说明（Hub 卡片描述） */
  summary?: string
  /** 迁移批次（rulings §4.25 DS-8）：1 编辑器族（缺省）、2 协作族、3 应用壳族 */
  batch?: 1 | 2 | 3
  /** 不在 Hub 展示（缺省：id 以「_」开头时不展示） */
  hidden?: boolean
  /**
   * 宿主（第 3 批，params.ts V3_HOSTS）：editor（缺省，用 editor 配置）· home · documents · templates · admin/plugins（应用壳，用 page 配置的 shell / body）·
   * page（整屏 bare，用 page.body）· embed（中性宿主外框 + iframe，用 page.embed）。状态可单独覆盖（ScenarioState.host），如账户菜单在首页与编辑器各有几态。
   * 在别的宿主路由上打开时自动转到自己的宿主（参数原样带上）
   */
  host?: V3Host
  /** 页面级宿主（host 不是 editor）的场景级配置；每个状态的 page 在此基础上覆盖（见 mergePage） */
  page?: PageConfig
  /**
   * 这个场景演示哪些底座命令（命令 → 状态 id）：别的场景状态里没有处理函数接住这个命令时（如在评论样张里选文档菜单「版本历史」），
   * 编辑器转到这里的这个状态，不静默无响应（ED-30，kit/commands.ts）。如版本历史：{ "doc.history": "default" }。
   * 不同模式下这个命令打开的东西不一样时按模式分开写（{ edit, review, viewer }，缺的模式取 edit 的）：如分享，所有者视角与非所有者的「谁能访问」
   */
  provides?: Partial<Record<EditorCommand, ProvidedState>>
  /** 场景内各状态共用的编辑器配置；每个状态在此基础上覆盖（见 mergeConfig） */
  editor?: EditorConfig
  /** 状态列表：第一个是默认态 */
  states: ScenarioState[]
}

/**
 * 演示某个底座命令的状态（Scenario.provides）：一个状态 id，或按模式分开写（缺的模式取 edit 的）；
 * 第 3 批转正起还可以按宿主写（键是宿主名，如 home：在开始页上发这个命令时转到它，优先于模式），如偏好设置 { edit: "default", home: "from-home" }
 */
export type ProvidedState = string | Partial<Record<EditorMode | V3Host, string>>

/** 编辑器模式（EditorConfig.mode）：编辑 / 评审 / 只读浏览 */
export type EditorMode = "edit" | "review" | "viewer"

export interface ScenarioState {
  /** 状态 id：小写 kebab-case、场景内唯一，如 "default"、"no-match"、"readonly" */
  id: string
  /** 状态标题（Hub 链接的行标签），如「无匹配」 */
  title: string
  /** 说明：演示什么、对应规格哪一节（Hub 行标签的悬停提示，也方便评审对照） */
  note?: string
  /** 这个状态的编辑器配置（覆盖场景级 editor） */
  editor?: EditorConfig
  /** 这个状态的宿主（覆盖场景级 host） */
  host?: V3Host
  /** 页面级宿主的配置（覆盖场景级 page） */
  page?: PageConfig
}

/* ------------------------------------------------------------------ 页面级宿主（第 3 批） */

/** 页面宿主的插槽：直接给 React 节点，或给一个拿到页面上下文的函数（page/context.ts usePage 同一份） */
export type PageSlot = ReactNode | ((ctx: PageCtx) => ReactNode)

/**
 * 页面级宿主的配置（PageHost.tsx）：
 * - 应用壳（home / documents / templates / admin/plugins）：shell 是 kit ShellLayout 的属性（左栏当前项与导航、顶栏标题与右侧按钮、横幅与位置、账户菜单…），
 *   body 是顶栏（与横幅）以下的主区内容（home 缺省是已拍板的首页内容 HomeBody），overlay 画在主区（relative）里（轻提示等）；
 * - page：body 是整屏内容（宿主给画布底色、纵向 flex，常放 kit BlockingPage），overlay 同理；
 * - embed：embed 给容器尺寸与 iframe 里加载的页面，外框由宿主画。
 * layers 是浮层（Dialog、Drawer、Menu…，自己挂到 v3 根节点），data 是状态私有数据（usePage().data）。
 */
export interface PageConfig {
  shell?: ShellConfig
  body?: PageSlot
  overlay?: PageSlot
  layers?: PageSlot
  embed?: EmbedConfig
  data?: Record<string, unknown>
}

/** 应用壳的属性（kit ShellLayout 去掉 children / overlay） */
export type ShellConfig = Omit<ShellLayoutProps, "children" | "overlay">

/**
 * 嵌入宿主（DS-73）：中性的「宿主页面」外框里一个 iframe 容器。iframe 加载同一个 playground 的另一个宿主路由（真实的视口宽度，
 * 编辑器的三种形态按容器宽度取，DS-17），带 embedded=1、主题与强调色沿用外层。URL 参数 frame=宽x高 可临时改容器尺寸（截图对照几种尺寸用）
 */
export interface EmbedConfig {
  /** 容器尺寸（CSS 像素，宽 × 高），如 [1200, 720]、[900, 520]、[640, 360] */
  size: [number, number]
  /** iframe 里的页面：宿主 + 场景状态（<场景>.<状态>）+ 其余参数 */
  src: { host: V3Host; state?: string; params?: Record<string, string> }
  /** 外框标题行的说明（缺省「宿主页面（演示容器，不代表任何真实产品）」） */
  label?: string
  /** 外框标题行右侧的尺寸说明（缺省「iframe 宽 × 高」；不是 iframe 的形态 C 写「容器 宽 × 高」） */
  frameLabel?: string
}

/** 插槽：直接给 React 节点，或给一个拿到编辑器上下文的函数（需要随用户操作变化时用函数）。 */
export type Slot = ReactNode | ((ctx: EditorCtx) => ReactNode)

/** 整块替换某个区域；defaults 里是该区域与其他区域的默认渲染，可以包一层或拼着用。 */
export type RegionSlot = (ctx: EditorCtx, defaults: RegionDefaults) => ReactNode

/** 各区域的默认渲染。左栏、检查器、工具条可以传一份覆盖（逐字段盖在状态配置上），如母版视图里 defaults.leftRail({ list: <MasterPane /> })。 */
export interface RegionDefaults {
  /** 左栏（单页视图） */
  leftRail: (over?: RailConfig) => ReactNode
  /** 画布（单页视图：幻灯片 + 备注） */
  stage: () => ReactNode
  /** 右侧检查器（单页视图） */
  inspector: (over?: InspectorConfig) => ReactNode
  /** 底部浮动工具条 */
  toolbar: (over?: ToolbarConfig) => ReactNode
  /** 网格视图（两个浮动胶囊 + 幻灯片网格） */
  grid: () => ReactNode
}

/**
 * 编辑器配置：描述一个状态下编辑器的样子。所有字段都可省略，省略即编辑器的默认样子
 * （第 2 页、无选中、选择工具、单页视图、备注展开、检查器「设计」页签）。
 */
export interface EditorConfig {
  /**
   * 模式：edit 编辑（缺省）· review 评审（02 §6.2）· viewer 只读浏览（查看者）。
   * review / viewer 时：底部工具条换成评审条 / 浏览条（toolbar.comments、canEdit、hint 调整），左栏不提供新建，
   * 检查器只读并在顶部注明「只读 · 评审模式下不可编辑」/「只读 · 你只有查看权限」，主菜单里改文档的命令不可用。各项仍可单独覆盖。
   */
  mode?: "edit" | "review" | "viewer"
  /**
   * 视图：single 单页（缺省）/ grid 网格。URL 参数 view 仍是视图的唯一状态源：
   * Hub 与 scenarioHref 生成的链接会带上 view=grid；手写的链接没带时，编辑器挂载后把 URL 改成这里的值，之后用户可以自由切换。
   */
  view?: V3View
  /** 文档幻灯片：缺省示例文档 6 页；用 deckWith() 改页、加页（表格页、图表页…） */
  deck?: DeckSlide[]
  /** 当前页（页码，缺省 2） */
  slide?: number
  /** 选中对象种类，决定检查器显示哪些分区（缺省 none = 幻灯片属性）。示例第 2 页 + shape 会在要点卡上画选中框；第 1 页 + text 画标题的文字编辑态 */
  selection?: SelectionKind
  toolbar?: ToolbarConfig
  rail?: RailConfig
  inspector?: InspectorConfig
  stage?: StageConfig
  /** 幻灯片叠加层：画在画布当前页上（父元素就是幻灯片框，用百分比定位；kit/canvas 的 SelectionBox、Marquee、Guide 等）。ReactNode 只在初始页与初始选中时显示，要自己控制就用函数 */
  slideOverlay?: Slot
  /** 画布叠加层：画布列（左右栏之间）里绝对定位的东西，如 FloatingPanel（查找替换浮动条）、Toasts（轻提示） */
  canvasOverlay?: Slot
  /** 横幅：画布列顶部、左右栏之间（kit 的 Banner）；只在单页视图显示 */
  banner?: Slot
  /** 打开的浮层：Popover、Menu、ContextMenu、Dialog 等 kit 组件（按锚点定位，自己会挂到 v3 根节点）。非 kit 的元素在这里需要自己加 pointer-events-auto */
  layers?: Slot
  /** 整块替换（逃生口）：上面的配置不够用时才用，如母版视图换掉左栏 */
  regions?: Partial<Record<keyof RegionDefaults, RegionSlot>>
  /** 状态私有数据：分区组件从 InspectorCtx.data、其他组件从 useEditor().data 读取 */
  data?: Record<string, unknown>
  /**
   * 面板尺寸（03-20「面板尺寸与记忆」）：左栏宽（缺省 240，160–420）、检查器宽（缺省 280，240–480，PRD ED-12）、备注高（缺省 120，64–320）；
   * 用户拖动分隔条后按文档记在本机（localStorage），状态写了的值优先。active 让某条分隔条显示悬停 / 拖动中的样子（演示）。
   */
  panels?: { rail?: number; inspector?: number; notes?: number; active?: "rail" | "inspector" | "notes" }
  /**
   * 母版视图（宿主的全局模式，2026-10-28 母版视图改版第一步；editor/master/）。不写时：这个状态有母版入口，载入时在普通视图里，能不能进入由宿主按模式、权限、形态等判
   * （editor/master/mode.ts masterEntryOf）。false：这个状态没有母版入口（没有编辑器外壳的状态：查看器 preset 等；阻断页写了 toolbar.collapse 的同样没有）。
   *   open          载入时已在母版视图（master-view.*、narrow.compact-master*、offline-conflict.master-*）：区域、横幅由登记的母版实现画，regions 与横幅叠放见 frameRegions
   *   frameRegions  本状态的 regions 是形态外框（narrow 的紧凑抽屉与胶囊）：母版视图里照常套在母版区域外面（defaults 换成母版区域）；不写时母版视图里一律不用状态的 regions
   * 场景级与状态级逐字段合并（mergeConfig）
   */
  masterView?: false | { open?: boolean; frameRegions?: boolean }
}

export interface ToolbarConfig {
  /** 当前工具（缺省 select）。锚在工具按钮上的弹层打开时，把对应工具设为当前，按钮显示强调色底 */
  tool?: ToolId
  /** 内置形状弹层展开（需要 tool: "shapes"） */
  shapesOpen?: boolean
  /** 形状弹层显示哪一层：quick 常用 4 × 3 + 「全部形状」（缺省）· library 完整形状库（03-15） */
  shapesView?: "quick" | "library"
  /** 形状库里当前的插入工具（形状 id，强调色浅底） */
  shapesActive?: string
  /** 不显示工具条（如裁剪模式临时收起）；画布仍给它留位置，进出时画布不跳动 */
  hidden?: boolean
  /** hidden 时也不留位置（整个工作区被替换时，如打开失败页） */
  collapse?: boolean
  /** 编辑工具条里不可用的条目与原因：{ text: "需要编辑权限", more: "…" }，键为工具 id 或 "more"；工具留在原位不隐藏，工具提示「名称 · 原因」。整组同一原因可用 kit 的 lockTools() */
  disabled?: Partial<Record<ToolKey, string>>
  /**
   * 不出现的创建工具（贡献点的 when 为假，如 M2 未装评论包时没有「评论」，03-02 §3.4）：条目整个不渲染、不留位，单键（C）同样无效。
   * 与 disabled 不同：disabled 是「在、但暂不可用」，hide 是「这个部署 / 这一刻根本没有」
   */
  hide?: ToolKey[]
  /** 演示「原因」：这个工具的提示一出现就展开（lines 按句分行），用户第一次点按或按键后收起，如 { tool: "chart", lines: [...] } */
  tip?: { tool: ToolKey; lines?: string[] }
  /** 评审条 / 浏览条：上一处 / 下一处评论之间的计数（缺省 = 文档里的评论总数；浏览条为 0 时不显示跳转） */
  comments?: number
  /** 评审条：有编辑权限时右端显示「返回编辑」（缺省 true；评审者为 false，主菜单「模式 › 编辑」同时不可用） */
  canEdit?: boolean
  /** 评审 / 浏览模式下没有任何条目时（M2 未装评论包）：工具条位置只放这句只读提示，如「评审模式 · 只读」 */
  hint?: string
  /** 一出现就打开底座的工具弹层：image 图片 ▾ · table 表格网格 · chart 图表类型菜单（图表场景登记）。场景自己在 layers 里画弹层时不要再写 */
  menu?: ToolMenuId
  /**
   * 换掉工具条「更多」的条目（缺省底座 moreMenu，03-04）：插件很多时的收纳（TB-31）这类状态在 layers 里静态打开同一份「更多」时，
   * 把同一份条目也给底座，关掉后再从工具条打开，内容与载入时一致（登记过的面板照常接上）
   */
  moreItems?: MenuSpec[]
}

export interface RailConfig {
  /** 文件名下方的同步状态（缺省「✓ 已同步」）；用 RailStatus 组件保持同样的字号与对齐 */
  status?: ReactNode
  /** 另外高亮的缩略图（多选），页码列表；当前页总是高亮 */
  selected?: number[]
  /** 替换整个缩略图列表（如节标题、拖动插入线）：用 RailList + RailThumb 拼 */
  list?: Slot
  /** 已隐藏的页（放映时跳过）：页码加斜线、眼睛图标、缩略图 60% 不透明（03-14） */
  hidden?: number[]
  /** 「新建幻灯片 ▾」与「+」：false 不渲染这一行（评审 / 浏览模式缺省）；{ reason } 留在原位但不可用；label / menu 换文字与菜单（母版视图「新建版式」） */
  newSlide?: NewSlideOption
  /** 顶部「单页 / 网格」：false 不渲染（母版视图没有网格）；{ reason } 不可用（打开中） */
  viewToggle?: false | { reason: string }
  /** 主菜单条目定制：canEdit、母版视图、各子菜单（kit/mainMenu.tsx MainMenuOptions） */
  menu?: Partial<MainMenuOptions>
  /** 作为紧凑形态的抽屉渲染（narrow 场景）：宽度固定 240、没有右缘分隔条——不论真实视口是否 ≥ 1024（强制紧凑形态的截图 / Hub 链接也一样） */
  drawer?: boolean
  /**
   * 编辑模式已降权（03-12 readonly-degraded，DS-15）：改文档的命令不可用并写这个原因（典型值「需要编辑权限」，不隐藏、仍可聚焦）——
   * 主菜单（编辑 / 插入 / 排列 / 母版视图，单页左栏与网格胶囊同一份）与缩略图右键（左栏与网格）。创建工具、「新建幻灯片」、检查器另按各自配置（toolbar.disabled、newSlide、inspector.readOnly）。
   * 评审 / 浏览模式不用它（mode 已覆盖）。
   */
  readonlyDegraded?: string
}

export interface InspectorConfig {
  /** 初始页签（缺省 design） */
  tab?: "design" | "comments"
  /** 面板标题（缺省取 inspectorPanel 注册的标题）；null 不显示标题行。只在当前选中种类等于状态的 selection 时生效 */
  title?: ReactNode | null
  /** 只显示这些分区、按此顺序：写注册的分区 id，或直接写一个分区定义（状态私有的变体）。只在当前选中种类等于状态的 selection 时生效 */
  sections?: (string | InspectorSectionDef)[]
  /** 隐藏这些注册分区（id）。只在当前选中种类等于状态的 selection 时生效 */
  hide?: string[]
  /** 面板顶部的说明行（kit 的 InspectorNotice），如「只读 · 评审模式下不可编辑」；与选中种类无关 */
  notice?: ReactNode
  /** 说明行显示在哪些页签：design（缺省，只在「设计」）· all（「评论」页签也显示；浏览模式缺省，查看者也不能回复评论） */
  noticeIn?: "design" | "all"
  /** 只读：传给分区（InspectorCtx.readOnly），检查器滚动区带 data-v3-readonly，外观由分区决定 */
  readOnly?: boolean
  /** 字段暂不可用的原因（编辑权限被降级等）：传给分区（InspectorCtx.disabled），字段留在原位、aria-disabled、工具提示写原因；内置「幻灯片」各节即如此 */
  disabled?: string
  /** 「评论」页签：false 不显示（M2 未装评论包）；{ reason } 留在原位但不可用（母版视图「母版与版式不支持评论」） */
  commentsTab?: false | { reason: string }
  /**
   * 顶行头像组：在场的人与折叠人数（超过 5 人时第 6 位起折叠为「+N」，锚点 collaborators-more）；people 为空时不显示头像组。
   * 第 3 批转正起（2026-10-22）：人可带同色序号 seq（rulings §4.25 DS-132，头像下沿中线的数字角标）；following 是跟随的初值（姓名，DS-106：他人头像缺省是「跟随」按钮，
   * 跟随中底座画跟随条与画布外框）；list 换掉「+N」点开的在线列表内容（缺省 main-states 登记的 presence:list），listOpen 一出现就开着（DS-132「在线列表按状态给」）
   */
  collaborators?: CollaboratorsConfig
  /** 整栏暂不可用（打开中）：放映、分享、页签、缩放都不可用，工具提示写这个原因；分区照常按选中种类渲染（这个原因同时作为 disabled 传给它们） */
  locked?: string
  /**
   * 「分享」按钮（检查器顶行、网格右上胶囊、紧凑形态右上胶囊是同一个按钮）的宿主声明（rulings §4.25 TB-161，editor/chrome.tsx ShareConfig）：
   * 不写 = 宿主传了 onShare（M3 起），可用；kit SHARE_LATER = M2（宿主传 shareUnavailable: 'later'，DS-137）：留在原位、不可用，工具提示「分享 · 后续版本提供」；
   * false = 宿主两样都不传，不渲染；{ reason } = 只有「分享」暂不可用的其他原因（如文档已被删除）。整栏都不可用用 locked
   */
  share?: ShareConfig
  /** 换掉「设计」页签的内容（面板标题与分区），外框（协作行、页签行、缩放）仍用底座的，如母版视图的版式 / 母版属性 */
  body?: Slot
  /**
   * 换掉「评论」页签的内容（第 2 批评论：筛选、线程、回复、解决…），外框（协作行、页签行、缩放）仍用底座的；notice / noticeIn 照常（noticeIn: "all" 时说明行在它上方）。
   * 内容放在占满滚动区高度的纵向 flex 容器里（滚动区就是检查器的滚动区）：回复框要贴底就给它 mt-auto（内容超高时随列表滚动，要常驻就 sticky bottom-0 加 panel 底）。
   * 不传时是底座的缺省内容（本页评论的静态列表）。一出现就停在评论页签写 tab: "comments"
   */
  commentsBody?: Slot
  /**
   * 整栏面板（DS-26 先例：图表「编辑数据」）：状态一出现，检查器整栏就换成它——写 kit 的 <InspectorTakeover title=… width=…>…</InspectorTakeover>，
   * 栏临时加宽（缺省 400），协作行照旧，「设计 / 评论」页签行换成面板标题行（「收起到检查器」可选、「关闭」· Esc）。
   * 「关闭」/ Esc 收起它、检查器回到常规页签；场景里自己的入口用 kit 的 useTakeoverOpen() 再打开。版本历史、插件面板这类整栏面板用它；
   * 要随场景状态开关（如图表数据面板随「展开」）就改用 regions.inspector（见 InspectorTakeover 文件头）。null 取消场景级声明的面板
   */
  takeover?: Slot
  /**
   * 状态一出现时整栏面板开着没有（缺省 true）：false = 面板已声明、但先收着，等场景里的入口（菜单项、按钮）用 useTakeoverOpen() 打开，
   * 如版本历史的「文档菜单入口」、保真报告「打开后有差异 · 轻提示」。编辑器挂载时写进场景仓，左栏、画布、检查器第一次读到的就是它
   */
  takeoverOpen?: boolean
  /** 作为紧凑形态的抽屉渲染（narrow 场景）：宽度固定 280、没有左缘分隔条——不论真实视口是否 ≥ 1024 */
  drawer?: boolean
}

export interface StageConfig {
  /** 备注区展开（缺省 true）；用户仍可从主菜单「视图」切换 */
  notes?: boolean
  /** 备注内容（缺省是占位文字「添加演讲者备注…」） */
  notesText?: ReactNode
  /** 远端协作者光标：false 不显示；{ at, name } 换位置（at 为 Tailwind 定位类，如 "left-[40%] top-[30%]"）。缺省示例页各有一处「李雷」 */
  cursor?: false | { at: string; name?: string }
  /**
   * 画布上照常画示例文档的评论钉（底座 DeckCommentPins：第 4 页 3 枚，点钉切到检查器「评论」页签并定位那一条，01 §2.3）。rulings §4.25 DS-43「编辑模式照常显示评论钉
   * （只有放映与母版视图不显示）」；TB-83（第 3 批）起缺省开：不写时以编辑模式起步的状态都画，以评审 / 只读浏览起步的状态由场景自己画（第 1 批评审态用评论场景的 CommentLayer）；
   * 评论场景与借用它的状态（DECK_COMMENTS）写 false（自己画可交互的钉）；没有评论包（inspector.commentsTab: false 或 toolbar.hide 含 comment）时不画；
   * 换了内容的页不画（页自己写了 DeckSlide.pins 的除外）。开着时钉与左栏、网格的评论角标读评论场景登记的线程数据（kit registerCommentPins），在缺省评论面板里解决或删除一条随之变化
   */
  commentPins?: boolean
}

/** 定义场景（只是带类型的恒等函数）。 */
export function defineScenario(s: Scenario): Scenario {
  return s
}

/** 合并页面宿主的场景级与状态级配置：顶层字段覆盖，shell / data 逐字段合并。 */
export function mergePage(base: PageConfig = {}, over: PageConfig = {}): PageConfig {
  return { ...base, ...over, shell: { ...base.shell, ...over.shell }, data: { ...base.data, ...over.data } }
}

/** masterView 的合并：状态级写 false 即没有母版入口；两级都是对象时逐字段合并（如 narrow 场景级 frameRegions + 状态级 open） */
function mergeMasterView(base: EditorConfig["masterView"], over: EditorConfig["masterView"]): EditorConfig["masterView"] {
  if (over === undefined) return base
  if (over === false || base === undefined || base === false) return over
  return { ...base, ...over }
}

/** 合并场景级与状态级配置：顶层字段覆盖，toolbar / rail / inspector / stage / regions / data / masterView 逐字段合并。 */
export function mergeConfig(base: EditorConfig = {}, over: EditorConfig = {}): EditorConfig {
  return {
    ...base,
    ...over,
    toolbar: { ...base.toolbar, ...over.toolbar },
    rail: { ...base.rail, ...over.rail },
    inspector: { ...base.inspector, ...over.inspector },
    stage: { ...base.stage, ...over.stage },
    regions: { ...base.regions, ...over.regions },
    data: { ...base.data, ...over.data },
    panels: { ...base.panels, ...over.panels },
    masterView: mergeMasterView(base.masterView, over.masterView),
  }
}
