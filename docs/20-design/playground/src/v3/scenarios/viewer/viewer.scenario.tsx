import { deckWith } from "../../kit"
import { qrDeck } from "../main-states/slides"
import { defineScenario, type EditorConfig } from "../types"
import { BASE_HOST, PENDING_DECK, VIEWER_DECK, type ViewerSeed } from "./data"
import { Viewer } from "./shell"
import { ViewerSummaryLayer } from "./summary"

/**
 * viewer：03-25 只读查看器 preset 壳（preset-slide-viewer 的 viewer-shell；前端 50/12 §3–§4 定行为；第 3 批 · 应用壳族，rulings §4.25 DS-8）。
 * /documents/:id/view（只留给 M1 查看器与嵌入，UX-19）与嵌入形态 C 用的那一个壳：没有左栏、检查器、评论、协同与插件面板（01-IA §8.1）。
 * 做法同第 2 批 fidelity.viewer-shell：regions 把左栏、检查器换成 null、工具条收起不留位，stage 换成整个壳；ⓘ 卡沿用第 2 批定稿的 ViewerSummary（不重做）。
 * 宿主选项（thumbnails / notes / search 惰性可选件、onOpenDetails / onDownloadOriginal 回调）写成状态数据 data.viewer.host，缺省开了搜索与「查看详情」。
 * 产品里壳是框架无关的 TS + CSS、≤ 15 KB（rulings §4.3、C-06），样张只取画法与 token。
 *
 * 摸底里的可选状态没有单独画的：fullscreen（整个壳进浏览器全屏、工具条照常，画面同 default，写在 default 的 note）；
 * tiny（容器 < 320 工具条折两行）——按 rulings §4.25 DS-111，窄屏没有顶部工具条，底部浮动条约 216 宽，< 320 照样一行，这一条只对未采纳的 03-25 原写法成立（见 alt-narrow-toolbar 的 note）；
 * embedded-box（宿主页面里的小容器）画在 embed 场景（embed.viewer-box）。
 */

const viewer = (seed: ViewerSeed, over: EditorConfig = {}): EditorConfig => ({ ...over, data: { viewer: seed, ...over.data } })

