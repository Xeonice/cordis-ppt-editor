import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { cn } from "@/lib/utils"
import { DOC_ID } from "../data"

/**
 * 面板尺寸与记忆（03-20「面板尺寸与记忆」、02 §3.3 备注「高度可调」、PRD ED-22「左栏 / 画布 / 备注三区尺寸可拖动并按 Unit 记忆」）：
 * 左栏、检查器各有一条贴边的竖分隔条，备注上方的把手是横分隔条；拖动或键盘调整，双击 / Enter 回到缺省值。
 * 尺寸按文档记在本机（localStorage，读写失败时只在本次会话里生效；rulings §4.25 TB-24）：键与产品同一写法 cordex.layout.{rememberKey}，
 * apps/web 传 documentId，登出与换人时清除（TB-41，与分享令牌、离线数据的登出清理一致；样张不做登出清理）；场景状态写了 panels 时以状态为准（截图稳定）。
 * 只在桌面形态（≥ 1024）出现：紧凑形态的左栏与检查器是抽屉，宽度固定。
 */
export const PANEL_LIMITS = {
  rail: { def: 240, min: 160, max: 420, label: "幻灯片列表宽度" },
  // 检查器 240–480（PRD ED-12；rulings §4.25 TB-25：样张原上限 720 改为 480）
  inspector: { def: 280, min: 240, max: 480, label: "检查器宽度" },
  notes: { def: 120, min: 64, max: 320, label: "备注高度" },
} as const

export type PanelKey = keyof typeof PANEL_LIMITS
export type PanelSizes = Record<PanelKey, number>

/** 示例文档「2026 年 Q2 业绩汇报」的 documentId（与首页最近文档的 id 相同） */
const STORE_KEY = `cordex.layout.${DOC_ID}`

function readStored(): Partial<PanelSizes> {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as Partial<PanelSizes>) : {}
  } catch {
    return {}
  }
}

function writeStored(v: PanelSizes) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(v))
  } catch {
    // 本机存储不可用（隐私窗口、被禁用）：只在本次会话里生效
  }
}

const clamp = (k: PanelKey, v: number) => Math.round(Math.min(PANEL_LIMITS[k].max, Math.max(PANEL_LIMITS[k].min, v)))

/** 三个面板尺寸：状态给的值 > 本机记住的值 > 缺省值。set 时写回本机。 */
export function usePanelSizes(initial?: Partial<Record<PanelKey, number>>): [PanelSizes, (k: PanelKey, v: number) => void] {
  const [sizes, setSizes] = useState<PanelSizes>(() => {
    const stored = initial && (initial.rail !== undefined || initial.inspector !== undefined || initial.notes !== undefined) ? {} : readStored()
    const pick = (k: PanelKey) => clamp(k, initial?.[k] ?? stored[k] ?? PANEL_LIMITS[k].def)
    return { rail: pick("rail"), inspector: pick("inspector"), notes: pick("notes") }
  })
  const set = (k: PanelKey, v: number) =>
    setSizes((cur) => {
      const next = { ...cur, [k]: clamp(k, v) }
      writeStored(next)
      return next
    })
  return [sizes, set]
}

/**
 * 分隔条（role="separator"，可聚焦）：
 * - rail：左栏右缘，向右拖变宽；inspector：检查器左缘，向左拖变宽；notes：备注上方的把手（40 × 4），向上拖变高。
 * - 键盘：← → / ↑ ↓ 每次 8（⇧ 32），Home / End 到最小 / 最大，Enter 回到缺省值；双击同 Enter。
 * - 外观：静止时竖分隔条看不出（面板的 1px 分隔线就是它），悬停 / 拖动 / 聚焦时 2px 控件边界色（中性，不用强调色）；键盘焦点另有 2px 强调色焦点环。
 * active：演示态（悬停 / 拖动中的样子常显）。
 */
export function PanelResizer({ panel, value, onChange, active }: { panel: PanelKey; value: number; onChange: (v: number) => void; active?: boolean }) {
  const lim = PANEL_LIMITS[panel]
  const start = useRef<{ pos: number; value: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const vertical = panel !== "notes"
  /** 拖动方向：左栏向右为正，检查器向左为正，备注向上为正 */
  const sign = panel === "rail" ? 1 : -1
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { pos: vertical ? e.clientX : e.clientY, value }
    setDragging(true)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current
    if (!s) return
    const d = (vertical ? e.clientX : e.clientY) - s.pos
    onChange(s.value + sign * d)
  }
  const end = () => {
    start.current = null
    setDragging(false)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 32 : 8
    const grow = vertical ? (panel === "rail" ? "ArrowRight" : "ArrowLeft") : "ArrowUp"
    const shrink = vertical ? (panel === "rail" ? "ArrowLeft" : "ArrowRight") : "ArrowDown"
    let next: number | null = null
    if (e.key === grow) next = value + step
    else if (e.key === shrink) next = value - step
    else if (e.key === "Home") next = lim.min
    else if (e.key === "End") next = lim.max
    else if (e.key === "Enter") next = lim.def
    if (next === null) return
    e.preventDefault()
    onChange(next)
  }
  const on = active || dragging
  const common = {
    role: "separator",
    tabIndex: 0,
    "aria-label": lim.label,
    "aria-orientation": vertical ? ("vertical" as const) : ("horizontal" as const),
    "aria-valuemin": lim.min,
    "aria-valuemax": lim.max,
    "aria-valuenow": value,
    "data-v3-anchor": `resize-${panel}`,
    onPointerDown,
    onPointerMove,
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
    onDoubleClick: () => onChange(lim.def),
    onKeyDown,
  }
  if (!vertical)
    return (
      <div
        {...common}
        className="group mx-auto flex h-4 w-16 cursor-row-resize touch-none items-center justify-center rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-(--v3-accent)"
      >
        <span aria-hidden="true" className={cn("h-1 w-10 rounded-[2px] bg-(--v3-handle) transition-colors group-hover:bg-(--v3-text-2)", on && "bg-(--v3-text-2)")} />
      </div>
    )
  return (
    <div
      {...common}
      className={cn(
        "group absolute inset-y-0 z-10 w-[7px] cursor-col-resize touch-none outline-none",
        panel === "rail" ? "-right-[4px]" : "-left-[4px]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-[2.5px] w-[2px] transition-colors group-hover:bg-(--v3-border-control) group-focus-visible:bg-(--v3-accent)",
          on && "bg-(--v3-border-control)",
        )}
      />
    </div>
  )
}
