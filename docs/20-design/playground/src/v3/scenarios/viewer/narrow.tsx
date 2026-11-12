import { useEffect, useRef, type CSSProperties, type ReactNode } from "react"
import { Check, ChevronLeft, ChevronRight, Ellipsis, Fullscreen, Info, Maximize, Minus, Plus, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { closeWithFocusBack, DeckSlideView, holdFocusDuring, ICON_LG, IconButton, Menu, useEditor, useSceneState, type MenuSpec } from "../../kit"
import { FindHits, FindPanel, REVENUE_HITS, useFind } from "../find-view-undo/FindReplace"
import { Sheet as TouchSheet, TouchIcon, TouchPagerBar, useSwipe } from "../narrow/viewer"
import { useNotesOpen, usePaging, useViewerSeed, type ViewerSheet } from "./data"
import { NotesText, ThumbStrip } from "./parts"
import { DetailsButton, summaryContent, SummaryRows } from "./summary"

/**
 * 查看器窄屏（容器 < 640，03-25「窄屏」、50/12 §3）。
 *
 * rulings §4.25 DS-111（NarrowViewer）：向编辑器仅查看形态（第 1 批 narrow.narrow，narrow/viewer.tsx）靠齐——同一套触控件与底部面板（Sheet、TouchIcon、useSwipe、浮动翻页条 TouchPagerBar
 * 都取 narrow/viewer.tsx 导出的那一份，第 3 批转正时删去这里复制的局部件，画法逐像素相同），只是查看器没有标题、返回与评论：
 * - 不画顶部条（查看器壳本来就没有标题与返回，01-IA §8.1）；当前页全宽（左右 16），整页落在容器上沿与底部浮动条之间，内容整体垂直居中、超高时从顶部滚动；
 * - 底部浮动条（与编辑器底部工具条同一外观：panel 底、1px 边、圆角 12、浮层阴影；按钮 44、间距 8）：上一页 · 页码「3 / 6」· 下一页 ┊ 更多；
 *   宿主开了 thumbnails 时页码是按钮，点开两列真实缩略图的底部面板（同编辑器仅查看形态的幻灯片列表），没开时只是文字；
 * - 「更多」是底部面板（行高 48）：适应窗口 · 全屏（document.fullscreenEnabled 为假时不出，如 iOS Safari）· 搜索（宿主开了 search）· 保真摘要 ┊（宿主开了 notes）显示演讲者备注；
 * - 保真摘要在窄屏是底部面板（与桌面 ⓘ 卡同一份条目，13px 触控字号）；备注开着时是当前页下方的只读卡（同编辑器仅查看形态）；
 * - 搜索是 03-21 窄屏的查找条（只有输入 + 计数 + 上一个 / 下一个 + 关闭），停在容器上沿；
 * - 左右轻扫翻页（页面被双指放大时不翻，让给平移），双指缩放是浏览器原生的；外接键盘 ← → / PageUp PageDown / Home End 翻页、Esc 关面板。
 * 底部面板同一时刻只开一个；用户点开时焦点进面板，关闭后回到打开它的按钮（「保真摘要」与「搜索」从「更多」打开，关了回到「更多」）；幻灯片与「更多」点面板外即收起。
 *
 * DS-111 未采纳的备选（AltNarrowViewer，03-25 原写法）：顶部工具条收敛为 翻页 · 页码 ┊ 缩放 ┊ ⋯（全屏 · 搜索 · 保真摘要 · 缩略图 · 备注），命中区 44；
 * 缩略图是工具条下方的顶部抽屉、备注是底部抽屉（高 40vh）——两种抽屉、一条顶部条，与编辑器仅查看形态是两套画法。
 */

/** 打开 / 关闭底部面板（场景状态，初值 data.viewer.sheet）；用户打开时记下「交接焦点」，面板挂载后把焦点交给面板本身（读屏先念面板名） */
function useSheet() {
  const v = useViewerSeed()
  const [sheet, setSheet] = useSceneState<ViewerSheet>("viewer.sheet", v.sheet ?? null)
  const [, setHandoff] = useSceneState("viewer.handoff", false)
  const open = (s: Exclude<ViewerSheet, null>) => {
    setHandoff(true)
    setSheet(s)
  }
  /** 收起并把焦点交回打开它的按钮（浮动条随面板收起才重新挂上：closeWithFocusBack 同步提交后在同一个任务里交过去，不经过 body） */
  const close = (layer?: Element | null) => {
    if (!sheet) return
    closeWithFocusBack(() => setSheet(null), TRIGGER[sheet], layer)
  }
  return { sheet, open, close, setSheet }
}

/** 面板收起后焦点交回的按钮（锚点）：保真摘要从「更多」打开，交回「更多」 */
const TRIGGER: Record<Exclude<ViewerSheet, null>, string> = { more: "viewer.more", slides: "viewer.pages", summary: "viewer.more" }

/** 外接键盘：← / PageUp、→ / PageDown、Home / End 翻页（幻灯片与「更多」面板打开时不翻）；Esc 关闭打开中的面板。焦点在输入框里或带修饰键时不处理 */
function useNarrowKeys(sheet: ViewerSheet, close: () => void) {
  const p = usePaging()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const t = e.target instanceof Element ? e.target : null
      if (t?.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']")) return
      if (e.key === "Escape") {
        if (sheet) {
          e.preventDefault()
          close()
        }
        return
      }
      if (sheet === "slides" || sheet === "more") return
      if (e.key === "ArrowLeft" || e.key === "PageUp") p.prev()
      else if (e.key === "ArrowRight" || e.key === "PageDown") p.next()
      else if (e.key === "Home") p.first()
      else if (e.key === "End") p.last()
      else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })
}

