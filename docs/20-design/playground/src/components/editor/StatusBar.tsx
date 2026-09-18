import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** T-01 状态栏：高 28，内边距 0 16，12 文字，项间距 16 */
export function StatusBar({
  left = [],
  right = [],
  className,
}: {
  left?: ReactNode[]
  right?: ReactNode[]
  className?: string
}) {
  return (
    <footer className={cn("glass-strong mx-2 mb-2 flex h-8 shrink-0 items-center gap-4 rounded-full px-4 text-xs text-muted-foreground", className)}>
      {left.map((n, i) => (
        <span key={i} className="flex items-center gap-1.5 tabular-nums">{n}</span>
      ))}
      <div className="ml-auto flex items-center gap-4">
        {right.map((n, i) => (
          <span key={i} className="flex items-center gap-1.5 tabular-nums">{n}</span>
        ))}
      </div>
    </footer>
  )
}
