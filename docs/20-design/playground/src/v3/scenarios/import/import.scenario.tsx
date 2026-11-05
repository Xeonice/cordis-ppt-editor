import { HomeBody } from "../../HomeBody"
import { Button, LibraryLayers, LibraryToasts, lockTools, Progress, registerImportDialog, RailList, RailThumb } from "../../kit"
import { Library } from "../documents/Library"
import { HOME_PAGE, HOME_SHELL, HomeDrawer, homeData, NavToggle } from "../home/HomeMain"
import { STATUS } from "../main-states/bars"
import { OPENING_DECK } from "../main-states/slides"
import { defineScenario, type EditorConfig, type PageConfig } from "../types"
import { FOLDED, OTHER_FAILURES, RETRY_CAUSES, STAGES } from "./data"
import { ImportDialog, type ImportDialogSeed } from "./dialog"
import { OpeningBlockPage, SnapshotOpeningStage } from "./pages"
import { EMF_DECK, EmfRasterizer, EXTERNAL_DECK, MEDIA_DECK, MediaOverlay } from "./slides"
import { BIG_CURRENT, BIG_DECK, VirtualRail } from "./virtual"

/**
 * import：03-13「打开与导入」第 3 批补的部分（rulings §4.25 DS-62；第 3 批 · 应用壳族）——「导入」对话框、协同快照打开、大文件提示、缩略图虚拟化，
 * 以及媒体与外链的零散态（浏览器放不了的视频与在线视频、外链被禁止加载、EMF 栅格化中）。
 * 第 1、2 批已定稿的不重做：编辑器内的渐进打开（main-states.opening / opening-rest）、通用兜底与没有权限（open-failed / open-failed-access）、
 * 降级占位三层、外链 confirm 与受限字体（fidelity.*）、会话中被撤销与查看人数已满（offline-conflict.*）。
 *
 * 导入（rulings §4.25 DS-140…DS-142、TB-179…TB-182，2026-10-23）：导入全程在叠在原页上的「导入」对话框里（dialog.tsx）——开始页与文档列表顶栏的「导入 .pptx」
 * （kit ShellDefaultActions）打开它，主区拖入落区（kit DropOverlay）松开打开它的上传态；选文件、拖入、上传、服务端解析与失败都在框里原位换，成功后关闭、进编辑器；
 * 手机是底部面板（kit BottomSheet）。取代 2026-10-22 拍板的 DS-97（整屏导入过渡页）与 DS-98（整屏导入页）：整屏的导入页、过渡页与按错误码的失败页
 * （drop-page、uploading、server-parsing、failed-*）与 DS-97 未采纳的 alt-in-shell 一并删去，它们的文案与按错误码的规则并进对话框各失败态的说明。
 * 对话框由本场景登记给底座（registerImportDialog，见下），页面宿主在应用壳四个宿主里挂它；状态数据 page.data.importDialog 让它一出现就开着（ImportDialogSeed）。
 * DS-99（2026-10-22）：协同快照打开时编辑器外壳照常、全部不可用、画布中央转圈（未采纳 alt-open-blocking）。
 * 文件名一律单行、长名中间省略（FileName.tsx，与导出对话框、轻提示同一个件）。
 *
 * 可选状态的取舍（摸底 states-g2-import-export.md）：排队中并进 dialog-parsing 的说明（同一行换文案）；不支持的格式、加密、含宏、超出处理上限、未加载文档类型、
 * 文件过于复杂、存储空间不足并进 dialog-failed-invalid-package 的说明（同一画法只换图标与文案）；超时、5xx、上传凭证失效并进 dialog-failed-network 的说明（同一态换第二行与图标）；
 * 外链自动加载失败并进 external-never 的说明（同一占位换文案）；「手里没有文件」（直接打开 /import、上传中刷新）看到的就是选文件的初始态（dialog-documents）；
 * 缩略图虚拟化见 thumbs-virtualized。
 */

// 「导入」对话框登记给底座（kit importDialog；同 registerCommentsBody 的做法）：应用壳页面的顶栏「导入 .pptx」与拖入落区打开的都是它
registerImportDialog(ImportDialog)

/** DS-99 未采纳的整屏阻断布局（alt-open-blocking）：不渲染左栏、检查器与工具条，内容在整屏垂直居中 */
const OPENING_BLOCK: EditorConfig = {
  toolbar: { hidden: true, collapse: true },
  regions: {
    leftRail: () => null,
    inspector: () => null,
    stage: () => <OpeningBlockPage />,
  },
  data: {},
}

const OPENING = "文档打开后可用"

/** 打开中的编辑器外壳（同第 1 批 main-states.opening）：同步状态行「正在打开…」、协作者还没连上，放映、分享、页签、缩放、工具与新建都不可用 */
const OPENING_SHELL: EditorConfig = {
  slide: 1,
  stage: { notes: false, cursor: false },
  rail: { status: STATUS.opening, newSlide: { reason: OPENING }, viewToggle: { reason: OPENING } },
  inspector: { locked: OPENING, collaborators: { people: [] } },
  toolbar: { disabled: lockTools(OPENING) },
}

