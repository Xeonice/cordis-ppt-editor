import { useContext, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { X } from "lucide-react"
import { Dialog as D } from "radix-ui"
import { cn } from "@/lib/utils"
import { ICON, IconButton } from "../ui"
import { V3RootContext } from "../V3Root"
import { findAnchor } from "./anchor"
import { canvasFocusTarget, focusBack, focusSettledElsewhere, InDialogContext, LayerCloseContext, tabbables, useEscapeThroughTooltip, useFocusBackOnClose, userHasInteracted } from "./layer"

/**
 * 抽屉（第 3 批新件）：右侧贴边、整高（视口高），panel 底、左侧 1px 分隔、浮层阴影；标题行 40（13px 600 · 右侧 × 关闭 Esc）· 正文滚动 · 可选底栏。
 * 标题行与 kit Dialog 的标题栏是同一画法，随 rulings §4.25 DS-142（2026-10-23，对话框按 Figma 统一）一起改：高 48 → 40、右内边距 12 → 8、× 用正文色（悬停底同图标按钮）；
 * 抽屉贴边、不加圆角（04 §2.9），所以 DS-142 的「圆角 12」不适用。
 * rulings §4.25 DS-94（管理员插件详情：modal、宽 480、带遮罩；未采纳的备选 modal={false} 无遮罩）与 DS-113（设置定为居中对话框；未采纳的备选抽屉 320 带遮罩）都用这一个件。
 * - modal（缺省）：遮罩 --v3-scrim，焦点圈定在抽屉里（Tab / ⇧Tab 循环），Esc、点遮罩、× 关闭；读屏 aria-modal，抽屉外的内容 aria-hidden（同 kit Dialog）。
 * - modal={false}：没有遮罩、不圈定焦点，背后的页面照常可点（点外面不关）；Esc（焦点在抽屉里时）与 × 关闭。
 * 焦点：用户打开时焦点进正文第一个可操作的控件（initialFocus="dialog" 落在抽屉本身）；场景状态里一出现就打开的落在抽屉本身、不画焦点环；
 * 关闭后回到打开前的焦点元素，没有时回到 returnFocus 锚点，再没有交给画布 / 主区（不掉到 body）。
 *
 *   layers: <Drawer title="现场投票" width={480} returnFocus="admin-plugins.row-live-poll">…</Drawer>
 */
export interface DrawerProps {
  /** 标题（13px 600） */
  title: ReactNode
  /** 标题下的说明（12px text-2） */
  description?: ReactNode
  children?: ReactNode
  /** 底栏（右对齐；里面的「取消」要关抽屉时用 kit LayerClose 包一层） */
  footer?: ReactNode
  /** 宽度（缺省 480；设置的抽屉备选 320） */
  width?: number
  /** 模态（缺省 true：遮罩 + 焦点圈定）；false：无遮罩、不圈定焦点、点外面不关 */
  modal?: boolean
  open?: boolean
  /** 缺省 true：场景状态里一出现就是打开的 */
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** 关闭后焦点回到哪个锚点（打开前的焦点元素已不在时，如场景状态里一出现就打开） */
  returnFocus?: string
  /** 用户打开时的初始焦点：auto（缺省）正文第一个可操作的控件 · dialog 抽屉本身 */
  initialFocus?: "auto" | "dialog"
  /** 读屏名（标题不是纯文字时写） */
  label?: string
  /** 正文区的内边距、间距，缺省 p-4 */
  bodyClassName?: string
  className?: string
}

export function Drawer({
  title,
  description,
  children,
  footer,
  width = 480,
  modal = true,
  open,
  defaultOpen = true,
  onOpenChange,
  returnFocus,
  initialFocus = "auto",
  label,
  bodyClassName,
  className,
}: DrawerProps) {
  const root = useContext(V3RootContext)
  const [inner, setInner] = useState(defaultOpen)
  const isOpen = open ?? inner
  const contentRef = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const firstOpen = useRef(isOpen)
  useLayoutEffect(() => {
    if (!isOpen) return
    const a = document.activeElement
    trigger.current = a instanceof HTMLElement && a !== document.body && !contentRef.current?.contains(a) ? a : null
  }, [isOpen])
  const setOpen = (v: boolean) => {
    setInner(v)
    onOpenChange?.(v)
  }
  useEscapeThroughTooltip(!!root && isOpen, contentRef, () => setOpen(false))
  /** 交还处：触发处 → returnFocus 锚点 → 画布 / 主区（不掉到 body） */
  const backTarget = () => {
    const t = trigger.current
    if (t?.isConnected) return t
    return (returnFocus && root ? findAnchor(root, returnFocus) : null) ?? canvasFocusTarget() ?? document.querySelector<HTMLElement>("main")
  }
  const returned = useRef(false)
  useFocusBackOnClose(!!root && isOpen, backTarget, () => {
    returned.current = true
    trigger.current = null
  })
  if (!root) return null
  const describedBy = description ? {} : { "aria-describedby": undefined }

  const focusInitial = (e: Event) => {
    e.preventDefault()
    const box = contentRef.current
    if (!box) return
    if (firstOpen.current) {
      firstOpen.current = false
      // 场景状态里一出现就打开（还没有人操作过）：非模态的不抢焦点；模态的落在抽屉本身（读屏念标题，不画焦点环）
      if (!userHasInteracted()) {
        if (modal) box.focus({ preventScroll: true })
        return
      }
    }
    if (initialFocus === "dialog") {
      box.focus({ preventScroll: true })
      return
    }
    const body = box.querySelector<HTMLElement>("[data-v3-drawer-body]")
    const target = (body && tabbables(body)[0]) ?? box.querySelector<HTMLElement>("[data-v3-drawer-footer] button") ?? box
    target.focus({ preventScroll: true })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey || e.target !== e.currentTarget) return
    e.preventDefault()
    const list = tabbables(e.currentTarget)
    const next = e.shiftKey ? list[list.length - 1] : list[0]
    next?.focus()
  }

  const focusReturn = (e: Event) => {
    e.preventDefault()
    if (returned.current) {
      returned.current = false
      return
    }
    const a = document.activeElement
    // 非模态：关闭时焦点已经在背后的页面上（用户点了别处后按 ×）就不拉回
    if (!modal && a && a !== document.body && a.isConnected && !contentRef.current?.contains(a)) return
    // 焦点已落在页面里可用的元素上（整页随状态换掉、新页面已落好焦点）就不拉回（kit focusSettledElsewhere，同 kit Dialog）
    if (focusSettledElsewhere(contentRef.current)) {
      trigger.current = null
      return
    }
    const t = trigger.current
    trigger.current = null
    if (t?.isConnected) {
      focusBack(t)
      return
    }
    focusBack((returnFocus ? findAnchor(root, returnFocus) : null) ?? canvasFocusTarget() ?? document.querySelector<HTMLElement>("main"))
  }

  return (
    <D.Root open={isOpen} onOpenChange={setOpen} modal={modal}>
      <D.Portal container={root}>
        {modal && <D.Overlay className="fixed inset-0 z-50 bg-(--v3-scrim)" />}
        <D.Content
          ref={contentRef}
          {...describedBy}
          aria-label={label}
          aria-modal={modal ? "true" : undefined}
          onOpenAutoFocus={focusInitial}
          onCloseAutoFocus={focusReturn}
          onKeyDown={onKeyDown}
          // 非模态：点外面、焦点移到外面都不关（背后的页面照常可用）；Esc 与 × 关闭
          onInteractOutside={modal ? undefined : (e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
          data-v3-drawer=""
          style={{ width }}
          className={cn(
            "fixed top-0 right-0 z-50 flex h-dvh max-w-[calc(100vw-32px)] flex-col border-l border-(--v3-border) bg-(--v3-panel) text-(--v3-text) shadow-(--v3-shadow) outline-none",
            className,
          )}
        >
          <InDialogContext.Provider value={true}>
            <LayerCloseContext.Provider value={() => setOpen(false)}>
              <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-(--v3-border) pr-2 pl-4">
                <D.Title className="min-w-0 truncate text-[13px] leading-4 font-semibold">{title}</D.Title>
                <IconButton label="关闭" kbd="Esc" size={24} onClick={() => setOpen(false)} className="text-(--v3-text)">
                  <X {...ICON} />
                </IconButton>
              </div>
              {description && <D.Description className="px-4 pt-3 text-[12px] leading-[18px] text-(--v3-text-2)">{description}</D.Description>}
              <div data-v3-drawer-body="" className={cn("min-h-0 flex-1 overflow-y-auto p-4", bodyClassName)}>
                {children}
              </div>
              {footer && (
                <div data-v3-drawer-footer="" className="flex shrink-0 items-center justify-end gap-2 border-t border-(--v3-border) px-4 py-3">
                  {footer}
                </div>
              )}
            </LayerCloseContext.Provider>
          </InDialogContext.Provider>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
