import type { ReactNode } from "react"
import { Layers, Target, Zap, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { CARD_POS, DEFAULT_DECK, SlideFooter, SlideTitle, type DeckSlide } from "../../kit"

/**
 * 版本历史场景的「历史版本」幻灯片：示例文档「2026 年 Q2 业绩汇报」在不同时间点的真实渲染（Q8：预览画布与缩略图都是真实内容，不用骨架条）。
 * 画法与底座 SlideArt 的示例 6 页一致（16:9、cqw 单位、--s-* 文档 token），只把会随版本变化的文字与数字做成参数：
 *   stock    示例文档原样（今天 14:32 及以前的最新内容）
 *   d1350    今天 13:50：第 6 页「下半年计划」只有两项
 *   proposal 昨天 16:20「提案定稿」：5 页（还没有下半年计划），财务核对前的数字（1.25 亿、+17%）
 *   draft    10 月 6 日「初稿」：4 页（区域分布待补），更早的数字（1.21 亿、+15%）
 *   early    9 月及更早：3 页的框架
 * 历史版本的页不带评论角标（评论属于当前文档，预览只看内容），快速样式变量（--qs-*）也不作用于历史版本的要点卡。
 */

/* ------------------------------------------------------------------ 1 标题页 */

const GROWTH = [
  { h: "h-[5.5cqw]", c: "bg-(--s-brand-soft)" },
  { h: "h-[8cqw]", c: "bg-(--s-brand-soft)" },
  { h: "h-[11cqw]", c: "bg-[#D5DEFB]" },
  { h: "h-[14.5cqw]", c: "bg-(--s-brand-mid)" },
  { h: "h-[18.5cqw]", c: "bg-[#7F98F1]" },
  { h: "h-[23cqw]", c: "bg-(--s-brand)" },
]

function Cover({ subtitle }: { subtitle: string }) {
  return (
    <>
      <div className="absolute top-[18cqw] left-[7cqw] h-[15.2cqw] w-[1cqw] bg-(--s-brand)" />
      <div className="absolute top-[18cqw] left-[10.5cqw]">
        <h1 className="text-[7.2cqw] leading-[1.18] font-bold tracking-[-0.015em] whitespace-nowrap">2026 年 Q2 业绩汇报</h1>
        <p className="mt-[2.2cqw] text-[3cqw] leading-[1.4] text-(--s-body)">{subtitle}</p>
      </div>
      <p className="absolute bottom-[6.6cqw] left-[10.5cqw] text-[1.9cqw] leading-none text-(--s-mute)">产品部 · 2026 年 7 月</p>
      <div className="absolute right-[7cqw] bottom-0 flex items-end gap-[1.5cqw]">
        {GROWTH.map((g, i) => (
          <div key={i} className={cn("w-[3.6cqw] rounded-t-[0.5cqw]", g.h, g.c)} />
        ))}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ 2 议程 */

interface AgendaItem {
  no: string
  label: string
  page: number
}

const AGENDA_ALL: AgendaItem[] = [
  { no: "01", label: "关键指标", page: 3 },
  { no: "02", label: "营收趋势", page: 4 },
  { no: "03", label: "区域分布", page: 5 },
  { no: "04", label: "下半年计划", page: 6 },
]

function Agenda({ items, card }: { items: AgendaItem[]; card: { value: string; sub: string } }) {
  return (
    <>
      <SlideTitle>议程</SlideTitle>
      <ol className="absolute top-[19cqw] left-[7cqw] w-[54.5cqw]">
        {items.map((a, i) => (
          <li key={a.no} className={cn("flex h-[7.2cqw] items-center", i > 0 && "border-t-[0.12cqw] border-(--s-line)")}>
            <span className="w-[6cqw] text-[2cqw] leading-none font-semibold text-(--s-brand) tabular-nums">{a.no}</span>
            <span className="flex-1 text-[3cqw] leading-none font-medium">{a.label}</span>
            <span className="text-[1.7cqw] leading-none text-(--s-mute) tabular-nums">P{a.page}</span>
          </li>
        ))}
      </ol>
      <div className={cn("absolute flex flex-col rounded-[2cqw] bg-(--s-note) p-[2.4cqw]", CARD_POS)}>
        <span className="text-[1.7cqw] leading-none font-medium text-(--s-body)">本季关键词</span>
        <span className="mt-[1.8cqw] text-[5cqw] leading-none font-bold tracking-[-0.01em] text-(--s-ink) tabular-nums">{card.value}</span>
        <span className="mt-auto text-[1.45cqw] leading-[1.4] whitespace-nowrap text-(--s-body)">{card.sub}</span>
      </div>
      <SlideFooter page={2} />
    </>
  )
}

/* ------------------------------------------------------------------ 3 关键指标 */

interface Metric {
  label: string
  value: string
  unit: string
  delta: string
  spark: number[]
}

function Spark({ data }: { data: number[] }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 120},${22 - ((v - min) / (max - min || 1)) * 19}`).join(" ")
  return (
    <svg viewBox="0 0 120 24" aria-hidden="true" className="mt-[2.4cqw] w-full">
      <polyline points={pts} fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="stroke-(--s-brand)" />
    </svg>
  )
}

function Metrics({ metrics }: { metrics: Metric[] }) {
  return (
    <>
      <SlideTitle>关键指标</SlideTitle>
      <div className="absolute inset-x-[7cqw] top-[19cqw] grid grid-cols-3 gap-[3cqw]">
        {metrics.map((m) => (
          <div key={m.label} className="relative flex h-[27.5cqw] flex-col rounded-[1cqw] bg-(--s-card) p-[2.6cqw]">
            <span className="text-[2cqw] leading-none font-medium text-(--s-body)">{m.label}</span>
            <span className="mt-[2.6cqw] flex items-baseline text-[6.2cqw] leading-none font-bold tracking-[-0.01em] tabular-nums">
              {m.value}
              {m.unit && <span className="ml-[0.5cqw] text-[3cqw] font-semibold">{m.unit}</span>}
            </span>
            <Spark data={m.spark} />
            <span className="mt-auto flex items-center gap-[1cqw]">
              <span className="rounded-[0.6cqw] bg-(--s-brand-soft) px-[1cqw] py-[0.55cqw] text-[1.8cqw] leading-none font-semibold text-(--s-brand) tabular-nums">▲ {m.delta}</span>
              <span className="text-[1.6cqw] leading-none text-(--s-mute)">同比</span>
            </span>
          </div>
        ))}
      </div>
      <SlideFooter page={3} />
    </>
  )
}

/* ------------------------------------------------------------------ 4 营收趋势 */

function Trend({ monthly, headline, q1, q2 }: { monthly: number[]; headline: ReactNode; q1: string; q2: string }) {
  const months = ["1 月", "2 月", "3 月", "4 月", "5 月", "6 月"]
  const slot = 860 / 6
  const bw = 76
  const base = 226
  const top = 54
  const scale = (base - top) / 48
  return (
    <>
      <SlideTitle>营收趋势</SlideTitle>
      <p className="absolute top-[16.2cqw] left-[7cqw] text-[2.6cqw] leading-[1.3] text-(--s-body)">{headline}</p>
      <svg viewBox="0 0 860 280" aria-hidden="true" className="absolute top-[22cqw] left-[7cqw] w-[86cqw]">
        {[1, 2, 3, 4].map((k) => (
          <line key={k} x1="0" x2="860" y1={base - k * 43} y2={base - k * 43} strokeWidth="1" className="stroke-[#EDF0F5]" />
        ))}
        <line x1="0" x2="860" y1={base} y2={base} strokeWidth="1.2" className="stroke-[#C9D0DC]" />
        <text x="860" y="14" textAnchor="end" fontSize="13" className="fill-(--s-mute)">
          单位：百万元
        </text>
        {monthly.map((v, i) => {
          const h = v * scale
          const x = i * slot + (slot - bw) / 2
          return (
            <g key={months[i]}>
              <rect x={x} y={base - h} width={bw} height={h} rx="3" className={i < 3 ? "fill-[#C9D5FB]" : "fill-(--s-brand)"} />
              <text x={x + bw / 2} y={base - h - 10} textAnchor="middle" fontSize="15" fontWeight="600" className="fill-(--s-ink) tabular-nums">
                {v}
              </text>
              <text x={x + bw / 2} y={base + 22} textAnchor="middle" fontSize="14" className="fill-(--s-mute)">
                {months[i]}
              </text>
            </g>
          )
        })}
        {[
          { q: "Q1", sum: q1, x0: 0 },
          { q: "Q2", sum: q2, x0: 3 },
        ].map((g) => (
          <g key={g.q}>
            <line x1={g.x0 * slot + 18} x2={(g.x0 + 3) * slot - 18} y1="258" y2="258" strokeWidth="1" className="stroke-[#C9D0DC]" />
            <text x={(g.x0 + 1.5) * slot} y="276" textAnchor="middle" fontSize="13" fontWeight="600" className="fill-(--s-body) tabular-nums">
              {g.q} · {g.sum}
            </text>
          </g>
        ))}
      </svg>
      <SlideFooter page={4} />
    </>
  )
}

/* ------------------------------------------------------------------ 5 区域分布 */

const REGION_STYLE = [
  { name: "华东", share: 38, dot: "bg-[#1F2A5C]", ring: "stroke-[#1F2A5C]" },
  { name: "华南", share: 24, dot: "bg-(--s-brand)", ring: "stroke-(--s-brand)" },
  { name: "华北", share: 21, dot: "bg-[#7F98F1]", ring: "stroke-[#7F98F1]" },
  { name: "西部", share: 11, dot: "bg-[#B9C7F8]", ring: "stroke-[#B9C7F8]" },
  { name: "海外", share: 6, dot: "bg-[#DCE4FC]", ring: "stroke-[#DCE4FC]" },
]

function Regions({ total, amounts }: { total: string; amounts: string[] }) {
  const r = 70
  const c = 2 * Math.PI * r
  let acc = 0
  const arcs = REGION_STYLE.map((g) => {
    const len = (g.share / 100) * c
    const arc = { len: len - 1.6, off: -acc }
    acc += len
    return arc
  })
  return (
    <>
      <SlideTitle>区域分布</SlideTitle>
      <svg viewBox="0 0 200 200" aria-hidden="true" className="absolute top-[17cqw] left-[8cqw] w-[31cqw]">
        {REGION_STYLE.map((g, i) => (
          <circle
            key={g.name}
            cx="100"
            cy="100"
            r={r}
            fill="none"
            strokeWidth="26"
            strokeDasharray={`${arcs[i]?.len ?? 0} ${c}`}
            strokeDashoffset={arcs[i]?.off ?? 0}
            transform="rotate(-90 100 100)"
            className={g.ring}
          />
        ))}
        <text x="100" y="98" textAnchor="middle" fontSize="23" fontWeight="700" className="fill-(--s-ink)">
          {total}
        </text>
        <text x="100" y="118" textAnchor="middle" fontSize="11" className="fill-(--s-mute)">
          Q2 营收
        </text>
      </svg>
      <div className="absolute top-[17cqw] right-[7cqw] left-[51cqw]">
        <div className="flex h-[3.4cqw] items-center border-b-[0.12cqw] border-(--s-line) text-[1.6cqw] leading-none text-(--s-mute)">
          <span className="flex-1">区域</span>
          <span className="w-[8cqw] text-right">占比</span>
          <span className="w-[15cqw] text-right">营收（万元）</span>
        </div>
        {REGION_STYLE.map((g, i) => (
          <div key={g.name} className="flex h-[5.8cqw] items-center border-b-[0.12cqw] border-(--s-line) last:border-b-0">
            <span className={cn("mr-[1.6cqw] size-[1.5cqw] shrink-0 rounded-full", g.dot)} />
            <span className="flex-1 text-[2.5cqw] leading-none font-medium">{g.name}</span>
            <span className="w-[8cqw] text-right text-[2.5cqw] leading-none font-semibold tabular-nums">{g.share}%</span>
            <span className="w-[15cqw] text-right text-[2.3cqw] leading-none text-(--s-body) tabular-nums">{amounts[i]}</span>
          </div>
        ))}
      </div>
      <SlideFooter page={5} />
    </>
  )
}

/* ------------------------------------------------------------------ 6 下半年计划 */

const PLANS: { Icon: LucideIcon; title: string; lines: string[] }[] = [
  { Icon: Target, title: "拓展企业客户", lines: ["新增 3 个行业解决方案", "重点突破制造与零售"] },
  { Icon: Zap, title: "提升交付效率", lines: ["上线自动化交付流程", "平均交付周期缩短 25%"] },
  { Icon: Layers, title: "优化产品体验", lines: ["重构核心编辑工作流", "NPS 提升至 55 以上"] },
]

function Plans({ count }: { count: number }) {
  return (
    <>
      <SlideTitle>下半年计划</SlideTitle>
      <div className="absolute inset-x-[7cqw] top-[21cqw] grid grid-cols-3 gap-[4cqw]">
        {PLANS.slice(0, count).map(({ Icon, title, lines }, i) => (
          <div key={title}>
            <div className="h-[0.25cqw] bg-(--s-ink)" />
            <div className="mt-[2.6cqw] flex size-[6.4cqw] items-center justify-center rounded-[1.4cqw] bg-(--s-brand-soft) text-(--s-brand)">
              <Icon className="size-[3.2cqw]" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <p className="mt-[2.4cqw] flex items-baseline gap-[1cqw] text-[3cqw] leading-none font-semibold">
              {title}
              <span className="text-[1.5cqw] font-medium text-(--s-mute) tabular-nums">0{i + 1}</span>
            </p>
            <div className="mt-[1.6cqw] text-[2cqw] leading-[1.7] text-(--s-body)">
              {lines.map((l) => (
                <p key={l}>{l}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
      <SlideFooter page={6} />
    </>
  )
}

/* ------------------------------------------------------------------ 各版本的页 */

const b = (s: string) => <b className="font-semibold text-(--s-ink)">{s}</b>

/** 一页：版本里的页名与版式与示例文档相同，只换内容；notes 是那个版本当时的演讲者备注 */
const page = (n: number, render: () => ReactNode, notes?: string): DeckSlide => {
  const stock = DEFAULT_DECK.find((s) => s.n === n)
  return { n, name: stock?.name ?? `第 ${n} 页`, layout: stock?.layout ?? "仅标题", render, notes }
}

/** 示例文档原样（去掉评论角标：评论属于当前文档） */
const STOCK_DECK: DeckSlide[] = DEFAULT_DECK.map((s) => ({ ...s, comments: undefined }))

/** 今天 13:50：其余与原样相同，第 6 页只有两项计划（第三项「优化产品体验」是之后加的） */
const D1350_DECK: DeckSlide[] = STOCK_DECK.map((s) => (s.n === 6 ? page(6, () => <Plans count={2} />) : s))

/** 昨天 16:20「提案定稿」：5 页，财务核对前的数字 */
const PROPOSAL_DECK: DeckSlide[] = [
  page(1, () => <Cover subtitle="增长与效率" />),
  page(2, () => <Agenda items={AGENDA_ALL.slice(0, 3)} card={{ value: "增长 17%", sub: "营收、客户两项同步提升" }} />),
  page(
    3,
    () => (
      <Metrics
        metrics={[
          { label: "营收", value: "¥1.25", unit: "亿", delta: "+17%", spark: [4, 6, 5, 8, 9, 12] },
          { label: "活跃客户", value: "3,380", unit: "", delta: "+11%", spark: [5, 5, 7, 8, 9, 10] },
          { label: "毛利率", value: "61", unit: "%", delta: "+2pt", spark: [8, 7, 9, 9, 10, 11] },
        ]}
      />
    ),
    "三项指标都按同比口径；毛利率的变化单位是百分点（pt），不是百分比。",
  ),
  page(
    4,
    () => <Trend monthly={[35, 32, 41, 38, 41, 46]} q1="108" q2="125" headline={<>6 月营收 {b("4,600 万元")}，创年内新高；Q2 累计 {b("1.25 亿元")}，同比 +17%</>} />,
    "先讲 6 月创年内新高，再对比 Q1 与 Q2：Q2 累计 1.25 亿元，同比 +17%。",
  ),
  page(5, () => <Regions total="¥1.25 亿" amounts={["4,750", "3,000", "2,625", "1,375", "750"]} />),
]

/** 10 月 6 日「初稿」：4 页，区域分布还没做 */
const DRAFT_DECK: DeckSlide[] = [
  page(1, () => <Cover subtitle="增长与效率" />),
  page(2, () => <Agenda items={AGENDA_ALL.slice(0, 2)} card={{ value: "增长 15%", sub: "营收同比提升" }} />),
  page(3, () => (
    <Metrics
      metrics={[
        { label: "营收", value: "¥1.21", unit: "亿", delta: "+15%", spark: [4, 6, 5, 7, 8, 11] },
        { label: "活跃客户", value: "3,350", unit: "", delta: "+10%", spark: [5, 5, 6, 7, 8, 9] },
        { label: "毛利率", value: "60", unit: "%", delta: "+1pt", spark: [8, 7, 8, 9, 9, 10] },
      ]}
    />
  )),
  page(4, () => <Trend monthly={[35, 32, 41, 37, 40, 44]} q1="108" q2="121" headline={<>6 月营收 {b("4,400 万元")}；Q2 累计 {b("1.21 亿元")}，同比 +15%</>} />),
]

/** 9 月及更早：3 页的框架 */
const EARLY_DECK: DeckSlide[] = [
  page(1, () => <Cover subtitle="增长与效率" />),
  page(2, () => <Agenda items={AGENDA_ALL.slice(0, 3)} card={{ value: "增长 15%", sub: "营收同比提升" }} />),
  page(3, () => (
    <Metrics
      metrics={[
        { label: "营收", value: "¥1.20", unit: "亿", delta: "+15%", spark: [4, 5, 5, 7, 8, 10] },
        { label: "活跃客户", value: "3,300", unit: "", delta: "+9%", spark: [5, 5, 6, 6, 7, 8] },
        { label: "毛利率", value: "60", unit: "%", delta: "+1pt", spark: [8, 8, 8, 9, 9, 10] },
      ]}
    />
  )),
]

/** 历史版本的内容（live = 当前文档，取编辑器的 deck） */
export type DeckKey = "live" | "stock" | "d1350" | "proposal" | "draft" | "early"

const DECKS: Record<Exclude<DeckKey, "live">, DeckSlide[]> = {
  stock: STOCK_DECK,
  d1350: D1350_DECK,
  proposal: PROPOSAL_DECK,
  draft: DRAFT_DECK,
  early: EARLY_DECK,
}

/** 某个版本的页；live 是当前文档（编辑器的 deck） */
export function deckOf(key: DeckKey, live: DeckSlide[]): DeckSlide[] {
  return key === "live" ? live : DECKS[key]
}

/** 恢复到「提案定稿」之后的当前文档（restored / restored-remote 状态的 deck） */
export const RESTORED_DECK = PROPOSAL_DECK
