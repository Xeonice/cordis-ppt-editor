import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical,
  AlignVerticalDistributeCenter, ArrowUpDown, Blocks, BoxSelect, BringToFront, Captions, ClipboardPaste, ClipboardType, Copy, CopyPlus, Crop, Eye, EyeOff, Grid3x3,
  Group, ImageDown, LayoutTemplate, Link, MessageSquarePlus, MousePointerClick, Play, Plus, Replace, RotateCcw, RotateCw, Scissors, Shapes, SquareDashedMousePointer, Trash2,
  Ungroup, Workflow,
} from "lucide-react"
import { gridGuideSub, ICON, PASTE_VARIANTS, type MenuSpec } from "../../kit"

/**
 * 右键菜单的条目（03-05）：画布空白处、形状、文本、缩略图、组合、图片、媒体（视频 / 音频）、连接符、多选、节标题。
 * 通用规则：剪贴板一组在最前；删除类用危险色、单独一组；插件贡献项在末尾「插件」分组（分隔线 + 归属）；
 * 快捷键右对齐（取自 03-24）；不可用项留在原位、文字退到 text-3，右侧写原因；一组项原因相同时改用菜单顶部一行说明（03-05 §2.3，rulings §4.25 TB-22）。
 */

const SEP: MenuSpec = { type: "separator" }

const CUT: MenuSpec = { id: "cut", label: "剪切", icon: <Scissors {...ICON} />, kbd: "⌘X" }
const COPY: MenuSpec = { id: "copy", label: "复制", icon: <Copy {...ICON} />, kbd: "⌘C" }
const PASTE: MenuSpec = { id: "paste", label: "粘贴", icon: <ClipboardPaste {...ICON} />, kbd: "⌘V" }
const DUPLICATE: MenuSpec = { id: "duplicate", label: "原位复制", icon: <CopyPlus {...ICON} />, kbd: "⌘D" }
const COMMENT: MenuSpec = { id: "comment", label: "添加评论", icon: <MessageSquarePlus {...ICON} />, kbd: "C" }
const DELETE: MenuSpec = { id: "delete", label: "删除", icon: <Trash2 {...ICON} />, kbd: "⌫", danger: true }

const ARRANGE: MenuSpec = {
  type: "sub",
  id: "arrange",
  label: "排列",
  icon: <BringToFront {...ICON} />,
  items: [
    { id: "front", label: "置于顶层", kbd: "⇧⌘]" },
    { id: "forward", label: "上移一层", kbd: "⌘]" },
    { id: "backward", label: "下移一层", kbd: "⌘[" },
    { id: "back", label: "置于底层", kbd: "⇧⌘[" },
  ],
}

const ROTATE: MenuSpec = {
  type: "sub",
  id: "rotate",
  label: "旋转",
  icon: <RotateCw {...ICON} />,
  items: [
    { id: "cw", label: "向右旋转 90°" },
    { id: "ccw", label: "向左旋转 90°" },
    SEP,
    { id: "flip-h", label: "水平翻转" },
    { id: "flip-v", label: "垂直翻转" },
  ],
}

/**
 * 对齐与分布（03-17 §5）：六向对齐、横向 / 纵向等距分布（需 3 个以上对象）、参照「所选对象 / 页面」（单选时固定为页面）。
 * 条目名称与检查器对齐行同一组命令标题（左对齐 · 水平居中 · 右对齐 · 顶对齐 · 垂直居中 · 底对齐，rulings §4.25 TB-20）。
 */
