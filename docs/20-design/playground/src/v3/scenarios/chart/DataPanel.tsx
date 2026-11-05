import { CircleAlert } from "lucide-react"
import { ICON, InspectorTakeover, KeyCap, type EditorCtx } from "../../kit"
import type { RegionDefaults } from "../types"
import { DataGrid } from "./DataGrid"
import { gridNote, WorkbookNotice } from "./inspector"
import { findSubtype } from "./model"
import { closeDataPanel, useDataPanelEsc, useFocusFirstCell } from "./panel-keys"
import { Phrases } from "./Phrases"
import { useChart } from "./store"

/** 饼图说明（与网格表头的工具提示 PIE_NOTE_LONG 同一句），按分句换行 */
const PIE_NOTE_PARTS = ["饼图只画第一个系列；", "其余系列保留在数据里，", "切回其它类型后重新画出。"]

/**
 * 数据面板（03-31「线框：数据面板（展开）」）：不另开一栏，检查器坞加宽、整栏换成完整数据网格；画布相应收窄，编辑时图表始终可见。
 * 宽 400（检查器栏由 280 加宽到 400，rulings §4.25 DS-26；原 §4.22 D-11 的「由 300 加宽到 440」是相对旧版 300 检查器定的，已被 DS-26 取代）：400 让 1600 宽视口下画布仍占应用区 60%（Q1），完整网格 3 个系列不必横向滚动。
 * 顶行协作者、放映、分享与检查器同一行（同一外框）；第二行是面板标题与「收起到检查器」「关闭」，替换「设计 / 评论」页签行。
 * 外框是 kit 的 InspectorTakeover（检查器整栏面板，第 2 批版本历史、插件面板同用）；Esc 与初始焦点由本面板自己按逐层规则管（escape / autoFocus 关掉）。
 * 入口：检查器「数据」分区的「展开」（v3 没有迷你工具条的「编辑数据」，见 overlays.tsx）。收起 → 检查器、数据分区展开，焦点回「展开」；关闭 / Esc → 检查器、数据分区收起，焦点回分区标题。
 * Esc 逐层（panel-keys.ts）：行列菜单先关 → 格内有未提交输入时先放弃（焦点留在格内）→ 再按关闭面板。
 * 选中非图表或点空白时面板收起（与检查器随选中切换同一规则）；评审 / 查看时不出面板。
 */

export const chartInspectorRegion = (ctx: EditorCtx, d: RegionDefaults) => <InspectorSwitch ctx={ctx} d={d} />

function InspectorSwitch({ ctx, d }: { ctx: EditorCtx; d: RegionDefaults }) {
  const [m] = useChart()
  if (m.panel && ctx.selection === "chart" && m.page === "chart" && ctx.mode === "edit") return <DataPanel staticMenu={!!ctx.data.staticGridMenu} />
  return <>{d.inspector()}</>
}

const KEYS: [string, string][] = [
  ["Enter", "提交并下移"],
  ["Tab", "提交并右移"],
  ["Esc", "放弃输入"],
  ["F2", "编辑"],
  ["⇧F10", "行列菜单"],
]

function DataPanel({ staticMenu }: { staticMenu: boolean }) {
  const [m, set] = useChart()
  const st = findSubtype(m.spec)
  const bad = m.invalid
  const close = () => closeDataPanel(set)
  // Esc：先放弃格内输入（DataGrid），再关闭面板、焦点还给触发处；用户打开时焦点进网格首个数值格
  useDataPanelEsc(close)
  useFocusFirstCell()
  return (
    <InspectorTakeover
      label="编辑图表数据"
      title="编辑数据"
      subtitle={st.name}
      width={400}
      onCollapse={() => closeDataPanel(set, "expand")}
      onClose={close}
      escape={false}
      autoFocus={false}
      bodyClassName="flex flex-col gap-3 px-4 py-3"
      footer={
        <>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] leading-4 text-(--v3-text-2)">
            {KEYS.map(([k, label]) => (
              <span key={k} className="flex items-center gap-1.5 whitespace-nowrap">
                <KeyCap>{k}</KeyCap>
                {label}
              </span>
            ))}
          </p>
          <p className="mt-2 text-[12px] leading-[18px] text-(--v3-text-2)">
            <Phrases parts={["可从 Excel 或表格复制整块粘贴（一次撤销步）；", "留空表示缺失值；", "右键类别名或系列名可删除、", "上移或下移（列为左移、右移）。"]} />
          </p>
        </>
      }
    >
      {m.notice && <WorkbookNotice />}
      <DataGrid compact={false} staticMenu={staticMenu} />
      {bad ? (
        <p id="chart-grid-error" role="alert" className="flex items-start gap-1.5 text-[12px] leading-[18px] text-(--v3-danger)">
          <CircleAlert {...ICON} aria-hidden="true" className="mt-px shrink-0" />
          <span>
            {m.data.categories[bad.r]} · {m.data.series[bad.c]?.name}：<span className="whitespace-nowrap">「{bad.text}」</span>不是有效数字，未提交
          </span>
        </p>
      ) : (
        <p className="text-[12px] leading-[18px] text-(--v3-text-2)">{gridNote(m, false)}</p>
      )}
      {m.spec.kind === "pie" && m.data.series.length > 1 && (
        <p className="text-[12px] leading-[18px] text-(--v3-text-2)">
          <Phrases parts={PIE_NOTE_PARTS} />
        </p>
      )}
    </InspectorTakeover>
  )
}
