import type { LucideIcon } from "lucide-react"
import {
  Boxes, ChartColumn, ChartGantt, Cpu, Database, DatabaseZap, FileInput, Globe, HardDriveDownload, LayoutTemplate, MessagesSquare, Palette,
  PanelsTopLeft, QrCode, ScanSearch, Shapes, Stamp, Type, Vote, Zap,
} from "lucide-react"

/**
 * plugins 场景的演示数据：一次部署（= 一个组织）在本会话装配的插件（03-09 个人插件面板，PRD 09 PM-10…PM-12）。
 * 与旧版样张（src/lib/plugin-data.ts）同一份部署，按 v3 改正：ui.ribbon / ui.statusBar 已删除（rulings §4.25 DS-5、DS-6），
 * 贡献改写为 ui.toolbar（「更多」）、ui.inspectorSection、ui.panel、ui.command；「字数统计」改为命令 + 对话框（PRD 04 PS-04）。
 * 宿主版本取 0.3（与 PS-07「需要宿主 x.y–x.z，当前 a.b」一致）。
 * 插件 id 一律是 cordis 插件 id（rulings §4.24 TA-5、§4.25 TB-121，与管理页 admin-plugins 同一份）：即 40/16 §2 主表的单元名、50/03 §11.1「插件 id」列——
 * kernel、store-yjs、render-dom、slide-ui、slide-render-chart、comments、collab-offline-idb；model-slide、ooxml-pptx 的单元名本身是 @cordexjs/…；
 * 英文语言包按 50/03 §11.1「登记前以条目 id 充当」写 locale-packs（40/16 第 31 行「语言包」还没登记单元名）；第三方与 cordex:* 原样。
 * 2026-10-22 第 3 批转正第三段由包名（@cordexjs/kernel 等）改成插件 id（TB-121 定个人插件面板的显示随回写一并改）：行与核心组件展开后的「id@版本」、
 * 「复制诊断信息」复制的 plugin: 一行、去管理页的深链 plugin= 都是这一份 id。
 */
export const HOST_VERSION = "0.3"

/** 作用域（PM-02）：内容级按部署统一；界面级可由管理员开放给个人启停 */
export type Scope = "content" | "ui"

/** 本会话状态（03-09 §3.1 SessionStatusText 的六种，外加「重试中」这一瞬时态） */
export type SessionStatus = "running" | "pending" | "failed" | "lazy" | "incompatible" | "off" | "retrying"

export interface PluginInfo {
  id: string
  name: string
  version: string
  icon: LucideIcon
  /** 第三方供应商；不写即「内置」 */
  vendor?: string
  scope: Scope
  /** 插件声明为界面级，部署声明文件把它升为内容级（作用域徽标「内容级 · 部署指定」） */
  scopeUpgraded?: boolean
  /** 允许用户选择时管理员给的默认值（只在「我的界面插件」里） */
  userDefault?: "on" | "off"
  /** 一句话说明（行副标题） */
  description: string
  /** 声明支持的宿主版本 */
  hostRange: string
  /** 贡献（展开详情「贡献」行），如「ui.toolbar ×1」 */
  contributes: string[]
  /** 能力声明（PS-13，仅展示） */
  capabilities?: string[]
  /** 声明了写能力位的命令：只读角色下「编辑类命令不可用」（03-09 §4.5） */
  writeCommands?: boolean
  /** 等待依赖时依赖的插件名（被管理员停用） */
  waitsFor?: string
}

/** 核心组件：内核必需与契约必需，合成一行「核心组件 4 个 · 内置」（03-09 §3） */
export const CORE: PluginInfo[] = [
  { id: "kernel", name: "内核", version: "0.3.2", icon: Cpu, scope: "content", description: "服务容器、Fiber 生命周期与贡献点注册", hostRange: "0.3", contributes: ["core.command ×6"] },
  { id: "@cordexjs/model-slide", name: "幻灯片文档模型", version: "0.3.2", icon: Boxes, scope: "content", description: "幻灯片、母版、版式与元素的数据模型", hostRange: "0.3", contributes: ["core.documentType ×1", "core.mutation ×46"] },
  { id: "store-yjs", name: "协同存储（Yjs）", version: "0.3.2", icon: Database, scope: "content", description: "Provider 座 store 的协同实现", hostRange: "0.3", contributes: ["实现 store"] },
  { id: "render-dom", name: "DOM 渲染器", version: "0.3.2", icon: PanelsTopLeft, scope: "content", description: "把渲染场景画到浏览器 DOM", hostRange: "0.3", contributes: ["render.target ×1", "render.overlay ×3"] },
]

