import type { ComponentType, ReactNode } from "react"
import type { DeckSlide } from "../deck"

/**
 * 检查器分区注册表：样张里的 `ui.inspectorSection` 贡献点（rulings §4.25 DS-5）。
 * 检查器只管当前选中对象的属性（DS-1）：按选中对象种类（selectionKind）取出注册的分区，按 order 排序后渲染。
 * 内置的幻灯片 / 形状 / 文本三种选中态也走这里（editor/inspector/builtin.tsx）；场景在自己的文件里注册新种类的分区，不改共享代码。
 */

/**
 * 选中对象种类。取值以前端 50/10 §5 的 selectionKind 为准（形状在样张里沿用 "shape"，即 50/10 的 shapes）；
 * 母版视图的 layout / master 对应 50/10 的 editTargetKind。也可以用自定义字符串（场景私有的种类请加场景前缀，如 "_kit-controls"）。
 */
export type KnownSelectionKind =
  | "none"
  | "shape"
  | "text"
  | "picture"
  | "media"
  | "table"
  | "table-cell"
  | "chart"
  | "placeholder-empty"
  | "group"
  | "connector"
  | "degraded"
  | "mixed"
  | "layout"
  | "master"
export type SelectionKind = KnownSelectionKind | (string & {})

/** 分区组件拿到的上下文。 */
export interface InspectorCtx {
  /** 当前选中种类 */
  selection: SelectionKind
  /** 当前页 */
  slide: DeckSlide
  /**
   * 只读（评审 / 浏览模式，EditorConfig.inspector.readOnly）：本来就不能改——分区只写当前值，不画可操作的字段外形（内置「幻灯片」各节即如此）
   */
  readOnly: boolean
  /**
   * 暂不可用的原因（打开中、编辑权限被降级，EditorConfig.inspector.disabled / locked）：字段留在原位、aria-disabled、工具提示写原因（与 readOnly 不同：结构照常，只是现在不能用）
   */
  disabled?: string
  /** 状态私有数据（EditorConfig.data） */
  data: Record<string, unknown>
}

export interface InspectorSectionDef {
  /** 分区 id：<场景或种类>.<分区>，如 "table.cell-fill"；同 id 后注册的覆盖先注册的 */
  id: string
  /** 适用的选中种类 */
  kinds: readonly SelectionKind[]
  /** 排序：小的在上。内置分区按 10、20、30… 编号，留出插入空位 */
  order: number
  /** top：画在面板标题上方（如形状的对齐行）；缺省 body，画在标题下方 */
  placement?: "top" | "body"
  /** 分区组件：返回一个或几个 <Section>（ui.tsx），可以用 hooks。不要再包一层 div：节与节之间的分隔线靠 Section 的 last: 规则 */
  component: ComponentType<InspectorCtx>
}

export interface InspectorPanelDef {
  kind: SelectionKind
  /** 面板标题（13px 600，PanelTitle）：选中对象的名称，如「矩形」「表格」「单元格」 */
  title: ReactNode | ((ctx: InspectorCtx) => ReactNode)
}

const SECTIONS = new Map<string, InspectorSectionDef>()
const PANELS = new Map<string, InspectorPanelDef>()

/** 注册一个检查器分区（模块顶层调用即可；场景文件被自动发现时就会注册）。 */
export function inspectorSection(def: InspectorSectionDef): InspectorSectionDef {
  SECTIONS.set(def.id, def)
  return def
}

/** 一次注册多个分区。 */
export function inspectorSections(defs: InspectorSectionDef[]): InspectorSectionDef[] {
  for (const d of defs) inspectorSection(d)
  return defs
}

/** 注册某个选中种类的面板标题。 */
export function inspectorPanel(def: InspectorPanelDef): InspectorPanelDef {
  PANELS.set(def.kind, def)
  return def
}

export function getInspectorSection(id: string): InspectorSectionDef | undefined {
  return SECTIONS.get(id)
}

/** 某个选中种类的全部分区，按 order（同 order 按 id）排好。 */
export function sectionsFor(kind: SelectionKind): InspectorSectionDef[] {
  return [...SECTIONS.values()].filter((d) => d.kinds.includes(kind)).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

/** 某个选中种类注册的面板标题；没注册时返回 undefined。 */
export function panelTitleFor(kind: SelectionKind, ctx: InspectorCtx): ReactNode | undefined {
  const p = PANELS.get(kind)
  if (!p) return undefined
  return typeof p.title === "function" ? p.title(ctx) : p.title
}

/** 调试用：当前注册的全部分区 id 与种类。 */
export function listInspectorSections(): { id: string; kinds: readonly SelectionKind[]; order: number }[] {
  return [...SECTIONS.values()].map(({ id, kinds, order }) => ({ id, kinds, order }))
}
