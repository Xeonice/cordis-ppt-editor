import { flushSync } from "react-dom"
import { useEditor, useSceneState, useTakeoverOpen } from "../../kit"
import { DEPLOY, GANTT, MINE, type Diagnostic, type PluginInfo, type SessionStatus } from "./data"

/**
 * plugins 场景的共享状态（kit useSceneState，换状态即复位）：个人插件面板开着没有、我的界面插件的开关、本会话状态、展开的行、
 * 重试中的插件与最近一次操作的反馈。各状态的初值写在 EditorConfig.data（见 PluginsData），左栏主菜单、横幅、对话框、整栏面板读写同一份。
 */

/** 个人插件面板的呈现：dialog 居中对话框（推荐，03-09 §2）· takeover 检查器整栏面板（备选，DS-26 先例） */
export type PanelForm = "dialog" | "takeover"

/** 状态私有数据（EditorConfig.data） */
export interface PluginsData {
  /** 面板呈现（缺省 dialog） */
  pForm?: PanelForm
  /** 一出现就打开个人插件面板（对话框形态；整栏面板形态由 inspector.takeover 声明，一出现就开着） */
  pOpen?: boolean
  /** 平台管理员（计数行与失败行多「去管理 › 插件」，03-09 §2.1） */
  pAdmin?: boolean
  /** 本会话有启动失败：true = 现场投票（内容级）、演示激光笔（界面级）启动失败，甘特图版本不兼容（03-09 §4.1、§4.3）；也可只列失败的插件 id */
  pFail?: boolean | string[]
  /** 重试中的插件 id（spinner +「重试中…」，其余重试、为我关闭、开关临时禁用） */
  pRetrying?: string
  /** 我的界面插件里被关掉的（在管理员默认值之外） */
  pOff?: string[]
  /** 快捷键冲突（从快捷键面板进入）：user 冲突方可「为我关闭」· locked 内容级插件，只能「请联系管理员」 */
  pConflict?: "user" | "locked"
  /** 本文档缺少插件：「本文档缺少的插件」分组置顶 */
  pMissing?: boolean
  /** 管理员没有开放可选插件：「我的界面插件」隐藏，顶部一行说明 */
  pNoOptional?: boolean
  /** M2：我的界面插件的开关不可用（M3 提供），只有只读、诊断与重试 */
  pM2?: boolean
  /** 面板本身在加载 / 加载失败 */
  pLoad?: "loading" | "error"
  /** 一出现就展开详情的行 */
  pExpanded?: string[]
  /** 一出现就有的反馈（对话框底栏 / 整栏面板形态的轻提示） */
  pFeedback?: Feedback
}

/** 最近一次操作的反馈：开关（可撤销）、重试成功、复制诊断信息、开关保存失败（开关已回弹，50/18 PLG-02） */
export type Feedback =
  | { kind: "toggle"; id: string; on: boolean }
  | { kind: "recovered"; id: string }
  | { kind: "copied"; id: string }
  | { kind: "save-failed"; id: string; on: boolean }

interface UiState {
  open: boolean
  mine: Record<string, boolean>
  session: Record<string, SessionStatus>
  expanded: string[]
  retrying: string | null
  feedback: Feedback | null
  load: "loading" | "error" | null
  /** 对话框关闭后焦点交回的锚点（打开它的触发元素已随菜单卸载时用，如缺插件占位右键菜单的「查看详情」→ 那个占位）；缺省主菜单按钮 */
  returnTo: string | null
}

const KEY = "plugins.ui"

function initial(d: PluginsData): UiState {
  const off = new Set(d.pOff ?? [])
  const mine: Record<string, boolean> = {}
  for (const p of MINE) mine[p.id] = p.userDefault === "on" && !off.has(p.id)
  const session: Record<string, SessionStatus> = {
    "slide-render-chart": "lazy",
    "acme:brand-kit": "pending",
  }
  if (d.pFail === true) Object.assign(session, { "beta:live-poll": "failed", "cordex:presenter-laser": "failed", "acme:gantt": "incompatible" })
  else if (Array.isArray(d.pFail)) for (const id of d.pFail) session[id] = "failed"
  if (d.pRetrying) session[d.pRetrying] = "retrying"
  return {
    open: !!d.pOpen,
    mine,
    session,
    expanded: d.pExpanded ?? [],
    retrying: d.pRetrying ?? null,
    feedback: d.pFeedback ?? null,
    load: d.pLoad ?? null,
    returnTo: null,
  }
}

/**
 * 需要处理的排在前面：启动失败（含重试中）→ 版本不兼容 → 等待依赖，其后核心组件行，再其后按部署声明顺序（03-09 §3）。
 * 「本部署统一启用」与「我的界面插件」两组都这样排（rulings §4.25 TB-78；原来只排了前一组，plugins.failed 里演示激光笔排在「我的界面插件」第 2 行）
 */
const ATTENTION: Partial<Record<SessionStatus, number>> = { failed: 0, retrying: 0, incompatible: 1, pending: 2 }