export function alignMenu(count: number): MenuSpec {
  const few = count < 3
  return {
    type: "sub",
    id: "align",
    label: "对齐与分布",
    icon: <AlignStartVertical {...ICON} />,
    items: [
      { id: "left", label: "左对齐", icon: <AlignStartVertical {...ICON} /> },
      { id: "h-center", label: "水平居中", icon: <AlignCenterVertical {...ICON} /> },
      { id: "right", label: "右对齐", icon: <AlignEndVertical {...ICON} /> },
      { id: "top", label: "顶对齐", icon: <AlignStartHorizontal {...ICON} /> },
      { id: "v-center", label: "垂直居中", icon: <AlignCenterHorizontal {...ICON} /> },
      { id: "bottom", label: "底对齐", icon: <AlignEndHorizontal {...ICON} /> },
      SEP,
      { id: "dist-h", label: "横向分布", icon: <AlignHorizontalDistributeCenter {...ICON} />, disabled: few, reason: few ? "需选中 3 个以上对象" : undefined },
      { id: "dist-v", label: "纵向分布", icon: <AlignVerticalDistributeCenter {...ICON} />, disabled: few, reason: few ? "需选中 3 个以上对象" : undefined },
      SEP,
      { type: "label", label: "对齐参照" },
      {
        type: "radio",
        id: "align-ref",
        value: count > 1 ? "selection" : "page",
        options: [
          { value: "selection", label: "所选对象", disabled: count < 2, reason: count < 2 ? "单选时固定为页面" : undefined },
          { value: "page", label: "页面" },
        ],
      },
    ],
  }
}

/** P2 等后续版本的条目：留在原位、不可用、挂 P2 标记并写这个原因（禁用而不隐藏，rulings §4.20 FE-06） */
const LATER = "后续版本提供"

/**
 * 形状选中（单个，03-05 §3「形状」，rulings §4.25 TB-18）：剪贴板 ┊ 排列 ▸ · 旋转 ▸ · 更改形状 ▸ · 组合 ┊ 链接… · 操作设置… · 编辑替代文本… · 添加评论 ┊ 删除 ┊ 插件。
 * 「更改形状 ▸」是 PRD ED-05 的 M2 P1（展开形状库的图库，只列形状；选一项即换几何、保留文字与样式，50/22 §2.4），未开放前留在原位、不可用并写原因；
 * 「链接…」打开「插入链接」对话框（TB-6），「操作设置…」与检查器「操作」一行同一对话框（03-15），「编辑替代文本…」把焦点交给检查器的替代文本（TB-32）。
 */
export const SHAPE_MENU: MenuSpec[] = [
  CUT,
  COPY,
  PASTE,
  DUPLICATE,
  SEP,
  ARRANGE,
  ROTATE,
  { type: "sub", id: "change-shape", label: "更改形状", icon: <Shapes {...ICON} />, disabled: true, reason: LATER },
  { id: "group", label: "组合", icon: <Group {...ICON} />, kbd: "⌘G", disabled: true, reason: "需选中 2 个以上对象" },
  SEP,
  { id: "link", label: "链接…", icon: <Link {...ICON} />, kbd: "⇧⌘K" },
  { id: "action", label: "操作设置…", icon: <MousePointerClick {...ICON} /> },
  { id: "alt", label: "编辑替代文本…", icon: <Captions {...ICON} /> },
  COMMENT,
  SEP,
  DELETE,
  SEP,
  { type: "label", label: "插件" },
  { id: "plugin-source", label: "设置数据源…", icon: <Blocks {...ICON} />, hint: "数据图表增强" },
]

/**
 * 文本编辑态里选中文字。字体在检查器「文本 · 字体」分区（DS-1），这里不再放「字体…」。
 * 「粘贴为纯文本」与主菜单「编辑 › 粘贴选项」同为 P2（rulings §4.25 TB-19，快捷键 ⇧⌘V 按 DS-29 登记为 P2）：留在原位、不可用、标 P2；
 * 链接命令统一叫「链接…」（TB-6，与工具条「更多」、主菜单「插入」同名，对话框标题「插入链接」）。
 */
export const TEXT_MENU: MenuSpec[] = [
  CUT,
  COPY,
  PASTE,
  { id: "paste-plain", label: "粘贴为纯文本", icon: <ClipboardType {...ICON} />, kbd: "⇧⌘V", tag: "P2", disabled: true, reason: LATER },
  SEP,
  { id: "link", label: "链接…", icon: <Link {...ICON} />, kbd: "⇧⌘K" },
  COMMENT,
]

