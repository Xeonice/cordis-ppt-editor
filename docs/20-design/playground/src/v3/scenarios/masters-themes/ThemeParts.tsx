import type { CSSProperties } from "react"
import { Info, SlidersHorizontal, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Button, ColorField, ICON, IconButton, MenuField, Popover, PopoverTitle, Segmented, SlideArt, SwatchPicker, Tag, Tip, Toast, Toasts, useDemoOpen, useEditor, useEditorMaybe, useSceneState,
} from "../../kit"
import { BUILTIN_THEMES, FONTS, isBuiltinTheme, RECENT_COLORS, STANDARD_COLORS, themeOf, type ThemeDef, type ThemeId } from "./data"

/**
 * 03-28 主题：检查器「主题」卡片（点卡片展开主题画廊，点右侧「调整主题」打开主题颜色与字体编辑），
 * 普通视图与母版视图共用同一个卡片、画廊与编辑面板，只是预览对象不同（当前页 / 当前母版，rulings §4.9 Q10）。
 * 跨区域的状态（当前主题、哪个弹层开着、编辑中的预览、轻提示）放在 kit 的 useSceneState 里（键带「masters.」前缀），画布与左栏据此换色。
 */

export interface ThemeLive {
  /** 编辑中的「强调色 1」（只在画布上预览，缩略图不变） */
  a1?: string
  /** 编辑中的「文字 1」 */
  dk1?: string
  /** 标题字体换成衬线（思源宋体 / Georgia） */
  serif?: boolean
}

export interface ThemeData {
  /** 已应用的主题（缺省 office：示例文档自带的主题，不在内置清单里） */
  themeCurrent?: ThemeId
  /** 「撤销」回到的主题（缺省 office） */
  themePrev?: ThemeId
  /** 已应用的变体序号（0–2） */
  themeVariant?: number
  themeGallery?: boolean
  themeEditor?: boolean
  themeTab?: "colors" | "fonts"
  /** 编辑面板里选中的色槽序号（0–11） */
  themeSlot?: number
  themeLive?: ThemeLive | null
  /** 打开状态时的轻提示：已应用的主题名 */
  themeToast?: string | null
  /** 只读（评审模式）：卡片只显示，不展开画廊、没有「调整主题」 */
  themeReadOnly?: boolean
}

/** 跨区域共享的主题状态。所有读取者传同一组初值（来自状态 data）。 */
export function useThemeState() {
  const { data } = useEditor()
  const d = data as ThemeData
  const [current, setCurrent] = useSceneState<ThemeId>("masters.theme.current", d.themeCurrent ?? "office")
  const [prev, setPrev] = useSceneState<ThemeId>("masters.theme.prev", d.themePrev ?? "office")
  // 画廊打开时的主题：不在内置清单里时，画廊首位放一张「当前」卡，画廊开着期间不变（应用别的主题后仍可点它回到原主题，03-28 §1）
  const [origin, setOrigin] = useSceneState<ThemeId>("masters.theme.origin", d.themeCurrent ?? "office")
  const [variant, setVariant] = useSceneState<number>("masters.theme.variant", d.themeVariant ?? 0)
  const [gallery, setGallery] = useSceneState<boolean>("masters.theme.gallery", !!d.themeGallery)
  const [editor, setEditor] = useSceneState<boolean>("masters.theme.editor", !!d.themeEditor)
  const [tab, setTab] = useSceneState<"colors" | "fonts">("masters.theme.tab", d.themeTab ?? "colors")
  const [slot, setSlot] = useSceneState<number>("masters.theme.slot", d.themeSlot ?? 4)
  const [live, setLive] = useSceneState<ThemeLive | null>("masters.theme.live", d.themeLive ?? null)
  const [toast, setToast] = useSceneState<string | null>("masters.theme.toast", d.themeToast ?? null)
  return {
    current, setCurrent, prev, setPrev, origin, setOrigin, variant, setVariant, gallery, setGallery, editor, setEditor, tab, setTab, slot, setSlot, live, setLive, toast, setToast,
    readOnly: !!d.themeReadOnly,
  }
}

