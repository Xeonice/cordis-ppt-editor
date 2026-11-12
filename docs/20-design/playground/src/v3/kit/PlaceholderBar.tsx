import { useRef, useState, type KeyboardEvent } from "react"
import { ChartColumn, ImagePlus, Table, Video, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tip } from "../ui"
import { Tag } from "./controls"

/**
 * 空内容占位符的快速插入图标条（03-16 G-80，50/21 §3）：画在幻灯片叠加层、按屏幕尺寸绘制（不随画布缩放），不进缩略图、放映与导出。
 * 文本场景（03-16）、表格场景（03-30 占位符的表格图标）与图表场景（03-31 M3 开放图表）共用这一个组件。放在 kit 的 PaperScope 里（纸面恒为白色，界面件取亮色 token）。
 * 开放哪些项由 enabled 决定（缺省 M2：表格、图片）；弹出网格 / 菜单的项用 anchors 给锚点、popups 给弹出类型，弹层开着时 pressedKind 画按下态。
 * v3 外观：纸面上没有容器（不用毛玻璃与药丸），一排 64px 方形按钮（单图标 72px），图标 24 / 28 + 12px 名称，圆角 8；焦点环与选中框同用当前主题的强调色（--paper-accent）。
 * 未到里程碑的项禁用而不隐藏（aria-disabled、可聚焦、名称旁挂 M3 / P2，原因在工具提示里，按句分行）；role=toolbar，整条一个 Tab 停靠点，方向键移动。
 */

export type PhKind = "table" | "picture" | "chart" | "video"

export interface PhItem {
  kind: PhKind
  label: string
  aria: string
  Icon: LucideIcon
  milestone?: "M3" | "P2"
  /** 不可用原因：读屏与提示同一段文案；lines 是提示里的分行（按句断开，避免断在词中间） */
  reason?: string
  lines?: string[]
}

export const PH_ITEMS: Record<PhKind, PhItem> = {
  table: { kind: "table", label: "表格", aria: "插入表格到占位符", Icon: Table },
  picture: { kind: "picture", label: "图片", aria: "插入图片到占位符", Icon: ImagePlus },
  chart: {
    kind: "chart",
    label: "图表",
    aria: "插入图表到占位符",
    Icon: ChartColumn,
    milestone: "M3",
    reason: "图表插入在 M3 提供：随图表编辑组件一起开放。文稿里已有的图表照常查看和放映。",
    lines: ["图表插入在 M3 提供，", "随图表编辑组件一起开放。", "文稿里已有的图表照常查看和放映。"],
  },
  video: {
    kind: "video",
    label: "视频",
    aria: "插入视频到占位符",
    Icon: Video,
    milestone: "P2",
    reason: "视频插入排在后续版本（P2）。文稿里已有的视频照常查看、放映、移动和缩放。",
    lines: ["视频插入排在后续版本（P2）。", "文稿里已有的视频照常查看、放映、移动和缩放。"],
  },
}

/** M2 已开放：表格（q-table-depth）与图片（R-d-69）；图表 M3、视频 P2 */
export const PH_M2_ENABLED: PhKind[] = ["table", "picture"]
/** M3 起图表也开放（03-31） */
export const PH_M3_ENABLED: PhKind[] = ["table", "picture", "chart"]

/** 图标条与折叠菜单同源的禁用判定、读屏名与提示文案（enabled：已开放的项，缺省 M2） */
export function phItemState(it: PhItem, enabled: PhKind[] = PH_M2_ENABLED) {
  const disabled = !enabled.includes(it.kind)
  return {
    disabled,
    ariaLabel: disabled && it.milestone ? `${it.aria}（${it.milestone} 提供）` : it.aria,
    tip: disabled ? (it.reason ?? "当前不可用") : it.aria.replace("到占位符", ""),
    lines: disabled ? it.lines : undefined,
  }
}

