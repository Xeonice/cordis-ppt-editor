import { useState, type ReactNode } from "react"
import { Field, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { recentColors, standardColors, themePresets } from "@/lib/mock-data"

/**
 * C-22 ColorSwatch：20×20 圆角 4，1px border-control，内部色块留 1px 白边。
 * 色值来自文档主题/用户输入等运行时数据，Tailwind 无法为任意 hex 静态生成类名，
 * 因此这里的色块填充是 09 §6.2"唯一例外"原则在颜色选择器场景的必要延伸：
 * 仅 backgroundColor 这一处使用 style，其余尺寸/圆角/边框仍全部走 Tailwind 类。
 */
export function ColorSwatch({
  hex,
  selected,
  label,
  onClick,
  className,
}: {
  hex: string
  selected?: boolean
  label: string
  onClick?: () => void
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={selected}
          className={cn(
            "size-5 shrink-0 rounded-[4px] border border-input p-[2px] transition-shadow hover:border-ring",
            selected && "ring-2 ring-ring ring-offset-1 ring-offset-background",
            className
          )}
        >
          <span className="block size-full rounded-[2px] border border-white/70 dark:border-black/40" style={{ backgroundColor: hex }} />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {label} · {hex}
      </TooltipContent>
    </Tooltip>
  )
}

export function ColorPickerPopover({
  trigger,
  value,
  onChange,
  themeId = "office",
  align = "start",
}: {
  trigger: ReactNode
  value?: string
  onChange?: (hex: string) => void
  themeId?: string
  align?: "start" | "center" | "end"
}) {
  const [custom, setCustom] = useState(value ?? "#4A54E1")
  const theme = themePresets.find((t) => t.id === themeId) ?? themePresets[0]!

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-64">
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">主题颜色</p>
            <div className="grid grid-cols-6 gap-1.5">
              {theme.colors.map((c) => (
                <ColorSwatch key={c.key} hex={c.hex} label={c.label} selected={value === c.hex} onClick={() => onChange?.(c.hex)} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">标准色</p>
            <div className="grid grid-cols-6 gap-1.5">
              {standardColors.map((hex) => (
                <ColorSwatch key={hex} hex={hex} label={hex} selected={value === hex} onClick={() => onChange?.(hex)} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">最近使用</p>
            <div className="flex gap-1.5">
              {recentColors.map((hex) => (
                <ColorSwatch key={hex} hex={hex} label={hex} selected={value === hex} onClick={() => onChange?.(hex)} />
              ))}
            </div>
          </div>
          <Separator />
          <Field>
            <FieldLabel htmlFor="color-custom-hex" className="text-xs text-muted-foreground">
              自定义颜色
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <span className="size-3.5 shrink-0 rounded-full border border-input" style={{ backgroundColor: custom }} aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                id="color-custom-hex"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="font-mono"
                aria-label="自定义颜色十六进制"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="sm" onClick={() => onChange?.(custom)}>
                  应用
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </div>
      </PopoverContent>
    </Popover>
  )
}
