import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import { Blocks, Lock, Search, TriangleAlert, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  arrivedVia, Button, canvasFocusTarget, Dialog, EmptyNote, findAnchor, FloatingPanel, focusBack, holdFocusDuring, ICON, IconButton, InspectorNotice, Kbd, Tag, TextField,
  useDismissOnMasterToggle, useEditorMaybe, useEscapeThroughTooltip, usePageMaybe, userHasInteracted, useSceneState,
} from "../../kit"
import { usePlugins } from "../plugins/store"
import { BUILTIN_GROUPS, builtinGroups, CONFLICTS, filterGroups, HOME_GROUP, pluginGroups, type ConflictKind, type ShortcutGroup, type ShortcutRow } from "./data"
import { formatChord, joinAlternatives, type Platform } from "./keys"
import { useAppWiring } from "./nav"

/** 打开前的焦点在菜单里时（从主菜单「帮助」、开始页帮助菜单、账户菜单打开，底座命令在选中条目的同一个任务里发出），记下打开那份菜单的触发按钮——条目随菜单卸载，关闭面板后焦点交回触发按钮 */
function focusOrigin(): HTMLElement | null {
  const a = document.activeElement
  if (!(a instanceof HTMLElement) || a === document.body) return null
  const menu = a.closest<HTMLElement>('[role="menu"]')
  if (!menu) return a
  // 子菜单里的条目：一路找到最外层那份菜单的触发按钮（Radix 菜单内容的 aria-labelledby 指向触发按钮）
  let el: HTMLElement | null = menu
  let trigger: HTMLElement | null = null
  for (let i = 0; el && i < 4; i++) {
    const id = el.getAttribute("aria-labelledby")
    const t: HTMLElement | null = id ? document.getElementById(id) : null
    if (!t) break
    trigger = t
    el = t.closest<HTMLElement>('[role="menu"]')
  }
  return trigger
}

/**
 * 03-24 键盘快捷键面板（第 3 批 · g4）。rulings §4.25 DS-115：画布浮动面板——非模态，画布列右上（与查找和替换同一位置、同一时刻只开一个），宽 360，
 * 高在横幅与底部工具条之间（列表在面板里滚动），层级 --layer-panel（kit FloatingPanel）；开着时画布照常可点、可试键。
 * 开始页没有画布：浮在主区右上、顶栏之下（静态表，40/11 G-10：没有插件组与冲突，最上一组「开始页」）。
 * 未采纳的备选（shortcuts.alt-dialog）：居中模态对话框（Google Slides 的 ⌘/ 列表），开着时不能在画布上试键。
 *
 *   ┌──────────────────────────────┐
 *   │ 键盘快捷键                  × │  标题 13px 600 · 关闭（Esc）
 *   │ [⌕ 搜索快捷键              ] │  即时过滤：功能名与关键词；空组隐藏，插件组同样参与
 *   ├──────────────────────────────┤
 *   │ 全局                          │  组标题 12px 600，滚动时吸顶；组间 1px 分隔
 *   │ 撤销                      ⌘Z │  功能名 12px · 键位 11px 次级文字色（与菜单、工具提示同一种写法）
 *   │ 重做              ⇧⌘Z 或 ⌘Y │
 *   │ …                             │
 *   │ ⧉ 聚焦搜索 · 内置             │  插件每个一组，带归属图标与来源
 *   └──────────────────────────────┘
 *
 * 只读速查：不提供改键（重映射是集成方能力，PRD ED-16 / PM-11）。冲突条目下追加一行说明与「在插件中查看」（打开个人插件面板的冲突态，第 2 批 plugins.conflict*），
 * 两侧（被占的内置条目、未生效的插件条目）都写（03-24 缺口③）。评审 / 只读浏览：改文档的条目留在原位置灰，顶部一行写原因（FE-06、TB-22）。
 * Esc（浮动形态）：面板里任意位置都响应（同第 1 批查找和替换）——焦点在搜索框且有搜索词时先清空，其余关闭并把焦点交回打开它的地方；输入法组合中不响应；
 * 焦点停在带工具提示的按钮上（× 写着 Esc）时一下就关（kit useEscapeThroughTooltip）。备选对话框形态由 kit Dialog 处理（Esc 直接关闭）。
 * 搜索的播报：搜索框下一个 polite 区，输入停顿 300 ms 后写「找到 N 个快捷键」或无结果的那句（先清空、下一帧再写，同一句也会再念；07 §3「结果数量变化播报」）。
 */

