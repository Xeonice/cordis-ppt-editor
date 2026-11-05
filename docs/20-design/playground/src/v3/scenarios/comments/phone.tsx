import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react"
import { ChevronLeft, ChevronRight, CircleCheck, Ellipsis, Eye, Info, MessageSquare, X, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { DeckSlideView, DOC_TITLE, FIELD_FRAME, FoldRow, ICON_LG, IconButton, overlayOpen, Tip, useEditor, userHasInteracted, useSceneState, useViewOnlyMasterGuard } from "../../kit"
import { CommentLayer } from "./canvas"
import { MAX_CHARS, U, type Thread } from "./model"
import { RichText } from "./RichText"
import { newId, useAnnounce, useData, usePerms, useResolvedOpen, useSelected, useThreads } from "./store"
import { AuthorAvatar } from "./Thread"
import { useV3Params } from "../../params"

/**
 * 仅查看形态（< 640 或触控）里的评论（03-02 §5a.2、rulings §4.25 DS-28、TB-49、07 §1.2 / §3「仅查看形态」）：
 * 外观沿用第 1 批 narrow 场景的仅查看形态（顶部条 · 当前页全宽 · 只读备注 · 底部翻页条 · 底部面板），这里只换「评论」底部面板的内容：
 * - 手机（< 640）M3 起可发表与回复：面板底部常驻撰写区（自己的头像 · 44px 高的文本框 ·「发送」44px），点某条的「回复」后撰写区上方出现「回复 王小明 ×」，
 *   那一条展开全部回复；解决仍在更大窗口中进行，撰写区上方一行写明（07 §3：须以可读文字说明）。有评论权限的角色才有撰写区，查看者只读。
 *   嵌入形态 E（iframe 里，URL 带 embedded=1）这一句改「当前区域太窄，暂不能解决评论」：容器尺寸由宿主定，「更大窗口」用户可能照做不了（rulings §4.25 DS-112）；不在嵌入里时不变。
 * - 平板（触控、≥ 640）仍为只读评审（TB-49）：没有撰写区与「回复」，底部一行写明在电脑上发表与回复（备选：与手机一致，alt-tablet-compose）。
 * - 撰写框与回复框有读屏名（「添加评论」「回复王小明」），不只靠占位文字；内容为空时「发送」aria-disabled 并读出原因；发送后焦点留在面板里、polite 播报；
 *   ↵ 换行（软键盘没有 ⇧），只用「发送」按钮提交；输入法组合中不提交；焦点在文本框里时翻页键放行给文字输入。软键盘弹出时撰写区随 visualViewport 上移、不被遮挡（样张无法模拟，随实现）。
 * 评论钉与桌面同一组件（点按区扩到 44），点钉打开本面板并展开那一条。
 * 焦点（07 §2.3，与第 1 批 narrow 的底部面板同一套）：用户打开面板时焦点落在面板本身（读屏先读「评论」），Esc 关闭（正在撰写、框里有字时不关，免得丢稿），
 * 关闭后焦点回到底部条的「评论」按钮；状态里一出现就开着的面板不抢焦点。
 */

/** 底部条「评论」按钮的锚点：面板关闭后焦点交回这里 */
const SHEET_TRIGGER = "comments.sheet-trigger"

/** 幻灯片与备注的宽度：全宽，但整页落在顶部条与底部浮动条之间（与 narrow 同一算式） */
const PAGE_W: CSSProperties = { width: "min(100%, calc((100dvh - 156px - env(safe-area-inset-bottom, 0px)) * 16 / 9))" }

type Sheet = "comments" | null

/** 回复模式（回复哪一条线程）：面板与评论钉共用一份，初值取 data.replyTo */
function usePhoneReply() {
  const d = useData() as { replyTo?: string }
  return useSceneState<string | null>("comments.phoneReply", d.replyTo ?? null)
}

function TouchIcon({ label, Icon, onClick, disabled, reason, expanded }: { label: string; Icon: LucideIcon; onClick?: () => void; disabled?: boolean; reason?: string; expanded?: boolean }) {
  return (
    <IconButton label={label} size={44} disabled={disabled} reason={reason} onClick={onClick} aria-expanded={expanded}>
      <Icon {...ICON_LG} />
    </IconButton>
  )
}

function TopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-(--v3-border) bg-(--v3-panel) px-1.5 select-none">
      <TouchIcon label="返回首页" Icon={ChevronLeft} />
      <div className="min-w-0 flex-1 px-1">
        <h1 className="truncate text-[13px] leading-4 font-semibold text-(--v3-text)">{DOC_TITLE}</h1>
        <p role="status" className="mt-1 flex items-center gap-1 text-[12px] leading-4 text-(--v3-text-2)">
          <Eye size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
          <span className="whitespace-nowrap">仅查看</span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap">在更大窗口中编辑</span>
        </p>
      </div>
      <TouchIcon label="更多" Icon={Ellipsis} />
    </header>
  )
}

