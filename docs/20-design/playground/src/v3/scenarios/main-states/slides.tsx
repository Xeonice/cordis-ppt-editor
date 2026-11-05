import { Puzzle } from "lucide-react"
import { cn } from "@/lib/utils"
import { deckWith, DegradedPlaceholder, SlideFooter, SlideTitle, type DeckSlide } from "../../kit"

/**
 * main-states 场景的自定义页（画在 SlideFrame 里，尺寸一律 cqw，颜色用 --s-*）。
 *
 * 1. 打开中的「版式骨架」（02 §6.2「母版 / 版式骨架先出（占位框），再逐步替换为真实内容」）：
 *    母版与版式解析完、页面内容还没到时，画出的是这一页真实的版式几何——母版装饰（标题下的品牌色短线、标题页左侧竖条）
 *    和页脚是真的，标题 / 正文占位符画成虚线框。不是灰色骨架条（Q8），内容到了就原地换成真实渲染。
 * 2. 缺插件的占位（03-09 §6.2、03-13 元素级降级）：底座 DegradedPlaceholder——虚线框 + 拼图图标 + 一行插件名 + 一行「原因，内容已保留」，
 *    与保真占位同一画法（rulings §4.25 DS-52：原「插件名 / 原因 / 内容已保留」三行改为两行，2026-10-15）。
 */

/** 版式占位符：虚线框（缩略图里至少 1px） */
const PH = "absolute rounded-[0.5cqw] border-[max(1px,0.13cqw)] border-dashed border-(--s-mute)/45"

/** 「标题幻灯片」版式：左侧品牌色竖条是母版装饰，标题、副标题是占位符。 */
function SkeletonTitleSlide() {
  return (
    <>
      <div className="absolute top-[18cqw] left-[7cqw] h-[15.2cqw] w-[1cqw] bg-(--s-brand)" />
      <div className={cn(PH, "top-[17.6cqw] left-[10.5cqw] h-[9.4cqw] w-[66cqw]")} />
      <div className={cn(PH, "top-[29.2cqw] left-[10.5cqw] h-[4.6cqw] w-[38cqw]")} />
    </>
  )
}

/** 「仅标题」/「标题和内容」版式：标题占位符 + 母版的品牌色短线与页脚；body 时多一个正文占位符。 */
function SkeletonContentSlide({ page, body = false }: { page: number; body?: boolean }) {
  return (
    <>
      <div className={cn(PH, "top-[5.6cqw] left-[7cqw] h-[6.6cqw] w-[40cqw]")} />
      <div className="absolute top-[13.4cqw] left-[7cqw] h-[0.55cqw] w-[4.2cqw] bg-(--s-brand)" />
      {body && <div className={cn(PH, "top-[18.4cqw] left-[7cqw] h-[29cqw] w-[86cqw]")} />}
      <SlideFooter page={page} />
    </>
  )
}

const skeleton = (n: number) => (n === 1 ? <SkeletonTitleSlide /> : <SkeletonContentSlide page={n} body={n === 2} />)

/** 首屏可见前：6 页都只有版式骨架（评论数也还没到，不显示角标）。 */
export const OPENING_DECK: DeckSlide[] = deckWith({
  1: { render: () => skeleton(1), comments: 0 },
  2: { render: () => skeleton(2), comments: 0 },
  3: { render: () => skeleton(3), comments: 0 },
  4: { render: () => skeleton(4), comments: 0 },
  5: { render: () => skeleton(5), comments: 0 },
  6: { render: () => skeleton(6), comments: 0 },
})

/** 首屏可交互、后台继续解析：第 1–4 页已是真实渲染，第 5、6 页还是版式骨架（缩略图逐项替换，不等全部完成）。 */
export const REST_DECK: DeckSlide[] = deckWith({
  5: { render: () => skeleton(5), comments: 0 },
  6: { render: () => skeleton(6), comments: 0 },
})

/** M2 未装评论包（slide.hasComments 为假）：缩略图不显示评论计数。 */
export const NO_COMMENTS_DECK: DeckSlide[] = deckWith({ 4: { comments: 0 } })

/* ------------------------------------------------------------------ 缺插件：二维码形状（acme:qr-shape）的占位 */

const QR_ITEMS = [
  { title: "产品手册", sub: "2026 版 · PDF" },
  { title: "客户案例", sub: "制造与零售" },
  { title: "预约演示", sub: "30 分钟线上演示" },
]

/**
 * 第 6 页「扫码获取资料」：三个二维码都由插件「二维码形状」绘制，插件不可用时原位显示占位（底座 DegradedPlaceholder 两行字：插件名 +「原因，内容已保留」，
 * 与保真占位同一画法，rulings §4.25 DS-52）。第 2 批 plugins 场景缺多个插件的文档（第 6 页）与 offline-conflict.priority-yield 用的是同一页。
 */
export function QrSlide({ reason }: { reason: string }) {
  return (
    <>
      <SlideTitle>扫码获取资料</SlideTitle>
      <div className="absolute inset-x-[13cqw] top-[18.5cqw] grid grid-cols-3 gap-[8cqw]">
        {QR_ITEMS.map((q) => (
          <div key={q.title} className="flex flex-col items-center">
            <DegradedPlaceholder icon={Puzzle} title="二维码形状" reason={`${reason}，内容已保留`} className="aspect-square w-full" />
            <p className="mt-[2.2cqw] text-[2.4cqw] leading-none font-semibold">{q.title}</p>
            <p className="mt-[1.2cqw] text-[1.7cqw] leading-none text-(--s-mute)">{q.sub}</p>
          </div>
        ))}
      </div>
      <SlideFooter page={6} />
    </>
  )
}

/** 第 6 页换成「扫码获取资料」，占位上的原因随缺插件的原因变化（插件已停用 / 本部署未部署 / 需要 ≥ 1.2）。 */
export const qrDeck = (reason: string): DeckSlide[] => deckWith({ 6: { name: "扫码获取资料", render: () => <QrSlide reason={reason} /> } })
