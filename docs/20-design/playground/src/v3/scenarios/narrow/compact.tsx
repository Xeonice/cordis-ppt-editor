import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { PanelLeft, PanelRight, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Collaborators, DocMenu, ICON, IconButton, MainMenu, overlayOpen, PRESENT_KBD, PRESENT_TIP, ShareButton, useAnchorElement, useEditor, useMasterEntryGuard, useTrackedRect, ViewToggle, ZoomMenu,
} from "../../kit"
import type { MainMenuOptions } from "../../kit"
import type { InspectorConfig, RailConfig, RegionDefaults } from "../types"
import { useV3Params } from "../../params"
import { EMBED_MASTER_REASON, MASTER_REASON } from "./data"
import { useCloseDrawerOnViewChange, useDrawer, useHandoff } from "./form"

/**
 * 紧凑形态（640–1024，DS-17；01 §6、50/10 §2.2）：
 * - 左栏与检查器默认收起：左上「文档」胶囊接替左栏顶部（主菜单、文档标题、单页 / 网格），右上「协作与分享」胶囊接替检查器顶部
 *   （协作者、缩放、放映、分享）——与网格视图的两个胶囊同一外观（DS-4），切到网格时位置不跳。
 * - 两枚面板开关在窗口两个外角：左胶囊最左「显示幻灯片列表」、右胶囊最右「显示检查器」；展开后的抽屉在同一个角放「收起」，
 *   开与关在同一处点。抽屉就是桌面的左栏 / 检查器本身（不另做组件变体，设计 04 §5），贴边、整高、1px 分隔，盖在画布上所以带浮层阴影；
 *   展开时同侧胶囊让位（内容相同，不重复入口，Q2）。
 * - 同一时刻只展开一个抽屉（两个都开时 640 宽只剩 120 给画布）。
 * - 抽屉盖住的部分不算可用区：幻灯片、备注与底部工具条按未遮挡的区域居中与适应窗口，选中对象不会被检查器挡住；画布列宽不变。
 * - 画布左右留白从 48 收到 24（「尽可能占满宽度」），上方给胶囊让出 72。
 * - 底部工具条八项不变（约 338 宽，640 也放得下）：主行条目固定，不随窗口宽度增减（50/10 §4）。
 */

/** 浮动胶囊：与网格视图同一外观（48 高、panel 底、1px 边、圆角 12、浮层阴影，距画布上与左 / 右 12）。 */
const CAPSULE =
  "absolute top-[calc(var(--v3-banner-h,0px)+0.75rem)] z-20 flex h-12 items-center gap-1 rounded-[12px] border border-(--v3-border) bg-(--v3-panel) shadow-(--v3-shadow) select-none"

/**
 * 母版视图入口的不可用原因：嵌入形态 E（iframe 里，URL 带 embedded=1）换成「当前区域太窄，暂不可用」（rulings §4.25 DS-112），其余照旧 MASTER_REASON。
 * CompactStage 用它声明形态守卫；胶囊与抽屉的主菜单也显式传它，宿主有原因时以宿主的为准（评审、查看者、降权先写那一句，editor/master/mode.ts masterMenuOption），
 * 显式的这句只在守卫登记之前的那一下渲染里用得上
 */
function useMasterReason(): string {
  return useV3Params().embedded ? EMBED_MASTER_REASON : MASTER_REASON
}

/** 抽屉打开时可用区让出的一侧（单页视图里才有抽屉）。 */
function useCovered(): "left" | "right" | null {
  const { view } = useEditor()
  const [drawer] = useDrawer()
  if (view !== "single") return null
  return drawer === "rail" ? "left" : drawer === "inspector" ? "right" : null
}

/** 面板开关：同一枚图标，展开时按下态（aria-expanded）。左右各一，位置在窗口外角。 */
function PanelToggle({ side, open, onToggle, autoFocus }: { side: "left" | "right"; open: boolean; onToggle: () => void; autoFocus?: boolean }) {
  const Icon = side === "left" ? PanelLeft : PanelRight
  const what = side === "left" ? "幻灯片列表" : "检查器"
  return (
    <IconButton
      label={`${open ? "收起" : "显示"}${what}`}
      size={28}
      tipSide="bottom"
      variant={open ? "on" : "ghost"}
      aria-expanded={open}
      autoFocus={autoFocus}
      onClick={onToggle}
    >
      <Icon {...ICON} />
    </IconButton>
  )
}

