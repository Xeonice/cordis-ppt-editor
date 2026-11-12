import { useContext, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { Popover as P } from "radix-ui"
import { cn } from "@/lib/utils"
import { V3RootContext } from "../V3Root"
import { anchorPlacement, findAnchor, useAnchorElement, useMarkAnchorOpen, useTrackedRect, type Align, type Side } from "./anchor"
import { focusBack, LayerCloseContext, useEscapeThroughTooltip, useFocusBackOnClose, userHasInteracted } from "./layer"

/** 浮层表面：panel 实底 + 1px 边 + 浮层阴影，圆角 8px（弹层、菜单同一档；对话框 2026-10-23 起为 12，rulings §4.25 DS-142）。自己画浮层时也用它。 */
export const POPOVER_SURFACE = "z-50 rounded-[8px] border border-(--v3-border) bg-(--v3-panel) text-(--v3-text) shadow-(--v3-shadow) outline-none"

/**
 * 横向贴到所在栏的内缘、纵向跟随控件的虚拟锚点：检查器里的弹层（如颜色选择）贴检查器左缘向左展开，与 Figma 一致，
 * 不会盖住检查器本身。contextElement 让定位随控件滚动、改尺寸而更新。
 */
function virtualAnchor(el: HTMLElement, region: "inspector" | "rail" | null) {
  return {
    contextElement: el,
    getBoundingClientRect(): DOMRect {
      const r = el.getBoundingClientRect()
      const box = region ? el.closest<HTMLElement>(`[data-v3-anchor="${region}"]`) : null
      if (!box) return r
      const p = box.getBoundingClientRect()
      return new DOMRect(region === "inspector" ? p.left : p.right, r.top, 0, r.height)
    },
  }
}

/**
 * cover="inspector" 的虚拟锚点（2026-10-30 母版视图改版第二步规格 §3.6）：取锚点所在检查器的左缘与页签行（「设计 / 评论」那一行）的下沿，
 * 内容从这里向右展开、宽同检查器——盖在检查器栏上，右缘贴窗口，画布不被盖住。不在检查器里时退回锚点本身
 */
function coverAnchor(el: HTMLElement) {
  return {
    contextElement: el,
    getBoundingClientRect(): DOMRect {
      const box = el.closest<HTMLElement>('[data-v3-anchor="inspector"]')
      if (!box) return el.getBoundingClientRect()
      const p = box.getBoundingClientRect()
      const tab = box.querySelector('[data-v3-anchor="tab-design"]')
      const row = tab?.closest('[role="tablist"]')?.parentElement ?? tab
      return new DOMRect(p.left, row?.getBoundingClientRect().bottom ?? p.top, 0, 0)
    },
  }
}

/**
 * cover="inspector" 的外框（2026-10-30 第二步总编排裁定第 4 条：盖住整栏）：宽 = 检查器当前宽，高从页签行下沿一直到检查器栏底（= 视口下沿）——
 * 高不随内容缩短，检查器原有内容在弹层外一处都不露（原来高随内容，弹层下沿把检查器的一行横着切开、下面还露着色块）。
 * 内容怎么排归内容自己（主题颜色与字体是页头、底栏固定，中间滚动）；内容不管滚动时弹层自己滚。
 * 角与边线：右、下两边贴窗口，同紧凑抽屉（narrow/compact.tsx DrawerFrame）贴边、整高的画法——贴窗口的边不画边线、角不圆；
 * 左上角落在页签行下沿与栏分隔线的交点上，圆角会在角上露出后面的检查器，也不圆。左边线与检查器原有的栏分隔线落在同一列像素上（弹层盖住栏时分隔线照样在）；
 * 上边不画边线（页签行自己的下边线就在弹层上沿，再画一条会成两道）。浮层阴影照旧：盖在画布与页签行上，读得出是一块盖上来的面板
 */
function coverStyle(box: { top: number; width: number; height: number }, top: number): CSSProperties {
  const bottom = Math.min(box.top + box.height, window.innerHeight)
  return { width: box.width, height: Math.max(0, bottom - top), overflowY: "auto", borderRadius: 0, borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0 }
}

export interface PopoverProps {
  /** 锚点名（data-v3-anchor），如 "tool-table"、"fill-color"、"new-slide"；见 kit/anchor.ts ANCHORS */
  anchor: string
  /** 受控打开；不传时由 defaultOpen 决定（缺省 true：场景状态里一出现就是打开的） */
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** 位置：缺省按锚点所在位置推断——工具条按钮向上居中（离工具条 8px）、检查器里贴检查器左缘向左、左栏里贴左栏右缘向右、其余向下 */
  side?: Side
  align?: Align
  sideOffset?: number
  alignOffset?: number
  /** false：不贴栏缘，直接贴着锚点元素本身 */
  snap?: boolean
  /** 无障碍名称（弹层没有可见标题时必填），如「插入表格」 */
  label?: string
  /** 内边距与宽度：缺省 p-1（放菜单式按钮网格）；面板式内容用 "w-[280px] p-3" 之类 */
  className?: string
  /** 离视口边缘的最小距离（缺省 8） */
  collisionPadding?: number
  /**
   * 盖在所在栏上（规格 §3.6，母版视图的「主题颜色与字体」）：inspector = 左缘贴检查器左缘、顶贴页签行下沿，宽 = 检查器当前宽（随拖动变），
   * 下沿铺到检查器栏底（= 视口下沿，2026-10-30 总编排裁定第 4 条：盖住整栏、高不随内容缩短，角与边线见 coverStyle）；
   * 不做避让（宽等于检查器、右缘贴视口时 Radix 会判溢出把它翻到左边）。不传时位置、尺寸与 DOM 都同原来
   */
  cover?: "inspector"
  /** Esc：调用 e.preventDefault() 可以不关闭（如「Esc 先清空搜索、再按才关闭」） */
  onEscapeKeyDown?: (e: KeyboardEvent) => void
  /** 点到外面 / 焦点移到外面：调用 e.preventDefault() 可以不关闭（如点的是触发器本身，由触发器自己切换） */
  onInteractOutside?: (e: Event) => void
  /** 关闭后焦点回到这个锚点（缺省是 anchor 本身）：弹层贴着一组元素定位、真正的触发器是其中一个按钮时用，如在线列表贴头像组、焦点回「+N」 */
  returnFocus?: string
  /**
   * false：挂上时不把焦点移进弹层（缺省 true：用户打开的照常移进第一个可聚焦项）。给不是用户此刻打开的弹层用——
   * 如换页回来时恢复的评论撰写框（rulings §4.25 DS-65、TB-79：焦点留在用户换页时所在处，点钉或按 Tab 才进撰写框）
   */
  autoFocus?: boolean
  children: ReactNode
}

/**
 * 锚定弹层：挂在工具条按钮、检查器控件、左栏按钮等已有元素上。点外面、按 Esc（焦点在带工具提示的控件上时也是一下就关）、
 * 或点弹层里的「关闭」「取消」（kit useLayerClose / LayerClose）关闭。
 * 场景状态里打开时不抢焦点（截图干净）；用户（键盘或指针）打开时把焦点移进弹层第一个可聚焦项，Tab 在层内循环。
 * 用 Esc 或弹层里的按钮关闭后，焦点回到锚点元素（触发处）；点外面关闭时焦点留在用户点的地方。
 *
 *   layers: <Popover anchor="tool-table" label="插入表格"><TableGrid /></Popover>
 */
export function Popover({
  anchor,
  open,
  defaultOpen = true,
  onOpenChange,
  side,
  align,
  sideOffset,
  alignOffset = 0,
  snap = true,
  label,
  className,
  collisionPadding = 8,
  cover,
  onEscapeKeyDown,
  onInteractOutside,
  returnFocus,
  autoFocus = true,
  children,
}: PopoverProps) {
  const root = useContext(V3RootContext)
  const el = useAnchorElement(anchor)
  const [inner, setInner] = useState(defaultOpen)
  const isOpen = open ?? inner
  const place = anchorPlacement(anchor, el)
  const region = snap ? place.region : null
  const virtualRef = useMemo(() => ({ current: el ? (cover ? coverAnchor(el) : virtualAnchor(el, region)) : null }), [el, region, cover])
  // cover：宽随检查器（拖动改宽、窗口变化时重量），高从页签行下沿到栏底（coverStyle）
  const coverBox = useTrackedRect(cover && el ? el.closest<HTMLElement>('[data-v3-anchor="inspector"]') : null)
  const coverTop = cover && el && coverBox ? coverAnchor(el).getBoundingClientRect().top : 0
  /** 这次关闭是不是因为点到了外面（那样焦点留在用户点的地方，不拉回锚点） */
  const outside = useRef(false)
  const contentRef = useRef<HTMLDivElement>(null)
  useMarkAnchorOpen(el, !!root && isOpen)
  const setOpen = (v: boolean) => {
    setInner(v)
    onOpenChange?.(v)
  }
  // 焦点停在带工具提示的控件上（如色块、×）时，同一下 Esc 收起提示并关闭弹层（不必按两次）
  useEscapeThroughTooltip(!!root && !!el && isOpen, contentRef, (e) => {
    onEscapeKeyDown?.(e)
    if (!e.defaultPrevented) setOpen(false)
  })
  // 关闭时焦点不在 body 停一帧（第 2 批第 6 轮集成）：弹层内容卸载的同一个任务末尾就交回锚点（同 onCloseAutoFocus 的规则；点外面关的不拉回，焦点留在用户点的地方）
  useFocusBackOnClose(!!root && !!el && isOpen, () => (outside.current ? null : ((returnFocus && root ? findAnchor(root, returnFocus) : null) ?? el)))
  if (!root || !el) return null
  return (
    <P.Root open={isOpen} onOpenChange={setOpen}>
      <P.Anchor virtualRef={virtualRef} />
      <P.Portal container={root}>
        <P.Content
          ref={contentRef}
          side={cover ? "right" : (side ?? place.side)}
          align={cover ? "start" : (align ?? place.align)}
          sideOffset={cover ? 0 : (sideOffset ?? place.sideOffset)}
          alignOffset={alignOffset}
          collisionPadding={collisionPadding}
          avoidCollisions={cover ? false : undefined}
          style={cover && coverBox ? coverStyle(coverBox, coverTop) : undefined}
          aria-label={label}
          onOpenAutoFocus={(e) => {
            // 场景状态里一出现就打开（还没有人操作过）：不抢焦点，截图干净；
            // 用户打开的（键盘或指针）照常把焦点移进弹层第一个可聚焦项，Tab / ⇧Tab 在层内循环（Radix FocusScope loop），Esc 关闭后回触发处
            // autoFocus false（不是用户此刻打开的，如换页回来恢复的撰写框）同样不抢
            if (!userHasInteracted() || !autoFocus) e.preventDefault()
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            const wasOutside = outside.current
            outside.current = false
            // 焦点已经有去处（关闭前就交给了来源，或弹层随别处的操作卸载、焦点在用户点的缩略图上——如写了内容的撰写框随换页收起，TB-79）：不再拉回锚点，
            // 同 useFocusBackOnClose 的判断；焦点随弹层内容一起卸载（落在 body）时才交回
            const a = document.activeElement
            const settled = !!a && a !== document.body && a.isConnected && !contentRef.current?.contains(a)
            // 锚点不可聚焦（如分组容器）时交给其中第一个控件或画布，不掉到 body
            if (!wasOutside && !settled) focusBack((returnFocus ? findAnchor(root, returnFocus) : null) ?? el)
          }}
          onEscapeKeyDown={onEscapeKeyDown}
          onInteractOutside={(e) => {
            onInteractOutside?.(e)
            if (!e.defaultPrevented) outside.current = true
          }}
          // 弹层经 Portal 挂在根节点，但 React 事件仍沿组件树冒泡：从幻灯片叠加层打开时，点弹层不应触发画布的「点空白取消选中」
          onClick={(e) => e.stopPropagation()}
          className={cn(POPOVER_SURFACE, "p-1", className)}
        >
          <LayerCloseContext.Provider value={() => setOpen(false)}>{children}</LayerCloseContext.Provider>
        </P.Content>
      </P.Portal>
    </P.Root>
  )
}

/** 弹层里的小标题（12px 600），面板式弹层的分组标题用。 */
export function PopoverTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("text-[12px] leading-4 font-semibold text-(--v3-text)", className)}>{children}</h3>
}
