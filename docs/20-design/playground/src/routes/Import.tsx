import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Ban, Copy, FileWarning, Lock, PackageX, ShieldAlert, TriangleAlert, X,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { AppBar, DegradedElementBox, DesignBar, EditorShell, SlideCanvas, StatusBar, ThumbnailRail } from "@/components/editor"
import { slides as allSlides } from "@/lib/mock-data"

type DemoState =
  | "progress" | "progress-large" | "err-unsupported" | "err-encrypted" | "err-invalid"
  | "err-limit" | "err-access" | "err-no-type" | "degraded-element" | "degraded-page" | "degraded-thumb"

const stateOptions = [
  { value: "progress", label: "进度：解析母版与版式" },
  { value: "progress-large", label: "进度：大文件提示" },
  { value: "err-unsupported", label: "失败：不支持的格式" },
  { value: "err-encrypted", label: "失败：文件已加密" },
  { value: "err-invalid", label: "失败：无效的包" },
  { value: "err-limit", label: "失败：超出处理上限" },
  { value: "err-access", label: "失败：无访问权限" },
  { value: "err-no-type", label: "失败：未加载文档类型（集成场景）" },
  { value: "degraded-element", label: "降级：元素级占位" },
  { value: "degraded-page", label: "降级：页级提示条" },
  { value: "degraded-thumb", label: "降级：缩略图警示角标" },
]

const errorMeta: Record<string, { icon: typeof Ban; title: string; description: string; actions: "retry" | "access" | "diagnostics" | "back-only" }> = {
  "err-unsupported": { icon: FileWarning, title: "不支持的文件格式", description: "请在 PowerPoint 中另存为 .pptx 后重试", actions: "back-only" },
  "err-encrypted": { icon: Lock, title: "此文件已加密，当前版本无法打开", description: "", actions: "back-only" },
  "err-invalid": { icon: PackageX, title: "无法打开：文件不是有效的演示文稿", description: "", actions: "diagnostics" },
  "err-limit": { icon: TriangleAlert, title: "文件超出处理上限", description: "媒体总量超过 256 MB 上限", actions: "back-only" },
  "err-access": { icon: ShieldAlert, title: "你没有权限访问此文档", description: "", actions: "access" },
  "err-no-type": { icon: Ban, title: "未加载可打开此文件的文档类型插件", description: "面向集成方：请确认已注册对应的 FormatCodec", actions: "diagnostics" },
}

