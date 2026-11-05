import type { ReactNode } from "react"
import { SHARE_LATER } from "../../kit"
import { defineScenario, type EditorConfig } from "../types"
import { FailedBanner, MissingManyBanner, MISSING_DECK, missingRail, PluginBannerQueue, ReloadSavingBanner } from "./banners"
import { degradedOverlay, QR_DEGRADED, QR_DEGRADED_RESIZABLE } from "./degraded"
import { MORE_ITEMS, MoreFew, MoreMany, MoreOneSub } from "./more"
import { pollInspectorRegion, pollOverlay, pollTabRegion, POLL_DECK, POLL_FAILED_DECK } from "./poll"
import { PluginsDialogHost, PluginsMenuLayer, PluginsTakeover, PluginsToasts } from "./PluginsPanel"
import { SECTIONS_EXPANDED, SECTIONS_FEW, SECTIONS_MANY } from "./sections"
import type { PluginsData } from "./store"

/**
 * plugins：插件在 v3 编辑器里的呈现（第 2 批 · 协作族）。
 *   1. 个人插件面板（03-09 全部状态，PRD 09 PM-10…PM-12、04 PS-11 / PS-13）：入口主菜单「插件…」（DS-18、DS-21）与插件横幅「查看详情」；
 *      居中对话框（DS-38）；未采纳的备选是检查器整栏面板（alt-takeover*）。
 *   2. 插件整页面板作为检查器页签的呈现（06 §2.2 ui.panel slot 'inspector'）：整栏面板（同 DS-26，DS-38），未采纳的备选是第三个页签（alt-panel-tab）。
 *   3. 插件条目很多时的收纳（rulings §4.25 TB-31、DS-49）：工具条「更多」（06 §2.6）与检查器插件分区（06 §2.12）。
 *   4. 缺插件元素被选中时的检查器（PM-12）。
 * 第 1 批 main-states 的插件横幅（plugin-missing*、plugin-settings、plugin-failed）是本场景的入口，文案逐字一致；这里把「查看详情」接上面板。
 * 画法按 rulings §4.25 DS-41 是中性底 + 状态色图标（kit PluginBanner，第 1 批那几条横幅是同一个件，见 banners.tsx）。
 * 行为与文案以 03-09、06 为准；视觉按 v3（rulings §4.25 DS-1…DS-37）。同目录：data（演示数据）、store（场景状态）、PluginList（面板内容）、
 * PluginsPanel（对话框 / 整栏面板 / 主菜单接线）、banners、degraded、poll（插件整页面板）、more（「更多」收纳）、sections（插件分区收纳）。
 */

/** 每个状态的浮层：个人插件面板的对话框宿主常驻（接住底座主菜单「插件…」的命令；横幅「查看详情」随时能打开），再加状态自己的浮层 */
const layers = (extra?: ReactNode) => (
  <>
    <PluginsDialogHost />
    {extra}
  </>
)

const data = (d: PluginsData & Record<string, unknown>) => d

/** 投票示例页（第 6 页）上选中投票元素：画布可点选、检查器整栏面板随场景状态开关 */
const POLL_BASE: EditorConfig = {
  deck: POLL_DECK,
  slide: 6,
  selection: "plugins-poll",
  slideOverlay: pollOverlay,
  regions: { inspector: pollInspectorRegion },
}

