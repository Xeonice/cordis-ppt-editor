import { useEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, ExternalLink, Info, Maximize2, Minimize2, Table2, X } from "lucide-react"
import { toast } from "sonner"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AppBar, CanvasElementBox, DesignBar, EditorShell, Inspector, MiniToolbar, NumberField, PropertyRow, PropertyRowPair, SelectionBox, SlideCanvas,
  StatusBar, StatusText, ThumbnailRail, type Box,
} from "@/components/editor"
import { EditorRibbon, MilestoneTag, ReadonlyRibbonNotice, RibbonTrailing, type InsertPanel, type RibbonTabValue } from "@/components/editor/Ribbon"
import { ChartDataGrid, COMPACT_LIMIT, GRID_PIE_NOTE, isCompactTruncated, type GridCellRef, type GridMenuDemo } from "@/components/editor/elements/ChartDataGrid"
import { ChartTypeMenu, ChartTypeSwitchConfirm } from "@/components/editor/elements/ChartTypeMenu"
import {
  ACCENTS, CHART_DISABLED_REASON, chartFamilies, defaultChartOptions, defaultPieLabels, findSubtype, sampleData,
  type ChartData, type ChartKind, type ChartOptions, type ChartSpec, type ChartSubtype, type LegendPos,
} from "@/components/editor/elements/chart-model"
import { DemoChart } from "@/components/editor/elements/DemoChart"
import { PLACEHOLDER_PICKER_COLLISION, PlaceholderIconBar, type PlaceholderContentKind } from "@/components/editor/elements/PlaceholderIconBar"
import { TableGridPicker } from "@/components/editor/ribbon/insert/TableGridPicker"
import { InsertTableDialog } from "@/components/editor/ribbon/insert/InsertTableDialog"
import { collaborators, documentTitle, slides } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

/**
 * 图表编辑（G-63；PRD ED-15a 插入图表 / ED-15 数据编辑；50/24 §3；ADR-0036；设计稿 docs/20-design/03-screens/31-chart-editing.md）。
 * 插入 › 图表 ▾（M3）与空内容占位符图标条 › 图表共用 ChartTypeMenu（六项 + 子类型 flyout）；有空内容占位符即填入（保留 p:ph，slide.fillPlaceholder），
 * 以示例数据插入（4 类别 × 3 系列），选中图表并展开检查器「图表」「数据」分区，焦点落在首个数值格；「展开」或迷你工具条「编辑数据」进入 440 数据面板。
 * 迷你工具条「更改类型 ▾」同一菜单、高亮当前子类型；导入的图表切换会丢弃部件内容时先确认（检查器内联确认条 / 下拉底部确认条）。
 * 非五类图表只读：双击或 Enter 给 toast「此类型仅支持查看」；M2 时「图表 ▾」与占位符图表图标禁用并给原因，选中导入的图表只读显示类型与系列数。
 */
type DemoState =
  | "inserted" | "menu" | "placeholder-chart" | "drawer" | "grid-menu" | "compact-overflow" | "workbook-notice"
  | "type-switch" | "type-menu" | "type-confirm" | "type-confirm-menu" | "options" | "pie" | "readonly-type" | "m2-disabled"

const stateOptions: { value: DemoState; label: string }[] = [
  { value: "inserted", label: "插入后 · 示例图表与数据面板" },
  { value: "menu", label: "图表 ▾ · 五类与子类型" },
  { value: "placeholder-chart", label: "占位符图标条 › 图表（M3）" },
  { value: "drawer", label: "数据网格 · 展开抽屉" },
  { value: "grid-menu", label: "数据网格 · 行列右键菜单" },
  { value: "compact-overflow", label: "紧凑网格 · 超过 8 × 4" },
  { value: "workbook-notice", label: "数据面板 · 原工作簿提示" },
  { value: "type-switch", label: "更改图表类型" },
  { value: "type-menu", label: "更改类型 ▾ · 下拉" },
  { value: "type-confirm", label: "更改类型 · 会移除导入内容" },
  { value: "type-confirm-menu", label: "更改类型 ▾ · 下拉内确认" },
  { value: "options", label: "标题 / 图例 / 数据标签" },
  { value: "pie", label: "饼图 · 百分比标签" },
  { value: "readonly-type", label: "此类型仅支持查看" },
  { value: "m2-disabled", label: "M2 · 图表 ▾ 禁用 · 选中导入图表" },
]

/** 「标题和内容」版式的正文占位符框（插入即填入） */
const CHART_BOX: Box = { x: 90, y: 116, w: 780, h: 396 }
/** M2 演示用「两栏内容」版式：左栏是导入的图表，右栏是空内容占位符 */
const M2_CHART_BOX: Box = { x: 90, y: 116, w: 380, h: 396 }
const M2_EMPTY_BOX: Box = { x: 490, y: 116, w: 380, h: 396 }

const IMPORTED_OPTIONS: ChartOptions = { title: true, titleText: "各区域季度销售（百万元）", legend: "bottom", dataLabels: false }
// 两段各自不拆（ChartTypeSwitchConfirm 用 keep-all）：窄的下拉里只在〈子类型名〉之后换行，不会拆开「移除」「趋势线」
const DROP_MESSAGE = (st: ChartSubtype) => <>切换为{st.name}<wbr />将移除坐标轴与趋势线</>
const READONLY_HINT_ID = "chart-readonly-type"

/** 导入的柱形图（带坐标轴格式、趋势线与内嵌工作簿） */
function importedData(): ChartData {
  return {
    categories: ["第一季度", "第二季度", "第三季度", "第四季度"],
    series: [
      { name: "华东", values: [4.3, 4.9, 5.6, 6.2] },
      { name: "华北", values: [3.1, 3.4, 3.2, 3.9] },
      { name: "华南", values: [2.2, 2.8, 3.3, 3.6] },
    ],
  }
}

/** 饼图演示：三个系列（饼图只画第一个，网格第二列起变淡） */
function pieData(): ChartData {
  return {
    categories: ["线上直营", "渠道分销", "大客户", "其它"],
    series: [
      { name: "本年", values: [8.2, 3.2, 1.4, 1.2] },
      { name: "去年", values: [7.1, 3.6, 1.2, 1.5] },
      { name: "前年", values: [6.4, 3.9, 1.1, 1.6] },
    ],
  }
}