/** 大文件提示：第 1 批打开进度行原样（阶段文案 · 进度 · 百分比 · 取消），下方另起一行提示（不进进度行，行宽不随文案跳动） */
function LargeFileRow() {
  return (
    <div className="absolute top-[calc(100%+24px)] left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 whitespace-nowrap">
      <div className="flex items-center gap-3">
        <span className="text-[12px] leading-none text-(--v3-text-2)">正在解析母版与版式…</span>
        <Progress value={62} label="打开进度" className="w-40" />
        <span className="w-7 text-[11px] leading-none text-(--v3-text-2) tabular-nums">62%</span>
        <Button variant="outline">取消</Button>
      </div>
      <p className="text-[12px] leading-4 text-(--v3-text-2)">文件较大，首屏渲染完成后其余页面将继续加载</p>
    </div>
  )
}

const STAGE_LIST = (Object.keys(STAGES) as (keyof typeof STAGES)[]).map((k) => `${k}「${STAGES[k]}」`).join("、")
const RETRY_LIST = Object.values(RETRY_CAUSES)
  .map((c) => `${c.cause}「${c.text}」`)
  .join("、")
/** 同一画法只换图标与文案的失败（data.ts OTHER_FAILURES）：「标题」·「说明」（图标；示例文件） */
const OTHER_LIST = Object.values(OTHER_FAILURES)
  .map((f) => `「${f.title}」·${f.lines.map((l) => `「${l}」`).join("")}（${f.icon}；如「${f.file}」）`)
  .join("；")

/* ---------------------------------------------------------------- 「导入」对话框各态共用的说明句 */

/** 对话框外框与正文的取值（各态同一份） */
const DIALOG_FRAME =
  "外框 560 × 固定高 406（kit Dialog 导入专用一档 size=\"import\"，TB-179；宽与标杆 Figma Import 对话框相同，高按标杆的落区 316 加标题栏 40 算出，标杆 404 的外框边是 0.5px），各阶段不变、只换框里的内容（换阶段时框体不跳）；视口居中，窄于 592 时宽度收到视口减 32、矮于 470 时高度收到视口减 64（kit Dialog），内容比正文高时从上沿排起、正文滚动（矮视口与 200% 缩放不丢内容，NF-05）；画法同全站对话框（DS-142）：圆角 12、1px 边、浮层阴影、遮罩 --v3-scrim（暗 50% 黑、亮 24%，与标杆同档），标题栏 40（「导入」13px 600 + 24px ×，× 用正文色）；正文内边距左右 32、上下 24（同标杆）"

/** 虚线落区的取值（DS-141） */
const DASH =
  "虚线落区填满正文（494 × 316，有底栏的阶段收到 494 × 263）：1px 虚线、圆角 4，静止时与分隔线同档 --v3-border（暗 #444 / 亮 #E5E5E5，与标杆实测同色、线段节奏相同）——DS-141：落区靠正中的字与按钮识别，理由同 DS-35（WCAG 1.4.11 不要求这道线 3:1），设计 04 §2「控件边界色用于虚线落区」一条随之修订；拖入悬停改为强调色虚线加 --v3-accent-soft 淡底（TB-180，见 dialog-dragover）；控件边界色的画法见未采纳的 alt-dialog-dash-control"

/** 对话框的取消（上传与解析中）：×、Esc、「取消」同一个动作 */
const DIALOG_CANCEL =
  "「取消」、×、Esc 是同一个动作——中止并关闭对话框、回到原页（开始页或文档列表），不留卡片也不留原件（rulings §4.18 UX-14、TB-179）；这一阶段 × 的读屏名与工具提示写「取消导入」（kit Dialog closeLabel，同导出对话框 DS-101 的做法），点遮罩不关闭（误点不丢掉这次导入，TB-180）；关闭后焦点回到顶栏「导入 .pptx」"

/** 拖放的口径（各阶段，TB-180） */
const DRAG =
  "拖放（TB-180）：对话框开着的所有阶段都在窗口上拦下拖放的浏览器缺省行为（不会把文件当网页打开、离开页面中断上传）；只有选文件阶段接收——拖到对话框外、遮罩上也算进落区；上传、解析与失败阶段不接收（光标显示不可放下，不高亮、不换文件；失败后要换文件先「关闭」再导入）；一次拖着不止一个文件时也不接收，落区写「一次只能导入一个文件」·「请只拖入一个 .pptx 文件」（浏览器拖动中给得出个数、给不出文件名；系统文件选择框同样单选）"

/** 读屏的播报（各阶段） */
const LIVE =
  "对话框里有一个常驻的 polite 播报区（从选文件起就挂着、初始为空），换阶段只改它的文字——拖入悬停「松开以导入」、上传「正在上传「文件名」」、解析的阶段文案、「已复制诊断信息」；新挂上就带着字的播报区 NVDA、JAWS 常常不念，所以不随阶段新挂；失败由整块状态的 role=alert 念出"

