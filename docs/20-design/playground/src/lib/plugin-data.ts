import type { ComponentType } from "react"
import {
  BarChart3, Blocks, Boxes, CalendarRange, Clock3, Cpu, Database, FileInput, Flame, Globe2, HardDriveDownload, Keyboard,
  LayoutTemplate, MessagesSquare, Palette, PanelsTopLeft, QrCode, ScanSearch, Shapes, Sticker, Stamp, Type, Vote, Workflow, Zap,
} from "lucide-react"

/**
 * 插件管理（PRD 09 PM-01…PM-16，rulings §4.23）的演示数据：一次部署（= 一个组织）的插件声明清单。
 * 管理员页（03-screens/32）与个人插件面板（03-screens/09）共用同一份清单，保证两处看到的是同一部署。
 * 宿主版本取 0.3（与 PS-07 版本不兼容文案「需要宿主 x.y–x.z，当前 a.b」一致）。
 */
export const HOST_VERSION = "0.3"
export const DEPLOY_VERSION = "2026.10.1"
export const PLUGIN_SET_FINGERPRINT = "7f3a·c91e"
export const CATALOG_FILE = "/etc/cordex/plugins.catalog.json"

/** PM-02 作用域：内容级按部署统一；界面级可由管理员开放给个人启停 */
export type PluginScope = "content" | "ui"
/** 40/16 §2 必需性 */
export type Necessity = "kernel" | "contract" | "optional-degrade" | "optional-ext"
/** PM-03 三态 */
export type Policy = "forced" | "user-choice" | "disabled"
/** PM-05 图 3-1 部署级八种状态 */
export type DeployStatus = "declared" | "unsigned" | "incompatible" | "invalid" | "disabled" | "pending" | "enabled" | "failed"

export interface AuditEntry {
  at: string
  actor: string
  change: string
}

export interface ConfigField {
  key: string
  label: string
  value: string
  description?: string
  secret?: boolean
}

export interface CatalogPlugin {
  id: string
  name: string
  version: string
  icon: ComponentType<{ className?: string }>
  /** PM-04 来源只有两种：镜像内置 / 挂载目录（第三方） */
  source: "builtin" | "mounted"
  vendor?: string
  scope: PluginScope
  /** 部署声明文件把 ui 升为 content（PM-02） */
  scopeUpgraded?: boolean
  necessity: Necessity
  policy: Policy
  /** 允许用户选择时的默认值 */
  userDefault?: "on" | "off"
  /** 声明文件写了 lockPolicy（PM-03） */
  lockPolicy?: boolean
  status: DeployStatus
  description: string
  hostRange: string
  /** 依赖：注入的服务与提供者 id */
  injects?: { service: string; providerId: string }[]
  /** 互斥：争用同一 Provider 座或同一 slide.shapeKind */
  mutexWith?: { id: string; reason: string }[]
  /** 50/03 §3 缺席后用户可见结果 */
  absence?: string
  contributes: { point: string; count: number }[]
  /** PS-13 能力声明（仅展示） */
  capabilities?: string[]
  trust: { kind: "builtin" | "signed" | "audited" | "none"; detail: string }
  failures24h?: number
  lastError?: string
  /** 被拒原因（三种被拒状态） */
  rejectReason?: string
  /** 被拒时声明文件里的初始状态（强制启用被拒 → 顶部红条，PM-05） */
  initialPolicy?: Policy
  audit?: AuditEntry[]
  /** PM-09 插件配置（M4） */
  config?: ConfigField[]
  /** 第三方且从未启用过：首次启用走确认卡（PM-06） */
  neverEnabled?: boolean
}

const builtinTrust = { kind: "builtin" as const, detail: "镜像内置 · 随镜像 digest 与 SBOM 受信" }

