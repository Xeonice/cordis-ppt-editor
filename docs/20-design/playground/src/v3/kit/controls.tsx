import { Fragment, useId, useState, type HTMLAttributes, type KeyboardEvent, type ReactNode } from "react"
import { Check, ChevronDown, ChevronRight, CircleAlert, Info, LoaderCircle } from "lucide-react"
import { Checkbox as CB, Slider as SL } from "radix-ui"
import { cn } from "@/lib/utils"
import { Attribution, FIELD_FRAME, hasCjk, ICON, ownedLabel, Tip, withReason } from "../ui"

/**
 * 检查器常用控件（v3 规格：控件高 28px、圆角 4px；输入只铺 panel-2 淡底、悬停出细边，聚焦时这条 1px 线换强调色；中文 ≥ 12px，11px 只给数字与西文）。
 * 输入类字段与 ui.tsx 的 Field 同一画法（FIELD_FRAME：淡底、不描边，悬停出一道与分隔线同档的细边，rulings §4.25 DS-35 修订 DS-9 的「1px 独立边界」），聚焦 / 报错只换这条线的颜色；
 * 颜色字段 ColorField 与内置颜色行同一画法（FIELD_FRAME：色值与不透明度都可直接输入，属输入类；中间的竖线是 --v3-field-split）；
 * 框内标签、单位与计数是可读信息，用 text-2（DS-9：text-3 只给占位与不可用）。不可用的字段仍可聚焦，聚焦时同样画强调色线（焦点可见）。
 * ui.tsx 已有的直接用：Field（简单输入）、MenuField / SelectTrigger（下拉）、Segmented（分段）、ToggleStrip（B I U S）、Swatch（文档色块）、
 * Section / PanelTitle / Cols（检查器骨架）、Button / IconButton / Tip。这里补齐其余的。
 */

const labelSize = (s: string) => (hasCjk(s) ? "text-[12px]" : "text-[11px]")

/* ------------------------------------------------------------------ 数值输入 */

export interface NumberFieldProps {
  /** 框内左侧标签：单字母（X、W）11px，中文（字号、段前）12px */
  label?: string
  /** 受控值；不传时用 defaultValue */
  value?: string
  defaultValue?: string
  onChange?: (v: string) => void
  /** 单位后缀（pt、cm、%） */
  unit?: string
  aria: string
  /** 多选不一致：值留空，显示占位「多个值」（03-03 混合值）；在里面输入即统一应用 */
  mixed?: boolean
  /** 校验错误：红色 1px 内描边 + 下方一行说明（03-03 校验错误） */
  error?: string
  /** 不可用：文字退到 text-3、底色再降一档（--v3-field-fill-off）、无边、不响应悬停；仍可聚焦（aria-disabled），聚焦时照常画强调色线 */
  disabled?: boolean
  /** 不可用原因：工具提示，并附在读屏名后（如「M3 提供」「需要编辑权限」） */
  reason?: string
  anchor?: string
  className?: string
}

