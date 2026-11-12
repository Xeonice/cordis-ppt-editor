import { useEffect, type MouseEvent, type ReactNode } from "react"
import { Toast, Toasts, useEditor, useSceneState, type EditorCtx } from "../../kit"
import type { RegionDefaults } from "../types"
import { InsertHint, TransformBox } from "./insert-tool"
import { ALL_SHAPES, RECENT_SHAPES, SHAPE_GROUPS, type ShapePreset } from "./shapes"

/**
 * shape-library 场景的「点选形状 → 插入工具态 → 单击画布插入」（03-15「插入交互」）。底座工具条已接住点选（弹层收起、「形状」保持按下、
 * 记下当前插入工具，见 editor/Toolbar.tsx），这里在同一下点按里把插入工具记进场景共享状态，供画布与提示条读：
 * - 点完整形状库或常用 4 × 3 里的一格（键盘 Enter / Space 同）：画布顶部出插入提示条（工具名 · 单击 / 拖出 · 修饰键）；
 *   再打开形状库时该格高亮（底座 shapesActive）。
 * - 插入工具态里 Esc 退出、回到选择工具（形状弹层开着时第一下 Esc 先收弹层）；点「选择」或别的创建工具同样退出。
 * - 单击画布：在落点插入 1 in × 1 in（72 × 72 pt）的该形状，选中并显示变换手柄，回到选择工具，轻提示带撤销（与 inserted 状态同一画法）。
 * 当前插入工具（形状 id）放在场景共享状态里：状态可以用 data.armed 给初值（如插入工具就绪、工具态中再开形状库）。
 */

export const ARMED = "shape-library.armed"
const PLACED = "shape-library.placed"

/** 刚在画布上单击插入的形状（幻灯片百分比框） */
interface Placed {
  id: string
  /** 插在哪一页 */
  slide: number
  x: number
  y: number
  w: number
  h: number
  key: number
}

/** 工具条「形状 ▾」常用 4 × 3（shape-icons 的名字）对应的形状库预设 */
const QUICK: Record<string, string> = {
  矩形: "rect",
  圆角矩形: "roundRect",
  圆: "ellipse",
  三角形: "triangle",
  菱形: "diamond",
  星形: "star5",
  十字: "mathPlus",
  六边形: "hexagon",
  左右箭头: "leftRightArrow",
  对话气泡: "wedgeRoundRectCallout",
  直线: "line",
  箭头线: "line-arrow",
}

const byId = (id: string) => ALL_SHAPES.find((s) => s.id === id)

/** 被点的格子 → 预设：完整形状库按「所在分类 + 名称」找（不同分类里可能重名），常用 4 × 3 按对照表 */
function presetOf(btn: HTMLElement): ShapePreset | undefined {
  const name = btn.getAttribute("aria-label") ?? ""
  if (btn.hasAttribute("data-cell")) {
    const group = btn.closest("section[aria-label]")?.getAttribute("aria-label")
    const items = group === "最近使用" ? RECENT_SHAPES : (SHAPE_GROUPS.find((g) => g.label === group)?.items ?? ALL_SHAPES)
    return items.find((s) => s.name === name) ?? ALL_SHAPES.find((s) => s.name === name)
  }
  const id = QUICK[name]
  return id ? byId(id) : undefined
}

/** 当前插入工具：初值取状态的 data.armed */
export function useArmed() {
  const { data } = useEditor()
  return useSceneState<string | null>(ARMED, () => (typeof data.armed === "string" ? data.armed : null))
}

/** 形状弹层开着（常用 4 × 3 或完整形状库） */
const shapePopoverOpen = () => !!document.querySelector('[role=dialog][aria-label="形状库"], [role=menu][aria-label="形状"]')

/**
 * 工具条区域（regions.toolbar）：底座工具条外包一层，在捕获阶段接住形状格子的点按（键盘 Enter / Space 在按钮上同样派发 click）。
 * 不可用的 P2 格（aria-disabled）点了不进工具态，工具提示照常给原因。
 */
export function PickableToolbar({ d }: { d: RegionDefaults }) {
  const { tool, setTool } = useEditor()
  const [armed, setArmed] = useArmed()
  const on = tool === "shapes" && !!armed

  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-cell], [role=menu][aria-label="形状"] [role=menuitem]')
    if (!btn || btn.getAttribute("aria-disabled") === "true") return
    const shape = presetOf(btn)
    if (!shape) return
    // 弹层收起、焦点交还「形状」按钮由底座工具条在同一下点按里完成
    setArmed(shape.id)
    setTool("shapes")
  }

  // 插入工具态里 Esc 退出（捕获阶段：形状弹层开着时它还在 DOM 里，这一下归弹层；焦点在别的浮层里时归那一层）
  useEffect(() => {
    if (!on) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !e.isTrusted || e.defaultPrevented || e.isComposing) return
      if (shapePopoverOpen()) return
      if (document.activeElement?.closest('[data-radix-popper-content-wrapper], [role=dialog][data-state=open]')) return
      setArmed(null)
      setTool("select")
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [on, setArmed, setTool])

  return (
    <div className="contents" onClickCapture={onClickCapture}>
      {d.toolbar({ shapesActive: armed ?? undefined })}
    </div>
  )
}

