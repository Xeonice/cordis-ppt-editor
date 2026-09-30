import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from "react"
import {
  Bold, ChevronDown, Columns2, Grid2x2, Italic, PaintBucket, Plus, Rows2, SquareSplitHorizontal, TableCellsMerge, TableProperties, Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Toggle } from "@/components/ui/toggle"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AppBar, CanvasElementBox, CanvasFloat, DesignBar, EditorShell, Inspector, MiniToolbar, SelectionBox, SlideCanvas, StatusBar, StatusText, ThumbnailRail,
} from "@/components/editor"
import { EditorRibbon, MilestoneTag, ReadonlyRibbonNotice, RibbonTrailing, type InsertPanel, type RibbonTabValue } from "@/components/editor/Ribbon"
import { ignoreDesignBar } from "@/components/editor/ribbon/insert/demo"
import { InsertTableDialog } from "@/components/editor/ribbon/insert/InsertTableDialog"
import { TableGridPicker } from "@/components/editor/ribbon/insert/TableGridPicker"
import { CHART_DISABLED_REASON } from "@/components/editor/elements/chart-model"
import { PlaceholderIconBar, type PlaceholderContentKind } from "@/components/editor/elements/PlaceholderIconBar"
import {
  colX, DEFAULT_ROW_H, defaultFlags, DEFAULT_TABLE_STYLE, rowY, SlideTable, tableH, tableW, toInches,
  type CellAlign, type Merge, type TableFlags, type TableGeom,
} from "@/components/editor/elements/SlideTable"
import {
  borderEdges, NO_EDIT_REASON, TableInspector, type BorderPreset, type TableMetrics,
} from "@/components/editor/elements/TableInspector"
import { collaborators, documentTitle, slides } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

/**
 * 表格编辑（G-32 M2 + G-62 M3；PRD ED-10；50/24 §2；设计稿 docs/20-design/03-screens/30-table-editing.md）。
 * M2：插入网格（8 行 × 10 列）与「插入表格…」对话框、空内容占位符图标条的表格网格（Q2）→ 默认表格填入空内容占位符（Q1），
 * 单元格文本编辑与 Tab 导航、多格选区（文本条 + 条尾禁用的「表格结构 M3」）；检查器按 M2 口径把 M3 控件 aria-disabled 并给原因。
 * M3：悬停「+」插入行列、拖分隔线调列宽、右键菜单（插入 / 删除行列、合并 / 拆分）、合并后效果、边框选择器、样式库（含展开全部 74 种）与 6 个标志。
 * 只有整表选中才画缩放手柄（M3）；格内编辑与单元格选区外框只保持 1.5px 选中框。评审、查看角色：画布不出现插入符、工具条与编辑手柄，
 * 右键菜单照常弹出，编辑类项 aria-disabled 并提示「需要编辑权限」。
 */
type DemoState =
  | "grid" | "placeholder-grid" | "table-dialog" | "table-dialog-error"
  | "inserted" | "cell-nav" | "range" | "m2-range" | "hover-insert" | "resize" | "context-menu" | "m2-menu"
  | "merged" | "borders" | "styles" | "styles-all" | "remote-delete"

const stateOptions: { value: DemoState; label: string }[] = [
  { value: "grid", label: "插入网格 · 3 × 4" },
  { value: "placeholder-grid", label: "占位符 · 表格网格" },
  { value: "table-dialog", label: "插入表格对话框" },
  { value: "table-dialog-error", label: "插入表格对话框 · 超出上限" },
  { value: "inserted", label: "插入后 · 默认表格与首格光标" },
  { value: "cell-nav", label: "单元格编辑 · Tab 导航" },
  { value: "range", label: "单元格选区 · 多选" },
  { value: "m2-range", label: "M2 · 单元格选区" },
  { value: "hover-insert", label: "悬停插入手柄（M3）" },
  { value: "resize", label: "拖分隔线调列宽（M3）" },
  { value: "context-menu", label: "右键菜单 · 行列与合并（M3）" },
  { value: "m2-menu", label: "M2 · 结构编辑灰显" },
  { value: "merged", label: "合并单元格后（M3）" },
  { value: "borders", label: "边框选择器（M3）" },
  { value: "styles", label: "表格样式库 · 6 个标志（M3）" },
  { value: "styles-all", label: "样式库 · 全部 74 种（M3）" },
  { value: "remote-delete", label: "他人删除了正在编辑的行" },
]

