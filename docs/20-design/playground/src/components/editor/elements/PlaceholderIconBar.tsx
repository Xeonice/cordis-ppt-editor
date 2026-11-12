import { useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { ChartColumn, ChevronDown, ImagePlus, Plus, Table, Video, type LucideIcon } from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { CanvasOverlay, useToScreen, type Box } from "../SlideCanvas"
import { ignoreDesignBar } from "../ribbon/insert/demo"
import { MilestoneTag } from "../ribbon/primitives"

export type PlaceholderContentKind = "table" | "picture" | "chart" | "video"

interface IconDef {
  kind: PlaceholderContentKind
  icon: LucideIcon
  label: string
  aria: string
  /** 所属里程碑与未开放时的原因：禁用而不隐藏（rulings §4.20 FE-06、§4.21）；是否开放由 `enabledKinds` 决定 */
  milestone?: string
  reason?: string
}

export const placeholderIcons: IconDef[] = [
  { kind: "table", icon: Table, label: "表格", aria: "插入表格到占位符" },
  { kind: "picture", icon: ImagePlus, label: "图片", aria: "插入图片到占位符" },
  { kind: "chart", icon: ChartColumn, label: "图表", aria: "插入图表到占位符", milestone: "M3", reason: "图表插入在 M3 提供：随图表编辑组件一起开放。文稿里已有的图表照常查看和放映。" },
  { kind: "video", icon: Video, label: "视频", aria: "插入视频到占位符", milestone: "P2", reason: "视频插入排在后续版本（P2）。文稿里已有的视频照常查看、放映、移动和缩放。" },
]

/** M2 已开放的内容类型：表格（q-table-depth）与图片（R-d-69）；图表到 M3、视频到 P2 由调用方经 `enabledKinds` 打开 */
export const M2_ENABLED_KINDS: PlaceholderContentKind[] = ["table", "picture"]

/** 图标条与检查器「插入到占位符」共用的禁用判定与读屏名（两处同源） */
export function placeholderItemState(it: IconDef, enabledKinds: PlaceholderContentKind[] = M2_ENABLED_KINDS) {
  const disabled = !enabledKinds.includes(it.kind)
  return {
    disabled,
    ariaLabel: disabled && it.milestone ? `${it.aria}（${it.milestone} 提供）` : it.aria,
    reason: disabled ? (it.reason ?? "当前不可用") : it.aria.replace("到占位符", ""),
  }
}

/**
 * 选择器渲染函数：`close` 关闭弹层并同步把焦点还给触发它的图标（折叠时为「插入 ▾」）。
 * 同步归还是为了接着开对话框（如「插入表格…」）时，对话框记下的「打开前焦点」是图标，取消 / Esc 后回到图标而不是 body
 */
export type PlaceholderPicker = (close: () => void) => ReactNode

const GAP = 8
const PAD = 8
/** 图标条四周至少留的屏幕空白；放不下即折叠 */
const EDGE = 8
/** 提示文字：上间距 12 + 15px 行高约 22 */
const HINT_H = 34

/**
 * 空内容占位符的快速插入图标条（G-80；50/21 §3 ③⑤⑥；ED-07）。画在 SlideCanvas 的屏幕坐标覆盖层：不进缩略图、放映与导出；
 * 入参 `box` 是占位符的幻灯片坐标，图标条按其屏幕框居中，按屏幕尺寸绘制（多图标 76 px、单图标 84 px，触控命中 ≥ 44 px），
 * 不随画布缩放；屏幕框放不下整条时折叠为单个「插入 ▾」菜单，条目、禁用与原因不变。
 * 按占位符类型过滤：obj 全部、pic 只图片、tbl 只表格、chart 只图表、media 只视频；SmartArt 与剪贴画不出图标。
 * 键盘按 APG Toolbar（设计 07 §1.2）：整条一个 Tab 停靠点，←/→ 在图标间移动、Home/End 到首尾，禁用项可停留并展开原因，
 * Tab 离开整条；Enter / Space 触发。未开放项 aria-disabled（仍可聚焦，tooltip 给原因）。
 * 位于幻灯片纸面上（恒为白色），所以颜色用文档墨色而不是界面 token，暗色界面下也保持同一外观。
 */
export function PlaceholderIconBar({
  box,
  insetTop = 0,
  kinds,
  enabledKinds = M2_ENABLED_KINDS,
  focusKind,
  reasonOpenKind,
  onPick,
  pickers,
  pickerOpen,
  onPickerOpenChange,
  activeKind,
  collapsed: collapsedProp,
  menuOpen,
  onMenuOpenChange,
  hint = "单击图标插入，或把图片拖到这里",
  size,
}: {
  /**
   * 占位符框（幻灯片坐标）。给出时画进屏幕坐标覆盖层并按屏幕框居中、放不下自动折叠（规格）；
   * 缺省时退回旧用法：原地渲染在父元素里（随画布缩放、不自动折叠），仅为过渡兼容，新代码应传 box
   */
  box?: Box
  /** 顶部让出的高度（幻灯片坐标），如 obj 左上「• 单击此处添加文本」一行；图标条在余下区域居中 */
  insetTop?: number
  kinds: PlaceholderContentKind[]
  /** 已开放的类型；缺省为 M2（表格、图片）。其余类型禁用而不隐藏，挂里程碑标记并给原因 */
  enabledKinds?: PlaceholderContentKind[]
  /** 演示：画出键盘焦点环（并作为 roving tabindex 的停靠点） */
  focusKind?: PlaceholderContentKind
  /** 演示：强制展开该项的 tooltip */
  reasonOpenKind?: PlaceholderContentKind
  /** 点击没有选择器的可用图标 */
  onPick?: (kind: PlaceholderContentKind) => void
  /** 在图标旁弹出的选择器（与插入页签同一组件，如表格网格）；有选择器的类型点击时打开弹层而不调 onPick */
  pickers?: Partial<Record<PlaceholderContentKind, PlaceholderPicker>>
  /** 受控：当前打开的选择器 */
  pickerOpen?: PlaceholderContentKind | null
  onPickerOpenChange?: (kind: PlaceholderContentKind | null) => void
  /**
   * 由调用方在外部弹出的菜单正开着的类型（如图表的 ChartTypeMenu 不是 Popover，走 onPick 再由路由弹出）：
   * 该图标（折叠时为「插入 ▾」）画成按下态并带 aria-expanded，与 pickers 弹层打开时同一外观
   */
  activeKind?: PlaceholderContentKind | null
  /** 强制折叠 / 展开；缺省按屏幕框自动判断 */
  collapsed?: boolean
  /** 受控：折叠态「插入 ▾」菜单是否展开（演示） */
  menuOpen?: boolean
  onMenuOpenChange?: (open: boolean) => void
  hint?: string | null
  /** 缺省：单图标 lg（84），多图标 md（76） */
  size?: "md" | "lg"
}) {
  const toScreen = useToScreen()
  const items = placeholderIcons.filter((i) => kinds.includes(i.kind))
  const [innerPicker, setInnerPicker] = useState<PlaceholderContentKind | null>(null)
  const openPicker = pickerOpen !== undefined ? pickerOpen : innerPicker
  const setOpenPicker = (k: PlaceholderContentKind | null) => (onPickerOpenChange ?? setInnerPicker)(k)

  if (items.length === 0) return null
  const sz = size ?? (items.length === 1 ? "lg" : "md")
  const btn = sz === "lg" ? 84 : 76
  const barW = items.length * btn + (items.length - 1) * GAP + PAD * 2
  const barH = btn + PAD * 2
  const s = box ? toScreen({ x: box.x, y: box.y + insetTop, w: box.w, h: box.h - insetTop }) : null
  const fits = !s || (barW + EDGE * 2 <= s.w && barH + EDGE * 2 <= s.h)
  const collapsed = collapsedProp ?? !fits
  // 提示文字只在整条展开、且上下与左右都放得下时出现（15px 字按字数估宽）
  const showHint = !collapsed && !!hint && (!s || (barH + HINT_H + EDGE * 2 <= s.h && hint.length * 15 + EDGE * 2 <= s.w))

  const body = (
    <div
      className={cn("flex flex-col items-center justify-center gap-3", s && "pointer-events-none absolute")}
      style={s ? { left: s.x, top: s.y, width: s.w, height: s.h } : undefined}
    >
      {collapsed ? (
        <CollapsedInsertMenu
          items={items}
          enabledKinds={enabledKinds}
          reasonOpenKind={reasonOpenKind}
          onPick={onPick}
          pickers={pickers}
          openPicker={openPicker}
          setOpenPicker={setOpenPicker}
          activeKind={activeKind}
          menuOpen={menuOpen}
          onMenuOpenChange={onMenuOpenChange}
        />
      ) : (
        <IconToolbar
          items={items}
          size={sz}
          enabledKinds={enabledKinds}
          focusKind={focusKind}
          reasonOpenKind={reasonOpenKind}
          onPick={onPick}
          pickers={pickers}
          openPicker={openPicker}
          setOpenPicker={setOpenPicker}
          activeKind={activeKind}
        />
      )}
      {showHint && <p className="text-[15px] whitespace-nowrap text-[#1A2030]/50">{hint}</p>}
    </div>
  )
  return s ? <CanvasOverlay>{body}</CanvasOverlay> : body
}

interface BarSharedProps {
  items: IconDef[]
  enabledKinds: PlaceholderContentKind[]
  reasonOpenKind?: PlaceholderContentKind
  onPick?: (kind: PlaceholderContentKind) => void
  pickers?: Partial<Record<PlaceholderContentKind, PlaceholderPicker>>
  openPicker: PlaceholderContentKind | null
  setOpenPicker: (k: PlaceholderContentKind | null) => void
  activeKind?: PlaceholderContentKind | null
}

/**
 * 弹层底边与视口之间至少留出状态栏与画布缩放条的高度（状态栏 32 + 缩放条 38 + 间距，约 112 px）：图标条在画布下半部时，
 * 下方放不下就翻到图标上方，不压住状态栏里的操作说明和缩放条（2026-09-30 截图自审；原 56 px 只避让状态栏，图表菜单仍压住缩放条）。
 * 图表图标弹出的 ChartTypeMenu 用同一口径（导出给图表路由）。
 */
export const PLACEHOLDER_PICKER_COLLISION = { bottom: 112, top: 8 }
const PICKER_COLLISION = PLACEHOLDER_PICKER_COLLISION

/** 与插入页签「表格 ▾」弹层同一外观与演示规则（onInteractOutside 忽略 DesignBar；打开时不抢焦点） */
function PickerContent({ kind, pickers, close }: { kind: PlaceholderContentKind; pickers: Partial<Record<PlaceholderContentKind, PlaceholderPicker>>; close: () => void }) {
  return (
    <PopoverContent side="bottom" align="center" collisionPadding={PICKER_COLLISION} className="w-auto" onInteractOutside={ignoreDesignBar} onOpenAutoFocus={(e) => e.preventDefault()}>
      {pickers[kind]?.(close)}
    </PopoverContent>
  )
}

/** 展开形态：role=toolbar，roving tabindex */
function IconToolbar({ items, size, enabledKinds, focusKind, reasonOpenKind, onPick, pickers, openPicker, setOpenPicker, activeKind }: BarSharedProps & { size: "md" | "lg"; focusKind?: PlaceholderContentKind }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const focusIdx = focusKind ? items.findIndex((i) => i.kind === focusKind) : -1
  const [active, setActive] = useState(focusIdx >= 0 ? focusIdx : 0)
  const stop = focusIdx >= 0 ? focusIdx : Math.min(active, items.length - 1)

  function move(i: number) {
    const n = items.length
    const j = ((i % n) + n) % n
    setActive(j)
    refs.current[j]?.focus()
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const cur = refs.current.findIndex((el) => el === document.activeElement)
    if (cur < 0) return
    if (e.key === "ArrowRight") move(cur + 1)
    else if (e.key === "ArrowLeft") move(cur - 1)
    else if (e.key === "Home") move(0)
    else if (e.key === "End") move(items.length - 1)
    else return
    e.preventDefault()
  }

  return (
    <div
      role="toolbar"
      aria-label="插入内容到占位符"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className="pointer-events-auto flex items-center gap-2 rounded-[20px] bg-white/80 p-2 shadow-[0_0_0_1px_rgb(26_32_48/0.08),0_2px_8px_rgb(26_32_48/0.06)] backdrop-blur-sm"
    >
      {items.map((it, i) => {
        const st = placeholderItemState(it, enabledKinds)
        const Icon = it.icon
        const hasPicker = !st.disabled && !!pickers?.[it.kind]
        const pickerIsOpen = hasPicker && openPicker === it.kind
        const externalOpen = !st.disabled && activeKind === it.kind
        const button = (
          <button
            ref={(el) => { refs.current[i] = el }}
            type="button"
            tabIndex={i === stop ? 0 : -1}
            aria-label={st.ariaLabel}
            aria-disabled={st.disabled || undefined}
            // 只在外部菜单打开时才带这个键：带 undefined 值会经 Slot 合并盖掉 PopoverTrigger 自己的 aria-expanded
            {...(externalOpen ? { "aria-expanded": true } : {})}
            onFocus={() => setActive(i)}
            onClick={(e) => {
              if (st.disabled) { e.preventDefault(); return }
              if (!hasPicker) onPick?.(it.kind)
            }}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1.5 rounded-2xl text-[13px] leading-none outline-none transition-colors",
              size === "lg" ? "size-[84px]" : "size-[76px]",
              "focus-visible:ring-[3px] focus-visible:ring-[#3A5CE6] focus-visible:ring-offset-2 focus-visible:ring-offset-white",
              focusKind === it.kind && "ring-[3px] ring-[#3A5CE6] ring-offset-2 ring-offset-white",
              st.disabled
                ? "cursor-not-allowed text-[#1A2030]/35"
                : cn("text-[#1A2030]/70 hover:bg-[#3A5CE6]/10 hover:text-[#2F4BC4]", (pickerIsOpen || externalOpen) && "bg-[#3A5CE6]/10 text-[#2F4BC4]")
            )}
          >
            <Icon className={size === "lg" ? "size-8" : "size-7"} strokeWidth={1.5} />
            <span>{it.label}</span>
            {it.milestone && (
              <span className="absolute -top-1.5 -right-1.5 inline-flex h-[18px] items-center rounded-full bg-[#E7F1FE] px-1.5 text-xs font-medium text-[#0C4A93] shadow-[0_0_0_2px_white]">
                {it.milestone}
              </span>
            )}
          </button>
        )
        const withTip = (
          <Tooltip key={it.kind} open={pickerIsOpen || externalOpen ? false : reasonOpenKind === it.kind ? true : undefined}>
            <TooltipTrigger asChild>{hasPicker ? <PopoverTrigger asChild>{button}</PopoverTrigger> : button}</TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-60 text-pretty">{st.reason}</TooltipContent>
          </Tooltip>
        )
        if (!hasPicker) return withTip
        return (
          <Popover key={it.kind} open={pickerIsOpen} onOpenChange={(v) => setOpenPicker(v ? it.kind : null)}>
            {withTip}
            <PickerContent kind={it.kind} pickers={pickers!} close={() => { setOpenPicker(null); refs.current[i]?.focus() }} />
          </Popover>
        )
      })}
    </div>
  )
}

