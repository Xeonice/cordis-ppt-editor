import type { ReactNode } from "react"
import { Presentation } from "lucide-react"
import { cn } from "@/lib/utils"
import { CoverArt, type CoverId } from "./CoverArt"

/**
 * 文档卡片的封面（第 3 批转正时由 scenarios/documents/covers.tsx 并入底座，2026-10-22；画法逐像素相同）：与 CoverArt 同一种做法——16:9 的 @container，尺寸全部用 cqw，
 * 颜色是文档内容的颜色（Q3「文档内容颜色不受限」），外层带 v3-slide（幻灯片内容不参与界面字号检查）与 role="img" + 文档名。
 * 别人共享给我的、回收站里的、搜索命中的几份，以及模板库里集成方来源的 3 套模板都在这里；null 为没有封面的占位（CoverPlaceholder）。
 */
export type ExtraCoverId =
  | "q4-market" | "q3-budget" | "vendor" | "budget-2027" | "campaign" | "sales" | "old-intro" | "teambuilding" | "q1-weekly"
  | "tpl-report" | "tpl-kickoff" | "tpl-training"

function Frame({ bg, label, className, children }: { bg: string; label: string; className?: string; children: ReactNode }) {
  return (
    <div role="img" aria-label={label} className={cn("v3-slide @container relative aspect-video w-full overflow-hidden", bg, className)}>
      {children}
    </div>
  )
}

const BARS = [
  { h: "h-[17cqw]", c: "bg-[#C9D5FB]" },
  { h: "h-[21cqw]", c: "bg-[#9DB1F6]" },
  { h: "h-[25cqw]", c: "bg-[#6F8CF0]" },
  { h: "h-[23cqw]", c: "bg-[#3A5CE6]" },
]

