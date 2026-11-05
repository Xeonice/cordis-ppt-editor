import { ContextMenu, SHARE_LATER, Toast, Toasts } from "../../kit"
import { defineScenario, type EditorConfig } from "../types"
import { GridFlow } from "./GridPicker"
import { DialogFlow } from "./InsertTableDialog"
import "./inspector"
import { cellMenu } from "./menus"
import { TABLE_PAGE } from "./model"
import { tableOverlay } from "./overlays"
import type { TableData } from "./store"
import { deckFor } from "./TableSlide"

/**
 * 03-30 表格编辑（G-32 M2 插入与单元格文字、G-62 M3 结构与样式）在 v3 编辑器里的状态。
 *
 * v3 入口（DS-1，rulings §4.25）：
 * - 插入：底部工具条「表格」点开 8 × 10 网格（底部「插入表格…」开对话框）；空正文占位符的表格图标弹同一网格（Q2）。页上有空占位符时新表格填入它（Q1）。
 * - 格式：检查器按选中种类切换分区——table（整表）：位置与大小、表格样式与 6 个标志、文本（全部单元格）、替代文本；
 *   table-cell（格内编辑 / 选区）：表格样式（收起）、单元格（填充、10 种边框预设、边距、垂直对齐、文字方向）、文本（所选单元格）、行高与列宽。
 * - 结构（插删行列、合并拆分、删除表格）：右键菜单与 ⌘K；M3 起画布另有悬停「+」与分隔线手柄。
 * - 不设迷你工具条（rulings §4.25 DS-22，原规格的两种迷你条取消）：字符格式只在检查器「文本」分区，填充 / 边框在「单元格」分区，插入 / 合并 / 拆分在右键与 ⌘K（Q2 入口唯一）。
 * - 没有状态栏（DS-6）：「已选…」改为检查器面板标题，插入、合并、他人删除的反馈走轻提示。
 * 表格画在第 5 页「区域分布」（版式「标题和内容」），数据与示例文档第 4、5 页一致。
 */

const D = (table: TableData): EditorConfig["data"] => ({ table })

const EMPTY = deckFor("empty")
const NEW = deckFor("new")
const NEW_FREE = deckFor("new-free")
const DATA = deckFor("data")
const DATA_TOTAL = deckFor("data-total")
const MERGED = deckFor("merged")
const DELETED = deckFor("deleted")

/** 2 行 × 2 列选区：华东–华南 × 4 月–5 月（B2 到 C3，共 4 格） */
const RANGE = { r0: 1, c0: 1, r1: 2, c1: 2 }
/** 右键落点：选区里「华南 · 5 月」一格 */
const MENU_AT = { anchor: "slide", x: 0.61, y: 0.54 }

