import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { FileWarning, Globe, Info, Lock, ScanSearch } from "lucide-react"
import {
  boxStyle, Button, CanvasHint, canvasFocusTarget, ContextMenu, DEGRADED_MENU_AT, degradedMenuItems, degradedReadOnly, DegradedSelection, HintDivider, holdFocusDuring, ICON, openContextMenuFromKey, PaperScope, RailList,
  RailThumb, rescueFocus, scrollIntoPanel, Toast, Toasts, useDemoOpen, useEditor, useEditorCommand, userHasInteracted, useSceneState, type Box, type DegradedInfo, type DegradedReadOnly,
} from "../../kit"
import { CHARTEX_BOX, EXT_BOX, placeholdersOn, worstLevelOn } from "./data"
import { useAllPagesEndWithReport } from "./ReportPanel"
import {
  useChipLife, useExtLoaded, useFidelityData, useLocated, useOpenReport, useReport, useReportDialogOpen, useReportOpen, useReturnFocus, useToast,
} from "./store"

/* ------------------------------------------------------------------ 画布列：打开后的差异提示（轻提示）、页级提示条、主菜单桥 */

/**
 * 画布列叠加层（canvasOverlay，单页与网格视图都在）：
 * - 轻提示（ui.notification，03-19 §4.3 的位置与外观）：打开文档、报告生成完、有差异时出一次——「9 项差异 · 1 项以占位显示 · 查看」；
 *   这是 03-10「入口角标短暂高亮」与 D4「首次打开时角标高亮 3 s」在 v3 的落点（没有应用栏，也不常驻角标）。不走横幅：03-12 的横幅只给数据安全与连接（另见 alt-banner）。
 * - 页级提示条（03-13「本页有 N 处内容无法完整显示 [查看详情]」，rulings §4.25 DS-51）：画布顶部居中的浮动胶囊（CanvasHint），换页不推挤画布；
 *   本会话里每页第一次进入时出现、约 5 秒后淡出，不设 ×；报告开着时不出，选中降级对象时让位（见 PageChip）。
 * - 主菜单「文件 › 保真报告」：底座命令 file.fidelity（kit/commands.ts）在这里接住，关闭报告后焦点交回主菜单按钮。
 */
export function FidelityCanvasLayer() {
  const ed = useEditor()
  const openReport = useOpenReport()
  useLocateEndsWithReport()
  useAllPagesEndWithReport()
  useEditorCommand("file.fidelity", () => {
    // 网格视图里没有检查器：先回单页（与网格里选创建工具同一做法），再打开；面板挂上后自己把焦点移进去（菜单关闭时不再抢回，kit keepMovedFocus）。
    // 菜单先收起、视图晚几帧才提交：这几帧里焦点交给画布列，不在 body 上停留（kit holdFocusDuring）
    if (ed.view === "grid") {
      ed.setView("single")
      holdFocusDuring()
    }
    openReport({ from: "main-menu" })
  })

  return (
    <>
      <PageChip />
      <EntryToast />
    </>
  )
}

/**
 * 报告（整栏面板）从任何入口收起时清掉画布上的定位高亮，与报告自己的「关闭」/ Esc（ReportPanel close）同一结果——
 * 另一个入口是点画布上的评论钉：底座先收起整栏面板再切到「评论」页签（editor/Stage.tsx StagePins），不经过报告的 close。
 * 只看整栏面板的开关由开到关的那一下；对话框备选（alt-dialog）不用整栏面板，不受影响。
 * 进出母版视图不算收起：宿主进入时不关面板、只在母版视图里不画（rulings §4.25 DS-162），开关一直开着，当前项与高亮都留着
 */
function useLocateEndsWithReport() {
  const [open] = useReportOpen()
  const [, setLoc] = useLocated()
  const was = useRef(open)
  useEffect(() => {
    if (was.current && !open) setLoc(null)
    was.current = open
  }, [open, setLoc])
}

