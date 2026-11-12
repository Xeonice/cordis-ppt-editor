import { useEffect, useRef, useState, type ReactNode } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  ChevronDown, Copy, Cpu, Eye, Hourglass, Keyboard, Loader2, Lock, Puzzle, RefreshCw, ShieldCheck, TriangleAlert, X,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AppBar, DesignBar, EditorShell, Inspector, InspectorEmptyHint, SlideCanvas, SlideContent, StatusBar, StatusText, ThumbnailRail } from "@/components/editor"
import { EditorRibbon, type RibbonTabValue } from "@/components/editor/Ribbon"
import { MilestoneTag } from "@/components/editor/ribbon/primitives"
import { PluginTile, ScopeBadge, SessionStatusText, type SessionStatus } from "@/components/plugin-bits"
import { PlatformRoleProvider } from "@/components/user-menu"
import { cn } from "@/lib/utils"
import { collaborators, documentTitle, slides } from "@/lib/mock-data"
import { HOST_VERSION, catalog, findPlugin, sessionOnlyIncompatible, sourceLabel, type CatalogPlugin } from "@/lib/plugin-data"

/**
 * 03-screens/09 个人插件面板（PRD 09 PM-10、PM-11、PM-12、PM-08；rulings §4.23；G-86 / G-87）。
 * 本面板是 PS-11 的失败可见面（个人插件面板，PRD PM-10）：三分组——本部署统一启用（只读）/ 我的界面插件（个人开关，即时生效，随账号保存）/
 * 本文档缺少的插件（仅缺插件时出现）。入口：应用栏「⋯ › 插件管理器」、状态栏插件图标、快捷键面板冲突条目、缺插件横幅「查看详情」。
 * 普通用户看不到被拒插件，也不能改部署策略；管理员在这里与别人一样，只多一个「去管理 › 插件」。
 * 横幅（缺插件 PM-12、管理员改了插件设置 PM-08）画在编辑器工具卡里，与连接 / 权限横幅同层级、不叠加。
 */

type DemoState =
  | "default" | "failed" | "failed-admin" | "user-off" | "conflict" | "readonly" | "no-optional"
  | "reload-banner" | "missing-disabled" | "missing-undeclared" | "missing-version" | "missing-detail"
  | "loading" | "error"

const stateOptions: { value: DemoState; label: string }[] = [
  { value: "default", label: "默认" },
  { value: "failed", label: "有启动失败 · 详情与重试" },
  { value: "failed-admin", label: "启动失败 · 管理员视角" },
  { value: "user-off", label: "个人关闭了「演示激光笔」" },
  { value: "conflict", label: "快捷键冲突 · 从快捷键面板进入" },
  { value: "readonly", label: "只读角色（查看者）" },
  { value: "no-optional", label: "空 · 管理员未开放可选插件" },
  { value: "reload-banner", label: "管理员刚改动 · 重新加载横幅" },
  { value: "missing-disabled", label: "缺插件横幅 · 管理员已停用" },
  { value: "missing-undeclared", label: "缺插件横幅 · 本部署未部署" },
  { value: "missing-version", label: "缺插件横幅 · 版本过旧" },
  { value: "missing-detail", label: "缺少的插件 · 详情（管理员）" },
  { value: "loading", label: "加载中" },
  { value: "error", label: "加载失败" },
]

const BANNER_STATES: DemoState[] = ["reload-banner", "missing-disabled", "missing-undeclared", "missing-version"]
const MISSING_STATES: DemoState[] = ["missing-disabled", "missing-undeclared", "missing-version", "missing-detail"]
const ADMIN_STATES: DemoState[] = ["failed-admin", "missing-detail"]

const CORE_IDS = ["@cordexjs/kernel", "@cordexjs/model-slide", "@cordexjs/store-yjs", "@cordexjs/render-dom"]
/** 本部署统一启用：内容级 + 强制启用的界面级（被拒与停用的不进会话） */
const DEPLOY_IDS = [
  "@cordexjs/slide-ui", "@cordexjs/ooxml-pptx", "@cordexjs/slide-render-chart", "@cordexjs/comments", "@cordexjs/collab-offline-idb",
  "cordex:watermark", "acme:data-binding", "acme:flow-shapes", "acme:brand-kit", "beta:live-poll",
]
const MINE_IDS = ["@cordexjs/i18n-en", "cordex:presenter-laser", "cordex:focus-search", "cordex:word-count"]
/** 声明了写能力位的内容插件：只读角色下其编辑类命令不可用 */
const WRITE_CMD_IDS = new Set(["@cordexjs/comments", "acme:data-binding", "acme:flow-shapes", "beta:live-poll"])

