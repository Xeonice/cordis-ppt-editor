import { useEffect, useState } from "react"
import { ArrowDownUp, ChevronDown, Unlink } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, Button, EmptyNote, ICON, IconButton, LoadingRow, Menu, PanelState, Phrases, Segmented, SEG_ON, SELECT_FRAME, Tip, useEditor, useSceneState, type MenuSpec } from "../../kit"
import { Composer } from "./Composer"
import { applyFilter, applySort, groupByPage, PAGE_PIN, SORT_LABEL, U, type Filter, type Sort, type Thread } from "./model"
import { newId, useAnnounce, useData, useFilter, useFlash, usePerms, useSort, useThreads } from "./store"
import { ResolvedFold, ThreadItem } from "./Thread"

/**
 * 检查器「评论」页签的内容（inspector.commentsBody，03-06）：
 *   筛选行（常驻顶部）· 线程列表（按页分组或按时间；已解决的收在末尾的「已解决 N」一行里）。
 * 新评论的入口只有一个（Q2，Figma 同此）：工具条「评论」（C）在画布上点选——点在对象上是元素锚点、点在空白处是页级锚点（浮动撰写框）；
 * 面板里只有选中线程的回复框，不再常驻底部撰写框（备选 alt-panel-composer 保留底部撰写框、评论工具只认对象）。
 * 筛选（PRD CO-04，呈现按 rulings §4.25 DS-43）：分段控件「全部 / 当前页 / 未解决 / @我」（安静样式，DS-35）+ 右侧「排序」（最新 / 最旧 / 按页码）；
 * 有已脱离锚点的线程时第二行多一个临时筛选「已脱离锚点 N」（不占固定筛选位，没有时不显示），与四项互斥。缺省停在「当前页」，与画布上的评论钉一一对应。
 * 「当前页」与「按页码」按页分组；「按页码」时每组有组头「第 N 页 · 页名」+ 未解决条数（紧跟标题，同分享「有权限的用户 3」），
 * 「当前页」只有一组、不画组头（与筛选、画布上的钉说的是同一件事）。其余按时间平铺，锚点说明前加页码。未解决在前，已解决收成「已解决 N」在后。
 */

const FILTERS: { value: Filter; label: string; text: string }[] = [
  { value: "all", label: "全部评论", text: "全部" },
  { value: "page", label: "当前页的评论", text: "当前页" },
  { value: "open", label: "未解决的评论", text: "未解决" },
  { value: "mine", label: "提及我的评论", text: "@我" },
]

const EMPTY: Record<Filter, string> = {
  all: "这份文档还没有评论",
  page: "",
  open: "没有未解决的评论",
  mine: "没有提及你的评论",
  detached: "没有已脱离锚点的评论",
}

/** 排序：图标按钮打开单选菜单（最新 / 最旧 / 按页码）；选值的下拉，选了即收起（kit closeOnSelect，同分享的角色、链接权限、有效期） */
function SortMenu({ defaultOpen }: { defaultOpen?: boolean }) {
  const [sort, setSort] = useSort()
  const items: MenuSpec[] = [
    { type: "label", label: "排序" },
    {
      type: "radio",
      id: "sort",
      label: "排序",
      value: sort,
      closeOnSelect: true,
      options: (Object.keys(SORT_LABEL) as Sort[]).map((s) => ({ value: s, label: SORT_LABEL[s] })),
      onValueChange: (v) => setSort(v as Sort),
    },
  ]
  return (
    <Menu
      defaultOpen={defaultOpen}
      align="end"
      label="排序"
      items={items}
      trigger={
        <IconButton label={`排序：${SORT_LABEL[sort]}`} size={28} noTip aria-haspopup="menu" data-v3-anchor="comments.sort">
          <ArrowDownUp {...ICON} />
        </IconButton>
      }
    />
  )
}

/**
 * 备选（alt-filter-menu）：筛选收进一个下拉（Figma 评论面板的做法），已脱离锚点是菜单里的一项。
 * 菜单项就用筛选本身的名字（「@我」，同分段控件、03-06 与 PRD CO-04；同一个对象不出现两个名字，TB-34），「提及我的评论」只作分段控件的工具提示与读屏名
 */
