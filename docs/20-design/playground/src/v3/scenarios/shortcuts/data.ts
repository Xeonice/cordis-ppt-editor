/**
 * 快捷键面板的内容（03-24；PRD ED-16；前端 50/10 §10.2 分组、§10.4 默认快捷键表 36 行）。
 * 分组按 rulings §4.25 TB-105：照 50/10 §10.2 按作用域分组——全局 · 工具（另加，V / T / S / C，组下一行写生效条件）· 画布 · 文本编辑 · 左栏缩略图与网格 · 视图 · 放映，
 * 插件每个一组排在末尾并带归属（03-24、06 §4）；「开始页」一组只在从开始页打开时出现、放在最上面（TB-105），列三条：聚焦搜索框 ⌘K · 偏好设置… ⌘, · 键盘快捷键 ⌘/
 * （rulings §4.25 TB-116：开始页上 ⌘, ⌘/ 同样可用，只列 ⌘K 会让人以为这两个键在开始页无效），编辑器里不列。
 * 组内按 50/10 §10.4 的行序；一个功能一行（「撤销 / 重做」拆成两行，搜索时各自命中）。
 * 不登记 ui.shortcut、由别的管线处理的键（剪贴板三键与粘贴为纯文本、Esc 逐级、F6 区域循环、数字 + ↵ 跳页、文本里的 Tab 缩进）也列出（静态条目，
 * 03-24 缺口⑬：否则 ⌘C / ⌘V 这类最常用的键不会出现在面板里），外观与登记的条目相同。
 * 键值按 DS-78：居中对齐 ⌘E、导出 ⇧⌘E；替换 macOS ⇧⌘H、Windows / Linux Ctrl+H（DS-16）；命令面板 ⌘K、链接 ⇧⌘K（DS-11）；放映 F5 / ⇧F5。
 * 功能名与主菜单、命令面板、放映「更多」同一份（TB-116）：缩放写「适应窗口 ⌘0」「100% ⌘1」（同主菜单「视图 › 缩放」、命令面板），跳页写「跳至页码… 数字 ↵」（同放映「更多」、03-11）。
 * ⌘S（TB-116，50/10 §10.4 第 17 行）：参考应用（协同）不列——协同文档随时保存，按键只消费、不下载；SDK 单人 preset 在「全局」组列「保存 ⌘S」（回调式保存，
 * 出现条件与偏好设置「编辑 › 自动保存间隔」相同），见 builtinGroups({ solo })。
 */

export interface ShortcutRow {
  id: string
  /** 功能名：与菜单、命令面板里的命令标题同一份（ui.command 的 title；打开对话框的带「…」） */
  label: string
  /** 可互换的和弦（keys.ts 的记法）；第一项是主写法 */
  keys: string[]
  /** Windows / Linux 另有写法时（替换：Ctrl+H） */
  keysWin?: string[]
  /** 搜索时额外命中的词（「缩放」命中放大、缩小） */
  keywords?: string[]
  /** 改文档或只在编辑模式可用的：评审、只读浏览时留在原位置灰（FE-06 禁用而不隐藏，TB-22 同一原因写在顶部一行） */
  edit?: boolean
  /** 只读浏览（查看者）也不可用、评审里可用的（评论 C） */
  comment?: boolean
  /** 里程碑小标记（P2：粘贴为纯文本，DS-29） */
  tag?: string
  /** 下一行补充说明（12px 次级文字色），如说明条目、作用域的提醒 */
  hint?: string
  /** 评审模式下换一个名字（工具「选择」在评审条里叫「浏览」，50/10 §3.2） */
  reviewLabel?: string
}

export interface ShortcutGroup {
  id: string
  title: string
  /** 组标题下一行（工具组的生效条件，TB-105） */
  description?: string
  rows: ShortcutRow[]
  /** 插件贡献的分组：组标题写插件名 + 来源（内置 / 第三方 · 供应商），前面 12px 归属图标（06 §4） */
  plugin?: { name: string; source: string }
}

