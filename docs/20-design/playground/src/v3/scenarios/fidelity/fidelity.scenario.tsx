import { LoaderCircle } from "lucide-react"
import { MainMenuLayer, RailStatus } from "../../kit"
import { defineScenario } from "../types"
import { ReportBanner, ReportDialog, StatusWithIndicator } from "./alternatives"
import { DegradedMenuLayer, FidelityCanvasLayer, FidelitySlideLayer, ThumbList } from "./canvas"
import { deckFor } from "./slides"
import { ReportPanel } from "./ReportPanel"

import { Viewer } from "../viewer/shell"
import { ViewerSummary } from "./viewer"
import { CHARTEX_DEGRADED } from "./inspector"

/**
 * fidelity：03-10 导入保真报告 + 03-13 与保真相关的降级渲染与入口（第 2 批 · 协作族，rulings §4.25 DS-8）。
 * 视觉按 v3（DS-1…DS-37），行为与文案按 03-10、03-13、PRD OF-05 / OF-09 / OF-13 / OF-17、50/25；导入进度本身属第 3 批，不在这里。
 *
 * 已定方案（主状态，rulings §4.25 DS-38、DS-51、DS-52）：
 * - 报告是检查器整栏面板（kit InspectorTakeover，DS-26 先例；宽度沿用检查器 280、不加宽，与版本历史一致）：画布始终可见、不跳动，「定位」跳页并在画布上短暂高亮，看完一条接着看下一条；不做模态对话框（alt-dialog）。
 * - 入口：主菜单「文件 › 保真报告」是常驻入口（Q2 入口唯一）；打开文档后有差异时出一次轻提示「查看」（不走横幅，alt-banner）；不另设常驻角标（alt-indicator）。
 *   上下文入口：页级提示条「查看详情」（按本页过滤）、选中无法显示的对象时检查器「保真详情」、右键「查看保真详情」、双击后的说明、受限字体轻提示「详情」——都打开同一个面板。
 * - 降级三层（03-13）：元素级占位（纸面上的虚线框 + 类型图标 + 一行标题 + 一行原因，与缺插件占位同一画法，底座 DegradedPlaceholder）·
 *   页级提示条（画布顶部居中的浮动胶囊，不推挤画布；本会话每页第一次进入时出现、约 5 秒后淡出，DS-51）· 缩略图角标。
 * - 状态色只给报告条目图标与缩略图角标（无法解析 danger、以占位显示 warning）；打开后的轻提示、页级提示条、检查器的对象说明一律中性图标
 *   （整页无法解析的提示条与轻提示例外，用危险 / 错误色）；文字一律 --v3-text / --v3-text-2；完全保真、已同步这类常态不着色。
 *
 * 同目录：data（条目全集与坐标）、slides（第 7、8 页与各变体的文档）、store（场景状态与主菜单事件桥）、ReportPanel（面板与正文）、
 * canvas（轻提示、页级提示条、占位的选中与右键、定位高亮、缩略图角标）、inspector（degraded 检查器分区）、viewer（查看器 ⓘ 摘要）、alternatives（未采纳的备选画法，DS-63 留作对照）。
 */

/**
 * 检查器：报告是状态声明的整栏面板（inspector.takeover，kit InspectorTakeover 的用法 1）——缺省收着（takeoverOpen: false），
 * 轻提示「查看」、主菜单「文件 › 保真报告」（底座命令 file.fidelity）、页级提示条、检查器「保真详情」、右键都用 useTakeoverOpen 打开；
 * 一出现就开着的状态写 inspector: REPORT_OPEN。协作行随状态的 inspector 配置（TakeoverHost）。
 */
const REPORT_OPEN = { takeoverOpen: true }

const SI = { size: 12, strokeWidth: 1.75, "aria-hidden": true } as const

