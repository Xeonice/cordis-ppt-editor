import { LI, ME, toneOf, WANG, ZHANG, type Box, type Person } from "../../kit"

/**
 * 评论场景（03-06）的数据：人物与角色、线程与回复、锚点、筛选与排序、权限。
 * 数据形状按 50/08 §3（Thread / Reply，线程没有正文、首条回复即发起评论；锚点 kind 为 slide / element / text，
 * 状态 anchored / detached 每次派生），这里为了样张直接写成派生后的样子（detached、broken）。
 * 示例文档第 4 页的三条评论沿用第 1 批（main-states、narrow）同一批人、同一内容与同一落点，第 2 批补回复、已解决与其他页。
 */

/* ------------------------------------------------------------------ 人物与角色 */

/** PRD CO-04 §1 角色：owner 所有者 · editor 编辑者 · commenter 评审者（评论者）· viewer 查看者 */
export type Role = "owner" | "editor" | "commenter" | "viewer"

export const ROLE_LABEL: Record<Role, string> = { owner: "所有者", editor: "编辑者", commenter: "评审者", viewer: "查看者" }

export interface User extends Person {
  id: string
  role: Role
  /** 在场（候选里排在最前，05 §1a、50/08 §4） */
  online?: boolean
}

/** 自己：周明远（data.ts ME，slate）。角色随状态（data.role）变，身份不变 */
export const ME_ID = "u-zhou"

export const U = {
  zhou: { ...ME, id: ME_ID, role: "owner", online: true },
  wang: { ...WANG, id: "u-wang", role: "editor", online: true },
  li: { ...LI, id: "u-li", role: "commenter", online: true },
  zhang: { ...ZHANG, id: "u-zhang", role: "editor" },
  /** 第 2 批新增的人物按用户 id 取身份色（kit toneOf，README §3a） */
  chen: { name: "陈静", tone: toneOf("u-chen"), id: "u-chen", role: "editor" },
} satisfies Record<string, User>

/** @ 候选（50/08 §4：当前在场的排在最前，其余按最近协作；不含自己） */
export const MENTION_CANDIDATES: User[] = [U.wang, U.li, U.chen, U.zhang]

/* ------------------------------------------------------------------ 线程 */

export type AnchorKind = "element" | "text" | "page"

export interface Anchor {
  kind: AnchorKind
  /** 锚点说明：元素名（类型 + 序号，07 §3）、文本范围的引文、整页 */
  label: string
  /** 评论钉落点（幻灯片百分比，钉尖指向它） */
  x: number
  y: number
  /** 锚点对象（或文本范围）的范围：选中这条评论时在画布上虚线标出（元素）或淡底标出（文本范围） */
  box?: Box
  /** 已脱离锚点（原对象已删除，PRD CO-04）：谁、什么时候删的；墓碑 TTL 内以原 id 恢复后回到原处 */
  detached?: { by: string; when: string }
  /** 单条线程的锚点解析失败（50/08 §5、§11）：只影响这一条，内容仍可读 */
  broken?: boolean
}

export interface Reply {
  id: string
  by: User
  when: string
  body: string
  /** 编辑过：「已编辑」，工具提示写编辑时间 */
  edited?: string
  /** 离线时本端尚未同步（50/08 §11）：「待同步」 */
  pending?: boolean
  /** 已解决之后到达的回复（05 §5 场景 J） */
  afterResolve?: boolean
  /** 首条评论被作者删除、线程里还有回复时：只留「此评论已删除」（50/08 §3：删除只置 deletedAt 并清空正文） */
  deleted?: boolean
}

export interface Thread {
  id: string
  page: number
  anchor: Anchor
  /** 发起人（评审者只能解决自己发起的线程，PRD §1） */
  createdBy: string
  replies: Reply[]
  resolved?: { by: User; when: string }
  /** 最近一次活动距今的分钟数（排序用：最新 / 最旧） */
  activity: number
  /** 从 pptx 导入的批注（50/08 §7）：作者名取自 commentAuthors，没有用户 id 与身份色；editable 为已「导入为可编辑评论」（P1） */
  imported?: { author: string; source: "modern" | "legacy"; editable?: boolean }
}

