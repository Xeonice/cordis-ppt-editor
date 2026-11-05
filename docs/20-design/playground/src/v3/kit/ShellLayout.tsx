import { useEffect, useRef, useState, type ReactNode } from "react"
import { CircleHelp, Clock, FileText, House, LoaderCircle, Search, Trash2, Upload, Users, X, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { ME } from "../data"
import { DocCover } from "../DocCover"
import { AccountMenu, type AccountMenuOptions } from "../editor/chrome"
import { searchDocs } from "../library"
import { usePageMaybe } from "../page/context"
import type { V3Host } from "../params"
import { LogoMark } from "../shape-icons"
import { Avatar, Button, ICON } from "../ui"
import { useRunCommand } from "./commands"
import { openDoc, Quoted } from "./library"
import { Menu, type MenuSpec } from "./Menu"
import { IMPORT_ENTRY, useOpenImportDialog } from "./importDialog"
import { goToState } from "./nav"
import { Popover } from "./Popover"

/**
 * 应用壳（第 3 批：首页、文档列表、模板库、管理页同一个壳，由已拍板的首页 #/v3/home 抽出，rulings §4.25 DS-12，设计 03-29 §2）：
 * 左栏 220（品牌行 56 · 搜索 ⌘K · 主导航 ┊ 帮助 · 用户行 = 账户菜单）+ 主区（顶栏 56：标题 · 右侧按钮；其下横幅通道；再下是内容滚动区）。
 * 页面宿主（PageHost.tsx）按场景状态的 page.shell 传这些属性，场景也可以在自己的 body 里直接用它（如抽屉形态只要 ShellRail）。
 * 2026-10-22 第 3 批转正（kitRequests g1 K1、g4 K4、g5 K1）后的缺省就是拍板后的画法：
 * - 主导航 5 项「首页 / 最近 / 我的文档 / 与我共享 / 回收站」，左栏就是筛选（DS-79，回收站画法同其余四项）；点了真的跳页：首页 → #/v3/home，其余 → 文档列表对应视图；
 * - 搜索框下拉（DS-80）：输入后下方弹出前 5 条即时结果 +「查看全部结果」（进文档列表的搜索结果页，不写数量），⌘K 聚焦；
 * - 「帮助」是帮助菜单（DS-89）：只列集成方配置了链接的条目（新标签页打开、外链图标），「键盘快捷键 ⌘/」始终在；
 * - 用户行打开账户菜单（三处同一份 accountMenuItems：主题三项 DS-90、M2 不显示「个人资料…」DS-91、帮助中心按配置 DS-89），按钮锚点 account（关闭偏好设置后焦点回到这里，g4 K4）；
 * - 管理页的左栏变体：navSlot 换掉主导航（管理导航），同时不渲染搜索与帮助（search false、help false，g5 K1）。
 *
 *   <ShellLayout current="recent" title="最近" actions={…} banner={<Banner …/>}>{卡片网格}</ShellLayout>
 */
export interface ShellNavItem {
  id: string
  label: string
  Icon: LucideIcon
}

/** 主导航（rulings §4.25 DS-79：左栏就是筛选，第 5 项「回收站」画法同其余四项；/documents 不带筛选落「最近」） */
export const SHELL_NAV: ShellNavItem[] = [
  { id: "home", label: "首页", Icon: House },
  { id: "recent", label: "最近", Icon: Clock },
  { id: "mine", label: "我的文档", Icon: FileText },
  { id: "shared", label: "与我共享", Icon: Users },
  { id: "trash", label: "回收站", Icon: Trash2 },
]

/** 点导航项（缺省）：首页 → 已拍板首页（#/v3/home 不带 state），其余进文档列表对应视图（documents.<视图>），沿用当前主题与强调色 */
export function shellNav(id: string) {
  if (id === "home") goToState("home", null)
  else goToState("documents", `documents.${id}`)
}

export interface ShellRailProps {
  /** 当前项（导航 id，缺省 home）；null 不标当前项（如管理页、模板库以外的页面自己决定） */
  current?: string | null
  /** 主导航条目（缺省 SHELL_NAV） */
  nav?: ShellNavItem[]
  /** 点导航项：缺省跨宿主跳转（shellNav）；给了就交给场景 */
  onNav?: (id: string) => void
  /** 主导航整块换掉（管理页的管理导航，g5 K1）：给了就不渲染 <nav aria-label="主导航">，放在搜索之后、同一位置 */
  navSlot?: ReactNode
  /** 搜索框（缺省 true：搜索框下拉 + ⌘K 聚焦，DS-80）；false 不渲染；也可换成自己的节点 */
  search?: boolean | ReactNode
  /** 左栏底部的「帮助」（缺省 true：帮助菜单，DS-89）；false 不渲染；也可换成自己的节点 */
  help?: boolean | ReactNode
  /** 用户行的账户菜单一出现就打开（向上、左对齐，DS-18） */
  accountMenuOpen?: boolean
  /** 换掉账户菜单的条目（缺省 editor/chrome.tsx accountMenuItems 的 M2 普通成员，开始页、编辑器、文档列表同一份）；整份自己给时用 */
  accountMenuItems?: MenuSpec[]
  /** 按角色 / 里程碑 / 嵌入增减账户菜单的缺省条目（accountMenuItems 的参数，如 { milestone: "M3", admin: true }）：「偏好设置…」「键盘快捷键」「退出登录」照样经底座命令发出 */
  accountMenu?: AccountMenuOptions
  /**
   * 当前项的读屏类型（第 3 批，可选）：page（缺省，「当前页面」）· true（子页面里标出的上级导航项，如模板库里的「首页」：
   * 读屏不把它念成当前页面，aria-current="true"）。外观不变
   */
  currentAria?: "page" | "true"
  className?: string
}

export interface ShellLayoutProps extends ShellRailProps {
  /** 顶栏标题（16px 600，h1；缺省「首页」） */
  title?: ReactNode
  /** 顶栏右侧（缺省「导入 .pptx」「新建演示文稿」，同已拍板首页）；null 不放 */
  actions?: ReactNode | null
  /** 顶栏标题左侧（如紧凑形态的「显示导航」开关，DS-87） */
  headerStart?: ReactNode
  /**
   * 横幅通道（应用壳页面，DS-92）：kit Banner；两条叠放用 BannerStack（最多两条）。
   * bannerAt：main（DS-92 采纳）主区顶栏之下、只横跨主区，导航不动、标题不跳 · top（未采纳）主区最顶、顶栏之上
   */
  banner?: ReactNode
  bannerAt?: "main" | "top"
  /** 左栏：false 不渲染（窄屏把它收进抽屉时，场景自己用 ShellRail 画抽屉） */
  rail?: boolean
  /** 内容滚动区的内边距（缺省 px-8 pt-6 pb-8，同首页） */
  bodyClassName?: string
  /** 主区叠加层：主区（relative）里绝对定位的东西，如 kit Toasts（应用壳页面的轻提示位置同画布列底部那一处，用 inset 调到底边） */
  overlay?: ReactNode
  children?: ReactNode
}

/** 左栏的一项（首页与文档列表同一种）：28 高、圆角 6、当前项 panel-2 底 + 500 */
export function ShellNavButton({ Icon, label, on, onClick, currentAria = "page" }: { Icon: LucideIcon; label: string; on?: boolean; onClick?: () => void; currentAria?: "page" | "true" }) {
  return (
    <button
      type="button"
      aria-current={on ? currentAria : undefined}
      onClick={onClick}
      className={cn(
        "flex h-7 w-full items-center gap-2 rounded-[6px] px-2 text-[13px] leading-none transition-colors",
        on ? "bg-(--v3-panel-2) font-medium text-(--v3-text)" : "text-(--v3-text-2) hover:bg-(--v3-panel-2) hover:text-(--v3-text)",
      )}
    >
      <Icon {...ICON} className="shrink-0" />
      {label}
    </button>
  )
}

/**
 * 应用壳的搜索框（rulings §4.25 DS-80 采纳的「搜索框下拉」；第 3 批转正时由 scenarios/documents/alts.tsx 的 SearchDropdownBox 并入，画法相同）：
 * 外框 --v3-search-*（DS-35：透明底 + 与分隔线同档的细边、悬停铺 panel-2，免得与同为 panel-2 底的当前导航项混淆；聚焦换强调色；圆角 6）。
 * 输入后搜索框下方弹出即时结果（宽 340、左对齐）：前 5 条（48 宽小封面 · 标题 · 编辑者与时间，点一条打开），没有命中时一行「没有匹配「…」的文档」；
 * 末行「查看全部结果」进文档列表的搜索结果页（documents.search，不写数量：游标分页没有总数）；主区不变。
 * 键盘与读屏按组合框（设计 07 §1.2「搜索框下拉」）：焦点一直留在搜索框里（下拉不抢焦点，aria-activedescendant 指当前项）——↓ / ↑ 在前 5 条与「查看全部结果」之间移动，
 * ↵ 打开当前项（文档进编辑器、「查看全部结果」进结果页；还没移动过时 ↵ 就是「查看全部结果」）；Esc 先收起下拉、再按清空搜索词；点外面收起；输入法组合中的 ↵ / Esc 交给输入法。
 * ⌘K / Ctrl+K 聚焦（按 KeyboardEvent.code 判，不依赖键位字符，ED-16；开始页作用域的「聚焦搜索」，03-29 §6）。
 * touch：手机形态（DS-87）放在主区提示行之下的那一个——触控高 44、13px，不写 ⌘K；下拉同桌面（同一份内容与键盘），行高 44（rulings §4.25 TB-130：
 *   文档行本来就是 44——上下 6 + 两行 16；「查看全部结果」一行触控时由 28 改 44）。平板（触控、≥ 640）的搜索框随左栏（常驻左栏或抽屉里），同用这一触控画法——
 *   44、不写 ⌘K、下拉行高 44（rulings §4.25 TB-170、TB-164；样张没有单画平板）；initial：一出现就有的检索词（下拉随之开着，样张定格用）；
 * results：放在搜索结果页上（documents.search）——检索词取地址里的 q、下拉收着，「查看全部结果」/ ↵ 在结果页里换检索词，× 或 Esc 清空并回到搜索前的页面（地址里的 from，缺省「最近」）。
 */
export function ShellSearch({ initial = "", results, touch, className }: { initial?: string; results?: boolean; touch?: boolean; className?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const page = usePageMaybe()
  const url = () => new URLSearchParams(window.location.hash.split("?")[1] ?? "")
  const [value, setValue] = useState(() => (results ? (url().get("q") ?? initial) : initial))
  const [open, setOpen] = useState(!results && !!initial.trim())
  /** 下拉里的当前项（键盘 ↓ / ↑）：0–4 是即时结果，ALL_ROW（= 结果条数）是「查看全部结果」，-1 没有 */
  const [active, setActive] = useState(-1)
  const hits = searchDocs(value).slice(0, 5)
  const ALL_ROW = hits.length
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.code === "KeyK") {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])
  const toResults = (q: string) => {
    if (!q.trim()) return
    setOpen(false)
    // 搜索前的页面（宿主 | 地址里的 state，已拍板首页不带 state）记在结果页的地址里；从结果页再搜一次时沿用同一个、不新增历史记录
    const here = page ? `${page.host}|${url().get("state") ?? ""}` : ""
    goToState("documents", "documents.search", { q, from: results ? (url().get("from") ?? "") : here }, { replace: results })
  }
  const back = () => {
    const [h, st] = (url().get("from") ?? "").split("|")
    goToState((h || "documents") as V3Host, h ? st || null : "documents.recent")
  }
  const clear = () => {
    setValue("")
    setOpen(false)
    setActive(-1)
    if (results) back()
    else ref.current?.focus()
  }
  const optId = (i: number) => `shell-search-opt-${i}`
  const field = (
    <label
      data-v3-anchor="shell-search"
      className={cn(
        "flex items-center gap-2 rounded-[6px] bg-(--v3-search-fill) text-(--v3-text-2) ring-1 ring-(--v3-search-line) ring-inset focus-within:ring-(--v3-accent)",
        touch ? "h-11 px-3" : "h-7 px-2 transition-colors hover:bg-(--v3-search-fill-hover)",
        touch && className,
      )}
    >
      <Search {...ICON} className="shrink-0" />
      <input
        ref={ref}
        value={value}
        role="combobox"
        aria-autocomplete="list"
        onChange={(e) => {
          setValue(e.target.value)
          setOpen(!!e.target.value.trim())
          setActive(-1)
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            if (!value.trim()) return
            e.preventDefault()
            if (!open) {
              setOpen(true)
              return
            }
            const n = ALL_ROW + 1
            setActive((a) => (e.key === "ArrowDown" ? (a + 1) % n : a <= 0 ? n - 1 : a - 1))
          } else if (e.key === "Enter") {
            if (!value.trim()) return
            e.preventDefault()
            const d = open && active >= 0 && active < ALL_ROW ? hits[active] : undefined
            if (d) openDoc(d)
            else toResults(value)
          } else if (e.key === "Escape") {
            // 先收起下拉、再按清空（下拉开着时 Radix 也会在同一下收起它，这里只管不清空）
            if (open) {
              e.preventDefault()
              setOpen(false)
              setActive(-1)
            } else if (value) {
              e.preventDefault()
              clear()
            }
          }
        }}
        placeholder="搜索"
        aria-label="搜索文档"
        aria-keyshortcuts={touch ? undefined : "Meta+K Control+K"}
        aria-expanded={open}
        aria-controls="shell-search-dropdown"
        aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
        spellCheck={false}
        // 字号与行高写在同一段里（tailwind-merge 会让后写的 text-[12px] 吃掉前面的 leading-none，输入框就高出 2、字下沉 1）
        className={cn("min-w-0 flex-1 bg-transparent text-(--v3-text) outline-none", touch ? "text-[13px] leading-none" : "text-[12px] leading-none")}
      />
      {value ? (
        <button
          type="button"
          aria-label="清除搜索"
          onClick={clear}
          className="-mr-1 flex size-5 shrink-0 items-center justify-center rounded-[4px] text-(--v3-text-2) transition-colors hover:bg-(--v3-panel-2) hover:text-(--v3-text)"
        >
          <X size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      ) : (
        !touch && <kbd className="font-sans text-[11px] leading-none text-(--v3-text-2)">⌘K</kbd>
      )}
    </label>
  )
  /** 下拉里的一项：焦点留在搜索框（按下时不移焦点），当前项与悬停同一种底 */
  const keep = (e: { preventDefault: () => void }) => e.preventDefault()
  const dropdown = (
    <Popover
      anchor="shell-search"
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setActive(-1)
      }}
      side="bottom"
      align="start"
      snap={false}
      label="搜索结果"
      className="w-[340px] p-1"
      autoFocus={false}
      onInteractOutside={(e) => {
        // 点的是搜索框本身：下拉留着（继续输入）
        if (e.target instanceof Element && e.target.closest('[data-v3-anchor="shell-search"]')) e.preventDefault()
      }}
    >
      <div id="shell-search-dropdown" role="listbox" aria-label={`「${value}」的即时结果`}>
        {hits.length ? (
          <ul role="presentation">
            {hits.map((d, i) => (
              <li
                key={d.id}
                id={optId(i)}
                role="option"
                aria-selected={active === i}
                onMouseDown={keep}
                onClick={() => openDoc(d)}
                className={cn("flex w-full items-center gap-3 rounded-[4px] px-2 py-1.5 text-left transition-colors hover:bg-(--v3-panel-2)", active === i && "bg-(--v3-panel-2)")}
              >
                <span className="block w-12 shrink-0 overflow-hidden rounded-[4px] border border-(--v3-border)">
                  <DocCover cover={d.cover} title={d.title} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] leading-4 font-medium">{d.title}</span>
                  <span className="block truncate text-[12px] leading-4 text-(--v3-text-2)">
                    {d.editor} · {d.when}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p role="status" className="px-2 py-3 text-[12px] leading-4 text-(--v3-text-2)">
            没有匹配<Quoted>{value}</Quoted>的文档
          </p>
        )}
        <div role="presentation" className="-mx-1 my-1 h-px bg-(--v3-border)" />
        <div
          id={optId(ALL_ROW)}
          role="option"
          aria-selected={active === ALL_ROW}
          onMouseDown={keep}
          onClick={() => toResults(value)}
          className={cn(
            "flex w-full items-center rounded-[4px] px-2 text-left text-[12px] leading-none text-(--v3-text-2) transition-colors hover:bg-(--v3-panel-2) hover:text-(--v3-text)",
            touch ? "h-11" : "h-7",
            active === ALL_ROW && "bg-(--v3-panel-2) text-(--v3-text)",
          )}
        >
          查看全部结果
        </div>
      </div>
    </Popover>
  )
  if (touch)
    return (
      <>
        {field}
        {dropdown}
      </>
    )
  return (
    <div className={cn("px-3", className)}>
      {field}
      {dropdown}
    </div>
  )
}

