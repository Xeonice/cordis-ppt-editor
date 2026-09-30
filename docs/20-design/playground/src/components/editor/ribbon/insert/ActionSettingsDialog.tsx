import { useEffect, useState, type ComponentType } from "react"
import { Ban, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, GalleryVerticalEnd, History, Info, Link2, SquareX } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { slides } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { MilestoneTag } from "../primitives"
import { ShapeThumb, type ActionTarget, type ShapePreset } from "./shapes"

const targets: { v: ActionTarget; l: string; icon: ComponentType<{ className?: string }>; ooxml: string }[] = [
  { v: "none", l: "无动作", icon: Ban, ooxml: "（不写 hlinkClick）" },
  { v: "next", l: "下一张幻灯片", icon: ChevronRight, ooxml: "jump=nextslide" },
  { v: "prev", l: "上一张幻灯片", icon: ChevronLeft, ooxml: "jump=previousslide" },
  { v: "first", l: "第一张幻灯片", icon: ChevronsLeft, ooxml: "jump=firstslide" },
  { v: "last", l: "最后一张幻灯片", icon: ChevronsRight, ooxml: "jump=lastslide" },
  { v: "lastViewed", l: "最近观看的幻灯片", icon: History, ooxml: "jump=lastslideviewed" },
  { v: "end", l: "结束放映", icon: SquareX, ooxml: "jump=endshow" },
  { v: "slide", l: "指定幻灯片…", icon: GalleryVerticalEnd, ooxml: "hlinksldjump" },
  { v: "url", l: "网址（URL）…", icon: Link2, ooxml: "外部关系" },
]

/**
 * 动作按钮「操作设置」（rulings §4.21 R-d-77：插入动作按钮后自动弹出；插入 M2 P0，操作设置 M2 P1）。
 * 「单击鼠标」「鼠标悬停」两页签，悬停为 P2：页签在但禁用，tooltip 说明原因。跳转目标 9 项（含 R-d-77 补的最近观看、结束放映），
 * 两列单选；选「指定幻灯片」「网址」时在下方出现对应字段。插入与设置同一事务、一个撤销步（slide.insertShape + slide.setAction）。
 * 运行程序、宏、声音等动作不提供设置，导入文件里已有的原样保留。
 */
export function ActionSettingsDialog({ open, onOpenChange, shape }: { open: boolean; onOpenChange: (v: boolean) => void; shape?: ShapePreset }) {
  const [target, setTarget] = useState<ActionTarget>(shape?.defaultAction ?? "next")
  const [highlight, setHighlight] = useState(true)
  useEffect(() => { if (open) setTarget(shape?.defaultAction ?? "next") }, [open, shape])
  const label = shape?.name.replace("动作按钮：", "") ?? "前进或下一项"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 sm:max-w-[520px]" onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).focus() }}>
        <DialogHeader className="flex-row items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
            {shape && <ShapeThumb shape={shape} className="size-6" />}
          </span>
          <div className="flex flex-col gap-1">
            <DialogTitle>操作设置</DialogTitle>
            <DialogDescription>动作按钮「{label}」· 放映时生效，编辑时 ⌘ + 单击可预览</DialogDescription>
          </div>
        </DialogHeader>

        <Tabs defaultValue="click" className="gap-4">
          <TabsList className="w-full">
            <TabsTrigger value="click">单击鼠标</TabsTrigger>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="flex h-full flex-1 items-center justify-center gap-1.5 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <TabsTrigger value="hover" disabled className="flex-none">鼠标悬停</TabsTrigger>
                  <MilestoneTag>P2</MilestoneTag>
                </span>
              </TooltipTrigger>
              <TooltipContent>悬停触发的动作排在后续版本（P2）；导入文件里已有的悬停动作原样保留</TooltipContent>
            </Tooltip>
          </TabsList>
          <TabsContent value="click" className="flex flex-col gap-3">
            <p className="text-xs font-medium text-muted-foreground">单击时</p>
            <RadioGroup value={target} onValueChange={(v) => setTarget(v as ActionTarget)} className="grid grid-cols-2 gap-1 rounded-2xl bg-foreground/[0.03] p-1.5" aria-label="单击时">
              {targets.map((t) => (
                <Label
                  key={t.v}
                  htmlFor={`act-${t.v}`}
                  className={cn(
                    "flex h-8 cursor-pointer items-center gap-2 rounded-xl px-2.5 font-normal transition-colors hover:bg-background dark:hover:bg-foreground/10",
                    target === t.v && "bg-background shadow-sm ring-1 ring-foreground/10 dark:bg-foreground/10",
                    t.v === "none" && "col-span-2"
                  )}
                >
                  <RadioGroupItem value={t.v} id={`act-${t.v}`} />
                  <t.icon className="size-4 text-muted-foreground" />
                  {t.l}
                </Label>
              ))}
            </RadioGroup>
            {target === "slide" && (
              <Select defaultValue="sl-9">
                <SelectTrigger className="w-full" aria-label="目标幻灯片"><SelectValue /></SelectTrigger>
                <SelectContent>{slides.map((s) => <SelectItem key={s.id} value={s.id}>{`${s.index}. ${s.title}`}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {target === "url" && <Input placeholder="https://example.com" aria-label="网址" />}
            <div className="flex h-7 items-center gap-2">
              <Checkbox id="act-hl" checked={highlight} onCheckedChange={(v) => setHighlight(!!v)} />
              <Label htmlFor="act-hl" className="font-normal">单击时突出显示</Label>
            </div>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              运行程序、运行宏、播放声音不在此设置；导入文件里已有的会原样保留。
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={() => { onOpenChange(false); toast(`已设置单击动作 · ${targets.find((t) => t.v === target)!.l}`) }}>确定</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
