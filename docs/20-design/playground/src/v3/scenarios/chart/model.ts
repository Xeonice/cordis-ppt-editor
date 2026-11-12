import { ChartArea, ChartBar, ChartColumn, ChartLine, ChartPie, ChartScatter, type LucideIcon } from "lucide-react"

/**
 * 图表场景（03-31，G-63；PRD ED-15a 插入图表、ED-15 数据编辑；50/24 §3；ADR-0036）的数据、类型与几何。
 * 可编辑五类：柱形 / 条形（同一类 bar，方向不同）、折线、饼、面积、散点；菜单按 PowerPoint 习惯把柱形与条形分成两项，共六项。
 * 系列色取文档主题 accent1…accent6（幻灯片内容色，亮暗界面下不变），第 7 个起按亮度派生（50/24 §3.3）。
 *
 * 几何一律用 cqw（1cqw = 幻灯片宽的 1%，幻灯片高 56.25cqw），检查器换算成 pt（960 × 540 pt：1cqw = 9.6 pt；
 * 样张数值按 pt 书写、产品按设置的度量单位显示，rulings §4.25 DS-27，§4.22 SR-4 结案）。
 */

export type ChartKind = "column" | "bar" | "line" | "pie" | "area" | "scatter"
export type ChartVariant = "clustered" | "stacked" | "percent" | "plain" | "markers" | "smooth"

export interface ChartSpec {
  kind: ChartKind
  variant: ChartVariant
}

export interface ChartSubtype extends ChartSpec {
  /** 子类型名（tooltip、读屏名、toast 用） */
  name: string
  /** 子类型格里的分行（12px 汉字放不下一行时按词断开，不断在词中间） */
  lines: string[]
}

export interface ChartFamily {
  kind: ChartKind
  label: string
  Icon: LucideIcon
  subtypes: ChartSubtype[]
}

export const FAMILIES: ChartFamily[] = [
  {
    kind: "column",
    label: "柱形图",
    Icon: ChartColumn,
    subtypes: [
      { kind: "column", variant: "clustered", name: "簇状柱形图", lines: ["簇状柱形图"] },
      { kind: "column", variant: "stacked", name: "堆积柱形图", lines: ["堆积柱形图"] },
      { kind: "column", variant: "percent", name: "百分比堆积柱形图", lines: ["百分比堆积", "柱形图"] },
    ],
  },
  {
    kind: "bar",
    label: "条形图",
    Icon: ChartBar,
    subtypes: [
      { kind: "bar", variant: "clustered", name: "簇状条形图", lines: ["簇状条形图"] },
      { kind: "bar", variant: "stacked", name: "堆积条形图", lines: ["堆积条形图"] },
      { kind: "bar", variant: "percent", name: "百分比堆积条形图", lines: ["百分比堆积", "条形图"] },
    ],
  },
  {
    kind: "line",
    label: "折线图",
    Icon: ChartLine,
    subtypes: [
      { kind: "line", variant: "plain", name: "折线图", lines: ["折线图"] },
      { kind: "line", variant: "markers", name: "带数据标记的折线图", lines: ["带数据标记的", "折线图"] },
      { kind: "line", variant: "stacked", name: "堆积折线图", lines: ["堆积折线图"] },
    ],
  },
  { kind: "pie", label: "饼图", Icon: ChartPie, subtypes: [{ kind: "pie", variant: "plain", name: "饼图", lines: ["饼图"] }] },
  {
    kind: "area",
    label: "面积图",
    Icon: ChartArea,
    subtypes: [
      { kind: "area", variant: "plain", name: "面积图", lines: ["面积图"] },
      { kind: "area", variant: "stacked", name: "堆积面积图", lines: ["堆积面积图"] },
      { kind: "area", variant: "percent", name: "百分比堆积面积图", lines: ["百分比堆积", "面积图"] },
    ],
  },
  {
    kind: "scatter",
    label: "散点图",
    Icon: ChartScatter,
    subtypes: [
      { kind: "scatter", variant: "markers", name: "仅带数据标记的散点图", lines: ["仅带数据标记的", "散点图"] },
      { kind: "scatter", variant: "smooth", name: "带平滑线和数据标记的散点图", lines: ["带平滑线和数据", "标记的散点图"] },
    ],
  },
]

export const familyOf = (kind: ChartKind): ChartFamily => FAMILIES.find((f) => f.kind === kind) ?? FAMILIES[0]!

export function findSubtype(spec: ChartSpec): ChartSubtype {
  const fam = familyOf(spec.kind)
  return fam.subtypes.find((s) => s.variant === spec.variant) ?? fam.subtypes[0]!
}

