import {
  AudioLines, BringToFront, ChevronDown, ChevronUp, ClipboardPaste, Copy, CopyPlus, Group, Hash, Link, MessageSquarePlus, Omega, Scissors, Search,
  SendToBack, SlidersHorizontal, Sticker, Trash, Video, Workflow, X,
} from "lucide-react"
import { useLayoutEffect, useState } from "react"
import {
  Banner, Button, CanvasTag, CheckRow, ColorField, Cols, ContextMenu, Dialog, deckWith, FloatingPanel, FoldSection, Guide, HoverBox,
  ICON, IconButton, InspectorNotice, inspectorPanel, inspectorSections, Marquee, Menu, MenuField, NumberField, Popover, PopoverTitle, PropRow, Section,
  Segmented, SelectionBox, SliderField, SlideFooter, SlideTitle, SwatchPicker, TableGridPicker, Tag, TextField, Toast, Toasts, type MenuSpec, type SwatchColor, GeometrySection, LayerClose, RadioRow,
  assignTones, Avatar, InspectorTakeover, PanelTitle, RemoteCursor, StaticRow, TextArea, TONES, toneOf, useDismissOnMasterToggle, useEditor, useMasterViewMode, useTakeoverOpen, type Tone } from "../kit"
import { defineScenario } from "./types"
import { KitBlockingBody, KitCardsBody, KitDrawer, KitShellBanner, KitShellBody, KitShellToasts } from "./_kit-shell"

/**
 * _kit：共享底座组件的用法示例（Hub 不展示）。每个状态演示一个组件，打开方式 #/v3/editor?state=_kit.<状态>&theme=dark|light。
 * 新场景照着抄：浮层放 layers，画布内的浮动面板 / 轻提示放 canvasOverlay，横幅放 banner，幻灯片上的选中框、参考线放 slideOverlay，
 * 新种类的检查器分区用 inspectorSections 注册（种类名带场景前缀，示例里是 _kit-*，不要占用 table、chart 这些真实种类）。
 */

/* ------------------------------------------------------------------ 弹层：颜色选择（锚在检查器「填充」颜色行上） */

const THEME_COLORS: SwatchColor[] = [
  { hex: "#FFFFFF", name: "白色" },
  { hex: "#141B2D", name: "深墨" },
  { hex: "#3A5CE6", name: "品牌蓝" },
  { hex: "#7F98F1", name: "品牌蓝 · 浅 30%" },
  { hex: "#AFC0F8", name: "品牌蓝 · 浅 50%" },
  { hex: "#E8EDFD", name: "品牌蓝 · 浅 80%" },
  { hex: "#EEF2FF", name: "要点卡底" },
  { hex: "#4B566B", name: "正文灰" },
  { hex: "#8A93A6", name: "说明灰" },
  { hex: "#E6E9F0", name: "分隔线" },
]
const STANDARD_COLORS: SwatchColor[] = [
  { hex: "#C0392B", name: "深红" },
  { hex: "#E8553A", name: "橙红" },
  { hex: "#F0A030", name: "橙黄" },
  { hex: "#F5D547", name: "黄色" },
  { hex: "#5E9684", name: "青绿" },
  { hex: "#2E8B57", name: "绿色" },
  { hex: "#2D9CDB", name: "天蓝" },
  { hex: "#1F2A5C", name: "藏青" },
  { hex: "#6A4CFF", name: "紫色" },
  { hex: "#A8786E", name: "陶土" },
]
const RECENT_COLORS: SwatchColor[] = [
  { hex: "#EEF2FF", name: "要点卡底" },
  { hex: "#3A5CE6", name: "品牌蓝" },
  { hex: "#141B2D", name: "深墨" },
]

function FillPicker() {
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex h-6 items-center justify-between">
        <PopoverTitle>填充</PopoverTitle>
        <IconButton label="关闭" size={24}>
          <X {...ICON} />
        </IconButton>
      </div>
      <SwatchPicker
        aria="填充颜色"
        defaultValue="#EEF2FF"
        groups={[
          { label: "主题颜色", colors: THEME_COLORS },
          { label: "标准色", colors: STANDARD_COLORS },
          { label: "最近使用", colors: RECENT_COLORS },
        ]}
      />
      <ColorField color="#EEF2FF" aria="自定义填充" />
    </div>
  )
}

/* ------------------------------------------------------------------ 菜单：工具条「更多」 */

const MORE_ITEMS: MenuSpec[] = [
  { type: "label", label: "媒体" },
  { id: "video", label: "视频", icon: <Video {...ICON} />, tag: "P2", disabled: true, reason: "后续版本提供" },
  { id: "audio", label: "音频", icon: <AudioLines {...ICON} />, tag: "P2", disabled: true, reason: "后续版本提供" },
  { type: "separator" },
  { id: "symbol", label: "符号…", icon: <Omega {...ICON} /> },
  { id: "icon", label: "图标…", icon: <Sticker {...ICON} /> },
  { id: "link", label: "链接…", icon: <Link {...ICON} />, kbd: "⇧⌘K" },
  {
    type: "sub",
    id: "header-footer",
    label: "页眉页脚与编号",
    icon: <Hash {...ICON} />,
    items: [
      { type: "checkbox", id: "slide-no", label: "幻灯片编号", checked: true },
      { type: "checkbox", id: "footer", label: "页脚", checked: true },
      { type: "checkbox", id: "date", label: "日期和时间", checked: false },
      { type: "separator" },
      { type: "label", label: "日期格式" },
      {
        type: "radio",
        id: "date-format",
        value: "cn-long",
        options: [
          { value: "iso", label: "2026/10/5" },
          { value: "cn-long", label: "2026 年 10 月 5 日" },
          { value: "cn-week", label: "10 月 5 日 星期一" },
        ],
      },
      { type: "separator" },
      { id: "dialog", label: "页眉和页脚…" },
    ],
  },
  { type: "separator" },
  { type: "label", label: "插件" },
  { id: "flow", label: "流程图", icon: <Workflow {...ICON} />, hint: "插件" },
]

