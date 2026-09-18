import { useMemo, useState } from "react"
import { History as HistoryIcon, Lock, Star, TriangleAlert, WifiOff } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AppBar, DesignBar, EditorShell, Inspector, SlideCanvas, SlideContent, StatusBar, StatusText, ThumbnailRail } from "@/components/editor"
import { EditorRibbon } from "@/components/editor/Ribbon"
import type { RibbonTabValue } from "@/components/editor/Ribbon"
import { collaboratorById, collaborators, documentTitle, slides, versionHistory } from "@/lib/mock-data"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

type DemoState = "default" | "empty" | "loading" | "error" | "readonly" | "offline"

const stateOptions = [
  { value: "default", label: "默认（有历史）" },
  { value: "empty", label: "空（新文档）" },
  { value: "loading", label: "加载中" },
  { value: "error", label: "加载失败" },
  { value: "readonly", label: "只能查看，不能恢复" },
  { value: "offline", label: "离线" },
]

export function EditorHistory() {
  const [demoState, setDemoState] = useState<DemoState>("default")
  const [ribbonTab, setRibbonTab] = useState<RibbonTabValue>("home")
  const [selectedId, setSelectedId] = useState(versionHistory[0]!.id)
  const [nameOpen, setNameOpen] = useState(false)
  const [versionName, setVersionName] = useState("")
  const currentSlide = slides[0]!

  const grouped = useMemo(() => {
    const days: { day: string; entries: typeof versionHistory }[] = []
    for (const v of versionHistory) {
      let g = days.find((d) => d.day === v.day)
      if (!g) { g = { day: v.day, entries: [] }; days.push(g) }
      g.entries.push(v)
    }
    return days
  }, [])

  const selected = versionHistory.find((v) => v.id === selectedId) ?? versionHistory[0]!
  const canRestore = demoState !== "readonly"

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar title="版本历史" spec="03-screens/07" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} />
      <EditorShell
        appBar={<AppBar title={documentTitle} collaborators={collaborators.filter((c) => !c.isSelf)} status={{ kind: "sync", state: "synced" }} />}
        ribbon={<EditorRibbon value={ribbonTab} onValueChange={setRibbonTab} currentMasterId={currentSlide.masterId} currentLayoutId={currentSlide.layoutId} />}
        thumbnailRail={<ThumbnailRail mode="normal" slides={slides} currentSlideId={currentSlide.id} />}
        canvas={
          <SlideCanvas hideZoomBar>
            <SlideContent slide={slides[0]!} fill />
          </SlideCanvas>
        }
        inspectorWidth={560}
        inspector={
          <Inspector
            value="history"
            onValueChange={() => {}}
            tabs={[{
              value: "history", label: "历史", content: (
                <HistoryBody
                  demoState={demoState}
                  grouped={grouped}
                  selected={selected}
                  onSelect={setSelectedId}
                  canRestore={canRestore}
                  nameOpen={nameOpen}
                  onNameOpenChange={setNameOpen}
                  versionName={versionName}
                  onVersionNameChange={setVersionName}
                />
              ),
            }]}
          />
        }
        statusBar={<StatusBar left={[`第 ${currentSlide.index}/${slides.length} 页`]} right={[<StatusText key="s" status={{ kind: "sync", state: "synced" }} variant="dot" />]} />}
      />
    </div>
  )
}