export const PIE_SUBTYPE: ChartSubtype = FAMILIES[3]!.subtypes[0]!
export const COLUMN: ChartSpec = { kind: "column", variant: "clustered" }
export const LINE_MARKERS: ChartSpec = { kind: "line", variant: "markers" }

/* ------------------------------------------------------------------ 系列色 */

/** 文档主题 accent1…accent6（幻灯片内容色） */
export const ACCENTS = ["#3A5CE6", "#0E8A7A", "#E07A2E", "#8B5CF6", "#0B7FBF", "#B45309"]

/**
 * 第 7 个起的系列色按主题色亮度派生（50/24 §3.3，同 PowerPoint 默认图表样式）：每 6 个一轮，
 * 依次叠加 lumMod / lumOff；产品写主题引用 schemeClr accentN + lumMod / lumOff，不写 RGB。
 */
const LUM_STEPS: [number, number][] = [
  [1, 0],
  [0.6, 0],
  [0.8, 0.2],
  [0.8, 0],
  [0.6, 0.4],
  [0.5, 0],
]

export function seriesColor(i: number): string {
  const base = ACCENTS[((i % ACCENTS.length) + ACCENTS.length) % ACCENTS.length]!
  const round = Math.floor(Math.max(0, i) / ACCENTS.length) % LUM_STEPS.length
  if (round === 0) return base
  const [mod, off] = LUM_STEPS[round]!
  return lum(base, mod, off)
}

function lum(hex: string, mod: number, off: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h /= 6
  }
  const l2 = Math.min(1, Math.max(0, l * mod + off))
  const q = l2 < 0.5 ? l2 * (1 + s) : l2 + s - l2 * s
  const p = 2 * l2 - q
  const hue = (t: number) => {
    const tt = t < 0 ? t + 1 : t > 1 ? t - 1 : t
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  const to = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0")
  return s === 0 ? `#${to(l2)}${to(l2)}${to(l2)}` : `#${to(hue(h + 1 / 3))}${to(hue(h))}${to(hue(h - 1 / 3))}`
}

/* ------------------------------------------------------------------ 数据 */

export interface ChartSeries {
  name: string
  values: (number | null)[]
}

export interface ChartData {
  categories: string[]
  series: ChartSeries[]
  /** 散点：X 列 */
  x?: number[]
}

export const cloneData = (d: ChartData): ChartData => ({ categories: [...d.categories], series: d.series.map((s) => ({ name: s.name, values: [...s.values] })), x: d.x ? [...d.x] : undefined })

/** 50/24 §3.3 示例数据（PowerPoint 默认示例数值）：柱形、条形、折线、面积 4 类别 × 3 系列；饼 1 个系列；散点 3 个点 */
export function sampleData(kind: ChartKind): ChartData {
  if (kind === "pie") return { categories: ["类别 1", "类别 2", "类别 3", "类别 4"], series: [{ name: "系列 1", values: [8.2, 3.2, 1.4, 1.2] }] }
  if (kind === "scatter") return { categories: ["点 1", "点 2", "点 3"], x: [0.7, 1.8, 2.6], series: [{ name: "系列 1", values: [2.7, 3.2, 0.8] }] }
  return {
    categories: ["类别 1", "类别 2", "类别 3", "类别 4"],
    series: [
      { name: "系列 1", values: [4.3, 2.5, 3.5, 4.5] },
      { name: "系列 2", values: [2.4, 4.4, 1.8, 2.8] },
      { name: "系列 3", values: [2, 2, 3, 5] },
    ],
  }
}

/** 示例文档第 5 页「区域分布」的季度数据（百万元）：导入的图表、标题 / 图例 / 数据标签演示用 */
export function regionData(): ChartData {
  return {
    categories: ["第一季度", "第二季度", "第三季度", "第四季度"],
    series: [
      { name: "华东", values: [4.3, 4.9, 5.6, 6.2] },
      { name: "华北", values: [3.1, 3.4, 3.2, 3.9] },
      { name: "华南", values: [2.2, 2.8, 3.3, 3.6] },
    ],
  }
}

/** 饼图演示：三个系列（饼图只画第一个，网格第二列起变淡） */
export function pieData(): ChartData {
  return {
    categories: ["线上直营", "渠道分销", "大客户", "其它"],
    series: [
      { name: "本年", values: [8.2, 3.2, 1.4, 1.2] },
      { name: "去年", values: [7.1, 3.6, 1.2, 1.5] },
      { name: "前年", values: [6.4, 3.9, 1.1, 1.6] },
    ],
  }
}

