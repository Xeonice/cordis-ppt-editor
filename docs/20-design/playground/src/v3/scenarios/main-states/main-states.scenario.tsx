import { CloudOff, FileWarning, Gauge, Lock, RefreshCw } from "lucide-react"
import {
  AccountMenuLayer, Avatar, Banner, Button, CARD_POS, ContextMenu, failedPluginsCopy, GeometrySection, ICON, InspectorNotice, LI, lockTools, MainMenuLayer, ME, PluginBanner, Popover, Progress, RailList, RailThumb, thumbMenu, Toast, Toasts, WANG, ZHANG, registerToolLayer, SHARE_LATER } from "../../kit"
import { ReviewBar, ViewerBar } from "../comments/chrome"
import { DECK_COMMENTS } from "../comments/comments.scenario"
import { REJECTED_TEXT } from "../offline-conflict/banners"
import { NoAccessPage } from "../share/RequestAccess"
import { defineScenario, type EditorConfig } from "../types"
import { STATUS } from "./bars"
import { ONLINE_FOLDED, ONLINE_SHOWN, OpenFailedPage, PresenceList } from "./panels"
import { CHEN, PresenceCursor, RemoteSelection, RemoteTextSelection, WarnBadge } from "./presence"
import { NO_COMMENTS_DECK, OPENING_DECK, qrDeck, REST_DECK } from "./slides"

/**
 * main-states：03-02 编辑器主界面在第 0 批底座之外的状态（02 §6，第 1 批补齐，2026-10-07 随 rulings §4.25 DS-21 拍板）。
 * 打开中骨架、打开失败、评审模式、评审者 / 查看者的只读界面、编辑模式已降权、远端协作者在场、同步状态行（同步中 / 重连中 / 离线，
 * 含网格视图胶囊）、撤销被跳过与性能弱提示、插件横幅（缺插件三种原因、插件设置已更新、插件启动失败）；
 * 另有 2026-10-08 按 rulings §4.25 DS-31 补的三个状态：形状检查器的快速样式行与 42 格样式库、主菜单「文件」里的「幻灯片大小…」（P2）；样式库按 DS-34（2026-10-08）改为在检查器「快速样式」节里原位展开。
 * 行为与文案以 03-02 §6、03-12、03-13、05 §1–§8、03-09 §6 为准；视觉按 v3（DS-1…DS-8）。
 * 评审 / 只读角色用 EditorConfig.mode（review / viewer），不可用的工具、检查器与左栏用 toolbar.disabled、inspector.disabled / locked、rail.newSlide / viewToggle，
 * 头像组用 inspector.collaborators（都是底座能力）。同目录：bars（同步状态行）、panels（在线列表、打开失败页）、
 * presence（远端光标与选区、评论钉、缩略图警示角标）、slides（版式骨架页、缺插件占位页）。
 */

const noop = () => undefined

/* 真实头像组「+N」（底座 chrome.tsx Collaborators）点开的在线列表：贴头像组左缘向下，关闭后焦点回到「+N」（05 §1a、PRD CO-03） */
registerToolLayer("presence:list", ({ open, onOpenChange }) => (
  <Popover anchor="collaborators" returnFocus="collaborators-more" open={open} onOpenChange={onOpenChange} snap={false} side="bottom" align="start" sideOffset={8} label="在线列表">
    <PresenceList />
  </Popover>
))

/* ------------------------------------------------------------------ 评审 / 只读：共用配置 */


/** 只读状态下备注也只读：显示这一页真实的备注，不出现「添加演讲者备注…」这种邀请输入的占位。 */
const NOTES_P4 = "先讲 6 月创年内新高，再对比 Q1 与 Q2：Q2 累计 1.28 亿元，同比 +18%。海外业务口径待王小明确认。"
const NOTES_P3 = "三项指标都按同比口径；毛利率的变化单位是百分点（pt），不是百分比。"

const DEGRADED_NOTICE = <InspectorNotice icon={<Lock {...ICON} aria-hidden="true" />}>只读 · 需要编辑权限</InspectorNotice>

/**
 * 评审模式（有评论包）：mode = review——工具条换成评审条、左栏不提供新建、检查器只读并注明（底座缺省）；
 * 这里只加：第 4 页（有评论）、真实备注、评论钉、检查器默认「评论」页签。
 * 评论页签与画布评论钉是第 2 批评论场景的同一套件（rulings §4.25 DS-62，2026-10-15：原「第 4 页 · 3 条评论」平铺列表换成分段筛选、未解决在前、已解决收起、可展开回复的评论面板）：
 * comments 场景的 DECK_COMMENTS——评论面板、CommentLayer 评论钉（坐标与 editor/deck.tsx DECK_PINS 同一组，点钉定位线程）、左栏实时角标；示例文档原样（第 4 页 3 条、都未解决），
 * 钉、角标与评审条的「3 条评论」与改前相同。评审条换成评论场景的 ReviewBar（同一个底座评审条，「上一处 / 下一处评论」接上定位、计数实时）。
 * 角色：编辑者切到评审（data.role editor：可以解决他人的线程）。
 */
