import type { LucideIcon } from "lucide-react"
import { AppWindow, Atom, Check, CircleDashed, CircleOff, CircleX, FileX, Hourglass, Languages, LayoutDashboard, Library, OctagonAlert, QrCode, ShieldX, Sticker, Flame, Workflow } from "lucide-react"
import { CORE, DEPLOY, HOST_VERSION, MINE, type PluginInfo } from "../plugins/data"

/**
 * admin-plugins 场景的演示数据：管理 › 插件（03-32）看到的一次部署的全部声明。
 * 与第 2 批个人插件面板（scenarios/plugins/data.ts）是**同一次部署**：名称、版本、图标、作用域、贡献（已按 v3 改写的贡献点）都直接取那一份，
 * 这里只补管理员才看得到的字段（必需性、三态、部署级状态、依赖与互斥、信任来源、审计、配置）和个人面板里没有的 6 个声明
 * （已停用的模板库、流程图专业版、二维码形状，被拒的旧版数据看板、贴纸包、热力图覆盖层）。不再引用旧版 src/lib/plugin-data.ts。
 * 一共 24 个声明：已启用 16 · 已停用 3 · 等待依赖 1 · 启动失败 1 · 未通过部署校验 3（03-32 §2）。
 * 第三方插件（挂载目录）是 M4 才有的数据（03-32 §0）：样张按 03-32 把 M3 与 M4 画在同一页，M3 部署里只有内置插件。
 * 插件 id 一律用 cordis 插件 id（rulings §4.24 TA-5；rulings §4.25 TB-121）：即 40/16 §2 主表的单元名、50/03 §11.1「插件 id」列——
 * kernel、store-yjs、render-dom、slide-ui、slide-render-chart、comments、collab-offline-idb（model-slide、ooxml-pptx 的单元名本身是 @cordexjs/…）；
 * 个人面板那一份数据 2026-10-22 起也是插件 id（TB-121，03-09 §3「插件标识」同此；第 3 批转正第三段改），这里按 id 直接取（原来按包名取、经 CORDIS_ID 换成插件 id）。
 */
export { HOST_VERSION }
/** 页头元信息（rulings §4.24 TA-10：部署版本与宿主版本；PM-13 插件集指纹） */
export const DEPLOY_VERSION = "2026.10.1"
export const FINGERPRINT = "7f3a·c91e"
/** 声明文件路径（配置键 plugins.catalogFile，只读挂载，60/17 §5） */
export const CATALOG_FILE = "/etc/cordex/plugins.catalog.json"

/** 必需性（40/16 §2） */
export type Necessity = "kernel" | "contract" | "optional-degrade" | "optional-ext"
/** 管控三态（PM-03）：强制启用 / 允许用户选择 / 禁用 */
export type Policy = "forced" | "user-choice" | "disabled"
/** 部署级八种状态（PM-05 图 3-1） */
export type DeployStatus = "enabled" | "disabled" | "pending" | "failed" | "declared" | "incompatible" | "unsigned" | "invalid"
export type UserDefault = "on" | "off"

/** 信任来源（60/15 §3.15.1 AdminPluginDetail.trust） */
export type Trust =
  | { kind: "builtin" }
  | { kind: "signature"; vendor: string; fingerprint: string }
  | { kind: "review"; reviewer: string; date: string; sha256: string }
  | { kind: "unsigned" }

/** 最近策略变更（审计 plugin.policy_changed，新到旧；actor「系统」= 按声明文件初始化） */
export interface AuditEntry {
  at: string
  actor: string
  change: string
}

/** 插件配置（PM-09，M4）：由 Config schema 生成的字段；机密字段只写不读 */
export interface ConfigField {
  key: string
  label: string
  value: string
  hint?: string
  secret?: boolean
}

