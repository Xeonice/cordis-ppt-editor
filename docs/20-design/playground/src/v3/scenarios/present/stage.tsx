import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react"
import { flushSync } from "react-dom"
import { Check, ChevronLeft, ChevronRight, Ellipsis, RectangleHorizontal, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DeckSlideView, DOC_TITLE, FollowBar, HintDivider, ICON_LG, IconButton, KeyCap, LoadingRow, MENU_CONTENT, MENU_ITEM, PageJumpHint, PageJumpInput, StageScope, TOGGLE_ON, TOOLBAR_BAR,
  ToolbarDivider, useBreakpoint, useDemoOpen, useEditor, useEditorCommand, useMasterEntryGuard, userHasInteracted, useSceneState, WANG, type FollowMode, type RegionDefaults,
} from "../../kit"
import type { RegionSlot } from "../types"

/**
 * 放映舞台（03-11，前端 50/10 §9 是行为唯一源；第 3 批 v3 重画）。用 regions 把左栏、检查器、工具条换成 null、stage 换成整块舞台（不改共享代码）；
 * 舞台盖满画布列（absolute inset-0），所以与编辑器的窗口一样大——产品里是浏览器全屏（50/10 §9.1，Fullscreen API 在样张里不演示，只画全屏后的样子）。
 *
 * 画面：舞台底 --v3-stage 上幻灯片 16:9 居中、按宽或按高适应，不裁切（03-11 边界「极窄屏 / 竖屏」）；放映渲染每页结束态、不播放动画与切换（CS-03、Q7）。
 * 控制条（09 T-05、04 §2.2：去模糊、改实色）：与编辑器底部工具条同一外观（kit TOOLBAR_BAR：底部居中、距底 16、panel 实底、1px 边、圆角 12、内边距 4、浮层阴影），
 *   取暗色 token（StageScope：舞台与界面主题无关）。按钮 36（图标 20），组间 1px 分隔：上一页 · 3 / 6 · 下一页 ┊ 黑屏 · 更多 ┊ 退出放映。
 *   演讲者视图不在 M2–M3（PRD 07 §4 D3）：不出现、也不灰显；「显示 / 隐藏光标」不做（rulings §4.25 DS-107）。
 * 显隐（50/10 §9.2 取值；DS-107）：鼠标移动时浮现，静止 3 秒后控制条与指针一起隐藏（200ms 淡出，减少动态效果时直接切换）；指针停在控制条上、
 *   「更多」展开、或键盘焦点在控制条里时不隐藏（Tab 进入控制条即浮现，键盘用户不依赖鼠标）。样张里「刚进入」的那一下不算移动：只认连续两次指针事件之间 ≥ 3px 的位移，
 *   所以截图脚本把鼠标挪到上沿时画面不变，评审时动一下鼠标即开始真实的显隐。
 * 键盘（50/10 §9.2、UX-07）：→ / 空格 / PageDown 下一页、← / PageUp 上一页、Home / End 首末页、数字 + ↵ 跳页（TB-104）、B 黑屏、W 白屏（切换键）、Esc 退出；
 *   黑屏 / 白屏时任一翻页键、数字 + ↵ 或单击只恢复当前页、不翻页；末页之后是结束页（TB-102），结束页上控制条的「下一页」不可用（原因「放映已结束」）。
 *   焦点在控制条按钮上时 空格 / ↵ 按按钮自己的含义。
 * 指针：鼠标单击画面 = 下一页（黑屏时恢复、结束页时退出）；触控单击只显隐控制条、左右轻扫翻页（按 pointerType 区分，rulings §4.25 TB-111）。
 * 读屏：舞台 role=application（方向键与空格交给放映）、名称「放映：文档名」；幻灯片 role=img「第 N 页：页名」；翻页、黑白屏、结束页由舞台里一个常驻的 polite 区播报
 *   「第 4 页，共 6 页：营收趋势」；控制条 role=toolbar「放映控制」。退出后焦点回到编辑器里的「放映」按钮（50/10 §9.1 的「退出」之后，本样张演示）。
 * 退出：Esc 或「退出放映」回到编辑器，停在放映里最后显示的那一页（50/10 §3.3，DS-109）；样张里退出后再点「放映」（从当前页）或按 ⇧F5 / F5（从头）可以重新进入（底座命令 present / present.fromStart）。
 * 放映中不弹横幅与轻提示（03-12 §14、50/10 §11 规则 9），不显示评论钉（DS-43）、远端光标、软冲突与保真提示（03-11）。
 */

