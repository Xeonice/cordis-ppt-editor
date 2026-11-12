import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { boxStyle, px, type Box } from "../../kit/canvas"
import { SlideFooter, SlideFrame } from "../../SlideArt"
import { masterOf, themeOf, type LayoutKind, type MasterId } from "./data"

/**
 * 母版与版式的真实渲染（Q8：缩略图与画布都是同一份 16:9 渲染，不用骨架条）——底座唯一的一份：
 * 版式画廊卡片（新建幻灯片 03-14 / 更换版式 03-27）、检查器「版式」字段的缩略、新建的空白页、母版视图（03-26）都用它。
 * 占位符按 960 × 540 设计坐标落位（px() 换成百分比），字号、线宽一律 cqw，32px 字段缩略、190px 卡片与 1000px 画布长得一样。
 * 标题按母版的标题样式画字形（字号、字重、对齐、主题字体与配色），画廊里一眼看出是哪个母版的版式。
 * prompts 决定占位符怎么画（canvas / thumb 两种见 LayoutArt 的说明）：
 *   master（缺省）：母版 / 版式定义本身——提示文字「单击此处编辑母版标题样式」；版式范围下从母版继承来的页脚、日期、页码画虚线（03-26 §4「虚线 = 继承自母版」）。
 *          原是普通视图版式画廊、检查器「版式」字段与重置确认的缩略画法；这三处改用 thumb（rulings §4.25 DS-149）之后没有调用方，样张里留着，产品迁移不带。
 *   slide：用这个版式新建的页（画布上）——空占位符的虚线框 + 灰色提示「单击此处添加标题」（03-16，不计字数、不导出），页脚是文档的真实页脚。
 *   none：同一页在缩略图、网格与放映里——空占位符不显示，只剩母版图形与页脚（同 PowerPoint）。
 * 颜色全部来自 .v3-slide 的 --s-* 内容 token；「简约」母版包在 mt-theme-minimal 里，换成内置主题「简约」的配色（data.ts THEME_CSS，rulings §4.25 DS-33）。
 */

/** 占位符类型；picture（图片占位符）2026-10-30 第二步随新文档的「图片与标题」版式加（场景自带的「内容与图片」「两栏内容与图片」也有），只在 canvas / thumb 画法里出现 */
export type PhType = "title" | "cover-title" | "subtitle" | "body" | "header" | "section-title" | "section-text" | "footer" | "date" | "number" | "picture"

export interface PhDef {
  /** 在一个版式里唯一：title、body、body-2、footer… */
  id: string
  type: PhType
  box: Box
  /** 产品化名称：「标题占位符」「内容占位符」「页脚占位符」 */
  label: string
  /** OOXML 占位符索引（检查器只读显示） */
  idx: number
  /** 从母版继承（版式里的页脚、日期、页码） */
  inherited?: boolean
  /** 正文显示几级大纲（缺省 3） */
  levels?: number
  /** 居中排版（简约母版的标题） */
  center?: boolean
  /**
   * 只给 canvas / thumb 画法读的输入（2026-10-30，第二步规格 §3.2.8；master / slide / none 画法不看）：
   * 这个占位符第 1 级 / 标题的字号（pt）。正文各级的字号、缩进、段距按 textPt ÷ 第 1 级缺省字号同比缩小；标题族给了它就是说明类标题，字重 600
   */
  textPt?: number
  /** 只给 canvas / thumb 画法读：竖排（从右往左成列，缩进与整段取舍都按逻辑方向写） */
  vertical?: boolean
}

export type Target = LayoutKind | "master"

/* ------------------------------------------------------------------ 占位符布局 */

const OFFICE = {
  title: px(60, 50, 840, 70),
  body: px(60, 156, 840, 300),
  footer: px(60, 486, 400, 26),
  date: px(470, 486, 160, 26),
  number: px(780, 486, 120, 26),
}
const SIMPLE = {
  title: px(80, 40, 800, 70),
  body: px(80, 146, 800, 304),
  footer: px(80, 486, 480, 26),
  number: px(780, 486, 100, 26),
}

const ph = (id: string, type: PhType, box: Box, label: string, idx: number, extra: Partial<PhDef> = {}): PhDef => ({ id, type, box, label, idx, ...extra })

function officeFooters(inherited: boolean): PhDef[] {
  return [
    ph("footer", "footer", OFFICE.footer, "页脚占位符", 11, { inherited }),
    ph("date", "date", OFFICE.date, "日期占位符", 10, { inherited }),
    ph("number", "number", OFFICE.number, "页码占位符", 12, { inherited }),
  ]
}
function simpleFooters(inherited: boolean): PhDef[] {
  return [ph("footer", "footer", SIMPLE.footer, "页脚占位符", 11, { inherited }), ph("number", "number", SIMPLE.number, "页码占位符", 12, { inherited })]
}

/**
 * 某个母版或版式上的全部占位符（画布叠加层与检查器用同一份数据）。
 * 母版上的正文区是「文本占位符」（与母版检查器的「文本」勾选项、插入占位符菜单的类型同一个名字，rulings §4.25 TB-34、DS-30；原写「正文」作废），
 * 版式里放文字、表格、图表、图片的是「内容占位符」。
 */
