import { SHARE_LATER, useEditor, type EditorCtx, registerToolLayer } from "../../kit"
import { defineScenario, type EditorConfig } from "../types"
import { deckFor } from "./ChartSlide"
import { ChartTypeMenu, TypeSwitchConfirm } from "./ChartTypeMenu"
import { chartInspectorRegion } from "./DataPanel"
import "./inspector"
import {
  CHART_DISABLED_REASON, CHART_PAGE, COLUMN, DEFAULT_OPTIONS, LINE_MARKERS, PIE_SUBTYPE, pieData, regionData, sampleData, wideData, type ChartKind,
} from "./model"
import { chartOverlay, ChartToasts } from "./overlays"
import { applyType, insertChart, requestType, useChart, type ChartModel } from "./store"

/**
 * 03-31 图表编辑（G-63；PRD ED-15a 插入图表、ED-15 数据编辑，M3 P1）在 v3 编辑器里的状态。
 *
 * v3 入口（DS-1，rulings §4.25）：
 * - 插入：底部工具条「图表」点开六项菜单与子类型 flyout（ChartTypeMenu）；空内容占位符图标条 › 图表弹同一个菜单。
 *   页上有空内容占位符时新图表填入它（Q1）；插入即选中、检查器展开「数据」、焦点在首个数值格，反馈走轻提示（DS-6 无状态栏）。
 * - 格式：检查器 chart 分区——类型（下拉即 ChartTypeMenu，高亮当前子类型）· 图表元素（标题 / 图例 / 数据标签）· 数据（紧凑网格，可展开为数据面板）·
 *   位置与大小 · 替代文本 · 坐标轴与格式（P2）。图表里的文字格式只在检查器（DS-13）。
 * - 不设迷你工具条（rulings §4.25 DS-22）：原规格迷你条的「编辑数据」「更改类型 ▾」分别并入「数据」分区的「展开」与「类型」字段（Q2 入口唯一，与表格同一取舍）；
 *   下拉内确认与检查器内联确认因此合为一种（类型下拉底部，TB-11）。
 * - 评审 / 查看（DS-15）：对象检查器只读展示当前值，不画禁用控件；画布不画手柄、空占位符不出图标条、数据面板不出。
 * 图表画在第 5 页「区域分布」（版式「标题和内容」，M2 演示为「两栏内容」），数据与示例文档的区域口径一致。
 */

const D = (chart: Partial<ChartModel>, extra: Record<string, unknown> = {}): EditorConfig["data"] => ({ chart, ...extra })

const DECK = deckFor()
const DECK_TWO = deckFor("两栏内容")

const IMPORTED: Partial<ChartModel> = {
  spec: COLUMN,
  options: { ...DEFAULT_OPTIONS, titleText: "各区域季度销售（百万元）" },
  data: regionData(),
  imported: true,
  altTitle: "各区域季度销售柱形图",
  altDesc: "华东四个季度持续增长，第四季度 6.2 百万元为最高",
}

/** 浮层（layers）：三处 ChartTypeMenu——工具条「图表」、占位符图标条 › 图表、检查器「类型」字段 */
function ChartLayers() {
  const ed = useEditor()
  const [m, set] = useChart()
  const editable = ed.mode === "edit"
  return (
    <>
      {/* 工具条「图表」的类型菜单由底座工具条打开（下方 registerToolLayer("chart")，任何状态点真实的「图表」都能打开）；这里只放占位符与「类型」字段两处 */}
      {m.page === "empty" && editable && (
        <ChartTypeMenu
          anchor="chart.ph-chart"
          label="插入图表到占位符"
          open={m.phMenu && ed.slide === CHART_PAGE}
          onOpenChange={(v) => set({ phMenu: v })}
          header="五类 · 填入占位符后展开数据"
          side="bottom"
          align="start"
          sideOffset={6}
          onPick={(st) => insertChart(m, set, ed, st)}
        />
      )}
      {editable && m.page === "chart" && ed.selection === "chart" && !m.panel && (
        <ChartTypeMenu
          anchor="chart.type-field"
          label="更改图表类型"
          open={m.typeMenu}
          onOpenChange={(v) => set(v ? { typeMenu: true } : { typeMenu: false, typeFlyout: null, pending: null })}
          header="更改类型 · 数据与标题保留"
          current={m.spec}
          flyout={m.typeFlyout}
          flyoutBoundary="canvas"
          sideOffset={24}
          returnFocus="always"
          onPick={(st) => requestType(m, set, ed, st)}
          footer={m.pending ? <TypeSwitchConfirm subtype={m.pending} onConfirm={() => applyType(m, set, ed, m.pending!)} onCancel={() => set({ pending: null })} /> : undefined}
        />
      )}
    </>
  )
}