/* ------------------------------------------------------------------ 右键菜单：选中形状 */

const SHAPE_CONTEXT: MenuSpec[] = [
  { id: "cut", label: "剪切", icon: <Scissors {...ICON} />, kbd: "⌘X" },
  { id: "copy", label: "复制", icon: <Copy {...ICON} />, kbd: "⌘C" },
  { id: "paste", label: "粘贴", icon: <ClipboardPaste {...ICON} />, kbd: "⌘V", disabled: true, reason: "剪贴板为空" },
  { id: "duplicate", label: "原位复制", icon: <CopyPlus {...ICON} />, kbd: "⌘D" },
  { type: "separator" },
  {
    type: "sub",
    id: "arrange",
    label: "排列",
    icon: <BringToFront {...ICON} />,
    items: [
      { id: "front", label: "置于顶层", kbd: "⇧⌘]" },
      { id: "forward", label: "上移一层", kbd: "⌘]" },
      { id: "backward", label: "下移一层", kbd: "⌘[" },
      { id: "back", label: "置于底层", kbd: "⇧⌘[" },
    ],
  },
  { id: "group", label: "组合", icon: <Group {...ICON} />, kbd: "⌘G", disabled: true, reason: "需选中 2 个以上对象" },
  { id: "send-back", label: "设为背景", icon: <SendToBack {...ICON} /> },
  { type: "separator" },
  { id: "comment", label: "添加评论", icon: <MessageSquarePlus {...ICON} />, kbd: "C" },
  { type: "separator" },
  { id: "delete", label: "删除", icon: <Trash {...ICON} />, kbd: "⌫", danger: true },
]

/* ------------------------------------------------------------------ 浮动面板：查找与替换 */

/**
 * 示例里的查找浮动条（FloatingPanel 放 canvasOverlay）：同真实的画布浮动层，进出母版视图时收起、母版视图里不画，退出后不再出现
 * （rulings §4.25 DS-158、TB-204；kit useDismissOnMasterToggle）。载入时照常开着
 */
function KitFindPanel() {
  const [open, setOpen] = useState(true)
  useDismissOnMasterToggle(open, () => setOpen(false))
  if (!open) return null
  return (
    <FloatingPanel label="查找和替换" className="w-[340px] p-2">
      <FindBar />
    </FloatingPanel>
  )
}

function FindBar() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <TextField aria="查找" defaultValue="营收" leading={<Search {...ICON} className="shrink-0" />} trailing={<span className="text-[11px] leading-none text-(--v3-text-2) tabular-nums">1/5</span>} className="flex-1" />
        <IconButton label="上一个" kbd="⇧↵">
          <ChevronUp {...ICON} />
        </IconButton>
        <IconButton label="下一个" kbd="↵">
          <ChevronDown {...ICON} />
        </IconButton>
        <IconButton label="选项">
          <SlidersHorizontal {...ICON} />
        </IconButton>
        <IconButton label="关闭" kbd="Esc">
          <X {...ICON} />
        </IconButton>
      </div>
      <div className="flex items-center gap-1">
        <TextField aria="替换为" placeholder="替换为" className="flex-1" />
        <Button variant="secondary">替换</Button>
        <Button variant="secondary">全部替换</Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 自定义页：季度明细表（deck 覆盖示例） */

const QUARTER_ROWS = [
  { region: "华东", q1: "4,120", q2: "4,864", yoy: "+18%" },
  { region: "华南", q1: "2,640", q2: "3,072", yoy: "+16%" },
  { region: "华北", q1: "2,410", q2: "2,688", yoy: "+12%" },
  { region: "西部", q1: "1,290", q2: "1,408", yoy: "+9%" },
]

/** 表格在页面上的位置（百分比），选中框与点选区域用同一组值。 */
const TABLE_BOX = { x: 7, y: 33.8, w: 86, h: 48 }

