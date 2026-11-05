import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react"
import { CircleAlert, CircleCheck, CloudOff, Ellipsis, Info, Link2, Pencil, RotateCcw, Check, Trash2, Unlink } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, Button, FoldRow, ICON, IconButton, Menu, rescueFocus, Tag, Tip, useEditor, type MenuSpec } from "../../kit"
import { Composer } from "./Composer"
import { readOnlyImport, resolveReason, U, type Reply, type Thread, type User } from "./model"
import { RichText } from "./RichText"
import { newId, useAnnounce, useConfirm, useData, useEditing, useFlash, usePerms, useResolvedOpen, useSelected, useThreads, useToast } from "./store"

/**
 * 评论线程（03-06）：检查器「评论」页签里的一条。
 * - 收起（缺省）：锚点说明（元素名 / 引文 / 整页；「全部」等跨页筛选时前面加页码）· 作者行（20px 头像 · 姓名 12px 500 · 相对时间 text-2）· 正文（折叠 3 行）· 「N 条回复」。
 *   作者名一律中等字重 500（线程、回复、钉悬停卡、聚合钉、手机面板同此；04 §2.8 的 600 只给节标题），@提及同为 500（RichText）。
 * - 选中（点线程、点评论钉、评审条翻到）：线程主体（锚点说明 · 作者行 · 正文）铺强调色淡底，画法同第 1 批左栏当前页、版本历史选中行（左右内缩 8、圆角 6，Q3「选中」）；
 *   展开全部回复（左侧细线连成一串，读屏为嵌套列表）与回复框，都在淡底之外的面板底上；
 *   右上角「解决」与「⋯」（未选中时悬停或聚焦才出现）；画布上对应的评论钉加强调色外圈、锚点对象虚线标出。
 * - 已解决：列表末尾收成一行「› 已解决 N」（中性色，第 2 批统一的折叠行画法，ResolvedFold），点开逐条列出摘要（✓ · 发起人 · 回复数，正文两行），点摘要展开完整对话，
 *   「解决」的位置换成「重新打开」；解决之后又有新回复时摘要与展开处都写明（05 §5 场景 J）。
 * - 已脱离锚点：锚点说明换成「原对象已删除」（工具提示写谁何时删的、24 小时内恢复后回到原处），没有画布钉，照常回复与解决；锚点无法解析同理。
 * - 从 pptx 导入的只读批注：作者名取自原文件、头像不用身份色，标「来自原文件」，不能回复与解决，底部「导入为可编辑评论」（P1，50/08 §7）。
 * 交互：点线程正文区域选中 / 收起；回复区与按钮不冒泡。键盘：作者行是按钮（aria-expanded，焦点环 2px 强调色、命中高 24），Tab 到「解决」「⋯」与回复框。
 * 焦点不掉到 body（07 §2.3）：解决后交给这条的摘要行（或「已解决 N」）、删除回复后交给线程的作者行、编辑框打开即聚焦、关掉后回到「⋯」，
 * 删除确认框关闭后回到打开它的「⋯」（每个「⋯」有自己的锚点 comments.more-〈线程〉/ comments.reply-more-〈回复〉）。
 */

/** 线程的「⋯」与回复的「⋯」的锚点（确认框关闭、编辑结束后焦点交回这里） */
export const threadMoreAnchor = (id: string) => `comments.more-${id}`
export const replyMoreAnchor = (id: string) => `comments.reply-more-${id}`

/** 下一帧把焦点交给某个元素（找不到时交给 fallback，再没有就交给画布）：被聚焦的元素随状态变化卸载时用 */
export function focusSoon(find: () => HTMLElement | null | undefined, fallback?: () => HTMLElement | null | undefined) {
  requestAnimationFrame(() => {
    const el = find() ?? fallback?.()
    if (el) el.focus({ preventScroll: true })
    else rescueFocus()
  })
}

/** 某条线程的作者行按钮（选中 / 展开线程的入口） */
export const threadHead = (id: string) => document.querySelector<HTMLElement>(`[data-thread="${CSS.escape(id)}"] [data-thread-head]`)

const SI = { size: 12, strokeWidth: 1.75, "aria-hidden": true } as const

