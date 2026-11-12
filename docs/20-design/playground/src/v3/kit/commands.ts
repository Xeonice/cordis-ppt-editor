import { useEffect, useRef } from "react"
import { useEditorMaybe } from "../editor/context"
import type { SceneStore } from "../editor/scene"
import { usePageMaybe } from "../page/context"

/**
 * 底座命令（第 2 批集成）：底座外框里的固定入口（文档菜单、主菜单、检查器顶行 / 网格胶囊的「分享」、评审条 / 浏览条的「上一处 / 下一处评论」）
 * 是静态配置，拿不到场景状态；选了 / 点了之后发一个命令，由场景登记的处理函数接住。取代原来各场景在 document 上听点按、发自定义 DOM 事件的局部做法。
 *
 *   doc.rename · doc.copy · doc.history     文档菜单（文件名 ▾）的「重命名」「创建副本」「版本历史」
 *   file.export · file.fidelity             主菜单「文件 › 导出…」「文件 › 保真报告」
 *   plugins                                 主菜单「插件…」
 *   share                                   检查器顶行与网格右上胶囊的「分享」
 *   comment.prev · comment.next             评审条 / 浏览条的「上一处 / 下一处评论」（CommentNav 没有直接传 onPrev / onNext 时）
 *   home                                    主菜单「返回首页」：有处理函数接住时不跳转（如有未同步更改时先弹「离开将丢失…」确认，03-12 离开保护），没有时照旧回首页
 * 第 3 批转正（2026-10-22，kitRequests g2 K2、g3 K10、g4 K1–K4、g6 K2）补的：
 *   account.preferences                     账户菜单「偏好设置… ⌘,」与 ⌘,（编辑器与应用壳页面都接）
 *   account.logout                          账户菜单「退出登录」（有未同步更改时先确认的场景接住；应用壳页面没有人接时转到登录页 shell-pages.login）
 *   help.shortcuts                          主菜单「帮助 › 键盘快捷键 ⌘/」、账户菜单同一项与 ⌘/
 *   help.command-palette                    主菜单「帮助 › 命令面板… ⌘K」与编辑器里的 ⌘K（应用壳页面的 ⌘K 是聚焦搜索框，不发它）
 *   present · present.fromStart             三处「放映」按钮与 ⇧F5（从当前页）· F5（从头）；放映中由放映场景自己吞 F5（DS-108）
 * 文件 › 导出… 的 ⇧⌘E（DS-78）也由底座发 file.export（导出不可用时——查看者、评审者、编辑中被降权，DS-105——不发）。
 *
 * 场景在任意常驻组件里登记（挂载期间有效，换场景状态即全部清空；同一命令可以有几处登记，按登记顺序都执行）：
 *   useEditorCommand("doc.history", () => setOpen(true))
 * 没有登记的命令：有场景声明演示它（defineScenario 的 provides，如版本历史场景 provides { "doc.history": "default" }）时，
 * 编辑器转到那个场景的演示状态（Editor.tsx 经 setCommandFallback 接上，不静默无响应，ED-30）；没有声明的照旧：菜单只关闭、按钮没有动作。
 * 主菜单的 onPlugins / onExport / onFidelity 显式传了时以传入的为准。
 */
export type EditorCommand =
  | "doc.rename"
  | "doc.copy"
  | "doc.history"
  | "file.export"
  | "file.fidelity"
  | "plugins"
  | "share"
  | "comment.prev"
  | "comment.next"
  | "home"
  | "account.preferences"
  | "account.logout"
  | "help.shortcuts"
  | "help.command-palette"
  | "present"
  | "present.fromStart"

/**
 * 命令在底座外框里的固定入口（锚点名，单页与网格同名）：命令兜底转到演示它的场景时随之带过去（kit/layer carryInteraction），
 * 新状态里随之打开的面板关闭后焦点交回同一个入口（arrivedVia），不交给画布——触发它的那颗按钮在新状态里还是同一个位置
 */
export const COMMAND_ENTRY: Partial<Record<EditorCommand, string>> = {
  "doc.rename": "doc-menu",
  "doc.copy": "doc-menu",
  "doc.history": "doc-menu",
  "file.export": "main-menu",
  "file.fidelity": "main-menu",
  plugins: "main-menu",
  home: "main-menu",
  share: "share",
  "account.preferences": "account",
  "account.logout": "account",
  "help.shortcuts": "main-menu",
  "help.command-palette": "main-menu",
  present: "present",
  "present.fromStart": "present",
}

/** 每次编辑器挂载一个场景仓（换状态即换仓），命令表挂在仓上，随仓一起丢弃 */
const REGISTRY = new WeakMap<SceneStore, Map<EditorCommand, Set<() => void>>>()
/** 没有处理函数时的兜底（编辑器挂载时登记一次）：返回有没有接住 */
const FALLBACK = new WeakMap<SceneStore, (id: EditorCommand) => boolean>()

/** 命令前置钩子（编辑器挂载时登记一次）：在处理函数或兜底之前同步调用 */
const BEFORE = new WeakMap<SceneStore, (id: EditorCommand) => void>()

