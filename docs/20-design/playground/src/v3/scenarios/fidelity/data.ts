import { ArrowRightLeft, ChartColumnDecreasing, Clapperboard, FileImage, FileWarning, Globe, Lock, Network, Sheet, Type, type LucideIcon } from "lucide-react"
import type { Box } from "../../kit"

/**
 * fidelity 场景的报告数据（03-10 保真报告）：报告是「客观文件事实」，对所有协作者一致（03-10 开头），所以这里只有一份按文档变体给出的条目，不按角色增减。
 * 条目全集与支持级措辞照抄 03-10「条目全集」（rulings §4.15 Q7、§4.16 Q15）：每类一行、同类合并计数；分组按类型（图表 / 图形与对象 / 动画与切换 / 外部内容 / 字体），
 * 「部分解析失败」单独成组排在最前（危险色图标）。坐标是幻灯片百分比（与 kit Box 同一口径），定位时画布按它画高亮。
 */

/** 级别：danger 无法解析（排最前）· warning 无法显示（以占位显示）· info 已原样保留（能看见，暂不能编辑，或显示略有不同） */
export type Level = "danger" | "warning" | "info"

export type GroupId = "parse" | "chart" | "object" | "motion" | "external" | "font"

export const GROUPS: { id: GroupId; title: string }[] = [
  { id: "parse", title: "无法解析" },
  { id: "chart", title: "图表" },
  { id: "object", title: "图形与对象" },
  { id: "motion", title: "动画与切换" },
  { id: "external", title: "外部内容" },
  { id: "font", title: "字体" },
]

/** 一处具体的差异：在第几页、画布上的位置（对象框或整页）、是什么（定位后行内显示）。 */
export interface Occurrence {
  page: number
  at: Box | "page"
  what: string
}

export interface ReportItem {
  id: string
  group: GroupId
  Icon: LucideIcon
  name: string
  level: Level
  /** 计数单位：处（对象 / 页）· 种（字体）；字体的种数取 detail 的行数 */
  unit: "处" | "种"
  /** 支持级措辞（03-10 条目全集），按词组分段：段内不折行、段与段之间才换行（Q7） */
  note: string[]
  /** 补充行（字体对照），12px 正文色 */
  detail?: string[]
  occ: Occurrence[]
}

/** 文档变体：main 有差异（缺省）· parse 第 8 页整页无法解析 · generating 其余页面检查中 · clean 完全保真 · confirm 外部内容需确认（部署 externalResources = confirm） */
export type Variant = "main" | "parse" | "generating" | "clean" | "confirm"

/** 原文件名（导入自）：报告说的是这份 pptx 的事实，与当前文档标题可以不同 */
export const SOURCE_FILE = "Q2 业绩汇报-终版.pptx"

/* ------------------------------------------------------------------ 画布坐标（幻灯片百分比；960 × 540 设计稿换算，cqw 见 slides.tsx） */

/** 第 7 页：瀑布图（chartex）占位 */
export const CHARTEX_BOX: Box = { x: 46, y: 30.22, w: 47, h: 55.11 }
/** 第 7 页：正文文本框（用了缺失的「汉仪旗黑」） */
export const P7_TEXT_BOX: Box = { x: 7, y: 33.78, w: 34, h: 51.56 }
/** 第 8 页：SmartArt 组织结构图 */
export const SMARTART_BOX: Box = { x: 7, y: 33.78, w: 40, h: 49.78 }
/** 第 8 页：嵌入的 Excel 工作表（OLE 预览图） */
export const OLE_BOX: Box = { x: 51, y: 33.78, w: 42, h: 24 }
/** 第 8 页：外部图片「门店分布」 */
export const EXT_BOX: Box = { x: 51, y: 62.22, w: 42, h: 21.33 }
/** 第 8 页：EMF 标志 */
export const EMF_BOX: Box = { x: 81, y: 11.2, w: 12, h: 7.4 }

/** 示例文档第 1 页标题、第 3 页三张指标卡的位置（SlideArt 原样页） */
const P1_TITLE: Box = { x: 9.8, y: 31, w: 70, h: 16 }
const P3_CARD = (i: number): Box => ({ x: 7 + i * 29.667, y: 33.78, w: 26.667, h: 48.89 })
/** 第 2–6 页的页标题（SlideTitle：left 7cqw、top 6.4cqw、4.6cqw 字） */
const TITLE_BOX = (w: number): Box => ({ x: 6.2, y: 9.8, w, h: 11.2 })