function EntryToast() {
  const { items } = useReport()
  const [kind, setKind] = useToast()
  const [open] = useReportOpen()
  const openReport = useOpenReport()
  if (!kind || open) return null
  const close = () => setKind(null)
  const placeholders = items.filter((i) => i.level !== "info").length
  return (
    <Toasts>
      {kind === "open" && (
        // 「打开后有差异」一律中性 Info 图标（tone info，次级文字色；标杆对照「打开后的轻提示：图标颜色」，Q3）：有以占位显示的内容也不用警告色——
        // 警告色只留在缩略图角标与报告条目图标上；整页无法解析（下面的 parse）仍用错误色
        <Toast
          tone="info"
          description={placeholders ? `${placeholders} 项以占位显示；内容都已原样保留` : "内容都已原样保留，可以正常查看"}
          action="查看"
          onAction={() => openReport()}
          onClose={close}
        >
          {items.length} 项内容与原文件不同
        </Toast>
      )}
      {kind === "parse" && (
        <Toast tone="error" description="以占位显示，原内容已保留；其余页面不受影响" action="查看" onAction={() => openReport({ locate: { id: "parse-8", i: 0 } })} onClose={close}>
          第 8 页内容无法解析
        </Toast>
      )}
      {kind === "font" && (
        // 03-13：进入编辑模式时，文档含仅授权查看的字体，出一次轻提示 +「详情」（打开保真报告并定位到「字体」分组）
        <Toast icon={<Lock {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />} action="详情" onAction={() => openReport({ focus: "font-restricted" })} onClose={close}>
          1 种字体仅授权查看，编辑时以替代字体显示
        </Toast>
      )}
      {kind === "degraded" && (
        // 50/25 §2.2：双击或 Enter 不进入任何子编辑态，弹一次说明，带「查看保真详情」
        <Toast tone="info" action="查看保真详情" onAction={() => openReport({ locate: { id: "chartex", i: 0 } })} onClose={close}>
          此类图表暂不支持显示，已原样保留
        </Toast>
      )}
    </Toasts>
  )
}

/** 页级提示条停留多久后淡出（DS-51：约 5 秒）与淡出时长 */
const CHIP_MS = 5000
const CHIP_FADE_MS = 300
/** 提示条「查看详情」的锚点：从它打开的报告关闭后焦点回到这里（03-10 §2 关闭后焦点精确归还触发元素） */
const CHIP_DETAIL = "fidelity.chip-detail"

/**
 * 页级提示条（03-13 页级；DS-51 改写）：
 * - 本会话里每页只在第一次进入时出现（进入时报告开着、或选中着降级对象，这一页也算进入过），约 5 秒后淡出（减少动态效果时到点直接隐藏）；
 *   悬停或焦点在提示条上时停住、移开后重新计时（ChipShell）。不设 ×：它自己会消失，元素级占位与缩略图角标常驻，信息不会丢。
 * - 报告开着时不出；选中降级对象时让位（隐藏，由检查器的对象说明来讲），取消选中后不再补出；从别处打开报告同样结束，关上后不再补出。
 * - 从它自己的「查看详情」打开的报告是例外：提示条在用户用它的时候不算消失——报告开着时隐藏（仍在页面上、不渲染出来），关上后接着显示，
 *   焦点精确回到「查看详情」，焦点移开后重新计时。隐藏期间去掉锚点，kit closeWithFocusBack 同步收起报告后在同一个任务里把焦点交过去。
 * - 图标中性（Info，text-2），整页无法解析时用危险色（按这一页最严重一条的级别，由报告数据推导）；读屏：提示条本身是 status · polite 区，出现时播报一次
 *   （kit CanvasHint announce="next-frame"：出现后的两帧里内容先挡在无障碍树外再放进来，读屏看到的是已在的播报区里出现了内容，播报最稳），
 *   报告关上后接着显示不重新插入（不重复播报）。
 * - 静态样张用状态数据 chipHold 演示定格在出现后（page-hint、external-confirm）：用户第一次点按或按键后才开始计时。
 */
function PageChip() {
  const ed = useEditor()
  const d = useFidelityData()
  const { variant, items } = useReport()
  const [open] = useReportOpen()
  const [dialogOpen] = useReportDialogOpen()
  const [ret] = useReturnFocus()
  const [loaded, setLoaded] = useExtLoaded()
  const [life, setLife] = useChipLife()
  const openReport = useOpenReport()
  const held = useDemoOpen(!!d.chipHold)
  // 母版视图里当作不在单页（rulings §4.25 DS-158、TB-204）：进入时正在显示的提示条随之结束（同离开这一页），母版视图里不出；
  // 退出回到同一页时这一页已进入过，不再补出；回到没进过的页照常出（本会话每页第一次进入时出现，DS-51）
  const single = ed.view === "single" && !ed.masterView.on
  const slide = ed.slide
  const n = placeholdersOn(items, slide)
  // 报告开着：检查器整栏面板，或备选 alt-dialog 的对话框
  const reportOpen = open || dialogOpen
  const yieldSel = ed.selection === "degraded"

  // 进入一页（状态一出现、换页、从网格回到单页）：这一页本会话还没进过、有以占位显示的内容、报告没开、没选中降级对象 → 出提示条；
  // 不论出没出，都记为进入过（之后不再补出）。离开这一页时正在显示的提示条随之结束。只在换页 / 换视图时判断，报告开合、选中变化见下一个效果
  useLayoutEffect(() => {
    setLife((s) => {
      if (!single) return s.page === null ? s : { ...s, page: null }
      if (s.seen.includes(slide)) return s.page === null || s.page === slide ? s : { ...s, page: null }
      return { seen: [...s.seen, slide], page: n > 0 && !reportOpen && !yieldSel ? slide : null }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide, single])

  // 让位与结束：选中了降级对象，或从别处（不是提示条自己的「查看详情」）打开了报告
  const ends = life.page !== null && life.page === slide && (yieldSel || (reportOpen && ret !== CHIP_DETAIL))
  useEffect(() => {
    if (ends) setLife((s) => ({ ...s, page: null }))
  }, [ends, setLife])

  if (!single || life.page !== slide || n === 0) return null
  const hidden = reportOpen || yieldSel
  const end = () => setLife((s) => (s.page === slide ? { ...s, page: null } : s))
  // externalResources = confirm（03-13「外链资源」）：页级「本页包含来自外部网站的内容 [全部加载]」，本次打开内有效、不持久化；同一套停留规则。
  // 点完「全部加载」提示条随之消失：焦点交给画布，不掉到 body（07 §2.3）
  if (variant === "confirm" && slide === 8 && !loaded)
    return (
      <ChipShell label="外部内容" hidden={hidden} held={held} onEnd={end}>
        <Globe {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />
        本页包含来自外部网站的内容
        <HintDivider />
        <Button
          variant="ghost"
          className="-mx-1.5 px-2 text-(--v3-text)"
          onClick={() => {
            setLoaded(true)
            requestAnimationFrame(rescueFocus)
          }}
        >
          全部加载
        </Button>
      </ChipShell>
    )
  const unparsed = worstLevelOn(items, slide) === "danger"
  return (
    <ChipShell label="本页提示" hidden={hidden} held={held} onEnd={end}>
      {unparsed ? (
        <FileWarning {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-danger)" />
      ) : (
        <Info {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />
      )}
      {unparsed ? "此页内容无法解析" : `本页有 ${n} 处内容无法完整显示`}
      <HintDivider />
      <Button variant="ghost" className="-mx-1.5 px-2 text-(--v3-text)" data-v3-anchor={hidden ? undefined : CHIP_DETAIL} onClick={() => openReport({ scope: "page", from: CHIP_DETAIL })}>
        查看详情
      </Button>
    </ChipShell>
  )
}

/**
 * 页级提示条的外壳：kit CanvasHint 外面包一层 display: contents 的壳（不占版面、不改 CanvasHint 的定位），管停留与淡出——
 * 显示满 CHIP_MS 后淡出（Web Animations 透明度 1 → 0，CHIP_FADE_MS）再结束；减少动态效果时到点直接结束。
 * 悬停或焦点在里面时不计时（淡出途中被悬停 / 聚焦就停下、恢复不透明），移开后从头重新计时；held（演示定格）与 hidden（报告开着）时也不计时。
 * 焦点在提示条上时不会淡出，淡出因此不会带走焦点；万一提示条在焦点还在里面时被卸载（换页等），先把焦点交给画布（07 §2.3），不掉到 body。
 */
function ChipShell({ label, hidden, held, onEnd, children }: { label: string; hidden: boolean; held: boolean; onEnd: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState(false)
  const [focusIn, setFocusIn] = useState(false)
  const endRef = useRef(onEnd)
  endRef.current = onEnd
  const counting = !hidden && !held && !hover && !focusIn
  useEffect(() => {
    if (!counting) return
    let fade: Animation | null = null
    const t = window.setTimeout(() => {
      const el = ref.current?.firstElementChild
      if (!(el instanceof HTMLElement) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        endRef.current()
        return
      }
      fade = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CHIP_FADE_MS, easing: "ease-out", fill: "forwards" })
      fade.onfinish = () => endRef.current()
    }, CHIP_MS)
    return () => {
      window.clearTimeout(t)
      fade?.cancel()
    }
  }, [counting])
  // 隐藏期间（报告开着）指针离开时收不到 pointerleave：隐藏时清掉悬停记号，重新显示后按实际的悬停 / 焦点重新判断
  useEffect(() => {
    if (hidden) setHover(false)
  }, [hidden])
  useLayoutEffect(() => {
    const el = ref.current
    return () => {
      if (el?.contains(document.activeElement)) canvasFocusTarget()?.focus({ preventScroll: true })
    }
  }, [])
  return (
    <div
      ref={ref}
      data-fidelity-chip=""
      hidden={hidden || undefined}
      className="contents"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setFocusIn(true)}
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node | null)) setFocusIn(false)
      }}
    >
      {/* announce="next-frame"：提示条一出现就要可靠地播报一次——出现后的两帧里内容先挡在无障碍树外再放进来（kit CanvasHint，外观不变；第 2 批第 6 轮集成） */}
      <CanvasHint label={label} announce="next-frame">
        {children}
      </CanvasHint>
    </div>
  )
}