/** 状态私有数据（EditorConfig.data / PageConfig.data） */
export interface ShortcutsData {
  /** 状态一出现面板就开着（缺省 true） */
  kOpen?: boolean
  /** 搜索框里已有的词 */
  kQuery?: string
  /** 键名写法（缺省 mac）：win = Ctrl / Alt / Shift */
  kPlatform?: Platform
  /** 冲突演示：user 可为我关闭 · locked 一方由管理员统一启用（与 plugins.conflict / conflict-locked 同一对） */
  kConflict?: ConflictKind
  /** 形态：floating（缺省，DS-115）· dialog（DS-115 未采纳的备选） */
  kForm?: "floating" | "dialog"
  /**
   * 列表一出现就滚到某处（演示用，用户打开时从顶部开始）：end 末尾（让插件组与「视图」组同屏，冲突两侧都看得到）·
   * { group } 那一组的标题到列表顶 · { row } 那一行到吸顶的组标题之下（列表中段的条目在截图里看得到；nudge 再往回挪几像素，让列表上下两端都落在行的留白里，不裁到字）
   */
  kScroll?: "end" | { group: string } | { row: string; nudge?: number }
  /** SDK 单人 preset（「全局」组多「保存 ⌘S」，50/10 §10.4 第 17 行；参考应用不列，TB-116） */
  kPreset?: "solo"
}

interface ShortcutsUi {
  open: boolean
  query: string
}

const UI_KEY = "shortcuts.ui"
type Mode = "edit" | "review" | "viewer"

/** 面板所在的宿主：编辑器（有模式、视图）或开始页（页面宿主） */
function useHostInfo() {
  const ed = useEditorMaybe()
  const pg = usePageMaybe()
  // form：紧凑形态的背景（compact-backdrop.tsx，与 narrow 场景同一个键）
  const data = (ed?.data ?? pg?.data ?? {}) as ShortcutsData & { form?: string } & Record<string, unknown>
  return { data, mode: (ed?.mode ?? "edit") as Mode, view: ed?.view ?? "single", home: !ed && pg?.host === "home" }
}

function useShortcutsUi(): [ShortcutsUi, (p: Partial<ShortcutsUi>) => void] {
  const { data } = useHostInfo()
  const [ui, set] = useSceneState<ShortcutsUi>(UI_KEY, () => ({ open: data.kOpen ?? true, query: data.kQuery ?? "" }))
  return [ui, (p) => set((u) => ({ ...u, ...p }))]
}

/**
 * 键位：几个可互换的和弦之间写「或」（三个以上「、」分隔，最后一个前写「或」），读屏同一句。
 * 「、」紧贴前一个键（全角顿号自带右侧留白，前后都不另加间距），「或」两边各留 4（g4-08：原来顿号也当成独立的一项排，两边都空出 4）
 */
function Chords({ row, platform, off }: { row: ShortcutRow; platform: Platform; off?: boolean }) {
  const keys = (platform === "win" && row.keysWin) || row.keys
  const list = keys.map((k) => formatChord(k, platform))
  const sep = cn("text-[12px] leading-4", off ? "text-(--v3-text-3)" : "text-(--v3-text-2)")
  return (
    <span className="flex shrink-0 items-center whitespace-nowrap">
      <span className="sr-only">{joinAlternatives(list)}</span>
      {list.map((k, i) => (
        <Fragment key={k}>
          {i > 0 && i === list.length - 1 && (
            <span aria-hidden="true" className={cn("mx-1", sep)}>
              或
            </span>
          )}
          <span aria-hidden="true" className="flex items-center">
            <Kbd className={cn("leading-4", off && "text-(--v3-text-3)")}>{k}</Kbd>
            {i < list.length - 2 && <span className={sep}>、</span>}
          </span>
        </Fragment>
      ))}
    </span>
  )
}

