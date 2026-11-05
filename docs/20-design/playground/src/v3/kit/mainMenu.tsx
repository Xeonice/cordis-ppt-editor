import {
  AudioLines, Blocks, Calendar, ChartColumn, Hash, Image as ImageIcon, Link2, MessageSquare, Omega, PanelBottom, Shapes, Sigma, Sticker, Table, Type, Video, Workflow,
} from "lucide-react"
import { useEffect, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { useEditor } from "../editor/context"
import { masterMenuOption } from "../editor/master/mode"
import { useV3Params, v3Href, type V3View } from "../params"
import { ICON } from "../ui"
import { len } from "../editor/inspector/geometry"
import { useRunCommand } from "./commands"
import { Menu, type MenuSpec } from "./Menu"

/**
 * 主菜单的统一条目（logo ▾）：所有场景与底座 MainMenu 共用这一份，顶层固定为
 *   返回首页 ┊ 文件 ▸ · 编辑 ▸ · 视图 ▸ · 插入 ▸ · 排列 ▸ ┊ 插件… ┊ 帮助 ▸
 * DS-1：创建在工具条、格式在检查器，其余命令进主菜单 / 右键 / 命令面板 ⌘K（DS-11）/ 快捷键；主菜单是不常驻的第二入口（Q2 不算重复）。
 * DS-18：「插件…」（个人插件面板，03-09）与「返回首页」在主菜单；账户、亮暗主题、偏好设置在右上自己的头像（账户菜单）。
 * 「文件」：导出… ⇧⌘E（DS-78）· 保真报告 · 幻灯片大小…（P2：留在原位、不可用、标 P2，rulings §4.25 DS-31；原 Ribbon「设计」页签的灰显入口作废）。
 * 「视图」：单页 / 网格（与左栏顶部、网格胶囊同一状态）· 备注 ┊ 网格与参考线 ▸ · 缩放 ▸ ┊ 母版视图 ⌥⌘M ┊ 模式（编辑 / 评审）。
 * 「帮助」：命令面板… ⌘K · 键盘快捷键 ⌘/ ┊ 帮助中心；母版视图中多一项「关于母版继承」（PRD ML-01，TB-15；与帮助中心同走壳意图 help-center，TB-39）。
 * 母版视图里「文件 › 保真报告」「编辑 › 重置页…」与「插件…」留在原位、不可用，写「母版视图下不可用」（rulings §4.25 DS-157、TB-203，见 offInMaster）；
 *  命令面板的同名命令、文档菜单「版本历史」同一句。
 *  开发者面板只在开发构建或 features.developerMenu 打开时出现在最后一组（TB-40），样张是生产形态，不画。
 * 快捷键以 PRD ED-16 为准，修饰键按 macOS 顺序写（⌃⌥⇧⌘）：撤销 ⌘Z、重做 ⇧⌘Z、查找 ⌘F、替换 ⇧⌘H（DS-16：⌘H 是 macOS「隐藏应用」，
 * Windows / Linux 为 Ctrl+H）、链接 ⇧⌘K（DS-11：⌘K 是命令面板）、母版视图 ⌥⌘M、缩放适应 ⌘0、100% ⌘1。
 * 各子菜单的完整条目由负责的场景定稿：编辑（03-19）、视图 / 缩放（03-20）、插入（03-04）、母版视图（03-26）、模式（03-02）。
 */

/** 粘贴的三个变体（P2，03-19「粘贴选项 ▸」）。 */
export const PASTE_VARIANTS: MenuSpec[] = [
  { id: "paste-keep", label: "保留源格式" },
  { id: "paste-text", label: "仅文本", kbd: "⇧⌘V" },
  { id: "paste-image", label: "作为图片" },
]

export interface EditMenuOptions {
  /** 下一步撤销的步骤名（取命令 ui.command 的标题）；null = 没有可撤销的步骤；缺省不带步骤名 */
  undo?: string | null
  /** 下一步重做的步骤名；null = 没有可重做的步骤；缺省不带步骤名 */
  redo?: string | null
  /** 有选中对象（剪切、复制、原位复制、删除可用；缺省 true） */
  hasSelection?: boolean
  /** 评审 / 浏览模式：改文档的命令不可用并写原因，复制、全选、查找照常 */
  readOnlyReason?: string
}

/** 主菜单「编辑」（03-19 定稿）：撤销 / 重做（带步骤名）· 剪贴板 · 全选 · 查找 / 替换 · 重置页。不可用项置灰并在右侧写原因。 */
export function editItems({ undo, redo, hasSelection = true, readOnlyReason }: EditMenuOptions = {}): MenuSpec[] {
  const ro = readOnlyReason ? { disabled: true, reason: readOnlyReason } : null
  const needSel = hasSelection ? {} : { disabled: true, reason: "未选中对象" }
  const step = (id: "undo" | "redo", label: string, kbd: string, name: string | null | undefined): MenuSpec =>
    ro ? { id, label, ...ro } : name === null ? { id, label, disabled: true, reason: id === "undo" ? "没有可撤销的操作" : "没有可重做的操作" } : { id, label: name ? `${label}：${name}` : label, kbd }
  return [
    step("undo", "撤销", "⌘Z", undo),
    step("redo", "重做", "⇧⌘Z", redo),
    { type: "separator" },
    { id: "cut", label: "剪切", kbd: "⌘X", ...needSel, ...ro },
    { id: "copy", label: "复制", kbd: "⌘C", ...needSel },
    { id: "paste", label: "粘贴", kbd: "⌘V", ...ro },
    { type: "sub", id: "paste-special", label: "粘贴选项", tag: "P2", disabled: true, reason: "后续版本提供", items: PASTE_VARIANTS },
    { id: "duplicate", label: "原位复制", kbd: "⌘D", ...needSel, ...ro },
    { id: "delete", label: "删除", kbd: "⌫", ...needSel, ...ro },
    { type: "separator" },
    { id: "select-all", label: "全选", kbd: "⌘A" },
    { type: "separator" },
    { id: "find", label: "查找…", kbd: "⌘F" },
    { id: "replace", label: "替换…", kbd: "⇧⌘H", ...ro },
    { type: "separator" },
    { id: "reset-slide", label: "重置页…", ...ro },
  ]
}

/** 缩放命令（03-20）：检查器 / 网格胶囊的缩放读数菜单与主菜单「视图 › 缩放」共用。读数是实测比例，所以不带选中态。 */
export const ZOOM_COMMANDS: MenuSpec[] = [
  { id: "zoom-in", label: "放大", kbd: "⌘+" },
  { id: "zoom-out", label: "缩小", kbd: "⌘−" },
  { type: "separator" },
  { id: "zoom-fit", label: "适应窗口", kbd: "⌘0" },
  { id: "zoom-fit-width", label: "适应宽度" },
  { type: "separator" },
  { id: "zoom-50", label: "50%" },
  { id: "zoom-75", label: "75%" },
  { id: "zoom-100", label: "100%", kbd: "⌘1" },
  { id: "zoom-150", label: "150%" },
  { id: "zoom-200", label: "200%" },
]

/** 网格与参考线的呈现偏好（03-20 显示 + 03-17 吸附）：主菜单「视图 › 网格与参考线 ▸」与画布空白处右键「网格与参考线 ▸」共用同一份条目。 */
export interface GridGuidePrefs {
  /** 显示网格 */
  grid: boolean
  /** 显示参考线（文件里存的参考线） */
  guides: boolean
  /** 吸附到网格 */
  snapGrid: boolean
  /** 智能参考线（吸附到对象） */
  smartGuides: boolean
  /** 网格间距（pt：三档 6 / 12 / 18、缺省 12，与检查器同一长度单位 LENGTH_UNIT；产品按设置的单位显示，rulings §4.25 DS-27） */
  spacing: "6" | "12" | "18"
}

export const GRID_GUIDE_DEFAULT: GridGuidePrefs = { grid: false, guides: true, snapGrid: false, smartGuides: true, spacing: "12" }

/**
 * 「网格与参考线」子菜单的条目（03-20 与 03-17 合并的一张清单）：显示网格 · 显示参考线 ┊ 吸附到网格 · 智能参考线（吸附到对象）┊ 网格间距 ┊ 标尺、添加参考线（P2）。
 * 都是呈现偏好（不入撤销历史）；onChange 给了就真的改（如 view-zoom 场景读写 displayStore）。
 */
export function gridGuideItems(p: Partial<GridGuidePrefs> = {}, onChange?: (patch: Partial<GridGuidePrefs>) => void): MenuSpec[] {
  const v = { ...GRID_GUIDE_DEFAULT, ...p }
  return [
    { type: "checkbox", id: "show-grid", label: "显示网格", checked: v.grid, onCheckedChange: (grid) => onChange?.({ grid }) },
    { type: "checkbox", id: "show-guides", label: "显示参考线", checked: v.guides, onCheckedChange: (guides) => onChange?.({ guides }) },
    { type: "separator" },
    { type: "checkbox", id: "snap-grid", label: "吸附到网格", checked: v.snapGrid, onCheckedChange: (snapGrid) => onChange?.({ snapGrid }) },
    { type: "checkbox", id: "smart-guides", label: "智能参考线", hint: "吸附到对象", checked: v.smartGuides, onCheckedChange: (smartGuides) => onChange?.({ smartGuides }) },
    { type: "separator" },
    { type: "label", label: "网格间距" },
    {
      type: "radio",
      id: "grid-spacing",
      value: v.spacing,
      onValueChange: (x) => onChange?.({ spacing: x as GridGuidePrefs["spacing"] }),
      options: (["6", "12", "18"] as const).map((v) => ({ value: v, label: len(v) })),
    },
    { type: "separator" },
    { type: "checkbox", id: "ruler", label: "标尺", checked: false, tag: "P2", disabled: true, reason: "后续版本提供" },
    { id: "add-guide", label: "添加参考线", tag: "P2", disabled: true, reason: "后续版本提供" },
  ]
}

/** 「网格与参考线 ▸」子菜单本身（右键菜单里带 16px 图标时传 icon）。 */
export function gridGuideSub(p?: Partial<GridGuidePrefs>, onChange?: (patch: Partial<GridGuidePrefs>) => void, icon?: ReactNode): MenuSpec {
  return { type: "sub", id: "grid-guides", label: "网格与参考线", icon, items: gridGuideItems(p, onChange) }
}

/**
 * 插件贡献的分组标题：插件图标作归属标识，读屏名「流程图插件（第三方）」（设计 06 §2.6）。图标列与条目图标对齐。
 * text / aria 换标题与读屏名（如「现场投票 · 第三方」、插件很多时的「插件 · 7」，TB-31）；缺省是示例部署的流程图插件。
 */
export const pluginGroupLabel = (id: string, text = "流程图插件 · 第三方", aria = "流程图插件（第三方）"): MenuSpec => ({
  type: "custom",
  id,
  render: (
    <div role="presentation" aria-label={aria} className="flex h-6 items-center gap-2 px-2 text-[12px] leading-none text-(--v3-text-2) select-none">
      <span className="flex w-4 shrink-0 justify-center">
        <Blocks size={12} strokeWidth={1.5} aria-hidden="true" />
      </span>
      {text}
    </div>
  ),
})

const LATER = "后续版本提供"

/** 主菜单「文件」（DS-21 定稿，幻灯片大小按 DS-31 补入）：P2 的「幻灯片大小…」与其他 P2 条目同一画法（禁用而不隐藏、标 P2、右侧写原因，rulings §4.20 FE-06）。 */
export const FILE_ITEMS: MenuSpec[] = [
  // 导出 ⇧⌘E（Windows / Linux Ctrl+Shift+E；rulings §4.25 DS-78，同 Figma「文件 › 导出」）：⌘E 留给居中对齐（PRD ED-16）
  { id: "export", label: "导出…", kbd: "⇧⌘E" },
  { id: "fidelity", label: "保真报告" },
  { id: "slide-size", label: "幻灯片大小…", tag: "P2", disabled: true, reason: LATER },
]

/**
 * 「文件」的条目接上回调（导出…、保真报告）：条目与 FILE_ITEMS 同一份，只是选了会调 onExport / onFidelity（底座缺省发命令 file.export / file.fidelity，kit/commands.ts）。
 * exportReason（rulings §4.25 DS-105）：「导出…」留在原位、不可用，右侧写原因（快捷键提示让位给原因，⇧⌘E 同时无效；FE-06）——
 * 查看者「只有查看权限」、评审者与编辑中被降权「需要编辑权限」（doc.export 只到编辑者，PRD 03 §1、rulings §4.12 U-09；按权限写、不按模式写：切到评审模式的编辑者照常可以导出）。
 * 未保存的更改仍走降权横幅里的「导出为本地副本」（CO-05），不受影响；「保真报告」照常
 */
export function fileItems({ onExport, onFidelity, exportReason }: { onExport?: () => void; onFidelity?: () => void; exportReason?: string } = {}): MenuSpec[] {
  return FILE_ITEMS.map((it) =>
    it.type === undefined || it.type === "item"
      ? it.id === "export"
        ? exportReason
          ? { ...it, disabled: true, reason: exportReason }
          : onExport
            ? { ...it, onSelect: onExport }
            : it
        : it.id === "fidelity" && onFidelity
          ? { ...it, onSelect: onFidelity }
          : it
      : it,
  )
}

/**
 * 「文件 › 导出…」不可用的原因（DS-105）：查看者「只有查看权限」；评审者（评审模式且没有编辑权限）与编辑中被降权「需要编辑权限」（降权取 readonlyDegraded 的原因）；
 * 其余（编辑者，含切到评审模式的编辑者）可用 → undefined。底座主菜单、MainMenuLayer 与底座 ⇧⌘E 同一规则
 */
export function exportReasonOf({ mode, canEdit, readonlyDegraded }: { mode?: "edit" | "review" | "viewer"; canEdit?: boolean; readonlyDegraded?: string }): string | undefined {
  if (mode === "viewer") return "只有查看权限"
  if (mode === "review" && canEdit === false) return "需要编辑权限"
  if (readonlyDegraded) return readonlyDegraded
  return undefined
}

/**
 * 主菜单「帮助」：命令面板与快捷键 ┊ 帮助中心（壳意图 help-center，TB-39）；inMaster 时多一项「关于母版继承」（TB-15，同走壳意图 help-center）。
 * rulings §4.25 DS-89：帮助中心与「关于母版继承」只在集成方配置了帮助链接时出现（configured，缺省 true），新标签页打开、右侧外链图标（kit Menu external）；
 * 什么都没配置时只剩「命令面板…」「键盘快捷键」（本地就能打开，始终保留）。开始页左栏的帮助菜单、账户菜单的「帮助中心」同一规则。
 * onCommandPalette / onShortcuts：选了「命令面板…」「键盘快捷键」（底座主菜单缺省发命令 help.command-palette / help.shortcuts，kit/commands.ts）
 */
export function helpItems(inMaster = false, o: { configured?: boolean; onCommandPalette?: () => void; onShortcuts?: () => void } = {}): MenuSpec[] {
  const configured = o.configured !== false
  return [
    // 命令面板（DS-11 Mod+K）不常驻在界面上：在「帮助」里写出它和快捷键，用户才知道有这个入口（第二入口不算重复，Q2）
    { id: "command-palette", label: "命令面板…", kbd: "⌘K", onSelect: o.onCommandPalette },
    { id: "shortcuts", label: "键盘快捷键", kbd: "⌘/", onSelect: o.onShortcuts },
    ...(configured
      ? ([
          { type: "separator" },
          { id: "center", label: "帮助中心", external: true },
          ...(inMaster ? ([{ id: "master-help", label: "关于母版继承", external: true }] as MenuSpec[]) : []),
        ] as MenuSpec[])
      : []),
  ]
}

/** 主菜单「插入」（03-04 定稿）：全部插入命令按工具条顺序排列，快捷键与工具条一致；是第二入口。 */
export const INSERT_ITEMS: MenuSpec[] = [
  { id: "text", label: "文本框", icon: <Type {...ICON} />, kbd: "T" },
  { id: "shapes", label: "形状库…", icon: <Shapes {...ICON} /> },
  {
    type: "sub",
    id: "image",
    label: "图片",
    icon: <ImageIcon {...ICON} />,
    items: [
      { id: "device", label: "此设备…" },
      { id: "url", label: "来自 URL…" },
      { type: "separator" },
      { id: "screenshot", label: "屏幕截图", tag: "M4+", disabled: true, reason: LATER },
      { id: "album", label: "相册", tag: "M4+", disabled: true, reason: LATER },
    ],
  },
  { id: "table", label: "表格…", icon: <Table {...ICON} /> },
  { id: "chart", label: "图表…", icon: <ChartColumn {...ICON} /> },
  { type: "separator" },
  { id: "icon", label: "图标…", icon: <Sticker {...ICON} /> },
  { id: "symbol", label: "符号…", icon: <Omega {...ICON} />, disabled: true, reason: "先在文本框中放置光标" },
  { id: "equation", label: "公式", icon: <Sigma {...ICON} />, tag: "M4+", disabled: true, reason: LATER },
  { id: "video", label: "视频", icon: <Video {...ICON} />, tag: "P2", disabled: true, reason: LATER },
  { id: "audio", label: "音频", icon: <AudioLines {...ICON} />, tag: "P2", disabled: true, reason: LATER },
  { type: "separator" },
  { id: "header-footer", label: "页眉和页脚…", icon: <PanelBottom {...ICON} /> },
  { id: "date", label: "日期和时间…", icon: <Calendar {...ICON} /> },
  { id: "slide-number", label: "幻灯片编号…", icon: <Hash {...ICON} /> },
  { type: "separator" },
  { id: "link", label: "链接…", icon: <Link2 {...ICON} />, kbd: "⇧⌘K" },
  { id: "comment", label: "评论", icon: <MessageSquare {...ICON} />, kbd: "C" },
  { type: "separator" },
  pluginGroupLabel("main-plugin-flow"),
  { id: "flow-node", label: "流程图节点", icon: <Workflow {...ICON} /> },
]

/** 主菜单「排列」：层级与组合（快捷键与右键菜单的「排列」一致，03-05 / 03-17）。 */
export const ARRANGE_ITEMS: MenuSpec[] = [
  { id: "front", label: "置于顶层", kbd: "⇧⌘]" },
  { id: "forward", label: "上移一层", kbd: "⌘]" },
  { id: "backward", label: "下移一层", kbd: "⌘[" },
  { id: "back", label: "置于底层", kbd: "⇧⌘[" },
  { type: "separator" },
  { id: "group", label: "组合", kbd: "⌘G" },
  { id: "ungroup", label: "取消组合", kbd: "⇧⌘G" },
]

export interface MainMenuOptions {
  view: V3View
  onView?: (v: V3View) => void
  notes: boolean
  onNotes?: (v: boolean) => void
  /** 模式：review / viewer 时改文档的命令不可用（评审模式下不可用），插入、排列整组不可用 */
  mode?: "edit" | "review" | "viewer"
  /** 有编辑权限（缺省 true）：评审者没有时「视图 › 模式 › 编辑」不可用并写原因 */
  canEdit?: boolean
  /** 选了「视图 › 模式」里的另一项（rulings §4.25 TB-83：同一状态里切换、不重新挂载；底座主菜单缺省接 EditorCtx.setMode） */
  onMode?: (m: "edit" | "review") => void
  /**
   * 编辑模式已降权（03-12 readonly-degraded，DS-15）：会话还在编辑界面里、但已没有编辑权限——改文档的命令不可用并写这个原因（不隐藏、仍可聚焦）：
   * 编辑 › 撤销 / 重做 / 剪切 / 粘贴 / 原位复制 / 删除 / 替换 / 重置页，插入、排列整组，母版视图；复制、全选、查找、导出、视图、插件、帮助照常。
   * 评审 / 浏览模式不用它（mode 已覆盖，原因写「评审模式下不可用」）。典型值「需要编辑权限」
   */
  readonlyDegraded?: string
  /** 母版视图条目：active 正在母版视图里（同一位置变成「关闭母版视图」，网格与备注不可用）；reason 不可用原因；onToggle 进入 / 退出 */
  master?: { active?: boolean; reason?: string; onToggle?: () => void }
  /** 换掉某个子菜单的条目 */
  file?: MenuSpec[]
  edit?: MenuSpec[]
  insert?: MenuSpec[]
  arrange?: MenuSpec[]
  help?: MenuSpec[]
  /** 「视图 › 网格与参考线 ▸」的当前值与改动回调（缺省：静态的缺省偏好） */
  gridGuides?: { prefs?: Partial<GridGuidePrefs>; onChange?: (patch: Partial<GridGuidePrefs>) => void }
  /** 「视图」里缩放之后、母版视图之前另加的条目 */
  viewExtra?: MenuSpec[]
  /** 「返回首页」：回到 #/v3/home（场景里静态打开的 MainMenuLayer 缺省就接好了） */
  onHome?: () => void
  /**
   * 渲染「返回首页」（缺省 true）。false：这一项连同其后的分隔线都不渲染——嵌入形态 E（iframe 里加载、URL 带 embedded=1）没有首页可回，
   * 没有对应能力的入口删去（DS-19；rulings §4.25 DS-112，宿主在 cordex:init 的 intents 里声明 navigate-back 时才出现，TB-145）。底座 MainMenu 与 MainMenuLayer 在 embedded 时传 false
   */
  home?: boolean
  /** 「插件…」：打开个人插件面板（03-09）；缺省发命令 plugins（场景用 useEditorCommand 接） */
  onPlugins?: () => void
  /** 「文件 › 导出…」：缺省发命令 file.export */
  onExport?: () => void
  /** 「文件 › 保真报告」：缺省发命令 file.fidelity（保真报告场景接住、打开检查器整栏面板） */
  onFidelity?: () => void
  /** 「视图 › 网格视图」暂不可用的原因（如检查器整栏面板开着：网格视图没有检查器栏，与左栏顶部的「单页 / 网格」同一原因） */
  gridReason?: string
  /** 「文件 › 导出…」不可用的原因（DS-105）：缺省按 mode / canEdit / readonlyDegraded 算（exportReasonOf）；显式给了以给的为准，null 为可用 */
  exportReason?: string | null
  /** 集成方配置了帮助链接（DS-89，缺省 true）：false 时「帮助」里没有「帮助中心」「关于母版继承」 */
  helpConfigured?: boolean
  /** 「帮助 › 命令面板…」「帮助 › 键盘快捷键」：缺省发命令 help.command-palette / help.shortcuts */
  onCommandPalette?: () => void
  onShortcuts?: () => void
}

/** 母版视图里普通视图的入口不可用时的原因（rulings §4.25 DS-157）：主菜单、文档菜单「版本历史」与头像组、在线列表的「跟随」（editor/chrome.tsx）同一句 */
export const UNAVAILABLE_IN_MASTER = "母版视图下不可用"

/** 母版视图里留在原位、不可用的子菜单条目：「文件 › 保真报告」打开普通视图的整栏面板，「编辑 › 重置页…」改的是幻灯片页 */
const OFF_IN_MASTER = new Set(["fidelity", "reset-slide"])

/**
 * 母版视图里把「文件」「编辑」里的普通视图入口改成不可用（rulings §4.25 DS-157、TB-203）：按条目 id 判，状态自己换掉的「文件」「编辑」条目同样生效；
 * 已因降权、评审或只读不可用的，原因也换成「母版视图下不可用」（TB-200：母版视图的原因在先，与命令面板同一次序）。选了无效（kit Menu 不调 onSelect）
 */
function offInMaster(items: MenuSpec[]): MenuSpec[] {
  return items.map((it) => ((it.type === undefined || it.type === "item") && OFF_IN_MASTER.has(it.id) ? { ...it, disabled: true, reason: UNAVAILABLE_IN_MASTER } : it))
}

/** 主菜单条目（统一的一份）。 */
export function mainMenuItems(o: MainMenuOptions): MenuSpec[] {
  const ro = o.mode === "review" || o.mode === "viewer"
  const roReason = o.mode === "viewer" ? "只有查看权限" : "评审模式下不可用"
  // 改文档的命令不可用的原因：评审 / 浏览模式，或编辑模式已降权（两者不会同时出现）
  const lockReason = ro ? roReason : o.readonlyDegraded
  const grid = o.view === "grid"
  const inMaster = !!o.master?.active
  const masterReason = o.master?.reason ?? lockReason
  const file = o.file ?? fileItems({ onExport: o.onExport, onFidelity: o.onFidelity, exportReason: o.exportReason === undefined ? exportReasonOf(o) : (o.exportReason ?? undefined) })
  const edit = o.edit ?? editItems({ readOnlyReason: lockReason })
  return [
    ...(o.home === false ? [] : ([{ id: "home", label: "返回首页", onSelect: o.onHome }, { type: "separator" }] as MenuSpec[])),
    { type: "sub", id: "file", label: "文件", items: inMaster ? offInMaster(file) : file },
    { type: "sub", id: "edit", label: "编辑", items: inMaster ? offInMaster(edit) : edit },
    {
      type: "sub",
      id: "view",
      label: "视图",
      items: [
        {
          type: "radio",
          id: "view-mode",
          value: o.view,
          onValueChange: (v) => o.onView?.(v === "grid" ? "grid" : "single"),
          options: [
            { value: "single", label: "单页视图" },
            inMaster
              ? { value: "grid", label: "网格视图", disabled: true, reason: UNAVAILABLE_IN_MASTER }
              : o.gridReason
                ? { value: "grid", label: "网格视图", disabled: true, reason: o.gridReason }
                : { value: "grid", label: "网格视图" },
          ],
        },
        { type: "separator" },
        inMaster
          ? { type: "checkbox", id: "notes", label: "备注", checked: false, disabled: true, reason: "母版视图下不显示" }
          : { type: "checkbox", id: "notes", label: "备注", checked: !grid && o.notes, disabled: grid, reason: "网格视图下不显示", onCheckedChange: o.onNotes },
        { type: "separator" },
        gridGuideSub(o.gridGuides?.prefs, o.gridGuides?.onChange),
        { type: "sub", id: "zoom", label: "缩放", items: ZOOM_COMMANDS },
        ...(o.viewExtra?.length ? ([{ type: "separator" }, ...o.viewExtra] as MenuSpec[]) : []),
        { type: "separator" },
        inMaster
          ? { id: "master", label: "关闭母版视图", kbd: "⌥⌘M", onSelect: o.master?.onToggle }
          : masterReason
            ? { id: "master", label: "母版视图", disabled: true, reason: masterReason }
            : { id: "master", label: "母版视图", kbd: "⌥⌘M", onSelect: o.master?.onToggle },
        // 模式（编辑 / 评审，03-02）：查看者没有模式可切换，不出现这一组
        ...(o.mode === "viewer"
          ? []
          : ([
              { type: "separator" },
              { type: "label", label: "模式" },
              {
                type: "radio",
                id: "mode",
                value: ro ? "review" : "edit",
                onValueChange: (v) => o.onMode?.(v === "edit" ? "edit" : "review"),
                options: [
                  o.canEdit === false ? { value: "edit", label: "编辑", disabled: true, reason: "需要编辑权限" } : { value: "edit", label: "编辑" },
                  { value: "review", label: "评审" },
                ],
              },
            ] as MenuSpec[])),
      ],
    },
    lockReason ? { type: "sub", id: "insert", label: "插入", disabled: true, reason: lockReason } : { type: "sub", id: "insert", label: "插入", items: o.insert ?? INSERT_ITEMS },
    lockReason ? { type: "sub", id: "arrange", label: "排列", disabled: true, reason: lockReason } : { type: "sub", id: "arrange", label: "排列", items: o.arrange ?? ARRANGE_ITEMS },
    { type: "separator" },
    // 个人插件面板（03-09，DS-18）：界面级插件的启停只影响自己，评审 / 浏览时照常可用；
    // 母版视图里留在原位、不可用（rulings §4.25 DS-157、TB-203：面板是普通视图的整栏面板，母版检查器不设插件页签）
    inMaster ? { id: "plugins", label: "插件…", disabled: true, reason: UNAVAILABLE_IN_MASTER } : { id: "plugins", label: "插件…", onSelect: o.onPlugins },
    { type: "separator" },
    {
      type: "sub",
      id: "help",
      label: "帮助",
      items: o.help ?? helpItems(inMaster, { configured: o.helpConfigured, onCommandPalette: o.onCommandPalette, onShortcuts: o.onShortcuts }),
    },
  ]
}

/**
 * 场景状态里打开的主菜单（放 layers）：锚在左栏左上的主菜单按钮下方、左对齐（与底座 MainMenu 同一位置与条目），openPath 静态展开某个子菜单。
 * 视图、备注读写编辑器状态，模式取 EditorConfig.mode；其余选项（各子菜单、母版视图、viewExtra）按需覆盖。
 *
 *   layers: <MainMenuLayer openPath={["view"]} />
 */
export function MainMenuLayer({
  openPath,
  onOpenChange,
  highlight,
  ...opts
}: {
  openPath?: string[]
  onOpenChange?: (open: boolean) => void
  /** 静态展开时把这一项设为当前项（键盘高亮，与用户用方向键停在它上面同一外观），如「母版视图」「评审」：一个状态只突出它要演示的那一项 */
  highlight?: string
} & Partial<MainMenuOptions>) {
  const ed = useEditor()
  const navigate = useNavigate()
  const run = useRunCommand()
  const { theme, accent, embedded } = useV3Params()
  // 「返回首页」先发底座命令 home（与底座 MainMenu 同一做法）：场景接住时不跳转；嵌入里（embedded）不渲染这一项（同底座 MainMenu）
  const onHome = () => {
    if (!run("home")) navigate(v3Href("/v3/home", { theme, accent }))
  }
  // 「插件…」「文件 › 导出… / 保真报告」「帮助 › 命令面板… / 键盘快捷键」缺省发底座命令（与底座 MainMenu 同一做法），场景显式传了回调时以传入的为准；
  // 「导出…」按权限置灰（DS-105）：模式、编辑权限与降权取编辑器当前值（场景显式传了 readonlyDegraded / canEdit 时以传入的为准）
  const commands = {
    onPlugins: () => void run("plugins"),
    onExport: () => void run("file.export"),
    onFidelity: () => void run("file.fidelity"),
    onCommandPalette: () => void run("help.command-palette"),
    onShortcuts: () => void run("help.shortcuts"),
    exportReason: exportReasonOf({ mode: opts.mode ?? ed.mode, canEdit: opts.canEdit ?? ed.canEdit, readonlyDegraded: opts.readonlyDegraded ?? ed.readonlyDegraded }) ?? null,
  }
  useEffect(() => {
    if (!highlight) return
    let tries = 0
    let id = 0
    // 子菜单挂上后（静态展开要等一两帧）找到这一项并聚焦：Radix 据此画高亮
    const find = () => {
      const items = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]'))
      const hit = items.reverse().find((el) => el.textContent?.trim().startsWith(highlight))
      if (hit) hit.focus({ preventScroll: true })
      else if (tries++ < 20) id = requestAnimationFrame(find)
    }
    id = requestAnimationFrame(find)
    return () => cancelAnimationFrame(id)
  }, [highlight])
  return (
    <Menu
      anchor="main-menu"
      side="bottom"
      align="start"
      sideOffset={4}
      label="主菜单"
      openPath={openPath}
      onOpenChange={onOpenChange}
      items={mainMenuItems({
        view: ed.view,
        onView: ed.setView,
        notes: ed.notes,
        onNotes: ed.setNotes,
        mode: ed.mode,
        onMode: ed.setMode,
        onHome,
        ...commands,
        ...(embedded ? { home: false } : null),
        ...opts,
        // 「视图 › 母版视图」与底座 MainMenu 同一套缺省（接宿主，原因以宿主的 entry 为准、显式传的 master 只补宿主没给的字段，editor/master/mode.ts masterMenuOption）
        master: masterMenuOption(ed.masterView, opts.master),
      })}
    />
  )
}
