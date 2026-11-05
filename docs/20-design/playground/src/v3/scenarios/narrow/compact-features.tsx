import { useEffect } from "react"
import { Minimize2, X } from "lucide-react"
import { ICON, IconButton, useEditor } from "../../kit"
import type { RegionDefaults } from "../types"
import { DataGrid } from "../chart/DataGrid"
import { gridNote } from "../chart/inspector"
import { findSubtype } from "../chart/model"
import { closeDataPanel, useDataPanelEsc, useFocusFirstCell } from "../chart/panel-keys"
import { useChart } from "../chart/store"
import { CompactStage, CompactToolbar, InspectorDrawer, RailDrawer } from "./compact"
import { useCloseDrawerOnMasterToggle, useDrawer, useHandoff } from "./form"

/**
 * 紧凑形态（640–1024，DS-17）下的三个功能件样张：图表数据面板、母版视图、查找（查找见 FindPanel 的 compact）。
 * 都复用各自场景的真实组件，只换外框：数据面板从「检查器加宽」改为底部 Sheet（rulings §4.22 D-17 / DF-07），
 * 母版视图的窗格与检查器改成抽屉（浮层），退出入口照常在横幅上（03-26 §6「已在母版视图中缩窄到 < 1024」）。
 */

/* ------------------------------------------------------------------ 图表数据面板：底部 Sheet（D-17） */

/**
 * 紧凑窗口里检查器是抽屉、加宽到 400 的数据面板放不下：数据面板改为画布底部的 Sheet（D-17），高 46vh、整宽、上沿圆角 12、浮层阴影，
 * 不加遮罩；幻灯片在 Sheet 之上的区域里适应，编辑时图表始终可见（CompactStage sheet）。底部工具条被 Sheet 盖住时让位（收起），
 * Sheet 关了再出来。标题行与桌面数据面板相同：「编辑数据 · 子类型」+「收起到检查器」+「关闭」（Esc）。网格就是桌面的 DataGrid。
 */
export function CompactDataSheet() {
  const [m] = useChart()
  if (!(m.panel && m.page === "chart")) return null
  return <DataSheet />
}

/** Sheet 本体（开着时才挂载，键盘与焦点钩子随它挂载 / 卸载）；Esc 与焦点规则同桌面数据面板（chart/panel-keys.ts） */
function DataSheet() {
  const [m, set] = useChart()
  const [drawer, setDrawer] = useDrawer()
  const [, setHandoff] = useHandoff()
  const st = findSubtype(m.spec)
  // 检查器抽屉已收起时，焦点落回打开它的开关（「显示检查器」）；抽屉还开着（只在 Sheet 关闭前的这一刻）则落回数据分区
  const close = () => closeDataPanel(set, "header", 'button[aria-label="显示检查器"]')
  useDataPanelEsc(close)
  useFocusFirstCell()
  // 从检查器抽屉里「数据」分区的「展开」打开：Sheet 取代抽屉里的数据区（D-17），抽屉收起，不再盖住 Sheet 右侧、也不重复画一份网格
  useEffect(() => {
    if (drawer !== "inspector") return
    // 焦点已交给网格首个数值格：右上胶囊的「显示检查器」重新挂上时不要抢走它（handoff 为 false 就不 autoFocus）
    setHandoff(false)
    setDrawer(null)
  }, [])
  return (
    <section
      aria-label="编辑图表数据"
      className="absolute inset-x-0 bottom-0 z-30 flex h-[46vh] flex-col rounded-t-[12px] border-t border-(--v3-border) bg-(--v3-panel) shadow-(--v3-shadow)"
    >
      <span aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-[2px] bg-(--v3-handle)" />
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-(--v3-border) pr-3 pl-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] leading-4 font-semibold text-(--v3-text)">编辑数据</h2>
          <p className="mt-1 truncate text-[12px] leading-4 text-(--v3-text-2)">{st.name}</p>
        </div>
        <IconButton
          label="收起到检查器"
          onClick={() => {
            // 「收起到检查器」：数据分区展开着、网格回到检查器里——检查器抽屉重新打开接住它，焦点回「展开」
            setDrawer("inspector")
            closeDataPanel(set, "expand", 'button[aria-label="显示检查器"]')
          }}
        >
          <Minimize2 {...ICON} />
        </IconButton>
        <IconButton label="关闭" kbd="Esc" onClick={close}>
          <X {...ICON} />
        </IconButton>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        <DataGrid compact={false} />
        <p className="text-[12px] leading-[18px] text-(--v3-text-2)">{gridNote(m, false)}</p>
      </div>
    </section>
  )
}