function FilterMenu({ detached, defaultOpen }: { detached: number; defaultOpen?: boolean }) {
  const [filter, setFilter] = useFilter()
  const [sort, setSort] = useSort()
  const name = filter === "detached" ? "已脱离锚点" : (FILTERS.find((f) => f.value === filter)?.text ?? "")
  const items: MenuSpec[] = [
    { type: "label", label: "显示" },
    {
      type: "radio",
      id: "filter",
      label: "显示",
      value: filter,
      options: [
        ...FILTERS.map((f) => ({ value: f.value, label: f.text })),
        ...(detached ? [{ value: "detached", label: "已脱离锚点", hint: String(detached) }] : []),
      ],
      onValueChange: (v) => setFilter(v as Filter),
    },
    { type: "separator" },
    { type: "label", label: "排序" },
    { type: "radio", id: "sort", label: "排序", value: sort, options: (Object.keys(SORT_LABEL) as Sort[]).map((s) => ({ value: s, label: SORT_LABEL[s] })), onValueChange: (v) => setSort(v as Sort) },
  ]
  return (
    <Menu
      defaultOpen={defaultOpen}
      label="筛选与排序"
      items={items}
      className="min-w-[200px]"
      trigger={
        <button type="button" aria-label={`筛选：${name}`} className={cn(SELECT_FRAME, "flex h-7 items-center gap-1.5 px-2 text-[12px] leading-none text-(--v3-text) transition-colors hover:bg-(--v3-select-fill-hover) data-[state=open]:bg-(--v3-select-fill-hover)")}>
          {name}
          <ChevronDown {...ICON} className="text-(--v3-text-2)" />
        </button>
      }
    />
  )
}

/** 筛选行：常驻在「评论」页签顶部（sticky，panel 底），下 1px 分隔 */
function FilterBar({ detached, locked }: { detached: number; locked?: string }) {
  const d = useData() as { sortMenu?: boolean; filterStyle?: "menu"; filterMenu?: boolean }
  const [filter, setFilter] = useFilter()
  const [threads] = useThreads()
  const { slide } = useEditor()
  if (d.filterStyle === "menu") {
    const n = applyFilter(threads, filter, slide).length
    return (
      <div className="sticky top-0 z-10 flex h-11 shrink-0 items-center gap-2 border-b border-(--v3-border) bg-(--v3-panel) px-4">
        <FilterMenu detached={detached} defaultOpen={d.filterMenu} />
        <span className="text-[12px] leading-none text-(--v3-text-2) tabular-nums">{n} 条</span>
      </div>
    )
  }
  return (
    <div className="sticky top-0 z-10 flex shrink-0 flex-col gap-2 border-b border-(--v3-border) bg-(--v3-panel) px-4 py-2">
      <div className="flex items-center gap-2">
        <Segmented<Filter>
          aria="筛选评论"
          options={FILTERS}
          value={filter}
          onValueChange={setFilter}
          disabled={!!locked}
          reason={locked}
          className="min-w-0 flex-1"
        />
        {locked ? (
          <IconButton label="排序" size={28} disabled reason={locked}>
            <ArrowDownUp {...ICON} />
          </IconButton>
        ) : (
          <SortMenu defaultOpen={d.sortMenu} />
        )}
      </div>
      {detached > 0 && (
        <Tip label="原对象已删除的评论">
          <button
            type="button"
            aria-pressed={filter === "detached"}
            aria-label={`已脱离锚点（${detached}）`}
            onClick={() => setFilter(filter === "detached" ? "all" : "detached")}
            className={cn(
              "flex h-7 items-center gap-1.5 self-start rounded-[4px] px-2 text-[12px] leading-none transition-colors",
              filter === "detached" ? cn(SEG_ON, "text-(--v3-text)") : "bg-(--v3-seg-track) text-(--v3-text-2) hover:text-(--v3-text)",
            )}
          >
            <Unlink {...ICON} />
            已脱离锚点
            <span className="text-[11px] tabular-nums">{detached}</span>
          </button>
        </Tip>
      )}
    </div>
  )
}

