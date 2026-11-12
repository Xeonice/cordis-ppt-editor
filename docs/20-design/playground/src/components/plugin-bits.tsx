import type { ComponentType, ReactNode } from "react"
import {
  Ban, CircleCheck, CircleDashed, CircleOff, CircleX, FileWarning, Hourglass, Layers, MonitorSmartphone, ShieldX, TriangleAlert,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { CatalogPlugin, DeployStatus, PluginScope } from "@/lib/plugin-data"

/**
 * 插件管理的共用小件（03-screens/09 个人插件面板、03-screens/32 管理员插件管理）：
 * 插件图标块、作用域徽标、部署级状态徽标。状态不只靠颜色（PM-16）：每种状态都有独立图标与文字。
 */

export function PluginTile({ plugin, className, dim }: { plugin: Pick<CatalogPlugin, "icon">; className?: string; dim?: boolean }) {
  const Icon = plugin.icon
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.06]", dim && "opacity-60", className)} aria-hidden="true">
      <Icon className="size-4 text-foreground/70" />
    </span>
  )
}

/** 作用域徽标：内容级用主色浅底（会影响所有协作者）、界面级用中性浅底（只影响本人） */
export function ScopeBadge({ scope, upgraded, className }: { scope: PluginScope; upgraded?: boolean; className?: string }) {
  const content = scope === "content" || upgraded
  const Icon = content ? Layers : MonitorSmartphone
  const badge = (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-1.5 text-2xs font-medium whitespace-nowrap",
        content ? "bg-primary/10 text-primary dark:bg-primary/15" : "bg-foreground/[0.06] text-foreground/75",
        className
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {content ? "内容级" : "界面级"}
      {upgraded && <span className="font-normal opacity-80">·部署指定</span>}
    </span>
  )
  if (!upgraded) return badge
  return (
    <Tooltip>
      <TooltipTrigger asChild><span tabIndex={0} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">{badge}</span></TooltipTrigger>
      <TooltipContent className="max-w-60 text-pretty">插件声明为界面级，部署声明文件把它升为内容级：全员统一，个人不能关闭</TooltipContent>
    </Tooltip>
  )
}

interface StatusMeta {
  label: string
  icon: ComponentType<{ className?: string }>
  className: string
  hint: string
}

/** PM-05 图 3-1：部署级八种状态 */
export const deployStatusMeta: Record<DeployStatus, StatusMeta> = {
  enabled: { label: "已启用", icon: CircleCheck, className: "bg-success-muted text-success-foreground", hint: "校验通过，策略为强制启用或允许用户选择" },
  disabled: { label: "已停用", icon: CircleOff, className: "bg-foreground/[0.06] text-muted-foreground", hint: "校验通过，策略为禁用；任何会话都不装配" },
  pending: { label: "等待依赖", icon: Hourglass, className: "bg-info-muted text-info-foreground", hint: "校验通过，所依赖的插件被禁用或被拒；依赖恢复后自动启用" },
  failed: { label: "启动失败", icon: CircleX, className: "bg-destructive/10 text-destructive dark:bg-destructive/20", hint: "服务端加载失败，或近 24 h 有 ≥ 5 个会话上报失败；不改变策略" },
  declared: { label: "已声明", icon: CircleDashed, className: "bg-foreground/[0.06] text-muted-foreground", hint: "部署启动时读到声明文件条目、校验尚未完成的瞬时状态" },
  incompatible: { label: "版本不兼容", icon: FileWarning, className: "bg-destructive/10 text-destructive dark:bg-destructive/20", hint: "hostApi 不覆盖当前宿主版本；只能重新部署改变" },
  unsigned: { label: "未签名被拒", icon: ShieldX, className: "bg-destructive/10 text-destructive dark:bg-destructive/20", hint: "既无受信签名，也无审核记录；只能重新部署改变" },
  invalid: { label: "校验失败", icon: Ban, className: "bg-destructive/10 text-destructive dark:bg-destructive/20", hint: "摘要、清单、作用域或配置与声明不符；只能重新部署改变" },
}

export const deployStatusOrder: DeployStatus[] = ["enabled", "disabled", "pending", "failed", "declared", "incompatible", "unsigned", "invalid"]

export function DeployStatusBadge({ status, className }: { status: DeployStatus; className?: string }) {
  const m = deployStatusMeta[status]
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-1.5 text-2xs font-medium whitespace-nowrap", m.className, className)}>
      <m.icon className="size-3" aria-hidden="true" />
      {m.label}
    </span>
  )
}

/** 会话级状态（个人插件面板，PM-10）：运行中 / 等待依赖 / 启动失败 / 未加载（惰性）/ 版本不兼容 / 已为你关闭 */
export type SessionStatus = "running" | "pending" | "failed" | "lazy" | "incompatible" | "off"

const sessionMeta: Record<SessionStatus, StatusMeta> = {
  running: { label: "运行中", icon: CircleCheck, className: "text-success-foreground", hint: "" },
  pending: { label: "等待依赖", icon: Hourglass, className: "text-info-foreground", hint: "" },
  failed: { label: "启动失败", icon: CircleX, className: "text-destructive", hint: "" },
  lazy: { label: "未加载（惰性）", icon: CircleDashed, className: "text-muted-foreground", hint: "" },
  incompatible: { label: "版本不兼容", icon: TriangleAlert, className: "text-destructive", hint: "" },
  off: { label: "已关闭", icon: CircleOff, className: "text-muted-foreground", hint: "" },
}

export function SessionStatusText({ status, children }: { status: SessionStatus; children?: ReactNode }) {
  const m = sessionMeta[status]
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs whitespace-nowrap", m.className)}>
      <m.icon className="size-3.5" aria-hidden="true" />
      {children ?? m.label}
    </span>
  )
}
