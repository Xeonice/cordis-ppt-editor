import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ThemeToggle } from "@/components/theme-toggle"

export interface DesignBarOption {
  value: string
  label: string
}

const roleOptions: DesignBarOption[] = [
  { value: "owner", label: "所有者" },
  { value: "editor", label: "编辑者" },
  { value: "commenter", label: "评审者" },
  { value: "viewer", label: "查看者" },
]

/**
 * 非产品界面：每个路由顶部的演示控制条。用于在同一页面内切换 03-screens 文档描述的
 * "状态"小节（加载/空/错误/只读…）与"角色"（决定评审/只读降级），并提供返回目录与主题切换。
 */
export function DesignBar({
  title,
  spec,
  state,
  onStateChange,
  stateOptions,
  role,
  onRoleChange,
  roleOptionsOverride,
  extra,
}: {
  title: string
  spec: string
  state?: string
  onStateChange?: (v: string) => void
  stateOptions?: DesignBarOption[]
  role?: string
  onRoleChange?: (v: string) => void
  roleOptionsOverride?: DesignBarOption[]
  extra?: ReactNode
}) {
  return (
    <div className="glass relative z-10 flex min-h-10 shrink-0 flex-wrap items-center gap-2 px-3 py-1">
      <Button asChild variant="ghost" size="sm">
        <Link to="/">
          <ArrowLeft /> 目录
        </Link>
      </Button>
      <Separator orientation="vertical" className="h-5" />
      <span className="whitespace-nowrap text-sm font-medium">{title}</span>
      <Badge variant="outline" className="font-mono text-2xs text-muted-foreground">{spec}</Badge>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {extra}
        {stateOptions && stateOptions.length > 0 && (
          <Select value={state} onValueChange={onStateChange}>
            <SelectTrigger size="sm" className="w-44" aria-label="演示状态">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stateOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {onRoleChange && (
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={role}
            onValueChange={(v) => v && onRoleChange(v)}
            aria-label="演示角色"
          >
            {(roleOptionsOverride ?? roleOptions).map((o) => (
              <ToggleGroupItem key={o.value} value={o.value}>{o.label}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        <ThemeToggle />
      </div>
    </div>
  )
}
