import { useContext, useId, useRef, useState, type ComponentProps, type ReactNode } from "react"
import { Blocks, Check, ChevronDown } from "lucide-react"
import { DropdownMenu as DM } from "radix-ui"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { keepMovedFocus, useFocusBackOnClose } from "./kit/layer"
import { V3RootContext } from "./V3Root"

/** v3 图标规格：lucide、16px、描边 1.5。 */
export const ICON = { size: 16, strokeWidth: 1.5 } as const
/** 底部工具条与形状弹层用 20px（按钮仍是 36px）。 */
export const ICON_LG = { size: 20, strokeWidth: 1.5 } as const

/** 含中文的文本最小 12px；11px 只留给纯数字与西文（单字母标签、页码、百分比）。 */
export const hasCjk = (s: string) => /[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/.test(s)

/* ------------------------------------------------------------------ 工具提示 */

/**
 * 用 shadcn Tooltip，但 data-slot 改名：全局样式对 tooltip-content 有毛玻璃规则，v3 不要。
 * 浮层挂在 body 上拿不到 v3 token，所以工具提示固定为深色实底，亮暗两套都一样。
 */
export function Tip({
  label,
  kbd,
  side = "top",
  align,
  alignOffset,
  hidden = false,
  open: forced,
  lines,
  children,
}: {
  label: string
  kbd?: string
  side?: "top" | "bottom" | "left" | "right"
  /** 与触发器的对齐（缺省居中）：比触发器宽、居中会被推到窗口边缘时用 start，如左栏同步状态行的说明 */
  align?: "start" | "center" | "end"
  alignOffset?: number
  /** 暂时不弹（如按钮自己的弹层开着）。用受控 open 压住，而不是去掉 Tip 包裹：换结构会让按钮重新挂载、焦点掉到 body */
  hidden?: boolean
  /** 常开（场景状态里演示「聚焦即展开原因」）；不传时悬停 / 键盘聚焦才出现 */
  open?: boolean
  /** 按句分行（不断在词中间）：长原因写成几行，限宽 300px；label 仍是完整文案 */
  lines?: string[]
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Tooltip open={(forced || open) && !hidden} onOpenChange={setOpen}>
      <TooltipTrigger
        asChild
        // 焦点是程序交过来的（如切换视图后）且最近一次操作是鼠标时，按钮不显示焦点环，提示也不弹；键盘操作照常弹出
        onFocus={(e) => {
          if (!e.currentTarget.matches(":focus-visible")) e.preventDefault()
        }}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent
        data-slot="v3-tooltip"
        side={side}
        sideOffset={6}
        align={align}
        alignOffset={alignOffset}
        className={cn(
          "rounded-[6px] bg-(--v3-tooltip-bg) px-2 py-1 text-[12px] text-(--v3-tooltip-fg) [&_svg]:hidden!",
          lines ? "block max-w-[300px] leading-[18px] text-pretty" : "gap-2 leading-4",
        )}
      >
        {lines
          ? lines.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))
          : label}
        {kbd && !lines && <span className="text-[11px] text-(--v3-tooltip-kbd)">{kbd}</span>}
      </TooltipContent>
    </Tooltip>
  )
}

/** 不可用原因的统一写法：工具提示「名称 · 原因」，读屏名「名称（原因）」（rulings §4.20 FE-06：禁用而不隐藏、可聚焦、说明原因）。 */
export const reasonTip = (label: string, reason: string) => `${label} · ${reason}`
export const withReason = (label: string, reason?: string | null) => (reason ? `${label}（${reason}）` : label)

/* ------------------------------------------------------------------ 按钮 */

const BTN_SIZE = {
  24: "size-6 rounded-[4px]",
  28: "size-7 rounded-[6px]",
  36: "size-9 rounded-[8px]",
  /** 触控尺寸（仅查看形态 < 640px、pointer: coarse）：点按区 ≥ 44（WCAG 2.5.5），图标仍 20 */
  44: "size-11 rounded-[8px]",
} as const

/**
 * 弹层 / 菜单打开时触发器的按下态：Radix 触发器自带 data-state=open；场景里锚定打开的 kit 浮层（Popover / Menu 的 anchor 模式）
 * 不经过原触发器，改由 kit 给锚点元素加 data-v3-open（kit/anchor.ts useMarkAnchorOpen），两者外观相同。
 */
const OPEN_GHOST =
  "data-[state=open]:bg-(--v3-panel-2) data-[state=open]:text-(--v3-text) data-[v3-open]:bg-(--v3-panel-2) data-[v3-open]:text-(--v3-text)"

const BTN_VARIANT = {
  ghost: `text-(--v3-text-2) hover:bg-(--v3-panel-2) hover:text-(--v3-text) ${OPEN_GHOST}`,
  /**
   * 按下态（当前视图、锁定比例）：只铺 panel-2、不描边（--v3-on-fill / --v3-on-line，rulings §4.25 DS-35），
   * 另由 v3-on-cue 把图标描边加粗到 2，与 ghost 悬停（同为 panel-2 底、描边 1.5）分开（v3.css）
   */
  on: "v3-on-cue bg-(--v3-on-fill) text-(--v3-text) ring-1 ring-(--v3-on-line) ring-inset",
  /** 只放图标的强调色底：白图标在暗色 #5B7CFF 上 3.63:1（图形 ≥ 3:1 即可）；带文字的强调色底用 Button primary 或 --v3-accent-solid（DS-9） */
  accent: "bg-(--v3-accent) text-(--v3-accent-fg) hover:bg-(--v3-accent-hover)",
} as const

