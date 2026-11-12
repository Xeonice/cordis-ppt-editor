import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react"
import {
  ChartColumn, ChevronLeft, ChevronRight, Eye, Highlighter, Image as ImageIcon, MessageSquare, MousePointer2, Plus, Shapes, Table, Type, type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useRunCommand } from "../kit/commands"
import { closeWithFocusBack, tabbables } from "../kit/layer"
import { Menu, type MenuSpec } from "../kit/Menu"
import { useSceneState } from "../kit/scene"
import { Popover } from "../kit/Popover"
import { TableGridPicker } from "../kit/TableGridPicker"
import { SHAPES } from "../shape-icons"
import { Button, ICON, ICON_LG, IconButton, Tip } from "../ui"
import { useEditorMaybe } from "./context"
import { getToolLayer, IMAGE_MENU, moreMenu } from "./insert-menus"
import { QUICK_SHAPE_IDS } from "./shapes/catalog"
import { SHAPE_COUNT, ShapeLibrary } from "./shapes/ShapeLibrary"

export type ToolId = "select" | "text" | "shapes" | "image" | "table" | "chart" | "comment" | "highlight"
/** 可以设为不可用的工具条条目：工具 id 或「更多」 */
export type ToolKey = Exclude<ToolId, "highlight"> | "more"

/**
 * 创建工具。工具提示里的单字母键按 PRD ED-16（2026-10-05 补登，rulings §4.25 DS-11）：选择 V、文本 T、形状 S、评论 C；
 * 图片、表格、图表与「更多」不设单键。单键只在焦点位于画布或工具条、且不在文本编辑态与 IME 组合态时生效，输入框内不触发。
 */
export const CREATE_TOOLS: { id: Exclude<ToolId, "select" | "highlight">; label: string; kbd?: string; Icon: LucideIcon }[] = [
  { id: "text", label: "文本", kbd: "T", Icon: Type },
  { id: "shapes", label: "形状", kbd: "S", Icon: Shapes },
  { id: "image", label: "图片", Icon: ImageIcon },
  { id: "table", label: "表格", Icon: Table },
  { id: "chart", label: "图表", Icon: ChartColumn },
  { id: "comment", label: "评论", kbd: "C", Icon: MessageSquare },
]

/** 工具条上带菜单 / 弹层的工具：图片 ▾、表格网格、图表类型菜单（03-04、03-30 §2.1、03-31） */
export type ToolMenuId = "image" | "table" | "chart"

/**
 * 工具弹层开着哪一个（场景仓键，值为 ToolMenuId 或 null）：状态的 toolbar.menu 是演示初值，只在编辑器载入后第一次读取时生效（kit useSceneState），
 * 工具条卸载再挂上（母版视图里换成母版工具条、退出后换回来）不再按初值弹出——与「单页 → 网格 → 单页」往返相同（网格视图里工具条不卸载、弹层不再弹出），
 * 也与宿主保管的形状弹层（shapesOpen）同一口径；宿主进出母版视图时与形状弹层一起收起。2026-10-29 补完（复验 R2-N3、R4-N3：chart.menu 母版往返后「插入图表」又弹出、焦点进菜单）
 */
export const TOOL_MENU_KEY = "v3.toolbar.menu"

/**
 * 给菜单条目接上登记过的面板（editor/insert-menus.tsx registerToolLayer）：「更多 › 页眉和页脚…」「图片 › 来自 URL…」等选了即打开对应的对话框 / 弹层；
 * 没有登记的条目选了只关菜单。prefix 是登记 id 的前缀（more / image）。
 */
function wireLayers(items: MenuSpec[], prefix: string, open: (id: string) => void, alias: Record<string, string> = {}): MenuSpec[] {
  return items.map((it) => {
    if (it.type !== undefined && it.type !== "item") return it
    const id = `${prefix}:${alias[it.id] ?? it.id}`
    if (it.disabled || !getToolLayer(id)) return it
    const own = it.onSelect
    return { ...it, onSelect: () => (own?.(), open(id)) }
  })
}

