import { useState, type ReactNode } from "react"
import {
  AArrowDown, AArrowUp, AlignCenter, AlignJustify, AlignLeft, AlignRight, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart,
  Baseline, Bold, ChevronDown, Highlighter, IndentDecrease, IndentIncrease, Italic, List, ListOrdered, Lock, RemoveFormatting, Strikethrough,
  Subscript, Superscript, Underline,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CheckRow, ColorChip, NumberField, Tag } from "../../kit/controls"
import { Cols, FIELD_FRAME, hasCjk, ICON, IconButton, Section, Segmented, SEG_TRACK_FRAME, SELECT_FRAME, SelectTrigger, Tip, ToggleStrip, V3Menu } from "../../ui"
import { StaticRow } from "./parts"
import type { InspectorCtx } from "./registry"

/**
 * 内置「文本」选中态的五个分区（03-16 定稿，所有场景共用）：字体 · 段落 · 颜色 · 列表 · 文本框。
 *   分区 id 与 order：text.font 10 · text.paragraph 20 · text.color 30 · text.list 40 · text.box 50
 *   锚点：section-text.<分区>，控件 font-latin、font-ea、text-color、text-highlight、list-bullets、list-numbering
 * 值从 InspectorCtx.data.text（Partial<TextData>）读，缺省是示例第 1 页标题（TEXT_TITLE）；场景用 data: { text: { ...TEXT_BODY_L2, … } } 换成别的段落。
 * - 西文、中文字体分开设置（东亚字体独立）；主题字体在值后标「标题 / 正文」；受限内嵌字体显示原字体名 + 锁形并说明替代字体（03-13）。
 * - 不一致的值显示「多个值」（UX-10），是可读信息，用 text-2（DS-9：text-3 只给占位与不可用）。
 * - 只读（评审 / 浏览，DS-15）：每节只列属性与当前值（StaticRow），不画不可用的控件；权限说明由编辑器放在面板顶部。
 * - 文字迷你工具条已去掉（DS-13）：文字格式只在这里，粗体、斜体等保留快捷键。
 */

const labelCls = (s: string) => (hasCjk(s) ? "text-[12px]" : "text-[11px]")

/* ------------------------------------------------------------------ 数据 */

export interface TextData {
  latin: string
  ea: string
  /** 用的是主题字体时标出槽位：「正文」「标题」 */
  latinHint?: string
  eaHint?: string
  /** 字体名为「多个值」 */
  latinMixed?: boolean
  eaMixed?: boolean
  /** 受限内嵌字体（03-13）：中文字体显示原字体名 + 锁形，下方说明编辑时的替代字体 */
  restricted?: { font: string; fallback: string }
  /** 字号（pt）；null 为「多个值」 */
  size: string | null
  styles: string[]
  script: string[]
  caseMode: string
  align: "left" | "center" | "right" | "justify" | "distributed"
  lineSpacing: string
  before: string
  after: string
  /** 文字颜色；null 为「多个值」 */
  color: { hex: string } | null
  /** 高亮；null 为无 */
  highlight: string | null
  bullet: string
  numbering: string
  /** 列表级别（1–9）；0 = 不是列表段落 */
  level: number
  anchor: "top" | "middle" | "bottom"
  wrap: boolean
  autofit: string
  /** 自动缩小的结果说明，如「已缩小至 92%」 */
  autofitNote?: ReactNode
  /** 正在打开的弹层：对应字段画成按下态（kit 锚定浮层另会给锚点加 data-v3-open，两者外观相同） */
  open?: "font-ea" | "color" | "bullets" | "numbering"
}

/** 示例第 1 页标题「2026 年 Q2 业绩汇报」（版式「标题幻灯片」的标题占位符，主题标题字体、40 pt 粗体）：内置 text 选中态的缺省值 */
export const TEXT_TITLE: TextData = {
  latin: "Inter",
  ea: "思源黑体",
  latinHint: "标题",
  eaHint: "标题",
  size: "40",
  styles: ["bold"],
  script: [],
  caseMode: "无",
  align: "left",
  lineSpacing: "1.2",
  before: "0",
  after: "0",
  color: { hex: "#141B2D" },
  highlight: null,
  bullet: "无",
  numbering: "无",
  level: 0,
  anchor: "bottom",
  wrap: true,
  autofit: "溢出时缩小文字",
}