/** 只读的导入批注：不能回复、解决与编辑 */
export const readOnlyImport = (t: Thread) => !!t.imported && !t.imported.editable

/* ------------------------------------------------------------------ 锚点范围（示例文档各页对象的位置，幻灯片百分比） */

/** 第 4 页：标题、说明文字、柱状图（SlideArt Trend：图表 svg 宽 86cqw、高 28cqw，自 22cqw 起） */
export const P4_TITLE: Box = { x: 7, y: 11, w: 19, h: 10 }
export const P4_TEXT: Box = { x: 7, y: 28.4, w: 78, h: 6.6 }
export const P4_RANGE: Box = { x: 59.4, y: 28.9, w: 11.2, h: 5.6 }
export const P4_CHART: Box = { x: 7, y: 39.1, w: 86, h: 49.8 }

/** 页上可点选的对象（评论工具点在对象上时成为元素锚点，点在空白处为页级锚点） */
export const PAGE_OBJECTS: Record<number, { label: string; box: Box }[]> = {
  1: [
    { label: "标题 1", box: { x: 9.3, y: 31.2, w: 72, h: 16.6 } },
    { label: "副标题 2", box: { x: 10.5, y: 50.5, w: 40, h: 7.5 } },
  ],
  2: [
    { label: "标题 1", box: { x: 7, y: 11, w: 10, h: 10 } },
    { label: "列表 2", box: { x: 7, y: 33.8, w: 54.5, h: 51.2 } },
    { label: "要点卡", box: { x: 65.5, y: 43, w: 27.5, h: 32.6 } },
  ],
  3: [
    { label: "标题 1", box: { x: 7, y: 11, w: 21, h: 10 } },
    { label: "营收卡片", box: { x: 7, y: 33.8, w: 26.7, h: 48.9 } },
    { label: "活跃客户卡片", box: { x: 36.7, y: 33.8, w: 26.7, h: 48.9 } },
    { label: "毛利率卡片", box: { x: 66.3, y: 33.8, w: 26.7, h: 48.9 } },
  ],
  4: [
    { label: "标题 1", box: P4_TITLE },
    { label: "文本框 2", box: P4_TEXT },
    { label: "图表 1", box: P4_CHART },
  ],
  5: [
    { label: "标题 1", box: { x: 7, y: 11, w: 21, h: 10 } },
    { label: "图表 1", box: { x: 8, y: 30.2, w: 31, h: 55.1 } },
    { label: "表格 2", box: { x: 51, y: 30.2, w: 42, h: 57.6 } },
  ],
  6: [
    { label: "标题 1", box: { x: 7, y: 11, w: 26, h: 10 } },
    { label: "计划 1", box: { x: 7, y: 37.3, w: 26, h: 44 } },
    { label: "计划 2", box: { x: 37, y: 37.3, w: 26, h: 44 } },
    { label: "计划 3", box: { x: 67, y: 37.3, w: 26, h: 44 } },
  ],
}

/** 页级评论（在面板底部撰写，没有点选位置）的钉落在幻灯片右上角 */
export const PAGE_PIN = { x: 94, y: 8.5 }

/* ------------------------------------------------------------------ 示例线程 */

const t1 = (): Thread => ({
  id: "t1",
  page: 4,
  anchor: { kind: "element", label: "图表 1", x: 90.6, y: 50.5, box: P4_CHART },
  createdBy: U.wang.id,
  activity: 40,
  replies: [
    { id: "r1", by: U.wang, when: "2 小时前", body: "6 月的数据是否包含海外业务？建议在图注里写清口径。" },
    { id: "r2", by: U.li, when: "1 小时前", body: "包含，海外占 6%。图注我来补一句。" },
    { id: "r3", by: U.zhou, when: "40 分钟前", body: "@李雷 补完后我再核一遍数字。" },
  ],
})

