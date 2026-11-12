import type { ComponentType } from "react"
import { CheckCircle2, CloudOff, HardDrive, Loader2, Lock, RotateCw, TriangleAlert, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"

/** 19 §保存态文案全集（单人/集成方模式） */
export type SaveState = "saved" | "saving" | "unsaved" | "error" | "local"
/** 05-collaboration-ux §7 六态会话状态机（协同模式，替代保存态文案） */
export type SyncState = "connecting" | "syncing" | "synced" | "reconnecting" | "offline" | "readonly-degraded"

export type DocStatus = { kind: "save"; state: SaveState } | { kind: "sync"; state: SyncState }

interface Meta {
  icon: ComponentType<{ className?: string }>
  label: string
  className: string
  dotClassName: string
  spin?: boolean
}

const saveMeta: Record<SaveState, Meta> = {
  saved: { icon: CheckCircle2, label: "已保存", className: "text-success-foreground", dotClassName: "bg-success" },
  saving: { icon: Loader2, label: "保存中…", className: "text-info-foreground", dotClassName: "bg-info", spin: true },
  unsaved: { icon: Loader2, label: "未保存", className: "text-muted-foreground", dotClassName: "bg-muted-foreground" },
  error: { icon: TriangleAlert, label: "保存失败", className: "text-destructive", dotClassName: "bg-destructive" },
  local: { icon: HardDrive, label: "已在本地保存", className: "text-warning-foreground", dotClassName: "bg-warning" },
}

const syncMeta: Record<SyncState, Meta> = {
  connecting: { icon: Loader2, label: "正在连接…", className: "text-muted-foreground", dotClassName: "bg-muted-foreground", spin: true },
  syncing: { icon: RotateCw, label: "正在同步…", className: "text-info-foreground", dotClassName: "bg-info", spin: true },
  synced: { icon: CheckCircle2, label: "已同步", className: "text-success-foreground", dotClassName: "bg-success" },
  reconnecting: { icon: RotateCw, label: "正在恢复连接…", className: "text-warning-foreground", dotClassName: "bg-warning", spin: true },
  offline: { icon: WifiOff, label: "离线", className: "text-warning-foreground", dotClassName: "bg-warning" },
  "readonly-degraded": { icon: Lock, label: "只读", className: "text-destructive", dotClassName: "bg-destructive" },
}

export function statusMeta(status: DocStatus): Meta {
  return status.kind === "save" ? saveMeta[status.state] : syncMeta[status.state]
}

/** AppBar 用：图标 + 文案；StatusBar 用：小圆点 + 文案（variant="dot"） */
export function StatusText({
  status,
  variant = "icon",
  onRetry,
  className,
}: {
  status: DocStatus
  variant?: "icon" | "dot"
  onRetry?: () => void
  className?: string
}) {
  const meta = statusMeta(status)
  const showRetry = status.kind === "save" && status.state === "error" && onRetry
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs tabular-nums", meta.className, className)}>
      {variant === "dot" ? (
        <span className={cn("size-1.5 shrink-0 rounded-full", meta.dotClassName)} aria-hidden="true" />
      ) : (
        <meta.icon className={cn("size-3.5 shrink-0", meta.spin && "animate-spin")} />
      )}
      {meta.label}
      {showRetry && (
        <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2 hover:no-underline">
          重试
        </button>
      )}
    </span>
  )
}

export function OfflineGlyph({ className }: { className?: string }) {
  return <CloudOff className={className} aria-hidden="true" />
}
