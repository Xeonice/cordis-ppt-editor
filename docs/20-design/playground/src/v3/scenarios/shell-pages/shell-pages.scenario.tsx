import { ME, OfflineBanner } from "../../kit"
import { blockingPage } from "../offline-conflict/pages"
import { STATUS } from "../offline-conflict/status"
import { defineScenario } from "../types"
import { LoginPage, type LoginSeed } from "./LoginPage"
import { LogoutGuard } from "./LogoutConfirm"
import {
  AppErrorPage, CallbackFailedPage, CallbackNetworkError, CenterLoading, ConfigErrorPage, LinkExpiredPage, MergedNotFoundPage, NotFoundDocPage, NotFoundRoute, PopupDoneTab, PopupFailed,
} from "./pages"

/**
 * shell-pages：登录、会话与错误页（rulings §4.25 DS-71 并入第 3 批；新界面文档 03-33「登录、会话与错误页」照样张写，PRD 07 G-66 的落点）。
 * 宿主 #/v3/page（整屏 bare：画布底色、无导航）。新版式只有登录页（DS-118：与阻断页同一画法），其余沿用已拍板的阻断页画法（kit BlockingPage）与居中加载行（DS-53）。
 * 文档类的失败页（找不到该文档、链接已失效）是编辑器路由 /documents/:id 的 failed 态，与第 1 批 open-failed 一样放在编辑器宿主（state 的 host 覆盖）；
 * 退出登录的未同步确认画在编辑器上（未同步更改的常见来源）。各状态的 note 就是这一态的规格。
 * rulings §4.25 TB-122（登录与会话）落到各态 note（含 login-offline）；画布底主按钮的不可用 / 进行中照用 kit 主按钮的不可用态（DS-123 采纳原备选：login-redirecting、
 * link-expired / alt-404-merged 发送后；第 3 批转正时删去登录页局部的 outline 切换）；回调页上的阻断页一律写产品名一行；not-found-doc 按三类人写回收站里的文档（DS-122）。
 * 特殊视口（截图与扫描，登记在 final-sweep/vp.js）：login-narrow 390 × 844；popup-completing、popup-failed 520 × 680（window.open 的尺寸）。
 *
 * 摸底里列了、这里不另画的：
 * - 分享链接落地的登录页（login-share-landing）：按 DS-119 与 login 完全相同（「联系管理员」一行常显，落地不另加）；
 * - 启动时探测会话（boot-probing）：与 callback-signing-in 同一画法，文案「正在加载…」，写在它的 note 里；
 * - 所有者打开回收站里的文档（doc-in-trash）：归 documents 场景（DS-85，documents.trash-blocked）；
 * - 普通成员直访管理页（forbidden-admin-toast）：归 home 场景的 home.admin-denied（TB-101）；
 * - /render（无界面）与 /styleguide（_kit 补齐随集成）：不出样张。
 */

const login = (seed: LoginSeed = {}) => ({ body: <LoginPage />, data: { login: seed } })