/**
 * 底部面板：编辑器仅查看形态的同一个件（narrow/viewer.tsx Sheet：贴底、上圆角 12、1px 上边、panel 底、浮层阴影；顶部把手 + 标题行（标题 · 说明 · 关闭 44）），
 * 不加遮罩、不抢走画布；最宽 560、水平居中。用户点开时焦点落在面板本身（交不交焦点读本场景的 viewer.handoff）；状态初始就打开的面板不抢焦点；
 * 面板上的按下不往外冒（「点面板外即收起」的那一层在外面）
 */
function Sheet({ title, sub, onClose, children, className }: { title: string; sub?: ReactNode; onClose: (layer: Element | null) => void; children: ReactNode; className?: string }) {
  const [handoff] = useSceneState("viewer.handoff", false)
  return (
    <TouchSheet title={title} sub={sub} onClose={onClose} className={className} handoff={handoff} stopPointer>
      {children}
    </TouchSheet>
  )
}

/* ------------------------------------------------------------------ DS-111 */

/** 幻灯片与备注卡的宽度：全宽（左右 16），整页落在容器上沿 16 与底部浮动条（54 + 距底 16 + 间距 14）之间：宽 = min(可用宽, 可用高 × 16/9) */
const PAGE_W: CSSProperties = { width: "min(100cqw - 32px, (100cqh - 116px) * 16 / 9)" }