/**
 * 场景里静态打开的插入菜单（insert.more、insert.image-menu…）也接上同一批面板：返回接好的条目与要渲染的面板节点。
 *   const [items, layer] = useWiredMenu(moreMenu(false), "more", MORE_ALIAS_OUTSIDE_TEXT)
 */
export function useWiredMenu(items: MenuSpec[], prefix: string, alias?: Record<string, string>): [MenuSpec[], ReactNode] {
  const [layer, open] = useToolLayer()
  return [wireLayers(items, prefix, open, alias), layer]
}

/** 不在文本编辑态时「日期和时间…」「幻灯片编号…」打开页眉和页脚对话框（菜单右侧已注明） */
export const MORE_ALIAS_OUTSIDE_TEXT: Record<string, string> = { date: "header-footer", "slide-number": "header-footer" }

/** 工具条打开的对话框 / 弹层（登记过的面板）：每次打开挂一份新的（key 递增），关闭后由它自己收起。 */
function useToolLayer() {
  const [layer, setLayer] = useState<{ id: string; n: number } | null>(null)
  const open = (id: string) => setLayer((cur) => ({ id, n: (cur?.n ?? 0) + 1 }))
  const Render = layer ? getToolLayer(layer.id) : undefined
  const node = layer && Render ? <Render key={layer.n} open onOpenChange={(v) => !v && setLayer(null)} /> : null
  return [node, open] as const
}

/* ------------------------------------------------------------------ 公共件：所有形态的工具条共用（编辑、评审、浏览、母版视图…） */

/** 工具条外框：画布底部居中、实色 panel 底 + 细边 + 浮层阴影，圆角 12px，内边距 4。 */
export const TOOLBAR_BAR =
  "absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-[12px] border border-(--v3-border) bg-(--v3-panel) p-1 shadow-(--v3-shadow) select-none"

/** 工具条外框（role=toolbar，锚点 toolbar）。只放一句提示时用 role="status"。 */
export function ToolbarShell({ label, role = "toolbar", children }: { label?: string; role?: "toolbar" | "status"; children: ReactNode }) {
  return (
    <div role={role} aria-label={label} data-v3-anchor="toolbar" className={TOOLBAR_BAR}>
      {children}
    </div>
  )
}

/**
 * 「选择」：36px 工具按钮，当前工具时强调色底；可不可用（工具提示「选择 · 原因」）。label 可换成「浏览」（评审条）。
 * 原样张的「选择 ▾」去掉了 ▾：PRD 里没有第二种选择类工具（平移是空格 + 拖动、滚轮与触控板，ED-22），▾ 没有可放的条目（同 DS-19「无对应能力的入口从样张删除」）。
 */
export function SelectTool({ on, onClick, disabled, reason, label = "选择" }: { on: boolean; onClick?: () => void; disabled?: boolean; reason?: string; label?: string }) {
  return <ToolButton anchor="tool-select" label={label} kbd="V" Icon={MousePointer2} on={on} onClick={onClick} disabled={disabled} reason={reason} />
}

/** 一个 36px 工具按钮：当前工具强调色底白图标；不可用时 text-3、工具提示「名称 · 原因」（tipOpen 常开、tipLines 按句分行）。 */
export function ToolButton({
  anchor,
  label,
  tip,
  kbd,
  Icon,
  on = false,
  onClick,
  disabled,
  reason,
  tipOpen,
  tipLines,
  hasPopup,
  expanded,
}: {
  /** 锚点名，如 tool-text */
  anchor?: string
  label: string
  /** 可用时的工具提示（缺省同 label） */
  tip?: string
  kbd?: string
  Icon: LucideIcon
  on?: boolean
  onClick?: () => void
  disabled?: boolean
  reason?: string
  tipOpen?: boolean
  tipLines?: string[]
  /** 点了弹出菜单 / 面板（aria-haspopup） */
  hasPopup?: "menu" | "dialog"
  /** 弹层开着（aria-expanded） */
  expanded?: boolean
}) {
  return (
    <IconButton
      label={label}
      tip={disabled ? undefined : tip}
      aria-haspopup={hasPopup}
      aria-expanded={expanded}
      kbd={kbd}
      size={36}
      variant={on && !disabled ? "accent" : "ghost"}
      pressed={on}
      disabled={disabled}
      reason={reason}
      tipOpen={tipOpen}
      tipLines={tipLines}
      tipHidden={expanded}
      onClick={onClick}
      data-v3-anchor={anchor}
    >
      <Icon {...ICON_LG} />
    </IconButton>
  )
}