/* ------------------------------------------------------------------ 幻灯片上：无法显示的对象、外部内容的「加载」、定位高亮 */

export function FidelitySlideLayer() {
  const ed = useEditor()
  const { variant } = useReport()
  const chartex = ed.slide === 7 && (variant === "main" || variant === "parse" || variant === "confirm")
  return (
    <>
      {chartex && <ChartexObject />}
      {variant === "confirm" && ed.slide === 8 && <LoadExternal />}
      <LocateFlash />
    </>
  )
}

/**
 * 第 7 页的瀑布图占位（元素级降级，03-13）：可选中（8 个缩放手柄、没有旋转手柄，50/25 §2.2）、可移动 / 缩放 / 删除，不能进入内部编辑；
 * 双击只弹一次说明（带「查看保真详情」）。评审 / 查看者能选中、看检查器，不画手柄与尺寸角标。
 * 右键菜单的键盘等价：焦点在占位上按 ⇧F10 / 菜单键，在静态样张 degraded-menu 的同一落点打开同一份菜单
 * （底座 openContextMenuFromKey，与缺插件占位同一处；kit ContextMenu 只听 contextmenu 事件，macOS 上的 ⇧F10 不会产生它）。
 * 评审、只读浏览与降权照常出这份菜单，编辑类命令不可用（rulings §4.25 DS-64，见 degraded-menu-review；原「只在编辑模式挂、⇧F10 不出菜单」作废）。
 * 菜单关闭后焦点回到占位；选「查看保真详情」打开的报告关闭后，焦点同样回到这个占位（from: fidelity.chartex，03-10 §2）
 */
