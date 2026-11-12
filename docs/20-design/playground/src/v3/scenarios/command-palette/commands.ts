import {
  ArrowDown, ArrowUp, ArrowUpRight, Blocks, BringToFront, ChartColumn, ChevronDown, ChevronUp, Clipboard, Copy, CopyPlus, Database, Download, EyeOff, FileCheck, Group, History,
  Image as ImageIcon, Import, Keyboard, LayoutGrid, LayoutTemplate, LifeBuoy, Link2, ListOrdered, MessageSquare, PanelBottom, PanelsTopLeft, PenLine, Play, Plus, Ratio,
  RectangleHorizontal, Redo2, RefreshCw, Replace, RotateCcw, ScanSearch, Scissors, Search, SendToBack, Settings2, Shapes, Shuffle, SquareDashed, SquarePlus, StickyNote, Table, Trash2, Type,
  Undo2, Ungroup, Unlink, Vote, ZoomIn, ZoomOut, Maximize, Percent, type LucideIcon,
} from "lucide-react"

/**
 * 命令面板的内容（第 3 批 · g4；PRD ED-30，前端 50/10 §10.1，设计 06 §2.5，rulings §4.25 TB-106）。
 * 列出本会话全部已注册、有 ui.command 呈现元数据且 when 为真的命令（含插件命令与内置导航命令）：每条 = 图标 16 · 标题 · 分类 · 快捷键；
 * 第三方插件的命令标题下另起一行「来自「插件名」」；不可用的（enablement 为假或能力位未授予）留在原位置灰，右侧写原因（代替分类与快捷键，同菜单规则 09 §3.4 第 4 条）。
 * 标题与菜单、快捷键面板里的命令名同一份（rulings §4.25 TB-116：缩放是主菜单「视图 › 缩放」的「适应窗口 ⌘0」「100% ⌘1」，本表补上「100%」）；分类沿用主菜单的顶层名（文件 · 编辑 · 视图 · 插入 · 排列），菜单之外的按入口取（文档菜单「文档」、缩略图「幻灯片」、
 * 「放映」、账户菜单「账户」、「帮助」），阅读顺序是「无障碍」（DS-116）。插件命令的分类由插件给。键位用快捷键面板同一种写法（shortcuts/keys.ts，TB-106）。
 * 本会话的插件与第 2 批 plugins 场景同一份部署（plugins/data.ts）：聚焦搜索（内置插件，ui.command ×1）、数据图表增强（ACME，core.command ×3）、
 * 现场投票（Beta Labs，core.command ×2）；字数统计缺省关，不出现。
 * 壳意图（导出…、版本历史、保真报告、插件…、帮助中心）怎样进命令面板（rulings §4.25 TB-162，同 TB-149 的做法）：shell-glue 为要进命令面板的意图各注册一个无参 Operation
 * （如 shell.openExport、shell.openVersionHistory、shell.openFidelityReport、shell.openPluginManager、shell.openHelpCenter），各配一条 ui.command——
 * 面板里看到的就是这几条普通命令（标题、分类、快捷键同主菜单）；样张的 run 只是模拟它们打开的界面（底座命令 file.export / doc.history / file.fidelity / plugins）。
 * 「帮助中心」按 TB-132（与 DS-89 同一规则）只在集成方配置了帮助链接时注册：配置了才列进面板（paletteCommands 的 helpConfigured，缺省 true = 本样张的部署配置了），
 * 新标签页打开、标题后带外链图标（PaletteItem external）。
 */

/** 命令执行时要做的事（样张里接上了的；其余只关面板） */
export type PaletteRun =
  | { kind: "local"; command: "help.shortcuts" | "account.preferences"; arg?: string }
  | { kind: "editor"; command: "plugins" | "doc.history" | "file.fidelity" | "file.export" | "share" }
  | { kind: "view"; view: "single" | "grid" }
  | { kind: "tool"; tool: "text" | "shapes" | "comment" }
  /** 进入 / 退出母版视图（宿主的全局模式，2026-10-28 母版视图改版第一步：EditorCtx.masterView.toggle("palette")；可用性取宿主的 entry，见 CommandPalette.tsx） */
  | { kind: "master" }
  /** 母版视图里的「母版」类命令（2026-10-30 母版视图改版第二步，见 MASTER_COMMANDS；执行与可用性在 CommandPalette.tsx） */
  | { kind: "master-cmd"; command: MasterCommand }

