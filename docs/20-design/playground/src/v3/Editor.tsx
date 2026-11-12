import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useBreakpoint } from "./editor/breakpoint"
import { shareReasonOf } from "./editor/chrome"
import { EditorContext, type EditorCtx } from "./editor/context"
import { DEFAULT_DECK, slideOf } from "./editor/deck"
import { GridView } from "./editor/GridView"
import { LayoutToasts } from "./editor/layouts/LayoutGallery"
import { Inspector, INSPECTOR_TAB_KEY } from "./editor/Inspector"
import { QuickStyleScope } from "./editor/inspector/builtin"
import type { SelectionKind } from "./editor/inspector/registry"
import { LeftRail } from "./editor/LeftRail"
import { closeOverlaysThen, MasterModeKeys, MasterModeToast, masterRegions } from "./editor/master/host"
import { masterEntryOf, masterFormOf, readScroll, readStageScroll, useMasterGuards, useViewportTraits, writeScroll, writeStageScroll } from "./editor/master/mode"
import { getMasterView } from "./editor/master/registry"
import type { MasterExitOptions, MasterMemory, MasterTarget, MasterVia, MasterViewMode } from "./editor/master/types"
import { getPaletteHost } from "./editor/palette-host"
import { usePanelSizes } from "./editor/resize"
import { createSceneStore } from "./editor/scene"
import { Stage } from "./editor/Stage"
import { ThumbContextMenu } from "./editor/thumb-menu"
import { HintToolbar, ReviewToolbar, TOOL_MENU_KEY, Toolbar, ViewerToolbar, type ToolId } from "./editor/Toolbar"
import { Banner } from "./kit/Banner"
import { InspectorNotice } from "./kit/controls"
import { TAKEOVER_KEY } from "./kit/InspectorTakeover"
import { COMMAND_ENTRY, setCommandBefore, setCommandFallback, useBaseKeys } from "./kit/commands"
import { EditorFollow, FOLLOW_KEY } from "./kit/Follow"
import { canvasFocusTarget, carryInteraction, holdFocusDuring, rescueFocus, resetInteraction, scrollIntoPanel } from "./kit/layer"
import { exportReasonOf } from "./kit/mainMenu"
import { LI, ME, WANG } from "./data"
import { useV3Params, type V3View } from "./params"
import { hostHref, providerOf, resolveEditorState, scenarioHref, type ResolvedState } from "./scenario-registry"
import type { InspectorConfig, RailConfig, RegionDefaults, Slot, ToolbarConfig } from "./scenarios/types"
import { ICON } from "./ui"
import { V3Root } from "./V3Root"

/** 评审 / 浏览模式下检查器顶部的缺省说明（02 §6.2） */
const MODE_NOTICE = {
  review: "只读 · 评审模式下不可编辑",
  viewer: "只读 · 你只有查看权限",
} as const

/** 评审 / 浏览模式下缩略图右键顶部说明行的文字（与主菜单 kit/mainMenu.tsx 的不可用原因同一口径，03-05 §4）；编辑模式已降权另取 rail.readonlyDegraded */
const THUMB_RO_REASON: Partial<Record<"edit" | "review" | "viewer", string>> = {
  review: "评审模式下不可用",
  viewer: "只有查看权限",
}

/**
 * 设计语言 v3 · 编辑器样张（#/v3/editor?state=…&view=single|grid&theme=dark|light&accent=blue|violet|coral）
 * state 取旧的四个值（empty / shape / text / shapes-menu），或场景状态 <场景 id>.<状态 id>（src/v3/scenarios/，见其中 README.md）。
 * 单页视图是 Figma 式三栏：左栏缩略图、中间画布 + 备注 + 底部浮动工具条（只管创建）、右栏检查器（只管当前选中对象的属性）。
 * 网格视图以 Figma Slides 为基准：两侧面板都不渲染，只剩左上 / 右上浮动胶囊、全部幻灯片的网格和底部工具条。
 * 页面上没有任何演示控件：状态全部走 URL，初始状态由 state 参数决定，之后可以正常点按。
 * 视图的唯一状态源是 URL 参数 view；view=grid 时网格优先，state 只影响单页视图。
 * 视图切换每种视图只有一个常驻入口：单页在左栏顶部，网格在左上胶囊；主菜单「视图」子菜单是不常驻的第二入口，备注开关也在那里。
 * 切换后焦点：左栏、胶囊（连同其中的主菜单）、网格里的某一页都会随视图卸载，焦点交给新视图里的「单页 / 网格」按钮；
 * 底部工具条常驻，从它触发的切换（网格里点创建工具）焦点留在原按钮。
 */
export function V3Editor() {
  const { stateParam } = useV3Params()
  const resolved = useMemo(() => resolveEditorState(stateParam), [stateParam])
  const location = useLocation()
  // 第 3 批：状态属于页面级宿主（首页、文档列表、登录页、嵌入…）时转过去，参数原样带上（截图脚本照旧写 #/v3/editor?state=… 也能到）
  if (resolved.redirect) return <Navigate to={hostHref(resolved.redirect, location.search)} replace />
  return (
    <V3Root className="flex h-dvh w-full overflow-hidden">
      <EditorApp key={resolved.key} resolved={resolved} />
    </V3Root>
  )
}

