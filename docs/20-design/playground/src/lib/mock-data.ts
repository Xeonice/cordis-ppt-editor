/**
 * 共享演示数据：所有 /editor/* 路由引用同一份文档状态，保证路由之间演示内容一致。
 * 仅供设计 playground 使用，不代表真实数据模型。
 */

export type Role = "owner" | "editor" | "commenter" | "viewer"

export interface Collaborator {
  id: string
  name: string
  initial: string
  role: Role
  /** 1-12，对应 --presence-1…12；自己不设置该字段，环用 primary 表达（F-17） */
  presence?: number
  email?: string
  isSelf?: boolean
}

export const collaborators: Collaborator[] = [
  { id: "me", name: "我", initial: "我", role: "owner", isSelf: true },
  { id: "wang", name: "王小明", initial: "王", role: "editor", presence: 2, email: "wang@example.com" },
  { id: "li", name: "李雷", initial: "李", role: "commenter", presence: 5, email: "li@example.com" },
  { id: "zhang", name: "张三", initial: "张", role: "viewer", presence: 3, email: "zhang@example.com" },
]

/** 静态 class 映射：避免 `bg-presence-${n}` 动态拼接，保证 Tailwind 能扫描到实际类名 */
export const presenceRing: Record<number, string> = {
  1: "ring-presence-1", 2: "ring-presence-2", 3: "ring-presence-3", 4: "ring-presence-4",
  5: "ring-presence-5", 6: "ring-presence-6", 7: "ring-presence-7", 8: "ring-presence-8",
  9: "ring-presence-9", 10: "ring-presence-10", 11: "ring-presence-11", 12: "ring-presence-12",
}
export const presenceBg: Record<number, string> = {
  1: "bg-presence-1", 2: "bg-presence-2", 3: "bg-presence-3", 4: "bg-presence-4",
  5: "bg-presence-5", 6: "bg-presence-6", 7: "bg-presence-7", 8: "bg-presence-8",
  9: "bg-presence-9", 10: "bg-presence-10", 11: "bg-presence-11", 12: "bg-presence-12",
}
/** 12% 透明填充（远端选区内部色块），Tailwind v4 颜色/透明度修饰符语法，字面量以便静态扫描 */
export const presenceBgSoft: Record<number, string> = {
  1: "bg-presence-1/12", 2: "bg-presence-2/12", 3: "bg-presence-3/12", 4: "bg-presence-4/12",
  5: "bg-presence-5/12", 6: "bg-presence-6/12", 7: "bg-presence-7/12", 8: "bg-presence-8/12",
  9: "bg-presence-9/12", 10: "bg-presence-10/12", 11: "bg-presence-11/12", 12: "bg-presence-12/12",
}
export const presenceBorder: Record<number, string> = {
  1: "border-presence-1", 2: "border-presence-2", 3: "border-presence-3", 4: "border-presence-4",
  5: "border-presence-5", 6: "border-presence-6", 7: "border-presence-7", 8: "border-presence-8",
  9: "border-presence-9", 10: "border-presence-10", 11: "border-presence-11", 12: "border-presence-12",
}
export const presenceText: Record<number, string> = {
  1: "text-presence-1", 2: "text-presence-2", 3: "text-presence-3", 4: "text-presence-4",
  5: "text-presence-5", 6: "text-presence-6", 7: "text-presence-7", 8: "text-presence-8",
  9: "text-presence-9", 10: "text-presence-10", 11: "text-presence-11", 12: "text-presence-12",
}

export function roleLabel(role: Role): string {
  return { owner: "所有者", editor: "可编辑", commenter: "可评审", viewer: "可查看" }[role]
}

export type LayoutKind =
  | "title" | "title-content" | "two-content" | "comparison"
  | "title-only" | "section-header" | "blank" | "picture-caption"

export const layoutLabel: Record<LayoutKind, string> = {
  title: "标题幻灯片",
  "title-content": "标题和内容",
  "two-content": "两栏内容",
  comparison: "比较",
  "title-only": "仅标题",
  "section-header": "章节标题",
  blank: "空白",
  "picture-caption": "图片+说明",
}

export interface LayoutDef {
  id: string
  name: string
  kind: LayoutKind
  pageCount: number
}