function QuarterTableSlide() {
  return (
    <>
      <SlideTitle>季度明细</SlideTitle>
      <div className="absolute inset-x-[7cqw] top-[19cqw]">
        <div className="flex h-[5.4cqw] items-center rounded-t-[0.8cqw] bg-(--s-brand) px-[2cqw] text-[1.9cqw] leading-none font-semibold text-white">
          <span className="flex-1">区域</span>
          <span className="w-[16cqw] text-right">Q1（万元）</span>
          <span className="w-[16cqw] text-right">Q2（万元）</span>
          <span className="w-[12cqw] text-right">同比</span>
        </div>
        {QUARTER_ROWS.map((r, i) => (
          <div key={r.region} className={i % 2 ? "flex h-[5.4cqw] items-center bg-(--s-card) px-[2cqw]" : "flex h-[5.4cqw] items-center px-[2cqw]"}>
            <span className="flex-1 text-[2.1cqw] leading-none font-medium">{r.region}</span>
            <span className="w-[16cqw] text-right text-[2.1cqw] leading-none text-(--s-body) tabular-nums">{r.q1}</span>
            <span className="w-[16cqw] text-right text-[2.1cqw] leading-none font-semibold tabular-nums">{r.q2}</span>
            <span className="w-[12cqw] text-right text-[2.1cqw] leading-none font-semibold text-(--s-brand) tabular-nums">{r.yoy}</span>
          </div>
        ))}
      </div>
      <SlideFooter page={3} />
    </>
  )
}

/* ------------------------------------------------------------------ 检查器分区：只给 _kit-* 种类注册 */

function KitNumberSection() {
  return (
    <Section title="数值输入">
      <Cols>
        <NumberField label="X" defaultValue="629" aria="X 坐标" />
        <NumberField label="Y" defaultValue="232" aria="Y 坐标" />
      </Cols>
      <Cols>
        <NumberField label="W" mixed aria="宽度" />
        <NumberField label="H" defaultValue="176" unit="pt" aria="高度" />
      </Cols>
      <NumberField label="字号" defaultValue="0" unit="pt" aria="字号" error="字号须在 1–4000 pt 之间" />
      <NumberField label="列宽" defaultValue="119" unit="pt" aria="列宽" disabled reason="M3 提供" />
    </Section>
  )
}

function KitPickSection() {
  return (
    <Section title="透明度与颜色">
      <SliderField aria="透明度" defaultValue={60} />
      <ColorField color="#3A5CE6" aria="强调色" />
      <SwatchPicker aria="主题颜色" defaultValue="#3A5CE6" groups={[{ colors: THEME_COLORS }]} />
    </Section>
  )
}

function KitChoiceSection() {
  return (
    <Section title="选项">
      <Segmented
        aria="文字方向"
        defaultValue="h"
        options={[
          { value: "h", label: "横排", text: "横排" },
          { value: "v", label: "竖排", text: "竖排" },
          { value: "r", label: "旋转 90°", text: "旋转" },
        ]}
      />
      <CheckRow label="标题行" defaultChecked />
      <CheckRow label="镶边行" defaultChecked />
      <CheckRow label="汇总行" hint="M3" disabled />
      <PropRow label="自动调整">
        <MenuField aria="自动调整" items={["不自动调整", "溢出时缩排文字", "根据文字调整形状大小"]} defaultValue="溢出时缩排文字" className="w-[148px]" align="end" />
      </PropRow>
    </Section>
  )
}

function KitFoldSections() {
  return (
    <>
      <FoldSection title="表格样式">
        <div className="flex items-center gap-2 text-[12px] leading-4 text-(--v3-text-2)">
          中度样式 2 · 强调 1<Tag>M3</Tag>
        </div>
      </FoldSection>
      <FoldSection title="行高与列宽" defaultOpen={false}>
        <Cols>
          <NumberField label="行高" defaultValue="34" unit="pt" aria="行高" />
          <NumberField label="列宽" defaultValue="119" unit="pt" aria="列宽" />
        </Cols>
      </FoldSection>
      <Section title="文本输入">
        <TextField aria="搜索图标" placeholder="搜索图标" leading={<Search {...ICON} className="shrink-0" />} />
      </Section>
    </>
  )
}

function KitTableSections() {
  return (
    <>
      {/* 位置与大小：所有对象共用底座的 GeometrySection（同一套字段、单位与展开状态），不要自己拼 */}
      <GeometrySection value={{ x: 67, y: 182, w: 826, h: 259 }} sizeDisabled="M3 提供" rotate={false} note="表格不可旋转或翻转" />
      <FoldSection title="表格样式">
        <CheckRow label="标题行" defaultChecked />
        <CheckRow label="镶边行" defaultChecked />
      </FoldSection>
    </>
  )
}

inspectorPanel({ kind: "_kit-controls", title: "控件示例" })
inspectorPanel({ kind: "_kit-table", title: "表格" })
inspectorSections([
  { id: "_kit.numbers", kinds: ["_kit-controls"], order: 10, component: KitNumberSection },
  { id: "_kit.pick", kinds: ["_kit-controls"], order: 20, component: KitPickSection },
  { id: "_kit.choice", kinds: ["_kit-controls"], order: 30, component: KitChoiceSection },
  { id: "_kit.fold", kinds: ["_kit-controls"], order: 40, component: KitFoldSections },
  { id: "_kit.table", kinds: ["_kit-table"], order: 10, component: KitTableSections },
])

/* ------------------------------------------------------------------ 第 2 批底座：评论页签插槽、整栏面板、身份色 12 色 */

