import type { Box } from "../../kit"

/**
 * 表格场景（03-30）的数据、几何与样式模型。
 *
 * 几何一律用 cqw（1cqw = 幻灯片宽的 1%，幻灯片高 56.25cqw）：表格画在 SlideFrame 里（缩略图与画布同一渲染），
 * 画布叠加层（选中环、选区、手柄）用同一组数换成幻灯片百分比，保证两者重合。
 * 换算：幻灯片 960 × 540 pt = 13.333 × 7.5 in，1cqw = 9.6 pt，1 in = 72 pt；检查器与拖动角标都由几何换算成 pt（与其他对象同一单位；样张按 pt 书写、产品按设置的单位显示，rulings §4.25 DS-27）。
 *
 * 示例数据与示例文档一致：五个区域 Q2 各月营收（万元），各区域三月之和等于第 5 页原「区域分布」的 Q2 营收，
 * 各月合计等于第 4 页「营收趋势」的 4–6 月（38 / 42 / 48 百万元），Q2 合计 1.28 亿元（Q8 真实内容）。
 */

export const TABLE_PAGE = 5
export const SLIDE_H = 56.25

/** 纵向 cqw → 幻灯片高的百分比 */
export const yp = (cqw: number) => (cqw / SLIDE_H) * 100
/** cqw → in（两位小数） */
export const inch = (cqw: number) => ((cqw * 9.6) / 72).toFixed(2)
/** 检查器与拖动角标的显示值：pt（保留一位小数、去掉多余的 0）。单位与其他对象统一（底座 LENGTH_UNIT；样张按 pt，产品按设置的单位显示，rulings §4.25 DS-27） */
export const pts = (cqw: number) => String(Math.round(cqw * 9.6 * 10) / 10)
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

export interface Geom {
  x: number
  y: number
  /** 各列宽（cqw） */
  cols: number[]
  /** 行高（cqw） */
  rowH: number
  rows: number
}

/** 空内容占位符（版式「标题和内容」的正文占位符）：新表格填入它，宽取占位符框宽（03-30 §2.4，用户裁决 Q1） */
export const PLACEHOLDER = { x: 7, y: 21, w: 85.5, h: 26 }

/** 示例数据表：第 1 列 3.00 in，其余 2.80 in，行高 0.50 in（用户拉高过） */
const COLS = [22.5, 21, 21, 21]
const ROW_H = 3.75
/** 新表格：列等宽（宽取占位符框宽 11.40 in），行高 370840 EMU ≈ 0.41 in */
const NEW_COLS = [21.375, 21.375, 21.375, 21.375]
const NEW_ROW_H = 3.075

/** empty 空占位符 · new 新表格填入占位符 · new-free 页上没有空占位符时居中插入 · data 示例数据 · data-total 加合计行 · merged 合并后 · deleted 他人删掉华南行 */
export type Variant = "empty" | "new" | "new-free" | "data" | "data-total" | "merged" | "deleted"

export const HEADER = ["区域", "4 月", "5 月", "6 月"]
export const REGIONS: string[][] = [
  ["华东", "1,450", "1,600", "1,814"],
  ["华南", "910", "1,010", "1,152"],
  ["华北", "800", "880", "1,008"],
  ["西部", "420", "460", "528"],
  ["海外", "220", "250", "298"],
]
export const TOTAL = ["合计", "3,800", "4,200", "4,800"]

export interface Merge {
  r: number
  c: number
  rs: number
  cs: number
}

/** 合并后：「区域」跨 2 行、标题跨 3 列；只有第一行是标题行（03-30 §5.4） */
export const MERGES: Merge[] = [
  { r: 0, c: 0, rs: 2, cs: 1 },
  { r: 0, c: 1, rs: 1, cs: 3 },
]

export function rowsOf(v: Variant): string[][] {
  switch (v) {
    case "new":
    case "new-free":
      return [0, 1, 2].map(() => ["", "", "", ""])
    case "data":
      return [HEADER, ...REGIONS]
    case "data-total":
      return [HEADER, ...REGIONS, TOTAL]
    case "merged":
      return [["区域", "Q2 各月营收（万元）", "", ""], ["", "4 月", "5 月", "6 月"], ...REGIONS]
    case "deleted":
      return [HEADER, ...REGIONS.filter((r) => r[0] !== "华南")]
    default:
      return []
  }
}

export const mergesOf = (v: Variant): Merge[] => (v === "merged" ? MERGES : [])

