import { useContext, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react"
import { createPortal } from "react-dom"
import { ArrowUpRight, Ban, Check, CopyPlus, PencilLine, Plus, Trash } from "lucide-react"
import { DropdownMenu as DM } from "radix-ui"
import { cn } from "@/lib/utils"
import {
  Avatar, ContextMenu, ICON, LoadingRow, MENU_ITEM, readOnlyMenu, READONLY_MENU_NOTE, scrollIntoPanel, Tag, TextField, Tip, useEditor, useSceneState,
  type MenuEntry, type MenuSpec, type NewSlideOption,
} from "../../kit"
import { V3RootContext } from "../../V3Root"
import type { LayoutDef, MasterDef } from "./data"
import { LayoutArt } from "./LayoutArt"
import { keepQuoted } from "./master-sections"
import { findLayout, findMaster, MV_KEYS, mvReasonOf, renameErrorOf, rowAnchorOf, useMasterView, type CtxMenu, type MasterView } from "./mv-state"
import { pagesText } from "./shared"

/**
 * 母版视图的左栏（2026-10-30 母版视图改版第二步，规格 §3.2；dir §2.2）：仍是底座的 240 左栏（主菜单、文档菜单、同步状态与普通视图相同），
 * 登记处（master-impl.tsx）经 base(…) 换掉三处——缩略图列表换成母版窗格（MasterPane），「新建幻灯片 ▾ / +」换成「新建版式 ▾ / +」（masterRailNewLayout），没有「单页 / 网格」。
 *   窗格：母版 → 版式两级平铺（R-30）；选中即编辑对象（点哪编辑哪，DS-146）；名称换行不截断、计数在名称下一行，页数由文档算（usageFor）；
 *         缩略图是 LayoutArt 的 thumb 画法（同一份内容渲染 + 一种细线框，整段取舍）；listbox 键盘（R-34）、右键菜单（R-39）、就地改名（DS-150 ①）、
 *         拖拽重排与在场头像（R-37、R-38）、加载行与失败行（DS-154）。
 *   右键菜单只在这里画（PaneMenu，读场景仓 MV_KEYS.ctx）：指针右键、⇧F10 / 菜单键与演示种子（layers 里的 LayoutContextMenu / MasterContextMenu）都只是写这个键。
 */

/* ------------------------------------------------------------------ 「新建版式 ▾ / +」（规格 §3.2.10） */

const NEW_LAYOUT_ANCHOR = "master-view.new-layout"

/**
 * 「新建版式 ▾ / +」（03-26 §3）：▾ 是普通菜单——插入版式 · 复制所选版式 ┊ 新建母版 · 从模板导入母版…；「+」= 插入版式。
 * 整行的原因由规则算（mvReasonOf newLayout：加载 > 降权 > M2 > 多选）；「复制所选版式」另看窗格选中的是不是版式（选中母版时没有可复制的版式）。
 * 底座左栏（editor/LeftRail.tsx，第二步不改）的这一行不接动作：两处的点按由窗格在 document 上接（useNewLayoutWiring）
 */
export function masterRailNewLayout(v: MasterView): NewSlideOption {
  const dup = v.reason("duplicate") ?? (v.paneLayout ? undefined : "未选中版式")
  const menu: MenuEntry[] = [
    { value: "insert", label: "插入版式" },
    { value: "duplicate", label: "复制所选版式", disabled: !!dup, reason: dup },
    { kind: "separator" },
    { value: "new-master", label: "新建母版" },
    { value: "import", label: "从模板导入母版…" },
  ]
  return { label: "新建版式", menu, plusLabel: "插入版式", anchor: NEW_LAYOUT_ANCHOR, reason: v.reason("newLayout") }
}

/**
 * 接上「新建版式 ▾ / +」的动作：底座左栏这一行只画、不接动作（菜单的 onSelect 与「+」的 onClick 都是空的），这里在 document 捕获阶段认点按——
 * 「+」（锚点 master-view.new-layout-plus）与「新建版式 ▾」菜单里的条目（菜单的 aria-labelledby 指向锚点为 master-view.new-layout 的按钮）。
 * 键盘的 ↵ / 空格同样经 click 到这里（按钮与 Radix 菜单项都是）。不可用的（aria-disabled）不响应。「新建母版」「从模板导入母版…」样张不接（流程随 M3）
 */
function useNewLayoutWiring(mv: MasterView) {
  const latest = useRef(mv)
  latest.current = mv
  useEffect(() => {
    const onClick = (e: globalThis.MouseEvent) => {
      const t = e.target instanceof Element ? e.target : null
      if (!t) return
      const plus = t.closest(`[data-v3-anchor="${NEW_LAYOUT_ANCHOR}-plus"]`)
      if (plus) {
        if (plus.getAttribute("aria-disabled") !== "true") latest.current.insertLayout()
        return
      }
      const item = t.closest('[role="menuitem"]')
      const by = item?.closest('[role="menu"]')?.getAttribute("aria-labelledby")
      const trigger = by ? document.getElementById(by) : null
      if (!item || trigger?.getAttribute("data-v3-anchor") !== NEW_LAYOUT_ANCHOR || item.getAttribute("aria-disabled") === "true") return
      const text = item.textContent ?? ""
      if (text.startsWith("插入版式")) latest.current.insertLayout()
      else if (text.startsWith("复制所选版式")) latest.current.duplicateLayout()
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])
}

/* ------------------------------------------------------------------ 右键菜单（规格 §3.2.5） */

/** 演示种子与 ⇧F10 / 菜单键的落点（行内的相对位置；版式行同第一步静态菜单的落点） */
const LAYOUT_AT = { x: 0.72, y: 0.5 }
const MASTER_AT = { x: 0.7, y: 0.45 }

/**
 * 版式右键菜单的条目（R-39；03-26 §3）：重命名 · 复制版式 ⌘D · 插入版式 ⌘M ┊ 在普通视图查看引用页（右侧页码）┊ 删除版式 ⌫。
 * 多选（在已选中的任一行上打开，R-36）：单对象操作留在原位不可用、各写原因，引用页取并集，删除合并判定。降权：kit readOnlyMenu（改文档的不可用，顶部一行原因），
 * 「在普通视图查看引用页」只是导航，照常可用。不可用与原因一律走 mvReasonOf（规格 §3.10 第 12 条）
 */
export function layoutMenuItems(layout: LayoutDef, v: MasterView): MenuSpec[] {
  const multi = v.multiLayouts.length > 1 && v.multiLayouts.some((l) => l.id === layout.id)
  const ids = multi ? v.multiLayouts.map((l) => l.id) : [layout.id]
  const pages = [...new Set(ids.flatMap((id) => v.usageFor(id)))].sort((a, b) => a - b)
  const facts = { ...v, usage: pages, multiLayouts: multi ? v.multiLayouts : [] }
  const why = (what: Parameters<typeof mvReasonOf>[1]) => mvReasonOf(facts, what)
  const off = (what: Parameters<typeof mvReasonOf>[1]) => ({ disabled: !!why(what), reason: why(what) })
  const items: MenuSpec[] = [
    { id: "rename", label: "重命名", icon: <PencilLine {...ICON} />, ...off("rename"), onSelect: () => v.startRename(layout.id) },
    { id: "duplicate", label: "复制版式", icon: <CopyPlus {...ICON} />, kbd: "⌘D", ...off("duplicate"), onSelect: () => v.duplicateLayout({ fromRow: true }) },
    { id: "insert", label: "插入版式", icon: <Plus {...ICON} />, kbd: "⌘M", ...off("newLayout"), onSelect: () => v.insertLayout({ fromRow: true }) },
    { type: "separator" },
    { id: "pages", label: "在普通视图查看引用页", icon: <ArrowUpRight {...ICON} />, hint: pages.length ? pagesText(pages) : undefined, ...off("pages"), onSelect: () => v.viewInNormal(ids) },
    { type: "separator" },
    { id: "delete", label: "删除版式", icon: <Trash {...ICON} />, kbd: "⌫", danger: true, ...off("delete"), onSelect: () => v.deleteSelection() },
  ]
  return v.readOnly ? readOnlyMenu(items, ["pages"], READONLY_MENU_NOTE.degraded) : items
}

/**
 * 母版右键菜单的条目（R-39）：重命名 · 复制母版（含全部版式）· 插入母版 ┊ 保留母版（勾选框，kit Menu 的 custom 条目自己画）┊ 删除母版 ⌫（只剩一个母版时不可用）。
 * 降权同版式菜单（readOnlyMenu 对 custom 条目原样放过，「保留母版」一行自己按 v.readOnly 画不可用）。「复制母版」「插入母版」样张不接（命令集合不变，随 M3）
 */
export function masterMenuItems(master: MasterDef, v: MasterView): MenuSpec[] {
  const why = (what: Parameters<typeof mvReasonOf>[1]) => mvReasonOf(v, what)
  const del = why("delete") ?? (v.masters.length < 2 ? "至少保留一个母版" : undefined)
  const items: MenuSpec[] = [
    { id: "rename", label: "重命名", icon: <PencilLine {...ICON} />, disabled: !!why("rename"), reason: why("rename"), onSelect: () => v.startRename(master.id) },
    { id: "duplicate", label: "复制母版", icon: <CopyPlus {...ICON} />, hint: "含全部版式" },
    { id: "insert", label: "插入母版", icon: <Plus {...ICON} /> },
    { type: "separator" },
    { type: "custom", id: "preserve", render: <PreserveItem master={master} v={v} /> },
    { type: "separator" },
    { id: "delete", label: "删除母版", icon: <Trash {...ICON} />, kbd: "⌫", danger: true, disabled: !!del, reason: del, onSelect: () => v.deleteSelection() },
  ]
  return v.readOnly ? readOnlyMenu(items, [], READONLY_MENU_NOTE.degraded) : items
}

/** kit readOnlyMenu 顶部那一行说明的 id（不可用的条目用 aria-describedby 指向它） */
const READONLY_NOTE_ID = "context-menu.readonly-reason"

/**
 * 「保留母版」一行（规格 §3.2.5，I-32）：kit Menu 的勾选条目只在勾上时画 ✓、未勾时没有任何标记，看不出是开关；这里用 Radix 的勾选条目自己画——
 * 图标列放一个与 kit Checkbox 同一外观的 16px 框（未勾空框、勾上强调色底白勾；aria-hidden，不另进 Tab 顺序），其后「保留母版」，右侧「没有页面使用时也不删除」。
 * 选了不关菜单；降权时自己画不可用（aria-disabled + data-disabled，读屏指向菜单顶部的原因行），点了不变
 */
function PreserveItem({ master, v }: { master: MasterDef; v: MasterView }) {
  const checked = v.preserveOf(master.id)
  const off = v.readOnly
  return (
    <DM.CheckboxItem
      checked={checked}
      {...(off ? { "aria-disabled": true as const, "data-disabled": "", "aria-describedby": READONLY_NOTE_ID } : {})}
      onCheckedChange={(c) => {
        if (!off) v.setPreserve(master.id, c === true)
      }}
      onSelect={(e) => e.preventDefault()}
      className={MENU_ITEM}
    >
      <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">
        <span
          className={cn(
            "flex size-4 items-center justify-center rounded-[4px] border text-(--v3-accent-fg)",
            checked ? (off ? "border-(--v3-text-3) bg-(--v3-text-3)" : "border-(--v3-accent) bg-(--v3-accent)") : off ? "border-(--v3-border)" : "border-(--v3-border-control)",
          )}
        >
          {checked && <Check size={12} strokeWidth={2.25} />}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 items-center whitespace-nowrap">保留母版</span>
      <span className="ml-4 shrink-0 text-[12px] whitespace-nowrap text-(--v3-text-2)">没有页面使用时也不删除</span>
    </DM.CheckboxItem>
  )
}

/**
 * 演示种子：状态的 layers 里写 <LayoutContextMenu layout="office-title-only" />，载入后这一行的右键菜单就开着（同在这一行上右键；没选中时先单选它，R-35）。
 * 它自己不画东西，只写场景仓里的菜单键（MV_KEYS.ctx），菜单由窗格画（PaneMenu）——指针右键、⇧F10 与种子是同一份菜单、同一个落点规则。
 * 只开一次：关掉之后、进出母版视图都不再自己打开；M2、加载中与失败时不开（mvReasonOf menu）
 */
export function LayoutContextMenu({ layout }: { layout: string }) {
  useMenuSeed(layout, LAYOUT_AT)
  return null
}

/** 母版行的演示种子（同 LayoutContextMenu）：<MasterContextMenu master="office" /> */
export function MasterContextMenu({ master }: { master: string }) {
  useMenuSeed(master, MASTER_AT)
  return null
}

function useMenuSeed(id: string, at: { x: number; y: number }) {
  const ed = useEditor()
  const mv = useMasterView()
  const latest = useRef(mv)
  latest.current = mv
  useLayoutEffect(() => {
    const v = latest.current
    if (!ed.masterView.on || ed.scene.get(MV_KEYS.ctxSeeded) === true || v.reason("menu")) return
    ed.scene.set(MV_KEYS.ctxSeeded, true)
    if (!v.isMaster(id) && !v.layoutOf(id)) return
    if (v.pane !== id && !v.multiLayouts.some((l) => l.id === id)) v.pick(id)
    v.openMenu(id, at.x, at.y)
    // 只在挂载时种一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/** 窗格里唯一画右键菜单的地方：kit ContextMenu 锚在那一行上（不另监听右键：窗格自己接，见 PaneRow），关上后焦点由 kit 交回这一行 */
function PaneMenu({ mv }: { mv: MasterView }) {
  const [ctx, setCtx] = useSceneState<CtxMenu | null>(MV_KEYS.ctx, null)
  if (!ctx || mv.reason("menu")) return null
  const master = findMaster(ctx.id, mv.masters)
  const layout = master ? undefined : findLayout(ctx.id, mv.masters)
  if (!master && !layout) return null
  const name = master ? master.name : mv.nameOf(ctx.id)
  return (
    <ContextMenu
      key={ctx.n}
      at={{ anchor: rowAnchorOf(ctx.id, !!master), x: ctx.x, y: ctx.y }}
      target={false}
      open={ctx.open}
      onOpenChange={(open) => setCtx({ ...ctx, open })}
      label={master ? `母版「${name}」` : `版式「${name}」`}
      items={master ? masterMenuItems(master, mv) : layoutMenuItems(layout!, mv)}
    />
  )
}

/* ------------------------------------------------------------------ 窗格（规格 §3.2） */

/** 缩略图外框：与普通视图左栏同款（圆角 4、1px 边；选中时强调色边 + 0.5px 外圈） */
const frame = (on: boolean) => cn("relative block overflow-hidden rounded-[4px] border border-(--v3-border)", on && "border-(--v3-accent) ring-[0.5px] ring-(--v3-accent)")

/** 窗格：加载中一行加载行、失败一行说明（都不放「重试」，DS-154）；就绪时母版与版式的 listbox */
export function MasterPane() {
  const mv = useMasterView()
  useNewLayoutWiring(mv)
  if (mv.status === "loading")
    return (
      <div className="mt-3 px-2">
        <LoadingRow>正在加载母版与版式…</LoadingRow>
      </div>
    )
  if (mv.status === "failed") return <p className="mt-3 flex h-8 items-center px-4 text-[12px] leading-4 text-(--v3-text-2)">母版与版式未能加载</p>
  return <PaneList mv={mv} />
}

/** 窗格行按视觉顺序：母版 1 → 它的版式 → 母版 2 … */
function visualOrder(mv: MasterView): string[] {
  return mv.masters.flatMap((m) => [m.id, ...m.layouts.map((l) => l.id)])
}

/** 一次指针拖拽（真的按住拖动；演示态 mvDrag 没有指针） */
interface PointerDrag {
  id: string
  x: number
  y: number
  moved: boolean
}

function PaneList({ mv }: { mv: MasterView }) {
  const ref = useRef<HTMLDivElement>(null)
  /** 列表元素（插入线与拖影要在它挂上之后量：子件的布局阶段早于父元素接上 ref，所以另用状态交给 DragMarks） */
  const [listEl, setListEl] = useState<HTMLDivElement | null>(null)
  const latest = useRef(mv)
  latest.current = mv
  /** Shift + ↑ / ↓ 的锚点行（扩展多选从它算起） */
  const anchorRef = useRef<string | null>(null)
  /** 拖拽刚结束：吞掉随后的那一下 click（不当成单击选中） */
  const swallowClick = useRef(false)
  const pdrag = useRef<PointerDrag | null>(null)
  const [ptr, setPtr] = useState<{ x: number; y: number } | null>(null)

  // 进入或载入时选中行滚入视口（R-05）；已经整行可见时不动
  useLayoutEffect(() => {
    scrollIntoPanel(ref.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]'), { ifNeeded: true })
  }, [])

  const rowEl = (id: string) => ref.current?.querySelector<HTMLElement>(`[data-mv-row="${CSS.escape(id)}"]`) ?? null
  const focusRowNow = (id: string) => {
    const el = rowEl(id)
    el?.focus({ preventScroll: true })
    scrollIntoPanel(el, { ifNeeded: true })
  }
  const selectedIds = () => {
    const v = latest.current
    return v.multiLayouts.length > 1 ? v.multiLayouts.map((l) => l.id) : [v.pane]
  }

  /** ⇧F10 / 菜单键：在这一行的原位打开右键菜单（没选中时先单选它，R-35） */
  const openMenuAt = (id: string) => {
    const v = latest.current
    if (v.reason("menu")) return
    if (!selectedIds().includes(id)) v.pick(id)
    const at = v.isMaster(id) ? MASTER_AT : LAYOUT_AT
    v.openMenu(id, at.x, at.y)
  }

  /** Shift + ↑ / ↓：从锚点行到下一行（只限同一母版的版式；碰到母版行或别的母版就不动） */
  const extend = (cur: string, dir: 1 | -1) => {
    const v = latest.current
    const anchor = v.multiLayouts.length > 1 && anchorRef.current && v.multiLayouts.some((l) => l.id === anchorRef.current) ? anchorRef.current : v.pane
    const a = v.layoutOf(anchor)
    const c = v.layoutOf(cur)
    if (!a || !c || a.master !== c.master) return
    const list = findMaster(a.master, v.masters)?.layouts ?? []
    const j = list.findIndex((l) => l.id === cur) + dir
    const next = list[j]
    if (!next) return
    const ia = list.findIndex((l) => l.id === anchor)
    const range = list.slice(Math.min(ia, j), Math.max(ia, j) + 1).map((l) => l.id)
    anchorRef.current = anchor
    v.selectRange(range)
    focusRowNow(next.id)
  }

  /** ⌘⇧↑ / ↓：在本母版内上移 / 下移一位（到边界不动；R-34，拖拽的键盘等价） */
  const nudge = (cur: string, dir: 1 | -1) => {
    const v = latest.current
    const l = v.layoutOf(cur)
    if (!l || v.reason("delete")) return
    const list = findMaster(l.master, v.masters)?.layouts ?? []
    const to = list[list.findIndex((x) => x.id === cur) + dir]
    if (!to) return
    v.reorder(cur, to.id, dir > 0 ? "after" : "before")
    v.focusRow(cur)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement
    // 只认窗格里的行：右键菜单经 Portal 挂在根节点，React 事件仍沿组件树冒泡到这里；改名输入框自己处理按键
    if (!e.currentTarget.contains(t) || t.closest("input, textarea") || e.nativeEvent.isComposing) return
    const v = latest.current
    const cur = t.closest<HTMLElement>("[data-mv-row]")?.dataset.mvRow ?? v.pane
    const ids = visualOrder(v)
    const i = ids.indexOf(cur)
    const mod = e.metaKey || e.ctrlKey
    if ((e.key === "F10" && e.shiftKey && !mod) || e.key === "ContextMenu") {
      e.preventDefault()
      openMenuAt(cur)
      return
    }
    if (e.altKey) return
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        const dir = e.key === "ArrowDown" ? 1 : -1
        e.preventDefault()
        if (mod && e.shiftKey) nudge(cur, dir)
        else if (e.shiftKey) {
          if (!v.reason("delete")) extend(cur, dir)
        } else if (!mod) {
          const next = ids[i + dir]
          if (!next) return
          anchorRef.current = null
          v.pick(next)
          focusRowNow(next)
        }
        return
      }
      case "Home":
      case "End": {
        if (mod || e.shiftKey) return
        e.preventDefault()
        const next = e.key === "Home" ? ids[0] : ids[ids.length - 1]
        if (!next) return
        anchorRef.current = null
        v.pick(next)
        focusRowNow(next)
        return
      }
      case "Enter":
        if (mod || e.shiftKey) return
        e.preventDefault()
        v.focusCanvas()
        return
      case " ":
        e.preventDefault()
        if (!selectedIds().includes(cur)) v.pick(cur)
        return
      case "Delete":
      case "Backspace":
        if (mod || e.shiftKey) return
        e.preventDefault()
        v.deleteSelection()
        return
    }
  }

  /** 指针落在哪一行上（拖拽的目标）：版式行按上下半区取前 / 后；本母版的母版行算作排到最前；别的母版（行或它的版式）一律是跨母版 */
  const targetAt = (x: number, y: number): { to: string; at: "before" | "after" } | null => {
    const v = latest.current
    const list = ref.current
    const d = pdrag.current
    if (!list || !d) return null
    const lr = list.getBoundingClientRect()
    if (x < lr.left || x > lr.right) return null
    const own = v.layoutOf(d.id)?.master
    for (const el of list.querySelectorAll<HTMLElement>("[data-mv-row]")) {
      const r = el.getBoundingClientRect()
      if (y < r.top || y > r.bottom) continue
      const id = el.dataset.mvRow ?? ""
      if (v.isMaster(id)) {
        if (id !== own) return { to: id, at: "after" }
        const first = findMaster(id, v.masters)?.layouts[0]
        return first ? { to: first.id, at: "before" } : null
      }
      return { to: id, at: y < r.top + r.height / 2 ? "before" : "after" }
    }
    return null
  }

  /** 版式行上按下：移动超过 4px 才算拖拽；松手时同母版内重排，跨母版回弹（R-37）。M2、降权、加载与失败时不拖 */
  const onRowPointerDown = (e: ReactPointerEvent, id: string) => {
    const v = latest.current
    if (e.button !== 0 || v.isMaster(id) || v.reason("delete") || (e.target as HTMLElement).closest("input")) return
    pdrag.current = { id, x: e.clientX, y: e.clientY, moved: false }
    const move = (ev: PointerEvent) => {
      const d = pdrag.current
      if (!d) return
      if (!d.moved && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 4) return
      d.moved = true
      setPtr({ x: ev.clientX, y: ev.clientY })
      const hit = targetAt(ev.clientX, ev.clientY)
      const cur = latest.current.drag
      if (hit) latest.current.setDrag({ id: d.id, ...hit })
      else if (!cur) latest.current.setDrag({ id: d.id, to: d.id, at: "after" })
    }
    const end = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move, true)
      window.removeEventListener("pointerup", end, true)
      window.removeEventListener("pointercancel", end, true)
      const d = pdrag.current
      pdrag.current = null
      if (!d?.moved) return
      swallowClick.current = true
      window.setTimeout(() => (swallowClick.current = false), 0)
      const cur = latest.current
      const t = cur.drag
      if (ev.type === "pointerup" && t && !cur.dragBlocked && t.to !== t.id) {
        cur.reorder(t.id, t.to, t.at)
        cur.focusRow(t.id)
      }
      cur.setDrag(null)
      setPtr(null)
    }
    window.addEventListener("pointermove", move, true)
    window.addEventListener("pointerup", end, true)
    window.addEventListener("pointercancel", end, true)
  }

  const rowHandlers = { onPointerDown: onRowPointerDown, swallowClick, openMenuAt }

  return (
    <div
      ref={(el) => {
        ref.current = el
        setListEl(el)
      }}
      role="listbox"
      aria-label="母版与版式"
      aria-multiselectable="true"
      onKeyDown={onKeyDown}
      className="relative mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-4"
    >
      {mv.masters.map((m, i) => (
        <MasterGroup key={m.id} m={m} first={i === 0} mv={mv} rows={rowHandlers} />
      ))}
      <DragMarks mv={mv} list={listEl} ptr={ptr} />
      <PaneMenu mv={mv} />
    </div>
  )
}

interface RowHandlers {
  onPointerDown: (e: ReactPointerEvent, id: string) => void
  swallowClick: RefObject<boolean>
  openMenuAt: (id: string) => void
}

/**
 * 窗格的一行（母版行与版式行共用）：role=option + aria-selected；单一 Tab 停靠点（窗格选中项 tabIndex 0，其余 −1，R-34）；
 * 单击单选（R-35），⌘ / Shift 单击多选同一母版的版式；右键先单选没选中的行再开菜单（M2 不开，dir L271）；锚点 master-view.master-<id> / master-view.layout-<id>。
 * 工具提示与读屏名照 R-32 的句式，数字取计算值
 */
function PaneRow({
  mv,
  id,
  master,
  selected,
  tip,
  label,
  rows,
  hideTip,
  className,
  children,
}: {
  mv: MasterView
  id: string
  master?: boolean
  selected: boolean
  tip: string
  label: string
  rows: RowHandlers
  hideTip?: boolean
  className?: string
  children: ReactNode
}) {
  const onClick = (e: MouseEvent) => {
    if (rows.swallowClick.current || (e.target as HTMLElement).closest("input")) return
    if (!master && (e.shiftKey || e.metaKey || e.ctrlKey)) mv.toggleMulti(id)
    else mv.pick(id)
  }
  const onContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    // 状态里另有接这一行右键的菜单（第一步留下的静态菜单）已经接住：不再开第二份
    if (e.nativeEvent.defaultPrevented) return
    e.preventDefault()
    if (mv.reason("menu") || (e.target as HTMLElement).closest("input")) return
    const inSel = mv.multiLayouts.length > 1 ? mv.multiLayouts.some((l) => l.id === id) : mv.pane === id
    if (!inSel) mv.pick(id)
    const r = e.currentTarget.getBoundingClientRect()
    mv.openMenu(id, r.width ? (e.clientX - r.left) / r.width : 0.5, r.height ? (e.clientY - r.top) / r.height : 0.5)
  }
  return (
    <Tip label={tip} side="right" hidden={!!mv.drag || hideTip}>
      <div
        role="option"
        aria-selected={selected}
        aria-label={label}
        tabIndex={mv.pane === id ? 0 : -1}
        data-v3-anchor={rowAnchorOf(id, !!master)}
        data-mv-row={id}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onPointerDown={(e) => rows.onPointerDown(e, id)}
        className={cn("text-left transition-colors", selected ? "bg-(--v3-accent-soft)" : "hover:bg-(--v3-panel-2)", className)}
      >
        {children}
      </div>
    </Tip>
  )
}

