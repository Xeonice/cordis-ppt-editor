import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from "react"
import { CircleAlert, LoaderCircle, Lock } from "lucide-react"
import { boxStyle, Button, CanvasTag, HitArea, ICON, PaperScope, PlaceholderIconBar, RemoteSelection, SelectionBox, useBreakpoint, useSceneState, type Box, type PhKind } from "../../kit"
import { PANEL_LIMITS } from "../../editor/resize"
import { LayoutArt, type PhDef } from "./LayoutArt"
import { movedBox, MV_KEYS, phPosText, phSizeText, typeNameOf, useMasterView, type MasterView } from "./mv-state"
import { livePreview, useThemeState } from "./ThemeParts"

/**
 * 母版视图的画布（2026-10-30 母版视图改版第二步，规格 §3.3；dir §2.3、线框 L313–498）：画布上只放幻灯片——没有范围行，也没有图例。
 *   几何：与普通视图同一套外框（editor/Stage.tsx：画布外框 + 备注区），备注区换成同尺寸的隐形占位并按横幅通道高往上让——
 *         幻灯片与普通视图缺省几何同大，只下移横幅通道的高度（§3.3.1），不量、不写死。
 *   内容：LayoutArt 的 canvas 画法（提示文字、母版图形、页脚文字、普通形状、覆盖字号，§3.3.2）。
 *   标注层：按屏幕像素画全部占位符的框线（本版式虚线 4 / 3、继承项点线 1 / 2）、类型名（同一画面一种落位：先框外、再嵌边框，放不下的省去；labelPlan 避让）与内容占位符的图标条（§3.3.3–§3.3.5）。
 *   选中：kit 点选区 + 选中框 + 尺寸 / 位置角标、M2 锁签（lockPlan 定落位）、提示文本编辑的插入符（§3.3.6–§3.3.9）；多选画真实渲染的卡片网格（§3.3.10，点卡片回到单选时焦点先交给画布外框）；
 *         加载转圈、失败一处「重试」（§3.3.11）。
 *   键盘：选中一个占位符时按 Enter 进入提示文本编辑（双击之外的键盘入口，2026-10-30 总编排裁定第 5 条，见 MasterStage 的 onKeyDown）；
 *         双击或 Enter 进不了（M2、降权、继承项）时，原因写进画布外框里的读屏播报区（同一判法、同一句子，2026-10-31 裁定第 9 条）。
 *   DS-148 两个未采纳的备选（推荐定为全虚线 + 类型名；只在对比场景里由数据 mvVariant.ph = hover / legacy 打开，§3.3.12）。
 * 锚点：stage（画布外框，tabIndex −1：宿主「交给画布」直接落在它上面）、master-view.slide（幻灯片框；普通视图的 slide 不在母版画布上，检查器与紧凑胶囊的缩放读数在母版视图里量它）、
 * master-view.ph-<占位符 id>、master-view.shape-<形状 id>（点选区）。
 */

/* ------------------------------------------------------------------ 几何：画布外框 + 备注区占位（§3.3.1） */

/**
 * 备注区的隐形占位：与普通视图备注块同结构、同高（把手行 + 缺省高 120 的框），按横幅通道高往上让（负的上外边距），
 * 画布外框因此与普通视图同高——幻灯片同大小、只下移横幅通道的高度。不随「母版视图没有备注区」垂直居中（dir §6 第 2 条）。
 * 缺省几何只认备注缺省高（PANEL_LIMITS.notes.def），不读本机记住的备注高
 */
function NotesSpacer() {
  const desktop = useBreakpoint() === "desktop"
  return (
    <div aria-hidden="true" inert className="invisible shrink-0 px-12" style={{ marginTop: "calc(-1 * var(--v3-banner-h, 0px))" }}>
      {desktop ? (
        <div className="mb-1 -mt-1.5">
          <div className="mx-auto h-4 w-16" />
        </div>
      ) : (
        <div className="mx-auto mb-2 h-1 w-10" />
      )}
      <div style={{ height: PANEL_LIMITS.notes.def }} />
    </div>
  )
}

/* ------------------------------------------------------------------ 类型名的落位与避让（§3.3.4；纯函数，确定性） */

/** 幻灯片框里的像素矩形（相对幻灯片左上角） */
export interface PxRect {
  x: number
  y: number
  w: number
  h: number
}
export type LabelMode = "inset" | "outside"
/** 横向的两个位置：左起框左缘 + 8（start）· 右止框右缘 − 8（end） */
export type LabelAlign = "start" | "end"
export interface LabelCandidate {
  /** 占位符 id */
  id: string
  /** 文字宽（量出来的，px） */
  width: number
  /** 占位符框（px） */
  box: PxRect
  /** 同面积时的先后（placeholdersFor 的顺序） */
  order: number
  /** 这一枚能用的落位（框高 < 40 的只有框外；备选 2 的「母版 · 类型」只有框外） */
  modes: LabelMode[]
}
export interface LabelSpot {
  id: string
  mode: LabelMode
  rect: PxRect
}
export interface LabelPlanInput {
  slide: { w: number; h: number }
  labels: LabelCandidate[]
  /** 全部占位符的框（算「别的占位符的框线」） */
  frames: { id: string; box: PxRect }[]
  /** 各占位符提示文字的首行矩形（自己的也算） */
  prompts: PxRect[]
  /** 最高优先级的件（选中项的尺寸 / 位置角标、M2 锁签）：先定下，类型名给它们让位 */
  fixed: PxRect[]
}

/** 类型名一行的高（12/16） */
export const LABEL_H = 16
/** 左起框左缘 + 8；嵌边框时边框在文字处断开，断口 = 文字宽 + 左右各 4；框外时下沿离上边框 2；碰撞判定外扩 2 */
const LABEL_DX = 8
const LABEL_GAP = 4
const LABEL_OUT = 2
const LABEL_PAD = 2
/** 嵌边框的最低框高（页脚类框只有 26 pt，嵌进去会压住框里垂直居中的页脚文字） */
export const INSET_MIN_H = 40

/** 一个落位的矩形：mode 定竖向（嵌边框：文字中线压在上边框上 · 框外：下沿离上边框 2），align 定横向 */
export function labelRect(c: Pick<LabelCandidate, "width" | "box">, mode: LabelMode, align: LabelAlign = "start"): PxRect {
  const y = mode === "inset" ? c.box.y - LABEL_H / 2 : c.box.y - LABEL_OUT - LABEL_H
  const x = align === "start" ? c.box.x + LABEL_DX : c.box.x + c.box.w - LABEL_DX - c.width
  return { x, y, w: c.width, h: LABEL_H }
}
/** 一枚类型名能用的落位：框高 ≥ 40 的两种都能用，框高 < 40 的只能在框外 */
export const labelModes = (box: PxRect): LabelMode[] => (box.h >= INSET_MIN_H ? ["inset", "outside"] : ["outside"])
/** 整个画面按序尝试的落位（同一画面只用一种，见 labelPlan）：先框外、再嵌边框 */
export const PLAN_MODES: LabelMode[] = ["outside", "inset"]
/** 横向按序尝试：先左、再右 */
const LABEL_ALIGNS: LabelAlign[] = ["start", "end"]

const meets = (a: PxRect, b: PxRect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const grow = (r: PxRect, d: number): PxRect => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d })
/** 一个框的四条框线（各 1px 粗） */
const edgesOf = (b: PxRect): PxRect[] => [
  { x: b.x, y: b.y, w: b.w, h: 1 },
  { x: b.x, y: b.y + b.h - 1, w: b.w, h: 1 },
  { x: b.x, y: b.y, w: 1, h: b.h },
  { x: b.x + b.w - 1, y: b.y, w: 1, h: b.h },
]