export const catalog: CatalogPlugin[] = [
  // —— 内核必需 / 契约必需：锁定为强制启用 ——
  {
    id: "@cordexjs/kernel", name: "内核", version: "0.3.2", icon: Cpu, source: "builtin", scope: "content", necessity: "kernel",
    policy: "forced", status: "enabled", description: "服务容器、Fiber 生命周期与贡献点注册", hostRange: "0.3",
    contributes: [{ point: "core.service", count: 9 }], trust: builtinTrust,
  },
  {
    id: "@cordexjs/model-slide", name: "幻灯片文档模型", version: "0.3.2", icon: Boxes, source: "builtin", scope: "content", necessity: "kernel",
    policy: "forced", status: "enabled", description: "幻灯片、母版、版式与元素的数据模型和 Mutation", hostRange: "0.3",
    injects: [{ service: "kernel", providerId: "@cordexjs/kernel" }],
    contributes: [{ point: "core.documentType", count: 1 }, { point: "core.mutation", count: 46 }, { point: "core.migration", count: 3 }], trust: builtinTrust,
  },
  {
    id: "@cordexjs/store-yjs", name: "协同存储（Yjs）", version: "0.3.2", icon: Database, source: "builtin", scope: "content", necessity: "contract",
    policy: "forced", status: "enabled", description: "Provider 座 store 的协同实现；备选 store-memory 在声明文件里二选一", hostRange: "0.3",
    contributes: [{ point: "provider.store", count: 1 }], trust: builtinTrust,
  },
  {
    id: "@cordexjs/render-dom", name: "DOM 渲染器", version: "0.3.2", icon: PanelsTopLeft, source: "builtin", scope: "content", necessity: "contract",
    policy: "forced", status: "enabled", description: "把渲染场景画到浏览器 DOM", hostRange: "0.3",
    contributes: [{ point: "render.target", count: 1 }], trust: builtinTrust,
  },
  // —— 可选·降级 / 可选扩展（第一方）——
  {
    id: "@cordexjs/slide-ui", name: "编辑器界面", version: "0.3.2", icon: LayoutTemplate, source: "builtin", scope: "ui", necessity: "optional-degrade",
    policy: "forced", status: "enabled", description: "Ribbon、缩略图栏、检查器与状态栏", hostRange: "0.3",
    absence: "编辑器只剩画布，可阅读、不可通过界面编辑",
    contributes: [{ point: "ui.ribbonTab", count: 6 }, { point: "ui.panel", count: 4 }, { point: "ui.statusBar", count: 3 }], trust: builtinTrust,
  },
  {
    id: "@cordexjs/ooxml-pptx", name: ".pptx 导入导出", version: "0.3.2", icon: FileInput, source: "builtin", scope: "content", necessity: "optional-degrade",
    policy: "forced", status: "enabled", description: "读取与写回 Office Open XML 演示文稿", hostRange: "0.3",
    absence: "无法导入或导出 .pptx；已打开的文档不受影响",
    contributes: [{ point: "core.format", count: 1 }], trust: builtinTrust,
    audit: [{ at: "2026-09-02 10:14", actor: "陈敏", change: "禁用 → 强制启用" }],
  },
  {
    id: "@cordexjs/slide-render-chart", name: "图表渲染", version: "0.3.1", icon: BarChart3, source: "builtin", scope: "content", necessity: "optional-ext",
    policy: "forced", status: "enabled", description: "柱形、折线、饼图的渲染与数据面板", hostRange: "0.3",
    absence: "图表显示为占位，图表数据原样保留",
    contributes: [{ point: "render.element", count: 5 }, { point: "slide.shapeKind", count: 1 }], trust: builtinTrust,
    audit: [{ at: "2026-09-12 16:40", actor: "陈敏", change: "声明初始状态 · 强制启用" }],
  },
  {
    id: "@cordexjs/comments", name: "评论", version: "0.3.2", icon: MessagesSquare, source: "builtin", scope: "content", necessity: "optional-degrade",
    policy: "forced", status: "enabled", description: "线程、@提及、解决与锚点", hostRange: "0.3",
    absence: "评论入口隐藏；已有评论保留在文档里",
    contributes: [{ point: "core.resource", count: 1 }, { point: "core.command", count: 6 }, { point: "ui.panel", count: 1 }], trust: builtinTrust,
  },
  {
    id: "@cordexjs/collab-offline-idb", name: "离线缓存", version: "0.3.0", icon: HardDriveDownload, source: "builtin", scope: "content", necessity: "optional-ext",
    policy: "forced", lockPolicy: true, status: "enabled", description: "把未同步的更改暂存在浏览器，恢复连接后提交", hostRange: "0.3",
    absence: "断网后更改不再本地暂存",
    contributes: [{ point: "provider.OfflineStore", count: 1 }], trust: builtinTrust,
  },
  {
    id: "cordex:watermark", name: "查看水印", version: "0.2.0", icon: Stamp, source: "builtin", scope: "ui", scopeUpgraded: true, necessity: "optional-ext",
    policy: "forced", status: "enabled", description: "在画布上叠加查看者姓名与时间", hostRange: "0.3",
    contributes: [{ point: "render.overlay", count: 1 }], trust: builtinTrust,
  },
  {
    id: "@cordexjs/i18n-en", name: "英文语言包", version: "0.3.2", icon: Globe2, source: "builtin", scope: "ui", necessity: "optional-degrade",
    policy: "user-choice", userDefault: "on", status: "enabled", description: "界面文案的 English 翻译", hostRange: "0.3",
    contributes: [{ point: "i18n.bundle", count: 1 }], trust: builtinTrust,
  },
  {
    id: "cordex:presenter-laser", name: "演示激光笔", version: "0.4.0", icon: Zap, source: "builtin", scope: "ui", necessity: "optional-ext",
    policy: "user-choice", userDefault: "on", status: "enabled", description: "放映时按住 L 显示激光点", hostRange: "0.3",
    contributes: [{ point: "render.overlay", count: 1 }, { point: "ui.shortcut", count: 1 }], trust: builtinTrust,
    audit: [{ at: "2026-09-20 09:02", actor: "陈敏", change: "强制启用 → 允许用户选择（默认开）" }],
  },
  {
    id: "cordex:focus-search", name: "聚焦搜索", version: "0.2.1", icon: ScanSearch, source: "builtin", scope: "ui", necessity: "optional-ext",
    policy: "user-choice", userDefault: "on", status: "enabled", description: "打开全局搜索浮窗（只读命令）", hostRange: "0.3",
    contributes: [{ point: "ui.command", count: 1 }, { point: "ui.shortcut", count: 1 }], trust: builtinTrust,
  },
  {
    id: "cordex:word-count", name: "字数统计", version: "0.1.3", icon: Type, source: "builtin", scope: "ui", necessity: "optional-ext",
    policy: "user-choice", userDefault: "off", status: "enabled", description: "状态栏显示本页与全文字数", hostRange: "0.3",
    contributes: [{ point: "ui.statusBar", count: 1 }], trust: builtinTrust,
  },
  {
    id: "cordex:templates", name: "模板库", version: "0.3.0", icon: Blocks, source: "builtin", scope: "content", necessity: "optional-ext",
    policy: "disabled", status: "disabled", description: "组织共享的版式与页面模板", hostRange: "0.3",
    absence: "「新建」只提供空白演示文稿与主题",
    contributes: [{ point: "core.resource", count: 1 }, { point: "ui.panel", count: 1 }], trust: builtinTrust,
    audit: [{ at: "2026-09-18 14:22", actor: "陈敏", change: "强制启用 → 禁用" }],
  },
  // —— 第三方（挂载目录，M4）——
  {
    id: "acme:data-binding", name: "数据图表增强", version: "1.4.2", icon: Workflow, source: "mounted", vendor: "ACME", scope: "content", necessity: "optional-ext",
    policy: "forced", status: "enabled", description: "为图表绑定外部数据源并定时刷新", hostRange: "0.3–0.4",
    injects: [{ service: "render.element:chart", providerId: "@cordexjs/slide-render-chart" }, { service: "store", providerId: "@cordexjs/store-yjs" }],
    contributes: [{ point: "core.command", count: 3 }, { point: "core.resource", count: 1 }, { point: "ui.ribbonTab", count: 1 }, { point: "ui.panel", count: 1 }],
    capabilities: ["network: api.acme.com", "storage: local"],
    trust: { kind: "signed", detail: "签名有效 · ACME 发布公钥 SHA256:3f:a2:9c:…:e1" },
    failures24h: 0,
    audit: [
      { at: "2026-09-28 11:05", actor: "陈敏", change: "禁用 → 强制启用（首次启用第三方）" },
      { at: "2026-09-27 17:30", actor: "system", change: "部署校验通过 · 1.4.2" },
    ],
    config: [
      { key: "endpoint", label: "数据源地址", value: "https://api.acme.com/v2", description: "图表拉取数据的 HTTPS 地址" },
      { key: "refresh", label: "刷新间隔", value: "每 15 分钟" },
      { key: "apiKey", label: "API 密钥", value: "***", secret: true, description: "机密：只写不读，建议使用部署文件中的值" },
    ],
  },
  {
    id: "acme:brand-kit", name: "品牌素材包", version: "2.0.0", icon: Palette, source: "mounted", vendor: "ACME", scope: "content", necessity: "optional-ext",
    policy: "forced", status: "pending", description: "组织标志、配色与版式素材", hostRange: "0.3",
    injects: [{ service: "templates", providerId: "cordex:templates" }],
    contributes: [{ point: "core.resource", count: 1 }, { point: "ui.panel", count: 1 }],
    trust: { kind: "audited", detail: "审核记录 · 刘洋 2026-09-10 · 钉住 SHA-256 9b1e…04c2" },
  },
  {
    id: "acme:flow-shapes", name: "流程图形状包", version: "1.1.0", icon: Shapes, source: "mounted", vendor: "ACME", scope: "content", necessity: "optional-ext",
    policy: "forced", status: "enabled", description: "32 种流程图形状与连接点", hostRange: "0.3",
    mutexWith: [{ id: "beta:flow-pro", reason: "都注册 slide.shapeKind「flowchart」" }],
    contributes: [{ point: "slide.shapeKind", count: 32 }, { point: "ui.gallery", count: 1 }],
    trust: { kind: "signed", detail: "签名有效 · ACME 发布公钥 SHA256:3f:a2:9c:…:e1" },
  },
  {
    id: "beta:flow-pro", name: "流程图专业版", version: "3.2.0", icon: Workflow, source: "mounted", vendor: "Beta Labs", scope: "content", necessity: "optional-ext",
    policy: "disabled", status: "disabled", description: "泳道、自动布局与 BPMN 形状", hostRange: "0.3",
    mutexWith: [{ id: "acme:flow-shapes", reason: "都注册 slide.shapeKind「flowchart」" }],
    contributes: [{ point: "slide.shapeKind", count: 58 }, { point: "core.command", count: 4 }, { point: "ui.ribbonTab", count: 1 }],
    trust: { kind: "audited", detail: "审核记录 · 刘洋 2026-09-24 · 钉住 SHA-256 51c0…aa7d" },
    neverEnabled: true,
  },
  {
    id: "acme:qr-shape", name: "二维码形状", version: "1.0.0", icon: QrCode, source: "mounted", vendor: "ACME", scope: "content", necessity: "optional-ext",
    policy: "disabled", status: "disabled", description: "把链接生成为可缩放的二维码元素", hostRange: "0.3",
    contributes: [{ point: "slide.shapeKind", count: 1 }, { point: "core.command", count: 1 }, { point: "ui.ribbonButton", count: 1 }],
    capabilities: ["network: 无", "clipboard: write"],
    trust: { kind: "signed", detail: "签名有效 · ACME 发布公钥 SHA256:3f:a2:9c:…:e1" },
    neverEnabled: true,
  },
  {
    id: "beta:live-poll", name: "现场投票", version: "0.9.1", icon: Vote, source: "mounted", vendor: "Beta Labs", scope: "content", necessity: "optional-ext",
    policy: "forced", status: "failed", description: "在幻灯片上插入投票并实时统计", hostRange: "0.3",
    contributes: [{ point: "slide.shapeKind", count: 1 }, { point: "core.command", count: 2 }, { point: "ui.panel", count: 1 }],
    capabilities: ["network: poll.betalabs.io"],
    trust: { kind: "audited", detail: "审核记录 · 刘洋 2026-09-15 · 钉住 SHA-256 0de4…71b9" },
    failures24h: 7, lastError: "plugin.activate_failed",
  },
  {
    id: "beta:old-dashboard", name: "旧版数据看板", version: "0.9.0", icon: CalendarRange, source: "mounted", vendor: "Beta Labs", scope: "content", necessity: "optional-ext",
    policy: "disabled", status: "incompatible", description: "把看板嵌入为幻灯片元素", hostRange: "0.4–0.6",
    contributes: [{ point: "render.element", count: 1 }],
    trust: { kind: "audited", detail: "审核记录 · 刘洋 2026-06-02 · 钉住 SHA-256 77aa…2f10" },
    rejectReason: `需要宿主 0.4–0.6，当前 ${HOST_VERSION}`, initialPolicy: "disabled",
  },
  {
    id: "misc:sticker-pack", name: "贴纸包", version: "0.2.0", icon: Sticker, source: "mounted", vendor: "未知", scope: "content", necessity: "optional-ext",
    policy: "forced", status: "unsigned", description: "卡通贴纸形状", hostRange: "0.3",
    contributes: [{ point: "slide.shapeKind", count: 40 }],
    trust: { kind: "none", detail: "未找到有效签名或审核记录" },
    rejectReason: "未找到有效签名或审核记录，请由部署方处理", initialPolicy: "forced",
  },
  {
    id: "acme:heatmap", name: "热力图覆盖层", version: "0.5.0", icon: Flame, source: "mounted", vendor: "ACME", scope: "ui", necessity: "optional-ext",
    policy: "disabled", status: "invalid", description: "在画布上叠加点击热力图", hostRange: "0.3",
    contributes: [{ point: "render.overlay", count: 1 }, { point: "core.mutation", count: 1 }],
    trust: { kind: "signed", detail: "签名有效 · ACME 发布公钥 SHA256:3f:a2:9c:…:e1" },
    rejectReason: "作用域声明为界面级，但贡献了 core.mutation「heatmap.setData」", initialPolicy: "disabled",
  },
]