const REVIEW: EditorConfig = {
  ...DECK_COMMENTS,
  mode: "review",
  slide: 4,
  // 远端光标挪到两组柱子之间，不与右上方的评论钉挤在一起
  stage: { notesText: NOTES_P4, cursor: { at: "left-[48%] top-[62%]" } },
  inspector: { ...DECK_COMMENTS.inspector, tab: "comments" },
  regions: { toolbar: () => <ReviewBar /> },
  data: { ...DECK_COMMENTS.data, role: "editor" },
}

/* ------------------------------------------------------------------ 插件横幅 */

const PLACEHOLDER_NOTE = "3 处内容以占位显示，内容已保留；可选中、移动或删除，暂不能编辑内部"
/** 启动失败横幅的标题与说明行（DS-55）：两个插件失败，标题写数量、说明行列出名字 */
const FAILED = failedPluginsCopy(["现场投票", "演示激光笔"])

/** 缺插件：第 6 页换成「扫码获取资料」（三个二维码由插件绘制，原位显示占位），左栏第 6 页带警示计数。 */
function missingPlugin(reason: string, banner: EditorConfig["banner"]): EditorConfig {
  return {
    deck: qrDeck(reason),
    slide: 6,
    banner,
    rail: {
      list: (ctx) => (
        <RailList>
          {ctx.deck.map((s) => (
            <RailThumb key={s.n} slide={s} current={s.n === ctx.slide} onPick={ctx.goTo}>
              {s.n === 6 && <WarnBadge n={3} />}
            </RailThumb>
          ))}
        </RailList>
      ),
    },
  }
}

const id = (text: string) => <code className="font-mono text-[12px] whitespace-nowrap">{text}</code>

/**
 * 编辑模式已降权（03-12 readonly-degraded，02 §6.2）的编辑器配置：横幅、创建工具不可用（「选择」「评论」照常）、左栏新建不可用、
 * 检查器只读展示（DS-15）、主菜单与缩略图右键里改文档的命令不可用并写原因（rail.readonlyDegraded；主菜单逐项写在右侧，
 * 缩略图右键整组同因、写在菜单顶部一行，rulings §4.25 TB-22）。degraded 与两个菜单状态共用。
 */
