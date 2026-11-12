/**
 * 图表样张的数据与类型（50/24 §3；PRD ED-15a / ED-15、G-63；ADR-0036）。
 * 可编辑五类：柱形 / 条形（同一类，方向不同）、折线、饼、面积、散点；菜单按 PowerPoint 习惯把柱形与条形分成两项，共六项。
 * 系列颜色取文档主题 accent1…accent6（幻灯片内容，不随界面亮暗变化）。
 */
import { ChartArea, ChartBar, ChartColumn, ChartLine, ChartPie, ChartScatter, type LucideIcon } from "lucide-react"

export type ChartKind = "column" | "bar" | "line" | "pie" | "area" | "scatter"
export type ChartVariant = "clustered" | "stacked" | "percent" | "plain" | "markers" | "smooth"

export interface ChartSpec {
  kind: ChartKind
  variant: ChartVariant
}

export interface ChartSubtype extends ChartSpec {
  name: string
}

export interface ChartFamily {
  kind: ChartKind
  label: string
  icon: LucideIcon
  subtypes: ChartSubtype[]
}

export const chartFamilies: ChartFamily[] = [
  {
    kind: "column", label: "柱形图", icon: ChartColumn, subtypes: [
      { kind: "column", variant: "clustered", name: "簇状柱形图" },
      { kind: "column", variant: "stacked", name: "堆积柱形图" },
      { kind: "column", variant: "percent", name: "百分比堆积柱形图" },
    ],
  },
  {
    kind: "bar", label: "条形图", icon: ChartBar, subtypes: [
      { kind: "bar", variant: "clustered", name: "簇状条形图" },
      { kind: "bar", variant: "stacked", name: "堆积条形图" },
      { kind: "bar", variant: "percent", name: "百分比堆积条形图" },
    ],
  },
  {
    kind: "line", label: "折线图", icon: ChartLine, subtypes: [
      { kind: "line", variant: "plain", name: "折线图" },
      { kind: "line", variant: "markers", name: "带数据标记的折线图" },
      { kind: "line", variant: "stacked", name: "堆积折线图" },
    ],
  },
  { kind: "pie", label: "饼图", icon: ChartPie, subtypes: [{ kind: "pie", variant: "plain", name: "饼图" }] },
  {
    kind: "area", label: "面积图", icon: ChartArea, subtypes: [
      { kind: "area", variant: "plain", name: "面积图" },
      { kind: "area", variant: "stacked", name: "堆积面积图" },
      { kind: "area", variant: "percent", name: "百分比堆积面积图" },
    ],
  },
  {
    kind: "scatter", label: "散点图", icon: ChartScatter, subtypes: [
      { kind: "scatter", variant: "markers", name: "仅带数据标记的散点图" },
      { kind: "scatter", variant: "smooth", name: "带平滑线和数据标记的散点图" },
    ],
  },
]

export function findSubtype(spec: ChartSpec): ChartSubtype {
  const fam = chartFamilies.find((f) => f.kind === spec.kind) ?? chartFamilies[0]!
  return fam.subtypes.find((s) => s.variant === spec.variant) ?? fam.subtypes[0]!
}

/** 文档主题强调色 accent1…accent6（幻灯片内容色，亮暗界面下不变） */
export const ACCENTS = ["#3A5CE6", "#0E8A7A", "#E07A2E", "#8B5CF6", "#0B7FBF", "#B45309"]

/**
 * 第 7 个起的系列色按主题色亮度派生（50/24 §3.3；同 PowerPoint 默认图表样式）：每 6 个一轮，
 * 第二轮 accent 亮度 × 60%（更深），第三轮 × 80% + 20%（更浅），之后依次 × 80%、× 60% + 40%、× 50%，再循环；
 * 产品写主题引用 `schemeClr accentN` + `lumMod` / `lumOff`，不写 RGB。
 */
const LUM_STEPS: [number, number][] = [[1, 0], [0.6, 0], [0.8, 0.2], [0.8, 0], [0.6, 0.4], [0.5, 0]]

export function seriesColor(i: number): string {
  const base = ACCENTS[((i % ACCENTS.length) + ACCENTS.length) % ACCENTS.length]!
  const round = Math.floor(Math.max(0, i) / ACCENTS.length) % LUM_STEPS.length
  if (round === 0) return base
  const [mod, off] = LUM_STEPS[round]!
  return adjustLuminance(base, mod, off)
}

function adjustLuminance(hex: string, mod: number, off: number): string {
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
  const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0")
  return s === 0 ? `#${to(l2)}${to(l2)}${to(l2)}` : `#${to(hue(h + 1 / 3))}${to(hue(h))}${to(hue(h - 1 / 3))}`
}

/**
 * 「图表 ▾」、占位符图标条 › 图表在 M2 或图表编辑组件未装载时的禁用原因（设计 03-31「禁用原因」是文案权威；50/10 §4 `enablement: slide.hasChartEditor`）。
 * 图表样张与表格样张共用这一条，M2 恒禁用（40/10）。
 */
export const CHART_DISABLED_REASON = "插入图表在 M3 提供：需要装载图表编辑组件。文稿里已有的图表照常查看、放映、移动和缩放。"

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

/** 50/24 §3.3 示例数据：4 类别 × 3 系列（PowerPoint 默认示例数值） */
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

/** 图例位置（50/24 §3.4 `legend.position`：b / t / l / r / tr）；`none` = 不显示图例 */
export type LegendPos = "bottom" | "top" | "left" | "right" | "topRight" | "none"

/** 饼图数据标签的组成（`dataLabels` 的 showPercent / showCategory / showValue，可多选） */
export interface PieLabelParts {
  percent: boolean
  category: boolean
  value: boolean
}

export interface ChartOptions {
  title: boolean
  titleText: string
  legend: LegendPos
  dataLabels: boolean
  /** 饼图的数据标签组成；缺省只显示百分比 */
  pieLabels?: PieLabelParts
}

export const defaultPieLabels: PieLabelParts = { percent: true, category: false, value: false }

export const defaultChartOptions: ChartOptions = { title: true, titleText: "图表标题", legend: "bottom", dataLabels: false }
