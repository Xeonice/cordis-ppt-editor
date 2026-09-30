import { useRef, useState } from "react"
import { Bold, ImageDown, Italic, List, Lock, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AppBar, CanvasElementBox, CanvasFloat, CanvasOverlay, ColorPickerPopover, DesignBar, EditorShell, Inspector, MiniToolbar, NumberField,
  PropertyRow, SelectionBox, SlideCanvas, StatusBar, StatusText, ThumbnailRail, useCanvasOverlay, useToScreen, type Box,
} from "@/components/editor"
import type { ZoomValue } from "@/components/editor/SlideCanvas"
import { EditorRibbon } from "@/components/editor/Ribbon"
import type { RibbonTabValue } from "@/components/editor/Ribbon"
import { collaborators, documentTitle, slides } from "@/lib/mock-data"
import { MilestoneTag, ReadonlyRibbonNotice, RibbonTrailing, type InsertPanel } from "@/components/editor/Ribbon"
import {
  PlaceholderIconBar, placeholderIcons, placeholderItemState, type PlaceholderContentKind,
} from "@/components/editor/elements/PlaceholderIconBar"
import type { DateTimeChoice } from "@/components/editor/ribbon/insert/DateTimePicker"
import { DATETIME_FORMATS, DEFAULT_DATETIME_LANG } from "@/components/editor/ribbon/insert/datetime-formats"
import { TableGridPicker } from "@/components/editor/ribbon/insert/TableGridPicker"
import { InsertTableDialog } from "@/components/editor/ribbon/insert/InsertTableDialog"

type DemoState =
  | "placeholder" | "placeholder-icons" | "placeholder-focus" | "placeholder-collapsed" | "placeholder-table-grid" | "placeholder-drop"
  | "editing" | "datetime" | "datetime-field" | "bullets" | "autofit" | "readonly" | "restricted-font"

const stateOptions = [
  { value: "placeholder", label: "空占位符提示" },
  { value: "placeholder-icons", label: "空内容占位符 · 图标条" },
  { value: "placeholder-focus", label: "图标条 · 键盘焦点与禁用原因" },
  { value: "placeholder-collapsed", label: "图标条 · 窄占位符折叠" },
  { value: "placeholder-table-grid", label: "占位符 · 表格网格" },
  { value: "placeholder-drop", label: "图片拖入空占位符" },
  { value: "datetime", label: "日期和时间 · 格式选择器" },
  { value: "datetime-field", label: "已插入日期字段" },
  { value: "editing", label: "编辑中 · 迷你工具条" },
  { value: "bullets", label: "项目符号 · 多级缩进" },
  { value: "autofit", label: "已自动缩小至 92%" },
  { value: "readonly", label: "只读（无插入符/无工具条）" },
  { value: "restricted-font", label: "受限字体三处提示" },
]

/** 「图标条 · 窄占位符折叠」演示用的缩放：左侧内容占位符在屏幕上约 270 px，放不下四个 76 px 图标（整条 344 px），折叠为「插入 ▾」；右侧单图标（100 px）仍放得下 */
const COLLAPSED_DEMO_ZOOM = 50

/** 选择器默认：中文第一种（datetime1），与 DateTimePicker 同源 */
const DEFAULT_DATE = DATETIME_FORMATS[DEFAULT_DATETIME_LANG]![0]!

/** 03-screens/13：仅授权查看的内嵌字体名与编辑时的回退字体 */
const RESTRICTED_FONT = "Corp Serif"
const FALLBACK_FONT = "微软雅黑"

const isPlaceholderIcons = (s: DemoState) =>
  s === "placeholder-icons" || s === "placeholder-focus" || s === "placeholder-collapsed" || s === "placeholder-table-grid" || s === "placeholder-drop"
const isDate = (s: DemoState) => s === "datetime" || s === "datetime-field"

