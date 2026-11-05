import { useEffect } from "react"
import {
  Dialog, INSERT_ITEMS, RailList, RailThumb, ReviewToolbar, Toast, Toasts, useEditor, useEditorCommand, userHasInteracted, ViewerToolbar, type EditorCtx, type MenuSpec, type RegionDefaults,
} from "../../kit"
import { navOrder, pageCounts } from "./model"
import { useAnnouncement, useConfirm, useData, useLocate, useSelected, useThreads, useToast } from "./store"
import { threadHead, threadMoreAnchor } from "./Thread"

/**
 * 评论场景的外壳件：左栏缩略图的评论角标（实时计数）、评审条 / 浏览条（「上一处 / 下一处评论」能用）、主菜单「插入 › 评论」接到评论工具、
 * 轻提示（删除可撤销、已解决可重新打开、复制链接）与删除确认对话框。M2 未装评论包时的工具条是底座的 toolbar.hide: ["comment"]。
 */

/**
 * 左栏缩略图列表：与底座同一组件（RailList + RailThumb），评论角标按线程实时计数（发表、解决、删除后立即变）——
 * 底座 RailThumb 的 comments 实时形态：数字 = 该页未解决线程数（中性色），已解决不计入，工具提示「N 条未解决 · 另有 M 条已解决」（03-06「缩略图评论角标」），
 * 读屏名「第 4 页，2 条未解决评论，另有 1 条已解决」（07 §3）。
 */
export function CommentRailList() {
  const ctx = useEditor()
  const d = useData()
  const [threads] = useThreads()
  return (
    <RailList>
      {ctx.deck.map((s) => {
        const c = pageCounts(threads, s.n)
        return (
          <RailThumb
            key={s.n}
            slide={s}
            current={s.n === ctx.slide}
            onPick={ctx.goTo}
            comments={!d.loading && c.open > 0 ? { n: c.open, resolved: c.resolved, tipOpen: d.badgeTip === s.n } : 0}
          />
        )
      })}
    </RailList>
  )
}

/** 主菜单「插入 › 评论 C」：选了即进入评论工具（与工具条「评论」、单键 C 同一个命令）；M2 未装评论包时没有这一项 */
export function insertItems(ctx: EditorCtx, m2?: boolean): MenuSpec[] {
  return INSERT_ITEMS.flatMap((it) => {
    if (it.type !== undefined && it.type !== "item") return [it]
    if (it.id !== "comment") return [it]
    return m2 ? [] : [{ ...it, onSelect: () => ctx.setTool("comment") }]
  }).filter((it, i, all) => !(it.type === "separator" && (i === all.length - 1 || all[i + 1]?.type === "separator")))
}

/** 左栏：底座左栏，主菜单「插入」换成接好评论工具的条目 */
export const railRegion = (ctx: EditorCtx, d: RegionDefaults) => d.leftRail({ menu: { insert: insertItems(ctx, !!(ctx.data as { m2?: boolean }).m2) } })

/**
 * 「上一处 / 下一处评论」：按页码与落点在未解决、已锚定的线程间移动，定位方式同点评论钉（换页、选中、切到「评论」页签、钉脉冲）。
 * 返回底座 CommentNav 的接线与计数（没有未解决的线程时两枚箭头不可用：「没有未解决的评论」）。
 */
function useCommentNav() {
  const [threads] = useThreads()
  const [sel] = useSelected()
  const locate = useLocate()
  const order = navOrder(threads)
  const i = order.findIndex((t) => t.id === sel)
  const go = (dir: 1 | -1) => {
    if (!order.length) return
    const next = i < 0 ? (dir > 0 ? order[0] : order[order.length - 1]) : order[(i + dir + order.length) % order.length]
    if (next) locate(next.id)
  }
  return { count: order.length, nav: { onPrev: () => go(-1), onNext: () => go(1), emptyReason: "没有未解决的评论" } }
}

/**
 * 评审条（mode = review，DS-23）：底座 ReviewToolbar，接上「上一处 / 下一处评论」与实时计数。
 * canEdit：有编辑权限时右端「返回编辑」；locked：打开中整条不可用（含「浏览」，03-02 §6.2）。
 */
export function ReviewBar({ canEdit = true, locked }: { canEdit?: boolean; locked?: string }) {
  const ctx = useEditor()
  const { count, nav } = useCommentNav()
  return <ReviewToolbar tool={ctx.tool} onTool={ctx.setTool} comments={count} canEdit={canEdit} locked={locked} nav={nav} />
}

/** 浏览条（mode = viewer）：底座 ViewerToolbar——上一处 / 下一处评论 ┊「只读浏览中」；没有未解决的评论时只剩标识 */
export function ViewerBar() {
  const { count, nav } = useCommentNav()
  return <ViewerToolbar comments={count} nav={nav} />
}

/**
 * 底座评审条 / 浏览条的「上一处 / 下一处评论」缺省发命令 comment.prev / comment.next（kit/commands.ts）：本场景接住，
 * 评审条换成底座默认渲染的状态（如紧凑形态）里同样能翻。放在常驻的画布叠加层里。
 */