/* ------------------------------------------------------------------ 行名称的折行（规格 §3.2.2；2026-10-31 总编排裁定第 9 条 ④） */

/** 一段文字（元素里唯一的文字节点）画出来的末行是不是只剩一个字：最后一个非空白字与它前一个非空白字不在同一行（不计空白；代理对按一个字量） */
function lastLineAlone(el: HTMLElement): boolean {
  const t = el.firstChild
  if (!(t instanceof Text) || el.childNodes.length !== 1) return false
  const s = t.data
  const rg = document.createRange()
  /** 第 i 个 UTF-16 单元往前退到这个字的起点（低位代理退一格） */
  const start = (i: number) => (i > 0 && s.charCodeAt(i) >= 0xdc00 && s.charCodeAt(i) <= 0xdfff ? i - 1 : i)
  const prevChar = (i: number) => {
    let j = start(i) - 1
    while (j >= 0 && /\s/.test(s[j] ?? "")) j--
    return j < 0 ? -1 : start(j)
  }
  const topOf = (i: number) => {
    rg.setStart(t, i)
    rg.setEnd(t, Math.min(s.length, i + (s.charCodeAt(i) >= 0xd800 && s.charCodeAt(i) <= 0xdbff ? 2 : 1)))
    const r = [...rg.getClientRects()].find((q) => q.width > 0 || q.height > 0)
    return r ? r.top + r.height / 2 : null
  }
  const last = prevChar(s.length)
  if (last < 0) return false
  const before = prevChar(last)
  if (before < 0) return false
  const a = topOf(last)
  const b = topOf(before)
  return a !== null && b !== null && a - b > 1
}

