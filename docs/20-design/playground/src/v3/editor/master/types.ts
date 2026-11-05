import type { ComponentType } from "react"
import type { InspectorConfig, RailConfig, RegionDefaults, ToolbarConfig } from "../../scenarios/types"
import type { EditorCtx } from "../context"
import type { SceneStore } from "../scene"

/**
 * 母版视图做成编辑器宿主的全局模式（2026-10-28，母版视图改版第一步「全局接线」，rulings §4.25 DS-144；directions §2.10 补两处参数）。
 * 宿主（Editor.tsx）与母版实现之间只有两份契约：
 *   一、EditorCtx.masterView（MasterViewMode）：宿主给场景与母版实现的模式接口——在不在母版视图、能不能进入、进入 / 退出 / 切换；
 *   二、registerMasterView(impl)（MasterViewImpl，editor/master/registry.ts）：母版实现在导入时登记一次，宿主在母版视图里改用它的几块区域来画。
 * 产品里对应 slide-ui domain/edit-target.ts 的 MasterEntryState 与 application/master-view.ts 的 enterMasterView / exitMasterView / goToLayout（50/11 §2–§3）；
 * 插拔接口 MasterViewImpl 本身只在样张里有（产品由 viewMode 的 when 驱动各贡献点，壳里没有母版视图的分支，40/10 §3a）。
 */

/** 进入 / 退出是从哪里发起的（宿主据此决定提示、焦点与是否恢复位置；「goto」是检查器里「编辑版式」「转到版式」这类带目标的入口，第二步用） */
export type MasterVia = "menu" | "shortcut" | "palette" | "banner" | "escape" | "review" | "narrow" | "present" | "goto"

/** 能不能进入：ok；不能时 reason 是与主菜单、命令面板同一条原因；silent = 这个状态没有编辑器外壳（放映舞台、查看器、阻断页），不列、不提示 */
export interface MasterEntry {
  ok: boolean
  reason?: string
  silent?: boolean
}

/** enter 的目标（directions §2.10）：「转到版式」「编辑版式」带上要选中的版式与占位符（按类型 / 索引匹配）；不带时选当前页所用的版式 */
export interface MasterTarget {
  layout?: string
  placeholder?: { type: string; index?: number }
}

/**
 * exit 的选项（directions §2.10）：slide 退出后停在这一页（不回进入前的页）；slides「在普通视图查看引用页」——退出后停在第一页并选中这些页
 * （回到单页视图时左栏缩略图、回到网格视图时网格里都按各自已有的多选画法画出；换页即清掉。网格一侧 2026-10-29 补完，复验 R2-N6、R4-N4 第二条）
 */
export interface MasterExitOptions {
  slide?: number
  slides?: number[]
}

/**
 * 会话记忆（50/11 §2 sessionMemory 的样张版：只在内存里，进入时写入、退出时恢复后清空）：
 * 视图（单页 / 网格）由 URL 的 view 承担（母版视图里宿主按单页结构画、不改 URL）；缩放比例在场景仓里（view-zoom 的 useZoom），进出都留着，不记在这里——
 * 放大后画布自己的滚动位置记在 stageScroll（退出时画布重新挂载，滚动会回到初值）。
 */
export interface MasterMemory {
  /** 进入前的页 */
  slide: number
  /** 检查器页签（v3.inspector.tab） */
  tab: "design" | "comments"
  /** 左栏缩略图列表与网格的滚动位置（scrollTop） */
  railScroll: number
  gridScroll: number
  /**
   * 画布本身的滚动位置（放大到超过适应窗口时画布可滚动，如 view-zoom 的固定比例；适应窗口时恒为 0, 0）：单页视图里进入时读，退出后还原（03-26 §1.1「回到进入前的…缩放、滚动」）。
   * 2026-10-29 第一步修复第 4 轮（复验 R4-B2）
   */
  stageScroll: { left: number; top: number }
  /**
   * 进入时状态声明的整栏面板（inspector.takeover：保真报告、插件面板的整栏形态等）开着：进入时不关，只在母版视图里不画（面板在场景仓里仍算开着，
   * 当前项、定位高亮与面板自己记在场景仓里的状态都留着）；退出后照原样显示、不抢焦点（rulings §4.25 DS-162：恢复到进入前的样子）。
   * 依附选中对象的整栏面板（图表数据面板这类由场景按选中自己画的）不在此列：退出时选区清空，随之不恢复
   */
  takeoverOpen: boolean
  /** 上面那块整栏面板内容区的滚动位置（scrollTop）：面板在母版视图里随检查器卸下，退出后重新挂上时写回 */
  takeoverScroll: number
}