/** 页上没有空内容占位符（版式「仅标题」）：宽取页宽 80%、水平居中，垂直落在视口中心（03-30 §2.4） */
const FREE_W = 80
const FREE_Y = (SLIDE_H - 3 * NEW_ROW_H) / 2

export function geomOf(v: Variant): Geom {
  if (v === "new") return { x: PLACEHOLDER.x, y: PLACEHOLDER.y, cols: NEW_COLS, rowH: NEW_ROW_H, rows: 3 }
  if (v === "new-free") return { x: (100 - FREE_W) / 2, y: FREE_Y, cols: [0, 1, 2, 3].map(() => FREE_W / 4), rowH: NEW_ROW_H, rows: 3 }
  return { x: PLACEHOLDER.x, y: PLACEHOLDER.y, cols: COLS, rowH: ROW_H, rows: rowsOf(v).length }
}

/** 第 r0–r1 行、第 c0–c1 列（0 起，含两端）在幻灯片上的框（百分比） */
export function cellsBox(g: Geom, r0: number, c0: number, r1 = r0, c1 = c0): Box {
  return {
    x: g.x + sum(g.cols.slice(0, c0)),
    y: yp(g.y + r0 * g.rowH),
    w: sum(g.cols.slice(c0, c1 + 1)),
    h: yp((r1 - r0 + 1) * g.rowH),
  }
}

export const tableBox = (g: Geom): Box => cellsBox(g, 0, 0, g.rows - 1, g.cols.length - 1)

/** 示例数据的数值列是用户设置的右对齐；新表格按样式默认左对齐（03-30 §3） */
export const alignRight = (v: Variant, c: number) => v !== "new" && v !== "new-free" && c > 0

/* ------------------------------------------------------------------ 表格样式与 6 个标志 */

export interface Flags {
  headerRow: boolean
  totalRow: boolean
  bandRow: boolean
  firstCol: boolean
  lastCol: boolean
  bandCol: boolean
}

/** 新表格默认勾标题行、镶边行（03-30 §6.3） */
export const DEFAULT_FLAGS: Flags = { headerRow: true, totalRow: false, bandRow: true, firstCol: false, lastCol: false, bandCol: false }

/** 2 列复选：左列行向、右列列向（按行排：标题行 / 第一列、汇总行 / 最后一列、镶边行 / 镶边列） */
export const FLAG_ITEMS: { key: keyof Flags; label: string }[] = [
  { key: "headerRow", label: "标题行" },
  { key: "firstCol", label: "第一列" },
  { key: "totalRow", label: "汇总行" },
  { key: "lastCol", label: "最后一列" },
  { key: "bandRow", label: "镶边行" },
  { key: "bandCol", label: "镶边列" },
]

/**
 * 文档主题色（幻灯片内容，不随界面主题变化）：深色 1 与强调 1–6。强调 1 即 .v3-slide 的 --s-brand。
 * 样式库缩略图画在检查器里（不在 .v3-slide 内，取不到 --s-*），所以这里用同值常量。
 */
const INK = "#141B2D"
export const ACCENTS = ["#3A5CE6", "#0E8A7A", "#E07A2E", "#8B5CF6", "#0B7FBF", "#B45309"] as const
export const BORDER_INK = INK

export type StyleGroup = "doc" | "light" | "medium" | "dark" | "other"
type Family =
  | "doc"
  | "light-1" | "light-2" | "light-3"
  | "medium-1" | "medium-2" | "medium-3" | "medium-4"
  | "dark-1" | "dark-2"
  | "themed-1" | "themed-2"
  | "none" | "none-grid"

export interface TableStyle {
  id: string
  name: string
  group: StyleGroup
  family: Family
  color: string
  /** 深色样式 2 的配对强调色（标题行用） */
  color2?: string
}

const TONE = { light: "浅色样式", medium: "中度样式", dark: "深色样式" } as const

/** 浅色 1–3、中度 1–4、深色 1：各 7 种（无强调 + 强调 1–6） */
function family(group: "light" | "medium" | "dark", n: number): TableStyle[] {
  return [INK, ...ACCENTS].map((color, i) => ({
    id: `${group}-${n}-${i}`,
    name: `${TONE[group]} ${n}${i === 0 ? "" : ` - 强调 ${i}`}`,
    group,
    family: `${group}-${n}` as Family,
    color,
  }))
}

const at = (i: number) => ACCENTS[i] ?? ACCENTS[0]

