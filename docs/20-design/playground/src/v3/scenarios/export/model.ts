import { DOC_TITLE, useEditor, useSceneState } from "../../kit"

/**
 * export 场景的状态与规则：格式、范围、页码校验、文件名、哪种格式在服务端生成。
 * 对话框（ExportDialog.tsx）与常驻控制件（controller.tsx：命令、⇧⌘E、计时、轻提示）读写同一份场景状态（kit useSceneState，换状态即复位）。
 */

export type Format = "pptx" | "png" | "svg" | "pdf" | "md"
export type Width = "1280" | "1920" | "3840"
export type RangeKind = "all" | "current" | "selected" | "custom"
/** options 选项页 · waiting 等待同步 · queued 服务端排队 · generating 生成中 · failed 失败 · done 停在「导出完成」（只给 DS-100 未采纳的备选 alt-done-state） */
export type Phase = "options" | "waiting" | "queued" | "generating" | "failed" | "done"
/** 不能同步的原因（「等待同步」留在原位不可用，原因按这个写） */
export type SyncBlock = "offline" | "reconnecting" | "auth" | "paused"
/**
 * 格式行文件类型图标里 DS-143 未采纳的两套（fileTypeIcons.tsx，只给 alt-icons-* 四态）：phosphor Phosphor Icons（字样 PPT）· bootstrap Bootstrap Icons（字样 PPTX）。
 * 采纳的 Tabler Icons 是底座的 kit FileTypeIcon，格式行缺省就用它（rulings §4.25 DS-143）
 */
export type IconSet = "phosphor" | "bootstrap"

/** 状态数据 data.export：这个状态一出现时对话框的样子（之后随用户操作变化） */
export interface ExportSeed {
  /** 对话框一出现就开着（缺省 true） */
  open?: boolean
  phase?: Phase
  format?: Format
  width?: Width
  range?: RangeKind
  custom?: string
  /** 自定义页码已经离开过输入框：错误一出现就显示 */
  customTouched?: boolean
  /** SVG「内嵌字体」 */
  fonts?: boolean
  progress?: number
  /** 未同步的更改条数（本端还没获服务端确认的更改，50/04 §8.3 pendingLocalUpdates） */
  unsynced?: number
  sync?: SyncBlock
  /** m3：M3 后半段（PDF 可用、PNG「全部页」改由服务端生成，DS-102）；缺省 M2 */
  milestone?: "m2" | "m3"
  /** 有插件贡献的导出格式（PRD PS-14，示例插件「Markdown 导出」） */
  plugin?: boolean
  /** 文档里有原样保留的部件（pptx 时底部说明「未修改的内容将原样保留」） */
  preserved?: boolean
  /** 无法显示 / 无法解析的内容（G-03）：处数与所在页 */
  degraded?: { count: number; pages: number[] }
  /** 已隐藏的页（放映时跳过）：图片与 PDF 的「全部页」缺省不含（DS-103） */
  hidden?: number[]
  /** 左栏多选中的页（「选定页」可用） */
  selected?: number[]
  /** 失败原因（失败态的说明） */
  failure?: string
  /** 完成后的收尾：toast 关闭对话框 + 轻提示（DS-100，缺省）· dialog 停在「导出完成」（DS-100 未采纳的备选） */
  done?: "toast" | "dialog"
  /** 一出现就有的完成轻提示 */
  toast?: { name: string; server?: boolean }
  /** 没有导出权限（评审者 / 查看者，doc.export 只到编辑者，U-09）：命令与 ⇧⌘E 不打开对话框 */
  noPermission?: boolean
  /**
   * 格式行左侧的文件类型图标换成 DS-143 未采纳的一套（只给 alt-icons-* 四态，fileTypeIcons.tsx）。
   * 不写即采纳的 Tabler Icons（kit FileTypeIcon，rulings §4.25 DS-143）；插件格式（plugin）没带图标时画同一套的通用文件字形（TB-182）
   */
  iconSet?: IconSet
}

export interface ExportUi {
  open: boolean
  phase: Phase
  format: Format
  width: Width
  range: RangeKind
  custom: string
  customTouched: boolean
  fonts: boolean
  progress: number
  unsynced: number
  toast: { name: string; server?: boolean; key: number } | null
  /** 演示定格：状态一出现就在等待 / 生成 / 轻提示时，用户第一次点按或按键后才开始走（静态截图不受时序影响，同保真提示条的 chipHold） */
  held: boolean
}

const BUSY: Phase[] = ["waiting", "queued", "generating"]
export const isBusy = (p: Phase) => BUSY.includes(p)

function initUi(seed: ExportSeed): ExportUi {
  const phase = seed.phase ?? "options"
  return {
    open: seed.open ?? true,
    phase,
    // 缺省 pptx + 全部页（PRD 07 D17：第一次打开；之后记住上次的格式与范围）
    format: seed.format ?? "pptx",
    width: seed.width ?? "1280",
    range: seed.range ?? "all",
    custom: seed.custom ?? "",
    customTouched: !!seed.customTouched,
    fonts: !!seed.fonts,
    progress: seed.progress ?? 0,
    unsynced: seed.unsynced ?? 0,
    toast: seed.toast ? { ...seed.toast, key: 0 } : null,
    held: isBusy(phase) || !!seed.toast,
  }
}

/* ------------------------------------------------------------------ 页码 */

export const FORMAT_ERROR = "页码格式不正确，请使用如 1,3,5-8 的格式"