function ChartexObject() {
  const ed = useEditor()
  const [, setToast] = useToast()
  const readOnly = ed.mode !== "edit"
  return (
    <>
      <button
        type="button"
        data-v3-anchor="fidelity.chartex"
        aria-label="新式图表（瀑布图），暂不支持显示"
        onClick={(e) => {
          e.stopPropagation()
          ed.setSelection("degraded")
        }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          setToast("degraded")
        }}
        onKeyDown={(e) => {
          openContextMenuFromKey(e)
        }}
        className="pointer-events-auto absolute cursor-default"
        style={boxStyle(CHARTEX_BOX)}
      />
      {/* 选中框是底座的 DegradedSelection（与缺插件占位同一处决定手柄）：能缩放 → 8 个手柄 + 尺寸角标；只读角色只画选中框 */}
      {ed.selection === "degraded" && <DegradedSelection box={CHARTEX_BOX} info={ed.data.degraded as DegradedInfo | undefined} readOnly={readOnly} />}
    </>
  )
}

/** 外部图片的「加载」（externalResources = confirm）：纸面上的界面件，取亮色 token（PaperScope）；只画在画布上，缩略图里只有占位。点完按钮随占位消失：焦点先交给画布 */
function LoadExternal() {
  const [loaded, setLoaded] = useExtLoaded()
  if (loaded) return null
  return (
    <div className="pointer-events-none absolute" style={boxStyle(EXT_BOX)}>
      <PaperScope className="flex size-full items-center justify-end pr-[4%]">
        <Button
          variant="outline"
          className="pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation()
            // 按钮随占位卸载：先把焦点交给画布再改状态（同一个任务里交接，↵ / 空格按下时焦点不在 body 停一帧；同提示条「全部加载」）
            canvasFocusTarget()?.focus({ preventScroll: true })
            setLoaded(true)
          }}
        >
          加载
        </Button>
      </PaperScope>
    </div>
  )
}