export function NarrowViewer() {
  const ed = useEditor()
  const v = useViewerSeed()
  const host = v.host
  const p = usePaging()
  const { sheet, open, close } = useSheet()
  const [notes, setNotes] = useNotesOpen()
  const [find, setFind] = useFind()
  const swipe = useSwipe(p.prev, p.next)
  useNarrowKeys(sheet, () => close())
  const fullscreenOk = typeof document !== "undefined" && document.fullscreenEnabled !== false
  const root = useRef<HTMLDivElement>(null)

  /** 从「更多」打开搜索：面板收起的那一刻焦点交给查找框（不经过 body） */
  const openSearch = (layer: Element | null) => {
    holdFocusDuring(800, () => document.querySelector<HTMLElement>('[aria-label="查找和替换"] input'))
    if (layer?.contains(document.activeElement)) root.current?.focus({ preventScroll: true })
    close(layer)
    setFind({ open: true })
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-label="查找和替换"] input')?.focus())
  }

  return (
    <div ref={root} tabIndex={-1} className="absolute inset-0 z-10 flex flex-col bg-(--v3-canvas) outline-none">
      <div
        className="relative min-h-0 flex-1 [container-type:size]"
        // 幻灯片与「更多」：点面板外即收起
        onPointerDown={() => {
          if (sheet === "slides" || sheet === "more") close()
        }}
      >
        <div className="absolute inset-0 overflow-y-auto">
          <div className="flex min-h-full flex-col items-center justify-center px-4 pt-4 pb-[86px]">
            <div data-v3-anchor="slide" {...swipe} className="relative shrink-0 rounded-[4px] shadow-(--v3-slide-shadow)" style={PAGE_W}>
              <DeckSlideView slide={ed.current} where="canvas" className="rounded-[4px]" />
              {host.search && <FindHits hits={REVENUE_HITS} />}
            </div>
            {host.notes && notes && (
              <section aria-label="演讲者备注" className="mt-4 shrink-0 rounded-[8px] border border-(--v3-border) bg-(--v3-panel) px-3 pt-2.5 pb-3" style={PAGE_W}>
                <h2 className="text-[12px] leading-4 font-semibold text-(--v3-text-2)">演讲者备注</h2>
                <div className="mt-1.5">
                  <NotesText text={ed.current.notes} />
                </div>
              </section>
            )}
          </div>
        </div>
        {/*
          搜索：03-21 窄屏的查找条（FindPanel compact：输入 + 计数 + 上一个 / 下一个 + 更多 + 关闭，宽 320）。这里没有紧凑胶囊，不要「排在胶囊下面」的下移（placement plain，
          第 3 批转正并入的落位参数）：外层一个宽 344、水平居中、距上沿 12 的定位框，查找条在框里贴右 12、距顶 12，于是整体水平居中、离上沿 24
        */}
        {host.search && find.open && (
          <div className="absolute top-3 left-1/2 h-0 w-[344px] -translate-x-1/2">
            <FindPanel hits={REVENUE_HITS} canReplace={false} compact placement="plain" />
          </div>
        )}
      </div>

      {sheet === null && (
        <TouchPagerBar label="翻页">
          <TouchIcon label="上一页" Icon={ChevronLeft} disabled={p.atFirst} reason="已是第一页" onClick={p.prev} />
          {host.thumbnails && p.total > 1 ? (
            <button
              type="button"
              aria-label={`第 ${p.slide} 页，共 ${p.total} 页，打开幻灯片列表`}
              aria-haspopup="dialog"
              aria-expanded={false}
              data-v3-anchor="viewer.pages"
              onClick={() => open("slides")}
              className="flex h-11 min-w-16 items-center justify-center rounded-[8px] px-3 text-[13px] leading-none text-(--v3-text) tabular-nums transition-colors hover:bg-(--v3-panel-2)"
            >
              {p.slide}
              <span className="px-1 text-(--v3-text-2)">/</span>
              {p.total}
            </button>
          ) : (
            <span aria-label={`第 ${p.slide} 页，共 ${p.total} 页`} role="status" className="flex h-11 min-w-16 items-center justify-center px-3 text-[13px] leading-none text-(--v3-text) tabular-nums">
              <span aria-hidden="true">{p.slide}</span>
              <span aria-hidden="true" className="px-1 text-(--v3-text-2)">
                /
              </span>
              <span aria-hidden="true">{p.total}</span>
            </span>
          )}
          <TouchIcon label="下一页" Icon={ChevronRight} disabled={p.atLast} reason="已是最后一页" onClick={p.next} />
          <span aria-hidden="true" className="h-6 w-px shrink-0 bg-(--v3-border)" />
          <TouchIcon label="更多" Icon={Ellipsis} haspopup="dialog" expanded={false} anchor="viewer.more" onClick={() => open("more")} />
        </TouchPagerBar>
      )}

      {sheet === "more" && (
        <Sheet title="更多" onClose={close}>
          <MoreRows
            fullscreen={fullscreenOk}
            search={!!host.search}
            notes={host.notes ? notes : undefined}
            onFit={close}
            onFullscreen={close}
            onSearch={openSearch}
            onSummary={() => open("summary")}
            onNotes={() => setNotes(!notes)}
          />
        </Sheet>
      )}
      {sheet === "slides" && <SlidesSheet onClose={close} />}
      {sheet === "summary" && <SummarySheet onClose={close} />}
    </div>
  )
}

