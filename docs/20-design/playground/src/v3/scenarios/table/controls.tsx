import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { CheckRow, ColorChip, FoldSection, MenuField, SEG_ON, SEG_TRACK_FRAME, Segmented, SELECT_FRAME, TextArea, TextField, Tip, ToggleStrip, withReason, type SegOption } from "../../kit"
import { BORDER_PRESETS, borderEdges, type BorderPreset } from "./model"

/**
 * 表格检查器的局部控件。「禁用而不隐藏」（aria-disabled、仍可聚焦、tooltip 给原因、读屏名附原因，03-30 §6.1、rulings §4.20 FE-06）已并入 kit：
 * MenuField / Segmented / ToggleStrip / CheckRow / TextField / TextArea 的 disabled + reason，FoldSection 的 tag。
 * 下面的 Lock* 只是把「reason 有值即锁定」的写法接到 kit 上，外观与 kit 一致；表格特有的填充字段、边框预设留在这里。
 */

export { withReason }

function Why({ reason, children }: { reason: string | null | undefined; children: ReactNode }) {
  return reason ? <Tip label={reason}>{children}</Tip> : <>{children}</>
}

/* ------------------------------------------------------------------ 分区（可折叠，标题可带 M3 标记） */

/** kit FoldSection（标题后可挂 Tag，如 M2 时的「M3」）；loose：子项之间 12px（分组之间），缺省 8px。 */
export function TSection({
  title,
  tag,
  defaultOpen = true,
  anchor,
  loose,
  children,
}: {
  title: string
  tag?: string
  defaultOpen?: boolean
  anchor?: string
  loose?: boolean
  children: ReactNode
}) {
  return (
    <FoldSection title={title} tag={tag} defaultOpen={defaultOpen} anchor={anchor} bodyClassName={loose ? "gap-3" : undefined}>
      {children}
    </FoldSection>
  )
}

