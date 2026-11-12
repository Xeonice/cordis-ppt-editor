import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useRevealAfterMount } from "./layer"

/**
 * 画布浮动面板的位置：相对画布列（左右栏之间）。顶部各项会让开横幅（Banner 把自身高度写进 --v3-banner-h），
 * 底部各项让开底部工具条（工具条上沿约在 62px，再留 12px）。
 */
const PLACEMENT = {
  "top-right": "top-[calc(var(--v3-banner-h,0px)+12px)] right-3",
  "top-left": "top-[calc(var(--v3-banner-h,0px)+12px)] left-3",
  "top-center": "top-[calc(var(--v3-banner-h,0px)+12px)] left-1/2 -translate-x-1/2",
  "bottom-right": "bottom-[74px] right-3",
  "bottom-left": "bottom-[74px] left-3",
} as const

/**
 * 画布浮动面板：查找替换浮动条、数据面板这类停在画布上、不挡左右栏的非模态面板。
 * panel 实底 + 1px 边 + 浮层阴影；圆角 8px（弹层档），浮动条式的横条可用 radius={12}（浮动工具条档）。放在 EditorConfig.canvasOverlay 里。
 * 层级 z-30 即产品的 --layer-panel（30，在常驻外壳 20 与下拉 100 之间；紧凑形态的抽屉、仅查看形态的底部面板与图表数据 Sheet 同档，rulings §4.25 TB-2，设计 04 §2.11）。
 *
 *   canvasOverlay: <FloatingPanel label="查找和替换" className="w-[320px] p-2">…</FloatingPanel>
 */
export function FloatingPanel({
  placement = "top-right",
  label,
  radius = 8,
  role = "dialog",
  className,
  children,
}: {
  placement?: keyof typeof PLACEMENT
  /** 无障碍名称，如「查找和替换」 */
  label: string
  radius?: 8 | 12
  role?: "dialog" | "region" | "toolbar"
  /** 宽度与内边距，如 "w-[320px] p-2" */
  className?: string
  children: ReactNode
}) {
  return (
    <div
      role={role}
      aria-label={label}
      className={cn(
        "absolute z-30 border border-(--v3-border) bg-(--v3-panel) text-(--v3-text) shadow-(--v3-shadow)",
        radius === 12 ? "rounded-[12px]" : "rounded-[8px]",
        PLACEMENT[placement],
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * 画布顶部居中的模式 / 操作提示条（插入工具态、数字跳页…，放 canvasOverlay）：浮动胶囊档——panel 底、1px 边、圆角 12、36px 高、浮层阴影，
 * 12px text-2（要强调的部分自己包 text-(--v3-text)），内容不换行；让开横幅。按键提示用 KeyCap，分组之间用 HintDivider。
 * 提示条本身是 status · polite 播报区。announce：
 * - "inline"（缺省，第 1 批各提示条）：内容随提示条一起出现在无障碍树里；
 * - "next-frame"：出现后的两帧里内容先挡在无障碍树外、再放进来（kit useRevealAfterMount，「先挂空、下一帧填内容」的读屏版）——
 *   读屏看到的是「已在的播报区里出现了内容」，一出现就要可靠地念一次的提示用它（保真页级提示条，第 2 批第 6 轮集成）。外观从第一帧起不变。
 */
export function CanvasHint({ label, announce = "inline", children }: { label?: string; announce?: "inline" | "next-frame"; children: ReactNode }) {
  const deferred = announce === "next-frame"
  const revealed = useRevealAfterMount(deferred)
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="pointer-events-auto absolute top-[calc(var(--v3-banner-h,0px)+12px)] left-1/2 z-30 flex h-9 -translate-x-1/2 items-center gap-3 rounded-[12px] border border-(--v3-border) bg-(--v3-panel) px-3 text-[12px] leading-none whitespace-nowrap text-(--v3-text-2) shadow-(--v3-shadow)"
    >
      {deferred ? (
        // display: contents 的壳不占版面（各段仍是提示条的 flex 子项，间距 gap-3 不变）
        <span className="contents" aria-hidden={revealed ? undefined : true}>
          {children}
        </span>
      ) : (
        children
      )}
    </div>
  )
}

/** 提示条里的竖分隔 */
export function HintDivider() {
  return <span aria-hidden="true" className="h-4 w-px shrink-0 bg-(--v3-border)" />
}