/** 28px 数值字段：标签在框内左侧，数字 tabular-nums，可带单位、混合值、校验错误与不可用原因。 */
export function NumberField({ label, value, defaultValue, onChange, unit, aria, mixed, error, disabled, reason, anchor, className }: NumberFieldProps) {
  const id = useId()
  const errId = `${id}-err`
  const valueProps = value !== undefined ? { value: mixed ? "" : value, onChange: (e: { target: { value: string } }) => onChange?.(e.target.value) } : { defaultValue: mixed ? "" : defaultValue }
  const field = (
    <label
      data-v3-anchor={anchor}
      className={cn(
        FIELD_FRAME,
        "flex h-7 min-w-0 items-center gap-2 px-2 transition-colors focus-within:ring-(--v3-accent)",
        disabled ? "bg-(--v3-field-fill-off) ring-(--v3-field-line-off)" : "hover:bg-(--v3-field-fill-hover)",
        error && "ring-(--v3-danger) focus-within:ring-(--v3-danger)",
      )}
    >
      {label && <span className={cn("shrink-0 leading-none", disabled ? "text-(--v3-text-3)" : "text-(--v3-text-2)", labelSize(label))}>{label}</span>}
      <input
        {...valueProps}
        placeholder={mixed ? "多个值" : undefined}
        aria-label={reason ? `${aria}（${reason}）` : aria}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        aria-disabled={disabled || undefined}
        readOnly={disabled}
        spellCheck={false}
        inputMode="decimal"
        className={cn(
          "min-w-0 flex-1 bg-transparent text-[12px] leading-none tabular-nums outline-none",
          // 「多个值」不是占位而是当前值的说明（可读信息，DS-9：text-2）
          mixed ? "placeholder:text-(--v3-text-2)" : "placeholder:text-(--v3-text-3)",
          disabled ? "text-(--v3-text-3)" : "text-(--v3-text)",
        )}
      />
      {unit && <span className={cn("shrink-0 leading-none", disabled ? "text-(--v3-text-3)" : "text-(--v3-text-2)", labelSize(unit))}>{unit}</span>}
    </label>
  )
  return (
    <div className={cn("min-w-0", className)}>
      {disabled && reason ? <Tip label={reason}>{field}</Tip> : field}
      {error && (
        <p id={errId} className="mt-1 text-[12px] leading-4 text-(--v3-danger)">
          {error}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ 文本输入 */

/** 28px 文本输入（搜索、查找、替换、名称）：可带前置图标与尾部内容（计数、清除按钮）；可不可用（+ 原因）、可报错。 */
export function TextField({
  leading,
  trailing,
  placeholder,
  value,
  defaultValue,
  onChange,
  onKeyDown,
  aria,
  anchor,
  autoFocus,
  inputMode,
  disabled,
  reason,
  error,
  className,
}: {
  leading?: ReactNode
  trailing?: ReactNode
  placeholder?: string
  value?: string
  defaultValue?: string
  onChange?: (v: string) => void
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  aria: string
  anchor?: string
  autoFocus?: boolean
  inputMode?: "text" | "numeric" | "decimal" | "url" | "search"
  /** 不可用：只读、文字退到 text-3、不响应悬停；仍可聚焦（aria-disabled） */
  disabled?: boolean
  /** 不可用原因：工具提示，并附在读屏名后 */
  reason?: string
  /** 校验错误：危险色 1px 内描边；给字符串时下方再加一行说明 */
  error?: boolean | string
  className?: string
}) {
  const id = useId()
  const errId = `${id}-err`
  const valueProps = value !== undefined ? { value, onChange: (e: { target: { value: string } }) => onChange?.(e.target.value) } : { defaultValue }
  const field = (
    <label
      data-v3-anchor={anchor}
      className={cn(
        FIELD_FRAME,
        "flex h-7 min-w-0 items-center gap-2 px-2 transition-colors focus-within:ring-(--v3-accent)",
        disabled ? "bg-(--v3-field-fill-off) text-(--v3-text-3) ring-(--v3-field-line-off)" : "text-(--v3-text-2) hover:bg-(--v3-field-fill-hover)",
        error && "ring-(--v3-danger) focus-within:ring-(--v3-danger)",
        typeof error === "string" ? undefined : className,
      )}
    >
      {leading}
      <input
        {...valueProps}
        placeholder={placeholder}
        aria-label={withReason(aria, disabled ? reason : undefined)}
        aria-disabled={disabled || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={typeof error === "string" ? errId : undefined}
        readOnly={disabled}
        autoFocus={autoFocus}
        inputMode={inputMode}
        onKeyDown={onKeyDown}
        spellCheck={false}
        className={cn("min-w-0 flex-1 bg-transparent text-[12px] leading-none outline-none placeholder:text-(--v3-text-3)", disabled ? "text-(--v3-text-3)" : "text-(--v3-text)")}
      />
      {trailing}
    </label>
  )
  const tipped = disabled && reason ? <Tip label={reason}>{field}</Tip> : field
  if (typeof error !== "string") return tipped
  return (
    <div className={cn("min-w-0", className)}>
      {tipped}
      <p id={errId} className="mt-1 text-[12px] leading-4 text-(--v3-danger)">
        {error}
      </p>
    </div>
  )
}

/** 多行输入（替代文本、说明）：panel-2 淡底、不描边（FIELD_FRAME）、圆角 4、12px / 18px 行高（单行时正好 28px 高）；max 给了在右下角显示字数「n/max」（11px 数字）。 */
export function TextArea({
  defaultValue = "",
  placeholder,
  aria,
  max,
  rows = 3,
  disabled,
  reason,
  className,
}: {
  defaultValue?: string
  placeholder?: string
  aria: string
  max?: number
  rows?: number
  /** 不可用：只读、文字退到 text-3；仍可聚焦（aria-disabled） */
  disabled?: boolean
  reason?: string
  className?: string
}) {
  const [v, setV] = useState(defaultValue)
  const box = (
    <div
      className={cn(FIELD_FRAME, "relative transition-colors focus-within:ring-(--v3-accent)", disabled ? "bg-(--v3-field-fill-off) ring-(--v3-field-line-off)" : "hover:bg-(--v3-field-fill-hover)", className)}
    >
      <textarea
        value={v}
        onChange={(e) => setV(max ? e.target.value.slice(0, max) : e.target.value)}
        readOnly={disabled}
        aria-disabled={disabled || undefined}
        aria-label={withReason(aria, disabled ? reason : undefined)}
        placeholder={placeholder}
        rows={rows}
        spellCheck={false}
        className={cn(
          "block w-full resize-none bg-transparent px-2 pt-[5px] text-[12px] leading-[18px] outline-none select-text placeholder:text-(--v3-text-3)",
          max !== undefined ? "pb-5" : "pb-[5px]",
          disabled ? "text-(--v3-text-3)" : "text-(--v3-text)",
        )}
      />
      {max !== undefined && (
        <span className="pointer-events-none absolute right-2 bottom-1.5 text-[11px] leading-none text-(--v3-text-2) tabular-nums">
          {v.length}/{max}
        </span>
      )}
    </div>
  )
  return disabled && reason ? <Tip label={reason}>{box}</Tip> : box
}

/* ------------------------------------------------------------------ 颜色 */

/** 任意文档色的小色块（16px、圆角 3px、细内描边）。文档色是内容，不是 UI token，所以用内联背景色。 */
export function ColorChip({ color, className }: { color?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-4 shrink-0 rounded-[3px] shadow-[inset_0_0_0_1px_var(--v3-swatch-line)]", !color && "bg-(--v3-panel-3)", className)}
      style={color ? { backgroundColor: color } : undefined}
    />
  )
}

/**
 * 颜色字段：色块按钮 + 十六进制 + 不透明度，一个 28px 字段（与内置「填充」「颜色」行同一外观）。
 * 色块是可聚焦按钮（读屏名含色值，03-03）；给 swatchAnchor 后，可以把 Popover（如 SwatchPicker）锚在色块上。
 */
export function ColorField({
  color,
  hex,
  opacity = "100%",
  aria,
  mixed,
  anchor,
  swatchAnchor,
  onSwatchClick,
}: {
  /** 色块颜色（CSS 颜色） */
  color: string
  /** 输入框里的色值文字，缺省同 color */
  hex?: string
  opacity?: string
  aria: string
  mixed?: boolean
  anchor?: string
  swatchAnchor?: string
  onSwatchClick?: () => void
}) {
  const text = hex ?? color
  return (
    <div
      data-v3-anchor={anchor}
      className={cn(FIELD_FRAME, "flex h-7 items-center transition-colors focus-within:ring-(--v3-accent) hover:bg-(--v3-field-fill-hover)")}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 pl-2">
        <button type="button" data-v3-anchor={swatchAnchor} aria-label={`${aria}：${mixed ? "多个值" : text}`} onClick={onSwatchClick} className="flex shrink-0 rounded-[3px]">
          <ColorChip color={mixed ? undefined : color} />
        </button>
        <input
          defaultValue={mixed ? "" : text}
          placeholder={mixed ? "多个值" : undefined}
          aria-label={`${aria} 颜色值`}
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-[12px] leading-none text-(--v3-text) tabular-nums outline-none placeholder:text-(--v3-text-2)"
        />
      </div>
      <span aria-hidden="true" className="h-(--v3-field-split-h) w-px bg-(--v3-field-split)" />
      <input
        defaultValue={mixed ? "" : opacity}
        aria-label={`${aria} 不透明度`}
        spellCheck={false}
        className="w-12 bg-transparent pr-2 text-right text-[12px] leading-none text-(--v3-text) tabular-nums outline-none"
      />
    </div>
  )
}

export interface SwatchColor {
  hex: string
  name: string
}

/**
 * 色块选择：分组的色块网格（主题颜色 / 标准色 / 最近使用），方块最大 20px、圆角 4px、间距 6px；
 * 每行 10 个时自然宽 254px（弹层里正好），放进更窄的地方（检查器内容区 248px）时方块等比缩小，不会被裁掉。
 * 选中项 2px 强调色外圈（隔 2px panel 底），悬停 1px 灰圈。每个色块带工具提示「名称 色值」。
 */
export function SwatchPicker({
  groups,
  value,
  defaultValue,
  onChange,
  columns = 10,
  aria,
}: {
  groups: { label?: string; colors: SwatchColor[] }[]
  value?: string
  defaultValue?: string
  onChange?: (hex: string) => void
  /** 每行几个（缺省 10，宽 254px） */
  columns?: number
  aria: string
}) {
  const [inner, setInner] = useState(defaultValue)
  const v = (value ?? inner)?.toLowerCase()
  return (
    <div role="group" aria-label={aria} className="flex flex-col gap-3">
      {groups.map((g, gi) => (
        <div key={g.label ?? gi} className="flex flex-col gap-2">
          {g.label && <p className="text-[12px] leading-4 text-(--v3-text-2)">{g.label}</p>}
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 20px))` }}>
            {g.colors.map((c) => {
              const on = c.hex.toLowerCase() === v
              return (
                <Tip key={`${c.hex}-${c.name}`} label={`${c.name} ${c.hex.toUpperCase()}`}>
                  <button
                    type="button"
                    aria-label={c.name}
                    aria-pressed={on}
                    onClick={() => {
                      setInner(c.hex)
                      onChange?.(c.hex)
                    }}
                    className={cn(
                      "aspect-square w-full rounded-[4px] shadow-[inset_0_0_0_1px_var(--v3-swatch-line)] transition-shadow",
                      on ? "ring-2 ring-(--v3-accent) ring-offset-2 ring-offset-(--v3-panel)" : "hover:ring-1 hover:ring-(--v3-hover-line) hover:ring-offset-1 hover:ring-offset-(--v3-panel)",
                    )}
                    style={{ backgroundColor: c.hex }}
                  />
                </Tip>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ 滑块 */

/** 滑块：4px 灰槽、已选段 text-2、12px 白色圆钮 + 控件边界色描边（圆钮是控件部件，不是药丸按钮）。不加阴影（只有浮层带阴影）。 */
export function Slider({
  value,
  defaultValue = 50,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  disabled,
  aria,
  className,
}: {
  value?: number
  defaultValue?: number
  min?: number
  max?: number
  step?: number
  onValueChange?: (v: number) => void
  disabled?: boolean
  aria: string
  className?: string
}) {
  return (
    <SL.Root
      value={value !== undefined ? [value] : undefined}
      defaultValue={value === undefined ? [defaultValue] : undefined}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={(v) => onValueChange?.(v[0] ?? min)}
      className={cn("relative flex h-7 w-full min-w-0 touch-none items-center select-none", className)}
    >
      <SL.Track className="relative h-1 grow overflow-hidden rounded-[2px] bg-(--v3-panel-3)">
        <SL.Range className="absolute h-full bg-(--v3-text-2) data-disabled:bg-(--v3-text-3)" />
      </SL.Track>
      <SL.Thumb
        aria-label={aria}
        className="block size-3 rounded-full border border-(--v3-border-control) bg-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--v3-accent) data-disabled:bg-(--v3-panel-3)"
      />
    </SL.Root>
  )
}

/** 滑块 + 数值框（透明度、亮度这类 0–100 的属性）。 */
export function SliderField({ defaultValue = 100, unit = "%", aria, disabled, min = 0, max = 100 }: { defaultValue?: number; unit?: string; aria: string; disabled?: boolean; min?: number; max?: number }) {
  const [v, setV] = useState(defaultValue)
  return (
    <div className="grid grid-cols-[1fr_64px] items-center gap-2">
      <Slider value={v} min={min} max={max} onValueChange={setV} disabled={disabled} aria={aria} />
      <NumberField
        value={String(v)}
        onChange={(s) => {
          const n = Number(s.replace(/[^\d.]/g, ""))
          if (!Number.isNaN(n)) setV(Math.min(max, Math.max(min, n)))
        }}
        unit={unit}
        aria={aria}
        disabled={disabled}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ 勾选 */

/**
 * 16px 复选框：圆角 4px；勾上为强调色底白勾（勾选即选中，属于强调色的用途）。
 * 未勾的框是控件边界 --v3-border-control（对面板 ≥ 3:1，DS-9）。不可用：aria-disabled（仍可聚焦，FE-06）、点了不变；未勾为 border 色框，已勾为 text-3 实底。
 */
export function Checkbox({
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  aria,
  id,
}: {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (v: boolean) => void
  disabled?: boolean
  aria?: string
  id?: string
}) {
  const [inner, setInner] = useState(!!defaultChecked)
  const on = checked ?? inner
  return (
    <CB.Root
      id={id}
      checked={on}
      onCheckedChange={(v) => {
        if (disabled) return
        setInner(v === true)
        onCheckedChange?.(v === true)
      }}
      aria-disabled={disabled || undefined}
      data-disabled={disabled ? "" : undefined}
      aria-label={aria}
      className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-(--v3-border-control) text-(--v3-accent-fg) transition-colors data-[state=checked]:border-(--v3-accent) data-[state=checked]:bg-(--v3-accent) data-disabled:cursor-default data-disabled:border-(--v3-border) data-disabled:data-[state=checked]:border-(--v3-text-3) data-disabled:data-[state=checked]:bg-(--v3-text-3)"
    >
      <CB.Indicator>
        <Check size={12} strokeWidth={2.25} aria-hidden="true" />
      </CB.Indicator>
    </CB.Root>
  )
}

/** 一行勾选：复选框 + 12px 标签（+ 右侧 text-2 说明），28px 高。不可用时标签退到 text-3；reason 给了就带工具提示并附在读屏名后。 */
export function CheckRow({
  label,
  hint,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  reason,
}: {
  label: string
  hint?: string
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (v: boolean) => void
  disabled?: boolean
  reason?: string
}) {
  const id = useId()
  const box = <Checkbox id={id} checked={checked} defaultChecked={defaultChecked} onCheckedChange={onCheckedChange} disabled={disabled} aria={disabled && reason ? withReason(label, reason) : undefined} />
  return (
    <div className="flex h-7 items-center gap-2">
      {disabled && reason ? <Tip label={reason}>{box}</Tip> : box}
      <label htmlFor={id} className={cn("min-w-0 flex-1 text-[12px] leading-4 select-none", disabled ? "text-(--v3-text-3)" : "text-(--v3-text)")}>
        {label}
      </label>
      {hint && <span className={cn("shrink-0 leading-4 text-(--v3-text-2)", labelSize(hint))}>{hint}</span>}
    </div>
  )
}

/* ------------------------------------------------------------------ 单选 */

/** 16px 单选圆点：未选 1px 控件边界色圈（--v3-border-control）；选中为强调色实心 + 白点（与 Checkbox 的勾选同一用法）；不可用时退到 border / text-3。 */
export function RadioDot({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
        checked ? (disabled ? "border-(--v3-text-3) bg-(--v3-text-3)" : "border-(--v3-accent) bg-(--v3-accent)") : disabled ? "border-(--v3-border)" : "border-(--v3-border-control)",
      )}
    >
      {checked && <span className="size-1.5 rounded-full bg-(--v3-accent-fg)" />}
    </span>
  )
}

/** 一行单选（28px）：圆点 + 可选图标 + 12px 标签；悬停 panel-2 底（左右各外扩 6px，圆点仍与左缘对齐）。不可用：aria-disabled、可聚焦、text-3。 */
export function RadioRow({
  checked,
  label,
  icon,
  disabled,
  reason,
  onSelect,
  className,
  children,
}: {
  checked: boolean
  label: string
  icon?: ReactNode
  disabled?: boolean
  reason?: string
  onSelect?: () => void
  className?: string
  children?: ReactNode
}) {
  const row = (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      aria-label={disabled && reason ? withReason(label, reason) : undefined}
      onClick={() => !disabled && onSelect?.()}
      className={cn(
        "-mx-1.5 flex h-7 min-w-0 items-center gap-2 rounded-[4px] px-1.5 text-left text-[12px] leading-none transition-colors",
        disabled ? "cursor-default text-(--v3-text-3)" : "text-(--v3-text) hover:bg-(--v3-panel-2)",
        className,
      )}
    >
      <RadioDot checked={checked} disabled={disabled} />
      {icon && <span className={cn("flex shrink-0", disabled ? "text-(--v3-text-3)" : "text-(--v3-text-2)")}>{icon}</span>}
      <span className="min-w-0 whitespace-nowrap">{label}</span>
      {children}
    </button>
  )
  return disabled && reason ? <Tip label={reason}>{row}</Tip> : row
}

/* ------------------------------------------------------------------ 进度 */

/** 确定态进度条：4px 高、圆角 2，panel-3 槽 + text-2 已完成段（与滑块同一配色；进度不是选中，不用强调色）。 */
export function Progress({ value, label, className }: { value: number; label: string; className?: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className={cn("h-1 shrink-0 overflow-hidden rounded-[2px] bg-(--v3-panel-3)", className)}>
      <div className="h-full rounded-[2px] bg-(--v3-text-2)" style={{ width: `${value}%` }} />
    </div>
  )
}

/* ------------------------------------------------------------------ 检查器骨架补充 */

/**
 * 可折叠的检查器分区：标题行整行可点，右侧 ▾ / ▸；左缘与普通 Section 标题对齐（Q6）。
 * 用在默认收起的分区（如 03-30 的「表格样式」「行高与列宽」）。
 */
export function FoldSection({
  title,
  count,
  tag,
  owner,
  headAnchor,
  defaultOpen = true,
  children,
  className,
  bodyClassName,
  anchor,
}: {
  title: string
  /** 标题后的计数（12px text-2、字重 400，同 Section） */
  count?: number
  /** 标题后的小标记（如 M2 时的「M3」） */
  tag?: string
  /** 插件贡献的分区（06 §2.12）：标题后带归属标识，展开按钮的读屏名「标题（由「插件名」提供）」 */
  owner?: { plugin: string; vendor?: string }
  /** 标题行按钮的锚点名（对话框关闭后把焦点交回这里，如「最近删除」里的彻底删除确认） */
  headAnchor?: string
  defaultOpen?: boolean
  children: ReactNode
  className?: string
  /** 内容区的间距等，缺省 gap-2；分组之间可用 gap-3 */
  bodyClassName?: string
  anchor?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section data-v3-anchor={anchor} className={cn("border-b border-(--v3-border) px-4 py-3 last:border-b-0", className)}>
      {/* 标题行净高 16px（按钮 24px、上下各 −4px），与 Section 的标题行一致 */}
      <h3 className="-mx-1.5 -my-1">
        <button
          type="button"
          aria-expanded={open}
          aria-label={ownedLabel(title, owner)}
          data-v3-anchor={headAnchor}
          onClick={() => setOpen((o) => !o)}
          className="flex h-6 w-full items-center gap-1.5 rounded-[4px] px-1.5 text-left transition-colors hover:bg-(--v3-panel-2)"
        >
          <span className="text-[12px] leading-4 font-semibold text-(--v3-text)">{title}</span>
          {count !== undefined && <span className="text-[12px] leading-4 text-(--v3-text-2) tabular-nums">{count}</span>}
          {tag && <Tag>{tag}</Tag>}
          {owner && <Attribution plugin={owner.plugin} vendor={owner.vendor} />}
          <ChevronDown size={12} strokeWidth={1.5} aria-hidden="true" className={cn("ml-auto shrink-0 text-(--v3-text-2) transition-transform", !open && "-rotate-90")} />
        </button>
      </h3>
      {open && <div className={cn("mt-2 flex flex-col gap-2", bodyClassName)}>{children}</div>}
    </section>
  )
}

/**
 * 列表里的折叠 / 展开行（第 2 批统一画法，第 6 轮集成并入底座）：评论「已解决 N」、版本历史的月份行、自动版本组行与「最近删除」共用这一个件。
 * 设计 04 只规定了检查器的可折叠分区（FoldSection：标题行整行可点、右侧 ▾，§4.1a），没有列表折叠行的规定，按集成定的口径统一（第 2 批拍板时一并定下，登记进 04 §2.14）：
 * 高 32、箭头在前（ChevronRight 12、描边 1.5，展开转 90°；减少动态效果时不转场，motion-reduce:transition-none）、文字 12px text-2（悬停铺 panel-2、文字转主色）、
 * 箭头与文字间距 6、整行一个按钮、aria-expanded。左缘与列表正文对齐（16）：inset 是版本列表那种左右内缩 8、圆角 6 的行（列表容器自带 8，行内再 8），
 * 缺省是评论列表那种通栏行（行内 16）——悬停底色的形状随所在列表的行。disabled（离线缓存等）：文字退到 text-3、不铺悬停底、aria-disabled，点了无效。
 * touch：仅查看形态（< 640）的触控尺寸——高 44（触控 ≥ 44，04 §5）、13px、箭头 16，没有悬停底（同一画法、只放大）。
 * 其余属性（data-*、data-v3-anchor 等锚点）原样落在按钮上。
 */
export function FoldRow({
  open,
  onToggle,
  disabled,
  inset,
  touch,
  className,
  children,
  ...rest
}: {
  open: boolean
  onToggle: () => void
  disabled?: boolean
  inset?: boolean
  touch?: boolean
  className?: string
  children: ReactNode
} & Omit<HTMLAttributes<HTMLButtonElement>, "onClick" | "children" | "className">) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && onToggle()}
      className={cn(
        "flex w-full items-center gap-1.5 text-left",
        touch ? "h-11 px-4 text-[13px]" : cn("h-8 text-[12px] transition-colors", inset ? "rounded-[6px] px-2" : "px-4"),
        // leading-none 要排在字号之后：tailwind-merge 会让后出现的字号类去掉前面的行高类（原来三处写法都是字号在前、行高在后）
        "leading-none",
        disabled ? "cursor-default text-(--v3-text-3)" : cn("text-(--v3-text-2)", !touch && "hover:bg-(--v3-panel-2) hover:text-(--v3-text)"),
        className,
      )}
      {...rest}
    >
      <ChevronRight size={touch ? 16 : 12} strokeWidth={1.5} aria-hidden="true" className={cn("shrink-0 transition-transform motion-reduce:transition-none", open && "rotate-90")} />
      {children}
    </button>
  )
}

/** 左标签 + 右控件的一行（28px）：用于开关、单个下拉等没有框内标签的属性，如「隐藏此页」。 */
export function PropRow({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-7 items-center justify-between gap-3", className)}>
      <span className="min-w-0 text-[12px] leading-4 text-(--v3-text-2)">{label}</span>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

/** 检查器顶部的说明行：只读、离线未同步、继承自版式等（03-03 只读 / 离线）。图标缺省为 Info。 */
export function InspectorNotice({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div role="note" className="flex items-start gap-2 border-b border-(--v3-border) px-4 py-2.5 text-[12px] leading-[18px] text-(--v3-text-2)">
      <span className="flex h-[18px] shrink-0 items-center">{icon ?? <Info {...ICON} aria-hidden="true" />}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** 空状态说明（面板里没有内容时）：12px text-2 居中（可读信息，DS-9）。 */
export function EmptyNote({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 py-10 text-center text-[12px] leading-[18px] text-(--v3-text-2)", className)}>{children}</div>
}

/**
 * 加载中的一行（第 2 批统一：不画灰色骨架条，Q8）：转圈 14 + 一句话（12px text-2），role=status。
 * 两种位置只有一种画法——列表里（如版本列表「当前版本」之下、分享「有权限的用户」一节里）左对齐、行高 32；
 * 整栏 / 整块还没有任何内容时（如评论页签、插件列表）center：居中、上下 40（与 EmptyNote 同一位置）。
 * 程序转交焦点的落点（如分享「重试」后）：focusable 给 tabIndex −1（不进 Tab 顺序），label 给读屏名——role=status 不从内容取名，焦点落下时读屏才念得出「正在加载…」。
 * 其余属性（data-*）原样落在这一行上。外观不变。
 */
export function LoadingRow({
  children,
  center,
  className,
  focusable,
  label,
  ...rest
}: { children: ReactNode; center?: boolean; className?: string; focusable?: boolean; label?: string } & Omit<HTMLAttributes<HTMLDivElement>, "children" | "className" | "role">) {
  return (
    <div
      role="status"
      aria-label={label}
      tabIndex={focusable ? -1 : undefined}
      {...rest}
      className={cn("flex items-center gap-2 text-[12px] leading-4 text-(--v3-text-2)", center ? "justify-center px-4 py-10" : "h-8 px-2", className)}
    >
      <LoaderCircle size={14} strokeWidth={1.75} aria-hidden="true" className="shrink-0 motion-safe:animate-spin" />
      {children}
    </div>
  )
}

/**
 * 面板 / 对话框里整块的状态（第 2 批统一）：加载失败、面板不可用、没有差异这类「内容区换成一句话」的状态都用它，结构、尺寸与间距只有一份——
 * 居中；图标 20（tone：danger 危险色 CircleAlert 缺省、neutral 中性 text-2、success 成功色）· 标题 13px 600 · 说明 12px text-2 · 操作（次按钮，「重试」）· 补充说明。
 * 错误态（tone danger）role=alert。只有一句说明、没有标题的空列表用 EmptyNote。
 *
 *   <PanelState title="版本历史加载失败" action={<Button variant="secondary" onClick={retry}>重试</Button>}>请检查网络连接后重试</PanelState>
 */
export function PanelState({
  title,
  children,
  icon,
  tone = "danger",
  action,
  note,
  className,
}: {
  title: string
  /** 说明（一两句，12px text-2；长句用 Phrases 分段） */
  children?: ReactNode
  /** 换图标（20px，lucide 描边 1.5）；缺省按 tone：danger CircleAlert */
  icon?: ReactNode
  tone?: "danger" | "neutral" | "success"
  /** 操作：次按钮（Button secondary），一般是「重试」 */
  action?: ReactNode
  /** 操作下方的补充说明（如「仅在本会话重试；如持续失败，请联系管理员」） */
  note?: ReactNode
  className?: string
}) {
  const color = tone === "danger" ? "text-(--v3-danger)" : tone === "success" ? "text-(--v3-success)" : "text-(--v3-text-2)"
  return (
    <div role={tone === "danger" ? "alert" : undefined} className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <span className={cn("flex", color)}>{icon ?? <CircleAlert size={20} strokeWidth={1.5} aria-hidden="true" />}</span>
      <p className="mt-3 text-[13px] leading-4 font-semibold text-(--v3-text)">{title}</p>
      {children && <p className="mt-2 text-[12px] leading-[18px] text-(--v3-text-2)">{children}</p>}
      {action && <div className="mt-4 flex items-center justify-center gap-2">{action}</div>}
      {note && <p className="mt-3 text-[12px] leading-[18px] text-(--v3-text-2)">{note}</p>}
    </div>
  )
}

/**
 * 中文长句按词组换行（Q7：不断在词中间，如「公 / 式」「折 / 线」「缩 / 放」）：每段整体不折行，段与段之间才可以断（<wbr>）。
 * 分段时让每段都放得下最窄的容器（检查器 280 内约 17 个汉字），超长的段会溢出。说明、确认文案、状态说明里的长句用它。
 */
export function Phrases({ parts }: { parts: string[] }) {
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          <span className="whitespace-nowrap">{p}</span>
        </Fragment>
      ))}
    </>
  )
}

/**
 * 开关（role=switch，安静样式，rulings §4.25 DS-35 / DS-36）：关 = 分段槽同一淡底（--v3-seg-track）+ 1px 细边（--v3-border，同下拉、次按钮）+ text-2 圆钮；开 = 强调色底 + 白色圆钮（「按下的开关」属强调色的用途）；
 * 圆钮位置与颜色一起表达状态，不靠边框。轨道 28 × 16、两端半圆（控件部件，同滑块圆钮，不是药丸按钮）。
 * 不可用：aria-disabled、仍可聚焦，工具提示写原因（FE-06）；开着的轨道退成 text-3，关着的圆钮退到 text-3。个人插件面板的启停（03-09 §5）用它。
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  reason,
}: {
  checked: boolean
  onChange?: (v: boolean) => void
  /** 可读名称，如「演示激光笔，个人设置，只影响你」 */
  label: string
  disabled?: boolean
  reason?: string
}) {
  const btn = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={disabled && reason ? `${label}（${reason}）` : label}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && onChange?.(!checked)}
      className={cn(
        "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors",
        // 关态：槽色淡底 + 与分隔线同档的 1px 内描边（与下拉、次按钮的细边同档），轨道的形状读得出来，不只剩一个圆钮
        checked ? (disabled ? "bg-(--v3-text-3)" : "bg-(--v3-accent)") : "bg-(--v3-seg-track) ring-1 ring-(--v3-border) ring-inset",
        disabled && "cursor-default",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0.5 size-3 rounded-full transition-transform",
          checked ? "translate-x-[14px] bg-(--v3-accent-fg)" : cn("translate-x-0.5", disabled ? "bg-(--v3-text-3)" : "bg-(--v3-text-2)"),
        )}
      />
    </button>
  )
  return disabled && reason ? <Tip label={reason}>{btn}</Tip> : btn
}

/** 小标记：里程碑、优先级等（M3、P2、Beta）。1px 边、圆角 4px；西文 11px，中文 12px。 */
export function Tag({ children, className }: { children: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-[4px] border border-(--v3-border) leading-none font-medium text-(--v3-text-2)",
        hasCjk(children) ? "h-[18px] px-1.5 text-[12px]" : "h-4 px-1 text-[11px]",
        className,
      )}
    >
      {children}
    </span>
  )
}

/** 键帽（提示条里的修饰键，如 Shift、Alt、Esc）：1px 边、圆角 4、18px 高；西文 11px，中文 12px。 */
export function KeyCap({ children }: { children: string }) {
  return (
    <kbd className={cn("inline-flex h-[18px] shrink-0 items-center rounded-[4px] border border-(--v3-border) px-1 font-sans leading-none text-(--v3-text-2)", labelSize(children))}>
      {children}
    </kbd>
  )
}

/** 快捷键提示（⌘K、⇧⌘V）：11px text-2（可读信息，DS-9）；含中文时 12px。 */
export function Kbd({ children, className }: { children: string; className?: string }) {
  return <kbd className={cn("font-sans leading-none text-(--v3-text-2)", labelSize(children), className)}>{children}</kbd>
}