/** M2 演示态：检查器按 M2 口径、Ribbon「图表 ▾」禁用（D21 / 50/24 §3.3） */
const M2_STATES = new Set<DemoState>(["grid", "placeholder-grid", "table-dialog", "table-dialog-error", "inserted", "cell-nav", "m2-range", "m2-menu"])
/** 页上还没有表格（空内容占位符）的演示态 */
const EMPTY_STATES = new Set<DemoState>(["grid", "placeholder-grid", "table-dialog", "table-dialog-error"])
/** 整表选中的演示态（检查器 `table`；M3 起带 8 个缩放手柄） */
const WHOLE_TABLE_STATES = new Set<DemoState>(["styles", "styles-all", "remote-delete", "hover-insert", "resize"])
/** 带单元格选区的演示态 */
const RANGE_STATES = new Set<DemoState>(["range", "m2-range", "context-menu", "m2-menu", "borders"])

/** 演示态受控打开的插入页签面板 */
const statePanel: Partial<Record<DemoState, InsertPanel>> = { grid: "table", "table-dialog": "table-dialog", "table-dialog-error": "table-dialog" }
/** 对话框演示初值：12 行超出网格范围；80 行超出暂定上限 75，画出内联报错 */
const dialogDefaults: Partial<Record<DemoState, { rows: number; cols: number }>> = {
  "table-dialog": { rows: 12, cols: 4 },
  "table-dialog-error": { rows: 80, cols: 4 },
}

const DATA: string[][] = [
  ["区域", "Q1", "Q2", "Q3"],
  ["华东", "1,280", "1,420", "1,560"],
  ["华南", "960", "1,040", "1,210"],
  ["华北", "880", "930", "1,010"],
  ["西南", "640", "720", "805"],
]
const TOTAL_ROW = ["合计", "3,760", "4,110", "4,585"]
const MERGED_DATA: string[][] = [
  ["区域", "2026 年季度销售（万元）", "", ""],
  ["", "Q1", "Q2", "Q3"],
  ...DATA.slice(1),
]
const MERGES: Merge[] = [{ r: 0, c: 0, rs: 2, cs: 1 }, { r: 0, c: 1, rs: 1, cs: 3 }]
/** 示例数据的数值列是用户设置的右对齐（新表格按样式默认左对齐） */
const DATA_ALIGN: CellAlign[] = ["left", "right", "right", "right"]

const COLS = [216, 188, 188, 188]
/** 示例数据表的行高（用户拉高过；新表格用默认行高 DEFAULT_ROW_H ≈ 0.41 in） */
const ROW_H = 40
const TABLE_Y = 150
/** 页上的空内容（正文）占位符：新表格填入这里（Q1），宽取占位符框宽 */
const PH_BOX = { x: 90, y: TABLE_Y, w: 780, h: 340 }
/** 占位符左上「• 单击此处添加文本」一行占的高度：图标条在其下方的区域里居中 */
const PH_PROMPT_H = 48
const FILL_TOAST = { description: "填入是一个撤销步；删除内容后占位符恢复为空" }

/** 选区：行列闭区间 */
interface Range { r0: number; r1: number; c0: number; c1: number }
const inRange = (g: Range | null, r: number, c: number) => !!g && r >= g.r0 && r <= g.r1 && c >= g.c0 && c <= g.c1

