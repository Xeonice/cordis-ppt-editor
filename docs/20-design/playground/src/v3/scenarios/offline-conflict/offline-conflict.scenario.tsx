import type { ReactNode } from "react"
import { CirclePause, KeyRound, Layers, Lock } from "lucide-react"
import { Avatar, BannerStack, CARD_POS, DEFAULT_DECK, ICON, InspectorNotice, lockTools, ME, RailList, RailThumb, RemoteSelection, slideOf, Toast, Toasts, WANG } from "../../kit"
import { ONLINE_SHOWN } from "../main-states/panels"
import { PresenceCursor } from "../main-states/presence"
import { qrDeck } from "../main-states/slides"
import masterView from "../masters-themes/master-view.scenario"
import narrow from "../narrow/narrow.scenario"
import { placeholderOrigin } from "../text-edit/inspector"
import { defineScenario, type EditorConfig } from "../types"
import {
  AuthExpiredBanner, DocDeletedBanner, LongOfflineBanner, NarrowOfflineBanner, OfflineBanner, PALER_SOFT, QuarantineBanner, RecoveredBanner, RecoveredSoftBanner,
  EXPORT_COPY, RejectedBanner, REJECTED_TEXT, RevokedBanner, SeatsFullBanner, ServerUnsavedBanner, TooLargeBanner,
} from "./banners"
import { DECK_CARD_DELETED, DECK_PAGE_DELETED, LAYOUT_REMOTE, SameTextHint } from "./conflicts"
import { ExportLayer, LeaveGuard, RefreshConfirmLayer } from "./dialogs"
import { blockingPage, RevokedPage, ViewersFullPage } from "./pages"
import { STATUS } from "./status"

/**
 * offline-conflict：03-12 离线 / 冲突横幅在 v3 的第 2 批（协作族）样张。
 * 第 1 批 main-states 已拍板的 syncing、reconnecting、offline、offline-grid、degraded（含主菜单与缩略图右键）、remote-overwrite、undo-skipped / blocked、
 * plugin-* 原样复用、不重画；这里补齐 03-12 其余状态与边界：已恢复与长离线、离线时浏览器报告断网、服务器保存延迟（发起方横幅 / 其余协作者弱提示）、
 * 离开与刷新的拦截、登录已过期（含登录窗口打开中与被拦截）、降权的导出流程与已导出、无未同步更改的降权、被提权、登录账号已变更、名额已满、
 * 访问被撤销与查看人数已满（阻断页）、隔离态、文档已被删除、更改过大、横幅优先级与叠放（含母版视图下两条、仅查看形态）、软冲突 B / C / D / E / I、配额与软门禁轻提示。
 * 行为与文案以 03-12、05 §5–§8、02-user-flows F4 / F5、PRD CO-01 / CO-05 / CO-06 / CO-08、50/07 §3–§9 为准；视觉按 v3（rulings §4.25 DS-1…DS-37）。
 * 「状态栏 / 状态胶囊」在 v3 即文件名旁的同步状态行（03-02 §3.1）。同目录：status（同步状态行）、banners（横幅与两条叠放）、dialogs（离开 / 刷新拦截、导出本地副本）、
 * pages（阻断页）、conflicts（软冲突件）。
 */

const noop = () => undefined

/** 断线（离线、登录已过期、隔离态、文档已删除）时在场信息随连接消失：头像组只剩自己（05 §1），画布上没有远端光标 */
const ALONE: EditorConfig["inspector"] = { collaborators: { people: [ME] } }
const NO_CURSOR: EditorConfig["stage"] = { cursor: false }

const lockNotice = (text: string) => <InspectorNotice icon={<Lock {...ICON} aria-hidden="true" />}>{text}</InspectorNotice>

/**
 * 只读（readonly-degraded 及同类，DS-15）：与第 1 批 main-states.degraded 同一套底座配置——检查器只读展示当前值、顶部一行说明；
 * 创建工具留在原位、不可用并写原因（「选择」照常；降为「可评审」时「评论」照常）；左栏新建、主菜单与缩略图右键里改文档的命令同样不可用。
 */
export function readonly(reason: string, notice: string, status: ReactNode, keepComment = false): EditorConfig {
  return {
    slide: 3,
    rail: { status, newSlide: { reason }, readonlyDegraded: reason },
    inspector: { readOnly: true, notice: lockNotice(notice) },
    toolbar: { disabled: lockTools(reason, { except: keepComment ? ["comment"] : [], select: true }) },
  }
}

/**
 * 暂时不能编辑时检查器里的色块（背景主题颜色、颜色字段的色块）、主题缩略与版式缩略降到半透明——满色看不出已经不可用（第 2 轮评审）；
 * 悬停环本来就随不可用去掉。只包在登录已过期、隔离态这两类状态的检查器外（display: contents，不影响布局），不改底座：
 * 第 1 批「打开中」同样走 inspector.disabled，那批画面已拍板，不跟着变
 */
export const PAUSED_DIM = [
  "contents",
  "[&_button[aria-pressed][aria-disabled=true]>span]:opacity-50",
  "[&_[data-v3-anchor=background-color]_label>span:first-child]:opacity-50",
  "[&_[data-v3-anchor=theme-card]>span:first-child]:opacity-50",
  "[&_[data-v3-anchor=layout-field][aria-disabled=true]>span:first-child]:opacity-50",
].join(" ")

/**
 * 暂时不能编辑（登录已过期、隔离态：50/07 §3.2「可编辑：否」，命令管线拒绝写命令）：这是暂时状态，不是角色——
 * 字段留在原位、aria-disabled、工具提示写原因（inspector.disabled，与打开中同一口径），不是只读展示；连接已断开，头像组只剩自己。
 * 一组项原因相同，检查器标题上方一行说明写原因（TB-22，InspectorNotice：「暂不可编辑 · 〈怎样恢复〉」，图标同横幅），原因不只藏在每个控件的工具提示里；
 * 色块与缩略图降到半透明（PAUSED_DIM）。
 */