const E = { edit: true } as const

/**
 * 全局（50/10 §10.4 第 1、11、14、15、16、18、22、23、28、31、34 行；单人 preset 另有第 17 行「保存」，见 builtinGroups）。
 * 「插入版式（母版视图）⌘M」是第 11 行同一和弦在母版视图里的另一作用域，排在「新建幻灯片」之后（见下「母版视图的三个键」）
 */
const GLOBAL: ShortcutGroup = {
  id: "global",
  title: "全局",
  rows: [
    { id: "undo", label: "撤销", keys: ["Mod+Z"], ...E },
    { id: "redo", label: "重做", keys: ["Shift+Mod+Z", "Mod+Y"], ...E },
    { id: "new-slide", label: "新建幻灯片", keys: ["Mod+M"], keywords: ["页"], ...E },
    { id: "master-insert-layout", label: "插入版式（母版视图）", keys: ["Mod+M"], keywords: ["母版", "版式"], ...E },
    { id: "find", label: "查找…", keys: ["Mod+F"], keywords: ["搜索"] },
    { id: "replace", label: "替换…", keys: ["Shift+Mod+H"], keysWin: ["Ctrl+H"], ...E },
    { id: "present-start", label: "从头放映", keys: ["F5"], keywords: ["演示", "播放"] },
    { id: "present-current", label: "从当前页放映", keys: ["Shift+F5"], keywords: ["演示", "播放"] },
    { id: "zoom-fit", label: "适应窗口", keys: ["Mod+0"], keywords: ["缩放", "适应"] },
    { id: "zoom-100", label: "100%", keys: ["Mod+1"], keywords: ["缩放", "实际大小"] },
    { id: "palette", label: "命令面板…", keys: ["Mod+K"], keywords: ["命令", "搜索"] },
    { id: "prefs", label: "偏好设置…", keys: ["Mod+,"], keywords: ["设置", "主题", "语言"] },
    { id: "shortcuts", label: "键盘快捷键", keys: ["Mod+/"], keywords: ["快捷键", "帮助"] },
    { id: "export", label: "导出…", keys: ["Shift+Mod+E"], keywords: ["下载", "pptx", "pdf", "png"] },
    { id: "zoom-in", label: "放大", keys: ["Mod+Plus"], keywords: ["缩放"] },
    { id: "zoom-out", label: "缩小", keys: ["Mod+Minus"], keywords: ["缩放"] },
    // 备用键 Ctrl+F6 / Ctrl+Shift+F6（浏览器截获 F6 时用，50/10 §10.4 第 34 行；macOS 也是 ⌃，不是 ⌘）
    { id: "region-next", label: "下一个区域", keys: ["F6", "Ctrl+F6"], keywords: ["焦点", "区域"] },
    { id: "region-prev", label: "上一个区域", keys: ["Shift+F6", "Ctrl+Shift+F6"], keywords: ["焦点", "区域"] },
  ],
}

/** 工具（TB-105 另加；50/10 §10.4 第 25 行，PRD ED-16 / 07 §1.3：只在焦点位于画布或工具条、不在文字输入时生效）；母版视图的「占位符 P」排在组末 */
const TOOLS: ShortcutGroup = {
  id: "tools",
  title: "工具",
  description: "焦点在画布或工具条、不在输入时生效",
  rows: [
    { id: "tool-select", label: "选择", reviewLabel: "浏览", keys: ["V"] },
    { id: "tool-text", label: "文本", keys: ["T"], keywords: ["文本框"], ...E },
    { id: "tool-shapes", label: "形状", keys: ["S"], ...E },
    { id: "tool-comment", label: "评论", keys: ["C"], comment: true },
    { id: "master-tool-placeholder", label: "占位符（母版视图）", keys: ["P"], keywords: ["母版", "版式", "占位符"], ...E },
  ],
}

