import { useLayoutEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Button, deckWith, INSERT_ITEMS, MainMenuLayer, ME, OfflineBanner, Progress, registerCommentPins, registerCommentsBody, SHARE_LATER, TEXT_NEW_BOX, useEditor, useSceneState, type MenuSpec } from "../../kit"
import { STATUS } from "../main-states/bars"
import { NO_COMMENTS_DECK, OPENING_DECK } from "../main-states/slides"
import { CompactStage, CompactToolbar, InspectorDrawer, RailDrawer } from "../narrow/compact"
import { MASTER_REASON } from "../narrow/data"
import { defineScenario, type EditorConfig } from "../types"
import { CommentLayer, DraftKeeper, GridCompose, ToolHint, ToolTabSync } from "./canvas"
import { CommentAnnouncer, CommentNavCommands, CommentRailList, CommentToasts, DeleteConfirm, railRegion, ReviewBar, ViewerBar } from "./chrome"
import { P4_CHART, P4_TEXT, pageCounts, pinned, threadsFor, U, type Dataset, type Thread } from "./model"
import { CommentsPanel } from "./Panel"
import { PhoneViewer, TabletViewer } from "./phone"
import { DatasetFallback, useLocate } from "./store"

/**
 * comments：03-06 评论面板的 v3 样张（第 2 批 · 协作族）。
 * 入口按第 0、1 批已定的位置：评论在检查器「评论」页签（inspector.commentsBody）；画布评论钉点开即定位线程（01 §2.3 唯一的自动切页签例外；
 * DS-44 未采纳的备选 alt-tool-tab 由状态数据 toolSwitchesTab 演示「评论工具按下时切到评论页签」，见 canvas.tsx ToolTabSync）；
 * 评论工具发表后保持按下（rulings §4.25 DS-44，同 Figma 评论模式），没有撰写框时 Esc 或 V 回到「选择」；
 * 新评论的常驻入口只有工具条「评论」（C）：在画布上点选（对象 = 元素锚点，空白处 = 页级锚点）后出浮动撰写框；右键 / ⇧F10 菜单里的「添加评论」是不常驻的第二入口（Q2，DS-45；未采纳的备选 alt-panel-composer 保留面板底部撰写框）；
 * 评审模式默认「评论」页签；查看者只读；手机评论底部面板可发表与回复，平板只读评审。
 * 行为与边界以 03-06、05 §5（场景 J）、02 F7、50/08 §3–§7、§11 为准；视觉按 v3（DS-1…DS-37），标杆 Figma Slides 的评论（画布评论钉 + 右侧评论列表、线程内回复、解决）。
 * 同目录：model（人物、线程、筛选、权限）· store（场景状态、定位）· Panel（评论页签）· Thread（线程与回复）· Composer（撰写框与 @ 候选）·
 * RichText（正文：提及、链接、折叠）· canvas（评论钉、悬停卡、聚合钉、评论工具、浮动撰写框、钉右键）· chrome（左栏角标、评审条 / 浏览条、轻提示、删除确认）· phone（仅查看形态）。
 */

/** 示例文档：左栏角标按线程实时计数（rail.list），这里的计数只给网格视图用（第 1 页 1 · 第 3 页 1 · 第 4 页 2，已解决不计） */
const DECK = deckWith({ 1: { comments: 1 }, 3: { comments: 1 }, 4: { comments: 2 } })

/** 评论工具点在第 4 页图表上、正在撰写（compose 与 DS-44 未采纳的备选 alt-tool-tab 共用同一份草稿，两个画面只差检查器页签） */
const CHART_DRAFT = { page: 4, x: 74.4, y: 60, anchor: { kind: "element" as const, label: "图表 1", box: P4_CHART }, text: "5 月环比只涨了 4 个点，要不要在说明文字里写原因？" }

/** M2 未装评论包：主菜单「插入」里没有「评论」 */
const M2_INSERT: MenuSpec[] = INSERT_ITEMS.filter((it) => !("id" in it && it.id === "comment")).filter((it, i, all) => !(it.type === "separator" && i === all.length - 1))

/** 离线横幅：kit OfflineBanner（与 main-states.offline 同一条） */
const OFFLINE_BANNER = <OfflineBanner />

/** 文档打开中的进度（与 main-states.opening 同一画法） */
const OPENING_PROGRESS = (
  <div className="absolute top-[calc(100%+24px)] left-1/2 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap">
    <span className="text-[12px] leading-none text-(--v3-text-2)">正在解析母版与版式…</span>
    <Progress value={62} label="打开进度" className="w-40" />
    <span className="w-7 text-[11px] leading-none text-(--v3-text-2) tabular-nums">62%</span>
    <Button variant="outline">取消</Button>
  </div>
)

/** 紧凑窗口（640–1024）：沿用 narrow 场景的抽屉与胶囊（第 1 批定稿），检查器抽屉里是同一个「评论」页签 */
const COMPACT: EditorConfig = {
  rail: { menu: { master: { reason: MASTER_REASON } } },
  regions: {
    leftRail: (_, d) => <RailDrawer d={d} />,
    inspector: (_, d) => <InspectorDrawer d={d} />,
    stage: (_, d) => <CompactStage d={d} />,
    toolbar: (_, d) => <CompactToolbar d={d} />,
  },
}