/** 评论页签插槽（inspector.commentsBody）的结构示例：列表在上、回复框 mt-auto 贴底（容器是占满滚动区的纵向 flex）。视觉与条目由评论场景（03-06）定稿 */
function KitCommentsBody() {
  const threads = [
    { id: "u-chen", name: "陈静", when: "10 分钟前", text: "6 月的数据是否包含海外业务？建议在图注里写清口径。" },
    { id: "u-liu", name: "刘洋", when: "昨天", text: "Q2 累计与财务报表对了一遍，数字一致。" },
  ]
  return (
    <>
      <PanelTitle>第 4 页 · 2 条评论</PanelTitle>
      {/* 列表包一层：最后一条的分隔线由 Section 的 last: 规则去掉，不与回复框的上边线叠成 2px */}
      <div>
        {threads.map((t) => (
          <Section key={t.id}>
            <div className="flex items-center gap-2">
              {/* 身份色按用户 id 稳定取（toneOf），示例里的固定人物仍用 data.ts 写死的色 */}
              <Avatar name={t.name} tone={toneOf(t.id)} size={20} />
              <span className="text-[12px] leading-none font-semibold">{t.name}</span>
              <span className="text-[12px] leading-none text-(--v3-text-2)">{t.when}</span>
            </div>
            <p className="text-[12px] leading-[18px] text-(--v3-text)">{t.text}</p>
          </Section>
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-2 border-t border-(--v3-border) px-4 py-3">
        <TextArea aria="回复" placeholder="回复…" rows={2} />
        <Button variant="primary" className="self-end">
          发送
        </Button>
      </div>
    </>
  )
}

/** 整栏面板（inspector.takeover）示例：状态一出现就开着；「关闭」/ Esc 收起后检查器回到常规页签 */
function KitTakeover() {
  return (
    <InspectorTakeover
      title="整栏面板"
      subtitle="inspector.takeover · 栏宽 400"
      footer={<p className="text-[12px] leading-[18px] text-(--v3-text-2)">「关闭」或 Esc 收起，检查器回到常规页签；画布左上角的按钮再打开。</p>}
    >
      <Section title="标题行">
        <StaticRow label="标题">13px 600；有说明时行高 56，否则 44</StaticRow>
        <StaticRow label="按钮">actions · 收起到检查器（可选）· 关闭</StaticRow>
      </Section>
      <Section title="外框">
        <StaticRow label="协作行">与检查器同一行，头像组随 inspector.collaborators</StaticRow>
        <StaticRow label="栏宽">缺省 400（DS-26），width 可改</StaticRow>
        <StaticRow label="内容区">纵向滚动，内边距用 bodyClassName；footer 固定在底部</StaticRow>
      </Section>
    </InspectorTakeover>
  )
}

/**
 * 整栏面板收起后，画布左上角给一个再打开的入口（演示 useTakeoverOpen）。
 * 母版视图里不画（rulings §4.25 DS-158、TB-204：普通视图的画布浮动层不带进母版视图；母版视图里本来也不画状态声明的整栏面板）；退出后面板仍收着时照常画
 */
function KitTakeoverReopen() {
  const [open, setOpen] = useTakeoverOpen()
  const { on } = useMasterViewMode()
  if (open || on) return null
  return (
    <FloatingPanel label="整栏面板已收起" placement="top-left" className="p-2">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        重新打开整栏面板
      </Button>
    </FloatingPanel>
  )
}

/** 身份色样例里的 12 个人（与 TONES 的哈希顺序一一对应） */
const TONE_PEOPLE = ["周明远", "王小明", "李雷", "张三", "陈静", "刘洋", "赵敏", "孙悦", "吴昊", "郑凯", "冯雪", "何斌"]

/** WCAG 2.2 对比度（向下截断两位，同设计 04 §2.6 口径）：读 v3 根节点上当前主题的实际取值（useRootVars 已规范成 #RRGGBB） */
const lumOf = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lumOf(a), lumOf(b)].sort((p, q) => q - p)
  return (Math.floor(((x! + 0.05) / (y! + 0.05)) * 100) / 100).toFixed(2)
}

/** 规范颜色用的 2D 画布（第一次用时才建，模块顶层不碰 DOM） */
let paint: CanvasRenderingContext2D | null | undefined

/**
 * 任意 CSS 颜色写法 → #RRGGBB（大写）。构建会把颜色压成最短写法（亮色 --v3-panel 的 #FFFFFF 成了 #fff，纯色还可能写成颜色名），
 * 按 6 位十六进制截取会算出 NaN；这里交给浏览器解析（2D 画布的 fillStyle 把不透明颜色规范成 #rrggbb），不自己猜写法。解析不了（或带透明度）时返回空串
 */
function toHex(value: string): string {
  if (!value || !CSS.supports("color", value)) return ""
  if (paint === undefined) paint = document.createElement("canvas").getContext("2d")
  if (!paint) return ""
  paint.fillStyle = "#000000"
  paint.fillStyle = value
  const out = String(paint.fillStyle)
  return /^#[0-9a-f]{6}$/i.test(out) ? out.toUpperCase() : ""
}

/** 读 v3 根节点（.v3-root）上的颜色变量（随主题切换重读），统一规范成 #RRGGBB */
function useRootVars(names: string[]): Record<string, string> {
  const { theme } = useEditor()
  const [vars, setVars] = useState<Record<string, string>>({})
  useLayoutEffect(() => {
    const root = document.querySelector(".v3-root")
    if (!root) return
    const cs = getComputedStyle(root)
    setVars(Object.fromEntries(names.map((n) => [n, toHex(cs.getPropertyValue(n).trim())])))
    // names 是常量
  }, [theme])
  return vars
}

const TONE_VARS = [...TONES.map((t) => `--v3-tone-${t}`), "--v3-canvas", "--v3-panel"]
const SAMPLE_IDS = ["u-chen", "u-liu", "u-zhao", "u-sun"]
const SAMPLE_TONES = assignTones(SAMPLE_IDS)

/** 身份色 12 色核对表（换掉「设计」页签）：哈希顺序、取值，与白字 / 当前主题 canvas / 当前主题 panel 的对比度 */
function KitTonesBody() {
  const v = useRootVars(TONE_VARS)
  // 读不到（或解析不了）的一列留空，不拿黑色顶替去算
  const canvas = v["--v3-canvas"] ?? ""
  const panel = v["--v3-panel"] ?? ""
  return (
    <>
      <PanelTitle>身份色 · 12 色</PanelTitle>
      <Section title="哈希顺序（--presence-1…12）" bodyClassName="gap-0">
        <div className="flex h-6 items-center gap-2 text-[12px] leading-none text-(--v3-text-2)">
          <span className="w-4" />
          <span className="w-6" />
          <span className="flex-1">色名 · 取值</span>
          <span className="w-9 text-right">白字</span>
          <span className="w-9 text-right">画布</span>
          <span className="w-9 text-right">面板</span>
        </div>
        {TONES.map((t: Tone, i) => {
          const hex = v[`--v3-tone-${t}`] ?? ""
          const ok = /^#[0-9A-F]{6}$/.test(hex)
          return (
            <div key={t} className="flex h-8 items-center gap-2 text-[11px] leading-none tabular-nums">
              <span className="w-4 text-right text-(--v3-text-2)">{i + 1}</span>
              <Avatar name={TONE_PEOPLE[i]!} tone={t} />
              <span className="flex flex-1 items-baseline gap-1.5">
                <span className="text-[12px] text-(--v3-text)">{t}</span>
                <span className="text-(--v3-text-2)">{hex}</span>
              </span>
              <span className="w-9 text-right text-(--v3-text)">{ok ? ratio(hex, "#FFFFFF") : ""}</span>
              <span className="w-9 text-right text-(--v3-text)">{ok && canvas ? ratio(hex, canvas) : ""}</span>
              <span className="w-9 text-right text-(--v3-text)">{ok && panel ? ratio(hex, panel) : ""}</span>
            </div>
          )
        })}
      </Section>
      {/* toneOf 是单人的稳定哈希色；同屏一组人用 assignTones，撞色顺延到下一个未占用的索引（05 §2）：u-sun 与 u-liu 同为 clay，顺延到 mist */}
      <Section title="toneOf(id) → assignTones(ids)">
        {SAMPLE_IDS.map((id, i) => (
          <StaticRow key={id} label={id}>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <Avatar name={id} tone={toneOf(id)} size={16} />
              {toneOf(id)}
              <span className="text-(--v3-text-2)">→</span>
              <Avatar name={id} tone={SAMPLE_TONES[i]!} size={16} />
              {SAMPLE_TONES[i]}
            </span>
          </StaticRow>
        ))}
      </Section>
    </>
  )
}

/** 12 个远端光标的位置（4 列 × 3 行；Tailwind 类名要写全才扫描得到） */
const CURSOR_AT = [
  "left-[8%] top-[22%]", "left-[31%] top-[22%]", "left-[54%] top-[22%]", "left-[77%] top-[22%]",
  "left-[8%] top-[47%]", "left-[31%] top-[47%]", "left-[54%] top-[47%]", "left-[77%] top-[47%]",
  "left-[8%] top-[72%]", "left-[31%] top-[72%]", "left-[54%] top-[72%]", "left-[77%] top-[72%]",
]

/** 12 个远端光标与名签（白纸面上的身份色） */
function KitToneCursors() {
  return (
    <>
      {TONES.map((t, i) => (
        <RemoteCursor key={t} at={CURSOR_AT[i]!} name={TONE_PEOPLE[i]} tone={t} />
      ))}
    </>
  )
}

/** 画布底上的 12 个头像（暗 / 亮 canvas 上的身份色） */
function KitToneStrip() {
  return (
    <div className="pointer-events-none absolute top-4 left-6 flex items-center gap-2" aria-label="身份色 12 色（画布底）">
      {TONES.map((t, i) => (
        <Avatar key={t} name={TONE_PEOPLE[i]!} tone={t} />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ 场景 */

export default defineScenario({
  id: "_kit",
  title: "共享底座组件示例",
  specs: [],
  summary: "每个状态演示一个 kit 组件，供各场景照抄",
  states: [
    {
      id: "popover-toolbar",
      title: "弹层 · 锚在工具条按钮上",
      note: "Popover anchor=\"tool-table\"：向上居中、离工具条 8px；对应工具设为当前（强调色底）",
      editor: { toolbar: { tool: "table" }, layers: <Popover anchor="tool-table" label="插入表格" className="p-2"><TableGridPicker initial={{ r: 3, c: 4 }} /></Popover> },
    },
    {
      id: "popover-inspector",
      title: "弹层 · 锚在检查器控件上",
      note: "Popover anchor=\"fill-color\"：贴检查器左缘向左展开，与控件顶端对齐；内容为 SwatchPicker + ColorField",
      editor: { selection: "shape", layers: <Popover anchor="fill-color" label="填充颜色" className="p-0"><FillPicker /></Popover> },
    },
    {
      id: "menu",
      title: "菜单 · 子菜单 / 勾选 / 单选 / 不可用原因",
      note: "Menu anchor=\"tool-more\" openPath=[\"header-footer\"]：分组标题、P2 标记与不可用原因、快捷键、子菜单里的勾选与单选",
      editor: { layers: <Menu anchor="tool-more" label="更多插入" openPath={["header-footer"]} items={MORE_ITEMS} /> },
    },
    {
      id: "context-menu",
      title: "右键菜单 · 选中形状",
      note: "ContextMenu at={{ anchor: \"slide\", x, y }}：在幻灯片上右键也会在指针处重开；危险项在末尾",
      editor: {
        selection: "shape",
        stage: { cursor: false },
        layers: <ContextMenu at={{ anchor: "slide", x: 0.86, y: 0.6 }} openPath={["arrange"]} label="形状" items={SHAPE_CONTEXT} />,
      },
    },
    {
      id: "dialog",
      title: "对话框 · 标题栏 + 正文 + 底栏",
      note: "Dialog：12px 圆角、panel 底、浮层阴影，标题栏 40（标题 13px 600、× 正文色），底部次 / 主按钮（rulings §4.25 DS-142，2026-10-23 按 Figma 统一：原标题栏 48、圆角 8、× 次要文字色）",
      editor: {
        layers: (
          // 与真实的页眉和页脚对话框（insert.header-footer）同一构成：底栏左侧写清作用范围，右侧 取消 · 应用 · 全部应用（都用 LayerClose 关闭）
          <Dialog
            title="页眉和页脚"
            footerStart={<span className="text-[12px] leading-4 text-(--v3-text-2)">应用：所选 1 页 · 全部应用：6 页</span>}
            footer={
              <>
                <LayerClose>
                  <Button variant="secondary">取消</Button>
                </LayerClose>
                <LayerClose>
                  <Button variant="secondary">应用</Button>
                </LayerClose>
                <LayerClose>
                  <Button variant="primary">全部应用</Button>
                </LayerClose>
              </>
            }
          >
            <div className="flex flex-col gap-1">
              <CheckRow label="日期和时间" defaultChecked />
              <div className="mb-2 grid grid-cols-[1fr_1fr] gap-2 pl-6">
                <div role="radiogroup" aria-label="日期更新方式" className="flex items-center gap-3">
                  <RadioRow checked label="自动更新" />
                  <RadioRow checked={false} label="固定" />
                </div>
                <MenuField aria="日期格式" items={["2026/10/5", "2026 年 10 月 5 日", "10 月 5 日 星期一"]} defaultValue="2026 年 10 月 5 日" />
              </div>
              <CheckRow label="幻灯片编号" defaultChecked />
              <CheckRow label="页脚" defaultChecked />
              <div className="mb-2 pl-6">
                <TextField aria="页脚文字" defaultValue="2026 年 Q2 业绩汇报" />
              </div>
              <CheckRow label="标题幻灯片中不显示" defaultChecked />
            </div>
          </Dialog>
        ),
      },
    },
    {
      id: "dialog-confirm",
      title: "对话框 · 危险操作确认",
      note: "Dialog variant=\"confirm\"：无分隔线与关闭钮，主按钮 danger",
      editor: {
        layers: (
          <Dialog
            variant="confirm"
            title="删除版式「仅标题」？"
            description={
              <>
                有 4 页正在使用这个版式，删除后这些页改用<span className="whitespace-nowrap">「标题和内容」</span>。删除后可以撤销。
              </>
            }
            secondary={{ label: "取消" }}
            primary={{ label: "删除", danger: true }}
          />
        ),
      },
    },
    {
      id: "floating-panel",
      title: "画布浮动面板 · 查找与替换",
      note: "FloatingPanel 放在 canvasOverlay（画布右上、让开横幅）；命中项用 HoverBox 画在 slideOverlay",
      editor: {
        slide: 4,
        stage: { cursor: false },
        canvasOverlay: <KitFindPanel />,
        slideOverlay: (
          <>
            <HoverBox fill box={{ x: 6.6, y: 10.6, w: 9.8, h: 10.6 }} />
            <HoverBox box={{ x: 11.4, y: 28.4, w: 5.7, h: 6.2 }} />
          </>
        ),
      },
    },
    {
      id: "toast",
      title: "轻提示",
      note: "Toasts + Toast 放在 canvasOverlay：底部工具条上方居中；中性 / 成功带撤销 / 错误带关闭",
      editor: {
        canvasOverlay: (
          <Toasts>
            <Toast action="撤销">
              已应用主题「商务」
            </Toast>
            <Toast tone="error" onClose={() => undefined}>
              无法粘贴：剪贴板里的内容格式不受支持
            </Toast>
            <Toast>已复制 2 个对象</Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "banner-info",
      title: "横幅 · 信息",
      note: "Banner tone=\"info\"：中性 panel 底",
      editor: {
        banner: (
          <Banner title="正在查看历史版本" actions={<Button variant="secondary">恢复此版本</Button>} onClose={() => undefined}>
            9 月 28 日 14:32 · 王小明保存
          </Banner>
        ),
      },
    },
    {
      id: "banner-warning",
      title: "横幅 · 警告",
      note: "Banner tone=\"warning\"：警告色浅底，与查找浮动条同时出现时浮动条自动下移",
      editor: {
        banner: (
          // 与真实的离线横幅（main-states.offline）同一文案与动作
          <Banner tone="warning" title="离线" actions={<Button variant="secondary">立即重连</Button>}>
            更改已保存在本地，将在重新连接后同步
          </Banner>
        ),
        canvasOverlay: <KitFindPanel />,
      },
    },
    {
      id: "banner-error",
      title: "横幅 · 错误",
      note: "Banner tone=\"error\"：危险色浅底",
      editor: {
        banner: (
          // 错误横幅只给真正的失败（缺插件是警告，见 main-states.plugin-missing）：这里用保存失败
          <Banner tone="error" title="保存失败" actions={<Button variant="secondary">重试</Button>} onClose={() => undefined}>
            最近 2 处更改还没有保存到服务器，已保留在本地
          </Banner>
        ),
      },
    },
    {
      id: "controls",
      title: "检查器控件",
      note: "NumberField（普通 / 多个值 / 校验错误 / 不可用原因）、SliderField、ColorField、SwatchPicker、Segmented、CheckRow、PropRow、FoldSection、TextField、InspectorNotice",
      editor: {
        selection: "_kit-controls",
        inspector: { notice: <InspectorNotice>继承自版式「标题和内容」，改过的字段只影响本页</InspectorNotice> },
      },
    },
    {
      id: "canvas",
      title: "画布叠加件",
      note: "SelectionBox（八个手柄 + 尺寸）、Marquee 框选、Guide 参考线与间距、CanvasTag 提示",
      editor: {
        slide: 3,
        selection: "shape",
        stage: { cursor: false },
        slideOverlay: (
          <>
            <Guide orientation="h" at={33.78} from={4} to={96} />
            <Guide orientation="h" at={58.2} from={33.667} to={36.667} label="29" />
            <SelectionBox box={{ x: 36.667, y: 33.78, w: 26.667, h: 48.89 }} handles="all" label="256 × 264" />
            <Marquee box={{ x: 62, y: 28, w: 33, h: 40 }} />
            <CanvasTag box={{ x: 36.667, y: 90 }}>按住 Shift 等比缩放 · Alt 从中心</CanvasTag>
          </>
        ),
      },
    },
    {
      id: "deck",
      title: "自定义页 · 表格页",
      note: "deckWith 替换第 3 页（左栏缩略图同步）；_kit-table 种类的分区。对象不设上下文 / 迷你工具条（DS-13、DS-22），表格的命令在检查器、右键与命令面板；FloatingBar 只用作裁剪模式的出口（「取消 / 完成」，见 image-editing.crop）",
      editor: {
        deck: deckWith({ 3: { name: "季度明细", render: () => <QuarterTableSlide /> } }),
        slide: 3,
        selection: "_kit-table",
        stage: { cursor: false },
        slideOverlay: <SelectionBox box={TABLE_BOX} label="826 × 259" />,
      },
    },
    {
      id: "comments-body",
      title: "评论页签插槽",
      note: "inspector.commentsBody 换掉「评论」页签的内容（外框、页签行、缩放仍是底座的）；容器是占满滚动区的纵向 flex，回复框 mt-auto 贴底；作者头像按用户 id 取色（toneOf）。只示结构，评论的视觉与条目由评论场景（03-06）定稿",
      editor: { slide: 4, stage: { cursor: false }, inspector: { tab: "comments", commentsBody: <KitCommentsBody /> } },
    },
    {
      id: "takeover",
      title: "检查器整栏面板",
      note: "inspector.takeover = <InspectorTakeover>（DS-26 先例：图表「编辑数据」）：检查器栏临时加宽到 400、整栏换成面板，协作行不动，页签行换成标题行（说明 · 关闭 Esc）；关闭后检查器回到常规页签，画布左上角的按钮用 useTakeoverOpen() 再打开",
      editor: { stage: { cursor: false }, inspector: { takeover: <KitTakeover /> }, canvasOverlay: () => <KitTakeoverReopen /> },
    },
    {
      id: "tones",
      title: "身份色 · 12 色",
      note: "PRD CO-03 的 12 色板（前 5 色第 1 批定稿，后 7 色第 2 批补足，rulings §4.25 DS-42 定稿）：检查器列出哈希顺序、取值与对比度（白字 / 当前主题画布 / 面板），画布底一排头像、幻灯片上 12 个远端光标与名签；toneOf(userId) 稳定取色",
      editor: {
        stage: { cursor: false },
        panels: { inspector: 320 },
        inspector: { body: <KitTonesBody /> },
        canvasOverlay: <KitToneStrip />,
        slideOverlay: <KitToneCursors />,
      },
    },

    /* ---------------------------------------------------------------- 第 3 批新件（页面级宿主，state 的 host 覆盖本场景的 editor） */
    {
      id: "shell",
      host: "documents",
      title: "应用壳 · 横幅在顶栏之下",
      note: "kit ShellLayout（由已拍板首页抽出：左栏 220 + 顶栏 56，第 3 批应用壳页面同一个壳）：page.shell 给当前导航项、标题、右侧按钮、横幅；横幅通道 bannerAt main（rulings §4.25 DS-92：主区顶栏之下、只横跨主区，导航不动）；body 是主区内容（这里是列表头 + DocumentCard 网格，第一张卡片的「⋯」菜单开着）；overlay 画在主区里（kit Toasts bottom 24，应用壳没有底部工具条）。横幅高 40（DS-75）",
      page: {
        shell: { current: "recent", title: "最近", banner: <KitShellBanner /> },
        body: <KitShellBody />,
        overlay: <KitShellToasts />,
        data: { menuOpen: true },
      },
    },
    {
      id: "shell-banner-top",
      host: "documents",
      title: "应用壳 · 横幅在顶栏之上（备选位置）",
      note: "同 shell，bannerAt top：横幅放主区最顶、顶栏之上（DS-92 未采纳的备选，admin-plugins.alt-banner-top 用它）；列表视图",
      page: {
        shell: { current: "recent", title: "最近", banner: <KitShellBanner />, bannerAt: "top" },
        body: <KitShellBody />,
        data: { view: "list" },
      },
    },
    {
      id: "document-card",
      host: "documents",
      title: "文档卡片的插槽",
      note: "kit DocumentCard（首页最近、文档列表、回收站同一个件，DS-81）：画法与文档组 DocCard、开始页 M2 首页（home.m2-default）逐像素相同；第二行「编辑者 · 相对时间」（DS-83）；menu「⋯」（网格浮在封面右上、列表在行尾，悬停 / 焦点 / 菜单开着时出现）· badge 封面左上小标 · trailing 换掉右下的共享头像 · meta 换掉第二行 · inert 不能打开（回收站，DS-85）· cover null 的占位（白纸面 + 居中 24px Presentation，同尺寸，不是骨架）。上一行网格、下一行列表（2026-10-22 按 rulings §4.25 DS-81、DS-83 改：并入 DocCard 的画法与能力，原无封面占位为 panel-2 底 + 文档图标、第二行带「编辑」二字）",
      page: { shell: { current: "mine", title: "我的文档" }, body: <KitCardsBody /> },
    },
    {
      id: "account-menu-shell",
      host: "home",
      title: "账户菜单 · 开始页用户行",
      note: "kit ShellLayout accountMenuOpen：左栏底部用户行的账户菜单一出现就打开（向上、左对齐，DS-18）；条目是 accountMenuItems（开始页、编辑器、文档列表同一份；第 3 批按角色与里程碑增减的条目由 account-menu 场景用 accountMenuItems 传入）：M2 不显示「个人资料…」与它下面的分隔线（DS-91），主题三项「浅色 / 深色 / 跟随系统」（DS-90），偏好设置… ⌘, · 键盘快捷键 ⌘/ · 配置了才出现的「帮助中心」（DS-89）· 退出登录。body 缺省是已拍板首页，2026-10-22 起即开始页 M2 的画法（home.m2-default：左栏 5 项含回收站 DS-79、M2 不显示「更多模板 →」）（2026-10-22 按 rulings §4.25 DS-79、DS-89、DS-90、DS-91 改）",
      page: { shell: { accountMenuOpen: true } },
    },
    {
      id: "blocking-page",
      host: "page",
      title: "阻断页 · 整屏宿主",
      note: "kit BlockingPage（由第 1 批「打开失败」页提升，main-states/panels OpenFailedPage 转出同一份）在 #/v3/page 整屏宿主里：图标 · context 上方一行 · 标题 · 说明 · notice 主按钮上方的内联错误（如登录失败，DS-120）· actions · hint 按钮下方的弱提示（如登录页「没有账号？」，DS-119）。文案只为演示插槽",
      page: { body: <KitBlockingBody /> },
    },
    {
      id: "drawer",
      host: "documents",
      title: "抽屉 · 模态",
      note: "kit Drawer：右侧贴边整高、宽 480、遮罩、焦点圈定（rulings §4.25 DS-94：管理员插件详情；DS-113 未采纳的设置抽屉 320 同一个件）；标题行 40 + × 关闭（Esc，× 正文色；与对话框标题栏同一画法，DS-142），正文滚动，可选底栏",
      page: { shell: { current: "recent", title: "最近" }, body: <KitShellBody />, layers: <KitDrawer /> },
    },
    {
      id: "drawer-nonmodal",
      host: "documents",
      title: "抽屉 · 非模态",
      note: "kit Drawer modal={false}：没有遮罩、不圈定焦点，背后的页面照常可点（点外面不关），Esc（焦点在抽屉里）与 × 关闭（DS-94 未采纳的备选，admin-plugins.alt-drawer-nonmodal）",
      page: { shell: { current: "recent", title: "最近" }, body: <KitShellBody />, layers: <KitDrawer modal={false} /> },
    },
    {
      id: "embed",
      host: "embed",
      title: "嵌入 · 宿主外框与 iframe 容器",
      note: "#/v3/embed 宿主（DS-73）：中性的「宿主页面」外框（只是演示容器，不代表任何真实产品）+ iframe 容器（page.embed.size，URL 参数 frame=宽x高 临时改）；iframe 加载同一个 playground 的别的宿主路由（这里是编辑器 narrow.compact，紧凑形态），带 embedded=1，主题与强调色沿用外层，视口就是容器尺寸",
      page: { embed: { size: [960, 600], src: { host: "editor", state: "narrow.compact" } } },
    },
  ],
})
