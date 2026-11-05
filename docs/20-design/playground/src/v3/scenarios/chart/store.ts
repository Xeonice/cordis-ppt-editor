import { useCallback } from "react"
import { useEditorMaybe, useSceneState, type EditorCtx, type SelectionKind } from "../../kit"
import {
  cloneData, convertData, COLUMN, DEFAULT_OPTIONS, findSubtype, sampleData, type ChartData, type ChartKind, type ChartOptions, type ChartSpec, type ChartSubtype,
} from "./model"

/**
 * 图表场景的运行时状态（kit useSceneState：画布、左栏缩略图、检查器分区、数据面板、菜单与轻提示读写同一份；换状态时编辑器重新挂载，状态随之复位）。
 * 每个场景状态用 EditorConfig.data.chart 给初值（Partial<ChartModel>）。
 */

/** 第 5 页上画的是什么：empty 空内容占位符（插入流程）· chart 可编辑五类之一 · radar 只读类型（非五类）· m2 「两栏内容」左栏导入的图表 + 右栏空占位符 */
export type ChartPageKind = "empty" | "chart" | "radar" | "m2"

export interface ToastSpec {
  title: string
  description?: string
  /** 文字按钮：撤销 / 查看保真详情 / 知道了… */
  action?: string
  tone?: "neutral" | "info"
  /** 「撤销」恢复到的状态（含选中种类） */
  undo?: { model: Partial<ChartModel>; selection: SelectionKind }
}

export interface ChartModel {
  page: ChartPageKind
  spec: ChartSpec
  options: ChartOptions
  data: ChartData
  /** 导入的图表（有图表部件与内嵌工作簿） */
  imported: boolean
  /** 导入部件里还有会被「切到饼图」丢弃的内容（坐标轴格式、趋势线）；确认切换后清掉 */
  droppable: boolean
  /** 原工作簿提示（50/24 §3.10）：首次提交数据或点「知道了」后不再出 */
  notice: boolean
  /** 数据面板（检查器坞加宽，整栏换成完整网格） */
  panel: boolean
  /** 检查器「数据」分区展开 */
  dataOpen: boolean
  /** 检查器「类型」下拉（ChartTypeMenu）打开；flyout 是静态展开的子类型 */
  typeMenu: boolean
  typeFlyout: ChartKind | null
  /** 下拉内确认：选了会丢弃导入内容的子类型，菜单不关、底部出确认段 */
  pending: ChartSubtype | null
  /** 演示的焦点格（插入后首个数值格）：用户点了任一格后清掉 */
  focus: { r: number; c: number } | null
  /** 非法输入（不提交）：r 类别行、c 系列列 */
  invalid: { r: number; c: number; text: string } | null
  /** 行列右键菜单打开的那一行 / 列（表头格高亮） */
  gridMenu: { axis: "row" | "col"; index: number } | null
  /** 占位符图标条 › 图表的类型菜单 */
  phMenu: boolean
  toast: ToastSpec | null
  altTitle: string
  altDesc: string
}

export const DEFAULT_MODEL: ChartModel = {
  page: "chart",
  spec: COLUMN,
  options: DEFAULT_OPTIONS,
  data: sampleData("column"),
  imported: false,
  droppable: false,
  notice: false,
  panel: false,
  dataOpen: false,
  typeMenu: false,
  typeFlyout: null,
  pending: null,
  focus: null,
  invalid: null,
  gridMenu: null,
  phMenu: false,
  toast: null,
  altTitle: "",
  altDesc: "",
}

export const chartInit = (data: Record<string, unknown> | undefined): Partial<ChartModel> => {
  const c = data?.chart
  return c && typeof c === "object" ? (c as Partial<ChartModel>) : {}
}

export type SetChart = (patch: Partial<ChartModel> | ((m: ChartModel) => Partial<ChartModel>)) => void

export function useChart(): [ChartModel, SetChart] {
  const ed = useEditorMaybe()
  const [m, setM] = useSceneState<ChartModel>("chart.model", () => ({ ...DEFAULT_MODEL, ...chartInit(ed?.data) }))
  const set = useCallback<SetChart>((p) => setM((cur) => ({ ...cur, ...(typeof p === "function" ? p(cur) : p) })), [setM])
  return [m, set]
}

