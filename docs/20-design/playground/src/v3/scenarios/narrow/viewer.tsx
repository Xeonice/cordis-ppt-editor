import { useEffect, useRef, type CSSProperties, type ReactNode, type TouchEvent } from "react"
import { Check, ChevronLeft, ChevronRight, Ellipsis, Eye, Maximize, MessageSquare, Play, StepForward, X, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { DeckSlideView, DOC_TITLE, ICON_LG, IconButton, useEditor } from "../../kit"
import { useV3Params } from "../../params"
import { CommentAnnouncer } from "../comments/chrome"
import { PhoneCommentsSheet, PhonePins } from "../comments/phone"
import { NOTES } from "./data"
import { useHandoff, useSheet, type Sheet as SheetId } from "./form"

/**
 * 仅查看形态（< 640 或 pointer: coarse，DS-17；01 §6、50/10 §2.2、PRD NF-07）：编辑器还是同一个（权限与模式不变），
 * 只是编辑类贡献全部收起，剩下逐页浏览、页码与翻页、评论（手机可以发表与回复、解决在更大窗口中进行，rulings §4.25 DS-28、DS-46）与「更多」——减少控件而不是缩小控件。
 * - 顶部条（贴边、1px 分隔）：返回首页 · 文档标题 + 一行状态「仅查看 · 在更大窗口中编辑」（role=status）· 更多。
 * - 中间：当前页全宽（左右 16；横屏或矮窗口按可用高度收窄，整页留在顶部条与底部浮动条之间），下方只读的演讲者备注；
 *   左右轻扫翻页（页面被双指放大时不翻页，让给平移），外接键盘 ← → / PageUp PageDown / Home End 翻页、Esc 关面板。
 * - 底部浮动条（与编辑器底部工具条同一外观，按钮放大到 44）：上一页 · 页码「2 / 6」（点开幻灯片列表）· 下一页 ┊ 评论。
 * - 两侧收为底部面板（Sheet），同一时刻只开一个：评论（第 2 批评论场景的手机评论面板，DS-46：本页评论未解决在前、已解决收在「已解决 N」一行、「回复」与常驻撰写区，
 *   画布上同时标出评论钉）、幻灯片列表（两列真实缩略图）、更多（放映、适应窗口、备注开关）。
 *   用户点开时焦点进面板，关闭后回到打开它的按钮；幻灯片列表与更多点面板外即收起，评论面板不收（边看幻灯片边读评论）。
 * 点按目标一律 ≥ 44 × 44、相邻间距 ≥ 8（50/16 目标尺寸；设计 04 §5）。
 */

/**
 * 幻灯片与备注的宽度：全宽，但整页要落在顶部条与底部浮动条之间——
 * 可用高 = 视口 − 顶部条 56 − 上留白 16 − 浮动条（54 + 距底 16）− 与浮动条的间距 14 − 底部安全区，宽 = 可用高 × 16/9。
 */
const PAGE_W: CSSProperties = { width: "min(100%, calc((100dvh - 156px - env(safe-area-inset-bottom, 0px)) * 16 / 9))" }

/** 打开 / 关闭底部面板：用户打开时记下「交接焦点」，面板挂载后把焦点交给面板；关闭后焦点回到打开它的按钮（data-narrow-trigger）。 */
function useSheetControl() {
  const [sheet, setSheet] = useSheet()
  const [, setHandoff] = useHandoff()
  const open = (s: Exclude<SheetId, null>) => {
    setHandoff(true)
    setSheet(s)
  }
  const close = () => {
    if (!sheet) return
    const was = sheet
    setSheet(null)
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-narrow-trigger="${was}"]`)?.focus())
  }
  const toggle = (s: Exclude<SheetId, null>) => (sheet === s ? close() : open(s))
  return { sheet, open, close, toggle }
}

/**
 * 44px 的图标按钮（底座 IconButton 的触控档 44：圆角 8，工具提示与不可用规则沿用）。trigger：它打开的底部面板（关闭后焦点回到这里，data-narrow-trigger）；
 * anchor：给按钮挂锚点（查看器窄屏的「更多」「页码」用 data-v3-anchor 交还焦点）。
 * 第 3 批转正（rulings §4.25 DS-111：查看器窄屏向仅查看形态靠齐，kitRequest g3 K7）起导出给查看器窄屏共用（viewer/narrow.tsx 原来复制了一份）
 */
export function TouchIcon({
  label,
  Icon,
  onClick,
  disabled,
  reason,
  expanded,
  haspopup,
  trigger,
  anchor,
}: {
  label: string
  Icon: LucideIcon
  onClick?: () => void
  disabled?: boolean
  reason?: string
  expanded?: boolean
  haspopup?: "dialog" | "menu"
  trigger?: string
  anchor?: string
}) {
  return (
    <IconButton label={label} size={44} disabled={disabled} reason={reason} onClick={onClick} aria-expanded={expanded} aria-haspopup={haspopup} data-narrow-trigger={trigger} data-v3-anchor={anchor}>
      <Icon {...ICON_LG} />
    </IconButton>
  )
}

/**
 * 顶部条：返回首页 · 文档标题与一行状态 · 更多。状态行缺省「仅查看 · 在更大窗口中编辑」；
 * 场景状态 data.viewerStatus 给了同步状态（与左栏同一个 RailStatus，如离线时「离线 · 3 项待同步」）就换成它，与横幅说的是同一件事（第 2 批 offline-conflict.narrow-offline）。
 * 嵌入形态 E（iframe 里，URL 带 embedded=1；rulings §4.25 DS-112）：不渲染「返回首页」（没有首页可回，DS-19；标题左缘让到 16），
 * 状态行只写「仅查看」（容器尺寸由宿主定，「在更大窗口中编辑」用户可能照做不了）。不在嵌入里时与原来逐字相同。
 * 这是手机（< 640）的顶部条：平板（触控、≥ 640）是 comments/phone.tsx 的 TabletViewer，状态行「仅查看 · 在电脑上编辑」（TB-125、TB-136），嵌入里也照写（TB-159：触控的原因优先）。
 */
function TopBar() {
  const { sheet, toggle } = useSheetControl()
  const { data } = useEditor()
  const { embedded } = useV3Params()
  const status = data.viewerStatus as ReactNode | undefined
  return (
    <header className={cn("flex h-14 shrink-0 items-center gap-1 border-b border-(--v3-border) bg-(--v3-panel) px-1.5 select-none", embedded && "pl-3")}>
      {!embedded && <TouchIcon label="返回首页" Icon={ChevronLeft} />}
      <div className="min-w-0 flex-1 px-1">
        <h1 className="truncate text-[13px] leading-4 font-semibold text-(--v3-text)">{DOC_TITLE}</h1>
        {status ? (
          <div role="status" className="mt-1">
            {status}
          </div>
        ) : (
          <p role="status" className="mt-1 flex items-center gap-1 text-[12px] leading-4 text-(--v3-text-2)">
            <Eye size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
            <span className="whitespace-nowrap">仅查看</span>
            {!embedded && (
              <>
                <span aria-hidden="true">·</span>
                <span className="whitespace-nowrap">在更大窗口中编辑</span>
              </>
            )}
          </p>
        )}
      </div>
      <TouchIcon label="更多" Icon={Ellipsis} haspopup="dialog" expanded={sheet === "more"} trigger="more" onClick={() => toggle("more")} />
    </header>
  )
}

/** 翻页（越界不动）。 */
function usePaging() {
  const { slide, deck, goTo } = useEditor()
  const total = deck.length
  return { slide, total, page: (n: number) => goTo(Math.min(total, Math.max(1, n))) }
}

/**
 * 左右轻扫翻页：单指、水平位移 ≥ 48 且明显大于竖直位移才算；页面被双指放大时（visualViewport.scale > 1）不翻页，让给平移。
 * 用 touch 事件而不是 pointer 事件：不必禁掉浏览器的平移与缩放（touch-action 保持 auto）。DS-111 起导出给查看器窄屏共用。
 */
export function useSwipe(onPrev: () => void, onNext: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onTouchStart: (e: TouchEvent<HTMLDivElement>) => {
      const t = e.touches[0]
      start.current = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY } : null
    },
    onTouchEnd: (e: TouchEvent<HTMLDivElement>) => {
      const s = start.current
      start.current = null
      const t = e.changedTouches[0]
      if (!s || !t || (window.visualViewport?.scale ?? 1) > 1.01) return
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return
      if (dx < 0) onNext()
      else onPrev()
    },
    onTouchCancel: () => {
      start.current = null
    },
  }
}

/** 当前页：全宽、16:9；评论面板打开时标出本页评论钉。 */
function SlideView({ showPins }: { showPins: boolean }) {
  const { current } = useEditor()
  const { slide, page } = usePaging()
  const swipe = useSwipe(() => page(slide - 1), () => page(slide + 1))
  return (
    <div data-v3-anchor="slide" {...swipe} className="relative mx-auto rounded-[4px] shadow-(--v3-slide-shadow)" style={PAGE_W}>
      <DeckSlideView slide={current} where="canvas" className="rounded-[4px]" />
      {/* 评论钉：第 2 批评论场景手机形态的同一组钉（PhonePins：CommentLayer 触控形态，点按区扩到 44），点钉让底部面板里那一条铺选中底色（DS-46） */}
      {showPins && <PhonePins />}
    </div>
  )
}

/**
 * 演讲者备注（只读）：备注框外观同桌面（圆角 8、1px 边、panel 底），只读时不出现「添加演讲者备注…」这种邀请输入的占位。
 * 读当前页自己的备注（DeckSlide.notes）：示例文档原样的页（没换内容）没写备注时按页码取示例备注（data.ts NOTES，与 DeckSlide 已有的两页逐字相同）；
 * 换了内容的页（deckWith 换了 render）只认它自己的备注，没有就写「这一页没有演讲者备注」（rulings §4.25 DS-138：与桌面只读态、查看器同一句，2026-10-22 由「这一页没有备注」改；第 3 批转正时并入 kitRequest g7 K8：
 * narrow-review.narrow-plugin-banner 的第 6 页换成了「扫码获取资料」，不再配上原页的备注；原来要靠 data.viewerNotes = "slide" 打开，现为缺省，那个参数照旧可写、结果相同）。
 */
function NotesCard() {
  const { current, data } = useEditor()
  const text = data.viewerNotes === "slide" || current.render ? current.notes : (current.notes ?? NOTES[current.n])
  return (
    <section aria-label="演讲者备注" className="mx-auto mt-4 rounded-[8px] border border-(--v3-border) bg-(--v3-panel) px-3 pt-2.5 pb-3" style={PAGE_W}>
      <h2 className="text-[12px] leading-4 font-semibold text-(--v3-text-2)">演讲者备注</h2>
      {text ? (
        <p className="mt-1.5 text-[13px] leading-5 text-(--v3-text)">{text}</p>
      ) : (
        <p className="mt-1.5 text-[12px] leading-[18px] text-(--v3-text-2)">这一页没有演讲者备注</p>
      )}
    </section>
  )
}

/**
 * 底部浮动翻页条的外框（与编辑器底部工具条同一外观：panel 底、1px 边、圆角 12、浮层阴影；贴底 16、水平居中，按钮 44、间距 8）：
 * 仅查看形态是「上一页 · 页码 · 下一页 ┊ 评论」，查看器窄屏是「上一页 · 页码 · 下一页 ┊ 更多」（DS-111 起导出共用，label 是工具条的读屏名）
 */
export function TouchPagerBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      className="absolute bottom-4 left-1/2 z-20 mb-[env(safe-area-inset-bottom)] flex -translate-x-1/2 items-center gap-2 rounded-[12px] border border-(--v3-border) bg-(--v3-panel) p-1 shadow-(--v3-shadow) select-none"
    >
      {children}
    </div>
  )
}

/** 底部浮动条：上一页 · 页码（打开幻灯片列表）· 下一页 ┊ 评论。与编辑器底部工具条同一外观（panel 底、1px 边、圆角 12、浮层阴影），按钮 44、间距 8。 */
function ViewerBar() {
  const { current } = useEditor()
  const { slide, total, page } = usePaging()
  const { sheet, toggle } = useSheetControl()
  const comments = current.comments ?? 0
  return (
    <TouchPagerBar label="翻页与评论">
      <TouchIcon label="上一页" Icon={ChevronLeft} disabled={slide <= 1} reason="已是第一页" onClick={() => page(slide - 1)} />
      <button
        type="button"
        aria-label={`第 ${slide} 页，共 ${total} 页，打开幻灯片列表`}
        aria-haspopup="dialog"
        aria-expanded={sheet === "slides"}
        data-narrow-trigger="slides"
        onClick={() => toggle("slides")}
        className="flex h-11 min-w-16 items-center justify-center rounded-[8px] px-3 text-[13px] leading-none text-(--v3-text) tabular-nums transition-colors hover:bg-(--v3-panel-2) aria-expanded:bg-(--v3-panel-2)"
      >
        {slide}
        <span className="px-1 text-(--v3-text-2)">/</span>
        {total}
      </button>
      <TouchIcon label="下一页" Icon={ChevronRight} disabled={slide >= total} reason="已是最后一页" onClick={() => page(slide + 1)} />
      <span aria-hidden="true" className="h-6 w-px shrink-0 bg-(--v3-border)" />
      <button
        type="button"
        aria-label={comments ? `评论（本页 ${comments} 条）` : "评论（本页没有评论）"}
        aria-haspopup="dialog"
        aria-expanded={sheet === "comments"}
        data-narrow-trigger="comments"
        onClick={() => toggle("comments")}
        className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-[8px] px-3 text-(--v3-text-2) transition-colors hover:bg-(--v3-panel-2) hover:text-(--v3-text) aria-expanded:bg-(--v3-panel-2) aria-expanded:text-(--v3-text)"
      >
        <MessageSquare {...ICON_LG} />
        {comments > 0 && <span className="text-[13px] leading-none text-(--v3-text) tabular-nums">{comments}</span>}
      </button>
    </TouchPagerBar>
  )
}

/**
 * 底部面板（Sheet）：贴底、上圆角 12、1px 上边、panel 底、浮层阴影；顶部把手 + 标题行（标题 · 说明 · 关闭 44）。
 * 不加遮罩、不抢走画布：评论面板打开时上方的幻灯片仍可看、可缩放（非模态）；大窗口里最宽 560、水平居中。
 * 用户点开时焦点落在面板本身（读屏先读面板名；不落在关闭按钮上，免得弹出工具提示）；状态初始就打开的面板不抢焦点。
 * DS-111 起导出给查看器窄屏共用：handoff 给了就用它决定挂载时交不交焦点（查看器窄屏的场景状态 viewer.handoff），缺省读本场景的 useHandoff；
 * onClose 收到面板本身（closeWithFocusBack 先交出焦点再收起用）；stopPointer：面板上的按下不往外冒（查看器窄屏「点面板外即收起」的那一层在外面）
 */
export function Sheet({
  title,
  sub,
  onClose,
  children,
  footer,
  className,
  handoff: handoffProp,
  stopPointer,
}: {
  title: string
  sub?: ReactNode
  onClose: (layer: HTMLDivElement | null) => void
  children: ReactNode
  footer?: ReactNode
  className?: string
  handoff?: boolean
  stopPointer?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [handoffState] = useHandoff()
  const handoff = handoffProp ?? handoffState
  // 只在挂载时交接一次
  useEffect(() => {
    if (handoff) ref.current?.focus()
  }, [])
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      onPointerDown={stopPointer ? (e) => e.stopPropagation() : undefined}
      className={cn(
        "absolute inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-[560px] flex-col rounded-t-[12px] border-t border-(--v3-border) bg-(--v3-panel) pb-[env(safe-area-inset-bottom)] shadow-(--v3-shadow) outline-none select-none",
        className,
      )}
    >
      <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-[2px] bg-(--v3-handle)" />
      <div className="flex h-12 shrink-0 items-center gap-2 pr-1.5 pl-4">
        <h2 className="text-[13px] leading-4 font-semibold text-(--v3-text)">{title}</h2>
        {sub && <span className="text-[12px] leading-4 text-(--v3-text-2)">{sub}</span>}
        <span className="ml-auto">
          <TouchIcon label={`关闭${title}`} Icon={X} onClick={() => onClose(ref.current)} />
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-(--v3-border)">{children}</div>
      {footer}
    </div>
  )
}

/*
 * 评论面板：第 2 批评论场景的手机评论面板（comments/phone.tsx PhoneCommentsSheet，rulings §4.25 DS-46，2026-10-15 起替换这里原来的只读列表）——
 * 标题「评论 · 第 N 页 · M 条未解决」，未解决在前、已解决收在「已解决 N」一行，「N 条回复」展开、「回复」进入回复模式，底部常驻撰写区（44px 文本框 ·「发送」，↵ 换行），
 * 撰写区上方一行「解决评论请在更大窗口中进行」；查看者只读。线程数据与画布评论钉同一份（comments/store，场景级 data.dataset「deck」：示例文档第 4 页 3 条）。
 */

/** 幻灯片列表：两列真实缩略图（网格视图的画法：页码在左上、当前页 2px 强调色描边与强调色页码、评论角标），点一页跳过去并收起面板。 */
function SlidesSheet({ onClose }: { onClose: () => void }) {
  const { deck, slide, goTo } = useEditor()
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
                aria-label={`第 ${s.n} 页：${s.name}${s.comments ? `，${s.comments} 条评论` : ""}`}
                onClick={() => {
                  goTo(s.n)
                  onClose()
                }}
                className="group block w-full text-left outline-none"
              >
                <span className="flex h-4 items-center gap-1.5 text-[12px] leading-4">
                  {/* 当前页靠 2px 强调色环与 aria-current 区分；页码用正文色加粗（强调色小字落在 panel 上暗色只有 3.84:1，DS-9） */}
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
                  <DeckSlideView slide={s} where="grid" />
                  {!!s.comments && (
                    <span className="absolute top-1.5 right-1.5 inline-flex h-5 items-center gap-1 rounded-[4px] border border-(--v3-border) bg-(--v3-panel) px-1.5 text-[12px] leading-none text-(--v3-text-2) tabular-nums">
                      <MessageSquare size={12} strokeWidth={1.5} aria-hidden="true" />
                      {s.comments}
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </Sheet>
  )
}

/** 更多：只放查看类命令（放映、适应窗口、备注开关）；行高 48。编辑、插入、排列等命令在窄屏不出现。 */
function MoreSheet({ onClose }: { onClose: () => void }) {
  const { notes, setNotes } = useEditor()
  const row = "flex h-12 w-full items-center gap-3 px-4 text-left text-[13px] leading-none text-(--v3-text) transition-colors hover:bg-(--v3-panel-2)"
  const icon = "shrink-0 text-(--v3-text-2)"
  return (
    <Sheet title="更多" onClose={onClose}>
      <div role="menu" aria-label="更多" className="pt-1 pb-2">
        <button type="button" role="menuitem" className={row} onClick={onClose}>
          <Play {...ICON_LG} className={icon} />
          从当前页放映
        </button>
        <button type="button" role="menuitem" className={row} onClick={onClose}>
          <StepForward {...ICON_LG} className={icon} />
          从头放映
        </button>
        <div aria-hidden="true" className="my-1 h-px bg-(--v3-border)" />
        <button type="button" role="menuitem" className={row} onClick={onClose}>
          <Maximize {...ICON_LG} className={icon} />
          适应窗口
        </button>
        <button type="button" role="menuitemcheckbox" aria-checked={notes} className={row} onClick={() => setNotes(!notes)}>
          <span className={cn("flex size-5 shrink-0 items-center justify-center", notes ? "text-(--v3-accent)" : "text-transparent")}>
            <Check size={20} strokeWidth={1.75} aria-hidden="true" />
          </span>
          显示演讲者备注
        </button>
      </div>
    </Sheet>
  )
}

/**
 * 外接键盘：← / PageUp 上一页、→ / PageDown 下一页、Home / End 首末页（幻灯片列表与「更多」打开时不翻页）；Esc 关闭打开中的面板。
 * 焦点在输入框里、或带修饰键时不处理（快捷键照常交给编辑器）。
 */
function useViewerKeys(close: () => void) {
  const { sheet } = useSheetControl()
  const { slide, total, page } = usePaging()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const target = e.target instanceof Element ? e.target : null
      if (target?.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']")) return
      if (e.key === "Escape") {
        if (sheet) {
          e.preventDefault()
          close()
        }
        return
      }
      if (sheet === "slides" || sheet === "more") return
      if (e.key === "ArrowLeft" || e.key === "PageUp") page(slide - 1)
      else if (e.key === "ArrowRight" || e.key === "PageDown") page(slide + 1)
      else if (e.key === "Home") page(1)
      else if (e.key === "End") page(total)
      else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })
}

/**
 * 仅查看形态的整块画布（替换单页与网格两种视图的内容）：盖满画布列（左栏、检查器、底部工具条在这个形态不渲染）。
 * 幻灯片下方是只读备注（主菜单「视图 › 备注」同一个开关，在「更多」里）；底部浮动条在底部面板打开时让位。
 */
export function NarrowViewer() {
  const { notes } = useEditor()
  const { sheet, close } = useSheetControl()
  useViewerKeys(close)
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-(--v3-canvas)">
      <TopBar />
      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-[104px]"
        // 幻灯片列表与「更多」：点面板外即收起（评论面板不收，边看幻灯片边读评论）
        onPointerDown={() => {
          if (sheet === "slides" || sheet === "more") close()
        }}
      >
        <SlideView showPins={sheet === "comments"} />
        {notes && <NotesCard />}
      </div>
      {sheet === null && <ViewerBar />}
      {sheet === "comments" && <PhoneCommentsSheet onClose={close} />}
      {sheet === "slides" && <SlidesSheet onClose={close} />}
      {sheet === "more" && <MoreSheet onClose={close} />}
      {/* 点钉定位的读屏播报（polite，「已定位到第 N 页：…」）：与第 2 批评论场景同一个播报区（comments/chrome CommentAnnouncer） */}
      <CommentAnnouncer />
    </div>
  )
}
