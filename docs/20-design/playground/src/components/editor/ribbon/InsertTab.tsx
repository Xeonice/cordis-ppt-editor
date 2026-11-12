import { useRef, useState } from "react"
import {
  AudioLines, Blocks, Calendar, Camera, ChartColumn, GalleryHorizontalEnd, Hash,
  ImagePlus, Link2, MessageSquarePlus, Omega, PanelBottom, Shapes, Sigma, Sticker, Table, Type, Upload, Video, Workflow,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ChartKind, ChartSubtype } from "../elements/chart-model"
import { ChartTypeMenu } from "../elements/ChartTypeMenu"
import { ActionSettingsDialog } from "./insert/ActionSettingsDialog"
import { DateTimePicker, type DateTimeChoice } from "./insert/DateTimePicker"
import { ignoreDesignBar } from "./insert/demo"
import { HeaderFooterDialog } from "./insert/HeaderFooterDialog"
import { IconPickerDialog } from "./insert/IconPickerDialog"
import { InsertTableDialog } from "./insert/InsertTableDialog"
import { ShapeGallery } from "./insert/ShapeGallery"
import { findShape, type ShapePreset } from "./insert/shapes"
import { SymbolPanel } from "./insert/SymbolPanel"
import { TableGridPicker } from "./insert/TableGridPicker"
import { MilestoneTag, RibbonBigButton, RibbonDisabledTextButton, RibbonGroup, RibbonTextButton } from "./primitives"

/** 插入页签里可被演示态受控打开的面板 */
export type InsertPanel =
  | "shapes" | "icons" | "symbols" | "header-footer" | "action-settings" | "link" | "datetime" | "table" | "table-dialog" | "chart"

export interface InsertTabProps {
  onAddComment?: () => void
  /** 受控打开的面板（路由「演示状态」驱动）；缺省时用组件内部状态 */
  panel?: InsertPanel | null
  onPanelChange?: (panel: InsertPanel | null) => void
  /** 光标在文本里（文本编辑态）：「符号」可用；否则禁用并说明原因 */
  textEditing?: boolean
  /** 当前插入工具（形状 id）：「形状」按钮显示按下态，形状库里高亮该项 */
  activeTool?: string | null
  /** 从形状库选中形状后进入插入工具态；缺省时 toast 提示 */
  onPickShape?: (shape: ShapePreset) => void
  /** 「操作设置」对应的动作按钮（缺省：前进或下一项） */
  actionShapeId?: string
  /** 演示：强制展开「视频」禁用原因提示 */
  showMediaReason?: boolean
  /** 文本编辑态「日期和时间」选择器的插入回调（G-81）；缺省 toast */
  onInsertDate?: (c: DateTimeChoice) => void
  /** 表格网格的初始悬停（演示态直接画出「3 × 4 表格」） */
  tableHover?: { r: number; c: number }
  /** 表格网格或「插入表格…」对话框确定后的回调（同一条插入命令）；缺省 toast */
  onPickTable?: (rows: number, cols: number) => void
  /** 「插入表格…」对话框（panel="table-dialog"）打开时的初值；演示态可传超限值画出报错帧 */
  tableDialogDefaults?: { rows: string | number; cols: string | number }
  /** 图表 ▾ 菜单中展开子类型 flyout 的一类（演示态受控） */
  chartFlyout?: ChartKind | null
  /** 选中图表子类型回调；缺省 toast */
  onPickChart?: (s: ChartSubtype) => void
  /** M2 或图表编辑组件未装载时「图表 ▾」禁用的原因（D21 / 50/24 §3.3）；给出即禁用 */
  chartDisabledReason?: string
  /** 演示：强制展开图表禁用原因 */
  showChartReason?: boolean
}

const MEDIA_REASON = "视频、音频插入排在后续版本（P2）。文稿里已有的音视频照常查看、放映、移动和缩放。"
const FORMULA_REASON = "暂不支持插入公式（M4+）。文稿里已有的公式照常查看、放映、移动和缩放。"
const SCREENSHOT_REASON = "插入屏幕截图排在后续版本（M4+）。现在可以先用系统截图，再从「此设备…」上传。"
const ALBUM_REASON = "相册（多张图片每图一页）排在后续版本（M4+）。现在可以从「此设备…」逐张插入图片。"
const TABLE_M2_NOTE = "M2 可编辑单元格文字；行列增删、合并与样式在 M3"