export type Blank = "black" | "white" | null

/** 各状态的初值（EditorConfig.data.present）。 */
export interface PresentSeed {
  /** 控制条一出现就浮现（鼠标刚移动过）；缺省 false = 鼠标静止，控制条与指针都隐藏（03-11 的缺省画面） */
  bar?: boolean
  /** 黑屏 / 白屏 */
  blank?: Blank
  /** 「更多」一出现就展开 */
  menu?: boolean
  /** 跳页：已敲下的数字（提示条一出现就在）；jumpInput 为「更多 › 跳至页码…」打开的输入形态 */
  jump?: string
  jumpInput?: boolean
  /** 末页之后的结束页（TB-102） */
  end?: boolean
  /** 正在进入放映（首屏渲染前） */
  entering?: boolean
  /** 观众跟随主讲人（M3）：模式与主讲人当前页 */
  follow?: FollowMode
  presenterPage?: number
  /** 触控尺寸（手机：按钮 44、间距 8，PRD 07 G-68）；视口 < 640 时自动 */
  touch?: boolean
  /** DS-107 未采纳的备选：进入放映时 3 秒的键盘提示浮层 */
  keyHints?: boolean
}

interface Jump {
  digits: string
  /** 「更多 › 跳至页码…」打开的输入形态（焦点在输入框里） */
  input: boolean
}

const EXITED = "present.exited"
const seedOf = (data: Record<string, unknown>) => (data.present ?? {}) as PresentSeed
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()
const stopProps = { onPointerDown: stop, onPointerUp: stop, onClick: stop }

/* ------------------------------------------------------------------ 舞台 */