/**
 * 一种落位下的排法：候选标签按「框面积大的 → 小的 → 同面积按 placeholdersFor 顺序」排优先级（最高优先级的件——尺寸 / 位置角标、M2 锁签——已经先定下），
 * 按优先级逐个定位置，横向先左（框左缘 + 8）后右（框右缘 − 8）；一个位置的矩形外扩 2px 后，碰到已定下的件、别的占位符的框线、
 * 任何占位符里提示文字的首行矩形、或出了幻灯片边缘，就算碰撞，两个位置都碰撞的这一枚不画（不截断，也不挪到别处）。
 * 嵌边框时断口（文字宽 + 左右各 4）要落在自己的上边框之内（窄框放不下就不嵌）；靠右只在文字连同左右各 8 放得进框宽时才试（不伸到框左缘以外）
 */
function planIn(mode: LabelMode, order: LabelCandidate[], { slide, frames, prompts, fixed }: LabelPlanInput): LabelSpot[] {
  const placed: PxRect[] = [...fixed]
  const out: LabelSpot[] = []
  for (const c of order) {
    if (!c.modes.includes(mode)) continue
    const lines = frames.filter((f) => f.id !== c.id).flatMap((f) => edgesOf(f.box))
    for (const align of LABEL_ALIGNS) {
      if (align === "end" && c.width + 2 * LABEL_DX > c.box.w) continue
      const rect = labelRect(c, mode, align)
      if (mode === "inset" && (rect.x - LABEL_GAP < c.box.x || rect.x + rect.w + LABEL_GAP > c.box.x + c.box.w)) continue
      const e = grow(rect, LABEL_PAD)
      const off = e.x < 0 || e.y < 0 || e.x + e.w > slide.w || e.y + e.h > slide.h
      if (off || placed.some((r) => meets(e, r)) || lines.some((r) => meets(e, r)) || prompts.some((r) => meets(e, r))) continue
      placed.push(rect)
      out.push({ id: c.id, mode, rect })
      break
    }
  }
  return out
}

/**
 * 类型名的落位（§3.3.4；2026-10-31 修复第 1 轮改口径：同一画面只用一种落位）：整个画面按 PLAN_MODES 的先后试——先全部写在框外上方，再全部嵌在上边框；
 * 取第一种能把每一枚都放下的；都放不全时取放下最多的那一种（一样多取先试的）。放不下的那几枚不画，也不改用另一种落位——
 * 同一画面里不会一枚在框外、一枚嵌在边框上（原来逐枚按「嵌边框 → 框外」取，1600 × 1000 下标题在框外、内容嵌边框，页脚一行高低不齐）。
 * 先试框外：页脚、日期、页码这类薄框（26 pt）只能写在框外，几乎每个版式都有它们，框外是大多数尺寸下能整画面统一的那一种，窗口变大变小也不来回换；
 * 框外放下的比嵌边框少时（如「标题幻灯片」的副标题与标题之间只隔 14 pt），整个画面改嵌边框。横向先左后右：内容框左上方是母版的品牌短线时（窗口宽 1440 及以下），
 * 内容的类型名靠右写在框外上方，不再整个省去
 */
export function labelPlan(input: LabelPlanInput): LabelSpot[] {
  const order = [...input.labels].sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h || a.order - b.order)
  let best: LabelSpot[] = []
  for (const mode of PLAN_MODES) {
    const spots = planIn(mode, order, input)
    if (spots.length === order.length) return spots
    if (spots.length > best.length) best = spots
  }
  return best
}

/** 备选 1（mvVariant.ph = hover）选中时的类型标签：高 18（kit 角标同高）、下沿离框 4（§3.3.12） */
export const TAG_H = 18
const TAG_GAP = 4

export interface TagPlanInput {
  slide: { w: number; h: number }
  /** 选中的占位符框（px） */
  box: PxRect
  /** 标签宽（量出来的） */
  width: number
  /** 别的占位符的框（算框线） */
  frames: PxRect[]
  /** 各占位符提示文字的首行矩形 */
  prompts: PxRect[]
  /** 已定下的件：尺寸 / 位置角标、M2 锁签、母版图形与普通形状 */
  fixed: PxRect[]
  /** 选中框角上手柄的宽（量出来的；没有手柄时 0）：左右对齐时标签离框角留出这么宽，不像挂在手柄上 */
  handle: number
}

/**
 * 备选 1 的选中类型标签落在哪（纯函数，确定性；2026-10-31 core 修复 CI-1）：规格 §3.3.12 只定了「框上方、下沿离框 4」，没定左右，也没有避让——
 * 「标题和内容」的内容框上方左端正好是母版的品牌短线，标签贴着它（间隙 0.6 px），两块蓝色读起来连成一块（Q7）。
 * 补的口径：仍在框上方、下沿离框 4，按「左对齐 → 右对齐 → 居中」取第一个不碰撞的（左右对齐时离框角留出手柄的宽，不像挂在手柄上——2026-10-31 修复第 2 轮，总编排裁定第 16 条；
 * 居中会正好落在上边中点的手柄上，排在最后）；碰撞同类型名（§3.3.4）：外扩 2 后碰到已定下的件（角标、锁签、母版图形与普通形状）、
 * 别的占位符的框线、任何提示文字的首行或出了幻灯片就算；都碰撞就不画。标签定下后排进类型名的最高优先级（同尺寸角标），类型名给它让位
 */
export function tagPlan({ slide, box, width, frames, prompts, fixed, handle }: TagPlanInput): PxRect | null {
  const y = box.y - TAG_GAP - TAG_H
  const lines = frames.flatMap(edgesOf)
  for (const x of [box.x + handle, box.x + box.w - handle - width, box.x + (box.w - width) / 2]) {
    const rect = { x, y, w: width, h: TAG_H }
    const e = grow(rect, LABEL_PAD)
    const off = e.x < 0 || e.y < 0 || e.x + e.w > slide.w || e.y + e.h > slide.h
    if (off || fixed.some((r) => meets(e, r)) || lines.some((r) => meets(e, r)) || prompts.some((r) => meets(e, r))) continue
    return rect
  }
  return null
}

/* ------------------------------------------------------------------ M2 锁签的落位（§3.3.7；纯函数，确定性） */

/** 锁签放在选中框的哪里：in 框里的底边、below 框下方、above 框上方；left / right 靠框的哪一边 */
export type LockSpot = "in-left" | "in-right" | "below-left" | "below-right" | "above-left" | "above-right"
/** 按序尝试：先框里（PRD ML-01「框内锁形标签」），左下碰撞就右下（标题的字多靠左）；再框下方、框上方，各先靠左后靠右（页码框这样贴着幻灯片右边的窄框，靠左会伸出幻灯片） */
const LOCK_SPOTS: LockSpot[] = ["in-left", "in-right", "below-left", "below-right", "above-left", "above-right"]
/** 框里时离框的左或右、下各 4；框外时离框上下 4，左右与框齐 */
const LOCK_INSET = 4
/** 各落位的写法（相对选中框；写在行内样式里，不另起类名） */
const LOCK_STYLE: Record<LockSpot, CSSProperties> = {
  "in-left": { left: LOCK_INSET, bottom: LOCK_INSET },
  "in-right": { right: LOCK_INSET, bottom: LOCK_INSET },
  "below-left": { left: 0, top: `calc(100% + ${LOCK_INSET}px)` },
  "below-right": { right: 0, top: `calc(100% + ${LOCK_INSET}px)` },
  "above-left": { left: 0, bottom: `calc(100% + ${LOCK_INSET}px)` },
  "above-right": { right: 0, bottom: `calc(100% + ${LOCK_INSET}px)` },
}