/** 「母版」类命令做什么（MASTER_COMMANDS 的 run） */
export type MasterCommand = "insert-layout" | "duplicate-layout" | "new-master" | "import-master" | "insert-placeholder" | "view-pages"

/** 不可用的判断依据（按当前状态算） */
export type Need =
  /** 改文档：评审「评审模式下不可用」、只读浏览「只有查看权限」 */
  | "edit"
  /** 要选中对象（「未选中对象」） */
  | "selection"
  /** 要选中 2 个以上对象 */
  | "multi"
  /** 要选中组合 */
  | "group"
  /** 要选中图表 */
  | "chart"
  /** 要选中投票 */
  | "poll"
  /** 里程碑未到（P2、M3）：标记写在标题后 */
  | "later"

export interface PaletteCommand {
  id: string
  title: string
  icon: LucideIcon
  category: string
  /** 和弦（shortcuts/keys.ts 的记法），第一项是主写法 */
  keys?: string[]
  keysWin?: string[]
  /** 搜索时额外命中的词 */
  keywords?: string[]
  /** 第三方插件：标题下一行「来自「插件名」」（内置插件不写） */
  from?: string
  /** 可用的前提（缺省总可用） */
  needs?: Need[]
  /** 里程碑小标记（P2 / M3），与 needs: ["later"] 一起用 */
  tag?: string
  /** 外链（新标签页打开，标题后外链图标；只在集成方配置了链接时列出，TB-132） */
  external?: boolean
  run?: PaletteRun
}

const EDIT: Need[] = ["edit"]

