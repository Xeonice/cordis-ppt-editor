import { useLayoutEffect, useRef, type KeyboardEvent } from "react"
import { ImageOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { DeckSlideView, ICON, useEditor } from "../../kit"
import { useViewerSeed } from "./data"

/**
 * 查看器桌面与窄屏共用的小件：缩略图条（宿主 thumbnails: true）与备注正文（宿主 notes: true）。
 */

/**
 * 缩略图条（03-25「可选缩略图条」，Q18：缺省关、宿主开启、按需加载、不计 350 KB 基线）：横向一条，每项与编辑器左栏缩略图同款
 * （页码 11px 在左、缩略图 96 宽真实渲染、1px 边；当前页强调色边 + 强调色淡底，aria-current），点选跳页；条内 ← → / Home / End 移动焦点（只有当前页在 Tab 顺序里），↵ 跳转。
 * 还没生成的页显示这一页的版式骨架（与编辑器左栏「其余页面加载中」同一画法，不是灰色骨架条），生成失败的页是 panel-2 灰块 + 图标、不阻塞其他页。
 * 只有 1 页时不显示这一条（调用处判断）。桌面贴在画布下方（上边线）；DS-111 未采纳的 03-25 原写法（alt-narrow-toolbar）作为顶部抽屉贴在工具条下方（下边线）。
 */
export function ThumbStrip({ edge = "top", onPick }: { edge?: "top" | "bottom"; onPick?: () => void }) {
  const ed = useEditor()
  const v = useViewerSeed()
  const pending = v.thumbsPending ?? []
  const failed = v.thumbsFailed ?? []
  const list = useRef<HTMLOListElement>(null)
  /** 只在条自己的横向滚动里把按钮整个露出来（不用 scrollIntoView：它会连带滚动设了 overflow: hidden 的页面根节点，README §9） */
  const reveal = (b: HTMLElement | null | undefined) => {
    const box = list.current
    if (!b || !box) return
    // 条（ol）是 relative：按钮的 offsetLeft 就是它在条内容里的横坐标（不受条的滚动影响）
    const l = b.offsetLeft
    if (l < box.scrollLeft) box.scrollLeft = l - 8
    else if (l + b.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollLeft = l + b.offsetWidth - box.clientWidth + 8
  }
  // 翻页时当前页滚入条内（03-25「翻页时当前页自动滚入视口」）
  useLayoutEffect(() => {
    reveal(list.current?.querySelector<HTMLElement>("[aria-current]"))
  }, [ed.slide])
  const move = (e: KeyboardEvent<HTMLOListElement>) => {
    const all = Array.from(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])
    const i = all.indexOf(document.activeElement as HTMLButtonElement)
    const to = (j: number) => {
      e.preventDefault()
      const b = all[Math.max(0, Math.min(all.length - 1, j))]
      b?.focus({ preventScroll: true })
      reveal(b)
    }
    if (e.key === "ArrowRight") to(i + 1)
    else if (e.key === "ArrowLeft") to(i - 1)
    else if (e.key === "Home") to(0)
    else if (e.key === "End") to(all.length - 1)
  }
  return (
    <nav aria-label="幻灯片" data-viewer-strip="" className={cn("shrink-0 bg-(--v3-panel)", edge === "top" ? "border-t border-(--v3-border)" : "border-b border-(--v3-border)")}>
      <ol ref={list} onKeyDown={move} className="relative flex gap-1 overflow-x-auto px-2 py-1.5">
        {ed.deck.map((s) => {
          const on = s.n === ed.slide
          const bad = failed.includes(s.n)
          const wait = pending.includes(s.n)
          return (
            <li key={s.n} className="shrink-0">
              <button
                type="button"
                tabIndex={on ? 0 : -1}
                aria-current={on ? "true" : undefined}
                aria-label={`第 ${s.n} 页：${s.name}${bad ? "，缩略图暂时无法显示" : wait ? "，缩略图生成中" : ""}`}
                onClick={() => {
                  ed.goTo(s.n)
                  onPick?.()
                }}
                className={cn("flex items-start gap-2 rounded-[6px] p-2 text-left transition-colors", on ? "bg-(--v3-accent-soft)" : "hover:bg-(--v3-panel-2)")}
              >
                <span className={cn("w-3 shrink-0 pt-px text-right text-[11px] leading-4 tabular-nums", on ? "text-(--v3-text)" : "text-(--v3-text-2)")}>{s.n}</span>
                <span className={cn("relative block w-24 overflow-hidden rounded-[4px] border border-(--v3-border)", on && "border-(--v3-accent) ring-[0.5px] ring-(--v3-accent)")}>
                  {bad ? (
                    <span className="flex aspect-video items-center justify-center bg-(--v3-panel-2) text-(--v3-text-2)">
                      <ImageOff {...ICON} aria-hidden="true" />
                    </span>
                  ) : (
                    <DeckSlideView slide={s} where="thumb" />
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * 备注正文：只读纯文本、保留换行、不渲染富文本（13px / 20）；没有备注时一句「这一页没有演讲者备注」——与桌面编辑器只读态已定稿的同一句
 * （editor/Stage.tsx、version-history）；rulings §4.25 DS-138 定为一律这一句，第 1 批仅查看形态 narrow/viewer.tsx 原来的「这一页没有备注」随之改
 */
export function NotesText({ text }: { text?: string }) {
  return text ? (
    <p className="text-[13px] leading-5 whitespace-pre-wrap text-(--v3-text)">{text}</p>
  ) : (
    <p className="text-[12px] leading-[18px] text-(--v3-text-2)">这一页没有演讲者备注</p>
  )
}
