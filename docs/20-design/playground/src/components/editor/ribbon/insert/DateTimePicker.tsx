import { useState } from "react"
import { Check, Languages } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { DATETIME_LANGS, DEFAULT_DATETIME_LANG, datetimeFormatsFor, findDatetimeFormat } from "./datetime-formats"

export interface DateTimeChoice {
  lang: string
  code: string
  text: string
  autoUpdate: boolean
}

/**
 * 文本编辑态 › 插入 › 日期和时间（G-81；50/20 §3 ③；ED-31 M2 P2）：与 PowerPoint「日期和时间」对话框同构的小型选择器。
 * 语言默认取当前 run 的 lang，列表按该语言预览可用格式（与「页眉和页脚」对话框共用 datetime-formats 一张表）；
 * 勾选「自动更新」插入日期字段（datetimeN），不勾选插入普通文本。
 * 默认格式为该语言的第一种（datetime1）；一个事务、一个撤销步（slide.insertField / slide.insertText）。
 */
export function DateTimePicker({ onInsert, onCancel, defaultLang = DEFAULT_DATETIME_LANG }: { onInsert: (c: DateTimeChoice) => void; onCancel: () => void; defaultLang?: string }) {
  const [lang, setLang] = useState(defaultLang)
  const [code, setCode] = useState(() => datetimeFormatsFor(defaultLang)[0]!.code)
  const [auto, setAuto] = useState(true)
  const list = datetimeFormatsFor(lang)
  const current = findDatetimeFormat(lang, code)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold">日期和时间</p>
          <p className="text-xs text-muted-foreground">插入到光标处，字体字号随所在段落</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="dt-lang" className="flex w-12 shrink-0 items-center gap-1 text-xs font-normal text-muted-foreground"><Languages className="size-3.5" />语言</Label>
        <Select value={lang} onValueChange={setLang}>
          <SelectTrigger id="dt-lang" size="sm" className="h-7 flex-1 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DATETIME_LANGS.map((l) => <SelectItem key={l.v} value={l.v}>{l.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div role="listbox" aria-label="可用格式" className="cordex-group max-h-[236px] overflow-y-auto p-1">
        {list.map((f) => {
          const on = f.code === current.code
          return (
            <button
              key={f.code}
              type="button"
              role="option"
              aria-selected={on}
              onClick={() => setCode(f.code)}
              onDoubleClick={() => onInsert({ lang, code: f.code, text: f.text, autoUpdate: auto })}
              className={cn(
                "flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-xs outline-none",
                "hover:bg-foreground/[0.05] focus-visible:ring-2 focus-visible:ring-ring",
                on && "bg-primary/10 font-medium text-foreground hover:bg-primary/12"
              )}
            >
              <span className="min-w-0 flex-1 truncate tabular-nums">{f.text}</span>
              {on && <Check className="size-3.5 shrink-0 text-primary" />}
            </button>
          )
        })}
      </div>

      <label className="flex items-start gap-2">
        <Checkbox checked={auto} onCheckedChange={(v) => setAuto(!!v)} className="mt-0.5" />
        <span className="flex flex-col gap-0.5">
          <span className="text-xs font-medium">自动更新</span>
          <span className="text-2xs text-muted-foreground">{auto ? "插入为日期字段：这里显示插入当天的日期，在 PowerPoint 中打开时自动更新" : "插入为固定文本，之后不会变化"}</span>
        </span>
      </label>

      <div className="flex items-center gap-2 border-t border-foreground/[0.06] pt-3">
        <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">
          将插入 <span className={cn("rounded px-1 py-px text-foreground", auto && "bg-foreground/[0.07]")}>{current.text}</span>
        </span>
        <Button variant="ghost" size="sm" className="h-7" onClick={onCancel}>取消</Button>
        <Button size="sm" className="h-7" onClick={() => onInsert({ lang, code: current.code, text: current.text, autoUpdate: auto })}>插入</Button>
      </div>
    </div>
  )
}
