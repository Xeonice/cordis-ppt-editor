import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Ban, Copy, FileWarning, Globe, ImageOff, Lock, PackageX, ShieldAlert, TriangleAlert, X,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AppBar, DegradedElementBox, DesignBar, EditorShell, SlideCanvas, StatusBar, ThumbnailRail } from "@/components/editor"
import { slides as allSlides } from "@/lib/mock-data"

type DemoState =
  | "progress" | "progress-large"
  | "err-unsupported" | "err-macro" | "err-encrypted" | "err-invalid"
  | "err-limit" | "err-quota" | "err-access" | "err-no-type"
  | "degraded-element" | "degraded-page" | "degraded-thumb"
  | "external-confirm" | "external-never"

const stateOptions = [
  { value: "progress", label: "进度：解析母版与版式" },
  { value: "progress-large", label: "进度：大文件提示" },
  { value: "err-unsupported", label: "失败：不支持的格式" },
  { value: "err-macro", label: "失败：包含宏（.pptm）" },
  { value: "err-encrypted", label: "失败：文件已加密" },
  { value: "err-invalid", label: "失败：无效的包" },
  { value: "err-limit", label: "失败：超出处理上限" },
  { value: "err-quota", label: "失败：超出规模上限（配额）" },
  { value: "err-access", label: "失败：无访问权限" },
  { value: "err-no-type", label: "失败：未加载文档类型（集成场景）" },
  { value: "degraded-element", label: "降级：元素级占位（OLE/EMF/图表）" },
  { value: "degraded-page", label: "降级：页级提示条" },
  { value: "degraded-thumb", label: "降级：缩略图警示角标" },
  { value: "external-confirm", label: "外链资源：confirm（需确认加载）" },
  { value: "external-never", label: "外链资源：never（管理员已禁止）" },
]

const errorMeta: Record<string, { icon: typeof Ban; title: string; description: string; actions: "retry" | "access" | "diagnostics" | "back-only" }> = {
  "err-unsupported": { icon: FileWarning, title: "不支持的文件格式", description: "请在 PowerPoint 中另存为 .pptx 后重试", actions: "back-only" },
  "err-macro": { icon: Ban, title: "不支持包含宏的演示文稿", description: "请另存为 .pptx 后再导入；不提供重试，也不提供“忽略宏后打开”", actions: "back-only" },
  "err-encrypted": { icon: Lock, title: "此文件已加密，当前版本无法打开", description: "请先在 PowerPoint 中去除密码后再导入", actions: "back-only" },
  "err-invalid": { icon: PackageX, title: "无法打开：文件不是有效的演示文稿", description: "", actions: "diagnostics" },
  "err-limit": { icon: TriangleAlert, title: "文件超出处理上限", description: "媒体总量超过 256 MB 上限", actions: "back-only" },
  "err-access": { icon: ShieldAlert, title: "你没有权限访问此文档", description: "", actions: "access" },
  "err-no-type": { icon: Ban, title: "未加载可打开此文件的文档类型插件", description: "面向集成方：请确认已注册对应的 FormatCodec", actions: "diagnostics" },
}

/** rulings §4.15 Q5：三项上限均为部署配置默认值，界面文案读取实际配置值，不写死。 */
const quotaLimits = { pages: 200, elementsPerSlide: 1000, elementsTotal: 20000 }
const quotaActual = { elementsTotal: 23480 }

