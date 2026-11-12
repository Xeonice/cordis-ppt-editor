import { deckWith, SlideFooter, SlideTitle, type DeckSlide, type SlideRenderOpts } from "../../kit"
import { ChartSvg, RadarSvg } from "./ChartSvg"
import { CHART_PAGE, CONTENT_BOX, LEFT_BOX, RIGHT_BOX, type CqBox } from "./model"
import { useChart, type ChartModel } from "./store"

/**
 * 第 5 页「区域分布」换成图表页：标题 + 正文占位符位置上的图表（或空内容占位符）。
 * 图表是幻灯片内容：读运行中的图表状态（检查器改了类型、选项、数据，画布与左栏缩略图同时重绘）。
 * 空占位符的虚线框与提示文字只画在画布上（不进缩略图、放映与导出，03-16）；图标条在画布叠加层（overlays.tsx）。
 */

const cq = (b: CqBox) => ({ left: `${b.x}cqw`, top: `${b.y}cqw`, width: `${b.w}cqw`, height: `${b.h}cqw` })

/** 与 03-16（文本组）、03-30（表格组）空占位符同一画法：说明灰虚线框、圆点 +「单击此处添加文本」 */
function EmptyPlaceholder({ box }: { box: CqBox }) {
  return (
    <div className="absolute border border-dashed border-[color-mix(in_srgb,var(--s-mute)_70%,transparent)]" style={cq(box)}>
      <p className="flex items-center gap-[1.2cqw] px-[1.6cqw] pt-[1.4cqw] text-[2.2cqw] leading-[1.4] text-(--s-mute)">
        <span className="size-[0.85cqw] rounded-full bg-(--s-mute)" aria-hidden="true" />
        单击此处添加文本
      </p>
    </div>
  )
}

export function ChartBox({ box, m }: { box: CqBox; m: ChartModel }) {
  return (
    <div className="absolute" style={cq(box)}>
      <ChartSvg spec={m.spec} data={m.data} options={m.options} width={box.w * 9.6} height={box.h * 9.6} trendline={m.droppable ? 0 : undefined} />
    </div>
  )
}

function ChartSlide({ where }: { where: SlideRenderOpts["where"] }) {
  const [m] = useChart()
  return (
    <>
      <SlideTitle>区域分布</SlideTitle>
      {m.page === "empty" && where === "canvas" && <EmptyPlaceholder box={CONTENT_BOX} />}
      {m.page === "chart" && <ChartBox box={CONTENT_BOX} m={m} />}
      {m.page === "radar" && (
        <div className="absolute" style={cq(CONTENT_BOX)}>
          <RadarSvg width={CONTENT_BOX.w * 9.6} height={CONTENT_BOX.h * 9.6} />
        </div>
      )}
      {m.page === "m2" && (
        <>
          <ChartBox box={LEFT_BOX} m={m} />
          {where === "canvas" && <EmptyPlaceholder box={RIGHT_BOX} />}
        </>
      )}
      <SlideFooter page={CHART_PAGE} />
    </>
  )
}

/** 示例文档第 5 页换成图表页（左栏、网格、画布同步）；缺省版式「标题和内容」，M2 演示用「两栏内容」 */
export const deckFor = (layout: "标题和内容" | "两栏内容" = "标题和内容"): DeckSlide[] =>
  deckWith({ [CHART_PAGE]: { name: "区域分布", layout, render: ({ where }) => <ChartSlide where={where} /> } })
