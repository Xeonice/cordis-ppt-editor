import { ME, SHARE_LATER } from "../../kit"
import { SAVE_STATUS } from "../find-view-undo/chrome"
import { PluginsDialogHost } from "../plugins/PluginsPanel"
import { COMPACT_BACKDROP } from "../shortcuts/compact-backdrop"
import { homePage, homePhonePage } from "../shortcuts/home-backdrop"
import { defineScenario, type EditorConfig } from "../types"
import { PLAYBACK_WITH_ORDER } from "./inspector-alt"
import type { SettingsData } from "./prefs"
import { SettingsHost } from "./SettingsHost"

/**
 * settings：偏好设置（03-23；PRD EM-06、EM-11、AS-06、NF-06、NF-11、EM-12、ED-23；第 3 批 · 应用壳族，g4）。
 * 2026-10-22 拍板（rulings §4.25）：DS-113 居中模态对话框（default；未采纳：右侧抽屉 320，alt-drawer）；DS-114 通知组只留「协作者加入时提示」；DS-116 阅读顺序进「无障碍」一组、命令面板是第二入口
 * （未采纳：检查器「放映」节，alt-reading-order-inspector）；DS-90 主题三项与账户菜单同一组值；DS-76 不画「密度」。
 * 技术口径 TB-118：diagnostics.* 两项按账户记、换人回部署默认；集成方锁定用 preset 选项 preferences: { locked?, values? }；
 * SDK 出现的组：外观 · 语言与单位 · 编辑（仅单人 preset）· 无障碍 · 关于；手机（< 640）用仅查看形态贴底的底部面板（phone）。
 * 入口都是底座命令 account.preferences（账户菜单「偏好设置…」、⌘,；第 3 批转正并入），SettingsHost 接住；没有宿主的状态里按 provides 转到这里。
 * 同目录：prefs（状态、文案中英两份）· SettingsBody（正文：分组与行）· SettingsHost（对话框 / 抽屉 / 底部面板、语言切换、落点）· sheet（手机的底部面板）·
 * inspector-alt（DS-116 未采纳的检查器节）。开始页的背景是 shortcuts/home-backdrop（home.m2-default 同一版，即已拍板首页）。
 * 没画的：
 *   - 账户菜单里的入口（「偏好设置… ⌘,」所在的菜单，DS-90 / DS-91 的主题三项与个人资料）归 account-menu 场景，这里不重复；
 *   - 两档密度（DS-76 已定只留单档，不画对照）、保留「打开文档时提示保真差异」开关（DS-114 不画备选）。
 */

const BASE: EditorConfig = {
  // 对话框类状态去掉远端光标，减少干扰
  stage: { cursor: false },
  // 背后的编辑器是 M2 的部署（default：「M2 部署没有 otlp 出口」，其余各态同 default）：「分享」留在原位、不可用（rulings §4.25 DS-137、TB-161）；
  // telemetry 是 M3、embedded-locked 是 SDK 单人 preset（宿主怎样声明「分享」由集成方定），两态各自覆盖
  inspector: { share: SHARE_LATER },
  layers: (
    <>
      <SettingsHost />
      {/* 个人插件面板（第 2 批，03-09）：「关于 › 插件 · 查看」与主菜单「插件…」打开它 */}
      <PluginsDialogHost />
    </>
  ),
}

/** 只演示一个设置项变化的状态：其余同 default（data 是状态私有数据，见 prefs.ts SettingsData） */
const only = (d: SettingsData, extra: EditorConfig = {}): EditorConfig => ({ data: { ...d }, ...extra })