const SEP: MenuSpec = { type: "separator" }

/**
 * 帮助菜单的条目（rulings §4.25 DS-89）：只列集成方配置了链接的条目（RuntimeConfig.help：5 分钟快速入门、母版与版式、协同编辑、帮助中心、新功能），
 * 都在新标签页打开、带外链图标（kit Menu external）；「键盘快捷键 ⌘/」始终在（发底座命令 help.shortcuts：开始页上浮在主区右上，DS-115）；什么都没配置时只剩它。
 * 不做站内占位指南页（AS-04 的「内置指南」随 DS-89 删）。分组：指南 ┊ 键盘快捷键 ┊ 帮助中心 · 新功能。
 */
export function shellHelpItems(configured: boolean, onShortcuts?: () => void, touch?: boolean): MenuSpec[] {
  // 触控形态（手机与平板）的菜单项不写键位提示：「键盘快捷键」不写「⌘/」（rulings §4.25 TB-154，与手机搜索框不写 ⌘K 一致）
  const shortcuts: MenuSpec = { id: "shortcuts", label: "键盘快捷键", kbd: touch ? undefined : "⌘/", onSelect: onShortcuts }
  if (!configured) return [shortcuts]
  const ext = (id: string, label: string): MenuSpec => ({ id, label, external: true })
  return [ext("guide-start", "5 分钟快速入门"), ext("guide-master", "母版与版式"), ext("guide-collab", "协同编辑"), SEP, shortcuts, SEP, ext("help-center", "帮助中心"), ext("whats-new", "新功能")]
}

