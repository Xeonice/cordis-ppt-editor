import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { ACCENTS } from "./chart-model"

/**
 * 表格样张（50/24 §2；PRD ED-10、G-32 / G-62）：内置 74 种样式按「浅色 21 / 中等 28 / 深色 11 / 其它 14」× 强调色生成，
 * 颜色由样式引用主题 accent 派生（换主题自动跟随）；6 个标志（标题行 / 汇总行 / 镶边行 / 第一列 / 最后一列 / 镶边列）
 * 改的是同一张表的 properties。画布上的表格是幻灯片内容（doc-paper 上，不随界面亮暗变化）。
 */
export interface TableFlags {
  headerRow: boolean
  totalRow: boolean
  bandRow: boolean
  firstCol: boolean
  lastCol: boolean
  bandCol: boolean
}

export const defaultFlags: TableFlags = { headerRow: true, totalRow: false, bandRow: true, firstCol: false, lastCol: false, bandCol: false }

export const flagLabels: { key: keyof TableFlags; label: string }[] = [
  { key: "headerRow", label: "标题行" },
  { key: "firstCol", label: "第一列" },
  { key: "totalRow", label: "汇总行" },
  { key: "lastCol", label: "最后一列" },
  { key: "bandRow", label: "镶边行" },
  { key: "bandCol", label: "镶边列" },
]

export type TableStyleGroup = "doc" | "light" | "medium" | "dark" | "other"

/**
 * 着色族：同一族共用一套近似着色规则（`cellPaint`），族内按强调色区分。
 * 近似画法，逐部件保真随 74 种样式数据定稿后重画（推迟项 DF-01 / DF-02）。
 */
export type TableStyleFamily =
  | "doc"
  | "light-1" | "light-2" | "light-3"
  | "medium-1" | "medium-2" | "medium-3" | "medium-4"
  | "dark-1" | "dark-2"
  | "themed-1" | "themed-2"
  | "none" | "none-grid"

export interface TableStyleDef {
  id: string
  name: string
  group: TableStyleGroup
  family: TableStyleFamily
  /** 强调色；neutral 用文档深色 dk1 */
  color: string
  /** 深色样式 2 的配对强调色（标题行用） */
  color2?: string
}

const NEUTRAL = "#3B4254"
const INK = "#1A2030"
const toneNames = { light: "浅色样式", medium: "中度样式", dark: "深色样式" } as const

/** 浅色 1–3、中度 1–4、深色 1：各 7 种（无强调 + 强调 1–6） */
function build(group: "light" | "medium" | "dark", n: number): TableStyleDef[] {
  return [NEUTRAL, ...ACCENTS].map((color, i) => ({
    id: `${group}-${n}-${i}`,
    name: `${toneNames[group]} ${n}${i === 0 ? "" : ` - 强调 ${i}`}`,
    group,
    family: `${group}-${n}` as TableStyleFamily,
    color,
  }))
}

/** 深色样式 2：4 种，强调色两两配对（正文取前一个、标题行取后一个） */
const dark2: TableStyleDef[] = [
  { id: "dark-2-0", name: "深色样式 2", group: "dark", family: "dark-2", color: NEUTRAL, color2: INK },
  ...[0, 2, 4].map((k) => ({
    id: `dark-2-${k + 1}`,
    name: `深色样式 2 - 强调 ${k + 1}/强调 ${k + 2}`,
    group: "dark" as const,
    family: "dark-2" as const,
    color: ACCENTS[k]!,
    color2: ACCENTS[k + 1]!,
  })),
]

/** 其它：主题样式 1、2 各 6 种 + 无样式两种 */
const others: TableStyleDef[] = [
  ...ACCENTS.map((color, i) => ({ id: `themed-1-${i + 1}`, name: `主题样式 1 - 强调 ${i + 1}`, group: "other" as const, family: "themed-1" as const, color })),
  ...ACCENTS.map((color, i) => ({ id: `themed-2-${i + 1}`, name: `主题样式 2 - 强调 ${i + 1}`, group: "other" as const, family: "themed-2" as const, color })),
  { id: "none-0", name: "无样式，无网格", group: "other", family: "none", color: NEUTRAL },
  { id: "none-grid", name: "无样式，网格型", group: "other", family: "none-grid", color: INK },
]

