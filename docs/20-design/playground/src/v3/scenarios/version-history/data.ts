import { LI, ME, WANG, ZHANG, type Person } from "../../kit"
import type { DeckKey } from "./slides"

/**
 * 版本历史的示例数据。「现在」是 2026-10-08（周四）14:40 前后；文档 7 月 28 日从 .pptx 导入。
 * 列表口径（50/08 §9、03-07「边界情况」、rulings §4.25 DS-57）：按天分组、按月折叠（默认展开最近一个月 = 10 月）；
 * 同一天里相邻两条及以上的自动版本收成一行「N 个自动版本 起–止」（点开再列，新的在前），只有一条时单列——数据只写「每天有哪些版本」（Day），
 * 收组、组的条数与起止时刻、月份行的摘要都由 groupDay / monthItem 推导，不手写结果（同一份规则也作用于恢复、命名之后新增的版本）。
 * 带「恢复前」标记的自动版本不并进组里：它是恢复留下的找回点，要一眼看得到（DS-57「恢复后列表最前出现…与标『恢复前』的自动版本」）。
 * 30 天以前（9 月 8 日之前）每天只留当天最后一个自动版本，标「当日最后版本」；命名版本永久保留；「加载更早版本」按游标翻页（这里第二页是 7 月）。
 * 种类（SnapshotMeta.kind）：auto 自动 · named 命名 · restore 恢复（「恢复自『X』」）· import 导入；migration / epoch 的系统标签同 import 的画法，样张不单列。
 */

export type VersionKind = "auto" | "named" | "restore" | "import"

export interface Version {
  id: string
  kind: VersionKind
  /** 列表里的时刻 */
  time: string
  /** 横幅、确认卡与提示里的「哪天 + 时刻」，如「昨天 16:20」 */
  when: string
  /** 命名版本的名称（≤ 30 字） */
  name?: string
  /** 命名版本的说明（可选） */
  note?: string
  /** 恢复版本：恢复自哪个版本（命名版本写名称，否则写时间） */
  from?: string
  /** 导入版本：源文件名 */
  file?: string
  /** 作者（命名、恢复、导入）或这一时段的贡献者（自动版本，SnapshotMeta.contributors） */
  by: Person[]
  /** 预览时画布与左栏显示的内容 */
  deck: DeckKey
  /** 30 天以前：当日最后版本 */
  last?: boolean
  /** 恢复前自动保存的版本（恢复时服务端先落的 auto 快照，60/05 §10），列表里带「恢复前」标记 */
  preRestore?: boolean
}

/** 列表里的一行（由 Day / Month 推导，见 groupDay、monthItem） */
export type Item =
  | { t: "day"; id: string; label: string }
  | { t: "v"; v: Version }
  | { t: "run"; id: string; range: string; versions: Version[] }
  | { t: "month"; id: string; label: string; summary: string; items: Item[] }

/** 一天：日期小标题 + 当天的版本（新的在前）；列表里的各行由 groupDay 推导 */
export interface Day {
  /** 日期小标题的 id（d-today、d-0928…），组 id 由它推导 */
  id: string
  label: string
  versions: Version[]
}

/** 更早的一个月（默认收起成一行「9 月 · 2 个命名版本」，摘要由当月版本推导）；展开后按天列出 */
export interface Month {
  id: string
  label: string
  days: Day[]
}

const auto = (id: string, time: string, day: string, by: Person[], deck: DeckKey, last?: boolean): Version => ({
  id,
  kind: "auto",
  time,
  when: `${day} ${time}`,
  by,
  deck,
  last,
})

const named = (id: string, time: string, day: string, name: string, note: string, by: Person[], deck: DeckKey): Version => ({
  id,
  kind: "named",
  time,
  when: `${day} ${time}`,
  name,
  note,
  by,
  deck,
})

const T = "今天"
const Y = "昨天"

/* ------------------------------------------------------------------ 10 月（默认展开） */

