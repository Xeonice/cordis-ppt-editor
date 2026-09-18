import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ChevronLeft, ChevronRight, Download, Info, Maximize, Minus, Plus, Search, StickyNote, TriangleAlert,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DesignBar, SlideCanvas, SlideContent } from "@/components/editor"
import { MiniSlide } from "@/components/editor/MiniSlide"
import type { ZoomValue } from "@/components/editor/SlideCanvas"
import { cn } from "@/lib/utils"
import { slides } from "@/lib/mock-data"

type DemoState = "default" | "loading" | "error" | "summary"

const stateOptions = [
  { value: "default", label: "默认" },
  { value: "summary", label: "保真摘要卡片" },
  { value: "loading", label: "加载中" },
  { value: "error", label: "打开失败" },
]

/**
 * 宿主选项（Q18 / PRD OF-14）：preset-slide-viewer 初始化参数 `thumbnails` / `notes`，默认全关；
 * 关时对应 UI 不渲染，代码按需加载（不计入 350 KB 基线）。DesignBar 里的两个开关模拟宿主传参。
 */
interface HostOptions {
  thumbnails: boolean
  notes: boolean
}

/** 备注样例：真实实现由宿主开启 `notes` 后按需加载；只给部分页面配备注以演示"本页没有备注"。 */
const viewerNotes: Record<string, string> = {
  "sl-1": "开场 30 秒：先讲结论——Q2 超额完成，再展开收入、产品、客户三条主线。",
  "sl-2": "强调 18% 增速是在渠道投入持平的前提下取得的；毛利率数据口径与财务一致。",
  "sl-7": "对比页只停留 20 秒，重点落在 Q2 毛利率提升 2 个百分点的原因。",
  "sl-12": "致谢后留 5 分钟答疑。",
}

