import type { ReactNode } from "react"
import { ACCENTS, DEFAULT_PIE_LABELS, seriesColor, type ChartData, type ChartOptions, type ChartSpec } from "./model"

/**
 * 样张用的图表渲染（示意 slide-render-chart 的输出，ADR-0036；真实外观以自研布局为准，03-31 推迟项 14）：
 * 柱形 / 条形（簇状、堆积、百分比）、折线（折线、带标记、堆积）、饼、面积（面积、堆积、百分比）、散点（标记、平滑线）。
 * 用 viewBox 画（单位是 pt，与幻灯片 960 × 540 同一口径），宽高随外框缩放，画布、缩略图与网格视图同一渲染（Q8）。
 * thumb：类型缩略图，去掉标题、坐标轴与文字，只留图形。空值按缺口画（新图表 dispBlanksAs gap）。
 * 颜色是幻灯片内容（文档主题 accent1–6 与墨色），不随界面亮暗变化。
 */

const INK = "#141B2D"
const FONT = 'system-ui, -apple-system, "PingFang SC", "Noto Sans CJK SC", sans-serif'

function niceScale(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 1, step: 0.2 }
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 25, 50, 100]
  const step = steps.find((s) => max / s <= 6) ?? 100
  return { top: Math.ceil(max / step - 1e-9) * step, step }
}

const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

/** 文字宽度估算（汉字按字号，其余按 0.6 字号） */
const textW = (t: string, size: number) => [...t].reduce((a, ch) => a + (/[㐀-鿿＀-￯]/.test(ch) ? size : size * 0.6), 0)

/** Catmull-Rom → 三次贝塞尔：散点「带平滑线」 */
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return ""
  let d = `M${pts[0]![0]},${pts[0]![1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    const p3 = pts[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`
  }
  return d
}

const NO_OPTIONS: ChartOptions = { title: false, titleText: "", legend: "none", dataLabels: false, pieLabels: DEFAULT_PIE_LABELS }

