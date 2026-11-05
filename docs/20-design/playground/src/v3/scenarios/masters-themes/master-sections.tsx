import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ChevronRight, Image as ImageIcon, List, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  BackgroundControl, Button, Checkbox, CheckRow, ColorChip, ColorRow, Cols, FoldSection, GeometrySection, ICON, InspectorNotice, inspectorPanel, inspectorSections, Menu, MenuField, NumberField, ptOf,
  QuickStyleSection, Section, Segmented, SelectTrigger, StaticRow, TextField, Tip, useEditor, withReason, type InspectorCtx, type InspectorSectionDef, type MenuSpec,
} from "../../kit"
import { FillGradientIcon, FillNoneIcon, FillSolidIcon } from "../../shape-icons"
import { FONTS, themeOf } from "./data"
import { familyOf, findLayout, findMaster, KIND, movedBox, renameErrorOf, textStyleOf, typeNameOf, usageText, useMasterView, type MasterView, type MvData } from "./mv-state"
import { ART_FILL_TOKEN, placeholdersFor, type ArtTone, type PhDef } from "./LayoutArt"
import { ThemeControl } from "./ThemeParts"

/**
 * 母版视图的检查器分区（ui.inspectorSection；2026-10-30 母版视图改版第二步，规格 §3.4；dir §2.4、线框 L565–583）。种类与节序：
 *   layout   〔名称 · 使用此版式（其下「在普通视图查看 ›」）· 所属母版〕→ 占位符（标题、页脚）→ 主题（节标题右侧「随母版」）→ 背景（多「跟随母版」）
 *   master   〔名称 · 版式 N 个 · 使用此母版 · 保留母版〕→ 占位符（五项两列）→ 主题 → 背景
 *   master-view-placeholder / master-view-inherited   占位符（M3 可改类型、方向、大小）→ 位置与大小 → 文本样式（大纲级别）→ 填充与描边（继承项没有）
 *   master-view-multi   所选版式 → 背景 → 一节说明
 * 第一节（名称那一节）不写节标题（面板标题已写类型，§3.4.2）；顶行与面板标题由 MasterChrome.tsx MasterInspectorBody 画。
 * 不可编辑：会话内降权（InspectorCtx.readOnly）按 DS-15 只读展示当前值（StaticRow，不画禁用控件）；M2 与版式范围下的继承项字段留在原位、不可用，
 * 原因一律取 mvReasonOf(v, "field")（加载 > 降权 > M2 > 继承，规格 §3.10 第 12 条）。字号、颜色等取画布实际的画法（textStyleOf，Q8），不写死。
 */

/* ------------------------------------------------------------------ 检查器顶行（规格 §3.4.1） */

/**
 * 字符串里「」引起来的名称整段不断行（README §7 Q7 的约定）；传进来的已是节点时原样用。
 * 名称做成行内块、最宽一整行：放得下就整段在一行里（当前行剩下的地方不够时整段换到下一行），比一整行还长的名称（最长 64 字）才在名称里换行——
 * 只用不换行的话，窄检查器（240）里的长名会伸出内容区（core 先落自测时发现）
 */
export function keepQuoted(text: ReactNode): ReactNode {
  if (typeof text !== "string") return text
  const parts = text.split(/(「[^」]*」)/)
  if (parts.length === 1) return text
  return parts.map((s, i) =>
    s.startsWith("「") && s.endsWith("」") ? (
      <span key={i} className="inline-block max-w-full">
        {s}
      </span>
    ) : (
      s
    ),
  )
}

/**
 * 长句按词组换行（Q7：不断在词中间，同 kit Phrases 的用意）：每一段做成行内块、最宽一整行——放得下就整段在一行，段与段之间才断开；
 * 比一整行还长的段（带长名称时）才在段里换行，不伸出所在区域（kit Phrases 的不换行写法遇到 64 字的名称会伸出去）。确认框正文、检查器的说明行用它
 */
export function phrases(parts: string[]): ReactNode {
  return parts.map((p, i) => (
    <span key={i} className="inline-block max-w-full">
      {p}
    </span>
  ))
}

export interface TopReasonAction {
  label: string
  onClick: () => void
  /** 留在原位、不可用（aria-disabled，仍可聚焦）；reason 进工具提示与读屏名 */
  disabled?: boolean
  reason?: string
  /** 按钮的锚点（焦点交回、检查脚本定位用；可省） */
  anchor?: string
}

/**
 * 检查器顶行的统一件（规格 §3.4.1）：写「为什么不能改」或「这个对象从哪里来」，放在面板标题之上。
 * 外观就是 kit InspectorNotice（左右 16、上下 10，图标 16 + 12/18 次级文字，下沿 1px 分隔；不给图标时是信息图标）；
 * 有动作时动作在下一行右对齐：ghost 文字按钮，高 24、左右 8、12px 主文字色 + 12 的右箭头，按钮右缘对齐面板内容右缘（-mr-2）。
 * 一行只写一件事：权限行、对象行各用一个（最多两个，先权限后对象），普通视图的「转到版式」也用它。
 * text 是字符串时，「」引起来的名称自动整段不断行（比一整行还长时才在名称里换行，见 keepQuoted）。
 */
