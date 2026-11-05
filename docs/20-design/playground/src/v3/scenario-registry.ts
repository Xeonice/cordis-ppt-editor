/// <reference types="vite/client" />
import type { EditorCommand } from "./kit/commands"
import type { V3Accent, V3EditorState, V3Host, V3Theme } from "./params"
import { hostPath, V3_EDITOR_STATES, V3_HOSTS } from "./params"
import { mergeConfig, mergePage, type EditorConfig, type EditorMode, type PageConfig, type Scenario, type ScenarioState } from "./scenarios/types"

/**
 * 场景注册表：自动发现 src/v3/scenarios/ 下所有 *.scenario.tsx（默认导出 defineScenario({...})），
 * 解析 URL 的 state 参数，生成场景链接。编辑器（Editor.tsx）、页面宿主（PageHost.tsx，第 3 批）与 Hub 分组（HubGroup.tsx）共用。
 */
const modules = import.meta.glob<{ default?: Scenario }>("./scenarios/**/*.scenario.tsx", { eager: true })

const ID_RE = /^_?[a-z0-9]+(?:-[a-z0-9]+)*$/
const STATE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SPEC_RE = /^\d{2}-\d{2}$/

function collect(): Scenario[] {
  const seen = new Map<string, string>()
  const out: Scenario[] = []
  for (const [file, mod] of Object.entries(modules)) {
    const s = mod.default
    if (!s || typeof s !== "object" || !Array.isArray(s.states)) {
      console.error(`[v3 场景] ${file} 没有默认导出 defineScenario({...})，已跳过`)
      continue
    }
    const problems: string[] = []
    if (!ID_RE.test(s.id)) problems.push(`场景 id「${s.id}」须为小写 kebab-case（可以「_」开头），不能含「.」`)
    if (seen.has(s.id)) problems.push(`场景 id「${s.id}」与 ${seen.get(s.id)} 重复`)
    if (!s.states.length) problems.push("至少要有一个状态")
    for (const sp of s.specs ?? []) if (!SPEC_RE.test(sp)) problems.push(`界面规格编号「${sp}」应写成 03-21 这样`)
    const stateIds = new Set<string>()
    const hostOk = (h: string | undefined) => h === undefined || (V3_HOSTS as readonly string[]).includes(h)
    if (!hostOk(s.host)) problems.push(`宿主「${s.host}」不在 ${V3_HOSTS.join(" / ")} 之内`)
    for (const st of s.states) {
      if (!STATE_RE.test(st.id)) problems.push(`状态 id「${st.id}」须为小写 kebab-case`)
      if (stateIds.has(st.id)) problems.push(`状态 id「${st.id}」重复`)
      if (!hostOk(st.host)) problems.push(`状态「${st.id}」的宿主「${st.host}」不在 ${V3_HOSTS.join(" / ")} 之内`)
      stateIds.add(st.id)
    }
    if (problems.length) console.error(`[v3 场景] ${file}：\n  ${problems.join("\n  ")}`)
    if (seen.has(s.id)) continue
    seen.set(s.id, file)
    out.push(s)
  }
  return out.sort((a, b) => (a.batch ?? 1) - (b.batch ?? 1) || (a.specs[0] ?? "99").localeCompare(b.specs[0] ?? "99") || a.id.localeCompare(b.id))
}

/** 全部场景（含隐藏的 _kit），按批次、界面规格编号、id 排序。 */
export const SCENARIOS: Scenario[] = collect()

export const findScenario = (id: string): Scenario | undefined => SCENARIOS.find((s) => s.id === id)

/** 状态的宿主：状态写了的优先，其次场景的，缺省 editor（第 1、2 批的全部场景） */
export const stateHost = (scenario: Scenario, state: ScenarioState): V3Host => state.host ?? scenario.host ?? "editor"

/**
 * 声明演示某个底座命令的场景状态（Scenario.provides）：编辑器与页面宿主的命令兜底用（kit/commands.ts setCommandFallback）；
 * 按模式分开写的取当前模式的（缺的取 edit 的）；第 3 批转正起还可以按宿主写（如偏好设置 { edit: "default", home: "from-home" }：开始页上转到叠在开始页上的那一态），
 * 给了 host 且写了这个宿主时优先取它
 */
