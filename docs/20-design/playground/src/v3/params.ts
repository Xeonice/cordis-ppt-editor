import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router-dom"

/**
 * v3 样张的全部状态都走 URL：#/v3/editor?state=shape&view=grid&theme=dark&accent=blue
 * state 有两种写法：旧的四个取值（empty / shape / text / shapes-menu），或场景状态 <场景 id>.<状态 id>（见 scenarios/README.md）。
 * 控件只有一种画法（安静样式，rulings §4.25 DS-35）：原参数 controls 已删除，旧链接里带的 controls=… 不再起作用。
 */
export const V3_THEMES = ["dark", "light"] as const
export const V3_ACCENTS = ["blue", "violet", "coral"] as const
export const V3_EDITOR_STATES = ["empty", "shape", "text", "shapes-menu"] as const
/** 编辑器视图：single 单页（左栏 + 画布 + 检查器），grid 网格（两侧面板收起，只剩浮动胶囊、幻灯片网格与底部工具条）。 */
export const V3_VIEWS = ["single", "grid"] as const

/**
 * 页面级宿主（第 3 批，rulings §4.25 DS-71…DS-73）：#/v3/<宿主>?state=<场景>.<状态>&theme=dark|light&accent=blue|violet|coral。
 *   editor 编辑器（第 1、2 批的全部场景）· home 首页（已拍板，DS-12）· documents 文档列表 · templates 模板库 · admin/plugins 管理 › 插件
 *   （后四个是应用壳：首页那套左栏 220 + 顶栏 56，kit ShellLayout）· page 整屏 bare（画布底色、无导航：登录、回调与错误页）·
 *   embed 中性宿主外框 + iframe 容器（嵌入形态，容器尺寸参数 frame=宽x高）。场景用 Scenario.host / ScenarioState.host 声明自己的宿主
 */
export const V3_HOSTS = ["editor", "home", "documents", "templates", "admin/plugins", "page", "embed"] as const
/** 应用壳宿主：首页那套左栏 + 顶栏（kit ShellLayout） */
export const V3_SHELL_HOSTS = ["home", "documents", "templates", "admin/plugins"] as const

export type V3Theme = (typeof V3_THEMES)[number]
export type V3Accent = (typeof V3_ACCENTS)[number]
export type V3EditorState = (typeof V3_EDITOR_STATES)[number]
export type V3View = (typeof V3_VIEWS)[number]
export type V3Host = (typeof V3_HOSTS)[number]
export type V3ShellHost = (typeof V3_SHELL_HOSTS)[number]

/** 宿主的路由路径（hash 路由内）：editor → /v3/editor、admin/plugins → /v3/admin/plugins */
export const hostPath = (h: V3Host): string => `/v3/${h}`
export const isShellHost = (h: V3Host): h is V3ShellHost => (V3_SHELL_HOSTS as readonly string[]).includes(h)

function pick<T extends string>(v: string | null, all: readonly T[], fallback: T): T {
  return all.find((x) => x === v) ?? fallback
}

export function useV3Params() {
  const [sp, setSp] = useSearchParams()
  const theme = pick(sp.get("theme"), V3_THEMES, "dark")
  const accent = pick(sp.get("accent"), V3_ACCENTS, "blue")
  const state = pick(sp.get("state"), V3_EDITOR_STATES, "empty")
  /** state 参数原文：场景状态（<场景>.<状态>）由 scenario-registry 解析；没有参数时为 null */
  const stateParam = sp.get("state")
  const view = pick(sp.get("view"), V3_VIEWS, "single")
  /** 嵌入宿主的 iframe 里加载的页面带 embedded=1（中性宿主外框里的那一份）；页面自己按需读，缺省 false */
  const embedded = sp.get("embedded") === "1"
  /** 嵌入宿主的容器尺寸覆盖：frame=宽x高（如 640x360），缺省取状态声明的 page.embed.size */
  const frame = sp.get("frame")
  /**
   * 切换视图：视图的唯一状态源就是 URL 参数 view，所有入口都调这一个函数。
   * 只改 view（single 是缺省值，直接去掉参数），state / theme / accent 等其余参数原样保留；replace 不新增历史记录。
   */
  const setView = useCallback(
    (v: V3View) => {
      if (v === view) return
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (v === "single") next.delete("view")
          else next.set("view", v)
          return next
        },
        { replace: true },
      )
    },
    [view, setSp],
  )
  return useMemo(() => ({ theme, accent, state, stateParam, view, setView, embedded, frame }), [theme, accent, state, stateParam, view, setView, embedded, frame])
}

export interface V3Link {
  state?: V3EditorState
  view?: V3View
  theme?: V3Theme
  accent?: V3Accent
}

/** 生成 v3 路由链接；站内跳转时沿用当前 theme 与 accent。网格视图里 state 不起作用，没给就不写。 */
export function v3Href(path: "/v3/editor" | "/v3/home", p: V3Link = {}): string {
  const q = new URLSearchParams()
  if (path === "/v3/editor") {
    if (p.state || p.view !== "grid") q.set("state", p.state ?? "empty")
    if (p.view === "grid") q.set("view", "grid")
  }
  q.set("theme", p.theme ?? "dark")
  q.set("accent", p.accent ?? "blue")
  return `${path}?${q.toString()}`
}
