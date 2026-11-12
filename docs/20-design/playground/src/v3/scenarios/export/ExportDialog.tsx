import { flushSync } from "react-dom"
import { Blocks, CircleCheck, Info, TriangleAlert } from "lucide-react"
import { Button, CheckRow, DegradedDetailButton, Dialog, DOC_TITLE, FileTypeIcon, holdFocusDuring, ICON, InspectorNotice, LoadingRow, PanelState, Progress, RadioRow, Segmented, Tag, TextField, useRunCommand } from "../../kit"
import { FileName } from "../import/FileName"
import { AltFileTypeIcon } from "./fileTypeIcons"
import { FORMAT_NAME, formatsFor, isBusy, type ExportApi, type Format, type RangeKind, type SyncBlock, type Width, useExport } from "./model"

/**
 * 通用导出对话框（03-22，主菜单「文件 › 导出…」⇧⌘E，PRD 07 G-25）：kit Dialog md 480、顶部锚定（内容随格式与阶段增减，标题不跳动）。
 * 与第 2 批「导出本地副本」（offline-conflict/dialogs.tsx，03-12 §7.2）分开、画法一致：节标题 12px 600 + 单选行（RadioRow）右侧次级文字说明、节间 16；
 * 格式行带 20px 文件类型图标（rulings §4.25 DS-143，kit FileTypeIcon；「导出本地副本」的 .pptx 一行同一套，.json 一行用 lucide FileBraces，TB-182）。
 * 阶段：选项（格式 · 宽度 / 内嵌字体 · 范围 · 底部说明）→ 未同步时选项页顶部一行说明、底栏换成「仍要导出 / 等待同步」→ 等待同步（倒数）→
 * 服务端排队 → 生成中（确定态进度 + 取消）→ 完成：关闭对话框 + 画布底部轻提示（rulings §4.25 DS-100）或停在「导出完成」（DS-100 未采纳的备选）；失败：整块状态 + 重试。
 * 「取消」、Esc、× 在等待 / 排队 / 生成中是同一个动作：停掉这次导出（浏览器停 Worker，服务端调导出取消端点，DS-101）、回到选项、焦点落在「导出」；在选项页才关闭对话框。
 * 这三个阶段点遮罩不关闭（kit Dialog dismissOnOutside，第 3 批转正并入）：误点遮罩不丢掉这次导出。
 * 所以这三个阶段标题栏 × 的读屏名与工具提示写「取消导出」（kit Dialog closeLabel），其余阶段仍是「关闭」——名字与它做的事一致。
 * 文件名（生成中、「导出完成」）单行、长名中间省略（import/FileName.tsx，与导入页、轻提示同一个件）。
 */

/** 不能同步时「等待同步」的原因（留在原位不可用，工具提示与说明行同一句） */
const SYNC_REASON: Record<SyncBlock, string> = {
  offline: "恢复连接后才能同步",
  reconnecting: "重新连接后才能同步",
  auth: "重新登录后才能同步",
  paused: "协同已暂停，刷新后才能同步",
}

/** 节标题（同「导出本地副本」对话框：12px 600 主文字色，下方 4） */
function Head({ id, children }: { id: string; children: string }) {
  return (
    <h3 id={id} className="mb-1 text-[12px] leading-4 font-semibold text-(--v3-text)">
      {children}
    </h3>
  )
}

/** 单选行右侧的说明（次级文字，可读信息 DS-9） */
const Hint = ({ children }: { children: string }) => <span className="ml-auto pl-3 text-(--v3-text-2)">{children}</span>

/**
 * 插件贡献的格式：右侧说明的位置写归属「来自「插件名」」，前面 12px Blocks 图标（设计 06 §4 列表条目的写法「来自〈插件名〉」、命令面板 TB-106 同一说法；
 * 图标与「更多」菜单插件分组标题同一个，DS-56 归属标识 12px）。文字可见、是单选项读屏名的一部分，所以不再另挂只有悬停才看得到的 Attribution
 */
function OwnerHint({ plugin }: { plugin: string }) {
  return (
    <span className="ml-auto inline-flex items-center gap-1 pl-3 text-(--v3-text-2)">
      <Blocks size={12} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
      {`来自「${plugin}」`}
    </span>
  )
}

/* ================================================================== 选项页 */

