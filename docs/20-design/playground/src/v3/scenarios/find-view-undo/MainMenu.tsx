import { editItems as kitEditItems, gridGuideSub, MainMenuLayer as KitMainMenuLayer, PASTE_VARIANTS, ZOOM_COMMANDS, type GridGuidePrefs, type MenuSpec } from "../../kit"
import type { ReactNode } from "react"
import { useDisplay, type DisplayPrefs } from "./display"

/**
 * 主菜单的「编辑」「视图」两个子菜单（40/10 §2.6 的子项排列在这里定稿，第 1 批随 rulings §4.25 DS-21 拍板；DS-1：创建在工具条、格式在检查器，其余命令进菜单）。
 * 主菜单本身是统一的一份（kit/mainMenu.tsx：返回首页 · 文件 ▸ · 编辑 ▸ · 视图 ▸ · 插入 ▸ · 排列 ▸ · 帮助 ▸，底座 MainMenu 与各场景共用），
 * 「编辑」的条目（kit editItems）、缩放命令（kit ZOOM_COMMANDS）与粘贴变体（kit PASTE_VARIANTS）也由这里定稿后并入 kit；
 * 「视图 › 网格与参考线 ▸」与「缩放 ▸」也在统一条目里；本目录只把网格与参考线接到 useDisplay（画布上真的显示 / 隐藏）。
 * 快捷键提示以 PRD ED-16 为准：撤销 ⌘Z、重做 ⇧⌘Z（另有 ⌘Y）、查找 ⌘F、替换 ⇧⌘H（DS-16）、适应窗口 ⌘0、100% ⌘1、母版视图 ⌥⌘M。
 */

export { PASTE_VARIANTS, ZOOM_COMMANDS }

export interface EditMenuOptions {
  /** 下一步撤销的步骤名（取命令 ui.command 的标题）；undefined = 没有可撤销的步骤 */
  undo?: string
  /** 下一步重做的步骤名；undefined = 没有可重做的步骤 */
  redo?: string
  /** 有选中对象（剪切、复制、原位复制、删除可用） */
  hasSelection?: boolean
}

/** 主菜单「编辑」：撤销 / 重做（带步骤名，没有可撤销 / 重做时置灰并写原因）· 剪贴板 · 全选 · 查找 / 替换 · 重置页。 */
export const editItems = ({ undo, redo, hasSelection = true }: EditMenuOptions): MenuSpec[] => kitEditItems({ undo: undo ?? null, redo: redo ?? null, hasSelection })

/** 「网格与参考线 ▸」（kit gridGuideSub，主菜单「视图」与画布空白处右键共用一张清单），读写 useDisplay 的值（d 与 set 由调用方的 useDisplay() 给）。 */
export function gridGuidesMenu(d: DisplayPrefs, set: (patch: Partial<DisplayPrefs>) => void, icon?: ReactNode): MenuSpec {
  return gridGuideSub(d, (patch: Partial<GridGuidePrefs>) => set(patch as Partial<DisplayPrefs>), icon)
}

export interface ViewMenuOptions {
  /** 母版视图不可用的原因（评审模式 / 无编辑权限 / 视口 < 1024，explainWhen）；undefined = 可用 */
  masterReason?: string
}

/**
 * 打开的主菜单（放 layers）：kit MainMenuLayer（锚在左栏左上的主菜单按钮下方、左对齐，与底座 MainMenu 同位置同条目），
 * 「编辑」带步骤名，「视图 › 网格与参考线 ▸」读写 useDisplay（03-20）。原「视图」页签的「缩略图侧栏」开关在 v3 取消：
 * 左栏承载主菜单、文件名与同步状态，不能整栏隐藏；要更大的画布用网格视图，或拖左栏右缘的分隔条把它收窄（160–420，见 view-zoom.panel-size）。
 */
export function MainMenuLayer({ openPath, edit = {}, view = {} }: { openPath?: string[]; edit?: EditMenuOptions; view?: ViewMenuOptions }) {
  const [d, setD] = useDisplay()
  return (
    <KitMainMenuLayer
      openPath={openPath}
      edit={editItems(edit)}
      gridGuides={{ prefs: d, onChange: (patch) => setD(patch as Partial<DisplayPrefs>) }}
      master={view.masterReason ? { reason: view.masterReason } : undefined}
    />
  )
}
