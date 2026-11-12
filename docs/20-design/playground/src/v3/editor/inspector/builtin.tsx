import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react"
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical,
  AlignVerticalDistributeCenter, ChevronDown, ChevronRight, ChevronUp, Image as ImageIcon, SlidersHorizontal, type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { FillGradientIcon, FillNoneIcon, FillSolidIcon } from "../../shape-icons"
import type { ReactNode } from "react"
import { Button, Cols, Field, FIELD_FRAME, ICON, IconButton, MenuField, reasonTip, Section, Segmented, SELECT_FRAME, Swatch, Tip, ToggleStrip, withReason, type SegOption, type SwatchKey } from "../../ui"
import { LayoutThumb, SlideLayoutSection } from "../layouts/LayoutGallery"
import { CheckRow, ColorChip, SliderField } from "../../kit/controls"
import { useSceneState } from "../../kit/scene"
import { useEditor } from "../context"
import { themeOf, type ThemeDef, type ThemeId } from "../layouts/data"
import { getToolLayer } from "../insert-menus"
import { MASTER_VIEW_ICON } from "../master/mode"
import { GeometrySection } from "./geometry"
import { StaticRow } from "./parts"
import { inspectorPanel, inspectorSections, type InspectorCtx } from "./registry"
import { TextBoxSection, TextColorSection, TextFontSection, TextListSection, TextParagraphSection } from "./text"

export { LayoutThumb, StaticRow }

/**
 * 内置检查器分区：无选中（幻灯片属性）、选中形状（矩形）、编辑文本三种选中态。
 * 通过 registry 注册，外观与改造前的 SlidePane / ShapePane / TextPane 一致。
 * 分区 id 与 order（场景可在空位插入自己的分区，或用 EditorConfig.inspector.sections 换掉某个分区）：
 *   none  ：slide.layout 10（版式画廊，editor/layouts）· slide.theme 20 · slide.background 30（DS-20：原「页面颜色」并入「背景」）· slide.playback 40（切换 M2 只读、放映时跳过此页）
 *   shape ：shape.align 0（top，标题上方）· shape.geometry 10（位置与大小，所有对象共用 ./geometry.tsx）· shape.style 20（快速样式，DS-31）· shape.fill 30 · shape.stroke 40 ·
 *           shape.shadow 50 · shape.opacity 60 · shape.action 70
 *   text  ：text.font 10 · text.paragraph 20 · text.color 30 · text.list 40 · text.box 50（03-16 定稿的五个分区，见 ./text.tsx；值从 data.text 读）
 * 锚点（data-v3-anchor）：每个分区 section-<分区 id>；另有 layout-field、theme-card、theme-adjust、background-color、background-image、quick-styles、fill-color、
 * font-latin、font-ea、text-color、text-highlight、list-bullets、list-numbering。
 * 只读（InspectorCtx.readOnly：评审模式、只读角色，DS-15）：各节只列属性与当前值（StaticRow），不显示不可用的控件；对齐行是命令，不出现。
 * 权限说明（「只读 · 评审模式下不可编辑」等）由编辑器放在面板顶部（EditorConfig.mode → inspector.notice）。
 */

/* ------------------------------------------------------------------ 无选中：幻灯片属性 */

/** 主题缩略：28 × 28，五个主题色拼成的小方块（上面一整块品牌色，下面四小块）。 */
export function ThemeThumb() {
  return (
    <span aria-hidden="true" className="relative grid size-7 shrink-0 grid-cols-4 grid-rows-2 overflow-hidden rounded-[4px]">
      <span className="col-span-4 bg-[#3A5CE6]" />
      <span className="bg-[#141B2D]" />
      <span className="bg-[#8A93A6]" />
      <span className="bg-[#AFC0F8]" />
      <span className="bg-[#E8EDFD]" />
      <span className="absolute inset-0 rounded-[4px] shadow-[inset_0_0_0_1px_var(--v3-swatch-line)]" />
    </span>
  )
}

type BgType = "follow" | "solid" | "gradient" | "image"

const BG_TYPES: SegOption<BgType>[] = [
  { value: "solid", label: "纯色", icon: <FillSolidIcon /> },
  { value: "gradient", label: "渐变", icon: <FillGradientIcon /> },
  { value: "image", label: "图片", icon: <ImageIcon {...ICON} /> },
]

/**
 * 版式（母版视图）：分段多一项「跟随母版」，缺省选中。四项都是图标（2026-10-30 母版视图改版第二步规格 §3.4.10，DS-151）：跟随母版用母版视图的图标（与上下文条同一个），
 * 纯色 / 渐变 / 图片同 BG_TYPES，名字进工具提示与读屏名——与普通页、母版的背景分段同一外形。全仓只有母版视图的版式背景传 follow
 */
const BG_TYPES_FOLLOW: SegOption<BgType>[] = [
  { value: "follow", label: "跟随母版", icon: <MASTER_VIEW_ICON {...ICON} /> },
  ...BG_TYPES,
]

interface BgColor {
  hex: string
  /** 色槽名（产品化名称，如「背景 1」）或标准色名 */
  name: string
}

/** 背景的常用主题色（DS-20 色块快捷项）：主题的背景 1 / 背景 2 / 文字 1 / 文字 2 / 强调色 1 / 强调色 3，与主题缩略同一组颜色。 */
function themeSwatches(theme: ThemeDef): BgColor[] {
  const pick = [0, 2, 1, 3, 4, 6]
  return pick.map((i) => theme.slots[i]).filter((x): x is NonNullable<typeof x> => !!x).map((x) => ({ hex: x.hex, name: x.label }))
}

/**
 * 主题卡的交互件（卡片展开主题画廊、「调整主题」打开主题颜色与字体，03-28）由设计主题场景登记一次，任何状态的「幻灯片 N › 主题」都用它；
 * 没有登记时退回静态卡片。只读时只写当前主题与字体（DS-15：不画卡片外框，与其他只读行同一画法）。
 */
let THEME_CONTROL: (() => ReactNode) | null = null
export function registerSlideThemeControl(render: () => ReactNode) {
  THEME_CONTROL = render
}