/** 紧凑网格超限演示：10 类别 × 7 系列（第 7 个系列的颜色按 accent1 亮度派生） */
function wideData(): ChartData {
  const regions = ["华北", "华东", "华南", "华中", "西南", "西北", "东北"]
  const categories = Array.from({ length: 10 }, (_, i) => `${i + 1} 月`)
  return {
    categories,
    series: regions.map((name, s) => ({
      name,
      values: categories.map((_, c) => Math.round((2 + s * 0.55 + Math.sin((c + s * 1.7) / 1.6) * 0.9 + c * 0.12) * 10) / 10),
    })),
  }
}

interface Preset {
  spec: ChartSpec
  options: ChartOptions
  data: () => ChartData
  sections: string[]
  drawer?: boolean
  /** 导入的图表：部件带坐标轴格式与趋势线（切到饼图要确认），有内嵌工作簿（首次编辑数据前提示） */
  imported?: boolean
  typeMenu?: boolean
  flyout?: ChartKind
  pending?: "inspector" | "menu"
}

const column: ChartSpec = { kind: "column", variant: "clustered" }
const presets: Record<DemoState, Preset> = {
  inserted: { spec: column, options: defaultChartOptions, data: () => sampleData("column"), sections: ["chart", "data"] },
  menu: { spec: column, options: defaultChartOptions, data: () => sampleData("column"), sections: [] },
  "placeholder-chart": { spec: column, options: defaultChartOptions, data: () => sampleData("column"), sections: [] },
  drawer: {
    spec: column, options: defaultChartOptions, sections: ["chart"], drawer: true,
    // 抽屉态演示一次已提交的修改：系列 1 · 类别 2 由 2.5 改为 3.8，图表同步重绘
    data: () => { const d = sampleData("column"); d.series[0]!.values[1] = 3.8; return d },
  },
  "grid-menu": { spec: column, options: defaultChartOptions, data: () => sampleData("column"), sections: ["chart"], drawer: true },
  "compact-overflow": {
    spec: { kind: "line", variant: "markers" }, options: { title: true, titleText: "各区域月度销售（百万元）", legend: "right", dataLabels: false },
    data: wideData, sections: ["data"],
  },
  "workbook-notice": { spec: column, options: IMPORTED_OPTIONS, data: importedData, sections: ["chart"], drawer: true, imported: true },
  "type-switch": { spec: { kind: "line", variant: "markers" }, options: defaultChartOptions, data: () => sampleData("column"), sections: ["chart"] },
  "type-menu": { spec: column, options: defaultChartOptions, data: () => sampleData("column"), sections: ["chart"], typeMenu: true, flyout: "column" },
  "type-confirm": { spec: column, options: IMPORTED_OPTIONS, data: importedData, sections: ["chart"], imported: true, pending: "inspector" },
  "type-confirm-menu": { spec: column, options: IMPORTED_OPTIONS, data: importedData, sections: ["chart"], imported: true, typeMenu: true, pending: "menu" },
  options: { spec: column, options: { title: true, titleText: "各区域季度销售（百万元）", legend: "right", dataLabels: true }, data: () => sampleData("column"), sections: ["chart"] },
  pie: { spec: { kind: "pie", variant: "plain" }, options: { title: true, titleText: "渠道占比", legend: "right", dataLabels: true, pieLabels: defaultPieLabels }, data: pieData, sections: ["chart", "data"] },
  "readonly-type": { spec: column, options: defaultChartOptions, data: () => sampleData("column"), sections: [] },
  "m2-disabled": { spec: column, options: { ...IMPORTED_OPTIONS, titleText: "各区域季度销售" }, data: importedData, sections: ["chart", "position", "alt"], imported: true },
}

const pieSubtype = chartFamilies.find((f) => f.kind === "pie")!.subtypes[0]!

/** 类型切换时的数据换算（50/24 §3.8）：切到散点时类别名能解析为数值则作 X，否则 1…n；切出散点去掉 X 列；饼图保留全部系列、只画第一个 */
function convertData(d: ChartData, to: ChartKind): ChartData {
  if (to === "scatter" && !d.x) {
    return { ...d, x: d.categories.map((c, i) => (/^\s*-?\d+(\.\d+)?\s*$/.test(c) ? Number(c) : i + 1)) }
  }
  if (to !== "scatter" && d.x) return { categories: d.categories, series: d.series }
  return d
}