/** 底部翻页条（面板打开时让位）：上一页 · 页码 · 下一页 ┊ 评论（本页未解决数） */
function PagerBar({ onComments }: { onComments: () => void }) {
  const { slide, deck, goTo } = useEditor()
  const [threads] = useThreads()
  const n = threads.filter((t) => t.page === slide && !t.resolved).length
  return (
    <div
      role="toolbar"
      aria-label="翻页与评论"
      className="absolute bottom-4 left-1/2 z-20 mb-[env(safe-area-inset-bottom)] flex -translate-x-1/2 items-center gap-2 rounded-[12px] border border-(--v3-border) bg-(--v3-panel) p-1 shadow-(--v3-shadow) select-none"
    >
      <TouchIcon label="上一页" Icon={ChevronLeft} disabled={slide <= 1} reason="已是第一页" onClick={() => goTo(slide - 1)} />
      <span className="flex h-11 min-w-16 items-center justify-center px-3 text-[13px] leading-none text-(--v3-text) tabular-nums">
        {slide}
        <span className="px-1 text-(--v3-text-2)">/</span>
        {deck.length}
      </span>
      <TouchIcon label="下一页" Icon={ChevronRight} disabled={slide >= deck.length} reason="已是最后一页" onClick={() => goTo(slide + 1)} />
      <span aria-hidden="true" className="h-6 w-px shrink-0 bg-(--v3-border)" />
      <button
        type="button"
        data-v3-anchor={SHEET_TRIGGER}
        aria-label={n ? `评论（本页 ${n} 条）` : "评论（本页没有评论）"}
        aria-haspopup="dialog"
        onClick={onComments}
        className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-[8px] px-3 text-(--v3-text-2) transition-colors hover:bg-(--v3-panel-2) hover:text-(--v3-text)"
      >
        <MessageSquare {...ICON_LG} />
        {n > 0 && <span className="text-[13px] leading-none text-(--v3-text) tabular-nums">{n}</span>}
      </button>
    </div>
  )
}

/** 触控的文字按钮：点按区 44 高，视觉上只是一行 12px 字 */
function TouchText({ children, onClick, expanded, label }: { children: ReactNode; onClick: () => void; expanded?: boolean; label?: string }) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={label}
      onClick={onClick}
      className="-mx-2 flex h-11 min-w-11 items-center rounded-[8px] px-2 text-[12px] leading-none text-(--v3-text-2) transition-colors hover:bg-(--v3-panel-2) hover:text-(--v3-text)"
    >
      {children}
    </button>
  )
}

