import { useCallback, useEffect, useRef, type ReactNode } from "react"
import { CaseSensitive, ChevronDown, ChevronRight, ChevronUp, Ellipsis, EyeOff, LoaderCircle, Replace, Search, SearchX, WholeWord, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Button, FloatingPanel, HoverBox, ICON, IconButton, Menu, RailList, RailThumb, rescueFocus, TextField, TOGGLE_ON, Tip, useCanvasEscape, useDismissOnMasterToggle, useEditor, useEscapeThroughTooltip, useSceneState,
  type Box, type MenuSpec,
} from "../../kit"

/**
 * 03-21 查找与替换（v3）：画布右上角的浮动面板（不占检查器、位置固定），命中项在幻灯片上高亮，命中所在页在左栏缩略图上打中性小标记。
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │ ›  [⌕ 营收                 Aa  ab]   3 / 6   ↑  ↓  × │   查找行：› 展开替换 · 输入框（内含区分大小写 / 全字匹配） · 计数 · 上一个 / 下一个 · 关闭
 *   │    [替换为                       ]   [替换] [全部替换] │   替换行（⇧⌘H 打开时展开，DS-16；Windows / Linux 为 Ctrl+H）
 *   │    未找到匹配内容                                      │   状态行（无结果 / 隐藏页 等，按需出现）
 *   └──────────────────────────────────────────────────────┘
 *
 * 网格：24px | 1fr | auto 三列，查找框与替换框左右对齐，右侧两组按钮共用一列。面板 400 宽、内边距 8、圆角 8（弹层档）、浮层阴影。
 */

/** 一处命中：所在页与在幻灯片上的位置（百分比）。 */
export interface Hit {
  slide: number
  box: Box
  /** 命中所在的对象（读屏与评审对照用） */
  where: string
}

/** 示例文档里「营收」的 6 处命中（文档顺序）：第 2 页 1、第 3 页 1、第 4 页 2、第 5 页 2。 */
export const REVENUE_HITS: Hit[] = [
  { slide: 2, where: "要点卡说明「营收、客户、毛利三项同步提升」", box: { x: 67.55, y: 67.2, w: 3.45, h: 4.2 } },
  { slide: 3, where: "指标卡标题「营收」", box: { x: 9.25, y: 37.7, w: 4.7, h: 4.9 } },
  { slide: 4, where: "标题「营收趋势」", box: { x: 6.6, y: 10.6, w: 9.85, h: 10.6 } },
  { slide: 4, where: "文本「6 月营收 4,800 万元」", box: { x: 11.45, y: 28.5, w: 5.65, h: 6.1 } },
  { slide: 5, where: "环形图中心「Q2 营收」", box: { x: 22.95, y: 59.7, w: 3.75, h: 4.2 } },
  { slide: 5, where: "表头「营收（万元）」", box: { x: 83.15, y: 31.05, w: 3.6, h: 4.2 } },
]

export interface FindState {
  open: boolean
  /** 替换区展开（⇧⌘H 打开或点 ›） */
  replace: boolean
  query: string
  replaceWith: string
  /** 当前命中（1 起；没有命中时为 0） */
  index: number
  matchCase: boolean
  wholeWord: boolean
}

export const FIND_DEFAULT: FindState = { open: true, replace: false, query: "营收", replaceWith: "", index: 3, matchCase: false, wholeWord: false }

/**
 * 查找面板（canvasOverlay）、命中高亮（slideOverlay）与左栏命中标记（rail.list）分散在编辑器的不同区域，共用一份查找状态：
 * kit 的 useSceneState（同一次编辑器挂载里共享，换状态即复位）。各状态的初值写在 EditorConfig.data.find（Partial<FindState>，缺省 FIND_DEFAULT）。
 * 返回 [当前状态, 局部更新, 本状态的初值]。
 */
export function useFind(): [FindState, (patch: Partial<FindState>) => void, FindState] {
  const { data } = useEditor()
  const initial: FindState = { ...FIND_DEFAULT, ...(data.find as Partial<FindState> | undefined) }
  const [s, set] = useSceneState<FindState>("find-replace.find", initial)
  const patch = useCallback((p: Partial<FindState>) => set((cur) => ({ ...cur, ...p })), [set])
  return [s, patch, initial]
}