export function Import() {
  const navigate = useNavigate()
  const [demoState, setDemoState] = useState<DemoState>("progress")
  const [detailsOpen, setDetailsOpen] = useState(false)

  if (demoState.startsWith("err-")) {
    const meta = errorMeta[demoState]!
    return (
      <div className="flex h-dvh flex-col bg-canvas">
        <DesignBar title="打开与导入" spec="03-screens/13" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} />
        <header className="glass-strong m-2 flex h-12 shrink-0 items-center gap-3 rounded-2xl px-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/documents")}>返回列表</Button>
        </header>
        <Empty className="flex-1">
          <EmptyMedia variant="icon"><meta.icon className="text-destructive" /></EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>{meta.title}</EmptyTitle>
            {meta.description && <EmptyDescription>{meta.description}</EmptyDescription>}
          </EmptyHeader>
          <EmptyContent>
            {meta.actions === "diagnostics" && (
              <div className="flex flex-col items-center gap-2">
                <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
                  <CollapsibleTrigger asChild><Button variant="link" size="sm">技术详情</Button></CollapsibleTrigger>
                  <CollapsibleContent className="max-w-md rounded-md border bg-muted/40 p-2 text-left font-mono text-xs text-muted-foreground">
                    首个失败部件：ppt/slides/slide7.xml · InvalidRelationshipError
                  </CollapsibleContent>
                </Collapsible>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { navigator.clipboard?.writeText("diagnostic-id: 8f2a-91c"); toast("已复制诊断信息") }}><Copy /> 复制诊断信息</Button>
                  <Button variant="outline" onClick={() => navigate("/documents")}>返回列表</Button>
                </div>
              </div>
            )}
            {meta.actions === "access" && (
              <div className="flex gap-2">
                <Button onClick={() => toast("已发送访问申请")}>申请访问</Button>
                <Button variant="outline" onClick={() => navigate("/documents")}>返回列表</Button>
              </div>
            )}
            {meta.actions === "back-only" && <Button variant="outline" onClick={() => navigate("/documents")}>返回列表</Button>}
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  if (demoState === "progress" || demoState === "progress-large") {
    const progress = demoState === "progress" ? 55 : 22
    return (
      <div className="flex h-dvh flex-col bg-canvas">
        <DesignBar title="打开与导入" spec="03-screens/13" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} />
        <header className="glass-strong m-2 flex h-12 shrink-0 items-center gap-3 rounded-2xl px-4">
          <Button variant="ghost" size="sm" onClick={() => toast("已取消打开")}>取消</Button>
          <span className="text-sm text-muted-foreground">正在打开 2026年Q2业绩汇报.pptx …</span>
        </header>
        <div className="mx-2 flex h-24 shrink-0 items-center gap-2 border-b border-foreground/5 px-3 opacity-50">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-16" />)}
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="hidden w-40 shrink-0 flex-col gap-2 border-r border-foreground/5 p-3 md:flex">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-video w-full animate-pulse rounded-md" />)}
          </div>
          <div className="flex flex-1 items-center justify-center bg-canvas">
            <Skeleton className="aspect-video w-2/3 animate-pulse rounded" />
          </div>
        </div>
        <div className="glass-strong m-2 flex flex-col gap-1.5 rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>正在解析母版与版式…{demoState === "progress-large" && " 文件较大，首屏渲染完成后其余页面将继续加载"}</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} aria-label="导入进度" />
        </div>
      </div>
    )
  }

  // degraded-* states share the same "已打开，编辑器可交互" shell
  const degradedSlides = allSlides.map((s, i) => (i === 1 ? { ...s, warningCount: 2 } : s))
  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar title="打开与导入" spec="03-screens/13" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} />
      <EditorShell
        appBar={<AppBar onBack={() => navigate("/documents")} backLabel="返回文档列表" title="2026年Q2业绩汇报.pptx" status={{ kind: "save", state: "saved" }} />}
        thumbnailRail={<ThumbnailRail mode="normal" slides={demoState === "degraded-thumb" ? degradedSlides : allSlides} currentSlideId={allSlides[1]!.id} />}
        canvas={
          <>
            {demoState === "degraded-page" && (
              <Alert className="m-2 shrink-0 border-warning/40 bg-warning-muted text-warning-foreground">
                <TriangleAlert />
                <AlertTitle>本页有 2 处内容无法完整显示</AlertTitle>
                <AlertDescription className="text-warning-foreground/80">
                  <Button variant="link" size="xs" className="h-auto p-0 text-warning-foreground underline">查看详情</Button>
                </AlertDescription>
                <AlertAction>
                  <Button variant="ghost" size="icon-xs" className="text-warning-foreground" aria-label="关闭提示" onClick={() => toast("已关闭提示")}><X /></Button>
                </AlertAction>
              </Alert>
            )}
            <SlideCanvas hideZoomBar>
              <div className="absolute inset-6 flex items-center text-2xl font-semibold text-doc-ink">业绩概览</div>
              {(demoState === "degraded-element" || demoState === "degraded-page") && (
                <>
                  <DegradedElementBox box={{ x: 120, y: 180, w: 320, h: 180 }} reason="图表渲染器未加载" />
                  <DegradedElementBox box={{ x: 480, y: 180, w: 340, h: 100 }} reason="嵌入对象格式不受支持" />
                </>
              )}
            </SlideCanvas>
          </>
        }
        statusBar={<StatusBar left={["第 2/12 页", "其余页面加载中 6/12"]} right={[<Badge key="b" variant="outline" className="text-2xs">保真报告：2 处已保留</Badge>]} />}
      />
    </div>
  )
}
