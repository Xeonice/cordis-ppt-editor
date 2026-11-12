import type { ComponentType } from "react"

/**
 * 宿主缺省命令面板的登记口（2026-10-28，母版视图改版第一步；rulings §4.25 DS-161：命令面板在当前编辑器上原地打开）：
 * 命令面板样张（scenarios/command-palette/CommandPalette.tsx）在导入时把它的宿主组件登记到这里，编辑器（Editor.tsx）在每个有编辑器外壳的状态里挂一份——
 * ⌘K 与主菜单「帮助 › 命令面板…」（底座命令 help.command-palette）由它原地接住，不再按命令兜底转到 command-palette.default；宿主见不到登记就不挂。
 * 仅演示、不迁移：产品的命令面板是 ui-react ui/shell/CommandPalette.tsx，编辑器里按 Mod+K 原地打开（50/10 §10.1）。
 */
let host: ComponentType | null = null

export function registerPaletteHost(c: ComponentType) {
  host = c
}

export function getPaletteHost(): ComponentType | null {
  return host
}