/** 默认样式：中度样式 2 - 强调 1（{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}） */
export const DEFAULT_TABLE_STYLE = "medium-2-1"

/**
 * 内置 74 种（公开内置 GUID 核对：浅色 21 · 中等 28 · 深色 11 · 其它 14）+ 文档中的样式（排最前）。
 * 顺序同 PowerPoint 样式库：组内按样式编号、再按强调色。
 */
export const tableStyles: TableStyleDef[] = [
  { id: "doc-cordex", name: "Cordex 汇报表（文档中）", group: "doc", family: "doc", color: INK },
  ...build("light", 1), ...build("light", 2), ...build("light", 3),
  ...build("medium", 1), ...build("medium", 2), ...build("medium", 3), ...build("medium", 4),
  ...build("dark", 1), ...dark2,
  ...others,
]

/** 内置样式数（不含文档中的样式） */
export const BUILTIN_TABLE_STYLE_COUNT = tableStyles.filter((s) => s.group !== "doc").length

export const findTableStyle = (id: string) => tableStyles.find((s) => s.id === id) ?? tableStyles.find((s) => s.id === DEFAULT_TABLE_STYLE)!

function mix(hex: string, target: number, t: number) {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (target - v) * t))
  return `rgb(${ch.join(" ")})`
}
const tint = (hex: string, t: number) => mix(hex, 255, t)
const shade = (hex: string, t: number) => mix(hex, 0, t)

export interface CellPaint {
  bg: string
  color: string
  bold: boolean
  /** 内部网格线颜色；null 为无 */
  grid: string | null
  /** 标题行下沿强调线 */
  rule?: string
}

/**
 * 按样式 + 标志算出某格的绘制（示意 table.renderer 的样式解析：wholeTbl → band1H/band1V → firstRow/lastRow → firstCol/lastCol）。
 * 各族是近似规则，只求在样式库里彼此可辨；产品按真实样式数据逐部件叠加（50/24 §2.5）。
 */
export function cellPaint(style: TableStyleDef, flags: TableFlags, r: number, c: number, nRows: number, nCols: number, headerRows = 1): CellPaint {
  const header = flags.headerRow && r < headerRows
  const total = flags.totalRow && r === nRows - 1
  const first = flags.firstCol && c === 0
  const last = flags.lastCol && c === nCols - 1
  const bodyIdx = r - (flags.headerRow ? headerRows : 0)
  const colIdx = c - (flags.firstCol ? 1 : 0)
  const bandR = flags.bandRow && bodyIdx % 2 === 0
  const bandC = flags.bandCol && colIdx % 2 === 0
  const band = bandR || bandC
  const ink = INK
  const col = style.color
  switch (style.family) {
    case "doc":
      if (header) return { bg: INK, color: "#fff", bold: true, grid: "#ffffff" }
      if (total) return { bg: "#E4E7EC", color: ink, bold: true, grid: "#ffffff" }
      return { bg: band ? "#F1F3F8" : "#FFFFFF", color: ink, bold: first || last, grid: "#E4E7EC" }
    case "light-1":
      if (header || total) return { bg: "#FFFFFF", color: ink, bold: true, grid: null, rule: col }
      return { bg: band ? tint(col, 0.84) : "#FFFFFF", color: ink, bold: first || last, grid: null }
    case "light-2":
      if (header) return { bg: col, color: "#fff", bold: true, grid: null }
      if (total) return { bg: "#FFFFFF", color: ink, bold: true, grid: null, rule: col }
      return { bg: "#FFFFFF", color: ink, bold: first || last, grid: band ? tint(col, 0.55) : null }
    case "light-3":
      if (header || total) return { bg: "#FFFFFF", color: col === NEUTRAL ? ink : shade(col, 0.1), bold: true, grid: tint(col, 0.5), rule: col }
      return { bg: band ? tint(col, 0.88) : "#FFFFFF", color: ink, bold: first || last, grid: tint(col, 0.5) }
    case "medium-1":
      if (header || total) return { bg: col, color: "#fff", bold: true, grid: tint(col, 0.35) }
      return { bg: band ? tint(col, 0.8) : "#FFFFFF", color: ink, bold: first || last, grid: tint(col, 0.35) }
    case "medium-3":
      if (header || total) return { bg: col === NEUTRAL ? ink : col, color: "#fff", bold: true, grid: null }
      return { bg: band ? "#E6E8EE" : "#FFFFFF", color: ink, bold: first || last, grid: null }
    case "medium-4":
      if (header || total) return { bg: tint(col, 0.6), color: ink, bold: true, grid: col }
      return { bg: band ? tint(col, 0.72) : tint(col, 0.86), color: ink, bold: first || last, grid: col }
    case "dark-1":
      if (header || total) return { bg: shade(col, 0.45), color: "#fff", bold: true, grid: "#ffffff" }
      if (first || last) return { bg: shade(col, 0.25), color: "#fff", bold: true, grid: "#ffffff" }
      return { bg: band ? shade(col, 0.12) : col, color: "#fff", bold: false, grid: "#ffffff" }
    case "dark-2":
      if (header) return { bg: style.color2 ?? col, color: "#fff", bold: true, grid: null }
      if (total) return { bg: tint(col, 0.45), color: ink, bold: true, grid: null, rule: ink }
      return { bg: band ? tint(col, 0.55) : tint(col, 0.75), color: ink, bold: first || last, grid: null }
    case "themed-1":
      if (header || total) return { bg: col, color: "#fff", bold: true, grid: tint(col, 0.4) }
      return { bg: band ? tint(col, 0.86) : "#FFFFFF", color: ink, bold: first || last, grid: tint(col, 0.4) }
    case "themed-2":
      if (header || total) return { bg: shade(col, 0.2), color: "#fff", bold: true, grid: "#ffffff" }
      return { bg: band ? tint(col, 0.14) : col, color: "#fff", bold: first || last, grid: "#ffffff" }
    case "none":
      return { bg: "#FFFFFF", color: ink, bold: header || total || first || last, grid: null }
    case "none-grid":
      return { bg: "#FFFFFF", color: ink, bold: header || total || first || last, grid: ink }
    case "medium-2":
    default:
      // 中度样式 2：标题行、汇总行与首末列实色强调、正文 40% / 20% 交替、白色网格线
      if (header || total || first || last) return { bg: col, color: "#fff", bold: true, grid: "#ffffff" }
      return { bg: band ? tint(col, 0.62) : tint(col, 0.82), color: ink, bold: false, grid: "#ffffff" }
  }
}