/** 点在按钮、链接、文本框、候选上时不触发「选中 / 收起线程」 */
const stop = (e: MouseEvent) => e.stopPropagation()

/** 作者头像：协作者用身份色（20px）；导入批注的作者不是协作者，用中性底，不占身份色（Q3：身份色只给「谁」） */
export function AuthorAvatar({ u, imported }: { u: User; imported?: boolean }) {
  if (imported)
    return (
      <span aria-label={u.name} className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-(--v3-panel-3) text-[12px] leading-none font-medium text-(--v3-text-2) select-none">
        {u.name.slice(0, 1)}
      </span>
    )
  return <Avatar name={u.name} tone={u.tone} size={20} />
}

/** 作者行尾的标记：已编辑（工具提示写编辑时间）、待同步（离线时本端尚未同步） */
function ReplyMeta({ r }: { r: Reply }) {
  return (
    <>
      {r.edited && (
        <Tip label={`编辑于 ${r.edited}`}>
          <span tabIndex={0} className="shrink-0 rounded-[4px] text-[12px] leading-none whitespace-nowrap text-(--v3-text-2) outline-none focus-visible:ring-2 focus-visible:ring-(--v3-accent)">
            已编辑
          </span>
        </Tip>
      )}
      {r.pending && (
        <span className="flex shrink-0 items-center gap-1 text-[12px] leading-none whitespace-nowrap text-(--v3-text-2)">
          <CloudOff {...SI} />
          待同步
        </span>
      )}
    </>
  )
}

/** 锚点说明（12px text-2）：元素名 / 「引文」/ 整页；已脱离锚点与解析失败带图标与原因 */
export function AnchorLine({ t, showPage }: { t: Thread; showPage?: boolean }) {
  const pre = showPage ? `第 ${t.page} 页 · ` : ""
  const cls = "flex min-w-0 items-center gap-1 text-[12px] leading-4 text-(--v3-text-2)"
  if (t.anchor.detached) {
    const d = t.anchor.detached
    return (
      <Tip lines={[`${d.by} ${d.when} 删除了「${t.anchor.label}」。`, "24 小时内恢复该对象后，评论会回到原处。"]} label={`${d.by} ${d.when} 删除了「${t.anchor.label}」`}>
        <span tabIndex={0} className={cn(cls, "rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-(--v3-accent)")}>
          <Unlink {...SI} className="shrink-0" />
          <span className="truncate">{pre}原对象已删除</span>
        </span>
      </Tip>
    )
  }
  if (t.anchor.broken) {
    return (
      <Tip label="找不到评论所在的位置，评论内容不受影响">
        <span tabIndex={0} className={cn(cls, "rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-(--v3-accent)")}>
          <CircleAlert {...SI} className="shrink-0" />
          <span className="truncate">{pre}锚点无法解析</span>
        </span>
      </Tip>
    )
  }
  return (
    <span className={cls}>
      <span className="truncate">
        {pre}
        {t.anchor.label}
      </span>
      {t.imported && <Tag className="ml-1">来自原文件</Tag>}
    </span>
  )
}

/** 删除自己的评论 / 回复：先乐观隐藏，5 秒内可撤销（50/08 §5）；首条评论有回复时只留「此评论已删除」 */
function useDeleteOwn() {
  const [threads, setThreads] = useThreads()
  const [, setToast] = useToast()
  const [sel, setSel] = useSelected()
  return (t: Thread, r: Reply) => {
    const prev = threads
    const isRoot = t.replies[0]?.id === r.id
    // 被删的那条（和它的「⋯」）随之消失：焦点交给这条线程的作者行；整条线程没了交给同页相邻的线程，再没有交给画布
    const i = threads.findIndex((x) => x.id === t.id)
    const near = threads.slice(i + 1).find((x) => x.page === t.page) ?? threads.slice(0, i).reverse().find((x) => x.page === t.page)
    focusSoon(() => threadHead(t.id), () => (near ? threadHead(near.id) : null))
    if (isRoot && t.replies.length === 1) {
      setThreads(threads.filter((x) => x.id !== t.id))
      if (sel === t.id) setSel(null)
    } else if (isRoot) {
      setThreads(threads.map((x) => (x.id === t.id ? { ...x, replies: x.replies.map((y) => (y.id === r.id ? { ...y, body: "", deleted: true, edited: undefined } : y)) } : x)))
    } else {
      setThreads(threads.map((x) => (x.id === t.id ? { ...x, replies: x.replies.filter((y) => y.id !== r.id) } : x)))
    }
    setToast({ text: isRoot ? "已删除你的评论" : "已删除你的回复", action: "撤销", undo: prev })
  }
}