const layers = (_ctx: EditorCtx) => <ChartLayers />

/**
 * 工具条「图表」的类型菜单（03-31「图表 ▾ 菜单」）：登记给底座工具条（editor/insert-menus.tsx），所以任何状态里点真实的「图表」都会弹出它，
 * 开关由工具条管（开着时按钮按下，关了回到「选择」）。在本场景里选定即插入并展开检查器「数据」分区（「数据面板」只指 400 宽的那一栏，rulings §4.25 TB-12）；
 * 别的场景只演示菜单本身，选了即关。
 * 静态展开的子类型 flyout 读状态的 data.toolFlyout（chart.menu）。
 */
function ToolbarChartMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const ed = useEditor()
  const [m, set] = useChart()
  const toolFlyout = (ed.data.toolFlyout as ChartKind | undefined) ?? null
  return (
    <ChartTypeMenu
      anchor="tool-chart"
      label="插入图表"
      open={open}
      onOpenChange={onOpenChange}
      header="五类 · 插入后展开数据"
      flyout={toolFlyout}
      onPick={(st) => {
        if (ed.scenarioId !== "chart") return
        if (ed.slide !== CHART_PAGE) ed.goTo(CHART_PAGE)
        insertChart(m, set, ed, st)
      }}
    />
  )
}

registerToolLayer("chart", (p) => <ToolbarChartMenu {...p} />)

