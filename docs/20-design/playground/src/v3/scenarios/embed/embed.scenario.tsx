import { defineScenario, type EmbedConfig } from "../types"

/**
 * embed：嵌入形态 E（apps/web 的 /embed/:id?mode=view|edit 放进集成方页面的 iframe，M3 P2；前端 50/12 §9 定行为，PRD EM-01 形态 E、EM-03、EM-06）。
 * rulings §4.25 DS-73「画全套」（用户未采用「只画登录提示一组」）：中性的宿主外框、几种容器尺寸下的完整 / 紧凑 / 仅查看形态、嵌入里的打开失败页、
 * iframe 里没有会话时「请在新窗口登录」的未登录 / 登录窗口已打开 / 弹窗被拦截三态。设计线没有嵌入的界面文档，每个状态的 note 写清对应的 50/12 §9 与 PRD 条目。
 *
 * 外框是底座的 #/v3/embed 宿主（PageHost EmbedFrame）：panel 底上一行「宿主页面（演示容器，不代表任何真实产品）」+ 容器尺寸，下面 1px 虚线是容器边界——只是演示容器，
 * 不画任何真实产品或品牌。iframe 加载同一个 playground 的别的宿主路由（带 embedded=1、主题与强调色沿用外层），视口就是容器尺寸，
 * 编辑器按容器宽度取形态（≥ 1024 完整、640–1024 紧凑、< 640 仅查看，第 1 批已拍板 DS-17、DS-21）：形态三态直接加载第 1 批 narrow.responsive（按真实视口取形态的那一态）、
 * mode=view 加载第 1 批 main-states.viewer——已拍板画面原样，只有「嵌入里的出口」按 embedded=1 走底座的可选分支（下面），不另画。
 * 嵌入里的出口（rulings §4.25 DS-112；apps/web 自身不变）：嵌入时不渲染「返回首页」（DS-19：没有对应能力的入口删去；
 * 宿主在 cordex:init 的 intents 里声明 navigate-back 时才出现，点了发 cordex:intent；「退出登录」声明了 sign-out 才可用、没声明时留在原位不可用——rulings §4.25 TB-145，样张都按「没声明」画），
 * 仅查看形态的状态行只写「仅查看」，紧凑 / 仅查看形态里「在更大窗口中编辑」类的不可用原因写「当前区域太窄，暂不可用」
 * （嵌入又是触控设备——平板——时以「在电脑上编辑」为准：触控的原因优先，嵌入只改写「窗口窄」那一句，rulings §4.25 TB-159、TB-136；样张的嵌入容器都按桌面浏览器画）；
 * 评论面板撰写区上方那句改「当前区域太窄，暂不能解决评论」（DS-112 并入）。
 * （底座 MainMenu / MainMenuLayer、narrow/viewer.tsx 顶部条、narrow/compact.tsx、comments/phone.tsx 读 useV3Params().embedded；不在嵌入里时与第 1、2 批逐像素相同）。
 * 嵌入自己的页面（登录提示、打开失败）与两个主菜单态是隐藏场景 embed-frame（frame.scenario.tsx）。
 * 截图时外框 1600 × 1000（iframe 里的页面按容器尺寸渲染）；URL 参数 frame=宽x高 可临时换容器尺寸。
 */

const frame = (size: [number, number], host: EmbedConfig["src"]["host"], state: string, label?: string, frameLabel?: string): { embed: EmbedConfig } => ({
  embed: { size, src: { host, state }, ...(label ? { label } : null), ...(frameLabel ? { frameLabel } : null) },
})