export function EditorTable() {
  const [demoState, setDemoStateRaw] = useState<DemoState>("inserted")
  const [role, setRole] = useState("owner")
  const [ribbonTab, setRibbonTab] = useState<RibbonTabValue>("insert")
  const [panelOverride, setPanelOverride] = useState<InsertPanel | null | undefined>(undefined)
  const [phPicker, setPhPicker] = useState<PlaceholderContentKind | null>(null)
  const [phDialog, setPhDialog] = useState(false)
  // 对话框没有 DialogTrigger，Radix 关闭时不会自己把焦点还回去：记下打开时的焦点（网格弹层 close() 已把它还给表格图标）
  const phReturn = useRef<HTMLElement | null>(null)
  const [styleId, setStyleId] = useState(DEFAULT_TABLE_STYLE)
  const [flags, setFlags] = useState<TableFlags>(defaultFlags)
  const [border, setBorder] = useState<BorderPreset>("outer")
  const [inserted, setInserted] = useState({ rows: 3, cols: 4 })
  const currentSlide = slides[2]!
  const readOnly = role === "commenter" || role === "viewer"
  const m2 = M2_STATES.has(demoState)
  const empty = EMPTY_STATES.has(demoState)
  const panel = panelOverride !== undefined ? panelOverride : statePanel[demoState] ?? null
  const remote = collaborators.find((c) => !c.isSelf)

  function setDemoState(v: DemoState) {
    setDemoStateRaw(v)
    setPanelOverride(undefined)
    setPhPicker(v === "placeholder-grid" ? "table" : null)
    setPhDialog(false)
    setRibbonTab("insert")
    setFlags(v === "styles" || v === "styles-all" ? { ...defaultFlags, totalRow: true, firstCol: true } : defaultFlags)
    setBorder("outer")
    if (v === "inserted") setInserted({ rows: 3, cols: 4 })
  }

  /**
   * 网格、对话框、占位符图标三个入口走同一条插入：页上有空内容占位符，新表格填入它（Q1），光标进首格。
   * toast：填入占位符（占位符图标入口，或插入页签入口时页上有空内容占位符）用 03-30 §2.3 的占位符 toast；页上没有空占位符时为 03-04 的插入 toast。
   */
  function insertTable(r: number, c: number, fromPlaceholder = false) {
    const fills = fromPlaceholder || empty
    setDemoState("inserted")
    setInserted({ rows: r, cols: c })
    if (fills) toast(`已在占位符插入 ${r} 行 × ${c} 列表格，宽取占位符框宽`, FILL_TOAST)
    else toast(`已插入 ${r} 行 × ${c} 列表格`, { description: "M2 可编辑单元格文字；行列增删、合并与样式在 M3" })
  }

  useEffect(() => {
    if (demoState === "merged") toast("已合并 3 个单元格", { action: { label: "撤销", onClick: () => toast.success("已撤销") } })
    // 恢复是本端的新事务（清除行墓碑、原 id 复活），已提交的键入随行一起回来（30/06 §8、50/04 §6.3）
    if (demoState === "remote-delete") toast(`该行已被 ${remote?.name ?? "一位协作者"} 删除`, { description: "恢复即可找回你在该行的修改", action: { label: "恢复该行", onClick: () => toast.success("已恢复该行") } })
  }, [demoState, remote?.name])

  const hasTotal = demoState === "styles" || demoState === "styles-all"
  const isInserted = demoState === "inserted"
  const rows =
    empty ? [] :
    isInserted ? Array.from({ length: inserted.rows }, () => Array.from({ length: inserted.cols }, () => "")) :
    demoState === "merged" ? MERGED_DATA :
    demoState === "remote-delete" ? DATA.filter((_, i) => i !== 2) :
    hasTotal ? [...DATA, TOTAL_ROW] : DATA
  const cols = isInserted ? Array.from({ length: inserted.cols }, () => PH_BOX.w / inserted.cols) : COLS
  const geom: TableGeom = { x: PH_BOX.x, y: TABLE_Y, cols, rowH: isInserted ? DEFAULT_ROW_H : ROW_H, nRows: rows.length }

  // 评审、查看角色不能进入单元格编辑：没有插入符与单元格选区（设计 03-30 §9）
  const range: Range | null = !readOnly && RANGE_STATES.has(demoState) ? { r0: 1, r1: 2, c0: 1, c1: 2 } : null
  const caret: { r: number; c: number } | null =
    readOnly ? null : isInserted ? { r: 0, c: 0 } : demoState === "cell-nav" ? { r: 2, c: 2 } : null
  const mergedSel = demoState === "merged" && !readOnly
  const wholeTable = WHOLE_TABLE_STATES.has(demoState)
  const cellKind = !readOnly && !empty && !wholeTable

  const nCols = cols.length
  const selectionLabel =
    !cellKind ? `表格（${rows.length} 行 × ${nCols} 列）` :
    range ? "单元格 2 行 × 2 列" :
    mergedSel ? "合并单元格（1 行 × 3 列）" :
    isInserted ? `单元格 · 第 1 行第 1 列（新表格 ${inserted.rows} 行 × ${inserted.cols} 列）` :
    caret ? `单元格 · 第 ${caret.r + 1} 行第 ${caret.c + 1} 列` :
    `表格（${rows.length} 行 × ${nCols} 列）`

  const openSections =
    demoState === "styles" || demoState === "styles-all" ? ["style"] :
    !cellKind ? ["position", "style"] :
    demoState === "borders" ? ["cell"] :
    isInserted ? ["text"] :
    ["cell", "text"]

  const selCols = range ? cols.slice(range.c0, range.c1 + 1) : mergedSel ? cols.slice(1, 4) : [cols[caret?.c ?? 0] ?? 0]
  const metrics: TableMetrics = {
    x: geom.x, y: geom.y, w: tableW(geom), h: tableH(geom), rowH: geom.rowH,
    colW: selCols.every((w) => w === selCols[0]) ? selCols[0]! : null,
  }

  const statusLeft: (string | ReactNode)[] = [`第 ${currentSlide.index}/${slides.length} 页`]
  if (isInserted) statusLeft.push(`已插入 ${inserted.rows} 行 ${inserted.cols} 列表格 · 光标在第一个单元格`)
  if (demoState === "placeholder-grid" && !readOnly) statusLeft.push("选定行列即填入此占位符 · 宽取占位符框宽")
  if (demoState === "cell-nav" && !readOnly) statusLeft.push("单元格编辑中 · 第 3 行第 3 列")
  if (range) statusLeft.push("已选 4 个单元格")
  if (demoState === "resize" && !readOnly) statusLeft.push("拖动调整列宽 · 松开为一个撤销步")

  const emptyNote =
    demoState === "placeholder-grid"
      ? "占位符的表格图标旁弹出与插入页签同一个网格（含「插入表格…」）；选定行列后填入此占位符，宽取占位符框宽，保留占位符身份。"
      : demoState === "grid"
        ? "在「插入 › 表格 ▾」里移动鼠标选择行列数（方向键同样可用，Enter 确认）；网格悬停范围 8 行 × 10 列，更大的表用「插入表格…」输入。页上有空内容占位符，新表格填入它。"
        : "「插入表格…」：行数、列数各 1–75（上限待性能评估，暂按 75 × 75）；非法值在说明行内联报错，「确定」不可用并以 tooltip 给原因。"

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar title="表格编辑" spec="30 · G-32 / G-62 · ED-10" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} role={role} onRoleChange={setRole} />
      <EditorShell
        appBar={<AppBar title={documentTitle} collaborators={collaborators.filter((c) => !c.isSelf)} status={{ kind: "sync", state: "synced" }} />}
        ribbon={
          readOnly ? (
            <ReadonlyRibbonNotice trailing={<RibbonTrailing />}>评审模式下不可编辑表格</ReadonlyRibbonNotice>
          ) : (
            <EditorRibbon
              value={ribbonTab}
              onValueChange={setRibbonTab}
              currentMasterId={currentSlide.masterId}
              currentLayoutId={currentSlide.layoutId}
              insert={{
                panel,
                onPanelChange: setPanelOverride,
                textEditing: !!caret,
                tableHover: { r: 3, c: 4 },
                tableDialogDefaults: dialogDefaults[demoState],
                onPickTable: (r, c) => insertTable(r, c),
                chartDisabledReason: m2 ? CHART_DISABLED_REASON : undefined,
              }}
            />
          )
        }
        thumbnailRail={<ThumbnailRail mode="normal" slides={slides} currentSlideId={currentSlide.id} />}
        canvas={
          <SlideCanvas>
            <CanvasElementBox box={{ x: 90, y: 30, w: 780, h: 56 }} className="flex items-center text-[26px] font-semibold text-doc-ink">区域销售（万元）</CanvasElementBox>
            {empty ? (
              <>
                <CanvasElementBox box={PH_BOX} className="flex items-start rounded-sm border border-dashed border-doc-ink/25 p-4 text-lg text-doc-ink/40">• 单击此处添加文本</CanvasElementBox>
                {/* 空内容占位符的快速插入图标条（G-80；50/21 §3 ③）：表格弹与插入页签同一个网格（Q2），「插入表格…」先关网格再开对话框 */}
                {!readOnly && (
                  <PlaceholderIconBar
                    box={PH_BOX}
                    insetTop={PH_PROMPT_H}
                    kinds={["table", "picture", "chart", "video"]}
                    pickerOpen={phPicker}
                    onPickerOpenChange={setPhPicker}
                    pickers={{
                      table: (close) => (
                        <TableGridPicker
                          initialHover={demoState === "placeholder-grid" ? { r: 3, c: 4 } : undefined}
                          onPick={(r, c) => { close(); insertTable(r, c, true) }}
                          onOpenDialog={() => { close(); phReturn.current = document.activeElement as HTMLElement | null; setPhDialog(true) }}
                        />
                      ),
                    }}
                    onPick={(k) => { if (k === "picture") toast("选择图片文件…（选定后填入此占位符，保留占位符位置）", FILL_TOAST) }}
                  />
                )}
              </>
            ) : (
              <SlideTable
                geom={geom}
                rows={rows}
                styleId={styleId}
                flags={flags}
                merges={demoState === "merged" ? MERGES : []}
                colAlign={isInserted ? undefined : DATA_ALIGN}
                cellClassName={(r, c) => cn(inRange(range, r, c) && "after:pointer-events-none after:absolute after:inset-0 after:bg-[#3A5CE6]/25")}
                cellChildren={(r, c) => {
                  const isCaret = !!caret && caret.r === r && caret.c === c
                  const ring = isCaret || (mergedSel && r === 0 && c === 1)
                  // 标题行是强调色实底：插入符与选中环改用白色，保证可辨
                  const onAccent = flags.headerRow && r < 1
                  return (
                    <>
                      {isCaret && <span className="ml-0.5 inline-block h-5 w-px animate-pulse bg-current" aria-hidden="true" />}
                      {ring && <span className={cn("pointer-events-none absolute inset-0", onAccent ? "shadow-[inset_0_0_0_2px_#fff,inset_0_0_0_4px_#1E3AA8]" : "shadow-[inset_0_0_0_2px_#3A5CE6]")} aria-hidden="true" />}
                    </>
                  )
                }}
              />
            )}

            {/* 表格外框：只有整表选中才有 8 个缩放手柄（M3，graphicFrame 不旋转）；格内编辑、单元格选区与只读角色只保持 1.5px 选中框 */}
            {!empty && (wholeTable && !readOnly
              ? <SelectionBox box={{ x: geom.x, y: geom.y, w: tableW(geom), h: tableH(geom) }} showRotate={false} />
              : <div className="pointer-events-none absolute border-[1.5px] border-primary" style={{ left: geom.x - 1, top: geom.y - 1, width: tableW(geom) + 2, height: tableH(geom) + 2 }} />)}

            {/* 边框选择器态：预览按所选预设画在格边上；该态不画选区外沿描边，免得盖住预览（选区仍有 25% 覆盖） */}
            {range && demoState === "borders" && <BorderPreview geom={geom} range={range} preset={border} />}
            {range && demoState !== "borders" && <RangeOutline geom={geom} range={range} />}

            {!readOnly && demoState === "cell-nav" && <KeyHint geom={geom} />}
            {!readOnly && demoState === "hover-insert" && <InsertHandles geom={geom} />}
            {!readOnly && demoState === "resize" && <ResizeGuide geom={geom} />}

            {caret && <TextMiniToolbar x={geom.x + 150} y={geom.y - 6} />}
            {range && demoState === "range" && <CellToolbar x={colX(geom, 1) + 188} y={geom.y - 6} />}
            {range && demoState === "m2-range" && <TextMiniToolbar x={colX(geom, 1) + 188} y={geom.y - 6} structureM3 />}

            {(demoState === "context-menu" || demoState === "m2-menu") && (
              <TableContextMenu x={colX(geom, 2) + 120} y={rowY(geom, 1) + 22} m2={demoState === "m2-menu"} readOnly={readOnly} />
            )}
          </SlideCanvas>
        }
        inspector={
          <Inspector
            value="properties"
            onValueChange={() => {}}
            readOnly={readOnly}
            tabs={[{
              value: "properties",
              label: "属性",
              content: empty
                ? <div className="cordex-well m-3 mt-2"><div className="cordex-group p-3 text-xs text-pretty text-muted-foreground">{emptyNote}</div></div>
                : (
                  <TableInspector
                    key={`${demoState}-${role}`}
                    kind={cellKind ? "table-cell" : "table"}
                    selectionLabel={selectionLabel}
                    openSections={openSections}
                    styleId={styleId}
                    onStyleChange={(id) => { setStyleId(id); toast("已应用表格样式", { action: { label: "撤销", onClick: () => toast.success("已撤销") } }) }}
                    flags={flags}
                    onFlagsChange={setFlags}
                    border={border}
                    onBorderChange={setBorder}
                    milestone={m2 ? "M2" : "M3"}
                    readOnly={readOnly}
                    metrics={metrics}
                    stylesExpanded={demoState === "styles-all"}
                  />
                ),
            }]}
          />
        }
        statusBar={<StatusBar left={statusLeft} right={[<StatusText key="s" status={{ kind: "sync", state: "synced" }} variant="dot" />]} />}
      />
      {/* 占位符入口的「插入表格…」：网格弹层先关，再开对话框；确定同样填入占位符 */}
      <InsertTableDialog open={phDialog} onOpenChange={setPhDialog} onConfirm={(r, c) => insertTable(r, c, true)} returnFocusRef={phReturn} />
    </div>
  )
}

