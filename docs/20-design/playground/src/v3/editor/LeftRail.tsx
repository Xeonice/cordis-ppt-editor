import { useRef, useState, type ReactNode } from "react"
import { Check, ChevronDown, EyeOff, FileWarning, MessageSquare, Plus, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MainMenuOptions } from "../kit/mainMenu"
import { Popover } from "../kit/Popover"
import { useDemoOpen } from "../kit/layer"
import { useSceneState } from "../kit/scene"
import type { V3View } from "../params"
import { Button, ICON, IconButton, Tip, V3Menu, type MenuEntry } from "../ui"
import { useBreakpoint } from "./breakpoint"
import { DocMenu, MainMenu, ViewToggle } from "./chrome"
import { DeckSlideView, useDeckCounts, type DeckSlide } from "./deck"
import { LayoutGallery } from "./layouts/LayoutGallery"
import { PANEL_LIMITS, PanelResizer } from "./resize"

/**
 * 「新建幻灯片 ▾」行的定制：false 不渲染（评审 / 浏览模式）；reason 留在原位但不可用；
 * 缺省「▾」打开版式画廊（03-14 D14，与检查器「版式」同一个组件 editor/layouts/LayoutGallery，mode = new），贴左栏右缘展开；
 * popover 换弹层的内容或让它一出现就打开（{ defaultOpen: true }）；label / menu / plusLabel 换文字与普通菜单（如母版视图的「新建版式 ▾」与「插入版式」）；
 * anchor 换「▾」按钮的锚点名。
 */
export type NewSlideOption =
  | false
  | {
      reason?: string
      label?: string
      menu?: MenuEntry[]
      plusLabel?: string
      anchor?: string
      /** 「▾」弹层：label 读屏名（缺省「新建幻灯片」）、content 内容（缺省版式画廊）、className 定宽、defaultOpen 一出现就打开 */
      popover?: { label?: string; content?: ReactNode; className?: string; defaultOpen?: boolean }
    }

/**
 * 「新建幻灯片 ▾」按钮 + 弹层（版式库）：点按钮开关，点弹层外关闭（点的是按钮本身时交给按钮切换）。
 * 缺省内容是版式画廊（新建模式）：Esc 先清空搜索、再按才关闭（PRD ML-02、03-27 §1，与检查器「版式」弹层同一做法）；
 * 搜索词读写画廊同一份场景状态（LayoutGallery useLayoutPicker("new") 的 layouts.new.query）。换了内容（popover.content）时 Esc 直接关闭。
 */
function NewSlidePopoverButton({ label, anchor, popover }: { label: string; anchor: string; popover: NonNullable<Exclude<NewSlideOption, false>["popover"]> }) {
  const [open, setOpen] = useState(!!popover.defaultOpen)
  const [query, setQuery] = useSceneState("layouts.new.query", "")
  const btn = useRef<HTMLButtonElement>(null)
  return (
    <>
      <Button
        ref={btn}
        variant="secondary"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="min-w-0 flex-1 justify-between px-2.5"
        data-v3-anchor={anchor}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <ChevronDown {...ICON} className="text-(--v3-text-2)" />
      </Button>
      <Popover
        anchor={anchor}
        open={open}
        onOpenChange={setOpen}
        label={popover.label ?? "新建幻灯片"}
        className={popover.className ?? (popover.content ? undefined : "w-[472px] p-0")}
        onEscapeKeyDown={(e) => {
          if (!popover.content && query) {
            e.preventDefault()
            setQuery("")
          }
        }}
        onInteractOutside={(e) => {
          if (btn.current?.contains(e.target as Node)) e.preventDefault()
        }}
      >
        {popover.content ?? <LayoutGallery mode="new" />}
      </Popover>
    </>
  )
}

/**
 * 文件名下方的状态行（12px text-2、16px 高）：缺省「✓ 已同步」；场景可换成「正在保存…」「离线 · 3 处更改待同步」等。
 * hint：悬停说明（03-12「hover 说明」，如「服务器保存延迟」的原因）——文字可聚焦（键盘聚焦即看到同一句），说明向下展开（向右会盖住文件名），
 * 数组按句分行；hintOpen：演示用，状态一出现就展开、用户第一次点按或按键后收起（kit useDemoOpen）。
 */
