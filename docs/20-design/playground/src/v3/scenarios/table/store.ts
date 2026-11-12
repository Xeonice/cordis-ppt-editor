import { useCallback } from "react"
import { useEditorMaybe, useSceneState } from "../../kit"
import { DEFAULT_FLAGS, DEFAULT_STYLE, type BorderPreset, type Flags, type Variant } from "./model"

/** 检查器分区的键（决定各状态默认展开哪些分区，03-30 §2.4、§3、§6） */
export type SectionKey = "position" | "style" | "cell" | "text" | "size" | "alt"

/**
 * 状态私有数据（EditorConfig.data.table）。别的场景设 selection: "table" / "table-cell" 复用本场景的分区时，
 * 不传也能显示（缺省 M2、示例数据表）；要 M3 形态就传 { table: { milestone: "M3" } }。
 */
export interface TableData {
  /** 页上表格的形态（决定行列数、几何与「位置与大小」的数值） */
  variant?: Variant
  /** 里程碑：M2 时 M3 的控件 aria-disabled、tooltip「M3 提供」，分区标题带 M3 标记 */
  milestone?: "M2" | "M3"
  /** 评审 / 查看角色：编辑类控件 aria-disabled，原因「需要编辑权限」（权限先于里程碑） */
  readOnly?: boolean
  /** 默认展开的分区 */
  open?: SectionKey[]
  /** table-cell 面板标题，如「第 3 行第 3 列」「2 行 × 2 列」；cellKind 缺省「单元格」 */
  cellTitle?: string
  cellKind?: string
  /** 标题后的灰字，如「新表格 3 × 4」 */
  cellExtra?: string
  /** 选区覆盖的列（0 起，含两端）：决定「列宽」，宽度不一致时显示「多个值」 */
  selCols?: [number, number]
  /** 所选文字已加粗（标题行由样式加粗），文本分区的「粗体」显示为按下 */
  textBold?: boolean
  styleId?: string
  flags?: Partial<Flags>
  /** 样式库默认展开全部 74 种 */
  stylesExpanded?: boolean
  border?: BorderPreset
  /** 插入网格弹层一出现就是打开的 */
  gridOpen?: boolean
}

export function tableData(data: Record<string, unknown> | undefined): TableData {
  const t = data?.table
  return t && typeof t === "object" ? (t as TableData) : {}
}

/** 运行中可改的表格界面状态：样式、6 个标志、边框预设（画布、缩略图、检查器读同一份）与网格弹层开关 */
export interface TableUi {
  styleId: string
  flags: Flags
  border: BorderPreset
  gridOpen: boolean
}

/**
 * 检查器、画布、左栏缩略图读写同一份（kit useSceneState：同一次编辑器挂载里共享，换状态时编辑器重新挂载，界面状态随之复位）。
 * 别的场景设 selection: "table" 复用本场景的分区时也一样能用。
 */
export function useTableUi(): [TableUi, (patch: Partial<TableUi>) => void] {
  const ed = useEditorMaybe()
  const [ui, setUi] = useSceneState<TableUi>("table.ui", () => {
    const t = tableData(ed?.data)
    return { styleId: t.styleId ?? DEFAULT_STYLE, flags: { ...DEFAULT_FLAGS, ...t.flags }, border: t.border ?? "outer", gridOpen: !!t.gridOpen }
  })
  const set = useCallback((patch: Partial<TableUi>) => setUi((cur) => ({ ...cur, ...patch })), [setUi])
  return [ui, set]
}
