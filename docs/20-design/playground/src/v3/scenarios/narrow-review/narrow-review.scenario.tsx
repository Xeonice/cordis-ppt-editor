import { Puzzle } from "lucide-react"
import { Banner, ICON } from "../../kit"
import fidelity from "../fidelity/fidelity.scenario"
import { qrDeck } from "../main-states/slides"
import narrow from "../narrow/narrow.scenario"
import { MASTER_REASON } from "../narrow/data"
import { POLL_DECK, pollOverlay } from "../plugins/poll"
import { PluginsDialogHost } from "../plugins/PluginsPanel"
import { defineScenario, type EditorConfig } from "../types"
import { VhController, PreviewBanner } from "../version-history/chrome"
import { HistoryPanel } from "../version-history/HistoryPanel"
import type { VhData } from "../version-history/store"
import { COMPACT_REGIONS, DRAWER_400_REGIONS, PollSheet, POLL_SHEET_REGIONS, VH_REGIONS } from "./compact"
import { TabletViewer, type TabletLayout } from "./tablet"

/**
 * narrow-review：第 3 批窄屏复核（README D15 ③ ④；rulings §4.25 DS-38、DS-46 写明的推迟项），rulings §4.25 DS-130、DS-131（都按推荐采纳）。
 * ③ 紧凑形态（640–1024）里检查器整栏面板的落位：版本历史、保真报告进右侧检查器抽屉（280），插件整页面板改画布底部 Sheet；同批推迟的两项按现有规则推出——
 *    紧凑形态里个人插件面板宽 min(640, 视口 − 32)、高 min(720, 视口高 − 64)（kit Dialog 原有的最大宽高，640 × 800 下验证），
 *    仅查看形态的缺插件横幅不放「查看详情」（没有面板可去，PRD PM-12 查看器 preset「无面板入口」类推，01 §6「减少控件而非缩小控件」）。
 * ④ 平板（触控、≥ 640）只读评论面板的落位：手机底部面板这一个件，按方向混用（DS-131，并入复验 N9、N10）——竖屏与当前页上下排开（有空间时保留备注卡），
 *    横屏改右侧整高侧栏 360；未采纳的备选为两向都上下排开（alt-tablet-stacked-both）、两向都用侧栏（alt-tablet-sidebar）。
 * 形态由状态强制（同第 1 批 narrow 场景：紧凑用 narrow 的抽屉与胶囊，平板换成仅查看形态），Hub 链接在任何窗口里都是这个形态；截图按注明的视口拍
 * （紧凑 1000 × 760，个人插件面板 640 × 800，平板竖屏 820 × 1180、横屏 1180 × 820，仅查看 390 × 844）。
 * 注意：样张里其余场景在 < 1024 的窗口里仍画桌面三栏（只有 narrow 与本场景强制形态），评审时别把窄窗口里的桌面三栏当成产品行为。
 * 摸底列为可选、这里没有单独画的：平板「现画法对照」——就是第 2 批的 comments.tablet（底部居中 560 浮层），不复制一份。
 * 删去的状态（2026-10-21 修复轮，平板评论改为按方向混用之后）：alt-tablet-sidebar-landscape（横屏侧栏就是 tablet-comments-landscape，不再重复一张）；
 * tablet-comments-many（线程多时面板内滚动）——采纳的两种落位里面板都够高（竖屏备注卡以下约 570、横屏侧栏整高约 764），示例第 4 页的线程连同展开的长评论与「已解决」都放得下，
 * 画不出滚动；内容超出时列表在面板内纵向滚动、标题行与底部说明常驻（同一个面板件，comments.phone）。面板被压到约 330 而要滚动的情形就是未采纳的 alt-tablet-stacked-both（第三条被切成半行）。
 * 同目录：compact（紧凑形态的抽屉、Sheet 与横幅下沿）· tablet（平板的仅查看形态与评论面板落位）。
 */

const vh = (d: VhData): EditorConfig["data"] => ({ vh: d })

