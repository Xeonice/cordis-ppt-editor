import { useCallback } from "react"
import { GRID_GUIDE_DEFAULT, Guide, SlideGrid, useEditor, useSceneState, type GridGuidePrefs } from "../../kit"

/**
 * 03-20「显示」三项偏好：网格、参考线、智能参考线。都是呈现偏好（Operation，不入撤销历史），按客户端偏好记忆（ui.setPreference）。
 * 主菜单「视图」与画布空白处右键「网格与参考线 ▸」读写同一份状态；画布上的网格与参考线由 DisplayOverlay 画出。
 */
export interface DisplayPrefs {
  grid: boolean
  guides: boolean
  smartGuides: boolean
  /** 网格间距（pt，三档 6 / 12 / 18，rulings §4.25 DS-27）：主菜单与右键「网格与参考线 ▸ › 网格间距」改它，画布上的网格线距跟着变 */
  spacing: GridGuidePrefs["spacing"]
}

/** 缺省：网格关、参考线开（文件里有参考线时才看得到）、智能参考线开，网格间距 12 pt（与 kit GRID_GUIDE_DEFAULT 同一份缺省）。 */
export const DISPLAY_DEFAULT: DisplayPrefs = { grid: false, guides: true, smartGuides: true, spacing: GRID_GUIDE_DEFAULT.spacing }

/**
 * 显示偏好的场景共享状态（kit useSceneState：主菜单、右键菜单与画布读写同一份，换状态即复位）；各状态的初值写在 data.display（缺省 DISPLAY_DEFAULT）。
 * 返回 [当前值, 局部更新]。
 */
export function useDisplay(): [DisplayPrefs, (patch: Partial<DisplayPrefs>) => void] {
  const { data } = useEditor()
  const [d, set] = useSceneState<DisplayPrefs>("find-view-undo.display", () => ({ ...DISPLAY_DEFAULT, ...(data.display as Partial<DisplayPrefs> | undefined) }))
  const patch = useCallback((p: Partial<DisplayPrefs>) => set((cur) => ({ ...cur, ...p })), [set])
  return [d, patch]
}

/** 示例文档存着的参考线（pptx p:guideLst）：左右版心 7% / 93%，标题顶 11.4%，正文顶 33.8%（与各页内容的对齐线一致）。 */
const FILE_GUIDES: { orientation: "h" | "v"; at: number }[] = [
  { orientation: "v", at: 7 },
  { orientation: "v", at: 93 },
  { orientation: "h", at: 11.38 },
  { orientation: "h", at: 33.78 },
]

/**
 * 画在当前页上的网格与参考线（放 slideOverlay，函数形式）：随 useDisplay 的开关。
 * 参考线用 1px 强调色虚线（智能参考线拖动时是实线，见 03-17）；网格用 kit SlideGrid（03-20 §5：线距等于网格间距、中性细线、每 4 格加深一档，
 * 与 selection.grid-visible 同一画法），间距读 useDisplay 的 spacing。
 */
export function DisplayOverlay() {
  const [d] = useDisplay()
  return (
    <>
      {d.grid && <SlideGrid spacing={Number(d.spacing)} />}
      {d.guides && FILE_GUIDES.map((g) => <Guide key={`${g.orientation}${g.at}`} orientation={g.orientation} at={g.at} dashed />)}
    </>
  )
}
