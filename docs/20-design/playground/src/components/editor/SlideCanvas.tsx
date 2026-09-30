import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Minus, Plus, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { presenceBg, presenceBgSoft, presenceBorder, presenceText, type Collaborator } from "@/lib/mock-data"

/** 逻辑画布坐标系（16:9），所有覆盖层子组件按此坐标定位，画布本身按 zoom% 整体缩放。 */
export const SLIDE_W = 960
export const SLIDE_H = 540

/** 缩放取值：数字为百分比；"fit" 适应窗口（默认）；"fit-width" 适应宽度。 */
export type ZoomValue = number | "fit" | "fit-width"

/** 视口内容区（已扣除 p-6 内边距）再留 16px 余量，避免纸面贴边或出现滚动条。 */
const FIT_MARGIN = 16

function resolveZoom(zoom: ZoomValue, size: { w: number; h: number }): number {
  if (typeof zoom === "number") return zoom
  if (size.w <= 0 || size.h <= 0) return 100
  const byW = ((size.w - FIT_MARGIN) / SLIDE_W) * 100
  const byH = ((size.h - FIT_MARGIN) / SLIDE_H) * 100
  const v = zoom === "fit-width" ? byW : Math.min(byW, byH)
  return Math.max(10, Math.min(400, Math.floor(v)))
}

/**
 * 屏幕坐标覆盖层（50/10 §1 `render.overlay`；50/21 §3 ⑤）：叠在缩放后的纸面之上、自身不缩放。
 * 迷你工具条、占位符图标条这类界面控件按屏幕尺寸绘制，入参仍用幻灯片坐标，由 `toScreen` 换算位置；
 * 覆盖层不在纸面的 overflow-hidden 里，也不进缩略图、放映与导出。
 */
export interface CanvasOverlayApi {
  /** 实际缩放百分比（「适应窗口」时为求得的值） */
  zoom: number
  /** 幻灯片坐标 → 覆盖层（屏幕）坐标 */
  toScreen: (box: Box) => Box
  /** 覆盖层节点；挂载前为 null */
  layer: HTMLDivElement | null
}

const CanvasOverlayContext = createContext<CanvasOverlayApi | null>(null)

/** 取当前画布的覆盖层；不在 SlideCanvas 内时为 null（调用方按幻灯片坐标原地绘制） */
export function useCanvasOverlay() {
  return useContext(CanvasOverlayContext)
}

/** 把子元素画进屏幕坐标覆盖层；不在 SlideCanvas 内时原地渲染 */
export function CanvasOverlay({ children }: { children: ReactNode }) {
  const ctx = useCanvasOverlay()
  if (!ctx) return <>{children}</>
  if (!ctx.layer) return null
  return createPortal(children, ctx.layer)
}

/** 幻灯片坐标 → 屏幕坐标；不在 SlideCanvas 内时原样返回 */
export function useToScreen(): (box: Box) => Box {
  const ctx = useCanvasOverlay()
  return ctx ? ctx.toScreen : identityBox
}

const identityBox = (box: Box) => box

/**
 * T-01 画布视口：内边距 24、bg-canvas；幻灯片 doc-paper 圆角 4 + shadow-md
 * （chrome 内唯一允许阴影的对象，因其是"纸"）；底部缩放条。
 * 09 §6.2 唯一例外：幻灯片内容的位置/尺寸允许用 style；zoom 变换同理（无法用静态 Tailwind 类表达任意缩放比）。
 * 纸面之上另有一层不缩放的屏幕坐标覆盖层（见 `CanvasOverlay`），界面控件画在那里。
 */
