import { useEffect, useLayoutEffect, useRef } from "react"
import { PanelLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { ICON, IconButton, LibraryLayers, LibraryToasts, overlayOpen, ShellHelpMenu, ShellRail, shellNav, usePage, userHasInteracted, useSceneState } from "../../kit"
import { HomeBody, type HomeData as HomeBodyData } from "../../HomeBody"
import type { PageConfig, ShellConfig } from "../types"

/**
 * 开始页场景的公共件（第 3 批 · 文档组；2026-10-22 第 3 批转正后）：主区就是底座的 HomeBody（已拍板首页，由本目录原 HomeMain 的画法并入），
 * 应用壳用底座缺省（kit ShellLayout：左栏 5 项 DS-79、搜索框下拉 DS-80、帮助菜单 DS-89、三处同一份账户菜单 DS-90 / DS-91），这里只剩：
 * - homeData：开始页状态数据的写法（底座 HomeData + 窄屏抽屉一出现就开着的 drawer）；
 * - HOME_SHELL / HOME_PAGE / homeShell：别组叠在开始页上的状态的背景（settings.from-home、shortcuts.from-home、import.dialog 等导入对话框各态用同一版开始页，home.m2-default 那一版）；
 * - NavToggle / HomeDrawer：紧凑与手机形态的导航开关与抽屉（DS-87：抽屉就是左栏本身，kit ShellRail）。
 */

export type HomeData = HomeBodyData & {
  /** 抽屉一出现就开着（DS-87 compact-drawer / phone-drawer） */
  drawer?: boolean
}

export const homeData = (d: HomeData) => d as unknown as Record<string, unknown>

/**
 * 开始页的应用壳（home.m2-default 那一版）：底座缺省就是拍板后的画法，M2 不必传任何属性；M3 的开始页（账户菜单「个人资料…」可用）用 homeShell("M3")。
 *   page: { ...HOME_PAGE, layers: <自己的对话框 /> }            // 背后是开始页（主区 + M2 数据）
 *   page: { shell: { ...HOME_SHELL, current: null, title: "…" }, body: <自己的主区 /> }   // 只要壳
 */
export const homeShell = (milestone: "M2" | "M3" = "M2"): ShellConfig => (milestone === "M3" ? { accountMenu: { milestone: "M3" } } : {})
export const HOME_SHELL: ShellConfig = homeShell("M2")
/** 开始页整页（壳 + 主区 + M2 数据）；主区的轻提示与卡片菜单打开的浮层（永久删除确认、分享）也带上，叠上去的状态照样能点卡片菜单 */
export const HOME_PAGE: PageConfig = { shell: HOME_SHELL, body: <HomeBody />, overlay: <LibraryToasts />, layers: <LibraryLayers />, data: homeData({ milestone: "M2" }) }

/* ------------------------------------------------------------------ 窄屏的导航抽屉（DS-87） */

const TOGGLE_ANCHOR = "home.nav-toggle"

/**
 * 顶栏左端的「显示导航」开关（rulings §4.25 DS-87：640–1024 与手机上左栏收成左侧抽屉）：图标按钮，aria-expanded、aria-controls 指向抽屉；
 * 紧凑形态 28（顶栏内边距 32 处），触控形态（手机与平板）44（07 §2「命中区尺寸」：pointer: coarse 或 < 640 主要控件 ≥ 44；640–1024 的平板也是抽屉，开关同为 44，rulings §4.25 TB-165）。
 * 抽屉开着时它被盖住：inert，移出 Tab 顺序与读屏（WCAG 2.4.11）；抽屉里同一位置是按下态的「收起导航」。
 */
export function NavToggle({ touch }: { touch?: boolean }) {
  const { data } = usePage()
  // 同一个场景仓键：开关（顶栏）先于抽屉（overlay）挂上，初值也要按状态数据取，否则抽屉一出现就开着的状态会被开关的 false 盖掉
  const [open, setOpen] = useSceneState<boolean>("home.drawer", () => !!(data as HomeData).drawer)
  return (
    <IconButton
      label="显示导航"
      size={touch ? 44 : 28}
      tipSide="bottom"
      aria-expanded={open}
      aria-controls="home-drawer"
      data-v3-anchor={TOGGLE_ANCHOR}
      inert={open}
      onClick={() => setOpen(true)}
    >
      <PanelLeft {...(touch ? { size: 20, strokeWidth: 1.5 } : ICON)} />
    </IconButton>
  )
}

/**
 * 导航抽屉（DS-87；与编辑器紧凑形态的抽屉同一套，03-02 §5a「开与关在同一处点」、07 §1.2「抽屉（紧凑形态）」）：
 * - 抽屉就是左栏本身（kit ShellRail：宽 220、整高、浮层阴影，不加遮罩、背后的页面照常可用），盖在主区左侧；role=region「导航」（非模态，不是对话框）；
 * - 第一行最左是按下态的同一枚 PanelLeft「收起导航」，与顶栏「显示导航」开关在同一位置、同一尺寸（紧凑 28、触控 44），品牌行右移让位；
 * - 用户展开时焦点交给「收起导航」，收起（点它、Esc、点导航项）后交回顶栏的「显示导航」（先交焦点再卸载，不经过 body）；场景状态里一出现就开着的不抢焦点；
 * - 触控（样张画的是手机；640–1024 的平板抽屉同此，TB-165）：导航项、帮助、用户行升到 44 高、间距 8（07 §2 命中区尺寸）；
 *   手机的搜索已在主区，抽屉里不再放一个（Q2；平板的搜索框随左栏，TB-170）。
 */
export function HomeDrawer({ search = true, current = "home", touch }: { search?: boolean; current?: string | null; touch?: boolean }) {
  const { data } = usePage()
  const [open, setOpen] = useSceneState<boolean>("home.drawer", () => !!(data as HomeData).drawer)
  const closeRef = useRef<HTMLButtonElement>(null)
  /** 收起：顶栏开关先出 inert、接住焦点，再卸载抽屉——焦点不经过 body（07 §2.4） */
  const close = () => {
    const t = document.querySelector<HTMLElement>(`[data-v3-anchor="${TOGGLE_ANCHOR}"]`)
    if (t) {
      t.inert = false
      t.focus({ preventScroll: true })
    }
    setOpen(false)
  }
  // 用户展开时焦点交给「收起导航」（同编辑器抽屉的交接）：在提交的同一个任务里交（顶栏开关同时变 inert，晚一帧焦点就会掉到 body）；
  // 场景状态里一出现就开着的不抢焦点（kit userHasInteracted，同 Popover / Dialog）
  useLayoutEffect(() => {
    if (open && userHasInteracted()) closeRef.current?.focus()
  }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented && !e.isComposing && !overlayOpen()) {
        e.preventDefault()
        close()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])
  if (!open) return null
  return (
    <div
      id="home-drawer"
      role="region"
      aria-label="导航"
      data-v3-drawer=""
      className={cn(
        "absolute inset-y-0 left-0 z-30 flex",
        // 品牌行给「收起导航」让位：开关左缘 + 宽 + 间距 8（紧凑 32 + 28 + 8，触控 16 + 44 + 8，都是 68）
        "[&>aside>div:first-child]:pl-[68px]",
        touch && "[&>aside>div:last-child]:gap-2 [&>aside>div:last-child_button]:h-11 [&>aside>nav]:gap-2 [&>aside>nav_button]:h-11",
      )}
    >
      <ShellRail
        current={current}
        onNav={(id) => {
          setOpen(false)
          shellNav(id)
        }}
        search={search}
        // 触控形态（手机与平板）：帮助菜单与账户菜单的条目不写键位提示（「键盘快捷键」不写 ⌘/、「偏好设置…」不写 ⌘,，rulings §4.25 TB-164）
        help={touch ? <ShellHelpMenu touch /> : true}
        accountMenu={{ milestone: (data as HomeData).milestone ?? "M2", touch }}
        className="h-full shadow-(--v3-shadow)"
      />
      <IconButton
        ref={closeRef}
        label="收起导航"
        size={touch ? 44 : 28}
        tipSide="bottom"
        variant="on"
        aria-expanded
        aria-controls="home-drawer"
        className={cn("absolute", touch ? "top-1.5 left-4" : "top-3.5 left-8")}
        onClick={close}
      >
        <PanelLeft {...(touch ? { size: 20, strokeWidth: 1.5 } : ICON)} />
      </IconButton>
    </div>
  )
}