export default defineScenario({
  id: "plugins",
  title: "插件",
  specs: ["03-09"],
  batch: 2,
  summary: "个人插件面板（对话框 / 整栏面板）、插件整页面板、「更多」与检查器插件分区的收纳、缺插件与插件横幅",
  // 别的样张里选主菜单「插件…」（那里没有场景接住 plugins）：转到个人插件面板打开着的状态，不静默无响应（ED-30）——编辑模式 default，
  // 评审、只读浏览是只读角色的同一个面板（readonly，03-09 §4.5）；关闭后焦点回主菜单按钮
  provides: { plugins: { edit: "default", review: "readonly", viewer: "readonly" } },
  editor: {
    // 画布照常画示例文档的评论钉（底座 stage.commentPins：第 4 页 3 枚，点钉切到「评论」页签）——rulings §4.25 DS-43「编辑模式照常显示评论钉」（第 1 批编辑态停在第 4 页的画面同样用这个参数补了钉）
    stage: { cursor: false, commentPins: true },
    canvasOverlay: () => <PluginsToasts />,
    layers: layers(),
  },
  states: [
    /* ---------------------------------------------------------------- 个人插件面板（DS-38：对话框） */
    {
      id: "default",
      title: "个人插件面板",
      note: "03-09 §2–§3：居中对话框 640（kit lg），标题「插件」+ 说明 + 计数行（运行中 15 · 等待依赖 1 · 未加载 1）；我的界面插件（M3，开关）在上，本部署统一启用（由管理员统一，只读）在下，等待依赖的行排最前、核心组件合成一行；分组不套卡片，行与行之间不画线（靠图标与行距分行，行距 55 不变，悬停铺浅底），组与组之间一条贴边的 1px 分隔（标杆对照「密度：行间分隔线」，同分享、版本历史的列表）；正常态不着色。对话框固定高 720（视口不够时取视口高减 64，与内容无关），列表在框内滚动——加载、出错与各状态同高，打开后、数据到了都不跳。插件 id 一律写 cordis 插件 id，与管理页一致（rulings §4.25 TB-121、§4.24 TA-5：comments、kernel…；model-slide、ooxml-pptx 写 @cordexjs/…；核心组件一行展开后逐行「id@版本」；2026-10-22 改：原写包名 @cordexjs/kernel 等）",
      editor: { data: data({ pOpen: true }) },
    },
    {
      id: "entry-menu",
      title: "入口 · 主菜单「插件…」",
      note: "DS-18、DS-21：主菜单顶层「插件…」（排列 ▸ 之后、帮助 ▸ 之前，上下各一条分隔线）打开个人插件面板；评审、只读浏览与降权时照常可用。选它即打开对话框，关闭后焦点回主菜单按钮",
      editor: { layers: layers(<PluginsMenuLayer />) },
    },
    {
      id: "failed",
      title: "启动失败 · 详情与重试",
      note: "03-09 §4.1 / §4.3（从「2 个插件启动失败」横幅的「查看详情」进入；横幅中性底 + 危险色图标（DS-41；不阻断，role=status），第 1 批 main-states.plugin-failed 是同一个件）：现场投票（内容级）与演示激光笔（界面级）启动失败、甘特图本会话版本不兼容（危险组的八角形图标，不与警告三角、「已关闭」的圆圈斜线同形；说明行直接写原因，不重复状态名），排在各组最前（「我的界面插件」组 2026-10-15 按 rulings §4.25 TB-78 补上同一排序：演示激光笔由第 2 行排到第 1 行）；第一条失败行展开详情（贡献、能力声明、错误码 kernel.plugin_failed 与阶段「启动」、traceId、复制诊断信息；错误码按架构 30/10 的登记，启动与贡献失败同一个码、阶段另写一行，TB-77；「复制诊断信息」复制四行：插件 id（cordis 插件 id，TB-121）、错误码、阶段 activate / contribution、traceId，TB-96）；重试任何人可用，界面级另有「为我关闭」，内容级写「仅在本会话重试；如持续失败，请联系管理员」",
      editor: { banner: <FailedBanner />, data: data({ pOpen: true, pFail: true, pExpanded: ["beta:live-poll"] }) },
    },
    {
      id: "failed-admin",
      title: "启动失败 · 管理员视角",
      note: "03-09 §2.1、§4.1：平台管理员视角。「去管理 › 插件」（ghost 按钮，不用强调色链接）整个对话框只留一个，在计数行右端——它紧挨着「启动失败 2 · 版本不兼容 1」这组计数，管到面板里所有的问题，missing-detail 等管理员视角的状态也在这个位置；内容级失败行原来另有一颗同名同去处的按钮，按质量门 Q2（同一操作只留一个入口）去掉，行尾改为与「本文档缺少的插件」行同一个 24px 深链图标「在管理页查看「现场投票」」（离问题最近，直达这个插件的管理详情）。失败行的说明对管理员写「仅在本会话重试；如持续失败，请在管理页查看」，版本不兼容的说明结尾同样是「请在管理页查看」",
      editor: { banner: <FailedBanner />, data: data({ pOpen: true, pFail: true, pAdmin: true }) },
    },
    {
      id: "retrying",
      title: "重试中",
      note: "03-09 §4.1：点「重试」后按钮变为 spinner +「重试中…」，面板里其余重试、为我关闭与开关临时不可用（仍可聚焦、写原因）；成功后底栏写「『现场投票』已在本会话恢复运行」并经 polite 播报（点「重试」可现场演示）。横幅画法同 failed（DS-41）",
      editor: { banner: <FailedBanner />, data: data({ pOpen: true, pFail: true, pRetrying: "beta:live-poll" }) },
    },
    {
      id: "user-off",
      title: "为我关闭「演示激光笔」",
      note: "03-09 §5：开关即时生效（本会话卸载，无需刷新），行状态「已关闭」、图标退到 text-3、副标题追加「· 你已关闭」；对话框底栏写反馈与「撤销」——模态遮罩会盖住画布轻提示，所以对话框形态的反馈放底栏（整栏面板形态用轻提示，见 alt-takeover）",
      editor: { data: data({ pOpen: true, pOff: ["cordex:presenter-laser"], pFeedback: { kind: "toggle", id: "cordex:presenter-laser", on: false } }) },
    },
    {
      id: "toggle-failed",
      title: "开关保存失败",
      note: "03-09 §5、50/18 PLG-02：选择随账号存到服务端；保存失败时开关回弹（本会话按原值重新装配），底栏写失败原因（危险色图标），再拨一次开关即重试；整栏面板形态同一句走错误轻提示",
      editor: { data: data({ pOpen: true, pFeedback: { kind: "save-failed", id: "cordex:word-count", on: false } }) },
    },
    {
      id: "conflict",
      title: "快捷键冲突 · 可为我关闭",
      note: "03-09 §4.4（从快捷键面板冲突条目进入，PM-11）：顶部说明行（kit InspectorNotice：面板底、1px 下分隔，状态色只给键盘图标，sticky）写明冲突键、双方与当前生效的一方；聚焦搜索这一行是当前项的画法（强调色淡底、圆角 6、左右内缩 8，同保真报告的当前项，进入时滚进视区），行内警告色图标 +「与内置「缩小」冲突（⌘−）」+「为我关闭」（关闭后不可用）；不提供改键",
      editor: { data: data({ pOpen: true, pConflict: "user" }) },
    },
    {
      id: "conflict-locked",
      title: "快捷键冲突 · 请联系管理员",
      note: "03-09 §4.4：冲突一方是内容级插件（流程图形状包，⌥⌘M 与内置「母版视图」冲突），说明行改写为「请联系管理员」，当前项一行不出现「为我关闭」",
      editor: { data: data({ pOpen: true, pConflict: "locked" }) },
    },
    {
      id: "readonly",
      title: "只读角色（查看者）",
      note: "03-09 §4.5：计数行末尾「只读：编辑类命令不可用」；声明了写能力位命令的插件（评论、数据图表增强、流程图形状包、现场投票）行内注明「编辑类命令不可用（你只有查看权限）」，照常运行；我的界面插件的开关照常可用（个人启停与文档权限无关）",
      editor: { mode: "viewer", data: data({ pOpen: true }) },
    },
    {
      id: "no-optional",
      title: "管理员未开放可选插件",
      note: "03-09 §7：「我的界面插件」分组连标题一起隐藏，顶部一行（锁图标）「可选插件由管理员设置：本部署目前没有开放给个人开关的插件」；本部署统一启用照常（是第一组，顶部不画分隔线）。对话框与其他状态同高（固定 720，列表变短不改变框高）",
      editor: { data: data({ pOpen: true, pNoOptional: true }) },
    },
    {
      id: "m2",
      title: "M2 · 开关未开放",
      note: "03-09 §3 / PRD 09 §4：M2 只有只读、诊断与重试；我的界面插件的开关留在原位、不可用（aria-disabled、可聚焦），工具提示「M3 提供」，分组标题带 M3 标记；「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）",
      editor: { inspector: { share: SHARE_LATER }, data: data({ pOpen: true, pM2: true }) },
    },
    {
      id: "missing-detail",
      title: "本文档缺少的插件（管理员）",
      note: "03-09 §6.2 / §6.3：同时缺 3 个插件时横幅写「本文档用到了 3 个当前不可用的插件」；「查看详情」打开面板，「本文档缺少的插件」分组置顶，三种原因各一行（管理员已停用 / 本部署没有此插件 / 版本过旧），行尾原因 + 管理员的「去管理 › 插件」；数据图表增强同时出现在两组（缺 ≥ 1.5、本部署 1.4.2 运行中，§9）；缩略图第 5、6 页警示计数。缺少插件横幅是中性底 + 警告色拼图（DS-41，第 1 批 main-states.plugin-missing* 是同一个件）；第 5 页的两个占位是两行字（插件名 + 「本部署未部署，内容已保留」/「需要 ≥ 1.5，内容已保留」，与保真占位同一画法，DS-52）",
      editor: { deck: MISSING_DECK, slide: 6, rail: missingRail, banner: <MissingManyBanner />, data: data({ pOpen: true, pMissing: true, pAdmin: true }) },
    },
    {
      id: "missing-selected",
      title: "缺插件的元素 · 选中",
      note: "PM-12 / OF-13：占位元素可选中、移动、删除，内部不可编辑。选中种类与保真降级同一个 degraded、同一套分区（第 2 批集成统一，说明在最上，同 fidelity.degraded-selected 与第 1 批 chart.readonly-type）：对象说明与第 1 批图表「此类型仅支持查看」同一画法（DS-52）——中性 Info 图标（次级文字色）+「插件「二维码形状」不可用」+ 一句「已被管理员停用，内容已原样保留。」+「查看详情」打开个人插件面板（次按钮带 14px 外链图标，与保真占位「保真详情」、第 1 批图表「保真详情」同一颗：底座 DegradedDetailButton，DS-52「同一画法」）；不再用警告色拼图，也不再写「可以移动或删除，暂不能编辑内部」（画布选中框与右键菜单已经表达）·「位置与大小」能移动，不能改大小与旋转（W / H 留在原位不可用，节末写原因）·「缺少的插件」写 id、原因、所需版本。纸面上的占位是两行字：插件名 +「插件已停用，内容已保留」（原「插件名 / 原因 / 内容已保留」三行，与保真占位统一为图标 + 一行标题 + 一行原因，DS-52；第 1 批 main-states.plugin-missing* 的占位同此改为两行）。画布选中框与检查器一致：不能改大小，所以只有 1px 选中框与尺寸角标、没有缩放手柄（手柄画法由底座 DegradedSelection 一处决定）。三个占位都能点选（右键也先选中被点的那一个，03-05 §2）：选中框跟到哪一个，检查器「位置与大小」就写哪一个的数（X 随列变：125 / 387 / 650 pt，Y、W、H 相同）。缺少插件横幅是中性底 + 警告色拼图（DS-41）。横幅（整份文档缺哪些插件）与检查器（选中的这一个）各有一个「查看详情」、去处相同（个人插件面板）：同屏两处，DS-52 定为两处都留——横幅不能为选中而收起（收起会让画布上下跳 41px），常驻入口仍只有主菜单「插件…」；DS-52 未采纳的选项「检查器不放入口」是横幅还在时检查器只写原因、不放入口（保真那边是一闪而过的页级提示条让位，DS-51）。缺插件占位不能改大小（DS-52），未采纳的另一种答案见 alt-missing-resizable；右键菜单与保真占位同一份，见 missing-menu",
      editor: {
        deck: MISSING_DECK,
        slide: 6,
        rail: missingRail,
        banner: <MissingManyBanner />,
        selection: "degraded",
        slideOverlay: degradedOverlay,
        data: data({ pMissing: true, degraded: QR_DEGRADED }),
      },
    },
    {
      id: "missing-menu",
      title: "缺插件元素 · 右键菜单",
      note: "DS-52（无法显示的对象与缺插件元素共用一套右键）：缺插件的占位与保真占位用同一份「能摆放」菜单（底座 degradedMenuItems，与 fidelity.degraded-menu 同一结构）——剪切 · 复制 · 粘贴 · 原位复制 ┊ 排列 ▸ · 组合（单选不可用，「需选中 2 个以上对象」）┊ 编辑替代文本…（留在原位不可用，「插件不可用时不能修改」）· 添加评论 C ┊ 查看详情 ┊ 删除；没有格式类命令、没有旋转。末组的入口按对象换：保真占位是「查看保真详情」，这里是「查看详情」——打开个人插件面板（「本文档缺少的插件」分组置顶），与检查器「对象说明」的「查看详情」同一个去处。在占位上右键（先选中被点的那一个），或聚焦占位后按 ⇧F10 / 菜单键，都在这一落点打开——菜单贴在占位右缘展开：二维码占位只有页宽约 1/5，落在占位内会压住选中框下方的尺寸角标「186 × 186」（保真占位较宽，菜单仍落在占位内）；关闭菜单、或关闭从「查看详情」打开的面板后，焦点回到这个占位。评审、只读浏览与降权照常出这份菜单，编辑类命令不可用（DS-64，见 fidelity.degraded-menu-review）。替代文本的不可用原因按 DS-52 写「插件不可用时不能修改」。占位、横幅、检查器的画法同 missing-selected（DS-52、DS-41）",
      editor: {
        deck: MISSING_DECK,
        slide: 6,
        rail: missingRail,
        banner: <MissingManyBanner />,
        selection: "degraded",
        slideOverlay: degradedOverlay,
        data: data({ pMissing: true, degraded: QR_DEGRADED, qrMenu: true }),
      },
    },
    {
      id: "alt-missing-resizable",
      title: "未采纳 · 缺插件占位也能改大小",
      note: "未采纳：DS-52 定为推荐（plugins.missing-selected）。DS-52 未采纳的另一种答案：缺插件占位与保真占位一样可以缩放——画布上 8 个缩放手柄 + 尺寸角标，检查器 W / H 可改、带锁定比例；手柄与检查器由底座 DegradedSelection 按同一份 DegradedInfo 决定，不会再出现「画了手柄却不能改大小」；对象说明与推荐同一句「已被管理员停用，内容已原样保留。」（能不能缩放只由手柄与 W / H 表达，DS-52 改写）。对照推荐的 missing-selected（不能改大小：没有缩放手柄）",
      editor: {
        deck: MISSING_DECK,
        slide: 6,
        rail: missingRail,
        banner: <MissingManyBanner />,
        selection: "degraded",
        slideOverlay: degradedOverlay,
        data: data({ pMissing: true, degraded: QR_DEGRADED_RESIZABLE }),
      },
    },
    {
      id: "banner-queue",
      title: "插件横幅的先后 · 关掉缺插件后轮到启动失败",
      note: "50/10 §11 规则 10「启动失败与设置已更新之间的先后，随第 2 批定稿」，rulings §4.25 DS-54 定稿：多类插件横幅同时成立时同一时刻只放一条，按「缺少插件 > 启动失败 > 设置已更新」取第一条没关过的（03-02 §6.2 只写了先显示缺少插件）。这里文档缺 3 个插件（画布占位、左栏第 5、6 页警示计数）、本会话又有 2 个插件启动失败、管理员也刚更新了插件设置：缺少插件的横幅已经关掉，轮到「2 个插件启动失败」；再关掉轮到「插件设置已更新」，本会话里关过的不再出现。缺少插件、启动失败两条横幅都是中性底 + 状态色图标（警告色拼图 / 危险色图标，DS-41）",
      editor: { deck: MISSING_DECK, slide: 6, rail: missingRail, banner: <PluginBannerQueue />, data: data({ pMissing: true, pFail: true, bannerClosed: ["missing"] }) },
    },
    {
      id: "failed-reshow",
      title: "启动失败横幅关掉后 · 又有新失败",
      note: "rulings §4.25 DS-54：v3 没有常驻的插件状态指示（状态栏已废弃，DS-6），启动失败横幅关掉后失败只在主菜单「插件…」里；本会话内只在有新插件进入 FAILED 时横幅再出现一次，只写新失败的插件（这里是「数据图表增强」），之前关掉的两个（现场投票、演示激光笔）不再重复，仍在个人插件面板里（查看详情）。03-09 §9 原写的「状态栏入口优先显示失败数」随状态栏一起作废。只有一个插件失败，横幅标题写名字「插件「数据图表增强」未能启动」、说明行只写「暂时不可用，其余功能照常」（DS-55；原「1 个插件启动失败」是 DS-55 未采纳的写法）；横幅中性底 + 危险色图标（DS-41）",
      editor: { banner: <FailedBanner names={["数据图表增强"]} />, data: data({ pFail: ["beta:live-poll", "cordex:presenter-laser", "acme:data-binding"] }) },
    },
    {
      id: "loading",
      title: "加载中",
      note: "03-09 §7（按 DS-53 改，03-09 原文是骨架行）：头部只有标题与说明（无计数行）；内容区居中一行转圈「插件列表加载中…」（kit LoadingRow，与评论、版本历史、分享同一件，不画灰色骨架条，质量门 Q8）；对话框各状态同一个固定高度（720，视口不够时视口高减 64），加载中一行在框内居中，数据到了框体不跳",
      editor: { data: data({ pOpen: true, pLoad: "loading" }) },
    },
    {
      id: "error",
      title: "加载失败",
      note: "03-09 §7：内容区换成错误态：危险色图标、「插件列表加载失败」、「编辑器本身不受影响；已装配的插件照常运行」+「重试」（对话框与其他状态同高〔固定 720〕、错误态在框内居中；点「重试」后焦点交给列表区，框体不跳）；面板本身的失败不影响编辑器与已装配插件",
      editor: { data: data({ pOpen: true, pLoad: "error" }) },
    },
    {
      id: "reload-saving",
      title: "插件设置已更新 · 正在保存",
      note: "03-09 §6.1（接第 1 批 main-states.plugin-settings）：点「重新加载」后按钮变为 spinner +「正在保存更改…」（先 flush 再刷新，50/02 §12），保存期间 × 收起；刷新完成后轻提示「已重新加载，按新的插件设置装配」",
      editor: { banner: <ReloadSavingBanner /> },
    },

    /* ---------------------------------------------------------------- 个人插件面板（未采纳的备选：检查器整栏面板，DS-38） */
    {
      id: "alt-takeover",
      title: "未采纳 · 面板作整栏面板",
      note: "未采纳：DS-38 定为推荐（plugins.default）。DS-38 未采纳的备选：个人插件面板放进检查器整栏面板（kit InspectorTakeover，DS-26 先例，栏宽 400）。非模态，画布与工具条照常可用，开关的反馈走画布底部轻提示；400 宽下版本与来源并到第二行、插件说明进详情；行间不画线、组与组之间一条贴边分隔，与对话框同一画法。「关闭」/ Esc 收起，主菜单「插件…」再打开；翻到第 4 页点画布上的评论钉时也先收起面板、再切到「评论」页签",
      editor: { inspector: { takeover: <PluginsTakeover /> }, data: data({ pForm: "takeover" }) },
    },
    {
      id: "alt-takeover-failed",
      title: "未采纳 · 整栏面板 · 启动失败",
      note: "未采纳：DS-38 定为推荐（plugins.failed）。DS-38 未采纳的备选方案下最挤的一态：失败行的摘要、重试 / 为我关闭与展开详情（错误码、traceId）都要在 400 宽里排下；与 failed 对照（横幅画法同 failed，DS-41）",
      editor: { banner: <FailedBanner />, inspector: { takeover: <PluginsTakeover /> }, data: data({ pForm: "takeover", pFail: true, pExpanded: ["beta:live-poll"] }) },
    },

    /* ---------------------------------------------------------------- 插件整页面板（ui.panel slot 'inspector'） */
    {
      id: "panel-entry",
      title: "插件分区 · 面板入口",
      note: "06 §2.2 / §2.12：选中插件元素（第 6 页的投票），检查器在内置「位置与大小」之后是插件分区「现场投票」（标题后归属标识，悬停「由「现场投票」（Beta Labs）提供」）：问题 + 一行状态汇总「进行中 · 已进行 12 分钟 · 128 人已投票」，不再列四行结果——结果只在画布上的投票元素里画一份（标杆对照「插件面板内容」）；右下「展开」打开插件的整页面板（同图表「数据」分区的「展开」，DS-26）",
      editor: { ...POLL_BASE, data: data({ pollPanel: false }) },
    },
    {
      id: "panel",
      title: "插件整页面板 · 整栏",
      note: "DS-38：插件整页面板 = 检查器整栏面板（DS-26 先例）。检查器栏由 280 加宽到 400、整栏换成面板，协作行不动；标题行「现场投票」+ 归属说明（第三方插件 · Beta Labs）+「收起到检查器」+「关闭」Esc；面板跟着触发它的元素走，选中别的对象即收起。内容只有问题、参与方式、状态三节：删掉了「实时结果」（四条进度与票数和画布上的投票元素重复，标杆对照「插件面板内容」），「状态」写一行汇总「进行中 · 已进行 12 分钟 · 128 人已投票」+「结束投票」",
      editor: { ...POLL_BASE, data: data({ pollPanel: true }) },
    },
    {
      id: "panel-failed",
      title: "插件整页面板 · 插件失败",
      note: "06 §2.2、§3：面板开着时宿主插件 FAILED——内容区换成「该面板不可用」+ 错误摘要 +「重试」+「如持续失败，请联系管理员」（内容级插件），不整段消失；画布上的投票元素同时降级为占位（插件已启用但本会话启动失败，PM-12；两行字「现场投票」+「插件启动失败，内容已保留」，与保真占位同一画法，DS-52）；横幅中性底 + 危险色图标（DS-41）；只有一个插件失败，横幅标题写名字「插件「现场投票」未能启动」、说明行只写「暂时不可用，其余功能照常」（DS-55；原「1 个插件启动失败」是 DS-55 未采纳的写法）",
      editor: {
        ...POLL_BASE,
        deck: POLL_FAILED_DECK,
        banner: <FailedBanner names={["现场投票"]} />,
        data: data({ pollPanel: true, pollFailed: true, pFail: ["beta:live-poll"] }),
      },
    },
    {
      id: "panel-readonly",
      title: "插件整页面板 · 评审模式",
      note: "06 §2.2 与 DS-15 的统一：评审 / 只读角色下面板顶部一行「只读 · 评审模式下不可编辑」，问题与参与方式只列当前值，状态只写一行汇总（结果只在画布上），「结束投票」等写操作不出现——不加禁用蒙版（06 §2.2 原写法与 DS-15 冲突，按 DS-15）。画布只读：投票元素的选中只画 1px 强调色框，不画手柄与尺寸角标（04 §2.3a、DS-23，同第 1 批 chart.review）",
      editor: { ...POLL_BASE, mode: "review", data: data({ pollPanel: true }) },
    },
    {
      id: "alt-panel-tab",
      title: "未采纳 · 面板作第三个页签",
      note: "未采纳：DS-38 定为推荐（plugins.panel）。DS-38 未采纳的备选：插件整页面板作为检查器第三个页签（设计 · 评论 · 现场投票，标签后带归属图标），常驻在页签行、宽度仍 280；页签就是入口，插件分区里不再有「展开」（质量门 Q2）；页签内容与推荐的整栏同一份（问题、参与方式、状态三节，不列结果）。插件面板一多页签行放不下，要再加溢出菜单",
      editor: { ...POLL_BASE, regions: { inspector: pollTabRegion }, data: data({ pollTab: true }) },
    },

    /* ---------------------------------------------------------------- 「更多」里插件很多时（TB-31） */
    {
      id: "more-few",
      title: "「更多」· 3 个插件（平铺）",
      note: "DS-49（TB-31）规则的上限：插件不超过 3 个、每个不超过 3 条时，每个插件一组平铺（分组标题「〈插件名〉 · 第三方」+ 条目），即第 1 批暂行规则。关掉后再从工具条「更多」打开（点按或 ↵），是同一份条目（toolbar.moreItems）",
      editor: { toolbar: { moreItems: MORE_ITEMS.few() }, layers: layers(<MoreFew />) },
    },
    {
      id: "more-many",
      title: "「更多」· 很多插件（折叠）",
      note: "DS-49（TB-31）：插件超过 3 个（或任一插件超过 3 条）时，插件区改为「插件 · N」小标题 + 每个插件一行「〈插件名〉 ▸」（行首插件图标），条目进子菜单、子菜单顶部仍是归属标题；7 个插件只占 8 行，内置项位置不变。主菜单「插入」末尾的插件分组用同一规则。关掉后再从工具条打开是同一份条目（子菜单不自动展开）",
      editor: { toolbar: { moreItems: MORE_ITEMS.many() }, layers: layers(<MoreMany />) },
    },
    {
      id: "alt-more-one-sub",
      title: "未采纳 ·「更多」收进一个子菜单",
      note: "未采纳：DS-49 定为推荐（plugins.more-many）。DS-49 未采纳的备选：全部插件收进一个「插件 ▸」子菜单，里面按插件分组平铺——「更多」一级菜单最短，但任何插件条目都要多一层，插件多时子菜单本身也很长。关掉后再从工具条打开是同一份条目",
      editor: { toolbar: { moreItems: MORE_ITEMS.oneSub() }, layers: layers(<MoreOneSub />) },
    },

    /* ---------------------------------------------------------------- 检查器插件分区很多时（TB-31） */
    {
      id: "sections-few",
      title: "检查器 · 2 个插件分区",
      note: "06 §2.12：插件分区排在内置分区之后，节标题后带归属标识；同一选中对象的插件分区不超过 2 个时照常展开（示例：第 4 页无选中，数据图表增强「数据刷新」、元数据标签「页面标签」）。画布照常画第 4 页的 3 枚评论钉（DS-43「编辑模式照常显示评论钉」：场景级参数 stage.commentPins，点钉切到「评论」页签）",
      editor: { slide: 4, inspector: { sections: SECTIONS_FEW } },
    },
    {
      id: "sections-many",
      title: "检查器 · 很多插件分区（折叠）",
      note: "DS-49（TB-31）：插件分区超过 2 个时全部默认折叠为一行（标题 + 归属 + ▸），点标题行展开，展开状态按分区记在本机；内置分区的位置与长短不随插件数量变化。画布照常画第 4 页的 3 枚评论钉（DS-43「编辑模式照常显示评论钉」：场景级参数 stage.commentPins，点钉切到「评论」页签）",
      editor: { slide: 4, inspector: { sections: SECTIONS_MANY } },
    },
    {
      id: "alt-sections-expanded",
      title: "未采纳 · 插件分区全部展开",
      note: "未采纳：DS-49 定为推荐（plugins.sections-many）。DS-49 未采纳的备选：维持暂行规则——插件分区全部展开、检查器内容区纵向滚动；插件一多，内置分区之后要滚很久，插件分区也容易被误当成内置属性。画布照常画第 4 页的 3 枚评论钉（DS-43「编辑模式照常显示评论钉」：场景级参数 stage.commentPins，点钉切到「评论」页签）",
      editor: { slide: 4, inspector: { sections: SECTIONS_EXPANDED } },
    },
  ],
})
