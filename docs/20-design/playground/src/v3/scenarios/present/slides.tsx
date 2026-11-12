import { ImageOff } from "lucide-react"
import { deckWith, PagePlaceholder, type DeckSlide } from "../../kit"

/**
 * 放映场景的自定义页（画在 SlideFrame 里，尺寸一律 cqw，颜色用 --s-*）。
 *
 * 单页渲染失败（03-11「单页渲染失败只把该页降级为占位提示，不中断整体放映」、50/10 §9.3）：这一页换成页级占位，
 * 与保真报告「整页无法解析」的页级占位同一个件（kit PagePlaceholder：虚线框 + 图标 + 一行标题 + 一行原因，母版页脚照常；rulings §4.25 DS-52 降级占位统一画法；第 3 批转正时由这里的局部件并入），
 * 只换图标与文案：ImageOff（这一页画不出来，不是内容坏了）·「此页内容暂时无法显示」·「渲染这一页时出错，原内容已保留」——这一页投在观众面前，
 * 原因行只写一句中性说明，「可以继续翻页」这类给主讲人的操作提示不进纸面（写在状态 note 里）。
 * 状态色不进纸面（虚线 --s-mute、底 --s-card）。
 */
function RenderFailedPage({ page }: { page: number }) {
  return <PagePlaceholder icon={ImageOff} title="此页内容暂时无法显示" reason="渲染这一页时出错，原内容已保留" page={page} />
}

/** 第 4 页渲染失败的示例文档（其余页照常）。 */
export const FAILED_DECK: DeckSlide[] = deckWith({ 4: { render: () => <RenderFailedPage page={4} />, comments: 0 } })