export function EditorChart() {
  const [demoState, setDemoStateRaw] = useState<DemoState>("inserted")
  const [role, setRole] = useState("owner")
  const [ribbonTab, setRibbonTab] = useState<RibbonTabValue>("insert")
  const [panelOverride, setPanelOverride] = useState<InsertPanel | null | undefined>(undefined)
  const [spec, setSpec] = useState<ChartSpec>(presets.inserted.spec)
  const [options, setOptions] = useState<ChartOptions>(presets.inserted.options)
  const [data, setDataRaw] = useState<ChartData>(presets.inserted.data())
  const [drawer, setDrawer] = useState(false)
  const [sections, setSections] = useState<string[]>(presets.inserted.sections)
  const [imported, setImported] = useState(false)
  /** 导入部件里还有会被「切到饼图」丢弃的内容（坐标轴格式、趋势线）；确认切换后清掉 */
  const [droppable, setDroppable] = useState(false)
  const [workbookNotice, setWorkbookNotice] = useState(false)
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)
  const [typeFlyout, setTypeFlyout] = useState<ChartKind | null>(null)
  const [pending, setPending] = useState<{ st: ChartSubtype; origin: "inspector" | "menu" } | null>(null)
  const [phMenuOpen, setPhMenuOpen] = useState(false)
  const [focusCell, setFocusCell] = useState<GridCellRef | undefined>({ r: 0, c: 0 })
  const readonlyHintAt = useRef(0)
  const currentSlide = slides[3]!
  const readOnly = role === "commenter" || role === "viewer"
  const panel = panelOverride !== undefined ? panelOverride : demoState === "menu" ? "chart" : null

  const m2 = demoState === "m2-disabled"
  const readonlyType = demoState === "readonly-type"
  const showPlaceholder = demoState === "menu" || demoState === "placeholder-chart"
  const showChart = !showPlaceholder
  const editable = showChart && !readonlyType && !m2
  // 评审 / 查看：收起数据面板，检查器只读（数据分区展开给人看数）
  const drawerShown = drawer && !readOnly && editable
  const shownSections = readOnly && drawer && !sections.includes("data") ? [...sections, "data"] : sections
  const subtype = findSubtype(spec)
  const FamilyIcon = chartFamilies.find((f) => f.kind === spec.kind)!.icon
  const chartBox = m2 ? M2_CHART_BOX : CHART_BOX

  function setData(d: ChartData) {
    setDataRaw(d)
    // 首次提交后不再提示原工作簿（50/24 §3.10）
    setWorkbookNotice(false)
  }

  function setDemoState(v: DemoState) {
    const p = presets[v]
    toast.dismiss(READONLY_HINT_ID)
    setDemoStateRaw(v)
    setPanelOverride(undefined)
    setRibbonTab("insert")
    setSpec(p.spec)
    setOptions(p.options)
    setDataRaw(p.data())
    setDrawer(!!p.drawer)
    setSections(p.sections)
    setImported(!!p.imported)
    setDroppable(!!p.imported)
    setWorkbookNotice(!!p.imported)
    setTypeMenuOpen(!!p.typeMenu)
    setTypeFlyout(p.flyout ?? null)
    setPending(p.pending ? { st: pieSubtype, origin: p.pending } : null)
    setPhMenuOpen(v === "placeholder-chart")
    setFocusCell(v === "inserted" ? { r: 0, c: 0 } : undefined)
    if (v === "readonly-type") {
      // 演示态等同一次双击：弹出一次「此类型仅支持查看」
      readonlyHintAt.current = 0
      window.setTimeout(() => showReadonlyHint(10_000), 120)
    }
  }

  /** 非五类图表双击或 Enter：toast 提示（同一对象 10 秒内不重复；sonner 的通知区是 aria-live polite） */
  function showReadonlyHint(duration?: number) {
    const now = Date.now()
    if (now - readonlyHintAt.current < 10_000) return
    readonlyHintAt.current = now
    toast("此类型仅支持查看：雷达图", {
      id: READONLY_HINT_ID,
      description: "不在可编辑的五类里；可以移动、缩放和复制，数据与格式保持原样导出。",
      action: { label: "查看保真详情", onClick: () => toast("已打开保真报告 · 图表分组（演示）") },
      duration,
    })
  }

  /** 插入后（有空内容占位符即填入，保留 p:ph；Q1 裁决）：选中图表，展开「图表」「数据」，焦点在首个数值格 */
  function afterInsert(st: ChartSubtype) {
    setDemoStateRaw("inserted")
    setPanelOverride(undefined)
    setSpec({ kind: st.kind, variant: st.variant })
    setOptions(defaultChartOptions)
    setDataRaw(sampleData(st.kind))
    setDrawer(false)
    setSections(["chart", "data"])
    setImported(false)
    setDroppable(false)
    setWorkbookNotice(false)
    setPending(null)
    setFocusCell({ r: 0, c: 0 })
    focusFirstCell()
    toast(`已插入${st.name}`, {
      description: "示例数据已写入，数据面板已打开",
      action: { label: "撤销", onClick: () => toast.success("已撤销") },
    })
  }

  function focusFirstCell() {
    window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-chart-grid="compact"] input[inputmode="decimal"]')?.focus(), 80)
  }

  /** 双击可编辑图表：只展开检查器「数据」分区，焦点到首个数值格（D-11） */
  function openDataSection() {
    if (!editable || readOnly) return
    setDrawer(false)
    setSections((s) => (s.includes("data") ? s : [...s, "data"]))
    setFocusCell({ r: 0, c: 0 })
    focusFirstCell()
  }

  function applyType(st: ChartSpec) {
    const prev = { spec, data }
    const next = { kind: st.kind, variant: st.variant }
    setSpec(next)
    setDataRaw(convertData(data, st.kind))
    setPending(null)
    toast(`已更改为${findSubtype(next).name}`, { action: { label: "撤销", onClick: () => { setSpec(prev.spec); setDataRaw(prev.data); toast.success("已撤销") } } })
  }

  /** 更改类型的统一入口：点当前项无动作；会丢弃导入部件内容时先确认（返回 false：下拉保持打开等确认） */
  function requestType(st: ChartSubtype, origin: "inspector" | "menu"): boolean {
    if (st.kind === spec.kind && st.variant === spec.variant) return true
    if (droppable && st.kind === "pie" && spec.kind !== "pie") {
      setPending({ st, origin })
      return false
    }
    applyType(st)
    return true
  }

  function confirmPending() {
    if (!pending) return
    setDroppable(false)
    applyType(pending.st)
    setTypeMenuOpen(false)
  }

  const confirmFor = (origin: "inspector" | "menu") =>
    pending && pending.origin === origin ? (
      <ChartTypeSwitchConfirm variant={origin === "menu" ? "menu" : "inline"} message={DROP_MESSAGE(pending.st)} onConfirm={confirmPending} onCancel={() => setPending(null)} />
    ) : undefined

  const statusLeft: ReactNode[] = [`第 ${currentSlide.index}/${slides.length} 页`]
  if (demoState === "inserted") statusLeft.push(`已插入${subtype.name} · 焦点在首个数值格`)
  if (demoState === "drawer" && drawerShown) statusLeft.push("数据已更新 · 图表重绘")
  if (demoState === "compact-overflow") statusLeft.push(`${data.categories.length} 类别 × ${data.series.length} 系列 · 检查器显示前 ${COMPACT_LIMIT.rows} × ${COMPACT_LIMIT.cols}`)
  if (imported && !m2) statusLeft.push(demoState === "workbook-notice" ? "导入的图表 · 含内嵌工作簿" : droppable ? "导入的簇状柱形图 · 含坐标轴格式与趋势线" : "导入的图表")
  if (readonlyType) statusLeft.push("雷达图 · 仅支持查看")
  if (m2) statusLeft.push("M2 · 导入的簇状柱形图 · 数据编辑 M3 提供")
  if (demoState === "placeholder-chart") statusLeft.push("空内容占位符 · 选择图表类型")

  const notice = workbookNotice && !readOnly ? <WorkbookNotice onDismiss={() => setWorkbookNotice(false)} /> : null

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar title="图表编辑" spec="31 · G-63 · ED-15a / ED-15" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} role={role} onRoleChange={setRole} />
      {/* 「展开」：检查器坞加宽为数据面板（440），画布相应收窄；收起回到 300 的检查器。演示里以重挂载外壳切换宽度 */}
      <EditorShell
        key={drawerShown ? "drawer" : "dock"}
        inspectorWidth={drawerShown ? 440 : 300}
        appBar={<AppBar title={documentTitle} collaborators={collaborators.filter((c) => !c.isSelf)} status={{ kind: "sync", state: "synced" }} />}
        ribbon={
          readOnly ? (
            <ReadonlyRibbonNotice trailing={<RibbonTrailing />}>评审模式下不可编辑图表</ReadonlyRibbonNotice>
          ) : (
            <EditorRibbon
              value={ribbonTab}
              onValueChange={setRibbonTab}
              currentMasterId={currentSlide.masterId}
              currentLayoutId={currentSlide.layoutId}
              insert={{
                panel,
                onPanelChange: setPanelOverride,
                chartFlyout: demoState === "menu" ? "column" : null,
                chartDisabledReason: m2 ? CHART_DISABLED_REASON : undefined,
                showChartReason: m2,
                onPickChart: afterInsert,
              }}
            />
          )
        }
        thumbnailRail={<ThumbnailRail mode="normal" slides={slides} currentSlideId={currentSlide.id} />}
        canvas={
          <SlideCanvas>
            <CanvasElementBox box={{ x: 90, y: 40, w: 780, h: 56 }} className="flex items-center text-[26px] font-semibold text-doc-ink">季度销售对比</CanvasElementBox>
            {showPlaceholder && (
              <EmptyContentPlaceholder
                box={CHART_BOX}
                enabledKinds={["table", "picture", "chart"]}
                readOnly={readOnly}
                activeKind={phMenuOpen ? "chart" : null}
                onPick={(k) => {
                  if (k === "chart") setPhMenuOpen(true)
                  else if (k === "picture") toast("选择图片文件…（选定后填入此占位符，保留占位符位置）")
                }}
              />
            )}
            {m2 && <EmptyContentPlaceholder box={M2_EMPTY_BOX} enabledKinds={["table", "picture"]} readOnly={readOnly} onPick={(k) => { if (k === "picture") toast("选择图片文件…（选定后填入此占位符，保留占位符位置）") }} />}
            {showChart && !readonlyType && (
              <ChartHitArea
                box={chartBox}
                label={`${subtype.name}：${options.title ? options.titleText : "无标题"}`}
                onActivate={editable ? openDataSection : undefined}
              >
                <DemoChart spec={spec} data={data} options={options} width={chartBox.w} height={chartBox.h} trendline={droppable ? 0 : undefined} />
              </ChartHitArea>
            )}
            {readonlyType && (
              <>
                <RadarChart />
                <ChartHitArea box={CHART_BOX} label="雷达图：团队能力评估（此类型仅支持查看）" onActivate={() => showReadonlyHint()} />
              </>
            )}
            {showChart && <SelectionBox box={chartBox} showRotate={false} handles={!readOnly} />}
            {editable && !readOnly && (
              <MiniToolbar x={chartBox.x + chartBox.w / 2} y={chartBox.y}>
                <MilestoneTag className="mx-1">M3</MilestoneTag>
                <Button variant="ghost" size="xs" className="h-6 gap-1 px-1.5 text-xs font-normal" onClick={() => setDrawer(true)}><Table2 className="size-3.5" />编辑数据</Button>
                <ChartTypeMenu
                  open={typeMenuOpen}
                  onOpenChange={(v) => { setTypeMenuOpen(v); if (!v && pending?.origin === "menu") setPending(null) }}
                  current={spec}
                  flyout={typeFlyout}
                  header={<><MilestoneTag>M3</MilestoneTag> 更改类型 · 数据与标题保留</>}
                  onPick={(st) => requestType(st, "menu")}
                  footer={confirmFor("menu")}
                  returnFocusAfterPick
                  trigger={
                    <Button variant="ghost" size="xs" className="h-6 gap-1 px-1.5 text-xs font-normal data-[state=open]:bg-accent">
                      <FamilyIcon className="size-3.5" />更改类型<ChevronDown className="size-3 text-muted-foreground" />
                    </Button>
                  }
                />
              </MiniToolbar>
            )}
          </SlideCanvas>
        }
        inspector={drawerShown ? (
          <DataDrawer
            data={data}
            onChange={setData}
            subtypeName={subtype.name}
            pie={spec.kind === "pie"}
            invalid={demoState === "drawer"}
            menuDemo={demoState === "grid-menu" ? { axis: "row", index: 0 } : undefined}
            notice={notice}
            onCollapse={() => { setDrawer(false); setSections((s) => (s.includes("data") ? s : [...s, "data"])) }}
            onClose={() => { setDrawer(false); setSections((s) => s.filter((x) => x !== "data")) }}
          />
        ) : (
          <Inspector
            value="properties"
            onValueChange={() => {}}
            readOnly={readOnly}
            tabs={[{
              value: "properties",
              label: "属性",
              content: showPlaceholder ? (
                <div className="cordex-well m-3 mt-2">
                  <div className="cordex-group p-3 text-xs text-muted-foreground">
                    {demoState === "menu"
                      ? "从「插入 › 图表 ▾」选择类型；页上有空内容占位符时图表填入该占位符（保留占位符），并自动打开数据面板。"
                      : "空内容占位符：单击图标条里的「图表」选择类型，图表填入此占位符（保留占位符），并自动打开数据面板。"}
                  </div>
                </div>
              ) : readonlyType ? (
                <ReadonlyChartInspector readOnly={readOnly} />
              ) : m2 ? (
                <M2ChartInspector subtypeName={subtype.name} seriesCount={data.series.length} box={chartBox} readOnly={readOnly} />
              ) : (
                <ChartInspector
                  spec={spec}
                  onRequestType={(st) => requestType(st, "inspector")}
                  confirm={confirmFor("inspector")}
                  options={options}
                  onOptionsChange={setOptions}
                  data={data}
                  onDataChange={setData}
                  focusCell={focusCell}
                  sections={shownSections}
                  onSectionsChange={setSections}
                  drawerOpen={drawerShown}
                  onExpand={() => setDrawer(true)}
                  readOnly={readOnly}
                  notice={notice}
                />
              ),
            }]}
          />
        )}
        statusBar={<StatusBar left={statusLeft} right={[<StatusText key="s" status={{ kind: "sync", state: "synced" }} variant="dot" />]} />}
      />
      {showPlaceholder && !readOnly && <PlaceholderChartMenu open={phMenuOpen} onOpenChange={setPhMenuOpen} onPick={afterInsert} />}
    </div>
  )
}