/** 一个落位的矩形（与 LOCK_STYLE 同一套几何） */
export function lockRect(spot: LockSpot, box: PxRect, size: { w: number; h: number }): PxRect {
  const inside = spot.startsWith("in-")
  const d = inside ? LOCK_INSET : 0
  const x = spot.endsWith("-right") ? box.x + box.w - d - size.w : box.x + d
  const y = inside ? box.y + box.h - LOCK_INSET - size.h : spot.startsWith("below-") ? box.y + box.h + LOCK_INSET : box.y - LOCK_INSET - size.h
  return { x, y, w: size.w, h: size.h }
}

export interface LockPlanInput {
  slide: { w: number; h: number }
  /** 选中的占位符框（px） */
  box: PxRect
  /** 锁签的尺寸（量出来的） */
  size: { w: number; h: number }
  /** 别的占位符的框（算框线） */
  frames: PxRect[]
  /** 画出来的提示文字的每一行（各占位符的都算，自己的也算） */
  texts: PxRect[]
  /** 已定下的件：角标、母版图形与普通形状 */
  fixed: PxRect[]
}

/**
 * M2 锁签落在哪（2026-11-01 修复第 3 轮，复验 RV2-N1）：规格 §3.3.7 只写了「框高 < 32 放框下方 4」，core 补过「框里提示文字下面放不下也放框下方」，
 * 两处都没看框下方有什么——点选标题或小标题时，锁签压住下面一个占位符的字、盖住品牌短线，小尺寸下伸出幻灯片。
 * 现在按 LOCK_SPOTS 的先后取第一个不碰撞的；碰撞同备选 1 的类型标签（tagPlan）：外扩 2 后碰到已定下的件、别的占位符的框线、提示文字或出了幻灯片就算——
 * 提示文字比 tagPlan 严，每一行都算（锁签比类型名大得多，放在框里时碰到的常常不是首行），量的是字，不是段落的块盒。
 * 框里的两个落位要求框放得下（高 ≥ 锁签高 + 2 × 4，宽同理）。都碰撞就不画（同类型名与类型标签）：原因仍在上下文条与检查器顶行。
 * 不看类型名：类型名给它让位（定下后排进 labelPlan 的最高优先级）；也不看图标条：图标条只示意，压到时省去（见标注层）
 */
export function lockPlan({ slide, box, size, frames, texts, fixed }: LockPlanInput): LockSpot | null {
  const lines = frames.flatMap(edgesOf)
  for (const spot of LOCK_SPOTS) {
    if (spot.startsWith("in-") && (box.h < size.h + 2 * LOCK_INSET || box.w < size.w + 2 * LOCK_INSET)) continue
    const e = grow(lockRect(spot, box, size), LABEL_PAD)
    const off = e.x < 0 || e.y < 0 || e.x + e.w > slide.w || e.y + e.h > slide.h
    if (off || fixed.some((r) => meets(e, r)) || lines.some((r) => meets(e, r)) || texts.some((r) => meets(e, r))) continue
    return spot
  }
  return null
}

/* ------------------------------------------------------------------ 标注层（§3.3.3–§3.3.5） */

/** 一个占位符在标注层里怎么画 */
interface Mark {
  def: PhDef
  /** 画布上的框（拖动中是移动后的位置） */
  box: Box
  /** dash 虚线 4 / 3 · dot 点线 1 / 2 · solid 实线（DS-148 未采纳的备选 2 的本版式） */
  line: "dash" | "dot" | "solid"
  /**
   * 选中项：不画灰色框线——选中框（kit SelectionBox，CSS 边框）就画在同一个框上，同普通对象「选中框代替轮廓」（dir §2.3 选中「同普通对象」）。
   * 两条线各按各的取整画（标注层按 CSS 像素取整，CSS 边框按设备像素对齐），DPR 2 下会错开 1 px、一条边上露出虚线（2026-10-31 core 修复 states-C4）。
   * 框仍算进别的类型名的避让（frames），选中框就在那里
   */
  selected?: boolean
  /** 类型名（不写时为空） */
  label?: string
  /** 只试框外（DS-148 未采纳的备选 2 的「母版 · 类型」） */
  outsideOnly?: boolean
  /** 图标条的项（内容占位符四项、图片占位符一项；其余不画） */
  icons?: PhKind[]
}

/** 量出来的东西：类型名落位、图标条位置、插入符 */
interface Geo {
  spots: LabelSpot[]
  bars: { id: string; x: number; y: number }[]
  caret: PxRect | null
}

const CONTENT_ICONS: PhKind[] = ["table", "picture", "chart", "video"]
const ALL_ICONS: PhKind[] = ["table", "picture", "chart", "video"]
/** 图标条的尺寸（kit PlaceholderIconBar：64 的方形按钮、间距 8；只有一项时 72）；放下它要上下、左右各留 8 */
const barSize = (n: number) => (n === 1 ? { w: 72, h: 72 } : { w: n * 64 + (n - 1) * 8, h: 64 })
const BAR_MARGIN = 8

/** 字体加载完成后再量一次（类型名与提示文字的宽高随字体变） */
function useFontsTick(): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    let live = true
    const bump = () => live && setN((x) => x + 1)
    void document.fonts?.ready.then(bump)
    document.fonts?.addEventListener?.("loadingdone", bump)
    return () => {
      live = false
      document.fonts?.removeEventListener?.("loadingdone", bump)
    }
  }, [])
  return n
}

/**
 * 提示文字的首行矩形（§3.3.4）：正文取第一个 data-mv-level 行（这一段的行盒，只取第一行那么高；竖排取最右一列那么宽）；
 * 其余取内容盒里文字的矩形（Range 量各行的字，取最上面那一行的并）
 */
function promptLine(box: Element): DOMRect | null {
  const row = box.querySelector("[data-mv-level]")
  if (row) {
    const r = row.getBoundingClientRect()
    const lh = parseFloat(getComputedStyle(row).lineHeight) || 0
    if (getComputedStyle(row).writingMode.startsWith("vertical")) {
      const w = lh ? Math.min(r.width, lh) : r.width
      return new DOMRect(r.right - w, r.top, w, r.height)
    }
    return new DOMRect(r.left, r.top, r.width, lh ? Math.min(r.height, lh) : r.height)
  }
  const p = box.querySelector("p")
  return p ? firstLine(p) : null
}

/** 一个占位符里画出来的提示文字的每一行（Range 量字，不量段落的块盒；整段落到框外、被裁掉的不算）：M2 锁签不压其中任何一行 */
function promptRects(box: Element): DOMRect[] {
  const c = box.getBoundingClientRect()
  return [...box.querySelectorAll("p")].flatMap((p) => {
    const range = document.createRange()
    range.selectNodeContents(p)
    return [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0 && r.top >= c.top - 0.5 && r.bottom <= c.bottom + 0.5 && r.left >= c.left - 0.5 && r.right <= c.right + 0.5)
  })
}

/** 一段文字（p）的首行矩形：用 Range 量各行的盒，取最上面那一行的并 */
function firstLine(p: Element): DOMRect | null {
  const range = document.createRange()
  range.selectNodeContents(p)
  const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0)
  const top = rects[0]
  if (!top) return null
  const line = rects.filter((r) => Math.abs(r.top - top.top) < Math.max(1, top.height / 2))
  const l = Math.min(...line.map((r) => r.left))
  const t = Math.min(...line.map((r) => r.top))
  const rr = Math.max(...line.map((r) => r.right))
  const b = Math.max(...line.map((r) => r.bottom))
  return new DOMRect(l, t, rr - l, b - t)
}

/** 一段文字（p）最后一个字的位置：插入符落在被点的那一行末尾 */
function lastGlyph(p: Element): DOMRect | null {
  const range = document.createRange()
  range.selectNodeContents(p)
  const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0)
  return rects[rects.length - 1] ?? null
}

/** 元素自己直接带文字的子孙（选中框的角标、锁签）：标注层避让它们 */
function textBoxes(root: Element): Element[] {
  return [...root.querySelectorAll("span, div")].filter((el) => [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && !!n.textContent?.trim()))
}