/** 画布顶部的插入提示条（canvasOverlay）：只在插入工具态显示 */
export function ArmedHint() {
  const { tool } = useEditor()
  const [armed] = useArmed()
  const shape = armed ? byId(armed) : undefined
  return tool === "shapes" && shape ? <InsertHint shape={shape} /> : null
}

/** 1 in × 1 in 在 960 × 540 设计稿里的百分比 */
const INCH_W = (72 / 960) * 100
const INCH_H = (72 / 540) * 100

/**
 * 刚插入的形状本身（文档内容）：预设几何按框拉伸，主题样式——文档品牌色浅底 + 品牌色 1.5px 描边（同 inserted 状态的流程框）。
 * 画在幻灯片叠加层里，所以外层带 .v3-slide 取文档配色 token。
 */
function ShapeGeometry({ p }: { p: Placed }) {
  const shape = byId(p.id)
  if (!shape) return null
  return (
    <div aria-hidden="true" className="v3-slide pointer-events-none absolute" style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${p.h}%` }}>
      <svg viewBox="3 3 18 18" preserveAspectRatio="none" fill="var(--s-brand-soft)" stroke="var(--s-brand)" strokeWidth="1.5" strokeLinejoin="round" className="size-full overflow-visible [&_*]:[vector-effect:non-scaling-stroke]">
        {shape.draw}
      </svg>
    </div>
  )
}

/** 刚插入、仍选中：形状 + 变换手柄与尺寸角标 */
function PlacedShape({ p }: { p: Placed }) {
  return (
    <>
      <ShapeGeometry p={p} />
      <TransformBox box={{ x: p.x, y: p.y, w: p.w, h: p.h }} label="72 × 72" />
    </>
  )
}

/**
 * 幻灯片叠加层（slideOverlay 函数形式）：插入工具态时整页是十字光标的点击区，单击即在落点插入；插入后画出新形状与变换手柄。
 * armedOverlay：状态自带的工具态演示（十字光标位置、拖出预览），只在初始状态且仍在工具态时显示；
 * overlay：状态自带的其余叠加（如已插入形状的变换手柄），与 ReactNode 形式的 slideOverlay 一样只在初始页与初始选中时显示。
 */
export function ShapeStageLayer({ ctx, armedOverlay, overlay }: { ctx: EditorCtx; armedOverlay?: ReactNode; overlay?: ReactNode }) {
  const [armed, setArmed] = useArmed()
  const [placed, setPlaced] = useSceneState<Placed | null>(PLACED, null)
  const on = ctx.tool === "shapes" && !!armed
  const place = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (!armed) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.min(100 - INCH_W, Math.max(0, ((e.clientX - r.left) / r.width) * 100))
    const y = Math.min(100 - INCH_H, Math.max(0, ((e.clientY - r.top) / r.height) * 100))
    setPlaced({ id: armed, slide: ctx.slide, x, y, w: INCH_W, h: INCH_H, key: Date.now() })
    setArmed(null)
    ctx.setTool("select")
    ctx.setSelection("shape-library-new")
  }
  return (
    <>
      {/* 插入后点了别处（取消选中）：形状留在页上，只是不再画手柄；换页后不画（它在原来那一页上） */}
      {placed && placed.slide === ctx.slide && (ctx.selection === "shape-library-new" ? <PlacedShape p={placed} /> : <ShapeGeometry p={placed} />)}
      {ctx.initial && overlay}
      {on && ctx.initial && armedOverlay}
      {on && (
        <div
          role="button"
          tabIndex={-1}
          aria-label={`在幻灯片上单击插入${byId(armed!)?.name ?? "形状"}`}
          className="absolute inset-0 z-10 cursor-crosshair"
          onClick={place}
        />
      )}
    </>
  )
}


/** 插入后的轻提示（canvasOverlay）：「已插入 · 名称」+ 撤销（撤销去掉新形状、回到无选中） */
export function PlacedToast() {
  const { setSelection } = useEditor()
  const [placed, setPlaced] = useSceneState<Placed | null>(PLACED, null)
  const shape = placed ? byId(placed.id) : undefined
  if (!placed || !shape) return null
  return (
    <Toasts>
      <Toast
        key={placed.key}
        action="撤销"
        onAction={() => {
          setPlaced(null)
          setSelection("none")
        }}
      >
        已插入 · {shape.name}
      </Toast>
    </Toasts>
  )
}

/** 新形状的检查器标题：形状名（private 种类 shape-library-new，分区见 shape-sections.tsx） */
export function PlacedTitle() {
  const [placed] = useSceneState<Placed | null>(PLACED, null)
  return <>{(placed && byId(placed.id)?.name) ?? "形状"}</>
}

/** 新形状的位置 / 尺寸（pt，取整）：检查器分区读它 */
export function usePlacedGeometry() {
  const [placed] = useSceneState<Placed | null>(PLACED, null)
  if (!placed) return null
  return { x: Math.round((placed.x / 100) * 960), y: Math.round((placed.y / 100) * 540), w: 72, h: 72 }
}