/**
 * 格式：单选组，每行「单选圈 16 · 8 · 文件类型图标 20 · 8 · 名称 · 右侧说明」（rulings §4.25 DS-143；kit RadioRow 的 icon 插槽，行高仍 28）：
 * 图标取 Tabler Icons 的 file-type-ppt / png / svg / pdf（kit FileTypeIcon），中性色——可用 text-2、不可用随文字降为 text-3，选中不改图标颜色（选中由单选圈表达）；
 * 图上字样是「PPT」，名称照旧写「PowerPoint（.pptx）」，图标只作装饰（aria-hidden，读屏名照旧）；插件贡献的格式没有专属图标时画 Tabler 的通用 file 字形（TB-182）。
 * 只有这一节带图标，名称列因此比「范围」「字体」各节右移 28（图标 20 + 间距 8）。状态数据 iconSet 换成 DS-143 未采纳的一套（只给 alt-icons-* 四态，fileTypeIcons.tsx）
 */
function FormatSection({ x }: { x: ExportApi }) {
  const set = x.seed.iconSet
  return (
    <section aria-labelledby="export-format">
      <Head id="export-format">格式</Head>
      <div role="radiogroup" aria-labelledby="export-format" className="flex flex-col">
        {formatsFor(x.seed).map((f) => (
          <RadioRow
            key={f.id}
            checked={x.ui.format === f.id}
            label={f.label}
            icon={set ? <AltFileTypeIcon set={set} format={f.id} /> : <FileTypeIcon type={f.id} />}
            disabled={!!f.reason}
            reason={f.reason}
            onSelect={() => x.set({ format: f.id })}
          >
            {f.tag && <Tag>{f.tag}</Tag>}
            {f.owner ? <OwnerHint plugin={f.owner} /> : <Hint>{f.hint}</Hint>}
          </RadioRow>
        ))}
      </div>
    </section>
  )
}

const WIDTHS: { value: Width; label: string; text: string }[] = [
  { value: "1280", label: "宽 1280 像素", text: "1280 px" },
  { value: "1920", label: "宽 1920 像素", text: "1920 px" },
  { value: "3840", label: "宽 3840 像素", text: "3840 px" },
]

/** PNG 的宽度（OF-19：1280 / 1920 / 3840，缺省 1280；旧样张的 960 作废），分段控件 */
function WidthSection({ x }: { x: ExportApi }) {
  return (
    <section aria-labelledby="export-width">
      <Head id="export-width">图片宽度</Head>
      <Segmented role="radiogroup" aria="图片宽度" options={WIDTHS} value={x.ui.width} onValueChange={(v) => x.set({ width: v })} className="w-[288px]" />
    </section>
  )
}

/** SVG 的内嵌字体（OF-19 要求、03-22 漏画）：缺省不勾；内嵌的是部署字体包里用到的整份字体文件 */
function FontsSection({ x }: { x: ExportApi }) {
  return (
    <section aria-labelledby="export-fonts">
      <Head id="export-fonts">字体</Head>
      <CheckRow label="内嵌字体" hint="文件会变大，没有这些字体的电脑也显示原字体" checked={x.ui.fonts} onCheckedChange={(v) => x.set({ fonts: v })} />
    </section>
  )
}

