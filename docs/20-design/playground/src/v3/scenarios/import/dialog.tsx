import { useEffect, useRef, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { CircleCheck, CloudOff, FileWarning, FileX2, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { BottomSheet, Button, Dialog, FileTypeIcon, ICON, IMPORT_ENTRY, LoadingRow, PanelState, Progress, usePageMaybe, useImportDialogState, type ImportDialogState } from "../../kit"
import { MAIN_FILE, RETRY_CAUSES, STAGES, type ImportFile, type RetryCause, type StageId } from "./data"
import { FileName } from "./FileName"
import { diagnosticsText, FILES, QuotaTable, TechDetails } from "./pages"

/**
 * 「导入」对话框（rulings §4.25 DS-140、DS-141、TB-179…TB-181，2026-10-23；画法 DS-142、文件类型图标 DS-143 / TB-182）：开始页与文档列表顶栏的「导入 .pptx」在原页上打开它，
 * 选文件、拖入、上传、服务端解析与失败都在框里原位换，成功后关闭、进编辑器（DS-99 协同快照打开不变）；手机（< 640）是贴底的底部面板，平板是对话框（TB-181）。
 * 取代 DS-97（整屏导入过渡页）与 DS-98（整屏导入页）。标杆：Figma 文件浏览器的 Import 对话框（用户 2026-10-22 提供的截图：560 × 404，标题栏 40 + 内缩 32 / 24 的大虚线落区，
 * 正中粗体一行、说明一行、主按钮）。
 *
 * 接到底座（kit importDialog）：本模块的 ImportDialog 由 import.scenario.tsx 登记（registerImportDialog），页面宿主在应用壳四个宿主里挂它（kit ImportDialogLayer）；
 * 顶栏「导入 .pptx」（kit ShellDefaultActions，锚点 import.entry）从选文件打开它，主区拖入落区（kit DropOverlay）松开打开上传态（TB-180）。
 * 开关与阶段在场景仓 import.dialog（kit IMPORT_DIALOG_KEY，换状态即复位），本模块在同一份里加自己的字段（DialogUi）；状态一出现就开着的写 page.data.importDialog（ImportDialogSeed）。
 *
 * 画法全用现成的件：kit Dialog（导入专用一档 size="import" 宽 560，DS-142 的画法：圆角 12、1px 边、浮层阴影、遮罩 --v3-scrim、标题栏 40、底栏右对齐）、FileName（长文件名中间省略）、
 * kit FileTypeIcon（上传与解析阶段文件名前的 .pptx 图标，TB-182）、kit Progress 与 LoadingRow（上传与解析，版式同导出对话框「生成中」）、
 * PanelState（失败的整块状态，「重试」是正文里的次按钮，同导出对话框失败态、DS-53）、TechDetails（FoldRow 技术详情）、QuotaTable（超出项小表）；手机的底部面板是 kit BottomSheet。
 * 外框固定 560 × 406、各阶段不变（宽与标杆相同；固定高：换阶段时框体不跳；TB-179 原写 414 是标题栏 48 时的高，DS-142 把标题栏改为 40 后是 406），
 * 正文内边距左右 32、上下 24（同标杆）。落区虚线静止时与分隔线同档（DS-141），拖入悬停改强调色虚线加淡底（TB-180）；读屏由常驻的播报区念阶段；
 * 内容比正文高时从上沿排起、整块可滚（200% 缩放）；所有阶段都拦下拖放的浏览器缺省行为，只有选文件阶段接收（TB-180）。
 */

/** 对话框里画出来的失败（其余错误码同一画法只换图标与文案，见各态的说明与 data.ts OTHER_FAILURES） */
export type DialogFailure = "network" | "invalid-package" | "quota"

/** 状态数据 page.data.importDialog：这个状态一出现时对话框的样子（之后随用户操作变化）；写了即一出现就开着（kit useImportDialogState） */
export interface ImportDialogSeed {
  phase: ImportDialogState["phase"]
  failure?: DialogFailure
  /** 「导入没有完成」的原因（缺省上传中断 / 离线，data.ts RETRY_CAUSES） */
  cause?: RetryCause
  /** 上传进度（确定态，%） */
  percent?: number
  /** 服务端作业阶段（60/06 §6.3） */
  stage?: StageId
  /** 「技术详情」一出现就展开 */
  detailsOpen?: boolean
  /**
   * DS-140 未采纳的备选（只把入口换成对话框，alt-dialog-entry-only）：选好文件后关闭对话框、去整屏导入过渡页——
   * 整屏过渡页已随 DS-140 删去，样张不再演示后半程，选好文件只关闭对话框
   */
  entryOnly?: boolean
  /** 虚线的颜色：缺省 quiet——与分隔线同档的 --v3-border（DS-141）；control——--v3-border-control（DS-141 未采纳的备选，alt-dialog-dash-control） */
  dash?: "quiet" | "control"
  /** 形态：缺省居中对话框；sheet——手机（< 640）贴底的底部面板（TB-181；样张用状态数据指定形态，同 settings.phone） */
  form?: "dialog" | "sheet"
}

/** 场景仓 import.dialog：底座的开关与阶段（kit ImportDialogState）+ 本模块的字段（没写过时按状态数据取，见 useImportDialog） */
interface DialogUi extends ImportDialogState {
  failure?: DialogFailure
  cause?: RetryCause
  percent?: number
  stage?: StageId
  /** 「复制诊断信息」之后：底栏左侧写结果（DS-56 写在框内） */
  copied?: boolean
  /** 拖着的不止一个文件（拖入悬停时判，浏览器拖动中给得出个数、给不出文件名）：不接收，落区写「一次只能导入一个文件」 */
  many?: boolean
}

/** 对话框与底座入口共用的一份状态（kit useImportDialogState：初值按状态数据取，谁先挂上谁初始化）；本模块的字段没写过时取状态数据 */
function useImportDialog() {
  const page = usePageMaybe()
  const seed = (page?.data.importDialog as ImportDialogSeed | undefined) ?? { phase: "pick" }
  const [ui, set] = useImportDialogState<DialogUi>()
  return {
    seed,
    ui: {
      open: ui.open,
      phase: ui.phase,
      failure: ui.failure ?? seed.failure,
      cause: ui.cause ?? seed.cause,
      percent: ui.percent ?? seed.percent ?? 48,
      stage: ui.stage ?? seed.stage ?? "parse-slide",
      copied: !!ui.copied,
      many: !!ui.many,
    },
    set,
  }
}

/** 换阶段后把焦点交给框里的某颗按钮（原来那颗随阶段卸载或换了字，焦点不掉到 body）；只在用户的操作（点按、拖入松开）之后调 */
function focusInDialog(attr: string) {
  document.querySelector<HTMLElement>(`[role="dialog"] [${attr}]`)?.focus({ preventScroll: true })
}

/**
 * 外框：宽 560（kit Dialog 导入专用一档 size="import"，TB-179）；高 406 = 1 + 标题栏 40 + 正文（上下 24 + 落区 316，落区 494 × 316 与标杆的 496 × 316 相当）+ 1，
 * 各阶段不变（标杆 404：它的外框边是 0.5px）。有底栏的阶段（上传、解析、失败）底栏占 53，落区随之收到 494 × 263
 */
const FRAME_H = "h-[406px]"

/* ================================================================== 正文的几块 */

/** 落区里两行字的画法（选文件与拖入悬停同一位置）：粗体一行 13px 600 · 说明一行 12px text-2 */
const LEAD = "text-[13px] leading-5 font-semibold text-(--v3-text)"
const HINT = "text-[12px] leading-[18px] text-(--v3-text-2)"

/**
 * 虚线落区：1px 虚线、圆角 4，填满正文，正中放这一阶段的一组。虚线静止时与分隔线同档（--v3-border，暗 #444 / 亮 #E5E5E5，同标杆；落区靠正中的字与按钮识别，
 * 理由同 DS-35，DS-141）；DS-141 未采纳的备选用 --v3-border-control。拖入悬停（active）：1px 强调色虚线 + 强调色淡底 --v3-accent-soft（TB-180：与主区拖入落区 kit DropOverlay
 * 同一画法，强调色只表达「松开就会接住」）。不写 min-h-0：内容比正文高时（矮视口、200% 缩放）框随内容撑高、正文滚动，不从上沿溢出看不见
 */
function DropFrame({ dash, active, children }: { dash: "quiet" | "control"; active?: boolean; children: ReactNode }) {
  return (
    <div
      data-import-dropzone=""
      className={cn(
        "flex flex-1 flex-col items-center justify-center rounded-[4px] border border-dashed px-8 py-4 text-center transition-colors motion-reduce:transition-none",
        active ? "border-(--v3-accent) bg-(--v3-accent-soft)" : dash === "control" ? "border-(--v3-border-control)" : "border-(--v3-border)",
      )}
    >
      {children}
    </div>
  )
}

/**
 * 选文件：同标杆的三段——粗体一行（不重复标题「导入」）· 说明一行（.pptx 只出现一次，上限读部署配置 RuntimeConfig limits.importMaxBytes，TB-147 / TB-158，样张写死示例值）·
 * 主按钮「从电脑选择文件…」（与说明相距 24）。按钮的读屏说明带上这两行（对话框没有可见的说明，打开时读屏只念「导入 对话框」）
 */
function PickGroup({ onPick }: { onPick: () => void }) {
  return (
    <>
      <p id="import-dialog-lead" className={LEAD}>
        把 PowerPoint 演示文稿带进 Cordex
      </p>
      <p id="import-dialog-hint" className={cn("mt-2", HINT)}>
        把 .pptx 文件拖到这里，单个文件最大 200 MB
      </p>
      <Button variant="primary" data-import-pick="" aria-describedby="import-dialog-lead import-dialog-hint" className="mt-6" onClick={onPick}>
        从电脑选择文件…
      </Button>
    </>
  )
}

/** 拖入悬停：「松开以导入」+ 限制说明（与开始页、文档列表主区的落区 kit DropOverlay 同一句）；拖着不止一个文件时不接收，换成「一次只能导入一个文件」 */
function DragGroup({ many }: { many: boolean }) {
  return (
    <>
      <p className={LEAD}>{many ? "一次只能导入一个文件" : "松开以导入"}</p>
      <p className={cn("mt-2", HINT)}>{many ? "请只拖入一个 .pptx 文件" : "只支持 .pptx，单个文件最大 200 MB"}</p>
    </>
  )
}

/**
 * 上传与解析（版式同导出对话框「生成中」，export/ExportDialog.tsx BusyBody）：文件名一行——20px .pptx 文件类型图标（kit FileTypeIcon，text-2，aria-hidden；TB-182）·
 * 文件名（12px 中字重、放不下时中间省略，FileName）+「· 大小」（text-2）· 阶段文案在左、百分比在右（12px / 11px text-2）· 整宽确定态进度条（kit Progress 4px）；
 * 解析阶段换成转圈 + 作业阶段文案（kit LoadingRow），不写百分比（DS-53）。最宽 360，放在虚线框正中。
 * 读屏：进度条名「上传进度」带 aria-valuenow；阶段由对话框里常驻的播报区念（见 Live），这里的加载行不再是第二个 status
 */
function ProgressBlock({ phase, percent, stage }: { phase: "uploading" | "parsing"; percent: number; stage: StageId }) {
  return (
    <div className="w-full max-w-[360px] text-left">
      <p className="flex min-w-0 items-center gap-2 text-[12px] leading-4">
        <FileTypeIcon type="pptx" className="shrink-0 text-(--v3-text-2)" />
        <span className="flex min-w-0">
          <FileName name={MAIN_FILE.name} className="font-medium text-(--v3-text)" />
          <span className="shrink-0 whitespace-pre text-(--v3-text-2) tabular-nums">{` · ${MAIN_FILE.size}`}</span>
        </span>
      </p>
      {phase === "uploading" ? (
        <>
          <div className="mt-3 flex items-center justify-between gap-3 text-[12px] leading-4 text-(--v3-text-2)">
            <span>正在上传…</span>
            <span className="text-[11px] leading-none tabular-nums">{`${percent}%`}</span>
          </div>
          <Progress value={percent} label="上传进度" className="mt-2" />
        </>
      ) : (
        <>
          <LoadingRow aria-hidden="true" className="mt-3 h-4 px-0">
            {STAGES[stage]}
          </LoadingRow>
          {/* 占住进度条的位置（上方 8 + 4），换到解析时文件名不上下跳 */}
          <div aria-hidden="true" className="mt-2 h-1" />
        </>
      )}
    </div>
  )
}

/** 失败的整块状态放在正文正中；不写 min-h-0：内容比正文高时从上沿排起、正文滚动（NF-05 200% 缩放不丢内容） */
function Center({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center">{children}</div>
}

/** 两句各占一行（连排时词会断在两行之间） */
const Line = ({ children }: { children: ReactNode }) => <span className="block">{children}</span>

/** 失败的整块状态里的图标（PanelState 的 20px、描边 1.5，颜色由 PanelState 按 tone 给） */
const ICON20 = { size: 20, strokeWidth: 1.5, "aria-hidden": true } as const

/** 失败态的补充说明一行：哪个文件（12px text-2，单行、中间省略；最宽 440，窄时不超过所在的列） */
const FileNote = ({ file }: { file: ImportFile }) => <FileName name={file.name} suffix={` · ${file.size}`} className="max-w-[min(440px,100%)]" />

/** 对话框里常驻的读屏播报区（polite）：从选文件起就挂着、初始为空，换阶段只改它的文字——新挂上就带着字的播报区 NVDA、JAWS 常常不念 */
const Live = ({ say }: { say: string }) => (
  <p aria-live="polite" aria-atomic="true" className="sr-only">
    {say}
  </p>
)

/* ================================================================== 对话框 */

export function ImportDialog() {
  const { seed, ui, set } = useImportDialog()
  const sheet = seed.form === "sheet"
  const dash = seed.dash ?? "quiet"
  const busy = ui.phase === "uploading" || ui.phase === "parsing"
  /** 拖入悬停时焦点若在「从电脑选择文件…」上（按钮随之收起），先交给对话框本身，拖出后再交回 */
  const handedOff = useRef(false)

  /** 关闭（×、Esc、点遮罩、「取消」「关闭」）：上传中中止直传、解析中调导入取消端点，不留卡片也不留原件（UX-14）；下次打开从选文件开始（TB-179） */
  const close = () => set({ open: false, phase: "pick", copied: false, many: false })

  /** 选好文件（或拖入松开）：原位进上传中、焦点交给「取消」。DS-140 未采纳的备选（entryOnly）：只关闭对话框（它要去的整屏过渡页已删去） */
  const start = () => {
    handedOff.current = false
    if (seed.entryOnly) {
      close()
      return
    }
    flushSync(() => set({ phase: "uploading", percent: seed.percent ?? 48, copied: false, many: false }))
    focusInDialog("data-import-cancel")
  }

  // 拖放（桌面与平板形态，TB-180）：对话框开着的所有阶段都在窗口上拦下拖放的浏览器缺省行为（免得把文件当网页打开、离开页面中断上传）；
  // 只有选文件阶段接收——拖到对话框外、遮罩上也算进落区；上传、解析与失败阶段不接收（光标显示不可放下，不高亮、不换文件），拖着不止一个文件时也不接收。
  // 处理函数读最新的阶段与 start（ref），只按开关挂一次：换阶段时不重挂，进出的层数计数不被清零
  const phaseRef = useRef(ui.phase)
  phaseRef.current = ui.phase
  const startRef = useRef(start)
  startRef.current = start
  useEffect(() => {
    if (!ui.open || sheet) return
    let depth = 0
    let many = false
    const isFile = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files")
    const accepting = () => phaseRef.current === "pick" || phaseRef.current === "dragover"
    const pickButton = () => document.querySelector<HTMLElement>('[role="dialog"] [data-import-pick]')
    const toDragover = () => {
      const pick = pickButton()
      if (pick && document.activeElement === pick) {
        pick.closest<HTMLElement>('[role="dialog"]')?.focus({ preventScroll: true })
        handedOff.current = true
      }
      set({ phase: "dragover", many })
    }
    const toPick = () => {
      flushSync(() => set({ phase: "pick", many: false }))
      if (handedOff.current) {
        handedOff.current = false
        pickButton()?.focus({ preventScroll: true })
      }
    }
    const onEnter = (e: DragEvent) => {
      if (!isFile(e)) return
      e.preventDefault()
      if (!accepting()) return
      depth += 1
      if (depth === 1) {
        many = Array.from(e.dataTransfer?.items ?? []).filter((i) => i.kind === "file").length > 1
        toDragover()
      }
    }
    const onOver = (e: DragEvent) => {
      if (!isFile(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = accepting() && !many ? "copy" : "none"
    }
    const onLeave = (e: DragEvent) => {
      if (!isFile(e) || !accepting()) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) toPick()
    }
    const onDrop = (e: DragEvent) => {
      if (!isFile(e)) return
      e.preventDefault()
      if (!accepting()) return
      depth = 0
      if (many) toPick()
      else startRef.current()
    }
    window.addEventListener("dragenter", onEnter)
    window.addEventListener("dragover", onOver)
    window.addEventListener("dragleave", onLeave)
    window.addEventListener("drop", onDrop)
    return () => {
      window.removeEventListener("dragenter", onEnter)
      window.removeEventListener("dragover", onOver)
      window.removeEventListener("dragleave", onLeave)
      window.removeEventListener("drop", onDrop)
    }
    // set 只经稳定的场景仓 setter 写入；阶段与 start 读 ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.open, sheet])

  /** 「重试」：用还在手里的文件重新走一遍完整导入，原位回到上传中，焦点落在「取消」 */
  const retry = () => {
    flushSync(() => set({ phase: "uploading", percent: seed.percent ?? 48, copied: false }))
    focusInDialog("data-import-cancel")
  }

  /** 「复制诊断信息」：错误码、部件、traceId、文件名、大小与时间（不含文档内容）；结果写在底栏左侧（DS-56），经常驻播报区念一次 */
  const copy = () => {
    try {
      void navigator.clipboard?.writeText(diagnosticsText(FILES["invalid-package"])).catch(() => undefined)
    } catch {
      // 剪贴板不可用（非安全上下文）时只演示反馈
    }
    set({ copied: true })
  }

  /** 常驻播报区这一阶段的文字（失败由 PanelState 的 role=alert 念） */
  const say =
    ui.phase === "dragover"
      ? ui.many
        ? "一次只能导入一个文件"
        : "松开以导入"
      : ui.phase === "uploading"
        ? `正在上传「${MAIN_FILE.name}」`
        : ui.phase === "parsing"
          ? STAGES[ui.stage]
          : ui.phase === "failed" && ui.copied
            ? "已复制诊断信息"
            : ""

  // ---------------------------------------------------------------- 失败的正文（对话框与底部面板同一份）
  const failure = ui.failure ?? "network"
  const file = FILES[failure]
  const cause = ui.cause ?? "network"
  /** 触控形态（底部面板）的按钮高 44、竖排整宽（07 §2 命中区，同 settings.phone） */
  const touchBtn = sheet ? "h-11 w-full px-4" : undefined
  let failedBody: ReactNode = null
  if (ui.phase === "failed") {
    if (failure === "network") {
      // 第二行与图标按原因换（data.ts RETRY_CAUSES）：只有上传中断 / 离线用离线云，其余用警示图标；「重试」是正文里的次按钮（DS-53，同导出对话框失败态）
      failedBody = (
        <PanelState
          title="导入没有完成"
          icon={cause === "network" ? <CloudOff {...ICON20} /> : <TriangleAlert {...ICON20} />}
          action={
            <Button variant="secondary" data-import-retry="" className={sheet ? "h-11 px-4" : undefined} onClick={retry}>
              重试
            </Button>
          }
          note={<FileNote file={file} />}
          className={sheet ? "px-0 py-6" : "p-0"}
        >
          {RETRY_CAUSES[cause].text}
        </PanelState>
      )
    } else if (failure === "invalid-package") {
      failedBody = (
        <>
          <PanelState title="无法打开：文件不是有效的演示文稿" icon={<FileX2 {...ICON20} />} note={<FileNote file={file} />} className={sheet ? "px-0 pt-6 pb-0" : "p-0"}>
            可以在 PowerPoint 中打开并另存一份 .pptx 后再导入
          </PanelState>
          {/* 技术详情（kit FoldRow：展开收起同一个按钮、aria-expanded / aria-controls）：错误码 · 首个失败部件 · traceId；最宽 360，窄时随列收窄 */}
          <div className="mt-3 w-full max-w-[360px]">
            <TechDetails defaultOpen={!!seed.detailsOpen} className="w-full" />
          </div>
        </>
      )
    } else {
      failedBody = (
        <>
          <PanelState title="文档超出规模上限，无法导入" icon={<FileWarning {...ICON20} />} note={<FileNote file={file} />} className={sheet ? "px-0 pt-6 pb-0" : "p-0"}>
            <Line>共有 236 页，超过每份文档 200 页的上限</Line>
            <Line>可以在 PowerPoint 中把它拆成几份较小的文件后再分别导入</Line>
          </PanelState>
          <div className="mt-4">
            <QuotaTable />
          </div>
        </>
      )
    }
  }

  /** 「复制诊断信息」之后底栏左侧的一行（16px 成功色 CircleCheck + 12px 主文字色，同个人插件面板底栏），关闭对话框前一直留着 */
  const copiedNote = ui.copied ? (
    <p className="flex min-w-0 items-center gap-2 text-[12px] leading-4 text-(--v3-text)">
      <CircleCheck {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-success)" />
      已复制诊断信息
    </p>
  ) : undefined

  /**
   * 底栏按钮（对话框）：写成带 key 的数组——「取消」「关闭」同一个 key，换阶段时是同一颗按钮换了字，焦点在它上面时留在原位、不掉到 body；
   * 上传与解析：「取消」· 失败：「关闭」，不是有效的演示文稿另有「复制诊断信息」（都是次按钮；「重试」在正文里，TB-179）
   */
  const closeKey = "close"
  const footer: ReactNode = busy
    ? [
        <Button key={closeKey} variant="secondary" data-import-cancel="" className={touchBtn} onClick={close}>
          取消
        </Button>,
      ]
    : ui.phase === "failed"
      ? [
          ...(failure === "invalid-package"
            ? [
                <Button key="copy" variant="secondary" className={touchBtn} onClick={copy}>
                  复制诊断信息
                </Button>,
              ]
            : []),
          <Button key={closeKey} variant="secondary" data-import-close="" className={touchBtn} onClick={close}>
            关闭
          </Button>,
        ]
      : undefined

  /* ---------------------------------------------------------------- 手机：底部面板（TB-181） */
  if (sheet) {
    return (
      <BottomSheet
        title="导入"
        closeLabel={busy ? "取消导入" : "关闭"}
        open={ui.open}
        onOpenChange={(v) => (v ? set({ open: true }) : close())}
        returnFocus="home.nav-toggle"
        // 上传与解析中点遮罩不关闭（TB-180，同对话框）；关闭按钮与 Esc 照常是「取消导入」
        dismissOnOutside={!busy}
      >
        <div className="flex flex-col px-4 pt-4 pb-6">
          {ui.phase === "pick" || ui.phase === "dragover" ? (
            // 手机没有拖放：不画虚线框与「拖到这里」，只留粗体一行、限制说明与「选择文件…」（44 高、整宽、不写「从电脑」，TB-181）
            <>
              <p id="import-sheet-lead" className={LEAD}>
                把 PowerPoint 演示文稿带进 Cordex
              </p>
              <p id="import-sheet-hint" className={cn("mt-1", HINT)}>
                只支持 .pptx，单个文件最大 200 MB
              </p>
              <Button variant="primary" data-import-pick="" aria-describedby="import-sheet-lead import-sheet-hint" className="mt-4 h-11 w-full px-4" onClick={start}>
                选择文件…
              </Button>
            </>
          ) : busy ? (
            <ProgressBlock phase={ui.phase === "uploading" ? "uploading" : "parsing"} percent={ui.percent} stage={ui.stage} />
          ) : (
            <div className="flex flex-col items-center">{failedBody}</div>
          )}
          {/* 底栏的按钮在面板里竖排、整宽、44 高（「关闭」「取消」在最下，单手可及）；「已复制诊断信息」写在按钮上方 */}
          {ui.phase === "failed" && copiedNote && <div className="mt-4 flex justify-center">{copiedNote}</div>}
          {footer && <div className={cn("flex flex-col gap-2", busy ? "mt-6" : "mt-4")}>{footer}</div>}
        </div>
        <Live say={say} />
      </BottomSheet>
    )
  }

  /* ---------------------------------------------------------------- 桌面与平板：对话框 */
  let body: ReactNode
  if (ui.phase === "pick" || ui.phase === "dragover") {
    body = (
      <DropFrame dash={dash} active={ui.phase === "dragover" && !ui.many}>
        {ui.phase === "pick" ? <PickGroup onPick={start} /> : <DragGroup many={ui.many} />}
      </DropFrame>
    )
  } else if (busy) {
    // 文件「落进」落区：虚线框保留（底栏出来后收到 494 × 263），框正中是导出「生成中」同一版式的一组
    body = (
      <DropFrame dash={dash}>
        <ProgressBlock phase={ui.phase === "uploading" ? "uploading" : "parsing"} percent={ui.percent} stage={ui.stage} />
      </DropFrame>
    )
  } else {
    body = <Center>{failedBody}</Center>
  }

  return (
    <Dialog
      title="导入"
      size="import"
      open={ui.open}
      onOpenChange={(v) => (v ? set({ open: true }) : close())}
      returnFocus={IMPORT_ENTRY}
      // 上传与解析中：×、Esc 与「取消」同一个动作（中止并关闭），× 的读屏名与工具提示随之写「取消导入」；点遮罩不关闭（误点不丢掉这次上传，TB-180，同导出对话框 DS-101）
      closeLabel={busy ? "取消导入" : undefined}
      dismissOnOutside={!busy}
      closeOnAction={false}
      className={FRAME_H}
      bodyClassName="flex flex-col px-8 py-6"
      footer={footer}
      footerStart={ui.phase === "failed" ? copiedNote : undefined}
    >
      {body}
      <Live say={say} />
    </Dialog>
  )
}