export interface AdminPlugin extends PluginInfo {
  necessity: Necessity
  /** 最近一次保存的策略（服务端） */
  policy: Policy
  /** 锁定：core 内核必需 / 契约必需（「核心组件」）· deploy 声明文件 lockPolicy（「部署锁定」） */
  lock?: "core" | "deploy"
  /** 声明文件里的状态：被拒三种与启动失败是部署事实；其余（已启用 / 已停用 / 等待依赖）由策略与依赖推出（见 store.ts deriveStatus） */
  status: DeployStatus
  /** 必需注入的服务与提供者（requires；可选注入不列） */
  injects?: { service: string; provider: string }[]
  /** 互斥：争用同一 Provider 座或注册同一 slide.shapeKind（conflictsWith） */
  mutex?: { with: string; key: string }[]
  /** 缺席后用户可见结果（50/03 §3） */
  absence?: string
  trust: Trust
  /** 近 24 h 客户端失败会话数（PM-15） */
  failures?: number
  /** 最近错误码与阶段（kernel.plugin_failed，details.phase，rulings §4.25 TB-77） */
  lastError?: { code: string; phase: "activate" | "contribution" }
  /** 被拒原因（说明行直接写原因，不重复状态名；反引号标出代码串） */
  reject?: string
  /** 被拒插件在声明文件里的初始状态：强制启用被拒 → 页顶被拒横幅（PM-05） */
  initialPolicy?: Policy
  audit?: AuditEntry[]
  config?: ConfigField[]
  /** 第三方且从未启用过：首次启用先弹确认卡（PM-06，M4） */
  neverEnabled?: boolean
  /** 非生产部署 plugins.allowUnsigned 放行的未签名插件（M4，03-32 §8.2）：按声明的初始状态装配，行下与详情标「未签名」 */
  unsignedAllowed?: boolean
}

/* ------------------------------------------------------------------ 状态、分组与文案 */

/** 必需性的文字按 40/16 §2 主表「必需性」列（TB-121）：契约必需写全「契约必需·可换」（Provider 可换，同 40/16 第 7、20 行） */
export const NECESSITY_LABEL: Record<Necessity, string> = {
  kernel: "内核必需",
  contract: "契约必需·可换",
  "optional-degrade": "可选·降级",
  "optional-ext": "可选扩展",
}

/** 策略的完整名称（读屏名、确认卡、详情）；三段控件里「允许用户选择」写短的「用户选择」 */
export const POLICY_LABEL: Record<Policy, string> = { forced: "强制启用", "user-choice": "允许用户选择", disabled: "禁用" }

/**
 * 八种部署级状态的图标与说明（03-32 §4.2；状态色只给图标，文字用主文字色，正常态不着色，rulings §4.25 DS-41）。
 * 图标与第 2 批个人插件面板同一套（DS-62 同一状态同一画法）：启动失败 CircleX、版本不兼容 OctagonAlert、等待依赖 Hourglass、已停用 CircleOff、已声明 CircleDashed；
 * 03-32 原写的「校验失败 · 禁止（Ban）」与「已停用」的圆圈斜线同形、只差颜色，改为 FileX（摘要、清单与声明不符）；未签名被拒 ShieldX。
 */
export const STATUS: Record<DeployStatus, { label: string; Icon: LucideIcon; danger?: boolean; hint: string }> = {
  failed: { label: "启动失败", Icon: CircleX, danger: true, hint: "服务端加载失败，或近 24 h 有 ≥ 5 个会话上报失败；不改变策略" },
  pending: { label: "等待依赖", Icon: Hourglass, hint: "校验通过，所依赖的插件被禁用或被拒；依赖恢复后自动启用" },
  enabled: { label: "已启用", Icon: Check, hint: "校验通过，策略为强制启用或允许用户选择" },
  disabled: { label: "已停用", Icon: CircleOff, hint: "校验通过，策略为禁用；任何会话都不装配" },
  declared: { label: "已声明", Icon: CircleDashed, hint: "部署启动时读到声明文件条目、校验尚未完成的瞬时状态" },
  incompatible: { label: "版本不兼容", Icon: OctagonAlert, danger: true, hint: "插件声明的宿主版本范围不含当前宿主" },
  unsigned: { label: "未签名被拒", Icon: ShieldX, danger: true, hint: "既无受信签名，也无审核记录" },
  invalid: { label: "校验失败", Icon: FileX, danger: true, hint: "摘要、清单、作用域或配置与声明不符" },
}