/** 预览覆盖：画布外层加的类与 CSS 变量（editor/layouts/data.ts THEME_CSS 的 mt-live 读取 --mt-a1 / --mt-dk1）。 */
export function livePreview(live: ThemeLive | null | undefined): { className?: string; style?: CSSProperties } {
  if (!live) return {}
  const vars: Record<string, string> = {}
  if (live.a1) vars["--mt-a1"] = live.a1
  if (live.dk1) vars["--mt-dk1"] = live.dk1
  return { className: cn(live.a1 && "mt-live-a1", live.dk1 && "mt-live-dk1", live.serif && "mt-font-serif"), style: vars as CSSProperties }
}

/* ------------------------------------------------------------------ 主题缩略与卡片 */

/** 28 × 28 主题缩略：上面一整块强调色，下面四小块（与内置主题卡同构，颜色随主题）。 */
export function ThemeThumb({ theme }: { theme: ThemeDef }) {
  const [a, b, c, d, e] = theme.thumb
  return (
    <span aria-hidden="true" className="relative grid size-7 shrink-0 grid-cols-4 grid-rows-2 overflow-hidden rounded-[4px]">
      <span className="col-span-4" style={{ backgroundColor: a }} />
      <span style={{ backgroundColor: b }} />
      <span style={{ backgroundColor: c }} />
      <span style={{ backgroundColor: d }} />
      <span style={{ backgroundColor: e }} />
      <span className="absolute inset-0 rounded-[4px] shadow-[inset_0_0_0_1px_var(--v3-swatch-line)]" />
    </span>
  )
}

/**
 * 检查器「主题」卡片：与内置分区同一外观（主题缩略 + 名称 / 字体 + 右侧「调整主题」），整块可点，点开主题画廊。
 * 只读时只显示当前主题，不可点、没有「调整主题」（03-28 §3「自定义」不可交互）。
 * disabledReason（母版视图 M2，03-28 §3.8、R-59）：卡片只展示（同一外框，不展开画廊），「调整主题」留在原位不可用并写原因；adjustTipOpen 让它的提示一出现就开着（演示）
 */
export function ThemeCard({
  theme,
  open,
  onOpen,
  onAdjust,
  adjustOpen,
  readOnly,
  cardAnchor,
  adjustAnchor,
  disabledReason,
  adjustTipOpen,
}: {
  theme: ThemeDef
  open?: boolean
  onOpen?: () => void
  onAdjust?: () => void
  adjustOpen?: boolean
  readOnly?: boolean
  cardAnchor: string
  adjustAnchor: string
  disabledReason?: string
  adjustTipOpen?: boolean
}) {
  const fonts = theme.heading === theme.body ? theme.heading : `${theme.heading} / ${theme.body}`
  if (disabledReason && !readOnly) {
    return (
      <div data-v3-anchor={cardAnchor} className="flex items-center rounded-[4px] border border-(--v3-border)">
        <div className="flex min-w-0 flex-1 items-center gap-3 p-2">
          <ThemeThumb theme={theme} />
          <span className="min-w-0 flex-1 text-[12px] leading-4">
            <span className="block truncate text-(--v3-text)">{theme.name}</span>
            <span className="block truncate text-(--v3-text-2)">{fonts}</span>
          </span>
        </div>
        <IconButton label="调整主题" size={24} disabled reason={disabledReason} tipOpen={adjustTipOpen} data-v3-anchor={adjustAnchor} className="mr-2">
          <SlidersHorizontal {...ICON} />
        </IconButton>
      </div>
    )
  }
  if (readOnly) {
    return (
      // 只读（DS-15）：只写当前主题与字体，不画卡片外框（与其他只读行同一画法）
      <div data-v3-anchor={cardAnchor} className="flex items-center gap-3 py-0.5">
        <ThemeThumb theme={theme} />
        <div className="min-w-0 flex-1 text-[12px] leading-4">
          <p className="truncate text-(--v3-text)">{theme.name}</p>
          <p className="truncate text-(--v3-text-2)">{fonts}</p>
        </div>
      </div>
    )
  }
  return (
    <div data-v3-anchor={cardAnchor} className={cn("flex items-center rounded-[4px] border border-(--v3-border) transition-colors", open ? "bg-(--v3-panel-2)" : "hover:bg-(--v3-panel-2)")}>
      <button type="button" aria-haspopup="dialog" aria-expanded={!!open} aria-label={`主题：${theme.name}，${fonts}。展开主题画廊`} onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 rounded-[4px] p-2 text-left">
        <ThemeThumb theme={theme} />
        <span className="min-w-0 flex-1 text-[12px] leading-4">
          <span className="block truncate text-(--v3-text)">{theme.name}</span>
          <span className="block truncate text-(--v3-text-2)">{fonts}</span>
        </span>
      </button>
      <IconButton label="调整主题" tip="主题颜色与字体" size={24} variant={adjustOpen ? "on" : "ghost"} pressed={!!adjustOpen} data-v3-anchor={adjustAnchor} onClick={onAdjust} className="mr-2">
        <SlidersHorizontal {...ICON} />
      </IconButton>
    </div>
  )
}