/** 组头（「按页码」时）：「第 N 页 · 页名」+ 未解决条数（紧跟标题，0 不写；已解决的数在组末「已解决 N」里）；第一组以外上方 1px 分隔 */
function GroupHeader({ page, count, first }: { page: number; count: number; first: boolean }) {
  const { deck } = useEditor()
  const name = deck.find((s) => s.n === page)?.name
  return (
    <div className={cn("flex h-8 items-center gap-1.5 px-4 pt-1 text-[12px] leading-none text-(--v3-text-2)", !first && "border-t border-(--v3-border)")}>
      <span className="truncate font-semibold text-(--v3-text)">
        第 {page} 页{name ? ` · ${name}` : ""}
      </span>
      {count > 0 && <span className="shrink-0 tabular-nums">{count}</span>}
    </div>
  )
}

/** 一组线程：未解决的逐条列出，已解决的收在末尾一行「已解决 N」（groupKey 区分页组） */
function ThreadGroup({ list, showPage, groupKey, label }: { list: Thread[]; showPage?: boolean; groupKey: string; label: string }) {
  const open = list.filter((t) => !t.resolved)
  const resolved = list.filter((t) => !!t.resolved)
  return (
    <ol aria-label={label} data-comments-group={groupKey}>
      {open.map((t) => (
        <ThreadItem key={t.id} t={t} showPage={showPage} />
      ))}
      <ResolvedFold threads={resolved} showPage={showPage} groupKey={groupKey} />
    </ol>
  )
}

/** 备选 alt-panel-composer 的底部撰写框（页级评论）：sticky 贴底；聚焦时画布上出现临时钉（场景状态 comments.pageDraft） */
function PanelComposer() {
  const d = useData()
  const { slide } = useEditor()
  const [, setThreads] = useThreads()
  const [, setFlash] = useFlash()
  const [, setFilter] = useFilter()
  const announce = useAnnounce()
  const [text, setText] = useState(d.composer?.text ?? "")
  const [, setPageDraft] = useSceneState<boolean>("comments.pageDraft", !!d.composer?.focused)
  const [focused, setFocused] = useState(false)
  useEffect(() => setPageDraft(focused || text.length > 0 || !!d.composer?.focused), [focused, text, d.composer?.focused, setPageDraft])
  return (
    <div
      className="sticky bottom-0 z-10 mt-auto border-t border-(--v3-border) bg-(--v3-panel) px-4 py-3"
      onFocus={() => setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocused(false)}
    >
      <div className="flex items-start gap-2">
        <Avatar name={U.zhou.name} tone={U.zhou.tone} size={20} className="mt-1" />
        <Composer
          variant="panel"
          value={text}
          onChange={setText}
          showFocused={d.composer?.focused}
          mentionOpen={d.composer?.mention}
          offline={d.composer?.offline}
          placeholder={`评论第 ${slide} 页…`}
          aria={`添加评论（第 ${slide} 页）`}
          onSubmit={(v) => {
            const id = newId()
            const t: Thread = { id, page: slide, anchor: { kind: "page", label: "整页", ...PAGE_PIN }, createdBy: U.zhou.id, activity: 0, replies: [{ id: newId(), by: U.zhou, when: "刚刚", body: v }] }
            setThreads((ts) => [t, ...ts])
            setFilter((f) => (f === "mine" || f === "detached" ? "page" : f))
            setFlash({ id, n: Date.now() })
            setText("")
            announce("已发表评论")
          }}
        />
      </div>
    </div>
  )
}

/**
 * 备选（alt-compose-panel，03-06 原文「面板底部撰写框聚焦」的 v3 读法）：评论工具点选后，检查器自动切到「评论」页签，
 * 撰写框出现在列表顶部（强调色淡底，写明锚点），画布上只留临时钉。代价：多了一处自动切页签（01 §2.3 只允许点评论钉一处）。
 */
