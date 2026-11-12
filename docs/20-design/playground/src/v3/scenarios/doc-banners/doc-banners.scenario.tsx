import { editItems } from "../../kit"
import narrow from "../narrow/narrow.scenario"
import { ExportLayer } from "../offline-conflict/dialogs"
import { paused, readonly } from "../offline-conflict/offline-conflict.scenario"
import { defineScenario, type EditorConfig } from "../types"
import { RESTORED_DECK } from "../version-history/slides"
import {
  EpochAutoHideBanner, EpochBanner, EpochPendingBanner, OverCeilingBanner, OverCeilingWarningBanner, VersionDriftBanner, VersionDriftNeutralBanner,
} from "./banners"
import { DriftGuards, REDO_NOTE } from "./dialogs"
import { CEILING_NOTICE, CEILING_REASON, CHUNK_DECK, DRIFT_NOTICE, DRIFT_REASON, STATUS } from "./editor"

/**
 * doc-banners：03-12 §8.6 样张未画的三条文档状态横幅（rulings §4.25 TB-80、TB-66；README D15 ⑨），第 3 批 rulings §4.25 DS-126 / DS-127 / DS-128（都按推荐采纳）。
 * 三条都归横幅通道「权限 / 文档状态」档（03-12 §2.2）；高 40 含 1px 底边（DS-75，kit Banner）。出现条件、文案与档位以 03-12 §8.6、50/07 §8.1、§9、50/02 §12 为准，
 * 本场景定底色、图标与能否关闭（采纳的画法 = 正式状态，未采纳的备选 = alt-*，DS-63），并补写入受阻时的编辑器形态（沿用第 2 批 offline-conflict 的「登录已过期 / 协同已暂停」与「编辑者名额已满」两种画法，DS-58、DS-15）。
 * 摸底列为可选、这里没有单独画的：「发现新版本」与「插件设置已更新」同时成立（只出 version-drift 这一条，画面相同，note 里写明）。
 * 同目录：banners（横幅）· dialogs（刷新 / 离开确认与导出）· editor（编辑器形态、同步状态行、代码块漂移的第 4 页）。
 */

/** 换纪元后撤销栈与 UndoSkip 记录清空（50/07 §9 的 4428）：主菜单「编辑 › 撤销 / 重做」留在原位不可用（「没有可撤销的操作」） */
const UNDO_CLEARED: EditorConfig["rail"] = { menu: { edit: editItems({ undo: null, redo: null }) } }

/** 发现新版本、会话已关闭（4426 / 4427），本端 3 项更改没提交：暂时不能编辑 + 横幅 + 刷新 / 离开确认 */
const DRIFT_CLOSED: EditorConfig = {
  ...paused(DRIFT_REASON, STATUS.drift, DRIFT_NOTICE),
  banner: <VersionDriftBanner source="closed" />,
  layers: <DriftGuards />,
}

/**
 * 文档已达元素上限、以只读加入（auth.ok.reason = over_ceiling）：只读展示，在场信息照常（只读会话仍上报 view，他人照常可见）。
 * offline-conflict 的 readonly() 停在那个场景的第 3 页，这里照旧停在编辑器缺省的第 2 页（去掉 slide）
 */
const { slide: _ocSlide, ...CEILING }: EditorConfig = readonly(CEILING_REASON, CEILING_NOTICE, STATUS.ceiling)

/** 仅查看形态（narrow 场景的场景级配置）：查看器排在横幅下方的一层里，同 offline-conflict.narrow-offline */
const NARROW: EditorConfig = narrow.editor ?? {}
const narrowStage: NonNullable<EditorConfig["regions"]>["stage"] = (ctx, d) => (
  <div className="relative flex min-h-0 flex-1 flex-col">{NARROW.regions?.stage ? NARROW.regions.stage(ctx, d) : d.stage()}</div>
)