/** 线程右上角的「⋯」：编辑（自己的）· 复制链接 · 重新锚定（P1，已脱离锚点时）┊ 删除评论（自己的）/ 删除讨论串…（文档所有者） */
function ThreadMenu({ t }: { t: Thread }) {
  const perms = usePerms()
  const [, setEditing] = useEditing()
  const [, setToast] = useToast()
  const [, setConfirm] = useConfirm()
  const del = useDeleteOwn()
  const root = t.replies[0]
  if (!root) return null
  const items: MenuSpec[] = []
  if (!readOnlyImport(t) && !root.deleted && perms.editReply(root)) items.push({ id: "edit", label: "编辑", icon: <Pencil {...ICON} />, onSelect: () => setEditing(root.id) })
  const more = threadMoreAnchor(t.id)
  if (perms.copyLink) items.push({ id: "link", label: "复制链接", icon: <Link2 {...ICON} />, onSelect: () => setToast({ text: "已复制评论链接" }) })
  if (t.anchor.detached && perms.comment) items.push({ id: "reanchor", label: "重新锚定…", tag: "P1", disabled: true, reason: "后续版本提供" })
  const danger: MenuSpec[] = []
  if (perms.deleteThread) danger.push({ id: "delete-thread", label: "删除讨论串…", icon: <Trash2 {...ICON} />, danger: true, onSelect: () => setConfirm({ kind: "thread", threadId: t.id, returnTo: more }) })
  else if (!readOnlyImport(t) && !root.deleted && perms.deleteReply(root)) danger.push({ id: "delete", label: "删除评论", icon: <Trash2 {...ICON} />, danger: true, onSelect: () => del(t, root) })
  const all = items.length && danger.length ? [...items, { type: "separator" } as MenuSpec, ...danger] : [...items, ...danger]
  if (!all.length) return null
  return (
    <Menu
      align="end"
      label="评论操作"
      items={all}
      // 选了「编辑」后焦点交给原位换出的编辑框，菜单关闭时不再抢回「⋯」
      keepFocus
      trigger={
        <IconButton label="更多操作" size={24} noTip aria-haspopup="menu" data-v3-anchor={more}>
          <Ellipsis {...ICON} />
        </IconButton>
      }
    />
  )
}

/** 回复的「⋯」：编辑（自己的）┊ 删除回复（自己的，可撤销）/ 删除回复…（文档所有者删他人的，确认后不可撤销） */
function ReplyMenu({ t, r }: { t: Thread; r: Reply }) {
  const perms = usePerms()
  const [, setEditing] = useEditing()
  const [, setConfirm] = useConfirm()
  const del = useDeleteOwn()
  if (readOnlyImport(t)) return null
  const own = r.by.id === U.zhou.id
  const more = replyMoreAnchor(r.id)
  const items: MenuSpec[] = []
  if (perms.editReply(r)) items.push({ id: "edit", label: "编辑", icon: <Pencil {...ICON} />, onSelect: () => setEditing(r.id) })
  if (perms.deleteReply(r)) {
    if (items.length) items.push({ type: "separator" })
    items.push(
      own
        ? { id: "delete", label: "删除回复", icon: <Trash2 {...ICON} />, danger: true, onSelect: () => del(t, r) }
        : { id: "delete", label: "删除回复…", icon: <Trash2 {...ICON} />, danger: true, onSelect: () => setConfirm({ kind: "reply", threadId: t.id, replyId: r.id, returnTo: more }) },
    )
  }
  if (!items.length) return null
  return (
    <Menu
      align="end"
      label="回复操作"
      items={items}
      keepFocus
      trigger={
        <IconButton label="回复的更多操作" size={24} noTip aria-haspopup="menu" data-v3-anchor={more}>
          <Ellipsis {...ICON} />
        </IconButton>
      }
    />
  )
}

