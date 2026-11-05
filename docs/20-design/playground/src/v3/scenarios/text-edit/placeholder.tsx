import { useState } from "react"
import { ChevronDown, ImageDown, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  CanvasTag, HitArea, HoverBox, ICON, Menu, PaperScope, PH_ITEMS, phItemState, PlaceholderIconBar, Popover, SelectionBox, TableGridPicker, Toast, Toasts, useEditor, useSceneState,
  type MenuSpec, type PhKind,
} from "../../kit"
import { InsertTableDialog } from "../table/InsertTableDialog"
import { OBJ_PROMPT_H, PH_FILLED, type PhFill, type Placeholder, type PhLayout } from "./pages"
import { pctBox, pctStyle, useSlideScale, type PtBox } from "./paper"

/**
 * 空内容占位符的快速插入图标条（G-80，50/21 §3）：图标条本体是 kit 的 PlaceholderIconBar（表格场景的占位符共用），这里负责
 * 按占位符类型过滤（obj 四项、pic 只图片）、按屏幕尺寸判断展开还是折叠为「插入 ▾」（四周各留 8px 放不下时折叠，菜单里是同一组条目）、拖入反馈与键盘提示。
 * 纸面恒为白色，界面件取亮色 token（kit PaperScope），焦点环与选中框同用当前主题的强调色。
 */

const kindsOf = (p: Placeholder): PhKind[] => (p.type === "obj" ? ["table", "picture", "chart", "video"] : p.type === "pic" ? ["picture"] : [])

const GAP = 8
const EDGE = 8

/* ------------------------------------------------------------------ 折叠形态：单个「插入 ▾」 */

function CollapsedInsert({ ph, kinds, menuOpen }: { ph: Placeholder; kinds: PhKind[]; menuOpen?: boolean }) {
  const [open, setOpen] = useState(!!menuOpen)
  /** 菜单里选了「表格」：在同一个按钮上弹出与工具条「表格」同一网格（Q2） */
  const [grid, setGrid] = useState(false)
  const anchor = `text-edit.ph-insert-${ph.id}`
  const hasDisabled = kinds.some((k) => phItemState(PH_ITEMS[k]).disabled)
  const items: MenuSpec[] = [
    { type: "label", label: "插入到占位符" },
    ...kinds.map((k): MenuSpec => {
      const it = PH_ITEMS[k]
      return { id: k, label: it.label, icon: <it.Icon {...ICON} />, tag: it.milestone, disabled: phItemState(it).disabled, onSelect: k === "table" ? () => setGrid(true) : undefined }
    }),
    ...(hasDisabled
      ? ([
          { type: "separator" },
          {
            type: "note",
            id: "text-edit.ph-insert-reason",
            // 与图标条提示同一段原因，按句分行（不断在词中间）；同面板里不可用的条目自动 aria-describedby 指向它
            text: (
              <>
                <span className="block">图表在 M3、视频在 P2 提供</span>
                <span className="block">文稿里已有的图表和视频照常查看和放映</span>
              </>
            ),
          },
        ] as MenuSpec[])
      : []),
  ]
  return (
    <>
      <button
        type="button"
        data-v3-anchor={anchor}
        aria-label="插入内容到占位符"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          // 叠加层在画布里：点按钮不应触发画布的「点空白取消选中」（kit 的菜单本身已挡住冒泡）
          e.stopPropagation()
          setOpen(true)
        }}
        // 36px 高（工具条按钮档），命中区外扩到 44px（触控）
        className={cn(
          "pointer-events-auto relative inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-(--v3-border) bg-(--v3-panel) pr-2 pl-2.5 text-[12px] leading-none font-medium text-(--v3-text) transition-colors hover:bg-(--v3-panel-2) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--paper-accent) focus-visible:outline-solid",
          "before:absolute before:-inset-1 before:content-['']",
          open && "bg-(--v3-panel-2)",
        )}
      >
        <Plus {...ICON} aria-hidden="true" />
        插入
        <ChevronDown size={12} strokeWidth={1.5} aria-hidden="true" className="text-(--v3-text-2)" />
      </button>
      <Menu anchor={anchor} open={open} onOpenChange={setOpen} side="bottom" align="center" sideOffset={6} label="插入到占位符" className="min-w-[208px]" items={items} />
      <PhTableGrid ph={ph} anchor={anchor} open={grid} onOpenChange={setGrid} />
    </>
  )
}

/* ------------------------------------------------------------------ 表格网格：填入占位符 */

/**
 * 占位符的表格网格（kit TableGridPicker，与工具条「表格」同一组件，Q2）：选定尺寸即在这个占位符里填入表格（宽取占位符框宽），
 * 一个撤销步——画布上轻提示带「撤销」（PhToasts）；「插入表格…」打开与工具条同一个行列对话框（表格场景的 InsertTableDialog）。
 */