/** 画布（第 2–6、10、12、13、19、20、27、29、32、33 行；数字 + ↵ 跳页是说明条目，03-20 §7，名字同放映「更多 › 跳至页码…」） */
const CANVAS: ShortcutGroup = {
  id: "canvas",
  title: "画布",
  rows: [
    { id: "copy", label: "复制", keys: ["Mod+C"] },
    { id: "cut", label: "剪切", keys: ["Mod+X"], ...E },
    { id: "paste", label: "粘贴", keys: ["Mod+V"], ...E },
    { id: "duplicate", label: "原位复制", keys: ["Mod+D"], keywords: ["复制对象"], ...E },
    { id: "select-all", label: "全选", keys: ["Mod+A"] },
    { id: "group", label: "组合", keys: ["Mod+G"], ...E },
    { id: "ungroup", label: "取消组合", keys: ["Shift+Mod+G"], ...E },
    { id: "delete", label: "删除", keys: ["Backspace"], keysWin: ["Delete", "Backspace"], ...E },
    { id: "nudge", label: "微移", keys: ["Arrows"], keywords: ["移动"], ...E },
    { id: "nudge-big", label: "大幅微移", keys: ["Shift+Arrows"], keywords: ["移动"], ...E },
    { id: "forward", label: "上移一层", keys: ["Mod+]"], keywords: ["层", "排列"], ...E },
    { id: "backward", label: "下移一层", keys: ["Mod+["], keywords: ["层", "排列"], ...E },
    { id: "front", label: "置于顶层", keys: ["Shift+Mod+]"], keywords: ["层", "排列"], ...E },
    { id: "back", label: "置于底层", keys: ["Shift+Mod+["], keywords: ["层", "排列"], ...E },
    { id: "edit-text", label: "编辑文字", keys: ["Enter"], keywords: ["文本编辑"], ...E },
    { id: "exit-group", label: "退出组合编辑", keys: ["Esc"] },
    { id: "paste-text", label: "粘贴为纯文本", keys: ["Shift+Mod+V"], tag: "P2", keywords: ["粘贴"], ...E },
    { id: "resize", label: "调整大小", keys: ["Alt+Shift+Arrows"], keywords: ["尺寸", "缩放对象"], ...E },
    { id: "page-prev", label: "上一页", keys: ["PageUp"], keywords: ["翻页"] },
    { id: "page-next", label: "下一页", keys: ["PageDown"], keywords: ["翻页"] },
    { id: "page-first", label: "第一页", keys: ["Home"], keywords: ["翻页"] },
    { id: "page-last", label: "最后一页", keys: ["End"], keywords: ["翻页"] },
    { id: "next-object", label: "选中下一个对象", keys: ["Tab"] },
    { id: "prev-object", label: "选中上一个对象", keys: ["Shift+Tab"] },
    { id: "jump", label: "跳至页码…", keys: ["Digits+Enter"], keywords: ["页码", "翻页", "跳页", "跳到"], hint: "在画布上输入页码后回车" },
  ],
}