/** 等几何稳定最多等几轮（每轮等当时在跑的过渡全部结束）；过渡一直不停时到上限也定下落位 */
const SETTLE_ROUNDS = 8
/** 只改颜色、透明度、可见性、阴影这类的过渡不挪动、不改尺寸，不用等 */
const PAINT_ONLY = /color|opacity|visibility|shadow|fill|stroke|filter/

/**
 * 量到的几何还会不会变：幻灯片里还在跑、会挪动或改尺寸的 CSS 过渡——只看量的对象所在的地方：内容层（幻灯片框里 LayoutArt 画的内容）与选中框、锁签（data-mv-obstacle）；
 * 标注层自己画的类型名、图标条与框线是输出，不算。浏览器没有这套接口时当作没有
 */
function movingInputs(slideBox: Element, frame: Element, layer: Element): Animation[] {
  if (typeof CSSTransition === "undefined" || typeof slideBox.getAnimations !== "function") return []
  return slideBox.getAnimations({ subtree: true }).filter((a) => {
    if (!(a instanceof CSSTransition) || PAINT_ONLY.test(a.transitionProperty)) return false
    const t = a.effect instanceof KeyframeEffect ? a.effect.target : null
    if (!t || layer.contains(t)) return false
    return frame.contains(t) || !!t.closest("[data-mv-obstacle]")
  })
}

/**
 * 标注层：铺满幻灯片框、绝对定位、不接指针的一层（画在 LayoutArt 的 children 里，读得到纸面 token --s-*）。
 * ResizeObserver 取幻灯片框的像素尺寸，把百分比框换成像素后用一个 SVG 画全部框线（crispEdges、线宽 1、不随缩放变粗变细）；
 * 每条边单独一段、从角点起画，四角都落在「实」上（上边：左上 → 右上，右边：右上 → 右下，下边：右下 → 左下，左边：左下 → 左上）。
 * 类型名与图标条是纸面件，走 PaperScope（白纸面上取亮色 token：12/16 text-2，5.74:1），暗亮主题同一外观。
 * 先画一遍量尺寸（类型名的宽、提示文字的首行、角标的位置、锁签的尺寸），在布局阶段按 labelPlan 定落位、画第二遍，用户看不到第一遍；
 * 量的对象上还有过渡在跑（几何还会变）时等它们结束再定（effect 里的 settle）。
 * tag：备选 1 选中时的类型标签属于哪个占位符（标签本身由 SlideCanvas 画在幻灯片框上，带 data-mv-hover-tag）——在同一遍里先按 tagPlan 定它的落位（onTag 交回），
 * 再把它当最高优先级的件排类型名。
 * lock：M2 锁签属于哪个占位符（锁签由 SlideCanvas 画在选中框上，带 data-mv-lock）——同样在这一遍里先按 lockPlan 定落位（onLock 交回），类型名按定下的位置让位，
 * 压到的图标条省去；都碰撞时锁签不在页面上，再量时用上次量到的尺寸（lockSize）
 */
