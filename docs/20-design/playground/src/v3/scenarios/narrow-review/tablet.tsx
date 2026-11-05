import { TabletViewer as BaseTabletViewer, type TabletLayout } from "../comments/phone"

/**
 * 平板（触控、≥ 640）仅查看形态里的只读评论面板（rulings §4.25 DS-46、DS-131、TB-49，PRD NF-07）。
 * 2026-10-22 第 3 批转正第一段：实现并入 comments/phone.tsx 的 TabletViewer（PhoneCommentsSheet 加了 layout：sheet / stacked / sidebar，原来这里的后代选择器覆盖随之删去；
 * 第 2 批 comments.tablet 改用 stacked，DS-131），画法逐像素相同。这里只保留本场景自己的面板开关键与「评论」按钮锚点（与改前相同），转出原名、引用处不变。
 */
export type { TabletLayout }

export function TabletViewer({ layout }: { layout: TabletLayout }) {
  return <BaseTabletViewer layout={layout} sheetKey="narrow-review.sheet" trigger="narrow-review.sheet-trigger" />
}