export function placeholdersFor(master: MasterId, target: Target): PhDef[] {
  if (master === "simple") {
    const t = ph("title", "title", SIMPLE.title, "标题占位符", 0, { center: true })
    switch (target) {
      case "master":
        return [t, ph("body", "body", SIMPLE.body, "文本占位符", 1, { levels: 5 }), ...simpleFooters(false)]
      case "title":
        return [ph("title", "cover-title", px(80, 190, 800, 90), "标题占位符", 0, { center: true }), ph("subtitle", "subtitle", px(180, 292, 600, 44), "副标题占位符", 1, { center: true })]
      case "title-only":
        return [t, ...simpleFooters(true)]
      case "blank":
        return simpleFooters(true)
      default:
        return [t, ph("body", "body", SIMPLE.body, "内容占位符", 1), ...simpleFooters(true)]
    }
  }
  const t = ph("title", "title", OFFICE.title, "标题占位符", 0)
  switch (target) {
    case "master":
      return [t, ph("body", "body", OFFICE.body, "文本占位符", 1, { levels: 5 }), ...officeFooters(false)]
    case "title":
      return [ph("title", "cover-title", px(96, 166, 760, 96), "标题占位符", 0), ph("subtitle", "subtitle", px(96, 276, 600, 48), "副标题占位符", 1)]
    case "title-content":
      return [t, ph("body", "body", OFFICE.body, "内容占位符", 1), ...officeFooters(true)]
    case "two-content":
      return [t, ph("body", "body", px(60, 156, 408, 300), "内容占位符", 1, { levels: 2 }), ph("body-2", "body", px(492, 156, 408, 300), "内容占位符", 2, { levels: 2 }), ...officeFooters(true)]
    case "comparison":
      return [
        t,
        ph("header", "header", px(60, 156, 408, 44), "文本占位符", 1),
        ph("body", "body", px(60, 208, 408, 248), "内容占位符", 2, { levels: 2 }),
        ph("header-2", "header", px(492, 156, 408, 44), "文本占位符", 3),
        ph("body-2", "body", px(492, 208, 408, 248), "内容占位符", 4, { levels: 2 }),
        ...officeFooters(true),
      ]
    case "title-only":
      return [t, ...officeFooters(true)]
    case "section":
      return [ph("title", "section-title", px(60, 200, 840, 84), "标题占位符", 0), ph("text", "section-text", px(60, 300, 840, 44), "文本占位符", 1), ...officeFooters(true)]
    case "blank":
      return officeFooters(true)
    // 以下 4 种只在新文档的缺省母版里（data.ts NEW_DOC_MASTERS；第二步规格 §3.2.8 给的框，竖排两种的高收短到页脚之上，以画面不重叠为准）：
    // 说明类标题 20 pt、说明文字 14 pt（textPt，canvas / thumb 画法按它同比缩小），竖排的标题与正文 vertical
    case "content-caption":
      return [
        ph("title", "title", px(66, 36, 316, 126), "标题占位符", 0, { textPt: 20 }),
        ph("body", "body", px(415, 78, 480, 384), "内容占位符", 1),
        ph("text", "body", px(66, 162, 316, 300), "文本占位符", 2, { textPt: 14 }),
        ...officeFooters(true),
      ]
    case "picture-caption":
      return [
        ph("title", "title", px(66, 36, 316, 126), "标题占位符", 0, { textPt: 20 }),
        ph("picture", "picture", px(415, 78, 480, 384), "图片占位符", 1),
        ph("text", "body", px(66, 162, 316, 300), "文本占位符", 2, { textPt: 14 }),
        ...officeFooters(true),
      ]
    case "title-vertical":
      return [ph("title", "title", px(60, 29, 840, 104), "标题占位符", 0), ph("body", "body", px(60, 144, 840, 336), "内容占位符", 1, { vertical: true }), ...officeFooters(true)]
    case "vertical-title":
      return [
        ph("title", "title", px(687, 29, 213, 450), "标题占位符", 0, { vertical: true }),
        ph("body", "body", px(60, 29, 615, 450), "内容占位符", 1, { vertical: true }),
        ...officeFooters(true),
      ]
    // 以下 2 种只在场景自带的母版里（text-edit 第 7 页用的两个版式，data.ts LayoutKind）：框与索引取 text-edit 第 7 页画面上的占位符
    // （标题 840 × 72；「内容与图片」左内容 540 宽、右图片 276 宽；「两栏内容与图片」三栏各 264 宽），不另定数。
    // 「内容与图片」左内容的高取版式值 348：第 7 页上这一框的高在本页改成了 360，检查器「位置与大小」写着「H 在本页改过（版式值 348）」（设计 03-16 §1.2）
    case "content-picture":
      return [
        ph("title", "title", px(60, 36, 840, 72), "标题占位符", 0),
        ph("body", "body", px(60, 124, 540, 348), "内容占位符", 1),
        ph("picture", "picture", px(624, 124, 276, 360), "图片占位符", 2),
        ...officeFooters(true),
      ]
    case "two-content-picture":
      return [
        ph("title", "title", px(60, 36, 840, 72), "标题占位符", 0),
        ph("body", "body", px(60, 124, 264, 360), "内容占位符", 1),
        ph("body-2", "body", px(348, 124, 264, 360), "内容占位符", 2),
        ph("picture", "picture", px(636, 124, 264, 360), "图片占位符", 3),
        ...officeFooters(true),
      ]
  }
}

/* ------------------------------------------------------------------ 渲染 */

const LEVELS = [
  { text: "单击此处编辑母版文本样式", cls: "text-[3cqw] font-medium text-(--s-ink)", pad: "" },
  { text: "二级", cls: "text-[2.5cqw] text-(--s-body)", pad: "pl-[3.2cqw]" },
  { text: "三级", cls: "text-[2.1cqw] text-(--s-body)", pad: "pl-[6.4cqw]" },
  { text: "四级", cls: "text-[1.9cqw] text-(--s-mute)", pad: "pl-[9.6cqw]" },
  { text: "五级", cls: "text-[1.7cqw] text-(--s-mute)", pad: "pl-[12.8cqw]" },
]

