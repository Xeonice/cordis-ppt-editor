import { useEffect, useState } from "react"
import { ArrowUpDown, CopyPlus, Eye, EyeOff, LayoutTemplate, Plus, Trash2 } from "lucide-react"
import { ContextMenu } from "../kit/ContextMenu"
import type { MenuSpec } from "../kit/Menu"
import { ICON } from "../ui"

/**
 * 缩略图右键菜单（03-05「缩略图」；单页左栏与网格同一份）。hidden：已隐藏的页显示「取消隐藏」；only：文档只剩 1 页，删除与移动不可用。
 * readOnly（评审、只读浏览、编辑模式已降权）：条目与编辑模式相同、全部留在原位不可用（禁用而不隐藏，rulings §4.22 D-10），删除不用危险色；
 * 原因相同，不逐项写，改为菜单顶部一行常驻说明（03-05 §2.3，rulings §4.25 TB-22），各项 aria-describedby 指向它（kit Menu 带 id 的说明行）。
 * reason 是说明行的文字，按模式取：评审「评审模式下不可用」、只读浏览「只有查看权限」、降权「需要编辑权限」（缺省），与主菜单同一口径（kit mainMenu）。
 * slides-selection 场景的静态状态（context-menu.thumbnail、slide-management.thumb-menu-*）与 main-states.degraded-thumb-menu 用的也是这一份。
 */
export function thumbMenu({ hidden, only, readOnly, reason = "需要编辑权限" }: { hidden?: boolean; only?: boolean; readOnly?: boolean; /** 只读时菜单顶部说明行的文字（缺省「需要编辑权限」） */ reason?: string } = {}): MenuSpec[] {
  const ro = readOnly ? { disabled: true } : {}
  const items: MenuSpec[] = [
    { id: "new", label: "新建幻灯片", icon: <Plus {...ICON} />, kbd: "⌘M", ...ro },
    { id: "duplicate", label: "复制幻灯片", icon: <CopyPlus {...ICON} />, kbd: "⌘D", ...ro },
    { type: "separator" },
    { id: "layout", label: "更换版式…", icon: <LayoutTemplate {...ICON} />, ...ro },
    hidden ? { id: "unhide", label: "取消隐藏", icon: <Eye {...ICON} />, ...ro } : { id: "hide", label: "隐藏幻灯片", icon: <EyeOff {...ICON} />, ...ro },
    {
      type: "sub",
      id: "move",
      label: "移动",
      icon: <ArrowUpDown {...ICON} />,
      disabled: only || readOnly,
      reason: readOnly ? undefined : only ? "只有 1 页" : undefined,
      items: [
        { id: "up", label: "上移一页", kbd: "⇧⌘↑" },
        { id: "down", label: "下移一页", kbd: "⇧⌘↓" },
        { type: "separator" },
        { id: "first", label: "移到开头" },
        { id: "last", label: "移到末尾" },
      ],
    },
    { type: "separator" },
    {
      id: "delete",
      label: "删除幻灯片",
      icon: <Trash2 {...ICON} />,
      kbd: "⌫",
      danger: !only && !readOnly,
      disabled: only || readOnly,
      reason: readOnly ? undefined : only ? "文档至少保留 1 页" : undefined,
    },
  ]
  return readOnly ? [{ type: "note", id: "thumb-menu.readonly-reason", text: reason }, { type: "separator" }, ...items] : items
}

/**
 * 底座的缩略图右键：单页左栏与网格里任意一页缩略图（锚点 thumb-<n>）上右键，或焦点在缩略图上按 ⇧F10 / 菜单键，在落点打开 thumbMenu，
 * 并选中那一页（onPick）。场景自己挂了同一锚点的右键菜单（kit ContextMenu 的 target）时让给场景：它先处理并 preventDefault。
 * 监听挂在 document 冒泡阶段，比场景挂在 v3 根节点上的监听晚。关闭后焦点回到那一页缩略图。
 */
export function ThumbContextMenu({ onPick, deckSize, readOnly, reason }: { onPick: (n: number) => void; deckSize: number; readOnly?: boolean; /** 只读时菜单顶部说明行的文字（按模式，见 thumbMenu） */ reason?: string }) {
  const [at, setAt] = useState<{ anchor: string; x: number; y: number; n: number; key: number } | null>(null)
  useEffect(() => {
    const thumbOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>('[data-v3-anchor^="thumb-"]') : null)
    const open = (el: HTMLElement, x: number, y: number) => {
      const name = el.dataset.v3Anchor ?? ""
      const n = Number(name.slice("thumb-".length))
      if (!Number.isFinite(n)) return
      onPick(n)
      setAt((cur) => ({ anchor: name, x, y, n, key: (cur?.key ?? 0) + 1 }))
    }
    const onContextMenu = (e: MouseEvent) => {
      if (e.defaultPrevented) return
      const el = thumbOf(e.target)
      if (!el) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      open(el, r.width ? (e.clientX - r.left) / r.width : 0.5, r.height ? (e.clientY - r.top) / r.height : 0.5)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !(e.key === "ContextMenu" || (e.shiftKey && e.key === "F10"))) return
      const el = thumbOf(document.activeElement)
      if (!el) return
      e.preventDefault()
      open(el, 0.6, 0.5)
    }
    document.addEventListener("contextmenu", onContextMenu)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("contextmenu", onContextMenu)
      document.removeEventListener("keydown", onKey)
    }
  }, [onPick])
  if (!at) return null
  return (
    <ContextMenu
      key={at.key}
      at={{ anchor: at.anchor, x: at.x, y: at.y }}
      target={false}
      onOpenChange={(v) => !v && setAt(null)}
      label={`第 ${at.n} 页`}
      items={thumbMenu({ only: deckSize <= 1, readOnly, reason })}
    />
  )
}
