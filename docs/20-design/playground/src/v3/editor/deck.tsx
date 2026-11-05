import type { ReactNode } from "react"
import { COMMENT_COUNT, LI, SLIDE_LIST, WANG, ZHANG, type Person } from "../data"
import { CommentPin } from "../kit/canvas"
import { SLIDE_NAMES, SlideArt, SlideFrame, type SlideNo } from "../SlideArt"
import type { SelectionKind } from "./inspector/registry"

/**
 * 编辑器里的「文档」：一组幻灯片。左栏缩略图、网格视图、画布、检查器「版式」字段都读同一份 deck。
 * 缺省是示例文档「2026 年 Q2 业绩汇报」6 页（SlideArt）；场景可以改某页、加页（表格页、图表页、空占位符页…），
 * 自定义页的内容由 render 画在 16:9 的 SlideFrame 里——缩略图与画布都是真实渲染，不用骨架条（Q8）。
 */
export interface DeckSlide {
  /** 页码（1 起）：左栏 / 网格的序号，也是 EditorConfig.slide 的取值 */
  n: number
  /** 页名：无障碍名称「第 n 页：页名」 */
  name: string
  /** 版式名：检查器「版式」字段的当前值 */
  layout: string
  /** 评论数：缩略图右上角角标；有评论时「评论」页签列出示例评论 */
  comments?: number
  /** 演讲者备注（画布下方备注区的内容；没有时编辑态显示「添加演讲者备注…」占位，只读时写「这一页没有演讲者备注」） */
  notes?: string
  /**
   * 自定义内容（不传则按 n 渲染示例文档第 1–6 页）。
   * 返回的内容放在 SlideFrame 里：根元素用 absolute 定位，字号、间距、线宽用 cqw（1cqw = 幻灯片宽的 1%），颜色用 .v3-slide 的 --s-* token。
   * where 区分画布 / 左栏缩略图 / 网格；selection 是当前选中种类（只在画布上有意义，如文字编辑态的插入点）。
   */
  render?: (o: SlideRenderOpts) => ReactNode
  /**
   * 这一页的示例评论钉（缺省：示例文档原样页按 DECK_PINS 取，换了内容的页没有）。换了内容但版面与原样页相同、评论仍锚在原处的页写同一组钉，
   * 如查找替换「全部替换」后的第 4 页（标题与正文的「营收」换成「收入」，图表不变）：deckWith({ 4: { render, pins: DECK_PINS[4] } })
   */
  pins?: DeckPin[]
}

export interface SlideRenderOpts {
  where: "canvas" | "thumb" | "grid"
  selection: SelectionKind
}

const isSlideNo = (n: number): n is SlideNo => Number.isInteger(n) && n >= 1 && n <= 6

/** 示例文档里有演讲者备注的页（与 main-states 评审态的备注同一份） */
const STOCK_NOTES: Partial<Record<SlideNo, string>> = {
  3: "三项指标都按同比口径；毛利率的变化单位是百分点（pt），不是百分比。",
  4: "先讲 6 月创年内新高，再对比 Q1 与 Q2：Q2 累计 1.28 亿元，同比 +18%。海外业务口径待王小明确认。",
}

/** 示例文档 6 页（版式、评论数与 data.ts 一致）。 */
export const DEFAULT_DECK: DeckSlide[] = SLIDE_LIST.map(({ n, layout }) => ({ n, name: SLIDE_NAMES[n], layout, comments: COMMENT_COUNT[n], notes: STOCK_NOTES[n] }))

/**
 * 在示例文档基础上改页、加页：
 *   deckWith({ 3: { name: "季度明细", render: () => <QuarterTable /> } })        改第 3 页
 *   deckWith({}, [{ n: 7, name: "附录", layout: "仅标题", render: () => <Appendix /> }])   追加第 7 页
 * 追加页按 n 排序；与已有页同号时替换整页。
 */
export function deckWith(patch: Record<number, Partial<Omit<DeckSlide, "n">>> = {}, extra: DeckSlide[] = []): DeckSlide[] {
  // 换了内容（render）的页不再沿用示例页的备注，除非 patch 自己写了 notes
  const base = DEFAULT_DECK.map((s) => {
    const p = patch[s.n]
    return { ...s, ...(p?.render && !("notes" in p) ? { notes: undefined } : null), ...p }
  })
  const byN = new Map(base.map((s) => [s.n, s] as const))
  for (const s of extra) byN.set(s.n, s)
  return [...byN.values()].sort((a, b) => a.n - b.n)
}

/** 按页码找页；找不到时退回第一页（避免场景写错页码时整个编辑器报错）。 */
export function slideOf(deck: DeckSlide[], n: number): DeckSlide {
  return deck.find((s) => s.n === n) ?? deck[0] ?? DEFAULT_DECK[0]!
}

/**
 * 渲染 deck 里的一页：示例页走 SlideArt（画布上第 1 页标题可进入文字编辑态），自定义页走 SlideFrame + render。
 * 左栏缩略图、网格、画布都用它，三处长得一样。
 */
export function DeckSlideView({
  slide,
  where,
  selection = "none",
  editing,
  className,
}: {
  slide: DeckSlide
  where: SlideRenderOpts["where"]
  selection?: SelectionKind
  /** 示例文档第 1 页标题的文字编辑态（仅画布） */
  editing?: boolean
  className?: string
}) {
  if (slide.render) {
    return (
      <SlideFrame label={`第 ${slide.n} 页：${slide.name}`} className={className}>
        {slide.render({ where, selection })}
      </SlideFrame>
    )
  }
  if (isSlideNo(slide.n)) return <SlideArt n={slide.n} editing={editing} className={className} />
  return <SlideFrame label={`第 ${slide.n} 页：${slide.name}`} className={className} />
}