/**
 * 左栏「帮助」（DS-89）：与导航项同一画法（28 高、圆角 6、图标 16 + 13px），点开帮助菜单（向上、左对齐，与用户行的账户菜单同一落位；菜单开着时铺 panel-2）。
 * configured：集成方配置了帮助链接（缺省 true）；open：一出现就打开（场景状态）；touch：触控形态，「键盘快捷键」不写「⌘/」（TB-154）。第 3 批转正时由 scenarios/documents/shell.tsx 的 HelpMenu 并入，画法相同
 */
export function ShellHelpMenu({ configured = true, open, touch }: { configured?: boolean; open?: boolean; touch?: boolean }) {
  const run = useRunCommand()
  return (
    <Menu
      items={shellHelpItems(configured, () => void run("help.shortcuts"), touch)}
      defaultOpen={open}
      side="top"
      align="start"
      label="帮助"
      className="min-w-[220px]"
      trigger={
        <button
          type="button"
          className="flex h-7 w-full items-center gap-2 rounded-[6px] px-2 text-[13px] leading-none text-(--v3-text-2) transition-colors hover:bg-(--v3-panel-2) hover:text-(--v3-text) data-[state=open]:bg-(--v3-panel-2) data-[state=open]:text-(--v3-text)"
        >
          <CircleHelp {...ICON} className="shrink-0" />
          帮助
        </button>
      }
    />
  )
}