/** 折叠形态：单个「插入 ▾」，菜单条目与图标条同源；选了有选择器的类型时，选择器锚在这个按钮上弹出 */
function CollapsedInsertMenu({
  items, enabledKinds, reasonOpenKind, onPick, pickers, openPicker, setOpenPicker, activeKind, menuOpen, onMenuOpenChange,
}: BarSharedProps & { menuOpen?: boolean; onMenuOpenChange?: (open: boolean) => void }) {
  const [innerOpen, setInnerOpen] = useState(false)
  const open = menuOpen !== undefined ? menuOpen : innerOpen
  const setOpen = (v: boolean) => (onMenuOpenChange ?? setInnerOpen)(v)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pending = useRef<PlaceholderContentKind | null>(null)
  const activePicker = openPicker && pickers?.[openPicker] ? openPicker : null

  return (
    <Popover open={!!activePicker} onOpenChange={(v) => { if (!v) setOpenPicker(null) }}>
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <PopoverAnchor asChild>
          <DropdownMenuTrigger asChild>
            <button
              ref={triggerRef}
              type="button"
              aria-label="插入内容到占位符"
              className={cn(
                "pointer-events-auto inline-flex h-11 items-center gap-1.5 rounded-full bg-white/80 pr-3 pl-3.5 text-sm font-medium text-[#1A2030]/75 shadow-[0_0_0_1px_rgb(26_32_48/0.08),0_2px_8px_rgb(26_32_48/0.06)] backdrop-blur-sm outline-none transition-colors",
                "hover:bg-[#EEF1FD] hover:text-[#2F4BC4] focus-visible:ring-[3px] focus-visible:ring-[#3A5CE6] focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                (open || activePicker || activeKind) && "bg-[#EEF1FD] text-[#2F4BC4]"
              )}
            >
              <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
              插入
              <ChevronDown className="size-4 opacity-60" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
        </PopoverAnchor>
        <DropdownMenuContent
          align="center"
          className="w-52"
          onInteractOutside={ignoreDesignBar}
          onCloseAutoFocus={(e) => {
            // 选了带选择器的类型：菜单关闭后把焦点还给按钮，再在按钮旁打开同一个选择器
            const k = pending.current
            if (!k) return
            e.preventDefault()
            pending.current = null
            triggerRef.current?.focus()
            setOpenPicker(k)
          }}
        >
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">插入到占位符</DropdownMenuLabel>
          {items.map((it) => {
            const st = placeholderItemState(it, enabledKinds)
            const Icon = it.icon
            return (
              <Tooltip key={it.kind} open={reasonOpenKind === it.kind ? true : undefined}>
                <TooltipTrigger asChild>
                  <DropdownMenuItem
                    aria-label={st.ariaLabel}
                    aria-disabled={st.disabled || undefined}
                    onSelect={(e) => {
                      if (st.disabled) { e.preventDefault(); return }
                      if (pickers?.[it.kind]) pending.current = it.kind
                      else onPick?.(it.kind)
                    }}
                    className={cn(st.disabled && "cursor-not-allowed")}
                  >
                    <span className={cn("flex items-center gap-2", st.disabled && "opacity-50")}>
                      <Icon className="size-4" />
                      {it.label}
                    </span>
                    {it.milestone && <MilestoneTag className="ml-auto">{it.milestone}</MilestoneTag>}
                  </DropdownMenuItem>
                </TooltipTrigger>
                {st.disabled && <TooltipContent side="right" className="max-w-60 text-pretty">{st.reason}</TooltipContent>}
              </Tooltip>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {activePicker && pickers && <PickerContent kind={activePicker} pickers={pickers} close={() => { setOpenPicker(null); triggerRef.current?.focus() }} />}
    </Popover>
  )
}
