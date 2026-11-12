import { useEditor } from "../../kit"
import { defineScenario, type EditorConfig, type RegionDefaults } from "../types"
import { deckFor } from "../chart/ChartSlide"
import { CHART_PAGE, COLUMN, DEFAULT_OPTIONS, regionData } from "../chart/model"
import { chartOverlay } from "../chart/overlays"
import { FindHits, FindPanel, REVENUE_HITS } from "../find-view-undo/FindReplace"
import { MasterHintDemo } from "../masters-themes/MasterChrome"
import { KIND } from "../masters-themes/mv-state"
import { CompactStage, CompactToolbar, InspectorDrawer, RailDrawer } from "./compact"
import { ChartSheetStage, ChartSheetToolbar, CompactDataSheet, MasterCompactStage, MasterCompactToolbar, MasterInspectorDrawer, MasterRailDrawer } from "./compact-features"
import { DECK_COMMENTS } from "../comments/comments.scenario"
import { MASTER_REASON } from "./data"
import { useCloseDrawerOnMasterToggle, useCloseDrawerOnViewChange, useCloseOnFormChange, useForm } from "./form"
import { NarrowViewer } from "./viewer"

/**
 * narrow：DS-17 窄屏形态（03-02 §8「窄屏」、01 §6、50/10 §2.2、PRD NF-07）。
 * 紧凑（640–1024）——左栏与检查器收起为左上 / 右上两个胶囊（网格视图同款，DS-4），按需展开为盖在画布上的抽屉（同一时刻一个），
 * 底部工具条与画布保持可用；仅查看（< 640 或 pointer: coarse）——只读查看器形态：逐页浏览、页码与翻页、本页评论（手机可以发表与回复，DS-28、DS-46）、
 * 顶部明确提示「在更大窗口中编辑」。
 * 评论（2026-10-15 按 rulings §4.25 DS-62、DS-46）：紧凑抽屉的「评论」页签是第 2 批评论场景的评论面板（comments 场景 DECK_COMMENTS），仅查看形态的评论底部面板是同一场景的手机评论面板
 * （viewer.tsx）；线程数据是示例文档原样（场景级 data.dataset「deck」：第 4 页 3 条、都未解决），与画布上的评论钉同一份。
 * 形态由状态的 data.form 决定：compact / narrow 强制（Hub 链接在任何窗口里都看得到这个形态；截图按注明的视口拍），
 * auto（最后一个状态）跟着真实视口切换。全部经 regions 包底座区域实现，不改共享文件：
 *   leftRail / inspector → 紧凑时是抽屉（底座左栏 / 检查器原样），仅查看时不渲染；
 *   stage / grid → 紧凑单页加胶囊与留白，仅查看换成查看器；toolbar → 紧凑时随抽屉在未遮挡区居中，仅查看时不渲染。
 * 2026-10-28（母版视图改版第一步）：母版视图是宿主的全局模式，这些外框写 masterView.frameRegions——母版视图里宿主照常调用它们，只是 d 换成母版区域；
 * 紧凑形态下在母版视图里用现有的母版外框（compact-features.tsx 的 Master*：母版窗格抽屉、胶囊没有单页 / 网格），与 compact-master 各态同一画法；
 * 2026-10-30（母版视图改版第二步）起母版画布直接放进紧凑画布外框（与同一视口的普通紧凑画布同大，只下移上下文条的高度），不再为范围行让出 28；
 * 进出母版视图时收起打开中的抽屉（useCloseDrawerOnMasterToggle）。宽度 < 640（仅查看形态）由宿主自动退出母版视图（TB-16）。
 * 单页与网格两块外框都调用它，是否已收过记在场景仓里：网格视图一侧进出时宿主换整套结构，这次提交里新挂上的一块也会补做（2026-10-30 第一步修复第 6 轮，复验 R6-B1）。
 * 普通视图里切换单页 / 网格同样收起抽屉（useCloseDrawerOnViewChange，rulings §4.25 DS-170），跨断点时焦点在被收起的区域里的先交给画布（useCloseOnFormChange，DS-168），
 * 两块外框都调用，做法同上。
 */