/**
 * 把焦点放进查找输入并全选：⌘F / ⇧⌘H（Ctrl+H）打开或再次按下时（03-21：「Mod+F 打开（聚焦查找输入）」，键入即替换原查询词）。
 * 面板刚挂上要等下一帧再找；场景状态里一出现就打开的面板（没人按键）不抢焦点，截图里没有焦点环。
 */
const focusFind = () =>
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLInputElement>('[aria-label="查找和替换"] input[aria-label="查找"]')
    el?.focus({ preventScroll: true })
    el?.select()
  })

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

/** 这一下 Esc 收不收面板：面板里的输入框照样响应；面板外的其他输入框（检查器字段等）里按 Esc 不关面板 */
const escClosesPanel = (e: KeyboardEvent) => (e.target instanceof HTMLElement && !!e.target.closest('[aria-label="查找和替换"]')) || !isTyping(e.target)

/** 输入框里的两个选项开关（Aa、ab）：24px、圆角 3，按下态与切换条（B I U S）的按下项一致（TOGGLE_ON：强调色淡底、不描边，rulings §4.25 DS-36）。 */
function OptionToggle({ label, on, onChange, children }: { label: string; on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <Tip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={on}
        onClick={() => onChange(!on)}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-[3px] transition-colors",
          on ? cn(TOGGLE_ON, "text-(--v3-text)") : "text-(--v3-text-2) hover:text-(--v3-text)",
        )}
      >
        {children}
      </button>
    </Tip>
  )
}


export interface FindPanelProps {
  /** 当前查询的全部命中（文档顺序）；查询词就是本状态 data.find 的 query */
  hits: Hit[]
  /** 计数区显示「搜索中…」（超出 200 ms 预算时的过渡态） */
  searching?: boolean
  /** 已隐藏的页：当前命中落在这些页上时，状态行提示「该内容位于已隐藏的幻灯片」（不自动取消隐藏） */
  hidden?: number[]
  /**
   * false：没有替换区——不显示 › 展开按钮与替换行，⇧⌘H 只打开查找。评审模式与只读浏览缺省就是 false（编辑器 mode，rulings §4.25 TB-28，
   * 与 DS-15「不显示禁用控件」同一口径）；编辑模式已降权时由状态显式传 false；查看器 preset 复用同一面板时也不带替换区（03-25）
   */
  canReplace?: boolean
  /**
   * 紧凑窗口（640–1024，DS-17；03-21「窄屏下收窄为仅查找输入 + 计数，替换区收入「更多」」）：面板收窄到 320，
   * 只留查找框、计数、上一个 / 下一个、「更多」与关闭；区分大小写、全字匹配与「替换…」都进「更多」，选了「替换…」才在下面展开替换行。
   */
  compact?: boolean
  /**
   * 落位（第 3 批转正时并入 kitRequest g3 K6）：缺省 auto——桌面画布右上（距顶让开横幅 12、距右 12）；compact 时再排在紧凑胶囊下面（下移 60）。
   * 「排在紧凑胶囊下面」只属于编辑器紧凑形态：没有胶囊的地方（查看器窄屏）传 top-center（水平居中、距顶 12）或 plain（不下移，外层自己定位）
   */
  placement?: "auto" | "top-center" | "plain"
}

/**
 * 查找与替换浮动面板（放 canvasOverlay）。⌘F 打开（查找）、⇧⌘H 打开并展开替换（DS-16：macOS 的 ⌘H 是系统「隐藏应用」；Windows / Linux 为 Ctrl+H），打开后焦点在查找输入（已开着时再按也回到查找输入并全选）；
 * Esc 关闭、保留画布选区；↵ / ⇧↵ 在命中间跳转，跳到别页时自动换页（ctx.goTo）。翻页不重置查找状态。
 * 进出母版视图：普通视图里开着的面板进入时收起；母版视图里再按 ⌘F 打开的归母版视图，退出时收起（rulings §4.25 DS-158、TB-204）。
 */