const rangeBox = (geom: TableGeom, range: Range) => ({
  left: colX(geom, range.c0),
  top: rowY(geom, range.r0),
  width: colX(geom, range.c1 + 1) - colX(geom, range.c0),
  height: rowY(geom, range.r1 + 1) - rowY(geom, range.r0),
})

/** 单元格选区外沿：2px 主色（不只靠颜色，高对比度模式可辨） */
function RangeOutline({ geom, range }: { geom: TableGeom; range: Range }) {
  return <div className="pointer-events-none absolute border-2 border-[#3A5CE6]" style={rangeBox(geom, range)} />
}

/** 边框预览（M3）：按所选预设在选区的外沿与内部格线上画 1.5 磅深色线（线型、粗细、颜色取检查器当前值） */
function BorderPreview({ geom, range, preset }: { geom: TableGeom; range: Range; preset: BorderPreset }) {
  const on = borderEdges(preset)
  const b = rangeBox(geom, range)
  const W = 2.5
  const line = (key: string, style: { left: number; top: number; width: number; height: number }) => (
    <div key={key} className="pointer-events-none absolute bg-[#1A2030]" style={style} />
  )
  const segs: ReactNode[] = []
  if (on.top) segs.push(line("t", { left: b.left - W / 2, top: b.top - W / 2, width: b.width + W, height: W }))
  if (on.bottom) segs.push(line("b", { left: b.left - W / 2, top: b.top + b.height - W / 2, width: b.width + W, height: W }))
  if (on.left) segs.push(line("l", { left: b.left - W / 2, top: b.top - W / 2, width: W, height: b.height + W }))
  if (on.right) segs.push(line("r", { left: b.left + b.width - W / 2, top: b.top - W / 2, width: W, height: b.height + W }))
  if (on.h) for (let r = range.r0 + 1; r <= range.r1; r++) segs.push(line(`h${r}`, { left: b.left, top: rowY(geom, r) - W / 2, width: b.width, height: W }))
  if (on.v) for (let c = range.c0 + 1; c <= range.c1; c++) segs.push(line(`v${c}`, { left: colX(geom, c) - W / 2, top: b.top, width: W, height: b.height }))
  return <>{segs}</>
}

