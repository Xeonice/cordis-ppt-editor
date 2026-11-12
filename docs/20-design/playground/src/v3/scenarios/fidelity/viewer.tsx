import type { ReactNode } from "react"
import { Clapperboard, ExternalLink, TriangleAlert, Type, type LucideIcon } from "lucide-react"
import { Button, ICON, Popover, PopoverTitle, useSceneState } from "../../kit"

/** 摘要卡开着没有（场景状态：ⓘ 与卡片共用；viewer-shell 状态一出现就开着，之后由 ⓘ 开关） */
const useSummaryOpen = () => useSceneState<boolean>("fidelity.viewer-summary", true)

/**
 * 查看器 preset 壳（preset-slide-viewer，01-IA §8.1、03-25）里的「ⓘ 保真摘要」——03-10 的极简形态：只有摘要计数与「查看详情」外链，不内嵌完整报告。
 * 只列影响「看」的几类：以占位显示的内容、静态显示的动画与切换、替代字体；仅授权查看的字体在查看器里用原字体显示，不列。
 * 「查看详情」是否出现、跳到哪里由集成方配置（03-25），未配置时不显示这一行。
 * 壳本身（顶部条、翻页、缩放、全屏、搜索）是第 3 批定稿的查看器桌面壳（viewer/shell.tsx）：2026-10-22 按 rulings §4.25 DS-110 把这里原来的最小壳 ViewerShell 换成它，卡片不动。
 */

/** 摘要卡的一行：图标（以占位显示的用警告色，其余是类型图标 text-2）+ 一句（可以带「」不断行的节点） */
export interface ViewerSummaryRow {
  Icon: LucideIcon
  warn?: boolean
  text: ReactNode
}

/** 与完整报告同一套图标：以占位显示用警告色，其余是类型图标（text-2）；第 2 批定稿的样例三行 */
export const VIEWER_SUMMARY_ROWS: ViewerSummaryRow[] = [
  { Icon: TriangleAlert, warn: true, text: "1 处内容暂不支持显示" },
  { Icon: Clapperboard, text: "6 处动画与切换以静态画面显示" },
  { Icon: Type, text: "1 种缺失字体已用替代字体显示" },
]

/** 摘要卡的结尾一句（第 2 批定稿） */
export const VIEWER_SUMMARY_KEPT = "内容都已原样保留，不影响原文件。"

/**
 * ⓘ 弹出的摘要卡（layers）：向下、右对齐到 ⓘ。
 * 第 3 批转正（rulings §4.25 DS-110，kitRequest g3 K5）：接收条目与结尾——rows（缺省第 2 批样例三行）、footer（缺省「内容都已原样保留…」，null 不写）、
 * details（「查看详情」外链只在宿主配了 onOpenDetails 时出现，缺省 true）；查看器缺插件的「一行说明」就是 rows 的第一行（警告色拼图）。不传时与第 2 批定稿逐像素相同
 */
export function ViewerSummary({ rows = VIEWER_SUMMARY_ROWS, footer = VIEWER_SUMMARY_KEPT, details = true }: { rows?: ViewerSummaryRow[]; footer?: string | null; details?: boolean } = {}) {
  const [open, setOpen] = useSummaryOpen()
  return (
    <Popover
      anchor="fidelity.viewer-info"
      open={open}
      onOpenChange={setOpen}
      // 点 ⓘ 本身由 ⓘ 自己切换开合（否则「点外面关闭」与按钮的切换同时发生，关了又开）
      onInteractOutside={(e) => {
        const t = e.target instanceof Element ? e.target : null
        if (t?.closest('[data-v3-anchor="fidelity.viewer-info"]')) e.preventDefault()
      }}
      side="bottom"
      align="end"
      sideOffset={8}
      snap={false}
      label="保真摘要"
      className="w-[264px] p-3"
    >
      <PopoverTitle>保真摘要</PopoverTitle>
      <ul className="mt-2 flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-[12px] leading-[18px] text-(--v3-text)">
            <r.Icon {...ICON} aria-hidden="true" className={r.warn ? "mt-px shrink-0 text-(--v3-warning)" : "mt-px shrink-0 text-(--v3-text-2)"} />
            {/* 带节点的一句（「」不断行的插件名）包一层，整句是一个弹性项、照常折行；纯文字原样（第 2 批定稿的三行逐像素不变） */}
            {typeof r.text === "string" ? r.text : <span>{r.text}</span>}
          </li>
        ))}
      </ul>
      {footer && <p className="mt-2 text-[12px] leading-[18px] text-(--v3-text-2)">{footer}</p>}
      {details && (
        <Button variant="secondary" className="mt-3">
          查看详情
          <ExternalLink size={14} strokeWidth={1.5} aria-hidden="true" />
        </Button>
      )}
    </Popover>
  )
}