const t2 = (): Thread => ({
  id: "t2",
  page: 4,
  anchor: { kind: "text", label: "「1.28 亿元」", x: 70.6, y: 28.2, box: P4_RANGE },
  createdBy: U.li.id,
  activity: 1440,
  replies: [{ id: "r4", by: U.li, when: "昨天", body: "Q2 累计与财务报表对了一遍，数字一致。" }],
})

const t3 = (): Thread => ({
  id: "t3",
  page: 4,
  anchor: { kind: "element", label: "图表 1", x: 21, y: 56, box: P4_CHART },
  createdBy: U.zhang.id,
  activity: 2880,
  resolved: { by: U.zhou, when: "1 天前" },
  replies: [
    { id: "r5", by: U.zhang, when: "3 天前", body: "1–3 月用浅色、Q2 用深色，对比会更清楚。" },
    { id: "r6", by: U.zhou, when: "2 天前", body: "已按建议改色。" },
  ],
})

const t4 = (): Thread => ({
  id: "t4",
  page: 1,
  anchor: { kind: "page", label: "整页", ...PAGE_PIN },
  createdBy: U.zhou.id,
  activity: 1500,
  replies: [
    { id: "r7", by: U.zhou, when: "昨天", body: "副标题能不能和第 6 页的三项计划对应起来？" },
    { id: "r8", by: U.wang, when: "昨天", body: "可以，我把「效率」改成「交付效率」。" },
  ],
})

const t5 = (): Thread => ({
  id: "t5",
  page: 3,
  anchor: { kind: "text", label: "「+3pt」", x: 77.6, y: 73, box: { x: 68.9, y: 72.9, w: 8.6, h: 5.3 } },
  createdBy: U.chen.id,
  activity: 180,
  replies: [{ id: "r9", by: U.chen, when: "3 小时前", body: "@周明远 毛利率这里写 pt 还是百分点？财务口径用的是百分点。" }],
})

const t7 = (): Thread => ({
  id: "t7",
  page: 5,
  anchor: { kind: "element", label: "表格 2", x: 92, y: 79, box: { x: 51, y: 30.2, w: 42, h: 57.6 } },
  createdBy: U.li.id,
  activity: 10080,
  resolved: { by: U.wang, when: "上周" },
  replies: [
    { id: "r10", by: U.li, when: "上周", body: "海外 6% 的口径和第 4 页的图注一致吗？" },
    { id: "r11", by: U.wang, when: "上周", body: "一致，图注已经补上。" },
  ],
})

/** 已脱离锚点：第 5 页的图注文本框被张三删除（王小明正是建议删掉它的人） */
const t6 = (): Thread => ({
  id: "t6",
  page: 5,
  anchor: { kind: "element", label: "文本框 4", x: 0, y: 0, detached: { by: "张三", when: "昨天 18:20" } },
  createdBy: U.wang.id,
  activity: 1600,
  replies: [{ id: "r12", by: U.wang, when: "昨天", body: "这条图注和第 4 页的口径说明重复了，删掉吧？" }],
})

/** 锚点无法解析（50/08 §5）：内容仍可读，没有钉 */
const t10 = (): Thread => ({
  id: "t10",
  page: 6,
  anchor: { kind: "text", label: "「NPS 提升至 55 以上」", x: 0, y: 0, broken: true },
  createdBy: U.zhang.id,
  activity: 4300,
  replies: [{ id: "r13", by: U.zhang, when: "3 天前", body: "55 这个目标有出处吗？上季度是 48。" }],
})

/** 批量删除后的另外两条已脱离锚点的线程（「已脱离锚点 (3)」） */
const t11 = (): Thread => ({
  id: "t11",
  page: 6,
  anchor: { kind: "element", label: "图片 2", x: 0, y: 0, detached: { by: "张三", when: "昨天 18:20" } },
  createdBy: U.chen.id,
  activity: 1700,
  replies: [{ id: "r14", by: U.chen, when: "昨天", body: "这张截图分辨率太低，放映时会糊。" }],
})