const DEGRADED: EditorConfig = {
  slide: 3,
  stage: { notesText: NOTES_P3 },
  // 主菜单与缩略图右键里改文档的命令也不可用并写原因（readonlyDegraded：不隐藏、仍可聚焦；02 §6.2、DS-15）
  rail: { status: STATUS.degraded, newSlide: { reason: "需要编辑权限" }, readonlyDegraded: "需要编辑权限" },
  // DS-15：降权与评审、查看者同一形态——只读展示当前值（不画禁用控件），顶部一行说明权限
  inspector: { readOnly: true, notice: DEGRADED_NOTICE },
  toolbar: { disabled: lockTools("需要编辑权限", { except: ["comment"], select: true }) },
  // 正文后半句按 rulings §4.25 DS-58 改为「文档已重新载入服务端版本，撤销历史已清空」（2026-10-15；原「导出后可另行申请编辑权限再重新应用」的意思移到导出对话框与「已导出本地副本」提示里），
  // 与第 2 批同一条降权横幅取同一份原文（offline-conflict/banners.tsx 的 REJECTED_TEXT）
  banner: (
    <Banner tone="error" icon={<Lock {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-danger)" />} title="你的权限已变更为「可评审」" actions={<Button variant="secondary">导出为本地副本</Button>}>
      {REJECTED_TEXT}
    </Banner>
  ),
}

/* ------------------------------------------------------------------ 场景 */

export default defineScenario({
  id: "main-states",
  title: "编辑器主界面 · 状态",
  specs: ["03-02"],
  summary: "打开中与打开失败、评审与只读角色、降权、在场、快速样式与「文件」菜单、同步状态、撤销提示与插件横幅",
  states: [
    /* ---------------------------------------------------------------- 打开 */
    {
      id: "opening",
      title: "打开中 · 版式骨架",
      note: "02 §6.2 加载中 / 03-13 打开进度：母版与版式先出（虚线占位框 + 母版装饰与页脚，不是灰条）；进度与「取消」在画布、同步状态行写「正在打开…」；工具条与检查器首屏可交互前不可操作",
      editor: {
        deck: OPENING_DECK,
        slide: 1,
        stage: { notes: false, cursor: false },
        rail: { status: STATUS.opening, newSlide: { reason: "文档打开后可用" }, viewToggle: { reason: "文档打开后可用" } },
        // 打开中：协作者还没连上（头像组不出现），放映、分享、页签、缩放与各节控件都不可用
        inspector: { locked: "文档打开后可用", collaborators: { people: [] } },
        toolbar: { disabled: lockTools("文档打开后可用") },
        slideOverlay: (
          <div className="absolute top-[calc(100%+24px)] left-1/2 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap">
            <span className="text-[12px] leading-none text-(--v3-text-2)">正在解析母版与版式…</span>
            <Progress value={62} label="打开进度" className="w-40" />
            <span className="w-7 text-[11px] leading-none text-(--v3-text-2) tabular-nums">62%</span>
            <Button variant="outline">取消</Button>
          </div>
        ),
      },
    },
    {
      id: "opening-rest",
      title: "首屏可交互 · 其余页面加载中",
      note: "03-13：首屏渲染完成后进度与骨架消失、编辑器可用；后台继续解析其余页，同步状态行弱提示「其余页面加载中 4/6」，左栏缩略图逐项从版式骨架换成真实渲染",
      editor: {
        deck: REST_DECK,
        slide: 1,
        stage: { cursor: false },
        rail: { status: STATUS.rest },
      },
    },
    {
      id: "open-failed",
      title: "打开失败 · 通用兜底",
      note: "02 §6.2 / 03-13 通用兜底文案（不出现「已损坏」）：阻断式全屏，不渲染残缺的左栏、检查器与工具条；返回入口只有按钮组里的「返回文档列表」",
      editor: {
        toolbar: { hidden: true, collapse: true },
        regions: {
          leftRail: () => null,
          inspector: () => null,
          stage: () => (
            <OpenFailedPage
              icon={<FileWarning size={32} strokeWidth={1.5} aria-hidden="true" />}
              context="2026 年 Q2 业绩汇报"
              title="无法打开该文档"
              actions={
                <>
                  <Button variant="primary">重试</Button>
                  <Button variant="outline">复制诊断信息</Button>
                  <Button variant="outline">返回文档列表</Button>
                </>
              }
            >
              请稍后重试；如果问题持续，请复制诊断信息并联系管理员
            </OpenFailedPage>
          ),
        },
      },
    },
    {
      id: "open-failed-access",
      title: "打开失败 · 没有访问权限",
      note: "03-13「无访问权限 / 文档已删除」：同一阻断式布局，主操作换成「申请访问」。「申请访问」打开留言弹层（与 share.request-access 同一个件：可选留言 ≤ 200 字 +「取消 / 发送」，用户打开时焦点进留言框，Esc / 取消关闭、焦点回按钮）；发送后弹层收起，「申请访问」留在原位不可用（24 小时内不能重复申请，工具提示写原因），页内写「已发送申请，等待文档所有者批准」（常驻、polite 播报一次）（2026-10-15 按 rulings §4.25 DS-48 改）",
      editor: {
        toolbar: { hidden: true, collapse: true },
        // 阻断页与留言弹层：分享场景的 NoAccessPage（同一布局与文案，主操作接上留言弹层，share/RequestAccess.tsx）
        regions: {
          leftRail: () => null,
          inspector: () => null,
          stage: () => <NoAccessPage />,
        },
      },
    },

    /* ---------------------------------------------------------------- 评审与只读角色 */
    {
      id: "review",
      title: "评审模式 · 编辑者切到评审",
      note: "02 §6.2 评审模式：工具条换成评审条（浏览 · 评论 · 高亮 ｜ 上一处 / 下一处评论 ｜ 评审模式 + 返回编辑）；画布只读、只有评论钉可点；左栏不提供新建；检查器默认「评论」页签。「评论」页签是第 2 批的评论面板（与 comments 场景同一个件）：顶部筛选「全部 / 当前页 / 未解决 / @我」（缺省「当前页」）与排序，未解决在前、已解决收在末尾「已解决 N」一行（这一页的 3 条都未解决，没有这一行），每条可展开回复；编辑者可以回复与解决。点画布上的评论钉定位到那一条（选中铺强调色淡底、钉加外圈），「上一处 / 下一处评论」同此（2026-10-15 按 rulings §4.25 DS-62 改）",
      editor: REVIEW,
    },
    {
      id: "review-design",
      title: "评审模式 · 设计页签只读",
      note: "02 §6.2：「设计」页签只读展示（每节只写当前值，不画可操作的字段外形），顶部注「只读 · 评审模式下不可编辑」",
      // 「评论」页签是同一个评论面板（切过去时显示，DS-62），这一态停在「设计」，画面不变
      editor: { ...REVIEW, inspector: { ...REVIEW.inspector, tab: "design" } },
    },
    {
      id: "review-empty",
      title: "评审模式 · 无条目（M2）",
      note: "02 §6.2 / FE-08：M2 未装评论包（slide.hasComments 为假）时评审条没有条目，工具条位置只放只读提示「评审模式 · 只读」；同时没有评论钉、「评论」页签与缩略图评论计数；「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）",
      editor: {
        mode: "review",
        deck: NO_COMMENTS_DECK,
        slide: 3,
        stage: { notesText: NOTES_P3 },
        toolbar: { hint: "评审模式 · 只读" },
        inspector: { commentsTab: false, share: SHARE_LATER },
      },
    },
    {
      id: "mode-menu",
      title: "进入评审 · 主菜单的模式",
      note: "02 §6.2 模式切换 / 01 §5.2：原应用栏「模式」下拉并入主菜单「视图 › 模式」（编辑 / 评审单选，DS-1），演示停在「评审」上；放映另有检查器顶行的「放映」；「返回首页」在主菜单第一项",
      editor: {
        stage: { cursor: false },
        layers: <MainMenuLayer openPath={["view"]} highlight="评审" />,
      },
    },
    {
      id: "commenter",
      title: "评审者 · 主菜单的模式切换",
      note: "01 §5.2 / 02 §2.4：评审者（commenter）以评审模式打开，工具条没有「返回编辑」；主菜单「视图 › 模式」里「编辑」不可用（需要编辑权限）、「母版视图」不可用（评审模式下不可用）；插入、排列整组不可用；「文件 › 导出…」不可用、写「需要编辑权限」（doc.export 只到编辑者，rulings §4.25 DS-105）。左栏顶部只显示文件名、不是菜单触发器（DS-82：按 U-09 评审者没有「创建副本」，文档菜单一项都没有）。「评论」页签是第 2 批的评论面板（同 review）：评审者可以发表、回复，只能解决自己发起的线程——他人线程的「解决」留在原位、不可用并写原因（2026-10-15 按 rulings §4.25 DS-62 改；2026-10-22 按 DS-82、DS-105 改）",
      editor: {
        ...REVIEW,
        toolbar: { canEdit: false },
        stage: { cursor: false, notesText: NOTES_P4 },
        regions: { toolbar: () => <ReviewBar canEdit={false} /> },
        layers: <MainMenuLayer openPath={["view"]} canEdit={false} />,
        data: { ...REVIEW.data, role: "commenter" },
      },
    },
    {
      id: "viewer",
      title: "查看者 · 只读浏览",
      note: "02 §6.2 查看者变体（mode='view'）：没有评论与高亮的创建，工具条只有上一处 / 下一处评论 +「只读浏览中」；「评论」页签只读（无回复、已解决与输入框）；照常看到他人在场与实时修改；文件名不是菜单触发器——只显示文件名（13px 600，没有 ▾、不响应悬停与点按、不进 Tab 顺序，读屏照常读到；rulings §4.25 DS-82：按 U-09 查看者没有「创建副本」，也没有「版本历史」）；主菜单「文件 › 导出…」不可用、写「只有查看权限」（DS-105）。「评论」页签是第 2 批的评论面板（同 review）：顶部「只读 · 你只有查看权限」，筛选照常，线程可展开阅读，没有回复框、解决与「⋯」（2026-10-15 按 rulings §4.25 DS-62 改；2026-10-22 按 DS-82、DS-105 改：原为文件名 ▾ 打开只有「创建副本」一项的菜单）",
      editor: { ...REVIEW, mode: "viewer", regions: { toolbar: () => <ViewerBar /> }, data: { ...REVIEW.data, role: "viewer" } },
    },
    {
      id: "degraded",
      title: "编辑模式已降权",
      note: "02 §6.2 / 03-12 readonly-degraded：横幅（锁形图标、危险色、导出前不可关闭）；创建工具不可用、不隐藏，工具提示「需要编辑权限」（降为「可评审」后评论仍可用）；检查器按 DS-15 与评审、只读浏览统一为只读展示当前值，顶部一行「只读 · 需要编辑权限」；主菜单（编辑 › 撤销 / 剪切 / 粘贴 / 删除等、插入、排列、母版视图）与缩略图右键里改文档的命令同样不可用并写「需要编辑权限」（复制、全选、查找照常）；「文件 › 导出…」同样留在原位、不可用、写「需要编辑权限」，⇧⌘E 无效（降权后已没有 doc.export，与评审者同一句；未保存的更改走横幅「导出为本地副本」，CO-05）；文档菜单「重命名」「创建副本」「版本历史」三项都留在原位、不可用并写同一原因（rulings §4.25 TB-138、DS-139：创建副本要 doc.export，与「文件 › 导出…」同一规则；未保存的更改仍从横幅「导出为本地副本」带走）；同步状态行「只读 · 权限已变更」。横幅正文「3 项更改未被保存；文档已重新载入服务端版本，撤销历史已清空」（原「导出后可另行申请编辑权限再重新应用」的意思移到导出对话框与「已导出本地副本」提示里）（2026-10-15 按 rulings §4.25 DS-58 改；2026-10-22 按 DS-105 改：原写「导出照常」；同日按 TB-138、DS-139 改：文档菜单「创建副本」原为照常）",
      editor: DEGRADED,
    },
    {
      id: "degraded-menu",
      title: "降权 · 主菜单里改文档的命令不可用",
      note: "02 §6.2 / DS-15：编辑模式已降权时，主菜单「编辑」里撤销、重做、剪切、粘贴、原位复制、删除、替换…、重置页…都 aria-disabled（不隐藏、仍可聚焦）并在右侧写「需要编辑权限」，复制、全选、查找照常；「插入」「排列」整组与「视图 › 母版视图」同样不可用并写同一原因；「文件 › 导出…」也不可用、写「需要编辑权限」（rulings §4.25 DS-105：降权后已没有 doc.export，同评审者；「保真报告」照常，未保存的更改走横幅「导出为本地副本」）——本态展开的是「编辑」，指到「文件」即见。左栏文件名打开的文档菜单「重命名」「创建副本」「版本历史」三项同样不可用并写「需要编辑权限」（rulings §4.25 TB-138、DS-139，与「文件 › 导出…」同一规则；画面见 version-history.degraded-menu）。横幅正文同 degraded（2026-10-15 按 rulings §4.25 DS-58 改；2026-10-22 按 DS-105 改：「导出…」原为照常；同日按 TB-138、DS-139 改：「创建副本」原为照常）",
      editor: { ...DEGRADED, stage: { cursor: false, notesText: NOTES_P3 }, layers: <MainMenuLayer openPath={["edit"]} readonlyDegraded="需要编辑权限" /> },
    },
    {
      id: "degraded-thumb-menu",
      title: "降权 · 缩略图右键里改文档的命令不可用",
      note: "02 §6.2 / 03-05 §2.3 / DS-15 / TB-22：缩略图右键（左栏与网格同一份）里新建幻灯片、复制幻灯片、更换版式、隐藏幻灯片、移动、删除幻灯片全部 aria-disabled（不隐藏、仍可聚焦），删除不再用危险色；原因相同，写在菜单顶部一行「需要编辑权限」、各项 aria-describedby 指向它。评审模式（「评审模式下不可用」）与只读浏览（「只有查看权限」）用同一份只读条目。横幅正文同 degraded（2026-10-15 按 rulings §4.25 DS-58 改）",
      editor: {
        ...DEGRADED,
        stage: { cursor: false, notesText: NOTES_P3 },
        layers: <ContextMenu at={{ anchor: "thumb-3", x: 0.62, y: 0.42 }} target="thumb-*" label="第 3 页" items={thumbMenu({ readOnly: true, reason: "需要编辑权限" })} />,
      },
    },

    /* ---------------------------------------------------------------- 在场 */
    {
      id: "presence",
      title: "远端协作者在场",
      note: "05 §1–§3：多人身份色的光标与姓名签、远端对象选区（实线框、无手柄）、远端文本选区（低透明度底 + 插入符）；静止的光标收起姓名签；头像组超过 5 人折叠为「+3」",
      editor: {
        stage: { cursor: false },
        slideOverlay: (
          <>
            <RemoteSelection person={WANG} at={CARD_POS} />
            <RemoteTextSelection person={CHEN} box={{ x: 12.8, y: 36.6, w: 12.6, h: 6.6 }} />
            <PresenceCursor person={LI} at="left-[33%] top-[63%]" />
            <PresenceCursor person={ZHANG} at="left-[52%] top-[22%]" label={false} />
          </>
        ),
        inspector: { collaborators: { people: ONLINE_SHOWN, extra: ONLINE_FOLDED } },
      },
    },
    {
      id: "presence-list",
      title: "在场 · 展开在线列表",
      note: "05 §1a：点「+3」展开在线列表：头像 + 姓名 + 角色 + 所在页，自己在最上、其余按最近编辑排序；点某人进入跟随",
      editor: {
        stage: { cursor: false },
        slideOverlay: (
          <>
            <RemoteSelection person={WANG} at={CARD_POS} />
            <RemoteTextSelection person={CHEN} box={{ x: 12.8, y: 36.6, w: 12.6, h: 6.6 }} />
            <PresenceCursor person={LI} at="left-[33%] top-[63%]" />
          </>
        ),
        inspector: { collaborators: { people: ONLINE_SHOWN, extra: ONLINE_FOLDED } },
        layers: (
          <Popover anchor="collaborators" returnFocus="collaborators-more" snap={false} side="bottom" align="start" sideOffset={8} label="在线列表">
            <PresenceList />
          </Popover>
        ),
      },
    },
    {
      id: "account-menu",
      title: "账户菜单 · 单页",
      note: "DS-18 / PRD AS-06：检查器顶行自己的头像（排在第一个、与他人隔开并带常驻外圈）点开账户菜单——头像 · 姓名 · 邮箱 ┊ 主题 浅色 / 深色 / 跟随系统 ┊ 偏好设置… ⌘, · 键盘快捷键 ⌘/ · 帮助中心 ↗ ┊ 退出登录（开始页、编辑器、文档列表三处同一份，kit accountMenuItems）；向下、与头像左缘对齐，落在检查器一侧不盖画布。「插件…」「返回首页」在主菜单。主题三项与设置「外观 › 主题」同一偏好（rulings §4.25 DS-90，出厂缺省跟随系统）；M2 不显示「个人资料…」与它下面的分隔线（DS-91，M3 起出现）；「帮助中心」集成方配置了才出现、外链图标（DS-89）（2026-10-22 按 DS-89、DS-90、DS-91 改：原为个人资料… ┊ 主题 浅色 / 深色 ┊ 偏好设置… ┊ 退出登录）；「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）",
      editor: {
        stage: { cursor: false },
        inspector: { collaborators: { people: ONLINE_SHOWN, extra: ONLINE_FOLDED }, share: SHARE_LATER },
        layers: <AccountMenuLayer />,
      },
    },
    {
      id: "remote-overwrite",
      title: "远端覆盖正在输入的字段",
      note: "02 §4.5 / 03-03：我正在改要点卡的 X（已输入 640、未提交），王小明同时把它挪到了 612——字段外圈换成王小明的身份色，节末写明谁改成了什么，并给「应用远端值 / 保留我的输入」；没有未提交输入时只短暂高亮、直接显示新值",
      editor: {
        selection: "shape",
        stage: { cursor: false },
        slideOverlay: <RemoteSelection person={WANG} at={CARD_POS} />,
        inspector: {
          sections: [
            "shape.align",
            {
              id: "main-states.geometry-remote",
              kinds: ["shape"],
              order: 10,
              component: () => <GeometrySection anchor="section-shape.geometry" value={{ x: "612", y: "232", w: "264", h: "176" }} remote={{ key: "x", by: WANG.name, tone: WANG.tone, value: "612", mine: "640" }} />,
            },
            "shape.style",
            "shape.fill",
            "shape.stroke",
            "shape.shadow",
            "shape.opacity",
            "shape.action",
          ],
        },
      },
    },
    {
      id: "account-menu-grid",
      title: "账户菜单 · 网格胶囊",
      note: "DS-18：网格视图里自己的头像在右上「协作与分享」胶囊的第一个，点开同一份账户菜单（同一组件、同一份条目，02 §7；条目同 account-menu，2026-10-22 按 rulings §4.25 DS-89、DS-90、DS-91 改）；「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）",
      editor: {
        view: "grid",
        stage: { cursor: false },
        inspector: { collaborators: { people: ONLINE_SHOWN, extra: ONLINE_FOLDED }, share: SHARE_LATER },
        layers: <AccountMenuLayer />,
      },
    },

    /* ---------------------------------------------------------------- 快速样式与「文件」菜单（rulings §4.25 DS-31 补的样张状态） */
    {
      id: "quick-styles",
      title: "选中形状 · 快速样式",
      note: "02 §4.2 / DS-31：形状检查器「填充」节上方一行快速样式——按当前主题（Office）配色画出当前样式所在强度行的 6 格 + ▾，要点卡用的「细微效果 · 强调色 1」带 2px 强调色外圈；整行是一个按钮，点按或 Enter / Space / ↓ 在本节里原位展开 42 格样式库（DS-34；PRD ED-06，M2 P1）。填充「图片」与阴影「内阴影」为 P2：留在原位、标 P2、不可用（TB-43）",
      editor: { selection: "shape", stage: { cursor: false } },
    },
    {
      id: "quick-styles-gallery",
      title: "快速样式 · 样式库",
      note: "DS-31 / DS-34 / 04 §4.1a / 07 §1.2b：样式库在「快速样式」节里、缩略行下方原位展开（DS-34，2026-10-08 改定：不再是贴检查器左缘的弹层），下方各节下移、画布不被遮挡，节标题右侧出现「收起」按钮；7 列（文字 1、强调色 1–6）× 6 行（彩色轮廓 · 彩色填充 · 浅色轮廓，彩色填充 · 细微效果 · 中等效果 · 强烈效果）共 42 格，按当前主题真实渲染、换主题后跟着变；格子按检查器内容宽度等分（宽 248 时约 30 × 21）；当前样式 2px 强调色外圈，悬停「彩色填充 · 强调色 1」时网格上方的读数行写出样式名。整组一个 Tab 位、方向键漫游，Enter / Space 或点按即应用（一个撤销步，画布、左栏与网格里的要点卡一起换样），样式库保持展开；收起按钮、再点缩略行或 Esc 收起，焦点回到缩略行",
      editor: { selection: "shape", stage: { cursor: false }, data: { quickStylesOpen: true, quickStyleHover: "fill:1" } },
    },
    {
      id: "file-menu",
      title: "主菜单 · 文件",
      note: "02 §2.3 / DS-31：主菜单「文件」——导出… · 保真报告 · 幻灯片大小…；幻灯片大小是 P2，上线前留在原位、不可用、标 P2，右侧写「后续版本提供」（与其他 P2 条目同一画法，仍可聚焦）；原 Ribbon「设计」页签的灰显入口作废",
      editor: { stage: { cursor: false }, layers: <MainMenuLayer openPath={["file"]} /> },
    },

    /* ---------------------------------------------------------------- 同步状态 */
    {
      id: "syncing",
      title: "同步中",
      note: "05 §7 / 03-12：重连成功后先同步，同步状态行「同步中 58%」；横幅「正在同步 12 项更改…」带确定态进度",
      editor: {
        rail: { status: STATUS.syncing },
        banner: (
          <Banner
            icon={<RefreshCw {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />}
            title="正在同步 12 项更改…"
            actions={
              <span className="flex items-center gap-2">
                <Progress value={58} label="同步进度" className="w-28" />
                <span className="w-7 text-[11px] leading-none text-(--v3-text-2) tabular-nums">58%</span>
              </span>
            }
          />
        ),
      },
    },
    {
      id: "reconnecting",
      title: "重连中",
      note: "05 §7 / 03-12：断线（去抖 2 秒）后同步状态行「重连中…」，横幅「正在恢复连接…」；在场信息随连接断开消失，头像组只剩自己、画布上没有远端光标；本地照常编辑",
      editor: {
        stage: { cursor: false },
        rail: { status: STATUS.reconnecting },
        banner: <Banner icon={<RefreshCw {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />} title="正在恢复连接…" />,
        inspector: { collaborators: { people: [ME] } },
      },
    },
    {
      id: "offline",
      title: "离线 · 3 项待同步",
      note: "02 §6.2 离线 / 03-12 / 05 §7：不是独立页面状态，横幅通道插入离线横幅（立即重连），同步状态行「离线 · 3 项待同步」（警告色图标）；其余区域照常可用（本地乐观编辑）",
      editor: {
        slide: 2,
        selection: "shape",
        stage: { cursor: false },
        rail: { status: STATUS.offline },
        banner: (
          <Banner tone="warning" icon={<CloudOff {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-warning)" />} title="离线" actions={<Button variant="secondary">立即重连</Button>}>
            更改已保存在本地，将在重新连接后同步
          </Banner>
        ),
        inspector: { collaborators: { people: [ME] } },
      },
    },
    {
      id: "offline-grid",
      title: "离线 · 网格视图",
      note: "02 §5.1 网格视图中的同步状态（2026-10-07 第 1 批拍板）：左上「文档」胶囊在文件名后面显示同一状态；横幅通道在网格里同样占文档流，胶囊与网格整体下移",
      editor: {
        view: "grid",
        // 底座在网格左上胶囊的文件名后面渲染 rail.status，横幅在网格里同样占文档流；在场信息随连接断开消失，右上头像组只剩自己
        rail: { status: STATUS.offline },
        inspector: { collaborators: { people: [ME] } },
        banner: (
          <Banner tone="warning" icon={<CloudOff {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-warning)" />} title="离线" actions={<Button variant="secondary">立即重连</Button>}>
            更改已保存在本地，将在重新连接后同步
          </Banner>
        ),
      },
    },

    /* ---------------------------------------------------------------- 撤销与轻提示 */
    {
      id: "undo-skipped",
      title: "撤销 · 跳过他人后写",
      note: "02 §6.2 / 05 §6：本地撤销只回退自己的操作；我改过、之后被王小明改写的属性被跳过，其余照常回退；轻提示走 ui.notification（工具条上方、可关闭、不打断输入），左侧是对方头像",
      editor: {
        slide: 2,
        selection: "shape",
        stage: { cursor: false },
        slideOverlay: <PresenceCursor person={WANG} at="left-[63%] top-[80%]" />,
        canvasOverlay: (
          <Toasts>
            <Toast icon={<Avatar name={WANG.name} tone={WANG.tone} size={20} />} onClose={noop}>
              <b className="font-semibold">王小明</b>之后修改了此处，已跳过
            </Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "undo-blocked",
      title: "撤销 · 整步被跳过",
      note: "05 §6：目标已被他人删除（不看墓碑 TTL）时整步跳过并停下，不连带撤销更早一步；警告色图标，可关闭",
      editor: {
        slide: 3,
        stage: { cursor: false },
        slideOverlay: <PresenceCursor person={WANG} at="left-[64%] top-[60%]" />,
        canvasOverlay: (
          <Toasts>
            <Toast tone="warning" onClose={noop}>
              无法撤销：此处已被<b className="font-semibold">王小明</b>删除
            </Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "perf-hint",
      title: "性能弱提示",
      note: "02 §6.2 / 02-user-flows F2：单页对象数逼近性能预算时的弱提示（原在状态栏，DS-6 起走 ui.notification），不阻断操作",
      editor: {
        slide: 5,
        canvasOverlay: (
          <Toasts>
            <Toast icon={<Gauge {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />} onClose={noop}>
              本页对象较多（326 个），编辑可能变慢
            </Toast>
          </Toasts>
        ),
      },
    },

    /* ---------------------------------------------------------------- 插件横幅 */
    {
      id: "plugin-missing",
      title: "缺少插件 · 管理员已停用",
      note: "03-09 §6.2 / 02 §6.2（平台管理员视角）：缺少插件横幅（中性底 + 警告色拼图，不阻断、role=status），按钮「查看详情」「去管理 › 插件」（普通用户没有后者）与关闭；画布元素原位占位（虚线框 + 拼图 + 一行插件名 + 一行「插件已停用，内容已保留」，与保真占位同一画法），左栏第 6 页的缩略图是同一页、带警示计数（2026-10-15 按 rulings §4.25 DS-41、DS-52 改：横幅由警告浅底改为中性底、文案与按钮不变；占位由三行改为两行）",
      editor: missingPlugin(
        "插件已停用",
        <PluginBanner
          kind="missing"
          title="本文档用到了「二维码形状」，管理员已停用该插件"
          actions={
            <>
              <Button variant="secondary">查看详情</Button>
              <Button variant="secondary">去管理 › 插件</Button>
            </>
          }
          onClose={noop}
          closeLabel="关闭提示"
        >
          {PLACEHOLDER_NOTE}
        </PluginBanner>,
      ),
    },
    {
      id: "plugin-missing-undeclared",
      title: "缺少插件 · 本部署没有",
      note: "03-09 §6.2：插件未声明或被拒，标题写插件 id 与所需版本；占位原因「本部署未部署，内容已保留」（2026-10-15 按 rulings §4.25 DS-41、DS-52 改：横幅中性底 + 警告色拼图、文案与按钮不变；占位两行，同 plugin-missing）",
      editor: missingPlugin(
        "本部署未部署",
        <PluginBanner kind="missing" actions={<Button variant="secondary">查看详情</Button>} onClose={noop} closeLabel="关闭提示">
          <span className="mr-2 font-semibold">本文档用到了本部署没有的插件 {id("acme:qr-shape")}（≥ 1.2）</span>
          {PLACEHOLDER_NOTE}
        </PluginBanner>,
      ),
    },
    {
      id: "plugin-missing-version",
      title: "缺少插件 · 版本过旧",
      note: "03-09 §6.2：本部署的版本低于文档所需；占位原因「需要 ≥ 1.2，内容已保留」（2026-10-15 按 rulings §4.25 DS-41、DS-52 改：横幅中性底 + 警告色拼图、文案与按钮不变；占位两行，同 plugin-missing）",
      editor: missingPlugin(
        "需要 ≥ 1.2",
        <PluginBanner kind="missing" title="「二维码形状」版本过旧：需要 ≥ 1.2，当前 1.0" actions={<Button variant="secondary">查看详情</Button>} onClose={noop} closeLabel="关闭提示">
          {PLACEHOLDER_NOTE}
        </PluginBanner>,
      ),
    },
    {
      id: "plugin-settings",
      title: "插件设置已更新",
      note: "03-09 §6.1 / 02 §6.2：管理员保存插件策略后 60 秒内出现，信息横幅（刷新图标）；「重新加载」先保存未同步的更改再刷新，「×」即稍后再说，不打断编辑",
      editor: {
        banner: (
          <Banner
            icon={<RefreshCw {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />}
            title="管理员更新了插件设置，重新加载后生效"
            actions={<Button variant="secondary">重新加载</Button>}
            onClose={noop}
            closeLabel="稍后再说"
          >
            未同步的更改会先保存再刷新；你可以先继续编辑，稍后再重新加载
          </Banner>
        ),
      },
    },
    {
      id: "plugin-failed",
      title: "插件启动失败",
      note: "02 §6.2（取代原状态栏的「N 个插件启动失败」入口，DS-6）：插件启动失败横幅（中性底 + 危险色图标）「查看详情」打开个人插件面板；插件横幅一律非阻断，这一条同样是 role=status（不抢焦点、polite 播报）；两个插件失败，标题写数量「2 个插件启动失败」、说明行列出插件名（只有一个时写「插件「X」未能启动」，DS-55）；没有失败、没有缺插件时界面上不显示任何插件状态；横幅 × 的读屏名是「关闭提示」（03-12 §2.6 可关闭横幅的口径，同缺少插件横幅，画面不变）（2026-10-15 按 rulings §4.25 DS-41 改：横幅由危险浅底改为中性底、文案与按钮不变）",
      editor: {
        banner: (
          // 不阻断的插件横幅：kit PluginBanner（中性底 + 危险色图标、role=status），与第 2 批 plugins 场景同一个件；标题与说明行按 DS-55（kit failedPluginsCopy）
          // × 的读屏名「关闭提示」（03-12 §2.6 可关闭横幅的口径，同缺少插件横幅；kit Banner 缺省「关闭横幅」），只改读屏名、画面不变
          <PluginBanner kind="failed" title={FAILED.title} actions={<Button variant="secondary">查看详情</Button>} onClose={noop} closeLabel="关闭提示">
            {FAILED.names}
            {FAILED.text}
          </PluginBanner>
        ),
      },
    },
  ],
})