/** 不可用（aria-disabled，仍可聚焦）：文字退到 text-3、不响应悬停（与菜单项、字段的不可用态一致，不用半透明）。 */
const BTN_OFF = "cursor-default text-(--v3-text-3) hover:bg-transparent hover:text-(--v3-text-3)"

type IconButtonProps = Omit<ComponentProps<"button">, "children"> & {
  label: string
  /** 工具提示文字，缺省同 label（不可用且给了 reason 时缺省为「名称 · 原因」） */
  tip?: string
  kbd?: string
  size?: keyof typeof BTN_SIZE
  variant?: keyof typeof BTN_VARIANT
  pressed?: boolean
  tipSide?: "top" | "bottom" | "left" | "right"
  /** 不要工具提示（如作为菜单触发器时）；只能是固定值，运行中切换会让按钮重新挂载 */
  noTip?: boolean
  /** 运行中暂时压住工具提示（如形状弹层开着时），按钮不重新挂载、焦点不丢 */
  tipHidden?: boolean
  /** 工具提示常开（场景状态里演示「不可用的原因」）；tipLines 把长原因按句分行 */
  tipOpen?: boolean
  tipLines?: string[]
  /** 不可用：aria-disabled（仍可聚焦，FE-06）、文字退到 text-3、点按无效 */
  disabled?: boolean
  /** 不可用原因：工具提示「名称 · 原因」，读屏名附原因 */
  reason?: string
  children: ReactNode
}

/** 纯图标按钮：24 / 28 / 36px（触控 44），悬停 panel-2，激活态强调色底白图标，自带工具提示；可设不可用 + 原因。 */
export function IconButton({ label, tip, kbd, size = 28, variant = "ghost", pressed, tipSide, noTip, tipHidden, tipOpen, tipLines, disabled, reason, className, onClick, children, ...rest }: IconButtonProps) {
  const off = !!disabled
  const btn = (
    <button
      type="button"
      aria-label={off ? withReason(label, reason) : label}
      aria-pressed={pressed}
      aria-disabled={off || undefined}
      onClick={(e) => {
        if (off) {
          e.preventDefault()
          return
        }
        onClick?.(e)
      }}
      className={cn("inline-flex shrink-0 items-center justify-center transition-colors", BTN_SIZE[size], BTN_VARIANT[variant], className, off && BTN_OFF)}
      {...rest}
    >
      {children}
    </button>
  )
  if (noTip) return btn
  return (
    <Tip label={tip ?? (off && reason ? reasonTip(label, reason) : label)} kbd={off ? undefined : kbd} side={tipSide} hidden={tipHidden} open={tipOpen} lines={tipLines}>
      {btn}
    </Tip>
  )
}

const TEXT_BTN = {
  /** 次按钮（对话框「取消」、横幅按钮、左栏与检查器里的次要操作）：透明底 + 与分隔线同档的 1px 细边、悬停铺 panel-2（--v3-btn-*，rulings §4.25 DS-37，同 Figma 次按钮），免得与淡底的输入框混淆 */
  secondary:
    "bg-(--v3-btn-fill) text-(--v3-text) ring-1 ring-(--v3-btn-line) ring-inset hover:bg-(--v3-btn-fill-hover) data-[state=open]:bg-(--v3-btn-fill-hover) data-[v3-open]:bg-(--v3-btn-fill-hover)",
  /** 用在 canvas 底上（首页标题栏「导入 .pptx」、打开中 / 打开失败页、上传失败占位）：panel 底 + 细边，亮色画布上才看得出；对话框、横幅、左栏与检查器里的次按钮用 secondary（DS-37） */
  outline: "border border-(--v3-border) bg-(--v3-panel) text-(--v3-text) hover:bg-(--v3-panel-2) data-[state=open]:bg-(--v3-panel-2) data-[v3-open]:bg-(--v3-panel-2)",
  /** 主操作：带文字的强调色实底用 --v3-accent-solid（两套主题都是 #3A5CE6，白字 5.44:1；DS-9 暗色主按钮加深） */
  primary: "bg-(--v3-accent-solid) text-(--v3-accent-fg) hover:bg-(--v3-accent-solid-hover)",
  ghost: `text-(--v3-text-2) hover:bg-(--v3-panel-2) hover:text-(--v3-text) ${OPEN_GHOST}`,
  /** 危险操作的主按钮（删除、放弃更改）：只在确认危险操作时用 */
  danger: "bg-(--v3-danger-solid) text-white hover:bg-(--v3-danger-hover)",
} as const

/** 不可用的文字按钮：主按钮与 danger 退成 panel-2 底 + text-3（不再保留强调色 / 危险色）；secondary 仍是透明底、细边降为 panel-2；outline 保留细边；ghost 只退文字。 */
const TEXT_BTN_OFF = {
  secondary: "bg-(--v3-btn-fill) text-(--v3-text-3) ring-(--v3-btn-line-off) hover:bg-(--v3-btn-fill)",
  outline: "border border-(--v3-border) bg-(--v3-panel) text-(--v3-text-3) hover:bg-(--v3-panel)",
  primary: "bg-(--v3-panel-2) text-(--v3-text-3) hover:bg-(--v3-panel-2)",
  ghost: "text-(--v3-text-3) hover:bg-transparent hover:text-(--v3-text-3)",
  danger: "bg-(--v3-panel-2) text-(--v3-text-3) hover:bg-(--v3-panel-2)",
} as const