/**
 * LEVELS 的数值表（2026-10-30，第二步规格 §2.2）：字号与缩进（cqw）与上面 LEVELS 的字面量类名逐项相同，行高与段距取 master 画法正文那一段的写法
 * （每行 1.2 倍、段与段之间 1.5cqw）。canvas / thumb 画法用它写行内样式（覆盖字号、按 textPt 同比缩小都要算数），检查器的级别样式也从它换算（PT_PER_CQW）。
 * LEVELS 本身原样不动：Tailwind 只认源码里完整写出来的类名，用数值拼出来的类名扫不到，master 画法会掉样式。
 * 两张表是否一致由第二步的检查脚本读源码自检（逐级比字号、缩进、行高与段距，不一致退出码 1）
 */
export const LEVELS_META: { cqw: number; padCqw: number; lineHeight: number; gapCqw: number }[] = [
  { cqw: 3, padCqw: 0, lineHeight: 1.2, gapCqw: 1.5 },
  { cqw: 2.5, padCqw: 3.2, lineHeight: 1.2, gapCqw: 1.5 },
  { cqw: 2.1, padCqw: 6.4, lineHeight: 1.2, gapCqw: 1.5 },
  { cqw: 1.9, padCqw: 9.6, lineHeight: 1.2, gapCqw: 1.5 },
  { cqw: 1.7, padCqw: 12.8, lineHeight: 1.2, gapCqw: 1.5 },
]

/** 960 pt 宽的幻灯片上 1cqw = 9.6 pt（覆盖字号、textPt 与检查器字段的换算） */
export const PT_PER_CQW = 9.6

function PhContent({ def }: { def: PhDef }) {
  switch (def.type) {
    case "title":
      return <p className={cn("w-full px-[0.75cqw] text-[4.6cqw] leading-[1.2] font-bold tracking-[-0.01em] whitespace-nowrap", def.center && "text-center")}>单击此处编辑母版标题样式</p>
    case "cover-title":
      return <p className={cn("w-full px-[0.75cqw] text-[5.6cqw] leading-[1.2] font-bold tracking-[-0.015em] whitespace-nowrap", def.center && "text-center")}>单击此处编辑母版标题样式</p>
    case "section-title":
      return <p className="w-full px-[0.75cqw] text-[5.2cqw] leading-[1.2] font-bold tracking-[-0.01em] whitespace-nowrap">单击此处编辑母版标题样式</p>
    case "subtitle":
      return <p className={cn("w-full px-[0.75cqw] text-[2.6cqw] leading-[1.3] whitespace-nowrap text-(--s-body)", def.center && "text-center")}>单击此处编辑母版副标题样式</p>
    case "section-text":
      return <p className="w-full px-[0.75cqw] text-[2.4cqw] leading-[1.3] whitespace-nowrap text-(--s-body)">单击此处编辑母版文本样式</p>
    case "header":
      return <p className="w-full px-[0.75cqw] text-[2.4cqw] leading-[1.2] font-semibold whitespace-nowrap">单击此处编辑文本</p>
    case "body":
      return (
        <div className="flex w-full flex-col gap-[1.5cqw] self-start px-[0.75cqw] pt-[1.2cqw]">
          {LEVELS.slice(0, def.levels ?? 3).map((lv) => (
            <p key={lv.text} className={cn("flex items-baseline gap-[1cqw] leading-[1.2] whitespace-nowrap", lv.cls, lv.pad)}>
              <span aria-hidden="true" className="text-(--s-brand)">
                •
              </span>
              {lv.text}
            </p>
          ))}
        </div>
      )
    case "footer":
      return <p className="w-full px-[0.75cqw] text-[1.4cqw] leading-none whitespace-nowrap text-(--s-mute)">2026 年 Q2 业绩汇报</p>
    case "date":
      return <p className="w-full px-[0.75cqw] text-center text-[1.4cqw] leading-none whitespace-nowrap text-(--s-mute) tabular-nums">2026/10/5</p>
    case "number":
      return <p className="w-full px-[0.75cqw] text-right text-[1.4cqw] leading-none whitespace-nowrap text-(--s-mute)">‹#›</p>
  }
}

/** 一个占位符框：提示文字 + 细边框（版式范围下继承来的为虚线）。 */
function Placeholder({ def }: { def: PhDef }) {
  return (
    <div
      className={cn(
        "absolute flex items-center overflow-hidden border-[0.12cqw] border-(--s-mute)/45",
        def.inherited ? "border-dashed" : "border-solid",
      )}
      style={boxStyle(def.box)}
    >
      <PhContent def={def} />
    </div>
  )
}

/**
 * 新建页内容占位符的提示（下面 SlidePrompt 里 body 那一段：「• 单击此处添加文本」「– 第二级」两行）的数值表（cqw；行高是倍数）：
 * 框顶的上内距、两行的字号、行高与两行之间的空，与那一段的字面量类名逐项相同（同 LEVELS_META 的做法：类名照写字面量，样式表才扫得到）。
 * 排在提示之下的件（如母版视图场景 goto-layout 的快速插入图标条）按它算位置，不另写数。
 * 改 SlidePrompt body 段的类名时同改这张表（两处不会自己对齐：只改类名，图标条的位置会悄悄偏）
 */
export const SLIDE_BODY_PROMPT_META: { padTopCqw: number; lineCqw: number[]; lineHeight: number; gapCqw: number } = { padTopCqw: 1.4, lineCqw: [2.6, 2.2], lineHeight: 1.3, gapCqw: 1.2 }

