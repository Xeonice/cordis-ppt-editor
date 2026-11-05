import { useState, type ReactNode } from "react"
import { ChevronDown, ExternalLink, Info, Maximize2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Button, CheckRow, Cols, FoldSection, ICON, inspectorPanel, inspectorSections, NumberField, Section, SelectTrigger, StaticRow, Tag, TextArea, TextField, Tip, V3Menu,
  type InspectorCtx, GeometrySection } from "../../kit"
import { DataGrid } from "./DataGrid"
import { Phrases } from "./Phrases"
import {
  CONTENT_BOX, familyOf, findSubtype, isTruncated, LEFT_BOX, LEGEND_LABEL, LEGEND_ORDER, P2_REASON, PIE_NOTE, pt, COMPACT, type ChartOptions, type LegendPos, type PieLabels,
} from "./model"
import { useChart, type ChartModel } from "./store"

/**
 * 检查器分区：选中种类 chart（03-31「检查器（selectionKind: chart）」；50/10 §5、50/24 §3.7），由本场景注册。
 *   可编辑五类：chart.type 10 · chart.elements 20 · chart.data 30 · chart.position 40 · chart.alt 50 · chart.axes 60（P2，不可展开）
 *   只读类型（非五类）：chart.readonly 5 · chart.position · chart.alt
 *   M2 选中导入的图表：chart.m2 6（只读的「类型」节，标题挂 M3）· chart.position · chart.alt
 * v3 的取舍（DS-1 检查器只管当前选中对象的属性、Q2 入口唯一）：
 * - 原规格迷你工具条的「更改类型 ▾」并入「类型」字段（迷你工具条已随 rulings §4.25 DS-22 取消）：字段本身就是下拉，打开与工具条「图表」同一个 ChartTypeMenu（高亮当前子类型），
 *   所以不再另画六个类别按钮与子类型缩略图；会丢弃导入内容时确认段出现在下拉底部（两种确认形态合为一种，TB-11）。
 * - 原规格迷你工具条的「编辑数据」并入「数据」分区的「展开」（打开 400 宽的数据面板，DS-26）。
 * - 标题 / 图例 / 数据标签三个开关用复选（kit 没有开关控件），合成一节「图表元素」；图表里的文字格式只在检查器（DS-13）。
 * - 评审 / 查看（DS-15）：只读展示当前值，不画禁用控件；顶部一行权限说明由编辑器按模式加上。
 * - M3 起分区标题不挂 M3 标记（与表格场景一致，标记只用于还没开放的入口）。
 */

const LEGEND_ITEMS = LEGEND_ORDER.map((p) => ({ value: p, label: LEGEND_LABEL[p] }))

/** 只读的一行：左标签（text-2）+ 右当前值（可换行），DS-15 */
function RoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-7 grid-cols-[64px_1fr] items-start gap-2 py-[5px] text-[12px] leading-[18px]">
      <span className="text-(--v3-text-2)">{label}</span>
      <span className="min-w-0 text-(--v3-text)">{children}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ 可受控的折叠分区（外观同 kit FoldSection） */

function Fold({ title, open, onToggle, anchor, children, bodyClassName }: { title: string; open: boolean; onToggle: () => void; anchor?: string; children: ReactNode; bodyClassName?: string }) {
  return (
    <section data-v3-anchor={anchor} className="border-b border-(--v3-border) px-4 py-3 last:border-b-0">
      <h3 className="-mx-1.5 -my-1">
        <button type="button" aria-expanded={open} onClick={onToggle} className="flex h-6 w-full items-center gap-1.5 rounded-[4px] px-1.5 text-left transition-colors hover:bg-(--v3-panel-2)">
          <span className="text-[12px] leading-4 font-semibold text-(--v3-text)">{title}</span>
          <ChevronDown size={12} strokeWidth={1.5} aria-hidden="true" className={cn("ml-auto shrink-0 text-(--v3-text-2) transition-transform", !open && "-rotate-90")} />
        </button>
      </h3>
      {open && <div className={cn("mt-2 flex flex-col gap-2", bodyClassName)}>{children}</div>}
    </section>
  )
}

/* ------------------------------------------------------------------ 类型 */