/* ------------------------------------------------------------------ 主题画廊 */

/** 主题的真实预览：示例文档第 2 页（议程）换上这个主题的配色与字体（Q8，不画示意色块）。 */
export function ThemePreview({ theme, className }: { theme: ThemeDef; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("contents", theme.className)}>
      <SlideArt n={2} className={className} />
    </span>
  )
}

const thumbFrame = (on: boolean) => cn("relative block overflow-hidden rounded-[4px] border border-(--v3-border)", on ? "border-(--v3-accent) ring-[0.5px] ring-(--v3-accent)" : "group-hover:border-(--v3-hover-line)")

/**
 * 主题画廊（弹层内容，宽 320）：内置 5 套主题——简约 / 商务 / 暗色 / 学术 / 活力，与开始页模板同一份数据（rulings §4.25 DS-33）——的真实预览（2 列）
 * + 当前主题的 3 个变体（DS-32）。打开时文档的主题不在内置清单里（示例文档自带的 Office），首位另放一张「当前」卡（名称后带「当前」标记），
 * 画廊开着期间这张卡不变，应用别的主题后仍可点它回到原主题；文档的主题本身就是某套内置主题时不另放（03-28 §1）。
 * 点主题卡或变体即应用（一个事务、不弹确认），之后给可撤销轻提示「已应用主题「X」，影响 N 页」（rulings §4.20 FE-07）。主题颜色与字体的细调在卡片右侧「调整主题」。
 */
