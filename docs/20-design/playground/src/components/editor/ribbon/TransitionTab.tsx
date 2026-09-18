import type { ComponentType } from "react"
import { Ban, Lock, MoveRight, Shuffle, Sparkles, SquareStack } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { RibbonGroup } from "./primitives"

export type TransitionEffectId = "none" | "fade" | "push" | "wipe" | "random"

const transitions: { id: TransitionEffectId; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "none", label: "无", icon: Ban },
  { id: "fade", label: "淡入淡出", icon: Sparkles },
  { id: "push", label: "推入", icon: MoveRight },
  { id: "wipe", label: "擦除", icon: SquareStack },
  { id: "random", label: "随机", icon: Shuffle },
]

/**
 * 「切换」页签 —— M1–M3 只读展示（裁决 2026-09-18 §4.10 Q15）。
 * 依据：PRD 与章程 Q7「M1–M3 不编辑动画/切换」、03-11 present-mode「仅保留已导入效果」。
 * 只显示当前页从原文件保留下来的切换效果名与时长，控件一律禁用；不提供效果挑选、
 * 范围应用（全部页 / 仅当前页）、计时换片等可编辑控件，也不弹 toast。
 * 排布节奏与其他页签一致：效果组为一行 60px 大按钮，计时组为两行 28px 小控件。
 */
export function TransitionTab({
  effect = "fade",
  durationSec = 1,
  advanceOnClick = true,
}: {
  /** 当前页保留的切换效果（来自原文件，mock 默认淡入淡出） */
  effect?: TransitionEffectId
  /** 保留的切换时长（秒） */
  durationSec?: number
  /** 保留的「单击换片」设置 */
  advanceOnClick?: boolean
}) {
  const current = transitions.find((t) => t.id === effect) ?? transitions[0]!
  const durationLabel = `${durationSec.toFixed(1)} s`

  return (
    <>
      <RibbonGroup label="切换效果 · 只读" className="min-w-0">
        <ToggleGroup type="single" value={effect} disabled aria-label="当前页保留的切换效果（只读）" className="h-full gap-1 overflow-x-auto">
          {transitions.map((t) => {
            const Icon = t.icon
            return (
              <ToggleGroupItem
                key={t.id}
                value={t.id}
                aria-label={t.label}
                className="h-[60px] w-14 shrink-0 flex-col gap-1 rounded-lg px-1 text-[11px] font-normal whitespace-nowrap data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
              >
                <Icon className="size-5" />
                <span className="leading-none">{t.label}</span>
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </RibbonGroup>

      <RibbonGroup label="计时 · 只读">
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex h-7 items-center gap-1.5">
            <span className="w-10 shrink-0 text-muted-foreground">持续</span>
            <Input value={durationSec.toFixed(1)} readOnly disabled className="h-7 w-14 tabular-nums" aria-label="切换持续时间（秒，只读）" />
            <span className="text-muted-foreground">s</span>
          </div>
          <label className="flex h-7 items-center gap-1.5 text-muted-foreground">
            <Checkbox checked={advanceOnClick} disabled aria-label="单击换片（只读）" /> 单击换片
          </label>
        </div>
      </RibbonGroup>

      {/* 与 ReadonlyRibbonNotice 同款：Lock 3.5 + text-xs text-muted-foreground */}
      <RibbonGroup ariaLabel="切换效果只读说明">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="size-3.5 shrink-0" aria-hidden="true" />
          <Badge variant="outline" className="shrink-0 font-normal tabular-nums">{current.label} · {durationLabel}</Badge>
          <span className="whitespace-nowrap">已保留原文件的切换效果，M1–M3 暂不可编辑</span>
        </div>
      </RibbonGroup>
    </>
  )
}