/** 胶囊之间的竖分隔（20 高、1px border 色） */
function CapsuleDivider({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("h-5 w-px shrink-0 bg-(--v3-border)", className)} />
}

/** 单页视图的缩放读数：量画布上的幻灯片框（与检查器同一口径：显示宽 ÷ 1280）。 */
function useZoomReadout(): string {
  const rect = useTrackedRect(useAnchorElement(useEditor().masterView.on ? "master-view.slide" : "slide", { quiet: true }))
  return rect ? `${Math.round((rect.width / 1280) * 100)}%` : "—"
}

/**
 * 左上「文档」胶囊：显示幻灯片列表 · 主菜单 · 文档标题 ┊ 单页 / 网格（母版视图里没有网格切换，主菜单「视图」里是「关闭母版视图」）。
 * viewToggleReason：单页 / 网格暂不可用的原因（如版本历史面板开着时「关闭版本历史后可用」，第 3 批 narrow-review；同桌面左栏 viewToggle.reason）；不传时与原来相同。
 */
function DocCapsule({ menu, viewToggle = true, viewToggleReason }: { menu?: Partial<MainMenuOptions>; viewToggle?: boolean; viewToggleReason?: string }) {
  const { view, setView, notes, setNotes, mode } = useEditor()
  const [, setDrawer] = useDrawer()
  const [handoff, setHandoff] = useHandoff()
  const masterReason = useMasterReason()
  return (
    <div role="group" aria-label="文档" className={cn(CAPSULE, "left-3 pr-2.5 pl-2")}>
      <PanelToggle
        side="left"
        open={false}
        autoFocus={handoff}
        onToggle={() => {
          setHandoff(true)
          setDrawer("rail")
        }}
      />
      <MainMenu view={view} onView={setView} notes={notes} onNotes={setNotes} options={{ mode, master: { reason: masterReason }, ...menu }} />
      <DocMenu className="pr-1" mode={mode} />
      {viewToggle && (
        <>
          <CapsuleDivider className="mr-[3px]" />
          <ViewToggle view={view} onView={setView} size={28} tipSide="bottom" reason={viewToggleReason} />
        </>
      )}
    </div>
  )
}

/**
 * 右上「协作与分享」胶囊：协作者 · 缩放 ┊ 放映 · 分享 · 显示检查器。放映按钮从当前页开始，提示「从当前页放映 ⇧F5」（rulings §4.25 TB-103，ED-16、DS-11），与检查器顶行、网格胶囊同一份（editor/chrome.tsx PRESENT_TIP）。
 * 「分享」是底座同一个 ShareButton（2026-10-22 第 3 批转正第三段改：原为没接命令的普通主按钮，画面相同）：按状态的 inspector.share 取样子（EditorCtx.shareReason）——
 * M2 留在原位、不可用、工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161），宿主没给时不渲染；可用时点了发底座命令 share，同检查器顶行与网格胶囊
 */
function ShareCapsule() {
  const [, setDrawer] = useDrawer()
  const [handoff, setHandoff] = useHandoff()
  const zoom = useZoomReadout()
  const { shareReason } = useEditor()
  return (
    <div role="group" aria-label="协作与分享" className={cn(CAPSULE, "right-3 pr-2 pl-3")}>
      <Collaborators />
      <ZoomMenu readout={zoom} className="pr-1" />
      <CapsuleDivider className="-mr-px" />
      <IconButton label="放映" tip={PRESENT_TIP} kbd={PRESENT_KBD} tipSide="bottom" data-v3-anchor="present">
        <Play {...ICON} fill="currentColor" />
      </IconButton>
      {shareReason !== null && <ShareButton reason={shareReason} />}
      <PanelToggle
        side="right"
        open={false}
        autoFocus={handoff}
        onToggle={() => {
          setHandoff(true)
          setDrawer("inspector")
        }}
      />
    </div>
  )
}

/**
 * Esc 收起抽屉（与 kit Popover 一样在 document 上响应：焦点在抽屉外、在画布上、在 body 上都收得起来）。
 * 逐层退出、不越级（50/10 §7.1）：别的浮层（菜单、下拉、弹层、对话框）开着时 Esc 先交给它们——在捕获阶段看一眼有没有开着的浮层（kit overlayOpen：
 * 只认打开着的 Radix 浮层与已展开的弹出触发器，页面上一直在的 role="listbox"、工具提示都不算），有就不管；
 * 轮到抽屉时收起它并 preventDefault，同一下按键不再让下面一级（母版视图取消选中 / 退出、画布）响应。正在输入法组合时不管。
 */
