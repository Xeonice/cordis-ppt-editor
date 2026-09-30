import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Blocks, ChevronLeft, ChevronRight, Highlighter, Lock, MessageSquarePlus, Puzzle, Sparkles, TriangleAlert, Users } from "lucide-react"
import { toast } from "sonner"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import {
  AppBar, CanvasElementBox, ColorPickerPopover, CommentPin, DesignBar, EditorRibbon, Inspector, MiniToolbar,
  MixedValueField, NotesBar, NumberField, PresenceStack, PropertyRow, PropertyRowPair, RemoteCursor,
  RemoteSelectionBox, ReviewToolbar, ReviewToolbarSeparator, RibbonTrailing, SelectionBox, SlideCanvas, StatusBar,
  StatusText, ThumbnailRail,
} from "@/components/editor"
import type { ZoomValue } from "@/components/editor/SlideCanvas"
import { EditorShell } from "@/components/editor/EditorShell"
import type { RibbonTabValue } from "@/components/editor/Ribbon"
import type { InspectorTabValue } from "@/components/editor/Inspector"
import { collaboratorById, collaborators, documentTitle, slides } from "@/lib/mock-data"

type DemoState = "default" | "text" | "multi" | "review" | "review-empty" | "loading" | "error"
type DemoRole = "owner" | "editor" | "commenter" | "viewer"

const stateOptions = [
  { value: "default", label: "默认 · 选中形状" },
  { value: "text", label: "文本编辑态" },
  { value: "multi", label: "多选" },
  { value: "review", label: "评审 · 有条目" },
  // FE-08：M2 未装 comments 包时 slide.hasComments 为假，评审工具条条目全部不可见（50/10 §3.2），这是 M2 的常态
  { value: "review-empty", label: "评审 · 无条目（M2）" },
  { value: "loading", label: "加载骨架" },
  { value: "error", label: "打开失败" },
]
const roleValues: DemoRole[] = ["owner", "editor", "commenter", "viewer"]