export interface MasterDef {
  id: string
  name: string
  imported?: boolean
  layouts: LayoutDef[]
}

export const masters: MasterDef[] = [
  {
    id: "m-corp",
    name: "公司主题",
    layouts: [
      { id: "l-title", name: "标题幻灯片", kind: "title", pageCount: 1 },
      { id: "l-tc", name: "标题和内容", kind: "title-content", pageCount: 4 },
      { id: "l-two", name: "两栏内容", kind: "two-content", pageCount: 2 },
      { id: "l-cmp", name: "比较", kind: "comparison", pageCount: 0 },
      { id: "l-only", name: "仅标题", kind: "title-only", pageCount: 2 },
      { id: "l-section", name: "章节标题", kind: "section-header", pageCount: 2 },
      { id: "l-blank", name: "空白", kind: "blank", pageCount: 0 },
    ],
  },
  {
    id: "m-simple",
    name: "简约主题",
    imported: true,
    layouts: [
      { id: "l2-tc", name: "标题和内容", kind: "title-content", pageCount: 1 },
      { id: "l2-title", name: "标题幻灯片", kind: "title", pageCount: 0 },
      { id: "l2-blank", name: "空白", kind: "blank", pageCount: 0 },
      { id: "l2-only", name: "仅标题", kind: "title-only", pageCount: 0 },
    ],
  },
]

export interface SlideSummary {
  id: string
  index: number
  masterId: string
  layoutId: string
  kind: LayoutKind
  title: string
  hidden?: boolean
  warningCount?: number
  commentCount?: number
  sectionId?: string
}

export const sections = [
  { id: "s1", name: "第一节" },
  { id: "s2", name: "第二节" },
]

export const slides: SlideSummary[] = [
  { id: "sl-1", index: 1, masterId: "m-corp", layoutId: "l-title", kind: "title", title: "2026年Q2业绩汇报", sectionId: "s1", commentCount: 1 },
  { id: "sl-2", index: 2, masterId: "m-corp", layoutId: "l-tc", kind: "title-content", title: "业绩概览", sectionId: "s1", warningCount: 2 },
  { id: "sl-3", index: 3, masterId: "m-corp", layoutId: "l-tc", kind: "title-content", title: "收入结构", sectionId: "s1", hidden: true, commentCount: 1 },
  { id: "sl-4", index: 4, masterId: "m-corp", layoutId: "l-tc", kind: "title-content", title: "产品线表现", sectionId: "s1" },
  { id: "sl-5", index: 5, masterId: "m-corp", layoutId: "l-tc", kind: "title-content", title: "重点客户回顾", sectionId: "s1" },
  { id: "sl-6", index: 6, masterId: "m-corp", layoutId: "l-two", kind: "two-content", title: "优势与挑战", sectionId: "s1" },
  { id: "sl-7", index: 7, masterId: "m-corp", layoutId: "l-two", kind: "two-content", title: "对比：Q1 vs Q2", sectionId: "s2" },
  { id: "sl-8", index: 8, masterId: "m-corp", layoutId: "l-only", kind: "title-only", title: "策略调整", sectionId: "s2" },
  { id: "sl-9", index: 9, masterId: "m-corp", layoutId: "l-only", kind: "title-only", title: "下一步计划", sectionId: "s2" },
  { id: "sl-10", index: 10, masterId: "m-corp", layoutId: "l-section", kind: "section-header", title: "附录", sectionId: "s2" },
  { id: "sl-11", index: 11, masterId: "m-corp", layoutId: "l-section", kind: "section-header", title: "风险提示", sectionId: "s2" },
  { id: "sl-12", index: 12, masterId: "m-simple", layoutId: "l2-tc", kind: "title-content", title: "致谢", sectionId: "s2" },
]

