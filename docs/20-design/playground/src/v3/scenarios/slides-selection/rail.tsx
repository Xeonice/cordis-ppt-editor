import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { DeckSlideView, RailList, RailThumb, SizeTag, useEditor, type DeckSlide, type EditorCtx } from "../../kit"

/**
 * 左栏缩略图列表的局部件（03-14）：节标题行、插入指示线与拖动影子。隐藏页、多选、拖动源已并入底座 RailThumb（hidden / selected / dragging），
 * 这里的 Thumb 只是把点按接到 useEditor().goTo。尺寸与底座一致（条目内边距 8、圆角 6、页码列 20、缩略图圆角 4 + 1px 边），整列用底座 RailList 包。
 */

/** 缩略图左缘到条目左缘：条目内边距 8 + 页码列 20 + 间距 8 */
const FRAME_LEFT = 36

export interface ThumbProps {
  slide: DeckSlide
  current: boolean
  /** 多选中（与当前页同样高亮） */
  selected?: boolean
  /** 已隐藏（D15）：页码加斜线、下方眼睛图标，幻灯片渲染 60% 不透明；当前页描边与评论角标不受影响（视觉优先级 03-14） */
  hidden?: boolean
  /** 拖动中的源页：整条 40% */
  dragging?: boolean
}

export function Thumb({ slide, current, selected, hidden, dragging }: ThumbProps) {
  const { goTo } = useEditor()
  return <RailThumb slide={slide} current={current} selected={selected} hidden={hidden} dragging={dragging} onPick={goTo} />
}

/** 节标题行（G-42，M2 只显示）：▾ 节名 + 页数，整行可点折叠 / 展开；折叠后保留标题行。 */
export function SectionRow({ name, count, collapsed, onToggle, anchor }: { name: string; count: number; collapsed: boolean; onToggle: () => void; anchor?: string }) {
  return (
    <li className="pt-1 first:pt-0">
      <button
        type="button"
        aria-expanded={!collapsed}
        data-v3-anchor={anchor}
        onClick={onToggle}
        className="flex h-7 w-full items-center gap-1.5 rounded-[6px] px-2 text-left transition-colors hover:bg-(--v3-panel-2)"
      >
        <ChevronDown size={12} strokeWidth={1.5} aria-hidden="true" className={cn("shrink-0 text-(--v3-text-2) transition-transform", collapsed && "-rotate-90")} />
        <span className="min-w-0 truncate text-[12px] leading-4 font-semibold text-(--v3-text)">{name}</span>
        <span className="shrink-0 text-[12px] leading-4 text-(--v3-text-2) tabular-nums">{count} 页</span>
      </button>
    </li>
  )
}

/**
 * 插入位置指示线：2px 强调色线，左端 8px 空心圆，对齐缩略图左缘；所在间隙放大到 16px（其余缩略图让位）。
 * label：跨节拖动时写明目标节（「移到「下半年」」），压在线的右端（像参考线的数值角标）。
 */
export function InsertLine({ label }: { label?: string }) {
  return (
    <li aria-hidden="true" className="relative h-2">
      <span className="absolute top-1/2 right-2 h-0.5 -translate-y-1/2 rounded-[1px] bg-(--v3-accent)" style={{ left: FRAME_LEFT }} />
      <span className="absolute top-1/2 size-2 -translate-y-1/2 rounded-full border-2 border-(--v3-accent) bg-(--v3-panel)" style={{ left: FRAME_LEFT - 4 }} />
      {label && <SizeTag className="absolute top-1/2 right-2 h-5 -translate-y-1/2 text-[12px]">{label}</SizeTag>}
    </li>
  )
}

/**
 * 拖动影子：跟随指针的缩略图（浮起，带浮层阴影）；多选时下面叠一张、右上角计数。
 * 挂在插入线后面的一个零高条目里，top / left 相对这一行（px）。
 */
