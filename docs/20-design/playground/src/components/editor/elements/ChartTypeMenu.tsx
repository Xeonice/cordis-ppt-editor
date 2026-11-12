import { useEffect, useRef, useState, type ReactNode, type Ref } from "react"
import { TriangleAlert } from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ignoreDesignBar } from "../ribbon/insert/demo"
import { MilestoneTag } from "../ribbon/primitives"
import { chartFamilies, sampleData, type ChartKind, type ChartSpec, type ChartSubtype } from "./chart-model"
import { DemoChart } from "./DemoChart"

/** 当前子类型格、饼图项的高亮：同检查器子类型缩略图（主色 10% 底 + 主色 40% 描边） */
const CURRENT_CLS = "bg-primary/10 ring-1 ring-primary/40 ring-inset focus:bg-primary/15"

export interface ChartTypeMenuProps {
  /** 触发器，包在 DropdownMenuTrigger asChild 里：Ribbon「图表 ▾」大按钮、迷你工具条「更改类型 ▾」、占位符图表图标旁的锚点 */
  trigger: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** 当前图表的类型（更改类型时传）：该类别菜单项图标着主色，flyout 里当前子类型格高亮；插入时不传 */
  current?: ChartSpec
  /** 选中子类型；返回 false 时菜单保持打开（例如要在 footer 里先确认） */
  onPick: (st: ChartSubtype) => boolean | void
  /** 首行说明（不可选）；缺省「[M3] 五类 · 插入后打开数据面板」；传 null 不出首行 */
  header?: ReactNode
  /** 底部插槽（前面自动加分隔线）：类型切换需确认时放 ChartTypeSwitchConfirm variant="menu" */
  footer?: ReactNode
  /** 受控展开的子类型 flyout（演示态）；缺省由悬停或 → 打开 */
  flyout?: ChartKind | null
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  sideOffset?: number
  /** 与视口边缘的避让距离；下方放不下时翻到另一侧（占位符图标条传与表格网格同一口径 PLACEHOLDER_PICKER_COLLISION） */
  collisionPadding?: number | Partial<Record<"top" | "right" | "bottom" | "left", number>>
  /** Esc：缺省关闭菜单；footer 有确认条时调用方可 preventDefault，只取消确认 */
  onEscapeKeyDown?: (e: KeyboardEvent) => void
  /**
   * 未选类型就关闭（Esc、点别处）时焦点回到哪里；缺省由 Radix 还给触发器。
   * 触发器不可聚焦时（占位符图表图标旁的不可见锚点）由调用方给出真正的按钮。
   * 选过类型再关闭时缺省不归还焦点：插入后焦点交给数据网格首个数值格。
   */
  returnFocusTo?: () => HTMLElement | null
  /** 选过类型后也把焦点还给触发器（迷你工具条「更改类型 ▾」：图表仍选中、工具条仍在，与确认条「切换」后一致） */
  returnFocusAfterPick?: boolean
}

/**
 * 图表类型菜单（设计 03-31；50/21 §3 ③、50/24 §3.3）：六项（五类，柱形 / 条形分两项）+ 子类型缩略图 flyout，饼图只有一个子类型、点击即选。
 * 三处共用：插入 › 图表 ▾（插入）、迷你工具条「更改类型 ▾」（current 高亮当前子类型）、空内容占位符图标条 › 图表（填入占位符）。
 * 宽 240，非模态；flyout 贴菜单右侧、间距 6、内边距 8，子类型格宽 92、72 × 48 缩略图。
 */