/** 键盘提示（演示用浮签）：跨格导航规则，50/24 §2.6 键盘对照；画在屏幕覆盖层（CanvasFloat），字号不随画布缩放 */
function KeyHint({ geom }: { geom: TableGeom }) {
  const k = (t: string) => <kbd className="rounded border border-foreground/15 bg-foreground/[0.06] px-1 font-sans text-2xs">{t}</kbd>
  return (
    <CanvasFloat x={geom.x} y={geom.y + tableH(geom)} w={tableW(geom)} dy={10} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-1.5 text-xs text-foreground/80">
      <span className="flex items-center gap-1">{k("Tab")} 下一格</span>
      <span className="flex items-center gap-1">{k("⇧ Tab")} 上一格</span>
      <span className="flex items-center gap-1">{k("↑↓←→")} 在首末字符处越界到相邻格</span>
      <span className="flex items-center gap-1">{k("Esc")} 回到表格</span>
      <span className="text-muted-foreground">末格 Tab：M2 留在原格并播报，M3 新增一行</span>
    </CanvasFloat>
  )
}

/** M3：悬停行首 / 列顶边缘出现「+」插入标记，虚线预示插入位置 */
function InsertHandles({ geom }: { geom: TableGeom }) {
  const y = rowY(geom, 3)
  const x = colX(geom, 2)
  const plus = "flex size-5 items-center justify-center rounded-full bg-[#3A5CE6] text-white shadow-md ring-2 ring-white"
  return (
    <>
      <div className="pointer-events-none absolute h-0 border-t-2 border-dashed border-[#3A5CE6]" style={{ left: geom.x, top: y - 1, width: tableW(geom) }} />
      <div className="absolute z-10 flex items-center gap-1" style={{ left: geom.x - 30, top: y - 10 }}>
        <span className={plus} aria-label="在此插入行"><Plus className="size-3.5" strokeWidth={2.5} /></span>
      </div>
      <CanvasFloat x={geom.x} y={geom.y + tableH(geom)} dy={10} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-foreground/85">
        <MilestoneTag>M3</MilestoneTag> 悬停行首或列顶的「+」：点击在第 3、4 行之间插入一行（列顶同理插入列）
      </CanvasFloat>
      {/* 列顶的「+」：鼠标未停留时只显示淡色标记 */}
      <div className="absolute z-10 opacity-45" style={{ left: x - 10, top: geom.y - 30 }}>
        <span className={plus} aria-label="在此插入列"><Plus className="size-3.5" strokeWidth={2.5} /></span>
      </div>
      <div className="pointer-events-none absolute w-0 border-l border-dashed border-[#3A5CE6]/40" style={{ left: x, top: geom.y - 8, height: 8 }} />
    </>
  )
}