/** 这一页是不是示例文档的原样页（画布上的要点卡点选、第 1 页标题编辑只对原样页生效）。 */
export const isStockSlide = (slide: DeckSlide, n: SlideNo) => slide.n === n && !slide.render

/** 示例文档页上的一枚评论钉：谁、锚点在幻灯片上的百分比位置、读屏名（「姓名的评论：正文开头」）；id 是线程 id（读线程数据时才有，点钉据此定位） */
export interface DeckPin {
  person: Person
  x: number
  y: number
  label: string
  id?: string
}

/**
 * 示例文档各页的评论钉（与 COMMENT_COUNT、检查器「评论」页签的示例评论同一批人、同一内容）：第 4 页 3 条。
 * 第 1 批 main-states 评审 / 只读浏览画的就是这三枚（同一份坐标，第 2 批评论面板的示例数据 comments/model.ts 「deck」同一批）；编辑模式照常显示评论钉（rulings §4.25 DS-43），
 * 用 EditorConfig.stage.commentPins 让底座画布画出（第 2 批场景与第 1 批编辑态停在第 4 页的画面）。
 */
export const DECK_PINS: Partial<Record<SlideNo, DeckPin[]>> = {
  4: [
    { person: WANG, x: 90.6, y: 50.5, label: "王小明的评论：6 月的数据是否包含海外业务？" },
    { person: LI, x: 70.6, y: 28.2, label: "李雷的评论：Q2 累计与财务报表对了一遍" },
    { person: ZHANG, x: 21, y: 56, label: "张三的评论：1–3 月用浅色、Q2 用深色" },
  ],
}

/** 一页上要画的示例评论钉：页自己写了 pins 就用它；否则只给示例文档的原样页（换了内容的页、评论数被改成 0 的页没有），所以场景改页不会留下对不上内容的钉 */
export const deckPinsOf = (slide: DeckSlide): DeckPin[] => slide.pins ?? (isSlideNo(slide.n) && !slide.render && (slide.comments ?? 0) > 0 ? (DECK_PINS[slide.n] ?? []) : [])

/**
 * 一页上的示例评论钉（画在幻灯片框里，kit CommentPin；哪些页有见 deckPinsOf）。
 * onPick：点钉（缺省只拦住冒泡、不取消选中，同第 1 批评审态）。pins：换掉要画的钉（底座读线程数据时传 useDeckPins 的结果，TB-83）。
 */
export function DeckCommentPins({ slide, onPick, pins: given }: { slide: DeckSlide; onPick?: (pin: DeckPin) => void; pins?: DeckPin[] }) {
  const pins = given ?? deckPinsOf(slide)
  return (
    <>
      {pins.map((p) => (
        <CommentPin key={p.id ?? p.label} person={p.person} x={p.x} y={p.y} label={p.label} onClick={onPick ? () => onPick(p) : undefined} />
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ 评论钉与角标读线程数据（rulings §4.25 TB-83） */

/**
 * 底座评论钉与左栏 / 网格评论角标的数据源（rulings §4.25 TB-83；第 2 批 docs-sync 2026-10-15「在缺省评论面板里解决或删除评论，底座画的钉与左栏角标不变」）：
 * 评论场景登记一次（comments.scenario.tsx registerCommentPins，与 registerCommentsBody 同一做法），底座在自己画钉的状态里（stage.commentPins 开着）读同一份线程数据——
 * 在缺省评论面板（TB-82）里解决、删除、回复一条，画布上的钉与左栏、网格的角标随之变化。三个都是 hook，只在登记了的前提下由底座按固定次序调用（登记发生在模块载入时、早于任何渲染）。
 * 没有登记时底座照旧画静态的 DECK_PINS、角标取 slide.comments。
 */
export interface CommentPinsSource {
  /** 第 page 页要画的钉（未解决、已锚定的线程，按线程先后；与 DECK_PINS 同一组坐标与人） */
  usePins: (page: number) => DeckPin[]
  /** 各页的线程数：n 未解决（角标的数字）、resolved 已解决（只在工具提示里） */
  useCounts: () => (page: number) => { n: number; resolved: number }
  /** 点钉：在「评论」页签里定位这条线程（选中、短暂高亮、读屏播报；切页签由它做） */
  usePick: () => (id: string) => void
}

let commentSource: CommentPinsSource | null = null

/** 评论场景登记线程数据源（模块顶层调用一次） */
export function registerCommentPins(src: CommentPinsSource) {
  commentSource = src
}

/**
 * 底座要画的钉：这一页本来有钉（deckPinsOf：示例原样页有评论，或换了内容但写了 pins）才画，画的是线程数据里这一页的钉；没有登记数据源时退回静态的那一组。
 * 只在底座画钉的组件里调用（StagePins），与 useDeckPick 同一个组件、先于它调用（线程数据在这里先按「deck」取初值）
 */
export function useDeckPins(slide: DeckSlide): DeckPin[] {
  const live = commentSource ? commentSource.usePins(slide.n) : null
  const stock = deckPinsOf(slide)
  if (stock.length === 0) return []
  return live ?? stock
}

/** 点钉定位（登记了数据源时）；没有时 null，底座只切页签 */
export function useDeckPick(): ((id: string) => void) | null {
  return commentSource ? commentSource.usePick() : null
}

/** 各页的评论数（登记了数据源时）；没有时 null，角标取 slide.comments */
export function useDeckCounts(): ((page: number) => { n: number; resolved: number }) | null {
  return commentSource ? commentSource.useCounts() : null
}