/** 新建页上的空占位符（prompts = slide）：虚线框 + 灰色提示文字，字号与母版样式一致。 */
function SlidePrompt({ def }: { def: PhDef }) {
  const center = def.center && "justify-center text-center"
  let body: ReactNode
  switch (def.type) {
    case "title":
      body = <p className={cn("w-full px-[0.75cqw] text-[4.6cqw] leading-[1.2] font-bold whitespace-nowrap", center)}>单击此处添加标题</p>
      break
    case "cover-title":
      body = <p className={cn("w-full px-[0.75cqw] text-[5.6cqw] leading-[1.2] font-bold whitespace-nowrap", center)}>单击此处添加标题</p>
      break
    case "section-title":
      body = <p className="w-full px-[0.75cqw] text-[5.2cqw] leading-[1.2] font-bold whitespace-nowrap">单击此处添加标题</p>
      break
    case "subtitle":
      body = <p className={cn("w-full px-[0.75cqw] text-[2.6cqw] leading-[1.3] whitespace-nowrap", center)}>单击此处添加副标题</p>
      break
    case "header":
    case "section-text":
      body = <p className="w-full px-[0.75cqw] text-[2.4cqw] leading-[1.3] whitespace-nowrap">单击此处添加文本</p>
      break
    case "body":
      body = (
        <div className="flex w-full flex-col gap-[1.2cqw] self-start px-[1.4cqw] pt-[1.4cqw] text-[2.6cqw] leading-[1.3] whitespace-nowrap">
          <p>• 单击此处添加文本</p>
          <p className="pl-[2.6cqw] text-[2.2cqw]">– 第二级</p>
        </div>
      )
      break
    default:
      return null
  }
  return (
    <div className="absolute flex items-center overflow-hidden border-[0.16cqw] border-dashed border-(--s-mute)/70 text-(--s-mute)" style={boxStyle(def.box)}>
      {body}
    </div>
  )
}

/** 页脚、日期、页码三种占位符：新建页上画文档的真实页脚（SlideFooter），不画占位符框 */
const FOOTER_TYPES: PhType[] = ["footer", "date", "number"]

/**
 * 母版上的图形（不是占位符）：Office 是标题下的品牌色短线 / 封面左侧竖条，简约是标题下的一条细线。
 * mark（只有 canvas 画法传）：带 data-mv-graphic，母版视图标注层的类型名避让读它；其余画法不传，输出一字不变
 */
function MasterGraphics({ master, target, mark }: { master: MasterId; target: Target; mark?: boolean }) {
  const g = mark ? "" : undefined
  if (master === "simple") {
    if (target === "title" || target === "blank") return null
    return <div aria-hidden="true" data-mv-graphic={g} className="absolute top-[12.4cqw] right-[8.3cqw] left-[8.3cqw] h-[0.12cqw] bg-(--s-line)" />
  }
  if (target === "title") return <div aria-hidden="true" data-mv-graphic={g} className="absolute top-[17.6cqw] left-[7cqw] h-[10cqw] w-[1cqw] bg-(--s-brand)" />
  if (target === "section") return <div aria-hidden="true" data-mv-graphic={g} className="absolute top-[18.6cqw] left-[7cqw] h-[0.55cqw] w-[4.2cqw] bg-(--s-brand)" />
  if (target === "blank") return null
  // 新文档的 4 种版式（只在 canvas / thumb 画法里出现）：标题下没有放短线的空当（说明类标题紧挨说明文字、竖排标题在右侧），不画；
  // 场景自带的 2 种（内容与图片、两栏内容与图片）同样：标题框下沿离内容框只有 16 pt，text-edit 第 7 页上也没有这条短线
  if (target === "content-caption" || target === "picture-caption" || target === "title-vertical" || target === "vertical-title") return null
  if (target === "content-picture" || target === "two-content-picture") return null
  return <div aria-hidden="true" data-mv-graphic={g} className="absolute top-[13.4cqw] left-[7cqw] h-[0.55cqw] w-[4.2cqw] bg-(--s-brand)" />
}

/* ------------------------------------------------------------------ canvas / thumb 画法（2026-10-30，母版视图改版第二步规格 §2.2、§3.2.3、§3.2.8） */

/** 母版 / 版式上的普通形状（不是占位符）：两种填充取幻灯片内容 token */
export interface ArtShape {
  id: string
  box: Box
  fill: "brand" | "brand-soft"
}

/**
 * 普通形状的填充取哪个幻灯片内容 token（--s-*，随所属母版的主题换色）：画布、缩略图画形状与母版视图检查器「填充」字段的色块和色值读同一张表（Q8），
 * 不在两处各写一份（2026-10-31 core 修复 states-C1：检查器原来写的是底座示例要点卡的值）
 */
export const ART_FILL_TOKEN: Record<ArtShape["fill"], string> = { brand: "--s-brand", "brand-soft": "--s-brand-soft" }

/** 版式上覆盖的字号：哪个占位符、第几级（单段的占位符只有第 1 级）、多少 pt */
export interface ArtOverride {
  ph: string
  level: number
  size: number
}

/**
 * thumb 的框：line 一种细线（缺省，rulings §4.25 DS-149 采纳）· none 不画框 · legacy 本版式实线、继承项虚线（原画法）。
 * none 与 legacy 是未采纳的备选，只给对比场景的缩略图对照板（master-view-options.thumbs）
 */
export type ThumbFrames = "line" | "none" | "legacy"

