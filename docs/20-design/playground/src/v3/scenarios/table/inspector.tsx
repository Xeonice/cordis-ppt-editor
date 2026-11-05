import { Bold, Italic } from "lucide-react"
import { ColorChip, Cols, GeometrySection, ICON, inspectorPanel, inspectorSections, len, LENGTH_UNIT, NumberField, StaticRow, type InspectorCtx } from "../../kit"
import { BorderPresetGroup, ColorButton, FillField, Group, LockCheckRow, LockSegmented, LockSelect, LockText, LockToggles, TSection } from "./controls"
import { BORDER_INK, BORDER_PRESETS, findStyle, FLAG_ITEMS, geomOf, paint, pts, sum } from "./model"
import { StyleGallery } from "./StyleGallery"
import { tableData, useTableUi, type SectionKey } from "./store"

/**
 * 检查器分区：选中种类 table（整表选中）与 table-cell（格内编辑或多格选区），由本场景注册（03-30 §6；50/10 §5 R-d-72）。
 *   table      ：table.position 10 · table.style 20 · table.text 30 · table.alt 40
 *   table-cell ：table.cell-style 10（收起）· table.cell 20 · table.cell-text 30 · table.cell-size 40
 * 状态数据见 store.ts 的 TableData（data.table）：里程碑、只读、默认展开的分区、面板标题。
 * 「禁用而不隐藏」：M2 时 M3 的分区留在原位、标题带 M3 标记，控件 aria-disabled、可聚焦、tooltip「M3 提供」。M3 起分区没有标记。
 * 评审 / 查看（mode = review / viewer，或 data.table.readOnly）按 DS-15 只读展示当前值：各节只列属性与值（StaticRow），不画禁用控件，
 * 权限说明由编辑器放在面板顶部一行；样式库不出现，只写当前样式名与勾选的选项。
 * 数值由表格几何换算，与其他对象同一单位（底座 LENGTH_UNIT：样张按 pt 书写、产品按设置的单位显示，rulings §4.25 DS-27）。
 */

const M3_ONLY = "M3 提供"
const NO_EDIT = "需要编辑权限"
const FONTS = ["思源黑体", "苹方", "Inter", "思源宋体", "Arial"]
const WEIGHTS = [
  { value: "bold", label: "粗体", kbd: "⌘B", icon: <Bold {...ICON} /> },
  { value: "italic", label: "斜体", kbd: "⌘I", icon: <Italic {...ICON} /> },
]

function useTable(ctx: InspectorCtx, fallbackOpen: SectionKey[]) {
  const t = tableData(ctx.data)
  const milestone = t.milestone ?? "M2"
  const ro = !!t.readOnly || ctx.readOnly
  const open = t.open ?? fallbackOpen
  return {
    t,
    /** 只读展示（DS-15）：各节只列属性与当前值 */
    ro,
    variant: t.variant ?? "data",
    /** M3 才开放的控件 */
    lockM3: ro ? NO_EDIT : milestone === "M2" ? M3_ONLY : null,
    /** M2 已开放的控件：只有无编辑权限时锁 */
    lockEdit: ro ? NO_EDIT : null,
    /** M2 时 M3 分区标题的标记 */
    tag: milestone === "M2" ? "M3" : undefined,
    isOpen: (k: SectionKey) => open.includes(k),
  }
}

const num = (reason: string | null) => ({ disabled: !!reason, reason: reason ?? undefined })

/* ------------------------------------------------------------------ table：位置与大小 */

/** 位置与大小：底座共用的几何分区（pt，与形状、图片、图表同一套字段；缺省展开）；表格不旋转、不翻转，改尺寸 M3 提供 */
function TablePosition(ctx: InspectorCtx) {
  const { ro, variant, lockM3, lockEdit } = useTable(ctx, ["position", "style"])
  const g = geomOf(variant)
  return (
    <GeometrySection
      anchor="section-table.position"
      readOnly={ro}
      value={{ x: pts(g.x), y: pts(g.y), w: pts(sum(g.cols)), h: pts(g.rows * g.rowH) }}
      disabled={lockEdit ?? undefined}
      sizeDisabled={lockM3 ?? undefined}
      rotate={false}
      note={ro ? undefined : "表格不可旋转或翻转；改尺寸按比例缩放行列"}
    />
  )
}

/* ------------------------------------------------------------------ 表格样式与 6 个标志（table 展开 / table-cell 收起） */

