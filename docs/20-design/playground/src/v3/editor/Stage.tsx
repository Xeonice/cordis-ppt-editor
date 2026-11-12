import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { RemoteCursor, SelectionBox } from "../kit/canvas"
import { useTakeoverOpen } from "../kit/InspectorTakeover"
import { closeWithFocusBack } from "../kit/layer"
import { useBreakpoint } from "./breakpoint"
import { PANEL_LIMITS, PanelResizer } from "./resize"
import { CARD_POS } from "../SlideArt"
import { DeckCommentPins, deckPinsOf, DeckSlideView, isStockSlide, useDeckPick, useDeckPins, type DeckSlide } from "./deck"
import { useInspectorTab } from "./Inspector"
import type { SelectionKind } from "./inspector/registry"

/** 选中对象种类（旧名，等同 SelectionKind）。 */
export type Sel = SelectionKind

/** 远端协作者光标在示例文档各页内的落点（百分比）：每页只出现一处，不加更多装饰。 */
const CURSOR_AT: Record<number, string> = {
  1: "left-[60%] top-[63%]",
  2: "left-[46%] top-[44%]",
  3: "left-[72%] top-[15%]",
  4: "left-[72%] top-[15%]",
  5: "left-[42%] top-[44%]",
  6: "left-[72%] top-[15%]",
}

/**
 * 画评论钉时远端光标让开的落点（钉在右上方：第 4 页的光标缺省在 72% / 15%，正挨着李雷的钉）——与第 1 批 main-states 评审态挪开光标的位置相同（两组柱子之间）。
 * 只在底座自己画钉（commentPins）、状态又没指定光标位置时用
 */
const CURSOR_AT_WITH_PINS: Record<number, string> = { 4: "left-[48%] top-[62%]" }

/**
 * 底座画的示例评论钉：点钉切到检查器「评论」页签（01 §2.3「点评论钉」是允许自动切页签的那一种）。
 * 状态声明了整栏面板（inspector.takeover：版本历史、保真报告、个人插件面板的整栏备选）且正开着时，检查器被面板占着、没有页签——
 * 先收起面板（kit closeWithFocusBack：焦点在钉上，不动；万一焦点在面板里就先交给画布，不经过 body），再切到「评论」，与点「关闭」后再点「评论」页签同一结果；
 * 面板各自收起时要清的状态（如保真报告的定位高亮）由场景按面板开关自己清，这里只管开关与页签。
 */
function StagePins({ slide, takeover }: { slide: DeckSlide; takeover: boolean }) {
  // 钉读线程数据（rulings §4.25 TB-83，评论场景登记的数据源）：在缺省评论面板里解决或删除一条，这里随之变化；点钉同时在面板里定位到那一条
  const pins = useDeckPins(slide)
  const locate = useDeckPick()
  const [, setTab] = useInspectorTab()
  const [panelOpen, setPanelOpen] = useTakeoverOpen()
  return (
    <DeckCommentPins
      slide={slide}
      pins={pins}
      onPick={(p) => {
        if (takeover && panelOpen) closeWithFocusBack(() => setPanelOpen(false), null, document.querySelector("[data-v3-takeover]"))
        if (locate && p.id) locate(p.id)
        setTab("comments")
      }}
    />
  )
}

/**
 * 单页视图的画布：canvas 底色，幻灯片居中且尽可能大（左右至少 48px、上方 40px），暗色不加阴影、亮色只加极轻阴影。
 * 舞台本身是 size 容器：幻灯片宽度 = min(可用宽, 可用高 × 16/9)，不靠 JS 测量。网格视图见 GridView。
 * 锚点：stage（画布）、slide（当前页幻灯片框，场景的 slideOverlay 就画在它里面）、notes（备注框）。
 */