/** 一处冲突的说明行 +「在插件中查看」（打开个人插件面板的冲突态，对话框盖在快捷键面板上；关闭后焦点回到这里，03-24 缺口④） */
function ConflictNote({ kind, side, onOpen }: { kind: ConflictKind; side: "builtin" | "plugin"; onOpen: (anchor: string) => void }) {
  const c = CONFLICTS[kind]
  const anchor = `shortcuts.conflict-${side}`
  return (
    <div className="mt-1 grid grid-cols-[12px_minmax(0,1fr)] items-start gap-x-1.5">
      <span className="flex h-4 items-center text-(--v3-warning)">
        <TriangleAlert size={12} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-[12px] leading-4 text-(--v3-text)">
        {side === "builtin" ? (
          <>
            与插件<span className="whitespace-nowrap">「{c.pluginName}」</span>冲突，当前由<span className="whitespace-nowrap">「{c.builtinLabel}」</span>生效
          </>
        ) : (
          <>
            与内置<span className="whitespace-nowrap">「{c.builtinLabel}」</span>冲突，未生效
          </>
        )}
      </p>
      <span />
      <Button variant="ghost" data-v3-anchor={anchor} className="-ml-2 h-6 justify-self-start px-2" onClick={() => onOpen(anchor)}>
        在插件中查看
      </Button>
    </div>
  )
}

interface ListProps {
  groups: ShortcutGroup[]
  platform: Platform
  /** 评审 / 只读浏览：改文档的条目置灰 */
  mode: Mode
  conflict?: ConflictKind
  query: string
  /** 开始页：编辑器的各组前加一行「以下快捷键在编辑器中生效」 */
  home?: boolean
  onConflict?: (anchor: string) => void
  /** 可被程序聚焦的一行（冲突被占的内置条目：冲突解决后、说明行随之消失时焦点交给它，03-24 缺口④） */
  focusRow?: string
}