/** 编辑自己的评论：原位换成撰写框（取消 / 保存，↵ 保存），保存后标「已编辑」 */
function EditBox({ t, r }: { t: Thread; r: Reply }) {
  const [, setThreads] = useThreads()
  const [, setEditing] = useEditing()
  const [text, setText] = useState(r.body)
  // 编辑框随保存 / 取消卸载：焦点交回这一条的「⋯」（首条评论是线程的「⋯」，回复是回复的「⋯」），「⋯」藏着时退到作者行
  const back = () => {
    const name = t.replies[0]?.id === r.id ? threadMoreAnchor(t.id) : replyMoreAnchor(r.id)
    focusSoon(() => document.querySelector<HTMLElement>(`[data-v3-anchor="${name}"]`), () => threadHead(t.id))
  }
  return (
    <div onClick={stop} className="mt-2">
      <Composer
        variant="edit"
        value={text}
        onChange={setText}
        autoFocus
        showFocused
        placeholder="编辑评论"
        aria="编辑评论"
        submitLabel="保存"
        onCancel={() => {
          setEditing(null)
          back()
        }}
        onSubmit={(v) => {
          setThreads((ts) => ts.map((x) => (x.id === t.id ? { ...x, replies: x.replies.map((y) => (y.id === r.id ? { ...y, body: v, edited: "刚刚" } : y)) } : x)))
          setEditing(null)
          back()
        }}
      />
    </div>
  )
}

function ReplyItem({ t, r }: { t: Thread; r: Reply }) {
  const [editing] = useEditing()
  return (
    <li className="group/reply">
      <div className="flex h-5 min-w-0 items-center gap-2">
        <AuthorAvatar u={r.by} imported={!!t.imported} />
        <span className="truncate text-[12px] leading-none font-medium text-(--v3-text)">{r.by.name}</span>
        <span className="shrink-0 text-[12px] leading-none whitespace-nowrap text-(--v3-text-2)">{r.when}</span>
        <ReplyMeta r={r} />
        <span className="-my-1 ml-auto opacity-0 transition-opacity group-hover/reply:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100">
          <ReplyMenu t={t} r={r} />
        </span>
      </div>
      {editing === r.id ? <EditBox t={t} r={r} /> : <RichText text={r.body} className="mt-1.5" />}
    </li>
  )
}

/** 线程里的回复框（选中时出现）：收起时一行「回复…」，聚焦展开；读屏名「回复〈发起人〉」 */
function ReplyBox({ t }: { t: Thread }) {
  const [, setThreads] = useThreads()
  const announce = useAnnounce()
  const [text, setText] = useState("")
  const root = t.replies[0]
  const who = t.imported ? t.imported.author : (root?.by.name ?? "")
  return (
    <li>
      <Composer
        variant="reply"
        value={text}
        onChange={setText}
        listSide="bottom"
        placeholder="回复…"
        aria={`回复${who}`}
        submitLabel="回复"
        onCancel={() => setText("")}
        onSubmit={(v) => {
          setThreads((ts) => ts.map((x) => (x.id === t.id ? { ...x, activity: 0, replies: [...x.replies, { id: newId(), by: U.zhou, when: "刚刚", body: v }] } : x)))
          setText("")
          announce(`已回复${who}`)
        }}
      />
    </li>
  )
}

/**
 * 已解决线程的摘要（「已解决 N」展开后逐条列出）：✓ · 发起人 ·（跨页时页码）· 回复数 · 有新回复 / 下一行正文最多两行（点开看全文，Q7 不逐条截成一行省略号）
 */
