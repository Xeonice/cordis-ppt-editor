import type { KeyboardEvent } from "react"
import { Kbd } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { recentShapes, shapeGroups, ShapeThumb, type ShapePreset } from "./shapes"

const COLS = 12

/**
 * 形状库弹出面板（03-screens/15；rulings §4.21 R-d-66）：10 类、首批 72 项；类名在左（56px 列），每类一行 12 格（基本形状两行）。
 * 格子 28px（与 Ribbon 小控件同一节奏），缩略图 20px 预设几何线稿；tooltip 显示名称。
 * P2 项（曲线 / 任意多边形 / 自由曲线）用 aria-disabled 保留焦点与 tooltip：禁用而不隐藏，并说明原因。
 * 键盘：方向键在格子间移动（上下按行、跨类连续），Enter 选择后进入插入工具态；Esc 关闭（Popover 自带）。
 */
export function ShapeGallery({ onPick, activeId }: { onPick: (shape: ShapePreset) => void; activeId?: string | null }) {
  const groups = [{ id: "recent", label: "最近使用", items: recentShapes }, ...shapeGroups]
  let row = 0

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const cur = (e.target as HTMLElement).closest<HTMLElement>("[data-cell]")
    if (!cur) return
    const r = Number(cur.dataset.row), c = Number(cur.dataset.col)
    const at = (rr: number) => Array.from(e.currentTarget.querySelectorAll<HTMLElement>(`[data-cell][data-row="${rr}"]`))
    let target: HTMLElement | undefined
    if (e.key === "ArrowRight") target = at(r)[c + 1] ?? at(r + 1)[0]
    else if (e.key === "ArrowLeft") target = at(r)[c - 1] ?? at(r - 1).at(-1)
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const next = at(e.key === "ArrowDown" ? r + 1 : r - 1)
      target = next[Math.min(c, next.length - 1)]
    } else return
    e.preventDefault()
    target?.focus()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="-mr-2 flex max-h-[calc(100dvh-280px)] flex-col gap-1.5 overflow-y-auto pr-2" onKeyDown={onKeyDown}>
        {groups.map((g) => {
          const rows: ShapePreset[][] = []
          for (let i = 0; i < g.items.length; i += COLS) rows.push(g.items.slice(i, i + COLS))
          return (
            <section
              key={g.id}
              role="group"
              aria-label={g.label}
              className={cn("flex items-start gap-2", g.id === "recent" && "mb-1 border-b border-foreground/5 pb-2.5")}
            >
              <p className="flex h-7 w-14 shrink-0 items-center text-xs text-muted-foreground">{g.label}</p>
              <div className="flex flex-col gap-1">
                {rows.map((items) => {
                  const r = row++
                  return (
                    <div key={r} className="grid grid-cols-[repeat(12,1.75rem)] gap-1">
                      {items.map((s, c) => (
                        <ShapeCell key={`${g.id}-${s.id}`} shape={s} row={r} col={c} active={activeId === s.id} onPick={onPick} />
                      ))}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-foreground/5 pt-2.5 text-xs text-muted-foreground">
        <span>单击画布插入 1 in × 1 in，或拖出大小</span>
        <span className="inline-flex items-center gap-1"><Kbd>Shift</Kbd>锁定比例</span>
        <span className="inline-flex items-center gap-1"><Kbd>Alt</Kbd>从中心</span>
        <span className="inline-flex items-center gap-1"><Kbd>Esc</Kbd>取消</span>
      </p>
    </div>
  )
}

function ShapeCell({ shape, row, col, active, onPick }: { shape: ShapePreset; row: number; col: number; active: boolean; onPick: (s: ShapePreset) => void }) {
  const disabled = !!shape.p2
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-cell=""
          data-row={row}
          data-col={col}
          aria-label={disabled ? `${shape.name}（P2，暂不可用）` : shape.name}
          aria-disabled={disabled || undefined}
          aria-pressed={active || undefined}
          onClick={() => !disabled && onPick(shape)}
          className={cn(
            "flex size-7 items-center justify-center rounded-lg text-foreground/80 outline-none transition-colors",
            "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            active && "bg-primary/12 text-primary ring-1 ring-primary/40 hover:bg-primary/15 hover:text-primary",
            disabled && "cursor-not-allowed text-foreground/35 hover:bg-transparent hover:text-foreground/35"
          )}
        >
          <ShapeThumb shape={shape} />
        </button>
      </TooltipTrigger>
      <TooltipContent>{disabled ? `${shape.name} · ${shape.p2}` : shape.name}</TooltipContent>
    </Tooltip>
  )
}
