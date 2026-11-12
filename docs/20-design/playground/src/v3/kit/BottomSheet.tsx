import { useContext, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react"
import { X } from "lucide-react"
import { Dialog as D } from "radix-ui"
import { ICON_LG, IconButton } from "../ui"
import { V3RootContext } from "../V3Root"
import { findAnchor } from "./anchor"
import { canvasFocusTarget, focusBack, focusSettledElsewhere, InDialogContext, LayerCloseContext, tabbables, useEscapeThroughTooltip, useFocusBackOnClose } from "./layer"

/**
 * 手机（< 640）上的模态底部面板（2026-10-23 第 3 批评审修改时由 scenarios/settings/sheet.tsx 的 SettingsSheet 并入底座，画法逐像素相同）：
 * 偏好设置的手机形态（rulings §4.25 TB-118，settings.phone）与导入对话框的手机形态（DS-140、TB-181，import.dialog-phone）两处用。
 * 外形同第 1 批 narrow 的 Sheet 与第 2 批 comments.phone：贴底、上圆角 12、1px 上边、panel 底、浮层阴影；顶部 40 × 4 把手；标题行 48：标题 13px 600 + 右侧关闭 44（触控命中区，07 §2）；
 * 最宽 560、水平居中，上沿离视口顶至少 24（最高 100dvh − 24：内容比这高时正文在面板里滚动，标题与说明固定）。
 * 标题行是触控画法（48 高、44 的关闭），与 kit Dialog 的 40 高标题栏不是同一画法，DS-142 不改它。
 * 模态：遮罩 --v3-scrim、焦点圈定在面板里、aria-modal，框外内容 aria-hidden；Esc、关闭、点遮罩关闭——dismissOnOutside={false} 时点遮罩不关
 * （导入的上传与解析中，TB-180；Esc 与关闭按钮照常走 onOpenChange，同 kit Dialog 的同名属性）。
 * 焦点同 kit Drawer 的 initialFocus="dialog"：打开时（含状态里一出现就打开）焦点落在面板本身（读屏念标题与说明，不自动聚焦第一个控件，免得误改设置），不画焦点环；
 * 关闭后回到打开前的焦点元素，没有时回 returnFocus 锚点（开始页手机形态顶栏的「显示导航」），再没有交给主区，不掉到 body；
 * 焦点那时已落在页面里可用的元素上就不再移动（kit focusSettledElsewhere，同 kit Dialog）。
 *
 *   layers: <BottomSheet title="偏好设置" closeLabel="关闭偏好设置" open={open} onOpenChange={setOpen} returnFocus="home.nav-toggle">…</BottomSheet>
 */
export interface BottomSheetProps {
  title: string
  /** 标题下的说明（12px text-2，固定在标题行之下、不随正文滚动） */
  description?: ReactNode
  /** 关闭按钮的读屏名与工具提示（如「关闭偏好设置」；导入的上传与解析中写「取消导入」） */
  closeLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 打开前的焦点元素已不在时，关闭后焦点交给的锚点 */
  returnFocus?: string
  /** 点遮罩是否关闭（缺省 true）；false：遮罩上的点按不关闭，Esc 与关闭按钮照常 */
  dismissOnOutside?: boolean
  children: ReactNode
}

export function BottomSheet({ title, description, closeLabel, open, onOpenChange, returnFocus, dismissOnOutside = true, children }: BottomSheetProps) {
  const root = useContext(V3RootContext)
  const contentRef = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (!open) return
    const a = document.activeElement
    trigger.current = a instanceof HTMLElement && a !== document.body && !contentRef.current?.contains(a) ? a : null
  }, [open])
  useEscapeThroughTooltip(!!root && open, contentRef, () => onOpenChange(false))
  const backTarget = () => {
    const t = trigger.current
    if (t?.isConnected) return t
    return (returnFocus && root ? findAnchor(root, returnFocus) : null) ?? canvasFocusTarget() ?? document.querySelector<HTMLElement>("main")
  }
  const returned = useRef(false)
  useFocusBackOnClose(!!root && open, backTarget, () => {
    returned.current = true
    trigger.current = null
  })
  if (!root) return null
  const describedBy = description ? {} : { "aria-describedby": undefined }

  /** 焦点停在面板本身时：Tab 进第一个、⇧Tab 进最后一个可操作的控件（Radix 的焦点圈定只管已经在控件上的情况） */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey || e.target !== e.currentTarget) return
    e.preventDefault()
    const list = tabbables(e.currentTarget)
    const next = e.shiftKey ? list[list.length - 1] : list[0]
    next?.focus()
  }

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal container={root}>
        <D.Overlay className="fixed inset-0 z-50 bg-(--v3-scrim)" />
        <D.Content
          ref={contentRef}
          {...describedBy}
          aria-modal="true"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            contentRef.current?.focus({ preventScroll: true })
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            if (returned.current) {
              returned.current = false
              return
            }
            if (focusSettledElsewhere(contentRef.current)) {
              trigger.current = null
              return
            }
            const t = trigger.current
            trigger.current = null
            focusBack(t?.isConnected ? t : backTarget())
          }}
          onPointerDownOutside={dismissOnOutside ? undefined : (e) => e.preventDefault()}
          onInteractOutside={dismissOnOutside ? undefined : (e) => e.preventDefault()}
          onKeyDown={onKeyDown}
          onClick={(e) => e.stopPropagation()}
          // 只为核对与检查脚本：标出 kit 底部面板，不改外观
          data-v3-sheet=""
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[calc(100dvh-24px)] w-full max-w-[560px] flex-col rounded-t-[12px] border-t border-(--v3-border) bg-(--v3-panel) pb-[env(safe-area-inset-bottom)] text-(--v3-text) shadow-(--v3-shadow) outline-none"
        >
          <InDialogContext.Provider value={true}>
            <LayerCloseContext.Provider value={() => onOpenChange(false)}>
              <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-[2px] bg-(--v3-handle)" />
              <div className="flex h-12 shrink-0 items-center gap-2 pr-1.5 pl-4">
                <D.Title className="min-w-0 truncate text-[13px] leading-4 font-semibold">{title}</D.Title>
                <span className="ml-auto">
                  <IconButton label={closeLabel} size={44} onClick={() => onOpenChange(false)}>
                    <X {...ICON_LG} />
                  </IconButton>
                </span>
              </div>
              {description && <D.Description className="shrink-0 px-4 pb-3 text-[12px] leading-[18px] text-(--v3-text-2)">{description}</D.Description>}
              <div className="min-h-0 flex-1 overflow-y-auto border-t border-(--v3-border)">{children}</div>
            </LayerCloseContext.Provider>
          </InDialogContext.Provider>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