/** 撤销快照：只取会被操作改动的字段 */
const snap = (m: ChartModel): Partial<ChartModel> => ({ page: m.page, spec: m.spec, options: m.options, data: cloneData(m.data), droppable: m.droppable, dataOpen: m.dataOpen, panel: m.panel })

/** 插入（从工具条「图表」或占位符图标条选子类型）：填入空内容占位符，一个撤销步；选中图表、展开「数据」、焦点在首个数值格 */
export function insertChart(m: ChartModel, set: SetChart, ed: EditorCtx, st: ChartSubtype) {
  const undo = { model: snap(m), selection: ed.selection }
  set({
    page: "chart",
    spec: { kind: st.kind, variant: st.variant },
    options: DEFAULT_OPTIONS,
    data: sampleData(st.kind),
    imported: false,
    droppable: false,
    notice: false,
    panel: false,
    dataOpen: true,
    focus: { r: 0, c: 0 },
    invalid: null,
    typeMenu: false,
    pending: null,
    phMenu: false,
    altTitle: "",
    altDesc: "",
    // 「数据面板」只指 DS-26 加宽到 400 的那一栏；插入后展开的是检查器「数据」分区（rulings §4.25 TB-12）
    toast: { title: `已插入${st.name}`, description: "示例数据已写入，已展开数据", action: "撤销", undo },
  })
  ed.setTool("select")
  ed.setSelection("chart")
}

/** 更改类型：点当前项无动作；导入的图表切到饼图会丢弃部件内容时先确认（返回 false：下拉保持打开） */
export function requestType(m: ChartModel, set: SetChart, ed: EditorCtx, st: ChartSubtype): boolean {
  if (st.kind === m.spec.kind && st.variant === m.spec.variant) {
    set({ typeMenu: false })
    return true
  }
  if (m.droppable && st.kind === "pie" && m.spec.kind !== "pie") {
    set({ pending: st })
    return false
  }
  applyType(m, set, ed, st)
  return true
}

export function applyType(m: ChartModel, set: SetChart, ed: EditorCtx, st: ChartSubtype) {
  const undo = { model: snap(m), selection: ed.selection }
  const next: ChartSpec = { kind: st.kind, variant: st.variant }
  set({
    spec: next,
    data: convertData(m.data, st.kind),
    // 确认过的切换已清掉部件里会丢弃的内容，之后再切不再确认
    droppable: m.pending ? false : m.droppable,
    pending: null,
    typeMenu: false,
    toast: { title: `已更改为${findSubtype(next).name}`, action: "撤销", undo },
  })
}

/** 轻提示上的「撤销」 */
export function undoToast(m: ChartModel, set: SetChart, ed: EditorCtx) {
  const u = m.toast?.undo
  if (!u) return set({ toast: null })
  set({ ...u.model, toast: null, focus: null, invalid: null })
  ed.setSelection(u.selection)
}

/** 双击图表或图表聚焦时按 Enter（50/24 §3.6）：只展开检查器「数据」分区，焦点到首个数值格 */
export function openDataSection(set: SetChart) {
  set({ dataOpen: true, panel: false, focus: null })
  window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-chart-grid] input[inputmode="decimal"]')?.focus(), 60)
}

/** 提交一格（Enter / 失焦）：非法输入停在格上、不产生命令；合法输入只写这一格，首次提交后原工作簿提示不再出 */
export function commitCell(m: ChartModel, set: SetChart, r: number, c: number, text: string, original: string, parse: (t: string) => number | null | undefined) {
  if (text === original) {
    if (m.invalid && m.invalid.r === r && m.invalid.c === c) set({ invalid: null })
    return
  }
  const next = cloneData(m.data)
  if (r === -1 && c >= 0) next.series[c]!.name = text
  else if (c === -1) next.categories[r] = text
  else {
    const v = parse(text)
    if (v === undefined) {
      set({ invalid: { r, c, text } })
      return
    }
    if (c === -2 && next.x) next.x[r] = v ?? 0
    else next.series[c]!.values[r] = v
  }
  set({ data: next, notice: false, invalid: m.invalid && m.invalid.r === r && m.invalid.c === c ? null : m.invalid })
}
