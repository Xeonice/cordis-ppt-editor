import { useEffect, useState } from "react"
import { CircleHelp, LayoutTemplate, Presentation } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ThemeToggle } from "@/components/theme-toggle"
import type { LayoutDef } from "@/lib/mock-data"
import { DesignTab } from "./ribbon/DesignTab"
import { HomeTab } from "./ribbon/HomeTab"
import { InsertTab } from "./ribbon/InsertTab"
import { MasterTab, type LayoutDeleteTarget } from "./ribbon/MasterTab"
import { PluginTab } from "./ribbon/PluginTab"
import { RibbonRoot } from "./ribbon/primitives"
import { TransitionTab } from "./ribbon/TransitionTab"
import { ViewTab, type MasterEntryState } from "./ribbon/ViewTab"

export * from "./ribbon/primitives"
export { HomeTab, InsertTab, DesignTab, ViewTab, TransitionTab, PluginTab, MasterTab }
export type { MasterEntryState, LayoutDeleteTarget }

export type RibbonTabValue = "home" | "insert" | "design" | "transition" | "view" | "plugin"

export type EditorViewMode = "normal" | "master"

/** Q12：母版视图入口的视口门槛（信息架构 §6 / 裁决 Q19 统一 1024 断点） */
const MASTER_VIEW_MEDIA = "(min-width: 1024px)"

/** 监听视口是否 ≥ 1024；首帧按当前 matchMedia 结果初始化，无 window 时按宽屏处理 */
function useWideViewport() {
  const [wide, setWide] = useState(() => (typeof window === "undefined" ? true : window.matchMedia(MASTER_VIEW_MEDIA).matches))
  useEffect(() => {
    const mql = window.matchMedia(MASTER_VIEW_MEDIA)
    const onChange = () => setWide(mql.matches)
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])
  return wide
}

/**
 * 普通 / 母版 视图切换：常驻 Ribbon 页签行右侧（用户裁决 2026-09-16：入口应在菜单栏，而不是缩略图栏顶部）。
 * 两个视图是两条路由：普通 `/editor`，母版 `/editor/masters`；回调缺省时直接导航。
 * Q12（裁决 2026-09-18 §4.10）：评审 / 放映 / 窄屏（< 1024）下整个分段不渲染（由 RibbonTrailing 控制）。
 */
function ViewModeSwitch({ value, onEnterMasterView, onExitMasterView }: { value: EditorViewMode; onEnterMasterView?: () => void; onExitMasterView?: () => void }) {
  const navigate = useNavigate()
  return (
    <ToggleGroup
      type="single"
      size="sm"
      value={value}
      onValueChange={(v) => {
        if (!v || v === value) return
        if (v === "master") (onEnterMasterView ?? (() => navigate("/editor/masters")))()
        else (onExitMasterView ?? (() => navigate("/editor")))()
      }}
      aria-label="视图模式"
      className="mr-1"
    >
      <ToggleGroupItem value="normal" aria-label="普通视图"><Presentation />普通</ToggleGroupItem>
      <ToggleGroupItem value="master" aria-label="母版视图"><LayoutTemplate />母版</ToggleGroupItem>
    </ToggleGroup>
  )
}

function RibbonTrailing({
  viewMode,
  masterEntry,
  onEnterMasterView,
  onExitMasterView,
  onOpenShortcuts,
}: {
  viewMode: EditorViewMode
  masterEntry: MasterEntryState
  onEnterMasterView?: () => void
  onExitMasterView?: () => void
  onOpenShortcuts?: () => void
}) {
  return (
    <>
      {masterEntry === "enabled" && <ViewModeSwitch value={viewMode} onEnterMasterView={onEnterMasterView} onExitMasterView={onExitMasterView} />}
      <ThemeToggle />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="帮助与快捷键" onClick={onOpenShortcuts}>
            <CircleHelp />
          </Button>
        </TooltipTrigger>
        <TooltipContent>帮助与快捷键（⌘/）</TooltipContent>
      </Tooltip>
    </>
  )
}

export interface EditorRibbonProps {
  currentMasterId: string
  currentLayoutId: string
  onInsertSlide?: (masterId: string, layout: LayoutDef) => void
  onOpenFind?: () => void
  onAddComment?: () => void
  onEnterMasterView?: () => void
  onOpenShortcuts?: () => void
  zoom?: number
  onZoomChange?: (v: import("@/components/editor/SlideCanvas").ZoomValue) => void
  showThumbnailRail?: boolean
  onShowThumbnailRailChange?: (v: boolean) => void
  showNotes?: boolean
  onShowNotesChange?: (v: boolean) => void
  themeId?: string
  onThemeChange?: (id: string) => void
  emphasize?: "font" | "paragraph"
  /** 03-screens/13：文档含仅授权查看的内嵌字体时的字体名，透传给「开始」页签字体下拉 */
  restrictedFontName?: string
  /**
   * Q12：母版视图入口状态。缺省 `"enabled"`，此时 EditorRibbon 会按视口自动判定（< 1024 → `"narrow"`）；
   * 评审 / 只读态由路由传 `"review"`。非 `"enabled"` 时页签行右侧的视图分段不渲染，「视图」页签的「母版视图」按钮禁用并说明原因。
   */
  masterEntry?: MasterEntryState
}