/** 成功后的地址与历史（TB-179） */
const HISTORY =
  "成功后对话框关闭，用 replace 把 /import 换成 /documents/:id 进编辑器（snapshot-opening，DS-99 不变；TB-179）——在编辑器里按后退回到来路页（开始页或文档列表），不会回到一个空的导入对话框；直接打开 /import 的，进来时先在它前面补一条文档列表「最近」的历史，成功后按后退同样回到列表"

/** 对话框叠在开始页上（背后同 home.m2-default）：顶栏是底座缺省的「导入 .pptx」（打开的就是这个对话框，锚点 import.entry） */
const onHome = (seed: ImportDialogSeed): PageConfig => ({
  ...HOME_PAGE,
  data: { ...HOME_PAGE.data, importDialog: seed },
})

/** 同一个对话框叠在文档列表「最近」上（背后同 documents.recent） */
const onDocuments = (seed: ImportDialogSeed): PageConfig => ({
  shell: { current: "recent", title: "最近" },
  body: <Library />,
  overlay: <LibraryToasts />,
  layers: <LibraryLayers />,
  data: { view: "recent", importDialog: seed },
})

/**
 * 手机（< 640）的底部面板叠在开始页的手机形态上（背后同 home.phone，DS-87：左栏收进抽屉、「显示导航」44、不放新建与导入）——
 * 产品里直接打开 /import 的背后是文档列表「最近」的手机形态，与开始页手机形态同一套画法，documents 场景没有单画手机形态，这里用 home.phone 那一版代替
 */
const onPhone = (seed: ImportDialogSeed): PageConfig => ({
  shell: {
    ...HOME_SHELL,
    rail: false,
    actions: null,
    headerStart: (
      <span className="-ml-4 flex">
        <NavToggle touch />
      </span>
    ),
    bodyClassName: "px-4 pt-4 pb-8",
  },
  body: <HomeBody />,
  overlay: (
    <>
      <HomeDrawer search={false} touch />
      <LibraryToasts />
    </>
  ),
  layers: <LibraryLayers />,
  data: { ...homeData({ milestone: "M2", form: "phone" }), importDialog: seed },
})