export function FindPanel({ hits: allHits, searching, hidden = [], canReplace: canReplaceProp, compact = false, placement = "auto" }: FindPanelProps) {
  const ed = useEditor()
  const canReplace = canReplaceProp ?? ed.mode === "edit"
  const [s, set, initial] = useFind()
  const open = useRef(s.open)
  open.current = s.open
  /** 面板里的网格（查找行、替换行、状态行都在里面）：Esc 穿过工具提示时判断焦点在不在面板里 */
  const box = useRef<HTMLDivElement>(null)
  /** 关闭：面板随之卸载，焦点交给画布（不掉到 body，查找前的画布选区保留） */
  const close = () => {
    set({ open: false })
    requestAnimationFrame(rescueFocus)
  }

  // ⌘F / ⇧⌘H（Ctrl+H）重新打开，Esc 关闭（面板关着时组件仍挂载，监听照常）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      const replaceKey = k === "h" && ((e.metaKey && e.shiftKey) || (e.ctrlKey && !e.metaKey))
      if ((e.metaKey || e.ctrlKey) && k === "f") {
        e.preventDefault()
        set({ open: true, replace: false })
        focusFind()
      } else if (replaceKey) {
        e.preventDefault()
        set({ open: true, replace: canReplace })
        focusFind()
      } else if (e.key === "Escape" && open.current) {
        if (e.defaultPrevented) return
        if (escClosesPanel(e)) {
          set({ open: false })
          requestAnimationFrame(rescueFocus)
        }
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [set, canReplace])

  // Esc 逐层里的一级（kit useCanvasEscape；2026-10-29 母版视图第一步修复第 3 轮，复验 R3-B1）：面板开着时登记。母版视图里宿主在退出之前先问这一层，
  // 接住就只收起面板、仍在母版视图（下一下 Esc 才退出）；接不接与上面的监听同一条判断（escClosesPanel）。普通视图不经这里，照旧由上面的监听处理
  useCanvasEscape(s.open, (e) => {
    if (!escClosesPanel(e)) return false
    close()
    return true
  })

  // 查找框刚聚焦、工具提示还开着（或正在收起）时按 Esc：一次就关掉面板，不被工具提示接走（rulings §4.25 DS-171；kit useEscapeThroughTooltip）。
  // 普通视图与母版视图同此。工具提示可能比面板先开——母版视图里进入后窗格选中行的提示、普通视图里先聚焦过的按钮的提示，之后才按 ⌘F 打开面板——
  // 所以从这一层挂上起就登记（不等面板打开）：document 捕获阶段按登记先后执行，排在之后才开的工具提示前面；工具提示随后 preventDefault 收起自己，
  // 上面的监听见到 defaultPrevented 不再重复关。面板关着时网格不在（box 为空），这里什么都不做
  useEscapeThroughTooltip(true, box, (e) => {
    if (open.current && escClosesPanel(e)) close()
  })

  // 进出母版视图时收起（mode.ts useDismissOnMasterToggle）：只改开关、不交还焦点，焦点由宿主在同一次提交里交给落点（进入：窗格选中行；退出：画布）
  useDismissOnMasterToggle(s.open, () => set({ open: false }))

  if (!s.open) return null

  // 样张没有真实索引：查询词改成别的就按「无结果」处理，改回来命中恢复
  const hits = s.query.trim() === initial.query.trim() ? allHits : []
  const total = searching ? 0 : hits.length
  const cur = total ? Math.min(Math.max(s.index, 1), total) : 0
  const go = (d: 1 | -1) => {
    if (!total) return
    const next = ((cur - 1 + d + total) % total) + 1
    set({ index: next })
    const h = hits[next - 1]
    if (h && h.slide !== ed.slide) ed.goTo(h.slide)
  }
  const count = searching ? "搜索中…" : `${cur} / ${total}`
  // 状态行：无结果；当前命中位于隐藏页（只提示，不自动取消隐藏）
  const curHit = cur ? hits[cur - 1] : undefined
  const status: { icon?: ReactNode; text: string } | null =
    !searching && !total && s.query.trim()
      ? { icon: <SearchX {...ICON} aria-hidden="true" className="shrink-0" />, text: "未找到匹配内容" }
      : curHit && hidden.includes(curHit.slide)
        ? { icon: <EyeOff {...ICON} aria-hidden="true" className="shrink-0" />, text: "该内容位于已隐藏的幻灯片" }
        : null

  return (
    // 紧凑形态：右上角是「协作与分享」胶囊（48 高、距顶 12），面板排在它下面（再下移 60）——只在编辑器紧凑形态（placement auto）
    <FloatingPanel
      label="查找和替换"
      placement={placement === "top-center" ? "top-center" : "top-right"}
      className={compact ? cn(placement === "auto" && "mt-[60px]", "w-[320px] p-2") : "w-[400px] p-2"}
    >
      <div
        ref={box}
        // 没有替换区（评审、只读浏览、查看器）时「展开替换」那一列收成 0、查找框贴左（离面板左缘 12，即原查看器样张覆盖的画法；第 3 批转正并入 kitRequest g3 K6，
        // 编辑模式与紧凑形态的画面不变）
        className={cn(
          "grid items-center gap-x-1 gap-y-2",
          compact ? "grid-cols-[minmax(0,1fr)_auto]" : canReplace ? "grid-cols-[24px_minmax(0,1fr)_auto]" : "grid-cols-[0px_minmax(0,1fr)_auto]",
        )}
        onKeyDown={(e) => {
          // 查找框里 ↵ 下一个、⇧↵ 上一个
          if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.getAttribute("aria-label") === "查找") {
            e.preventDefault()
            go(e.shiftKey ? -1 : 1)
          }
        }}
      >
        {compact ? null : canReplace ? (
          <IconButton
            size={24}
            label={s.replace ? "收起替换" : "展开替换"}
            kbd={s.replace ? undefined : "⇧⌘H"}
            aria-expanded={s.replace}
            onClick={() => set({ replace: !s.replace })}
          >
            {s.replace ? <ChevronDown {...ICON} /> : <ChevronRight {...ICON} />}
          </IconButton>
        ) : (
          <span aria-hidden="true" />
        )}

        <TextField
          aria="查找"
          placeholder="查找"
          value={s.query}
          onChange={(query) => set({ query })}
          leading={searching ? <LoaderCircle {...ICON} aria-hidden="true" className="shrink-0 motion-safe:animate-spin" /> : <Search {...ICON} aria-hidden="true" className="shrink-0" />}
          trailing={
            compact ? undefined : (
              <span className="-mr-1.5 flex shrink-0 items-center gap-0.5">
                <OptionToggle label="区分大小写" on={s.matchCase} onChange={(matchCase) => set({ matchCase })}>
                  <CaseSensitive {...ICON} />
                </OptionToggle>
                <OptionToggle label="全字匹配" on={s.wholeWord} onChange={(wholeWord) => set({ wholeWord })}>
                  <WholeWord {...ICON} />
                </OptionToggle>
              </span>
            )
          }
        />

        <div className="flex items-center gap-1">
          <span
            aria-live="polite"
            className={cn(
              "min-w-12 text-center leading-none tabular-nums whitespace-nowrap",
              // 计数（含「0 / 0」）是可读信息，一律 text-2（DS-9）
              searching ? "text-[12px] text-(--v3-text-2)" : "text-[11px] text-(--v3-text-2)",
            )}
          >
            {count}
          </span>
          <IconButton label="上一个" kbd="⇧↵" disabled={!total} reason={total ? undefined : "没有匹配项"} onClick={() => go(-1)}>
            <ChevronUp {...ICON} />
          </IconButton>
          <IconButton label="下一个" kbd="↵" disabled={!total} reason={total ? undefined : "没有匹配项"} onClick={() => go(1)}>
            <ChevronDown {...ICON} />
          </IconButton>
          {compact && (
            <Menu
              align="end"
              label="查找选项"
              items={[
                { type: "checkbox", id: "case", label: "区分大小写", checked: s.matchCase, onCheckedChange: (matchCase) => set({ matchCase }) },
                { type: "checkbox", id: "word", label: "全字匹配", checked: s.wholeWord, onCheckedChange: (wholeWord) => set({ wholeWord }) },
                ...(canReplace
                  ? ([{ type: "separator" }, { type: "checkbox", id: "replace", label: "替换…", kbd: "⇧⌘H", checked: s.replace, onCheckedChange: (replace: boolean) => set({ replace }) }] as MenuSpec[])
                  : []),
              ]}
              trigger={
                <IconButton label="更多查找选项" aria-haspopup="menu" noTip>
                  <Ellipsis {...ICON} />
                </IconButton>
              }
            />
          )}
          <IconButton label="关闭" kbd="Esc" onClick={close}>
            <X {...ICON} />
          </IconButton>
        </div>

        {canReplace && s.replace && (
          <>
            {!compact && <span aria-hidden="true" />}
            <TextField
              aria="替换为"
              placeholder="替换为"
              value={s.replaceWith}
              onChange={(replaceWith) => set({ replaceWith })}
              leading={<Replace {...ICON} aria-hidden="true" className="shrink-0" />}
            />
            <div className="flex items-center justify-end gap-1">
              <Button disabled={!total} reason={total ? undefined : "没有匹配项"}>
                替换
              </Button>
              <Button disabled={!total} reason={total ? undefined : "没有匹配项"}>
                全部替换
              </Button>
            </div>
          </>
        )}

        {status && (
          // 图标与输入框里的放大镜对齐、文字与查询词对齐（左内边距 8 + 图标 16 + 间距 8）
          <p role="status" className={cn("flex items-center gap-2 pl-2 text-[12px] leading-4 text-(--v3-text-2)", compact ? "col-span-2" : "col-span-2 col-start-2")}>
            {status.icon}
            {status.text}
          </p>
        )}
      </div>
    </FloatingPanel>
  )
}

