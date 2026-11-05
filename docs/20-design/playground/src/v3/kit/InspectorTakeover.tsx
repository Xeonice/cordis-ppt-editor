import { createContext, useContext, useEffect, useLayoutEffect, useRef, type ReactNode } from "react"
import { Minimize2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Person } from "../data"
import { InspectorTopRow, type ShareConfig } from "../editor/chrome"
import { ICON, IconButton } from "../ui"
import { closeWithFocusBack, holdFocusDuring, overlayOpen, tabbables, userHasInteracted } from "./layer"
import { useSceneState, type SetSceneState } from "./scene"

/**
 * 检查器整栏面板（rulings §4.25 DS-26 的先例：图表「编辑数据」）：检查器栏临时加宽（缺省 400）、整栏换成面板；
 * 协作行（协作者 · 放映 · 分享）原样不动，「设计 / 评论」页签行换成面板标题行（标题 · 可选说明 · 「收起到检查器」· 「关闭」）。
 * 版本历史、插件面板这类「整栏面板」都用它，不要再自己拼 aside。两种用法：
 *   1. 状态直接声明（推荐）：EditorConfig.inspector.takeover = <InspectorTakeover …>；「关闭」/ Esc 收起后检查器回到常规页签，
 *      useTakeoverOpen() 读写开关（场景里自己的入口再打开它）。
 *   2. 随场景状态开关（如图表的数据面板随「展开」打开）：在 regions.inspector 里自己判断，开着时返回 <InspectorTakeover onClose=… />，否则 d.inspector()；
 *      这时要自己传 onClose（缺省的关闭只收起第 1 种）。
 */

/** 状态声明的整栏面板（inspector.takeover）开着没有：每次进入状态复位为 inspector.takeoverOpen（缺省开）；关闭后检查器回到常规页签。 */
export const TAKEOVER_KEY = "v3.inspector.takeover"

/**
 * 状态声明的整栏面板（inspector.takeover）的开关：[开着, 设置]。面板自带的「关闭」/ Esc 调的就是 setOpen(false)；场景里自己的入口用 setOpen(true) 再打开。
 * 初值是状态的 inspector.takeoverOpen（缺省 true），编辑器挂载时已写进场景仓（Editor.tsx），各处第一次读到的都是它。
 */
export function useTakeoverOpen(): [boolean, SetSceneState<boolean>] {
  return useSceneState(TAKEOVER_KEY, true)
}

/** 检查器把整栏交给面板时传下来的外框配置（editor/Inspector.tsx 提供）：协作行的头像组与「打开中」原因。regions 里自己渲染的面板拿不到，用缺省值。 */
export interface TakeoverHost {
  collaborators?: { people: Person[]; extra?: number }
  locked?: string
  /** 「分享」的宿主声明（inspector.share：M2 SHARE_LATER、只有分享不可用的原因、false 不渲染；TB-161） */
  share?: ShareConfig
}
export const TakeoverHostContext = createContext<TakeoverHost | null>(null)

export interface InspectorTakeoverProps {
  /** 面板标题（13px 600），如「版本历史」「编辑数据」；要短，标题行不换行 */
  title: ReactNode
  /** 标题下一行说明（12px text-2，单行，放不下截断），如图表子类型；有它时标题行高 56，没有时 44（与「设计 / 评论」页签行同高） */
  subtitle?: ReactNode
  /** 标题行右侧、「收起到检查器」「关闭」之前的按钮（IconButton，28px） */
  actions?: ReactNode
  /** 「收起到检查器」：给了才出这个按钮（如图表数据面板收起后，检查器「数据」分区展开、焦点回「展开」） */
  onCollapse?: () => void
  /**
   * 「关闭」（× · Esc）：缺省收起状态声明的整栏面板（useTakeoverOpen）并交还焦点——先交出焦点再收起（kit closeWithFocusBack），焦点不经过 body；
   * regions 里自己渲染时要传（交还焦点同样用 closeWithFocusBack）
   */
  onClose?: () => void
  /** Esc 等同「关闭」（缺省 true）：挂在 document 捕获阶段，浮层（菜单、弹层、对话框）开着时不响应；处理后 preventDefault，下一级不再处理。
   *  面板里有自己的 Esc 规则（如先清空搜索）时，在内容组件里同样挂捕获阶段监听、处理后 e.preventDefault()（内容先于面板注册，先执行）；
   *  整套逐层规则自己管的（图表：先放弃格内输入）传 false */
  escape?: boolean
  /**
   * 用户打开时把焦点移进内容区第一个可聚焦项（没有就给「关闭」）；场景状态里一出现就开着的不抢焦点（缺省 true；自己管初始焦点的传 false）。
   * 焦点不在 body 停留：打开它的控件随面板一起换掉时（检查器里的按钮、随之收起的提示条）布局阶段就交过去；从菜单打开时，条目卸载的那一刻就交过去（不绕回触发按钮）
   */
  autoFocus?: boolean
  /** 缺省的「关闭」之后焦点交给这个锚点（如 "doc-menu"：从文档菜单打开的版本历史），缺省交给画布 */
  returnFocus?: string
  /** 栏宽（缺省 400，DS-26：检查器栏由 280 临时加宽到 400，1600 宽视口下画布仍占应用区 60%） */
  width?: number
  /** 整栏的读屏名（缺省取 title 的文字） */
  label?: string
  /** 底部固定区（键盘帮助、主操作等），上方 1px 分隔线，内边距 16 / 12 */
  footer?: ReactNode
  /** 内容区（纵向滚动、占满剩余高度）的补充类名，如 "flex flex-col gap-3 px-4 py-3"；缺省不加内边距（列表、Section 自带） */
  bodyClassName?: string
  children: ReactNode
}