/**
 * 「更多 +」：其余插入项的菜单（insert-menus.tsx moreMenu，与 insert.more 定稿同一份；插件按钮也进这里）。
 * 文本编辑态（选中种类 text）时符号、日期和时间、幻灯片编号换成插在光标处的版本；不可用项留在原位并写原因（FE-06）。
 * 条目登记了面板的（页眉和页脚、图标…）选了即打开；关闭后焦点回到「更多」。不可用时同 ToolButton。
 * items：换掉条目（toolbar.moreItems，插件收纳这类状态静态打开的「更多」与这里同一份，重开时一致）；缺省底座 moreMenu。
 */
export function MoreTool({ disabled, reason, tipOpen, tipLines, items }: { disabled?: boolean; reason?: string; tipOpen?: boolean; tipLines?: string[]; items?: MenuSpec[] }) {
  const ed = useEditorMaybe()
  const [layer, openLayer] = useToolLayer()
  if (disabled) return <ToolButton anchor="tool-more" label="更多" Icon={Plus} disabled reason={reason} tipOpen={tipOpen} tipLines={tipLines} />
  return (
    <>
      <Menu
        items={wireLayers(items ?? moreMenu(ed?.selection === "text"), "more", openLayer, ed?.selection === "text" ? {} : MORE_ALIAS_OUTSIDE_TEXT)}
        side="top"
        sideOffset={12}
        align="center"
        label="更多插入"
        trigger={
          <IconButton label="更多" size={36} noTip aria-haspopup="menu" data-v3-anchor="tool-more">
            <Plus {...ICON_LG} />
          </IconButton>
        }
      />
      {layer}
    </>
  )
}

/** 工具条里的分组竖线 */
export function ToolbarDivider() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-(--v3-border)" />
}

/** 模式标识（「评审模式」「只读浏览中」）：12px text-2，可带 16px 图标，高 36。 */
export function ToolbarLabel({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="flex h-9 shrink-0 items-center gap-1.5 px-2 text-[12px] leading-none whitespace-nowrap text-(--v3-text-2)">
      {icon}
      {children}
    </span>
  )
}

/** 评论导航的接线（评审条 / 浏览条透传给 CommentNav）：翻到上一处 / 下一处、没有可翻的评论时的原因 */
export interface CommentNavWiring {
  onPrev?: () => void
  onNext?: () => void
  /** count 为 0 时两枚箭头不可用并写这个原因（如「没有未解决的评论」）；不给就照常可点 */
  emptyReason?: string
}

/**
 * 上一处 / 下一处评论：两枚 36px 箭头夹着计数，一看就知道翻的是评论（不是翻页）。
 * 点按缺省发底座命令 comment.prev / comment.next（kit/commands.ts，评论场景接住、按页码与落点定位）；直接传 onPrev / onNext 时以传入的为准。
 * locked：整条不可用（打开中，03-02 §6.2）——计数换成「评论」、退到 text-3，两枚箭头不可用并写原因。
 */
export function CommentNav({ count, onPrev, onNext, emptyReason, locked }: { count: number; locked?: string } & CommentNavWiring) {
  const run = useRunCommand()
  const off = !!locked || (!!emptyReason && count === 0)
  const why = locked ?? emptyReason
  return (
    <div role="group" aria-label="评论导航" className="flex items-center">
      <IconButton label="上一处评论" size={36} disabled={off} reason={off ? why : undefined} onClick={() => (onPrev ? onPrev() : void run("comment.prev"))}>
        <ChevronLeft {...ICON_LG} />
      </IconButton>
      <span className={cn("px-1 text-[12px] leading-none whitespace-nowrap", locked ? "text-(--v3-text-3)" : "text-(--v3-text-2)")}>{locked ? "评论" : `${count} 条评论`}</span>
      <IconButton label="下一处评论" size={36} disabled={off} reason={off ? why : undefined} onClick={() => (onNext ? onNext() : void run("comment.next"))}>
        <ChevronRight {...ICON_LG} />
      </IconButton>
    </div>
  )
}

