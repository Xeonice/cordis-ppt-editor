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
    <div data-slot="design-bar" className="glass relative z-[60] flex min-h-10 shrink-0 flex-wrap items-center gap-2 px-3 py-1 pointer-events-auto">
      {/*
        z-[60]（> 弹层/对话框遮罩的 z-50）+ pointer-events-auto：
        部分路由（分享/导出/保真报告）以常驻打开的 Dialog 承载内容，Radix 会在 <body> 上加
        inline `pointer-events: none` 做模态锁定，导致 body 内一切元素（含本演示控制条）默认
        继承为不可点击；显式声明 pointer-events-auto 覆盖继承值，保证演示状态下拉在这些路由下依旧可操作。
        data-slot="design-bar"：演示态受控打开的非模态弹层（如插入页签的形状库、符号面板）据此忽略来自本条的
        焦点回收与点击，切换演示状态时不会被下拉关闭时的焦点归还误关（ignoreDesignBar）。
      */}
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
