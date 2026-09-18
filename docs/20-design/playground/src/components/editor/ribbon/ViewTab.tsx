import { useState } from "react"
import { ChevronDown, LayoutTemplate, PanelLeft, StickyNote } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { RibbonGroup } from "./primitives"

const zoomPresets = ["适应窗口", "适应宽度", "50%", "75%", "100%", "150%", "200%"]

/**
 * Q12（裁决 2026-09-18 §4.10）：母版视图入口仅在编辑态（有 doc.write）且视口 ≥ 1024 时提供。
 * `enabled` 正常；`review` 评审/只读态；`narrow` 视口 < 1024。后两者下入口按钮禁用并用 tooltip 说明原因。
 */
export type MasterEntryState = "enabled" | "review" | "narrow"

const masterEntryReason: Record<Exclude<MasterEntryState, "enabled">, string> = {
  review: "评审模式下不可用",
  narrow: "需要 ≥ 1024 宽度",
}

export function ViewTab({
  zoom,
  onZoomChange,
  showThumbnailRail = true,
  onShowThumbnailRailChange,
  showNotes = false,
  onShowNotesChange,
  onEnterMasterView,
  masterEntry = "enabled",
}: {
  zoom?: number
  onZoomChange?: (v: import("@/components/editor/SlideCanvas").ZoomValue) => void
  showThumbnailRail?: boolean
  onShowThumbnailRailChange?: (v: boolean) => void
  showNotes?: boolean
  onShowNotesChange?: (v: boolean) => void
  onEnterMasterView?: () => void
  masterEntry?: MasterEntryState
}) {
  const [grid, setGrid] = useState(true)
  const [guides, setGuides] = useState(true)
  const [smartGuides, setSmartGuides] = useState(true)

  const masterDisabled = masterEntry !== "enabled"
  const masterButton = (
    <Button
      variant="ghost"
      size="sm"
      disabled={masterDisabled}
      className="h-5 justify-start gap-1.5 rounded-md px-0.5 text-xs font-normal"
      onClick={onEnterMasterView}
    >
      <LayoutTemplate className="size-3.5" /> 母版视图
    </Button>
  )

  return (
    <>
      <RibbonGroup label="显示">
        <div className="flex flex-col text-xs">
          <label className="flex h-5 items-center gap-1.5"><Checkbox checked={grid} onCheckedChange={(v) => setGrid(!!v)} /> 网格</label>
          <label className="flex h-5 items-center gap-1.5"><Checkbox checked={guides} onCheckedChange={(v) => setGuides(!!v)} /> 参考线</label>
          <label className="flex h-5 items-center gap-1.5"><Checkbox checked={smartGuides} onCheckedChange={(v) => setSmartGuides(!!v)} /> 智能参考线</label>
        </div>
      </RibbonGroup>

      <RibbonGroup label="缩放">
        <div className="flex flex-col gap-1">
          <Select value={zoom === undefined ? "fit" : String(zoom)} onValueChange={(v) => onZoomChange?.(v === "fit" ? "fit" : Number(v))}>
            <SelectTrigger size="sm" className="w-20"><SelectValue>{zoom === undefined ? "适应" : `${zoom}%`}</SelectValue></SelectTrigger>
            <SelectContent>
              {[50, 75, 100, 150, 200].map((v) => <SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 justify-between gap-1 px-1.5 text-xs font-normal">适应窗口 <ChevronDown className="size-3" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {zoomPresets.map((p) => <DropdownMenuItem key={p} onSelect={() => onZoomChange?.(p.endsWith("%") ? Number(p.replace("%", "")) : p === "适应宽度" ? "fit-width" : "fit")}>{p}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </RibbonGroup>

      <RibbonGroup label="窗口">
        <div className="flex flex-col text-xs">
          <label className="flex h-5 items-center gap-1.5">
            <Checkbox checked={showThumbnailRail} onCheckedChange={(v) => onShowThumbnailRailChange?.(!!v)} />
            <PanelLeft className="size-3.5 text-muted-foreground" /> 缩略图侧栏
          </label>
          <label className="flex h-5 items-center gap-1.5">
            <Checkbox checked={showNotes} onCheckedChange={(v) => onShowNotesChange?.(!!v)} />
            <StickyNote className="size-3.5 text-muted-foreground" /> 备注
          </label>
          <Tooltip>
            <TooltipTrigger asChild>
              {masterDisabled ? (
                // 原生 disabled 的按钮不派发 pointer/focus 事件，Tooltip 需挂在可聚焦的包裹层上才能说明禁用原因
                <span tabIndex={0} className="inline-flex w-fit rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">{masterButton}</span>
              ) : (
                masterButton
              )}
            </TooltipTrigger>
            <TooltipContent className="flex items-center gap-1.5">
              {masterDisabled ? masterEntryReason[masterEntry] : <>进入母版视图 <KbdGroup><Kbd>⌘</Kbd><Kbd>⌥</Kbd><Kbd>M</Kbd></KbdGroup></>}
            </TooltipContent>
          </Tooltip>
        </div>
      </RibbonGroup>
    </>
  )
}
