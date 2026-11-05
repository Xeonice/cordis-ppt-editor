import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react"
import { Check, ChevronDown, Languages, Lock, Pencil, RectangleHorizontal, Search, TriangleAlert, Unlink, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  BarDivider, BULLET_GLYPH, Button, CheckRow, ColorField, DeckSlideView, Dialog, ICON, IconButton, NumberField, PopoverTitle, Segmented, SelectTrigger, SwatchPicker, TextField, Tip, Toast, Toasts, useEditor, useLayerClose, useSceneState, V3Menu, type MenuSpec, type SwatchColor,
} from "../../kit"

/* ================================================================== 字体（检查器「中文」字段 → 左侧弹层） */

interface FontRow {
  name: string
  hint?: string
  locked?: boolean
}

const EA_THEME: FontRow[] = [
  { name: "思源黑体", hint: "标题" },
  { name: "思源黑体", hint: "正文" },
]
const EA_RECENT: FontRow[] = [{ name: "苹方" }, { name: "阿里巴巴普惠体" }]
const EA_ALL: FontRow[] = [
  { name: "阿里巴巴普惠体" },
  { name: "方正兰亭黑", locked: true },
  { name: "仿宋" },
  { name: "黑体" },
  { name: "楷体" },
  { name: "宋体" },
  { name: "苹方" },
  { name: "思源黑体" },
  { name: "思源宋体" },
  { name: "微软雅黑" },
  { name: "站酷高端黑" },
]

function GroupLabel({ children }: { children: string }) {
  return <p className="flex h-7 items-end px-2 pb-1.5 text-[12px] leading-none text-(--v3-text-2)">{children}</p>
}