export function providerOf(cmd: EditorCommand, mode: EditorMode = "edit", host?: V3Host): { scenario: Scenario; state: ScenarioState } | undefined {
  for (const scenario of SCENARIOS) {
    const v = scenario.provides?.[cmd]
    const id = typeof v === "string" ? v : ((host ? v?.[host] : undefined) ?? v?.[mode] ?? v?.edit)
    const state = id ? scenario.states.find((x) => x.id === id) : undefined
    if (state) return { scenario, state }
  }
  return undefined
}

/** Hub 展示的场景：某一批、未隐藏、id 不以「_」开头。 */
export function hubScenarios(batch: 1 | 2 | 3 = 1): Scenario[] {
  return SCENARIOS.filter((s) => (s.batch ?? 1) === batch && !s.hidden && !s.id.startsWith("_"))
}

/** 旧的四个状态（Hub「设计语言 v3 样张」分组的链接）：行为与改造前一致。 */
export const LEGACY_STATES: Record<V3EditorState, EditorConfig> = {
  empty: { slide: 2, selection: "none" },
  shape: { slide: 2, selection: "shape" },
  text: { slide: 1, selection: "text" },
  "shapes-menu": { slide: 2, selection: "shape", toolbar: { tool: "shapes", shapesOpen: true } },
}

export interface ResolvedState {
  /** 编辑器的 React key：换状态时整个编辑器重新挂载，初始状态重新生效 */
  key: string
  /** 这个状态属于别的宿主（第 3 批的页面级宿主）：编辑器转到这个链接（参数原样带上） */
  redirect?: V3Host
  scenarioId: string
  stateId: string
  scenario?: Scenario
  state?: ScenarioState
  /** 合并后的编辑器配置（场景级 + 状态级） */
  config: EditorConfig
  /** state 参数写错时的说明（编辑器顶部显示错误横幅，并退回 empty） */
  error?: string
}

/** 解析 URL 的 state 参数：旧的四个取值、<场景>.<状态>、或只写 <场景>（取第一个状态）。 */
export function resolveEditorState(raw: string | null): ResolvedState {
  const legacy = (V3_EDITOR_STATES as readonly string[]).includes(raw ?? "") ? (raw as V3EditorState) : null
  if (raw === null || legacy) {
    const st = legacy ?? "empty"
    return { key: st, scenarioId: "legacy", stateId: st, config: LEGACY_STATES[st] }
  }
  const dot = raw.indexOf(".")
  const sid = dot < 0 ? raw : raw.slice(0, dot)
  const stid = dot < 0 ? "" : raw.slice(dot + 1)
  const scenario = findScenario(sid)
  const state = scenario && (stid ? scenario.states.find((x) => x.id === stid) : scenario.states[0])
  if (scenario && state) {
    const host = stateHost(scenario, state)
    if (host !== "editor") return { key: `${scenario.id}.${state.id}`, scenarioId: scenario.id, stateId: state.id, scenario, state, config: LEGACY_STATES.empty, redirect: host }
    return { key: `${scenario.id}.${state.id}`, scenarioId: scenario.id, stateId: state.id, scenario, state, config: mergeConfig(scenario.editor, state.editor) }
  }
  const error = !scenario
    ? `没有 id 为「${sid}」的场景（state=${raw}）。已发现：${SCENARIOS.map((s) => s.id).join("、") || "无"}`
    : `场景「${sid}」没有状态「${stid}」。可用状态：${scenario.states.map((x) => x.id).join("、")}`
  return { key: `invalid:${raw}`, scenarioId: "legacy", stateId: "empty", config: LEGACY_STATES.empty, error }
}

/**
 * 页面级宿主（第 3 批）解析 URL 的 state：<场景>.<状态> 或只写 <场景>（取第一个状态）。
 * 不带 state 时：首页是已拍板的首页（scenarioId "home"）；其余宿主取第一个声明了这个宿主的场景状态，没有就报「找不到场景状态」。
 * 状态属于别的宿主时 redirect 给出它的宿主（页面宿主转过去，参数原样带上）。
 */
export interface ResolvedPage {
  key: string
  scenarioId: string
  stateId: string
  scenario?: Scenario
  state?: ScenarioState
  /** 合并后的页面配置（场景级 + 状态级） */
  page: PageConfig
  error?: string
  redirect?: V3Host
}

