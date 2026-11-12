import { useContext, useRef, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronDown, LayoutGrid, Lock, Play, RectangleHorizontal, Shield } from "lucide-react"
import { DropdownMenu as DM } from "radix-ui"
import { cn } from "@/lib/utils"
import { DOC_TITLE, LI, ME, WANG, type Person } from "../data"
import { useRunCommand, type EditorCommand } from "../kit/commands"
import { FOLLOW_KEY } from "../kit/Follow"
import { keepMovedFocus, useDemoOpen, useFocusBackOnClose } from "../kit/layer"
import { mainMenuItems, UNAVAILABLE_IN_MASTER, ZOOM_COMMANDS, type MainMenuOptions } from "../kit/mainMenu"
import { Menu, MenuItems, type MenuSpec } from "../kit/Menu"
import { goToState } from "../kit/nav"
import { Popover } from "../kit/Popover"
import { useV3Params, v3Href, type V3View } from "../params"
import { LogoMark } from "../shape-icons"
import { useSceneState, type SetSceneState } from "../kit/scene"
import { Avatar, Button, ICON, IconButton, MENU_CONTENT, reasonTip, Tip, V3Menu, withReason, type MenuEntry, type Tone } from "../ui"
import { V3RootContext } from "../V3Root"
import { useEditorMaybe } from "./context"
import { getToolLayer } from "./insert-menus"
import { masterMenuOption } from "./master/mode"

/**
 * 编辑器外框的共用小件：单页视图里长在左栏 / 检查器上，网格视图里搬进画布左上 / 右上的浮动胶囊。
 * 两处用同一个组件，切换视图时控件长相不变、状态只有一份。
 * 账户菜单（AccountMenu）另给首页左栏底部的用户行用（AS-06：各路由共用同一份账户菜单）。
 */

/**
 * 文档菜单（文件名 ▾）。DS-19：「移动到…」没有对应能力（PRD 没有文件夹 / 位置概念），从样张删除。
 * 条目随权限（02 §6.2）：能编辑（编辑模式，或有编辑权限的人进了评审模式）= 重命名 · 创建副本 ┊ 版本历史。
 * 评审者（commenter）与查看者（viewer）没有任何条目（rulings §4.25 DS-82：按 U-09，duplicate 要 doc.export，评审者与查看者没有「创建副本」；
 * 改名要编辑权限、版本历史要 history.read），文件名不再是菜单触发器——只显示文件名（见 DocMenu）。
 * 编辑模式已降权（degraded，03-12 readonly-degraded）：会话还在编辑界面里，条目留在原位——「重命名」「创建副本」「版本历史」三项都不可用并写原因（不隐藏、仍可聚焦），
 * 与「文件 › 导出…」同一规则（rulings §4.25 TB-138：按 §4.12 U-09 创建副本要 doc.export，降权后已没有，同 DS-105），也与主菜单、缩略图右键里改文档的命令一致；
 * 「创建副本」一项推翻了第 1 批拍板时的样张修正「降权时创建副本照常」，用户 2026-10-22 确认（DS-139）。未保存的更改仍从降权横幅「导出为本地副本」带走。
 * 登录已过期、隔离态等暂时不能编辑的状态（offline-conflict 的 paused()）经同一个 readonlyDegraded 走这一支，原因写各自的那一句。
 * 母版视图里（inMaster）「版本历史」留在原位、不可用，写「母版视图下不可用」：它打开的是普通视图的整栏面板，母版检查器不设历史页签（rulings §4.25 DS-157）；
 * 同时又被降权时这一项也写这句、其余两项仍写降权的原因（TB-200、TB-203）。「重命名」「创建副本」不受母版视图影响。
 */
function docMenuEntries(mode: "edit" | "review" | "viewer" = "edit", canEdit = true, degraded?: string, inMaster = false): MenuEntry[] {
  const historyInMaster: MenuEntry | null = inMaster ? { value: "history", label: "版本历史", disabled: true, reason: UNAVAILABLE_IN_MASTER } : null
  if (degraded && mode === "edit")
    return [
      { value: "rename", label: "重命名", disabled: true, reason: degraded },
      { value: "copy", label: "创建副本", disabled: true, reason: degraded },
      { kind: "separator" },
      historyInMaster ?? { value: "history", label: "版本历史", disabled: true, reason: degraded },
    ]
  const editor = mode === "edit" || (mode === "review" && canEdit)
  if (!editor) return []
  return [
    { value: "rename", label: "重命名" },
    { value: "copy", label: "创建副本" },
    { kind: "separator" },
    historyInMaster ?? { value: "history", label: "版本历史" },
  ]
}

/** 触发器打开时的按下态（Radix 自己打开：data-state=open；场景里锚定打开的 kit 浮层：data-v3-open） */
const TRIGGER_OPEN = "data-[state=open]:bg-(--v3-panel-2) data-[state=open]:text-(--v3-text) data-[v3-open]:bg-(--v3-panel-2) data-[v3-open]:text-(--v3-text)"

/* ------------------------------------------------------------------ 主菜单 */

/**
 * 主菜单：logo 方标 + ▾。条目是统一的一份（kit/mainMenu.tsx mainMenuItems，场景里静态打开的 MainMenuLayer 同一份）：
 * 返回首页 ┊ 文件 · 编辑 · 视图 · 插入 · 排列 ┊ 插件… ┊ 帮助（DS-18；替换 ⇧⌘H、链接 ⇧⌘K，DS-16 / DS-11）。
 * 「视图」子菜单里的单页 / 网格与左栏顶部、网格左上胶囊的切换按钮读写同一个 URL 参数 view；备注开关在网格视图置灰并写明原因
 * （单页里的开关值不变，回单页后原样恢复）；母版视图 ⌥⌘M 与模式（编辑 / 评审）也在这里。
 * 「返回首页」回到 #/v3/home（沿用当前 theme / accent）。
 * options 定制模式、母版视图与各子菜单（场景经 EditorConfig.rail.menu 传入）。
 */