export default defineScenario({
  id: "import",
  title: "导入与打开",
  specs: ["03-13"],
  batch: 3,
  summary:
    "「导入」对话框（DS-140…DS-142：开始页与文档列表顶栏的「导入 .pptx」与主区拖入落区打开，选文件、拖入、上传、服务端解析与失败都在框里，手机是底部面板）、协同快照打开、大文件提示、缩略图虚拟化、媒体与外链的零散态（放不了的视频、在线视频、外链被禁止、EMF 栅格化），另有 3 个未采纳的备选",
  states: [
    /* ---------------------------------------------------------------- 「导入」对话框（DS-140…DS-142、TB-179…TB-182） */
    {
      id: "dialog",
      title: "导入对话框（开始页）",
      host: "home",
      note:
        "rulings §4.25 DS-140（导入全程在对话框里，取代 DS-97 整屏导入过渡页与 DS-98 整屏导入页）、DS-141、DS-142、TB-179…TB-181（2026-10-23）：开始页与文档列表顶栏的「导入 .pptx」（kit ShellDefaultActions，锚点 import.entry、aria-haspopup=dialog）在原页上打开「导入」对话框（标杆：Figma 文件浏览器的 Import 对话框）；选文件、拖入、上传、服务端解析与失败都在这个框里原位切换（dialog-uploading 起各态），成功后对话框关闭、进编辑器（snapshot-opening，DS-99 不变）。背后是开始页（同 home.m2-default）。" +
        `尺寸：${DIALOG_FRAME}。${DASH}。` +
        "落区正中同标杆的三段：粗体一行「把 PowerPoint 演示文稿带进 Cordex」（13px 600；同标杆「Bring your work into Figma」，不重复标题「导入」）· 说明一行「把 .pptx 文件拖到这里，单个文件最大 200 MB」（12px text-2；上限读部署配置 RuntimeConfig limits.importMaxBytes，TB-147、TB-158，样张写死示例值）· 主按钮「从电脑选择文件…」（28 高，与说明相距 24；弹系统文件选择框、只收 .pptx、单选；样张里点它就当选好了一个文件、原位进上传中）。没有图标、没有底栏、没有「返回文档列表」：关闭就是 ×、Esc 或点遮罩。" +
        "焦点与键盘：由用户点「导入 .pptx」打开时焦点落在「从电脑选择文件…」（kit Dialog 初始焦点 auto；它的读屏说明 aria-describedby 带上粗体一行与说明一行——对话框没有可见的说明，打开时读屏只念「导入 对话框」）；Tab / ⇧Tab 只在 × 与这颗按钮之间循环（焦点圈定、aria-modal）；Esc、×、点遮罩关闭，回到原页、焦点回到顶栏「导入 .pptx」（returnFocus 锚点 import.entry；状态里一出现就开着的同样回到它）。状态里一出现就打开时焦点在对话框本身、不画焦点环（kit 约定）。" +
        `读屏：role=dialog，aria-labelledby 指向标题「导入」；顶栏按钮带 aria-haspopup=dialog；${LIVE}。样张里关掉后可再点顶栏「导入 .pptx」重新打开（底座缺省按钮，开始页与文档列表的各状态里点它都打开这个对话框）。` +
        `${DRAG}（悬停见 dialog-dragover；样张里可以真的从桌面拖一个文件进来试）。` +
        "开始页与文档列表主区的拖入落区（home.drop-import、documents.drop-import，kit DropOverlay）照常保留：拖入悬停同为强调色虚线加淡底，松开直接打开这个对话框的上传态（dialog-uploading，TB-180），不另画。" +
        "手机（< 640）是贴底的底部面板（dialog-phone）；平板（触控、≥ 640）照常是这个对话框，触控下按钮写「选择文件…」、说明只写「只支持 .pptx，单个文件最大 200 MB」（同底部面板，不写「从电脑」与「拖到这里」，TB-181）",
      page: onHome({ phase: "pick" }),
    },
    {
      id: "dialog-documents",
      title: "导入对话框（文档列表）",
      host: "documents",
      note:
        "rulings §4.25 DS-140、TB-179、TB-181：同一个对话框叠在文档列表「最近」上（背后同 documents.recent），开始页与文档列表两处入口打开的是同一个对话框：画法、文案、焦点与键盘同 dialog，关闭后回到文档列表、焦点回到顶栏「导入 .pptx」；回收站视图顶栏不放「导入 .pptx」、不接收拖入。" +
        "地址与历史（TB-179，前端 50/02 §2、§9.3）：/import 叠在来路之上（同 /settings，DS-113、TB-118）——从开始页、文档列表打开时地址换成 /import、背后仍是来路页面；关闭（×、Esc、点遮罩、「取消」、失败后的「关闭」）即返回来路；浏览器后退等于关闭：上传中中止直传、解析中调导入取消端点，不留卡片也不留原件（UX-14）。选文件、上传到失败都在同一个 /import 上，不新增历史（TB-129、TB-133 按此修订）。" +
        `${HISTORY}。` +
        "直接打开 /import（书签、新标签页、别人发来的地址，没有来路）：显示文档列表「最近」并打开这个对话框（就是这一态的画面），关闭后留在列表。" +
        "手机与平板直接打开 /import（TB-181，修订 TB-167）：照常显示、不另拦——背后是文档列表的触控形态，手机上是底部面板（dialog-phone）、平板上是这个对话框，导入完成后照常按设备进编辑器的仅查看形态；这些设备的开始页与文档列表不放「导入 .pptx」（DS-87）。上传中刷新后手里没有文件：回到选文件的初始态（这一画面）",
      page: onDocuments({ phase: "pick" }),
    },
    {
      id: "dialog-dragover",
      title: "导入对话框 · 拖入悬停",
      host: "home",
      note:
        "rulings §4.25 DS-141、TB-180：拖着文件悬在对话框上：落区高亮——1px 强调色虚线 + 强调色淡底（--v3-accent-soft，同画布框选的「强调色虚线 + 淡底」；强调色只表达「松开就会接住」），正中两行换成「松开以导入」（13px 600，与开始页、文档列表主区的落区 kit DropOverlay 同一句）·「只支持 .pptx，单个文件最大 200 MB」，「从电脑选择文件…」先收起（焦点若在它上面，先交给对话框本身，拖出后交回，不掉到 body）；常驻播报区念一次「松开以导入」。" +
        "整个对话框接收：拖到对话框外（标题栏、遮罩上）也算进落区、同样高亮，松开即原位进上传中（dialog-uploading）；拖出窗口或按 Esc 取消拖动即恢复原样（dialog）。拖着不止一个文件：落区不高亮，写「一次只能导入一个文件」·「请只拖入一个 .pptx 文件」，松开不接收。" +
        "浏览器在拖动中拿不到文件名（只给类型与个数），所以不写文件名；拖的不是 .pptx 时照样高亮，松开后在框里报「不支持的文件格式」（画法同 dialog-failed-invalid-package，只换文案）。" +
        "与主区落区一致（TB-180）：开始页与文档列表主区的拖入落区（kit DropOverlay）拖入悬停同为强调色虚线 + 淡底；圆角按层级不同——主区落区是页面级大块、与卡片同为 8，对话框里的落区嵌在圆角 12 的框里、取 4（同标杆）。样张里可以真的从桌面拖一个文件进来试",
      page: onHome({ phase: "dragover" }),
    },
    {
      id: "dialog-uploading",
      title: "导入对话框 · 上传中",
      host: "home",
      note:
        "rulings §4.25 DS-140、TB-179、TB-180、TB-182：选好文件（或拖入松开）后对话框原位换成上传：外框不变（560 × 406），底栏出现、虚线框收到 494 × 263 并留着（文件「落进」落区），框正中是与导出对话框「生成中」同一版式的一组（最宽 360、左对齐）——" +
        "文件名一行（20px .pptx 文件类型图标——Tabler file-type-ppt，text-2、只作装饰 aria-hidden，与导出对话框格式行同一套（kit FileTypeIcon，DS-143、TB-182），间距 8 · 文件名 12px 中字重，后跟「· 48.2 MB」text-2）· 阶段文案「正在上传…」在左、「48%」在右（12px / 11px text-2）· 整宽确定态进度条（kit Progress 4px，按字节）；底栏右侧「取消」（对话框里的次按钮：透明底 + 细边，DS-37）。" +
        "文件名一行：放不下时中间省略——开头照常、末尾保留扩展名与它前面 6 个字，完整名进工具提示（title），读屏念全名（TB-95 允许文件名到 255 字；同导出对话框与轻提示的 FileName 件）。" +
        `${DIALOG_CANCEL}。焦点：由「从电脑选择文件…」或拖入松开进来时落在「取消」（换阶段不经过 body）；Tab 只在 ×（「取消导入」）与「取消」之间。读屏：进度条名称「上传进度」带 aria-valuenow，常驻播报区念一次「正在上传「文件名」」，百分比不逐条播报。` +
        "这一阶段不接收拖入（光标显示不可放下，不换文件）。刷新或关闭标签页走浏览器原生离开提示（上传中刷新原件即丢失，回到选文件）。.ppt / .pptm、超过上限与存储已满在申请上传时就被拒（60/15 §3.9 的 415 / 413 / 429），选完直接到对应失败态、不经上传。" +
        "开始页与文档列表主区的拖入落区（home.drop-import、documents.drop-import，kit DropOverlay）松开后直接打开这个对话框的这一阶段（TB-180），焦点落在「取消」，不另画。" +
        "外框随内容收缩（上传时约 210 高、不留虚线框）的做法没有采用：居中时换阶段框体上下跳，改顶部锚定又让选文件阶段不再视口居中（标杆是居中的）",
      page: onHome({ phase: "uploading", percent: 48 }),
    },
    {
      id: "dialog-parsing",
      title: "导入对话框 · 服务端解析",
      host: "home",
      note:
        `rulings §4.25 DS-140、TB-179：上传完成后同一位置的阶段行换成加载行——转圈 + 作业阶段文案（kit LoadingRow；DS-53：不显示百分比，进度条的位置空着、文件名不上下跳），文案按作业 stage 换（60/06 §6.3）：${STAGE_LIST}；后端不给排位，排队时不写前面还有几个（排队中只换这一行文案，不另画）。文件名一行（含 .pptx 图标，TB-182）与虚线框不动，外框不变；换阶段时常驻播报区念一次（加载行本身不再是第二个 status）。` +
        `${DIALOG_CANCEL.replace("中止并关闭对话框", "调 POST /imports/:jobId/cancel（作业转 cancelled、服务端清理原件与产物）并关闭对话框")}。` +
        `解析中刷新：作业照常完成，文档随后出现在列表里。${HISTORY}。确定性错误原位换成失败态（dialog-failed-invalid-package、dialog-failed-quota），瞬时错误给「重试」（dialog-failed-network）；从上传、解析换到失败时，底栏「取消」原位换成「关闭」（同一颗按钮换字），焦点在它上面时留在原位`,
      page: onHome({ phase: "parsing", stage: "parse-slide" }),
    },
    {
      id: "dialog-failed-network",
      title: "导入对话框 · 失败（可重试）",
      host: "home",
      note:
        `rulings §4.25 DS-140、TB-179：可重试的失败在框里原位换成整块状态（kit PanelState，同导出对话框失败态 export.failed）：危险色图标 20 · 标题「导入没有完成」13px 600 · 按原因的第二行（12px text-2，与 03-13 失败表逐句一致：${RETRY_LIST}；只有上传中断 / 离线用离线云图标，其余用警示图标 TriangleAlert）· 次按钮「重试」（在正文里：DS-53「面板整块出错……「重试」是次按钮」，同 export.failed）· 补充说明一行「文件名 · 大小」（单行、中间省略）；role=alert。失败后底栏只有「关闭」（TB-179）。虚线框不再出现（只在接住文件、处理文件时出现）。` +
        "「重试」用还在手里的文件重新走一遍完整导入、原位回到上传中，焦点落在「取消」；上传凭证失效时重试重新申请上传；离线时「重试」留在原位不可用、工具提示「恢复连接后可重试」。×（这一阶段写「关闭」）、Esc、点遮罩、「关闭」关闭对话框，焦点回到顶栏「导入 .pptx」。这一阶段不接收拖入：要换文件先「关闭」（TB-180）",
      page: onHome({ phase: "failed", failure: "network" }),
    },
    {
      id: "dialog-failed-invalid-package",
      title: "导入对话框 · 失败（不是有效的演示文稿）",
      host: "home",
      note:
        "rulings §4.25 DS-140、TB-179：不可重试的确定性错误（format.pptx.invalid_package）：整块状态（PanelState，危险色 FileX2）「无法打开：文件不是有效的演示文稿」+ 建议句「可以在 PowerPoint 中打开并另存一份 .pptx 后再导入」（EM-12 要求每个错误码有建议动作）+ 补充说明「文件名 · 大小」；下方「技术详情」折叠行（kit FoldRow：展开收起同一个按钮、aria-expanded / aria-controls；这一态一出现就展开，最宽 360、窄时随正文收窄）：错误码 · 首个失败部件路径 · traceId（等宽字只给西文）。" +
        "底栏「复制诊断信息」「关闭」（都是次按钮；没有「重试」：同一文件重试结果不变）。「复制诊断信息」复制错误码、部件、traceId、文件名、大小与时间（不含文档内容），结果按 DS-56 写在框内（TB-179）：底栏左侧「✓ 已复制诊断信息」（16px 成功色 CircleCheck + 12px 主文字色，同个人插件面板底栏；关闭对话框前一直留着），常驻播报区念一次，不出轻提示（遮罩会盖住画布轻提示）。" +
        `同一画法只换图标与文案、不另画（03-13「打开失败态」表；原整屏失败页随 DS-140 删去，文案并到这里），底栏都只有「关闭」：${OTHER_LIST}；同属「不支持的文件格式」一类的另有 format.encrypted「${FOLDED.encrypted.title}」·「${FOLDED.encrypted.text}」（锁形文件图标）、format.macro_rejected（.pptm 与改名的含宏文件）「${FOLDED.macro.title}」·「${FOLDED.macro.text}」（不给重试、不给「忽略宏打开」）、format.limit_exceeded「${FOLDED.limit.title}」· 写出被触发的限制名与上限值，如「${FOLDED.limit.text}」（与规模上限的文案不混用）；format.no_document_type「${FOLDED.noDocumentType.title}」只在 SDK 集成出现，底栏另有「复制诊断信息」。其余未归类的码落到第 1 批通用兜底（main-states.open-failed）。内容比正文高（矮视口、200% 缩放）时从上沿排起、正文滚动`,
      page: onHome({ phase: "failed", failure: "invalid-package", detailsOpen: true }),
    },
    {
      id: "dialog-failed-quota",
      title: "导入对话框 · 失败（超出规模上限）",
      host: "home",
      note:
        "rulings §4.25 DS-140、TB-179：规模上限（format.quota_exceeded{dimension, limit, actual}，rulings §4.15 Q5、§4.17 D2）：整块状态（PanelState，危险色 FileWarning）「文档超出规模上限，无法导入」+ 第一项的说明句「共有 236 页，超过每份文档 200 页的上限」+ 固定建议句「可以在 PowerPoint 中把它拆成几份较小的文件后再分别导入」+ 补充说明「文件名 · 大小」；下方「超出项 · 实际值 · 上限」小表（多项逐行，按 文件大小 → 页数 → 单页元素 → 总元素 排序，数字右对齐、不着状态色，数值读部署配置 scale.*，不写死）。" +
        "底栏只有「关闭」：不提供重试、「以只读打开」或「只打开前 200 页」。超过 200 MB 的在申请上传时就被拒（413），选完文件直接到这一态、不经上传",
      page: onHome({ phase: "failed", failure: "quota" }),
    },
    {
      id: "dialog-phone",
      title: "导入对话框 · 手机底部面板（< 640）",
      host: "home",
      note:
        "rulings §4.25 DS-140、TB-181（修订 TB-167）：手机（< 640，视口 390 × 844）上同一个导入是贴底的底部面板——kit BottomSheet（偏好设置手机形态 settings.phone 同一个件，TB-118；2026-10-23 由 settings 场景并入底座）：贴底、上圆角 12、1px 上边、panel 底、浮层阴影，顶部把手 40 × 4，标题行 48「导入」+ 右侧关闭 44（触控命中区），上沿离视口顶至少 24、高度随内容。" +
        "手机没有拖放：不画虚线框与「拖到这里」一句，只留粗体一行「把 PowerPoint 演示文稿带进 Cordex」· 说明「只支持 .pptx，单个文件最大 200 MB」· 主按钮「选择文件…」（44 高、整宽、不写「从电脑」，TB-181），面板贴底单手可及。" +
        "上传、解析与失败在同一个面板里原位切换：正文同对话框（导出「生成中」版式的文件名与进度——文件名前同样有 .pptx 图标，TB-182——与整块状态），对话框底栏的按钮改为面板里竖排、整宽、44 高（「取消」「关闭」在最下）；上传与解析中关闭按钮的读屏名写「取消导入」、点遮罩不关闭（kit BottomSheet dismissOnOutside，TB-180）。" +
        "入口：手机与平板的开始页、文档列表不放「导入 .pptx」（DS-87），只有直接打开 /import（TB-181）会到这里——背后是文档列表「最近」的手机形态（与开始页手机形态同一套画法；documents 场景没有单画手机形态，样张用 home.phone 那一版代替）。" +
        "焦点同 settings.phone：打开时落在面板本身（读屏念标题），关闭后回到顶栏「显示导航」；读屏的播报同 dialog（常驻播报区）。导入完成后照常按设备进编辑器的仅查看形态（TB-181）。形态按视口宽度判（< 640），样张用状态数据 form: sheet 指定（同 settings.phone）。样张里点「选择文件…」可看上传中",
      page: onPhone({ phase: "pick", form: "sheet" }),
    },

    /* ---------------------------------------------------------------- 打开（DS-99）与大文件提示 */
    {
      id: "snapshot-opening",
      title: "打开服务端文档 · 协同快照",
      note: "rulings §4.25 DS-99：导入成功后进编辑器、或从开始页 / 文档列表打开服务端文档，M2 起都以协同快照打开（rulings §4.18 CO-12，不经 Worker 分批）——编辑器外壳照常画出、全部不可用（同第 1 批 main-states.opening：同步状态行「正在打开…」，左栏「新建幻灯片」与视图切换、工具条、检查器写「文档打开后可用」，头像组不出现）；左栏还没有缩略图、检查器「设计」页签是空的、缩放读数「—」；画布列中央一行「转圈 · 正在打开… · 取消」（进度与「取消」在画布上，同第 1 批口径；没有百分比：快照一次装载）。不画版式骨架（快照一到就是完整内容，骨架只会闪一下）；超过 300 ms 才出现这一行（DS-53），快照到达后直接出完整编辑器，有差异时再出第 2 批的保真轻提示（fidelity.default）。「取消」回到文档列表（03-13 打开进度表；导入对话框里的取消见 TB-179，与这里无关）。未采纳的整屏阻断布局见 alt-open-blocking",
      editor: {
        ...OPENING_SHELL,
        rail: { ...OPENING_SHELL.rail, list: () => <RailList>{null}</RailList> },
        inspector: { ...OPENING_SHELL.inspector, body: <></> },
        regions: { stage: () => <SnapshotOpeningStage /> },
      },
    },
    {
      id: "large-file",
      title: "本地打开 · 大文件提示",
      note: "03-13「大文件提示」（> 50 MB 或 > 100 页，打开开始时判定）：只在本地字节 / SDK 的渐进打开里出现（与第 1 批 main-states.opening 同一画面），进度行原样，下方另起一行「文件较大，首屏渲染完成后其余页面将继续加载」（12px 次级文字、居中；不并进进度行，行宽不随文案跳动）。参考应用的服务端导入在上传时不知道页数、协同快照一次装载，都不出这句。M1（OF-03）",
      editor: { ...OPENING_SHELL, deck: OPENING_DECK, slideOverlay: <LargeFileRow /> },
    },
    {
      id: "thumbs-virtualized",
      title: "200 页文档 · 缩略图虚拟化",
      note: "03-13 G-05（PRD OF-15，M1 P0）：PRD 07 G-05 列的缩略图状态里只剩「占位」没画（生成中的版式骨架、警示与评论角标、隐藏页、当前页、多选第 1、2 批已画）。200 页文档里左栏只为视口附近的页生成缩略图（overscan 与同时挂载的上限以前端 50/10 §6 为准：overscan 6、同时挂载 ≤ 12 项，rulings §4.25 TB-135；03-13 G-05 同此，原写的「±10 项」作废），其余页滚进视口时才生成，生成超过 300 ms 才显示占位（50/10 §6）——与缩略图同尺寸的中性块（panel-2，同第 1 批母版视图加载中的占位块，DS-53 豁免的同一画法），不画转圈与文字（一栏几十个转圈太吵）；页码照常在左侧，读屏名照常「第 123 页」（可访问树不随虚拟化裁剪，50/05 §11），点它照常翻到那一页；取代 03-13 旧写的「灰块 + 页码」。画的是用跳页提示条（03-20 §7）从第 2 页转到第 120 页之后：画布与第 118–121 页的缩略图已生成，刚滚进视口上下两端的页还是中性块。演示：第一次点按、按键或滚轮之后约 0.4 秒生成视口上下约 6 页；继续滚动，新滚进来的页先是中性块，停下约 0.4 秒后换成缩略图。文档是示例文档 6 页 + 194 页附录「客户回款明细」（示例数据）",
      editor: {
        deck: BIG_DECK,
        slide: BIG_CURRENT,
        stage: { cursor: false },
        rail: { list: (ctx) => <VirtualRail ctx={ctx} /> },
      },
    },

    /* ---------------------------------------------------------------- 媒体与外链的零散态 */
    {
      id: "media-unsupported",
      title: "媒体 · 放不了的格式与在线视频",
      note: "03-13 G-06 媒体查看态（M2）：左边是 .wmv 原片——浏览器放不了的编码（wmv / avi）或 DRM：海报帧照常显示，左上角一枚中性提示签「此格式无法在浏览器中播放」（kit CanvasTag：界面件、跟随界面主题、不进缩略图），没有播放按钮，仍可选中、移动、缩放、删除，导出时原样写回；右边是在线视频（视频网站页面链接）：只显示文档里的海报帧 + 居中「在新标签页打开」（不在页面里嵌入第三方播放器；工具提示与读屏名写域名）。能播放的视频仍是第 1 批 image-editing.video-poster 的居中播放按钮。外链音视频（TargetMode=External）按 externalResources：auto 直接可播（preload=none）、confirm 时播放前确认来源域名（第 2 批 fidelity.external-confirm 同一套）、never 同下一态",
      editor: {
        deck: MEDIA_DECK,
        slide: 7,
        stage: { cursor: false },
        slideOverlay: (ctx) => (ctx.slide === 7 ? <MediaOverlay /> : null),
      },
    },
    {
      id: "external-never",
      title: "外链 · 管理员禁止加载",
      note: "03-13 外链资源表 externalResources = never（部署配置）：外链图片原位两行占位（底座 DegradedPlaceholder，与保真占位同一画法）「外部内容已被管理员禁止加载」┊「cdn.example.com」，没有「加载」；缩略图角标与保真报告照常把它算作以占位显示（左栏第 7 页警告角标 1，诊断原因 external-resource-blocked）；第一次进入这一页时出第 2 批的页级提示条（DS-51，约 5 秒淡出，这里画的是淡出之后）。同一画法只换文案、不另画：auto 下外链图片加载失败「外部图片无法加载」┊ 域名；非 http(s) 的外部链接「不支持的外部链接」",
      editor: {
        deck: EXTERNAL_DECK,
        slide: 7,
        stage: { cursor: false },
        rail: {
          list: (ctx) => (
            <RailList>
              {ctx.deck.map((s) => (
                <RailThumb key={s.n} slide={s} current={s.n === ctx.slide} onPick={ctx.goTo} warn={s.n === 7 ? 1 : undefined} />
              ))}
            </RailList>
          ),
        },
      },
    },
    {
      id: "emf-rasterizing",
      title: "EMF 图片 · 正在生成预览",
      note: "03-13 EMF / WMF 按需栅格化（OF-07，M2 P1）：栅格化模块在后台惰性加载期间，原位是纸面占位——虚线框 + 转圈（只在 motion-safe 下转）+「正在生成预览…」+「EMF 流程图，完成后自动显示」，与保真占位同一画法（DegradedPlaceholder，缩略图同一份渲染），取代 03-13 旧写的「骨架（呼吸动效）」；完成后原位换成图片，不移动、不弹提示（演示：第一次点按或按键后约 2 秒换成流程图）。不用第 1 批图片「上传中」的占位：那是界面层、带「取消上传」，栅格化不是用户发起的操作、没有取消。栅格化失败或超出 OF-24 上限时换成保真占位「EMF 图片无法预览」┊「图片过大或过于复杂，内容已保留」",
      editor: { deck: EMF_DECK, slide: 7, stage: { cursor: false }, canvasOverlay: <EmfRasterizer /> },
    },

    /* ---------------------------------------------------------------- 未采纳的备选（DS-63） */
    {
      id: "alt-dialog-dash-control",
      title: "未采纳 · 落区虚线用控件边界色",
      host: "home",
      note:
        "未采纳（DS-141 定为安静虚线：落区静止时与分隔线同档 --v3-border，见 dialog）：虚线用 --v3-border-control（暗 #858585 / 亮 #8A8A8A，对 panel ≥ 3:1）——设计 04 §2 原写的「虚线落区（上传占位）用控件边界色」；与标杆同尺寸并排实测，比标杆的 #444 亮约一倍，框线压过正中的字与按钮。" +
        "其余同 dialog（尺寸、文案、焦点与拖放）；点「从电脑选择文件…」之后各阶段的虚线框同样用这个颜色，拖入悬停仍是强调色虚线加淡底",
      page: onHome({ phase: "pick", dash: "control" }),
    },
    {
      id: "alt-dialog-entry-only",
      title: "未采纳 · 只把入口换成对话框",
      host: "home",
      note:
        "未采纳（DS-140 定为导入全程在对话框里，见 dialog 起各态）：开始页与文档列表顶栏的「导入 .pptx」打开同一个「导入」对话框，画面、尺寸、焦点与拖入同 dialog；区别在选好文件之后——对话框关闭，进入整屏导入过渡页（DS-97 维持全屏、不带应用壳），上传、解析与失败照旧在整屏阻断页上。" +
        "这一种当时的口径（只作记录）：改 DS-98（入口改对话框，整屏导入页作废）、TB-133（过渡页的「取消」等同浏览器后退，回到打开导入对话框之前的那一页，删去导入页自己的出口）与 TB-167（手机与平板直接打开 /import 显示这个对话框，手机上是底部面板）；DS-97、TB-129 不变。" +
        "代价：选完文件整屏换一次，上传与解析期间看不到原页面，进度与失败的画法与入口不是同一套（入口是对话框、后面是整屏阻断页）。" +
        "整屏过渡页与失败页已随 DS-140 删去，样张不再演示后半程：点「从电脑选择文件…」（或拖入松开）只关闭对话框、焦点回到顶栏「导入 .pptx」",
      page: onHome({ phase: "pick", entryOnly: true }),
    },
    {
      id: "alt-open-blocking",
      title: "未采纳 · 快照打开用整屏阻断页",
      note: "未采纳（DS-99 定为编辑器外壳照常、全部不可用、画布中央转圈，见 snapshot-opening）：协同快照打开期间不画编辑器外壳，整屏阻断布局只放转圈（32）、文档名、「正在打开…」与「取消」，快照到了再出整个编辑器（整屏换一次）",
      editor: OPENING_BLOCK,
    },
  ],
})