/**
 * 28px 文字按钮，圆角 6px。
 * disabled：aria-disabled（仍可聚焦，FE-06）、点按无效（type=submit 也不提交），外观见 TEXT_BTN_OFF；reason 给了就带工具提示并附在读屏名后。
 */
export function Button({
  variant = "secondary",
  disabled,
  reason,
  className,
  onClick,
  children,
  ...rest
}: ComponentProps<"button"> & { variant?: keyof typeof TEXT_BTN; /** 不可用原因（工具提示 + 读屏名） */ reason?: string }) {
  const off = !!disabled
  const btn = (
    <button
      type="button"
      aria-disabled={off || undefined}
      onClick={(e) => {
        if (off) {
          e.preventDefault()
          return
        }
        onClick?.(e)
      }}
      className={cn(
        "inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-[6px] px-3 text-[12px] leading-none font-medium whitespace-nowrap transition-colors",
        TEXT_BTN[variant],
        className,
        off && cn("cursor-default", TEXT_BTN_OFF[variant]),
      )}
      {...rest}
    >
      {children}
      {off && reason && <span className="sr-only">（{reason}）</span>}
    </button>
  )
  return off && reason ? <Tip label={reason}>{btn}</Tip> : btn
}

/* ------------------------------------------------------------------ 菜单 */

export type MenuEntry =
  | {
      kind?: "item"
      value: string
      label: string
      hint?: string
      icon?: ReactNode
      /** 不可用（不隐藏、仍可聚焦）：aria-disabled，右侧写 reason，读屏经 aria-describedby 读到；与 kit Menu 同一画法 */
      disabled?: boolean
      reason?: string
    }
  | { kind: "separator" }

/** 菜单面板（含子菜单）：实色 panel 底 + 1px 边 + 阴影，圆角 8px。 */
export const MENU_CONTENT =
  "z-50 min-w-[max(168px,var(--radix-dropdown-menu-trigger-width))] rounded-[8px] border border-(--v3-border) bg-(--v3-panel) p-1 text-(--v3-text) shadow-(--v3-shadow) outline-none"
/** 菜单项 28px、圆角 4px；不可用时文字退到 text-3（不用半透明），与按钮的不可用态一致。 */
export const MENU_ITEM =
  "flex h-7 items-center gap-2 rounded-[4px] px-2 text-[12px] leading-none text-(--v3-text) outline-none select-none data-highlighted:bg-(--v3-panel-2) data-disabled:text-(--v3-text-3)"
export const MENU_SEPARATOR = "-mx-1 my-1 h-px bg-(--v3-border)"

/**
 * 下拉菜单：实色 panel 底 + 1px 边 + 阴影，圆角 8px；挂在 v3 根节点内以继承 token。
 * 传 value 时为单选（左侧留出对勾列）；不传则是命令菜单。
 */
export function V3Menu({
  trigger,
  entries,
  value,
  onValueChange,
  onSelect,
  align = "start",
  side = "bottom",
  sideOffset = 4,
  className,
}: {
  trigger: ReactNode
  entries: MenuEntry[]
  value?: string
  onValueChange?: (v: string) => void
  onSelect?: (v: string) => void
  align?: "start" | "center" | "end"
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
  className?: string
}) {
  const root = useContext(V3RootContext)
  const uid = useId()
  const radio = value !== undefined
  // 开合记在这里（行为同 Radix 自管）：关闭时在菜单内容卸载的同一个任务末尾就把焦点交回触发按钮，不在 body 停一帧（kit useFocusBackOnClose，第 2 批第 6 轮集成）；
  // 焦点已被选中项打开的面板 / 对话框接走时不动，Radix 随后的 onCloseAutoFocus 照旧（keepMovedFocus）
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  useFocusBackOnClose(open, () => triggerRef.current)
  const body = entries.map((e, i) => {
    if (e.kind === "separator") return <DM.Separator key={`sep-${i}`} className={MENU_SEPARATOR} />
    const reason = e.disabled && e.reason ? e.reason : undefined
    const reasonId = reason ? `${uid}-why-${e.value}` : undefined
    const right = reason ?? e.hint
    const inner = (
      <>
        {radio && (
          <span className="flex w-4 shrink-0 items-center justify-center">
            <DM.ItemIndicator>
              <Check size={12} strokeWidth={2} />
            </DM.ItemIndicator>
          </span>
        )}
        {e.icon && <span className="flex shrink-0 items-center text-(--v3-text-2)">{e.icon}</span>}
        <span className="flex-1 truncate">{e.label}</span>
        {right && (
          <span id={reasonId} aria-hidden={reason ? true : undefined} className={cn("ml-4 text-(--v3-text-2)", hasCjk(right) ? "text-[12px]" : "text-[11px]")}>
            {right}
          </span>
        )}
      </>
    )
    return radio ? (
      <DM.RadioItem key={e.value} value={e.value} className={MENU_ITEM}>
        {inner}
      </DM.RadioItem>
    ) : (
      <DM.Item
        key={e.value}
        className={MENU_ITEM}
        {...(e.disabled ? { "aria-disabled": true as const, "data-disabled": "", "aria-describedby": reasonId } : {})}
        onSelect={(ev) => {
          if (e.disabled) {
            ev.preventDefault()
            return
          }
          onSelect?.(e.value)
        }}
      >
        {inner}
      </DM.Item>
    )
  })
  return (
    <DM.Root open={open} onOpenChange={setOpen}>
      <DM.Trigger asChild ref={triggerRef}>
        {trigger}
      </DM.Trigger>
      <DM.Portal container={root ?? undefined}>
        {/* 选了某项后焦点已被新打开的面板接走（如文档菜单「版本历史」打开的整栏面板）时，关闭不再把焦点抢回触发按钮 */}
        <DM.Content
          align={align}
          side={side}
          sideOffset={sideOffset}
          collisionPadding={8}
          onCloseAutoFocus={keepMovedFocus}
          className={cn(MENU_CONTENT, className)}
        >
          {radio ? (
            <DM.RadioGroup value={value} onValueChange={onValueChange}>
              {body}
            </DM.RadioGroup>
          ) : (
            body
          )}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  )
}

