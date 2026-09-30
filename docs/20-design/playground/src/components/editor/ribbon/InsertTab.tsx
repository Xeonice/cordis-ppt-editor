import { useState } from "react"
import {
  AudioLines, Blocks, Calendar, Camera, ChartArea, ChartBar, ChartColumn, ChartLine, ChartPie, ChartScatter, GalleryHorizontalEnd, Hash,
  ImagePlus, Link2, MessageSquarePlus, Omega, PanelBottom, Shapes, Sticker, Table, Type, Upload, Video, Workflow,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ActionSettingsDialog } from "./insert/ActionSettingsDialog"
import { ignoreDesignBar } from "./insert/demo"
import { HeaderFooterDialog } from "./insert/HeaderFooterDialog"
import { IconPickerDialog } from "./insert/IconPickerDialog"
import { ShapeGallery } from "./insert/ShapeGallery"
import { findShape, type ShapePreset } from "./insert/shapes"
import { SymbolPanel } from "./insert/SymbolPanel"
import { MilestoneTag, RibbonBigButton, RibbonDisabledTextButton, RibbonGroup, RibbonTextButton } from "./primitives"

/** 插入页签里可被演示态受控打开的面板 */
export type InsertPanel = "shapes" | "icons" | "symbols" | "header-footer" | "action-settings" | "link"

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
}

const MEDIA_REASON = "视频、音频插入排在后续版本（P2）。文稿里已有的音视频照常查看、放映、移动和缩放。"

/**
 * Ribbon「插入」页签（03-screens/04、15；rulings §4.21 R-d-61 分组唯一化）：
 * 文本 / 形状 / 图像 / 表格 / 图表 / 链接与批注 / 插件，七组固定顺序，插件组排在内置组之后并带归属标识。
 * 节奏：大按钮 56×60、小控件 28、组内一列两行；里程碑标记用 MilestoneTag（图表 M3、视频 / 音频 P2），
 * P2 项禁用而不隐藏并用 tooltip 给原因。非目标（SmartArt、OLE、3D、墨迹、缩放定位、录屏）不出现入口（R-d-75）。
 */
export function InsertTab(props: InsertTabProps) {
  const { onAddComment, textEditing = false, activeTool, onPickShape, showMediaReason } = props
  const [innerPanel, setInnerPanel] = useState<InsertPanel | null>(null)
  const [pickedAction, setPickedAction] = useState<ShapePreset | undefined>(undefined)
  const panel = props.panel !== undefined ? props.panel : innerPanel
  const setPanel = (p: InsertPanel | null) => (props.onPanelChange ?? setInnerPanel)(p)
  const openIf = (p: InsertPanel) => (v: boolean) => setPanel(v ? p : null)
  const [linkType, setLinkType] = useState("url")
  const actionShape = pickedAction ?? findShape(props.actionShapeId ?? "actionButtonForwardNext")

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
          <RibbonTextButton
            icon={Calendar}
            label="日期和时间"
            hint={textEditing ? "在光标处插入日期字段" : "未在编辑文字：打开页眉和页脚，设置页脚里的日期"}
            onClick={() => (textEditing ? toast("已插入日期字段（自动更新）") : setPanel("header-footer"))}
          />
          <RibbonTextButton
            icon={Hash}
            label="幻灯片编号"
            hint={textEditing ? "在光标处插入页码字段" : "未在编辑文字：打开页眉和页脚，勾选幻灯片编号"}
            onClick={() => (textEditing ? toast("已插入幻灯片编号字段") : setPanel("header-footer"))}
          />
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
            <DropdownMenuItem disabled><Camera /> 屏幕截图 <MilestoneTag className="ml-auto">M4+</MilestoneTag></DropdownMenuItem>
            <DropdownMenuItem disabled><GalleryHorizontalEnd /> 相册 <MilestoneTag className="ml-auto">M4+</MilestoneTag></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex flex-col gap-1">
          <RibbonDisabledTextButton icon={Video} label="视频" tag={<MilestoneTag>P2</MilestoneTag>} reason={MEDIA_REASON} reasonOpen={showMediaReason} />
          <RibbonDisabledTextButton icon={AudioLines} label="音频" tag={<MilestoneTag>P2</MilestoneTag>} reason={MEDIA_REASON} />
        </div>
      </RibbonGroup>

      <RibbonGroup label="表格">
        <Popover>
          <PopoverTrigger asChild>
            <RibbonBigButton icon={Table} label="表格" withCaret />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto">
            <TableGridPicker onPick={(r, c) => toast(`已插入 ${r} × ${c} 表格`, { description: "M2 可编辑单元格文字；行列增删、合并与样式在 M3" })} />
          </PopoverContent>
        </Popover>
      </RibbonGroup>

      <RibbonGroup label="图表">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <RibbonBigButton icon={ChartColumn} label="图表" withCaret badge={<MilestoneTag>M3</MilestoneTag>} aria-label="图表（M3）" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
              <MilestoneTag>M3</MilestoneTag> 插入后自动打开数据面板
            </DropdownMenuLabel>
            {[
              { icon: ChartColumn, l: "柱形图", sub: "簇状 · 堆积 · 百分比" },
              { icon: ChartBar, l: "条形图", sub: "簇状 · 堆积 · 百分比" },
              { icon: ChartLine, l: "折线图", sub: "折线 · 堆积" },
              { icon: ChartPie, l: "饼图", sub: "" },
              { icon: ChartArea, l: "面积图", sub: "面积 · 堆积 · 百分比" },
              { icon: ChartScatter, l: "散点图", sub: "" },
            ].map((c) => (
              <DropdownMenuItem key={c.l} onSelect={() => toast(`已插入${c.l}（示例数据 4 类别 × 3 系列）`)}>
                <c.icon /> {c.l}
                {c.sub && <span className="ml-auto text-xs text-muted-foreground">{c.sub}</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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

/** 表格网格选择器：8 × 8 悬停网格（PRD ED-10 上限 10 × 8，超出用「插入表格…」输入）；键盘见 03-screens/04 */
function TableGridPicker({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const [hover, setHover] = useState({ r: 0, c: 0 })
  const rows = 8
  const cols = 8
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">插入表格</p>
      <div className="grid grid-cols-8 gap-1" onMouseLeave={() => setHover({ r: 0, c: 0 })}>
        {Array.from({ length: rows * cols }).map((_, i) => {
          const r = Math.floor(i / cols) + 1
          const c = (i % cols) + 1
          const active = r <= hover.r && c <= hover.c
          return (
            <button
              key={i}
              type="button"
              aria-label={`${r} 行 ${c} 列`}
              className={active ? "size-4 rounded-[2px] border border-primary bg-primary/70" : "size-4 rounded-[2px] border border-border bg-muted"}
              onMouseEnter={() => setHover({ r, c })}
              onClick={() => onPick(r, c)}
            />
          )
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground tabular-nums">{hover.r > 0 ? `${hover.r} × ${hover.c} 表格` : "移入选择表格尺寸"}</p>
      <Button variant="ghost" size="sm" className="h-7 justify-start px-2 text-xs font-normal" onClick={() => toast("插入表格：输入行列数（上限 10 × 8）")}>
        <Table className="size-3.5" /> 插入表格…
      </Button>
    </div>
  )
}
