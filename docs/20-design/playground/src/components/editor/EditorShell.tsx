import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import { Eye, PanelLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useBreakpoint, type Breakpoint } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

/** 收起为抽屉的侧栏：应用栏 / 状态栏据此渲染打开按钮（PanelLeft / PanelRight）。 */
export interface EditorShellPanelControl {
  label: string
  open: boolean
  setOpen: (open: boolean) => void
}

export interface EditorShellContextValue {
  breakpoint: Breakpoint
  /** 缩略图栏抽屉：仅 narrow 提供（compact 由 44px 图标条自带 PanelLeft 按钮）。 */
  rail?: EditorShellPanelControl
  /** 检查器抽屉：compact / narrow 都由应用栏右端的 PanelRight 按钮打开。 */
  inspector?: EditorShellPanelControl
}

const EditorShellContext = createContext<EditorShellContextValue | null>(null)

/** 壳内组件（AppBar 等）读取当前断点与已收起侧栏；壳外（打开失败态等）为 null。 */
export function useEditorShell() {
  return useContext(EditorShellContext)
}

/**
 * T-01 编辑器壳：行为 应用栏 48 / Ribbon（页签栏 36 + 内容区 91）/ 主区 1fr / 备注条 32 / 状态栏 28；
 * 主区内为 缩略图栏 240 / 画布 1fr / 检查器 300（版本历史 560）三栏，用 ResizablePanelGroup 组织。
 * 断点（Q19，useBreakpoint）：compact 640–1024 缩略图栏收为 44px 图标条、检查器默认收起为 Sheet；
 * narrow < 640 两侧栏都只走 Sheet，并在顶部提示"仅查看"。
 */
export function EditorShell({
  appBar,
  ribbon,
  thumbnailRail,
  thumbnailRailLabel = "幻灯片",
  canvas,
  inspector,
  inspectorLabel = "属性",
  notesBar,
  statusBar,
  thumbnailRailWidth = 240,
  inspectorWidth = 300,
  className,
}: {
  appBar: ReactNode
  ribbon?: ReactNode
  thumbnailRail?: ReactNode
  thumbnailRailLabel?: string
  canvas: ReactNode
  inspector?: ReactNode
  inspectorLabel?: string
  notesBar?: ReactNode
  statusBar?: ReactNode
  thumbnailRailWidth?: number
  inspectorWidth?: number
  className?: string
}) {
  const breakpoint = useBreakpoint()
  const [railOpen, setRailOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const compact = breakpoint === "compact"
  const narrow = breakpoint === "narrow"
  const collapsed = compact || narrow
  const hasRail = !!thumbnailRail
  const hasInspector = !!inspector

  const shell = useMemo<EditorShellContextValue>(
    () => ({
      breakpoint,
      rail: narrow && hasRail ? { label: thumbnailRailLabel, open: railOpen, setOpen: setRailOpen } : undefined,
      inspector: collapsed && hasInspector ? { label: inspectorLabel, open: inspectorOpen, setOpen: setInspectorOpen } : undefined,
    }),
    [breakpoint, narrow, collapsed, hasRail, hasInspector, thumbnailRailLabel, inspectorLabel, railOpen, inspectorOpen]
  )

  return (
    <EditorShellContext.Provider value={shell}>
      <div className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2", className)}>
        <div className="glass-strong shrink-0 overflow-hidden rounded-2xl">
          {appBar}
          {ribbon}
        </div>

        {narrow && (
          <div role="status" className="glass flex h-9 shrink-0 items-center gap-2 rounded-2xl px-3 text-xs text-muted-foreground">
            <Eye className="size-3.5 shrink-0" aria-hidden="true" />
            <span>仅查看：窄屏下不提供完整编辑 UI</span>
          </div>
        )}

        {collapsed ? (
          <div className="flex min-h-0 flex-1 gap-2">
            {compact && hasRail && (
              <div className="glass-strong flex w-11 shrink-0 flex-col items-center rounded-2xl py-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`打开${thumbnailRailLabel}`} aria-expanded={railOpen} onClick={() => setRailOpen(true)}>
                      <PanelLeft />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{thumbnailRailLabel}</TooltipContent>
                </Tooltip>
              </div>
            )}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl">{canvas}</div>
          </div>
        ) : (
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
            {hasRail && (
              <>
                <ResizablePanel defaultSize={thumbnailRailWidth} minSize={160} maxSize={420} className="glass-strong min-w-0 overflow-hidden rounded-2xl">
                  {thumbnailRail}
                </ResizablePanel>
                <ResizableHandle className="w-2 shrink-0 bg-transparent transition-colors hover:bg-foreground/10 focus-visible:bg-primary/20" />
              </>
            )}
            <ResizablePanel className="flex min-h-0 min-w-0 flex-1 flex-col">{canvas}</ResizablePanel>
            {hasInspector && (
              <>
                <ResizableHandle className="w-2 shrink-0 bg-transparent transition-colors hover:bg-foreground/10 focus-visible:bg-primary/20" />
                <ResizablePanel defaultSize={inspectorWidth} minSize={240} maxSize={720} className="glass-strong min-w-0 overflow-hidden rounded-2xl">
                  {inspector}
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        )}

        {notesBar}
        {statusBar}

        {collapsed && hasRail && (
          <Sheet open={railOpen} onOpenChange={setRailOpen}>
            <SheetContent side="left" className="w-72 gap-0 p-0">
              <SheetHeader className="border-b border-foreground/5 px-4 pt-4 pb-3">
                <SheetTitle className="text-sm font-medium">{thumbnailRailLabel}</SheetTitle>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{thumbnailRail}</div>
            </SheetContent>
          </Sheet>
        )}
        {collapsed && hasInspector && (
          <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
            <SheetContent side="right" className="w-80 gap-0 p-0">
              <SheetHeader className="border-b border-foreground/5 px-4 pt-4 pb-3">
                <SheetTitle className="text-sm font-medium">{inspectorLabel}</SheetTitle>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{inspector}</div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </EditorShellContext.Provider>
  )
}