/** 今天：7 个自动版本（14:32 最新），相邻，收成「7 个自动版本 09:40–14:32」 */
const TODAY: Day = {
  id: "d-today",
  label: "今天",
  versions: [
    auto("a-1432", "14:32", T, [ME], "stock"),
    auto("a-1350", "13:50", T, [WANG, LI], "d1350"),
    auto("a-1310", "13:10", T, [WANG], "d1350"),
    auto("a-1150", "11:50", T, [LI], "proposal"),
    auto("a-1040", "10:40", T, [ME, LI], "proposal"),
    auto("a-1010", "10:10", T, [ME], "proposal"),
    auto("a-0940", "09:40", T, [ME], "proposal"),
  ],
}

export const PROPOSAL = named("n-proposal", "16:20", Y, "提案定稿", "交财务核对前的版本，数字以此为准", [LI], "proposal")

const YDAY: Day = {
  id: "d-yday",
  label: "昨天",
  versions: [
    PROPOSAL,
    auto("a-y1550", "15:50", Y, [LI], "proposal"),
    auto("a-y1510", "15:10", Y, [LI, WANG], "proposal"),
    auto("a-y1430", "14:30", Y, [WANG], "proposal"),
    auto("a-y1340", "13:40", Y, [ME], "draft"),
    auto("a-y1150", "11:50", Y, [ME], "draft"),
    auto("a-y1110", "11:10", Y, [ME, ZHANG], "draft"),
    auto("a-y1030", "10:30", Y, [ZHANG], "draft"),
    auto("a-y0950", "09:50", Y, [ME], "draft"),
    auto("a-y0910", "09:10", Y, [ME], "draft"),
  ],
}

export const DRAFT = named("n-draft", "18:05", "10 月 6 日", "初稿", "结构和图表齐全，区域分布待补", [ME], "draft")

const D1006: Day = {
  id: "d-1006",
  label: "10 月 6 日",
  versions: [
    DRAFT,
    auto("a-1006a", "17:30", "10 月 6 日", [ME], "draft"),
    auto("a-1006b", "16:40", "10 月 6 日", [ME], "draft"),
    auto("a-1006c", "15:20", "10 月 6 日", [ZHANG], "early"),
    auto("a-1006d", "14:10", "10 月 6 日", [ME], "early"),
  ],
}

/**
 * 10 月 2 日只有一个自动版本（16:48，张三）：留作「只有一条时单列」的示例，默认态里就能看到单个自动版本一行的样子
 * （标杆对照：原来这一天有相邻的两条却没有收组；二选一取了「改成只有一条」，另一种是两条都留着、收成「2 个自动版本 10:05–16:48」）
 */
const D1002: Day = { id: "d-1002", label: "10 月 2 日", versions: [auto("a-1002", "16:48", "10 月 2 日", [ZHANG], "early")] }

/** 最近一个月（默认展开）的各天，新的在前 */
export const RECENT: Day[] = [TODAY, YDAY, D1006, D1002]

/* ------------------------------------------------------------------ 9 月、8 月（默认收起） */

const M09: Month = {
  id: "m-09",
  label: "9 月",
  days: [
    {
      id: "d-0928",
      label: "9 月 28 日",
      versions: [
        named("n-review", "17:40", "9 月 28 日", "管理层预审", "按管理层意见调整了区域分布页", [WANG], "early"),
        auto("a-0928a", "17:10", "9 月 28 日", [WANG], "early"),
        auto("a-0928b", "15:40", "9 月 28 日", [WANG, LI], "early"),
        auto("a-0928c", "14:20", "9 月 28 日", [LI], "early"),
        auto("a-0928d", "11:00", "9 月 28 日", [ME], "early"),
        auto("a-0928e", "09:30", "9 月 28 日", [ME], "early"),
      ],
    },
    {
      id: "d-0915",
      label: "9 月 15 日",
      versions: [auto("a-0915a", "16:20", "9 月 15 日", [ME], "early"), auto("a-0915b", "15:10", "9 月 15 日", [ME], "early"), auto("a-0915c", "14:00", "9 月 15 日", [ZHANG], "early")],
    },
    // 30 天以前：每天只留最后一个自动版本（当日最后版本），单列
    { id: "d-0907", label: "9 月 7 日", versions: [auto("a-0907", "21:10", "9 月 7 日", [ME], "early", true)] },
    { id: "d-0903", label: "9 月 3 日", versions: [auto("a-0903", "18:22", "9 月 3 日", [LI], "early", true)] },
    {
      id: "d-0902",
      label: "9 月 2 日",
      versions: [auto("a-0902", "19:05", "9 月 2 日", [ME], "early", true), named("n-outline", "11:30", "9 月 2 日", "结构草案", "先搭目录与版式", [ME], "early")],
    },
  ],
}