/**
 * 窗格行名称的折行：均衡折行（均衡折行的类名写在调用处）——折成几行时各行字数相近，末行不会只剩一个字（原来按满行折，「标题和竖排文字」折成「标题和竖排文 / 字」）；
 * 不截断、不加省略号、不限行数（Q7）。浏览器的均衡算法只管有限的行数（Chrome 6 行以内，更多行时退回按满行折），名称长到那一步、末行又只剩一个字时，
 * 这一行改用避免孤字的折行（行内样式的折行方式写 pretty）——由画出来的末行判，不按名称长度或列宽写死；名称、字重变了与尺寸变了（拖宽左栏、字体载入）都重量。
 * 只用在母版窗格的名称上（普通视图的左栏不动）。shown：名称元素此刻在不在（就地改名时换成输入框，改完或取消后重新挂上要重量）。返回给名称元素的 ref
 */
function useNameWrap(name: string, bold: boolean, shown: boolean) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let live = true
    const fit = () => {
      if (!live) return
      // 先按类名的均衡折行排，量末行；只在它留下孤字时才换（行内样式不经 React，名称元素上没有别的行内样式）
      el.style.textWrap = ""
      if (!el.style.length) el.removeAttribute("style")
      if (lastLineAlone(el)) el.style.textWrap = "pretty"
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    void document.fonts?.ready.then(fit)
    return () => {
      live = false
      ro.disconnect()
    }
  }, [name, bold, shown])
  return ref
}

