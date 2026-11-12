import { History, Lock } from "lucide-react"
import { ICON, InspectorNotice, lockTools, ME, type MenuSpec } from "../../kit"
import { STATUS } from "../main-states/bars"
import { defineScenario, type EditorConfig } from "../types"
import { AltDuplicateMenu, AltRail, AltRestoreDialog, PageStrip } from "./alt"
import { DEGRADED_BANNER, DocMenuLayer, EntryMenu, OFFLINE_BANNER, PreviewBanner, RailSwitch, StageSwitch, ToolbarSwitch, VhController } from "./chrome"
import { HistoryPanel } from "./HistoryPanel"
import { RESTORED_DECK } from "./slides"
import type { VhData } from "./store"

/**
 * version-history：03-07 版本历史的 v3 呈现（第 2 批 · 协作族）。落位按 Figma Slides：
 * 文档菜单（左栏文件名 ▾）「版本历史」→ 检查器整栏换成版本列表（kit InspectorTakeover，宽度沿用检查器 280）；点某个版本 → 画布与左栏缩略图换成该版本的只读内容，
 * 横幅通道出「正在查看〈时间〉的版本」+「返回当前版本 / 恢复此版本」，底部工具条收起；恢复先经锚在按钮下的非模态确认卡。
 * 规格：03-07（全部状态）、03-02 §2.3 文档菜单（编辑者才有「版本历史」，降权时不可用）、03-20 §6 末条（原「检查器临时加宽到 560」由本批定落位）、
 * PRD CO-07、50/08 §9–§11、ADR-0038（「撤销此次恢复」待 ADR 定稿，不在样张）。同目录：HistoryPanel（整栏面板）、chrome（画布 / 左栏 / 工具条 / 横幅的切换与控制器）、
 * slides（各历史版本的真实渲染）、data（版本列表示例）、store（共享状态）、alt（备选方案）。
 */

const vh = (d: VhData): EditorConfig["data"] => ({ vh: d })

/** 编辑模式已降权（03-12 readonly-degraded，与 main-states.degraded 同一组配置） */
const DEGRADED: EditorConfig = {
  slide: 3,
  rail: { status: STATUS.degraded, newSlide: { reason: "需要编辑权限" }, readonlyDegraded: "需要编辑权限" },
  inspector: { readOnly: true, notice: <InspectorNotice icon={<Lock {...ICON} aria-hidden="true" />}>只读 · 需要编辑权限</InspectorNotice> },
  toolbar: { disabled: lockTools("需要编辑权限", { except: ["comment"], select: true }) },
  banner: DEGRADED_BANNER,
}

/** 降权时文档菜单的条目（底座 docMenuEntries 同一份：三项都留在原位、不可用并写原因，rulings §4.25 TB-138、DS-139） */
const DEGRADED_DOC_ITEMS: MenuSpec[] = [
  { id: "rename", label: "重命名", disabled: true, reason: "需要编辑权限" },
  { id: "copy", label: "创建副本", disabled: true, reason: "需要编辑权限" },
  { type: "separator" },
  { id: "history", label: "版本历史", disabled: true, reason: "需要编辑权限" },
]

/** 离线：同步状态行、头像组只剩自己、离线横幅（排在预览横幅下面） */
const OFFLINE: EditorConfig = {
  rail: { status: STATUS.offline },
  inspector: { collaborators: { people: [ME] } },
  banner: <PreviewBanner below={OFFLINE_BANNER} />,
}