export default defineScenario({
  id: "fidelity",
  title: "保真报告",
  specs: ["03-10", "03-13"],
  batch: 2,
  summary: "打开后的差异提示、检查器整栏的保真报告（按类型分组、定位到页与对象、按本页过滤）、无法显示的对象与页级提示、完全保真与解析失败、查看器 ⓘ 摘要",
  // 别的样张里选主菜单「文件 › 保真报告」（那里没有场景接住 file.fidelity）：转到报告打开着的状态，不静默无响应（ED-30）——编辑模式 report，
  // 评审、只读浏览是同一份报告（viewer-role，03-10 报告对所有角色一致）；焦点进面板，关闭后交回主菜单按钮（arrivedVia）
  provides: { "file.fidelity": { edit: "report", review: "viewer-role", viewer: "viewer-role" } },
  editor: {
    deck: deckFor("main"),
    slide: 1,
    // 画布照常画示例文档的评论钉（底座 stage.commentPins：第 4 页 3 枚，点钉切到「评论」页签；报告开着时先收起报告再切）——rulings §4.25 DS-43「编辑模式照常显示评论钉」（第 1 批编辑态停在第 4 页的画面同样用这个参数补了钉）
    stage: { cursor: false, commentPins: true },
    rail: { list: () => <ThumbList /> },
    inspector: { takeover: <ReportPanel />, takeoverOpen: false },
    canvasOverlay: () => <FidelityCanvasLayer />,
    slideOverlay: () => <FidelitySlideLayer />,
    layers: (ctx) => <DegradedMenuLayer staticOpen={!!ctx.data.menuOpen} />,
    // 选中瀑布图占位时检查器的内容（底座 degraded 分区，editor/inspector/degraded.tsx）：任何状态里点选它都能看到
    data: { variant: "main", degraded: CHARTEX_DEGRADED },
  },
  states: [
    /* ---------------------------------------------------------------- 入口与报告 */
    {
      id: "default",
      title: "打开后有差异 · 轻提示",
      note: "03-10「入口……不默认弹出打断用户」/ PRD 07 D4「首次打开时角标高亮」在 v3 的落点：首屏完成、报告生成后，有差异时在工具条上方出一次轻提示「9 项内容与原文件不同 · 1 项以占位显示；内容都已原样保留 · 查看」，图标一律中性 Info（次级文字色）：有以占位显示的内容也不用警告色，警告色只留在缩略图角标与报告条目图标上（标杆对照「打开后的轻提示：图标颜色」，质量门 Q3）；整页无法解析时才用错误色「第 8 页内容无法解析」。不走横幅（03-12 的横幅只给数据安全与连接）；看过报告或关掉提示即算已读，同一文档有新差异前不再出（每用户本地，不同步给他人）。左栏第 7 页带警告色角标（03-13 缩略图级）",
      editor: { data: { toast: "open" } },
    },
    {
      id: "report",
      title: "保真报告 · 检查器整栏面板",
      note: "03-10 默认态：检查器整栏换成报告（InspectorTakeover，宽度沿用检查器 280、不加宽，画布不跳动；协作行不动，标题行「保真报告 · 导入自 Q2 业绩汇报-终版.pptx」+ 关闭 Esc）。概要只有一行「9 项差异 · 涉及 8 页 · 1 项以占位显示」（放不下按词组换行）+「内容都已原样保留，导出时一并写回」，不再单独一行带警告色三角（标杆对照「报告概要的颜色」）；范围「全部 · 本页」；按类型分组（图表 · 图形与对象 · 动画与切换 · 外部内容 · 字体），每类一行、同类合并计数。每条压回 03-10 线框的两段（标杆对照「报告条目的密度」）：第一行「类型图标 · 名称 · 计数」，右端「定位」；第二段是支持级措辞（照抄 03-10 条目全集），页码接在后面「… · 第 8 页」（放不下时页码整段换到下一行，「·」留在上一行末尾）；字体条目的对照在两段之间；条目上下内边距 6、没有单独的页码行，280 栏首屏看得全 8 条。「仅授权查看的字体」用在 6 页，收成「· 共 6 页 查看全部页码」（超过 5 页，03-10 边界）。状态色只给条目图标。报告开着时翻到第 4 页点画布上的评论钉：先收起报告、再切到「评论」页签（检查器被报告占着时没有页签，点了要有可见反馈）",
      editor: { inspector: REPORT_OPEN },
    },
    {
      id: "locate",
      title: "定位到对象",
      note: "03-10「定位」：跳到受影响的第一处所在页并短暂高亮对象——瀑布图占位外 2px 强调色外框（与 1px 选中框、悬停区分；用户点按时停 1 s 后淡出，减少动态效果时直接消失），不改选中；这一行成为当前项（强调色淡底），措辞后面的页码换成「第 7 页 · 瀑布图「成本构成」」（主文字色，同一位置）。画布始终可见，接着点下一条即可，不必重开报告",
      editor: { slide: 7, inspector: REPORT_OPEN, data: { located: { id: "chartex", i: 0 } } },
    },
    {
      id: "locate-page",
      title: "定位到整页 · 逐处查看",
      note: "03-10「…短暂高亮对应对象 / 整页边框」：切换效果是页的属性，高亮画在幻灯片外一圈（2px 强调色，与幻灯片圆角同心）；多处时行内「‹ 1 / 2 ›」逐处查看（第一处时「上一处」不可用、写原因）。关闭面板后检查器「放映」节的「切换」显示同一个值（淡化，原样保留、暂不可编辑）。画布照常画第 4 页的 3 枚评论钉（DS-43「编辑模式照常显示评论钉」：场景级参数 stage.commentPins）；报告开着时检查器被它占着、没有页签，点钉先收起报告（焦点留在钉上，定位高亮随之清掉，与报告的「关闭」同一结果），再切到「评论」页签，01 §2.3 点评论钉的自动切页签照常有可见反馈",
      editor: { slide: 4, inspector: REPORT_OPEN, data: { located: { id: "transition", i: 0 }, focus: "transition", transition: "淡化" } },
    },
    {
      id: "filter-page",
      title: "只看本页",
      note: "03-13「查看详情」打开同一个面板并按本页过滤（不另做诊断视图）：范围切到「本页」，只剩第 7 页的两项（瀑布图、缺失字体），计数按本页算；换页时跟着当前页走，本页没有差异时写「第 n 页没有差异」",
      editor: { slide: 7, inspector: REPORT_OPEN, data: { filter: "page" } },
    },
    {
      id: "page-hint",
      title: "本页提示条",
      note: "03-13 页级（DS-51 改写）：本页有以占位显示的内容时，画布顶部居中出提示条「本页有 1 处内容无法完整显示 ┊ 查看详情」——浮动胶囊（CanvasHint 档：panel 底、1px 边、圆角 12、浮层阴影），图标中性（Info，次级文字色；整页无法解析时用危险色），不推挤画布。本会话里每页只在第一次进入时出现，约 5 秒后淡出（减少动态效果时到点直接隐藏），悬停或焦点在它上面时停住、移开后重新计时；不设 ×（元素级占位与缩略图角标常驻，信息不会丢）。报告开着时不出；选中降级对象时让位（由检查器的对象说明来讲），取消选中后不再补出。读屏：提示条本身是 polite 播报区，出现时播报一次；焦点在提示条上时不淡出，淡出不会带走焦点。「查看详情」打开按本页过滤的报告：提示条在用户用它的时候不算消失，报告开着时隐藏，关上后接着显示、焦点回到「查看详情」（不重复播报），焦点移开后重新计时。本状态用状态数据 chipHold 把演示定格在提示条刚出现之后（截图与评审时稳定显示）：用户第一次点按或按键后才开始计时。元素级占位在纸面上（虚线框 + 图标 + 一行标题 + 一行原因，与缺插件占位同一画法，DS-52），左栏缩略图带角标",
      editor: { slide: 7, data: { chipHold: true } },
    },
    {
      id: "degraded-selected",
      title: "选中无法显示的对象",
      note: "03-13 元素级 / 03-03 降级元素 / 50/25 §2.5：占位可选中（8 个缩放手柄、没有旋转手柄、尺寸角标）、可移动 / 缩放 / 删除，不能进入内部编辑；检查器「新式图表（占位）」只有三节（标题写法与缺插件占位一致）——对象说明与第 1 批图表「此类型仅支持查看」同一画法（DS-52）：中性 Info 图标（次级文字色）+「此元素当前无法显示」+ 一句说明「瀑布图等 Office 2016 新图表暂不支持显示，已原样保留，导出后可在 PowerPoint 查看。」+「保真详情」（次按钮带 14px 外链图标，与第 1 批图表「此类型仅支持查看」的「保真详情」同一颗：底座 DegradedDetailButton；原来这里不带图标，与 DS-52「同一画法」对不上）；不再用警告色图标，也不再写「可以移动、缩放、复制和删除，不能编辑内部」——画布上的手柄与右键菜单已经表达 · 位置与大小（不旋转、不翻转）· 替代文本（chartex 属 AlternateContent 系，只读并注明在 PowerPoint 中修改）。页级提示条在选中降级对象时让位、这里不出现（DS-51：检查器的对象说明在讲同一件事；取消选中后也不再补出）。纸面占位与缺插件占位同一画法：图标 + 一行标题 + 一行原因（DS-52）。双击只弹一次说明「此类图表暂不支持显示，已原样保留 · 查看保真详情」。「保真详情」打开的报告关闭（关闭 / Esc）后，焦点回到检查器里的这颗按钮（03-10 §2）",
      editor: { slide: 7, selection: "degraded" },
    },
    {
      id: "degraded-menu",
      title: "无法显示的对象 · 右键",
      note: "03-05「降级元素」/ 50/25 §2.5：按「能摆放」的口径——剪切 · 复制 · 粘贴 · 原位复制 ┊ 排列 ▸ · 组合（单选不可用）┊ 编辑替代文本…（AlternateContent 系不可用：需在 PowerPoint 中修改）· 添加评论 ┊ 查看保真详情 ┊ 删除；没有格式类命令与旋转。键盘：焦点在占位上按 ⇧F10 / 菜单键，在同一落点打开同一份菜单；关闭后焦点回到占位，「查看保真详情」打开的报告关闭后焦点同样回到占位（03-10 §2）。03-05 原写「复制 · 删除 · 查看保真详情」，DS-52 按「能摆放」收口、回写 03-05（缺插件元素同一结构，见 plugins.missing-menu）。评审、只读浏览与降权照常出这份菜单，编辑类命令不可用（DS-64，见 fidelity.degraded-menu-review）",
      editor: { slide: 7, selection: "degraded", data: { menuOpen: true } },
    },
    {
      id: "degraded-menu-review",
      title: "评审模式 · 无法显示的对象的右键",
      note: "rulings §4.25 DS-64（即 §4.22 D-10 禁用而不隐藏）/ 03-05 §4：评审模式下在保真占位上右键（或聚焦占位后按 ⇧F10 / 菜单键），照常出与编辑模式同一份「能摆放」菜单，落点同 degraded-menu——剪切、粘贴、原位复制、排列、组合、编辑替代文本…与删除留在原位、不可用，同一原因写在菜单顶部一行「评审模式：编辑类命令需要编辑权限」（不逐项写原因，删除不用危险色；与第 1 批 context-menu.readonly 同一画法，kit readOnlyMenu）；「复制」、「添加评论 C」（评审者有评论权限）与「查看保真详情」照常可用。只读浏览（查看者）同一形态，「添加评论」也不可用，顶部写「只有查看权限」（viewer-role 的第 7 页占位上右键即见）；编辑模式已降权写「需要编辑权限」。关闭菜单后焦点回到占位，「查看保真详情」打开的报告关闭后焦点同样回到占位（03-10 §2）。评审时画布只描选中框、不画手柄与尺寸角标，检查器只读展示（DS-15）。原「评审、只读浏览没有这份菜单（占位上按 ⇧F10 不出菜单）」作废",
      editor: { mode: "review", slide: 7, selection: "degraded", data: { menuOpen: true } },
    },

    /* ---------------------------------------------------------------- 报告的其他内容 */
    {
      id: "parse-failed",
      title: "部分解析失败",
      note: "03-10「部分解析失败但可继续打开」+ 03-13 F1 E2：第 8 页整页解析失败，画布显示页级占位「此页内容无法解析」（母版页脚照常），其余页正常；报告里「无法解析」单独成组排在最前，危险色图标（文字仍是正文色），概要的一行里并进「1 页内容无法解析」（不单独成行、不带状态色图标）；左栏第 8 页的角标按这一页最严重一条的级别用危险色（危险浅底 + FileWarning，与报告条目、页级提示条同一个图标，读屏名「第 8 页，1 处内容无法解析」；底座缩略图角标的级别 warnLevel，由报告数据推导）；那一页上的对象未知，不再列出。打开时的轻提示改为错误语气「第 8 页内容无法解析」",
      editor: { deck: deckFor("parse"), slide: 8, inspector: REPORT_OPEN, data: { variant: "parse", located: { id: "parse-8", i: 0 } } },
    },
    {
      id: "parse-hint",
      title: "部分解析失败 · 本页提示条",
      note: "DS-51 改写的页级提示条在整页无法解析时的画法（parse-failed 一出现就开着报告，提示条不出，这一页之后也不再补出，所以单独给一个状态）：报告关着、进入第 8 页时出「此页内容无法解析 ┊ 查看详情」，图标保留危险色（按这一页最严重一条的级别，由报告数据推导），其余停留规则同 page-hint：每页只在第一次进入时出现、约 5 秒后淡出，悬停或聚焦时停住，不设 ×；本状态用状态数据 chipHold 把演示定格在出现后，用户第一次点按或按键后才开始计时。画布是页级占位「此页内容无法解析」；左栏第 8 页角标是危险色（危险浅底 + FileWarning，读屏名「1 处内容无法解析」，同 parse-failed）",
      editor: { deck: deckFor("parse"), slide: 8, data: { variant: "parse", chipHold: true } },
    },
    {
      id: "no-differences",
      title: "完全保真",
      note: "03-10「完全高保真」：未发现需要注意的差异时仍保留入口（主菜单「文件 › 保真报告」），面板只写「未发现需要注意的差异 · 所有内容都已高保真还原，可以正常编辑」；常态不用状态色（对勾 text-2）；打开时不出轻提示，缩略图没有角标",
      editor: { deck: deckFor("clean"), slide: 2, inspector: REPORT_OPEN, data: { variant: "clean" } },
    },
    {
      id: "generating",
      title: "报告生成中",
      note: "03-10「加载中」/ 03-13「其余页面加载中 x/N」：首屏可交互后报告就能打开，面板写「正在检查其余页面… 5 / 8」+ 确定态进度条，先列已发现的差异、检查完补全，不必等待（原「入口禁用 + 转圈」的画法随 DS-53 作废）；首屏前主菜单整组不可用（main-states.opening）。左栏第 6–8 页仍是版式骨架；生成完、有差异时才出打开后的轻提示（面板开着就不出）",
      editor: {
        deck: deckFor("generating"),
        rail: { status: <RailStatus icon={<LoaderCircle {...SI} className="motion-safe:animate-spin" />}>其余页面加载中 5/8</RailStatus> },
        inspector: REPORT_OPEN,
        data: { variant: "generating" },
      },
    },
    {
      id: "external-confirm",
      title: "外部内容需确认后加载",
      note: "03-13「外链资源」部署 externalResources = confirm：外部图片先显示占位「此图片来自外部网站 · cdn.example.com」+「加载」（纸面上的按钮取亮色 token），页级提示条「本页包含来自外部网站的内容 ┊ 全部加载」（本次打开内有效、不持久化；点完按钮随之消失，焦点交给画布）——与本页提示条同一套停留规则（DS-51）：每页只在第一次进入时出现、约 5 秒后淡出，悬停或聚焦时停住，不设 ×（错过了也能在占位上逐个「加载」）；本状态用状态数据 chipHold 把演示定格在出现后，用户第一次点按或按键后才开始计时。缩略图角标、报告「外部链接内容」一行改为「需确认后加载」并算作以占位显示。缺省 auto 时自动加载、不出这些",
      editor: { deck: deckFor("confirm"), slide: 8, data: { variant: "confirm", chipHold: true } },
    },
    {
      id: "font-toast",
      title: "受限字体 · 进入编辑时的轻提示",
      note: "03-13 受限内嵌字体（OF-17，M2 起）：从评审切回编辑时，文档含仅授权查看的字体，出一次轻提示「1 种字体仅授权查看，编辑时以替代字体显示 · 详情」（锁形、中性，不弹窗、不阻断），「详情」打开报告并滚到「字体」分组；打开文档时的差异提示已经包含字体时不再另出这一条。文本框内联提示与检查器锁形见 text-edit.restricted-font",
      editor: { data: { toast: "font" } },
    },
    {
      id: "font-detail",
      title: "受限字体 · 详情 → 字体分组",
      note: "03-13「详情」打开保真报告并定位到「字体」分组：面板滚到「仅授权查看的字体」。它用在 6 页，超过 5 页在措辞后面收成「· 共 6 页 查看全部页码」（03-10 边界情况，「查看全部页码」是句中的文字按钮，点开后同一位置列出全部页码、随行换行，焦点交给展开的页码）；「定位」跳到第一处（第 1 页标题）",
      editor: { inspector: REPORT_OPEN, data: { focus: "font-restricted" } },
    },
    {
      id: "file-menu",
      title: "入口 · 主菜单「文件」",
      note: "02 §2.3 / DS-21：常驻入口只有主菜单「文件 › 保真报告」（与导出…、幻灯片大小…同组）；完全保真、只读角色同样在。选它打开整栏面板，关闭后焦点交回主菜单按钮；网格视图里选它先回单页再打开",
      // layers 会整个替换场景级的那一份：占位的右键菜单（第 7 页，同 alt-dialog）一起放进来，关掉主菜单翻到第 7 页时「右键 › 查看保真详情」照常在
      editor: {
        layers: (ctx) => (
          <>
            <DegradedMenuLayer staticOpen={!!ctx.data.menuOpen} />
            <MainMenuLayer openPath={["file"]} highlight="保真报告" />
          </>
        ),
      },
    },

    /* ---------------------------------------------------------------- 只读与查看器 */
    {
      id: "viewer-role",
      title: "查看者 · 同一份报告",
      note: "03-10：报告是客观文件事实，对所有协作者一致——查看者（与评审者）从主菜单打开的是同一个面板、同样的条目，可以按页过滤、定位；只读角色画布上不画手柄，定位本来就不改选中。第 7 页的占位上右键或按 ⇧F10 / 菜单键，出的是同一份菜单的只读形态：顶部一行「只有查看权限」，编辑类命令与「添加评论」不可用，「复制」「查看保真详情」照常（rulings §4.25 DS-64，见 degraded-menu-review）",
      editor: { mode: "viewer", slide: 7, inspector: REPORT_OPEN, data: { located: { id: "chartex", i: 0 } } },
    },
    {
      id: "viewer-shell",
      title: "查看器 · ⓘ 保真摘要",
      note: "01-IA §8.1 / 03-25：preset-slide-viewer 的 ⓘ 弹出极简摘要卡，只有影响「看」的计数（1 处暂不支持显示 · 6 处动画与切换以静态画面显示 · 1 种替代字体）与「查看详情」外链（由集成方配置，未配置时不显示），不内嵌完整报告。查看器壳是第 3 批定稿的桌面壳（viewer/shell.tsx：贴边顶部条 48 · 上一页 / 下一页 · 页码「3」/ 8 ┊ 缩小 · 读数 · 放大 ┊ 全屏 · 搜索 · ⓘ，与原最小壳同高同位置，ⓘ 卡的位置不变），卡片不动（2026-10-22 按 rulings §4.25 DS-110 改：原为最小的 v3 壳）",
      editor: {
        slide: 3,
        toolbar: { hidden: true, collapse: true },
        regions: { leftRail: () => null, inspector: () => null, stage: () => <Viewer /> },
        canvasOverlay: null,
        layers: <ViewerSummary />,
        data: { viewer: { summaryOpen: true }, find: { open: false } },
      },
    },

    /* ---------------------------------------------------------------- 未采纳的备选（DS-63：留作对照，实现以推荐为准） */
    {
      id: "alt-dialog",
      title: "未采纳 · 报告做成对话框",
      note: "未采纳：DS-38 定为推荐（fidelity.report）。DS-38 未采纳的备选：01-IA §9 路由表登记的 ui.dialog、旧版 #/editor/fidelity 的画法——居中模态对话框（480，遮罩），内容与面板相同、底部「知道了」。「定位」先关对话框再跳页，看下一条要重开；画布被遮罩盖住。关掉后从主菜单「文件 › 保真报告」（或提示条、检查器、右键）重开的仍是这个对话框，关闭后焦点回到打开它的控件。推荐整栏面板（主状态 report）",
      // layers 是顶层字段、会整个替换场景级的那一份：占位的右键菜单（第 7 页）要一起放进来，「右键 › 查看保真详情」这个入口在备选态里才在
      editor: {
        layers: (ctx) => (
          <>
            <DegradedMenuLayer staticOpen={!!ctx.data.menuOpen} />
            <ReportDialog />
          </>
        ),
        data: { reportForm: "dialog" },
      },
    },
    {
      id: "alt-banner",
      title: "未采纳 · 打开后的提示走横幅",
      note: "未采纳：DS-51 定为推荐（fidelity.default）。DS-51 未采纳的备选：打开后有差异时在横幅通道放一条信息横幅（优先级末档「其他」，可关闭，与插件横幅同档）；横幅「查看保真报告」打开的报告关闭后，焦点回到这颗按钮（横幅仍在原位）。横幅占文档流、把画布往下推，且 03-12 把横幅留给数据安全与连接；推荐轻提示（主状态 default）",
      editor: { banner: <ReportBanner /> },
    },
    {
      id: "alt-indicator",
      title: "未采纳 · 同步状态行常驻入口",
      note: "未采纳：DS-51 定为推荐（fidelity.file-menu）。DS-51 未采纳的备选：03-10「持久的小角标（图标 + 数量）」在 v3 的落点——同步状态行后面常驻「ⓘ 9 项保真差异」，点开报告。与主菜单是两个常驻入口之外的第二个，且同步状态行只该讲同步（DS-6）；推荐只留主菜单 + 打开后的一次轻提示",
      editor: { rail: { status: <StatusWithIndicator /> } },
    },
  ],
})
