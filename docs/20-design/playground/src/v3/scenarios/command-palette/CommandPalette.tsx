import { useRef } from "react"
import { CommandPalette, registerPaletteHost, useEditor, useRunCommand, useSceneState, type PaletteUi, type Platform } from "../../kit"
import { masterRailNewLayout } from "../masters-themes/MasterRail"
import { MV_KEYS, mvReasonOf, useMasterView, type MasterView } from "../masters-themes/mv-state"
import { useAppWiring, useRunApp } from "../shortcuts/nav"
import { COMMON_IDS, MASTER_COMMANDS, paletteCommands, reasonFor, type MasterCommand, type PaletteCommand } from "./commands"

/**
 * 命令面板（第 3 批 · g4；PRD ED-30，50/10 §10.1，设计 04 §4.2，06 §2.5，rulings §4.25 TB-106、DS-117）。
 * 面板本身（外观、组合框键盘、结果数量播报、先关面板再执行、不可用只播报原因）在第 3 批转正时并入底座 kit CommandPalette（2026-10-22，kitRequest g4 K6；画法逐像素相同），
 * 这里只剩本样张的部分：面板的界面状态（场景仓）、命令清单与可用判断（./commands）、执行方式（底座命令——键盘快捷键、偏好设置可带参数，shortcuts/nav.ts——/ 视图 / 工具 / 母版视图）。
 * 样张里接上了的命令：键盘快捷键、偏好设置…、阅读顺序…（打开偏好设置并把焦点放到「阅读顺序」，DS-116 第二入口）、插件…、版本历史、保真报告、分享…、导出…、单页 / 网格视图、文本框 / 形状库… / 评论（换工具）、
 * 母版视图（进入 / 退出，经宿主）；其余只关面板。
 * 2026-10-28（母版视图改版第一步；rulings §4.25 DS-161：命令面板在当前编辑器上原地打开）：宿主组件 CommandPaletteHost 在模块末尾登记为编辑器的缺省命令面板
 * （editor/palette-host.ts），每个有编辑器外壳的状态都挂一份——⌘K 与主菜单「帮助 › 命令面板…」原地打开，不再转到 command-palette.default；
 * 面板缺省收着（data.cOpen 缺省 false），command-palette 场景的状态显式写 cOpen: true。偏好设置、键盘快捷键这类要别的宿主的命令照旧按命令兜底转到演示样张。
 * 2026-10-30（母版视图改版第二步，50/10 §10.1）：母版视图里在「关闭母版视图」之后另列「母版」类命令（commands.ts MASTER_COMMANDS：插入版式、复制所选版式、新建母版、
 * 从模板导入母版…、插入占位符…、在普通视图查看引用页），可用与否和执行都走母版视图的同一套规则与动作（masters-themes 的 mv-state / MasterRail）；普通视图里一条都不列，「常用」不变
 */

/** 状态私有数据（EditorConfig.data） */
export interface PaletteData {
  /** 状态一出现面板就开着（缺省 false；command-palette 场景的状态写 true） */
  cOpen?: boolean
  /** 搜索框里已有的词 */
  cQuery?: string
  /** 键名写法（缺省 mac） */
  cPlatform?: Platform
  /** 集成方配置了帮助链接（缺省 true）：false 时面板里没有「帮助中心」（rulings §4.25 TB-132） */
  cHelpConfigured?: boolean
}

const KEY = "command-palette.ui"

function usePaletteUi(): [PaletteUi, (p: Partial<PaletteUi>) => void] {
  const { data } = useEditor()
  const d = data as PaletteData
  const [ui, set] = useSceneState<PaletteUi>(KEY, () => ({ open: d.cOpen ?? false, query: d.cQuery ?? "", active: 0, announce: "" }))
  return [ui, (p) => set((u) => ({ ...u, ...p }))]
}

/**
 * 母版视图里不可用的普通视图命令（与主菜单「视图」同一口径：网格与备注置灰写原因，03-26 §1.1；「评论」页签与工具在母版视图里不可用，03-26 §1）。
 * 「单页视图」：母版视图没有单页 / 网格之分（左栏顶部没有「单页 / 网格」，03-26 §1、§6.8），执行了也没有效果，同「网格视图」写「母版视图下不可用」（rulings §4.25 DS-172）。
 * 「版本历史」「保真报告」「插件…」「重置页…」：普通视图的入口，与主菜单、文档菜单同一可用性——留在原位、不可用、写「母版视图下不可用」（DS-157、TB-203）；
 * 母版视图里又被降权时也写这句：这张表排在 reasonFor 之前（TB-200）
 */
const IN_MASTER_REASON: Record<string, string> = {
  "view-single": "母版视图下不可用",
  "view-grid": "母版视图下不可用",
  notes: "母版视图下不显示",
  comment: "母版与版式不支持评论",
  history: "母版视图下不可用",
  fidelity: "母版视图下不可用",
  plugins: "母版视图下不可用",
  "reset-slide": "母版视图下不可用",
}

/**
 * 「幻灯片」一组（缩略图右键与左栏的命令：新建、复制、更换版式、隐藏、上移、下移，commands.ts）作用于幻灯片页：母版视图里左栏换成母版窗格，
 * 没有幻灯片缩略图与「新建幻灯片」（换成「新建版式」，03-26 §1、§3），这一组同写「母版视图下不可用」、↵ 只播报（rulings §4.25 DS-172）；
 * 母版视图里的 ⌘M / ⌘D 是「母版」类命令「插入版式」「复制所选版式」（DS-150，见 MASTER_COMMANDS）
 */
const IN_MASTER_SLIDE_CATEGORY = "幻灯片"