function ResolvedRow({ t, showPage, onOpen }: { t: Thread; showPage?: boolean; onOpen: () => void }) {
  const root = t.replies[0]
  const fresh = t.replies.some((r) => r.afterResolve)
  const n = t.replies.length - 1
  return (
    <li data-thread={t.id} className="border-b border-(--v3-border) px-2 py-1 last:border-b-0">
      {/* 悬停与线程主体同一画法：左右内缩 8、圆角 6 */}
      <button
        type="button"
        aria-expanded={false}
        aria-label={`已解决：${root?.by.name ?? ""}的评论，${t.resolved?.by.name ?? ""}于${t.resolved?.when ?? ""}解决${fresh ? "，解决后有新回复" : ""}，展开`}
        onClick={onOpen}
        className="flex w-full min-w-0 flex-col gap-1 rounded-[6px] px-2 py-1 text-left text-[12px] transition-colors hover:bg-(--v3-panel-2)"
      >
        <span className="flex h-4 min-w-0 items-center gap-2 leading-none">
          <CircleCheck {...SI} className="shrink-0 text-(--v3-text-2)" />
          <span className="shrink-0 font-medium text-(--v3-text)">{root?.by.name}</span>
          <span className="shrink-0 whitespace-nowrap text-(--v3-text-2)">
            {showPage ? `第 ${t.page} 页 · ` : ""}
            {n > 0 ? `${n} 条回复` : "没有回复"}
          </span>
          {fresh && <span className="ml-auto shrink-0 text-(--v3-text)">有新回复</span>}
        </span>
        <span className="line-clamp-2 pl-5 leading-[18px] text-(--v3-text-2)">{root?.deleted ? "此评论已删除" : root?.body}</span>
      </button>
    </li>
  )
}

/**
 * 已解决的线程收在列表（或页组）末尾的一行「› 已解决 N」（Figma 默认也把已解决的藏起来）：点开逐条列出摘要，再点摘要展开完整对话。
 * 画法是第 2 批统一的折叠 / 展开行 kit FoldRow（设计 04 没有列表折叠行的规定，第 6 轮按集成定的口径；版本历史的月份行、自动版本组行、「最近删除」行是同一个件）：
 * 高 32、箭头在前（ChevronRight 12，展开时转 90°，减少动态效果时不转场）、文字 12px text-2、左缘与列表正文对齐（16）、整行可点（悬停铺 panel-2、文字转主色）、aria-expanded。
 * 选中了其中一条（深链、评审条、「重新打开」前查看）时自动展开。groupKey 区分页组（「按页码」时每组一行）。
 */
export function ResolvedFold({ threads, showPage, groupKey }: { threads: Thread[]; showPage?: boolean; groupKey: string }) {
  const [open, setOpen] = useResolvedOpen()
  const [sel] = useSelected()
  if (!threads.length) return null
  const shown = open || threads.some((t) => t.id === sel)
  return (
    <li>
      {/* kit FoldRow 的通栏形态（评论列表的行是通栏；版本历史用同一个件的 inset 形态） */}
      <FoldRow data-resolved-fold={groupKey} open={shown} onToggle={() => setOpen(!shown)}>
        已解决
        <span className="tabular-nums">{threads.length}</span>
      </FoldRow>
      {shown && (
        <ol aria-label="已解决的评论" className="border-t border-(--v3-border)">
          {threads.map((t) => (
            <ThreadItem key={t.id} t={t} showPage={showPage} />
          ))}
        </ol>
      )}
    </li>
  )
}