/** 正文第 2 级（「上线自动化交付流程」）：主题正文字体、20 pt、空心圆点 */
export const TEXT_BODY_L2: TextData = {
  latin: "Inter",
  ea: "思源黑体",
  latinHint: "正文",
  eaHint: "正文",
  size: "20",
  styles: [],
  script: [],
  caseMode: "无",
  align: "left",
  lineSpacing: "1.2",
  before: "0",
  after: "6",
  color: { hex: "#4B566B" },
  highlight: null,
  bullet: "空心圆点",
  numbering: "无",
  level: 2,
  anchor: "top",
  wrap: true,
  autofit: "溢出时缩小文字",
}

/** 正文第 1 级（加粗、24 pt、深墨、实心圆点） */
export const TEXT_BODY_L1: TextData = { ...TEXT_BODY_L2, size: "24", styles: ["bold"], color: { hex: "#141B2D" }, bullet: "实心圆点", level: 1 }

/** 新建文本框的缺省样式（粘贴纯文本、工具条「文本」单击）：正文字体 18 pt 常规、不是列表、根据文字调整形状大小 */
export const TEXT_NEW_BOX: TextData = {
  ...TEXT_BODY_L2,
  size: "18",
  color: { hex: "#141B2D" },
  bullet: "无",
  level: 0,
  after: "0",
  autofit: "根据文字调整形状大小",
}

export const textOf = (ctx: InspectorCtx): TextData => ({ ...TEXT_TITLE, ...(ctx.data.text as Partial<TextData> | undefined) })

const EA_FONTS = ["思源黑体", "思源宋体", "苹方", "微软雅黑", "阿里巴巴普惠体", "宋体", "黑体", "楷体"]
const LATIN_FONTS = ["Inter", "Arial", "Helvetica Neue", "Georgia", "Roboto"]
const SIZES = ["8", "9", "10", "10.5", "11", "12", "14", "16", "18", "20", "24", "28", "32", "36", "40", "44", "48", "54", "60", "72", "80", "96"]

/** 项目符号的字符（检查器的当前值小样与项目符号菜单共用） */
export const BULLET_GLYPH: Record<string, string> = {
  实心圆点: "●",
  空心圆点: "○",
  实心方块: "■",
  空心方块: "□",
  菱形: "◆",
  箭头: "➢",
  对勾: "✓",
}

const ALIGN_NAME: Record<TextData["align"], string> = { left: "左对齐", center: "居中", right: "右对齐", justify: "两端对齐", distributed: "分散对齐" }
const ANCHOR_NAME: Record<TextData["anchor"], string> = { top: "顶端对齐", middle: "垂直居中", bottom: "底端对齐" }
const STYLE_NAME: Record<string, string> = { bold: "粗体", italic: "斜体", underline: "下划线", strike: "删除线" }
const SCRIPT_NAME: Record<string, string> = { sup: "上标", sub: "下标" }

/* ------------------------------------------------------------------ 通用小件 */

/** 分散对齐图标（lucide 没有）：四条等长线，末行两端带箭头，16px / 描边 1.5，与 lucide 同一画法。 */
export function AlignDistributedIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 5h18M3 10h18M3 15h18" />
      <path d="M3 20h18M6 17.5 3 20l3 2.5M18 17.5l3 2.5-3 2.5" />
    </svg>
  )
}

/** 下拉字段：框内左侧灰色标签 + 当前值 + ▾（同 Field 的框内标签写法）；items 为空时只是触发器（锚定的菜单 / 弹层由场景打开）。 */
function LabeledMenu({
  label,
  value,
  items = [],
  aria,
  anchor,
  pressed,
  mixed,
  leading,
  trailing,
  className,
}: {
  label?: string
  value: string
  items?: string[]
  aria: string
  anchor?: string
  /** 锚在它上面的弹层正开着：画成按下态 */
  pressed?: boolean
  mixed?: boolean
  leading?: ReactNode
  trailing?: ReactNode
  className?: string
}) {
  const [v, setV] = useState(value)
  const trigger = (
    <SelectTrigger aria-label={`${aria}：${mixed ? "多个值" : v}`} data-v3-anchor={anchor} {...(pressed ? { "data-state": "open" } : {})} className={className}>
      {label && <span className={cn("shrink-0 leading-none text-(--v3-text-2)", labelCls(label))}>{label}</span>}
      {leading}
      <span className={cn("min-w-0 flex-1 truncate", mixed ? "text-(--v3-text-2)" : "text-(--v3-text)")}>{mixed ? "多个值" : v}</span>
      {trailing}
    </SelectTrigger>
  )
  if (!items.length) return trigger
  return <V3Menu value={v} onValueChange={setV} entries={items.map((x) => ({ value: x, label: x }))} trigger={trigger} />
}