/* ------------------------------------------------------------------ 条目 */

const CHARTEX: ReportItem = {
  id: "chartex",
  group: "chart",
  Icon: ChartColumnDecreasing,
  name: "新式图表（瀑布图等）",
  level: "warning",
  unit: "处",
  note: ["暂不支持显示，", "已原样保留，", "导出后可在 PowerPoint 查看"],
  occ: [{ page: 7, at: CHARTEX_BOX, what: "瀑布图「成本构成」" }],
}

const SMARTART: ReportItem = {
  id: "smartart",
  group: "object",
  Icon: Network,
  name: "SmartArt",
  level: "info",
  unit: "处",
  note: ["已保留为静态图形，", "暂不支持编辑其结构"],
  occ: [{ page: 8, at: SMARTART_BOX, what: "组织结构图「项目组织」" }],
}

const OLE: ReportItem = {
  id: "ole",
  group: "object",
  Icon: Sheet,
  name: "嵌入对象（OLE）",
  level: "info",
  unit: "处",
  note: ["显示为预览图，", "暂不支持在此编辑"],
  occ: [{ page: 8, at: OLE_BOX, what: "Excel 工作表「Q2 成本明细」" }],
}

const EMF: ReportItem = {
  id: "emf",
  group: "object",
  Icon: FileImage,
  name: "EMF / WMF 图片",
  level: "info",
  unit: "处",
  note: ["已转为图片显示，", "导出时保留原文件"],
  occ: [{ page: 8, at: EMF_BOX, what: "图片「ACME 标志」" }],
}

const ANIMATION: ReportItem = {
  id: "animation",
  group: "motion",
  Icon: Clapperboard,
  name: "动画效果",
  level: "info",
  unit: "处",
  note: ["已原样保留；", "放映时显示", "动画结束后的画面，", "暂不可修改"],
  occ: [
    { page: 1, at: P1_TITLE, what: "标题「2026 年 Q2 业绩汇报」" },
    { page: 3, at: P3_CARD(0), what: "指标卡「营收」" },
    { page: 3, at: P3_CARD(1), what: "指标卡「活跃客户」" },
    { page: 3, at: P3_CARD(2), what: "指标卡「毛利率」" },
  ],
}

const TRANSITION: ReportItem = {
  id: "transition",
  group: "motion",
  Icon: ArrowRightLeft,
  name: "切换效果",
  level: "info",
  unit: "处",
  note: ["已原样保留，", "暂不播放"],
  occ: [
    { page: 4, at: "page", what: "整页 · 淡化" },
    { page: 6, at: "page", what: "整页 · 推入" },
  ],
}

const EXTERNAL: ReportItem = {
  id: "external",
  group: "external",
  Icon: Globe,
  name: "外部链接内容",
  level: "info",
  unit: "处",
  // 「1 处内容来自外部网站（cdn.example.com），」整句放不进 280 宽的一行（约 253 / 223）：括号起第二行，两行排完，不再出现首行只有几个字的三行
  note: ["1 处内容来自外部网站", "（cdn.example.com），已自动加载"],
  occ: [{ page: 8, at: EXT_BOX, what: "图片「门店分布」" }],
}

/** 部署 externalResources = confirm（03-13「外链资源」）：先显示占位与「加载」，算作无法显示 */
const EXTERNAL_CONFIRM: ReportItem = {
  ...EXTERNAL,
  level: "warning",
  note: ["1 处外部内容", "需确认后加载", "（cdn.example.com）"],
}

const FONT_MISSING: ReportItem = {
  id: "font-missing",
  group: "font",
  Icon: Type,
  name: "缺失字体替代",
  level: "info",
  unit: "种",
  detail: ["「汉仪旗黑」→「思源黑体」"],
  note: ["显示效果可能与原文件", "存在细微差异"],
  occ: [
    { page: 7, at: P7_TEXT_BOX, what: "正文文本框" },
    { page: 8, at: SMARTART_BOX, what: "组织结构图里的文字" },
  ],
}

