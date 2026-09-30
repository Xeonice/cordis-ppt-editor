import { useState } from "react"
import { Link } from "react-router-dom"
import {
  AlignCenter, AlignLeft, AlignRight, ArrowLeft, Bold, ChevronDown, Copy, Italic, LayoutTemplate, MessageSquare,
  MoreHorizontal, Plus, Redo2, Scissors, Search, Share2, Trash2, Underline, Undo2, WifiOff,
} from "lucide-react"
import { toast } from "sonner"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command"
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { EditorRibbon } from "@/components/editor/Ribbon"
import type { RibbonTabValue } from "@/components/editor/Ribbon"
import { ThemeToggle } from "@/components/theme-toggle"
import { slides } from "@/lib/mock-data"

function Section({ id, title, spec, children }: { id: string; title: string; spec: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="font-mono text-xs text-muted-foreground">{spec}</span>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-6 pt-6">{children}</CardContent>
      </Card>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-[160px_1fr] md:items-start">
      <div className="text-xs font-medium text-muted-foreground md:pt-2">{label}</div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

const tokens: { name: string; cls: string; use: string }[] = [
  { name: "background / foreground", cls: "bg-background", use: "面板、工具条、对话框" },
  { name: "canvas", cls: "bg-canvas", use: "画布视口与页面底" },
  { name: "muted / muted-foreground", cls: "bg-muted", use: "选中态底、说明文字" },
  { name: "input（字段填充基色，50% 叠加）", cls: "bg-input/50", use: "输入框、下拉、文本域填充；描边用 border-control" },
  { name: "accent", cls: "bg-accent", use: "hover 高亮、选中行" },
  { name: "primary · 亮 #3A5CE6 / 暗 #6B93FF", cls: "bg-primary", use: "主按钮、选中指示、焦点环（一屏 ≤ 3 处实心）" },
  { name: "destructive", cls: "bg-destructive", use: "删除类操作" },
  { name: "success", cls: "bg-success", use: "已保存、已同步（文字用 success-foreground）" },
  { name: "warning", cls: "bg-warning", use: "离线、评论钉（文字用 warning-foreground）" },
  { name: "info", cls: "bg-info", use: "同步中、母版视图徽标" },
  { name: "border / input", cls: "bg-input", use: "分隔线 border；控件边界 input（≥3:1）" },
  { name: "presence-1…12", cls: "bg-presence-1", use: "仅头像环、远端光标与选区" },
  { name: "doc-paper / stage", cls: "bg-stage", use: "幻灯片纸面与放映舞台，不随主题" },
]

export function Styleguide() {
  const [align, setAlign] = useState("left")
  const [progress] = useState(42)
  const [ribbonTab, setRibbonTab] = useState<RibbonTabValue>("home")
  const currentSlide = slides[0]!
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="glass-strong sticky top-0 z-50 isolate flex h-12 items-center gap-3 px-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/"><ArrowLeft /> 目录</Link>
        </Button>
        <span className="text-sm font-semibold">样式指南</span>
        <Badge variant="secondary">radix-rhea · Lucide · Geist</Badge>
        <nav className="ml-4 hidden gap-1 md:flex" aria-label="章节">
          {["tokens", "buttons", "inputs", "nav", "overlays", "feedback", "data", "editor"].map((s) => (
            <Button key={s} asChild variant="ghost" size="xs"><a href={`#${s}`}>{s}</a></Button>
          ))}
        </nav>
        <div className="ml-auto"><ThemeToggle /></div>
      </header>

      <main className="relative z-0 mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6">
        <Section id="tokens" title="Token 与字阶" spec="09 §1 · 04">
          <Row label="语义色">
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {tokens.map((t) => (
                <div key={t.name} className="flex items-center gap-3 rounded-md border p-2">
                  <span className={`size-7 shrink-0 rounded-md border ${t.cls}`} aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs">{t.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{t.use}</div>
                  </div>
                </div>
              ))}
            </div>
          </Row>
          <Row label="字阶">
            <div className="flex flex-col gap-1">
              <div className="text-xs text-muted-foreground">text-xs 12 · 说明、时间戳、状态栏</div>
              <div className="text-sm">text-sm 14 · UI 默认（按钮、菜单、字段、页签）</div>
              <div className="text-base font-semibold">text-base 16 semibold · 分区/对话框标题</div>
              <div className="text-xl font-semibold">text-xl 20 · 空态与页面标题</div>
              <div className="tabular-nums text-sm">1,920 × 1,080 · 第 12/48 页 · 14:32 · 数字一律 tabular-nums</div>
            </div>
          </Row>
          <Row label="材质">
            <div className="w-full rounded-2xl bg-canvas p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="glass rounded-2xl p-4">
                  <p className="text-sm font-medium">glass · 72% / 62%</p>
                  <p className="text-xs text-muted-foreground">画布上的浮动面板、状态胶囊；装饰性弱内容层</p>
                </div>
                <div className="glass-strong rounded-2xl p-4">
                  <p className="text-sm font-medium">glass-strong · 84% / 78%</p>
                  <p className="text-xs text-muted-foreground">工具卡、侧栏、检查器等常驻面板；文字密集，取高不透明档</p>
                </div>
                {/* 浮层档：暗色下弹层会叠在白色纸面上，78% 时说明文字只有 2.5:1，故单列一档 */}
                {/* 右半边垫一条白纸面，示意浮层压在幻灯片上的情形 */}
                <div className="relative overflow-hidden rounded-2xl">
                  <div className="absolute inset-y-0 right-0 w-1/2 bg-doc-paper" aria-hidden="true" />
                  <div className="glass-float relative h-full rounded-2xl p-4">
                    <p className="text-sm font-medium">glass-float · 84% / 96%</p>
                    <p className="text-xs text-muted-foreground">弹层、菜单、对话框、画布迷你工具条与浮签；暗色叠在白纸面上仍 ≥ 4.5:1</p>
                  </div>
                </div>
              </div>
            </div>
            <p className="max-w-[70ch] text-xs text-muted-foreground">
              系统开启"降低透明度"（<code className="rounded bg-muted px-1 py-0.5 font-mono text-2xs">prefers-reduced-transparency: reduce</code>）
              或浏览器不支持 <code className="rounded bg-muted px-1 py-0.5 font-mono text-2xs">backdrop-filter</code> 时，
              两者退化为不透明 <code className="rounded bg-muted px-1 py-0.5 font-mono text-2xs">--card</code> + 无模糊，文字对比度不受影响。
            </p>
          </Row>
        </Section>

        <Section id="buttons" title="按钮与切换" spec="C-01 … C-05">
          <Row label="Button 变体">
            <Button><Plus /> 新建幻灯片</Button>
            <Button variant="secondary">次要</Button>
            <Button variant="outline"><Share2 /> 分享</Button>
            <Button variant="ghost">适应窗口</Button>
            <Button variant="destructive"><Trash2 /> 删除版式</Button>
            <Button variant="link">查看导入详情</Button>
            <Button disabled>禁用</Button>
            <Button variant="outline" disabled><Spinner /> 处理中</Button>
          </Row>
          <Row label="尺寸">
            <Button size="xs">xs 24</Button>
            <Button size="sm">sm 28</Button>
            <Button>default 32</Button>
            <Button size="lg">lg 36</Button>
            <Tooltip><TooltipTrigger asChild><Button size="icon" variant="outline" aria-label="更多"><MoreHorizontal /></Button></TooltipTrigger><TooltipContent>更多操作</TooltipContent></Tooltip>
          </Row>
          <Row label="ButtonGroup / Toggle">
            <ButtonGroup>
              <Button variant="outline" size="sm"><Undo2 /> 撤销</Button>
              <Button variant="outline" size="sm"><Redo2 /> 重做</Button>
            </ButtonGroup>
            <ToggleGroup type="single" variant="outline" size="sm" value={align} onValueChange={(v) => v && setAlign(v)} aria-label="对齐">
              <ToggleGroupItem value="left" aria-label="左对齐"><AlignLeft /></ToggleGroupItem>
              <ToggleGroupItem value="center" aria-label="居中"><AlignCenter /></ToggleGroupItem>
              <ToggleGroupItem value="right" aria-label="右对齐"><AlignRight /></ToggleGroupItem>
            </ToggleGroup>
            <Toggle aria-label="加粗" size="sm" defaultPressed><Bold /></Toggle>
            <Toggle aria-label="斜体" size="sm"><Italic /></Toggle>
            <Toggle aria-label="下划线" size="sm"><Underline /></Toggle>
            <ToggleGroup type="single" size="sm" defaultValue="normal" aria-label="侧栏模式">
              <ToggleGroupItem value="normal">普通</ToggleGroupItem>
              <ToggleGroupItem value="master">母版</ToggleGroupItem>
            </ToggleGroup>
          </Row>
          <Row label="Switch / Checkbox / Radio">
            <div className="flex items-center gap-2"><Switch id="sw1" defaultChecked /><Label htmlFor="sw1">启用数据图表插件</Label></div>
            <div className="flex items-center gap-2"><Checkbox id="cb1" defaultChecked /><Label htmlFor="cb1">显示网格</Label></div>
            <RadioGroup defaultValue="keep" className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="keep" id="r1" /><Label htmlFor="r1">保留母版</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="drop" id="r2" /><Label htmlFor="r2">不保留</Label></div>
            </RadioGroup>
          </Row>
        </Section>

        <Section id="inputs" title="输入与表单" spec="C-06 … C-08">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="f-invite">邀请协作者</FieldLabel>
                <InputGroup>
                  <InputGroupAddon><Search /></InputGroupAddon>
                  <InputGroupInput id="f-invite" placeholder="例如 lilei@example.com" />
                </InputGroup>
                <FieldDescription>输入邮箱或姓名，默认权限为"可评审"</FieldDescription>
              </Field>
              <Field data-invalid="true">
                <FieldLabel htmlFor="f-title">文档标题</FieldLabel>
                <Input id="f-title" defaultValue="2026年Q2业绩汇报/final" aria-invalid="true" />
                <FieldError>标题不能包含 / 字符</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="f-layout">版式</FieldLabel>
                <Select defaultValue="title-content">
                  <SelectTrigger id="f-layout" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="title-content">标题和内容</SelectItem>
                    <SelectItem value="two">两栏内容</SelectItem>
                    <SelectItem value="title">仅标题</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                {[["X", "120"], ["Y", "80"], ["宽", "320"], ["高", "96"]].map(([l, v]) => (
                  <div key={l} className="grid grid-cols-[2.5rem_1fr] items-center gap-2">
                    <Label htmlFor={`p-${l}`} className="text-xs text-muted-foreground">{l}</Label>
                    <Input id={`p-${l}`} defaultValue={v} inputMode="decimal" className="tabular-nums" />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">单位：cm，可在设置中切换</p>
              <div className="flex items-center gap-3">
                <Label className="w-14 text-xs text-muted-foreground">透明度</Label>
                <Slider defaultValue={[60]} max={100} step={1} className="flex-1" aria-label="透明度" />
                <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">60%</span>
              </div>
              <div className="flex items-center gap-3">
                <Label className="w-14 text-xs text-muted-foreground">填充</Label>
                <button type="button" className="size-7 rounded-md border border-input p-0.5" aria-label="填充颜色，当前主色">
                  <span className="block size-full rounded-sm bg-primary" />
                </button>
                <Input defaultValue="#4A54E1" className="w-32 font-mono" aria-label="填充颜色十六进制" />
              </div>
            </div>
          </div>
        </Section>

        <Section id="nav" title="页签、徽标、头像、键帽" spec="C-09 … C-11 · C-25">
          <Row label="Tabs">
            <Tabs defaultValue="props" className="w-full max-w-md">
              <TabsList className="w-full">
                <TabsTrigger value="props">属性</TabsTrigger>
                <TabsTrigger value="comments">评论 <Badge variant="secondary" className="ml-1">3</Badge></TabsTrigger>
                <TabsTrigger value="history">历史</TabsTrigger>
                <TabsTrigger value="plugins" disabled>插件</TabsTrigger>
              </TabsList>
              <TabsContent value="props" className="pt-3 text-sm text-muted-foreground">检查器坞：属性面板内容</TabsContent>
              <TabsContent value="comments" className="pt-3 text-sm text-muted-foreground">评论线程列表</TabsContent>
              <TabsContent value="history" className="pt-3 text-sm text-muted-foreground">版本历史</TabsContent>
            </Tabs>
          </Row>
          <Row label="Badge">
            <Badge>默认</Badge>
            <Badge variant="secondary">12</Badge>
            <Badge variant="outline">母版视图</Badge>
            <Badge className="bg-success-muted text-success-foreground border-transparent">已同步</Badge>
            <Badge className="bg-warning-muted text-warning-foreground border-transparent">已脱离锚点</Badge>
            <Badge variant="destructive">启动失败</Badge>
            <Badge variant="outline" className="text-primary">插件 · ACME</Badge>
          </Row>
          <Row label="Avatar + presence 环">
            <AvatarGroup>
              <Avatar className="ring-2 ring-primary ring-offset-2 ring-offset-background"><AvatarFallback>我</AvatarFallback></Avatar>
              <Avatar className="ring-2 ring-presence-2 ring-offset-2 ring-offset-background"><AvatarFallback>王</AvatarFallback></Avatar>
              <Avatar className="ring-2 ring-presence-5 ring-offset-2 ring-offset-background"><AvatarFallback>李</AvatarFallback></Avatar>
              <AvatarGroupCount>+2</AvatarGroupCount>
            </AvatarGroup>
          </Row>
          <Row label="Kbd">
            <KbdGroup><Kbd>⌘</Kbd><Kbd>⇧</Kbd><Kbd>P</Kbd></KbdGroup>
            <span className="text-xs text-muted-foreground">命令面板</span>
            <KbdGroup><Kbd>Del</Kbd></KbdGroup>
            <span className="text-xs text-muted-foreground">删除（可撤销）</span>
          </Row>
        </Section>

        <Section id="overlays" title="菜单、弹层、对话框" spec="C-12 … C-15">
          <Row label="DropdownMenu / ContextMenu / Popover">
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="sm">对象操作 <ChevronDown /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>形状</DropdownMenuLabel>
                <DropdownMenuItem><Scissors /> 剪切 <DropdownMenuShortcut>⌘X</DropdownMenuShortcut></DropdownMenuItem>
                <DropdownMenuItem><Copy /> 复制 <DropdownMenuShortcut>⌘C</DropdownMenuShortcut></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive"><Trash2 /> 删除 <DropdownMenuShortcut>Del</DropdownMenuShortcut></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div className="flex h-9 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">在此右键</div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-52">
                <ContextMenuItem>添加批注</ContextMenuItem>
                <ContextMenuItem>置于顶层</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem variant="destructive">删除 <ContextMenuShortcut>Del</ContextMenuShortcut></ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
            <Popover>
              <PopoverTrigger asChild><Button variant="outline" size="sm">主题颜色</Button></PopoverTrigger>
              <PopoverContent className="w-56">
                <div className="mb-2 text-sm font-medium">主题颜色</div>
                <div className="grid grid-cols-6 gap-2">
                  {["bg-doc-ink", "bg-doc-paper", "bg-primary", "bg-presence-5", "bg-presence-3", "bg-presence-6"].map((c) => (
                    <button key={c} type="button" className={`size-7 rounded-md border ${c}`} aria-label={c} />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </Row>
          <Row label="Dialog / AlertDialog / Sheet">
            <Dialog>
              <DialogTrigger asChild><Button size="sm">分享文档</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>分享"2026年Q2业绩汇报.pptx"</DialogTitle>
                  <DialogDescription>邀请协作者并设置权限，变更即时生效。</DialogDescription>
                </DialogHeader>
                <Field>
                  <FieldLabel htmlFor="d-invite">邀请协作者</FieldLabel>
                  <Input id="d-invite" placeholder="例如 lilei@example.com" />
                  <FieldDescription>默认权限为"可评审"</FieldDescription>
                </Field>
                <DialogFooter>
                  <Button variant="outline">复制链接</Button>
                  <Button>邀请</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive" size="sm">删除版式</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>删除版式"两栏内容"？</AlertDialogTitle>
                  <AlertDialogDescription>该版式正被 2 页引用，删除后这些页面将改用"标题和内容"。</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction>删除并改用</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Sheet>
              <SheetTrigger asChild><Button variant="outline" size="sm">窄屏检查器（Sheet）</Button></SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>属性</SheetTitle>
                  <SheetDescription>窄屏下检查器坞以抽屉呈现</SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>
            <Button variant="outline" size="sm" onClick={() => toast("已删除 1 个对象", { action: { label: "撤销", onClick: () => toast.success("已撤销删除") } })}>可撤销 toast</Button>
          </Row>
          <Row label="Command（命令面板）">
            <Command className="w-full max-w-md rounded-lg border">
              <CommandInput placeholder="搜索命令…" />
              <CommandList>
                <CommandEmpty>没有匹配的命令</CommandEmpty>
                <CommandGroup heading="插入">
                  <CommandItem>插入图片</CommandItem>
                  <CommandItem>插入表格</CommandItem>
                </CommandGroup>
                <CommandGroup heading="文件">
                  <CommandItem>导出为 pptx <CommandShortcut>⌘E</CommandShortcut></CommandItem>
                  <CommandItem>版本历史</CommandItem>
                </CommandGroup>
                <CommandGroup heading="插件 · ACME">
                  <CommandItem>插入流程图节点</CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </Row>
        </Section>

        <Section id="feedback" title="反馈：Alert、进度、骨架、空态" spec="C-16 … C-17 · C-23 · C-24">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <Alert className="border-warning/40 bg-warning-muted text-warning-foreground">
                <WifiOff />
                <AlertTitle>离线</AlertTitle>
                <AlertDescription>更改已保存在本地，将在重新连接后同步</AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertTitle>你的权限已变更为"可评审"，3 项更改未被保存</AlertTitle>
                <AlertDescription>文档已重新载入服务端版本，撤销历史已清空。</AlertDescription>
              </Alert>
              <Alert className="border-info/40 bg-info-muted text-info-foreground">
                <LayoutTemplate />
                <AlertTitle>正在编辑母版视图</AlertTitle>
                <AlertDescription>改动将影响 4 个使用此版式的页面</AlertDescription>
              </Alert>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>正在解析母版/版式</span><span className="tabular-nums">{progress}%</span></div>
                <Progress value={progress} aria-label="导入进度" />
              </div>
              <div className="flex items-center gap-3"><Skeleton className="size-9 rounded-md" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-3/5" /><Skeleton className="h-3 w-2/5" /></div></div>
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><MessageSquare /></EmptyMedia>
                  <EmptyTitle>还没有评论</EmptyTitle>
                  <EmptyDescription>选中对象后点击"添加批注"开始讨论</EmptyDescription>
                </EmptyHeader>
                <EmptyContent><Button variant="outline" size="sm">添加批注</Button></EmptyContent>
              </Empty>
            </div>
          </div>
        </Section>

        <Section id="data" title="列表、表格、折叠、可拖分栏" spec="C-18 … C-21">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Item variant="outline" size="sm">
                <ItemMedia variant="icon"><LayoutTemplate /></ItemMedia>
                <ItemContent>
                  <ItemTitle>标题和内容</ItemTitle>
                  <ItemDescription>公司主题 · 4 页引用</ItemDescription>
                </ItemContent>
                <Badge variant="secondary">当前</Badge>
              </Item>
              <Accordion type="single" collapsible defaultValue="pos" className="rounded-md border px-3">
                <AccordionItem value="pos">
                  <AccordionTrigger className="text-sm">位置与大小</AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground">X 120 · Y 80 · 宽 320 · 高 96</AccordionContent>
                </AccordionItem>
                <AccordionItem value="text">
                  <AccordionTrigger className="text-sm">文本样式 <Badge variant="outline" className="ml-2 text-primary">已覆盖</Badge></AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground">第一级 32pt · 系统 UI 字体</AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
            <div className="flex flex-col gap-3">
              <Table>
                <TableHeader><TableRow><TableHead>版本</TableHead><TableHead>作者</TableHead><TableHead className="text-right">时间</TableHead></TableRow></TableHeader>
                <TableBody>
                  <TableRow><TableCell className="font-medium">提案定稿</TableCell><TableCell>王小明</TableCell><TableCell className="text-right tabular-nums">昨天</TableCell></TableRow>
                  <TableRow><TableCell>自动版本</TableCell><TableCell>我</TableCell><TableCell className="text-right tabular-nums">14:32</TableCell></TableRow>
                </TableBody>
              </Table>
              <ResizablePanelGroup orientation="horizontal" className="h-24 rounded-md border">
                <ResizablePanel defaultSize="30%" className="flex items-center justify-center text-xs text-muted-foreground">缩略图栏</ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel className="flex items-center justify-center bg-canvas text-xs text-muted-foreground">画布</ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize="30%" className="flex items-center justify-center text-xs text-muted-foreground">检查器</ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </div>
        </Section>

        <Section id="editor" title="编辑器组合示例：Ribbon 条" spec="P-01">
          <div className="rounded-2xl bg-canvas p-4">
            <div className="glass-strong overflow-hidden rounded-2xl">
              <EditorRibbon
                value={ribbonTab}
                onValueChange={setRibbonTab}
                currentMasterId={currentSlide.masterId}
                currentLayoutId={currentSlide.layoutId}
              />
            </div>
          </div>
          <CardDescription>
            直接复用 <code className="rounded bg-muted px-1 py-0.5 font-mono text-2xs">components/editor/Ribbon.tsx</code> 的{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-2xs">EditorRibbon</code>，与 <code className="rounded bg-muted px-1 py-0.5 font-mono text-2xs">#/editor</code> 完全同一份组件——Ribbon 的任何样式改动都会自动同步到这里，不需要单独维护一份仿制样张。
          </CardDescription>
        </Section>
      </main>
    </div>
  )
}