/**
 * Ribbon「插入」页签（03-screens/04、15；rulings §4.21 R-d-61 分组唯一化）：
 * 文本 / 形状 / 图像 / 表格 / 图表 / 链接与批注 / 插件，七组固定顺序，插件组排在内置组之后并带归属标识。
 * 文本组末列是禁用的「公式」（M4+，50/10 §4：M4+ 条目同样禁用而不隐藏）；表格 ▾ 弹 8 行 × 10 列网格，「插入表格…」关掉网格再开对话框；
 * 图表 ▾ 与迷你工具条「更改类型 ▾」、占位符图表图标共用 ChartTypeMenu。
 * 节奏：大按钮 56×60、小控件 28、组内一列两行；里程碑标记用 MilestoneTag（图表 M3、视频 / 音频 P2），
 * P2 项禁用而不隐藏并用 tooltip 给原因。非目标（SmartArt、OLE、3D、墨迹、缩放定位、录屏）不出现入口（R-d-75）。
 */
export function InsertTab(props: InsertTabProps) {
  const { onAddComment, textEditing = false, activeTool, onPickShape, showMediaReason, chartDisabledReason, showChartReason } = props
  const [innerPanel, setInnerPanel] = useState<InsertPanel | null>(null)
  const [pickedAction, setPickedAction] = useState<ShapePreset | undefined>(undefined)
  const panel = props.panel !== undefined ? props.panel : innerPanel
  const setPanel = (p: InsertPanel | null) => (props.onPanelChange ?? setInnerPanel)(p)
  const openIf = (p: InsertPanel) => (v: boolean) => setPanel(v ? p : null)
  const [linkType, setLinkType] = useState("url")
  const actionShape = pickedAction ?? findShape(props.actionShapeId ?? "actionButtonForwardNext")
  /** 「插入表格…」对话框关闭后焦点回到「表格 ▾」 */
  const tableButtonRef = useRef<HTMLButtonElement>(null)

  function pickTable(r: number, c: number) {
    setPanel(null)
    if (props.onPickTable) props.onPickTable(r, c)
    else toast(`已插入 ${r} 行 × ${c} 列表格`, { description: TABLE_M2_NOTE })
  }

  function pickShape(shape: ShapePreset) {
    setPanel(null)
    if (onPickShape) return onPickShape(shape)
    if (shape.group === "actions") {
      setPickedAction(shape)
      setPanel("action-settings")
      return
    }
    toast(`插入工具 · ${shape.name}`, { description: "单击画布插入 1 in × 1 in，或拖出大小；Esc 取消" })
  }

  return (
    <>
      <RibbonGroup label="文本">
        <RibbonBigButton icon={Type} label="文本框" onClick={() => toast("已插入文本框，进入编辑态")} />
        <div className="flex flex-col gap-1">
          <RibbonTextButton icon={PanelBottom} label="页眉和页脚…" hint="页眉和页脚：日期、幻灯片编号、页脚文字" onClick={() => setPanel("header-footer")} />
          {textEditing ? (
            <Popover open={panel === "symbols"} onOpenChange={openIf("symbols")}>
              <PopoverTrigger asChild>
                <RibbonTextButton icon={Omega} label="符号" withCaret aria-pressed={panel === "symbols"} className={panel === "symbols" ? "bg-accent" : undefined} />
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[468px] gap-0 p-3" onInteractOutside={ignoreDesignBar} onOpenAutoFocus={(e) => e.preventDefault()}>
                <SymbolPanel onInsert={(ch) => toast(`已插入「${ch}」`)} />
              </PopoverContent>
            </Popover>
          ) : (
            <RibbonDisabledTextButton icon={Omega} label="符号" reason="先在文本框里放置光标，再插入符号" />
          )}
        </div>
        {/* 日期和时间 / 幻灯片编号（50/20 §3、50/21 §4；ED-31 M2 P2）：文本编辑态直接插字段，否则打开页眉和页脚面板 */}
        <div className="flex flex-col gap-1">
          {textEditing ? (
            <Popover open={panel === "datetime"} onOpenChange={openIf("datetime")}>
              <PopoverTrigger asChild>
                <RibbonTextButton icon={Calendar} label="日期和时间" withCaret aria-pressed={panel === "datetime"} className={panel === "datetime" ? "bg-accent" : undefined} />
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[332px] gap-0 p-3" onInteractOutside={ignoreDesignBar} onOpenAutoFocus={(e) => e.preventDefault()}>
                <DateTimePicker
                  onCancel={() => setPanel(null)}
                  onInsert={(c) => {
                    setPanel(null)
                    if (props.onInsertDate) props.onInsertDate(c)
                    else toast(c.autoUpdate ? `已插入日期字段「${c.text}」` : `已插入文本「${c.text}」`, { action: { label: "撤销", onClick: () => toast.success("已撤销") } })
                  }}
                />
              </PopoverContent>
            </Popover>
          ) : (
            <RibbonTextButton
              icon={Calendar}
              label="日期和时间"
              hint="未在编辑文字：打开页眉和页脚，设置页脚里的日期"
              onClick={() => setPanel("header-footer")}
            />
          )}
          <RibbonTextButton
            icon={Hash}
            label="幻灯片编号"
            hint={textEditing ? "在光标处插入页码字段" : "未在编辑文字：打开页眉和页脚，勾选幻灯片编号"}
            onClick={() => (textEditing ? toast("已插入幻灯片编号字段") : setPanel("header-footer"))}
          />
        </div>
        {/* 公式（M4+，q-equation）：禁用而不隐藏，占一列两行的上一行，与左侧两列顶端对齐 */}
        <div className="flex h-[60px] flex-col gap-1">
          <RibbonDisabledTextButton icon={Sigma} label="公式" tag={<MilestoneTag>M4+</MilestoneTag>} reason={FORMULA_REASON} />
        </div>
      </RibbonGroup>

      <RibbonGroup label="形状">
        <Popover open={panel === "shapes"} onOpenChange={openIf("shapes")}>
          <PopoverTrigger asChild>
            <RibbonBigButton icon={Shapes} label="形状" withCaret pressed={!!activeTool || panel === "shapes"} />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto gap-0 p-3" onInteractOutside={ignoreDesignBar} onOpenAutoFocus={(e) => e.preventDefault()}>
            <ShapeGallery onPick={pickShape} activeId={activeTool} />
          </PopoverContent>
        </Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <RibbonBigButton icon={Sticker} label="图标" onClick={() => setPanel("icons")} />
          </TooltipTrigger>
          <TooltipContent>插入图标（M3）：线性图标，插入后可改色</TooltipContent>
        </Tooltip>
      </RibbonGroup>

      <RibbonGroup label="图像">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <RibbonBigButton icon={ImagePlus} label="图片" withCaret />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem onSelect={() => { const id = toast.loading("正在上传图片…"); window.setTimeout(() => toast.success("图片上传完成", { id }), 1200) }}>
              <Upload /> 此设备…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast("来自 URL：下载后内嵌，不保留外链")}><Link2 /> 来自 URL…</DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* 禁用而不隐藏（FE-06）：aria-disabled，仍可聚焦、方向键可达，tooltip 给原因；同占位符「插入 ▾」与表格右键菜单的写法 */}
            {([[Camera, "屏幕截图", SCREENSHOT_REASON], [GalleryHorizontalEnd, "相册", ALBUM_REASON]] as const).map(([Icon, label, reason]) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <DropdownMenuItem aria-disabled="true" aria-label={`${label}（M4+）`} onSelect={(e) => e.preventDefault()} className="cursor-not-allowed">
                    <span className="flex items-center gap-2 opacity-50"><Icon className="size-4" />{label}</span>
                    <MilestoneTag className="ml-auto">M4+</MilestoneTag>
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-60 text-pretty">{reason}</TooltipContent>
              </Tooltip>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex flex-col gap-1">
          <RibbonDisabledTextButton icon={Video} label="视频" tag={<MilestoneTag>P2</MilestoneTag>} reason={MEDIA_REASON} reasonOpen={showMediaReason} />
          <RibbonDisabledTextButton icon={AudioLines} label="音频" tag={<MilestoneTag>P2</MilestoneTag>} reason={MEDIA_REASON} />
        </div>
      </RibbonGroup>

      <RibbonGroup label="表格">
        <Popover open={panel === "table"} onOpenChange={openIf("table")}>
          <PopoverTrigger asChild>
            <RibbonBigButton ref={tableButtonRef} icon={Table} label="表格" withCaret pressed={panel === "table"} />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto" onInteractOutside={ignoreDesignBar} onOpenAutoFocus={(e) => e.preventDefault()}>
            <TableGridPicker initialHover={props.tableHover} onPick={pickTable} onOpenDialog={() => setPanel("table-dialog")} />
          </PopoverContent>
        </Popover>
      </RibbonGroup>

      <RibbonGroup label="图表">
        {chartDisabledReason ? (
          <Tooltip open={showChartReason || undefined}>
            <TooltipTrigger asChild>
              <RibbonBigButton
                icon={ChartColumn}
                label="图表"
                withCaret
                badge={<MilestoneTag>M3</MilestoneTag>}
                aria-label="图表（M3）"
                aria-disabled="true"
                onClick={(e) => e.preventDefault()}
                className="cursor-not-allowed hover:bg-transparent [&>span:not(:last-child)]:opacity-50"
              />
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="max-w-64 text-pretty">{chartDisabledReason}</TooltipContent>
          </Tooltip>
        ) : (
          <ChartTypeMenu
            open={panel === "chart"}
            onOpenChange={openIf("chart")}
            flyout={props.chartFlyout ?? null}
            onPick={(st) => {
              setPanel(null)
              if (props.onPickChart) props.onPickChart(st)
              else toast(`已插入${st.name}（示例数据 4 类别 × 3 系列）`)
            }}
            trigger={<RibbonBigButton icon={ChartColumn} label="图表" withCaret badge={<MilestoneTag>M3</MilestoneTag>} aria-label="图表（M3）" pressed={panel === "chart"} />}
          />
        )}
      </RibbonGroup>

      <RibbonGroup label="链接与批注">
        <div className="flex flex-col gap-1">
          <RibbonTextButton icon={Link2} label="超链接…" shortcut="⌘K" onClick={() => setPanel("link")} />
          <RibbonTextButton icon={MessageSquarePlus} label="批注" onClick={onAddComment ?? (() => toast("选中一个对象后可添加批注"))} />
        </div>
      </RibbonGroup>

      <RibbonGroup label={<span className="inline-flex items-center gap-1"><Blocks className="size-3" />流程图插件</span>} ariaLabel="流程图插件（第三方）">
        <RibbonBigButton icon={Workflow} label="流程图" onClick={() => toast("已插入流程图节点（插件：ACME）")} />
      </RibbonGroup>

      <HeaderFooterDialog open={panel === "header-footer"} onOpenChange={openIf("header-footer")} />
      <InsertTableDialog
        open={panel === "table-dialog"}
        onOpenChange={openIf("table-dialog")}
        defaults={props.tableDialogDefaults}
        onConfirm={pickTable}
        returnFocusRef={tableButtonRef}
      />
      <IconPickerDialog open={panel === "icons"} onOpenChange={openIf("icons")} />
      <ActionSettingsDialog open={panel === "action-settings"} onOpenChange={openIf("action-settings")} shape={actionShape} />
      <LinkDialog open={panel === "link"} onOpenChange={openIf("link")} linkType={linkType} onLinkTypeChange={setLinkType} />
    </>
  )
}