/** 受限内嵌字体（OF-17，M2 起）：与 text-edit.restricted-font 同一字体与回退字体 */
const FONT_RESTRICTED: ReportItem = {
  id: "font-restricted",
  group: "font",
  Icon: Lock,
  name: "仅授权查看的字体",
  level: "info",
  unit: "种",
  detail: ["「方正兰亭黑」"],
  note: ["查看和放映时", "使用原字体；", "编辑时显示为", "「微软雅黑」，", "换行位置", "可能变化"],
  occ: [
    { page: 1, at: P1_TITLE, what: "标题" },
    { page: 2, at: TITLE_BOX(11), what: "标题「议程」" },
    { page: 3, at: TITLE_BOX(20), what: "标题「关键指标」" },
    { page: 4, at: TITLE_BOX(20), what: "标题「营收趋势」" },
    { page: 5, at: TITLE_BOX(20), what: "标题「区域分布」" },
    { page: 6, at: TITLE_BOX(24.5), what: "标题「下半年计划」" },
  ],
}

/** 03-10「部分解析失败但可继续打开」+ 03-13 F1 E2 整页解析失败：危险色、排在最前 */
const PARSE_P8: ReportItem = {
  id: "parse-8",
  group: "parse",
  Icon: FileWarning,
  name: "第 8 页内容无法解析",
  level: "danger",
  unit: "处",
  note: ["该页以占位显示，", "其余页面不受影响；", "原内容已保留，", "导出时原样写回"],
  occ: [{ page: 8, at: "page", what: "整页" }],
}

const MAIN: ReportItem[] = [CHARTEX, SMARTART, OLE, EMF, ANIMATION, TRANSITION, EXTERNAL, FONT_MISSING, FONT_RESTRICTED]

const onPages = (it: ReportItem, max: number): ReportItem => ({ ...it, occ: it.occ.filter((o) => o.page <= max) })

/** 各文档变体的报告条目（按组排好序之前的原始顺序）。 */
export function reportFor(v: Variant): ReportItem[] {
  switch (v) {
    case "clean":
      return []
    case "parse":
      // 第 8 页整页没解析出来：那一页上的对象（SmartArt、OLE、EMF、外部图片）都不知道，只剩「无法解析」一条
      return [PARSE_P8, CHARTEX, ANIMATION, TRANSITION, { ...FONT_MISSING, occ: FONT_MISSING.occ.filter((o) => o.page !== 8) }, FONT_RESTRICTED]
    case "generating":
      // 首屏可交互后后台解析其余页（03-13「其余页面加载中 x/N」）：已检查第 1–5 页
      return [ANIMATION, onPages(TRANSITION, 5), onPages(FONT_RESTRICTED, 5)]
    case "confirm":
      return MAIN.map((it) => (it.id === "external" ? EXTERNAL_CONFIRM : it))
    default:
      return MAIN
  }
}

/** 生成中：已检查的页数 / 总页数 */
export const GENERATING = { done: 5, total: 8 }

/** 一条在当前范围内的计数：字体数「种」、其余「处」 */
export function countOf(it: ReportItem, occ: Occurrence[] = it.occ): number {
  return it.unit === "种" ? (it.detail?.length ?? 1) : occ.length
}

/** 页码列表「第 1、3 页」；超过 5 页收成「共 N 页」（03-10 边界情况） */
export function pagesOf(occ: Occurrence[]): number[] {
  return [...new Set(occ.map((o) => o.page))].sort((a, b) => a - b)
}

/** 某页上以占位显示的元素数（缩略图警示角标、页级提示条，03-13）：无法显示与无法解析两级 */
export function placeholdersOn(items: ReportItem[], page: number): number {
  return items.filter((it) => it.level !== "info").reduce((n, it) => n + it.occ.filter((o) => o.page === page).length, 0)
}

const SEVERITY: Record<Level, number> = { info: 0, warning: 1, danger: 2 }

/**
 * 某页上最严重的一条的级别（只看以占位显示的两级：danger 无法解析 · warning 无法显示；没有时 null）。由报告数据推导，页级提示条的图标按它着色
 * （无法解析用危险色，其余中性）；缩略图角标也应按它着色（parse-failed 第 8 页是危险级），等底座 RailThumb 支持角标级别后由 ThumbList 传入。
 */
export function worstLevelOn(items: ReportItem[], page: number): Exclude<Level, "info"> | null {
  let worst: Level = "info"
  for (const it of items) if (it.occ.some((o) => o.page === page) && SEVERITY[it.level] > SEVERITY[worst]) worst = it.level
  return worst === "info" ? null : worst
}
