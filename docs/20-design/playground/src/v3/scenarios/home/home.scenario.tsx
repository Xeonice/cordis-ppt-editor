import { DropOverlay, LibraryLayers, LibraryToasts, OfflineBanner, ShellDefaultActions, ShellHelpMenu, Toast, Toasts } from "../../kit"
import { HomeBody } from "../../HomeBody"
import { defineScenario } from "../types"
import { HOME_SHELL, HomeDrawer, homeData, NavToggle } from "./HomeMain"

/**
 * 开始页补态（03-29，第 3 批 · 应用壳族）：宿主 #/v3/home（kit ShellLayout）。2026-10-22 拍板（rulings §4.25 DS-79…DS-92，TB-101、TB-107…TB-109、TB-127、TB-128）：
 * 推荐即正式状态，备选标「未采纳 · 」留在样张里（DS-63）；已拍板首页（不带 state）随之换成本场景 m2-default 的画法（底座 HomeBody，第 3 批转正时由这里的 HomeMain 并入）。
 * 应用壳的件都是底座缺省：左栏 5 项真的跳页（首页 → #/v3/home，最近 / 我的文档 / 与我共享 / 回收站 → documents.<视图>）、搜索框下拉（DS-80）、帮助菜单（DS-89）、
 * 用户行打开的账户菜单（三处同一份，DS-90、DS-91）。别组叠在开始页上的状态用 HomeMain.tsx 导出的 HOME_SHELL / HOME_PAGE（home.m2-default 那一版）。
 * 摸底里可选、没有单独画的：search-typing（在开始页搜索：下拉同 documents.search-dropdown，「查看全部结果」进 documents.search）。
 */

/**
 * 离线横幅（DS-92：主区顶栏之下、只横跨主区；画法同第 1 批 main-states.offline，DS-41 浅底、DS-75 高 40）。
 * 前半句与文档列表 documents.offline 同一说法：M2 只有本会话仍保活的文档能打开（50/02 §2.2、§9.1），PRD AS-01 的离线文案随之改
 */
const OFFLINE_BANNER = <OfflineBanner>本次打开过的文档可以继续编辑；新建、模板与导入将在恢复连接后可用</OfflineBanner>

/** 紧凑形态（DS-87，640–1024）：左栏收进抽屉，顶栏左端是「显示导航」开关（28） */
const COMPACT_SHELL = { rail: false, headerStart: <NavToggle /> }

/** 卡片的链接与键盘（TB-107、TB-108），同 documents.recent */
const KEYS =
  "「最近」的卡片是链接（rulings §4.25 TB-108：点按进编辑器，⌘ / Ctrl 点按或中键在新标签页打开，右键是浏览器原生的链接菜单）；整个网格一个 Tab 停靠点，方向键 / Home / End 在卡片间走，Enter 打开，⇧F10 / 菜单键开「⋯」菜单，「⋯」不进 Tab 顺序（TB-107）。「从模板开始」一行 6 张照常逐个 Tab"

