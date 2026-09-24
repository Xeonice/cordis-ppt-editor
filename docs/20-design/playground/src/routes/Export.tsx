import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { CircleCheck, Info, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AppBar, DesignBar, EditorShell, Inspector, SlideCanvas, SlideContent, StatusBar, StatusText, ThumbnailRail } from "@/components/editor"
import { EditorRibbon } from "@/components/editor/Ribbon"
import type { RibbonTabValue } from "@/components/editor/Ribbon"
import { collaborators, documentTitle, slides } from "@/lib/mock-data"

type DemoState = "default" | "progress" | "done" | "error" | "unsynced"

const stateOptions = [
  { value: "default", label: "默认" },
  { value: "progress", label: "生成中" },
  { value: "done", label: "完成" },
  { value: "error", label: "失败" },
  { value: "unsynced", label: "存在未同步更改" },
]

export function Export() {
  const navigate = useNavigate()
  const [demoState, setDemoState] = useState<DemoState>("default")
  const [ribbonTab, setRibbonTab] = useState<RibbonTabValue>("home")
  const [format, setFormat] = useState("pptx")
  const [scope, setScope] = useState("all")
  const [customPages, setCustomPages] = useState("1,3,5-8")
  const [pageError, setPageError] = useState(false)
  const currentSlide = slides[0]!

  function handleExport() {
    if (scope === "custom" && !/^[\d,\-\s]+$/.test(customPages)) { setPageError(true); return }
    setPageError(false)
    setDemoState("progress")
    window.setTimeout(() => setDemoState("done"), 1200)
  }

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar title="导出" spec="03-screens/22" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} />
      <EditorShell
        appBar={<AppBar onBack={() => navigate("/editor")} backLabel="返回编辑器" title={documentTitle} collaborators={collaborators.filter((c) => !c.isSelf)} status={{ kind: "sync", state: "synced" }} />}
        ribbon={<EditorRibbon value={ribbonTab} onValueChange={setRibbonTab} currentMasterId={currentSlide.masterId} currentLayoutId={currentSlide.layoutId} />}
        thumbnailRail={<ThumbnailRail mode="normal" slides={slides} currentSlideId={currentSlide.id} />}
        canvas={<SlideCanvas hideZoomBar><SlideContent slide={currentSlide} fill /></SlideCanvas>}
        inspector={<Inspector value="properties" onValueChange={() => {}} tabs={[{ value: "properties", label: "属性", content: null }]} />}
        statusBar={<StatusBar left={[`第 ${currentSlide.index}/${slides.length} 页`]} right={[<StatusText key="s" status={{ kind: "sync", state: "synced" }} variant="dot" />]} />}
      />

      <Dialog open onOpenChange={() => navigate("/editor")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>导出"{documentTitle}"</DialogTitle></DialogHeader>

          {demoState === "progress" ? (
            <div className="flex flex-col gap-3 py-2">
              <p className="text-sm">正在导出…</p>
              <Progress value={58} aria-label="导出进度" />
              <p className="text-xs text-muted-foreground">正在重新打包未修改的部件… 58%</p>
              <Button variant="outline" size="sm" className="self-end" onClick={() => setDemoState("default")}>取消</Button>
            </div>
          ) : demoState === "done" ? (
            <div className="flex flex-col gap-2 py-2">
              <p className="flex items-center gap-1.5 text-sm font-medium text-success-foreground"><CircleCheck className="size-4" /> 导出完成</p>
              <p className="text-sm">{documentTitle.replace(".pptx", format === "pptx" ? ".pptx" : `.${format}`)}（2.4 MB）</p>
              <p className="text-xs text-muted-foreground">服务端作业：下载链接 1 小时内有效</p>
              <DialogFooter className="pt-2"><Button onClick={() => navigate("/editor")}>完成</Button></DialogFooter>
            </div>
          ) : demoState === "error" ? (
            <div className="flex flex-col gap-2 py-2">
              <p className="flex items-center gap-1.5 text-sm font-medium text-destructive"><TriangleAlert className="size-4" /> 导出失败</p>
              <p className="text-sm text-muted-foreground">服务端处理超时，请重试</p>
              <DialogFooter className="pt-2"><Button variant="outline" onClick={() => navigate("/editor")}>取消</Button><Button onClick={() => setDemoState("progress")}>重试</Button></DialogFooter>
            </div>
          ) : demoState === "unsynced" ? (
            <div className="flex flex-col gap-2 py-2">
              <p className="flex items-center gap-1.5 text-sm font-medium text-warning-foreground"><TriangleAlert className="size-4" /> 存在 3 项未同步的更改</p>
              <p className="text-sm text-muted-foreground">导出将包含本地最新内容，但可能与其他协作者看到的版本存在差异</p>
              <DialogFooter className="pt-2"><Button variant="outline" onClick={() => toast("等待同步完成后重试")}>等待同步</Button><Button onClick={() => setDemoState("progress")}>仍要导出</Button></DialogFooter>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-2 text-sm font-medium">格式</p>
                  <RadioGroup value={format} onValueChange={setFormat} className="flex flex-col gap-1">
                    {[
                      { v: "pptx", l: "PowerPoint .pptx" },
                      { v: "png", l: "PNG 图片" },
                      { v: "svg", l: "SVG 矢量图" },
                      { v: "pdf", l: "PDF · 服务端生成", milestone: "M3 后半段" },
                    ].map((f) => (
                      <label
                        key={f.v}
                        htmlFor={`fmt-${f.v}`}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 -mx-2 ${format === f.v ? "bg-accent/40" : ""}`}
                      >
                        <RadioGroupItem value={f.v} id={`fmt-${f.v}`} />
                        <span className="text-sm">{f.l}</span>
                        {"milestone" in f && f.milestone && <Badge variant="outline" className="text-2xs text-muted-foreground">{f.milestone}</Badge>}
                      </label>
                    ))}
                  </RadioGroup>
                  {(format === "png" || format === "svg") && (
                    <Field className="mt-2 max-w-40">
                      <FieldLabel htmlFor="img-width" className="text-xs">图片宽度</FieldLabel>
                      <Select defaultValue="1280">
                        <SelectTrigger id="img-width" size="sm" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>{["960", "1280", "1920"].map((w) => <SelectItem key={w} value={w}>{w}px</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">范围</p>
                  <RadioGroup value={scope} onValueChange={setScope} className="flex flex-col gap-1">
                    {[
                      { v: "all", l: `全部页 ${slides.length}` },
                      { v: "current", l: "当前页" },
                      { v: "selected", l: "选定页" },
                      { v: "custom", l: "自定义页码" },
                    ].map((s) => (
                      <label
                        key={s.v}
                        htmlFor={`scope-${s.v}`}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 -mx-2 ${scope === s.v ? "bg-accent/40" : ""}`}
                      >
                        <RadioGroupItem value={s.v} id={`scope-${s.v}`} />
                        <span className="text-sm">{s.l}</span>
                      </label>
                    ))}
                  </RadioGroup>
                  {scope === "custom" && (
                    <Field className="mt-2">
                      <FieldLabel htmlFor="custom-pages" className="sr-only">自定义页码</FieldLabel>
                      <Input id="custom-pages" placeholder="例如 1,3,5-8" value={customPages} onChange={(e) => { setCustomPages(e.target.value); setPageError(false) }} aria-invalid={pageError} />
                      {pageError && <FieldError>页码格式不正确，请使用如 1,3,5-8 的格式</FieldError>}
                    </Field>
                  )}
                </div>
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  未修改的内容将原样保留 <Button variant="link" size="xs" className="h-auto p-0" onClick={() => navigate("/import")}>查看导入详情</Button>
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => navigate("/editor")}>取消</Button>
                <Button onClick={handleExport}>导出</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
