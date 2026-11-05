import { Fragment } from "react"
import { ContextMenu, DEFAULT_DECK, deckWith, RailList, SHARE_LATER, Toast, Toasts, type EditorCtx } from "../../kit"
import { defineScenario } from "../types"
import { GridDragOverlay } from "./GridDrag"
import { SLIDE_WITH_PLAYBACK } from "./inspector"
import { sectionMenu, thumbMenu } from "./menus"
import { DragGhost, InsertLine, ScrollIntoView, SectionedList, Thumb, type SectionDef } from "./rail"
import { newSlide } from "./slides"

/**
 * 03-14 幻灯片管理与版式：左栏「新建幻灯片 ▾」的版式库、新页插入当前页之后、拖动排序（含多选、跨节）、节的显示与折叠、
 * 隐藏页、删除与撤销、仅剩 1 页时的删除禁用、更换版式与占位符不匹配提示；网格视图里同一套多选与拖动。
 * 左栏列表用本组的 Thumb / SectionedList（rail.tsx），外观与底座 RailThumb 一致，补齐隐藏页、多选、拖动源、节标题行与插入线。
 */

const slideOf = (ctx: EditorCtx, n: number) => ctx.deck.find((s) => s.n === n)

interface ListOpts {
  hidden?: number[]
  selected?: number[]
  dragging?: number[]
  /** 插入线画在这一页之后 */
  insertAfter?: number
  insertLabel?: string
  /** 拖动影子里的页 */
  ghost?: number[]
  scrollTo?: string
}

/** 不分节的缩略图列表。 */
function plainList(ctx: EditorCtx, o: ListOpts = {}) {
  return (
    <RailList>
      {ctx.deck.map((s) => (
        <Fragment key={s.n}>
          <Thumb slide={s} current={s.n === ctx.slide} selected={o.selected?.includes(s.n)} hidden={o.hidden?.includes(s.n)} dragging={o.dragging?.includes(s.n)} />
          {o.insertAfter === s.n && (
            <>
              <InsertLine label={o.insertLabel} />
              {o.ghost && <DragGhost slides={o.ghost.flatMap((n) => slideOf(ctx, n) ?? [])} />}
            </>
          )}
        </Fragment>
      ))}
      {o.scrollTo && <ScrollIntoView anchor={o.scrollTo} />}
    </RailList>
  )
}

/** 示例文档的三节：开场 1–2、业务回顾 3–5、下半年 6。 */
const SECTIONS: SectionDef[] = [
  { name: "开场", slides: [1, 2] },
  { name: "业务回顾", slides: [3, 4, 5] },
  { name: "下半年", slides: [6] },
]
const SECTIONS_FOLDED: SectionDef[] = SECTIONS.map((s) => (s.name === "业务回顾" ? { ...s, collapsed: true } : s))