/** 单段占位符的提示文字、字号（cqw）与外观：与 master 画法（PhContent）相同，只是允许换行（中文按字断行），放不下就整段不画 */
const ART_TEXT: Record<Exclude<PhType, "body">, { text: string; cqw: number; cls: string }> = {
  title: { text: "单击此处编辑母版标题样式", cqw: 4.6, cls: "leading-[1.2] tracking-[-0.01em]" },
  "cover-title": { text: "单击此处编辑母版标题样式", cqw: 5.6, cls: "leading-[1.2] tracking-[-0.015em]" },
  "section-title": { text: "单击此处编辑母版标题样式", cqw: 5.2, cls: "leading-[1.2] tracking-[-0.01em]" },
  subtitle: { text: "单击此处编辑母版副标题样式", cqw: 2.6, cls: "leading-[1.3] text-(--s-body)" },
  "section-text": { text: "单击此处编辑母版文本样式", cqw: 2.4, cls: "leading-[1.3] text-(--s-body)" },
  header: { text: "单击此处编辑文本", cqw: 2.4, cls: "leading-[1.2] font-semibold" },
  footer: { text: "2026 年 Q2 业绩汇报", cqw: 1.4, cls: "leading-none text-(--s-mute)" },
  date: { text: "2026/10/5", cqw: 1.4, cls: "text-center leading-none text-(--s-mute) tabular-nums" },
  number: { text: "‹#›", cqw: 1.4, cls: "text-right leading-none text-(--s-mute)" },
  // 图片占位符（新文档「图片与标题」）：提示在框的上方居中，下面空出来给画布上的图标条（同 PowerPoint 的图片占位符）
  picture: { text: "单击图标添加图片", cqw: 2.4, cls: "text-center leading-[1.2] text-(--s-body)" },
}

/** 提示文字从框顶排的单段类型（同正文）：图片占位符——框的下半给图标条 */
const TOP_TYPES: PhType[] = ["picture"]

/** 标题族：字重 700；给了 textPt（说明类标题）时 600 */
const TITLE_TYPES: PhType[] = ["title", "cover-title", "section-title"]

/** 文字离框的左右内距（同 master 画法）；正文段首离框上沿、项目符号与文字的间距 */
const TEXT_INSET_CQW = 0.75
const BODY_TOP_CQW = 1.2
const BULLET_GAP_CQW = 1

/** 每一段：整宽（逻辑方向，竖排时是整高）、不收缩、任何位置都能断行——一段横向放不下就换行，换出来的行算作这一段 */
const PARA: CSSProperties = { inlineSize: "100%", flexShrink: 0, overflowWrap: "anywhere" }

/** 哨兵：高 0、整宽，排在最前面占住第一列；连第一段都放不下时，那一段也会换到框外的第二列 */
const SENTINEL: CSSProperties = { blockSize: 0, inlineSize: "100%", flexShrink: 0 }

/** 给了 textPt 的正文按它同比缩小各级（字号、缩进、段距）：textPt ÷ 第 1 级缺省的 pt；没给时 1 */
const bodyScaleOf = (def: Pick<PhDef, "textPt">) => (def.textPt ? def.textPt / (LEVELS_META[0]!.cqw * PT_PER_CQW) : 1)

/** 正文第 level 级画多大（cqw）：覆盖字号优先，其次 LEVELS_META 按 textPt 同比缩小（artBody 与裁切边 artMaxCqw 同用） */
const bodyCqwOf = (def: PhDef, level: number, override?: ArtOverride) =>
  override && override.level === level ? override.size / PT_PER_CQW : LEVELS_META[level - 1]!.cqw * bodyScaleOf(def)

/** 单段画多大（cqw）：覆盖字号（第 1 级）优先，其次 textPt，再次 ART_TEXT 的缺省（artText 与裁切边 artMaxCqw 同用） */
const textCqwOf = (def: PhDef, override?: ArtOverride) =>
  override && override.level === 1 ? override.size / PT_PER_CQW : def.textPt ? def.textPt / PT_PER_CQW : ART_TEXT[def.type as Exclude<PhType, "body">].cqw

/** 一个占位符里最大一段的字号（cqw）：正文取各级（含覆盖）里最大的，单段取它自己 */
const artMaxCqw = (def: PhDef, override?: ArtOverride) =>
  def.type === "body" ? Math.max(...LEVELS_META.map((_, i) => bodyCqwOf(def, i + 1, override))) : textCqwOf(def, override)

/**
 * thumb 内容盒的裁切边在块方向上外扩多少（这个占位符里最大一段字号的倍数，且至少 1 px；2026-10-31 core 修复 CI-3）：
 * 极小的缩略图里中文字形的墨迹会越出行盒、压到占位符框外——实测 92 宽「标题和内容」的标题（约 4 px 字）字顶越出框约 0.1 em，
 * 照常按框裁切就切掉一行设备像素，放大的对照板与画廊里看得出字顶被削平；32 × 18 的字段缩略里页脚的字不到半个像素，按字号算的那一截不够一个像素，所以另有下限。
 * 块方向上框外没有别的东西（放不下的段整段换到行内方向的下一列），所以只在块方向外扩，行内方向仍贴着框裁，换到框外那一列的段照样整段不画。
 * 画布（canvas）尺寸下字形不越出内容盒（实测裁切开 / 关逐像素相同），不外扩
 */
const THUMB_CLIP_EM = 0.5
const THUMB_CLIP_MIN_PX = 1

/** 正文 1–5 级（canvas / thumb 一律画满 5 级，不看 PhDef.levels）：类名取 LEVELS（颜色、字重），数值取 LEVELS_META */
function artBody(def: PhDef, canvas: boolean, override?: ArtOverride): ReactNode[] {
  const scale = bodyScaleOf(def)
  return LEVELS.map((lv, i) => {
    const meta = LEVELS_META[i]!
    const level = i + 1
    const cqw = bodyCqwOf(def, level, override)
    return (
      <p
        key={lv.text}
        data-mv-level={canvas ? level : undefined}
        className={cn("flex items-baseline", lv.cls)}
        style={{
          ...PARA,
          fontSize: `${cqw}cqw`,
          lineHeight: meta.lineHeight,
          columnGap: `${BULLET_GAP_CQW * scale}cqw`,
          paddingInlineStart: `${TEXT_INSET_CQW + meta.padCqw * scale}cqw`,
          paddingInlineEnd: `${TEXT_INSET_CQW}cqw`,
          marginBlockStart: i ? `${meta.gapCqw * scale}cqw` : undefined,
        }}
      >
        <span aria-hidden="true" className="text-(--s-brand)">
          •
        </span>
        <span>{lv.text}</span>
      </p>
    )
  })
}