/** 解析自定义页码（「1,3,5-8」；中文逗号、空格都认）：页码从小到大去重；格式不对或超出页数时给出错误 */
export function parsePages(text: string, total: number): { pages: number[]; error?: undefined } | { pages?: undefined; error: string } | { empty: true; pages?: undefined; error?: undefined } {
  const t = text.replace(/，/g, ",").replace(/\s+/g, "")
  if (!t) return { empty: true }
  const out = new Set<number>()
  for (const part of t.split(",")) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part)
    if (!m) return { error: FORMAT_ERROR }
    const a = Number(m[1])
    const b = m[2] ? Number(m[2]) : a
    if (a < 1 || b < a) return { error: FORMAT_ERROR }
    if (b > total) return { error: `第 ${a > total ? a : b} 页不存在，共 ${total} 页` }
    for (let i = a; i <= b; i++) out.add(i)
  }
  return { pages: [...out].sort((x, y) => x - y) }
}

/* ------------------------------------------------------------------ 格式 */

export interface FormatDef {
  id: Format
  label: string
  /** 行右侧的说明（次级文字） */
  hint: string
  /** 里程碑标记（不可用时） */
  tag?: string
  /** 不可用的原因（留在原位、不隐藏，FE-06） */
  reason?: string
  /** 插件贡献的格式：插件名（归属标识，06 §4） */
  owner?: string
}

export const LATER = "后续版本提供"

export function formatsFor(seed: ExportSeed): FormatDef[] {
  const m3 = seed.milestone === "m3"
  return [
    { id: "pptx", label: "PowerPoint（.pptx）", hint: "可在 PowerPoint 中继续编辑" },
    { id: "png", label: "PNG 图片", hint: "每页一张图片" },
    { id: "svg", label: "SVG 矢量图", hint: "每页一个矢量文件" },
    // PDF 在 M3 后半段（rulings §4.15 Q8、§4.24 AL-4）：之前留在原位、不可用、标 M3，不隐藏（§4.20 FE-06）
    m3 ? { id: "pdf", label: "PDF", hint: "由服务端生成，页面大小与幻灯片相同" } : { id: "pdf", label: "PDF", hint: LATER, tag: "M3", reason: LATER },
    // 插件贡献的格式：右侧写归属「来自「插件名」」（ExportDialog 的 OwnerHint），不另写格式说明
    ...(seed.plugin ? [{ id: "md" as const, label: "Markdown（.md）", hint: "来自「Markdown 导出」", owner: "Markdown 导出" }] : []),
  ]
}

const EXT: Record<Format, string> = { pptx: "pptx", png: "png", svg: "svg", pdf: "pdf", md: "md" }
/** 格式的简称（说明句里用） */
export const FORMAT_NAME: Record<Format, string> = { pptx: "PowerPoint", png: "PNG", svg: "SVG", pdf: "PDF", md: "Markdown" }

/* ------------------------------------------------------------------ 状态 + 推导 */

export function useExport() {
  const ed = useEditor()
  const seed = (ed.data.export ?? {}) as ExportSeed
  const [ui, setUi] = useSceneState<ExportUi>("export.ui", () => initUi(seed))
  const set = (patch: Partial<ExportUi>) => setUi((u) => ({ ...u, ...patch }))

  const total = ed.deck.length
  const hidden = seed.hidden ?? []
  const selected = seed.selected ?? []
  const m3 = seed.milestone === "m3"
  const f = ui.format
  /** pptx 与插件的 Markdown 只导整份（rulings §4.25 DS-103：pptx 不做部分页） */
  const wholeOnly = f === "pptx" || f === "md"
  const parsed = ui.range === "custom" ? parsePages(ui.custom, total) : null
  /** 这次导出的页数：图片与 PDF 的「全部页」缺省不含隐藏页（DS-103），点名到的隐藏页照常导出 */
  const count = wholeOnly
    ? total
    : ui.range === "all"
      ? total - hidden.length
      : ui.range === "current"
        ? 1
        : ui.range === "selected"
          ? selected.length
          : (parsed?.pages?.length ?? 0)
  /** 在服务端生成：PDF，以及 M3 起 PNG 的「全部页」（rulings §4.25 DS-102）——只含已同步的内容，有未同步更改时须先同步、不给「仍要导出」（rulings §4.18 UX-05） */
  const server = f === "pdf" || (m3 && f === "png" && ui.range === "all")
  /** 输出文件名 = 文档标题（PRD 07 D17）；多页图片打成一个 .zip（标题.zip 里「标题-01.png」…），单页写页码 */
  const pageNo = ui.range === "current" ? ed.slide : ui.range === "selected" ? (selected[0] ?? ed.slide) : (parsed?.pages?.[0] ?? 1)
  const fileName = wholeOnly || f === "pdf" ? `${DOC_TITLE}.${EXT[f]}` : count > 1 ? `${DOC_TITLE}.zip` : `${DOC_TITLE}-${String(pageNo).padStart(2, "0")}.${EXT[f]}`
  const customError = ui.range === "custom" && parsed?.error ? parsed.error : undefined
  /** 「导出」不可用的原因：自定义页码空着或有误 */
  const blockReason = ui.range === "custom" && !wholeOnly ? (customError ? "页码有误，改正后才能导出" : parsed && "empty" in parsed ? "请输入要导出的页码" : undefined) : undefined

  return { ed, seed, ui, set, total, hidden, selected, m3, wholeOnly, count, server, fileName, customError: ui.customTouched ? customError : undefined, blockReason }
}

export type ExportApi = ReturnType<typeof useExport>
