import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { SlideFooter } from "../SlideArt"

/**
 * 页级占位（画在 SlideFrame 里，尺寸一律 cqw，颜色用 --s-*；rulings §4.25 DS-52 降级占位统一画法）：整页换成一个占位——虚线框 + 图标 + 一行标题 + 一行原因，母版页脚照常。
 * 用在：保真报告「此页内容无法解析」（03-13 页级占位，F1 E2）、放映「此页内容暂时无法显示」（03-11 单页渲染失败，50/10 §9.3）。
 * 第 3 批转正时由 fidelity/slides.tsx 的 UnparsedPage 与 present/slides.tsx 的 RenderFailedPage 合并进 kit（kitRequest g3 K4），画法逐像素相同；状态色不进纸面（虚线 --s-mute、底 --s-card）。
 *
 *   deckWith({ 8: { render: () => <PagePlaceholder icon={FileWarning} title="此页内容无法解析" reason="原内容已保留…" page={8} /> } })
 */
export const PAGE_PLACEHOLDER = "flex flex-col items-center justify-center rounded-[0.6cqw] border-[max(1px,0.14cqw)] border-dashed border-(--s-mute)/70 bg-(--s-card) text-center"

export function PagePlaceholder({ icon: Icon, title, reason, page }: { icon: LucideIcon; title: string; reason: string; page: number }) {
  return (
    <>
      <div className={cn(PAGE_PLACEHOLDER, "absolute inset-x-[7cqw] top-[6cqw] bottom-[8cqw] gap-[1.2cqw]")}>
        <Icon className="size-[4cqw] text-(--s-mute)" strokeWidth={1.5} aria-hidden="true" />
        <span className="mt-[0.4cqw] text-[2.2cqw] leading-none font-semibold text-(--s-ink)">{title}</span>
        <span className="text-[1.6cqw] leading-[1.4] text-(--s-body)">{reason}</span>
      </div>
      <SlideFooter page={page} />
    </>
  )
}