/**
 * 画布空白处（03-05 §3）：粘贴 ·（粘贴选项 ▸，P2）· 全选 ┊ 网格与参考线 ▸ · 更换版式… · 重置页… ┊ 添加评论 C ┊ 插件。
 * 「粘贴选项 ▸」与主菜单「编辑」同一组变体（03-19 §1.3），M2 留在原位、不可用、标 P2；「网格与参考线」是 03-17 的设置入口，标尺与可拖出的参考线 P2，灰显占位不隐藏。
 * 「添加评论 C」单独一组、排在插件分组之前（rulings §4.25 DS-44，2026-10-15）：与按 C 相同，进入评论工具（键盘 ⇧F10 / 菜单键打开的是同一份）；
 * 条目本身不带动作，用的地方用 withComment 接上（第 1 批 context-menu.canvas 进入评论工具，第 2 批评论场景接着在当前页放页级临时钉、打开撰写框）。
 */
export const CANVAS_MENU: MenuSpec[] = [
  PASTE,
  { type: "sub", id: "paste-special", label: "粘贴选项", icon: <ClipboardType {...ICON} />, tag: "P2", disabled: true, reason: LATER, items: PASTE_VARIANTS },
  { id: "select-all", label: "全选", icon: <BoxSelect {...ICON} />, kbd: "⌘A" },
  SEP,
  // 「网格与参考线 ▸」与主菜单「视图」同一张清单（kit gridGuideSub：03-20 显示 + 03-17 吸附）
  gridGuideSub(undefined, undefined, <Grid3x3 {...ICON} />),
  { id: "layout", label: "更换版式…", icon: <LayoutTemplate {...ICON} /> },
  { id: "reset", label: "重置页…", icon: <RotateCcw {...ICON} /> },
  SEP,
  COMMENT,
  SEP,
  { type: "label", label: "插件" },
  { id: "plugin-flow", label: "插入流程图节点", icon: <Workflow {...ICON} />, hint: "ACME 流程图" },
]

/** 把菜单里的「添加评论」（id comment）接上动作，其余条目原样（DS-44：右键「添加评论 C」与按 C 相同，进入评论工具） */
export function withComment(items: MenuSpec[], onSelect: () => void): MenuSpec[] {
  return items.map((it) => ((it.type === undefined || it.type === "item") && it.id === "comment" ? { ...it, onSelect } : it))
}

/** 缩略图（单页左栏与网格同一份）：条目收进底座（editor/thumb-menu.tsx），真实右键与静态状态同一份。 */
export { thumbMenu } from "../../editor/thumb-menu"

/** 组合选中（03-05 新增变体）：取消组合拆一层；进入组合编辑等价于双击（03-17）。 */
export const GROUP_MENU: MenuSpec[] = [
  CUT,
  COPY,
  PASTE,
  DUPLICATE,
  SEP,
  { id: "ungroup", label: "取消组合", icon: <Ungroup {...ICON} />, kbd: "⇧⌘G" },
  { id: "enter", label: "进入组合编辑", icon: <SquareDashedMousePointer {...ICON} />, hint: "双击" },
  ARRANGE,
  SEP,
  COMMENT,
  SEP,
  DELETE,
]

const GROUP_NEEDS_TWO: MenuSpec = { id: "group", label: "组合", icon: <Group {...ICON} />, kbd: "⌘G", disabled: true, reason: "需选中 2 个以上对象" }
const ALT_TEXT: MenuSpec = { id: "alt", label: "编辑替代文本…", icon: <Captions {...ICON} /> }

/**
 * 图片选中（03-05 补充「图片右键」+ 03-18）：剪贴板一组在前；裁剪、替换图片（保留位置、尺寸与裁剪范围）、重置图片（撤销全部裁剪与调整）；
 * 排列、旋转（含翻转）、组合（单选不可用）；编辑替代文本…、另存为图片（P2，禁用而不隐藏）、添加评论；删除单独一组。没有插件分组：插件只给形状贡献命令。
 */
