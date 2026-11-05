import { useContext, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { DropdownMenu as DM } from "radix-ui"
import { cn } from "@/lib/utils"
import { MENU_CONTENT } from "../ui"
import { V3RootContext } from "../V3Root"
import { useAnchorElement, useTrackedRect, type Rect } from "./anchor"
import { canvasFocusTarget, focusBack, useFocusBackOnClose } from "./layer"
import { MenuItems, ProxyTrigger, type MenuSpec } from "./Menu"

export interface ContextMenuProps {
  items: MenuSpec[]
  /**
   * 静态打开的位置：锚点元素内的相对坐标（0–1），如在当前页幻灯片上 { anchor: "slide", x: 0.72, y: 0.5 }、
   * 在第 3 页缩略图上 { anchor: "thumb-3", x: 0.6, y: 0.5 }。给了就在场景状态里一出现即打开。
   */
  at?: { anchor: string; x: number; y: number }
  /**
   * 在这个锚点元素上右键时（重新）打开在指针处；缺省同 at.anchor，false 不监听。
   * 以「*」结尾表示锚点名前缀：如 "thumb-*" 在任意一页缩略图上右键都会重开（onTarget 收到被点的锚点名，可同步切页）
   */
  target?: string | false
  /** 用户在 target 上右键时回调（参数是被点的锚点名，如 "thumb-4"） */
  onTarget?: (anchor: string) => void
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** 静态展开的子菜单 id 路径，如 ["arrange"] */
  openPath?: string[]
  label?: string
  className?: string
}

/**
 * 右键菜单：外观与下拉菜单相同，从落点向右下展开（放不下时自动翻转）。危险项放末尾、用 danger。
 *
 *   layers: <ContextMenu at={{ anchor: "slide", x: 0.8, y: 0.6 }} items={[{ id: "cut", label: "剪切", kbd: "⌘X" }, ...]} />
 */
export function ContextMenu({ items, at, target, onTarget, open, defaultOpen, onOpenChange, openPath, label, className }: ContextMenuProps) {
  const root = useContext(V3RootContext)
  const atEl = useAnchorElement(at?.anchor)
  const atRect = useTrackedRect(atEl, at ? { x: at.x, y: at.y } : undefined)
  const targetName = target === false ? undefined : (target ?? at?.anchor)
  const prefix = targetName?.endsWith("*") ? targetName.slice(0, -1) : null
  const targetEl = useAnchorElement(prefix === null ? targetName : undefined)
  /** 用户右键的落点（覆盖 at） */
  const [point, setPoint] = useState<Rect | null>(null)
  /** 用户右键点到的元素（关闭后焦点交回它；画布里的交给画布） */
  const hitEl = useRef<HTMLElement | null>(null)
  const [inner, setInner] = useState(defaultOpen ?? !!at)
  const isOpen = open ?? inner
  const setOpen = (v: boolean) => {
    setInner(v)
    onOpenChange?.(v)
  }
  // 关闭时焦点不在 body 停一帧（第 2 批第 6 轮集成）：菜单内容卸载的同一个任务末尾就交回右键的对象（同 onCloseAutoFocus 的规则；焦点已被新打开的对话框接走时不动）
  useFocusBackOnClose(!!root && isOpen, () => hitEl.current ?? atEl ?? canvasFocusTarget())

  useEffect(() => {
    // 前缀模式监听整个 v3 根节点，按 data-v3-anchor 前缀过滤；否则只监听那一个锚点元素
    const host = prefix !== null ? root : targetEl
    if (!host) return
    const onContextMenu = (e: MouseEvent) => {
      let name = targetName ?? ""
      if (prefix !== null) {
        const hit = (e.target as HTMLElement | null)?.closest<HTMLElement>(`[data-v3-anchor^="${CSS.escape(prefix)}"]`)
        if (!hit) return
        name = hit.dataset.v3Anchor ?? name
      }
      e.preventDefault()
      hitEl.current = prefix !== null ? ((e.target as HTMLElement | null)?.closest<HTMLElement>(`[data-v3-anchor^="${CSS.escape(prefix)}"]`) ?? null) : targetEl
      setPoint({ left: e.clientX, top: e.clientY, width: 0, height: 0 })
      setInner(true)
      onOpenChange?.(true)
      onTarget?.(name)
    }
    host.addEventListener("contextmenu", onContextMenu)
    return () => host.removeEventListener("contextmenu", onContextMenu)
  }, [targetEl, root, prefix, targetName, onOpenChange, onTarget])

  const rect = point ?? atRect
  if (!root || !rect) return null
  return (
    // 每个落点重新挂载一次，菜单按新落点重新定位
    <DM.Root key={`${rect.left},${rect.top}`} open={isOpen} onOpenChange={setOpen} modal={false}>
      {createPortal(<ProxyTrigger rect={rect} />, root)}
      <DM.Portal container={root}>
        <DM.Content
          side="right"
          align="start"
          sideOffset={2}
          collisionPadding={8}
          aria-label={label}
          onCloseAutoFocus={(e) => {
            // 没有真实触发器：焦点交回右键的对象（缩略图等可聚焦的锚点），画布上的交给画布；已被新打开的对话框接走时不抢
            e.preventDefault()
            const a = document.activeElement
            if (a && a !== document.body && a.isConnected) return
            focusBack(hitEl.current ?? atEl)
          }}
          // 经 Portal 挂在根节点，React 事件仍沿组件树冒泡：点菜单里面不应触发画布的「点空白取消选中」
          onClick={(e) => e.stopPropagation()}
          className={cn(MENU_CONTENT, className)}
        >
          {/* openPath 只用于场景状态里的静态打开；用户右键重开时子菜单不自动展开 */}
          <MenuItems items={items} openPath={point ? undefined : openPath} />
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  )
}