/** 全部命令（按主菜单的顺序：文件 · 文档 · 编辑 · 视图 · 插入 · 排列 · 幻灯片 · 放映 · 插件 · 帮助 · 账户 · 无障碍，插件命令在后） */
export const COMMANDS: PaletteCommand[] = [
  // 文件（主菜单「文件」，FILE_ITEMS）
  { id: "export", title: "导出…", icon: Download, category: "文件", keys: ["Shift+Mod+E"], keywords: ["下载", "pptx", "pdf", "png", "svg"], run: { kind: "editor", command: "file.export" } },
  { id: "fidelity", title: "保真报告", icon: FileCheck, category: "文件", keywords: ["保真", "差异", "导入"], run: { kind: "editor", command: "file.fidelity" } },
  { id: "slide-size", title: "幻灯片大小…", icon: Ratio, category: "文件", keywords: ["尺寸", "16:9", "4:3"], needs: ["later"], tag: "P2" },
  // 文档（文件名 ▾ 文档菜单）
  { id: "rename", title: "重命名", icon: PenLine, category: "文档", keywords: ["文件名", "标题"], needs: EDIT },
  { id: "copy-doc", title: "创建副本", icon: Copy, category: "文档", keywords: ["复制文档", "副本"] },
  { id: "history", title: "版本历史", icon: History, category: "文档", keywords: ["版本", "恢复", "历史"], run: { kind: "editor", command: "doc.history" } },
  { id: "share", title: "分享…", icon: Link2, category: "文档", keywords: ["权限", "链接", "邀请"], run: { kind: "editor", command: "share" } },
  // 编辑
  { id: "undo", title: "撤销", icon: Undo2, category: "编辑", keys: ["Mod+Z"], needs: EDIT },
  { id: "redo", title: "重做", icon: Redo2, category: "编辑", keys: ["Shift+Mod+Z", "Mod+Y"], needs: EDIT },
  { id: "cut", title: "剪切", icon: Scissors, category: "编辑", keys: ["Mod+X"], needs: ["edit", "selection"] },
  { id: "copy", title: "复制", icon: Copy, category: "编辑", keys: ["Mod+C"], needs: ["selection"] },
  { id: "paste", title: "粘贴", icon: Clipboard, category: "编辑", keys: ["Mod+V"], needs: EDIT },
  { id: "duplicate", title: "原位复制", icon: CopyPlus, category: "编辑", keys: ["Mod+D"], needs: ["edit", "selection"] },
  { id: "delete", title: "删除", icon: Trash2, category: "编辑", keys: ["Backspace"], keysWin: ["Delete", "Backspace"], needs: ["edit", "selection"] },
  { id: "find", title: "查找…", icon: Search, category: "编辑", keys: ["Mod+F"], keywords: ["搜索"] },
  { id: "replace", title: "替换…", icon: Replace, category: "编辑", keys: ["Shift+Mod+H"], keysWin: ["Ctrl+H"], needs: EDIT },
  { id: "reset-slide", title: "重置页…", icon: RotateCcw, category: "编辑", keywords: ["版式", "恢复"], needs: EDIT },
  // 视图
  { id: "view-single", title: "单页视图", icon: RectangleHorizontal, category: "视图", keywords: ["视图"], run: { kind: "view", view: "single" } },
  { id: "view-grid", title: "网格视图", icon: LayoutGrid, category: "视图", keywords: ["视图", "全部幻灯片"], run: { kind: "view", view: "grid" } },
  { id: "notes", title: "备注", icon: StickyNote, category: "视图", keywords: ["演讲者备注"] },
  { id: "zoom-in", title: "放大", icon: ZoomIn, category: "视图", keys: ["Mod+Plus"], keywords: ["缩放"] },
  { id: "zoom-out", title: "缩小", icon: ZoomOut, category: "视图", keys: ["Mod+Minus"], keywords: ["缩放"] },
  { id: "zoom-fit", title: "适应窗口", icon: Maximize, category: "视图", keys: ["Mod+0"], keywords: ["缩放", "适应"] },
  // 「适应窗口」「100%」各一条无参命令（rulings §4.25 TB-149：slide-ui 另注册 slide.zoomToFit、slide.zoomTo100，只转调 slide.setZoom；快捷键表改绑这两个）
  // 「100%」（页面实际尺寸，03-20 §4）：主菜单「视图 › 缩放」同名同键（TB-116 补）
  { id: "zoom-100", title: "100%", icon: Percent, category: "视图", keys: ["Mod+1"], keywords: ["缩放", "实际大小", "100"] },
  // 母版视图里标题换成「关闭母版视图」、可用性取宿主的 entry（不再只看 needs: EDIT），见 CommandPalette.tsx；needs 留着给没有宿主模式接口时的兜底
  { id: "master", title: "母版视图", icon: PanelsTopLeft, category: "视图", keys: ["Alt+Mod+M"], keywords: ["版式", "母版"], needs: EDIT, run: { kind: "master" } },
  // 插入（与工具条同序）
  { id: "text", title: "文本框", icon: Type, category: "插入", keys: ["T"], keywords: ["文字", "文本"], needs: EDIT, run: { kind: "tool", tool: "text" } },
  { id: "shapes", title: "形状库…", icon: Shapes, category: "插入", keys: ["S"], keywords: ["形状"], needs: EDIT, run: { kind: "tool", tool: "shapes" } },
  { id: "image", title: "图片…", icon: ImageIcon, category: "插入", keywords: ["图像", "照片"], needs: EDIT },
  { id: "table", title: "表格…", icon: Table, category: "插入", needs: EDIT },
  { id: "chart", title: "图表…", icon: ChartColumn, category: "插入", needs: EDIT },
  { id: "header-footer", title: "页眉和页脚…", icon: PanelBottom, category: "插入", keywords: ["页码", "日期", "页脚"], needs: EDIT },
  { id: "link", title: "链接…", icon: Link2, category: "插入", keys: ["Shift+Mod+K"], keywords: ["超链接"], needs: ["edit", "selection"] },
  { id: "comment", title: "评论", icon: MessageSquare, category: "插入", keys: ["C"], keywords: ["批注"], run: { kind: "tool", tool: "comment" } },
  // 排列（与右键「排列」一致）
  { id: "front", title: "置于顶层", icon: BringToFront, category: "排列", keys: ["Shift+Mod+]"], keywords: ["叠放顺序", "层"], needs: ["edit", "selection"] },
  { id: "forward", title: "上移一层", icon: ChevronUp, category: "排列", keys: ["Mod+]"], keywords: ["叠放顺序", "层"], needs: ["edit", "selection"] },
  { id: "backward", title: "下移一层", icon: ChevronDown, category: "排列", keys: ["Mod+["], keywords: ["叠放顺序", "层"], needs: ["edit", "selection"] },
  { id: "back", title: "置于底层", icon: SendToBack, category: "排列", keys: ["Shift+Mod+["], keywords: ["叠放顺序", "层"], needs: ["edit", "selection"] },
  { id: "group", title: "组合", icon: Group, category: "排列", keys: ["Mod+G"], needs: ["edit", "multi"] },
  { id: "ungroup", title: "取消组合", icon: Ungroup, category: "排列", keys: ["Shift+Mod+G"], needs: ["edit", "group"] },
  // 幻灯片（缩略图右键与左栏，03-14）
  { id: "new-slide", title: "新建幻灯片", icon: Plus, category: "幻灯片", keys: ["Mod+M"], keywords: ["页", "新建页"], needs: EDIT },
  { id: "duplicate-slide", title: "复制幻灯片", icon: CopyPlus, category: "幻灯片", keywords: ["副本", "页"], needs: EDIT },
  { id: "change-layout", title: "更换版式…", icon: LayoutTemplate, category: "幻灯片", keywords: ["版式"], needs: EDIT },
  { id: "hide-slide", title: "隐藏幻灯片", icon: EyeOff, category: "幻灯片", keywords: ["跳过", "放映时跳过此页"], needs: EDIT },
  { id: "slide-up", title: "上移一页", icon: ArrowUp, category: "幻灯片", keys: ["Shift+Mod+Up"], keywords: ["幻灯片顺序", "重排", "移动幻灯片"], needs: EDIT },
  { id: "slide-down", title: "下移一页", icon: ArrowDown, category: "幻灯片", keys: ["Shift+Mod+Down"], keywords: ["幻灯片顺序", "重排", "移动幻灯片"], needs: EDIT },
  // 放映
  { id: "present-start", title: "从头放映", icon: Play, category: "放映", keys: ["F5"], keywords: ["演示", "播放"] },
  { id: "present-current", title: "从当前页放映", icon: Play, category: "放映", keys: ["Shift+F5"], keywords: ["演示", "播放"] },
  // 插件、帮助、账户
  { id: "plugins", title: "插件…", icon: Blocks, category: "插件", keywords: ["扩展", "插件管理"], run: { kind: "editor", command: "plugins" } },
  { id: "shortcuts", title: "键盘快捷键", icon: Keyboard, category: "帮助", keys: ["Mod+/"], keywords: ["快捷键", "按键"], run: { kind: "local", command: "help.shortcuts" } },
  // 只在配置了帮助链接时列出（TB-132，见 paletteCommands）；新标签页打开，外链图标
  { id: "help-center", title: "帮助中心", icon: LifeBuoy, category: "帮助", keywords: ["帮助", "文档"], external: true },
  { id: "preferences", title: "偏好设置…", icon: Settings2, category: "账户", keys: ["Mod+,"], keywords: ["设置", "主题", "语言", "单位"], run: { kind: "local", command: "account.preferences" } },
  // 无障碍（DS-116：常驻入口在偏好设置「无障碍」一组，这里是第二入口——打开偏好设置、焦点落在「阅读顺序」上）
  {
    id: "reading-order", title: "阅读顺序…", icon: ListOrdered, category: "无障碍", keywords: ["读屏", "朗读顺序", "Tab 顺序", "无障碍"],
    run: { kind: "local", command: "account.preferences", arg: "reading-order" },
  },
  // 插件命令（plugins/data.ts 同一份部署）
  { id: "focus-search.open", title: "打开全局搜索", icon: ScanSearch, category: "搜索", keys: ["Alt+Mod+F"], keywords: ["搜索", "聚焦搜索"] },
  { id: "acme.bind", title: "绑定数据源…", icon: Database, category: "图表", from: "数据图表增强", keywords: ["数据", "外部数据"], needs: ["edit", "chart"] },
  { id: "acme.refresh", title: "刷新图表数据", icon: RefreshCw, category: "图表", from: "数据图表增强", keywords: ["数据", "更新"], needs: ["chart"] },
  { id: "acme.unbind", title: "断开数据源", icon: Unlink, category: "图表", from: "数据图表增强", keywords: ["数据"], needs: ["edit", "chart"] },
  { id: "poll.insert", title: "插入投票…", icon: Vote, category: "投票", from: "现场投票", keywords: ["投票", "问卷"], needs: EDIT },
  { id: "poll.shuffle", title: "随机排列投票选项", icon: Shuffle, category: "投票", from: "现场投票", keywords: ["选项顺序", "打乱", "投票"], needs: ["edit", "poll"] },
]