/** 本部署统一启用（内容级 + 管理员强制启用的界面级），按部署声明顺序 */
export const DEPLOY: PluginInfo[] = [
  {
    id: "slide-ui", name: "编辑器界面", version: "0.3.2", icon: LayoutTemplate, scope: "ui", description: "底部工具条、缩略图栏、检查器与菜单", hostRange: "0.3",
    contributes: ["ui.toolbar ×23", "ui.inspectorSection ×68", "ui.panel ×8", "ui.shortcut ×70"],
  },
  { id: "@cordexjs/ooxml-pptx", name: ".pptx 导入导出", version: "0.3.2", icon: FileInput, scope: "content", description: "读取与写回 Office Open XML 演示文稿", hostRange: "0.3", contributes: ["core.format ×1"] },
  { id: "slide-render-chart", name: "图表渲染", version: "0.3.1", icon: ChartColumn, scope: "content", description: "柱形、折线、饼图的渲染与数据面板", hostRange: "0.3", contributes: ["render.element ×1"] },
  {
    id: "comments", name: "评论", version: "0.3.2", icon: MessagesSquare, scope: "content", description: "线程、@提及、解决与锚点", hostRange: "0.3",
    contributes: ["core.resource ×1", "core.command ×6"], writeCommands: true,
  },
  { id: "collab-offline-idb", name: "离线缓存", version: "0.3.0", icon: HardDriveDownload, scope: "content", description: "未同步的更改暂存在浏览器，恢复连接后提交", hostRange: "0.3", contributes: ["实现 offlineStore"] },
  { id: "cordex:watermark", name: "查看水印", version: "0.2.0", icon: Stamp, scope: "ui", scopeUpgraded: true, description: "在画布上叠加查看者姓名与时间", hostRange: "0.3", contributes: ["render.overlay ×1"] },
  {
    id: "acme:data-binding", name: "数据图表增强", version: "1.4.2", icon: DatabaseZap, vendor: "ACME", scope: "content", description: "为图表绑定外部数据源并定时刷新", hostRange: "0.3–0.4",
    contributes: ["core.command ×3", "core.resource ×1", "ui.inspectorSection ×2"], capabilities: ["network: api.acme.com", "storage: local"], writeCommands: true,
  },
  {
    id: "acme:flow-shapes", name: "流程图形状包", version: "1.1.0", icon: Shapes, vendor: "ACME", scope: "content", description: "32 种流程图形状与连接点", hostRange: "0.3",
    contributes: ["slide.shapeKind ×32", "ui.toolbar ×5"], writeCommands: true,
  },
  {
    id: "acme:brand-kit", name: "品牌素材包", version: "2.0.0", icon: Palette, vendor: "ACME", scope: "content", description: "组织标志、配色与版式素材", hostRange: "0.3",
    contributes: ["core.resource ×1", "ui.panel ×1", "ui.toolbar ×1"], waitsFor: "模板库",
  },
  {
    id: "beta:live-poll", name: "现场投票", version: "0.9.1", icon: Vote, vendor: "Beta Labs", scope: "content", description: "在幻灯片上插入投票并实时统计", hostRange: "0.3",
    contributes: ["slide.shapeKind ×1", "core.command ×2", "ui.toolbar ×1", "ui.inspectorSection ×1", "ui.panel ×1"], capabilities: ["network: poll.betalabs.io"], writeCommands: true,
  },
]

/** 只在「本会话版本不兼容」演示中出现（客户端 plugin/incompatible，PS-07）：通过了部署校验，但本会话加载时报告不兼容 */
export const GANTT: PluginInfo = {
  id: "acme:gantt", name: "甘特图", version: "0.7.0", icon: ChartGantt, vendor: "ACME", scope: "content", description: "时间轴与甘特图元素", hostRange: "0.4–0.5", contributes: ["render.element ×1", "ui.toolbar ×2"],
}

/** 我的界面插件（管理员设为「允许用户选择」的界面级插件） */
export const MINE: PluginInfo[] = [
  { id: "locale-packs", name: "英文语言包", version: "0.3.2", icon: Globe, scope: "ui", userDefault: "on", description: "界面文案的 English 翻译", hostRange: "0.3", contributes: ["i18n.bundle ×1"] },
  { id: "cordex:presenter-laser", name: "演示激光笔", version: "0.4.0", icon: Zap, scope: "ui", userDefault: "on", description: "放映时按住 L 显示激光点", hostRange: "0.3", contributes: ["render.overlay ×1", "ui.shortcut ×1"] },
  { id: "cordex:focus-search", name: "聚焦搜索", version: "0.2.1", icon: ScanSearch, scope: "ui", userDefault: "on", description: "打开全局搜索浮窗（只读命令）", hostRange: "0.3", contributes: ["ui.command ×1", "ui.shortcut ×1"] },
  { id: "cordex:word-count", name: "字数统计", version: "0.1.3", icon: Type, scope: "ui", userDefault: "off", description: "在命令面板里查看本页与全文字数", hostRange: "0.3", contributes: ["ui.command ×1", "ui.dialog ×1"] },
]