/** 「更多」的条目（行高 48、20px 图标 text-2）：适应窗口 · 全屏 · 搜索 · 保真摘要 ┊ 显示演讲者备注（勾选项）；只放查看类命令 */
function MoreRows({
  fullscreen,
  search,
  notes,
  onFit,
  onFullscreen,
  onSearch,
  onSummary,
  onNotes,
}: {
  fullscreen: boolean
  search: boolean
  /** undefined = 宿主没开 notes，不出这一行 */
  notes?: boolean
  onFit: () => void
  onFullscreen: () => void
  onSearch: (layer: Element | null) => void
  onSummary: () => void
  onNotes: () => void
}) {
  const row = "flex h-12 w-full items-center gap-3 px-4 text-left text-[13px] leading-none text-(--v3-text) transition-colors hover:bg-(--v3-panel-2)"
  const icon = "shrink-0 text-(--v3-text-2)"
  const list = useRef<HTMLDivElement>(null)
  return (
    <div ref={list} role="menu" aria-label="更多" className="pt-1 pb-2">
      <button type="button" role="menuitem" className={row} onClick={onFit}>
        <Maximize {...ICON_LG} className={icon} />
        适应窗口
      </button>
      {fullscreen && (
        <button type="button" role="menuitem" className={row} onClick={onFullscreen}>
          <Fullscreen {...ICON_LG} className={icon} />
          全屏
        </button>
      )}
      {search && (
        <button type="button" role="menuitem" className={row} onClick={() => onSearch(list.current?.closest("[role=dialog]") ?? null)}>
          <Search {...ICON_LG} className={icon} />
          搜索
        </button>
      )}
      <button type="button" role="menuitem" className={row} onClick={onSummary}>
        <Info {...ICON_LG} className={icon} />
        保真摘要
      </button>
      {notes !== undefined && (
        <>
          <div aria-hidden="true" className="my-1 h-px bg-(--v3-border)" />
          <button type="button" role="menuitemcheckbox" aria-checked={notes} className={row} onClick={onNotes}>
            <span className={cn("flex size-5 shrink-0 items-center justify-center", notes ? "text-(--v3-accent)" : "text-transparent")}>
              <Check size={20} strokeWidth={1.75} aria-hidden="true" />
            </span>
            显示演讲者备注
          </button>
        </>
      )}
    </div>
  )
}

