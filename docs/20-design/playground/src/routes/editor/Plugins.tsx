import { useState, type ComponentType } from "react"
import { useNavigate } from "react-router-dom"
import {
  AlertTriangle, ArrowLeft, ChartColumn, ChevronDown, ChevronUp, Clock, Copy, LayoutDashboard, LayoutGrid,
  LayoutTemplate, Loader2, Puzzle, TriangleAlert, Users, WifiOff, Workflow, Zap,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { DesignBar } from "@/components/editor"
import { plugins as initialPlugins, type PluginEntry, type PluginStatus } from "@/lib/mock-data"

type DemoState = "default" | "loading" | "error" | "offline"

const stateOptions = [
  { value: "default", label: "默认" },
  { value: "loading", label: "加载中" },
  { value: "error", label: "管理器加载失败" },
  { value: "offline", label: "离线" },
]

/** 按插件身份区分图标，避免 6 个第三方插件全部挂同一个占位齿轮图标、无法靠图标扫读区分 */
const pluginIcons: Record<string, ComponentType<{ className?: string }>> = {
  "p-core": LayoutTemplate,
  "p-chart": ChartColumn,
  "p-shape": Workflow,
  "p-templates": LayoutGrid,
  "p-collab": Users,
  "p-laser": Zap,
  "p-oldboard": LayoutDashboard,
}

function PluginIcon({ plugin, className }: { plugin: PluginEntry; className?: string }) {
  const Icon = pluginIcons[plugin.id] ?? Puzzle
  return <Icon className={className} aria-hidden="true" />
}

const statusOrder: { status: PluginStatus; label: string }[] = [
  { status: "enabled", label: "已启用" },
  { status: "pending", label: "等待依赖" },
  { status: "failed", label: "启动失败" },
  { status: "incompatible", label: "版本不兼容" },
  { status: "disabled", label: "已禁用" },
]

export function EditorPlugins() {
  const navigate = useNavigate()
  const [demoState, setDemoState] = useState<DemoState>("default")
  const [list, setList] = useState<PluginEntry[]>(initialPlugins)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [confirmEnable, setConfirmEnable] = useState<PluginEntry | null>(null)
  const [confirmDisable, setConfirmDisable] = useState<PluginEntry | null>(null)

  function toggleExpand(id: string) {
    setExpanded((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  function setStatus(id: string, status: PluginStatus) {
    setList((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)))
  }

  function handleToggle(plugin: PluginEntry, next: boolean) {
    if (!next) {
      if (plugin.dependents && plugin.dependents.length > 0) { setConfirmDisable(plugin); return }
      setStatus(plugin.id, "disabled")
      toast(`已禁用「${plugin.name}」`)
      return
    }
    if (plugin.provider) { setConfirmEnable(plugin); return }
    setStatus(plugin.id, "enabled")
  }

  function retry(id: string) {
    setRetryingId(id)
    window.setTimeout(() => {
      setRetryingId(null)
      setStatus(id, "enabled")
      toast(`已恢复：「${list.find((p) => p.id === id)?.name}」已自动启用`)
    }, 1200)
  }

  const grouped = statusOrder.map((g) => ({ ...g, items: list.filter((p) => p.status === g.status) })).filter((g) => g.items.length > 0)
  const counts = {
    enabled: list.filter((p) => p.status === "enabled").length,
    disabled: list.filter((p) => p.status === "disabled").length,
    failed: list.filter((p) => p.status === "failed" || p.status === "incompatible").length,
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <DesignBar title="插件管理器" spec="03-screens/09" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} />
      <header className="glass-strong mx-2 mt-2 flex h-12 shrink-0 items-center gap-2 overflow-hidden rounded-2xl px-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/editor")}><ArrowLeft /> 返回编辑器</Button>
        <span className="text-sm font-semibold">插件管理器</span>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {demoState === "error" ? (
          <Empty>
            <EmptyMedia variant="icon"><TriangleAlert className="text-destructive" /></EmptyMedia>
            <EmptyHeader><EmptyTitle>插件列表加载失败</EmptyTitle></EmptyHeader>
            <Button variant="outline" onClick={() => setDemoState("default")}>重试</Button>
          </Empty>
        ) : demoState === "loading" ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border p-3"><Skeleton className="size-8 rounded-md" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-3 w-1/2" /></div><Skeleton className="h-5 w-9 rounded-full" /></div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">已启用 {counts.enabled}</Badge>
              {counts.disabled > 0 && <Badge variant="outline">已禁用 {counts.disabled}</Badge>}
              {counts.failed > 0 && <Badge variant="destructive">启动失败 {counts.failed}</Badge>}
            </div>

            {demoState === "offline" && (
              <Alert className="border-warning/40 bg-warning-muted text-warning-foreground">
                <WifiOff />
                <AlertDescription className="text-warning-foreground/80">离线时无法添加新插件，已加载插件的启用/禁用仍可本地生效</AlertDescription>
              </Alert>
            )}

            {grouped.map((g) => (
              <section key={g.status} className="flex flex-col gap-2">
                <h2 className="text-xs font-semibold text-muted-foreground">{g.label}{g.status !== "enabled" && ` ${g.items.length}`}</h2>
                <div className="flex flex-col gap-2">
                  {g.items.map((p) => (
                    <PluginRow
                      key={p.id}
                      plugin={p}
                      expanded={expanded.has(p.id)}
                      onToggleExpand={() => toggleExpand(p.id)}
                      onToggle={(next) => handleToggle(p, next)}
                      retrying={retryingId === p.id}
                      onRetry={() => retry(p.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={!!confirmEnable} onOpenChange={(v) => !v && setConfirmEnable(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>启用"{confirmEnable?.name}"？</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-left">
                <p>该插件将新增：</p>
                <ul className="my-2 list-disc pl-5">
                  <li>{confirmEnable?.contributions ?? "1 个 Ribbon 按钮"}</li>
                  <li>0 个可访问你数据的后台请求</li>
                </ul>
                <p>来自第三方（{confirmEnable?.provider}），同源可信，非运行时沙箱隔离</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmEnable) { setStatus(confirmEnable.id, "enabled"); toast(`已启用「${confirmEnable.name}」`) } setConfirmEnable(null) }}>确认启用</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDisable} onOpenChange={(v) => !v && setConfirmDisable(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>禁用"{confirmDisable?.name}"？</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDisable?.dependents?.length} 个插件依赖它，禁用后它们也将不可用：{confirmDisable?.dependents?.map((id) => list.find((p) => p.id === id)?.name).join("、")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDisable) {
                  setStatus(confirmDisable.id, "disabled")
                  confirmDisable.dependents?.forEach((id) => setStatus(id, "failed"))
                  toast(`已禁用「${confirmDisable.name}」`)
                }
                setConfirmDisable(null)
              }}
            >
              仍要禁用
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function PluginRow({
  plugin,
  expanded,
  onToggleExpand,
  onToggle,
  retrying,
  onRetry,
}: {
  plugin: PluginEntry
  expanded: boolean
  onToggleExpand: () => void
  onToggle: (next: boolean) => void
  retrying: boolean
  onRetry: () => void
}) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-start gap-3 p-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <PluginIcon plugin={plugin} className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">{plugin.name}</span>
            <span className="text-xs text-muted-foreground">{plugin.builtin ? "内置" : `第三方 · ${plugin.provider}`} · {plugin.version}</span>
          </div>
          {plugin.description && <p className="mt-0.5 text-xs text-muted-foreground">{plugin.description}</p>}
          {plugin.status === "pending" && <p className="mt-1 flex items-center gap-1 text-xs text-info-foreground"><Clock className="size-3" /> {plugin.errorReason}</p>}
          {plugin.status === "failed" && <p className="mt-1 flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3" /> 错误：{plugin.errorReason}</p>}
          {plugin.status === "incompatible" && <p className="mt-1 flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3" /> 需要宿主 {plugin.hostRange}，当前 0.3.1</p>}

          {(plugin.status === "failed" || plugin.status === "incompatible") && (
            <div className="mt-2 flex flex-wrap gap-2">
              {plugin.status === "failed" && (
                retrying ? (
                  <Button size="xs" variant="outline" disabled><Loader2 className="animate-spin" /> 重试中…</Button>
                ) : (
                  <Button size="xs" variant="outline" onClick={onRetry}>重试</Button>
                )
              )}
              <Button size="xs" variant="ghost" onClick={onToggleExpand} disabled={retrying}>{plugin.status === "incompatible" ? "查看兼容说明" : "查看详情"}</Button>
              <Button size="xs" variant="ghost" className="text-destructive" disabled={retrying}>禁用</Button>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {plugin.builtin ? (
            <Badge variant="outline" className="text-2xs">不可禁用</Badge>
          ) : plugin.status === "pending" ? (
            <Badge variant="outline" className="text-2xs">等待服务</Badge>
          ) : plugin.status === "incompatible" ? null : (
            <Switch checked={plugin.status === "enabled"} onCheckedChange={onToggle} disabled={retrying} aria-label={`${plugin.status === "enabled" ? "禁用" : "启用"} ${plugin.name}`} />
          )}
          {!plugin.builtin && plugin.status !== "pending" && (
            <Button variant="ghost" size="icon-xs" aria-label={expanded ? "收起详情" : "展开详情"} onClick={onToggleExpand}>
              {expanded ? <ChevronUp /> : <ChevronDown />}
            </Button>
          )}
        </div>
      </div>
      <Collapsible open={expanded}>
        <CollapsibleContent className="border-t border-foreground/5 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <p>版本 {plugin.version} · 提供方 {plugin.provider ?? "内置"} · 宿主兼容 {plugin.hostRange ?? "0.1–0.3"}</p>
          <p className="mt-1">贡献：{plugin.contributions ?? "ribbon(0) panel(0) contextMenu(0) shortcut(0)"}</p>
          <p className="mt-1">能力声明：network:api.acme.com、storage:local（仅展示）</p>
          {plugin.status === "failed" && (
            <Button size="xs" variant="link" className="mt-1 h-auto p-0" onClick={() => { navigator.clipboard?.writeText(`plugin:${plugin.id}\nerror:${plugin.errorReason}`); toast("已复制诊断信息") }}>
              <Copy className="size-3" /> 复制诊断信息
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
