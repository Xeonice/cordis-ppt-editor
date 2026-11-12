import { Fragment, useEffect, useRef, type ReactNode } from "react"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { ignoreDesignBar } from "../ribbon/insert/demo"
import { seriesColor, type ChartData } from "./chart-model"

export interface GridCellRef {
  /** 类别行；-1 = 系列名表头 */
  r: number
  /** 系列列；-1 = 类别名列；散点的 X 列为 -2 */
  c: number
}

/** 检查器紧凑网格最多显示的类别行 × 系列列（50/24 §3.7）；超出的在展开面板里编辑 */
export const COMPACT_LIMIT = { rows: 8, cols: 4 } as const

/** 紧凑网格是否截断；截断时说明行写「共 N 类别 × M 系列 · 此处显示前 8 × 4」 */
export function isCompactTruncated(data: ChartData) {
  return data.categories.length > COMPACT_LIMIT.rows || data.series.length > COMPACT_LIMIT.cols
}

/** 行列右键菜单的演示态：打开哪一行（类别）或哪一列（系列）的菜单 */
export interface GridMenuDemo {
  axis: "row" | "col"
  index: number
}

const same = (a: GridCellRef | undefined, r: number, c: number) => !!a && a.r === r && a.c === c

function fmt(v: number | null | undefined) {
  return v === null || v === undefined ? "" : String(v)
}

function clone(d: ChartData): ChartData {
  return { categories: [...d.categories], series: d.series.map((s) => ({ ...s, values: [...s.values] })), x: d.x ? [...d.x] : undefined }
}

function swap<T>(arr: T[], i: number, j: number) {
  const t = arr[i]!
  arr[i] = arr[j]!
  arr[j] = t
}

/** 在单元格上模拟一次右键（Shift+F10 / ContextMenu 键、演示态打开菜单共用）：Radix ContextMenu 以事件坐标定位 */
function openContextMenuAt(el: Element | null) {
  if (!el) return
  const r = el.getBoundingClientRect()
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 8, clientY: r.bottom - 2 }))
}

const PIE_NOTE = "饼图只画第一个系列"

/**
 * 图表数据网格（50/24 §3.6；G-63）：行 = 类别，列 = 系列（散点多一列 X）；首列类别名、首行系列名可编辑；末行 / 末列「+」新增。
 * 外观取 shadcn Table（产品实现为 @tanstack/react-table 无头表 + shadcn Table，ADR-0036 / 50/17）：发丝网格、表头浅灰、数字右对齐等宽。
 * 单元格是真实 input：Enter 提交下移、Tab 提交右移、Esc 放弃；`focusCell` / `invalid` 供演示态直接画出焦点格与非法输入。
 * 类别格与系列表头带右键菜单（ui/context-menu）：删除、上移 / 下移（列为左移 / 右移），到边的项 aria-disabled 并给原因；
 * 格聚焦时 Shift+F10 或 ContextMenu 键同样打开。`plottedSeries` 小于系列数时（饼图只画第一个系列），其余列表头与数值格变淡。
 * `compact` 只渲染前 8 行 × 4 列（COMPACT_LIMIT），截断时不出对应方向的「+」，其余在展开面板里编辑；展开形态容器可横向滚动、列有最小宽度。
 */