export interface Merge {
  r: number
  c: number
  rs: number
  cs: number
}

export interface TableGeom {
  x: number
  y: number
  cols: number[]
  rowH: number
  nRows: number
}

export const colX = (g: TableGeom, c: number) => g.x + g.cols.slice(0, c).reduce((a, b) => a + b, 0)
export const rowY = (g: TableGeom, r: number) => g.y + g.rowH * r
export const tableW = (g: TableGeom) => g.cols.reduce((a, b) => a + b, 0)
export const tableH = (g: TableGeom) => g.rowH * g.nRows

/** 幻灯片坐标 960 × 540 = 13.333 in × 7.5 in：1 in = 72 单位（与检查器、列宽角标同一换算，PRD ED-05） */
export const PX_PER_IN = 72
export const toInches = (px: number) => (px / PX_PER_IN).toFixed(2)

/** 新表格默认行高 370840 EMU（约 0.41 in；50/24 §2.3、设计 03-30 §2.4） */
export const DEFAULT_ROW_H = (370840 / 914400) * PX_PER_IN

/** 单元格边距：OOXML 缺省左右 91440 EMU（0.1 in）、上下 45720 EMU（0.05 in），与检查器「左右 / 上下」一致 */
const CELL_MAR_X = 0.1 * PX_PER_IN
const CELL_MAR_Y = 0.05 * PX_PER_IN

export type CellAlign = "left" | "center" | "right"
const justify: Record<CellAlign, string> = { left: "justify-start", center: "justify-center", right: "justify-end tabular-nums" }

/**
 * 画布上的表格：CSS grid 绘制，合并格用 span；`cellClassName` / `cellChildren` 供选区、插入符等叠加。
 * 垂直对齐按 OOXML 缺省顶端（`a:tcPr@anchor` 缺省 t）并留上边距；水平对齐按列给出（`colAlign`，缺省左对齐，即新表格的样式默认），
 * 合并格沿用锚格所在列的对齐，合并本身不改对齐（50/24 §2.5）。
 */
