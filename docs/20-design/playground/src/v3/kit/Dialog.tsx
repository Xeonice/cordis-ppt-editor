import { useContext, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { LoaderCircle, X } from "lucide-react"
import { Dialog as D } from "radix-ui"
import { cn } from "@/lib/utils"
import { Button, ICON, IconButton } from "../ui"
import { V3RootContext } from "../V3Root"
import { findAnchor } from "./anchor"
import { canvasFocusTarget, focusBack, focusSettledElsewhere, InDialogContext, LayerCloseContext, tabbables, useEscapeThroughTooltip, useFocusBackOnClose, userHasInteracted } from "./layer"

/**
 * 宽度档：sm 360 · md 480（缺省）· lg 640 · import 560——导入对话框专用的一档（rulings §4.25 DS-140、TB-179：同 Figma 文件浏览器的 Import 对话框同宽；
 * 固定高 406 由导入对话框自己给，scenarios/import/dialog.tsx）
 */
const SIZE = { sm: "w-[360px]", md: "w-[480px]", lg: "w-[640px]", import: "w-[560px]" } as const

export interface DialogAction {
  label: string
  onClick?: () => void
  /** 不可用：aria-disabled（仍可聚焦）、点了无效，外观同 Button 的不可用态 */
  disabled?: boolean
  /** 不可用原因：工具提示 + 读屏名（如「请输入 1–75 之间的整数」） */
  reason?: string
  /**
   * 进行中（如模板库「使用此模板」之后的「正在创建…」，第 3 批转正时由 templates/TemplateLibrary.tsx 自拼的底栏并入）：kit 主按钮的不可用态（rulings §4.25 DS-123：
   * 对话框与画布底上都用 kit 不可用态，不改 outline）+ 前置 14px 转圈、aria-busy、不可再点；label 写进行中的文案（「正在创建…」）
   */
  busy?: boolean
}

export interface DialogProps {
  /** 标题（13px 600） */
  title: string
  /** 标题下的说明（12px text-2）；确认框的正文一般写在这里 */
  description?: ReactNode
  /** 正文（表单、列表…） */
  children?: ReactNode
  /** default：标题栏 + 正文 + 底栏，之间 1px 分隔；confirm：紧凑确认框（无分隔线、无关闭钮），用于「删除…？」这类二次确认 */
  variant?: "default" | "confirm"
  /** 宽度：sm 360、md 480（缺省）、lg 640，另有导入对话框专用的 import 560（TB-179）；confirm 缺省 sm */
  size?: keyof typeof SIZE
  /** 主按钮（右下，强调色；danger 时为危险色实底） */
  primary?: DialogAction & { danger?: boolean }
  /** 次按钮（主按钮左侧，透明底 + 细边，rulings §4.25 DS-37），通常是「取消」 */
  secondary?: DialogAction
  /** 完全自定义底栏右侧（给了就不用 primary / secondary）。里面的「取消」「应用」要关对话框时用 kit 的 LayerClose 包一层 */
  footer?: ReactNode
  /** 底栏左侧（如「不再提示」勾选、帮助链接） */
  footerStart?: ReactNode
  /** 点主 / 次按钮后关闭（缺省 true） */
  closeOnAction?: boolean
  open?: boolean
  /** 缺省 true：场景状态里一出现就是打开的 */
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * 关闭后焦点回到哪里：缺省回到打开前的焦点元素（触发按钮）；场景状态里一出现就打开、没有触发元素时，回到这个锚点（data-v3-anchor 名字），
   * 如从工具条「更多」打开的写 "tool-more"、从主菜单打开的写 "main-menu"
   */
  returnFocus?: string
  /**
   * 用户打开时的初始焦点（场景状态里一出现就打开的，焦点总落在对话框本身，不画焦点环）：
   * auto（缺省）正文第一个可操作的控件，没有就底栏第一个按钮 · dialog 对话框本身（读屏念标题；如插件面板「不自动聚焦第一个开关」，03-09 §2）·
   * secondary / primary 底栏的次 / 主按钮（如危险确认先落在「取消」「留下」这类安全项，50/10 规则 3、设计 07 §2.3）；自定义 footer 时 secondary / primary 退回 auto
   */
  initialFocus?: "auto" | "dialog" | "secondary" | "primary"
  /** 正文区的内边距、间距，缺省 p-4 */
  bodyClassName?: string
  /**
   * 标题栏 × 的读屏名与工具提示（缺省「关闭」；工具提示照常带 Esc）：× 在某个阶段不是关闭对话框、而是别的动作时按动作改名，
   * 如导出对话框在等待同步、排队、生成中时 ×、Esc 都是取消这次导出、回到选项（第 3 批 export，rulings §4.25 DS-101），写「取消导出」。只换名字，外观不变
   */
  closeLabel?: string
  className?: string
  /**
   * 竖直位置：center（缺省）视口居中 · top 顶部锚定（距顶 max(64px, 12vh)、只向下伸展）——内容会增减的对话框（分享：加载完成、邀请成功、
   * 出错、访问申请、人多时的搜索框）用它，标题与输入框不随内容高度上下移动；其余对话框照旧居中
   */
  anchor?: "center" | "top"
  /**
   * 点遮罩 / 点到外面是否关闭（缺省 true）。false：遮罩上的点按不关闭（Esc、× 与底栏按钮照常走 onOpenChange）——
   * 导出对话框在等待同步、排队、生成中三个阶段用它（rulings §4.25 DS-101：生成中只有「取消」一个出口，误点遮罩不丢掉这次导出；第 3 批转正时由 g2 K3 并入）
   */
  dismissOnOutside?: boolean
}

/**
 * 居中对话框：panel 底、1px 边、圆角 12px、浮层阴影，遮罩 --v3-scrim；标题栏 40（标题 13px 600，左内边距 16；右上 24px ×，右内边距 8）；
 * 底部主次按钮右对齐（次在左、主在右）。画法按 Figma 统一（rulings §4.25 DS-142，2026-10-23）：标题栏 48 → 40、圆角 8 → 12、× 由次要文字色改为正文色
 * （--v3-text，悬停底同图标按钮 panel-2），第 1–3 批全部对话框随之改；按钮仍是 28 单档（DS-76），主操作仍是品牌蓝（DS-2）。
 * Esc（焦点在带工具提示的按钮上时也是一下就关）、点遮罩、右上 ×、「取消」关闭。焦点（WAI-ARIA APG 模态对话框）：
 * - 打开即把焦点移进框内：场景状态里一出现就打开时落在对话框本身（读屏念标题，截图里没有焦点环）；用户之后再打开时落在正文第一个可操作的控件。
 * - 焦点陷阱：Tab / ⇧Tab 只在框内循环，遮罩后面的界面不可达（aria-hidden + 焦点圈定）。
 * - 关闭后焦点回到打开前的焦点元素；没有时回到 returnFocus 锚点。焦点那时已落在页面里可用的元素上（整页随状态换掉、新页面已落好焦点）时不再移动。
 *
 *   layers: <Dialog title="页眉和页脚" primary={{ label: "全部应用" }} secondary={{ label: "取消" }} returnFocus="tool-more">…</Dialog>
 */
export function Dialog({
  title,
  description,
  children,
  variant = "default",
  size,
  primary,
  secondary,
  footer,
  footerStart,
  closeOnAction = true,
  open,
  defaultOpen = true,
  onOpenChange,
  returnFocus,
  initialFocus = "auto",
  bodyClassName,
  closeLabel = "关闭",
  className,
  anchor = "center",
  dismissOnOutside = true,
}: DialogProps) {
  const root = useContext(V3RootContext)
  const [inner, setInner] = useState(defaultOpen)
  const isOpen = open ?? inner
  const contentRef = useRef<HTMLDivElement>(null)
  /** 打开前的焦点元素（触发处），关闭后还给它 */
  const trigger = useRef<HTMLElement | null>(null)
  /** 挂载时就是打开的、且还没有人操作过（场景状态）：这第一次自动聚焦落在对话框本身，不画焦点环；其余（挂载时关着、之后由用户打开，或用户操作后才挂载）照常聚焦到控件 */
  const firstOpen = useRef(isOpen)
  // 在 Radix 把焦点移进框内（子组件的 effect）之前记下触发处
  useLayoutEffect(() => {
    if (!isOpen) return
    const a = document.activeElement
    trigger.current = a instanceof HTMLElement && a !== document.body && !contentRef.current?.contains(a) ? a : null
  }, [isOpen])
  const setOpen = (v: boolean) => {
    setInner(v)
    onOpenChange?.(v)
  }
  // 焦点停在带工具提示的按钮上时，同一下 Esc 收起提示并关闭对话框（不必按两次）
  useEscapeThroughTooltip(!!root && isOpen, contentRef, () => setOpen(false))
  /** 关闭时的交还处：触发处（还在页面上时）→ returnFocus 锚点 → 画布（与 onCloseAutoFocus 的 focusReturn 同一规则） */
  const backTarget = () => {
    const t = trigger.current
    if (t?.isConnected) return t
    return (returnFocus && root ? findAnchor(root, returnFocus) : null) ?? canvasFocusTarget()
  }
  /** 这一次关闭已在内容卸载的同一个任务里交还了焦点（useFocusBackOnClose），Radix 随后的 onCloseAutoFocus 不再重复交 */
  const returned = useRef(false)
  // 关闭时焦点不在 body 停一帧（第 2 批第 6 轮集成）：Radix 在内容卸载后的下一个任务才发 onCloseAutoFocus，这里在卸载的同一个任务末尾就交还
  useFocusBackOnClose(!!root && isOpen, backTarget, () => {
    returned.current = true
    trigger.current = null
  })
  if (!root) return null
  const confirm = variant === "confirm"
  const act = (fn?: () => void) => () => {
    fn?.()
    if (closeOnAction) setOpen(false)
  }
  const buttons =
    footer ??
    (primary || secondary ? (
      <>
        {secondary && (
          <Button variant="secondary" disabled={secondary.disabled || secondary.busy} reason={secondary.busy ? undefined : secondary.reason} aria-busy={secondary.busy || undefined} onClick={act(secondary.onClick)} data-v3-dialog-secondary="">
            {secondary.busy && <LoaderCircle size={14} strokeWidth={1.75} aria-hidden="true" className="shrink-0 motion-safe:animate-spin" />}
            {secondary.label}
          </Button>
        )}
        {primary && (
          <Button
            variant={primary.danger ? "danger" : "primary"}
            disabled={primary.disabled || primary.busy}
            reason={primary.busy ? undefined : primary.reason}
            aria-busy={primary.busy || undefined}
            onClick={act(primary.onClick)}
            data-v3-dialog-primary=""
          >
            {primary.busy && <LoaderCircle size={14} strokeWidth={1.75} aria-hidden="true" className="shrink-0 motion-safe:animate-spin" />}
            {primary.label}
          </Button>
        )}
      </>
    ) : null)
  // 没有说明时显式去掉 aria-describedby，Radix 不再告警
  const describedBy = description ? {} : { "aria-describedby": undefined }

  /** 打开时的初始焦点（见组件说明） */
  const focusInitial = (e: Event) => {
    e.preventDefault()
    const box = contentRef.current
    if (!box) return
    if (firstOpen.current) {
      firstOpen.current = false
      // 还没有人操作过（场景状态里一出现就打开）：落在对话框本身；用户打开的（条件渲染的对话框每次打开都是新挂载）照常聚焦到第一个控件
      if (!userHasInteracted()) {
        box.focus({ preventScroll: true })
        return
      }
    }
    if (initialFocus === "dialog") {
      box.focus({ preventScroll: true })
      return
    }
    const pick = initialFocus === "secondary" || initialFocus === "primary" ? box.querySelector<HTMLElement>(`[data-v3-dialog-${initialFocus}]`) : null
    const body = box.querySelector<HTMLElement>("[data-v3-dialog-body]")
    const target = pick ?? (body && tabbables(body)[0]) ?? box.querySelector<HTMLElement>("[data-v3-dialog-footer] button") ?? box
    target.focus({ preventScroll: true })
  }

  /** 焦点停在对话框本身时：Tab 进第一个、⇧Tab 进最后一个可操作的控件（Radix 的焦点圈定只管已经在控件上的情况） */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey || e.target !== e.currentTarget) return
    e.preventDefault()
    const list = tabbables(e.currentTarget)
    const next = e.shiftKey ? list[list.length - 1] : list[0]
    next?.focus()
  }

  /**
   * 关闭后焦点回到触发处；没有触发元素（场景状态里一出现就打开、触发它的菜单已卸载）时回到 returnFocus 锚点，再没有就交给画布（不掉到 body）。
   * 一般在内容卸载的同一个任务里就已交还（useFocusBackOnClose，见上），这里只兜「焦点当时被别处拿着」的情况（行为同前）。
   * 焦点这时已落在页面里可用的元素上就不再移动（kit focusSettledElsewhere；停在画布 / 主区这类兜底落点上不算，照旧交还）：对话框随整页卸载时
   * （如导入时选好文件后转到别的页面），Radix 补发的这次交还原先会把新页面已落好的焦点抢到画布（2026-10-23 第 3 批评审修改，导入对话框发现）
   */
  const focusReturn = (e: Event) => {
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
    if (t?.isConnected) {
      focusBack(t)
      return
    }
    focusBack((returnFocus ? findAnchor(root, returnFocus) : null) ?? canvasFocusTarget())
  }

  return (
    <D.Root open={isOpen} onOpenChange={setOpen}>
      <D.Portal container={root}>
        <D.Overlay className="fixed inset-0 z-50 bg-(--v3-scrim)" />
        <D.Content
          ref={contentRef}
          {...describedBy}
          // 模态对话框（03-08 §141、03-10 §2）：读屏只在框内浏览；Radix 已把框外内容设为 aria-hidden，这里补上规格要求的 aria-modal（不改外观）
          aria-modal="true"
          onOpenAutoFocus={focusInitial}
          onCloseAutoFocus={focusReturn}
          onPointerDownOutside={dismissOnOutside ? undefined : (e) => e.preventDefault()}
          onInteractOutside={dismissOnOutside ? undefined : (e) => e.preventDefault()}
          onKeyDown={onKeyDown}
          // 经 Portal 挂在根节点，React 事件仍沿组件树冒泡：点对话框里面不应触发画布的「点空白取消选中」
          onClick={(e) => e.stopPropagation()}
          // 只为核对与检查脚本：标出 kit 对话框与变体（default / confirm），不改外观
          data-v3-dialog={variant}
          className={cn(
            "fixed left-1/2 z-50 flex max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col rounded-[12px] border border-(--v3-border) bg-(--v3-panel) text-(--v3-text) shadow-(--v3-shadow) outline-none",
            anchor === "top" ? "top-[max(64px,12vh)] max-h-[calc(100dvh_-_max(64px,12vh)_-_32px)]" : "top-1/2 max-h-[calc(100dvh-64px)] -translate-y-1/2",
            SIZE[size ?? (confirm ? "sm" : "md")],
            className,
          )}
        >
          <InDialogContext.Provider value={true}>
          <LayerCloseContext.Provider value={() => setOpen(false)}>
            {confirm ? (
              <div className="flex min-h-0 flex-col p-4">
                <D.Title className="text-[13px] leading-4 font-semibold">{title}</D.Title>
                {description && <D.Description className="mt-2 text-[12px] leading-[18px] text-(--v3-text-2)">{description}</D.Description>}
                {children && (
                  <div data-v3-dialog-body="" className={cn("mt-3 min-h-0 overflow-y-auto", bodyClassName)}>
                    {children}
                  </div>
                )}
                {(buttons || footerStart) && (
                  <div data-v3-dialog-footer="" className="mt-4 flex items-center gap-2">
                    {footerStart && <div className="mr-auto flex items-center gap-2">{footerStart}</div>}
                    <div className="ml-auto flex items-center gap-2">{buttons}</div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* 标题栏 40（DS-142）：标题左内边距 16；× 24 按钮、右内边距 8——按 Figma 截图量取，× 字形右缘到外框与标题字左缘到外框都约 16、左右对称；× 用正文色，悬停底同图标按钮 */}
                <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-(--v3-border) pr-2 pl-4">
                  <D.Title className="text-[13px] leading-4 font-semibold">{title}</D.Title>
                  <IconButton label={closeLabel} kbd="Esc" size={24} onClick={() => setOpen(false)} className="text-(--v3-text)">
                    <X {...ICON} />
                  </IconButton>
                </div>
                {description && <D.Description className="px-4 pt-3 text-[12px] leading-[18px] text-(--v3-text-2)">{description}</D.Description>}
                {children && (
                  <div data-v3-dialog-body="" className={cn("min-h-0 flex-1 overflow-y-auto p-4", bodyClassName)}>
                    {children}
                  </div>
                )}
                {(buttons || footerStart) && (
                  <div data-v3-dialog-footer="" className="flex shrink-0 items-center gap-2 border-t border-(--v3-border) px-4 py-3">
                    {footerStart && <div className="mr-auto flex items-center gap-2">{footerStart}</div>}
                    <div className="ml-auto flex items-center gap-2">{buttons}</div>
                  </div>
                )}
              </>
            )}
          </LayerCloseContext.Provider>
          </InDialogContext.Provider>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