/**
 * 「母版」类命令（commands.ts MASTER_COMMANDS，2026-10-30 母版视图改版第二步，50/10 §10.1）的不可用原因：与母版视图里同一件事的入口同一条规则——
 * 插入版式、新建母版、从模板导入母版… 取「新建版式 ▾」一行的原因，复制所选版式再看菜单里「复制所选版式」那一项（MasterRail masterRailNewLayout）；
 * 插入占位符… 同工具条「占位符 ▾」与 P、在普通视图查看引用页同窗格右键（mv-state mvReasonOf；多选时页码取所选版式用量的并集，同右键菜单的多选形态）。不按状态写结果
 */
function masterCommandReason(cmd: MasterCommand, v: MasterView): string | undefined {
  const row = masterRailNewLayout(v)
  const rowReason = row ? row.reason : undefined
  switch (cmd) {
    case "insert-layout":
    case "new-master":
    case "import-master":
      return rowReason
    case "duplicate-layout": {
      const item = row ? row.menu?.find((e) => e.kind !== "separator" && e.value === "duplicate") : undefined
      return rowReason ?? (item && item.kind !== "separator" ? item.reason : undefined)
    }
    case "insert-placeholder":
      return v.reason("placeholder")
    case "view-pages":
      return mvReasonOf({ ...v, usage: pagesOf(v).pages }, "pages")
  }
}

/** 「在普通视图查看引用页」看哪些页：多选时取所选版式用量的并集（同窗格右键菜单的多选形态，MasterRail layoutMenuItems），否则是当前对象的用量 */
function pagesOf(v: MasterView): { ids: string[] | undefined; pages: number[] } {
  if (v.multiLayouts.length < 2) return { ids: undefined, pages: v.usage }
  const ids = v.multiLayouts.map((l) => l.id)
  return { ids, pages: [...new Set(ids.flatMap((id) => v.usageFor(id)))].sort((a, b) => a - b) }
}

/** 执行「母版」类命令（面板已关、焦点已交回之后）：与窗格、「新建版式 ▾」、工具条同一组动作；「新建母版」「从模板导入母版…」同菜单，样张不接 */
function runMasterCommand(cmd: MasterCommand, v: MasterView, setScene: (key: string, value: unknown) => void) {
  if (cmd === "insert-layout") v.insertLayout()
  else if (cmd === "duplicate-layout") v.duplicateLayout()
  else if (cmd === "view-pages") v.viewInNormal(pagesOf(v).ids)
  else if (cmd === "insert-placeholder") {
    // 同 P 键（MasterChrome MasterOverlay）：打开工具条「占位符 ▾」的菜单
    setScene(MV_KEYS.phTool, true)
    setScene(MV_KEYS.phMenu, true)
  }
}

/** 宿主：编辑器在每个有编辑器外壳的状态里挂一份（registerPaletteHost）；⌘K、主菜单「帮助 › 命令面板… ⌘K」打开 / 收起（底座命令 help.command-palette，kit useBaseKeys 接 ⌘K） */
export function CommandPaletteHost() {
  const [ui, set] = usePaletteUi()
  useAppWiring({ "help.command-palette": () => set(ui.open ? { open: false } : { open: true, query: "", active: 0 }) })
  const ed = useEditor()
  const runEditor = useRunCommand()
  const runApp = useRunApp()
  const platform = ((ed.data as PaletteData).cPlatform ?? "mac") as Platform
  const ctx = { mode: ed.mode, selection: String(ed.selection) }
  const mv = ed.masterView
  // 母版视图的事实与规则（「母版」类命令的可用性与执行用；普通视图里只读不写画面，DOM 不变）
  const mvFacts = useMasterView()
  const latest = useRef(mvFacts)
  latest.current = mvFacts
  // 母版视图里「母版视图」一条换成「关闭母版视图」（主菜单同一位置同一条命令，03-26 §1.1），其后接「母版」类命令（只在母版视图里列，50/10 §10.1）
  const commands = paletteCommands({ helpConfigured: (ed.data as PaletteData).cHelpConfigured !== false }).flatMap((c) =>
    c.id === "master" && mv.on ? [{ ...c, title: "关闭母版视图" }, ...MASTER_COMMANDS] : [c],
  )
  const common = COMMON_IDS.map((id) => commands.find((c) => c.id === id)).filter((c): c is PaletteCommand => !!c)
  /** 不可用的原因：母版视图一条取宿主的 entry（与主菜单、⌥⌘M 同一条原因；母版视图里恒为可用）；母版视图里另有几条普通视图命令不可用；其余照 commands.ts reasonFor */
  const reason = (c: PaletteCommand): string | undefined => {
    if (c.run?.kind === "master") return mv.on ? undefined : mv.entry.reason
    if (c.run?.kind === "master-cmd") return masterCommandReason(c.run.command, mvFacts)
    if (mv.on && IN_MASTER_REASON[c.id]) return IN_MASTER_REASON[c.id]
    if (mv.on && c.category === IN_MASTER_SLIDE_CATEGORY) return "母版视图下不可用"
    return reasonFor(c, ctx)
  }
  const run = (c: PaletteCommand) => {
    const r = c.run
    if (!r) return
    if (r.kind === "local") runApp(r.command, r.arg)
    else if (r.kind === "editor") runEditor(r.command)
    else if (r.kind === "view") ed.setView(r.view)
    else if (r.kind === "tool") ed.setTool(r.tool)
    else if (r.kind === "master") mv.toggle("palette")
    else if (r.kind === "master-cmd") runMasterCommand(r.command, latest.current, (k, v) => ed.scene.set(k, v))
  }
  return <CommandPalette ui={ui} set={set} commands={commands} common={common} reasonFor={reason} onRun={run} platform={platform} />
}

// 编辑器的缺省命令面板（每个有编辑器外壳的状态原地打开，rulings §4.25 DS-161）
registerPaletteHost(CommandPaletteHost)
