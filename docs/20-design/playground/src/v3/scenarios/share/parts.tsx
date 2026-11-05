import { useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, ICON, Menu, reasonTip, Section, SelectTrigger, Tip, userHasInteracted, withReason, type MenuSpec } from "../../kit"
import { ROLE_HINT, ROLE_LABEL, ROLES, type MemberRole, type Role } from "./people"

/**
 * share 场景的小件：对话框里的分节、角色下拉、静态角色、行内确认与「Esc 先退这一层」（加载中用 kit LoadingRow，不画骨架条，Q8）。
 * 外观只用 kit 的组件与 v3 token：分节同检查器 Section（px-4 py-3、节标题 12px 600、节间 1px 通栏分隔），
 * 下拉是 kit SelectTrigger（SELECT_FRAME：透明底 + 与分隔线同档的细边，rulings §4.25 DS-35），成员行的角色是它的列表行内变体（无框文字「可编辑 ⌄」，RowRoleTrigger），
 * 次按钮透明底 + 细边（DS-37）。
 */

/**
 * 对话框里的一节：就是 kit Section（同检查器的分节：px-4 py-3、节标题 12px 600、节间 1px 通栏分隔；标题后的计数 count、节标题 id 都是 Section 的属性）。
 * 内容自己排版（bodyClassName="block"，不加行间距）。不给 section 挂 aria-labelledby：对话框里几节都成了地标反而啰嗦；需要的控件自己用 aria-labelledby 指向节标题（labelId）。
 */
export function Block({ title, count, labelId, children, className }: { title: string; count?: number; labelId?: string; children: ReactNode; className?: string }) {
  return (
    <Section title={title} count={count} titleId={labelId} className={className} bodyClassName="block">
      {children}
    </Section>
  )
}

/** 角色下拉与静态角色同宽（Q6）：带框的下拉与静态角色左缘在一列上；成员行的无框触发器与所有者行的静态角色右缘在一列上 */
export const ROLE_W = "w-[88px]"

/**
 * 角色下拉的列表行内变体（成员行，标杆 Figma 分享弹窗的「can edit ⌄」，第 2 批第 6 轮按标杆对照改）：平时无边无底，文字与 ⌄ 右对齐到行尾；
 * 悬停、键盘聚焦、展开时铺 panel-2 底（同底座无框触发器缩放读数「77% ▾」的画法）；高 28、宽同 ROLE_W，点按区不变。
 * 不可用（离线）：文字与 ⌄ 退到 text-3、悬停不铺底，aria-disabled、仍可聚焦。邀请行、访问申请行、链接行的下拉仍是带框的 SelectTrigger（field）。
 * 回写时在设计 04 §4.1 Select 行登记为「下拉的列表行内变体」。
 */
function RowRoleTrigger({ children, className, ...rest }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      data-role-trigger="row"
      className={cn(
        ROLE_W,
        "flex h-7 shrink-0 items-center justify-end gap-1 rounded-[4px] px-2 text-[12px] leading-none text-(--v3-text) transition-colors",
        "hover:bg-(--v3-panel-2) focus-visible:bg-(--v3-panel-2) data-[state=open]:bg-(--v3-panel-2)",
        "aria-disabled:cursor-default aria-disabled:text-(--v3-text-3) aria-disabled:hover:bg-transparent aria-disabled:focus-visible:bg-transparent [&[aria-disabled]>svg]:text-(--v3-text-3)",
        className,
      )}
      {...rest}
    >
      {children}
      <ChevronDown {...ICON} className="shrink-0 text-(--v3-text-2)" />
    </button>
  )
}

/**
 * 角色下拉：kit SelectTrigger（细边）+ kit Menu（单选）。三项「可编辑 / 可评审 / 可查看」，右侧一句它能做什么（text-2）；
 * 成员行给了 onRemove 时末尾隔一条线放「移除」（危险色，选了在行内确认，不另开模态，03-08）。
 * variant：field（缺省，带框的下拉：邀请行、访问申请行）· row（成员行里的列表行内变体，无框文字「可编辑 ⌄」，见 RowRoleTrigger）。
 * 不可用（离线）：同一外观的静态触发器，aria-disabled、仍可聚焦，工具提示「名称 · 原因」（rulings §4.20 FE-06）。
 */