const t12 = (): Thread => ({
  id: "t12",
  page: 6,
  anchor: { kind: "element", label: "矩形 5", x: 0, y: 0, detached: { by: "张三", when: "昨天 18:20" } },
  createdBy: U.li.id,
  activity: 1720,
  replies: [{ id: "r15", by: U.li, when: "昨天", body: "这个色块的颜色和主题不一致。" }],
})

/** 第 3 页毛利率卡片右上角的三条评论：落点几乎重合，合并成聚合钉「3」（03-06 边界情况）；「+3pt」上陈静那条仍是单独的钉 */
const MARGIN_CARD: Box = { x: 66.3, y: 33.8, w: 26.7, h: 48.9 }
const clusterThreads = (): Thread[] => [
  {
    id: "t8",
    page: 3,
    anchor: { kind: "element", label: "毛利率卡片", x: 89.3, y: 46.2, box: MARGIN_CARD },
    createdBy: U.wang.id,
    activity: 95,
    replies: [{ id: "r16", by: U.wang, when: "2 小时前", body: "62% 是季度均值还是 6 月当月？" }],
  },
  {
    id: "t9",
    page: 3,
    anchor: { kind: "element", label: "毛利率卡片", x: 90.4, y: 47.8, box: MARGIN_CARD },
    createdBy: U.zhang.id,
    activity: 400,
    replies: [{ id: "r17", by: U.zhang, when: "5 小时前", body: "建议加一句毛利率提升的原因。" }],
  },
  {
    id: "t13",
    page: 3,
    anchor: { kind: "element", label: "毛利率卡片", x: 88.4, y: 48.6, box: MARGIN_CARD },
    createdBy: U.chen.id,
    activity: 520,
    replies: [{ id: "r19", by: U.chen, when: "6 小时前", body: "和去年同期比是 +3pt，这里写清楚基期。" }],
  },
]

/** 长评论（折叠 3 行 + 展开）、链接、提及与「已编辑」 */
const t1Long = (): Thread => ({
  ...t1(),
  replies: [
    {
      id: "r1",
      by: U.wang,
      when: "2 小时前",
      edited: "今天 10:42",
      body:
        "6 月的数据是否包含海外业务？如果包含，建议在图注里写清口径，并和第 5 页「区域分布」里海外 6% 的数字对齐；如果不包含，标题里的「创年内新高」需要再确认一下，免得放映时被问住。",
    },
    { id: "r2", by: U.li, when: "1 小时前", body: "包含，海外占 6%。口径说明见 https://wiki.example.com/finance/q2-overseas\n@周明远 图注我来补一句。" },
  ],
})

/** 从 pptx 导入的只读批注（现代评论与旧式评论各一条） */
const importedThreads = (): Thread[] => [
  {
    id: "i1",
    page: 2,
    anchor: { kind: "element", label: "要点卡", x: 92.6, y: 43.6, box: { x: 65.5, y: 43, w: 27.5, h: 32.6 } },
    createdBy: "",
    activity: 30000,
    imported: { author: "Ming Zhou", source: "modern" },
    replies: [
      { id: "ir1", by: { ...U.zhou, name: "Ming Zhou", id: "" }, when: "9 月 28 日", body: "要点卡里补一句毛利提升的原因？" },
      { id: "ir2", by: { ...U.wang, name: "Xiaoming Wang", id: "" }, when: "9 月 29 日", body: "已补，见第 3 页。" },
    ],
  },
  {
    id: "i2",
    page: 2,
    anchor: { kind: "element", label: "列表 2", x: 56, y: 52, box: { x: 7, y: 33.8, w: 54.5, h: 51.2 } },
    createdBy: "",
    activity: 30100,
    imported: { author: "Xiaoming Wang", source: "legacy" },
    replies: [{ id: "ir3", by: { ...U.wang, name: "Xiaoming Wang", id: "" }, when: "9 月 27 日", body: "议程第 3 项与第 5 页标题不一致。" }],
  },
]

