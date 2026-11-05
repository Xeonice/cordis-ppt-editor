import { useState, type ReactNode } from "react"
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDismissOnMasterToggle } from "../editor/master/mode"
import { Button, ICON, IconButton } from "../ui"
import { rescueFocus, useRevealAfterMount } from "./layer"

/**
 * 轻提示的落点：画布列底部居中、底部工具条上方 12px（工具条上沿约在 62px）。多条时自下而上叠放，新的在下。
 * 层级在工具条（z-20）之下（产品 --layer-toast 15，在常驻外壳之下，rulings §4.25 TB-2）：工具条上弹出的形状弹层与轻提示叠在同一片区域时，弹层盖住提示，提示不挡用户刚打开的弹层。
 * 放在 EditorConfig.canvasOverlay 里：
 *
 *   canvasOverlay: <Toasts><Toast tone="success" action="撤销">已应用主题「商务」</Toast></Toasts>
 *
 * 读屏：容器本身不是播报区（第 2 批第 6 轮集成去掉了容器的 aria-live）——每条轻提示自己是 role=status（错误为 alert），同一句只经这一条通道播报一次；
 * 原来容器 aria-live=polite 套着每条的 status / alert，同一句进了两个播报区（嵌套 live 区，部分读屏会念两遍）。
 */
export function Toasts({ children, bottom }: { children: ReactNode; /** 离容器底边的距离（缺省 74：编辑器底部工具条上方 12）；应用壳页面没有工具条，放在主区的 overlay 里写 24 */ bottom?: number }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute left-1/2 z-[15] flex -translate-x-1/2 flex-col items-center gap-2 *:pointer-events-auto",
        // 缺省落点的一叠给更新的一条让位：画布列 main 上写了 --v3-toast-push（⌥⌘M 不可用时的轻提示正在显示，editor/master/host.tsx MasterModeToast）时整体上移这么多，
        // 新的那条画在最下面（「多条自下而上叠放、新的在下」，50/10 §11）；没写时是 0，位置与原来相同。2026-10-29 母版视图第一步补完（复验 R1-N4）
        bottom === undefined && "bottom-[74px] mb-[var(--v3-toast-push,0px)]",
      )}
      style={bottom === undefined ? undefined : { bottom }}
    >
      {children}
    </div>
  )
}

const TONE_ICON = {
  neutral: null,
  /** 中性说明（如「部分格式已被简化」）：text-2 的 Info 图标，不用状态色 */
  info: <Info {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />,
  success: <CircleCheck {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-success)" />,
  warning: <TriangleAlert {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-warning)" />,
  error: <CircleAlert {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-danger)" />,
} as const

export interface ToastAction {
  label: string
  onClick?: () => void
}

/**
 * 轻提示（v3 token 版，取代全局 sonner 的毛玻璃样式）：40px 高、panel 底、1px 边、圆角 8px、浮层阴影、12px 字。
 * - tone 决定左侧图标：中性无图标；info 中性 Info 图标；成功 / 警告 / 错误用对应状态色（只在该状态出现）。
 * - action 是一个文字按钮（如「撤销」）；actions 给两个及以上的选择（如「压缩 / 保留原图」，第一个是推荐项、文字 text，其余 text-2）。
 * - description：第二行补充说明（text-2），提示变成两行、高度随内容。
 * - ×：给了 onClose（或 dismissible）才有。点 × 或点任一动作后提示自己收起（先调 onClose / 动作的 onClick），
 *   与产品里「点了动作即执行并收起」一致；要动作后仍留着就给 keepOnAction。
 * - 读屏：这一条就是播报区（role=status，错误为 alert），只播报一次；出现后的两帧里内容先挡在无障碍树外（kit useRevealAfterMount，外观不变），
 *   读屏看到的是「已在的播报区里出现了内容」，不是带着内容插进来的播报区（部分读屏不念后者）。
 * - 进出母版视图（rulings §4.25 DS-158、TB-204）：普通视图里开着的这一条（含带「撤销」的）进入时收起、母版视图里不画，母版视图里出的这一条退出时收起，
 *   回到普通视图后不再弹出。同点 × 一样先调 onClose（宿主据此清掉自己记着的提示），但不交还焦点：焦点由宿主在同一次提交里交给落点。
 *   按场景状态画提示、同一个位置换内容不换 key、又没给 onClose 的宿主，要自己用同一个钩子清掉状态（否则这一位置往返后一直是收起的）
 */
export function Toast({
  tone = "neutral",
  icon,
  action,
  onAction,
  actions,
  description,
  onClose,
  dismissible,
  keepOnAction,
  children,
  className,
}: {
  tone?: keyof typeof TONE_ICON
  /** 自定义左侧图标（覆盖 tone 的图标） */
  icon?: ReactNode
  /** 文字按钮，如「撤销」「查看」 */
  action?: string
  onAction?: () => void
  /** 两个及以上的动作（给了就不用 action） */
  actions?: ToastAction[]
  /** 第二行说明 */
  description?: ReactNode
  onClose?: () => void
  /** 显示 ×（缺省：给了 onClose 才显示） */
  dismissible?: boolean
  /** 点动作后不收起（缺省收起） */
  keepOnAction?: boolean
  children: ReactNode
  className?: string
}) {
  const [closed, setClosed] = useState(false)
  const revealed = useRevealAfterMount()
  useDismissOnMasterToggle(!closed, () => {
    setClosed(true)
    onClose?.()
  })
  if (closed) return null
  const lead = icon ?? TONE_ICON[tone]
  const acts: ToastAction[] = actions ?? (action ? [{ label: action, onClick: onAction }] : [])
  const two = description !== undefined && description !== null
  const closable = dismissible ?? !!onClose
  const close = () => {
    setClosed(true)
    onClose?.()
    // × 随提示卸载：焦点交给画布，不掉到 body
    requestAnimationFrame(rescueFocus)
  }
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-center gap-2 rounded-[8px] border border-(--v3-border) bg-(--v3-panel) pl-3 text-[12px] leading-none whitespace-nowrap text-(--v3-text) shadow-(--v3-shadow)",
        two ? "min-h-10 py-2.5" : "h-10",
        acts.length || closable ? "pr-1.5" : "pr-3",
        className,
      )}
    >
      {/* display: contents 的壳不占版面（下面各段仍是这一行的 flex 子项）：只在出现后的两帧里用 aria-hidden 把内容挡在无障碍树外，见上 */}
      <span className="contents" aria-hidden={revealed ? undefined : true}>
      {lead && <span className={cn("flex shrink-0", two && "self-start")}>{lead}</span>}
      {two ? (
        <span className="inline-flex flex-col gap-1 leading-4">
          <span>{children}</span>
          <span className="text-(--v3-text-2)">{description}</span>
        </span>
      ) : (
        <span>{children}</span>
      )}
      {acts.length > 0 && (
        <span className="ml-1 flex items-center">
          {acts.map((a, i) => (
            <Button
              key={a.label}
              variant="ghost"
              className={cn("px-2", i === 0 ? "text-(--v3-text)" : "text-(--v3-text-2)")}
              onClick={() => {
                a.onClick?.()
                if (!keepOnAction) {
                  setClosed(true)
                  requestAnimationFrame(rescueFocus)
                }
              }}
            >
              {a.label}
            </Button>
          ))}
        </span>
      )}
      {closable && (
        <IconButton label="关闭" size={24} onClick={close}>
          <X {...ICON} />
        </IconButton>
      )}
      </span>
    </div>
  )
}