/** 不可用的下拉（里程碑未到）：禁用而不隐藏，文字退到 text-3、边界退到 --v3-select-line-off（同 SelectTrigger 的不可用态），可聚焦，悬停 / 聚焦给原因。 */
function DisabledMenu({ label, value, reason, tag }: { label: string; value: string; reason: string; tag: string }) {
  return (
    <Tip label={reason}>
      <button
        type="button"
        aria-disabled="true"
        aria-label={`${label}：${value}（${reason}）`}
        className={cn(SELECT_FRAME, "flex h-7 w-full min-w-0 cursor-default items-center gap-2 px-2 text-left text-[12px] leading-none text-(--v3-text-3) ring-(--v3-select-line-off)")}
      >
        <span className="shrink-0">{label}</span>
        <span className="min-w-0 truncate">{value}</span>
        <Tag className="ml-auto">{tag}</Tag>
        <ChevronDown {...ICON} className="shrink-0" />
      </button>
    </Tip>
  )
}

/** 动作按钮组（A⁺ A⁻、缩进）：与 ToggleStrip 同一个槽，但按钮是一次性动作，没有按下态。 */
function ActionStrip({ aria, items }: { aria: string; items: { label: string; kbd?: string; icon: ReactNode }[] }) {
  return (
    <div role="group" aria-label={aria} className={cn("flex h-7 gap-0.5", SEG_TRACK_FRAME)}>
      {items.map((o) => (
        <Tip key={o.label} label={o.label} kbd={o.kbd}>
          <button
            type="button"
            aria-label={o.label}
            className="flex h-6 min-w-0 flex-1 items-center justify-center rounded-[3px] text-(--v3-text-2) transition-colors hover:bg-(--v3-panel-3) hover:text-(--v3-text)"
          >
            {o.icon}
          </button>
        </Tip>
      ))}
    </div>
  )
}

/** 「无」色块：灰色斜线（不用危险色，Q3）。 */
function NoneChip() {
  return (
    <span aria-hidden="true" className="relative inline-block size-4 shrink-0 overflow-hidden rounded-[3px] shadow-[inset_0_0_0_1px_var(--v3-swatch-line)]">
      <span className="absolute top-[-3px] left-1/2 h-[22px] w-px rotate-45 bg-(--v3-text-3)" />
    </span>
  )
}

/** 颜色触发器：图标 + 色块 + 色值，一个 28px 字段（点开颜色弹层）。 */
function ColorTrigger({ label, icon, color, text, anchor, pressed, mixed }: { label: string; icon: ReactNode; color: string | null; text: string; anchor?: string; pressed?: boolean; mixed?: boolean }) {
  return (
    <Tip label={label}>
      <button
        type="button"
        aria-label={`${label}：${mixed ? "多个值" : text}`}
        aria-haspopup="dialog"
        aria-expanded={pressed || undefined}
        data-v3-anchor={anchor}
        className={cn(
          SELECT_FRAME,
          "flex h-7 min-w-0 items-center gap-2 px-2 text-left text-[12px] leading-none transition-colors hover:bg-(--v3-select-fill-hover) data-[v3-open]:bg-(--v3-select-fill-hover)",
          pressed && "bg-(--v3-select-fill-hover)",
        )}
      >
        <span className="flex shrink-0 text-(--v3-text-2)">{icon}</span>
        {mixed ? <ColorChip /> : color ? <ColorChip color={color} /> : <NoneChip />}
        <span className={cn("min-w-0 truncate tabular-nums", mixed || !color ? "text-(--v3-text-2)" : "text-(--v3-text)")}>{mixed ? "多个值" : text}</span>
      </button>
    </Tip>
  )
}

/** 主题字体的槽位说明（标题 / 正文），跟在字体名后、靠右 */
function FontHint({ children }: { children: string }) {
  return <span className="shrink-0 text-[12px] leading-none text-(--v3-text-2)">{children}</span>
}

/** 字体的只读写法：「Inter（标题）」 */
const fontText = (name: string, hint?: string, mixed?: boolean) => (mixed ? "多个值" : hint ? `${name}（${hint}）` : name)

