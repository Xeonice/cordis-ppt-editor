import { useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowRight, BookOpen, ChevronRight, Clock, FileUp, Files, FolderOpen, House, Keyboard, LayoutTemplate,
  LifeBuoy, MoreHorizontal, Pin, Plus, Search, Sparkles, Users, WifiOff,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DesignBar } from "@/components/editor"
import { MiniSlide } from "@/components/editor/MiniSlide"
import { Brand } from "@/components/brand"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "@/components/user-menu"
import { cn } from "@/lib/utils"
import { documentList, themePresets } from "@/lib/mock-data"

type DemoState = "default" | "first-run" | "loading" | "offline"

const stateOptions = [
  { value: "default", label: "默认（有最近文档）" },
  { value: "first-run", label: "首次使用（无文档，突出指南）" },
  { value: "loading", label: "加载中" },
  { value: "offline", label: "离线" },
]

const nav = [
  { value: "home", label: "首页", icon: House },
  { value: "new", label: "新建", icon: Plus },
  { value: "docs", label: "我的文档", icon: Files },
  { value: "shared", label: "与我共享", icon: Users },
  { value: "recent", label: "最近", icon: Clock },
  { value: "guide", label: "指南", icon: BookOpen },
] as const

const guides = [
  { icon: Sparkles, title: "5 分钟快速入门", desc: "新建、插入形状与图片、应用版式、分享给同事", action: "开始" },
  { icon: Keyboard, title: "键盘快捷键", desc: "编辑、导航与放映的全部快捷键速查", action: "查看", to: "/settings?panel=shortcuts" },
  { icon: LayoutTemplate, title: "母版与版式", desc: "统一整份演示文稿的版式、页脚与主题", action: "查看", to: "/editor/masters" },
  { icon: Users, title: "协同编辑", desc: "多人同时编辑、评论、版本历史与权限", action: "查看", to: "/editor/comments" },
  { icon: LifeBuoy, title: "帮助中心", desc: "常见问题、导入 .pptx 保真说明与反馈渠道", action: "打开" },
] as const

/**
 * 应用首页（开始页，对应 PowerPoint 的"开始/后台"首页）：新建与模板、最近文档、指南入口。
 * 编辑器应用栏的"返回"落到这里；"我的文档"进入 `/documents` 全量列表。
 */
