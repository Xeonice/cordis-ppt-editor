import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { themeOf, type BuiltinThemeId } from "./editor/layouts/data"
import { SlideArt } from "./SlideArt"

/**
 * 首页的模板与最近文档封面：每个都是一张有自己风格的首页幻灯片。
 * 与 SlideArt 同一套做法：16:9 的 @container，内部尺寸全部用 cqw，不写 style={{}}，不加载外部图片。
 * 5 个模板（简约 / 商务 / 暗色 / 学术 / 活力）就是编辑器主题画廊的 5 套内置主题（rulings §4.25 DS-33，模板 = 主题 + 母版 + 版式包）：
 * 封面加 mt-theme-<id> 类，底色、文字与色块一律取该主题的 --s-* 内容 token（editor/layouts/data.ts BUILTIN_THEMES，与画廊同一份数据），不另写颜色。
 */
export type CoverId =
  | "blank" | "minimal" | "business" | "dark" | "academic" | "vibrant"
  | "q2" | "roadmap" | "review" | "hiring" | "onboarding" | "okr" | "cases" | "budget"

function Frame({ bg, label, className, children }: { bg: string; label: string; className?: string; children: ReactNode }) {
  return (
    <div role="img" aria-label={label} className={cn("v3-slide @container relative aspect-video w-full overflow-hidden", bg, className)}>
      {children}
    </div>
  )
}

/** 模板封面：名称、底色与配色都取内置主题（data.ts），bg 是主题类 mt-theme-<id>（THEME_CSS 写底色与 --s-*）。 */
const template = (id: BuiltinThemeId, node: ReactNode) => {
  const t = themeOf(id)
  return { label: t.name, bg: t.className ?? "", node }
}

/* 圆环：预算封面用 */
const RING = [
  { share: 42, cls: "stroke-[#1F2A5C]" },
  { share: 27, cls: "stroke-[#3A5CE6]" },
  { share: 18, cls: "stroke-[#7F98F1]" },
  { share: 13, cls: "stroke-[#C9D5FB]" },
]

function Ring() {
  const r = 70
  const c = 2 * Math.PI * r
  let acc = 0
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className="absolute top-[9cqw] right-[8cqw] w-[34cqw]">
      {RING.map((g) => {
        const len = (g.share / 100) * c
        const off = -acc
        acc += len
        return (
          <circle
            key={g.cls}
            cx="100"
            cy="100"
            r={r}
            fill="none"
            strokeWidth="28"
            strokeDasharray={`${len - 1.6} ${c}`}
            strokeDashoffset={off}
            transform="rotate(-90 100 100)"
            className={g.cls}
          />
        )
      })}
    </svg>
  )
}

