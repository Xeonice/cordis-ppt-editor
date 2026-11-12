import { DegradedDetailButton, Phrases, Section, StaticRow, type DegradedInfo } from "../../kit"
import { useOpenReport } from "./store"

/**
 * 选中「无法显示的对象」时的检查器内容（selectionKind = degraded）：分区是底座的一份（editor/inspector/degraded.tsx，第 2 批集成与缺插件元素统一），
 * 这里只给第 7 页瀑布图（chartex）的内容——对象说明（与第 1 批图表「此类型仅支持查看」同一画法：中性 Info 图标 + 标题 + 一句原因与「已原样保留，
 * 导出后可在 PowerPoint 查看」+「保真详情」；rulings §4.25 DS-52 改写，不再写「可以移动、缩放、复制和删除，不能编辑内部」）· 位置与大小（无旋转、无翻转）· 替代文本。
 * 「保真详情」打开保真报告并定位到这个对象（50/25 §2.2）。替代文本：chartex 属 AlternateContent 系，只读并注明在 PowerPoint 中修改。
 * 示例只有第 7 页的瀑布图能被选中；其余降级种类（SmartArt 无预览、OLE 无预览、未知对象…）同一套分区，只换类型名与说明。
 */

/**
 * 「保真详情」：打开保真报告并定位到瀑布图。底座 DegradedDetailButton：与第 1 批图表「保真详情」同一颗（次按钮 + 14px 外链图标，DS-52「同一画法」），与缺插件占位的「查看详情」也是同一颗。
 * 锚点 fidelity.detail：报告关闭、检查器换回这一节后，焦点回到这颗按钮（03-10 §2 关闭后焦点精确归还触发元素）
 */
function FidelityDetailsButton() {
  const openReport = useOpenReport()
  return (
    <DegradedDetailButton data-v3-anchor="fidelity.detail" onClick={() => openReport({ locate: { id: "chartex", i: 0 }, from: "fidelity.detail" })}>
      保真详情
    </DegradedDetailButton>
  )
}

function AltSection() {
  return (
    <Section title="替代文本" anchor="section-fidelity.degraded-alt" bodyClassName="gap-1">
      <StaticRow label="描述">Q2 成本构成：人力、云资源、营销与其他四项</StaticRow>
      <p className="text-[12px] leading-[18px] text-(--v3-text-2)">
        <Phrases parts={["此类对象的替代文本", "需在 PowerPoint 中修改"]} />
      </p>
    </Section>
  )
}

/** 第 7 页瀑布图（960 × 540 pt 坐标里的位置与大小与 data.ts CHARTEX_BOX、画布尺寸角标同一组数）；场景级 data.degraded */
export const CHARTEX_DEGRADED: DegradedInfo = {
  // 标题与缺插件占位同一写法：「〈类型〉（占位）」
  title: "新式图表（占位）",
  about: {
    heading: "此元素当前无法显示",
    // 一句：原因 + 已原样保留 / 导出后可看（DS-52 改写）；能移动、缩放、删除由画布上的 8 个手柄与右键菜单表达，不再写在这里
    text: <Phrases parts={["瀑布图等 Office 2016 新图表", "暂不支持显示，", "已原样保留，", "导出后可在 PowerPoint 查看。"]} />,
    action: <FidelityDetailsButton />,
  },
  geometry: { x: "442", y: "163", w: "451", h: "298" },
  sections: <AltSection />,
}