export const isRejected = (s: DeployStatus) => s === "incompatible" || s === "unsigned" || s === "invalid"
/** 没有策略控件、不进入任何会话的行：被拒三种 + 已声明（校验中，TB-119）——24 h 失败写「—」，不参与依赖、互斥与视同强制的推算 */
export const isInactive = (s: DeployStatus) => isRejected(s) || s === "declared"

/** 筛选 / 分组（需要处理的在前，八种状态归五组，03-32 §4.3 图 2）；danger：组名前带与状态同一个危险色图标（计数不着色） */
export type GroupKey = "failed" | "pending" | "enabled" | "disabled" | "rejected"
export type FilterKey = "all" | GroupKey
export const GROUPS: { key: GroupKey; label: string; match: (s: DeployStatus) => boolean; icon?: DeployStatus; note?: string }[] = [
  { key: "failed", label: "启动失败", match: (s) => s === "failed", icon: "failed" },
  { key: "pending", label: "等待依赖", match: (s) => s === "pending" },
  { key: "enabled", label: "已启用", match: (s) => s === "enabled" },
  { key: "disabled", label: "已停用", match: (s) => s === "disabled" || s === "declared" },
  {
    key: "rejected",
    label: "未通过部署校验",
    match: isRejected,
    icon: "incompatible",
    // 反引号里的是代码串（bits.tsx Rich 渲染成等宽）；分句用分号、句末不加句号（同其余行下说明，03-32 §3 原文）
    note: "被拒插件不进入任何会话，界面上没有开关与重试；启动日志已告警，`/readyz` 附 `pluginsRejected`；请由部署方修复后重新部署",
  },
]

/** 筛选分段的锚点（data-v3-anchor；原被拒横幅「只看被拒插件」随筛选消失时把焦点交给这里那一项，按钮随 rulings §4.25 DS-96 删去） */
export const FILTER_ANCHOR = "admin-plugins.filter"

/** 锁定与不可选的原因（工具提示与读屏名，03-32 §5.1、PRD PM-03） */
export const LOCK_REASON = { core: "核心组件，更换需修改部署", deploy: "由部署配置锁定（声明文件 lockPolicy）" } as const
export const LOCK_LABEL = { core: "核心组件", deploy: "部署锁定" } as const
export const USER_CHOICE_CONTENT = "会影响文档内容或渲染的插件按部署统一，只有强制启用与禁用两态"
export const REJECTED_POLICY_TIP = "被拒插件不进入任何会话；由部署方修复后重新部署才会改变"
/** 「已声明」行的策略（TB-119：只读，策略列写「校验中」、24 h 失败写「—」）：部署启动时读到的声明，校验完成前不装配、不能改策略 */
export const DECLARED_POLICY_TIP = "部署启动时读到的声明，校验尚未完成；校验通过后才能修改策略"
/**
 * 管理侧栏其余页、插件配置（随 SV-14 / PS-10 在 M4，禁用而不隐藏，rulings §4.20 FE-06）：原因写「后续版本提供」，与第 3 批其余不可用项同一句
 * （个人资料、回收站 M2、导出 PDF 一行）；里程碑只在 M4 标签里写一次
 */
export const M4_REASON = "后续版本提供"

/* ------------------------------------------------------------------ 24 个声明 */

/**
 * 个人面板那一份里的插件（同一次部署，按 cordis 插件 id 取：TA-5、TB-121，英文语言包按 50/03 §11.1「登记前以条目 id 充当」写 locale-packs）；
 * 万一找不到（不应发生）给一个占位，模块顶层不抛错
 */
const BY_ID = new Map([...CORE, ...DEPLOY, ...MINE].map((p) => [p.id, p]))
const base = (id: string): PluginInfo => {
  const p = BY_ID.get(id)
  return p ?? { id, name: id, version: "0.0.0", icon: Workflow, scope: "content", description: "", hostRange: HOST_VERSION, contributes: [] }
}

const BUILTIN: Trust = { kind: "builtin" }
const ACME_KEY: Trust = { kind: "signature", vendor: "ACME", fingerprint: "SHA256:3f:a2:9c:…:e1" }