function useEscToClose(open: boolean, close: () => void) {
  const ref = useRef(close)
  ref.current = close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.isComposing || e.defaultPrevented) return
      if (overlayOpen()) return
      e.preventDefault()
      ref.current()
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [open])
}

/**
 * 横幅总高（画布列 main 上的 --v3-banner-h，kit Banner / BannerStack 写的）：抽屉在画布列之外（fixed），继承不到这个变量，这里读出来跟着变；没有横幅时 0。
 * 第 3 批转正时由 narrow-review/compact.tsx 的 BelowBanner 并入（rulings §4.25 DS-130）
 */
function useBannerHeight(): string {
  const [h, setH] = useState("0px")
  useLayoutEffect(() => {
    const main = document.querySelector<HTMLElement>('[data-v3-anchor="canvas"]')
    if (!main) return
    const read = () => setH(main.style.getPropertyValue("--v3-banner-h") || "0px")
    read()
    const mo = new MutationObserver(read)
    mo.observe(main, { attributes: true, attributeFilter: ["style"] })
    return () => mo.disconnect()
  }, [])
  return h
}

/**
 * 抽屉外框：贴左 / 右边、盖在画布上（fixed，z 在工具条之上、浮层之下），浮层阴影；
 * 里面就是底座的左栏 / 检查器，只在第一行给「收起」开关让出位置（开关画在外角，与胶囊上的开关同一处）。
 * 从横幅下沿开始、到窗口底（rulings §4.25 DS-130：编辑器紧凑形态的非模态抽屉不盖横幅——横幅里放的是模式的唯一出口与数据风险提示，被抽屉盖住就点不到，
 * 如母版视图的「关闭母版视图」、版本预览的「返回当前版本 / 恢复此版本」，03-12 §2.1 横幅不遮挡）；没有横幅时与原来一样整高。带遮罩的模态抽屉与开始页的导航抽屉不在此列
 */
function DrawerFrame({ side, label, toggle, className, children }: { side: "left" | "right"; label: string; toggle: ReactNode; className?: string; children: ReactNode }) {
  const top = useBannerHeight()
  return (
    <div
      role="region"
      aria-label={label}
      // data-v3-drawer：打开着的抽屉。Esc 逐层退出时下面一级（母版视图的取消选中 / 退出）见到它就先让它收起
      data-v3-drawer=""
      style={{ top }}
      className={cn("fixed bottom-0 z-30 flex shadow-(--v3-shadow)", side === "left" ? "left-0" : "right-0", className)}
    >
      {children}
      {toggle}
    </div>
  )
}

/** 幻灯片列表抽屉（左）：桌面左栏原样（主菜单、单页 / 网格、文档标题、同步状态、新建幻灯片、缩略图），第一行最左是「收起」。 */
export function RailDrawer({ d, over }: { d: RegionDefaults; over?: RailConfig }) {
  const [drawer, setDrawer] = useDrawer()
  const [handoff, setHandoff] = useHandoff()
  const masterReason = useMasterReason()
  const close = () => {
    setHandoff(true)
    setDrawer(null)
  }
  useEscToClose(drawer === "rail", close)
  if (drawer !== "rail") return null
  return (
    <DrawerFrame
      side="left"
      label="幻灯片列表"
      // 左栏第一行（主菜单 …… 单页 / 网格，data-v3-rail-top）左侧让出 38：开关 28 + 间距 4 + 主菜单的 -6 外边距
      className="[&_[data-v3-rail-top]]:pl-[38px]"
      toggle={
        <div className="absolute top-3 left-4">
          <PanelToggle side="left" open autoFocus={handoff} onToggle={close} />
        </div>
      }
    >
      {d.leftRail({ menu: { master: { reason: masterReason } }, drawer: true, ...over })}
    </DrawerFrame>
  )
}

/** 检查器抽屉（右）：桌面检查器原样（协作行、设计 / 评论、缩放、随选中切换的分区），第一行最右是「收起」。 */
export function InspectorDrawer({ d, over }: { d: RegionDefaults; over?: InspectorConfig }) {
  const [drawer, setDrawer] = useDrawer()
  const [handoff, setHandoff] = useHandoff()
  const close = () => {
    setHandoff(true)
    setDrawer(null)
  }
  useEscToClose(drawer === "inspector", close)
  if (drawer !== "inspector") return null
  return (
    <DrawerFrame
      side="right"
      label="检查器"
      // 检查器顶行（协作者 · 放映 · 分享，data-v3-inspector-top）右侧让出 52：开关 28 + 右边距 16 + 与「分享」的间距 8。
      // 用属性定位顶行，不依赖它是不是栏里的第一个子元素（桌面视口下栏的第一个子元素是分隔条）
      className="[&_[data-v3-inspector-top]]:pr-[52px]"
      toggle={
        <div className="absolute top-[10px] right-4">
          <PanelToggle side="right" open autoFocus={handoff} onToggle={close} />
        </div>
      }
    >
      {d.inspector({ drawer: true, ...over })}
    </DrawerFrame>
  )
}

