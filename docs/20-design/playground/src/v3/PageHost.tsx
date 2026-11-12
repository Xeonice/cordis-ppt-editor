import { useMemo, useRef, useState, type ReactNode } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { Banner } from "./kit/Banner"
import { COMMAND_ENTRY, setCommandFallback, useBaseKeys } from "./kit/commands"
import { ImportDialogLayer } from "./kit/importDialog"
import { carryInteraction, holdFocusDuring, resetInteraction } from "./kit/layer"
import { ShellLayout, type ShellLayoutProps } from "./kit/ShellLayout"
import { createSceneStore } from "./editor/scene"
import { HomeBody } from "./HomeBody"
import { LibraryLayers, LibraryToasts } from "./kit/library"
import { PageContext, type PageCtx } from "./page/context"
import { hostPath, isShellHost, useV3Params, type V3Host } from "./params"
import { hostHref, providerOf, resolvePageState, scenarioHref, type ResolvedPage } from "./scenario-registry"
import type { EmbedConfig, PageSlot } from "./scenarios/types"
import { V3Root } from "./V3Root"

/**
 * 页面级宿主（第 3 批，rulings §4.25 DS-71…DS-73）：#/v3/<宿主>?state=<场景>.<状态>&theme=dark|light&accent=blue|violet|coral
 * - 应用壳 home / documents / templates / admin/plugins：kit ShellLayout（首页那套左栏 220 + 顶栏 56 + 横幅通道），状态的 page.shell 给属性、page.body 给主区内容；
 *   home 不带 state 时是已拍板的首页（HomeBody）。
 * - page：整屏 bare（画布底色、无导航），page.body 是整屏内容（登录页、回调与错误页，常放 kit BlockingPage）。
 * - embed：中性的「宿主页面」外框 + iframe 容器（page.embed：容器尺寸与 iframe 里的页面；URL 参数 frame=宽x高 临时改尺寸）。
 * 应用壳四个宿主另挂一层「导入」对话框（kit ImportDialogLayer：导入场景登记的对话框，DS-140；顶栏「导入 .pptx」与主区拖入落区经 kit importDialog 打开它，状态数据 page.data.importDialog 让它一出现就开着）。
 * 每次换状态整页按 key 重新挂载：新建场景仓（kit useSceneState）、复位「有没有人操作过」（新状态里一出现就打开的浮层不抢焦点）。
 * state 写错或这个宿主还没有场景时，顶部出「找不到场景状态」横幅（同编辑器）；状态属于别的宿主时转过去（参数原样带上）。
 */
export function V3PageHost({ host }: { host: V3Host }) {
  const { stateParam } = useV3Params()
  const resolved = useMemo(() => resolvePageState(host, stateParam), [host, stateParam])
  const location = useLocation()
  if (resolved.redirect) return <Navigate to={hostHref(resolved.redirect, location.search)} replace />
  return (
    <V3Root className="flex h-dvh w-full overflow-hidden">
      <PageApp key={resolved.key} host={host} resolved={resolved} />
    </V3Root>
  )
}