/** 母版组：母版行（标签行 + 整宽缩略图）与缩进 18、左侧 1px 连接线的版式行（03-26 §3） */
function MasterGroup({ m, first, mv, rows }: { m: MasterDef; first: boolean; mv: MasterView; rows: RowHandlers }) {
  const on = mv.pane === m.id && mv.multiLayouts.length < 2
  const pages = mv.usageFor(m.id)
  const art = mv.artOf(m.id)
  // 对比场景里未采纳的 A′ 变体（范围独立，DS-146）：选中版式后把范围切到「母版」时，它的母版行写「正在编辑」（不铺底，dir §6 第 10 条）
  const editing = mv.variant.scope === "segment" && mv.scope === "master" && !mv.paneIsMaster && mv.paneLayout?.master === m.id
  const renaming = mv.rename?.id === m.id
  const errId = useId()
  const err = renameErrOf(mv, m.id, true)
  const nameRef = useNameWrap(m.name, true, !renaming)
  return (
    <div className={cn(!first && "mt-4")}>
      <PaneRow
        mv={mv}
        id={m.id}
        master
        selected={on}
        rows={rows}
        tip={pages.length ? `此母版的版式被${pagesText(pages)}使用` : "此母版的版式还没有页面使用"}
        label={`母版：${m.name}，${m.layouts.length} 个版式`}
        className="flex w-full flex-col gap-1.5 rounded-[6px] p-2"
      >
        {/* 名称换行时「母版」与计数留在第一行（顶对齐）；改名时输入框 28 高，两侧的字与它居中对齐 */}
        <span className={cn("flex w-full gap-1.5 text-[12px] leading-[18px]", renaming ? "items-center" : "items-start")}>
          <span className="shrink-0 text-(--v3-text-2)">母版</span>
          {renaming ? (
            <RenameField mv={mv} id={m.id} master errId={err ? errId : undefined} />
          ) : (
            <span ref={nameRef} className="min-w-0 font-medium break-words text-balance text-(--v3-text)" onDoubleClick={() => mv.startRename(m.id)}>
              {m.name}
            </span>
          )}
          {m.imported && <Tag>导入</Tag>}
          <span className="ml-auto shrink-0 whitespace-nowrap text-(--v3-text-2)">
            {editing && <span className="mr-2">正在编辑</span>}
            {m.layouts.length} 版式 · {pages.length ? `${pages.length} 页` : "未使用"}
          </span>
        </span>
        {err && <RenameError id={errId} text={err} />}
        <span data-mv-thumb="" className={cn(frame(on), "w-full")}>
          <LayoutArt master={art.master} target={art.target} prompts="thumb" omit={art.omit} shapes={art.shapes} override={art.override} boxes={art.boxes} name={art.name} />
        </span>
      </PaneRow>
      <div className="mt-1 ml-[18px] flex flex-col gap-0.5 border-l border-(--v3-border) pl-1.5">
        {m.layouts.map((l) => (
          <LayoutRow key={l.id} l={l} mv={mv} rows={rows} />
        ))}
      </div>
    </div>
  )
}