export function resolvePageState(host: V3Host, raw: string | null): ResolvedPage {
  const onHost = (s: Scenario) => s.states.find((x) => stateHost(s, x) === host)
  if (raw === null || raw === "") {
    if (host === "home") return { key: "home", scenarioId: "home", stateId: "default", page: {} }
    // 先取 Hub 展示的场景（_kit 这类隐藏场景排在后面，只在宿主还没有别的场景时用）
    const visible = (s: Scenario) => !s.hidden && !s.id.startsWith("_")
    const first = SCENARIOS.find((s) => visible(s) && !!onHost(s)) ?? SCENARIOS.find((s) => !!onHost(s))
    const st = first && onHost(first)
    if (first && st) return { key: `${first.id}.${st.id}`, scenarioId: first.id, stateId: st.id, scenario: first, state: st, page: mergePage(first.page, st.page) }
    return { key: `empty:${host}`, scenarioId: "none", stateId: "none", page: {}, error: `宿主 #${hostPath(host)} 还没有场景：用 state=<场景>.<状态> 打开（场景写 host: "${host}"）。已发现：${SCENARIOS.map((s) => s.id).join("、") || "无"}` }
  }
  const dot = raw.indexOf(".")
  const sid = dot < 0 ? raw : raw.slice(0, dot)
  const stid = dot < 0 ? "" : raw.slice(dot + 1)
  const scenario = findScenario(sid)
  const state = scenario && (stid ? scenario.states.find((x) => x.id === stid) : (onHost(scenario) ?? scenario.states[0]))
  if (scenario && state) {
    const h = stateHost(scenario, state)
    if (h !== host) return { key: `${scenario.id}.${state.id}`, scenarioId: scenario.id, stateId: state.id, scenario, state, page: {}, redirect: h }
    return { key: `${scenario.id}.${state.id}`, scenarioId: scenario.id, stateId: state.id, scenario, state, page: mergePage(scenario.page, state.page) }
  }
  const error = !scenario
    ? `没有 id 为「${sid}」的场景（state=${raw}）。已发现：${SCENARIOS.map((s) => s.id).join("、") || "无"}`
    : `场景「${sid}」没有状态「${stid}」。可用状态：${scenario.states.map((x) => x.id).join("、")}`
  return { key: `invalid:${raw}`, scenarioId: "none", stateId: "none", page: {}, error }
}

/**
 * 场景状态的链接（hash 路由内的路径），按状态的宿主：如 /v3/editor?state=find-replace.default&theme=dark&accent=blue、
 * /v3/documents?state=documents.trash&theme=dark&accent=blue；编辑器状态配置了 view=grid 时带上 view。
 */
export function scenarioHref(scenario: Scenario, state: ScenarioState, p: { theme?: V3Theme; accent?: V3Accent } = {}): string {
  const host = stateHost(scenario, state)
  const q = new URLSearchParams()
  q.set("state", `${scenario.id}.${state.id}`)
  if (host === "editor") {
    const view = mergeConfig(scenario.editor, state.editor).view
    if (view === "grid") q.set("view", "grid")
  }
  q.set("theme", p.theme ?? "dark")
  q.set("accent", p.accent ?? "blue")
  return `${hostPath(host)}?${q.toString()}`
}

/** 换宿主：把当前的查询参数原样带到另一个宿主（编辑器 / 页面宿主遇到别的宿主的状态时用） */
export function hostHref(host: V3Host, search: string): string {
  return `${hostPath(host)}${search.startsWith("?") ? search : search ? `?${search}` : ""}`
}

/** 给截图脚本与调试用：window.__V3_SCENARIOS__ 列出全部场景、状态与链接（不含主题参数以外的东西）。 */
if (typeof window !== "undefined") {
  ;(window as unknown as { __V3_SCENARIOS__: unknown }).__V3_SCENARIOS__ = SCENARIOS.map((s) => ({
    id: s.id,
    title: s.title,
    specs: s.specs,
    batch: s.batch ?? 1,
    hidden: !!s.hidden || s.id.startsWith("_"),
    host: s.host ?? "editor",
    states: s.states.map((st) => ({ id: st.id, title: st.title, note: st.note ?? "", host: stateHost(s, st), href: scenarioHref(s, st) })),
  }))
}