/* ------------------------------------------------------------------ 表单控件（检查器） */

/**
 * 输入字段外框（数字 / 文本输入：Field、kit 的 NumberField / TextField / TextArea / ColorField、颜色行、字号、几何字段、缩放比例、插入表格的行列数）：
 * 淡底 --v3-field-fill + 1px 边界 --v3-field-line + 圆角 4；悬停底 hover:bg-(--v3-field-fill-hover)，不可用底 bg-(--v3-field-fill-off)、边界 ring-(--v3-field-line-off)。
 * 画法（rulings §4.25 DS-35，修订 DS-9 的「输入框加 1px 独立边界」）：只铺 panel-2 淡底、不描边；悬停不换底，出一道与分隔线同档的细边
 * （v3-field 标记类，v3.css .v3-field:hover）；不可用时底色再降一档、无边。控件边界不再要求 3:1，靠底色、标签与当前值识别。
 * 边界画成 inset ring、不占布局；聚焦（focus-within:ring-(--v3-accent)）与校验错误（ring-(--v3-danger)）只换这条线的颜色。首页搜索框另用 --v3-search-*（透明底 + 细边）。
 */
export const FIELD_FRAME = "v3-field rounded-[4px] bg-(--v3-field-fill) ring-1 ring-(--v3-field-line) ring-inset"

/**
 * 选择触发器外框（下拉与点开选择的字段：SelectTrigger / MenuField（版式、字体、列表样式、切换等）、主题卡、填充与文本颜色触发器、操作行等）：
 * 底 --v3-select-fill + 1px 边界 --v3-select-line + 圆角 4；悬停 / 打开 hover:bg-(--v3-select-fill-hover)，不可用边界 ring-(--v3-select-line-off)。
 * 画法（rulings §4.25 DS-35）：透明底 + 与分隔线同档的 1px 细边（暗 #444 / 亮 #E5E5E5），悬停铺 panel-2；不可用时细边降为 panel-2。
 * 颜色行 ColorRow / ColorField 的色值与不透明度可直接输入，归输入字段（FIELD_FRAME）。
 */
export const SELECT_FRAME = "rounded-[4px] bg-(--v3-select-fill) ring-1 ring-(--v3-select-line) ring-inset"

/** 28px 输入框：标签在框内左侧（text-2；单字母 11px、中文 12px，标签是可读信息，不用 text-3），数字 tabular-nums。 */
export function Field({
  label,
  defaultValue,
  aria,
  className,
  suffix,
  anchor,
}: {
  label?: string
  defaultValue: string
  aria: string
  className?: string
  suffix?: ReactNode
  /** 浮层锚点名（data-v3-anchor），见 kit/anchor.ts */
  anchor?: string
}) {
  return (
    <label
      data-v3-anchor={anchor}
      className={cn(
        FIELD_FRAME,
        "flex h-7 min-w-0 items-center gap-2 px-2 transition-colors hover:bg-(--v3-field-fill-hover) focus-within:ring-(--v3-accent)",
        className,
      )}
    >
      {label && <span className={cn("shrink-0 leading-none text-(--v3-text-2)", hasCjk(label) ? "text-[12px]" : "text-[11px]")}>{label}</span>}
      <input
        defaultValue={defaultValue}
        aria-label={aria}
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-[12px] leading-none text-(--v3-text) tabular-nums outline-none"
      />
      {suffix}
    </label>
  )
}

/**
 * 看起来像下拉的 28px 触发器（选择触发器外框 SELECT_FRAME、右侧 ▾）；children 是当前值。
 * aria-disabled 时文字与 ▾ 退到 text-3、边界退到 --v3-select-line-off（panel-2）、不响应悬停。
 */
export function SelectTrigger({ children, className, ...rest }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        SELECT_FRAME,
        "flex h-7 w-full min-w-0 items-center gap-2 px-2 text-left text-[12px] leading-none text-(--v3-text) transition-colors hover:bg-(--v3-select-fill-hover) data-[state=open]:bg-(--v3-select-fill-hover) data-[v3-open]:bg-(--v3-select-fill-hover)",
        "aria-disabled:cursor-default aria-disabled:text-(--v3-text-3) aria-disabled:ring-(--v3-select-line-off) aria-disabled:hover:bg-(--v3-select-fill) [&[aria-disabled]>svg:last-child]:text-(--v3-text-3)",
        className,
      )}
      {...rest}
    >
      {children}
      <ChevronDown {...ICON} className="ml-auto shrink-0 text-(--v3-text-2)" />
    </button>
  )
}

