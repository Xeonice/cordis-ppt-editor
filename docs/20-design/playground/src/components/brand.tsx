import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

/**
 * 品牌标：主色圆角方块里的一张 16:9 幻灯片（标题条 + 两行正文），是产品自己的图形，不借用调色板等泛用图标。
 * 亮暗两主题同一形态（主色随主题变化）。
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <rect x="6" y="9" width="20" height="14" rx="2.5" className="fill-primary-foreground" />
      <rect x="9" y="12.5" width="9" height="2.2" rx="1.1" className="fill-primary" />
      <rect x="9" y="16.6" width="14" height="1.4" rx="0.7" className="fill-primary opacity-55" />
      <rect x="9" y="19.4" width="11" height="1.4" rx="0.7" className="fill-primary opacity-35" />
    </svg>
  )
}

/** 品牌标 + 字标："Cordex" 半粗 + "幻灯片" 常规，同一名称在首页、文档列表、目录页复用。 */
export function Brand({ to = "/home", className, subtitle }: { to?: string; className?: string; subtitle?: string }) {
  return (
    <Link to={to} className={cn("flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring", className)} aria-label="Cordex 幻灯片 首页">
      <BrandMark />
      <span className="flex items-baseline gap-1 text-sm leading-none">
        <span className="font-semibold tracking-tight">Cordex</span>
        <span className="text-foreground/80">幻灯片</span>
        {subtitle && <span className="ml-1 text-xs text-muted-foreground">{subtitle}</span>}
      </span>
    </Link>
  )
}