export function Import() {
  const navigate = useNavigate()
  const [demoState, setDemoState] = useState<DemoState>("progress")
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [externalLoaded, setExternalLoaded] = useState(false)
  const [pageBannerDismissed, setPageBannerDismissed] = useState(false)

  if (demoState === "err-quota") {
    return (
      <div className="flex h-dvh flex-col bg-canvas">
        <DesignBar title="打开与导入" spec="03-screens/13" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} />
        <header className="glass-strong m-2 flex h-12 shrink-0 items-center gap-3 rounded-2xl px-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/documents")}>返回列表</Button>
        </header>
        <Empty className="flex-1">
          <EmptyMedia variant="icon"><Ban className="text-destructive" /></EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>文档超出规模上限，无法导入</EmptyTitle>
            <EmptyDescription className="max-w-md text-balance">
              "年度汇总.pptx" 共有 {quotaActual.elementsTotal.toLocaleString()} 个元素，超过每份文档 {quotaLimits.elementsTotal.toLocaleString()} 个元素的上限。
              可以在 PowerPoint 中把它拆成几份较小的文件后再分别导入。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Table className="w-auto">
              <TableHeader>
                <TableRow>
                  <TableHead>超出项</TableHead>
                  <TableHead className="text-right">实际值</TableHead>
                  <TableHead className="text-right">上限</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>文档总元素</TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">{quotaActual.elementsTotal.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{quotaLimits.elementsTotal.toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Button variant="outline" onClick={() => navigate("/documents")}>返回列表</Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

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
            {meta.description && <EmptyDescription className="max-w-sm text-balance">{meta.description}</EmptyDescription>}
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

  // degraded-* 与 external-* 共用同一"已打开，编辑器可交互"外壳
  const degradedSlides = allSlides.map((s, i) => (i === 1 ? { ...s, warningCount: 2 } : s))
  const isExternal = demoState === "external-confirm" || demoState === "external-never"

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar title="打开与导入" spec="03-screens/13" state={demoState} onStateChange={(v) => { setDemoState(v as DemoState); setPageBannerDismissed(false); setExternalLoaded(false) }} stateOptions={stateOptions} />
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
            {demoState === "external-confirm" && !pageBannerDismissed && (
              <Alert className="m-2 shrink-0 border-info/40 bg-info-muted text-info-foreground">
                <Globe />
                <AlertTitle>本页包含来自外部网站的内容</AlertTitle>
                <AlertAction>
                  <Button size="xs" variant="outline" className="border-info-foreground/40 text-info-foreground" onClick={() => { setExternalLoaded(true); toast("已加载本页全部外部内容") }}>全部加载</Button>
                  <Button variant="ghost" size="icon-xs" className="text-info-foreground" aria-label="关闭提示" onClick={() => setPageBannerDismissed(true)}><X /></Button>
                </AlertAction>
              </Alert>
            )}
            <SlideCanvas hideZoomBar>
              <div className="absolute inset-6 flex items-center text-2xl font-semibold text-doc-ink">业绩概览</div>
              {demoState === "degraded-element" && (
                <>
                  <DegradedElementBox box={{ x: 100, y: 170, w: 260, h: 150 }} reason="嵌入对象（Excel 工作表）无法预览" />
                  <DegradedElementBox box={{ x: 380, y: 170, w: 220, h: 150 }} reason="此图片格式（EMF）暂无法预览" />
                  <DegradedElementBox box={{ x: 620, y: 170, w: 220, h: 150 }} reason="此类图表（瀑布图等 Office 2016 新图表）暂不支持显示，已原样保留" />
                </>
              )}
              {demoState === "degraded-page" && (
                <>
                  <DegradedElementBox box={{ x: 120, y: 180, w: 320, h: 180 }} reason="图表渲染器未加载" />
                  <DegradedElementBox box={{ x: 480, y: 180, w: 340, h: 100 }} reason="嵌入对象格式不受支持" />
                </>
              )}
              {isExternal && (
                <ExternalImagePlaceholder
                  box={{ x: 140, y: 190, w: 360, h: 220 }}
                  domain="images.example.com"
                  mode={demoState === "external-confirm" ? "confirm" : "never"}
                  loaded={externalLoaded}
                  onLoad={() => { setExternalLoaded(true); toast("已加载外部图片") }}
                />
              )}
            </SlideCanvas>
          </>
        }
        statusBar={<StatusBar left={["第 2/12 页", "其余页面加载中 6/12"]} right={[<Badge key="b" variant="outline" className="text-2xs">保真报告：2 处已保留</Badge>]} />}
      />
    </div>
  )
}

/** rulings §4.15 Q7：外链图片 confirm/never 两态的元素级占位；auto 态无需占位（直接加载），故本组件只承载这两态。 */
function ExternalImagePlaceholder({
  box,
  domain,
  mode,
  loaded,
  onLoad,
}: {
  box: { x: number; y: number; w: number; h: number }
  domain: string
  mode: "confirm" | "never"
  loaded: boolean
  onLoad: () => void
}) {
  if (mode === "confirm" && loaded) {
    return (
      <div
        className="absolute flex items-center justify-center rounded-md bg-doc-ink/[0.06] text-xs text-doc-ink/50"
        style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      >
        （已加载的外部图片）
      </div>
    )
  }
  return (
    <div
      className="absolute flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 p-3 text-center"
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
    >
      <ImageOff className="size-5 text-muted-foreground" aria-hidden="true" />
      {mode === "confirm" ? (
        <>
          <span className="text-xs text-muted-foreground">此图片来自外部网站 {domain}</span>
          <Button size="xs" variant="outline" onClick={onLoad}>加载</Button>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">外部内容已被管理员禁止加载（{domain}）</span>
      )}
    </div>
  )
}
