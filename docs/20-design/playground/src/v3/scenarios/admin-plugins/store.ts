import { useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { usePage, useSceneState } from "../../kit"
import { v3Href } from "../../params"
import { CATALOG, isContentLevel, isInactive, isRejected, POLICY_LABEL, UI_STACK, type AdminPlugin, type DeployStatus, type FilterKey, type Policy, type UserDefault } from "./data"

/**
 * admin-plugins 场景的页面状态（场景仓 useSceneState，换状态即复位）与派生计算。
 * 草稿模型同前端 50/03 §10.1：server（最近一次 GET /admin/plugins 的结果，这里用「声明 + 覆盖」表示）与 draft（只记改过的项，改回原值即删除）；
 * 行的显示值 = draft 覆盖 server。部署级状态由 server 推出（被拒与启动失败是部署事实，其余由策略与依赖推出，deriveStatus），草稿不改部署状态。
 * 依赖、互斥、视同强制按 50/03 §10.1 的派生态计算，只用于呈现与阻止保存；最终以服务端整批校验为准（422 / 409，save-item-errors 演示）。
 */

/**
 * 保存失败的三种（50/03 §10.1、50/02 §8）：network 网络或 5xx（未做任何更改）· conflict 412 设置已被他人更新（已重新载入、草稿保留并按新原值重算；
 * dropped 是新原值已与草稿相同、随之移出草稿的插件 id）· items 422 / 409 逐项报错（插件 id → 原因，整批未生效）
 */
export type SaveError = { kind: "network" } | { kind: "conflict"; by: string; dropped: string[] } | { kind: "items"; items: Record<string, string> }

/** 各状态的初值（page.data）：都可省 */
export interface AdminData {
  /** 清单加载：loading 加载中（DS-86 的加载行）· error 加载失败（DS-53 整块状态）；缺省已加载 */
  load?: "loading" | "error"
  filter?: FilterKey
  query?: string
  /** 草稿：策略 / 用户默认 */
  draft?: Record<string, Policy>
  draftDefaults?: Record<string, UserDefault>
  /** 服务端在声明之外的已保存值（保存成功、他人先保存了之后） */
  serverPolicy?: Record<string, Policy>
  serverDefaults?: Record<string, UserDefault>
  /** 详情抽屉开在哪个插件上（深链 ?plugin= 同此；URL 参数 plugin 优先，TB-76） */
  detail?: string
  /** 一出现就滚进可视区的行（详情、深链、用户默认下拉） */
  scrollTo?: string
  /** 变更确认卡开着 */
  confirm?: boolean
  saveError?: SaveError
  /** 点击当下的确认卡：禁用被依赖的插件 · 首次启用第三方（M4） */
  dep?: { id: string; to: Policy }
  first?: { id: string; to: Policy }
  /** 有草稿时离开的确认框开着 */
  leave?: boolean
  /** 「状态说明」弹层开着 */
  legend?: boolean
  /** 这一行的「用户默认 ▾」下拉开着 */
  menu?: string
  /** 刚保存成功的项数（轻提示） */
  saved?: number
  /** 非生产部署 plugins.allowUnsigned（M4） */
  allowUnsigned?: boolean
  /** 这几个插件还在「已声明」（部署启动时读到声明、校验尚未完成；TB-119：只读，策略「校验中」、24 h 失败「—」） */
  declared?: string[]
  /** 这几个被拒插件在声明文件里的初始状态改为强制启用（页顶多一条被拒横幅；unsigned-allowed 用它画出两条横幅叠放，DS-92） */
  declaredForced?: string[]
  /** 加上「视同强制」的三行（ui-core、i18n、ui-react） */
  uiStack?: boolean
  /** 草稿行的标法（DS-95）：dot 采纳 · tint 未采纳的备选 */
  draftStyle?: "dot" | "tint"
  /** 详情抽屉（DS-94）：true 模态（采纳）· false 无遮罩（未采纳的备选） */
  drawerModal?: boolean
}

const K = (k: string) => `admin-plugins.${k}`

type PolicyMap = Record<string, Policy>
type DefaultMap = Record<string, UserDefault>

export interface AdminApi {
  data: AdminData
  catalog: AdminPlugin[]
  find: (id: string) => AdminPlugin | undefined
  load: "ready" | "loading" | "error"
  /** 加载行是否已经出现（DS-86：超过 300 ms 才出现；静态状态一出现就有） */
  loadingShown: boolean
  retryLoad: () => void
  filter: FilterKey
  setFilter: (f: FilterKey) => void
  query: string
  setQuery: (q: string) => void
  serverPolicyOf: (p: AdminPlugin) => Policy
  policyOf: (p: AdminPlugin) => Policy
  serverDefaultOf: (p: AdminPlugin) => UserDefault
  defaultOf: (p: AdminPlugin) => UserDefault
  statusOf: (p: AdminPlugin) => DeployStatus
  /** 草稿里改过的插件（声明顺序） */
  changes: AdminPlugin[]
  isDraft: (p: AdminPlugin) => boolean
  /** 等待依赖的成因：服务端里被停用的提供者；restoring = 它们在草稿里都已改为启用（保存后将恢复） */
  pendingOn: (p: AdminPlugin) => { providers: AdminPlugin[]; restoring: boolean }
  /** 视同强制：必需注入它的、启用中的内容级插件（rulings §4.24 TA-6） */
  forcedBy: (p: AdminPlugin) => AdminPlugin[]
  /** 依赖它的插件（不论状态） */
  dependentsOf: (id: string) => AdminPlugin[]
  /** 依赖它、且草稿后仍启用的插件（禁用它会让这些进入等待依赖） */
  liveDependentsOf: (id: string) => AdminPlugin[]
  /** 草稿后的互斥对（两边都不是禁用、都没被拒） */
  mutexPairs: { a: AdminPlugin; b: AdminPlugin; key: string }[]
  mutexOf: (p: AdminPlugin) => { other: AdminPlugin; key: string }[]
  requestPolicy: (p: AdminPlugin, to: Policy) => void
  setPolicy: (p: AdminPlugin, to: Policy) => void
  setDefault: (p: AdminPlugin, v: UserDefault) => void
  enableDeps: (p: AdminPlugin) => void
  discard: () => void
  /** 变更确认卡 */
  confirm: boolean
  setConfirm: (v: boolean) => void
  saveError: SaveError | null
  save: () => void
  dep: { id: string; to: Policy } | null
  setDep: (v: { id: string; to: Policy } | null) => void
  first: { id: string; to: Policy } | null
  setFirst: (v: { id: string; to: Policy } | null) => void
  confirmFirst: () => void
  detail: string | null
  openDetail: (id: string) => void
  closeDetail: () => void
  leave: boolean
  setLeave: (v: boolean) => void
  /** 「返回首页」：有草稿时先弹确认（DS-59：应用内离开，初始焦点在「留下」） */
  requestLeave: () => void
  goHome: () => void
  legend: boolean
  setLegend: (v: boolean) => void
  toast: number | null
  setToast: (v: number | null) => void
  live: string
  /** 被拒且声明为强制启用（页顶被拒横幅，PM-05） */
  forcedRejected: AdminPlugin[]
  draftStyle: "dot" | "tint"
  drawerModal: boolean
}

/**
 * 部署级状态：被拒三种按声明（只能重新部署改变）、已声明按声明（校验完成前的瞬时状态）；其余按「服务端策略 + 依赖」推出——
 * 禁用 → 已停用；必需注入的提供者被禁用、被拒或还在校验 → 等待依赖；启动失败（服务端加载失败或 24 h ≥ 5 个会话）保留；否则已启用。
 */
function deriveStatus(p: AdminPlugin, policyOf: (q: AdminPlugin) => Policy, find: (id: string) => AdminPlugin | undefined): DeployStatus {
  if (isInactive(p.status)) return p.status
  if (policyOf(p) === "disabled") return "disabled"
  const blocked = (p.injects ?? []).some((i) => {
    const q = find(i.provider)
    return !q || isInactive(q.status) || policyOf(q) === "disabled"
  })
  if (blocked) return "pending"
  if (p.status === "failed") return "failed"
  return "enabled"
}

const without = <T,>(m: Record<string, T>, id: string) => {
  const next = { ...m }
  delete next[id]
  return next
}

export function useAdmin(): AdminApi {
  const { data: raw, theme, accent } = usePage()
  const data = raw as AdminData
  const navigate = useNavigate()
  const [sp] = useSearchParams()

  const catalog = useMemo(() => {
    let list = CATALOG
    if (data.uiStack) list = [...list.slice(0, 4), ...UI_STACK, ...list.slice(4)]
    if (data.allowUnsigned) list = list.map((p) => (p.status === "unsigned" ? { ...p, status: "enabled" as const, reject: undefined, unsignedAllowed: true } : p))
    const declared = data.declared ?? []
    if (declared.length) list = list.map((p) => (declared.includes(p.id) ? { ...p, status: "declared" as const } : p))
    const forced = data.declaredForced ?? []
    if (forced.length) list = list.map((p) => (forced.includes(p.id) && isRejected(p.status) ? { ...p, initialPolicy: "forced" as const } : p))
    return list
  }, [data.uiStack, data.allowUnsigned, data.declared, data.declaredForced])
  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog])
  const find = (id: string) => byId.get(id)

  // 深链 ?plugin=<pluginId>（rulings §4.25 TB-76，只在进页时读一次）：清单里有就打开它的详情抽屉、选中并滚进可视区（被拒的同样打开）；
  // 部署里没有这个插件时不开抽屉，把 id 填进搜索框（搜索无结果的提示照常）。URL 参数优先于状态数据
  const deep = sp.get("plugin") ?? data.detail ?? null
  const deepKnown = !!deep && byId.has(deep)

  const [load, setLoad] = useSceneState<"ready" | "loading" | "error">(K("load"), data.load ?? "ready")
  // 静态的加载态一出现就有加载行；「重试」进入的加载超过 300 ms 才出现（DS-86，DS-53）
  const [loadingShown, setLoadingShown] = useSceneState(K("loading-shown"), data.load === "loading")
  const [filter, setFilter] = useSceneState<FilterKey>(K("filter"), data.filter ?? "all")
  const [query, setQuery] = useSceneState(K("query"), deep && !deepKnown ? deep : (data.query ?? ""))
  const [server, setServer] = useSceneState<{ policy: PolicyMap; defaults: DefaultMap }>(K("server"), { policy: { ...data.serverPolicy }, defaults: { ...data.serverDefaults } })
  const [draft, setDraft] = useSceneState<{ policy: PolicyMap; defaults: DefaultMap }>(K("draft"), { policy: { ...data.draft }, defaults: { ...data.draftDefaults } })
  const [detail, setDetail] = useSceneState<string | null>(K("detail"), deepKnown ? deep : null)
  const [confirm, setConfirmRaw] = useSceneState(K("confirm"), !!data.confirm)
  const [saveError, setSaveError] = useSceneState<SaveError | null>(K("save-error"), data.saveError ?? null)
  const [dep, setDep] = useSceneState<{ id: string; to: Policy } | null>(K("dep"), data.dep ?? null)
  const [first, setFirst] = useSceneState<{ id: string; to: Policy } | null>(K("first"), data.first ?? null)
  const [enabledOnce, setEnabledOnce] = useSceneState<string[]>(K("enabled-once"), [])
  const [leave, setLeave] = useSceneState(K("leave"), !!data.leave)
  const [legend, setLegend] = useSceneState(K("legend"), !!data.legend)
  const [toast, setToast] = useSceneState<number | null>(K("toast"), data.saved ?? null)
  const [live, setLive] = useSceneState(K("live"), "")

  const serverPolicyOf = (p: AdminPlugin): Policy => server.policy[p.id] ?? p.policy
  const policyOf = (p: AdminPlugin): Policy => draft.policy[p.id] ?? serverPolicyOf(p)
  const serverDefaultOf = (p: AdminPlugin): UserDefault => server.defaults[p.id] ?? p.userDefault ?? "on"
  const defaultOf = (p: AdminPlugin): UserDefault => draft.defaults[p.id] ?? serverDefaultOf(p)
  const statusOf = (p: AdminPlugin) => deriveStatus(p, serverPolicyOf, find)
  const isDraft = (p: AdminPlugin) => p.id in draft.policy || p.id in draft.defaults
  const changes = catalog.filter(isDraft)

  const pendingOn = (p: AdminPlugin) => {
    const providers = (p.injects ?? []).map((i) => find(i.provider)).filter((q): q is AdminPlugin => !!q && (isInactive(q.status) || serverPolicyOf(q) === "disabled"))
    const unique = providers.filter((q, i) => providers.indexOf(q) === i)
    return { providers: unique, restoring: unique.length > 0 && unique.every((q) => !isInactive(q.status) && policyOf(q) !== "disabled") }
  }
  const forcedBy = (p: AdminPlugin) => {
    if (isContentLevel(p)) return []
    return catalog.filter((q) => isContentLevel(q) && !isInactive(q.status) && policyOf(q) !== "disabled" && (q.injects ?? []).some((i) => i.provider === p.id))
  }
  const dependentsOf = (id: string) => catalog.filter((q) => (q.injects ?? []).some((i) => i.provider === id))
  const liveDependentsOf = (id: string) => dependentsOf(id).filter((q) => !isInactive(q.status) && policyOf(q) !== "disabled")

  const mutexPairs: AdminApi["mutexPairs"] = []
  for (const p of catalog)
    for (const m of p.mutex ?? []) {
      const q = find(m.with)
      if (!q || p.id > q.id) continue
      if (isInactive(p.status) || isInactive(q.status)) continue
      if (policyOf(p) !== "disabled" && policyOf(q) !== "disabled") mutexPairs.push({ a: p, b: q, key: m.key })
    }
  const mutexOf = (p: AdminPlugin) => mutexPairs.filter((c) => c.a.id === p.id || c.b.id === p.id).map((c) => ({ other: c.a.id === p.id ? c.b : c.a, key: c.key }))

  /** 改策略进草稿（改回服务端的值即退出草稿）；离开「允许用户选择」时草稿里的用户默认一并作废（默认值只对允许用户选择有意义，03-32 §13） */
  const setPolicy = (p: AdminPlugin, to: Policy) => {
    setDraft((d) => {
      const policy = to === serverPolicyOf(p) ? without(d.policy, p.id) : { ...d.policy, [p.id]: to }
      const defaults = to === "user-choice" ? d.defaults : without(d.defaults, p.id)
      return { policy, defaults }
    })
    setLive(to === serverPolicyOf(p) ? `「${p.name}」改回${POLICY_LABEL[to]}，已移出未保存的变更` : `「${p.name}」改为${POLICY_LABEL[to]}，尚未保存`)
  }
  /** 点三段控件：两类改动先弹确认卡、确认后才进草稿（禁用被依赖的插件，03-32 §7.2；首次启用第三方，§7.3，M4） */
  const requestPolicy = (p: AdminPlugin, to: Policy) => {
    if (to === policyOf(p) || isInactive(p.status)) return
    if (to === "disabled" && liveDependentsOf(p.id).length > 0) return setDep({ id: p.id, to })
    if (policyOf(p) === "disabled" && p.vendor && p.neverEnabled && !enabledOnce.includes(p.id) && serverPolicyOf(p) === "disabled") return setFirst({ id: p.id, to })
    setPolicy(p, to)
  }
  const confirmFirst = () => {
    if (!first) return
    const p = find(first.id)
    if (p) {
      setEnabledOnce((xs) => [...xs, p.id])
      setPolicy(p, first.to)
    }
  }
  const setDefault = (p: AdminPlugin, v: UserDefault) => {
    setDraft((d) => ({ ...d, defaults: v === serverDefaultOf(p) ? without(d.defaults, p.id) : { ...d.defaults, [p.id]: v } }))
    setLive(`「${p.name}」的用户默认改为${v === "on" ? "开" : "关"}，尚未保存`)
  }
  /** 「一并启用」：把服务端里被停用的提供者在草稿里改为强制启用（03-32 §5.3、PM-07） */
  const enableDeps = (p: AdminPlugin) => {
    const { providers } = pendingOn(p)
    const ok = providers.filter((q) => !isInactive(q.status))
    setDraft((d) => ({ ...d, policy: { ...d.policy, ...Object.fromEntries(ok.map((q) => [q.id, "forced" as Policy])) } }))
    setLive(`${ok.map((q) => `「${q.name}」`).join("")}改为强制启用，尚未保存；保存后「${p.name}」将从等待依赖恢复`)
  }
  const discard = () => {
    setDraft({ policy: {}, defaults: {} })
    setLive("已放弃未保存的变更")
  }
  const setConfirm = (v: boolean) => {
    setConfirmRaw(v)
    if (!v) setSaveError(null)
  }
  /** 整批保存（PATCH /admin/plugins，If-Match）：样张里点「保存」一律成功——失败态由各状态的数据给出，再点即重试 */
  const save = () => {
    if (mutexPairs.length || !changes.length) return
    const n = changes.length
    setServer((s) => ({ policy: { ...s.policy, ...draft.policy }, defaults: { ...s.defaults, ...draft.defaults } }))
    setDraft({ policy: {}, defaults: {} })
    setSaveError(null)
    setConfirmRaw(false)
    setToast(n)
    setLive(`已保存 ${n} 项变更`)
  }
  const retryLoad = () => {
    setLoad("loading")
    setLoadingShown(false)
    window.setTimeout(() => setLoadingShown(true), 300)
    window.setTimeout(() => setLoad("ready"), 1100)
  }
  const goHome = () => navigate(v3Href("/v3/home", { theme, accent }))
  const requestLeave = () => {
    if (changes.length) setLeave(true)
    else goHome()
  }

  const forcedRejected = catalog.filter((p) => isRejected(p.status) && p.initialPolicy === "forced")

  return {
    data,
    catalog,
    find,
    load,
    loadingShown: load === "loading" && loadingShown,
    retryLoad,
    filter,
    setFilter,
    query,
    setQuery,
    serverPolicyOf,
    policyOf,
    serverDefaultOf,
    defaultOf,
    statusOf,
    changes,
    isDraft,
    pendingOn,
    forcedBy,
    dependentsOf,
    liveDependentsOf,
    mutexPairs,
    mutexOf,
    requestPolicy,
    setPolicy,
    setDefault,
    enableDeps,
    discard,
    confirm,
    setConfirm,
    saveError,
    save,
    dep,
    setDep,
    first,
    setFirst,
    confirmFirst,
    detail,
    openDetail: (id: string) => setDetail(id),
    closeDetail: () => setDetail(null),
    leave,
    setLeave,
    requestLeave,
    goHome,
    legend,
    setLegend,
    toast,
    setToast,
    live,
    forcedRejected,
    draftStyle: data.draftStyle ?? "dot",
    drawerModal: data.drawerModal ?? true,
  }
}