function Annotations({
  marks,
  stateKey,
  caret,
  tag,
  onTag,
  lock,
  lockSize,
  onLock,
}: {
  marks: Mark[]
  stateKey: string
  caret: { ph: string; level: number } | null
  tag?: string | null
  onTag?: (spot: PxRect | null) => void
  lock?: string | null
  lockSize?: RefObject<{ w: number; h: number } | null>
  onLock?: (spot: LockSpot | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [geo, setGeo] = useState<Geo | null>(null)
  const fonts = useFontsTick()
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => {
      const r = el.getBoundingClientRect()
      setSize((s) => (s && Math.abs(s.w - r.width) < 0.01 && Math.abs(s.h - r.height) < 0.01 ? s : { w: r.width, h: r.height }))
    }
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const key = `${stateKey}|${marks.map((m) => `${m.def.id}:${m.line}:${m.label ?? ""}:${m.outsideOnly ? 1 : 0}:${m.selected ? 1 : 0}:${m.box.x},${m.box.y},${m.box.w},${m.box.h}`).join(";")}|${caret ? `${caret.ph}.${caret.level}` : ""}|${tag ?? ""}|${lock ?? ""}`
  useLayoutEffect(() => {
    let live = true
    let rounds = 0
    /** 量一遍、按 labelPlan 定落位：只在量到的几何稳定之后调（见下面的 settle） */
    const measure = () => {
      const el = ref.current
      const frame = el?.parentElement
      const slideBox = frame?.closest('[data-v3-anchor="master-view.slide"]')
      if (!el || !frame || !size || !slideBox) return
      const base = el.getBoundingClientRect()
      const rel = (r: DOMRect): PxRect => ({ x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height })
      const px = (b: Box): PxRect => ({ x: (b.x / 100) * size.w, y: (b.y / 100) * size.h, w: (b.w / 100) * size.w, h: (b.h / 100) * size.h })
      const boxOf = (id: string) => frame.querySelector<HTMLElement>(`[data-mv-ph="${CSS.escape(id)}"]`)
      // 提示文字的首行（只算画在框内的段）
      const prompts: PxRect[] = []
      for (const m of marks) {
        const cb = boxOf(m.def.id)
        const r = cb ? promptLine(cb) : null
        if (cb && r) {
          const c = cb.getBoundingClientRect()
          if (r.top >= c.top - 0.5 && r.bottom <= c.bottom + 0.5 && r.left >= c.left - 0.5 && r.right <= c.right + 0.5) prompts.push(rel(r))
        }
      }
      // 最高优先级的件：幻灯片框里（标注层之外）带文字的角标（M2 锁签在下面单算：它的落位正要定，页面上量到的不算数）；
      // 另加母版图形与普通形状（品牌短线、竖条、细线、形状，LayoutArt canvas 画法带 data-mv-graphic）：类型名不压在它们上面（Q7 无重叠，§3.3.4 的碰撞清单之外另加的一项）
      const fixed = [
        ...[...slideBox.querySelectorAll("[data-mv-obstacle]")].flatMap((w) =>
          textBoxes(w)
            .filter((t) => !t.closest("[data-mv-lock]"))
            .map((t) => rel(t.getBoundingClientRect())),
        ),
        ...[...frame.querySelectorAll("[data-mv-graphic]")].map((g) => rel(g.getBoundingClientRect())),
      ]
      // M2 锁签（§3.3.7）：先于类型名定落位，定下后同尺寸角标一样排进最高优先级
      let lockBox: PxRect | null = null
      const lockMark = lock ? marks.find((m) => m.def.id === lock) : undefined
      if (lockMark && lockSize) {
        const r = slideBox.querySelector("[data-mv-lock]")?.getBoundingClientRect()
        if (r) lockSize.current = { w: r.width, h: r.height }
        const tagSize = lockSize.current
        if (tagSize) {
          const box = px(lockMark.box)
          const texts = [...frame.querySelectorAll("[data-mv-ph]")].flatMap((cb) => promptRects(cb).map(rel))
          const spot = lockPlan({ slide: size, box, size: tagSize, frames: marks.filter((m) => m !== lockMark).map((m) => px(m.box)), texts, fixed })
          onLock?.(spot)
          if (spot) {
            lockBox = lockRect(spot, box, tagSize)
            fixed.push(lockBox)
          }
        }
      }
      // 备选 1 的选中类型标签（§3.3.12）：先于类型名定落位，定下后同尺寸角标一样排进最高优先级
      let tagSpot: PxRect | null = null
      const tagMark = tag ? marks.find((m) => m.def.id === tag) : undefined
      const tagEl = tagMark ? slideBox.querySelector<HTMLElement>("[data-mv-hover-tag]") : null
      if (tagMark && tagEl) {
        // 选中框的手柄：选中框里不带文字的小方块（kit SelectionBox 的四角与四边中点），按画出来的宽取
        const handleEl = [...slideBox.querySelectorAll<HTMLElement>("[data-mv-obstacle] > div > span")].find((x) => !x.textContent?.trim())
        tagSpot = tagPlan({
          handle: handleEl ? handleEl.getBoundingClientRect().width : 0,
          slide: size,
          box: px(tagMark.box),
          width: tagEl.getBoundingClientRect().width,
          frames: marks.filter((m) => m !== tagMark).map((m) => px(m.box)),
          prompts,
          fixed,
        })
      }
      onTag?.(tagSpot)
      const widths = new Map<string, number>()
      for (const s of el.querySelectorAll<HTMLElement>("[data-mv-label]")) widths.set(s.dataset.mvLabel ?? "", s.getBoundingClientRect().width)
      const labels: LabelCandidate[] = marks.flatMap((m, i) => {
        const w = widths.get(m.def.id)
        if (!m.label || w === undefined) return []
        const box = px(m.box)
        return [{ id: m.def.id, width: w, box, order: i, modes: m.outsideOnly ? (["outside"] as LabelMode[]) : labelModes(box) }]
      })
      const spots = labelPlan({ slide: size, labels, frames: marks.map((m) => ({ id: m.def.id, box: px(m.box) })), prompts, fixed: tagSpot ? [...fixed, tagSpot] : fixed })
      // 图标条：水平居中；垂直居中于「最后一行正文下沿到框下沿」的剩余高度里，放不下（高 < 条高 + 16 或框宽 < 条宽 + 16）就不画
      const bars: Geo["bars"] = []
      for (const m of marks) {
        if (!m.icons?.length) continue
        const cb = boxOf(m.def.id)
        const lines = cb ? [...cb.querySelectorAll("[data-mv-level]")] : []
        const c = cb?.getBoundingClientRect()
        if (!cb || !c) continue
        const shown = lines.map((l) => l.getBoundingClientRect()).filter((r) => r.bottom <= c.bottom + 0.5 && r.right <= c.right + 0.5)
        const lastBottom = shown.length ? Math.max(...shown.map((r) => r.bottom)) : c.top
        const box = px(m.box)
        const free = c.bottom - lastBottom
        const need = barSize(m.icons.length)
        if (free < need.h + 2 * BAR_MARGIN || box.w < need.w + 2 * BAR_MARGIN) continue
        const bar = { x: box.x + (box.w - need.w) / 2, y: lastBottom - base.top + (free - need.h) / 2 }
        // M2 锁签压到图标条时，图标条省去（同「放不下就省去」：图标条只示意，锁签是要读的字，也不为它把锁签挪出框外）
        if (lockBox && meets(grow(lockBox, LABEL_PAD), { ...bar, ...need })) continue
        bars.push({ id: m.def.id, ...bar })
      }
      // 插入符：被点的那一行最后一个字的右边，2px 宽、与那一行同高
      let caretRect: PxRect | null = null
      if (caret) {
        const cb = boxOf(caret.ph)
        const p = cb?.querySelector(`[data-mv-level="${caret.level}"]`) ?? cb?.querySelector("p")
        const g = p ? lastGlyph(p) : null
        if (g) caretRect = { x: g.right - base.left, y: g.top - base.top, w: 2, h: g.height }
      }
      const next: Geo = { spots, bars, caret: caretRect }
      setGeo((g) => (g && JSON.stringify(g) === JSON.stringify(next) ? g : next))
    }
    /**
     * 等几何稳定再定落位（2026-10-31 修复第 2 轮，复验 RV1-N1；总编排裁定第 14 条）：系统开了「减少动态效果」时，全局样式给每个元素 1ms 的过渡
     * （index.css 里 prefers-reduced-motion 那一条只写了时长，过渡的属性取缺省的「全部」）。内容层的节点一改位置、尺寸或字号，浏览器就起一段 1ms 的过渡，
     * 而且要到下一帧才开始、再下一帧才到新值——提交时与紧接着的下一帧量到的都还是改前的几何（原来在布局阶段量一次、下一帧补量一次，两次都落在旧几何上：
     * 窗格换版式后图标条按上一个版式的正文排、类型名按上一个版式的品牌短线与提示文字避让；窗口尺寸变时紧凑画布里品牌短线按旧位置量，也是这个原因）。
     * 所以先看量的对象上还有没有在跑的过渡（movingInputs）：有就先不定落位，等它们全部结束（结束或被取消都算）再看一次；量的时候没有在跑的过渡才定。
     * 不靠固定的延时；轮数有上限（SETTLE_ROUNDS）。没开「减少动态效果」时内容层没有过渡，提交时就定。换对象（窗格换版式或母版）时内容层与本层都换一组新节点（见 LayoutArt 与 SlideCanvas 的 key），
     * 新节点不起过渡，提交时量到的就是新几何
     */
    const settle = () => {
      if (!live) return
      const el = ref.current
      const frame = el?.parentElement
      const slideBox = frame?.closest('[data-v3-anchor="master-view.slide"]')
      const moving = el && frame && slideBox ? movingInputs(slideBox, frame, el) : []
      if (moving.length && rounds < SETTLE_ROUNDS) {
        rounds += 1
        void Promise.allSettled(moving.map((a) => a.finished)).then(settle)
        return
      }
      measure()
    }
    settle()
    return () => {
      live = false
    }
    // key 里是全部输入；size 与字体变了也要重量
  }, [key, size?.w, size?.h, fonts])

  const spotOf = (id: string) => geo?.spots.find((s) => s.id === id)
  const W = size?.w ?? 0
  const H = size?.h ?? 0
  const lines: ReactNode[] = []
  if (size) {
    for (const m of marks) {
      // 选中项的框由选中框画（Mark.selected）
      if (m.selected) continue
      const b = { x: (m.box.x / 100) * W, y: (m.box.y / 100) * H, w: (m.box.w / 100) * W, h: (m.box.h / 100) * H }
      // 落在像素正中：1px 线覆盖整像素（DPR 1、2 都清楚）
      const x1 = Math.round(b.x) + 0.5
      const y1 = Math.round(b.y) + 0.5
      const x2 = Math.round(b.x + b.w) - 0.5
      const y2 = Math.round(b.y + b.h) - 0.5
      const dash = m.line === "dash" ? "4 3" : m.line === "dot" ? "1 2" : undefined
      const opacity = m.line === "solid" ? 0.45 : 0.7
      const s = spotOf(m.def.id)
      const segs: string[] = []
      if (s && s.mode === "inset") {
        // 上边在文字处断开：左段从左上角画到断口，右段从右上角往回画到断口（两段都从角点起，角落在「实」上）
        const g1 = Math.round(s.rect.x - LABEL_GAP)
        const g2 = Math.round(s.rect.x + s.rect.w + LABEL_GAP)
        if (g1 > x1) segs.push(`M${x1} ${y1}H${g1}`)
        if (g2 < x2) segs.push(`M${x2} ${y1}H${g2}`)
      } else segs.push(`M${x1} ${y1}H${x2}`)
      segs.push(`M${x2} ${y1}V${y2}`, `M${x2} ${y2}H${x1}`, `M${x1} ${y2}V${y1}`)
      lines.push(
        ...segs.map((d, i) => (
          <path key={`${m.def.id}-${i}`} d={d} fill="none" strokeWidth={1} strokeDasharray={dash} strokeOpacity={opacity} vectorEffect="non-scaling-stroke" style={{ stroke: "var(--s-mute)" }} />
        )),
      )
    }
  }
  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0">
      {size && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges" className="absolute inset-0" aria-hidden="true">
          {lines}
        </svg>
      )}
      <PaperScope className="pointer-events-none absolute inset-0">
        {marks.map((m) => {
          if (!m.label) return null
          const s = spotOf(m.def.id)
          return (
            <span
              key={m.def.id}
              data-mv-label={m.def.id}
              className="absolute text-[12px] leading-4 whitespace-nowrap text-(--v3-text-2)"
              // 第一遍（还没定落位）与省去的类型名只占位量宽、不显示
              style={s ? { left: s.rect.x, top: s.rect.y } : { left: 0, top: 0, visibility: "hidden" }}
            >
              {m.label}
            </span>
          )
        })}
        {geo?.bars.map((b) => {
          const m = marks.find((x) => x.def.id === b.id)
          if (!m?.icons) return null
          return (
            // 只示意：不进 Tab 顺序、不出提示、点不到（inert）
            <div key={b.id} inert aria-hidden="true" className="pointer-events-none absolute" style={{ left: b.x, top: b.y }}>
              <PlaceholderIconBar kinds={m.icons} enabled={ALL_ICONS} />
            </div>
          )
        })}
      </PaperScope>
      {geo?.caret && <span className="absolute" style={{ left: geo.caret.x, top: geo.caret.y, width: geo.caret.w, height: geo.caret.h, background: "var(--v3-accent)" }} />}
    </div>
  )
}