/** 普通视图的页签清单；母版视图复用同一清单（去掉"设计"页签，其主题/背景控件在"母版"页签内），保证两种视图是同一个编辑器。 */
function buildEditorTabs(p: EditorRibbonProps, masterEntry: MasterEntryState) {
  return [
    {
      value: "home",
      label: "开始",
      content: (
        <HomeTab
          currentMasterId={p.currentMasterId}
          currentLayoutId={p.currentLayoutId}
          onInsertSlide={p.onInsertSlide}
          onOpenFind={p.onOpenFind}
          emphasize={p.emphasize}
          restrictedFontName={p.restrictedFontName}
        />
      ),
    },
    { value: "insert", label: "插入", content: <InsertTab onAddComment={p.onAddComment} /> },
    { value: "design", label: "设计", content: <DesignTab themeId={p.themeId} onThemeChange={p.onThemeChange} /> },
    { value: "transition", label: "切换", content: <TransitionTab /> },
    {
      value: "view",
      label: "视图",
      content: (
        <ViewTab
          zoom={p.zoom}
          onZoomChange={p.onZoomChange}
          showThumbnailRail={p.showThumbnailRail}
          onShowThumbnailRailChange={p.onShowThumbnailRailChange}
          showNotes={p.showNotes}
          onShowNotesChange={p.onShowNotesChange}
          onEnterMasterView={p.onEnterMasterView}
          masterEntry={masterEntry}
        />
      ),
    },
    { value: "plugin", label: "数据图表插件", content: <PluginTab />, accent: true },
  ]
}

/**
 * 普通视图的完整 Ribbon：开始/插入/设计/切换/视图 + 插件页签。
 * 每个路由只需传入当前上下文（母版/版式、缩放、主题等）与少量回调即可获得完整可用的 Ribbon。
 * Q12：`masterEntry` 缺省时按视口自动判定窄屏；传 `"review"` 表示评审态（优先于视口判定）。
 */
export function EditorRibbon({
  value,
  onValueChange,
  ...props
}: EditorRibbonProps & {
  value: RibbonTabValue
  onValueChange: (v: RibbonTabValue) => void
}) {
  const wide = useWideViewport()
  const masterEntry: MasterEntryState =
    props.masterEntry === "review" ? "review" : props.masterEntry === "narrow" || !wide ? "narrow" : "enabled"
  return (
    <RibbonRoot
      value={value}
      onValueChange={(v) => onValueChange(v as RibbonTabValue)}
      trailing={<RibbonTrailing viewMode="normal" masterEntry={masterEntry} onEnterMasterView={props.onEnterMasterView} onOpenShortcuts={props.onOpenShortcuts} />}
      tabs={buildEditorTabs(props, masterEntry)}
    />
  )
}

export type MasterRibbonTabValue = "master" | Exclude<RibbonTabValue, "design">

/**
 * T-02 母版视图：与 PowerPoint 的"幻灯片母版"视图一致——功能区在最左插入"母版"页签，
 * 开始/插入/切换/视图/插件页签照常可用（编辑器是同一个），仅隐藏"设计"页签（主题与背景控件已在母版页签内）。
 * "关闭母版视图"在母版页签最右侧；视图模式分段处于"母版"档。
 * Q12：已在母版视图中时缩窄窗口不强制退出，分段与页签照常渲染（不做视口判定）。
 */
export function MasterRibbon({
  value,
  onValueChange,
  scopeLabel,
  onClose,
  deleteTarget,
  onDeleteLayouts,
  ...props
}: EditorRibbonProps & {
  value: MasterRibbonTabValue
  onValueChange: (v: MasterRibbonTabValue) => void
  scopeLabel: string
  onClose: () => void
  /** Q11 / Q16-e：当前选中版式（可多选）的删除目标；未选中版式时省略，「删除版式」按钮禁用 */
  deleteTarget?: LayoutDeleteTarget
  onDeleteLayouts?: () => void
}) {
  return (
    <RibbonRoot
      value={value}
      onValueChange={(v) => onValueChange(v as MasterRibbonTabValue)}
      trailing={<RibbonTrailing viewMode="master" masterEntry="enabled" onExitMasterView={onClose} onOpenShortcuts={props.onOpenShortcuts} />}
      tabs={[
        {
          value: "master",
          label: "母版",
          content: <MasterTab scopeLabel={scopeLabel} onClose={onClose} deleteTarget={deleteTarget} onDeleteLayouts={onDeleteLayouts} />,
          accent: true,
        },
        ...buildEditorTabs(props, "enabled").filter((t) => t.value !== "design"),
      ]}
    />
  )
}