/**
 * 单段的占位符（标题、副标题、页脚…）。canvas 画法里从框顶排的单段（图片占位符的提示）也带 data-mv-level="1"：
 * 标注层按「最后一行正文的下沿」给图标条找位置、按第一行量提示文字的首行，单段与正文同一个量法
 */
function artText(def: PhDef, canvas: boolean, override?: ArtOverride): ReactNode {
  if (def.type === "body") return null
  const t = ART_TEXT[def.type]
  const title = TITLE_TYPES.includes(def.type)
  const cqw = textCqwOf(def, override)
  return (
    <p
      data-mv-level={canvas && TOP_TYPES.includes(def.type) ? 1 : undefined}
      className={cn(t.cls, title && (def.textPt ? "font-semibold" : "font-bold"), def.center && "text-center")}
      style={{ ...PARA, fontSize: `${cqw}cqw`, paddingInlineStart: `${TEXT_INSET_CQW}cqw`, paddingInlineEnd: `${TEXT_INSET_CQW}cqw` }}
    >
      {t.text}
    </p>
  )
}

function thumbFrameCls(frames: ThumbFrames, inherited?: boolean): string | undefined {
  if (frames === "none") return undefined
  if (frames === "legacy") return cn("border-[0.12cqw] border-(--s-mute)/45", inherited ? "border-dashed" : "border-solid")
  return "border border-(--s-mute)/45"
}

/**
 * thumb 的框线在块方向的起始一边（横排是上边、竖排从右往左成列是右边）画在占位符框的外侧（2026-10-31 修复第 1 轮）：框层在这一边往外让出「线宽 + 半个像素」，
 * 线落在框外，与框之间还空半个像素，框内整块留给内容。画布上框与提示文字之间的空，按比例缩到 90 宽的缩略图里只剩不到一个像素
 * （标题框约 6.6 px 高、标题一行约 5 px），线宽却不随缩放变细——线画在框内侧时正好压在标题与正文首行的字顶上（窗格、画廊卡片与放大的对照板都看得出；
 * 中文字形在行盒里偏上，压到的都是起始那一边）。多空的半个像素给取整：缩略图多在小数坐标上，框线按设备像素取整，最多挪半个设备像素，
 * 留出它才能在任何位置上与字顶之间隔开至少一个设备像素行。只让这一边：另一边与行内方向文字离线本来就有空（下边约 0.8 px，左右各 0.75cqw），
 * 线仍画在框内侧——标题框下沿与母版品牌短线、并排的框（两栏内容的两栏、页脚一行）之间照旧留着空。
 * 原画法（legacy）的线宽 0.12cqw 在缩略图里不到一个设备像素、画出来是一个设备像素，所以按至少 1px 让。内容的排版、整段取舍与裁切边都不变（仍按占位符框）
 */
const THUMB_LINE_OUT: Record<Exclude<ThumbFrames, "none">, string> = { line: "1.5px", legacy: "calc(max(0.12cqw, 1px) + 0.5px)" }
const thumbFrameStyle = (def: PhDef, frames: Exclude<ThumbFrames, "none">): CSSProperties => {
  const e = THUMB_LINE_OUT[frames]
  const b = def.box
  return def.vertical
    ? { left: `${b.x}%`, top: `${b.y}%`, width: `calc(${b.w}% + ${e})`, height: `${b.h}%` }
    : { left: `${b.x}%`, top: `calc(${b.y}% - ${e})`, width: `${b.w}%`, height: `calc(${b.h}% + ${e})` }
}

/**
 * canvas / thumb 的一个占位符：内容盒按框落位，一列一列地排段（主轴竖向、满了换列），框外的列被裁掉——
 * 每一段（标题一段、正文每级一段、页脚一段）放得下就整段画、放不下就整段落到框外，不会裁出半个字；纯 CSS、确定性，不用定时器。
 * 两种画法排法相同（缩略图与画布是同一份渲染）：单段的占位符在框里垂直居中（每一列各自居中，框外那一列照样被裁掉）、正文从顶上排（同 master 画法）。
 * canvas：只画内容不画框（框归标注层），内容盒带 data-mv-ph、正文每段带 data-mv-level 供标注层量位置。
 * thumb：另画 thumbFrames 的框；不带 data-mv-*。竖排（vertical）用同一套写法，尺寸都是逻辑方向的。
 * thumb 的框是同一位置上另一层（画在内容下面），不占内容盒的地方：92 宽的缩略图里标题框只有约 7 px 高、页脚框约 2.5 px，
 * 框线若算进内容盒（上下各 1 px），标题与页脚就整段放不下、被取舍掉了（core 先落自测时发现）。框线在块方向的起始一边画在占位符框的外侧（thumbFrameStyle），不压框里的字顶。
 * thumb 的裁切边在块方向外扩（THUMB_CLIP_EM）：排版仍按占位符框（外扩多少，块方向的内距就补多少，整段取舍不变），只有裁切的边往外让一截。
 */