export function usePlugins() {
  const ed = useEditor()
  const d = ed.data as PluginsData
  const [ui, setUi] = useSceneState<UiState>(KEY, () => initial(d))
  const [takeoverOpen, setTakeoverOpen] = useTakeoverOpen()
  const form: PanelForm = d.pForm ?? "dialog"
  const admin = !!d.pAdmin
  const readOnly = ed.mode === "viewer" || ed.mode === "review"

  const statusOf = (p: PluginInfo): SessionStatus => {
    if (p.userDefault && !ui.mine[p.id]) return "off"
    return ui.session[p.id] ?? "running"
  }
  /** 组内排序：需要处理的在前（ATTENTION），其余按部署声明顺序 */
  const byAttention = (list: PluginInfo[]) =>
    list
      .map((p, i) => ({ p, i }))
      .sort((a, b) => (ATTENTION[statusOf(a.p)] ?? 9) - (ATTENTION[statusOf(b.p)] ?? 9) || a.i - b.i)
      .map(({ p }) => p)
  const deploy = byAttention([...DEPLOY, ...(d.pFail === true ? [GANTT] : [])])
  const problems = deploy.filter((p) => ATTENTION[statusOf(p)] !== undefined).length
  const mine = d.pNoOptional ? [] : byAttention(MINE)

  const set = (patch: Partial<UiState> | ((u: UiState) => Partial<UiState>)) => setUi((u) => ({ ...u, ...(typeof patch === "function" ? patch(u) : patch) }))

  // 两种形态都即时打开：底座主菜单关闭时不再抢回已被整栏面板接走的焦点（kit keepMovedFocus），面板挂载即可把焦点移进内容区
  const openPanel = () => (form === "takeover" ? setTakeoverOpen(true) : set({ open: true, returnTo: null }))
  /** 从会随之卸载的触发处打开（右键菜单里的「查看详情」）：关闭后焦点交回 from 锚点（如被右键的缺插件占位），不落到主菜单 */
  const openPanelFrom = (from: string) => (form === "takeover" ? setTakeoverOpen(true) : set({ open: true, returnTo: from }))
  const closePanel = () => set({ open: false })

  const toggleMine = (p: PluginInfo, on: boolean) => {
    const row = () => document.querySelector<HTMLElement>(`[data-plugin-row="${CSS.escape(p.id)}"]`)
    const hadFocus = !!row()?.contains(document.activeElement)
    // 同步提交：失败行关掉后不再是「需要处理」，按声明顺序回到组内原位（TB-78，行在列表里挪动），「为我关闭」也随失败态卸载——
    // 焦点原本在这一行里、提交后丢了（DOM 节点被移走时焦点会掉到 body），在同一个任务里交给这一行的开关，不在 body 停一帧
    flushSync(() =>
      set((u) => {
        const session = { ...u.session }
        // 关掉 = 本会话卸载（Fiber dispose，贡献随即移除）；再打开 = 即时装配（O-1），按装配成功演示
        delete session[p.id]
        return { mine: { ...u.mine, [p.id]: on }, session, feedback: { kind: "toggle", id: p.id, on } }
      }),
    )
    const a = document.activeElement
    if (hadFocus && (!a || a === document.body || !a.isConnected)) row()?.querySelector<HTMLElement>('[role="switch"]')?.focus({ preventScroll: true })
  }

  const undo = () =>
    set((u) => {
      const f = u.feedback
      if (f?.kind !== "toggle") return { feedback: null }
      return { mine: { ...u.mine, [f.id]: !f.on }, feedback: null }
    })

  /**
   * 重试（PS-11）：只在本会话 fiber.restart()；演示 1.2 秒后恢复运行。
   * 恢复后这一行的「重试中…」按钮随失败态卸载：焦点原本在它上面（或已落回对话框本身 / body）时，交给这一行的开关或「展开详情」
   */
  const retry = (p: PluginInfo) => {
    set((u) => ({ retrying: p.id, session: { ...u.session, [p.id]: "retrying" }, feedback: null }))
    window.setTimeout(() => {
      const row = () => document.querySelector<HTMLElement>(`[data-plugin-row="${CSS.escape(p.id)}"]`)
      const hadFocus = !!row()?.contains(document.activeElement)
      set((u) => ({ retrying: null, session: { ...u.session, [p.id]: "running" }, feedback: { kind: "recovered", id: p.id } }))
      requestAnimationFrame(() => {
        const a = document.activeElement
        const lost = !a || a === document.body || !a.isConnected || a.getAttribute("role") === "dialog"
        if (!hadFocus && !lost) return
        const r = row()
        ;(r?.querySelector<HTMLElement>('[role="switch"]') ?? r?.querySelector<HTMLElement>("button[aria-expanded]"))?.focus({ preventScroll: true })
      })
    }, 1200)
  }

  const toggleExpanded = (id: string) => set((u) => ({ expanded: u.expanded.includes(id) ? u.expanded.filter((x) => x !== id) : [...u.expanded, id] }))

  /** 「复制诊断信息」：四行——插件 id、错误码、阶段（原值 activate / contribution，界面写「启动 / 贡献」）、traceId（rulings §4.25 TB-96）；不含文档内容 */
  const copyDiag = (p: PluginInfo, diag: Diagnostic) => {
    navigator.clipboard?.writeText(`plugin: ${p.id}@${p.version}\ncode: ${diag.code}\nphase: ${diag.phase}\ntraceId: ${diag.traceId}`).catch(() => undefined)
    set({ feedback: { kind: "copied", id: p.id } })
  }

  return {
    ui,
    set,
    data: d,
    form,
    admin,
    readOnly,
    open: form === "takeover" ? takeoverOpen : ui.open,
    openPanel,
    openPanelFrom,
    closePanel,
    statusOf,
    deploy,
    problems,
    mine,
    toggleMine,
    undo,
    retry,
    toggleExpanded,
    copyDiag,
  }
}

export type PluginsApi = ReturnType<typeof usePlugins>