interface Diagnostic {
  code: string
  summary: string
  traceId: string
}

const diagnostics: Record<string, Diagnostic> = {
  "beta:live-poll": { code: "plugin.activate_failed", summary: "激活超时：投票服务 poll.betalabs.io 在 10 s 内无响应", traceId: "4bf92f3577b34da6a3ce929d0e0e4736" },
  "cordex:presenter-laser": { code: "plugin.contribution_failed", summary: "render.overlay 贡献抛出异常：Cannot read properties of undefined (reading 'stage')", traceId: "a1c05e7f0b9d4c2e8f6a3b1d2c4e5f60" },
}

interface MissingEntry {
  id: string
  name: string
  reason: "disabled" | "undeclared" | "version"
  need: string
  have?: string
  count: number
  pages: string
}

const missingByReason: Record<MissingEntry["reason"], MissingEntry> = {
  disabled: { id: "acme:qr-shape", name: "二维码形状", reason: "disabled", need: "1.0", count: 3, pages: "第 1 页" },
  undeclared: { id: "acme:qr-shape", name: "二维码形状", reason: "undeclared", need: "1.2", count: 3, pages: "第 1 页" },
  version: { id: "acme:qr-shape", name: "二维码形状", reason: "version", need: "1.2", have: "1.0", count: 3, pages: "第 1 页" },
}
const missingDetailList: MissingEntry[] = [
  { id: "acme:qr-shape", name: "二维码形状", reason: "disabled", need: "1.0", count: 3, pages: "第 1 页" },
  { id: "acme:org-chart", name: "组织架构图", reason: "undeclared", need: "2.0", count: 1, pages: "第 4 页" },
  { id: "acme:data-binding", name: "数据图表增强", reason: "version", need: "1.5", have: "1.4.2", count: 2, pages: "第 3、6 页" },
]

export function EditorPlugins() {
  const [searchParams] = useSearchParams()
  const initial = (() => {
    const s = searchParams.get("state")
    return stateOptions.some((o) => o.value === s) ? (s as DemoState) : "default"
  })()
  const [demo, setDemo] = useState<DemoState>(initial)
  const isAdmin = ADMIN_STATES.includes(demo)
  return (
    <PlatformRoleProvider value={isAdmin ? "admin" : "member"}>
      <PluginsScreen key={demo} demo={demo} onDemo={setDemo} isAdmin={isAdmin} />
    </PlatformRoleProvider>
  )
}

