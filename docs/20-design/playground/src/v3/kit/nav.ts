import { useNavigate } from "react-router-dom"
import { hostPath, useV3Params, type V3Host } from "../params"
import { carryInteraction, holdFocusDuring } from "./layer"

/**
 * 由用户操作跳到另一个样张的状态（第 3 批转正时由 import/pages.tsx 的 useGo 与 shortcuts/nav.ts 的 useGoTo 合并，kitRequest g2 K4）：
 * carryInteraction(entry)（新状态里随之打开的面板照常接住焦点；entry 是触发它的固定入口锚点，新状态里 arrivedVia() 取）+ holdFocusDuring()（菜单收起、换状态的这几帧焦点交给画布，不掉到 body）
 * + 导航到状态所在宿主的路由，沿用当前主题与强调色。
 *
 *   const goTo = useGoTo()
 *   goTo("settings.default", { entry: "account" })              // 编辑器宿主（缺省）
 *   goTo("documents.search", { host: "documents", params: { q } })
 */
export function useGoTo(): (state: string | null, opts?: { host?: V3Host; entry?: string; params?: Record<string, string>; replace?: boolean }) => void {
  const navigate = useNavigate()
  const { theme, accent } = useV3Params()
  return (state, opts = {}) => {
    carryInteraction(opts.entry)
    holdFocusDuring()
    navigate(stateHref(opts.host ?? "editor", state, { theme, accent, ...opts.params }), { replace: opts.replace })
  }
}

/** 某个宿主上某个状态的链接（hash 路由内）：state 在前，其余参数其后，主题与强调色缺省 dark / blue */
export function stateHref(host: V3Host, state: string | null, params: Record<string, string> = {}): string {
  const q = new URLSearchParams()
  if (state) q.set("state", state)
  for (const [k, v] of Object.entries(params)) if (k !== "theme" && k !== "accent") q.set(k, v)
  q.set("theme", params.theme ?? "dark")
  q.set("accent", params.accent ?? "blue")
  return `${hostPath(host)}?${q.toString()}`
}

/**
 * 不在 React 组件里（静态的菜单条目、导航配置）时跳到某个宿主的状态：沿用当前 URL 里的主题与强调色，用 hash 跳转（原 scenarios/documents/shell.tsx 的 goState，
 * 缺省行为逐字相同：不带「操作过」）。carry：带上「操作过」与入口（新状态里随之打开的面板照常接住焦点，同 useGoTo）；replace：不新增历史记录（如结果页里换检索词）
 */
export function goToState(host: V3Host, state: string | null, extra: Record<string, string> = {}, opts: { carry?: boolean; entry?: string; replace?: boolean } = {}) {
  const cur = new URLSearchParams(window.location.hash.split("?")[1] ?? "")
  if (opts.carry) {
    carryInteraction(opts.entry)
    holdFocusDuring()
  }
  const href = stateHref(host, state, { theme: cur.get("theme") ?? "dark", accent: cur.get("accent") ?? "blue", ...extra })
  if (opts.replace) window.location.replace(`#${href}`)
  else window.location.hash = href
}

/** 某个场景状态（<场景>.<状态>）在不在（读 scenario-registry 写的 window.__V3_SCENARIOS__，底座不直接导入注册表，免得循环依赖） */
export function stateExists(key: string): boolean {
  const all = (window as unknown as { __V3_SCENARIOS__?: { id: string; states: { id: string }[] }[] }).__V3_SCENARIOS__ ?? []
  const [sid, stid] = key.split(".")
  return !!all.find((s) => s.id === sid)?.states.some((st) => st.id === stid)
}

/** 几个候选状态里第一个存在的（状态改名的过渡期：新名字还没有时退到旧名字） */
export const firstState = (...keys: string[]): string => keys.find(stateExists) ?? keys[0]!
