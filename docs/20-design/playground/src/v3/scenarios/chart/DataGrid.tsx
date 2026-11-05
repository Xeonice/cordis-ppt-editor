import { type KeyboardEvent, type ReactNode } from "react"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ContextMenu, ICON, Tip, type MenuSpec } from "../../kit"
import { cloneData, COMPACT, fmt, parseValue, PIE_NOTE_LONG, seriesColor } from "./model"
import { cellDirty } from "./panel-keys"
import { commitCell, useChart, type ChartModel, type SetChart } from "./store"

/**
 * 图表数据网格（03-31「数据网格」；50/24 §3.6；产品实现为 @tanstack/react-table 无头表 + DataGrid 封装，50/17 §7）。
 * 行 = 类别、列 = 系列（散点多一列 X 值）；首列类别名、首行系列名可编辑；末行「+ 新增类别」、末列「+」新增系列。
 * compact：检查器「数据」分区里的紧凑形态（行高 28、只显示前 8 × 4，截断方向不出「+」）；否则是数据面板里的完整形态（行高 32、列最小宽 72、超宽横向滚动）。
 * 紧凑形态的列宽按 280 检查器算（网格内宽 245）：类别列 58 放得下 4 个汉字（「第一季度」），末列「+」22，3 个系列时每列 55，
 * 「系列 1」这类默认名放得下（Q7）；更长的名字以省略号收尾、悬停 title 显示全名，完整内容在数据面板里看。
 * 系列表头：8px 色块紧贴名字左侧、整体右对齐（与下方数值同一右缘）；宽列里色块也不会离名字很远。
 * 每格是真实输入框：Enter 提交并下移、Tab 提交并右移、Esc 放弃本格输入（焦点留在格内；格里没有未提交的输入时 Esc 交给面板，关闭它）；非法输入 aria-invalid、不提交（错误行在数据面板里）。
 * 类别格与系列表头带行列菜单（右键，或聚焦后 Shift+F10 / ContextMenu 键）：上移 / 下移（列为左移 / 右移）、删除；到边或只剩一个的项不可用并写原因。
 * 饼图：第二列起是没画出的系列——表头与数值降为 text-2、色块变淡，表头悬停给原因（不降透明度，保持 AA 对比度，DS-9）。
 * readOnly（评审 / 查看，DS-15）：只读表格，不画输入框外形，没有「+」与菜单。
 */

const SEL_RING = "shadow-[inset_0_0_0_2px_var(--v3-accent)] bg-(--v3-panel)"
const BAD = "bg-(--v3-danger-soft) text-(--v3-danger) shadow-[inset_0_0_0_2px_var(--v3-danger)]"
const EDIT_FOCUS = "focus:bg-(--v3-panel) focus:shadow-[inset_0_0_0_2px_var(--v3-accent)]"

/** 在单元格上模拟一次右键（Shift+F10 / ContextMenu 键）：kit ContextMenu 在指针处打开 */
function openMenuAt(el: Element | null) {
  if (!el) return
  const r = el.getBoundingClientRect()
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 8, clientY: r.bottom - 2 }))
}

function swap<T>(arr: T[], i: number, j: number) {
  const t = arr[i]!
  arr[i] = arr[j]!
  arr[j] = t
}