/**
 * 定位高亮：对象是 2px 强调色外框（外移 2px，与 1px 选中框、1px 悬停区分开），整页是幻灯片外 2px 强调色外圈；不改选中（报告开着时检查器被面板占着，选中了也看不到属性）。
 * 用户点「定位」后停 1 s 再在 0.6 s 内淡出（03-10「短暂高亮」；减少动态效果时 1.6 s 后直接消失）；场景状态里一出现就定位好的停在高亮的那一刻，便于评审。
 */
function LocateFlash() {
  const ed = useEditor()
  const { items } = useReport()
  const [loc] = useLocated()
  if (!loc) return null
  const o = items.find((x) => x.id === loc.id)?.occ[loc.i]
  if (!o || o.page !== ed.slide) return null
  return <Flash key={loc.n} n={loc.n} at={o.at} />
}

/**
 * 用户操作后已经放过的那一次定位高亮（located.n，停留与淡出开始时记下）放在场景仓里，当作共用的记录用：只在副作用里改写、不通知订阅者，挂上时读一次。
 * 画布随进出母版视图卸下又挂上（整栏面板进入时不关，rulings §4.25 DS-162：恢复到进入前的样子）：这一下短暂高亮已经放过，重新挂上时不再画、也不重放；
 * 没人操作过、停在高亮那一刻的静态样张没放过，照旧停在高亮。换页后再回到这一页同此
 */
const FLASH_PLAYED_KEY = "fidelity.flash-played"

function Flash({ n, at }: { n: number; at: Box | "page" }) {
  const ref = useRef<HTMLDivElement>(null)
  const [played] = useSceneState<{ n: number | null }>(FLASH_PLAYED_KEY, () => ({ n: null }))
  const [gone, setGone] = useState(() => played.n === n)
  useEffect(() => {
    if (!userHasInteracted() || gone) return
    played.n = n
    const el = ref.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = window.setTimeout(() => setGone(true), 1600)
      return () => window.clearTimeout(t)
    }
    const a = el.animate([{ opacity: 1 }, { opacity: 1, offset: 0.62 }, { opacity: 0 }], { duration: 1600, easing: "ease-out", fill: "forwards" })
    a.onfinish = () => setGone(true)
    return () => a.cancel()
  }, [])
  if (gone) return null
  if (at === "page") return <div ref={ref} aria-hidden="true" className="pointer-events-none absolute -inset-1 rounded-[8px] border-2 border-(--v3-accent)" />
  return <div ref={ref} aria-hidden="true" className="pointer-events-none absolute outline-2 outline-offset-2 outline-(--v3-accent) outline-solid" style={boxStyle(at)} />
}