export function RoleSelect({
  value,
  onChange,
  aria,
  onRemove,
  disabled,
  reason,
  open,
  onOpenChange,
  className,
  variant = "field",
}: {
  value: Role
  onChange?: (r: Role) => void
  /** 读屏名，如「王小明的权限」「邀请后的权限」 */
  aria: string
  onRemove?: () => void
  disabled?: boolean
  reason?: string
  open?: boolean
  onOpenChange?: (v: boolean) => void
  className?: string
  /** field 带框的下拉（缺省）· row 成员行里的无框触发器 */
  variant?: "field" | "row"
}) {
  // 选值的下拉，选定即收起（kit Menu 单选项的 closeOnSelect）；开关自己也管一份，受控时同步给外面
  const [innerOpen, setInnerOpen] = useState(false)
  const isOpen = open ?? innerOpen
  const setOpen = (v: boolean) => {
    setInnerOpen(v)
    onOpenChange?.(v)
  }
  const label = <span className="whitespace-nowrap">{ROLE_LABEL[value]}</span>
  const Trigger = variant === "row" ? RowRoleTrigger : SelectTrigger
  const triggerCls = variant === "row" ? className : cn(ROLE_W, "shrink-0", className)
  if (disabled) {
    const t = (
      <Trigger aria-label={withReason(`${aria}：${ROLE_LABEL[value]}`, reason)} aria-disabled="true" className={triggerCls}>
        {label}
      </Trigger>
    )
    return reason ? <Tip label={reasonTip(aria, reason)}>{t}</Tip> : t
  }
  const items: MenuSpec[] = [
    {
      type: "radio",
      id: "role",
      label: "权限",
      value,
      onValueChange: (v) => onChange?.(v as Role),
      closeOnSelect: true,
      options: ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r], hint: ROLE_HINT[r] })),
    },
  ]
  if (onRemove) items.push({ type: "separator" }, { id: "remove", label: "移除", danger: true, onSelect: onRemove })
  return (
    <Menu
      trigger={
        <Trigger aria-label={`${aria}：${ROLE_LABEL[value]}`} className={triggerCls}>
          {label}
        </Trigger>
      }
      items={items}
      open={isOpen}
      onOpenChange={setOpen}
      align="end"
      label={aria}
      className="min-w-[184px]"
    />
  )
}

/**
 * 不能改的角色（所有者行、只读视图）：与下拉同宽、文字 text-2，没有外框。
 * align end（成员列表的所有者行）：右对齐，右缘与成员行无框触发器的「⌄」同一列（同为 px-2 内边距）；start（缺省）：左对齐。
 */
export function StaticRole({ role, align = "start", className }: { role: MemberRole; align?: "start" | "end"; className?: string }) {
  return (
    <span data-static-role="" className={cn(ROLE_W, "flex h-7 shrink-0 items-center px-2 text-[12px] leading-none whitespace-nowrap text-(--v3-text-2)", align === "end" && "justify-end", className)}>
      {ROLE_LABEL[role]}
    </span>
  )
}

/** 页面上有没有展开着的 Radix 菜单（它比这一层更靠上，Esc 先让它关） */
const menuOpen = () => !!document.querySelector('[role="menu"][data-state="open"]')

/**
 * Esc 先退这一层（行内确认、邀请联想），不越级关掉整个对话框（设计 07 §4「一下 Esc 关一层」）。
 * 监听挂在 window 的捕获阶段：先于 Radix 对话框（document 上）与 kit 的 useEscapeThroughTooltip 执行；处理后 preventDefault，
 * 它们见到 defaultPrevented 就不再关闭对话框。上面还开着菜单时不动，由菜单自己先关。
 */
export function useEscapeFirst(active: boolean, onEscape: () => void) {
  const ref = useRef(onEscape)
  useEffect(() => {
    ref.current = onEscape
  })
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.isComposing || e.defaultPrevented || menuOpen()) return
      e.preventDefault()
      ref.current()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [active])
}

/**
 * 行内确认（03-08「移除协作者为不可撤销操作，走确认……在该行内嵌确认，不另开模态」；收紧链接权限同一做法）：
 * 说明 + 「取消」（次按钮）+ 危险主按钮，次在左、主在右（与 kit Dialog 一致）。
 * 用户打开的确认把焦点放到「取消」（危险确认先落在安全项，设计 07 §2.3）；场景状态里一出现就开着的不抢焦点。Esc 等同「取消」。
 * 读屏：role=group 的 aria-describedby 指向说明句，焦点落到「取消」时连同要确认的整句一起念出（只挂在组上，按钮不再重复一份描述）。
 */
export function InlineConfirm({
  leading,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  className,
}: {
  leading?: ReactNode
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  className?: string
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const descId = useId()
  useEffect(() => {
    if (!userHasInteracted()) return
    const go = () => cancelRef.current?.focus({ preventScroll: true })
    const id = requestAnimationFrame(go)
    // 打开它的菜单（角色、链接权限）收起时，Radix 在下一个任务里把焦点还给触发器（触发器还在原位时，如「链接权限」）：
    // 排在它之后再接一次——焦点已在这一行里时不动
    const t = window.setTimeout(() => {
      const a = document.activeElement
      const box = cancelRef.current?.parentElement
      if (box && a && box.contains(a)) return
      go()
    }, 120)
    return () => {
      cancelAnimationFrame(id)
      window.clearTimeout(t)
    }
  }, [])
  useEscapeFirst(true, onCancel)
  return (
    <div role="group" aria-label="确认" aria-describedby={descId} className={cn("flex items-center gap-2", className)}>
      {leading}
      <p id={descId} className="min-w-0 flex-1 text-[12px] leading-[18px] text-(--v3-text)">
        {children}
      </p>
      <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
        取消
      </Button>
      <Button variant="danger" onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </div>
  )
}

