import type { CSSProperties, ReactNode } from "react"
import { MoveHorizontal, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  boxStyle, CanvasTag, HitArea, HoverBox, Kbd, PaperScope, PlaceholderIconBar as KitPlaceholderIconBar, SelectionBox, SizeTag, Tag, Tip, type Box, type EditorCtx, len } from "../../kit"
import { BORDER_INK, borderEdges, cellsBox, findStyle, geomOf, paint, PLACEHOLDER, pts, sum, TABLE_PAGE, tableBox, yp, type Geom, type Variant } from "./model"
import { useTableUi } from "./store"

/**
 * 画布叠加层（画在幻灯片框里、不进缩略图与导出）。位置按幻灯片百分比，与 TableSlide 的 cqw 几何同源；
 * 线宽、手柄、角标按屏幕像素绘制，不随画布缩放（rulings §4.22 SF-01 的屏幕坐标覆盖层；迷你工具条已随 §4.25 DS-22 取消，覆盖层保留）。
 * 颜色只用强调色（选中、手柄、参考线）与中性色；边框预览是文档里的边框颜色（内容色）。
 */

export interface OverlaySpec {
  variant: Variant
  milestone: "M2" | "M3"
  /** 评审 / 查看：画布只留表格外框，不出插入符、选区、手柄与图标条（03-30 §9） */
  readOnly?: boolean
  /** 页上是空内容占位符：画图标条（常驻） */
  placeholder?: boolean
  /** 网格弹层锚在占位符的表格图标上（图标按下态随弹层开关） */
  phGrid?: boolean
  /** 网格弹层打开时，用悬停框标出新表格将填入的占位符（Q1） */
  target?: boolean
  /** 表格外框：edit 单元格编辑 / 选区（只有外框）；whole 整表选中（M3 起 8 个缩放手柄） */
  frame?: "edit" | "whole"
  /** 当前格选中环（合并格给出范围） */
  ring?: { r0: number; c0: number; r1?: number; c1?: number }
  /** 插入符：start 在格首（空格），end 在右对齐数字的末尾 */
  caret?: { r: number; c: number; end?: boolean }
  /** 单元格选区：主色覆盖 + 外沿 2px 描边（边框预览时不画描边） */
  range?: { r0: number; c0: number; r1: number; c1: number }
  /** 按检查器当前的边框预设预览 */
  borders?: boolean
  /** 悬停插入手柄「+」（M3） */
  insertHandles?: boolean
  /** 拖第 1 列右分隔线（M3） */
  resize?: boolean
  /** 跨格导航的按键提示 */
  keyHint?: boolean
}

/**
 * 场景状态的叠加层（函数插槽）：停在初始页与初始选中时画状态本身；用户点了别处之后，
 * 表格仍可点选（整表选中：M2 只有外框，M3 起 8 个缩放手柄），空占位符的图标条常驻。
 */
export function tableOverlay(spec: OverlaySpec) {
  return (ctx: EditorCtx) => <TableOverlay spec={spec} ctx={ctx} />
}

function TableOverlay({ spec, ctx }: { spec: OverlaySpec; ctx: EditorCtx }) {
  if (ctx.slide !== TABLE_PAGE) return null
  const g = geomOf(spec.variant)
  const hasTable = spec.variant !== "empty"
  const live = ctx.initial
  return (
    <>
      {hasTable && ctx.selection !== "table" && !(live && spec.frame) && (
        <HitArea box={tableBox(g)} label="选择表格" onClick={() => ctx.setSelection("table")} />
      )}
      {spec.placeholder && !spec.readOnly && <PlaceholderIconBar grid={!!spec.phGrid} />}
      {live ? (
        <StateLayer spec={spec} g={g} />
      ) : (
        hasTable && ctx.selection === "table" && <SelectionBox box={tableBox(g)} handles={spec.milestone === "M3" && !spec.readOnly ? "all" : "none"} />
      )}
    </>
  )
}

function StateLayer({ spec, g }: { spec: OverlaySpec; g: Geom }) {
  const [ui] = useTableUi()
  const style = findStyle(ui.styleId)
  /** 强调色实底的格（标题行等）：选中环改白 + 深蓝双层环、插入符改白，保证在强调色上可辨（03-30 §2.4） */
  const onAccent = (r: number, c: number) => paint(style, ui.flags, r, c, g.rows, g.cols.length).fg === "#FFFFFF"
  const live = !spec.readOnly
  return (
    <>
      {spec.target && ui.gridOpen && <HoverBox box={{ x: PLACEHOLDER.x, y: yp(PLACEHOLDER.y), w: PLACEHOLDER.w, h: yp(PLACEHOLDER.h) }} />}
      {live && spec.range && <RangeFill box={cellsBox(g, spec.range.r0, spec.range.c0, spec.range.r1, spec.range.c1)} outline={!spec.borders} />}
      {live && spec.range && spec.borders && <BorderPreview g={g} range={spec.range} />}
      {spec.frame && <SelectionBox box={tableBox(g)} handles={spec.frame === "whole" && live ? "all" : "none"} />}
      {live && spec.ring && <CellRing box={cellsBox(g, spec.ring.r0, spec.ring.c0, spec.ring.r1, spec.ring.c1)} onAccent={onAccent(spec.ring.r0, spec.ring.c0)} />}
      {live && spec.caret && <Caret g={g} {...spec.caret} onAccent={onAccent(spec.caret.r, spec.caret.c)} />}
      {live && spec.insertHandles && <InsertHandles g={g} />}
      {live && spec.resize && <ResizeGuide g={g} />}
      {live && spec.keyHint && <KeyHint g={g} />}
    </>
  )
}

