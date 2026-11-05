import { OfflineBanner } from "../../kit"
import { defineScenario } from "../types"
import { PreviewDialog, TemplatesBody, tplData } from "./TemplateLibrary"

/**
 * 模板库 /templates（rulings §4.25 DS-72 最小样张；PRD AS-03 M3、G-76）：宿主 #/v3/templates（kit ShellLayout，应用壳用底座缺省：左栏 5 项照常跳页 DS-79、搜索框下拉 DS-80、帮助菜单 DS-89）。
 * 入口只有开始页「更多模板 →」（M3，home.m3-more-templates）；左栏「首页」保持当前项（模板库是首页的下一层，读屏 aria-current="true"）。
 * 前端 50/02 §2 已登记路由 /templates（RequireSession），端点在 60/15 登记前不渲染入口（50/02 §13.3）；M3 只做来源分段与预览（DS-93，AS-03 删去「分类、搜索」）；模板来源与审核仍待决（PD-23）。
 * 摸底建议的「G-76 右侧预览抽屉」对照态不画：DS-72 已定为预览对话框（lg 640）；DS-93 未采纳的「保留分类与搜索」只作文字说明。
 */

export default defineScenario({
  id: "templates",
  title: "模板库",
  specs: ["03-29"],
  batch: 3,
  host: "templates",
  summary: "DS-72 最小样张：来源分段（配置了才有）、同首页的模板卡、预览对话框与「使用此模板」、模板源加载中 / 失败、离线",
  page: {
    shell: { current: "home", currentAria: "true", title: "模板", actions: null, accountMenu: { milestone: "M3" } },
    body: <TemplatesBody />,
    layers: <PreviewDialog />,
  },
  states: [
    {
      id: "default",
      title: "模板库（M3，配置了集成方模板源）",
      note:
        "DS-72：壳内页面，左栏「首页」保持当前项（上级导航项：读屏 aria-current=\"true\"，不念成「当前页面」，HAT-12）；顶栏标题「模板」，不放「导入 .pptx」「新建演示文稿」，模板网格里也不含「空白」（rulings §4.25 TB-110：模板库只做从模板新建，新建空白与导入在开始页）。M3 只做来源分段与预览（DS-93：AS-03 删去「分类、搜索」；未采纳的「保留分类与搜索」只作文字说明）。" +
        "来源分段「全部 · 内置 · 公司模板」（kit Segmented 单选；来源名由集成方配置，示例名不代表任何真实机构）只在集成方配置了模板源时出现（没配置见 no-source）；「全部」按来源分组：组标题 13px 600（不写数量：列表头一律不写数量，DS-80），组间距 24。" +
        "模板卡与首页「从模板开始」同一画法（16:9 真实封面、圆角 6 + 1px 边、悬停描边变强调色；名称 12px text-2，悬停转 text），五列；内置 5 套就是首页与主题画廊的那 5 套（DS-33）。点卡片打开预览（preview）。" +
        "键盘（rulings §4.25 TB-107，与文档卡片网格同一份）：Tab 到分段，再 Tab 进每一组的网格各停一次（落在上次那张），方向键 / Home / End 在组内的卡片间走，Enter 打开预览",
      page: { data: tplData({}) },
    },
    {
      id: "preview",
      title: "预览",
      note:
        "DS-72：点模板打开预览对话框（kit Dialog lg 640，顶部锚定）：标题是模板名、说明行写来源（「内置模板」/「公司模板 · 由集成方提供」）；正文——首页大图（真实封面，圆角 6 + 1px 边）· 主题色条（强调色 1–6，16px 色块圆角 4；读屏念「6 种主题色」，HAT-12）· 字体（标题 / 正文，同名时写「标题与正文 思源黑体」）·" +
        "「版式 7」一节：按这套模板自己的母版画的版式缩略（HAT-01）——「标题幻灯片」就是封面的样子（商务：藏青标题带 + 蓝色短条、占位符在带上用浅色提示），「章节标题」是同一套的变体（整页藏青），其余版式白底、顶边一条藏青细带；占位符是新建页上的空占位符（虚线框 +「单击此处添加标题」），四列、名称 12px text-2。" +
        "「使用此模板」后的首页就是标题版式（AS-01 / D14），预览里看到的就是用户拿到的（标杆 Keynote 的主题缩略就是标题版式本身）。底栏「关闭」·「使用此模板」（主按钮，以这套模板新建：服务端以模板字节为导入源，§4.19 D-M2-CONTENT；版本历史最早一条「从模板『商务』新建」，DS-70）。Esc / × / 关闭后焦点回到这张卡片。G-76 草稿里的右侧预览抽屉不采用（DS-72 定为对话框）",
      page: { data: tplData({ preview: "business" }) },
    },
    {
      id: "creating",
      title: "正在创建",
      note:
        "「使用此模板」换成 kit 主按钮的不可用态 + 转圈「正在创建…」（kit Dialog 的 busy：aria-busy，不能再点；rulings §4.25 DS-123：对话框与画布底上都用 kit 主按钮的不可用态，不改 outline），背后页面上其余模板卡暂时不可用（变淡，工具提示「正在创建演示文稿」，同开始页 home.creating）；" +
        "作业成功后直接进入编辑器（首页为标题版式，D14），不生成占位卡（UX-14）。关闭对话框不取消作业。失败时对话框留着、主按钮恢复，底栏左侧一行错误（DS-56 对话框内错误的画法）。" +
        "这里是集成方来源的「项目立项」（版式 6 种）：标题幻灯片与章节标题是封面同样的整页青色（右侧斜切深青块与浅青斜条，占位符浅色提示），其余版式白底、顶边一条青色带（HAT-01）",
      page: { data: tplData({ preview: "tpl-kickoff", creating: true }) },
    },
    {
      id: "source-loading",
      title: "模板源加载中",
      note: "rulings §4.25 DS-86 的加载画法（DS-53）：集成方模板源超过 300 ms 还没回来时，它那一组只有一行加载行「正在加载「公司模板」…」（左对齐、行高 32，同第 2 批列表里的加载行），组标题照常；内置模板来自前端内置清单，照常可用",
      page: { data: tplData({ orgPhase: "loading" }) },
    },
    {
      id: "source-error",
      title: "模板源加载失败",
      note: "G-76、DS-72：集成方模板源加载失败时只在它那一组内联报错——危险色图标 · 「模板源加载失败，内置模板不受影响」·「重试」（画布底上的次按钮 outline，rulings §4.25 TB-128，与开始页、文档列表的「重试」同一画法；结构同第 2 批分享对话框里出错行，role=alert）；内置模板照常可用，分段照常（选「公司模板」时只剩这一行）。点「重试」转为加载行、成功后出现模板（可以在样张里点）",
      page: { data: tplData({ orgPhase: "error" }) },
    },
    {
      id: "no-source",
      title: "没有配置模板源",
      note: "DS-72：集成方没有配置模板源时不显示来源分段，也不分组、不写数量（DS-80）——主区就是内置 5 套的网格。M3 的模板库在这种部署里只比开始页多出预览（版式、字体、主题色），入口「更多模板 →」照常",
      page: { data: tplData({ sources: false }) },
    },
    {
      id: "offline",
      title: "离线",
      note: "G-76「离线时禁用」：应用壳横幅（DS-92：顶栏之下、只横跨主区；DS-75 高 40）同开始页离线横幅，正文写这一页的说法；列表为最近一次取到的内容（封面走本机缓存），仍可预览；预览里「使用此模板」留在原位、不可用（对话框里，kit 主按钮的不可用态），工具提示与读屏名「离线时不可用」（FE-06）",
      page: {
        shell: { banner: <OfflineBanner>模板为最近一次取到的内容，可以预览；使用模板将在恢复连接后可用</OfflineBanner> },
        data: tplData({ preview: "minimal", offline: true }),
      },
    },
  ],
})
