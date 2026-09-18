import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ChevronLeft, ChevronRight, Info, Loader2, MoreHorizontal, Square, X,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DesignBar } from "@/components/editor"
import { SlideContent } from "@/components/editor/SlideContent"
import { collaboratorById, slides } from "@/lib/mock-data"

type DemoState = "default" | "loading" | "slide-error" | "following" | "black" | "white"

const stateOptions = [
  { value: "default", label: "默认（移动鼠标显示控制条）" },
  { value: "loading", label: "正在进入放映" },
  { value: "slide-error", label: "单页渲染失败" },
  { value: "following", label: "协同跟随（观众端）" },
  { value: "black", label: "黑屏" },
  { value: "white", label: "白屏" },
]

export function Present() {
  const navigate = useNavigate()
  const [demoState, setDemoState] = useState<DemoState>("default")
  const [index, setIndex] = useState(1)
  const [showChrome, setShowChrome] = useState(true)
  const hideTimer = useRef<number | undefined>(undefined)

  const total = slides.length
  const current = slides[index - 1] ?? slides[0]!
  const presenter = collaboratorById("wang")

  const scheduleHide = useCallback(() => {
    setShowChrome(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setShowChrome(false), 2600)
  }, [])

  useEffect(() => {
    scheduleHide()
    return () => window.clearTimeout(hideTimer.current)
  }, [scheduleHide])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") setIndex((i) => Math.min(total, i + 1))
      else if (e.key === "ArrowLeft" || e.key === "PageUp") setIndex((i) => Math.max(1, i - 1))
      else if (e.key === "Home") setIndex(1)
      else if (e.key === "End") setIndex(total)
      else if (e.key === "Escape") navigate("/editor")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [total, navigate])

  return (
    <div className="flex h-dvh flex-col">
      <DesignBar title="放映" spec="03-screens/11" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} />
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden bg-stage"
        onMouseMove={scheduleHide}
        role="application"
        aria-label="放映舞台"
      >
        {demoState === "loading" ? (
          <div className="flex flex-col items-center gap-3 text-stage-foreground/70">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm">正在进入放映…</p>
          </div>
        ) : demoState === "black" ? (
          <p className="sr-only">黑屏</p>
        ) : demoState === "white" ? (
          <div className="absolute inset-0 bg-white" />
        ) : demoState === "slide-error" ? (
          <div className="flex flex-col items-center gap-3 text-stage-foreground/80">
            <p className="text-sm">此页内容暂时无法显示</p>
          </div>
        ) : (
          <div className="aspect-video w-[min(92vw,92vh*16/9)] overflow-hidden rounded-sm shadow-2xl">
            <SlideContent slide={current} className="rounded-none" />
          </div>
        )}

        {demoState === "following" && (
          <div className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-stage-chrome/80 px-3 py-1.5 text-xs text-stage-foreground shadow-lg backdrop-blur-lg">
            <Info className="size-3.5" /> 正在跟随 {presenter.name}
            <button type="button" className="ml-1 underline underline-offset-2">返回同步</button>
          </div>
        )}

        {demoState !== "loading" && (showChrome || demoState === "black" || demoState === "white") && (
          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-stage-chrome/80 px-2 py-1.5 shadow-lg backdrop-blur-lg">
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="上一页" onClick={() => setIndex((i) => Math.max(1, i - 1))} disabled={index === 1} className="flex size-9 items-center justify-center rounded-full text-stage-foreground hover:bg-white/10 disabled:opacity-30">
                    <ChevronLeft />
                  </button>
                </TooltipTrigger>
                <TooltipContent>上一页</TooltipContent>
              </Tooltip>
              <span className="min-w-12 text-center text-xs tabular-nums text-stage-foreground">{index} / {total}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="下一页" onClick={() => setIndex((i) => Math.min(total, i + 1))} disabled={index === total} className="flex size-9 items-center justify-center rounded-full text-stage-foreground hover:bg-white/10 disabled:opacity-30">
                    <ChevronRight />
                  </button>
                </TooltipTrigger>
                <TooltipContent>下一页</TooltipContent>
              </Tooltip>
            </div>

            <span aria-hidden="true" className="h-5 w-px shrink-0 bg-white/10" />

            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="黑屏" onClick={() => setDemoState(demoState === "black" ? "default" : "black")} className="flex size-9 items-center justify-center rounded-full text-stage-foreground hover:bg-white/10">
                    <Square className="size-4 fill-current" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>黑屏（B）</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label="更多" className="flex size-9 items-center justify-center rounded-full text-stage-foreground hover:bg-white/10"><MoreHorizontal /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top">
                  <DropdownMenuItem onSelect={() => setDemoState("white")}>白屏</DropdownMenuItem>
                  <DropdownMenuItem>跳至页码…</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <span aria-hidden="true" className="h-5 w-px shrink-0 bg-white/10" />

            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="退出放映" onClick={() => navigate("/editor")} className="flex size-9 items-center justify-center rounded-full text-stage-foreground hover:bg-white/10">
                  <X />
                </button>
              </TooltipTrigger>
              <TooltipContent>退出（Esc）</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  )
}
