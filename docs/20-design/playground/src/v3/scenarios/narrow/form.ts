import { useLayoutEffect, useRef } from "react"
import { canvasFocusTarget, rescueFocus, useBreakpoint, useEditor, useSceneState, type Breakpoint, type SetSceneState } from "../../kit"
import type { V3View } from "../../params"

/**
 * 断点三形态（50/10 §2.2、50/09 §6.3 detectBreakpoint、01 §6）：
 *   desktop ≥ 1024 · compact 640–1024（不含 1024）· narrow < 640 或 pointer: coarse。
 * 状态的 data.form 决定用哪种：compact / narrow 强制该形态（截图与 Hub 链接在任何窗口里都看得到这个形态），
 * auto 跟着真实视口走（拖动窗口宽度即可看到三种形态切换）。
 */
export type Form = Breakpoint
export type FormSetting = "compact" | "narrow" | "auto"

/** 真实视口对应的形态：底座的 useBreakpoint（editor/breakpoint.ts，与 50/09 detectBreakpoint 同源）。 */
export const useViewportForm = useBreakpoint

/** 当前状态要呈现的形态（data.form，缺省 auto）。 */
export function useForm(): Form {
  const { data } = useEditor()
  const setting = (data.form as FormSetting | undefined) ?? "auto"
  const vp = useViewportForm()
  return setting === "auto" ? vp : setting
}

/** 紧凑形态的抽屉：同一时刻最多展开一个（幻灯片列表或检查器），保证画布与工具条始终有可用的一块。 */
export type Drawer = "rail" | "inspector" | null
/** 仅查看形态的底部面板：评论、幻灯片列表、更多（两侧在窄屏只以底部面板打开，同一时刻只开一个）。 */
export type Sheet = "comments" | "slides" | "more" | null

export function useDrawer(): [Drawer, SetSceneState<Drawer>] {
  const { data } = useEditor()
  return useSceneState<Drawer>("narrow.drawer", (data.drawer as Drawer | undefined) ?? null)
}

export function useSheet(): [Sheet, SetSceneState<Sheet>] {
  const { data } = useEditor()
  return useSceneState<Sheet>("narrow.sheet", (data.sheet as Sheet | undefined) ?? null)
}

/**
 * 面板开合后焦点要不要交给新出现的元素：用户点了开关（胶囊上的「显示…」、抽屉里的「收起…」）后，
 * 原来的开关随所在区域卸载，焦点交给另一处的同名开关；仅查看形态里用户打开底部面板后，焦点交给面板本身。
 * 状态刚打开时为 false（状态初始就展开的抽屉 / 面板不抢焦点），截图里不出现焦点环；不是用户点开关、而是别处替用户收起抽屉并另给了焦点落点时也复位为 false
 * （图表数据 / 投票 Sheet 接替抽屉、宿主进出母版视图、切换单页 / 网格、跨断点，见下面三个钩子）。
 */
export function useHandoff(): [boolean, SetSceneState<boolean>] {
  return useSceneState<boolean>("narrow.handoff", false)
}

/**
 * 形态外框最后一次按进出母版视图收起过抽屉时，宿主的母版视图开关：场景仓里的一条记录，几块外框共用一份，当作共用的 ref 用——
 * 只在布局副作用里读、改，改写它不通知订阅者、不多画一次。第一次读取时记下当时的开关：载入时就在母版视图里的演示态是 true，其余是 false
 * （载入不算一次进出，首帧不动）；换场景状态时随场景仓复位。
 */
const MASTER_SEEN_KEY = "narrow.masterSeen"

/**
 * 进出母版视图（宿主的全局模式，2026-10-28 母版视图改版第一步）时收起打开中的抽屉（设计 03-26 §1.1「进入时」：narrow.drawer 由外框在进出时收起，同下面跨断点的做法）：
 * 母版窗格抽屉不带到普通视图、幻灯片抽屉不带进母版视图。布局阶段收起（绘制前），首帧不动。
 * 同时把 handoff 复位为 false（2026-10-30 第一步修复第 5 轮，复验 R5-B1）：这一下收起抽屉的是宿主切换模式、不是用户点了面板开关，
 * 焦点由宿主交给落点（退出：画布，03-26 §1.1；进入：窗格里选中的那一行）——抽屉收起后胶囊上重新挂上的「显示…」开关不再按用户上一次点开关留下的 handoff
 * 把焦点抢走（同图表数据 Sheet、投票 Sheet 收起抽屉时的做法）。用户自己点「收起」、按 Esc 收起抽屉时照旧把焦点交给开关（close 里置真）。
 * 「开关变了」按场景仓里记下的那一份判断（MASTER_SEEN_KEY；2026-10-30 第一步修复第 6 轮，复验 R6-B1）：原来每块外框各用组件里的 ref 记上一次的开关，
 * 只有切换前后都挂着的一块看得到这次变化——网格视图一侧进出时宿主换了整套结构（进入：母版视图按单页结构画，单页的外框这次提交里才挂上；
 * 退出回网格：单页的外框随之卸下，换成网格的外框），钩子都不执行，抽屉与 handoff 原样留到下一次回单页。改为记在场景仓里，
 * 这次提交里新挂上的外框（单页的 StageRegion、网格的 GridRegion、紧凑母版态自己的 MasterCompactStage）也看得到「开关已变、还没收」，补做一次；
 * 同一次提交里先执行的一块（子组件先于父组件）收过了，后面的几块读到的已是新值，不再重复。只看运行时的开关，不按状态 id
 */
