import { useState } from "react"
import { CircleCheck, Palette, Type } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { themePresets } from "@/lib/mock-data"
import { ThemeEditorPanel } from "../ThemeEditorPanel"
import { RibbonGroup } from "./primitives"

/** 03-screens/28 设计页签：主题 / 变体 / 自定义（颜色、字体）。裁决 2026-09-18 §4.10 Q17：去掉了默认主题设置入口。 */
export function DesignTab({
  themeId = "office",
  onThemeChange,
}: {
  themeId?: string
  onThemeChange?: (id: string) => void
}) {
  const [selectedTheme, setSelectedTheme] = useState(themeId)
  const [variantIndex, setVariantIndex] = useState(0)
  const theme = themePresets.find((t) => t.id === selectedTheme) ?? themePresets[0]!

  function selectTheme(id: string) {
    setSelectedTheme(id)
    setVariantIndex(0)
    onThemeChange?.(id)
  }

  return (
    <>
      <RibbonGroup label="主题" className="min-w-0">
        <div className="flex h-[60px] items-center gap-1.5 overflow-x-auto">
          {themePresets.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTheme(t.id)}
              aria-pressed={t.id === selectedTheme}
              className={cn(
                "flex h-[60px] w-[84px] shrink-0 flex-col gap-1 rounded-lg border p-1 text-left outline-none transition-colors hover:border-ring focus-visible:ring-2 focus-visible:ring-ring",
                t.id === selectedTheme && "border-primary ring-1 ring-primary"
              )}
            >
              <div className="relative aspect-video w-full overflow-hidden rounded-sm border">
                <div className="absolute inset-0" style={{ backgroundColor: t.colors[0]!.hex }} />
                <div className="absolute inset-[12%] flex flex-col gap-[10%]">
                  <div className="h-[22%] w-[60%] rounded-full" style={{ backgroundColor: t.colors[4]!.hex }} />
                  <div className="h-[10%] w-[42%] rounded-full opacity-60" style={{ backgroundColor: t.colors[1]!.hex }} />
                </div>
                {t.id === selectedTheme && (
                  <CircleCheck className="absolute top-1 right-1 size-3.5 rounded-full bg-background text-primary" aria-hidden="true" />
                )}
              </div>
              <span className="truncate text-[11px] leading-none">{t.name}</span>
            </button>
          ))}
        </div>
      </RibbonGroup>

      <RibbonGroup label="变体" ariaLabel="主题变体">
        <div className="flex items-center gap-1.5">
          {theme.variants.map((v, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setVariantIndex(i)}
              aria-pressed={i === variantIndex}
              aria-label={`变体 ${i + 1}`}
              className={cn("flex h-7 w-11 overflow-hidden rounded-md border", i === variantIndex && "ring-2 ring-primary")}
            >
              {v.map((hex, j) => (
                <span key={j} className="h-full flex-1" style={{ backgroundColor: hex }} />
              ))}
            </button>
          ))}
        </div>
      </RibbonGroup>

      <RibbonGroup label="自定义">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-1.5 text-xs font-normal"><Palette className="size-3.5" /> 颜色</Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72">
            <ThemeEditorPanel themeId={selectedTheme} defaultTab="color" />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-1.5 text-xs font-normal"><Type className="size-3.5" /> 字体</Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72">
            <ThemeEditorPanel themeId={selectedTheme} defaultTab="font" />
          </PopoverContent>
        </Popover>
      </RibbonGroup>
    </>
  )
}