function TableStyleSection(ctx: InspectorCtx) {
  const { t, ro, lockM3, tag, isOpen } = useTable(ctx, ctx.selection === "table" ? ["position", "style"] : ["cell", "text"])
  const [ui, set] = useTableUi()
  const anchor = ctx.selection === "table" ? "section-table.style" : "section-table.cell-style"
  if (ro) {
    const on = FLAG_ITEMS.filter((f) => ui.flags[f.key]).map((f) => f.label)
    return (
      <TSection title="表格样式" defaultOpen={isOpen("style")} anchor={anchor}>
        <StaticRow label="样式">{findStyle(ui.styleId).name}</StaticRow>
        <StaticRow label="选项">{on.length ? on.join("、") : "无"}</StaticRow>
      </TSection>
    )
  }
  return (
    <TSection title="表格样式" tag={tag} defaultOpen={isOpen("style")} anchor={anchor} loose>
      <StyleGallery value={ui.styleId} onChange={(id) => set({ styleId: id })} flags={ui.flags} reason={lockM3} defaultExpanded={!!t.stylesExpanded} />
      <div className="h-px bg-(--v3-border)" />
      <div className="-my-1 grid grid-cols-2 gap-x-2">
        {FLAG_ITEMS.map((f) => (
          <LockCheckRow key={f.key} label={f.label} checked={ui.flags[f.key]} onChange={(v) => set({ flags: { ...ui.flags, [f.key]: v } })} reason={lockM3} />
        ))}
      </div>
    </TSection>
  )
}

/* ------------------------------------------------------------------ 文本（全部 / 所选单元格） */

function TextSection({ ctx, scope }: { ctx: InspectorCtx; scope: "all" | "sel" }) {
  const { t, ro, lockEdit, isOpen } = useTable(ctx, scope === "all" ? ["position", "style"] : ["cell", "text"])
  const title = scope === "all" ? "文本（全部单元格）" : "文本（所选单元格）"
  const anchor = scope === "all" ? "section-table.text" : "section-table.cell-text"
  if (ro)
    return (
      <TSection title={title} defaultOpen={isOpen("text")} anchor={anchor}>
        <StaticRow label="字体">思源黑体</StaticRow>
        <Cols className="gap-y-0">
          <StaticRow label="字号">18 pt</StaticRow>
          <StaticRow label="字形">{t.textBold ? "粗体" : "常规"}</StaticRow>
        </Cols>
      </TSection>
    )
  return (
    <TSection title={title} defaultOpen={isOpen("text")} anchor={anchor}>
      <LockSelect aria="字体" items={FONTS} value="思源黑体" reason={lockEdit} />
      <Cols>
        <NumberField label="字号" defaultValue="18" unit="pt" aria="字号" {...num(lockEdit)} />
        <LockToggles aria="字形" options={WEIGHTS} on={t.textBold ? ["bold"] : []} reason={lockEdit} />
      </Cols>
    </TSection>
  )
}

const TableTextAll = (ctx: InspectorCtx) => <TextSection ctx={ctx} scope="all" />
const TableTextSel = (ctx: InspectorCtx) => <TextSection ctx={ctx} scope="sel" />

/* ------------------------------------------------------------------ table：替代文本 */

function TableAlt(ctx: InspectorCtx) {
  const { ro, lockEdit, isOpen } = useTable(ctx, ["position", "style"])
  if (ro)
    return (
      <TSection title="替代文本" defaultOpen={isOpen("alt")} anchor="section-table.alt">
        <StaticRow label="标题">区域月度营收表</StaticRow>
        <StaticRow label="描述">五个区域 2026 年 4–6 月营收，单位万元</StaticRow>
      </TSection>
    )
  return (
    <TSection title="替代文本" defaultOpen={isOpen("alt")} anchor="section-table.alt">
      <LockText aria="替代文本标题" value="区域月度营收表" reason={lockEdit} />
      <LockText aria="替代文本描述" value="五个区域 2026 年 4–6 月营收，单位万元" multiline reason={lockEdit} />
    </TSection>
  )
}

/* ------------------------------------------------------------------ table-cell：单元格（填充、边框、边距、垂直对齐、文字方向） */