/** 仅在个人面板「版本不兼容」演示中出现的会话级条目（客户端 plugin/incompatible，PS-07） */
export const sessionOnlyIncompatible: CatalogPlugin = {
  id: "acme:gantt", name: "甘特图", version: "0.7.0", icon: Clock3, source: "mounted", vendor: "ACME", scope: "content", necessity: "optional-ext",
  policy: "forced", status: "enabled", description: "时间轴与甘特图元素", hostRange: "0.4–0.5",
  contributes: [{ point: "render.element", count: 1 }], trust: { kind: "signed", detail: "签名有效" },
}

export const keyboardIcon = Keyboard

export function findPlugin(id: string) {
  return catalog.find((p) => p.id === id)
}

/** 被谁依赖（反查 injects） */
export function dependentsOf(id: string) {
  return catalog.filter((p) => p.injects?.some((i) => i.providerId === id))
}

export const isRejected = (s: DeployStatus) => s === "unsigned" || s === "incompatible" || s === "invalid"
export const isLocked = (p: CatalogPlugin) => p.necessity === "kernel" || p.necessity === "contract" || !!p.lockPolicy

export const necessityLabel: Record<Necessity, string> = {
  kernel: "内核必需",
  contract: "契约必需",
  "optional-degrade": "可选·降级",
  "optional-ext": "可选扩展",
}

export const policyLabel: Record<Policy, string> = {
  forced: "强制启用",
  "user-choice": "允许用户选择",
  disabled: "禁用",
}

export function sourceLabel(p: CatalogPlugin) {
  return p.source === "builtin" ? "内置" : `第三方 · ${p.vendor}`
}