export function SlideTable({
  geom,
  rows,
  styleId,
  flags,
  merges = [],
  colAlign,
  cellClassName,
  cellChildren,
  fontSize = 15,
  headerRows = 1,
}: {
  geom: TableGeom
  rows: string[][]
  styleId: string
  flags: TableFlags
  merges?: Merge[]
  /** 各列水平对齐（示例数据的数值列是用户设置的右对齐）；缺省全部左对齐 */
  colAlign?: CellAlign[]
  cellClassName?: (r: number, c: number) => string | undefined
  cellChildren?: (r: number, c: number) => ReactNode
  fontSize?: number
  /** 标题行行数（缺省 1；标题行标志只作用于第一行） */
  headerRows?: number
}) {
  const style = findTableStyle(styleId)
  const nRows = rows.length
  const nCols = geom.cols.length
  const covered = (r: number, c: number) => merges.some((m) => r >= m.r && r < m.r + m.rs && c >= m.c && c < m.c + m.cs && !(r === m.r && c === m.c))
  const gridStyle: CSSProperties = {
    left: geom.x, top: geom.y, width: tableW(geom), height: geom.rowH * nRows,
    gridTemplateColumns: geom.cols.map((w) => `${w}px`).join(" "),
    gridTemplateRows: `repeat(${nRows}, ${geom.rowH}px)`,
    fontSize,
  }
  return (
    <div className="absolute grid" style={gridStyle} role="table" aria-label={`表格 ${nRows} 行 ${nCols} 列`}>
      {rows.flatMap((row, r) => row.map((text, c) => {
        if (covered(r, c)) return null
        const m = merges.find((mm) => mm.r === r && mm.c === c)
        const p = cellPaint(style, flags, r, c, nRows, nCols, headerRows)
        return (
          <div
            key={`${r}-${c}`}
            role="cell"
            className={cn("relative flex items-start overflow-hidden leading-tight whitespace-nowrap", justify[colAlign?.[c] ?? "left"], cellClassName?.(r, c))}
            style={{
              gridRow: m ? `${r + 1} / span ${m.rs}` : undefined,
              gridColumn: m ? `${c + 1} / span ${m.cs}` : undefined,
              padding: `${CELL_MAR_Y}px ${CELL_MAR_X}px`,
              backgroundColor: p.bg,
              color: p.color,
              fontWeight: p.bold ? 600 : 400,
              boxShadow: [
                p.grid ? `inset -1px 0 0 ${p.grid}, inset 0 -1px 0 ${p.grid}` : "",
                p.rule && r < headerRows ? `inset 0 -2px 0 ${p.rule}` : "",
                p.rule && r >= headerRows ? `inset 0 2px 0 ${p.rule}` : "",
              ].filter(Boolean).join(", ") || undefined,
            }}
          >
            {text}
            {cellChildren?.(r, c)}
          </div>
        )
      }))}
    </div>
  )
}

/** 样式库缩略图：5 × 5 示意表，按当前 6 个标志绘制（缩略图与画布效果一致） */
export function TableStyleThumb({ style, flags, className }: { style: TableStyleDef; flags: TableFlags; className?: string }) {
  const n = 5
  const w = 44
  const h = 30
  const cw = w / n
  const rh = h / n
  const headRule = cellPaint(style, flags, 0, 0, n, n).rule
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("block aspect-[44/30] h-auto", className)} aria-hidden="true">
      <rect width={w} height={h} fill="#fff" />
      {Array.from({ length: n * n }).map((_, i) => {
        const r = Math.floor(i / n)
        const c = i % n
        const p = cellPaint(style, flags, r, c, n, n)
        return <rect key={i} x={c * cw} y={r * rh} width={cw} height={rh} fill={p.bg} stroke={p.grid ?? "none"} strokeWidth={p.grid ? 0.5 : 0} />
      })}
      {flags.headerRow && headRule && <line x1={0} x2={w} y1={rh} y2={rh} stroke={headRule} strokeWidth={0.9} />}
      {(style.family === "light-1" || style.family === "light-2") && (
        <>
          <line x1={0} x2={w} y1={0.4} y2={0.4} stroke={style.color} strokeWidth={0.8} />
          <line x1={0} x2={w} y1={h - 0.4} y2={h - 0.4} stroke={style.color} strokeWidth={0.8} />
        </>
      )}
    </svg>
  )
}
