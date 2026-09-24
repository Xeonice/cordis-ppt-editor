import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  CircleCheck, Clapperboard, FileBox, Globe, ImageOff, Lock, RefreshCcw, Shapes, TriangleAlert, Type,
  Waves,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AppBar, DesignBar, EditorShell, Inspector, SlideCanvas, SlideContent, StatusBar, StatusText, ThumbnailRail } from "@/components/editor"
import { EditorRibbon } from "@/components/editor/Ribbon"
import type { RibbonTabValue } from "@/components/editor/Ribbon"
import { collaborators, documentTitle, slides } from "@/lib/mock-data"

type DemoState = "default" | "partial-fail" | "full"

const stateOptions = [
  { value: "default", label: "部分保留（默认）" },
  { value: "partial-fail", label: "部分解析失败但可继续打开" },
  { value: "full", label: "完全高保真" },
]

interface ReportItem {
  icon: typeof Clapperboard
  label: string
  count: string
  pages: string
  note: string
}

/** rulings §4.15 Q7；03-10 条目全集：动画/切换/SmartArt/OLE/EMF/chartex/外链/缺失字体/受限字体 */
const items: ReportItem[] = [
  { icon: Clapperboard, label: "动画效果", count: "3 处", pages: "第 2、5、9 页", note: "已原样保留；放映时显示动画结束后的画面，暂不可修改" },
  { icon: RefreshCcw, label: "切换效果", count: "2 处", pages: "第 4、8 页", note: "已原样保留，暂不播放" },
  { icon: Shapes, label: "SmartArt", count: "1 处", pages: "第 6 页", note: "已保留为静态图形，暂不支持编辑其结构" },
  { icon: FileBox, label: "嵌入对象（OLE）", count: "1 处", pages: "第 6 页", note: "显示为预览图，暂不支持在此编辑" },
  { icon: ImageOff, label: "EMF / WMF 图片", count: "2 处", pages: "第 3、7 页", note: "已转为图片显示，导出时保留原文件" },
  { icon: Waves, label: "新式图表（瀑布图等）", count: "1 处", pages: "第 7 页", note: "暂不支持显示，已原样保留，导出后可在 PowerPoint 查看" },
  { icon: Globe, label: "外部链接内容", count: "2 处", pages: "第 3、5 页", note: "内容来自外部网站（images.example.com），已自动加载" },
  { icon: Type, label: "缺失字体替代", count: "1 种", pages: "\"Brand Sans\" → 系统字体", note: "显示效果可能与原文件存在细微差异" },
  { icon: Lock, label: "仅授权查看的字体", count: "1 种", pages: "\"Corp Serif\"", note: "查看和放映时使用原字体；编辑时以替代字体显示" },
]

/**
 * 03-10 导入保真报告：应用栏「⋯」更多菜单「保真报告」项的落点。
 * 报告对文档所有协作者一致展示（客观文件事实），"本次不再提醒"仅本地静音入口高亮。
 */
export function EditorFidelity() {
  const navigate = useNavigate()
  const [demoState, setDemoState] = useState<DemoState>("default")
  const [ribbonTab, setRibbonTab] = useState<RibbonTabValue>("home")
  const currentSlide = slides[0]!

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar title="导入保真报告" spec="03-screens/10" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} />
      <EditorShell
        appBar={<AppBar onBack={() => navigate("/editor")} backLabel="返回编辑器" title={documentTitle} collaborators={collaborators.filter((c) => !c.isSelf)} status={{ kind: "sync", state: "synced" }} />}
        ribbon={<EditorRibbon value={ribbonTab} onValueChange={setRibbonTab} currentMasterId={currentSlide.masterId} currentLayoutId={currentSlide.layoutId} />}
        thumbnailRail={<ThumbnailRail mode="normal" slides={slides} currentSlideId={currentSlide.id} />}
        canvas={<SlideCanvas hideZoomBar><SlideContent slide={currentSlide} fill /></SlideCanvas>}
        inspector={<Inspector value="properties" onValueChange={() => {}} tabs={[{ value: "properties", label: "属性", content: null }]} />}
        statusBar={<StatusBar left={[`第 ${currentSlide.index}/${slides.length} 页`]} right={[<StatusText key="s" status={{ kind: "sync", state: "synced" }} variant="dot" />]} />}
      />

      <Dialog open onOpenChange={() => navigate("/editor")}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>导入详情：{documentTitle}</DialogTitle></DialogHeader>

          {demoState === "full" ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <CircleCheck className="size-8 text-success" aria-hidden="true" />
              <p className="text-sm font-medium">完全保真</p>
              <p className="text-sm text-muted-foreground">未发现需要注意的差异，所有内容均可正常编辑</p>
              <DialogFooter className="mt-2"><Button onClick={() => navigate("/editor")}>知道了</Button></DialogFooter>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">大部分内容已高保真还原。以下内容已按原样保留，当前版本暂不支持编辑：</p>
              <div className="flex max-h-96 flex-col divide-y divide-foreground/5 overflow-y-auto">
                {demoState === "partial-fail" && (
                  <ReportRow
                    icon={TriangleAlert}
                    label="第 7 页部分内容无法正确解析"
                    pages="第 7 页"
                    note="该页可能显示异常，其余页面不受影响"
                    danger
                    onLocate={() => toast("已定位到第 7 页")}
                  />
                )}
                {items.map((it) => (
                  <ReportRow
                    key={it.label}
                    icon={it.icon}
                    label={it.label}
                    count={it.count}
                    pages={it.pages}
                    note={it.note}
                    onLocate={() => toast(`已定位到${it.pages}`)}
                  />
                ))}
              </div>
              <DialogFooter className="pt-2">
                <Button variant="ghost" onClick={() => { toast("本次会话已静音保真报告入口高亮"); navigate("/editor") }}>本次不再提醒</Button>
                <Button onClick={() => navigate("/editor")}>知道了</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReportRow({
  icon: Icon,
  label,
  count,
  pages,
  note,
  danger,
  onLocate,
}: {
  icon: typeof Clapperboard
  label: string
  count?: string
  pages: string
  note: string
  danger?: boolean
  onLocate: () => void
}) {
  return (
    <div className="flex flex-col gap-1 py-2.5 first:pt-0">
      <div className="flex items-center gap-2">
        <Icon className={danger ? "size-4 shrink-0 text-destructive" : "size-4 shrink-0 text-muted-foreground"} aria-hidden="true" />
        <span className={danger ? "text-sm font-medium text-destructive" : "text-sm font-medium"}>{label}</span>
        {count && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
        {!danger && <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground">{pages}</span>}
        {danger && <span className="ml-auto" />}
        <Button variant="link" size="xs" className="h-auto shrink-0 p-0" onClick={onLocate}>定位</Button>
      </div>
      <p className={danger ? "pl-6 text-xs text-destructive/80" : "pl-6 text-xs text-muted-foreground"}>{note}</p>
    </div>
  )
}