function SlideThemeSection({ readOnly, disabled }: InspectorCtx) {
  if (readOnly)
    return (
      <Section title="主题" anchor="section-slide.theme" bodyClassName="gap-0">
        <div data-v3-anchor="theme-card" className="flex items-center gap-3 py-0.5">
          <ThemeThumb />
          <div className="min-w-0 flex-1 text-[12px] leading-4">
            <p className="truncate text-(--v3-text)">Office</p>
            <p className="truncate text-(--v3-text-2)">思源黑体</p>
          </div>
        </div>
      </Section>
    )
  if (THEME_CONTROL && !disabled) return <Section title="主题" anchor="section-slide.theme">{THEME_CONTROL()}</Section>
  return (
    <Section title="主题" anchor="section-slide.theme">
      {/* 一行卡片：左侧主题缩略，中间两行文字，右侧调整图标（与 Figma 的 Light slides / Inter 同结构） */}
      <div data-v3-anchor="theme-card" className="flex items-center gap-3 rounded-[4px] border border-(--v3-border) p-2">
        <ThemeThumb />
        <div className={cn("min-w-0 flex-1 text-[12px] leading-4", disabled && "text-(--v3-text-3)")}>
          <p className={cn("truncate", !disabled && "text-(--v3-text)")}>Office</p>
          <p className={cn("truncate", !disabled && "text-(--v3-text-2)")}>思源黑体</p>
        </div>
        <IconButton label="调整主题" size={24} disabled={!!disabled} reason={disabled} data-v3-anchor="theme-adjust">
          <SlidersHorizontal {...ICON} />
        </IconButton>
      </div>
    </Section>
  )
}

/** 渐变背景的预览色块：从所选颜色渐变到白色（选的是白色时渐变到浅蓝，免得看不出渐变）。文档色是内容，所以用内联背景。 */
function GradientChip({ hex }: { hex: string }) {
  const end = hex.toUpperCase() === "#FFFFFF" ? "#E8EDFD" : "#FFFFFF"
  return (
    <span
      aria-hidden="true"
      className="inline-block size-4 shrink-0 rounded-[3px] shadow-[inset_0_0_0_1px_var(--v3-swatch-line)]"
      style={{ backgroundImage: `linear-gradient(135deg, ${hex}, ${end})` }}
    />
  )
}

/**
 * 背景的色块快捷项（DS-20「常用主题色做成色块快捷项」）：24px 方块、圆角 4、间距 8；当前颜色 2px 强调色外圈（隔 2px 面板底），
 * 悬停 1px 灰圈；工具提示「名称 色值」。disabled：留在原位、aria-disabled、工具提示「名称 · 原因」，当前色外圈退成灰色。
 */
function BgSwatches({ colors, value, onPick, disabled }: { colors: BgColor[]; value: string; onPick: (hex: string) => void; disabled?: string }) {
  return (
    <div role="group" aria-label={withReason("主题颜色", disabled)} className="flex flex-wrap gap-2">
      {colors.map((c) => {
        const on = c.hex.toUpperCase() === value.toUpperCase()
        return (
          <Tip key={c.name} label={disabled ? reasonTip(c.name, disabled) : `${c.name} ${c.hex}`}>
            <button
              type="button"
              aria-label={withReason(`${c.name} ${c.hex}`, disabled)}
              aria-pressed={on}
              aria-disabled={disabled ? true : undefined}
              onClick={() => !disabled && onPick(c.hex)}
              className={cn(
                "flex shrink-0 rounded-[4px] transition-shadow",
                on
                  ? cn("ring-2 ring-offset-2 ring-offset-(--v3-panel)", disabled ? "ring-(--v3-text-3)" : "ring-(--v3-accent)")
                  : !disabled && "hover:ring-1 hover:ring-(--v3-hover-line) hover:ring-offset-1 hover:ring-offset-(--v3-panel)",
                disabled && "cursor-default",
              )}
            >
              <ColorChip color={c.hex} className="size-6 rounded-[4px]" />
            </button>
          </Tip>
        )
      })}
    </div>
  )
}

export interface BackgroundControlProps {
  /** 当前背景所用的主题（色块快捷项与色槽名取它；缺省示例主题 Office） */
  theme?: ThemeDef
  /** 当前颜色（缺省主题的「背景 1」） */
  hex?: string
  /** 版式页：分段多一项「跟随母版」，缺省选中；master 母版名，fill 母版的背景（如「纯色 · 背景 1」） */
  follow?: { master: string; fill: string }
  /** 节末的附加控件（如版式的「隐藏背景图形」） */
  extra?: ReactNode
  readOnly?: boolean
  disabled?: string
  anchor?: string
}

/**
 * 背景（DS-20：原「背景」与「页面颜色」两节取值重叠，合并为这一节；普通页、设计主题、母版、版式都用这一份）：
 * 先选填充方式（纯色 / 渐变 / 图片；版式多一项「跟随母版」），再选颜色——颜色字段写色块 + 色值 + 色槽名（跟随主题时一看就知道取的是哪个色槽），
 * 常用主题色做成色块快捷项，点了颜色字段跟着变。渐变时颜色字段的色块是渐变预览、色块快捷项选渐变的起始色；图片时换成「选择图片…」。
 * 只读（评审 / 浏览，DS-15）只写当前值；disabled（降权、打开中、M2）字段留在原位不可用。
 */
