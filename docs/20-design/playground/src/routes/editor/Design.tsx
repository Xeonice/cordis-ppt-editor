import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Lock } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AppBar, CanvasElementBox, DesignBar, EditorShell, SlideCanvas, StatusBar, StatusText, ThemeEditorPanel,
  ThumbnailRail,
} from "@/components/editor"
import { EditorRibbon } from "@/components/editor/Ribbon"
import type { RibbonTabValue } from "@/components/editor/Ribbon"
import { collaborators, documentTitle, slides, themePresets } from "@/lib/mock-data"
import { ReadonlyRibbonNotice } from "@/components/editor/Ribbon"

/**
 * 03-screens/28 设计页签与主题。裁决 2026-09-18 §4.10 Q17：去掉了默认主题设置与另存主题两个入口。
 * 设计 28 待登记：应用栏「在母版视图中管理主题」为进入 /editor/masters 的次入口；状态栏「当前主题：X」。
 */
type DemoState = "browse" | "color" | "font" | "readonly"

const stateOptions = [
  { value: "browse", label: "浏览已应用主题（默认）" },
  { value: "color", label: "自定义颜色编辑中" },
  { value: "font", label: "自定义字体编辑中" },
  { value: "readonly", label: "只读（评审模式）" },
]

export function EditorDesign() {
  const navigate = useNavigate()
  const [demoState, setDemoState] = useState<DemoState>("browse")
  const [role, setRole] = useState("owner")
  const [themeId, setThemeId] = useState("office")
  const [ribbonTab, setRibbonTab] = useState<RibbonTabValue>("design")
  const currentSlide = slides[1]!
  const readOnly = demoState === "readonly" || role === "commenter" || role === "viewer"
  const theme = themePresets.find((t) => t.id === themeId) ?? themePresets[0]!

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar title="设计页签与主题" spec="03-screens/28" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} role={role} onRoleChange={setRole} />
      <EditorShell
        appBar={
          <AppBar title={documentTitle} collaborators={collaborators.filter((c) => !c.isSelf)} status={{ kind: "sync", state: "synced" }}>
            <Button variant="ghost" size="sm" onClick={() => navigate("/editor/masters")}>在母版视图中管理主题</Button>
          </AppBar>
        }
        ribbon={
          readOnly ? (
            <ReadonlyRibbonNotice>评审模式下"设计"页签的自定义控件不可交互</ReadonlyRibbonNotice>
          ) : (
            <EditorRibbon
              value={ribbonTab}
              onValueChange={setRibbonTab}
              currentMasterId={currentSlide.masterId}
              currentLayoutId={currentSlide.layoutId}
              themeId={themeId}
              onThemeChange={setThemeId}
            />
          )
        }
        thumbnailRail={<ThumbnailRail mode="normal" slides={slides} currentSlideId={currentSlide.id} />}
        canvas={
          <SlideCanvas>
            <div className="absolute inset-0" style={{ backgroundColor: theme.colors[0]!.hex }} aria-hidden="true" />
            <CanvasElementBox box={{ x: 90, y: 70, w: 780, h: 64 }} className="flex items-center text-2xl font-semibold" style={{ color: theme.colors[4]!.hex }}>
              {currentSlide.title}
            </CanvasElementBox>
            <CanvasElementBox box={{ x: 120, y: 180, w: 700, h: 36 }} className="flex items-center text-base" style={{ color: theme.colors[1]!.hex }}>
              Q2 营收同比增长 18%，超出既定目标
            </CanvasElementBox>
            <CanvasElementBox box={{ x: 120, y: 226, w: 700, h: 36 }} className="flex items-center text-base" style={{ color: theme.colors[1]!.hex }}>
              毛利率维持在 42% 以上
            </CanvasElementBox>
            <CanvasElementBox box={{ x: 120, y: 320, w: 300, h: 12 }} className="flex items-center gap-2">
              {theme.colors.slice(4, 10).map((c) => (
                <span key={c.key} className="h-3 flex-1 rounded-full" style={{ backgroundColor: c.hex }} aria-label={c.label} />
              ))}
            </CanvasElementBox>
          </SlideCanvas>
        }
        inspector={
          <div className="flex h-full w-full flex-col">
            <div className="flex h-10 shrink-0 items-center border-b border-foreground/5 px-3 text-sm font-medium">设计 · 主题编辑</div>
            {readOnly ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted-foreground">
                <Lock className="size-4" />
                只读 · 评审模式下不可编辑
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3">
                <ThemeEditorPanel
                  themeId={themeId}
                  defaultTab={demoState === "font" ? "font" : "color"}
                  onApply={() => toast("主题已应用", { description: "影响该主题下全部母版、版式与页面" })}
                />
              </div>
            )}
          </div>
        }
        statusBar={
          <StatusBar
            left={[`当前主题：${theme.name}`]}
            right={[<StatusText key="s" status={{ kind: "sync", state: "synced" }} variant="dot" />]}
          />
        }
      />
    </div>
  )
}