/**
 * 版式行：92 宽缩略图 + 名称（12/16，均衡折行、不截断、不限行数，Q7；useNameWrap）+ 下一行「N 页 / 未使用」；在场时行右端一枚 20px 身份色头像，名称列随之窄 24（R-38）。
 * 拖动中源行不透明度 0.4（R-37）
 */
function LayoutRow({ l, mv, rows }: { l: LayoutDef; mv: MasterView; rows: RowHandlers }) {
  const multi = mv.multiLayouts.length > 1
  const on = multi ? mv.multiLayouts.some((x) => x.id === l.id) : mv.pane === l.id
  const pages = mv.usageFor(l.id)
  const used = pages.length > 0
  const name = mv.nameOf(l.id)
  const art = mv.artOf(l.id)
  const who = mv.presenceOf(l.id)
  const renaming = mv.rename?.id === l.id
  const errId = useId()
  const err = renameErrOf(mv, l.id)
  const [onAvatar, setOnAvatar] = useState(false)
  const nameRef = useNameWrap(name, on, !renaming)
  return (
    <PaneRow
      mv={mv}
      id={l.id}
      selected={on}
      rows={rows}
      hideTip={onAvatar}
      tip={used ? `使用此版式：${pagesText(pages)}` : "没有页面使用此版式"}
      label={`版式：${name}，${used ? `${pages.length} 页使用` : "未使用"}${who ? `，${who.name}正在编辑` : ""}`}
      className={cn("flex w-full items-center gap-2.5 rounded-[6px] p-1.5", err && "flex-wrap gap-y-1.5", mv.drag?.id === l.id && "opacity-40")}
    >
      <span data-mv-thumb="" className={cn(frame(on), "w-[92px] shrink-0")}>
        <LayoutArt master={art.master} target={art.target} prompts="thumb" omit={art.omit} shapes={art.shapes} override={art.override} boxes={art.boxes} name={name} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {renaming ? (
          <RenameField mv={mv} id={l.id} errId={err ? errId : undefined} />
        ) : (
          <span ref={nameRef} className={cn("text-[12px] leading-4 break-words text-balance text-(--v3-text)", on && "font-medium")} onDoubleClick={() => mv.startRename(l.id)}>
            {name}
          </span>
        )}
        <span className="text-[12px] leading-4 text-(--v3-text-2)">{used ? `${pages.length} 页` : "未使用"}</span>
      </span>
      {who && (
        <Tip label={`${who.name}正在编辑此版式`}>
          <span className="-ml-1.5 flex shrink-0" onPointerEnter={() => setOnAvatar(true)} onPointerLeave={() => setOnAvatar(false)}>
            <Avatar name={who.name} tone={who.tone} size={20} ring="panel" />
          </span>
        </Tip>
      )}
      {err && <RenameError id={errId} text={err} className="basis-full" />}
    </PaneRow>
  )
}