/** App.tsx 的页面级宿主路由：按路径取宿主（/v3/documents、/v3/templates、/v3/admin/plugins、/v3/page、/v3/embed） */
export function V3PageRoute() {
  const { pathname } = useLocation()
  const host = (pathname.replace(/^\/v3\//, "").replace(/\/$/, "") || "page") as V3Host
  return <V3PageHost host={host} />
}

/** 各应用壳宿主的缺省属性（状态的 page.shell 逐项覆盖）：当前导航项与标题 */
const SHELL_DEFAULTS: Record<string, Partial<ShellLayoutProps>> = {
  home: { current: "home", title: "首页" },
  // 文档列表不带筛选时落「最近」（rulings §4.25 DS-79）
  documents: { current: "recent", title: "最近" },
  // 模板库是首页的下一层（DS-72）：左栏「首页」保持当前项
  templates: { current: "home", title: "模板" },
  "admin/plugins": { current: null, title: "插件", actions: null },
}

function PageApp({ host, resolved }: { host: V3Host; resolved: ResolvedPage }) {
  const { theme, accent } = useV3Params()
  const page = resolved.page
  const navigate = useNavigate()
  const route = useRef({ navigate, theme, accent })
  route.current = { navigate, theme, accent }
  const [scene] = useState(() => {
    resetInteraction()
    const store = createSceneStore()
    // 底座命令没有场景接住时（第 3 批转正起页面宿主也发命令：账户菜单「偏好设置… / 键盘快捷键 / 退出登录」、⌘, ⌘/）：有场景声明演示它（provides，可按宿主写）就转过去，
    // 由用户操作触发（carryInteraction，新状态里随之打开的面板照常接住焦点）；当前就是声明它的场景、或没有声明时照旧（菜单只关闭）。同编辑器（Editor.tsx）
    setCommandFallback(store, (id) => {
      const p = providerOf(id, "edit", host)
      if (!p || p.scenario.id === resolved.scenarioId) return false
      const r = route.current
      carryInteraction(COMMAND_ENTRY[id])
      holdFocusDuring()
      r.navigate(scenarioHref(p.scenario, p.state, { theme: r.theme, accent: r.accent }))
      return true
    })
    return store
  })
  const ctx: PageCtx = { host, scenarioId: resolved.scenarioId, stateId: resolved.stateId, data: page.data ?? {}, theme, accent, scene }
  const fill = (s: PageSlot | undefined): ReactNode => (typeof s === "function" ? s(ctx) : s)
  const error = resolved.error ? (
    <Banner tone="error" title="找不到场景状态">
      {resolved.error}
    </Banner>
  ) : null

  let content: ReactNode
  // 首页宿主的状态没给 body 时是已拍板首页的主区（HomeBody，2026-10-22 起即开始页 M2 的画法）：它的卡片菜单要的轻提示与浮层（永久删除确认、从卡片分享）随之补上，状态自己给了的照用
  const homeDefault = host === "home" && page.body == null && !resolved.error
  if (isShellHost(host)) {
    const shell = { ...SHELL_DEFAULTS[host], ...page.shell }
    const body = fill(page.body) ?? (homeDefault ? <HomeBody /> : null)
    content = (
      <ShellLayout {...shell} banner={error ?? shell.banner} overlay={fill(page.overlay) ?? (homeDefault ? <LibraryToasts /> : null)}>
        {body}
      </ShellLayout>
    )
  } else if (host === "embed") {
    content = <EmbedFrame config={page.embed} error={error} overlay={fill(page.overlay)} />
  } else {
    // page：整屏 bare。主区兼作焦点兜底（kit canvasFocusTarget 认 data-v3-anchor="canvas"），浮层关闭后焦点不掉到 body
    content = (
      <main data-v3-anchor="canvas" tabIndex={-1} className="relative flex min-w-0 flex-1 flex-col bg-(--v3-canvas) outline-none">
        {error}
        {fill(page.body)}
        {fill(page.overlay)}
      </main>
    )
  }
  return (
    <PageContext.Provider value={ctx}>
      {/* 底座键位（第 3 批转正）：⌘, ⌘/ 发底座命令（应用壳页面的 ⌘K 是聚焦搜索框，ShellLayout 自己接） */}
      <PageBaseKeys />
      {content}
      {fill(page.layers) ?? (homeDefault ? <LibraryLayers /> : null)}
      {/* 「导入」对话框（DS-140、TB-179）：应用壳页面上由顶栏「导入 .pptx」与拖入落区打开，关着时不出 DOM */}
      {isShellHost(host) && <ImportDialogLayer />}
    </PageContext.Provider>
  )
}

function PageBaseKeys() {
  useBaseKeys({ editor: false })
  return null
}

/** 容器尺寸：URL 参数 frame=宽x高 优先，其次状态的 page.embed.size，缺省 1200 × 720 */
function useFrameSize(config?: EmbedConfig): [number, number] {
  const { frame } = useV3Params()
  const m = frame?.match(/^(\d{2,4})x(\d{2,4})$/)
  if (m) return [Number(m[1]), Number(m[2])]
  return config?.size ?? [1200, 720]
}

/**
 * 嵌入宿主的外框（DS-73：中性的宿主外框，只是演示容器，不代表任何真实产品）：画布底色上一行说明（「宿主页面」+ 容器尺寸），
 * 下面是 iframe 容器（1px 虚线外框表示容器边界）。iframe 加载同一个 playground 的另一个宿主路由，带 embedded=1，主题与强调色沿用外层，
 * 视口就是容器尺寸——编辑器按容器宽度取完整 / 紧凑 / 仅查看形态（DS-17、DS-21）。外框用 panel 底，与 iframe 里的画布底分开。
 * 产品的 iframe 带 sandbox 与 allow=fullscreen（50/12 §9）；样张同源加载、不写 sandbox（allow-scripts + allow-same-origin 会让浏览器告警，等于没有隔离）
 */
function EmbedFrame({ config, error, overlay }: { config?: EmbedConfig; error: ReactNode; overlay: ReactNode }) {
  const { theme, accent } = useV3Params()
  const [w, h] = useFrameSize(config)
  const src = useMemo(() => {
    if (!config) return null
    const q = new URLSearchParams()
    if (config.src.state) q.set("state", config.src.state)
    for (const [k, v] of Object.entries(config.src.params ?? {})) q.set(k, v)
    q.set("theme", theme)
    q.set("accent", accent)
    q.set("embedded", "1")
    return `${window.location.pathname}${window.location.search}#${hostPath(config.src.host)}?${q.toString()}`
  }, [config, theme, accent])
  return (
    <main data-v3-anchor="canvas" tabIndex={-1} className="relative flex min-w-0 flex-1 flex-col overflow-auto bg-(--v3-panel) outline-none">
      {error}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 py-6">
        <div className="flex items-center justify-between gap-4 text-[12px] leading-4 text-(--v3-text-2)" style={{ width: w }}>
          <span>{config?.label ?? "宿主页面（演示容器，不代表任何真实产品）"}</span>
          <span className="tabular-nums">{config?.frameLabel ?? `iframe ${w} × ${h}`}</span>
        </div>
        <div className="mt-2 shrink-0 rounded-[4px] outline-1 outline-offset-2 outline-(--v3-border) outline-dashed" style={{ width: w, height: h }}>
          {src && (
            <iframe
              title="嵌入的 Cordex"
              src={src}
              width={w}
              height={h}
              allow="fullscreen; clipboard-write"
              className="block rounded-[4px] border-0 bg-(--v3-canvas)"
            />
          )}
        </div>
      </div>
      {overlay}
    </main>
  )
}