export function PresentStage() {
  const ed = useEditor()
  // 放映进行中没有编辑器外壳：⌥⌘M 既不进入母版视图也不提示，命令面板与主菜单都不在（2026-10-28 母版视图改版第一步；03-26 §1.1「放映没有编辑器外壳」）
  useMasterEntryGuard("放映中", { silent: true })
  const seed = seedOf(ed.data)
  const bp = useBreakpoint()
  const touch = !!seed.touch || bp === "narrow"
  const [, setExited] = useSceneState(EXITED, false)
  const [blank, setBlank] = useSceneState<Blank>("present.blank", seed.blank ?? null)
  const [end, setEnd] = useSceneState("present.end", !!seed.end)
  const [menu, setMenu] = useSceneState("present.menu", !!seed.menu)
  const [jump, setJump] = useSceneState<Jump | null>("present.jump", seed.jump !== undefined || seed.jumpInput ? { digits: seed.jump ?? "", input: !!seed.jumpInput } : null)
  const [bar, setBar] = useSceneState("present.bar", !!seed.bar || !!seed.menu)
  const [follow, setFollow] = useSceneState<FollowMode | null>("present.follow", seed.follow ?? null)
  const presenterPage = seed.presenterPage ?? ed.slide
  const [say, setSay] = useState("")
  const root = useRef<HTMLDivElement>(null)

  const pages = ed.deck.map((s) => s.n)
  const first = pages[0] ?? 1
  const last = pages[pages.length - 1] ?? 1
  const total = pages.length
  const visible = bar || menu

  /* ---------------- 翻页、黑白屏、结束页、退出 */
  const show = (n: number) => {
    ed.goTo(n)
    const s = ed.deck.find((x) => x.n === n)
    setSay(`第 ${n} 页，共 ${total} 页：${s?.name ?? ""}`)
  }
  const leaveFollow = () => {
    if (follow === "following") setFollow("free")
  }
  const restore = () => {
    setBlank(null)
    setSay(`已恢复第 ${ed.slide} 页`)
  }
  const exit = () => {
    // 退出后焦点回到编辑器里的「放映」按钮（50/10 §9.1；键盘退出时它的工具提示「从当前页放映 ⇧F5」随之出现）。
    // 按钮随退出才重新挂上：同步提交退出（flushSync），在同一个任务里交过去，焦点不经过 body（07 §2.4）
    flushSync(() => {
      setMenu(false)
      setJump(null)
      setBlank(null)
      setEnd(false)
      setFollow(null)
      setExited(true)
    })
    document.querySelector<HTMLElement>('[data-v3-anchor="present"]')?.focus({ preventScroll: true })
  }
  const next = () => {
    if (blank) return restore()
    if (end) return exit()
    leaveFollow()
    const i = pages.indexOf(ed.slide)
    if (i >= pages.length - 1) {
      setEnd(true)
      setSay("放映结束，单击退出")
    } else show(pages[i + 1] ?? last)
  }
  const prev = () => {
    if (blank) return restore()
    leaveFollow()
    if (end) {
      setEnd(false)
      show(ed.slide)
      return
    }
    const i = pages.indexOf(ed.slide)
    if (i > 0) show(pages[i - 1] ?? first)
  }
  const goEdge = (n: number) => {
    if (blank) return restore()
    leaveFollow()
    setEnd(false)
    show(n)
  }
  const toggleBlank = (b: "black" | "white") => {
    const v = blank === b ? null : b
    setBlank(v)
    setSay(v === "black" ? "黑屏" : v === "white" ? "白屏" : `已恢复第 ${ed.slide} 页`)
  }
  const jumpTo = (n: number) => {
    setJump(null)
    if (blank) return restore()
    leaveFollow()
    setEnd(false)
    show(n)
  }

  /* ---------------- 跳页（TB-104：约 3 秒无输入自动清空；样张里一出现就有的数字等用户第一次操作后才开始计时） */
  const jumpTimer = useRef<number | undefined>(undefined)
  const armJumpClear = () => {
    window.clearTimeout(jumpTimer.current)
    jumpTimer.current = window.setTimeout(() => setJump((j) => (j && !j.input ? null : j)), 3000)
  }
  const typeDigit = (d: string) => {
    // 50/10 §9.2：黑屏 / 白屏时数字 + ↵ 同翻页键，只恢复当前页
    if (blank) return restore()
    const cur = jump && !jump.input ? jump.digits : ""
    const digits = (cur + d).replace(/^0+/, "").slice(0, 3)
    setJump(digits ? { digits, input: false } : null)
    armJumpClear()
  }

  /* ---------------- 控制条显隐 */
  const hideTimer = useRef<number | undefined>(undefined)
  const overBar = useRef(false)
  const menuOpen = useRef(menu)
  menuOpen.current = menu
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const scheduleHide = () => {
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      if (!overBar.current && !menuOpen.current) setBar(false)
    }, 3000)
  }
  useEffect(
    () => () => {
      window.clearTimeout(hideTimer.current)
      window.clearTimeout(jumpTimer.current)
    },
    [],
  )
  const onPointerMove = (e: ReactPointerEvent) => {
    if (e.pointerType !== "mouse") return
    const p = lastPos.current
    lastPos.current = { x: e.clientX, y: e.clientY }
    if (!p || Math.hypot(e.clientX - p.x, e.clientY - p.y) < 3) return
    if (!bar) setBar(true)
    scheduleHide()
  }

  /* ---------------- 单击翻页（鼠标）、单击显隐与轻扫翻页（触控） */
  const down = useRef<{ x: number; y: number; type: string } | null>(null)
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return
    // 「更多」展开或跳页输入框开着时，点画面只收起它们，不翻页
    if (menu || jump?.input) {
      down.current = null
      setMenu(false)
      return
    }
    down.current = { x: e.clientX, y: e.clientY, type: e.pointerType }
    root.current?.focus({ preventScroll: true })
  }
  const onPointerUp = (e: ReactPointerEvent) => {
    const d = down.current
    down.current = null
    if (!d || seed.entering) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (d.type === "touch" || d.type === "pen") {
      if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.5) return dx < 0 ? next() : prev()
      if (Math.hypot(dx, dy) < 10) {
        setBar(!bar)
        if (!bar) scheduleHide()
      }
      return
    }
    if (Math.hypot(dx, dy) < 6) next()
  }

  /* ---------------- 键盘（挂在 document，状态取最新） */
  const onKey = useRef<(e: KeyboardEvent) => void>(() => undefined)
  onKey.current = (e) => {
    if (e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return
    const t = e.target instanceof HTMLElement ? e.target : null
    // 「更多」菜单里的方向键、↵、空格、Esc 由菜单自己处理
    if (t?.closest("[data-present-menu]")) return
    const k = e.key
    if (k === "Escape") {
      e.preventDefault()
      exit()
      return
    }
    // 跳页输入框：数字、退格、↵ 由输入框处理
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return
    if ((k === " " || k === "Enter") && t?.closest("button")) return
    if (seed.entering) return
    let handled = true
    if (/^[0-9]$/.test(k)) typeDigit(k)
    else if (k === "Backspace" && jump && !jump.input) {
      setJump(jump.digits.length > 1 ? { ...jump, digits: jump.digits.slice(0, -1) } : null)
      armJumpClear()
    } else if (k === "Enter" && jump && !jump.input && jump.digits) {
      const n = Number(jump.digits)
      if (pages.includes(n)) jumpTo(n)
    } else if (k === "ArrowRight" || k === " " || k === "PageDown") next()
    else if (k === "ArrowLeft" || k === "PageUp") prev()
    else if (k === "Home") goEdge(first)
    else if (k === "End") goEdge(last)
    else if (k === "b" || k === "B") toggleBlank("black")
    else if (k === "w" || k === "W") toggleBlank("white")
    else if (/^[vtscVTSC]$/.test(k) || k === "F5") {
      // 编辑器的工具单键（V T S C）在放映中无效；F5 / ⇧F5 是浏览器的刷新键，放映中吞掉（rulings §4.25 DS-108；preventDefault 后底座也不再发 present 命令）
    } else handled = false
    if (handled) e.preventDefault()
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey.current(e)
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [])

  // 黑屏状态的演示：「黑屏」按钮的工具提示「恢复当前页 B」一出现就展开，用户第一次点按或按键后收起
  const blackTip = useDemoOpen(seed.blank === "black")
  const btn = touch ? 44 : 36
  const prevOff = !blank && !end && ed.slide === first

  return (
    <StageScope
      ref={root}
      data-v3-anchor="stage"
      data-v3-present-stage=""
      tabIndex={-1}
      role="application"
      aria-label={`放映：${DOC_TITLE}`}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      className={cn("absolute inset-0 z-[25] overflow-hidden outline-none select-none", !visible && !touch && "cursor-none")}
    >
      {seed.entering ? (
        // 首屏渲染前（03-11 加载中）：舞台底 + 居中转圈与一句话（DS-53），避免白屏闪烁；控制条不出现
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingRow label="正在进入放映">正在进入放映…</LoadingRow>
        </div>
      ) : (
        <>
          {/* 幻灯片：16:9 居中，按宽或按高适应；舞台底留边 */}
          <div className="absolute inset-0 flex items-center justify-center [container-type:size]">
            <div className="w-[min(100cqw,calc(100cqh*16/9))]">
              <DeckSlideView slide={ed.current} where="canvas" />
            </div>
          </div>

          {/* 黑屏 / 白屏：画面纯黑 / 纯白，页码不变 */}
          {blank && <div aria-hidden="true" className={cn("absolute inset-0 z-10", blank === "black" ? "bg-(--v3-stage-black)" : "bg-(--v3-stage-white)")} />}

          {/* 末页之后（TB-102）：黑底结束页，居中一行 */}
          {end && !blank && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-(--v3-stage-black)">
              <p className="text-[16px] leading-6 text-(--v3-text)">放映结束，单击退出</p>
            </div>
          )}

          {/* 跳页提示条（TB-104，03-20 §7 同一个件 kit PageJumpHint / PageJumpInput、取舞台的暗色 token；放映里不写「Esc 取消」）与跟随条同在顶部居中：同一位置只放一条，跳页优先 */}
          {jump &&
            (jump.input ? (
              <PageJumpInput total={total} pages={pages} onCommit={jumpTo} onClose={() => setJump(null)} />
            ) : jump.digits ? (
              <PageJumpHint digits={jump.digits} total={total} exists={pages.includes(Number(jump.digits))} esc={false} />
            ) : null)}
          {follow && !jump && (
            <FollowBar
              person={WANG}
              mode={follow}
              touch={touch}
              hidden={follow === "following" && !visible}
              onStop={() => setFollow("free")}
              onResync={() => {
                setFollow("following")
                setEnd(false)
                setBlank(null)
                show(presenterPage)
              }}
            />
          )}

          {seed.keyHints && <KeyHints hidden={visible} />}

          <div
            role="toolbar"
            aria-label="放映控制"
            {...stopProps}
            onPointerEnter={() => {
              overBar.current = true
            }}
            onPointerLeave={() => {
              overBar.current = false
              if (bar) scheduleHide()
            }}
            className={cn(
              TOOLBAR_BAR,
              touch && "gap-2",
              "transition-opacity duration-200 motion-reduce:transition-none",
              visible ? "opacity-100" : "pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100",
            )}
          >
            <IconButton size={btn} label="上一页" kbd="←" disabled={prevOff} reason="已是第一页" onClick={prev}>
              <ChevronLeft {...ICON_LG} />
            </IconButton>
            <span className={cn("flex min-w-14 items-center justify-center px-1 text-[13px] leading-none text-(--v3-text) tabular-nums", touch ? "h-11" : "h-9")}>
              {ed.slide}
              <span className="px-1 text-(--v3-text-2)">/</span>
              {total}
            </span>
            {/* 结束页（TB-102）：「下一页」留在原位、不可用并写原因（同 Figma 末页 › 置灰）——按钮不改成「退出放映」，免得控制条上出现两颗同名按钮；
                退出靠单击画面、→ / 空格 / PageDown、Esc 或「退出放映」 */}
            <IconButton size={btn} label="下一页" kbd="→" disabled={end && !blank} reason="放映已结束" onClick={next}>
              <ChevronRight {...ICON_LG} />
            </IconButton>
            <ToolbarDivider />
            {/* 黑屏是开关：按下态用强调色淡底（DS-36，同 B / I / U / S），aria-pressed；按下时提示改为「恢复当前页」 */}
            <IconButton
              size={btn}
              label="黑屏"
              tip={blank === "black" ? "恢复当前页" : "黑屏"}
              kbd="B"
              pressed={blank === "black"}
              tipOpen={blackTip}
              onClick={() => toggleBlank("black")}
              className={blank === "black" ? cn(TOGGLE_ON, "text-(--v3-text) hover:bg-(--v3-toggle-on) hover:text-(--v3-text)") : undefined}
            >
              {/* 描边矩形里填舞台黑（--v3-stage-black）：读作「画面变黑」；原来实心 currentColor 的矩形在暗色控制条上是一块浅色，像「白屏」 */}
              <RectangleHorizontal {...ICON_LG} className="fill-(--v3-stage-black)" />
            </IconButton>
            <MoreMenu
              open={menu}
              size={btn}
              touch={touch}
              white={blank === "white"}
              onOpenChange={(v) => {
                setMenu(v)
                if (!v && bar) scheduleHide()
              }}
              onWhite={() => toggleBlank("white")}
              onJump={() => setJump({ digits: "", input: true })}
            />
            <ToolbarDivider />
            <IconButton size={btn} label="退出放映" kbd="Esc" onClick={exit}>
              <X {...ICON_LG} />
            </IconButton>
          </div>
        </>
      )}
      {/* 翻页、黑白屏、结束页的播报（常驻、polite，挂载时为空） */}
      <span aria-live="polite" className="sr-only">
        {say}
      </span>
    </StageScope>
  )
}

