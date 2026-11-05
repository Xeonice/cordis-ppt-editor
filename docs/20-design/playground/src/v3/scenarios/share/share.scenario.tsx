import { LI, ME, OfflineBanner, WANG, ZHANG } from "../../kit"
import { STATUS } from "../main-states/bars"
import { defineScenario, type EditorConfig } from "../types"
import { MEMBERS_DEFAULT, MEMBERS_EMPTY, MEMBERS_MANY, MEMBERS_READONLY, P_WANG_XY, REQUESTS, REQUESTS_PENDING } from "./people"
import { NoAccessPage, type RequestSeed } from "./RequestAccess"
import type { ShareSeed } from "./ShareDialog"
import { ShareLayer } from "./ShareLayer"

/**
 * share：03-08 分享与权限对话框（第 2 批 · 协作族）。入口是检查器顶行「分享」（DS-1），对话框是 kit Dialog（md 480，标题 13px 600）。
 * 行为、状态与文案以 03-08 为准（rulings §4.15 T-0 / Q6、§4.17 D1、§4.18 BE-02、§4.24 AL-1 / AL-5），视觉按 v3（DS-1…DS-37，控件安静样式 DS-35…DS-37）；
 * 03-08 没写、按 PRD 补的：链接有效期（SV-06、07 G-61）、访问申请的所有者端（07 G-56，03-12 写明属 03-08 后续补充）、成员列表加载失败——都记在交付的 decisions。
 * 同目录：ShareLayer（入口与开关）、ShareDialog（对话框与各节）、InviteBox（邀请与联想）、LinkBlock（链接权限、有效期、复制链接）、parts（分节、角色下拉、行内确认、骨架）、people（示例数据）。
 */

const share = (s: ShareSeed, extra?: EditorConfig): EditorConfig => ({ ...extra, data: { share: s } })

/** 离线横幅：kit OfflineBanner（与 main-states.offline 同一条） */
const OFFLINE_BANNER = <OfflineBanner />

/**
 * 申请人一侧（打开时就没有权限）：与第 1 批 main-states.open-failed-access 同一阻断页（不渲染左栏、检查器与工具条），
 * 主操作「申请访问」接上留言弹层（RequestAccess）；没有分享对话框（layers 清掉）；发送后的反馈只在页上（不另出轻提示）
 */
const noAccess = (request: RequestSeed): EditorConfig => ({
  toolbar: { hidden: true, collapse: true },
  regions: { leftRail: () => null, inspector: () => null, stage: () => <NoAccessPage /> },
  layers: null,
  data: { request },
})