export function BackgroundControl({ theme = themeOf("office"), hex: initialHex, follow, extra, readOnly, disabled, anchor = "section-slide.background" }: BackgroundControlProps) {
  const swatches = themeSwatches(theme)
  const start = initialHex ?? swatches[0]?.hex ?? "#FFFFFF"
  const [type, setType] = useState<BgType>(follow ? "follow" : "solid")
  const [hex, setHex] = useState(start)
  const slot = swatches.find((c) => c.hex.toUpperCase() === hex.toUpperCase())?.name
  if (readOnly)
    return (
      <Section title="背景" anchor={anchor} bodyClassName="gap-0">
        {follow ? (
          <StaticRow label="填充">
            跟随母版<span className="text-(--v3-text-2)"> · {follow.fill}</span>
          </StaticRow>
        ) : (
          <StaticRow label="填充" leading={<ColorChip color={hex} />}>
            纯色 · {slot ?? hex}
            {slot && <span className="text-(--v3-text-2) tabular-nums"> · {hex}</span>}
          </StaticRow>
        )}
        {extra}
      </Section>
    )
  return (
    <Section title="背景" anchor={anchor}>
      <Segmented aria="填充方式" value={type} onValueChange={setType} options={follow ? BG_TYPES_FOLLOW : BG_TYPES} disabled={!!disabled} reason={disabled} />
      {type === "follow" && follow ? (
        // 跟随母版：颜色字段留在原位、不可改（同一个字段外形，一看就知道取的是母版的哪个颜色），下面一行写明来源。
        // 原因：整节不可用（disabled：M2、降权、加载中…）时取那一句，与同一节的填充方式分段一致；本来可编辑、只是跟随母版时才写「改成纯色等方式后可改」
        <>
          <ColorRow chip={<ColorChip color={hex} />} hex={hex} name={slot} aria="背景" anchor="background-color" disabled reason={disabled || "跟随母版；改成「纯色」等方式后可改颜色"} />
          <p className="text-[12px] leading-[18px] text-(--v3-text-2)">
            {/* 母版名整段不断行、最宽一整行（名称最长 64 字，只用不换行会伸出检查器；只有母版视图的版式背景走到这里） */}
            与母版<span className="inline-block max-w-full">「{follow.master}」</span>相同：{follow.fill}
          </p>
        </>
      ) : type === "image" ? (
        <Button variant="secondary" className="w-full" disabled={!!disabled} reason={disabled} data-v3-anchor="background-image">
          <ImageIcon {...ICON} aria-hidden="true" />
          选择图片…
        </Button>
      ) : (
        <>
          {/* key：换了颜色或填充方式时重新挂载，输入框的初值跟着走 */}
          <ColorRow
            key={`${type}:${hex}`}
            chip={type === "gradient" ? <GradientChip hex={hex} /> : <ColorChip color={hex} />}
            hex={hex}
            name={slot}
            aria={type === "gradient" ? "渐变起始" : "背景"}
            anchor="background-color"
            disabled={!!disabled}
            reason={disabled}
          />
          <BgSwatches colors={swatches} value={hex} onPick={setHex} disabled={disabled} />
        </>
      )}
      {extra}
    </Section>
  )
}

/** 无选中：幻灯片的背景（示例主题 Office、白底） */
function SlideBackgroundSection({ readOnly, disabled }: InspectorCtx) {
  return <BackgroundControl readOnly={readOnly} disabled={disabled} />
}

/**
 * 放映（无选中的第四节）：
 * - 切换：原无选中态「切换」在检查器里的落位（02 §4.1，第 1 批定稿，rulings §4.25 DS-21）。切换效果的编辑不在 M1–M3 范围（章程 §2.3，
 *   PRD 01 矩阵「切换效果」行）——文件里带来的切换效果原样显示、保存时保留，字段留在原位不可用并写原因（FE-06 禁用而不隐藏），
 *   原因按 rulings §4.10 Q15 的口径，不承诺版本；值从 data.transition 读（缺省「无」）。
 * - 放映时跳过此页：隐藏此页的常驻入口（03-14 D15、DS-25；缩略图右键「隐藏幻灯片」是第二入口，菜单不算重复），值从 data.slideHidden 读。
 * 只读（DS-15）只写当前值。
 */
function SlidePlaybackSection({ readOnly, disabled, data }: InspectorCtx) {
  const transition = typeof data.transition === "string" ? data.transition : "无"
  const hidden = data.slideHidden === true
  if (readOnly)
    return (
      <Section title="放映" anchor="section-slide.playback" bodyClassName="gap-0">
        <StaticRow label="切换">{transition}</StaticRow>
        <StaticRow label="放映时">{hidden ? "跳过此页" : "播放此页"}</StaticRow>
      </Section>
    )
  return (
    <Section title="放映" anchor="section-slide.playback">
      <MenuField
        aria="切换效果"
        items={["无", "淡化", "推入", "擦除"]}
        defaultValue={transition}
        leading={<span className="shrink-0 text-[12px] leading-none text-(--v3-text-3)">切换</span>}
        disabled
        reason={disabled ?? "切换效果已原样保留，M1–M3 暂不可编辑"}
        anchor="slide-transition"
      />
      <CheckRow label="放映时跳过此页" defaultChecked={hidden} disabled={!!disabled} reason={disabled} />
    </Section>
  )
}

/* ------------------------------------------------------------------ 选中矩形 */

/** 示例第 2 页要点卡（矩形）的当前值：编辑态字段的初值与只读展示（DS-15）同一份。 */
const CARD = { x: "629", y: "232", rotate: "0", w: "264", h: "176", fill: "#EEF2FF", opacity: "100%" } as const

/** 六向对齐与两种分布：名称与多选对齐行、多选右键「对齐与分布 ▸」同一组命令标题（03-17 §5，rulings §4.25 TB-20） */
const ALIGN_ITEMS: { label: string; Icon: LucideIcon }[] = [
  { label: "左对齐", Icon: AlignStartVertical },
  { label: "水平居中", Icon: AlignCenterVertical },
  { label: "右对齐", Icon: AlignEndVertical },
  { label: "顶对齐", Icon: AlignStartHorizontal },
  { label: "垂直居中", Icon: AlignCenterHorizontal },
  { label: "底对齐", Icon: AlignEndHorizontal },
]
const DISTRIBUTE_ITEMS: { label: string; Icon: LucideIcon }[] = [
  { label: "横向分布", Icon: AlignHorizontalDistributeCenter },
  { label: "纵向分布", Icon: AlignVerticalDistributeCenter },
]

/**
 * 对齐与分布是命令、不是属性：只读时不出现（DS-15 只列属性与当前值）。
 * 单选（TB-20）：六向对齐 + 竖分隔 + 横向分布、纵向分布两枚按钮，与多选的对齐行同一组命令；单选固定相对页面（不显示「对齐参照」），
 * 分布要 3 个以上对象，单选时留在原位不可用（aria-disabled、仍可聚焦）并写原因（03-17 §5）。
 */