/** 画布上的图表对象：可聚焦；双击或 Enter 触发 onActivate（可编辑图表展开数据分区；只读类型弹提示） */
function ChartHitArea({ box, label, onActivate, children }: { box: Box; label: string; onActivate?: () => void; children?: ReactNode }) {
  const style: CSSProperties = { left: box.x, top: box.y, width: box.w, height: box.h }
  return (
    <div
      role="img"
      aria-roledescription="图表"
      aria-label={label}
      tabIndex={0}
      className="absolute outline-none"
      style={style}
      onDoubleClick={onActivate}
      onKeyDown={(e) => { if (e.key === "Enter" && onActivate) { e.preventDefault(); onActivate() } }}
    >
      {children}
    </div>
  )
}

/** obj 左上「• 单击此处添加文本」一行占的高度：图标条在其下方的区域里居中（同 03-16 样张） */
const PROMPT_H = 48

/**
 * 空内容占位符 + 快速插入图标条（G-80；50/21 §3）：表格弹与插入页签同一个 TableGridPicker（Q2），图片选文件；
 * 图表在 M3 起可用（onPick("chart") 由调用方弹 ChartTypeMenu），M2 禁用并给原因；视频 P2。图标条画在屏幕覆盖层，评审 / 查看不出。
 */
function EmptyContentPlaceholder({ box, enabledKinds, readOnly, onPick, activeKind }: { box: Box; enabledKinds: PlaceholderContentKind[]; readOnly: boolean; onPick: (k: PlaceholderContentKind) => void; activeKind?: PlaceholderContentKind | null }) {
  // 「插入表格…」与插入页签、03-30 占位符同一流程：先关网格弹层，再开对话框；确定同样填入此占位符
  const [dialog, setDialog] = useState(false)
  // 对话框没有 DialogTrigger，Radix 关闭时不会自己把焦点还回去：记下打开时的焦点（close() 已把它还给表格图标）
  const returnRef = useRef<HTMLElement | null>(null)
  const fillTable = (r: number, c: number) => toast(`已在占位符插入 ${r} 行 × ${c} 列表格，宽取占位符框宽`, { description: "填入是一个撤销步；删除内容后占位符恢复为空" })
  return (
    <>
      <CanvasElementBox box={box} className="rounded-sm border border-dashed border-doc-ink/25">
        <p className="flex items-center gap-2 px-4 pt-3 text-lg text-doc-ink/40"><span className="text-doc-ink/35">•</span>单击此处添加文本</p>
      </CanvasElementBox>
      {!readOnly && (
        <PlaceholderIconBar
          box={box}
          insetTop={PROMPT_H}
          kinds={["table", "picture", "chart", "video"]}
          enabledKinds={enabledKinds}
          activeKind={activeKind}
          pickers={{
            table: (close) => <TableGridPicker onPick={(r, c) => { close(); fillTable(r, c) }} onOpenDialog={() => { close(); returnRef.current = document.activeElement as HTMLElement | null; setDialog(true) }} />,
          }}
          onPick={onPick}
        />
      )}
      <InsertTableDialog open={dialog} onOpenChange={setDialog} onConfirm={fillTable} returnFocusRef={returnRef} />
    </>
  )
}