/** M3：拖动列分隔线调宽（DragIntent 预览，松手一次命令）；角标按幻灯片坐标换算 in（1 in = 72，与检查器同一换算） */
function ResizeGuide({ geom }: { geom: TableGeom }) {
  const x0 = colX(geom, 1)
  const drag = 40
  const x1 = x0 + drag
  const w0 = geom.cols[0] ?? 0
  return (
    <>
      <div className="pointer-events-none absolute w-0.5 bg-[#3A5CE6]/35" style={{ left: x0 - 1, top: geom.y, height: tableH(geom) }} />
      <div className="pointer-events-none absolute w-0 border-l-2 border-dashed border-[#3A5CE6]" style={{ left: x1 - 1, top: geom.y - 10, height: tableH(geom) + 20 }} />
      <div className="absolute z-10 flex size-6 items-center justify-center rounded-full bg-[#1A2030] text-white shadow-md ring-2 ring-white" style={{ left: x1 - 12, top: geom.y + tableH(geom) / 2 - 12 }} aria-hidden="true">
        <Columns2 className="size-3.5" />
      </div>
      <CanvasFloat x={x1} y={geom.y + tableH(geom)} dx={10} dy={10} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs tabular-nums text-foreground/85">
        第 1 列宽 {toInches(w0)} in → {toInches(w0 + drag)} in · 右侧列等量收窄 <MilestoneTag>M3</MilestoneTag>
      </CanvasFloat>
    </>
  )
}