export default defineScenario({
  id: "viewer",
  title: "查看器",
  specs: ["03-25"],
  batch: 3,
  summary: "只读查看器壳：贴边顶部条、缩放菜单、ⓘ 保真摘要、搜索、宿主开启的缩略图条与备注、打开中与打开失败、窄屏（向编辑器仅查看形态靠齐）",
  editor: {
    deck: VIEWER_DECK,
    slide: 3,
    // 查看器 preset 没有母版视图入口（03-26 §1.1；2026-10-28 母版视图改版第一步：宿主不提示、命令面板不挂）
    masterView: false,
    toolbar: { hidden: true, collapse: true },
    stage: { cursor: false },
    regions: { leftRail: () => null, inspector: () => null, stage: () => <Viewer /> },
    layers: <ViewerSummaryLayer />,
    // 查找面板缺省收着（search 状态里打开）
    data: { find: { open: false } },
  },
  states: [
    /* ---------------------------------------------------------------- 桌面 */
    {
      id: "default",
      title: "桌面默认",
      note: "03-25 / 50/12 §3 的 v3 画法（第 3 批定稿；原玻璃工具条 glass-strong rounded-2xl 作废，DS-2）：贴边顶部条高 48、panel 底、1px 下边线（与第 2 批 fidelity.viewer-shell 同高同位置，ⓘ 卡位置不变），自左至右 上一页 ← · 下一页 → · 页码输入「3」/ 6 ┊（居中）缩小 − · 读数「118% ▾」· 放大 + ┊ 全屏 F · 搜索 · ⓘ 保真摘要；当前页适应窗口（四周留 48 / 40，与编辑器相同；容器窄于 960 时收到 16，见 embed.viewer-box），只读、没有选中与手柄。没有标题、返回、左栏、检查器、评论、协同、插件面板（01-IA §8.1、PM-12）。宿主选项：本态开了 search 与「查看详情」回调（同第 2 批样例），缩略图条、备注、下载回调没开——没开的不渲染入口、不留占位（Q18、50/12 §4：搜索是惰性可选件、缺省关；03-25 §2 同此，原把 🔍 画在基线工具条里的写法作废）。⛶ 只表示「全屏」（整个查看器容器进入浏览器全屏、工具条照常、不自动隐藏；宿主 iframe 没授权全屏时 document.fullscreenEnabled 为假，不渲染这颗按钮），03-25 与 01-IA §8.1 的「全屏/放映」改为只有全屏（查看器没有放映舞台）；图标用 Fullscreen，Maximize 留给「适应窗口」。键盘（50/12 §3）：← → / PageUp PageDown 翻页、Home / End 首末页、+ / − 缩放、⌘ + 滚轮缩放、F 全屏、Esc 由浏览器退出全屏（全屏下第一次 Esc 被浏览器消费：直接退出全屏、备注面板保持；03-25 §4.6、§6 与 50/12 §3 同此，原「Esc 先关抽屉再退全屏」做不到、作废）；不占 ⌘F（50/12 §3 没有它；查看器嵌在宿主页里，与缩放不占 ⌘+ / ⌘− 同一口径，⌘F 照常是浏览器的查找）；Tab 可达全部按钮。超链接：http(s) 新窗口打开（noopener），页内跳转调 goToPage，mailto / tel 只显示目标、可复制（50/14 §5、PRD ED-19；03-25 §6 与 50/12 §3 同此，原「只放行 http(s) 与 mailto」作废）",
      editor: viewer({}),
    },
    {
      id: "loading",
      title: "打开中",
      note: "03-25「加载中」（只在容器内呈现、不跳独立页）：与编辑器 main-states.opening 同一画法——这一页的版式骨架（母版装饰与页脚是真的、占位符画成虚线框，不是灰色骨架条，Q8）+ 下方一行阶段文字与进度「正在解析母版与版式… 62%」；打开时停在第 1 页（页数在母版与版式解析完就已知道，页码「1 / 6」照常可读）；没有「取消」（来源在宿主手里，宿主自己卸载即可）。工具条照常画出、全部不可用并写「文档打开后可用」（同编辑器打开中，FE-06），读数置灰、菜单打不开。03-25 原写的「骨架呼吸」作废（DS-53 加载画法，第 1 批打开中的版式骨架不在 DS-53 之列）",
      editor: viewer({ phase: "loading" }, { slide: 1 }),
    },
    {
      id: "failed",
      title: "打开失败 · 通用兜底",
      note: "03-25「失败」/ 50/12 §3：容器里只剩阻断页，与编辑器 main-states.open-failed 同一布局（kit BlockingPage：32px 线性图标 text-2 · 16px 标题 · 12px 说明 · 一行按钮），文案取 03-13 错误码表的通用兜底「无法打开该文档」·「请稍后重试；如果问题持续，请联系管理员」（不出现「已损坏」）。按钮只有宿主提供 onDownloadOriginal 时的「下载原文件」（画布底上的次按钮 outline + 下载图标，DS-37、TB-128）；没有「返回文档列表」（查看器没有文档列表）、「重试」（来源在宿主手里）与「复制诊断信息」（诊断由集成方经 error/raised 事件取）——rulings §4.25 TB-114。工具条不画（与编辑器打开失败一样不渲染残缺的外框）",
      editor: viewer({ phase: "failed", host: { ...BASE_HOST, download: true } }),
    },
    {
      id: "failed-no-download",
      title: "打开失败 · 宿主没有下载回调",
      note: "03-25 边界情况「集成方未提供下载原文件回调」：同一阻断页，不出按钮、不留空位（说明下面直接结束）",
      editor: viewer({ phase: "failed" }),
    },
    {
      id: "failed-code",
      title: "打开失败 · 按错误码（文件已加密）",
      note: "03-25「错误文案按错误码区分，复用 03-13 的错误码变体表」：只换图标、标题与说明，布局与按钮规则不变——format.encrypted：锁形文件图标 ·「此文件已加密，当前版本无法打开」·「请先在 PowerPoint 中去除密码后再打开」（03-13 是导入的说法「…后再导入」，查看器改「打开」）；本态宿主提供了下载回调。其余错误码（含宏、无效的演示文稿、超出规模上限、网络）同此替换，文案以 03-13 为准",
      editor: viewer({ phase: "failed", failure: "encrypted", host: { ...BASE_HOST, download: true } }),
    },

    /* ---------------------------------------------------------------- ⓘ 保真摘要（第 2 批已定稿） */
    {
      id: "summary",
      title: "ⓘ 保真摘要卡（复用第 2 批）",
      note: "第 2 批已拍板的 fidelity.viewer-shell 卡片原样复用（fidelity/viewer.tsx ViewerSummary，不重做，DS-51）：ⓘ 下方右对齐、宽 264，只列影响「看」的计数（1 处暂不支持显示 · 6 处动画与切换以静态画面显示 · 1 种替代字体）+「内容都已原样保留，不影响原文件。」+「查看详情」外链次按钮（宿主配了 onOpenDetails 才出现）；在新壳上核对过位置与焦点：ⓘ 是开关（aria-expanded），Esc 或点外面收起、焦点回 ⓘ。第 3 批转正时第 2 批 fidelity.viewer-shell 的最小壳已换成本场景的桌面壳、卡片不动（rulings §4.25 DS-110，改的是第 2 批已拍板画面的外框）",
      editor: viewer({ summaryOpen: true }),
    },
    {
      id: "summary-none",
      title: "ⓘ · 没有影响查看的差异",
      note: "rulings §4.25 TB-114：没有影响查看的差异时 ⓘ 留在原位（工具条不随文档跳位），卡片只写一句「未发现影响查看的差异」——句式与第 2 批已拍板的 fidelity.no-differences「未发现需要注意的差异」对齐，中性对勾 CircleCheck text-2（同那一态，不用成功色：这不是一次操作的结果），不写「内容都已原样保留」；宿主配了「查看详情」时照常出现（完整报告里可能还有只影响编辑的差异）。窄屏的「保真摘要」底部面板同一句（narrow-summary）",
      editor: viewer({ summary: "none", summaryOpen: true }),
    },
    {
      id: "missing-plugin",
      title: "缺插件元素",
      note: "rulings §4.25 DS-110（PRD PM-12「查看器只显示占位与一行说明，无面板入口」、G-87）：第 6 页三个二维码由插件「二维码形状」绘制，本部署停用了它——纸面上照常是缺插件占位（与编辑器同一画法：虚线框 + 拼图图标 + 插件名 + 「插件已停用，内容已保留」，DS-52），PM-12 的「一行说明」放进 ⓘ 卡、排在最前：警告色拼图图标（与编辑器缺插件横幅同一个图标）+「3 处内容需要插件「二维码形状」，以占位显示」，其余计数照常。不加横幅、不占画布，没有个人插件面板入口（查看器里没有插件面板）。未采纳的细条见 alt-missing-plugin-bar",
      editor: viewer({ summary: "plugin", summaryOpen: true }, { deck: qrDeck("插件已停用"), slide: 6 }),
    },
    {
      id: "alt-missing-plugin-bar",
      title: "未采纳 · 工具条下的缺插件细条",
      note: "未采纳（DS-110 定为放进 ⓘ 卡、排在最前，见 missing-plugin）：工具条下方一条可关闭的细条——与编辑器缺插件横幅同一个件（kit PluginBanner：DS-41 中性底 + 警告色拼图，DS-75 高 40），标题「本文档用到了插件「二维码形状」」+「3 处内容以占位显示，内容已保留」+ ×「关闭提示」；查看器没有插件面板，所以没有「查看详情」。最显眼，但等于在查看器里新造一条横幅通道（查看器壳 ≤ 15 KB、没有横幅通道），关掉后整份文档缺几处就看不到了",
      editor: viewer({ summary: "plugin", pluginBar: true }, { deck: qrDeck("插件已停用"), slide: 6 }),
    },

    /* ---------------------------------------------------------------- 缩放与搜索 */
    {
      id: "zoom-menu",
      title: "缩放读数菜单",
      note: "OF-14「缩放 10–400%、适应窗口」：读数「118% ▾」点开与编辑器 03-20 §4 同一份菜单（宽 200、读数下方 4、居中）：顶部比例输入框（28 高、字段外框：「缩放」· 数字 · %，只收数字，↵ 确认并夹到 10–400）┊ 放大 + · 缩小 − ┊ 适应窗口 · 适应宽度 ┊ 50% · 75% · 100% · 150% · 200%——补上 OF-14 要的「适应窗口」入口（03-25 工具条原来只有 − 100% +）。读数是量出来的实际比例（显示宽 ÷ 1280，读数按钮的读屏名「缩放 118%」），档位不打勾。快捷键按 50/12 §3 写 + / −（编辑器是 ⌘+ / ⌘−：查看器嵌在宿主页里，不抢浏览器缩放），适应窗口与 100% 没有快捷键（50/12 没写 ⌘0 / ⌘1，不另加）。放大超过窗口时画布出原生滚动条",
      editor: viewer({ zoomMenu: true }),
    },
    {
      id: "search",
      title: "搜索（M2 P1）",
      note: "OF-16 / 50/12 §4 viewer-search（宿主 search: true 才有入口，按需加载）：🔍 打开与编辑器查找面板同一个件（03-21 的 v3 浮动面板，查看器里没有替换区与「展开替换」，FindPanel canReplace false），挂在画布右上、工具条下方 12；查找框「营收」、计数「3 / 6」，当前命中填充高亮、其余描边（与编辑器同一画法），↵ / ⇧↵ 或上一个 / 下一个跨页跳转；没有结果时「未找到匹配内容」。Esc 或 × 关闭、焦点回画布。🔍 按钮在面板开着时是按下态（aria-expanded），工具提示只写「搜索」：查看器不占 ⌘F（50/12 §3 的键位没有它；嵌在宿主页里，与缩放不占 ⌘+ / ⌘− 同一口径），⌘F 照常打开浏览器自己的查找。窄屏见 narrow-search",
      editor: viewer({}, { slide: 4, data: { find: { open: true, query: "营收", index: 3 } } }),
    },

    /* ---------------------------------------------------------------- 宿主开启的可选件 */
    {
      id: "thumbnails",
      title: "宿主开启缩略图条",
      note: "03-25「可选缩略图条」/ 50/12 §4 viewer-thumbnails（宿主 thumbnails: true 才渲染、按需加载、不计 350 KB 基线，Q18）：画布下方贴边一条，panel 底、1px 上边线（原玻璃条 h-20 rounded-2xl 作废，DS-2）；每项与编辑器左栏缩略图同款——页码 11px 在左、缩略图 96 宽真实渲染、圆角 4、1px 边，当前页强调色边 + 强调色淡底（aria-current）。点选跳页；条内 ← → / Home / End 移动焦点（只有当前页在 Tab 顺序里，roving tabindex），↵ 跳转；翻页时当前页滚入条内；视口附近懒渲染、≥ 50 页虚拟化；只有 1 页时不显示。语义用 nav + 列表（03-25 原写的 listbox / option 在 v3 左栏已改为按钮列表，同一口径）",
      editor: viewer({ host: { ...BASE_HOST, thumbnails: true } }),
    },
    {
      id: "thumbnails-loading",
      title: "缩略图条 · 加载中与单页失败",
      note: "03-25「状态」：缩略图生成超过 300 ms 的页先显示这一页的版式骨架（与编辑器左栏「其余页面加载中」同一画法：母版装饰与页脚是真的、占位符虚线框，不是灰色骨架卡，Q8）——第 4、6 页；单页缩略图渲染失败是页码 + panel-2 灰块 + 图片失效图标、读屏「第 5 页：…，缩略图暂时无法显示」，不阻塞其他页——第 5 页。当前页（第 3 页）已渲染",
      editor: viewer({ host: { ...BASE_HOST, thumbnails: true }, thumbsFailed: [5] }, { deck: PENDING_DECK }),
    },
    {
      id: "notes",
      title: "宿主开启备注",
      note: "03-25「备注抽屉」/ 50/12 §4 viewer-notes（宿主 notes: true 才渲染「备注」按钮、按需加载，Q18）：工具条末尾「备注」是开关（aria-pressed），按下态强调色淡底（DS-36，同放映的「黑屏」）；右侧贴边非模态面板宽 320、panel 底、1px 左边线、从工具条下沿到底（原玻璃 rounded-l-3xl 作废，DS-2），不加遮罩、点画布不关。标题行 56：「备注 · 第 3 页」13px 600 + 页标题 12px text-2 + 关闭 × Esc；正文 13px / 20 只读纯文本、保留换行、不渲染富文本；翻页时保持打开并换成那一页的备注。焦点在面板里按 Esc 或点 × 关闭、焦点回「备注」按钮；全屏下第一次 Esc 由浏览器退出全屏、面板保持（50/12 §3「先关抽屉再退全屏」做不到）",
      editor: viewer({ host: { ...BASE_HOST, notes: true }, notesOpen: true }),
    },
    {
      id: "notes-empty",
      title: "备注 · 本页没有备注",
      note: "03-25「无备注时显示」：面板照常开着，正文一句「这一页没有演讲者备注」（12px text-2）——rulings §4.25 DS-138：桌面只读态、查看器与仅查看形态一律这一句（main-states 的只读备注、version-history 预览；03-25 与 50/12 §4 原写的「本页没有备注」、第 1 批仅查看形态 narrow.narrow 原来的「这一页没有备注」随之改）。第 5 页",
      editor: viewer({ host: { ...BASE_HOST, notes: true }, notesOpen: true }, { slide: 5 }),
    },
    {
      id: "single-page",
      title: "只有 1 页",
      note: "03-25 / 50/12 §4：文档只有 1 页时上一页 / 下一页留在原位不可用（「已是第一页」/「已是最后一页」），页码「1 / 1」照常可读；宿主开了缩略图条也不显示（本态开着 thumbnails）",
      editor: viewer({ host: { ...BASE_HOST, thumbnails: true } }, { deck: deckWith({}).filter((s) => s.n === 1), slide: 1 }),
    },

    /* ---------------------------------------------------------------- 窄屏（DS-111） */
    {
      id: "narrow",
      title: "窄屏（< 640）",
      note: "视口 390 × 844。rulings §4.25 DS-111：向编辑器仅查看形态（第 1 批 narrow.narrow）靠齐——不画顶部条（查看器没有标题与返回）；当前页全宽（左右 16），内容整体垂直居中；底部浮动条与编辑器底部工具条同一外观（按钮 44、间距 8）：上一页 · 页码「3 / 6」· 下一页 ┊ 更多。左右轻扫翻页（页面被双指放大时不翻、让给平移），双指缩放；外接键盘 ← → 翻页。本态宿主没开 thumbnails，页码只是文字（读屏「第 3 页，共 6 页」）；开了时页码是按钮、点开两列缩略图底部面板（narrow-slides）；「更多」见 narrow-more，保真摘要与搜索见 narrow-summary、narrow-search。查看器只按容器宽度分两种形态：< 640 窄屏，其余同桌面（没有编辑器那种「紧凑」，查看器没有两侧栏可收）。容器 < 320 时这条浮动条约 216 宽，照样一行（03-25「< 320 工具条折两行」只对未采纳的原写法成立，见 alt-narrow-toolbar）",
      editor: viewer({ form: "narrow" }),
    },
    {
      id: "narrow-more",
      title: "窄屏 · 更多",
      note: "视口 390 × 844。DS-111：「更多」是底部面板（同编辑器仅查看形态：把手、标题行、行高 48、20px 图标 text-2），只放查看类命令：适应窗口 · 全屏（document.fullscreenEnabled 为假时不出，如 iOS Safari）· 搜索（宿主开了 search；选了收起面板、顶部出 03-21 窄屏查找条、焦点进查找框，见 narrow-search）· 保真摘要（选了换成「保真摘要」底部面板：与桌面 ⓘ 卡同一份条目，关了回到「更多」按钮，见 narrow-summary）┊ 显示演讲者备注（勾选项，宿主开了 notes）。本态宿主开了 thumbnails 与 notes，所以底部浮动条的页码是按钮。点面板外即收起，焦点回「更多」",
      editor: viewer({ form: "narrow", host: { ...BASE_HOST, thumbnails: true, notes: true }, sheet: "more" }),
    },
    {
      id: "narrow-notes",
      title: "窄屏 · 备注",
      note: "视口 390 × 844。DS-111：宿主开了 notes、「更多 › 显示演讲者备注」打开时，备注是当前页下方的只读卡（同编辑器仅查看形态：圆角 8、1px 边、panel 底，小标题「演讲者备注」，正文 13px 保留换行；没有备注时「这一页没有演讲者备注」，与桌面同一句），翻页跟着换；幻灯片与备注整体居中、超高时从顶部滚动。不另画底部抽屉（03-25 原写的 40vh 底部抽屉未采纳，见 alt-narrow-toolbar）",
      editor: viewer({ form: "narrow", host: { ...BASE_HOST, thumbnails: true, notes: true }, notesOpen: true }),
    },
    {
      id: "narrow-slides",
      title: "窄屏 · 幻灯片",
      note: "视口 390 × 844。DS-111：宿主开了 thumbnails 时底部浮动条的页码是按钮（读屏名「第 3 页，共 6 页，打开幻灯片列表」），点开「幻灯片」底部面板——两列真实缩略图（页码与页名在左上、当前页 2px 强调色环与 aria-current、其余 1px 边），点一页跳过去并收起面板、焦点回页码按钮；面板标题行「幻灯片 · 6 页」+ 关闭 44，最高 72dvh（不超过 640），超高时在面板里滚动；点面板外或 Esc 收起；同一时刻只开一个底部面板，浮动条让位。与编辑器仅查看形态的幻灯片列表（第 1 批 narrow.narrow-slides）同一个件、同一画法（查看器没有评论，所以没有评论角标；底部面板、触控按钮、轻扫与浮动条取 narrow/viewer.tsx 导出的同一份，第 3 批转正并入；两列缩略图列表是查看器自己的一份，多了单页失败的灰块）。单页缩略图生成失败时是页码 + panel-2 灰块，不阻塞其他页（同桌面缩略图条）",
      editor: viewer({ form: "narrow", host: { ...BASE_HOST, thumbnails: true, notes: true }, sheet: "slides" }),
    },
    {
      id: "narrow-summary",
      title: "窄屏 · 保真摘要",
      note: "视口 390 × 844。DS-111：「更多 › 保真摘要」换成「保真摘要」底部面板（同一时刻只开一个面板）：条目与桌面 ⓘ 卡同一份（第 2 批定稿的样例：1 处内容暂不支持显示（警告色三角）· 6 处动画与切换以静态画面显示 · 1 种缺失字体已用替代字体显示 +「内容都已原样保留，不影响原文件。」，DS-51），触控字号 13 / 行高 20、图标 16；宿主配了 onOpenDetails 时底部是整宽 44 高的「查看详情」次按钮（14px 外链图标），没配不出、不留空位。缺插件的文档多一行「N 处内容需要插件「…」，以占位显示」（DS-110）、没有差异时只写「未发现影响查看的差异」（TB-114），都与桌面卡同一份条目（summary.tsx summaryContent）。× 或 Esc 关闭，焦点回「更多」按钮",
      editor: viewer({ form: "narrow", host: { ...BASE_HOST, thumbnails: true, notes: true }, sheet: "summary" }),
    },
    {
      id: "narrow-search",
      title: "窄屏 · 搜索",
      note: "视口 390 × 844。DS-111：「更多 › 搜索」收起面板、顶部出 03-21 窄屏的查找条（FindPanel compact：查找框 · 计数「3 / 6」· 上一个 · 下一个 · 更多查找选项（区分大小写 · 全字匹配；查看器没有「替换…」）· 关闭，宽 320），水平居中、离上沿 24，焦点进查找框；当前命中填充高亮、其余描边（与编辑器同一画法），↵ / ⇧↵ 或上一个 / 下一个跨页跳转（本态停在第 4 页标题「营收趋势」）。底部浮动条照常可用。Esc 或 × 关闭、焦点回画布。宿主没开 search 时「更多」里没有这一项。查找条用 FindPanel 的落位参数 placement plain（不排在紧凑胶囊下面，第 3 批转正并入），放在一个水平居中的定位框里",
      editor: viewer({ form: "narrow", host: { ...BASE_HOST, thumbnails: true, notes: true } }, { slide: 4, data: { find: { open: true, query: "营收", index: 3 } } }),
    },
    {
      id: "alt-narrow-toolbar",
      title: "未采纳 · 窄屏顶部工具条（03-25 原写法）",
      note: "未采纳（DS-111 定为向编辑器仅查看形态靠齐：底部浮动翻页条 + 底部面板、备注是下方只读卡，见 narrow）：03-25 原写法只换 v3 视觉（视口 390 × 844）——顶部工具条收敛（贴边、高 52、命中区 44）：上一页 · 下一页 · 3 / 6 ┊ 缩小 · 51% · 放大 ┊ ⋯（下拉菜单：全屏 · 搜索 · 保真摘要 ┊ 缩略图 · 备注两个勾选项）；缩略图开启后是工具条下方的顶部抽屉（本态开着），备注是底部抽屉（高 40vh、上圆角 12，本态开着）；容器 < 320 时工具条折两行。与编辑器仅查看形态（底部浮动条 + 底部面板）是两套画法",
      editor: viewer({ form: "narrow-alt", host: { ...BASE_HOST, thumbnails: true, notes: true }, notesOpen: true, thumbsDrawer: true }),
    },
  ],
})
