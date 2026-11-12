import { ChevronDown, ChevronUp } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/** T-01 备注条：高 32，内边距 0 16，12 文字 + chevron；展开高 120（占文档流空间，画布相应变矮） */
export function NotesBar({
  open,
  onOpenChange,
  value = "",
  onChange,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value?: string
  onChange?: (v: string) => void
  className?: string
}) {
  const wordCount = value.length
  return (
    <div className={cn("glass-strong mx-2 mb-2 flex shrink-0 flex-col overflow-hidden rounded-2xl", className)}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className="flex h-8 shrink-0 items-center gap-1.5 px-4 text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        备注
        {wordCount > 0 && <span className="tabular-nums">· {wordCount} 字</span>}
      </button>
      {open && (
        <div className="h-[120px] shrink-0 border-t border-foreground/5 px-4 py-2">
          <Textarea
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder="单击此处添加备注"
            aria-label="备注"
            className="h-full resize-none border-none p-0 shadow-none focus-visible:ring-0"
          />
        </div>
      )}
    </div>
  )
}