/**
 * 应用壳的左栏（220 贴边，panel 底、右侧 1px 分隔）：品牌行 · 搜索 · 主导航 ┊ 帮助 · 分隔 · 用户行（点开账户菜单，向上，DS-18）。
 * 设置的唯一入口是账户菜单（DS-10 / PRD AS-06 / D13）。窄屏抽屉（DS-87）里放的也是它（className 加阴影等）。
 */
export function ShellRail({ current = "home", nav = SHELL_NAV, onNav, navSlot, search = true, help = true, accountMenuOpen, accountMenuItems, accountMenu, currentAria, className }: ShellRailProps) {
  const [on, setOn] = useState<string | null>(current)
  // 状态换了当前项（同一宿主里切状态）时跟着换
  useEffect(() => setOn(current), [current])
  return (
    <aside className={cn("flex w-[220px] shrink-0 flex-col border-r border-(--v3-border) bg-(--v3-panel) select-none", className)}>
      <div className="flex h-14 shrink-0 items-center gap-2 px-5">
        <LogoMark className="size-5" />
        <span className="text-[13px] leading-none font-semibold">Cordex</span>
      </div>
      {search === true ? <ShellSearch /> : search || null}
      {navSlot ?? (
        <nav aria-label="主导航" className="mt-3 flex flex-col gap-1 px-3">
          {nav.map((n) => (
            <ShellNavButton
              key={n.id}
              Icon={n.Icon}
              label={n.label}
              on={on === n.id}
              currentAria={currentAria}
              onClick={() => {
                // 场景给了 onNav 就全交给它（同改前）；缺省先换当前项、再跨宿主跳转（shellNav，DS-79）
                if (onNav) onNav(n.id)
                else {
                  setOn(n.id)
                  shellNav(n.id)
                }
              }}
            />
          ))}
        </nav>
      )}
      <div className="mt-auto flex flex-col gap-1 px-3 pb-3">
        {help === true ? <ShellHelpMenu /> : help || null}
        <div className="my-2 h-px bg-(--v3-border)" aria-hidden="true" />
        <AccountMenu
          side="top"
          align="start"
          defaultOpen={accountMenuOpen}
          items={accountMenuItems}
          options={accountMenu}
          trigger={
            <button
              type="button"
              aria-label={`账户：${ME.name}`}
              data-v3-anchor="account"
              className="flex h-7 w-full items-center gap-2 rounded-[6px] px-2 text-left transition-colors hover:bg-(--v3-panel-2) data-[state=open]:bg-(--v3-panel-2)"
            >
              <Avatar name={ME.name} tone={ME.tone} />
              <span className="truncate text-[13px] leading-none">{ME.name}</span>
            </button>
          }
        />
      </div>
    </aside>
  )
}