export function paused(reason: string, status: ReactNode, notice: ReactNode): EditorConfig {
  return {
    rail: { status, newSlide: { reason }, readonlyDegraded: reason },
    inspector: { disabled: reason, notice, collaborators: { people: [ME] } },
    toolbar: { disabled: lockTools(reason, { select: true }) },
    stage: NO_CURSOR,
    regions: { inspector: (_, d) => <div className={PAUSED_DIM}>{d.inspector()}</div> },
  }
}

/** 登录已过期 / 隔离态检查器顶部的说明行（图标与各自横幅一致，text-2） */
const AUTH_NOTICE = <InspectorNotice icon={<KeyRound {...ICON} aria-hidden="true" />}>暂不可编辑 · 重新登录后恢复</InspectorNotice>
const PAUSED_NOTICE = <InspectorNotice icon={<CirclePause {...ICON} aria-hidden="true" />}>暂不可编辑 · 协同已暂停，刷新后恢复</InspectorNotice>

/** 降权且有更改被拒（03-12 readonly-degraded 权限降级分支）：横幅、只读外观与导出对话框（ExportLayer 随横幅「导出为本地副本」开合）。 */
const DEGRADED: EditorConfig = {
  ...readonly("需要编辑权限", "只读 · 需要编辑权限", STATUS.degraded, true),
  banner: (
    <RejectedBanner title="你的权限已变更为「可评审」">{REJECTED_TEXT}</RejectedBanner>
  ),
  layers: <ExportLayer />,
}

/**
 * 离线（第 1 批 main-states.offline 的同一套配置）：横幅、同步状态行「离线 · 3 项待同步」、头像组只剩自己。
 * 本端有未同步更改：主菜单「返回首页」先弹离开确认（LeaveGuard 接住底座命令 home，03-12「离开保护」），不直接跳转。
 */
const OFFLINE: EditorConfig = {
  rail: { status: STATUS.offline },
  inspector: ALONE,
  stage: NO_CURSOR,
  banner: <OfflineBanner />,
  layers: <LeaveGuard cause="offline" />,
}

/**
 * 母版视图的整套配置（master-view 场景的场景级配置：masterView.open——载入时已在母版视图，左栏母版窗格、画布、检查器、工具条与母版横幅由宿主按登记的母版实现画），
 * 这里只写第二条横幅：宿主把它叠在母版横幅下面（BannerStack，母版横幅常驻在上，TB-14；2026-10-28 母版视图改版第一步起由宿主叠放，原来两态自己写 BannerStack）。
 */
const MASTER: EditorConfig = masterView.editor ?? {}
const MASTER_DATA = MASTER.data ?? {}

/**
 * 仅查看形态（narrow 场景的场景级配置：左栏 / 检查器不渲染，画布换成查看器）。查看器是相对画布列 absolute inset-0 铺满的，
 * 会盖住横幅通道；这里把它包进横幅下方的一层（relative、占满剩余高度），查看器的顶部条因此排在横幅下面；工具条位置不留（查看器自带底部浮动条）。
 * 建议集成阶段让查看器自己排在横幅下面（narrow/viewer.tsx）。
 */
const NARROW: EditorConfig = narrow.editor ?? {}
const narrowStage: NonNullable<EditorConfig["regions"]>["stage"] = (ctx, d) => (
  <div className="relative flex min-h-0 flex-1 flex-col">{NARROW.regions?.stage ? NARROW.regions.stage(ctx, d) : d.stage()}</div>
)

/** 王小明的头像（软冲突轻提示左侧：谁改的，与第 1 批 undo-skipped 同一画法） */
const WANG_AVATAR = <Avatar name={WANG.name} tone={WANG.tone} size={20} />