const M08: Month = {
  id: "m-08",
  label: "8 月",
  days: [
    {
      id: "d-0826",
      label: "8 月 26 日",
      versions: [auto("a-0826", "18:40", "8 月 26 日", [ME], "early", true), named("n-scope", "10:20", "8 月 26 日", "选题确认", "确定汇报范围：营收、客户与区域", [ME], "early")],
    },
    { id: "d-0819", label: "8 月 19 日", versions: [auto("a-0819", "17:02", "8 月 19 日", [WANG], "early", true)] },
    { id: "d-0806", label: "8 月 6 日", versions: [auto("a-0806", "15:44", "8 月 6 日", [ME], "early", true)] },
  ],
}

/** 更早的月份（默认收起） */
export const OLDER: Month[] = [M09, M08]

/** 「加载更早版本」的第二页：7 月（导入的原始文件） */
export const MORE: Month[] = [
  {
    id: "m-07",
    label: "7 月",
    days: [
      {
        id: "d-0728",
        label: "7 月 28 日",
        versions: [
          auto("a-0728", "16:10", "7 月 28 日", [ME], "early", true),
          { id: "i-0728", kind: "import", time: "15:02", when: "7 月 28 日 15:02", file: "2026 年 Q2 业绩汇报.pptx", by: [ME], deck: "early" },
        ],
      },
    ],
  },
]

/** 空态：刚从 .pptx 导入、还没有别的版本（服务端文档创建时总会写一个 import 快照，60/04 §3.3、rulings §4.19 D-M2-CONTENT） */
export const EMPTY_DAYS: Day[] = [
  { id: "d-today", label: "今天", versions: [{ id: "i-today", kind: "import", time: "09:41", when: "今天 09:41", file: "2026 年 Q2 业绩汇报.pptx", by: [ME], deck: "stock" }] },
]

/* ------------------------------------------------------------------ 收组与列表（由数据推导） */

/** 能并进「N 个自动版本」的：普通自动版本。带「恢复前」标记的单列（恢复留下的找回点，见文件头；收组口径的唯一例外，DS-57 写明，随之回写 03-07） */
const groupable = (v: Version) => v.kind === "auto" && !v.preRestore

/**
 * 一天的各行：日期小标题，然后按先后列出版本——同一天里相邻两条及以上的自动版本收成一行「N 个自动版本 起–止」（起止按先后写，组里新的在前），只有一条时单列。
 * 组 id 由日期 id 推导：d-today → run-today；同一天被命名版本隔开的第二组起加序号（run-today-2…）。状态里的展开（expanded）与滚动（scrollTo）用它。
 */
export function groupDay(day: Day): Item[] {
  const out: Item[] = [{ t: "day", id: day.id, label: day.label }]
  const key = day.id.replace(/^d-/, "")
  let runs = 0
  for (let i = 0; i < day.versions.length; ) {
    const v = day.versions[i]!
    let j = i + 1
    if (groupable(v)) while (j < day.versions.length && groupable(day.versions[j]!)) j++
    if (j - i < 2) out.push({ t: "v", v })
    else {
      const run = day.versions.slice(i, j)
      runs += 1
      out.push({ t: "run", id: runs === 1 ? `run-${key}` : `run-${key}-${runs}`, range: `${run[run.length - 1]!.time}–${run[0]!.time}`, versions: run })
    }
    i = j
  }
  return out
}

/** 月份行的摘要：当月命名版本数；没有命名版本时写「导入版本」（有导入快照）或自动版本数 */
function monthSummary(m: Month): string {
  const all = m.days.flatMap((d) => d.versions)
  const n = all.filter((v) => v.kind === "named").length
  if (n) return `${n} 个命名版本`
  if (all.some((v) => v.kind === "import")) return "导入版本"
  return `${all.length} 个自动版本`
}

/** 更早的一个月：收起时一行，展开后按天列出（各天同样经 groupDay 收组） */
export function monthItem(m: Month): Item {
  return { t: "month", id: m.id, label: m.label, summary: monthSummary(m), items: m.days.flatMap(groupDay) }
}