/* ------------------------------------------------------------------ 选中环、插入符、选区 */

/** 当前格：2px 强调色内描边；强调色实底上改为 2px 白 + 2px 深蓝（强调色压暗）双层环 */
function CellRing({ box, onAccent }: { box: Box; onAccent: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute",
        onAccent
          ? "shadow-[inset_0_0_0_2px_var(--v3-accent-fg),inset_0_0_0_4px_color-mix(in_srgb,var(--v3-accent)_55%,black)]"
          : "shadow-[inset_0_0_0_2px_var(--v3-accent)]",
      )}
      style={boxStyle(box)}
    />
  )
}

/** 插入符：与第 1 页标题编辑态同一画法（2px 强调色竖线）；在强调色实底上用白色 */
function Caret({ g, r, c, end, onAccent }: { g: Geom; r: number; c: number; end?: boolean; onAccent: boolean }) {
  const cell = cellsBox(g, r, c)
  const x = end ? cell.x + cell.w - 0.75 : cell.x + 0.75
  const style: CSSProperties = { left: `${x}%`, top: `${yp(g.y + r * g.rowH + 0.45)}%`, height: `${yp(2.25)}%` }
  return <span aria-hidden="true" className={cn("pointer-events-none absolute w-0.5 -translate-x-1/2", onAccent ? "bg-(--v3-accent-fg)" : "bg-(--v3-accent)")} style={style} />
}

/** 单元格选区：所选格主色覆盖（--v3-sel）+ 外沿 2px 强调色描边（不只靠颜色，高对比度模式可辨） */
function RangeFill({ box, outline }: { box: Box; outline: boolean }) {
  return <div aria-hidden="true" className={cn("pointer-events-none absolute bg-(--v3-sel)", outline && "border-2 border-(--v3-accent)")} style={boxStyle(box)} />
}

/** 边框预览：按检查器当前预设在选区外沿与内部格线上出线（1.5 pt，文档边框色）；预览期间不画选区描边 */
function BorderPreview({ g, range }: { g: Geom; range: { r0: number; c0: number; r1: number; c1: number } }) {
  const [ui] = useTableUi()
  const on = borderEdges(ui.border)
  const b = cellsBox(g, range.r0, range.c0, range.r1, range.c1)
  const lines: ReactNode[] = []
  const h = (key: string, y: number) =>
    lines.push(<span key={key} className="absolute h-0.5 -translate-y-1/2" style={{ left: `${b.x}%`, width: `${b.w}%`, top: `${y}%`, backgroundColor: BORDER_INK }} />)
  const v = (key: string, x: number) =>
    lines.push(<span key={key} className="absolute w-0.5 -translate-x-1/2" style={{ top: `${b.y}%`, height: `${b.h}%`, left: `${x}%`, backgroundColor: BORDER_INK }} />)
  if (on.top) h("t", b.y)
  if (on.bottom) h("b", b.y + b.h)
  if (on.left) v("l", b.x)
  if (on.right) v("r", b.x + b.w)
  if (on.h) for (let r = range.r0 + 1; r <= range.r1; r++) h(`h${r}`, yp(g.y + r * g.rowH))
  if (on.v) for (let c = range.c0 + 1; c <= range.c1; c++) v(`v${c}`, g.x + sum(g.cols.slice(0, c)))
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {lines}
    </div>
  )
}

/* ------------------------------------------------------------------ M3 画布手柄 */

/** 20px 强调色方形手柄、白色加号、2px 白环（落在强调色标题行上也可辨）；不带阴影（只有浮层带阴影） */
function PlusHandle({ style, label, faded }: { style: CSSProperties; label: string; faded?: boolean }) {
  return (
    <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={style}>
      <Tip label={label}>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex size-5 items-center justify-center rounded-[4px] bg-(--v3-accent) text-(--v3-accent-fg) ring-2 ring-(--v3-accent-fg) transition-opacity hover:opacity-100",
            faded && "opacity-45",
          )}
        >
          <Plus size={12} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </Tip>
    </div>
  )
}

/**
 * 悬停插入手柄：行首「+」（悬停中）对准第 4、5 行之间，插入位置画贯穿表宽的 2px 强调色虚线；
 * 列顶「+」（指针未停留）45% 不透明度，下接短虚线指向第 3、4 列之间（03-30 §5.1）。
 * 两处都避开整表选中框四边中点的缩放手柄，免得挤在一起。
 */
