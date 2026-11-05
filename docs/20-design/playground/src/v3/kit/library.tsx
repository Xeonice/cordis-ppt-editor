import { useRef, type ComponentType, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { LayoutGrid, List, LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { ALL, RECENT, TRASH, VIEW_DOCS, type LibDoc, type ViewId } from "../library"
import { ICON, IconButton } from "../ui"
import { Dialog } from "./Dialog"
import { canvasFocusTarget, holdFocusDuring } from "./layer"
import { readOnlyMenu, type MenuSpec } from "./Menu"
import { goToState } from "./nav"
import { useSceneState } from "./scene"
import { Toast, Toasts } from "./Toast"
import { rovingItemIn, useRovingGrid } from "./roving"
import { usePage } from "../page/context"

/**
 * 文档库的公共件（首页「最近」、文档列表、回收站、搜索结果同一套；第 3 批转正 2026-10-22 由 scenarios/documents/shell.tsx 与 Library.tsx 并入底座，画法与行为逐字相同）：
 * - ViewSwitch / ListHead / CardList：网格 / 列表切换（同已拍板首页「最近」）、列表头（左说明、右切换；数量一律不写，rulings §4.25 DS-80）、卡片网格（四列、整组一个 Tab 停靠点，TB-107）；
 * - Quoted：用户输入的检索词，「」包起来、不断行；EmptyBlock：列表内容区的整块空态（DS-53 同一画法）；
 * - docCardMenu：卡片「⋯」菜单（DS-81 同一份菜单、按视图与角色增减；DS-82 评审者 / 查看者没有「创建副本」）；
 * - useLibraryOps / LibraryToasts / LibraryLayers：列表的数据操作（移到回收站 / 撤销、重命名、固定、恢复、永久删除、从卡片分享）记在场景仓里（键与文档组同一份，可以混用）。
 *   从卡片「分享…」打开的分享对话框是第 2 批分享场景的件：由它登记（registerDocShareLayer），底座这里不依赖场景代码。
 */

export type Layout = "grid" | "list"

/** 网格 / 列表切换（与已拍板首页「最近」同一组按钮：24 图标按钮，当前项按下态） */
export function ViewSwitch({ view, onView }: { view: Layout; onView: (v: Layout) => void }) {
  return (
    <div role="group" aria-label="显示方式" className="flex items-center gap-1">
      <IconButton label="网格" size={24} variant={view === "grid" ? "on" : "ghost"} pressed={view === "grid"} onClick={() => onView("grid")}>
        <LayoutGrid {...ICON} />
      </IconButton>
      <IconButton label="列表" size={24} variant={view === "list" ? "on" : "ghost"} pressed={view === "list"} onClick={() => onView("list")}>
        <List {...ICON} />
      </IconButton>
    </div>
  )
}

/**
 * 列表头：左侧一句说明（12px text-2；只有回收站写保留天数，数量一律不写——DS-80），右侧切换（DS-84：不加排序）；
 * trailing 放在切换右侧（DS-84 未采纳的排序菜单，与已拍板首页「最近」同一位置）
 */
export function ListHead({ children, view, onView, trailing }: { children?: ReactNode; view?: Layout; onView?: (v: Layout) => void; trailing?: ReactNode }) {
  return (
    <div className="flex h-7 items-center justify-between gap-4">
      <p className="min-w-0 text-[12px] leading-4 text-(--v3-text-2)">{children}</p>
      <div className="flex shrink-0 items-center gap-2">
        {view && onView && <ViewSwitch view={view} onView={onView} />}
        {trailing}
      </div>
    </div>
  )
}

/** 卡片网格 / 列表的容器（同已拍板首页：网格四列、-mx-2 让卡片内边距与左缘对齐）；整个网格一个 Tab 停靠点，方向键 / Home / End 漫游（TB-107） */
export function CardList({ view, label, children, cols = "grid-cols-4", className }: { view: Layout; label: string; children: ReactNode; cols?: string; className?: string }) {
  const ref = useRef<HTMLUListElement>(null)
  useRovingGrid(ref)
  return (
    <ul ref={ref} aria-label={label} className={cn("mt-2 -mx-2", view === "grid" ? cn("grid", cols) : "flex flex-col", className)}>
      {children}
    </ul>
  )
}

/** 用户输入的检索词：「」包起来、整段不断行（已拍板画面的写法：分享「没有匹配「…」的人」、图标库「没有匹配「…」的图标」） */
export function Quoted({ children }: { children: ReactNode }) {
  return <span className="whitespace-nowrap">「{children}」</span>
}

/**
 * 列表内容区的整块状态（DS-53 同一画法，与 kit PanelState 中性态同一套结构与尺寸：居中、图标 20 · 标题 13px 600 · 说明 · 操作）；空态用中性图标。
 * 标题可以带节点（搜索词「…」不断行），所以这里自己排，不经 PanelState 的字符串标题。
 */
export function EmptyBlock({ icon, title, children, action, className }: { icon: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className ?? "pt-20")}>
      <span className="flex text-(--v3-text-2)">{icon}</span>
      <p className="mt-3 text-[13px] leading-4 font-semibold text-(--v3-text)">{title}</p>
      {children && <p className="mt-2 text-[12px] leading-[18px] text-(--v3-text-2)">{children}</p>}
      {action && <div className="mt-4 flex items-center justify-center gap-2">{action}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ 卡片菜单与操作 */

export interface LibraryHandlers {
  share: (d: LibDoc) => void
  duplicate: (d: LibDoc) => void
  rename: (d: LibDoc) => void
  pin: (d: LibDoc) => void
  removeRecent: (d: LibDoc) => void
  trash: (d: LibDoc) => void
  restore: (d: LibDoc) => void
  purge: (d: LibDoc) => void
}

/**
 * 卡片「⋯」菜单（rulings §4.25 DS-81：同一个卡片、同一份菜单，按视图与角色增减；⇧F10 / 菜单键打开同一份，TB-107）：
 *   分享… · 创建副本 · 重命名 ┊ 固定 / 取消固定 · 从最近移除 ┊ 移到回收站
 * - 「分享…」所有角色都有：所有者打开分享对话框，其余角色打开只读的「谁能访问…」（DS-48）；对话框叠在列表路由上（M3 起，PRD CO-15、TB-109）；
 *   M2（o.shareLater）留在原位、不可用，标 M3、右侧「后续版本提供」（rulings §4.25 DS-137，同 FE-06，与回收站「永久删除…」在 M2 的画法一致），各视图、各角色都这样；
 * - 「创建副本」「重命名」只给能编辑的（所有者、可编辑）：评审者与查看者没有「创建副本」（DS-82，按 U-09：duplicate 要 doc.export）；
 * - 「从最近移除」只在「最近」视图与开始页「最近」；「移到回收站」只给所有者，单独在最后一组、危险色；
 * - 回收站视图换成「恢复 ┊ 永久删除…」（DS-85；首项「恢复」：键盘用户在回收站卡片上按 ⇧F10 即可恢复）；M2 没有永久删除（SV-11 是 M3）：留在原位、不可用并标 M3（FE-06）；
 * - 离线：除「分享…」外全部留在原位、不可用，顶部一行「离线时不可用」（kit readOnlyMenu，同一原因一组共用）；M2 的「分享…」照写它自己的原因「后续版本提供」。
 */
export function docCardMenu(
  d: LibDoc,
  view: ViewId | "search" | "home",
  h: LibraryHandlers,
  o: { offline?: boolean; trashM2?: boolean; pinned?: boolean; /** M2：「分享…」留在原位、不可用（DS-137） */ shareLater?: boolean } = {},
): MenuSpec[] {
  if (view === "trash") {
    return [
      { id: "restore", label: "恢复", onSelect: () => h.restore(d) },
      { type: "separator" },
      o.trashM2 ? { id: "purge", label: "永久删除…", tag: "M3", disabled: true, reason: "后续版本提供" } : { id: "purge", label: "永久删除…", danger: true, onSelect: () => h.purge(d) },
    ]
  }
  const canEdit = d.role === "owner" || d.role === "editor"
  const pinned = o.pinned ?? !!d.pinned
  const items: MenuSpec[] = [
    o.shareLater ? { id: "share", label: "分享…", tag: "M3", disabled: true, reason: "后续版本提供" } : { id: "share", label: "分享…", onSelect: () => h.share(d) },
  ]
  if (canEdit) {
    items.push({ id: "duplicate", label: "创建副本", onSelect: () => h.duplicate(d) })
    items.push({ id: "rename", label: "重命名", onSelect: () => h.rename(d) })
  }
  items.push({ type: "separator" })
  items.push({ id: "pin", label: pinned ? "取消固定" : "固定", onSelect: () => h.pin(d) })
  if (view === "recent" || view === "home") items.push({ id: "remove-recent", label: "从最近移除", onSelect: () => h.removeRecent(d) })
  if (d.role === "owner") {
    items.push({ type: "separator" })
    items.push({ id: "trash", label: "移到回收站", danger: true, onSelect: () => h.trash(d) })
  }
  return o.offline ? readOnlyMenu(items, ["share"], "离线时不可用") : items
}

/** 卡片的锚点名（文档卡片的链接；回收站卡片是可聚焦的容器）：焦点交还、对话框 returnFocus 用 */
export const cardAnchor = (id: string) => `docs.card-${id}`

const cardEl = (id: string) => document.querySelector<HTMLElement>(`[data-v3-anchor="${cardAnchor(id)}"]`)

/** 打开文档（不是卡片的入口用，如搜索下拉的一行）：按我的角色进编辑器的对应形态（编辑 / 评审 / 只读浏览，第 1 批 main-states） */
export function openDoc(d: LibDoc) {
  goToState("editor", d.role === "viewer" ? "main-states.viewer" : d.role === "commenter" ? "main-states.commenter" : "empty")
}

/** 卡片要移走时的焦点落点：后一张卡片（漫游网格里的卡片元素），没有就前一张，再没有交给主区（canvas） */
function neighborOf(id: string): () => HTMLElement | null {
  const li = cardEl(id)?.closest("li")
  const next = li?.nextElementSibling
  const prev = li?.previousElementSibling
  return () => (next?.isConnected ? rovingItemIn(next) : null) ?? (prev?.isConnected ? rovingItemIn(prev) : null) ?? canvasFocusTarget()
}

/**
 * 焦点所在的元素随操作卸载时（菜单项与卡片一起移走、重命名输入框换回标题）焦点不经过 body（07 §2.4）：
 * 掉到 body 的那一刻交给 to()（kit holdFocusDuring，同一个任务末尾），再在微任务、下一个任务与 120ms 后各兜一次（只在焦点确实在 body 时才动，不抢用户点到别处的焦点）
 */
function keepFocusOff(to: () => HTMLElement | null) {
  const release = holdFocusDuring(600, to)
  const fix = () => {
    const a = document.activeElement
    if (!a || a === document.body || !a.isConnected) to()?.focus({ preventScroll: true })
  }
  queueMicrotask(fix)
  window.setTimeout(fix, 0)
  window.setTimeout(() => {
    fix()
    release()
  }, 120)
}

export interface ToastSeed {
  text: string
  tone?: "neutral" | "info" | "success" | "warning" | "error"
  /** 动作：撤销移到回收站 / 撤销从最近移除 / 重试 */
  action?: { label: string; kind: "undo-hide" | "retry" }
  /** 进行中（转圈，如「正在创建副本…」） */
  busy?: boolean
  /** 撤销时恢复的卡片 */
  id?: string
}

/** 列表数据操作的初值（场景状态的 page.data 里取） */
export interface LibrarySeed {
  hidden?: string[]
  rename?: string
  toast?: ToastSeed
  purge?: string
  purging?: string
  share?: boolean | string
}

/** 列表的数据操作（场景仓，键与文档组 scenarios/documents/Library.tsx 同一份）：首页「最近」与文档列表共用 */
export function useLibraryOps(seed: LibrarySeed) {
  const [hidden, setHidden] = useSceneState<string[]>("docs.hidden", () => seed.hidden ?? [])
  const [titles, setTitles] = useSceneState<Record<string, string>>("docs.titles", {})
  const [pins, setPins] = useSceneState<Record<string, boolean>>("docs.pins", {})
  const [editing, setEditing] = useSceneState<{ id: string; value: string } | null>("docs.editing", () => {
    const d = seed.rename ? [...RECENT, ...VIEW_DOCS.mine, ...VIEW_DOCS.shared].find((x) => x.id === seed.rename) : undefined
    return d ? { id: d.id, value: d.title } : null
  })
  const [toast, setToast] = useSceneState<ToastSeed | null>("docs.toast", () => seed.toast ?? null)
  const [purge, setPurge] = useSceneState<string | null>("docs.purge", () => seed.purge ?? null)
  const [purging, setPurging] = useSceneState<string | null>("docs.purging", () => seed.purging ?? null)
  /** 从卡片打开的分享对话框：哪一份（关上后保留，关闭过程仍按这一份交还焦点）与开没开 */
  const [shareId, setShareId] = useSceneState<string | null>("docs.share", () => (seed.share === true ? "q2" : seed.share || null))
  const [shareOpen, setShareOpen] = useSceneState<boolean>("docs.share-open", () => !!seed.share)

  const titleOf = (d: LibDoc) => titles[d.id] ?? d.title
  const live = (d: LibDoc): LibDoc => ({ ...d, title: titleOf(d), pinned: pins[d.id] ?? d.pinned })
  /** 卡片移走（同步提交，焦点立刻交给相邻卡片） */
  const hide = (d: LibDoc, text: string) => {
    const to = neighborOf(d.id)
    flushSync(() => {
      setHidden((h) => [...h, d.id])
      setToast({ text, action: { label: "撤销", kind: "undo-hide" }, id: d.id })
    })
    keepFocusOff(to)
  }
  const handlers: LibraryHandlers = {
    share: (d) => {
      setShareId(d.id)
      setShareOpen(true)
    },
    duplicate: (d) => setToast({ text: `正在创建「${titleOf(d)}」的副本…`, busy: true }),
    rename: (d) => setEditing({ id: d.id, value: titleOf(d) }),
    pin: (d) => setPins((p) => ({ ...p, [d.id]: !(p[d.id] ?? d.pinned) })),
    // 轻提示里的文档名一律用「」包（同「正在创建「…」的副本…」「已导出「…」」）
    removeRecent: (d) => hide(d, `已从最近移除「${titleOf(d)}」`),
    trash: (d) => hide(d, `已将「${titleOf(d)}」移到回收站`),
    restore: (d) => {
      const to = neighborOf(d.id)
      flushSync(() => {
        setHidden((h) => [...h, d.id])
        setToast({ text: `已恢复「${titleOf(d)}」`, tone: "success" })
      })
      keepFocusOff(to)
    },
    purge: (d) => setPurge(d.id),
  }
  /** 结束重命名：Enter / 失焦保存，Esc 取消；输入框换回标题后焦点回到这张卡片（只在焦点落空时；失焦保存时用户已点到别处，不抢） */
  const endRename = (save: boolean) => {
    if (!editing) return
    const id = editing.id
    const v = editing.value.trim()
    if (save && v) setTitles((t) => ({ ...t, [id]: v }))
    setEditing(null)
    keepFocusOff(() => cardEl(id))
  }
  const commitRename = () => endRename(true)
  const cancelRename = () => endRename(false)
  return { hidden, setHidden, live, titleOf, handlers, editing, setEditing, commitRename, cancelRename, toast, setToast, purge, setPurge, purging, setPurging, shareId, shareOpen, setShareOpen }
}

/** 应用壳的轻提示（主区底部居中、离底 24，没有底部工具条）：撤销把卡片放回原位、焦点交给它 */
export function LibraryToasts() {
  const { data } = usePage()
  const ops = useLibraryOps(data as LibrarySeed)
  const t = ops.toast
  if (!t) return null
  const onAction = () => {
    const id = t.action?.kind === "undo-hide" ? t.id : undefined
    flushSync(() => {
      if (id) ops.setHidden((h) => h.filter((x) => x !== id))
      ops.setToast(null)
    })
    if (id) queueMicrotask(() => cardEl(id)?.focus({ preventScroll: true }))
  }
  return (
    <Toasts bottom={24}>
      <Toast
        key={t.text}
        tone={t.tone ?? "neutral"}
        icon={t.busy ? <LoaderCircle size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-(--v3-text-2) motion-safe:animate-spin" /> : undefined}
        action={t.action?.label}
        onAction={onAction}
        onClose={t.busy ? undefined : () => ops.setToast(null)}
      >
        {t.text}
      </Toast>
    </Toasts>
  )
}

/** 从卡片打开的分享对话框（第 2 批分享场景的件，由它登记）：doc 这一份、title 当前名字、开合与关闭后焦点交还的锚点 */
export type DocShareLayerProps = { doc: LibDoc; title: string; open: boolean; onOpenChange: (v: boolean) => void; returnFocus: string }
let SHARE_LAYER: ComponentType<DocShareLayerProps> | null = null
/** 分享场景登记从卡片打开的分享对话框（同 registerCommentsBody 的做法；没有登记时「分享…」只关菜单） */
export function registerDocShareLayer(c: ComponentType<DocShareLayerProps>) {
  SHARE_LAYER = c
}

/** 能从卡片打开分享的全部文档（我拥有的 + 与我共享的；「最近」与搜索结果都在其中，回收站里的不能分享） */
const SHAREABLE: LibDoc[] = ALL

/** 浮层：永久删除确认（DS-40 第三档，DS-85）与从卡片打开的分享对话框（叠在当前列表路由上） */
export function LibraryLayers() {
  const { data } = usePage()
  const ops = useLibraryOps(data as LibrarySeed)
  const target = ops.purge ? TRASH.find((x) => x.id === ops.purge) : undefined
  const shared = ops.shareId ? SHAREABLE.find((x) => x.id === ops.shareId) : undefined
  const Share = SHARE_LAYER
  return (
    <>
      {target && (
        <Dialog
          variant="confirm"
          title={`永久删除「${target.title}」？`}
          // 回收站里的文档在移入时已关闭在线会话、对其他人返回 404（60/04 表 2-1、2-2），这里只讲无法恢复（同 Figma、Drive）
          description="删除后无法恢复。"
          primary={{
            label: "永久删除",
            danger: true,
            onClick: () => {
              flushSync(() => ops.setPurging(target.id))
              window.setTimeout(() => {
                ops.setHidden((h) => [...h, target.id])
                ops.setPurging(null)
                ops.setToast({ text: `已永久删除「${target.title}」` })
              }, 2400)
            },
          }}
          secondary={{ label: "取消" }}
          initialFocus="secondary"
          returnFocus={cardAnchor(target.id)}
          onOpenChange={(v) => {
            if (!v) ops.setPurge(null)
          }}
        />
      )}
      {shared && Share && <Share key={shared.id} doc={shared} title={ops.titleOf(shared)} open={ops.shareOpen} onOpenChange={ops.setShareOpen} returnFocus={cardAnchor(shared.id)} />}
    </>
  )
}