export default defineScenario({
  id: "offline-conflict",
  title: "离线与冲突",
  specs: ["03-12"],
  batch: 2,
  summary: "横幅通道里的连接、鉴权、权限与服务器保存状态，离开与刷新的拦截，导出本地副本，阻断页，横幅优先级与母版视图下两条，软冲突与配额提示",
  // 画布照常画示例文档的评论钉（底座 stage.commentPins：第 4 页 3 枚）——rulings §4.25 DS-43「编辑模式照常显示评论钉」（第 1 批编辑态停在第 4 页的画面同样用这个参数补了钉）
  editor: { stage: { commentPins: true } },
  states: [
    /* ---------------------------------------------------------------- 连接类（第 1 批已有：同步中、重连中、离线、离线 · 网格） */
    {
      id: "recovered",
      title: "已恢复",
      note: "03-12「已恢复」：重连并同步完成后横幅换成「已恢复协同并同步完成」，产品里 3 秒后自动滑出（样张不计时、停住不动，便于与 long-offline 那一条对照），也可以手动关闭（×「关闭提示」）；中性 panel 底 + 成功色对勾（状态色只给图标，04 §2.5）；在场信息回来，头像组与远端光标恢复；同步状态行回到「✓ 已同步」",
      editor: { banner: <RecoveredBanner /> },
    },
    {
      id: "alt-recovered-soft",
      title: "未采纳 · 已恢复用成功浅底",
      note: "未采纳：DS-41 定为推荐（offline-conflict.recovered）。DS-41 未采纳的备选，与 recovered 对照：成功浅底（--v3-success-soft，暗 ≈ #304139 / 亮 ≈ #DFEDE5）。DS-41 定为中性底：每次重连都会闪一下，绿底在 3 秒里过于抢眼；警告 / 错误横幅仍用对应浅底",
      editor: { banner: <RecoveredSoftBanner /> },
    },
    {
      id: "long-offline",
      title: "长时间离线后重连 · 合并后请检查（P1）",
      note: "PRD CO-06 / 05 §7 / F5：离线超过 24 小时的队列重连合并后追加「较长时间离线，合并后请检查」并列出受影响页（取被合并的待同步事务所在页，50/07 §4）；写在「已恢复」这一条上，页码可点（切到该页），带检查清单的这一条不自动滑出，看完手动关闭（DS-59）。图标用中性 Info（text-2），不用成功色对勾：这一条要用户回头检查，对勾容易让人以为不用处理（标杆对照：Figma 在「已同步但可能有冲突」时换成「!」）；普通的「已恢复」仍是成功色对勾。受影响页超过 3 页时只列前 3 页、其后写「等 N 页」（N 为受影响页总数，DS-59）；这里 3 页，全部列出",
      editor: { banner: <LongOfflineBanner pages={[2, 3, 5]} /> },
    },
    {
      id: "offline-no-network",
      title: "离线 · 浏览器报告断网",
      note: "03-12「离线」：浏览器报告离线（navigator.onLine = false）期间周期重连暂停、「立即重连」不可用（不隐藏、仍可聚焦），工具提示「网络恢复后可重连」（演示：状态一出现就展开，第一次点按或按键后收起）；收到 online 事件立即重连。警告浅底上不可用按钮的文字是 text-2（暗 4.56 / 亮 4.60，DS-41 方案 B：kit Banner 统一处理、浅底 token 不动；原来的 text-3 只有 2.68，低于不可用项 3:1）。其余同第 1 批 main-states.offline",
      editor: { ...OFFLINE, banner: <OfflineBanner noNetwork /> },
    },
    {
      id: "alt-soft-paler",
      title: "未采纳 · 横幅浅底调淡（方案 A · 警告）",
      note: "未采纳：DS-41 定为推荐（offline-conflict.offline-no-network）。DS-41 未采纳的方案 A（状态色）：横幅上不可用按钮的文字留在 text-3，改把浅底调淡——暗色警告浅底由 16% 调到 10%（≈ #403A2F：text-3 3.05、图标 6.03、正文 ≥ 10），亮色危险浅底由 14% 调到 8%（≈ #FBEEEE，见 alt-soft-paler-danger）；其余浅底与三种状态色不变，亮色警告浅底原本就有 3.08（本状态只在暗色下有变化）。对照方案 B（DS-41 定为推荐，现行）：offline-no-network（浅底不动、按钮文字 text-2）。这里只在本状态局部覆盖变量演示；若采用须改 v3.css 的全局 token，第 1 批离线、降权等浅底横幅的底色都会跟着变；横幅以外，第 1 批缺插件三态（main-states.plugin-missing / -undeclared / -version）左栏第 6 页的警示角标（暗色）也随之变淡",
      editor: {
        ...OFFLINE,
        banner: (
          <BannerStack className={PALER_SOFT}>
            <OfflineBanner noNetwork />
          </BannerStack>
        ),
      },
    },
    {
      id: "soft-danger-pending",
      title: "危险横幅 · 按钮进行中（方案 B，现行）",
      note: "DS-41 的对照（危险浅底上的进行中按钮）：降权横幅点了导出、正在生成副本时「导出为本地副本」换成转圈「正在导出…」、不可用（工具提示「正在生成副本，完成后自动下载」），完成后横幅降级为「已导出」。方案 B（DS-41 定为推荐）：浅底不动、按钮文字 text-2（亮 4.60）；未采纳的方案 A 见 alt-soft-paler-danger",
      editor: { ...readonly("需要编辑权限", "只读 · 需要编辑权限", STATUS.degraded, true), stage: NO_CURSOR, banner: <RejectedBanner title="你的权限已变更为「可评审」" exporting>{REJECTED_TEXT}</RejectedBanner> },
    },
    {
      id: "alt-soft-paler-danger",
      title: "未采纳 · 横幅浅底调淡（方案 A · 危险）",
      note: "未采纳：DS-41 定为推荐（offline-conflict.soft-danger-pending）。DS-41 未采纳的方案 A 的危险浅底：亮色危险浅底由 14% 调到 8%（≈ #FBEEEE），进行中按钮的文字留在 text-3（3.05）；暗色危险浅底不变。与 soft-danger-pending（方案 B，现行）同一条横幅并排看亮色两张。若采用，亮色下降权、文档已删除、更改过大、隔离态、换账号，以及第 1 批 main-states.degraded 横幅都会变淡；横幅以外，第 1 批 image-editing.upload-failed 的上传失败占位与 chart.data-panel 数据表的无效单元格（亮色）也随之变淡",
      editor: {
        ...readonly("需要编辑权限", "只读 · 需要编辑权限", STATUS.degraded, true),
        stage: NO_CURSOR,
        banner: (
          <BannerStack className={PALER_SOFT}>
            <RejectedBanner title="你的权限已变更为「可评审」" exporting>
              {REJECTED_TEXT}
            </RejectedBanner>
          </BannerStack>
        ),
      },
    },
    {
      id: "alt-offline-neutral",
      title: "未采纳 · 离线横幅用中性底",
      note: "未采纳：DS-41 定为推荐（offline-conflict.offline-no-network）。DS-41 未采纳的选项：离线横幅也改中性底加状态色图标（缺少插件、插件启动失败横幅按 DS-41 已是中性底）；会改第 1 批离线横幅（单页与网格）。这里与 offline-no-network 相同，只把离线横幅换成中性底（kit Banner info）加警告色离线图标，文案、按钮与同步状态行不变（中性底上不可用按钮的文字按 kit 规则是 text-3）",
      editor: { ...OFFLINE, banner: <OfflineBanner noNetwork neutral /> },
    },
    {
      id: "alt-offline-copy",
      title: "未采纳 · 离线横幅写明刷新会丢失",
      note: "未采纳：DS-59 定为推荐（offline-conflict.offline-no-network）。DS-59 未采纳的备选：对第 1 批已拍板文案的建议（不改其样张）：M2–M3 的待同步队列只在本页内存里（PRD CO-06），「更改已保存在本地」容易被理解为刷新、关闭也不丢；备选文案「更改暂存在本页，重新连接后自动同步；关闭或刷新本页会丢失这些更改」（DS-59：这类文案在 M4 启用本地持久化前再定）。M4 启用 collab-offline-idb 后再改回「已保存在本地」一类（05 §7）",
      editor: { ...OFFLINE, banner: <OfflineBanner copy="refresh" /> },
    },

    /* ---------------------------------------------------------------- 服务器保存（rulings §4.19 INC-09：按受众分级） */
    {
      id: "server-unsaved",
      title: "未保存到服务器 · 发起方横幅",
      note: "03-12「服务器保存延迟」：本端有未获 db 确认的更改（room.persist = degraded ∨ 仅获 spill 确认 ∨ 最老在途 ≥ 15 秒）时，发起方出警告横幅「未保存到服务器 3 项」（role=status，可关闭）；连接与协作照常（降级期照常广播，会话仍为 synced），头像组与远端光标都在；同步状态行同时显示警告色「未保存到服务器 3 项」",
      editor: { banner: <ServerUnsavedBanner />, rail: { status: STATUS.unsaved }, layers: <LeaveGuard cause="server" /> },
    },
    {
      id: "server-unsaved-closed",
      title: "未保存到服务器 · 横幅已关闭",
      note: "03-12：横幅关闭后同步状态行保留警告指示「未保存到服务器 3 项」，直到全部获 db 确认、room.persist 回到 ok（横幅不再出现，不另弹「已恢复」）；悬停或聚焦这一行看说明（演示：状态一出现就展开）",
      editor: { rail: { status: STATUS.unsavedHint }, layers: <LeaveGuard cause="server" /> },
    },
    {
      id: "server-delay-peer",
      title: "服务器保存延迟 · 其余协作者",
      note: "03-12 / 05 §7：本端没有未确认更改的其余协作者不出横幅，只在同步状态行弱提示「服务器保存延迟」（中性图标），悬停说明「服务器存储暂时不可用，你看到的他人修改可能尚未保存」（演示：一出现就展开）；画布上王小明正在改要点卡，他的修改照常实时可见",
      editor: { rail: { status: STATUS.peerDelay }, stage: NO_CURSOR, slideOverlay: <RemoteSelection person={WANG} at={CARD_POS} /> },
    },

    /* ---------------------------------------------------------------- 离开与刷新的拦截 */
    {
      id: "leave-confirm",
      title: "离开拦截 · 有未同步更改",
      note: "03-12「离开保护」/ 05 §7 / 50/04：离线时从主菜单「返回首页」离开——先 flush（≤ 5 秒），仍有未同步项才弹确认：「离开将丢失 3 项未同步更改」，左下「导出为本地副本」，右侧「留下」（安全项）与危险色「仍要离开」；关闭后焦点回主菜单，之后再选主菜单「返回首页」照样先弹这个确认（离线、登录已过期、隔离态、服务器保存延迟这些有未同步更改的状态都接管「返回首页」，第一句按原因换）。「导出为本地副本」打开的对话框说明的第二句按原因换（rulings §4.25 DS-129、TB-139）：离线写「导出的副本不会自动合并回文档，恢复连接后可以对照重做。」，登录已过期、隔离态、服务器保存延迟写中性句「导出的副本不会自动合并回文档，可以对照重做。」（2026-10-22 改：原来都是降权的「获得编辑权限后…」）。浏览器刷新 / 关闭标签页只能触发浏览器原生提示（文案不可定制，见 deferred）",
      editor: { ...OFFLINE, data: { leaveOpen: true } },
    },

    /* ---------------------------------------------------------------- 鉴权（UX-02：401 直接进「登录已过期」，不经「重连中 → 离线」） */
    {
      id: "auth-expired",
      title: "登录已过期",
      note: "03-12「需要人工操作」/ F5：令牌刷新遇 401 直接进本态；警告横幅、role=alert、处理前不可关闭；「重新登录」在新窗口完成，原页不跳转、待同步队列保留。登录过期期间写命令被拒（50/07 §3.2）：创建工具、新建、检查器字段留在原位不可用，原因「重新登录后可编辑」——检查器标题上方一行说明「暂不可编辑 · 重新登录后恢复」（TB-22：一组项原因相同，用一行说明；钥匙图标同横幅），色块、主题与版式缩略降到半透明；同步状态行「登录已过期 · 3 项待同步」（警告色图标：状态行带着待同步计数、本地更改尚未同步，与离线同一口径，DS-61）；连接已断开，头像组只剩自己；主菜单「返回首页」先弹离开确认。点「重新登录」转到登录窗口打开中",
      editor: { ...paused("重新登录后可编辑", STATUS.authExpired, AUTH_NOTICE), banner: <AuthExpiredBanner />, layers: <LeaveGuard cause="auth" /> },
    },
    {
      id: "auth-expired-pending",
      title: "登录已过期 · 登录窗口已打开",
      note: "03-12 边界「横幅内操作按钮的加载态」：登录窗口打开期间「重新登录」转圈、不可用（同一颗按钮，焦点留在原处；工具提示「登录窗口已打开，完成后自动恢复」；读屏只播一次：常驻 polite 区播报这一句，横幅以 alert 出现时播报过、之后改说明不再作为 live 区（不以 assertive 整条重读），按钮名不加后缀；警告浅底上的文字是 text-2，DS-41 方案 B），说明改为「请在新窗口中完成登录…」；窗口关闭而未完成时恢复可点；同一用户登录回来后按「重连中 → 同步中 → 已恢复」回到协同",
      editor: { ...paused("重新登录后可编辑", STATUS.authExpired, AUTH_NOTICE), banner: <AuthExpiredBanner phase="pending" />, layers: <LeaveGuard cause="auth" /> },
    },
    {
      id: "auth-expired-popup-blocked",
      title: "登录已过期 · 弹窗被拦截",
      note: "03-12：登录弹窗被浏览器拦截时退化为「在新标签页中登录」（打开新标签页，外链图标）；登录回调页经 BroadcastChannel 通知原页，原页重新获得焦点时也会探测一次 /auth/me，两路任一到达即可",
      editor: { ...paused("重新登录后可编辑", STATUS.authExpired, AUTH_NOTICE), banner: <AuthExpiredBanner phase="blocked" />, layers: <LeaveGuard cause="auth" /> },
    },
    {
      id: "identity-changed",
      title: "重新登录的账号不同 · 按只读处理",
      note: "03-12 / UX-02：登录回来的账号（周明远）与原会话（陈静）不同时不重放队列：转为权限降级横幅（危险色、锁形、导出前不可关闭），3 项更改移入「未同步更改」区可导出，防止以他人身份提交；横幅处理前按只读展示（DS-15），同步状态行「只读 · 登录账号已变更」；导出对话框与「已导出本地副本」保留「获得编辑权限后…」的原句（rulings §4.25 DS-129：换账号与降权同一句）",
      editor: {
        ...readonly("登录账号已变更", "只读 · 登录账号已变更", STATUS.identity),
        banner: <RejectedBanner title="登录账号已变更">3 项更改来自原账号陈静，不会以你的身份提交；文档已重新载入服务端版本，撤销历史已清空</RejectedBanner>,
        layers: <ExportLayer />,
      },
    },

    /* ---------------------------------------------------------------- 权限（第 1 批已有：degraded、degraded-menu、degraded-thumb-menu） */
    {
      id: "degraded-export",
      title: "降权 · 导出本地副本",
      note: "03-12 readonly-degraded / 05 §8 / 50/07 §8.2：点降权横幅的「导出为本地副本」打开对话框——列出未被保存的 3 项（被拒事务的摘要：命令名 + 所在页，点某项切到该页对照），选格式：演示文稿副本 .pptx（缺省）或更改摘要 .json（供人工比对）；「导出」后横幅降级为可关闭的「已导出」。横幅追加行「文档已重新载入服务端版本，撤销历史已清空」（G-51、DS-58）。第 1 批 main-states.degraded 的降权横幅正文已按 DS-58 换成同一句（旧「3 项更改未被保存；导出后可另行申请编辑权限再重新应用」，原后半句的意思移到这个对话框与「已导出本地副本」提示里）",
      editor: { ...DEGRADED, stage: NO_CURSOR, data: { exportOpen: true } },
    },
    {
      id: "degraded-exported",
      title: "降权 · 已导出",
      note: "03-12 / 05 §8 第 2 步：导出完成后横幅从「需要操作」降级为可关闭的中性提示「已导出本地副本 · 可另行申请编辑权限后重新应用」；系统不承诺把副本自动合并回文档；其余只读外观不变",
      editor: { ...DEGRADED, data: { exported: true } },
    },
    {
      id: "degraded-no-changes",
      title: "降权 · 没有未同步的更改",
      note: "50/07 §8.1：降权时本端没有未获确认的更改，就没有要导出的东西，不出横幅；同步状态行「只读 · 权限已变更」、检查器顶部说明与不可用的工具照常。另给一条轻提示「你的权限已变更为「可评审」」写明新角色（与被提权的「你现在可以编辑此文档」对称；DS-58：降权但本端没有未同步更改时不出横幅、只给轻提示）",
      editor: {
        ...readonly("需要编辑权限", "只读 · 需要编辑权限", STATUS.degraded, true),
        canvasOverlay: (
          <Toasts>
            <Toast icon={<Lock {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />} onClose={noop}>
              你的权限已变更为<span className="whitespace-nowrap">「可评审」</span>
            </Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "promoted",
      title: "被提权",
      note: "03-12 G-56 / 05 §8：被提升为编辑者即时生效，轻提示「你现在可以编辑此文档」；工具条、检查器与画布立即解锁，无需刷新；已进入「未同步更改」区的内容不自动重放",
      editor: {
        canvasOverlay: (
          <Toasts>
            <Toast tone="success" onClose={noop}>
              你现在可以编辑此文档
            </Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "seats-full",
      title: "编辑者名额已满 · 以只读身份加入",
      note: "03-12 readonly-degraded 之二 / 50/07 §8.1：以只读身份加入，画布写入与评论创建都收回（「评论」同样不可用），只保留浏览、阅读评论与跟随；横幅可关闭，关闭后同步状态行仍保留「只读 · 名额已满」（与查看者的「仅查看」分开称呼，UX-19）；上限读部署配置（缺省 20）；「重试以编辑身份加入」重新判定名额；头像组 5 人 +「+16」",
      editor: {
        ...readonly("编辑者名额已满", "只读 · 编辑者名额已满", STATUS.seatsFull),
        slide: 2,
        banner: <SeatsFullBanner />,
        inspector: { readOnly: true, notice: lockNotice("只读 · 编辑者名额已满"), collaborators: { people: ONLINE_SHOWN, extra: 16 } },
      },
    },

    /* ---------------------------------------------------------------- 阻断与文档状态 */
    {
      id: "access-revoked",
      title: "访问权限已变更 · 阻断页",
      note: "03-12「访问权限已变更」/ PRD CO-05 / 50/07 §8.1：会话中访问被撤销（降为无任何角色、4403）——Unit 关闭、内存中的文档与待同步更改一并清空，画布不能再留着文档内容，所以整个工作区换成与「打开失败 · 没有访问权限」同一布局的阻断页；「申请访问」（主操作，点开留言弹层：可选留言 ≤ 200 字 + 发送，与 share.request-access 同一个件，G-56）·「返回文档列表」；不提供导出本地副本",
      editor: blockingPage(() => <RevokedPage />),
    },
    {
      id: "access-requested",
      title: "访问权限已变更 · 已发送申请",
      note: "03-12「已发送申请，等待批准」/ G-56：在留言弹层里「发送」后，页上换成成功色对勾 +「已发送申请，等待文档所有者批准」（常驻、polite 播报一次；焦点留在「申请访问」上）；不再另出轻提示（同一件事不说两遍，样张第 2 轮评审意见）；「申请访问」留在原位不可用（24 小时内不能重复申请，工具提示写原因），「返回文档列表」照常。弹层与发送后的样子与打开时就没有权限的 share.request-access / -sent 同一个件；所有者端的待处理列表在分享对话框（share.access-requests）",
      editor: { ...blockingPage(() => <RevokedPage />), data: { request: { sent: true } } },
    },
    {
      id: "alt-access-revoked-banner",
      title: "未采纳 · 访问权限已变更用横幅",
      note: "未采纳：DS-50 定为推荐（offline-conflict.access-revoked）。DS-50 未采纳的备选，03-12 线框的字面读法：危险色阻断横幅「申请访问 / 返回文档列表」留在编辑器上，整栏不可用（放映、分享、页签、工具条都不可用）。问题：画布与缩略图上的文档内容仍然看得见，与 50/07 §8.1「撤销后不再向该用户下发或留存文档内容」冲突；关掉「已发送申请」这条可关闭提示后还会剩下一个不能用的编辑器",
      editor: {
        banner: <RevokedBanner />,
        rail: { status: STATUS.revoked, newSlide: { reason: "访问权限已变更" }, viewToggle: { reason: "访问权限已变更" }, readonlyDegraded: "访问权限已变更" },
        inspector: { locked: "访问权限已变更", collaborators: { people: [ME] } },
        toolbar: { disabled: lockTools("访问权限已变更") },
        stage: NO_CURSOR,
      },
    },
    {
      id: "viewers-full",
      title: "查看人数已满 · 阻断页",
      note: "03-12 G-55「房间查看者也已满」（collab.room_full / 4503）：打开时握手被拒，阻断页「文档当前查看人数已达上限」，只有「返回文档列表」；后台继续按退避重试，有名额空出时自动打开（50/07 §9）；评审者计入查看者名额",
      editor: blockingPage(() => <ViewersFullPage />),
    },
    {
      id: "quarantine",
      title: "隔离态 · 协同已暂停",
      note: "03-12 G-51：同一会话 10 分钟内 ≥ 5 次修复触发（关闭码 4409）——阻断式横幅、role=alert、始终不可关闭，只能刷新退出；写命令被拒（50/07 §3.2），工具与字段留在原位不可用，原因「协同已暂停，刷新后可编辑」——检查器标题上方一行说明「暂不可编辑 · 协同已暂停，刷新后恢复」（TB-22，暂停图标同横幅），色块、主题与版式缩略降到半透明；同步状态行「协同已暂停 · 3 项未同步」（警告色图标，同离线，DS-61）；待同步更改保留在内存里供导出，所以「刷新」先走确认，主菜单「返回首页」也先弹离开确认；从确认框导出时对话框说明的第二句用中性句「导出的副本不会自动合并回文档，可以对照重做。」（协同已暂停不是失去编辑权限，rulings §4.25 TB-139；2026-10-22 改：原为降权的「获得编辑权限后…」）",
      editor: { ...paused("协同已暂停，刷新后可编辑", STATUS.paused, PAUSED_NOTICE), banner: <QuarantineBanner />, layers: (
        <>
          <RefreshConfirmLayer />
          <LeaveGuard cause="paused" withExport={false} />
          <ExportLayer returnFocus="offline-conflict.refresh" redo={EXPORT_COPY.neutral.redo} />
        </>
      ) },
    },
    {
      id: "refresh-confirm",
      title: "刷新拦截 · 隔离态里点「刷新」",
      note: "03-12「刷新将丢失未同步更改」/ 50/02 §12：应用内触发的刷新（隔离态「刷新」、插件设置「重新加载」、发现新版本「刷新」）先 flush，仍有未同步项才弹确认：「刷新将丢失 3 项未同步更改」，左下「导出为本地副本」，右侧「取消」与危险色「仍要刷新」；关闭后焦点回横幅的「刷新」。导出对话框说明的第二句用中性句「导出的副本不会自动合并回文档，可以对照重做。」（rulings §4.25 TB-139；2026-10-22 改：原为降权的「获得编辑权限后…」）",
      editor: { ...paused("协同已暂停，刷新后可编辑", STATUS.paused, PAUSED_NOTICE), banner: <QuarantineBanner />, data: { refreshOpen: true }, layers: (
        <>
          <RefreshConfirmLayer />
          <LeaveGuard cause="paused" withExport={false} />
          <ExportLayer returnFocus="offline-conflict.refresh" redo={EXPORT_COPY.neutral.redo} />
        </>
      ) },
    },
    {
      id: "doc-deleted",
      title: "文档已被删除 · 可导出本地副本",
      note: "PRD CO-06「若文档已被删除，提示并允许导出本地副本」/ 50/07 §9（4404）：会话结束、停止重连，3 项更改移入「未同步更改」区；危险色横幅「导出为本地副本」「返回文档列表」，导出前不可关闭（文档已不存在，关掉横幅只剩一个不能保存的编辑器）；编辑器只读展示，同步状态行「文档已被删除」。导出对话框说明的第二句与导出后「已导出本地副本」的正文按原因写（rulings §4.25 DS-129）：「导出的副本不会自动合并回文档，可以另存为新文档。」/「系统不会把副本自动合并回文档，可以另存为新文档」（2026-10-22 改：原为降权的「获得编辑权限后…」「可另行申请编辑权限后重新应用」）",
      editor: {
        ...readonly("文档已被删除", "只读 · 文档已被删除", STATUS.deleted),
        banner: <DocDeletedBanner />,
        // 文档已不存在：「分享」同样不可用（inspector.share），放映照常
        inspector: { readOnly: true, notice: lockNotice("只读 · 文档已被删除"), collaborators: { people: [ME] }, share: { reason: "文档已被删除" } },
        stage: NO_CURSOR,
        layers: <ExportLayer redo={EXPORT_COPY.deleted.redo} />,
      },
    },
    {
      id: "too-large",
      title: "有更改过大无法同步",
      note: "PRD CO-06：离线累计的更改重连时超过 16 MiB（4413）——不自动重试，按「导出后重载」处理（与降权同一导出路径）：危险色横幅「有更改过大无法同步」+ 追加行 +「导出为本地副本」，导出前不可关闭；文档已重新载入服务端版本，可以继续编辑。导出对话框说明的第二句与导出后「已导出本地副本」的正文按原因写（rulings §4.25 DS-129）：「导出的副本不会自动合并回文档，可以对照重做。」/「系统不会把副本自动合并回文档，可以对照重做」（2026-10-22 改：原为降权的「获得编辑权限后…」「可另行申请编辑权限后重新应用」）",
      editor: { slide: 3, banner: <TooLargeBanner />, layers: <ExportLayer redo={EXPORT_COPY["too-large"].redo} /> },
    },

    /* ---------------------------------------------------------------- 横幅优先级与叠放 */
    {
      id: "priority-yield",
      title: "优先级 · 离线与缺少插件同时成立",
      note: "03-12 / 03-02 §6.2：同一时刻最多一条，按「连接 > 权限 / 文档状态 > 服务器保存 > 其他」取最高者——离线（连接）在场时缺少插件（其他）的横幅让位，等离线横幅消失再出现（让位期间不算已展示，本会话仍出现一次）；画布占位与左栏第 6 页警示计数照常。服务器保存同理：重连中、离线时由连接横幅承载「N 项待同步」，不叠加「未保存到服务器」",
      editor: {
        ...OFFLINE,
        deck: qrDeck("插件已停用"),
        slide: 6,
        rail: {
          status: STATUS.offline,
          list: (ctx) => (
            <RailList>
              {ctx.deck.map((s) => (
                <RailThumb key={s.n} slide={s} current={s.n === ctx.slide} onPick={ctx.goTo} warn={s.n === 6 ? 3 : 0} />
              ))}
            </RailList>
          ),
        },
      },
    },
    {
      id: "master-offline",
      title: "母版视图 · 两条横幅（离线）",
      note: "rulings §4.25 TB-14：母版视图中上下文条常驻在上、不参与让位（承载唯一的常驻退出入口「关闭母版视图」）；离线等其余横幅按同一优先级在它下方另占一条，最多两条。两条的总高度写进 --v3-banner-h（kit BannerStack），幻灯片与普通视图的缺省几何同大、只下移两条横幅的高度；退出后普通视图带着离线横幅、按普通视图的规则居中；左栏同步状态行「离线 · 3 项待同步」",
      editor: {
        ...MASTER,
        // 第二条横幅（宿主叠在母版横幅下面）
        banner: <OfflineBanner />,
        rail: { status: STATUS.offline },
        inspector: ALONE,
        layers: <LeaveGuard cause="offline" />,
      },
    },
    {
      id: "master-degraded",
      title: "母版视图 · 两条横幅（降权）",
      note: "50/10 §11 规则 1 / 03-26 §6.3、§6.5：会话内被降权时第二条就是 03-12 的降权横幅（原因与「导出为本地副本」在那一条），上下文条只换锁形图标与说明「只能查看母版与版式」；母版视图不强制退出，检查器只读展示。第二条降权横幅的正文是 03-12 G-51 的新写法（DS-58），第 1 批 main-states.degraded 已随之换成同一句",
      editor: {
        ...MASTER,
        data: MASTER_DATA,
        // 第二条横幅（宿主叠在母版横幅下面）
        banner: <RejectedBanner title="你的权限已变更为「可评审」">{REJECTED_TEXT}</RejectedBanner>,
        // 会话内被降权是会话级事实（宿主的 readonlyDegraded，原 data.mvReadOnly）：母版视图里只读，退出后普通视图同样是降权态，再按 ⌥⌘M 只提示原因
        rail: { status: STATUS.degraded, readonlyDegraded: "需要编辑权限" },
        layers: <ExportLayer />,
      },
    },
    {
      id: "narrow-offline",
      title: "仅查看形态 · 横幅换行（390 宽）",
      note: "03-12 边界「极窄屏」：仅查看形态（< 640，视口 390 × 844）里文案放不下一行，按钮换到文案下方独占一行、触控高 44（kit Banner 的 stack 画法，按钮一行左右各留 16、对称）；顶部条的状态行换成与左栏同一个同步状态「离线 · 3 项待同步」（警告色图标），不再写「仅查看」，与上面的离线横幅说法一致；横幅在最顶上、仅查看形态的顶部条排在它下面（与紧凑形态「两个胶囊排在横幅下面」同一规则，03-02 §6.2；放在顶部条下面是 DS-60 未采纳的备选）。顶部条状态行按 DS-60：离线等同步异常时换成同步状态（警告色图标，改 03-02 §5a.2），在线时仍是「仅查看 · 在更大窗口中编辑」，第 1 批 narrow.narrow（在线）画面不变",
      editor: {
        ...NARROW,
        // NARROW.data：评论面板与评论钉的线程数据（narrow 场景级 data.dataset，DS-46），打开「评论」时与第 1 批仅查看形态一致
        data: { ...NARROW.data, form: "narrow", viewerStatus: STATUS.offline },
        toolbar: { hidden: true, collapse: true },
        regions: { ...NARROW.regions, stage: narrowStage },
        banner: <NarrowOfflineBanner />,
      },
    },

    /* ---------------------------------------------------------------- 软冲突（PRD CO-08 / F4 / 05 §5：一律不用横幅） */
    {
      id: "conflict-same-text",
      title: "软冲突 B · 同一文本框同一位置",
      note: "F4 B / CO-10：两人的插入点落在同一处时，文本框上沿外侧出现中性提示签「● 王小明也在编辑此文本框」（色点是对方身份色）+ 对方的插入符（预防性、presence 的延伸，不是锁）；不阻止输入，两段插入相邻并存、顺序确定；断线即消失",
      // 两人同在编辑的是第 1 页的标题：来自版式「标题幻灯片」的标题占位符，检查器顶行照常写「转到版式」（rulings §4.25 DS-174；版式名、类型与索引由 placeholderOrigin 按版式算）
      editor: { slide: 1, selection: "text", stage: NO_CURSOR, data: { placeholder: placeholderOrigin(slideOf(DEFAULT_DECK, 1), "title") }, slideOverlay: <SameTextHint /> },
    },
    {
      id: "conflict-moved",
      title: "软冲突 C · 同一形状被并发移动",
      note: "F4 C / 05 §5：属性级后写者胜，我拖动的要点卡「跳」到王小明放的位置——轻提示「王小明移动了该形状」（左侧对方头像）+「恢复我的值」（新事务，把位置写回我的值、覆盖对方后写，可再撤销；原「撤销」作废）+ ×；远端选区框标出对方",
      editor: {
        selection: "shape",
        stage: NO_CURSOR,
        slideOverlay: (
          <>
            <RemoteSelection person={WANG} at={CARD_POS} />
            <PresenceCursor person={WANG} at="left-[84%] top-[80%]" label={false} />
          </>
        ),
        canvasOverlay: (
          <Toasts>
            <Toast icon={WANG_AVATAR} action="恢复我的值" onClose={noop}>
              <b className="font-semibold">{WANG.name}</b>移动了该形状
            </Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "conflict-deleted",
      title: "软冲突 D · 正在编辑的元素被删除（P1）",
      note: "F4 D：删除胜，要点卡成为墓碑、从画布与缩略图上消失，我的编辑落在墓碑上一并隐藏；轻提示「你编辑的元素已被王小明删除」+「恢复元素（含我的编辑）」（清除墓碑、以原 id 恢复，评论锚点等引用一并复原）；墓碑超过 TTL（缺省 24 小时）后入口失效",
      editor: {
        deck: DECK_CARD_DELETED,
        stage: NO_CURSOR,
        slideOverlay: <PresenceCursor person={WANG} at="left-[80%] top-[52%]" />,
        canvasOverlay: (
          <Toasts>
            <Toast icon={WANG_AVATAR} action="恢复元素（含我的编辑）" onClose={noop}>
              你编辑的元素已被<b className="font-semibold">{WANG.name}</b>删除
            </Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "conflict-page-deleted",
      title: "软冲突 E · 正在添加内容的页被删除（P1）",
      note: "F4 E：我在第 6 页加文本框时王小明删除了这一页——删除胜，第 6 页从左栏消失、画布落到第 5 页；轻提示「你正在编辑的第 6 页已被王小明删除」+「恢复页」（原 id、原位置恢复，我新增的元素随页复原）",
      editor: {
        deck: DECK_PAGE_DELETED,
        slide: 5,
        stage: NO_CURSOR,
        canvasOverlay: (
          <Toasts>
            <Toast icon={WANG_AVATAR} action="恢复页" onClose={noop}>
              你正在编辑的第 6 页已被<b className="font-semibold">{WANG.name}</b>删除
            </Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "conflict-layout",
      title: "软冲突 I · 并发更换同一页版式",
      note: "F4 I / 05 §5：后写者胜，不弹轻提示，提示写在受影响的属性区域本身——检查器「版式」字段外圈换成王小明的身份色，节末写「王小明同时把这一页改成了「仅标题」，你选的「标题和内容」没有生效」+「恢复我的值」（新事务）；与第 1 批 remote-overwrite 同一画法",
      editor: {
        slide: 3,
        stage: NO_CURSOR,
        slideOverlay: <PresenceCursor person={WANG} at="left-[56%] top-[18%]" />,
        inspector: { sections: [LAYOUT_REMOTE, "slide.theme", "slide.background", "slide.playback"] },
      },
    },

    /* ---------------------------------------------------------------- 配额与软门禁（03-12 G-51 / G-55：不用横幅） */
    {
      id: "quota-soft",
      title: "配额 · 元素数量接近上限",
      note: "03-12 G-55（原「状态栏弱提示」，DS-6 后走轻提示，50/10 §11）：文档总元素跨过 15,000 时出现一次「元素数量已接近上限（15,000 / 20,000）」，第二行说明「最近 24 小时内删除的元素仍计入，到期后自动释放」；非横幅、非阻断；数字读部署配置",
      editor: {
        slide: 5,
        canvasOverlay: (
          <Toasts>
            <Toast icon={<Layers {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />} description="最近 24 小时内删除的元素仍计入，到期后自动释放" onClose={noop}>
              元素数量已接近上限（15,000 / 20,000）
            </Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "quota-hard",
      title: "配额 · 达到元素上限被拒",
      note: "03-12 G-55：新增元素 / 粘贴 / 插入页触及每份文档 20,000 个元素的硬上限——命令被拒、不产生新对象，警告色轻提示「已达每份文档 20,000 个元素的上限」（document.quota_exceeded，409，连接保持）；墓碑 TTL 内的已删除元素计入总数",
      editor: {
        slide: 5,
        canvasOverlay: (
          <Toasts>
            <Toast tone="warning" description="删除不需要的内容后再试；最近 24 小时内删除的元素仍计入" onClose={noop}>
              已达每份文档 20,000 个元素的上限
            </Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "repair-toast",
      title: "软门禁 · 已自动修正结构问题",
      note: "03-12 G-51：软门禁修复（未越权，只修结构不变量，如父子环）用轻提示「已自动修正 1 处结构问题」+「查看」（定位到受影响元素）；不占横幅通道，撤销栈不清空",
      editor: {
        canvasOverlay: (
          <Toasts>
            <Toast tone="success" action="查看" onClose={noop}>
              已自动修正 1 处结构问题
            </Toast>
          </Toasts>
        ),
      },
    },
  ],
})