function RangeSection({ x }: { x: ExportApi }) {
  const { ui, set, total, hidden, selected, ed } = x
  if (x.wholeOnly)
    return (
      <section aria-labelledby="export-range">
        <Head id="export-range">范围</Head>
        <p className="flex h-7 items-center text-[12px] leading-4 text-(--v3-text)">
          {`全部 ${total} 页`}
          <Hint>{ui.format === "pptx" ? "PowerPoint 格式只导出整份文档" : "这种格式只导出整份文档"}</Hint>
        </p>
      </section>
    )
  const pick = (r: RangeKind) => () => set({ range: r })
  const noSel = selected.length < 2
  return (
    <section aria-labelledby="export-range">
      <Head id="export-range">范围</Head>
      <div role="radiogroup" aria-labelledby="export-range" className="flex flex-col">
        <RadioRow checked={ui.range === "all"} label="全部页" onSelect={pick("all")}>
          <Hint>{hidden.length ? `${total - hidden.length} 页 · 不含 ${hidden.length} 张隐藏页` : `${total} 页`}</Hint>
        </RadioRow>
        <RadioRow checked={ui.range === "current"} label="当前页" onSelect={pick("current")}>
          <Hint>{`第 ${ed.slide} 页`}</Hint>
        </RadioRow>
        <RadioRow checked={ui.range === "selected"} label="选定页" disabled={noSel} reason={noSel ? "先在左栏选中多页" : undefined} onSelect={pick("selected")}>
          <Hint>{noSel ? "先在左栏选中多页" : `${selected.length} 页`}</Hint>
        </RadioRow>
        {/* 自定义页码：输入框常在、可直接输入，聚焦即选中这一项；错误写在输入框下方（aria-invalid + aria-describedby） */}
        <div className="flex items-start gap-3">
          <RadioRow checked={ui.range === "custom"} label="自定义页码" onSelect={pick("custom")} className="shrink-0" />
          <div className="min-w-0 flex-1" onFocus={() => ui.range !== "custom" && set({ range: "custom" })} onBlur={() => ui.custom && set({ customTouched: true })}>
            <TextField
              aria="自定义页码"
              placeholder="例如 1,3,5-8"
              inputMode="text"
              value={ui.custom}
              onChange={(v) => set({ custom: v })}
              onKeyDown={(e) => e.key === "Enter" && set({ customTouched: true })}
              error={ui.range === "custom" ? x.customError : undefined}
              className="w-full"
            />
          </div>
        </div>
      </div>
      {/* 说明句末加句号（DS-62「对话框说明句末加句号」，同第 2 批分享对话框链接一节的说明行）；带图标的说明行与整块状态不加 */}
      {x.count > 1 && ui.format !== "pdf" && !x.server && <p className="mt-1 text-[12px] leading-[18px] text-(--v3-text-2)">多页会打包成一个 .zip 文件。</p>}
      {x.server && ui.format === "png" && <p className="mt-1 text-[12px] leading-[18px] text-(--v3-text-2)">全部页由服务端生成，只含已同步的内容。</p>}
    </section>
  )
}

/** 底部说明：原样保留（只对 pptx 成立）或无法显示的内容（G-03：pptx 原样写回，图片 / PDF 按占位画出）+「查看保真报告」 */
function BottomNote({ x }: { x: ExportApi }) {
  const run = useRunCommand()
  const d = x.seed.degraded
  if (d) {
    const where = `第 ${d.pages.join("、")} 页有 ${d.count} 处内容无法显示`
    const what = x.ui.format === "pptx" ? "导出时原样写回" : `${FORMAT_NAME[x.ui.format]} 中会按占位画出`
    return (
      <div className="flex items-center gap-2 text-[12px] leading-[18px] text-(--v3-text-2)">
        <Info {...ICON} className="shrink-0" />
        <span className="min-w-0 flex-1">{`${where}，${what}`}</span>
        {/* 先关对话框、再打开整栏保真报告（03-10；与检查器「保真详情」同一颗按钮）；这里经底座命令 file.fidelity 转到保真报告样张 */}
        <DegradedDetailButton
          onClick={() => {
            holdFocusDuring()
            x.set({ open: false })
            run("file.fidelity")
          }}
        >
          查看保真报告
        </DegradedDetailButton>
      </div>
    )
  }
  if (x.seed.preserved && x.ui.format === "pptx")
    return (
      <p className="flex items-center gap-2 text-[12px] leading-[18px] text-(--v3-text-2)">
        <Info {...ICON} className="shrink-0" />
        未修改的内容将原样保留
      </p>
    )
  return null
}

/** 未同步更改的说明行（rulings §4.18 UX-05、50/04 §8.3）：打开时就判、常驻在选项页顶部、条数实时变；警告色图标 + 主文字色第一句，不用横幅（横幅只在横幅通道） */
function UnsyncedNotice({ x }: { x: ExportApi }) {
  const n = x.ui.unsynced
  const block = x.seed.sync
  const first = x.server ? `需先同步 ${n} 项更改` : `有 ${n} 项更改还没同步`
  // 西文与中文之间留一个空格（「PDF 由…」），同全站写法
  const second = x.server
    ? x.ui.format === "pdf"
      ? "PDF 由服务端生成，只包含已同步到服务器的内容"
      : "PNG 的全部页由服务端生成，只包含已同步到服务器的内容"
    : "导出将包含本地最新内容，可能与其他协作者看到的版本不同"
  return (
    <InspectorNotice icon={<TriangleAlert {...ICON} className="text-(--v3-warning)" />}>
      <span className="block text-(--v3-text)">{first}</span>
      <span className="block">{second}</span>
      {block && <span className="block">{SYNC_REASON[block]}</span>}
    </InspectorNotice>
  )
}