/* ------------------------------------------------------------------ 幻灯片：内容 + 标注 + 选中（§3.3.2–§3.3.9、§3.3.12） */

/** 本版式定义的写类型名，继承项写「母版 · 〈类型〉」 */
const labelOf = (p: PhDef, inherited: boolean) => (inherited ? `母版 · ${typeNameOf(p)}` : typeNameOf(p))
/** 内容族（内容、图片）才有图标条：版式上的内容占位符四项，图片占位符一项 */
function iconsOf(p: PhDef): PhKind[] | undefined {
  const name = typeNameOf(p)
  if (name === "图片") return ["picture"]
  if (name === "内容") return CONTENT_ICONS
  return undefined
}

/** 点在哪一级上：被点的占位符里各级的矩形，取包住指针（或离它最近）的那一级 */
function levelAt(phId: string, clientY: number | null): number {
  const lines = [...document.querySelectorAll<HTMLElement>(`[data-v3-anchor="master-view.slide"] [data-mv-ph="${CSS.escape(phId)}"] [data-mv-level]`)]
  if (!lines.length || clientY === null) return 1
  let best = lines[0]!
  let gap = Infinity
  for (const l of lines) {
    const r = l.getBoundingClientRect()
    const d = clientY < r.top ? r.top - clientY : clientY > r.bottom ? clientY - r.bottom : 0
    if (d < gap) {
      gap = d
      best = l
    }
  }
  return Number(best.dataset.mvLevel) || 1
}

/**
 * 文本末尾在哪一级（Enter 进入提示文本编辑时插入符落在文本末尾，2026-10-30 总编排裁定第 5 条）：内容盒里画出来的（整段在框内的）最后一段的级别——
 * 正文是画到的最后一级，单段的占位符（标题、页脚…）是第 1 级。放不下、被整段取舍到框外的段不算（插入符不画在看不见的地方）
 */
function levelAtEnd(phId: string): number {
  const box = document.querySelector(`[data-v3-anchor="master-view.slide"] [data-mv-ph="${CSS.escape(phId)}"]`)
  if (!box) return 1
  const c = box.getBoundingClientRect()
  const shown = [...box.querySelectorAll<HTMLElement>("[data-mv-level]")].filter((l) => {
    const r = l.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && r.left >= c.left - 0.5 && r.right <= c.right + 0.5 && r.top >= c.top - 0.5 && r.bottom <= c.bottom + 0.5
  })
  return Number(shown[shown.length - 1]?.dataset.mvLevel) || 1
}