/**
 * 顶栏右侧的缺省按钮（已拍板首页）：「导入 .pptx」（canvas 底上的 outline）· 主按钮「新建演示文稿」（进编辑器）。
 * 「导入 .pptx」在原页上打开「导入」对话框、从选文件开始（rulings §4.25 DS-140，取代 DS-98 的整屏导入页；kit importDialog：锚点 import.entry、aria-haspopup=dialog，
 * 关闭后焦点回到这颗按钮）；开始页与文档列表的拖入落区（DropOverlay）松开即打开对话框的上传态（TB-180）。
 * reason：两个按钮留在原位、不可用并写原因（离线、正在创建别的，FE-06）；busy：从这里新建、正在创建——「新建演示文稿」换成转圈 +「正在创建…」。
 * 画布底上的主按钮不可用 / 进行中保持 kit 主按钮的不可用态（rulings §4.25 DS-123：与第 2 批一致，不改 outline）
 */
export function ShellDefaultActions({ reason, busy }: { reason?: string; busy?: boolean } = {}) {
  const off = !!reason || !!busy
  const openImport = useOpenImportDialog()
  return (
    <>
      <Button
        variant="outline"
        disabled={off}
        reason={reason ?? (busy ? "正在创建演示文稿" : undefined)}
        data-v3-anchor={IMPORT_ENTRY}
        aria-haspopup="dialog"
        onClick={() => openImport("pick")}
      >
        <Upload {...ICON} />
        导入 .pptx
      </Button>
      <Button variant="primary" disabled={off} reason={reason} aria-busy={busy || undefined} onClick={() => goToState("editor", "empty")}>
        {busy && <LoaderCircle size={14} strokeWidth={1.75} aria-hidden="true" className="shrink-0 motion-safe:animate-spin" />}
        {busy ? "正在创建…" : "新建演示文稿"}
      </Button>
    </>
  )
}