/* ------------------------------------------------------------------ 字体 */

/** 字号：直接输入 + ▾ 常用刻度（8–96 pt）；多个值时留空、显示「多个值」（可读信息，text-2） */
function SizeField({ value }: { value: string | null }) {
  const [v, setV] = useState(value ?? "")
  return (
    <div className={cn(FIELD_FRAME, "flex h-7 min-w-0 items-center transition-colors focus-within:ring-(--v3-accent) hover:bg-(--v3-field-fill-hover)")}>
      <label className="flex min-w-0 flex-1 items-center gap-2 pl-2">
        <span className="shrink-0 text-[12px] leading-none text-(--v3-text-2)">字号</span>
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder={value === null ? "多个值" : undefined}
          aria-label="字号（pt）"
          inputMode="decimal"
          spellCheck={false}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-[12px] leading-none text-(--v3-text) tabular-nums outline-none",
            value === null ? "placeholder:text-(--v3-text-2)" : "placeholder:text-(--v3-text-3)",
          )}
        />
      </label>
      <V3Menu
        value={SIZES.includes(v) ? v : ""}
        onValueChange={setV}
        align="end"
        entries={SIZES.map((x) => ({ value: x, label: x }))}
        trigger={
          // ▾ 左侧的 1px 面板色切口（--v3-field-split-edge，同 Figma「96 | ▾」），一眼看出是「输入 + 菜单」
          <button type="button" aria-label="常用字号" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] text-(--v3-text-2) shadow-[inset_1px_0_0_var(--v3-field-split-edge)] hover:text-(--v3-text)">
            <ChevronDown {...ICON} />
          </button>
        }
      />
    </div>
  )
}

export function TextFontSection(ctx: InspectorCtx) {
  const t = textOf(ctx)
  if (ctx.readOnly)
    return (
      <Section title="字体" anchor="section-text.font" bodyClassName="gap-0">
        <StaticRow label="西文">{fontText(t.latin, t.latinHint, t.latinMixed)}</StaticRow>
        <StaticRow label="中文">
          {t.restricted ? (
            <>
              {t.restricted.font}
              <span className="text-(--v3-text-2)">（仅授权查看）</span>
            </>
          ) : (
            fontText(t.ea, t.eaHint, t.eaMixed)
          )}
        </StaticRow>
        <StaticRow label="字号">
          <span className="tabular-nums">{t.size === null ? "多个值" : `${t.size} pt`}</span>
        </StaticRow>
        <StaticRow label="字形">{t.styles.length ? t.styles.map((s) => STYLE_NAME[s] ?? s).join("、") : "常规"}</StaticRow>
        <StaticRow label="上下标">{t.script.length ? t.script.map((s) => SCRIPT_NAME[s] ?? s).join("、") : "无"}</StaticRow>
        <StaticRow label="大小写">{t.caseMode}</StaticRow>
      </Section>
    )
  return (
    <Section
      title="字体"
      anchor="section-text.font"
      action={
        <IconButton label="清除格式" tip="清除格式（只清除这里的显式设置，母版与版式的格式不变）" size={24}>
          <RemoveFormatting {...ICON} />
        </IconButton>
      }
    >
      {/* 西文、中文字体分开设置（东亚字体独立，03-16）；主题字体在值后标「标题 / 正文」 */}
      <LabeledMenu label="西文" value={t.latin} mixed={t.latinMixed} items={LATIN_FONTS} aria="西文字体" anchor="font-latin" trailing={t.latinHint ? <FontHint>{t.latinHint}</FontHint> : undefined} />
      <LabeledMenu
        label="中文"
        value={t.restricted ? t.restricted.font : t.ea}
        mixed={t.eaMixed}
        items={t.restricted ? [] : EA_FONTS}
        aria="中文字体"
        anchor="font-ea"
        pressed={t.open === "font-ea"}
        trailing={t.restricted ? <Lock {...ICON} aria-label="仅授权查看" className="shrink-0 text-(--v3-text-2)" /> : t.eaHint ? <FontHint>{t.eaHint}</FontHint> : undefined}
      />
      {t.restricted && (
        <p className="text-[12px] leading-[18px] text-(--v3-text-2)">
          编辑时以<span className="whitespace-nowrap">「{t.restricted.fallback}」</span>显示，<span className="whitespace-nowrap">查看和放映时仍用原字体</span>
        </p>
      )}
      <Cols>
        <SizeField value={t.size} />
        <ActionStrip
          aria="字号增减"
          items={[
            { label: "增大字号", kbd: "⇧⌘>", icon: <AArrowUp {...ICON} /> },
            { label: "减小字号", kbd: "⇧⌘<", icon: <AArrowDown {...ICON} /> },
          ]}
        />
      </Cols>
      <ToggleStrip
        aria="字形"
        defaultOn={t.styles}
        options={[
          { value: "bold", label: "粗体", kbd: "⌘B", icon: <Bold {...ICON} /> },
          { value: "italic", label: "斜体", kbd: "⌘I", icon: <Italic {...ICON} /> },
          { value: "underline", label: "下划线", kbd: "⌘U", icon: <Underline {...ICON} /> },
          { value: "strike", label: "删除线", kbd: "⇧⌘X", icon: <Strikethrough {...ICON} /> },
        ]}
      />
      <Cols>
        <ToggleStrip
          aria="上标与下标"
          defaultOn={t.script}
          options={[
            { value: "sup", label: "上标", kbd: "⇧⌘=", icon: <Superscript {...ICON} /> },
            { value: "sub", label: "下标", kbd: "⌘=", icon: <Subscript {...ICON} /> },
          ]}
        />
        <LabeledMenu label="大小写" value={t.caseMode} items={["无", "全部大写", "小型大写", "句首大写"]} aria="大小写" />
      </Cols>
    </Section>
  )
}