function AlignRow({ readOnly }: InspectorCtx) {
  if (readOnly) return null
  return (
    <Section className="px-2.5 py-2" anchor="section-shape.align">
      <div className="flex items-center justify-between">
        {ALIGN_ITEMS.map(({ label, Icon }) => (
          <IconButton key={label} label={label}>
            <Icon {...ICON} />
          </IconButton>
        ))}
        <span aria-hidden="true" className="h-4 w-px bg-(--v3-border)" />
        {DISTRIBUTE_ITEMS.map(({ label, Icon }) => (
          <IconButton key={label} label={label} disabled reason="需选中 3 个以上对象">
            <Icon {...ICON} />
          </IconButton>
        ))}
      </div>
    </Section>
  )
}

/**
 * 颜色行：色块 + 十六进制 + 不透明度，一个 28px 字段（文档自己的颜色用静态色块类名；chip 换成任意色块，如渐变预览）。
 * 色值与不透明度都可以直接输入，所以外框是输入字段画法（ui.tsx FIELD_FRAME：panel-2 淡底、不描边，悬停出细边，rulings §4.25 DS-35），
 * 两者之间是 --v3-field-split 竖线（1px 面板色通高切口，同 Figma「96 | ▾」），聚焦时边界换强调色。色槽名（如「背景 1」）只是尾注。
 * disabled + reason：字段留在原位、输入框只读且 aria-disabled（仍可聚焦），文字退到 text-3、底退到 --v3-field-fill-off、边界退到 --v3-field-line-off、不响应悬停，
 * 工具提示写原因（与 MenuField / SelectTrigger 的不可用态一致）。
 */
export function ColorRow({
  color,
  chip,
  hex,
  name,
  aria,
  anchor,
  disabled,
  reason,
}: {
  color?: SwatchKey
  /** 换掉左侧的静态色块 */
  chip?: ReactNode
  hex: string
  /** 色值后的色槽名（text-2，如「背景 1」）：取的是主题色时写明是哪个色槽 */
  name?: string
  aria: string
  anchor?: string
  disabled?: boolean
  reason?: string
}) {
  const why = disabled ? reason : undefined
  const field = (
    <div
      data-v3-anchor={anchor}
      className={cn(
        FIELD_FRAME,
        "flex h-7 items-center transition-colors",
        disabled ? "cursor-default bg-(--v3-field-fill-off) text-(--v3-text-3) ring-(--v3-field-line-off)" : "text-(--v3-text) focus-within:ring-(--v3-accent) hover:bg-(--v3-field-fill-hover)",
      )}
    >
      <label className="flex min-w-0 flex-1 items-center gap-2 pl-2">
        {chip ?? (color && <Swatch color={color} />)}
        <input
          defaultValue={hex}
          readOnly={disabled}
          aria-disabled={disabled || undefined}
          aria-label={withReason(`${aria} 颜色值`, why)}
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-[12px] leading-none tabular-nums outline-none"
        />
        {name && <span className={cn("shrink-0 pr-2 text-[12px] leading-none whitespace-nowrap", disabled ? "text-(--v3-text-3)" : "text-(--v3-text-2)")}>{name}</span>}
      </label>
      <span aria-hidden="true" className="h-(--v3-field-split-h) w-px bg-(--v3-field-split)" />
      <input
        defaultValue="100%"
        readOnly={disabled}
        aria-disabled={disabled || undefined}
        aria-label={withReason(`${aria} 不透明度`, why)}
        spellCheck={false}
        className="w-12 bg-transparent pr-2 text-right text-[12px] leading-none tabular-nums outline-none"
      />
    </div>
  )
  return why ? <Tip label={why}>{field}</Tip> : field
}

/** 位置与大小（所有对象共用的几何分区，./geometry.tsx）：示例第 2 页要点卡的当前值（pt） */
function ShapeGeometrySection({ readOnly }: InspectorCtx) {
  return <GeometrySection anchor="section-shape.geometry" readOnly={readOnly} value={{ x: CARD.x, y: CARD.y, w: CARD.w, h: CARD.h, rotate: CARD.rotate }} />
}

/* ------------------------------------------------------------------ 快速样式（DS-31，PRD ED-06「形状样式快速库」M2 P1） */

/**
 * 样式库是 7 列（主题色槽：文字 1、强调色 1–6）× 6 行（样式强度）共 42 格（前端 50/18 FMT-07，设计 04 §4.1a）。
 * 一格 = 一个 p:style 主题样式引用：写 slide.setShapeStyle、同事务清掉会遮住样式的显式填充 / 线条，换主题后跟着变（R-d-63）。
 * 样张按当前主题的色槽画出每种强度的示意（填充、线条、阴影与文字色），形状、缩略与画布上的要点卡读同一套颜色。
 */
export type QsRow = "outline" | "fill" | "light-outline" | "subtle" | "moderate" | "intense"
export const QS_ROWS: { id: QsRow; name: string }[] = [
  { id: "outline", name: "彩色轮廓" },
  { id: "fill", name: "彩色填充" },
  { id: "light-outline", name: "浅色轮廓，彩色填充" },
  { id: "subtle", name: "细微效果" },
  { id: "moderate", name: "中等效果" },
  { id: "intense", name: "强烈效果" },
]
/** 7 列对应的主题色槽序号（ThemeDef.slots：1 = 文字 1，4–9 = 强调色 1–6） */
const QS_SLOTS = [1, 4, 5, 6, 7, 8, 9]
const QS_COLS = QS_SLOTS.length
/** 样式 id：「行:列」，如 subtle:1 = 细微效果 · 强调色 1 */
export type QuickStyleId = `${QsRow}:${number}`
const qsId = (row: QsRow, col: number): QuickStyleId => `${row}:${col}`
const qsParse = (id: QuickStyleId) => {
  const [row, col] = id.split(":") as [QsRow, string]
  return { row, col: Number(col) }
}
/** 第 i 格（行优先）↔ 样式 id */
const qsAt = (i: number): QuickStyleId => qsId(QS_ROWS[Math.floor(i / QS_COLS)]!.id, i % QS_COLS)
const qsIndex = (id: QuickStyleId) => {
  const { row, col } = qsParse(id)
  return QS_ROWS.findIndex((r) => r.id === row) * QS_COLS + col
}
/** 样式名（读屏名、读数、只读行）：「细微效果 · 强调色 1」 */
export function quickStyleName(theme: ThemeDef, id: QuickStyleId): string {
  const { row, col } = qsParse(id)
  return `${QS_ROWS.find((r) => r.id === row)?.name ?? ""} · ${theme.slots[QS_SLOTS[col] ?? 4]?.label ?? ""}`
}