/** 文本编辑（第 7–9、19、24、26 行；Tab / ⇧Tab 缩进由文本宿主处理，与检查器「段落」的提示一致） */
const TEXT: ShortcutGroup = {
  id: "text",
  title: "文本编辑",
  rows: [
    { id: "bold", label: "粗体", keys: ["Mod+B"], ...E },
    { id: "italic", label: "斜体", keys: ["Mod+I"], ...E },
    { id: "underline", label: "下划线", keys: ["Mod+U"], ...E },
    { id: "font-up", label: "增大字号", keys: ["Shift+Mod+>"], keywords: ["字号"], ...E },
    { id: "font-down", label: "减小字号", keys: ["Shift+Mod+<"], keywords: ["字号"], ...E },
    { id: "align-left", label: "左对齐", keys: ["Mod+L"], keywords: ["对齐"], ...E },
    { id: "align-center", label: "居中", keys: ["Mod+E"], keywords: ["对齐", "居中对齐"], ...E },
    { id: "align-right", label: "右对齐", keys: ["Mod+R"], keywords: ["对齐"], ...E },
    { id: "justify", label: "两端对齐", keys: ["Mod+J"], keywords: ["对齐"], ...E },
    { id: "indent", label: "增加缩进", keys: ["Tab"], keywords: ["缩进"], ...E },
    { id: "outdent", label: "减少缩进", keys: ["Shift+Tab"], keywords: ["缩进"], ...E },
    { id: "exit-text", label: "退出文本编辑", keys: ["Esc"] },
    { id: "link", label: "链接…", keys: ["Shift+Mod+K"], keywords: ["超链接"], ...E },
    { id: "strike", label: "删除线", keys: ["Shift+Mod+X"], ...E },
    { id: "superscript", label: "上标", keys: ["Shift+Mod+Equal"], ...E },
    { id: "subscript", label: "下标", keys: ["Mod+Equal"], hint: "在画布上同一组键是放大", ...E },
  ],
}

/**
 * 左栏缩略图与网格（第 6、30、35 行；rulings §4.25 TB-116 改名：重排在网格里同样有效，作用域同 50/10 §10.4 第 30 行「左栏缩略图与网格」）。
 * 功能名与缩略图右键同一份（03-14 §3、03-05 §3：复制幻灯片 ⌘D · 移动 ▸ 上移一页 ⇧⌘↑ / 下移一页 ⇧⌘↓ · 删除幻灯片 ⌫）；
 * 「复制幻灯片 ⌘D」是缩略图右键（第 1 批定稿）写着的键；50/10 §10.4 第 3 行把同一和弦登记成两个作用域——画布（原位复制）与左栏缩略图、网格（复制幻灯片）。
 * 同一个 ↵ 在两处不同：左栏是新建同版式幻灯片（第 35 行），网格里是打开那一页（50/10 §2.3、03-02 §5.3），两行各自标出作用域；
 * 网格里空格选中（TB-116 补）；方向键与 Home / End 在网格里移动焦点，与画布组的翻页同名同键，不再重复。
 * 「复制版式（母版窗格）⌘D」是第 3 行同一和弦在母版视图窗格里的作用域，排在「复制幻灯片」之后（见下「母版视图的三个键」）
 */
const RAIL: ShortcutGroup = {
  id: "rail",
  title: "左栏缩略图与网格",
  rows: [
    { id: "duplicate-slide", label: "复制幻灯片", keys: ["Mod+D"], keywords: ["副本"], ...E },
    { id: "master-duplicate-layout", label: "复制版式（母版窗格）", keys: ["Mod+D"], keywords: ["母版", "版式", "副本"], ...E },
    { id: "delete-slide", label: "删除幻灯片", keys: ["Backspace"], keysWin: ["Delete", "Backspace"], keywords: ["删除"], ...E },
    { id: "slide-up", label: "上移一页", keys: ["Shift+Mod+Up"], keywords: ["重排", "顺序", "移动幻灯片"], ...E },
    { id: "slide-down", label: "下移一页", keys: ["Shift+Mod+Down"], keywords: ["重排", "顺序", "移动幻灯片"], ...E },
    { id: "new-same", label: "新建同版式幻灯片（左栏）", keys: ["Enter"], keywords: ["新建", "版式"], ...E },
    { id: "grid-open", label: "打开（网格）", keys: ["Enter"], keywords: ["网格", "打开幻灯片"] },
    { id: "grid-select", label: "选中（网格）", keys: ["Space"], keywords: ["网格", "选择"] },
  ],
}

/** 视图（第 21 行：评审、放映与窄屏下无效） */
const VIEW: ShortcutGroup = {
  id: "view",
  title: "视图",
  rows: [{ id: "master", label: "母版视图", keys: ["Alt+Mod+M"], keywords: ["版式", "母版"], hint: "进入与退出", ...E }],
}