/* ------------------------------------------------------------------ 段落 */

export function TextParagraphSection(ctx: InspectorCtx) {
  const t = textOf(ctx)
  if (ctx.readOnly)
    return (
      <Section title="段落" anchor="section-text.paragraph" bodyClassName="gap-0">
        <StaticRow label="对齐">{ALIGN_NAME[t.align]}</StaticRow>
        <StaticRow label="行距">
          <span className="tabular-nums">{t.lineSpacing}</span> 倍
        </StaticRow>
        <Cols className="gap-y-0">
          <StaticRow label="段前">
            <span className="tabular-nums">{t.before} pt</span>
          </StaticRow>
          <StaticRow label="段后">
            <span className="tabular-nums">{t.after} pt</span>
          </StaticRow>
        </Cols>
      </Section>
    )
  return (
    <Section title="段落" anchor="section-text.paragraph">
      <Segmented
        aria="对齐"
        defaultValue={t.align}
        options={[
          { value: "left", label: "左对齐", icon: <AlignLeft {...ICON} /> },
          { value: "center", label: "居中", icon: <AlignCenter {...ICON} /> },
          { value: "right", label: "右对齐", icon: <AlignRight {...ICON} /> },
          { value: "justify", label: "两端对齐", icon: <AlignJustify {...ICON} /> },
          { value: "distributed", label: "分散对齐", icon: <AlignDistributedIcon /> },
        ]}
      />
      <Cols>
        <LabeledMenu label="行距" value={t.lineSpacing} items={["1.0", "1.15", "1.2", "1.5", "2.0", "自定义…"]} aria="行距（倍）" />
        <ActionStrip
          aria="缩进"
          items={[
            { label: "减少缩进", kbd: "⇧Tab", icon: <IndentDecrease {...ICON} /> },
            { label: "增加缩进", kbd: "Tab", icon: <IndentIncrease {...ICON} /> },
          ]}
        />
      </Cols>
      {/* 段前、段后与字号、固定行距一样始终用 pt，不随度量单位换算（同 PowerPoint，rulings §4.25 TB-33）：这里写死 pt，不读 LENGTH_UNIT */}
      <Cols>
        <NumberField label="段前" defaultValue={t.before} unit="pt" aria="段前间距" />
        <NumberField label="段后" defaultValue={t.after} unit="pt" aria="段后间距" />
      </Cols>
    </Section>
  )
}

/* ------------------------------------------------------------------ 颜色 */