function gridMenuItems(m: ChartModel, set: SetChart): MenuSpec[] {
  const g = m.gridMenu
  if (!g) return []
  const d = m.data
  const scatter = !!d.x
  const unit = scatter ? "点" : "类别"
  const toast = (title: string, prev: ChartModel) => ({ title, action: "撤销", undo: { model: { data: cloneData(prev.data) }, selection: "chart" as const } })
  if (g.axis === "row") {
    const r = g.index
    const n = d.categories.length
    const name = d.categories[r] ?? ""
    const move = (dir: -1 | 1) => {
      const next = cloneData(d)
      swap(next.categories, r, r + dir)
      if (next.x) swap(next.x, r, r + dir)
      next.series.forEach((s) => swap(s.values, r, r + dir))
      set({ data: next, gridMenu: null })
    }
    return [
      { type: "label", label: `${unit}「${name}」` },
      { id: "up", label: "上移", icon: <ArrowUp {...ICON} />, disabled: r === 0, reason: r === 0 ? `已是第一个${unit}` : undefined, onSelect: () => move(-1) },
      { id: "down", label: "下移", icon: <ArrowDown {...ICON} />, disabled: r === n - 1, reason: r === n - 1 ? `已是最后一个${unit}` : undefined, onSelect: () => move(1) },
      { type: "separator" },
      {
        id: "delete",
        label: scatter ? "删除点" : "删除类别",
        icon: <Trash2 {...ICON} />,
        danger: true,
        disabled: n === 1,
        reason: n === 1 ? `图表至少保留一个${unit}` : undefined,
        onSelect: () => {
          const next = cloneData(d)
          next.categories.splice(r, 1)
          next.x?.splice(r, 1)
          next.series.forEach((s) => s.values.splice(r, 1))
          set({ data: next, gridMenu: null, invalid: null, toast: toast(`已删除${unit}「${name}」`, m) })
        },
      },
    ]
  }
  const c = g.index
  const n = d.series.length
  const name = d.series[c]?.name ?? ""
  const move = (dir: -1 | 1) => {
    const next = cloneData(d)
    swap(next.series, c, c + dir)
    set({ data: next, gridMenu: null })
  }
  return [
    { type: "label", label: `系列「${name}」` },
    { id: "left", label: "左移", icon: <ArrowLeft {...ICON} />, disabled: c === 0, reason: c === 0 ? "已是第一个系列" : undefined, onSelect: () => move(-1) },
    { id: "right", label: "右移", icon: <ArrowRight {...ICON} />, disabled: c === n - 1, reason: c === n - 1 ? "已是最后一个系列" : undefined, onSelect: () => move(1) },
    { type: "separator" },
    {
      id: "delete",
      label: "删除系列",
      icon: <Trash2 {...ICON} />,
      danger: true,
      disabled: n === 1,
      reason: n === 1 ? "图表至少保留一个系列" : undefined,
      onSelect: () => {
        const next = cloneData(d)
        next.series.splice(c, 1)
        set({ data: next, gridMenu: null, invalid: null, toast: toast(`已删除系列「${name}」`, m) })
      },
    },
  ]
}