export function ThemeGallery({
  current,
  origin,
  variant,
  onApply,
  onVariant,
  onClose,
}: {
  current: ThemeId
  /** 画廊打开时的主题（不在内置清单里时首位放「当前」卡） */
  origin: ThemeId
  variant: number
  onApply: (t: ThemeId) => void
  onVariant: (i: number) => void
  onClose: () => void
}) {
  const cur = themeOf(current)
  const cards: { theme: ThemeDef; origin: boolean }[] = [
    ...(isBuiltinTheme(origin) ? [] : [{ theme: themeOf(origin), origin: true }]),
    ...BUILTIN_THEMES.map((theme) => ({ theme, origin: false })),
  ]
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex h-6 items-center justify-between">
        <PopoverTitle>主题</PopoverTitle>
        <IconButton label="关闭" size={24} onClick={onClose}>
          <X {...ICON} />
        </IconButton>
      </div>
      <div role="radiogroup" aria-label="主题" className="grid grid-cols-2 gap-3">
        {cards.map(({ theme: t, origin: isOrigin }) => {
          const on = t.id === current
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={isOrigin ? `${t.name}（当前文档的主题）` : t.name}
              onClick={() => onApply(t.id)}
              className="group flex min-w-0 flex-col gap-1.5 text-left"
            >
              <span className={thumbFrame(on)}>
                <ThemePreview theme={t} />
              </span>
              <span className="flex h-4 items-center justify-between gap-2 text-[12px] leading-4 whitespace-nowrap">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={cn("text-(--v3-text)", on && "font-medium")}>{t.name}</span>
                  {isOrigin && <Tag>当前</Tag>}
                </span>
                <span className="text-(--v3-text-2)">{t.heading}</span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="-mx-3 h-px bg-(--v3-border)" />
      <div className="flex flex-col gap-2">
        <p className="text-[12px] leading-4 text-(--v3-text-2)">变体 · {cur.name}</p>
        <div role="radiogroup" aria-label="变体" className="flex gap-2">
          {cur.variants.map((v, i) => {
            const on = i === variant
            return (
              <Tip key={v.join()} label={`变体 ${i + 1}`}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`变体 ${i + 1}`}
                  onClick={() => onVariant(i)}
                  className={cn(
                    "relative flex h-7 w-11 overflow-hidden rounded-[4px] transition-shadow",
                    on ? "ring-2 ring-(--v3-accent) ring-offset-2 ring-offset-(--v3-panel)" : "hover:ring-1 hover:ring-(--v3-hover-line) hover:ring-offset-1 hover:ring-offset-(--v3-panel)",
                  )}
                >
                  {v.map((c) => (
                    <span key={c} className="flex-1" style={{ backgroundColor: c }} />
                  ))}
                  <span className="pointer-events-none absolute inset-0 rounded-[4px] shadow-[inset_0_0_0_1px_var(--v3-swatch-line)]" />
                </button>
              </Tip>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 主题颜色与字体 */

const SERIF = ["思源宋体", "Georgia"]
const fontClass = (f: string) => (SERIF.includes(f) ? "v3-serif" : "")

/**
 * 主题颜色与字体（弹层内容，宽 300）：「颜色」页 12 个色槽（产品化名称，2 列），点色槽在下方编辑（03-16 颜色选择器的同款内容：
 * 自定义色值 + 标准色 + 最近使用）；「字体」页标题 / 正文字体 + 20px 示例（预览文字是文档内容，不是界面字号）。
 * 编辑中的值只在画布上预览（不写文档、缩略图不变）；底部 [取消][应用]，应用 = 一个事务 + 可撤销轻提示。
 */
export function ThemeEditor({
  theme,
  previewOf,
  tab,
  onTab,
  slot,
  onSlot,
  live,
  onLive,
  onCancel,
  onApply,
  fluid,
}: {
  theme: ThemeDef
  /** 「当前页」或「当前母版」 */
  previewOf: string
  tab: "colors" | "fonts"
  onTab: (t: "colors" | "fonts") => void
  slot: number
  onSlot: (i: number) => void
  live: ThemeLive | null
  onLive: (l: ThemeLive | null) => void
  onCancel: () => void
  onApply: () => void
  /**
   * 随宽度自适应（弹层盖检查器栏时，规格 §3.6；rulings §4.25 DS-155、TB-193，两种视图同一画法）：宽随检查器 240–480，底栏放不下「说明 + 取消 + 应用」一行时两枚按钮一起换到下一行、靠右，
   * 不截断、不溢出；高铺满弹层（弹层从页签行下沿盖到栏底，2026-10-30 总编排裁定第 4 条）：页头（标题 · 颜色 / 字体）与底栏固定，
   * 中间的色槽、编辑区或字体在弹层里滚动，底栏贴弹层底。不传时是定宽 300 的原画法（未采纳的原位置，只在对比场景里出现），DOM 与原来逐字相同
   */
  fluid?: boolean
}) {
  const colorOf = (i: number) => {
    const s = theme.slots[i]
    if (!s) return "#000000"
    if (i === 4 && live?.a1) return live.a1
    if (i === 1 && live?.dk1) return live.dk1
    return s.hex
  }
  const cur = theme.slots[slot]
  const setColor = (hex: string) => {
    if (slot === 4) onLive({ ...live, a1: hex })
    else if (slot === 1) onLive({ ...live, dk1: hex })
  }
  const heading = live?.serif ? "思源宋体" : theme.heading
  const changed = !!(live && (live.a1 || live.dk1 || live.serif))
  // 左右内距与伸到两边的分隔线（2026-10-31 总编排裁定第 9 条 ③）：盖检查器栏时取检查器节内容的同一个类名（ui.tsx Section 与检查器页签行都是左右 16 的内距类名），
  // 整栏被盖住后弹层内容的左缘与下面检查器内容的左缘对齐（原来是浮层惯例的左右 12，差 4 px）；定宽画法仍是左右 12，类名与 DOM 逐字不变
  const pad = fluid ? "px-4" : "px-3"
  const rule = fluid ? "-mx-4 h-px bg-(--v3-border)" : "-mx-3 h-px bg-(--v3-border)"
  const footButtons = (
    <>
      <Button variant="secondary" onClick={onCancel}>
        取消
      </Button>
      <Button variant="primary" onClick={onApply}>
        应用
      </Button>
    </>
  )
  const head = (
    <>
      <div className="flex h-6 items-center justify-between">
        <PopoverTitle>主题颜色与字体 · {theme.name}</PopoverTitle>
        <IconButton label="关闭" size={24} onClick={onCancel}>
          <X {...ICON} />
        </IconButton>
      </div>
      <Segmented
        aria="主题编辑"
        value={tab}
        onValueChange={onTab}
        options={[
          { value: "colors", label: "颜色", text: "颜色" },
          { value: "fonts", label: "字体", text: "字体" },
        ]}
      />
    </>
  )
  const body =
    tab === "colors" ? (
      <>
        <div role="radiogroup" aria-label="主题色槽" className="-mx-1.5 grid grid-cols-2 gap-x-1 gap-y-0.5">
          {theme.slots.map((s, i) => {
            const on = i === slot
            return (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`${s.label} ${colorOf(i)}`}
                onClick={() => onSlot(i)}
                className={cn("flex h-7 items-center gap-2 rounded-[4px] px-1.5 text-left text-[12px] leading-none whitespace-nowrap transition-colors", on ? "bg-(--v3-panel-2) text-(--v3-text)" : "text-(--v3-text) hover:bg-(--v3-panel-2)")}
              >
                <span
                  aria-hidden="true"
                  className={cn("size-4 shrink-0 rounded-[3px] shadow-[inset_0_0_0_1px_var(--v3-swatch-line)]", on && "ring-2 ring-(--v3-accent) ring-offset-1 ring-offset-(--v3-panel-2)")}
                  style={{ backgroundColor: colorOf(i) }}
                />
                {s.label}
              </button>
            )
          })}
        </div>
        <div className={rule} />
        <div className="flex flex-col gap-3">
          <div className="flex h-4 items-center justify-between">
            <PopoverTitle>{cur?.label}</PopoverTitle>
            {slot === 4 && live?.a1 && <span className="text-[12px] leading-none text-(--v3-text-2)">原为 {cur?.hex}</span>}
          </div>
          <ColorField key={`${slot}:${colorOf(slot)}`} color={colorOf(slot)} aria={cur?.label ?? "颜色"} />
          <SwatchPicker
            aria={`${cur?.label ?? ""}颜色`}
            value={colorOf(slot)}
            onChange={setColor}
            groups={[
              { label: "标准色", colors: STANDARD_COLORS },
              { label: "最近使用", colors: RECENT_COLORS },
            ]}
          />
        </div>
      </>
    ) : (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <p className="text-[12px] leading-4 text-(--v3-text-2)">标题字体</p>
          <MenuField aria="标题字体" items={FONTS} defaultValue={heading} />
          <p className={cn("truncate text-[20px] leading-7 font-semibold text-(--v3-text)", fontClass(heading))}>AaBb 标题示例 123</p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[12px] leading-4 text-(--v3-text-2)">正文字体</p>
          <MenuField aria="正文字体" items={FONTS} defaultValue={theme.body} />
          <p className={cn("truncate text-[20px] leading-7 text-(--v3-text)", fontClass(theme.body))}>AaBb 正文示例 123</p>
        </div>
        <p className="flex items-start gap-2 text-[12px] leading-[18px] text-(--v3-text-2)">
          <Info {...ICON} aria-hidden="true" className="mt-px shrink-0" />
          {/* 两个短句各自不断行：盖检查器栏时宽随检查器，300 宽下整句放不下一行，原来最后一个字单独掉到第二行；放得下时仍是一行 */}
          <span>
            <span className="inline-block max-w-full">只影响文档内容的字体，</span>
            <span className="inline-block max-w-full">不影响编辑器界面</span>
          </span>
        </p>
      </div>
    )
  const note = changed ? `正在预览${previewOf}` : `改动会实时预览${previewOf}`
  if (fluid)
    return (
      // 盖检查器栏的画法：铺满弹层高的纵向三段——页头（标题 · 颜色 / 字体）不随内容滚；中间内容区在弹层里滚动，上内距 12 即页头与内容之间原来的间距；
      // 底栏贴弹层底，「取消 · 应用」两枚按钮成组，放不下时一起换到下一行、靠右（不拆开）。三段的左右内距都是检查器节内容的那一个（pad）
      <div className="flex h-full flex-col">
        <div className={cn("flex shrink-0 flex-col gap-3 pt-3", pad)}>{head}</div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className={cn("flex flex-col gap-3 py-3", pad)}>{body}</div>
        </div>
        <div className={cn("flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-(--v3-border) py-3", pad)}>
          <span className="mr-auto text-[12px] leading-4 whitespace-nowrap text-(--v3-text-2)">{note}</span>
          <span className="flex gap-2">{footButtons}</span>
        </div>
      </div>
    )
  // 定宽画法（anchor：未采纳的原位置，只在对比场景里由数据 mvVariant.themePop 打开）：结构与类名同原画法，一字不动
  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 p-3">
        {head}
        {body}
      </div>
      <div className="flex items-center gap-2 border-t border-(--v3-border) px-3 py-3">
        <span className="mr-auto text-[12px] leading-4 text-(--v3-text-2)">{note}</span>
        {footButtons}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 组装：卡片 + 两个弹层 */

/**
 * 卡片 + 主题画廊 + 主题颜色与字体，一起放进检查器分区（普通视图的「主题」节、母版视图的「主题」节都用它）。
 * 主题画廊贴卡片、贴检查器左缘向左展开（位置不变）；「主题颜色与字体」一律盖在检查器栏上（rulings §4.25 DS-155、TB-193，普通视图与母版视图同一画法；规格 §3.6）：
 *   kit Popover cover，宽随检查器、内容随宽度自适应，高从页签行下沿铺到栏底（盖住整栏，检查器原有内容一处都不露）——画布整页可见。
 * 对比场景里未采纳的原位置（数据 mvVariant.themePop = anchor）：贴「调整主题」、检查器左缘向左展开，定宽 300，盖住画布右侧。
 * disabledReason（母版视图 M2）：卡片只展示、「调整主题」留在原位不可用并写原因；adjustTipOpen：这一条原因的提示一出现就开着（演示，第一次操作后收起）
 */
export function ThemeControl({
  cardAnchor,
  adjustAnchor,
  previewOf,
  themeId,
  readOnly: ro,
  disabledReason,
  adjustTipOpen,
}: {
  cardAnchor: string
  adjustAnchor: string
  /** 「当前页」或「当前母版」 */
  previewOf: string
  /** 指定显示哪个主题（母版视图里是所选母版关联的主题）；缺省为已应用的主题 */
  themeId?: ThemeId
  readOnly?: boolean
  disabledReason?: string
  adjustTipOpen?: boolean
}) {
  const t = useThemeState()
  const ed = useEditorMaybe()
  const tipOpen = useDemoOpen(!!adjustTipOpen && !!disabledReason)
  const variant = (ed?.data as { mvVariant?: { themePop?: "anchor" | "inspector" } } | undefined)?.mvVariant?.themePop
  const place = variant ?? "inspector"
  const theme = themeOf(themeId ?? t.current)
  const readOnly = ro || t.readOnly
  /** 点的是这个锚点（卡片 / 调整按钮）本身：交给它自己切换开关，弹层不先关 */
  const onAnchor = (name: string) => (e: Event) => {
    if ((e.target as HTMLElement | null)?.closest(`[data-v3-anchor="${name}"]`)) e.preventDefault()
  }
  const apply = (id: ThemeId) => {
    if (id !== t.current) t.setPrev(t.current)
    t.setCurrent(id)
    t.setVariant(0)
    t.setToast(themeOf(id).name)
  }
  return (
    <>
      <ThemeCard
        theme={theme}
        readOnly={readOnly}
        open={t.gallery}
        adjustOpen={t.editor}
        cardAnchor={cardAnchor}
        adjustAnchor={adjustAnchor}
        disabledReason={disabledReason}
        adjustTipOpen={tipOpen}
        onOpen={() => {
          t.setEditor(false)
          // 打开时记下文档当前的主题：不在内置清单里就放在画廊首位（「当前」卡），画廊开着期间不变
          if (!t.gallery) t.setOrigin(theme.id)
          t.setGallery(!t.gallery)
        }}
        onAdjust={() => {
          t.setGallery(false)
          t.setEditor(!t.editor)
        }}
      />
      {!readOnly && !disabledReason && (
        <>
          <Popover
            anchor={cardAnchor}
            label="主题画廊"
            open={t.gallery}
            onOpenChange={t.setGallery}
            onInteractOutside={onAnchor(cardAnchor)}
            className="w-[320px] p-0"
          >
            <ThemeGallery current={theme.id} origin={t.origin} variant={t.variant} onApply={apply} onVariant={(i) => (t.setVariant(i), t.setToast(theme.name))} onClose={() => t.setGallery(false)} />
          </Popover>
          <Popover
            anchor={adjustAnchor}
            label="主题颜色与字体"
            open={t.editor}
            onOpenChange={(v) => {
              if (!v) t.setLive(null)
              t.setEditor(v)
            }}
            onInteractOutside={onAnchor(adjustAnchor)}
            cover={place === "inspector" ? "inspector" : undefined}
            className={place === "inspector" ? "p-0" : "w-[300px] p-0"}
          >
            <ThemeEditor
              fluid={place === "inspector" || undefined}
              theme={theme}
              previewOf={previewOf}
              tab={t.tab}
              onTab={t.setTab}
              slot={t.slot}
              onSlot={t.setSlot}
              live={t.live}
              onLive={t.setLive}
              onCancel={() => {
                t.setLive(null)
                t.setEditor(false)
              }}
              onApply={() => {
                t.setLive(null)
                t.setEditor(false)
                t.setToast(theme.name)
              }}
            />
          </Popover>
        </>
      )}
    </>
  )
}

/**
 * 画布上的轻提示（放 canvasOverlay）：应用主题后「已应用主题「X」，影响 N 页 [撤销]」，5 s；「撤销」一步回到应用前的主题。
 * 只属于普通视图：母版视图里应用主题的那一条由母版视图自己画（MasterChrome 的 MasterOverlay，读同一个键），这里不画，免得两条叠在一起（rulings §4.25 DS-158、TB-204）
 */
export function ThemeToast({ pages }: { pages: number }) {
  const t = useThemeState()
  const { masterView } = useEditor()
  if (!t.toast || masterView.on) return null
  return (
    <Toasts>
      <Toast action="撤销" onAction={() => (t.setCurrent(t.prev), t.setVariant(0), t.setToast(null))}>
        已应用主题<span className="whitespace-nowrap">「{t.toast}」</span>，影响 {pages} 页
      </Toast>
    </Toasts>
  )
}