export function MainMenu({
  view,
  onView,
  notes,
  onNotes,
  options,
  className,
}: {
  view: V3View
  /** 选了另一种视图：菜单所在的左栏或胶囊会随视图卸载，焦点交给新视图里的切换按钮（同左栏 / 胶囊入口） */
  onView: (v: V3View) => void
  notes: boolean
  onNotes: (v: boolean) => void
  options?: Partial<MainMenuOptions>
  className?: string
}) {
  const root = useContext(V3RootContext)
  const navigate = useNavigate()
  const run = useRunCommand()
  const { theme, accent, embedded } = useV3Params()
  // 「插件…」「文件 › 导出… / 保真报告」缺省发底座命令（kit/commands.ts），由场景登记的处理函数接住；options 显式传了回调时以传入的为准
  // 「视图 › 模式」：同一状态里切换编辑 / 评审（rulings §4.25 TB-83，EditorCtx.setMode）；options 显式传了 onMode 时以传入的为准
  const ed = useEditorMaybe()
  const items = mainMenuItems({
    view,
    onView,
    notes,
    onNotes,
    onMode: ed?.setMode,
    // 「返回首页」先发底座命令 home：场景接住时（有未同步更改，先弹离开确认）不跳转，没有接住时照旧回首页
    onHome: () => {
      if (!run("home")) navigate(v3Href("/v3/home", { theme, accent }))
    },
    onPlugins: () => void run("plugins"),
    onExport: () => void run("file.export"),
    onFidelity: () => void run("file.fidelity"),
    // 「帮助 › 命令面板… / 键盘快捷键」发底座命令（第 3 批转正，kitRequest g4 K2）：场景接住，或转到演示它的样张（provides）
    onCommandPalette: () => void run("help.command-palette"),
    onShortcuts: () => void run("help.shortcuts"),
    // 嵌入形态 E（iframe 里，URL 带 embedded=1）不渲染「返回首页」：没有首页可回（DS-19；rulings §4.25 DS-112）。不在嵌入里时条目不变
    ...(embedded ? { home: false } : null),
    ...options,
    // 「视图 › 母版视图」缺省接宿主（2026-10-28，母版视图改版第一步）：可进入时进入、不可进入时写原因，母版视图里是「关闭母版视图」；
    // 原因以宿主的 entry 为准（与 ⌥⌘M、命令面板同一条），显式传的 options.master 只补宿主没给的字段（editor/master/mode.ts masterMenuOption，2026-10-29 修复第 4 轮）
    master: masterMenuOption(ed?.masterView, options?.master),
  })
  // 关闭时焦点不在 body 停一帧：菜单内容卸载的同一个任务末尾就交回主菜单按钮（kit useFocusBackOnClose）；焦点已被选中项打开的面板接走时不动（holdFocusDuring / keepMovedFocus 照旧）
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  useFocusBackOnClose(open, () => triggerRef.current)
  return (
    <DM.Root open={open} onOpenChange={setOpen}>
      <DM.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label="主菜单"
          data-v3-anchor="main-menu"
          className={cn("flex h-7 items-center gap-1 rounded-[6px] px-1.5 text-(--v3-text-2) transition-colors hover:bg-(--v3-panel-2) hover:text-(--v3-text)", TRIGGER_OPEN, className)}
        >
          <LogoMark className="size-5" />
          <ChevronDown {...ICON} />
        </button>
      </DM.Trigger>
      <DM.Portal container={root ?? undefined}>
        {/* 选了某项后焦点已被新打开的面板接走（如「插件…」打开的整栏面板）时，关闭不再把焦点抢回触发按钮（kit/layer keepMovedFocus） */}
        <DM.Content align="start" sideOffset={4} collisionPadding={8} onCloseAutoFocus={keepMovedFocus} className={MENU_CONTENT}>
          <MenuItems items={items} />
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  )
}

/**
 * 文档标题 + ▾（13px 600），点开是文档菜单（条目随 mode / canEdit / degraded，见 docMenuEntries）。
 * 选了某项发底座命令 doc.rename / doc.copy / doc.history（kit/commands.ts）：版本历史场景接住「版本历史」打开整栏面板；没有登记时只关菜单。
 * 评审者与查看者（没有任何条目，DS-82）：文件名不再是菜单触发器——只显示文件名（13px 600，没有 ▾、不响应悬停与点按、不进 Tab 顺序，读屏照常读到），
 * 位置与编辑者的文件名相同（同一块 28 高、左右 6 的字框，锚点 doc-menu 照旧）；编辑者在评审模式下不变。
 * 母版视图里（母版窗格沿用左栏顶部，同一个文档菜单）「版本历史」留在原位、不可用（DS-157，见 docMenuEntries）。
 */
export function DocMenu({ className, mode, canEdit, degraded }: { className?: string; mode?: "edit" | "review" | "viewer"; canEdit?: boolean; degraded?: string }) {
  const run = useRunCommand()
  const inMaster = !!useEditorMaybe()?.masterView.on
  const entries = docMenuEntries(mode, canEdit, degraded, inMaster)
  if (!entries.length)
    return (
      <div data-v3-anchor="doc-menu" className={cn("flex h-7 max-w-full items-center px-1.5 text-[13px] leading-none font-semibold", className)}>
        <span className="truncate">{DOC_TITLE}</span>
      </div>
    )
  return (
    <V3Menu
      entries={entries}
      onSelect={(v) => void run(`doc.${v}` as EditorCommand)}
      // 文档菜单单独贴住文件名下沿（sideOffset 0，其余菜单仍是 4）：左栏里文件名下面紧挨着同步状态行，离开 4 会切在那一行字的半中间；
      // 贴住后整行盖住（第 2 批标杆对照，质量门 Q7）。场景里静态打开的文档菜单（version-history DocMenuLayer）同一处
      sideOffset={0}
      trigger={
        <button
          type="button"
          data-v3-anchor="doc-menu"
          className={cn(
            "flex h-7 max-w-full items-center gap-1 rounded-[6px] px-1.5 text-[13px] leading-none font-semibold transition-colors hover:bg-(--v3-panel-2) data-[state=open]:bg-(--v3-panel-2) data-[v3-open]:bg-(--v3-panel-2)",
            className,
          )}
        >
          <span className="truncate">{DOC_TITLE}</span>
          <ChevronDown {...ICON} className="shrink-0 text-(--v3-text-2)" />
        </button>
      }
    />
  )
}