const COVERS: Record<Exclude<CoverId, "q2">, { label: string; bg: string; node: ReactNode }> = {
  /* ---------------------------------------------------------------- 模板 6 个：空白 + 内置 5 套主题 */
  // 空白页就是一张白纸；「+」与说明文字是 UI，按固定 px 由首页模板卡叠加，不画在幻灯片里
  blank: { label: "空白", bg: "bg-white", node: null },
  minimal: template(
    "minimal",
    <>
      <p className="absolute top-[8cqw] left-[8cqw] text-[1.6cqw] leading-none font-medium tracking-[0.2em] text-(--s-brand-mid)">PRESENTATION</p>
      <h3 className="absolute top-[21cqw] left-[8cqw] text-[8cqw] leading-none font-bold tracking-[-0.02em] text-(--s-ink)">简约演示</h3>
      <div className="absolute top-[34.5cqw] left-[8cqw] h-[0.5cqw] w-[9cqw] bg-(--s-brand)" />
      <p className="absolute top-[38.5cqw] left-[8cqw] text-[2.5cqw] leading-none text-(--s-mute)">副标题 · 2026</p>
    </>,
  ),
  business: template(
    "business",
    <>
      <div className="absolute inset-x-0 top-0 h-[35cqw] bg-(--s-ink)" />
      <div className="absolute top-[11cqw] left-[8cqw] h-[0.7cqw] w-[5cqw] bg-(--s-brand)" />
      <h3 className="absolute top-[14.5cqw] left-[8cqw] text-[6.6cqw] leading-none font-bold tracking-[-0.01em] text-white">年度经营分析</h3>
      <p className="absolute top-[25cqw] left-[8cqw] text-[2.4cqw] leading-none text-white/70">2026 · 经营管理部</p>
      <p className="absolute bottom-[7cqw] left-[8cqw] text-[1.9cqw] leading-none text-(--s-body)">汇报人：张明　2026.07</p>
      <div className="absolute right-[8cqw] bottom-[7cqw] h-[0.35cqw] w-[14cqw] bg-(--s-line)" />
    </>,
  ),
  dark: template(
    "dark",
    <>
      <div className="absolute -top-[10cqw] -right-[12cqw] size-[56cqw] rounded-full border-[0.25cqw] border-(--s-line)" />
      <div className="absolute top-[5cqw] -right-[1cqw] size-[34cqw] rounded-full border-[0.25cqw] border-(--s-line)" />
      <h3 className="absolute top-[19cqw] left-[9cqw] text-[7.6cqw] leading-none font-bold tracking-[-0.01em] text-(--s-ink)">产品发布会</h3>
      <div className="absolute top-[31.5cqw] left-[9cqw] h-[0.7cqw] w-[7cqw] bg-(--s-brand)" />
      <p className="absolute top-[35cqw] left-[9cqw] text-[2.6cqw] leading-none text-(--s-body)">新一代协同引擎</p>
    </>,
  ),
  academic: template(
    "academic",
    <>
      <div className="absolute inset-x-[9cqw] top-[7cqw] h-[0.2cqw] bg-(--s-ink)" />
      <div className="absolute inset-x-[9cqw] top-[8.4cqw] h-[0.1cqw] bg-(--s-ink)" />
      <h3 className="v3-serif absolute inset-x-0 top-[19cqw] text-center text-[6.4cqw] leading-none font-bold text-(--s-ink)">研究进展报告</h3>
      <p className="v3-serif absolute inset-x-0 top-[31cqw] text-center text-[2.4cqw] leading-none text-(--s-body) italic">课题组 · 2026 年春季学期</p>
      <div className="absolute inset-x-[9cqw] bottom-[8.4cqw] h-[0.1cqw] bg-(--s-ink)" />
      <div className="absolute inset-x-[9cqw] bottom-[7cqw] h-[0.2cqw] bg-(--s-ink)" />
    </>,
  ),
  vibrant: template(
    "vibrant",
    <>
      <div className="absolute inset-y-0 left-0 w-[40cqw] bg-(--s-brand)" />
      <div className="absolute top-[8cqw] left-[9cqw] size-[19cqw] rounded-full bg-(--s-a2)" />
      <div className="absolute top-[31cqw] left-[20cqw] size-[14cqw] bg-(--s-a3)" />
      <div className="absolute bottom-0 left-0 h-[13cqw] w-[13cqw] rounded-tr-full bg-(--s-ink)" />
      <h3 className="absolute top-[18cqw] left-[47cqw] text-[7.4cqw] leading-none font-bold tracking-[-0.02em] text-(--s-ink)">新品发布</h3>
      <p className="absolute top-[31cqw] left-[47cqw] text-[2.6cqw] leading-none text-(--s-body)">夏季系列 2026</p>
    </>,
  ),

  /* ---------------------------------------------------------------- 最近文档（q2 直接用 SlideArt 第 1 页） */
  roadmap: {
    label: "产品路线图",
    bg: "bg-[#F6F7FA]",
    node: (
      <>
        <h3 className="absolute top-[7cqw] left-[7cqw] text-[6cqw] leading-none font-bold tracking-[-0.01em] text-[#141B2D]">产品路线图</h3>
        <span className="absolute top-[7.6cqw] left-[39cqw] rounded-[0.6cqw] border border-[#D5DAE5] bg-white px-[1.2cqw] py-[0.6cqw] text-[1.6cqw] leading-none text-[#5B6578]">2026 H2</span>
        {["2026 Q3", "2026 Q4", "2027 Q1", "2027 Q2"].map((q, i) => (
          <div key={q} className={cn("absolute top-[23cqw] bottom-[6cqw] w-[21.5cqw] border-l-[0.12cqw] border-[#DDE1EA] pl-[1.2cqw]", ["left-[7cqw]", "left-[28.5cqw]", "left-[50cqw]", "left-[71.5cqw]"][i])}>
            <span className="text-[1.5cqw] leading-none text-[#8A93A6]">{q}</span>
          </div>
        ))}
        <div className="absolute top-[28.5cqw] left-[8.4cqw] flex h-[4.2cqw] w-[36cqw] items-center rounded-[0.8cqw] bg-[#3A5CE6] px-[1.4cqw] text-[1.7cqw] leading-none font-medium text-white">编辑器 v3</div>
        <div className="absolute top-[34.5cqw] left-[29.9cqw] flex h-[4.2cqw] w-[40cqw] items-center rounded-[0.8cqw] bg-[#7F98F1] px-[1.4cqw] text-[1.7cqw] leading-none font-medium text-white">实时协同</div>
        <div className="absolute top-[40.5cqw] left-[51.4cqw] flex h-[4.2cqw] w-[38cqw] items-center rounded-[0.8cqw] bg-[#B9C7F8] px-[1.4cqw] text-[1.7cqw] leading-none font-medium text-[#1F2A5C]">插件市场</div>
      </>
    ),
  },
  review: {
    label: "设计评审",
    bg: "bg-[#1B1F29]",
    node: (
      <>
        <div className="absolute top-[9cqw] right-[8cqw] h-[29cqw] w-[36cqw] rounded-[1.2cqw] bg-[#2A2F3B]" />
        <div className="absolute top-[22cqw] right-[18cqw] flex h-[25cqw] w-[32cqw] flex-col gap-[1.8cqw] rounded-[1.2cqw] bg-[#F2F4F8] p-[2.6cqw]">
          <div className="h-[2.4cqw] w-[14cqw] rounded-[0.4cqw] bg-[#C9D0DC]" />
          <div className="h-[1.4cqw] w-full rounded-[0.4cqw] bg-[#E1E5EC]" />
          <div className="h-[1.4cqw] w-[80%] rounded-[0.4cqw] bg-[#E1E5EC]" />
          <div className="mt-auto h-[3.6cqw] w-[9cqw] rounded-[0.6cqw] bg-[#5B7CFF]" />
        </div>
        <h3 className="absolute top-[17cqw] left-[8cqw] text-[6.6cqw] leading-none font-bold tracking-[-0.01em] text-white">设计评审</h3>
        <p className="absolute top-[28cqw] left-[8cqw] text-[2.4cqw] leading-none text-[#9AA3B5]">设计语言 v3 · 第 2 轮</p>
      </>
    ),
  },
  hiring: {
    label: "招聘计划",
    bg: "bg-[#FFF3E3]",
    node: (
      <>
        <div className="absolute top-[12cqw] left-[8cqw] h-[0.7cqw] w-[5cqw] bg-[#F0643C]" />
        <h3 className="absolute top-[16cqw] left-[8cqw] text-[6.6cqw] leading-none font-bold tracking-[-0.01em] text-[#3A2415]">招聘计划</h3>
        <p className="absolute top-[27.5cqw] left-[8cqw] text-[2.4cqw] leading-none text-[#8A6A4F]">2026 Q4 · 12 个岗位</p>
        <div className="absolute top-[12cqw] right-[8cqw] grid grid-cols-3 gap-[2cqw]">
          {["bg-[#F0643C]", "bg-[#F7A58B]", "bg-[#FAD0C2]", "bg-[#F7A58B]", "bg-[#FAD0C2]", "bg-[#F0643C]"].map((c, i) => (
            <div key={i} className={cn("size-[9.5cqw] rounded-full", c)} />
          ))}
        </div>
      </>
    ),
  },
  onboarding: {
    label: "新人培训手册",
    bg: "bg-white",
    node: (
      <>
        <div className="absolute inset-y-0 left-0 w-[9cqw] bg-[#2F6F5E]" />
        <h3 className="absolute top-[17cqw] left-[16cqw] text-[6cqw] leading-none font-bold tracking-[-0.01em] text-[#16352D]">新人培训手册</h3>
        <p className="absolute top-[27.5cqw] left-[16cqw] text-[2.3cqw] leading-none text-[#5E7F75]">Onboarding Guide · v2.1</p>
        <p className="absolute bottom-[7cqw] left-[16cqw] text-[1.8cqw] leading-none text-[#8A93A6]">人力资源部</p>
        <div className="absolute top-[34cqw] right-[10cqw] h-[16cqw] w-[24cqw] rounded-t-[1cqw] bg-[#DCEBE5]" />
        <div className="absolute top-[38cqw] right-[14cqw] h-[16cqw] w-[24cqw] rounded-t-[1cqw] bg-[#BFD9CF]" />
        <div className="absolute top-[42cqw] right-[18cqw] h-[16cqw] w-[24cqw] rounded-t-[1cqw] bg-[#2F6F5E]" />
      </>
    ),
  },
  okr: {
    label: "季度 OKR 复盘",
    bg: "bg-[#1B2A4A]",
    node: (
      <>
        <p className="absolute -right-[2cqw] -bottom-[9cqw] text-[46cqw] leading-none font-bold tracking-[-0.04em] text-[#26385F]">Q3</p>
        <div className="absolute top-[13cqw] left-[8cqw] h-[0.7cqw] w-[5cqw] bg-[#5B7CFF]" />
        <h3 className="absolute top-[17cqw] left-[8cqw] text-[6.2cqw] leading-none font-bold tracking-[-0.01em] text-white">季度 OKR 复盘</h3>
        <p className="absolute top-[28cqw] left-[8cqw] text-[2.4cqw] leading-none text-[#A9B6D3]">2026 Q3 · 产品部</p>
      </>
    ),
  },
  cases: {
    label: "客户成功案例",
    bg: "bg-white",
    node: (
      <>
        <p className="v3-serif absolute -top-[2cqw] left-[6cqw] text-[34cqw] leading-none font-bold text-[#E6ECFD]">“</p>
        <h3 className="absolute top-[22cqw] left-[8cqw] text-[6cqw] leading-none font-bold tracking-[-0.01em] text-[#141B2D]">客户成功案例</h3>
        <p className="absolute top-[32.5cqw] left-[8cqw] text-[2.4cqw] leading-none text-[#4B566B]">增长 3 倍的真实故事</p>
        <div className="absolute top-[10cqw] right-[8cqw] size-[30cqw] rounded-full bg-[#DCE4FB]" />
        <div className="absolute right-[32cqw] bottom-[9cqw] size-[13cqw] rounded-full bg-[#3A5CE6]" />
      </>
    ),
  },
  budget: {
    label: "年度预算",
    bg: "bg-[#F7F8FA]",
    node: (
      <>
        <h3 className="absolute top-[10cqw] left-[8cqw] text-[6.6cqw] leading-none font-bold tracking-[-0.01em] text-[#141B2D]">年度预算</h3>
        <p className="absolute top-[21cqw] left-[8cqw] text-[2.4cqw] leading-none text-[#8A93A6]">2027 财年 · 财务部</p>
        <p className="absolute top-[35cqw] left-[8cqw] text-[6.4cqw] leading-none font-bold tracking-[-0.01em] text-[#141B2D] tabular-nums">¥4.8 亿</p>
        <p className="absolute top-[45cqw] left-[8cqw] text-[1.8cqw] leading-none text-[#8A93A6]">总预算</p>
        <Ring />
      </>
    ),
  },
}

export function CoverArt({ id, className }: { id: CoverId; className?: string }) {
  if (id === "q2") return <SlideArt n={1} className={className} />
  const c = COVERS[id]
  return (
    <Frame bg={c.bg} label={c.label} className={className}>
      {c.node}
    </Frame>
  )
}
