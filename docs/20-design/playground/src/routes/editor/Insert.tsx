import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  AppBar, CanvasElementBox, DesignBar, EditorShell, Inspector, SelectionBox, SlideCanvas, StatusBar, StatusText,
  ThumbnailRail,
} from "@/components/editor"
import { EditorRibbon, ReadonlyRibbonNotice, RibbonTrailing } from "@/components/editor/Ribbon"
import type { InsertPanel, RibbonTabValue } from "@/components/editor/Ribbon"
import { InsertDragPreview, InsertToolHint } from "@/components/editor/ribbon/insert/InsertToolOverlay"
import { findShape, ShapeThumb, type ShapePreset } from "@/components/editor/ribbon/insert/shapes"
import { collaborators, documentTitle, slides } from "@/lib/mock-data"

/**
 * 03-screens/04、15 插入页签与形状库（rulings §4.21 样张；设计文档已回写：03-04、03-15，2026-09-30）。
 * 演示状态：插入页签七组 · 形状库 72 项 · 插入工具态 · 动作按钮操作设置 · 页眉和页脚 · 图标 · 符号 · P2 禁用原因，
 * 以及原有的上传中 / 变换手柄 / 只读。弹层由演示状态受控打开；在弹层里的操作只覆盖本次演示，切换演示状态即复位。
 */
type DemoState =
  | "default" | "shapes" | "insert-tool" | "action-settings" | "header-footer" | "icons" | "symbols" | "media-p2"
  | "uploading" | "handles" | "readonly"

const stateOptions = [
  { value: "default", label: "默认 · 插入页签" },
  { value: "shapes", label: "形状库 · 72 项" },
  { value: "insert-tool", label: "插入工具态 · 拖出" },
  { value: "action-settings", label: "动作按钮 · 操作设置" },
  { value: "header-footer", label: "页眉和页脚对话框" },
  { value: "icons", label: "图标面板" },
  { value: "symbols", label: "符号面板 · 编辑文本" },
  { value: "media-p2", label: "禁用原因 · 视频 P2" },
  { value: "uploading", label: "图片上传中" },
  { value: "handles", label: "变换手柄（缩放/旋转）" },
  { value: "readonly", label: "只读（插入页签不出现）" },
]

const statePanel: Partial<Record<DemoState, InsertPanel>> = {
  shapes: "shapes", "action-settings": "action-settings", "header-footer": "header-footer", icons: "icons", symbols: "symbols",
}

/** 插入工具态演示的拖出框（逻辑坐标 960 × 540，1 in = 96） */
const DRAG_BOX = { x: 620, y: 402, w: 256, h: 104 }

export function EditorInsert() {
  const [demoState, setDemoStateRaw] = useState<DemoState>("default")
  const [panelOverride, setPanelOverride] = useState<InsertPanel | null | undefined>(undefined)
  const [toolId, setToolId] = useState("roundRect")
  const [actionId, setActionId] = useState("actionButtonForwardNext")
  const [role, setRole] = useState("owner")
  const [ribbonTab, setRibbonTab] = useState<RibbonTabValue>("insert")
  const currentSlide = slides[3]!
  const readOnly = demoState === "readonly" || role === "commenter" || role === "viewer"
  const tool = findShape(toolId)!
  const actionShape = findShape(actionId)!
  const panel = panelOverride !== undefined ? panelOverride : statePanel[demoState] ?? null

  function setDemoState(v: DemoState) {
    setDemoStateRaw(v)
    setPanelOverride(undefined)
    if (v !== "readonly") setRibbonTab("insert")
  }

  function pickShape(shape: ShapePreset) {
    setToolId(shape.id)
    setDemoState("insert-tool")
  }

  /** 插入工具态下单击画布 = 完成插入：动作按钮弹「操作设置」，其余选中新形状 */
  function completeInsert() {
    if (tool.group === "actions") {
      setActionId(tool.id)
      setDemoState("action-settings")
    } else {
      setDemoState("handles")
      toast(`已插入 · ${tool.name}`, { action: { label: "撤销", onClick: () => toast.success("已撤销") } })
    }
  }

  useEffect(() => {
    if (demoState !== "insert-tool") return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDemoState("default") }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [demoState])

  const insertTool = demoState === "insert-tool"
  const ACTION_BOX = { x: 804, y: 448, w: 80, h: 60 }

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar title="插入" spec="03-screens/04、15" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} role={role} onRoleChange={setRole} />
      <EditorShell
        appBar={<AppBar title={documentTitle} collaborators={collaborators.filter((c) => !c.isSelf)} status={{ kind: "sync", state: "synced" }} />}
        ribbon={
          readOnly ? (
            <ReadonlyRibbonNotice trailing={<RibbonTrailing />}>评审模式下"插入"页签不出现</ReadonlyRibbonNotice>
          ) : (
            <EditorRibbon
              value={ribbonTab}
              onValueChange={setRibbonTab}
              currentMasterId={currentSlide.masterId}
              currentLayoutId={currentSlide.layoutId}
              insert={{
                panel,
                onPanelChange: setPanelOverride,
                textEditing: demoState === "symbols",
                activeTool: insertTool ? toolId : null,
                onPickShape: pickShape,
                actionShapeId: actionId,
                showMediaReason: demoState === "media-p2",
              }}
            />
          )
        }
        thumbnailRail={<ThumbnailRail mode="normal" slides={slides} currentSlideId={currentSlide.id} />}
        canvas={
          <div className="relative flex min-h-0 flex-1 flex-col">
            {insertTool && <InsertToolHint shape={tool} />}
            <SlideCanvas paperClassName={insertTool ? "cursor-crosshair" : undefined}>
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

              {demoState === "symbols" ? (
                <CanvasElementBox box={{ x: 420, y: 330, w: 300, h: 60 }} className="flex items-center border border-primary/60 px-2 text-base text-doc-ink">
                  交付周期<span className="mx-px inline-block h-5 w-px animate-pulse bg-primary" aria-hidden="true" />缩短至 2 周
                </CanvasElementBox>
              ) : (
                <CanvasElementBox box={{ x: 420, y: 330, w: 300, h: 60 }} className="flex items-center border border-dashed border-muted-foreground/40 px-2 text-sm text-doc-ink/50">
                  单击此处插入文本框
                </CanvasElementBox>
              )}

              {demoState === "action-settings" && (
                <>
                  <CanvasElementBox box={ACTION_BOX} className="flex items-center justify-center rounded-md border-2 border-primary bg-primary/15 text-primary">
                    <ShapeThumb shape={actionShape} className="size-9" />
                  </CanvasElementBox>
                  <SelectionBox box={ACTION_BOX} showRotate={false} />
                </>
              )}

              {insertTool && (
                <>
                  <InsertDragPreview box={DRAG_BOX} shape={tool} sizeLabel={`宽 ${DRAG_BOX.w} 高 ${DRAG_BOX.h}`} />
                  <div className="absolute inset-0 z-10" onClick={completeInsert} aria-hidden="true" />
                </>
              )}
            </SlideCanvas>
          </div>
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
          <StatusBar
            left={[`第 ${currentSlide.index}/${slides.length} 页`, ...(insertTool ? [`插入工具：${tool.name}`] : demoState === "symbols" ? ["文本编辑中"] : [])]}
            right={[<StatusText key="s" status={{ kind: "sync", state: "synced" }} variant="dot" />]}
          />
        }
      />
    </div>
  )
}