export default defineScenario({
  id: "home",
  title: "开始页（补态）",
  specs: ["03-29"],
  batch: 3,
  host: "home",
  summary: "M2 修正、卡片菜单、首次使用、加载 / 出错 / 离线、正在创建、帮助菜单、紧凑与手机形态、拖入导入、普通成员直访管理页",
  page: {
    shell: HOME_SHELL,
    body: <HomeBody />,
    overlay: <LibraryToasts />,
    layers: <LibraryLayers />,
  },
  states: [
    {
      id: "m2-default",
      title: "M2 默认（修正已拍板画面）",
      note:
        "已拍板首页（DS-12）的版式不动，只按 PRD 与 rulings §4.25 第 3 批拍板补齐 M2 的真实样子（2026-10-22 起已拍板首页 #/v3/home 就是这一版）：① 左栏主导航 5 项，第 5 项「回收站」（DS-79，Trash2，画法同其余四项）；② 「从模板开始」行右端不显示「更多模板 →」（AS-03：模板库是 M3，见 m3-more-templates）；" +
        "③ 最近 8 条里新建的「未命名演示文稿」画没有封面时的占位——白纸面 + 居中 24px Presentation 图标，与真实封面同尺寸、不画骨架条（03-29 §2.3、03-01「卡片封面来源」，M2 应用内新建与包内没有封面的导入文档都是它）；④ 卡片第二行统一「编辑者 · 相对时间」，去掉已拍板样张里多出的「编辑」二字（DS-83）；" +
        "⑤ 固定的「2026 年 Q2 业绩汇报」标题后 12px 图钉并排在最前（AS-02）；⑥ 别人共享给我的标题后带角色徽标「可评论 / 仅查看」（UX-19），右下一枚所有者头像；我拥有的共享文档右下叠 2 位协作者（DS-83，TA-10 不改）；⑦ 悬停 / 焦点在卡片里时封面右上出现「⋯」（DS-81，菜单见 card-menu）；" +
        "⑧ 左栏「帮助」打开帮助菜单（DS-89，见 help-menu），用户行打开账户菜单（AS-06，条目见 account-menu 场景）。排序菜单（最近打开 / 最近编辑 / 名称 / 创建时间）照已拍板画面保留：它是开始页这一段的本机视图偏好，不带到文档列表（TB-127）。搜索框输入即在下方弹出前 5 条与「查看全部结果」（DS-80，同 documents.search-dropdown）；顶栏「导入 .pptx」在原页上打开「导入」对话框（rulings §4.25 DS-140，取代 DS-98 的整屏导入页；见 import.dialog）。" +
        KEYS,
      page: { data: homeData({ milestone: "M2" }) },
    },
    {
      id: "card-menu",
      title: "最近卡片的「⋯」菜单",
      note: "rulings §4.25 DS-81：开始页「最近」与文档列表同一个卡片、同一份菜单（AS-02 的「固定 / 分享 / 从最近移除」都在里面）——分享… · 创建副本 · 重命名 ┊ 取消固定（没固定的写「固定」）· 从最近移除 ┊ 移到回收站（只给所有者）；开始页是 M2，「分享…」留在原位、不可用，标 M3、右侧「后续版本提供」（rulings §4.25 DS-137，同 FE-06；M3 起打开分享对话框、叠在 /home?share=<id> 上，TB-109）。点「⋯」或焦点在卡片上按 ⇧F10 / 菜单键打开（TB-107）；右键是浏览器原生的链接菜单（TB-108）。这里是固定了的「2026 年 Q2 业绩汇报」（我拥有）。「从最近移除」不删除文档（可撤销轻提示，见 removed-undo）；「重命名」在开始页同样内联（同 documents.rename）；「分享…」M3 起在开始页上打开分享对话框（路由 /home?share=<id>，TB-109，同 documents.share-from-card；M2 不可用，见上）",
      page: { data: homeData({ milestone: "M2", menuOn: "q2" }) },
    },
    {
      id: "first-run",
      title: "首次使用（最近为空）",
      note: "AS-02 / AS-05：最近区换成空态（DS-53 同一画法，中性 Presentation 图标）「还没有最近打开的文档」+「从上方的模板开始，或新建一份空白演示文稿」，不放按钮（rulings §4.25 DS-88：顶栏已有「新建演示文稿」、模板行第一张就是「空白」，入口不重复；照 AS-02 原文放次按钮的未采纳备选见 alt-empty-create，PRD AS-02 的措辞随之改）。AS-05 的「突出从模板开始」由空态文案指向上方模板行落地，模板行本身不变；不做交互式分步引导，指南经左栏「帮助」菜单进入（DS-89）。空态时「最近」标题行不放网格 / 列表与排序",
      page: { data: homeData({ milestone: "M2", recent: "empty" }) },
    },
    {
      id: "alt-empty-create",
      title: "未采纳 · 空态里放「新建演示文稿」",
      note: "未采纳（DS-88 定为空态只留引导句、不放按钮，见 first-run）：照 PRD AS-02 原文，空态里放次按钮「新建演示文稿」（画布底上的次按钮 outline，TB-128；一屏只有顶栏一个主按钮，S-06）——同一屏就有顶栏主按钮、模板行「空白」与这里三处同一操作（Q2 入口唯一）。文档列表的空态（documents.empty）同一取舍",
      page: { data: homeData({ milestone: "M2", recent: "empty", emptyCreate: true }) },
    },
    {
      id: "loading",
      title: "加载中",
      note: "rulings §4.25 DS-86：统一为 DS-53——真实加载超过 300 ms 才出现，「最近」区居中一行加载行（转圈 14 +「正在加载最近的文档…」，role=status），不画骨架、不显示空态；「最近」标题行的网格 / 列表与排序加载中不放（没有内容可切，同文档列表 documents.loading 不显示列表头；DS-53 第 2 批先例：评论加载时筛选与排序随整栏不可用）。模板行、顶栏与左栏照常可用（模板来自前端内置清单，不等列表）。M2 验收 11、70/06 第 7 行与 §7.2 的「加载骨架」随 DS-86 改为「加载中」，40/11 RecentSection 的 Skeleton × 4 同改。未采纳的骨架备选见 alt-loading-skeleton",
      page: { data: homeData({ milestone: "M2", recent: "loading" }) },
    },
    {
      id: "alt-loading-skeleton",
      title: "未采纳 · 骨架卡片",
      note: "未采纳（DS-86 定为一行加载行、不画骨架，见 loading）：保留骨架卡片（与真实卡片同尺寸的空封面 panel-2 底 + 两条灰条，四列两行 8 张），作为 DS-53「不画骨架」的例外（同第 1 批打开文档时的版式骨架）；网格 / 列表与排序照常（骨架就是卡片的样子）；读屏不念骨架（aria-hidden），另需一个「正在加载」的播报",
      page: { data: homeData({ milestone: "M2", recent: "skeleton" }) },
    },
    {
      id: "error",
      title: "最近加载失败",
      note: "列表请求失败且没有本机缓存（50/02 §9.1）：「最近」区换成整块出错（DS-53 同一画法）——危险色图标 20 ·「最近的文档加载失败」·「请检查网络连接后重试」·「重试」（role=alert；画布底上的次按钮 outline，rulings §4.25 TB-128，同模板库「重试」与阻断页）；标题行不放网格 / 列表与排序。模板行、顶栏与左栏不受影响，新建照常。有缓存时先显示缓存、不报错",
      page: { data: homeData({ milestone: "M2", recent: "error" }) },
    },
    {
      id: "offline",
      title: "离线",
      note:
        "rulings §4.25 DS-92：应用壳页面的横幅在主区顶栏之下、只横跨主区（导航不动、标题不跳），最多两条叠放；DS-75 高 40。离线横幅与编辑器是同一个件（第 1 批 main-states.offline：警告浅底 + CloudOff，DS-41；「立即重连」立即探测一次连接，50/02 §9.5），" +
        "正文「本次打开过的文档可以继续编辑；新建、模板与导入将在恢复连接后可用」（前半句与文档列表 documents.offline 同一说法：M2 只有本会话仍保活的文档能打开，50/02 §2.2；PRD AS-01 的「可打开最近的文档继续编辑」随之改）。" +
        "「导入 .pptx」「新建演示文稿」与 6 张模板卡留在原位、不可用（变淡、不响应悬停），工具提示与读屏名「离线时不可用」（FE-06）；「新建演示文稿」保持 kit 主按钮的不可用态（DS-123：与第 2 批「申请访问」发送后一致，不改 outline）。" +
        "最近里本会话仍保活的 2 份（Q2 业绩汇报、未命名演示文稿）照常可开，其余变淡、不能打开，工具提示「离线时只能打开本次打开过的文档」（M2 无跨刷新的离线库）；卡片「⋯」里除「分享…」外全部留在原位、不可用，顶部一行「离线时不可用」；「分享…」M2 本来就不可用，照写它自己的原因「后续版本提供」（rulings §4.25 DS-137；M3 起离线时打开离线形态的分享对话框，第 2 批 share.offline）",
      page: {
        shell: { banner: OFFLINE_BANNER, actions: <ShellDefaultActions reason="离线时不可用" /> },
        data: homeData({ milestone: "M2", offline: true }),
      },
    },
    {
      id: "creating",
      title: "正在创建",
      note: "点了模板卡「商务」后（50/02 §8，§4.19 D-M2-CONTENT：服务端以内置模板字节为导入源建档）：被点的卡片名称换成转圈 +「正在创建…」（role=status，aria-busy），封面不变；其余模板卡与顶栏「导入 .pptx」「新建演示文稿」暂时不可用（变淡，工具提示「正在创建演示文稿」；「新建演示文稿」保持 kit 主按钮的不可用态，rulings §4.25 DS-123）；作业成功后直接进入编辑器（首页为标题版式，D14），版本历史最早一条写「从模板『商务』新建」（DS-70）；不生成占位卡片（UX-14）。从顶栏「新建演示文稿」新建时，同一个按钮保持 kit 主按钮的不可用态 + 转圈「正在创建…」（宽度不变，DS-123；kit ShellDefaultActions busy）",
      page: {
        shell: { actions: <ShellDefaultActions reason="正在创建演示文稿" /> },
        data: homeData({ milestone: "M2", creating: "business" }),
      },
    },
    {
      id: "create-failed",
      title: "新建失败",
      note: "前端 50/02 §8「新建」一行与 §9.1 creating 按这一态写明（导入的进度与失败都在「导入」对话框里原位显示（DS-140），新建没有对话框，失败落在开始页上）：服务端建档失败时入口恢复可用，主区底部轻提示（错误，role=alert）「无法新建演示文稿」+「重试」（重试沿用同一 Idempotency-Key，不会建出两份）；文案登记在 50/02 §8，设计 03-29 §3 同此",
      page: {
        data: homeData({ milestone: "M2" }),
        overlay: (
          <Toasts bottom={24}>
            <Toast tone="error" action="重试">
              无法新建演示文稿
            </Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "removed-undo",
      title: "从最近移除",
      note: "AS-02：「从最近移除」不删除文档——卡片立即移走、其后补位，焦点交给相邻卡片；主区底部轻提示「已从最近移除「设计评审」」+「撤销」（5 秒，到期才真正发请求，50/02 §8；文档名用「」包，与「已将「…」移到回收站」同一写法）；文档仍在「我的文档」或「与我共享」里",
      page: { data: homeData({ milestone: "M2", hidden: ["review"], toast: { text: "已从最近移除「设计评审」", action: { label: "撤销", kind: "undo-hide" }, id: "review" } }) },
    },
    {
      id: "help-menu",
      title: "帮助菜单",
      note: "rulings §4.25 DS-89：左栏「帮助」打开帮助菜单（向上、左对齐，与用户行的账户菜单同一落位；菜单开着时「帮助」铺 panel-2）。只列集成方配置了链接的条目（RuntimeConfig.help），都在新标签页打开、右侧 12px 外链图标（ExternalLink 方框加箭头，与第 2 批「在新标签页中登录」、DS-52 同一个；ArrowUpRight 是站内跳转）、读屏名带「在新标签页打开」：5 分钟快速入门 · 母版与版式 · 协同编辑 ┊ 键盘快捷键 ⌘/（始终都在，打开快捷键面板；开始页上浮在主区右上，DS-115）┊ 帮助中心 · 新功能。不做站内占位指南页（AS-04「内置指南」随 DS-89 删去）；编辑器主菜单「帮助 › 帮助中心」同一规则（第 1 批画面随之改）",
      page: { shell: { help: <ShellHelpMenu open /> }, data: homeData({ milestone: "M2" }) },
    },
    {
      id: "help-menu-unconfigured",
      title: "帮助菜单 · 没配置帮助链接",
      note: "rulings §4.25 DS-89：集成方什么都没配置时菜单只剩「键盘快捷键 ⌘/」（左栏「帮助」仍在，因为快捷键面板始终可用）；账户菜单的「帮助中心」按同一规则不出现（account-menu.member 的说明）",
      page: { shell: { help: <ShellHelpMenu open configured={false} /> }, data: homeData({ milestone: "M2" }) },
    },
    {
      id: "m3-more-templates",
      title: "M3：更多模板",
      note: "AS-03 M3：「从模板开始」行右端出现「更多模板 →」（12px text-2，悬停转 text；命中区补足 24 高、外观不变，WCAG 2.5.8，03-29 §4），点了进模板库（templates.default，DS-72、DS-93）。M3 起封面由服务端渲染（SV-04）：「未命名演示文稿」换成真实封面（空白标题页）",
      page: { data: homeData({ milestone: "M3" }) },
    },
    {
      id: "drop-import",
      title: "拖入 .pptx",
      note: "rulings §4.25 TB-180（DS-140、DS-141，2026-10-23）：开始页与文档列表保留的拖入落区——文件拖进主区时，顶栏以下整块换成落区（画布底色上内缩 16 的落区框：强调色 1px 虚线 + 强调色淡底（panel 上叠 --v3-accent-soft，与「导入」对话框里的拖入悬停同色；直接叠在画布底上时亮色说明行对底只有 4.25:1，DS-9）、圆角 8，取代原来中性的 --v3-border-control 虚线；居中 32px FileUp ·「松开以导入」·「只支持 .pptx，单个文件最大 200 MB」，kit DropOverlay），松开即在原页上打开「导入」对话框的上传态（import.dialog-uploading），焦点落在「取消」，不在列表里生成占位卡（UX-14）；拖出窗口或 Esc 恢复。浏览器拖动中拿不到文件名，所以不写文件名。顶栏「导入 .pptx」打开同一个对话框、从选文件开始（import.dialog），这里是第二条路。文档列表同一画法（documents.drop-import）。样张里可以真的从桌面拖一个文件进来试（2026-10-23 按 rulings §4.25 TB-180 改）",
      page: { data: homeData({ milestone: "M2" }), overlay: <DropOverlay /> },
    },
    {
      id: "compact",
      title: "紧凑窗口 640–1024",
      note:
        "rulings §4.25 DS-87（视口 1000 × 760）：左栏收成左侧抽屉，顶栏左端加「显示导航」开关（28 图标按钮，aria-expanded / aria-controls；展开画法见 compact-drawer）；「从模板开始」六张等宽、最小 156——这一宽度下正好铺满一行、右缘与「最近」网格对齐，窗口再窄放不下时才一行横向滚动（不换行、不缩小封面）；" +
        "「最近」网格改三列（↑ ↓ 按三列走，TB-107）；其余与桌面相同（非触控，顶栏两个按钮照常）。手机（< 640）是单列与抽屉（phone）；平板（触控、≥ 640）左栏与列数按窗口宽度，同桌面与紧凑（≥ 1024 左栏常驻、四列；640–1024 抽屉、三列，rulings §4.25 TB-165），" +
        "保留网格 / 列表切换与「最近」的排序菜单（同桌面与紧凑，只有手机不放），搜索框随左栏、命中区 44、不写 ⌘K（TB-170）；其余照触控形态（不提供新建与导入、命中区 44、「⋯」常显，03-29 §2.6）",
      page: { shell: COMPACT_SHELL, overlay: <><HomeDrawer /><LibraryToasts /></>, data: homeData({ milestone: "M2", form: "compact" }) },
    },
    {
      id: "compact-drawer",
      title: "紧凑窗口 · 导航抽屉展开",
      note:
        "rulings §4.25 DS-87（与编辑器紧凑形态的抽屉同一套，03-02 §5a「开与关在同一处点」、07 §1.2「抽屉（紧凑形态）」）：抽屉就是左栏本身（宽 220、整高、浮层阴影 --v3-shadow），盖在主区左侧、不加遮罩（背后的页面照常可用），读屏 role=region「导航」（非模态，不是对话框）。" +
        "第一行最左是按下态的同一枚 PanelLeft「收起导航」，与顶栏「显示导航」开关在同一位置（左 32、上 14，28），品牌行右移让位；顶栏的开关被盖住时移出 Tab 顺序与读屏（inert，WCAG 2.4.11）。" +
        "用户展开时焦点交给「收起导航」；点它、Esc、点导航项都收起，收起后焦点交回顶栏「显示导航」（先交焦点再卸载，不经过 body）。读屏名与工具提示统一「显示导航 / 收起导航」",
      page: { shell: COMPACT_SHELL, overlay: <><HomeDrawer /><LibraryToasts /></>, data: homeData({ milestone: "M2", form: "compact", drawer: true }) },
    },
    {
      id: "phone",
      title: "手机（< 640）",
      note:
        "rulings §4.25 DS-87（视口 390 × 844）：这是手机（< 640）的形态；平板（触控、≥ 640）的左栏与卡片列数按窗口宽度取，同桌面与紧凑（≥ 1024 左栏常驻、四列；640–1024 抽屉、三列，DS-87），「最近」的网格 / 列表切换与排序菜单照常保留、搜索框随左栏（TB-170），" +
        "其余照触控形态——不提供新建与导入、顶部提示行写「在电脑上新建或导入演示文稿」（TB-153）、命中区 44、「⋯」常显（TB-165）。" +
        "不渲染「从模板开始」一行与顶栏「新建演示文稿」「导入 .pptx」，顶部一行「在更大窗口中新建或导入演示文稿」（12px text-2 + Monitor 图标；这是 < 640 的写法，手机不论是否触控都这样写（TB-163）；平板的写法见上：触控设备是因为触控才不能新建、不是窗口小，rulings §4.25 TB-153，与 TB-125、TB-136 同一理由，样张没有单画平板开始页）；提示行之下是搜索框（触控高 44，下拉同桌面，DS-80）；" +
        "左栏收进抽屉：顶栏左端「显示导航」开关 44（07 §2 命中区尺寸：pointer: coarse 或 < 640 主要控件 ≥ 44），抽屉同一位置是 44 的「收起导航」，抽屉里导航项、帮助、用户行都是 44 高、间距 8，不再放搜索框；" +
        "「最近」单列，卡片「⋯」常显在文字行末、44 命中区（触控没有悬停），网格 / 列表与排序不放。抽屉里的帮助菜单与账户菜单不写键位提示（「键盘快捷键」不写 ⌘/、「偏好设置…」不写 ⌘,，rulings §4.25 TB-164，同手机搜索框不写 ⌘K）。点卡片进编辑器的仅查看形态（NF-07：手机查看 + 评论）",
      page: {
        shell: { rail: false, actions: null, headerStart: <NavToggleEdge />, bodyClassName: "px-4 pt-4 pb-8" },
        overlay: <><HomeDrawer search={false} touch /><LibraryToasts /></>,
        data: homeData({ milestone: "M2", form: "phone" }),
      },
    },
    {
      id: "phone-drawer",
      title: "手机 · 导航抽屉展开",
      note:
        "rulings §4.25 DS-87（视口 390 × 844，同 phone）：抽屉就是左栏本身（宽 220、整高、浮层阴影、不加遮罩，role=region「导航」），第一行最左是按下态的「收起导航」，与顶栏「显示导航」开关同一位置、同为 44（左 16、上 6），品牌行右移让位；" +
        "触控形态下导航项、帮助、用户行都是 44 高、间距 8（07 §2 命中区尺寸：pointer: coarse 或 < 640 主要控件 ≥ 44、间距 ≥ 8），文字与图标不变；搜索在主区（提示行之下），抽屉里不再放。焦点交接同 compact-drawer：用户展开时交给「收起导航」，收起后交回顶栏开关；顶栏开关被盖住时 inert",
      page: {
        shell: { rail: false, actions: null, headerStart: <NavToggleEdge />, bodyClassName: "px-4 pt-4 pb-8" },
        overlay: <><HomeDrawer search={false} touch /><LibraryToasts /></>,
        data: homeData({ milestone: "M2", form: "phone", drawer: true }),
      },
    },
    {
      id: "alt-phone-create",
      title: "未采纳 · 手机上照常新建与导入",
      note: "未采纳（DS-87 定为手机上不提供新建与导入，见 phone）：手机上照常显示顶栏「导入 .pptx」「新建演示文稿」与「从模板开始」（AS-01 字面意思；一行横向滚动，卡片 156），新建后进编辑器却是仅查看形态（< 640 不能编辑，DS-17），等于建了一份打不开编辑的文档；导入的 200 MB 文件在手机上也难选。顶栏两个按钮右缘与内容右缘对齐；它们是 28 高，低于触控 44（备选只作对照，不再加大）",
      page: {
        shell: {
          rail: false,
          headerStart: <NavToggleEdge />,
          actions: (
            <span className="-mr-4 flex items-center gap-2">
              <ShellDefaultActions />
            </span>
          ),
          bodyClassName: "px-4 pt-4 pb-8",
        },
        overlay: <HomeDrawer search={false} touch />,
        data: homeData({ milestone: "M2", form: "phone", phoneCreate: true }),
      },
    },
    {
      id: "admin-denied",
      title: "普通成员直接访问管理页",
      note: "rulings §4.25 TB-101（PRD PM-01、50/02 §2.1）：普通成员（platformRole='member'）直接打开 /admin/plugins，守卫把人送回开始页（M3），主区底部轻提示「需要管理员权限」（中性 info，role=status，只出一次）；不画「无权限」拦截页（03-32 §11.3 删去）。同屏展开这位成员的账户菜单可核对：没有「管理」一项、也不占位（AS-06），个人资料（M3）可用（DS-91：M3 起出现）",
      page: {
        shell: { accountMenuOpen: true, accountMenu: { milestone: "M3" } },
        data: homeData({ milestone: "M3" }),
        overlay: (
          <Toasts bottom={24}>
            <Toast tone="info">需要管理员权限</Toast>
          </Toasts>
        ),
      },
    },
  ],
})

/** 手机形态的「显示导航」开关（44）：顶栏左右内边距是 32（kit ShellLayout），开关左移 16 与内容左缘（16）对齐 */
function NavToggleEdge() {
  return (
    <span className="-ml-4 flex">
      <NavToggle touch />
    </span>
  )
}
