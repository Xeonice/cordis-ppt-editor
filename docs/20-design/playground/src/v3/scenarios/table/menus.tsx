import {
  BetweenHorizontalEnd, BetweenHorizontalStart, BetweenVerticalEnd, BetweenVerticalStart, ClipboardPaste, Copy, Eraser, Scissors, TableCellsMerge, TableCellsSplit, Trash2,
} from "lucide-react"
import { ICON, type MenuSpec } from "../../kit"

/**
 * 表格单元格右键菜单（03-30 §5.3、03-05「表格单元格变体」）：平铺不用子菜单——
 * 剪贴板（剪切、复制、粘贴、删除文本）┊ 插入（四项）┊ 合并、拆分… ┊ 删除行、删除列、删除表格（危险色）。
 * 判定顺序见 03-30 图 6：复制总可用 → 权限 → 剪贴板项与删除表格 → 里程碑 → 选区条件。
 * 不可用的原因：单项条件写在右侧（如普通格的「拆分单元格…」）；一组项共用同一原因时改为菜单内一行常驻说明（M2 的结构项、评审者的编辑项，03-05）。
 * 说明行用 kit Menu 的 note（带 id 时，同一面板里没写 reason 的不可用项自动 aria-describedby 指向它）；不可用项 aria-disabled、仍可聚焦（03-30 §5.3）。
 */

const ic = {
  cut: <Scissors {...ICON} />,
  copy: <Copy {...ICON} />,
  paste: <ClipboardPaste {...ICON} />,
  clear: <Eraser {...ICON} />,
  above: <BetweenHorizontalStart {...ICON} />,
  below: <BetweenHorizontalEnd {...ICON} />,
  left: <BetweenVerticalStart {...ICON} />,
  right: <BetweenVerticalEnd {...ICON} />,
  merge: <TableCellsMerge {...ICON} />,
  split: <TableCellsSplit {...ICON} />,
  del: <Trash2 {...ICON} />,
}

export const SPLIT_REASON = "只有合并过的单元格可以拆分"

/**
 * mode：m3 结构项可用（合并需选区 ≥ 2 格、拆分只对合并格）；m2 结构项禁用并指向常驻说明行，删除表格可用；
 * readonly 评审 / 查看角色：除复制外全部禁用，原因「需要编辑权限」写在顶部一行，「插入」小标题换回带 M3 标记的普通小标题（权限先于里程碑）。
 */
export function cellMenu(mode: "m3" | "m2" | "readonly", opts: { mergedCell?: boolean } = {}): MenuSpec[] {
  const ro = mode === "readonly"
  const m2 = mode === "m2"
  const struct = ro || m2
  const head: MenuSpec[] = ro ? [{ type: "note", id: "table-ro-note", text: "需要编辑权限：评审模式下只能复制" }, { type: "separator" }] : []
  return [
    ...head,
    { id: "cut", label: "剪切", icon: ic.cut, kbd: "⌘X", disabled: ro },
    { id: "copy", label: "复制", icon: ic.copy, kbd: "⌘C" },
    { id: "paste", label: "粘贴", icon: ic.paste, kbd: "⌘V", disabled: ro },
    { id: "clear", label: "删除文本", icon: ic.clear, kbd: "⌫", disabled: ro },
    { type: "separator" },
    m2
      ? { type: "note", id: "table-m2-note", tag: "M3", text: "表格结构编辑将在后续版本提供；当前可编辑单元格文字与字符格式" }
      : { type: "label", label: "插入", tag: ro ? "M3" : undefined },
    { id: "row-above", label: "在上方插入行", icon: ic.above, disabled: struct },
    { id: "row-below", label: "在下方插入行", icon: ic.below, disabled: struct },
    { id: "col-left", label: "在左侧插入列", icon: ic.left, disabled: struct },
    { id: "col-right", label: "在右侧插入列", icon: ic.right, disabled: struct },
    { type: "separator" },
    { id: "merge", label: "合并单元格", icon: ic.merge, disabled: struct },
    { id: "split", label: "拆分单元格…", icon: ic.split, disabled: struct || !opts.mergedCell, reason: struct ? undefined : opts.mergedCell ? undefined : SPLIT_REASON },
    { type: "separator" },
    { id: "del-row", label: "删除行", icon: ic.del, danger: true, disabled: struct },
    { id: "del-col", label: "删除列", icon: ic.del, danger: true, disabled: struct },
    { id: "del-table", label: "删除表格", icon: ic.del, danger: true, disabled: ro },
  ]
}