/** 编辑器（Editor.tsx）登记兜底：当前状态里没有场景接住某个命令时调它（如转到声明 provides 的场景） */
export function setCommandFallback(store: SceneStore, fn: (id: EditorCommand) => boolean) {
  FALLBACK.set(store, fn)
}

/**
 * 编辑器（Editor.tsx）登记命令前置钩子（2026-10-28，母版视图改版第一步；退出母版视图的自动情形见前端 50/11 §2「退出」）：每个命令在查处理函数、调兜底之前先经过它——
 * 母版视图里发 present / present.fromStart 时先退出母版视图、恢复位置，场景自己接住放映与转到 present.default 两种情况都覆盖
 */
export function setCommandBefore(store: SceneStore, fn: (id: EditorCommand) => void) {
  BEFORE.set(store, fn)
}

function tableOf(store: SceneStore) {
  let t = REGISTRY.get(store)
  if (!t) REGISTRY.set(store, (t = new Map()))
  return t
}

/** 命令表挂在哪个场景仓上：编辑器的，或页面宿主（第 3 批应用壳、整屏页）的——第 3 批转正起页面宿主也能登记与发命令 */
function useCommandStore(): SceneStore | undefined {
  const editor = useEditorMaybe()
  const page = usePageMaybe()
  return editor?.scene ?? page?.scene
}

/** 登记一个命令的处理函数（handler 为空 / false 时不登记，可按条件接管）。处理函数总取最新的一份，不必 useCallback。 */
export function useEditorCommand(id: EditorCommand, handler: (() => void) | null | undefined | false) {
  const store = useCommandStore()
  const ref = useRef(handler)
  ref.current = handler
  const on = !!handler
  useEffect(() => {
    if (!store || !on) return
    const fn = () => {
      const h = ref.current
      if (h) h()
    }
    const t = tableOf(store)
    let set = t.get(id)
    if (!set) t.set(id, (set = new Set()))
    set.add(fn)
    return () => {
      set.delete(fn)
    }
  }, [store, id, on])
}

/** 发命令：返回有没有处理函数（或兜底）接住（底座据此决定要不要做缺省动作，如「返回首页」没人接住才跳转）。 */
export function runEditorCommand(store: SceneStore | null | undefined, id: EditorCommand): boolean {
  if (!store) return false
  BEFORE.get(store)?.(id)
  const set = REGISTRY.get(store)?.get(id)
  if (!set?.size) return FALLBACK.get(store)?.(id) ?? false
  for (const fn of [...set]) fn()
  return true
}

/** 底座组件里拿到发命令的函数（不在编辑器或页面宿主里时是空操作）。 */
export function useRunCommand(): (id: EditorCommand) => boolean {
  const store = useCommandStore()
  return (id) => runEditorCommand(store, id)
}

/**
 * 底座键位（第 3 批转正，kitRequests g2 K2、g3 K10、g4 K3 / K4）：按 KeyboardEvent.code 判（不依赖键位字符，ED-16），跳过输入法组合；
 * 挂在 window 的冒泡阶段（晚于场景挂在 document 上的全部监听，与挂载先后无关），且场景自己没有先处理（defaultPrevented）时才发命令——
 * 场景里已有的同一键位接线（如放映中的 F5、快捷键面板里的 ⌘/、导出样张的 ⇧⌘E）先于底座。
 * 命令有人接住（处理函数或转到演示它的样张）才 preventDefault（没人接时浏览器照旧）。
 *   ⌘/ help.shortcuts · ⌘, account.preferences（编辑器与应用壳页面）· ⌘K help.command-palette（只在编辑器：应用壳页面的 ⌘K 是聚焦搜索框）·
 *   ⇧⌘E file.export（只在编辑器、且导出可用：exportOff 为假）· F5 present.fromStart · ⇧F5 present（只在编辑器）
 * 文本编辑态（输入框、可编辑区域）里 ⌘/ ⌘, ⌘K ⇧⌘E 照常放行（50/10 §10.1：这几个键在文本里没有别的含义），F5 / ⇧F5 只在焦点不在输入框里时接。
 */
export function useBaseKeys({ editor, exportOff }: { editor: boolean; exportOff?: boolean }) {
  const run = useRunCommand()
  const ref = useRef({ run, editor, exportOff })
  ref.current = { run, editor, exportOff }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.altKey) return
      const k = ref.current
      const mod = e.metaKey || e.ctrlKey
      let id: EditorCommand | null = null
      if (mod && !e.shiftKey && e.code === "Slash") id = "help.shortcuts"
      else if (mod && !e.shiftKey && e.code === "Comma") id = "account.preferences"
      else if (k.editor && mod && !e.shiftKey && e.code === "KeyK") id = "help.command-palette"
      else if (k.editor && mod && e.shiftKey && e.code === "KeyE") id = k.exportOff ? null : "file.export"
      else if (k.editor && !mod && e.code === "F5") {
        const t = e.target instanceof HTMLElement ? e.target : null
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
        id = e.shiftKey ? "present" : "present.fromStart"
      }
      if (!id) return
      if (k.run(id)) e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
}