export default defineScenario({
  id: "share",
  title: "分享与权限",
  specs: ["03-08"],
  batch: 2,
  summary: "检查器顶行「分享」打开：按人邀请与联想、成员角色与移除、链接权限与有效期、复制链接；加载、出错、离线、非所有者只读与访问申请",
  // 别的样张里点「分享」（检查器顶行 / 网格胶囊，那里没有场景接住 share）：转到这里，不静默无响应（ED-30）——编辑模式是所有者视角（default），
  // 评审、只读浏览是非所有者打开的「谁能访问」（no-permission）；对话框打开、焦点进框，关闭后焦点回「分享」
  provides: { share: { edit: "default", review: "no-permission", viewer: "no-permission" } },
  // 对话框类状态去掉远端光标，减少干扰（README §3）；对话框挂在浮层平面。
  // 画布照常画示例文档的评论钉（底座 stage.commentPins）——rulings §4.25 DS-43「编辑模式照常显示评论钉」（第 1 批编辑态停在第 4 页的画面同样用这个参数补了钉）
  editor: { stage: { cursor: false, commentPins: true }, layers: <ShareLayer /> },
  states: [
    /* ---------------------------------------------------------------- 默认与空 */
    {
      id: "default",
      title: "所有者视角",
      note: "03-08 默认态：邀请协作者（可见标签即节标题、持久帮助文字、角色缺省「可评审」，输入为空时「邀请」不可用并写原因）┊ 有权限的用户（身份色头像、姓名与邮箱、角色；自己排第一，所有者一行静态「所有者」）——成员行的角色是无框文字「可编辑 ⌄」，右对齐到行尾，悬停、聚焦、展开时才铺浅灰底（标杆 Figma 同此；邀请行、访问申请行与链接行的下拉仍带细边）┊ 通过链接分享（缺省「仅邀请的用户可访问」·「复制链接」，常驻「打开链接需要先登录」）。权限即时生效，所以没有底栏；唯一的主按钮是「邀请」；× / Esc 关闭后焦点回到检查器顶行「分享」，再点「分享」重新打开",
      editor: share({}),
    },
    {
      id: "empty",
      title: "空 · 只有所有者",
      note: "03-08「空（尚无额外成员）」：有权限的用户只有所有者一行，不画空状态插画（这是正常初始态，不是需要引导的「空」）",
      editor: share({ members: MEMBERS_EMPTY }, { inspector: { collaborators: { people: [ME] } } }),
    },
    {
      id: "loading",
      title: "加载中",
      note: "03-08「加载」（按 DS-53 改；03-08 原文「成员列表显示骨架行」，随 DS-53 回写）：不画灰色骨架条（质量门 Q8）；加载中与加载失败同一结构——两节标题都在、各一行占位：「有权限的用户」是一行 kit LoadingRow「正在加载成员与链接设置…」（转圈 14 + 12px text-2，左对齐、行高 32，与版本历史的加载行同一件；读屏名「正在加载成员与链接设置」），成员区按加载完成时的 3 行留高（120）；「通过链接分享」一行 text-2「加载完成后可设置」。对话框顶部锚定（kit Dialog anchor=\"top\"，距顶 max(64px, 12vh)、只向下伸展），加载完成时标题、邀请框与链接一节都不跳；邀请输入框保持可用",
      editor: share({ phase: "loading" }),
    },
    {
      id: "load-failed",
      title: "加载失败",
      note: "03-08 未写，按 DS-53 补：与加载中同一结构——成员与链接设置没取到时，邀请一节照常可用；「有权限的用户」下一行危险色图标 +「成员与链接设置加载失败，请稍后重试」（与版本历史、插件面板的「〈对象〉加载失败」同一说法）+「重试」（只出现这一次；次按钮，点了回到加载中，焦点交给加载行本身——读屏名「正在加载成员与链接设置」，加载完成后交给邀请输入框），成员区同样留高；「通过链接分享」同一位置、同一行高写「暂时无法设置」（加载中是「加载完成后可设置」；失败时已不在加载，重试成功后才有链接设置），这一节不会时有时无；不另开错误页",
      editor: share({ phase: "load-failed" }),
    },

    /* ---------------------------------------------------------------- 邀请 */
    {
      id: "invite-suggest",
      title: "邀请 · 联想",
      note: "03-08 / 60/15 §3.2：联想只返回本部署已有账号的个人（不返回用户组，rulings §4.15 Q6），按显示名前缀、至少 2 个字符；邮箱只做精确匹配、不回显，所以联想行只有头像与姓名；已在列表里的人右侧注明「已有权限 · 可编辑」。↑ ↓ 选择、Enter 选定，Esc 先收起联想（不关对话框）",
      editor: share({ invite: { text: "王小", suggest: true } }),
    },
    {
      id: "invite-added",
      title: "邀请成功",
      note: "rulings §4.17 D1：邀请即直接写入权限，没有「已邀请 · 未接受」行；王小雨立刻出现在有权限的用户里（排在所有者之后的第一位，短暂铺一层 panel-2 底），输入框清空，读屏播报「已邀请王小雨（可评审）」",
      editor: share({ members: [...MEMBERS_DEFAULT.slice(0, 1), { ...P_WANG_XY, role: "commenter" }, ...MEMBERS_DEFAULT.slice(1)], added: P_WANG_XY.id }),
    },
    {
      id: "invite-no-account",
      title: "邀请失败 · 账号不存在",
      note: "03-08 错误表第 1 行（auth.selfSignup 关，缺省）：内联在输入行正下方（危险色、role=alert，输入框 aria-invalid 并 aria-describedby 指向它），不用 alert()；不提供「仍然邀请」之类的待定邀请入口",
      editor: share({ invite: { text: "lin.feng@example.com", role: "editor", error: "no-account" } }),
    },
    {
      id: "invite-no-account-signup",
      title: "邀请失败 · 账号不存在（可自助注册）",
      note: "03-08 错误表第 2 行（auth.selfSignup 开）：文案改为请对方先注册并登录，也可以把分享链接发给对方；注册在 IdP 完成，对话框不承载注册",
      editor: share({ invite: { text: "lin.feng@example.com", role: "editor", error: "no-account" }, selfSignup: true }),
    },
    {
      id: "invite-invalid",
      title: "邀请失败 · 邮箱格式不对",
      note: "03-08 错误表：「请输入有效的邮箱地址」——前端校验，不发请求",
      editor: share({ invite: { text: "lilei@example", error: "invalid" } }),
    },
    {
      id: "invite-duplicate",
      title: "邀请失败 · 已有此权限",
      note: "03-08 错误表：李雷已是「可评审」又被邀请为「可评审」——「该用户已有此权限」，不发请求",
      editor: share({ invite: { text: "李雷", pick: "u-lilei", role: "commenter", error: "duplicate" } }),
    },
    {
      id: "invite-downgrade",
      title: "邀请 · 会降低已有权限",
      note: "03-08 边界情况：王小明当前「可编辑」，又被邀请为「可评审」——以本次邀请为准（覆盖），邀请前先给一行提示「该用户当前为可编辑，邀请后将变为可评审」（警告色图标），避免误降权",
      editor: share({ invite: { text: "王小明", pick: "u-wangxm", role: "commenter" } }),
    },
    {
      id: "invite-failed",
      title: "邀请失败 · 网络或服务端",
      note: "03-08 错误表：「邀请失败，请稍后重试」+ [重试]——主按钮就地变为「重试」（同一请求只留一个入口，质量门 Q2；改了输入框变回「邀请」），输入内容保留",
      editor: share({ invite: { text: "王小雨", pick: "u-wangxy", error: "failed" }, failNetwork: true }),
    },

    /* ---------------------------------------------------------------- 成员 */
    {
      id: "role-menu",
      title: "成员 · 角色下拉",
      note: "03-08：角色下拉三项「可编辑 / 可评审 / 可查看」（右侧一句能做什么；成员行的触发器是无框文字「可编辑 ⌄」，展开时铺浅灰底），变更即时生效（05 §8 对方 ≤ 2 秒收到）；末项隔线是「移除」（危险色）——移除入口放在下拉里、不另设行尾 ×（Figma 做法，DS-40；未采纳的备选见 alt-remove-x）",
      editor: share({ roleMenu: "u-wangxm" }),
    },
    {
      id: "remove-confirm",
      title: "成员 · 移除前行内确认",
      note: "03-08：移除不可撤销，走确认——在该行内嵌确认「移除王小明？对方将立即失去访问权限」+ 取消 · 移除（危险），不另开模态；用户打开的确认焦点先落在「取消」（确认句经组的 aria-describedby 随之念出），Esc 等同取消、不关对话框；确认后该行 240ms 淡出",
      editor: share({ confirm: "u-wangxm" }),
    },
    {
      id: "many-members",
      title: "大量成员",
      note: "03-08 边界情况：超过约 20 人时节标题下出现搜索框（按姓名或邮箱过滤，右侧给命中人数，读屏 polite 播报「找到 N 位」）；右侧一列角色是无框文字「可编辑 ⌄」（不再排成一列 20 多个框），列表在节内滚动，邀请与链接两节留在原位；产品里列表虚拟滚动",
      editor: share({ members: MEMBERS_MANY }, { inspector: { collaborators: { people: [ME, WANG, LI, ZHANG], extra: 0 } } }),
    },

    /* ---------------------------------------------------------------- 链接 */
    {
      id: "link-menu",
      title: "链接 · 权限下拉",
      note: "03-08 链接权限三项（单组织，T-0）：仅邀请的用户可访问（缺省，链接本身不授予角色）/ 登录用户凭链接可查看 / 登录用户凭链接可评审；没有「可编辑」（AL-1），菜单末尾一行写明；原「允许下载 / 打印」开关已删（AL-5）",
      editor: share({ link: { menu: "access" } }),
    },
    {
      id: "link-view",
      title: "链接 · 凭链接可查看",
      note: "03-08：放宽不需要二次确认。链接授予角色时同一行多一个「有效期」（永久 / 7 天 / 30 天，PRD SV-06、07 G-61，DS-47）；说明行「本部署的任何人凭链接即可查看。打开链接需要先登录」——没有匿名 / 访客（S-1），链接角色只叠加、不降低已有角色",
      editor: share({ link: { access: "view" } }),
    },
    {
      id: "link-expiry",
      title: "链接 · 有效期",
      note: "PRD SV-06 / 07 G-61：有效期下拉（永久有效 / 7 天 / 30 天，右侧写到期日）；选了期限后说明行写「链接 10 月 15 日到期」。03-08 未写，按 DS-47 补",
      editor: share({ link: { access: "comment", expiry: "7d", menu: "expiry" } }),
    },
    {
      id: "link-tighten",
      title: "链接 · 收紧前确认",
      note: "03-08：从宽松收紧时，凭链接进入的人按「直接授权与仍有效的链接角色取高者」重算，在线会话 1 秒内降权或失去访问（03-12）。改回「仅邀请的用户可访问」会让不在列表里的人立即失去访问、且不可撤销，所以在这一节里行内确认（DS-40）；收紧即撤销（DS-47：令牌轮换，旧链接永久失效），确认句后补一句「原链接将永久失效，再次放宽时会生成新链接。」（按分句换行，确认行变三行、对话框随之向下伸展）。用户选了「仅邀请」后焦点落在确认行的「取消」（整句经组的 aria-describedby 一起念出）（链接权限菜单关闭时不再抢回下拉），「取消 / 更改」或 Esc 后焦点回到「链接权限」；可评审 → 可查看仍有访问，直接生效",
      editor: share({ link: { access: "view", confirm: "invite" } }),
    },
    {
      id: "link-expired",
      title: "链接 · 已到期",
      note: "rulings §4.25 DS-66「到期等同收紧」/ 03-08 §4.3：link-expiry 里选了 7 天的链接已经到期，所有者再打开对话框（布局同 default）——链接权限下拉回到「仅邀请的用户可访问」，有效期下拉不再出现，说明行在含义之后补一句原链接的到期日：「只有上面列出的人能打开此链接，原链接已于 10 月 15 日到期。打开链接需要先登录。」（到期日取自所有者读到的链接记录，60/15 §3.5；按分句换行）。到期不经确认、不另设「续期」：要再分享就像撤销之后一样重新放宽，生成一条新链接（同 DS-47 的撤销，旧链接不会复活），这句随之消失。凭旧链接进入的人按直接授权重算权限（§4.18 BE-02，在线会话按 03-12 降权或换成阻断页）；非所有者的只读视图只看到「仅邀请的用户可访问」，不写到期（TB-65）。示例的「今天」在 10 月 15 日之后",
      editor: share({ link: { access: "invite", expired: "7d" } }),
    },
    {
      id: "link-copied",
      title: "链接 · 已复制",
      note: "03-08：「复制链接」点后短暂变为「已复制」（1.5 秒后恢复），不用系统级通知；两种文案同宽，这一行不跳；读屏播报「已复制链接」。仅邀请时复制的是文档地址，链接授予角色时是带令牌的分享链接（50/02 §11）",
      editor: share({ link: { access: "view", copied: true } }),
    },

    /* ---------------------------------------------------------------- 离线、权限不足、访问申请 */
    {
      id: "offline",
      title: "离线",
      note: "03-08「离线」：对话框顶部一行说明「离线时无法邀请协作者或生成分享链接」（InspectorNotice，与「只读」行、版本历史面板的离线说明同一画法；警告色只在横幅通道）；邀请框、角色下拉、链接权限与「复制链接」留在原位、不可用（工具提示「离线时不可用」，仍可聚焦）；成员列表是离线前的缓存。背后编辑器同时是离线横幅与「离线 · 3 项待同步」",
      editor: share(
        { offline: true },
        { banner: OFFLINE_BANNER, rail: { status: STATUS.offline }, inspector: { collaborators: { people: [ME] } } },
      ),
    },
    {
      id: "no-permission",
      title: "权限不足 · 非所有者打开",
      note: "03-08「权限不足」：标题「谁能访问…」，整体只读——没有邀请框、角色下拉与移除，成员只列姓名与角色（不显示邮箱；单行，头像 20，与其余单行列表一致）；链接只读一行 +「复制链接」（仅邀请时复制文档地址；链接授予角色时复制分享链接，见 no-permission-link，DS-69）；顶部一行「只读 · 只有所有者可以更改分享设置」（与检查器只读说明同一组件，DS-15）。后端成员列表接口（GET /permissions）原来只给 doc.manage，随 DS-48 放宽",
      editor: share({ view: "readonly", members: MEMBERS_READONLY }, { inspector: { collaborators: { people: [ME, ZHANG, WANG] } } }),
    },
    {
      id: "no-permission-link",
      title: "权限不足 · 链接已开启",
      note: "rulings §4.25 DS-69（复制分享链接，同 Figma）：非所有者打开的只读「谁能访问…」（同 no-permission），所有者已把链接设为「登录用户凭链接可查看」——链接只读一行写当前链接权限（楼宇图标 +「登录用户凭链接可查看」）+「复制链接」，说明行与所有者相同「本部署的任何人凭链接即可查看。打开链接需要先登录。」（不写有效期与到期日，TB-65）；「复制链接」复制的就是凭链接访问的分享链接（带令牌，效果与说明行一致）：后端对能读文档的成员返回当前有效链接的令牌（只在链接授予角色时；DS-69 修订 TB-65「非所有者拿不到令牌」），所有者改回「仅邀请」时令牌照样作废（DS-47）。仅邀请时复制文档地址（no-permission）",
      editor: share({ view: "readonly", members: MEMBERS_READONLY, link: { access: "view" } }, { inspector: { collaborators: { people: [ME, ZHANG, WANG] } } }),
    },
    {
      id: "access-requests",
      title: "访问申请（所有者端）",
      note: "PRD 07 G-56 / 03-12「申请访问」的所有者端（03-12 写明属 03-08 后续补充）：对话框顶部「访问申请 1」一节（节名统一为「访问申请 N」：PRD G-56 的「待处理申请 N」随 DS-48 回写、统一成这一个），逐条显示申请人、留言与时间，选角色后「批准」（次按钮，等同按人邀请）或「拒绝」；「邀请」仍是唯一的主按钮；批准 / 拒绝后焦点交给下一条申请，没有了交给新加入的成员或邀请框；拒绝不告知申请人（DS-68：申请人再打开文档时阻断页与第一次相同，满 24 小时后可以再申请）。申请人一侧见 request-access；对话框关着时「分享」按钮上的待处理提示见 request-pending（遮罩后面的「分享」同样带点、读屏名「分享（1 个待处理的访问申请）」，与对话框同一份数据）。后端已登记访问申请端点（60/15 §3.4；DS-48 定了所有者端与申请人一侧的画法）",
      editor: share({ requests: REQUESTS }),
    },
    {
      id: "request-pending",
      title: "有待处理的访问申请 · 「分享」按钮带提示",
      note: "DS-48（标杆 Figma：有人申请访问时 Share 按钮上出现提示）：编辑器常态、对话框关着，检查器顶行的「分享」按钮右上角带一个强调色小圆点（不用红色，质量门 Q3；网格视图右上胶囊里是同一个按钮，同样带点），工具提示与读屏名「分享（2 个待处理的访问申请）」；点它打开分享对话框，顶部是「访问申请 2」一节（同 access-requests），批准 / 拒绝后圆点随待处理条数减少、清零即消失，关闭后焦点回「分享」。圆点由数据（待处理的申请数，与对话框里「访问申请 N」同一份）驱动，缺省 0：没有待处理申请的状态与第 1 批画面都不带点；只有所有者看到（非所有者的只读视图没有这一节）",
      editor: share({ closed: true, requests: REQUESTS_PENDING }),
    },
    {
      id: "request-access",
      title: "申请访问 · 留言弹层（申请人）",
      note: "PRD 07 G-56「申请访问 → 弹层：可选留言（≤ 200 字）+ 发送」，03-12「权限变更的双向反馈补充」写明弹层属于分享对话框（03-08）的补充：阻断页「申请访问」下方一张非模态小弹层——标题「申请访问」+「文档所有者批准后即可打开」+ 留言框（可选，计数常显）+「取消 / 发送」；用户打开时焦点进留言框，Esc / 取消关闭、焦点回按钮。两处入口共用这一个件：打开时就没有权限（这里，与第 1 批 main-states.open-failed-access 同一页面）、会话中访问被撤销（offline-conflict.access-revoked）。见 DS-48",
      editor: noAccess({ open: true }),
    },
    {
      id: "request-access-sent",
      title: "申请访问 · 已发送（申请人）",
      note: "G-56：发送后弹层收起，「申请访问」留在原位不可用（不隐藏、仍可聚焦），工具提示「已发送申请，24 小时内不能重复申请」，页上写「已发送申请，等待文档所有者批准」（常驻、polite 播报一次）；不再另出轻提示（同一件事不说两遍，样张第 2 轮评审意见；通知由集成方发给所有者，依据 DS-67 的 Webhook 事件 access_request.created）；所有者端见 access-requests。见 DS-48",
      editor: noAccess({ sent: true }),
    },

    /* ---------------------------------------------------------------- 未采纳的备选（DS-63：留作对照，实现以推荐为准） */
    {
      id: "alt-remove-x",
      title: "未采纳 · 行尾 × 移除",
      note: "未采纳：DS-40 定为推荐（share.role-menu）。DS-40 未采纳的备选：按 03-08 原文，每行角色下拉后面一个 ×（移除），所有者一行留空位对齐；点 × 后同样在行内确认。推荐方案（role-menu）把「移除」收进角色下拉，每行只有一个控件",
      editor: share({ removeStyle: "x" }),
    },
    {
      id: "alt-link-url",
      title: "未采纳 · 显示链接地址",
      note: "未采纳：DS-47 定为推荐（share.default）。DS-47 未采纳的备选：按 03-08 线框，链接区第一行是只读链接地址 +「复制链接」，第二行「链接权限」下拉。推荐方案（default）不显示地址，只留权限下拉与「复制链接」一行（为简洁，同 Figma；复制时取当前有效链接的令牌，见 DS-47、TB-71）",
      editor: share({ linkUrl: true }),
    },
  ],
})