/**
 * 单页 / 网格切换（rulings §4.25 DS-133，TB-58 第一项采用「改分段画法」）：与检查器分段控件同一画法（kit Segmented）——28 高的槽铺 panel-2、不描边，
 * 选中块是面板色 + 与分隔线同档的细边、贴边、圆角 4（TB-55），图标描边 2（v3-on-cue）；两项各 28 × 28、间距 0（左栏顶行由 52 变 56，网格胶囊由 60 变 56）。
 * 仍是两个按钮（「视图」组里两个 aria-pressed 按钮）、读屏名、工具提示「单页 / 网格」与切换后的焦点交接不变；读写的都是 URL 参数 view。
 * 两处切换按钮各自随所在视图卸载：从一处切过去后，另一处挂载时把焦点放到当前视图的按钮上（autoFocus），焦点不会掉到 body。
 * reason：暂不可用（如打开中），两个按钮都 aria-disabled、文字退到 text-3，工具提示写原因；选中块保留、图标 text-2（同 Segmented 整组不可用：看得出当前值）。
 * size 参数已不再区分（两处都是 28），保留只为兼容调用处。
 */
export function ViewToggle({
  view,
  onView,
  tipSide,
  autoFocus = false,
  reason,
  className,
}: {
  view: V3View
  onView: (v: V3View) => void
  size?: 24 | 28
  tipSide?: "top" | "bottom"
  /** 挂载时聚焦当前视图的按钮（只在由另一处切换按钮切过来时为 true） */
  autoFocus?: boolean
  /** 不可用原因 */
  reason?: string
  className?: string
}) {
  const off = !!reason
  const item = (v: V3View, label: string, icon: ReactNode) => {
    const on = view === v
    // 整组不可用时的选中项：选中块保留、图标 text-2（同 Segmented）；仍是 aria-disabled、可聚焦，读屏名与工具提示写原因，点了无效
    if (on && off)
      return (
        <IconButton
          label={withReason(label, reason)}
          tip={reasonTip(label, reason!)}
          size={28}
          tipSide={tipSide}
          variant="on"
          pressed
          aria-disabled="true"
          autoFocus={autoFocus}
          onClick={(e) => e.preventDefault()}
          className="cursor-default rounded-(--v3-seg-on-radius) bg-(--v3-seg-on) text-(--v3-text-2) ring-(--v3-seg-on-line)"
        >
          {icon}
        </IconButton>
      )
    return (
      <IconButton
        label={label}
        size={28}
        tipSide={tipSide}
        variant={on ? "on" : "ghost"}
        pressed={on}
        autoFocus={autoFocus && on}
        disabled={off}
        reason={reason}
        onClick={() => onView(v)}
        // 分段的选中块（Segmented 的 SEG_ON：面板色 + 细边、贴边、圆角 4）
        className={cn("rounded-(--v3-seg-on-radius)", on && "bg-(--v3-seg-on) ring-(--v3-seg-on-line)")}
      >
        {icon}
      </IconButton>
    )
  }
  return (
    <div className={cn("flex items-center rounded-[4px] bg-(--v3-seg-track)", className)} role="group" aria-label="视图" data-v3-anchor="view-toggle">
      {item("single", "单页", <RectangleHorizontal {...ICON} />)}
      {item("grid", "网格", <LayoutGrid {...ICON} />)}
    </div>
  )
}

/* ------------------------------------------------------------------ 账户菜单 */

/** 示例账户的邮箱：账户菜单头部写「姓名与邮箱」（AS-06），data.ts 只有姓名。 */
export const ME_EMAIL = "zhou.mingyuan@example.com"

const hashParams = () => new URLSearchParams(window.location.hash.split("?")[1] ?? "")

/** 只改 URL 的 theme（样张的主题就是这个参数，V3Root 读它）；replace，不新增历史记录 */
function setThemeParam(t: "light" | "dark") {
  const [path] = window.location.hash.slice(1).split("?")
  const q = hashParams()
  q.set("theme", t)
  window.location.replace(`#${path}?${q.toString()}`)
}