/**
 * 文本编辑迷你工具条（M2）：字体、字号、加粗、斜体，字不小于 12px（按屏幕尺寸绘制，见 MiniToolbar）。
 * `structureM3`：M2 单元格选区的条尾挂 aria-disabled 的「表格结构 M3」入口，tooltip 给原因；M3 起整条换成 toolbar.table-cell（50/24 §2.6、50/10 §5）。
 */
function TextMiniToolbar({ x, y, structureM3 }: { x: number; y: number; structureM3?: boolean }) {
  return (
    <MiniToolbar x={x} y={y}>
      <span className="px-1.5 text-xs text-foreground/80">微软雅黑</span>
      <span className="px-1 text-xs text-muted-foreground tabular-nums">14</span>
      <Toggle size="sm" aria-label="加粗" className="size-6"><Bold className="size-3.5" /></Toggle>
      <Toggle size="sm" aria-label="斜体" className="size-6"><Italic className="size-3.5" /></Toggle>
      {structureM3 && (
        <>
          <span className="mx-0.5 h-4 w-px bg-foreground/10" aria-hidden="true" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                aria-disabled="true"
                aria-label="表格结构（M3 提供）"
                onClick={(e) => e.preventDefault()}
                className="h-6 cursor-not-allowed gap-1 px-1.5 text-xs font-normal hover:bg-transparent active:translate-y-0"
              >
                <span className="flex items-center gap-1 opacity-50"><TableProperties className="size-3.5" />表格结构</span>
                <MilestoneTag>M3</MilestoneTag>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">表格结构编辑将在后续版本提供</TooltipContent>
          </Tooltip>
        </>
      )}
    </MiniToolbar>
  )
}

/** M3：单元格选区迷你工具条 toolbar.table-cell（插入行列、合并、拆分、填充、边框） */
function CellToolbar({ x, y }: { x: number; y: number }) {
  const b = (icon: ReactNode, label: string, caret?: boolean) => (
    <Button variant="ghost" size="xs" className="h-6 gap-1 px-1.5 text-xs font-normal" onClick={() => toast(`${label}（M3）`)}>
      {icon}{label}{caret && <ChevronDown className="size-3 text-muted-foreground" />}
    </Button>
  )
  return (
    <MiniToolbar x={x} y={y}>
      <MilestoneTag className="mx-1">M3</MilestoneTag>
      {b(<Plus className="size-3.5" />, "插入", true)}
      {b(<TableCellsMerge className="size-3.5" />, "合并")}
      {b(<SquareSplitHorizontal className="size-3.5" />, "拆分")}
      <span className="mx-0.5 h-4 w-px bg-foreground/10" aria-hidden="true" />
      {b(<PaintBucket className="size-3.5" />, "填充", true)}
      {b(<Grid2x2 className="size-3.5" />, "边框", true)}
    </MiniToolbar>
  )
}

/** 表格右键菜单项的类别：决定不可用时的原因（设计 03-30 图 6：先看权限，再看里程碑，再看选区条件） */
type MenuKind = "copy" | "edit" | "struct" | "split" | "delete-table"

const SPLIT_REASON = "只有合并过的单元格可以拆分"