export function TextColorSection(ctx: InspectorCtx) {
  const t = textOf(ctx)
  if (ctx.readOnly)
    return (
      <Section title="颜色" anchor="section-text.color" bodyClassName="gap-0">
        <StaticRow label="文字" leading={t.color ? <ColorChip color={t.color.hex} /> : <ColorChip />}>
          <span className="tabular-nums">{t.color ? t.color.hex : "多个值"}</span>
        </StaticRow>
        <StaticRow label="高亮" leading={t.highlight ? <ColorChip color={t.highlight} /> : <NoneChip />}>
          <span className="tabular-nums">{t.highlight ?? "无"}</span>
        </StaticRow>
      </Section>
    )
  return (
    <Section title="颜色" anchor="section-text.color">
      <Cols>
        <ColorTrigger label="文字颜色" icon={<Baseline {...ICON} />} color={t.color?.hex ?? null} text={t.color?.hex ?? ""} mixed={t.color === null} anchor="text-color" pressed={t.open === "color"} />
        <ColorTrigger label="高亮" icon={<Highlighter {...ICON} />} color={t.highlight} text={t.highlight ?? "无"} anchor="text-highlight" />
      </Cols>
    </Section>
  )
}

/* ------------------------------------------------------------------ 列表 */

/** 项目符号 / 编号的当前值前的小样：圆点、方块或「1.」 */
function ListGlyph({ kind, value }: { kind: "bullet" | "number"; value: string }) {
  if (value === "无" || value === "多个值") return kind === "bullet" ? <List {...ICON} className="shrink-0 text-(--v3-text-2)" /> : <ListOrdered {...ICON} className="shrink-0 text-(--v3-text-2)" />
  return <span className="w-4 shrink-0 text-center text-[12px] leading-none text-(--v3-text-2)">{BULLET_GLYPH[value] ?? value.split(" ")[0]}</span>
}

export function TextListSection(ctx: InspectorCtx) {
  const t = textOf(ctx)
  // 级别只对列表段落有意义（Tab / ⇧Tab 升降级，1–9 级）；非列表段落与多选时不显示
  const level = t.level > 0 ? <span className="mr-1.5 text-[12px] leading-none text-(--v3-text-2)">第 {t.level} 级</span> : undefined
  if (ctx.readOnly)
    return (
      <Section title="列表" anchor="section-text.list" bodyClassName="gap-0" action={level}>
        <StaticRow label="项目符号">{t.bullet}</StaticRow>
        <StaticRow label="编号">{t.numbering}</StaticRow>
      </Section>
    )
  return (
    <Section title="列表" anchor="section-text.list" action={level}>
      <Cols>
        <LabeledMenu value={t.bullet} mixed={t.bullet === "多个值"} aria="项目符号" anchor="list-bullets" pressed={t.open === "bullets"} leading={<ListGlyph kind="bullet" value={t.bullet} />} />
        <LabeledMenu value={t.numbering} mixed={t.numbering === "多个值"} aria="编号" anchor="list-numbering" pressed={t.open === "numbering"} leading={<ListGlyph kind="number" value={t.numbering} />} />
      </Cols>
    </Section>
  )
}

/* ------------------------------------------------------------------ 文本框 */

export function TextBoxSection(ctx: InspectorCtx) {
  const t = textOf(ctx)
  if (ctx.readOnly)
    return (
      <Section title="文本框" anchor="section-text.box" bodyClassName="gap-0">
        <StaticRow label="垂直对齐">{ANCHOR_NAME[t.anchor]}</StaticRow>
        <StaticRow label="自动换行">{t.wrap ? "开" : "关"}</StaticRow>
        <StaticRow label="自动调整">{t.autofit}</StaticRow>
        <StaticRow label="文字方向">横排</StaticRow>
      </Section>
    )
  return (
    <Section title="文本框" anchor="section-text.box">
      <Cols>
        <Segmented
          aria="垂直对齐"
          defaultValue={t.anchor}
          options={[
            { value: "top", label: "顶端对齐", icon: <AlignVerticalJustifyStart {...ICON} /> },
            { value: "middle", label: "垂直居中", icon: <AlignVerticalJustifyCenter {...ICON} /> },
            { value: "bottom", label: "底端对齐", icon: <AlignVerticalJustifyEnd {...ICON} /> },
          ]}
        />
        <CheckRow label="自动换行" defaultChecked={t.wrap} />
      </Cols>
      <LabeledMenu label="自动调整" value={t.autofit} items={["不自动调整", "溢出时缩小文字", "根据文字调整形状大小"]} aria="自动调整" />
      {t.autofitNote && <p className="text-[12px] leading-[18px] text-(--v3-text-2)">{t.autofitNote}</p>}
      <DisabledMenu label="文字方向" value="横排" reason="文字方向在 P2 提供" tag="P2" />
    </Section>
  )
}