export const findPlugin = (id: string): PluginInfo | undefined => [...DEPLOY, ...MINE, ...CORE, GANTT].find((p) => p.id === id)

export const sourceLabel = (p: PluginInfo) => (p.vendor ? `第三方 · ${p.vendor}` : "内置")

/**
 * 本会话失败的诊断（03-09 §4.1）：不含文档内容。
 * 错误码按架构 30/10 的登记（rulings §4.25 TB-77）：启动与贡献失败都是 kernel.plugin_failed，details.phase 取 activate / contribution 区分——
 * 失败详情里另写一行「阶段」（启动 / 贡献）；原演示码 plugin.activate_failed、plugin.contribution_failed 作废。
 * 「复制诊断信息」复制四行（TB-96）：插件 id（plugin: id@版本）、错误码（code）、阶段（phase: activate / contribution，界面写「启动 / 贡献」）、traceId
 */
export interface Diagnostic {
  code: string
  /** details.phase：activate 启动 · contribution 贡献 */
  phase: "activate" | "contribution"
  summary: string
  traceId: string
}

/** 失败详情里「阶段」一行的写法 */
export const PHASE_LABEL: Record<Diagnostic["phase"], string> = { activate: "启动", contribution: "贡献" }

export const DIAGNOSTICS: Record<string, Diagnostic> = {
  "beta:live-poll": { code: "kernel.plugin_failed", phase: "activate", summary: "激活超时：投票服务 poll.betalabs.io 在 10 s 内无响应", traceId: "4bf92f3577b34da6a3ce929d0e0e4736" },
  "cordex:presenter-laser": { code: "kernel.plugin_failed", phase: "contribution", summary: "render.overlay 贡献在初始化时抛出异常", traceId: "a1c05e7f0b9d4c2e8f6a3b1d2c4e5f60" },
}

/* ------------------------------------------------------------------ 本文档缺少的插件（PM-12，03-09 §6.3） */

export type MissingReason = "disabled" | "undeclared" | "version"

export interface MissingEntry {
  id: string
  name: string
  icon?: LucideIcon
  reason: MissingReason
  need: string
  have?: string
  count: number
  pages: string
}

/** 多个插件同时缺失（missing-detail）：三种原因各一条；第 5 页两处、第 6 页三处，与缩略图警示计数一致 */
export const MISSING: MissingEntry[] = [
  { id: "acme:qr-shape", name: "二维码形状", icon: QrCode, reason: "disabled", need: "1.0", count: 3, pages: "第 6 页" },
  { id: "acme:org-chart", name: "组织架构图", reason: "undeclared", need: "2.0", count: 1, pages: "第 5 页" },
  { id: "acme:data-binding", name: "数据图表增强", icon: DatabaseZap, reason: "version", need: "1.5", have: "1.4.2", count: 1, pages: "第 5 页" },
]

export const MISSING_REASON: Record<MissingReason, string> = {
  disabled: "管理员已停用",
  undeclared: "本部署没有此插件",
  version: "版本过旧",
}

/* ------------------------------------------------------------------ 快捷键冲突（PM-11，03-09 §4.4） */

export interface ConflictInfo {
  key: string
  builtin: string
  pluginId: string
  /** 冲突一方能不能由用户关闭：界面级可选插件能（「为我关闭」），内容级或强制启用的不能（「请联系管理员」） */
  userCanTurnOff: boolean
}

export const CONFLICTS: Record<"user" | "locked", ConflictInfo> = {
  user: { key: "⌘−", builtin: "缩小", pluginId: "cordex:focus-search", userCanTurnOff: true },
  locked: { key: "⌥⌘M", builtin: "母版视图", pluginId: "acme:flow-shapes", userCanTurnOff: false },
}

/* ------------------------------------------------------------------ 现场投票（ui.panel slot 'inspector' 的示例） */

export const POLL = {
  question: "下半年最想先落地哪一项？",
  options: [
    { label: "拓展企业客户", votes: 54 },
    { label: "提升交付效率", votes: 40 },
    { label: "优化产品体验", votes: 24 },
    { label: "其他", votes: 10 },
  ],
  link: "poll.betalabs.io/7KQ2",
  elapsed: "已进行 12 分钟",
}

export const POLL_TOTAL = POLL.options.reduce((a, o) => a + o.votes, 0)
export const pct = (v: number) => Math.round((v / POLL_TOTAL) * 100)