export default defineScenario({
  id: "version-history",
  title: "版本历史",
  specs: ["03-07", "03-02"],
  batch: 2,
  summary: "文档菜单「版本历史」→ 检查器整栏换成版本列表；画布与左栏预览所选版本，横幅「返回当前版本 / 恢复此版本」",
  // 别的样张里选文档菜单「版本历史」（那里没有场景接住 doc.history）：转到这里的 default（面板打开、焦点落在当前版本），不静默无响应（ED-30）
  provides: { "doc.history": "default" },
  editor: {
    // 画布照常画示例文档的评论钉（底座 stage.commentPins：第 4 页 3 枚，点钉切到「评论」页签；版本历史面板开着时先收起面板再切）——rulings §4.25 DS-43「编辑模式照常显示评论钉」（第 1 批编辑态停在第 4 页的画面同样用这个参数补了钉）
    stage: { cursor: false, commentPins: true },
    inspector: { takeover: <HistoryPanel /> },
    banner: <PreviewBanner />,
    canvasOverlay: <VhController />,
    regions: {
      stage: (_ctx, d) => <StageSwitch d={d} />,
      leftRail: (_ctx, d) => <RailSwitch d={d} />,
      toolbar: (_ctx, d) => <ToolbarSwitch d={d} />,
    },
  },
  states: [
    /* ---------------------------------------------------------------- 列表与预览 */
    {
      id: "default",
      title: "打开版本历史 · 当前版本",
      note: "03-07 默认态（落位按 rulings §4.25 DS-38）：文档菜单「版本历史」打开后检查器整栏换成版本列表（kit InspectorTakeover，宽度沿用检查器 280、不加宽，画布不跳动；协作行原样不动，页签行换成「版本历史 · 命名当前版本 · 关闭 Esc」）。当前版本选中，画布仍是正在编辑的文档；列表按天分组，同一天里相邻两条及以上的自动版本收成一行「N 个自动版本 起–止」（今天 7 个 09:40–14:32、昨天 9 个、10 月 6 日 4 个），只有一条时单列（10 月 2 日只有 16:48 一条，留作单列的示例；DS-57，收组由每天的版本推导）；9 月、8 月收起（默认只展开最近一个月）。月份行、自动版本组行、「最近删除」是同一种折叠行（高 32、箭头在前、12px 次级文字色，与评论「已解决 N」同一画法）；末尾「加载更早版本」是左对齐的安静行（不满宽、不描边；前面一个 12px 历史图标与月份行的箭头同一列，文字 12px 常规字重、次级文字色，悬停转主色——与折叠行同一画法，不像日期小标题、也不像命名版本），下面隔 12 是保留口径说明；所有者的列表顶部多一个收起的「最近删除」。面板开着时「单页 / 网格」不可用（网格视图没有检查器栏）。翻到第 4 页点画布上的评论钉：先收起面板、再切到「评论」页签（检查器被面板占着时没有页签，点了要有可见反馈；焦点留在钉上）",
      editor: { data: vh({}) },
    },
    {
      id: "entry",
      title: "入口 · 文档菜单「版本历史」",
      note: "03-02 §2.3 / 50/08 §9：唯一的常驻入口是文档菜单（文件名 ▾）「重命名 · 创建副本 ┊ 版本历史」，编辑者及以上才有（需要 history.read）；命令面板「版本历史」是第二入口。文档菜单的顶边贴住文件名下沿，把下面的同步状态行整行盖住（不切在半行字上；底座 DocMenu 同一处，质量门 Q7）。选「版本历史」打开整栏面板，焦点落在当前版本；关闭（× 或 Esc）后焦点回到文件名。网格视图里（文件名在左上胶囊里）先回单页再打开面板（同「文件 › 保真报告」），关闭后焦点交给单页里同一个文件名；别的样张里没有版本历史时，文档菜单「版本历史」转到本场景的 default（不静默无响应，ED-30）",
      editor: { inspector: { takeoverOpen: false }, data: vh({}), layers: <EntryMenu /> },
    },
    {
      id: "preview",
      title: "预览命名版本「提案定稿」",
      note: "03-07 / F8：点某个版本，画布换成它的只读预览（这里是昨天 16:20 的「提案定稿」：议程 3 项、关键词「增长 17%」），左栏缩略图换成这个版本的 5 页（取代原「缩略图迷你条」）、不提供新建；底部创建工具条收起；横幅通道出信息横幅「正在查看昨天 16:20 的版本 ·「提案定稿」· 仅你可见」+「返回当前版本」「恢复此版本」（恢复只在这里，列表行上不重复，质量门 Q2）；横幅里不再写「只读预览」——只读已由工具条收起、左栏不提供新建与标题「正在查看…的版本」表达。预览只影响自己的视图，不广播。Esc 先回到当前版本、再按关闭面板",
      editor: { slide: 2, data: vh({ selected: "n-proposal" }) },
    },
    {
      id: "auto-group",
      title: "自动版本分组 · 预览自动版本",
      note: "03-07「边界情况」/ DS-57：自动版本每 10 分钟且有变更生成一个，「今天」会很密——同一天里相邻两条及以上的自动版本收成一行「7 个自动版本 09:40–14:32」（起止按先后写），只有一条时单列；点开逐条列出、新的在前（14:32 排第一），缩进一档（文字与组标题的文字对齐）；自动版本单行显示时刻 · 贡献者头像与姓名（contributors）。组的条数与起止由当天的版本推导；横幅写「自动版本 · 王小明、李雷 · 仅你可见」。这里预览 13:50 的自动版本（王小明、李雷）：第 6 页「下半年计划」当时只有两项",
      editor: { slide: 6, data: vh({ selected: "a-1350", expanded: ["run-today"] }) },
    },
    {
      id: "older",
      title: "较早的月份 · 按天保留",
      note: "50/08 §9 / rulings §4.19 C-06：按月折叠，默认只展开最近一个月；展开 9 月后，30 天内（9 月 8 日起）的自动版本全量保留，更早的每天只留最后一个、标「当日最后版本」；命名版本永久保留。列表末尾「加载更早版本」按游标翻页（左对齐的安静行：不满宽、不描边，12px 历史图标与月份行的箭头同一列、文字次级色常规字重，与折叠行同一画法；点了先显示左对齐的加载中状态行、焦点交给它——读屏名「正在加载更早版本」，再出 7 月：导入的原始文件、焦点交给新出现的「7 月」一行，不掉到 body），说明「较早的自动版本按天保留，命名版本永久保留」不写死天数",
      editor: { data: vh({ expanded: ["m-09"], scrollTo: "m-09" }) },
    },

    /* ---------------------------------------------------------------- 命名与恢复 */
    {
      id: "name-version",
      title: "命名当前版本",
      note: "03-07「交互说明」/ 50/08 §9：标题行「命名当前版本」（书签加号，按下态）在面板顶部原位展开一节：名称 ≤ 30 字（计数常显）、说明可选、「取消 / 保存」；名称为空时「保存」不可用（请输入名称）。保存前先把本端未落库的更改 flush，再提交命名。命名需要 doc.manage（只有所有者）",
      editor: { data: vh({ naming: true }) },
    },
    {
      id: "named",
      title: "命名完成",
      note: "03-07：提交后「今天」最前面出现这个命名版本（加粗名称 + 说明 + 作者与时刻，区别于自动版本），轻提示「已将当前版本命名为『交付终稿』」",
      editor: { data: vh({ named: true, toast: "named" }) },
    },
    {
      id: "name-limit",
      title: "命名 · 已达上限",
      note: "50/08 §9 / 60/15 §3.8：每文档命名版本上限 200，超出返回 409 server.snapshots.named_limit_reached（业务上限，不是配额码）：表单留着，错误轻提示「命名版本已达上限（每份文档 200 个）」（文案取 errors.<code>）。轻提示在画布底部、离名称框远，是 50/08 §9 的写法（上限是整份文档的，不是名称写错了）；另一种写法是在名称框下方原位报错（改 50/08 §9），是 DS-57 未采纳的备选",
      editor: { data: vh({ naming: true, limit: true, toast: "name-limit" }) },
    },
    {
      id: "restore-confirm",
      title: "恢复确认",
      note: "03-07「交互说明」/ 50/08 §10：点横幅「恢复此版本」，按钮下方弹出非模态确认卡（不是浏览器 confirm，也不是模态对话框：恢复会先把当前内容存成自动版本，可找回）——「恢复到『提案定稿』？将以这个版本的内容创建一个新版本，当前更改不会丢失」，有协作者正在编辑时加一行头像 +「王小明、李雷正在编辑，恢复后他们的画布会自动更新」（F8 边界，不阻止操作）；「取消 / 确认恢复」，Esc 或点外面关闭、焦点回按钮",
      editor: { slide: 2, data: vh({ selected: "n-proposal", confirm: true }) },
    },
    {
      id: "restored",
      title: "恢复完成",
      note: "50/08 §10：恢复在 Room 内以一个新事务写回（不加锁、协作者不断连，rulings §4.19 N1）；画布回到当前版本（内容已是「提案定稿」：5 页、增长 17%），横幅消失、工具条回来；「今天」最前面出现「恢复自『提案定稿』」与恢复前服务端先存的自动版本（标「恢复前」，当前更改不会丢失的去处；它单列、不并进下面的「7 个自动版本」组，找回点要一眼看得到——收组口径的唯一例外，DS-57 写明，回写 03-07；收组由数据推导，data.ts 的 groupable 按版本的「恢复前」标记判断，不按状态名）；轻提示「已恢复到『提案定稿』」。「撤销此次恢复」待 ADR-0038 定稿后出稿",
      editor: { deck: RESTORED_DECK, slide: 2, data: vh({ restored: "me", toast: "restored" }) },
    },
    {
      id: "restored-remote",
      title: "协作者收到恢复提示",
      note: "50/08 §10 第 6 步 / F8：其他在线协作者的画布随 CRDT 更新为恢复后的内容（撤销栈不变），同时收到 CONTROL.event version.restored，轻提示带恢复者头像「李雷已将文档恢复到『提案定稿』」；发起方不重复提示。这里是编辑者视角（文档所有者是李雷），从文档菜单打开版本历史可以看到「恢复自『提案定稿』· 李雷」",
      editor: { deck: RESTORED_DECK, slide: 2, inspector: { takeoverOpen: false }, data: vh({ role: "editor", restored: "li", toast: "restored-remote" }) },
    },

    /* ---------------------------------------------------------------- 加载、出错、空态 */
    {
      id: "preview-loading",
      title: "大预览加载中",
      note: "03-07「大预览加载中」/ 50/08 §9 / DS-53：快照较大时左栏与画布都不显示切换前那个版本的页（旧页还带当前文档的评论角标，像是这个版本的页）——左栏列表区中央、画布上幻灯片位置的面板色框里各是「转圈 + 正在加载这个版本…」（DS-53 的统一画法，不画骨架条），加载完换成这个版本的页；读屏只由左栏那一行（status）播报一次。横幅已切到这个版本（不再写「正在加载…」），「恢复此版本」不可用（版本加载完成后可用）；列表照样可点，换版本时取消上一个请求",
      editor: { slide: 2, data: vh({ selected: "n-draft", previewLoading: true }) },
    },
    {
      id: "loading",
      title: "加载中",
      note: "03-07「加载」：当前版本是本地的、立即可选；其下一行转圈「正在加载版本历史…」（不画骨架条，质量门 Q8；DS-53），画布照常是正在编辑的文档",
      editor: { data: vh({ status: "loading" }) },
    },
    {
      id: "error",
      title: "加载失败",
      note: "03-07「错误」/ 03-12：替换整个内容区——危险色图标、「版本历史加载失败」「请检查网络连接后重试」「重试」（面板内联错误态，不进横幅通道）；用户打开面板（或面板开着时再选文档菜单「版本历史」）时焦点落在「重试」上；点「重试」回到加载中（焦点交给「当前版本」一行），加载完成后出列表",
      editor: { data: vh({ status: "error" }) },
    },
    {
      id: "empty",
      title: "空态 · 只有导入时的版本",
      note: "03-07「空」（DS-53 定的修正）：服务端文档创建时总会写一个 import 快照（60/04 §3.3、rulings §4.19 D-M2-CONTENT），所以「新文档」的列表里不会一条都没有——显示当前版本 + 今天的「导入自『2026 年 Q2 业绩汇报.pptx』」+ 一句说明「还没有其他版本。继续编辑后会自动生成版本；需要留档时，可以命名当前版本」；03-07 原文只有一行说明、不显示分组标题（随 DS-53 回写）。首条按文档来源写（rulings §4.25 DS-70）：样张示例文档是导入的，所以写「导入自『文件名.pptx』」；新建空白写「新建演示文稿」，从模板新建写「从模板『〈模板名〉』新建」，创建副本写「创建自『〈原文档名〉』的副本」（后端在这条 import 快照的元数据里带来源与显示名）",
      editor: { data: vh({ status: "empty" }) },
    },

    /* ---------------------------------------------------------------- 权限 */
    {
      id: "editor-role",
      title: "编辑者 · 只能浏览与预览",
      note: "03-07「只读」/ rulings U-09、§4.18 UX-17：编辑者有 history.read，可以浏览与预览；「恢复此版本」（history.restore）与「命名当前版本」（doc.manage）只属于所有者——留在原位、不可用，提示「需要所有者权限」（这里横幅按钮的提示常开演示），不是「需要编辑权限」；面板顶部一行说明「只有所有者可以命名或恢复版本」（锁图标，与离线说明、降权检查器、分享非所有者视图的「只读 · …」同一画法，DS-15），原因不只在悬停提示里；列表顶部没有「最近删除」（仅所有者）",
      editor: { slide: 2, data: vh({ role: "editor", selected: "n-proposal", tipOpen: true }) },
    },
    {
      id: "no-access",
      title: "评审者 · 没有入口",
      note: "03-02 §2.3 / 03-07「只读」：评审者（commenter）与查看者没有 history.read——「版本历史」入口本身不出现，而不是出现后再报错（rulings §4.18 UX-17）。按 rulings §4.25 DS-82（U-09：duplicate 要 doc.export）评审者与查看者也没有「创建副本」，文档菜单一项都没有，文件名不再是菜单触发器：左栏顶部只显示文件名（13px 600，没有 ▾、不响应悬停与点按、不进 Tab 顺序，读屏照常读到）。画布照常画第 4 页的 3 枚评论钉（评审模式同第 1 批评审态；DS-43，场景级参数 stage.commentPins，点钉切到「评论」页签）（2026-10-22 按 rulings §4.25 DS-82 改：原为文档菜单开着、只有「创建副本」一项）",
      editor: {
        mode: "review",
        toolbar: { canEdit: false },
        slide: 4,
        inspector: { takeoverOpen: false },
        data: vh({}),
      },
    },
    {
      id: "degraded-menu",
      title: "降权 · 文档菜单里不可用",
      note: "03-02 §2.3、§6.2 / DS-15：编辑模式已降权（readonly-degraded）时，文档菜单「重命名」「创建副本」「版本历史」三项都留在原位、不可用并写「需要编辑权限」（不隐藏、仍可聚焦；rulings §4.25 TB-138、DS-139：创建副本要 doc.export，降权后已没有，与「文件 › 导出…」同一规则，DS-105、§4.12 U-09；未保存的更改仍从横幅「导出为本地副本」带走）；与主菜单、缩略图右键同一规则；菜单顶边贴住文件名下沿、把同步状态行整行盖住（同 entry）。降权横幅的正文取 offline-conflict 的同一份原文「3 项更改未被保存；文档已重新载入服务端版本，撤销历史已清空」（与 degraded-export、master-degraded、too-large 一致；DS-58）。第 1 批 main-states.degraded 的降权横幅已按 DS-58 换成同一句（2026-10-22 按 TB-138、DS-139 改：「创建副本」原为照常）",
      editor: { ...DEGRADED, inspector: { ...DEGRADED.inspector, takeoverOpen: false }, data: vh({}), layers: <DocMenuLayer items={DEGRADED_DOC_ITEMS} highlight="版本历史" /> },
    },

    /* ---------------------------------------------------------------- 离线 */
    {
      id: "offline",
      title: "离线 · 没加载过",
      note: "03-07「离线」/ 50/08 §11：离线横幅照常在横幅通道（同步状态行「离线 · 3 项待同步」，头像组只剩自己）；没加载过版本历史时面板只有当前版本 + 顶部说明「离线 · 无法加载版本历史，只显示本地最新内容」（与 offline-cached 的「离线 · 可能不是最新」同一句式）；「命名当前版本」不可用（离线时不可用）；「最近删除」读本地文档状态，照常显示，「彻底删除」离线时不可用",
      editor: { ...OFFLINE, data: vh({ status: "offline" }) },
    },
    {
      id: "offline-cached",
      title: "离线 · 显示缓存（预览中）",
      note: "03-07「离线」/ 50/08 §11：曾经加载过时显示内存里的缓存，整条时间轴置灰、不可点，顶部「离线 · 可能不是最新」；离线前已打开的「提案定稿」预览留着，「恢复此版本」不可用（恢复连接后才能恢复版本）。两条横幅同时成立：预览横幅是模式横幅、常驻在上，离线横幅排在它下面（母版视图 TB-14 的例外扩到版本预览，DS-39）",
      editor: { ...OFFLINE, slide: 2, data: vh({ status: "offline-cached", selected: "n-proposal" }) },
    },

    /* ---------------------------------------------------------------- 最近删除（M3，仅所有者） */
    {
      id: "recently-deleted",
      title: "最近删除（所有者）",
      note: "03-07「最近删除」/ 50/04 §7.1 / rulings §4.18 CO-07：所有者的列表顶部可折叠分组「最近删除 3」（编辑者不显示；标题行与月份行、自动版本组行是同一种折叠行），列出墓碑保留期内的已删除元素：元素与所在页 · 删除者 · 删除时间 / 剩余保留时长 ·［彻底删除］（中性次按钮，危险色只在确认框的主按钮）。不设恢复按钮：找回走删除方撤销，或被删方在提示里「恢复元素（含我的编辑）」（05 §6，offline-conflict.conflict-deleted），分组说明写明这两条路。这是「彻底删除元素」的唯一入口",
      editor: { data: vh({ deletedOpen: true }) },
    },
    {
      id: "purge-confirm",
      title: "彻底删除确认",
      note: "03-07 / 03-05 §6：彻底删除不可撤销，属于用确认框的销毁性操作——「彻底删除『矩形 3』？删除后无法恢复。历史版本仍含该内容，要连历史清除请永久删除文档。」「取消 /（危险色）彻底删除」；确认后该行消失、轻提示「已彻底删除 1 个元素」（不带撤销），写审计 document.element_purged。确认框只在状态一出现时打开一次（关掉后收起再打开面板不会重放）。术语：元素级「彻底删除元素」，文档级「永久删除文档」，不混用",
      editor: { data: vh({ deletedOpen: true, purge: "del-1" }) },
    },

    /* ---------------------------------------------------------------- 未采纳的备选（DS-63：留作对照，实现以推荐为准） */
    {
      id: "alt-rail-list",
      title: "未采纳 · 左栏换成版本列表",
      note: "未采纳：DS-38、DS-39 定为推荐（version-history.preview）。DS-38（落位）与 DS-39（缩略图迷你条）未采纳的备选：版本列表放进左栏（上半部分照常），检查器留着、只读。该版本的页只能放进底部的缩略图迷你条（64 宽，取代工具条），左栏失去页面导航；检查器在预览时没有可改的东西却占着 280。对照推荐方案 preview：Google Slides、Figma 都把版本列表放在右侧、左侧留给页面",
      editor: {
        slide: 2,
        inspector: { takeover: null, readOnly: true, notice: <InspectorNotice icon={<History {...ICON} aria-hidden="true" />}>只读 · 正在查看历史版本</InspectorNotice> },
        regions: { leftRail: (_ctx, d) => <AltRail d={d} />, toolbar: (_ctx, d) => <PageStrip d={d} /> },
        data: vh({ selected: "n-proposal" }),
      },
    },
    {
      id: "alt-wide",
      title: "未采纳 · 整栏加宽到 400",
      note: "未采纳：DS-38 定为推荐（version-history.preview）。DS-38 未采纳的备选宽度：沿用 DS-26 图表数据面板的 400。版本列表一行最长的是名称与说明（命名 ≤ 30 字），280 已经放得下；加宽到 400 画布从 1080 收到 960、打开面板时画布跳动，也没有多显示什么。原 historyWidth 560（50/10 §2.1）随 DS-38 作废",
      editor: { slide: 2, data: vh({ selected: "n-proposal", width: 400 }) },
    },
    {
      id: "alt-confirm-dialog",
      title: "未采纳 · 恢复确认用对话框",
      note: "未采纳：DS-40 定为推荐（version-history.restore-confirm）。DS-40 未采纳的备选确认形态：模态确认框（kit Dialog confirm，遮罩挡住整个界面）。03-05 §6 把确认对话框留给两类操作：不可撤销的销毁，以及会波及其他页、确认后仍可撤销的操作。推荐方案（restore-confirm，锚在按钮下的非模态确认卡）认为恢复前服务端已先存了自动版本、找回不靠撤销，不归第二类；若更看重「替换整份文档、协作者画布随之更新」的影响面，就把恢复归进第二类、用这个模态框（DS-40 未采纳的选项）。关掉后再点横幅「恢复此版本」，打开的仍是这个对话框（关闭后焦点回到按钮）",
      editor: { slide: 2, data: vh({ selected: "n-proposal", confirm: true, confirmDialog: true }), layers: <AltRestoreDialog /> },
    },
    {
      id: "alt-duplicate",
      title: "未采纳 · 以此版本创建副本",
      note: "未采纳：DS-57 定为推荐（version-history.preview）。DS-57 未采纳的备选，新增需求的示意（DS-57 定为不做：版本行与右键里都没有这一项）：Figma 版本菜单的 Duplicate、Google 的「复制」——在版本行右键菜单里放「以此版本创建副本」（「恢复此版本」是不常驻的第二入口）。目前没有对应能力：POST /documents/:id/duplicate 只复制当前状态（导出的 snapshotId? 已有），按 DS-19 不放；要做需走新增需求的变更（PRD CO-07、60/15 §3.3 加 snapshotId）",
      editor: { slide: 2, data: vh({ selected: "n-proposal" }), layers: <AltDuplicateMenu /> },
    },
  ],
})