/** 分区内的一组属性：12px text-2 小标题 + 控件（与 SwatchPicker 的分组标题同一写法） */
export function Group({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <p className="text-[12px] leading-4 text-(--v3-text-2)">{label}</p>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ 下拉 / 分段 / 切换条 / 勾选 / 文本（kit 控件 + reason 即锁定） */

export function LockSelect({
  aria,
  items,
  value,
  reason,
  leading,
  className,
  align,
}: {
  aria: string
  items: string[]
  value: string
  reason?: string | null
  leading?: ReactNode
  className?: string
  align?: "start" | "center" | "end"
}) {
  return <MenuField aria={aria} items={items} defaultValue={value} leading={leading} className={className} align={align} disabled={!!reason} reason={reason ?? undefined} />
}

export function LockSegmented<T extends string>({ aria, options, value, reason }: { aria: string; options: SegOption<T>[]; value: T; reason?: string | null }) {
  return <Segmented aria={aria} options={options} defaultValue={value} disabled={!!reason} reason={reason ?? undefined} />
}

export function LockToggles({
  aria,
  options,
  on,
  reason,
}: {
  aria: string
  options: { value: string; label: string; icon: ReactNode; kbd?: string }[]
  on: string[]
  reason?: string | null
}) {
  return <ToggleStrip aria={aria} options={options} defaultOn={on} disabled={!!reason} reason={reason ?? undefined} />
}

export function LockCheckRow({ label, checked, onChange, reason }: { label: string; checked: boolean; onChange?: (v: boolean) => void; reason?: string | null }) {
  return <CheckRow label={label} checked={checked} onCheckedChange={onChange} disabled={!!reason} reason={reason ?? undefined} />
}

/** 28px 文本框 / 多行文本框（替代文本）：kit TextField / TextArea，锁定时只读、text-3。 */
export function LockText({ aria, value, reason, multiline }: { aria: string; value: string; reason?: string | null; multiline?: boolean }) {
  return multiline ? (
    <TextArea aria={aria} defaultValue={value} rows={3} disabled={!!reason} reason={reason ?? undefined} />
  ) : (
    <TextField aria={aria} defaultValue={value} disabled={!!reason} reason={reason ?? undefined} />
  )
}

/* ------------------------------------------------------------------ 颜色 */

/** 填充字段：色块 + 当前值（「跟随样式」= 样式算出的颜色），点开 03-03 颜色选择器；与 SelectTrigger 同外观。 */
export function FillField({ color, text, aria, reason }: { color: string; text: string; aria: string; reason?: string | null }) {
  return (
    <Why reason={reason}>
      <button
        type="button"
        aria-label={withReason(`${aria}：${text}`, reason)}
        aria-disabled={reason ? true : undefined}
        className={cn(
          SELECT_FRAME,
          "flex h-7 w-full min-w-0 items-center gap-2 px-2 text-left text-[12px] leading-none transition-colors",
          reason ? "cursor-default text-(--v3-text-3) ring-(--v3-select-line-off)" : "text-(--v3-text) hover:bg-(--v3-select-fill-hover)",
        )}
      >
        <ColorChip color={color} />
        <span className="truncate">{text}</span>
        <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" className={cn("ml-auto shrink-0", reason ? "" : "text-(--v3-text-2)")} />
      </button>
    </Why>
  )
}

/** 28px 色块按钮（边框颜色）：读屏名含色值。 */
export function ColorButton({ color, name, aria, reason }: { color: string; name: string; aria: string; reason?: string | null }) {
  return (
    <Why reason={reason ?? `${name} ${color}`}>
      <button
        type="button"
        aria-label={withReason(`${aria}：${name} ${color}`, reason)}
        aria-disabled={reason ? true : undefined}
        className={cn("flex size-7 shrink-0 items-center justify-center rounded-[4px] bg-(--v3-panel-2) transition-colors", reason ? "cursor-default" : "hover:bg-(--v3-panel-3)")}
      >
        <ColorChip color={color} />
      </button>
    </Why>
  )
}

/* ------------------------------------------------------------------ 边框预设（10 个，5 × 2 单选组） */

/** 2 × 2 示意格：实线是本预设要画的边，淡虚线是不画的边 */
export function BorderIcon({ v }: { v: BorderPreset }) {
  const on = borderEdges(v)
  const seg = (k: keyof typeof on, d: string) => (
    <path d={d} data-v3-edge={on[k] ? "on" : "off"} stroke="currentColor" strokeWidth={on[k] ? 1.5 : 1} strokeOpacity={on[k] ? 1 : 0.4} strokeDasharray={on[k] ? undefined : "1.5 1.5"} fill="none" />
  )
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      {seg("top", "M2.5 2.5H13.5")}
      {seg("bottom", "M2.5 13.5H13.5")}
      {seg("left", "M2.5 2.5V13.5")}
      {seg("right", "M13.5 2.5V13.5")}
      {seg("h", "M2.5 8H13.5")}
      {seg("v", "M8 2.5V13.5")}
    </svg>
  )
}

/**
 * 边框预设单选组：与 Segmented 同一槽（SEG_TRACK_FRAME、选中块 SEG_ON），排成 5 × 2；role="radiogroup"，每项 tooltip 为预设名。
 * 选中项的线加粗（实线 1.5 → 2、虚线 1 → 1.5，data-v3-edge + v3-on-cue，v3.css），作选中的非颜色线索（rulings §4.25 DS-35）。
 * 锁定时当前项保留选中块，其余 text-3，点击不改值。
 */
export function BorderPresetGroup({ value, onChange, reason }: { value: BorderPreset; onChange?: (v: BorderPreset) => void; reason?: string | null }) {
  return (
    <div role="radiogroup" aria-label={withReason("边框", reason)} className={cn("grid grid-cols-5 gap-0.5", SEG_TRACK_FRAME)}>
      {BORDER_PRESETS.map((b) => {
        const on = value === b.v
        return (
          <Tip key={b.v} label={reason ? `${b.label} · ${reason}` : b.label}>
            <button
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={withReason(b.label, reason)}
              aria-disabled={reason ? true : undefined}
              onClick={() => !reason && onChange?.(b.v)}
              className={cn(
                "flex h-6 min-w-0 items-center justify-center rounded-[3px] transition-colors",
                on && SEG_ON,
                reason ? cn("cursor-default", on ? "text-(--v3-text-2)" : "text-(--v3-text-3)") : on ? "text-(--v3-text)" : "text-(--v3-text-2) hover:text-(--v3-text)",
              )}
            >
              <BorderIcon v={b.v} />
            </button>
          </Tip>
        )
      })}
    </div>
  )
}