/** 示例第 2 页要点卡当前所用的样式：细微效果 · 强调色 1（浅品牌色底、深色文字，即示例文档里的原样） */
export const CARD_QUICK_STYLE: QuickStyleId = "subtle:1"
/** 新插入的形状（03-15）缺省是「彩色填充 · 强调色 1」：主题样式填充 + 深 25% 的同色线条 */
export const NEW_SHAPE_QUICK_STYLE: QuickStyleId = "fill:1"

const hexRgb = (h: string) => {
  const n = parseInt(h.replace("#", ""), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const
}
/** a 占 t、b 占 1 − t 的混合色 */
const mix = (a: string, b: string, t: number) => {
  const x = hexRgb(a)
  const y = hexRgb(b)
  return `#${x.map((v, i) => Math.round(v * t + y[i]! * (1 - t)).toString(16).padStart(2, "0")).join("")}`
}
const luma = (h: string) => {
  const [r, g, b] = hexRgb(h)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** 一种样式在某主题下的画法（文档内容的颜色）。unit 是线宽、阴影的长度单位：缩略图用 px，画布上的要点卡用 cqw。 */
interface QsLook {
  background: string
  /** 线条（inset 描边）与阴影，合成一个 box-shadow */
  shadow: string
  text: string
  sub: string
}
function quickStyleLook(theme: ThemeDef, id: QuickStyleId, unit: "px" | "cqw"): QsLook {
  const { row, col } = qsParse(id)
  const c = theme.slots[QS_SLOTS[col] ?? 4]?.hex ?? "#3A5CE6"
  const bg1 = theme.slots[0]?.hex ?? "#FFFFFF"
  const tx1 = theme.slots[1]?.hex ?? "#141B2D"
  // 彩色底上的字：背景 1 / 文字 1 里更亮的那个（深色主题的「背景 1」是深色）
  const light = luma(bg1) >= luma(tx1) ? bg1 : tx1
  const L = (v: number) => `${unit === "px" ? v : v / 4}${unit}`
  const line = (color: string) => `inset 0 0 0 ${L(1.5)} ${color}`
  const soft = `0 ${L(1)} ${L(2.5)} rgba(0,0,0,.28)`
  const strong = `0 ${L(1.5)} ${L(4)} rgba(0,0,0,.38)`
  switch (row) {
    case "outline":
      return { background: bg1, shadow: line(c), text: tx1, sub: mix(tx1, bg1, 0.72) }
    case "fill":
      return { background: c, shadow: line(mix("#000000", c, 0.25)), text: light, sub: mix(light, c, 0.8) }
    case "light-outline":
      return { background: c, shadow: `${line(light)}, ${soft}`, text: light, sub: mix(light, c, 0.8) }
    case "subtle":
      // 浅 80% 的同色底（PowerPoint「细微效果」的取法）；示例要点卡的原样是这一格（浅品牌色底、深色字）
      return { background: mix(c, bg1, 0.2), shadow: "none", text: tx1, sub: mix(tx1, bg1, 0.72) }
    case "moderate":
      return { background: `linear-gradient(180deg, ${mix("#FFFFFF", c, 0.28)}, ${c})`, shadow: soft, text: light, sub: mix(light, c, 0.82) }
    case "intense":
      return { background: `linear-gradient(180deg, ${c}, ${mix("#000000", c, 0.32)})`, shadow: `inset 0 ${L(1)} 0 rgba(255,255,255,.32), ${strong}`, text: light, sub: mix(light, c, 0.82) }
  }
}

/** 文档当前的主题（设计主题场景应用了别的主题时跟着变；与 masters-themes 的 useThemeState 同一份场景状态、同一个初值） */
function useDocTheme(): ThemeDef {
  const { data } = useEditor()
  const [id] = useSceneState<ThemeId>("masters.theme.current", (data.themeCurrent as ThemeId | undefined) ?? "office")
  return themeOf(id)
}

/** 要点卡（示例第 2 页的矩形）当前所用的快速样式：检查器、样式库与画布上的卡片读写同一份（初值 data.quickStyle，缺省细微效果 · 强调色 1） */
export const CARD_STYLE_KEY = "shape.quick-style"
function useCardQuickStyle() {
  const { data } = useEditor()
  return useSceneState<QuickStyleId | null>(CARD_STYLE_KEY, (data.quickStyle as QuickStyleId | undefined) ?? CARD_QUICK_STYLE)
}

/**
 * 编辑器最外层的一层（display: contents）：要点卡换了快速样式时，把画法写成 --qs-* 变量，左栏缩略图、网格与画布上的卡片（SlideArt 第 2 页）一起换样；
 * 用的还是示例文档原来的样式时什么也不写（卡片按 --s-note 等内容 token 画）。
 */
export function QuickStyleScope({ children }: { children: ReactNode }) {
  const [style] = useCardQuickStyle()
  const theme = useDocTheme()
  let vars: CSSProperties | undefined
  if (style && style !== CARD_QUICK_STYLE) {
    const look = quickStyleLook(theme, style, "cqw")
    vars = { "--qs-fill": look.background, "--qs-shadow": look.shadow, "--qs-text": look.text, "--qs-sub": look.sub } as CSSProperties
  }
  return (
    <div className="contents" style={vars}>
      {children}
    </div>
  )
}

/**
 * 一格的示意形状（文档内容，S-13 真实渲染）：铺满格子的圆角矩形，按样式填充、描边、阴影，中间「Ab」用样式的文字色
 * （与 PowerPoint 样式库的「Abc」同理，一眼看出彩色底上是浅色字还是深色字；纯西文，11px）。
 * 衬底与外圈走 --v3-qs-*（rulings §4.25 TB-56）：去掉「背景 1」白衬底（--v3-qs-matte 透明、--v3-qs-inset 0），外圈是色块内线 --v3-swatch-line
 * （暗色界面里不再出现一圈圈白框，与 ColorChip / 表格样式缩略同一写法；颜色仍按主题色槽真实渲染，DS-31 不变；「中等 / 强烈效果」的投影在缩略里看不出，样式库的大格里仍可辨）。
 */
function QuickStyleThumb({ theme, id, className }: { theme: ThemeDef; id: QuickStyleId; className?: string }) {
  const look = quickStyleLook(theme, id, "px")
  return (
    <span aria-hidden="true" className={cn("relative block overflow-hidden rounded-[4px]", className)} style={{ backgroundColor: `var(--v3-qs-matte, ${theme.slots[0]?.hex ?? "transparent"})` }}>
      <span
        className="absolute inset-(--v3-qs-inset) flex items-center justify-center rounded-(--v3-qs-radius) text-[11px] leading-none font-semibold"
        style={{ background: look.background, boxShadow: look.shadow, color: look.text }}
      >
        Ab
      </span>
      <span className="pointer-events-none absolute inset-0 rounded-[4px] shadow-[inset_0_0_0_1px_var(--v3-qs-line)]" />
    </span>
  )
}

/**
 * 样式库（DS-34：在「快速样式」节里、缩略行下方原位展开，下方各节下移，不遮挡画布）：7 列 × 6 行 42 格，listbox「形状样式」+ option（07 §1.2b）。
 * 格子按检查器内容宽度等分（7 列、间距 6，内容宽 248 时每格约 30 × 21），比例 10 : 7。
 * 整组一个 Tab 位：←/→ 逐格（行尾接下一行行首）、↑/↓ 跨行保持列位、Home / End 第一 / 最后一格；Enter / Space 或点按即应用（一个撤销步），
 * 样式库保持展开、焦点留在该格，便于连续比较；Esc 收起、焦点回到缩略行（节标题右侧的「收起」按钮同理）。
 * 读数行写悬停 / 聚焦那一格的样式名（aria-live），移出后回到当前样式名。autoFocus：用户点开时焦点落在当前样式（场景直接以展开态载入时不抢焦点）。
 */
function QuickStyleGallery({
  theme,
  value,
  onApply,
  onClose,
  hover: initialHover,
  autoFocus,
}: {
  theme: ThemeDef
  value: QuickStyleId | null
  onApply: (id: QuickStyleId) => void
  /** Esc：收起并把焦点交回缩略行 */
  onClose: () => void
  hover?: QuickStyleId
  autoFocus?: boolean
}) {
  const uid = useId()
  const cells = useRef<(HTMLDivElement | null)[]>([])
  const [hover, setHover] = useState<QuickStyleId | null>(initialHover ?? null)
  const stop = value ?? qsAt(0)
  const readout = hover ? quickStyleName(theme, hover) : value ? quickStyleName(theme, value) : "移入查看样式名"
  useEffect(() => {
    if (autoFocus) cells.current[qsIndex(stop)]?.focus({ preventScroll: true })
    // 只在展开时聚焦一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const move = (e: KeyboardEvent<HTMLDivElement>, i: number) => {
    const last = QS_ROWS.length * QS_COLS - 1
    let n = i
    if (e.key === "ArrowRight") n = Math.min(last, i + 1)
    else if (e.key === "ArrowLeft") n = Math.max(0, i - 1)
    else if (e.key === "ArrowDown") n = i + QS_COLS <= last ? i + QS_COLS : i
    else if (e.key === "ArrowUp") n = i - QS_COLS >= 0 ? i - QS_COLS : i
    else if (e.key === "Home") n = 0
    else if (e.key === "End") n = last
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      e.stopPropagation()
      onApply(qsAt(i))
      return
    } else if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      onClose()
      return
    } else return
    // 方向键不冒泡给编辑器（否则会微移画布上选中的形状）
    e.preventDefault()
    e.stopPropagation()
    cells.current[n]?.focus()
  }
  return (
    <div className="flex flex-col gap-2">
      <p id={`${uid}-r`} aria-live="polite" className="truncate text-[12px] leading-4 text-(--v3-text-2)">
        {readout}
      </p>
      <div role="listbox" aria-label="形状样式" aria-describedby={`${uid}-r`} className="grid grid-cols-7 gap-1.5" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: QS_ROWS.length * QS_COLS }, (_, i) => {
          const id = qsAt(i)
          const on = id === value
          return (
            <div
              key={id}
              ref={(el) => {
                cells.current[i] = el
              }}
              role="option"
              aria-selected={on}
              aria-label={quickStyleName(theme, id)}
              tabIndex={id === stop ? 0 : -1}
              onMouseEnter={() => setHover(id)}
              onFocus={() => setHover(id)}
              onClick={() => onApply(id)}
              onKeyDown={(e) => move(e, i)}
              className={cn(
                "aspect-[10/7] min-w-0 cursor-default rounded-[4px] outline-none transition-shadow",
                on
                  ? "ring-2 ring-(--v3-accent) ring-offset-2 ring-offset-(--v3-panel)"
                  : hover === id
                    ? "ring-1 ring-(--v3-hover-line) ring-offset-1 ring-offset-(--v3-panel)"
                    : "hover:ring-1 hover:ring-(--v3-hover-line) hover:ring-offset-1 hover:ring-offset-(--v3-panel)",
                "focus-visible:ring-2 focus-visible:ring-(--v3-accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--v3-panel)",
              )}
            >
              <QuickStyleThumb theme={theme} id={id} className="size-full" />
            </div>
          )
        })}
      </div>
      <p className="text-[12px] leading-4 text-(--v3-text-2)">
        取自主题<span className="whitespace-nowrap">「{theme.name}」</span>，换主题后跟着变
      </p>
    </div>
  )
}