function RailRegion({ d }: { d: RegionDefaults }) {
  const form = useForm()
  const { masterView } = useEditor()
  if (form === "desktop") return <>{d.leftRail()}</>
  if (form !== "compact") return null
  return masterView.on ? <MasterRailDrawer d={d} /> : <RailDrawer d={d} />
}

function InspectorRegion({ d }: { d: RegionDefaults }) {
  const form = useForm()
  const { masterView } = useEditor()
  if (form === "desktop") return <>{d.inspector()}</>
  if (form !== "compact") return null
  return masterView.on ? <MasterInspectorDrawer d={d} /> : <InspectorDrawer d={d} />
}

function StageRegion({ d }: { d: RegionDefaults }) {
  const form = useForm()
  const { masterView } = useEditor()
  useCloseOnFormChange(form)
  useCloseDrawerOnMasterToggle()
  useCloseDrawerOnViewChange()
  if (form === "desktop") return <>{d.stage()}</>
  if (form !== "compact") return <NarrowViewer />
  return masterView.on ? <MasterCompactStage d={d} /> : <CompactStage d={d} />
}

/**
 * 网格视图的外框。进出母版视图时同样收起抽屉、复位 handoff（2026-10-30 第一步修复第 6 轮，复验 R6-B1）：从母版视图退出回网格时，
 * 单页的外框（StageRegion、MasterCompactStage）在这次提交里卸下，由这里补做——母版窗格抽屉不留到之后回单页时自己弹开，焦点也不被胶囊上的开关抢走。
 * 普通视图里从单页切到网格时同理（DS-170）：单页的外框随之卸下，由这里收起抽屉
 */
function GridRegion({ d }: { d: RegionDefaults }) {
  const form = useForm()
  useCloseOnFormChange(form)
  useCloseDrawerOnMasterToggle()
  useCloseDrawerOnViewChange()
  return form === "narrow" ? <NarrowViewer /> : <>{d.grid()}</>
}

function ToolbarRegion({ d }: { d: RegionDefaults }) {
  const form = useForm()
  const { masterView } = useEditor()
  if (form === "desktop") return <>{d.toolbar()}</>
  if (form !== "compact") return null
  return masterView.on ? <MasterCompactToolbar d={d} /> : <CompactToolbar d={d} />
}

/** 紧凑：网格视图（底座胶囊）的主菜单里母版视图同样不可用。 */
const COMPACT: EditorConfig = { data: { form: "compact" }, rail: { menu: { master: { reason: MASTER_REASON } } } }
const NARROW: EditorConfig = { data: { form: "narrow" } }