export default defineScenario({
  id: "doc-banners",
  title: "文档状态横幅",
  specs: ["03-12"],
  batch: 3,
  summary: "发现新版本（会话已关闭 / 代码块漂移）、换纪元（文档已替换为导入的文件 / 已由管理员重建，有无未提交更改）、文档已达元素上限只读打开；横幅底色、图标与能否关闭（含未采纳的备选）",
  // 画布照常画示例文档的评论钉（底座 stage.commentPins：第 4 页 3 枚）——DS-43「编辑模式照常显示评论钉」，同第 2 批各场景
  editor: { stage: { commentPins: true } },
  states: [
    /* ---------------------------------------------------------------- 发现新版本（DS-126） */
    {
      id: "version-drift",
      title: "发现新版本 · 会话已关闭",
      note: "rulings §4.25 DS-126。03-12 §8.6 / 50/02 §12 ② / 50/07 §9：协同以 4426（内容级插件集已随重新部署变化 collab.plugins_outdated，或 schema 过新）/ 4427（协议不兼容）关闭——会话进入 closed、不重连，刷新前不接受新写入。横幅「发现新版本，刷新后继续」：警告浅底 + 刷新图标（警告色）、不可关闭、唯一按钮「刷新」，读屏 alert（同「登录已过期」：不处理就不能继续编辑；未采纳的中性底见 alt-new-version-neutral）。编辑器按第 2 批「登录已过期 / 协同已暂停」的口径转为暂时不能编辑（DS-58，03-12 §8.5）：创建工具、左栏新建与检查器字段留在原位不可用，原因「刷新后可编辑」，检查器标题上方一行「暂不可编辑 · 发现新版本，刷新后恢复」（TB-22，刷新图标同横幅），色块与缩略降到半透明；会话已断开，头像组只剩自己、画布上没有远端光标；同步状态行「需要刷新 · 3 项未同步」（警告色图标：3 项更改没送到服务器，风险同离线，DS-61；没有未同步项时只写「需要刷新」、中性图标）。点「刷新」：本端还有未同步更改，会话已关闭没法先同步，先弹「刷新将丢失 3 项未同步更改」（version-drift-refresh）；没有就直接刷新。主菜单「返回首页」同样先弹离开确认（03-12 §9）。与「插件设置已更新」同时成立（policy 与 catalog 都变了）时只出这一条，文案与动作以本条为准（PRD 07 G-87、TB-66）——画面与本态相同，不另画",
      editor: DRIFT_CLOSED,
    },
    {
      id: "version-drift-refresh",
      title: "发现新版本 · 点「刷新」时有未同步更改",
      note: "03-12 §9 / DS-59：会话已关闭，3 项更改没提交到服务器——应用内确认框（sm 360，同 offline-conflict.refresh-confirm 的画法）：「刷新将丢失 3 项未同步更改」，第一句按原因写「发现新版本，这些更改还没有提交到服务器。」，第二句「可以先导出本地副本，再刷新页面。」；左下「导出为本地副本」（03-12 §7.2 的同一个对话框；说明第二句按原因写「导出的副本不会自动合并回文档，可以对照重做。」——发现新版本时用户没有失去编辑权限，不写降权的「获得编辑权限后…」，rulings §4.25 DS-129），右侧「取消」（安全项，用户打开时初始焦点在它上面）与危险色「仍要刷新」；关闭后焦点回横幅的「刷新」。确认框就是第 2 批的 UnsyncedConfirm（原因 drift 的第一句随第 3 批转正并入它的原因表）。离开确认（主菜单「返回首页」）同一画法，标题「离开将丢失 3 项未同步更改」、第二句「可以先导出本地副本，再离开。」、按钮「留下 / 仍要离开」",
      editor: { ...DRIFT_CLOSED, data: { refreshOpen: true } },
    },
    {
      id: "version-drift-chunk",
      title: "发现新版本 · 代码块漂移",
      note: "DS-126（与 version-drift 同一条横幅）。50/02 §12 ① / 03 §4：图表渲染器的惰性代码块加载失败、1 s 后重试一次仍失败——判定版本漂移，会话还在、其余照常编辑（同步状态行「✓ 已同步」、头像组与远端光标都在）；只有惰性元素保持占位：第 4 页柱形图「月度营收」换成底座降级占位（虚线框 + 图表图标 + 名称 + 「刷新后显示，内容已保留」，与保真、缺插件占位同一画法，DS-52），评论仍锚在原处。横幅与会话已关闭时相同（警告浅底、不可关闭、只有「刷新」）。点「刷新」先同步（Session.flush，最长 10 s）：按钮换成转圈「正在保存更改…」、不可用（与 plugins.reload-saving 同一画法），同步完成即刷新；仍有未同步项时弹 version-drift-refresh 的确认框",
      // 远端光标「李雷」让到占位右下的空白处（缺省落点在两组柱子之间，正压在占位的名称上）
      editor: { deck: CHUNK_DECK, slide: 4, stage: { cursor: { at: "left-[80%] top-[70%]" } }, banner: <VersionDriftBanner source="chunk" /> },
    },
    {
      id: "alt-new-version-neutral",
      title: "未采纳 · 发现新版本用中性底",
      note: "未采纳（DS-126 定为警告浅底 + 刷新图标、不可关闭，见 version-drift）：中性底 + 刷新图标（次级文字色）、读屏 status——底色与图标同「插件设置已更新」（main-states.plugin-settings），但不可关闭、只有「刷新」（插件设置横幅有「重新加载」与 ×「稍后再说」，可以关），更平静；但会话已关闭、写入已受阻时，横幅看不出要紧，检查器与工具条都不可用却只有一条中性提示。其余（暂时不能编辑的编辑器、同步状态行、刷新确认）同 version-drift",
      editor: { ...DRIFT_CLOSED, banner: <VersionDriftNeutralBanner /> },
    },

    /* ---------------------------------------------------------------- 换纪元（DS-127） */
    {
      id: "epoch-replaced",
      title: "文档已替换为导入的文件",
      note: "rulings §4.25 DS-127。03-12 §8.6 / 50/07 §9 的 4428（collab.epoch_changed）：覆盖既有文档的导入提交后服务端换纪元——本会话此前收到过导入锁定（room.locked.reason = import，同步状态行那时写「文档正忙」），所以标题写「文档已替换为导入的文件」；编辑器丢弃本地 Y 状态、重开 Unit 并重新载入（画布与左栏已是导入的内容：样张用另一份 5 页的演示文稿表示新内容），撤销栈与 UndoSkip 记录清空（主菜单「编辑 › 撤销 / 重做」留在原位不可用「没有可撤销的操作」），评论锚点重算。没有未提交的更改：中性底 + 信息图标（次级文字色）、正文「文档已重新载入，撤销历史已清空」（DS-127：写明撤销没了，与降权、「有更改过大」横幅的「撤销历史已清空」同一说法，DS-58）、可关闭（×「关闭提示」）、不自动消失（50/07 §9 暂行写法「3 s 后自动消失」作废，未采纳的自动滑出见 alt-epoch-autohide），读屏 status：没有数据风险，不铺浅底（03-12 §2.4）；内容整份换了、撤销没了，要让用户确实看到（正文写的就是这件事），不像「已恢复」那样一闪而过。同步状态行回到「✓ 已同步」，可以继续编辑",
      editor: { deck: RESTORED_DECK, rail: UNDO_CLEARED, banner: <EpochBanner kind="replaced" /> },
    },
    {
      id: "epoch-rebuilt",
      title: "文档已由管理员重建",
      note: "DS-127（同 epoch-replaced，只换标题）。4428 而本会话没有收到过导入锁定（运维换纪元，如 schema 迁移后重建）：标题「文档已由管理员重建」，正文同「文档已重新载入，撤销历史已清空」；内容通常不变（样张即示例文档原样），撤销栈同样清空（主菜单「编辑 › 撤销」不可用）",
      editor: { rail: UNDO_CLEARED, banner: <EpochBanner kind="rebuilt" /> },
    },
    {
      id: "epoch-pending",
      title: "换纪元 · 有未提交的更改",
      note: "rulings §4.25 DS-127。50/07 §8.2 / §9：4428 到达时本端还有 3 项未获服务端确认的更改——按 epoch-changed 移入被拒集合（未同步更改区），本地 Y 状态丢弃、重新载入新纪元。横幅与「有更改过大无法同步」同一画法（03-12 §2.4 表、§8.4；offline-conflict.too-large）：危险浅底 + 圆圈感叹号（危险色）、读屏 alert、导出前不可关闭；正文追加「3 项更改未提交」——「文档已重新载入，撤销历史已清空；3 项更改未提交」，右侧「导出为本地副本」打开 03-12 §7.2 的对话框（列出未保存的 3 项、选 .pptx / .json；说明第二句按原因写「导出的副本不会自动合并回文档，可以对照重做。」——换纪元时用户没有失去编辑权限），导出后降级为可关闭的「已导出本地副本」（epoch-exported）。图标没有先例（降权用锁、更改过大用圆圈感叹号），取与更改过大同一个：都是「有更改没保存进文档、文档本身可以继续编辑」。撤销栈清空、画布是导入的内容，同 epoch-replaced",
      editor: { deck: RESTORED_DECK, rail: UNDO_CLEARED, banner: <EpochPendingBanner kind="replaced" />, layers: <ExportLayer redo={REDO_NOTE} /> },
    },
    {
      id: "epoch-exported",
      title: "换纪元 · 已导出本地副本",
      note: "03-12 §7.3：在导出对话框点了「导出」之后，横幅从「需要操作」降级为可关闭的中性提示「已导出本地副本」（成功色对勾只给图标，同 offline-conflict.degraded-exported 的同一条），文档照常可以编辑。正文按原因换（rulings §4.25 DS-129）：换纪元时用户没有失去编辑权限，不写降权的「可另行申请编辑权限后重新应用」，写「系统不会把副本自动合并回文档，可以对照重做」；导出对话框说明的第二句同理（「导出的副本不会自动合并回文档，可以对照重做。」）。降权与换账号保留原句；更改过大写「可以对照重做」、文档已被删除写「可以另存为新文档」、离线 / 退出登录写「恢复连接后可以对照重做」（DS-129；offline-conflict 的 ExportedBanner、ExportDialog 已能按原因传文案，缺省仍是降权原句）",
      editor: { deck: RESTORED_DECK, rail: UNDO_CLEARED, banner: <EpochPendingBanner kind="replaced" />, layers: <ExportLayer redo={REDO_NOTE} />, data: { exported: true } },
    },
    {
      id: "alt-epoch-autohide",
      title: "未采纳 · 换纪元 3 秒后自动滑出",
      note: "未采纳（DS-127 定为可关闭、不自动消失，见 epoch-replaced）：没有未提交更改时按 50/07 §9 的暂行写法 3 秒后自动滑出（同「已恢复」），不设 ×，读屏 status；正文同 epoch-replaced「文档已重新载入，撤销历史已清空」。样张不在载入时计时，用户第一次点按或按键后才开始数 3 秒（截图停在出现时）。问题：整份内容换了、撤销栈清空这件事只闪 3 秒，用户若正看着别处就错过了，之后撤销不可用也找不到原因",
      editor: { deck: RESTORED_DECK, rail: UNDO_CLEARED, banner: <EpochAutoHideBanner kind="replaced" /> },
    },

    /* ---------------------------------------------------------------- 元素上限只读（DS-128） */
    {
      id: "over-ceiling",
      title: "文档已达元素上限 · 只读打开",
      note: "rulings §4.25 DS-128。03-12 §8.6 / 50/07 §8.1 / 60/05 §4.1：部署调低了元素天花板（scale.maxElementsPerDoc），这份文档的元素数已超过它——打开时以只读加入（auth.ok.reason = over_ceiling，readonlyReason = over_ceiling，与编辑者名额已满的 capacity 分开）。横幅与「编辑者名额已满」同一画法（offline-conflict.seats-full，DS-58）：中性底 + 锁形（次级文字色）、可关闭（×「关闭提示」）、读屏 status；不提供「重试以编辑身份加入」（元素数降到天花板以下之前结果不变），所以没有按钮。标题「文档已达元素上限，只读打开」，正文写数字与出路（DS-128）：「元素数量超过本部署的上限（18,240 / 15,000）；如需编辑，请联系管理员」——数字的写法同 offline-conflict.quota-soft；示例取低于缺省硬上限 20,000 的部署天花板 15,000（这种情况只在部署调低天花板后才会出现，60/05 §4.1；与 quota-hard「每份文档 20,000 个元素的上限」不矛盾）。编辑器只读展示（DS-15：检查器只列当前值、顶部「只读 · 文档已达元素上限」，创建工具与评论留在原位不可用、原因「文档已达元素上限」，左栏新建、主菜单与缩略图右键里改文档的命令同样不可用）；只读会话照常有在场信息（头像组与远端光标都在）。同步状态行「只读 · 文档已达元素上限」（中性锁形，同「只读 · 名额已满」，可聚焦看说明）",
      editor: { ...CEILING, banner: <OverCeilingBanner /> },
    },
    {
      id: "over-ceiling-closed",
      title: "元素上限 · 横幅已关闭",
      note: "DS-128。关掉横幅后只剩同步状态行「只读 · 文档已达元素上限」与检查器顶部的同一句（03-12 §10：可关闭的横幅关掉后由状态行继续说明）；状态行的文字可聚焦，悬停或聚焦看说明「元素数量超过本部署的上限（18,240 / 15,000）；如需编辑，请联系管理员」（演示：状态一出现就展开，第一次点按或按键后收起）。本会话不再出现这条横幅",
      editor: { ...CEILING, rail: { ...CEILING.rail, status: STATUS.ceilingHint } },
    },
    {
      id: "alt-element-cap-warning",
      title: "未采纳 · 元素上限用警告浅底",
      note: "未采纳（DS-128 定为同「编辑者名额已满」：中性底 + 锁形、可关闭、无按钮，见 over-ceiling）：警告浅底 + 锁形（警告色）、不可关闭、读屏 status——类似 Figma 内存用尽时锁定文件的提示（帮助文档「Reduce memory usage in files」），更醒目；但以只读加入时本端没有写入、没有数据风险，浅底违背 03-12 §2.4「浅底只给有数据风险、要用户处理的横幅」，不可关闭又让一个看了就明白的提示一直占着横幅通道。其余同 over-ceiling",
      editor: { ...CEILING, banner: <OverCeilingWarningBanner /> },
    },

    /* ---------------------------------------------------------------- 仅查看形态 */
    {
      id: "narrow-version-drift",
      title: "仅查看形态 · 发现新版本（390 宽）",
      note: "视口 390 × 844。03-12 §11 / DS-60：仅查看形态里横幅在最顶上，查看器的顶部条排在它下面；文案放不下一行时按钮换到文案下方独占一行、高 44、13px（kit Banner stack），与 offline-conflict.narrow-offline 同一规则。横幅同 version-drift（警告浅底、刷新图标、不可关闭、只有「刷新」）；顶部条的状态行换成同步状态「需要刷新 · 3 项未同步」（警告色图标），与左栏同一个件、与横幅说的是同一件事。仅查看形态本来就没有编辑入口，「暂时不能编辑」在这里没有额外的画面",
      editor: {
        ...NARROW,
        data: { ...NARROW.data, form: "narrow", viewerStatus: STATUS.drift },
        toolbar: { hidden: true, collapse: true },
        regions: { ...NARROW.regions, stage: narrowStage },
        banner: <VersionDriftBanner source="closed" stack />,
        layers: <DriftGuards />,
      },
    },
  ],
})