/**
 * 就地改名（规格 §3.2.6，DS-150 ①）：名称换成 kit TextField（28 高、占名称列宽，进入时全选）；↵ 提交（检查器「名称」字段同一份数据），
 * Esc 取消、焦点回到该行，失焦即提交（有错时不提交、还原）；renameErrorOf 有错时红字说明、↵ 不提交。M2 与降权时 startRename 不进入。
 * 红字说明不画在字段下面，由所在的行画在整行宽度上（RenameError）：版式行的名称列只有 84 宽，句子会碎成四行、「」里的名称也会断开；
 * errId 是那一行说明的 id，输入框经 aria-describedby 指向它（读屏读到的就是它）
 */
function RenameField({ mv, id, master, errId }: { mv: MasterView; id: string; master?: boolean; errId?: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  /** 已经按 ↵ / Esc 收尾：随后输入框卸载时的失焦不再提交（Esc 取消之后不会把输入的字又提交上去） */
  const done = useRef(false)
  const r = mv.rename
  useLayoutEffect(() => {
    const input = wrap.current?.querySelector("input")
    input?.focus({ preventScroll: true })
    input?.select()
  }, [])
  useLayoutEffect(() => {
    const input = wrap.current?.querySelector("input")
    if (!input) return
    if (errId) input.setAttribute("aria-describedby", errId)
    else input.removeAttribute("aria-describedby")
  }, [errId])
  if (!r) return null
  const finish = (commit: boolean) => {
    if (commit) {
      if (mv.commitRename()) return
    } else mv.cancelRename()
    done.current = true
    mv.focusRow(id)
  }
  return (
    <div
      ref={wrap}
      className="min-w-0 flex-1"
      onBlur={(e) => {
        if (done.current || (e.relatedTarget instanceof Node && wrap.current?.contains(e.relatedTarget))) return
        // 失焦即提交；有错时不提交、还原原名
        if (mv.commitRename()) mv.cancelRename()
      }}
    >
      <TextField
        aria={master ? "母版名称" : "版式名称"}
        value={r.value}
        onChange={mv.setRenameValue}
        error={!!errId}
        className="w-full"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault()
            finish(true)
          } else if (e.key === "Escape" && !e.nativeEvent.isComposing) {
            e.preventDefault()
            finish(false)
          }
        }}
      />
    </div>
  )
}