/** 图表图标；图标条折叠为「插入 ▾」时锚到该按钮 */
const CHART_ICON_SEL = '[role="toolbar"][aria-label="插入内容到占位符"] [aria-label^="插入图表"], button[aria-label="插入内容到占位符"]'

/**
 * 占位符图标条 › 图表（M3）：在图表图标旁弹出与插入页签同一个 ChartTypeMenu；选定后走 slide.fillPlaceholder 填入该占位符。
 * 图标条画在屏幕覆盖层、按屏幕尺寸绘制，这里按图标的屏幕位置放一个不可见锚点（fixed），菜单贴它下缘弹出。
 */
function PlaceholderChartMenu({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (v: boolean) => void; onPick: (st: ChartSubtype) => void }) {
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  useEffect(() => {
    if (!open) return
    let raf = 0
    const tick = () => {
      const r = document.querySelector<HTMLElement>(CHART_ICON_SEL)?.getBoundingClientRect()
      setRect((cur) => (r && (!cur || cur.x !== r.x || cur.y !== r.y || cur.w !== r.width || cur.h !== r.height) ? { x: r.x, y: r.y, w: r.width, h: r.height } : cur))
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [open])
  if (!rect) return null
  return createPortal(
    <ChartTypeMenu
      open={open}
      onOpenChange={onOpenChange}
      header={<><MilestoneTag>M3</MilestoneTag> 五类 · 填入占位符后打开数据面板</>}
      onPick={onPick}
      side="bottom"
      align="start"
      sideOffset={6}
      // 与图标条的表格网格同一避让口径（PlaceholderIconBar PICKER_COLLISION）：下方放不下时翻到图标上方，不压住状态栏与缩放条
      collisionPadding={PLACEHOLDER_PICKER_COLLISION}
      // 未选类型就关闭（Esc、点别处）：焦点回到图表图标（锚点本身不可聚焦）
      returnFocusTo={() => document.querySelector<HTMLElement>(CHART_ICON_SEL)}
      trigger={<span aria-hidden="true" className="pointer-events-none fixed" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />}
    />,
    document.body
  )
}

function Section({ value, label, tag, children }: { value: string; label: string; tag?: string; children: ReactNode }) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger className="text-xs font-semibold">
        <span className="inline-flex items-center gap-1.5">{label}{tag && <MilestoneTag>{tag}</MilestoneTag>}</span>
      </AccordionTrigger>
      {/* h-auto：Rhea 的内层固定为展开瞬间量到的高度，内容随后变多（新增类别、换演示数据）会被裁掉 */}
      <AccordionContent className="flex h-auto flex-col gap-2.5">{children}</AccordionContent>
    </AccordionItem>
  )
}

const P2_REASON = "坐标轴范围、数字格式、趋势线与误差线排在后续版本（P2）；导入文件里已有的设置原样保留。"

/** P2 分区：不可展开的标题行（aria-disabled、可聚焦，tooltip 给原因）；标题与 chevron 50%，P2 标记保持原色 */
function DisabledSectionRow({ label, tag, reason }: { label: string; tag: string; reason: string }) {
  return (
    <div data-slot="accordion-item" data-state="closed">
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            aria-disabled="true"
            aria-expanded={false}
            aria-label={`${label}（${tag}）`}
            data-slot="accordion-trigger"
            className="flex cursor-not-allowed items-center justify-between gap-6 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            <span className="inline-flex items-center gap-1.5"><span className="opacity-50">{label}</span><MilestoneTag>{tag}</MilestoneTag></span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground opacity-50" aria-hidden="true" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-60 text-pretty">{reason}</TooltipContent>
      </Tooltip>
    </div>
  )
}

