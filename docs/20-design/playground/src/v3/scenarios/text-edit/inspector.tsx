import type { ReactNode } from "react"
import { GeometrySection, inspectorPanel, inspectorSections, layoutOfSlide, len, placeholdersFor, Section, StaticRow, type DeckSlide, type InspectorCtx } from "../../kit"
import type { MasterDef } from "../masters-themes/data"
import { typeNameOf } from "../masters-themes/mv-state"

/**
 * 03-16 检查器里本场景负责的部分：空内容占位符（placeholder-empty，R-d-72），其他场景直接设 selection 复用。
 * v3 只留属性两组（占位符、位置与大小）：「插入到占位符」是插入命令、不是属性（DS-1），且与画布图标条、工具条创建工具重复（Q2），不进检查器（DS-14）。
 * 「文本」五个分区（字体 / 段落 / 颜色 / 列表 / 文本框）已并入底座的内置 text 选中态（editor/inspector/text.tsx），本场景只用 data.text 给值。
 */


/* ------------------------------------------------------------------ 空内容占位符（placeholder-empty） */

export interface PlaceholderData {
  /** 面板标题，如「内容占位符」「图片占位符」 */
  title: string
  type: string
  idx: number
  layout: string
  /** 位置与大小（pt）：当前值 */
  geo: { x: number; y: number; w: number; h: number }
  /** 在本页改过的字段与它们的版式值 */
  layoutValues?: Partial<Record<"x" | "y" | "w" | "h", number>>
}

const PH_DEFAULT: PlaceholderData = { title: "内容占位符", type: "内容", idx: 1, layout: "内容与图片", geo: { x: 60, y: 124, w: 540, h: 360 } }
const phOf = (ctx: InspectorCtx): PlaceholderData => ({ ...PH_DEFAULT, ...(ctx.data.placeholder as Partial<PlaceholderData> | undefined) })

/** 选中的文本框来自本页版式的哪个占位符（检查器顶行「转到版式」读的 data.placeholder；文本类只有这三项，没有面板标题与几何） */
export type PlaceholderOrigin = Partial<Pick<PlaceholderData, "type" | "idx">> & Pick<PlaceholderData, "layout">

/**
 * 「转到版式」的输入（rulings §4.25 DS-174：选中来自版式占位符的标题、文本框时，检查器顶行写它继承自哪个版式）：
 * 状态只写「选中的是哪一页、版式上的哪个占位符」（占位符 id，如 title、body），版式名、类型的产品名与索引都由这页的版式与 placeholdersFor 算出，不另写——
 * 与 master-view.goto-layout 的检查器数据同一个算法。phId 不给（同时选中同一版式的几个占位符）时只写版式。
 * masters：这一页所在文档的母版（场景自带母版时传它，同状态的 data.mvMasters；不给是示例文档的母版），版式按它认（layoutOfSlide）。
 * 版式上没有这个占位符时返回 undefined：数据写错了，检查器顶行就不画，不拿别的占位符顶替
 */
export function placeholderOrigin(slide: Pick<DeckSlide, "n" | "layout">, phId?: string, masters?: readonly MasterDef[]): PlaceholderOrigin | undefined {
  const layout = layoutOfSlide(slide, masters)
  if (!phId) return { layout: layout.name }
  const ph = placeholdersFor(layout.master, layout.kind).find((p) => p.id === phId)
  return ph ? { type: typeNameOf(ph), idx: ph.idx, layout: layout.name } : undefined
}

/**
 * 占位符的身份（类型、索引、来源）是只看的属性：编辑与只读都用只读行（StaticRow，64px 标签列 + 值左对齐，与「位置与大小」等其他只读行同一画法）。
 * 类型写产品化名称（「内容」），不露 OOXML 的 obj / pic 等内部标识。
 */
function PlaceholderInfoSection(ctx: InspectorCtx) {
  const d = phOf(ctx)
  return (
    <Section title="占位符" anchor="section-text-edit.placeholder" bodyClassName="gap-0">
      <StaticRow label="类型">{d.type}</StaticRow>
      <StaticRow label="索引">
        <span className="tabular-nums">{d.idx}</span>
      </StaticRow>
      <StaticRow label="来自">
        <span className="whitespace-nowrap">版式「{d.layout}」</span>
      </StaticRow>
    </Section>
  )
}

/** 位置与大小：底座共用的几何分区；在本页改过的字段带「重置为版式值」（逐项继承，03-16），节末说明继承关系 */
function PlaceholderGeometrySection(ctx: InspectorCtx) {
  const d = phOf(ctx)
  const lv = d.layoutValues ?? {}
  const LETTER = { x: "X", y: "Y", w: "W", h: "H" } as const
  const changed = (Object.keys(lv) as ("x" | "y" | "w" | "h")[]).filter((k) => lv[k] !== undefined)
  const note: ReactNode = ctx.readOnly ? (
    <span className="whitespace-nowrap">继承自版式「{d.layout}」</span>
  ) : changed.length ? (
    <>
      {changed.map((k) => `${LETTER[k]} 在本页改过（版式值 ${len(lv[k]!)}）`).join("；")}，<span className="whitespace-nowrap">其余继承自版式</span>
    </>
  ) : (
    <>
      <span className="whitespace-nowrap">继承自版式「{d.layout}」</span>；<span className="whitespace-nowrap">移动或缩放后可逐项重置</span>
    </>
  )
  return (
    <GeometrySection
      anchor="section-text-edit.placeholder-geometry"
      readOnly={ctx.readOnly}
      value={d.geo}
      overrides={lv}
      overrideFrom="版式"
      note={note}
    />
  )
}

inspectorPanel({ kind: "placeholder-empty", title: (ctx) => phOf(ctx).title })
inspectorSections([
  { id: "text-edit.placeholder", kinds: ["placeholder-empty"], order: 10, component: PlaceholderInfoSection },
  { id: "text-edit.placeholder-geometry", kinds: ["placeholder-empty"], order: 20, component: PlaceholderGeometrySection },
])
