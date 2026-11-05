import { Lock, Trash2 } from "lucide-react"
import { Banner, Button, DropOverlay, ICON, InspectorNotice, LibraryLayers, LibraryToasts, ME, OfflineBanner, SHELL_NAV, ShellDefaultActions, ShellSearch } from "../../kit"
import { defineScenario } from "../types"
import { HomeDrawer, NavToggle } from "../home/HomeMain"
import { FilterTabsBody, SortMenuBody, TrashBlockedPage } from "./alts"
import { Library, SearchTitle, type LibData } from "./Library"

/**
 * 文档列表（03-01，第 3 批 · 应用壳族）：整页从已拍板首页推出（rulings §4.25 DS-12：左栏 220 + 顶栏 56 + 横幅通道，kit ShellLayout）。
 * 2026-10-22 拍板（rulings §4.25 DS-79…DS-88、DS-92、DS-98，TB-107…TB-109、TB-127、TB-128；DS-98 的整屏导入页 2026-10-23 被 DS-140 的「导入」对话框取代）：推荐即正式状态；DS-80 采纳了原备选「搜索框下拉」（search-dropdown 转正，
 * 原推荐的「边输边搜、主区换成结果页」写进 search 的说明）；其余备选标「未采纳 · 」留在样张里（DS-63）。宿主 #/v3/documents；编辑器里的三态（DS-82 文件名、DS-85 回收站阻断页与未采纳的只读预览）宿主是 editor。
 * 应用壳的件都是底座的缺省（2026-10-22 第 3 批转正并入）：左栏 5 项真的跳页（kit shellNav：首页 → #/v3/home，其余 → documents.<视图>）、搜索框下拉（kit ShellSearch）、
 * 帮助菜单（kit ShellHelpMenu）、账户菜单（三处同一份 accountMenuItems）、卡片与菜单（kit DocumentCard、docCardMenu）、列表操作、轻提示与浮层（kit useLibraryOps / LibraryToasts / LibraryLayers）。
 * 摸底里可选、没有单独画的：phone（手机形态与开始页同一套判据与画法，见 home.phone，compact 的说明里写了差别）。
 * 里程碑（page.data.milestone，Library 的 LibData）：文档列表是 M2 的页面（03-01 §3），缺省 M2——卡片菜单「分享…」留在原位、不可用（rulings §4.25 DS-137）；
 * trash、purge-confirm、purging（永久删除与到期清理，SV-11）与 share-from-card（分享，CO-15）是 M3。
 */

const data = (d: LibData) => d as unknown as Record<string, unknown>

/** 离线横幅（DS-92：主区顶栏之下、只横跨主区；画法同第 1 批 main-states.offline，DS-41 浅底、DS-75 高 40） */
const OFFLINE_BANNER = <OfflineBanner>列表为最近一次取到的内容；本次打开过的文档可以继续编辑，其余操作将在恢复连接后可用</OfflineBanner>

/** 卡片网格的键盘与链接（TB-107、TB-108，各状态共用的一句） */
const KEYS =
  "卡片是链接（<a href=\"/documents/:id\">，读屏念「链接」；rulings §4.25 TB-108）：点按进编辑器（按我的角色：编辑 / 评审 / 只读浏览），⌘ / Ctrl 点按或中键在新标签页打开，右键是浏览器原生的链接菜单（复制链接地址），我们的菜单不加「在新标签页打开」；「⋯」是与链接并列的按钮。" +
  "键盘（TB-107，依据 07 §1.2b、TB-5）：整个网格一个 Tab 停靠点——方向键 ← → 前后一张、↑ ↓ 上下一行（列数取实际列数），Home / End 第一张 / 最后一张，Enter 打开，⇧F10 / 菜单键开「⋯」菜单；「⋯」不进 Tab 顺序，焦点在卡片上时露出、指针照常可点（样张里可以按着试）"