export function CommentNavCommands() {
  const { nav } = useCommentNav()
  useEditorCommand("comment.prev", nav.onPrev)
  useEditorCommand("comment.next", nav.onNext)
  return null
}

/** 轻提示：删除自己的评论（5 秒内可撤销）、已解决（可重新打开）、复制链接；用户操作出来的 5 秒后自己收起，场景状态里的常驻 */
export function CommentToasts() {
  const [toast, setToast] = useToast()
  const [, setThreads] = useThreads()
  useEffect(() => {
    if (!toast || !userHasInteracted()) return
    const id = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(id)
  }, [toast, setToast])
  if (!toast) return null
  const act = () => {
    if (toast.undo) setThreads(toast.undo)
    if (toast.reopen) setThreads((ts) => ts.map((t) => (t.id === toast.reopen ? { ...t, resolved: undefined } : t)))
    setToast(null)
  }
  return (
    <Toasts>
      <Toast key={`${toast.text}-${toast.action ?? ""}`} tone="neutral" action={toast.action} onAction={act} onClose={() => setToast(null)}>
        {toast.text}
      </Toast>
    </Toasts>
  )
}

/**
 * 读屏播报（polite，07 §3）：桌面上发表评论、回复、点钉定位之后读一句（「已发表评论」「已回复王小明」「已定位到第 4 页：王小明的评论」）。
 * 放在常驻的画布叠加层里（检查器停在「设计」页签时也读得到）；画布列是定位容器，sr-only 不会把页面撑高。
 */
export function CommentAnnouncer() {
  const a = useAnnouncement()
  return (
    <p aria-live="polite" className="sr-only">
      <span key={a?.n ?? 0}>{a?.text ?? ""}</span>
    </p>
  )
}

/** 删除成功后，被删的线程与它的「⋯」都没了：等确认框交还焦点之后，把焦点交给同页相邻线程的作者行（没有就留在画布） */
function focusNeighborAfterDelete(threads: { id: string; page: number }[], id: string) {
  const i = threads.findIndex((x) => x.id === id)
  const page = threads[i]?.page
  const near = threads.slice(i + 1).find((x) => x.page === page) ?? threads.slice(0, i).reverse().find((x) => x.page === page)
  if (!near) return
  window.setTimeout(() => threadHead(near.id)?.focus({ preventScroll: true }), 60)
}

/**
 * 删除确认（03-06「线程操作补全」、50/10 §7「不可逆用确认」）：文档所有者删除他人的整条讨论串或回复，立即执行、不可撤销；
 * 初始焦点在「取消」（kit Dialog 的确认框，危险操作主按钮危险色实底）。取消 / Esc 后焦点回到打开它的「⋯」或评论钉（confirm.returnTo，
 * 触发它的菜单项已随菜单卸载，不能退到检查器的第一个控件）；删除成功后交给相邻线程的作者行（删的是回复时交给这条线程的作者行）。
 */
export function DeleteConfirm() {
  const [confirm, setConfirm] = useConfirm()
  const [threads, setThreads] = useThreads()
  const [sel, setSel] = useSelected()
  const [, setToast] = useToast()
  if (!confirm) return null
  const t = threads.find((x) => x.id === confirm.threadId)
  if (!t) return null
  const n = t.replies.length - 1
  const back = confirm.returnTo ?? threadMoreAnchor(t.id)
  if (confirm.kind === "thread") {
    return (
      <Dialog
        variant="confirm"
        title="删除此讨论串？"
        description={n > 0 ? `将同时删除 ${n} 条回复，删除后无法恢复。` : "删除后无法恢复。"}
        primary={{
          label: "删除",
          danger: true,
          onClick: () => {
            focusNeighborAfterDelete(threads, t.id)
            setThreads(threads.filter((x) => x.id !== t.id))
            if (sel === t.id) setSel(null)
            setToast({ text: "已删除讨论串" })
          },
        }}
        secondary={{ label: "取消" }}
        onOpenChange={(v) => !v && setConfirm(null)}
        initialFocus="secondary"
        returnFocus={back}
      />
    )
  }
  const r = t.replies.find((x) => x.id === confirm.replyId)
  return (
    <Dialog
      variant="confirm"
      title="删除这条回复？"
      description={`这是${r?.by.name ?? ""}的回复，删除后无法恢复。`}
      primary={{
        label: "删除",
        danger: true,
        onClick: () => {
          setThreads(threads.map((x) => (x.id === t.id ? { ...x, replies: x.replies.filter((y) => y.id !== confirm.replyId) } : x)))
          setToast({ text: "已删除回复" })
          window.setTimeout(() => threadHead(t.id)?.focus({ preventScroll: true }), 60)
        },
      }}
      secondary={{ label: "取消" }}
      onOpenChange={(v) => !v && setConfirm(null)}
      initialFocus="secondary"
      returnFocus={back}
    />
  )
}