function OptionsBody({ x }: { x: ExportApi }) {
  return (
    <>
      {x.ui.unsynced > 0 && <UnsyncedNotice x={x} />}
      <div className="flex flex-col gap-4 p-4">
        <FormatSection x={x} />
        {x.ui.format === "png" && <WidthSection x={x} />}
        {x.ui.format === "svg" && <FontsSection x={x} />}
        <RangeSection x={x} />
        <BottomNote x={x} />
      </div>
    </>
  )
}

/* ================================================================== 等待同步 · 排队 · 生成中 · 失败 · 完成 */

/** 生成中的阶段文案：pptx 两段（写入幻灯片 → 重新打包未修改的部件）、图片与 PDF 按页 */
function stageText(x: ExportApi): string {
  const p = x.ui.progress
  if (x.ui.format === "pptx") return p < 40 ? "正在写入幻灯片…" : "正在重新打包未修改的部件…"
  if (x.ui.format === "md") return "正在转换文字…"
  const k = Math.min(x.count, Math.max(1, Math.ceil((p / 100) * x.count)))
  return x.count > 1 ? `正在生成第 ${k} / ${x.count} 页…` : "正在生成…"
}

function BusyBody({ x }: { x: ExportApi }) {
  const { ui } = x
  // 加载行（转圈 14 + 间距 8 + 一句话，DS-53）下面的说明句与那句话左对齐（缩进 22），句末加句号（DS-62）
  if (ui.phase === "waiting")
    return (
      <div className="flex flex-col px-4 py-3">
        <LoadingRow className="px-0">{`正在同步 ${ui.unsynced} 项更改…`}</LoadingRow>
        <p className="pl-[22px] text-[12px] leading-[18px] text-(--v3-text-2)">同步完成后将自动开始导出。</p>
      </div>
    )
  if (ui.phase === "queued")
    return (
      <div className="flex flex-col px-4 py-3">
        <LoadingRow className="px-0">正在排队，马上开始…</LoadingRow>
        <p className="pl-[22px] text-[12px] leading-[18px] text-(--v3-text-2)">{ui.format === "pdf" ? "PDF 由服务端生成，完成后自动下载。" : "图片由服务端生成，完成后自动下载。"}</p>
      </div>
    )
  return (
    <div className="flex flex-col p-4">
      {/* 文件名单行：长名中间省略、保留扩展名，完整名进工具提示，读屏念全名（FileName） */}
      <p className="text-[12px] leading-4 font-medium text-(--v3-text)">
        <FileName name={x.fileName} />
      </p>
      <div className="mt-3 flex items-center justify-between gap-3 text-[12px] leading-4 text-(--v3-text-2)">
        <span>{stageText(x)}</span>
        <span className="text-[11px] leading-none tabular-nums">{`${ui.progress}%`}</span>
      </div>
      <Progress value={ui.progress} label="导出进度" className="mt-2" />
      {/* 读屏：进入生成中播报一次（polite），百分比与逐页变化不逐条播报；完成由轻提示播报。文件名加书名号，同轻提示「已导出「X」」 */}
      <span role="status" className="sr-only">
        {`正在导出「${x.fileName}」`}
      </span>
    </div>
  )
}

/**
 * 「导出完成」里的文件大小（只给 DS-100 未采纳的备选 alt-done-state；示例值）：pptx 原样写回未修改的部件，大小与导入的原件（48.2 MB，import/data.ts MAIN_FILE）相当；
 * 其余格式按页数粗估（PNG 每页约 0.8 MB、SVG 约 0.5 MB），PDF 与插件的 Markdown 各一个示例值
 */
function exportedSize(x: ExportApi): string {
  switch (x.ui.format) {
    case "pptx":
      return "48.6 MB"
    case "pdf":
      return "12.4 MB"
    case "md":
      return "18 KB"
    case "png":
      return `${(x.count * 0.8).toFixed(1)} MB`
    case "svg":
      return `${(x.count * 0.5).toFixed(1)} MB`
  }
}

/* ================================================================== 对话框 */

/** 把焦点放到底栏的某颗按钮（阶段切换时原来的按钮随之换掉，焦点不掉到 body） */
function focusFooter(which: "primary" | "cancel") {
  const el = document.querySelector<HTMLElement>(`[role="dialog"] [data-export-${which}]`)
  el?.focus({ preventScroll: true })
}