function PluginsScreen({ demo, onDemo, isAdmin }: { demo: DemoState; onDemo: (v: DemoState) => void; isAdmin: boolean }) {
  const navigate = useNavigate()
  const [ribbonTab, setRibbonTab] = useState<RibbonTabValue>("home")
  const [open, setOpen] = useState(!BANNER_STATES.includes(demo))
  const [bannerOpen, setBannerOpen] = useState(BANNER_STATES.includes(demo) || demo === "missing-detail")
  const [reloading, setReloading] = useState(false)
  const [live, setLive] = useState("")
  const failedDemo = demo === "failed" || demo === "failed-admin"
  const readOnly = demo === "readonly"
  const missing = MISSING_STATES.includes(demo)
  const [session, setSession] = useState<Record<string, SessionStatus>>(() => ({
    "@cordexjs/slide-render-chart": "lazy",
    "acme:brand-kit": "pending",
    ...(failedDemo ? { "beta:live-poll": "failed", "cordex:presenter-laser": "failed", "acme:gantt": "incompatible" } : {}),
  }))
  const [mine, setMine] = useState<Record<string, boolean>>(() => ({
    "@cordexjs/i18n-en": true, "cordex:presenter-laser": demo !== "user-off", "cordex:focus-search": true, "cordex:word-count": false,
  }))
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(failedDemo ? ["beta:live-poll"] : []))
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const retryTimer = useRef<number | null>(null)
  useEffect(() => () => { if (retryTimer.current) window.clearTimeout(retryTimer.current) }, [])

  const statusOf = (id: string): SessionStatus => session[id] ?? "running"

  function retry(p: CatalogPlugin) {
    setRetryingId(p.id)
    setLive(`正在重试「${p.name}」`)
    retryTimer.current = window.setTimeout(() => {
      setRetryingId(null)
      setSession((prev) => ({ ...prev, [p.id]: "running" }))
      setLive(`「${p.name}」已恢复运行`)
      toast.success(`「${p.name}」已在本会话恢复运行`)
    }, 1200)
  }

  function toggleMine(p: CatalogPlugin, on: boolean) {
    setMine((prev) => ({ ...prev, [p.id]: on }))
    if (!on) setSession((prev) => { const n = { ...prev }; delete n[p.id]; return n })
    setLive(`已为你${on ? "开启" : "关闭"}「${p.name}」`)
    toast(`已为你${on ? "开启" : "关闭"}「${p.name}」`, {
      description: "立即生效，只影响你；随账号保存，换设备也沿用",
      action: { label: "撤销", onClick: () => setMine((prev) => ({ ...prev, [p.id]: !on })) },
    })
  }

  function reload() {
    setReloading(true)
    window.setTimeout(() => { setReloading(false); setBannerOpen(false); toast.success("已重新加载，按新的插件设置装配") }, 1400)
  }

  /** 需要处理的排在前面：启动失败 → 版本不兼容 → 等待依赖 → 其余（保持声明顺序） */
  const attention: Partial<Record<SessionStatus, number>> = { failed: 0, incompatible: 1, pending: 2 }
  const deployItems = DEPLOY_IDS.map((id) => findPlugin(id)!)
    .concat(failedDemo ? [sessionOnlyIncompatible] : [])
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (attention[statusOf(a.p.id)] ?? 9) - (attention[statusOf(b.p.id)] ?? 9) || a.i - b.i)
    .map(({ p }) => p)
  const problemCount = deployItems.filter((p) => attention[statusOf(p.id)] !== undefined).length
  const mineItems = demo === "no-optional" ? [] : MINE_IDS.map((id) => findPlugin(id)!)
  const sessionRows = [...deployItems, ...mineItems.filter((p) => mine[p.id])]
  const countBy = (st: SessionStatus) => sessionRows.filter((p) => statusOf(p.id) === st).length
  const failedCount = countBy("failed")
  const title = missing ? "2026 秋季发布会 · 签到页.pptx" : documentTitle
  const missingEntry = demo === "missing-disabled" ? missingByReason.disabled : demo === "missing-undeclared" ? missingByReason.undeclared : demo === "missing-version" ? missingByReason.version : null

  const banner = !bannerOpen ? null : demo === "reload-banner" ? (
    <Alert role="status" aria-live="polite" className="m-2 shrink-0 border-info/40 bg-info-muted text-info-foreground">
      <RefreshCw />
      <AlertTitle>管理员更新了插件设置，重新加载后生效</AlertTitle>
      <AlertDescription className="text-info-foreground/80">未同步的更改会先保存再刷新；你可以先继续编辑，稍后再重新加载</AlertDescription>
      <AlertAction className="flex items-center gap-1">
        <Button size="xs" variant="outline" className="border-info-foreground/40 text-info-foreground" disabled={reloading} onClick={reload}>
          {reloading ? <><Loader2 className="animate-spin" /> 正在保存更改…</> : <><RefreshCw /> 重新加载</>}
        </Button>
        <Button variant="ghost" size="icon-xs" className="text-info-foreground" aria-label="稍后再说" disabled={reloading} onClick={() => setBannerOpen(false)}><X /></Button>
      </AlertAction>
    </Alert>
  ) : missingEntry || demo === "missing-detail" ? (
    <MissingBanner entry={missingEntry} multiple={demo === "missing-detail" ? missingDetailList : undefined} isAdmin={isAdmin} onDetail={() => setOpen(true)} onAdmin={() => navigate("/admin/plugins")} onDismiss={() => setBannerOpen(false)} />
  ) : null

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar title="插件面板（个人）" spec="03-screens/09" state={demo} onStateChange={(v) => onDemo(v as DemoState)} stateOptions={stateOptions} />
      <EditorShell
        appBar={
          <AppBar onBack={() => navigate("/home")} title={title} collaborators={collaborators.filter((c) => !c.isSelf)} status={{ kind: "sync", state: "synced" }}
            badges={readOnly ? <span className="inline-flex h-5 items-center gap-1 rounded-full bg-foreground/[0.06] px-2 text-2xs text-muted-foreground"><Eye className="size-3" aria-hidden="true" />仅查看</span> : undefined}
          />
        }
        ribbon={
          <div className="flex flex-col">
            {banner}
            <EditorRibbon value={ribbonTab} onValueChange={setRibbonTab} currentMasterId={slides[0]!.masterId} currentLayoutId={slides[0]!.layoutId} />
          </div>
        }
        thumbnailRail={<ThumbnailRail mode="normal" slides={missing ? slides.map((s, i) => (i === 0 ? { ...s, warningCount: 3 } : s)) : slides} currentSlideId={slides[0]!.id} />}
        canvas={
          <SlideCanvas hideZoomBar>
            {missing ? <SignInSlide entry={missingEntry ?? missingDetailList[0]!} /> : <SlideContent slide={slides[0]!} fill />}
          </SlideCanvas>
        }
        inspector={<Inspector value="properties" onValueChange={() => {}} tabs={[{ value: "properties", label: "属性", content: <InspectorEmptyHint>未选中对象</InspectorEmptyHint> }]} />}
        statusBar={
          <StatusBar
            left={[`第 1/${slides.length} 页`, readOnly ? "只读浏览中" : "未选中对象"]}
            right={[
              <StatusText key="s" status={{ kind: "sync", state: "synced" }} variant="dot" />,
              <PluginStatusEntry key="p" failed={failedCount} missing={missing} onOpen={() => setOpen(true)} />,
            ]}
          />
        }
      />

      <p aria-live="polite" className="sr-only">{live}</p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[calc(100dvh-5rem)] grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-2xl"
          onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).focus() }}
        >
          <DialogHeader className="gap-1.5 px-6 pt-6 pb-3">
            <DialogTitle className="flex items-center gap-2"><Puzzle className="size-4 text-muted-foreground" aria-hidden="true" />插件</DialogTitle>
            <DialogDescription>本会话已装配的插件。「我的界面插件」只影响你，不影响协作者，也不会进入文档。</DialogDescription>
            {demo !== "loading" && demo !== "error" && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs">
                <SessionStatusText status="running">运行中 {countBy("running") + CORE_IDS.length}</SessionStatusText>
                {countBy("failed") > 0 && <SessionStatusText status="failed">启动失败 {countBy("failed")}</SessionStatusText>}
                {countBy("pending") > 0 && <SessionStatusText status="pending">等待依赖 {countBy("pending")}</SessionStatusText>}
                {countBy("incompatible") > 0 && <SessionStatusText status="incompatible">版本不兼容 {countBy("incompatible")}</SessionStatusText>}
                {countBy("lazy") > 0 && <SessionStatusText status="lazy">未加载 {countBy("lazy")}</SessionStatusText>}
                {readOnly && <span className="inline-flex items-center gap-1 text-muted-foreground"><Eye className="size-3.5" aria-hidden="true" />只读：编辑类命令不可用</span>}
                {isAdmin && (
                  <Button variant="link" size="xs" className="ml-auto h-auto p-0 text-xs" onClick={() => navigate("/admin/plugins")}><ShieldCheck /> 去管理 › 插件</Button>
                )}
              </div>
            )}
          </DialogHeader>

          {demo === "error" ? (
            <Empty className="py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon"><TriangleAlert className="text-destructive" /></EmptyMedia>
                <EmptyTitle>插件列表加载失败</EmptyTitle>
                <EmptyDescription>编辑器本身不受影响；已装配的插件照常运行</EmptyDescription>
              </EmptyHeader>
              <EmptyContent><Button variant="outline" onClick={() => onDemo("default")}>重试</Button></EmptyContent>
            </Empty>
          ) : demo === "loading" ? (
            <div className="flex flex-col gap-2 px-6 pb-6" aria-busy="true">
              <Skeleton className="h-3 w-28" />
              <div className="cordex-group flex flex-col">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={cn("flex items-center gap-3 px-3 py-3", i > 0 && "border-t border-foreground/5")}>
                    <Skeleton className="size-8 rounded-lg" />
                    <div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-3 w-1/2" /></div>
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ScrollArea className="min-h-0 [&_[data-slot=scroll-area-viewport]>div]:block!">
              <div className="flex flex-col gap-4 px-6 pb-6">
                {demo === "conflict" && (
                  <Alert role="status" className="border-warning/40 bg-warning-muted text-warning-foreground">
                    <Keyboard />
                    <AlertTitle>快捷键冲突：<span className="font-mono">⌘−</span></AlertTitle>
                    <AlertDescription className="text-warning-foreground/80">内置「缩小」与插件「聚焦搜索」绑定了同一快捷键，当前由内置命令生效。「聚焦搜索」是你的界面插件，可以为你关闭。</AlertDescription>
                  </Alert>
                )}

                {(missing && demo === "missing-detail") && (
                  <Group title="本文档缺少的插件" count={missingDetailList.length} note="相关内容以占位显示、数据原样保留；可选中、移动、删除，不能编辑内部">
                    {missingDetailList.map((m, i) => <MissingRow key={m.id} entry={m} first={i === 0} isAdmin={isAdmin} onAdmin={() => navigate("/admin/plugins")} />)}
                  </Group>
                )}

                {demo === "no-optional" && (
                  <p className="flex items-center gap-2 rounded-xl bg-foreground/[0.04] px-3 py-2 text-xs text-muted-foreground">
                    <Lock className="size-3.5 shrink-0" aria-hidden="true" />可选插件由管理员设置：本部署目前没有开放给个人开关的插件
                  </p>
                )}

                {mineItems.length > 0 && (
                  <Group title={<>我的界面插件 <MilestoneTag>M3</MilestoneTag></>} count={mineItems.length} note="只影响你自己；切换即时生效，随账号保存">
                    {mineItems.map((p, i) => (
                      <PluginRow
                        key={p.id}
                        plugin={p}
                        first={i === 0}
                        status={mine[p.id] ? statusOf(p.id) : "off"}
                        expanded={expanded.has(p.id)}
                        onExpand={() => setExpanded((s) => toggleSet(s, p.id))}
                        busy={retryingId !== null}
                        retrying={retryingId === p.id}
                        onRetry={() => retry(p)}
                        highlight={demo === "conflict" && p.id === "cordex:focus-search"}
                        isAdmin={isAdmin}
                        subline={
                          <>管理员默认{p.userDefault === "on" ? "开" : "关"}{mine[p.id] !== (p.userDefault === "on") && <span className="text-foreground/80"> · 你已{mine[p.id] ? "开启" : "关闭"}</span>}</>
                        }
                        control={
                          <Switch
                            checked={!!mine[p.id]}
                            disabled={retryingId !== null}
                            onCheckedChange={(v) => toggleMine(p, v)}
                            aria-label={`${p.name}，个人设置，只影响你`}
                          />
                        }
                        conflictNote={demo === "conflict" && p.id === "cordex:focus-search" ? (
                          <span className="flex flex-wrap items-center gap-1.5 text-xs text-warning-foreground">
                            <TriangleAlert className="size-3.5" aria-hidden="true" />与内置「缩小」冲突（⌘−）
                            <Button size="xs" variant="outline" onClick={() => toggleMine(p, false)} disabled={!mine[p.id]}>为我关闭</Button>
                          </span>
                        ) : undefined}
                        onTurnOffForMe={() => toggleMine(p, false)}
                        userChoice
                      />
                    ))}
                  </Group>
                )}

                <Group title="本部署统一启用" count={deployItems.length + CORE_IDS.length} badge={<span className="inline-flex h-5 items-center gap-1 rounded-full bg-foreground/[0.06] px-2 text-2xs font-medium text-foreground/70"><Lock className="size-3" aria-hidden="true" />由管理员统一</span>} note="会影响文档内容或渲染的插件，所有协作者一致；个人不能关闭">
                  {deployItems.map((p, i) => (
                    <DeployRowSlot key={p.id} before={i === problemCount ? <CoreRow first={i === 0} expanded={expanded.has("core")} onExpand={() => setExpanded((s) => toggleSet(s, "core"))} /> : null}>
                    <PluginRow
                      plugin={p}
                      first={i === 0 && problemCount > 0}
                      status={statusOf(p.id)}
                      expanded={expanded.has(p.id)}
                      onExpand={() => setExpanded((s) => toggleSet(s, p.id))}
                      busy={retryingId !== null}
                      retrying={retryingId === p.id}
                      onRetry={() => retry(p)}
                      isAdmin={isAdmin}
                      readOnlyNote={readOnly && WRITE_CMD_IDS.has(p.id) ? "编辑类命令不可用（你只有查看权限）" : undefined}
                      subline={p.scope === "ui" && !p.scopeUpgraded ? "强制启用的界面插件" : undefined}
                    />
                    </DeployRowSlot>
                  ))}
                </Group>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function toggleSet(s: Set<string>, id: string) {
  const n = new Set(s)
  if (n.has(id)) n.delete(id)
  else n.add(id)
  return n
}

function Group({ title, count, note, badge, children }: { title: ReactNode; count: number; note?: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">{title} <span className="font-normal tabular-nums">{count}</span></h2>
        {badge}
        {note && <p className="basis-full text-xs text-muted-foreground/80">{note}</p>}
      </div>
      <div className="cordex-group flex flex-col overflow-hidden">{children}</div>
    </section>
  )
}

/** 内核必需与契约必需合并为一行，展开看成员；它们不会失败到只影响单个插件，放在一起减少噪音 */
function DeployRowSlot({ before, children }: { before: ReactNode; children: ReactNode }) {
  return <>{before}{children}</>
}

function CoreRow({ first, expanded, onExpand }: { first: boolean; expanded: boolean; onExpand: () => void }) {
  const core = CORE_IDS.map((id) => findPlugin(id)!)
  return (
    <div className={cn(!first && "border-t border-foreground/5")}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <PluginTile plugin={{ icon: Cpu }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">核心组件 <span className="text-xs font-normal text-muted-foreground">{core.length} 个 · 内置</span></p>
          <p className="truncate text-xs text-muted-foreground">{core.map((p) => p.name).join("、")}</p>
        </div>
        <SessionStatusText status="running" />
        <Button variant="ghost" size="icon-xs" aria-label={expanded ? "收起核心组件" : "展开核心组件"} aria-expanded={expanded} onClick={onExpand}><ChevronDown className={cn("transition-transform", expanded && "rotate-180")} /></Button>
      </div>
      <Collapsible open={expanded}>
        <CollapsibleContent className="px-3 pb-2.5 pl-14">
          <ul className="flex flex-col gap-1 text-xs">
            {core.map((p) => (
              <li key={p.id} className="flex items-center gap-2"><span className="font-medium">{p.name}</span><span className="font-mono text-muted-foreground">{p.id}@{p.version}</span></li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function PluginRow({
  plugin: p, first, status, expanded, onExpand, busy, retrying, onRetry, isAdmin, control, subline, readOnlyNote, highlight, conflictNote, userChoice, onTurnOffForMe,
}: {
  plugin: CatalogPlugin
  first: boolean
  status: SessionStatus
  expanded: boolean
  onExpand: () => void
  busy: boolean
  retrying: boolean
  onRetry: () => void
  isAdmin: boolean
  control?: ReactNode
  subline?: ReactNode
  readOnlyNote?: string
  highlight?: boolean
  conflictNote?: ReactNode
  userChoice?: boolean
  onTurnOffForMe?: () => void
}) {
  const navigate = useNavigate()
  const diag = diagnostics[p.id]
  const dep = p.injects?.map((d) => findPlugin(d.providerId)).find((d) => d && d.policy === "disabled")
  return (
    <div className={cn("relative", !first && "border-t border-foreground/5", highlight && "bg-warning-muted/60")}>
      {highlight && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-warning" aria-hidden="true" />}
      <div className="flex items-start gap-3 px-3 py-2.5">
        <PluginTile plugin={p} dim={status === "off"} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
            <span className="font-medium">{p.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{p.version} · {sourceLabel(p)}</span>
            {p.scopeUpgraded && <ScopeBadge scope={p.scope} upgraded />}
          </p>
          <p className="truncate text-xs text-muted-foreground">{subline ? <>{subline} · </> : null}{p.description}</p>

          {status === "pending" && (
            <p className="mt-1 flex items-center gap-1 text-xs text-info-foreground">
              <Hourglass className="size-3.5 shrink-0" aria-hidden="true" />等待依赖：{dep ? `「${dep.name}」已被管理员停用` : "依赖的服务尚未就绪"}；依赖恢复后自动启动，无需重试
            </p>
          )}
          {status === "incompatible" && (
            <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
              <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />版本不兼容：需要宿主 {p.hostRange}，当前 {HOST_VERSION}；无法重试，{isAdmin ? "请在管理页查看" : "如需使用请联系管理员"}
            </p>
          )}
          {status === "failed" && diag && (
            <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
              <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 truncate">启动失败：{diag.summary}</span>
            </p>
          )}
          {readOnlyNote && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Eye className="size-3.5" aria-hidden="true" />{readOnlyNote}</p>}
          {conflictNote && <div className="mt-1.5">{conflictNote}</div>}

          {status === "failed" && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button size="xs" variant="outline" disabled={busy} onClick={onRetry}>
                {retrying ? <><Loader2 className="animate-spin" /> 重试中…</> : <><RefreshCw /> 重试</>}
              </Button>
              {userChoice ? (
                <Button size="xs" variant="ghost" disabled={busy} onClick={onTurnOffForMe}>为我关闭</Button>
              ) : (
                <span className="text-xs text-muted-foreground">仅在本会话重试；如持续失败，请联系管理员</span>
              )}
              {!userChoice && isAdmin && (
                <Button size="xs" variant="link" className="h-auto p-0 text-xs" disabled={busy} onClick={() => navigate("/admin/plugins")}><ShieldCheck /> 去管理 › 插件</Button>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <SessionStatusText status={status} />
          {control}
          <Button variant="ghost" size="icon-xs" aria-label={expanded ? `收起「${p.name}」详情` : `展开「${p.name}」详情`} aria-expanded={expanded} onClick={onExpand}>
            <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} />
          </Button>
        </div>
      </div>
      <Collapsible open={expanded}>
        <CollapsibleContent className="px-3 pb-3 pl-14">
          <div className="flex flex-col gap-2 rounded-xl bg-foreground/[0.03] p-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-16 shrink-0 text-muted-foreground">贡献</span>
              {p.contributes.map((c) => <span key={c.point} className="rounded-full bg-foreground/[0.06] px-2 py-0.5 font-mono">{c.point}<span className="text-muted-foreground"> ×{c.count}</span></span>)}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-16 shrink-0 text-muted-foreground">能力声明</span>
              {p.capabilities?.length ? p.capabilities.map((c) => <span key={c} className="rounded-full bg-foreground/[0.06] px-2 py-0.5 font-mono">{c}</span>) : <span className="text-muted-foreground">未声明</span>}
              <span className="text-muted-foreground/80">（仅展示）</span>
            </div>
            {status === "failed" && diag && (
              <>
                <dl className="grid grid-cols-[64px_1fr] gap-x-1.5 gap-y-1">
                  <dt className="text-muted-foreground">错误码</dt><dd className="font-mono">{diag.code}</dd>
                  <dt className="text-muted-foreground">摘要</dt><dd className="text-pretty">{diag.summary}</dd>
                  <dt className="text-muted-foreground">traceId</dt><dd className="truncate font-mono">{diag.traceId}</dd>
                </dl>
                <Button
                  size="xs"
                  variant="link"
                  className="h-auto w-fit p-0 text-xs"
                  onClick={() => { navigator.clipboard?.writeText(`plugin: ${p.id}@${p.version}\ncode: ${diag.code}\ntraceId: ${diag.traceId}`).catch(() => {}); toast("已复制诊断信息") }}
                >
                  <Copy /> 复制诊断信息
                </Button>
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

const reasonText: Record<MissingEntry["reason"], string> = {
  disabled: "管理员已停用",
  undeclared: "本部署没有此插件",
  version: "版本过旧",
}

function MissingRow({ entry: m, first, isAdmin, onAdmin }: { entry: MissingEntry; first: boolean; isAdmin: boolean; onAdmin: () => void }) {
  const known = findPlugin(m.id)
  return (
    <div className={cn("flex items-start gap-3 px-3 py-2.5", !first && "border-t border-foreground/5")}>
      <PluginTile plugin={known ?? { icon: Puzzle }} dim />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
          <span className="font-medium">{m.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{m.id}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {m.reason === "version" ? `需要 ≥ ${m.need}，当前 ${m.have}` : `需要 ≥ ${m.need}`} · {m.count} 处内容以占位显示 · {m.pages}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
        <span className="inline-flex items-center gap-1 text-xs text-warning-foreground"><TriangleAlert className="size-3.5" aria-hidden="true" />{reasonText[m.reason]}</span>
        {isAdmin ? (
          <Button size="xs" variant="link" className="h-auto p-0 text-xs" onClick={onAdmin}>去管理 › 插件</Button>
        ) : (
          <span className="text-xs text-muted-foreground">请联系管理员</span>
        )}
      </div>
    </div>
  )
}

/** G-87 缺插件横幅：一次性、非阻断（role=status），三种原因各一套文案；管理员多一个「去管理 › 插件」 */
function MissingBanner({
  entry, multiple, isAdmin, onDetail, onAdmin, onDismiss,
}: {
  entry: MissingEntry | null
  multiple?: MissingEntry[]
  isAdmin: boolean
  onDetail: () => void
  onAdmin: () => void
  onDismiss: () => void
}) {
  const title = multiple
    ? `本文档用到了 ${multiple.length} 个当前不可用的插件`
    : entry!.reason === "disabled"
      ? `本文档用到了「${entry!.name}」，管理员已停用该插件`
      : entry!.reason === "undeclared"
        ? <>本文档用到了本部署没有的插件 <code className="font-mono">{entry!.id}</code>（≥ {entry!.need}）</>
        : `「${entry!.name}」版本过旧：需要 ≥ ${entry!.need}，当前 ${entry!.have}`
  const n = multiple ? multiple.reduce((a, m) => a + m.count, 0) : entry!.count
  return (
    <Alert role="status" aria-live="polite" className="m-2 shrink-0 border-warning/40 bg-warning-muted text-warning-foreground">
      <Puzzle />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="text-warning-foreground/80">{n} 处内容以占位显示，内容已保留；可选中、移动或删除，暂不能编辑内部</AlertDescription>
      <AlertAction className="flex items-center gap-1">
        <Button size="xs" variant="outline" className="border-warning-foreground/40 text-warning-foreground" onClick={onDetail}>查看详情</Button>
        {isAdmin && <Button size="xs" variant="ghost" className="text-warning-foreground" onClick={onAdmin}><ShieldCheck /> 去管理 › 插件</Button>}
        <Button variant="ghost" size="icon-xs" className="text-warning-foreground" aria-label="关闭提示" onClick={onDismiss}><X /></Button>
      </AlertAction>
    </Alert>
  )
}

/** 状态栏插件入口（设计 06 §3）：有失败时带角标；点击打开本面板 */
function PluginStatusEntry({ failed, missing, onOpen }: { failed: number; missing: boolean; onOpen: () => void }) {
  const label = failed > 0 ? `${failed} 个插件启动失败` : missing ? "本文档缺少插件" : "插件正常"
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2 outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring",
        failed > 0 ? "text-destructive" : missing ? "text-warning-foreground" : undefined
      )}
      aria-label={`${label}，打开插件面板`}
    >
      <Puzzle className="size-3.5" aria-hidden="true" />{label}
    </button>
  )
}

/** 缺插件文档的示例页：三个二维码元素以 OF-13 占位显示（带插件名），其余内容正常 */
function SignInSlide({ entry }: { entry: MissingEntry }) {
  const cards = [
    { x: 150, label: "现场签到" },
    { x: 390, label: "资料下载" },
    { x: 630, label: "会后问卷" },
  ]
  const reason = entry.reason === "disabled" ? "插件已停用" : entry.reason === "undeclared" ? "本部署未部署" : `需要 ≥ ${entry.need}`
  return (
    <div className="absolute inset-0 bg-doc-paper text-doc-ink">
      <div className="absolute top-[56px] left-[72px] text-[34px] font-semibold tracking-tight">扫码参与 · 2026 秋季发布会</div>
      <div className="absolute top-[108px] left-[72px] text-[18px] text-doc-ink/60">用手机相机扫描下方二维码</div>
      {cards.map((c, i) => (
        <div key={c.label} className="absolute flex flex-col items-center gap-3" style={{ left: c.x, top: 170, width: 180 }}>
          <div
            className={cn(
              "flex size-[180px] flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-doc-ink/25 bg-doc-ink/[0.035] text-center",
              i === 0 && "outline-2 outline-offset-4 outline-primary"
            )}
          >
            <Puzzle className="size-7 text-doc-ink/45" aria-hidden="true" />
            <span className="px-3 text-[15px] leading-tight font-medium text-doc-ink/70">二维码形状</span>
            <span className="px-3 text-[13px] leading-snug text-doc-ink/55">{reason}<br />内容已保留</span>
          </div>
          <span className="text-[18px] font-medium">{c.label}</span>
        </div>
      ))}
    </div>
  )
}