/** 各页正文（样例文档），供 SlideContent 在舞台/画布上渲染真实文字；两栏版式按前后各半拆分。 */
export const slideBodies: Record<string, string[]> = {
  "sl-1": ["本季度业绩概览与战略展望"],
  "sl-2": ["Q2 营收同比增长 18%，超出既定目标", "毛利率维持在 42% 以上", "新客户数量环比增长 27%"],
  "sl-3": ["订阅收入占比 61%，同比提升 9 个百分点", "服务收入受项目交付节奏影响略有回落", "海外市场首次贡献两位数占比"],
  "sl-4": ["核心产品线保持稳健增长", "新品在企业客户中的渗透率达到 34%", "长尾产品线完成整合，维护成本下降"],
  "sl-5": ["三家战略客户完成续约，合同金额合计上涨 22%", "行业头部客户试点项目进入二期", "客户满意度评分 4.6 / 5"],
  "sl-6": ["市场份额领先", "品牌认知度持续提升", "供应链成本上升", "区域竞争加剧"],
  "sl-7": ["Q1 营收同比 +11%", "Q1 毛利率 40%", "Q2 营收同比 +18%", "Q2 毛利率 42%"],
  "sl-10": ["数据口径、补充图表与术语表"],
  "sl-11": ["以下内容为前瞻性陈述，不构成业绩承诺"],
  "sl-12": ["感谢各团队的付出与协作"],
}

export const documentTitle = "2026年Q2业绩汇报.pptx"

export interface CommentReply {
  id: string
  authorId: string
  time: string
  body: string
}

export interface CommentThread {
  id: string
  number: number
  slideIndex: number
  anchorLabel: string
  authorId: string
  time: string
  body: string
  resolved?: boolean
  detachedAnchor?: boolean
  /** 演示"以原 id 恢复后线程回到原锚点"（05-collaboration-ux §6、03-screens/06:89）：脱离锚点前的锚点描述 */
  restoredAnchorLabel?: string
  replies?: CommentReply[]
  mentionsMe?: boolean
}

export const commentThreads: CommentThread[] = [
  {
    id: "c-1", number: 1, slideIndex: 3, anchorLabel: "标题文本",
    authorId: "wang", time: "2小时前", body: "这里的数据需要核对，和财务口径对一下。",
    mentionsMe: true,
    replies: [{ id: "c-1-r1", authorId: "li", time: "1小时前", body: "已经更新，麻烦复核。" }],
  },
  {
    id: "c-2", number: 2, slideIndex: 1, anchorLabel: "幻灯片整体",
    authorId: "me", time: "昨天", body: "建议这页加一个总结句，方便快速阅读。",
  },
  {
    id: "c-3", number: 3, slideIndex: 5, anchorLabel: "结论",
    authorId: "li", time: "3天前", body: "已确认无误，可以定稿。", resolved: true,
  },
  {
    id: "c-4", number: 4, slideIndex: 6, anchorLabel: "[原对象已删除]", restoredAnchorLabel: "产品对比图",
    authorId: "me", time: "昨天", body: "这张图后续要不要换成更新的数据？", detachedAnchor: true,
  },
]

export interface VersionEntry {
  id: string
  day: string
  time: string
  authorId: string
  name?: string
  named?: boolean
}

export const versionHistory: VersionEntry[] = [
  { id: "v-1", day: "今天", time: "14:32", authorId: "me" },
  { id: "v-2", day: "今天", time: "11:05", authorId: "wang" },
  { id: "v-3", day: "昨天", time: "16:20", authorId: "li", name: "提案定稿", named: true },
  { id: "v-4", day: "9月10日", time: "09:41", authorId: "me" },
  { id: "v-5", day: "9月10日", time: "08:58", authorId: "wang" },
]

export interface DocumentCard {
  id: string
  title: string
  ownerLabel: string
  timeLabel: string
  collaboratorCount?: number
  viewOnly?: boolean
  /** rulings §4.15 Q8：M2 卡片封面来源为包内 `docProps/thumbnail.jpeg`；无来源（如应用内新建）时为 false，显示中性占位 */
  hasCover?: boolean
}

export const documentList: DocumentCard[] = [
  { id: "d-1", title: "2026年Q2业绩汇报.pptx", ownerLabel: "我", timeLabel: "2 小时前" },
  { id: "d-2", title: "产品路线图", ownerLabel: "我 + 2 人", timeLabel: "昨天", collaboratorCount: 3 },
  { id: "d-3", title: "设计评审", ownerLabel: "王小明", timeLabel: "3 天前", viewOnly: true },
  { id: "d-4", title: "招聘计划", ownerLabel: "我", timeLabel: "上周", hasCover: false },
  { id: "d-5", title: "新人培训手册", ownerLabel: "我 + 1 人", timeLabel: "2 周前", collaboratorCount: 2 },
  { id: "d-6", title: "年度总结模板", ownerLabel: "李雷", timeLabel: "1 个月前", viewOnly: true },
]