export function SlideCanvas({
  children,
  zoom = "fit",
  onZoomChange,
  onEffectiveZoomChange,
  hideZoomBar,
  paperClassName,
  className,
}: {
  children?: ReactNode
  zoom?: ZoomValue
  onZoomChange?: (v: ZoomValue) => void
  /** 适应窗口时的实际百分比回调，供外部（Ribbon 视图页签、查看器工具条）显示数值 */
  onEffectiveZoomChange?: (v: number) => void
  hideZoomBar?: boolean
  paperClassName?: string
  className?: string
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) setSize({ w: rect.width, h: rect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const effective = resolveZoom(zoom, size)
  useEffect(() => {
    onEffectiveZoomChange?.(effective)
  }, [effective, onEffectiveZoomChange])
  const [layer, setLayer] = useState<HTMLDivElement | null>(null)
  const overlay = useMemo<CanvasOverlayApi>(() => {
    const k = effective / 100
    return { zoom: effective, toScreen: (b) => ({ x: b.x * k, y: b.y * k, w: b.w * k, h: b.h * k }), layer }
  }, [effective, layer])
  return (
    <CanvasOverlayContext.Provider value={overlay}>
      <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
        <div ref={viewportRef} className="flex flex-1 items-center justify-center overflow-auto p-6">
          <div
            className="relative shrink-0"
            style={{ width: (SLIDE_W * effective) / 100, height: (SLIDE_H * effective) / 100 }}
          >
            <div
              className={cn("absolute top-0 left-0 origin-top-left overflow-hidden rounded bg-doc-paper text-doc-ink shadow-md", paperClassName)}
              style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${effective / 100})` }}
            >
              {children}
            </div>
            {/* 屏幕坐标覆盖层：自身不接收指针，子控件按需 pointer-events-auto */}
            <div ref={setLayer} data-slot="canvas-overlay" className="pointer-events-none absolute inset-0" />
          </div>
        </div>
        {!hideZoomBar && <ZoomBar zoom={zoom} effective={effective} onZoomChange={onZoomChange ?? (() => {})} />}
      </div>
    </CanvasOverlayContext.Provider>
  )
}

function ZoomBar({ zoom, effective, onZoomChange }: { zoom: ZoomValue; effective: number; onZoomChange: (v: ZoomValue) => void }) {
  const modeLabel = zoom === "fit" ? "适应窗口" : zoom === "fit-width" ? "适应宽度" : "缩放"
  return (
    <div className="glass mx-auto mb-2 flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5">
      <Button variant="ghost" size="icon-xs" aria-label="缩小" onClick={() => onZoomChange(Math.max(10, effective - 10))}>
        <Minus />
      </Button>
      <Slider value={[effective]} min={10} max={400} step={5} onValueChange={([v]) => v !== undefined && onZoomChange(v)} className="w-28" aria-label="画布缩放" />
      <Button variant="ghost" size="icon-xs" aria-label="放大" onClick={() => onZoomChange(Math.min(400, effective + 10))}>
        <Plus />
      </Button>
      <span className="w-10 text-xs tabular-nums text-muted-foreground">{effective}%</span>
      <Separator orientation="vertical" className="h-4" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="xs">{modeLabel}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          <DropdownMenuItem onSelect={() => onZoomChange("fit")}>适应窗口</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onZoomChange("fit-width")}>适应宽度</DropdownMenuItem>
          {[50, 75, 100, 150, 200].map((v) => (
            <DropdownMenuItem key={v} onSelect={() => onZoomChange(v)}>{v}%</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

function boxStyle(box: Box, extra?: CSSProperties): CSSProperties {
  return { left: box.x, top: box.y, width: box.w, height: box.h, ...extra }
}

/** 幻灯片内容元素（形状/文本/图片）：位置尺寸走 style（文档数据），装饰走 Tailwind 类 */
export function CanvasElementBox({
  box,
  rotate,
  className,
  style,
  onClick,
  children,
}: {
  box: Box
  rotate?: number
  className?: string
  /** 仅用于文档数据派生的样式（如主题色文字），不用于 UI chrome 装饰 */
  style?: CSSProperties
  onClick?: () => void
  children?: ReactNode
}) {
  return (
    <div
      className={cn("absolute", onClick && "cursor-pointer", className)}
      style={boxStyle(box, { ...(rotate ? { transform: `rotate(${rotate}deg)` } : undefined), ...style })}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

const HANDLE_POS = [
  { left: "0%", top: "0%", cursor: "nwse-resize" },
  { left: "50%", top: "0%", cursor: "ns-resize" },
  { left: "100%", top: "0%", cursor: "nesw-resize" },
  { left: "0%", top: "50%", cursor: "ew-resize" },
  { left: "100%", top: "50%", cursor: "ew-resize" },
  { left: "0%", top: "100%", cursor: "nesw-resize" },
  { left: "50%", top: "100%", cursor: "ns-resize" },
  { left: "100%", top: "100%", cursor: "nwse-resize" },
]

/**
 * P-04 选中框：1.5px accent + 8 个 8×8 手柄 + 可选旋转手柄；仅自己的选区使用。
 * `handles={false}`：只画选中框、不画缩放与旋转手柄——只读角色的选中、表格格内编辑时用（50/10 §3.2、50/24 §2.6）。
 */
export function SelectionBox({
  box,
  label,
  showRotate = true,
  handles = true,
  sizeLabel,
}: {
  box: Box
  label?: string
  showRotate?: boolean
  /** 是否画缩放手柄与旋转手柄（缺省画） */
  handles?: boolean
  sizeLabel?: string
}) {
  return (
    <div className="pointer-events-none absolute border-[1.5px] border-primary" style={boxStyle(box)}>
      {label && (
        <span className="absolute -top-5 left-0 rounded bg-primary px-1.5 py-px text-2xs font-medium whitespace-nowrap text-primary-foreground">
          {label}
        </span>
      )}
      {handles && showRotate && (
        <>
          <span className="absolute top-0 left-1/2 h-3 w-px -translate-x-1/2 -translate-y-3 bg-primary" aria-hidden="true" />
          <span className="absolute top-0 left-1/2 size-2.5 -translate-x-1/2 -translate-y-5 rounded-full border-[1.5px] border-primary bg-doc-paper shadow-sm" aria-hidden="true" />
        </>
      )}
      {handles && HANDLE_POS.map((p, i) => (
        <span
          key={i}
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-primary bg-doc-paper shadow-sm"
          style={{ left: p.left, top: p.top }}
          aria-hidden="true"
        />
      ))}
      {sizeLabel && (
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 rounded bg-foreground px-1.5 py-px text-2xs whitespace-nowrap text-background tabular-nums">
          {sizeLabel}
        </span>
      )}
    </div>
  )
}

/** P-04 远端选区：1.5px 虚线 presence 色 + doc-paper 外描边 + 12% 填充；名字标签 presence 描边 */
export function RemoteSelectionBox({ box, collaborator }: { box: Box; collaborator: Collaborator }) {
  const p = collaborator.presence ?? 1
  return (
    <div
      className={cn("pointer-events-none absolute border-[1.5px] border-dashed outline outline-1 outline-doc-paper", presenceBorder[p], presenceBgSoft[p])}
      style={boxStyle(box)}
    >
      <span className={cn("absolute -top-5 left-0 flex items-center gap-1 rounded border bg-popover px-1.5 py-px text-2xs font-medium whitespace-nowrap text-popover-foreground", presenceBorder[p])}>
        <span className={cn("size-1.5 rounded-full", presenceBg[p])} aria-hidden="true" />
        {collaborator.name}
      </span>
    </div>
  )
}

/** P-04 远端光标：16px 箭头 + presence 填充 + 姓名标签 */
export function RemoteCursor({ x, y, collaborator }: { x: number; y: number; collaborator: Collaborator }) {
  const p = collaborator.presence ?? 1
  return (
    <div className="pointer-events-none absolute z-10" style={{ left: x, top: y }}>
      <svg width="16" height="16" viewBox="0 0 16 16" className={cn(presenceText[p])} aria-hidden="true">
        <path d="M1 1L14 7.5L7.8 8.7L5.5 15L1 1Z" fill="currentColor" stroke="var(--doc-paper)" strokeWidth="1" strokeLinejoin="round" />
      </svg>
      <span className={cn("ml-3 inline-flex items-center rounded px-1.5 py-px text-2xs font-medium whitespace-nowrap text-white", presenceBg[p])}>
        {collaborator.name}
      </span>
    </div>
  )
}

/** P-04 评论钉：24 圆角 50% 50% 50% 0；亮色 warning-foreground 底白字（≥ 4.5:1），暗色 warning 底深字 */
export function CommentPin({ x, y, number, onClick, resolved }: { x: number; y: number; number: number; onClick?: () => void; resolved?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`评论 ${number}${resolved ? "（已解决）" : ""}`}
      className={cn(
        "absolute z-10 flex size-6 -translate-x-1/2 -translate-y-full rotate-45 items-center justify-center rounded-tl-full rounded-tr-full rounded-br-full shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
        resolved ? "bg-muted-foreground" : "bg-warning-foreground dark:bg-warning"
      )}
      style={{ left: x, top: y }}
    >
      <span className={cn("-rotate-45 text-[11px] font-semibold", resolved ? "text-white" : "text-white dark:text-black/85")}>{number}</span>
    </button>
  )
}

/**
 * P-04 迷你工具条：E1，内边距 2，按钮 24。画在屏幕坐标覆盖层：入参 x / y 仍是幻灯片坐标（锚点在工具条底边中点，
 * 工具条浮在锚点上方 8px），按屏幕尺寸绘制，不随画布缩放变小（03-16；50/10 §1；50/21 §3 ⑤）。
 */
export function MiniToolbar({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  const toScreen = useToScreen()
  const p = toScreen({ x, y, w: 0, h: 0 })
  return (
    <CanvasOverlay>
      <div
        className="glass-float pointer-events-auto absolute z-20 flex -translate-x-1/2 -translate-y-[calc(100%+8px)] items-center gap-0.5 rounded-xl p-1"
        style={{ left: p.x, top: p.y }}
      >
        {children}
      </div>
    </CanvasOverlay>
  )
}

/**
 * 画布浮签（键盘提示条、拖动角标、一次性内联提示等界面文字）：与 MiniToolbar 同理画在屏幕坐标覆盖层，按屏幕尺寸绘制、
 * 字号不随画布缩放变小（09 §1.3 字阶下限）。`x` / `y` / `w` 是幻灯片坐标（锚点为浮签左上角，`w` 给出时按屏幕宽度铺满），
 * `dx` / `dy` 是在锚点之后再加的屏幕像素偏移（如「表格底边下方 10 px」）。玻璃用 glass-float，暗色界面叠在白纸面上时文字仍 ≥ 4.5:1。
 */
export function CanvasFloat({
  x,
  y,
  w,
  dx = 0,
  dy = 0,
  className,
  children,
}: {
  x: number
  y: number
  w?: number
  dx?: number
  dy?: number
  className?: string
  children: ReactNode
}) {
  const toScreen = useToScreen()
  const p = toScreen({ x, y, w: w ?? 0, h: 0 })
  return (
    <CanvasOverlay>
      <div
        className={cn("glass-float pointer-events-auto absolute z-20", className)}
        style={{ left: p.x + dx, top: p.y + dy, width: w !== undefined ? p.w : undefined }}
      >
        {children}
      </div>
    </CanvasOverlay>
  )
}

/** 03-screens/26 §4：继承自母版的占位符用 outline:dashed + 顶部"母版"徽标标出，仍可选中查看只读属性 */
export function InheritedPlaceholderOutline({ box, label }: { box: Box; label: string }) {
  return (
    <div className="pointer-events-none absolute border border-dashed border-muted-foreground/50" style={boxStyle(box)}>
      <span className="absolute -top-4.5 left-0 rounded-sm bg-muted px-1 text-2xs text-muted-foreground">母版 · {label}</span>
    </div>
  )
}

/** 03-screens/13：降级渲染占位——虚线边框 + 类型图标 + 原因文案 */
export function DegradedElementBox({ box, reason }: { box: Box; reason: string }) {
  return (
    <div className="absolute flex flex-col items-center justify-center gap-1 rounded border border-dashed border-warning bg-warning-muted p-2 text-center" style={boxStyle(box)}>
      <TriangleAlert className="size-4 text-warning-foreground" aria-hidden="true" />
      <span className="text-xs leading-tight text-warning-foreground">无法显示：{reason}</span>
    </div>
  )
}