/**
 * 应用壳：左栏 + 主区。渲染成两个兄弟元素（aside、main），放在横向 flex 的容器里（页面宿主的 V3Root 是 flex h-dvh；同已拍板首页）。
 * 主区：顶栏 56（标题 · 右侧按钮，底部 1px 分隔）→ 横幅通道（bannerAt main，DS-92）→ 内容滚动区；overlay 画在主区（relative）里。
 */
export function ShellLayout({
  title = "首页",
  actions,
  headerStart,
  banner,
  bannerAt = "main",
  rail = true,
  bodyClassName,
  overlay,
  children,
  ...railProps
}: ShellLayoutProps) {
  return (
    <>
      {rail && <ShellRail {...railProps} />}
      {/* 主区兼作焦点兜底（kit canvasFocusTarget 认 data-v3-anchor="canvas"，tabIndex −1、不进 Tab 顺序）：浮层关闭、卡片卸载后焦点不掉到 body */}
      <main data-v3-anchor="canvas" tabIndex={-1} className="relative flex min-w-0 flex-1 flex-col bg-(--v3-canvas) outline-none">
        {bannerAt === "top" && banner}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-(--v3-border) px-8">
          {headerStart ? (
            <div className="flex min-w-0 items-center gap-2">
              {headerStart}
              <h1 className="text-[16px] leading-6 font-semibold">{title}</h1>
            </div>
          ) : (
            <h1 className="text-[16px] leading-6 font-semibold">{title}</h1>
          )}
          {actions !== null && <div className="flex items-center gap-2">{actions ?? <ShellDefaultActions />}</div>}
        </header>
        {bannerAt === "main" && banner}
        <div className={cn("min-h-0 flex-1 overflow-y-auto", bodyClassName ?? "px-8 pt-6 pb-8")}>{children}</div>
        {overlay}
      </main>
    </>
  )
}