function TypeSection({ readOnly }: InspectorCtx) {
  const [m, set] = useChart()
  if (m.page !== "chart") return null
  const st = findSubtype(m.spec)
  const { Icon } = familyOf(m.spec.kind)
  return (
    <Section title="类型" anchor="section-chart.type">
      {readOnly ? (
        <StaticRow leading={<Icon {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />}>{st.name}</StaticRow>
      ) : (
        <SelectTrigger
          data-v3-anchor="chart.type-field"
          aria-label={`图表类型：${st.name}`}
          aria-haspopup="menu"
          aria-expanded={m.typeMenu}
          onClick={() => set({ typeMenu: !m.typeMenu, pending: null, typeFlyout: null })}
        >
          <Icon {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />
          <span className="truncate">{st.name}</span>
        </SelectTrigger>
      )}
    </Section>
  )
}

/* ------------------------------------------------------------------ 图表元素：标题、图例、数据标签 */

function legendText(o: ChartOptions) {
  return o.legend === "none" ? "不显示" : LEGEND_LABEL[o.legend]
}

function labelsText(m: ChartModel) {
  const o = m.options
  if (!o.dataLabels) return "不显示"
  if (m.spec.kind !== "pie") return "显示数值"
  const parts = [o.pieLabels.percent && "百分比", o.pieLabels.category && "类别名", o.pieLabels.value && "值"].filter(Boolean)
  return parts.length ? parts.join("、") : "显示"
}

function ElementsSection({ readOnly }: InspectorCtx) {
  const [m, set] = useChart()
  if (m.page !== "chart") return null
  const o = m.options
  const setOpt = (p: Partial<ChartOptions>) => set({ options: { ...o, ...p } })
  const pie = m.spec.kind === "pie"
  if (readOnly)
    return (
      <Section title="图表元素" anchor="section-chart.elements" bodyClassName="gap-0">
        <RoRow label="标题">{o.title ? o.titleText : "不显示"}</RoRow>
        <RoRow label="图例">{legendText(o)}</RoRow>
        <RoRow label="数据标签">{labelsText(m)}</RoRow>
      </Section>
    )
  const pos: LegendPos = o.legend === "none" ? "bottom" : o.legend
  const legendTrigger = (
    <SelectTrigger aria-label={o.legend === "none" ? "图例位置（先勾选「图例」）" : "图例位置"} aria-disabled={o.legend === "none" || undefined} className="w-[104px]">
      <span className="truncate">{LEGEND_LABEL[pos]}</span>
    </SelectTrigger>
  )
  const setPie = (k: keyof PieLabels, v: boolean) => setOpt({ pieLabels: { ...o.pieLabels, [k]: v } })
  return (
    <Section title="图表元素" anchor="section-chart.elements">
      <CheckRow label="标题" checked={o.title} onCheckedChange={(v) => setOpt({ title: v })} />
      <TextField aria="标题文字" value={o.titleText} onChange={(t) => setOpt({ titleText: t })} disabled={!o.title} reason="先勾选「标题」" className="-mt-1" />
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <CheckRow label="图例" checked={o.legend !== "none"} onCheckedChange={(v) => setOpt({ legend: v ? "bottom" : "none" })} />
        </div>
        {o.legend === "none" ? (
          <Tip label="先勾选「图例」">{legendTrigger}</Tip>
        ) : (
          <V3Menu value={pos} onValueChange={(v) => setOpt({ legend: v as LegendPos })} align="end" entries={LEGEND_ITEMS} trigger={legendTrigger} />
        )}
      </div>
      <CheckRow label="数据标签" checked={o.dataLabels} onCheckedChange={(v) => setOpt({ dataLabels: v })} />
      {pie && o.dataLabels && (
        <div role="group" aria-label="数据标签内容" className="-mt-1 grid grid-cols-3 gap-x-2 pl-6">
          <CheckRow label="百分比" checked={o.pieLabels.percent} onCheckedChange={(v) => setPie("percent", v)} />
          <CheckRow label="类别名" checked={o.pieLabels.category} onCheckedChange={(v) => setPie("category", v)} />
          <CheckRow label="值" checked={o.pieLabels.value} onCheckedChange={(v) => setPie("value", v)} />
        </div>
      )}
    </Section>
  )
}

/* ------------------------------------------------------------------ 数据：紧凑网格 */

/**
 * 网格说明：截断时写总规模，饼图写只画第一个系列；每段整体不折行，窄栏里只在「·」处换行。
 * 数据面板里饼图另有一整句说明（PIE_NOTE_PARTS），这里就不再接短句。
 */
export function gridNote(m: ChartModel, compact: boolean): ReactNode {
  const d = m.data
  const parts: string[] = compact && isTruncated(d) ? [`共 ${d.categories.length} 类别 × ${d.series.length} 系列`, `此处显示前 ${COMPACT.rows} × ${COMPACT.cols}`] : ["行 = 类别", "列 = 系列"]
  if (compact && m.spec.kind === "pie" && d.series.length > 1) parts.push(PIE_NOTE)
  return parts.map((t, i) => (
    <span key={t}>
      {i > 0 && " · "}
      <span className="whitespace-nowrap">{t}</span>
    </span>
  ))
}

/**
 * 原工作簿提示（50/24 §3.10）：导入且带内嵌工作簿的图表首次编辑数据前出现；首次提交或「知道了」后不再出（与数据面板共用一个状态）。
 * 文字占满一行宽、「知道了」另起一行靠右（与文字同排会把一句话挤成三四行）；检查器与数据面板同一画法。
 * 分段让括号跟着前面的词走：行首不出现「（」（全角开括号在行首会显得缩进）。
 */
export function WorkbookNotice() {
  const [, set] = useChart()
  return (
    <div role="status" className="flex flex-col gap-1 rounded-[4px] bg-(--v3-panel-2) px-2.5 pt-2 pb-1 text-[12px] leading-[18px] text-(--v3-text)">
      <p className="flex min-w-0 items-start gap-2">
        <Info {...ICON} aria-hidden="true" className="mt-px shrink-0 text-(--v3-text-2)" />
        <span className="min-w-0">
          <Phrases parts={["原工作簿里数据区之外的", "内容（其它工作表、公式）", "在编辑数据后不保留。"]} />
        </span>
      </p>
      <Button variant="ghost" className="-mr-1 shrink-0 self-end px-2" onClick={() => set({ notice: false })}>
        知道了
      </Button>
    </div>
  )
}

function DataSection({ readOnly }: InspectorCtx) {
  const [m, set] = useChart()
  if (m.page !== "chart") return null
  return (
    <Fold title="数据" open={m.dataOpen} onToggle={() => set({ dataOpen: !m.dataOpen })} anchor="section-chart.data">
      {m.notice && !readOnly && <WorkbookNotice />}
      <DataGrid compact readOnly={readOnly} />
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 py-[5px] text-[12px] leading-[18px] text-(--v3-text-2)">{gridNote(m, true)}</p>
        {!readOnly && (
          <Button variant="secondary" className="shrink-0 gap-1 px-2" onClick={() => set({ panel: true })}>
            <Maximize2 size={14} strokeWidth={1.5} aria-hidden="true" />
            展开
          </Button>
        )}
      </div>
    </Fold>
  )
}

/* ------------------------------------------------------------------ 位置与大小、替代文本 */

/** 位置与大小：底座共用的几何分区（与形状、图片、表格同一套字段、单位与展开状态）；图表不旋转、不翻转 */
function PositionSection({ readOnly }: InspectorCtx) {
  const [m] = useChart()
  const b = m.page === "m2" ? LEFT_BOX : CONTENT_BOX
  return (
    <GeometrySection
      anchor="section-chart.position"
      readOnly={readOnly}
      value={{ x: pt(b.x), y: pt(b.y), w: pt(b.w), h: pt(b.h) }}
      rotate={false}
      note="图表不旋转、不翻转"
    />
  )
}

function AltSection({ readOnly }: InspectorCtx) {
  const [m, set] = useChart()
  const [title, setTitle] = useState(m.altTitle)
  const open = m.page !== "chart"
  if (readOnly)
    return (
      <FoldSection title="替代文本" defaultOpen={open} anchor="section-chart.alt" bodyClassName="gap-0">
        <RoRow label="标题">{m.altTitle || <span className="text-(--v3-text-2)">未填写</span>}</RoRow>
        <RoRow label="描述">{m.altDesc || <span className="text-(--v3-text-2)">未填写</span>}</RoRow>
      </FoldSection>
    )
  return (
    <FoldSection title="替代文本" defaultOpen={open} anchor="section-chart.alt">
      <TextField
        aria="替代文本标题"
        placeholder="例如：各区域季度销售"
        value={title}
        onChange={(t) => {
          setTitle(t)
          set({ altTitle: t })
        }}
      />
      <TextArea aria="替代文本描述" placeholder="描述：图表要传达的要点" defaultValue={m.altDesc} rows={2} />
      {!m.altTitle && !m.altDesc && <p className="text-[12px] leading-[18px] text-(--v3-warning)">缺少替代文本：读屏用户无法了解图表内容</p>}
    </FoldSection>
  )
}

/* ------------------------------------------------------------------ 坐标轴与格式（P2，不可展开） */

function AxesSection({ readOnly }: InspectorCtx) {
  const [m] = useChart()
  if (m.page !== "chart" || readOnly) return null
  return (
    <section data-v3-anchor="section-chart.axes" className="border-b border-(--v3-border) px-4 py-3 last:border-b-0">
      <h3 className="-mx-1.5 -my-1">
        <Tip label={P2_REASON} lines={["坐标轴范围、数字格式、趋势线与误差线", "排在后续版本（P2）；", "导入文件里已有的设置原样保留。"]} side="left">
          <button type="button" aria-disabled="true" aria-expanded={false} aria-label="坐标轴与格式（P2）" className="flex h-6 w-full cursor-default items-center gap-1.5 rounded-[4px] px-1.5 text-left">
            <span className="text-[12px] leading-4 font-semibold text-(--v3-text-3)">坐标轴与格式</span>
            <Tag>P2</Tag>
            <ChevronDown size={12} strokeWidth={1.5} aria-hidden="true" className="ml-auto shrink-0 -rotate-90 text-(--v3-text-3)" />
          </button>
        </Tip>
      </h3>
    </section>
  )
}

/* ------------------------------------------------------------------ 只读类型（非五类）与 M2 */

function ReadonlyTypeSection(_: InspectorCtx) {
  const [m, set] = useChart()
  if (m.page !== "radar") return null
  return (
    <Section anchor="section-chart.readonly">
      <h3 className="flex items-center gap-1.5 text-[12px] leading-4 font-semibold text-(--v3-text)">
        <Info {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />
        此类型仅支持查看
      </h3>
      <p className="text-[12px] leading-[18px] text-(--v3-text-2)">
        <Phrases parts={["雷达图不在可编辑的五类（柱形 / 条形、", "折线、饼、", "面积、散点）里。", "可以移动、缩放、", "复制和删除；", "数据与格式按原样导出。"]} />
      </p>
      <Button variant="secondary" className="self-start" onClick={() => set({ toast: { title: "已打开保真报告 · 图表分组", tone: "info" } })}>
        <ExternalLink size={14} strokeWidth={1.5} aria-hidden="true" />
        保真详情
      </Button>
    </Section>
  )
}

/**
 * M2 选中导入的图表（03-31「未开放」、50/10 §5）：与可编辑时的「类型」节同一位置，只读显示类型与系列数（面板标题已是「图表」，节名不再重复），
 * 标题挂 M3（数据与格式编辑在 M3 开放），下面一行说明现在能做什么。
 */
function M2Section(_: InspectorCtx) {
  const [m] = useChart()
  if (m.page !== "m2") return null
  const { Icon } = familyOf(m.spec.kind)
  return (
    <Section title="类型" tag="M3" anchor="section-chart.m2" bodyClassName="gap-1">
      <StaticRow leading={<Icon {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />}>
        {findSubtype(m.spec).name} · {m.data.series.length} 个系列
      </StaticRow>
      <p className="flex items-start gap-1.5 text-[12px] leading-[18px] text-(--v3-text-2)">
        <Info {...ICON} aria-hidden="true" className="mt-px shrink-0" />
        <span className="min-w-0">
          <Phrases parts={["数据编辑 M3 提供；", "现在可以移动、", "缩放、复制、删除", "和改替代文本"]} />
        </span>
      </p>
    </Section>
  )
}

/* ------------------------------------------------------------------ 面板标题与注册 */

function PanelTitleText() {
  const [m] = useChart()
  const detail = m.page === "radar" ? "雷达图 · 仅支持查看" : m.page === "m2" ? `导入的${findSubtype(m.spec).name}` : `${m.data.categories.length} 类别 × ${m.data.series.length} 系列`
  return (
    <>
      图表
      <span className="ml-2 text-[12px] font-normal text-(--v3-text-2)">{detail}</span>
    </>
  )
}

inspectorPanel({ kind: "chart", title: () => <PanelTitleText /> })

inspectorSections([
  { id: "chart.readonly", kinds: ["chart"], order: 5, component: ReadonlyTypeSection },
  { id: "chart.m2", kinds: ["chart"], order: 6, component: M2Section },
  { id: "chart.type", kinds: ["chart"], order: 10, component: TypeSection },
  { id: "chart.elements", kinds: ["chart"], order: 20, component: ElementsSection },
  { id: "chart.data", kinds: ["chart"], order: 30, component: DataSection },
  { id: "chart.position", kinds: ["chart"], order: 40, component: PositionSection },
  { id: "chart.alt", kinds: ["chart"], order: 50, component: AltSection },
  { id: "chart.axes", kinds: ["chart"], order: 60, component: AxesSection },
])