const legendOptions: { v: LegendPos; l: string }[] = [
  { v: "bottom", l: "底部" },
  { v: "top", l: "顶部" },
  { v: "left", l: "左侧" },
  { v: "right", l: "右侧" },
  { v: "topRight", l: "右上" },
]

/** 原工作簿重生成提示（50/24 §3.10）：导入且带内嵌工作簿的图表首次打开数据编辑时出现，首次提交或「知道了」后不再出 */
function WorkbookNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div role="status" className="flex items-start gap-2 rounded-xl bg-info-muted px-3 py-2 text-xs text-foreground/85">
      <Info className="mt-px size-3.5 shrink-0 text-info-foreground" aria-hidden="true" />
      <p className="flex-1 text-pretty">原工作簿里数据区之外的内容（其它工作表、公式）在编辑数据后不保留。</p>
      <Button variant="ghost" size="xs" className="-my-0.5 h-6 shrink-0 px-2 text-xs text-info-foreground hover:bg-info/10 hover:text-info-foreground" onClick={onDismiss}>知道了</Button>
    </div>
  )
}

/** 数据分区与数据面板的说明行文字：截断时写总规模，饼图写只画第一个系列 */
function gridNote(data: ChartData, compact: boolean, pie: boolean): ReactNode {
  const parts: string[] = []
  if (compact && isCompactTruncated(data)) parts.push(`共 ${data.categories.length} 类别 × ${data.series.length} 系列`, `此处显示前 ${COMPACT_LIMIT.rows} × ${COMPACT_LIMIT.cols}`)
  else parts.push("行 = 类别", "列 = 系列")
  if (pie && data.series.length > 1) parts.push(GRID_PIE_NOTE)
  // 每段整体不折行（汉字之间默认可断，「此处显 / 示前」会被拆开），窄栏里只在「·」处换行
  return parts.map((t, i) => (
    <span key={i}>
      {i > 0 && " · "}
      <span className="whitespace-nowrap">{t}</span>
    </span>
  ))
}

