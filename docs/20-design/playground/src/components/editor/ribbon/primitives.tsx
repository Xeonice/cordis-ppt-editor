import { Children, type ComponentProps, type ComponentType, type ReactNode } from "react"
import { ChevronDown, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * P-01 Ribbon：页签栏 36 + 内容区 91（舒适密度；实际取值见 RibbonRoot 的 h-9 / h-[91px]）。
 * RibbonGroup 高 83（自撑满内容区减 py-1），内边距 px-2.5 py-1，无分隔线（分组靠 3% 前景色底的圆角块区分）；
 * 分组标签 11px text-muted-foreground/70 居中在底。
 */
export function RibbonGroup({
  label,
  ariaLabel,
  className,
  children,
}: {
  label?: ReactNode
  ariaLabel?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
      className={cn("flex shrink-0 flex-col items-center justify-center gap-1 self-stretch rounded-xl bg-foreground/[0.03] px-2.5 py-1", className)}
    >
      <div className="flex flex-1 items-center gap-1">{children}</div>
      {label && <span className="flex h-[11px] items-center text-[11px] leading-none whitespace-nowrap text-muted-foreground/70 [&_svg]:size-2.5">{label}</span>}
    </div>
  )
}

/**
 * C-01 变体：大按钮 56×60（= 两行 28px 小控件 + 4px 行距，保证与堆叠小按钮/下拉等高），图标 20 在上、标签 11 在下；用于插入/设计等强调可视选择的分组。
 * 透传其余 props（含 ref）以便作为 DropdownMenu/Popover 的 asChild 触发器使用。
 */
export function RibbonBigButton({
  icon: Icon,
  label,
  pressed,
  withCaret,
  className,
  ...props
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  pressed?: boolean
  withCaret?: boolean
  className?: string
} & Omit<ComponentProps<typeof Button>, "children" | "size" | "variant">) {
  return (
    <Button
      variant="ghost"
      aria-pressed={pressed}
      className={cn(
        "h-[60px] w-14 shrink-0 flex-col gap-1 rounded-lg px-1 text-[11px] font-normal whitespace-nowrap",
        pressed && "bg-accent text-accent-foreground",
        className
      )}
      {...props}
    >
      <span className="relative flex items-center justify-center">
        <Icon className="size-5" />
        {withCaret && <ChevronDown className="absolute -right-2.5 size-3 text-muted-foreground" />}
      </span>
      <span className="leading-none">{label}</span>
    </Button>
  )
}

/** 小按钮 28 高，图标 + 文字左对齐；用于剪贴板/编辑等分组内的堆叠小控件，可选快捷键提示 */
export function RibbonTextButton({
  icon: Icon,
  label,
  shortcut,
  className,
  ...props
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  shortcut?: string
  className?: string
} & Omit<ComponentProps<typeof Button>, "children" | "size" | "variant">) {
  const btn = (
    <Button variant="ghost" size="sm" className={cn("h-7 justify-start gap-1.5 rounded-lg px-2 text-xs font-normal", className)} {...props}>
      <Icon className="size-3.5" />
      {label}
    </Button>
  )
  if (!shortcut) return btn
  return (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent className="flex items-center gap-1.5">
        {label} <Kbd>{shortcut}</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}

export interface RibbonTabDef {
  value: string
  label: string
  content: ReactNode
  disabled?: boolean
  accent?: boolean
}

export function RibbonRoot({
  value,
  onValueChange,
  tabs,
  trailing,
  className,
  stretchTabs = true,
}: {
  value: string
  onValueChange: (v: string) => void
  tabs: RibbonTabDef[]
  trailing?: ReactNode
  className?: string
  /** 页签栏是否横向撑满（多页签场景默认开启，让胶囊等分整行）；单页签场景（如母版视图仅"母版"
   * 一个页签）传 false，胶囊按内容宽度左对齐，避免撑成一条空白横条 */
  stretchTabs?: boolean
}) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className={cn("gap-0 border-t border-foreground/5", className)}>
      <div className="flex h-9 items-center pl-1">
        <TabsList className={cn("h-full justify-start overflow-x-auto", stretchTabs ? "flex-1" : "shrink-0")}>
          {tabs.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              disabled={t.disabled}
              className={cn(!stretchTabs && "flex-none px-4", t.accent && "text-primary")}
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {trailing && <RibbonTrailingSlot>{trailing}</RibbonTrailingSlot>}
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="m-0 flex h-[91px] items-stretch gap-1.5 overflow-x-auto px-2 py-1">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}

/**
 * 外壳尾部区的容器：页签行右侧、评审工具条右端、`ReadonlyRibbonNotice` 右端共用（rulings §4.20 FE-08）。
 * 同一容器保证三处的右内边距（8px）与控件间距（4px）一致，切换编辑 ⇄ 评审时「主题 · ?」不横向跳动。
 */
export function RibbonTrailingSlot({ children }: { children: ReactNode }) {
  return <div data-slot="ribbon-trailing" className="ml-auto flex shrink-0 items-center gap-1 px-2">{children}</div>
}

/**
 * 只读/评审态下代替 Ribbon 的细条：与评审工具条同高（40px），不再用整块空玻璃卡占位（评审 12 §2 #1）。
 * `trailing`：外壳尾部区（主题 · ?，FE-08）；评审工具条没有条目时落在本细条右端。
 * 左内边距 17：锁图标与评审工具条首个按钮的图标同一竖线（工具条左内距 8 + 按钮描边 1 + 按钮内距 8），两种状态切换时左侧不跳。
 */
export function ReadonlyRibbonNotice({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className={cn("box-content flex h-10 shrink-0 items-center gap-2 border-t border-foreground/5 pl-[17px] text-xs text-muted-foreground", !trailing && "pr-4")}>
      <Lock className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{children}</span>
      {trailing && <RibbonTrailingSlot>{trailing}</RibbonTrailingSlot>}
    </div>
  )
}

/**
 * 评审 / 只读浏览时占 Ribbon 区域位的评审工具条（50/10 §3.2）：左侧是 `ui.toolbar{slot:'reviewBar'}` 贡献的条目，
 * 右端是外壳直接渲染的尾部区（与编辑模式页签行右侧同组件，不走贡献）。
 * 条目全部不可见时（M2 未装 comments 包，`slide.hasComments` 为假）退化为 `ReadonlyRibbonNotice`，尾部区随之落在细条右端。
 * 行高 40（`box-content`：发丝线在 40 之外，与页签行「36 + 发丝线」同一算法，控件落在整像素上），条目统一 28px 控件（`size="sm"`），与尾部区同一基线；
 * 左内边距 8 与右侧尾部区对称，也与编辑模式 Ribbon 内容区的 `px-2` 对齐。
 */
export function ReviewToolbar({
  children,
  emptyNotice,
  trailing,
}: {
  children?: ReactNode
  /** 没有条目时细条上的文案：评审「评审模式 · 只读」，只读浏览「只读浏览中」 */
  emptyNotice: ReactNode
  trailing?: ReactNode
}) {
  if (Children.toArray(children).length === 0) return <ReadonlyRibbonNotice trailing={trailing}>{emptyNotice}</ReadonlyRibbonNotice>
  return (
    <div role="group" aria-label="评审工具条" className="box-content flex h-10 shrink-0 items-center gap-1 border-t border-foreground/5 pl-2">
      {children}
      {trailing && <RibbonTrailingSlot>{trailing}</RibbonTrailingSlot>}
    </div>
  )
}

/** 评审工具条内的分组竖线：16px 高、与 28px 控件垂直居中 */
export function ReviewToolbarSeparator() {
  return <span className="mx-1 h-4 w-px shrink-0 bg-foreground/10" aria-hidden="true" />
}
