import type { ReactNode } from "react"
import { defaultPieLabels, seriesColor, type ChartData, type ChartOptions, type ChartSpec } from "./chart-model"

const INK = "#1A2030"

function niceScale(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 1, step: 0.2 }
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 25, 50, 100]
  const step = steps.find((s) => max / s <= 6) ?? 100
  return { top: Math.ceil(max / step - 1e-9) * step, step }
}

function fmt(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

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

/**
 * 样张用的图表渲染（示意 slide-render-chart 的输出，ADR-0036）：柱形 / 条形（簇状、堆积、百分比）、折线（折线、带标记、堆积）、
 * 饼、面积（面积、堆积、百分比）、散点（标记、平滑线）。`thumb` 用于类型缩略图：去掉文字与坐标轴，只留图形。
 * 系列色取 `seriesColor`（accent1–6，第 7 个起按亮度派生）；数据标签显示原值（百分比堆积同样显示原值，PowerPoint 默认 showValue）。
 * `trendline` 只用于演示「导入的图表带趋势线」（线性，虚线；趋势线本身是 P2，只读保留）。
 */
export function DemoChart({
  spec,
  data,
  options,
  width,
  height,
  thumb = false,
  trendline,
}: {
  spec: ChartSpec
  data: ChartData
  options?: ChartOptions
  width: number
  height: number
  thumb?: boolean
  /** 演示：给第 N 个系列画一条线性趋势线（仅柱形 / 折线） */
  trendline?: number
}) {
  const o: ChartOptions = options ?? { title: false, titleText: "", legend: "none", dataLabels: false }
  const showTitle = !thumb && o.title
  const legend = thumb ? "none" : o.legend
  const pad = thumb ? 3 : 14
  const isPie = spec.kind === "pie"
  const legendItems = isPie ? data.categories : data.series.map((s) => s.name)

  // 外框：标题 / 图例 / 坐标轴标签依次从四边扣除
  let top = pad + (showTitle ? 38 : 0)
  let bottom = height - pad
  let left = pad
  let right = width - pad
  if (legend === "top") top += 30
  if (legend === "bottom") bottom -= 30
  if (legend === "left") left += 100
  if (legend === "right" || legend === "topRight") right -= 100

  const nCat = data.categories.length
  const nSer = data.series.length
  const val = (s: number, c: number) => data.series[s]?.values[c] ?? 0
  const sums = data.categories.map((_, c) => data.series.reduce((a, _s, s) => a + (val(s, c) ?? 0), 0))
  const stacked = spec.variant === "stacked" || spec.variant === "percent"
  const percent = spec.variant === "percent"
  const norm = (s: number, c: number) => (percent ? ((val(s, c) ?? 0) / (sums[c] || 1)) * 100 : val(s, c) ?? 0)
  const cum = (s: number, c: number) => { let t = 0; for (let k = 0; k <= s; k++) t += norm(k, c); return t }

  const els: ReactNode[] = []
  const labels: ReactNode[] = []
  const axis: ReactNode[] = []

  if (isPie) {
    const cx = (left + right) / 2
    const cy = (top + bottom) / 2
    const r = Math.max(4, Math.min(right - left, bottom - top) / 2 - (thumb ? 0 : 4))
    const vals = data.series[0]?.values.map((v) => v ?? 0) ?? []
    const total = vals.reduce((a, b) => a + b, 0) || 1
    let a0 = -Math.PI / 2
    vals.forEach((v, i) => {
      const a1 = a0 + (v / total) * Math.PI * 2
      const large = a1 - a0 > Math.PI ? 1 : 0
      const p = (a: number, rr = r) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]
      const [x0, y0] = p(a0)
      const [x1, y1] = p(a1)
      els.push(<path key={`s${i}`} d={`M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z`} fill={seriesColor(i)} stroke="#fff" strokeWidth={thumb ? 0.6 : 1.5} />)
      if (o.dataLabels && !thumb) {
        // 标签组成按检查器三个复选（showCategory / showValue / showPercent）：类别名一行，值与百分比一行
        const parts = o.pieLabels ?? defaultPieLabels
        const lines: string[] = []
        if (parts.category) lines.push(data.categories[i] ?? "")
        const nums = [parts.value ? fmt(v) : "", parts.percent ? `${Math.round((v / total) * 100)}%` : ""].filter(Boolean)
        if (nums.length) lines.push(nums.join(", "))
        const [lx = cx, ly = cy] = p((a0 + a1) / 2, r * 0.66)
        if (lines.length) {
          labels.push(
            <text key={`l${i}`} x={lx} y={ly - ((lines.length - 1) * 15) / 2} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600} fill="#fff">
              {lines.map((t, k) => <tspan key={k} x={lx} dy={k === 0 ? 0 : 15}>{t}</tspan>)}
            </text>
          )
        }
      }
      a0 = a1
    })
  } else if (spec.kind === "scatter") {
    const xs = data.x ?? data.categories.map((_, i) => i + 1)
    const xScale = niceScale(Math.max(...xs))
    const yScale = niceScale(Math.max(...data.series.flatMap((s) => s.values.map((v) => v ?? 0))))
    if (!thumb) { left += 34; bottom -= 24 }
    const X = (v: number) => left + (v / xScale.top) * (right - left)
    const Y = (v: number) => bottom - (v / yScale.top) * (bottom - top)
    if (!thumb) {
      for (let t = 0; t <= yScale.top + 1e-9; t += yScale.step) {
        axis.push(<line key={`gy${t}`} x1={left} x2={right} y1={Y(t)} y2={Y(t)} stroke={INK} strokeOpacity={0.1} />)
        axis.push(<text key={`ty${t}`} x={left - 6} y={Y(t)} textAnchor="end" dominantBaseline="central" fontSize={13} fill={INK} fillOpacity={0.6}>{fmt(t)}</text>)
      }
      for (let t = 0; t <= xScale.top + 1e-9; t += xScale.step) {
        axis.push(<text key={`tx${t}`} x={X(t)} y={bottom + 17} textAnchor="middle" fontSize={13} fill={INK} fillOpacity={0.6}>{fmt(t)}</text>)
      }
    }
    data.series.forEach((s, si) => {
      const pts = xs.map((x, i) => [X(x), Y(s.values[i] ?? 0)] as [number, number]).sort((a, b) => a[0] - b[0])
      if (spec.variant === "smooth") els.push(<path key={`p${si}`} d={smoothPath(pts)} fill="none" stroke={seriesColor(si)} strokeWidth={thumb ? 1.2 : 2.25} />)
      pts.forEach(([x, y], i) => els.push(<circle key={`m${si}-${i}`} cx={x} cy={y} r={thumb ? 1.8 : 5} fill={seriesColor(si)} stroke="#fff" strokeWidth={thumb ? 0.5 : 1.5} />))
      if (o.dataLabels && !thumb) s.values.forEach((v, i) => labels.push(<text key={`l${si}-${i}`} x={X(xs[i]!)} y={Y(v ?? 0) - 10} textAnchor="middle" fontSize={13} fill={INK} fillOpacity={0.75}>{fmt(v ?? 0)}</text>))
    })
  } else {
    const horizontal = spec.kind === "bar"
    const max = percent ? 100 : stacked ? Math.max(...sums) : Math.max(...data.series.flatMap((s) => s.values.map((v) => v ?? 0)))
    const scale = niceScale(max)
    if (!thumb) {
      if (horizontal) { left += 60; bottom -= 22 } else { left += 34; bottom -= 24 }
    }
    const plotW = right - left
    const plotH = bottom - top
    const V = (v: number) => (v / scale.top) * (horizontal ? plotW : plotH)
    const band = (horizontal ? plotH : plotW) / nCat
    if (!thumb) {
      for (let t = 0; t <= scale.top + 1e-9; t += scale.step) {
        const lbl = percent ? `${Math.round(t)}%` : fmt(t)
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
        const center = horizontal ? bottom - band * (i + 0.5) : spec.kind === "area" ? left + (nCat > 1 ? (plotW * i) / (nCat - 1) : plotW / 2) : left + band * (i + 0.5)
        axis.push(horizontal
          ? <text key={`c${i}`} x={left - 6} y={center} textAnchor="end" dominantBaseline="central" fontSize={13} fill={INK} fillOpacity={0.6}>{c}</text>
          : <text key={`c${i}`} x={center} y={bottom + 17} textAnchor="middle" fontSize={13} fill={INK} fillOpacity={0.6}>{c}</text>)
      })
      axis.push(horizontal
        ? <line key="ax" x1={left} x2={left} y1={top} y2={bottom} stroke={INK} strokeOpacity={0.3} />
        : <line key="ax" x1={left} x2={right} y1={bottom} y2={bottom} stroke={INK} strokeOpacity={0.3} />)
    }

    if (spec.kind === "column" || spec.kind === "bar") {
      const groupW = band * (stacked ? 0.5 : 0.64)
      const barW = stacked ? groupW : groupW / nSer
      data.categories.forEach((_, c) => {
        const start = (horizontal ? bottom - band * (c + 1) : left + band * c) + (band - groupW) / 2
        data.series.forEach((_s, s) => {
          const v = norm(s, c)
          const base = stacked ? cum(s, c) - v : 0
          const off = stacked ? 0 : barW * s
          const len = V(v)
          const x = horizontal ? left + V(base) : start + off
          const y = horizontal ? start + (stacked ? 0 : barW * (nSer - 1 - s)) : bottom - V(base) - len
          const w = horizontal ? len : barW - (stacked ? 0 : thumb ? 0.6 : 1.5)
          const h = horizontal ? barW - (stacked ? 0 : thumb ? 0.6 : 1.5) : len
          els.push(<rect key={`b${c}-${s}`} x={x} y={y} width={Math.max(0, w)} height={Math.max(0, h)} fill={seriesColor(s)} stroke={stacked ? "#fff" : undefined} strokeWidth={stacked ? (thumb ? 0.4 : 1) : undefined} />)
          if (o.dataLabels && !thumb) {
            // 百分比堆积也显示原值（PowerPoint 默认 showValue；50/24 §3.4）
            const txt = fmt(val(s, c) ?? 0)
            labels.push(stacked
              ? <text key={`l${c}-${s}`} x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600} fill="#fff">{txt}</text>
              : horizontal
                ? <text key={`l${c}-${s}`} x={x + w + 4} y={y + h / 2} dominantBaseline="central" fontSize={12} fill={INK} fillOpacity={0.75}>{txt}</text>
                : <text key={`l${c}-${s}`} x={x + w / 2} y={y - 5} textAnchor="middle" fontSize={12} fill={INK} fillOpacity={0.75}>{txt}</text>)
          }
        })
      })
    } else {
      // 折线 / 面积：折线点在类别带中心，面积点铺满绘图区
      const px = (c: number) => (spec.kind === "area" ? left + (nCat > 1 ? (plotW * c) / (nCat - 1) : plotW / 2) : left + band * (c + 0.5))
      const py = (s: number, c: number) => bottom - V(stacked ? cum(s, c) : norm(s, c))
      const order = spec.kind === "area" && stacked ? [...data.series.keys()].reverse() : [...data.series.keys()]
      order.forEach((s) => {
        const pts = data.categories.map((_, c) => [px(c), py(s, c)] as [number, number])
        const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ")
        if (spec.kind === "area") {
          const lower = stacked && s > 0 ? data.categories.map((_, c) => [px(c), py(s - 1, c)] as [number, number]).reverse() : [[pts[pts.length - 1]![0], bottom], [pts[0]![0], bottom]]
          const d = `${line} ${lower.map(([x, y]) => `L${x},${y}`).join(" ")} Z`
          els.push(<path key={`a${s}`} d={d} fill={seriesColor(s)} fillOpacity={stacked ? 1 : 0.82} stroke="#fff" strokeWidth={thumb ? 0.4 : 1} />)
        } else {
          els.push(<path key={`l${s}`} d={line} fill="none" stroke={seriesColor(s)} strokeWidth={thumb ? 1.3 : 2.5} strokeLinejoin="round" strokeLinecap="round" />)
          if (spec.variant === "markers" || (!thumb && spec.variant === "stacked")) pts.forEach(([x, y], c) => els.push(<circle key={`m${s}-${c}`} cx={x} cy={y} r={thumb ? 1.6 : 4} fill={seriesColor(s)} stroke="#fff" strokeWidth={thumb ? 0.5 : 1.5} />))
        }
        if (o.dataLabels && !thumb) pts.forEach(([x, y], c) => labels.push(<text key={`dl${s}-${c}`} x={x} y={y - 9} textAnchor="middle" fontSize={12} fill={INK} fillOpacity={0.75}>{fmt(val(s, c) ?? 0)}</text>))
      })
    }

    // 演示：导入部件里的线性趋势线（最小二乘，按该系列在各类别的位置拟合）
    if (trendline !== undefined && !thumb && !horizontal && !stacked && trendline < nSer && (spec.kind === "column" || spec.kind === "line")) {
      const groupW = band * 0.64
      const cx = (c: number) => (spec.kind === "column" ? left + band * c + (band - groupW) / 2 + (groupW / nSer) * (trendline + 0.5) : left + band * (c + 0.5))
      const n = nCat
      const xs = data.categories.map((_, c) => c)
      const ys = data.categories.map((_, c) => val(trendline, c) ?? 0)
      const mx = xs.reduce((a, b) => a + b, 0) / n
      const my = ys.reduce((a, b) => a + b, 0) / n
      const k = xs.reduce((a, x, i) => a + (x - mx) * (ys[i]! - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1)
      const at = (c: number) => bottom - V(Math.max(0, my + k * (c - mx)))
      els.push(<line key="trend" x1={cx(0)} y1={at(0)} x2={cx(n - 1)} y2={at(n - 1)} stroke={seriesColor(trendline)} strokeWidth={2} strokeDasharray="6 4" strokeLinecap="round" />)
    }
  }

  // 图例
  const legendEls: ReactNode[] = []
  if (legend !== "none") {
    const itemW = (t: string) => 18 + t.length * 13 + 16
    if (legend === "top" || legend === "bottom") {
      const total = legendItems.reduce((a, t) => a + itemW(t), 0)
      let x = (width - total) / 2
      const y = legend === "bottom" ? height - pad - 10 : pad + (showTitle ? 38 : 0) + 10
      legendItems.forEach((t, i) => {
        legendEls.push(<rect key={`lg${i}`} x={x} y={y - 6} width={12} height={12} rx={2.5} fill={seriesColor(i)} />)
        legendEls.push(<text key={`lt${i}`} x={x + 18} y={y} dominantBaseline="central" fontSize={13} fill={INK} fillOpacity={0.75}>{t}</text>)
        x += itemW(t)
      })
    } else {
      // 左 / 右：纵向排列、垂直居中；右上：纵向排列、贴绘图区顶部（绘图区右侧同样让出 100）
      const x = legend === "left" ? pad + 4 : width - pad - 88
      let y = legend === "topRight" ? top + 12 : (top + bottom) / 2 - (legendItems.length * 24) / 2 + 12
      legendItems.forEach((t, i) => {
        legendEls.push(<rect key={`lg${i}`} x={x} y={y - 6} width={12} height={12} rx={2.5} fill={seriesColor(i)} />)
        legendEls.push(<text key={`lt${i}`} x={x + 18} y={y} dominantBaseline="central" fontSize={13} fill={INK} fillOpacity={0.75}>{t}</text>)
        y += 24
      })
    }
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block" style={{ width, height }} aria-hidden="true">
      {showTitle && <text x={width / 2} y={pad + 16} textAnchor="middle" dominantBaseline="central" fontSize={20} fontWeight={600} fill={INK}>{o.titleText}</text>}
      {axis}
      {els}
      {labels}
      {legendEls}
    </svg>
  )
}