/** 图表检查器（selectionKind `chart`，50/24 §3.7）：图表（类型 / 标题 / 图例 / 数据标签）· 数据（紧凑网格）· 位置与大小 · 替代文本 · 坐标轴与格式（P2） */
function ChartInspector({
  spec,
  onRequestType,
  confirm,
  options,
  onOptionsChange,
  data,
  onDataChange,
  focusCell,
  sections,
  onSectionsChange,
  drawerOpen,
  onExpand,
  readOnly,
  notice,
}: {
  spec: ChartSpec
  onRequestType: (st: ChartSubtype) => void
  /** 类型切换确认条（类型区下方） */
  confirm?: ReactNode
  options: ChartOptions
  onOptionsChange: (o: ChartOptions) => void
  data: ChartData
  onDataChange: (d: ChartData) => void
  focusCell?: GridCellRef
  sections: string[]
  onSectionsChange: (v: string[]) => void
  drawerOpen: boolean
  onExpand: () => void
  readOnly: boolean
  notice: ReactNode
}) {
  const family = chartFamilies.find((f) => f.kind === spec.kind)!
  const set = (p: Partial<ChartOptions>) => !readOnly && onOptionsChange({ ...options, ...p })
  const pie = spec.kind === "pie"
  const pieLabels = options.pieLabels ?? defaultPieLabels
  return (
    <Accordion type="multiple" value={sections} onValueChange={onSectionsChange} className="inspector-groups m-3 mt-2">
      <Section value="chart" label="图表" tag="M3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">类型</span>
          <div role="radiogroup" aria-label="图表类别" className="grid grid-cols-6 gap-1">
            {chartFamilies.map((f) => (
              <Tooltip key={f.kind}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={f.kind === spec.kind}
                    aria-label={f.label}
                    aria-disabled={readOnly || undefined}
                    onClick={() => !readOnly && f.kind !== spec.kind && onRequestType(f.subtypes[0]!)}
                    className={cn(
                      "flex h-7 items-center justify-center rounded-md text-foreground/75 outline-none transition-colors hover:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-ring",
                      f.kind === spec.kind && "bg-primary/12 text-primary ring-1 ring-primary/40 hover:bg-primary/15"
                    )}
                  >
                    <f.icon className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{f.label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
          <div className={cn("grid gap-1.5", family.subtypes.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
            {family.subtypes.map((st) => {
              const on = st.variant === spec.variant
              return (
                <button
                  key={st.variant}
                  type="button"
                  aria-pressed={on}
                  aria-disabled={readOnly || undefined}
                  onClick={() => !readOnly && !on && onRequestType(st)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg p-1 text-center text-2xs leading-tight outline-none transition-colors hover:bg-foreground/[0.05] focus-visible:ring-2 focus-visible:ring-ring",
                    on && "bg-primary/10 text-foreground ring-1 ring-primary/40"
                  )}
                >
                  <span className="rounded bg-doc-paper p-0.5 shadow-[0_0_0_1px_rgb(15_20_40/0.08)]">
                    <DemoChart spec={st} data={sampleData(st.kind)} width={60} height={38} thumb />
                  </span>
                  <span className="line-clamp-2 text-muted-foreground">{st.name}</span>
                </button>
              )
            })}
          </div>
          {confirm}
        </div>

        <div className="flex flex-col gap-1.5 border-t border-foreground/[0.06] pt-2.5">
          <label className="flex items-center justify-between text-xs">标题 <Switch size="sm" checked={options.title} disabled={readOnly} onCheckedChange={(v) => set({ title: v })} aria-label="显示标题" /></label>
          <NoEditWhy on={readOnly && options.title}>
            <Input
              className={cn("h-7 text-xs md:text-xs", readOnly && LOCKED)}
              value={options.titleText}
              disabled={!options.title}
              readOnly={readOnly}
              aria-disabled={readOnly || undefined}
              onChange={(e) => set({ titleText: e.target.value })}
              aria-label="标题文字"
            />
          </NoEditWhy>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex-1 text-xs">图例</span>
          <Select value={options.legend === "none" ? "bottom" : options.legend} onValueChange={(v) => set({ legend: v as LegendPos })} disabled={options.legend === "none" || readOnly}>
            <SelectTrigger size="sm" className="h-7 w-[84px] text-xs" aria-label="图例位置"><SelectValue /></SelectTrigger>
            <SelectContent>{legendOptions.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
          </Select>
          <Switch size="sm" checked={options.legend !== "none"} disabled={readOnly} onCheckedChange={(v) => set({ legend: v ? "bottom" : "none" })} aria-label="显示图例" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center justify-between text-xs">数据标签 <Switch size="sm" checked={options.dataLabels} disabled={readOnly} onCheckedChange={(v) => set({ dataLabels: v })} aria-label="显示数据标签" /></label>
          {pie && options.dataLabels && (
            <div className="flex items-center gap-3 pl-0.5 text-xs text-muted-foreground">
              {([["percent", "百分比"], ["category", "类别名"], ["value", "值"]] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-1.5">
                  <Checkbox checked={pieLabels[k]} disabled={readOnly} onCheckedChange={(v) => set({ pieLabels: { ...pieLabels, [k]: v === true } })} />{l}
                </label>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section value="data" label="数据" tag="M3">
        {drawerOpen ? (
          <p className="text-xs text-muted-foreground">数据正在右侧抽屉中编辑。</p>
        ) : (
          <>
            {notice}
            <div data-chart-grid="compact">
              <ChartDataGrid data={data} onChange={onDataChange} compact focusCell={focusCell} plottedSeries={pie ? 1 : undefined} readOnly={readOnly} />
            </div>
            <div className="flex items-center gap-2">
              <span className="flex-1 text-xs text-muted-foreground">{gridNote(data, true, pie)}</span>
              {readOnly ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" aria-disabled="true" className="h-7 cursor-not-allowed gap-1 px-2 text-xs opacity-50" onClick={(e) => e.preventDefault()}><Maximize2 className="size-3.5" />展开</Button>
                  </TooltipTrigger>
                  <TooltipContent>需要编辑权限</TooltipContent>
                </Tooltip>
              ) : (
                <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onExpand}><Maximize2 className="size-3.5" />展开</Button>
              )}
            </div>
          </>
        )}
      </Section>

      <Section value="position" label="位置与大小">
        <PositionFields box={{ x: 90, y: 116, w: 780, h: 396 }} readOnly={readOnly} />
      </Section>
      <Section value="alt" label="替代文本">
        <AltTextFields readOnly={readOnly} />
      </Section>
      <DisabledSectionRow label="坐标轴与格式" tag="P2" reason={P2_REASON} />
    </Accordion>
  )
}

/** 评审 / 查看角色下检查器编辑类控件的外观：仍可聚焦与悬停（tooltip 可达），内容 50%（同 TableInspector，FE-06） */
const LOCKED = "cursor-not-allowed opacity-50"
const NO_EDIT_REASON = "需要编辑权限"

/** 禁用而不隐藏：只读时包一层 tooltip 给原因；控件自身负责 readOnly 与 aria-disabled */
function NoEditWhy({ on, children }: { on: boolean; children: ReactElement }) {
  if (!on) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="left">{NO_EDIT_REASON}</TooltipContent>
    </Tooltip>
  )
}

/** 位置与大小四个数值框（pt）；只读角色下 readOnly + aria-disabled，tooltip「需要编辑权限」 */
function PositionFields({ box, readOnly = false }: { box: Box; readOnly?: boolean }) {
  const field = (label: string, v: number) => (
    <NoEditWhy on={readOnly}>
      <NumberField
        value={String(v)}
        suffix="pt"
        readOnly={readOnly}
        aria-disabled={readOnly || undefined}
        aria-label={readOnly ? `${label}（${NO_EDIT_REASON}）` : label}
        className={cn(readOnly && LOCKED)}
      />
    </NoEditWhy>
  )
  return (
    <>
      <PropertyRowPair a={{ label: "X", children: field("X", box.x) }} b={{ label: "Y", children: field("Y", box.y) }} />
      <PropertyRowPair a={{ label: "宽", children: field("宽", box.w) }} b={{ label: "高", children: field("高", box.h) }} />
    </>
  )
}

/** 替代文本：标题 + 描述（与只读类型、03-30 §6.7 的表格一致）；缺失时警告；只读角色同 PositionFields */
function AltTextFields({ title, description, readOnly = false }: { title?: string; description?: string; readOnly?: boolean }) {
  const lock = { readOnly, "aria-disabled": readOnly || undefined } as const
  return (
    <>
      <PropertyRow label="标题">
        <NoEditWhy on={readOnly}>
          <Input className={cn("h-7 text-xs md:text-xs", readOnly && LOCKED)} defaultValue={title} placeholder="例如：各区域季度销售" aria-label="替代文本标题" {...lock} />
        </NoEditWhy>
      </PropertyRow>
      <NoEditWhy on={readOnly}>
        <Textarea className={cn("min-h-14 text-xs md:text-xs", readOnly && LOCKED)} defaultValue={description} placeholder="描述：图表要传达的要点" aria-label="替代文本描述" {...lock} />
      </NoEditWhy>
      {!title && !description && <p className="text-xs text-warning-foreground">缺少替代文本：读屏用户无法了解图表内容</p>}
    </>
  )
}

/** M2 选中导入的图表（50/10 §5）：「图表」分区只读显示类型与系列数，注「数据编辑 M3 提供」；另有位置与大小、替代文本 */
function M2ChartInspector({ subtypeName, seriesCount, box, readOnly = false }: { subtypeName: string; seriesCount: number; box: Box; readOnly?: boolean }) {
  return (
    <Accordion type="multiple" defaultValue={["chart", "position", "alt"]} className="inspector-groups m-3 mt-2">
      <Section value="chart" label="图表" tag="M3">
        <PropertyRow label="类型">
          <span className="flex h-7 flex-1 items-center rounded-md bg-input/50 px-2 text-xs text-foreground/80" aria-readonly="true">{subtypeName} · {seriesCount} 个系列</span>
        </PropertyRow>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><Info className="mt-px size-3.5 shrink-0 text-info-foreground" aria-hidden="true" />数据编辑 M3 提供；现在可以移动、缩放、复制、删除和改替代文本</p>
      </Section>
      <Section value="position" label="位置与大小">
        <PositionFields box={box} readOnly={readOnly} />
      </Section>
      <Section value="alt" label="替代文本">
        <AltTextFields title="各区域季度销售柱形图" description="华东四个季度持续增长，第四季度 6.2 百万元为最高" readOnly={readOnly} />
      </Section>
    </Accordion>
  )
}

/** 非五类图表的检查器：只有位置与大小、替代文本与保真详情入口（50/24 §3.7；设计 13 的降级口径） */
function ReadonlyChartInspector({ readOnly = false }: { readOnly?: boolean }) {
  return (
    <div className="flex flex-col">
      <div className="cordex-well m-3 mt-2 flex flex-col gap-2.5">
        <div className="cordex-group flex flex-col gap-2 p-3 text-xs">
          <p className="flex items-center gap-1.5 font-semibold text-foreground/70"><Info className="size-3.5 text-info-foreground" />此类型仅支持查看</p>
          <p className="text-muted-foreground">雷达图不在可编辑的五类（柱形 / 条形、折线、饼、面积、散点）里。可以移动、缩放、复制和删除；数据与格式按原样导出。</p>
          <Button variant="outline" size="sm" className="h-7 w-fit gap-1 px-2 text-xs" onClick={() => toast("已打开保真报告 · 图表分组（演示）")}><ExternalLink className="size-3.5" />保真详情</Button>
        </div>
        <div className="cordex-group flex flex-col gap-1.5 p-3">
          <p className="text-xs font-semibold text-foreground/70">位置与大小</p>
          <PositionFields box={{ x: 90, y: 116, w: 780, h: 396 }} readOnly={readOnly} />
        </div>
        <div className="cordex-group flex flex-col gap-2 p-3">
          <p className="text-xs font-semibold text-foreground/70">替代文本</p>
          <AltTextFields title="能力评估雷达图" description="五个维度的团队能力评分" readOnly={readOnly} />
        </div>
      </div>
    </div>
  )
}

/**
 * 数据面板（检查器「展开」或迷你工具条「编辑数据」）：大网格、键盘说明、粘贴提示；非法输入 aria-invalid、不提交。
 * 「收起到检查器」回到 300 的检查器并展开数据分区（紧凑网格）；「关闭」回到 300、数据分区收起。
 */
function DataDrawer({
  data,
  onChange,
  onCollapse,
  onClose,
  subtypeName,
  pie,
  invalid,
  menuDemo,
  notice,
}: {
  data: ChartData
  onChange: (d: ChartData) => void
  onCollapse: () => void
  onClose: () => void
  subtypeName: string
  pie: boolean
  /** 演示：画出非法输入格与错误行 */
  invalid: boolean
  menuDemo?: GridMenuDemo
  notice: ReactNode
}) {
  return (
    <aside
      aria-label="编辑图表数据"
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4"
      onKeyDown={(e) => { if (e.key === "Escape" && !(e.target instanceof HTMLInputElement)) onClose() }}
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold">编辑数据 <MilestoneTag>M3</MilestoneTag></p>
          <p className="truncate text-xs text-muted-foreground">{subtypeName} · 修改后 100 ms 内重绘</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="收起到检查器" onClick={onCollapse}><Minimize2 /></Button></TooltipTrigger>
          <TooltipContent>收起到检查器</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="关闭" onClick={onClose}><X /></Button></TooltipTrigger>
          <TooltipContent>关闭</TooltipContent>
        </Tooltip>
      </div>
      {notice}
      <ChartDataGrid data={data} onChange={onChange} invalid={invalid ? { r: 2, c: 2, text: "3,O" } : undefined} plottedSeries={pie ? 1 : undefined} menuDemo={menuDemo} />
      {invalid && <p className="flex items-center gap-1.5 text-xs text-destructive"><span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />类别 3 · 系列 3：「3,O」不是有效数字，未提交</p>}
      {pie && data.series.length > 1 && <p className="text-xs text-muted-foreground">{GRID_PIE_NOTE}；其余系列保留在数据里，切回其它类型后重新画出。</p>}
      <div className="cordex-group mt-auto flex flex-col gap-2 p-3 text-xs text-muted-foreground">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="flex items-center gap-1"><Kbd>Enter</Kbd> 提交并下移</span>
          <span className="flex items-center gap-1"><Kbd>Tab</Kbd> 提交并右移</span>
          <span className="flex items-center gap-1"><Kbd>Esc</Kbd> 放弃输入</span>
          <span className="flex items-center gap-1"><Kbd>F2</Kbd> 编辑</span>
          <span className="flex items-center gap-1"><Kbd>⇧F10</Kbd> 行列菜单</span>
        </p>
        <p>可从 Excel 或表格复制整块粘贴（一次撤销步）；留空表示缺失值；右键类别名或系列名可删除、上移或下移（列为左移、右移）。</p>
      </div>
    </aside>
  )
}

/** 只读类型示例：雷达图（非五类，slide-render-chart 以只读渲染器绘制） */
function RadarChart() {
  const cx = CHART_BOX.x + CHART_BOX.w / 2
  const cy = CHART_BOX.y + CHART_BOX.h / 2 + 16
  const R = 150
  const axes = ["沟通", "交付", "质量", "创新", "协作"]
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / axes.length
    return [cx + R * v * Math.cos(a), cy + R * v * Math.sin(a)]
  }
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(",")).join(" ")
  return (
    <svg className="absolute inset-0" width={960} height={540} aria-hidden="true">
      {[0.25, 0.5, 0.75, 1].map((k) => <polygon key={k} points={poly(axes.map(() => k))} fill="none" stroke="#1A2030" strokeOpacity={0.12} />)}
      {axes.map((a, i) => {
        const [x, y] = pt(i, 1.14)
        const [ex, ey] = pt(i, 1)
        return (
          <g key={a}>
            <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="#1A2030" strokeOpacity={0.12} />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={13} fill="#1A2030" fillOpacity={0.65}>{a}</text>
          </g>
        )
      })}
      <polygon points={poly([0.8, 0.65, 0.9, 0.55, 0.75])} fill={ACCENTS[0]} fillOpacity={0.22} stroke={ACCENTS[0]} strokeWidth={2} />
      <polygon points={poly([0.6, 0.85, 0.7, 0.8, 0.5])} fill={ACCENTS[1]} fillOpacity={0.2} stroke={ACCENTS[1]} strokeWidth={2} />
      <text x={cx} y={CHART_BOX.y + 32} textAnchor="middle" fontSize={20} fontWeight={600} fill="#1A2030">团队能力评估</text>
    </svg>
  )
}