export function ExportDialogLayer() {
  const x = useExport()
  const { ui, set, seed } = x
  const busy = isBusy(ui.phase)
  const block = seed.sync
  const unsynced = ui.phase === "options" && ui.unsynced > 0

  /** 开始导出（「导出」「仍要导出」）：服务端格式先排队；焦点交给「取消」 */
  const start = () => {
    flushSync(() => set({ phase: x.server ? "queued" : "generating", progress: 0, held: false }))
    focusFooter("cancel")
  }
  /** 「取消」、Esc、×（等待 / 排队 / 生成中）：停掉这次导出、回到选项，焦点落在「导出」 */
  const cancel = () => {
    flushSync(() => set({ phase: "options", progress: 0, held: false }))
    focusFooter("primary")
  }
  /** 关闭对话框：记住这次的格式与范围（D17），下次打开从选项页开始 */
  const close = () => set({ open: false, phase: "options", progress: 0 })
  const retry = () => {
    flushSync(() => set({ phase: x.server ? "queued" : "generating", progress: 0, held: false }))
    focusFooter("cancel")
  }

  let footer
  if (busy)
    footer = (
      <Button variant="secondary" data-export-cancel="" onClick={cancel}>
        取消
      </Button>
    )
  else if (ui.phase === "failed")
    footer = (
      <Button variant="secondary" data-export-cancel="" onClick={close}>
        关闭
      </Button>
    )
  else if (ui.phase === "done")
    footer = (
      <>
        {x.server && <Button variant="secondary">下载</Button>}
        <Button variant="primary" data-export-primary="" onClick={close}>
          完成
        </Button>
      </>
    )
  else if (unsynced) {
    const waitReason = block ? SYNC_REASON[block] : x.blockReason
    footer = (
      <>
        {x.server ? (
          <Button variant="secondary" data-export-cancel="" onClick={close}>
            取消
          </Button>
        ) : (
          // 浏览器生成的格式可以先导出本地最新内容（UX-05）；服务端格式没有这一项
          <Button variant="secondary" disabled={!!x.blockReason} reason={x.blockReason} onClick={start}>
            仍要导出
          </Button>
        )}
        <Button
          variant="primary"
          data-export-primary=""
          disabled={!!waitReason}
          reason={waitReason}
          onClick={() => {
            flushSync(() => set({ phase: "waiting", held: false }))
            focusFooter("cancel")
          }}
        >
          等待同步
        </Button>
      </>
    )
  } else
    footer = (
      <>
        <Button variant="secondary" data-export-cancel="" onClick={close}>
          取消
        </Button>
        <Button variant="primary" data-export-primary="" disabled={!!x.blockReason} reason={x.blockReason} onClick={start}>
          导出
        </Button>
      </>
    )

  return (
    <Dialog
      title={`导出「${DOC_TITLE}」`}
      open={ui.open}
      onOpenChange={(v) => {
        if (v) set({ open: true })
        else if (busy) cancel()
        else close()
      }}
      anchor="top"
      returnFocus="main-menu"
      // 等待同步、排队、生成中：× 与 Esc 是取消这次导出、回到选项（DS-101），名字随之写「取消导出」；点遮罩不关闭（误点不丢掉这次导出）；其余阶段是关闭对话框
      closeLabel={busy ? "取消导出" : undefined}
      dismissOnOutside={!busy}
      closeOnAction={false}
      bodyClassName="p-0"
      footer={footer}
    >
      {ui.phase === "options" ? (
        <OptionsBody x={x} />
      ) : busy ? (
        <BusyBody x={x} />
      ) : ui.phase === "failed" ? (
        <PanelState
          title="导出没有完成"
          className="py-10"
          action={
            <Button variant="secondary" onClick={retry}>
              重试
            </Button>
          }
        >
          {seed.failure ?? "生成文件时超时，请重试；文档本身不受影响"}
        </PanelState>
      ) : (
        // DS-100 未采纳的备选：停在「导出完成」（03-22 原画法），浏览器生成的格式已开始下载，服务端格式另给「下载」
        <PanelState tone="success" icon={<CircleCheck size={20} strokeWidth={1.5} aria-hidden="true" />} title="导出完成" className="py-10">
          {/* 整块状态居中、宽度收缩包裹：给绝对上限（正文宽 430 以内），长名在这里中间省略、大小照常跟在后面 */}
          <FileName name={x.fileName} suffix={` · ${exportedSize(x)}`} className="max-w-[400px]" />
        </PanelState>
      )}
    </Dialog>
  )
}

/** 格式的类型守卫（给 controller 用的小工具） */
export const isFormat = (v: string): v is Format => ["pptx", "png", "svg", "pdf", "md"].includes(v)