/** 一、宿主给场景与母版实现的模式接口（EditorCtx.masterView；kit useMasterViewMode() 取的就是它） */
export interface MasterViewMode {
  /** 正在母版视图里 */
  on: boolean
  /** 每次从普通视图进入加 1（演示态载入时就在母版视图里，为 0）：母版实现据此知道「这是一次新的进入」 */
  session: number
  /** 能不能进入（与主菜单显示同一条原因）；母版视图里恒为可用（降权、缩到紧凑后仍能退出） */
  entry: MasterEntry
  /** 本次进入前的位置；不在母版视图里时为 null */
  memory: MasterMemory | null
  /** 本次进入带的目标（没有带或演示态载入时为 null） */
  target: MasterTarget | null
  /** 进入：不可用时按 entry 给一次轻提示（命令面板自己播报，不另提示），返回 false */
  enter(via: MasterVia, target?: MasterTarget): boolean
  /** 退出：恢复进入前的页、检查器页签、滚动与视图，选区清空，焦点交给画布 */
  exit(via: MasterVia, opts?: MasterExitOptions): void
  toggle(via: MasterVia): void
}

/**
 * 二、母版实现（registerMasterView 登记给宿主）。宿主在母版视图里用这几块代替状态的 regions（narrow 这类形态外框写了 masterView.frameRegions 的照常套在外面）：
 *   Rail / Inspector / Toolbar 拿到底座的缺省渲染 base（可 base({ … }) 复用 240 左栏顶部、检查器外框）与外框传下来的覆盖 over；
 *   Banner 由宿主放在横幅通道最上面（状态另有横幅时用 BannerStack 叠在它下面，TB-14）；Overlay 画在画布列里。
 * 形态外框拿到的 d 就是这几块（d.leftRail / d.stage / d.inspector / d.toolbar）：紧凑形态的母版外框（narrow/compact-features.tsx）四块都经 d 取，
 * 外框只给抽屉、胶囊这类形态自己的东西，不另塞母版件——换一份实现时紧凑形态跟着换（2026-10-29 补完，复验 R2-N5、R4-N4 第一条）。
 * 三个钩子在宿主的进入 / 退出 / Esc 路径上同步调用（scene 是本次挂载的场景仓，ed 是调用这一刻的编辑器上下文）。
 */
export interface MasterViewImpl {
  Rail: ComponentType<{ base: RegionDefaults["leftRail"]; over?: RailConfig }>
  Stage: ComponentType
  Inspector: ComponentType<{ base: RegionDefaults["inspector"]; over?: InspectorConfig }>
  Toolbar: ComponentType<{ base: RegionDefaults["toolbar"]; over?: ToolbarConfig }>
  Banner: ComponentType
  /** 画布列里母版自己的轻提示等（可省） */
  Overlay?: ComponentType
  /** 每次从普通视图进入：选中目标版式（缺省当前页所用的版式）、清掉内部选中，收起上次留下的弹层 */
  onEnter?(scene: SceneStore, ed: EditorCtx, target: MasterTarget | null): void
  /** 退出前：收起占位符菜单、主题画廊 / 主题颜色与字体 */
  onExit?(scene: SceneStore, ed: EditorCtx): void
  /** Esc 逐层：浮层与抽屉之后、退出之前，由实现先接（取消占位符选中等），接住返回 true */
  onEscape?(scene: SceneStore, ed: EditorCtx): boolean
  /**
   * 进入后焦点的落点（rulings §4.25 DS-166：窗格里选中的那一行）；不给或找不到时交给画布。
   * 参数同 onEnter（target 是本次进入带的目标，没带时为 null）：「转到版式」带了占位符目标时，实现可以把焦点交给画布上那个占位符（directions §2.9）。
   * 宿主在进入的那一刻（入口卸载、焦点要掉到 body 时）与提交之后各调一次。2026-10-29 补完（复验 R2-N7、R4-N4 第三条）：原来没有参数
   */
  entryFocus?(scene: SceneStore, ed: EditorCtx, target: MasterTarget | null): HTMLElement | null
}
