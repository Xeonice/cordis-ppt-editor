import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { MessageSquare, Play, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRunCommand } from "../kit/commands"
import type { MainMenuOptions } from "../kit/mainMenu"
import type { V3View } from "../params"
import { Button, ICON, IconButton } from "../ui"
import { Collaborators, DocMenu, MainMenu, PRESENT_KBD, PRESENT_TIP, ShareButton, ViewToggle, ZoomMenu, type CollaboratorsConfig } from "./chrome"
import { DeckSlideView, useDeckCounts, type DeckSlide } from "./deck"
import type { NewSlideOption } from "./LeftRail"

/** 幻灯片的设计宽度：缩放读数 = 幻灯片显示宽度 ÷ 1280。 */
const SLIDE_W = 1280

/** 浮动胶囊：48px 高、panel 底、1px 边、圆角 12px、浮层阴影，距画布上沿与左 / 右沿各 12px。 */
const CAPSULE =
  "absolute top-3 z-20 flex h-12 items-center gap-1 rounded-[12px] border border-(--v3-border) bg-(--v3-panel) shadow-(--v3-shadow) select-none"

/** 量元素的实际宽度（ResizeObserver）：首帧绘制前就量好，之后随视口变化更新。 */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth(el.getBoundingClientRect().width)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/**
 * 网格视图（以 Figma Slides 的网格视图为基准）：左栏和检查器都不渲染，只剩两个浮动胶囊、幻灯片网格与底部工具条。
 * 左上胶囊接替左栏顶部（主菜单、文档标题、新建幻灯片、单页 / 网格），右上胶囊接替检查器顶部（协作者、缩放、放映、分享）。
 * 网格视图里视图切换唯一的常驻入口是左上胶囊的「单页 / 网格」（另有主菜单「视图」子菜单，不常驻）。
 * 右上胶囊里自己的头像同样点开账户菜单（DS-18）；放映的提示是「从当前页放映 ⇧F5」（rulings §4.25 TB-103：按钮从当前页开始，ED-16）。
 * 锚点与单页视图同名：main-menu、doc-menu、new-slide、view-toggle、collaborators、account、zoom、present、share、thumb-<n>。
 */
