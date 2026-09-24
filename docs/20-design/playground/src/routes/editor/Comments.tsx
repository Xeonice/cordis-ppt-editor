import { useMemo, useState } from "react"
import { AtSign, Check, MessageSquare, Send } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  AppBar, CommentPin, DesignBar, EditorShell, Inspector, PresenceStack, SlideCanvas, SlideContent, StatusBar,
  StatusText, ThumbnailRail,
} from "@/components/editor"
import { EditorRibbon } from "@/components/editor/Ribbon"
import type { RibbonTabValue } from "@/components/editor/Ribbon"
import { collaboratorById, collaborators, commentThreads, documentTitle, slides, type CommentThread } from "@/lib/mock-data"

type DemoState = "default" | "empty" | "loading" | "error" | "detached"
type FilterKey = "all" | "page" | "unresolved" | "mentions" | "detached"

const stateOptions = [
  { value: "default", label: "默认（有评论）" },
  { value: "detached", label: "已脱离锚点筛选" },
  { value: "empty", label: "空（无评论）" },
  { value: "loading", label: "加载中" },
  { value: "error", label: "加载失败" },
]

export function EditorComments() {
  const [demoState, setDemoState] = useState<DemoState>("default")
  const [ribbonTab, setRibbonTab] = useState<RibbonTabValue>("home")
  const [filter, setFilter] = useState<FilterKey>(demoState === "detached" ? "detached" : "all")
  const [currentSlideId, setCurrentSlideId] = useState(slides[2]!.id)
  const [draft, setDraft] = useState("")
  const [mentionOpen, setMentionOpen] = useState(false)
  const [expandedResolved, setExpandedResolved] = useState<Set<string>>(new Set())
  const [threads, setThreads] = useState<CommentThread[]>(commentThreads)

  const currentSlide = slides.find((s) => s.id === currentSlideId) ?? slides[0]!
  const detachedCount = threads.filter((t) => t.detachedAnchor).length

  function handleRestoreAnchor(id: string) {
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, detachedAnchor: false, anchorLabel: t.restoredAnchorLabel ?? t.anchorLabel } : t)))
    toast("元素已以原 id 恢复，评论已回到原锚点")
  }

  const filtered = useMemo(() => {
    return threads.filter((t) => {
      if (filter === "page") return t.slideIndex === currentSlide.index
      if (filter === "unresolved") return !t.resolved
      if (filter === "mentions") return t.mentionsMe
      if (filter === "detached") return t.detachedAnchor
      return true
    })
  }, [filter, currentSlide.index, threads])

  function handleStateChange(v: string) {
    setDemoState(v as DemoState)
    if (v === "detached") setFilter("detached")
    else if (filter === "detached") setFilter("all")
  }

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar title="评论" spec="03-screens/06" state={demoState} onStateChange={handleStateChange} stateOptions={stateOptions} />
      <EditorShell
        appBar={<AppBar title={documentTitle} collaborators={collaborators.filter((c) => !c.isSelf)} status={{ kind: "sync", state: "synced" }} />}
        ribbon={<EditorRibbon value={ribbonTab} onValueChange={setRibbonTab} currentMasterId={currentSlide.masterId} currentLayoutId={currentSlide.layoutId} onAddComment={() => toast("已在画布添加评论锚点")} />}
        thumbnailRail={<ThumbnailRail mode="normal" slides={slides} currentSlideId={currentSlideId} onSelectSlide={setCurrentSlideId} />}
        canvas={
          <SlideCanvas>
            <SlideContent slide={currentSlide} fill />
            {threads.filter((t) => t.slideIndex === currentSlide.index && !t.detachedAnchor).map((t) => (
              <CommentPin key={t.id} x={130 + t.number * 90} y={130} number={t.number} resolved={t.resolved} onClick={() => toast(`定位到评论 #${t.number}`)} />
            ))}
          </SlideCanvas>
        }
        inspector={
          <Inspector
            value="comments"
            onValueChange={() => {}}
            tabs={[{
              value: "comments", label: "评论", badge: threads.filter((t) => !t.resolved).length, content: (
                <CommentsBody
                  demoState={demoState}
                  filter={filter}
                  onFilterChange={setFilter}
                  threads={filtered}
                  detachedCount={detachedCount}
                  onRestoreAnchor={handleRestoreAnchor}
                  expandedResolved={expandedResolved}
                  onToggleResolvedExpand={(id) => setExpandedResolved((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })}
                  draft={draft}
                  onDraftChange={setDraft}
                  mentionOpen={mentionOpen}
                  onMentionOpenChange={setMentionOpen}
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

const filterDefs: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "page", label: "当前页" },
  { key: "unresolved", label: "未解决" },
  { key: "mentions", label: "@我" },
]

function CommentsBody({
  demoState,
  filter,
  onFilterChange,
  threads,
  detachedCount,
  onRestoreAnchor,
  expandedResolved,
  onToggleResolvedExpand,
  draft,
  onDraftChange,
  mentionOpen,
  onMentionOpenChange,
}: {
  demoState: DemoState
  filter: FilterKey
  onFilterChange: (f: FilterKey) => void
  threads: CommentThread[]
  detachedCount: number
  onRestoreAnchor: (id: string) => void
  expandedResolved: Set<string>
  onToggleResolvedExpand: (id: string) => void
  draft: string
  onDraftChange: (v: string) => void
  mentionOpen: boolean
  onMentionOpenChange: (v: boolean) => void
}) {
  if (demoState === "loading") {
    return (
      <div className="flex flex-col gap-3 p-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-2"><Skeleton className="size-6 shrink-0 rounded-full" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-full" /></div></div>
        ))}
      </div>
    )
  }
  if (demoState === "error") {
    return (
      <div className="p-4">
        <Empty><EmptyMedia variant="icon"><MessageSquare /></EmptyMedia><EmptyHeader><EmptyTitle className="text-sm">评论加载失败</EmptyTitle></EmptyHeader><Button size="sm" variant="outline">重试</Button></Empty>
      </div>
    )
  }
  if (demoState === "empty") {
    return (
      <div className="p-4">
        <Empty>
          <EmptyMedia variant="icon"><MessageSquare /></EmptyMedia>
          <EmptyHeader><EmptyTitle className="text-sm">还没有任何评论</EmptyTitle><EmptyDescription>选中对象后点击"添加批注"开始讨论</EmptyDescription></EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-1.5 border-b border-foreground/5 p-2">
        {filterDefs.map((f) => (
          <Button key={f.key} type="button" variant={filter === f.key ? "secondary" : "ghost"} size="xs" aria-pressed={filter === f.key} onClick={() => onFilterChange(f.key)}>
            {f.label}
          </Button>
        ))}
        {detachedCount > 0 && (
          <Button type="button" variant={filter === "detached" ? "secondary" : "ghost"} size="xs" aria-pressed={filter === "detached"} onClick={() => onFilterChange("detached")}>
            脱离锚点 {detachedCount}
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col divide-y divide-foreground/5">
          {threads.map((t) => (
            <ThreadRow key={t.id} thread={t} expanded={!t.resolved || expandedResolved.has(t.id)} onToggleExpand={() => onToggleResolvedExpand(t.id)} onRestoreAnchor={() => onRestoreAnchor(t.id)} />
          ))}
          {threads.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">此筛选条件下没有评论</p>}
        </div>
      </ScrollArea>
      <div className="border-t border-foreground/5 p-2">
        <div className="flex items-start gap-2">
          <PresenceStack people={[collaboratorById("me")]} max={1} size="sm" />
          <Popover open={mentionOpen} onOpenChange={onMentionOpenChange}>
            <PopoverAnchor asChild>
              <Textarea
                value={draft}
                onChange={(e) => { onDraftChange(e.target.value); onMentionOpenChange(e.target.value.endsWith("@")) }}
                placeholder="写评论，输入 @ 可提及协作者…"
                aria-label="写评论"
                className="min-h-16 flex-1 resize-none text-xs"
              />
            </PopoverAnchor>
            <PopoverContent align="start" className="w-48 p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
              <Command>
                <CommandList>
                  <CommandGroup heading="提及协作者">
                    {collaborators.filter((c) => !c.isSelf).map((c) => (
                      <CommandItem key={c.id} onSelect={() => { onDraftChange(draft + c.name + " "); onMentionOpenChange(false) }}>
                        <AtSign className="size-3.5" /> {c.name} <span className="ml-auto text-xs text-muted-foreground">{c.role === "editor" ? "编辑者" : "评审者"}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="mt-1.5 flex justify-end">
          <Button size="xs" disabled={!draft.trim()} onClick={() => { onDraftChange(""); toast("已发送评论") }}><Send /> 发送</Button>
        </div>
      </div>
    </div>
  )
}

function ThreadRow({ thread, expanded, onToggleExpand, onRestoreAnchor }: { thread: CommentThread; expanded: boolean; onToggleExpand: () => void; onRestoreAnchor: () => void }) {
  const author = collaboratorById(thread.authorId)
  if (!expanded) {
    return (
      <button type="button" onClick={onToggleExpand} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/50">
        <span className="text-muted-foreground">#{thread.number}</span>
        <span className="truncate text-muted-foreground">第 {thread.slideIndex} 页 · {thread.anchorLabel}</span>
        <Badge variant="outline" className="ml-auto shrink-0 text-2xs text-success-foreground"><Check className="size-3" aria-hidden="true" />已解决</Badge>
      </button>
    )
  }
  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 text-xs">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="font-medium text-foreground">#{thread.number}</span>
        第 {thread.slideIndex} 页 · {thread.anchorLabel}
        {thread.detachedAnchor && <Badge variant="outline" className="text-2xs text-warning-foreground">原对象已删除</Badge>}
      </div>
      <div className="flex items-start gap-2">
        <PresenceStack people={[author]} max={1} size="sm" />
        <div className="flex-1">
          <p className="font-medium">{author.name} <span className="font-normal text-muted-foreground">· {thread.time}</span></p>
          <p className="mt-0.5 text-foreground">{thread.body}</p>
        </div>
      </div>
      {thread.replies?.map((r) => {
        const ra = collaboratorById(r.authorId)
        return (
          <div key={r.id} className="ml-3 flex items-start gap-2 border-l border-foreground/10 pl-3">
            <PresenceStack people={[ra]} max={1} size="sm" />
            <div className="flex-1">
              <p className="font-medium">{ra.name} <span className="font-normal text-muted-foreground">· {r.time}</span></p>
              <p className="mt-0.5 text-foreground">{r.body}</p>
            </div>
          </div>
        )
      })}
      <div className="flex items-center gap-3 pt-1">
        <Button variant="link" size="xs" className="h-auto p-0" onClick={() => toast("回复框已聚焦")}>回复…</Button>
        <Button variant="link" size="xs" className="h-auto p-0 text-muted-foreground" onClick={() => toast(thread.resolved ? "已重新打开" : "已标记为已解决")}>
          {thread.resolved ? "重新打开" : "标记已解决"}
        </Button>
        {thread.detachedAnchor && (
          <Button variant="outline" size="xs" className="h-auto py-1" onClick={onRestoreAnchor}>恢复元素（含我的编辑）</Button>
        )}
      </div>
    </div>
  )
}
