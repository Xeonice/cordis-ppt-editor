import { useEffect, useLayoutEffect, useRef } from "react"
import { Blocks, Minimize2, X } from "lucide-react"
import { closeWithFocusBack, ICON, IconButton, overlayOpen, useEditor, userHasInteracted, type EditorCtx, type RegionDefaults } from "../../kit"
import { CompactStage, CompactToolbar, InspectorDrawer, RailDrawer } from "../narrow/compact"
import { useDrawer, useHandoff } from "../narrow/form"
import { pollInspectorRegion, PollPanelContent, usePollPanel } from "../plugins/poll"
import type { RailConfig } from "../types"
import { RailSwitch, StageSwitch, VIEW_LOCK } from "../version-history/chrome"
import { useVh } from "../version-history/store"

/**
 * narrow-review 的紧凑形态（640–1024，DS-17）件：沿用第 1 批 narrow 场景已拍板的抽屉与胶囊（narrow/compact.tsx：左右抽屉同一时刻只开一个、胶囊在抽屉打开的一侧让位、
 * 画布与工具条在未遮挡区适应），这里只补三类整栏面板在紧凑形态里的落位（rulings §4.25 DS-130）：
 * - 列表与报告类（版本历史、保真报告）：进右侧检查器抽屉，抽屉整栏换成面板，宽 280 不变（DS-38 的「沿用检查器宽度」）；
 * - 编辑与整页类（插件整页面板）：画布底部 Sheet（46vh、整宽、无遮罩、顶部把手、上圆角 12），同图表数据面板的先例（narrow.compact-chart-data，D-17）；
 * - 未采纳的备选：全部进右侧抽屉，整页类时抽屉加宽到 400（alt-takeover-drawer-400）。
 * 另补一条：抽屉从横幅下沿开始，横幅（版本预览的「返回当前版本 / 恢复此版本」）不被抽屉盖住——rulings §4.25 DS-130 采纳后由 narrow/compact.tsx 的 DrawerFrame 自己读横幅总高
 * （2026-10-22 第 3 批转正第一段并入底座，原来这里的局部件 BelowBanner 删去；第 1 批母版视图紧凑态的抽屉随之不再盖母版横幅）。
 */

/** 紧凑形态的四个区域（narrow 场景 COMPACT 的同一组：comments.compact 也是这样接的）；抽屉从横幅下沿开始是 DrawerFrame 自己的（DS-130） */
export const COMPACT_REGIONS = {
  leftRail: (_: EditorCtx, d: RegionDefaults) => <RailDrawer d={d} />,
  inspector: (_: EditorCtx, d: RegionDefaults) => <InspectorDrawer d={d} />,
  stage: (_: EditorCtx, d: RegionDefaults) => <CompactStage d={d} />,
  toolbar: (_: EditorCtx, d: RegionDefaults) => <CompactToolbar d={d} />,
}

/* ------------------------------------------------------------------ 版本历史（列表进右侧抽屉） */

const mergeRail = (a?: RailConfig, b?: RailConfig): RailConfig => ({ ...a, ...b, menu: { ...a?.menu, ...b?.menu } })

/**
 * 版本历史在紧凑形态里：抽屉里的检查器整栏就是第 2 批的版本历史面板（HistoryPanel，宽 280），左栏抽屉在预览时换成所选版本的页（RailSwitch），
 * 画布在未遮挡区显示所选版本（StageSwitch），预览时工具条收起（ToolbarSwitch 同一规则）、右上胶囊照常让位。
 * 面板开着时主菜单「视图 › 网格视图」与左上胶囊的「单页 / 网格」都与桌面同一原因不可用（VIEW_LOCK「关闭版本历史后可用」：网格视图没有检查器栏，放不下面板）——
 * 胶囊经 narrow CompactStage 的 viewToggleReason（第 3 批修复轮加的可选属性，缺省可用），与左抽屉顶行（RailSwitch 的 viewToggle）同一画法
 */
