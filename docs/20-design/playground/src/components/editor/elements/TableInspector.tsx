import { useState, type ReactElement } from "react"
import { AlignCenterVertical, AlignEndHorizontal, AlignStartHorizontal, Bold, ChevronDown, ChevronUp, Italic } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { NumberField, PropertyRow, PropertyRowPair } from "../Inspector"
import { MilestoneTag } from "../ribbon/primitives"
import {
  BUILTIN_TABLE_STYLE_COUNT, flagLabels, tableStyles, TableStyleThumb, toInches, type TableFlags, type TableStyleDef, type TableStyleGroup,
} from "./SlideTable"

export type BorderPreset = "none" | "all" | "outer" | "inner" | "top" | "bottom" | "left" | "right" | "innerH" | "innerV"

/** 表格功能所处里程碑：M2 只开放单元格文字与字符格式，结构与样式控件 aria-disabled 并给原因（50/10 §5、50/24 §2.7） */
export type TableMilestone = "M2" | "M3"

/** M2 下 M3 控件的原因（tooltip）；读屏名同时附「（M3 提供）」 */
export const M3_ONLY_REASON = "M3 提供"
/** 评审、查看角色：编辑类控件的原因（设计 03-30 §9） */
export const NO_EDIT_REASON = "需要编辑权限"

/** 读屏名：带原因时附在名称后，如「宽（M3 提供）」 */
const named = (label: string, reason: string | null) => (reason ? `${label}（${reason}）` : label)
/** 禁用控件的外观：仍可聚焦与悬停（tooltip 可达），内容 50% */
const LOCKED = "cursor-not-allowed opacity-50"
/** 色块双层对比环：外圈随界面明暗取对比色，内圈白线把深色色块与深色按钮底分开（亮暗两套都可辨） */
const SWATCH_RING = "ring-1 ring-foreground/25 inset-ring-1 inset-ring-white/55 dark:ring-white/60"

/** 禁用而不隐藏：有原因时包一层 tooltip；控件自身负责 aria-disabled 与拦截操作 */
function Why({ reason, side = "left", children }: { reason: string | null; side?: "left" | "top" | "bottom"; children: ReactElement }) {
  if (!reason) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-60 text-pretty">{reason}</TooltipContent>
    </Tooltip>
  )
}

const borderPresets: { v: BorderPreset; label: string }[] = [
  { v: "none", label: "无框线" },
  { v: "all", label: "所有框线" },
  { v: "outer", label: "外侧框线" },
  { v: "inner", label: "内部框线" },
  { v: "innerH", label: "内部横框线" },
  { v: "top", label: "上框线" },
  { v: "bottom", label: "下框线" },
  { v: "left", label: "左框线" },
  { v: "right", label: "右框线" },
  { v: "innerV", label: "内部竖框线" },
]

/** 预设 → 要画的边（画布预览与图标共用） */
export function borderEdges(v: BorderPreset) {
  return {
    top: ["all", "outer", "top"].includes(v),
    bottom: ["all", "outer", "bottom"].includes(v),
    left: ["all", "outer", "left"].includes(v),
    right: ["all", "outer", "right"].includes(v),
    h: ["all", "inner", "innerH"].includes(v),
    v: ["all", "inner", "innerV"].includes(v),
  }
}

/** 边框预设图标：2 × 2 示意格，淡虚线为不画的边，实线为本预设画的边 */
function BorderIcon({ v }: { v: BorderPreset }) {
  const on = borderEdges(v)
  const seg = (k: keyof typeof on, d: string) => (
    <path d={d} stroke="currentColor" strokeWidth={on[k] ? 1.6 : 0.8} strokeOpacity={on[k] ? 1 : 0.35} strokeDasharray={on[k] ? undefined : "1.2 1.2"} fill="none" />
  )
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      {seg("top", "M2 2H14")}
      {seg("bottom", "M2 14H14")}
      {seg("left", "M2 2V14")}
      {seg("right", "M14 2V14")}
      {seg("h", "M2 8H14")}
      {seg("v", "M8 2V14")}
    </svg>
  )
}

/**
 * 单元格边框选择器（G-62；50/24 §2.7）：10 个预设（无 / 所有 / 外侧 / 内部 / 内部横 / 上 / 下 / 左 / 右 / 内部竖，5 × 2 单选组）
 * + 线型、粗细、颜色；作用于当前单元格选区。`lockReason` 给出时整组 aria-disabled（仍可聚焦，tooltip 给原因），当前预设保持高亮。
 */