export default defineScenario({
  id: "embed",
  title: "嵌入（iframe）",
  specs: [],
  batch: 3,
  host: "embed",
  summary: "中性宿主外框里的 iframe：按容器宽度取完整 / 紧凑 / 仅查看形态、嵌入里的出口（没有「返回首页」）、mode=view 只读变体、请在新窗口登录三态、嵌入里的打开失败、形态 C 查看器放进小容器",
  states: [
    /* ---------------------------------------------------------------- 按容器宽度取形态（直接复用已拍板的编辑器形态） */
    {
      id: "full",
      title: "完整形态 · 容器 1280 × 800（mode=edit）",
      note: "50/12 §9、§6「尺寸」/ PRD EM-01（容器尺寸变化自动重排、按断点切换三种形态）：容器宽 ≥ 1024 时 /embed/:id?mode=edit 就是完整的编辑器（第 0–2 批已拍板的单页视图原样：左栏 240 · 画布 · 检查器 280 · 底部工具条），没有专为嵌入另画的界面；只有出口不同：主菜单不渲染「返回首页」（rulings §4.25 DS-112；DS-19 没有对应能力的入口删去，宿主经 cordex:init 声明能处理「返回」时才出现、点了发 cordex:intent），菜单从「文件 ▸」开始，见 full-menu；导出、保真报告、版本历史、插件…这些应用级条目由 apps/web 在 iframe 里照常处理；apps/web 自身（不在嵌入里）不变。iframe 里加载 narrow.responsive（按真实视口取形态），所以拖动容器宽度即在三种形态之间切换、打开中的抽屉与面板随之关闭（50/10 §2.2）。嵌入只支持与部署同站的宿主（会话 cookie SameSite=Lax，跨站 iframe 不带会话；跨站等 M4 的 cordex:token 握手，INC-36）；宿主源不在 web.embed.allowedHostOrigins 里时浏览器按 frame-ancestors 拒绝显示，我方没有画面。iframe 属性按 50/12 §9：sandbox（allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads）、allow=fullscreen 与剪贴板（样张同源加载、不写 sandbox，见 PageHost）",
      page: frame([1280, 800], "editor", "narrow.responsive"),
    },
    {
      id: "full-menu",
      title: "完整形态 · 主菜单（嵌入里没有「返回首页」）",
      note: "rulings §4.25 DS-112：容器 1280 × 800 的完整形态，主菜单静态打开——嵌入时不渲染「返回首页」与其后的分隔线（DS-19：iframe 里没有首页可回；宿主在 cordex:init 的 intents 里声明 navigate-back 时才出现，点了发 cordex:intent 交宿主，rulings §4.25 TB-145），首项是「文件 ▸」；其余条目与 apps/web 相同（主菜单统一的一份，kit mainMenuItems 的可选项 home: false，底座 MainMenu / MainMenuLayer 读 embedded=1 自动传）。apps/web 自身的主菜单不变（见第 1 批 main-states 的主菜单各态）。未采纳的两种（文字说明，不另画）：「返回首页」留在原位、不可用、原因写「由宿主应用处理」（账户菜单「退出登录」为什么仍是原位不可用，见 account-menu.embedded-logout）；照 apps/web 原样显示「返回首页」与「在更大窗口中编辑」",
      page: frame([1280, 800], "editor", "embed-frame.editor-menu"),
    },
    {
      id: "compact",
      title: "紧凑形态 · 容器 900 × 600",
      note: "同一个 /embed 页面、容器宽 640–1024：第 1 批已拍板的紧凑形态（DS-17、DS-21）原样——左栏与检查器收为左上「文档」、右上「协作与分享」两个胶囊，按需展开为盖在画布上的抽屉（同一时刻一个），底部工具条与画布保持可用。嵌入里两处不同（DS-112）：胶囊与抽屉里的主菜单都没有「返回首页」；母版视图不可用的原因写「当前区域太窄，暂不可用」（apps/web 里是「在更大窗口中编辑」：容器尺寸由宿主定，用户可能照做不了），见 compact-menu。紧凑形态的最小可用高度 400（50/12 §6）",
      page: frame([900, 600], "editor", "narrow.responsive"),
    },
    {
      id: "compact-menu",
      title: "紧凑形态 · 主菜单 › 视图（容器 900 × 600）",
      note: "rulings §4.25 DS-112：紧凑形态左上胶囊的主菜单静态展开「视图」——顶层没有「返回首页」（首项「文件 ▸」）；「母版视图」留在原位、不可用，原因写「当前区域太窄，暂不可用」（apps/web 的紧凑形态写「在更大窗口中编辑」，TB-44；嵌入的容器尺寸由宿主定，「更大窗口」用户照做不了）。其余条目与 apps/web 的紧凑形态相同。底座：narrow/compact.tsx 的母版原因读 embedded（narrow/data.ts EMBED_MASTER_REASON），不在嵌入里时不变",
      page: frame([900, 600], "editor", "embed-frame.compact-menu"),
    },
    {
      id: "view-only",
      title: "仅查看形态 · 容器 390 × 720",
      note: "同一个 /embed 页面、容器宽 < 640：第 1 批已拍板的仅查看形态（narrow.narrow 同一画法）——当前页全宽 + 只读备注、底部浮动条（上一页 · 页码 · 下一页 ┊ 评论，44 × 44、间距 8）；mode=edit 与 mode=view 在这个宽度下都是它（按容器宽度取形态与模式无关）。嵌入里的顶部条（rulings §4.25 DS-112）：不渲染「‹ 返回首页」（文档标题左缘让到 16），状态行只写「仅查看」——apps/web 里是「仅查看 · 在更大窗口中编辑」（触控设备「仅查看 · 在电脑上编辑」，TB-125），嵌入的容器尺寸由宿主定，这句用户可能照做不了；「更多」照常（放映、适应窗口、备注开关）；「评论」底部面板撰写区上方那句同理改「当前区域太窄，暂不能解决评论」（apps/web 里是「解决评论请在更大窗口中进行」，DS-112 并入）",
      page: frame([390, 720], "editor", "narrow.responsive"),
    },
    {
      id: "view-mode",
      title: "mode=view · 编辑器只读变体（容器 1280 × 800）",
      note: "50/12 §1、§9 / rulings §4.18 UX-19：/embed/:id?mode=view 打开的是编辑器的查看者变体（进协同房间、计入 50 个查看者名额，看得到他人在场与实时修改），不是查看器壳——第 1 批已拍板的 main-states.viewer 原样：浏览条「只读浏览中」+ 上一处 / 下一处评论、评论页签只读、检查器只读并注明「只读 · 你只有查看权限」；主菜单同 full-menu（嵌入里没有「返回首页」）。容器变窄时同样按 DS-17 进紧凑 / 仅查看形态（compact、view-only）。名额已满时是第 2 批 DS-60 的阻断页、在容器里复用（嵌入里去掉「返回文档列表」，同 open-failed）。只要预览、不进协同房间的集成方用形态 C（查看器壳，见 viewer-box）",
      page: frame([1280, 800], "editor", "main-states.viewer"),
    },

    /* ---------------------------------------------------------------- 请在新窗口登录（50/12 §9、50/02 §5） */
    {
      id: "auth-required",
      title: "请在新窗口登录 · 未登录（容器 960 × 540）",
      note: "50/12 §9：iframe 里没有会话时不做顶层 OIDC 跳转（IdP 通常禁止被嵌入），页面显示「请在新窗口登录」，同时向父页发 cordex:auth-required（看不见）。阻断页画法（kit BlockingPage，与打开失败、登录页、错误页同一画法：画布底色上居中一列，不加卡片）：钥匙图标 32 text-2 ·「请在新窗口登录」· 说明「嵌入的页面里打不开登录页；在新窗口登录后，这里会自动刷新」（按词组换行）· 主按钮「使用组织账号登录」——与登录页 shell-pages.login 的主按钮同一句、同一宽度规则（rulings §4.25 TB-122：桌面定宽 240、高 28；触控或容器 < 640 占满列宽、最宽 400、高 44、圆角 8）。拿不到文档元数据，标题上方不写文档名。点按时在手势里同步 window.open（520 × 680，mode=popup，50/02 §5 第 2 步），登录完成后回调页在 BroadcastChannel cordex-auth 发 reauth-done，iframe 重新加载为 full / compact / view-only 之一（原页一侧的探测同 50/02 §5 第 4 步）。不加登录页的弱提示「没有账号？请联系管理员开通」（DS-119 只在登录页常显，TB-115）。三段文案与第 2 批「登录已过期」横幅（offline-conflict.auth-expired 三态）同一套措辞",
      page: frame([960, 540], "page", "embed-frame.auth-required"),
    },
    {
      id: "auth-popup-open",
      title: "请在新窗口登录 · 登录窗口已打开",
      note: "50/02 §5 第 2 步同口径：登录窗口打开期间「使用组织账号登录」是同一颗按钮（同一个元素，焦点留在原处）转圈、不可用（aria-disabled + aria-busy；工具提示「登录窗口已打开，完成后自动刷新」，刚点过时不当场弹出）。画布底上的主按钮进行中照用 kit 主按钮的不可用态（panel-2 底 + text-3）加转圈，与第 2 批「申请访问」发送后、shell-pages.login-redirecting 同一画法，宽度不变（240）——rulings §4.25 DS-123（采纳原备选「kit 不可用态」；原推荐「画布底上一律 outline 不可用态」未采纳）。说明改为「请在新窗口中完成登录；登录后这里会自动刷新」——这一句由常驻的 polite 区播报一次（同一件事只走一条读屏通道，同第 2 批 auth-expired-pending）。窗口关掉而没登录完时按钮恢复可点；新窗口里的回调页是 shell-pages 的 popup-callback 一组",
      page: frame([960, 540], "page", "embed-frame.auth-popup-open"),
    },
    {
      id: "auth-blocked",
      title: "请在新标签页中登录 · 弹窗被拦截",
      note: "50/02 §5 第 2 步：window.open 返回空即被浏览器拦截——标题改「请在新标签页中登录」（与说明、按钮同一种说法），按钮换成链接「在新标签页中登录」（主按钮外观 + 14px 外链图标 ExternalLink，与第 2 批 auth-expired-popup-blocked 同一颗；target=_blank、rel=noopener；iframe 的 sandbox 带 allow-popups 与 allow-popups-to-escape-sandbox 才打得开），宽度同未登录态（240），说明改为「浏览器拦截了登录窗口，请改在新标签页中登录；登录后回到这里会自动刷新」。新标签里登录完成后关不掉（不是脚本打开的窗口），停在 shell-pages「已重新登录，可关闭本页」；回到宿主页面时 iframe 靠 BroadcastChannel 或重获焦点时探测 /auth/me 恢复（50/02 §5 第 4 步）",
      page: frame([960, 540], "page", "embed-frame.auth-blocked"),
    },

    /* ---------------------------------------------------------------- 嵌入里的打开失败 */
    {
      id: "open-failed",
      title: "嵌入里的打开失败（容器 960 × 540）",
      note: "03-13 打开失败态 / 编辑器 main-states.open-failed 同一布局与通用兜底文案（文档名一行 ·「无法打开该文档」·「请稍后重试；如果问题持续，请复制诊断信息并联系管理员」）。按钮组按 rulings §4.25 TB-115：只留「重试」（主）与「复制诊断信息」（outline，TB-128），同时向父页发 cordex:error（code 为 protocol 已登记的错误码），离开交给宿主。「复制诊断信息」点后原位变为「✓ 已复制」1.5 秒（同 shell-pages.app-error 与 03-08「复制链接」：不用轻提示，按钮定宽不跳，polite 播报一次「已复制诊断信息」）。其余错误码按 03-13 表只换图标与文案；没有访问权限（DS-50 / CO-05，同一布局的「申请访问」）、名额已满（DS-60）的阻断页同一布局复用，嵌入里一律去掉「返回文档列表」，离开交给宿主",
      page: frame([960, 540], "page", "embed-frame.open-failed"),
    },

    /* ---------------------------------------------------------------- 形态 C：查看器壳放进宿主的小容器 */
    {
      id: "viewer-box",
      title: "形态 C · 查看器放进宿主的小容器（640 × 360）",
      note: "50/12 §5 形态 C（createSlideViewerPreset → preset.mount(容器)，M1）不是 iframe：查看器壳直接挂在集成方页面的一个容器里；样张借嵌入外框演示「按容器宽度取形态」（外框右上写「容器 640 × 360」：样张里借 iframe 演示，产品里是宿主自己的 div）——640 × 360 时仍是桌面形态（查看器 < 640 才进窄屏，viewer.narrow），顶部条 48 不换行，当前页按可用高度适应；容器窄于 960 时画布四周留白由 48 / 40 收到 16（小容器里先保证幻灯片大，编辑器不变）。全屏按钮只在宿主允许全屏时出现；查看器没有协同与登录，不进协同房间、不计查看者名额；查看器本来就没有「返回」类出口",
      page: frame([640, 360], "editor", "viewer.default", "宿主页面（演示容器，不代表任何真实产品）· 形态 C 查看器", "容器 640 × 360"),
    },
  ],
})