function PhTableGrid({ ph, anchor, open, onOpenChange }: { ph: Placeholder; anchor: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { setSelection } = useEditor()
  const [, setFilled] = useSceneState<PhFill | null>(PH_FILLED, null)
  const [dialog, setDialog] = useState(false)
  return (
    <>
      <Popover anchor={anchor} open={open} onOpenChange={onOpenChange} side="bottom" align="center" sideOffset={8} label="插入表格到占位符" className="p-2">
        <TableGridPicker
          initial={{ r: 3, c: 4 }}
          note={
            <>
              填入这个占位符，表格宽度取<span className="whitespace-nowrap">占位符宽</span>
            </>
          }
          onPick={(r, c) => {
            setFilled({ id: ph.id, r, c, key: Date.now() })
            // 填入后占位符不再是空的：检查器回到幻灯片属性（表格的属性归表格场景，03-30）
            setSelection("none")
          }}
          onOpenDialog={() => setDialog(true)}
        />
      </Popover>
      {dialog && <InsertTableDialog onClose={() => setDialog(false)} />}
    </>
  )
}

/**
 * 填入表格之后的轻提示（放 canvasOverlay）：文案以 03-30 §2.3 为准（与 table 场景同一句，03-30 §12 第 22 行统一）——
 * 「已在占位符插入 R 行 × C 列表格，宽取占位符框宽」，第二行「填入是一个撤销步；删除内容后占位符恢复为空」；「撤销」把占位符恢复为空并重新选中它
 */
export function PhToasts() {
  const { setSelection } = useEditor()
  const [filled, setFilled] = useSceneState<PhFill | null>(PH_FILLED, null)
  if (!filled) return null
  return (
    <Toasts>
      <Toast
        key={filled.key}
        action="撤销"
        description="填入是一个撤销步；删除内容后占位符恢复为空"
        onAction={() => {
          setFilled(null)
          setSelection("placeholder-empty")
        }}
      >
        已在占位符插入{" "}
        <span className="tabular-nums">
          {filled.r} 行 × {filled.c} 列
        </span>
        表格，宽取占位符框宽
      </Toast>
    </Toasts>
  )
}

/* ------------------------------------------------------------------ 一个占位符的图标条（按屏幕框判断展开 / 折叠） */

function PhBar({ ph, scale, focusKind, tableOpen, menuOpen }: { ph: Placeholder; scale: number; focusKind?: PhKind; tableOpen?: boolean; menuOpen?: boolean }) {
  const kinds = kindsOf(ph)
  const [table, setTable] = useState(!!tableOpen)
  const inset = ph.type === "obj" ? OBJ_PROMPT_H : 0
  const region: PtBox = { x: ph.box.x, y: ph.box.y + inset, w: ph.box.w, h: ph.box.h - inset }
  const sw = region.w * scale
  const sh = region.h * scale
  const btn = kinds.length === 1 ? 72 : 64
  const barW = kinds.length * btn + (kinds.length - 1) * GAP
  const fits = barW + EDGE * 2 <= sw && btn + EDGE * 2 <= sh
  const hint = ph.type === "obj" ? "单击图标插入，或把图片拖到这里" : "单击图标添加图片"
  // 提示文字只在整条展开、上下左右都放得下、且没有键盘焦点或打开的网格（两者都在下方展开）时出现
  const showHint = fits && !focusKind && !table && btn + 12 + 16 + EDGE * 2 <= sh && hint.length * 12 + EDGE * 2 <= sw
  return (
    <div className="absolute flex flex-col items-center justify-center gap-3" style={pctStyle(region)}>
      {fits ? (
        <PlaceholderIconBar kinds={kinds} tableAnchor={`text-edit.ph-table-${ph.id}`} focusKind={focusKind} pressedKind={table ? "table" : undefined} onTable={() => setTable(true)} />
      ) : (
        <CollapsedInsert ph={ph} kinds={kinds} menuOpen={menuOpen} />
      )}
      {showHint && <p className="text-[12px] leading-4 whitespace-nowrap text-(--v3-text-2)">{hint}</p>}
      {fits && kinds.includes("table") && (
        // 与工具条「表格」同一个网格（kit TableGridPicker，Q2）
        <PhTableGrid ph={ph} anchor={`text-edit.ph-table-${ph.id}`} open={table} onOpenChange={setTable} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ 拖入图片：落点反馈 */

/** 拖动中的图片（文档内容，颜色不受界面限制）：平涂风景缩略图 + 「+ 1」计数 */
function DragGhost() {
  return (
    <div className="pointer-events-none absolute flex -rotate-3 items-end" aria-hidden="true">
      <svg viewBox="0 0 76 52" className="block h-[52px] w-[76px] rounded-[4px] shadow-(--v3-shadow) ring-2 ring-white">
        <rect width="76" height="52" rx="4" fill="#DCE7F7" />
        <circle cx="56" cy="15" r="6" fill="#F2C14E" />
        <path d="M0 42 20 24l14 12 10-8 32 24H0Z" fill="#7FA36B" />
        <path d="M0 52V40l16-10 22 22Z" fill="#5E8A55" />
      </svg>
      <span className="-ml-2 inline-flex h-[18px] translate-y-1.5 items-center rounded-[4px] bg-(--paper-accent) px-1.5 text-[11px] leading-none font-medium whitespace-nowrap text-white tabular-nums">+ 1</span>
    </div>
  )
}

function DropFeedback({ ph }: { ph: Placeholder }) {
  const b = ph.box
  return (
    <>
      <div className="pointer-events-none absolute flex flex-col items-center justify-center gap-2 px-4 text-center" style={pctStyle(b)}>
        <ImageDown size={32} strokeWidth={1.5} aria-hidden="true" className="text-(--paper-accent)" />
        <span className="text-[13px] leading-4 font-medium text-(--paper-accent)">松开以填入图片</span>
        <span className="text-[12px] leading-[18px] text-(--v3-text-2)">
          按占位符框裁剪填满，<span className="whitespace-nowrap">换版式时随占位符移动</span>
        </span>
      </div>
      <div className="pointer-events-none absolute" style={{ left: `${((b.x + b.w * 0.5) / 960) * 100}%`, top: `${((b.y + b.h * 0.76) / 540) * 100}%` }}>
        <DragGhost />
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ 叠加层 */

export interface PhOverlayProps {
  layout: PhLayout
  /** 可点选、检查器描述的那个占位符（缺省第一个内容占位符） */
  primary?: string
  /** 只读 / 评审：不出图标条，选中框不画手柄 */
  readOnly?: boolean
  /** 演示：键盘焦点停在 primary 的某个图标上，原因提示展开 */
  focusKind?: PhKind
  /** 演示：primary 的表格网格弹层开着 */
  tableOpen?: boolean
  /** 演示：primary 折叠后的「插入 ▾」菜单开着 */
  menuOpen?: boolean
  /** 演示：图片正拖到这个占位符上 */
  drop?: string
  /** 键盘提示（画布提示签，画在 primary 底部） */
  keyHint?: string
}

/**
 * 第 7 页（空占位符页）的叠加层：点选区域、选中框、各占位符的图标条、拖入反馈、键盘提示。
 * 用函数形式的 slideOverlay 挂上：初始的焦点 / 弹层 / 拖入只在 ctx.initial 时传入，用户点了别处就收起。
 */
export function PhOverlay({ layout, primary, readOnly, focusKind, tableOpen, menuOpen, drop, keyHint }: PhOverlayProps) {
  const { selection, setSelection } = useEditor()
  const { ref, scale } = useSlideScale()
  const [filled] = useSceneState<PhFill | null>(PH_FILLED, null)
  const main = layout.phs.find((p) => p.id === primary) ?? layout.phs.find((p) => p.type === "obj")!
  const editing = selection === "text"
  /** 已填入表格的占位符不再是空占位符：没有图标条、不能再选成 placeholder-empty */
  const mainFilled = filled?.id === main.id
  const bars = layout.phs.filter((p) => kindsOf(p).length > 0 && !(editing && p.id === main.id) && p.id !== drop && p.id !== filled?.id)
  return (
    <div ref={ref} className="pointer-events-none absolute inset-0">
      {/* 点选：提示行进入文字编辑，其余区域选中占位符（检查器 placeholder-empty） */}
      {/* 外层不接收指针（只有界面件接收）；点选区域要显式打开 pointer-events（属性会继承） */}
      {!editing && !mainFilled && (
        <div className="pointer-events-auto contents">
          <HitArea box={pctBox(main.box)} label={`选择${main.type === "obj" ? "内容" : "图片"}占位符`} onClick={() => setSelection("placeholder-empty")} />
          {main.type === "obj" && !readOnly && <HitArea box={pctBox({ ...main.box, h: OBJ_PROMPT_H })} label="在占位符里输入文字" cursor="text" onClick={() => setSelection("text")} />}
        </div>
      )}
      {selection === "placeholder-empty" && !mainFilled && <SelectionBox box={pctBox(main.box)} handles={readOnly ? "none" : "all"} />}
      {editing && <HoverBox box={pctBox(main.box)} />}

      {!readOnly && (
        <PaperScope className="pointer-events-none absolute inset-0">
          {bars.map((p) => (
            <PhBar key={p.id} ph={p} scale={scale} focusKind={p.id === main.id ? focusKind : undefined} tableOpen={p.id === main.id && tableOpen} menuOpen={p.id === main.id && menuOpen} />
          ))}
          {drop && layout.phs.find((p) => p.id === drop) && <DropFeedback ph={layout.phs.find((p) => p.id === drop)!} />}
        </PaperScope>
      )}

      {keyHint && (
        <CanvasTag at="-translate-x-1/2" box={{ x: ((main.box.x + main.box.w / 2) / 960) * 100, y: ((main.box.y + main.box.h - 40) / 540) * 100 }}>
          {keyHint}
        </CanvasTag>
      )}
    </div>
  )
}