function ArtPlaceholder({ def, mode, frames, override }: { def: PhDef; mode: "canvas" | "thumb"; frames: ThumbFrames; override?: ArtOverride }) {
  const canvas = mode === "canvas"
  const body = def.type === "body"
  // 从框顶排：正文与图片占位符的提示（上内距同 master 画法）；其余单段在框里垂直居中
  const top = body || TOP_TYPES.includes(def.type)
  const frame = canvas ? undefined : thumbFrameCls(frames, def.inherited)
  // 块方向（横排上下、竖排左右）外扩的裁切边：canvas 不外扩，内容盒就是占位符框（标注层、检查都按它量），输出与原来逐字相同
  const clip = canvas ? null : `max(${artMaxCqw(def, override) * THUMB_CLIP_EM}cqw, ${THUMB_CLIP_MIN_PX}px)`
  const b = def.box
  const place: CSSProperties = !clip
    ? boxStyle(b)
    : def.vertical
      ? { left: `calc(${b.x}% - ${clip})`, top: `${b.y}%`, width: `calc(${b.w}% + 2 * ${clip})`, height: `${b.h}%` }
      : { left: `${b.x}%`, top: `calc(${b.y}% - ${clip})`, width: `${b.w}%`, height: `calc(${b.h}% + 2 * ${clip})` }
  const padStart = clip ? (top ? `calc(${clip} + ${BODY_TOP_CQW}cqw)` : clip) : top ? `${BODY_TOP_CQW}cqw` : undefined
  return (
    <>
      {frame && frames !== "none" && <div aria-hidden="true" className={cn("absolute", frame)} style={thumbFrameStyle(def, frames)} />}
      <div
        data-mv-ph={canvas ? def.id : undefined}
        className={cn("absolute flex flex-col flex-wrap content-start overflow-hidden", !top && "justify-center")}
        style={{ ...place, writingMode: def.vertical ? "vertical-rl" : undefined, paddingBlockStart: padStart, paddingBlockEnd: clip ?? undefined }}
      >
        <span aria-hidden="true" style={SENTINEL} />
        {body ? artBody(def, canvas, override) : artText(def, canvas, override)}
      </div>
    </>
  )
}

/** canvas / thumb 的整页内容：母版图形 → 普通形状 → 占位符（omit 去掉的不画；boxes 换掉其中几个的框） */
function ArtContent({
  master,
  target,
  mode,
  frames,
  omit,
  shapes,
  override,
  boxes,
}: {
  master: MasterId
  target: Target
  mode: "canvas" | "thumb"
  frames: ThumbFrames
  omit?: string[]
  shapes?: ArtShape[]
  override?: ArtOverride
  boxes?: Record<string, Box>
}) {
  const defs = placeholdersFor(master, target)
    .filter((d) => !omit?.includes(d.id))
    .map((d) => (boxes?.[d.id] ? { ...d, box: boxes[d.id]! } : d))
  return (
    <>
      <MasterGraphics master={master} target={target} mark={mode === "canvas"} />
      {shapes?.map((s) => (
        <div
          key={s.id}
          aria-hidden="true"
          data-mv-graphic={mode === "canvas" ? "" : undefined}
          className="absolute"
          style={{ ...boxStyle(s.box), backgroundColor: `var(${ART_FILL_TOKEN[s.fill]})` }}
        />
      ))}
      {defs.map((d) => (
        <ArtPlaceholder key={d.id} def={d} mode={mode} frames={frames} override={override?.ph === d.id ? override : undefined} />
      ))}
    </>
  )
}

const LAYOUT_NAMES: Record<LayoutKind, string> = {
  title: "标题幻灯片",
  "title-content": "标题和内容",
  "two-content": "两栏内容",
  comparison: "比较",
  "title-only": "仅标题",
  section: "章节标题",
  blank: "空白",
  "content-caption": "内容与标题",
  "picture-caption": "图片与标题",
  "title-vertical": "标题和竖排文字",
  "vertical-title": "竖排标题与文本",
  "content-picture": "内容与图片",
  "two-content-picture": "两栏内容与图片",
}

/**
 * 母版或版式的整页渲染。children 画在幻灯片框里（如画布上的点选区域）。
 * previewClass / previewStyle：03-28 主题编辑中的实时预览（叠在母版自带的主题配色之上，见 ThemeParts 的 livePreview）。
 * 2026-10-30（母版视图改版第二步）另加两种画法，原来三种（master / slide / none）的输出一字不变：
 *   canvas：母版视图画布上的内容——提示文字、母版图形、页脚文字、普通形状，不画框（框归标注层）；内容盒带 data-mv-ph、正文每段带 data-mv-level；
 *   thumb：版式的缩略图——母版视图窗格、多选画布，以及普通视图版式画廊卡片、检查器「版式」字段与重置确认里的预览（rulings §4.25 DS-149，同一种画法）；
 *          内容同 canvas，外加 thumbFrames 的框（缺省一种细线），放不下的段整段不画；内容根带 data-layout-art="thumb"（检查认画法用）。
 *   两种都一律画满正文 1–5 级、文字可换行；omit / shapes / override / boxes / name 只对这两种生效。
 */
