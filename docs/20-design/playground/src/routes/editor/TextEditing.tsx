import { useState } from "react"
import { Bold, Italic, List, Lock } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
import {
  AppBar, CanvasElementBox, ColorPickerPopover, DesignBar, EditorShell, Inspector, MiniToolbar, SlideCanvas,
  StatusBar, StatusText, ThumbnailRail,
} from "@/components/editor"
import { EditorRibbon } from "@/components/editor/Ribbon"
import type { RibbonTabValue } from "@/components/editor/Ribbon"
import { collaborators, documentTitle, slides } from "@/lib/mock-data"
import { ReadonlyRibbonNotice } from "@/components/editor/Ribbon"

type DemoState = "placeholder" | "editing" | "bullets" | "autofit" | "readonly" | "restricted-font"

const stateOptions = [
  { value: "placeholder", label: "空占位符提示" },
  { value: "editing", label: "编辑中 · 迷你工具条" },
  { value: "bullets", label: "项目符号 · 多级缩进" },
  { value: "autofit", label: "已自动缩小至 92%" },
  { value: "readonly", label: "只读（无插入符/无工具条）" },
  { value: "restricted-font", label: "受限字体三处提示" },
]

/** 03-screens/13：仅授权查看的内嵌字体名与编辑时的回退字体 */
const RESTRICTED_FONT = "Corp Serif"
const FALLBACK_FONT = "微软雅黑"

export function EditorText() {
  const [demoState, setDemoState] = useState<DemoState>("editing")
  const [role, setRole] = useState("owner")
  const [ribbonTab, setRibbonTab] = useState<RibbonTabValue>("home")
  const [fontColor, setFontColor] = useState("#4A54E1")
  const [inlineNoticeDismissed, setInlineNoticeDismissed] = useState(false)
  const currentSlide = slides[1]!
  const readOnly = demoState === "readonly" || role === "commenter" || role === "viewer"
  const restrictedFont = demoState === "restricted-font"

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar title="文本编辑与格式化" spec="03-screens/16" state={demoState} onStateChange={(v) => { setDemoState(v as DemoState); setInlineNoticeDismissed(false) }} stateOptions={stateOptions} role={role} onRoleChange={setRole} />
      <EditorShell
        appBar={<AppBar title={documentTitle} collaborators={collaborators.filter((c) => !c.isSelf)} status={{ kind: "sync", state: "synced" }} />}
        ribbon={
          readOnly ? (
            <ReadonlyRibbonNotice>评审模式下不可编辑文本</ReadonlyRibbonNotice>
          ) : (
            <EditorRibbon
              value={ribbonTab}
              onValueChange={setRibbonTab}
              currentMasterId={currentSlide.masterId}
              currentLayoutId={currentSlide.layoutId}
              emphasize="font"
              restrictedFontName={restrictedFont ? RESTRICTED_FONT : undefined}
            />
          )
        }
        thumbnailRail={<ThumbnailRail mode="normal" slides={slides} currentSlideId={currentSlide.id} />}
        canvas={
          <SlideCanvas>
            <TextScene
              state={demoState}
              fontColor={fontColor}
              onFontColorChange={setFontColor}
              readOnly={readOnly}
              restrictedFont={restrictedFont}
              inlineNoticeDismissed={inlineNoticeDismissed}
              onDismissInlineNotice={() => setInlineNoticeDismissed(true)}
            />
          </SlideCanvas>
        }
        inspector={
          <Inspector
            value="properties"
            onValueChange={() => {}}
            readOnly={readOnly}
            tabs={[{
              value: "properties", label: "属性", content: (
                <div className="cordex-well m-3 p-3 text-xs"><div className="cordex-group flex flex-col gap-3 p-3">
                  <p className="font-medium text-foreground">文本</p>
                  <div className="flex items-center gap-2"><span className="w-12 text-muted-foreground">字体</span><span>{restrictedFont ? `${FALLBACK_FONT}（编辑时替代）` : "微软雅黑"}</span></div>
                  <div className="flex items-center gap-2"><span className="w-12 text-muted-foreground">字号</span><span className="tabular-nums">18</span></div>
                  {demoState === "autofit" && <Badge variant="outline" className="w-fit text-warning-foreground">已自动缩小至 92%</Badge>}
                </div></div>
              ),
            }]}
          />
        }
        statusBar={
          <StatusBar
            left={[
              `第 ${currentSlide.index}/${slides.length} 页`,
              demoState === "editing" || demoState === "bullets" ? "正在编辑文本" : undefined,
              restrictedFont ? (
                <span key="restricted-font-notice" className="inline-flex items-center gap-1">
                  <Lock className="size-3" aria-hidden="true" />1 种字体仅授权查看，编辑时以替代字体显示
                  <Button variant="link" size="xs" className="h-auto p-0 text-xs" onClick={() => toast("已打开保真报告 · 字体分组（演示）")}>详情</Button>
                </span>
              ) : undefined,
            ].filter(Boolean)}
            right={[<StatusText key="s" status={{ kind: "sync", state: "synced" }} variant="dot" />]}
          />
        }
      />
    </div>
  )
}