/** 检查器整栏面板，见文件头。 */
export function InspectorTakeover({
  title,
  subtitle,
  actions,
  onCollapse,
  onClose,
  escape = true,
  autoFocus = true,
  returnFocus,
  width = 400,
  label,
  footer,
  bodyClassName,
  children,
}: InspectorTakeoverProps) {
  const host = useContext(TakeoverHostContext)
  const [, setOpen] = useTakeoverOpen()
  const asideRef = useRef<HTMLElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  // 面板卸载时焦点不能掉到 body：先交给指定锚点（没有时焦点在面板里就交给画布；本来就在别处时不动），再收起
  const close = onClose ?? (() => closeWithFocusBack(() => setOpen(false), returnFocus, asideRef.current))
  const closeRef = useRef(close)
  closeRef.current = close

  useEffect(() => {
    if (!escape) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing || overlayOpen()) return
      e.preventDefault()
      closeRef.current()
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [escape])

  useLayoutEffect(() => {
    if (!autoFocus || !userHasInteracted()) return
    // 落点：内容区第一个可聚焦项，没有就给「关闭」
    const land = () => (bodyRef.current ? tabbables(bodyRef.current)[0] : undefined) ?? closeBtn.current
    const a = document.activeElement
    // 打开它的控件随面板一起换掉了（检查器里的「保真详情」、随之收起的提示条与轻提示按钮）：焦点这时已经掉到 body，布局阶段就交给落点，不留一帧
    if (!a || a === document.body || !a.isConnected) land()?.focus({ preventScroll: true })
    // 从菜单打开（Radix 选中条目时同步渲染：面板挂载那一刻菜单还开着、焦点还在条目上）：菜单随后收起、条目卸载，
    // 焦点要掉到 body 的那一刻（同一个任务末尾）就交给落点，不经过 body，也不让菜单先把焦点还给触发按钮（kit holdFocusDuring）
    const release = holdFocusDuring(1000, land)
    // 其余情况兜底：排到下一个任务再移进来（菜单的焦点圈定这时已解除；菜单交还焦点时见到焦点已被接走就不再抢，kit keepMovedFocus）
    const id = window.setTimeout(() => land()?.focus({ preventScroll: true }), 0)
    return () => {
      window.clearTimeout(id)
      release()
    }
    // 只在挂载（打开）时
  }, [])

  return (
    <aside
      ref={asideRef}
      data-v3-anchor="inspector"
      data-v3-takeover=""
      aria-label={label ?? (typeof title === "string" ? title : undefined)}
      style={{ width }}
      className="flex shrink-0 flex-col border-l border-(--v3-border) bg-(--v3-panel) select-none"
    >
      <InspectorTopRow collaborators={host?.collaborators} locked={host?.locked} share={host?.share} />

      <div className={cn("flex shrink-0 items-center gap-1 border-b border-(--v3-border) pr-3 pl-4", subtitle ? "h-14" : "h-11")}>
        {subtitle ? (
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] leading-4 font-semibold text-(--v3-text)">{title}</h2>
            <p className="mt-1 truncate text-[12px] leading-4 text-(--v3-text-2)">{subtitle}</p>
          </div>
        ) : (
          <h2 className="min-w-0 flex-1 text-[13px] leading-4 font-semibold whitespace-nowrap text-(--v3-text)">{title}</h2>
        )}
        {actions}
        {onCollapse && (
          <IconButton label="收起到检查器" onClick={onCollapse}>
            <Minimize2 {...ICON} />
          </IconButton>
        )}
        <IconButton ref={closeBtn} label="关闭" kbd="Esc" onClick={close}>
          <X {...ICON} />
        </IconButton>
      </div>

      <div ref={bodyRef} className={cn("min-h-0 flex-1 overflow-y-auto", bodyClassName)}>
        {children}
      </div>

      {footer && <div className="shrink-0 border-t border-(--v3-border) px-4 py-3">{footer}</div>}
    </aside>
  )
}