const COVERS: Record<ExtraCoverId, { label: string; bg: string; node: ReactNode }> = {
  "q4-market": {
    label: "Q4 市场计划",
    bg: "bg-[#FFF6EC]",
    node: (
      <>
        <div className="absolute -top-[14cqw] -right-[10cqw] size-[46cqw] rounded-full bg-[#FFB46B]" />
        <div className="absolute top-[18cqw] right-[22cqw] size-[16cqw] rounded-full bg-[#F2702B]" />
        <p className="absolute top-[10cqw] left-[8cqw] text-[1.8cqw] leading-none font-medium tracking-[0.18em] text-[#B4561D]">MARKETING</p>
        <h3 className="absolute top-[17cqw] left-[8cqw] text-[6.8cqw] leading-none font-bold tracking-[-0.01em] text-[#2B1A0E]">Q4 市场计划</h3>
        <p className="absolute top-[28.5cqw] left-[8cqw] text-[2.4cqw] leading-none text-[#8A5B3A]">品牌与渠道 · 2026</p>
        <p className="absolute bottom-[7cqw] left-[8cqw] text-[1.8cqw] leading-none text-[#A07A5E]">市场部</p>
      </>
    ),
  },
  "q3-budget": {
    label: "Q3 预算执行情况",
    bg: "bg-white",
    node: (
      <>
        <h3 className="absolute top-[9cqw] left-[8cqw] text-[5.8cqw] leading-none font-bold tracking-[-0.01em] text-[#141B2D]">Q3 预算执行情况</h3>
        <p className="absolute top-[18.5cqw] left-[8cqw] text-[2.2cqw] leading-none text-[#6B7385]">截至 9 月 30 日 · 财务部</p>
        <p className="absolute top-[33cqw] left-[8cqw] text-[7.2cqw] leading-none font-bold text-[#3A5CE6] tabular-nums">92%</p>
        <p className="absolute top-[42.5cqw] left-[8cqw] text-[1.8cqw] leading-none text-[#8A93A6]">执行率</p>
        <div className="absolute right-[8cqw] bottom-[9cqw] flex items-end gap-[2.4cqw]">
          {BARS.map((b) => (
            <div key={b.h} className={cn("w-[6.4cqw] rounded-t-[0.6cqw]", b.h, b.c)} />
          ))}
        </div>
        <div className="absolute right-[8cqw] bottom-[9cqw] h-[0.2cqw] w-[33cqw] bg-[#DDE1EA]" />
      </>
    ),
  },
  vendor: {
    label: "供应商评估",
    bg: "bg-[#EEF6F1]",
    node: (
      <>
        <div className="absolute top-[11cqw] left-[8cqw] h-[0.7cqw] w-[5cqw] bg-[#2E7D5B]" />
        <h3 className="absolute top-[15cqw] left-[8cqw] text-[6.4cqw] leading-none font-bold tracking-[-0.01em] text-[#173B2C]">供应商评估</h3>
        <p className="absolute top-[26cqw] left-[8cqw] text-[2.3cqw] leading-none text-[#4F7464]">2026 年度 · 采购中心</p>
        <div className="absolute top-[11cqw] right-[8cqw] grid grid-cols-3 gap-[1.6cqw]">
          {["bg-[#2E7D5B]", "bg-[#2E7D5B]", "bg-[#9CC9B4]", "bg-[#2E7D5B]", "bg-[#9CC9B4]", "bg-[#2E7D5B]", "bg-[#9CC9B4]", "bg-[#2E7D5B]", "bg-[#2E7D5B]"].map((c, i) => (
            <div key={i} className={cn("size-[7.4cqw] rounded-[1cqw]", c)} />
          ))}
        </div>
      </>
    ),
  },
  "budget-2027": {
    label: "2027 预算编制说明",
    bg: "bg-[#F4EEE2]",
    node: (
      <>
        <div className="absolute inset-x-[9cqw] top-[8cqw] h-[0.2cqw] bg-[#2B2622]" />
        <h3 className="v3-serif absolute inset-x-0 top-[18cqw] text-center text-[5.8cqw] leading-none font-bold text-[#2B2622]">2027 预算编制说明</h3>
        <p className="v3-serif absolute inset-x-0 top-[29cqw] text-center text-[2.3cqw] leading-none text-[#6B6258]">编制口径 · 时间表 · 审批流程</p>
        <div className="absolute inset-x-[9cqw] bottom-[8cqw] h-[0.2cqw] bg-[#2B2622]" />
        <p className="v3-serif absolute right-[9cqw] bottom-[10.5cqw] text-[1.8cqw] leading-none text-[#7A2E22]">财务部</p>
      </>
    ),
  },
  campaign: {
    label: "市场活动复盘",
    bg: "bg-[#24183A]",
    node: (
      <>
        <div className="absolute -bottom-[16cqw] -left-[8cqw] size-[40cqw] rounded-full bg-[#3B2560]" />
        <div className="absolute top-[9cqw] right-[10cqw] size-[18cqw] rounded-full border-[0.4cqw] border-[#F06FA8]" />
        <div className="absolute top-[22cqw] right-[22cqw] size-[8cqw] rounded-full bg-[#F06FA8]" />
        <h3 className="absolute top-[18cqw] left-[8cqw] text-[6.6cqw] leading-none font-bold tracking-[-0.01em] text-white">市场活动复盘</h3>
        <p className="absolute top-[29cqw] left-[8cqw] text-[2.4cqw] leading-none text-[#C9B8E8]">秋季发布会 · 渠道与转化</p>
      </>
    ),
  },
  sales: {
    label: "销售培训课件",
    bg: "bg-[#E7F4F5]",
    node: (
      <>
        <h3 className="absolute top-[12cqw] left-[8cqw] text-[6.2cqw] leading-none font-bold tracking-[-0.01em] text-[#0F3B40]">销售培训课件</h3>
        <p className="absolute top-[22.5cqw] left-[8cqw] text-[2.3cqw] leading-none text-[#3D6E73]">新人第 2 周 · 销售运营</p>
        <div className="absolute bottom-[9cqw] left-[8cqw] flex items-center gap-[2.4cqw]">
          {["1", "2", "3"].map((n, i) => (
            <div key={n} className="flex items-center gap-[2.4cqw]">
              <span className={cn("flex size-[7cqw] items-center justify-center rounded-full text-[2.8cqw] leading-none font-bold", i === 0 ? "bg-[#0F8B8D] text-white" : "bg-white text-[#0F8B8D]")}>{n}</span>
              {i < 2 && <span className="h-[0.3cqw] w-[8cqw] bg-[#9ED8D4]" />}
            </div>
          ))}
        </div>
      </>
    ),
  },
  "old-intro": {
    label: "旧版产品介绍",
    bg: "bg-[#111827]",
    node: (
      <>
        <div className="absolute top-[10cqw] right-[8cqw] h-[30cqw] w-[38cqw] rounded-[1.4cqw] border-[0.35cqw] border-[#374151]" />
        <div className="absolute top-[14cqw] right-[12cqw] h-[3cqw] w-[18cqw] rounded-[0.5cqw] bg-[#374151]" />
        <div className="absolute top-[20cqw] right-[12cqw] h-[1.4cqw] w-[30cqw] rounded-[0.4cqw] bg-[#1F2937]" />
        <div className="absolute top-[24cqw] right-[12cqw] h-[1.4cqw] w-[24cqw] rounded-[0.4cqw] bg-[#1F2937]" />
        <h3 className="absolute top-[18cqw] left-[8cqw] text-[6.2cqw] leading-none font-bold tracking-[-0.01em] text-white">产品介绍</h3>
        <p className="absolute top-[28.5cqw] left-[8cqw] text-[2.3cqw] leading-none text-[#9CA3AF]">v1.8 · 2025 年版</p>
      </>
    ),
  },
  teambuilding: {
    label: "团建方案（草稿）",
    bg: "bg-[#FFF8D6]",
    node: (
      <>
        <div className="absolute top-[7cqw] right-[9cqw] size-[22cqw] rounded-full bg-[#FFD54A]" />
        <div className="absolute right-0 bottom-0 left-0 h-[12cqw] bg-[#8BC34A]" />
        <h3 className="absolute top-[17cqw] left-[8cqw] text-[6.4cqw] leading-none font-bold tracking-[-0.01em] text-[#3A2E05]">秋季团建方案</h3>
        <p className="absolute top-[28cqw] left-[8cqw] text-[2.4cqw] leading-none text-[#7A6A2A]">草稿 · 待预算确认</p>
      </>
    ),
  },
  "q1-weekly": {
    label: "Q1 周报合集",
    bg: "bg-[#F7F8FA]",
    node: (
      <>
        <h3 className="absolute top-[11cqw] left-[8cqw] text-[6cqw] leading-none font-bold tracking-[-0.01em] text-[#141B2D]">Q1 周报合集</h3>
        <p className="absolute top-[21.5cqw] left-[8cqw] text-[2.2cqw] leading-none text-[#8A93A6]">第 1–13 周 · 产品部</p>
        <div className="absolute right-[8cqw] bottom-[8cqw] grid grid-cols-5 gap-[1.2cqw]">
          {Array.from({ length: 13 }, (_, i) => (
            <div key={i} className={cn("size-[5cqw] rounded-[0.6cqw]", i % 4 === 3 ? "bg-[#3A5CE6]" : "bg-[#DDE3F3]")} />
          ))}
        </div>
      </>
    ),
  },

  /* ---------------------------------------------------------------- 模板库：集成方来源的 3 套（示例来源名「公司模板」，不代表任何真实机构） */
  "tpl-report": {
    label: "季度经营汇报",
    bg: "bg-white",
    node: (
      <>
        <div className="absolute inset-x-0 top-0 h-[2.4cqw] bg-[#0E7C7B]" />
        <div className="absolute top-[9cqw] left-[8cqw] flex items-center gap-[1.2cqw]">
          <span className="size-[3.6cqw] rounded-[0.8cqw] bg-[#0E7C7B]" />
          <span className="text-[1.8cqw] leading-none font-medium text-[#0E7C7B]">公司标识</span>
        </div>
        <h3 className="absolute top-[20cqw] left-[8cqw] text-[6.4cqw] leading-none font-bold tracking-[-0.01em] text-[#12302F]">季度经营汇报</h3>
        <p className="absolute top-[30.5cqw] left-[8cqw] text-[2.3cqw] leading-none text-[#5B7472]">副标题 · 汇报人 · 日期</p>
        <div className="absolute right-[8cqw] bottom-[8cqw] h-[0.3cqw] w-[16cqw] bg-[#9FD3CF]" />
      </>
    ),
  },
  "tpl-kickoff": {
    label: "项目立项",
    bg: "bg-[#0E7C7B]",
    node: (
      <>
        <div className="absolute top-0 -right-[6cqw] h-full w-[34cqw] -skew-x-12 bg-[#0B6564]" />
        <div className="absolute top-0 right-[22cqw] h-full w-[3cqw] -skew-x-12 bg-[#3FA6A2]" />
        <p className="absolute top-[11cqw] left-[8cqw] text-[1.8cqw] leading-none font-medium tracking-[0.16em] text-[#BFE6E3]">KICK-OFF</p>
        <h3 className="absolute top-[18cqw] left-[8cqw] text-[7cqw] leading-none font-bold tracking-[-0.01em] text-white">项目立项</h3>
        <p className="absolute top-[29.5cqw] left-[8cqw] text-[2.4cqw] leading-none text-[#D7F0EE]">目标 · 范围 · 里程碑</p>
      </>
    ),
  },
  "tpl-training": {
    label: "培训课件",
    bg: "bg-[#EEF7F6]",
    node: (
      <>
        <h3 className="absolute top-[12cqw] left-[8cqw] text-[6.4cqw] leading-none font-bold tracking-[-0.01em] text-[#12302F]">培训课件</h3>
        <p className="absolute top-[22.5cqw] left-[8cqw] text-[2.3cqw] leading-none text-[#4D6E6B]">课程名称 · 讲师</p>
        <div className="absolute top-[12cqw] right-[8cqw] flex w-[30cqw] flex-col gap-[1.8cqw]">
          {["01  课程目标", "02  核心内容", "03  练习与测验"].map((t, i) => (
            <div key={t} className={cn("flex h-[5.4cqw] items-center rounded-[0.8cqw] px-[1.6cqw] text-[1.9cqw] leading-none font-medium", i === 0 ? "bg-[#0E7C7B] text-white" : "bg-white text-[#2E5754]")}>
              {t}
            </div>
          ))}
        </div>
      </>
    ),
  },
}

