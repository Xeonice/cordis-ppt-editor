import { type ReactNode } from "react"
import { Check, CircleDashed, CircleOff, CircleX, Hourglass, LoaderCircle, OctagonAlert, Puzzle, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SessionStatus } from "./data"

/**
 * plugins 场景的小件：插件图标块、会话状态文字、行内说明。
 * 个人启停开关、归属标识、带归属的检查器分区已并入 kit（第 2 批集成）：Switch、Attribution、Section / FoldSection 的 owner 属性。
 * 状态不只靠颜色（PM-16）：每种会话状态都有独立图标与文字；只有「启动失败」「版本不兼容」的图标用危险色，文字一律 text / text-2（状态色只给图标，Q3：正常态不着色）。
 */

/** 行内小图标（12px，与左栏同步状态行「✓ 已同步」同一规格） */
export const SI = { size: 12, strokeWidth: 1.75, "aria-hidden": true } as const

/** 插件图标块：28 / 32px、圆角 4（缩略图档）、panel-2 底；插件没有图标时用拼图兜底（06 §2.1）。dim：已关闭 / 本部署没有，图标退到 text-3（不用半透明） */
export function PluginTile({ icon: Icon = Puzzle, size = 32, dim }: { icon?: LucideIcon; size?: 28 | 32; dim?: boolean }) {
  return (
    <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center rounded-[4px] bg-(--v3-panel-2)", size === 32 ? "size-8" : "size-7")}>
      <Icon size={16} strokeWidth={1.5} className={dim ? "text-(--v3-text-3)" : "text-(--v3-text-2)"} />
    </span>
  )
}

/**
 * 危险组的两种状态用不与警告三角同形的图标（启动失败 CircleX、版本不兼容 OctagonAlert）；三角只留给警告（缺插件原因、冲突说明，与保真、离线组一致）。
 * 不用 Ban / CircleSlash：与「已关闭」的 CircleOff 同是圆圈加斜线，只差颜色
 */
const STATUS: Record<SessionStatus, { label: string; Icon: LucideIcon; danger?: boolean; spin?: boolean }> = {
  running: { label: "运行中", Icon: Check },
  pending: { label: "等待依赖", Icon: Hourglass },
  failed: { label: "启动失败", Icon: CircleX, danger: true },
  incompatible: { label: "版本不兼容", Icon: OctagonAlert, danger: true },
  lazy: { label: "未加载（惰性）", Icon: CircleDashed },
  off: { label: "已关闭", Icon: CircleOff },
  retrying: { label: "重试中…", Icon: LoaderCircle, spin: true },
}

export const statusLabel = (s: SessionStatus) => STATUS[s].label

/**
 * 会话状态文字（03-09 §3.1）：12px 图标 + 12px 文字；运行中、等待依赖、未加载、已关闭整段 text-2；
 * 失败与不兼容只有图标用危险色，文字用 text（比正常态的 text-2 深一级，与缺插件行「⚠ 管理员已停用」同一写法）
 */
export function StatusText({ status, children }: { status: SessionStatus; children?: ReactNode }) {
  const m = STATUS[status]
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 text-[12px] leading-4 whitespace-nowrap", m.danger ? "text-(--v3-text)" : "text-(--v3-text-2)")}>
      <m.Icon {...SI} className={cn("shrink-0", m.danger && "text-(--v3-danger)", m.spin && "motion-safe:animate-spin")} />
      {children ?? m.label}
    </span>
  )
}

/** 状态的图标（计数行等只要图标的地方用，与行内状态同一个图标、同一着色） */
export function StatusIcon({ status }: { status: SessionStatus }) {
  const m = STATUS[status]
  return <m.Icon {...SI} className={cn("shrink-0", m.danger ? "text-(--v3-danger)" : "text-(--v3-text-2)")} />
}

/** 行内说明的一行：12px 图标 + 12px 文字（等待依赖、版本不兼容、只读说明、冲突说明…） */
export function Note({ icon, tone = "muted", children, className }: { icon?: ReactNode; tone?: "muted" | "danger" | "warning" | "text"; children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-1 text-[12px] leading-4 break-keep",
        tone === "danger" ? "text-(--v3-danger)" : tone === "text" ? "text-(--v3-text)" : "text-(--v3-text-2)",
        className,
      )}
    >
      {icon && <span className={cn("flex h-4 shrink-0 items-center", tone === "warning" && "text-(--v3-warning)")}>{icon}</span>}
      <span className="min-w-0">{children}</span>
    </p>
  )
}

/** 引号内的名称与代码串不断行（Q7） */
export const Nowrap = ({ children }: { children: ReactNode }) => <span className="whitespace-nowrap">{children}</span>
