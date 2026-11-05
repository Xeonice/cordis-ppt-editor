import { useContext, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react"
import { ExternalLink, Search, type LucideIcon } from "lucide-react"
import { Dialog as D } from "radix-ui"
import { cn } from "@/lib/utils"
import { V3RootContext } from "../V3Root"
import { FIELD_FRAME, hasCjk, ICON } from "../ui"
import { findAnchor } from "./anchor"
import { formatChord, joinAlternatives, type Platform } from "./chord"
import { EmptyNote, Tag } from "./controls"
import { arrivedVia, canvasFocusTarget, focusBack, useFocusBackOnClose } from "./layer"

/**
 * 命令面板（第 3 批转正，2026-10-22：由 scenarios/command-palette/CommandPalette.tsx 并入底座，kitRequest g4 K6，rulings §4.25 DS-117、TB-106；画法逐像素相同）。
 * PRD ED-30，50/10 §10.1，设计 04 §4.2「外观按菜单与对话框的规则」，06 §2.5 条目视觉。
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ [⌕ 搜索命令                                ] │  kit 淡底字段 28（DS-35，同快捷键面板；不加清除按钮，TB-117），四周 8，下方 1px 分隔
 *   ├──────────────────────────────────────────────┤
 *   │ 常用                                          │  分组小标题 12px 次级文字色（同菜单的分组小标题）；列表左右内边距 8（行与搜索框同一条左右缘）
 *   │ ＋ 新建幻灯片                    幻灯片   ⌘M │  一行 28：图标 16 · 标题 12px · 分类（12px 次级文字色）· 快捷键（11px，同菜单、快捷键面板的写法）
 *   │ …                                             │  当前项铺 panel-2（同菜单悬停 / 键盘高亮），不用强调色
 *   └──────────────────────────────────────────────┘
 *
 * 宽 480（与 Dialog md 同一档），水平居中、顶部锚定（距顶 max(64px, 12vh)，同顶部锚定的对话框），高随内容、列表最高 12 行后在框内滚动；
 * 层级 --layer-command-palette（v3.css，盖过对话框：kit Dialog 是 z 50，04 §2.11）。不加遮罩（DS-117：按菜单的规则，临时的选择层，背后照常可见）；
 * 模态：焦点圈定在面板里，点外面、Esc、再按 ⌘K 关闭（Esc 直接关，同菜单；不先清空搜索词），关闭后焦点回打开前的元素（不在页面上时回转过来时的入口，再退到画布）。
 * 读屏：组合框模式——搜索框 role=combobox（aria-activedescendant 指向当前项），列表 role=listbox、每行 role=option；不可用的 aria-disabled，原因经 aria-describedby。
 * 结果数量播报（07 §3 命令面板一行「结果数量变化播报」）：一个 polite 区，输入停顿 300 ms 后写「找到 N 条命令」或「没有与「x」相关的命令」（先清空、下一帧再写，同一句也会再念）。
 * 执行：先关面板、把焦点交回打开前的元素，下一个任务再执行（50/10 §10.1）——打开别的界面的命令（偏好设置、键盘快捷键、插件…）由那个界面接走焦点。
 * 不可用的命令（reasonFor 给了原因）在 ↵ / 点按时不执行，只把原因播报一次（PRD ED-30「执行不可用命令时提示原因」），面板不关。
 *
 * 受控：面板的开关、搜索词、当前项、播报句由调用处保管（场景里放在 useSceneState，换状态即重置），set 合并改动：
 *   <CommandPalette ui={ui} set={set} commands={ALL} common={COMMON} reasonFor={(c) => …} onRun={(c) => …} platform="mac" />
 */

/** 一条命令（呈现所需的部分；调用处可以在此基础上加自己的字段，如可用前提、执行方式） */
export interface PaletteItem {
  id: string
  title: string
  icon: LucideIcon
  /** 分类（沿用主菜单的顶层名；插件命令由插件给） */
  category: string
  /** 和弦（kit chord 的记法），第一项是主写法 */
  keys?: string[]
  /** Windows / Linux 另有写法时 */
  keysWin?: string[]
  /** 搜索时额外命中的词 */
  keywords?: string[]
  /** 第三方插件：标题下一行「来自「插件名」」（内置插件不写） */
  from?: string
  /** 里程碑小标记（P2 / M3），写在标题后 */
  tag?: string
  /**
   * 外链（在新标签页打开，如「帮助中心」）：标题后 12px 外链图标（同菜单条目 external，rulings §4.25 DS-89、TB-132），读屏名带「（在新标签页打开）」。
   * 这类条目只在集成方配置了对应链接时才列进命令面板（TB-132），由调用处决定给不给
   */
  external?: boolean
}

/** 面板的界面状态 */
export interface PaletteUi {
  open: boolean
  query: string
  /** 当前项（列表里的序号） */
  active: number
  /** 只给读屏的一句（选了不可用的命令时播报原因） */
  announce: string
}

export interface CommandPaletteProps<T extends PaletteItem> {
  ui: PaletteUi
  set: (p: Partial<PaletteUi>) => void
  /** 本会话全部可列的命令（搜索在这里面找） */
  commands: T[]
  /** 还没输入时列出的「常用」一组（产品固定的一份，按这个顺序） */
  common: T[]
  /** 当前状态下这条命令不可用的原因；可用时为 undefined */
  reasonFor?: (c: T) => string | undefined
  /** 执行（面板已关、焦点已交回之后的下一个任务里调） */
  onRun?: (c: T) => void
  /** 键名写法（缺省 mac） */
  platform?: Platform
}

const norm = (s: string) => s.replace(/…/g, "").trim().toLowerCase()

/**
 * 搜索：标题与关键词包含查询词（不区分大小写，标题末尾的「…」不参与）；排序：标题以查询词开头 → 标题包含 → 只有关键词命中，同档按清单顺序。
 * 分类不参与匹配（「插入」只命中标题或关键词里有它的，不把整个插入分类都列出来）
 */
export function searchPalette<T extends PaletteItem>(list: T[], query: string): T[] {
  const q = norm(query)
  if (!q) return []
  const rank = (c: T) => {
    const t = norm(c.title)
    if (t.startsWith(q)) return 0
    if (t.includes(q)) return 1
    if ((c.keywords ?? []).some((k) => norm(k).includes(q))) return 2
    return -1
  }
  return list
    .map((c, i) => ({ c, i, r: rank(c) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.c)
}

export function CommandPalette<T extends PaletteItem>({ ui, set, commands, common, reasonFor, onRun, platform = "mac" }: CommandPaletteProps<T>) {
  const root = useContext(V3RootContext)
  const uid = useId()
  const listId = `${uid}-list`
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  /** 打开前的焦点元素（触发处），关闭后还给它 */
  const trigger = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!ui.open) return
    const a = document.activeElement
    trigger.current = a instanceof HTMLElement && a !== document.body && !contentRef.current?.contains(a) ? a : null
  }, [ui.open])

  /** 交还处：触发处（还在页面上时）→ 转过来时的入口（主菜单）→ 画布 */
  const backTarget = () => {
    const t = trigger.current
    if (t?.isConnected) return t
    const via = arrivedVia()
    return (via && root ? findAnchor(root, via) : null) ?? canvasFocusTarget()
  }
  const returned = useRef(false)
  useFocusBackOnClose(!!root && ui.open, backTarget, () => {
    returned.current = true
    trigger.current = null
  })

  // 结果数量播报（见文件头）：只随搜索词变；挂载时（状态里一出现就带着搜索词）不念
  const [said, setSaid] = useState("")
  const prevQuery = useRef(ui.query)
  const searching = ui.query.trim() !== ""
  const items = searching ? searchPalette(commands, ui.query) : common
  const active = Math.min(ui.active, Math.max(0, items.length - 1))
  const optionId = (i: number) => `${uid}-opt-${i}`

  useEffect(() => {
    if (prevQuery.current === ui.query) return
    prevQuery.current = ui.query
    const q = ui.query.trim()
    if (!q || !ui.open) {
      setSaid("")
      return
    }
    let raf = 0
    const timer = window.setTimeout(() => {
      setSaid("")
      raf = window.requestAnimationFrame(() => setSaid(items.length ? `找到 ${items.length} 条命令` : `没有与「${q}」相关的命令`))
    }, 300)
    return () => {
      window.clearTimeout(timer)
      window.cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.query])

  if (!root) return null

  const close = () => set({ open: false })

  /** 执行：先关面板（焦点交回打开前的元素），再执行；不可用的只播报原因 */
  const execute = (c: T) => {
    const why = reasonFor?.(c)
    if (why) {
      // 同一句连按两次也要再念一次：先清空、下一帧再写
      set({ announce: "" })
      window.requestAnimationFrame(() => set({ announce: `${c.title.replace(/…$/, "")}：${why}` }))
      return
    }
    close()
    if (!onRun) return
    // 先关面板、焦点交回打开前的元素（useFocusBackOnClose 在本任务末尾交还），下一个任务再执行（50/10 §10.1）：
    // 随之打开的偏好设置、快捷键面板记下的「打开前的焦点」就是面板之前的那个元素，关闭后交回那里
    window.setTimeout(() => onRun(c), 0)
  }

  /** 让当前项留在列表可见范围里（只滚列表自己） */
  const reveal = (i: number) => {
    const list = listRef.current
    const el = list?.querySelector<HTMLElement>(`#${CSS.escape(optionId(i))}`)
    if (!list || !el) return
    const top = el.offsetTop
    const bottom = top + el.offsetHeight
    if (top < list.scrollTop + 4) list.scrollTop = top - 4
    else if (bottom > list.scrollTop + list.clientHeight - 4) list.scrollTop = bottom - list.clientHeight + 4
  }

  const rows = items.map((c, i) => (
    <PaletteRow
      key={c.id}
      id={optionId(i)}
      cmd={c}
      platform={platform}
      reason={reasonFor?.(c)}
      active={i === active}
      onHover={() => {
        if (i !== active) set({ active: i })
      }}
      onPick={() => {
        set({ active: i })
        execute(c)
      }}
    />
  ))

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      if (!items.length) return
      const next = e.key === "ArrowDown" ? (active + 1) % items.length : (active - 1 + items.length) % items.length
      set({ active: next })
      window.requestAnimationFrame(() => reveal(next))
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      const c = items[active]
      if (c) execute(c)
    }
  }

  return (
    <D.Root open={ui.open} onOpenChange={(v) => !v && close()}>
      <D.Portal container={root}>
        <D.Content
          ref={contentRef}
          aria-describedby={undefined}
          aria-modal="true"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            inputRef.current?.focus({ preventScroll: true })
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            if (returned.current) {
              returned.current = false
              return
            }
            // 执行的命令打开了别的界面（偏好设置、快捷键面板）：焦点已经在那里，不拉回
            const a = document.activeElement
            if (a && a !== document.body && a.isConnected) return
            focusBack(backTarget())
            trigger.current = null
          }}
          // 经 Portal 挂在根节点，React 事件仍沿组件树冒泡：点面板里面不触发画布的「点空白取消选中」
          onClick={(e) => e.stopPropagation()}
          className="fixed top-[max(64px,12vh)] left-1/2 z-(--layer-command-palette) flex max-h-[calc(100dvh_-_max(64px,12vh)_-_32px)] w-[480px] max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col overflow-hidden rounded-[8px] border border-(--v3-border) bg-(--v3-panel) text-(--v3-text) shadow-(--v3-shadow) outline-none"
        >
          <D.Title className="sr-only">命令面板</D.Title>
          {/* 搜索框：kit 淡底字段（FIELD_FRAME，与 kit TextField 同一画法：28 高、16 放大镜、12px 输入；DS-35，同快捷键面板；两处都不加清除按钮）。
              TextField 不收组合框的属性，这里按它的结构直接拼 */}
          <div className="shrink-0 border-b border-(--v3-border) p-2">
            <label
              className={cn(
                FIELD_FRAME,
                "flex h-7 min-w-0 items-center gap-2 px-2 text-(--v3-text-2) transition-colors hover:bg-(--v3-field-fill-hover) focus-within:ring-(--v3-accent)",
              )}
            >
              <Search {...ICON} aria-hidden="true" className="shrink-0" />
              <input
                ref={inputRef}
                role="combobox"
                aria-label="搜索命令"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={items.length ? optionId(active) : undefined}
                placeholder="搜索命令"
                value={ui.query}
                onChange={(e) => {
                  set({ query: e.target.value, active: 0 })
                  if (listRef.current) listRef.current.scrollTop = 0
                }}
                onKeyDown={onKeyDown}
                spellCheck={false}
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-[12px] leading-none text-(--v3-text) outline-none placeholder:text-(--v3-text-3)"
              />
            </label>
          </div>
          {/* 列表左右内边距 8，与搜索框同一条左右缘：行的图标、标题与框里的放大镜、输入文字各自对齐（上下仍是菜单的 4） */}
          <div ref={listRef} className="relative min-h-0 overflow-y-auto px-2 py-1" style={{ maxHeight: 12 * 28 + 8 + 24 }}>
            {items.length === 0 ? (
              <EmptyNote>
                没有与<span className="whitespace-nowrap">「{ui.query.trim()}」</span>相关的命令
              </EmptyNote>
            ) : (
              <div id={listId} role="listbox" aria-label={searching ? `搜索结果 ${items.length} 条` : "命令"}>
                {searching ? (
                  rows
                ) : (
                  // 打开时：常用命令一组（分组小标题同菜单的 label：12px 次级文字色、高 24）
                  <div role="group" aria-labelledby={`${uid}-common`}>
                    <div id={`${uid}-common`} aria-hidden="true" className="flex h-6 items-center px-2 text-[12px] leading-none text-(--v3-text-2) select-none">
                      常用
                    </div>
                    {rows}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* 选了不可用的命令：播报原因一次（面板不关） */}
          <span role="status" aria-live="polite" className="sr-only">
            {ui.announce}
          </span>
          {/* 结果数量：输入停顿后播报一次 */}
          <span role="status" aria-live="polite" className="sr-only">
            {said}
          </span>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

/** 一条命令：图标 16 · 标题（+ 里程碑标记；第三方下一行「来自「插件名」」）· 分类 · 快捷键；不可用时图标与标题退到 text-3，右侧原因代替分类与快捷键 */
function PaletteRow({
  id,
  cmd,
  platform,
  reason,
  active,
  onHover,
  onPick,
}: {
  id: string
  cmd: PaletteItem
  platform: Platform
  reason?: string
  active: boolean
  onHover: () => void
  onPick: () => void
}) {
  const Icon = cmd.icon
  const off = !!reason
  const keys = (platform === "win" && cmd.keysWin) || cmd.keys
  const chords = keys?.map((k) => formatChord(k, platform)) ?? []
  /** 面板里只写主写法（第一项），读屏念全部可互换的写法 */
  const main = chords[0]
  const reasonId = `${id}-why`
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      aria-disabled={off || undefined}
      aria-describedby={off ? reasonId : undefined}
      // 鼠标点按不移走搜索框的焦点（组合框模式：焦点始终在搜索框里）
      onMouseDown={(e) => e.preventDefault()}
      onMouseMove={onHover}
      onClick={onPick}
      className={cn(
        "flex cursor-default items-center gap-2 rounded-[4px] px-2 text-[12px] leading-4 select-none",
        cmd.from ? "min-h-11 py-1.5" : "h-7",
        active && "bg-(--v3-panel-2)",
      )}
    >
      <Icon size={16} strokeWidth={1.5} aria-hidden="true" className={cn("shrink-0", off ? "text-(--v3-text-3)" : "text-(--v3-text-2)")} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("flex min-w-0 items-center gap-1.5 whitespace-nowrap", off ? "text-(--v3-text-3)" : "text-(--v3-text)")}>
          {cmd.title}
          {cmd.tag && <Tag>{cmd.tag}</Tag>}
          {cmd.external && (
            <>
              <ExternalLink size={12} strokeWidth={1.5} aria-hidden="true" className={cn("shrink-0", off ? "text-(--v3-text-3)" : "text-(--v3-text-2)")} />
              <span className="sr-only">（在新标签页打开）</span>
            </>
          )}
        </span>
        {cmd.from && (
          <span className={cn("whitespace-nowrap", off ? "text-(--v3-text-3)" : "text-(--v3-text-2)")}>
            来自<span className="whitespace-nowrap">「{cmd.from}」</span>
          </span>
        )}
      </span>
      {off ? (
        <span id={reasonId} className="ml-4 shrink-0 whitespace-nowrap text-(--v3-text-2)">
          {reason}
        </span>
      ) : (
        <>
          <span className="ml-4 w-12 shrink-0 whitespace-nowrap text-(--v3-text-2)">{cmd.category}</span>
          <span className={cn("flex shrink-0 justify-end whitespace-nowrap", platform === "win" ? "w-24" : "w-14")}>
            {main && (
              <>
                <span className="sr-only">{joinAlternatives(chords)}</span>
                <kbd aria-hidden="true" className={cn("font-sans leading-none text-(--v3-text-2)", hasCjk(main) ? "text-[12px]" : "text-[11px]")}>
                  {main}
                </kbd>
              </>
            )}
          </span>
        </>
      )}
    </div>
  )
}