export function ChartDataGrid({
  data,
  onChange,
  compact = false,
  focusCell,
  invalid,
  plottedSeries,
  menuDemo,
  readOnly = false,
  className,
}: {
  data: ChartData
  onChange?: (d: ChartData) => void
  compact?: boolean
  focusCell?: GridCellRef
  invalid?: GridCellRef & { text: string }
  /** 图上实际画出的系列数（饼图为 1）；缺省全部 */
  plottedSeries?: number
  /** 演示：挂载后打开某一行或某一列的右键菜单 */
  menuDemo?: GridMenuDemo
  /** 评审 / 查看：格不可编辑，菜单编辑项 aria-disabled */
  readOnly?: boolean
  className?: string
}) {
  const scatter = !!data.x
  const rowH = compact ? "h-7" : "h-8"
  const nCat = data.categories.length
  const nSer = data.series.length
  const rowCount = compact ? Math.min(nCat, COMPACT_LIMIT.rows) : nCat
  const colCount = compact ? Math.min(nSer, COMPACT_LIMIT.cols) : nSer
  const rowsCut = rowCount < nCat
  const colsCut = colCount < nSer
  const faded = (c: number) => plottedSeries !== undefined && c >= plottedSeries
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuDemo) return
    const t = window.setTimeout(() => {
      const sel = menuDemo.axis === "row" ? `[data-grid-row="${menuDemo.index}"]` : `[data-grid-col="${menuDemo.index}"]`
      openContextMenuAt(rootRef.current?.querySelector(sel) ?? null)
    }, 160)
    return () => window.clearTimeout(t)
  }, [menuDemo])

  function commit(r: number, c: number, text: string, original: string) {
    // 未改动（只是聚焦后离开）不算提交：不产生命令，也不消掉「原工作簿」提示
    if (!onChange || readOnly || text === original) return
    const next = clone(data)
    if (r === -1 && c >= 0) next.series[c]!.name = text
    else if (c === -1) next.categories[r] = text
    else {
      const t = text.trim()
      const n = t === "" ? null : Number(t)
      if (n !== null && Number.isNaN(n)) return
      if (c === -2 && next.x) next.x[r] = n ?? 0
      else next.series[c]!.values[r] = n
    }
    onChange(next)
  }

  function deleteRow(r: number) {
    const prev = data
    const next = clone(data)
    next.categories.splice(r, 1)
    next.x?.splice(r, 1)
    next.series.forEach((s) => s.values.splice(r, 1))
    onChange?.(next)
    toast(`已删除${scatter ? "点" : "类别"}「${prev.categories[r]}」`, { action: { label: "撤销", onClick: () => onChange?.(prev) } })
  }
  function moveRow(r: number, d: -1 | 1) {
    const next = clone(data)
    swap(next.categories, r, r + d)
    if (next.x) swap(next.x, r, r + d)
    next.series.forEach((s) => swap(s.values, r, r + d))
    onChange?.(next)
  }
  function deleteCol(c: number) {
    const prev = data
    const next = clone(data)
    next.series.splice(c, 1)
    onChange?.(next)
    toast(`已删除系列「${prev.series[c]?.name}」`, { action: { label: "撤销", onClick: () => onChange?.(prev) } })
  }
  function moveCol(c: number, d: -1 | 1) {
    const next = clone(data)
    swap(next.series, c, c + d)
    onChange?.(next)
  }

  const cellInput = (r: number, c: number, value: string, numeric: boolean) => {
    const focused = same(focusCell, r, c)
    const bad = invalid && same(invalid, r, c)
    const isHeader = r === -1 || c === -1
    return (
      <input
        key={`${r}:${c}:${value}`}
        defaultValue={bad ? invalid.text : value}
        readOnly={readOnly}
        aria-label={r === -1 ? `系列名 ${c + 1}` : c === -1 ? `类别名 ${r + 1}` : `${data.categories[r]} · ${c === -2 ? "X" : data.series[c]?.name}`}
        aria-invalid={bad || undefined}
        title={isHeader && value ? value : undefined}
        inputMode={numeric ? "decimal" : undefined}
        onBlur={(e) => commit(r, c, e.currentTarget.value, value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(r, c, e.currentTarget.value, value); e.currentTarget.blur() }
          if (e.key === "Escape") { e.currentTarget.value = value; e.currentTarget.blur() }
          // 表头格（类别名、系列名）聚焦时键盘打开行列菜单
          if (isHeader && ((e.shiftKey && e.key === "F10") || e.key === "ContextMenu")) {
            e.preventDefault()
            openContextMenuAt(e.currentTarget.closest("[data-grid-row], [data-grid-col]"))
          }
        }}
        className={cn(
          "block w-full min-w-0 bg-transparent px-2 text-xs text-ellipsis outline-none transition-colors",
          rowH,
          numeric ? "text-right tabular-nums" : "text-left",
          "focus:bg-card focus:ring-2 focus:ring-primary focus:ring-inset",
          focused && "bg-card ring-2 ring-primary ring-inset",
          bad && "bg-destructive/[0.06] text-destructive ring-2 ring-destructive ring-inset focus:ring-destructive"
        )}
      />
    )
  }

  const cellCls = "border-r border-foreground/[0.07] p-0 last:border-r-0"
  const colMinW = 72
  // 紧凑网格的类别列放得下 4 个汉字（48 + 左右 8）；更长的名字以省略号收尾，完整内容在展开抽屉里看
  const firstColW = compact ? 66 : 84
  return (
    <div
      ref={rootRef}
      className={cn("rounded-lg bg-card ring-1 ring-foreground/10 dark:bg-white/[0.03]", compact ? "overflow-hidden" : "overflow-x-auto", className)}
    >
      <Table className="table-fixed text-xs" style={compact ? undefined : { minWidth: firstColW + (scatter ? colMinW : 0) + nSer * colMinW + 28 }}>
        <TableHeader className="bg-muted/70 dark:bg-white/[0.05]">
          <TableRow className="border-foreground/[0.08] hover:bg-transparent">
            <TableHead className={cn(cellCls, compact ? "w-[66px]" : "w-[84px]", "px-2 text-2xs font-medium text-muted-foreground", rowH)}>{scatter ? "点" : "类别"}</TableHead>
            {scatter && <TableHead className={cn(cellCls, "px-2 text-right text-2xs font-medium text-muted-foreground", rowH)}>X 值</TableHead>}
            {data.series.slice(0, colCount).map((s, c) => {
              const head = (
                <TableHead data-grid-col={c} className={cn(cellCls, "px-0 font-medium data-[state=open]:bg-primary/10", rowH, faded(c) && "opacity-50")}>
                  <div className="relative flex items-center">
                    <span className={cn("pointer-events-none absolute size-2 rounded-[2px]", compact ? "left-1" : "left-2")} style={{ backgroundColor: seriesColor(c) }} aria-hidden="true" />
                    {/* 紧凑形态（300 宽检查器里每个系列列约 52 px）：色块贴左 4 px、输入框左右各 4 px，「系列 1」这类默认名放得下；更长的名字省略号收尾，悬停 title 显示全名 */}
                    <div className={cn("min-w-0 flex-1 [&_input]:text-right [&_input]:font-medium", compact ? "pl-2 [&_input]:px-1 [&_input]:text-2xs" : "pl-3.5")}>{cellInput(-1, c, s.name, false)}</div>
                  </div>
                </TableHead>
              )
              return (
                <GridMenu
                  key={c}
                  label={`系列「${s.name}」`}
                  readOnly={readOnly}
                  tooltip={faded(c) ? `${PIE_NOTE}；其余系列保留在数据里，切回其它类型后重新画出` : undefined}
                  items={[
                    { icon: <ArrowLeft />, label: "左移", reason: c === 0 ? "已是第一个系列" : undefined, run: () => moveCol(c, -1) },
                    { icon: <ArrowRight />, label: "右移", reason: c === nSer - 1 ? "已是最后一个系列" : undefined, run: () => moveCol(c, 1) },
                    { icon: <Trash2 />, label: "删除系列", destructive: true, reason: nSer === 1 ? "图表至少保留一个系列" : undefined, run: () => deleteCol(c) },
                  ]}
                >
                  {head}
                </GridMenu>
              )
            })}
            {!colsCut && (
              <TableHead className={cn(cellCls, "w-7 px-0", rowH)}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="新增系列" aria-disabled={readOnly || undefined} className="flex size-full items-center justify-center text-muted-foreground hover:bg-foreground/5 hover:text-foreground aria-disabled:pointer-events-none aria-disabled:opacity-50" onClick={() => !readOnly && onChange?.({ ...data, series: [...data.series, { name: `系列 ${nSer + 1}`, values: data.categories.map(() => null) }] })}>
                      <Plus className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>新增系列</TooltipContent>
                </Tooltip>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.categories.slice(0, rowCount).map((cat, r) => (
            <TableRow key={r} className="border-foreground/[0.07] hover:bg-transparent">
              <GridMenu
                label={`${scatter ? "点" : "类别"}「${cat}」`}
                readOnly={readOnly}
                items={[
                  { icon: <ArrowUp />, label: "上移", reason: r === 0 ? `已是第一个${scatter ? "点" : "类别"}` : undefined, run: () => moveRow(r, -1) },
                  { icon: <ArrowDown />, label: "下移", reason: r === nCat - 1 ? `已是最后一个${scatter ? "点" : "类别"}` : undefined, run: () => moveRow(r, 1) },
                  { icon: <Trash2 />, label: scatter ? "删除点" : "删除类别", destructive: true, reason: nCat === 1 ? `图表至少保留一个${scatter ? "点" : "类别"}` : undefined, run: () => deleteRow(r) },
                ]}
              >
                <TableCell data-grid-row={r} className={cn(cellCls, "bg-muted/35 data-[state=open]:bg-primary/10 dark:bg-white/[0.02] dark:data-[state=open]:bg-primary/15")}>{cellInput(r, -1, cat, false)}</TableCell>
              </GridMenu>
              {scatter && <TableCell className={cellCls}>{cellInput(r, -2, fmt(data.x?.[r]), true)}</TableCell>}
              {data.series.slice(0, colCount).map((s, c) => <TableCell key={c} className={cn(cellCls, faded(c) && "opacity-50")}>{cellInput(r, c, fmt(s.values[r]), true)}</TableCell>)}
              {!colsCut && <TableCell className={cellCls} />}
            </TableRow>
          ))}
          {!rowsCut && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={colCount + (scatter ? 2 : 1) + (colsCut ? 0 : 1)} className="p-0">
                <button type="button" aria-disabled={readOnly || undefined} className={cn("flex w-full items-center gap-1.5 px-2 text-xs text-muted-foreground hover:bg-foreground/5 hover:text-foreground aria-disabled:pointer-events-none aria-disabled:opacity-50", rowH)} onClick={() => !readOnly && onChange?.({ ...data, categories: [...data.categories, `类别 ${nCat + 1}`], x: data.x ? [...data.x, (data.x.at(-1) ?? 0) + 1] : undefined, series: data.series.map((s) => ({ ...s, values: [...s.values, null] })) })}>
                  <Plus className="size-3.5" /> {scatter ? "新增点" : "新增类别"}
                </button>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

/** 网格的饼图说明（表头 tooltip 与说明行共用一句） */
export const GRID_PIE_NOTE = PIE_NOTE

interface GridMenuItem {
  icon: ReactNode
  label: string
  destructive?: boolean
  /** 有原因即 aria-disabled（到边、至少保留一个） */
  reason?: string
  run: () => void
}

/** 行（类别）/ 列（系列）右键菜单：ui/context-menu；不可用项 aria-disabled（仍可聚焦），悬停或聚焦时 tooltip 给原因 */
function GridMenu({ label, items, readOnly, tooltip, children }: { label: string; items: GridMenuItem[]; readOnly: boolean; tooltip?: string; children: ReactNode }) {
  // 触发器链：TooltipTrigger → ContextMenuTrigger → 表头 / 类别格，三层都是 asChild，事件与属性合并到同一个 th / td 上
  const trigger = <ContextMenuTrigger asChild className="select-auto">{children}</ContextMenuTrigger>
  return (
    <ContextMenu modal={false}>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-60 text-pretty">{tooltip}</TooltipContent>
        </Tooltip>
      ) : trigger}
      <ContextMenuContent className="w-44" onInteractOutside={ignoreDesignBar}>
        <ContextMenuLabel className="truncate text-2xs font-medium text-muted-foreground">{label}</ContextMenuLabel>
        {items.map((it, i) => {
          const reason = readOnly ? "需要编辑权限" : it.reason
          const item = (
            <ContextMenuItem
              variant={it.destructive ? "destructive" : "default"}
              aria-disabled={reason ? true : undefined}
              onSelect={(e) => { if (reason) { e.preventDefault(); return } it.run() }}
              className={cn(reason && "cursor-not-allowed focus:bg-foreground/[0.04] data-[variant=destructive]:focus:bg-foreground/[0.04]")}
            >
              <span className={cn("flex items-center gap-2", reason && "opacity-50")}>{it.icon}{it.label}</span>
            </ContextMenuItem>
          )
          return (
            <Fragment key={it.label}>
              {it.destructive && i > 0 && <ContextMenuSeparator />}
              {reason ? (
                <Tooltip>
                  <TooltipTrigger asChild>{item}</TooltipTrigger>
                  <TooltipContent side="right">{reason}</TooltipContent>
                </Tooltip>
              ) : item}
            </Fragment>
          )
        })}
      </ContextMenuContent>
    </ContextMenu>
  )
}