export function GridView({
  deck,
  slide,
  onSelect,
  onOpen,
  onView,
  notes,
  onNotes,
  focusToggle,
  status,
  menu,
  newSlide,
  liveComments,
  collaborators,
  shareReason,
  selected,
}: {
  deck: DeckSlide[]
  slide: number
  /** 单击：选中这一页（当前页描边移过去） */
  onSelect: (n: number) => void
  /** 双击或回车：回到单页视图并定位到这一页 */
  onOpen: (n: number) => void
  onView: (v: V3View) => void
  /** 单页里的备注开关：网格视图下主菜单的备注项置灰，只透传、不改 */
  notes: boolean
  onNotes: (v: boolean) => void
  /** 由左栏顶部的切换按钮或主菜单切进来：挂载时把焦点交给胶囊里的「网格」按钮 */
  focusToggle: boolean
  /**
   * 同步 / 保存状态（EditorConfig.rail.status，非缺省时才显示）：紧凑形态跟在文件名后面（02 §5.1「网格视图中的同步状态」）。
   * 缺省「✓ 已同步」在网格里不显示，胶囊保持最短。
   */
  status?: ReactNode
  /** 主菜单条目定制（同左栏） */
  menu?: Partial<MainMenuOptions>
  /** 「+ 新建幻灯片」：false 不渲染（评审 / 浏览模式），reason 不可用 */
  newSlide?: NewSlideOption
  /** 评论角标读线程数据（底座画评论钉的状态，rulings §4.25 TB-83，同左栏） */
  liveComments?: boolean
  /** 头像组（同检查器） */
  collaborators?: CollaboratorsConfig
  /** 「分享」不可用的原因（同检查器顶行，editor/chrome.tsx shareReasonOf：M2「后续版本提供」、打开中…）；null = 宿主没给、不渲染（TB-161） */
  shareReason?: string | null
  /**
   * 另外选中的页（多选，与当前页同样的 2px 强调色环、页码不变色，同第 1 批网格多选的画法 slides-selection/GridDrag.tsx SelectedRing；不是 aria-current）。
   * 宿主只在母版视图「在普通视图查看引用页」退出回到网格时给（exit 的 slides，directions §2.10），换页即清掉；不给时与原来相同。2026-10-29 补完（复验 R2-N6）
   */
  selected?: number[]
}) {
  const [frameRef, slideW] = useWidth<HTMLSpanElement>()
  const run = useRunCommand()
  const ns = newSlide === false ? null : (newSlide ?? {})
  return (
    <>
      <div role="group" aria-label="文档" className={cn(CAPSULE, "left-3 pr-2.5 pl-2")}>
        <MainMenu view="grid" onView={onView} notes={notes} onNotes={onNotes} options={menu} />
        {/* 分隔线两侧留白相等（11.5px）：左边是 ▾ 字形自带 3.5 + 按钮右内边距 4 + 间距 4，右边是外边距 7.5 + 间距 4 到新建按钮底色 */}
        <DocMenu className="pr-1" mode={menu?.mode} canEdit={menu?.canEdit} degraded={menu?.readonlyDegraded} />
        {status && <span className="ml-0.5 flex h-7 shrink-0 items-center pr-2 whitespace-nowrap [&>*]:h-7">{status}</span>}
        {ns && (
          <>
            <span aria-hidden="true" className="mr-[7.5px] h-5 w-px shrink-0 bg-(--v3-border)" />
            <Button variant="secondary" disabled={!!ns.reason} reason={ns.reason} className="px-2.5" data-v3-anchor="new-slide">
              <Plus {...ICON} />
              {ns.label ?? "新建幻灯片"}
            </Button>
          </>
        )}
        <ViewToggle view="grid" onView={onView} size={28} tipSide="bottom" autoFocus={focusToggle} className="ml-1" />
      </div>

      <div role="group" aria-label="协作与分享" className={cn(CAPSULE, "right-3 pr-2.5 pl-3")}>
        <Collaborators people={collaborators?.people} extra={collaborators?.extra} following={collaborators?.following} list={collaborators?.list} listOpen={collaborators?.listOpen} />
        {/*
          分隔线把「协作者 + 缩放」与「放映 + 分享」分成两组，四段可见间距都约 11.5px（与左上胶囊的分隔线两侧一致）：
          头像 → 读数是间距 4 + 左内边距 8；▾ 字形 → 分隔线是字形自带 3.5 + 右内边距 4 + 间距 4；
          分隔线 → 放映三角是间距 4 − 1 + 三角左侧留白 8.5；放映三角 → 分享底色是三角右侧留白 7.5 + 间距 4。
        */}
        <ZoomMenu readout={`${Math.round((slideW / SLIDE_W) * 100)}%`} className="pr-1" />
        <span aria-hidden="true" className="-mr-px h-5 w-px shrink-0 bg-(--v3-border)" />
        {/* 提示「从当前页放映 ⇧F5」（rulings §4.25 TB-103，同检查器顶行） */}
        <IconButton label="放映" tip={PRESENT_TIP} kbd={PRESENT_KBD} tipSide="bottom" data-v3-anchor="present" onClick={() => void run("present")}>
          <Play {...ICON} fill="currentColor" />
        </IconButton>
        {shareReason !== null && <ShareButton reason={shareReason} />}
      </div>

      {liveComments ? (
        <LiveSlideGrid deck={deck} slide={slide} selected={selected} onSelect={onSelect} onOpen={onOpen} frameRef={frameRef} />
      ) : (
        <SlideGrid deck={deck} slide={slide} selected={selected} onSelect={onSelect} onOpen={onOpen} frameRef={frameRef} />
      )}
    </>
  )
}

/**
 * 全部幻灯片的网格：网格最宽 1440px、在画布里水平居中，列宽均分、幻灯片保持 16:9，列距 32px、行距 40px。
 * 列数看画布可用宽度（画布宽减去左右各 48px 内边距，用容器查询判断）：≥ 1180px 3 列，≥ 760px 2 列，否则 1 列。
 * 上内边距 88px 让第一行避开浮动胶囊，下内边距 112px 让最后一行不被底部工具条挡住；超出时在画布内纵向滚动。
 * 同样的值也设成 scroll-padding：键盘移动焦点时，浏览器把焦点页滚到胶囊下方、工具条上方，而不是视口边缘。
 */
type SlideGridProps = {
  deck: DeckSlide[]
  slide: number
  /** 另外选中的页（见 GridView selected） */
  selected?: number[]
  onSelect: (n: number) => void
  onOpen: (n: number) => void
  /** 第 1 页的幻灯片框：量它的宽度得出缩放读数（各列等宽） */
  frameRef: RefObject<HTMLSpanElement | null>
  /** 各页的评论数读线程数据（TB-83）：本来有评论的页写未解决数，读屏名「N 条未解决评论」；不给时取 slide.comments */
  counts?: ((page: number) => { n: number; resolved: number }) | null
}