export default defineScenario({
  id: "narrow",
  title: "窄屏形态",
  specs: ["03-02"],
  summary: "紧凑 640–1024：两侧收为胶囊、按需抽屉；仅查看 < 640：逐页浏览、页码翻页、本页评论（M3 起可发表与回复）、提示在更大窗口中编辑",
  editor: {
    // 评论面板与评论钉的线程数据（comments/store）：示例文档原样（DS-46、DS-62）
    data: { dataset: "deck" },
    // 这里的 regions 是形态外框：母版视图里照常套在母版区域外面（宿主的全局模式，2026-10-28）
    masterView: { frameRegions: true },
    regions: {
      leftRail: (_, d) => <RailRegion d={d} />,
      inspector: (_, d) => <InspectorRegion d={d} />,
      stage: (_, d) => <StageRegion d={d} />,
      grid: (_, d) => <GridRegion d={d} />,
      toolbar: (_, d) => <ToolbarRegion d={d} />,
    },
  },
  states: [
    {
      id: "compact",
      title: "紧凑 · 两侧收起",
      note: "视口 1024 × 768（按紧凑区间的上沿截取；实际宽度 < 1024 才进入紧凑）。左栏与检查器默认收起为左上「文档」、右上「协作与分享」两个胶囊；开关在窗口两个外角；画布左右留白 24；底部工具条八项不变；主菜单「视图 › 母版视图」不可用，写「在更大窗口中编辑」（不是桌面完整形态即不可进入，rulings §4.25 TB-44）",
      editor: { ...COMPACT },
    },
    {
      id: "compact-inspector",
      title: "紧凑 · 检查器抽屉",
      note: "视口 1024 × 768。选中要点卡后点右上角「显示检查器」：桌面检查器原样作为右侧抽屉盖在画布上（浮层阴影），右上胶囊让位；幻灯片与工具条在未遮挡区域内居中，选中对象不被挡住；Esc 或同一角的「收起检查器」收起",
      editor: { ...COMPACT, slide: 2, selection: "shape", data: { form: "compact", drawer: "inspector" } },
    },
    {
      id: "compact-rail",
      title: "紧凑 · 幻灯片抽屉",
      note: "视口 800 × 1000。点左上角「显示幻灯片列表」：桌面左栏原样作为左侧抽屉（主菜单、单页 / 网格、文档标题、新建幻灯片、缩略图），左上胶囊让位；同一时刻只展开一个抽屉",
      editor: { ...COMPACT, slide: 3, data: { form: "compact", drawer: "rail" } },
    },
    {
      id: "compact-comments",
      title: "紧凑 · 评论",
      note: "视口 800 × 1000。检查器抽屉的「评论」页签（第 4 页 3 条评论），幻灯片上同时标出评论钉（与桌面评审、仅查看评论同一画法）；抽屉宽 280 不变，800 宽下幻灯片在左侧 520 里适应；备注区是这一页的演讲者备注。「评论」页签是第 2 批的评论面板（与 comments.compact 同一个件）：顶部筛选「全部 / 当前页 / 未解决 / @我」（缺省「当前页」）与排序，未解决在前、已解决收在末尾「已解决 N」一行（这一页的 3 条都未解决，没有这一行），每条可展开回复；点钉定位到那一条（2026-10-15 按 rulings §4.25 DS-62 改）",
      editor: {
        ...COMPACT,
        ...DECK_COMMENTS,
        slide: 4,
        inspector: { ...DECK_COMMENTS.inspector, tab: "comments" },
        rail: { ...COMPACT.rail, ...DECK_COMMENTS.rail },
        data: { ...DECK_COMMENTS.data, form: "compact", drawer: "inspector" },
      },
    },
    {
      id: "compact-chart-data",
      title: "紧凑 · 图表数据面板（底部 Sheet）",
      note: "视口 1000 × 760。rulings §4.22 D-17 / DF-07：紧凑窗口里检查器是抽屉，加宽到 400 的数据面板放不下，改为画布底部 Sheet——高 46vh、整宽、上沿圆角 12、不加遮罩；幻灯片在 Sheet 之上的区域里适应，编辑时图表始终可见；底部工具条让位，Sheet 关了再出来。标题行与桌面数据面板相同（编辑数据 · 子类型 ·「收起到检查器」·「关闭」Esc），网格就是桌面的数据网格",
      editor: {
        ...COMPACT,
        deck: deckFor(),
        slide: CHART_PAGE,
        selection: "chart",
        stage: { cursor: false, notes: false },
        slideOverlay: chartOverlay,
        canvasOverlay: <CompactDataSheet />,
        regions: { stage: (_, d) => <ChartSheetStage d={d} />, toolbar: (_, d) => <ChartSheetToolbar d={d} /> },
        data: {
          form: "compact",
          chart: { page: "chart", spec: COLUMN, options: { ...DEFAULT_OPTIONS, titleText: "各区域季度销售（百万元）" }, data: regionData(), panel: true, dataOpen: true },
        },
      },
    },
    {
      id: "compact-master",
      title: "紧凑 · 母版视图",
      note: "视口 1000 × 760。03-26 §6.6「已在母版视图中缩窄到 < 1024」：不强制退出——上下文条整宽在画布列最上（DS-130），两个胶囊排在它下面，左上胶囊没有单页 / 网格；母版窗格与检查器都收成抽屉（浮层，开关在两个外角，同普通紧凑形态）；画布是母版画布，与同一视口的普通紧凑画布同大、只下移上下文条的高度；工具条仍把「评论」换成「占位符」，上下文条的「关闭母版视图」照常可用",
      editor: {
        ...COMPACT,
        selection: KIND.layout,
        stage: { cursor: false },
        // 载入时已在母版视图（宿主的全局模式）：上下文条由宿主画在横幅通道最上面；下面四个外框是本状态的形态外框（场景级 frameRegions），拿到的 d 就是母版区域
        masterView: { open: true },
        regions: {
          leftRail: (_, d) => <MasterRailDrawer d={d} />,
          inspector: (_, d) => <MasterInspectorDrawer d={d} />,
          stage: (_, d) => <MasterCompactStage d={d} />,
          toolbar: (_, d) => <MasterCompactToolbar d={d} />,
        },
        data: { form: "compact", mvPane: "office-title-content" },
      },
    },
    {
      id: "compact-master-pane",
      title: "紧凑 · 母版视图 · 窗格抽屉",
      note: "视口 1000 × 760。点左上角开关：母版与版式窗格作为左侧抽屉盖在画布上（与普通紧凑形态的幻灯片抽屉同一外框，「新建版式」、没有网格切换）；抽屉从上下文条（横幅通道）的下沿开始，不盖住它；Esc 或同一角的开关收起（2026-10-22 按 rulings §4.25 DS-130 改：原为从窗口顶边开始、盖住母版视图条）",
      editor: {
        ...COMPACT,
        selection: KIND.layout,
        stage: { cursor: false },
        masterView: { open: true },
        regions: {
          leftRail: (_, d) => <MasterRailDrawer d={d} />,
          inspector: (_, d) => <MasterInspectorDrawer d={d} />,
          stage: (_, d) => <MasterCompactStage d={d} />,
          toolbar: (_, d) => <MasterCompactToolbar d={d} />,
        },
        data: { form: "compact", drawer: "rail", mvPane: "office-title-content" },
      },
    },
    {
      id: "compact-master-inspector",
      title: "紧凑 · 母版视图 · 检查器抽屉",
      note: "视口 1000 × 760。点右上角开关：版式 / 母版属性作为右侧抽屉盖在画布上（与普通紧凑形态的检查器抽屉同一外框），从上下文条（横幅通道）的下沿开始、不盖住它（rulings §4.25 DS-130）；「评论」页签留在原位不可用；幻灯片与工具条在未遮挡的区域里居中；Esc 或同一角的开关收起",
      editor: {
        ...COMPACT,
        selection: KIND.layout,
        stage: { cursor: false },
        masterView: { open: true },
        // 网格一侧沿用场景级的 GridRegion（regions 按键合并）：进出母版视图时同样收起抽屉
        regions: {
          leftRail: (_, d) => <MasterRailDrawer d={d} />,
          inspector: (_, d) => <MasterInspectorDrawer d={d} />,
          stage: (_, d) => <MasterCompactStage d={d} />,
          toolbar: (_, d) => <MasterCompactToolbar d={d} />,
        },
        data: { form: "compact", drawer: "inspector", mvPane: "office-title-content" },
      },
    },
    {
      id: "compact-find",
      title: "紧凑 · 查找",
      note: "视口 1000 × 760。03-21「窄屏下收窄为仅查找输入 + 计数，替换区收入「更多」」：面板宽 320，只留查找框、计数、上一个 / 下一个、「⋯ 更多」与关闭；区分大小写、全字匹配与「替换…」都在「更多」里，选了「替换…」才在下面展开替换行。命中高亮与跳页同桌面。画布上照常画第 4 页的 3 枚评论钉（编辑模式照常显示评论钉）（2026-10-15 按 rulings §4.25 DS-43 改）",
      editor: {
        ...COMPACT,
        slide: 4,
        stage: { cursor: false, commentPins: true },
        canvasOverlay: <FindPanel hits={REVENUE_HITS} compact />,
        slideOverlay: () => <FindHits hits={REVENUE_HITS} />,
        data: { form: "compact", find: { open: true, replace: false, query: "营收", index: 3 } },
      },
    },
    {
      id: "narrow",
      title: "仅查看",
      note: "视口 390 × 844。编辑类入口全部收起：顶部「仅查看 · 在更大窗口中编辑」，当前页全宽 + 只读备注，底部浮动条 上一页 · 页码 · 下一页 ┊ 评论（44 × 44、间距 8）；左右轻扫或外接键盘 ← → 也能翻页；横屏时整页按可用高度收窄，留在顶部条与浮动条之间",
      editor: { ...NARROW, slide: 2 },
    },
    {
      id: "narrow-comments",
      title: "仅查看 · 评论",
      note: "视口 390 × 844。点底部「评论」：底部面板列出本页评论，幻灯片上同时标出评论钉；面板不加遮罩，上方幻灯片仍可看、可缩放。手机可以发表与回复、解决在更大窗口中进行（rulings §4.25 DS-28）。面板是第 2 批的手机评论面板（与 comments.phone 同一个件）：标题写未解决数「第 4 页 · 3 条未解决」，未解决在前、已解决收在「已解决 N」一行（这一页的 3 条都未解决，没有这一行），每条有「回复」（有回复的另有「N 条回复」展开），底部常驻撰写区（44px 文本框 ·「发送」，↵ 换行、只用「发送」提交），撰写区上方一行「解决评论请在更大窗口中进行」（原底部一行「M3 起可发表与回复；解决在更大窗口中进行」随之去掉）；点钉让那一条铺选中底色（2026-10-15 按 rulings §4.25 DS-46 改）",
      editor: { ...NARROW, slide: 4, data: { form: "narrow", sheet: "comments" } },
    },
    {
      id: "narrow-slides",
      title: "仅查看 · 幻灯片列表",
      note: "视口 390 × 844。点底部页码「4 / 6」：底部面板两列真实缩略图，当前页强调色描边，点一页跳过去并收起",
      editor: { ...NARROW, slide: 4, data: { form: "narrow", sheet: "slides" } },
    },
    {
      id: "narrow-more",
      title: "仅查看 · 更多",
      note: "视口 390 × 844。右上「更多」：只有查看类命令——从当前页放映、从头放映、适应窗口、显示演讲者备注（行高 48）",
      editor: { ...NARROW, slide: 2, data: { form: "narrow", sheet: "more" } },
    },
    {
      id: "viewonly-master-key",
      title: "仅查看形态 · 按 ⌥⌘M",
      note: "视口 390 × 844。仅查看形态（TB-136、TB-163）按 ⌥⌘M：不进入母版视图，只用一条轻提示说明原因「母版视图：在更大窗口中编辑」，再按不另出一条——原因按形态由编辑器给，这一态只负责触发；平板外壳写「在电脑上编辑」（由交互检查在平板外壳的状态里测，不另画）",
      editor: { ...NARROW, canvasOverlay: <MasterHintDemo /> },
    },
    {
      id: "responsive",
      title: "随窗口宽度切换",
      note: "按真实视口选形态：≥ 1024 桌面、640–1024 紧凑、< 640 或触控仅查看；拖动窗口宽度即可看到切换，跨断点时打开中的抽屉与面板关闭",
      editor: { data: { form: "auto" } },
    },
  ],
})