export function Home() {
  const navigate = useNavigate()
  const [demoState, setDemoState] = useState<DemoState>("default")
  const [query, setQuery] = useState("")
  const [active, setActive] = useState<(typeof nav)[number]["value"]>("home")
  const offline = demoState === "offline"
  const firstRun = demoState === "first-run"
  const loading = demoState === "loading"
  const recent = firstRun ? [] : documentList.slice(0, 5)

  function go(value: (typeof nav)[number]["value"]) {
    setActive(value)
    if (value === "docs" || value === "shared" || value === "recent") navigate("/documents")
    if (value === "new") document.getElementById("home-new")?.scrollIntoView({ behavior: "smooth", block: "start" })
    if (value === "guide") document.getElementById("home-guide")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <DesignBar title="应用首页" spec="03-screens/29" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} />

      <div className="flex min-h-0 flex-1 gap-2 p-2">
        {/* 左侧导航卡 */}
        <aside className="glass-strong flex w-56 shrink-0 flex-col rounded-2xl p-3">
          <Brand className="px-2 py-1.5" />
          <nav className="mt-3 flex flex-col gap-0.5" aria-label="主导航">
            {nav.map((n) => (
              <button
                key={n.value}
                type="button"
                aria-current={active === n.value ? "page" : undefined}
                onClick={() => go(n.value)}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active === n.value ? "bg-primary/10 font-medium text-primary" : "text-foreground/80 hover:bg-foreground/5"
                )}
              >
                <n.icon className="size-4" aria-hidden="true" />
                {n.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto">
            <UserMenu variant="row" />
          </div>
        </aside>

        {/* 主内容 */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-5">
            <header className="flex flex-wrap items-center gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-balance">早上好，王小明</h1>
                <p className="text-sm text-muted-foreground">2026 年 9 月 17 日 · 星期四</p>
              </div>
              <InputGroup className="ml-auto w-full max-w-80 sm:w-auto">
                <InputGroupAddon><Search /></InputGroupAddon>
                <InputGroupInput placeholder="搜索文档与模板" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="搜索文档与模板" />
              </InputGroup>
              <ThemeToggle />
            </header>

            {offline && (
              <Alert className="border-warning/40 bg-warning-muted text-warning-foreground">
                <WifiOff />
                <AlertDescription className="text-warning-foreground/80">当前离线：可打开最近文档继续编辑，新建、模板与导入将在恢复连接后可用</AlertDescription>
              </Alert>
            )}

            {/* 新建 */}
            <section id="home-new" className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold">新建</h2>
                <Button variant="ghost" size="sm" onClick={() => toast("模板库：更多主题与行业模板")}>更多模板 <ChevronRight /></Button>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                <NewCard label="空白演示文稿" hint="16:9" disabled={offline} onClick={() => navigate("/editor")}>
                  <div className="flex size-full items-center justify-center rounded-md border border-dashed border-foreground/20 bg-doc-paper">
                    <Plus className="size-6 text-primary" aria-hidden="true" />
                  </div>
                </NewCard>
                {themePresets.map((t) => (
                  <NewCard key={t.id} label={t.name} hint="主题模板" disabled={offline} onClick={() => navigate("/editor")}>
                    <div className="relative size-full overflow-hidden rounded-md" style={{ backgroundColor: t.colors[0]!.hex }}>
                      <div className="absolute inset-[12%] flex flex-col gap-[10%]">
                        <div className="h-[22%] w-[60%] rounded-full" style={{ backgroundColor: t.colors[4]!.hex }} />
                        <div className="h-[10%] w-[42%] rounded-full opacity-60" style={{ backgroundColor: t.colors[1]!.hex }} />
                        <div className="h-[10%] w-[52%] rounded-full opacity-40" style={{ backgroundColor: t.colors[1]!.hex }} />
                      </div>
                    </div>
                  </NewCard>
                ))}
                <NewCard label="导入 .pptx" hint="保留原有格式" disabled={offline} onClick={() => navigate("/import")}>
                  <div className="flex size-full flex-col items-center justify-center gap-1 rounded-md bg-foreground/[0.04] text-muted-foreground">
                    <FileUp className="size-6" aria-hidden="true" />
                  </div>
                </NewCard>
              </div>
            </section>

            {/* 最近 */}
            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold">最近</h2>
                <Button variant="ghost" size="sm" onClick={() => navigate("/documents")}>全部文档 <ChevronRight /></Button>
              </div>
              <div className="oce-group overflow-hidden">
                {loading ? (
                  <div className="flex flex-col gap-3 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : recent.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                    <FolderOpen className="size-8 text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm font-medium">还没有最近打开的文档</p>
                    <p className="text-sm text-muted-foreground">从上方新建一份，或先看看指南</p>
                    <Button size="sm" className="mt-1" onClick={() => navigate("/editor")}><Plus /> 新建演示文稿</Button>
                  </div>
                ) : (
                  <ul className="divide-y divide-foreground/5">
                    {recent.map((d, i) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => navigate("/editor")}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left outline-none hover:bg-foreground/[0.03] focus-visible:bg-foreground/5"
                        >
                          <MiniSlide kind={i === 0 ? "title" : i % 2 ? "two-content" : "title-content"} className="w-16 shrink-0 rounded-sm border" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-medium">{d.title}</span>
                              {d.viewOnly && <Badge variant="outline" className="text-xs">仅查看</Badge>}
                              {i === 0 && <Pin className="size-3.5 text-muted-foreground" aria-label="已固定" />}
                            </div>
                            <div className="text-xs text-muted-foreground">{d.ownerLabel} · {d.timeLabel}</div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <span role="button" tabIndex={0} aria-label="更多操作" className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/5"><MoreHorizontal className="size-4" /></span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => toast("已固定到顶部")}>固定</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => navigate("/editor/share")}>分享</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => toast("已从最近移除", { action: { label: "撤销", onClick: () => toast("已恢复") } })}>从最近移除</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* 指南 */}
            <section id="home-guide" className="flex flex-col gap-3 pb-6">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold">指南与帮助</h2>
                <Badge variant="secondary">v0.1 新功能</Badge>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                {guides.map((g) => (
                  <button
                    key={g.title}
                    type="button"
                    onClick={() => ("to" in g && g.to ? navigate(g.to) : toast(`打开「${g.title}」`))}
                    className="oce-group group flex items-start gap-3 p-3 text-left outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><g.icon className="size-4.5" aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 text-sm font-medium">{g.title}<ArrowRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" /></span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{g.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

function NewCard({ label, hint, disabled, onClick, children }: { label: string; hint: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  const card = (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="oce-group group flex flex-col gap-2 p-2 text-left outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="block aspect-video w-full">{children}</span>
      <span className="px-1 pb-0.5">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  )
  if (!disabled) return card
  return (
    <Tooltip>
      <TooltipTrigger asChild><span>{card}</span></TooltipTrigger>
      <TooltipContent>离线时不可用</TooltipContent>
    </Tooltip>
  )
}
