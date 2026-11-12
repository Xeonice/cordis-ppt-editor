import { CircleCheck, Clapperboard, ExternalLink, Puzzle, TriangleAlert, Type, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Button, ICON } from "../../kit"
import { ViewerSummary } from "../fidelity/viewer"
import { useViewerForm, useViewerSeed, type ViewerSeed } from "./data"

/**
 * 查看器的「ⓘ 保真摘要」卡（03-25，第 2 批已定稿：fidelity.viewer-shell，rulings §4.25 DS-51）：桌面就是 fidelity/viewer.tsx 的 ViewerSummary（ⓘ 下方右对齐、宽 264、只列影响「看」的计数、
 *   「内容都已原样保留，不影响原文件。」、「查看详情」外链只在宿主配置回调时出现；Esc 或点外面收起、焦点回 ⓘ）——第 3 批转正时它接收条目与结尾（rows、footer、details，DS-110），
 *   这里原来复制的局部件 SummaryCard 随之删去：DS-110（summary: plugin，缺插件的一行说明排在最前）、「没有影响查看的差异」（summary: none，TB-114）与宿主没配「查看详情」都只换参数。
 * - 窄屏（DS-111）的「更多 › 保真摘要」是同一份条目放进底部面板（narrow.tsx SummarySheet），条目取 summaryContent()。
 * 开合是场景状态「fidelity.viewer-summary」：与 ViewerSummary 共用同一个键，ⓘ 按钮（shell.tsx）先读到、按本状态的 summaryOpen 写初值。
 */

export const SUMMARY_KEY = "fidelity.viewer-summary"
export const SUMMARY_ANCHOR = "fidelity.viewer-info"

export interface SummaryRow {
  Icon: LucideIcon
  warn?: boolean
  text: ReactNode
}

/** 与 ViewerSummary 相同的三行（第 2 批样例） */
const DOC_ROWS: SummaryRow[] = [
  { Icon: TriangleAlert, warn: true, text: "1 处内容暂不支持显示" },
  { Icon: Clapperboard, text: "6 处动画与切换以静态画面显示" },
  { Icon: Type, text: "1 种缺失字体已用替代字体显示" },
]

/** DS-110：缺插件的「一行说明」进 ⓘ 卡，排在最前（警告色拼图图标，与编辑器缺插件横幅同一个图标）；其余计数照常 */
const PLUGIN_ROWS: SummaryRow[] = [
  {
    Icon: Puzzle,
    warn: true,
    text: (
      <>
        3 处内容需要插件<span className="whitespace-nowrap">「二维码形状」</span>，<span className="whitespace-nowrap">以占位显示</span>
      </>
    ),
  },
  { Icon: Clapperboard, text: "6 处动画与切换以静态画面显示" },
]

/**
 * 没有任何影响「看」的差异（rulings §4.25 TB-114）：ⓘ 留在原位（工具条不跳位），卡片只写一句「未发现影响查看的差异」——
 * 句式与第 2 批已拍板的 fidelity.no-differences「未发现需要注意的差异」对齐，中性对勾 CircleCheck text-2（不用成功色，不是一次操作的结果）
 */
const NONE_ROWS: SummaryRow[] = [{ Icon: CircleCheck, text: "未发现影响查看的差异" }]

const KEPT = "内容都已原样保留，不影响原文件。"

/** 按本状态取摘要的条目与结尾一句（桌面卡片与窄屏底部面板同一份） */
export function summaryContent(kind: ViewerSeed["summary"] = "doc"): { rows: SummaryRow[]; footer?: string } {
  if (kind === "plugin") return { rows: PLUGIN_ROWS, footer: KEPT }
  if (kind === "none") return { rows: NONE_ROWS }
  return { rows: DOC_ROWS, footer: KEPT }
}

/** 条目列表（12px / 18 行高 + 16px 图标；以占位显示的用警告色，其余类型图标 text-2） */
export function SummaryRows({ rows, touch = false }: { rows: SummaryRow[]; touch?: boolean }) {
  return (
    <ul className={touch ? "flex flex-col gap-2.5" : "mt-2 flex flex-col gap-1.5"}>
      {rows.map((r, i) => (
        <li key={i} className={touch ? "flex items-start gap-2.5 text-[13px] leading-5 text-(--v3-text)" : "flex items-start gap-2 text-[12px] leading-[18px] text-(--v3-text)"}>
          <r.Icon {...ICON} aria-hidden="true" className={r.warn ? "mt-px shrink-0 text-(--v3-warning)" : "mt-px shrink-0 text-(--v3-text-2)"} />
          <span>{r.text}</span>
        </li>
      ))}
    </ul>
  )
}

/** 「查看详情」（次按钮 + 14px 外链图标；只在宿主提供 onOpenDetails 时出现） */
export function DetailsButton({ className }: { className?: string }) {
  return (
    <Button variant="secondary" className={className}>
      查看详情
      <ExternalLink size={14} strokeWidth={1.5} aria-hidden="true" />
    </Button>
  )
}

/** 放进 layers：按本状态的 summary 取卡片（只在桌面形态、文档打开了或正在打开时挂：窄屏的摘要是底部面板，打开失败时没有 ⓘ，锚点不在就不挂） */
export function ViewerSummaryLayer() {
  const v = useViewerSeed()
  const form = useViewerForm()
  if (form !== "desktop" || v.phase === "failed") return null
  const { rows, footer } = summaryContent(v.summary ?? "doc")
  return <ViewerSummary rows={rows} footer={footer ?? null} details={!!v.host.details} />
}