export function TopReason({ icon, text, action }: { icon?: ReactNode; text: ReactNode; action?: TopReasonAction }) {
  return (
    <InspectorNotice icon={icon}>
      <p>{keepQuoted(text)}</p>
      {action && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            className="-mr-2 h-6 px-2 text-(--v3-text)"
            disabled={action.disabled}
            reason={action.disabled ? action.reason : undefined}
            data-v3-anchor={action.anchor}
            onClick={action.onClick}
          >
            {action.label}
            <ChevronRight size={12} strokeWidth={1.5} aria-hidden="true" />
          </Button>
        </div>
      )}
    </InspectorNotice>
  )
}

/* ------------------------------------------------------------------ 小件 */

/** 字段标签（框内左侧灰字，与 NumberField 的标签同一外观） */
const lead = (s: string) => <span className="shrink-0 text-[12px] leading-none text-(--v3-text-2)">{s}</span>

/** 顿号列举（「标题、文本、页脚」）按项换行：项与项之间才断开，不在「页 / 码」这样的词中间断（Q7）；空列表返回 undefined */
function listPhrases(names: string[]): ReactNode | undefined {
  if (!names.length) return undefined
  return phrases(names.map((n, i) => (i < names.length - 1 ? `${n}、` : n)))
}

/**
 * 勾选 + 右侧说明的一行（外观同 kit CheckRow：28 高、16 方框、12px 标签、说明 --v3-text-2）。不同处：标签整段不断行，
 * 说明放不下时整段换到下一行、仍靠右——240 宽检查器里「保留母版」+「没有页面使用时也不删除」一行放不下，kit 的写法会把标签挤成「保留母 / 版」
 */
function HintCheckRow({ label, hint, checked, onCheckedChange, disabled, reason }: { label: string; hint: string; checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean; reason?: string }) {
  const id = useId()
  const box = <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria={disabled && reason ? withReason(label, reason) : undefined} />
  return (
    <div className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 py-1.5">
      {disabled && reason ? <Tip label={reason}>{box}</Tip> : box}
      <label htmlFor={id} className={cn("shrink-0 text-[12px] leading-4 select-none", disabled ? "text-(--v3-text-3)" : "text-(--v3-text)")}>
        {label}
      </label>
      <span className="ml-auto text-[12px] leading-4 text-(--v3-text-2)">{hint}</span>
    </div>
  )
}

/** 「标签 … 值」一行：高 28（同 StaticRow 的上下内距），值靠右、过长时换行（不截断，Q7） */
function ValueRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-7 items-start justify-between gap-3 py-[5px] text-[12px] leading-[18px]">
      <span className="shrink-0 text-(--v3-text-2)">{label}</span>
      <span className="min-w-0 text-right break-words text-(--v3-text)">{children}</span>
    </div>
  )
}

/** 下拉字段（kit Menu 的单选 + 选择触发器外框）：要把选了什么交出去、或要一出现就展开时用（MenuField 两样都没有）；不可用时同 MenuField 的静态触发器 */
function SelectField({
  aria,
  label,
  value,
  options,
  onChange,
  disabled,
  reason,
  open,
  anchor,
}: {
  aria: string
  label: string
  value: string
  options: { value: string; label: string; disabled?: boolean; reason?: string; tag?: string }[]
  onChange?: (v: string) => void
  disabled?: boolean
  reason?: string
  /** 一出现就展开（演示 data.mvMenu） */
  open?: boolean
  anchor?: string
}) {
  const trigger = (
    <SelectTrigger aria-label={withReason(aria, disabled ? reason : undefined)} aria-disabled={disabled || undefined} data-v3-anchor={anchor}>
      {lead(label)}
      <span className="truncate">{value}</span>
    </SelectTrigger>
  )
  if (disabled) return reason ? <Tip label={reason}>{trigger}</Tip> : trigger
  const items: MenuSpec[] = [{ type: "radio", id: aria, label: aria, value, options, onValueChange: onChange, closeOnSelect: true }]
  return <Menu trigger={trigger} items={items} defaultOpen={open} label={aria} />
}

/** 「颜色」字段的色槽名：文字取的是哪个内容 token（主色 / 次级是主题的「文字 1」「文字 2」，说明灰不在 12 个色槽里） */
const TONE_LABEL: Record<ArtTone, string> = { ink: "文字 1", body: "文字 2", mute: "说明灰" }
const COLOR_ITEMS = ["文字 1", "文字 2", "说明灰", "强调色 1"]

/**
 * 文字颜色的色块：直接取画布上的那个内容 token（var(--s-*)）——包一层所属母版的主题类与 .v3-slide（这两层用不占版面的显示方式），
 * 色块与画布画出来的颜色是同一个值（Q8），换了主题跟着换，不另抄一份色值
 */
function ToneChip({ tone, themeClass }: { tone: ArtTone; themeClass?: string }) {
  return (
    <span className={cn("contents", themeClass)}>
      <span className="v3-slide contents">
        <ColorChip color={`var(--s-${tone})`} />
      </span>
    </span>
  )
}

/**
 * 名称字段（版式与母版）：与窗格就地改名同一套规则——↵ 或失焦提交（renameTo，有错时不提交、红字说明），Esc 还原；空串不提交、还原原名。
 * 没改的时候跟着数据走（窗格里改了名，这里随之更新）；不可用时（M2）留在原位写原因
 */