/** Sheet 开着时画布在它上面适应、工具条让位 */
export function ChartSheetStage({ d }: { d: RegionDefaults }) {
  const [m] = useChart()
  return <CompactStage d={d} sheet={m.panel && m.page === "chart"} />
}

export function ChartSheetToolbar({ d }: { d: RegionDefaults }) {
  const [m] = useChart()
  return <CompactToolbar d={d} hidden={m.panel && m.page === "chart"} />
}

/* ------------------------------------------------------------------ 母版视图：窗格与检查器改抽屉 */

/*
 * 退出母版视图（横幅「关闭母版视图」、主菜单「视图 › 关闭母版视图」、⌥⌘M、Esc 逐级链的最后一级）后，四个区域都要回到紧凑形态的普通编辑器
 * （幻灯片抽屉、普通画布与检查器、普通工具条）。2026-10-28 起母版视图是宿主的全局模式：在不在母版视图读宿主（useEditor().masterView），
 * 在母版视图里宿主把母版区域作为 d 传进来（narrow 场景级 masterView.frameRegions），这几块外框只决定紧凑形态的外框；退出时收起抽屉，回到进入前的样子。
 * 2026-10-29 补完（复验 R1-N3、R2-N5、R3-N5、R4-N4 第一条）：四块里的母版内容一律经 d 取（d.leftRail / d.inspector / d.stage / d.toolbar = 宿主登记的母版实现，
 * MasterViewImpl 的 Rail / Inspector / Stage / Toolbar），外框不再直接引用 masters-themes 的件、也不往 over 里另塞窗格与检查器内容——
 * 第二步只换登记的实现，紧凑形态跟着换。画法不变：d 在母版视图里就是适配层（masters-themes/master-impl.tsx），与原来直接引用的是同一批件、同样的字段。
 */

/** 母版窗格：左侧抽屉（与普通视图的幻灯片抽屉同一外框）；列表换成母版与版式缩略图、「新建版式」、没有网格切换，都由 d.leftRail（母版实现的 Rail）给 */
export function MasterRailDrawer({ d }: { d: RegionDefaults }) {
  return <RailDrawer d={d} />
}

/** 版式 / 母版属性：右侧抽屉；「评论」页签不可用、分区换成版式 / 母版 / 占位符，都由 d.inspector（母版实现的 Inspector）给 */
export function MasterInspectorDrawer({ d }: { d: RegionDefaults }) {
  return <InspectorDrawer d={d} />
}

/**
 * 画布：d.stage()（母版实现的 Stage：画布外框与备注区的隐形占位两块，同普通画布的结构），左上胶囊的主菜单里是「关闭母版视图」、没有单页 / 网格（母版视图没有网格形态）；退出后是普通画布与完整的胶囊。
 * 2026-10-30（母版视图改版第二步，规格 §3.7）：第二步的母版画布没有范围行，原来为它让出 28 的那一层去掉，d.stage() 直接交给 CompactStage——
 * 紧凑外框的左右留白照样作用在这两块上，幻灯片与同一视口的普通紧凑画布同大、只下移上下文条的高度。
 * 进出母版视图时收起打开中的抽屉（2026-10-28：母版视图是宿主的全局模式，单页视图里进出不重新挂载这一块；
 * 退出回网格时这一块随单页结构卸下，由网格的外框补做，是否已收过记在场景仓里，form.ts useCloseDrawerOnMasterToggle，2026-10-30 第一步修复第 6 轮）
 */
export function MasterCompactStage({ d }: { d: RegionDefaults }) {
  const { masterView } = useEditor()
  useCloseDrawerOnMasterToggle()
  if (!masterView.on) return <CompactStage d={d} />
  return <CompactStage d={d} stage={d.stage()} viewToggle={false} menu={{ master: { active: true, onToggle: () => masterView.exit("menu") } }} />
}

/** 工具条：d.toolbar()（母版实现的 Toolbar：创建工具同普通视图、「评论」换成「占位符」），在未遮挡区居中；退出后是普通工具条 */
export function MasterCompactToolbar({ d }: { d: RegionDefaults }) {
  const { view, masterView } = useEditor()
  if (!masterView.on) return <CompactToolbar d={d} />
  return view === "single" ? <CompactToolbar d={d} /> : null
}