export function DragGhost({ slides, top = 8, left = 84, width = 120 }: { slides: DeckSlide[]; top?: number; left?: number; width?: number }) {
  const [first, second] = slides
  if (!first) return null
  return (
    <li aria-hidden="true" className="relative h-0">
      <div className="pointer-events-none absolute z-10" style={{ top, left, width }}>
        {second && (
          <span className="absolute top-1 left-1 block w-full overflow-hidden rounded-[4px] border border-(--v3-border) shadow-(--v3-shadow)">
            <DeckSlideView slide={second} where="thumb" />
          </span>
        )}
        <span className="relative block overflow-hidden rounded-[4px] border border-(--v3-accent) shadow-(--v3-shadow)">
          <DeckSlideView slide={first} where="thumb" />
        </span>
        {slides.length > 1 && <SizeTag className="absolute -top-2 -right-2">{slides.length}</SizeTag>}
      </div>
    </li>
  )
}

/** 列表挂载后把某个锚点滚进视野（新页在末尾、拖动目标在下方时）。 */
export function ScrollIntoView({ anchor }: { anchor: string }) {
  const ref = useRef<HTMLLIElement>(null)
  useLayoutEffect(() => {
    const nav = ref.current?.closest("nav")
    nav?.querySelector<HTMLElement>(`[data-v3-anchor="${anchor}"]`)?.scrollIntoView({ block: "nearest" })
  }, [anchor])
  return <li ref={ref} hidden />
}

/** 缩略图列表滚到当前页（文档页数多、当前页在末尾时用，rail.list 的函数形式）：用底座 RailList + RailThumb，点按接 ctx.goTo。 */
export const railToCurrent = (ctx: EditorCtx) => (
  <RailList>
    {ctx.deck.map((sl) => (
      <RailThumb key={sl.n} slide={sl} current={sl.n === ctx.slide} onPick={ctx.goTo} />
    ))}
    <ScrollIntoView anchor={`thumb-${ctx.slide}`} />
  </RailList>
)

/* ------------------------------------------------------------------ 带节的列表 */

export interface SectionDef {
  name: string
  slides: number[]
  collapsed?: boolean
}

/**
 * 按节分组的缩略图列表：节标题行可点折叠（本地偏好，不同步给协作者，03-14 边界情况）。
 * renderSlide 让调用方插入拖动指示线、影子等；extra 画在某节标题之后（如跨节拖动的插入线）。
 */
export function SectionedList({
  sections,
  renderSlide,
  afterHeader,
  anchorPrefix,
  children,
}: {
  sections: SectionDef[]
  renderSlide: (n: number) => ReactNode
  /** 画在某节标题行之后（节索引 → 内容） */
  afterHeader?: Record<number, ReactNode>
  /** 节标题行的锚点前缀：<前缀>-<节序号 1 起> */
  anchorPrefix?: string
  children?: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(() => sections.map((s) => !!s.collapsed))
  return (
    <RailList>
      {sections.map((s, i) => (
        <SectionBlock
          key={s.name}
          section={s}
          collapsed={!!collapsed[i]}
          onToggle={() => setCollapsed((c) => c.map((v, j) => (j === i ? !v : v)))}
          anchor={anchorPrefix ? `${anchorPrefix}-${i + 1}` : undefined}
          after={afterHeader?.[i]}
          renderSlide={renderSlide}
        />
      ))}
      {children}
    </RailList>
  )
}

function SectionBlock({
  section,
  collapsed,
  onToggle,
  anchor,
  after,
  renderSlide,
}: {
  section: SectionDef
  collapsed: boolean
  onToggle: () => void
  anchor?: string
  after?: ReactNode
  renderSlide: (n: number) => ReactNode
}) {
  return (
    <>
      <SectionRow name={section.name} count={section.slides.length} collapsed={collapsed} onToggle={onToggle} anchor={anchor} />
      {after}
      {!collapsed && section.slides.map((n) => <Fragment key={n}>{renderSlide(n)}</Fragment>)}
    </>
  )
}
