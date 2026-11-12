import { useMemo, useState, type ReactNode } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  ArrowLeft, Ban, ChevronRight, CircleHelp, FileCode2, KeyRound, Lock, Hourglass, PackageCheck, Puzzle, ScrollText, Search, ServerCog,
  ShieldAlert, ShieldCheck, ShieldX, TriangleAlert, Undo2, Users,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Brand } from "@/components/brand"
import { DesignBar } from "@/components/editor"
import { MilestoneTag } from "@/components/editor/ribbon/primitives"
import { DeployStatusBadge, PluginTile, ScopeBadge, deployStatusMeta, deployStatusOrder } from "@/components/plugin-bits"
import { PlatformRoleProvider, UserMenu } from "@/components/user-menu"
import { cn } from "@/lib/utils"
import {
  CATALOG_FILE, DEPLOY_VERSION, HOST_VERSION, PLUGIN_SET_FINGERPRINT, catalog, dependentsOf, findPlugin, isLocked, isRejected,
  necessityLabel, policyLabel, sourceLabel, type CatalogPlugin, type DeployStatus, type Policy,
} from "@/lib/plugin-data"

/**
 * 03-screens/32 管理员插件管理（PRD 09 PM-03…PM-09、PM-14、PM-16；rulings §4.23；G-84 / G-85）。
 * 「管理 › 插件」是 SV-14 管理面板的第一页（M3 交付看 + 改，O-4）；入口只在账户菜单「管理」，仅 `platformRole='admin'` 可见。
 * 插件只能经部署预置（镜像内置 / 挂载目录 + 声明文件），本页只做启停与配置，不提供上传或安装。
 * 变更先进草稿，底部保存条汇总；保存前的确认卡按作用域写明影响与生效时机（新会话生效，在线会话 60 s 内收到重新加载横幅，O-1）。
 */

type DemoState =
  | "default" | "detail" | "change-confirm" | "dep-conflict" | "first-enable" | "mutex"
  | "rejected" | "unsigned-allowed" | "loading" | "error" | "forbidden"

const stateOptions: { value: DemoState; label: string }[] = [
  { value: "default", label: "默认" },
  { value: "detail", label: "详情抽屉 · 数据图表增强" },
  { value: "change-confirm", label: "变更确认卡（3 项）" },
  { value: "dep-conflict", label: "禁用被依赖的插件 · 冲突" },
  { value: "first-enable", label: "首次启用第三方插件（M4）" },
  { value: "mutex", label: "互斥 · 不能同时启用" },
  { value: "rejected", label: "未通过部署校验（被拒插件）" },
  { value: "unsigned-allowed", label: "非生产部署 · 允许未签名" },
  { value: "loading", label: "加载中" },
  { value: "error", label: "加载失败" },
  { value: "forbidden", label: "非管理员访问 · 无权限" },
]

type FilterKey = "all" | "failed" | "pending" | "enabled" | "disabled" | "rejected"

/** 分组顺序：需要处理的在前（启动失败、等待依赖），被拒类合并为「未通过部署校验」（PM-06） */
const groups: { key: Exclude<FilterKey, "all">; label: string; match: (s: DeployStatus) => boolean; note?: string }[] = [
  { key: "failed", label: "启动失败", match: (s) => s === "failed" },
  { key: "pending", label: "等待依赖", match: (s) => s === "pending" },
  { key: "enabled", label: "已启用", match: (s) => s === "enabled" },
  { key: "disabled", label: "已停用", match: (s) => s === "disabled" || s === "declared" },
  { key: "rejected", label: "未通过部署校验", match: isRejected, note: "被拒插件不进入任何会话，界面上没有开关与重试；只能由部署方修复后重新部署" },
]

/** 表格列：插件 · 版本 · 来源 · 作用域 · 必需性 · 策略 · 部署状态 · 24 h 失败 · 详情 */
const GRID = "grid grid-cols-[minmax(0,1fr)_52px_104px_76px_72px_196px_92px_56px_28px] items-center gap-x-3"

const LOCK_CORE = "核心组件，更换需修改部署"
const LOCK_DEPLOY = "由部署配置锁定（声明文件 lockPolicy）"
const USER_CHOICE_CONTENT = "会影响文档内容或渲染的插件按部署统一"
const CONFIG_M4 = "插件配置随 PS-10 在 M4 提供"

