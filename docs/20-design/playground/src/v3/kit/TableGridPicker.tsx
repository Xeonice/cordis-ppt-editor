import { type ReactNode, useId, useRef, useState, type KeyboardEvent } from "react"
import { Table } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, ICON } from "../ui"
import { useLayerClose } from "./layer"
import { PopoverTitle } from "./Popover"

/** 悬停网格范围 8 行 × 10 列（用户裁决 Q3：只是快捷范围，更大的表走「插入表格…」） */
const ROWS = 8
const COLS = 10

/**
 * 插入表格网格（03-30 §2.1）：工具条「表格」与空占位符的表格图标共用同一组件（Q2，03-16 G-80 / §4.22 Q2）。放在 Popover（className="p-2"）里。
 * 16px 格、间距 4、10 列 8 行（网格宽 196）；高亮（左上角到悬停格）用选中色 + 1px 强调色边，未高亮是 panel-2 底 + 1px --v3-border-control 内描边
 * （格子没有文字和图标，边界就是它本身；格子是控件、不是内容：对弹层底与格底都 ≥ 3:1，WCAG 1.4.11；rulings §4.25 TB-35，原 1px --v3-border 不到 1.3:1；
 * DS-35 改安静样式后仍保留）。
 * 读数「R 行 × C 列」放在标题行右侧（aria-live），指针移出网格即复位为「移入选择尺寸」。note：网格下方一行说明（如占位符「表格宽度取占位符宽」）。
 * 键盘：role="grid"、roving tabindex，只占一个 Tab 停靠点；方向键移动高亮角，Home / End 到行首行尾，Enter / Space 插入。
 * 选定尺寸（点格子或 Enter）、点「插入表格…」后所在弹层收起（kit useLayerClose），再调 onPick / onOpenDialog。
 */
export function TableGridPicker({
  initial,
  onPick,
  onOpenDialog,
  note,
}: {
  initial?: { r: number; c: number }
  onPick?: (r: number, c: number) => void
  onOpenDialog?: () => void
  note?: ReactNode
}) {
  const close = useLayerClose()
  const pick = (r: number, c: number) => {
    close()
    onPick?.(r, c)
  }
  const [hover, setHover] = useState(initial ?? { r: 0, c: 0 })
  const cells = useRef<(HTMLButtonElement | null)[]>([])
  const uid = useId()
  const idx = (r: number, c: number) => (r - 1) * COLS + (c - 1)
  const stop = hover.r > 0 ? hover : { r: 1, c: 1 }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, r: number, c: number) {
    let nr = r
    let nc = c
    if (e.key === "ArrowUp") nr = Math.max(1, r - 1)
    else if (e.key === "ArrowDown") nr = Math.min(ROWS, r + 1)
    else if (e.key === "ArrowLeft") nc = Math.max(1, c - 1)
    else if (e.key === "ArrowRight") nc = Math.min(COLS, c + 1)
    else if (e.key === "Home") nc = 1
    else if (e.key === "End") nc = COLS
    else return
    e.preventDefault()
    setHover({ r: nr, c: nc })
    cells.current[idx(nr, nc)]?.focus()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-4 items-center justify-between gap-3">
        <PopoverTitle>
          <span id={`${uid}-t`}>插入表格</span>
        </PopoverTitle>
        <span id={`${uid}-r`} aria-live="polite" className="text-[12px] leading-none whitespace-nowrap text-(--v3-text-2) tabular-nums">
          {hover.r > 0 ? `${hover.r} 行 × ${hover.c} 列` : "移入选择尺寸"}
        </span>
      </div>
      <div role="grid" aria-labelledby={`${uid}-t`} aria-describedby={`${uid}-r`} className="flex flex-col gap-1" onMouseLeave={() => setHover({ r: 0, c: 0 })}>
        {Array.from({ length: ROWS }, (_, ri) => (
          <div key={ri} role="row" className="flex gap-1">
            {Array.from({ length: COLS }, (_, ci) => {
              const r = ri + 1
              const c = ci + 1
              const on = r <= hover.r && c <= hover.c
              return (
                <button
                  key={ci}
                  ref={(el) => {
                    cells.current[idx(r, c)] = el
                  }}
                  type="button"
                  role="gridcell"
                  tabIndex={r === stop.r && c === stop.c ? 0 : -1}
                  aria-label={`${r} 行 ${c} 列`}
                  aria-selected={on}
                  onMouseEnter={() => setHover({ r, c })}
                  onFocus={() => setHover({ r, c })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      pick(r, c)
                    } else onKeyDown(e, r, c)
                  }}
                  onClick={() => pick(r, c)}
                  className={cn(
                    "size-4 rounded-[3px] transition-colors",
                    on ? "bg-(--v3-sel) shadow-[inset_0_0_0_1px_var(--v3-accent)]" : "bg-(--v3-panel-2) shadow-[inset_0_0_0_1px_var(--v3-border-control)]",
                  )}
                />
              )
            })}
          </div>
        ))}
      </div>
      {note && <p className="max-w-[196px] text-[12px] leading-4 text-(--v3-text-2)">{note}</p>}
      {/* 分隔线与按钮外扩到弹层 4px 内缘（同菜单项），按钮文字与标题左缘对齐 */}
      <div className="-mx-2 h-px bg-(--v3-border)" />
      <Button variant="ghost" className="-mx-2 -mb-1 justify-start gap-2 px-2 text-(--v3-text)" onClick={() => {
          close()
          onOpenDialog?.()
        }}>
        <Table {...ICON} aria-hidden="true" className="text-(--v3-text-2)" />
        插入表格…
      </Button>
    </div>
  )
}
