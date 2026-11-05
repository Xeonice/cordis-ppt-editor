import type { KeyboardEvent } from "react"
import { cn } from "@/lib/utils"
import { KeyCap, Tag } from "../../kit/controls"
import { Tip } from "../../ui"
import { RECENT_SHAPES, SHAPE_GROUPS, ShapeThumb, type ShapePreset } from "./catalog"

const COLS = 12

/** 形状库的项数（不含「最近使用」）：工具条「全部形状」一行右侧的计数 */
export const SHAPE_COUNT = SHAPE_GROUPS.reduce((a, g) => a + g.items.length, 0)

/**
 * 完整形状库（03-15「形状库」）：10 类、首批 72 项；类名在左（56px 列、12px text-2），每类一行最多 12 格（基本形状两行）。
 * 格子 28（与控件同高）、圆角 6、间距 4，缩略图 20；「最近使用」置顶，下方一条贯穿分隔线；没有最近使用时整段不显示。
 * P2 的曲线 / 任意多边形 / 自由曲线禁用而不隐藏（text-3、可聚焦、工具提示给原因），行尾挂 P2 标记。
 * 当前插入工具（aria-pressed）为强调色浅底 + 强调色图形。底部提示行给出单击 / 拖出 / 修饰键。
 * 键盘：方向键在格子间移动（左右跨行连续，上下按行、跨类保持列位），Esc 关闭（Popover 自带）。样张里 Enter / Space 与单击一样只选定插入工具；
 * 产品按 03-15 §3.4 直接按默认尺寸插到视口中心并选中（插入工具态的键盘等价，PRD ED-05），整库只占一个 Tab 停靠点（rulings §4.25 TB-5），两项样张未画、随实现。
 * onPick：点了（或 Enter / Space）一个可用的格子——工具条据此收起弹层、记下当前插入工具（再打开时该格高亮）。P2 的格子点了无效。
 */
export function ShapeLibrary({ activeId, showRecent = true, onPick }: { activeId?: string; showRecent?: boolean; onPick?: (shape: ShapePreset) => void }) {
  const groups = [...(showRecent ? [{ id: "recent", label: "最近使用", items: RECENT_SHAPES }] : []), ...SHAPE_GROUPS]
  let row = 0

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const cur = (e.target as HTMLElement).closest<HTMLElement>("[data-cell]")
    if (!cur) return
    const r = Number(cur.dataset.row)
    const c = Number(cur.dataset.col)
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
    <div className="flex flex-col">
      <div className="flex max-h-[calc(100dvh-280px)] flex-col gap-1 overflow-y-auto" onKeyDown={onKeyDown}>
        {groups.map((g) => {
          const rows: ShapePreset[][] = []
          for (let i = 0; i < g.items.length; i += COLS) rows.push(g.items.slice(i, i + COLS))
          const recent = g.id === "recent"
          return (
            <section key={g.id} role="group" aria-label={g.label} className={cn("flex items-start gap-2", recent && "-mx-3 mb-2 border-b border-(--v3-border) px-3 pb-3")}>
              <h4 className="flex h-7 w-14 shrink-0 items-center text-[12px] leading-none whitespace-nowrap text-(--v3-text-2)">{g.label}</h4>
              <div className="flex flex-col gap-1">
                {rows.map((items) => {
                  const r = row++
                  const hasP2 = items.some((s) => s.p2)
                  return (
                    <div key={r} className="grid grid-cols-[repeat(12,28px)] gap-1">
                      {items.map((s, c) => (
                        <ShapeCell key={`${g.id}-${s.id}`} shape={s} row={r} col={c} active={activeId === s.id} onPick={onPick} />
                      ))}
                      {hasP2 && (
                        <span className="col-span-2 flex items-center pl-1">
                          <Tag>P2</Tag>
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
      {/* 已选定插入工具时画布顶部有同一句提示条（插入工具态），这里不再重复（同一信息不在同屏出现两次） */}
      {!activeId && (
      <footer className="-mx-3 mt-2 flex items-center gap-3 border-t border-(--v3-border) px-3 pt-3 text-[12px] leading-none whitespace-nowrap text-(--v3-text-2)">
        <span className="mr-auto">单击插入 72 × 72 pt，或拖出大小</span>
        <span className="flex items-center gap-1.5">
          <KeyCap>Shift</KeyCap>锁定比例
        </span>
        <span className="flex items-center gap-1.5">
          <KeyCap>Alt</KeyCap>从中心
        </span>
        <span className="flex items-center gap-1.5">
          <KeyCap>Esc</KeyCap>取消
        </span>
      </footer>
      )}
    </div>
  )
}

function ShapeCell({ shape, row, col, active, onPick }: { shape: ShapePreset; row: number; col: number; active: boolean; onPick?: (shape: ShapePreset) => void }) {
  const disabled = !!shape.p2
  return (
    <Tip label={disabled ? `${shape.name} · ${shape.p2}` : shape.name}>
      <button
        type="button"
        data-cell=""
        data-row={row}
        data-col={col}
        aria-label={disabled ? `${shape.name}（P2，暂不可用）` : shape.name}
        aria-disabled={disabled || undefined}
        aria-pressed={active || undefined}
        onClick={() => !disabled && onPick?.(shape)}
        className={cn(
          "flex size-7 items-center justify-center rounded-[6px] transition-colors",
          active ? "bg-(--v3-accent-soft) text-(--v3-accent)" : disabled ? "cursor-default text-(--v3-text-3)" : "text-(--v3-text) hover:bg-(--v3-panel-2)",
        )}
      >
        <ShapeThumb shape={shape} />
      </button>
    </Tip>
  )
}
