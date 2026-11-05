import type { ReactNode } from "react"

/**
 * 形状弹层与填充分段用的自绘图标：圆角端点，渲染描边 1.5px。
 * 形状图标按 18 格绘制、放大到 20px 显示，所以 viewBox 内描边取 1.5 × 18 / 20 = 1.35。
 */
const S18 = {
  width: 20,
  height: 20,
  viewBox: "0 0 18 18",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.35,
  strokeLinejoin: "round",
  strokeLinecap: "round",
  "aria-hidden": true,
} as const

function starPoints(cx: number, cy: number, ro: number, ri: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? ro : ri
    const a = (-90 + i * 36) * (Math.PI / 180)
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(" ")
}

export interface ShapeDef {
  id: string
  label: string
  icon: ReactNode
}

/** 4 × 3 形状网格：矩形、圆角矩形、圆、三角 / 菱形、星、十字、六边形 / 左右箭头、对话气泡、直线、箭头线 */
export const SHAPES: ShapeDef[] = [
  { id: "rect", label: "矩形", icon: <svg {...S18}><rect x="2.75" y="4" width="12.5" height="10" rx="0.5" /></svg> },
  { id: "round-rect", label: "圆角矩形", icon: <svg {...S18}><rect x="2.75" y="4" width="12.5" height="10" rx="3.2" /></svg> },
  { id: "ellipse", label: "圆", icon: <svg {...S18}><circle cx="9" cy="9" r="6.25" /></svg> },
  { id: "triangle", label: "三角形", icon: <svg {...S18}><path d="M9 3.25 15.25 14.5H2.75Z" /></svg> },
  { id: "diamond", label: "菱形", icon: <svg {...S18}><path d="M9 2.5 15.5 9 9 15.5 2.5 9Z" /></svg> },
  { id: "star", label: "星形", icon: <svg {...S18}><polygon points={starPoints(9, 9.6, 7, 3)} /></svg> },
  { id: "cross", label: "十字", icon: <svg {...S18}><path d="M6.6 2.75h4.8V6.6h3.85v4.8H11.4v3.85H6.6V11.4H2.75V6.6H6.6Z" /></svg> },
  { id: "hexagon", label: "六边形", icon: <svg {...S18}><path d="M9 2.5 14.6 5.75v6.5L9 15.5l-5.6-3.25v-6.5Z" /></svg> },
  { id: "arrow-lr", label: "左右箭头", icon: <svg {...S18}><path d="M2.25 9 5.9 5.4v2.2h6.2V5.4L15.75 9l-3.65 3.6v-2.2H5.9v2.2Z" /></svg> },
  { id: "bubble", label: "对话气泡", icon: <svg {...S18}><path d="M4 3.5h10a1.25 1.25 0 0 1 1.25 1.25v6A1.25 1.25 0 0 1 14 12H8.4L5 15v-3H4a1.25 1.25 0 0 1-1.25-1.25v-6A1.25 1.25 0 0 1 4 3.5Z" /></svg> },
  { id: "line", label: "直线", icon: <svg {...S18}><path d="M3.5 14.5 14.5 3.5" /></svg> },
  { id: "arrow-line", label: "箭头线", icon: <svg {...S18}><path d="M3.5 14.5 14.5 3.5M8.5 3.5h6v6" /></svg> },
]

/* ------------------------------------------------------------------ 填充类型（16px） */

const S16 = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinejoin: "round",
  strokeLinecap: "round",
  "aria-hidden": true,
} as const

export const FillNoneIcon = () => (
  <svg {...S16}>
    <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
    <path d="M3.6 12.4 12.4 3.6" />
  </svg>
)

export const FillSolidIcon = () => (
  <svg {...S16}>
    <rect x="2.5" y="2.5" width="11" height="11" rx="2" fill="currentColor" />
  </svg>
)

/** 渐变用三条递减不透明度的竖条示意，图标本身不含渐变。 */
export const FillGradientIcon = () => (
  <svg {...S16}>
    <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
    <rect x="4.4" y="4.4" width="2" height="7.2" rx="0.4" fill="currentColor" stroke="none" />
    <rect x="7" y="4.4" width="2" height="7.2" rx="0.4" fill="currentColor" stroke="none" opacity=".6" />
    <rect x="9.6" y="4.4" width="2" height="7.2" rx="0.4" fill="currentColor" stroke="none" opacity=".3" />
  </svg>
)

/** Logo 小方标：单色，跟随文字色，强调色不用在 logo 上。 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <rect width="20" height="20" rx="5" className="fill-(--v3-text)" />
      <rect x="4.5" y="6" width="11" height="8" rx="1.5" className="fill-(--v3-panel)" />
      <rect x="6.5" y="8" width="4.6" height="1.6" rx=".8" className="fill-(--v3-text)" />
      <rect x="6.5" y="10.9" width="7" height="1.2" rx=".6" className="fill-(--v3-text-2)" />
    </svg>
  )
}