export type Dataset = "base" | "all" | "detached" | "cluster" | "long" | "imported" | "empty" | "resolved-reply" | "deleted-reply" | "offline" | "deck"

/**
 * 各状态用的线程集（data.dataset）。base：示例文档 6 条（第 4 页 3 条，其中 1 条已解决）。
 * deck：第 1 批（编辑器族）的示例文档原样——只有第 4 页的 3 条、都未解决（与底座 DECK_PINS 的 3 枚评论钉、缩略图角标「3」、检查器缺省列表同一批人同一内容；
 * 张三那条只有发起的一句，不带第 2 批补的「已按建议改色」回复），第 1 批评审 / 只读 / 窄屏形态换成本场景的评论面板时用它（rulings §4.25 DS-62、DS-46）。
 */
export function threadsFor(ds: Dataset = "base"): Thread[] {
  switch (ds) {
    case "deck": {
      const z = t3()
      return [t1(), t2(), { ...z, resolved: undefined, replies: z.replies.slice(0, 1) }]
    }
    case "all":
      return [t1(), t2(), t3(), t4(), t5(), t7(), t6(), t10()]
    case "detached":
      return [t1(), t2(), t3(), t4(), t5(), t7(), t6(), t11(), t12()]
    case "cluster":
      return [t1(), t2(), t3(), t4(), t5(), ...clusterThreads(), t7()]
    case "deleted-reply": {
      const r = t1()
      r.replies = r.replies.filter((x) => x.id !== "r3")
      return [r, t2(), t3(), t4(), t5(), t7()]
    }
    case "offline":
      return [
        {
          id: "t14",
          page: 4,
          anchor: { kind: "element", label: "图表 1", x: 93.2, y: 41.6, box: P4_CHART },
          createdBy: U.zhou.id,
          activity: 1,
          replies: [{ id: "r20", by: U.zhou, when: "刚刚", body: "图表单位写「百万元」，说明文字写「万元」，统一成万元？", pending: true }],
        },
        t1(),
        t2(),
        t3(),
        t4(),
        t5(),
        t7(),
      ]
    case "long":
      return [t1Long(), t2(), t3(), t4(), t5(), t7()]
    case "imported":
      return [...importedThreads(), t1(), t2(), t3(), t4(), t5(), t7()]
    case "empty":
      return []
    case "resolved-reply": {
      const r = t3()
      r.activity = 5
      r.replies = [...r.replies, { id: "r18", by: U.zhang, when: "刚刚", body: "Q2 的深色和标题的蓝色太接近了，再浅一点？", afterResolve: true }]
      return [t1(), t2(), r, t4(), t5(), t7()]
    }
    default:
      return [t1(), t2(), t3(), t4(), t5(), t7()]
  }
}

/* ------------------------------------------------------------------ 筛选、排序与计数 */

/** 筛选（PRD CO-04）：全部 · 当前页 · 未解决 · @我；有已脱离锚点的线程时另有临时筛选 detached */
export type Filter = "all" | "page" | "open" | "mine" | "detached"
export type Sort = "newest" | "oldest" | "page"

export const SORT_LABEL: Record<Sort, string> = { newest: "最新", oldest: "最旧", page: "按页码" }

export const mentionsMe = (t: Thread) => t.replies.some((r) => r.body.includes(`@${U.zhou.name}`))

export function applyFilter(list: Thread[], f: Filter, slide: number): Thread[] {
  switch (f) {
    case "page":
      return list.filter((t) => t.page === slide)
    case "open":
      return list.filter((t) => !t.resolved)
    case "mine":
      return list.filter(mentionsMe)
    case "detached":
      return list.filter((t) => !!t.anchor.detached)
    default:
      return list
  }
}