export function LayoutArt({
  master,
  target,
  prompts = "master",
  thumbFrames = "line",
  omit,
  shapes,
  override,
  boxes,
  name,
  page,
  frame = true,
  previewClass,
  previewStyle,
  className,
  children,
}: {
  master: MasterId
  target: Target
  /**
   * 占位符怎么画：master 母版 / 版式定义（缺省）· slide 新建页上的空占位符 · none 缩略图里的新建页（只剩母版图形与页脚）·
   * canvas 母版视图画布（只画内容）· thumb 母版视图缩略图（内容 + 细线框，整段取舍）
   */
  prompts?: "master" | "slide" | "none" | "canvas" | "thumb"
  /** 只对 thumb：line 一种细线（缺省，DS-149）· none 不画框 · legacy 本版式实线、继承项虚线（后两种未采纳，只给对比场景） */
  thumbFrames?: ThumbFrames
  /** 只对 canvas / thumb：不画的占位符 id（删占位符之后） */
  omit?: string[]
  /** 只对 canvas / thumb：母版 / 版式上的普通形状 */
  shapes?: ArtShape[]
  /** 只对 canvas / thumb：版式上覆盖的字号（画布与缩略图一起体现） */
  override?: ArtOverride
  /** 只对 canvas / thumb：换掉几个占位符的框（占位符 id → 框；拖动中的预览、他人改了位置之后），内容随框走 */
  boxes?: Record<string, Box>
  /** 只对 canvas / thumb：读屏标签里的名称（版式传显示名，改名后跟着变；不给时用版式 / 母版的原名） */
  name?: string
  /** slide / none 时页脚写的页码（不给就不画页脚） */
  page?: number
  /** false：不包 SlideFrame，直接画内容（给已在 SlideFrame 里的 deck 页 render 用；这时不套母版的主题配色类，deck 页本来就在文档主题里） */
  frame?: boolean
  previewClass?: string
  previewStyle?: CSSProperties
  className?: string
  children?: ReactNode
}) {
  const m = masterOf(master)
  if (prompts === "canvas" || prompts === "thumb") {
    const shown = name ?? (target === "master" ? m.name : LAYOUT_NAMES[target])
    const art = (
      <>
        {/* 换了母版或版式就整组换新节点（key），不复用上一个对象的节点：系统开了「减少动态效果」时全局给每个元素 1ms 的过渡，
            复用的节点要过两帧才到新版式的几何，母版视图画布的标注层会量到上一个对象的几何（2026-10-31 修复第 2 轮，复验 RV1-N1）；
            新节点没有改前的样式、不起过渡。输出的元素与属性不变 */}
        <ArtContent key={`${master}:${target}`} master={master} target={target} mode={prompts} frames={thumbFrames} omit={omit} shapes={shapes} override={override} boxes={boxes} />
        {children}
      </>
    )
    const body =
      prompts === "thumb" ? (
        <div data-layout-art="thumb" className="absolute inset-0">
          {art}
        </div>
      ) : (
        art
      )
    if (!frame) return body
    return (
      <div className={cn("contents", themeOf(m.theme).className, previewClass)} style={previewStyle}>
        <SlideFrame label={target === "master" ? `母版：${shown}` : `版式：${shown}（母版 ${m.name}）`} className={className}>
          {body}
        </SlideFrame>
      </div>
    )
  }
  // master / slide / none 三种画法。master 是原来的版式缩略画法（Placeholder、PhContent）：普通视图的三处缩略改用 thumb（DS-149）后，
  // 转正后没有调用方，产品迁移不带；样张里留着（第二步的检查脚本读 PhContent 里 body 那一段的行高与段距，核对 LEVELS_META）
  const label = target === "master" ? `母版：${m.name}` : `版式：${LAYOUT_NAMES[target]}（母版 ${m.name}）`
  const defs = placeholdersFor(master, target)
  const hasFooter = defs.some((d) => FOOTER_TYPES.includes(d.type))
  const content = (
    <>
      <MasterGraphics master={master} target={target} />
      {prompts === "master"
        ? defs.map((p) => <Placeholder key={p.id} def={p} />)
        : prompts === "slide"
          ? defs.filter((p) => !FOOTER_TYPES.includes(p.type)).map((p) => <SlidePrompt key={p.id} def={p} />)
          : null}
      {prompts !== "master" && hasFooter && page !== undefined && <SlideFooter page={page} />}
      {children}
    </>
  )
  if (!frame) return content
  return (
    <div className={cn("contents", themeOf(m.theme).className, previewClass)} style={previewStyle}>
      <SlideFrame label={label} className={className}>
        {content}
      </SlideFrame>
    </div>
  )
}

/** 版式的中文名（画廊卡片、检查器字段、读屏名） */
export const layoutName = (kind: LayoutKind) => LAYOUT_NAMES[kind]

/* ------------------------------------------------------------------ 画布上的文字样式（检查器读，2026-10-30 第二步规格 §1.3、§3.4.5） */

/** 文字取哪个幻灯片内容 token：ink 正文主色 · body 次级 · mute 说明灰（检查器「颜色」字段按它写色槽名、取色块） */
export type ArtTone = "ink" | "body" | "mute"

/** 画布上一个占位符（正文取第 level 级，第 6–9 级同第 5 级）的文字：字号（pt，取整）、字重与颜色 token */
export interface ArtTextStyle {
  pt: number
  weight: number
  tone: ArtTone
}

/** 类名里写的颜色 token（text-(--s-body) / text-(--s-mute)）；没写的随幻灯片的缺省颜色 --s-ink */
const toneOfCls = (cls: string): ArtTone => (/text-\(--s-(ink|body|mute)\)/.exec(cls)?.[1] as ArtTone | undefined) ?? "ink"

/**
 * 检查器「文本样式」的值从这里取（Q8：字段写的就是 canvas / thumb 画法画出来的样式，不另写一份）：
 * 正文按 LEVELS / LEVELS_META（textPt 同比缩小，同 artBody），单段的类型按 ART_TEXT（给了 textPt 就用它，同 artText）；
 * 字重、颜色都从同一份类名里读，不在别处写死
 */
export function artTextStyleOf(def: Pick<PhDef, "type" | "textPt">, level = 1): ArtTextStyle {
  if (def.type === "body") {
    const i = Math.min(LEVELS.length, Math.max(1, Math.round(level))) - 1
    const scale = def.textPt ? def.textPt / (LEVELS_META[0]!.cqw * PT_PER_CQW) : 1
    const lv = LEVELS[i]!
    return { pt: Math.round(LEVELS_META[i]!.cqw * scale * PT_PER_CQW), weight: /\bfont-medium\b/.test(lv.cls) ? 500 : 400, tone: toneOfCls(lv.cls) }
  }
  const t = ART_TEXT[def.type]
  const title = TITLE_TYPES.includes(def.type)
  const weight = title ? (def.textPt ? 600 : 700) : /\bfont-semibold\b/.test(t.cls) ? 600 : 400
  return { pt: Math.round(def.textPt ?? t.cqw * PT_PER_CQW), weight, tone: toneOfCls(t.cls) }
}