/** 带菜单的下拉字段：选中值显示在字段里。disabled 时是同一外观的静态触发器（aria-disabled、可聚焦、工具提示写原因）。 */
export function MenuField({
  aria,
  items,
  defaultValue,
  label,
  leading,
  className,
  align,
  anchor,
  disabled,
  reason,
}: {
  aria: string
  items: string[]
  defaultValue: string
  /** 字段里始终显示的文字（如「项目符号」）；不传则显示当前选中值 */
  label?: string
  leading?: ReactNode
  className?: string
  align?: "start" | "center" | "end"
  /** 浮层锚点名（data-v3-anchor），见 kit/anchor.ts */
  anchor?: string
  /** 不可用：不展开菜单，文字退到 text-3 */
  disabled?: boolean
  /** 不可用原因：工具提示，并附在读屏名后（如「M3 提供」「需要编辑权限」） */
  reason?: string
}) {
  const [v, setV] = useState(defaultValue)
  if (disabled) {
    const trigger = (
      <SelectTrigger aria-label={withReason(aria, reason)} aria-disabled="true" className={className} data-v3-anchor={anchor}>
        {leading}
        <span className="truncate">{label ?? v}</span>
      </SelectTrigger>
    )
    return reason ? <Tip label={reason}>{trigger}</Tip> : trigger
  }
  return (
    <V3Menu
      value={v}
      onValueChange={setV}
      align={align}
      entries={items.map((x) => ({ value: x, label: x }))}
      trigger={
        <SelectTrigger aria-label={aria} className={className} data-v3-anchor={anchor}>
          {leading}
          <span className="truncate">{label ?? v}</span>
        </SelectTrigger>
      }
    />
  )
}

export interface SegOption<T extends string> {
  value: T
  label: string
  icon?: ReactNode
  text?: string
  /** 这一项不可用（禁用而不隐藏：可聚焦，工具提示「名称 · 原因」） */
  disabled?: boolean
  reason?: string
  /** 文字后的小标记（M3、P2） */
  tag?: string
}

/**
 * 分段槽与选中块（Segmented、ToggleStrip 共用；表格边框预设、文本动作条同此 token）。画法（rulings §4.25 DS-35）：
 * 槽只铺 panel-2、不描边；选中块 = 面板色 + 与分隔线同档的细边（--v3-seg-on / --v3-seg-on-line），Segmented 的选中块与槽同高贴边（TB-55，--v3-seg-pad / --v3-seg-gap = 0，外框仍 28px）；
 * 选中项另有 v3-on-cue：文字 500、图标描边 2（非颜色线索，v3.css），选中态不只靠底色深浅。
 */
export const SEG_TRACK_FRAME = "rounded-[4px] bg-(--v3-seg-track) p-0.5 ring-1 ring-(--v3-seg-track-line) ring-inset"
/** 开关组（ToggleStrip：B / I / U / S 等）的槽：保留 2px 内边距与项间距，免得相邻的按下项连成一块（TB-55） */
const SEG_TRACK = `flex h-7 gap-0.5 ${SEG_TRACK_FRAME}`
/** Segmented 自己的槽：内边距与项间距走 token（--v3-seg-pad / --v3-seg-gap = 0，选中块贴边，TB-55） */
const SEG_TRACK_SEGMENTED = "flex h-7 gap-(--v3-seg-gap) rounded-[4px] bg-(--v3-seg-track) p-(--v3-seg-pad) ring-1 ring-(--v3-seg-track-line) ring-inset"
export const SEG_ON = "v3-on-cue bg-(--v3-seg-on) ring-1 ring-(--v3-seg-on-line) ring-inset"
/**
 * 多选开关的按下项（ToggleStrip 的 B I U S、上下标、翻转；查找框的区分大小写 Aa / 全字匹配 ab）：强调色淡底（暗 40%、亮 22%）、不描边
 * （--v3-toggle-on，rulings §4.25 DS-36，同 Figma 文本格式「B」按下），加 v3-on-cue 的描边 2。整组不可用时按下项退回 SEG_ON（不保留强调色）。
 */
export const TOGGLE_ON = "v3-on-cue bg-(--v3-toggle-on) ring-1 ring-(--v3-toggle-on-line) ring-inset"

/**
 * 分段控件：panel-2 槽 + 选中块；选项带工具提示。
 * disabled（整组）或某一项 disabled：aria-disabled、仍可聚焦、点按无效；选中块保留（文字 text-2，看得出当前值），其余文字退到 text-3。
 * role：group（缺省，按钮 aria-pressed）· radiogroup（role=radio + aria-checked）· tablist（role=tab + aria-selected，分段式页签）。
 */