export function useCloseDrawerOnMasterToggle() {
  const { masterView } = useEditor()
  const [, setDrawer] = useDrawer()
  const [, setHandoff] = useHandoff()
  const [seen] = useSceneState<{ on: boolean }>(MASTER_SEEN_KEY, () => ({ on: masterView.on }))
  useLayoutEffect(() => {
    if (seen.on === masterView.on) return
    seen.on = masterView.on
    setHandoff(false)
    setDrawer(null)
  }, [masterView.on, seen, setDrawer, setHandoff])
}

/**
 * 单页 / 网格切换过之后，形态外框最后一次收抽屉时的视图：场景仓里的一条记录，做法同 MASTER_SEEN_KEY（几块外框共用、当作共用的 ref 用，
 * 只在布局副作用里读、改，改写不通知订阅者；第一次读取时记下当时的视图，载入不算一次切换；换场景状态时随场景仓复位）
 */
const VIEW_SEEN_KEY = "narrow.viewSeen"

/**
 * 普通视图里切换单页 / 网格时收起打开中的抽屉（rulings §4.25 DS-170：与进出母版视图、跨断点同一口径；50/10 §2.2 drawer「切到网格视图时复位」）：
 * 网格视图没有抽屉，切过去时 narrow.drawer 原来留着，回到单页抽屉又自己开着。布局阶段收起（绘制前），handoff 一并复位——焦点的落点由视图切换自己安排
 * （宿主 changeView），胶囊上重新挂上的「显示…」开关不按用户上一次点开关留下的 handoff 把焦点抢走。
 * 「视图变了」按场景仓里记下的那一份判断（VIEW_SEEN_KEY）：单页一侧的外框（StageRegion）随切到网格卸下、网格一侧（GridRegion）这次提交里才挂上，
 * 组件里的 ref 看不到这次变化；记在场景仓里，这次提交里新挂上的一块也看得到「视图已变、还没收」，补做一次，先执行的一块收过了，后面的读到新值不再重复。
 * 不用「外框卸下时收起」的写法：开发构建开着 StrictMode，模拟的卸下再挂上会把载入就开着的抽屉误收。只看运行时的视图，不按状态 id
 */
export function useCloseDrawerOnViewChange() {
  const { view } = useEditor()
  const [, setDrawer] = useDrawer()
  const [, setHandoff] = useHandoff()
  const [seen] = useSceneState<{ view: V3View }>(VIEW_SEEN_KEY, () => ({ view }))
  useLayoutEffect(() => {
    if (seen.view === view) return
    seen.view = view
    setHandoff(false)
    setDrawer(null)
  }, [view, seen, setDrawer, setHandoff])
}

/**
 * 跨断点切换（auto 时）：打开中的抽屉与底部面板关闭（50/10 §2.2「跨断点切换」）。首帧不动。
 * 焦点若在被收起的区域内，移到画布（50/16 §7；rulings §4.25 DS-168）：左栏与检查器收成抽屉、抽屉与底部面板关闭时，焦点所在的元素在这次提交里已随之卸下、
 * 掉到 body——布局阶段（绘制前）就交给画布，不在 body 上停；焦点还在打开着的抽屉里的，同样先交给画布再收起。
 * 只在这一页有焦点时接（document.hasFocus）：嵌入的 iframe 里焦点在宿主页面上、宿主拖动容器宽度跨过断点时，不把焦点抢进 iframe。handoff 一并复位：
 * 这一下收起抽屉的是窗口宽度、不是用户点了开关，胶囊上重新挂上的「显示…」开关不把焦点抢走（同 useCloseDrawerOnMasterToggle）
 */
export function useCloseOnFormChange(form: Form) {
  const [, setDrawer] = useDrawer()
  const [, setSheet] = useSheet()
  const [, setHandoff] = useHandoff()
  const prev = useRef(form)
  useLayoutEffect(() => {
    if (prev.current === form) return
    prev.current = form
    if (document.hasFocus()) {
      if (document.activeElement?.closest("[data-v3-drawer]")) canvasFocusTarget()?.focus({ preventScroll: true })
      else rescueFocus()
    }
    setHandoff(false)
    setDrawer(null)
    setSheet(null)
  }, [form, setDrawer, setSheet, setHandoff])
}