export function EditorMain() {
  const navigate = useNavigate()
  // 样张直达：`#/editor?state=review-empty&role=viewer`（只取首帧初值，之后由演示控制条切换）
  const [searchParams] = useSearchParams()
  const [demoState, setDemoState] = useState<DemoState>(() => {
    const s = searchParams.get("state")
    return stateOptions.some((o) => o.value === s) ? (s as DemoState) : "default"
  })
  const [role, setRole] = useState<DemoRole>(() => {
    const r = searchParams.get("role") as DemoRole | null
    return r && roleValues.includes(r) ? r : "owner"
  })
  const [ribbonTab, setRibbonTab] = useState<RibbonTabValue>("home")
  const [inspectorTab, setInspectorTab] = useState<InspectorTabValue>("properties")
  const [zoom, setZoom] = useState<ZoomValue>("fit")
  const [effectiveZoom, setEffectiveZoom] = useState(100)
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState("")
  const [currentSlideId, setCurrentSlideId] = useState(slides[0]!.id)
  const [lockAspect, setLockAspect] = useState(false)

  const canEdit = role === "owner" || role === "editor"
  // rulings §4.18 UX-19：查看者（仅 doc.read）进同一协同编辑器的只读变体 mode='view'——无评论/高亮等创建类按钮，可阅读评论
  const isViewer = role === "viewer"
  const canComment = !isViewer
  // rulings U-09 / §4.18 UX-17：history.read 只下放到编辑者，评审者与查看者没有「历史」入口
  const canReadHistory = canEdit
  const inReview = demoState === "review" || demoState === "review-empty"
  const readOnly = inReview || !canEdit
  // M2 未装 comments 包：slide.hasComments 为假——评审工具条无条目、画布无评论钉、检查器无「评论」页签、缩略图无评论计数
  const noComments = demoState === "review-empty"
  // Mod+Alt+M 进入母版视图（rulings Q12：评审 / 无权限 / < 1024 宽度下无效）；macOS 下 Alt 改变 e.key，故用 e.code
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.altKey || e.code !== "KeyM") return
      if (readOnly || !window.matchMedia("(min-width: 1024px)").matches) return
      e.preventDefault()
      navigate("/editor/masters")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [readOnly, navigate])
  const currentSlide = slides.find((s) => s.id === currentSlideId) ?? slides[0]!
  // 评审模式与查看者变体的检查器默认显示「评论」（01-IA §5.1）
  useEffect(() => {
    if (!canEdit) setInspectorTab("comments")
  }, [canEdit])
  // FE-15：编辑者切到评审（有条目）时检查器也默认打开「评论」；「属性」页签只读可切换（01-IA §5.1、50/10 §3.2）
  useEffect(() => {
    if (demoState === "review") setInspectorTab("comments")
  }, [demoState])

  // 01-IA §5.2：模式下拉 = 编辑 / 评审 / 放映；查看者只列「只读浏览」与「放映」（UX-19）
  const presentOption = { value: "present", label: "放映" }
  const modeOptions = canEdit
    ? [{ value: "edit", label: "编辑" }, { value: "review", label: "评审模式" }, presentOption]
    : role === "commenter"
      ? [{ value: "review", label: "评审模式" }, presentOption]
      : [{ value: "view", label: "只读浏览" }, presentOption]
  const modeValue = !canEdit ? modeOptions[0]!.value : inReview ? "review" : "edit"

  const otherCollaborators = useMemo(() => collaborators.filter((c) => !c.isSelf), [])
  const wang = collaboratorById("wang")
  const li = collaboratorById("li")

  function handleModeChange(v: string) {
    if (v === "present") { navigate("/present"); return }
    if (!canEdit) return
    setDemoState(v === "review" ? (inReview ? demoState : "review") : "default")
  }

  const railSlides = useMemo(() => (noComments ? slides.map((s) => ({ ...s, commentCount: 0 })) : slides), [noComments])

  // FE-08：评审 / 只读浏览的 Ribbon 区域位。条目由 slide-ui 以 ui.toolbar{slot:'reviewBar'} 贡献（50/10 §3.2）：
  // 创建类（评论、高亮）when: editorMode == 'review' && slide.hasComments；跳转类 when: slide.hasComments。
  // 右端「主题 · ?」由外壳直接渲染（RibbonTrailing，与编辑模式页签行右侧同组件）；「普通 | 母版」不渲染（Q12）。
  const reviewBar = (
    <ReviewToolbar
      emptyNotice={isViewer ? "只读浏览中" : "评审模式 · 只读"}
      trailing={<RibbonTrailing onOpenShortcuts={() => navigate("/settings?panel=shortcuts")} />}
    >
      {!noComments && canComment && (
        <Button key="comment" variant="outline" size="sm" onClick={() => { setInspectorTab("comments"); toast("已打开评论") }}>
          <MessageSquarePlus data-icon="inline-start" /> 评论
        </Button>
      )}
      {!noComments && canComment && (
        <Button key="highlight" variant="outline" size="sm" onClick={() => toast("在画布上拖选要高亮的区域")}>
          <Highlighter data-icon="inline-start" /> 高亮
        </Button>
      )}
      {!noComments && canComment && <ReviewToolbarSeparator key="sep" />}
      {!noComments && (
        <Button key="prev" variant="ghost" size="sm" onClick={() => setInspectorTab("comments")}>
          <ChevronLeft data-icon="inline-start" /> 上一处评论
        </Button>
      )}
      {!noComments && (
        <Button key="next" variant="ghost" size="sm" onClick={() => setInspectorTab("comments")}>
          下一处评论 <ChevronRight data-icon="inline-end" />
        </Button>
      )}
      {!noComments && isViewer && (
        <span key="hint" className="ml-2 truncate text-xs text-muted-foreground">只读浏览 · 可阅读评论，实时查看修改</span>
      )}
    </ReviewToolbar>
  )

  const appBar = (
    <AppBar
      onBack={() => navigate("/home")}
      title={demoState === "loading" ? `正在打开 ${documentTitle} …` : documentTitle}
      onRename={demoState === "loading" || demoState === "error" ? undefined : () => toast("重命名文档")}
      badges={readOnly && <Badge variant="outline" className="border-info/40 bg-info-muted text-info-foreground">{isViewer ? "只读浏览中" : "评审模式"}</Badge>}
      undo={!readOnly && demoState !== "loading" && demoState !== "error" ? { label: "撤销：移动形状 (⌘Z)", onClick: () => toast("已撤销") } : undefined}
      redo={!readOnly && demoState !== "loading" && demoState !== "error" ? { label: "重做", disabled: true } : undefined}
      status={demoState === "loading" || demoState === "error" ? undefined : { kind: "sync", state: "synced" }}
      collaborators={demoState === "error" ? undefined : otherCollaborators}
      moreMenu={demoState !== "loading" && demoState !== "error"}
    >
      {demoState !== "loading" && demoState !== "error" && (
        <>
          <Button variant="outline" size="sm" onClick={() => navigate("/editor/share")}>分享</Button>
          <Select value={modeValue} onValueChange={handleModeChange}>
            <SelectTrigger size="sm" className="w-32" aria-label="编辑模式"><SelectValue /></SelectTrigger>
            <SelectContent>{modeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </>
      )}
    </AppBar>
  )

  if (demoState === "error") {
    return (
      <div className="flex h-dvh flex-col bg-canvas">
        <DesignBar title="编辑器主界面" spec="03-screens/02" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} role={role} onRoleChange={(v) => setRole(v as DemoRole)} />
        <div className="glass-strong mx-2 mt-2 rounded-2xl">{appBar}</div>
        <Empty className="flex-1">
          <EmptyMedia variant="icon"><TriangleAlert className="text-destructive" /></EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>无法打开该文档</EmptyTitle>
            <EmptyDescription>不支持的文件格式，请检查后重新导入</EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => navigate("/documents")}>返回文档列表</Button>
        </Empty>
      </div>
    )
  }

  if (demoState === "loading") {
    return (
      <div className="flex h-dvh flex-col bg-canvas">
        <DesignBar title="编辑器主界面" spec="03-screens/02" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} role={role} onRoleChange={(v) => setRole(v as DemoRole)} />
        <EditorShell
          appBar={appBar}
          ribbon={
            <div className="flex h-24 shrink-0 items-center gap-2 border-t border-foreground/5 px-3 opacity-50">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-16" />)}
            </div>
          }
          thumbnailRail={<ThumbnailRail mode="normal" slides={[]} loading />}
          canvas={
            <div className="flex flex-1 items-center justify-center bg-canvas">
              <Skeleton className="aspect-video w-2/3 animate-pulse rounded" />
            </div>
          }
          inspector={
            <div className="flex flex-col gap-2 p-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          }
          statusBar={<StatusBar left={["正在解析母版与版式…"]} right={[<Slider key="p" value={[62]} className="w-32" disabled aria-label="加载进度" />, "62%"]} />}
        />
      </div>
    )
  }

  const railMode = "normal" as const

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar
        title="编辑器主界面"
        spec="03-screens/02"
        state={demoState}
        onStateChange={(v) => setDemoState(v as DemoState)}
        stateOptions={stateOptions}
        role={role}
        onRoleChange={(v) => setRole(v as DemoRole)}
        extra={
          <div className="flex flex-wrap gap-1.5">
            <Button variant="ghost" size="xs" onClick={() => toast("王小明 之后修改了此处，已跳过")}>演示：撤销已跳过</Button>
            <Button variant="ghost" size="xs" onClick={() => toast("无法撤销：此处已被 王小明 修改 / 删除")}>演示：整步撤销被跳过</Button>
            <Button variant="ghost" size="xs" onClick={() => toast("王小明 也在移动这个形状", { action: { label: "恢复我的值", onClick: () => toast.success("已恢复为我的值") } })}>演示：恢复我的值</Button>
            <Button variant="ghost" size="xs" onClick={() => toast("该元素已被 王小明 删除", { action: { label: "恢复元素（含我的编辑）", onClick: () => toast.success("已恢复，评论回到原锚点") } })}>演示：恢复元素</Button>
          </div>
        }
      />
      <EditorShell
        appBar={appBar}
        ribbon={
          readOnly ? reviewBar : (
            <EditorRibbon
              value={ribbonTab}
              onValueChange={setRibbonTab}
              currentMasterId={currentSlide.masterId}
              currentLayoutId={currentSlide.layoutId}
              onInsertSlide={() => toast("已新建幻灯片")}
              onOpenFind={() => toast("已打开查找与替换")}
              onAddComment={() => setInspectorTab("comments")}
              onEnterMasterView={() => navigate("/editor/masters")}
              onOpenShortcuts={() => navigate("/settings?panel=shortcuts")}
              zoom={effectiveZoom}
              onZoomChange={setZoom}
              showThumbnailRail
              showNotes={notesOpen}
              onShowNotesChange={setNotesOpen}
              emphasize={demoState === "text" ? "font" : undefined}
            />
          )
        }
        thumbnailRail={
          <ThumbnailRail
            mode={railMode}
            slides={railSlides}
            currentSlideId={currentSlideId}
            onSelectSlide={setCurrentSlideId}
            onReorder={readOnly ? undefined : (from, to) => toast(`已将第 ${slides.find((s) => s.id === from)?.index} 页移动到第 ${slides.find((s) => s.id === to)?.index} 页附近`)}
            onDeleteSlide={() => toast("已删除 1 页", { action: { label: "撤销", onClick: () => toast.success("已撤销") } })}
            onDuplicateSlide={() => toast("已复制幻灯片")}
            onToggleHidden={() => toast("已切换隐藏状态")}
            onNewSlide={() => toast("已新建幻灯片")}
          />
        }
        canvas={
          <SlideCanvas zoom={zoom} onZoomChange={setZoom} onEffectiveZoomChange={setEffectiveZoom}>
            {/* 只读（评审 / 查看者变体）画布不出现选中手柄与插入符，01-IA §5.1 */}
            <CanvasScene state={readOnly ? "review" : demoState} />
          </SlideCanvas>
        }
        inspector={
          <Inspector
            value={
              noComments
                ? canReadHistory && inspectorTab === "history" ? "history" : "properties"
                : demoState === "review"
                  ? inspectorTab === "properties" || (canReadHistory && inspectorTab === "history") ? inspectorTab : "comments"
                  : !canReadHistory && inspectorTab === "history" ? "comments" : inspectorTab
            }
            onValueChange={setInspectorTab}
            readOnly={readOnly && !inReview}
            readOnlyReason={isViewer ? "只读 · 仅有查看权限" : undefined}
            tabs={
              noComments
                ? [
                    { value: "properties", label: "属性", content: <ReadOnlyProperties reason={isViewer ? "只读 · 仅有查看权限" : undefined}><PropertiesPanel state="default" lockAspect={lockAspect} onLockAspectChange={setLockAspect} /></ReadOnlyProperties> },
                    ...(canReadHistory ? [{ value: "history" as const, label: "历史", content: <HistoryPreviewPanel /> }] : []),
                  ]
                : demoState === "review"
                ? [
                    { value: "properties", label: "属性", content: <ReadOnlyProperties reason={isViewer ? "只读 · 仅有查看权限" : undefined}><PropertiesPanel state="default" lockAspect={lockAspect} onLockAspectChange={setLockAspect} /></ReadOnlyProperties> },
                    { value: "comments", label: "评论", badge: 1, content: <ReviewCommentsPanel readOnly={!canComment} /> },
                    ...(canReadHistory ? [{ value: "history" as const, label: "历史", content: <HistoryPreviewPanel /> }] : []),
                  ]
                : [
                    { value: "properties", label: "属性", content: <PropertiesPanel state={demoState} lockAspect={lockAspect} onLockAspectChange={setLockAspect} /> },
                    { value: "comments", label: "评论", content: <ReviewCommentsPanel readOnly={!canComment} /> },
                    ...(canReadHistory ? [{ value: "history" as const, label: "历史", content: <HistoryPreviewPanel /> }] : []),
                    { value: "plugins", label: "插件", content: <PluginsPreviewPanel /> },
                  ]
            }
          />
        }
        notesBar={<NotesBar open={notesOpen} onOpenChange={setNotesOpen} value={notes} onChange={setNotes} />}
        statusBar={
          <StatusBar
            left={[
              `第 ${currentSlide.index}/${slides.length} 页`,
              demoState === "multi" ? "已选中 3 个对象" : demoState === "text" ? "正在编辑文本" : isViewer ? "只读浏览中" : readOnly ? "评审模式 · 只读" : "已选中 1 个对象",
            ]}
            right={[
              <StatusText key="sync" status={{ kind: "sync", state: "synced" }} variant="dot" />,
              <span key="ppl" className="inline-flex items-center gap-1"><Users className="size-3.5" />{collaborators.length} 人在线</span>,
              <span key="plugin" className="inline-flex items-center gap-1"><Puzzle className="size-3.5" />插件正常</span>,
            ]}
          />
        }
      />
    </div>
  )

  function CanvasScene({ state }: { state: DemoState }) {
    if (state === "multi") {
      return (
        <>
          <CanvasElementBox box={{ x: 100, y: 220, w: 340, h: 140 }} className="flex items-center justify-center rounded-md bg-doc-ink/[0.04] p-4 text-sm text-doc-ink/70">优势：市场份额领先</CanvasElementBox>
          <CanvasElementBox box={{ x: 500, y: 220, w: 340, h: 140 }} className="flex items-center justify-center rounded-md bg-doc-ink/[0.04] p-4 text-sm text-doc-ink/70">挑战：供应链成本上升</CanvasElementBox>
          <CanvasElementBox box={{ x: 90, y: 90, w: 780, h: 64 }} className="flex items-center text-2xl font-semibold text-doc-ink">优势与挑战</CanvasElementBox>
          <SelectionBox box={{ x: 84, y: 210, w: 766, h: 160 }} label="已选中 2 个对象" showRotate={false} />
        </>
      )
    }
    if (state === "text") {
      return (
        <>
          <CanvasElementBox box={{ x: 90, y: 70, w: 780, h: 64 }} className="flex items-center text-2xl font-semibold text-doc-ink">业绩概览</CanvasElementBox>
          <CanvasElementBox box={{ x: 120, y: 180, w: 700, h: 36 }} className="flex items-center text-base text-doc-ink/80">Q2 营收同比增长 18%，超出既定目标</CanvasElementBox>
          <CanvasElementBox box={{ x: 120, y: 226, w: 700, h: 36 }} className="flex items-center border border-primary/60 bg-primary/5 text-base text-doc-ink">
            <span>毛利率维持在 42% 以上</span>
            <span className="ml-0.5 inline-block h-5 w-px animate-pulse bg-primary" aria-hidden="true" />
          </CanvasElementBox>
          <CanvasElementBox box={{ x: 120, y: 272, w: 700, h: 36 }} className="flex items-center text-base text-doc-ink/80">重点客户续约率达 95%</CanvasElementBox>
          {/* 锚在正在编辑的第二行右上方：首行文字只到约 x 390，工具条（屏幕尺寸）不盖住它 */}
          <EditingToolbar x={560} y={222} />
        </>
      )
    }
    if (state === "review") {
      return (
        <>
          <CanvasElementBox box={{ x: 90, y: 70, w: 780, h: 64 }} className="flex items-center text-2xl font-semibold text-doc-ink">产品线表现</CanvasElementBox>
          <CanvasElementBox box={{ x: 120, y: 180, w: 700, h: 220 }} className="flex flex-col justify-center gap-3 text-base text-doc-ink/80">
            <p>核心产品线收入贡献占比 61%，新产品线增速最快</p>
            <p>建议下一季度加大新产品线的市场投入</p>
          </CanvasElementBox>
          {!noComments && <CommentPin x={640} y={210} number={1} onClick={() => toast("定位到评论 #1")} />}
        </>
      )
    }
    return (
      <>
        <RemoteSelectionBox box={{ x: 130, y: 70, w: 700, h: 76 }} collaborator={li} />
        <CanvasElementBox box={{ x: 130, y: 70, w: 700, h: 76 }} className="flex items-center justify-center text-3xl font-semibold text-doc-ink">2026年Q2业绩汇报</CanvasElementBox>
        <SelectionBox box={{ x: 130, y: 190, w: 700, h: 56 }} label="标题占位符 · 我的选区" sizeLabel="宽 700 高 56" />
        <CanvasElementBox box={{ x: 130, y: 190, w: 700, h: 56 }} className="flex items-center justify-center text-lg text-doc-ink/70">本季度业绩概览与战略展望</CanvasElementBox>
        <RemoteCursor x={250} y={360} collaborator={wang} />
      </>
    )
  }
}