/* ------------------------------------------------------------------ 左栏：缩略图警示角标 */

/**
 * 缩略图级（03-13）：右上角角标，数字 = 该页以占位显示的元素数（与 main-states 缺插件同一个角标，与评论角标同位、配色不同）。
 * 角标按这一页最严重一条的级别着色（worstLevelOn，由报告数据推导）：parse-failed / parse-hint 的第 8 页是危险级——危险浅底 + 危险色 FileWarning、读屏名「1 处内容无法解析」，
 * 与报告条目、页级提示条同一个图标；其余是警告级（底座 RailThumb warnLevel 缺省 warning，第 1 批缺插件角标不变）
 */
export function ThumbList() {
  const ed = useEditor()
  const { items } = useReport()
  // 当前页不在左栏可视区里时（parse-failed、external-confirm 的第 8 页，或报告「定位」跳过去的页）把列表滚到它；已经看得见就不动
  useEffect(() => {
    const id = requestAnimationFrame(() => scrollIntoPanel(document.querySelector<HTMLElement>(`[data-v3-anchor="thumb-${ed.slide}"]`), { align: "center", ifNeeded: true }))
    return () => cancelAnimationFrame(id)
  }, [ed.slide])
  return (
    <RailList>
      {ed.deck.map((s) => {
        const n = placeholdersOn(items, s.n)
        return (
          <RailThumb key={s.n} slide={s} current={s.n === ed.slide} onPick={ed.goTo} warn={n} warnLevel={worstLevelOn(items, s.n) ?? undefined} />
        )
      })}
    </RailList>
  )
}

/* ------------------------------------------------------------------ 右键：无法显示的对象 */

/**
 * 无法显示的对象的右键菜单：底座 degradedMenuItems（与缺插件元素同一份，第 2 批集成上移），按 50/25 §2.5「能摆放」的口径
 * （剪贴板 ┊ 排列 · 组合 ┊ 替代文本 · 评论 ┊ 查看保真详情 ┊ 删除），没有格式类命令、没有旋转；替代文本对 AlternateContent 系（chartex 在其中）只读，
 * 留在原位不可用并写原因「需在 PowerPoint 中修改」。03-05 原写「复制 · 删除 · 查看保真详情」，两处差别按 50/25 收口（DS-52）。
 * readOnly（评审 / 只读浏览 / 降权，底座 degradedReadOnly 按模式取）：同一份条目，编辑类命令不可用、顶部一行写原因（DS-64）
 */
function degradedMenu(onFidelity: () => void, readOnly: DegradedReadOnly | undefined) {
  return degradedMenuItems({ detail: { label: "查看保真详情", icon: <ScanSearch {...ICON} />, onSelect: onFidelity }, altReason: "需在 PowerPoint 中修改", readOnly })
}

/** 放在 layers：只在第 7 页挂（锚点只在那里）；各模式都挂，评审、只读浏览与降权是只读形态（DS-64）；staticOpen 时一出现就打开在占位上 */
export function DegradedMenuLayer({ staticOpen }: { staticOpen: boolean }) {
  const ed = useEditor()
  const { variant } = useReport()
  const openReport = useOpenReport()
  if (ed.slide !== 7 || !(variant === "main" || variant === "parse" || variant === "confirm")) return null
  // 「查看保真详情」：报告关闭后焦点回到这个占位（右键的对象）
  const items = degradedMenu(() => openReport({ locate: { id: "chartex", i: 0 }, from: "fidelity.chartex" }), degradedReadOnly(ed))
  const select = () => ed.setSelection("degraded")
  return staticOpen ? (
    <ContextMenu at={{ anchor: "fidelity.chartex", ...DEGRADED_MENU_AT }} label="新式图表" items={items} onTarget={select} />
  ) : (
    <ContextMenu target="fidelity.chartex" defaultOpen={false} label="新式图表" items={items} onTarget={select} />
  )
}