/**
 * 母版视图里另列的「母版」类命令（2026-10-30 母版视图改版第二步，规格 §3.5.6）：只在母版视图里列（50/10 §10.1「列出 when 为真的命令」），普通视图里一条都不出现；
 * 列在「关闭母版视图」那一条之后（CommandPalette.tsx）。标题、快捷键与母版视图里的同一件事同名同键：「新建版式 ▾」菜单的插入版式 ⌘M、复制所选版式（窗格里 ⌘D）、
 * 新建母版、从模板导入母版…，工具条「占位符 ▾」（P），窗格右键「在普通视图查看引用页」。可用与否与原因由 CommandPalette.tsx 按母版视图的同一套规则算
 * （masters-themes/mv-state 的 mvReasonOf；「新建版式 ▾」一行与「复制所选版式」取 MasterRail 的 masterRailNewLayout，与菜单同一条），这里不写 needs。
 * 「新建母版」「从模板导入母版…」样张里同菜单一样不接流程（随 M3），执行时只关面板
 */
export const MASTER_COMMANDS: PaletteCommand[] = [
  { id: "master.insert-layout", title: "插入版式", icon: Plus, category: "母版", keys: ["Mod+M"], keywords: ["新建版式", "版式"], run: { kind: "master-cmd", command: "insert-layout" } },
  { id: "master.duplicate-layout", title: "复制所选版式", icon: CopyPlus, category: "母版", keys: ["Mod+D"], keywords: ["副本", "版式"], run: { kind: "master-cmd", command: "duplicate-layout" } },
  { id: "master.new-master", title: "新建母版", icon: SquarePlus, category: "母版", keywords: ["母版"], run: { kind: "master-cmd", command: "new-master" } },
  { id: "master.import-master", title: "从模板导入母版…", icon: Import, category: "母版", keywords: ["模板", "导入", "母版"], run: { kind: "master-cmd", command: "import-master" } },
  { id: "master.insert-placeholder", title: "插入占位符…", icon: SquareDashed, category: "母版", keys: ["P"], keywords: ["占位符", "版式"], run: { kind: "master-cmd", command: "insert-placeholder" } },
  { id: "master.view-pages", title: "在普通视图查看引用页", icon: ArrowUpRight, category: "母版", keywords: ["引用页", "版式", "普通视图"], run: { kind: "master-cmd", command: "view-pages" } },
]