/** 一条线程（列表项）。showPage：跨页筛选时锚点说明前加页码 */
export function ThreadItem({ t, showPage }: { t: Thread; showPage?: boolean }) {
  const ctx = useEditor()
  const d = useData()
  const perms = usePerms()
  const [sel, setSel] = useSelected()
  const [flash] = useFlash()
  const [, setThreads] = useThreads()
  const [editing] = useEditing()
  const [, setToast] = useToast()
  const announce = useAnnounce()
  const ref = useRef<HTMLLIElement>(null)
  const selected = sel === t.id
  const root = t.replies[0]
  const flashing = flash?.id === t.id
  const [ring, setRing] = useState(false)

  // 定位：滚入视口、描边淡出（03-06「高亮描边…淡出」）
  useEffect(() => {
    if (!flashing) return
    ref.current?.scrollIntoView({ block: "nearest" })
    setRing(true)
    const id = window.setTimeout(() => setRing(false), 1600)
    return () => window.clearTimeout(id)
  }, [flashing, flash?.n])

  // 静态状态里选中的线程一出现就滚入视口（截图与 Hub 链接里看得到）
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" })
    // 只在挂载时
  }, [])

  const toggle = () => {
    if (selected) {
      setSel(null)
      return
    }
    setSel(t.id)
    // 点面板里的线程：换到它所在的页，画布对应的钉脉冲一次（03-06）
    if (t.page !== ctx.slide && !t.anchor.detached) ctx.goTo(t.page)
  }

  if (t.resolved && !selected) return <ResolvedRow t={t} showPage={showPage} onOpen={toggle} />
  if (!root) return null

  const replies = t.replies.slice(1)
  const canResolve = perms.resolve(t)
  const showResolve = !readOnlyImport(t) && perms.comment
  const fresh = t.resolved && t.replies.some((r) => r.afterResolve)
  const resolveBtn = showResolve && (
    <IconButton
      label={t.resolved ? "重新打开" : "解决"}
      size={24}
      disabled={!canResolve}
      reason={resolveReason(t)}
      tipOpen={d.resolveTip === t.id}
      data-thread-resolve=""
      onClick={() => {
        setThreads((ts) => ts.map((x) => (x.id === t.id ? { ...x, resolved: x.resolved ? undefined : { by: U.zhou, when: "刚刚" }, replies: x.replies.map((r) => ({ ...r, afterResolve: false })) } : x)))
        if (!t.resolved) {
          setSel(null)
          setToast({ text: "已解决", action: "重新打开", reopen: t.id })
          // 「解决」随线程收起而消失：焦点交给它的摘要行（「已解决 N」展开着时），否则交给同一组的「已解决 N」
          const group = ref.current?.closest<HTMLElement>("[data-comments-group]")
          focusSoon(
            () => document.querySelector<HTMLElement>(`[data-thread="${CSS.escape(t.id)}"] button`),
            () => group?.querySelector<HTMLElement>("[data-resolved-fold]") ?? document.querySelector<HTMLElement>("[data-resolved-fold]"),
          )
        } else {
          // 「重新打开」：线程回到未解决，从「已解决」里移到列表上方（重新挂载），这颗按钮随之换成「解决」——
          // 焦点交给这条线程新出现的「解决」，找不到就交给它的作者行（不掉到 body，07 §2.3）；读屏播报一句
          focusSoon(() => document.querySelector<HTMLElement>(`[data-thread="${CSS.escape(t.id)}"] [data-thread-resolve]`), () => threadHead(t.id))
          announce(`已重新打开${t.imported ? t.imported.author : (root?.by.name ?? "")}的评论`)
        }
      }}
    >
      {t.resolved ? <RotateCcw {...ICON} /> : <Check {...ICON} />}
    </IconButton>
  )

  const showReplies = selected && (replies.length > 0 || (perms.comment && !t.resolved && !readOnlyImport(t)))
  return (
    <li ref={ref} data-thread={t.id} onClick={toggle} className="group/thread relative cursor-default border-b border-(--v3-border) px-2 py-1 last:border-b-0">
      {/*
        线程主体（锚点说明、作者行、正文）：选中时铺强调色淡底，画法同第 1 批左栏当前页、版本历史选中行（左右内缩 8、圆角 6），悬停同一块铺 panel-2；
        展开的回复与回复框在主体之外、面板底上（回复串的连线与次按钮细边在两套主题里都看得见）。主体里只有编辑自己首条评论时的「取消」是次按钮，
        淡底上的细边局部加深一档（--v3-btn-line），亮色下也看得出是按钮（DS-37）
      */}
      <div
        data-thread-body=""
        className={cn(
          "rounded-[6px] px-2 py-2 transition-[background-color,box-shadow] duration-500",
          selected ? "bg-(--v3-accent-soft) [--v3-btn-line:color-mix(in_srgb,var(--v3-text-3)_45%,transparent)]" : "hover:bg-(--v3-panel-2)",
          ring && "shadow-[inset_0_0_0_1px_var(--v3-accent)] duration-0",
        )}
      >
      {t.resolved && (
        <p className="mb-2 flex items-center gap-1 text-[12px] leading-4 text-(--v3-text-2)">
          <CircleCheck {...SI} className="shrink-0" />
          {t.resolved.by.name} 已解决 · {t.resolved.when}
        </p>
      )}
      {fresh && (
        <p role="status" className="mb-2 flex items-center gap-1 text-[12px] leading-4 text-(--v3-text)">
          <Info {...SI} className="shrink-0 text-(--v3-text-2)" />
          解决之后又有 {t.replies.filter((r) => r.afterResolve).length} 条新回复
        </p>
      )}
      <div className="flex h-4 items-center gap-2">
        <AnchorLine t={t} showPage={showPage} />
        <div
          onClick={stop}
          className={cn(
            "-my-1 -mr-1 ml-auto flex shrink-0 items-center gap-0.5 transition-opacity",
            selected ? "" : "opacity-0 group-hover/thread:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100",
          )}
        >
          {resolveBtn}
          <ThreadMenu t={t} />
        </div>
      </div>
      <div className="mt-2 flex h-5 min-w-0 items-center gap-2">
        {/* 作者行按钮：焦点环用底座的 :focus-visible（2px 强调色、偏移 1，07 §2.1）；h-6 -my-0.5 把命中区补到 24（WCAG 2.5.8），行高不变 */}
        <button
          type="button"
          data-thread-head=""
          aria-expanded={selected}
          aria-label={`${t.imported ? t.imported.author : root.by.name}的评论：${root.deleted ? "此评论已删除" : root.body.slice(0, 40)}${replies.length ? `，${replies.length} 条回复` : ""}`}
          className="-my-0.5 flex h-6 min-w-0 items-center gap-2 rounded-[4px] text-left"
        >
          <AuthorAvatar u={root.by} imported={!!t.imported} />
          <span className="truncate text-[12px] leading-none font-medium text-(--v3-text)">{root.by.name}</span>
          <span className="shrink-0 text-[12px] leading-none whitespace-nowrap text-(--v3-text-2)">{root.when}</span>
        </button>
        <ReplyMeta r={root} />
      </div>
      {root.deleted ? (
        <p className="mt-2 text-[12px] leading-[18px] text-(--v3-text-2)">此评论已删除</p>
      ) : editing === root.id ? (
        <EditBox t={t} r={root} />
      ) : (
        <RichText text={root.body} className="mt-2" />
      )}
      {!selected && replies.length > 0 && <p className="mt-2 text-[12px] leading-4 text-(--v3-text-2)">{replies.length} 条回复</p>}
      </div>
      {showReplies && (
        // 回复串在主体淡底之外：连线的位置（作者头像中线）与内容左缘同改前
        <ol onClick={stop} aria-label="回复" className="mt-2 mr-2 mb-2 ml-[17px] flex cursor-auto flex-col gap-3 border-l border-(--v3-border) pl-[18px]">
          {replies.map((r) => (
            <ReplyItem key={r.id} t={t} r={r} />
          ))}
          {perms.comment && !t.resolved && !readOnlyImport(t) && !t.replies.some((r) => r.id === editing) && <ReplyBox t={t} />}
        </ol>
      )}
      {readOnlyImport(t) && perms.comment && (
        <div onClick={stop} className="mx-2 mt-1 mb-2">
          <ImportButton t={t} />
        </div>
      )}
    </li>
  )
}

/**
 * 「导入为可编辑评论」（P1，50/08 §7）：协同模式经服务端改写，结果经 CRDT 到达；之后可回复与解决。
 * 按钮随之消失：焦点交给这条线程的作者行（不掉到 body，07 §2.3）
 */
function ImportButton({ t }: { t: Thread }): ReactNode {
  const [, setThreads] = useThreads()
  const [, setToast] = useToast()
  return (
    <Button
      variant="secondary"
      onClick={() => {
        setThreads((ts) => ts.map((x) => (x.id === t.id && x.imported ? { ...x, imported: { ...x.imported, editable: true } } : x)))
        setToast({ text: "已导入为可编辑评论" })
        focusSoon(() => threadHead(t.id))
      }}
    >
      导入为可编辑评论
    </Button>
  )
}