/** 字体项：单击即应用并收起弹层（同 Figma）；受限字体 aria-disabled、仍可聚焦，点了不应用，工具提示给原因 */
function FontOption({ row, current, onPick }: { row: FontRow; current?: boolean; onPick?: () => void }) {
  const body = (
    <button
      type="button"
      role="option"
      aria-selected={!!current}
      aria-disabled={row.locked || undefined}
      aria-label={row.locked ? `${row.name}（仅授权查看，不能用于新文字）` : row.hint ? `${row.name}（主题${row.hint}字体）` : row.name}
      onClick={() => !row.locked && onPick?.()}
      className={cn(
        "flex h-7 w-full items-center gap-2 rounded-[4px] px-2 text-left text-[12px] leading-none transition-colors outline-none focus-visible:bg-(--v3-panel-2) focus-visible:ring-1 focus-visible:ring-(--v3-accent) focus-visible:ring-inset",
        row.locked ? "cursor-default text-(--v3-text-2)" : "text-(--v3-text) hover:bg-(--v3-panel-2)",
      )}
    >
      <span className="flex w-4 shrink-0 justify-center">{current && <Check size={12} strokeWidth={2} />}</span>
      <span className="min-w-0 flex-1 whitespace-nowrap">{row.name}</span>
      {row.hint && <span className="shrink-0 text-(--v3-text-2)">{row.hint}</span>}
      {row.locked && <Lock {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />}
    </button>
  )
  return row.locked ? <Tip label="此字体仅授权查看，不能用于新文字">{body}</Tip> : body
}

const fontKey = (r: FontRow) => (r.hint ? `${r.name}·${r.hint}` : r.name)

/**
 * 中文字体：搜索 + 主题字体（标题 / 正文，即 +mj-ea / +mn-ea）+ 最近使用 + 全部字体；受限内嵌字体带锁形（03-13）。
 * 单击字体即应用、弹层收起，检查器「中文」字段随之更新（useSceneState「text.ea-font」，检查器读同一份）；搜索框按名称过滤；× 与 Esc 关闭。
 * 键盘：↑ / ↓ 在字体间移动（跨分组），Enter 应用。
 */
export function EaFontPicker() {
  const close = useLayerClose()
  const [cur, setCur] = useSceneState<string>("text-edit.ea-font", "思源黑体·正文")
  const [q, setQ] = useState("")
  const list = useRef<HTMLDivElement>(null)
  const pick = (r: FontRow) => {
    setCur(fontKey(r))
    close()
  }
  const match = (r: FontRow) => !q.trim() || r.name.includes(q.trim())
  const groups: [string, FontRow[]][] = [
    ["主题字体", EA_THEME],
    ["最近使用", EA_RECENT],
    ["全部字体", EA_ALL],
  ]
  const shown = groups.map(([label, rows]) => [label, rows.filter(match)] as const).filter(([, rows]) => rows.length > 0)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
    const opts = Array.from(list.current?.querySelectorAll<HTMLElement>("[role=option]") ?? [])
    const i = opts.indexOf(document.activeElement as HTMLElement)
    const next = opts[e.key === "ArrowDown" ? Math.min(opts.length - 1, i + 1) : Math.max(0, i - 1)]
    if (next) {
      e.preventDefault()
      next.focus()
    }
  }
  return (
    <div className="flex w-[240px] flex-col" onKeyDown={onKeyDown}>
      <div className="flex flex-col gap-2 px-2 pt-2">
        <div className="flex h-6 items-center justify-between pl-1">
          <PopoverTitle>中文字体</PopoverTitle>
          <IconButton label="关闭" kbd="Esc" size={24} onClick={close}>
            <X {...ICON} />
          </IconButton>
        </div>
        <TextField aria="搜索中文字体" placeholder="搜索字体" value={q} onChange={setQ} leading={<Search {...ICON} className="shrink-0" />} />
      </div>
      {/* 底部 16px 渐隐：列表在弹层底边被截断时提示「下面还有」，不留半行硬切（遮罩只作用于列表本身，不是背景渐变） */}
      <div ref={list} role="listbox" aria-label="中文字体" className="mt-1 max-h-[440px] overflow-y-auto px-1 pb-3 [mask-image:linear-gradient(to_bottom,black_calc(100%-16px),transparent)]">
        {shown.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12px] leading-[18px] text-(--v3-text-2)">
            没有名为<span className="whitespace-nowrap">「{q.trim()}」</span>的字体
          </p>
        ) : (
          shown.map(([label, rows]) => (
            <div key={label} role="group" aria-label={label}>
              <GroupLabel>{label}</GroupLabel>
              {rows.map((r) => (
                <FontOption key={fontKey(r)} row={r} current={fontKey(r) === cur} onPick={() => pick(r)} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/* ================================================================== 文字颜色（检查器「文字颜色」 → 左侧弹层） */

function mix(hex: string, to: "white" | "black", t: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const target = to === "white" ? 255 : 0
  return `#${c.map((v) => Math.round(v + (target - v) * t).toString(16).padStart(2, "0")).join("").toUpperCase()}`
}

/** 文档主题的 10 个颜色（lt1 dk1 lt2 dk2 accent1–6） */
const THEME_BASE: SwatchColor[] = [
  { hex: "#FFFFFF", name: "白色" },
  { hex: "#141B2D", name: "深墨" },
  { hex: "#E6E9F0", name: "浅灰" },
  { hex: "#4B566B", name: "正文灰" },
  { hex: "#3A5CE6", name: "品牌蓝" },
  { hex: "#1F2A5C", name: "藏青" },
  { hex: "#7F98F1", name: "浅蓝" },
  { hex: "#2E9C8A", name: "青绿" },
  { hex: "#F0A030", name: "橙黄" },
  { hex: "#E8553A", name: "珊瑚" },
]

/** 每个主题色 5 个明暗变体（按亮度取「浅 80/60/40、深 25/50」，白色取「深 5–50」，深色取「浅 50–5」），逐行排成 10 × 6。 */
function themeGrid(): SwatchColor[] {
  const variants = THEME_BASE.map((c) => {
    const n = parseInt(c.hex.slice(1), 16)
    const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
    if (lum > 0.85)
      return [5, 15, 25, 35, 50].map((p) => ({ hex: mix(c.hex, "black", p / 100), name: `${c.name} · 深 ${p}%` }))
    if (lum < 0.2)
      return [50, 35, 25, 15, 5].map((p) => ({ hex: mix(c.hex, "white", p / 100), name: `${c.name} · 浅 ${p}%` }))
    return [
      ...[80, 60, 40].map((p) => ({ hex: mix(c.hex, "white", p / 100), name: `${c.name} · 浅 ${p}%` })),
      ...[25, 50].map((p) => ({ hex: mix(c.hex, "black", p / 100), name: `${c.name} · 深 ${p}%` })),
    ]
  })
  const rows: SwatchColor[] = [...THEME_BASE]
  for (let r = 0; r < 5; r++) for (const v of variants) rows.push(v[r]!)
  return rows
}

const STANDARD: SwatchColor[] = [
  { hex: "#C0392B", name: "深红" },
  { hex: "#E74C3C", name: "红色" },
  { hex: "#F39C12", name: "橙色" },
  { hex: "#F5D547", name: "黄色" },
  { hex: "#7FB24A", name: "浅绿" },
  { hex: "#2E8B57", name: "绿色" },
  { hex: "#2D9CDB", name: "天蓝" },
  { hex: "#1F4E99", name: "蓝色" },
  { hex: "#1A2050", name: "深蓝" },
  { hex: "#6A4CFF", name: "紫色" },
]
const RECENT: SwatchColor[] = [
  { hex: "#3A5CE6", name: "品牌蓝" },
  { hex: "#141B2D", name: "深墨" },
  { hex: "#E8553A", name: "珊瑚" },
]

/**
 * 主题颜色 10 × 6、标准色、最近使用、自定义色值；Tab 进色板、Enter / 单击选择（即时应用、弹层保持打开，便于连续比较），× 或 Esc 关闭。
 * 选中的颜色写进 useSceneState「text.color」，检查器「文字颜色」字段读同一份。
 */
export function TextColorPicker({ value = "#4B566B" }: { value?: string }) {
  const close = useLayerClose()
  const [color, setColor] = useSceneState<string>("text-edit.color", value)
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex h-6 items-center justify-between">
        <PopoverTitle>文字颜色</PopoverTitle>
        <IconButton label="关闭" kbd="Esc" size={24} onClick={close}>
          <X {...ICON} />
        </IconButton>
      </div>
      <SwatchPicker
        aria="文字颜色"
        value={color}
        onChange={setColor}
        groups={[
          { label: "主题颜色", colors: themeGrid() },
          { label: "标准色", colors: STANDARD },
          { label: "最近使用", colors: RECENT },
        ]}
      />
      <ColorField key={color} color={color} hex={color.toUpperCase()} aria="自定义文字颜色" />
    </div>
  )
}

/* ================================================================== 项目符号 / 编号（检查器「列表」字段 → 下拉菜单） */

function Glyph({ children }: { children: string }) {
  return <span className="text-[12px] leading-none text-(--v3-text)">{children}</span>
}

export const BULLET_MENU = (current: string): MenuSpec[] => [
  {
    type: "radio",
    id: "bullet",
    value: current,
    options: [
      { value: "无", label: "无" },
      ...Object.entries(BULLET_GLYPH).map(([name, g]) => ({ value: name, label: name, icon: <Glyph>{g}</Glyph> })),
    ],
  },
  { type: "separator" },
  { id: "custom", label: "自定义符号…", tag: "P2", disabled: true, reason: "后续版本提供" },
  { type: "separator" },
  { type: "note", text: "Tab 降级、⇧Tab 升级，共 9 级" },
]

function StartValueRow() {
  return (
    // 宽度对齐单选项的文字列（左侧留出勾选列与图标列）
    <div className="flex h-9 items-center justify-between gap-3 pr-1 pl-8" onKeyDown={(e) => e.stopPropagation()}>
      <span className="text-[12px] leading-none text-(--v3-text)">起始值</span>
      <NumberField defaultValue="1" aria="编号起始值" className="w-16" />
    </div>
  )
}

export const NUMBERING_MENU = (current: string): MenuSpec[] => [
  {
    type: "radio",
    id: "numbering",
    value: current,
    options: [
      { value: "无", label: "无" },
      { value: "1. 2. 3.", label: "1. 2. 3.", hint: "数字" },
      { value: "1) 2) 3)", label: "1) 2) 3)", hint: "数字加括号" },
      { value: "A. B. C.", label: "A. B. C.", hint: "大写字母" },
      { value: "a. b. c.", label: "a. b. c.", hint: "小写字母" },
      { value: "a) b) c)", label: "a) b) c)", hint: "字母加括号" },
      { value: "I. II. III.", label: "I. II. III.", hint: "罗马数字" },
      { value: "i. ii. iii.", label: "i. ii. iii.", hint: "小写罗马数字" },
      { value: "一、二、三、", label: "一、二、三、", hint: "中文数字" },
      { value: "(一) (二) (三)", label: "(一) (二) (三)", hint: "中文数字加括号" },
    ],
  },
  { type: "separator" },
  { type: "custom", id: "start", render: <StartValueRow /> },
]

/* ================================================================== 日期和时间（「更多 › 日期和时间…」 → 工具条上方弹层） */

interface DtFormat {
  code: string
  text: string
}

/** 三种语言 × 13 种格式（datetime1…13），样张固定时刻 2026-09-30（周三）14:32:05；与页眉和页脚对话框共用一张表（待语料核对，03-16 待决 3） */
const DT_FORMATS: Record<string, DtFormat[]> = {
  "zh-CN": ["2026/9/30", "2026年9月30日星期三", "2026年9月30日", "2026年9月", "9月30日", "二〇二六年九月三十日", "星期三", "2026/9/30 14:32", "2026/9/30 14:32:05", "14:32", "14:32:05", "下午2时32分", "下午2时32分05秒"].map(
    (text, i) => ({ code: `datetime${i + 1}`, text }),
  ),
  "en-US": [
    "9/30/2026",
    "Wednesday, September 30, 2026",
    "30 September 2026",
    "September 30, 2026",
    "30-Sep-26",
    "September 26",
    "Sep-26",
    "9/30/2026 2:32 PM",
    "9/30/2026 2:32:05 PM",
    "14:32",
    "14:32:05",
    "2:32 PM",
    "2:32:05 PM",
  ].map((text, i) => ({ code: `datetime${i + 1}`, text })),
  "ja-JP": ["2026/9/30", "2026年9月30日水曜日", "2026年9月30日", "2026年9月", "9月30日", "令和8年9月30日", "水曜日", "2026/9/30 14:32", "2026/9/30 14:32:05", "14:32", "14:32:05", "午後2時32分", "午後2時32分05秒"].map(
    (text, i) => ({ code: `datetime${i + 1}`, text }),
  ),
}
const DT_LANGS = [
  { value: "zh-CN", label: "中文（中国）" },
  { value: "en-US", label: "英语（美国）" },
  { value: "ja-JP", label: "日语" },
]
export const DT_DEFAULT = DT_FORMATS["zh-CN"]![0]!

/**
 * 日期和时间格式选择器（G-81 文本编辑态）：非模态，打开时不移走文本插入符；语言默认取插入符处 run 的 lang；
 * 13 种格式默认选中 datetime1；单击选中、双击直接插入；勾选「自动更新」插入日期字段（datetimeN），否则插入固定文本。
 */
export function DateTimePicker({ onClose, onInsert }: { onClose?: () => void; onInsert?: (f: { code: string; text: string; auto: boolean }) => void }) {
  const layerClose = useLayerClose()
  const close = onClose ?? layerClose
  const [lang, setLang] = useState("zh-CN")
  const [code, setCode] = useState("datetime1")
  const [auto, setAuto] = useState(true)
  const list = DT_FORMATS[lang] ?? DT_FORMATS["zh-CN"]!
  const cur = list.find((f) => f.code === code) ?? list[0]!
  const insert = (f: DtFormat = cur) => {
    onInsert?.({ code: f.code, text: f.text, auto })
    close()
  }
  return (
    <div className="flex flex-col gap-3">
      {/* 带标题的弹层右上一律有 ×（与字体、主题、版式等弹层一致） */}
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <PopoverTitle>日期和时间</PopoverTitle>
          <p className="text-[12px] leading-4 text-(--v3-text-2)">插入到光标处，字体字号随所在段落</p>
        </div>
        <IconButton label="关闭" kbd="Esc" size={24} className="-mt-1 -mr-1" onClick={close}>
          <X {...ICON} />
        </IconButton>
      </div>
      <div className="grid grid-cols-[auto_1fr] items-center gap-3">
        <span className="flex items-center gap-1.5 text-[12px] leading-none text-(--v3-text-2)">
          <Languages {...ICON} aria-hidden="true" />
          语言
        </span>
        <V3Menu
          value={lang}
          onValueChange={setLang}
          entries={DT_LANGS}
          trigger={
            <SelectTrigger aria-label="语言">
              <span className="truncate">{DT_LANGS.find((l) => l.value === lang)?.label}</span>
            </SelectTrigger>
          }
        />
      </div>
      <div role="listbox" aria-label="可用格式" className="max-h-[236px] overflow-y-auto rounded-[4px] bg-(--v3-panel-2) p-1">
        {list.map((f) => {
          const on = f.code === cur.code
          return (
            <button
              key={f.code}
              type="button"
              role="option"
              aria-selected={on}
              onClick={() => setCode(f.code)}
              onDoubleClick={() => insert(f)}
              // 选中标记与字体列表、菜单勾选项一致：左侧对勾列，不用强调色底
              className="flex h-7 w-full items-center gap-2 rounded-[4px] px-2 text-left text-[12px] leading-none text-(--v3-text) transition-colors hover:bg-(--v3-panel-3)"
            >
              <span className="flex w-4 shrink-0 items-center justify-center">{on && <Check size={12} strokeWidth={2} aria-hidden="true" />}</span>
              <span className="min-w-0 flex-1 whitespace-nowrap tabular-nums">{f.text}</span>
            </button>
          )
        })}
      </div>
      <div>
        <CheckRow label="自动更新" checked={auto} onCheckedChange={setAuto} />
        <p className="pl-6 text-[12px] leading-[18px] text-(--v3-text-2)">
          {auto ? (
            <>
              插入为日期字段：这里显示插入当天的日期，<span className="whitespace-nowrap">在 PowerPoint 中打开时自动更新</span>
            </>
          ) : (
            "插入为固定文本，之后不会变化"
          )}
        </p>
      </div>
      <div className="-mx-3 h-px bg-(--v3-border)" />
      <div className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px] leading-none whitespace-nowrap text-(--v3-text-2)">
          将插入
          <span className={cn("rounded-[4px] py-1 text-(--v3-text) tabular-nums", auto ? "bg-(--v3-panel-3) px-1.5" : "")}>{cur.text}</span>
        </span>
        <Button variant="ghost" onClick={close}>
          取消
        </Button>
        <Button variant="primary" onClick={() => insert()}>
          插入
        </Button>
      </div>
    </div>
  )
}

/* ================================================================== 「插入链接」对话框（⇧⌘K、右键与「更多」的「链接…」，DS-11、TB-6） */

function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-[12px] leading-4 text-(--v3-text-2)">
      {children}
    </label>
  )
}

/** 「本文稿中的页」：缩略图网格（真实渲染），单选 */
function SlidePickGrid({ selected, onPick }: { selected: number; onPick?: (n: number) => void }) {
  const { deck } = useEditor()
  const [pick, setPickInner] = useState(selected)
  const setPick = (n: number) => {
    setPickInner(n)
    onPick?.(n)
  }
  return (
    <div role="radiogroup" aria-label="链接到的页" className="grid grid-cols-3 gap-2">
      {deck.map((s) => {
        const on = s.n === pick
        return (
          <button key={s.n} type="button" role="radio" aria-checked={on} aria-label={`第 ${s.n} 页：${s.name}`} onClick={() => setPick(s.n)} className="flex flex-col gap-1.5 rounded-[6px] p-1 text-left transition-colors hover:bg-(--v3-panel-2)">
            <span className={cn("block overflow-hidden rounded-[4px] border border-(--v3-border)", on && "border-(--v3-accent) ring-1 ring-(--v3-accent)")}>
              <DeckSlideView slide={s} where="thumb" />
            </span>
            <span className="flex items-center gap-1.5 px-0.5 leading-none">
              <span className="text-[11px] text-(--v3-text-2) tabular-nums">{s.n}</span>
              <span className={cn("truncate text-[12px]", on ? "text-(--v3-text)" : "text-(--v3-text-2)")}>{s.name}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * 链接对话框正文：类型（网页地址 / 本文稿中的页）+ 地址或缩略图选择 + 显示文字。
 * invalid：地址是不在白名单里的协议（javascript: / data:），内联报错、不能确定。
 */
export function LinkForm({
  type: initial,
  address,
  invalid,
  text,
  page = 3,
  onPage,
}: {
  type: "url" | "slide"
  address?: string
  invalid?: boolean
  text: string
  /** 「本文稿中的页」的当前选择（0 = 未选） */
  page?: number
  onPage?: (n: number) => void
}) {
  const [type, setType] = useState(initial)
  return (
    <div className="flex flex-col gap-4">
      <Segmented
        aria="链接到"
        value={type}
        onValueChange={setType}
        options={[
          { value: "url", label: "网页地址", text: "网页地址" },
          { value: "slide", label: "本文稿中的页", text: "本文稿中的页" },
        ]}
      />
      {type === "url" ? (
        <div className="flex flex-col gap-1.5">
          <FieldLabel>地址</FieldLabel>
          <TextField aria="链接地址" defaultValue={address} placeholder="https://" className={cn(invalid && "ring-1 ring-(--v3-danger) ring-inset focus-within:ring-(--v3-danger)")} />
          {invalid ? (
            <p role="alert" className="text-[12px] leading-4 text-(--v3-danger)">
              只支持 http、https、mailto 和 tel 链接
            </p>
          ) : (
            <p className="text-[12px] leading-4 text-(--v3-text-2)">mailto 与 tel 链接会随文件保留，在 Cordex 里不打开</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <FieldLabel>选择页</FieldLabel>
          <SlidePickGrid selected={page} onPick={onPage} />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <FieldLabel>显示文字</FieldLabel>
        <TextField aria="显示文字" defaultValue={text} />
      </div>
    </div>
  )
}

/* ================================================================== 编辑态悬停已有链接的小卡（画在幻灯片叠加层） */

/** 场景内共享：已移除链接的条目、已重新设置的失效链接、链接相关的轻提示（AgendaLinkSlide 与小卡读写同一份） */
export const LINK_REMOVED = "text-edit.link-removed"
export const LINK_FIXED = "text-edit.link-fixed"
const LINK_TOAST = "text-edit.link-toast"

interface LinkToastState {
  key: number
  text: ReactNode
  undo?: () => void
}

/**
 * 链接小卡：目标（单击前往该页）+「⌘ 点击前往」提示 + 编辑 / 移除；broken 为目标页已被删除。
 * - Esc 收起小卡（产品里移开指针同样收起）；点「编辑链接」（⇧⌘K）打开链接对话框，关闭后焦点回到这个按钮；
 * - 「移除链接」去掉链接样式、小卡收起，轻提示带撤销；失效链接重新设置后恢复正常样式。
 * 目标是页面时用幻灯片图标；网页地址用 Globe（mailto / tel 改为显示目标与「复制」，应用内不打开）。
 */
export function LinkHoverCard({
  target,
  label,
  page,
  broken,
  className,
  style,
}: {
  target: string
  /** 链接所在的条目文字（移除 / 重新设置时用） */
  label: string
  /** 目标页码（单击目标前往；失效链接没有） */
  page?: number
  broken?: boolean
  className?: string
  style?: CSSProperties
}) {
  const { goTo, deck } = useEditor()
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState(false)
  const [removed, setRemoved] = useSceneState<string[]>(LINK_REMOVED, [])
  /** 重新设置过的链接：条目 → 目标页 */
  const [fixed, setFixed] = useSceneState<Record<string, number>>(LINK_FIXED, {})
  const [, setToast] = useSceneState<LinkToastState | null>(LINK_TOAST, null)
  const dest = fixed[label] ?? page
  const isBroken = broken && fixed[label] === undefined
  const [pick, setPick] = useState(isBroken ? 0 : (dest ?? 3))
  const destName = dest ? `第 ${dest} 页 · ${deck.find((d) => d.n === dest)?.name ?? ""}` : target
  const card = useRef<HTMLDivElement>(null)
  /**
   * Esc 收起小卡：焦点在卡外或卡里都是一下就收（卡里的按钮聚焦时会自动弹工具提示，提示不能把这下 Esc 吞掉，所以挂在捕获阶段、先于提示的监听）；
   * 链接对话框开着时 Esc 归对话框，焦点在别的浮层（菜单、弹层）里时归那一层。
   */
  useEffect(() => {
    if (!open || editing) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return
      const a = document.activeElement
      const inCard = !!(a && card.current?.contains(a))
      if (!inCard && a?.closest('[data-radix-popper-content-wrapper], [role=dialog][data-state=open], [role=menu]')) return
      setOpen(false)
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [open, editing])
  if (removed.includes(label)) return null
  const remove = () => {
    setRemoved((r) => [...r, label])
    setOpen(false)
    setToast({
      key: Date.now(),
      text: (
        <>
          已移除<span className="whitespace-nowrap">「{label}」</span>的链接
        </>
      ),
      undo: () => {
        setRemoved((r) => r.filter((x) => x !== label))
        setOpen(true)
      },
    })
  }
  return (
    <>
      {open && (
        <div
          ref={card}
          role="dialog"
          aria-label="链接"
          className={cn("pointer-events-auto absolute z-20 flex h-8 items-center gap-0.5 rounded-[8px] border border-(--v3-border) bg-(--v3-panel) px-1 whitespace-nowrap text-(--v3-text) shadow-(--v3-shadow)", className)}
          style={style}
          onClick={(e) => e.stopPropagation()}
        >
          {isBroken ? (
            <span className="flex h-6 items-center gap-2 px-1.5 text-[12px] leading-none">
              <TriangleAlert {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-danger)" />
              目标页已被删除，请重新设置
            </span>
          ) : (
            <Tip label={`前往${destName}`}>
              <button
                type="button"
                onClick={() => dest && goTo(dest)}
                className="flex h-6 items-center gap-2 rounded-[4px] px-1.5 text-[12px] leading-none transition-colors hover:bg-(--v3-panel-2)"
              >
                <RectangleHorizontal {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />
                {fixed[label] !== undefined ? destName : target}
                <span className="text-(--v3-text-2)">⌘ 点击前往</span>
              </button>
            </Tip>
          )}
          <BarDivider />
          <IconButton label="编辑链接" kbd="⇧⌘K" size={24} onClick={() => setEditing(true)}>
            <Pencil {...ICON} />
          </IconButton>
          <IconButton label="移除链接" size={24} onClick={remove}>
            <Unlink {...ICON} />
          </IconButton>
        </div>
      )}
      {editing && (
        <Dialog
          title="编辑链接"
          open
          onOpenChange={(v) => !v && setEditing(false)}
          secondary={{ label: "取消" }}
          primary={{
            label: "保存",
            disabled: pick === 0,
            reason: pick === 0 ? "先选择要链接到的页" : undefined,
            onClick: () => {
              setFixed((f) => ({ ...f, [label]: pick }))
              setToast({ key: Date.now(), text: <>已把<span className="whitespace-nowrap">「{label}」</span>链接到第 {pick} 页</> })
            },
          }}
        >
          <LinkForm type="slide" text={label} page={pick} onPage={setPick} />
        </Dialog>
      )}
    </>
  )
}

/** 链接操作的轻提示（放 canvasOverlay）：移除后可撤销、更新后确认；点撤销 / × 收起 */
export function LinkToasts() {
  const [toast, setToast] = useSceneState<LinkToastState | null>(LINK_TOAST, null)
  if (!toast) return null
  return (
    <Toasts>
      <Toast key={toast.key} action={toast.undo ? "撤销" : undefined} onAction={toast.undo} onClose={toast.undo ? undefined : () => setToast(null)}>
        {toast.text}
      </Toast>
    </Toasts>
  )
}

/** 小 ▾：给只读展示用 */
export function Chevron() {
  return <ChevronDown size={12} strokeWidth={1.5} aria-hidden="true" className="shrink-0 opacity-70" />
}