/** 放映（第 36 行与 TB-104 跳页；DS-107：键位只放在这里与按钮提示，不另做进入放映时的键盘提示浮层） */
const PRESENT: ShortcutGroup = {
  id: "present",
  title: "放映",
  rows: [
    { id: "show-next", label: "下一页", keys: ["Right", "Space", "PageDown"], keywords: ["翻页"] },
    { id: "show-prev", label: "上一页", keys: ["Left", "PageUp"], keywords: ["翻页"] },
    { id: "show-first", label: "第一页", keys: ["Home"], keywords: ["翻页"] },
    { id: "show-last", label: "最后一页", keys: ["End"], keywords: ["翻页"] },
    { id: "show-jump", label: "跳至页码…", keys: ["Digits+Enter"], keywords: ["页码", "跳页", "跳到"] },
    { id: "black", label: "黑屏", keys: ["B"], hint: "再按任意翻页键恢复" },
    { id: "white", label: "白屏", keys: ["W"], hint: "再按任意翻页键恢复" },
    { id: "exit-show", label: "退出放映", keys: ["Esc"] },
  ],
}

/**
 * 开始页（TB-105：只在从开始页打开时出现、放在最上一组；PRD AS-01、AS-04、AS-06、03-29 §6）。TB-116：列三条——聚焦搜索框 ⌘K（开始页的 ⌘K 不是命令面板）·
 * 偏好设置… ⌘, · 键盘快捷键 ⌘/（开始页上同样可用；与下面编辑器「全局」组的同名两行重复，可以接受）
 */
export const HOME_GROUP: ShortcutGroup = {
  id: "home",
  title: "开始页",
  rows: [
    { id: "home-search", label: "聚焦搜索框", keys: ["Mod+K"], keywords: ["搜索", "文档"] },
    { id: "home-prefs", label: "偏好设置…", keys: ["Mod+,"], keywords: ["设置", "主题", "语言"] },
    { id: "home-shortcuts", label: "键盘快捷键", keys: ["Mod+/"], keywords: ["快捷键", "帮助"] },
  ],
}

/**
 * 编辑器内置的分组（50/10 §10.2 的作用域顺序，工具组按 TB-105 排在全局之后）。
 * 母版视图的三个键（rulings §4.25 DS-150、DS-152、TB-196）写在现有分组里、作用域写在名称的括号里（同「新建同版式幻灯片（左栏）」，03-24 §4）：
 *   全局组「新建幻灯片 ⌘M」之后「插入版式（母版视图）⌘M」· 工具组末尾「占位符（母版视图）P」· 左栏缩略图与网格组「复制幻灯片 ⌘D」之后「复制版式（母版窗格）⌘D」。
 * 普通视图与开始页的静态表里同样列出（速查表是全表）；都是改文档的（评审、只读浏览时留在原位置灰）；关键词都带「母版」「版式」，占位符那一行另带「占位符」，
 * 搜「母版」时与「母版视图 ⌥⌘M」一起列出。与插件快捷键的冲突检查（ShortcutsService.conflicts()）在产品侧，登记前先过（50/10 §10.4「母版视图的三个键」）
 */
export const BUILTIN_GROUPS: ShortcutGroup[] = [GLOBAL, TOOLS, CANVAS, TEXT, RAIL, VIEW, PRESENT]

/** 单人 preset 才有的「保存 ⌘S」（50/10 §10.4 第 17 行：回调式保存；TB-116），按表的行序排在「100%」（第 16 行）之后、「命令面板…」（第 18 行）之前 */
const SAVE_ROW: ShortcutRow = { id: "save", label: "保存", keys: ["Mod+S"], keywords: ["保存"], ...E }

