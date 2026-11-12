/**
 * 文件类型图标（rulings §4.25 DS-143、TB-182，2026-10-23）：导出对话框的格式行（单选圈与名称之间，export/ExportDialog.tsx）、
 * 导入对话框上传与解析阶段的文件名一行（import/dialog.tsx）、「导出本地副本」对话框的 .pptx 一行（offline-conflict/dialogs.tsx；.json 一行用 lucide FileBraces）。
 *
 * 来源（原件逐字照抄，只去掉尺寸）：npm 包 `@tabler/icons` 版本 3.49.0，许可证 MIT（Copyright (c) 2020-2026 Paweł Kuna；上游 github.com/tabler/tabler-icons 标签 v3.49.0），
 * 原文件 icons/outline/file-type-ppt.svg、icons/outline/file-type-png.svg、icons/outline/file-type-svg.svg、icons/outline/file-type-pdf.svg 与通用文件字形 icons/outline/file.svg；
 * 路径取包里的 tabler-nodes-outline.json（@tabler/icons-react 渲染用的同一份节点表），与 .svg 的可见路径逐字相同，只少了 .svg 里 stroke、fill 都是 none 的 24 × 24 占位框；
 * file-type-ppt 原件里折角那一笔写了两遍（上游如此），照抄，颜色不透明、画面相同。
 * 外层照原件：viewBox 0 0 24 24、fill none、stroke currentColor、圆端点与圆拐角；描边原件 2，这里取 1.5（与 v3 的 lucide 图标 ICON / ICON_LG 同一描边参数）。
 * 产品里把这几个 SVG 复制进 ui-react 的图标件、写明出处与许可证（MIT 随附版权与许可声明），不为它们新增运行时依赖（TB-182）；
 * 设计 04 §2.14「单一图标家族」只为文件类型图标开这一个例外（DS-143）。
 *
 * 字样：Tabler 没有 pptx，只有 file-type-ppt——图上字样是「PPT」，名称照旧写「PowerPoint（.pptx）」，图标只作装饰（DS-143）。
 * 尺寸缺省 20（DS-143：字样可辨；16px 时字高只剩约 4px）。颜色 currentColor：由所在的行给（kit RadioRow 的图标插槽：可用 text-2、不可用 text-3），选中不变色。
 * 只作装饰：aria-hidden，读屏名由旁边的文字给。
 * 没有专属图标的类型（插件贡献的格式，如 PS-14 的 Markdown）用通用 file 字形（TB-182），不留空位、不用 §2.14 的回退图标 Puzzle（这一格表示文件类型，插件归属由行右侧的 Blocks + 「来自「插件名」」表达）。
 *
 *   <RadioRow icon={<FileTypeIcon type="pptx" />} … />      · type 写格式 id / 扩展名（pptx、png、svg、pdf），其余都画通用 file 字形
 */

/** 有专属图标的类型（Tabler file-type-*） */
export type FileTypeIconType = "pptx" | "png" | "svg" | "pdf"

/** 缺省尺寸（DS-143） */
export const FILE_TYPE_ICON_SIZE = 20

const TABLER: Record<FileTypeIconType, string[]> = {
  // icons/outline/file-type-ppt.svg
  pptx: [
    "M14 3v4a1 1 0 0 0 1 1h4",
    "M14 3v4a1 1 0 0 0 1 1h4",
    "M5 18h1.5a1.5 1.5 0 0 0 0 -3h-1.5v6",
    "M11 18h1.5a1.5 1.5 0 0 0 0 -3h-1.5v6",
    "M16.5 15h3",
    "M18 15v6",
    "M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4",
  ],
  // icons/outline/file-type-png.svg
  png: [
    "M14 3v4a1 1 0 0 0 1 1h4",
    "M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4",
    "M20 15h-1a2 2 0 0 0 -2 2v2a2 2 0 0 0 2 2h1v-3",
    "M5 18h1.5a1.5 1.5 0 0 0 0 -3h-1.5v6",
    "M11 21v-6l3 6v-6",
  ],
  // icons/outline/file-type-svg.svg
  svg: [
    "M14 3v4a1 1 0 0 0 1 1h4",
    "M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4",
    "M4 20.25c0 .414 .336 .75 .75 .75h1.25a1 1 0 0 0 1 -1v-1a1 1 0 0 0 -1 -1h-1a1 1 0 0 1 -1 -1v-1a1 1 0 0 1 1 -1h1.25a.75 .75 0 0 1 .75 .75",
    "M10 15l2 6l2 -6",
    "M20 15h-1a2 2 0 0 0 -2 2v2a2 2 0 0 0 2 2h1v-3",
  ],
  // icons/outline/file-type-pdf.svg
  pdf: [
    "M14 3v4a1 1 0 0 0 1 1h4",
    "M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4",
    "M5 18h1.5a1.5 1.5 0 0 0 0 -3h-1.5v6",
    "M17 18h2",
    "M20 15h-3v6",
    "M11 15v6h1a2 2 0 0 0 2 -2v-2a2 2 0 0 0 -2 -2h-1",
  ],
}

/** 通用文件字形（没有专属图标的类型）：icons/outline/file.svg */
const TABLER_FILE: string[] = ["M14 3v4a1 1 0 0 0 1 1h4", "M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2"]

/** 这个类型有没有专属图标（没有的画通用 file 字形） */
export const hasFileTypeIcon = (type: string): type is FileTypeIconType => Object.prototype.hasOwnProperty.call(TABLER, type)

export function FileTypeIcon({ type, size = FILE_TYPE_ICON_SIZE, className }: { type: string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-v3-file-type={hasFileTypeIcon(type) ? type : "file"}
      className={className}
    >
      {(hasFileTypeIcon(type) ? TABLER[type] : TABLER_FILE).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}
