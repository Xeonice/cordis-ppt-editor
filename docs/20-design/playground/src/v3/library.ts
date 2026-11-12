import type { CoverId } from "./CoverArt"
import { LI, ME, WANG, ZHANG, type Person } from "./data"
import type { ExtraCoverId } from "./DocCover"
import { toneOf } from "./kit/tone"

/** 分享场景（share/people.ts）里的同一批同事：身份色按用户 id 稳定取（kit toneOf，PRD CO-03），与分享对话框、评论里是同一个色 */
const P_CHEN: Person = { name: "陈静", tone: toneOf("u-chen") }
const P_ZHAO: Person = { name: "赵敏", tone: toneOf("u-zhao") }
const P_ZHENG: Person = { name: "郑凯", tone: toneOf("u-zheng") }

/**
 * 文档列表、开始页「最近」与回收站的示例数据（第 3 批 · 文档组；2026-10-22 第 3 批转正时由 scenarios/documents/docs-data.ts 并入底座，数据逐字相同）。
 * 固定人物（周明远 / 王小明 / 李雷 / 张三）沿用 data.ts 的身份色；其余同事取分享场景（share/people.ts）的同一批人，
 * 同一个人在分享对话框、评论与这里是同一个身份色（kit toneOf，PRD CO-03）。
 * 「今天」= 2026-10-16：7 天内写「N 天前」「昨天」「上周」，更早写日期（与已拍板首页的示例写法一致）。
 * 封面：示例文档与已拍板首页的 8 份用 CoverArt；新增的几份是本目录 covers.tsx 的真实渲染；null 为没有封面（M2 应用内新建、包内没有封面的文档）。
 * 卡片第二行统一「编辑者 · 相对时间」（rulings §4.25 DS-83：最近一次编辑的人与时间，后端在 DocumentSummary 里补最近编辑者），
 * 不再写「2 小时前编辑」的「编辑」二字（rulings §4.25 DS-83；已拍板首页 data.ts RECENT_DOCS 同改）。
 */

/** 我对这份文档的角色：所有者 / 可编辑 / 可评审（卡片徽标「可评论」，01 §5.1）/ 可查看（徽标「仅查看」） */
export type DocRole = "owner" | "editor" | "commenter" | "viewer"

export type CoverKey = CoverId | ExtraCoverId | null

export interface LibDoc {
  id: string
  title: string
  cover: CoverKey
  /** 所有者（我拥有的写 ME） */
  owner: Person
  role: DocRole
  /** 最近一次编辑的人（「我」或姓名）与相对时间：卡片第二行（DS-83） */
  editor: string
  when: string
  /** 我拥有、且共享给了别人：右下叠放的协作者（最多 2 位，DS-83；§4.24 TA-10 协作者摘要只给所有者条目） */
  collaborators?: Person[]
  /** 固定（PRD AS-02，服务端同步 U-04）：「最近」里排在最前，标题后 12px 图钉 */
  pinned?: boolean
  /** 回收站：多久前移入、还剩几天（M3 到期清理，retention.trashDays 缺省 30，部署可配 1–365） */
  trashed?: { ago: string; daysLeft: number }
  /** 离线时仍可打开：本会话里仍保活的文档（HostRegistry 最多 2 个，50/02 §2.2、§9.1） */
  alive?: boolean
}

/** 回收站保留天数（RuntimeConfig / 部署配置 retention.trashDays，样张取缺省 30） */
export const TRASH_DAYS = 30

const mine = (d: Omit<LibDoc, "owner" | "role">): LibDoc => ({ owner: ME, role: "owner", ...d })
const theirs = (owner: Person, role: Exclude<DocRole, "owner">, d: Omit<LibDoc, "owner" | "role">): LibDoc => ({ owner, role, ...d })

/* ------------------------------------------------------------------ 我拥有的 */

export const D_Q2 = mine({ id: "q2", title: "2026 年 Q2 业绩汇报", cover: "q2", editor: "王小明", when: "2 小时前", collaborators: [WANG, LI], pinned: true, alive: true })
export const D_UNTITLED = mine({ id: "untitled", title: "未命名演示文稿", cover: null, editor: "我", when: "刚刚", alive: true })
export const D_Q4 = mine({ id: "q4-market", title: "Q4 市场计划", cover: "q4-market", editor: "我", when: "昨天" })
export const D_REVIEW = mine({ id: "review", title: "设计评审", cover: "review", editor: "我", when: "3 天前" })
export const D_Q3_BUDGET = mine({ id: "q3-budget", title: "Q3 预算执行情况", cover: "q3-budget", editor: "赵敏", when: "10 月 9 日", collaborators: [P_ZHAO, LI] })
export const D_ONBOARDING = mine({ id: "onboarding", title: "新人培训手册", cover: "onboarding", editor: "我", when: "2 周前" })
export const D_VENDOR = mine({ id: "vendor", title: "供应商评估", cover: "vendor", editor: "我", when: "9 月 30 日" })
export const D_OKR = mine({ id: "okr", title: "季度 OKR 复盘", cover: "okr", editor: "王小明", when: "9 月 28 日", collaborators: [WANG, ZHANG] })
export const D_BUDGET = mine({ id: "budget", title: "年度预算", cover: "budget", editor: "我", when: "9 月 12 日" })

/* ------------------------------------------------------------------ 别人共享给我的 */

