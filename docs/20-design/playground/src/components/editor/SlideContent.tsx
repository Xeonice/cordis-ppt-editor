import { ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { slideBodies, type SlideSummary } from "@/lib/mock-data"

/**
 * 真实文字内容的幻灯片渲染：用于放映舞台、只读查看器，以及没有独立选区演示的画布（分享/导出/离线/历史/版式）。
 * 与 MiniSlide（抽象条块缩略）互补：MiniSlide 用于"小幻灯片"，SlideContent 用于用户真正阅读内容的大幅面。
 * 字号用容器查询单位 cqw 随宽度缩放，位置用百分比，遵循 09 §6.2 不使用 style={{}}。
 * 文字取自 mock-data 的 slideBodies，保证舞台、画布、缩略图栏显示的是同一份样例文档。
 */
export function SlideContent({ slide, fill, className }: { slide: SlideSummary; fill?: boolean; className?: string }) {
  const body = slideBodies[slide.id] ?? []
  return (
    <section
      aria-label={`第 ${slide.index} 页：${slide.title}`}
      className={cn(
        "@container overflow-hidden bg-doc-paper text-doc-ink",
        fill ? "absolute inset-0" : "relative aspect-video w-full",
        className,
      )}
    >
      {renderKind(slide, body)}
    </section>
  )
}

function Bullets({ items, className }: { items: string[]; className?: string }) {
  if (items.length === 0) return null
  return (
    <ul className={cn("flex flex-col gap-[2.2cqw] text-[2.6cqw] leading-snug", className)}>
      {items.map((t) => (
        <li key={t} className="flex items-start gap-[1.4cqw]">
          <span aria-hidden="true" className="mt-[1.1cqw] size-[0.8cqw] shrink-0 rounded-full bg-doc-ink/60" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

function Title({ children }: { children: string }) {
  return <h2 className="absolute top-[9%] left-[8%] w-[84%] text-[4.2cqw] leading-tight font-semibold text-balance">{children}</h2>
}

function renderKind(slide: SlideSummary, body: string[]) {
  switch (slide.kind) {
    case "title":
      return (
        <div className="absolute inset-[8%] flex flex-col items-center justify-center gap-[3cqw] text-center">
          <h1 className="text-[6cqw] leading-tight font-semibold text-balance">{slide.title}</h1>
          {body[0] && <p className="text-[2.6cqw] text-doc-ink/70">{body[0]}</p>}
        </div>
      )
    case "title-content":
      return (
        <>
          <Title>{slide.title}</Title>
          <Bullets items={body} className="absolute top-[30%] left-[9%] w-[82%]" />
        </>
      )
    case "two-content":
    case "comparison": {
      const half = Math.ceil(body.length / 2)
      const cols = [body.slice(0, half), body.slice(half)]
      return (
        <>
          <Title>{slide.title}</Title>
          <div className="absolute top-[30%] left-[8%] flex w-[84%] gap-[4cqw]">
            {cols.map((items, i) => (
              <div key={i} className="flex flex-1 flex-col gap-[1.6cqw]">
                {slide.kind === "comparison" && <div className="text-[2.4cqw] font-medium text-doc-ink/70">{i === 0 ? "方案 A" : "方案 B"}</div>}
                <Bullets items={items} />
              </div>
            ))}
          </div>
        </>
      )
    }
    case "title-only":
      return <Title>{slide.title}</Title>
    case "section-header":
      return (
        <div className="absolute bottom-[18%] left-[8%] flex w-[84%] flex-col gap-[2cqw]">
          <span aria-hidden="true" className="h-[0.7cqw] w-[10%] rounded-full bg-primary" />
          <h2 className="text-[5.2cqw] leading-tight font-semibold text-balance">{slide.title}</h2>
          {body[0] && <p className="text-[2.4cqw] text-doc-ink/60">{body[0]}</p>}
        </div>
      )
    case "picture-caption":
      return (
        <>
          <Title>{slide.title}</Title>
          <div className="absolute top-[30%] left-[8%] flex h-[56%] w-[84%] gap-[4cqw]">
            <div className="flex flex-[1.2] items-center justify-center rounded-[1cqw] bg-doc-ink/10">
              <ImageIcon className="size-[10cqw] text-doc-ink/30" aria-hidden="true" />
            </div>
            <Bullets items={body} className="flex-1 justify-center" />
          </div>
        </>
      )
    case "blank":
    default:
      return null
  }
}