export function RailStatus({
  icon,
  children,
  className,
  hint,
  hintOpen,
}: {
  icon?: ReactNode
  children: ReactNode
  className?: string
  hint?: string | string[]
  hintOpen?: boolean
}) {
  return (
    <p data-v3-anchor="sync-status" className={cn("flex h-4 items-center gap-1 text-[12px] leading-none text-(--v3-text-2)", className)}>
      {icon}
      {hint ? <StatusHint hint={hint} demo={hintOpen}>{children}</StatusHint> : children}
    </p>
  )
}

function StatusHint({ hint, demo, children }: { hint: string | string[]; demo?: boolean; children: ReactNode }) {
  const open = useDemoOpen(!!demo)
  const lines = Array.isArray(hint) ? hint : undefined
  return (
    // 说明比状态文字宽：左缘对齐到这一行的左缘（图标 12 + 间距 4 之前，即左栏内容的左缘），不居中展开、不被推到窗口最左边
    <Tip label={lines ? lines.join("") : (hint as string)} lines={lines} side="bottom" align="start" alignOffset={-16} open={open ? true : undefined}>
      <span tabIndex={0} className="rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-(--v3-accent)">
        {children}
      </span>
    </Tip>
  )
}

/** 缩略图右上角的小角标：16 高、圆角 4、1px 边、11px 数字（评论中性 panel 底；警示 warning 浅底 + 警告色图标——这一页有无法解析的内容时危险浅底 + 危险色图标；两者一眼可分） */
const THUMB_BADGE = "inline-flex h-4 items-center gap-0.5 rounded-[4px] border border-(--v3-border) px-1 text-[11px] leading-none tabular-nums"

/**
 * 缩略图的评论角标：数字（缺省取 slide.comments，工具提示「N 条评论」），或评论场景的实时计数 { n 未解决数, resolved 已解决数, tipOpen }——
 * 数字只计未解决（03-06），工具提示「N 条未解决」/「N 条未解决 · 另有 M 条已解决」
 */
export type ThumbComments = number | { n: number; resolved?: number; tipOpen?: boolean }

/** 缩略图列表容器（左栏下半部分的滚动区）。自定义列表（EditorConfig.rail.list）用它包 RailThumb，滚动与边距保持一致。 */
export function RailList({ children }: { children: ReactNode }) {
  return (
    <nav aria-label="幻灯片" className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-4">
      <ol className="flex flex-col gap-1">{children}</ol>
    </nav>
  )
}

/**
 * 一页缩略图（li）：左侧页码、右侧真实渲染的幻灯片；当前页（或多选中的页）浅强调色底 + 强调色描边，右上角评论数。
 * hidden：已隐藏（放映时跳过，03-14 D15）——页码加斜线、下方眼睛图标、幻灯片 60% 不透明，工具提示「已隐藏，放映时跳过」；当前页描边与评论角标不受影响。
 * dragging：拖动中的源页，整条 40%。children 画在缩略图框里（绝对定位），自定义列表可以叠加命中标记等。
 * 角标（右上角并排，警示在左、评论在右，同一页两者都有时不重叠）：comments 换评论角标的数字与提示（缺省取 slide.comments）；
 * warn = 该页以占位显示的元素数（03-13 缩略图级）；warnLevel = 这一页最严重一条的级别（缺省 warning：警告浅底 + 警告色三角，第 1 批缺插件角标即此；
 * danger：内容无法解析，危险浅底 + 危险色 FileWarning，与保真报告条目、页级提示条的图标同一个——由场景按报告数据推导后传入，第 2 批第 6 轮集成补）。
 * 读屏名带上两者：「第 4 页，3 条评论」「第 8 页，1 处内容无法解析」（07 §3）。
 * pending：这一页的缩略图还没生成（PRD G-05 的虚拟化占位，左栏与网格同理）——原位画一块与缩略图同尺寸的 panel-2 中性块（盖住纸面，不画转圈与文字：一栏里几十个转圈太吵），
 * 页码、读屏名与点按都照常（画法同第 1 批母版视图的加载占位块，DS-53 豁免的那种；第 3 批转正时由 import/virtual.tsx 的 placeholderOf 并入，逐像素相同）。
 */