/** announce：把一句原因写进画布外框里的读屏播报区（MasterStage 的 announce；双击进不了提示文本编辑时用，与 Enter 同一处） */
function SlideCanvas({ mv, announce }: { mv: MasterView; announce: (why: string) => void }) {
  const theme = useThemeState()
  const preview = livePreview(theme.live)
  const variant = mv.variant.ph ?? "labels"
  const art = mv.artOf(mv.objectId)
  const sel = mv.selectedPh
  const inheritedScope = mv.scope === "layout"
  /** 最近一次点按的位置（kit 点选区的 onClick 不带事件：在捕获阶段记下，点选区里再读） */
  const lastY = useRef<number | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const boxOf = (p: PhDef): Box => (mv.move && mv.move.ph === p.id ? movedBox(p.box, mv.move) : p.box)
  const boxes = { ...art.boxes, ...(mv.move ? Object.fromEntries(mv.placeholders.filter((p) => p.id === mv.move?.ph).map((p) => [p.id, boxOf(p)])) : {}) }
  const selected = sel?.id ?? null

  const marks: Mark[] = mv.placeholders.map((p) => {
    const inherited = !!p.inherited && inheritedScope
    const own = !inherited
    let label: string | undefined = labelOf(p, inherited)
    let line: Mark["line"] = inherited ? "dot" : "dash"
    let outsideOnly = false
    if (variant === "hover") {
      // 备选 1：本版式的框照画虚线、不写类型名；悬停的那一枚写出来，落位随整个画面（同一画面一种落位，见 labelPlan——
      // 规格 §3.3.12 原写悬停时嵌在边框上，2026-10-31 修复第 1 轮改口径后随整画面，总编排裁定第 11 条）；继承项照写「母版 · 类型」
      if (own && hover !== p.id) label = undefined
    } else if (variant === "legacy") {
      // 备选 2：本版式实线、继承项虚线 4 / 3 + 框外纸面小字「母版 · 类型」（右上另有图例）
      line = own ? "solid" : "dash"
      if (own) label = undefined
      else outsideOnly = true
    }
    // 选中项不画自己的类型名（检查器标题写类型，同普通视图），也不画自己的灰色框线（选中框画在同一个框上，Mark.selected）
    if (p.id === selected) label = undefined
    return { def: p, box: boxOf(p), line, label, outsideOnly, icons: iconsOf(p), selected: p.id === selected }
  })
  /** 备选 1 选中时的类型标签：落位由标注层按 tagPlan 算好交回（量到标签宽之后），没算出来之前不显示，都碰撞时不画 */
  const tagFor = sel && variant === "hover" ? sel : null
  const [tagSpot, setTagSpot] = useState<PxRect | null>(null)

  const editable = !!sel && !mv.reason("field")
  const text = mv.caret
  const shape = mv.selectedShape
  /** M2 的锁签只给本对象定义的占位符：继承项照继承的画法（强调色虚线、无手柄），M2 的原因在上下文条与字段上（同检查器顶行的组合规则，§3.4.1） */
  const lockFor = mv.m2 && !text && sel && !(sel.inherited && inheritedScope) ? sel : null
  const lockId = lockFor ? `${mv.objectId}|${lockFor.id}` : null
  /**
   * M2 锁签的落位由标注层按 lockPlan 算好交回：与类型名同一遍定，类型名不会按它换位前的样子避让（2026-11-01 修复第 3 轮；原来锁签自己量、定下后再让标注层重量）。
   * 落位记着是给哪个对象的哪个占位符的；换了就不算数——那一遍锁签不显示、只量尺寸（同备选 1 的类型标签）。null：都碰撞，不画
   */
  const [lockPlanned, setLockPlanned] = useState<{ id: string; spot: LockSpot | null } | null>(null)
  const lockSize = useRef<{ w: number; h: number } | null>(null)
  const lockSpot = lockPlanned && lockPlanned.id === lockId ? lockPlanned.spot : undefined
  const onLock = (spot: LockSpot | null) => {
    if (lockId) setLockPlanned((p) => (p && p.id === lockId && p.spot === spot ? p : { id: lockId, spot }))
  }
  // 内容层画得不一样了就要重量（图标条按最后一行正文下沿排、类型名避让提示文字）：字号覆盖（「重置为母版值」把它去掉）与主题预览的字体都算（2026-10-31 修复第 2 轮，与 RV1-N1 同一类）
  const stateKey = `${mv.objectId}|${selected ?? ""}|${shape?.id ?? ""}|${mv.m2 ? 1 : 0}|${mv.readOnly ? 1 : 0}|${text ? 1 : 0}|${variant}|${hover ?? ""}|${art.override ? JSON.stringify(art.override) : ""}|${preview.className ?? ""}`

  // 双击占位符：可编辑的进入提示文本编辑；不可编辑的（M2、降权、继承项）不进入，startText 交回的原因写进读屏播报区——
  // 与 Enter 同一判法、同一句子（2026-10-31 总编排裁定第 9 条 ②；画面上原因本来就在锁签、上下文条与检查器上，缺的是读屏的回应）
  const onDoubleClick = (e: MouseEvent) => {
    const hit = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-v3-anchor^="master-view.ph-"]')
    const id = hit?.dataset.v3Anchor?.slice("master-view.ph-".length)
    if (!id) return
    const why = mv.startText(id, levelAt(id, e.clientY))
    if (why) announce(why)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (variant !== "hover") return
    const hit = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-v3-anchor^="master-view.ph-"]')
    const id = hit?.dataset.v3Anchor?.slice("master-view.ph-".length) ?? null
    if (id !== hover) setHover(id)
  }

  return (
    <div
      data-v3-anchor="master-view.slide"
      className="relative w-[min(100cqw,calc(100cqh_*_16/9))] rounded-[4px] shadow-(--v3-slide-shadow)"
      onClickCapture={(e) => {
        lastY.current = e.clientY
      }}
      onDoubleClick={onDoubleClick}
      onPointerMove={onPointerMove}
      onPointerLeave={() => hover && setHover(null)}
    >
      <LayoutArt
        master={art.master}
        target={art.target}
        prompts="canvas"
        omit={art.omit}
        shapes={art.shapes}
        override={art.override}
        boxes={boxes}
        name={art.name}
        previewClass={preview.className}
        previewStyle={preview.style}
        className="rounded-[4px]"
      >
        {/* 每个对象一层自己的标注（key）：换对象时类型名、图标条与框线都是新节点，不从上一个对象的位置滑过来（「减少动态效果」时全局的 1ms 过渡，见 Annotations 的 settle） */}
        <Annotations key={mv.objectId} marks={marks} stateKey={stateKey} caret={text} tag={tagFor?.id ?? null} onTag={setTagSpot} lock={lockFor?.id ?? null} lockSize={lockSize} onLock={onLock} />
      </LayoutArt>

      {/* 点选区：普通形状在下、占位符在上（与画法的上下相同）；普通形状只在它所在的对象上可选 */}
      {mv.objectId === mv.seedPane &&
        mv.shapes.map((s) => <HitArea key={s.id} box={s.box} label="选择矩形" anchor={`master-view.shape-${s.id}`} onClick={() => mv.selectShape(s.id)} />)}
      {mv.placeholders.map((p) => (
        <HitArea
          key={p.id}
          box={boxOf(p)}
          label={`选择${typeNameOf(p)}占位符`}
          anchor={`master-view.ph-${p.id}`}
          cursor={text && text.ph === p.id ? "text" : "default"}
          onClick={() => {
            // 提示文本编辑中点同一个占位符：插入符换到被点的那一行（级别跟着换，检查器「级别」随之变）
            if (text && text.ph === p.id) mv.setCaretLevel(levelAt(p.id, lastY.current))
            else mv.selectPh(p.id)
          }}
        />
      ))}

      {shape && (
        <div data-mv-obstacle="" className="contents">
          <SelectionBox box={shape.box} handles="all" label={phSizeText(shape.box)} />
        </div>
      )}
      {sel && (
        <div data-mv-obstacle="" className="contents">
          {text ? (
            // 提示文本编辑态：1px 强调色框、无手柄（04 §2.3a），插入符画在标注层里
            <SelectionBox box={boxOf(sel)} handles="none" />
          ) : mv.move && mv.move.ph === sel.id ? (
            // 拖动中：框在移动后的位置、不画手柄，角标换成位置（04 §2.3a）
            <SelectionBox box={boxOf(sel)} handles="none" label={phPosText(boxOf(sel))} />
          ) : sel.inherited && inheritedScope ? (
            <SelectionBox box={sel.box} handles="none" dashed />
          ) : editable ? (
            <SelectionBox box={sel.box} handles="all" label={phSizeText(sel.box)} />
          ) : (
            <SelectionBox box={sel.box} handles="none" />
          )}
          {/* 都碰撞时不画。还没定下落位时是一枚只量尺寸、不显示的；定下后换一枚新的（key）：新节点不起过渡——「减少动态效果」时不从隐藏的那一枚过渡过来（全局 1ms 的过渡，见 Annotations 的 settle），也不从上一个占位符的位置滑过来 */}
          {lockFor && lockSpot !== null && <LockTag key={lockSpot ? lockId : `${lockId}|measure`} box={boxOf(lockFor)} spot={lockSpot} />}
        </div>
      )}
      {tagFor && (
        // 备选 1：选中时框上方贴一枚类型标签（强调色实底，下沿离框 4，同 figma-10）；左右按 tagPlan 避让（左对齐 → 右对齐 → 居中），落位由标注层算好交回
        <span
          data-mv-hover-tag=""
          className="pointer-events-none absolute inline-flex h-[18px] items-center rounded-[4px] bg-(--v3-accent-solid) px-1.5 text-[12px] leading-none whitespace-nowrap text-(--v3-accent-fg)"
          style={tagSpot ? { left: tagSpot.x, top: tagSpot.y } : { left: 0, top: 0, visibility: "hidden" }}
        >
          {typeNameOf(tagFor)}
        </span>
      )}
      {mv.remote && (() => {
        const p = mv.placeholders.find((x) => x.id === mv.remote?.ph)
        return p ? <RemoteSelection person={mv.remote.person} box={boxOf(p)} /> : null
      })()}
      {variant === "legacy" && inheritedScope && <Legend />}
    </div>
  )
}

/**
 * M2 锁签（R-44；dir L216）：kit CanvasTag 包在 PaperScope 里（两套主题同一外观），锁形 12 +「版式编辑将在后续版本提供」（PRD ML-01 原文）。
 * 落位见 lockPlan，由标注层量好交回（spot）；还没定下时只占位量尺寸、不显示。落位写在行内样式里（不另起类名）。
 * 对读屏隐藏（落位层 aria-hidden），同标注层的框线与类型名：M2 的原因由检查器顶行与画布外框的读屏播报区给（DS-156、TB-194），读屏不在画布上再念一遍
 */
function LockTag({ box, spot }: { box: Box; spot: LockSpot | undefined }) {
  return (
    <div className="pointer-events-none absolute" style={boxStyle(box)}>
      <div data-mv-lock="" aria-hidden="true" className="absolute" style={spot ? LOCK_STYLE[spot] : { ...LOCK_STYLE["in-left"], visibility: "hidden" }}>
        <PaperScope>
          {/* kit CanvasTag 自带绝对定位，这里换成随外层落位（cn 合并类名时后写的生效） */}
          <CanvasTag className="relative">
            <Lock {...ICON} size={12} aria-hidden="true" />
            版式编辑将在后续版本提供
          </CanvasTag>
        </PaperScope>
      </div>
    </div>
  )
}

/** DS-148 未采纳的备选 2 的图例（幻灯片右上方外侧：右缘对齐幻灯片、下沿离幻灯片 12；12px 界面 text-2，16 宽线段样例） */
function Legend() {
  return (
    <span className="pointer-events-none absolute right-0 flex items-center gap-4 text-[12px] leading-none whitespace-nowrap text-(--v3-text-2)" style={{ bottom: "calc(100% + 12px)" }}>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="w-4 border-t border-(--v3-text-2)" />
        此版式定义
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="w-4 border-t border-dashed border-(--v3-text-2)" />
        继承自母版
      </span>
    </span>
  )
}