export const VH_REGIONS = {
  leftRail: (_: EditorCtx, d: RegionDefaults) => <RailDrawer d={{ ...d, leftRail: (over) => <RailSwitch d={{ ...d, leftRail: (o2) => d.leftRail(mergeRail(o2, over)) }} /> }} />,
  inspector: COMPACT_REGIONS.inspector,
  stage: (_: EditorCtx, d: RegionDefaults) => <VhStage d={d} />,
  toolbar: (_: EditorCtx, d: RegionDefaults) => <VhToolbar d={d} />,
}

function VhStage({ d }: { d: RegionDefaults }) {
  const vh = useVh()
  return (
    <CompactStage
      d={d}
      stage={<StageSwitch d={d} />}
      menu={vh.open ? { gridReason: VIEW_LOCK.reason } : undefined}
      viewToggleReason={vh.open ? VIEW_LOCK.reason : undefined}
    />
  )
}

function VhToolbar({ d }: { d: RegionDefaults }) {
  const vh = useVh()
  return <CompactToolbar d={d} hidden={vh.previewing} />
}

/* ------------------------------------------------------------------ 插件整页面板（画布底部 Sheet） */

/* 插件整页面板开着没有：就是插件场景的 usePollPanel（plugins/poll.tsx 导出，第 3 批转正时删去这里的一份；分区里的「展开」写同一个键） */

/** 紧凑形态：插件整页面板改为画布底部 Sheet（跟着触发它的投票元素走：选中别的对象就收起，同桌面） */
export function PollSheet() {
  const { selection } = useEditor()
  const [open] = usePollPanel()
  if (!open || selection !== "plugins-poll") return null
  return <PollSheetBody />
}

/**
 * Sheet 本体（开着时才挂载，键盘与焦点钩子随它挂载 / 卸载）：同图表数据面板的 Sheet（narrow/compact-features DataSheet）——高 46vh、整宽、上圆角 12、
 * 顶部 1px 分隔线与把手、浮层阴影、不加遮罩；标题行与桌面整栏面板相同（「现场投票」+ 归属说明「第三方插件 · Beta Labs」·「收起到检查器」·「关闭」Esc），
 * 内容就是桌面面板的同一份（PollPanelContent：问题、参与方式、状态），底部固定一行说明。
 * 从检查器抽屉里插件分区的「展开」打开时：Sheet 取代抽屉里的分区，抽屉收起（不再盖住 Sheet 右侧、也不重复一份），焦点移进 Sheet 的第一个控件；
 * 「收起到检查器」：抽屉重新打开、焦点回「展开」；「关闭」/ Esc：焦点交给右上胶囊的「显示检查器」
 */
function PollSheetBody() {
  const { mode } = useEditor()
  const [, setOpen] = usePollPanel()
  const [drawer, setDrawer] = useDrawer()
  const [, setHandoff] = useHandoff()
  const ref = useRef<HTMLElement>(null)
  const close = () => {
    const toggle = document.querySelector<HTMLElement>('button[aria-label="显示检查器"]')
    if (toggle) {
      toggle.focus({ preventScroll: true })
      setOpen(false)
    } else closeWithFocusBack(() => setOpen(false), null, ref.current)
  }
  const collapse = () =>
    closeWithFocusBack(
      () => {
        setDrawer("inspector")
        setOpen(false)
      },
      "plugins.poll-expand",
      ref.current,
    )
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    if (drawer !== "inspector") return
    // 焦点已交给 Sheet 里的第一个控件：抽屉收起后右上胶囊的「显示检查器」重新挂上时不要抢走它（handoff 为 false 就不 autoFocus，同图表数据 Sheet）
    setHandoff(false)
    setDrawer(null)
    // 只在打开时
  }, [])
  // 用户打开时焦点进内容区的第一个可操作控件（同 InspectorTakeover 的落点规则：内容区第一个，没有就给「关闭」）；状态里一出现就开着的不抢焦点
  useLayoutEffect(() => {
    if (!userHasInteracted()) return
    const body = ref.current?.querySelector<HTMLElement>("[data-sheet-body]")
    const first = body?.querySelector<HTMLElement>('input, textarea, button:not([aria-disabled="true"]), [role="checkbox"]')
    ;(first ?? ref.current?.querySelector<HTMLElement>('button[aria-label="关闭"]'))?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing || overlayOpen()) return
      e.preventDefault()
      closeRef.current()
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [])
  const readOnly = mode !== "edit"
  return (
    <section ref={ref} aria-label="现场投票面板" className="absolute inset-x-0 bottom-0 z-30 flex h-[46vh] flex-col rounded-t-[12px] border-t border-(--v3-border) bg-(--v3-panel) shadow-(--v3-shadow)">
      <span aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-[2px] bg-(--v3-handle)" />
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-(--v3-border) pr-3 pl-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] leading-4 font-semibold text-(--v3-text)">现场投票</h2>
          <p className="mt-1 flex items-center gap-1 text-[12px] leading-4 text-(--v3-text-2)">
            <Blocks size={12} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
            第三方插件 · Beta Labs
          </p>
        </div>
        <IconButton label="收起到检查器" onClick={collapse}>
          <Minimize2 {...ICON} />
        </IconButton>
        <IconButton label="关闭" kbd="Esc" onClick={close}>
          <X {...ICON} />
        </IconButton>
      </div>
      <div data-sheet-body="" className="relative min-h-0 flex-1 overflow-y-auto">
        <PollPanelContent readOnly={readOnly} />
      </div>
      {!readOnly && (
        <div className="shrink-0 border-t border-(--v3-border) px-4 py-3">
          <p className="text-[12px] leading-[18px] text-(--v3-text-2)">结果每 5 秒更新；结束投票后结果保留在幻灯片上</p>
        </div>
      )}
    </section>
  )
}