/**
 * 图标条本体（展开形态）。enabled：已开放的项（缺省 M2，图表 M3 用 PH_M3_ENABLED）；未开放的禁用而不隐藏、名称旁挂里程碑标记。
 * anchors：各项的锚点名（弹层锚在它上面），tableAnchor 是 anchors.table 的简写；popups：点了弹出什么（表格缺省 dialog，图表类型菜单写 menu）；
 * pressedKind：弹层开着的那一项（按下态、aria-expanded，提示让位）；focusKind：演示键盘焦点停在某一项上（提示常开）；
 * onPick：点了某个已开放的项；onTable：点表格（打开与工具条同一个网格弹层，Q2）。
 */
export function PlaceholderIconBar({
  kinds,
  enabled = PH_M2_ENABLED,
  anchors,
  popups,
  tableAnchor,
  focusKind,
  pressedKind,
  onPick,
  onTable,
}: {
  kinds: PhKind[]
  enabled?: PhKind[]
  anchors?: Partial<Record<PhKind, string>>
  popups?: Partial<Record<PhKind, "dialog" | "menu">>
  tableAnchor?: string
  focusKind?: PhKind
  pressedKind?: PhKind
  onPick?: (kind: PhKind) => void
  onTable?: () => void
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const focusIdx = focusKind ? kinds.indexOf(focusKind) : -1
  const [active, setActive] = useState(focusIdx >= 0 ? focusIdx : 0)
  const single = kinds.length === 1
  const move = (i: number) => {
    const n = kinds.length
    const j = ((i % n) + n) % n
    setActive(j)
    refs.current[j]?.focus()
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = refs.current.findIndex((el) => el === document.activeElement)
    if (cur < 0) return
    if (e.key === "ArrowRight") move(cur + 1)
    else if (e.key === "ArrowLeft") move(cur - 1)
    else if (e.key === "Home") move(0)
    else if (e.key === "End") move(kinds.length - 1)
    else return
    e.preventDefault()
  }
  return (
    <div role="toolbar" aria-label="插入内容到占位符" aria-orientation="horizontal" onKeyDown={onKeyDown} className="pointer-events-auto flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      {kinds.map((k, i) => {
        const it = PH_ITEMS[k]
        const st = phItemState(it, enabled)
        const focused = focusKind === k
        const pressed = pressedKind === k
        const popup = popups?.[k] ?? (k === "table" ? "dialog" : undefined)
        const anchor = anchors?.[k] ?? (k === "table" ? tableAnchor : undefined)
        return (
          <Tip key={k} label={st.tip} lines={st.lines} open={focused} hidden={pressed} side="bottom">
            <button
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              tabIndex={i === active ? 0 : -1}
              aria-label={st.ariaLabel}
              aria-disabled={st.disabled || undefined}
              {...(popup && !st.disabled ? { "aria-haspopup": popup, "aria-expanded": pressed } : {})}
              data-v3-anchor={anchor}
              onFocus={() => setActive(i)}
              onClick={() => {
                if (st.disabled) return
                onPick?.(k)
                if (k === "table") onTable?.()
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 rounded-[8px] text-[12px] leading-4 transition-colors",
                single ? "size-[72px]" : "size-16",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--paper-accent) focus-visible:outline-solid",
                focused && "outline-2 outline-offset-2 outline-(--paper-accent) outline-solid",
                st.disabled ? "cursor-default text-(--v3-text-3)" : cn("text-(--v3-text-2) hover:bg-(--v3-panel-2) hover:text-(--v3-text)", pressed && "bg-(--v3-panel-2) text-(--v3-text)"),
              )}
            >
              <it.Icon size={single ? 28 : 24} strokeWidth={1.5} aria-hidden="true" />
              <span className="flex items-center gap-1">
                {it.label}
                {st.disabled && it.milestone && <Tag>{it.milestone}</Tag>}
              </span>
            </button>
          </Tip>
        )
      })}
    </div>
  )
}
