import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AppBar, DesignBar, EditorShell, Inspector, LayoutGallery, MiniSlide, SlideCanvas, SlideContent, StatusBar, StatusText, ThumbnailRail } from "@/components/editor"
import { collaborators, documentTitle, masters, slides, type LayoutDef } from "@/lib/mock-data"

/**
 * 03-screens/27 版式选择与重置。裁决 2026-09-18 §4.10：Q13 换版式后元素无法匹配占位符统一用
 * toast「N 个元素无法匹配新版式的占位符，已保留为普通形状 [撤销]」（不再用对话框内联描述）；
 * Q16 保留版式画廊搜索框、跨母版提示（同时切换母版与主题解析链）、「重置为版式默认」二次确认 + 可撤销 toast。
 */
type DemoState = "picker" | "cross-master" | "mismatch" | "reset" | "single-master" | "readonly"

const stateOptions = [
  { value: "picker", label: "版式选择器（默认）" },
  { value: "cross-master", label: "跨母版选择提示" },
  { value: "mismatch", label: "版式不匹配警告" },
  { value: "reset", label: "重置占位符确认" },
  { value: "single-master", label: "单母版（扁平网格）" },
  { value: "readonly", label: "只读 · 入口不出现" },
]

export function EditorLayouts() {
  const [demoState, setDemoState] = useState<DemoState>("picker")
  const [role, setRole] = useState("owner")
  const currentSlide = slides[2]!
  const readOnly = demoState === "readonly" || role === "commenter" || role === "viewer"
  const [pickerOpen, setPickerOpen] = useState(true)
  const [resetOpen, setResetOpen] = useState(false)

  /** mock：「版式不匹配警告」演示态固定 2 个未匹配元素；跨母版换版式演示 1 个；其余 0 */
  function unmatchedCount(masterId: string) {
    return demoState === "mismatch" ? 2 : masterId !== currentSlide.masterId ? 1 : 0
  }

  /** Q13：无法匹配新版式占位符的元素保留为普通形状，toast + 撤销 */
  function notifyMismatch(n: number) {
    if (n <= 0) return
    toast(`${n} 个元素无法匹配新版式的占位符，已保留为普通形状`, { action: { label: "撤销", onClick: () => toast.success("已撤销") } })
  }

  function handleSelect(masterId: string, layout: LayoutDef) {
    setPickerOpen(false)
    if (masterId !== currentSlide.masterId) {
      // Q16-c：跨母版选版式 = 同时切换母版与主题解析链，一个事务
      toast(`已切换母版并应用版式 · ${layout.name}`, { description: `本页所属母版已同时切换为「${masters.find((m) => m.id === masterId)?.name}」` })
    } else {
      toast(`已应用版式 · ${layout.name}`)
    }
    notifyMismatch(unmatchedCount(masterId))
  }

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar
        title="版式选择与重置"
        spec="03-screens/27"
        state={demoState}
        onStateChange={(v) => {
          setDemoState(v as DemoState)
          setPickerOpen(v !== "reset" && v !== "readonly")
          setResetOpen(v === "reset")
          if (v === "mismatch") notifyMismatch(2)
        }}
        stateOptions={stateOptions}
        role={role}
        onRoleChange={setRole}
      />
      <EditorShell
        appBar={<AppBar title={documentTitle} collaborators={collaborators.filter((c) => !c.isSelf)} status={{ kind: "sync", state: "synced" }} />}
        thumbnailRail={<ThumbnailRail mode="normal" slides={slides} currentSlideId={currentSlide.id} />}
        canvas={
          <div className="flex flex-1 flex-col">
            <SlideCanvas hideZoomBar>
              <SlideContent slide={currentSlide} fill />
              <div className="absolute right-4 bottom-4 rounded-md bg-doc-ink/[0.06] px-2 py-1 text-xs text-doc-ink/60">
                第 {currentSlide.index} 页 · {currentSlide.title} · 当前版式：{masters.find((m) => m.id === currentSlide.masterId)?.layouts.find((l) => l.id === currentSlide.layoutId)?.name}
              </div>
            </SlideCanvas>
            {!readOnly && (
              <div className="flex shrink-0 justify-center pb-3">
                <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>打开版式选择器</Button>
              </div>
            )}
          </div>
        }
        inspector={
          <Inspector
            value="properties"
            onValueChange={() => {}}
            tabs={[{
              value: "properties", label: "属性", content: (
                <div className="oce-well m-3 p-3 text-xs"><div className="oce-group flex flex-col gap-3 p-3">
                  <p className="font-medium text-foreground">幻灯片属性</p>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">版式</span>
                    <Button variant="outline" size="sm" className="justify-start" disabled={readOnly} onClick={() => setPickerOpen(true)}>
                      {masters.find((m) => m.id === currentSlide.masterId)?.layouts.find((l) => l.id === currentSlide.layoutId)?.name} <span className="ml-auto text-muted-foreground">更换…</span>
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="justify-start text-muted-foreground" disabled={readOnly} onClick={() => setResetOpen(true)}>重置为版式默认…</Button>
                </div></div>
              ),
            }]}
          />
        }
        statusBar={<StatusBar left={[`第 ${currentSlide.index}/${slides.length} 页`]} right={[<StatusText key="s" status={{ kind: "sync", state: "synced" }} variant="dot" />]} />}
      />

      <Dialog open={pickerOpen && !readOnly} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>更换版式 · 第 {currentSlide.index} 页</DialogTitle>
          </DialogHeader>
          <LayoutGallery
            mode="change"
            currentMasterId={currentSlide.masterId}
            currentLayoutId={currentSlide.layoutId}
            onSelect={handleSelect}
            mastersOverride={demoState === "single-master" ? [masters[0]!] : undefined}
          />
          <DialogFooter className="sm:justify-between">
            <Button variant="ghost" size="sm" onClick={() => { setPickerOpen(false); setResetOpen(true) }} className="text-muted-foreground">重置为版式默认</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPickerOpen(false)}>取消</Button>
              <Button onClick={() => { setPickerOpen(false); toast("已应用版式"); notifyMismatch(unmatchedCount(currentSlide.masterId)) }}>应用版式</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>重置「{masters.find((m) => m.id === currentSlide.masterId)?.layouts.find((l) => l.id === currentSlide.layoutId)?.name}」占位符？</DialogTitle>
            <DialogDescription>已对占位符做的位置、样式改动将恢复为版式定义；你新增的形状、图片不受影响。</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center rounded-md border bg-muted/30 p-4">
            <MiniSlide kind={masters.find((m) => m.id === currentSlide.masterId)?.layouts.find((l) => l.id === currentSlide.layoutId)?.kind ?? "title-content"} className="w-40 rounded border" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>取消</Button>
            <Button onClick={() => { setResetOpen(false); toast("已重置占位符属性", { action: { label: "撤销", onClick: () => toast.success("已撤销") } }) }}>确认重置</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