export function ChartTypeMenu({
  trigger,
  open,
  onOpenChange,
  current,
  onPick,
  header,
  footer,
  flyout,
  side = "bottom",
  align = "start",
  sideOffset,
  collisionPadding,
  onEscapeKeyDown,
  returnFocusTo,
  returnFocusAfterPick = false,
}: ChartTypeMenuProps) {
  const [fly, setFly] = useState<ChartKind | null>(flyout ?? null)
  useEffect(() => setFly(flyout ?? null), [flyout])
  // flyout 只在悬停另一项、← / Esc 或整个菜单关闭时收起；不响应「焦点移出」——菜单打开时焦点先落在父菜单上，演示态受控的 flyout 会被立即关掉
  const closeKeys = (e: { key: string }) => { if (e.key === "ArrowLeft" || e.key === "Escape") setFly(null) }

  // 本次打开期间是否选过子类型：决定关闭时要不要把焦点还给触发器（Esc / 点外部关闭时要还，03-04、03-31）
  const picked = useRef(false)
  const pick = (e: Event, st: ChartSubtype) => {
    if (onPick(st) === false) e.preventDefault()
    else picked.current = true
  }
  const closeAutoFocus = (e: Event) => {
    const didPick = picked.current
    picked.current = false
    if (didPick && !returnFocusAfterPick) { e.preventDefault(); return }
    const target = returnFocusTo?.()
    if (target) { e.preventDefault(); target.focus() }
  }

  return (
    <DropdownMenu open={open} onOpenChange={(v) => { if (!v) setFly(flyout ?? null); onOpenChange?.(v) }} modal={false}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className="w-60"
        onInteractOutside={ignoreDesignBar}
        onEscapeKeyDown={onEscapeKeyDown}
        onCloseAutoFocus={closeAutoFocus}
      >
        {header !== null && (
          <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
            {header ?? <><MilestoneTag>M3</MilestoneTag> 五类 · 插入后打开数据面板</>}
          </DropdownMenuLabel>
        )}
        {chartFamilies.map((f) => {
          const isCurFamily = current?.kind === f.kind
          if (f.subtypes.length === 1) {
            const st = f.subtypes[0]!
            return (
              <DropdownMenuItem
                key={f.kind}
                aria-current={isCurFamily || undefined}
                onSelect={(e) => pick(e, st)}
                onPointerEnter={() => setFly(null)}
                className={cn(isCurFamily && CURRENT_CLS)}
              >
                <f.icon className={cn(isCurFamily && "text-primary")} /> {f.label}
              </DropdownMenuItem>
            )
          }
          return (
            <DropdownMenuSub key={f.kind} open={fly === f.kind} onOpenChange={(v) => v && setFly(f.kind)}>
              <DropdownMenuSubTrigger aria-current={isCurFamily || undefined} className={cn(isCurFamily && "font-medium")}>
                <f.icon className={cn(isCurFamily && "text-primary")} /> {f.label}
              </DropdownMenuSubTrigger>
              {/* 子菜单内容走 Portal：父菜单内容区 overflow-y-auto 会裁掉就地渲染的 flyout */}
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="w-auto p-2" sideOffset={6} onKeyDown={closeKeys}>
                  <p className="px-1 pb-1.5 text-xs font-medium text-muted-foreground">{f.label}</p>
                  <div className="flex gap-1.5">
                    {f.subtypes.map((st) => {
                      const on = isCurFamily && current?.variant === st.variant
                      return (
                        <DropdownMenuItem
                          key={st.variant}
                          aria-current={on || undefined}
                          onSelect={(e) => pick(e, st)}
                          className={cn("w-[92px] flex-col items-center gap-1.5 rounded-xl p-1.5 text-center", on && CURRENT_CLS)}
                        >
                          <span className="rounded-md bg-doc-paper p-1 shadow-[0_0_0_1px_rgb(15_20_40/0.08)]">
                            <DemoChart spec={st} data={sampleData(st.kind)} width={72} height={48} thumb />
                          </span>
                          <span className="text-2xs leading-tight whitespace-normal">{st.name}</span>
                        </DropdownMenuItem>
                      )
                    })}
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          )
        })}
        {footer && (
          <>
            <DropdownMenuSeparator />
            {footer}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * 类型切换会丢弃导入部件内容时的确认条（50/24 §3.8；设计 03-31「更改图表类型」）：警示图标 + 说明 +「切换」「取消」，出现时焦点在「切换」，Esc 取消。
 * `variant="inline"`：检查器「图表」分区类型区下方的 cordex-group 卡；`variant="menu"`：ChartTypeMenu 的 footer，按钮是菜单项（方向键可达）。
 */
export function ChartTypeSwitchConfirm({
  message,
  onConfirm,
  onCancel,
  variant = "inline",
  confirmLabel = "切换",
}: {
  message: ReactNode
  onConfirm: () => void
  onCancel: () => void
  variant?: "inline" | "menu"
  confirmLabel?: string
}) {
  const confirmRef = useRef<HTMLElement>(null)
  useEffect(() => {
    // 等 DesignBar 下拉收起、菜单定位完成后再聚焦，避免焦点被还给触发器
    const t = window.setTimeout(() => confirmRef.current?.focus(), 60)
    return () => window.clearTimeout(t)
  }, [])
  const note = (
    <p className="flex items-start gap-1.5 text-xs text-foreground/85">
      <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning-foreground" aria-hidden="true" />
      {/* 下拉里只有约 180 px：keep-all 让汉字之间不断行，只在调用方给的 <wbr> 或标点处换行，避免「趋 / 势线」「移 / 除」 */}
      <span className="break-keep">{message}</span>
    </p>
  )
  if (variant === "menu") {
    return (
      <div role="group" aria-label="确认更改图表类型" className="cordex-group m-1 flex flex-col gap-2 p-2.5">
        {note}
        <div className="flex justify-end gap-1.5">
          <DropdownMenuItem onSelect={onCancel} className="h-7 min-h-7 rounded-lg px-2.5 text-xs ring-1 ring-foreground/10">取消</DropdownMenuItem>
          <DropdownMenuItem
            ref={confirmRef as Ref<HTMLDivElement>}
            onSelect={onConfirm}
            className="h-7 min-h-7 rounded-lg bg-primary px-2.5 text-xs text-primary-foreground focus:bg-primary/90 focus:text-primary-foreground"
          >
            {confirmLabel}
          </DropdownMenuItem>
        </div>
      </div>
    )
  }
  return (
    <div
      role="group"
      aria-label="确认更改图表类型"
      className="cordex-group flex flex-col gap-2 p-2.5"
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onCancel() } }}
    >
      {note}
      <div className="flex justify-end gap-1.5">
        <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={onCancel}>取消</Button>
        <Button ref={confirmRef as Ref<HTMLButtonElement>} size="sm" className="h-7 px-2.5 text-xs" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </div>
  )
}