/** 幻灯片（宿主开了 thumbnails）：两列真实缩略图（同编辑器仅查看形态的幻灯片列表：页码在左上、当前页 2px 强调色环），点一页跳过去并收起面板 */
function SlidesSheet({ onClose }: { onClose: (layer?: Element | null) => void }) {
  const { deck, slide, goTo } = useEditor()
  const v = useViewerSeed()
  const failed = v.thumbsFailed ?? []
  return (
    <Sheet title="幻灯片" sub={<span className="tabular-nums">{deck.length} 页</span>} onClose={onClose} className="max-h-[min(72dvh,640px)]">
      <ol aria-label="幻灯片" className="grid grid-cols-2 gap-x-3 gap-y-4 px-4 pt-3 pb-4">
        {deck.map((s) => {
          const on = s.n === slide
          return (
            <li key={s.n}>
              <button
                type="button"
                aria-current={on ? "true" : undefined}
                aria-label={`第 ${s.n} 页：${s.name}`}
                onClick={(e) => {
                  goTo(s.n)
                  onClose(e.currentTarget.closest("[role=dialog]"))
                }}
                className="group block w-full text-left outline-none"
              >
                <span className="flex h-4 items-center gap-1.5 text-[12px] leading-4">
                  <span className={cn("tabular-nums", on ? "font-semibold text-(--v3-text)" : "text-(--v3-text-2)")}>{s.n}</span>
                  <span className={cn("truncate", on ? "text-(--v3-text)" : "text-(--v3-text-2)")}>{s.name}</span>
                </span>
                <span
                  className={cn(
                    "relative mt-1.5 block overflow-hidden rounded-[4px]",
                    "group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-(--v3-text)",
                    on ? "ring-2 ring-(--v3-accent)" : "ring-1 ring-(--v3-border)",
                  )}
                >
                  {failed.includes(s.n) ? <span className="block aspect-video bg-(--v3-panel-2)" /> : <DeckSlideView slide={s} where="grid" />}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </Sheet>
  )
}

/** 保真摘要（窄屏）：桌面 ⓘ 卡的同一份条目放进底部面板（触控字号 13）；「查看详情」只在宿主配了回调时出现 */
function SummarySheet({ onClose }: { onClose: (layer?: Element | null) => void }) {
  const v = useViewerSeed()
  const { rows, footer } = summaryContent(v.summary)
  return (
    <Sheet title="保真摘要" onClose={onClose}>
      <div className="px-4 pt-3 pb-4">
        <SummaryRows rows={rows} touch />
        {footer && <p className="mt-3 text-[12px] leading-[18px] text-(--v3-text-2)">{footer}</p>}
        {v.host.details && <DetailsButton className="mt-4 h-11 w-full justify-center" />}
      </div>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ DS-111 未采纳的备选（03-25 原写法） */

/**
 * 03-25 原写法：顶部工具条收敛（贴边、高 52、panel 底、1px 下边线；命中区 44、间距 ≥ 8）：上一页 · 下一页 · 页码 ┊ 缩小 · 读数 · 放大 ┊ ⋯；
 * ⋯ 是下拉菜单：全屏 · 搜索 · 保真摘要 ┊ 缩略图（勾选，开启后为工具条下方的顶部抽屉）· 备注（勾选，开启后为底部抽屉 40vh）；双指缩放、平移。
 */
export function AltNarrowViewer() {
  const ed = useEditor()
  const v = useViewerSeed()
  const host = v.host
  const p = usePaging()
  const [thumbs, setThumbs] = useSceneState("viewer.alt-thumbs", !!v.thumbsDrawer)
  const [notes, setNotes] = useNotesOpen()
  const swipe = useSwipe(p.prev, p.next)
  const fullscreenOk = typeof document !== "undefined" && document.fullscreenEnabled !== false
  const items: MenuSpec[] = [
    ...(fullscreenOk ? [{ id: "fullscreen", label: "全屏" } as MenuSpec] : []),
    ...(host.search ? [{ id: "search", label: "搜索" } as MenuSpec] : []),
    { id: "summary", label: "保真摘要" },
    ...(host.thumbnails || host.notes ? [{ type: "separator" } as MenuSpec] : []),
    ...(host.thumbnails ? [{ type: "checkbox", id: "thumbs", label: "缩略图", checked: thumbs, onCheckedChange: (c: boolean) => setThumbs(c) } as MenuSpec] : []),
    ...(host.notes ? [{ type: "checkbox", id: "notes", label: "备注", checked: notes, onCheckedChange: (c: boolean) => setNotes(c) } as MenuSpec] : []),
  ]
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-(--v3-canvas)">
      <header aria-label="查看器工具条" className="flex h-[52px] shrink-0 items-center gap-1 border-b border-(--v3-border) bg-(--v3-panel) px-1 select-none">
        <TouchIcon label="上一页" Icon={ChevronLeft} disabled={p.atFirst} reason="已是第一页" onClick={p.prev} />
        <TouchIcon label="下一页" Icon={ChevronRight} disabled={p.atLast} reason="已是最后一页" onClick={p.next} />
        <span className="px-1 text-[13px] leading-none text-(--v3-text) tabular-nums">
          {p.slide}
          <span className="px-1 text-(--v3-text-2)">/</span>
          {p.total}
        </span>
        <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-(--v3-border)" />
        <TouchIcon label="缩小" Icon={Minus} />
        <span className="w-10 text-center text-[13px] leading-none text-(--v3-text-2) tabular-nums">51%</span>
        <TouchIcon label="放大" Icon={Plus} />
        <span className="ml-auto">
          <Menu
            align="end"
            sideOffset={4}
            label="更多"
            className="w-[200px]"
            items={items}
            trigger={
              <IconButton label="更多" size={44} noTip>
                <Ellipsis {...ICON_LG} />
              </IconButton>
            }
          />
        </span>
      </header>
      {host.thumbnails && thumbs && p.total > 1 && <ThumbStrip edge="bottom" />}
      <div className="relative min-h-0 flex-1 [container-type:size]">
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div {...swipe} className="w-[min(100cqw-32px,(100cqh-32px)*16/9)] rounded-[4px] shadow-(--v3-slide-shadow)">
            <DeckSlideView slide={ed.current} where="canvas" className="rounded-[4px]" />
          </div>
        </div>
      </div>
      {host.notes && notes && (
        <section aria-label={`备注 · 第 ${ed.slide} 页`} className="flex h-[40vh] shrink-0 flex-col rounded-t-[12px] border-t border-(--v3-border) bg-(--v3-panel) shadow-(--v3-shadow)">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-(--v3-border) pr-1 pl-4">
            <h2 className="text-[13px] leading-4 font-semibold text-(--v3-text)">备注 · 第 {ed.slide} 页</h2>
            <span className="truncate text-[12px] leading-4 text-(--v3-text-2)">{ed.current.name}</span>
            <span className="ml-auto">
              <TouchIcon label="关闭备注" Icon={X} onClick={() => setNotes(false)} />
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <NotesText text={ed.current.notes} />
          </div>
        </section>
      )}
    </div>
  )
}
