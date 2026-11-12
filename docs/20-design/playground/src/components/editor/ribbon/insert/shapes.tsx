import type { ReactNode } from "react"

/**
 * 形状库首批 72 项、10 类（rulings §4.21，R-d-66）。分类顺序沿用 ED-05 验收枚举：
 * 最近使用 / 线条 / 矩形 / 基本形状 / 箭头 / 公式形状 / 流程图 / 星与旗帜 / 标注 / 动作按钮。
 * 「最近使用」是会话内的重复入口，不计入 72 项。
 *
 * 缩略图是预设几何的简化 SVG（24 × 24 视框、1.5 描边、无填充，与 Lucide 线性图标同一视觉语言），不用位图。
 * 产品实现里缩略图在构建期由 preset-table（ECMA-376 presetShapeDefinitions）按同一 presetGeometryPath 生成 SVG sprite；
 * 这里手绘的路径只用于样张。`prst` 为 OOXML 预设名；线条类另记首尾箭头，插入时落 p:cxnSp（R-d-64）。
 */
export type ShapeGroupId = "recent" | "lines" | "rects" | "basic" | "arrows" | "math" | "flow" | "stars" | "callouts" | "actions"

export interface ShapePreset {
  id: string
  prst: string
  name: string
  group: ShapeGroupId
  /** 仅线条：首尾箭头 */
  ends?: "tail" | "both"
  /** P2：禁用而不隐藏，tooltip 给原因 */
  p2?: string
  /** 动作按钮的默认动作（R-d-77） */
  defaultAction?: ActionTarget
  draw: ReactNode
}

export type ActionTarget = "none" | "next" | "prev" | "first" | "last" | "lastViewed" | "end" | "slide" | "url"

/** 动作按钮统一外框：圆角方框，内画语义图形 */
const frame = <rect x="3" y="4" width="18" height="16" rx="2" />

const P = (d: string) => <path d={d} />