/** 网格、角标读线程数据（rulings §4.25 TB-83，同左栏 LiveRailList） */
function LiveSlideGrid(props: Omit<SlideGridProps, "counts">) {
  const counts = useDeckCounts()
  return <SlideGrid {...props} counts={counts} />
}

function SlideGrid({ deck, slide, selected, onSelect, onOpen, frameRef, counts }: SlideGridProps) {
  return (
    <div className="@container min-h-0 flex-1 scroll-pt-[88px] scroll-pb-[112px] overflow-y-auto px-12 pt-[88px] pb-[112px] select-none">
      <ol aria-label="幻灯片" className="mx-auto grid max-w-[1440px] grid-cols-1 gap-x-8 gap-y-10 @min-[760px]:grid-cols-2 @min-[1180px]:grid-cols-3">
        {deck.map((s, i) => {
          const n = s.n
          const on = n === slide
          // 多选中的页：与当前页同样的强调色环（页码与 aria-current 只给当前页）
          const ringed = on || !!selected?.includes(n)
          const live = counts && (s.comments ?? 0) > 0 ? counts(n) : null
          const comments = live ? live.n : s.comments
          return (
            <li key={n}>
              <button
                type="button"
                data-v3-anchor={`thumb-${n}`}
                aria-current={on ? "true" : undefined}
                aria-label={comments ? `第 ${n} 页，${comments} 条${live ? "未解决" : ""}评论` : `第 ${n} 页`}
                onClick={() => onSelect(n)}
                onDoubleClick={() => onOpen(n)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    onOpen(n)
                    return
                  }
                  if (e.key === " ") {
                    e.preventDefault()
                    onSelect(n)
                    return
                  }
                  // 方向键在页间移动焦点（02 §5.3）：← → 前后一页，↑ ↓ 上下一行（列数取网格实际的列数），Home / End 第一页 / 最后一页；
                  // 只移动焦点，不改当前页（焦点框与当前页描边分开画，§5.2）；空格选中、Enter 打开
                  const ol = e.currentTarget.closest("ol")
                  if (!ol || e.altKey || e.ctrlKey || e.metaKey) return
                  const cols = Math.max(1, getComputedStyle(ol).gridTemplateColumns.split(" ").filter(Boolean).length)
                  const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }
                  let to: number | null = null
                  if (e.key in step) to = i + step[e.key]!
                  else if (e.key === "Home") to = 0
                  else if (e.key === "End") to = deck.length - 1
                  if (to === null) return
                  e.preventDefault()
                  const next = deck[Math.min(deck.length - 1, Math.max(0, to))]
                  if (next) ol.querySelector<HTMLElement>(`[data-v3-anchor="thumb-${next.n}"]`)?.focus()
                }}
                // 焦点框不画在整个按钮上（会把页码框进去、且与当前页描边贴在一起），改画在下面的幻灯片框上
                className="group block w-full text-left outline-none"
              >
                {/* 页码在每页左上方：12px 次色，当前页用强调色 */}
                <span className={cn("block text-[12px] leading-4 tabular-nums", on ? "text-(--v3-accent)" : "text-(--v3-text-2)")}>{n}</span>
                {/*
                  1px 描边，悬停加深；当前页 2px 强调色描边。
                  键盘焦点：幻灯片框外 2px 中性色（--v3-text，暗近白、亮近黑）outline、偏移 4px，跟随 4px 圆角；页码区不画框。
                  这是 v3「焦点环用强调色」的例外：当前页已占用 2px 强调色描边，焦点框再用强调色时，亮色下焦点页会被误读为
                  第二个选中页（视觉评审第 3 轮 major）；改用中性色后两者一眼可分（设计质量门记录见 design-language-v3 docs-sync）。
                */}
                <span
                  ref={i === 0 ? frameRef : undefined}
                  className={cn(
                    "relative mt-2 block overflow-hidden rounded-[4px] transition-shadow",
                    "group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-(--v3-text)",
                    ringed ? "ring-2 ring-(--v3-accent)" : "ring-1 ring-(--v3-border) group-hover:ring-(--v3-hover-line)",
                  )}
                >
                  <DeckSlideView slide={s} where="grid" />
                  {!!comments && (
                    <span className="absolute top-2 right-2 inline-flex h-5 items-center gap-1 rounded-[4px] border border-(--v3-border) bg-(--v3-panel) px-1.5 text-[12px] leading-none text-(--v3-text-2) tabular-nums">
                      <MessageSquare size={12} strokeWidth={1.5} aria-hidden="true" />
                      {comments}
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
