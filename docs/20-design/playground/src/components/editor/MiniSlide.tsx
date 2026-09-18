import { ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LayoutKind } from "@/lib/mock-data"

/**
 * 幻灯片内容的极简抽象缩略：用条块示意标题/正文/图片位置，不追求像素级还原。
 * 用于缩略图栏、版式画廊、母版缩略图窗格缩略图、设计页签主题卡片等一切"小幻灯片"场景。
 * 遵循 09 §6.2：内部条块的位置用相对（%）与 Tailwind 任意值类，不使用 style={{}}。
 */
export function MiniSlide({ kind, className }: { kind: LayoutKind; className?: string }) {
  return (
    <div className={cn("relative aspect-video w-full overflow-hidden rounded-[inherit] bg-doc-paper", className)}>
      <div className="absolute inset-[8%] flex flex-col gap-[6%]">{renderContent(kind)}</div>
    </div>
  )
}

function Bar({ className }: { className?: string }) {
  return <div className={cn("shrink-0 rounded-full bg-doc-ink/80", className)} />
}
function Line({ className }: { className?: string }) {
  return <div className={cn("h-[12%] w-full shrink-0 rounded-full bg-doc-ink/20", className)} />
}

function renderContent(kind: LayoutKind) {
  switch (kind) {
    case "title":
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-[10%]">
          <Bar className="h-[16%] w-[72%]" />
          <div className="h-[8%] w-[42%] rounded-full bg-doc-ink/30" />
        </div>
      )
    case "title-content":
      return (
        <>
          <Bar className="h-[16%] w-[55%]" />
          <div className="flex flex-1 flex-col justify-center gap-[14%]">
            <Line className="w-full" />
            <Line className="w-[88%]" />
            <Line className="w-[70%]" />
          </div>
        </>
      )
    case "two-content":
      return (
        <>
          <Bar className="h-[16%] w-[50%]" />
          <div className="flex flex-1 gap-[6%]">
            <div className="flex flex-1 flex-col justify-center gap-[14%]">
              <Line />
              <Line className="w-[80%]" />
              <Line className="w-[60%]" />
            </div>
            <div className="flex flex-1 flex-col justify-center gap-[14%]">
              <Line />
              <Line className="w-[85%]" />
              <Line className="w-[65%]" />
            </div>
          </div>
        </>
      )
    case "comparison":
      return (
        <>
          <Bar className="h-[14%] w-[45%]" />
          <div className="flex flex-1 gap-[6%]">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-1 flex-col gap-[10%]">
                <div className="h-[10%] w-[65%] rounded-full bg-doc-ink/45" />
                <Line />
                <Line className="w-[75%]" />
              </div>
            ))}
          </div>
        </>
      )
    case "title-only":
      return (
        <>
          <Bar className="h-[16%] w-[55%]" />
          <div className="flex-1" />
        </>
      )
    case "section-header":
      return (
        <div className="flex flex-1 flex-col items-start justify-center gap-[8%]">
          <div className="h-[6%] w-[16%] rounded-full bg-primary/70" />
          <Bar className="h-[18%] w-[78%]" />
        </div>
      )
    case "picture-caption":
      return (
        <div className="flex flex-1 gap-[6%]">
          <div className="flex flex-[1.1] items-center justify-center rounded-[6%] bg-doc-ink/10">
            <ImageIcon className="size-[28%] text-doc-ink/30" aria-hidden="true" />
          </div>
          <div className="flex flex-1 flex-col justify-center gap-[14%]">
            <div className="h-[12%] w-[80%] rounded-full bg-doc-ink/50" />
            <Line className="w-full" />
            <Line className="w-[70%]" />
          </div>
        </div>
      )
    case "blank":
    default:
      return null
  }
}