type Def = Omit<ShapePreset, "group" | "id"> & { id?: string }
const defs: Record<Exclude<ShapeGroupId, "recent">, { label: string; items: Def[] }> = {
  lines: {
    label: "线条",
    items: [
      { prst: "line", name: "直线", draw: P("M4 20 20 4") },
      { id: "line-arrow", prst: "straightConnector1", ends: "tail", name: "箭头", draw: <>{P("M4 20 20 4")}{P("M12 4h8v8")}</> },
      { id: "line-arrow2", prst: "straightConnector1", ends: "both", name: "双箭头", draw: <>{P("M4 20 20 4")}{P("M12 4h8v8")}{P("M4 12v8h8")}</> },
      { prst: "bentConnector3", name: "肘形连接符", draw: P("M3 18h9V6h9") },
      { id: "bent-arrow", prst: "bentConnector3", ends: "tail", name: "肘形箭头连接符", draw: <>{P("M3 18h9V6h9")}{P("m17 2 4 4-4 4")}</> },
      { prst: "curvedConnector3", name: "曲线连接符", draw: P("M3 18c9 0 9-12 18-12") },
      { id: "curved-arrow", prst: "curvedConnector3", ends: "tail", name: "曲线箭头连接符", draw: <>{P("M3 18c9 0 9-12 18-12")}{P("m17 2 4 4-4 4")}</> },
      { id: "curve", prst: "custGeom", name: "曲线", p2: "绘制曲线排在后续版本（P2）", draw: P("M3 17C6 5 10 5 12 12s6 7 9-5") },
      { id: "freeform", prst: "custGeom", name: "任意多边形", p2: "绘制任意多边形排在后续版本（P2）", draw: P("M5 20 3 9l7-5 3 7 8-3-2 12Z") },
      { id: "scribble", prst: "custGeom", name: "自由曲线", p2: "绘制自由曲线排在后续版本（P2）", draw: P("M3 15c2-6 4-9 5-6s-2 9 1 8 3-10 6-9-1 9 2 8 3-5 3-5") },
    ],
  },
  rects: {
    label: "矩形",
    items: [
      { prst: "rect", name: "矩形", draw: <rect x="3" y="6" width="18" height="12" /> },
      { prst: "roundRect", name: "圆角矩形", draw: <rect x="3" y="6" width="18" height="12" rx="3.5" /> },
      { prst: "snip1Rect", name: "剪去单角的矩形", draw: P("M3 6h13l5 5v7H3Z") },
      { prst: "snip2SameRect", name: "剪去同侧角的矩形", draw: P("M8 6h8l5 5v7H3v-7Z") },
      { prst: "round2SameRect", name: "同侧圆角矩形", draw: P("M8 6h8a5 5 0 0 1 5 5v7H3v-7a5 5 0 0 1 5-5Z") },
    ],
  },
  basic: {
    label: "基本形状",
    items: [
      { prst: "ellipse", name: "椭圆", draw: <ellipse cx="12" cy="12" rx="9" ry="7" /> },
      { prst: "triangle", name: "等腰三角形", draw: P("M12 4 21 19H3Z") },
      { prst: "rtTriangle", name: "直角三角形", draw: P("M4 4v15h16Z") },
      { prst: "parallelogram", name: "平行四边形", draw: P("M8 6h13l-5 12H3Z") },
      { prst: "trapezoid", name: "梯形", draw: P("M7 6h10l4 12H3Z") },
      { prst: "diamond", name: "菱形", draw: P("M12 3 21 12 12 21 3 12Z") },
      { prst: "pentagon", name: "正五边形", draw: P("M12 3.5 20.6 9.7 17.3 19.8H6.7L3.4 9.7Z") },
      { prst: "hexagon", name: "六边形", draw: P("M7.5 5h9l4.5 7-4.5 7h-9L3 12Z") },
      { prst: "octagon", name: "八边形", draw: P("M8.5 3.5h7l5 5v7l-5 5h-7l-5-5v-7Z") },
      { prst: "can", name: "圆柱形", draw: <>{P("M4 6.5v11c0 1.66 3.58 3 8 3s8-1.34 8-3v-11")}<ellipse cx="12" cy="6.5" rx="8" ry="3" /></> },
      { prst: "cube", name: "立方体", draw: <>{P("M3 8h13v13H3Z")}{P("m3 8 5-5h13l-5 5")}{P("m16 21 5-5V3")}</> },
      { prst: "donut", name: "同心圆", draw: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /></> },
      { prst: "heart", name: "心形", draw: P("M12 20S3 14.5 3 8.8A4.8 4.8 0 0 1 12 6.5a4.8 4.8 0 0 1 9 2.3C21 14.5 12 20 12 20Z") },
      { prst: "lightningBolt", name: "闪电形", draw: P("M13 2 4 13.5h6.5L8 22l12-12.5h-6.5L16 2Z") },
    ],
  },
  arrows: {
    label: "箭头",
    items: [
      { prst: "rightArrow", name: "右箭头", draw: P("M3 9h10V5l8 7-8 7v-4H3Z") },
      { prst: "leftArrow", name: "左箭头", draw: P("M21 9H11V5l-8 7 8 7v-4h10Z") },
      { prst: "upArrow", name: "上箭头", draw: P("M9 21V11H5l7-8 7 8h-4v10Z") },
      { prst: "downArrow", name: "下箭头", draw: P("M9 3v10H5l7 8 7-8h-4V3Z") },
      { prst: "leftRightArrow", name: "左右箭头", draw: P("m2 12 5-6v3h10V6l5 6-5 6v-3H7v3Z") },
      { prst: "bentArrow", name: "直角箭头", draw: P("M4 21v-8a6 6 0 0 1 6-6h5V3l6 6-6 6v-4h-5a2 2 0 0 0-2 2v8Z") },
      { prst: "homePlate", name: "五边形箭头", draw: P("M3 6h12l6 6-6 6H3Z") },
      { prst: "chevron", name: "燕尾形", draw: P("M3 6h12l6 6-6 6H3l6-6Z") },
    ],
  },
  math: {
    label: "公式形状",
    items: [
      { prst: "mathPlus", name: "加号", draw: P("M9.5 5h5v4.5H19v5h-4.5V19h-5v-4.5H5v-5h4.5Z") },
      { prst: "mathMinus", name: "减号", draw: P("M4 9.5h16v5H4Z") },
      { prst: "mathMultiply", name: "乘号", draw: <path d="M9.5 5h5v4.5H19v5h-4.5V19h-5v-4.5H5v-5h4.5Z" transform="rotate(45 12 12)" /> },
      { prst: "mathDivide", name: "除号", draw: <>{P("M4 10h16v4H4Z")}<circle cx="12" cy="5.5" r="2" /><circle cx="12" cy="18.5" r="2" /></> },
      { prst: "mathEqual", name: "等号", draw: <>{P("M4 6.5h16v4H4Z")}{P("M4 13.5h16v4H4Z")}</> },
      { prst: "mathNotEqual", name: "不等号", draw: <>{P("M4 6.5h16v4H4Z")}{P("M4 13.5h16v4H4Z")}{P("m15.5 3-7 18")}</> },
    ],
  },
  flow: {
    label: "流程图",
    items: [
      { prst: "flowChartProcess", name: "流程图：过程", draw: <rect x="3" y="6" width="18" height="12" /> },
      { prst: "flowChartAlternateProcess", name: "流程图：可选过程", draw: <rect x="3" y="6" width="18" height="12" rx="2.5" /> },
      { prst: "flowChartDecision", name: "流程图：决策", draw: P("m12 5 9 7-9 7-9-7Z") },
      { prst: "flowChartInputOutput", name: "流程图：数据", draw: P("M7 6h14l-4 12H3Z") },
      { prst: "flowChartPredefinedProcess", name: "流程图：预定义过程", draw: <><rect x="3" y="6" width="18" height="12" />{P("M6.5 6v12M17.5 6v12")}</> },
      { prst: "flowChartDocument", name: "流程图：文档", draw: P("M3 5h18v11c-3-2-6-2-9 0s-6 2-9 0Z") },
      { prst: "flowChartTerminator", name: "流程图：终止", draw: <rect x="3" y="7" width="18" height="10" rx="5" /> },
      { prst: "flowChartConnector", name: "流程图：接点", draw: <circle cx="12" cy="12" r="7" /> },
    ],
  },
  stars: {
    label: "星与旗帜",
    items: [
      { prst: "star4", name: "四角星", draw: P("m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z") },
      { prst: "star5", name: "五角星", draw: P("M12 3.2 14.3 9.6 21.1 9.8 15.7 14 17.6 20.6 12 16.7 6.4 20.6 8.3 14 2.9 9.8 9.7 9.6Z") },
      { prst: "star6", name: "六角星", draw: P("M12 2.5 14.6 7.5 20.2 7.3 17.2 12 20.2 16.8 14.6 16.5 12 21.5 9.4 16.5 3.8 16.8 6.8 12 3.8 7.2 9.4 7.5Z") },
      { prst: "irregularSeal1", name: "爆炸形 1", draw: P("M13.2 3.5 13.3 7.7 16.1 4 15.3 9.1 20 8.3 17 10.8 21.9 13.1 16.3 13 20.5 15.6 15.5 15.2 16.4 19.9 13.2 16.2 10.9 19.9 10.8 16 7.9 19.8 8.3 15.3 3.2 16 7.7 13 3 11 7.2 10.8 3.2 8.3 8.7 9 7.8 4.5 10.7 7.7Z") },
      { prst: "wave", name: "波形", draw: P("M3 7c3-2 6-2 9 0s6 2 9 0v10c-3 2-6 2-9 0s-6-2-9 0Z") },
    ],
  },
  callouts: {
    label: "标注",
    items: [
      { prst: "wedgeRectCallout", name: "矩形标注", draw: P("M3 4h18v12H11l-4 5v-5H3Z") },
      { prst: "wedgeRoundRectCallout", name: "圆角矩形标注", draw: P("M6 4h12a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-7l-4 5v-5H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z") },
      { prst: "wedgeEllipseCallout", name: "椭圆形标注", draw: P("M8.2 15.9A9 6.5 0 1 1 10.4 16.4L6 21Z") },
      { prst: "borderCallout1", name: "线形标注", draw: <><rect x="8" y="4" width="13" height="10" />{P("M8 11 3 20")}</> },
    ],
  },
  actions: {
    label: "动作按钮",
    items: [
      { prst: "actionButtonBackPrevious", name: "动作按钮：后退或前一项", defaultAction: "prev", draw: <>{frame}{P("M14.5 8.5v7L9.5 12Z")}</> },
      { prst: "actionButtonForwardNext", name: "动作按钮：前进或下一项", defaultAction: "next", draw: <>{frame}{P("M9.5 8.5v7l5-3.5Z")}</> },
      { prst: "actionButtonBeginning", name: "动作按钮：转到开头", defaultAction: "first", draw: <>{frame}{P("M15.5 8.5v7L11 12Z")}{P("M9 8.5v7")}</> },
      { prst: "actionButtonEnd", name: "动作按钮：转到结尾", defaultAction: "last", draw: <>{frame}{P("M8.5 8.5v7L13 12Z")}{P("M15 8.5v7")}</> },
      { prst: "actionButtonHome", name: "动作按钮：转到主页", defaultAction: "first", draw: <>{frame}{P("M7.5 12.5 12 8.5l4.5 4v3.5h-9Z")}</> },
      { prst: "actionButtonInformation", name: "动作按钮：获取信息", defaultAction: "none", draw: <>{frame}<circle cx="12" cy="12" r="4" />{P("M12 11.5v2.5M12 9.8v.01")}</> },
      { prst: "actionButtonReturn", name: "动作按钮：返回", defaultAction: "lastViewed", draw: <>{frame}{P("M9 10.5h4.5a2.5 2.5 0 0 1 0 5H10")}{P("m11 8.5-2 2 2 2")}</> },
      { prst: "actionButtonMovie", name: "动作按钮：视频", defaultAction: "none", draw: <>{frame}<rect x="7" y="9.5" width="6.5" height="5" rx="1" />{P("m13.5 11.5 3.5-2v5l-3.5-2")}</> },
      { prst: "actionButtonDocument", name: "动作按钮：文档", defaultAction: "none", draw: <>{frame}{P("M9 7.5h4l2.5 2.5v6.5H9Z")}</> },
      { prst: "actionButtonSound", name: "动作按钮：声音", defaultAction: "none", draw: <>{frame}{P("M7.5 10.5h2l3-2.5v8l-3-2.5h-2Z")}{P("M15 10a3 3 0 0 1 0 4")}</> },
      { prst: "actionButtonHelp", name: "动作按钮：帮助", defaultAction: "none", draw: <>{frame}{P("M10 10a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.4")}{P("M12 15.6v.01")}</> },
      { prst: "actionButtonBlank", name: "动作按钮：空白", defaultAction: "none", draw: frame },
    ],
  },
}

export const shapeGroups: { id: ShapeGroupId; label: string; items: ShapePreset[] }[] = (Object.keys(defs) as Exclude<ShapeGroupId, "recent">[]).map((g) => ({
  id: g,
  label: defs[g].label,
  items: defs[g].items.map((d) => ({ ...d, id: d.id ?? d.prst, group: g })),
}))

export const allShapes: ShapePreset[] = shapeGroups.flatMap((g) => g.items)

const byId = (id: string) => allShapes.find((s) => s.id === id)!

/** 最近使用：会话记忆（不写入文档），样张给出一组常见项 */
export const recentShapes: ShapePreset[] = ["rect", "roundRect", "ellipse", "rightArrow", "line-arrow", "wedgeRoundRectCallout", "star5"].map(byId)

export function findShape(id: string) {
  return allShapes.find((s) => s.id === id)
}

/** 预设几何缩略图：24 视框、描边随 currentColor */
export function ShapeThumb({ shape, className }: { shape: ShapePreset; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "size-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shape.draw}
    </svg>
  )
}