export default defineScenario({
  id: "settings",
  title: "偏好设置",
  specs: ["03-23"],
  batch: 3,
  summary: "居中对话框（DS-113）：外观 · 语言与单位 · 无障碍（DS-116）· 通知（DS-114）· 隐私与诊断 · 关于；开始页、手机底部面板、集成方锁定、语言切换与失败、复制、遥测、开发构建、紧凑窗口；未采纳的抽屉与检查器入口",
  // 底座命令 account.preferences（账户菜单「偏好设置…」与 ⌘,，第 3 批转正 kitRequest g4 K1）没有场景接住时转到这里；应用壳页面上转到叠在开始页上的那一态
  provides: { "account.preferences": { edit: "default", home: "from-home", documents: "from-home", templates: "from-home" } },
  editor: BASE,
  states: [
    {
      id: "default",
      title: "默认 · 编辑器里打开",
      note:
        "rulings §4.25 DS-113（居中模态对话框）、DS-114（通知组只留一项）、DS-116（阅读顺序进「无障碍」一组），DS-76（不画「密度」）。03-23：从右上自己的头像 › 偏好设置… ⌘, 打开（账户菜单是唯一入口，DS-10、DS-18、AS-06；另有 ⌘,），盖在编辑器上、带遮罩。" +
        "kit Dialog md 480：标题「偏好设置」13px 600 + ×（Esc），说明一句「改动立即生效，只保存在这台设备上，不影响协作者。」；几何（DS-113 写明）：水平居中、顶部锚定在 max(64px, 12vh)、只向下伸展，最高到视口底留 32" +
        "（09 §3.4：内容会增减的对话框，语言包失败、M3 的使用统计会多一行；视口 1000 高时顶 120、最高 848），高随内容、超出时正文滚动、标题与说明固定。" +
        "正文是一条分组列表：节标题 12px 600 + 1px 分隔（同检查器 Section，不套卡片）；分段、下拉与按钮行是左边名称 12px（下一行说明 12px 次级文字色）、右边 200 宽的控件列，控件左缘对齐（「关于」组的版本值与下面按钮的外框同一条左缘）；" +
        "复选框行（通知、隐私与诊断）不进控件列、占整行：16 的框 + 名称 + 下一行说明（常规画法），说明经 aria-describedby 读出（隐私两项的说明是同意的依据）；控件全按安静样式（分段、下拉、复选框，DS-35…DS-37；Switch 只给个人插件面板）。" +
        "分组：外观（主题 浅色 / 深色 / 跟随系统，分段单选；与账户菜单同一偏好、同一组值与顺序，DS-90；出厂默认跟随系统）· 语言与单位（界面语言 简体中文 ▾；度量单位 厘米 (cm) ▾ + 说明「字号、段距与固定行距始终以磅显示」，TB-33、DS-27；03-23 原是「语言」「度量单位」两组各一行，合成一组免得节标题与行名重复）· " +
        "无障碍（阅读顺序 按叠放次序 ▾ / 按占位符次序，选项带说明「从底层到顶层」「标题 → 副标题 → 正文 → 其余」，存 Preferences.a11y.readingOrder，50/16 §9.3；DS-116，命令面板「阅读顺序…」是第二入口）· 通知（☐ 协作者加入时提示，缺省关，PRD 07 D8；DS-114：「导入完成后高亮详情」「评论 @ 我时提示」两项删去）· " +
        "隐私与诊断（☑ 发送错误报告，缺省开，FE-15；M2 部署没有 otlp 出口，不显示使用统计，见 telemetry；这一组按账户记、换人回到部署默认值，其余偏好按设备记，TB-118）· " +
        "关于（版本 0.3.2（4f2a9c1）· 诊断信息「复制」· 插件「本会话有 15 个插件在运行」「查看」→ 个人插件面板 03-09，数字与插件面板计数行「运行中 15」同一份）。" +
        "编辑组（自动保存间隔）只在 SDK 单人 preset 出现（embedded-locked）；旧稿的「智能参考线默认开启」与「粘贴默认」不画（前者与主菜单「视图 › 网格与参考线」是同一份本机偏好，ED-09；后者没有 PRD 出处，ED-17 / 03-19 都没有）。" +
        "改了即生效、没有保存按钮（主题选了画面立即换肤）；× / Esc / 点遮罩关闭，焦点回头像。打开时焦点落在对话框本身（读屏念标题与说明，不自动聚焦第一个分段，避免方向键误改主题）。" +
        "背后的编辑器是 M2 的部署（本场景除 telemetry、embedded-locked 外同此）：「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）",
    },
    {
      id: "from-home",
      title: "从开始页打开",
      host: "home",
      note:
        "开始页左栏底部用户行 › 偏好设置…（同一份账户菜单，DS-18）或 ⌘, 打开：同一个对话框叠在开始页上（路由 /settings 叠在来路之上，50/02 §2、50/10 §10.3），关闭回开始页。" +
        "背景是拍板后的开始页（home.m2-default 同一版，即已拍板首页 #/v3/home）：左栏 5 项含回收站（DS-79）、「帮助」打开帮助菜单（DS-89）、用户行是 M2 的账户菜单（DS-90 / DS-91）、M2 不显示「更多模板 →」（AS-03）。" +
        "开始页没有 host 与本会话插件集，「关于」里没有插件一行；其余同 default。从用户行的账户菜单打开的，关闭后焦点回到用户行（锚点 account，与编辑器的头像同名，第 3 批转正时并入 ShellRail）；状态里一出现就打开的，关闭后也回到用户行（不掉到 body）。" +
        "开始页上 ⌘, 与 ⌘/ 由底座按 KeyboardEvent.code 接住（kit useBaseKeys，应用壳页面同编辑器；50/02 §2.1）",
      page: homePage({ layers: <SettingsHost /> }),
    },
    {
      id: "phone",
      title: "手机 · 底部面板（390 × 844）",
      host: "home",
      note:
        "rulings §4.25 TB-118，视口 390 × 844：手机（< 640）上偏好设置是仅查看形态那种贴底的底部面板（同第 1 批 narrow 的底部面板与第 2 批 comments.phone：贴底、上圆角 12、1px 上边、panel 底、浮层阴影，顶部把手 40 × 4，标题行 48「偏好设置」+ 右侧关闭 44），" +
        "上沿离视口顶 24（最高 100dvh − 24：内容比这高时正文在面板里滚动，标题与说明固定），最宽 560、水平居中。编辑器的仅查看形态没有账户入口（03-02 §5a.2），手机上只能从开始页打开：背景是开始页的手机形态（home.phone 同一版，DS-87），入口是导航抽屉里用户行的账户菜单「偏好设置…」（底座命令 account.preferences，本宿主接住）。" +
        "模态，同 DS-113 的对话框与未采纳的抽屉：遮罩、焦点圈定，Esc / 关闭 / 点遮罩关闭；打开时焦点落在面板本身（读屏念标题与说明），关闭后焦点回到打开前的元素（状态里一出现就打开的回顶栏的「显示导航」）。" +
        "正文同 alt-drawer 的上下排布局（名称、说明在上，控件占满一行），控件按触控尺寸：分段、下拉、按钮高 44，复选框整行可点（命中区 ≥ 44）；分组与 from-home 相同（开始页没有插件一行）。03-23 §1.3、§7 按本画法写明（原「抽屉扩展为接近全宽的浮层」作废）",
      page: homePhonePage({ layers: <SettingsHost />, data: { sForm: "sheet" } }),
    },
    {
      id: "embedded-locked",
      title: "嵌入 · 集成方锁定",
      note:
        "03-23「集成方锁定态」：SDK 嵌入的单人 preset（PRD EM-01 形态 A、EM-02 回调式保存；头像组只剩自己、文件名下「✓ 已保存」，同第 1 批 undo-clipboard.saved）。说明一句写「改动立即生效，只保存在这台设备上。」（单人没有协作者，不写「不影响协作者」）。" +
        "集成方锁定了主题与语言：各项各自画成只读行——当前值 + 12px 锁形 +「由宿主应用设置」（不画禁用控件，DS-15「只读展示当前值」的类比；多项锁定各自写，03-23 边界情况）；度量单位、阅读顺序照常可改。" +
        "锁定来自 preset 选项 preferences: { locked?: ('theme'|'locale'|'unit'|'readingOrder'|'autosave')[], values?: Partial<Preferences> }（TB-118；对外配置键，先在 40/10 §2.5 登记再写码）。" +
        "SDK 里出现的组按 TB-118：外观 · 语言与单位 · 编辑（仅单人 preset：自动保存间隔 30 秒 ▾——15 秒 / 30 秒 / 1 分钟 / 关闭，ED-23 写「可配置或关闭」，旧稿缺「关闭」，补上；50/10 §10.3）· 无障碍 · 关于；" +
        "没有通知（单人没有协作者）、隐私与诊断（SDK 出厂不发数据，50/15 §9）与插件一行（插件管理走集成方的壳意图）。单人 preset 的快捷键面板多「保存 ⌘S」（shortcuts.embedded-solo，TB-116）",
      // 「分享」维持现画法（share: undefined 覆盖 BASE 的 M2 写法）：SDK 单人 preset 里宿主怎样声明「分享」（TB-161）由集成方定，样张不推断
      editor: only({ sEmbed: true }, { inspector: { collaborators: { people: [ME] }, share: undefined }, rail: { status: SAVE_STATUS.saved } }),
    },
    {
      id: "language-switching",
      title: "切换语言中",
      note:
        "EM-11、NF-06：选了 English 后语言下拉不可用（aria-disabled、菜单不再打开）、当前值后 14px 转圈（读屏名「正在切换语言」，aria-busy），≤ 200 ms（样张放慢到 300 ms，一出现就定格在转圈，第一次点按或按键后完成）；" +
        "完成后对话框文案即时换成英文、不刷新页面（样张里编辑器其余文案仍是中文），框外的 polite 区播报一次「Language changed to English」，焦点留在语言下拉（07 §2：异步替换不静默移焦点）",
      editor: only({ sLang: "switching" }),
    },
    {
      id: "language-failed",
      title: "语言包加载失败",
      note:
        "03-23 §4.2「语言包加载失败」写在框里（模态遮罩盖住画布轻提示，DS-56 先例；前端 50/10 §10.3 同此，原「失败时 Toast」作废）：语言行下方一行 14px 危险色图标 + 主文字色「语言包加载失败，已保留当前语言」（状态色只给图标，DS-41），" +
        "下拉回到原值（简体中文）、焦点留在下拉上；这一行自己是 polite 播报区（出现后两帧内容才进无障碍树，kit useRevealAfterMount），不另弹轻提示；再次切换语言或关闭对话框时消失",
      editor: only({ sLang: "failed" }),
    },
    {
      id: "copied",
      title: "已复制诊断信息",
      note:
        "关于 › 诊断信息「复制」（次按钮，读屏名「复制诊断信息」；EM-12 M1 P0）：复制 diagnostics.dump()（版本、插件与最近的事件，不含文档内容与令牌，50/15 §10），说明一行换成 14px 成功色对勾 + 主文字色「已复制诊断信息」" +
        "（写在框里，DS-56；文案与第 2 批插件面板底栏统一：对话框里写在框内，阻断页上是按钮原位变成「已复制」，同 shell-pages.app-error），约 4 秒后换回说明；这一行自己播报一次。复制失败（剪贴板未授权）时同一位置写危险色图标「复制失败，请检查浏览器的剪贴板权限」（不另画）",
      editor: only({ sCopied: true }),
    },
    {
      id: "telemetry",
      title: "M3 · 部署开了产品遥测出口",
      note:
        "M3：部署开了产品遥测出口（RuntimeConfig telemetry.otlp 为真，50/02 §3、50/15 §9）时，隐私与诊断多「☐ 发送使用统计」+ 说明「功能使用情况与性能数据，只发给本部署的服务器」（缺省关，开了才发、关掉即清空队列，NF-11、PD-10、FE-15）；M2 没有这一项（default）。" +
        "这一组两项（diagnostics.*）按账户记、换人时回到部署默认值——同意须由本人作出，不沿用同一台设备上一个人的选择；其余偏好仍按设备存 cordex.prefs（TB-118，50/02 §10.1 写明这个例外）。两项的说明都经 aria-describedby 读出",
      // M3：「分享」照常可用（宿主传 onShare，TB-161；覆盖 BASE 的 M2 写法）
      editor: only({ sTelemetry: true }, { inspector: { share: undefined } }),
    },
    {
      id: "dev-build",
      title: "开发构建",
      note:
        "开发构建或 features.developerMenu 打开时，「关于」最后多「开发者面板 · 打开」（TB-40、50/15 §10、PS-09，读屏名「打开开发者面板」）；说明写它是什么——「贡献列表、事件流与协同诊断」（PS-09、CO-13；不写「只在开发构建中出现」：既不准也没说用途）；" +
        "生产缺省不出现，与主菜单「帮助」最后一组的「开发者面板」同一条件（03-02 §2.3）",
      editor: only({ sDev: true }),
    },
    {
      id: "compact",
      title: "紧凑窗口 1000 × 760",
      note:
        "紧凑窗口 1000 × 760（编辑器为紧凑形态：两侧收为左上「文档」、右上「协作与分享」胶囊，借第 1 批 narrow 的件，03-02 §5a）：同一个对话框、宽 480 不变，几何同 default——水平居中、顶部锚定在 max(64px, 12vh)（这里 91）、只向下伸展，最高到视口底留 32（这里 637）；" +
        "视口矮时正文在框内滚动，标题与说明固定；对话框照样盖在编辑器上",
      editor: { ...COMPACT_BACKDROP },
    },
    {
      id: "alt-drawer",
      title: "未采纳 · 右侧抽屉",
      note:
        "未采纳（DS-113 定为居中模态对话框 480，见 default）：右侧贴边整高抽屉 320、带遮罩（kit Drawer modal，即 09 T-06「右侧抽屉」的原口径）——盖住检查器，宽 320 与检查器 280 对不齐，v3 桌面形态为它另添一种件；同一份正文换成上下排（名称、说明在上，控件占满一行，同检查器；复选框行仍是框 + 名称 + 说明），内容、反馈与关闭规则同 default",
      editor: only({ sForm: "drawer" }),
    },
    {
      id: "alt-reading-order-inspector",
      title: "未采纳 · 阅读顺序在检查器",
      note:
        "未采纳（DS-116 定为偏好设置「无障碍」一组是常驻入口、命令面板是第二入口，见 default）：阅读顺序的常驻入口放在检查器无选中态「放映」节的最后一行（切换 · 放映时跳过此页 · 阅读顺序 按叠放次序 ▾），偏好设置里没有「无障碍」一组——这一态按 ⌘, 打开的偏好设置同样不画这一组，只有检查器一个常驻入口；命令面板「阅读顺序…」仍是第二入口。" +
        "代价：阅读顺序是个人偏好、对全部页生效（Preferences.a11y.readingOrder），放进「幻灯片 N」的页属性里会被读成这一页的设置；检查器只管选中对象的属性（DS-1）",
      editor: only({ sOpen: false, sA11y: false }, { inspector: { sections: ["slide.layout", "slide.theme", "slide.background", PLAYBACK_WITH_ORDER] } }),
    },
  ],
})