export interface QuickStyleSectionProps extends InspectorCtx {
  /** 场景状态键：这个对象当前所用的样式（缺省是示例第 2 页的要点卡，与画布上的卡片同一份） */
  stateKey?: string
  /** 初值：null 为没有当前格（多选时样式不一致，或对象没有套用主题样式） */
  initial?: QuickStyleId | null
  /** 没有当前格时读屏名与只读行写什么（缺省「多个值」；单个对象没有套用主题样式时写「未套用样式」） */
  emptyLabel?: string
}

/**
 * 快速样式（形状检查器「填充」节上方，rulings §4.25 DS-31；03-02 §4.2、设计 04 §4.1a、07 §1.2b）：
 * 一行 6 个主题样式缩略（当前样式所在强度行；当前样式 2px 强调色外圈、隔 2px 面板底）+ ▾，整行是一个按钮（aria-haspopup=listbox、aria-expanded），
 * 点按或 Enter / Space / ↓ 展开 42 格样式库，焦点落在当前样式。DS-34（2026-10-08）：样式库在本节里、缩略行下方原位展开（不再是贴检查器左缘的弹层），
 * 下方各节下移、画布不被遮挡；节标题右侧出现「收起」按钮，收起按钮、再点缩略行或 Esc 收起，焦点回到缩略行；样式库不因点到别处而收起。
 * 只读（评审、只读角色、降权，DS-15）只写当前样式；disabled（打开中等）留在原位不可用并写原因。
 */
