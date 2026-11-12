import { cn } from "@/lib/utils"
import { deckWith, px, SlideFooter, SlideTitle, type Box, type DeckSlide } from "../../kit"

/**
 * shape-library 场景用的第 6 页「下半年计划」变体：三个阶段的流程框 + 箭头，用户正在用形状库搭这张流程图。
 * 960 × 540 设计稿坐标；流程框是圆角矩形（默认圆角 = 短边 × 16.667% = 20），画在 SlideFrame 里，字号与间距用 cqw。
 *   empty3   ：第 3 个阶段还没画（插入工具就绪 / 拖出预览）
 *   new3     ：刚插入的第 3 个圆角矩形，主题样式（强调 1 填充、深一档描边），还没有文字
 *   complete ：三个阶段齐全，右下角刚插入一个「前进或下一项」动作按钮
 */
export type FlowStage = "empty3" | "new3" | "complete"

/** 三个流程框的位置（px）：x 67 / 357 / 647，y 221，246 × 120 */
export const FLOW_BOX = [px(67.2, 220.8, 245.8, 120), px(357.1, 220.8, 245.8, 120), px(647, 220.8, 245.8, 120)] as const
/** 第 3 个流程框（拖出 / 新插入的位置） */
export const SLOT3: Box = px(647, 220.8, 245.8, 120)
/** 右下角动作按钮 */
export const ACTION_BOX: Box = px(830, 420, 63, 42)

const STEPS = [
  { step: "阶段 1 · 7–8 月", title: "拓展企业客户", lines: ["新增 3 个行业解决方案", "重点突破制造与零售"] },
  { step: "阶段 2 · 9–10 月", title: "提升交付效率", lines: ["上线自动化交付流程", "平均交付周期缩短 25%"] },
  { step: "阶段 3 · 11–12 月", title: "优化产品体验", lines: ["重构核心编辑工作流", "NPS 提升至 55 以上"] },
]

const X = ["left-[7cqw]", "left-[37.2cqw]", "left-[67.4cqw]"] as const

function StepBox({ i }: { i: 0 | 1 | 2 }) {
  const s = STEPS[i]!
  return (
    <div className={cn("absolute top-[23cqw] flex h-[12.5cqw] w-[25.6cqw] flex-col justify-center rounded-[2.08cqw] bg-(--s-note) px-[2.4cqw]", X[i])}>
      <span className="text-[1.6cqw] leading-none font-semibold text-(--s-brand) tabular-nums">{s.step}</span>
      <span className="mt-[1.5cqw] text-[2.8cqw] leading-none font-bold">{s.title}</span>
    </div>
  )
}

function StepLines({ i }: { i: 0 | 1 | 2 }) {
  const s = STEPS[i]!
  return (
    <div className={cn("absolute top-[38cqw] w-[25.6cqw] pl-[0.4cqw] text-[1.9cqw] leading-[1.75] text-(--s-body)", X[i])}>
      {s.lines.map((l) => (
        <p key={l} className="flex items-center gap-[1cqw] whitespace-nowrap">
          <span className="size-[0.6cqw] shrink-0 rounded-full bg-(--s-brand-mid)" />
          {l}
        </p>
      ))}
    </div>
  )
}

/** 主题样式的新形状：强调 1 填充 + 深一档描边（新插入形状只写 p:style 主题引用，R-d-63） */
function ThemedRoundRect() {
  return <div className="absolute top-[23cqw] left-[67.4cqw] h-[12.5cqw] w-[25.6cqw] rounded-[2.08cqw] border-[0.16cqw] border-[#2C47C2] bg-(--s-brand)" />
}

/** 箭头（960 × 540 视框）：框与框之间、以及第 2 框指向第 3 个位置 */
function Arrows({ count }: { count: 1 | 2 }) {
  const ys = 280.8
  const segs = [
    [320, 350],
    [610, 640],
  ].slice(0, count)
  return (
    <svg viewBox="0 0 960 540" aria-hidden="true" className="absolute inset-0 size-full">
      {segs.map(([a, b]) => (
        <g key={a} className="fill-(--s-mute) stroke-(--s-mute)">
          <line x1={a} x2={(b ?? 0) - 6} y1={ys} y2={ys} strokeWidth="2" />
          <path d={`M${(b ?? 0) - 9} ${ys - 6} L${b} ${ys} L${(b ?? 0) - 9} ${ys + 6} Z`} strokeWidth="1" strokeLinejoin="round" />
        </g>
      ))}
    </svg>
  )
}

/** 「前进或下一项」动作按钮：主题样式，圆角方框内一个白色三角 */
function ActionButtonArt() {
  return (
    <div className="absolute top-[43.75cqw] left-[86.46cqw] flex h-[4.375cqw] w-[6.56cqw] items-center justify-center rounded-[0.5cqw] border-[0.16cqw] border-[#2C47C2] bg-(--s-brand)">
      <svg viewBox="0 0 12 12" className="size-[1.9cqw] fill-white" aria-hidden="true">
        <path d="M3 1.5v9l7-4.5Z" />
      </svg>
    </div>
  )
}

function FlowSlide({ stage }: { stage: FlowStage }) {
  return (
    <>
      <SlideTitle>下半年计划</SlideTitle>
      <p className="absolute top-[16.2cqw] left-[7cqw] text-[2.4cqw] leading-[1.3] text-(--s-body)">分三个阶段推进，12 月底前全部上线</p>
      <StepBox i={0} />
      <StepBox i={1} />
      {stage === "complete" && <StepBox i={2} />}
      {stage === "new3" && <ThemedRoundRect />}
      <Arrows count={2} />
      <StepLines i={0} />
      <StepLines i={1} />
      {stage === "complete" && <StepLines i={2} />}
      {stage === "complete" && <ActionButtonArt />}
      <SlideFooter page={6} />
    </>
  )
}

/** 示例文档第 6 页换成流程图变体（左栏缩略图、网格同步） */
export function flowDeck(stage: FlowStage): DeckSlide[] {
  return deckWith({ 6: { name: "下半年计划", layout: "仅标题", render: () => <FlowSlide stage={stage} /> } })
}