export function ExtraCover({ id, className }: { id: ExtraCoverId; className?: string }) {
  const c = COVERS[id]
  return (
    <Frame bg={c.bg} label={c.label} className={className}>
      {c.node}
    </Frame>
  )
}

const BASE_COVERS: readonly string[] = ["blank", "minimal", "business", "dark", "academic", "vibrant", "q2", "roadmap", "review", "hiring", "onboarding", "okr", "cases", "budget"]
const isBaseCover = (id: string): id is CoverId => BASE_COVERS.includes(id)

/**
 * 没有封面时的占位（03-29 §2.3、03-01「卡片封面来源」随第 3 批定稿）：与真实封面同尺寸（16:9），白色纸面 + 居中 24px Presentation 图标（纸面上的 text-3），
 * 不画骨架条。M2 应用内新建的空白 / 模板文档与包内没有封面的导入文档都是它；M3 起服务端渲染封面，生成完成前也是它（完成后 200ms 淡入替换）。
 * 白纸面与首页「空白」模板卡同一种纸（v3-paper：纸面上的文字与图标固定取亮色 token），与亮色为主的真实封面放在一起不跳。
 */
export function CoverPlaceholder({ label }: { label: string }) {
  return (
    <span role="img" aria-label={`${label}（暂无封面）`} className="v3-paper flex aspect-video w-full items-center justify-center bg-white text-(--v3-text-3)">
      <Presentation size={24} strokeWidth={1.5} aria-hidden="true" />
    </span>
  )
}

/** 按封面键画封面：CoverArt 的 14 个、本目录新增的、null 为占位 */
export function DocCover({ cover, title, className }: { cover: CoverId | ExtraCoverId | null; title: string; className?: string }) {
  if (cover === null) return <CoverPlaceholder label={title} />
  if (isBaseCover(cover)) return <CoverArt id={cover} className={className} />
  return <ExtraCover id={cover} className={className} />
}
