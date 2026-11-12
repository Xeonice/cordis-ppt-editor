import { Check, Info } from "lucide-react"
import { Banner, Button, Dialog, ICON, RailStatus, useLayerClose } from "../../kit"
import { SOURCE_FILE } from "./data"
import { ReportBody } from "./ReportPanel"
import { useOpenReport, useReport, useReportDialogOpen, useReturnFocus } from "./store"

/**
 * 未采纳的备选画法（DS-63 留在样张里作对照；rulings §4.25 DS-38、DS-51 定为推荐的见 fidelity.scenario.tsx 主状态）：
 * - alt-dialog：报告做成模态对话框（01-IA §9 路由表登记的 ui.dialog、旧版 #/editor/fidelity 的画法）。「定位」先关对话框再跳页，看下一条要重开。
 * - alt-banner：打开后有差异时走横幅通道（优先级末档「其他」，可关闭），而不是轻提示。
 * - alt-indicator：同步状态行后面常驻一个「N 项保真差异」入口（03-10 的「持久小角标」在 v3 的落点），而不是只靠主菜单。
 */

/** 报告正文放进对话框：点「定位」先关对话框（焦点交回画布）再跳页高亮 */
function DialogBody() {
  const close = useLayerClose()
  return <ReportBody onLocate={close} />
}

/**
 * 备选 alt-dialog：报告做成模态对话框。开关是场景状态（useReportDialogOpen，状态出现时开着）；状态的 data.reportForm = "dialog" 让各入口
 * （主菜单「文件 › 保真报告」、提示条、检查器、右键）都打开这个对话框，关掉后从入口重开仍是备选形态；关闭后焦点回打开它的控件（主菜单按钮等）
 */
export function ReportDialog() {
  const [open, setOpen] = useReportDialogOpen()
  const [ret] = useReturnFocus()
  return (
    <Dialog title="保真报告" description={`导入自 ${SOURCE_FILE}`} size="md" bodyClassName="p-0" primary={{ label: "知道了" }} open={open} onOpenChange={setOpen} returnFocus={ret ?? undefined}>
      <DialogBody />
    </Dialog>
  )
}

/** 备选 alt-banner 的横幅：「查看保真报告」带锚点 fidelity.banner-detail——报告关闭后焦点回到它（横幅仍在原位；同「查看详情」「保真详情」，03-10 §2） */
export function ReportBanner() {
  const { items } = useReport()
  const openReport = useOpenReport()
  const placeholders = items.filter((i) => i.level !== "info").length
  return (
    <Banner
      icon={<Info {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />}
      title={`${items.length} 项内容与原文件不同`}
      actions={
        <Button variant="secondary" data-v3-anchor="fidelity.banner-detail" onClick={() => openReport({ from: "fidelity.banner-detail" })}>
          查看保真报告
        </Button>
      }
      onClose={() => undefined}
      closeLabel="关闭提示"
    >
      {placeholders ? `${placeholders} 项以占位显示；` : ""}内容都已原样保留，导出时一并写回
    </Banner>
  )
}

/** 同步状态行：「✓ 已同步 · ⓘ 9 项保真差异」，后者是按钮（打开报告） */
export function StatusWithIndicator() {
  const { items } = useReport()
  const openReport = useOpenReport()
  return (
    <div className="flex h-4 items-center gap-1.5">
      <RailStatus icon={<Check size={12} strokeWidth={1.75} aria-hidden="true" />}>已同步</RailStatus>
      <span aria-hidden="true" className="text-[12px] leading-none text-(--v3-text-2)">
        ·
      </span>
      <button
        type="button"
        data-v3-anchor="fidelity.status"
        onClick={() => openReport({ from: "fidelity.status" })}
        className="-mx-1 flex h-5 items-center gap-1 rounded-[4px] px-1 text-[12px] leading-none text-(--v3-text-2) transition-colors hover:bg-(--v3-panel-2) hover:text-(--v3-text)"
      >
        <Info size={12} strokeWidth={1.75} aria-hidden="true" />
        <span className="tabular-nums">{items.length}</span> 项保真差异
      </button>
    </div>
  )
}
