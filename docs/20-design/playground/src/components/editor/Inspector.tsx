import type { ComponentProps, ReactNode } from "react"
import { Lock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type InspectorTabValue = "properties" | "comments" | "history" | "plugins"

export interface InspectorTabDef {
  value: InspectorTabValue
  label: string
  content: ReactNode
  badge?: number
}

/**
 * P-02 检查器坞：宽 300，顶部 Tabs 4 等分高 40，内容区滚动。
 * 只读态：整体 opacity .6 + 顶部"只读"Banner 小型变体（03-screens/03）。
 * 母版视图态：仅禁用评论（03-screens/26 §2；母版与版式不支持评论），置灰并给出原因——用 aria-disabled 而非原生
 * disabled，以保留 Tooltip 的 hover/focus 可达性。
 */
export function Inspector({
  value,
  onValueChange,
  tabs,
  disabledTabs,
  disabledReason,
  readOnly,
  readOnlyReason = "只读 · 评审模式下不可编辑",
  className,
}: {
  value: InspectorTabValue
  onValueChange: (v: InspectorTabValue) => void
  tabs: InspectorTabDef[]
  disabledTabs?: InspectorTabValue[]
  disabledReason?: string
  readOnly?: boolean
  readOnlyReason?: string
  className?: string
}) {
  function handleChange(v: string) {
    if (disabledTabs?.includes(v as InspectorTabValue)) return
    onValueChange(v as InspectorTabValue)
  }

  return (
    <div className={cn("flex h-full w-full flex-col", className)}>
      {readOnly && (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-foreground/5 bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
          <Lock className="size-3" aria-hidden="true" /> {readOnlyReason}
        </div>
      )}
      <Tabs value={value} onValueChange={handleChange} className={cn("flex min-h-0 flex-1 flex-col gap-0", readOnly && "opacity-60")}>
        {tabs.length === 1 ? (
          <div className="px-3 pt-2.5 pb-1 text-sm font-semibold">{tabs[0]?.label}</div>
        ) : (
        <div className="p-2 pb-1">
          <TabsList className="h-9 w-full">
            {tabs.map((t) => {
              const isDisabled = disabledTabs?.includes(t.value)
              const trigger = (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  aria-disabled={isDisabled}
                  className={cn(isDisabled && "cursor-not-allowed opacity-40")}
                >
                  {t.label}
                  {!!t.badge && <Badge variant="secondary" className="ml-1 h-4 px-1 text-2xs">{t.badge}</Badge>}
                </TabsTrigger>
              )
              if (!isDisabled) return trigger
              return (
                <Tooltip key={t.value}>
                  <TooltipTrigger asChild>{trigger}</TooltipTrigger>
                  <TooltipContent>{disabledReason ?? "当前视图下不可用"}</TooltipContent>
                </Tooltip>
              )
            })}
          </TabsList>
        </div>
        )}
        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value} className="m-0 min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            {t.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

/** C-21 PropertyRow：标签列 56 固定，控件列自适应 */
export function PropertyRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-14 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 *:min-w-0">{children}</div>
      {hint && <span className="shrink-0 text-[11px] text-muted-foreground/70">{hint}</span>}
    </div>
  )
}

/** C-21 .oce-prop--pair：同行双字段（X/Y、宽/高），两控件间距 8 */
export function PropertyRowPair({
  a,
  b,
}: {
  a: { label: string; children: ReactNode }
  b: { label: string; children: ReactNode }
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      {[a, b].map((f, i) => (
        <div key={i} className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="min-w-4 shrink-0 text-xs whitespace-nowrap text-muted-foreground">{f.label}</span>
          {f.children}
        </div>
      ))}
    </div>
  )
}

export function NumberField({
  value,
  onChange,
  suffix,
  className,
  ...props
}: {
  value: string
  onChange?: (v: string) => void
  suffix?: string
} & Omit<ComponentProps<typeof Input>, "value" | "onChange">) {
  return (
    <div className="relative min-w-0 flex-1">
      <Input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        inputMode="decimal"
        className={cn("h-7 pr-6 text-xs tabular-nums", className)}
        {...props}
      />
      {suffix && <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-2xs text-muted-foreground">{suffix}</span>}
    </div>
  )
}

export function MixedValueField({ placeholder = "多个值" }: { placeholder?: string }) {
  return <Input value="" placeholder={placeholder} readOnly className="h-7 text-xs text-muted-foreground italic" />
}

export function InspectorEmptyHint({ children }: { children: ReactNode }) {
  return <p className="px-3 py-6 text-center text-xs text-muted-foreground">{children}</p>
}