export function DataGrid({ compact, readOnly = false, staticMenu = false }: { compact: boolean; readOnly?: boolean; /** 状态里一出现就打开行列菜单（gridMenu 指定的那一行 / 列） */ staticMenu?: boolean }) {
  const [m, set] = useChart()
  const d = m.data
  const scatter = !!d.x
  const pie = m.spec.kind === "pie"
  const nCat = d.categories.length
  const nSer = d.series.length
  const rowCount = compact ? Math.min(nCat, COMPACT.rows) : nCat
  const colCount = compact ? Math.min(nSer, COMPACT.cols) : nSer
  const rowsCut = rowCount < nCat
  const colsCut = colCount < nSer
  const canAdd = !readOnly
  const faded = (c: number) => pie && c >= 1
  const rowH = compact ? "h-7" : "h-8"
  const firstW = compact ? 58 : 84
  const xW = compact ? 48 : 72
  const plusW = compact ? 22 : 28
  const plusCol = canAdd && !colsCut
  const minWidth = compact ? undefined : firstW + (scatter ? xW : 0) + colCount * 72 + (plusCol ? plusW : 0)
  const unit = scatter ? "点" : "类别"
  /** 类别列（与左上角「类别」表头同一内边距） */
  const catPad = compact ? "px-1" : "px-1.5"
  /** 数值列与系列表头同一右内边距：名字与下方数值右缘对齐 */
  const numPad = compact ? "pr-1 pl-1.5" : "px-1.5"
  const headPad = compact ? "pr-1 pl-[3px]" : "px-1.5"

  const onKeys = (r: number, c: number, value: string, kind: "num" | "cat" | "ser") => (e: KeyboardEvent<HTMLInputElement>) => {
    const t = e.currentTarget
    if (e.key === "Enter") {
      e.preventDefault()
      commitCell(m, set, r, c, t.value, value, parseValue)
      // 提交并下移：同一列的下一行（表头 → 第 1 行）
      const next = t.closest("table")?.querySelector<HTMLInputElement>(`input[data-cell="${r + 1}:${c}"]`)
      if (next) next.focus()
      else t.blur()
    } else if (e.key === "Escape") {
      // 编辑中（值改过、或是没提交的非法输入）：这一下 Esc 只放弃本格输入、焦点留在格内（不 blur，焦点不掉到 body），面板不动；
      // 没在编辑：不接手，Esc 继续往上由面板关闭（panel-keys useDataPanelEsc，03-31「Esc 只在没有格处于编辑中时生效」）
      if (!cellDirty(t)) return
      e.preventDefault()
      e.stopPropagation()
      t.value = value
      if (m.invalid && m.invalid.r === r && m.invalid.c === c) {
        // 非法输入的格带 key（含没提交的文本），清掉后会整格重挂：下一帧把焦点放回新的输入框，不掉到 body
        set({ invalid: null })
        window.requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`input[data-cell="${r}:${c}"]`)?.focus({ preventScroll: true }))
      }
    } else if (kind !== "num" && ((e.shiftKey && e.key === "F10") || e.key === "ContextMenu")) {
      e.preventDefault()
      openMenuAt(t.closest("[data-v3-anchor]"))
    }
  }

  /** 类别格、数值格（X 值同）：整格就是输入框 */
  const cell = (r: number, c: number, value: string, kind: "num" | "cat") => {
    const bad = m.invalid && m.invalid.r === r && m.invalid.c === c ? m.invalid : null
    const ring = m.focus && m.focus.r === r && m.focus.c === c
    const name = c === -1 ? `${unit}名 ${r + 1}` : `${d.categories[r]} · ${c === -2 ? "X" : d.series[c]?.name}`
    const pad = kind === "num" ? cn(numPad, "text-right tabular-nums") : cn(catPad, "text-left")
    if (readOnly)
      return (
        <span className={cn("block truncate leading-7", pad)} title={kind === "cat" ? value : undefined}>
          {value}
        </span>
      )
    return (
      <input
        key={`${r}:${c}:${value}:${bad ? bad.text : ""}`}
        data-cell={`${r}:${c}`}
        defaultValue={bad ? bad.text : value}
        aria-label={name}
        aria-invalid={bad ? true : undefined}
        aria-describedby={bad && !compact ? "chart-grid-error" : undefined}
        title={kind === "cat" && value ? value : undefined}
        inputMode={kind === "num" ? "decimal" : undefined}
        spellCheck={false}
        onFocus={() => m.focus && set({ focus: null })}
        onBlur={(e) => commitCell(m, set, r, c, e.currentTarget.value, value, parseValue)}
        onKeyDown={onKeys(r, c, value, kind)}
        className={cn("block w-full min-w-0 bg-transparent text-[12px] text-ellipsis text-(--v3-text) outline-none focus-visible:outline-none", EDIT_FOCUS, rowH, pad, ring && SEL_RING, bad && BAD)}
      />
    )
  }

  /** 系列表头：色块 + 名字（可编辑）整体右对齐；输入框按内容定宽（field-sizing），放不下时收缩并以省略号收尾，点整格任意处都进编辑 */
  const seriesHead = (c: number, value: string): ReactNode => {
    const chip = <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-[2px]", faded(c) && "opacity-40")} style={{ backgroundColor: seriesColor(c) }} />
    const tone = faded(c) ? "text-(--v3-text-2)" : "text-(--v3-text)"
    if (readOnly)
      return (
        <span className={cn("flex min-w-0 items-center justify-end gap-[3px] leading-7", headPad, tone)} title={value}>
          {chip}
          <span className="truncate font-medium">{value}</span>
        </span>
      )
    return (
      <label
        className={cn(
          "flex w-full min-w-0 cursor-text items-center justify-end gap-[3px] focus-within:bg-(--v3-panel) focus-within:shadow-[inset_0_0_0_2px_var(--v3-accent)]",
          headPad,
          rowH,
        )}
      >
        {chip}
        <input
          key={`-1:${c}:${value}`}
          data-cell={`-1:${c}`}
          defaultValue={value}
          aria-label={`系列名 ${c + 1}`}
          title={value || undefined}
          spellCheck={false}
          onFocus={() => m.focus && set({ focus: null })}
          onBlur={(e) => commitCell(m, set, -1, c, e.currentTarget.value, value, parseValue)}
          onKeyDown={onKeys(-1, c, value, "ser")}
          className={cn("field-sizing-content min-w-[2ch] max-w-full bg-transparent text-right text-[12px] leading-none font-medium text-ellipsis outline-none focus-visible:outline-none", tone)}
        />
      </label>
    )
  }

  const td = "border-r border-b border-(--v3-border) p-0 last:border-r-0"
  const menuOn = (axis: "row" | "col", i: number) => m.gridMenu?.axis === axis && m.gridMenu.index === i
  return (
    <>
      <div data-chart-grid={compact ? "compact" : "full"} className={cn("rounded-[4px] border border-(--v3-border)", compact ? "overflow-hidden" : "overflow-x-auto")}>
        <table role="grid" aria-label="图表数据" aria-readonly={readOnly || undefined} className="w-full table-fixed border-collapse text-[12px] leading-none" style={minWidth ? { minWidth } : undefined}>
          <colgroup>
            <col style={{ width: firstW }} />
            {scatter && <col style={{ width: xW }} />}
            {d.series.slice(0, colCount).map((_, c) => (
              <col key={c} />
            ))}
            {plusCol && <col style={{ width: plusW }} />}
          </colgroup>
          <thead>
            <tr className="bg-(--v3-panel-2)">
              <th scope="col" className={cn(td, catPad, "text-left font-normal text-(--v3-text-2)", rowH)}>
                {scatter ? "点" : "类别"}
              </th>
              {scatter && (
                <th scope="col" className={cn(td, numPad, "text-right font-normal text-(--v3-text-2)", rowH)}>
                  X 值
                </th>
              )}
              {d.series.slice(0, colCount).map((s, c) => {
                const head = (
                  <th key={c} scope="col" data-v3-anchor={readOnly ? undefined : `chart.grid-col-${c}`} className={cn(td, "font-normal", rowH, menuOn("col", c) && "bg-(--v3-accent-soft)")}>
                    {seriesHead(c, s.name)}
                  </th>
                )
                return faded(c) ? (
                  <Tip key={c} label={PIE_NOTE_LONG}>
                    {head}
                  </Tip>
                ) : (
                  head
                )
              })}
              {plusCol && (
                <th className={cn(td, "p-0", rowH)}>
                  <Tip label="新增系列">
                    <button
                      type="button"
                      aria-label="新增系列"
                      onClick={() => {
                        const next = cloneData(d)
                        next.series.push({ name: `系列 ${nSer + 1}`, values: d.categories.map(() => null) })
                        set({ data: next })
                      }}
                      className="flex size-full items-center justify-center text-(--v3-text-2) transition-colors hover:bg-(--v3-panel-3) hover:text-(--v3-text)"
                    >
                      <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </Tip>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {d.categories.slice(0, rowCount).map((cat, r) => (
              <tr key={r}>
                <th scope="row" data-v3-anchor={readOnly ? undefined : `chart.grid-row-${r}`} className={cn(td, "bg-(--v3-panel-2) font-normal", menuOn("row", r) && "bg-(--v3-accent-soft)")}>
                  {cell(r, -1, cat, "cat")}
                </th>
                {scatter && <td className={td}>{cell(r, -2, fmt(d.x?.[r]), "num")}</td>}
                {d.series.slice(0, colCount).map((s, c) => (
                  <td key={c} className={cn(td, faded(c) && "[&_input]:text-(--v3-text-2) [&_span]:text-(--v3-text-2)")}>
                    {cell(r, c, fmt(s.values[r]), "num")}
                  </td>
                ))}
                {plusCol && <td className={td} />}
              </tr>
            ))}
            {canAdd && !rowsCut && (
              <tr>
                <td colSpan={colCount + (scatter ? 2 : 1) + (plusCol ? 1 : 0)} className="p-0">
                  <button
                    type="button"
                    onClick={() => {
                      const next = cloneData(d)
                      next.categories.push(`${unit} ${nCat + 1}`)
                      if (next.x) next.x.push((next.x.at(-1) ?? 0) + 1)
                      next.series.forEach((s) => s.values.push(null))
                      set({ data: next })
                    }}
                    className={cn("flex w-full items-center gap-1.5 text-[12px] leading-none text-(--v3-text-2) transition-colors hover:bg-(--v3-panel-2) hover:text-(--v3-text)", catPad, rowH)}
                  >
                    <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
                    {scatter ? "新增点" : "新增类别"}
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <ContextMenu
          at={staticMenu && m.gridMenu ? { anchor: `chart.grid-${m.gridMenu.axis}-${m.gridMenu.index}`, x: 0.55, y: 0.8 } : undefined}
          target="chart.grid-*"
          onTarget={(name) => {
            const hit = /chart\.grid-(row|col)-(\d+)/.exec(name)
            if (hit) set({ gridMenu: { axis: hit[1] as "row" | "col", index: Number(hit[2]) } })
          }}
          open={!!m.gridMenu}
          onOpenChange={(v) => !v && set({ gridMenu: null })}
          label={m.gridMenu?.axis === "col" ? "系列" : unit}
          className="min-w-[184px]"
          items={gridMenuItems(m, set)}
        />
      )}
    </>
  )
}
