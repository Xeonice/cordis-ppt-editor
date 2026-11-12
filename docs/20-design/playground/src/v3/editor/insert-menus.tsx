import type { ReactNode } from "react"
import {
  AudioLines, Calendar, Camera, GalleryHorizontalEnd, Hash, Link2, Omega, PanelBottom, Sigma, Sticker, Upload, Video, Workflow,
} from "lucide-react"
import { pluginGroupLabel } from "../kit/mainMenu"
import type { MenuSpec } from "../kit/Menu"
import { ICON } from "../ui"

/**
 * 工具条插入菜单的条目（底座唯一的一份；insert 场景 menus.tsx 转出同一份）。ribbon「插入」页签按 DS-1 拆开后的去处（03-04 七组）：
 *   - 文本框、形状、图片、表格、图表、评论：底部工具条各自的工具（图片 ▾ 见 IMAGE_MENU）；
 *   - 其余插入项进工具条「更多」（moreMenu）：页眉和页脚、日期和时间、幻灯片编号、符号、公式、图标、视频、音频、链接、插件贡献项；
 *   - 主菜单「插入」列出全部插入命令，是不常驻的第二入口（Q2 不算重复，kit/mainMenu.tsx INSERT_ITEMS）。
 * 禁用而不隐藏（rulings §4.20 FE-06）：条目留在原位、文字退到 text-3，右侧写短原因，完整原因走工具提示；里程碑标记（P2 / M4+）不变淡。
 */

const SYMBOL_OFF = "先在文本框中放置光标"
const LATER = "后续版本提供"

/**
 * 工具条「更多」：不在文本编辑态时，「日期和时间」「幻灯片编号」打开页眉和页脚对话框（右侧注明），「符号」禁用并说明原因；
 * 在文本编辑态时，「日期和时间…」打开格式选择器（03-16），「幻灯片编号」直接在光标处插入页码字段，「符号…」打开符号面板。
 */
export function moreMenu(editing: boolean): MenuSpec[] {
  return [
    { type: "label", label: "文本" },
    { id: "header-footer", label: "页眉和页脚…", icon: <PanelBottom {...ICON} /> },
    editing ? { id: "date", label: "日期和时间…", icon: <Calendar {...ICON} /> } : { id: "date", label: "日期和时间…", icon: <Calendar {...ICON} />, hint: "页眉和页脚" },
    editing
      ? { id: "slide-number", label: "幻灯片编号", icon: <Hash {...ICON} />, hint: "插入页码字段" }
      : { id: "slide-number", label: "幻灯片编号…", icon: <Hash {...ICON} />, hint: "页眉和页脚" },
    editing ? { id: "symbol", label: "符号…", icon: <Omega {...ICON} /> } : { id: "symbol", label: "符号…", icon: <Omega {...ICON} />, disabled: true, reason: SYMBOL_OFF },
    { id: "equation", label: "公式", icon: <Sigma {...ICON} />, tag: "M4+", disabled: true, reason: LATER },
    { type: "separator" },
    { type: "label", label: "插图" },
    { id: "icon", label: "图标…", icon: <Sticker {...ICON} /> },
    { id: "video", label: "视频", icon: <Video {...ICON} />, tag: "P2", disabled: true, reason: LATER },
    { id: "audio", label: "音频", icon: <AudioLines {...ICON} />, tag: "P2", disabled: true, reason: LATER },
    { type: "separator" },
    // 链接…（命令名统一为「链接…」、对话框「插入链接」，TB-6）⇧⌘K（DS-11：⌘K 是命令面板）
    { id: "link", label: "链接…", icon: <Link2 {...ICON} />, kbd: "⇧⌘K" },
    { type: "separator" },
    pluginGroupLabel("plugin-flow"),
    { id: "flow-node", label: "流程图节点", icon: <Workflow {...ICON} /> },
  ]
}

/**
 * 工具条「图片 ▾」：此设备…、来自 URL…（下载后内嵌，不保留外链；集成方可禁用），分隔线，屏幕截图、相册（M4+，禁用而不隐藏）。
 * 底部常驻说明另外两条插入路径（拖入画布、粘贴），它们不是菜单项。
 */
export const IMAGE_MENU: MenuSpec[] = [
  { id: "device", label: "此设备…", icon: <Upload {...ICON} />, hint: "可多选" },
  { id: "url", label: "来自 URL…", icon: <Link2 {...ICON} />, hint: "下载后内嵌" },
  { type: "separator" },
  { id: "screenshot", label: "屏幕截图", icon: <Camera {...ICON} />, tag: "M4+", disabled: true, reason: LATER },
  { id: "album", label: "相册", icon: <GalleryHorizontalEnd {...ICON} />, tag: "M4+", disabled: true, reason: LATER },
  { type: "separator" },
  { type: "note", text: "也可以把图片拖到画布上，或直接粘贴。" },
]

/* ------------------------------------------------------------------ 工具条打开的面板（按条目 id 登记） */

/**
 * 工具条与它的菜单打开的面板（对话框、弹层），由负责它的场景登记一次，任何状态里点真实的工具条都能打开（与 ui.inspectorSection 同一做法）：
 *   registerToolLayer("more:header-footer", HeaderFooterLayer)   // 「更多 › 页眉和页脚…」
 *   registerToolLayer("image:url", ImageUrlLayer)                 // 「图片 › 来自 URL…」
 *   registerToolLayer("table:dialog", InsertTableLayer)           // 表格网格 › 「插入表格…」
 *   registerToolLayer("chart", ChartToolMenu)                     // 工具条「图表」本身的类型菜单（受控：open / onOpenChange）
 * 面板组件拿到 open 与 onOpenChange：对话框类每次打开都重新挂载（open 恒为 true，关闭后自己收起），菜单类按 open 受控。
 * 没有登记的条目选了只关菜单。
 */
export interface ToolLayerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TOOL_LAYERS = new Map<string, (p: ToolLayerProps) => ReactNode>()

export function registerToolLayer(id: string, render: (p: ToolLayerProps) => ReactNode) {
  TOOL_LAYERS.set(id, render)
}

export function getToolLayer(id: string): ((p: ToolLayerProps) => ReactNode) | undefined {
  return TOOL_LAYERS.get(id)
}
