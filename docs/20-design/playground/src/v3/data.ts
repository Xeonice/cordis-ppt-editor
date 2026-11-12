import type { CoverId } from "./CoverArt"
import { BUILTIN_THEMES, type BuiltinThemeId } from "./editor/layouts/data"
import type { SlideNo } from "./SlideArt"
import type { Tone } from "./ui"

/** v3 样张的示例数据：一份 6 页的「2026 年 Q2 业绩汇报」与首页的模板、最近文档。 */
export const DOC_TITLE = "2026 年 Q2 业绩汇报"
/** 示例文档的 documentId（首页最近文档同一个 id；面板尺寸按它记在本机，editor/resize.tsx） */
export const DOC_ID = "q2"

export const SLIDE_LIST: { n: SlideNo; layout: string }[] = [
  { n: 1, layout: "标题幻灯片" },
  { n: 2, layout: "标题和内容" },
  { n: 3, layout: "仅标题" },
  { n: 4, layout: "仅标题" },
  { n: 5, layout: "仅标题" },
  { n: 6, layout: "仅标题" },
]

/** 第 4 页上的评论数 */
export const COMMENT_COUNT: Partial<Record<SlideNo, number>> = { 4: 3 }

export interface Person {
  name: string
  tone: Tone
}

export const ME: Person = { name: "周明远", tone: "slate" }
export const WANG: Person = { name: "王小明", tone: "sand" }
export const LI: Person = { name: "李雷", tone: "sage" }
export const ZHANG: Person = { name: "张三", tone: "clay" }

/**
 * 开始页「从模板开始」：空白 + 5 个模板。5 个模板就是编辑器主题画廊的 5 套内置主题（简约 / 商务 / 暗色 / 学术 / 活力），
 * 名称、配色与字体取同一份数据（editor/layouts/data.ts BUILTIN_THEMES，rulings §4.25 DS-33；模板 = 主题 + 母版 + 版式包，PRD AS-03）。
 */
export const TEMPLATES: { id: CoverId; name: string }[] = [
  { id: "blank", name: "空白" },
  ...BUILTIN_THEMES.map((t) => ({ id: t.id as BuiltinThemeId, name: t.name })),
]

export interface RecentDoc {
  id: string
  cover: CoverId
  title: string
  editor: string
  when: string
  /** 共享文档：右下角叠头像 */
  shared?: [Person, Person]
}

/**
 * kit 示例（_kit 场景的应用壳与文档卡片插槽）用的 8 份文档。卡片第二行「编辑者 · 相对时间」不带「编辑」二字（rulings §4.25 DS-83；2026-10-22 第 3 批转正时改，原「2 小时前编辑」）。
 * 已拍板首页（Home.tsx HomeBody）的「最近」改用 library.ts 的 HOME_RECENT（文档列表「最近」的前 8 条：带角色、固定、所有者与协作者，DS-81 / DS-83 的画法）
 */
export const RECENT_DOCS: RecentDoc[] = [
  { id: DOC_ID, cover: "q2", title: DOC_TITLE, editor: "王小明", when: "2 小时前", shared: [WANG, LI] },
  { id: "roadmap", cover: "roadmap", title: "产品路线图", editor: "李雷", when: "昨天", shared: [LI, ZHANG] },
  { id: "review", cover: "review", title: "设计评审", editor: "我", when: "3 天前" },
  { id: "hiring", cover: "hiring", title: "招聘计划", editor: "张三", when: "上周", shared: [ZHANG, WANG] },
  { id: "onboarding", cover: "onboarding", title: "新人培训手册", editor: "我", when: "2 周前" },
  { id: "okr", cover: "okr", title: "季度 OKR 复盘", editor: "王小明", when: "9 月 28 日", shared: [WANG, ZHANG] },
  { id: "cases", cover: "cases", title: "客户成功案例", editor: "李雷", when: "9 月 21 日", shared: [LI, WANG] },
  { id: "budget", cover: "budget", title: "年度预算", editor: "我", when: "9 月 12 日" },
]