export function Stage({
  slide,
  sel,
  onSel,
  notes,
  notesText,
  overlay,
  cursor,
  readOnly,
  notesHeight,
  onNotesHeight,
  resizeActive,
  commentPins,
  takeover = false,
}: {
  slide: DeckSlide
  sel: SelectionKind
  onSel: (s: SelectionKind) => void
  notes: boolean
  /** 备注内容；缺省是占位文字 */
  notesText?: ReactNode
  /** 场景的幻灯片叠加层（父元素就是幻灯片框） */
  overlay?: ReactNode
  /** 远端协作者光标：false 不显示，缺省示例页各一处 */
  cursor?: false | { at: string; name?: string }
  /** 只读（评审 / 浏览）：备注没有内容时写「这一页没有演讲者备注」，不出现邀请输入的占位（main-states 定稿） */
  readOnly?: boolean
  /** 备注高（缺省 120）；给了 onNotesHeight 且是桌面形态时把手可拖（03-20、02 §3.3） */
  notesHeight?: number
  onNotesHeight?: (h: number) => void
  /** 把手显示悬停 / 拖动中的样子（演示） */
  resizeActive?: boolean
  /** 照常画示例文档的评论钉（EditorConfig.stage.commentPins，编辑模式照常显示评论钉，rulings §4.25 DS-43） */
  commentPins?: boolean
  /** 状态声明了整栏面板（inspector.takeover）：点评论钉时面板开着就先收起它，再切到「评论」页签（StagePins） */
  takeover?: boolean
}) {
  const desktop = useBreakpoint() === "desktop"
  const nh = desktop ? (notesHeight ?? PANEL_LIMITS.notes.def) : PANEL_LIMITS.notes.def
  /** 示例第 2 页右侧的要点卡是页面内容，所有状态都在；只有 sel === "shape" 时才被选中 */
  const hasCard = isStockSlide(slide, 2)
  const titleEditable = isStockSlide(slide, 1)
  const pins = !!commentPins && deckPinsOf(slide).length > 0
  const cursorAt = cursor === false ? undefined : (cursor?.at ?? (pins ? CURSOR_AT_WITH_PINS[slide.n] : undefined) ?? CURSOR_AT[slide.n])

  return (
    <>
      {/* tabIndex −1：「跳至画布」与关闭浮层后无处可回时的焦点落点（不进 Tab 顺序，不画焦点环） */}
      <div
        data-v3-anchor="stage"
        tabIndex={-1}
        aria-label="画布"
        role="group"
        className="relative flex min-h-0 flex-1 items-center justify-center px-12 pt-10 pb-6 outline-none [container-type:size]"
        onClick={() => onSel("none")}
      >
        <div data-v3-anchor="slide" className="relative w-[min(100cqw,calc(100cqh_*_16/9))] rounded-[4px] shadow-(--v3-slide-shadow)">
          <DeckSlideView slide={slide} where="canvas" selection={sel} editing={titleEditable && sel === "text"} className="rounded-[4px]" />

          {/* 点选区域：要点卡、第 1 页标题 */}
          {hasCard && sel !== "shape" && (
            <button
              type="button"
              aria-label="选择要点卡"
              onClick={(e) => {
                e.stopPropagation()
                onSel("shape")
              }}
              className={cn("absolute cursor-default", CARD_POS)}
            />
          )}
          {titleEditable && sel !== "text" && (
            <button
              type="button"
              aria-label="编辑标题"
              onClick={(e) => {
                e.stopPropagation()
                onSel("text")
              }}
              className="absolute top-[31.2%] left-[9.3%] h-[16.6%] w-[72%] cursor-text"
            />
          )}

          {/* 选中框：1px 强调色线 + 四角小方块手柄 + 下方强调色尺寸标签 */}
          {hasCard && sel === "shape" && <SelectionBox at={CARD_POS} label="264 × 176" />}

          {pins && <StagePins slide={slide} takeover={takeover} />}

          {overlay}

          {cursorAt && <RemoteCursor at={cursorAt} name={cursor ? cursor.name : undefined} />}
        </div>
      </div>

      {notes && (
        <div className="shrink-0 px-12">
          {/* 把手（40 × 4）：桌面形态下是备注高度的分隔条（上下拖动、↑ ↓ 键），其他形态只是装饰 */}
          {desktop && onNotesHeight ? (
            <div className="mb-1 -mt-1.5">
              <PanelResizer panel="notes" value={nh} onChange={onNotesHeight} active={resizeActive} />
            </div>
          ) : (
            <div className="mx-auto mb-2 h-1 w-10 rounded-[2px] bg-(--v3-handle)" aria-hidden="true" />
          )}
          {/*
            备注区（rulings §4.25 DS-134，TB-58 第二项）：凹陷底——去掉描边，铺一块比画布深一档的底（--v3-notes-fill：暗 #151515、亮 #EBEBEB，与画布都是 1.09），
            读作嵌进画布的输入区；悬停出与分隔线同档的细边（同字段，DS-35）。占位字取 --v3-notes-placeholder（暗 text-3、亮 text-2：亮色 text-3 在这块底上只有 2.89，
            沿用 DS-41 方案 B 的先例提到 text-2）。圆角 8、内边距 12、把手、高度与位置都不变（DS-135：把手取值维持 --v3-border-control）
          */}
          <div
            data-v3-anchor="notes"
            style={{ height: nh }}
            className="overflow-y-auto rounded-[8px] border border-transparent bg-(--v3-notes-fill) p-3 text-[12px] leading-[18px] text-(--v3-notes-placeholder) hover:border-(--v3-field-line-hover)"
          >
            {notesText || slide.notes ? (
              <div className="text-(--v3-text)">{notesText || slide.notes}</div>
            ) : readOnly ? (
              <span className="text-(--v3-text-2)">这一页没有演讲者备注</span>
            ) : (
              "添加演讲者备注…"
            )}
          </div>
        </div>
      )}
    </>
  )
}