/** 内置 74 种（浅色 21 · 中等 28 · 深色 11 · 其它 14），文档中的样式排最前（03-30 §6.3） */
export const TABLE_STYLES: TableStyle[] = [
  { id: "doc-cordex", name: "Cordex 汇报表（文档中）", group: "doc", family: "doc", color: INK },
  ...family("light", 1),
  ...family("light", 2),
  ...family("light", 3),
  ...family("medium", 1),
  ...family("medium", 2),
  ...family("medium", 3),
  ...family("medium", 4),
  ...family("dark", 1),
  { id: "dark-2-0", name: "深色样式 2", group: "dark", family: "dark-2", color: "#4B566B", color2: INK },
  ...[0, 2, 4].map((k) => ({ id: `dark-2-${k + 1}`, name: `深色样式 2 - 强调 ${k + 1}/强调 ${k + 2}`, group: "dark" as const, family: "dark-2" as const, color: at(k), color2: at(k + 1) })),
  ...ACCENTS.map((color, i) => ({ id: `themed-1-${i + 1}`, name: `主题样式 1 - 强调 ${i + 1}`, group: "other" as const, family: "themed-1" as const, color })),
  ...ACCENTS.map((color, i) => ({ id: `themed-2-${i + 1}`, name: `主题样式 2 - 强调 ${i + 1}`, group: "other" as const, family: "themed-2" as const, color })),
  { id: "none-0", name: "无样式，无网格", group: "other", family: "none", color: INK },
  { id: "none-grid", name: "无样式，网格型", group: "other", family: "none-grid", color: INK },
]

/** 默认样式：中度样式 2 - 强调 1（{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}） */
export const DEFAULT_STYLE = "medium-2-1"
export const BUILTIN_COUNT = TABLE_STYLES.filter((s) => s.group !== "doc").length
export const findStyle = (id: string): TableStyle => TABLE_STYLES.find((s) => s.id === id) ?? TABLE_STYLES.find((s) => s.id === DEFAULT_STYLE)!

export const GROUP_LABEL: Record<StyleGroup, string> = { doc: "文档中", light: "浅色", medium: "中等", dark: "深色", other: "其它" }

/** 收起时每组只列首屏：浅色样式 1 × 5、中度样式 2 × 7、深色样式 1 × 5（03-30 §6.3） */
export function collapsedOf(g: StyleGroup): TableStyle[] {
  const all = TABLE_STYLES.filter((s) => s.group === g)
  if (g === "light") return all.filter((s) => s.family === "light-1").slice(0, 5)
  if (g === "medium") return all.filter((s) => s.family === "medium-2")
  if (g === "dark") return all.filter((s) => s.family === "dark-1").slice(0, 5)
  if (g === "other") return []
  return all
}

function mix(hex: string, target: number, t: number) {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (target - v) * t))
  return `rgb(${ch.join(" ")})`
}
const tint = (hex: string, t: number) => mix(hex, 255, t)
const shade = (hex: string, t: number) => mix(hex, 0, t)

export interface Paint {
  bg: string
  fg: string
  bold: boolean
  /** 内部网格线；null 为无 */
  grid: string | null
  /** 标题行下沿 / 汇总行上沿的强调线 */
  rule?: string
}

/**
 * 某格的着色（示意 table.renderer 的样式解析：整表 → 镶边 → 标题 / 汇总行 → 首 / 末列）。
 * 各族按 03-30 §6.3「样张的着色规则」近似，只求在样式库里彼此可辨；逐部件保真推迟（03-30 §13 第 1 条）。
 */