function NameField({ mv, id, aria, lock }: { mv: MasterView; id: string; aria: string; lock?: string }) {
  const target = findMaster(id, mv.masters) ?? findLayout(id, mv.masters)
  const raw = target?.name ?? ""
  const [val, setVal] = useState(raw)
  const editing = useRef(false)
  const wrap = useRef<HTMLDivElement>(null)
  const errId = `${useId()}-err`
  const err = target ? renameErrorOf(val, target, mv.masters) : undefined
  useEffect(() => {
    if (!editing.current) setVal(raw)
  }, [raw])
  // 红字说明由这里画（不把字符串交给 kit TextField 的 error）：kit 给字符串时在字段外多包一层，元素树一变输入框就重新挂载，
  // 正在输入的那一下焦点掉到页面本身、接着打的字丢掉，再按 Esc 就退出了母版视图（2026-10-31 修复第 1 轮）。同窗格就地改名的 RenameField：
  // 字段只拿布尔值画红色描边，输入框经 aria-describedby 指向下面的说明行
  useLayoutEffect(() => {
    const input = wrap.current?.querySelector("input")
    if (!input) return
    if (err) input.setAttribute("aria-describedby", errId)
    else input.removeAttribute("aria-describedby")
  }, [err, errId])
  if (!target) return null
  if (lock) return <TextField aria={aria} defaultValue={raw} placeholder={mv.nameOf(id)} leading={lead("名称")} disabled reason={lock} />
  const commit = () => {
    if (err || mv.renameTo(id, val)) return
    if (!val.trim()) setVal(raw)
  }
  return (
    <div
      ref={wrap}
      onFocus={() => (editing.current = true)}
      onBlur={() => {
        editing.current = false
        commit()
      }}
    >
      <TextField
        aria={aria}
        value={val}
        onChange={setVal}
        placeholder={mv.nameOf(id)}
        leading={lead("名称")}
        error={!!err}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return
          if (e.key === "Enter") {
            e.preventDefault()
            commit()
          } else if (e.key === "Escape") {
            e.preventDefault()
            setVal(raw)
          }
        }}
      />
      {/* 外观同 kit TextField 给字符串时那一行（字段下 4、12/16、危险色） */}
      {err && (
        <p id={errId} className="mt-1 text-[12px] leading-4 text-(--v3-danger)">
          {err}
        </p>
      )}
    </div>
  )
}

/**
 * 「在普通视图查看 ›」（DS-150 ③）：退出母版视图并选中引用页（同右键「在普通视图查看引用页」）；画法同顶行的动作（ghost 文字按钮，右对齐）。
 * 只在有用量时画；M2 不画（§3.8）；降权的只读展示里照画、可用——它只是导航
 */
