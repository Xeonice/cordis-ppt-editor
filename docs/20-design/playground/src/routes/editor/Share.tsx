import { useMemo, useState } from "react"
import { Check, Copy, Link2, LogIn, User, WifiOff, X } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { AppBar, DesignBar, EditorShell, Inspector, SlideCanvas, SlideContent, StatusBar, StatusText, ThumbnailRail } from "@/components/editor"
import { EditorRibbon } from "@/components/editor/Ribbon"
import type { RibbonTabValue } from "@/components/editor/Ribbon"
import { collaborators, documentTitle, presenceRing, roleLabel, slides, type Role } from "@/lib/mock-data"

type DemoState = "default" | "loading" | "invite-error" | "invite-error-selfsignup" | "offline" | "viewer" | "empty" | "no-account"

const stateOptions = [
  { value: "default", label: "默认（所有者视角）" },
  { value: "empty", label: "空（仅所有者）" },
  { value: "loading", label: "加载中" },
  { value: "invite-error", label: "邀请失败（selfSignup 关，默认）" },
  { value: "invite-error-selfsignup", label: "邀请失败（selfSignup 开）" },
  { value: "offline", label: "离线" },
  { value: "viewer", label: "权限不足（只读降级）" },
  { value: "no-account", label: "无账号者打开分享链接" },
]