function CellSection(ctx: InspectorCtx) {
  const { ro, variant, lockM3, tag, isOpen } = useTable(ctx, ["cell", "text"])
  const [ui, set] = useTableUi()
  const g = geomOf(variant)
  // 「跟随样式」：色块显示样式算出的颜色（取所选区域第一个正文格）
  const fill = paint(findStyle(ui.styleId), ui.flags, Math.min(1, g.rows - 1), 1, g.rows, g.cols.length).bg
  if (ro)
    return (
      <TSection title="单元格" defaultOpen={isOpen("cell")} anchor="section-table.cell">
        <StaticRow label="填充" leading={<ColorChip color={fill} />}>
          跟随样式
        </StaticRow>
        <StaticRow label="边框" leading={<ColorChip color={BORDER_INK} />}>
          {BORDER_PRESETS.find((b) => b.v === ui.border)?.label ?? "无框线"} · 实线 · {len(1.5)}
        </StaticRow>
        <StaticRow label="边距">左右 {len(7.2)} · 上下 {len(3.6)}</StaticRow>
        <StaticRow label="垂直对齐">顶端</StaticRow>
        <StaticRow label="文字方向">横排</StaticRow>
      </TSection>
    )
  return (
    <TSection title="单元格" tag={tag} defaultOpen={isOpen("cell")} anchor="section-table.cell" loose>
      <Group label="填充">
        <FillField color={fill} text="跟随样式" aria="填充" reason={lockM3} />
      </Group>
      <Group label="边框">
        <BorderPresetGroup value={ui.border} onChange={(b) => set({ border: b })} reason={lockM3} />
        <div className="grid grid-cols-[1fr_88px_28px] gap-2">
          <LockSelect aria="线型" items={["实线", "虚线", "点线"]} value="实线" reason={lockM3} />
          <LockSelect aria="粗细" items={[0.5, 1, 1.5, 2.25, 3].map((v) => len(v))} value={len(1.5)} reason={lockM3} />
          <ColorButton color={BORDER_INK} name="深墨" aria="边框颜色" reason={lockM3} />
        </div>
      </Group>
      <Group label="边距">
        <Cols>
          <NumberField label="左右" defaultValue="7.2" unit={LENGTH_UNIT} aria="左右边距" {...num(lockM3)} />
          <NumberField label="上下" defaultValue="3.6" unit={LENGTH_UNIT} aria="上下边距" {...num(lockM3)} />
        </Cols>
      </Group>
      <Cols>
        <Group label="垂直对齐">
          <LockSegmented
            aria="垂直对齐"
            value="top"
            reason={lockM3}
            options={[
              { value: "top", label: "顶端对齐", text: "顶端" },
              { value: "middle", label: "居中对齐", text: "居中" },
              { value: "bottom", label: "底端对齐", text: "底端" },
            ]}
          />
        </Group>
        <Group label="文字方向">
          <LockSelect aria="文字方向" items={["横排", "所有文字旋转 90°", "所有文字旋转 270°", "堆积"]} value="横排" reason={lockM3} align="end" />
        </Group>
      </Cols>
    </TSection>
  )
}

/* ------------------------------------------------------------------ table-cell：行高与列宽 */

function CellSize(ctx: InspectorCtx) {
  const { t, ro, variant, lockM3, tag, isOpen } = useTable(ctx, ["cell", "text"])
  const g = geomOf(variant)
  const [c0, c1] = t.selCols ?? [0, 0]
  const widths = g.cols.slice(c0, c1 + 1)
  const same = widths.every((w) => w === widths[0])
  if (ro)
    return (
      <TSection title="行高与列宽" defaultOpen={isOpen("size")} anchor="section-table.cell-size">
        <Cols className="gap-y-0">
          <StaticRow label="行高">{len(pts(g.rowH))}</StaticRow>
          <StaticRow label="列宽">{same ? len(pts(widths[0] ?? 0)) : "多个值"}</StaticRow>
        </Cols>
      </TSection>
    )
  return (
    <TSection title="行高与列宽" tag={tag} defaultOpen={isOpen("size")} anchor="section-table.cell-size">
      <Cols>
        <NumberField label="行高" defaultValue={pts(g.rowH)} unit={LENGTH_UNIT} aria="行高" {...num(lockM3)} />
        <NumberField label="列宽" defaultValue={pts(widths[0] ?? 0)} mixed={!same} unit={LENGTH_UNIT} aria="列宽" {...num(lockM3)} />
      </Cols>
    </TSection>
  )
}

/* ------------------------------------------------------------------ 注册 */

inspectorPanel({
  kind: "table",
  title: (ctx) => {
    const g = geomOf(tableData(ctx.data).variant ?? "data")
    return `表格 · ${g.rows} 行 × ${g.cols.length} 列`
  },
})

inspectorPanel({
  kind: "table-cell",
  title: (ctx) => {
    const t = tableData(ctx.data)
    return (
      <>
        {t.cellKind ?? "单元格"}
        {t.cellTitle ? ` · ${t.cellTitle}` : ""}
        {t.cellExtra && <span className="ml-2 text-[12px] font-normal text-(--v3-text-2)">{t.cellExtra}</span>}
      </>
    )
  },
})

inspectorSections([
  { id: "table.position", kinds: ["table"], order: 10, component: TablePosition },
  { id: "table.style", kinds: ["table"], order: 20, component: TableStyleSection },
  { id: "table.text", kinds: ["table"], order: 30, component: TableTextAll },
  { id: "table.alt", kinds: ["table"], order: 40, component: TableAlt },
  { id: "table.cell-style", kinds: ["table-cell"], order: 10, component: TableStyleSection },
  { id: "table.cell", kinds: ["table-cell"], order: 20, component: CellSection },
  { id: "table.cell-text", kinds: ["table-cell"], order: 30, component: TableTextSel },
  { id: "table.cell-size", kinds: ["table-cell"], order: 40, component: CellSize },
])