export default defineScenario({
  id: "shell-pages",
  title: "登录、会话与错误页",
  specs: ["03-33"],
  summary: "登录页（第 3 批唯一的新版式）、OIDC 回调、新窗口重新登录回调、路由兜底与错误页、退出登录确认；错误页沿用阻断页画法",
  batch: 3,
  host: "page",
  // 底座命令 account.logout（账户菜单「退出登录」，第 3 批转正并入）没有场景接住时：直接退出、回到登录页（有未同步更改时先确认的是 logout-unsynced-confirm，由那一态的 LogoutGuard 接住）
  provides: { "account.logout": "login" },
  states: [
    /* ---------------------------------------------------------------- /login 登录页 */
    {
      id: "login",
      title: "登录 · 默认",
      note:
        "rulings §4.25 DS-118、DS-119。登录页 /login（50/02 §2：Bare、无守卫、M2；PRD EM-03、EM-17、SV-06、G-66；DS-71 第 3 批唯一的新版式）：与阻断页同一画法——画布底色上居中一列，不加卡片、不放插图（kit BlockingPage）：品牌标 32（RuntimeConfig.brand，集成方可换）· 标题「登录 Cordex」（16px 600、h1；产品名取 brand 并进标题，品牌标下不单列一行产品名，同标杆 Figma「Log in to Figma…」；DS-118 的文字按画面写作「品牌标 · 标题『登录 Cordex』· 说明 · 主按钮 · 弱提示」）· 说明「将跳转到「统一身份认证」登录，完成后自动返回」（12px text-2；IdP 显示名取 GET /auth/config 的 idpDisplayName，示例值；没配或 /auth/config 取失败时写「将跳转到组织的登录服务，完成后自动返回」，见 login-offline）· 主按钮「使用组织账号登录」（TB-122：页面级主按钮保持 28 高，不为一页另开尺寸档（04 §2.13、DS-2、DS-76）；桌面定宽 240，触控或 < 640 时 44 高、占满列宽，见 login-narrow；嵌入「请在新窗口登录」的同一句主按钮用同一条宽度规则）· 弱提示「没有账号？请联系管理员开通」（12px text-2；selfSignup 关时常显，分享链接落地不另加、登录失败也不说「你还没有账号」，DS-119；03-08 §6 与图 6-1、50/02 §11 第 3 步、70/06 #11 随之改）。只有组织 OIDC 一种登录方式：不自绘密码表单、不选租户（rulings §4.15 Q6、§4.13 S-1）。必须点一下才跳 IdP、不自动跳（RP 登出回到这里时 IdP 会话还在，自动跳会被立刻登回去，60/02 §4.4）；点了顶层导航到 /api/v1/auth/oidc/login?next=…&mode=redirect（INC-18），同一颗按钮转为「正在跳转…」（login-redirecting）；发起前前端把校验过的 next 写进 sessionStorage（TB-122，见 login-error-retry）。已登录的人访问 /login 直接跳 next。焦点：不自动聚焦，页面第一个可聚焦项就是主按钮。整页 axe 零严重违规（PRD NF-05，70/06 §7.2 测 selfSignup 开 / 关）",
      page: login(),
    },
    {
      id: "alt-login-card",
      title: "未采纳 · 卡片式登录",
      note:
        "未采纳（DS-118 定为与阻断页同一画法、不加卡片，见 login）：同样的内容放进居中卡片（panel 底 + 1px 边、圆角 8：Q4 弹层档，画它时与对话框同档，对话框 2026-10-23 起改 12（DS-142）；宽 360、左右内边距 32、上下 40；不是浮层，不带阴影，Q5），按钮占满卡片内宽（360 − 边框 2 − 左右内边距 64 = 294）；卡片里同对话框：正在跳转时是主按钮的不可用态加转圈，开放注册时「注册」是次按钮（DS-37）。未采纳的理由：多一种只用在这一页的容器画法，集成方换品牌时画布与卡片两层底色都要核对；「左右分栏放产品截图或插图」也不画（换品牌时还得换图）",
      page: login({ card: true }),
    },
    {
      id: "login-signup",
      title: "登录 · 开放注册",
      note:
        "auth.selfSignup 开（部署开关，缺省关；GET /auth/config 下发，60/02 §3、60/15 §3.1；/auth/config 取失败时按缺省当作关，见 login-offline）：主按钮下多一个次按钮「注册」（同宽 240，画布底上的 outline，DS-37 / 03-02 §6.2、TB-128），点了同一标签页顶层导航到 IdP 注册页（signupUrl；注册页属于 IdP，内置 Casdoor 的登录 / 注册页主题定制是 PRD 07 G-66 的工作项，随 03-33 写，不在样张里画）；不显示「没有账号？请联系管理员开通」（DS-119）。其余同 login",
      page: login({ signup: true }),
    },
    {
      id: "login-redirecting",
      title: "登录 · 正在跳转",
      note:
        "PRD G-66「登录中」：点了「使用组织账号登录」后同一颗按钮（同一个元素，焦点留在原处）转圈、写「正在跳转…」、不可用（aria-disabled + aria-busy，防止重复点；文字已说明，不另写原因提示，同 plugins「重试中…」）；开放注册时「注册」同时不可用。画法照用 kit 主按钮的不可用态（panel-2 底 + text-3）加转圈，与第 2 批已拍板的 share.request-access-sent、offline-conflict.access-requested 同一画法——rulings §4.25 DS-123（采纳原备选「kit 不可用态」，第 2 批不动；原推荐「画布底上的主按钮不可用或进行中一律 outline 不可用态」未采纳，第 3 批转正时本页局部的 variant 切换随之删去）；宽度规则不变（TB-122：桌面 240，触控或 < 640 占满列宽、最宽 400）。embed-frame.auth-popup-open（嵌入「请在新窗口登录」· 登录窗口已打开，同一句「使用组织账号登录」）以及本场景 link-expired、alt-404-merged 发送申请之后同此，卡片里（alt-login-card）也是这一画法。进行中的一句由常驻 polite 区播报一次「正在跳转到登录服务」。浏览器从 IdP 后退回到本页（bfcache 恢复，pageshow persisted）时按钮恢复可点",
      page: login({ redirecting: true }),
    },
    {
      id: "login-error-retry",
      title: "登录 · 登录没有完成",
      note:
        "rulings §4.25 DS-120：回调页拿到 error 即 replace 到 /login?error=<码>，登录页在主按钮上方写一行内联错误（危险色 CircleAlert 16 + 12px 主文字色，role=alert；07 §7 两段式「发生了什么，能做什么」），主按钮就是重试，不单设失败页（未采纳的独立失败页见 alt-callback-failed）；再点主按钮时错误行随之消失、按钮转为正在跳转。三个失败码各一句（60/02 §2 失败出口；不回显 IdP 原始错误，细分原因只进审计）：server.auth.invalid_token「登录没有完成，请重试」（本态，state 过期、绑定值不符、换码失败等）· server.auth.account_disabled（login-error-disabled）· server.auth.idp_unavailable（login-error-idp）；离线时点主按钮的一句见 login-offline。重试保住 next（TB-122）：后端的失败回跳只带 ?error=，所以前端在发起登录前把校验过的 next 写进 sessionStorage（新键，如 cordex.auth.next，登记到 50/02 §10.1，登出与换人时清掉），这里再点主按钮时带上它，回调成功后用完即删；后端不改，分享链接落地的人重试后照常回到那份文档（70/06 #11 补用例）。50/02 §4.4 第 4 步与 03-08 §6「登录回跳失败……你还没有账号」随之改",
      page: login({ error: "invalid_token" }),
    },
    {
      id: "login-error-disabled",
      title: "登录 · 账号已停用",
      note:
        "DS-120 的同一画法：server.auth.account_disabled（用户 status=suspended，60/02 §2 回调第 6 步，不建会话）：内联错误「你的账号已停用，请联系管理员」；主按钮照常（换账号用）；弱提示「没有账号？请联系管理员开通」照常（DS-119 常显，两句说的是两件事）。IdP 会话还在时再点主按钮会被静默登回同一个停用账号、再失败一次——rulings §4.25 DS-124：这个错误码下主按钮发起的登录带 prompt=login（IdP 要求重新输入账号；发起端 GET /auth/oidc/login 接受并透传 prompt，只开放这一个值），界面不变；内置 Casdoor 不支持时退为错误行补一句文案",
      page: login({ error: "account_disabled" }),
    },
    {
      id: "login-error-idp",
      title: "登录 · 登录服务不可达",
      note:
        "DS-120 的同一画法：server.auth.idp_unavailable（发现文档或令牌端点不可达）：内联错误「暂时无法连接登录服务，请稍后重试」。rulings §4.25 DS-121（接口行为，不画）：发起端 GET /auth/oidc/login 取不到发现文档时也 302 回前端（redirect 模式回 /auth/callback?error=…，popup 模式回 /auth/popup-callback?error=…），与回调失败同一出口，用户看到的就是这一态，不会在顶层导航里看到一整页 503 problem+json；改 60/02 §2、60/15 §3.1 错误列与 70/07 A6。本机断网时不发起跳转，见 login-offline",
      page: login({ error: "idp_unavailable" }),
    },
    {
      id: "login-offline",
      title: "登录 · 网络未连接",
      note:
        "rulings §4.25 TB-122：登录页加载时取 GET /auth/config（50/02 §4.4 第 1 步）失败（网络错误、5xx）时按缺省渲染、不报错——当作 selfSignup 关、没有 IdP 显示名：弱提示「没有账号？请联系管理员开通」照常，说明用通用句「将跳转到组织的登录服务，完成后自动返回」。点主按钮时 navigator.onLine 为 false 就不跳转（顶层导航只会落到浏览器自己的错误页），主按钮上方内联「无法连接网络，请检查网络后重试」：与 DS-120 的内联错误同一画法（危险色 CircleAlert 16 + 12px 主文字色，role=alert），焦点留在主按钮，再点时重新播报一次；网络恢复（online 事件）时这一行消失。连得上网而 IdP 不可达时照常走 DS-121 的统一出口，显示 login-error-idp。本态画的是离线时点过一次主按钮之后",
      page: login({ configFailed: true, offline: true, error: "offline" }),
    },
    {
      id: "login-narrow",
      title: "登录 · 手机",
      note:
        "390 × 844（截图视口登记在 final-sweep/vp.js）：< 640 或 pointer: coarse 时（useBreakpoint narrow；Hub 链接用 data.form 强制）同一列左右 16 边距，主按钮占满列宽（最宽 400）、触控高 44、圆角 8（04 §2.13「触控按钮 44px（圆角 8）」、§2.9）、13px（07 §2：触控目标 ≥ 44、相邻间距 ≥ 8），说明与弱提示仍 12px；其余同 login。同一条规则也用在嵌入「请在新窗口登录」的窄容器与触控设备（TB-122）。M3 起手机凭分享链接查看之前先到这里（PRD NF-07、CO-15）",
      page: login({ form: "narrow" }),
    },

    /* ---------------------------------------------------------------- /auth/callback OIDC 回调 */
    {
      id: "callback-signing-in",
      title: "回调 · 正在登录",
      note:
        "rulings §4.25 DS-120：/auth/callback（50/02 §2、§4.4 第 4 步）只剩这一个过渡态——画布底色上居中一行加载行「正在登录…」（kit LoadingRow，DS-53：超过 300 ms 才出现，多数时候一闪而过，不画骨架；加载行不写产品名，产品名一行只给回调页上的阻断页），GET /auth/me 返回后 replace 到 nextAfterLogin(next)（白名单，50/02 §4.4 第 5 步；next 优先取 sessionStorage 里保住的那一个，TB-122）。带 error 时不在这里显示：窗口带有新窗口重新登录的标记（state 失效后被后端回到这里，TB-122，见 popup-failed）就直接显示 popup-failed，否则 replace 到 /login?error=<码>（login-error-*）；GET /auth/me 网络失败见 callback-network-error。启动时探测会话（RequireSession 的 unknown 态）同一画法、文案「正在加载…」，取代 50/02 §2.1 的「渲染骨架」（DS-53、TB-67），不另画。70/06 §7.2 把本页登记为非交互页的豁免理由改为「只有过渡态与网络失败页」",
      page: { body: <CenterLoading>正在登录…</CenterLoading> },
    },
    {
      id: "callback-network-error",
      title: "回调 · 网络失败",
      note:
        "rulings §4.25 TB-122：回调页 GET /auth/me 网络失败（超时、离线、502/503/504：50/02 §4.2 classifyAuthError → network，不改登录态）按本态。会话 cookie 已设好，只是确认不了——阻断页画法：云朵断开图标（同离线横幅）· 产品名一行「Cordex」（回调页上的阻断页一律在标题上方写产品名，同 alt-callback-failed、popup-done-tab、popup-failed；登录页并进标题，其余错误页不写）·「暂时无法确认登录状态」·「请检查网络连接后重试」·「重试」（主按钮：原地再调 /auth/me，不重走 IdP；成功后照常 replace 到 next，样张约 1.2 秒后转到开始页）。点「重试」先把焦点交给加载行再换状态（07 §2.4 第 3 条；加载行可程序聚焦、读屏名「正在登录」）。70/06 §7.2 的豁免理由随之改（见 callback-signing-in）",
      page: { body: <CallbackNetworkError /> },
    },
    {
      id: "alt-callback-failed",
      title: "未采纳 · 独立登录失败页",
      note:
        "未采纳（DS-120 定为回调页拿到 error 即回登录页、主按钮上方一行内联错误，见 login-error-retry）：回调页拿到 error 就地显示失败页（阻断页画法：钥匙图标 · 产品名一行 · 按码的标题与说明 ·「重新登录」主按钮 +「返回登录页」）。未采纳的理由：两个按钮做的是同一件事（都是再登录一次），回调页多一种画面（next 由前端 sessionStorage 保住，TB-122，两种画法在这一点上相同）",
      page: { body: <CallbackFailedPage /> },
    },

    /* ---------------------------------------------------------------- /auth/popup-callback 新窗口重新登录（50/02 §5） */
    {
      id: "popup-completing",
      title: "新窗口 · 正在完成登录",
      note:
        "新窗口重新登录的回调页（50/02 §5 第 3 步；PRD CO-05、CO-06、G-66「弹窗回调页」；视口 520 × 680 = window.open 的尺寸，截图视口登记在 vp.js）：/auth/popup-callback 调 GET /auth/me，在 BroadcastChannel cordex-auth 发 reauth-done（不带令牌与身份，50/14 §8）后 window.close()；期间居中一行「正在完成登录…」（超过 300 ms 才出现，多数时候窗口已经关了；加载行不写产品名）。原页 window.open 拿到空白窗口后、跳到登录地址前给这个窗口的 sessionStorage 写重新登录标记（TB-122，见 popup-failed）。原页一侧是第 2 批已拍板的 offline-conflict.auth-expired-pending（「重新登录」转圈、横幅说明「请在新窗口中完成登录…」），嵌入里是 embed-frame.auth-popup-open",
      page: { body: <CenterLoading>正在完成登录…</CenterLoading> },
    },
    {
      id: "popup-done-tab",
      title: "新标签 · 已重新登录",
      note:
        "弹窗被拦截、改在新标签页登录（offline-conflict.auth-expired-popup-blocked 的「在新标签页中登录」，嵌入里是 embed-frame.auth-blocked）时，window.close() 关不掉（经过 IdP 几次跳转的标签页不是脚本可关的）：对勾图标（text-2：阻断页的图标一律中性，不用状态色大图标）· 产品名一行「Cordex」（回调页上的阻断页一律在标题上方写产品名）·「已重新登录」·「可以关闭此页，回到原来的页面」；不放按钮（关不掉，也不引导在这里另开文档，免得同一文档开两份）。原页靠 BroadcastChannel 与重获焦点时探测 /auth/me 恢复（50/02 §5 第 4 步），所以写「回到原来的页面」而不是「本页将关闭」；原来的页面也可能是只读浏览或嵌入的仅查看，所以不写「继续编辑」。新标签是完整窗口，按 1600 × 1000 截",
      page: { body: <PopupDoneTab /> },
    },
    {
      id: "popup-failed",
      title: "新窗口 · 登录没有完成",
      note:
        "回调带了 error（60/15 §3.1：失败同样 302 回 /auth/popup-callback?error=<码>；520 × 680）：钥匙图标 · 产品名一行「Cordex」·「登录没有完成」· 按码一句原因 ·「关闭此窗口」（outline：返回类，03-02 §6.2；脚本打开的窗口关得掉）。本态为 server.auth.invalid_token「登录信息已失效，请回到原来的页面重新登录」；server.auth.idp_unavailable「暂时无法连接登录服务，请稍后在原来的页面重新登录」；server.auth.account_disabled「你的账号已停用，请联系管理员」后补半句「原来页面里未同步的更改，可在离开时导出为本地副本」（rulings §4.25 DS-125：停用后原页再也登不回来，原页横幅与频道协议都不改，更改经离开 / 刷新确认的「导出为本地副本」带走，失败页把这条路说出来）。state 失效时后端分不出这是新窗口登录（mode 只存在 oidc:state 里），会回 /auth/callback?error=…：原页 window.open 拿到空白窗口后、跳到登录地址前，给这个窗口的 sessionStorage 写重新登录标记（新键，登记到 50/02 §10.1，用完即删；TB-122），/auth/callback 带 error 且有这个标记时直接显示本页、不再跳 /login，小窗里不会出现整页登录页。在新标签里（弹窗被拦截时）关不掉：不放按钮，原因句末改为「请关闭此页，回到原来的页面重新登录」。窗口关掉后原页横幅的「重新登录」恢复可点（第 2 批 auth-expired-pending 的「窗口关闭而未完成时恢复可点」）",
      page: { body: <PopupFailed /> },
    },

    /* ---------------------------------------------------------------- 路由兜底与错误页 */
    {
      id: "not-found-route",
      title: "找不到此页面",
      note:
        "路由兜底 *（50/02 §2 errors/NotFoundPage，M1；无会话守卫）：未登记的路径（如已废止的 /d/<id>，70/06 #19；非测试部署里的 /styleguide）——阻断页画法（整屏、画布底色、不挂导航）：搜索落空图标 ·「找不到此页面」·「链接可能有误，或页面已不存在」·「返回首页」（outline：返回类，03-02 §6.2；未登录时 /home 的守卫再送去登录页）。不显示路径与错误码（07 §7）",
      page: { body: <NotFoundRoute /> },
    },
    {
      id: "not-found-doc",
      title: "找不到该文档",
      note:
        "rulings §4.25 DS-122：文档 404（server.documents.not_found）用单独的阻断页，与「没有访问权限」（403，第 1 批 main-states.open-failed-access）分开：问号文件图标 ·「找不到该文档」·「文档可能已被删除，或链接有误」·「返回文档列表」（只有这一个按钮：对不存在的文档「申请访问」必然再得 404）。拿不到元数据，不写文档名。谁会看到本页：文档不存在、永久删除中（purging），或有角色的非所有者打开回收站里的文档。打开回收站里的文档按三类人分（60/02 §6 守卫顺序：DocumentRoleGuard 在前、DocumentStateGuard 在后；60/04 表 2-2：trashed 的 meta 只给 doc.manage；与 documents.trash-blocked 同一说法）：① 所有者 → documents.trash-blocked「此文档在回收站中」+「恢复」（DS-85）；② 有角色的非所有者（编辑者、评审者、查看者，或持有效链接的人）得 404 → 本页；③ 从未获授权的人得 403 →「你没有权限访问此文档」+「申请访问」（main-states.open-failed-access、share.request-access；TB-73：照常记下申请、不透露在回收站）。是编辑器路由 /documents/:id 的 failed 态（50/02 §6、§8「申请访问遇 404 换成不存在页」、§11「404 → 不存在页」），画法同第 1 批 open-failed（去掉左栏、检查器与工具条）。文档按 DS-122 写定：03-13「打开失败态」表把「无访问权限 / 文档已删除」分成两行，03-33 §7.2、03-01 §6 与 02 F1 E5a 按这三类人写",
      host: "editor",
      editor: blockingPage(() => <NotFoundDocPage />),
    },
    {
      id: "alt-404-merged",
      title: "未采纳 · 不存在与无权限合成一页",
      note:
        "未采纳（DS-122 定为单独的「找不到该文档」阻断页、只有「返回文档列表」，见 not-found-doc）：404 与 403 合成一页「找不到文档，或你没有访问权限」+「申请访问」（Figma 文件链接打不开时的做法，不加区分；发送申请后按钮同 link-expired，kit 主按钮的不可用态，DS-123）。未采纳的理由：对不存在的文档点「申请访问」只会再得 404，发送后页上要改口；真正没有权限的人也看不出该不该申请",
      host: "editor",
      editor: blockingPage(() => <MergedNotFoundPage />),
    },
    {
      id: "link-expired",
      title: "链接已失效",
      note:
        "分享链接已撤销或到期、又没有直接授权（403 + details.reason ∈ share_link.expired / share_link.revoked，60/02 §7.4、50/02 §11 第 5 步；PRD CO-15；DS-47 改回「仅邀请」即撤销、DS-66 到期）：删除这个令牌，显示「没有访问权限」阻断页的变体——只换图标、标题与第一句说明：断链图标 ·「链接已失效」·「这个分享链接已被撤销或已过期」「可以向文档所有者申请访问，获得批准后即可打开」·「申请访问」（主按钮，第 1、2 批同一个留言弹层，DS-48）·「返回文档列表」（outline）。发送后同 open-failed-access：按钮留在原位不可用（带原因提示「已发送申请，24 小时内不能重复申请」）、页上写「已发送申请，等待文档所有者批准」；按钮的不可用态照用 kit 主按钮的不可用态（rulings §4.25 DS-123，与第 1、2 批的 open-failed-access、share.request-access-sent 同一画法）。无 reason 的 403 仍是「你没有权限访问此文档」（open-failed-access），50/02 §11 的「无权访问此文档」「链接已失效，请向文档所有者索取新链接」改为引用 03-33。编辑器路由的 failed 态，放在编辑器宿主",
      host: "editor",
      editor: blockingPage(() => <LinkExpiredPage />),
    },
    {
      id: "app-error",
      title: "页面出错了",
      note:
        "根错误边界 AppErrorBoundary（50/02 §2、50/15 §4.3、§5 图 3，M1）接住客户端崩溃：替换整个应用、不挂导航——警示图标 ·「页面出错了」·「请重新加载；如果问题持续，请复制诊断信息并联系管理员」（同 03-02 §6.2 通用兜底的句式）·「重新加载」（主按钮）·「复制诊断信息」（outline）。「复制诊断信息」点后原位变为「已复制」1.5 秒（同 03-08「复制链接」：不用系统级通知，按钮定宽不跳，polite 播报「已复制诊断信息」；阻断页上都照此，import、embed 的同一按钮跟改，对话框里写在框内，同 settings.copied），复制的是应用版本、路由（不含查询与片段）、时间、错误名与消息、traceId（PRD EM-12，不含文档内容）。没有全局 500 页：接口 5xx 由各页的内联错误与重试处理（50/15 §4.3）。50/15 §4.3、§5 图 3 已与 03-02 §6.2 一致（原「重试 / 只读打开 / 返回首页」作废）；标题与页面上的一致，同 03-33 §3、§7.4",
      page: { body: <AppErrorPage /> },
    },
    {
      id: "config-error",
      title: "配置错误",
      note:
        "RuntimeConfig 校验失败（50/02 §3）：静态页、零网络请求，不读偏好与语言包，所以中英两段都写（英文段 lang=en）；主题只跟随系统（prefers-color-scheme）——扳手图标 ·「应用配置有误，无法启动」·「请联系部署管理员检查下面的配置项」· 英文同义一句 · 出错的配置项（路径 + 中英原因：配置项与取值都用等宽、主文字色，与 text-2 的说明分开，同 plugins 插件 id 的写法；英文句写「The value none is not allowed in production builds」，不以小写的取值开头）。示例为生产构建里 auth.mode 设成了 none（50/02 §3「none 只在 dev 构建生效」）。不放按钮（重新加载解决不了）",
      page: { body: <ConfigErrorPage /> },
    },

    /* ---------------------------------------------------------------- 退出登录（50/02 §10.2） */
    {
      id: "logout-unsynced-confirm",
      title: "退出登录 · 有未同步更改",
      note:
        "账户菜单「退出登录」时本用户还有未同步更改（协同在途或离线队列，50/02 §10.2 第 1 步；PRD AS-06）才弹这个模态确认（DS-40 第三档：不可撤销的丢弃，用户打开时初始焦点在安全项「取消」）。走向与 DS-59 的离开确认相同（TB-122）：判断前先尝试同步（≤ 5 / 10 s），仍有未同步项才弹，没有就直接退出；「导出为本地副本」打开第 2 批同一个导出本地副本对话框（说明的第二句按原因换，离线 / 退出登录写「导出的副本不会自动合并回文档，恢复连接后可以对照重做。」：rulings §4.25 DS-129 按原因换第二句；同一状态里离开确认打开的也是这一个），导出后回到编辑器、不自动退出，再点「退出登录」时仍有未同步项就再弹一次（50/02 §10.2 第 1 步与图 7「导出后继续」随之改）。画法同离开确认（offline-conflict.leave-confirm）、同宽 sm 360：标题「退出登录将丢失 3 项未同步更改」· 说明两句各占一行「网络恢复后这些更改会自动同步，现在退出会丢失它们。」「可以先导出本地副本，再退出登录。」· 左下「导出为本地副本」· 右侧「取消」+ 危险色「仍要退出」。第一句与离开确认同一张按原因换的表（离线 / 登录已过期 / 协同已暂停 / 服务器保存延迟，动词「离开」换成「退出」），样张只画离线一种；就是第 2 批的 UnsyncedConfirm（第 3 批转正时加 kind logout，第一句复用离开确认的表，动词换成「退出」），不另做一份。50/02 §10.2 的「有 N 项更改尚未同步，退出将丢弃」改为引用 03-33。「仍要退出」：按 50/02 §10.2 第 2–4 步 POST /auth/logout、清理本地数据、广播 logged-out，整页跳 IdP 登出后回到登录页（样张转到 shell-pages.login）。Esc / 取消关闭后焦点回自己的头像（锚点 account）；导出对话框关闭后同样回头像。背景是离线编辑器（同 main-states.offline：离线横幅、「离线 · 3 项待同步」、头像组只剩自己）；同一状态里主菜单「返回首页」照样先弹第 2 批的离开确认。账户菜单「退出登录」发底座命令 account.logout（第 3 批转正并入），本态由这个确认接住：关掉后点自己的头像 ›「退出登录」会再弹一次",
      host: "editor",
      editor: {
        rail: { status: STATUS.offline },
        inspector: { collaborators: { people: [ME] } },
        stage: { cursor: false },
        banner: <OfflineBanner />,
        layers: <LogoutGuard />,
        data: { logoutOpen: true },
      },
    },
  ],
})