/** 排序后未解决在前、已解决折叠在后（同一组内） */
export function applySort(list: Thread[], s: Sort): Thread[] {
  const byTime = (a: Thread, b: Thread) => (s === "oldest" ? b.activity - a.activity : a.activity - b.activity)
  const cmp = (a: Thread, b: Thread) => (s === "page" ? a.page - b.page || byTime(a, b) : byTime(a, b))
  return [...list].sort((a, b) => Number(!!a.resolved) - Number(!!b.resolved) || cmp(a, b))
}

/** 按页分组（「当前页」与「按页码」时）：[页码, 线程][]，组内未解决在前 */
export function groupByPage(list: Thread[]): [number, Thread[]][] {
  const m = new Map<number, Thread[]>()
  for (const t of list) m.set(t.page, [...(m.get(t.page) ?? []), t])
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([p, ts]) => [p, [...ts].sort((a, b) => Number(!!a.resolved) - Number(!!b.resolved))])
}

/** 某页未解决 / 已解决线程数（缩略图角标 = 未解决数，工具提示「另有 N 条已解决」，03-06） */
export function pageCounts(list: Thread[], page: number) {
  const on = list.filter((t) => t.page === page)
  return { open: on.filter((t) => !t.resolved).length, resolved: on.filter((t) => !!t.resolved).length }
}

/** 画布上有钉的线程：已锚定（非脱离、非解析失败）、未解决；选中的已解决线程临时显示 */
export function pinned(list: Thread[], page: number, selected?: string | null): Thread[] {
  return list.filter((t) => t.page === page && !t.anchor.detached && !t.anchor.broken && (!t.resolved || t.id === selected))
}

/** 评审条 / 浏览条「上一处 / 下一处评论」的次序：未解决、已锚定，按页码与落点 */
export function navOrder(list: Thread[]): Thread[] {
  return list
    .filter((t) => !t.resolved && !t.anchor.detached && !t.anchor.broken)
    .sort((a, b) => a.page - b.page || a.anchor.y - b.anchor.y || a.anchor.x - b.anchor.x)
}

/* ------------------------------------------------------------------ 权限（PRD CO-04 §1、50/08 §4） */

export interface Perms {
  role: Role
  /** 发表、回复（commenter 及以上） */
  comment: boolean
  resolve: (t: Thread) => boolean
  editReply: (r: Reply) => boolean
  deleteReply: (r: Reply) => boolean
  /** 删除整条讨论串：只有文档所有者（doc.manage） */
  deleteThread: boolean
  copyLink: boolean
}

export function permsFor(role: Role): Perms {
  const comment = role !== "viewer"
  return {
    role,
    comment,
    resolve: (t) => comment && !readOnlyImport(t) && (role === "owner" || role === "editor" || t.createdBy === ME_ID),
    editReply: (r) => comment && r.by.id === ME_ID,
    deleteReply: (r) => comment && (r.by.id === ME_ID || (role === "owner" && r.by.id !== "")),
    deleteThread: role === "owner",
    copyLink: comment,
  }
}

/** 评审者不能解决他人发起的线程：按钮留在原位、不可用，写原因（FE-06） */
export const RESOLVE_REASON = "只能解决自己发起的评论"
/** 从 pptx 导入的只读批注不能解决（先「导入为可编辑评论」） */
export const IMPORT_RESOLVE_REASON = "来自原文件的批注不能解决"
/** 「解决」不可用的原因：导入批注按导入说，其余按角色说 */
export const resolveReason = (t: Thread) => (readOnlyImport(t) ? IMPORT_RESOLVE_REASON : RESOLVE_REASON)

/** 撰写框字数上限（PRD CO-04） */
export const MAX_CHARS = 5000

/** 文本里的 @提及（已知用户名）与链接：渲染时提及加粗、链接加下划线（不用强调色，Q3） */
export const MENTION_NAMES = [U.zhou, U.wang, U.li, U.zhang, U.chen].map((u) => u.name)