/** 内置分组：solo = SDK 单人 preset（「全局」组多「保存 ⌘S」）；参考应用（协同）不列 ⌘S（TB-116） */
export function builtinGroups(o: { solo?: boolean } = {}): ShortcutGroup[] {
  if (!o.solo) return BUILTIN_GROUPS
  const rows = [...GLOBAL.rows]
  rows.splice(rows.findIndex((r) => r.id === "zoom-100") + 1, 0, SAVE_ROW)
  return [{ ...GLOBAL, rows }, ...BUILTIN_GROUPS.slice(1)]
}

/* ------------------------------------------------------------------ 插件分组（与第 2 批 plugins 场景同一份部署） */

/** 冲突演示（PM-11，03-09 §4.4；与 plugins/data.ts 的 CONFLICTS 同一对）：user = ⌘− 内置「缩小」vs 聚焦搜索（界面级，可为我关闭）· locked = ⌥⌘M 内置「母版视图」vs 流程图形状包（内容级，请联系管理员） */
export type ConflictKind = "user" | "locked"

export interface Conflict {
  /** 被占的内置条目 */
  builtinRow: string
  builtinLabel: string
  /** 插件条目 */
  pluginRow: string
  pluginName: string
  /** 插件条目所在的组 */
  pluginGroup: string
}

export const CONFLICTS: Record<ConflictKind, Conflict> = {
  user: { builtinRow: "zoom-out", builtinLabel: "缩小", pluginRow: "focus-search.open", pluginName: "聚焦搜索", pluginGroup: "plugin-focus-search" },
  locked: { builtinRow: "master", builtinLabel: "母版视图", pluginRow: "flow-shapes.node", pluginName: "流程图形状包", pluginGroup: "plugin-flow-shapes" },
}

/**
 * 本会话装配的插件里贡献了 ui.shortcut 的（plugins/data.ts：聚焦搜索、演示激光笔各 ×1）。
 * 冲突态演示的部署里，聚焦搜索绑定的是 ⌘−（与 plugins.conflict 同一对），流程图形状包另绑了 ⌥⌘M（plugins.conflict-locked）；
 * 没有冲突的部署里聚焦搜索用 ⌥⌘F，流程图形状包不登记快捷键（plugins/data.ts 它只贡献形状与工具条条目）
 */
export function pluginGroups(conflict?: ConflictKind): ShortcutGroup[] {
  const focus: ShortcutGroup = {
    id: "plugin-focus-search",
    title: "聚焦搜索",
    plugin: { name: "聚焦搜索", source: "内置" },
    rows: [{ id: "focus-search.open", label: "打开全局搜索", keys: [conflict === "user" ? "Mod+Minus" : "Alt+Mod+F"], keywords: ["搜索"] }],
  }
  const laser: ShortcutGroup = {
    id: "plugin-laser",
    title: "演示激光笔",
    plugin: { name: "演示激光笔", source: "内置" },
    rows: [{ id: "laser.show", label: "显示激光点", keys: ["L"], keywords: ["放映", "激光笔"], hint: "放映时按住" }],
  }
  const flow: ShortcutGroup = {
    id: "plugin-flow-shapes",
    title: "流程图形状包",
    plugin: { name: "流程图形状包", source: "第三方 · ACME" },
    rows: [{ id: "flow-shapes.node", label: "插入流程图节点", keys: ["Alt+Mod+M"], keywords: ["流程图"], edit: true }],
  }
  return conflict === "locked" ? [focus, laser, flow] : [focus, laser]
}

/** 搜索：功能名与关键词包含查询词（不区分大小写、去掉首尾空格）；组里没有命中的整组隐藏（03-24「空分组标题自动隐藏」），插件组同样参与过滤 */
export function filterGroups(groups: ShortcutGroup[], query: string): ShortcutGroup[] {
  const q = query.trim().toLowerCase()
  if (!q) return groups
  const hit = (r: ShortcutRow) => [r.label, r.reviewLabel ?? "", ...(r.keywords ?? [])].some((s) => s.toLowerCase().includes(q))
  return groups.map((g) => ({ ...g, rows: g.rows.filter(hit) })).filter((g) => g.rows.length > 0)
}