export const D_ROADMAP = theirs(LI, "editor", { id: "roadmap", title: "产品路线图", cover: "roadmap", editor: "李雷", when: "昨天" })
export const D_BUDGET_2027 = theirs(P_ZHAO, "commenter", { id: "budget-2027", title: "2027 预算编制说明", cover: "budget-2027", editor: "赵敏", when: "5 天前" })
export const D_HIRING = theirs(ZHANG, "commenter", { id: "hiring", title: "招聘计划", cover: "hiring", editor: "张三", when: "上周" })
export const D_CAMPAIGN = theirs(P_CHEN, "viewer", { id: "campaign", title: "市场活动复盘", cover: "campaign", editor: "陈静", when: "10 月 8 日" })
export const D_SALES = theirs(P_ZHENG, "editor", { id: "sales", title: "销售培训课件", cover: "sales", editor: "郑凯", when: "9 月 25 日" })
export const D_CASES = theirs(LI, "viewer", { id: "cases", title: "客户成功案例", cover: "cases", editor: "李雷", when: "9 月 21 日" })

/* ------------------------------------------------------------------ 回收站（只列我拥有的，60/15 §3.3 filter=trashed） */

export const D_OLD_INTRO = mine({ id: "old-intro", title: "旧版产品介绍", cover: "old-intro", editor: "我", when: "8 月 2 日", trashed: { ago: "9 天前", daysLeft: 21 } })
export const D_TEAM = mine({ id: "teambuilding", title: "团建方案（草稿）", cover: "teambuilding", editor: "我", when: "9 月 1 日", trashed: { ago: "16 天前", daysLeft: 14 } })
export const D_WEEKLY = mine({ id: "q1-weekly", title: "Q1 周报合集", cover: "q1-weekly", editor: "我", when: "4 月 3 日", trashed: { ago: "27 天前", daysLeft: 3 } })

/* ------------------------------------------------------------------ 各视图（rulings §4.25 DS-79、DS-84） */

/**
 * 「最近」：按我最近打开的时间倒序，固定的排在最前（DS-84；首页 mergeRecent 同一口径，50/02 §9.1）。
 * 卡片第二行仍是「编辑者 · 编辑时间」（DS-83，同 Figma Recents 的「Edited …」），排序看的是打开时间。
 * 前 8 份就是开始页的「最近」（AS-02 最多 8 条）。
 */
export const RECENT: LibDoc[] = [D_Q2, D_UNTITLED, D_ROADMAP, D_REVIEW, D_HIRING, D_ONBOARDING, D_OKR, D_CASES, D_BUDGET_2027, D_BUDGET, D_CAMPAIGN, D_VENDOR]

/** 开始页「最近」：同一份列表的前 8 条 */
export const HOME_RECENT: LibDoc[] = RECENT.slice(0, 8)

/** 「我的文档」：我拥有的，按最近活动（内容编辑）时间倒序（DS-84，不加排序菜单） */
export const MINE: LibDoc[] = [D_UNTITLED, D_Q2, D_Q4, D_REVIEW, D_Q3_BUDGET, D_ONBOARDING, D_VENDOR, D_OKR, D_BUDGET]

/** 「与我共享」：别人拥有、我有直接授权的，按最近活动时间倒序 */
export const SHARED: LibDoc[] = [D_ROADMAP, D_BUDGET_2027, D_HIRING, D_CAMPAIGN, D_SALES, D_CASES]

/** 回收站：按移入时间倒序（DS-84） */
export const TRASH: LibDoc[] = [D_OLD_INTRO, D_TEAM, D_WEEKLY]

/** 回收站卡片第二行与读屏名（doc-07）：M3「N 天后永久删除」，M2 没有到期清理「N 天前移到回收站」，进行中「正在永久删除」 */
export const trashLine = (d: LibDoc, m2?: boolean): string => (m2 ? `${d.trashed?.ago}移到回收站` : `${d.trashed?.daysLeft} 天后永久删除`)
export const trashLabel = (d: LibDoc, o: { m2?: boolean; purging?: boolean; title?: string } = {}): string => {
  const t = o.title ?? d.title
  if (o.purging) return `${t}，正在永久删除`
  return o.m2 ? `${t}，${trashLine(d, true)}` : `${t}，在回收站中，${trashLine(d)}`
}

/** 能访问的全部文档（搜索的范围，不含回收站，P2） */
export const ALL: LibDoc[] = [...MINE, ...SHARED]

/** 搜索：标题包含关键词（大小写不敏感）；结果按最近活动排列。样张只按标题匹配，产品为服务端检索（50/02 §9.2 q=，去抖 300 ms） */
export function searchDocs(q: string): LibDoc[] {
  const k = q.trim().toLowerCase()
  if (!k) return []
  const order = [D_UNTITLED, D_Q2, D_ROADMAP, D_Q4, D_REVIEW, D_BUDGET_2027, D_HIRING, D_Q3_BUDGET, D_CAMPAIGN, D_ONBOARDING, D_VENDOR, D_OKR, D_SALES, D_CASES, D_BUDGET]
  return order.filter((d) => d.title.toLowerCase().includes(k))
}

export type ViewId = "recent" | "mine" | "shared" | "trash"

export const VIEW_TITLE: Record<ViewId, string> = { recent: "最近", mine: "我的文档", shared: "与我共享", trash: "回收站" }

export const VIEW_DOCS: Record<ViewId, LibDoc[]> = { recent: RECENT, mine: MINE, shared: SHARED, trash: TRASH }

/** 卡片徽标（01 §5.1、rulings §4.18 UX-19：查看者与评审者打开后的界面不同，所以分两种） */
export const ROLE_TAG: Partial<Record<DocRole, string>> = { viewer: "仅查看", commenter: "可评论" }

/** 打开文档落到编辑器的哪一形态（按我的角色：编辑 / 评审 / 只读浏览，第 1 批 main-states）：卡片链接与 openDoc 同一份 */
export const openState = (d: { role?: DocRole }): string => (d.role === "viewer" ? "main-states.viewer" : d.role === "commenter" ? "main-states.commenter" : "empty")