/**
 * 本会话列进面板的命令：COMMANDS 去掉没配置链接的外链条目（rulings §4.25 TB-132：「帮助中心」只在集成方配置了帮助链接时出现，与 DS-89 的帮助菜单、账户菜单同一规则）。
 * helpConfigured 缺省 true（本样张的部署配置了帮助链接，同主菜单「帮助」与开始页帮助菜单的缺省）
 */
export function paletteCommands({ helpConfigured = true }: { helpConfigured?: boolean } = {}): PaletteCommand[] {
  return helpConfigured ? COMMANDS : COMMANDS.filter((c) => c.id !== "help-center")
}

/** 打开时（还没输入）列出的常用命令：产品固定的一份（rulings §4.25 TB-117：不记个人使用，ED-30 只要求模糊搜索），按这个顺序；清单登记在前端 50/10 §10.1 */
export const COMMON_IDS = ["new-slide", "present-current", "find", "export", "history", "master", "shortcuts", "preferences"]

const norm = (s: string) => s.replace(/…/g, "").trim().toLowerCase()

/**
 * 搜索：标题与关键词包含查询词（不区分大小写，标题末尾的「…」不参与）；排序：标题以查询词开头 → 标题包含 → 只有关键词命中，同档按清单顺序。
 * 分类不参与匹配（「插入」只命中标题或关键词里有它的，不把整个插入分类都列出来）
 */
export function searchCommands(list: PaletteCommand[], query: string): PaletteCommand[] {
  const q = norm(query)
  if (!q) return []
  const rank = (c: PaletteCommand) => {
    const t = norm(c.title)
    if (t.startsWith(q)) return 0
    if (t.includes(q)) return 1
    if ((c.keywords ?? []).some((k) => norm(k).includes(q))) return 2
    return -1
  }
  return list
    .map((c, i) => ({ c, i, r: rank(c) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.c)
}

/** 当前状态（模式、选中）下这条命令不可用的原因；可用时为 undefined。理由按 09 §3.4 第 4 条与 50/10 §10.1 的写法 */
export function reasonFor(c: PaletteCommand, ctx: { mode: "edit" | "review" | "viewer"; selection: string }): string | undefined {
  const needs = c.needs ?? []
  if (needs.includes("later")) return "后续版本提供"
  if (needs.includes("edit") && ctx.mode !== "edit") return ctx.mode === "viewer" ? "只有查看权限" : "评审模式下不可用"
  const sel = ctx.selection
  if (needs.includes("selection") && sel === "none") return "未选中对象"
  if (needs.includes("multi") && sel !== "mixed") return "需选中 2 个以上对象"
  if (needs.includes("group") && sel !== "group") return "当前选区不支持"
  if (needs.includes("chart") && sel !== "chart") return "需选中图表"
  if (needs.includes("poll")) return "需选中投票"
  return undefined
}