/** 插入 › 链接 › 超链接…（Mod+K；R-d-67 定为 M2 P1）：网页 URL / 本文稿中的页 / 显示文字 / 移除 */
function LinkDialog({ open, onOpenChange, linkType, onLinkTypeChange }: { open: boolean; onOpenChange: (v: boolean) => void; linkType: string; onLinkTypeChange: (v: string) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>插入超链接</DialogTitle>
          <DialogDescription>仅支持 http/https/mailto/tel 协议。</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <RadioGroup value={linkType} onValueChange={onLinkTypeChange} className="flex gap-4">
            <div className="flex items-center gap-2"><RadioGroupItem value="url" id="link-url" /><FieldLabel htmlFor="link-url" className="text-sm font-normal">网页 URL</FieldLabel></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="slide" id="link-slide" /><FieldLabel htmlFor="link-slide" className="text-sm font-normal">本文稿中的页</FieldLabel></div>
          </RadioGroup>
          {linkType === "url" ? (
            <Field>
              <FieldLabel htmlFor="link-addr">地址</FieldLabel>
              <Input id="link-addr" placeholder="https://example.com" defaultValue="https://example.com" />
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor="link-slide-select">目标页</FieldLabel>
              <Input id="link-slide-select" placeholder="第 3 页 · 收入结构" readOnly />
              <FieldDescription>点击选择本文稿中的目标页</FieldDescription>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="link-text">显示文字</FieldLabel>
            <Input id="link-text" defaultValue="季度业绩汇报" />
          </Field>
        </div>
        <DialogFooter>
          <Badge variant="outline" className="mr-auto self-center text-muted-foreground">移除链接</Badge>
          <Button onClick={() => { onOpenChange(false); toast("已插入超链接") }}>确定</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