/* ------------------------------------------------------------------ 编辑模式：创建工具条 */

/**
 * 底部浮动工具条：只管「创建」（DS-1）。实色 panel 底 + 细边 + 阴影，圆角 12px，按钮 36px / 圆角 8px。
 * 激活态是强调色底白图标；形状按钮点开 4 × 3 常用形状，底部「全部形状 72 ›」一行在原位换成完整形状库（03-15，同一锚点、同一弹层）。
 * 图片、表格、图表点了打开各自的弹层（03-04 图片 ▾、03-30 §2.1 8 × 10 网格、03-31 图表类型菜单），开着时按钮按下；
 * 关闭（选定、Esc、点外面）后回到「选择」，Esc 关闭时焦点回到按钮。图表菜单由图表场景登记（insert-menus.tsx registerToolLayer("chart")），
 * 「插入表格…」「来自 URL…」打开的对话框同样按登记取。menu 让某个弹层一出现就打开（场景状态）。
 * 视图类开关（单页 / 网格、备注）不在这里：视图切换在左栏顶部 / 网格左上胶囊，二者与备注开关都在主菜单「视图」子菜单。
 * 工具条在两种视图里常驻。网格视图里幻灯片放不了对象，创建工具作用于选中页：点了先打开这一页（回单页）再放置，
 * 提示写明「在第 N 页添加…」；焦点留在工具条按钮上。
 * disabled：不可用的工具与原因（打开中、编辑权限被降级…），工具留在原位不隐藏（02 §6.2）；tip：演示「原因」时让某个工具的提示一出现就展开（按句分行），
 * 用户第一次点按或按键后收起、回到悬停 / 聚焦才弹。
 * 形状：点常用 4 × 3 或形状库里的一格 → 弹层收起、「形状」保持按下，记下当前插入工具（再打开形状库时该格高亮），onShapePick 通知场景；换别的工具即清掉。
 * 键盘：Esc 关掉形状弹层后焦点回到「形状」；「全部形状」换成形状库时焦点移进形状库（原按钮随之卸载）。
 * 锚点：toolbar（整条）、tool-select、tool-text、tool-shapes、tool-image、tool-table、tool-chart、tool-comment、tool-more。
 */