export default defineScenario({
  id: "documents",
  title: "文档列表",
  specs: ["03-01"],
  batch: 3,
  host: "documents",
  summary: "左栏 5 项即筛选（含回收站）、同一张卡片与菜单、搜索框下拉与结果页、回收站与永久删除、加载 / 空 / 出错 / 离线",
  page: {
    body: <Library />,
    overlay: <LibraryToasts />,
    layers: <LibraryLayers />,
  },
  states: [
    {
      id: "recent",
      title: "最近（缺省）",
      note:
        "rulings §4.25 DS-79：左栏就是筛选——首页 / 最近 / 我的文档 / 与我共享 / 回收站（第 5 项，Trash2，画法与其余四项相同），列表页没有页内筛选条；/documents 不带 filter 落「最近」。顶栏：标题「最近」·「导入 .pptx」（在原页上打开「导入」对话框，rulings §4.25 DS-140，见 import.dialog-documents）·「新建演示文稿」（同已拍板首页）。" +
        "列表头：左侧不写数量（DS-80：列表头、搜索下拉与搜索结果一律不写数量——60/15 游标分页没有总数，标杆也不写）· 右网格 / 列表（DS-84：复用首页切换，不加排序）。" +
        "「最近」按我打开的时间倒序、固定的排在最前（标题后 12px 图钉，AS-02），与开始页「最近」同一份数据：开始页按缺省「最近打开」排序时，前 8 条就是开始页那 8 条（TB-127：开始页的排序菜单是那一段的本机视图偏好，不带到这里）。" +
        "卡片（DS-81、DS-83）：16:9 封面 · 标题 · 第二行「编辑者 · 相对时间」（不再写「编辑」二字）；" +
        "第二行缺项时（rulings §4.25 TB-171，03-01 §4.2，样张没有单画）：缺最近编辑者（系统作业建的文档）只写相对时间，最近编辑者与内容更新时间都缺（还没有快照）时按创建时间写相对时间、不写编辑者，不拿所有者顶替编辑者；" +
        "列表形态的「编辑者 · 时间」两列、搜索下拉与搜索结果页的每一行同此，开始页「最近编辑」排序缺内容时间时取创建时间。我拥有的共享文档右下叠 2 位协作者，别人共享给我的是一枚所有者头像；评审者 / 查看者的卡片标题后带「可评论」「仅查看」徽标（UX-19，01 §5.1）；" +
        "新建的「未命名演示文稿」没有封面，画白纸面 + 居中 Presentation 图标（M2 占位，与真实封面同尺寸、不画骨架，03-29 §2.3）。悬停或焦点在卡片里时封面右上出现「⋯」。" +
        KEYS,
      page: { shell: { current: "recent", title: "最近" }, data: data({ view: "recent" }) },
    },
    {
      id: "mine",
      title: "我的文档 · 悬停与键盘焦点",
      note:
        "左栏「我的文档」是当前项、顶栏标题「我的文档」；只列我拥有的 9 份，按最近活动（内容编辑）时间倒序（DS-84）。第 2 张定格为悬停（整卡铺 --v3-card-hover、右上「⋯」出现），第 3 张定格为键盘焦点（2px 强调色焦点环、偏移 1，07 §2.1；「⋯」随之露出）——只为截图。" +
        "键盘（TB-107）：Tab 进网格只停一次、落在上次的那张（第一次是第一张），之后用方向键在卡片间走；Tab 再按一下就离开网格。我拥有的共享文档（2026 年 Q2 业绩汇报、Q3 预算执行情况、季度 OKR 复盘）右下叠协作者，没共享的不画头像",
      page: { shell: { current: "mine", title: "我的文档" }, data: data({ view: "mine", demo: { hover: "q2", focus: "q4-market" } }) },
    },
    {
      id: "shared",
      title: "与我共享",
      note: "左栏「与我共享」是当前项；别人共享给我的 6 份（有直接授权的，60/15 §3.3 filter=shared），按最近活动倒序。右下一枚所有者头像（DS-83，读屏名「所有者 X」；§4.24 TA-10 的协作者摘要只给所有者条目，所以不叠协作者）；标题后角色徽标：评审者「可评论」、查看者「仅查看」（UX-19：两者打开后的界面不同），可编辑的不带徽标。顶栏照常有「导入 .pptx」「新建演示文稿」。卡片的链接与键盘同 recent",
      page: { shell: { current: "shared", title: "与我共享" }, data: data({ view: "shared" }) },
    },
    {
      id: "card-menu",
      title: "卡片「⋯」菜单（所有者，最近）",
      note:
        "rulings §4.25 DS-81：开始页「最近」与文档列表同一个卡片、同一份菜单，按视图与角色增减——分享… · 创建副本 · 重命名 ┊ 固定（已固定的写「取消固定」）· 从最近移除（只在开始页「最近」与「最近」视图）┊ 移到回收站（只给所有者）。" +
        "「移到回收站」单独放最后一组、用危险色，是我们自己的取舍（标杆 Figma 的「Move to trash」与 Rename、Move file… 同组、不着色）。" +
        "打开方式：点「⋯」，或焦点在卡片上按 ⇧F10 / 菜单键（TB-107，锚在「⋯」下、右对齐；关闭后焦点回卡片）；卡片是链接，右键是浏览器原生的链接菜单（TB-108：新标签页打开、复制链接地址）。" +
        "「分享…」：文档列表是 M2 的页面，分享随 PRD CO-15 在 M3 开放——M2 留在原位、不可用（仍可聚焦），标 M3、右侧「后续版本提供」（rulings §4.25 DS-137，同 §4.20 FE-06，与回收站「永久删除…」在 M2 的画法一致）；M3 起在列表上打开第 2 批分享对话框（share-from-card，TB-109）。" +
        "其余每项都接上了：创建副本（轻提示「正在创建…」）、重命名（内联）、固定 / 取消固定、从最近移除与移到回收站（卡片移走 + 可撤销轻提示）",
      page: { shell: { current: "recent", title: "最近" }, data: data({ view: "recent", menuOn: "review" }) },
    },
    {
      id: "card-menu-reader",
      title: "卡片「⋯」菜单（查看者）",
      note: "rulings §4.25 DS-82（按 U-09：duplicate 要 doc.export，只给编辑者及以上）：评审者与查看者的卡片菜单没有「创建副本」，也没有「重命名」「移到回收站」（不是能编辑 / 所有者），只剩「分享…」┊ 固定；「分享…」M2 留在原位、不可用，标 M3、右侧「后续版本提供」（DS-137，同 card-menu），M3 起打开只读的「谁能访问「客户成功案例」」（我「可查看」、李雷「所有者」，DS-48；画面见第 2 批 share.no-permission）。编辑器里他们的文件名随之不再是菜单触发器（见 reader-doc-name）。这里是查看者的「客户成功案例」；可编辑的共享文档有「创建副本」「重命名」、没有「移到回收站」",
      page: { shell: { current: "shared", title: "与我共享" }, data: data({ view: "shared", menuOn: "cases" }) },
    },
    {
      id: "rename",
      title: "内联重命名",
      note: "03-01「交互说明」：菜单「重命名」进入（不设双击标题进入——与单击卡片打开冲突，03-29 §4）。标题换成输入框（外框同字段：淡底、聚焦为强调色 1px 线；文字与标题同位置、同字号），一进来全选原名；Enter 确认、Esc 取消、失焦保存，结束后焦点回到这张卡片；名字长时换到两行（最多两行，卡片下方随之撑高）。输入框里方向键照常移动光标（不在卡片间漫游）。乐观更新，保存失败回滚并给轻提示（50/02 §9.2，画法同 trashed-undo 的轻提示）",
      page: { shell: { current: "mine", title: "我的文档" }, data: data({ view: "mine", rename: "q4-market" }) },
    },
    {
      id: "trashed-undo",
      title: "移到回收站后可撤销",
      note: "「移到回收站」不弹确认（能找回：回收站里恢复；03-01、50/02 §9.2 乐观淡出）：卡片淡出，其后的卡片补位，焦点交给相邻卡片；主区底部居中轻提示「已将「设计评审」移到回收站」+「撤销」（5 秒，撤销即调恢复端点，卡片回到原位、焦点回到它）。轻提示里的文档名一律用「」包（同「正在创建「…」的副本…」）。轻提示在应用壳里离底 24（没有底部工具条，kit Toasts bottom）",
      page: {
        shell: { current: "mine", title: "我的文档" },
        data: data({ view: "mine", hidden: ["review"], toast: { text: "已将「设计评审」移到回收站", action: { label: "撤销", kind: "undo-hide" }, id: "review" } }),
      },
    },
    {
      id: "trash",
      title: "回收站（M3）",
      note:
        "rulings §4.25 DS-79、DS-85：左栏「回收站」是当前项；顶栏只有标题「回收站」（不放「导入」「新建」）；列表头一行说明「回收站里的文档 30 天后永久删除」（天数读部署配置 retention.trashDays，缺省 30，可配 1–365，SV-11）。按移入时间倒序（DS-84）。" +
        "卡片：封面变淡（60%）、第二行「N 天后永久删除」、右下常驻「恢复」（outline：画布底上的次按钮，DS-37、TB-128）；回收站里的文档不能打开（同 Figma）——卡片不是链接、不铺悬停底。" +
        "键盘（TB-107）：回收站卡片同样在漫游网格里、可聚焦（role=group），Enter 不打开；⇧F10 / 菜单键开「恢复 ┊ 永久删除…」（首项就是「恢复」，所以「恢复」按钮与「⋯」都不进 Tab 顺序，指针照常可点）；右键也是这份菜单（不是链接，没有原生链接菜单要留）。" +
        "读屏名写明在回收站中：「旧版产品介绍，在回收站中，21 天后永久删除」。永久删除只在这里发起（50/02 §8「owner 的 ⋯」一句随 DS-85 删去）。只列我拥有的（filter=trashed）。" +
        "「恢复」失败（rulings §4.25 TB-155，没有单画）：主区底部轻提示「无法恢复「〈名〉」」+「重试」，同永久删除失败",
      page: { shell: { current: "trash", title: "回收站", actions: null }, data: data({ view: "trash", milestone: "M3" }) },
    },
    {
      id: "trash-m2",
      title: "回收站 · M2",
      note: "M2 只有移入与恢复，没有到期清理与永久删除（SV-11、G-64 是 M3）：说明行改为「移到回收站的文档可以在这里恢复」，卡片第二行「9 天前移到回收站」（不写剩余天数，读屏名「旧版产品介绍，9 天前移到回收站」）；「⋯」里的「永久删除…」留在原位、不可用并标 M3（右侧「后续版本提供」，FE-06，同「幻灯片大小…」标 P2 的画法）",
      page: { shell: { current: "trash", title: "回收站", actions: null }, data: data({ view: "trash", trashM2: true, menuOn: "old-intro" }) },
    },
    {
      id: "purge-confirm",
      title: "永久删除确认",
      note:
        "rulings §4.25 DS-85：DS-40 第三档（不可撤销的销毁）用模态确认框，不要求输入文档名（50/02 §8「强确认（输入文档名）」随 DS-85 删去）：标题「永久删除「Q1 周报合集」？」，说明「删除后无法恢复。」（对话框说明句末加句号，DS-62；同标杆 Figma「You won't be able to restore it.」、Drive「This can't be undone.」，只讲无法恢复），" +
        "危险主按钮「永久删除」、次按钮「取消」，初始焦点在「取消」（50/10 规则 3）；Esc / 取消关闭后焦点回到这张卡片。" +
        "不写「协作者将失去访问」：回收站里的文档在移入时已关闭在线会话（60/04 表 2-1 active→trashed 发 close，reason trashed）、对所有者以外的人返回 404（表 2-2），永久删除之后无法恢复。文案「永久删除文档」与「彻底删除元素」分开（CO-07）",
      page: { shell: { current: "trash", title: "回收站", actions: null }, data: data({ view: "trash", purge: "q1-weekly", milestone: "M3" }) },
    },
    {
      id: "purging",
      title: "永久删除进行中",
      note: "确认后卡片留在原位：「恢复」与「⋯」收起，第二行换成转圈 +「正在永久删除…」（role=status；读屏名「Q1 周报合集，正在永久删除」；进度只在回收站视图显示，purging 状态的文档对其余路由都是 404，前端自己跟踪作业，50/02 §8）；作业完成后卡片消失，轻提示「已永久删除「Q1 周报合集」」；失败时轻提示 +「重试」（同 duplicating 的轻提示画法）",
      page: { shell: { current: "trash", title: "回收站", actions: null }, data: data({ view: "trash", purging: "q1-weekly", milestone: "M3" }) },
    },
    {
      id: "trash-blocked",
      title: "所有者打开回收站里的文档",
      host: "editor",
      note:
        "rulings §4.25 DS-85：回收站里的文档不能打开；所有者从旧链接或书签打开时，编辑器换成阻断页（kit BlockingPage，同第 1 批「打开失败」：不渲染左栏、检查器与工具条）——32px 回收站图标 · 文档名「旧版产品介绍」（回收站里 21 天后到期的那一份）· 标题「此文档在回收站中」· 说明「恢复后即可打开和编辑；21 天后将永久删除」（阻断页说明一律不加句号；M2 没有到期清理，只写「恢复后即可打开和编辑」）· 主按钮「恢复」（恢复后照常打开）·「返回文档列表」（落「最近」，DS-79）。" +
        "其他人按角色分两种（60/02 §6 守卫顺序：DocumentRoleGuard 在前、DocumentStateGuard 在后）：有角色的非所有者（编辑者、评审者、查看者，或持有效链接的人）得 404，看到 shell-pages.not-found-doc「找不到该文档」（DS-122；60/04 表 2-2：trashed 的 meta 只给 doc.manage）；" +
        "从未获授权的人得 403，看到「你没有权限访问此文档」+「申请访问」（TB-73：照常记下申请、不透露在回收站）。" +
        "「恢复」失败（rulings §4.25 TB-155，没有单画）：沿用登录页的内联错误画法（DS-120）——主按钮上方一行危险色图标 +「无法恢复「旧版产品介绍」，请稍后重试」（role=alert），按钮恢复可用。未采纳的只读预览见 alt-trash-preview",
      editor: {
        toolbar: { hidden: true, collapse: true },
        regions: { leftRail: () => null, inspector: () => null, stage: () => <TrashBlockedPage /> },
      },
    },
    {
      id: "search-dropdown",
      title: "搜索框下拉",
      note:
        "rulings §4.25 DS-80（采纳原备选「搜索框下拉」，2026-10-22 由 alt-search-dropdown 转正）：主区不变，左栏搜索框下方弹出即时结果（宽 340、左对齐）——前 5 条：48 宽小封面 · 标题 · 编辑者与时间，点一条按我的角色进编辑器；末行「查看全部结果」进结果页（search）；不写数量（游标分页没有总数）；没有命中时一行「没有匹配「…」的文档」（检索词用「」包、不断行）。" +
        "开始页与文档列表的搜索框都是它（kit ShellSearch，应用壳的缺省）。键盘与读屏按组合框（设计 07 §1.2）：焦点一直留在搜索框里，↓ / ↑ 在前 5 条与「查看全部结果」之间移动，↵ 打开当前项（还没移动过时 ↵ 就是「查看全部结果」），Esc 先收起下拉、再按清空搜索词，点外面收起。⌘K / Ctrl+K 聚焦搜索框（开始页作用域，DS-11）。离线时只搜本机缓存的列表（产品）",
      page: { shell: { current: "recent", title: "最近", search: <ShellSearch initial="预算" /> }, data: data({ view: "recent" }) },
    },
    {
      id: "search",
      title: "搜索结果",
      note:
        "rulings §4.25 DS-80：搜索框下拉的「查看全部结果」（或在搜索框里按 ↵）进这一页——/documents?filter=all&q=预算：左栏搜索框里留着检索词、右侧是清除 ×，主导航没有当前项；顶栏标题只写「搜索「预算」」（检索词用「」包、整段不断行，同已拍板的「没有匹配「…」的人」），列表头与结果都不写数量（游标分页没有总数，标杆也不写）；" +
        "范围是能访问的全部文档、不含回收站，结果用同一张卡片（菜单按各自视图与角色，链接与键盘同 recent）；在搜索框里改检索词照样弹下拉，「查看全部结果」换成新的检索词；Esc 或 × 清空并回到搜索前的页面（从开始页搜的回开始页）。" +
        "未采纳（DS-80 定为搜索框下拉）：原推荐的「边输边搜」——在搜索框里输入第一个字就把主区换成这一页、随输入刷新，Esc 回到搜索前；画面就是这一页，所以拍板时借它对照、没有另画。写结果数的备选（列表全部取回时才写，或后端 GET /documents 补 total）只作文字说明，同样未采纳",
      page: { shell: { current: null, title: <SearchTitle />, search: <ShellSearch results initial="预算" /> }, data: data({ view: "search", searchPage: true, q: "预算" }) },
    },
    {
      id: "search-empty",
      title: "搜索无结果",
      note: "03-01「搜索无结果」两句（DS-80 的结果页没有命中时；下拉里没有命中时仍有「查看全部结果」进来）：居中的整块状态（DS-53 同一画法，中性图标）「没有匹配「年报」的文档」+「检查拼写，或尝试其他关键词」；检索词用「」包、不断行，句式同已拍板的分享「没有匹配「…」的人」与图标库「没有匹配「…」的图标」；不放按钮。顶栏「搜索「年报」」",
      page: { shell: { current: null, title: <SearchTitle fallback="年报" />, search: <ShellSearch results initial="年报" /> }, data: data({ view: "search", searchPage: true, q: "年报" }) },
    },
    {
      id: "empty",
      title: "我的文档为空",
      note: "没有任何文档：内容区居中的整块状态（DS-53 画法，中性 Presentation 图标）「这里还没有任何文档」+「新建一份演示文稿，或导入已有的 .pptx 文件」，不放按钮（rulings §4.25 DS-88：空态只留引导句，顶栏已有「导入 .pptx」「新建演示文稿」，入口不重复；照 PRD AS-02 原文放次按钮的未采纳备选见 home.alt-empty-create）。不显示列表头",
      page: { shell: { current: "mine", title: "我的文档" }, data: data({ view: "mine", phase: "empty" }) },
    },
    {
      id: "shared-empty",
      title: "与我共享为空",
      note: "03-01：「还没有人与你共享文档」+「别人与你共享的演示文稿会显示在这里」，不放按钮（这一视图里用户不是所有者）",
      page: { shell: { current: "shared", title: "与我共享" }, data: data({ view: "shared", phase: "empty" }) },
    },
    {
      id: "trash-empty",
      title: "回收站为空",
      note: "G-64 空态文案：「回收站是空的」+「移到回收站的文档会保留 30 天，期间可以恢复」（M3；天数读配置。M2 写「移到回收站的文档可以在这里恢复」）",
      page: { shell: { current: "trash", title: "回收站", actions: null }, data: data({ view: "trash", phase: "empty" }) },
    },
    {
      id: "loading",
      title: "加载中",
      note: "rulings §4.25 DS-86：统一为 DS-53——真实加载超过 300 ms 才出现，内容区居中一行加载行（转圈 14 +「正在加载文档…」，role=status），不画骨架卡片、不显示空态、不显示列表头；左栏、顶栏照常可用。03-01、50/02 §9.2 与 40/11 的「骨架卡片」随 DS-86 改为「加载中」（开始页未采纳的骨架备选见 home.alt-loading-skeleton）",
      page: { shell: { current: "recent", title: "最近" }, data: data({ view: "recent", phase: "loading" }) },
    },
    {
      id: "error",
      title: "加载失败",
      note: "DS-53 面板整块出错的同一画法：内容区居中——危险色图标 20 ·「文档列表加载失败」·「请检查网络连接后重试」·「重试」（role=alert）。「重试」是画布底上的次按钮，用 outline（rulings §4.25 TB-128：kit 约定 outline 用在画布底上，亮色画布上才看得出按钮；同模板库、阻断页）；不显示列表头，左栏、顶栏照常可用",
      page: { shell: { current: "recent", title: "最近" }, data: data({ view: "recent", phase: "error" }) },
    },
    {
      id: "offline",
      title: "离线",
      note:
        "rulings §4.25 DS-92：应用壳的横幅在主区顶栏之下、只横跨主区（导航不动、标题不跳），最多两条叠放；高 40（DS-75）。离线横幅与编辑器同一个件（第 1 批 main-states.offline：警告浅底 + CloudOff，DS-41；「立即重连」= 立即探测一次连接，50/02 §9.5），正文改为列表页的说法「列表为最近一次取到的内容；本次打开过的文档可以继续编辑，其余操作将在恢复连接后可用」（M2 只有本会话里仍保活的文档能打开，50/02 §2.2、§9.1；与开始页 home.offline 同一说法；03-01「离线时无法打开未缓存的文档」一句随之改）。" +
        "「导入 .pptx」「新建演示文稿」留在原位、不可用，工具提示「离线时不可用」；「新建演示文稿」保持 kit 主按钮的不可用态（DS-123：与第 2 批「申请访问」发送后一致，不改 outline；「导入 .pptx」本来就是画布底上的 outline 次按钮）。" +
        "仍保活的 2 份照常，其余卡片变淡、不能打开（不是可跳转的链接，role=link + aria-disabled，仍在漫游网格里能停上去；工具提示与读屏名「离线时只能打开本次打开过的文档」）；「⋯」里除「分享…」外全部留在原位、不可用，顶部一行「离线时不可用」；「分享…」M2 本来就不可用，照写它自己的原因「后续版本提供」（rulings §4.25 DS-137；M3 起离线时打开离线形态的分享对话框：成员为离线前的缓存、邀请与链接不可用，第 2 批 share.offline）",
      page: {
        shell: { current: "recent", title: "最近", banner: OFFLINE_BANNER, actions: <ShellDefaultActions reason="离线时不可用" /> },
        data: data({ view: "recent", offline: true }),
      },
    },
    {
      id: "list",
      title: "列表显示",
      note: "rulings §4.25 DS-84：复用开始页的网格 / 列表切换，不加排序（按最近活动倒序）。列表行与已拍板首页列表同一画法：120 封面 · 标题（标题后图钉与角色徽标）· 编辑者 96 · 时间 132 · 头像；行内边距 8、圆角 8、悬停铺底；「⋯」在行尾。不画列名行（同首页）。每行是一个链接，键盘同网格（↑ ↓ 上下一行，TB-107）",
      page: { shell: { current: "mine", title: "我的文档" }, data: data({ view: "mine", layout: "list" }) },
    },
    {
      id: "load-more",
      title: "滚动翻页",
      note: "rulings §4.25 DS-86：游标分页 + 虚拟滚动，滚到底前 1 屏预取下一页；翻页时列表末尾追加一行加载行「正在加载更多文档…」，不整页替换（50/02 §9.2）。列表头不写数量（还有下一页时本来就没有总数；DS-80 一律不写）。新追加的卡片接着进漫游网格（方向键走到末尾再往下就是新的一行）。状态一出现就滚到底",
      page: { shell: { current: "mine", title: "我的文档" }, data: data({ view: "mine", loadMore: true }) },
    },
    {
      id: "duplicating",
      title: "创建副本进行中",
      note: "「创建副本」是服务端作业（POST /documents/:id/duplicate，带 Idempotency-Key，50/02 §8）：主区底部轻提示「正在创建「供应商评估」的副本…」（转圈，没有关闭按钮），作业成功后直接进入新文档；不生成占位卡片（UX-14）；失败时轻提示「无法创建副本」+「重试」（沿用同一 Idempotency-Key）。版本历史最早一条写「创建自『供应商评估』的副本」（DS-70）",
      page: { shell: { current: "mine", title: "我的文档" }, data: data({ view: "mine", toast: { text: "正在创建「供应商评估」的副本…", busy: true } }) },
    },
    {
      id: "access-changed",
      title: "访问权限被收回",
      note: "03-01「边界情况」：别人收回了我对某份文档的访问，那张卡片从列表淡出，其后补位；轻提示「「市场活动复盘」的访问权限已被更改」只出一次（中性，可关闭）",
      page: { shell: { current: "shared", title: "与我共享" }, data: data({ view: "shared", hidden: ["campaign"], toast: { text: "「市场活动复盘」的访问权限已被更改" } }) },
    },
    {
      id: "share-from-card",
      title: "从卡片打开分享",
      note:
        "卡片「分享…」直接在列表上打开第 2 批的分享对话框（03-08 同一个件、同一画法，顶部锚定，标题是那份文档的名字），不进编辑器。路由（rulings §4.25 TB-109）：对话框叠在当前列表路由上——/documents?share=<id>（开始页是 /home?share=<id>），" +
        "关闭（× / Esc）回到原列表与原滚动位置、焦点回到这张卡片，浏览器后退等于关闭；前端 50/02 §2 写明这一种（?share=<id> 叠在壳页面路由上，编辑器内的分享仍是继承编辑器父路由的 /documents/:id/share）。非所有者打开的是只读的「谁能访问…」（DS-48，第 2 批 share.no-permission）。" +
        "这一态是 M3（PRD CO-15：分享在 M3 开放）：M2 的「分享…」留在原位、不可用（rulings §4.25 DS-137，见 card-menu）",
      page: { shell: { current: "recent", title: "最近" }, data: data({ view: "recent", share: true, milestone: "M3" }) },
    },
    {
      id: "reader-doc-name",
      title: "编辑器里查看者的文件名",
      host: "editor",
      note: "rulings §4.25 DS-82（按 U-09）：评审者与查看者没有「创建副本」，编辑器文档菜单里就没有任何条目，左栏顶部的文件名不再是菜单触发器——只显示文件名（13px 600，没有 ▾、不响应悬停与点按、不进 Tab 顺序；读屏照常读到文件名）。2026-10-22 起这就是底座的画法（第 1 批 main-states.viewer / commenter 随之改），这一态与 main-states.viewer 是同一个文件名。编辑者在评审模式下不变（文件名 ▾ 仍有重命名 · 创建副本 ┊ 版本历史）",
      editor: {
        mode: "viewer",
        stage: { cursor: false },
      },
    },

    {
      id: "drop-import",
      title: "拖入 .pptx",
      note: "rulings §4.25 TB-180（DS-140、DS-141，2026-10-23）：文档列表保留的拖入落区——文件拖进主区时，顶栏以下整块换成落区（画布底色上内缩 16 的落区框：强调色 1px 虚线 + 强调色淡底（panel 上叠 --v3-accent-soft，与「导入」对话框里的拖入悬停同色；直接叠在画布底上时亮色说明行对底只有 4.25:1，DS-9）、圆角 8，取代原来中性的 --v3-border-control 虚线；居中 32px FileUp ·「松开以导入」·「只支持 .pptx，单个文件最大 200 MB」，kit DropOverlay），松开即在原页上打开「导入」对话框的上传态（import.dialog-uploading），焦点落在「取消」，不在列表里生成占位卡（UX-14）；拖出窗口或 Esc 恢复。回收站视图不接收拖放（落区不出现）。顶栏「导入 .pptx」打开同一个对话框、从选文件开始（import.dialog-documents），这里是第二条路。同开始页 home.drop-import（02 F1 的文档列表拖拽上传即这一条，前端 50/02 §9.1、§9.2 写明）。样张里可以真的从桌面拖一个文件进来试（2026-10-23 按 rulings §4.25 TB-180 改）",
      page: { shell: { current: "mine", title: "我的文档" }, data: data({ view: "mine" }), overlay: <DropOverlay /> },
    },
    {
      id: "compact",
      title: "紧凑窗口 640–1024",
      note: "rulings §4.25 DS-87（视口 1000 × 760，同 home.compact）：左栏收成左侧抽屉，顶栏左端「显示导航」开关（28；抽屉就是左栏本身，role=region「导航」，展开后同一位置是按下态的「收起导航」，画法与焦点交接见 home.compact-drawer）；卡片网格四列改三列，列表头、卡片、菜单与键盘不变（↑ ↓ 按三列走）。" +
        "手机（< 640）是单列与抽屉，同开始页手机形态（home.phone：不放「导入 / 新建」，顶部一行「在更大窗口中新建或导入演示文稿」，单列、「⋯」常显、开关与抽屉各行 44，列表头不放网格 / 列表切换）；" +
        "平板（触控、≥ 640）左栏与列数按窗口宽度，同桌面与紧凑（≥ 1024 左栏常驻、四列；640–1024 抽屉、三列，rulings §4.25 TB-165），保留列表头的网格 / 列表切换（同桌面与紧凑，开始页「最近」的排序菜单同此，只有手机不放），搜索框随左栏、命中区 44、不写 ⌘K（TB-170）；" +
        "其余照触控形态（不提供新建与导入、顶部提示行写「在电脑上新建或导入演示文稿」（TB-153）、命中区 44、「⋯」常显，03-01 §9）",
      page: {
        shell: { current: "mine", title: "我的文档", rail: false, headerStart: <NavToggle /> },
        overlay: (
          <>
            <HomeDrawer current="mine" />
            <LibraryToasts />
          </>
        ),
        data: data({ view: "mine", cols: "grid-cols-3" }),
      },
    },

    /* ---------------------------------------------------------------- 未采纳的备选（DS-63） */
    {
      id: "alt-filter-tabs",
      title: "未采纳 · 页内分段筛选",
      note: "未采纳（DS-79 定为左栏即筛选，见 recent）：保留页内分段筛选「全部 / 我拥有 / 共享给我 / 最近 / 回收站」（50/02 filter 原样，分段控件 kit Segmented），左栏还是四项、只作预置筛选（这里从「我的文档」进来，分段停在「我拥有」），页面标题统一为「文档」；同一筛选有左栏与分段两个常驻入口（Q2），回收站只在页内。列表头同样不写数量（DS-80）",
      page: { shell: { nav: SHELL_NAV.filter((n) => n.id !== "trash"), current: "mine", title: "文档" }, body: <FilterTabsBody /> },
    },
    {
      id: "alt-sort-menu",
      title: "未采纳 · 列表头排序菜单",
      note: "未采纳（DS-84 定为复用切换、不加排序，见 mine）：列表头在网格 / 列表切换右侧加排序菜单，与已拍板首页「最近」同一位置、同一份条目与次序（最近打开 / 最近编辑 / 名称 / 创建时间，选了即收起）；只有缺省项不同——「我的文档」缺省「最近编辑」。REST 要补 sort 参数与索引、createdAt（60/15 §3.3）。列表头不写数量（DS-80）",
      page: { shell: { current: "mine", title: "我的文档" }, body: <SortMenuBody /> },
    },
    {
      id: "alt-trash-preview",
      title: "未采纳 · 回收站里的文档打开为只读预览",
      host: "editor",
      note: "未采纳（DS-85 定为回收站里不能打开、所有者看到阻断页，见 trash-blocked）：所有者打开回收站里的文档时进编辑器的只读形态（只读浏览，Google Drive 的做法），画布顶部横幅「此文档在回收站中 · 恢复后才能编辑；21 天后永久删除」+「恢复」（中性底 + 回收站图标）；编辑器要多一种只读状态（检查器说明行「只读 · 此文档在回收站中」，「分享」不可用）。这里借用编辑器的示例文档只为对照形态（回收站里实际是「旧版产品介绍」等，见 trash-blocked）",
      editor: {
        mode: "viewer",
        stage: { cursor: false },
        banner: (
          <Banner tone="info" icon={<Trash2 {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />} title="此文档在回收站中" actions={<Button variant="secondary">恢复</Button>}>
            恢复后才能编辑；21 天后永久删除
          </Banner>
        ),
        inspector: { notice: <InspectorNotice icon={<Lock {...ICON} aria-hidden="true" />}>只读 · 此文档在回收站中</InspectorNotice>, collaborators: { people: [ME] }, share: { reason: "文档在回收站中" } },
      },
    },
  ],
})