export function BorderPicker({ value, onChange, lockReason = null }: { value: BorderPreset; onChange: (v: BorderPreset) => void; lockReason?: string | null }) {
  const locked = !!lockReason
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label={named("边框", lockReason)} className="grid grid-cols-5 gap-1">
        {borderPresets.map((b) => (
          <Tooltip key={b.v}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                aria-checked={value === b.v}
                aria-label={named(b.label, lockReason)}
                aria-disabled={locked || undefined}
                onClick={() => !locked && onChange(b.v)}
                className={cn(
                  "flex h-7 items-center justify-center rounded-md text-foreground/80 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  locked ? "cursor-not-allowed" : "hover:bg-foreground/[0.06]",
                  value === b.v && "bg-primary/12 text-primary ring-1 ring-primary/40",
                  value === b.v && !locked && "hover:bg-primary/15",
                  locked && value !== b.v && "opacity-50"
                )}
              >
                <BorderIcon v={b.v} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{lockReason ? `${b.label} · ${lockReason}` : b.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Select defaultValue="solid" open={locked ? false : undefined}>
          <Why reason={lockReason}>
            <SelectTrigger size="sm" className={cn("h-7 flex-1 text-xs", locked && LOCKED)} aria-label={named("线型", lockReason)} aria-disabled={locked || undefined}><SelectValue /></SelectTrigger>
          </Why>
          <SelectContent>
            <SelectItem value="solid">实线</SelectItem>
            <SelectItem value="dash">虚线</SelectItem>
            <SelectItem value="dot">点线</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="1.5" open={locked ? false : undefined}>
          <Why reason={lockReason}>
            <SelectTrigger size="sm" className={cn("h-7 w-[78px] text-xs", locked && LOCKED)} aria-label={named("粗细", lockReason)} aria-disabled={locked || undefined}><SelectValue /></SelectTrigger>
          </Why>
          <SelectContent>
            {["0.5", "1", "1.5", "2.25", "3"].map((w) => <SelectItem key={w} value={w}>{w} 磅</SelectItem>)}
          </SelectContent>
        </Select>
        <Why reason={lockReason}>
          <Button
            variant="outline"
            size="icon-sm"
            className={cn("size-7 shrink-0", locked && "cursor-not-allowed")}
            aria-label={named("边框颜色 #1A2030", lockReason)}
            aria-disabled={locked || undefined}
            onClick={(e) => locked && e.preventDefault()}
          >
            <span className={cn("size-3.5 rounded-[3px] bg-[#1A2030]", SWATCH_RING)} />
          </Button>
        </Why>
      </div>
    </div>
  )
}

const groupLabels: Record<TableStyleGroup, string> = { doc: "文档中", light: "浅色", medium: "中等", dark: "深色", other: "其它" }

/** 收起时每组显示的样式：浅色样式 1、中度样式 2（含默认样式）、深色样式 1，与 PowerPoint 样式库首屏相近 */
const collapsedPick: Record<TableStyleGroup, (s: TableStyleDef) => boolean> = {
  doc: () => true,
  light: (s) => s.family === "light-1",
  medium: (s) => s.family === "medium-2",
  dark: (s) => s.family === "dark-1",
  other: () => false,
}
const collapsedLimit: Partial<Record<TableStyleGroup, number>> = { light: 5, dark: 5 }

/**
 * 表格样式库（G-62；50/24 §2.7）：文档中的样式在前，浅色 / 中等 / 深色分组；缩略图按当前 6 个标志与主题绘制。
 * 「显示全部 74 种」展开全部内置样式，按组列出、组头带计数（浅色 21 · 中等 28 · 深色 11 · 其它 14）。
 * `lockReason`（M2 或无编辑权限）：缩略图可见、当前样式保持高亮，其余变淡且不响应点击；展开 / 收起是查看操作，始终可用。
 */
export function TableStyleGallery({
  value,
  onChange,
  flags,
  lockReason = null,
  defaultExpanded = false,
}: {
  value: string
  onChange: (id: string) => void
  flags: TableFlags
  lockReason?: string | null
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const locked = !!lockReason
  const groups: TableStyleGroup[] = expanded ? ["doc", "light", "medium", "dark", "other"] : ["doc", "light", "medium", "dark"]
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => {
        const all = tableStyles.filter((s) => s.group === g)
        const items = expanded ? all : all.filter(collapsedPick[g]).slice(0, collapsedLimit[g] ?? all.length)
        return (
          <div key={g} role="group" aria-label={expanded && g !== "doc" ? `${groupLabels[g]} ${all.length} 种` : groupLabels[g]} className="flex flex-col gap-1.5">
            {/* 组头用 div：AccordionContent 给非末尾的 <p> 加 mb-4，组头会离自己的缩略图比离上一组还远 */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {groupLabels[g]}
              {expanded && g !== "doc" && <span className="tabular-nums">· {all.length}</span>}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {items.map((s) => {
                const current = value === s.id
                return (
                  <Tooltip key={s.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={named(s.name, lockReason)}
                        aria-pressed={current}
                        aria-disabled={locked || undefined}
                        onClick={() => !locked && onChange(s.id)}
                        className={cn(
                          "overflow-hidden rounded-md bg-doc-paper p-0.5 shadow-[0_0_0_1px_rgb(15_20_40/0.1)] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring",
                          locked ? "cursor-not-allowed" : "hover:shadow-[0_0_0_1.5px_var(--primary)]",
                          current && "shadow-none ring-2 ring-primary ring-offset-1 ring-offset-card hover:shadow-none",
                          locked && !current && "opacity-60"
                        )}
                      >
                        <TableStyleThumb style={s} flags={flags} className="w-full rounded-[3px]" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{lockReason ? `${s.name} · ${lockReason}` : s.name}</TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        )
      })}
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={expanded}
        className="h-7 justify-start gap-1 px-1.5 text-xs font-normal text-muted-foreground"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <>收起 <ChevronUp className="size-3" /></> : <>显示全部 {BUILTIN_TABLE_STYLE_COUNT} 种 <ChevronDown className="size-3" /></>}
      </Button>
    </div>
  )
}

export type TableSelectionKind = "table" | "table-cell"

/** 检查器数值的来源（幻灯片坐标，1 in = 72）：整表框、当前行高与列宽；列宽不一致时为 null（显示「多个值」） */
export interface TableMetrics {
  x: number
  y: number
  w: number
  h: number
  rowH: number
  colW: number | null
}

const textDirections = [
  { v: "horz", l: "横排" },
  { v: "vert", l: "所有文字旋转 90°" },
  { v: "vert270", l: "所有文字旋转 270°" },
  { v: "wordArtVert", l: "堆积" },
]

/**
 * 表格检查器（50/24 §2.7；selectionKind `table` / `table-cell`，d-72）：M3 之前不可用的分区留在原位并标 M3。
 * `milestone="M2"`：宽高、样式缩略图与 6 个标志、「单元格」「行高与列宽」分区的控件 aria-disabled（仍可聚焦），tooltip「M3 提供」，
 * 读屏名附「（M3 提供）」；X / Y、文本、替代文本照常可用。`readOnly`：编辑类控件同样处理，原因「需要编辑权限」。
 * 数值一律以 in 显示（PRD ED-05；与画布列宽角标同一换算）。`openSections` 决定默认展开哪些分区（随演示态重挂载）。
 */
export function TableInspector({
  kind,
  selectionLabel,
  openSections,
  styleId,
  onStyleChange,
  flags,
  onFlagsChange,
  border,
  onBorderChange,
  milestone = "M3",
  readOnly = false,
  metrics,
  stylesExpanded,
}: {
  kind: TableSelectionKind
  selectionLabel: string
  openSections: string[]
  styleId: string
  onStyleChange: (id: string) => void
  flags: TableFlags
  onFlagsChange: (f: TableFlags) => void
  border: BorderPreset
  onBorderChange: (b: BorderPreset) => void
  milestone?: TableMilestone
  readOnly?: boolean
  metrics: TableMetrics
  /** 演示：样式库默认展开全部 */
  stylesExpanded?: boolean
}) {
  const [vAlign, setVAlign] = useState("top")
  const [textDir, setTextDir] = useState("horz")
  /** M3 控件的原因：无编辑权限优先（图 6 的判断顺序），其次 M2 */
  const m3Lock = readOnly ? NO_EDIT_REASON : milestone === "M2" ? M3_ONLY_REASON : null
  /** M2 已开放控件的原因：只有无编辑权限 */
  const editLock = readOnly ? NO_EDIT_REASON : null
  const trig = (label: string, m3?: boolean) => (
    <AccordionTrigger className="text-xs font-semibold">
      <span className="inline-flex items-center gap-1.5">{label}{m3 && <MilestoneTag>M3</MilestoneTag>}</span>
    </AccordionTrigger>
  )
  /** 数值框：有原因即 aria-disabled + 只读（可聚焦、不可改），tooltip 给原因 */
  const num = (label: string, px: number | null, reason: string | null) => (
    <Why reason={reason}>
      <NumberField
        value={px === null ? "" : toInches(px)}
        placeholder={px === null ? "多个值" : undefined}
        suffix="in"
        aria-label={named(label, reason)}
        aria-disabled={reason ? true : undefined}
        readOnly={!!reason}
        className={cn(reason && LOCKED)}
      />
    </Why>
  )
  const lockBtn = (reason: string | null) => ({
    "aria-disabled": reason ? true : undefined,
    onClick: (e: { preventDefault(): void }) => { if (reason) e.preventDefault() },
  })

  return (
    <div className="flex flex-col">
      <p className="mx-3 mt-2 text-xs text-muted-foreground">已选：<span className="text-foreground">{selectionLabel}</span></p>
      {/* AccordionContent 加 h-auto：Rhea 的内层固定为展开瞬间量到的高度，展开「显示全部 74 种」后内容变多会被裁掉 */}
      <Accordion type="multiple" defaultValue={openSections} className="inspector-groups m-3 mt-2">
        {kind === "table" && (
          <AccordionItem value="position">
            {trig("位置与大小")}
            <AccordionContent className="flex h-auto flex-col gap-1.5">
              <PropertyRowPair a={{ label: "X", children: num("X", metrics.x, editLock) }} b={{ label: "Y", children: num("Y", metrics.y, editLock) }} />
              <PropertyRowPair a={{ label: "宽", children: num("宽", metrics.w, m3Lock) }} b={{ label: "高", children: num("高", metrics.h, m3Lock) }} />
              <p className="text-xs text-muted-foreground">表格不可旋转或翻转；改尺寸按比例缩放行列（M3）</p>
            </AccordionContent>
          </AccordionItem>
        )}
        <AccordionItem value="style">
          {trig("表格样式", true)}
          <AccordionContent className="flex h-auto flex-col gap-3">
            <TableStyleGallery value={styleId} onChange={onStyleChange} flags={flags} lockReason={m3Lock} defaultExpanded={stylesExpanded} />
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-foreground/[0.06] pt-3">
              {flagLabels.map((f) => (
                <label key={f.key} className={cn("flex items-center gap-2 text-xs", m3Lock && LOCKED)}>
                  <Why reason={m3Lock}>
                    <Checkbox
                      checked={flags[f.key]}
                      aria-label={m3Lock ? named(f.label, m3Lock) : undefined}
                      aria-disabled={m3Lock ? true : undefined}
                      onCheckedChange={(v) => !m3Lock && onFlagsChange({ ...flags, [f.key]: !!v })}
                    />
                  </Why>
                  {f.label}
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
        {kind === "table-cell" && (
          <AccordionItem value="cell">
            {trig("单元格", true)}
            <AccordionContent className="flex h-auto flex-col gap-2.5">
              <PropertyRow label="填充">
                <Why reason={m3Lock}>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={named("填充：跟随样式", m3Lock)}
                    className={cn("h-7 flex-1 justify-start gap-2 px-2 text-xs font-normal", m3Lock && "cursor-not-allowed")}
                    {...lockBtn(m3Lock)}
                  >
                    <span className={cn("size-3.5 rounded-[3px] bg-[#CBD3F8]", SWATCH_RING)} /> <span className={cn(m3Lock && "opacity-50")}>跟随样式</span>
                  </Button>
                </Why>
              </PropertyRow>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">边框</span>
                <BorderPicker value={border} onChange={onBorderChange} lockReason={m3Lock} />
              </div>
              <PropertyRowPair a={{ label: "左右", children: num("左右边距", 0.1 * 72, m3Lock) }} b={{ label: "上下", children: num("上下边距", 0.05 * 72, m3Lock) }} />
              <PropertyRow label="垂直">
                <ToggleGroup
                  type="single"
                  size="sm"
                  variant="outline"
                  value={vAlign}
                  onValueChange={(v) => !m3Lock && v && setVAlign(v)}
                  className="flex-1"
                  aria-label={named("垂直对齐", m3Lock)}
                >
                  {[
                    { v: "top", l: "顶端对齐", icon: <AlignStartHorizontal /> },
                    { v: "middle", l: "居中对齐", icon: <AlignCenterVertical /> },
                    { v: "bottom", l: "底端对齐", icon: <AlignEndHorizontal /> },
                  ].map((o) => (
                    <Why key={o.v} reason={m3Lock ? `${o.l} · ${m3Lock}` : null}>
                      <ToggleGroupItem
                        value={o.v}
                        aria-label={named(o.l, m3Lock)}
                        aria-disabled={m3Lock ? true : undefined}
                        className={cn("h-7 flex-1", m3Lock && "cursor-not-allowed", m3Lock && vAlign !== o.v && "*:opacity-50")}
                      >
                        {o.icon}
                      </ToggleGroupItem>
                    </Why>
                  ))}
                </ToggleGroup>
              </PropertyRow>
              <PropertyRow label="文字方向">
                <Select value={textDir} onValueChange={setTextDir} open={m3Lock ? false : undefined}>
                  <Why reason={m3Lock}>
                    <SelectTrigger size="sm" className={cn("h-7 flex-1 text-xs", m3Lock && LOCKED)} aria-label={named("文字方向", m3Lock)} aria-disabled={m3Lock ? true : undefined}>
                      <SelectValue />
                    </SelectTrigger>
                  </Why>
                  <SelectContent>
                    {textDirections.map((d) => <SelectItem key={d.v} value={d.v}>{d.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </PropertyRow>
            </AccordionContent>
          </AccordionItem>
        )}
        <AccordionItem value="text">
          {trig(kind === "table" ? "文本（全部单元格）" : "文本（所选单元格）")}
          <AccordionContent className="flex h-auto flex-col gap-2">
            <PropertyRow label="字体">
              <Select defaultValue="msyh" open={editLock ? false : undefined}>
                <Why reason={editLock}>
                  <SelectTrigger size="sm" className={cn("h-7 flex-1 text-xs", editLock && LOCKED)} aria-label={named("字体", editLock)} aria-disabled={editLock ? true : undefined}><SelectValue /></SelectTrigger>
                </Why>
                <SelectContent><SelectItem value="msyh">微软雅黑</SelectItem></SelectContent>
              </Select>
            </PropertyRow>
            <PropertyRow label="字号">
              <Why reason={editLock}>
                <NumberField value="14" suffix="pt" aria-label={named("字号", editLock)} aria-disabled={editLock ? true : undefined} readOnly={!!editLock} className={cn(editLock && LOCKED)} />
              </Why>
              {[{ l: "加粗", icon: <Bold className="size-3.5" /> }, { l: "斜体", icon: <Italic className="size-3.5" /> }].map((t) => (
                <Why key={t.l} reason={editLock}>
                  <Toggle
                    size="sm"
                    aria-label={named(t.l, editLock)}
                    aria-disabled={editLock ? true : undefined}
                    pressed={editLock ? false : undefined}
                    className={cn("size-7", editLock && LOCKED)}
                  >
                    {t.icon}
                  </Toggle>
                </Why>
              ))}
            </PropertyRow>
          </AccordionContent>
        </AccordionItem>
        {kind === "table-cell" && (
          <AccordionItem value="size">
            {trig("行高与列宽", true)}
            <AccordionContent className="flex h-auto flex-col gap-1.5">
              <PropertyRowPair a={{ label: "行高", children: num("行高", metrics.rowH, m3Lock) }} b={{ label: "列宽", children: num("列宽", metrics.colW, m3Lock) }} />
            </AccordionContent>
          </AccordionItem>
        )}
        {kind === "table" && (
          <AccordionItem value="alt">
            {trig("替代文本")}
            <AccordionContent className="flex h-auto flex-col gap-2">
              <Why reason={editLock}>
                <Input className={cn("h-7 text-xs md:text-xs", editLock && LOCKED)} defaultValue="区域季度销售表" aria-label={named("替代文本标题", editLock)} aria-disabled={editLock ? true : undefined} readOnly={readOnly} />
              </Why>
              <Why reason={editLock}>
                <Textarea className={cn("min-h-14 text-xs md:text-xs", editLock && LOCKED)} defaultValue="四个区域 2026 年 Q1–Q3 销售额，单位万元" aria-label={named("替代文本描述", editLock)} aria-disabled={editLock ? true : undefined} readOnly={readOnly} />
              </Why>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  )
}
