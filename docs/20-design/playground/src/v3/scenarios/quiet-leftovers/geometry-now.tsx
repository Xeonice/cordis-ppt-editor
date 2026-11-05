import { useState } from "react"
import { FlipHorizontal2, FlipVertical2, Link2 } from "lucide-react"
import { Cols, ICON, IconButton, LENGTH_UNIT, NumberField, Section, ToggleStrip, type InspectorCtx, type InspectorSectionDef } from "../../kit"

/**
 * DS-136 未采纳的「现画法」（lock-ratio-now）：第 1 批原来的「位置与大小」（状态私有的分区变体，inspector.sections 换掉 shape.geometry）——
 * 字段网格与底座 GeometrySection 完全相同（X / Y ┊ W / H + 锁定比例 ┊ 旋转 + 翻转，同一组值：要点卡 629, 232 · 264 × 176 · 0°），只是锁定比例两种状态都是同一个相连的链（Link2），
 * 只靠按下态（只铺淡底、图标描边 2，--v3-on-*，DS-35）区分；点按在两者之间切换。
 * 底座（editor/inspector/geometry.tsx）第 3 批转正时已按 DS-136 改成未锁 = 断开的链（Unlink2），所以 lock-ratio-after 不再需要局部件，这里反过来留一份原画法给未采纳的对照
 * （2026-10-22 由 geometry-after.tsx 改名、改成原画法）。
 */
function GeometryNow({ readOnly }: InspectorCtx) {
  const [locked, setLocked] = useState(false)
  if (readOnly) return null
  const field = (k: "x" | "y" | "w" | "h", label: string, value: string, aria: string) => <NumberField key={k} label={label} defaultValue={value} unit={LENGTH_UNIT} aria={aria} />
  return (
    <Section title="位置与大小" anchor="section-shape.geometry">
      <Cols>
        {field("x", "X", "629", "X 坐标")}
        {field("y", "Y", "232", "Y 坐标")}
      </Cols>
      <div className="grid grid-cols-[1fr_1fr_28px] gap-2">
        {field("w", "W", "264", "宽度")}
        {field("h", "H", "176", "高度")}
        <IconButton label="锁定比例" variant={locked ? "on" : "ghost"} pressed={locked} onClick={() => setLocked((v) => !v)}>
          <Link2 {...ICON} />
        </IconButton>
      </div>
      <Cols>
        <NumberField label="旋转" defaultValue="0" unit="°" aria="旋转角度" />
        <ToggleStrip
          aria="翻转"
          defaultOn={[]}
          options={[
            { value: "h", label: "水平翻转", icon: <FlipHorizontal2 {...ICON} /> },
            { value: "v", label: "垂直翻转", icon: <FlipVertical2 {...ICON} /> },
          ]}
        />
      </Cols>
    </Section>
  )
}

export const GEOMETRY_NOW: InspectorSectionDef = { id: "quiet-leftovers.geometry-now", kinds: ["shape"], order: 10, component: GeometryNow }