/** 文本编辑迷你工具条：与 03-16 同一个 MiniToolbar（屏幕坐标覆盖层，字号 12 px，不随画布缩放） */
function EditingToolbar({ x, y }: { x: number; y: number }) {
  return (
    <MiniToolbar x={x} y={y}>
      <span className="px-1.5 text-xs text-foreground/80">微软雅黑</span>
      <span className="px-1 text-xs text-muted-foreground tabular-nums">18</span>
      <span className="flex size-6 items-center justify-center" aria-hidden="true"><Sparkles className="size-3.5 text-muted-foreground" /></span>
    </MiniToolbar>
  )
}

/** 评审模式的「属性」页签：只读展示（01-IA §5.1、50/10 §3.2，rulings §4.20 FE-15）。fieldset disabled 让内部输入与按钮一并不可交互。 */
function ReadOnlyProperties({ children, reason = "只读 · 评审模式下不可编辑" }: { children: ReactNode; reason?: string }) {
  return (
    <fieldset disabled aria-label="属性（只读）" className="m-0 min-w-0 border-0 p-0">
      <p className="mx-3 mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3" aria-hidden="true" /> {reason}
      </p>
      <div className="opacity-60">{children}</div>
    </fieldset>
  )
}

function PropertiesPanel({
  state,
  lockAspect,
  onLockAspectChange,
}: {
  state: DemoState
  lockAspect: boolean
  onLockAspectChange: (v: boolean) => void
}) {
  const mixed = state === "multi"
  return (
    <Accordion type="multiple" defaultValue={state === "text" ? ["text"] : ["position", "fill"]} className="inspector-groups m-3 mt-2">
      <AccordionItem value="position">
        <AccordionTrigger className="text-xs font-semibold">位置与大小</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-1.5">
          {mixed ? (
            <>
              <PropertyRowPair a={{ label: "X", children: <MixedValueField /> }} b={{ label: "Y", children: <MixedValueField /> }} />
              <PropertyRowPair a={{ label: "宽", children: <NumberField value="766" suffix="pt" /> }} b={{ label: "高", children: <MixedValueField /> }} />
            </>
          ) : (
            <>
              <PropertyRowPair a={{ label: "X", children: <NumberField value="130" suffix="pt" /> }} b={{ label: "Y", children: <NumberField value="190" suffix="pt" /> }} />
              <PropertyRowPair a={{ label: "宽", children: <NumberField value="700" suffix="pt" /> }} b={{ label: "高", children: <NumberField value="56" suffix="pt" /> }} />
              <PropertyRow label="旋转">
                <NumberField value="0" suffix="°" />
                <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox checked={lockAspect} onCheckedChange={(v) => onLockAspectChange(!!v)} /> 锁定比例
                </label>
              </PropertyRow>
            </>
          )}
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="fill">
        <AccordionTrigger className="text-xs font-semibold">填充</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-2">
          <PropertyRow label="类型">
            <Select defaultValue="solid">
              <SelectTrigger size="sm" className="h-7 flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">无</SelectItem>
                <SelectItem value="solid">纯色</SelectItem>
                <SelectItem value="gradient">渐变</SelectItem>
              </SelectContent>
            </Select>
          </PropertyRow>
          <PropertyRow label="颜色">
            <ColorPickerPopover
              value="#4A54E1"
              onChange={(hex) => toast(`填充色已设为 ${hex}`)}
              trigger={<button type="button" className="size-5 rounded-[4px] border border-input" style={{ backgroundColor: "#4A54E1" }} aria-label="填充颜色 #4A54E1" />}
            />
            <span className="font-mono text-[11px] text-muted-foreground">#4A54E1</span>
          </PropertyRow>
          <PropertyRow label="不透明度">
            <Slider defaultValue={[80]} className="flex-1" aria-label="不透明度" />
            <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">80%</span>
          </PropertyRow>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="border">
        <AccordionTrigger className="text-xs font-semibold">边框</AccordionTrigger>
        <AccordionContent className="text-xs text-muted-foreground">无边框</AccordionContent>
      </AccordionItem>
      <AccordionItem value="shadow">
        <AccordionTrigger className="text-xs font-semibold">阴影/效果</AccordionTrigger>
        <AccordionContent className="text-xs text-muted-foreground">无效果</AccordionContent>
      </AccordionItem>
      <AccordionItem value="text">
        <AccordionTrigger className="text-xs font-semibold">文本</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-2">
          <PropertyRow label="字体">
            <Select defaultValue="msyh">
              <SelectTrigger size="sm" className="h-7 flex-1"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="msyh">微软雅黑</SelectItem></SelectContent>
            </Select>
          </PropertyRow>
          <PropertyRowPair a={{ label: "字号", children: <NumberField value="18" /> }} b={{ label: "行距", children: <NumberField value="1.0" /> }} />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="align">
        <AccordionTrigger className="text-xs font-semibold">对齐与分布</AccordionTrigger>
        <AccordionContent className="text-xs text-muted-foreground">参照：{mixed ? "所选对象" : "页面"}</AccordionContent>
      </AccordionItem>
      <AccordionItem value="plugin-a">
        <AccordionTrigger className="text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5"><Blocks className="size-3.5 text-muted-foreground" />数据绑定 <Badge variant="outline" className="text-2xs text-muted-foreground">插件 A</Badge></span>
        </AccordionTrigger>
        <AccordionContent className="text-xs text-muted-foreground">由插件"数据图表增强"提供的属性分区</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

/** readOnly：查看者变体只可阅读线程（无回复 / 标记已解决），rulings §4.18 UX-19 */
function ReviewCommentsPanel({ readOnly = false }: { readOnly?: boolean }) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="rounded-md border p-2.5">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium"><span className="size-1.5 rounded-full bg-warning" />第 3 页 · "标题文本"</div>
        <p className="text-xs text-muted-foreground">王小明 · 2 小时前</p>
        <p className="mt-1 text-xs">这里的数据需要核对，和财务口径对一下。</p>
        {!readOnly && (
          <div className="mt-2 flex gap-2">
            <Button size="xs" variant="outline">回复</Button>
            <Button size="xs" variant="ghost">标记已解决</Button>
          </div>
        )}
      </div>
      {readOnly && <p className="text-xs text-muted-foreground">你只有查看权限，可阅读评论，不能回复或发表评论。</p>}
    </div>
  )
}

function HistoryPreviewPanel() {
  return (
    <div className="flex flex-col gap-2 p-3 text-xs text-muted-foreground">
      <p>今天</p>
      <p className="text-foreground">14:32 · 我</p>
      <p className="text-foreground">11:05 · 王小明</p>
      <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => toast("查看完整历史：见“版本历史”路由")}>查看完整版本历史</Button>
    </div>
  )
}

function PluginsPreviewPanel() {
  return (
    <div className="flex flex-col gap-2 p-3 text-xs">
      <p className="text-muted-foreground">当前页贡献的插件面板</p>
      <div className="flex items-center gap-2 rounded-md border p-2">
        <Blocks className="size-4 text-muted-foreground" />
        <span className="flex-1">数据图表增强</span>
        <Badge variant="secondary" className="text-2xs">已启用</Badge>
      </div>
    </div>
  )
}