function EditorApp({ resolved }: { resolved: ResolvedState }) {
  const { view: urlView, setView, theme, accent, embedded } = useV3Params()
  const cfg = resolved.config
  const deck = cfg.deck ?? DEFAULT_DECK
  /**
   * 母版视图是宿主的全局模式（2026-10-28，母版视图改版第一步，rulings §4.25 DS-144；前端 50/11 §2–§3）：masterOn 在这里保管，初值取状态的 masterView.open
   * （与 mode 一样是同一状态里可切换、不重新挂载的状态，TB-83 的先例；不进 URL，会话记忆只在内存里，50/11 §2）。母版视图里的画法由登记的母版实现给（editor/master/registry.ts）。
   * 视图不动 URL：母版视图里按单页结构画（下面的 view 是生效的视图），URL 的 view=grid 留着，退出即回到网格（03-26 §6.8）。
   */
  const impl = getMasterView()
  const [masterOn, setMasterOn] = useState(() => !!impl && !!cfg.masterView && !!cfg.masterView.open)
  const masterOnRef = useRef(masterOn)
  masterOnRef.current = masterOn
  const view: V3View = masterOn ? "single" : urlView
  const grid = view === "grid"
  const startSlide = cfg.slide ?? 2
  const startSel: SelectionKind = cfg.selection ?? "none"
  // 直接以网格视图打开时网格优先：工具弹层不展开，选择工具保持激活
  const [slide, setSlide] = useState(startSlide)
  const [sel, setSel] = useState<SelectionKind>(startSel)
  const slideRef = useRef(slide)
  slideRef.current = slide
  /** 「在普通视图查看引用页」退出后另外选中的页（exit 的 slides，directions §2.10）：单页视图的左栏、网格视图的网格都画出来；换页即清掉 */
  const [pageSel, setPageSel] = useState<number[] | null>(null)
  const [tool, setTool] = useState<ToolId>(() => (grid ? "select" : (cfg.toolbar?.tool ?? "select")))
  const [shapesOpen, setShapesOpen] = useState(() => !grid && !!cfg.toolbar?.shapesOpen)
  // 单页里的备注开关（主菜单「视图」子菜单）；网格视图只是不显示备注（菜单项置灰），不改这个值
  const [notes, setNotes] = useState(cfg.stage?.notes ?? true)
  // 切换视图后要不要把焦点交给新视图里的「单页 / 网格」按钮（见 changeView）
  const [focusToggle, setFocusToggle] = useState(false)
  // 命令兜底要用的最新路由参数（兜底登记在场景仓上，只登记一次）
  const navigate = useNavigate()
  const route = useRef({ navigate, theme, accent })
  route.current = { navigate, theme, accent }
  // 场景内跨区域共享的状态（kit useSceneState）：每次挂载一个新仓，换状态即复位。
  // 同时复位「有没有人操作过」（kit/layer.ts userHasInteracted）：新状态里一出现就打开的浮层不抢焦点，用户之后打开的才把焦点移进去。
  // 放在 useState 初始化里：渲染阶段、早于所有子组件的挂载与自动聚焦。
  // 底座自己的两项场景状态在这里按状态配置写好初值，左栏、画布、检查器第一次读到的就是它：
  // 整栏面板开着没有（inspector.takeoverOpen，缺省开）、检查器页签（inspector.tab，缺省「设计」）
  const [scene] = useState(() => {
    resetInteraction()
    const store = createSceneStore()
    store.init(TAKEOVER_KEY, cfg.inspector?.takeoverOpen ?? true)
    store.init(INSPECTOR_TAB_KEY, cfg.inspector?.tab ?? "design")
    // 底座命令没有场景接住时（kit/commands.ts）：有场景声明演示它（Scenario.provides）就转到那个状态（沿用主题与强调色、单页视图），
    // 由用户操作触发，新状态里随之打开的面板照常接住焦点（carryInteraction）；当前就是声明它的场景、或没有声明时照旧（菜单只关闭）
    // 按当前模式取演示状态（如查看者点「分享」转到非所有者的「谁能访问」）；带上触发它的入口，新状态里的面板关闭后焦点交回同一个入口（COMMAND_ENTRY）。
    // 菜单收起、整个编辑器换成新状态的这几帧里焦点不掉到 body：交给画布（holdFocusDuring），新状态里打开着的面板 / 对话框挂上后接走
    setCommandFallback(store, (id) => {
      // 按当前模式（同一状态里可能已切换过，TB-83）
      const p = providerOf(id, modeRef.current)
      if (!p || p.scenario.id === resolved.scenarioId) return false
      const r = route.current
      carryInteraction(COMMAND_ENTRY[id])
      holdFocusDuring()
      r.navigate(scenarioHref(p.scenario, p.state, { theme: r.theme, accent: r.accent }))
      return true
    })
    // 放映（F5 / ⇧F5 / 三处「放映」按钮）在母版视图里：先退出母版视图、恢复位置，再从恢复后的当前页开始放映（rulings §4.25 DS-109，50/11 §3）。
    // 同步提交退出（flushSync），场景里随普通视图才挂上的放映处理函数（如 present 场景退出放映后的重新进入）这一刻已经登记好，接得住同一个命令
    setCommandBefore(store, (id) => {
      if ((id === "present" || id === "present.fromStart") && masterOnRef.current) flushSync(() => masterApi.current.exit("present"))
    })
    return store
  })
  /**
   * 模式（rulings §4.25 TB-83）：状态的 mode 是初值，同一状态里可以在编辑 / 评审之间切换、不重新挂载编辑器（主菜单「视图 › 模式」、评审条「返回编辑」，
   * EditorCtx.setMode）——撰写中的评论草稿、换过的页与选中都留着（演示 TB-84、TB-87）。查看者没有模式可切；评审者（toolbar.canEdit 为 false）切不回编辑。
   * 切过去时工具回到两种工具条都有的那一个（评审条没有创建工具：留在「评论」或回到「选择 / 浏览」），形状弹层收起
   */
  const initialMode = cfg.mode ?? "edit"
  const [mode, setModeState] = useState<"edit" | "review" | "viewer">(initialMode)
  const modeRef = useRef(mode)
  modeRef.current = mode
  const setMode = (m: "edit" | "review") => {
    if (modeRef.current === "viewer" || m === modeRef.current) return
    if (m === "edit" && cfg.toolbar?.canEdit === false) return
    // 在母版视图里手动切到评审：先退出母版视图、回到进入前的位置，再切模式（rulings §4.18 UX-20，03-26 §6.5）
    if (m === "review" && masterOnRef.current) masterApi.current.exit("review")
    setTool((t) => (t === "comment" ? t : "select"))
    setShapesOpen(false)
    setModeState(m)
  }
  const readOnlyMode = mode === "review" || mode === "viewer"
  // 面板尺寸（03-20）：状态给的值 > 本机记住的值 > 缺省（左栏 240、检查器 280、备注 120）
  const [panels, setPanel] = usePanelSizes(cfg.panels)
  const resizeActive = cfg.panels?.active

  const pick = (n: number) => {
    setSlide(n)
    setSel("none")
    setPageSel(null)
  }

  /**
   * 所有视图入口共用：进入网格时收起形状弹层、回到选择工具。
   * moveFocus：入口是否随视图卸载。左栏顶部、网格胶囊、两处的主菜单、网格里的某一页都会被卸载，切换后焦点交给新视图里的切换按钮
   * （进网格 → 胶囊「网格」，回单页 → 左栏「单页」）；底部工具条常驻，焦点留在它自己的按钮上。
   */
  const changeView = (v: V3View, moveFocus: boolean) => {
    // 母版视图里没有网格形态：切换视图无效（主菜单与命令面板的「网格视图」写「母版视图下不可用」），URL 的 view 留着、退出后照它恢复
    if (masterOnRef.current) return
    if (v === urlView) return
    if (v === "grid") {
      setTool("select")
      setShapesOpen(false)
    }
    // 入口随视图卸载时（左栏、网格胶囊、网格里的某一页）：视图走 URL，React Router 的导航在过渡里提交、晚于这次点按的同步更新——入口在那次提交里卸载，
    // 新视图里切换按钮的自动聚焦要到下一帧才落上（提交时调的 focus() 没生效，靠 autofocus 在下一帧补上），中间焦点在 body 上停十几毫秒
    // （2026-10-21 复测：新开页面后点左栏「网格」，focusout 到 focusin 之间 14–16ms，期间主线程忙；docs-sync 2026-10-15 记的「约 45 毫秒」）。
    // 改为先把焦点交给两种视图共用的画布列（main，tabIndex −1，同菜单进网格时 holdFocusDuring 的落点），入口卸载时焦点已不在它上面，新视图的按钮挂上后再接走（07 §2.4）
    if (moveFocus) {
      const main = document.querySelector<HTMLElement>('[data-v3-anchor="canvas"]')
      if (main && document.activeElement !== main) main.focus({ preventScroll: true })
      holdFocusDuring(1000, () => document.querySelector<HTMLElement>(`[data-v3-anchor="view-toggle"] button[aria-label="${v === "grid" ? "网格" : "单页"}"]`))
    }
    setFocusToggle(moveFocus)
    setView(v)
  }

  /** 网格里的幻灯片放不了对象：选创建工具 = 打开选中页并带着这个工具回单页（选择工具不切换） */
  const chooseTool = (t: ToolId) => {
    setTool(t)
    if (grid && t !== "select") changeView("single", false)
  }

  const toView = (v: V3View) => changeView(v, true)

  // 工具单键（PRD ED-16，DS-11）：选择 V、文本 T、形状 S、评论 C。只在焦点位于画布或工具条（或页面本身）、不在文本编辑态与 IME 组合态、
  // 没有修饰键时生效；输入框、菜单、弹层与对话框里不触发。评审条只有「浏览 V」「评论 C」，查看者没有工具。不可用的工具按了无效。
  // 母版视图里没有「评论」工具（工具条把它换成「占位符」，03-26 §1）：C 不处理
  const keyRef = useRef({ sel, mode, grid, master: masterOn, disabled: cfg.toolbar?.disabled ?? {}, hide: cfg.toolbar?.hide ?? [], chooseTool, setShapesOpen })
  keyRef.current = { sel, mode, grid, master: masterOn, disabled: cfg.toolbar?.disabled ?? {}, hide: cfg.toolbar?.hide ?? [], chooseTool, setShapesOpen }
  useEffect(() => {
    const TOOL_KEYS: Record<string, ToolId> = { v: "select", t: "text", s: "shapes", c: "comment" }
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const t = TOOL_KEYS[e.key.toLowerCase()]
      const k = keyRef.current
      if (!t || k.mode === "viewer" || k.sel === "text") return
      if (k.master && t === "comment") return
      if (k.mode === "review" && t !== "select" && t !== "comment") return
      const a = document.activeElement as HTMLElement | null
      const onCanvas = !a || a === document.body || !!a.closest('[data-v3-anchor="canvas"]')
      if (!onCanvas || a?.isContentEditable || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return
      if (a?.closest('[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"], [data-radix-popper-content-wrapper]')) return
      if (k.disabled[t as keyof typeof k.disabled] || k.hide.includes(t as (typeof k.hide)[number])) return
      e.preventDefault()
      k.chooseTool(t)
      // 「形状」要先挑一个形状：单页里顺手展开常用 4 × 3（网格里先回单页，不展开）
      if (t === "shapes" && !k.grid) k.setShapesOpen(true)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  // 场景状态指定了视图、而手写的链接没带 view 参数时，挂载后把 URL 改成状态的视图（之后用户可自由切换）
  useEffect(() => {
    if (cfg.view && cfg.view !== view) changeView(cfg.view, false)
    // 只在挂载时同步一次
  }, [])

  /* ---------------------------------------------------------------- 母版视图（全局模式，前端 50/11 §2、§3） */

  /** 能不能进入：masterEntryOf 按状态配置与运行时事实判（不按状态 id），守卫由场景组件在挂载期间声明（useMasterEntryGuard） */
  const viewport = useBreakpoint()
  const traits = useViewportTraits()
  const guards = useMasterGuards(scene)
  const formSetting = (cfg.data ?? {}).form
  const entry = masterEntryOf({
    on: masterOn,
    // 「找不到场景状态」（URL 的 state 没对上任何场景状态）：这一页不是哪个状态，按没有编辑器外壳处理（silent，不进入、不提示、不挂命令面板）——
    // 原来能进母版视图，但错误横幅占着横幅通道、母版横幅不画，唯一的常驻出口没了（2026-10-29 补完，复验 R1-N5）
    config: resolved.error ? false : cfg.masterView,
    implemented: !!impl,
    collapse: !!cfg.toolbar?.collapse,
    form: masterFormOf(formSetting, viewport),
    explicitReason: cfg.rail?.menu?.master?.reason,
    mode,
    readonlyDegraded: cfg.rail?.readonlyDegraded,
    guards,
    locked: cfg.inspector?.locked,
    small: traits.small,
    touch: traits.touch,
    embedded,
  })
  const entryRef = useRef(entry)
  entryRef.current = entry
  /** 演示态载入时就在母版视图里：记忆的初值是本状态自己的页、检查器页签与滚动 0（前端 50/11 §2「会话记忆」） */
  const loadMemory = useRef<MasterMemory>({
    slide: startSlide,
    tab: cfg.inspector?.tab ?? "design",
    railScroll: 0,
    gridScroll: 0,
    stageScroll: { left: 0, top: 0 },
    takeoverOpen: false,
    takeoverScroll: 0,
  })
  const [memory, setMemory] = useState<MasterMemory | null>(() => (masterOn ? loadMemory.current : null))
  const memoryRef = useRef(memory)
  const [session, setSession] = useState(0)
  const [masterTarget, setMasterTarget] = useState<MasterTarget | null>(null)
  /** 进入 / 退出之后、绘制之前要做的事：焦点落点与滚动还原（见下方 useLayoutEffect） */
  const after = useRef<{ focus: "entry" | "canvas" | "rescue"; rail?: number; grid?: number; stage?: MasterMemory["stageScroll"]; takeover?: number } | null>(null)

  /**
   * ⌥⌘M 不可用时的轻提示（MasterModeToast）：3.5 秒（50/10 §11 规则 8 的轻提示缺省时长；2026-10-29 补完前是 3 秒，复验 R1-N4）；
   * 同一原因连按不另出一条（只把计时重新算）
   */
  const [hintToast, setHintToast] = useState<{ reason: string } | null>(null)
  const hintTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(hintTimer.current), [])
  const hint = (reason?: string) => {
    if (!reason) return
    window.clearTimeout(hintTimer.current)
    setHintToast((t) => (t && t.reason === reason ? t : { reason }))
    hintTimer.current = window.setTimeout(() => setHintToast(null), 3500)
  }

  const enterMaster = (via: MasterVia, target?: MasterTarget): boolean => {
    if (masterOnRef.current) return true
    const e = entryRef.current
    if (!e.ok || !impl) {
      // 命令面板自己播报原因（面板不关），这里不再另出轻提示；没有编辑器外壳的状态不提示
      if (!e.silent && via !== "palette") hint(e.reason)
      return false
    }
    // 先前按 ⌥⌘M 不可用时出的轻提示「母版视图：〈原因〉」，可以进入时随之清掉（rulings §4.25 DS-163）：不带进母版视图，计时一并作废，
    // 之后再遇到同一原因时照常重新出一条
    window.clearTimeout(hintTimer.current)
    setHintToast(null)
    // 正在跟随协作者：先停止跟随，再进入（rulings §4.25 DS-167；母版视图不显示他人的页级光标，PRD ML-01）
    scene.set(FOLLOW_KEY, null)
    // 会话记忆：进入前的页、检查器页签、左栏 / 网格的滚动，单页视图里还有画布自己的滚动（放大后可滚动时，R4-B2）；
    // 状态声明的整栏面板（保真报告、插件面板的整栏形态等）开着时不关（rulings §4.25 DS-162：恢复到进入前的样子）：面板在场景仓里仍算开着，
    // 母版实现的检查器不画它（随检查器卸下），当前项与定位高亮都留着；这里记下面板内容区的滚动，退出后重新挂上时写回
    const takeoverOpen = !!cfg.inspector?.takeover && scene.get(TAKEOVER_KEY) === true
    const m: MasterMemory = {
      slide: slideRef.current,
      tab: scene.get(INSPECTOR_TAB_KEY) === "comments" ? "comments" : "design",
      railScroll: urlView === "grid" ? 0 : readScroll("rail"),
      gridScroll: urlView === "grid" ? readScroll("grid") : 0,
      stageScroll: urlView === "grid" ? { left: 0, top: 0 } : readStageScroll(),
      takeoverOpen,
      takeoverScroll: takeoverOpen && urlView !== "grid" ? readScroll("takeover") : 0,
    }
    // 检查器回到「设计」（「评论」页签在母版视图里不可用，03-26 §1）；工具回到「选择」，形状弹层与图片 / 表格 / 图表的工具弹层收起（TOOL_MENU_KEY）
    scene.set(INSPECTOR_TAB_KEY, "design")
    setTool("select")
    setShapesOpen(false)
    scene.set(TOOL_MENU_KEY, null)
    impl.onEnter?.(scene, ctxRef.current, target ?? null)
    memoryRef.current = m
    setMemory(m)
    setMasterTarget(target ?? null)
    setSession((s) => s + 1)
    masterOnRef.current = true
    setMasterOn(true)
    // 入口（菜单条目、画布、命令面板交回的焦点）随之卸载：焦点不掉到 body，直接交给落点（rulings §4.25 DS-166：窗格里选中的那一行；实现拿到本次的目标，「转到版式」可交给画布上的占位符）
    after.current = { focus: "entry" }
    holdFocusDuring(1000, () => impl.entryFocus?.(scene, ctxRef.current, target ?? null) ?? null)
    return true
  }

  const exitMaster = (via: MasterVia, opts?: MasterExitOptions) => {
    if (!masterOnRef.current) return
    impl?.onExit?.(scene, ctxRef.current)
    const m = memoryRef.current ?? loadMemory.current
    // 回到进入前的页（或 exit 指定的页）；记忆里的页已不在文档里时回到首页（50/11 §2）
    const want = opts?.slide ?? opts?.slides?.[0] ?? m.slide
    setSlide(deck.some((s) => s.n === want) ? want : (deck[0]?.n ?? want))
    setSel("none")
    setPageSel(opts?.slides && opts.slides.length > 1 ? opts.slides : null)
    setTool("select")
    setShapesOpen(false)
    // 普通工具条随退出重新挂上：工具弹层不按演示初值再弹出（同网格往返，TOOL_MENU_KEY）
    scene.set(TOOL_MENU_KEY, null)
    scene.set(INSPECTOR_TAB_KEY, m.tab)
    if (m.takeoverOpen) {
      // 进入前开着的整栏面板照原样显示（进入时没关，场景仓里仍开着；普通检查器随退出重新挂上，面板跟着出现，内容区滚动在提交后写回）：
      // 这是还原位置、不是用户这一刻打开它，面板不抢焦点（kit InspectorTakeover 只在「有人操作过」时把焦点移进去），焦点照常交给画布；
      // 用户下一次按键或点按即恢复「操作过」
      resetInteraction()
    }
    memoryRef.current = null
    setMemory(null)
    setMasterTarget(null)
    masterOnRef.current = false
    setMasterOn(false)
    // 焦点交给画布（03-26 §1.1）；窗口缩到仅查看形态时的自动退出只在焦点丢了时兜一下
    after.current = { focus: via === "narrow" ? "rescue" : "canvas", rail: m.railScroll, grid: m.gridScroll, stage: m.stageScroll, takeover: m.takeoverScroll }
  }

  /** 进入 / 退出的最新一份（命令前置钩子、键位、菜单回调可能拿着旧闭包） */
  const masterApi = useRef({ enter: enterMaster, exit: exitMaster })
  masterApi.current = { enter: enterMaster, exit: exitMaster }

  const masterView: MasterViewMode = {
    on: masterOn,
    session,
    entry,
    memory,
    target: masterTarget,
    enter: (via, target) => masterApi.current.enter(via, target),
    exit: (via, opts) => masterApi.current.exit(via, opts),
    toggle: (via) => {
      const go = () => {
        if (masterOnRef.current) masterApi.current.exit(via)
        else masterApi.current.enter(via)
      }
      // 命令面板执行时面板已收起；还开着的菜单与弹层（如版式画廊、主题弹层）先收起再切换，与 ⌥⌘M 同一规则（host.tsx closeOverlaysThen；
      // 真要切换时焦点在输入框里先提交、这几帧里焦点不掉到 body）
      if (via === "palette") closeOverlaysThen(go, { switching: masterOnRef.current || entryRef.current.ok })
      else go()
    },
  }

  // 进入 / 退出提交之后、绘制之前：退出时还原左栏缩略图列表或网格的滚动、单页视图里还有画布自己的滚动与整栏面板内容区的滚动（重新挂载的画布与面板
  // 在这之前已按自己的初值复位，子组件的布局副作用先于这里），焦点交给画布；进入时焦点交给母版实现给的落点（没有落点时交给画布）
  useLayoutEffect(() => {
    const a = after.current
    if (!a) return
    after.current = null
    if (a.focus === "entry") {
      const el = impl?.entryFocus?.(scene, ctxRef.current, masterTarget) ?? null
      if (el) {
        el.focus({ preventScroll: true })
        scrollIntoPanel(el, { ifNeeded: true })
      } else focusCanvasLanding()
      return
    }
    if (urlView === "grid") writeScroll("grid", a.grid ?? 0)
    else {
      writeScroll("rail", a.rail ?? 0)
      if (a.stage) writeStageScroll(a.stage)
      writeScroll("takeover", a.takeover ?? 0)
    }
    if (a.focus === "canvas") focusCanvasLanding()
    else rescueFocus()
  }, [masterOn, session])

  // 进入仅查看形态（只在 data.form 为 auto、按真实视口取形态的状态里会变）即退出母版视图；缩到紧凑形态不退出；再变宽时停在普通视图（rulings §4.25 TB-16）
  useLayoutEffect(() => {
    if (formSetting === "auto" && viewport === "narrow" && masterOnRef.current) masterApi.current.exit("narrow")
  }, [viewport])

  /** 有编辑器外壳的状态才挂宿主缺省的命令面板（放映舞台、查看器、阻断页没有：⌘K 照旧按命令兜底转到演示样张） */
  const PaletteHost = getPaletteHost()

  const current = slideOf(deck, slide)
  const ctx: EditorCtx = {
    scenarioId: resolved.scenarioId,
    stateId: resolved.stateId,
    view,
    setView: (v) => changeView(v, false),
    deck,
    slide,
    current,
    goTo: pick,
    selection: sel,
    setSelection: setSel,
    tool,
    setTool: chooseTool,
    notes,
    setNotes,
    theme,
    accent,
    initial: slide === startSlide && sel === startSel,
    data: cfg.data ?? {},
    mode,
    setMode,
    readonlyDegraded: cfg.rail?.readonlyDegraded,
    canEdit: cfg.toolbar?.canEdit,
    shareReason: shareReasonOf(cfg.inspector?.share, cfg.inspector?.locked),
    scene,
    masterView,
  }
  const ctxRef = useRef(ctx)
  ctxRef.current = ctx
  const fill = (s: Slot | undefined): ReactNode => (typeof s === "function" ? s(ctx) : s)
  // ReactNode 形式的幻灯片叠加层描绘的是状态本身：用户换页或改了选中就不再显示
  const slideOverlay = typeof cfg.slideOverlay === "function" ? cfg.slideOverlay(ctx) : ctx.initial ? cfg.slideOverlay : null

  /** 评审 / 浏览模式的缺省：左栏不提供新建、检查器只读并注明；状态配置里写了的照用 */
  const railCfg = (over?: RailConfig): RailConfig => ({ ...(readOnlyMode ? { newSlide: false } : null), ...cfg.rail, ...over })
  const inspectorCfg = (over?: InspectorConfig): InspectorConfig => ({
    ...(readOnlyMode
      ? {
          readOnly: true,
          notice: <InspectorNotice icon={<Lock {...ICON} aria-hidden="true" />}>{MODE_NOTICE[mode as "review" | "viewer"]}</InspectorNotice>,
          noticeIn: mode === "viewer" ? ("all" as const) : ("design" as const),
        }
      : null),
    ...cfg.inspector,
    ...over,
  })
  const commentTotal = deck.reduce((a, s) => a + (s.comments ?? 0), 0)
  /**
   * 底座画评论钉（stage.commentPins，rulings §4.25 DS-43「编辑模式照常显示评论钉」；TB-83 起缺省开）：状态没写时，以编辑模式起步的状态都画——
   * 以评审 / 只读浏览起步的状态由场景自己画（第 1 批评审态用评论场景的 CommentLayer），评论场景与借用它的状态写 false；
   * 没有评论包（没有「评论」页签、或工具条根本没有评论工具）时不画；换了内容的页不画（页自己写了 pins 的除外，Stage / deckPinsOf）。
   * 开着时钉与左栏、网格的评论角标读同一份线程数据（评论场景登记的数据源，editor/deck.tsx registerCommentPins）
   */
  const pinsOn = (cfg.stage?.commentPins ?? initialMode === "edit") && inspectorCfg().commentsTab !== false && !(cfg.toolbar?.hide ?? []).includes("comment")

  const defaults: RegionDefaults = {
    leftRail: (over) => {
      const r = railCfg(over)
      return (
        <LeftRail
          deck={deck}
          slide={slide}
          onPick={pick}
          view={view}
          onView={toView}
          notes={notes}
          onNotes={setNotes}
          focusToggle={focusToggle}
          status={r.status}
          selected={pageSel ?? r.selected}
          hidden={r.hidden}
          list={fill(r.list)}
          liveComments={pinsOn}
          newSlide={r.newSlide}
          viewToggle={r.viewToggle}
          menu={{ mode, canEdit: cfg.toolbar?.canEdit, readonlyDegraded: r.readonlyDegraded, ...r.menu }}
          drawer={r.drawer}
          width={panels.rail}
          onWidth={(w) => setPanel("rail", w)}
          resizeActive={resizeActive === "rail"}
        />
      )
    },
    stage: () => (
      <Stage
        slide={current}
        sel={sel}
        onSel={setSel}
        notes={notes}
        notesText={cfg.stage?.notesText}
        overlay={slideOverlay}
        cursor={cfg.stage?.cursor}
        readOnly={readOnlyMode}
        notesHeight={panels.notes}
        onNotesHeight={(h) => setPanel("notes", h)}
        resizeActive={resizeActive === "notes"}
        // 评论钉（见上 pinsOn：TB-83 缺省开，DS-43 编辑模式照常显示评论钉）
        commentPins={pinsOn}
        // 状态声明了整栏面板（inspector.takeover）：面板开着时点钉先收起面板、再切到「评论」页签（Stage.tsx StagePins）
        takeover={inspectorCfg().takeover != null && inspectorCfg().takeover !== false}
      />
    ),
    inspector: (over) => {
      const c = inspectorCfg(over)
      return (
        <Inspector
          slide={current}
          sel={sel}
          config={c}
          forKind={startSel}
          data={cfg.data}
          body={fill(c.body)}
          commentsBody={fill(c.commentsBody)}
          takeover={fill(c.takeover)}
          width={panels.inspector}
          onWidth={(w) => setPanel("inspector", w)}
          resizeActive={resizeActive === "inspector"}
        />
      )
    },
    toolbar: (over) => {
      const t: ToolbarConfig = { ...cfg.toolbar, ...over }
      const comments = t.comments ?? commentTotal
      if (readOnlyMode && t.hint) return <HintToolbar>{t.hint}</HintToolbar>
      if (mode === "review") return <ReviewToolbar tool={tool} onTool={chooseTool} comments={comments} canEdit={t.canEdit} />
      if (mode === "viewer") return <ViewerToolbar comments={comments} />
      return (
        <Toolbar
          tool={tool}
          onTool={chooseTool}
          shapesOpen={shapesOpen}
          onShapesOpen={setShapesOpen}
          gridSlide={grid ? slide : undefined}
          disabled={t.disabled}
          shapesView={t.shapesView}
          shapesActive={t.shapesActive}
          tip={t.tip}
          hide={t.hide}
          menu={grid ? undefined : t.menu}
          moreItems={t.moreItems}
        />
      )
    },
    grid: () => (
      <GridView
        deck={deck}
        slide={slide}
        onSelect={pick}
        onOpen={(n) => {
          pick(n)
          changeView("single", true)
        }}
        onView={toView}
        notes={notes}
        onNotes={setNotes}
        focusToggle={focusToggle}
        status={cfg.rail?.status}
        menu={{ mode, canEdit: cfg.toolbar?.canEdit, readonlyDegraded: cfg.rail?.readonlyDegraded, ...cfg.rail?.menu }}
        newSlide={railCfg().newSlide}
        liveComments={pinsOn}
        collaborators={inspectorCfg().collaborators}
        shareReason={shareReasonOf(inspectorCfg().share, inspectorCfg().locked)}
        // 「在普通视图查看引用页」退出回到网格时另外选中的页（exit 的 slides；单页视图里由左栏画），换页即清掉
        selected={pageSel ?? undefined}
      />
    ),
  }
  /**
   * 母版视图里（前端 50/11 §2）：区域一律用登记的母版实现的件（narrow 这类形态外框写了 masterView.frameRegions 的照常套在外面），横幅通道最上面是母版横幅、状态自己的横幅叠在下面；
   * 不在母版视图里时 region()、横幅与布局逐行走原来的分支（不进母版视图的状态画面不变）
   */
  const master = masterOn && impl ? masterRegions({ impl, defaults, cfg, ctx, banner: fill(cfg.banner) }) : null
  const region = (name: keyof RegionDefaults): ReactNode => {
    if (master) return master.region(name)
    const custom = cfg.regions?.[name]
    // 状态自己画的工具条（如第 1 批评审态的评审条）只属于它声明的模式：用户在同一状态里切换了模式（TB-83），工具条按新模式取底座缺省
    if (name === "toolbar" && mode !== initialMode) return defaults.toolbar()
    return custom ? custom(ctx, defaults) : defaults[name]()
  }
  const layers = fill(cfg.layers)
  const banner = resolved.error ? (
    <Banner tone="error" title="找不到场景状态">
      {resolved.error}
    </Banner>
  ) : master ? (
    master.banner
  ) : (
    fill(cfg.banner)
  )

  // 母版视图有自己的工具条：不受状态的 toolbar.hidden / collapse 影响
  const toolbarHidden = !master && !!cfg.toolbar?.hidden
  // 「文件 › 导出…」不可用时（DS-105：查看者、评审者、编辑中被降权）⇧⌘E 同样无效
  const exportOff = !!exportReasonOf({ mode, canEdit: cfg.toolbar?.canEdit, readonlyDegraded: cfg.rail?.readonlyDegraded })
  return (
    <EditorContext.Provider value={ctx}>
      {/* 底座键位（第 3 批转正）：⌘/ ⌘, ⌘K ⇧⌘E F5 ⇧F5 发底座命令（kit/commands.ts useBaseKeys），场景自己先接的不重复处理 */}
      <BaseKeys exportOff={exportOff} />
      {/* 母版视图的 ⌥⌘M 与 Esc 逐层（editor/master/host.tsx；不显示任何东西） */}
      <MasterModeKeys live={() => ({ mode: ctxRef.current.masterView, impl, scene, ctx: ctxRef.current })} />
      {/* 要点卡换了快速样式时，样式的画法以 --qs-* 变量写在这一层（display: contents，不影响布局），画布、左栏与网格的同一张卡一起换样（DS-31） */}
      <QuickStyleScope>
        {/* 跳至画布（02 §7）：页面第一个可聚焦的元素，只在聚焦时出现；画布本身 tabIndex −1，不进 Tab 顺序 */}
        <button
          type="button"
          onClick={() => canvasFocusTarget()?.focus()}
          className="fixed top-2 left-2 z-[60] -translate-y-[200%] rounded-[6px] border border-(--v3-border) bg-(--v3-panel) px-3 py-1.5 text-[12px] leading-4 text-(--v3-text) shadow-(--v3-shadow) outline-none focus-visible:translate-y-0 focus-visible:ring-2 focus-visible:ring-(--v3-accent)"
        >
          跳至画布
        </button>
        {!grid && region("leftRail")}
        <main
          data-v3-anchor="canvas"
          tabIndex={-1}
          className={cn("relative flex min-w-0 flex-1 flex-col bg-(--v3-canvas) outline-none", !grid && !(toolbarHidden && cfg.toolbar?.collapse) && "pb-[72px]")}
        >
          {banner}
          {grid ? (
            // 网格视图里横幅同样占文档流：两个浮动胶囊与网格整体下移（胶囊相对这一层定位）
            <div className="relative flex min-h-0 flex-1 flex-col">{region("grid")}</div>
          ) : (
            region("stage")
          )}
          {!toolbarHidden && region("toolbar")}
          {fill(cfg.canvasOverlay)}
          {master && impl?.Overlay ? <impl.Overlay /> : null}
          {/*
            编辑器跟随（05 §4，rulings §4.25 DS-106）：头像组里他人的头像缺省就是「跟随」按钮（chrome.tsx Collaborators），跟随中在画布列画对方身份色外框与顶部跟随条；
            跟的是谁读底座的跟随键（初值 inspector.collaborators.following），没在跟随时什么都不画。第 3 批转正时由 present/follow.tsx 并入
          */}
          <EditorFollow people={inspectorCfg().collaborators?.people ?? [ME, WANG, LI]} init={inspectorCfg().collaborators?.following ?? null} />
          {/* 更换版式后的轻提示（不匹配 / 已重置，03-27）：检查器「版式」字段与画廊写场景状态，这里常驻一份 */}
          <LayoutToasts />
          {/* ⌥⌘M 不可用时的轻提示「母版视图：〈原因〉」（只在有提示时渲染） */}
          <MasterModeToast toast={hintToast} />
        </main>
        {!grid && region("inspector")}
        {/*
          缩略图右键（左栏与网格同一份，03-05）：场景自己挂了同一锚点的右键菜单时让给场景。
          只读时改文档的条目都不可用，原因写在菜单顶部一行（TB-22），按模式取与主菜单同一口径：评审「评审模式下不可用」、只读浏览「只有查看权限」、降权写 readonlyDegraded（「需要编辑权限」）
        */}
        <ThumbContextMenu onPick={pick} deckSize={deck.length} readOnly={readOnlyMode || !!cfg.rail?.readonlyDegraded} reason={THUMB_RO_REASON[mode] ?? cfg.rail?.readonlyDegraded} />
        {/* 浮层平面：kit 浮层都挂到 v3 根节点（Portal），这里只兜住误放的普通元素，不影响布局与点按 */}
        {layers ? <div className="pointer-events-none fixed inset-0 z-40">{layers}</div> : null}
        {/* 宿主缺省的命令面板（editor/palette-host.ts，命令面板样张登记）：每个有编辑器外壳的状态都在原地打开（⌘K、主菜单「帮助 › 命令面板…」） */}
        {PaletteHost && !entry.silent ? <PaletteHost /> : null}
      </QuickStyleScope>
    </EditorContext.Provider>
  )
}

/**
 * 焦点交给画布：落点与 kit canvasFocusTarget() 同一口径（关浮层、命令面板、轻提示 × 之后无处可回时的落点）——普通视图的画布（Stage，tabIndex −1）；
 * 画布接不住焦点时（没有 tabIndex：网格视图没有画布、母版视图的画布外框、放大后的滚动画布）交给两种视图共用的画布列 main（tabIndex −1）。
 * 2026-10-29 补完（复验 R1-N6）：原来先直接聚焦 [data-v3-anchor="stage"]，放大后的滚动画布没有 tabindex，但 Chrome 让可滚动的容器接得住焦点，
 * 母版往返后焦点落在它上面、画出 2px 焦点环，与普通视图里关浮层的落点（main）不是同一处
 */
function focusCanvasLanding() {
  for (const el of [canvasFocusTarget(), document.querySelector<HTMLElement>('[data-v3-anchor="canvas"]')]) {
    if (!el) continue
    el.focus({ preventScroll: true })
    if (document.activeElement === el) return
  }
}

/** 底座键位放在编辑器上下文里（发命令要用当前状态的场景仓） */
function BaseKeys({ exportOff }: { exportOff: boolean }) {
  useBaseKeys({ editor: true, exportOff })
  return null
}