export default defineScenario({
  id: "table",
  title: "表格编辑",
  specs: ["03-30"],
  summary: "插入网格与对话框、格内编辑与选区、表格 / 单元格检查器（10 种边框预设、样式库）、右键结构菜单、M2 灰显与评审只读",
  editor: { slide: TABLE_PAGE, stage: { cursor: false } },
  states: [
    {
      id: "grid",
      title: "插入网格 · 3 行 × 4 列",
      note: "03-30 §2.1：工具条「表格」按下，网格弹层向上居中（8 行 × 10 列，悬停 3 × 4，读数在标题行右侧）；页上有空正文占位符，悬停框标出新表格将填入的位置（Q1）。选定即插入，「插入表格…」先关网格再开对话框；「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）",
      editor: {
        inspector: { share: SHARE_LATER },
        deck: EMPTY,
        toolbar: { tool: "table" },
        data: D({ variant: "empty", gridOpen: true }),
        slideOverlay: tableOverlay({ variant: "empty", milestone: "M2", placeholder: true, target: true }),
        layers: <GridFlow anchor="tool-table" />,
      },
    },
    {
      id: "placeholder-grid",
      title: "占位符 · 表格网格",
      note: "03-30 §2.3 / 03-16 §6.6：空正文占位符图标条的「表格」按下，弹出与工具条同一个网格（Q2）——图标正下方居中、距 8，网格下一行「填入这个占位符，表格宽度取占位符宽」，下方放不下时翻到上方（TB-10）；图表 M3、视频 P2 禁用而不隐藏（图标条规格见 03-16）；「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）",
      editor: {
        inspector: { share: SHARE_LATER },
        deck: EMPTY,
        data: D({ variant: "empty", gridOpen: true }),
        slideOverlay: tableOverlay({ variant: "empty", milestone: "M2", placeholder: true, phGrid: true, target: true }),
        layers: <GridFlow anchor="table.ph-table" />,
      },
    },
    {
      id: "table-dialog",
      title: "插入表格对话框",
      note: "03-30 §2.2（rulings §4.25 TB-8）：「插入表格…」对话框（宽 360），初值 12 × 4（超出网格范围）；说明行只写「行数、列数各 1–75」（「上限待性能评估」是工程备注，不写进界面），主按钮「插入」；可直接改值看即时校验；「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）",
      editor: {
        inspector: { share: SHARE_LATER },
        deck: EMPTY,
        toolbar: { tool: "table" },
        data: D({ variant: "empty" }),
        slideOverlay: tableOverlay({ variant: "empty", milestone: "M2", placeholder: true }),
        layers: <DialogFlow rows="12" cols="4" />,
      },
    },
    {
      id: "table-dialog-error",
      title: "对话框 · 超出上限",
      note: "03-30 §2.2：行数 80，说明行就地变为内联错误（危险色、role=alert），行数字段 aria-invalid；主按钮「插入」aria-disabled、可聚焦，悬停复述错误（TB-8）；「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）",
      editor: {
        inspector: { share: SHARE_LATER },
        deck: EMPTY,
        toolbar: { tool: "table" },
        data: D({ variant: "empty" }),
        slideOverlay: tableOverlay({ variant: "empty", milestone: "M2", placeholder: true }),
        layers: <DialogFlow rows="80" cols="4" />,
      },
    },
    {
      id: "inserted",
      title: "插入后 · 首格光标",
      note: "03-30 §2.4：3 × 4 新表格填入空正文占位符（宽取占位符框宽、行高 29.5 pt），中度样式 2 - 强调 1；首格在强调色标题行上用白 + 深蓝双层环与白色插入符；检查器 table-cell 只展开「文本」，M3 分区带标记并锁定；轻提示取代状态栏反馈；「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）",
      editor: {
        inspector: { share: SHARE_LATER },
        deck: NEW,
        selection: "table-cell",
        data: D({ variant: "new", milestone: "M2", open: ["text"], cellTitle: "第 1 行第 1 列", cellExtra: "新表格 3 × 4", selCols: [0, 0], textBold: true }),
        slideOverlay: tableOverlay({ variant: "new", milestone: "M2", frame: "edit", ring: { r0: 0, c0: 0 }, caret: { r: 0, c: 0 } }),
        canvasOverlay: (
          <Toasts>
            <Toast description="填入是一个撤销步；删除内容后占位符恢复为空">已在占位符插入 3 行 × 4 列表格，宽取占位符框宽</Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "inserted-free",
      title: "插入后 · 页上没有空占位符",
      note: "03-30 §2.4、图 2：版式「仅标题」没有空内容占位符时，新表格宽取页宽 80%、水平居中、垂直落在视口中心，同样进首格编辑；轻提示为 03-04 的插入文案（M2 可编辑单元格文字，结构与样式在 M3）；「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）",
      editor: {
        inspector: { share: SHARE_LATER },
        deck: NEW_FREE,
        selection: "table-cell",
        data: D({ variant: "new-free", milestone: "M2", open: ["text"], cellTitle: "第 1 行第 1 列", cellExtra: "新表格 3 × 4", selCols: [0, 0], textBold: true }),
        slideOverlay: tableOverlay({ variant: "new-free", milestone: "M2", frame: "edit", ring: { r0: 0, c0: 0 }, caret: { r: 0, c: 0 } }),
        canvasOverlay: (
          <Toasts>
            <Toast description="M2 可编辑单元格文字；行列增删、合并与样式在 M3">已插入 3 行 × 4 列表格</Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "cell-nav",
      title: "单元格编辑 · Tab 导航",
      note: "03-30 §3：第 3 行第 3 列编辑中（2px 强调色内描边 + 插入符），表格外框不画缩放手柄；表格下方的按键提示签是演示说明（签首「演示」标记），产品不画（TB-9）。M2 末格 Tab 不加行、播报「已是最后一个单元格」，M3 末格 Tab 新增一行；「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）",
      editor: {
        inspector: { share: SHARE_LATER },
        deck: DATA,
        selection: "table-cell",
        data: D({ variant: "data", milestone: "M2", open: ["cell", "text"], cellTitle: "第 3 行第 3 列", selCols: [2, 2] }),
        slideOverlay: tableOverlay({ variant: "data", milestone: "M2", frame: "edit", ring: { r0: 2, c0: 2 }, caret: { r: 2, c: 2, end: true }, keyHint: true }),
      },
    },
    {
      id: "m2-range",
      title: "M2 · 单元格选区",
      note: "03-30 §4：2 行 × 2 列选区，所选格主色覆盖 + 外沿 2px 描边；M2 可批量改字、Delete 清空、复制。结构入口禁用而不隐藏：检查器「单元格」「行高与列宽」带 M3 标记并锁定，右键见下一态（v3 不画迷你工具条）；「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）",
      editor: {
        inspector: { share: SHARE_LATER },
        deck: DATA,
        selection: "table-cell",
        data: D({ variant: "data", milestone: "M2", open: ["cell", "text"], cellTitle: "2 行 × 2 列", selCols: [1, 2] }),
        slideOverlay: tableOverlay({ variant: "data", milestone: "M2", frame: "edit", range: RANGE }),
      },
    },
    {
      id: "m2-menu",
      title: "M2 · 右键结构编辑灰显",
      note: "03-30 §5.3：同一菜单在 M2——「插入」小标题换成常驻说明行（结构项以 aria-describedby 指向它），行列插删与合并拆分禁用，剪贴板项与「删除表格」可用；「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）",
      editor: {
        inspector: { share: SHARE_LATER },
        deck: DATA,
        selection: "table-cell",
        data: D({ variant: "data", milestone: "M2", open: ["cell", "text"], cellTitle: "2 行 × 2 列", selCols: [1, 2] }),
        slideOverlay: tableOverlay({ variant: "data", milestone: "M2", frame: "edit", range: RANGE }),
        layers: <ContextMenu at={MENU_AT} items={cellMenu("m2")} label="单元格" />,
      },
    },
    {
      id: "range",
      title: "M3 · 单元格选区",
      note: "03-30 §4：M3 的同一选区，检查器「单元格」分区可用（填充、边框、边距、垂直对齐、文字方向）；插入 / 合并 / 拆分走右键与 ⌘K，不另设选区工具条",
      editor: {
        deck: DATA,
        selection: "table-cell",
        data: D({ variant: "data", milestone: "M3", open: ["cell", "text"], cellTitle: "2 行 × 2 列", selCols: [1, 2] }),
        slideOverlay: tableOverlay({ variant: "data", milestone: "M3", frame: "edit", range: RANGE }),
      },
    },
    {
      id: "context-menu",
      title: "M3 · 右键行列与合并",
      note: "03-30 §5.3：选区上的右键菜单平铺——剪贴板 ┊ 插入四项 ┊ 合并、拆分… ┊ 删除行 / 列 / 表格（危险色）；普通格上「拆分单元格…」禁用并写明原因",
      editor: {
        deck: DATA,
        selection: "table-cell",
        data: D({ variant: "data", milestone: "M3", open: ["cell", "text"], cellTitle: "2 行 × 2 列", selCols: [1, 2] }),
        slideOverlay: tableOverlay({ variant: "data", milestone: "M3", frame: "edit", range: RANGE }),
        layers: <ContextMenu at={MENU_AT} items={cellMenu("m3")} label="单元格" />,
      },
    },
    {
      id: "merged",
      title: "M3 · 合并单元格后",
      note: "03-30 §5.4：「区域」跨 2 行、标题跨 3 列（沿用该列右对齐），只有第一行是标题行；选中的是合并格（双层环），外框只有选中框；轻提示「已合并 3 个单元格」带撤销",
      editor: {
        deck: MERGED,
        selection: "table-cell",
        data: D({ variant: "merged", milestone: "M3", open: ["cell", "text"], cellKind: "合并单元格", cellTitle: "1 行 × 3 列", selCols: [1, 3], textBold: true }),
        slideOverlay: tableOverlay({ variant: "merged", milestone: "M3", frame: "edit", ring: { r0: 0, c0: 1, r1: 0, c1: 3 } }),
        canvasOverlay: (
          <Toasts>
            <Toast action="撤销">已合并 3 个单元格</Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "borders",
      title: "M3 · 边框选择器",
      note: "03-30 §6.4：检查器「单元格」10 种边框预设（5 × 2 单选组）选「外侧框线」，线型 / 粗细 / 颜色在下一行；画布按预设预览出线，预览期间不画选区描边。点其他预设，画布预览跟着变",
      editor: {
        deck: DATA,
        selection: "table-cell",
        data: D({ variant: "data", milestone: "M3", open: ["cell"], cellTitle: "2 行 × 2 列", selCols: [1, 2], border: "outer" }),
        slideOverlay: tableOverlay({ variant: "data", milestone: "M3", frame: "edit", range: RANGE, borders: true }),
      },
    },
    {
      id: "hover-insert",
      title: "M3 · 悬停插入手柄",
      note: "03-30 §5.1：整表选中（8 个缩放手柄）；行首「+」悬停中，第 4、5 行（华北、西部）之间画插入位置虚线，点击即插入一行；列顶「+」未停留时 45% 不透明度。M2 不出现画布手柄",
      editor: {
        deck: DATA,
        selection: "table",
        data: D({ variant: "data", milestone: "M3", open: ["position", "style"] }),
        slideOverlay: tableOverlay({ variant: "data", milestone: "M3", frame: "whole", insertHandles: true }),
      },
    },
    {
      id: "resize",
      title: "M3 · 拖分隔线调列宽",
      note: "03-30 §5.2：第 1 列右分隔线拖动中——原位淡线、新位虚线、中点拖动柄，角标「第 1 列 216 → 252 pt · 右侧列等量收窄」；松手为一个撤销步，Esc 撤掉预览",
      editor: {
        deck: DATA,
        selection: "table",
        data: D({ variant: "data", milestone: "M3", open: ["position", "style"] }),
        slideOverlay: tableOverlay({ variant: "data", milestone: "M3", frame: "whole", resize: true }),
      },
    },
    {
      id: "styles",
      title: "M3 · 表格样式库与 6 个标志",
      note: "03-30 §6.3：整表选中，表格开了汇总行与第一列；样式库收起态（文档中 → 浅色 → 中等 → 深色），当前样式外圈；点缩略图或勾标志，画布、缩略图与左栏同时刷新",
      editor: {
        deck: DATA_TOTAL,
        selection: "table",
        data: D({ variant: "data-total", milestone: "M3", open: ["style"], flags: { totalRow: true, firstCol: true } }),
        slideOverlay: tableOverlay({ variant: "data-total", milestone: "M3", frame: "whole" }),
      },
    },
    {
      id: "styles-all",
      title: "M3 · 样式库全部 74 种",
      note: "03-30 §6.3：「显示全部 74 种」展开，组头带计数（浅色 · 21、中等 · 28、深色 · 11、其它 · 14），检查器内下滚到底是「收起」；展开 / 收起是查看操作，M2 与只读时照常可用",
      editor: {
        deck: DATA_TOTAL,
        selection: "table",
        data: D({ variant: "data-total", milestone: "M3", open: ["style"], flags: { totalRow: true, firstCol: true }, stylesExpanded: true }),
        slideOverlay: tableOverlay({ variant: "data-total", milestone: "M3", frame: "whole" }),
      },
    },
    {
      id: "remote-delete",
      title: "他人删除了正在编辑的行",
      note: "03-30 §7：王小明删除了「华南」行，本端退出单元格编辑回到整表选中；轻提示「该行已被 王小明 删除」+「恢复该行」（恢复是本端新事务，已提交的键入一起回来）",
      editor: {
        deck: DELETED,
        selection: "table",
        data: D({ variant: "deleted", milestone: "M3", open: ["position", "style"] }),
        stage: { cursor: { at: "left-[86%] top-[72%]", name: "王小明" } },
        slideOverlay: tableOverlay({ variant: "deleted", milestone: "M3", frame: "whole" }),
        canvasOverlay: (
          <Toasts>
            <Toast action="恢复该行" description="恢复即可找回你在该行的修改">
              该行已被 王小明 删除
            </Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "readonly",
      title: "评审者 · 只读",
      note: "03-30 §9 + DS-15：评审角色不能进入单元格编辑，画布只留表格外框（无插入符、选区与手柄），空占位符不出图标条；检查器固定为 table、只读展示当前值（位置与大小、样式名与勾选的选项、文字、替代文本，不画禁用控件与样式库），顶部一行说明权限；右键除「复制」外全部禁用，原因写在顶部一行，「插入」小标题换回带 M3 标记（权限先于里程碑）；「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）",
      editor: {
        inspector: { share: SHARE_LATER },
        deck: DATA,
        selection: "table",
        data: D({ variant: "data", milestone: "M2", readOnly: true, open: ["position", "style"] }),
        // mode = review：评审条、左栏不提供新建、检查器只读并注明（与 03-02 评审模式同一外壳）；评审者没有编辑权限，评审条不出现「返回编辑」
        mode: "review",
        toolbar: { canEdit: false },
        slideOverlay: tableOverlay({ variant: "data", milestone: "M2", readOnly: true, frame: "edit" }),
        layers: <ContextMenu at={MENU_AT} items={cellMenu("readonly")} label="单元格" />,
      },
    },
  ],
})