/**
 * 第 1 批（编辑器族）评审 / 只读 / 紧凑形态的「评论」页签（rulings §4.25 DS-62）：换成本场景的评论面板，连同同一套画布评论钉（CommentLayer：点钉定位线程、悬停预览）、
 * 左栏实时角标、读屏播报、轻提示与删除确认；评审条 / 浏览条用本场景的 ReviewBar / ViewerBar（「上一处 / 下一处评论」能用、计数实时）由调用处放进 regions.toolbar。
 * 示例文档原样（data.dataset "deck"：只有第 4 页的 3 条、都未解决），所以第 1 批画面里只有评论页签换了画法，评论钉、角标与「3 条评论」不变。
 * 状态自己还有 slideOverlay / canvasOverlay / layers 时由调用处并进来（这三个是顶层字段，状态里写了会整个替换）。
 */
export const DECK_COMMENTS: EditorConfig = {
  // 钉由本场景的 CommentLayer 画（可交互）：底座的评论钉（TB-83 起缺省开）在这里关掉，免得画两份
  stage: { commentPins: false },
  inspector: { commentsBody: <CommentsPanel /> },
  rail: { list: () => <CommentRailList /> },
  slideOverlay: () => <CommentLayer />,
  canvasOverlay: () => (
    <>
      <ToolHint />
      <GridCompose />
      <DraftKeeper />
      <CommentToasts />
      <CommentNavCommands />
      <CommentAnnouncer />
    </>
  ),
  layers: () => <DeleteConfirm />,
  data: { dataset: "deck" },
}

/**
 * 底座缺省的「评论」页签（rulings §4.25 TB-82）：DS-62 点名的 4 个状态之外，其余状态（第 1 批编辑态点钉、第 2 批版本历史等场景点钉或手动切到「评论」页签）也是本场景的评论面板。
 * 线程数据缺省取示例文档原样（DatasetFallback「deck」：第 4 页 3 条、都未解决，与底座画的 3 枚评论钉、缩略图角标一致；状态写了 data.dataset 照用）；
 * 面板的删除确认（对话框）、读屏播报与轻提示随面板一起挂（轻提示经 Portal 放进画布列，位置同场景里的）。底座画的评论钉与左栏角标仍是第 1 批的静态件（其余第 1 批编辑态的钉随第 3 批，TB-83），
 * 所以在这里解决或删除一条不会改钉；不改任何初始画面（一出现就停在「评论」页签的状态都自己写了 commentsBody）
 */
function DefaultCommentsBody() {
  // 轻提示的落点是画布列（kit Toasts 相对它定位）：面板挂上后找到它再 Portal 过去
  const [canvas, setCanvas] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => setCanvas(document.querySelector<HTMLElement>('[data-v3-anchor="canvas"]')), [])
  return (
    <DatasetFallback.Provider value="deck">
      <CommentsPanel />
      <DeleteConfirm />
      <CommentAnnouncer />
      {canvas && createPortal(<CommentToasts />, canvas)}
    </DatasetFallback.Provider>
  )
}
registerCommentsBody(() => <DefaultCommentsBody />)

/**
 * 底座评论钉与左栏 / 网格评论角标的数据源（rulings §4.25 TB-83，editor/deck.tsx registerCommentPins）：底座自己画钉的状态（stage.commentPins 开着，TB-83 起编辑态缺省开）
 * 读本场景同一份线程数据——场景仓 comments.threads，状态没写 data.dataset 时取示例文档原样「deck」（与上面缺省评论面板的 DatasetFallback 同一份）。
 * 在缺省评论面板里解决、删除一条，画布上的钉与角标随之变化；点钉同面板里点击定位（选中、短暂高亮、读屏播报、切到「评论」页签）。本场景自己的状态写了 commentPins: false，不经这里
 */
function useDeckThreads(): Thread[] {
  const { data } = useEditor()
  return useSceneState<Thread[]>("comments.threads", () => threadsFor((data as { dataset?: Dataset }).dataset ?? "deck"))[0]
}
registerCommentPins({
  usePins: (page) =>
    pinned(useDeckThreads(), page).map((t) => ({
      id: t.id,
      person: t.replies[0]?.by ?? U.zhou,
      x: t.anchor.x,
      y: t.anchor.y,
      label: `${t.imported ? t.imported.author : (t.replies[0]?.by.name ?? "")}的评论：${t.replies[0]?.body ?? ""}`,
    })),
  useCounts: () => {
    const threads = useDeckThreads()
    return (page) => {
      const c = pageCounts(threads, page)
      return { n: c.open, resolved: c.resolved }
    }
  },
  usePick: () => useLocate(),
})

/** 仅查看形态（< 640 或触控）：左栏、检查器、工具条都不渲染，画布列换成查看形态 */
const VIEW_ONLY: EditorConfig = {
  toolbar: { hidden: true, collapse: true },
  regions: { leftRail: () => null, inspector: () => null, toolbar: () => null, stage: () => <PhoneViewer />, grid: () => <PhoneViewer /> },
}

/** 平板竖屏的仅查看形态：评论面板与当前页上下排开（rulings §4.25 DS-131，comments/phone.tsx TabletViewer layout stacked） */
const VIEW_ONLY_TABLET: EditorConfig = {
  toolbar: { hidden: true, collapse: true },
  regions: { leftRail: () => null, inspector: () => null, toolbar: () => null, stage: () => <TabletViewer layout="stacked" />, grid: () => <TabletViewer layout="stacked" /> },
}

