import { Fragment } from "react"
import { LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { BlockingPage, Button, DOC_TITLE, FoldRow, LoadingRow, useGoTo, useSceneState } from "../../kit"
import type { V3Host } from "../../params"
import { INVALID_DETAILS, MAIN_FILE, QUOTA_ROWS, type DialogFileId, type ImportFile } from "./data"

/**
 * import 场景里导入对话框（dialog.tsx）共用的小件与 DS-99 的两种打开画法：
 * - TechDetails（「技术详情」折叠行）、diagnosticsText（「复制诊断信息」复制的文字）、QuotaTable（「超出项 · 实际值 · 上限」小表）、FILES（各失败态的示例文件）；
 * - DS-99 画法里画布中央的「正在打开…」（snapshot-opening）与 DS-99 未采纳的整屏阻断布局（alt-open-blocking，kit BlockingPage）。
 * 2026-10-23（rulings §4.25 DS-140）：导入改为对话框，整屏导入页、导入过渡页与按错误码的整屏失败页随之删去（DS-97、DS-98 被取代），只给它们用的件
 * （导入页的拖放区、过渡页的进度行、阻断页上的「复制诊断信息」与「返回文档列表」、整屏失败页）一并删去；它们的文案与按错误码的规则并进对话框各失败态的说明（data.ts OTHER_FAILURES）。
 */

/**
 * 站内跳转（沿用当前主题与强调色）：打开中的「取消」回文档列表，样张能点着走（kit useGoTo）。换页的这几帧焦点交给画布（holdFocusDuring），不掉到 body
 */
export function useGo() {
  const goTo = useGoTo()
  const to = (host: V3Host, state?: string, opts?: { replace?: boolean }) => goTo(state ?? null, { host, replace: opts?.replace })
  return { to }
}

/* ================================================================== 失败的几块（导入对话框用） */

/**
 * 「技术详情」（format.pptx.invalid_package）：展开收起是同一个按钮（kit FoldRow，aria-expanded）；内容是首个失败部件的路径等三行，等宽字只给西文。
 * defaultOpen：一出现就展开（导入对话框按自己的状态数据给）。className：宽度（缺省 360）；对话框与手机底部面板放在最宽 360 的一格里、写 w-full，窄时随之收窄
 */
export function TechDetails({ defaultOpen, className }: { defaultOpen?: boolean; className?: string } = {}) {
  const [open, setOpen] = useSceneState("import.details-open", !!defaultOpen)
  return (
    <div className={cn("flex w-[360px] flex-col items-center", className)}>
      <FoldRow inset open={open} onToggle={() => setOpen((o) => !o)} aria-controls="import-tech-details" className="w-auto">
        技术详情
      </FoldRow>
      {open && (
        // panel 底 + 与分隔线同档的细边（同画布底上的 outline 按钮；panel-2 在亮色画布上几乎看不出）
        <dl
          id="import-tech-details"
          className="mt-1 grid w-full grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-[6px] bg-(--v3-panel) px-3 py-2.5 text-left text-[12px] leading-4 ring-1 ring-(--v3-border) ring-inset"
        >
          {INVALID_DETAILS.map((d) => (
            <Fragment key={d.k}>
              <dt className="text-(--v3-text-2)">{d.k}</dt>
              <dd className="min-w-0">
                <code className="font-mono text-[11px] leading-4 break-all text-(--v3-text)">{d.v}</code>
              </dd>
            </Fragment>
          ))}
        </dl>
      )}
    </div>
  )
}

/** 「复制诊断信息」复制的文字：错误码、部件、traceId 与文件名、大小、时间（不含文档内容） */
export function diagnosticsText(file: ImportFile): string {
  const lines = [...INVALID_DETAILS.map((d) => `${d.k === "错误码" ? "code" : d.k === "部件" ? "part" : d.k}: ${d.v}`), `file: ${file.name} (${file.size})`, `time: ${new Date().toISOString()}`]
  return lines.join("\n")
}

/** 「超出规模上限」的超出项表：超出项 · 实际值 · 上限（多项逐行，顺序见 data.ts QUOTA_ROWS）；数字右对齐、等宽数字，不着状态色 */
export function QuotaTable() {
  return (
    <table className="mx-auto w-[320px] border-collapse text-left text-[12px] leading-4">
      <caption className="sr-only">超出的项目</caption>
      <thead>
        <tr className="text-(--v3-text-2)">
          <th scope="col" className="h-7 font-normal">
            超出项
          </th>
          <th scope="col" className="h-7 text-right font-normal">
            实际值
          </th>
          <th scope="col" className="h-7 text-right font-normal">
            上限
          </th>
        </tr>
      </thead>
      <tbody>
        {QUOTA_ROWS.map((r) => (
          <tr key={r.dimension} className="border-t border-(--v3-border)">
            <th scope="row" className="h-7 font-normal text-(--v3-text)">
              {r.label}
            </th>
            <td className="h-7 text-right text-(--v3-text) tabular-nums">{r.actual}</td>
            <td className="h-7 text-right text-(--v3-text-2) tabular-nums">{r.limit}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** 导入对话框各失败态的示例文件 */
export const FILES: Record<DialogFileId, ImportFile> = {
  "invalid-package": { name: "华东区季度经营分析.pptx", size: "8.4 MB" },
  quota: { name: "2026 年度全员大会.pptx", size: "186.3 MB" },
  network: MAIN_FILE,
}

/* ================================================================== DS-99：打开服务端文档 */

/** DS-99 未采纳的备选：协同快照打开期间不画编辑器外壳，整屏阻断布局只放转圈、文档名与「取消」（打开的「取消」回到文档列表，03-13 打开进度表） */
export function OpeningBlockPage() {
  const go = useGo()
  return (
    <BlockingPage
      icon={<LoaderCircle size={32} strokeWidth={1.5} aria-hidden="true" className="motion-safe:animate-spin" />}
      context={DOC_TITLE}
      title="正在打开…"
      headingId="import-title"
      actions={
        <Button variant="outline" onClick={() => go.to("documents", "documents.recent")}>
          取消
        </Button>
      }
    />
  )
}

/**
 * 协同快照打开期间的画布（rulings §4.25 DS-99）：不画版式骨架（快照一到就是完整内容，骨架只会闪一下），画布列中央一行「转圈 · 正在打开… · 取消」——
 * 与第 1 批打开进度行同一位置口径（进度与「取消」在画布上），没有百分比（快照是一次装载，不分批）；「取消」回到文档列表（03-13 打开进度表）
 */
export function SnapshotOpeningStage() {
  const go = useGo()
  return (
    <div aria-busy="true" className="flex min-h-0 flex-1 items-center justify-center">
      <div className="flex items-center gap-3">
        <LoadingRow className="px-0">正在打开…</LoadingRow>
        <Button variant="outline" onClick={() => go.to("documents", "documents.recent")}>
          取消
        </Button>
      </div>
    </div>
  )
}