/** 主题偏好：浅色 / 深色 / 跟随系统（跟随系统按 prefers-color-scheme 取当前生效的一套） */
export function applyThemePref(v: string) {
  if (v === "system") setThemeParam(window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  else setThemeParam(v === "light" ? "light" : "dark")
}

const currentTheme = () => (hashParams().get("theme") === "light" ? "light" : "dark")

/** 账户菜单头部：头像 + 姓名 + 邮箱，只是标识、不可聚焦（头像一律身份色首字，rulings §4.25 TB-123）。 */
function AccountHead() {
  return (
    <div className="flex items-center gap-2 px-2 pt-1 pb-1.5 select-none">
      <Avatar name={ME.name} tone={ME.tone} />
      <div className="min-w-0">
        <p className="truncate text-[12px] leading-4 font-semibold text-(--v3-text)">{ME.name}</p>
        <p className="truncate text-[12px] leading-4 text-(--v3-text-2)">{ME_EMAIL}</p>
      </div>
    </div>
  )
}

export interface AccountMenuOptions {
  /** 里程碑：M2（缺省：不显示「个人资料…」，没有「管理」）· M3 */
  milestone?: "M2" | "M3"
  /** 平台管理员（M3 起多「管理」） */
  admin?: boolean
  /** 主题项：3（缺省，DS-90）· 2（DS-90 未采纳的备选：浅色 / 深色，显示当前生效的一套） */
  themes?: 2 | 3
  /** 主题偏好的当前值（3 项时；缺省跟随系统 = 出厂缺省） */
  themePref?: "light" | "dark" | "system"
  /** 选了另一项主题偏好（缺省只换 URL 的 theme） */
  onThemePref?: (v: "light" | "dark" | "system") => void
  /**
   * 「个人资料…」：auto（缺省，rulings §4.25 DS-91 采纳的备选：M2 不显示它与它下面的分隔线，M3 起显示、打开个人资料对话框）·
   * hidden 一律不显示 · disabled（DS-91 未采纳的推荐：M2 留在原位、不可用并标 M3，FE-06）
   */
  profile?: "auto" | "hidden" | "disabled"
  /** 集成方配置了帮助中心链接（缺省 true；DS-89：没配置时这一项不出现、也不占位） */
  help?: boolean
  /**
   * 嵌入、集成方没配置登出（PRD AS-06、FE-06：「退出登录」留在原位、不可用，写「由宿主应用管理登录」）；缺省取 URL 的 embedded。
   * iframe 嵌入（形态 E）按宿主在 cordex:init 的 intents 里声明的壳意图（rulings §4.25 TB-145）：声明了 sign-out 才可用并发 cordex:intent，没声明时就是这一态；
   * 样张的嵌入都按「没声明」画（「返回首页」同理：声明了 navigate-back 才渲染，DS-112）
   */
  embedded?: boolean
  /** 触控形态（手机与平板）：菜单项不写键位提示——「偏好设置…」不写「⌘,」、「键盘快捷键」不写「⌘/」（rulings §4.25 TB-164，细化 TB-154；与手机搜索框不写 ⌘K 一致） */
  touch?: boolean
  /** 集成方锁定了主题（嵌入，03-23「集成方锁定态」）：三项不可用、勾着宿主定的那一套，组顶一行锁形 +「由宿主应用设置」 */
  themeLocked?: boolean
  /** 选了「个人资料…」（M3）：缺省转到 account-menu.profile-dialog（开始页宿主） */
  onProfile?: () => void
  /** 「偏好设置… ⌘,」：缺省发底座命令 account.preferences */
  onPreferences?: () => void
  /** 「键盘快捷键 ⌘/」：缺省发底座命令 help.shortcuts */
  onShortcuts?: () => void
  /** 「退出登录」：缺省发底座命令 account.logout */
  onLogout?: () => void
}

const SEP: MenuSpec = { type: "separator" }

/**
 * 账户菜单的条目（PRD AS-06；开始页左栏用户行、编辑器右上自己的头像、文档列表三处同一份，DS-18）——第 3 批转正（2026-10-22）时由 scenarios/account-menu/items.tsx 的 accountItems 并入：
 *   头像 · 姓名 · 邮箱（不可聚焦）┊ [M3：个人资料… ┊] 主题：浅色 / 深色 / 跟随系统 ┊ 偏好设置… ⌘, · 键盘快捷键 ⌘/ ·（仅平台管理员）管理 · 帮助中心 ↗ ┊ 退出登录
 * - DS-90：主题三项单选「浅色 / 深色 / 跟随系统」，与设置「外观 › 主题」同一偏好、同一组取值与顺序（出厂缺省跟随系统，03-23）；选了菜单不关、立即换肤（kit Menu 单选缺省不关）；
 * - DS-91（采纳备选）：M2 不显示「个人资料…」与它下面的分隔线，菜单从头部直接到主题；M3 起显示、打开个人资料对话框（显示名可改、邮箱与头像只读，TB-123）；
 * - 「管理」只对 platformRole='admin'（M3，PM-01 / PM-06）：盾牌图标 + 右侧弱化小字「插件」，点了进 /admin/plugins；普通成员不显示、也不占位（03-32 §1）；
 * - DS-89：「帮助中心」集成方配置了才出现，新标签页打开、带外链图标（kit Menu external）；「键盘快捷键 ⌘/」始终在；
 * - 嵌入且集成方没配置登出（iframe 嵌入：cordex:init 的 intents 没声明 sign-out，TB-145）时，「退出登录」留在原位、不可用，写「由宿主应用管理登录」（AS-06、FE-06）；
 * - 触控形态（手机与平板，options.touch）菜单项不写键位提示（TB-154、TB-164）；
 * - 集成方锁定了主题：三项留在原位、不可用，勾着宿主定的那一项，组顶一行 12px 锁形 +「由宿主应用设置」（FE-06、TB-22：同一原因写一行、三项共用，读屏经 aria-describedby 念到）。
 * 分组沿用已拍板的分隔（DS-18：个人资料 ┊ 主题 ┊ 设置一组 ┊ 退出），新增的三项并入「偏好设置」那一组，不再加分隔线。
 * 「偏好设置…」「键盘快捷键」「退出登录」缺省发底座命令（kit/commands.ts：account.preferences / help.shortcuts / account.logout），场景接住或转到演示它的样张。
 */
export function accountMenuItems(o: AccountMenuOptions = {}, run?: (id: EditorCommand) => boolean): MenuSpec[] {
  const m3 = o.milestone === "M3"
  const admin = !!o.admin && m3
  const embedded = o.embedded ?? hashParams().get("embedded") === "1"
  const items: MenuSpec[] = [{ type: "custom", id: "account-head", render: <AccountHead /> }, SEP]
  const profile = o.profile ?? "auto"
  if (profile === "disabled" && !m3) {
    items.push({ id: "profile", label: "个人资料…", tag: "M3", disabled: true, reason: "后续版本提供" }, SEP)
  } else if (profile !== "hidden" && m3) {
    items.push({ id: "profile", label: "个人资料…", onSelect: o.onProfile ?? (() => goToState("home", "account-menu.profile-dialog", {}, { carry: true, entry: "account" })) }, SEP)
  }
  items.push({ type: "label", label: "主题" })
  if (o.themeLocked) {
    // 锁定：同一原因一行（说明行带 id：kit Menu 让不可用、没写原因的项 aria-describedby 指向它），三项不可用，勾着宿主定的那一套
    items.push({
      type: "note",
      id: "account.theme-locked",
      text: (
        <span className="inline-flex items-center gap-1">
          <Lock size={12} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
          由宿主应用设置
        </span>
      ),
    })
    items.push({
      type: "radio",
      id: "theme",
      label: "主题",
      get value() {
        return currentTheme()
      },
      options: [
        { value: "light", label: "浅色", disabled: true },
        { value: "dark", label: "深色", disabled: true },
        { value: "system", label: "跟随系统", disabled: true },
      ],
    })
  } else if (o.themes === 2) {
    // DS-90 未采纳的备选：两项，显示当前实际生效的一套（值在菜单打开时从 URL 取）
    items.push({
      type: "radio",
      id: "theme",
      label: "主题",
      get value() {
        return currentTheme()
      },
      onValueChange: (v) => setThemeParam(v === "light" ? "light" : "dark"),
      options: [
        { value: "light", label: "浅色" },
        { value: "dark", label: "深色" },
      ],
    })
  } else {
    items.push({
      type: "radio",
      id: "theme",
      label: "主题",
      value: o.themePref ?? "system",
      onValueChange: (v) => {
        const pref = v === "light" || v === "dark" ? v : "system"
        if (o.onThemePref) o.onThemePref(pref)
        else applyThemePref(pref)
      },
      options: [
        { value: "light", label: "浅色" },
        { value: "dark", label: "深色" },
        { value: "system", label: "跟随系统" },
      ],
    })
  }
  items.push(SEP)
  items.push({ id: "preferences", label: "偏好设置…", kbd: o.touch ? undefined : "⌘,", onSelect: o.onPreferences ?? (() => void run?.("account.preferences")) })
  items.push({ id: "shortcuts", label: "键盘快捷键", kbd: o.touch ? undefined : "⌘/", onSelect: o.onShortcuts ?? (() => void run?.("help.shortcuts")) })
  if (admin) items.push({ id: "admin", label: "管理", hint: "插件", icon: <Shield {...ICON} />, onSelect: () => goToState("admin/plugins", "admin-plugins.default", {}, { carry: true, entry: "account" }) })
  if (o.help !== false) items.push({ id: "help-center", label: "帮助中心", external: true })
  items.push(SEP)
  items.push(embedded ? { id: "logout", label: "退出登录", disabled: true, reason: "由宿主应用管理登录" } : { id: "logout", label: "退出登录", onSelect: o.onLogout ?? (() => void run?.("account.logout")) })
  return items
}

/** 主题偏好（账户菜单与设置「外观 › 主题」同一偏好，DS-90）：本次挂载里记住选过的一项（出厂缺省跟随系统）；换主题不重新挂载，所以菜单再打开时勾着刚选的那一项 */
const THEME_PREF_KEY = "v3.account.theme-pref"

/**
 * 缺省的账户菜单条目（三处同一份）：主题偏好记在场景仓，三个命令经底座发出。
 * options：按角色 / 里程碑 / 嵌入增减（同 accountMenuItems 的参数，如 { milestone: "M3", admin: true }）——三个命令照样经底座发出，不必在场景里自己接
 */
function useDefaultAccountItems(options?: AccountMenuOptions): MenuSpec[] {
  const run = useRunCommand()
  const [pref, setPref] = useSceneState<"light" | "dark" | "system">(THEME_PREF_KEY, options?.themePref ?? "system")
  return accountMenuItems(
    {
      ...options,
      themePref: pref,
      onThemePref: (v) => {
        setPref(v)
        if (options?.onThemePref) options.onThemePref(v)
        else applyThemePref(v)
      },
    },
    run,
  )
}

/**
 * 账户菜单（DS-18 / AS-06）：编辑器右上「自己」的头像（检查器顶行、网格右上胶囊：向下、与头像左缘对齐，菜单落在右栏一侧、不盖画布），
 * 首页左栏底部的用户行（向上、左对齐）。trigger 是一个可聚焦的按钮（菜单触发器不带工具提示，读屏名写在按钮的 aria-label 上）。
 */
export function AccountMenu({
  trigger,
  side = "bottom",
  align = "start",
  defaultOpen,
  items,
  options,
}: {
  trigger: ReactNode
  side?: "top" | "bottom"
  align?: "start" | "end"
  /** 场景状态里一出现就打开（如开始页用户行的账户菜单，第 3 批 account-menu） */
  defaultOpen?: boolean
  /** 换掉条目（缺省 accountMenuItems 的 M2 普通成员：开始页、编辑器、文档列表三处同一份）；整份自己给时用 */
  items?: MenuSpec[]
  /** 按角色 / 里程碑 / 嵌入增减缺省条目（accountMenuItems 的参数，如 { milestone: "M3", admin: true }）：命令照样经底座发出。给了 items 时不看它 */
  options?: AccountMenuOptions
}) {
  const fallback = useDefaultAccountItems(options)
  return <Menu trigger={trigger} side={side} align={align} defaultOpen={defaultOpen} label="账户" className="min-w-[220px]" items={items ?? fallback} />
}

/** 场景状态里静态打开的账户菜单：锚在自己的头像（account）上，向下、与头像左缘对齐（与点头像打开的同一份条目、同一位置）。items / options 同 AccountMenu */
export function AccountMenuLayer({ items, options }: { items?: MenuSpec[]; options?: AccountMenuOptions } = {}) {
  const fallback = useDefaultAccountItems(options)
  return <Menu anchor="account" side="bottom" align="start" sideOffset={4} label="账户" className="min-w-[220px]" items={items ?? fallback} />
}

/* ------------------------------------------------------------------ 协作者与缩放 */

/**
 * 头像组里的人（PRD CO-03）：Person 之外可带同色序号（rulings §4.25 DS-132：第 13 位起复用身份色时「同色第 N 位」，kit AvatarBadge 挂在头像下沿中线）、
 * 头像角标（定位好的任意节点，seq 不够用时）与读屏名；follow 换掉缺省的跟随设置（见 PresenceFollow）。都不带时就是 Person
 */
export interface PresencePerson extends Person {
  seq?: number
  badge?: ReactNode
  label?: string
  /** 他人头像的跟随按钮用哪个场景状态键（缺省 kit FOLLOW_KEY，初值取 inspector.collaborators.following），见 PresenceFollow */
  follow?: PresenceFollow
}

/**
 * 编辑器里的跟随（05 §4，PRD CO-03 M3；rulings §4.25 DS-106「先跟随再放映」：先点主讲人头像进入跟随）——第 3 批转正起他人的头像缺省就是这颗按钮：
 * 「跟随 〈姓名〉」（aria-pressed），点按进入跟随、再点停止；跟随中这枚头像外圈 2px 换成对方身份色（与画布四周的跟随外框同色，身份色只标「谁」，Q3）、
 * 叠到相邻头像之上，工具提示「停止跟随 〈姓名〉」（没在跟随时「跟随 〈姓名〉」）。跟随条与画布外框是底座常驻的 kit EditorFollow（Editor.tsx），读同一个键。
 * key：场景状态键，值为正在跟随的人的姓名（null 为没在跟随）——跟随条与画布外框读同一个键；init：它的初值（同一键各处传同一个值，kit useSceneState）；
 * demoTip：一出现就展开这枚头像的工具提示（用户第一次点按或按键后收起，kit useDemoOpen）。
 * 母版视图里「跟随」留在原位、不可用（rulings §4.25 DS-157、DS-177）：进入时宿主已停止跟随（DS-167），母版视图里不能再开始跟随，见 useFollowOffReason。
 */
export interface PresenceFollow {
  key: string
  init: string | null
  demoTip?: boolean
}

/**
 * 「跟随」这一刻不可用的原因：母版视图里是「母版视图下不可用」（rulings §4.25 DS-157、DS-177、TB-203），否则 undefined（不在编辑器里同样 undefined）。
 * 检查器协作行他人的头像（FollowAvatar）与「+N」在线列表各行（main-states PresenceList、presence-scale PresenceRoster）读同一处：
 * 外观不变（身份色不变灰，只去掉悬停时的外圈或底色）；aria-disabled，读屏名在原来的后面加「（母版视图下不可用）」，工具提示「跟随 〈姓名〉 · 母版视图下不可用」，点了不跟随
 */
export function useFollowOffReason(): string | undefined {
  return useEditorMaybe()?.masterView.on ? UNAVAILABLE_IN_MASTER : undefined
}

/** 跟随中那枚头像的 2px 身份色外圈 */
const FOLLOW_RING: Record<Tone, string> = {
  slate: "ring-(--v3-tone-slate)",
  sand: "ring-(--v3-tone-sand)",
  sage: "ring-(--v3-tone-sage)",
  clay: "ring-(--v3-tone-clay)",
  mist: "ring-(--v3-tone-mist)",
  olive: "ring-(--v3-tone-olive)",
  iris: "ring-(--v3-tone-iris)",
  lake: "ring-(--v3-tone-lake)",
  rose: "ring-(--v3-tone-rose)",
  denim: "ring-(--v3-tone-denim)",
  plum: "ring-(--v3-tone-plum)",
  moss: "ring-(--v3-tone-moss)",
}

/**
 * 他人头像的跟随按钮（PresencePerson.follow）：外观同头像本身，跟随中加 2px 身份色外圈（外圈与头像之间留 1px 面板色），悬停时外圈 2px text-2（同自己头像的悬停）。
 * 母版视图里不可用（useFollowOffReason，rulings §4.25 DS-177）：头像外观不变、只去掉悬停外圈，aria-disabled，读屏名「跟随 〈姓名〉（母版视图下不可用）」，
 * 工具提示「跟随 〈姓名〉 · 母版视图下不可用」，点了不跟随；母版视图里也不画跟随中的外圈（跟随条与画布外框同样不画，kit EditorFollow）
 */
function FollowAvatar({ p, follow, className }: { p: PresencePerson; follow: PresenceFollow; className?: string }) {
  const [who, setWho] = useSceneState<string | null>(follow.key, follow.init)
  const off = useFollowOffReason()
  const on = !off && who === p.name
  const demo = useDemoOpen(!!follow.demoTip)
  const label = `跟随 ${p.name}`
  return (
    <Tip label={off ? reasonTip(label, off) : on ? `停止跟随 ${p.name}` : label} side="bottom" open={demo}>
      <button
        type="button"
        aria-label={withReason(label, off)}
        aria-pressed={on}
        aria-disabled={off ? true : undefined}
        onClick={(e) => {
          if (off) {
            e.preventDefault()
            return
          }
          setWho(on ? null : p.name)
        }}
        className={cn(
          "relative flex shrink-0 rounded-full ring-offset-1 ring-offset-(--v3-panel) transition-shadow focus-visible:z-10",
          on ? cn("z-[1] ring-2", FOLLOW_RING[p.tone]) : !off && "hover:z-[1] hover:ring-2 hover:ring-(--v3-text-2)",
          className,
        )}
      >
        <Avatar name={p.name} tone={p.tone} ring="panel" badge={p.badge} label={p.label} seq={p.seq} seqAt="group" />
      </button>
    </Tip>
  )
}

/**
 * 自己的头像按钮（DS-18 账户菜单入口）：排在组里第一个，与别人的头像之间留 4px 间距（别人的头像仍叠放）、
 * 外圈常驻 1.5px 中性描边（--v3-border-control：身份标记，DS-35 后仍 ≥ 3:1），一眼看出这是「我」、也是可点的按钮；悬停 / 打开时外圈加深为 2px text-2，键盘焦点环浮到相邻头像之上。
 */
const SELF_AVATAR =
  "relative mr-1 flex shrink-0 rounded-full ring-[1.5px] ring-(--v3-border-control) ring-offset-1 ring-offset-(--v3-panel) transition-shadow hover:ring-2 hover:ring-(--v3-text-2) focus-visible:z-10 data-[state=open]:ring-2 data-[state=open]:ring-(--v3-text-2) data-[v3-open]:ring-2 data-[v3-open]:ring-(--v3-text-2)"

/**
 * 正在协作的人：头像叠放（后者左移 6），描边取所在面板 / 胶囊的底色（暗色不出白圈）。
 * 缺省是示例的三人；people 换人（离线 / 重连中只剩自己，05 §1）；extra > 0 时末尾是「+N」按钮（超过 5 人时第 6 位起折叠，PRD CO-03），点开在线列表。
 * 自己的头像是按钮，点开账户菜单（DS-18，锚点 account），总在第一个、与别人隔开并带常驻外圈（02 §3.5「自己的头像与他人头像的区分」）。
 * 他人的头像是「跟随 〈姓名〉」按钮（rulings §4.25 DS-106，第 3 批转正起缺省；FollowAvatar），following 是跟随的初值（姓名，缺省没在跟随）。
 * 「+N」点开在线列表：list 给了就是它（状态自己的列表内容，如 20 人的在线列表；listOpen 一出现就开着），否则是 main-states 场景登记的 presence:list（PRD CO-03）。
 * people 为空时不显示头像组（单人模式 / 打开中协作者还没连上），占位保留，右侧按钮不移位。
 * 同色序号（DS-132）：people 里的人带 seq 时，头像下沿中线挂 kit AvatarBadge（自己的头像挂在正中，24 配 14），读屏名「姓名，同色第 N 位」；
 * badge / label 是任意角标节点与读屏名的口子。组里有角标时头像与「+N」都 relative（叠放仍是后一个盖前一个），角标自己 z 1 落在相邻头像之上不被遮住。
 */
export function Collaborators({
  people = [ME, WANG, LI],
  extra = 0,
  following,
  list,
  listOpen: listOpenInit,
}: {
  people?: PresencePerson[]
  extra?: number
  following?: string | null
  list?: ReactNode
  listOpen?: boolean
}) {
  const [listOpen, setListOpen] = useState(!!listOpenInit)
  /**
   * 列表这一次是不是用户点「+N」打开的。按初值开着的——状态一出现就开着，或进出母版视图时检查器整块换过、头像组重新挂上，列表按缺省开合重开（DS-169）——
   * 不把焦点移进列表：焦点留在宿主交的落点（进入母版视图是窗格里选中的那一行，DS-166；退出是画布）。用户点「+N」打开的照常移进第一行（kit Popover autoFocus）
   */
  const [userOpened, setUserOpened] = useState(false)
  const List = getToolLayer("presence:list")
  const total = people.length + extra
  // 自己排第一个（离线 / 重连中只剩自己时也是它）
  const ordered: PresencePerson[] = people.length ? [...people.filter((p) => p.name === ME.name), ...people.filter((p) => p.name !== ME.name)] : [ME]
  return (
    <div className={cn("flex items-center", total === 0 && "invisible")} role="group" aria-label={`正在协作的人：${total} 人`} data-v3-anchor="collaborators">
      {ordered.map((p, i) =>
        p.name === ME.name ? (
          <AccountMenu
            key={p.name}
            trigger={
              <button type="button" aria-label={`账户：${p.name}（你）`} data-v3-anchor="account" className={SELF_AVATAR}>
                <Avatar name={p.name} tone={p.tone} badge={p.badge} label={p.label} seq={p.seq} seqAt="group-self" />
              </button>
            }
          />
        ) : (
          // 他人的头像是跟随按钮（DS-106）：缺省读底座的跟随键（kit FOLLOW_KEY），人带了 follow 时用它的键（如第 3 批 present.editor-following）
          <FollowAvatar
            key={p.name}
            p={p}
            follow={p.follow ?? { key: FOLLOW_KEY, init: following ?? null }}
            className={cn(i > 0 && ordered[i - 1]?.name !== ME.name && "-ml-1.5")}
          />
        ),
      )}
      {extra > 0 && (
        <button
          type="button"
          aria-label={`还有 ${extra} 人，展开在线列表`}
          aria-haspopup="dialog"
          aria-expanded={List || list ? listOpen : undefined}
          data-v3-anchor="collaborators-more"
          onClick={() => {
            setUserOpened(true)
            setListOpen((v) => !v)
          }}
          // relative：他人的头像是跟随按钮（relative，DS-106），「+N」也得是定位元素，才按文档顺序叠在最后一枚头像之上（不定位的元素画在定位元素之下）
          className="relative -ml-1.5 inline-flex size-6 items-center justify-center rounded-full bg-(--v3-panel-2) text-[11px] leading-none font-medium text-(--v3-text) tabular-nums ring-1 ring-(--v3-panel) transition-colors hover:bg-(--v3-panel-3) data-[v3-open]:bg-(--v3-panel-3)"
        >
          +{extra}
        </button>
      )}
      {extra > 0 &&
        (list ? (
          // 状态自己的在线列表（DS-132 起可按状态给）：与登记的列表同一落位——贴头像组左缘向下、间距 8，关闭后焦点回「+N」
          <Popover
            anchor="collaborators"
            returnFocus="collaborators-more"
            open={listOpen}
            onOpenChange={setListOpen}
            autoFocus={userOpened}
            onInteractOutside={(e) => {
              // 点的是「+N」本身：交给它自己切换，不在这里先关一次
              if (e.target instanceof Element && e.target.closest('[data-v3-anchor="collaborators-more"]')) e.preventDefault()
            }}
            snap={false}
            side="bottom"
            align="start"
            sideOffset={8}
            label="在线列表"
          >
            {list}
          </Popover>
        ) : (
          List && <List open={listOpen} onOpenChange={setListOpen} />
        ))}
    </div>
  )
}

/** 头像组的配置（EditorConfig.inspector.collaborators、网格胶囊同一份）：在场的人、折叠人数、跟随的初值、「+N」的列表内容与一出现就开着 */
export interface CollaboratorsConfig {
  people: PresencePerson[]
  extra?: number
  following?: string | null
  list?: ReactNode
  listOpen?: boolean
}

/**
 * 待处理的访问申请数（rulings §4.25 DS-48）的场景仓键：分享场景按对话框「访问申请 N」的同一份数据实时写入（所有者端；批准 / 拒绝后随之减少），
 * 别的场景不写，读的一方缺省 0——第 1 批与其余状态的「分享」按钮不受影响。
 */
export const SHARE_PENDING_KEY = "v3.share.pending"

/** [待处理的访问申请数, 写入]：「分享」按钮读，分享场景写（init 是写入方的初值；读的一方不传，缺省 0）。做法同 useInspectorTab 读写 v3.inspector.tab */
export function useSharePending(init = 0): [number, SetSceneState<number>] {
  return useSceneState<number>(SHARE_PENDING_KEY, init)
}

/**
 * 「分享」按钮的宿主声明（rulings §4.25 TB-161：SDK 的 EditorHostProps.shareUnavailable?: 'later' 与 onShare）在样张里的写法——InspectorConfig.share：
 * - 不写：宿主传了 onShare（M3 起）——可用；
 * - SHARE_LATER（{ unavailable: "later" }）：宿主传 shareUnavailable: 'later'（apps/web 在 M2 这样传，DS-137）——留在原位、aria-disabled、仍可聚焦，
 *   工具提示与读屏说明「分享 · 后续版本提供」，不带待处理圆点、点了不发命令（同 §4.20 FE-06，与卡片菜单「分享…」在 M2 的画法一致）；
 * - false：宿主两样都不传——不渲染「分享」；
 * - { reason }：只有「分享」暂不可用的其他原因（如文档已被删除，03-12 §8.4）。整栏都不可用（打开中）用 inspector.locked。
 * 检查器顶行、网格右上胶囊、紧凑形态右上胶囊是同一个按钮，三处都按这一份（Editor 算好放进 EditorCtx.shareReason）。
 */
export type ShareConfig = { reason: string } | { unavailable: "later" } | false
/** M2 的「分享」：inspector.share 写它（DS-137、TB-161） */
export const SHARE_LATER = { unavailable: "later" } as const satisfies ShareConfig
/** M2 里「分享」的不可用原因（DS-137：右侧与工具提示写「后续版本提供」，同 FE-06） */
export const SHARE_LATER_REASON = "后续版本提供"
/** 按状态配置算「分享」按钮：null = 不渲染（宿主两样都不传）；undefined = 可用；字符串 = 不可用的原因（整栏 locked 优先） */
export function shareReasonOf(share: ShareConfig | undefined, locked?: string): string | null | undefined {
  if (share === false) return null
  if (locked) return locked
  if (!share) return undefined
  return "unavailable" in share ? SHARE_LATER_REASON : share.reason
}

/**
 * 「分享」主按钮（检查器顶行、网格右上胶囊、紧凑形态右上胶囊共用）：点了发底座命令 share（kit/commands.ts，分享场景接住、打开分享对话框）。
 * reason：暂不可用（打开中整栏不可用；M2「后续版本提供」与文档已被删除等只有分享不可用时由 inspector.share 给，见 shareReasonOf），aria-disabled、仍可聚焦，工具提示「分享 · 原因」。
 * 有待处理的访问申请时（useSharePending > 0，且按钮可用；DS-48）：右上角带一个 8px 强调色小圆点（不用红色，质量门 Q3；外圈 2px 面板色把它与按钮分开，aria-hidden），
 * 读屏名与工具提示「分享（N 个待处理的访问申请）」——可见文字「分享」在读屏名开头（WCAG 2.5.3）。没有申请时工具提示压住不弹（Tip hidden），
 * 有无申请时按钮的结构不变（不在两种结构之间换），批准 / 拒绝后数字变化时按钮不重新挂载、焦点不掉。
 */
export function ShareButton({ reason }: { reason?: string }) {
  const run = useRunCommand()
  const [pending] = useSharePending()
  if (reason)
    return (
      <Button variant="primary" disabled reason={reasonTip("分享", reason)} data-v3-anchor="share" onClick={() => void run("share")}>
        分享
      </Button>
    )
  const label = pending > 0 ? `分享（${pending} 个待处理的访问申请）` : undefined
  return (
    <Tip label={label ?? "分享"} hidden={!label}>
      {/* relative 只在带点时加（圆点相对按钮定位）：没有申请时按钮的类名与第 1 批完全相同——实测常驻 relative 会让亮色检查器页签行一角的抗锯齿差 2px */}
      <Button variant="primary" data-v3-anchor="share" aria-label={label} className={label ? "relative" : undefined} onClick={() => void run("share")}>
        分享
        {label && <span aria-hidden="true" data-share-pending="" className="pointer-events-none absolute -top-1 -right-1 size-2 rounded-full bg-(--v3-accent) ring-2 ring-(--v3-panel)" />}
      </Button>
    </Tip>
  )
}

/**
 * 「放映」按钮的工具提示（rulings §4.25 TB-103）：按钮从当前页开始（50/10 §3.3、§9.1），提示写「从当前页放映 ⇧F5」（PRD ED-16：F5 从头、Shift+F5 从当前页）；
 * 检查器顶行、网格右上胶囊、紧凑形态右上胶囊三处同一份。从头放映仍是 F5 与命令面板，不加控件
 */
export const PRESENT_TIP = "从当前页放映"
export const PRESENT_KBD = "⇧F5"

/**
 * 检查器顶行（单页视图）：协作者头像组 · 放映 · 分享，高 48、左右 16。检查器（editor/Inspector.tsx）与整栏面板（kit InspectorTakeover）共用这一行，
 * 面板接管整栏时协作行原样不动（DS-26）。data-v3-inspector-top：紧凑抽屉在它右侧给「收起检查器」开关让位（narrow/compact.tsx）。
 * locked（打开中）：放映、分享不可用，工具提示写原因；share：「分享」的宿主声明（InspectorConfig.share：M2 SHARE_LATER、文档已被删除等原因、false 不渲染，见 shareReasonOf）。
 */
export function InspectorTopRow({ collaborators, locked, share }: { collaborators?: CollaboratorsConfig; locked?: string; share?: ShareConfig }) {
  const run = useRunCommand()
  const shareReason = shareReasonOf(share, locked)
  return (
    <div data-v3-inspector-top="" className="flex h-12 shrink-0 items-center justify-between px-4">
      <Collaborators people={collaborators?.people} extra={collaborators?.extra} following={collaborators?.following} list={collaborators?.list} listOpen={collaborators?.listOpen} />
      <div className="flex items-center gap-1">
        {/* 提示「从当前页放映 ⇧F5」（rulings §4.25 TB-103：按钮从当前页开始，PRD ED-16 的 Shift+F5；从头放映仍是 F5 与命令面板）；不可用时提示照旧写原因。
            点了发底座命令 present（第 3 批转正，kitRequest g3 K10：放映场景接住，别的样张转到 present.default，不静默无响应 ED-30） */}
        <IconButton label="放映" tip={locked ? undefined : PRESENT_TIP} kbd={PRESENT_KBD} disabled={!!locked} reason={locked} data-v3-anchor="present" onClick={() => void run("present")}>
          <Play {...ICON} fill="currentColor" />
        </IconButton>
        {shareReason !== null && <ShareButton reason={shareReason} />}
      </div>
    </div>
  )
}

/**
 * 缩放读数「77% ▾」，右对齐展开；单页（检查器页签行）与网格（右上胶囊）各有一份。
 * 读数是量出来的实际比例（幻灯片显示宽 ÷ 1280），所以菜单只放缩放命令（kit/mainMenu.tsx ZOOM_COMMANDS）、不带选中态，免得勾选的档位与读数对不上。
 * disabled + reason：暂不可用（打开中），读数退到 text-3。
 */
export function ZoomMenu({ readout, disabled, reason, className }: { readout: string; disabled?: boolean; reason?: string; className?: string }) {
  const cls = cn(
    "flex h-7 items-center gap-1 rounded-[6px] px-2 text-[12px] leading-none text-(--v3-text-2) tabular-nums transition-colors hover:bg-(--v3-panel-2) hover:text-(--v3-text)",
    TRIGGER_OPEN,
    disabled && "cursor-default text-(--v3-text-3) hover:bg-transparent hover:text-(--v3-text-3)",
    className,
  )
  // 可访问名称要包含可见读数（WCAG 2.5.3），读屏听到「缩放 77%」，语音控制说出「77%」也能匹配
  if (disabled)
    return (
      <button type="button" aria-label={`缩放 ${readout}${reason ? `（${reason}）` : ""}`} aria-disabled="true" data-v3-anchor="zoom" className={cls}>
        {readout}
        <ChevronDown {...ICON} />
      </button>
    )
  return (
    <Menu
      align="end"
      label="缩放"
      items={ZOOM_COMMANDS}
      trigger={
        <button type="button" aria-label={`缩放 ${readout}`} data-v3-anchor="zoom" className={cls}>
          {readout}
          <ChevronDown {...ICON} />
        </button>
      }
    />
  )
}