/** 改名中的错误说明（renameErrorOf：空名、超过 64 字、同一母版里重名）；这一行不在改名时为 undefined */
function renameErrOf(mv: MasterView, id: string, master?: boolean): string | undefined {
  const r = mv.rename
  if (!r || r.id !== id) return undefined
  const target = master ? findMaster(id, mv.masters) : findLayout(id, mv.masters)
  return target ? renameErrorOf(r.value, target, mv.masters) : undefined
}

/** 改名的红字说明（12/16、--v3-danger）：占整行宽度；「」里的名称整段不断行，比一行还长时才在名称里换行（keepQuoted） */
function RenameError({ id, text, className }: { id: string; text: string; className?: string }) {
  return (
    <p id={id} className={cn("text-[12px] leading-4 text-(--v3-danger)", className)}>
      {keepQuoted(text)}
    </p>
  )
}

/* ------------------------------------------------------------------ 拖拽的插入线与拖影（规格 §3.2.7） */

/** 拖影的大小（与版式行缩略图同宽）与它离指针的偏移 */
const GHOST_W = 92
const GHOST_OFFSET = 12
/** 演示态没有真实指针：虚拟指针取插入线上、离插入线左端版式缩略图一半宽的那一点 */
const VIRTUAL_X = GHOST_W / 2

