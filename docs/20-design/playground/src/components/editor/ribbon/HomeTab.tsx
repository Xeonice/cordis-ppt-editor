import { useState } from "react"
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Bold, ChevronDown, ClipboardPaste, Copy,
  Eraser, Highlighter, Indent, IndentDecrease, Italic, List, ListOrdered, Lock, MousePointer2, PaintBucket, Plus, Replace,
  Scissors, Search, Shapes, Strikethrough, Underline,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import type { LayoutDef } from "@/lib/mock-data"
import { ColorPickerPopover, ColorSwatch } from "../ColorPickerPopover"
import { LayoutGallery } from "../LayoutGallery"
import { RibbonGroup, RibbonBigButton, RibbonTextButton } from "./primitives"

const fontFamilies = ["系统 UI 字体", "微软雅黑", "宋体", "Geist"]
const fontSizes = ["10", "12", "14", "18", "24", "32", "44", "54"]

export function HomeTab({
  currentMasterId,
  currentLayoutId,
  onInsertSlide,
  onOpenFind,
  emphasize,
  restrictedFontName,
}: {
  currentMasterId: string
  currentLayoutId: string
  onInsertSlide?: (masterId: string, layout: LayoutDef) => void
  onOpenFind?: () => void
  /** /editor/text 路由用它把字体/段落分组视觉上突出，呼应该路由的演示重点 */
  emphasize?: "font" | "paragraph"
  /** 03-screens/13：文档含仅授权查看的内嵌字体时，字体下拉追加一个带锁形图标的条目，选择它不应用并提示原因 */
  restrictedFontName?: string
}) {
  const [bold, setBold] = useState(true)
  const [italic, setItalic] = useState(false)
  const [underline, setUnderline] = useState(false)
  const [align, setAlign] = useState("left")
  const [fontColor, setFontColor] = useState("#1A2030")
  const [fontFamily, setFontFamily] = useState(fontFamilies[0])

  return (
    <>
      <RibbonGroup label="剪贴板">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <RibbonBigButton icon={ClipboardPaste} label="粘贴" withCaret />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => toast("已粘贴（保留源格式）")}>保留源格式</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast("已粘贴（仅文本）")}>仅文本</DropdownMenuItem>
            <DropdownMenuItem disabled>作为图片</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex flex-col gap-1">
          <RibbonTextButton icon={Scissors} label="剪切" shortcut="⌘X" onClick={() => toast("已剪切", { action: { label: "撤销", onClick: () => toast.success("已撤销") } })} />
          <RibbonTextButton icon={Copy} label="复制" shortcut="⌘C" onClick={() => toast("已复制")} />
        </div>
      </RibbonGroup>

      <RibbonGroup label="幻灯片">
        <Popover>
          <PopoverTrigger asChild>
            <RibbonBigButton icon={Plus} label="新建" withCaret />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-96">
            <LayoutGallery
              mode="new"
              currentMasterId={currentMasterId}
              currentLayoutId={currentLayoutId}
              onSelect={(masterId, layout) => {
                onInsertSlide?.(masterId, layout)
                toast(`已新建幻灯片 · ${layout.name}`)
              }}
            />
          </PopoverContent>
        </Popover>
        <div className="flex flex-col gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 justify-start gap-1.5 px-1.5 text-xs font-normal">
                <Shapes className="size-3.5" /> 版式 <ChevronDown className="size-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-96">
              <LayoutGallery
                mode="change"
                currentMasterId={currentMasterId}
                currentLayoutId={currentLayoutId}
                onSelect={(_masterId, layout) => toast(`已更换版式 · ${layout.name}`)}
              />
            </PopoverContent>
          </Popover>
          <RibbonTextButton icon={Eraser} label="重置" onClick={() => toast("已重置占位符属性", { action: { label: "撤销", onClick: () => toast.success("已撤销") } })} />
        </div>
      </RibbonGroup>

      <RibbonGroup label="字体" className={emphasize === "font" ? "bg-accent/40" : undefined}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <Select
              value={fontFamily}
              onValueChange={(v) => {
                if (v === restrictedFontName) {
                  toast(`"${restrictedFontName}" 仅授权查看，不能用于新文字`)
                  return
                }
                setFontFamily(v)
              }}
            >
              <SelectTrigger size="sm" className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {fontFamilies.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                {restrictedFontName && (
                  <SelectItem value={restrictedFontName} className="text-muted-foreground" title="此字体仅授权查看，不能用于新文字">
                    <Lock className="size-3.5" aria-hidden="true" /> {restrictedFontName}
                    <span className="sr-only">（此字体仅授权查看，不能用于新文字）</span>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <Select defaultValue="18">
              <SelectTrigger size="sm" className="w-16"><SelectValue /></SelectTrigger>
              <SelectContent>{fontSizes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-0.5">
            <Toggle size="sm" aria-label="加粗" pressed={bold} onPressedChange={setBold}><Bold /></Toggle>
            <Toggle size="sm" aria-label="斜体" pressed={italic} onPressedChange={setItalic}><Italic /></Toggle>
            <Toggle size="sm" aria-label="下划线" pressed={underline} onPressedChange={setUnderline}><Underline /></Toggle>
            <Tooltip><TooltipTrigger asChild><Toggle size="sm" aria-label="删除线"><Strikethrough /></Toggle></TooltipTrigger><TooltipContent>删除线</TooltipContent></Tooltip>
            <ColorPickerPopover
              value={fontColor}
              onChange={(hex) => { setFontColor(hex); toast(`字体颜色已设为 ${hex}`) }}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label="字体颜色">
                  <span className="relative flex flex-col items-center">
                    <Baseline className="size-4" />
                    <span className="mt-0.5 h-[3px] w-3.5 rounded-full" style={{ backgroundColor: fontColor }} aria-hidden="true" />
                  </span>
                </Button>
              }
            />
            <Tooltip><TooltipTrigger asChild><Toggle size="sm" aria-label="突出显示"><Highlighter /></Toggle></TooltipTrigger><TooltipContent>突出显示颜色</TooltipContent></Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="清除格式" onClick={() => toast("已清除格式")}><Eraser /></Button>
              </TooltipTrigger>
              <TooltipContent>清除格式（不影响继承自母版的属性）</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup label="段落" className={emphasize === "paragraph" ? "bg-accent/40" : undefined}>
        <div className="flex flex-col gap-1">
          <ToggleGroup type="single" size="sm" variant="outline" value={align} onValueChange={(v) => v && setAlign(v)} aria-label="对齐方式">
            <ToggleGroupItem value="left" aria-label="左对齐"><AlignLeft /></ToggleGroupItem>
            <ToggleGroupItem value="center" aria-label="居中"><AlignCenter /></ToggleGroupItem>
            <ToggleGroupItem value="right" aria-label="右对齐"><AlignRight /></ToggleGroupItem>
            <ToggleGroupItem value="justify" aria-label="两端对齐"><AlignJustify /></ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center gap-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="项目符号"><List /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem>无</DropdownMenuItem>
                <DropdownMenuItem>● 实心圆点</DropdownMenuItem>
                <DropdownMenuItem>○ 空心圆点</DropdownMenuItem>
                <DropdownMenuItem>■ 方块</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>自定义…</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="编号"><ListOrdered /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem>1. 2. 3.</DropdownMenuItem>
                <DropdownMenuItem>a. b. c.</DropdownMenuItem>
                <DropdownMenuItem>I. II. III.</DropdownMenuItem>
                <DropdownMenuItem>一、二、三、</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="减少缩进"><IndentDecrease /></Button></TooltipTrigger><TooltipContent>减少缩进</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="增加缩进"><Indent /></Button></TooltipTrigger><TooltipContent>增加缩进</TooltipContent></Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 px-1.5 text-xs font-normal">行距 <ChevronDown className="size-3" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {["1.0", "1.15", "1.5", "2.0"].map((v) => <DropdownMenuItem key={v}>{v}</DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup label="绘图">
        <RibbonBigButton icon={Shapes} label="形状" withCaret onClick={() => toast("打开形状库（插入页签）")} />
        <div className="flex flex-col gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 justify-start gap-1.5 px-1.5 text-xs font-normal">
                <span className="flex size-3.5 flex-col items-center justify-between" aria-hidden="true">
                  <PaintBucket className="size-3" />
                  <span className="h-0.5 w-full rounded-full" style={{ backgroundColor: "#4A54E1" }} />
                </span>
                填充
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64">
              <div className="grid grid-cols-6 gap-1.5">
                {["#4A54E1", "#0E8A7A", "#D9480F", "#B45309", "#0B7FBF", "#1A2030"].map((hex) => (
                  <ColorSwatch key={hex} hex={hex} label={hex} onClick={() => toast(`填充色已设为 ${hex}`)} />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </RibbonGroup>

      <RibbonGroup label="编辑">
        <div className="flex flex-col gap-1">
          <RibbonTextButton icon={Search} label="查找" shortcut="⌘F" onClick={onOpenFind} />
          <RibbonTextButton icon={Replace} label="替换" shortcut="⌘H" onClick={onOpenFind} />
        </div>
        <RibbonTextButton icon={MousePointer2} label="选择" onClick={() => toast("已全选当前页对象")} />
      </RibbonGroup>
    </>
  )
}