export function paint(s: TableStyle, f: Flags, r: number, c: number, nRows: number, nCols: number): Paint {
  const header = f.headerRow && r === 0
  const total = f.totalRow && r === nRows - 1
  const first = f.firstCol && c === 0
  const last = f.lastCol && c === nCols - 1
  const bodyIdx = r - (f.headerRow ? 1 : 0)
  const colIdx = c - (f.firstCol ? 1 : 0)
  const band = (f.bandRow && bodyIdx % 2 === 0) || (f.bandCol && colIdx % 2 === 0)
  const col = s.color
  const W = "#FFFFFF"
  switch (s.family) {
    case "doc":
      if (header) return { bg: INK, fg: W, bold: true, grid: W }
      if (total) return { bg: "#E4E7EC", fg: INK, bold: true, grid: W }
      return { bg: band ? "#F1F3F8" : W, fg: INK, bold: first || last, grid: "#E4E7EC" }
    case "light-1":
      if (header || total) return { bg: W, fg: INK, bold: true, grid: null, rule: col }
      return { bg: band ? tint(col, 0.84) : W, fg: INK, bold: first || last, grid: null }
    case "light-2":
      if (header) return { bg: col, fg: W, bold: true, grid: null }
      if (total) return { bg: W, fg: INK, bold: true, grid: null, rule: col }
      return { bg: W, fg: INK, bold: first || last, grid: band ? tint(col, 0.55) : null }
    case "light-3":
      if (header || total) return { bg: W, fg: col === INK ? INK : shade(col, 0.1), bold: true, grid: tint(col, 0.5), rule: col }
      return { bg: band ? tint(col, 0.88) : W, fg: INK, bold: first || last, grid: tint(col, 0.5) }
    case "medium-1":
      if (header || total) return { bg: col, fg: W, bold: true, grid: tint(col, 0.35) }
      return { bg: band ? tint(col, 0.8) : W, fg: INK, bold: first || last, grid: tint(col, 0.35) }
    case "medium-3":
      if (header || total) return { bg: col, fg: W, bold: true, grid: null }
      return { bg: band ? "#E6E8EE" : W, fg: INK, bold: first || last, grid: null }
    case "medium-4":
      if (header || total) return { bg: tint(col, 0.6), fg: INK, bold: true, grid: col }
      return { bg: band ? tint(col, 0.72) : tint(col, 0.86), fg: INK, bold: first || last, grid: col }
    case "dark-1":
      if (header || total) return { bg: shade(col, 0.45), fg: W, bold: true, grid: W }
      if (first || last) return { bg: shade(col, 0.25), fg: W, bold: true, grid: W }
      return { bg: band ? shade(col, 0.12) : col, fg: W, bold: false, grid: W }
    case "dark-2":
      if (header) return { bg: s.color2 ?? col, fg: W, bold: true, grid: null }
      if (total) return { bg: tint(col, 0.45), fg: INK, bold: true, grid: null, rule: INK }
      return { bg: band ? tint(col, 0.55) : tint(col, 0.75), fg: INK, bold: first || last, grid: null }
    case "themed-1":
      if (header || total) return { bg: col, fg: W, bold: true, grid: tint(col, 0.4) }
      return { bg: band ? tint(col, 0.86) : W, fg: INK, bold: first || last, grid: tint(col, 0.4) }
    case "themed-2":
      if (header || total) return { bg: shade(col, 0.2), fg: W, bold: true, grid: W }
      return { bg: band ? tint(col, 0.14) : col, fg: W, bold: first || last, grid: W }
    case "none":
      return { bg: W, fg: INK, bold: header || total || first || last, grid: null }
    case "none-grid":
      return { bg: W, fg: INK, bold: header || total || first || last, grid: INK }
    case "medium-2":
    default:
      // 中度样式 2：标题行、汇总行与首末列强调色实底白字，正文强调色约 38% / 18% 交替，白色网格线
      if (header || total || first || last) return { bg: col, fg: W, bold: true, grid: W }
      return { bg: band ? tint(col, 0.62) : tint(col, 0.82), fg: INK, bold: false, grid: W }
  }
}

/* ------------------------------------------------------------------ 边框预设（10 个，03-30 §6.4） */

export type BorderPreset = "none" | "all" | "outer" | "inner" | "innerH" | "top" | "bottom" | "left" | "right" | "innerV"

/** 5 × 2：无 / 所有 / 外侧 / 内部 / 内部横；上 / 下 / 左 / 右 / 内部竖 */
export const BORDER_PRESETS: { v: BorderPreset; label: string }[] = [
  { v: "none", label: "无框线" },
  { v: "all", label: "所有框线" },
  { v: "outer", label: "外侧框线" },
  { v: "inner", label: "内部框线" },
  { v: "innerH", label: "内部横框线" },
  { v: "top", label: "上框线" },
  { v: "bottom", label: "下框线" },
  { v: "left", label: "左框线" },
  { v: "right", label: "右框线" },
  { v: "innerV", label: "内部竖框线" },
]

/** 预设 → 要画的边（检查器图标与画布预览共用） */
export function borderEdges(v: BorderPreset) {
  return {
    top: v === "all" || v === "outer" || v === "top",
    bottom: v === "all" || v === "outer" || v === "bottom",
    left: v === "all" || v === "outer" || v === "left",
    right: v === "all" || v === "outer" || v === "right",
    h: v === "all" || v === "inner" || v === "innerH",
    v: v === "all" || v === "inner" || v === "innerV",
  }
}
