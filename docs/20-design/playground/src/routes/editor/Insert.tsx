import { useState } from "react"
import { Loader2 } from "lucide-react"
import {
  AppBar, CanvasElementBox, DesignBar, EditorShell, Inspector, SelectionBox, SlideCanvas, StatusBar, StatusText,
  ThumbnailRail,
} from "@/components/editor"
import { EditorRibbon } from "@/components/editor/Ribbon"
import type { RibbonTabValue } from "@/components/editor/Ribbon"
import { collaborators, documentTitle, slides } from "@/lib/mock-data"
import { ReadonlyRibbonNotice } from "@/components/editor/Ribbon"

type DemoState = "default" | "uploading" | "handles" | "readonly"

const stateOptions = [
  { value: "default", label: "默认 · 形状/表格/图表入口" },
  { value: "uploading", label: "图片上传中" },
  { value: "handles", label: "变换手柄（缩放/旋转）" },
  { value: "readonly", label: "只读（插入页签不出现）" },
]

export function EditorInsert() {
  const [demoState, setDemoState] = useState<DemoState>("default")
  const [role, setRole] = useState("owner")
  const [ribbonTab, setRibbonTab] = useState<RibbonTabValue>("insert")
  const currentSlide = slides[3]!
  const readOnly = demoState === "readonly" || role === "commenter" || role === "viewer"

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar title="插入" spec="03-screens/15" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} role={role} onRoleChange={setRole} />
      <EditorShell
        appBar={<AppBar title={documentTitle} collaborators={collaborators.filter((c) => !c.isSelf)} status={{ kind: "sync", state: "synced" }} />}
        ribbon={
          readOnly ? (
            <ReadonlyRibbonNotice>评审模式下"插入"页签不出现</ReadonlyRibbonNotice>
          ) : (
            <EditorRibbon
              value={ribbonTab}
              onValueChange={setRibbonTab}
              currentMasterId={currentSlide.masterId}
              currentLayoutId={currentSlide.layoutId}
            />
          )
        }
        thumbnailRail={<ThumbnailRail mode="normal" slides={slides} currentSlideId={currentSlide.id} />}
        canvas={
          <SlideCanvas>
            <CanvasElementBox box={{ x: 90, y: 60, w: 780, h: 56 }} className="flex items-center text-xl font-semibold text-doc-ink">产品线表现</CanvasElementBox>

            <CanvasElementBox box={{ x: 90, y: 150, w: 220, h: 140 }} className="flex flex-col items-center justify-center gap-1 rounded-md border-2 border-primary/70 bg-primary/10 text-primary">
              <span className="text-xs">矩形形状</span>
            </CanvasElementBox>
            {demoState === "handles" && <SelectionBox box={{ x: 90, y: 150, w: 220, h: 140 }} label="宽 220 高 140" sizeLabel="旋转 0°" />}

            <CanvasElementBox box={{ x: 340, y: 150, w: 200, h: 140 }} className="flex items-center justify-center rounded-md border border-dashed border-doc-ink/25 bg-doc-ink/[0.05] text-xs text-doc-ink/60">
              {demoState === "uploading" ? (
                <span className="flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" /> 正在上传图片…</span>
              ) : "图片占位"}
            </CanvasElementBox>

            <CanvasElementBox box={{ x: 570, y: 150, w: 300, h: 140 }} className="grid grid-cols-3 grid-rows-3 gap-px overflow-hidden rounded-md border bg-border text-2xs text-doc-ink/60">
              {Array.from({ length: 9 }).map((_, i) => <div key={i} className="flex items-center justify-center bg-doc-paper">单元格</div>)}
            </CanvasElementBox>

            <CanvasElementBox box={{ x: 90, y: 330, w: 300, h: 130 }} className="flex items-end gap-2 rounded-md border p-3">
              {[40, 70, 55, 90, 60].map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-chart-1" style={{ height: `${h}%` }} />
              ))}
            </CanvasElementBox>

            <CanvasElementBox box={{ x: 420, y: 330, w: 300, h: 60 }} className="flex items-center border border-dashed border-muted-foreground/40 px-2 text-sm text-doc-ink/50">
              单击此处插入文本框
            </CanvasElementBox>
          </SlideCanvas>
        }
        inspector={
          <Inspector
            value="properties"
            onValueChange={() => {}}
            readOnly={readOnly}
            tabs={[{ value: "properties", label: "属性", content: <div className="cordex-well m-3 p-3"><div className="cordex-group p-3 text-xs text-muted-foreground">选中画布中新插入的对象以查看其属性（位置/大小/填充等），见"编辑器主界面"路由的完整示例。</div></div> }]}
          />
        }
        statusBar={
          <StatusBar left={[`第 ${currentSlide.index}/${slides.length} 页`]} right={[<StatusText key="s" status={{ kind: "sync", state: "synced" }} variant="dot" />]} />
        }
      />
    </div>
  )
}