export function QuickStyleSection({ readOnly, disabled, data, stateKey = CARD_STYLE_KEY, initial, emptyLabel = "多个值" }: QuickStyleSectionProps) {
  const theme = useDocTheme()
  const init: QuickStyleId | null = initial !== undefined ? initial : ((data.quickStyle as QuickStyleId | undefined) ?? CARD_QUICK_STYLE)
  const [value, setValue] = useSceneState<QuickStyleId | null>(stateKey, init)
  const [open, setOpen] = useSceneState<boolean>(`${stateKey}.open`, !!data.quickStylesOpen && !readOnly && !disabled)
  const name = value ? quickStyleName(theme, value) : emptyLabel
  /** 缩略行（Esc / 收起后焦点回到这里） */
  const rowRef = useRef<HTMLButtonElement>(null)
  /** 这次展开是用户点开的：样式库挂载时把焦点交给当前样式（场景以展开态载入时为 false） */
  const focusOnOpen = useRef(false)
  /** 已展开时在缩略行上按 ↓：焦点进到样式库的当前样式 */
  const focusCurrentCell = () => {
    const sec = rowRef.current?.closest("section")
    sec?.querySelector<HTMLElement>('[role=listbox] [role=option][tabindex="0"]')?.focus()
  }
  if (readOnly)
    return (
      <Section title="快速样式" anchor="section-shape.style">
        <StaticRow label="样式" leading={value ? <QuickStyleThumb theme={theme} id={value} className="h-4 w-6" /> : undefined}>
          {name}
        </StaticRow>
      </Section>
    )
  // 缩略行：当前样式所在的强度行；6 格放得下文字 1 与强调色 1–5，当前是强调色 6 时整行右移一格
  const { row, col } = value ? qsParse(value) : { row: "subtle" as QsRow, col: -1 }
  const start = col >= 6 ? 1 : 0
  const strip = Array.from({ length: 6 }, (_, i) => qsId(row, start + i))
  const anchor = "quick-styles"
  const label = withReason(`快速样式：${name}`, disabled)
  const toggle = (next: boolean) => {
    focusOnOpen.current = next
    setOpen(next)
  }
  const collapse = () => {
    setOpen(false)
    rowRef.current?.focus()
  }
  const trigger = (
    <button
      ref={rowRef}
      type="button"
      data-v3-anchor={anchor}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={label}
      aria-disabled={disabled ? true : undefined}
      onClick={() => !disabled && toggle(!open)}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === "ArrowDown") {
          e.preventDefault()
          e.stopPropagation()
          if (open) focusCurrentCell()
          else toggle(true)
        } else if (e.key === "Escape" && open) {
          e.preventDefault()
          e.stopPropagation()
          setOpen(false)
        }
      }}
      className={cn(
        "group -mx-1 flex items-center gap-1.5 rounded-[6px] p-1 transition-colors",
        // 展开时不常亮底色带（它向两侧各外扩 4px、与字段列不齐）；展开态由下方样式库与节标题右侧「收起」表达，悬停反馈照旧
        disabled ? "cursor-default" : "hover:bg-(--v3-panel-2)",
      )}
    >
      <span className="flex flex-1 gap-1.5">
        {strip.map((id) => (
          <span
            key={id}
            className={cn(
              "flex h-6 w-8 shrink-0 rounded-[4px]",
              id === value && cn("ring-2 ring-offset-2", disabled ? "ring-(--v3-text-3)" : "ring-(--v3-accent)", "ring-offset-(--v3-panel) group-hover:ring-offset-(--v3-panel-2)"),
              disabled && "opacity-60",
            )}
          >
            <QuickStyleThumb theme={theme} id={id} className="size-full" />
          </span>
        ))}
      </span>
      {/* 展开后 ▾ 让位给节标题右侧的「收起」按钮（同一位置不并排两个 ▴），留同宽空位、缩略不移动 */}
      {open ? (
        <span aria-hidden="true" className="size-4 shrink-0" />
      ) : (
        <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" className={cn("shrink-0", disabled ? "text-(--v3-text-3)" : "text-(--v3-text-2)")} />
      )}
    </button>
  )
  return (
    <Section
      title="快速样式"
      anchor="section-shape.style"
      action={
        open && !disabled ? (
          <IconButton label="收起样式库" size={24} onClick={collapse}>
            <ChevronUp {...ICON} />
          </IconButton>
        ) : undefined
      }
    >
      {disabled ? <Tip label={reasonTip("快速样式", disabled)}>{trigger}</Tip> : <Tip label="全部样式" hidden={open}>{trigger}</Tip>}
      {open && !disabled && (
        <QuickStyleGallery
          theme={theme}
          value={value}
          onApply={setValue}
          onClose={collapse}
          hover={data.quickStyleHover as QuickStyleId | undefined}
          autoFocus={focusOnOpen.current}
        />
      )}
    </Section>
  )
}

/** 示例要点卡的快速样式（内置分区 shape.style） */
function ShapeStyleSection(ctx: InspectorCtx) {
  return <QuickStyleSection {...ctx} />
}

function ShapeFillSection({ readOnly }: InspectorCtx) {
  if (readOnly)
    return (
      <Section title="填充" anchor="section-shape.fill">
        <StaticRow leading={<Swatch color="note" />}>
          纯色 · <span className="tabular-nums">{CARD.fill}</span> · <span className="tabular-nums">{CARD.opacity}</span>
        </StaticRow>
      </Section>
    )
  return (
    <Section title="填充" anchor="section-shape.fill">
      <Segmented
        aria="填充类型"
        defaultValue="solid"
        options={[
          { value: "none", label: "无", icon: <FillNoneIcon /> },
          { value: "solid", label: "纯色", icon: <FillSolidIcon /> },
          { value: "gradient", label: "渐变", icon: <FillGradientIcon /> },
          // 图片填充按 PRD ED-06 为 P2：留在原位、标 P2、不可用（rulings §4.25 TB-43、§4.20 FE-06）
          { value: "image", label: "图片", icon: <ImageIcon {...ICON} />, tag: "P2", disabled: true, reason: "后续版本提供" },
        ]}
      />
      <ColorRow color="note" hex={CARD.fill} aria="填充" anchor="fill-color" />
    </Section>
  )
}