export function EditorShare() {
  const [demoState, setDemoState] = useState<DemoState>("default")
  const [ribbonTab, setRibbonTab] = useState<RibbonTabValue>("home")
  const [open, setOpen] = useState(true)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<string>("commenter")
  const [linkAccess, setLinkAccess] = useState("invite-only")
  const [copied, setCopied] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [members, setMembers] = useState(() => [
    { id: "wang", role: "editor" as Role },
    { id: "li", role: "commenter" as Role },
  ])
  const currentSlide = slides[0]!
  const isOwnerView = demoState !== "viewer"
  const shownMembers = demoState === "empty" ? [] : members

  // 邀请联想只返回本部署内已有账号的用户（姓名 + 邮箱），不返回用户组（rulings §4.15 Q6）
  const suggestions = useMemo(
    () => collaborators.filter((c) => !c.isSelf && !members.some((m) => m.id === c.id) && (c.name.includes(email) || (c.email ?? "").includes(email))),
    [email, members]
  )

  function handleInvite() {
    if (demoState === "invite-error" || demoState === "invite-error-selfsignup") return
    if (!email.trim()) return
    toast(`已邀请 ${email}`)
    setEmail("")
  }

  if (demoState === "no-account") {
    return (
      <div className="flex h-dvh flex-col bg-canvas">
        <DesignBar title="分享与权限" spec="03-screens/08" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} />
        <Empty className="flex-1">
          <EmptyMedia variant="icon"><User className="text-muted-foreground" /></EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>你还没有账号</EmptyTitle>
            <EmptyDescription>请联系管理员开通账号后再打开此链接</EmptyDescription>
          </EmptyHeader>
          <EmptyContent><Button variant="outline" onClick={() => toast("正在跳转到登录…")}><LogIn /> 返回登录</Button></EmptyContent>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar title="分享与权限" spec="03-screens/08" state={demoState} onStateChange={(v) => { setDemoState(v as DemoState); setOpen(true) }} stateOptions={stateOptions} />
      <EditorShell
        appBar={<AppBar title={documentTitle} collaborators={collaborators.filter((c) => !c.isSelf)} status={{ kind: "sync", state: "synced" }}>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>分享</Button>
        </AppBar>}
        ribbon={<EditorRibbon value={ribbonTab} onValueChange={setRibbonTab} currentMasterId={currentSlide.masterId} currentLayoutId={currentSlide.layoutId} />}
        thumbnailRail={<ThumbnailRail mode="normal" slides={slides} currentSlideId={currentSlide.id} />}
        canvas={<SlideCanvas hideZoomBar><SlideContent slide={currentSlide} fill /></SlideCanvas>}
        inspector={<Inspector value="properties" onValueChange={() => {}} tabs={[{ value: "properties", label: "属性", content: null }]} />}
        statusBar={<StatusBar left={[`第 ${currentSlide.index}/${slides.length} 页`]} right={[<StatusText key="s" status={{ kind: "sync", state: "synced" }} variant="dot" />]} />}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{isOwnerView ? `分享"${documentTitle}"` : `谁能访问"${documentTitle}"`}</DialogTitle></DialogHeader>

          {demoState === "loading" ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="flex items-center gap-2"><Skeleton className="size-8 rounded-full" /><Skeleton className="h-4 flex-1" /></div>)}
            </div>
          ) : !isOwnerView ? (
            <div className="flex flex-col gap-3">
              <ReadonlyMemberRow name="王小明" sub="wang@example.com" role="可编辑" self />
              <ReadonlyMemberRow name="张三" sub="所有者" role="所有者" />
              <ReadonlyMemberRow name="李雷" sub="" role="可评审" />
              <p className="text-xs text-muted-foreground">仅所有者或管理者可以更改分享设置</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <p className="mb-2 text-sm font-medium">邀请协作者</p>
                {demoState === "offline" ? (
                  <Alert className="border-warning/40 bg-warning-muted text-warning-foreground">
                    <WifiOff />
                    <AlertDescription className="text-warning-foreground/80">离线时无法邀请协作者或生成分享链接</AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Field className="flex-1">
                        <FieldLabel htmlFor="invite-email" className="sr-only">邀请协作者</FieldLabel>
                        <Popover open={suggestOpen && suggestions.length > 0} onOpenChange={setSuggestOpen}>
                          <PopoverAnchor asChild>
                            <Input
                              id="invite-email"
                              placeholder="例如 lilei@example.com"
                              value={email}
                              onChange={(e) => { setEmail(e.target.value); setSuggestOpen(e.target.value.length > 0) }}
                              onFocus={() => setSuggestOpen(email.length > 0)}
                              aria-invalid={demoState === "invite-error" || demoState === "invite-error-selfsignup"}
                            />
                          </PopoverAnchor>
                          <PopoverContent align="start" className="w-64 p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                            <Command>
                              <CommandList>
                                <CommandEmpty className="p-3 text-xs text-muted-foreground">没有匹配的账号</CommandEmpty>
                                <CommandGroup heading="部署内的用户">
                                  {suggestions.map((c) => (
                                    <CommandItem key={c.id} onSelect={() => { setEmail(c.email ?? c.name); setSuggestOpen(false) }}>
                                      <User className="size-3.5" /> {c.name} <span className="ml-auto text-xs text-muted-foreground">{c.email}</span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {demoState === "invite-error" ? (
                          <FieldError>系统中没有使用该邮箱的账号。请联系管理员为对方开通账号后再邀请</FieldError>
                        ) : demoState === "invite-error-selfsignup" ? (
                          <FieldError>系统中没有使用该邮箱的账号。请对方先注册并登录，再邀请；也可以把分享链接发给对方</FieldError>
                        ) : (
                          <FieldDescription>输入邮箱或姓名，默认权限为"可评审"</FieldDescription>
                        )}
                      </Field>
                      <Select value={role} onValueChange={setRole}>
                        <SelectTrigger className="w-28 shrink-0"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="editor">可编辑</SelectItem>
                          <SelectItem value="commenter">可评审</SelectItem>
                          <SelectItem value="viewer">可查看</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={handleInvite} className="shrink-0">邀请</Button>
                    </div>
                  </>
                )}
              </div>

              <Separator />

              <div>
                <p className="mb-2 text-sm font-medium">有权限的用户</p>
                <div className="flex flex-col gap-1">
                  <Item variant="muted" size="sm">
                    <ItemMedia><Avatar size="sm" className="ring-2 ring-primary ring-offset-2 ring-offset-background"><AvatarFallback>我</AvatarFallback></Avatar></ItemMedia>
                    <ItemContent><ItemTitle>我（所有者）</ItemTitle></ItemContent>
                    <ItemActions><span className="text-xs text-muted-foreground">所有者</span></ItemActions>
                  </Item>
                  {shownMembers.map((m) => {
                    const c = collaborators.find((cc) => cc.id === m.id)!
                    return (
                      <Item key={m.id} variant="muted" size="sm">
                        <ItemMedia><Avatar size="sm" className={`ring-2 ring-offset-2 ring-offset-background ${c.presence ? presenceRing[c.presence] : "ring-border"}`}><AvatarFallback>{c.initial}</AvatarFallback></Avatar></ItemMedia>
                        <ItemContent><ItemTitle>{c.name}</ItemTitle><p className="text-xs text-muted-foreground">{c.email}</p></ItemContent>
                        <ItemActions>
                          <Select value={m.role} onValueChange={(v) => setMembers((prev) => prev.map((x) => x.id === m.id ? { ...x, role: v as Role } : x))} disabled={demoState === "offline"}>
                            <SelectTrigger size="sm" className="w-24"><SelectValue>{roleLabel(m.role)}</SelectValue></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="editor">可编辑</SelectItem>
                              <SelectItem value="commenter">可评审</SelectItem>
                              <SelectItem value="viewer">可查看</SelectItem>
                            </SelectContent>
                          </Select>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon-xs" aria-label={`移除 ${c.name}`} disabled={demoState === "offline"}><X /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>移除协作者 {c.name}？</AlertDialogTitle>
                                <AlertDialogDescription>移除后该用户将无法访问此文档；你可以随时重新邀请。</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={() => { setMembers((prev) => prev.filter((x) => x.id !== m.id)); toast(`已移除 ${c.name}`) }}>移除</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </ItemActions>
                      </Item>
                    )
                  })}
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-2 text-sm font-medium">通过链接分享</p>
                <div className="flex items-center gap-2">
                  <Link2 className="size-4 shrink-0 text-muted-foreground" />
                  <Input
                    readOnly
                    value="https://cordex.example.com/d/8f2a91c"
                    // md:text-xs：覆盖 shadcn Input 基础类里的 md:text-sm，链接字段在桌面宽度下同为 12px（09 §3「字段 h-7 text-xs」；高度保持 h-8，与右侧「复制链接」按钮对齐）
                    className="flex-1 font-mono text-xs md:text-xs"
                    aria-label="分享链接"
                  />
                  <Button
                    variant="outline"
                    disabled={demoState === "offline"}
                    onClick={() => { navigator.clipboard?.writeText("https://cordex.example.com/d/8f2a91c"); setCopied(true); window.setTimeout(() => setCopied(false), 1500) }}
                  >
                    {copied ? <><Check /> 已复制</> : <><Copy /> 复制链接</>}
                  </Button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">链接权限</span>
                  <Select value={linkAccess} onValueChange={setLinkAccess} disabled={demoState === "offline"}>
                    <SelectTrigger size="sm" className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invite-only">仅邀请的用户可访问</SelectItem>
                      <SelectItem value="login-view">登录用户凭链接可查看</SelectItem>
                      <SelectItem value="login-comment">登录用户凭链接可评审</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">打开链接需要先登录</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReadonlyMemberRow({ name, sub, role, self }: { name: string; sub: string; role: string; self?: boolean }) {
  return (
    <Item variant="muted" size="sm">
      <ItemMedia><Avatar size="sm" className={self ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : undefined}><AvatarFallback>{name[0]}</AvatarFallback></Avatar></ItemMedia>
      <ItemContent><ItemTitle>{name}{self && "（我）"}</ItemTitle>{sub && <p className="text-xs text-muted-foreground">{sub}</p>}</ItemContent>
      <ItemActions><Badge variant="outline" className="text-xs font-normal">{role}</Badge></ItemActions>
    </Item>
  )
}