export function Toolbar({
  tool,
  onTool,
  shapesOpen,
  onShapesOpen,
  gridSlide,
  disabled = {},
  shapesView = "quick",
  shapesActive,
  tip,
  onShapePick,
  hide = [],
  menu: initialMenu,
  moreItems,
}: {
  tool: ToolId
  onTool: (t: ToolId) => void
  shapesOpen: boolean
  onShapesOpen: (open: boolean) => void
  /** 网格视图里的选中页；有值时创建工具的提示改为「在第 N 页添加…」（打开这一页由编辑器在 onTool 里处理） */
  gridSlide?: number
  /** 不可用的条目与原因 */
  disabled?: Partial<Record<ToolKey, string>>
  /** 形状弹层打开时显示哪一层：quick 常用 4 × 3（缺省）· library 完整形状库 */
  shapesView?: "quick" | "library"
  /** 形状库里当前的插入工具（强调色浅底） */
  shapesActive?: string
  /** 某个工具的提示一出现就展开（演示不可用原因） */
  tip?: { tool: ToolKey; lines?: string[] }
  /** 选定了一个形状（形状库预设 id） */
  onShapePick?: (id: string) => void
  /** 不出现的创建工具（贡献点 when 为假，如 M2 未装评论包时的「评论」）：不渲染、不留位 */
  hide?: ToolKey[]
  /** 一出现就打开的工具弹层（场景状态） */
  menu?: ToolMenuId
  /** 「更多」的条目（缺省底座 moreMenu；toolbar.moreItems） */
  moreItems?: MenuSpec[]
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const shapesBtn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [view, setView] = useState(shapesView)
  /** 用户点了「全部形状」：形状库挂上后把焦点移进去 */
  const focusLibrary = useRef(false)
  /** 用键盘（Enter / 空格）打开形状弹层：弹层挂上后焦点进第一个形状（菜单按钮的键盘约定；鼠标打开时焦点留在按钮上） */
  const focusQuick = useRef(false)
  /** 常用形状网格的漫游焦点：整组只占一个 Tab 位，方向键在 4 × 3 里移动 */
  const [quickIdx, setQuickIdx] = useState(0)
  // 当前插入工具（形状预设 id）：场景给的初值 / 新值优先，点格子时更新；换到别的工具就清掉
  const [armed, setArmed] = useState(shapesActive)
  useEffect(() => setArmed(shapesActive), [shapesActive])
  useEffect(() => {
    if (tool !== "shapes") setArmed(undefined)
  }, [tool])
  const pickShape = (id: string) => {
    setArmed(id)
    onShapePick?.(id)
    onTool("shapes")
    onShapesOpen(false)
    // 弹层随即卸载：焦点交还「形状」按钮，键盘用户不会掉到页面顶端
    shapesBtn.current?.focus({ preventScroll: true })
  }
  // 演示用的常开提示：用户第一次点按或按键后收起
  const [tipShown, setTipShown] = useState(!!tip)
  useEffect(() => {
    if (!tipShown) return
    const hide = () => setTipShown(false)
    window.addEventListener("pointerdown", hide, true)
    window.addEventListener("keydown", hide, true)
    return () => {
      window.removeEventListener("pointerdown", hide, true)
      window.removeEventListener("keydown", hide, true)
    }
  }, [tipShown])
  const tipFor = (k: ToolKey) => (tipShown && tip?.tool === k ? { tipOpen: true, tipLines: tip.lines } : {})
  // 弹层收起后下次从常用形状的第一格开始
  useEffect(() => {
    if (shapesOpen) return
    setView("quick")
    setQuickIdx(0)
  }, [shapesOpen])
  // 键盘打开：焦点进常用形状的第一格
  useEffect(() => {
    if (!shapesOpen || view !== "quick" || !focusQuick.current) return
    focusQuick.current = false
    setQuickIdx(0)
    panel.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true })
  }, [shapesOpen, view])
  /** 常用形状网格的方向键：左右逐格、上下跨行（4 列），首尾回绕；Home / End 到第一格 / 最后一格 */
  const onQuickKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (i < 0 || e.nativeEvent.isComposing) return
    const cols = 4
    const n = items.length
    let next = i
    if (e.key === "ArrowRight") next = (i + 1) % n
    else if (e.key === "ArrowLeft") next = (i - 1 + n) % n
    else if (e.key === "ArrowDown") next = i + cols < n ? i + cols : i % cols
    else if (e.key === "ArrowUp") {
      if (i - cols >= 0) next = i - cols
      else {
        next = i % cols
        while (next + cols < n) next += cols
      }
    } else if (e.key === "Home") next = 0
    else if (e.key === "End") next = n - 1
    else return
    e.preventDefault()
    setQuickIdx(next)
    items[next]?.focus({ preventScroll: true })
  }
  // 「全部形状」换成形状库：焦点移进形状库（第一个可操作的控件），原按钮已随之卸载
  useEffect(() => {
    if (view !== "library" || !focusLibrary.current) return
    focusLibrary.current = false
    const box = panel.current
    if (box) (tabbables(box)[0] ?? box).focus({ preventScroll: true })
  }, [view])
  /** 创建工具的提示：单页里就是工具名，网格里说明会打开哪一页 */
  const tipOf = (label: string) => (gridSlide === undefined ? undefined : `在第 ${gridSlide} 页添加${label}`)

  // 形状弹层：点到外面或按 Esc 关闭（Esc 时焦点回到「形状」按钮）
  useEffect(() => {
    if (!shapesOpen) return
    const down = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) onShapesOpen(false)
    }
    // 捕获阶段：比格子上自动弹出的工具提示（Radix 在 Esc 时先关提示并 preventDefault）先处理，同一下 Esc 就关掉弹层（不必按两次）
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.isComposing) return
      onShapesOpen(false)
      shapesBtn.current?.focus({ preventScroll: true })
    }
    document.addEventListener("pointerdown", down)
    document.addEventListener("keydown", key, true)
    return () => {
      document.removeEventListener("pointerdown", down)
      document.removeEventListener("keydown", key, true)
    }
  }, [shapesOpen, onShapesOpen])

  /* 图片 / 表格 / 图表的弹层：开着时按钮按下（当前工具），关了回到「选择」；开着哪一个记在场景仓（TOOL_MENU_KEY：演示初值只在载入时生效一次） */
  const [menu, setMenu] = useSceneState<ToolMenuId | null>(TOOL_MENU_KEY, initialMenu ?? null)
  const [layer, openLayer] = useToolLayer()
  const openMenu = (id: ToolMenuId) => {
    if (menu === id) {
      closeMenu(id)
      return
    }
    onShapesOpen(false)
    onTool(id)
    setMenu(id)
  }
  const closeMenu = (id: ToolMenuId) => {
    setMenu((m) => (m === id ? null : m))
    if (tool === id) onTool("select")
  }
  /** 点的是这个工具按钮本身：交给按钮切换（弹层不先因「点到外面」关掉，免得一关又开） */
  const onOwnButton = (id: ToolMenuId) => (e: Event) => {
    if ((e.target as HTMLElement | null)?.closest(`[data-v3-anchor="tool-${id}"]`)) e.preventDefault()
  }
  const ChartMenu = getToolLayer("chart")

  const shapesOn = tool === "shapes"
  const shapesOff = disabled.shapes

  return (
    <>
      <ToolbarShell label="创建工具">
        <SelectTool on={tool === "select"} onClick={() => onTool("select")} disabled={!!disabled.select} reason={disabled.select} />

        {CREATE_TOOLS.filter((t) => !hide.includes(t.id)).map((t) =>
          t.id === "shapes" && !shapesOff ? (
            <div key={t.id} ref={wrap} className="relative">
              <IconButton
                ref={shapesBtn}
                label={t.label}
                tip={tipOf(t.label)}
                kbd={t.kbd}
                size={36}
                variant={shapesOn ? "accent" : "ghost"}
                pressed={shapesOn}
                tipHidden={shapesOpen}
                aria-haspopup="true"
                aria-expanded={shapesOpen}
                data-v3-anchor="tool-shapes"
                onClick={(e) => {
                  setMenu(null)
                  onTool("shapes")
                  // detail 为 0：键盘触发的 click（Enter / 空格）
                  if (!shapesOpen && e.detail === 0) focusQuick.current = true
                  onShapesOpen(!shapesOpen)
                }}
              >
                <Shapes {...ICON_LG} />
              </IconButton>
              {shapesOpen && (
                <div
                  ref={panel}
                  role={view === "library" ? "dialog" : undefined}
                  aria-label={view === "library" ? "形状库" : undefined}
                  tabIndex={view === "library" ? -1 : undefined}
                  className={cn(
                    "absolute bottom-[calc(100%+13px)] left-1/2 w-max -translate-x-1/2 rounded-[8px] border border-(--v3-border) bg-(--v3-panel) shadow-(--v3-shadow) outline-none",
                    view === "library" ? "p-3" : "p-1",
                  )}
                >
                  {view === "library" ? (
                    <ShapeLibrary activeId={armed} onPick={(sh) => pickShape(sh.id)} />
                  ) : (
                    <>
                      <div role="menu" aria-label="形状" onKeyDown={onQuickKey} className="grid grid-cols-[repeat(4,2.25rem)] gap-1">
                        {SHAPES.map((s, i) => (
                          <Tip key={s.id} label={s.label} side="top">
                            <button
                              type="button"
                              role="menuitem"
                              aria-label={s.label}
                              tabIndex={i === quickIdx ? 0 : -1}
                              onFocus={() => setQuickIdx(i)}
                              onClick={() => pickShape(QUICK_SHAPE_IDS[s.id] ?? s.id)}
                              className="flex size-9 items-center justify-center rounded-[6px] text-(--v3-text) transition-colors hover:bg-(--v3-panel-2)"
                            >
                              {s.icon}
                            </button>
                          </Tip>
                        ))}
                      </div>
                      <div aria-hidden="true" className="-mx-1 my-1 h-px bg-(--v3-border)" />
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        onClick={() => {
                          focusLibrary.current = true
                          setView("library")
                        }}
                        className="flex h-7 w-full items-center justify-between rounded-[4px] px-2 text-[12px] leading-none text-(--v3-text) transition-colors hover:bg-(--v3-panel-2)"
                      >
                        全部形状
                        <span className="flex items-center gap-1 text-(--v3-text-2)">
                          <span className="text-[11px] tabular-nums">{SHAPE_COUNT}</span>
                          <ChevronRight size={12} strokeWidth={1.5} aria-hidden="true" />
                        </span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <ToolButton
              key={t.id}
              anchor={`tool-${t.id}`}
              label={t.label}
              tip={tipOf(t.label)}
              kbd={t.kbd}
              Icon={t.Icon}
              on={tool === t.id}
              onClick={() => (t.id === "image" || t.id === "table" || t.id === "chart" ? openMenu(t.id) : (setMenu(null), onTool(t.id)))}
              disabled={!!disabled[t.id]}
              reason={disabled[t.id]}
              hasPopup={t.id === "image" || t.id === "table" || t.id === "chart" ? (t.id === "table" ? "dialog" : "menu") : undefined}
              expanded={t.id === "image" || t.id === "table" || t.id === "chart" ? menu === t.id : undefined}
              {...tipFor(t.id)}
            />
          ),
        )}

        <MoreTool disabled={!!disabled.more} reason={disabled.more} items={moreItems} {...tipFor("more")} />
      </ToolbarShell>

      {/* 图片 ▾（03-04）：此设备… / 来自 URL… / 屏幕截图、相册（M4+）；「来自 URL…」打开登记的对话框 */}
      {menu === "image" && (
        <Menu
          anchor="tool-image"
          open
          onOpenChange={(v) => !v && closeMenu("image")}
          onInteractOutside={onOwnButton("image")}
          label="插入图片"
          items={wireLayers(IMAGE_MENU, "image", openLayer)}
        />
      )}
      {/* 表格：8 × 10 网格（03-30 §2.1），「插入表格…」先关网格、再开对话框（登记的 table:dialog） */}
      {menu === "table" && (
        <Popover anchor="tool-table" label="插入表格" open onOpenChange={(v) => !v && closeMenu("table")} onInteractOutside={onOwnButton("table")} className="p-2">
          <TableGridPicker initial={{ r: 0, c: 0 }} onOpenDialog={() => getToolLayer("table:dialog") && openLayer("table:dialog")} />
        </Popover>
      )}
      {/* 图表：类型菜单由图表场景登记（五类 + 子类型 flyout，03-31） */}
      {ChartMenu && <ChartMenu open={menu === "chart"} onOpenChange={(v) => (v ? setMenu("chart") : closeMenu("chart"))} />}
      {layer}
    </>
  )
}

/** 把一组创建工具设为同一原因不可用：lockTools("需要编辑权限", { except: ["comment"], select: true })（select: true = 「选择」仍可用）。 */
export function lockTools(reason: string, { except = [], select = false }: { except?: ToolKey[]; select?: boolean } = {}): Partial<Record<ToolKey, string>> {
  const keys: ToolKey[] = ["select", "text", "shapes", "image", "table", "chart", "comment", "more"]
  return Object.fromEntries(keys.filter((k) => !except.includes(k) && !(k === "select" && select)).map((k) => [k, reason]))
}

/* ------------------------------------------------------------------ 评审 / 浏览模式的工具条（EditorConfig.mode） */

/**
 * 评审条（mode = review，02 §6.2，DS-23）：替换底部创建工具条，没有对象创建工具——
 * 浏览 · 评论 · 高亮 ｜ 上一处 / 下一处评论 ｜ 模式标识「评审模式」，有编辑权限时多一个「返回编辑」（评审模式下切回编辑的常驻入口；进入评审在主菜单「视图 › 模式」）。
 * 「浏览」、模式标识与「返回编辑」是外壳内置的固定项；ui.toolbar{slot:'reviewBar'} 只承载评论、高亮与上一处 / 下一处等条目（rulings §4.25 TB-1）。
 * 创建工具条的「选择」则仍由 slide-ui 作为内置条目贡献（TB-38）。
 */
export function ReviewToolbar({
  tool,
  onTool,
  comments,
  canEdit = true,
  locked,
  nav,
}: {
  tool: ToolId
  onTool: (t: ToolId) => void
  comments: number
  canEdit?: boolean
  /** 整条不可用（打开中，含「浏览」，03-02 §6.2）：各项留在原位、写原因 */
  locked?: string
  /** 评论导航的接线（缺省发底座命令 comment.prev / comment.next） */
  nav?: CommentNavWiring
}) {
  const off = { disabled: !!locked, reason: locked }
  // 「返回编辑」：同一状态里切回编辑模式（rulings §4.25 TB-83，EditorCtx.setMode），不重新挂载编辑器；评审条随之换成创建工具条——
  // 焦点先交给新工具条的「选择」（与评审条「浏览」同一个锚点 tool-select），不经过 body（kit closeWithFocusBack）
  const ed = useEditorMaybe()
  return (
    <ToolbarShell label="评审工具">
      <ToolButton anchor="tool-select" label="浏览" kbd="V" Icon={MousePointer2} on={tool === "select"} onClick={() => onTool("select")} {...off} />
      <ToolButton anchor="tool-comment" label="评论" kbd="C" Icon={MessageSquare} on={tool === "comment"} onClick={() => onTool("comment")} {...off} />
      <ToolButton anchor="tool-highlight" label="高亮" Icon={Highlighter} on={tool === "highlight"} onClick={() => onTool("highlight")} {...off} />
      <ToolbarDivider />
      <CommentNav count={comments} locked={locked} {...nav} />
      <ToolbarDivider />
      <ToolbarLabel>评审模式</ToolbarLabel>
      {canEdit && (
        <Button
          variant="secondary"
          className="mr-1"
          {...off}
          onClick={(e) => {
            const setMode = ed?.setMode
            if (!setMode) return
            closeWithFocusBack(() => setMode("edit"), "tool-select", e.currentTarget.closest('[role="toolbar"]'))
          }}
        >
          返回编辑
        </Button>
      )}
    </ToolbarShell>
  )
}

/** 浏览条（mode = viewer，查看者）：只有上一处 / 下一处评论 +「只读浏览中」（外壳内置的固定项，TB-1）；没有评论时只剩标识。 */
export function ViewerToolbar({ comments, nav }: { comments: number; nav?: CommentNavWiring }) {
  return (
    <ToolbarShell label="浏览工具">
      {comments > 0 && (
        <>
          <CommentNav count={comments} {...nav} />
          <ToolbarDivider />
        </>
      )}
      <ToolbarLabel icon={<Eye {...ICON} aria-hidden="true" />}>只读浏览中</ToolbarLabel>
    </ToolbarShell>
  )
}

/** 评审 / 浏览模式下没有任何条目时（M2 未装评论包）：工具条位置只放一句只读提示（role=status，不是工具条）。 */
export function HintToolbar({ children }: { children: ReactNode }) {
  return (
    <ToolbarShell role="status">
      <ToolbarLabel icon={<Eye {...ICON} aria-hidden="true" />}>{children}</ToolbarLabel>
    </ToolbarShell>
  )
}