/** Sheet 开着时幻灯片在 Sheet 之上的区域里适应、底部工具条让位（同 narrow.compact-chart-data） */
export const POLL_SHEET_REGIONS = {
  ...COMPACT_REGIONS,
  stage: (_: EditorCtx, d: RegionDefaults) => <PollStage d={d} />,
  toolbar: (_: EditorCtx, d: RegionDefaults) => <PollToolbar d={d} />,
}

function PollStage({ d }: { d: RegionDefaults }) {
  const { selection } = useEditor()
  const [open] = usePollPanel()
  return <CompactStage d={d} sheet={open && selection === "plugins-poll"} />
}

function PollToolbar({ d }: { d: RegionDefaults }) {
  const { selection } = useEditor()
  const [open] = usePollPanel()
  return <CompactToolbar d={d} hidden={open && selection === "plugins-poll"} />
}

/* ------------------------------------------------------------------ DS-130 未采纳的备选：整页类也进右侧抽屉，加宽到 400 */

/**
 * DS-130 未采纳的备选（alt-takeover-drawer-400）：插件整页面板也进右侧抽屉（就是桌面的整栏面板 InspectorTakeover，400 宽），抽屉跟着加宽到 400；
 * 画布与工具条在剩下的 600 里适应（narrow 的未遮挡区按 280 算，这里在外层把右侧让出量改成 400）
 */
export const DRAWER_400_REGIONS = {
  ...COMPACT_REGIONS,
  inspector: (ctx: EditorCtx, d: RegionDefaults) => <InspectorDrawer d={{ ...d, inspector: (over) => <>{pollInspectorRegion(ctx, { ...d, inspector: (o2) => d.inspector({ ...o2, ...over }) })}</> }} />,
  stage: (_: EditorCtx, d: RegionDefaults) => <Wide400 d={d} part="stage" />,
  toolbar: (_: EditorCtx, d: RegionDefaults) => <Wide400 d={d} part="toolbar" />,
}

function Wide400({ d, part }: { d: RegionDefaults; part: "stage" | "toolbar" }) {
  const [drawer] = useDrawer()
  const [open] = usePollPanel()
  const { selection } = useEditor()
  const wide = drawer === "inspector" && open && selection === "plugins-poll"
  const cls = !wide ? "contents" : part === "stage" ? "contents [&>div:first-child]:pr-[400px]" : "contents [&>div:first-child]:right-[400px]"
  return <div className={cls}>{part === "stage" ? <CompactStage d={d} /> : <CompactToolbar d={d} />}</div>
}