/** 只在管理页出现的 6 个声明（个人面板不列已停用与被拒的插件，PRD 09 §5 非目标） */
const TEMPLATES: PluginInfo = { id: "cordex:templates", name: "模板库", version: "0.3.0", icon: Library, scope: "content", description: "组织共享的版式与页面模板", hostRange: "0.3", contributes: ["core.resource ×1", "ui.panel ×1"] }
const FLOW_PRO: PluginInfo = {
  id: "beta:flow-pro", name: "流程图专业版", version: "3.2.0", icon: Workflow, vendor: "Beta Labs", scope: "content", description: "泳道、自动布局与 BPMN 形状", hostRange: "0.3",
  contributes: ["slide.shapeKind ×58", "core.command ×4", "ui.toolbar ×1"],
}
const QR: PluginInfo = {
  id: "acme:qr-shape", name: "二维码形状", version: "1.0.0", icon: QrCode, vendor: "ACME", scope: "content", description: "把链接生成为可缩放的二维码元素", hostRange: "0.3",
  // 原 ui.ribbonButton 已作废（rulings §4.25 DS-5）：插件的创建类按钮只进工具条「更多」（ui.toolbar）
  // 能力声明只写声明了的（PS-13；与第 2 批个人面板同一写法「能力: 对象」，没有网络访问就不写 network）
  contributes: ["slide.shapeKind ×1", "core.command ×1", "ui.toolbar ×1"], capabilities: ["clipboard: write"],
}
const OLD_DASHBOARD: PluginInfo = { id: "beta:old-dashboard", name: "旧版数据看板", version: "0.9.0", icon: LayoutDashboard, vendor: "Beta Labs", scope: "content", description: "把看板嵌入为幻灯片元素", hostRange: "0.4–0.6", contributes: ["render.element ×1"] }
const STICKER: PluginInfo = { id: "misc:sticker-pack", name: "贴纸包", version: "0.2.0", icon: Sticker, vendor: "未知", scope: "content", description: "卡通贴纸形状", hostRange: "0.3", contributes: ["slide.shapeKind ×40"] }
const HEATMAP: PluginInfo = { id: "acme:heatmap", name: "热力图覆盖层", version: "0.5.0", icon: Flame, vendor: "ACME", scope: "ui", description: "在画布上叠加点击热力图", hostRange: "0.3", contributes: ["render.overlay ×1", "core.mutation ×1"] }

/**
 * 按声明文件的顺序（组内按此顺序排）。必需性按 40/16 §2（TB-121：评论是可选扩展）；
 * 幻灯片文档模型按核心组件锁定（TB-121，同 03-09 §3 的核心组件 4 个），必需性写「内核必需」——40/16 §2 第 8 行同此（「内核必需（slide 部署中不可排除）」，原「可选·降级」作废）
 */