/* ------------------------------------------------------------------ 「更多」 */

/**
 * 「更多」：向上展开（与编辑器工具条按钮的菜单同一位置规则：离控制条 8、对齐按钮中线），菜单外观同 kit 菜单（MENU_CONTENT / MENU_ITEM：panel 实底、1px 边、圆角 8、条目 28），
 * 取舞台的暗色 token——不经 kit Menu 的 Portal（它挂在界面根节点上，亮色主题下会变成白色菜单压在黑色舞台上），所以在舞台里就地画、键盘规则照 kit 菜单：
 * 用户打开时焦点进第一项，↑ ↓ / Home / End 移动、↵ / 空格选、Esc 收起并把焦点交回「更多」、Tab 收起；点菜单外面收起。
 * 条目：白屏（勾选项，W）· 跳至页码…（打开跳页条并把焦点放进输入，TB-104）。演讲者视图不出现也不灰显（D3）；「显示 / 隐藏光标」不做（DS-107）；退出放映已在控制条上，不重复（Q2）。
 * 窗口内舞台（全屏被拒或刷新后，50/10 §9.1）时多一项「全屏」，只在非全屏时出现（DS-108）；浏览器或容器不允许全屏（document.fullscreenEnabled 为假）时
 * 这一项也不出现，与查看器的全屏按钮同一规则（rulings §4.25 TB-134）。样张画的是全屏后的样子，不出现这一项。
 * 触控时条目高 44（G-68），不写键位提示：「白屏」后的 W、「跳至页码…」后的「数字 ↵」都不画（触控形态的菜单项一律不写键位，键位照常列在快捷键面板「放映」组；
 * rulings §4.25 TB-164，50/10 §9.2「触控」、03-11 §1.5）；桌面照常写。
 */
