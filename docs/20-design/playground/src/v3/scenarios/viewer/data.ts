import { useEffect, useState } from "react"
import { deckWith, useEditor, useSceneState, type DeckSlide, type SetSceneState } from "../../kit"
import { OPENING_DECK } from "../main-states/slides"

/**
 * 查看器样张的状态数据（EditorConfig.data.viewer）。宿主选项（50/12 §3–§4 的 createSlideViewerPreset options 与 callbacks）写成状态数据，
 * 不再用旧样张 DesignBar 的开关：thumbnails / notes / search 是惰性可选件（缺省关，宿主开启才渲染入口、不留占位，rulings §4.10 Q18、50/12 §4），
 * details / download 是宿主提供的回调（onOpenDetails / onDownloadOriginal，没提供时不出按钮、不留空位）。
 */
export interface ViewerHost {
  thumbnails?: boolean
  notes?: boolean
  search?: boolean
  details?: boolean
  download?: boolean
}

export type ViewerForm = "auto" | "desktop" | "narrow" | "narrow-alt"
export type ZoomValue = "fit" | "fit-width" | number
/** 窄屏的底部面板：更多 · 幻灯片（宿主开了 thumbnails）· 保真摘要 */
export type ViewerSheet = "more" | "slides" | "summary" | null

export interface ViewerSeed {
  host?: ViewerHost
  /** 形态：auto 按视口（< 640 窄屏）；desktop / narrow 强制（Hub 链接在任何窗口里都看得到这个形态，截图按注明的视口拍）；narrow-alt 为 DS-111 未采纳的 03-25 原写法 */
  form?: ViewerForm
  /** 打开阶段：ready（缺省）· loading 打开中 · failed 打开失败 */
  phase?: "ready" | "loading" | "failed"
  /** 打开失败的文案（按 03-13 错误码表）：generic 通用兜底 · encrypted 受密码保护 */
  failure?: "generic" | "encrypted"
  /** ⓘ 卡的内容：doc 第 2 批已定稿的样例（直接引用 fidelity/viewer.tsx ViewerSummary）· plugin 多一行缺插件说明（DS-110）· none 没有影响查看的差异（TB-114） */
  summary?: "doc" | "plugin" | "none"
  /** ⓘ 卡一出现就开着 */
  summaryOpen?: boolean
  /** 缩放读数菜单一出现就展开 */
  zoomMenu?: boolean
  /** 缩放初值（缺省适应窗口） */
  zoom?: ZoomValue
  /** 备注一出现就开着（宿主开了 notes 时：桌面右侧面板、窄屏页下方只读卡、DS-111 未采纳的原写法的底部抽屉） */
  notesOpen?: boolean
  /** 缩略图条：这些页的缩略图还在生成（版式骨架）/ 生成失败（页码灰块） */
  thumbsPending?: number[]
  thumbsFailed?: number[]
  /** DS-110 未采纳的备选：工具条下方可关闭的缺插件细条 */
  pluginBar?: boolean
  /** 窄屏的底部面板一出现就开着 */
  sheet?: ViewerSheet
  /** DS-111 未采纳的原写法：缩略图顶部抽屉一出现就开着 */
  thumbsDrawer?: boolean
}

/** 场景缺省：宿主开了搜索（M2）、提供了「查看详情」回调（与第 2 批 fidelity.viewer-shell 一致）；缩略图条、备注、下载回调都没开 */
export const BASE_HOST: ViewerHost = { search: true, details: true }

export function useViewerSeed(): ViewerSeed & { host: ViewerHost } {
  const { data } = useEditor()
  const seed = (data.viewer ?? {}) as ViewerSeed
  return { ...seed, host: seed.host ?? BASE_HOST }
}

/** 翻页（越界不动）；桌面、窄屏与 DS-111 未采纳的原写法共用。页码只跟着编辑器的当前页走（产品里跟 Viewport 的 view/page-changed，50/12 §3），壳不另存一份 */
export function usePaging() {
  const ed = useEditor()
  const pages = ed.deck.map((s) => s.n)
  const i = pages.indexOf(ed.slide)
  const go = (n: number) => {
    if (pages.includes(n)) ed.goTo(n)
  }
  return {
    slide: ed.slide,
    total: pages.length,
    pages,
    atFirst: i <= 0,
    atLast: i >= pages.length - 1,
    go,
    prev: () => go(pages[Math.max(0, i - 1)] ?? ed.slide),
    next: () => go(pages[Math.min(pages.length - 1, i + 1)] ?? ed.slide),
    first: () => go(pages[0] ?? ed.slide),
    last: () => go(pages[pages.length - 1] ?? ed.slide),
  }
}

/**
 * 查看器的形态：data.viewer.form 强制，auto 时按容器宽度（样张里容器就是视口）：< 640 窄屏，其余桌面——查看器只有两种形态，640–1024 与桌面相同
 * （50/12 §3 只规定了 < 640 的收敛；编辑器的「紧凑」形态是两侧栏收成胶囊，查看器没有两侧栏）。
 */
export function useViewerForm(): Exclude<ViewerForm, "auto"> {
  const v = useViewerSeed()
  const [narrowVp, setNarrowVp] = useState(() => typeof window !== "undefined" && window.matchMedia(NARROW_MQ).matches)
  useEffect(() => {
    const mq = window.matchMedia(NARROW_MQ)
    const on = () => setNarrowVp(mq.matches)
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  const form = v.form ?? "auto"
  return form === "auto" ? (narrowVp ? "narrow" : "desktop") : form
}

const NARROW_MQ = "(max-width: 639.98px)"

/**
 * 查看器不占浏览器的查找键（复验 B3-G3-R09）：50/12 §3 的查看器键位没有 ⌘F；查看器嵌在宿主页里，与缩放只用 + / −、不占 ⌘+ / ⌘− 同一口径，
 * 搜索只从 🔍（窄屏「更多 › 搜索」）打开。查找面板（03-21 的件，find-view-undo/FindReplace.tsx）自己在 document 上听 ⌘F / ⇧⌘H（Ctrl+H）——
 * 这里在 window 的捕获阶段把这两个键截住、不往下传，也不 preventDefault：浏览器照常打开它自己的查找。
 */
export function useNoFindShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if ((e.metaKey || e.ctrlKey) && (k === "f" || k === "h")) e.stopPropagation()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [])
}

/** 备注开没开（场景状态：桌面的「备注」按钮、窄屏「更多 › 显示演讲者备注」、DS-111 未采纳的原写法的底部抽屉读写同一份） */
export function useNotesOpen(): [boolean, SetSceneState<boolean>] {
  const v = useViewerSeed()
  return useSceneState("viewer.notes", !!v.notesOpen)
}

/** 示例文档的演讲者备注（查看器只读、纯文本、保留换行；第 3 页多写几行演示换行，第 4 页沿用示例文档，其余页没有备注） */
const NOTES_P3 = "开场先说结论：三项指标同比全部上升。\n毛利率按百分点（pt）计，不是百分比。\n活跃客户指近 30 天至少登录一次的客户。"

export const VIEWER_DECK: DeckSlide[] = deckWith({ 3: { notes: NOTES_P3 } })

/** 缩略图条加载中：第 4、6 页还是版式骨架（与编辑器左栏「其余页面加载中」同一画法，main-states/slides.tsx OPENING_DECK），第 5 页另由 thumbsFailed 标为生成失败 */
export const PENDING_DECK: DeckSlide[] = VIEWER_DECK.map((s) => (s.n === 4 || s.n === 6 ? { ...s, render: OPENING_DECK.find((o) => o.n === s.n)?.render, comments: 0 } : s))