/** 紧凑形态的共同配置：主菜单「视图 › 母版视图」不可用（「在更大窗口中编辑」，TB-44，同 narrow） */
const COMPACT: EditorConfig = { rail: { menu: { master: { reason: MASTER_REASON } } }, regions: COMPACT_REGIONS }

/** 版本历史（第 2 批 version-history 场景的场景级配置，换上紧凑形态的区域）：整栏面板、预览横幅、命令接线 */
const VH: EditorConfig = {
  rail: { menu: { master: { reason: MASTER_REASON } } },
  stage: { cursor: false, commentPins: true },
  inspector: { takeover: <HistoryPanel /> },
  banner: <PreviewBanner />,
  canvasOverlay: <VhController />,
  regions: VH_REGIONS,
}

/** 保真报告（第 2 批 fidelity 场景的场景级配置，换上紧凑形态的区域）：报告一出现就开着，在右侧抽屉里 */
const FID: EditorConfig = fidelity.editor ?? {}

/** 插件整页面板：第 6 页「现场投票」上选中投票元素（第 2 批 plugins 场景的同一份文档与画布叠加层）；Sheet 那一态画布不留备注区（Sheet 占下半屏，同 compact-chart-data），抽屉备选照常有备注 */
const POLL: EditorConfig = {
  rail: { menu: { master: { reason: MASTER_REASON } } },
  deck: POLL_DECK,
  slide: 6,
  selection: "plugins-poll",
  slideOverlay: pollOverlay,
  stage: { cursor: false, notes: false },
}

/** 仅查看形态（narrow 场景的场景级配置）：查看器排在横幅下面的一层里（同 offline-conflict.narrow-offline） */
const NARROW: EditorConfig = narrow.editor ?? {}
const narrowStage: NonNullable<EditorConfig["regions"]>["stage"] = (ctx, d) => (
  <div className="relative flex min-h-0 flex-1 flex-col">{NARROW.regions?.stage ? NARROW.regions.stage(ctx, d) : d.stage()}</div>
)

/** 平板：左栏、检查器、工具条都不渲染，画布列换成仅查看形态（comments 场景 VIEW_ONLY 的同一做法）；线程数据是示例文档原样。layout 按状态固定（DS-131：竖屏 stacked、横屏 sidebar） */
const tablet = (layout: TabletLayout, data: Record<string, unknown> = {}): EditorConfig => ({
  slide: 4,
  toolbar: { hidden: true, collapse: true },
  regions: { leftRail: () => null, inspector: () => null, toolbar: () => null, stage: () => <TabletViewer layout={layout} />, grid: () => <TabletViewer layout={layout} /> },
  data: { dataset: "deck", device: "tablet", sheet: "comments", ...data },
})