/**
 * 整个版本列表：最近一个月按天（今天最前面接上本场景里新增的版本：命名、恢复），更早的月份各收成一行，翻页后接上更早的一页。
 * 新增的版本与今天原有的版本一起收组（如命名版本隔开了前后的自动版本、「恢复前」单列），不另外拼行。
 */
export function buildList(days: Day[], older: Month[], extra: Version[], more: Month[]): Item[] {
  const [today, ...rest] = days
  const first: Day = today ? { ...today, versions: [...extra, ...today.versions] } : { id: "d-today", label: "今天", versions: extra }
  return [...[first, ...rest].flatMap(groupDay), ...older.map(monthItem), ...more.map(monthItem)]
}

/**
 * 恢复后「今天」最前面多出的两个版本：恢复版本，和恢复前服务端先落的自动版本（当前更改不会丢失，60/05 §10；标「恢复前」、单列）。
 * seq：这是本场景里第几次恢复（从 0 起），第二次起 id 加序号，免得两次恢复的行同 id
 */
export function restoredVersions(from: Version, by: Person[], seq = 0): Version[] {
  const s = seq ? `-${seq + 1}` : ""
  return [
    { id: `r-1441${s}`, kind: "restore", time: "14:41", when: "今天 14:41", from: callOf(from), by, deck: from.deck },
    { ...auto(`a-1441${s}`, "14:41", T, [ME, WANG], "stock"), preRestore: true },
  ]
}

/** 命名当前版本之后「今天」最前面多出的命名版本（seq 同上：第二次起 id 加序号） */
export function namedVersion(name: string, note: string, seq = 0): Version {
  return named(seq ? `n-new-${seq + 1}` : "n-new", "14:40", T, name, note, [ME], "live")
}

/** 示例里命名当前版本的输入 */
export const NEW_NAME = { name: "交付终稿", note: "补齐下半年计划，数字已与财务核对" }

/* ------------------------------------------------------------------ 最近删除（M3，仅所有者；彻底删除元素的唯一入口，rulings §4.18 CO-07） */

export interface Deleted {
  id: string
  /** 元素类型与名称 */
  label: string
  page: number
  by: Person
  /** 删除时间 */
  ago: string
  /** 剩余保留时长（墓碑 TTL，默认 24 h、部署可配；50/04 §7.1） */
  left: string
}

export const DELETED: Deleted[] = [
  { id: "del-1", label: "矩形 3", page: 2, by: WANG, ago: "2 小时前", left: "22 小时后自动清除" },
  { id: "del-2", label: "图片 1", page: 5, by: ME, ago: "今天 09:12", left: "18 小时后自动清除" },
  { id: "del-3", label: "文本框", page: 4, by: LI, ago: "昨天 16:05", left: "1 小时后自动清除" },
]

/* ------------------------------------------------------------------ 取数与文案 */

/** 把分组、折叠行、月份里的版本摊平 */
export function flatVersions(items: Item[]): Version[] {
  return items.flatMap((it) => (it.t === "v" ? [it.v] : it.t === "run" ? it.versions : it.t === "month" ? flatVersions(it.items) : []))
}

/** 列表里这一行的标题 */
export function titleOf(v: Version): string {
  if (v.kind === "named") return v.name ?? ""
  if (v.kind === "restore") return `恢复自${v.from ?? ""}`
  if (v.kind === "import") return `导入自「${v.file ?? ""}」`
  return v.time
}

/** 中文后面接数字开头的文字时补一个空格（「第 2 页」「恢复到 10 月 6 日…」的写法） */
export const sp = (s: string) => (/^[0-9A-Za-z]/.test(s) ? ` ${s}` : s)

/** 确认卡、提示里称呼这个版本：命名版本用名称，其余用时间（接在「恢复到」「已恢复到」后面） */
export function callOf(v: Version): string {
  return v.kind === "named" ? `「${v.name}」` : sp(`${v.when} 的版本`)
}

/** 人名串：最多列三人，再多写「等 N 人」 */
export function namesOf(people: Person[]): string {
  if (people.length <= 3) return people.map((p) => p.name).join("、")
  return `${people
    .slice(0, 2)
    .map((p) => p.name)
    .join("、")} 等 ${people.length} 人`
}
