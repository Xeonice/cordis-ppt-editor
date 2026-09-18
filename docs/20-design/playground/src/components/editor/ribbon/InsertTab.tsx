import { useState, type ComponentType } from "react"
import {
  ArrowLeftRight, ArrowRight, Blocks, ChartColumn, ChartLine, ChartPie, Circle, CornerUpRight, Diamond,
  Flag, Hexagon, ImagePlus, Link2, Minus, MessageSquarePlus, Octagon, Pentagon, Play, RectangleHorizontal,
  Slash, Square, Star, Table, Triangle, Type, Workflow,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { RibbonBigButton, RibbonGroup, RibbonTextButton } from "./primitives"

const shapeCategories: { name: string; items: { icon: ComponentType<{ className?: string }>; name: string }[] }[] = [
  { name: "最近使用", items: [{ icon: Square, name: "矩形" }, { icon: Circle, name: "椭圆" }, { icon: ArrowRight, name: "箭头" }] },
  { name: "线条", items: [{ icon: Slash, name: "直线" }, { icon: Minus, name: "水平线" }, { icon: CornerUpRight, name: "折线" }] },
  { name: "矩形", items: [{ icon: Square, name: "矩形" }, { icon: RectangleHorizontal, name: "圆角矩形" }] },
  { name: "基本形状", items: [{ icon: Circle, name: "椭圆" }, { icon: Triangle, name: "三角形" }, { icon: Diamond, name: "菱形" }, { icon: Pentagon, name: "五边形" }, { icon: Hexagon, name: "六边形" }, { icon: Octagon, name: "八边形" }] },
  { name: "箭头", items: [{ icon: ArrowRight, name: "右箭头" }, { icon: ArrowLeftRight, name: "双向箭头" }, { icon: CornerUpRight, name: "肘形箭头" }] },
  { name: "星与旗帜", items: [{ icon: Star, name: "五角星" }, { icon: Flag, name: "旗帜" }] },
  { name: "动作按钮", items: [{ icon: Play, name: "播放" }] },
]

export function InsertTab({ onAddComment }: { onAddComment?: () => void }) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkType, setLinkType] = useState("url")

  return (
    <>
      <RibbonGroup label="文本">
        <RibbonBigButton icon={Type} label="文本框" onClick={() => toast("已插入文本框，进入编辑态")} />
      </RibbonGroup>

      <RibbonGroup label="形状">
        <Popover>
          <PopoverTrigger asChild>
            <RibbonBigButton icon={Square} label="形状" withCaret />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72">
            <div className="flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
              {shapeCategories.map((cat) => (
                <div key={cat.name}>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">{cat.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.items.map((it) => (
                      <Tooltip key={it.name}>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            aria-label={it.name}
                            onClick={() => toast(`已插入形状 · ${it.name}`)}
                          >
                            <it.icon />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{it.name}</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </RibbonGroup>

      <RibbonGroup label="图像">
        <RibbonBigButton
          icon={ImagePlus}
          label="图片"
          onClick={() => {
            const id = toast.loading("正在上传图片…")
            window.setTimeout(() => toast.success("图片上传完成", { id }), 1200)
          }}
        />
      </RibbonGroup>

      <RibbonGroup label="表格">
        <Popover>
          <PopoverTrigger asChild>
            <RibbonBigButton icon={Table} label="表格" withCaret />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto">
            <TableGridPicker onPick={(r, c) => toast(`已插入 ${r} × ${c} 表格`)} />
          </PopoverContent>
        </Popover>
      </RibbonGroup>

      <RibbonGroup label="图表">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <RibbonBigButton icon={ChartColumn} label="图表" withCaret />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => toast("已插入柱状图")}><ChartColumn /> 柱状图</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast("已插入折线图")}><ChartLine /> 折线图</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast("已插入饼图")}><ChartPie /> 饼图</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </RibbonGroup>

      <RibbonGroup label="链接与批注">
        <div className="flex flex-col gap-1">
          <RibbonTextButton icon={Link2} label="超链接…" shortcut="⌘K" onClick={() => setLinkOpen(true)} />
          <RibbonTextButton icon={MessageSquarePlus} label="批注" onClick={onAddComment ?? (() => toast("选中一个对象后可添加批注"))} />
        </div>
      </RibbonGroup>

      <RibbonGroup label={<span className="inline-flex items-center gap-1"><Blocks className="size-3" />流程图插件</span>} ariaLabel="流程图插件（第三方）">
        <RibbonBigButton icon={Workflow} label="流程图" onClick={() => toast("已插入流程图节点（插件：ACME）")} />
      </RibbonGroup>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>插入超链接</DialogTitle>
            <DialogDescription>仅支持 http/https/mailto/tel 协议。</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <RadioGroup value={linkType} onValueChange={setLinkType} className="flex gap-4">
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
            <Button onClick={() => { setLinkOpen(false); toast("已插入超链接") }}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

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
    </div>
  )
}