function ShapeStrokeSection({ readOnly }: InspectorCtx) {
  if (readOnly)
    return (
      <Section title="描边" anchor="section-shape.stroke">
        <StaticRow>无</StaticRow>
      </Section>
    )
  return (
    <Section title="描边" anchor="section-shape.stroke">
      <Segmented
        aria="描边样式"
        defaultValue="none"
        options={[
          { value: "none", label: "无", text: "无" },
          { value: "solid", label: "实线", text: "实线" },
          { value: "dashed", label: "虚线", text: "虚线" },
        ]}
      />
    </Section>
  )
}

function ShapeShadowSection({ readOnly }: InspectorCtx) {
  if (readOnly)
    return (
      <Section title="阴影" anchor="section-shape.shadow">
        <StaticRow>无</StaticRow>
      </Section>
    )
  return (
    <Section title="阴影" anchor="section-shape.shadow">
      <Segmented
        aria="阴影样式"
        defaultValue="none"
        options={[
          { value: "none", label: "无", text: "无" },
          { value: "outer", label: "外阴影", text: "外阴影" },
          // 内阴影按 PRD ED-06 为 P2（其它效果 P2）：留在原位、标 P2、不可用（TB-43）
          { value: "inner", label: "内阴影", text: "内阴影", tag: "P2", disabled: true, reason: "后续版本提供" },
        ]}
      />
    </Section>
  )
}

/**
 * 不透明度：滑块 + 数值（与图片、视频同一画法）。OOXML 形状没有整体不透明度：这里同时写填充与描边颜色的 alpha，
 * 一步撤销（slide.setShapeOpacity{shapeIds; alpha}，rulings §4.25 TB-47）。
 */
function ShapeOpacitySection({ readOnly }: InspectorCtx) {
  if (readOnly)
    return (
      <Section title="不透明度" anchor="section-shape.opacity">
        <StaticRow>
          <span className="tabular-nums">{CARD.opacity}</span>
        </StaticRow>
      </Section>
    )
  return (
    <Section title="不透明度" anchor="section-shape.opacity">
      <SliderField aria="不透明度" defaultValue={100} />
    </Section>
  )
}

/**
 * 「操作」：单击时的动作（03-15「操作设置 · 触发」：普通形状也可设置，与右键「操作设置…」同一对话框）。
 * 当前值从 data.shapeAction 读（缺省「无动作」）；点开的对话框由形状库场景登记（shape:action）。只读时只写当前值。
 */
export function ShapeActionSection({ readOnly, disabled, data }: InspectorCtx) {
  const value = typeof data.shapeAction === "string" ? data.shapeAction : "无动作"
  const [n, setN] = useState(0)
  const Dialog = getToolLayer("shape:action")
  if (readOnly)
    return (
      <Section title="操作" anchor="section-shape.action">
        <StaticRow label="单击时">{value}</StaticRow>
      </Section>
    )
  return (
    <Section title="操作" anchor="section-shape.action">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-disabled={disabled ? true : undefined}
        aria-label={withReason(`单击时：${value}`, disabled)}
        onClick={() => !disabled && setN((x) => x + 1)}
        className={cn(
          SELECT_FRAME,
          "flex h-7 w-full items-center gap-2 px-2 text-left text-[12px] leading-none transition-colors",
          disabled ? "cursor-default text-(--v3-text-3) ring-(--v3-select-line-off)" : "hover:bg-(--v3-select-fill-hover)",
        )}
      >
        <span className={cn("shrink-0", disabled ? "text-(--v3-text-3)" : "text-(--v3-text-2)")}>单击时</span>
        <span className={cn("min-w-0 flex-1 truncate", !disabled && "text-(--v3-text)")}>{value}</span>
        <ChevronRight size={12} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />
      </button>
      {Dialog && n > 0 && <Dialog key={n} open onOpenChange={() => undefined} />}
    </Section>
  )
}

/* ------------------------------------------------------------------ 注册 */

inspectorPanel({ kind: "none", title: ({ slide }) => <>幻灯片 {slide.n}</> })
inspectorPanel({ kind: "shape", title: "矩形" })
inspectorPanel({ kind: "text", title: "文本" })

inspectorSections([
  { id: "slide.layout", kinds: ["none"], order: 10, component: SlideLayoutSection },
  { id: "slide.theme", kinds: ["none"], order: 20, component: SlideThemeSection },
  { id: "slide.background", kinds: ["none"], order: 30, component: SlideBackgroundSection },
  { id: "slide.playback", kinds: ["none"], order: 40, component: SlidePlaybackSection },

  { id: "shape.align", kinds: ["shape"], order: 0, placement: "top", component: AlignRow },
  { id: "shape.geometry", kinds: ["shape"], order: 10, component: ShapeGeometrySection },
  { id: "shape.style", kinds: ["shape"], order: 20, component: ShapeStyleSection },
  { id: "shape.fill", kinds: ["shape"], order: 30, component: ShapeFillSection },
  { id: "shape.stroke", kinds: ["shape"], order: 40, component: ShapeStrokeSection },
  { id: "shape.shadow", kinds: ["shape"], order: 50, component: ShapeShadowSection },
  { id: "shape.opacity", kinds: ["shape"], order: 60, component: ShapeOpacitySection },
  { id: "shape.action", kinds: ["shape"], order: 70, component: ShapeActionSection },

  { id: "text.font", kinds: ["text"], order: 10, component: TextFontSection },
  { id: "text.paragraph", kinds: ["text"], order: 20, component: TextParagraphSection },
  { id: "text.color", kinds: ["text"], order: 30, component: TextColorSection },
  { id: "text.list", kinds: ["text"], order: 40, component: TextListSection },
  { id: "text.box", kinds: ["text"], order: 50, component: TextBoxSection },
])
