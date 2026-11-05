import { useEditorCommand, useRunCommand } from "../../kit"

/**
 * 设置、快捷键面板、命令面板三个样张的接线（第 3 批 · g4）。2026-10-22 第 3 批转正后改用底座命令（kit/commands.ts 的 help.shortcuts / help.command-palette /
 * account.preferences，kitRequest g4 K1–K4）：主菜单「帮助」两项、账户菜单「偏好设置… / 键盘快捷键」、开始页帮助菜单与 ⌘/ ⌘, ⌘K（底座 useBaseKeys）都发它们；
 * 状态里挂着宿主的由宿主接住（useEditorCommand），没有时按三个场景的 provides 转到演示它的样张（编辑器与开始页各一个状态）——
 * 原来的模块级命令表（useLocalCommand / runLocal）、主菜单接线（WIRED_HELP）、⌘ 键监听（useAppKeys）与跳转（useGoTo，已并入 kit/nav.ts）都删了。
 * 这里只剩「带参数」的一小段：命令面板「阅读顺序…」打开偏好设置并把焦点放在「阅读顺序」上（rulings §4.25 DS-116），底座命令不带参数，
 * 发命令前把参数记在这里，处理函数在同一个任务里取走（没有宿主、转到演示样张时参数作废，同原来的做法）。
 */

export type AppCommand = "help.shortcuts" | "help.command-palette" | "account.preferences"
/** 命令的参数：偏好设置可以带一个落点（reading-order） */
export type AppHandler = (arg?: string) => void

let pendingArg: string | undefined

/** 宿主登记自己能打开的命令（给了的才登记；处理函数总取最新的一份） */
export function useAppWiring(own: Partial<Record<AppCommand, AppHandler>>) {
  const take = () => {
    const a = pendingArg
    pendingArg = undefined
    return a
  }
  const h = (id: AppCommand) => {
    const fn = own[id]
    return fn ? () => fn(take()) : undefined
  }
  useEditorCommand("help.shortcuts", h("help.shortcuts"))
  useEditorCommand("help.command-palette", h("help.command-palette"))
  useEditorCommand("account.preferences", h("account.preferences"))
}

/** 发命令（可带参数）：返回有没有处理函数或兜底接住 */
export function useRunApp(): (id: AppCommand, arg?: string) => boolean {
  const run = useRunCommand()
  return (id, arg) => {
    pendingArg = arg
    try {
      return run(id)
    } finally {
      pendingArg = undefined
    }
  }
}
