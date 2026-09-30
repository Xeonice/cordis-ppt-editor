import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { DATETIME_LANGS, DEFAULT_DATETIME_LANG, datetimeFormatsFor, findDatetimeFormat } from "./datetime-formats"

/**
 * 插入 › 文本 › 页眉和页脚…（rulings §4.21 R-d-70：M2 P2，命令 slide.setHeaderFooter；母版侧复选 M3）。
 * 日期和时间（自动：格式 + 语言，列所选语言的 13 种 datetimeN，与文本编辑态「日期和时间」选择器共用 datetime-formats 一张表，
 * 存格式编码而非下标，默认第一种；固定：文本）· 幻灯片编号 · 页脚文字 · 标题幻灯片中不显示；
 * 右侧预览标出三个页脚族占位符的位置（启用 = 实线主色、关闭 = 虚线）；「应用」只作用于所选页，「全部应用」作用于全部页，
 * 一个事务、一个撤销步。页脚族占位符按确定性 id 生成（R-d-70）。
 */
export function HeaderFooterDialog({ open, onOpenChange, selectedCount = 1, totalCount = 12 }: { open: boolean; onOpenChange: (v: boolean) => void; selectedCount?: number; totalCount?: number }) {
  const [dateOn, setDateOn] = useState(true)
  const [mode, setMode] = useState("auto")
  const [lang, setLang] = useState(DEFAULT_DATETIME_LANG)
  const [code, setCode] = useState(() => datetimeFormatsFor(DEFAULT_DATETIME_LANG)[0]!.code)
  const [fixed, setFixed] = useState(() => datetimeFormatsFor(DEFAULT_DATETIME_LANG)[0]!.text)
  const [numOn, setNumOn] = useState(true)
  const [footOn, setFootOn] = useState(true)
  const [foot, setFoot] = useState("2026年Q2业绩汇报 · 内部资料")
  const [hideTitle, setHideTitle] = useState(true)
  const formats = datetimeFormatsFor(lang)
  const current = findDatetimeFormat(lang, code)
  const apply = (all: boolean) => {
    onOpenChange(false)
    toast(`已更新${all ? `全部 ${totalCount} 页` : `所选 ${selectedCount} 页`}的页眉和页脚`, { action: { label: "撤销", onClick: () => toast.success("已撤销") } })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 sm:max-w-[640px]" onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).focus() }}>
        <DialogHeader>
          <DialogTitle>页眉和页脚</DialogTitle>
          <DialogDescription>给幻灯片加日期、编号和页脚文字，内容写入版式上的页脚占位符。</DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 gap-5">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <CheckRow id="hf-date" label="日期和时间" checked={dateOn} onChange={setDateOn} />
            <RadioGroup value={mode} onValueChange={setMode} disabled={!dateOn} className={cn("-mt-1 flex flex-col gap-2 pl-6", !dateOn && "opacity-50")}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="auto" id="hf-auto" />
                <Label htmlFor="hf-auto" className="w-16 shrink-0 font-normal">自动更新</Label>
                <Select value={current.code} onValueChange={setCode} disabled={!dateOn || mode !== "auto"}>
                  <SelectTrigger className="min-w-0 flex-1" aria-label="日期格式"><SelectValue /></SelectTrigger>
                  <SelectContent>{formats.map((f) => <SelectItem key={f.code} value={f.code}>{f.text}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={lang} onValueChange={setLang} disabled={!dateOn || mode !== "auto"}>
                  <SelectTrigger className="w-32 shrink-0" aria-label="日期语言"><SelectValue /></SelectTrigger>
                  <SelectContent>{DATETIME_LANGS.map((x) => <SelectItem key={x.v} value={x.v}>{x.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="fixed" id="hf-fixed" />
                <Label htmlFor="hf-fixed" className="w-16 shrink-0 font-normal">固定</Label>
                <Input value={fixed} onChange={(e) => setFixed(e.target.value)} disabled={!dateOn || mode !== "fixed"} aria-label="固定日期文本" className="min-w-0 flex-1" />
              </div>
            </RadioGroup>
            <CheckRow id="hf-num" label="幻灯片编号" checked={numOn} onChange={setNumOn} />
            <CheckRow id="hf-foot" label="页脚" checked={footOn} onChange={setFootOn} />
            <div className="-mt-1 pl-6">
              <Input value={foot} onChange={(e) => setFoot(e.target.value)} disabled={!footOn} aria-label="页脚文字" placeholder="输入页脚文字" />
            </div>
            <div className="mt-1 border-t border-foreground/5 pt-3">
              <CheckRow id="hf-title" label="标题幻灯片中不显示" checked={hideTitle} onChange={setHideTitle} />
            </div>
          </div>

          <figure className="flex w-40 shrink-0 flex-col gap-2">
            <figcaption className="text-xs font-medium text-muted-foreground">预览</figcaption>
            <div className="relative aspect-video w-full overflow-hidden rounded-md bg-doc-paper shadow-sm ring-1 ring-foreground/10" aria-hidden="true">
              <span className="absolute top-[16%] left-[8%] h-[9%] w-[58%] rounded-sm bg-doc-ink/70" />
              <span className="absolute top-[36%] left-[8%] h-[5%] w-[78%] rounded-sm bg-doc-ink/15" />
              <span className="absolute top-[46%] left-[8%] h-[5%] w-[70%] rounded-sm bg-doc-ink/15" />
              <span className="absolute top-[56%] left-[8%] h-[5%] w-[74%] rounded-sm bg-doc-ink/15" />
              <PreviewSlot on={dateOn} className="left-[5%] w-[24%]" />
              <PreviewSlot on={footOn} className="left-[33%] w-[34%]" />
              <PreviewSlot on={numOn} className="right-[5%] w-[12%]" />
            </div>
            <p className="text-2xs leading-4 text-muted-foreground">
              {[dateOn && (mode === "auto" ? current.text : fixed), footOn && foot, numOn && "4"].filter(Boolean).join(" · ") || "不显示页脚"}
            </p>
          </figure>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">应用：所选 {selectedCount} 页 · 全部应用：{totalCount} 页</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
            <Button variant="outline" onClick={() => apply(false)}>应用</Button>
            <Button onClick={() => apply(true)}>全部应用</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CheckRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex h-7 items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      <Label htmlFor={id} className="font-normal">{label}</Label>
    </div>
  )
}

function PreviewSlot({ on, className }: { on: boolean; className: string }) {
  return (
    <span
      className={cn(
        "absolute bottom-[6%] h-[9%] rounded-[2px]",
        on ? "border border-primary bg-primary/20" : "border border-dashed border-doc-ink/25",
        className
      )}
    />
  )
}
