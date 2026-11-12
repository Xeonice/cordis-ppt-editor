import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { themePresets, type ThemeColorSlot } from "@/lib/mock-data"

const fontChoices = ["系统 UI 字体", "微软雅黑", "宋体", "Geist"]

/**
 * 03-screens/28 §2：主题编辑面板（颜色/字体 Tab）。规格上位于检查器坞位置，
 * 这里做成独立组件：/editor/design 直接把它常驻在检查器坞位置；
 * 其余路由的 Ribbon"设计"页签"颜色▾/字体▾"以 Popover 承载同一份组件。
 * 裁决 2026-09-18 §4.10 Q17：去掉了另存主题入口，底部仅保留 取消 / 应用。
 */
export function ThemeEditorPanel({
  themeId = "office",
  defaultTab = "color",
  onApply,
  onCancel,
}: {
  themeId?: string
  defaultTab?: "color" | "font"
  onApply?: () => void
  onCancel?: () => void
}) {
  const theme = themePresets.find((t) => t.id === themeId) ?? themePresets[0]!
  const [tab, setTab] = useState<string>(defaultTab)
  const [selected, setSelected] = useState<ThemeColorSlot>(theme.colors[4]!)
  const [headingFont, setHeadingFont] = useState(theme.headingFont)
  const [bodyFont, setBodyFont] = useState(theme.bodyFont)

  return (
    <div className="flex flex-col gap-3">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="color" className="flex-1">颜色</TabsTrigger>
          <TabsTrigger value="font" className="flex-1">字体</TabsTrigger>
        </TabsList>
        <TabsContent value="color" className="flex flex-col gap-3 pt-3">
          <div className="grid grid-cols-2 gap-2">
            {theme.colors.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setSelected(c)}
                aria-pressed={selected.key === c.key}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs outline-none transition-colors hover:border-ring focus-visible:ring-2 focus-visible:ring-ring",
                  selected.key === c.key && "border-primary ring-1 ring-primary"
                )}
              >
                <span className="size-4 shrink-0 rounded-sm border border-input" style={{ backgroundColor: c.hex }} aria-hidden="true" />
                <span className="truncate">{c.label}</span>
              </button>
            ))}
          </div>
          <Field>
            <FieldLabel htmlFor="theme-color-hex">{selected.label} · Hex</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <span className="size-3.5 shrink-0 rounded-full border border-input" style={{ backgroundColor: selected.hex }} aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput id="theme-color-hex" defaultValue={selected.hex} className="font-mono" />
            </InputGroup>
          </Field>
        </TabsContent>
        <TabsContent value="font" className="flex flex-col gap-4 pt-3">
          <Field>
            <FieldLabel htmlFor="theme-heading-font">标题字体</FieldLabel>
            <Select value={headingFont} onValueChange={setHeadingFont}>
              <SelectTrigger id="theme-heading-font" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{fontChoices.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
            <div className="rounded-md border bg-muted/40 p-3 text-xl font-semibold">AaBb 标题示例 123</div>
          </Field>
          <Field>
            <FieldLabel htmlFor="theme-body-font">正文字体</FieldLabel>
            <Select value={bodyFont} onValueChange={setBodyFont}>
              <SelectTrigger id="theme-body-font" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{fontChoices.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
            <div className="rounded-md border bg-muted/40 p-3 text-sm">AaBb 正文示例 123</div>
          </Field>
          <FieldDescription>仅影响文档内容字体映射（+mj-lt/+mn-lt），不影响编辑器界面本身字号。</FieldDescription>
        </TabsContent>
      </Tabs>
      <Separator />
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
        <Button size="sm" onClick={onApply ?? (() => toast("主题已应用", { description: "影响该主题下全部母版、版式与页面" }))}>应用</Button>
      </div>
    </div>
  )
}