export function RailThumb({
  slide: slideProp,
  current,
  selected,
  hidden,
  dragging,
  pending,
  onPick,
  comments: commentsProp,
  warn,
  warnLevel = "warning",
  children,
}: {
  slide: DeckSlide
  current: boolean
  /** 多选中（与当前页同样高亮，但不是 aria-current） */
  selected?: boolean
  /** 已隐藏（放映时跳过） */
  hidden?: boolean
  /** 拖动中的源页 */
  dragging?: boolean
  /** 缩略图还没生成：原位一块 panel-2 中性块 */
  pending?: boolean
  onPick: (n: number) => void
  /** 评论角标（缺省 slide.comments）：数字，或 { n 未解决数, resolved 已解决数, tipOpen 提示常开（演示）}；0 不显示 */
  comments?: ThumbComments
  /** 警示角标：该页以占位显示的元素数（0 / 不传不显示） */
  warn?: number
  /** 警示角标的级别（缺省 warning）：danger = 这一页有无法解析的内容，角标危险浅底 + 危险色图标、读屏名「N 处内容无法解析」 */
  warnLevel?: "warning" | "danger"
  children?: ReactNode
}) {
  const slide = pending ? pendingSlide(slideProp) : slideProp
  const n = slide.n
  const on = current || !!selected
  const c = commentsProp ?? slide.comments ?? 0
  const live = typeof c !== "number"
  const comments = live ? c.n : c
  const resolved = live ? (c.resolved ?? 0) : 0
  const commentTip = !live ? `${comments} 条评论` : resolved ? `${comments} 条未解决 · 另有 ${resolved} 条已解决` : `${comments} 条未解决`
  const commentSay = !live ? `${comments} 条评论` : resolved ? `${comments} 条未解决评论，另有 ${resolved} 条已解决` : `${comments} 条未解决评论`
  const danger = warnLevel === "danger"
  const warnSay = danger ? `${warn} 处内容无法解析` : `${warn} 处内容以占位显示`
  const label = [`第 ${n} 页`, hidden && "已隐藏，放映时跳过", comments > 0 && commentSay, !!warn && warnSay].filter(Boolean).join("，")
  const btn = (
    <button
      type="button"
      data-v3-anchor={`thumb-${n}`}
      aria-current={current ? "true" : undefined}
      aria-label={label}
      onClick={() => onPick(n)}
      className={cn("flex w-full items-start gap-2 rounded-[6px] p-2 text-left transition-colors", on ? "bg-(--v3-accent-soft)" : "hover:bg-(--v3-panel-2)", dragging && "opacity-40")}
    >
      {hidden ? (
        <span className="flex w-5 shrink-0 flex-col items-start gap-1 pt-px">
          <span className={cn("relative text-[11px] leading-4 tabular-nums", on ? "text-(--v3-text)" : "text-(--v3-text-2)")}>
            {n}
            <span aria-hidden="true" className="absolute top-1/2 -right-1 -left-1 h-px rotate-45 bg-current" />
          </span>
          <EyeOff size={12} strokeWidth={1.5} aria-hidden="true" className="text-(--v3-text-2)" />
        </span>
      ) : (
        <span className={cn("w-5 shrink-0 pt-px text-[11px] leading-4 tabular-nums", on ? "text-(--v3-text)" : "text-(--v3-text-2)")}>{n}</span>
      )}
      <span className={cn("relative block min-w-0 flex-1 overflow-hidden rounded-[4px] border border-(--v3-border)", on && "border-(--v3-accent) ring-[0.5px] ring-(--v3-accent)")}>
        {hidden ? (
          <span className="block opacity-60">
            <DeckSlideView slide={slide} where="thumb" />
          </span>
        ) : (
          <DeckSlideView slide={slide} where="thumb" />
        )}
        {comments > 0 || !!warn ? (
          <span className="absolute top-1 right-1 flex items-center gap-1">
            {!!warn && (
              <span aria-hidden="true" className={cn(THUMB_BADGE, danger ? "bg-(--v3-danger-soft)" : "bg-(--v3-warning-soft)", "text-(--v3-text)")}>
                {danger ? (
                  <FileWarning size={10} strokeWidth={1.75} aria-hidden="true" className="text-(--v3-danger)" />
                ) : (
                  <TriangleAlert size={10} strokeWidth={1.75} aria-hidden="true" className="text-(--v3-warning)" />
                )}
                {warn}
              </span>
            )}
            {comments > 0 && (
              <Tip label={commentTip} side="right" open={live ? c.tipOpen : undefined}>
                <span aria-hidden="true" className={cn(THUMB_BADGE, "bg-(--v3-panel) text-(--v3-text-2)")}>
                  <MessageSquare size={10} strokeWidth={1.5} aria-hidden="true" />
                  {comments}
                </span>
              </Tip>
            )}
          </span>
        ) : null}
        {children}
      </span>
    </button>
  )
  return (
    <li>
      {hidden ? (
        <Tip label="已隐藏，放映时跳过" side="right">
          {btn}
        </Tip>
      ) : (
        btn
      )}
    </li>
  )
}

