import { CheckRow, MenuField, Section, type InspectorSectionDef } from "../../kit"

/**
 * DS-116 未采纳的备选（settings.alt-reading-order-inspector）：检查器无选中态「放映」节下加一行「阅读顺序」。
 * 只在这个状态里用（inspector.sections 直接写分区定义，状态私有，不注册进全局的分区表）：「放映」节的前两行与底座 slide.playback 的编辑态同一画法
 * （切换：M1–M3 不可编辑、留在原位写原因；放映时跳过此页），第三行是阅读顺序（选择触发器外框，同「切换」一行）。
 */
function PlaybackWithReadingOrder() {
  return (
    <Section title="放映" anchor="section-slide.playback">
      <MenuField
        aria="切换效果"
        items={["无", "淡化", "推入", "擦除"]}
        defaultValue="无"
        leading={<span className="shrink-0 text-[12px] leading-none text-(--v3-text-3)">切换</span>}
        disabled
        reason="切换效果已原样保留，M1–M3 暂不可编辑"
        anchor="slide-transition"
      />
      <CheckRow label="放映时跳过此页" defaultChecked={false} />
      <MenuField
        aria="阅读顺序"
        items={["按叠放次序", "按占位符次序"]}
        defaultValue="按叠放次序"
        leading={<span className="shrink-0 text-[12px] leading-none text-(--v3-text-2)">阅读顺序</span>}
        anchor="settings.inspector-reading-order"
      />
    </Section>
  )
}

export const PLAYBACK_WITH_ORDER: InspectorSectionDef = { id: "settings.playback-reading-order", kinds: ["none"], order: 40, component: PlaybackWithReadingOrder }