/** 一条线程（手机）：24px 头像 · 姓名 13px 500（作者名一律中等字重，同桌面）· 时间；正文 13px；「N 条回复」展开、「回复」进入回复模式（能发表的角色） */
function PhoneThread({ t, open, canPost, replying, onToggle, onReply }: { t: Thread; open: boolean; canPost: boolean; replying: boolean; onToggle: () => void; onReply: () => void }) {
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: "nearest" })
  }, [open])
  const root = t.replies[0]
  if (!root) return null
  const replies = t.replies.slice(1)
  if (t.resolved && !open) {
    // 已解决的摘要（「已解决 N」展开后）：发起人 · 回复数 / 正文最多两行（不逐条截成一行省略号，Q7）
    return (
      <li ref={ref} className="border-b border-(--v3-border) last:border-b-0">
        <button
          type="button"
          aria-expanded={false}
          aria-label={`已解决：${root.by.name}的评论，${t.resolved.by.name}于${t.resolved.when}解决，展开`}
          onClick={onToggle}
          className="flex min-h-11 w-full min-w-0 flex-col justify-center gap-1 px-4 py-2 text-left"
        >
          <span className="flex items-center gap-2 text-[13px] leading-5">
            <CircleCheck size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />
            <span className="shrink-0 font-medium text-(--v3-text)">{root.by.name}</span>
            <span className="shrink-0 text-[12px] text-(--v3-text-2)">{replies.length ? `${replies.length} 条回复` : "没有回复"}</span>
          </span>
          <span className="line-clamp-2 pl-6 text-[12px] leading-[18px] text-(--v3-text-2)">{root.body}</span>
        </button>
      </li>
    )
  }
  const tail = replies.length > 0 || (canPost && !t.resolved)
  return (
    // 选中（点钉、点「回复」）：aria-current 让读屏知道是哪一条；淡底只铺线程主体，画法同桌面（左右内缩 8、圆角 6），回复与「N 条回复 / 回复」在淡底之外
    <li ref={ref} aria-current={replying ? "true" : undefined} className={cn("border-b border-(--v3-border) px-2 pt-1.5 last:border-b-0", tail ? "pb-0.5" : "pb-1.5")}>
      <div className={cn("rounded-[6px] px-2 py-1.5", replying && "bg-(--v3-accent-soft)")}>
        {t.resolved && (
          <p className="mb-2 flex items-center gap-1 text-[12px] leading-4 text-(--v3-text-2)">
            <CircleCheck size={12} strokeWidth={1.75} aria-hidden="true" />
            {t.resolved.by.name} 已解决 · {t.resolved.when}
          </p>
        )}
        <div className="flex gap-3">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center [&>span]:size-6">
            <AuthorAvatar u={root.by} imported={!!t.imported} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex h-6 items-center gap-2">
              <span className="truncate text-[13px] leading-none font-medium text-(--v3-text)">{root.by.name}</span>
              <span className="shrink-0 text-[12px] leading-none text-(--v3-text-2)">{root.when}</span>
            </div>
            <p className="mt-0.5 text-[13px] leading-5 break-words text-(--v3-text)">{root.body}</p>
          </div>
        </div>
      </div>
      {tail && (
        // 与正文同一左缘（8 + 8 + 头像 24 + 间距 12）；上移抵掉淡底的下内边距，与正文的间距同改前
        <div className="-mt-1.5 min-w-0 pr-2 pl-[44px]">
          {open && replies.length > 0 && (
            <ol aria-label="回复" className="mt-3 flex flex-col gap-3 border-l border-(--v3-border) pl-3">
              {replies.map((r) => (
                <li key={r.id}>
                  <div className="flex h-5 items-center gap-2">
                    <AuthorAvatar u={r.by} imported={!!t.imported} />
                    <span className="text-[13px] leading-none font-medium text-(--v3-text)">{r.by.name}</span>
                    <span className="text-[12px] leading-none text-(--v3-text-2)">{r.when}</span>
                  </div>
                  <div className="mt-1 [&_p]:text-[13px] [&_p]:leading-5">
                    <RichText text={r.body} clamp={false} />
                  </div>
                </li>
              ))}
            </ol>
          )}
          {(replies.length > 0 || (canPost && !t.resolved)) && (
            <div className="flex items-center gap-4">
              {replies.length > 0 && (
                <TouchText expanded={open} onClick={onToggle}>
                  {open ? "收起回复" : `${replies.length} 条回复`}
                </TouchText>
              )}
              {canPost && !t.resolved && (
                <TouchText onClick={onReply} label={`回复${root.by.name}`}>
                  回复
                </TouchText>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  )
}

/** 撰写区（手机）：44px 高的文本框（↵ 换行，「发送」提交）· 发送；回复模式时上方「回复 某某 ×」 */
function PhoneComposer({ replyTo, onCancelReply, onSent, initial, tablet }: { replyTo: Thread | null; onCancelReply: () => void; onSent: (status: string) => void; initial?: string; tablet?: boolean }) {
  const { slide } = useEditor()
  const [, setThreads] = useThreads()
  const [text, setText] = useState(initial ?? "")
  // 换了回复对象（或退出回复模式）时清空文本框；首次挂载保留场景状态给的初值（StrictMode 下重复执行也不清）
  const prevReply = useRef(replyTo?.id)
  useEffect(() => {
    if (prevReply.current === replyTo?.id) return
    prevReply.current = replyTo?.id
    setText("")
  }, [replyTo?.id])
  const ta = useRef<HTMLTextAreaElement>(null)
  const hintId = useId()
  const { embedded } = useV3Params()
  const who = replyTo?.replies[0]?.by.name
  const empty = !text.trim()
  const over = text.length > MAX_CHARS
  const why = empty ? "先输入评论内容" : over ? "超过 5,000 字" : undefined
  // 用户点「回复」后焦点进文本框（场景状态里一出现就是回复模式的不抢焦点）
  useEffect(() => {
    if (replyTo && userHasInteracted()) ta.current?.focus({ preventScroll: true })
  }, [replyTo])
  const send = () => {
    if (why) return
    const body = text.trim()
    if (replyTo) {
      setThreads((ts) => ts.map((t) => (t.id === replyTo.id ? { ...t, activity: 0, replies: [...t.replies, { id: newId(), by: U.zhou, when: "刚刚", body }] } : t)))
    } else {
      setThreads((ts) => [{ id: newId(), page: slide, anchor: { kind: "page", label: "整页", x: 94, y: 8.5 }, createdBy: U.zhou.id, activity: 0, replies: [{ id: newId(), by: U.zhou, when: "刚刚", body }] }, ...ts])
    }
    setText("")
    onSent(replyTo ? `已回复${who ?? ""}` : "已发表评论")
    // 发送后焦点留在面板里（文本框），不掉到 body
    ta.current?.focus({ preventScroll: true })
  }
  return (
    <div className="shrink-0 border-t border-(--v3-border) px-4 pt-2 pb-3">
      <p id={hintId} className="flex items-center gap-1.5 pb-2 text-[12px] leading-4 text-(--v3-text-2)">
        <Info size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
        {/* 手机与平板同一句式（tablet 只在备选 alt-tablet-compose 里有撰写区）；嵌入里改说区域太窄（DS-112） */}
        {embedded ? (
          <span>
            当前区域太窄，<span className="whitespace-nowrap">暂不能解决评论</span>
          </span>
        ) : (
          <span>
            解决评论<span className="whitespace-nowrap">请在更大窗口中进行</span>
          </span>
        )}
      </p>
      {replyTo && (
        <div className="-mt-1 flex h-9 items-center gap-1 text-[12px] leading-none text-(--v3-text-2)">
          回复
          <span className="font-medium text-(--v3-text)">{who}</span>
          <button type="button" aria-label="取消回复" onClick={onCancelReply} className="-my-1 ml-auto flex size-11 items-center justify-center rounded-[8px] text-(--v3-text-2) hover:bg-(--v3-panel-2) hover:text-(--v3-text)">
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className={cn(FIELD_FRAME, "min-w-0 flex-1 focus-within:ring-(--v3-accent)")}>
          <textarea
            ref={ta}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={text.includes("\n") || text.length > 18 ? 2 : 1}
            placeholder={replyTo ? `回复${who}…` : `评论第 ${slide} 页…`}
            aria-label={replyTo ? `回复${who}` : "添加评论"}
            aria-describedby={hintId}
            spellCheck={false}
            className="block max-h-[120px] min-h-11 w-full resize-none bg-transparent px-3 py-3 text-[13px] leading-5 text-(--v3-text) outline-none select-text placeholder:text-(--v3-text-3)"
          />
        </div>
        <Tip label={why ?? "发送"}>
          <button
            type="button"
            aria-disabled={why ? true : undefined}
            aria-label={why ? `发送（${why}）` : "发送"}
            onClick={send}
            className={cn(
              "flex h-11 shrink-0 items-center rounded-[8px] px-4 text-[13px] leading-none font-medium transition-colors",
              why ? "cursor-default bg-(--v3-panel-2) text-(--v3-text-3)" : "bg-(--v3-accent-solid) text-(--v3-accent-fg) hover:bg-(--v3-accent-solid-hover)",
            )}
          >
            发送
          </button>
        </Tip>
      </div>
    </div>
  )
}

/**
 * 「评论」底部面板：贴底、上圆角 12、不加遮罩；最高 min(64dvh, 560)（比只读列表多一块撰写区）。
 * 本场景的 PhoneViewer 与第 1 批 narrow 场景的仅查看形态（narrow/viewer.tsx，rulings §4.25 DS-46）共用这一个件；onClose 由所在的查看形态给（关闭后焦点交回各自的「评论」按钮）。
 * layout（rulings §4.25 DS-131，平板只读评论面板按方向落位；第 3 批转正时由 narrow-review/tablet.tsx 的后代选择器覆盖并入，kitRequest g7 K6）：
 * - sheet（缺省）：浮动底部面板（absolute 贴底、最宽 560、按内容高、浮层阴影、顶部把手）——手机，与原来逐字相同；
 * - stacked：与当前页上下排开、占满所在格子（不浮在内容上：静态定位、不限宽高、无阴影、不画把手——高度由版面排出、不能拖），上圆角 12 + 上左右 1px 分隔线（平板竖屏）；
 * - sidebar：右侧整高侧栏、占满所在格子，不带圆角，只留左侧分隔线（平板横屏）。
 */
export type PhoneSheetLayout = "sheet" | "stacked" | "sidebar"

const SHEET_LAYOUT: Record<Exclude<PhoneSheetLayout, "sheet">, string> = {
  stacked: "flex h-full w-full flex-col rounded-t-[12px] border-x border-t border-(--v3-border) bg-(--v3-panel) pb-[env(safe-area-inset-bottom)] outline-none select-none",
  sidebar: "flex h-full w-full flex-col border-l border-(--v3-border) bg-(--v3-panel) pb-[env(safe-area-inset-bottom)] outline-none select-none",
}

export function PhoneCommentsSheet({ onClose, layout = "sheet" }: { onClose: () => void; layout?: PhoneSheetLayout }) {
  const { slide } = useEditor()
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const [resolvedOpen, setResolvedOpen] = useResolvedOpen()
  // 用户打开的面板：焦点落在面板本身（排到下一个任务，等触发按钮随底部条卸载之后）；状态里一出现就开着的不抢焦点
  useEffect(() => {
    if (!userHasInteracted()) return
    const t = window.setTimeout(() => sheetRef.current?.focus({ preventScroll: true }), 0)
    return () => window.clearTimeout(t)
  }, [])
  // Esc 关闭面板（document 捕获阶段；浮层开着时让它先关；正在撰写、框里有字时不关，免得丢稿）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing || overlayOpen()) return
      const a = document.activeElement
      if (a instanceof HTMLTextAreaElement && a.value.trim()) return
      e.preventDefault()
      closeRef.current()
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [])
  const d = useData() as { device?: "phone" | "tablet"; tabletCompose?: boolean; replyTo?: string; replyText?: string }
  const perms = usePerms()
  const [threads] = useThreads()
  const [sel, setSel] = useSelected()
  const [replyTo, setReplyTo] = usePhoneReply()
  const tablet = d.device === "tablet"
  const canPost = perms.comment && (!tablet || !!d.tabletCompose)
  const list = threads.filter((t) => t.page === slide).sort((a, b) => Number(!!a.resolved) - Number(!!b.resolved) || a.activity - b.activity)
  const open = list.filter((t) => !t.resolved).length
  const resolvedList = list.filter((t) => !!t.resolved)
  // 已解决的收在末尾一行「已解决 N」（同桌面）；选中 / 回复其中一条时自动展开
  const showResolved = resolvedOpen || resolvedList.some((t) => t.id === sel || t.id === replyTo)
  const replyThread = list.find((t) => t.id === replyTo) ?? null
  const note = !perms.comment ? "你只有查看权限，只能查看评论" : tablet && !d.tabletCompose ? "平板上只能查看评论" : null
  // 发表 / 回复成功的播报（polite，07 §3）：放在面板上，撰写区重渲染也不丢
  const [status, setStatus] = useState("")
  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-label="评论"
      tabIndex={-1}
      className={
        layout === "sheet"
          ? cn(
              "absolute inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-[560px] flex-col rounded-t-[12px] border-t border-(--v3-border) bg-(--v3-panel) pb-[env(safe-area-inset-bottom)] shadow-(--v3-shadow) outline-none select-none",
              canPost ? "max-h-[min(64dvh,560px)]" : "max-h-[min(58dvh,520px)]",
            )
          : SHEET_LAYOUT[layout]
      }
    >
      {layout === "sheet" && <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-[2px] bg-(--v3-handle)" />}
      <div className="flex h-12 shrink-0 items-center gap-2 pr-1.5 pl-4">
        <h2 className="text-[13px] leading-4 font-semibold text-(--v3-text)">评论</h2>
        <span className="text-[12px] leading-4 text-(--v3-text-2) tabular-nums">{list.length ? `第 ${slide} 页 · ${open} 条未解决` : `第 ${slide} 页`}</span>
        <span className="ml-auto">
          <TouchIcon label="关闭评论" Icon={X} onClick={onClose} />
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-(--v3-border) select-text">
        {list.length ? (
          <ol aria-label={`第 ${slide} 页的评论`}>
            {list
              .filter((t) => !t.resolved || showResolved)
              .map((t, i, shown) => {
                const item = (
                  <PhoneThread
                    key={t.id}
                    t={t}
                    open={sel === t.id || replyTo === t.id}
                    canPost={canPost}
                    replying={replyTo === t.id || sel === t.id}
                    onToggle={() => setSel(sel === t.id ? null : t.id)}
                    onReply={() => {
                      setReplyTo(t.id)
                      setSel(t.id)
                    }}
                  />
                )
                // 「已解决 N」一行排在第一条已解决的线程前（收起时它就是最后一行）
                return t.resolved && !shown[i - 1]?.resolved ? [
                      <ResolvedFoldRow
                        key="fold"
                        n={resolvedList.length}
                        open
                        onToggle={() => {
                          setResolvedOpen(false)
                          if (resolvedList.some((x) => x.id === sel)) setSel(null)
                        }}
                      />,
                      item,
                    ] : item
              })}
            {resolvedList.length > 0 && !showResolved && <ResolvedFoldRow n={resolvedList.length} open={false} onToggle={() => setResolvedOpen(true)} />}
          </ol>
        ) : (
          // 空态的陈述句用主文字色（同桌面 EmptyNote 的第一行）
          <p className="px-4 py-8 text-center text-[12px] leading-[18px] text-(--v3-text)">第 {slide} 页还没有评论</p>
        )}
      </div>
      {canPost ? (
        <PhoneComposer
          tablet={tablet}
          replyTo={replyThread}
          initial={replyThread ? d.replyText : undefined}
          onCancelReply={() => setReplyTo(null)}
          onSent={(msg) => {
            setStatus(msg)
            setReplyTo(null)
          }}
        />
      ) : (
        note && (
          <p className="flex shrink-0 items-start gap-1.5 border-t border-(--v3-border) px-4 py-3 text-[12px] leading-[18px] text-(--v3-text-2)">
            <Info size={12} strokeWidth={1.75} aria-hidden="true" className="mt-[3px] shrink-0" />
            <span>{note}</span>
          </p>
        )
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>
    </div>
  )
}

/**
 * 「已解决 N」一行（手机）：点开 / 收起已解决的线程。与桌面是同一个件（kit FoldRow：箭头在前、展开时转 90°、减少动态效果时不转场、text-2、左缘与正文对齐、整行可点、aria-expanded），
 * 用它的触控形态（touch）：高 44（触控 ≥ 44，04 §5）、13px、箭头 16
 */
function ResolvedFoldRow({ n, open, onToggle }: { n: number; open: boolean; onToggle: () => void }) {
  return (
    <li className="border-b border-(--v3-border) last:border-b-0">
      <FoldRow touch open={open} onToggle={onToggle}>
        已解决
        <span className="tabular-nums">{n}</span>
      </FoldRow>
    </li>
  )
}

/**
 * 仅查看形态的评论钉（评论面板打开时画）：CommentLayer 的触控形态（点按区 44）——点钉让底部面板里那一条铺选中底色、aria-current，退出回复模式，
 * 读屏同桌面点钉播报一句（polite，「已定位到第 N 页：…」）。本场景的 PhoneViewer 与第 1 批 narrow 场景的仅查看形态共用（DS-46）
 */
export function PhonePins() {
  const [, setSel] = useSelected()
  const [, setReplyTo] = usePhoneReply()
  const [threads] = useThreads()
  const announce = useAnnounce()
  return (
    <CommentLayer
      touch
      onPinTap={(id) => {
        setSel(id)
        setReplyTo(null)
        const t = threads.find((x) => x.id === id)
        if (t) announce(`已定位到第 ${t.page} 页：${t.imported ? t.imported.author : (t.replies[0]?.by.name ?? "")}的评论`)
      }}
    />
  )
}

/**
 * 仅查看形态的整块画布（替换单页与网格两种视图的内容），评论面板一出现就打开（data.sheet）。
 * 外壳在就声明「现在不能进入母版视图」（kit useViewOnlyMasterGuard，2026-10-28 母版视图第一步修复第 1 轮）：外接键盘按 ⌥⌘M、命令面板请求时说明原因——
 * 手机「在更大窗口中编辑」（嵌入里「当前区域太窄，暂不可用」）；借这个外壳演示平板的状态（data.device tablet，如 alt-tablet-compose）「在电脑上编辑」（03-26 §1.1）
 */
export function PhoneViewer() {
  const { current, notes } = useEditor()
  const d = useData() as { sheet?: Sheet; device?: "phone" | "tablet" }
  useViewOnlyMasterGuard(d.device === "tablet" ? "tablet" : "phone")
  const [sheet, setSheet] = useSceneState<Sheet>("comments.sheet", d.sheet ?? null)
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-(--v3-canvas)">
      <TopBar />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-[104px]">
        <div data-v3-anchor="slide" className="relative mx-auto rounded-[4px] shadow-(--v3-slide-shadow)" style={PAGE_W}>
          <DeckSlideView slide={current} where="canvas" className="rounded-[4px]" />
          {sheet === "comments" && <PhonePins />}
        </div>
        {notes && current.notes && (
          <section aria-label="演讲者备注" className="mx-auto mt-4 rounded-[8px] border border-(--v3-border) bg-(--v3-panel) px-3 pt-2.5 pb-3" style={PAGE_W}>
            <h2 className="text-[12px] leading-4 font-semibold text-(--v3-text-2)">演讲者备注</h2>
            <p className="mt-1.5 text-[13px] leading-5 text-(--v3-text)">{current.notes}</p>
          </section>
        )}
      </div>
      {sheet === null && <PagerBar onComments={() => setSheet("comments")} />}
      {sheet === "comments" && (
        <PhoneCommentsSheet
          onClose={() => {
            setSheet(null)
            // 面板卸载、底部条重新出现后，焦点交回「评论」按钮（不掉到 body）
            requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-v3-anchor="${SHEET_TRIGGER}"]`)?.focus({ preventScroll: true }))
          }}
        />
      )}
    </div>
  )
}

/* ================================================================== 平板（触控、≥ 640）的仅查看形态与评论面板落位（rulings §4.25 DS-131） */

/**
 * 平板（触控、≥ 640）仅查看形态里的只读评论面板（rulings §4.25 DS-46、DS-131、TB-49，PRD NF-07）。外观沿用仅查看形态（顶部条 · 当前页 · 只读备注 · 底部翻页条），
 * 面板就是手机评论面板这一个件（PhoneCommentsSheet：标题写未解决数、「已解决 N」折叠行、平板只读、底部「平板上只能查看评论」），只改它在平板上的落位（layout）：
 * DS-131 按方向混用——竖屏 stacked、横屏 sidebar（产品按窗口方向选，转动设备时换落位；样张按状态固定落位，截图按状态登记的视口拍）：
 * - stacked：当前页在上、面板在下。当前页照常全宽，备注卡照常在它下面（竖屏有空间，评审时备注是读幻灯片的上下文），面板补满剩下的高度；
 *   只有这样排面板不足 40dvh 时，备注卡才让位、当前页再按「给面板留 40dvh」收窄（宽 = min(可用宽, (60dvh − 88) × 16/9)）。
 * - sidebar：右侧整高侧栏 360（顶部条以下），当前页与备注卡在左侧适应。
 * 顶部条状态行写「仅查看 · 在电脑上编辑」（rulings §4.25 TB-125、TB-136：平板是因为触控才只读，不是窗口小；窗口窄的仍写「在更大窗口中编辑」）；
 * 嵌入（iframe）里又是平板时照写这一句，不改成「仅查看」或「当前区域太窄…」（TB-159：触控的原因优先，嵌入只改写「在更大窗口中编辑」）。
 * 第 3 批转正时由 narrow-review/tablet.tsx 并入这里（第 2 批 comments.tablet 改用 stacked，DS-131），画法逐像素相同；sheetKey / trigger 是面板开关的场景状态键与「评论」按钮的锚点。
 */
export type TabletLayout = "stacked" | "sidebar"

/** 上下排开、备注卡让位时的当前页宽：给面板留出至少 40dvh——可用高 = 视口 − 顶部条 56 − 上留白 16 − 页与面板间距 16 − 40dvh，宽 = 可用高 × 16/9 */
const STACKED_W: CSSProperties = { width: "min(100%, calc((60dvh - 88px) * 16 / 9))" }

/** 平板的顶部条：与仅查看形态同一条（返回首页 · 文档标题 + 状态行 · 更多），状态行「仅查看 · 在电脑上编辑」（TB-125） */
function TabletTopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-(--v3-border) bg-(--v3-panel) px-1.5 select-none">
      <TouchIcon label="返回首页" Icon={ChevronLeft} />
      <div className="min-w-0 flex-1 px-1">
        <h1 className="truncate text-[13px] leading-4 font-semibold text-(--v3-text)">{DOC_TITLE}</h1>
        <p role="status" className="mt-1 flex items-center gap-1 text-[12px] leading-4 text-(--v3-text-2)">
          <Eye size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
          <span className="whitespace-nowrap">仅查看</span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap">在电脑上编辑</span>
        </p>
      </div>
      <TouchIcon label="更多" Icon={Ellipsis} />
    </header>
  )
}

/** 平板的底部翻页条（面板打开时让位）：上一页 · 页码 · 下一页 ┊ 评论（本页未解决数）——同仅查看形态；trigger 是「评论」按钮的锚点 */
function TabletPagerBar({ onComments, trigger }: { onComments: () => void; trigger: string }) {
  const { slide, deck, goTo } = useEditor()
  const [threads] = useThreads()
  const n = threads.filter((t) => t.page === slide && !t.resolved).length
  return (
    <div
      role="toolbar"
      aria-label="翻页与评论"
      className="absolute bottom-4 left-1/2 z-20 mb-[env(safe-area-inset-bottom)] flex -translate-x-1/2 items-center gap-2 rounded-[12px] border border-(--v3-border) bg-(--v3-panel) p-1 shadow-(--v3-shadow) select-none"
    >
      <TouchIcon label="上一页" Icon={ChevronLeft} disabled={slide <= 1} reason="已是第一页" onClick={() => goTo(slide - 1)} />
      <span className="flex h-11 min-w-16 items-center justify-center px-3 text-[13px] leading-none text-(--v3-text) tabular-nums">
        {slide}
        <span className="px-1 text-(--v3-text-2)">/</span>
        {deck.length}
      </span>
      <TouchIcon label="下一页" Icon={ChevronRight} disabled={slide >= deck.length} reason="已是最后一页" onClick={() => goTo(slide + 1)} />
      <span aria-hidden="true" className="h-6 w-px shrink-0 bg-(--v3-border)" />
      <button
        type="button"
        data-v3-anchor={trigger}
        aria-label={n ? `评论（本页 ${n} 条）` : "评论（本页没有评论）"}
        aria-haspopup="dialog"
        onClick={onComments}
        className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-[8px] px-3 text-(--v3-text-2) transition-colors hover:bg-(--v3-panel-2) hover:text-(--v3-text)"
      >
        <MessageSquare {...ICON_LG} />
        {n > 0 && <span className="text-[13px] leading-none text-(--v3-text) tabular-nums">{n}</span>}
      </button>
    </div>
  )
}

/** 演讲者备注（只读）：同仅查看形态的备注卡（这一页没有备注时写「这一页没有演讲者备注」，同 narrow 查看器与桌面只读态；rulings §4.25 DS-138，2026-10-22 由「这一页没有备注」改） */
function TabletNotesCard({ style }: { style: CSSProperties }) {
  const { current, notes } = useEditor()
  if (!notes) return null
  return (
    <section aria-label="演讲者备注" className="mx-auto shrink-0 rounded-[8px] border border-(--v3-border) bg-(--v3-panel) px-3 pt-2.5 pb-3" style={style}>
      <h2 className="text-[12px] leading-4 font-semibold text-(--v3-text-2)">演讲者备注</h2>
      {current.notes ? (
        <p className="mt-1.5 text-[13px] leading-5 text-(--v3-text)">{current.notes}</p>
      ) : (
        <p className="mt-1.5 text-[12px] leading-[18px] text-(--v3-text-2)">这一页没有演讲者备注</p>
      )}
    </section>
  )
}

/**
 * 上下排开时备注卡留不留：先按「当前页全宽 · 备注卡 · 面板」排一遍，面板不足 40dvh 就让备注卡让位（布局副作用在绘制前完成，画面不闪）；
 * 换页（备注长短不同）或窗口尺寸变了重新判断
 */
function useNotesFit(panel: RefObject<HTMLDivElement | null>, active: boolean): boolean {
  const { slide, notes } = useEditor()
  const [fit, setFit] = useState(true)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const on = () => setTick((n) => n + 1)
    window.addEventListener("resize", on)
    return () => window.removeEventListener("resize", on)
  }, [])
  useLayoutEffect(() => setFit(true), [slide, notes, tick, active])
  useLayoutEffect(() => {
    if (!active || !fit) return
    const h = panel.current?.getBoundingClientRect().height ?? 0
    if (h < window.innerHeight * 0.4) setFit(false)
  })
  return fit
}

/**
 * 平板的仅查看形态（替换单页与网格两种视图的内容），评论面板一出现就打开（data.sheet）。layout 见上（DS-131：竖屏 stacked、横屏 sidebar）。
 * 用户关闭面板后焦点交回底部条的「评论」；再点「评论」打开时焦点落在面板本身（PhoneCommentsSheet 自己处理）
 * 外壳在就声明「现在不能进入母版视图」，原因「在电脑上编辑」（嵌入里也是；与顶部状态行同一口径，TB-125、TB-136、TB-159；kit useViewOnlyMasterGuard，2026-10-28 母版视图第一步修复第 1 轮）
 */
export function TabletViewer({ layout, sheetKey = "comments.sheet", trigger = SHEET_TRIGGER }: { layout: TabletLayout; sheetKey?: string; trigger?: string }) {
  const { current, data, notes } = useEditor()
  useViewOnlyMasterGuard("tablet")
  const [sheet, setSheet] = useSceneState<Sheet>(sheetKey, (data.sheet as Sheet | undefined) ?? null)
  const open = sheet === "comments"
  const panelRef = useRef<HTMLDivElement>(null)
  const notesFit = useNotesFit(panelRef, open && layout === "stacked" && notes)
  const close = () => {
    setSheet(null)
    // 面板卸载、底部条重新出现后，焦点交回「评论」按钮（不掉到 body）
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-v3-anchor="${trigger}"]`)?.focus({ preventScroll: true }))
  }
  const sheetEl = <PhoneCommentsSheet onClose={close} layout={layout} />
  const slideBox = (style: CSSProperties) => (
    <div data-v3-anchor="slide" className="relative mx-auto shrink-0 rounded-[4px] shadow-(--v3-slide-shadow)" style={style}>
      <DeckSlideView slide={current} where="canvas" className="rounded-[4px]" />
      {open && <PhonePins />}
    </div>
  )
  if (layout === "sidebar")
    return (
      <div className="absolute inset-0 z-10 flex flex-col bg-(--v3-canvas)">
        <TabletTopBar />
        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-[104px]">
            {slideBox(PAGE_W)}
            <TabletNotesCard style={PAGE_W} />
          </div>
          {open && <div className="w-[360px] shrink-0">{sheetEl}</div>}
        </div>
        {!open && <TabletPagerBar trigger={trigger} onComments={() => setSheet("comments")} />}
      </div>
    )
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-(--v3-canvas)">
      <TabletTopBar />
      {open ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pt-4">
          {slideBox(notesFit ? PAGE_W : STACKED_W)}
          {notesFit && <TabletNotesCard style={PAGE_W} />}
          <div ref={panelRef} className="mx-auto min-h-0 flex-1" style={notesFit ? PAGE_W : STACKED_W}>
            {sheetEl}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-[104px]">
          {slideBox(PAGE_W)}
          <TabletNotesCard style={PAGE_W} />
        </div>
      )}
      {!open && <TabletPagerBar trigger={trigger} onComments={() => setSheet("comments")} />}
    </div>
  )
}