/** 列表：组标题吸顶、组间 1px 分隔；一个功能一行（功能名 · 键位），说明条目与作用域提醒写在下一行 */
function ShortcutList({ groups, platform, mode, conflict, query, home, onConflict, focusRow }: ListProps) {
  const uid = useId()
  const ro = mode !== "edit"
  const reason = mode === "viewer" ? "只有查看权限" : "评审模式下不可用"
  const c = conflict ? CONFLICTS[conflict] : null
  const shown = filterGroups(groups, query)
  if (!shown.length)
    return (
      <EmptyNote>
        没有与<span className="whitespace-nowrap">「{query.trim()}」</span>相关的快捷键
      </EmptyNote>
    )
  return (
    <>
      {shown.map((g, gi) => (
        <section key={g.id} aria-labelledby={`${uid}-${g.id}`} data-k-group={g.id} className={cn(gi > 0 && "border-t border-(--v3-border)")}>
          {home && g.id === "global" && <p className="px-4 pt-3 text-[12px] leading-4 text-(--v3-text-2)">以下快捷键在编辑器中生效</p>}
          <h3 id={`${uid}-${g.id}`} className="sticky top-0 z-[1] flex h-8 items-center gap-1.5 bg-(--v3-panel) px-4 text-[12px] leading-4 font-semibold text-(--v3-text)">
            {g.plugin && <Blocks size={12} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />}
            {g.title}
            {g.plugin && <span className="font-normal text-(--v3-text-2)">· {g.plugin.source}</span>}
          </h3>
          {/* 组标题下的说明行（工具组的生效条件）：排在吸顶标题之后、不往上收（g4-01：原来 -mt-1 让行盒钻到吸顶标题下面，字头被盖住 2px） */}
          {g.description && <p className="px-4 pb-1 text-[12px] leading-4 text-(--v3-text-2)">{g.description}</p>}
          <ul className="pb-2">
            {g.rows.map((r) => {
              const off = (ro && !!r.edit) || (mode === "viewer" && !!r.comment)
              const label = mode === "review" && r.reviewLabel ? r.reviewLabel : r.label
              const builtinConflict = !!c && r.id === c.builtinRow
              const pluginConflict = !!c && r.id === c.pluginRow
              const focusable = builtinConflict || r.id === focusRow
              return (
                <li
                  key={r.id}
                  data-k-row={r.id}
                  // 冲突解决后（为我关闭）焦点交给被占的这一条（03-24 缺口④）：只有它可以被程序聚焦，不进 Tab 顺序；冲突消失后仍保留锚点，对话框关闭时交得过来
                  data-v3-anchor={focusable ? `shortcuts.row-${r.id}` : undefined}
                  tabIndex={focusable ? -1 : undefined}
                  className="px-4 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-(--v3-accent) focus-visible:ring-inset"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={cn("flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] leading-4", off ? "text-(--v3-text-3)" : "text-(--v3-text)")}>
                      {label}
                      {r.tag && <Tag>{r.tag}</Tag>}
                      {pluginConflict && <Tag>未生效</Tag>}
                      {off && <span className="sr-only">（{reason}）</span>}
                    </span>
                    <Chords row={r} platform={platform} off={off} />
                  </div>
                  {r.hint && <p className={cn("mt-0.5 text-[12px] leading-4", off ? "text-(--v3-text-3)" : "text-(--v3-text-2)")}>{r.hint}</p>}
                  {builtinConflict && conflict && onConflict && <ConflictNote kind={conflict} side="builtin" onOpen={onConflict} />}
                  {pluginConflict && conflict && onConflict && <ConflictNote kind={conflict} side="plugin" onOpen={onConflict} />}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}

/**
 * 有冲突的状态（只在编辑器）：读第 2 批个人插件面板的场景状态（plugins/store usePlugins，同一部署）——在面板里「为我关闭」聚焦搜索后，
 * 它的快捷键随插件卸载：插件组与两处冲突行即时消失（03-24 缺口④ 推荐「即时刷新」），对话框关闭后焦点交给被占的「缩小」这一条（原来的链接已随冲突消失）
 */
function ConflictList(props: Omit<ListProps, "onConflict" | "conflict"> & { conflict: ConflictKind }) {
  const api = usePlugins()
  const focusOff = props.conflict === "user" && api.ui.mine["cordex:focus-search"] === false
  const rowAnchor = `shortcuts.row-${CONFLICTS[props.conflict].builtinRow}`
  useEffect(() => {
    if (focusOff && api.ui.open && api.ui.returnTo !== rowAnchor) api.set({ returnTo: rowAnchor })
  }, [focusOff, api, rowAnchor])
  if (focusOff) return <ShortcutList {...props} conflict={undefined} focusRow={CONFLICTS[props.conflict].builtinRow} groups={props.groups.filter((g) => g.id !== "plugin-focus-search")} />
  return <ShortcutList {...props} onConflict={(anchor) => api.openPanelFrom(anchor)} />
}

/** 搜索框（kit 淡底字段，DS-35；不加清除按钮，TB-117）。Esc 在面板根节点处理：有搜索词时先清空，再按一次关面板（同查找替换的逐层退出） */
function SearchBox({ query, onQuery }: { query: string; onQuery: (q: string) => void }) {
  return (
    <TextField
      aria="搜索快捷键"
      placeholder="搜索快捷键"
      value={query}
      onChange={onQuery}
      leading={<Search {...ICON} aria-hidden="true" className="shrink-0" />}
      anchor="shortcuts.search"
    />
  )
}

const SEARCH_INPUT = '[data-v3-anchor="shortcuts.search"] input'

/** 打开时焦点进搜索框（用户打开的）；状态里一出现就开着的不抢焦点 */
function focusSearch() {
  document.querySelector<HTMLInputElement>(SEARCH_INPUT)?.focus({ preventScroll: true })
}

/**
 * 面板宿主（编辑器放 canvasOverlay，开始页放 page.overlay）：开关与搜索词是场景状态；⌘/、主菜单「帮助 › 键盘快捷键」、开始页帮助菜单与账户菜单的「键盘快捷键」打开
 * （底座命令 help.shortcuts，本宿主接住，再按 ⌘/ 收起）；编辑器里的 ⌘K 由编辑器的缺省命令面板原地打开（2026-10-28 起，editor/palette-host.ts；没有编辑器外壳的状态照旧由底座转到命令面板样张），
 * ⌘, 由底座转到偏好设置的样张（provides）。关闭时先把焦点交回打开它的地方再收起（不经过 body）。
 */
export function ShortcutsHost() {
  const host = useHostInfo()
  const [ui, set] = useShortcutsUi()
  const [drawer] = useSceneState<"rail" | "inspector" | null>("narrow.drawer", null)
  const back = useRef<HTMLElement | null>(null)
  const platform = host.data.kPlatform ?? "mac"
  const form = host.data.kForm ?? "floating"
  const conflict = host.home ? undefined : host.data.kConflict

  const open = () => {
    if (ui.open) {
      focusSearch()
      return
    }
    back.current = focusOrigin()
    // 从菜单打开：条目卸载的那一刻焦点接到搜索框（kit holdFocusDuring），挂上后再兜一次
    holdFocusDuring(1000, () => document.querySelector<HTMLElement>(SEARCH_INPUT))
    set({ open: true })
    window.setTimeout(focusSearch, 0)
  }
  /** 收起：焦点先交回打开它的地方（打开前的焦点元素 → 转过来时的入口 → 主菜单按钮 → 画布），再卸载 */
  const close = () => {
    const via = arrivedVia()
    const to =
      (back.current?.isConnected ? back.current : null) ??
      (via ? findAnchor(document, via) : null) ??
      (host.home ? null : findAnchor(document, "main-menu")) ??
      canvasFocusTarget()
    focusBack(to)
    back.current = null
    set({ open: false, query: "" })
  }

  useAppWiring({ "help.shortcuts": () => (ui.open ? close() : open()) })

  // 进出母版视图时收起（rulings §4.25 TB-204；DS-158）：普通视图里开着的面板进入时收起，母版视图里 ⌘/ 再开的退出时收起，退出后不再弹出。
  // 只收起、不交还焦点（宿主在同一次提交里把焦点交给落点，close() 会先 focusBack，两边抢焦点）；开始页上同一个件没有编辑器上下文，钩子不起作用。
  // 对话框形态是模态，开着时 ⌥⌘M 不响应、主菜单也点不到，实际只收起浮动形态
  useDismissOnMasterToggle(ui.open, () => {
    back.current = null
    set({ open: false, query: "" })
  })

  /** 浮动形态的面板根（Esc 在面板里任意位置都响应，g4-02） */
  const box = useRef<HTMLDivElement>(null)
  // 焦点停在带工具提示的按钮上（× 的提示写着 Esc）：提示会先吃掉第一下 Esc，这里让同一下直接关面板
  useEscapeThroughTooltip(ui.open && form === "floating", box, () => close())
  const onPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Escape" || e.nativeEvent.isComposing || e.defaultPrevented) return
    e.preventDefault()
    e.stopPropagation()
    const inSearch = e.target instanceof HTMLInputElement && !!e.target.closest('[data-v3-anchor="shortcuts.search"]')
    if (inSearch && ui.query) set({ query: "" })
    else close()
  }

  // 由命令转过来（别的样张里选了「键盘快捷键」）：面板随状态一出现就开着，焦点交给搜索框
  useEffect(() => {
    if (ui.open && userHasInteracted()) window.setTimeout(focusSearch, 0)
    // 只在挂载时
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!ui.open) return null
  const body = (
    <PanelBody
      platform={platform}
      mode={host.mode}
      conflict={conflict}
      home={host.home}
      solo={!host.home && host.data.kPreset === "solo"}
      query={ui.query}
      onQuery={(q) => set({ query: q })}
      scroll={host.data.kScroll}
    />
  )
  if (form === "dialog")
    return (
      <Dialog title="键盘快捷键" open onOpenChange={(v) => !v && close()} returnFocus="main-menu" bodyClassName="flex flex-col p-0 pt-3" className="h-[min(720px,calc(100dvh-64px))]">
        {body}
      </Dialog>
    )
  // 开始页：主区右上、顶栏（56）之下 12，右缘对齐顶栏的内容边（顶栏左右内边距 32，与「新建演示文稿」同一条右缘，g4-16），离底 24；
  // 编辑器：画布列右上，让开横幅；下沿与备注框底边对齐（离画布列底 72，g4-06：原 74 比备注框底边高 2，备注框右下角从面板下露出一道台阶）；
  // 网格视图与紧凑形态里再让开右上「协作与分享」胶囊（48 + 12，同紧凑形态的查找面板）
  const capsule = host.view === "grid" || host.data.form === "compact"
  // 紧凑形态里展开了检查器抽屉（右侧 280，narrow 场景的场景状态 narrow.drawer）：面板随画布的未遮挡区让到抽屉左侧（同底部工具条）
  const besideDrawer = host.data.form === "compact" && drawer === "inspector"
  const placement = host.home ? "top-[68px] right-8 bottom-6" : cn("bottom-[72px]", capsule && "mt-[60px]", besideDrawer && "right-[292px]")
  return (
    <FloatingPanel label="键盘快捷键" className={cn("flex w-[360px] flex-col overflow-hidden", placement)}>
      {/* display: contents 的壳不占版面：只为在面板根上接 Esc（键盘事件从面板里任何一个控件冒泡上来） */}
      <div ref={box} className="contents" onKeyDown={onPanelKeyDown}>
        <div className="flex h-11 shrink-0 items-center justify-between pr-2 pl-4">
          <h2 className="text-[13px] leading-4 font-semibold">键盘快捷键</h2>
          <IconButton label="关闭" kbd="Esc" size={24} onClick={close}>
            <X {...ICON} />
          </IconButton>
        </div>
        {body}
      </div>
    </FloatingPanel>
  )
}

function PanelBody({
  platform,
  mode,
  conflict,
  home,
  solo,
  query,
  onQuery,
  scroll,
}: {
  platform: Platform
  mode: Mode
  conflict?: ConflictKind
  home: boolean
  /** SDK 单人 preset：「全局」组多「保存 ⌘S」（TB-116） */
  solo?: boolean
  query: string
  onQuery: (q: string) => void
  scroll?: ShortcutsData["kScroll"]
}) {
  // 开始页没有 host：静态表（40/11 G-10），没有插件组与冲突；最上一组「开始页」（TB-105、TB-116）。
  // 母版视图的三个键在内置分组里（data.ts BUILTIN_GROUPS，rulings §4.25 TB-196），编辑器与开始页的静态表都列出
  const groups = home ? [HOME_GROUP, ...BUILTIN_GROUPS] : [...builtinGroups({ solo }), ...pluginGroups(conflict)]
  const ro = mode !== "edit"
  const list = { groups, platform, mode, query, home }
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current
    if (!scroll || !el) return
    const apply = () => {
      if (scroll === "end") el.scrollTop = el.scrollHeight
      else if ("group" in scroll) {
        const sec = el.querySelector<HTMLElement>(`[data-k-group="${scroll.group}"]`)
        if (sec) el.scrollTop = sec.offsetTop
      } else {
        // 那一行排到吸顶的组标题之下（offsetTop 相对列表本身：列表是 relative 的定位容器）
        const row = el.querySelector<HTMLElement>(`[data-k-row="${scroll.row}"]`)
        const head = row?.closest("section")?.querySelector<HTMLElement>("h3")
        if (row) el.scrollTop = row.offsetTop - (head?.offsetHeight ?? 0) + (scroll.nudge ?? 0)
      }
    }
    apply()
    // 宿主的布局在挂上后的几帧里还会变（网格视图里面板随后才让开右上胶囊、变矮）：一秒内列表尺寸变了就按同一目标再排一次，用户一滚动或按键就不再管
    let touched = false
    const stopFollowing = () => {
      touched = true
    }
    const follow = new ResizeObserver(() => {
      if (!touched) apply()
    })
    follow.observe(el)
    const done = window.setTimeout(() => follow.disconnect(), 1000)
    el.addEventListener("wheel", stopFollowing, { passive: true })
    el.addEventListener("pointerdown", stopFollowing)
    document.addEventListener("keydown", stopFollowing, true)
    return () => {
      follow.disconnect()
      window.clearTimeout(done)
      el.removeEventListener("wheel", stopFollowing)
      el.removeEventListener("pointerdown", stopFollowing)
      document.removeEventListener("keydown", stopFollowing, true)
    }
    // 只在挂载时
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // 搜索结果的播报（g4-17，07 §3）：输入停顿 300 ms 后写一次；挂载时（状态里一出现就带着搜索词）不念
  const hits = filterGroups(groups, query).reduce((n, g) => n + g.rows.length, 0)
  const [said, setSaid] = useState("")
  const prevQuery = useRef(query)
  useEffect(() => {
    if (prevQuery.current === query) return
    prevQuery.current = query
    const q = query.trim()
    if (!q) {
      setSaid("")
      return
    }
    let raf = 0
    const timer = window.setTimeout(() => {
      // 先清空、下一帧再写：同一句连着出现也会再念一次
      setSaid("")
      raf = window.requestAnimationFrame(() => setSaid(hits ? `找到 ${hits} 个快捷键` : `没有与「${q}」相关的快捷键`))
    }, 300)
    return () => {
      window.clearTimeout(timer)
      window.cancelAnimationFrame(raf)
    }
    // 只随搜索词变（冲突解决后插件组消失不另念）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])
  return (
    <>
      <div className="shrink-0 px-3 pb-3">
        <SearchBox query={query} onQuery={onQuery} />
        <span role="status" aria-live="polite" className="sr-only">
          {said}
        </span>
      </div>
      {ro && (
        <div className="shrink-0 border-t border-(--v3-border)">
          <InspectorNotice icon={<Lock {...ICON} aria-hidden="true" />}>{mode === "viewer" ? "只有查看权限：编辑类快捷键不可用" : "评审模式：编辑类快捷键不可用"}</InspectorNotice>
        </div>
      )}
      <div ref={scroller} className={cn("relative min-h-0 flex-1 overflow-y-auto", !ro && "border-t border-(--v3-border)")}>
        {conflict ? <ConflictList {...list} conflict={conflict} /> : <ShortcutList {...list} />}
      </div>
    </>
  )
}