export function ChartSvg({
  spec,
  data,
  options,
  width,
  height,
  thumb = false,
  trendline,
  className,
}: {
  spec: ChartSpec
  data: ChartData
  options?: ChartOptions
  /** viewBox 宽高（pt，或缩略图的 px） */
  width: number
  height: number
  thumb?: boolean
  /** 演示「导入的图表带趋势线」：给第 N 个系列画一条线性趋势线（仅簇状柱形 / 折线） */
  trendline?: number
  className?: string
}) {
  const o = options ?? NO_OPTIONS
  const showTitle = !thumb && o.title && o.titleText.trim() !== ""
  const legend = thumb ? "none" : o.legend
  const pad = thumb ? 4 : 14
  const isPie = spec.kind === "pie"
  const legendItems = isPie ? data.categories : data.series.map((s) => s.name)
  const legendColW = Math.max(60, ...legendItems.map((t) => 18 + textW(t, 13))) + 12

  // 外框：标题 / 图例 / 坐标轴标签依次从四边扣除
  let top = pad + (showTitle ? 36 : 0)
  let bottom = height - pad
  let left = pad
  let right = width - pad
  if (legend === "top") top += 28
  if (legend === "bottom") bottom -= 28
  if (legend === "left") left += legendColW
  if (legend === "right" || legend === "topRight") right -= legendColW

  const nCat = data.categories.length
  const nSer = data.series.length
  const raw = (s: number, c: number) => data.series[s]?.values[c] ?? null
  const val = (s: number, c: number) => raw(s, c) ?? 0
  const sums = data.categories.map((_, c) => data.series.reduce((a, _s, s) => a + val(s, c), 0))
  const stacked = spec.variant === "stacked" || spec.variant === "percent"
  const percent = spec.variant === "percent"
  const norm = (s: number, c: number) => (percent ? (val(s, c) / (sums[c] || 1)) * 100 : val(s, c))
  const cum = (s: number, c: number) => {
    let t = 0
    for (let k = 0; k <= s; k++) t += norm(k, c)
    return t
  }

  const els: ReactNode[] = []
  const labels: ReactNode[] = []
  const axis: ReactNode[] = []
  const label = (key: string, x: number, y: number, t: string, white = false, anchor: "middle" | "start" = "middle") =>
    labels.push(
      <text key={key} x={x} y={y} textAnchor={anchor} dominantBaseline="central" fontSize={12} fontWeight={white ? 600 : 400} fill={white ? "#FFFFFF" : INK} fillOpacity={white ? 1 : 0.78}>
        {t}
      </text>,
    )

  if (isPie) {
    const cx = (left + right) / 2
    const cy = (top + bottom) / 2
    const r = Math.max(4, Math.min(right - left, bottom - top) / 2 - (thumb ? 0 : 4))
    const vals = data.series[0]?.values.map((v) => v ?? 0) ?? []
    const total = vals.reduce((a, b) => a + b, 0) || 1
    let a0 = -Math.PI / 2
    vals.forEach((v, i) => {
      if (v <= 0) return
      const a1 = a0 + (v / total) * Math.PI * 2
      const large = a1 - a0 > Math.PI ? 1 : 0
      const p = (a: number, rr = r) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const
      const [x0, y0] = p(a0)
      const [x1, y1] = p(a1)
      els.push(<path key={`s${i}`} d={`M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z`} fill={seriesColor(i)} stroke="#FFFFFF" strokeWidth={thumb ? 0.6 : 1.5} />)
      if (o.dataLabels && !thumb) {
        // 组成按检查器三个复选：类别名一行，值与百分比一行（「, 」分隔，PowerPoint 默认）
        const parts = o.pieLabels
        const lines: string[] = []
        if (parts.category) lines.push(data.categories[i] ?? "")
        const nums = [parts.value ? num(v) : "", parts.percent ? `${Math.round((v / total) * 100)}%` : ""].filter(Boolean)
        if (nums.length) lines.push(nums.join(", "))
        const [lx, ly] = p((a0 + a1) / 2, r * 0.66)
        if (lines.length)
          labels.push(
            <text key={`l${i}`} x={lx} y={ly - ((lines.length - 1) * 15) / 2} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600} fill="#FFFFFF">
              {lines.map((t, k) => (
                <tspan key={k} x={lx} dy={k === 0 ? 0 : 15}>
                  {t}
                </tspan>
              ))}
            </text>,
          )
      }
      a0 = a1
    })
  } else if (spec.kind === "scatter") {
    const xs = data.x ?? data.categories.map((_, i) => i + 1)
    const xScale = niceScale(Math.max(...xs))
    const yScale = niceScale(Math.max(...data.series.flatMap((s) => s.values.map((v) => v ?? 0))))
    if (!thumb) {
      left += 32
      bottom -= 24
    }
    const X = (v: number) => left + (v / xScale.top) * (right - left)
    const Y = (v: number) => bottom - (v / yScale.top) * (bottom - top)
    if (!thumb) {
      for (let t = 0; t <= yScale.top + 1e-9; t += yScale.step) {
        axis.push(<line key={`gy${t}`} x1={left} x2={right} y1={Y(t)} y2={Y(t)} stroke={INK} strokeOpacity={0.1} />)
        axis.push(<text key={`ty${t}`} x={left - 6} y={Y(t)} textAnchor="end" dominantBaseline="central" fontSize={13} fill={INK} fillOpacity={0.6}>{num(t)}</text>)
      }
      for (let t = 0; t <= xScale.top + 1e-9; t += xScale.step) {
        axis.push(<text key={`tx${t}`} x={X(t)} y={bottom + 17} textAnchor="middle" fontSize={13} fill={INK} fillOpacity={0.6}>{num(t)}</text>)
      }
    }
    data.series.forEach((s, si) => {
      const pts = xs
        .map((x, i) => (s.values[i] === null || s.values[i] === undefined ? null : ([X(x), Y(s.values[i] ?? 0)] as [number, number])))
        .filter((p): p is [number, number] => !!p)
        .sort((a, b) => a[0] - b[0])
      if (spec.variant === "smooth") els.push(<path key={`p${si}`} d={smoothPath(pts)} fill="none" stroke={seriesColor(si)} strokeWidth={thumb ? 1.2 : 2.25} />)
      pts.forEach(([x, y], i) => els.push(<circle key={`m${si}-${i}`} cx={x} cy={y} r={thumb ? 1.8 : 5} fill={seriesColor(si)} stroke="#FFFFFF" strokeWidth={thumb ? 0.5 : 1.5} />))
      if (o.dataLabels && !thumb) s.values.forEach((v, i) => v !== null && label(`l${si}-${i}`, X(xs[i]!), Y(v) - 12, num(v)))
    })
  } else {
    const horizontal = spec.kind === "bar"
    const max = percent ? 100 : stacked ? Math.max(...sums) : Math.max(...data.series.flatMap((s) => s.values.map((v) => v ?? 0)))
    const scale = niceScale(max)
    if (!thumb) {
      if (horizontal) {
        left += Math.max(36, ...data.categories.map((c) => textW(c, 13))) + 8
        bottom -= 22
      } else {
        left += 30
        bottom -= 24
      }
    }
    const plotW = right - left
    const plotH = bottom - top
    const V = (v: number) => (v / scale.top) * (horizontal ? plotW : plotH)
    const band = (horizontal ? plotH : plotW) / Math.max(1, nCat)
    const areaX = (c: number) => left + (nCat > 1 ? (plotW * c) / (nCat - 1) : plotW / 2)
    if (!thumb) {
      for (let t = 0; t <= scale.top + 1e-9; t += scale.step) {
        const lbl = percent ? `${Math.round(t)}%` : num(t)
        if (horizontal) {
          axis.push(<line key={`g${t}`} x1={left + V(t)} x2={left + V(t)} y1={top} y2={bottom} stroke={INK} strokeOpacity={0.1} />)
          axis.push(<text key={`t${t}`} x={left + V(t)} y={bottom + 17} textAnchor="middle" fontSize={13} fill={INK} fillOpacity={0.6}>{lbl}</text>)
        } else {
          axis.push(<line key={`g${t}`} x1={left} x2={right} y1={bottom - V(t)} y2={bottom - V(t)} stroke={INK} strokeOpacity={0.1} />)
          axis.push(<text key={`t${t}`} x={left - 6} y={bottom - V(t)} textAnchor="end" dominantBaseline="central" fontSize={13} fill={INK} fillOpacity={0.6}>{lbl}</text>)
        }
      }
      data.categories.forEach((c, i) => {
        // 条形图类别自下而上（PowerPoint 默认：第一个类别在最下）
        const center = horizontal ? bottom - band * (i + 0.5) : spec.kind === "area" ? areaX(i) : left + band * (i + 0.5)
        axis.push(
          horizontal ? (
            <text key={`c${i}`} x={left - 6} y={center} textAnchor="end" dominantBaseline="central" fontSize={13} fill={INK} fillOpacity={0.6}>{c}</text>
          ) : (
            <text key={`c${i}`} x={center} y={bottom + 17} textAnchor="middle" fontSize={13} fill={INK} fillOpacity={0.6}>{c}</text>
          ),
        )
      })
      axis.push(horizontal ? <line key="ax" x1={left} x2={left} y1={top} y2={bottom} stroke={INK} strokeOpacity={0.3} /> : <line key="ax" x1={left} x2={right} y1={bottom} y2={bottom} stroke={INK} strokeOpacity={0.3} />)
    }

    if (spec.kind === "column" || spec.kind === "bar") {
      const groupW = band * (stacked ? 0.5 : 0.64)
      const barW = stacked ? groupW : groupW / Math.max(1, nSer)
      data.categories.forEach((_, c) => {
        const start = (horizontal ? bottom - band * (c + 1) : left + band * c) + (band - groupW) / 2
        data.series.forEach((_s, s) => {
          if (raw(s, c) === null) return
          const v = norm(s, c)
          const base = stacked ? cum(s, c) - v : 0
          const len = V(v)
          const gap = stacked ? 0 : thumb ? 0.6 : 1.5
          const x = horizontal ? left + V(base) : start + (stacked ? 0 : barW * s)
          const y = horizontal ? start + (stacked ? 0 : barW * (nSer - 1 - s)) : bottom - V(base) - len
          const w = horizontal ? len : barW - gap
          const h = horizontal ? barW - gap : len
          els.push(<rect key={`b${c}-${s}`} x={x} y={y} width={Math.max(0, w)} height={Math.max(0, h)} fill={seriesColor(s)} stroke={stacked ? "#FFFFFF" : undefined} strokeWidth={stacked ? (thumb ? 0.4 : 1) : undefined} />)
          if (o.dataLabels && !thumb) {
            // 百分比堆积也显示原值（PowerPoint 默认 showValue；50/24 §3.4）
            const t = num(val(s, c))
            if (stacked) label(`l${c}-${s}`, x + w / 2, y + h / 2, t, true)
            else if (horizontal) label(`l${c}-${s}`, x + w + 4, y + h / 2, t, false, "start")
            else label(`l${c}-${s}`, x + w / 2, y - 9, t)
          }
        })
      })
    } else {
      // 折线点在类别带中心，面积点铺满绘图区；空值断开（缺口）
      const px = (c: number) => (spec.kind === "area" ? areaX(c) : left + band * (c + 0.5))
      const py = (s: number, c: number) => bottom - V(stacked ? cum(s, c) : norm(s, c))
      const order = spec.kind === "area" && stacked ? [...data.series.keys()].reverse() : [...data.series.keys()]
      order.forEach((s) => {
        const pts = data.categories.map((_, c) => [px(c), py(s, c)] as [number, number])
        if (spec.kind === "area") {
          const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ")
          const lower = stacked && s > 0 ? data.categories.map((_, c) => [px(c), py(s - 1, c)] as [number, number]).reverse() : [[pts[pts.length - 1]![0], bottom], [pts[0]![0], bottom]]
          els.push(<path key={`a${s}`} d={`${line} ${lower.map(([x, y]) => `L${x},${y}`).join(" ")} Z`} fill={seriesColor(s)} fillOpacity={stacked ? 1 : 0.82} stroke="#FFFFFF" strokeWidth={thumb ? 0.4 : 1} />)
        } else {
          let d = ""
          pts.forEach(([x, y], c) => {
            if (raw(s, c) === null) return
            d += `${d && raw(s, c - 1) !== null ? "L" : "M"}${x},${y} `
          })
          els.push(<path key={`l${s}`} d={d} fill="none" stroke={seriesColor(s)} strokeWidth={thumb ? 1.3 : 2.5} strokeLinejoin="round" strokeLinecap="round" />)
          if (spec.variant === "markers" || (!thumb && spec.variant === "stacked"))
            pts.forEach(([x, y], c) => raw(s, c) !== null && els.push(<circle key={`m${s}-${c}`} cx={x} cy={y} r={thumb ? 1.6 : 4} fill={seriesColor(s)} stroke="#FFFFFF" strokeWidth={thumb ? 0.5 : 1.5} />))
        }
        if (o.dataLabels && !thumb) pts.forEach(([x, y], c) => raw(s, c) !== null && label(`dl${s}-${c}`, x, y - 11, num(val(s, c))))
      })
    }

    // 演示：导入部件里的线性趋势线（虚线；趋势线本身是 P2，只读保留）
    if (trendline !== undefined && !thumb && !horizontal && !stacked && trendline < nSer && (spec.kind === "column" || spec.kind === "line")) {
      const groupW = band * 0.64
      const cx = (c: number) => (spec.kind === "column" ? left + band * c + (band - groupW) / 2 + (groupW / nSer) * (trendline + 0.5) : left + band * (c + 0.5))
      const xs = data.categories.map((_, c) => c)
      const ys = data.categories.map((_, c) => val(trendline, c))
      const mx = xs.reduce((a, b) => a + b, 0) / nCat
      const my = ys.reduce((a, b) => a + b, 0) / nCat
      const k = xs.reduce((a, x, i) => a + (x - mx) * (ys[i]! - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1)
      const at = (c: number) => bottom - V(Math.max(0, my + k * (c - mx)))
      els.push(<line key="trend" x1={cx(0)} y1={at(0)} x2={cx(nCat - 1)} y2={at(nCat - 1)} stroke={seriesColor(trendline)} strokeWidth={2} strokeDasharray="6 4" strokeLinecap="round" />)
    }
  }

  // 图例
  const legendEls: ReactNode[] = []
  if (legend !== "none") {
    const itemW = (t: string) => 18 + textW(t, 13) + 16
    if (legend === "top" || legend === "bottom") {
      const total = legendItems.reduce((a, t) => a + itemW(t), 0) - 16
      let x = (width - total) / 2
      const y = legend === "bottom" ? height - pad - 9 : pad + (showTitle ? 36 : 0) + 10
      legendItems.forEach((t, i) => {
        legendEls.push(<rect key={`lg${i}`} x={x} y={y - 6} width={12} height={12} rx={2.5} fill={seriesColor(i)} />)
        legendEls.push(<text key={`lt${i}`} x={x + 18} y={y} dominantBaseline="central" fontSize={13} fill={INK} fillOpacity={0.78}>{t}</text>)
        x += itemW(t)
      })
    } else {
      // 左 / 右：纵向排列、垂直居中；右上：纵向排列、贴绘图区顶部
      const x = legend === "left" ? pad + 4 : width - pad - legendColW + 12
      let y = legend === "topRight" ? top + 10 : (top + bottom) / 2 - (legendItems.length * 22) / 2 + 11
      legendItems.forEach((t, i) => {
        legendEls.push(<rect key={`lg${i}`} x={x} y={y - 6} width={12} height={12} rx={2.5} fill={seriesColor(i)} />)
        legendEls.push(<text key={`lt${i}`} x={x + 18} y={y} dominantBaseline="central" fontSize={13} fill={INK} fillOpacity={0.78}>{t}</text>)
        y += 22
      })
    }
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className ?? "block size-full"} aria-hidden="true" fontFamily={FONT}>
      {showTitle && (
        <text x={width / 2} y={pad + 14} textAnchor="middle" dominantBaseline="central" fontSize={19} fontWeight={600} fill={INK}>
          {o.titleText}
        </text>
      )}
      {axis}
      {els}
      {labels}
      {legendEls}
    </svg>
  )
}