export function AdminPlugins() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [demo, setDemo] = useState<DemoState>(() => {
    const s = searchParams.get("state")
    return stateOptions.some((o) => o.value === s) ? (s as DemoState) : "default"
  })
  const [saved, setSaved] = useState<Record<string, Policy>>({})
  const [savedDefaults, setSavedDefaults] = useState<Record<string, "on" | "off">>({})
  const [draft, setDraft] = useState<Record<string, Policy>>(() => initialDraft(demo))
  const [draftDefaults, setDraftDefaults] = useState<Record<string, "on" | "off">>(() => initialDefaults(demo))
  const [filter, setFilter] = useState<FilterKey>(demo === "rejected" ? "rejected" : "all")
  const [query, setQuery] = useState(demo === "mutex" ? "flow" : "")
  const [detailId, setDetailId] = useState<string | null>(demo === "detail" ? "acme:data-binding" : null)
  const [confirmOpen, setConfirmOpen] = useState(demo === "change-confirm")
  const [depConflict, setDepConflict] = useState<{ id: string; to: Policy } | null>(demo === "dep-conflict" ? { id: "@cordexjs/slide-render-chart", to: "disabled" } : null)
  const [firstEnable, setFirstEnable] = useState<{ id: string; to: Policy } | null>(demo === "first-enable" ? { id: "acme:qr-shape", to: "forced" } : null)
  const [live, setLive] = useState("")

  function applyDemo(v: DemoState) {
    setDemo(v)
    setSaved({})
    setSavedDefaults({})
    setDraft(initialDraft(v))
    setDraftDefaults(initialDefaults(v))
    setFilter(v === "rejected" ? "rejected" : "all")
    setQuery(v === "mutex" ? "flow" : "")
    setDetailId(v === "detail" ? "acme:data-binding" : null)
    setConfirmOpen(v === "change-confirm")
    setDepConflict(v === "dep-conflict" ? { id: "@cordexjs/slide-render-chart", to: "disabled" } : null)
    setFirstEnable(v === "first-enable" ? { id: "acme:qr-shape", to: "forced" } : null)
    if (v === "forbidden") toast("需要管理员权限")
  }

  const allowUnsigned = demo === "unsigned-allowed"
  /** 非生产允许未签名时，贴纸包不再被拒，按声明的初始状态装配 */
  const plugins = useMemo<CatalogPlugin[]>(
    () => catalog.map((p) => (allowUnsigned && p.status === "unsigned" ? { ...p, status: "enabled", trust: { kind: "none", detail: "未签名 · 非生产部署允许（plugins.allowUnsigned）" } } : p)),
    [allowUnsigned]
  )
  const policyOf = (p: CatalogPlugin): Policy => draft[p.id] ?? saved[p.id] ?? p.policy
  const savedPolicyOf = (p: CatalogPlugin): Policy => saved[p.id] ?? p.policy
  const defaultOf = (p: CatalogPlugin) => draftDefaults[p.id] ?? savedDefaults[p.id] ?? p.userDefault ?? "on"

  const changes = useMemo(() => {
    const ids = new Set([...Object.keys(draft), ...Object.keys(draftDefaults)])
    return [...ids].map((id) => findPlugin(id)!).filter(Boolean)
  }, [draft, draftDefaults])

  /** 互斥：两个插件都不是「禁用」即冲突（PM-07） */
  const mutexConflicts = useMemo(() => {
    const out: { a: CatalogPlugin; b: CatalogPlugin; reason: string }[] = []
    for (const p of plugins) for (const m of p.mutexWith ?? []) {
      const q = plugins.find((x) => x.id === m.id)
      if (!q || p.id > q.id) continue
      if (policyOf(p) !== "disabled" && policyOf(q) !== "disabled") out.push({ a: p, b: q, reason: m.reason })
    }
    return out
  }, [plugins, draft, saved]) // eslint-disable-line react-hooks/exhaustive-deps

  function setPolicy(p: CatalogPlugin, to: Policy) {
    setDraft((prev) => {
      const next = { ...prev }
      if (to === savedPolicyOf(p)) delete next[p.id]
      else next[p.id] = to
      return next
    })
    setLive(`「${p.name}」改为${policyLabel[to]}，尚未保存`)
  }

  function requestPolicy(p: CatalogPlugin, to: Policy) {
    const from = policyOf(p)
    if (to === from) return
    const liveDependents = dependentsOf(p.id).filter((d) => policyOf(d) !== "disabled" && !isRejected(d.status))
    if (to === "disabled" && liveDependents.length > 0) return setDepConflict({ id: p.id, to })
    if (from === "disabled" && p.source === "mounted" && p.neverEnabled) return setFirstEnable({ id: p.id, to })
    setPolicy(p, to)
  }

  function setDefault(p: CatalogPlugin, v: "on" | "off") {
    setDraftDefaults((prev) => {
      const next = { ...prev }
      if (v === (savedDefaults[p.id] ?? p.userDefault ?? "on")) delete next[p.id]
      else next[p.id] = v
      return next
    })
  }

  function discard() {
    setDraft({})
    setDraftDefaults({})
    setLive("已放弃未保存的变更")
  }

  function save() {
    const n = changes.length
    setSaved((prev) => ({ ...prev, ...draft }))
    setSavedDefaults((prev) => ({ ...prev, ...draftDefaults }))
    setDraft({})
    setDraftDefaults({})
    setConfirmOpen(false)
    setLive(`已保存 ${n} 项变更`)
    toast.success(`已保存 ${n} 项插件变更`, { description: "新会话生效；已打开的会话会在 60 秒内收到重新加载提示" })
  }

  if (demo === "forbidden") {
    return (
      <PlatformRoleProvider value="member">
        <div className="flex min-h-dvh flex-col bg-canvas">
          <DesignBar title="管理 › 插件" spec="03-screens/32" state={demo} onStateChange={(v) => applyDemo(v as DemoState)} stateOptions={stateOptions} />
          <div className="flex items-center gap-3 px-4 pt-3">
            <Brand />
            <div className="ml-auto"><UserMenu variant="avatar" /></div>
          </div>
          <Empty className="flex-1">
            <EmptyHeader>
              <EmptyMedia variant="icon"><ShieldX className="text-muted-foreground" /></EmptyMedia>
              <EmptyTitle>需要管理员权限</EmptyTitle>
              <EmptyDescription className="max-w-sm text-pretty">
                「管理 › 插件」只对平台管理员开放。你可以在编辑器的插件面板里开关自己的界面插件，只影响你自己。
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row justify-center gap-2">
              <Button onClick={() => navigate("/home")}>回到开始页</Button>
              <Button variant="outline" onClick={() => navigate("/editor/plugins")}><Puzzle /> 我的插件</Button>
            </EmptyContent>
          </Empty>
        </div>
      </PlatformRoleProvider>
    )
  }

  const q = query.trim().toLowerCase()
  const visible = plugins.filter((p) => !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
  const counts = Object.fromEntries(groups.map((g) => [g.key, visible.filter((p) => g.match(p.status)).length])) as Record<Exclude<FilterKey, "all">, number>
  const shownGroups = groups
    .filter((g) => filter === "all" || filter === g.key)
    .map((g) => ({ ...g, items: visible.filter((p) => g.match(p.status)) }))
    .filter((g) => g.items.length > 0)
  const forcedRejected = plugins.filter((p) => isRejected(p.status) && p.initialPolicy === "forced")
  const detail = detailId ? plugins.find((p) => p.id === detailId) ?? null : null
  const conflictPlugin = depConflict ? findPlugin(depConflict.id)! : null
  const firstPlugin = firstEnable ? findPlugin(firstEnable.id)! : null
  const loading = demo === "loading"
  const failed = demo === "error"

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar title="管理 › 插件" spec="03-screens/32" state={demo} onStateChange={(v) => applyDemo(v as DemoState)} stateOptions={stateOptions} />

      {allowUnsigned && (
        <div role="status" className="mx-2 mt-2 flex h-9 shrink-0 items-center gap-2 rounded-2xl bg-warning-muted px-4 text-xs text-warning-foreground">
          <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">非生产部署：已允许未签名插件</span>
          <span className="truncate text-warning-foreground/80">配置 <code className="font-mono">plugins.allowUnsigned = true</code>，生产环境拒绝此开关；未签名插件以「未签名」标出</span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-2 p-2">
        <AdminNav onBack={() => navigate("/home")} />

        <main className="min-w-0 flex-1 overflow-y-auto" aria-labelledby="admin-plugins-title">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 pt-4 pb-24">
            <header className="flex flex-wrap items-end gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">管理</p>
                <h1 id="admin-plugins-title" className="text-xl font-semibold">插件</h1>
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  部署版本 {DEPLOY_VERSION} · 宿主 {HOST_VERSION} · 已声明 {plugins.length} 个 · 插件集指纹 <span className="font-mono">{PLUGIN_SET_FINGERPRINT}</span>
                </p>
              </div>
              <InputGroup className="ml-auto w-72">
                <InputGroupAddon><Search /></InputGroupAddon>
                <InputGroupInput placeholder="按名称或 id 搜索" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="按名称或 id 搜索插件" />
              </InputGroup>
            </header>

            <SourceNote />

            {!loading && !failed && forcedRejected.length > 0 && (
              <Alert className="border-destructive/30 bg-destructive/10 text-destructive">
                <ShieldX />
                <AlertTitle>{forcedRejected.length} 个声明为强制启用的插件未通过部署校验，没有进入任何会话</AlertTitle>
                <AlertDescription className="text-destructive/85">
                  {forcedRejected.map((p) => `${p.name}（${deployStatusMeta[p.status].label}）`).join("、")}。启动日志已告警，<code className="font-mono">/readyz</code> 附 <code className="font-mono">pluginsRejected</code>；请由部署方修复后重新部署。
                  {filter !== "rejected" && (
                    <button type="button" className="ml-1 font-medium underline underline-offset-2" onClick={() => setFilter("rejected")}>只看被拒插件</button>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {failed ? (
              <div className="cordex-group py-10">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><TriangleAlert className="text-destructive" /></EmptyMedia>
                    <EmptyTitle>插件清单加载失败</EmptyTitle>
                    <EmptyDescription>管理接口 <code className="font-mono">/api/v1/admin/plugins</code> 暂时不可用，未做任何更改</EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent><Button variant="outline" onClick={() => applyDemo("default")}>重试</Button></EmptyContent>
                </Empty>
              </div>
            ) : (
              <>
                <div className={cn("flex flex-wrap items-center gap-2", loading && "invisible")} aria-hidden={loading || undefined}>
                  <ToggleGroup type="single" size="sm" value={filter} onValueChange={(v) => v && setFilter(v as FilterKey)} aria-label="按状态筛选">
                    <ToggleGroupItem value="all" className="px-3 text-xs">全部 <Count n={visible.length} /></ToggleGroupItem>
                    {groups.map((g) => (counts[g.key] > 0 || filter === g.key) && (
                      <ToggleGroupItem key={g.key} value={g.key} className="px-3 text-xs">
                        {g.label} <Count n={counts[g.key]} tone={g.key === "failed" || g.key === "rejected" ? "danger" : undefined} />
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <StatusLegend />
                </div>

                <div role="table" aria-label="已声明的插件" aria-busy={loading || undefined} className="flex flex-col gap-3">
                  <div role="row" className={cn(GRID, "px-3 text-xs text-muted-foreground")}>
                    {["插件", "版本", "来源", "作用域", "必需性", "策略", "部署状态", "24h 失败"].map((h) => (
                      <span key={h} role="columnheader" className="truncate">{h}</span>
                    ))}
                    <span role="columnheader"><span className="sr-only">详情</span></span>
                  </div>

                  {loading ? (
                    <div className="cordex-group flex flex-col">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} className={cn(GRID, "px-3 py-3", i > 0 && "border-t border-foreground/5")}>
                          <div className="flex items-center gap-3"><Skeleton className="size-8 rounded-lg" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-2/5" /><Skeleton className="h-3 w-3/5" /></div></div>
                          <Skeleton className="h-3 w-9" /><Skeleton className="h-3 w-16" /><Skeleton className="h-5 w-14 rounded-full" /><Skeleton className="h-3 w-12" />
                          <Skeleton className="h-7 w-44 rounded-full" /><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-3 w-5" /><span />
                        </div>
                      ))}
                    </div>
                  ) : shownGroups.length === 0 ? (
                    <div className="cordex-group py-8 text-center text-sm text-muted-foreground">没有匹配「{query}」的插件</div>
                  ) : (
                    shownGroups.map((g) => (
                      <section key={g.key} role="rowgroup" aria-labelledby={`grp-${g.key}`} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline gap-2 px-1">
                          <h2 id={`grp-${g.key}`} className="text-xs font-semibold text-muted-foreground">{g.label} <span className="font-normal tabular-nums">{g.items.length}</span></h2>
                          {g.note && <p className="text-xs text-muted-foreground/80">{g.note}</p>}
                        </div>
                        <div className="cordex-group flex flex-col overflow-hidden">
                          {g.items.map((p, i) => (
                            <AdminRow
                              key={p.id}
                              plugin={p}
                              first={i === 0}
                              policy={policyOf(p)}
                              userDefault={defaultOf(p)}
                              modified={p.id in draft || p.id in draftDefaults}
                              selected={detailId === p.id}
                              mutex={mutexConflicts.filter((c) => c.a.id === p.id || c.b.id === p.id).map((c) => ({ other: c.a.id === p.id ? c.b : c.a, reason: c.reason }))}
                              pendingOn={p.status === "pending" ? (p.injects ?? []).map((d) => findPlugin(d.providerId)!).filter((d) => d && policyOf(d) === "disabled") : []}
                              onPolicy={(to) => requestPolicy(p, to)}
                              onDefault={(v) => setDefault(p, v)}
                              onEnableDep={(d) => setPolicy(d, "forced")}
                              onOpen={() => setDetailId(p.id)}
                            />
                          ))}
                        </div>
                      </section>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      <p aria-live="polite" className="sr-only">{live}</p>

      {changes.length > 0 && (
        <SaveBar
          count={changes.length}
          blocked={mutexConflicts.length > 0 ? { short: `${mutexConflicts.length} 处互斥冲突`, detail: `先解决互斥冲突：${mutexConflicts.map((c) => `「${c.a.name}」与「${c.b.name}」`).join("、")}不能同时启用，把其中一个设为禁用后再保存` } : undefined}
          onDiscard={discard}
          onReview={() => setConfirmOpen(true)}
        />
      )}

      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetailId(null)}>
        <SheetContent className="gap-0 overflow-hidden rounded-3xl p-0 data-[side=right]:top-12 data-[side=right]:right-2 data-[side=right]:bottom-2 data-[side=right]:h-auto data-[side=right]:w-[460px] data-[side=right]:sm:max-w-[460px]" onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).focus() }}>
          {detail && <DetailPanel plugin={detail} policy={policyOf(detail)} policyOf={policyOf} />}
        </SheetContent>
      </Sheet>

      <ChangeConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        changes={changes}
        policyOf={policyOf}
        savedPolicyOf={savedPolicyOf}
        defaultOf={defaultOf}
        draftDefaults={draftDefaults}
        onSave={save}
      />

      <AlertDialog open={!!conflictPlugin} onOpenChange={(v) => !v && setDepConflict(null)}>
        <AlertDialogContent className="sm:max-w-md">
          {conflictPlugin && (() => {
            const deps = dependentsOf(conflictPlugin.id).filter((d) => policyOf(d) !== "disabled" && !isRejected(d.status))
            return (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>禁用「{conflictPlugin.name}」？</AlertDialogTitle>
                  <AlertDialogDescription>
                    {deps.length} 个插件依赖它，禁用后它们将进入「等待依赖」，本部署的会话里不再装配。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex flex-col gap-2 text-sm">
                  <ul className="cordex-group flex flex-col">
                    {deps.map((d, i) => (
                      <li key={d.id} className={cn("flex items-center gap-2.5 px-3 py-2", i > 0 && "border-t border-foreground/5")}>
                        <PluginTile plugin={d} className="size-7" />
                        <span className="min-w-0 flex-1"><span className="block truncate font-medium">{d.name}</span><span className="block truncate font-mono text-xs text-muted-foreground">{d.id}</span></span>
                        <span className="text-xs text-muted-foreground">已启用 → 等待依赖</span>
                      </li>
                    ))}
                  </ul>
                  {conflictPlugin.absence && (
                    <p className="rounded-xl bg-warning-muted px-3 py-2 text-xs text-warning-foreground">
                      <span className="font-medium">缺席后果：</span>{conflictPlugin.absence}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">保存后在新打开的文档会话中生效；已打开的会话会收到重新加载提示。</p>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => { setPolicy(conflictPlugin, depConflict!.to); setDepConflict(null) }}>仍要禁用</AlertDialogAction>
                </AlertDialogFooter>
              </>
            )
          })()}
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!firstPlugin} onOpenChange={(v) => !v && setFirstEnable(null)}>
        <AlertDialogContent className="sm:max-w-md">
          {firstPlugin && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">首次启用第三方插件「{firstPlugin.name}」<MilestoneTag>M4</MilestoneTag></AlertDialogTitle>
                <AlertDialogDescription>{sourceLabel(firstPlugin)} · {firstPlugin.version} · {firstPlugin.trust.detail}</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-col gap-3 text-sm">
                <div className="cordex-group px-3 py-2.5">
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">将新增的贡献</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {firstPlugin.contributes.map((c) => <li key={c.point}><ContribChip point={c.point} count={c.count} /></li>)}
                  </ul>
                  {firstPlugin.capabilities && (
                    <>
                      <p className="mt-3 mb-1.5 text-xs font-semibold text-muted-foreground">能力声明 <span className="font-normal">· 仅展示，不做运行时限制</span></p>
                      <ul className="flex flex-wrap gap-1.5">
                        {firstPlugin.capabilities.map((c) => <li key={c} className="rounded-full bg-foreground/[0.06] px-2 py-0.5 font-mono text-xs">{c}</li>)}
                      </ul>
                    </>
                  )}
                </div>
                <p className="flex gap-2 rounded-xl bg-warning-muted px-3 py-2 text-xs text-warning-foreground">
                  <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  <span><span className="font-medium">同源可信、无运行时沙箱：</span>启用即允许该插件以本应用身份运行，可读写它能访问到的文档与界面。它已通过部署时的签名校验。</span>
                </p>
                <p className="text-xs text-muted-foreground">内容级插件：确认后进入草稿，保存后在新会话生效，全员统一。</p>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={() => { setPolicy(firstPlugin, firstEnable!.to); setFirstEnable(null) }}>确认启用</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function initialDraft(v: DemoState): Record<string, Policy> {
  if (v === "change-confirm") return { "cordex:templates": "forced", "cordex:presenter-laser": "disabled" }
  if (v === "mutex") return { "beta:flow-pro": "forced" }
  return {}
}

function initialDefaults(v: DemoState): Record<string, "on" | "off"> {
  return v === "change-confirm" ? { "cordex:word-count": "on" } : {}
}

function Count({ n, tone }: { n: number; tone?: "danger" }) {
  return <span className={cn("tabular-nums text-muted-foreground", tone === "danger" && n > 0 && "text-destructive")}>{n}</span>
}

/** 左侧导航卡：管理面板（SV-14）只有「插件」在 M3 可用，其余页禁用而不隐藏并标 M4 */
function AdminNav({ onBack }: { onBack: () => void }) {
  const items: { label: string; icon: typeof Puzzle; active?: boolean; tag?: string }[] = [
    { label: "插件", icon: Puzzle, active: true },
    { label: "用户与角色", icon: Users, tag: "M4" },
    { label: "审计日志", icon: ScrollText, tag: "M4" },
    { label: "部署与配额", icon: ServerCog, tag: "M4" },
  ]
  return (
    <aside className="glass-strong flex w-56 shrink-0 flex-col rounded-2xl p-3">
      <Brand className="px-2 py-1.5" />
      <Button variant="ghost" size="sm" className="mt-3 justify-start px-2.5 text-muted-foreground" onClick={onBack}><ArrowLeft /> 返回应用</Button>
      <p className="mt-3 mb-1 flex items-center gap-1.5 px-2.5 text-xs font-semibold text-muted-foreground"><ShieldCheck className="size-3.5" aria-hidden="true" />管理</p>
      <nav className="flex flex-col gap-0.5" aria-label="管理">
        {items.map((n) =>
          n.active ? (
            <button key={n.label} type="button" aria-current="page" className="flex h-9 items-center gap-2.5 rounded-lg bg-primary/10 px-2.5 text-sm font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <n.icon className="size-4" aria-hidden="true" />{n.label}
            </button>
          ) : (
            <Tooltip key={n.label}>
              <TooltipTrigger asChild>
                <button type="button" aria-disabled="true" onClick={(e) => e.preventDefault()} className="flex h-9 cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex items-center gap-2.5 text-foreground/45"><n.icon className="size-4" aria-hidden="true" />{n.label}</span>
                  <MilestoneTag className="ml-auto">{n.tag}</MilestoneTag>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">随 SV-14 管理面板在 M4 提供</TooltipContent>
            </Tooltip>
          )
        )}
      </nav>
      <div className="mt-auto"><UserMenu variant="row" /></div>
    </aside>
  )
}

/** 「部署预置，不能在界面安装」的说明位：页头下方常驻一行，写明插件从哪里来、改动何时生效 */
function SourceNote() {
  return (
    <div className="cordex-group flex items-start gap-3 px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-info-muted text-info-foreground" aria-hidden="true"><PackageCheck className="size-4" /></span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">插件由部署预置，这里只管启停</p>
        <p className="mt-0.5 text-xs text-pretty text-muted-foreground">
          插件只能经镜像内置或挂载目录 + 声明文件加入本部署，界面不提供上传、URL 安装或插件市场；新增、升级或移除插件请由部署方修改声明文件后重新部署。
          策略变更在新打开的会话中生效，已打开的会话会收到重新加载提示。
        </p>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground/[0.05] px-2.5 py-1 font-mono text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <FileCode2 className="size-3.5" aria-hidden="true" />{CATALOG_FILE}
          </span>
        </TooltipTrigger>
        <TooltipContent>声明文件（配置键 plugins.catalogFile，只读挂载）</TooltipContent>
      </Tooltip>
    </div>
  )
}

function StatusLegend() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground"><CircleHelp /> 状态说明</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-3">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">部署级状态（8 种）</p>
        <ul className="flex flex-col gap-2">
          {deployStatusOrder.map((s) => (
            <li key={s} className="grid grid-cols-[88px_1fr] items-start gap-2 text-xs">
              <DeployStatusBadge status={s} />
              <span className="text-muted-foreground">{deployStatusMeta[s].hint}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

function AdminRow({
  plugin: p, first, policy, userDefault, modified, selected, mutex, pendingOn, onPolicy, onDefault, onEnableDep, onOpen,
}: {
  plugin: CatalogPlugin
  first: boolean
  policy: Policy
  userDefault: "on" | "off"
  modified: boolean
  selected: boolean
  mutex: { other: CatalogPlugin; reason: string }[]
  pendingOn: CatalogPlugin[]
  onPolicy: (to: Policy) => void
  onDefault: (v: "on" | "off") => void
  onEnableDep: (dep: CatalogPlugin) => void
  onOpen: () => void
}) {
  const rejected = isRejected(p.status)
  const notes: ReactNode[] = []
  if (rejected && p.rejectReason) notes.push(<Note key="rej" tone="danger" icon={<ShieldX />}>{deployStatusMeta[p.status].label}：{p.rejectReason}</Note>)
  if (p.status === "pending") {
    const deps = pendingOn.length ? pendingOn : (p.injects ?? []).map((d) => findPlugin(d.providerId)!).filter(Boolean)
    notes.push(
      <Note key="pend" tone="info" icon={<Hourglass />}>
        等待依赖：{deps.map((d) => `「${d.name}」`).join("、")}已停用
        {pendingOn.length > 0 && (
          <Button variant="link" size="xs" className="ml-1 h-auto p-0 text-xs" onClick={() => pendingOn.forEach(onEnableDep)}>一并启用{pendingOn.map((d) => `「${d.name}」`).join("")}</Button>
        )}
      </Note>
    )
  }
  if (p.status === "failed") notes.push(<Note key="fail" tone="danger" icon={<TriangleAlert />}>近 24 h 有 {p.failures24h} 个会话启动失败，最近错误码 <code className="font-mono">{p.lastError}</code>；策略不变，重试由用户在本会话进行</Note>)
  if (!rejected && p.trust.kind === "none") notes.push(<Note key="unsigned" tone="warning" icon={<ShieldAlert />}>未签名：{p.trust.detail}</Note>)
  for (const m of mutex) notes.push(<Note key={`mx-${m.other.id}`} tone="danger" icon={<Ban />}>与「{m.other.name}」互斥：{m.reason}，不能同时启用；保存前请把其中一个设为禁用</Note>)

  return (
    <div
      role="row"
      aria-selected={selected || undefined}
      className={cn("relative flex flex-col px-3 py-2.5", !first && "border-t border-foreground/5", modified && "bg-primary/[0.035]", selected && "bg-accent/60")}
    >
      {modified && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" />}
      <div className={GRID}>
        <div role="cell" className="flex min-w-0 items-center gap-3">
          <PluginTile plugin={p} dim={rejected || policy === "disabled"} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-sm font-medium">
              <span className="truncate">{p.name}</span>
              {modified && <span className="shrink-0 text-2xs font-normal text-primary">· 未保存</span>}
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">{p.id}</p>
          </div>
        </div>
        <span role="cell" className="text-xs tabular-nums text-muted-foreground">{p.version}</span>
        <span role="cell" className="truncate text-xs text-muted-foreground" title={sourceLabel(p)}>{sourceLabel(p)}</span>
        <span role="cell"><ScopeBadge scope={p.scope} upgraded={p.scopeUpgraded} /></span>
        <span role="cell" className="text-xs text-muted-foreground">{necessityLabel[p.necessity]}</span>
        <div role="cell" className="flex flex-col items-start gap-1">
          <PolicyControl plugin={p} value={policy} onChange={onPolicy} />
          {policy === "user-choice" && !rejected && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="ml-1 inline-flex items-center gap-0.5 rounded text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${p.name} 的用户默认值：${userDefault === "on" ? "默认开" : "默认关"}`}>
                  用户默认：{userDefault === "on" ? "开" : "关"}<ChevronRight className="size-3 rotate-90" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuRadioGroup value={userDefault} onValueChange={(v) => onDefault(v as "on" | "off")}>
                  <DropdownMenuRadioItem value="on">默认开</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="off">默认关</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <span role="cell"><DeployStatusBadge status={p.status} /></span>
        <span role="cell" className={cn("text-xs tabular-nums", p.failures24h ? "font-medium text-destructive" : "text-muted-foreground")}>{rejected ? "—" : (p.failures24h ?? 0)}</span>
        <span role="cell">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label={`查看「${p.name}」详情`} onClick={onOpen}><ChevronRight /></Button>
            </TooltipTrigger>
            <TooltipContent>详情</TooltipContent>
          </Tooltip>
        </span>
      </div>
      {notes.length > 0 && <div className="mt-1.5 flex flex-col gap-1 pl-11">{notes}</div>}
    </div>
  )
}

function Note({ tone, icon, children }: { tone: "danger" | "info" | "warning"; icon: ReactNode; children: ReactNode }) {
  return (
    <p className={cn("flex items-start gap-1.5 text-xs [&>svg]:mt-px [&>svg]:size-3.5 [&>svg]:shrink-0", tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning-foreground" : "text-info-foreground")}>
      {icon}
      <span className="min-w-0">{children}</span>
    </p>
  )
}

/**
 * 三态控件（PM-03、PM-16）：单选组（Radix ToggleGroup single → role=radio），28px。
 * 内容级的「允许用户选择」禁用而不隐藏：aria-disabled + tooltip 原因；内核 / 契约必需与 lockPolicy 显示锁定原因，可聚焦读出。
 */
function PolicyControl({ plugin: p, value, onChange }: { plugin: CatalogPlugin; value: Policy; onChange: (v: Policy) => void }) {
  if (isRejected(p.status)) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} aria-disabled="true" className="inline-flex h-7 items-center rounded-full px-1 text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">无开关 · 需重新部署</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-60 text-pretty">被拒插件不进入任何会话；由部署方修复后重新部署才会改变</TooltipContent>
      </Tooltip>
    )
  }
  if (isLocked(p)) {
    const reason = p.lockPolicy ? LOCK_DEPLOY : LOCK_CORE
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            role="img"
            aria-label={`${p.name}：强制启用，已锁定。${reason}`}
            className="inline-flex h-7 items-center gap-1.5 rounded-full bg-foreground/[0.04] px-2.5 text-xs text-foreground/70 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Lock className="size-3.5" aria-hidden="true" />强制启用
            <span className="text-muted-foreground">· {p.lockPolicy ? "部署锁定" : "核心组件"}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-60 text-pretty">{reason}</TooltipContent>
      </Tooltip>
    )
  }
  const contentLevel = p.scope === "content" || p.scopeUpgraded
  return (
    <ToggleGroup
      type="single"
      size="sm"
      spacing={0}
      value={value}
      onValueChange={(v) => {
        if (!v) return
        if (v === "user-choice" && contentLevel) return
        onChange(v as Policy)
      }}
      aria-label={`${p.name} 的策略`}
      className="rounded-full bg-foreground/[0.05] p-0.5"
    >
      <ToggleGroupItem value="forced" className="h-6 rounded-full! px-2 text-xs">强制启用</ToggleGroupItem>
      {contentLevel ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value="user-choice"
              aria-disabled="true"
              aria-label={`允许用户选择（不可用：${USER_CHOICE_CONTENT}）`}
              onClick={(e) => e.preventDefault()}
              className="h-6 cursor-not-allowed rounded-full! px-2 text-xs text-foreground/35 hover:bg-transparent hover:text-foreground/35"
            >
              用户选择
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent className="max-w-56 text-pretty">{USER_CHOICE_CONTENT}，只有强制启用与禁用两态</TooltipContent>
        </Tooltip>
      ) : (
        <ToggleGroupItem value="user-choice" aria-label="允许用户选择" className="h-6 rounded-full! px-2 text-xs">用户选择</ToggleGroupItem>
      )}
      <ToggleGroupItem value="disabled" className="h-6 rounded-full! px-2 text-xs">禁用</ToggleGroupItem>
    </ToggleGroup>
  )
}

function SaveBar({ count, blocked, onDiscard, onReview }: { count: number; blocked?: { short: string; detail: string }; onDiscard: () => void; onReview: () => void }) {
  return (
    <div role="region" aria-label="未保存的变更" className="glass-float fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full py-1.5 pr-1.5 pl-4 whitespace-nowrap shadow-lg">
      <span className="text-sm"><span className="font-medium tabular-nums">{count}</span> 项未保存的变更</span>
      {blocked ? (
        <span className="flex items-center gap-1 text-xs text-destructive"><TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />{blocked.short}</span>
      ) : (
        <span className="text-xs text-muted-foreground">保存后新会话生效</span>
      )}
      <Button variant="ghost" size="sm" onClick={onDiscard}>放弃</Button>
      {blocked ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" aria-disabled="true" aria-description={blocked.detail} className="cursor-not-allowed opacity-50" onClick={(e) => e.preventDefault()}>检查并保存…</Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64 text-pretty">{blocked.detail}</TooltipContent>
        </Tooltip>
      ) : (
        <Button size="sm" onClick={onReview}>检查并保存…</Button>
      )}
    </div>
  )
}

/** G-85 变更确认卡：合并列出本批变更，按作用域写明影响与生效时机；保存整体成功或整体失败（PM-07、PM-08） */
function ChangeConfirmDialog({
  open, onOpenChange, changes, policyOf, savedPolicyOf, defaultOf, draftDefaults, onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  changes: CatalogPlugin[]
  policyOf: (p: CatalogPlugin) => Policy
  savedPolicyOf: (p: CatalogPlugin) => Policy
  defaultOf: (p: CatalogPlugin) => "on" | "off"
  draftDefaults: Record<string, "on" | "off">
  onSave: () => void
}) {
  const content = changes.filter((p) => p.scope === "content" || p.scopeUpgraded)
  const ui = changes.filter((p) => !(p.scope === "content" || p.scopeUpgraded))
  const restored = changes
    .filter((p) => savedPolicyOf(p) === "disabled" && policyOf(p) !== "disabled")
    .flatMap((p) => dependentsOf(p.id).filter((d) => d.status === "pending").map((d) => ({ dep: d, via: p })))
  const blocked = changes
    .filter((p) => policyOf(p) === "disabled" && savedPolicyOf(p) !== "disabled")
    .flatMap((p) => dependentsOf(p.id).filter((d) => d.status === "enabled").map((d) => ({ dep: d, via: p })))
  const disablingContent = content.some((p) => policyOf(p) === "disabled")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>保存 {changes.length} 项插件变更？</DialogTitle>
          <DialogDescription>同一批变更一起保存：任一项失败则全部不生效。每项写入审计 <code className="font-mono text-xs">plugin.policy_changed</code>。</DialogDescription>
        </DialogHeader>
        <ul className="cordex-group flex flex-col">
          {changes.map((p, i) => {
            const from = savedPolicyOf(p)
            const to = policyOf(p)
            const defChanged = p.id in draftDefaults
            return (
              <li key={p.id} className={cn("flex items-center gap-2.5 px-3 py-2", i > 0 && "border-t border-foreground/5")}>
                <PluginTile plugin={p} className="size-7" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {from !== to ? <>{policyLabel[from]} <span aria-hidden="true">→</span><span className="sr-only">改为</span> <span className="font-medium text-foreground">{policyLabel[to]}</span></> : null}
                    {from !== to && defChanged ? " · " : null}
                    {defChanged ? <>用户默认 <span aria-hidden="true">→</span><span className="sr-only">改为</span> <span className="font-medium text-foreground">{defaultOf(p) === "on" ? "开" : "关"}</span></> : null}
                  </span>
                </span>
                <ScopeBadge scope={p.scope} upgraded={p.scopeUpgraded} />
              </li>
            )
          })}
        </ul>

        <div className="flex flex-col gap-2 text-xs">
          <p className="font-semibold text-muted-foreground">影响与生效时机</p>
          {content.length > 0 && (
            <ImpactLine icon={<KeyRound />} title={`内容级 ${content.length} 项 · 全员统一`}>
              在新打开的文档会话中生效；已打开的会话会在 60 秒内收到「重新加载」提示，不会被强制中断
              {disablingContent && "；停用后，用到该插件的文档内容保留、以占位显示"}
            </ImpactLine>
          )}
          {ui.length > 0 && (
            <ImpactLine icon={<Users />} title={`界面级 ${ui.length} 项`}>
              在新会话中生效；已为自己关闭或打开它的用户不受默认值变化影响{ui.some((p) => policyOf(p) === "forced") && "；改为强制启用时，个人选择暂时失效（保留记录）"}
            </ImpactLine>
          )}
          {restored.map(({ dep, via }) => (
            <ImpactLine key={dep.id} icon={<Undo2 />} tone="success" title={`「${dep.name}」将从等待依赖恢复`}>它依赖的「{via.name}」随本次保存启用</ImpactLine>
          ))}
          {blocked.map(({ dep, via }) => (
            <ImpactLine key={dep.id} icon={<TriangleAlert />} tone="warning" title={`「${dep.name}」将进入等待依赖`}>它依赖的「{via.name}」随本次保存禁用</ImpactLine>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={onSave}>保存 {changes.length} 项变更</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ImpactLine({ icon, title, tone, children }: { icon: ReactNode; title: string; tone?: "success" | "warning"; children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-xl bg-foreground/[0.04] px-3 py-2">
      <span className={cn("mt-px shrink-0 [&>svg]:size-3.5", tone === "success" ? "text-success-foreground" : tone === "warning" ? "text-warning-foreground" : "text-muted-foreground")} aria-hidden="true">{icon}</span>
      <p className="text-pretty"><span className="font-medium text-foreground">{title}：</span><span className="text-muted-foreground">{children}</span></p>
    </div>
  )
}

function ContribChip({ point, count }: { point: string; count: number }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2 py-0.5 font-mono text-xs">{point}<span className="text-muted-foreground">×{count}</span></span>
}

/** 详情抽屉（PM-06 展开详情 + PM-07 依赖 / 互斥 / 缺席后果 + PM-09 配置 M4 + PM-14 最近 5 次策略变更） */
function DetailPanel({ plugin: p, policy, policyOf }: { plugin: CatalogPlugin; policy: Policy; policyOf: (p: CatalogPlugin) => Policy }) {
  const deps = (p.injects ?? []).map((d) => ({ ...d, provider: findPlugin(d.providerId) }))
  const dependents = dependentsOf(p.id)
  const mutex = (p.mutexWith ?? []).map((m) => ({ ...m, other: findPlugin(m.id) }))
  return (
    <>
      <SheetHeader className="gap-2 p-5 pb-3">
        <div className="flex items-center gap-3 pr-8">
          <PluginTile plugin={p} className="size-10 rounded-xl" />
          <div className="min-w-0">
            <SheetTitle className="truncate text-base">{p.name}</SheetTitle>
            <p className="truncate font-mono text-xs text-muted-foreground">{p.id}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ScopeBadge scope={p.scope} upgraded={p.scopeUpgraded} />
          <DeployStatusBadge status={p.status} />
          <span className="text-xs text-muted-foreground">· {policyLabel[policy]}</span>
        </div>
        <SheetDescription>{p.description}</SheetDescription>
      </SheetHeader>
      <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:block!">
        <div className="flex flex-col gap-2.5 px-5 pb-6">
          <Section title="概要">
            <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">版本</dt><dd className="tabular-nums">{p.version}</dd>
              <dt className="text-muted-foreground">来源</dt><dd>{p.source === "builtin" ? "镜像内置" : `挂载目录 · ${p.vendor}`}</dd>
              <dt className="text-muted-foreground">宿主兼容</dt><dd className="tabular-nums">{p.hostRange}（当前 {HOST_VERSION}）</dd>
              <dt className="text-muted-foreground">必需性</dt><dd>{necessityLabel[p.necessity]}</dd>
              <dt className="text-muted-foreground">近 24 h 失败</dt><dd className={cn("tabular-nums", p.failures24h ? "text-destructive" : undefined)}>{p.failures24h ? `${p.failures24h} 个会话 · ${p.lastError}` : "0"}</dd>
            </dl>
          </Section>

          <Section title="信任来源">
            <p className="flex items-start gap-2 text-xs">
              {p.trust.kind === "none" ? <ShieldAlert className="mt-px size-3.5 shrink-0 text-warning-foreground" aria-hidden="true" /> : <ShieldCheck className="mt-px size-3.5 shrink-0 text-success-foreground" aria-hidden="true" />}
              <span>{p.trust.detail}</span>
            </p>
          </Section>

          <Section title="依赖与冲突">
            <RelList label="依赖" empty="不依赖其他插件">
              {deps.map((d) => d.provider && (
                <RelItem key={d.service} plugin={d.provider} meta={<>注入 <code className="font-mono">{d.service}</code></>} policy={policyOf(d.provider)} />
              ))}
            </RelList>
            <RelList label="被依赖" empty="没有插件依赖它">
              {dependents.map((d) => <RelItem key={d.id} plugin={d} meta="禁用本插件后将进入等待依赖" policy={policyOf(d)} />)}
            </RelList>
            <RelList label="互斥" empty="无">
              {mutex.map((m) => m.other && <RelItem key={m.id} plugin={m.other} meta={m.reason} policy={policyOf(m.other)} />)}
            </RelList>
            {p.absence && (
              <p className="rounded-lg bg-warning-muted px-2.5 py-1.5 text-xs text-warning-foreground"><span className="font-medium">缺席后果：</span>{p.absence}</p>
            )}
          </Section>

          <Section title="贡献点摘要">
            <ul className="flex flex-wrap gap-1.5">{p.contributes.map((c) => <li key={c.point}><ContribChip point={c.point} count={c.count} /></li>)}</ul>
          </Section>

          <Section title="能力声明" aside="仅展示，不做运行时限制">
            {p.capabilities?.length ? (
              <ul className="flex flex-wrap gap-1.5">{p.capabilities.map((c) => <li key={c} className="rounded-full bg-foreground/[0.06] px-2 py-0.5 font-mono text-xs">{c}</li>)}</ul>
            ) : <p className="text-xs text-muted-foreground">未声明额外能力</p>}
          </Section>

          <Section title="最近策略变更" aside="来自审计">
            {p.audit?.length ? (
              <ol className="flex flex-col gap-1.5">
                {p.audit.slice(0, 5).map((a) => (
                  <li key={a.at + a.change} className="grid grid-cols-[104px_1fr] gap-2 text-xs">
                    <span className="tabular-nums text-muted-foreground">{a.at}</span>
                    <span><span className="font-medium">{a.actor === "system" ? "系统" : a.actor}</span> · {a.change}</span>
                  </li>
                ))}
              </ol>
            ) : <p className="text-xs text-muted-foreground">暂无变更记录</p>}
          </Section>

          <Section title={<span className="flex items-center gap-1.5">配置 <MilestoneTag>M4</MilestoneTag></span>} aside="仅部署级一份">
            {p.config?.length ? (
              <div className="flex flex-col gap-2">
                {p.config.map((f) => (
                  <Tooltip key={f.key}>
                    <TooltipTrigger asChild>
                      <label className="flex cursor-not-allowed flex-col gap-1">
                        <span className="text-xs text-muted-foreground">{f.label}{f.secret && " · 机密"}</span>
                        <Input value={f.value} readOnly aria-disabled="true" aria-describedby={`cfg-${f.key}`} className="h-7 cursor-not-allowed text-xs opacity-60" onChange={() => {}} />
                        {f.description && <span id={`cfg-${f.key}`} className="text-xs text-muted-foreground/80">{f.description}</span>}
                      </label>
                    </TooltipTrigger>
                    <TooltipContent side="left">{CONFIG_M4}</TooltipContent>
                  </Tooltip>
                ))}
                <p className="text-xs text-muted-foreground">{CONFIG_M4}；保存时校验，失败不部分生效，审计只记字段路径不记值。</p>
              </div>
            ) : <p className="text-xs text-muted-foreground">该插件没有可配置项</p>}
          </Section>
        </div>
      </ScrollArea>
    </>
  )
}

function Section({ title, aside, children }: { title: ReactNode; aside?: string; children: ReactNode }) {
  return (
    <section className="cordex-group flex flex-col gap-2 p-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">{title}{aside && <span className="ml-auto font-normal">{aside}</span>}</h3>
      {children}
    </section>
  )
}

function RelList({ label, empty, children }: { label: string; empty: string; children: ReactNode }) {
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean)
  return (
    <div className="grid grid-cols-[48px_1fr] items-start gap-2 text-xs">
      <span className="pt-1 text-muted-foreground">{label}</span>
      {items.length ? <ul className="flex flex-col gap-1">{items}</ul> : <span className="pt-1 text-muted-foreground/80">{empty}</span>}
    </div>
  )
}

function RelItem({ plugin, meta, policy }: { plugin: CatalogPlugin; meta: ReactNode; policy: Policy }) {
  return (
    <li className="flex items-center gap-2 rounded-lg bg-foreground/[0.03] px-2 py-1">
      <PluginTile plugin={plugin} className="size-6 rounded-md [&>svg]:size-3" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{plugin.name}</span>
        <span className="block truncate text-muted-foreground">{meta}</span>
      </span>
      <span className="shrink-0 text-muted-foreground">{policyLabel[policy]}</span>
    </li>
  )
}