export function collaboratorById(id: string): Collaborator {
  return collaborators.find((c) => c.id === id) ?? collaborators[0]!
}

/** 03-screens/28：theme1.xml 的 12 个颜色槽位，产品化措辞（不展示 dk1/lt1 等裸技术标识） */
export interface ThemeColorSlot {
  key: string
  label: string
  hex: string
}

export interface ThemePreset {
  id: string
  name: string
  headingFont: string
  bodyFont: string
  dark?: boolean
  colors: ThemeColorSlot[]
  variants: string[][]
}

function slots(hex: [string, string, string, string, string, string, string, string, string, string, string, string]): ThemeColorSlot[] {
  const labels = ["背景·浅1", "文字·深1", "背景·浅2", "文字·深2", "强调色1", "强调色2", "强调色3", "强调色4", "强调色5", "强调色6", "超链接", "已访问链接"]
  const keys = ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"]
  return labels.map((label, i) => ({ key: keys[i]!, label, hex: hex[i]! }))
}

export const themePresets: ThemePreset[] = [
  {
    id: "office", name: "Office", headingFont: "系统 UI 字体", bodyFont: "系统 UI 字体",
    colors: slots(["#FFFFFF", "#1A1A1A", "#E8EAF2", "#2B2E3B", "#4472C4", "#ED7D31", "#A5A5A5", "#FFC000", "#5B9BD5", "#70AD47", "#0563C1", "#954F72"]),
    variants: [["#4472C4", "#ED7D31", "#A5A5A5"], ["#2B2E3B", "#4472C4", "#70AD47"], ["#4472C4", "#70AD47", "#FFC000"]],
  },
  {
    id: "minimal-gray", name: "极简灰", headingFont: "系统 UI 字体", bodyFont: "系统 UI 字体",
    colors: slots(["#FFFFFF", "#20232B", "#EDEEF1", "#3A3D46", "#4B5563", "#9CA3AF", "#6B7280", "#374151", "#111827", "#D1D5DB", "#2563EB", "#7C3AED"]),
    variants: [["#4B5563", "#9CA3AF", "#6B7280"], ["#111827", "#4B5563", "#D1D5DB"], ["#374151", "#6B7280", "#9CA3AF"]],
  },
  {
    id: "warm-business", name: "暖色商务", headingFont: "系统 UI 字体（衬线映射）", bodyFont: "系统 UI 字体",
    colors: slots(["#FFFCF8", "#2B1D12", "#F3E6D6", "#4A2E1A", "#B45309", "#D9480F", "#92400E", "#C2410C", "#B45309", "#78350F", "#9A3412", "#7C2D12"]),
    variants: [["#B45309", "#D9480F", "#92400E"], ["#92400E", "#B45309", "#C2410C"], ["#4A2E1A", "#B45309", "#D9480F"]],
  },
  {
    id: "dark-tech", name: "深色科技", headingFont: "系统 UI 字体", bodyFont: "系统 UI 字体", dark: true,
    colors: slots(["#10131C", "#EAF0FF", "#1B2033", "#C7D0E8", "#6F79EE", "#22D3EE", "#818CF8", "#34D399", "#F472B6", "#FBBF24", "#7DD3FC", "#C4B5FD"]),
    variants: [["#6F79EE", "#22D3EE", "#818CF8"], ["#34D399", "#6F79EE", "#F472B6"], ["#FBBF24", "#6F79EE", "#22D3EE"]],
  },
]

export const recentColors = ["#4A54E1", "#D92D20", "#1E9E5A", "#111827", "#FFFFFF"]
export const standardColors = [
  "#C00000", "#FF0000", "#FFC000", "#FFFF00", "#92D050", "#00B050",
  "#00B0F0", "#0070C0", "#002060", "#7030A0", "#FFFFFF", "#000000",
]