export const CATALOG: AdminPlugin[] = [
  { ...base("kernel"), necessity: "kernel", policy: "forced", lock: "core", status: "enabled", trust: BUILTIN },
  { ...base("@cordexjs/model-slide"), necessity: "kernel", policy: "forced", lock: "core", status: "enabled", trust: BUILTIN, injects: [{ service: "kernel", provider: "kernel" }] },
  { ...base("store-yjs"), necessity: "contract", policy: "forced", lock: "core", status: "enabled", trust: BUILTIN },
  { ...base("render-dom"), necessity: "contract", policy: "forced", lock: "core", status: "enabled", trust: BUILTIN },
  { ...base("slide-ui"), necessity: "optional-degrade", policy: "forced", status: "enabled", trust: BUILTIN, absence: "编辑器只剩画布，可以阅读，不能通过界面编辑" },
  {
    ...base("@cordexjs/ooxml-pptx"), necessity: "optional-degrade", policy: "forced", status: "enabled", trust: BUILTIN, absence: "无法导入或导出 .pptx；已打开的文档不受影响",
    audit: [{ at: "2026-09-02 10:14", actor: "陈敏", change: "禁用 → 强制启用" }],
  },
  {
    ...base("slide-render-chart"), necessity: "optional-ext", policy: "forced", status: "enabled", trust: BUILTIN, absence: "图表显示为占位，图表数据原样保留",
    audit: [{ at: "2026-09-12 16:40", actor: "系统", change: "按声明文件初始化为强制启用" }],
  },
  { ...base("comments"), necessity: "optional-ext", policy: "forced", status: "enabled", trust: BUILTIN, absence: "评论入口隐藏；已有评论保留在文档里" },
  { ...base("collab-offline-idb"), necessity: "optional-ext", policy: "forced", lock: "deploy", status: "enabled", trust: BUILTIN, absence: "断网后更改不再暂存在浏览器" },
  { ...base("cordex:watermark"), necessity: "optional-ext", policy: "forced", status: "enabled", trust: BUILTIN },
  { ...base("locale-packs"), necessity: "optional-degrade", policy: "user-choice", status: "enabled", trust: BUILTIN },
  {
    ...base("cordex:presenter-laser"), necessity: "optional-ext", policy: "user-choice", status: "enabled", trust: BUILTIN,
    // 少数会话失败、没到「启动失败」的阈值（≥ 5，PM-15）：24 h 失败列写 2（加粗），状态仍是已启用（与第 2 批 plugins.failed 里本会话启动失败的同一个插件对得上）
    failures: 2, lastError: { code: "kernel.plugin_failed", phase: "contribution" },
    audit: [{ at: "2026-09-20 09:02", actor: "陈敏", change: "强制启用 → 允许用户选择（默认开）" }],
  },
  { ...base("cordex:focus-search"), necessity: "optional-ext", policy: "user-choice", status: "enabled", trust: BUILTIN },
  {
    ...base("cordex:word-count"), necessity: "optional-ext", policy: "user-choice", status: "enabled", trust: BUILTIN,
    audit: [{ at: "2026-09-20 09:05", actor: "陈敏", change: "用户默认 开 → 关" }],
  },
  {
    ...TEMPLATES, necessity: "optional-ext", policy: "disabled", status: "disabled", trust: BUILTIN, absence: "组织共享的版式与页面模板不可用；内置模板照常",
    audit: [{ at: "2026-09-18 14:22", actor: "陈敏", change: "强制启用 → 禁用" }],
  },
  {
    ...base("acme:data-binding"), necessity: "optional-ext", policy: "forced", status: "enabled", trust: ACME_KEY, failures: 0,
    injects: [
      { service: "render.element:chart", provider: "slide-render-chart" },
      { service: "store", provider: "store-yjs" },
    ],
    audit: [
      { at: "2026-09-28 11:05", actor: "陈敏", change: "禁用 → 强制启用（首次启用第三方）" },
      { at: "2026-09-27 17:30", actor: "系统", change: "按声明文件初始化为禁用（第三方插件缺省）" },
    ],
    config: [
      { key: "endpoint", label: "数据源地址", value: "https://api.acme.com/v2", hint: "图表拉取数据的 HTTPS 地址" },
      { key: "refresh", label: "刷新间隔", value: "每 15 分钟" },
      { key: "apiKey", label: "API 密钥", value: "***", secret: true, hint: "机密：只写不读，建议使用部署文件中的值" },
    ],
  },
  {
    ...base("acme:brand-kit"), necessity: "optional-ext", policy: "forced", status: "pending", trust: { kind: "review", reviewer: "刘洋", date: "2026-09-10", sha256: "9b1e…04c2" },
    injects: [{ service: "templates", provider: "cordex:templates" }],
  },
  {
    ...base("acme:flow-shapes"), necessity: "optional-ext", policy: "forced", status: "enabled", trust: ACME_KEY,
    mutex: [{ with: "beta:flow-pro", key: "flowchart" }],
  },
  {
    ...FLOW_PRO, necessity: "optional-ext", policy: "disabled", status: "disabled", trust: { kind: "review", reviewer: "刘洋", date: "2026-09-24", sha256: "51c0…aa7d" },
    mutex: [{ with: "acme:flow-shapes", key: "flowchart" }], neverEnabled: true,
  },
  { ...QR, necessity: "optional-ext", policy: "disabled", status: "disabled", trust: ACME_KEY, neverEnabled: true },
  {
    ...base("beta:live-poll"), necessity: "optional-ext", policy: "forced", status: "failed", trust: { kind: "review", reviewer: "刘洋", date: "2026-09-15", sha256: "0de4…71b9" },
    failures: 7, lastError: { code: "kernel.plugin_failed", phase: "activate" },
    audit: [{ at: "2026-09-16 10:20", actor: "陈敏", change: "禁用 → 强制启用（首次启用第三方）" }],
  },
  {
    ...OLD_DASHBOARD, necessity: "optional-ext", policy: "disabled", status: "incompatible", trust: { kind: "review", reviewer: "刘洋", date: "2026-06-02", sha256: "77aa…2f10" },
    reject: `需要宿主 0.4–0.6，当前 ${HOST_VERSION}`, initialPolicy: "disabled",
  },
  {
    ...STICKER, necessity: "optional-ext", policy: "forced", status: "unsigned", trust: { kind: "unsigned" },
    reject: "未找到有效签名或审核记录，请由部署方处理", initialPolicy: "forced",
  },
  {
    ...HEATMAP, necessity: "optional-ext", policy: "disabled", status: "invalid", trust: ACME_KEY,
    reject: "作用域声明为界面级，但贡献了 `core.mutation`「`heatmap.setData`」", initialPolicy: "disabled",
  },
]