export function EditorText() {
  const [demoState, setDemoStateRaw] = useState<DemoState>("editing")
  const [role, setRole] = useState("owner")
  const [ribbonTab, setRibbonTab] = useState<RibbonTabValue>("home")
  const [panelOverride, setPanelOverride] = useState<InsertPanel | null | undefined>(undefined)
  const [dateChoice, setDateChoice] = useState<DateTimeChoice>({ lang: DEFAULT_DATETIME_LANG, code: DEFAULT_DATE.code, text: DEFAULT_DATE.text, autoUpdate: true })
  const panel = panelOverride !== undefined ? panelOverride : demoState === "datetime" ? "datetime" : null
  const [zoom, setZoom] = useState<ZoomValue>("fit")
  const [phPicker, setPhPicker] = useState<PlaceholderContentKind | null>(null)
  const [phMenuOpen, setPhMenuOpen] = useState(false)
  function setDemoState(v: DemoState) {
    setDemoStateRaw(v)
    setPanelOverride(undefined)
    setRibbonTab(isDate(v) ? "insert" : "home")
    setZoom(v === "placeholder-collapsed" ? COLLAPSED_DEMO_ZOOM : "fit")
    setPhPicker(v === "placeholder-table-grid" ? "table" : null)
    setPhMenuOpen(v === "placeholder-collapsed")
  }
  const [fontColor, setFontColor] = useState("#4A54E1")
  const [inlineNoticeDismissed, setInlineNoticeDismissed] = useState(false)
  const currentSlide = slides[1]!
  const readOnly = demoState === "readonly" || role === "commenter" || role === "viewer"
  const restrictedFont = demoState === "restricted-font"

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar title="文本编辑与格式化" spec="03-screens/16 · G-80 / G-81" state={demoState} onStateChange={(v) => { setDemoState(v as DemoState); setInlineNoticeDismissed(false) }} stateOptions={stateOptions} role={role} onRoleChange={setRole} />
      <EditorShell
        appBar={<AppBar title={documentTitle} collaborators={collaborators.filter((c) => !c.isSelf)} status={{ kind: "sync", state: "synced" }} />}
        ribbon={
          readOnly ? (
            <ReadonlyRibbonNotice trailing={<RibbonTrailing />}>评审模式下不可编辑文本</ReadonlyRibbonNotice>
          ) : (
            <EditorRibbon
              value={ribbonTab}
              onValueChange={setRibbonTab}
              currentMasterId={currentSlide.masterId}
              currentLayoutId={currentSlide.layoutId}
              emphasize="font"
              restrictedFontName={restrictedFont ? RESTRICTED_FONT : undefined}
              insert={{
                panel,
                onPanelChange: setPanelOverride,
                textEditing: isDate(demoState) || demoState === "editing" || demoState === "bullets",
                onInsertDate: (c) => {
                  setDateChoice(c)
                  setDemoStateRaw("datetime-field")
                  setPanelOverride(undefined)
                  toast(c.autoUpdate ? `已插入日期字段「${c.text}」` : `已插入文本「${c.text}」`, { action: { label: "撤销", onClick: () => toast.success("已撤销") } })
                },
              }}
            />
          )
        }
        thumbnailRail={<ThumbnailRail mode="normal" slides={slides} currentSlideId={currentSlide.id} />}
        canvas={
          <SlideCanvas zoom={zoom} onZoomChange={setZoom}>
            <TextScene
              state={demoState}
              phPicker={phPicker}
              onPhPickerChange={setPhPicker}
              phMenuOpen={phMenuOpen}
              onPhMenuOpenChange={setPhMenuOpen}
              fontColor={fontColor}
              onFontColorChange={setFontColor}
              readOnly={readOnly}
              restrictedFont={restrictedFont}
              dateChoice={dateChoice}
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
              value: "properties", label: "属性", content: isPlaceholderIcons(demoState) ? <PlaceholderInspector readOnly={readOnly} /> : (
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
              demoState === "editing" || demoState === "bullets" || demoState === "datetime" ? "正在编辑文本" : undefined,
              demoState === "datetime-field" ? (dateChoice.autoUpdate ? `已插入日期字段 · ${dateChoice.code}` : "已插入日期文本") : undefined,
              demoState === "placeholder-focus" && !readOnly ? "←/→ 在图标间移动 · Enter 插入 · Esc 回到占位符" : undefined,
              demoState === "placeholder-collapsed" && !readOnly ? `缩放 ${COLLAPSED_DEMO_ZOOM}%：左栏放不下图标条，已折叠为「插入 ▾」` : undefined,
              demoState === "placeholder-table-grid" && !readOnly ? "选定行列即填入此占位符 · 宽取占位符框宽" : undefined,
              demoState === "placeholder-drop" && !readOnly ? "松开鼠标：图片填入占位符（可撤销）" : undefined,
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
  phPicker,
  onPhPickerChange,
  phMenuOpen,
  onPhMenuOpenChange,
  fontColor,
  onFontColorChange,
  readOnly,
  restrictedFont,
  dateChoice,
  inlineNoticeDismissed,
  onDismissInlineNotice,
}: {
  state: DemoState
  phPicker: PlaceholderContentKind | null
  onPhPickerChange: (k: PlaceholderContentKind | null) => void
  phMenuOpen: boolean
  onPhMenuOpenChange: (v: boolean) => void
  dateChoice: DateTimeChoice
  fontColor: string
  onFontColorChange: (v: string) => void
  readOnly: boolean
  restrictedFont?: boolean
  inlineNoticeDismissed?: boolean
  onDismissInlineNotice?: () => void
}) {
  const zoom = useCanvasOverlay()?.zoom ?? 100
  if (state === "placeholder") {
    return (
      <>
        <CanvasElementBox box={{ x: 90, y: 60, w: 780, h: 64 }} className="flex items-center text-2xl font-semibold text-doc-ink/40 italic">单击此处添加标题</CanvasElementBox>
        <CanvasElementBox box={{ x: 90, y: 160, w: 780, h: 200 }} className="flex items-center justify-center rounded-md border border-dashed border-muted-foreground/40 text-sm text-doc-ink/40 italic">单击此处添加文本</CanvasElementBox>
      </>
    )
  }
  if (isPlaceholderIcons(state)) {
    return (
      <PlaceholderIconsScene
        state={state}
        readOnly={readOnly}
        picker={phPicker}
        onPickerChange={onPhPickerChange}
        menuOpen={phMenuOpen}
        onMenuOpenChange={onPhMenuOpenChange}
      />
    )
  }
  if (isDate(state)) {
    return (
      <>
        <CanvasElementBox box={{ x: 90, y: 60, w: 780, h: 56 }} className="flex items-center text-xl font-semibold text-doc-ink">项目周报 · 第 39 周</CanvasElementBox>
        <CanvasElementBox box={{ x: 120, y: 150, w: 380, h: 36 }} className="flex items-center text-base text-doc-ink/80">本周完成：导入保真回归、表格插入样张</CanvasElementBox>
        <CanvasElementBox box={{ x: 120, y: 190, w: 380, h: 36 }} className="flex items-center text-base text-doc-ink/80">下周计划：图表数据面板联调</CanvasElementBox>
        <CanvasElementBox box={{ x: 560, y: 150, w: 310, h: 36 }} className="flex items-center text-base text-doc-ink/80">汇报人：李娜</CanvasElementBox>
        <CanvasElementBox box={{ x: 560, y: 190, w: 310, h: 40 }} className="flex items-center border-b-2 border-primary text-base text-doc-ink">
          汇报日期：
          {state === "datetime-field" && (
            <span className={dateChoice.autoUpdate ? "rounded-[3px] bg-doc-ink/[0.08] px-0.5" : undefined}>{dateChoice.text}</span>
          )}
          <span className="ml-0.5 inline-block h-5 w-px animate-pulse bg-primary" aria-hidden="true" />
        </CanvasElementBox>
      </>
    )
  }
  if (state === "bullets") {
    return (
      <>
        <CanvasElementBox box={{ x: 90, y: 60, w: 780, h: 56 }} className="flex items-center text-xl font-semibold text-doc-ink">优势与挑战</CanvasElementBox>
        {/* 正文占位符按 PowerPoint 默认顶端对齐（bodyPr anchor="t"），迷你工具条贴在文本框上方，不与首行隔开一大段 */}
        <CanvasElementBox box={{ x: 120, y: 150, w: 700, h: 260 }} className="flex flex-col justify-start gap-2 pt-1 text-doc-ink">
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
  // 受限字体一次性内联提示需要在标题与文本框之间腾出空间。提示条与 MiniToolbar 都画在屏幕覆盖层、按屏幕尺寸绘制
  // （提示条顶边锚在幻灯片 y 120，高约 38 px；工具条约 34 px，浮在锚点上方 8 px），
  // 所以文本下移量按当前缩放换算：锚点须比提示条底边低「6 px 间隙 + 工具条 + 8 px」的屏幕距离，否则两者重叠
  const k = zoom / 100
  const textShift = showInlineNotice ? Math.max(52, Math.ceil(NOTICE_TOP + (NOTICE_H + 6 + 34 + 8) / k - 148)) : 0
  return (
    <>
      <CanvasElementBox box={{ x: 90, y: 60, w: 780, h: 56 }} className="flex items-center text-xl font-semibold text-doc-ink">业绩概览</CanvasElementBox>
      {showInlineNotice && (
        <CanvasFloat x={120} y={NOTICE_TOP} w={700} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-foreground/80">
          <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="flex-1">"{RESTRICTED_FONT}" 仅授权查看，编辑时以"{FALLBACK_FONT}"显示，查看和放映时仍使用原字体</span>
          <Button variant="ghost" size="icon-xs" aria-label="关闭提示" onClick={onDismissInlineNotice}>×</Button>
        </CanvasFloat>
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

/** 受限字体内联提示条：顶边的幻灯片 y 与屏幕高度（py-1.5 + 24 px 关闭按钮 + 描边） */
const NOTICE_TOP = 120
const NOTICE_H = 38

function ToolbarButtons({ fontColor, onFontColorChange, restrictedFont }: { fontColor: string; onFontColorChange: (v: string) => void; restrictedFont?: boolean }) {
  return (
    <>
      <span className="inline-flex items-center gap-1 px-1.5 text-xs text-foreground/80">
        {restrictedFont && <Lock className="size-3 text-muted-foreground" aria-hidden="true" />}
        {restrictedFont ? FALLBACK_FONT : "微软雅黑"}
      </span>
      <span className="px-1 text-xs text-muted-foreground tabular-nums">18</span>
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

/**
 * 「内容与图片」版式：左为内容占位符（obj，全部图标），右为图片占位符（pic，只图片）；G-80 / 50/21 §3。
 * 左栏取 540 pt：四个 76 px 图标整条宽 344 px，1440 × 900「适应窗口」（83%）时左栏约 448 px，放得下；
 * 等宽「两栏内容」的一栏只有 408 pt（83% 时约 339 px），按规格会折叠为「插入 ▾」（形态同演示态「图标条 · 窄占位符折叠」）。
 */
const PH_LAYOUT_NAME = "内容与图片"
const PH_TITLE = { x: 60, y: 36, w: 840, h: 72 }
const PH_LEFT = { x: 60, y: 128, w: 540, h: 372 }
const PH_RIGHT = { x: 624, y: 128, w: 276, h: 372 }
/** obj 左上「• 单击此处添加文本」一行占的高度：图标条在其下方的区域里居中 */
const PH_LEFT_PROMPT_H = 48

function PlaceholderIconsScene({
  state,
  readOnly,
  picker,
  onPickerChange,
  menuOpen,
  onMenuOpenChange,
}: {
  state: DemoState
  readOnly: boolean
  picker: PlaceholderContentKind | null
  onPickerChange: (k: PlaceholderContentKind | null) => void
  menuOpen: boolean
  onMenuOpenChange: (v: boolean) => void
}) {
  const drop = state === "placeholder-drop" && !readOnly
  const focus = state === "placeholder-focus"
  const collapsed = state === "placeholder-collapsed"
  const fillToast = { description: "填入是一个撤销步；删除内容后占位符恢复为空" }
  // 「插入表格…」与插入页签、03-30 占位符同一流程：先关网格弹层，再开对话框；确定同样填入此占位符
  const [phDialog, setPhDialog] = useState(false)
  // 对话框没有 DialogTrigger，Radix 关闭时不会自己把焦点还回去：记下打开时的焦点（close() 已把它还给表格图标）
  const phReturn = useRef<HTMLElement | null>(null)
  const fillTable = (r: number, c: number) => toast(`已在占位符插入 ${r} 行 × ${c} 列表格，宽取占位符框宽`, fillToast)
  return (
    <>
      <CanvasElementBox box={PH_TITLE} className="flex items-center rounded-sm border border-dashed border-doc-ink/25 px-4 text-[28px] text-doc-ink/40">单击此处添加标题</CanvasElementBox>
      <CanvasElementBox box={PH_LEFT} className="rounded-sm border border-dashed border-doc-ink/25">
        <p className="flex items-center gap-2 px-4 pt-3 text-lg text-doc-ink/40"><span className="text-doc-ink/35">•</span>单击此处添加文本</p>
      </CanvasElementBox>
      {/* 左侧内容占位符已选中（检查器是 placeholder-empty）：先选中占位符，再 Tab 进图标条（03-16「键盘聚焦顺序」）；只读不画手柄 */}
      <SelectionBox box={PH_LEFT} showRotate={false} handles={!readOnly} />
      {!readOnly && (
        <PlaceholderIconBar
          box={PH_LEFT}
          insetTop={PH_LEFT_PROMPT_H}
          kinds={["table", "picture", "chart", "video"]}
          focusKind={focus ? "chart" : undefined}
          reasonOpenKind={focus || collapsed ? "chart" : undefined}
          menuOpen={collapsed ? menuOpen : undefined}
          onMenuOpenChange={onMenuOpenChange}
          pickerOpen={picker}
          onPickerOpenChange={onPickerChange}
          pickers={{
            table: (close) => (
              <TableGridPicker
                initialHover={state === "placeholder-table-grid" ? { r: 3, c: 4 } : undefined}
                onPick={(r, c) => { close(); fillTable(r, c) }}
                onOpenDialog={() => { close(); phReturn.current = document.activeElement as HTMLElement | null; setPhDialog(true) }}
              />
            ),
          }}
          onPick={(k) => { if (k === "picture") toast("选择图片文件…（选定后填入此占位符，保留占位符位置）", fillToast) }}
        />
      )}
      <InsertTableDialog open={phDialog} onOpenChange={setPhDialog} onConfirm={fillTable} returnFocusRef={phReturn} />
      {drop ? (
        <>
          <CanvasElementBox box={PH_RIGHT} className="rounded-sm border-2 border-[#3A5CE6] bg-[#3A5CE6]/[0.06]" />
          <DropFeedback box={PH_RIGHT} />
        </>
      ) : (
        <>
          <CanvasElementBox box={PH_RIGHT} className="rounded-sm border border-dashed border-doc-ink/25" />
          {!readOnly && <PlaceholderIconBar box={PH_RIGHT} kinds={["picture"]} hint="单击图标添加图片" onPick={() => toast("选择图片文件…")} />}
        </>
      )}
    </>
  )
}

/**
 * 拖入图片时的落点反馈：目标框的描边与底色画在纸面（随占位符缩放），说明文字与跟随指针的拖动缩略图画在屏幕覆盖层，
 * 按屏幕尺寸绘制（拖动图像本来就是屏幕坐标；文字不小于 12 px）
 */
function DropFeedback({ box }: { box: Box }) {
  const toScreen = useToScreen()
  const s = toScreen(box)
  const ghost = toScreen({ x: box.x + box.w * 0.55, y: box.y + 264, w: 0, h: 0 })
  return (
    <CanvasOverlay>
      <div className="pointer-events-none absolute flex flex-col items-center justify-center gap-2 px-4 text-center text-[#2F4BC4]" style={{ left: s.x, top: s.y, width: s.w, height: s.h }}>
        <ImageDown className="size-8" strokeWidth={1.5} aria-hidden="true" />
        <span className="text-sm font-medium">松开以填入图片</span>
        <span className="text-xs text-balance text-[#1A2030]/60">按占位符框裁剪填满，换版式时随占位符移动</span>
      </div>
      <div className="pointer-events-none absolute z-10 flex items-end gap-1" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">
        <div className="h-[52px] w-[76px] -rotate-3 overflow-hidden rounded-md bg-gradient-to-br from-[#9EC5FF] via-[#6B93FF] to-[#3A5CE6] opacity-90 shadow-lg ring-2 ring-white" />
        <span className="mb-[-6px] rounded-full bg-[#3A5CE6] px-1.5 py-px text-2xs font-semibold text-white shadow">+ 1</span>
      </div>
    </CanvasOverlay>
  )
}

/** 幻灯片坐标（pt，960 = 13.333 in）→ 英寸，两位小数 */
const inch = (pt: number) => (pt / 72).toFixed(2)

/**
 * 「位置与大小」逐字段的来源：空占位符的框默认继承自版式；在本页移动或缩放过即为覆盖，可逐字段重置回版式值（50/10 §5；D-25）。
 * 样张：X、Y、宽继承；高在本页拉高过（版式值 4.96 in），显示「已覆盖 · 重置」。
 */
const PH_LEFT_FIELDS: { key: string; label: string; value: string; layoutValue?: string }[] = [
  { key: "x", label: "X", value: inch(PH_LEFT.x) },
  { key: "y", label: "Y", value: inch(PH_LEFT.y) },
  { key: "w", label: "宽", value: inch(PH_LEFT.w) },
  { key: "h", label: "高", value: inch(PH_LEFT.h), layoutValue: "4.96" },
]

/**
 * 空内容占位符的检查器（selectionKind: placeholder-empty，R-d-72）：三组——占位符（类型、索引、来自版式）· 位置与大小（逐字段继承 / 覆盖）
 * · 插入到占位符（与图标条同一组动作，过滤、禁用与原因同源）。只读角色不出「插入到占位符」组（50/10 §3.2）。
 */
function PlaceholderInspector({ readOnly }: { readOnly: boolean }) {
  return (
    <div className="cordex-well m-3 mt-2 flex flex-col gap-2.5 text-xs">
      <div className="cordex-group flex flex-col gap-2 p-3">
        <p className="font-semibold text-foreground/70">占位符</p>
        <div className="flex items-center gap-2"><span className="w-14 text-muted-foreground">类型</span><span>内容（obj）</span></div>
        <div className="flex items-center gap-2"><span className="w-14 text-muted-foreground">索引</span><span className="tabular-nums">1</span></div>
        <div className="flex items-center gap-2"><span className="w-14 text-muted-foreground">来自</span><span>版式「{PH_LAYOUT_NAME}」</span></div>
      </div>
      <div className="cordex-group flex flex-col gap-0.5 p-3">
        <p className="mb-1.5 font-semibold text-foreground/70">位置与大小</p>
        {PH_LEFT_FIELDS.map((f) => (
          <PropertyRow key={f.key} label={f.label}>
            <NumberField value={f.value} suffix="in" readOnly={readOnly} aria-label={`${f.label}（英寸）`} />
            <span className="flex w-[92px] shrink-0 items-center justify-end gap-1 whitespace-nowrap">
              {f.layoutValue ? (
                <>
                  <span className="text-primary">已覆盖</span>
                  {!readOnly && (
                    <>
                      <span className="text-muted-foreground" aria-hidden="true">·</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-0.5 rounded-full px-1 text-foreground/80 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`重置${f.label}为版式值 ${f.layoutValue} in`}
                            onClick={() => toast(`已重置${f.label}为版式值 ${f.layoutValue} in`, { action: { label: "撤销", onClick: () => toast.success("已撤销") } })}
                          >
                            <RotateCcw className="size-3" aria-hidden="true" />重置
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>重置为版式值 {f.layoutValue} in</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">继承自版式</span>
              )}
            </span>
          </PropertyRow>
        ))}
      </div>
      {!readOnly && (
        <div className="cordex-group flex flex-col gap-2 p-3">
          <p className="font-semibold text-foreground/70">插入到占位符</p>
          <div className="grid grid-cols-2 gap-1.5">
            {placeholderIcons.map((it) => {
              const st = placeholderItemState(it)
              const button = (
                <Button
                  key={it.kind}
                  variant="outline"
                  size="sm"
                  aria-label={st.ariaLabel}
                  aria-disabled={st.disabled || undefined}
                  onClick={(e) => { if (st.disabled) { e.preventDefault(); return } toast(`${it.aria}（演示）`) }}
                  className={st.disabled ? "h-7 cursor-not-allowed justify-start gap-1.5 px-2 text-xs font-normal hover:bg-transparent" : "h-7 justify-start gap-1.5 px-2 text-xs font-normal"}
                >
                  <span className={st.disabled ? "flex items-center gap-1.5 opacity-50" : "flex items-center gap-1.5"}><it.icon className="size-3.5" />{it.label}</span>
                  {it.milestone && <MilestoneTag className="ml-auto">{it.milestone}</MilestoneTag>}
                </Button>
              )
              if (!st.disabled) return button
              return (
                <Tooltip key={it.kind}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-60 text-pretty">{st.reason}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">也可以直接单击占位符输入文字；填入内容后删除，占位符会恢复为空。</p>
        </div>
      )}
    </div>
  )
}