function InsertHandles({ g }: { g: Geom }) {
  const t = tableBox(g)
  const rowY = yp(g.y + 4 * g.rowH)
  const colX = g.x + sum(g.cols.slice(0, 3))
  return (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute h-0 -translate-y-px border-t-2 border-dashed border-(--v3-accent)" style={{ left: `${t.x}%`, width: `${t.w}%`, top: `${rowY}%` }} />
      <PlusHandle label="在此插入行" style={{ left: `calc(${t.x}% - 30px)`, top: `${rowY}%` }} />
      <span aria-hidden="true" className="pointer-events-none absolute h-2 w-0 border-l border-dashed border-(--v3-accent) opacity-45" style={{ left: `${colX}%`, top: `calc(${t.y}% - 8px)` }} />
      <PlusHandle label="在此插入列" faded style={{ left: `${colX}%`, top: `calc(${t.y}% - 30px)` }} />
    </>
  )
}

/**
 * 拖第 1 列右分隔线：原位置 2px 强调色 35% 实线，新位置 2px 强调色虚线（上下各超出表格 10px），中点拖动柄；
 * 角标贴新分隔线、在表格底边下方 10px，数值由几何换算（相邻两列此消彼长、表宽不变，03-30 §5.2）。
 */
const DRAG = 3.75
function ResizeGuide({ g }: { g: Geom }) {
  const t = tableBox(g)
  const x0 = g.x + (g.cols[0] ?? 0)
  const x1 = x0 + DRAG
  const w0 = g.cols[0] ?? 0
  return (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute w-0.5 -translate-x-1/2 bg-(--v3-accent)/35" style={{ left: `${x0}%`, top: `${t.y}%`, height: `${t.h}%` }} />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute w-0 -translate-x-1/2 border-l-2 border-dashed border-(--v3-accent)"
        style={{ left: `${x1}%`, top: `calc(${t.y}% - 10px)`, height: `calc(${t.h}% + 20px)` }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[4px] bg-(--v3-accent) text-(--v3-accent-fg) ring-2 ring-(--v3-accent-fg)"
        style={{ left: `${x1}%`, top: `${t.y + t.h / 2}%` }}
      >
        <MoveHorizontal size={12} strokeWidth={2} />
      </span>
      <div className="pointer-events-none absolute mt-2.5" style={{ left: `${x1}%`, top: `${t.y + t.h}%` }}>
        <SizeTag className="h-5 text-[12px]">
          第 1 列 {pts(w0)} → {len(pts(w0 + DRAG))} · 右侧列等量收窄
        </SizeTag>
      </div>
    </>
  )
}

/**
 * 跨格导航的按键提示（画布提示签，表格底边下方 10px）：演示说明，产品不画（rulings §4.25 TB-9），签首挂「演示」标记以免误读为界面元素；
 * 末格 Tab 的 M2 / M3 差异写在状态说明里。
 */
function KeyHint({ g }: { g: Geom }) {
  const t = tableBox(g)
  const k = (s: string) => <Kbd className="text-(--v3-text)">{s}</Kbd>
  return (
    <CanvasTag box={{ x: t.x, y: t.y + t.h }} className="mt-2.5 gap-3">
      <Tag>演示</Tag>
      <span className="flex items-center gap-1.5">{k("Tab")}下一格</span>
      <span className="flex items-center gap-1.5">{k("⇧Tab")}上一格</span>
      <span className="flex items-center gap-1.5">{k("←→↑↓")}在格边越界到相邻格</span>
      <span className="flex items-center gap-1.5">{k("Esc")}回到表格</span>
    </CanvasTag>
  )
}

/* ------------------------------------------------------------------ 空内容占位符的图标条（03-16 的正式组件，kit PlaceholderIconBar） */

/**
 * 空正文占位符中央的快速插入图标条（G-80，规格在 03-16，本场景只画它的「表格」去向）：与文本场景同一个组件（kit PlaceholderIconBar），
 * 放在 kit PaperScope 里取亮色 token（纸面恒为白色，强调色跟随当前主题）；评审 / 查看不出。
 * 表格图标点开与工具条同一个网格弹层（Q2），弹层打开期间按下态（aria-expanded）。锚点 table.ph-table。
 */
function PlaceholderIconBar({ grid }: { grid: boolean }) {
  const [ui, set] = useTableUi()
  const area: Box = { x: PLACEHOLDER.x, y: yp(PLACEHOLDER.y + 5), w: PLACEHOLDER.w, h: yp(PLACEHOLDER.h - 5) }
  // 网格弹层从这里展开时会压住提示文字：弹层开着就先收起提示（只露半句会像文字重叠）
  const hint = !(grid && ui.gridOpen)
  return (
    <PaperScope>
      <div className="pointer-events-none absolute flex flex-col items-center justify-center gap-3" style={boxStyle(area)}>
        <KitPlaceholderIconBar kinds={["table", "picture", "chart", "video"]} tableAnchor="table.ph-table" pressedKind={grid && ui.gridOpen ? "table" : undefined} onTable={() => grid && set({ gridOpen: true })} />
        <p className={cn("text-[12px] leading-4 text-(--v3-text-2)", !hint && "invisible")}>单击图标插入，或把图片拖到这里</p>
      </div>
    </PaperScope>
  )
}
