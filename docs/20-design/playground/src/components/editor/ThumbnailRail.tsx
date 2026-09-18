import { useState, type MouseEvent, type ReactNode } from "react"
import {
  ChevronDown, ChevronRight, Copy, EyeOff, GripVertical, MessageSquare, Plus,
  SlidersHorizontal, Trash2, TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { masters, sections, type LayoutDef, type MasterDef, type SlideSummary } from "@/lib/mock-data"
import { LayoutGallery } from "./LayoutGallery"
import { MiniSlide } from "./MiniSlide"

export type RailMode = "normal" | "master"

export interface MasterSelection {
  masterId: string
  /** 单选/多选的锚点版式；缺省表示选中的是母版本身 */
  layoutId?: string
  /** Q16-e：Shift/⌘ 多选时同一母版下全部选中的版式 id（含 layoutId），按版式顺序；单选时省略 */
  layoutIds?: string[]
}

/**
 * P-03 缩略图栏（宽 240）：普通模式为幻灯片列表，母版模式仍为缩略图窗格（母版大缩略图 + 缩进的版式缩略图，同款卡片）。
 * 模式切换在 Ribbon 页签行右侧（用户裁决 2026-09-16），本组件不再承载"普通/母版"分段。
 */
export function ThumbnailRail({
  mode,
  slides,
  currentSlideId,
  onSelectSlide,
  onReorder,
  onDeleteSlide,
  onDuplicateSlide,
  onToggleHidden,
  onNewSlide,
  loading,
  masterSelection,
  onSelectMasterNode,
  className,
}: {
  mode: RailMode
  slides: SlideSummary[]
  currentSlideId?: string
  onSelectSlide?: (id: string) => void
  onReorder?: (fromId: string, toId: string) => void
  onDeleteSlide?: (id: string) => void
  onDuplicateSlide?: (id: string) => void
  onToggleHidden?: (id: string) => void
  onNewSlide?: (masterId: string, layout: LayoutDef) => void
  loading?: boolean
  masterSelection?: MasterSelection
  onSelectMasterNode?: (sel: MasterSelection) => void
  className?: string
}) {
  return (
    <div className={cn("flex h-full w-full flex-col", className)}>
      {mode === "normal" ? (
        <NormalRail
          slides={slides}
          currentSlideId={currentSlideId}
          onSelectSlide={onSelectSlide}
          onReorder={onReorder}
          onDeleteSlide={onDeleteSlide}
          onDuplicateSlide={onDuplicateSlide}
          onToggleHidden={onToggleHidden}
          onNewSlide={onNewSlide}
          loading={loading}
        />
      ) : (
        <MasterThumbnails selection={masterSelection} onSelect={onSelectMasterNode} loading={loading} />
      )}
    </div>
  )
}

function NormalRail({
  slides,
  currentSlideId,
  onSelectSlide,
  onReorder,
  onDeleteSlide,
  onDuplicateSlide,
  onToggleHidden,
  onNewSlide,
  loading,
}: {
  slides: SlideSummary[]
  currentSlideId?: string
  onSelectSlide?: (id: string) => void
  onReorder?: (fromId: string, toId: string) => void
  onDeleteSlide?: (id: string) => void
  onDuplicateSlide?: (id: string) => void
  onToggleHidden?: (id: string) => void
  onNewSlide?: (masterId: string, layout: LayoutDef) => void
  loading?: boolean
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const current = slides.find((s) => s.id === currentSlideId)

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-3 pt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <Skeleton className="h-3 w-6" />
            <Skeleton className="aspect-video w-full rounded-md" />
          </div>
        ))}
      </div>
    )
  }

  let lastSectionId: string | undefined
  return (
    <>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1.5 p-3 pt-2">
          {slides.map((slide) => {
            const sectionHeader =
              slide.sectionId && slide.sectionId !== lastSectionId
                ? (() => {
                    lastSectionId = slide.sectionId
                    return sections.find((s) => s.id === slide.sectionId)
                  })()
                : undefined
            const collapsed = slide.sectionId ? collapsedSections.has(slide.sectionId) : false
            return (
              <div key={slide.id} className="contents">
                {sectionHeader && (
                  <button
                    type="button"
                    className="mt-1.5 flex items-center gap-1 text-xs font-medium text-secondary-foreground first:mt-0"
                    onClick={() =>
                      setCollapsedSections((prev) => {
                        const next = new Set(prev)
                        next.has(sectionHeader.id) ? next.delete(sectionHeader.id) : next.add(sectionHeader.id)
                        return next
                      })
                    }
                    aria-expanded={!collapsed}
                  >
                    {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    {sectionHeader.name}
                    <span className="font-normal text-muted-foreground">{slides.filter((s) => s.sectionId === sectionHeader.id).length} 页</span>
                  </button>
                )}
                {!collapsed && (
                  <SlideRow
                    slide={slide}
                    active={slide.id === currentSlideId}
                    dragging={dragId === slide.id}
                    onSelect={() => onSelectSlide?.(slide.id)}
                    onDelete={() => onDeleteSlide?.(slide.id)}
                    onDuplicate={() => onDuplicateSlide?.(slide.id)}
                    onToggleHidden={() => onToggleHidden?.(slide.id)}
                    draggable={!!onReorder}
                    onDragStart={() => setDragId(slide.id)}
                    onDragEnd={() => setDragId(null)}
                    onDropOn={() => { if (dragId && dragId !== slide.id) onReorder?.(dragId, slide.id); setDragId(null) }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>
      <div className="border-t border-foreground/5 p-2">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md border border-input text-xs font-medium text-secondary-foreground hover:bg-muted"
            >
              <Plus className="size-3.5" /> 新建幻灯片
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" side="top" className="w-96">
            <LayoutGallery
              mode="new"
              currentMasterId={current?.masterId ?? masters[0]!.id}
              currentLayoutId={current?.layoutId}
              onSelect={(masterId, layout) => { onNewSlide?.(masterId, layout); toast(`已新建幻灯片 · ${layout.name}`) }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </>
  )
}

function SlideRow({
  slide,
  active,
  dragging,
  onSelect,
  onDelete,
  onDuplicate,
  onToggleHidden,
  draggable,
  onDragStart,
  onDragEnd,
  onDropOn,
}: {
  slide: SlideSummary
  active: boolean
  dragging: boolean
  onSelect: () => void
  onDelete: () => void
  onDuplicate: () => void
  onToggleHidden: () => void
  draggable: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDropOn: () => void
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn("group/row relative flex flex-col gap-1", dragging && "opacity-40")}
          draggable={draggable}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={(e) => draggable && e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onDropOn() }}
        >
          <div className="flex items-center gap-1">
            {draggable && <GripVertical className="size-3 shrink-0 text-muted-foreground opacity-0 group-hover/row:opacity-100" aria-hidden="true" />}
            <span className={cn("text-xs tabular-nums", active ? "font-semibold text-primary" : "text-muted-foreground")}>
              {slide.index}
              {active && " · 当前"}
            </span>
          </div>
          <button
            type="button"
            onClick={onSelect}
            aria-current={active}
            aria-label={`第 ${slide.index} 页 · ${slide.title}${slide.hidden ? "（已隐藏）" : ""}`}
            className={cn(
              "relative rounded-xl outline-none",
              active ? "ring-2 ring-primary ring-offset-2 ring-offset-transparent" : "ring-1 ring-border hover:ring-ring",
              "focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <MiniSlide kind={slide.kind} className={cn(slide.hidden && "opacity-50")} />
            {slide.hidden && (
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-md bg-[repeating-linear-gradient(135deg,var(--border)_0px,var(--border)_1px,transparent_1px,transparent_7px)] opacity-70"
              />
            )}
            <div className="absolute top-1 right-1 flex gap-1">
              {!!slide.warningCount && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className="h-4 gap-0.5 border-transparent bg-warning px-1 text-2xs text-white">
                      <TriangleAlert className="size-2.5" />{slide.warningCount}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>{slide.warningCount} 处内容无法完整显示</TooltipContent>
                </Tooltip>
              )}
              {!!slide.commentCount && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="h-4 gap-0.5 px-1 text-2xs">
                      <MessageSquare className="size-2.5" />{slide.commentCount}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>{slide.commentCount} 条未解决评论</TooltipContent>
                </Tooltip>
              )}
            </div>
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={() => toast("已新建幻灯片")}>新建幻灯片 <ContextMenuShortcut>⌘M</ContextMenuShortcut></ContextMenuItem>
        <ContextMenuItem onSelect={onDuplicate}><Copy /> 复制幻灯片</ContextMenuItem>
        <ContextMenuItem variant="destructive" onSelect={onDelete}><Trash2 /> 删除幻灯片 <ContextMenuShortcut>Del</ContextMenuShortcut></ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onToggleHidden}><EyeOff /> {slide.hidden ? "取消隐藏" : "隐藏幻灯片"}</ContextMenuItem>
        <ContextMenuItem onSelect={() => toast("切换效果为只读展示：见“切换”页签")}><SlidersHorizontal /> 切换效果…</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * 母版视图的缩略图窗格：与 PowerPoint 一致，**仍是缩略图**而不是文字树——
 * 每个母版一张大缩略图（编号 + 名称），其版式作为缩进的小缩略图挂在下方（左侧连接线），
 * 卡片、选中环、标签样式与普通视图的 SlideRow 同款（用户反馈 2026-09-16："母版视图下左侧和普通是一样的，都是缩略图"）。
 * Q16-e（裁决 2026-09-18 §4.10）：版式支持 Shift（连续）/ ⌘·Ctrl（切换）多选，限同一母版下；母版节点始终单选。
 */
function MasterThumbnails({
  selection,
  onSelect,
  loading,
}: {
  selection?: MasterSelection
  onSelect?: (sel: MasterSelection) => void
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-3 p-3 pt-2">
        <Skeleton className="aspect-video w-full rounded-xl" />
        <div className="ml-5 flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-video w-full rounded-xl" />)}
        </div>
      </div>
    )
  }
  return (
    <ScrollArea className="flex-1">
      <div role="listbox" aria-multiselectable="true" aria-label="母版与版式（版式支持 Shift / ⌘ 多选）" className="flex flex-col gap-4 p-3 pt-2">
        {masters.map((m, i) => (
          <MasterGroup key={m.id} index={i + 1} master={m} selection={selection} onSelect={onSelect} />
        ))}
        <button
          type="button"
          onClick={() => toast("已新建母版")}
          className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-dashed border-foreground/15 text-xs font-medium text-secondary-foreground hover:bg-muted"
        >
          <Plus className="size-3.5" /> 新建母版
        </button>
      </div>
    </ScrollArea>
  )
}

/** 由当前选中态与修饰键推导版式点击后的新选中态：Shift = 从锚点到目标的连续区间；⌘/Ctrl = 切换单个；否则单选 */
function nextLayoutSelection(selection: MasterSelection | undefined, master: MasterDef, layoutId: string, e: MouseEvent): MasterSelection {
  const anchor = selection?.masterId === master.id ? selection.layoutId : undefined
  const additive = e.metaKey || e.ctrlKey
  if (!anchor || (!e.shiftKey && !additive)) return { masterId: master.id, layoutId }
  const order = master.layouts.map((l) => l.id)
  if (e.shiftKey) {
    const a = order.indexOf(anchor)
    const b = order.indexOf(layoutId)
    const [lo, hi] = a < b ? [a, b] : [b, a]
    const ids = order.slice(lo, hi + 1)
    return { masterId: master.id, layoutId: anchor, layoutIds: ids.length > 1 ? ids : undefined }
  }
  const current = selection?.layoutIds ?? [anchor]
  const toggled = current.includes(layoutId) ? current.filter((id) => id !== layoutId) : [...current, layoutId]
  // 取消最后一个选中项时保持该版式单选（与 PowerPoint 一致，窗格内至少有一个选中）
  if (toggled.length === 0) return { masterId: master.id, layoutId }
  const ids = order.filter((id) => toggled.includes(id))
  const nextAnchor = ids.includes(anchor) ? anchor : ids[0]!
  return { masterId: master.id, layoutId: nextAnchor, layoutIds: ids.length > 1 ? ids : undefined }
}

function MasterGroup({
  index,
  master,
  selection,
  onSelect,
}: {
  index: number
  master: MasterDef
  selection?: MasterSelection
  onSelect?: (sel: MasterSelection) => void
}) {
  const totalPages = master.layouts.reduce((sum, l) => sum + l.pageCount, 0)
  const masterSelected = selection?.masterId === master.id && !selection.layoutId
  const selectedLayoutIds = selection?.masterId === master.id ? (selection.layoutIds ?? (selection.layoutId ? [selection.layoutId] : [])) : []
  return (
    <div className="flex flex-col gap-1.5">
      <MasterThumb
        label={
          <>
            <span className="tabular-nums">{index}</span> · 母版 · {master.name}
            {master.imported && <Badge variant="outline" className="ml-1 h-4 px-1 text-2xs font-normal">导入</Badge>}
          </>
        }
        hint={`${master.layouts.length} 版式 · ${totalPages} 页`}
        kind="title"
        selected={masterSelected}
        ariaLabel={`母版 ${master.name}`}
        onClick={() => onSelect?.({ masterId: master.id })}
      />
      <div className="ml-4 flex flex-col gap-2 border-l border-foreground/10 pl-3">
        {master.layouts.map((l) => {
          const layoutSelected = selectedLayoutIds.includes(l.id)
          return (
            <MasterThumb
              key={l.id}
              label={l.name}
              hint={l.pageCount === 0 ? "未使用" : `${l.pageCount} 页`}
              hintMuted={l.pageCount === 0}
              kind={l.kind}
              selected={layoutSelected}
              ariaLabel={`版式 ${l.name}（${master.name}）`}
              onClick={(e) => onSelect?.(nextLayoutSelection(selection, master, l.id, e))}
            />
          )
        })}
      </div>
    </div>
  )
}

function MasterThumb({
  label,
  hint,
  hintMuted,
  kind,
  selected,
  ariaLabel,
  onClick,
}: {
  label: ReactNode
  hint: string
  hintMuted?: boolean
  kind: LayoutDef["kind"]
  selected: boolean
  ariaLabel: string
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-1 pr-0.5">
        <span className={cn("min-w-0 flex-1 truncate text-xs", selected ? "font-semibold text-primary" : "text-muted-foreground")}>{label}</span>
        <span className={cn("shrink-0 text-2xs tabular-nums", hintMuted ? "text-muted-foreground/60" : "text-muted-foreground")}>{hint}</span>
      </div>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        aria-label={ariaLabel}
        onClick={onClick}
        className={cn(
          "relative rounded-xl outline-none",
          selected ? "ring-2 ring-primary ring-offset-2 ring-offset-transparent" : "ring-1 ring-border hover:ring-ring",
          "focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <MiniSlide kind={kind} />
      </button>
    </div>
  )
}