export default defineScenario({
  id: "slide-management",
  title: "幻灯片管理与版式",
  specs: ["03-14"],
  summary: "左栏：按版式新建、拖动排序（多选、跨节）、节、隐藏页、删除与撤销；更换版式；网格视图的多选与拖动",
  // 编辑模式照常显示评论钉（rulings §4.25 DS-43：底座 stage.commentPins，第 4 页 3 枚）
  editor: { stage: { cursor: false, commentPins: true } },
  states: [
    {
      id: "new-slide-menu",
      title: "新建幻灯片 · 版式库",
      note: "03-14 D14：点「新建幻灯片 ▾」贴左栏右缘展开版式库，默认高亮「与当前页相同」；卡片是版式的真实渲染（母版装饰 + 空占位符）；方向键在网格里移动、Enter 新建、Esc 取消。「+」直接新建同版式页（⌘M）",
      editor: {
        slide: 2,
        // 底座左栏的「新建幻灯片 ▾」缺省就打开版式画廊（与检查器「版式」同一个组件）；这里只让它一出现就是打开的
        rail: { newSlide: { popover: { defaultOpen: true } } },
      },
    },
    {
      id: "new-slide-after-cover",
      title: "新建幻灯片 · 首页之后",
      note: "03-14 D14：当前页是标题幻灯片时，第一张换成「建议：标题和内容」（首页之后很少再要一张标题页），直接点「+」也按它新建",
      editor: {
        slide: 1,
        rail: { newSlide: { popover: { defaultOpen: true } } },
      },
    },
    {
      id: "new-slide-added",
      title: "新页插入当前页之后",
      note: "03-14 D14：新页插入当前页之后并自动选中；画布上空占位符显示虚线框与提示文字，缩略图里只剩母版装饰（空占位符不出现在缩略图与放映里）",
      editor: {
        deck: [...DEFAULT_DECK, newSlide(7)],
        slide: 7,
        rail: { list: (ctx) => plainList(ctx, { scrollTo: "thumb-7" }) },
      },
    },
    {
      id: "drag-reorder",
      title: "拖动排序",
      note: "03-14：拖动第 5 页到第 2、3 页之间，源位置变淡，插入处间隙放大并画 2px 强调色指示线，影子跟随指针；松手是一个撤销步。键盘等价 ⇧⌘↑ / ⇧⌘↓",
      editor: {
        slide: 5,
        rail: { list: (ctx) => plainList(ctx, { dragging: [5], insertAfter: 2, ghost: [5] }) },
      },
    },
    {
      id: "drag-multi-section",
      title: "多选拖动 · 跨节",
      note: "03-14：多选第 3、4 页一起拖到「下半年」节开头；插入线同时写明目标节，避免「移到哪个节」的歧义；影子叠两张、右上角计数",
      editor: {
        slide: 3,
        rail: {
          list: (ctx) => (
            <SectionedList
              sections={SECTIONS}
              afterHeader={{
                2: (
                  <>
                    <InsertLine label="移到「下半年」" />
                    <DragGhost slides={[3, 4].flatMap((n) => slideOf(ctx, n) ?? [])} top={10} />
                  </>
                ),
              }}
              renderSlide={(n) => {
                const s = slideOf(ctx, n)
                return s ? <Thumb slide={s} current={n === ctx.slide} selected={n === 4} dragging={n === 3 || n === 4} /> : null
              }}
            >
              <ScrollIntoView anchor="thumb-6" />
            </SectionedList>
          ),
        },
      },
    },
    {
      id: "sections",
      title: "节的显示与折叠",
      note: "03-14 G-42（M2 只显示）：节标题行「▾ 节名 + 页数」，点整行折叠 / 展开，折叠后保留标题行（「业务回顾」已折叠）；折叠状态按本人本地偏好保存，不同步给协作者",
      editor: {
        slide: 2,
        rail: {
          list: (ctx) => (
            <SectionedList
              sections={SECTIONS_FOLDED}
              renderSlide={(n) => {
                const s = slideOf(ctx, n)
                return s ? <Thumb slide={s} current={n === ctx.slide} /> : null
              }}
            />
          ),
        },
      },
    },
    {
      id: "section-menu",
      title: "节标题右键",
      note: "03-14：M2 节名不可编辑，右键只有折叠 / 展开；新增、重命名、排序在 M3，菜单里一行说明代替灰显条目；「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）",
      editor: {
        slide: 2,
        inspector: { share: SHARE_LATER },
        rail: {
          list: (ctx) => (
            <SectionedList
              sections={SECTIONS_FOLDED}
              anchorPrefix="slide-management.section"
              renderSlide={(n) => {
                const s = slideOf(ctx, n)
                return s ? <Thumb slide={s} current={n === ctx.slide} /> : null
              }}
            />
          ),
        },
        layers: <ContextMenu at={{ anchor: "slide-management.section-2", x: 0.62, y: 0.6 }} label="节「业务回顾」" items={sectionMenu(true)} />,
      },
    },
    {
      id: "hidden",
      title: "隐藏的幻灯片",
      note: "03-14 D15：隐藏页页码加斜线、下方眼睛图标，幻灯片渲染 60% 不透明；当前页描边与评论角标不受影响（优先级：当前页描边 > 警示角标 > 评论角标 > 隐藏态）。悬停 / 聚焦提示「已隐藏，放映时跳过」；隐藏页照常可编辑，检查器「放映」一节可取消。画布上照常画第 4 页的 3 枚评论钉（编辑模式照常显示评论钉）（2026-10-15 按 rulings §4.25 DS-43 改）",
      editor: {
        slide: 4,
        rail: { list: (ctx) => plainList(ctx, { hidden: [4] }) },
        inspector: { sections: SLIDE_WITH_PLAYBACK },
        data: { slideHidden: true },
      },
    },
    {
      id: "thumb-menu-hidden",
      title: "隐藏页右键 · 取消隐藏",
      note: "03-14 D15：已隐藏的页再右键，「隐藏幻灯片」换成「取消隐藏」。画布上照常画第 4 页的 3 枚评论钉（2026-10-15 按 rulings §4.25 DS-43 改）",
      editor: {
        slide: 4,
        rail: { list: (ctx) => plainList(ctx, { hidden: [4] }) },
        inspector: { sections: SLIDE_WITH_PLAYBACK },
        data: { slideHidden: true },
        layers: <ContextMenu at={{ anchor: "thumb-4", x: 0.62, y: 0.42 }} label="第 4 页" items={thumbMenu({ hidden: true })} />,
      },
    },
    {
      id: "last-slide",
      title: "仅剩 1 页 · 删除不可用",
      note: "03-14 边界情况：文档至少保留 1 页，「删除幻灯片」留在原位不可用并写明原因；只有 1 页时「移动」也不可用",
      editor: {
        deck: DEFAULT_DECK.slice(0, 1),
        slide: 1,
        layers: <ContextMenu at={{ anchor: "thumb-1", x: 0.62, y: 0.42 }} label="第 1 页" items={thumbMenu({ only: true })} />,
      },
    },
    {
      id: "deleted",
      title: "删除后可撤销",
      note: "03-14 / 03-05：多选第 5、6 页删除，立即生效、不弹确认，自动选中相邻页；画布底部 5 秒可撤销提示「已删除 2 页」（不抢焦点，「撤销」可 Tab 到达）。画布上照常画第 4 页的 3 枚评论钉（编辑模式照常显示评论钉）（2026-10-15 按 rulings §4.25 DS-43 改）",
      editor: {
        deck: DEFAULT_DECK.slice(0, 4),
        slide: 4,
        canvasOverlay: (
          <Toasts>
            <Toast action="撤销">已删除 2 页</Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "change-layout",
      title: "更换版式",
      note: "03-14 / 03-27：检查器「版式」字段（或缩略图右键「更换版式…」）打开版式画廊，贴检查器左缘展开，当前版式标「当前」；与 layout-picker 场景同一个组件（单母版文档不显示分组标题），「重置为版式默认…」降权放在左下（确认与撤销见 03-27）",
      editor: {
        // 第 1 页（标题幻灯片）：与 layout-picker.single-master（第 3 页「仅标题」）区分，当前版式落在另一张卡上
        slide: 1,
        // 内置「版式」字段打开的就是版式画廊（底座 editor/layouts）；lpSingle：单母版文档不显示分组标题
        data: { lpOpen: true, lpSingle: true },
      },
    },
    {
      id: "layout-unmatched",
      title: "更换版式 · 占位符不匹配",
      note: "03-14 / rulings §4.10 Q13：第 3 页从「仅标题」换成「空白」，标题占位符无处匹配，内容不丢、保留原位转为普通形状，提示带「撤销」",
      editor: {
        deck: deckWith({ 3: { layout: "空白" } }),
        slide: 3,
        canvasOverlay: (
          <Toasts>
            <Toast tone="warning" action="撤销">
              1 个元素无法匹配新版式的占位符，已保留为普通形状
            </Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "grid-reorder",
      title: "网格视图 · 多选拖动",
      note: "02-editor-main §5.3 + 03-14：网格里多选第 2、3 页拖到第 5、6 页之间，与左栏同一行为——源页变淡、列距正中画竖向插入线、影子叠两张带计数",
      editor: {
        view: "grid",
        slide: 2,
        layers: <GridDragOverlay selected={[3]} dragging={[2, 3]} after={5} before={6} />,
      },
    },
  ],
})