function ViewInNormal({ mv }: { mv: MasterView }) {
  if (mv.m2 || !mv.usage.length) return null
  return (
    <div className="flex justify-end">
      <Button variant="ghost" className="-mr-2 h-6 px-2 text-(--v3-text)" data-v3-anchor="master-view.view-in-normal" onClick={() => mv.viewInNormal()}>
        在普通视图查看
        <ChevronRight size={12} strokeWidth={1.5} aria-hidden="true" />
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------ layout：版式（§3.4.3） */

function LayoutInfoSection({ readOnly }: InspectorCtx) {
  const mv = useMasterView()
  const l = mv.paneLayout
  if (!l) return null
  if (readOnly)
    return (
      <Section anchor="section-master-view.layout" bodyClassName="gap-0">
        <StaticRow label="名称">{mv.targetName}</StaticRow>
        <StaticRow label="使用此版式">{usageText(mv.usage)}</StaticRow>
        <ViewInNormal mv={mv} />
        <StaticRow label="所属母版">{mv.master.name}</StaticRow>
      </Section>
    )
  return (
    <Section anchor="section-master-view.layout">
      <NameField mv={mv} id={l.id} aria="版式名称" lock={mv.reason("field")} />
      <div>
        <ValueRow label="使用此版式">{usageText(mv.usage)}</ValueRow>
        <ViewInNormal mv={mv} />
      </div>
      <ValueRow label="所属母版">{mv.master.name}</ValueRow>
    </Section>
  )
}

/** 当前对象上有没有某一族的占位符（勾选项按占位符算，删掉了就是没勾） */
const hasFamily = (mv: MasterView, ...families: string[]) => mv.placeholders.some((p) => families.includes(familyOf(p.type)))

function LayoutPlaceholdersSection({ readOnly }: InspectorCtx) {
  const mv = useMasterView()
  const lock = mv.reason("field")
  const title = hasFamily(mv, "title")
  const footer = hasFamily(mv, "footer", "date", "number")
  if (readOnly)
    return (
      <Section title="占位符" anchor="section-master-view.layout-placeholders" bodyClassName="gap-0">
        <StaticRow label="标题">{title ? "显示" : "不显示"}</StaticRow>
        <StaticRow label="页脚">{footer ? phrases(["显示", "（页脚、", "日期、", "页码）"]) : "不显示"}</StaticRow>
      </Section>
    )
  return (
    <Section title="占位符" anchor="section-master-view.layout-placeholders">
      <CheckRow label="标题" defaultChecked={title} disabled={!!lock} reason={lock} />
      <CheckRow label="页脚" hint="页脚 · 日期 · 页码" defaultChecked={footer} disabled={!!lock} reason={lock} />
    </Section>
  )
}

/* ------------------------------------------------------------------ master：母版（§3.4.4） */

function MasterInfoSection({ readOnly }: InspectorCtx) {
  const mv = useMasterView()
  const m = mv.master
  const pages = mv.usage
  const keep = mv.preserveOf(m.id)
  const lock = mv.reason("field")
  const used = pages.length ? `${pages.length} 页` : "未使用"
  if (readOnly)
    return (
      <Section anchor="section-master-view.master" bodyClassName="gap-0">
        <StaticRow label="名称">{m.name}</StaticRow>
        <StaticRow label="版式">{m.layouts.length} 个</StaticRow>
        <StaticRow label="使用此母版">{used}</StaticRow>
        <StaticRow label="保留母版">{keep ? "是" : "否"}</StaticRow>
      </Section>
    )
  return (
    <Section anchor="section-master-view.master">
      <NameField mv={mv} id={m.id} aria="母版名称" lock={lock} />
      <div>
        <ValueRow label="版式">{m.layouts.length} 个</ValueRow>
        <ValueRow label="使用此母版">{used}</ValueRow>
      </div>
      <HintCheckRow label="保留母版" hint="没有页面使用时也不删除" checked={keep} onCheckedChange={(v) => mv.setPreserve(m.id, v)} disabled={!!lock} reason={lock} />
    </Section>
  )
}

/**
 * 母版的占位符勾选项：标题 · 文本 · 页脚 · 页码 · 日期（两列）。「文本」即母版正文区的文本占位符（rulings §4.25 TB-34，与画布类型名、「插入占位符」菜单同一个词，DS-30）；
 * 勾没勾按母版上实际有的占位符算
 */
function MasterPlaceholdersSection({ readOnly }: InspectorCtx) {
  const mv = useMasterView()
  const lock = mv.reason("field")
  const items: { label: string; on: boolean }[] = [
    { label: "标题", on: hasFamily(mv, "title") },
    { label: "文本", on: hasFamily(mv, "body") },
    { label: "页脚", on: hasFamily(mv, "footer") },
    { label: "页码", on: hasFamily(mv, "number") },
    { label: "日期", on: hasFamily(mv, "date") },
  ]
  if (readOnly)
    return (
      <Section title="占位符" anchor="section-master-view.master-placeholders">
        <StaticRow label="显示">{listPhrases(items.filter((i) => i.on).map((i) => i.label)) ?? "无"}</StaticRow>
      </Section>
    )
  const row = (i: { label: string; on: boolean }) => <CheckRow key={i.label} label={i.label} defaultChecked={i.on} disabled={!!lock} reason={lock} />
  return (
    <Section title="占位符" anchor="section-master-view.master-placeholders">
      <Cols>{items.slice(0, 2).map(row)}</Cols>
      <Cols>{items.slice(2, 4).map(row)}</Cols>
      <Cols>{items.slice(4).map(row)}</Cols>
    </Section>
  )
}

/* ------------------------------------------------------------------ 主题与背景（layout / master；§3.4.10、§3.4.11） */

/**
 * 主题：与普通视图同一张卡片、同一对弹层（R-59），预览对象是当前母版；「主题颜色与字体」在母版视图里盖检查器栏（ThemeControl 的缺省位置，§3.6）。
 * 版式的节标题右侧写「随母版」（版式跟随所属母版的主题）。M2：卡片只展示、「调整主题」留在原位不可用「当前版本暂未开放」（mvReasonOf theme）
 */
function ThemeSection({ selection, readOnly }: InspectorCtx) {
  const mv = useMasterView()
  const { data } = useEditor()
  return (
    <Section
      title="主题"
      anchor="section-master-view.theme"
      action={selection === KIND.layout ? <span className="mr-1.5 text-[12px] leading-4 text-(--v3-text-2)">随母版</span> : undefined}
    >
      <ThemeControl
        cardAnchor="master-view.theme-card"
        adjustAnchor="master-view.theme-adjust"
        previewOf="当前母版"
        themeId={mv.master.theme}
        readOnly={readOnly}
        disabledReason={readOnly ? undefined : mv.reason("theme")}
        adjustTipOpen={(data as MvData).mvTip === "theme-adjust"}
      />
    </Section>
  )
}

/**
 * 背景：与普通页同一个「背景」节（底座 BackgroundControl，DS-20），色块取所选母版关联的主题；版式（与多选版式）的分段多一项「跟随母版」（图标分段，缺省选中，
 * builtin.tsx BG_TYPES_FOLLOW）与「隐藏背景图形」，母版没有「跟随」（R-58）
 */
function BackgroundSection({ selection, readOnly }: InspectorCtx) {
  const mv = useMasterView()
  const lock = readOnly ? undefined : mv.reason("field")
  const theme = themeOf(mv.master.theme)
  const layout = selection === KIND.layout || selection === KIND.multi
  const extra = layout ? readOnly ? <StaticRow label="背景图形">显示</StaticRow> : <CheckRow label="隐藏背景图形" hint="母版上的图形" disabled={!!lock} reason={lock} /> : undefined
  return (
    <BackgroundControl
      key={`${mv.master.id}:${selection}`}
      anchor="section-master-view.background"
      theme={theme}
      follow={layout ? { master: mv.master.name, fill: `纯色 · ${theme.slots[0]?.label ?? "背景 1"}` } : undefined}
      extra={extra}
      readOnly={readOnly}
      disabled={lock}
    />
  )
}

/* ------------------------------------------------------------------ 选中占位符（§3.4.5） */

/** 同族内可改的类型（规格 §3.4.5）：内容族与标题族；页脚族、副标题不可改（只读行） */
const TYPE_CHOICES: Record<string, { value: string; label: string; disabled?: boolean; reason?: string; tag?: string }[]> = {
  body: [
    { value: "内容", label: "内容" },
    { value: "文本", label: "文本" },
    { value: "图片", label: "图片" },
    { value: "表格", label: "表格" },
    { value: "图表", label: "图表" },
    { value: "媒体", label: "媒体", tag: "P2", disabled: true, reason: "后续版本提供" },
  ],
  title: [
    { value: "标题", label: "标题" },
    { value: "居中标题", label: "居中标题" },
  ],
}

/** OOXML 尺寸变体（sz）：正文族按占位符面积与母版正文区的比算（≥ 3/4 全尺寸、≥ 3/8 半尺寸，再小是四分之一）；其余类型是全尺寸 */
function sizeVariantOf(p: PhDef, mv: MasterView): "full" | "half" | "quarter" {
  if (familyOf(p.type) !== "body") return "full"
  const base = placeholdersFor(mv.master.id, "master").find((x) => familyOf(x.type) === "body")?.box
  if (!base) return "full"
  const r = (p.box.w * p.box.h) / (base.w * base.h)
  return r >= 0.75 ? "full" : r >= 0.375 ? "half" : "quarter"
}

/**
 * 占位符的身份（§3.4.5）：M3 且不是继承项时可改类型（同族）、方向与大小，其下只读的索引与来自；其余情况三行只读（类型 · 索引 · 来自）。
 * 可编辑时各行的先后一律是「类型 → 方向 → 大小 → 索引 → 来自」：类型不能在族内改的（页脚族、副标题）类型写成只读行，仍排在第一行
 * （2026-10-31 core 修复 CI-2：原来只读的类型行跟着索引、来自排到了方向、大小之后，同一种节的行序随占位符类型跳动）
 */
function PhInfoSection({ readOnly }: InspectorCtx) {
  const mv = useMasterView()
  const { data } = useEditor()
  const p = mv.selectedPh
  const [type, setType] = useState(p ? typeNameOf(p) : "")
  if (!p) return null
  const fromMaster = mv.scope === "master" || (p.inherited && mv.scope === "layout")
  const from = fromMaster ? `母版「${mv.master.name}」` : `版式「${mv.targetName}」`
  const choices = TYPE_CHOICES[familyOf(p.type)]
  const editable = !readOnly && !mv.reason("field")
  const typeRow = <StaticRow label="类型">{typeNameOf(p)}</StaticRow>
  const idRows = (
    <>
      <StaticRow label="索引">
        <span className="tabular-nums">{p.idx}</span>
      </StaticRow>
      <StaticRow label="来自">{keepQuoted(from)}</StaticRow>
    </>
  )
  if (!editable)
    return (
      <Section title="占位符" anchor="section-master-view.ph-info" bodyClassName="gap-0">
        <div>
          {typeRow}
          {idRows}
        </div>
      </Section>
    )
  const size = sizeVariantOf(p, mv)
  return (
    <Section title="占位符" anchor="section-master-view.ph-info">
      {choices ? <SelectField aria="占位符类型" label="类型" value={type} options={choices} onChange={setType} open={(data as MvData).mvMenu === "ph-type"} anchor="master-view.ph-type" /> : typeRow}
      {/* 标签列与下面的只读行（StaticRow：64 宽标签 + 8 间距）对齐，值都从同一条左缘起。
          分段控件至少 168 宽（「四分之一」三档各 56，字不折行）：检查器窄于 280 时整段换到标签下一行、占满整行，两行一起换（Q7） */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="w-16 shrink-0 text-[12px] leading-4 text-(--v3-text-2)">方向</span>
        <Segmented
          aria="文字方向"
          className="min-w-42 flex-1"
          defaultValue={p.vertical ? "v" : "h"}
          options={[
            { value: "h", label: "横排", text: "横排" },
            { value: "v", label: "竖排", text: "竖排" },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="w-16 shrink-0 text-[12px] leading-4 text-(--v3-text-2)">大小</span>
        <Segmented
          aria="占位符大小"
          className="min-w-42 flex-1"
          defaultValue={size}
          options={[
            { value: "full", label: "全尺寸", text: "全尺寸" },
            { value: "half", label: "半尺寸", text: "半尺寸" },
            { value: "quarter", label: "四分之一", text: "四分之一" },
          ]}
        />
      </div>
      <div>{idRows}</div>
    </Section>
  )
}

/** 位置与大小：底座共用的几何分区（pt）；拖动中写移动后的位置；继承项、M2 留在原位不可用写原因；他人刚改了的字段用 remote 画法（同 main-states.remote-overwrite） */
function PhGeometrySection({ readOnly }: InspectorCtx) {
  const mv = useMasterView()
  const p = mv.selectedPh
  if (!p) return null
  const box = mv.move && mv.move.ph === p.id ? movedBox(p.box, mv.move) : p.box
  const v = ptOf(box)
  const r = mv.remote && mv.remote.ph === p.id ? mv.remote : undefined
  return (
    <GeometrySection
      anchor="section-master-view.ph-geometry"
      readOnly={readOnly}
      disabled={readOnly ? undefined : mv.reason("field")}
      value={{ x: v.x, y: v.y, w: v.w, h: v.h }}
      remote={r ? { key: r.key, by: r.person.name, tone: r.person.tone, value: String(r.value) } : undefined}
    />
  )
}

/** 标题族用主题的标题字体，其余用正文字体 */
const fontOf = (p: PhDef, mv: MasterView) => {
  const t = themeOf(mv.master.theme)
  return familyOf(p.type) === "title" ? t.heading : t.body
}

/**
 * 文本样式（§3.4.5）：正文与文本占位符是「文本样式（大纲级别）」——级别 · 字体 · 字号 + 颜色 · 项目符号 + 缩进 · 行距 + 段距（后两行是 M3 补的四项，PRD ML-03）；
 * 其余类型是「文本样式」——字体 · 字号 + 颜色。值一律取画布实际的画法（textStyleOf：级别样式由 LEVELS_META 换算，单段类型取 LayoutArt 的字号与颜色 token），
 * 级别跟随提示文本编辑的插入符（§3.3.8），没在编辑时由「级别」字段切换。覆盖（mvOverride）时字号写覆盖值，节末一行「字号已在此版式覆盖」+「↺ 重置为母版值」
 */
function PhTextSection({ readOnly }: InspectorCtx) {
  const mv = useMasterView()
  const [own, setOwn] = useState(1)
  const p = mv.selectedPh
  if (!p) return null
  const levels = p.type === "body"
  const level = levels ? (mv.caret?.level ?? own) : 1
  const st = textStyleOf(p, level)
  const ov = mv.override
  const overridden = !!ov && ov.ph === p.id && ov.level === level && mv.scope === "layout" && !p.inherited
  const size = String(overridden && ov ? ov.size : st.size)
  const font = fontOf(p, mv)
  const color = TONE_LABEL[st.tone]
  const theme = themeOf(mv.master.theme)
  const title = levels ? "文本样式（大纲级别）" : "文本样式"
  const levelText = `第 ${level} 级`
  // 只读展示（DS-15）：一项一行（两列并排时色块挤占值的宽度，「说明灰」会被逐字折行）
  if (readOnly)
    return (
      <Section title={title} anchor="section-master-view.ph-text" bodyClassName="gap-0">
        {levels && <StaticRow label="级别">{levelText}</StaticRow>}
        <StaticRow label="字体">{font}</StaticRow>
        <StaticRow label="字号">{size} pt</StaticRow>
        <StaticRow label="颜色" leading={<ToneChip tone={st.tone} themeClass={theme.className} />}>
          {color}
        </StaticRow>
        {levels && (
          <>
            <StaticRow label="项目符号">{st.bullet}</StaticRow>
            <StaticRow label="缩进">{st.indent} pt</StaticRow>
            <StaticRow label="行距">{st.lineHeight}</StaticRow>
            <StaticRow label="段距">{st.spacing} pt</StaticRow>
          </>
        )}
      </Section>
    )
  const lock = mv.reason("field")
  const off = { disabled: !!lock, reason: lock }
  return (
    <Section title={title} anchor="section-master-view.ph-text">
      {levels && (
        <SelectField
          aria="大纲级别"
          label="级别"
          value={levelText}
          options={Array.from({ length: 9 }, (_, i) => ({ value: `第 ${i + 1} 级`, label: `第 ${i + 1} 级` }))}
          onChange={(v) => {
            const n = Number(/\d+/.exec(v)?.[0] ?? 1)
            if (mv.caret) mv.setCaretLevel(n)
            else setOwn(n)
          }}
          {...off}
        />
      )}
      {/* 级别换了：下面这些字段按新级别的值重新挂载（字段是非受控的） */}
      <div key={`${level}:${size}`} className="flex flex-col gap-2">
        <MenuField aria="字体" items={FONTS} defaultValue={font} leading={lead("字体")} {...off} />
        {/* 字号 + 颜色：两格各至少 112 宽（色槽名「说明灰」「强调色 1」不被截断）；检查器窄到一行放不下（240）时颜色整格换到下一行（Q7）。
            放得下时与下面两列的行同宽同缝（各占一半、间距 8） */}
        <div className="flex flex-wrap gap-2">
          <div className="min-w-28 flex-1">
            <NumberField label="字号" defaultValue={size} unit="pt" aria="字号" {...off} />
          </div>
          <div className="min-w-28 flex-1">
            <MenuField aria="文字颜色" items={COLOR_ITEMS} defaultValue={color} leading={<ToneChip tone={st.tone} themeClass={theme.className} />} className="w-full" {...off} />
          </div>
        </div>
        {levels && (
          <>
            <Cols>
              {/* 前导用列表图标（同普通视图「列表」分区的项目符号字段）：写四个字的标签时，240 宽的半栏放不下当前值 */}
              <MenuField aria="项目符号" items={["•", "–", "○", "无"]} defaultValue={st.bullet} leading={<List {...ICON} className="shrink-0 text-(--v3-text-2)" />} {...off} />
              <NumberField label="缩进" defaultValue={String(st.indent)} unit="pt" aria="缩进" {...off} />
            </Cols>
            <Cols>
              <NumberField label="行距" defaultValue={String(st.lineHeight)} aria="行距" {...off} />
              <NumberField label="段距" defaultValue={String(st.spacing)} unit="pt" aria="段距" {...off} />
            </Cols>
          </>
        )}
      </div>
      {overridden && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] leading-[18px] text-(--v3-text-2)">字号已在此版式覆盖</span>
          <Button variant="ghost" className="-mr-2 px-2" onClick={() => mv.resetOverride()}>
            <RotateCcw {...ICON} aria-hidden="true" />
            重置为母版值
          </Button>
        </div>
      )}
    </Section>
  )
}

/** 填充与描边（§3.4.5）：折叠、缺省收起；M2 留在原位不可用（修 req-audit §4.3 第 4 条）；降权按 DS-15 只读；继承项没有这一节（R-55） */
function PhFillSection({ readOnly }: InspectorCtx) {
  const mv = useMasterView()
  const p = mv.selectedPh
  if (!p || (p.inherited && mv.scope === "layout")) return null
  const lock = readOnly ? undefined : mv.reason("field")
  return (
    <FoldSection title="填充与描边" defaultOpen={false} anchor="section-master-view.ph-fill" bodyClassName={readOnly ? "gap-0" : undefined}>
      {readOnly ? (
        <>
          <StaticRow label="填充">无</StaticRow>
          <StaticRow label="描边">无</StaticRow>
        </>
      ) : (
        <Segmented
          aria="填充类型"
          defaultValue="none"
          disabled={!!lock}
          reason={lock}
          options={[
            { value: "none", label: "无", icon: <FillNoneIcon /> },
            { value: "solid", label: "纯色", icon: <FillSolidIcon /> },
            { value: "gradient", label: "渐变", icon: <FillGradientIcon /> },
          ]}
        />
      )}
    </FoldSection>
  )
}

/* ------------------------------------------------------------------ 母版上的普通形状（§3.4.2「普通形状用底座的『矩形』」；2026-10-31 core 修复 states-C1） */

/**
 * 形状填充的色块与色值：在所属母版的主题里解析画布用的那个内容 token（ART_FILL_TOKEN，同 ToneChip 的包法：主题类 + .v3-slide 两层，都不占版面），
 * 色块直接用 var(--s-*)，色值读这一层算出来的值——与画布画出来的颜色是同一个，换了主题跟着换，不另抄一份色值
 */
function useFillOf(token: string, themeClass?: string): { chip: ReactNode; hex: string } {
  const ref = useRef<HTMLSpanElement>(null)
  const [hex, setHex] = useState("")
  useLayoutEffect(() => {
    const el = ref.current
    setHex(el ? getComputedStyle(el).getPropertyValue(token).trim().toUpperCase() : "")
  }, [token, themeClass])
  const chip = (
    <span className={cn("contents", themeClass)}>
      <span ref={ref} className="v3-slide contents">
        <ColorChip color={`var(${token})`} />
      </span>
    </span>
  )
  return { chip, hex }
}

/** 位置与大小：这个形状的框换成 pt（与画布上的尺寸角标 phSizeText 同一个换算），旋转取缺省 0（输入里没有旋转）；M2 留在原位不可用写原因（同占位符） */
function MasterShapeGeometrySection({ readOnly }: InspectorCtx) {
  const mv = useMasterView()
  const s = mv.selectedShape
  if (!s) return null
  const v = ptOf(s.box)
  return <GeometrySection anchor="section-shape.geometry" readOnly={readOnly} disabled={readOnly ? undefined : mv.reason("field")} value={{ x: v.x, y: v.y, w: v.w, h: v.h }} />
}

/**
 * 快速样式：输入里这个形状没有套用主题样式（只有一个内容 token 的纯色填充），写「未套用样式」（底座给单个对象没有样式时的写法）；
 * 选中的样式记在这个形状自己的场景仓键上——底座缺省键是普通视图示例要点卡的那一份，母版视图里改了会带到普通视图的卡片上
 */
function MasterShapeStyleSection(ctx: InspectorCtx) {
  const mv = useMasterView()
  const s = mv.selectedShape
  if (!s) return null
  return <QuickStyleSection {...ctx} disabled={ctx.readOnly ? undefined : mv.reason("field")} stateKey={`masters.mv.shape-style.${s.id}`} initial={null} emptyLabel="未套用样式" />
}

/** 填充：纯色、色值取画布用的那个内容 token（useFillOf），不透明度 100%（输入里没有透明度）；分段与底座「矩形」同一组（图片 P2 不可用）；只读按 DS-15 写当前值 */
function MasterShapeFillSection({ readOnly }: InspectorCtx) {
  const mv = useMasterView()
  const s = mv.selectedShape
  return s ? <ShapeFill token={ART_FILL_TOKEN[s.fill]} mv={mv} readOnly={readOnly} /> : null
}

function ShapeFill({ token, mv, readOnly }: { token: string; mv: MasterView; readOnly: boolean }) {
  const fill = useFillOf(token, themeOf(mv.master.theme).className)
  if (readOnly)
    return (
      <Section title="填充" anchor="section-shape.fill">
        <StaticRow leading={fill.chip}>
          纯色 · <span className="tabular-nums">{fill.hex}</span> · <span className="tabular-nums">100%</span>
        </StaticRow>
      </Section>
    )
  const lock = mv.reason("field")
  return (
    <Section title="填充" anchor="section-shape.fill">
      <Segmented
        aria="填充类型"
        defaultValue="solid"
        disabled={!!lock}
        reason={lock}
        options={[
          { value: "none", label: "无", icon: <FillNoneIcon /> },
          { value: "solid", label: "纯色", icon: <FillSolidIcon /> },
          { value: "gradient", label: "渐变", icon: <FillGradientIcon /> },
          { value: "image", label: "图片", icon: <ImageIcon {...ICON} />, tag: "P2", disabled: true, reason: "后续版本提供" },
        ]}
      />
      {/* key：色值在布局阶段读出来之后重新挂载，输入框的初值跟着走 */}
      <ColorRow key={fill.hex} chip={fill.chip} hex={fill.hex} aria="填充" anchor="fill-color" disabled={!!lock} reason={lock} />
    </Section>
  )
}

/** 底座「矩形」分区里带示例要点卡演示值的三节，母版视图里选中普通形状时按这个形状的输入换掉（id、节序、位置不变） */
const MASTER_SHAPE_SECTIONS: Record<string, InspectorSectionDef["component"]> = {
  "shape.geometry": MasterShapeGeometrySection,
  "shape.style": MasterShapeStyleSection,
  "shape.fill": MasterShapeFillSection,
}

/**
 * 母版视图里选中普通形状（data.mvShapes 的种子，画在母版与它的版式上）时检查器的分区：仍是底座「矩形」的分区与节序（面板标题「矩形」），
 * 只把位置与大小、快速样式、填充换成由这个形状的输入算的（MasterInspectorBody 调；不往注册表里登记——同 id 后登记的会覆盖普通视图的那一节）。
 * 其余几节（对齐、描边、阴影、不透明度、操作）的缺省值本来就与这个形状一致（无描边、无阴影、100%、无动作），照用底座的
 */
export function withMasterShape(defs: InspectorSectionDef[]): InspectorSectionDef[] {
  return defs.map((d) => {
    const own = MASTER_SHAPE_SECTIONS[d.id]
    return own ? { ...d, component: own } : d
  })
}

/* ------------------------------------------------------------------ 多选版式（§3.4.8） */

/** 所选版式：逐行「名称 … N 页 / 未使用」（名称过长时换行，不截断） */
function MultiSection() {
  const mv = useMasterView()
  return (
    <Section title="所选版式" anchor="section-master-view.multi" bodyClassName="gap-0">
      {mv.multiLayouts.map((l) => {
        const pages = mv.usageFor(l.id)
        return (
          <div key={l.id} className="flex min-h-7 items-start justify-between gap-3 py-[5px] text-[12px] leading-[18px]">
            <span className="min-w-0 break-words text-(--v3-text)">{mv.nameOf(l.id)}</span>
            <span className="shrink-0 text-(--v3-text-2)">{pages.length ? `${pages.length} 页` : "未使用"}</span>
          </div>
        )
      })}
    </Section>
  )
}

/** 多选的节末说明（从画布挪来，R-56；dir L242）：一节无标题的说明 */
function MultiNoteSection() {
  return (
    <Section anchor="section-master-view.multi-note">
      <p className="text-[12px] leading-[18px] text-(--v3-text-2)">{phrases(["按 Delete 或右键删除；", "单击任一版式回到单选"])}</p>
    </Section>
  )
}

/* ------------------------------------------------------------------ 注册（layout / master 是 50/10 §5 的真实种类，由本场景负责） */

inspectorPanel({ kind: KIND.layout, title: "版式" })
inspectorPanel({ kind: KIND.master, title: "母版" })
inspectorPanel({ kind: KIND.placeholder, title: "占位符" })
inspectorPanel({ kind: KIND.inherited, title: "占位符" })
inspectorPanel({ kind: KIND.multi, title: "版式" })

inspectorSections([
  { id: "master-view.layout", kinds: [KIND.layout], order: 10, component: LayoutInfoSection },
  { id: "master-view.layout-placeholders", kinds: [KIND.layout], order: 20, component: LayoutPlaceholdersSection },
  { id: "master-view.master", kinds: [KIND.master], order: 10, component: MasterInfoSection },
  { id: "master-view.master-placeholders", kinds: [KIND.master], order: 20, component: MasterPlaceholdersSection },
  { id: "master-view.theme", kinds: [KIND.layout, KIND.master], order: 30, component: ThemeSection },
  { id: "master-view.background", kinds: [KIND.layout, KIND.master, KIND.multi], order: 40, component: BackgroundSection },

  { id: "master-view.ph-info", kinds: [KIND.placeholder, KIND.inherited], order: 10, component: PhInfoSection },
  { id: "master-view.ph-geometry", kinds: [KIND.placeholder, KIND.inherited], order: 20, component: PhGeometrySection },
  { id: "master-view.ph-text", kinds: [KIND.placeholder, KIND.inherited], order: 30, component: PhTextSection },
  { id: "master-view.ph-fill", kinds: [KIND.placeholder], order: 40, component: PhFillSection },

  { id: "master-view.multi", kinds: [KIND.multi], order: 10, component: MultiSection },
  { id: "master-view.multi-note", kinds: [KIND.multi], order: 50, component: MultiNoteSection },
])