/**
 * 紧凑形态的画布：底座画布外包一层——上方让出胶囊（72）、左右留白 24、抽屉盖住的一侧不算可用区（幻灯片与备注在未遮挡区域里适应）。
 * 左上胶囊排在画布之前（Tab / F6 顺序同桌面：左栏 → 画布 → 备注 → 工具条 → 检查器），右上胶囊跟在工具条之后（见 CompactToolbar）。
 * 2026-10-28（母版视图改版第一步）：紧凑形态的外壳在就声明「现在不能进入母版视图」（kit useMasterEntryGuard，原因与胶囊主菜单里同一句：「在更大窗口中编辑」，
 * 嵌入里「当前区域太窄，暂不可用」）——借用这套外框的状态（评论、快捷键、嵌入的紧凑态等）不必各自再写；已在母版视图里时不影响退出（rulings §4.25 TB-44）。
 * 这条说的是形态（form 守卫）：宿主先看模式与权限（评审、查看者、降权），再看它，排在状态显式写的原因之前（editor/master/mode.ts masterEntryOf，50/11 §3）；
 * 胶囊与抽屉主菜单里的「母版视图」以宿主给的原因为准（masterMenuOption），与 ⌥⌘M、命令面板同一条。2026-10-29 第一步修复第 4 轮（复验 R4-B1）
 */
export function CompactStage({ d, stage, menu, viewToggle, viewToggleReason, sheet }: {
  d: RegionDefaults
  /** 换掉底座画布（如母版视图的 MasterStage） */
  stage?: ReactNode
  /** 左上胶囊主菜单的定制（母版视图：「关闭母版视图」） */
  menu?: Partial<MainMenuOptions>
  /** 左上胶囊的单页 / 网格（母版视图里没有网格） */
  viewToggle?: boolean
  /** 左上胶囊的单页 / 网格暂不可用的原因（第 3 批 narrow-review：版本历史面板开着时「关闭版本历史后可用」）；不传时可用，与原来相同 */
  viewToggleReason?: string
  /** 底部 Sheet 打开时（图表数据面板，D-17）：幻灯片在 Sheet 之上的区域里适应，编辑时图表始终可见 */
  sheet?: boolean
}) {
  const covered = useCovered()
  useMasterEntryGuard(useMasterReason(), { form: true })
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col pt-8 [&>[data-v3-anchor=stage]]:px-6 [&>div:last-child]:px-6",
        covered === "left" && "pl-[240px]",
        covered === "right" && "pr-[280px]",
        sheet && "pb-[46vh]",
      )}
    >
      {covered !== "left" && <DocCapsule menu={menu} viewToggle={viewToggle} viewToggleReason={viewToggleReason} />}
      {stage ?? d.stage()}
    </div>
  )
}

/**
 * 紧凑形态的底部工具条：条目与桌面相同；抽屉打开时在未遮挡的区域里居中（不被抽屉压住）。右上胶囊放在它后面（Tab 顺序）。
 * 单页与网格视图里都挂着（借用这套外框的评论、窄屏复核、嵌入的紧凑态也是）：切换单页 / 网格时由这里收起抽屉（rulings §4.25 DS-170，form.ts useCloseDrawerOnViewChange）
 */
export function CompactToolbar({ d, toolbar, hidden }: { d: RegionDefaults; toolbar?: ReactNode; /** 底部 Sheet 盖住工具条时让位（右上胶囊照常） */ hidden?: boolean }) {
  const { view } = useEditor()
  const covered = useCovered()
  useCloseDrawerOnViewChange()
  return (
    <>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 [&>*]:pointer-events-auto",
          covered === "left" && "left-[240px]",
          covered === "right" && "right-[280px]",
        )}
      >
        {hidden ? null : (toolbar ?? d.toolbar())}
      </div>
      {view === "single" && covered !== "right" && <ShareCapsule />}
    </>
  )
}