/**
 * 命中高亮（放 slideOverlay，函数形式）：当前页的命中都画 1px 强调色框，当前命中再加浅强调色底（同文字选区）。
 * 随面板开关与「上一个 / 下一个」更新；面板关掉后高亮消失。
 */
export function FindHits({ hits, query = "营收" }: { hits: Hit[]; /** 这组命中对应的查询词：面板里改了词就不再画 */ query?: string }) {
  const ed = useEditor()
  const [s] = useFind()
  if (!s.open || s.query.trim() !== query) return null
  return (
    <>
      {hits.map((h, i) =>
        h.slide === ed.slide ? <HoverBox key={`${h.slide}-${i}`} box={h.box} fill={i + 1 === s.index} className="rounded-[2px]" /> : null,
      )}
    </>
  )
}

/** 缩略图右下角的命中标记：中性描边小签（放大镜 + 本页命中数），与右上角的评论计数（评论图标）区分开。 */
export function HitMark({ count }: { count: number }) {
  return (
    <span
      aria-label={`本页 ${count} 处匹配`}
      className="absolute right-1 bottom-1 inline-flex h-4 items-center gap-0.5 rounded-[4px] border border-(--v3-border) bg-(--v3-panel) px-1 text-[11px] leading-none text-(--v3-text-2) tabular-nums"
    >
      <Search size={10} strokeWidth={1.5} aria-hidden="true" />
      {count}
    </span>
  )
}

/**
 * 左栏缩略图列表（放 rail.list，函数形式）：查找面板开着时，命中所在页右下角打标记；hidden 里的页用底座 RailThumb 的隐藏页外观（与 03-14 同一画法）。
 */
export function FindRail({ hits, hidden = [], query = "营收" }: { hits: Hit[]; hidden?: number[]; query?: string }) {
  const ed = useEditor()
  const [s] = useFind()
  const counts = new Map<number, number>()
  if (s.query.trim() === query) for (const h of hits) counts.set(h.slide, (counts.get(h.slide) ?? 0) + 1)
  return (
    <RailList>
      {ed.deck.map((sl) => {
        const c = s.open ? counts.get(sl.n) : undefined
        return (
          <RailThumb key={sl.n} slide={sl} current={sl.n === ed.slide} hidden={hidden.includes(sl.n)} onPick={ed.goTo}>
            {c ? <HitMark count={c} /> : null}
          </RailThumb>
        )
      })}
    </RailList>
  )
}
