import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { CARD_POS, DEFAULT_DECK, LayoutArt, layoutOfSlide, SlideFooter, SlideTitle, type DeckSlide } from "../../kit"

/**
 * slides-selection 组（03-14 / 03-17 / 03-05）用到的自定义页：版式的真实渲染（空占位符）、可移动卡片的「关键指标」页、
 * 去掉要点卡的「议程」页、带连接符的「交付流程」页。全部画在 SlideFrame 里（deckWith 的 render），尺寸用 cqw、颜色用 --s-*。
 */

/* ------------------------------------------------------------------ 新建的空白页 */

/**
 * 刚新建的空白页（缺省「标题和内容」）：版式的真实渲染用底座的 LayoutArt（与版式画廊、母版视图同一份）——
 * 画布上空占位符显示虚线框与提示文字（prompts = slide），缩略图与网格里只剩母版图形与页脚（prompts = none，空占位符不出现在缩略图与放映里）。
 */
export const newSlide = (n: number, layout = "标题和内容"): DeckSlide => {
  const kind = layoutOfSlide({ n, layout }).kind
  return {
    n,
    name: "新幻灯片",
    layout,
    render: ({ where }) => <LayoutArt master="office" target={kind} prompts={where === "canvas" ? "slide" : "none"} page={n} frame={false} />,
  }
}

/* ------------------------------------------------------------------ 第 3 页「关键指标」：卡片可以挪位（吸附 / 临时关闭吸附） */

const METRICS = [
  { label: "营收", value: "¥1.28", unit: "亿", delta: "+18%", spark: [4, 6, 5, 8, 9, 13] },
  { label: "活跃客户", value: "3,420", unit: "", delta: "+12%", spark: [5, 5, 7, 8, 9, 11] },
  { label: "毛利率", value: "62", unit: "%", delta: "+3pt", spark: [8, 7, 9, 9, 11, 12] },
]

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

/** 与示例第 3 页相同；shift 把第 i 张卡片挪开 x / y（cqw），用来画「拖动中、没有吸附」的位置。 */
export function MetricsArt({ shift }: { shift?: { i: number; x: number; y: number } }) {
  return (
    <>
      <SlideTitle>关键指标</SlideTitle>
      <div className="absolute inset-x-[7cqw] top-[19cqw] grid grid-cols-3 gap-[3cqw]">
        {METRICS.map((m, i) => (
          <div
            key={m.label}
            className="relative flex h-[27.5cqw] flex-col rounded-[1cqw] bg-(--s-card) p-[2.6cqw]"
            style={shift?.i === i ? { transform: `translate(${shift.x}cqw, ${shift.y}cqw)` } : undefined}
          >
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

/* ------------------------------------------------------------------ 第 2 页「议程」：要点卡可以删掉（删除后的可撤销提示） */

const AGENDA = [
  { no: "01", label: "关键指标", page: 3 },
  { no: "02", label: "营收趋势", page: 4 },
  { no: "03", label: "区域分布", page: 5 },
  { no: "04", label: "下半年计划", page: 6 },
]

export function AgendaArt({ card = true }: { card?: boolean }) {
  return (
    <>
      <SlideTitle>议程</SlideTitle>
      <ol className="absolute top-[19cqw] left-[7cqw] w-[54.5cqw]">
        {AGENDA.map((a, i) => (
          <li key={a.no} className={cn("flex h-[7.2cqw] items-center", i > 0 && "border-t-[0.12cqw] border-(--s-line)")}>
            <span className="w-[6cqw] text-[2cqw] leading-none font-semibold text-(--s-brand) tabular-nums">{a.no}</span>
            <span className="flex-1 text-[3cqw] leading-none font-medium">{a.label}</span>
            <span className="text-[1.7cqw] leading-none text-(--s-mute) tabular-nums">P{a.page}</span>
          </li>
        ))}
      </ol>
      {card && (
        <div className={cn("absolute flex flex-col rounded-[2cqw] bg-(--s-note) p-[2.4cqw]", CARD_POS)}>
          <span className="text-[1.7cqw] leading-none font-medium text-(--s-body)">本季关键词</span>
          <span className="mt-[1.8cqw] text-[5cqw] leading-none font-bold tracking-[-0.01em] tabular-nums">增长 18%</span>
          <span className="mt-auto text-[1.45cqw] leading-[1.4] whitespace-nowrap text-(--s-body)">营收、客户、毛利三项同步提升</span>
        </div>
      )}
      <SlideFooter page={2} />
    </>
  )
}

/* ------------------------------------------------------------------ 追加的第 7 页「交付流程」：三个矩形 + 箭头连接符（03-17 G-39） */

/**
 * 960 × 540 坐标：三个矩形 200 × 120，x = 80 / 380 / 680，y = 240；连接符在 y = 300。
 * 矩形 1 → 2 的连接符已连接；矩形 2 → 3 的连接符在 draft 状态下正在拖动端点，只画在画布上（缩略图里还没有）。
 */
export const FLOW_BOXES = [
  { name: "需求评审", days: "2 天", x: 80 },
  { name: "方案设计", days: "6 天", x: 380 },
  { name: "交付上线", days: "10 天", x: 680 },
] as const

function Arrow({ x1, x2 }: { x1: number; x2: number }) {
  return (
    <g className="fill-(--s-body) stroke-(--s-body)">
      <line x1={x1} y1={300} x2={x2 - 12} y2={300} strokeWidth="2.5" />
      <polygon points={`${x2},300 ${x2 - 13},292.5 ${x2 - 13},307.5`} strokeWidth="0" />
    </g>
  )
}

/** second：矩形 2 → 3 的连接符（正在拖动端点时只在画布上有，缩略图里还没有）。 */
export function FlowArt({ second = true }: { second?: boolean }) {
  return (
    <>
      <SlideTitle>交付流程</SlideTitle>
      <p className="absolute top-[16.2cqw] left-[7cqw] text-[2.6cqw] leading-[1.3] text-(--s-body)">
        从需求评审到上线平均 <b className="font-semibold text-(--s-ink)">18 天</b>，比 Q1 缩短 4 天
      </p>
      {FLOW_BOXES.map((b, i) => (
        <div
          key={b.name}
          className={cn(
            "absolute top-[25cqw] flex h-[12.5cqw] w-[20.833cqw] flex-col items-center justify-center gap-[1cqw] rounded-[1cqw]",
            i === 2 ? "bg-(--s-ink) text-white" : "bg-(--s-brand-soft) text-(--s-ink)",
          )}
          style={{ left: `${(b.x / 960) * 100}cqw` }}
        >
          <span className="text-[2.6cqw] leading-none font-semibold">{b.name}</span>
          <span className={cn("text-[1.7cqw] leading-none tabular-nums", i === 2 ? "text-white/75" : "text-(--s-body)")}>{b.days}</span>
        </div>
      ))}
      <svg viewBox="0 0 960 540" aria-hidden="true" className="absolute inset-0 size-full">
        <Arrow x1={280} x2={380} />
        {second && <Arrow x1={580} x2={680} />}
      </svg>
      <SlideFooter page={7} />
    </>
  )
}

/** 示例文档 + 第 7 页「交付流程」（draft：画布上 2 → 3 的连接符正在拖动端点）。 */
export const flowDeck = (draft: boolean): DeckSlide[] => [
  ...DEFAULT_DECK,
  { n: 7, name: "交付流程", layout: "仅标题", render: ({ where }) => <FlowArt second={!draft || where === "canvas"} /> },
]