export function Segmented<T extends string>({
  options,
  defaultValue,
  value,
  onValueChange,
  aria,
  className,
  disabled,
  reason,
  role = "group",
}: {
  options: SegOption<T>[]
  /** 非受控初值 */
  defaultValue?: T
  /** 受控值（传了就以它为准） */
  value?: T
  onValueChange?: (v: T) => void
  aria: string
  className?: string
  /** 整组不可用 */
  disabled?: boolean
  /** 整组不可用的原因 */
  reason?: string
  role?: "group" | "radiogroup" | "tablist"
}) {
  const [inner, setInner] = useState<T | undefined>(defaultValue)
  const v = value ?? inner
  const setV = (x: T) => {
    setInner(x)
    onValueChange?.(x)
  }
  const itemRole = role === "radiogroup" ? "radio" : role === "tablist" ? "tab" : undefined
  return (
    <div role={role} aria-label={withReason(aria, disabled ? reason : undefined)} aria-disabled={disabled || undefined} className={cn(SEG_TRACK_SEGMENTED, className)}>
      {options.map((o) => {
        const on = o.value === v
        const off = disabled || !!o.disabled
        const why = disabled ? reason : o.reason
        const state = itemRole === "radio" ? { "aria-checked": on } : itemRole === "tab" ? { "aria-selected": on } : { "aria-pressed": on }
        return (
          <Tip key={o.value} label={off && why ? reasonTip(o.label, why) : o.label}>
            <button
              type="button"
              role={itemRole}
              aria-label={withReason(o.label, off ? why : undefined)}
              aria-disabled={off || undefined}
              {...state}
              onClick={() => !off && setV(o.value)}
              className={cn(
                "flex h-full min-w-0 flex-1 items-center justify-center gap-1.5 rounded-(--v3-seg-on-radius) text-[12px] leading-none transition-colors",
                on ? cn(SEG_ON, off ? "text-(--v3-text-2)" : "text-(--v3-text)") : off ? "cursor-default text-(--v3-text-3)" : "text-(--v3-text-2) hover:text-(--v3-text)",
                off && "cursor-default",
              )}
            >
              {o.icon ?? o.text}
              {o.tag && <TagMark>{o.tag}</TagMark>}
            </button>
          </Tip>
        )
      })}
    </div>
  )
}

/** 分段项里的小标记（与 kit Tag 同一外观；放在这里避免 ui ↔ kit 循环引用）。 */
function TagMark({ children }: { children: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-[4px] border border-(--v3-border) leading-none font-medium text-(--v3-text-2)",
        hasCjk(children) ? "h-[18px] px-1.5 text-[12px]" : "h-4 px-1 text-[11px]",
      )}
    >
      {children}
    </span>
  )
}

