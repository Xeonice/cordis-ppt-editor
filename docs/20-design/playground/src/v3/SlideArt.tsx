import type { ReactNode } from "react"
import { Layers, Target, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * 真实幻灯片渲染（示例文档「2026 年 Q2 业绩汇报」6 页）。
 * 外层是 16:9 的 @container，内部字号、间距、线宽全部用 cqw：同一组件在 190px 缩略图和 980px 画布上长得一样。
 * 不写 style={{}}；图表用内联 SVG（viewBox 自适应）；不加载任何外部图片。
 */
export type SlideNo = 1 | 2 | 3 | 4 | 5 | 6

/** 示例文档各页的页名（无障碍名称「第 n 页：页名」）。 */
export const SLIDE_NAMES: Record<SlideNo, string> = {
  1: "标题页",
  2: "议程",
  3: "关键指标",
  4: "营收趋势",
  5: "区域分布",
  6: "下半年计划",
}

/**
 * 第 2 页右侧「要点卡」在幻灯片中的位置：x629 y232 w264 h176（960 × 540 设计稿），用百分比落位。
 * 画布上的选中框、手柄、点选区域都按同一组数值定位，保证与 SlideArt 里真实渲染的卡片重合。
 */
export const CARD_POS = "left-[65.5%] top-[43%] h-[32.59%] w-[27.5%]"

/**
 * 16:9 幻灯片画框：@container + 幻灯片内容 token（.v3-slide 下的 --s-*）+ 白底。
 * 示例文档 6 页与场景里的自定义页（表格页、图表页…）都画在它里面：内容的字号、间距、线宽一律用 cqw，缩略图和画布才长得一样。
 */
export function SlideFrame({ label, className, children }: { label: string; className?: string; children?: ReactNode }) {
  return (
    <div role="img" aria-label={label} className={cn("v3-slide @container relative aspect-video w-full overflow-hidden bg-white", className)}>
      {children}
    </div>
  )
}

export function SlideArt({
  n,
  editing,
  className,
}: {
  n: SlideNo
  /** 第 1 页标题处于文字编辑态（仅画布使用，缩略图不带） */
  editing?: boolean
  className?: string
}) {
  return (
    <SlideFrame label={`第 ${n} 页：${SLIDE_NAMES[n]}`} className={className}>
      {n === 1 && <Cover editing={editing} />}
      {n === 2 && <Agenda />}
      {n === 3 && <Metrics />}
      {n === 4 && <Trend />}
      {n === 5 && <Regions />}
      {n === 6 && <Plans />}
    </SlideFrame>
  )
}

/* ------------------------------------------------------------------ 公共件 */

/** 页标题 + 下方品牌色短线（与示例文档各页一致，自定义页可直接用）。 */
export function SlideTitle({ children }: { children: string }) {
  return (
    <>
      <h2 className="absolute top-[6.4cqw] left-[7cqw] text-[4.6cqw] leading-[1.2] font-bold tracking-[-0.01em] whitespace-nowrap">{children}</h2>
      <div className="absolute top-[13.4cqw] left-[7cqw] h-[0.55cqw] w-[4.2cqw] bg-(--s-brand)" />
    </>
  )
}

/** 页脚：文档名 + 页码（与示例文档各页一致）。 */
export function SlideFooter({ page }: { page: number }) {
  return (
    <div className="absolute inset-x-[7cqw] bottom-[3.4cqw] flex items-center justify-between text-[1.4cqw] leading-none text-(--s-mute)">
      <span>2026 年 Q2 业绩汇报</span>
      <span className="tabular-nums">{page}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ 1 标题页 */

function Cover({ editing }: { editing?: boolean }) {
  const growth = [
    { h: "h-[5.5cqw]", c: "bg-(--s-brand-soft)" },
    { h: "h-[8cqw]", c: "bg-(--s-brand-soft)" },
    { h: "h-[11cqw]", c: "bg-[#D5DEFB]" },
    { h: "h-[14.5cqw]", c: "bg-(--s-brand-mid)" },
    { h: "h-[18.5cqw]", c: "bg-[#7F98F1]" },
    { h: "h-[23cqw]", c: "bg-(--s-brand)" },
  ]
  return (
    <>
      <div className="absolute top-[18cqw] left-[7cqw] h-[15.2cqw] w-[1cqw] bg-(--s-brand)" />
      <div className="absolute top-[18cqw] left-[10.5cqw]">
        <div className="relative">
          <h1 className="relative text-[7.2cqw] leading-[1.18] font-bold tracking-[-0.015em] whitespace-nowrap">
            {editing ? (
              <>
                2026 年 <span className="bg-(--v3-sel)">Q2 业绩</span>
                <span aria-hidden="true" className="mx-px inline-block h-[0.95em] w-0 translate-y-[0.12em] border-l-[0.22cqw] border-(--v3-accent)" />
                汇报
              </>
            ) : (
              "2026 年 Q2 业绩汇报"
            )}
          </h1>
          {editing && <div className="pointer-events-none absolute -inset-x-[1.2cqw] -inset-y-[0.7cqw] border border-(--v3-accent)" />}
        </div>
        <p className="mt-[2.2cqw] text-[3cqw] leading-[1.4] text-(--s-body)">增长、效率与下半年计划</p>
      </div>
      <p className="absolute bottom-[6.6cqw] left-[10.5cqw] text-[1.9cqw] leading-none text-(--s-mute)">产品部 · 2026 年 7 月</p>
      {/* 右下角的增长柱：只做收尾的点缀 */}
      <div className="absolute right-[7cqw] bottom-0 flex items-end gap-[1.5cqw]">
        {growth.map((g, i) => (
          <div key={i} className={cn("w-[3.6cqw] rounded-t-[0.5cqw]", g.h, g.c)} />
        ))}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ 2 议程 */

const AGENDA = [
  { no: "01", label: "关键指标", page: 3 },
  { no: "02", label: "营收趋势", page: 4 },
  { no: "03", label: "区域分布", page: 5 },
  { no: "04", label: "下半年计划", page: 6 },
]

function Agenda() {
  return (
    <>
      <SlideTitle>议程</SlideTitle>
      {/* 列表右缘（页码）与右侧要点卡之间留 4cqw：列表 7 → 61.5，卡片从 65.5 起 */}
      <ol className="absolute top-[19cqw] left-[7cqw] w-[54.5cqw]">
        {AGENDA.map((a, i) => (
          <li key={a.no} className={cn("flex h-[7.2cqw] items-center", i > 0 && "border-t-[0.12cqw] border-(--s-line)")}>
            <span className="w-[6cqw] text-[2cqw] leading-none font-semibold text-(--s-brand) tabular-nums">{a.no}</span>
            <span className="flex-1 text-[3cqw] leading-none font-medium">{a.label}</span>
            <span className="text-[1.7cqw] leading-none text-(--s-mute) tabular-nums">P{a.page}</span>
          </li>
        ))}
      </ol>
      {/*
        要点卡：浅品牌色底、2cqw 圆角，内含深色文字；与列表垂直居中对齐。
        检查器「快速样式」换了样式时（DS-31），编辑器外层写 --qs-fill / --qs-shadow / --qs-text / --qs-sub（editor/inspector/builtin.tsx QuickStyleScope），
        画布、左栏缩略图与网格里的这张卡一起换样；没写时按示例文档原样（细微效果 · 强调色 1）画
      */}
      <div className={cn("absolute flex flex-col rounded-[2cqw] p-[2.4cqw] [background:var(--qs-fill,var(--s-note))] [box-shadow:var(--qs-shadow,none)]", CARD_POS)}>
        <span className="text-[1.7cqw] leading-none font-medium [color:var(--qs-sub,var(--s-body))]">本季关键词</span>
        <span className="mt-[1.8cqw] text-[5cqw] leading-none font-bold tracking-[-0.01em] tabular-nums [color:var(--qs-text,var(--s-ink))]">增长 18%</span>
        <span className="mt-auto text-[1.45cqw] leading-[1.4] whitespace-nowrap [color:var(--qs-sub,var(--s-body))]">营收、客户、毛利三项同步提升</span>
      </div>
      <SlideFooter page={2} />
    </>
  )
}

/* ------------------------------------------------------------------ 3 关键指标 */

const METRICS = [
  { label: "营收", value: "¥1.28", unit: "亿", delta: "+18%", spark: [4, 6, 5, 8, 9, 13] },
  { label: "活跃客户", value: "3,420", unit: "", delta: "+12%", spark: [5, 5, 7, 8, 9, 11] },
  { label: "毛利率", value: "62", unit: "%", delta: "+3pt", spark: [8, 7, 9, 9, 11, 12] },
]

function Spark({ data }: { data: number[] }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 120},${22 - ((v - min) / (max - min || 1)) * 19}`)
    .join(" ")
  return (
    <svg viewBox="0 0 120 24" aria-hidden="true" className="mt-[2.4cqw] w-full">
      <polyline points={pts} fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="stroke-(--s-brand)" />
    </svg>
  )
}

function Metrics() {
  return (
    <>
      <SlideTitle>关键指标</SlideTitle>
      <div className="absolute inset-x-[7cqw] top-[19cqw] grid grid-cols-3 gap-[3cqw]">
        {METRICS.map((m) => (
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

const MONTHLY = [
  { m: "1 月", v: 35, q: 1 },
  { m: "2 月", v: 32, q: 1 },
  { m: "3 月", v: 41, q: 1 },
  { m: "4 月", v: 38, q: 2 },
  { m: "5 月", v: 42, q: 2 },
  { m: "6 月", v: 48, q: 2 },
]

function Trend() {
  const slot = 860 / 6
  const bw = 76
  const base = 226
  const top = 54
  const scale = (base - top) / 48
  return (
    <>
      <SlideTitle>营收趋势</SlideTitle>
      <p className="absolute top-[16.2cqw] left-[7cqw] text-[2.6cqw] leading-[1.3] text-(--s-body)">
        6 月营收 <b className="font-semibold text-(--s-ink)">4,800 万元</b>，创年内新高；Q2 累计 <b className="font-semibold text-(--s-ink)">1.28 亿元</b>，同比 +18%
      </p>
      <svg viewBox="0 0 860 280" aria-hidden="true" className="absolute top-[22cqw] left-[7cqw] w-[86cqw]">
        {[1, 2, 3, 4].map((k) => (
          <line key={k} x1="0" x2="860" y1={base - k * 43} y2={base - k * 43} strokeWidth="1" className="stroke-[#EDF0F5]" />
        ))}
        <line x1="0" x2="860" y1={base} y2={base} strokeWidth="1.2" className="stroke-[#C9D0DC]" />
        <text x="860" y="14" textAnchor="end" fontSize="13" className="fill-(--s-mute)">单位：百万元</text>
        {MONTHLY.map((d, i) => {
          const h = d.v * scale
          const x = i * slot + (slot - bw) / 2
          return (
            <g key={d.m}>
              <rect x={x} y={base - h} width={bw} height={h} rx="3" className={d.q === 1 ? "fill-[#C9D5FB]" : "fill-(--s-brand)"} />
              <text x={x + bw / 2} y={base - h - 10} textAnchor="middle" fontSize="15" fontWeight="600" className="fill-(--s-ink) tabular-nums">{d.v}</text>
              <text x={x + bw / 2} y={base + 22} textAnchor="middle" fontSize="14" className="fill-(--s-mute)">{d.m}</text>
            </g>
          )
        })}
        {[
          { q: "Q1", sum: "108", x0: 0 },
          { q: "Q2", sum: "128", x0: 3 },
        ].map((g) => (
          <g key={g.q}>
            <line x1={g.x0 * slot + 18} x2={(g.x0 + 3) * slot - 18} y1="258" y2="258" strokeWidth="1" className="stroke-[#C9D0DC]" />
            <text x={(g.x0 + 1.5) * slot} y="276" textAnchor="middle" fontSize="13" fontWeight="600" className="fill-(--s-body) tabular-nums">{g.q} · {g.sum}</text>
          </g>
        ))}
      </svg>
      <SlideFooter page={4} />
    </>
  )
}

/* ------------------------------------------------------------------ 5 区域分布 */

const REGIONS = [
  { name: "华东", share: 38, amount: "4,864", dot: "bg-[#1F2A5C]", ring: "stroke-[#1F2A5C]" },
  { name: "华南", share: 24, amount: "3,072", dot: "bg-(--s-brand)", ring: "stroke-(--s-brand)" },
  { name: "华北", share: 21, amount: "2,688", dot: "bg-[#7F98F1]", ring: "stroke-[#7F98F1]" },
  { name: "西部", share: 11, amount: "1,408", dot: "bg-[#B9C7F8]", ring: "stroke-[#B9C7F8]" },
  { name: "海外", share: 6, amount: "768", dot: "bg-[#DCE4FC]", ring: "stroke-[#DCE4FC]" },
]

function Regions() {
  const r = 70
  const c = 2 * Math.PI * r
  let acc = 0
  const arcs = REGIONS.map((g) => {
    const len = (g.share / 100) * c
    const arc = { len: len - 1.6, off: -acc }
    acc += len
    return arc
  })
  return (
    <>
      <SlideTitle>区域分布</SlideTitle>
      <svg viewBox="0 0 200 200" aria-hidden="true" className="absolute top-[17cqw] left-[8cqw] w-[31cqw]">
        {REGIONS.map((g, i) => (
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
        <text x="100" y="98" textAnchor="middle" fontSize="23" fontWeight="700" className="fill-(--s-ink)">¥1.28 亿</text>
        <text x="100" y="118" textAnchor="middle" fontSize="11" className="fill-(--s-mute)">Q2 营收</text>
      </svg>
      <div className="absolute top-[17cqw] right-[7cqw] left-[51cqw]">
        <div className="flex h-[3.4cqw] items-center border-b-[0.12cqw] border-(--s-line) text-[1.6cqw] leading-none text-(--s-mute)">
          <span className="flex-1">区域</span>
          <span className="w-[8cqw] text-right">占比</span>
          <span className="w-[15cqw] text-right">营收（万元）</span>
        </div>
        {REGIONS.map((g) => (
          <div key={g.name} className="flex h-[5.8cqw] items-center border-b-[0.12cqw] border-(--s-line) last:border-b-0">
            <span className={cn("mr-[1.6cqw] size-[1.5cqw] shrink-0 rounded-full", g.dot)} />
            <span className="flex-1 text-[2.5cqw] leading-none font-medium">{g.name}</span>
            <span className="w-[8cqw] text-right text-[2.5cqw] leading-none font-semibold tabular-nums">{g.share}%</span>
            <span className="w-[15cqw] text-right text-[2.3cqw] leading-none text-(--s-body) tabular-nums">{g.amount}</span>
          </div>
        ))}
      </div>
      <SlideFooter page={5} />
    </>
  )
}

/* ------------------------------------------------------------------ 6 下半年计划 */

const PLANS = [
  { Icon: Target, title: "拓展企业客户", lines: ["新增 3 个行业解决方案", "重点突破制造与零售"] },
  { Icon: Zap, title: "提升交付效率", lines: ["上线自动化交付流程", "平均交付周期缩短 25%"] },
  { Icon: Layers, title: "优化产品体验", lines: ["重构核心编辑工作流", "NPS 提升至 55 以上"] },
]

function Plans() {
  return (
    <>
      <SlideTitle>下半年计划</SlideTitle>
      <div className="absolute inset-x-[7cqw] top-[21cqw] grid grid-cols-3 gap-[4cqw]">
        {PLANS.map(({ Icon, title, lines }, i) => (
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