/**
 * 右键菜单（设计 03-05 表格单元格变体、03-30 §5.3）：剪贴板（剪切、复制、粘贴、删除文本）┊ 插入行列（M3）┊ 合并、拆分 ┊ 删除行列、删除表格。
 * 不可用项一律 aria-disabled（仍可聚焦，键盘可达）、onSelect 里拦截：
 * M2 的结构项以菜单内常驻说明行给原因（aria-describedby 指向该行）；「删除表格」M2 可用（同整表选中按 Delete）；
 * 普通格的「拆分单元格…」tooltip「只有合并过的单元格可以拆分」；无编辑权限时除「复制」外全部 tooltip「需要编辑权限」。
 */
function TableContextMenu({ x, y, m2, readOnly, mergedCell = false }: { x: number; y: number; m2: boolean; readOnly: boolean; mergedCell?: boolean }) {
  const [open, setOpen] = useState(true)
  useEffect(() => setOpen(true), [m2, readOnly])
  const noteId = useId()
  /** null：可用；tip=false：原因在常驻说明行 */
  const reasonOf = (k: MenuKind): { text: string; tip: boolean } | null => {
    if (k === "copy") return null
    if (readOnly) return { text: NO_EDIT_REASON, tip: true }
    if (k === "edit" || k === "delete-table") return null
    if (m2) return { text: "M3", tip: false }
    if (k === "split" && !mergedCell) return { text: SPLIT_REASON, tip: true }
    return null
  }
  const item = (icon: ReactNode, label: string, kind: MenuKind, opts: { shortcut?: string; destructive?: boolean; done?: string } = {}) => {
    const why = reasonOf(kind)
    const el = (
      <DropdownMenuItem
        variant={opts.destructive ? "destructive" : "default"}
        aria-disabled={why ? true : undefined}
        aria-describedby={why && !why.tip ? noteId : undefined}
        onSelect={(e) => {
          if (why) { e.preventDefault(); return }
          if (kind === "copy") toast(opts.done ?? label)
          else toast(opts.done ?? label, { action: { label: "撤销", onClick: () => toast.success("已撤销") } })
        }}
        className={cn(why && "cursor-not-allowed focus:bg-foreground/[0.04] data-[variant=destructive]:focus:bg-foreground/[0.04]")}
      >
        <span className={cn("flex items-center gap-2", why && "opacity-50")}>{icon}{label}</span>
        {opts.shortcut && <DropdownMenuShortcut className={cn(why && "opacity-50")}>{opts.shortcut}</DropdownMenuShortcut>}
      </DropdownMenuItem>
    )
    if (!why?.tip) return <Fragment key={label}>{el}</Fragment>
    return (
      <Tooltip key={label}>
        <TooltipTrigger asChild>{el}</TooltipTrigger>
        <TooltipContent side="right" className="max-w-60 text-pretty">{why.text}</TooltipContent>
      </Tooltip>
    )
  }
  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <span className="absolute size-px" style={{ left: x, top: y }} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" sideOffset={2} collisionPadding={{ bottom: 48, top: 8 }} className="w-60" onInteractOutside={ignoreDesignBar} onCloseAutoFocus={(e) => e.preventDefault()}>
        {item(null, "剪切", "edit", { shortcut: "⌘X", done: "已剪切" })}
        {item(null, "复制", "copy", { shortcut: "⌘C", done: "已复制" })}
        {item(null, "粘贴", "edit", { shortcut: "⌘V", done: "已粘贴" })}
        {item(null, "删除文本", "edit", { shortcut: "⌫", done: "已清空所选单元格的文字" })}
        <DropdownMenuSeparator />
        {m2 && !readOnly ? (
          <DropdownMenuLabel id={noteId} className="flex items-start gap-1.5 text-xs font-normal text-muted-foreground">
            <MilestoneTag className="mt-px">M3</MilestoneTag><span className="text-pretty">表格结构编辑将在后续版本提供；当前可编辑单元格文字与字符格式</span>
          </DropdownMenuLabel>
        ) : (
          <DropdownMenuLabel className="flex items-center gap-1.5 text-2xs font-medium text-muted-foreground">插入 <MilestoneTag>M3</MilestoneTag></DropdownMenuLabel>
        )}
        {item(<Rows2 />, "在上方插入行", "struct")}
        {item(<Rows2 />, "在下方插入行", "struct")}
        {item(<Columns2 />, "在左侧插入列", "struct")}
        {item(<Columns2 />, "在右侧插入列", "struct")}
        <DropdownMenuSeparator />
        {item(<TableCellsMerge />, "合并单元格", "struct")}
        {item(<SquareSplitHorizontal />, "拆分单元格…", "split")}
        <DropdownMenuSeparator />
        {item(<Trash2 />, "删除行", "struct", { destructive: true })}
        {item(<Trash2 />, "删除列", "struct", { destructive: true })}
        {item(<Trash2 />, "删除表格", "delete-table", { destructive: true, done: "已删除表格" })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
