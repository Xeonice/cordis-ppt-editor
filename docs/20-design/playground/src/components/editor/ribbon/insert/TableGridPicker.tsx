import { useId, useRef, useState, type KeyboardEvent } from "react"
import { Table } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { InsertTableDialog } from "./InsertTableDialog"

/** 悬停网格范围：8 行 × 10 列（Q3：只是快捷范围；更大的表走「插入表格…」，对话框上限见 TABLE_DIALOG_MAX） */
export const TABLE_GRID_ROWS = 8
export const TABLE_GRID_COLS = 10

/**
 * 表格网格选择器（设计 03-30 §2.1、03-04；50/24 §2.11）：8 行 × 10 列悬停网格，读数「R 行 × C 列 表格」，底部「插入表格…」打开对话框。
 * 插入页签「表格 ▾」与空内容占位符的表格图标共用同一组件（用户裁决 2026-09-30 Q2；PRD 07 G-32；50/21 §3 ③；对应 40/10 的 ui/insert/TableGridPicker.tsx）。
 * 键盘（role="grid"，roving tabindex）：Tab 进入网格落在当前高亮角（未悬停时第 1 行第 1 列），方向键移动高亮角，Home / End 到行首行尾，
 * Enter / Space 插入；每格读屏名「R 行 C 列」，读数区 aria-live 随高亮更新。指针移出网格即复位。
 * 「插入表格…」：给了 `onOpenDialog` 时交给调用方（先关网格弹层、再开对话框，焦点回到触发按钮；插入页签与表格路由用此）；
 * 没给时组件自己打开对话框，叠在弹层之上（取消回到网格，确定走 onPick），调用方不用改。
 */
export function TableGridPicker({
  onPick,
  initialHover,
  onOpenDialog,
}: {
  onPick: (rows: number, cols: number) => void
  initialHover?: { r: number; c: number }
  onOpenDialog?: () => void
}) {
  const [hover, setHover] = useState(initialHover ?? { r: 0, c: 0 })
  const [dialogOpen, setDialogOpen] = useState(false)
  const cells = useRef<(HTMLButtonElement | null)[]>([])
  const uid = useId()
  const idx = (r: number, c: number) => (r - 1) * TABLE_GRID_COLS + (c - 1)
  const stop = hover.r > 0 ? hover : { r: 1, c: 1 }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, r: number, c: number) {
    let nr = r
    let nc = c
    if (e.key === "ArrowUp") nr = Math.max(1, r - 1)
    else if (e.key === "ArrowDown") nr = Math.min(TABLE_GRID_ROWS, r + 1)
    else if (e.key === "ArrowLeft") nc = Math.max(1, c - 1)
    else if (e.key === "ArrowRight") nc = Math.min(TABLE_GRID_COLS, c + 1)
    else if (e.key === "Home") nc = 1
    else if (e.key === "End") nc = TABLE_GRID_COLS
    else return
    e.preventDefault()
    setHover({ r: nr, c: nc })
    cells.current[idx(nr, nc)]?.focus()
  }

  return (
    <div className="flex flex-col gap-2">
      <p id={`${uid}-title`} className="text-xs font-medium text-muted-foreground">插入表格</p>
      <div
        role="grid"
        aria-labelledby={`${uid}-title`}
        aria-describedby={`${uid}-readout`}
        className="flex flex-col gap-1"
        onMouseLeave={() => setHover({ r: 0, c: 0 })}
      >
        {Array.from({ length: TABLE_GRID_ROWS }).map((_, ri) => (
          <div key={ri} role="row" className="flex gap-1">
            {Array.from({ length: TABLE_GRID_COLS }).map((_, ci) => {
              const r = ri + 1
              const c = ci + 1
              const active = r <= hover.r && c <= hover.c
              return (
                <button
                  key={ci}
                  ref={(el) => { cells.current[idx(r, c)] = el }}
                  type="button"
                  role="gridcell"
                  tabIndex={r === stop.r && c === stop.c ? 0 : -1}
                  aria-label={`${r} 行 ${c} 列`}
                  aria-selected={active}
                  className={cn(
                    "size-4 rounded-[2px] border outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-popover",
                    // 暗色浮层底 #252B3C 上 bg-muted 比底色还深、border 几乎看不见：未选格改用白 20% 描边 + 4% 填充，与亮色的浅灰格同一观感
                    active ? "border-primary bg-primary/70" : "border-border bg-muted dark:border-white/20 dark:bg-white/[0.04]"
                  )}
                  onMouseEnter={() => setHover({ r, c })}
                  onFocus={() => setHover({ r, c })}
                  onKeyDown={(e) => onKeyDown(e, r, c)}
                  onClick={() => onPick(r, c)}
                />
              )
            })}
          </div>
        ))}
      </div>
      <p id={`${uid}-readout`} aria-live="polite" className="text-center text-xs text-muted-foreground tabular-nums">
        {hover.r > 0 ? `${hover.r} 行 × ${hover.c} 列 表格` : "移入选择表格尺寸"}
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 justify-start px-2 text-xs font-normal"
        onClick={() => (onOpenDialog ? onOpenDialog() : setDialogOpen(true))}
      >
        <Table className="size-3.5" /> 插入表格…
      </Button>
      {!onOpenDialog && (
        <InsertTableDialog open={dialogOpen} onOpenChange={setDialogOpen} onConfirm={(r, c) => onPick(r, c)} />
      )}
    </div>
  )
}