/* ------------------------------------------------------------------ 多选（§3.3.10） */

/**
 * 多选版式：画布排出所选版式的真实渲染（缩略图画法）——最多三列，列宽 = (可用宽 − 2 × 24) / 3、上限 320，间距 24；
 * 卡片 1px 边、圆角 4；卡下 8 一行「〈名〉 · N 页 / 未使用」；整组在画布里垂直居中。点卡片 = 单击该版式（回到单选）。画布上不写「已选中 N 个版式」（只在上下文条）
 */
function MultiGrid({ mv }: { mv: MasterView }) {
  const cols = Math.min(3, mv.multiLayouts.length)
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, min(320px, calc((100cqw - 48px) / 3)))`, gap: 24 }}>
      {mv.multiLayouts.map((l) => {
        const name = mv.nameOf(l.id)
        const pages = mv.usageFor(l.id)
        const art = mv.artOf(l.id)
        return (
          <button
            key={l.id}
            type="button"
            aria-label={`版式：${name}，${pages.length ? `${pages.length} 页使用` : "未使用"}`}
            data-v3-anchor={`master-view.card-${l.id}`}
            onClick={(e) => {
              e.stopPropagation()
              // 卡片随多选结束卸载（画布换回单张幻灯片）：先把焦点交给画布外框（多选与单选共用的同一个外框），再回到单选——
              // 焦点不经过 body（规格 §3.9；2026-10-31 总编排裁定第 9 条 ①）。点按、Enter、空格都经这里
              e.currentTarget.closest<HTMLElement>('[data-v3-anchor="stage"]')?.focus({ preventScroll: true })
              mv.pick(l.id)
            }}
            className="flex flex-col gap-2 rounded-[4px] text-left outline-none focus-visible:ring-2 focus-visible:ring-(--v3-accent)"
          >
            <span className="block overflow-hidden rounded-[4px] border border-(--v3-border)">
              <LayoutArt master={art.master} target={art.target} prompts="thumb" omit={art.omit} shapes={art.shapes} override={art.override} boxes={art.boxes} name={name} />
            </span>
            <span className="text-center text-[12px] leading-4">
              <span className="font-medium text-(--v3-text)">{name}</span>
              <span className="text-(--v3-text-2)"> · {pages.length ? `${pages.length} 页` : "未使用"}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ 加载与失败（§3.3.11） */

function Loading() {
  return (
    <div role="status" aria-label="正在加载母版与版式…" className="flex items-center justify-center">
      <LoaderCircle size={24} strokeWidth={1.5} aria-hidden="true" className="text-(--v3-text-2) motion-safe:animate-spin" />
    </div>
  )
}

function Failed() {
  return (
    <div role="alert" className="flex max-w-[360px] flex-col items-center gap-3 text-center">
      <CircleAlert size={24} strokeWidth={1.5} aria-hidden="true" className="text-(--v3-danger)" />
      <div className="flex flex-col gap-1">
        <p className="text-[13px] leading-4 font-semibold text-(--v3-text)">母版信息加载失败</p>
        <p className="text-[12px] leading-[18px] text-(--v3-text-2)">可以重试；也可以关闭母版视图，回到普通视图继续编辑页面。</p>
      </div>
      {/* 全页只此一个「重试」，次按钮（DS-53 的统一画法；窗格那一行不放） */}
      <Button variant="secondary">重试</Button>
    </div>
  )
}

/* ------------------------------------------------------------------ 画布 */

/** 提交之后要聚焦的锚点（mv-state 的 focusAfter 写进场景仓）：在布局阶段交过去，焦点不经过 body */
function useFocusRequest() {
  const [req] = useSceneState<{ anchor: string | null; n: number } | null>(MV_KEYS.focus, null)
  useLayoutEffect(() => {
    if (!req) return
    const el = (req.anchor ? document.querySelector<HTMLElement>(`[data-v3-anchor="${CSS.escape(req.anchor)}"]`) : null) ?? document.querySelector<HTMLElement>('[data-v3-anchor="stage"]')
    el?.focus({ preventScroll: true })
  }, [req?.n])
}

export function MasterStage() {
  const mv = useMasterView()
  useFocusRequest()
  /** 读屏播报：Enter 或双击进不了提示文本编辑时的原因（先清空、下一帧再写，同一句也会再念；同 kit 命令面板「不可用的命令只播报原因」），播报区在画布外框里 */
  const [say, setSay] = useState("")
  const announce = (why: string) => {
    setSay("")
    requestAnimationFrame(() => setSay(why))
  }
  let body: ReactNode
  if (mv.status === "loading") body = <Loading />
  else if (mv.status === "failed") body = <Failed />
  else if (mv.multiLayouts.length > 1) body = <MultiGrid mv={mv} />
  else body = <SlideCanvas mv={mv} announce={announce} />
  const plain = mv.status === "ready" && mv.multiLayouts.length < 2
  /**
   * Enter（2026-10-30 总编排裁定第 5 条；快捷键表「编辑文字 Enter」，键盘可达）：焦点在画布外框或所选占位符自己的点选区上、选中的恰好是一个占位符时——
   *   可编辑 → 进入提示文本编辑，插入符落在文本末尾（levelAtEnd），级别跟随照双击的同一套（startText → 检查器「级别」与各字段跟着换）；
   *   不可编辑（M2、降权、继承项）→ 不进入，startText 交回原因（field 一条，双击也用它），只播报这一句，不另造句子；
   *   已在编辑提示文本 → Enter 归文本编辑（分段），不再进入，也不经点选区的点按把插入符挪走（样张没有文字模型，画面不变）。
   * 焦点在别的占位符点选区上时照旧是点按它（选中它，再按一次才编辑）；焦点在窗格、检查器、工具条里的按键不经过这里（不在画布外框之内），行为不变。
   * Esc 退出编辑回到选中走宿主的 Esc 链（master-impl onEscape）
   */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || !plain) return
    const sel = mv.selectedPh
    if (!sel) return
    const t = e.target as HTMLElement
    if (t !== e.currentTarget && t.getAttribute("data-v3-anchor") !== `master-view.ph-${sel.id}`) return
    e.preventDefault()
    if (mv.caret) return
    const why = mv.startText(sel.id, levelAtEnd(sel.id))
    if (why) announce(why)
  }
  return (
    <>
      {/* 与 editor/Stage.tsx 同一组类（尺寸规则同普通视图）；tabIndex −1：宿主「交给画布」、窗格 Enter / Esc 的落点（不进 Tab 顺序，不画焦点环） */}
      <div
        data-v3-anchor="stage"
        tabIndex={-1}
        role="group"
        aria-label="画布"
        className="relative flex min-h-0 flex-1 items-center justify-center px-12 pt-10 pb-6 outline-none [container-type:size]"
        onClick={() => {
          // 点空白处取消选中（同普通视图点画布空白）
          if (!plain) return
          if (mv.caret) mv.exitText()
          if (mv.selectedPh) mv.selectPh(null)
          else if (mv.selectedShape) mv.selectShape(null)
        }}
        onKeyDown={onKeyDown}
      >
        {body}
        {/* 播报区只写 role（隐含礼貌播报，同 kit 轻提示），不另写 aria-live 属性：Radix 菜单、对话框打开时隐藏其余内容的那一步会把带这个属性的元素连同祖先整串留下，
            母版视图里开着菜单或对话框时的整页隐藏标记就与改前不同了 */}
        {plain && (
          <span role="status" className="sr-only">
            {say}
          </span>
        )}
      </div>
      <NotesSpacer />
    </>
  )
}