export default defineScenario({
  id: "chart",
  title: "图表编辑",
  specs: ["03-31"],
  summary: "工具条「图表」五类与子类型、插入后的图表、类型下拉与确认、图表元素、紧凑网格与数据面板（右键、截断、原工作簿提示）、只读类型、M2、评审与查看者只读",
  editor: {
    deck: DECK,
    slide: CHART_PAGE,
    stage: { cursor: false },
    slideOverlay: chartOverlay,
    canvasOverlay: () => <ChartToasts />,
    layers,
    regions: { inspector: chartInspectorRegion },
  },
  states: [
    {
      id: "inserted",
      title: "插入后 · 示例图表与数据",
      note: "03-31「插入后」：簇状柱形示例图（类别 1–4 × 系列 1–3）填入空正文占位符，选中框 8 个缩放手柄、无旋转手柄；检查器展开「数据」，首个数值格是焦点格（2px 强调色内描边）；轻提示取代状态栏反馈，「撤销」回到空占位符",
      editor: {
        selection: "chart",
        data: D({
          page: "chart",
          dataOpen: true,
          focus: { r: 0, c: 0 },
          toast: { title: "已插入簇状柱形图", description: "示例数据已写入，已展开数据", action: "撤销", undo: { model: { page: "empty", dataOpen: false }, selection: "none" } },
        }),
      },
    },
    {
      id: "menu",
      title: "工具条「图表」· 五类与子类型",
      note: "03-31「图表 ▾ 菜单」：工具条「图表」按下，菜单向上居中、首行说明不可选；六项（五类，柱形 / 条形分两项），有子类型的五项悬停或 → 打开 flyout（缩略图是用示例数据画的真实子类型），饼图点即插入。页上有空正文占位符，悬停框标出新图表将填入的位置（Q1）",
      editor: { toolbar: { tool: "chart", menu: "chart" }, data: D({ page: "empty" }, { toolFlyout: "column" }) },
    },
    {
      id: "placeholder-chart",
      title: "占位符图标条 › 图表",
      note: "03-31 / 03-16：空正文占位符图标条的「图表」按下（M3 起可用），贴图标下缘弹出同一个 ChartTypeMenu，首行「五类 · 填入占位符后展开数据」；视频 P2 禁用而不隐藏。选定即填入此占位符",
      editor: { data: D({ page: "empty", phMenu: true }) },
    },
    {
      id: "data-panel",
      title: "数据面板 · 非法输入",
      note: "03-31「数据面板」：「数据」分区的「展开」打开数据面板（检查器坞加宽为 400、整栏换成完整网格，画布相应收窄）；已提交「类别 2 · 系列 1 = 3.8」，图表按新数据重绘；「3,O」危险色格不提交，网格下方错误行说明。底部是键盘与粘贴帮助",
      editor: {
        selection: "chart",
        data: D({
          page: "chart",
          panel: true,
          data: (() => {
            const d = sampleData("column")
            d.series[0]!.values[1] = 3.8
            return d
          })(),
          invalid: { r: 2, c: 2, text: "3,O" },
        }),
      },
    },
    {
      id: "grid-menu",
      title: "数据网格 · 行列右键菜单",
      note: "03-31「编辑、增删与粘贴」：在「类别 1」格上右键（或聚焦后 Shift+F10）打开行菜单，首行是对象名；「上移」不可用并写原因（已是第一个类别），删除为危险色；对应格强调色浅底。系列表头同理（左移 / 右移 / 删除系列）",
      editor: { selection: "chart", data: D({ page: "chart", panel: true, gridMenu: { axis: "row", index: 0 } }, { staticGridMenu: true }) },
    },
    {
      id: "compact-overflow",
      title: "紧凑网格 · 超过 8 × 4",
      note: "03-31「检查器 · 数据」：带数据标记的折线图，10 类别 × 7 系列（第 7 个系列色按亮度派生），图例在右侧；紧凑网格只显示前 8 × 4，截断方向不出「+」，说明行「共 10 类别 × 7 系列 · 此处显示前 8 × 4」，其余在数据面板里编辑",
      editor: {
        selection: "chart",
        data: D({ page: "chart", spec: LINE_MARKERS, options: { ...DEFAULT_OPTIONS, titleText: "各区域月度销售（百万元）", legend: "right" }, data: wideData(), dataOpen: true }),
      },
    },
    {
      id: "workbook-notice",
      title: "数据面板 · 原工作簿提示",
      note: "03-31 / 50/24 §3.10：导入且带内嵌工作簿的图表首次编辑数据，面板顶部出提示条（检查器「数据」分区顶部同一提示、同一状态）；首次提交数据或点「知道了」后不再出",
      editor: { selection: "chart", data: D({ page: "chart", ...IMPORTED, notice: true, panel: true }) },
    },
    {
      id: "type-menu",
      title: "类型下拉 · 当前子类型",
      note: "03-31「更改图表类型」：检查器「类型」字段即下拉，打开与工具条同一个 ChartTypeMenu（向检查器左侧展开，flyout 也在左侧、不盖住检查器），首行「更改类型 · 数据与标题保留」；当前类别图标着强调色，flyout 里当前子类型格高亮。只在五类之间切换",
      editor: { selection: "chart", data: D({ page: "chart", typeMenu: true, typeFlyout: "column" }) },
    },
    {
      id: "type-switch",
      title: "更改类型之后",
      note: "03-31「更改图表类型」：簇状柱形 → 带数据标记的折线，数据、标题与底部图例都保留；一次切换一个撤销步，轻提示带「撤销」（同时还原类型与数据换算）",
      editor: {
        selection: "chart",
        data: D({ page: "chart", spec: LINE_MARKERS, toast: { title: "已更改为带数据标记的折线图", action: "撤销", undo: { model: { spec: COLUMN }, selection: "chart" } } }),
      },
    },
    {
      id: "type-confirm",
      title: "类型下拉 · 会移除导入内容",
      note: "03-31「会丢东西时先确认」：导入的柱形图带坐标轴格式与虚线趋势线，在类型下拉里选「饼图」——菜单不关，底部分隔线下出确认段（警示图标 + 说明 + 取消 / 切换），焦点在「切换」；Esc 关掉整个菜单等同取消。确认后执行、仍可撤销，之后再切不再确认",
      editor: { selection: "chart", data: D({ page: "chart", ...IMPORTED, droppable: true, typeMenu: true, pending: PIE_SUBTYPE }) },
    },
    {
      id: "options",
      title: "标题 / 图例 / 数据标签",
      note: "03-31「标题、图例与数据标签」：标题改为「各区域季度销售（百万元）」，图例在右侧（纵排，绘图区右缩），数据标签开、每根柱顶显示原值；三项都立即重绘。图例关掉时位置下拉不可用，再打开回到底部",
      editor: {
        selection: "chart",
        data: D({ page: "chart", data: regionData(), options: { ...DEFAULT_OPTIONS, titleText: "各区域季度销售（百万元）", legend: "right", dataLabels: true } }),
      },
    },
    {
      id: "pie",
      title: "饼图 · 百分比标签",
      note: "03-31「饼图：百分比标签」：渠道占比饼图只画第一个系列「本年」，扇区内白色百分比（四舍五入，合计可能是 99% 或 101%）；数据标签下出「百分比 / 类别名 / 值」三个复选；网格第二、三列是没画出的系列（降为次要色），说明行注「饼图只画第一个系列」",
      editor: {
        selection: "chart",
        data: D({ page: "chart", spec: { kind: "pie", variant: "plain" }, data: pieData(), dataOpen: true, options: { ...DEFAULT_OPTIONS, titleText: "渠道占比", legend: "right", dataLabels: true } }),
      },
    },
    {
      id: "readonly-type",
      title: "只读类型 · 雷达图",
      note: "03-31「只读类型」：非五类（这里是雷达图）可以选中、移动、缩放、复制、删除，选中框 8 个手柄；检查器只有「此类型仅支持查看」说明与保真详情入口、位置与大小、替代文本。双击或 Enter 弹同名轻提示（演示态直接显示）",
      editor: {
        selection: "chart",
        data: D({
          page: "radar",
          altTitle: "区域经营雷达图",
          altDesc: "华东、华南在增长、毛利、客户、交付、满意度五个维度的评分",
          toast: { title: "此类型仅支持查看：雷达图", description: "不在可编辑的五类里；可以移动、缩放和复制，数据与格式保持原样导出。", action: "查看保真详情", tone: "info" },
        }),
      },
    },
    {
      id: "m2-disabled",
      title: "M2 · 图表禁用 · 选中导入图表",
      note: "03-31「未开放」：工具条「图表」禁用而不隐藏，悬停或聚焦给出原因；「两栏内容」左栏是导入的簇状柱形图（已选中，可移动、缩放、删除、复制、改替代文本），右栏空内容占位符的图表图标挂 M3 禁用；检查器「类型」节标 M3、只读显示类型与系列数并注「数据编辑 M3 提供」（导入的非五类图表 M2 起显示「此类型仅支持查看」说明卡，见 readonly-type；rulings §4.25 TB-13）；「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）",
      editor: {
        deck: DECK_TWO,
        selection: "chart",
        inspector: { share: SHARE_LATER },
        // 原因提示一出现就展开（底座工具条的 toolbar.tip：用户第一次点按或按键后收起，回到悬停 / 聚焦才弹）
        toolbar: {
          disabled: { chart: CHART_DISABLED_REASON },
          tip: { tool: "chart", lines: ["图表 · 插入图表在 M3 提供：", "需要装载图表编辑组件。", "文稿里已有的图表照常查看、放映、移动和缩放。"] },
        },
        data: D({ page: "m2", ...IMPORTED, options: { ...DEFAULT_OPTIONS, titleText: "各区域季度销售" } }),
      },
    },
    {
      id: "review",
      title: "评审模式 · 只读",
      note: "03-31「评审模式与 commenter / viewer 角色」+ DS-15：画布无手柄；对象检查器只读展示当前值（类型、标题 / 图例 / 数据标签、数据表、位置与大小、替代文本），不画禁用控件，顶部一行权限说明；数据面板与「坐标轴与格式」不出现",
      editor: { mode: "review", selection: "chart", data: D({ page: "chart", data: regionData(), options: { ...DEFAULT_OPTIONS, titleText: "各区域季度销售（百万元）" }, dataOpen: true, altTitle: "各区域季度销售柱形图" }) },
    },
    {
      id: "viewer",
      title: "查看者 · 只读饼图",
      note: "03-31「评审模式与 commenter / viewer 角色」+ DS-15：查看者选中饼图，检查器顶部一行「只读 · 你只有查看权限」，各节只列当前值——数据标签写出组成（百分比），数据表里没画出的系列同样降为次要色；底部是浏览条，没有编辑入口",
      editor: {
        mode: "viewer",
        selection: "chart",
        data: D({
          page: "chart",
          spec: { kind: "pie", variant: "plain" },
          data: pieData(),
          dataOpen: true,
          options: { ...DEFAULT_OPTIONS, titleText: "渠道占比", legend: "right", dataLabels: true },
          altTitle: "渠道占比饼图",
          altDesc: "线上直营占 59%，渠道分销 23%，大客户 10%，其它 9%",
        }),
      },
    },
  ],
})
