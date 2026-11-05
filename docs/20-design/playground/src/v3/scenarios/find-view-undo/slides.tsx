import { SlideFooter, SlideTitle, type SlideRenderOpts } from "../../kit"

/**
 * 本目录用到的自定义页（画在 SlideFrame 里：尺寸用 cqw，颜色用 --s-*）。
 * TrendSlide：示例文档第 4 页「营收趋势」的同构副本，关键词可换——「全部替换」之后画布与缩略图里的文字跟着变（Q8 真实内容）。
 * 与 SlideArt 的 Trend 同一组数值；示例文档改版时两边一起改（建议底座让 SlideArt 的各页接受文案参数）。
 */

const MONTHLY = [
  { m: "1 月", v: 35, q: 1 },
  { m: "2 月", v: 32, q: 1 },
  { m: "3 月", v: 41, q: 1 },
  { m: "4 月", v: 38, q: 2 },
  { m: "5 月", v: 42, q: 2 },
  { m: "6 月", v: 48, q: 2 },
]

export function TrendSlide({ word = "营收" }: { word?: string }) {
  const slot = 860 / 6
  const bw = 76
  const base = 226
  const top = 54
  const scale = (base - top) / 48
  return (
    <>
      <SlideTitle>{`${word}趋势`}</SlideTitle>
      <p className="absolute top-[16.2cqw] left-[7cqw] text-[2.6cqw] leading-[1.3] text-(--s-body)">
        6 月{word} <b className="font-semibold text-(--s-ink)">4,800 万元</b>，创年内新高；Q2 累计 <b className="font-semibold text-(--s-ink)">1.28 亿元</b>，同比 +18%
      </p>
      <svg viewBox="0 0 860 280" aria-hidden="true" className="absolute top-[22cqw] left-[7cqw] w-[86cqw]">
        {[1, 2, 3, 4].map((k) => (
          <line key={k} x1="0" x2="860" y1={base - k * 43} y2={base - k * 43} strokeWidth="1" className="stroke-[#EDF0F5]" />
        ))}
        <line x1="0" x2="860" y1={base} y2={base} strokeWidth="1.2" className="stroke-[#C9D0DC]" />
        <text x="860" y="14" textAnchor="end" fontSize="13" className="fill-(--s-mute)">
          单位：百万元
        </text>
        {MONTHLY.map((d, i) => {
          const h = d.v * scale
          const x = i * slot + (slot - bw) / 2
          return (
            <g key={d.m}>
              <rect x={x} y={base - h} width={bw} height={h} rx="3" className={d.q === 1 ? "fill-[#C9D5FB]" : "fill-(--s-brand)"} />
              <text x={x + bw / 2} y={base - h - 10} textAnchor="middle" fontSize="15" fontWeight="600" className="fill-(--s-ink) tabular-nums">
                {d.v}
              </text>
              <text x={x + bw / 2} y={base + 22} textAnchor="middle" fontSize="14" className="fill-(--s-mute)">
                {d.m}
              </text>
            </g>
          )
        })}
        {[
          { q: "Q1", sum: "108", x0: 0 },
          { q: "Q2", sum: "128", x0: 3 },
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

/** 粘贴进来的文字（外部网页的一段说明，HTML 已转纯文本）。 */
export const PASTED_TEXT = "营收按合同确认口径统计；海外业务按当月平均汇率折算为人民币。6 月数据为快报，最终以财务部的终版报表为准。"

/**
 * 「数据口径」页：标题 + 刚粘贴出来的文本框（新建文本框、进入编辑态，ED-17）。
 * 文本框按新建默认样式：18 pt（960 pt 宽的页面上 1.875cqw）、行距 1.2 倍（约 1.44 倍字高）、深墨色。
 * 编辑态（1px 强调色框 + 行尾插入符）只画在画布上，缩略图里只有文字。
 */
export function DataNotesSlide({ where, selection }: SlideRenderOpts) {
  const editing = where === "canvas" && selection === "text"
  return (
    <>
      <SlideTitle>数据口径</SlideTitle>
      <div className="absolute top-[19cqw] left-[7cqw] w-[60cqw]">
        <p className="text-[1.875cqw] leading-[1.44]">
          {PASTED_TEXT}
          {editing && <span aria-hidden="true" className="mx-px inline-block h-[1.1em] w-0 translate-y-[0.18em] border-l-[0.16cqw] border-(--v3-accent)" />}
        </p>
        {editing && <div aria-hidden="true" className="pointer-events-none absolute -inset-x-[1cqw] -inset-y-[0.7cqw] border border-(--v3-accent)" />}
      </div>
      <SlideFooter page={6} />
    </>
  )
}