export default defineScenario({
  id: "comments",
  batch: 2,
  title: "评论",
  specs: ["03-06", "03-02", "03-05"],
  summary: "检查器「评论」页签（筛选、线程、回复、解决）、画布评论钉与评论工具、评审与只读、手机发表与回复",
  editor: {
    deck: DECK,
    slide: 4,
    // 钉由本场景的 CommentLayer 画（可交互）：底座的评论钉（TB-83 起缺省开）关掉
    stage: { cursor: false, commentPins: false },
    inspector: { tab: "comments", commentsBody: <CommentsPanel /> },
    rail: { list: () => <CommentRailList /> },
    slideOverlay: () => <CommentLayer />,
    canvasOverlay: () => (
      <>
        <ToolHint />
        <GridCompose />
        <DraftKeeper />
        <ToolTabSync />
        <CommentToasts />
        <CommentNavCommands />
        <CommentAnnouncer />
      </>
    ),
    layers: () => <DeleteConfirm />,
    regions: { leftRail: railRegion },
  },
  states: [
    /* ---------------------------------------------------------------- 评论页签 */
    {
      id: "default",
      title: "评论页签 · 当前页",
      note: "03-06 默认态 + 03-02 §4.4：检查器「评论」页签——顶部筛选「全部 / 当前页 / 未解决 / @我」（分段控件，缺省停在「当前页」，与画布上的评论钉一一对应）与排序；「当前页」只有一组、不画组头；未解决在前，已解决收在末尾一行「已解决 1」（点开逐条列出；第 2 批统一的折叠行画法：高 32、箭头在前、展开时转 90°，与版本历史的分组行同一种）。作者名中等字重 500（04 §2.8：600 只给节标题），时间 text-2。面板里不再常驻底部撰写框：常驻入口只有工具条「评论」（C）——在画布上点选对象或空白处，点空白处即页级评论；右键 / ⇧F10 菜单里的「添加评论」是不常驻的第二入口（质量门 Q2 常驻入口唯一，同 Figma；DS-45，未采纳的备选 alt-panel-composer）。画布上未解决的线程各一枚评论钉（第 1 批定稿的样子），左栏角标 = 未解决数（第 4 页 2，已解决的 1 条不计）",
      editor: { stage: { cursor: { at: "left-[48%] top-[62%]" } } },
    },
    {
      id: "locate",
      title: "点评论钉 · 定位线程",
      note: "03-06 交互：点画布上的评论钉——检查器自动切到「评论」页签（01 §2.3 唯一的自动切换，深链 ?comment= 同此），线程滚入视口、线程主体（锚点说明 · 作者行 · 正文）铺强调色淡底（选中；左右内缩 8、圆角 6，与第 1 批左栏当前页、版本历史选中行同一画法）并描边淡出一次，展开全部回复与回复框（都在淡底之外的面板底上，回复串的连线与次按钮细边两套主题都看得清）；画布上这枚钉加强调色外圈、脉冲一次，锚点对象「图表 1」画 1px 强调色虚线（不画手柄，区别于选中对象）。右上角「解决」「⋯」",
      editor: { data: { selected: "t1" } },
    },
    {
      id: "all",
      title: "筛选 · 全部",
      note: "PRD CO-04：「全部」不分页、不分状态，按时间平铺，锚点说明前写页码；有已脱离锚点的线程时筛选行第二行出现临时筛选「已脱离锚点 1」（不占固定筛选位）。列表里另有一条「锚点无法解析」（50/08 §5：只影响这一条，内容仍可读），两条已解决的收在末尾「已解决 2」",
      editor: { data: { dataset: "all", filter: "all" } },
    },
    {
      id: "unresolved",
      title: "筛选 · 未解决 · 排序",
      note: "「未解决」跨全文档筛出待处理的线程；排序菜单（最新 / 最旧 / 按页码，单选，选了即收起）打开，演示停在「按页码」：按页分组，组头「第 N 页 · 页名」+ 未解决条数（紧跟标题，同分享「有权限的用户 3」）",
      editor: { data: { filter: "open", sort: "page", sortMenu: true } },
    },
    {
      id: "mentions",
      title: "筛选 · @我",
      note: "「@我」筛出提及自己的线程（50/08 §5：回复的 mentions 含当前用户，本地计算），是巡查待办的主要入口；正文里的提及用中等字重 500（与作者名同一档、仍比正文 400 重，不用强调色，质量门 Q3）。选中后画布切到第 3 页、钉加外圈，锚点「+3pt」铺强调色淡底（文本范围锚点）",
      editor: { slide: 3, data: { filter: "mine", selected: "t5" } },
    },
    {
      id: "detached",
      title: "已脱离锚点",
      note: "03-06「已脱离锚点的汇总查看」：一次删掉了 3 个带评论的对象，临时筛选「已脱离锚点 3」按下，四项分段都不选；每条的锚点说明换成「原对象已删除」（工具提示写谁何时删的、24 小时内恢复后回到原处），没有画布钉，照常回复、解决；「⋯」里「重新锚定…」为 P1、不可用",
      editor: { slide: 6, data: { dataset: "detached", filter: "detached" } },
    },
    {
      id: "resolved",
      title: "已解决 · 展开与角标",
      note: "03-06：已解决的线程收在列表末尾一行「已解决 N」（第 2 批统一的折叠行：高 32、箭头在前、展开时转 90°（减少动态效果时不转场）、12px text-2、左缘与列表正文对齐、整行可点；Figma 默认也隐藏已解决的），点开逐条列出摘要（发起人 · 回复数 · 正文最多两行，不截成一行省略号），再点摘要展开完整对话，顶部写「周明远 已解决 · 1 天前」，「解决」的位置换成「重新打开」；没有回复框（要继续讨论先重新打开）。选中一条已解决的线程时「已解决 N」自动展开。已解决不计入左栏角标，角标的工具提示写「2 条未解决 · 另有 1 条已解决」（演示常开）；选中时画布临时显示它的钉",
      editor: { data: { selected: "t3", badgeTip: 4 } },
    },
    {
      id: "resolved-reply",
      title: "解决时有新回复（场景 J）",
      note: "05 §5 场景 J：标记已解决的同时有人回复——回复保留、线程仍是已解决，只在面板里这条线程处内联写明「解决之后又有新回复」，不出全局轻提示与横幅；收起时摘要行右侧写「有新回复」",
      editor: { data: { dataset: "resolved-reply", selected: "t3" } },
    },
    {
      id: "rich-text",
      title: "长评论 · 链接与提及",
      note: "PRD CO-04：正文为纯文本 + 换行 + @提及 + 自动识别的链接（≤ 5,000 字）；长正文默认折叠 3 行，下面「展开」；提及用中等字重 500（与作者名同档）、链接加下划线（都不用强调色，质量门 Q3）；编辑过的标「已编辑」，工具提示写编辑时间",
      editor: { data: { dataset: "long", selected: "t1" } },
    },
    {
      id: "empty",
      title: "空态",
      note: "03-06 空态（v3 不用插画，kit EmptyNote：居中、12px text-2）：「当前页」下写「第 2 页还没有评论」（陈述句用主文字色），第二行（text-2）告诉怎么开始——「用工具条的「评论」（C）点选对象或空白处添加评论」（常驻入口只有工具条「评论」（C）；右键 / ⇧F10 菜单里的「添加评论」是不常驻的第二入口，DS-45）；筛选行照常（「全部」下为「这份文档还没有评论」，「未解决」「@我」各有对应的一句）",
      editor: { slide: 2, deck: deckWith({}), data: { dataset: "empty" } },
    },
    {
      id: "loading",
      title: "加载中（评审者打开文档）",
      note: "03-06 加载：评论是文档状态的一部分（ADR-0031），随文档一起打开；评审者以评审模式打开、检查器缺省停在「评论」页签时，页签里居中一行「正在加载评论…」（kit LoadingRow：转圈 14 + 12px text-2，与插件列表同一件；版本历史、分享的加载行在列表里左对齐；不画灰色骨架条，质量门 Q8），筛选与排序随整栏一起不可用（DS-53）（03-02 §6.2「加载中」：首屏可交互前检查器各项不可用、工具提示「文档打开后可用」）；评审条整条不可用",
      editor: {
        mode: "review",
        deck: OPENING_DECK,
        slide: 1,
        stage: { notes: false, cursor: false },
        rail: { status: STATUS.opening, viewToggle: { reason: "文档打开后可用" } },
        inspector: { locked: "文档打开后可用", collaborators: { people: [] } },
        slideOverlay: OPENING_PROGRESS,
        regions: { toolbar: () => <ReviewBar canEdit={false} locked="文档打开后可用" /> },
        data: { loading: true, role: "commenter" },
      },
    },

    /* ---------------------------------------------------------------- 画布 */
    {
      id: "pin-hover",
      title: "编辑中 · 悬停评论钉",
      note: "PRD CO-04「悬停预览」：编辑模式下评论钉照常显示（放映与母版视图不显示）；悬停（或键盘聚焦）钉时旁边一张小卡——作者（中等字重 500，同列表）· 时间 · 正文前两行 · 回复数 ·「点按查看」，不可交互、不抢焦点；靠右的钉卡片放左侧。检查器停在「设计」页签，点钉才会切到「评论」",
      editor: { inspector: { tab: "design" }, data: { hoverPin: "t1" } },
    },
    {
      id: "pin-menu",
      title: "右键评论钉",
      note: "03-05 §3「评论图钉」：解决 · 复制链接 ┊ 删除讨论串…（只有文档所有者可删整条，确认后不可撤销，50/08 §4）；评审者对他人线程、导入的批注，「解决」留在原位、不可用并写原因；查看者没有这个菜单。菜单贴在钉的右侧展开、不盖住钉（在钉上右键或焦点在钉上按 ⇧F10 / 菜单键都是这个位置），关闭后焦点回到钉；右键不切检查器页签",
      editor: { inspector: { tab: "design" }, data: { pinMenu: "t1" } },
    },
    {
      id: "cluster",
      title: "评论钉过密 · 聚合钉",
      note: "03-06 边界情况：同一位置的钉堆叠过密时合并为聚合钉（深色中性底、写数量，不占身份色），点开列出这几条（头像 · 姓名 / 正文预览最多两行，超出才省略，完整内容在线程里；03-06 对这张列表没有相反规定），点一条即定位线程（焦点交给展开后的那一枚钉，同桌面点钉）；选中的那一组按小幅偏移展开成单独的钉。另一枚是「+3pt」上的单独评论",
      editor: { slide: 3, inspector: { tab: "design" }, data: { dataset: "cluster", clusterOpen: "t8" } },
    },
    {
      id: "tool",
      title: "评论工具 · 点选位置",
      note: "02 F7 / 03-04：工具条「评论」（C）按下后画布顶部提示「点选对象或空白处添加评论 · Esc 退出」（与插入工具态同一外观）；悬停的对象出强调色细框——点下去即元素锚点，点空白处为页级锚点。常驻入口只有工具条「评论」（C）；右键 / ⇧F10 菜单里的「添加评论」是不常驻的第二入口（面板里没有常驻撰写框，质量门 Q2；DS-45）。光标是评论光标（样张用替身画出）。键盘等价（07 §1.2a、PRD ED-29，DS-44 写进 03-06）：焦点在「评论」上按 ↵（或工具开着、焦点在画布上按 ↵）在当前页放页级临时钉并打开浮动撰写框（网格视图里同样按一次：先带着评论工具回单页，再放钉）（默认落点不盖住标题与已有的钉；撰写框离幻灯片文字行至少 8，放不下时换到钉的上方或另一侧，按当页版面计算）；有选中对象时按 C 或 ↵ 落元素锚点；画布上 ⇧F10 / 菜单键（或幻灯片空白处右键）的菜单里有「添加评论 C」（03-05 画布空白处菜单补这一项，DS-44：回写 03-05 §3，第 1 批 context-menu.canvas 与 undo-clipboard.paste-options 随之加上）。键盘与菜单打开的撰写框因 Esc /「取消」关闭时焦点回到来源（「评论」、画布或被右键的对象），发送后交给画布。发表或取消后评论工具都保持按下（DS-44，同 Figma 评论模式，是插入工具「用后回到选择」的例外）：下一次点画布接着落钉；没有撰写框时按 Esc 或 V 回到「选择」（Esc 逐层：先关撰写框、再退工具）；指针、键盘（「评论」上 ↵、画布上 ↵、C、⇧F10 菜单）、网格视图与右键「添加评论」口径一致",
      editor: { inspector: { tab: "design" }, toolbar: { tool: "comment" }, data: { toolHover: { x: 74.4, y: 60 } } },
    },
    {
      id: "compose",
      title: "评论工具 · 浮动撰写框",
      note: "DS-44：点选后在落点放临时钉（自己的钉 + 强调色外圈），钉旁出浮动撰写框（写明锚点「评论 · 图表 1」），不切检查器页签——01 §2.3 只允许点评论钉时自动切换；↵ 或「发送」发表后钉变为正式的、线程进列表并描边一次、左栏角标 +1，读屏播报「已发表评论」（一次），焦点交给画布。发表后评论工具保持按下（DS-44，同 Figma 评论模式，是插入工具「用后回到选择」的例外）：评审时常连续落多条，下一次点画布接着落钉；没有撰写框时按 Esc 或 V 回到「选择」（Esc 逐层：先关撰写框、再退工具）。没写内容时 Esc 或点外面取消（只收起撰写框，工具照旧按下），写了内容时 Esc 与点外面都不关（免得丢稿，点画布别处也不把稿子挪到新落点），多出「取消」才放弃。DS-44 未采纳的备选见 alt-compose-panel（撰写框在检查器）与 alt-tool-tab（工具按下时切到「评论」页签）。写了内容时换页（或进网格视图）：撰写框与临时钉随旧页收起，草稿按页留在内存，回到这一页时原样恢复（内容与 @ 提及都在）、不抢焦点——焦点留在换页的地方，点临时钉或在钉上按 Tab 进撰写框，评论工具按不按下也不因恢复而改变；没写内容的换页即放弃，离开场景或切换状态（相当于关闭文档）即丢弃（rulings §4.25 DS-65、TB-79、TB-84；原「换页即丢弃」作废）",
      editor: {
        inspector: { tab: "design" },
        toolbar: { tool: "comment" },
        data: { draft: CHART_DRAFT },
      },
    },
    {
      id: "compose-text",
      title: "右键「添加评论」· 文本范围",
      note: "03-06「锚点创建三种路径」之二：编辑文字时选中一段（v3 没有文字迷你工具条，DS-13），右键「添加评论 C」——文本框是编辑态（1px 强调色描边、无手柄，同 03-16），选区保持选中色，临时钉落在选区末尾，撰写框写明引文「评论 · 「4,800 万元」」（引文与其余界面一样用「」）；检查器照常是「文本」。没写内容时「发送」不可用并写原因。DS-44 写明的例外：编辑文字时对选中的文字发起评论，撰写时工具仍是「选择」（不进入评论工具），发表或取消（含 Esc）后回到文字编辑——描边与选区还在、检查器仍是「文本」、工具仍是「选择」，焦点回画布；点空白退出编辑",
      editor: {
        inspector: { tab: "design" },
        selection: "text",
        data: {
          text: { ...TEXT_NEW_BOX, size: "24", styles: ["bold"] },
          // 正在编辑的文本框与选区（data.textEdit，canvas.tsx TextEditMarks）：撰写框收起后仍画，即「回到文字编辑」
          textEdit: { page: 4, box: P4_TEXT, sel: { x: 17.6, y: 28.9, w: 13.4, h: 5.6 } },
          draft: { page: 4, x: 30.8, y: 28.9, anchor: { kind: "text", label: "「4,800 万元」", box: { x: 17.6, y: 28.9, w: 13.4, h: 5.6 } } },
        },
      },
    },

    /* ---------------------------------------------------------------- 撰写与线程操作 */
    {
      id: "mention",
      title: "撰写框 · @提及候选",
      note: "03-06「撰写框与 @ 候选」：评论工具点在第 4 页标题上方的空白处（页级评论；撰写框与候选不盖住画布上的评论钉），浮动撰写框里输入 @（或点「@」）弹出候选——只列人：在场的排在最前，其余按最近协作（50/08 §4），不另标角色（分享对话框的「可编辑 / 可评审」不在这里出现第二套词）；↑↓ 选择、↵ 插入、Esc 只取消候选；焦点留在文本框（aria-activedescendant）。没有用户目录回调时 @ 作为普通字符插入、不弹候选。检查器停在「设计」，与 compose、tool 一致：DS-44「评论工具按下不自动切页签」（工具按下时切到「评论」是未采纳的备选 alt-tool-tab），由这个状态的检查器页签（inspector.tab）给出，不按状态名判断。写了内容时换页（或进网格视图）：撰写框与临时钉随旧页收起，草稿按页留在内存，回到这一页时原样恢复（内容与 @ 提及都在）、不抢焦点——焦点留在换页的地方，点临时钉或在钉上按 Tab 进撰写框，评论工具按不按下也不因恢复而改变；没写内容的换页即放弃，离开场景或切换状态（相当于关闭文档）即丢弃（rulings §4.25 DS-65、TB-79、TB-84；原「换页即丢弃」作废）",
      editor: { inspector: { tab: "design" }, toolbar: { tool: "comment" }, data: { draft: { page: 4, x: 30, y: 8, anchor: { kind: "page", label: "整页" }, text: "标题想改成「营收趋势与结构」，@", mention: true } } },
    },
    {
      id: "edit-own",
      title: "编辑自己的评论",
      note: "03-06「编辑自己的」：⋯ › 编辑，正文原位换成撰写框（取消 / 保存，↵ 保存），用户打开时焦点进编辑框、光标在末尾；保存后标「已编辑」（工具提示写时间），保存或取消后焦点回到这一条的「⋯」；只能编辑自己的评论",
      editor: { data: { selected: "t1", editing: "r3" } },
    },
    {
      id: "delete-reply",
      title: "删除自己的回复 · 可撤销",
      note: "03-06 / 50/08 §5：删除自己的评论或回复先乐观隐藏，轻提示「已删除你的回复」+「撤销」，5 秒内可撤销（「撤销」只是取消尚未执行的删除，评论不入撤销栈）；首条评论有回复时只留「此评论已删除」。被删的回复与它的「⋯」随之消失，焦点交给这条线程的作者行",
      editor: { data: { dataset: "deleted-reply", selected: "t1", toast: { text: "已删除你的回复", action: "撤销", undo: threadsFor("base") } } },
    },
    {
      id: "delete-thread",
      title: "删除讨论串 · 确认",
      note: "03-06 / 50/10 §7「不可逆用确认」：文档所有者删除他人的整条讨论串（或他人的回复）走确认对话框「删除此讨论串？将同时删除 2 条回复，删除后无法恢复。」，主按钮危险色、初始焦点在「取消」；取消 / Esc 后焦点回到打开它的「⋯」（或评论钉），删除后交给相邻线程的作者行",
      editor: { data: { selected: "t1", confirm: { kind: "thread", threadId: "t1" } } },
    },
    {
      id: "offline",
      title: "离线 · 待同步",
      note: "02 F7 / 50/08 §11：离线时照常发表、回复、解决（评论在文档状态里），本端尚未同步的条目带「待同步」，重连同步后统一清除；横幅与同步状态行同 main-states.offline，在场信息消失（头像组只剩自己）。画布上评论工具点在空白处、浮动撰写框里输入 @：候选只来自本地的在场缓存，底部写「离线时无法搜索其他用户」。检查器停在「评论」页签是因为按下评论工具之前就开着这个页签（列表里的「待同步」要看得到）：DS-44 的工具按下不切页签，是不切走也不切过来",
      editor: {
        rail: { status: STATUS.offline },
        banner: OFFLINE_BANNER,
        toolbar: { tool: "comment" },
        inspector: { collaborators: { people: [ME] } },
        data: { dataset: "offline", draft: { page: 4, x: 30, y: 8, anchor: { kind: "page", label: "整页" }, text: "@", mention: true, offline: true } },
      },
    },
    {
      id: "imported",
      title: "导入的只读批注",
      note: "03-06「旧评论导入提示」/ 50/08 §7：打开带评论的 pptx 时，原文件里的批注以只读方式显示——作者名取自原文件（头像用中性底，不是协作者、不占身份色）、标「来自原文件」，不能回复与解决；底部「导入为可编辑评论」（P1），之后可回复与解决。画布钉同样是中性色（专用的中性钉颜色变量，不再借用工具提示的底色；取值相同，画面不变）。每条线程都带「来自原文件」与「导入为可编辑评论」是 03-06 的写法（DS-43 定为推荐），条数一多比标杆重；另一种写法是列表顶部只提示一次、放一个「全部导入为可编辑评论」（每条只留标签），是 DS-43 未采纳的备选",
      editor: { slide: 2, data: { dataset: "imported" } },
    },

    /* ---------------------------------------------------------------- 角色与里程碑 */
    {
      id: "commenter",
      title: "评审者 · 只能解决自己的",
      note: "PRD §1 / CO-04：评审者以评审模式打开（检查器缺省「评论」页签，DS-23），可发表、回复、编辑与删除自己的评论，只能解决自己发起的线程——他人线程的「解决」留在原位、不可用，工具提示「解决 · 只能解决自己发起的评论」（演示常开）；评审条没有「返回编辑」，「上一处 / 下一处评论」在未解决的线程间跳转（换页并定位）",
      editor: { mode: "review", toolbar: { canEdit: false }, regions: { toolbar: () => <ReviewBar canEdit={false} /> }, data: { role: "commenter", selected: "t1", resolveTip: "t1" } },
    },
    {
      id: "viewer",
      title: "查看者 · 只读",
      note: "03-02 §4.4 / §6.2：查看者的「评论」页签只读——顶部「只读 · 你只有查看权限」，筛选照常，线程可展开阅读，没有撰写框、回复框、解决与「⋯」，评论钉不能右键；浏览条「上一处 / 下一处评论 ┊ 只读浏览中」",
      editor: { mode: "viewer", regions: { toolbar: () => <ViewerBar /> }, data: { role: "viewer", selected: "t1" } },
    },
    {
      id: "m2-no-package",
      title: "M2 · 未装评论包",
      note: "03-02 §3.4 / 03-04：M2 参考应用没有评论包（`when: slide.hasComments` 为假）——工具条主行七项（没有「评论」）、检查器没有「评论」页签、画布没有评论钉、左栏没有评论角标，主菜单「插入」里也没有「评论」（演示展开）；评审模式下的同一情形见 main-states.review-empty；「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）",
      editor: {
        deck: NO_COMMENTS_DECK,
        inspector: { tab: "design", commentsTab: false, share: SHARE_LATER },
        // 底座工具条原样，只是没有「评论」（贡献点 when 为假：toolbar.hide，不渲染、不留位，单键 C 无效）
        toolbar: { hide: ["comment"] },
        layers: <MainMenuLayer openPath={["insert"]} insert={M2_INSERT} />,
        data: { dataset: "empty", m2: true },
      },
    },

    /* ---------------------------------------------------------------- 窄屏形态 */
    {
      id: "compact",
      title: "紧凑窗口 · 检查器抽屉",
      note: "视口 800 × 1000（03-02 §5a.1）：检查器抽屉的「评论」页签与桌面完全相同（筛选、线程、回复；新评论同样走评论工具），画布上同时标出评论钉；点钉时抽屉若收着先展开再定位",
      editor: { ...COMPACT, data: { form: "compact", drawer: "inspector", selected: "t1" } },
    },
    {
      id: "phone",
      title: "手机 · 发表评论",
      note: "视口 390 × 844（rulings §4.25 DS-28，M3）：仅查看形态的「评论」底部面板——本页评论（未解决在前，已解决收在「已解决 N」一行里）+ 常驻撰写区（手机没有工具条，44px 文本框 ·「发送」44px，↵ 换行、只用「发送」提交）；上方一行写明「解决评论请在更大窗口中进行」（07 §3）。有评论权限的角色才有撰写区；画布同时标出评论钉（点按区 44）；点钉时底部面板里那一条铺选中底色（内缩 8、圆角 6，同桌面）、aria-current，并 polite 播报「已定位到第 N 页：…」。用户打开面板时焦点落在面板本身，Esc 关闭（框里有字时不关），关闭后焦点回到「评论」按钮",
      editor: { ...VIEW_ONLY, data: { device: "phone", sheet: "comments" } },
    },
    {
      id: "phone-reply",
      title: "手机 · 回复",
      note: "视口 390 × 844：点某条的「回复」——那一条展开全部回复并铺选中底色，撰写区上方出现「回复 王小明 ×」，文本框读屏名「回复王小明」；发送后焦点留在面板里并 polite 播报「已回复王小明」",
      editor: { ...VIEW_ONLY, data: { device: "phone", sheet: "comments", replyTo: "t1", selected: "t1", replyText: "图注我看过了，口径没问题。" } },
    },
    {
      id: "phone-viewer",
      title: "手机 · 查看者只读",
      note: "视口 390 × 844：查看者在手机上同样只读（PRD CO-04）——没有撰写区与「回复」，底部一行「你只有查看权限，只能查看评论」",
      editor: { ...VIEW_ONLY, mode: "viewer", data: { device: "phone", sheet: "comments", role: "viewer" } },
    },
    {
      id: "tablet",
      title: "平板 · 只读评审",
      note: "视口 820 × 1180（触控，rulings §4.25 TB-49、PRD NF-07）：平板落在仅查看形态，评论仍为只读评审——没有撰写区与「回复」，底部一行写明「平板上只能查看评论」（与手机「解决评论请在更大窗口中进行」同一句式）。与 phone 对照（DS-46：平板维持只读评审；未采纳的备选 alt-tablet-compose）。面板落位按 DS-131（平板按方向混用，第 3 批定）：竖屏与当前页上下排开——当前页全宽，下面照常是只读备注卡（有空间时保留，评审时备注是读幻灯片的上下文），面板与当前页同宽、贴底补满剩下的高度（≥ 40dvh），不浮在内容上（去掉浮层阴影与把手，上圆角 12 + 上左右 1px 分隔线）；面板不足 40dvh 时备注卡才让位。横屏是右侧整高侧栏 360（第 3 批 narrow-review.tablet-comments-landscape）。顶部条状态行写「仅查看 · 在电脑上编辑」（TB-125：平板是因为触控才只读）（2026-10-22 按 rulings §4.25 DS-131 改：原为底部居中、宽 560 的浮层，上方留空约 250）",
      editor: { ...VIEW_ONLY_TABLET, data: { device: "tablet", sheet: "comments" } },
    },

    /* ---------------------------------------------------------------- 备选 */
    {
      id: "alt-filter-menu",
      title: "未采纳 · 筛选收进下拉",
      note: "未采纳：DS-43 定为推荐（comments.default）。DS-43 未采纳的备选（筛选的呈现，PRD CO-04）：Figma 评论面板的做法——筛选与排序收进一个下拉（显示：全部 / 当前页 / 未解决 / @我 / 已脱离锚点 N ┊ 排序），筛选行只剩当前筛选与条数。菜单项就用筛选本身的名字「@我」（同分段控件、03-06 与 PRD CO-04，同一个筛选不出现第二种叫法；「提及我的评论」只作分段控件的工具提示）。更克制，但「@我」要多点一下、看不出有哪些筛选",
      editor: { data: { dataset: "all", filter: "all", filterStyle: "menu", filterMenu: true } },
    },
    {
      id: "alt-compose-panel",
      title: "未采纳 · 撰写框在检查器",
      note: "未采纳：DS-44 定为推荐（comments.compose）。DS-44 未采纳的备选（评论工具点选后的撰写框位置）：03-06 原文「面板底部撰写框聚焦」的 v3 读法——点选后检查器自动切到「评论」页签，撰写框出现在列表顶部（强调色淡底，写明锚点），画布只留临时钉。代价是多一处自动切页签（01 §2.3 只允许点评论钉），且画布与撰写框分在两处",
      editor: { toolbar: { tool: "comment" }, data: { altCompose: { page: 4, x: 74.4, y: 60, anchor: { kind: "element", label: "图表 1", box: P4_CHART } } } },
    },
    {
      id: "alt-tool-tab",
      title: "未采纳 · 评论工具按下时切到「评论」页签",
      note: "未采纳：DS-44 定为推荐（comments.compose）。DS-44 未采纳的备选：同 Figma 评论模式；需改 01 §2.3「点评论钉是唯一的自动切换」。与 compose 相同（落点旁临时钉 + 浮动撰写框，撰写框仍在落点旁、写明锚点），只是评论工具按下时检查器自动切到「评论」页签——本页列表可见，发表后新线程直接出现在列表里；工具回到「选择」（没有撰写框时 Esc 或 V）时页签恢复到按下之前的那个（这里是「设计」）。发表后工具同样保持按下（DS-44 的细则）。切页签不移动焦点（只有焦点正在要被换掉的页签内容里时，先交给要显示的那个页签按钮，不掉到 body）；用户操作让页签切到「评论」时经场景常驻的 polite 区播报一次「检查器已切到「评论」页签」（焦点不动，不说读屏用户不知道右栏换了内容），恢复原页签不播报（回到用户自己选的页签）。与推荐方案的差别只由这个状态的数据打开（工具按下时切页签），不按状态名判断",
      editor: { inspector: { tab: "design" }, toolbar: { tool: "comment" }, data: { toolSwitchesTab: true, draft: CHART_DRAFT } },
    },
    {
      id: "alt-panel-composer",
      title: "未采纳 · 面板底部常驻撰写框（评论工具只认对象）",
      note: "未采纳：DS-45 定为推荐（comments.default）。质量门 Q2（入口唯一）的另一种答案（DS-45 未采纳的备选；DS-45 回写 03-06「锚点创建三种路径」与 02 F7）：保留 03-06 原文的面板底部撰写框发起页级评论，评论工具改为只认对象——点空白处不落钉，画布提示写「点选对象添加评论」，空态第二句写「或在下方直接评论这一页」。代价：比 Figma 多一层常驻的撰写框，面板底部常年占 52；推荐方案（default）去掉它，页级评论只走评论工具点空白处",
      editor: { data: { panelComposer: true } },
    },
    {
      id: "alt-load-failed",
      title: "未采纳 · 评论页签加载失败",
      note: "未采纳：DS-53 定为推荐（comments.all）。DS-53 未采纳的备选（推荐不设面板级加载失败：评论随文档一起打开，没有独立拉取，ADR-0031；50/08 §5 只有单条「锚点无法解析」，见 comments.all）。若保留面板级错误态，按「评论包启动失败、页签仍在」暂画：整块换成居中的整块状态「评论加载失败 · 重试」，筛选随之不可用，画布上的评论钉照常（03-06）。",
      editor: { data: { loadFailed: true } },
    },
    {
      id: "alt-tablet-compose",
      title: "未采纳 · 平板也能发表",
      note: "未采纳：DS-46 定为推荐（comments.tablet）。视口 820 × 1180（触控）：DS-46 未采纳的备选——平板与手机一致，评论面板可发表与回复（解决仍在更大窗口中进行）。需要改 PRD NF-07「平板只读评审」与 TB-49",
      editor: { ...VIEW_ONLY, data: { device: "tablet", sheet: "comments", tabletCompose: true } },
    },
  ],
})
