import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  FileUp, FolderOpen, MoreHorizontal, Plus, Search, TriangleAlert, Users, WifiOff,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DesignBar } from "@/components/editor"
import { MiniSlide, NoCoverPlaceholder } from "@/components/editor/MiniSlide"
import { Brand } from "@/components/brand"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "@/components/user-menu"
import { collaborators, documentList, presenceRing } from "@/lib/mock-data"

type DemoState = "default" | "empty" | "loading" | "error" | "no-results" | "shared-empty" | "offline"

const stateOptions = [
  { value: "default", label: "默认（有文档）" },
  { value: "empty", label: "空状态" },
  { value: "loading", label: "加载中" },
  { value: "error", label: "加载失败" },
  { value: "no-results", label: "搜索无结果" },
  { value: "shared-empty", label: "共享给我 · 空" },
  { value: "offline", label: "离线" },
]

const filters = [
  { value: "all", label: "全部" },
  { value: "owned", label: "我拥有" },
  { value: "shared", label: "共享给我" },
  { value: "recent", label: "最近" },
]

export function Documents() {
  const navigate = useNavigate()
  const [demoState, setDemoState] = useState<DemoState>("default")
  const [filter, setFilter] = useState("all")
  const [query, setQuery] = useState("")

  const isOffline = demoState === "offline"
  const effectiveFilter = demoState === "shared-empty" ? "shared" : filter
  const list = demoState === "no-results" ? [] : demoState === "shared-empty" ? [] : documentList

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <DesignBar title="文档列表" spec="03-screens/01" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} />

      <div className="flex flex-col gap-2 p-3 sm:px-6 sm:pt-4">
        <header className="glass-strong flex flex-wrap items-center gap-3 rounded-2xl px-4 py-2.5 sm:px-6">
          <Brand />
          <InputGroup className="w-full max-w-70 sm:w-auto">
            <InputGroupAddon><Search /></InputGroupAddon>
            <InputGroupInput placeholder="搜索文档..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="搜索文档" />
          </InputGroup>
          <Tabs value={effectiveFilter} onValueChange={setFilter}>
            <TabsList>
              {filters.map((f) => <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <div className="ml-auto flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={isOffline ? 0 : -1}>
                  <Button variant="outline" size="sm" disabled={isOffline} onClick={() => toast("已导入 .pptx（演示）")}>
                    <FileUp /> 导入 .pptx
                  </Button>
                </span>
              </TooltipTrigger>
              {isOffline && <TooltipContent>离线时无法导入 .pptx</TooltipContent>}
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={isOffline ? 0 : -1}>
                  <Button size="sm" disabled={isOffline} onClick={() => navigate("/editor")}>
                    <Plus /> 新建
                  </Button>
                </span>
              </TooltipTrigger>
              {isOffline && <TooltipContent>离线时无法新建文档</TooltipContent>}
            </Tooltip>
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        {isOffline && (
          <Alert className="rounded-2xl border-warning/40 bg-warning-muted text-warning-foreground">
            <WifiOff />
            <AlertTitle>离线 · 显示最近已知内容</AlertTitle>
            <AlertDescription className="text-warning-foreground/80">部分操作（新建、导入、打开未缓存文档）在离线时不可用</AlertDescription>
          </Alert>
        )}
      </div>

      <main className="flex-1 px-6 py-6">
        {demoState === "loading" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="gap-0 overflow-hidden py-0">
                <Skeleton className="aspect-video w-full rounded-none" />
                <div className="flex flex-col gap-2 p-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </Card>
            ))}
          </div>
        ) : demoState === "error" ? (
          <Empty className="mx-auto max-w-md">
            <EmptyMedia variant="icon"><TriangleAlert className="text-destructive" /></EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>文档列表加载失败</EmptyTitle>
              <EmptyDescription>请检查网络连接后重试</EmptyDescription>
            </EmptyHeader>
            <EmptyContent><Button onClick={() => setDemoState("default")}>重试</Button></EmptyContent>
          </Empty>
        ) : demoState === "empty" ? (
          <Empty className="mx-auto max-w-md">
            <EmptyMedia variant="icon"><FolderOpen /></EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>这里还没有任何文档</EmptyTitle>
              <EmptyDescription>新建一份幻灯片，或导入已有的 .pptx 文件开始</EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row">
              <Button onClick={() => navigate("/editor")}><Plus /> 新建空白文档</Button>
              <Button variant="outline" onClick={() => toast("已导入 .pptx（演示）")}><FileUp /> 导入 .pptx</Button>
            </EmptyContent>
          </Empty>
        ) : demoState === "shared-empty" ? (
          <Empty className="mx-auto max-w-md">
            <EmptyMedia variant="icon"><Users /></EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>还没有人与你共享文档</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : list.length === 0 ? (
          <Empty className="mx-auto max-w-md">
            <EmptyMedia variant="icon"><Search /></EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>没有找到与"{query || "预算"}"相关的文档</EmptyTitle>
              <EmptyDescription>检查拼写，或尝试其他关键词</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((doc) => (
              <DocumentCardView key={doc.id} doc={doc} onOpen={() => navigate("/editor")} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function DocumentCardView({ doc, onOpen }: { doc: (typeof documentList)[number]; onOpen: () => void }) {
  const kind = doc.id === "d-1" ? "title" : doc.id === "d-2" ? "two-content" : doc.id === "d-3" ? "title-content" : "title-only"
  const shown = collaborators.filter((c) => !c.isSelf).slice(0, (doc.collaboratorCount ?? 1) - 1)
  return (
    <Card className="group gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`打开 ${doc.title}`}>
        {doc.hasCover === false ? (
          <NoCoverPlaceholder className="rounded-none border-b border-foreground/5" />
        ) : (
          <MiniSlide kind={kind} className="rounded-none border-b border-foreground/5" />
        )}
      </button>
      <div className="flex flex-col gap-2 p-3">
        <button type="button" onClick={onOpen} className="truncate text-left text-sm font-semibold hover:underline">{doc.title}</button>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-xs text-muted-foreground tabular-nums">{doc.ownerLabel} · {doc.timeLabel}</span>
            {doc.viewOnly && <Badge variant="outline" className="shrink-0">仅查看</Badge>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {doc.collaboratorCount && doc.collaboratorCount > 1 && (
              <AvatarGroup>
                {shown.map((c) => (
                  <Avatar key={c.id} size="sm" className={`ring-2 ring-offset-1 ring-offset-background ${c.presence ? presenceRing[c.presence] : "ring-border"}`}>
                    <AvatarFallback className="bg-muted text-foreground">{c.initial}</AvatarFallback>
                  </Avatar>
                ))}
                {doc.collaboratorCount > shown.length + 1 && <AvatarGroupCount className="size-6 text-xs">+{doc.collaboratorCount - shown.length - 1}</AvatarGroupCount>}
              </AvatarGroup>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" aria-label="更多操作"><MoreHorizontal /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => toast("重命名")}>重命名</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toast("分享设置：见“分享与权限”路由")}>分享</DropdownMenuItem>
                {!doc.viewOnly && (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => toast(`已移动到回收站：${doc.title}`, { action: { label: "撤销", onClick: () => toast.success("已撤销") } })}
                  >
                    移动到回收站
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => toast("已创建副本")}>查看副本</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </Card>
  )
}