/** 只读类型示例：雷达图（非五类，slide-render-chart 以只读渲染器绘制）；viewBox 同图表外框（pt） */
export function RadarSvg({ width, height }: { width: number; height: number }) {
  // 标题占顶部约 40pt；轴标签画在 1.16 倍半径处，顶上的「增长」与标题之间留出约 16pt
  const cx = width / 2
  const cy = height / 2 + 22
  const R = Math.min(width, height) / 2 - 56
  const axes = ["增长", "毛利", "客户", "交付", "满意度"]
  const series = [
    { name: "华东", vals: [0.85, 0.7, 0.9, 0.6, 0.78], color: ACCENTS[0]! },
    { name: "华南", vals: [0.62, 0.82, 0.66, 0.84, 0.58], color: ACCENTS[1]! },
  ]
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / axes.length
    return [cx + R * v * Math.cos(a), cy + R * v * Math.sin(a)] as const
  }
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(",")).join(" ")
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="block size-full" aria-hidden="true" fontFamily={FONT}>
      <text x={cx} y={28} textAnchor="middle" dominantBaseline="central" fontSize={19} fontWeight={600} fill={INK}>
        区域经营雷达
      </text>
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon key={k} points={poly(axes.map(() => k))} fill="none" stroke={INK} strokeOpacity={0.12} />
      ))}
      {axes.map((a, i) => {
        const [x, y] = pt(i, 1.16)
        const [ex, ey] = pt(i, 1)
        return (
          <g key={a}>
            <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={INK} strokeOpacity={0.12} />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={13} fill={INK} fillOpacity={0.65}>
              {a}
            </text>
          </g>
        )
      })}
      {series.map((s) => (
        <polygon key={s.name} points={poly(s.vals)} fill={s.color} fillOpacity={0.2} stroke={s.color} strokeWidth={2} />
      ))}
      {series.map((s, i) => (
        <g key={`lg${s.name}`}>
          <rect x={width - 104} y={height / 2 - 18 + i * 22} width={12} height={12} rx={2.5} fill={s.color} />
          <text x={width - 86} y={height / 2 - 12 + i * 22} dominantBaseline="central" fontSize={13} fill={INK} fillOpacity={0.78}>
            {s.name}
          </text>
        </g>
      ))}
    </svg>
  )
}