export const IMAGE_MENU: MenuSpec[] = [
  CUT,
  COPY,
  PASTE,
  DUPLICATE,
  SEP,
  { id: "crop", label: "裁剪", icon: <Crop {...ICON} /> },
  { id: "replace", label: "替换图片…", icon: <Replace {...ICON} /> },
  { id: "reset", label: "重置图片", icon: <RotateCcw {...ICON} /> },
  SEP,
  ARRANGE,
  ROTATE,
  GROUP_NEEDS_TWO,
  SEP,
  ALT_TEXT,
  { id: "save-as", label: "另存为图片…", icon: <ImageDown {...ICON} />, tag: "P2", disabled: true, reason: LATER },
  COMMENT,
  SEP,
  DELETE,
]

/**
 * 已有视频 / 音频选中（03-05 补充「媒体右键」+ 03-18「视频与音频（已有媒体）」）：播放（临时播放，选中后 ↵ 等价，不写入文档）、替换海报…（M2 P1）、裁剪（P2，禁用而不隐藏）；
 * 可移动、缩放、旋转（没有翻转）、删除、改替代文本；其余同图片。
 */
export const MEDIA_MENU: MenuSpec[] = [
  CUT,
  COPY,
  PASTE,
  DUPLICATE,
  SEP,
  { id: "play", label: "播放", icon: <Play {...ICON} />, kbd: "↵" },
  { id: "poster", label: "替换海报…", icon: <Replace {...ICON} /> },
  { id: "crop", label: "裁剪", icon: <Crop {...ICON} />, tag: "P2", disabled: true, reason: LATER },
  SEP,
  ARRANGE,
  {
    type: "sub",
    id: "rotate",
    label: "旋转",
    icon: <RotateCw {...ICON} />,
    items: [
      { id: "cw", label: "向右旋转 90°" },
      { id: "ccw", label: "向左旋转 90°" },
    ],
  },
  GROUP_NEEDS_TWO,
  SEP,
  ALT_TEXT,
  COMMENT,
  SEP,
  DELETE,
]

/**
 * 连接符选中（03-05 补充「连接符右键」+ 03-17 G-39）：只留剪贴板、排列、组合与评论、删除——位置与大小由两端的连接点决定，所以没有旋转 / 翻转，
 * 连接状态在检查器里看、拖离端点即断开（不另设菜单项，Q2 入口唯一）；也没有替代文本与插件分组。
 */
export const CONNECTOR_MENU: MenuSpec[] = [CUT, COPY, PASTE, DUPLICATE, SEP, ARRANGE, GROUP_NEEDS_TWO, SEP, COMMENT, SEP, DELETE]

/** 多选（03-05 交集规则）：只留全部选中对象都支持的命令；替代文字这类逐个对象的命令不出现。 */
export function multiMenu(count: number): MenuSpec[] {
  return [CUT, COPY, PASTE, DUPLICATE, SEP, alignMenu(count), ARRANGE, { id: "group", label: "组合", icon: <Group {...ICON} />, kbd: "⌘G" }, SEP, COMMENT, SEP, DELETE]
}

/** 节标题行（M2 只能折叠 / 展开；新增、重命名、排序 M3）。 */
export function sectionMenu(collapsed: boolean): MenuSpec[] {
  return [
    collapsed ? { id: "expand", label: "展开此节" } : { id: "collapse", label: "折叠此节" },
    SEP,
    { id: "collapse-all", label: "全部折叠" },
    { id: "expand-all", label: "全部展开" },
    SEP,
    { type: "note", text: "节的新增、重命名与排序将在后续版本提供" },
  ]
}

/**
 * 只读（评审模式，03-05「禁用而不隐藏」）：条目与编辑模式相同，编辑类命令留在原位、禁用；查看类（复制、全选、网格与参考线）
 * 与「添加评论」（评审者有评论权限）照常可用。同一原因的一组禁用项共用菜单顶部一行常驻说明，不逐项写原因。
 * 2026-10-15 上移到 kit（无法显示的对象的右键在评审、只读浏览与降权下也用它，rulings §4.25 DS-64），这里转出，引用处不变
 */
export { readOnlyMenu } from "../../kit"