/** 紧凑网格超限演示：10 类别 × 7 系列（第 7 个系列色按 accent1 亮度派生） */
export function wideData(): ChartData {
  const regions = ["华北", "华东", "华南", "华中", "西南", "西北", "东北"]
  const categories = Array.from({ length: 10 }, (_, i) => `${i + 1} 月`)
  return {
    categories,
    series: regions.map((name, s) => ({
      name,
      values: categories.map((_, c) => Math.round((2 + s * 0.55 + Math.sin((c + s * 1.7) / 1.6) * 0.9 + c * 0.12) * 10) / 10),
    })),
  }
}

/** 类型切换时的数据换算（50/24 §3.8）：切到散点时类别名能解析为数值则作 X，否则 1…n；切出散点去掉 X 列；饼图保留全部系列、只画第一个 */
export function convertData(d: ChartData, to: ChartKind): ChartData {
  if (to === "scatter" && !d.x) return { ...cloneData(d), x: d.categories.map((c, i) => (/^\s*-?\d+(\.\d+)?\s*$/.test(c) ? Number(c) : i + 1)) }
  if (to !== "scatter" && d.x) return { categories: [...d.categories], series: d.series.map((s) => ({ name: s.name, values: [...s.values] })) }
  return d
}

/* ------------------------------------------------------------------ 选项 */

/** 图例位置（50/24 §3.4 legend.position：b / t / l / r / tr）；none = 不显示 */
export type LegendPos = "bottom" | "top" | "left" | "right" | "topRight"
export const LEGEND_LABEL: Record<LegendPos, string> = { bottom: "底部", top: "顶部", left: "左侧", right: "右侧", topRight: "右上" }
export const LEGEND_ORDER: LegendPos[] = ["bottom", "top", "left", "right", "topRight"]

/** 饼图数据标签组成（dataLabels 的 showPercent / showCategory / showValue，可多选） */
export interface PieLabels {
  percent: boolean
  category: boolean
  value: boolean
}

export interface ChartOptions {
  title: boolean
  titleText: string
  legend: LegendPos | "none"
  dataLabels: boolean
  pieLabels: PieLabels
}

export const DEFAULT_PIE_LABELS: PieLabels = { percent: true, category: false, value: false }
export const DEFAULT_OPTIONS: ChartOptions = { title: true, titleText: "图表标题", legend: "bottom", dataLabels: false, pieLabels: DEFAULT_PIE_LABELS }

/* ------------------------------------------------------------------ 几何（cqw） */

export const CHART_PAGE = 5
export const SLIDE_H = 56.25

export interface CqBox {
  x: number
  y: number
  w: number
  h: number
}

/** 「标题和内容」版式的正文占位符（插入即填入，用户裁决 2026-09-30 Q1） */
export const CONTENT_BOX: CqBox = { x: 7, y: 17, w: 86, h: 32.5 }
/** 「两栏内容」版式：左栏是导入的图表，右栏是空内容占位符（M2 演示） */
export const LEFT_BOX: CqBox = { x: 7, y: 17, w: 41.75, h: 32.5 }
export const RIGHT_BOX: CqBox = { x: 51.25, y: 17, w: 41.75, h: 32.5 }

/** cqw 框 → 幻灯片百分比框（叠加层定位用） */
export const pct = (b: CqBox) => ({ x: b.x, y: (b.y / SLIDE_H) * 100, w: b.w, h: (b.h / SLIDE_H) * 100 })
/** cqw → pt（整数） */
export const pt = (cqw: number) => Math.round(cqw * 9.6)

/* ------------------------------------------------------------------ 紧凑网格 */

/** 检查器紧凑网格最多显示的类别行 × 系列列（50/24 §3.7）；超出的在数据面板里编辑 */
export const COMPACT = { rows: 8, cols: 4 } as const

export const isTruncated = (d: ChartData) => d.categories.length > COMPACT.rows || d.series.length > COMPACT.cols

export const PIE_NOTE = "饼图只画第一个系列"
export const PIE_NOTE_LONG = "饼图只画第一个系列；其余系列保留在数据里，切回其它类型后重新画出"

/**
 * 「图表 ▾」、占位符图标条 › 图表在 M2 或图表编辑组件未装载时的禁用原因（03-31「禁用原因」原文）。
 */
export const CHART_DISABLED_REASON = "插入图表在 M3 提供：需要装载图表编辑组件。文稿里已有的图表照常查看、放映、移动和缩放。"
export const P2_REASON = "坐标轴范围、数字格式、趋势线与误差线排在后续版本（P2）；导入文件里已有的设置原样保留。"

/** 数值解析（示意 numfmt 严格解析，50/24 §3.6）：留空为 null；无法解析返回 undefined（不提交） */
export function parseValue(text: string): number | null | undefined {
  const t = text.trim()
  if (t === "") return null
  if (!/^-?\d+(\.\d+)?$/.test(t)) return undefined
  return Number(t)
}

export const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v))