/** 多选切换条（B I U S）：与分段控件同样的 panel-2 槽（保留 2px 间距），但每一项独立开关，按下项用 TOGGLE_ON（强调色淡底）。disabled：同 Segmented（按下的项退回中性选中块 SEG_ON、文字 text-2，其余 text-3）。 */
export function ToggleStrip({
  options,
  defaultOn,
  aria,
  className,
  disabled,
  reason,
}: {
  options: { value: string; label: string; icon: ReactNode; kbd?: string }[]
  defaultOn: string[]
  aria: string
  className?: string
  disabled?: boolean
  reason?: string
}) {
  const [on, setOn] = useState<string[]>(defaultOn)
  return (
    <div role="group" aria-label={withReason(aria, disabled ? reason : undefined)} aria-disabled={disabled || undefined} className={cn(SEG_TRACK, className)}>
      {options.map((o) => {
        const active = on.includes(o.value)
        return (
          <Tip key={o.value} label={disabled && reason ? reasonTip(o.label, reason) : o.label} kbd={disabled ? undefined : o.kbd}>
            <button
              type="button"
              aria-label={withReason(o.label, disabled ? reason : undefined)}
              aria-pressed={active}
              aria-disabled={disabled || undefined}
              onClick={() => !disabled && setOn((cur) => (cur.includes(o.value) ? cur.filter((x) => x !== o.value) : [...cur, o.value]))}
              className={cn(
                "flex h-6 min-w-0 flex-1 items-center justify-center rounded-[3px] transition-colors",
                active ? (disabled ? cn(SEG_ON, "text-(--v3-text-2)") : cn(TOGGLE_ON, "text-(--v3-text)")) : disabled ? "text-(--v3-text-3)" : "text-(--v3-text-2) hover:text-(--v3-text)",
                disabled && "cursor-default",
              )}
            >
              {o.icon}
            </button>
          </Tip>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ 色块与头像 */

/** 文档自己的颜色（不随主题变化）：静态类名，避免 style 与动态拼接。 */
export type SwatchKey = "brand" | "ink" | "white" | "soft" | "note" | "mute" | "mid"
const SWATCH_BG: Record<SwatchKey, string> = {
  brand: "bg-[#3A5CE6]",
  ink: "bg-[#141B2D]",
  white: "bg-white",
  soft: "bg-[#E8EDFD]",
  /** 第 2 页要点卡的浅品牌色底 */
  note: "bg-[#EEF2FF]",
  mute: "bg-[#8A93A6]",
  mid: "bg-[#AFC0F8]",
}

export function Swatch({ color, className }: { color: SwatchKey; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-4 shrink-0 rounded-[3px] shadow-[inset_0_0_0_1px_var(--v3-swatch-line)]", SWATCH_BG[color], className)}
    />
  )
}

/**
 * 身份色名（v3.css --v3-tone-*）：前 5 色是第 1 批定稿的，后 7 色是第 2 批补足 12 色板的取值（PRD CO-03，设计 04 §2.4；rulings §4.25 DS-42 定稿）。
 * 按用户 id 取色用 kit 的 toneOf(userId)（kit/tone.ts，12 色的哈希顺序也在那里）；示例里的固定人物（data.ts ME / WANG / LI / ZHANG）仍写死原来的色。
 */
export type Tone = "slate" | "sand" | "sage" | "clay" | "mist" | "olive" | "iris" | "lake" | "rose" | "denim" | "plum" | "moss"
/** 身份色（v3.css --v3-tone-*）：头像底色、远端光标、远端选区、评论钉用同一组，「头像什么色、光标就什么色」。 */
export const TONE_BG: Record<Tone, string> = {
  slate: "bg-(--v3-tone-slate)",
  sand: "bg-(--v3-tone-sand)",
  sage: "bg-(--v3-tone-sage)",
  clay: "bg-(--v3-tone-clay)",
  mist: "bg-(--v3-tone-mist)",
  olive: "bg-(--v3-tone-olive)",
  iris: "bg-(--v3-tone-iris)",
  lake: "bg-(--v3-tone-lake)",
  rose: "bg-(--v3-tone-rose)",
  denim: "bg-(--v3-tone-denim)",
  plum: "bg-(--v3-tone-plum)",
  moss: "bg-(--v3-tone-moss)",
}
/** 身份色的 1.5px 描边（远端对象选区，05 §3）。 */
export const TONE_BORDER: Record<Tone, string> = {
  slate: "border-(--v3-tone-slate)",
  sand: "border-(--v3-tone-sand)",
  sage: "border-(--v3-tone-sage)",
  clay: "border-(--v3-tone-clay)",
  mist: "border-(--v3-tone-mist)",
  olive: "border-(--v3-tone-olive)",
  iris: "border-(--v3-tone-iris)",
  lake: "border-(--v3-tone-lake)",
  rose: "border-(--v3-tone-rose)",
  denim: "border-(--v3-tone-denim)",
  plum: "border-(--v3-tone-plum)",
  moss: "border-(--v3-tone-moss)",
}
/** 身份色的低透明度底（远端文本选区）。 */
export const TONE_SOFT: Record<Tone, string> = {
  slate: "bg-(--v3-tone-slate)/25",
  sand: "bg-(--v3-tone-sand)/25",
  sage: "bg-(--v3-tone-sage)/25",
  clay: "bg-(--v3-tone-clay)/25",
  mist: "bg-(--v3-tone-mist)/25",
  olive: "bg-(--v3-tone-olive)/25",
  iris: "bg-(--v3-tone-iris)/25",
  lake: "bg-(--v3-tone-lake)/25",
  rose: "bg-(--v3-tone-rose)/25",
  denim: "bg-(--v3-tone-denim)/25",
  plum: "bg-(--v3-tone-plum)/25",
  moss: "bg-(--v3-tone-moss)/25",
}
/** 身份色的 CSS 变量名（给 SVG fill、描边、低透明度底用）。 */
export const toneVar = (t: Tone) => `var(--v3-tone-${t})`
/** 中文首字最小 12px：16px 的小头像放不下，只显示底色（名字走 aria-label）。 */
const AVATAR_SIZE = { 16: "size-4", 20: "size-5 text-[12px]", 24: "size-6 text-[12px]" } as const

/**
 * 头像：低饱和底色 + 首字，圆形（头像是 rounded-full 的例外）。
 * ring 是叠放时的 1px 描边，取头像所在表面的颜色，看起来像从底色里镂出来：
 * canvas 用在画布上（首页文档卡），panel 用在面板与浮动胶囊上（暗 #2C2C2C、亮白）。不用固定白色，暗色下白圈会是整块面板里最亮的线。
 * badge：头像角标（rulings §4.25 DS-132：第 13 位起复用身份色时的同色序号，DS-42，样张 presence-scale；只要序号时给 seq 即可）——调用处给一个已定位好的节点
 * （absolute，压在头像角上），给了才让头像 relative；label：读屏名（缺省取 name），带角标时写上它的含义（如「姚远，同色第 2 位」）。两个都不给时与原来逐字相同
 */
export function Avatar({
  name,
  tone,
  size = 24,
  ring,
  className,
  badge: badgeProp,
  label,
  seq,
  seqAt = "list",
}: {
  name: string
  tone: Tone
  size?: keyof typeof AVATAR_SIZE
  ring?: "canvas" | "panel"
  className?: string
  badge?: ReactNode
  label?: string
  /**
   * 同色序号（rulings §4.25 DS-132：第 13 位起复用身份色时写「同色第 N 位」，第一位不画；会话数不上头像）：给了就画 kit AvatarBadge，读屏名缺省「姓名，同色第 N 位」。
   * seqAt：角标挂在哪——group 头像组里叠放的他人头像（挂在可见段左 18 的底部中线）· group-self 头像组里自己的头像（不被压，挂在正中）· list 在线列表（右下，缺省）
   */
  seq?: number
  seqAt?: "group" | "group-self" | "list"
}) {
  const badge = badgeProp ?? (seq && seq > 1 ? <AvatarBadge n={seq} where={seqAt === "list" ? "list" : "group"} self={seqAt === "group-self"} /> : undefined)
  return (
    <span
      aria-label={label ?? (seq && seq > 1 ? `${name}，同色第 ${seq} 位` : name)}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full leading-none font-medium text-white select-none",
        AVATAR_SIZE[size],
        TONE_BG[tone],
        ring === "canvas" && "ring-1 ring-(--v3-canvas)",
        ring === "panel" && "ring-1 ring-(--v3-panel)",
        !!badge && "relative",
        className,
      )}
    >
      {size === 16 ? null : name.slice(0, 1)}
      {badge}
    </span>
  )
}

/**
 * 头像上的数字角标（rulings §4.25 DS-132，第 3 批转正时由 scenarios/presence-scale/people.tsx 并入，画法逐像素相同）：一枚圆形数字角标——面板底、与分隔线同档的 1px 细边、
 * 11px 数字（tabular），两位数时按内容加宽；尺寸按头像：24px 头像 14，20px 头像 12。z 1，落在相邻头像之上不被遮住。位置要一眼看出是谁的：
 * - 头像组（group）：头像叠放，右下角正落在与右邻两圆的交界处（同色相邻时看不出归属），所以角标挂在这枚头像「看得见的那一段」的底部中线上、向下多出 7，
 *   不压头像字、碰不到左右邻居——别人的头像右侧被右邻压住 6，看得见的是左边 18，中线在 9；自己的头像与别人隔开 4、不被压，中线在 12；
 * - 在线列表（list）：头像不叠放，留在右下（外沿多出 4），不会被邻居盖住。
 * slot = sessions 只给 DS-132 未采纳的备选（两种角标都上头像）：头像组里挂在同一中线的上方（向上多出 8），在线列表里在右上。
 */
export function AvatarBadge({ n, where, self, slot = "seq" }: { n: number; where: "group" | "list"; self?: boolean; slot?: "seq" | "sessions" }) {
  const group = where === "group"
  return (
    <span
      aria-hidden="true"
      data-presence-badge={slot}
      className={cn(
        "absolute z-[1] flex items-center justify-center rounded-full bg-(--v3-panel) text-[11px] leading-none font-medium text-(--v3-text) tabular-nums ring-1 ring-(--v3-border)",
        group ? "h-[14px] min-w-[14px] -translate-x-1/2 px-[3px]" : "h-3 min-w-3 px-[2px]",
        group && (self ? "left-3" : "left-[9px]"),
        group && (slot === "seq" ? "top-[17px]" : "bottom-[18px]"),
        !group && "-right-1",
        !group && (slot === "seq" ? "-bottom-1" : "-top-1"),
      )}
    >
      {n}
    </span>
  )
}

/**
 * 头像叠放：后一个左移（16px 移 4、更大的移 6），描边取所在面板的底色（暗色不出白圈）；16px 只显示身份色、名字写在旁边的文字里。
 * 列表里「谁」的一组人用它（版本历史的贡献者、恢复确认里正在编辑的人）；检查器顶行的在场头像组是 chrome.tsx Collaborators（带账户菜单与「+N」）。
 */
export function AvatarStack({ people, size = 16, className }: { people: { name: string; tone: Tone }[]; size?: keyof typeof AVATAR_SIZE; className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center", className)}>
      {people.map((p, i) => (
        <Avatar key={p.name} name={p.name} tone={p.tone} size={size} ring="panel" className={cn(i > 0 && (size === 16 ? "-ml-1" : "-ml-1.5"))} />
      ))}
    </span>
  )
}

/** 插件归属标识（设计 06 §4）：12px Blocks 图标，悬停「由「插件名」（供应商）提供」；读屏名写在所在控件 / 分区上，这里只是图形。 */
export function Attribution({ plugin, vendor }: { plugin: string; vendor?: string }) {
  return (
    <Tip label={`由「${plugin}」${vendor ? `（${vendor}）` : ""}提供`}>
      <span aria-hidden="true" className="inline-flex shrink-0 text-(--v3-text-2)">
        <Blocks size={12} strokeWidth={1.5} />
      </span>
    </Tip>
  )
}

/** 插件贡献的界面件的读屏名：「标题（由「插件名」提供）」 */
export const ownedLabel = (title: string, owner?: { plugin: string }) => (owner ? `${title}（由「${owner.plugin}」提供）` : undefined)

/* ------------------------------------------------------------------ 检查器骨架 */

/** 节：16px 左右、12px 上下，节标题 12px 600，节与节之间 1px 分隔线。 */
export function Section({
  title,
  count,
  tag,
  owner,
  titleId,
  action,
  children,
  className,
  bodyClassName,
  anchor,
}: {
  title?: string
  /** 标题后的计数（12px text-2、字重 400，如「有权限的用户 3」） */
  count?: number
  /** 标题后的小标记（如 M2 时的「M3」） */
  tag?: string
  /** 插件贡献的分区（06 §2.12）：标题后带归属标识，分区读屏名「标题（由「插件名」提供）」 */
  owner?: { plugin: string; vendor?: string }
  /** 节标题的 id：节里的输入框用 aria-labelledby 指向它（可见标签即节标题，如分享对话框「邀请协作者」） */
  titleId?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  /** 内容区的间距等，缺省 gap-2（字段之间 8px）；分组之间可用 gap-3；内容自己排版（不要行间距）时写 block */
  bodyClassName?: string
  /** 浮层锚点名（data-v3-anchor），见 kit/anchor.ts；内置分区为 section-<分区 id> */
  anchor?: string
}) {
  return (
    <section data-v3-anchor={anchor} aria-label={title ? ownedLabel(title, owner) : undefined} className={cn("border-b border-(--v3-border) px-4 py-3 last:border-b-0", className)}>
      {title && (
        <div className="mb-2 flex h-4 items-center justify-between">
          <h3 id={titleId} className="flex items-center gap-1.5 text-[12px] leading-4 font-semibold text-(--v3-text)">
            {title}
            {count !== undefined && <span className="font-normal text-(--v3-text-2) tabular-nums">{count}</span>}
            {tag && <TagMark>{tag}</TagMark>}
            {owner && <Attribution plugin={owner.plugin} vendor={owner.vendor} />}
          </h3>
          {action && <div className="-my-1 -mr-1.5">{action}</div>}
        </div>
      )}
      <div className={cn("flex flex-col gap-2", bodyClassName)}>{children}</div>
    </section>
  )
}

/** 面板标题（选中对象的名称）：13px 600，自带下方分隔线。 */
export function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-10 shrink-0 items-center border-b border-(--v3-border) px-4">
      <h2 className="text-[13px] leading-4 font-semibold text-(--v3-text)">{children}</h2>
    </div>
  )
}

export function Cols({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-2", className)}>{children}</div>
}