function HistoryBody({
  demoState,
  grouped,
  selected,
  onSelect,
  canRestore,
  nameOpen,
  onNameOpenChange,
  versionName,
  onVersionNameChange,
}: {
  demoState: DemoState
  grouped: { day: string; entries: typeof versionHistory }[]
  selected: (typeof versionHistory)[number]
  onSelect: (id: string) => void
  canRestore: boolean
  nameOpen: boolean
  onNameOpenChange: (v: boolean) => void
  versionName: string
  onVersionNameChange: (v: string) => void
}) {
  if (demoState === "loading") {
    return (
      <div className="flex h-full">
        <div className="flex w-44 shrink-0 flex-col gap-2 border-r border-foreground/5 p-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
        <div className="flex-1 p-4"><Skeleton className="aspect-video w-full animate-pulse" /></div>
      </div>
    )
  }
  if (demoState === "error") {
    return (
      <Empty className="flex-1">
        <EmptyMedia variant="icon"><TriangleAlert className="text-destructive" /></EmptyMedia>
        <EmptyHeader><EmptyTitle>版本历史加载失败</EmptyTitle></EmptyHeader>
        <Button variant="outline" size="sm">重试</Button>
      </Empty>
    )
  }
  if (demoState === "offline") {
    return (
      <div className="p-3">
        <Alert className="border-warning/40 bg-warning-muted text-warning-foreground"><WifiOff /><AlertDescription className="text-warning-foreground/80">离线时无法加载版本历史，仅显示本地最近编辑状态</AlertDescription></Alert>
      </div>
    )
  }
  if (demoState === "empty") {
    return (
      <Empty className="flex-1">
        <EmptyMedia variant="icon"><HistoryIcon /></EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>尚无历史记录</EmptyTitle>
          <EmptyDescription>继续编辑后将自动生成版本快照</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex h-full">
      <ScrollArea className="w-44 shrink-0 border-r border-foreground/5">
        <div className="flex flex-col gap-3 p-2">
          {grouped.map((g) => (
            <div key={g.day}>
              <p className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">{g.day}</p>
              <div className="flex flex-col gap-0.5">
                {g.entries.map((v) => {
                  const author = collaboratorById(v.authorId)
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onSelect(v.id)}
                      aria-pressed={v.id === selected.id}
                      className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs ${v.id === selected.id ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
                    >
                      {v.named ? <Star className="size-3 shrink-0 fill-warning text-warning" /> : <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground" />}
                      <span className="truncate">{v.named ? v.name : v.time}</span>
                      <Avatar size="sm" className="ml-auto size-5 shrink-0"><AvatarFallback className="text-2xs">{author.initial}</AvatarFallback></Avatar>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex items-center justify-center rounded-md border bg-muted/20 p-4">
          <SlideContent slide={slides[1]!} className="w-full max-w-xs rounded border shadow-sm" />
        </div>
        <p className="text-center text-[11px] text-muted-foreground">{selected.named ? selected.name : `自动快照 · ${selected.time}`} · {collaboratorById(selected.authorId).name}</p>
        <div className="mt-auto flex flex-col gap-2">
          <Popover open={nameOpen} onOpenChange={onNameOpenChange}>
            <PopoverTrigger asChild><Button variant="outline" size="sm" disabled={!canRestore}>命名当前版本</Button></PopoverTrigger>
            <PopoverContent className="w-64">
              <Field>
                <FieldLabel htmlFor="version-name">版本名称</FieldLabel>
                <Input id="version-name" value={versionName} onChange={(e) => onVersionNameChange(e.target.value)} maxLength={30} placeholder="例如：提案定稿" />
              </Field>
              <Button size="sm" className="mt-2 w-full" onClick={() => { onNameOpenChange(false); toast(`已命名当前版本为「${versionName || "未命名"}」`) }}>确定</Button>
            </PopoverContent>
          </Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full" disabled={!canRestore}>恢复此版本</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>恢复到"{selected.named ? selected.name : selected.time}"？</AlertDialogTitle>
                      <AlertDialogDescription>将创建一个新版本，当前更改不会丢失。若有协作者正在编辑，他们的画布将自动更新为恢复后的内容。</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => toast("已恢复到所选版本")}>确认恢复</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </span>
            </TooltipTrigger>
            {!canRestore && <TooltipContent className="flex items-center gap-1"><Lock className="size-3" /> 需要编辑权限</TooltipContent>}
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
