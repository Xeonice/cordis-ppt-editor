import { arrivedVia, useEditor, useSceneState, useTakeoverOpen } from "../../kit"
import { reportFor, type ReportItem, type Variant } from "./data"

/**
 * fidelity 场景内跨区域共享的状态（kit useSceneState：左栏、画布、检查器、浮层读写同一份，换状态即复位）。
 * 各状态的初值写在 EditorConfig.data（FidelityData）。
 */
export interface FidelityData {
  /** 文档变体（缺省 main）。报告（检查器整栏面板）一出现就开着的状态写 inspector.takeoverOpen: true，不在这里 */
  variant?: Variant
  /** 报告的范围：全部 / 本页 */
  filter?: Scope
  /** 已定位的一处（报告里该行为当前项，画布上高亮） */
  located?: { id: string; i: number } | null
  /** 一出现就显示的轻提示 */
  toast?: ToastKind | null
  /**
   * 页级提示条的演示定格（静态样张用）：状态一出现、提示条刚出现的那一刻停住，不开始约 5 秒的淡出计时；用户第一次点按或按键后照常计时
   * （kit useDemoOpen 同一口径）。页级提示条本身每页只在本会话第一次进入时出现，见 canvas.tsx PageChip
   */
  chipHold?: boolean
  /** 打开报告时滚到这一条（如「字体」分组） */
  focus?: string | null
  /** 外部内容（externalResources = confirm）已点「加载」 */
  extLoaded?: boolean
  /** 报告的形态：panel 检查器整栏面板（缺省，推荐）· dialog 模态对话框（备选 alt-dialog：各入口打开的都是对话框） */
  reportForm?: "panel" | "dialog"
}

export type Scope = "all" | "page"
/** open 打开文档后有差异 · parse 有页面无法解析 · font 进入编辑时的受限字体 · degraded 双击无法显示的对象 */
export type ToastKind = "open" | "parse" | "font" | "degraded"
export interface Located {
  id: string
  /** 在 item.occ 里的下标 */
  i: number
  /** 每次定位加一：画布高亮重新出现、重新淡出 */
  n: number
}

const K = "fidelity."

export function useFidelityData(): FidelityData {
  return useEditor().data as FidelityData
}

/** 报告开着没有：就是状态声明的整栏面板（inspector.takeover）的开关（kit useTakeoverOpen，初值是状态的 inspector.takeoverOpen） */
export const useReportOpen = useTakeoverOpen
export const useScope = () => useSceneState<Scope>(`${K}scope`, useFidelityData().filter ?? "all")
export const useToast = () => useSceneState<ToastKind | null>(`${K}toast`, useFidelityData().toast ?? null)
/**
 * 页级提示条的生命周期（rulings §4.25 DS-51）：seen 本会话里已经进入过的页（每页只在第一次进入时出提示条；进入时报告开着、选中了降级对象也算进入过，之后不再补出）；
 * page 正在显示提示条的那一页（null 没有）——换页、选中降级对象（让位）、从别处打开报告、淡出后清掉。
 * 从提示条自己的「查看详情」打开报告时不清：报告开着时提示条不出（保留在页面上但隐藏），报告关闭后接着显示、焦点回到「查看详情」
 */
export interface ChipLife {
  seen: number[]
  page: number | null
}
export const useChipLife = () => useSceneState<ChipLife>(`${K}chip`, { seen: [], page: null })
/**
 * 关闭报告后焦点交给的锚点（打开它的那个控件：主菜单 main-menu、检查器「保真详情」fidelity.detail、页级提示条「查看详情」fidelity.chip-detail、占位 fidelity.chartex；缺省交给画布）。
 * 初值：从别的样张选「文件 › 保真报告」转过来的（命令兜底，报告一出现就开着）是触发它的主菜单按钮（kit arrivedVia），否则没有
 */
export const useReturnFocus = () => useSceneState<string | null>(`${K}return`, arrivedVia)
/** 备选 alt-dialog：报告对话框开着没有（状态出现时开着；主菜单等入口重开的也是对话框） */
export const useReportDialogOpen = () => useSceneState<boolean>(`${K}dialog-open`, useFidelityData().reportForm === "dialog")
/** 打开时滚动到的条目 id */
export const useFocusItem = () => useSceneState<string | null>(`${K}focus`, useFidelityData().focus ?? null)
export const useExtLoaded = () => useSceneState(`${K}ext-loaded`, !!useFidelityData().extLoaded)

export function useLocated() {
  const init = useFidelityData().located
  return useSceneState<Located | null>(`${K}located`, init ? { ...init, n: 0 } : null)
}

/** 当前文档的报告条目：confirm 变体里点了「加载」之后，外部图片照常显示、不再算作无法显示 */
export function useReport(): { variant: Variant; items: ReportItem[] } {
  const variant = useFidelityData().variant ?? "main"
  const [loaded] = useExtLoaded()
  const items = reportFor(variant).map((it) =>
    variant === "confirm" && loaded && it.id === "external" ? { ...it, level: "info" as const, note: ["1 处外部内容已加载", "（cdn.example.com），", "本次打开内有效"] } : it,
  )
  return { variant, items }
}

/** 打开报告：可指定范围、滚到某条、直接定位到某处、关闭后焦点交给谁。打开即视为已看过，打开后的差异提示随之收起。 */
export interface OpenOptions {
  scope?: Scope
  focus?: string
  locate?: { id: string; i: number }
  from?: string
}

/**
 * 定位（03-10「每条条目『定位』按钮跳转到受影响的第一处页面并短暂高亮对应对象 / 整页边框」）：跳到那一页、不改选中；
 * 画布上的高亮由 canvas.tsx LocateFlash 按 located 画，n 每次加一让高亮重新出现。
 */
export function useLocate() {
  const ed = useEditor()
  const [, setLoc] = useLocated()
  return (item: ReportItem, i: number) => {
    const o = item.occ[i]
    if (!o) return
    if (ed.slide !== o.page) ed.goTo(o.page)
    setLoc((p) => ({ id: item.id, i, n: (p?.n ?? 0) + 1 }))
  }
}

export function useOpenReport() {
  const [, setOpen] = useReportOpen()
  const [, setDialog] = useReportDialogOpen()
  const dialog = useFidelityData().reportForm === "dialog"
  const [, setScope] = useScope()
  const [, setFocus] = useFocusItem()
  const [, setRet] = useReturnFocus()
  const [, setToast] = useToast()
  const [, setLoc] = useLocated()
  return (o: OpenOptions = {}) => {
    setScope(o.scope ?? "all")
    setFocus(o.focus ?? o.locate?.id ?? null)
    setRet(o.from ?? null)
    if (o.locate) {
      const l = o.locate
      setLoc((p) => ({ id: l.id, i: l.i, n: (p?.n ?? 0) + 1 }))
    }
    setToast(null)
    // 备选 alt-dialog：各入口（主菜单、提示条、检查器、右键）打开的都是对话框，评审在备选态里看到的始终是备选形态
    if (dialog) setDialog(true)
    else setOpen(true)
  }
}