/**
 * 「视同强制」（rulings §4.24 TA-6，50/03 §5.1）演示用的三行：内容级 ui-react 必需注入界面级 ui-core 提供的 ui / shortcuts / theme 与 i18n 提供的 i18n，
 * 只要 ui-react 在内容级集合里，ui-core 与 i18n 就不能排除。只加在 forced-by-dependency 这一态（免得改动第 2 批个人面板已拍板的计数），插在核心组件之后（40/16 §2 的声明顺序）。
 */
export const UI_STACK: AdminPlugin[] = [
  {
    id: "i18n", name: "国际化", version: "0.3.2", icon: Languages, scope: "ui", description: "界面文案与语言包的加载", hostRange: "0.3", contributes: ["i18n.bundle ×1"],
    necessity: "optional-degrade", policy: "forced", status: "enabled", trust: BUILTIN,
  },
  {
    id: "ui-core", name: "界面核心", version: "0.3.2", icon: AppWindow, scope: "ui", description: "界面贡献点、快捷键与主题服务", hostRange: "0.3", contributes: ["core.command ×6", "ui.command ×6"],
    necessity: "optional-degrade", policy: "forced", status: "enabled", trust: BUILTIN,
  },
  {
    id: "ui-react", name: "React 界面层", version: "0.3.2", icon: Atom, scope: "content", description: "用 React 渲染编辑器界面", hostRange: "0.3",
    contributes: ["ui.dialog ×4", "ui.notification ×4", "ui.shortcut ×4", "ui.command ×4", "i18n.bundle ×1"],
    necessity: "optional-degrade", policy: "forced", status: "enabled", trust: BUILTIN,
    injects: [
      { service: "ui", provider: "ui-core" },
      { service: "shortcuts", provider: "ui-core" },
      { service: "theme", provider: "ui-core" },
      { service: "i18n", provider: "i18n" },
    ],
  },
]

/** 来源（版本后面的那一段）：内置 / 第三方 · 供应商 */
export const sourceLabel = (p: PluginInfo) => (p.vendor ? `第三方 · ${p.vendor}` : "内置")
/** 来源的完整写法（详情「概要」）：镜像内置 / 挂载目录 · 供应商 */
export const sourceLong = (p: PluginInfo) => (p.vendor ? `挂载目录 · ${p.vendor}` : "镜像内置")
/** 内容级（含部署把界面级升为内容级的）：只有强制启用与禁用两态 */
export const isContentLevel = (p: PluginInfo) => p.scope === "content" || !!p.scopeUpgraded
/** 作用域文字 */
export const scopeLabel = (p: PluginInfo) => (p.scopeUpgraded ? "内容级 · 部署指定" : p.scope === "content" ? "内容级" : "界面级")
/** 锚点与 DOM 用的插件 id 片段（cordis 插件 id 含 @ / : 等字符） */
export const slug = (id: string) => id.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")
