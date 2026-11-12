import { ChartColumn, Lock, RefreshCw } from "lucide-react"
import { DECK_PINS, deckWith, DegradedPlaceholder, ICON, InspectorNotice, RailStatus, SlideFooter, SlideTitle, type DeckSlide } from "../../kit"
import { CEILING_TEXT } from "./banners"

/**
 * doc-banners 的编辑器形态：三条横幅背后的写入状态，与第 2 批 offline-conflict 已拍板的两种形态对齐，不另起画法——
 * - 暂时不能编辑（发现新版本且会话已关闭）= offline-conflict 的「登录已过期 / 协同已暂停」：字段留在原位、aria-disabled、工具提示写原因（inspector.disabled），
 *   检查器标题上方一行说明（TB-22），色块与缩略降到半透明，连接已断开所以头像组只剩自己、画布上没有远端光标（03-12 §8.5、DS-58）；
 * - 只读加入（文档已达元素上限）= 「编辑者名额已满」：检查器只读展示当前值、顶部一行说明（DS-15），创建工具（含评论）留在原位不可用。
 * 两组配置就是 offline-conflict 导出的 paused() / readonly()（含 PAUSED_DIM；第 3 批转正时并入，原来在这里照抄的一份随之删去），doc-banners.scenario 直接取用；
 * 这里只剩本场景自己的原因、检查器顶部一行、同步状态行与代码块漂移的第 4 页。
 */

const SI = { size: 12, strokeWidth: 1.75, "aria-hidden": true } as const

/** 发现新版本、会话已关闭：工具与字段的不可用原因、检查器顶部一行（刷新图标同横幅，次级文字色） */
export const DRIFT_REASON = "刷新后可编辑"
export const DRIFT_NOTICE = <InspectorNotice icon={<RefreshCw {...ICON} aria-hidden="true" />}>暂不可编辑 · 发现新版本，刷新后恢复</InspectorNotice>

/** 元素上限只读：工具的不可用原因与检查器顶部一行 */
export const CEILING_REASON = "文档已达元素上限"
export const CEILING_NOTICE = "只读 · 文档已达元素上限"

/** 同步状态行悬停说明（03-12「hover 说明」，按句分行）：横幅关掉后从这里仍能看到原因与数字 */
const CEILING_HINT = CEILING_TEXT.split("；").map((s, i, all) => (i < all.length - 1 ? `${s}；` : s))

/**
 * 同步状态行（03-02 §3.1 的同一行规则，DS-61）：还带着待同步计数的用警告色图标并写出条数，只读各因用中性图标——
 * drift「需要刷新 · 3 项未同步」（会话已关闭、3 项更改没送到服务器：风险同离线，警告色；没有未同步项时只写「需要刷新」、中性图标）；
 * ceiling「只读 · 文档已达元素上限」（同「只读 · 名额已满」，中性锁形，可聚焦看说明）。
 */
export const STATUS = {
  drift: <RailStatus icon={<RefreshCw {...SI} className="text-(--v3-warning)" />}>需要刷新 · 3 项未同步</RailStatus>,
  ceiling: (
    <RailStatus icon={<Lock {...SI} />} hint={CEILING_HINT}>
      只读 · 文档已达元素上限
    </RailStatus>
  ),
  ceilingHint: (
    <RailStatus icon={<Lock {...SI} />} hint={CEILING_HINT} hintOpen>
      只读 · 文档已达元素上限
    </RailStatus>
  ),
}

/**
 * 代码块漂移（50/02 §12 ①）：图表渲染器的惰性代码块重试一次仍失败，第 4 页的柱形图保持占位（底座 DegradedPlaceholder，与保真、缺插件占位同一画法，DS-52）；
 * 标题、正文与页脚照常。评论仍锚在原处（同一组钉：DeckSlide.pins）
 */
function TrendWithPlaceholder() {
  return (
    <>
      <SlideTitle>营收趋势</SlideTitle>
      <p className="absolute top-[16.2cqw] left-[7cqw] text-[2.6cqw] leading-[1.3] text-(--s-body)">
        6 月营收 <b className="font-semibold text-(--s-ink)">4,800 万元</b>，创年内新高；Q2 累计 <b className="font-semibold text-(--s-ink)">1.28 亿元</b>，同比 +18%
      </p>
      <DegradedPlaceholder icon={ChartColumn} title="柱形图「月度营收」" reason="刷新后显示，内容已保留" className="absolute top-[23cqw] left-[7cqw] h-[27cqw] w-[86cqw]" />
      <SlideFooter page={4} />
    </>
  )
}

export const CHUNK_DECK: DeckSlide[] = deckWith({ 4: { render: () => <TrendWithPlaceholder />, pins: DECK_PINS[4] } })
