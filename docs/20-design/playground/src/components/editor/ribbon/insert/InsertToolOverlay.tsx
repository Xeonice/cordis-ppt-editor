import { useLayoutEffect, useRef, useState } from "react"
import { Kbd } from "@/components/ui/kbd"
import type { Box } from "../../SlideCanvas"
import { ShapeThumb, type ShapePreset } from "./shapes"

/**
 * 插入工具态视觉（03-screens/15；rulings §4.21 R-d-62，状态机见 50/10 §7）：
 * 画布十字光标；按下后移动超过 4 px 才算拖出，拖出时画 1.5px 主色虚线框 + 形状幽灵预览（主色 10% 填充）+ 尺寸角标；
 * 松手插入并选中（形状默认不进文本编辑，P1 再定）；未超过阈值按单击处理，插入 1 in × 1 in、左上角在点击处。
 * 样张里系统光标拍不进截图，终点处另画一个十字光标示意；真实实现只用 CSS `cursor: crosshair`。
 */
export function InsertDragPreview({ box, shape, sizeLabel }: { box: Box; shape: ShapePreset; sizeLabel: string }) {
  const lineLike = shape.group === "lines"
  return (
    <div className="pointer-events-none absolute" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} aria-hidden="true">
      <GhostShape shape={shape} w={box.w} h={box.h} className={lineLike ? "text-primary" : "text-primary/45"} />
      {!lineLike && <div className="absolute inset-0 border-[1.5px] border-dashed border-primary" />}
      <span className="absolute top-0 left-0 size-1.5 -translate-1/2 rounded-full bg-primary ring-2 ring-doc-paper" />
      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 rounded bg-foreground px-1.5 py-px text-2xs whitespace-nowrap text-background tabular-nums">
        {sizeLabel}
      </span>
      <CrosshairCursor x={box.w} y={box.h} />
    </div>
  )
}

/**
 * 幽灵预览：常用预设按真实几何画（圆角矩形默认 adj 16667 → 圆角 = 短边 × 16.667%），
 * 其余用缩略图同一几何按包围盒拉伸（描边不随拉伸变粗）；产品里直接用 presetGeometryPath(prst, w, h)。
 */
function GhostShape({ shape, w, h, className }: { shape: ShapePreset; w: number; h: number; className: string }) {
  const g = useRef<SVGGElement>(null)
  const [vb, setVb] = useState("0 0 24 24")
  useLayoutEffect(() => {
    const b = g.current?.getBBox()
    if (b && b.width > 0 && b.height > 0) setVb(`${b.x} ${b.y} ${b.width} ${b.height}`)
  }, [shape])
  const exact =
    shape.prst === "rect" || shape.prst === "flowChartProcess" ? <rect x={0} y={0} width={w} height={h} />
    : shape.prst === "roundRect" ? <rect x={0} y={0} width={w} height={h} rx={Math.min(w, h) * 0.16667} />
    : shape.prst === "ellipse" ? <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} />
    : null
  if (exact)
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className={`absolute inset-0 size-full overflow-visible fill-primary/10 ${className}`} fill="none" stroke="currentColor" strokeWidth={1.5}>
        {exact}
      </svg>
    )
  return (
    <svg viewBox={vb} preserveAspectRatio="none" className={`absolute inset-0 size-full overflow-visible fill-primary/10 ${className}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
      <g ref={g} className="[&_*]:[vector-effect:non-scaling-stroke]">{shape.draw}</g>
    </svg>
  )
}

/** 十字光标示意：深色细线 + 纸色描边，任何底色上都可辨 */
export function CrosshairCursor({ x, y }: { x: number; y: number }) {
  return (
    <svg width="23" height="23" viewBox="0 0 23 23" className="absolute -translate-1/2" style={{ left: x, top: y }} aria-hidden="true">
      <path d="M11.5 1v21M1 11.5h21" stroke="var(--doc-paper)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M11.5 1v21M1 11.5h21" stroke="var(--doc-ink)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** 画布上方的插入提示条：与母版视图提示条同一形态（glass、h-9、rounded-2xl、text-xs、不换行） */
export function InsertToolHint({ shape }: { shape: ShapePreset }) {
  return (
    <div role="status" className="glass pointer-events-auto absolute top-2 left-1/2 z-10 flex h-9 -translate-x-1/2 items-center gap-2 rounded-2xl px-4 text-xs whitespace-nowrap text-foreground/80">
      <ShapeThumb shape={shape} className="size-4 text-primary" />
      <span className="font-medium text-foreground">插入 · {shape.name}</span>
      <span className="text-muted-foreground">单击插入 1 in × 1 in，或拖出大小</span>
      <span className="h-3.5 w-px bg-foreground/10" aria-hidden="true" />
      <span className="inline-flex items-center gap-1"><Kbd>Shift</Kbd>锁定比例</span>
      <span className="inline-flex items-center gap-1"><Kbd>Alt</Kbd>从中心</span>
      <span className="inline-flex items-center gap-1"><Kbd>Esc</Kbd>取消</span>
    </div>
  )
}