function TextScene({
  state,
  fontColor,
  onFontColorChange,
  readOnly,
  restrictedFont,
  inlineNoticeDismissed,
  onDismissInlineNotice,
}: {
  state: DemoState
  fontColor: string
  onFontColorChange: (v: string) => void
  readOnly: boolean
  restrictedFont?: boolean
  inlineNoticeDismissed?: boolean
  onDismissInlineNotice?: () => void
}) {
  if (state === "placeholder") {
    return (
      <>
        <CanvasElementBox box={{ x: 90, y: 60, w: 780, h: 64 }} className="flex items-center text-2xl font-semibold text-doc-ink/40 italic">单击此处添加标题</CanvasElementBox>
        <CanvasElementBox box={{ x: 90, y: 160, w: 780, h: 200 }} className="flex items-center justify-center rounded-md border border-dashed border-muted-foreground/40 text-sm text-doc-ink/40 italic">单击此处添加文本</CanvasElementBox>
      </>
    )
  }
  if (state === "bullets") {
    return (
      <>
        <CanvasElementBox box={{ x: 90, y: 60, w: 780, h: 56 }} className="flex items-center text-xl font-semibold text-doc-ink">优势与挑战</CanvasElementBox>
        <CanvasElementBox box={{ x: 120, y: 150, w: 700, h: 260 }} className="flex flex-col justify-center gap-2 text-doc-ink">
          <div className="flex items-center gap-2 text-base"><span className="text-primary">•</span> 市场份额行业领先</div>
          <div className="ml-6 flex items-center gap-2 text-sm text-doc-ink/80"><span className="text-primary">◦</span> 核心区域占有率提升 6pt</div>
          <div className="ml-6 flex items-center gap-2 text-sm text-doc-ink/80"><span className="text-primary">◦</span> 新客户获取成本下降</div>
          <div className="flex items-center gap-2 text-base"><span className="text-primary">•</span> 供应链成本上升</div>
          <div className="ml-6 flex items-center gap-2 text-sm text-doc-ink/80"><span className="text-primary">◦</span> 原材料价格波动</div>
        </CanvasElementBox>
        <MiniToolbar x={470} y={148}>
          <ToolbarButtons fontColor={fontColor} onFontColorChange={onFontColorChange} />
        </MiniToolbar>
      </>
    )
  }
  if (state === "autofit") {
    return (
      <>
        <CanvasElementBox box={{ x: 90, y: 40, w: 780, h: 460 }} className="flex flex-col justify-center gap-2 rounded-md border border-dashed border-warning/50 p-4" style={{ fontSize: 13 }}>
          <p className="font-semibold text-doc-ink" style={{ fontSize: "0.92em" }}>业绩概览（内容较多，已按比例缩小）</p>
          {Array.from({ length: 8 }).map((_, i) => (
            <p key={i} className="text-doc-ink/75" style={{ fontSize: "0.92em" }}>第 {i + 1} 条要点：季度目标达成情况与后续计划说明文字</p>
          ))}
        </CanvasElementBox>
        <Badge className="absolute right-8 bottom-8 border-transparent bg-warning-muted text-warning-foreground">已自动缩小至 92%</Badge>
      </>
    )
  }
  // "editing" | "readonly" | "restricted-font"
  const showInlineNotice = !!restrictedFont && !inlineNoticeDismissed
  // 受限字体一次性内联提示需要在标题与文本框之间腾出空间；MiniToolbar 以 -translate-y-[100%+10px] 悬浮在
  // 文本框上方，故这里的下移量须大于「提示条高度 + 提示条与工具条的间隙」，否则两者会互相重叠
  const textShift = showInlineNotice ? 52 : 0
  return (
    <>
      <CanvasElementBox box={{ x: 90, y: 60, w: 780, h: 56 }} className="flex items-center text-xl font-semibold text-doc-ink">业绩概览</CanvasElementBox>
      {showInlineNotice && (
        <div
          className="glass-strong absolute z-20 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-foreground/80"
          style={{ left: 120, top: 120, width: 700 }}
        >
          <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="flex-1">"{RESTRICTED_FONT}" 仅授权查看，编辑时以"{FALLBACK_FONT}"显示，查看和放映时仍使用原字体</span>
          <Button variant="ghost" size="icon-xs" aria-label="关闭提示" onClick={onDismissInlineNotice}>×</Button>
        </div>
      )}
      <CanvasElementBox
        box={{ x: 120, y: 150 + textShift, w: 700, h: 40 }}
        className={readOnly ? "flex items-center text-base text-doc-ink" : "flex items-center border-b-2 border-primary text-base text-doc-ink"}
      >
        Q2 营收同比增长 18%，超出既定目标
        {!readOnly && <span className="ml-0.5 inline-block h-5 w-px animate-pulse bg-primary" aria-hidden="true" />}
      </CanvasElementBox>
      <CanvasElementBox box={{ x: 120, y: 198 + textShift, w: 700, h: 36 }} className="flex items-center text-base text-doc-ink/80">毛利率维持在 42% 以上</CanvasElementBox>
      {!readOnly && (
        <MiniToolbar x={470} y={148 + textShift}>
          <ToolbarButtons fontColor={fontColor} onFontColorChange={onFontColorChange} restrictedFont={restrictedFont} />
        </MiniToolbar>
      )}
    </>
  )
}

function ToolbarButtons({ fontColor, onFontColorChange, restrictedFont }: { fontColor: string; onFontColorChange: (v: string) => void; restrictedFont?: boolean }) {
  return (
    <>
      <span className="inline-flex items-center gap-1 px-1.5 text-2xs text-foreground/80">
        {restrictedFont && <Lock className="size-3 text-muted-foreground" aria-hidden="true" />}
        {restrictedFont ? FALLBACK_FONT : "微软雅黑"}
      </span>
      <span className="px-1 text-[11px] text-muted-foreground">18</span>
      <Toggle size="sm" aria-label="加粗" className="size-6" defaultPressed><Bold className="size-3.5" /></Toggle>
      <Toggle size="sm" aria-label="斜体" className="size-6"><Italic className="size-3.5" /></Toggle>
      <ColorPickerPopover
        value={fontColor}
        onChange={onFontColorChange}
        trigger={<Button variant="ghost" size="icon-xs" aria-label="字体颜色"><span className="block size-3 rounded-full" style={{ backgroundColor: fontColor }} /></Button>}
      />
      <Toggle size="sm" aria-label="项目符号" className="size-6"><List className="size-3.5" /></Toggle>
    </>
  )
}