/** 缩略图还没生成的页：与缩略图同尺寸的中性块（盖住纸面） */
const pendingSlide = (s: DeckSlide): DeckSlide => ({ ...s, render: () => <div aria-hidden="true" className="absolute inset-0 bg-(--v3-panel-2)" /> })

/**
 * 左栏贴边（缺省 240，右缘分隔条可拖到 160–420 并按文档记在本机，03-20；只在单页视图出现）：文档标题与同步状态、新建幻灯片，其下是缩略图列表（真实幻灯片的缩小渲染）。
 * 顶部「单页 / 网格」切换的是整个编辑器的视图（URL 参数 view），左栏自己不再有视图状态；单页视图里它是视图切换唯一的常驻入口
 * （另有主菜单「视图」子菜单，不常驻）。
 * 锚点：rail（整栏）、main-menu、view-toggle、doc-menu、sync-status、new-slide（新建幻灯片 ▾）、new-slide-plus、thumb-<n>。
 */
export function LeftRail({
  deck,
  slide,
  onPick,
  view,
  onView,
  notes,
  onNotes,
  focusToggle,
  status,
  selected,
  hidden,
  list,
  liveComments,
  newSlide,
  viewToggle,
  menu,
  drawer,
  width,
  onWidth,
  resizeActive,
}: {
  deck: DeckSlide[]
  slide: number
  onPick: (n: number) => void
  view: V3View
  onView: (v: V3View) => void
  /** 备注开关：在主菜单「视图」子菜单里 */
  notes: boolean
  onNotes: (v: boolean) => void
  /** 由网格里的胶囊切换按钮、主菜单或打开某页切回单页：挂载时把焦点交给顶部的「单页」按钮 */
  focusToggle: boolean
  /** 文件名下方的状态行（缺省「✓ 已同步」） */
  status?: ReactNode
  /** 另外高亮的页（多选） */
  selected?: number[]
  /** 已隐藏的页 */
  hidden?: number[]
  /** 替换整个缩略图列表 */
  list?: ReactNode
  /** 缺省列表的评论角标读线程数据（底座画评论钉的状态，rulings §4.25 TB-83；Editor 的 pinsOn）：在缺省评论面板里解决或删除一条，角标随之变化 */
  liveComments?: boolean
  /** 「新建幻灯片 ▾」行（缺省可用） */
  newSlide?: NewSlideOption
  /** 顶部「单页 / 网格」：false 不渲染，reason 不可用 */
  viewToggle?: false | { reason: string }
  /** 主菜单条目定制（模式、母版视图、各子菜单） */
  menu?: Partial<MainMenuOptions>
  /** 作为紧凑形态的抽屉渲染：宽度固定、没有分隔条（不看真实视口） */
  drawer?: boolean
  /** 栏宽（缺省 240）；给了 onWidth 且是桌面形态时右缘有分隔条 */
  width?: number
  onWidth?: (w: number) => void
  /** 分隔条显示悬停 / 拖动中的样子（演示） */
  resizeActive?: boolean
}) {
  const ns = newSlide === false ? null : (newSlide ?? {})
  const nsOff = !!ns?.reason
  const desktop = useBreakpoint() === "desktop" && !drawer
  const w = desktop ? (width ?? PANEL_LIMITS.rail.def) : PANEL_LIMITS.rail.def
  return (
    <aside data-v3-anchor="rail" aria-label="幻灯片列表" style={{ width: w }} className="relative flex shrink-0 flex-col border-r border-(--v3-border) bg-(--v3-panel) select-none">
      {desktop && onWidth && <PanelResizer panel="rail" value={w} onChange={onWidth} active={resizeActive} />}
      <div className="px-4 pt-3">
        {/* data-v3-rail-top：顶行（主菜单 …… 单页 / 网格）；紧凑抽屉在它左侧给「收起幻灯片列表」开关让位（narrow/compact.tsx） */}
        <div data-v3-rail-top="" className="flex h-7 items-center justify-between">
          <MainMenu view={view} onView={onView} notes={notes} onNotes={onNotes} options={menu} className="-ml-1.5" />
          {viewToggle !== false && <ViewToggle view={view} onView={onView} autoFocus={focusToggle} reason={viewToggle?.reason} />}
        </div>

        <DocMenu className="mt-2 -ml-1.5" mode={menu?.mode} canEdit={menu?.canEdit} degraded={menu?.readonlyDegraded} />
        {status ?? <RailStatus icon={<Check size={12} strokeWidth={1.75} aria-hidden="true" />}>已同步</RailStatus>}

        {ns && (
          <div className="mt-3 flex gap-2">
            {nsOff ? (
              <Button variant="secondary" disabled reason={ns.reason} className="min-w-0 flex-1 justify-between px-2.5" data-v3-anchor={ns.anchor ?? "new-slide"}>
                {ns.label ?? "新建幻灯片"}
                <ChevronDown {...ICON} />
              </Button>
            ) : !ns.menu ? (
              <NewSlidePopoverButton label={ns.label ?? "新建幻灯片"} anchor={ns.anchor ?? "new-slide"} popover={ns.popover ?? {}} />
            ) : (
              <V3Menu
                entries={ns.menu}
                onSelect={() => undefined}
                trigger={
                  <Button variant="secondary" className="min-w-0 flex-1 justify-between px-2.5" data-v3-anchor={ns.anchor ?? "new-slide"}>
                    {ns.label ?? "新建幻灯片"}
                    <ChevronDown {...ICON} className="text-(--v3-text-2)" />
                  </Button>
                }
              />
            )}
            <IconButton
              label={ns.plusLabel ?? "新建幻灯片"}
              // 「+」按缺省版式在当前页后新建，等同 Mod+M（ED-16）；换了用途（如母版视图的「插入版式」）就不带
              kbd={ns.plusLabel === undefined ? "⌘M" : undefined}
              size={28}
              disabled={nsOff}
              reason={ns.reason}
              // 与左侧「新建幻灯片 ▾」（Button secondary）同一外观：--v3-btn-*，次按钮透明底 + 与分隔线同档的细边（rulings §4.25 DS-37）
              className="bg-(--v3-btn-fill) text-(--v3-text) ring-1 ring-(--v3-btn-line) ring-inset hover:bg-(--v3-btn-fill-hover)"
              data-v3-anchor={ns.anchor ? `${ns.anchor}-plus` : "new-slide-plus"}
            >
              <Plus {...ICON} />
            </IconButton>
          </div>
        )}
      </div>

      {list ??
        (liveComments ? (
          <LiveRailList deck={deck} slide={slide} selected={selected} hidden={hidden} onPick={onPick} />
        ) : (
          <RailList>
            {deck.map((s) => (
              <RailThumb key={s.n} slide={s} current={s.n === slide} selected={selected?.includes(s.n)} hidden={hidden?.includes(s.n)} onPick={onPick} />
            ))}
          </RailList>
        ))}
    </aside>
  )
}

/**
 * 缺省缩略图列表、角标读线程数据（rulings §4.25 TB-83）：示例文档里本来有评论的页（slide.comments > 0）按线程数据写未解决数（工具提示「N 条未解决 · 另有 M 条已解决」，
 * 同评论场景的左栏实时角标），解决或删除后随之变化、都解决了不再带角标；没有登记数据源时同静态列表
 */
function LiveRailList({ deck, slide, selected, hidden, onPick }: { deck: DeckSlide[]; slide: number; selected?: number[]; hidden?: number[]; onPick: (n: number) => void }) {
  const counts = useDeckCounts()
  return (
    <RailList>
      {deck.map((s) => (
        <RailThumb
          key={s.n}
          slide={s}
          current={s.n === slide}
          selected={selected?.includes(s.n)}
          hidden={hidden?.includes(s.n)}
          onPick={onPick}
          comments={counts && (s.comments ?? 0) > 0 ? counts(s.n) : undefined}
        />
      ))}
    </RailList>
  )
}