export default defineScenario({
  id: "narrow-review",
  title: "窄屏复核",
  specs: ["03-02", "03-07", "03-10", "03-09", "03-06"],
  batch: 3,
  summary: "紧凑形态里的版本历史、保真报告（右侧抽屉）与插件整页面板（底部 Sheet），个人插件面板与仅查看形态的缺插件横幅；平板只读评论面板按方向落位（竖屏与当前页上下排开、横屏右侧侧栏）",
  states: [
    /* ---------------------------------------------------------------- 紧凑形态的整栏面板（DS-130） */
    {
      id: "compact-history",
      title: "紧凑 · 版本历史在检查器抽屉",
      note: "rulings §4.25 DS-130。视口 1000 × 760。文档菜单「版本历史」：右侧检查器抽屉打开，抽屉整栏换成第 2 批的版本历史面板（宽 280 不变，DS-38「沿用检查器宽度」；协作行不动，标题行同桌面「版本历史 · 命名当前版本 · 关闭 Esc」，最右是抽屉的「收起检查器」开关），右上胶囊让位；幻灯片、备注与底部工具条在未遮挡的 720 里适应，不跳动。两个出口各管各的：面板的「关闭」（Esc 先关面板）回到常规检查器、抽屉还开着；「收起检查器」收起抽屉、面板仍开着，再点右上胶囊的「显示检查器」回到面板（compact-takeover-rail）。面板开着时左上胶囊的「单页 / 网格」与主菜单「视图 › 网格视图」都与桌面同一原因不可用（「关闭版本历史后可用」：网格视图没有检查器栏，放不下面板；同桌面左栏与 compact-takeover-rail 左抽屉的同一对开关，左上胶囊里同样不可用）",
      editor: { ...VH, data: { ...vh({}), drawer: "inspector" } },
    },
    {
      id: "compact-history-preview",
      title: "紧凑 · 预览某个版本",
      note: "DS-130。视口 1000 × 760。点「提案定稿」：预览横幅常驻在上（「正在查看昨天 16:20 的版本」+「返回当前版本」「恢复此版本」，DS-39 的模式横幅），左上胶囊排在横幅下面（胶囊里的「单页 / 网格」不可用，同 compact-history），画布在未遮挡区显示所选版本（议程 3 项、增长 17%）、底部工具条收起；版本列表仍在右侧抽屉里，可以接着点别的版本。抽屉从横幅下沿开始、不盖住横幅——narrow 的抽屉原是整高的，版本预览时会盖住横幅右端的两个按钮（DS-130：编辑器紧凑形态的非模态抽屉从横幅下沿开始，第 3 批转正时进了底座）。打开左上「显示幻灯片列表」时右抽屉收起（同一时刻只开一个抽屉，03-02 §5a.1），左抽屉里是所选版本的 5 页缩略图；再点右上「显示检查器」回到版本列表",
      editor: { ...VH, slide: 2, data: { ...vh({ selected: "n-proposal" }), drawer: "inspector" } },
    },
    {
      id: "compact-takeover-rail",
      title: "紧凑 · 面板开着时打开幻灯片抽屉",
      note: "DS-130。视口 1000 × 760。版本历史面板开着时点左上「显示幻灯片列表」：右抽屉（连同面板）收起、左抽屉展开（一次只开一个抽屉）；面板没有关，右上胶囊重新出现，点「显示检查器」回到面板、停在原来的位置。左抽屉顶行的「单页 / 网格」与主菜单「视图 › 网格视图」同样不可用（「关闭版本历史后可用」，与 compact-history 的胶囊同一画法）",
      editor: { ...VH, data: { ...vh({}), drawer: "rail" } },
    },
    {
      id: "compact-fidelity",
      title: "紧凑 · 保真报告在检查器抽屉",
      note: "DS-130。视口 1000 × 760。主菜单「文件 › 保真报告」（或打开后的轻提示「查看」、页级提示条「查看详情」）：报告在右侧检查器抽屉的整栏里（第 2 批 fidelity.report 的同一个面板，宽 280），点某条的「定位」跳到那一页、在画布上短暂高亮对象——画布在未遮挡区，高亮不会被抽屉挡住；面板与抽屉的两个出口同 compact-history",
      editor: {
        ...FID,
        rail: { ...FID.rail, menu: { master: { reason: MASTER_REASON } } },
        inspector: { ...FID.inspector, takeoverOpen: true },
        regions: COMPACT_REGIONS,
        data: { ...FID.data, drawer: "inspector" },
      },
    },
    {
      id: "compact-plugin-panel",
      title: "紧凑 · 插件整页面板改底部 Sheet",
      note: "DS-130。视口 1000 × 760。选中投票元素后在检查器抽屉的插件分区点「展开」：插件整页面板改为画布底部 Sheet（高 46vh、整宽、上圆角 12、顶部把手、不加遮罩），与图表数据面板的紧凑形态同一做法（narrow.compact-chart-data，D-17）——加宽到 400 的整栏放不进 280 的抽屉；Sheet 取代抽屉里的插件分区，抽屉随之收起；标题行同桌面（「现场投票」+「第三方插件 · Beta Labs」·「收起到检查器」·「关闭」Esc），内容同一份（问题、参与方式、状态），底部一行说明。幻灯片在 Sheet 之上的区域里适应，选中的投票元素始终可见（这一态不画备注区）；底部工具条让位，Sheet 关了再出来。「收起到检查器」：抽屉重新打开、焦点回「展开」；「关闭」/ Esc：焦点交给右上胶囊的「显示检查器」",
      editor: { ...POLL, canvasOverlay: <PollSheet />, regions: POLL_SHEET_REGIONS, data: { pollPanel: true } },
    },
    {
      id: "alt-takeover-drawer-400",
      title: "未采纳 · 整页面板也进抽屉（加宽到 400）",
      note: "未采纳（DS-130 定为版本历史、保真报告进右侧抽屉 280，插件整页面板改画布底部 Sheet，见 compact-plugin-panel）：全部整栏面板都进右侧检查器抽屉，编辑与整页类（插件整页面板、图表数据面板）时抽屉加宽到 400（桌面整栏的宽度）。1000 宽时画布只剩约 600（640 宽时只剩约 240）；投票元素与面板能同时看到，但幻灯片小了一档；抽屉不盖底部，备注区照常在幻灯片下方（与紧凑形态的其余状态相同）。选这一种需同时改已拍板的 narrow.compact-chart-data（图表数据面板改进 400 抽屉，推翻 D-17 的底部 Sheet，DS-21）",
      editor: { ...POLL, stage: { cursor: false }, regions: DRAWER_400_REGIONS, data: { pollPanel: true, drawer: "inspector" } },
    },
    {
      id: "compact-plugins-dialog",
      title: "紧凑 · 个人插件面板（640 宽）",
      note: "视口 640 × 800（紧凑形态的下沿）。主菜单「插件…」打开的个人插件面板是居中对话框（DS-38，kit Dialog lg 640）：视口不够宽时宽取视口 − 32（608）、高取 min(720, 视口高 − 64)（720），其余同桌面——这正是 kit Dialog 原有的最大宽高（max-w calc(100vw − 32px)、max-h calc(100dvh − 64px)），03-09 §15 推迟的「紧凑形态里个人插件面板的尺寸」由此推出、不另定。列表在框内滚动",
      editor: { ...COMPACT, layers: <PluginsDialogHost />, data: { pOpen: true } },
    },
    {
      id: "narrow-plugin-banner",
      title: "仅查看 · 缺插件横幅（390 宽）",
      note: "视口 390 × 844。03-09 §15 推迟的「仅查看形态里缺插件横幅『查看详情』的去处」：仅查看形态没有个人插件面板，横幅不放「查看详情」与「去管理 › 插件」（没有面板可去，按 PRD PM-12 查看器 preset「只显示占位与一行说明、无面板入口」类推，01 §6「减少控件而非缩小控件」），只留 ×（「关闭提示」，触控 44）；正文去掉编辑类的后半句，只写「3 处内容以占位显示，内容已保留」。横幅在最顶上、竖排（DS-60），中性底 + 警告色拼图（DS-41），第 6 页的二维码以占位显示；当前页下方照常是只读备注卡（同 narrow.narrow、offline-conflict.narrow-offline），这一页（扫码获取资料）没有备注，写「这一页没有演讲者备注」（rulings §4.25 DS-138）",
      editor: {
        ...NARROW,
        deck: qrDeck("插件已停用"),
        slide: 6,
        // 第 6 页换了内容（扫码获取资料）：备注卡改读当前页自己的备注（narrow 查看器 data.viewerNotes = "slide"，第 3 批修复轮加的可选分支；缺省仍按页码取示例备注）
        data: { ...NARROW.data, form: "narrow", viewerNotes: "slide" },
        toolbar: { hidden: true, collapse: true },
        regions: { ...NARROW.regions, stage: narrowStage },
        banner: (
          <Banner icon={<Puzzle {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-warning)" />} role="status" title="本文档用到了「二维码形状」，管理员已停用该插件" onClose={() => undefined} closeLabel="关闭提示" stack>
            3 处内容以占位显示，内容已保留
          </Banner>
        ),
      },
    },

    /* ---------------------------------------------------------------- 平板只读评论（DS-131） */
    {
      id: "tablet-comments",
      title: "平板竖屏 · 评论面板",
      note: "rulings §4.25 DS-131（按方向混用：竖屏上下排开、横屏右侧侧栏）。视口 820 × 1180（触控，仅查看形态，TB-49 只读评审）。评论面板仍是手机底部面板这一个件（标题「评论 · 第 4 页 · 3 条未解决」、线程、平板没有撰写区与「回复」、底部「平板上只能查看评论」），只改落位：竖屏与当前页上下排开——当前页照常全宽（788 × 443），下面照常是只读备注卡（竖屏有空间，评审时备注是读幻灯片的上下文），面板与当前页同宽、贴底，补满备注卡以下的全部高度（约 570，≥ 40dvh），不再像 comments.tablet 那样居中 560、按内容高、上方空出约 250；只有这样排面板不足 40dvh（如备注很长）时备注卡才让位，当前页再按「给面板留 40dvh」收窄。面板不浮在内容上：去掉浮层阴影，上圆角 12 + 上左右 1px 分隔线；高度由版面排出、不能拖，所以不画顶部把手（手机的浮动底部面板才有）。画布上同时标出本页的评论钉，点钉让面板里那一条铺选中底色。面板外点按不收起（边看幻灯片边读评论，03-02 §5a.2）；× 收起后底部翻页条回来、焦点回「评论」。顶部条状态行写「仅查看 · 在电脑上编辑」：平板是因为触控才只读，不是窗口小（rulings §4.25 TB-125，TB-44 细化；窗口窄的仍写「在更大窗口中编辑」）",
      editor: tablet("stacked"),
    },
    {
      id: "tablet-comments-landscape",
      title: "平板横屏 · 评论面板",
      note: "DS-131（按方向混用的横屏一半）。视口 1180 × 820。评论面板改为右侧整高侧栏（宽 360，顶部条以下整高 764；同一个面板件，左侧 1px 分隔线、不带圆角与阴影、不画把手），当前页与备注卡在左侧适应：当前页 788 × 443、备注卡在它下面，三条线程整列放得下（王小明那条连同 2 条回复展开、「已解决 1」展开也放得下，超出时列表在侧栏内滚动）——上下排开在横屏里当前页只剩约 718 × 404、面板只有约 330（第三条被切成半行，见备选 alt-tablet-stacked-both）。翻页条在面板打开时让位（左右轻扫、外接键盘照常翻页），× 收起后回来、焦点回「评论」。状态行同竖屏「仅查看 · 在电脑上编辑」",
      editor: tablet("sidebar"),
    },
    {
      id: "alt-tablet-stacked-both",
      title: "未采纳 · 平板评论两向都上下排开（横屏）",
      note: "未采纳（DS-131 定为按方向混用：竖屏上下排开、横屏右侧整高侧栏 360，见 tablet-comments-landscape）：横屏也与当前页上下排开（修复轮之前的推荐）。视口 1180 × 820：当前页全宽时面板放不下，备注卡让位，当前页按「给面板留 40dvh」收窄到约 718 × 404、居中，两侧各空约 230；面板与它同宽、只有约 330 高，第三条线程被底边切成半行，要在面板里滚动。竖屏与采纳的画法相同（tablet-comments）",
      editor: tablet("stacked"),
    },
    {
      id: "alt-tablet-sidebar",
      title: "未采纳 · 平板评论两向都用侧栏（竖屏）",
      note: "未采纳（DS-131 定为按方向混用：竖屏与当前页上下排开、保留备注卡，见 tablet-comments）：竖屏也用右侧整高侧栏（宽 360，同一个面板件，左侧 1px 分隔线、不带圆角与阴影），当前页在左侧适应——竖屏 820 宽时当前页只剩约 428 × 241，大半屏是空的（Google 文档类在安卓平板上的评论面板是这一路）。横屏与采纳的画法相同（tablet-comments-landscape）",
      editor: tablet("sidebar"),
    },
  ],
})