/**
 * 拖动中（mvDrag 种子，或真的按住拖动）：目标处 2px 强调色插入线，左起版式行左缘、右到列表右缘 −8，画在两行间隙正中（列表里的绝对定位，随滚动走）；
 * 拖影是 92 宽的同一缩略图，不透明度 0.6、浮层阴影，在指针右下 (12, 12)。演示态没有真实指针，虚拟指针由目标行算出（不跨母版：插入线上离左端 46；
 * 跨母版：目标行缩略图的中心），在布局阶段量、随窗格滚动与尺寸重量，不写死坐标。拖到别的母版（禁止）时不画插入线，拖影右上角 16px 禁止标记——截图拍不到真实光标，它是禁止光标的替身
 */
function DragMarks({ mv, list, ptr }: { mv: MasterView; list: HTMLDivElement | null; ptr: { x: number; y: number } | null }) {
  const root = useContext(V3RootContext)
  const drag = mv.drag
  const blocked = mv.dragBlocked
  const [geo, setGeo] = useState<{ line: { left: number; top: number; width: number } | null; point: { x: number; y: number } } | null>(null)
  /** 指针拖拽中（真的按住）：不替它滚动窗格 */
  const live = !!ptr
  useLayoutEffect(() => {
    if (!drag || !list) {
      setGeo(null)
      return
    }
    // 演示种子：目标行不在窗格的可见范围里时先把它滚进来（拖影与插入线才看得见；真拖时由指针自己带着走）
    if (!live) scrollIntoPanel(list.querySelector<HTMLElement>(`[data-mv-row="${CSS.escape(drag.to)}"]`), { ifNeeded: true })
    const measure = () => {
      const row = list.querySelector<HTMLElement>(`[data-mv-row="${CSS.escape(drag.to)}"]`)
      if (!row) {
        setGeo(null)
        return
      }
      const lr = list.getBoundingClientRect()
      const rr = row.getBoundingClientRect()
      if (blocked || drag.to === drag.id) {
        const th = row.querySelector<HTMLElement>("[data-mv-thumb]")?.getBoundingClientRect() ?? rr
        setGeo({ line: null, point: { x: th.left + th.width / 2, y: th.top + th.height / 2 } })
        return
      }
      // 两行之间的间隙是 2px：插入线（2px）落在间隙里
      const y = drag.at === "after" ? rr.bottom : rr.top - 2
      const left = rr.left - lr.left
      const width = lr.right - 8 - rr.left
      setGeo({ line: { left, top: y - lr.top + list.scrollTop, width }, point: { x: rr.left + VIRTUAL_X, y: y + 1 } })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(list)
    list.addEventListener("scroll", measure)
    window.addEventListener("resize", measure)
    return () => {
      ro.disconnect()
      list.removeEventListener("scroll", measure)
      window.removeEventListener("resize", measure)
    }
  }, [drag?.id, drag?.to, drag?.at, blocked, list])
  if (!drag || !geo) return null
  const p = ptr ?? geo.point
  const art = mv.artOf(drag.id)
  return (
    <>
      {geo.line && <span aria-hidden="true" className="pointer-events-none absolute h-0.5 bg-(--v3-accent)" style={{ left: geo.line.left, top: geo.line.top, width: geo.line.width }} />}
      {root &&
        createPortal(
          <div aria-hidden="true" className="pointer-events-none fixed z-50" style={{ left: p.x + GHOST_OFFSET, top: p.y + GHOST_OFFSET, width: GHOST_W }}>
            <span className="block overflow-hidden rounded-[4px] border border-(--v3-border) opacity-60 shadow-(--v3-shadow)">
              <LayoutArt master={art.master} target={art.target} prompts="thumb" omit={art.omit} shapes={art.shapes} override={art.override} boxes={art.boxes} name={art.name} />
            </span>
            {blocked && (
              <span className="absolute -top-2 -right-2 flex rounded-full bg-(--v3-panel)">
                <Ban size={16} strokeWidth={2} className="text-(--v3-danger)" />
              </span>
            )}
          </div>,
          root,
        )}
    </>
  )
}