function AltComposeBlock({ label }: { label: string }) {
  const [text, setText] = useState("")
  return (
    <div className="border-b border-(--v3-border) bg-(--v3-accent-soft) px-4 py-3">
      <p className="mb-2 flex h-4 items-center gap-2 text-[12px] leading-4 text-(--v3-text-2)">
        <Avatar name={U.zhou.name} tone={U.zhou.tone} size={16} />
        <span className="truncate">新评论 · {label}</span>
      </p>
      <Composer variant="canvas" value={text} onChange={setText} showFocused placeholder="写评论，输入 @ 提及协作者" aria={`添加评论（${label}）`} onSubmit={() => setText("")} onCancel={() => setText("")} />
    </div>
  )
}

export function CommentsPanel() {
  const ctx = useEditor()
  const d = useData()
  const perms = usePerms()
  const [threads] = useThreads()
  const [filter, setFilter] = useFilter()
  const [sort] = useSort()
  const detached = threads.filter((t) => !!t.anchor.detached).length
  // 已脱离锚点的线程都处理掉（恢复、删除）后，临时筛选随之消失，回到「全部」
  useEffect(() => {
    if (filter === "detached" && detached === 0) setFilter("all")
  }, [filter, detached, setFilter])
  const locked = d.loading ? "文档打开后可用" : d.loadFailed ? "评论加载失败" : undefined
  const list = applySort(applyFilter(threads, filter, ctx.slide), sort)
  const grouped = filter === "page" || sort === "page"
  // 组头只在「按页码」跨页分组时出现；「当前页」只有一组，组头与筛选重复
  const headers = sort === "page" && filter !== "page"
  const crossPage = !grouped

  let body
  if (d.loadFailed) {
    // 未采纳的备选 alt-load-failed（DS-53 定为不设面板级加载失败，这里只留作对照）：整块换成 kit PanelState
    body = (
      <PanelState title="评论加载失败" action={<Button variant="secondary">重试</Button>}>
        画布上的评论钉不受影响
      </PanelState>
    )
  } else if (d.loading) {
    // 整栏还没有内容：kit LoadingRow 居中（与插件列表同一件；版本历史、分享的加载行在列表里，左对齐）
    body = <LoadingRow center>正在加载评论…</LoadingRow>
  } else if (list.length === 0) {
    // 整栏没有内容：kit EmptyNote（居中、px-4 py-10、12px），第一句陈述用主文字色、第二句告诉怎么开始（text-2）——新评论只有评论工具一个入口
    body = (
      <EmptyNote>
        <p className="text-(--v3-text)">{filter === "page" ? `第 ${ctx.slide} 页还没有评论` : EMPTY[filter]}</p>
        {perms.comment && (filter === "page" || filter === "all") && (
          <p className="mt-1">
            {d.panelComposer ? (
              <Phrases parts={["用工具条的「评论」（C）点选对象，", "或在下方直接评论这一页"]} />
            ) : (
              <Phrases parts={["用工具条的「评论」（C）", "点选对象或空白处添加评论"]} />
            )}
          </p>
        )}
      </EmptyNote>
    )
  } else if (grouped) {
    body = (
      <div>
        {groupByPage(list).map(([page, ts], i) => (
          <section key={page} aria-label={`第 ${page} 页的评论`}>
            {headers && <GroupHeader page={page} count={ts.filter((t) => !t.resolved).length} first={i === 0} />}
            <ThreadGroup list={ts} groupKey={String(page)} label={`第 ${page} 页的评论列表`} />
          </section>
        ))}
      </div>
    )
  } else {
    body = <ThreadGroup list={list} showPage={crossPage} groupKey="all" label="评论" />
  }

  const alt = (d as { altCompose?: { anchor: { label: string } } }).altCompose
  return (
    <>
      <FilterBar detached={detached} locked={locked} />
      {alt && <AltComposeBlock label={alt.anchor.label} />}
      {body}
      {d.panelComposer && perms.comment && !d.loading && <PanelComposer />}
    </>
  )
}
