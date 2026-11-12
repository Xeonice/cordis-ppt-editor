import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { MENTION_NAMES } from "./model"

/**
 * 评论正文（PRD CO-04）：纯文本 + 换行 + @提及 + 自动识别的链接；不支持任意富文本与附件（附件 P2）。
 * 提及加粗（中等字重 500：仍比正文 400 重，与作者名同一档，免得提及比人名还重）、链接加下划线，都不用强调色——强调色只给主操作、当前工具、选中与按下的开关（Q3）。
 * clamp：长正文默认折叠 3 行，超出时下面一行「展开」（03-06 交互说明）；展开后同一位置是「收起」。
 */

const MENTION = MENTION_NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
const TOKEN = new RegExp(`(https?:\\/\\/[^\\s，。；、！？）」]+)|(@(?:${MENTION}))`, "g")

function renderLine(line: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const m of line.matchAll(TOKEN)) {
    const i = m.index ?? 0
    if (i > last) out.push(line.slice(last, i))
    if (m[1]) {
      out.push(
        <a key={`${key}-${i}`} href={m[1]} target="_blank" rel="noreferrer noopener" className="break-all underline decoration-(--v3-text-3) underline-offset-2 hover:decoration-(--v3-text)" onClick={(e) => e.stopPropagation()}>
          {m[1]}
        </a>,
      )
    } else if (m[2]) {
      out.push(
        <span key={`${key}-${i}`} className="font-medium whitespace-nowrap">
          {m[2]}
        </span>,
      )
    }
    last = i + m[0].length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}

export function RichText({ text, clamp = true, className }: { text: string; clamp?: boolean; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [open, setOpen] = useState(false)
  const [over, setOver] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !clamp || open) return
    const measure = () => setOver(el.scrollHeight - el.clientHeight > 6)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [clamp, open, text])
  const lines = text.split("\n")
  return (
    <div className={className}>
      <p ref={ref} className={cn("text-[12px] leading-[18px] break-words whitespace-pre-wrap text-(--v3-text)", clamp && !open && "line-clamp-3")}>
        {lines.map((l, i) => (
          <Fragment key={i}>
            {i > 0 && "\n"}
            {renderLine(l, String(i))}
          </Fragment>
        ))}
      </p>
      {clamp && (over || open) && (
        <button
          type="button"
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation()
            setOpen(!open)
          }}
          className="mt-0.5 rounded-[4px] text-[12px] leading-[18px] text-(--v3-text-2) underline-offset-2 hover:text-(--v3-text) hover:underline"
        >
          {open ? "收起" : "展开"}
        </button>
      )}
    </div>
  )
}