export function Viewer() {
  const navigate = useNavigate()
  const [demoState, setDemoState] = useState<DemoState>("default")
  const [host, setHost] = useState<HostOptions>({ thumbnails: false, notes: false })
  const [index, setIndex] = useState(1)
  const [zoom, setZoom] = useState<ZoomValue>("fit")
  const [effectiveZoom, setEffectiveZoom] = useState(100)
  const [notesOpen, setNotesOpen] = useState(false)
  const total = slides.length
  const current = slides[index - 1] ?? slides[0]!

  const hostControls = (
    <div className="flex items-center gap-3 rounded-full bg-foreground/5 px-3 py-1 text-xs text-muted-foreground">
      <span className="font-medium">宿主选项</span>
      <label className="flex items-center gap-1.5">
        <Switch size="sm" checked={host.thumbnails} onCheckedChange={(v) => setHost((h) => ({ ...h, thumbnails: v }))} aria-label="宿主选项 thumbnails" />
        <code className="font-mono">thumbnails</code>
      </label>
      <label className="flex items-center gap-1.5">
        <Switch size="sm" checked={host.notes} onCheckedChange={(v) => { setHost((h) => ({ ...h, notes: v })); if (!v) setNotesOpen(false) }} aria-label="宿主选项 notes" />
        <code className="font-mono">notes</code>
      </label>
    </div>
  )

  if (demoState === "error") {
    return (
      <div className="flex h-dvh flex-col bg-canvas">
        <DesignBar title="只读查看器" spec="03-screens/25" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} extra={hostControls} />
        <Empty className="flex-1">
          <EmptyMedia variant="icon"><TriangleAlert className="text-destructive" /></EmptyMedia>
          <EmptyHeader><EmptyTitle>无法打开该文档</EmptyTitle><EmptyDescription>不支持的文件格式，或文档已损坏</EmptyDescription></EmptyHeader>
          <Button variant="outline"><Download /> 下载原文件</Button>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar
        title="只读查看器"
        spec="03-screens/25"
        state={demoState}
        onStateChange={(v) => setDemoState(v as DemoState)}
        stateOptions={stateOptions}
        extra={<>{hostControls}<Button variant="ghost" size="sm" onClick={() => navigate("/documents")}>退出查看器</Button></>}
      />
      <div className="glass-strong mx-2 mt-2 flex h-11 shrink-0 items-center gap-1 rounded-2xl px-3">
        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="上一页" disabled={index === 1} onClick={() => setIndex((i) => i - 1)}><ChevronLeft /></Button></TooltipTrigger><TooltipContent>上一页</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="下一页" disabled={index === total} onClick={() => setIndex((i) => i + 1)}><ChevronRight /></Button></TooltipTrigger><TooltipContent>下一页</TooltipContent></Tooltip>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Input value={index} onChange={(e) => { const n = Number(e.target.value); if (n >= 1 && n <= total) setIndex(n) }} className="h-7 w-10 rounded-full text-center tabular-nums" aria-label="跳转到页码" />
          <span className="tabular-nums">/ {total}</span>
        </div>
        <div className="mx-2 h-5 w-px bg-foreground/10" />
        <Button variant="ghost" size="icon-sm" aria-label="缩小" onClick={() => setZoom(Math.max(10, effectiveZoom - 10))}><Minus /></Button>
        <span className="w-10 rounded-full bg-muted py-0.5 text-center text-xs tabular-nums text-muted-foreground">{effectiveZoom}%</span>
        <Button variant="ghost" size="icon-sm" aria-label="放大" onClick={() => setZoom(Math.min(400, effectiveZoom + 10))}><Plus /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="全屏"><Maximize /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="搜索"><Search /></Button>
        {host.notes && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="备注" aria-pressed={notesOpen} onClick={() => setNotesOpen((v) => !v)} className={cn(notesOpen && "bg-muted text-foreground")}>
                <StickyNote />
              </Button>
            </TooltipTrigger>
            <TooltipContent>备注</TooltipContent>
          </Tooltip>
        )}
        <Popover open={demoState === "summary"} onOpenChange={() => setDemoState("default")}>
          <PopoverTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="导入摘要"><Info /></Button></PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <p className="mb-2 text-sm font-medium">导入摘要</p>
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              <li>2 处内容已按原样保留</li>
              <li>1 种缺失字体已替代</li>
            </ul>
            <Button variant="link" size="xs" className="mt-2 h-auto p-0" onClick={() => navigate("/import")}>查看详情</Button>
          </PopoverContent>
        </Popover>
      </div>
      {demoState === "loading" ? (
        <div className="flex flex-1 items-center justify-center"><Skeleton className="aspect-video w-2/3 animate-pulse" /></div>
      ) : (
        <SlideCanvas zoom={zoom} onZoomChange={setZoom} onEffectiveZoomChange={setEffectiveZoom} hideZoomBar>
          <SlideContent slide={current} fill />
        </SlideCanvas>
      )}

      {host.thumbnails && <ThumbnailStrip index={index} onSelect={setIndex} />}

      {host.notes && (
        <Sheet open={notesOpen} onOpenChange={setNotesOpen} modal={false}>
          <SheetContent side="right" className="w-80 gap-0 p-0" onInteractOutside={(e) => e.preventDefault()}>
            <SheetHeader className="border-b border-foreground/5 px-4 py-3">
              <SheetTitle>备注 · 第 {current.index} 页</SheetTitle>
              <SheetDescription className="truncate text-xs">{current.title}</SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-1">
              <div className="px-4 py-3 text-sm leading-relaxed">
                {viewerNotes[current.id] ?? <span className="text-muted-foreground">本页没有备注</span>}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

/** 可选缩略图条（宿主 `thumbnails`）：底部横向小缩略图，点选跳页；当前页保持在可视区。 */
function ThumbnailStrip({ index, onSelect }: { index: number; onSelect: (index: number) => void }) {
  const activeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [index])
  return (
    <div role="listbox" aria-label="幻灯片缩略图" className="glass-strong mx-2 mb-2 flex h-20 shrink-0 items-center gap-2.5 overflow-x-auto rounded-2xl px-3">
      {slides.map((s) => {
        const active = s.index === index
        return (
          <button
            key={s.id}
            ref={active ? activeRef : undefined}
            type="button"
            role="option"
            aria-selected={active}
            aria-label={`第 ${s.index} 页 · ${s.title}`}
            onClick={() => onSelect(s.index)}
            className={cn(
              "relative w-24 shrink-0 rounded-lg outline-none",
              active ? "ring-2 ring-primary ring-offset-2 ring-offset-transparent" : "ring-1 ring-border hover:ring-ring",
              "focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <MiniSlide kind={s.kind} />
            <span className="absolute bottom-0.5 left-1.5 text-2xs tabular-nums text-doc-ink/60" aria-hidden="true">{s.index}</span>
          </button>
        )
      })}
    </div>
  )
}