function MoreMenu({
  open,
  size,
  touch,
  white,
  onOpenChange,
  onWhite,
  onJump,
}: {
  open: boolean
  size: 36 | 44
  touch: boolean
  white: boolean
  onOpenChange: (v: boolean) => void
  onWhite: () => void
  onJump: () => void
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const items = () => Array.from(list.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? [])
  const backToTrigger = () => wrap.current?.querySelector<HTMLElement>("[data-present-more]")?.focus({ preventScroll: true })
  // 用户打开：焦点进第一项（场景状态里一出现就展开的不抢焦点，截图里没有焦点环）
  useEffect(() => {
    if (open && userHasInteracted()) items()[0]?.focus({ preventScroll: true })
  }, [open])
  // 点菜单外面收起（点「更多」本身由它自己切换）
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) onOpenChange(false)
    }
    document.addEventListener("pointerdown", onDown, true)
    return () => document.removeEventListener("pointerdown", onDown, true)
  }, [open, onOpenChange])
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const all = items()
    const i = all.indexOf(document.activeElement as HTMLElement)
    const go = (j: number) => {
      e.preventDefault()
      all[(j + all.length) % all.length]?.focus()
    }
    if (e.key === "ArrowDown") go(i + 1)
    else if (e.key === "ArrowUp") go(i - 1)
    else if (e.key === "Home") go(0)
    else if (e.key === "End") go(all.length - 1)
    else if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      onOpenChange(false)
      backToTrigger()
    } else if (e.key === "Tab") onOpenChange(false)
  }
  const row = cn(MENU_ITEM, "w-full text-left hover:bg-(--v3-panel-2) focus:bg-(--v3-panel-2)", touch && "h-11 text-[13px]")
  return (
    <div ref={wrap} className="relative">
      <IconButton
        size={size}
        label="更多"
        aria-haspopup="menu"
        aria-expanded={open}
        data-present-more=""
        tipHidden={open}
        onClick={() => onOpenChange(!open)}
        className={open ? "bg-(--v3-panel-2) text-(--v3-text)" : undefined}
      >
        <Ellipsis {...ICON_LG} />
      </IconButton>
      {open && (
        <div
          ref={list}
          role="menu"
          aria-label="更多"
          data-present-menu=""
          onKeyDown={onKeyDown}
          className={cn(MENU_CONTENT, "absolute bottom-[calc(100%+13px)] left-1/2 min-w-[168px] -translate-x-1/2 whitespace-nowrap")}
        >
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={white}
            className={row}
            onClick={() => {
              onWhite()
              onOpenChange(false)
              backToTrigger()
            }}
          >
            <span className="flex w-4 shrink-0 items-center justify-center">{white && <Check size={12} strokeWidth={2} aria-hidden="true" />}</span>
            <span className="flex-1">白屏</span>
            {!touch && <kbd className="ml-4 shrink-0 font-sans text-[11px] text-(--v3-text-2)">W</kbd>}
          </button>
          <button
            type="button"
            role="menuitem"
            className={row}
            onClick={() => {
              onOpenChange(false)
              onJump()
            }}
          >
            <span aria-hidden="true" className="w-4 shrink-0" />
            <span className="flex-1">跳至页码…</span>
            {!touch && <kbd className="ml-4 shrink-0 font-sans text-[12px] text-(--v3-text-2)">数字 ↵</kbd>}
          </button>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ DS-107 未采纳：键盘提示浮层 */

/**
 * rulings §4.25 DS-107 未采纳的备选（PRD 07 G-36 原写法）：进入放映时在控制条的位置浮出一行键盘提示，3 秒后淡出；设置（03-23）另加「进入放映时显示键盘提示」开关（本样张不画）。
 * 样张里一出现就有，用户第一次点按或按键后开始计时；控制条浮现时让位。
 */
function KeyHints({ hidden }: { hidden: boolean }) {
  const hold = useDemoOpen()
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (hold) return
    const id = window.setTimeout(() => setGone(true), 3000)
    return () => window.clearTimeout(id)
  }, [hold])
  if (gone) return null
  const item = "flex items-center gap-1.5"
  return (
    <div
      role="note"
      aria-label="放映的键盘操作"
      className={cn(
        "pointer-events-none absolute bottom-4 left-1/2 z-20 flex h-9 -translate-x-1/2 items-center gap-3 rounded-[12px] border border-(--v3-border) bg-(--v3-panel) px-3 text-[12px] leading-none whitespace-nowrap text-(--v3-text-2) shadow-(--v3-shadow) transition-opacity duration-200 motion-reduce:transition-none",
        hidden && "opacity-0",
      )}
    >
      <span className={item}>
        <KeyCap>→</KeyCap>
        <KeyCap>空格</KeyCap>
        下一页
      </span>
      <HintDivider />
      <span className={item}>
        <KeyCap>←</KeyCap>
        上一页
      </span>
      <HintDivider />
      <span className={item}>
        <KeyCap>数字</KeyCap>
        <KeyCap>↵</KeyCap>
        跳页
      </span>
      <HintDivider />
      <span className={item}>
        <KeyCap>B</KeyCap>
        黑屏
      </span>
      <HintDivider />
      <span className={item}>
        <KeyCap>W</KeyCap>
        白屏
      </span>
      <HintDivider />
      <span className={item}>
        <KeyCap>Esc</KeyCap>
        退出
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ 放映 ⇄ 编辑器（regions） */

/** 放映中左栏、检查器、工具条都不渲染；退出后回到编辑器（这几块换回底座的缺省渲染）。 */
function Chrome({ d, part }: { d: RegionDefaults; part: "leftRail" | "inspector" | "toolbar" }) {
  const [exited] = useSceneState(EXITED, false)
  if (!exited) return null
  return <>{part === "leftRail" ? d.leftRail() : part === "inspector" ? d.inspector() : d.toolbar()}</>
}

/** 舞台区域：放映中是舞台；退出后是编辑器画布，接底座命令 present（「放映」按钮与 ⇧F5，从当前页）/ present.fromStart（F5，从头）重新进入（样张演示；按钮的提示「从当前页放映 ⇧F5」由底座给，TB-103）。 */
function StageRegion({ d }: { d: RegionDefaults }) {
  const [exited] = useSceneState(EXITED, false)
  return exited ? (
    <>
      {d.stage()}
      <Reentry />
    </>
  ) : (
    <PresentStage />
  )
}

function Reentry() {
  const ed = useEditor()
  const [, setExited] = useSceneState(EXITED, false)
  const first = ed.deck[0]?.n ?? 1
  const enter = useRef<(fromStart: boolean) => void>(() => undefined)
  enter.current = (fromStart) => {
    // 舞台随进入才挂上、「放映」按钮随之卸载：同步提交后在同一个任务里把焦点交给舞台（不经过 body）
    flushSync(() => {
      if (fromStart) ed.goTo(first)
      setExited(false)
    })
    document.querySelector<HTMLElement>("[data-v3-present-stage]")?.focus({ preventScroll: true })
  }
  // 底座命令（第 3 批转正，kitRequest g3 K10）：三处「放映」按钮与 ⇧F5 发 present，F5 发 present.fromStart（底座 useBaseKeys；原来在 document 捕获阶段听点按与 F5）
  useEditorCommand("present", () => enter.current(false))
  useEditorCommand("present.fromStart", () => enter.current(true))
  return null
}

/** 放映状态共用的 regions：左栏、检查器、工具条在放映中不渲染，画布换成舞台。 */
export const PRESENT_REGIONS: Partial<Record<keyof RegionDefaults, RegionSlot>> = {
  leftRail: (_, d) => <Chrome d={d} part="leftRail" />,
  inspector: (_, d) => <Chrome d={d} part="inspector" />,
  toolbar: (_, d) => <Chrome d={d} part="toolbar" />,
  stage: (_, d) => <StageRegion d={d} />,
}
