import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { BookmarkPlus, CloudOff, History, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  AvatarStack, Button, Dialog, FoldRow, ICON, IconButton, InspectorNotice, InspectorTakeover, LoadingRow, PanelState, Phrases, Section, Tag, TextArea, TextField, overlayOpen, scrollIntoPanel,
  userHasInteracted, useSceneState,
} from "../../kit"
import { MORE, namedVersion, NEW_NAME, titleOf, namesOf, type Deleted, type Item, type Version } from "./data"
import { useVh, type Vh } from "./store"

/**
 * 版本历史整栏面板（kit InspectorTakeover，DS-26 先例的「检查器整栏面板」）：文档菜单「版本历史」打开后检查器整栏换成版本列表，
 * 协作行（协作者 · 放映 · 分享）原样不动，页签行换成标题行「版本历史 · 命名当前版本 · 关闭」。宽度沿用检查器的 280（不加宽，画布不跳动；备选 400 见 alt-wide）。
 * 列表（03-07、50/08 §9、rulings §4.25 DS-57）：当前版本在最上 → 按天分组（今天 / 昨天 / 10 月 6 日…）→ 更早的月份收起成一行；同一天里相邻两条及以上的自动版本收成
 * 「N 个自动版本 起–止」、只有一条时单列（由 data.ts 推导）；月份行、组行与「最近删除」是同一种折叠行（kit FoldRow，与评论「已解决 N」同一个件）；
 * 命名版本加粗名称 + 说明 + 作者与时刻；恢复版本「恢复自『X』」；导入版本「导入自『文件名』」；30 天以前的自动版本标「当日最后版本」。
 * 点某一行 = 预览这个版本（画布与左栏换成该版本的只读内容，横幅通道出预览横幅）；「恢复此版本」只在横幅上（Q2 入口唯一），列表行上不重复。
 * 键盘：↑ ↓ 在行之间移动焦点，Enter / Space 选中；Esc 逐层：先收起命名表单 → 再回到当前版本 → 最后关闭面板（焦点回文档菜单）。
 */
export function HistoryPanel() {
  const vh = useVh()
  return (
    <InspectorTakeover title="版本历史" width={vh.width} returnFocus="doc-menu" autoFocus={false} actions={<NameAction vh={vh} />}>
      <PanelBody />
    </InspectorTakeover>
  )
}

/** 标题行的「命名当前版本」（唯一的常驻入口；命令面板是第二入口）：所有者可用，编辑者「需要所有者权限」，离线「离线时不可用」（50/08 §11） */
function NameAction({ vh }: { vh: Vh }) {
  const off = !!vh.nameReason
  return (
    <IconButton
      label="命名当前版本"
      variant={vh.naming && !off ? "on" : "ghost"}
      pressed={vh.naming && !off}
      disabled={off}
      reason={vh.nameReason}
      onClick={() => vh.setNaming((v) => !v)}
      data-v3-anchor="version-history.name"
    >
      <BookmarkPlus {...ICON} />
    </IconButton>
  )
}

/* ------------------------------------------------------------------ 面板内容 */

function PanelBody() {
  const vh = useVh()
  const ref = useRef<HTMLDivElement>(null)
  const live = useRef(vh)
  live.current = vh

  // Esc 逐层（50/10 §7.1）：命名表单 → 回到当前版本 → 交给面板关闭。内容先于面板注册监听，所以先执行；浮层开着时不动
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing || overlayOpen()) return
      const v = live.current
      if (v.naming) {
        e.preventDefault()
        focusRowNow("current")
        v.setNaming(false)
        return
      }
      if (v.previewing) {
        e.preventDefault()
        focusRowNow("current")
        v.setSelected("current")
        v.setConfirm(false)
      }
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [])

  // 网格 → 单页打开（文档菜单「版本历史」，focusPanelOnMount）：面板与检查器在同一次提交里挂上，布局阶段就把焦点交给落点——
  // 网格胶囊（连同触发它的文件名）卸载与焦点交接在同一个任务里，焦点不在 body 停留一帧。
  // 用户操作打开、焦点已经掉到 body 的（如在别的样张里选「版本历史」转过来，面板随新状态挂上）：同样在布局阶段交给落点
  useLayoutEffect(() => {
    const a = document.activeElement
    const lost = !a || a === document.body || !a.isConnected
    const fromGrid = !!focusOnMountAt && performance.now() - focusOnMountAt <= 2000
    focusOnMountAt = 0
    if (fromGrid || (lost && userHasInteracted())) landingOf(live.current)?.focus({ preventScroll: true })
  }, [])

  // 用户打开面板时焦点落在选中的版本上（不是第一个可聚焦项「最近删除」）；加载失败时没有版本行，落在「重试」上；状态里一出现就开着的不抢焦点
  useEffect(() => {
    if (userHasInteracted()) focusPanel(live.current)
    const to = live.current.data.scrollTo
    if (to) scrollIntoPanel(ref.current?.querySelector<HTMLElement>(`[data-vh-anchor="${to}"]`), { align: "start", offset: 4 })
  }, [])

  if (vh.status === "error") return <ErrorBlock vh={vh} />
  return (
    <div ref={ref}>
      {/* 顺序：状态说明（离线 / 权限）→ 命名表单 → 最近删除 → 版本列表 */}
      {vh.status === "offline" && (
        <InspectorNotice icon={<CloudOff {...ICON} aria-hidden="true" />}>
          <Phrases parts={["离线 · 无法加载版本历史，", "只显示本地最新内容"]} />
        </InspectorNotice>
      )}
      {/* 编辑者（有 history.read、没有 history.restore / doc.manage）：按钮留在原位不可用，原因在顶部一行写明（同降权检查器、分享非所有者视图的「只读 · …」，DS-15） */}
      {vh.role === "editor" && (
        <InspectorNotice icon={<Lock {...ICON} aria-hidden="true" />}>
          <Phrases parts={["只有所有者可以命名或恢复版本"]} />
        </InspectorNotice>
      )}
      {vh.status === "offline-cached" && (
        <InspectorNotice icon={<CloudOff {...ICON} aria-hidden="true" />}>
          <Phrases parts={["离线 · 可能不是最新；", "恢复连接前不能切换、命名或恢复版本"]} />
        </InspectorNotice>
      )}
      {vh.naming && !vh.nameReason && <NameForm vh={vh} />}
      {vh.role === "owner" && vh.deleted.length > 0 && <RecentlyDeleted vh={vh} />}
      <VersionList vh={vh} />
    </div>
  )
}

/** 下一次面板挂载时在布局阶段直接聚焦（网格 → 单页时由 VhController 调用；2 秒内有效，用掉即清） */
let focusOnMountAt = 0
export function focusPanelOnMount() {
  focusOnMountAt = performance.now()
}

/** 面板里焦点该落的地方：加载失败时是「重试」（没有版本行），否则是选中的版本；面板不在时为 null */
export function landingOf(vh: Pick<Vh, "status" | "selected">): HTMLElement | null {
  return vh.status === "error" ? document.querySelector<HTMLElement>("[data-vh-error] button") : document.querySelector<HTMLElement>(`[data-vh-row="${CSS.escape(vh.selected)}"]`)
}

/** 焦点交给面板里该落的地方（landingOf；文档菜单「版本历史」再选一次、面板已开着时同此） */
export function focusPanel(vh: Pick<Vh, "status" | "selected">) {
  if (vh.status === "error") {
    window.setTimeout(() => requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-vh-error] button")?.focus()), 50)
    return
  }
  focusRow(vh.selected)
}

/** 焦点移到某一行（current 为当前版本）；元素不在时不动 */
export function focusRow(id: string) {
  // 稍等一下：横幅、确认卡这类随之卸载的浮层会在卸载后的下一个任务里把焦点还给触发处或画布（Radix / kit focusBack），这里要排在它们之后；
  // 再兜一次：那时焦点若被交给了画布或 body（触发处已随横幅卸载），再拉回这一行（用户已经点到别处时不动）
  const go = () => document.querySelector<HTMLElement>(`[data-vh-row="${id}"]`)?.focus()
  window.setTimeout(() => requestAnimationFrame(go), 50)
  window.setTimeout(() => {
    const a = document.activeElement
    if (!a || a === document.body || a.matches('[data-v3-anchor="stage"], [data-v3-anchor="canvas"]')) go()
  }, 200)
}

/**
 * 同步交接（07 §2：焦点不掉到 body）：那一行已在页面上时，在触发元素卸载之前就把焦点交过去，同一个任务里完成、不在 body 停一帧（同「加载更早版本」）。
 * 预览横幅「返回当前版本」、命名表单的保存 / 取消 / ↵ / Esc、预览中按 Esc 先交焦点再改状态；加载失败「重试」先同步提交（flushSync），「当前版本」一行挂上后再交。
 * 兜底同 focusRow：随之卸载的浮层若在下一个任务里把焦点交给了画布或 body，再拉回这一行（用户已经点到别处时不动）；行还不在时退回 focusRow。
 */
export function focusRowNow(id: string) {
  const find = () => document.querySelector<HTMLElement>(`[data-vh-row="${CSS.escape(id)}"]`)
  const el = find()
  if (!el) {
    focusRow(id)
    return
  }
  el.focus()
  window.setTimeout(() => {
    const a = document.activeElement
    if (!a || a === document.body || a.matches('[data-v3-anchor="stage"], [data-v3-anchor="canvas"]')) find()?.focus()
  }, 200)
}

/* ------------------------------------------------------------------ 版本列表 */

/**
 * 版本列表：当前版本 + 分组。offline-cached 时整个时间轴置灰、不可点（03-07「离线」），正在预览的那一行保持选中；
 * offline（没加载过）只有当前版本；loading 只有当前版本（本地即有）+ 加载行；empty 只有导入版本 + 一句说明。
 */
export function VersionList({ vh, compact }: { vh: Vh; compact?: boolean }) {
  const frozen = vh.status === "offline-cached"
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
    const rows = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-vh-nav]"))
    const i = rows.indexOf(document.activeElement as HTMLElement)
    if (i < 0) return
    e.preventDefault()
    rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus()
  }
  const showList = vh.status === "ready" || vh.status === "offline-cached" || vh.status === "empty"
  return (
    <div className={cn("flex flex-col px-2 py-2", compact && "pt-1")} onKeyDown={onKeyDown}>
      {/* 列表语义（07 §3）：每一行（含日期小标题、折叠行）是一个 listitem，选中行 aria-current；加载行与列表末尾的说明在列表之外 */}
      <div role="list" aria-label="版本" className="flex flex-col">
        <CurrentRow vh={vh} />
        {showList && <Items items={vh.list} vh={vh} frozen={frozen} />}
      </div>
      {vh.status === "loading" && <LoadingRow>正在加载版本历史…</LoadingRow>}
      {vh.status === "empty" && (
        <p className="px-2 pt-3 text-[12px] leading-[18px] text-(--v3-text-2)">
          <Phrases parts={["还没有其他版本。", "继续编辑后会自动生成版本；", "需要留档时，可以命名当前版本。"]} />
        </p>
      )}
      {(vh.status === "ready" || frozen) && <ListEnd vh={vh} frozen={frozen} />}
    </div>
  )
}

function Items({ items, vh, frozen }: { items: Item[]; vh: Vh; frozen: boolean }) {
  return (
    <>
      {items.map((it) => {
        if (it.t === "day") return <DayHeader key={it.id} id={it.id} label={it.label} />
        if (it.t === "v") return <VersionRow key={it.v.id} v={it.v} vh={vh} frozen={frozen} />
        if (it.t === "run") return <RunRows key={it.id} id={it.id} range={it.range} versions={it.versions} vh={vh} frozen={frozen} />
        return <MonthRows key={it.id} id={it.id} label={it.label} summary={it.summary} items={it.items} vh={vh} frozen={frozen} />
      })}
    </>
  )
}

/** 当前版本：总在最上，点它 = 回到正在编辑的文档（与横幅「返回当前版本」同一件事：列表里的选择 vs 预览中的出口） */
function CurrentRow({ vh }: { vh: Vh }) {
  const on = vh.selected === "current"
  return (
    <div role="listitem">
    <button
      type="button"
      data-vh-row="current"
      data-vh-nav=""
      data-v3-anchor="version-history.row-current"
      aria-current={on ? "true" : undefined}
      onClick={() => {
        vh.setSelected("current")
        vh.setConfirm(false)
        vh.setPreviewLoading(false)
      }}
      className={cn("flex h-8 w-full items-center rounded-[6px] px-2 text-left text-[12px] leading-4 text-(--v3-text) transition-colors", on ? "v3-on-cue bg-(--v3-accent-soft)" : "hover:bg-(--v3-panel-2)")}
    >
      当前版本
    </button>
    </div>
  )
}

function DayHeader({ id, label }: { id: string; label: string }) {
  return (
    <div role="listitem">
      <h3 data-vh-anchor={id} className="px-2 pt-3 pb-1 text-[12px] leading-4 font-medium text-(--v3-text-2)">
        {label}
      </h3>
    </div>
  )
}

/**
 * 一个版本（一行）。自动版本单行：时刻 · 贡献者；命名 / 恢复 / 导入多行：标题（命名加粗）· 说明 · 作者与时刻。
 * 选中（正在预览）：强调色淡底 + 文字 500（非颜色线索 v3-on-cue，DS-35）。frozen（离线缓存）：置灰、不可点，选中行保持。
 * group：所在的自动版本组（组展开后逐条列出时）——缩进一档，listitem 上 data-vh-in 记下组 id。
 */
function VersionRow({ v, vh, frozen, group }: { v: Version; vh: Vh; frozen: boolean; group?: string }) {
  const indent = !!group
  const on = vh.selected === v.id
  const off = frozen && !on
  const meta = `${namesOf(v.by)} · ${v.time}`
  const label =
    v.kind === "auto"
      ? `${v.when}，自动版本，${namesOf(v.by)}${v.last ? "，当日最后版本" : ""}${v.preRestore ? "，恢复前" : ""}`
      : `${titleOf(v)}，${v.kind === "named" ? "命名版本" : v.kind === "restore" ? "恢复版本" : "导入版本"}，${namesOf(v.by)}，${v.when}`
  return (
    <div role="listitem" data-vh-in={group}>
    <button
      type="button"
      data-vh-row={v.id}
      data-vh-nav=""
      data-v3-anchor={`version-history.row-${v.id}`}
      aria-current={on ? "true" : undefined}
      aria-disabled={off || undefined}
      aria-label={off ? `${label}（离线时不能切换版本）` : label}
      onClick={() => {
        if (off) return
        vh.setSelected(v.id)
        vh.setConfirm(false)
        // 换版本时取消上一个请求（50/08 §9）；样张里其余版本的快照即刻就绪
        vh.setPreviewLoading(false)
      }}
      className={cn(
        "flex w-full flex-col rounded-[6px] px-2 text-left transition-colors",
        v.kind === "auto" ? "h-8 justify-center" : "gap-1 py-2",
        // 组里的版本缩进一档：文字与组标题「N 个自动版本」的文字对齐（8 + 箭头 12 + 间距 6）
        indent && "pl-[26px]",
        on ? "v3-on-cue bg-(--v3-accent-soft)" : off ? "cursor-default" : "hover:bg-(--v3-panel-2)",
      )}
    >
      {v.kind === "auto" ? (
        <span className="flex items-center gap-2 text-[12px] leading-4">
          <span className={cn("tabular-nums", off ? "text-(--v3-text-3)" : "text-(--v3-text)")}>{v.time}</span>
          <AvatarStack people={v.by} />
          <span className={cn("font-normal whitespace-nowrap", off ? "text-(--v3-text-3)" : "text-(--v3-text-2)")}>{namesOf(v.by)}</span>
          {v.last && <Tag className="ml-auto font-normal">当日最后版本</Tag>}
          {v.preRestore && <Tag className="ml-auto font-normal">恢复前</Tag>}
        </span>
      ) : (
        <>
          <span className={cn("text-[12px] leading-[18px]", v.kind === "named" && "font-semibold", off ? "text-(--v3-text-3)" : "text-(--v3-text)")}>
            {v.kind === "import" ? (
              <>
                导入自<span className="whitespace-nowrap">「{v.file}」</span>
              </>
            ) : (
              titleOf(v)
            )}
          </span>
          {v.note && <span className={cn("text-[12px] leading-[18px] font-normal", off ? "text-(--v3-text-3)" : "text-(--v3-text-2)")}>{v.note}</span>}
          <span className={cn("flex items-center gap-1.5 text-[12px] leading-4 font-normal", off ? "text-(--v3-text-3)" : "text-(--v3-text-2)")}>
            <AvatarStack people={v.by} />
            <span className="tabular-nums">{meta}</span>
          </span>
        </>
      )}
    </button>
    </div>
  )
}

/**
 * 列表里的折叠行：月份行、自动版本组行、「最近删除」都用 kit FoldRow 的 inset 形态（第 2 批统一画法，与评论「已解决 N」是同一个件，第 6 轮集成并入底座）——
 * 高 32、箭头在前（ChevronRight 12、描边 1.5，展开时转 90°；减少动态效果时不转场）、文字 12px 次级文字色（悬停铺 panel-2、文字转主色）、
 * 左缘与列表正文对齐（列表容器左右各 8、行内再 8：箭头左缘在 16 = 「当前版本」、日期小标题、版本行文字的左缘）、箭头与文字间距 6、整行可点、aria-expanded；
 * 悬停底色的形状随所在列表的行：版本列表的行左右内缩 8、圆角 6（同选中行）。离线缓存（frozen）时置灰、aria-disabled（kit FoldRow disabled）。
 * 这里只补版本列表自己的键盘与验证记号：data-vh-anchor（↑ ↓ 移动焦点的落点）、data-vh-fold（哪一种折叠行）、data-vh-nav（参与 ↑ ↓）、data-v3-anchor（对话框关闭后焦点交回处）。
 */
function VhFoldRow({ kind, open, off, onToggle, anchor, headAnchor, nav = true, children }: {
  /** 哪一种折叠行（data-vh-fold，验证与样式核对用） */
  kind: "run" | "month" | "deleted"
  open: boolean
  off?: boolean
  onToggle: () => void
  anchor?: string
  headAnchor?: string
  nav?: boolean
  children: ReactNode
}) {
  return (
    <FoldRow
      inset
      open={open}
      disabled={off}
      onToggle={onToggle}
      data-vh-anchor={anchor}
      data-vh-fold={kind}
      data-vh-nav={nav ? "" : undefined}
      data-v3-anchor={headAnchor}
    >
      {children}
    </FoldRow>
  )
}

const toggleIn = (vh: Vh, id: string) => vh.setExpanded((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

/**
 * 同一天里相邻的自动版本收成一行「N 个自动版本 起–止」（03-07：「今天」可能有密集的自动版本节点；条数与起止由 data.ts groupDay 推导）；
 * 点开后逐条列出（新的在前），缩进一档：版本行的文字与组标题的文字对齐（箭头 12 + 间距 6）
 */
function RunRows({ id, range, versions, vh, frozen }: { id: string; range: string; versions: Version[]; vh: Vh; frozen: boolean }) {
  const open = vh.expanded.includes(id)
  return (
    <>
      <div role="listitem">
        <VhFoldRow kind="run" open={open} off={frozen} anchor={id} onToggle={() => toggleIn(vh, id)}>
          {versions.length} 个自动版本
          <span className="tabular-nums">{range}</span>
        </VhFoldRow>
      </div>
      {open && versions.map((v) => <VersionRow key={v.id} v={v} vh={vh} frozen={frozen} group={id} />)}
    </>
  )
}

/** 更早的月份收起成一行（默认只展开最近一个月）：▸ 月份 · 摘要（命名版本数，由 data.ts monthItem 推导）；展开后按天列出 */
function MonthRows({ id, label, summary, items, vh, frozen }: { id: string; label: string; summary: string; items: Item[]; vh: Vh; frozen: boolean }) {
  const open = vh.expanded.includes(id)
  return (
    <>
      <div role="listitem" className="mt-2">
        <VhFoldRow kind="month" open={open} off={frozen} anchor={id} onToggle={() => toggleIn(vh, id)}>
          {/* 「9 月 2 个命名版本」连读会像日期，中间用「·」隔开 */}
          {label} · {summary}
        </VhFoldRow>
      </div>
      {open && <Items items={items} vh={vh} frozen={frozen} />}
    </>
  )
}

/**
 * 列表末尾：加载更早版本（游标翻页）与保留口径说明（文案不写死天数，50/08 §9）。
 * 分量（标杆对照：Figma 的「Show older」是一行左对齐的文字链接）：ghost 文字按钮、高 32、左对齐，不满宽、不描边（原满宽次按钮是整张列表里唯一带边框的控件）；
 * 不照搬蓝色链接（质量门 Q3）。画法同列表里的折叠行（kit FoldRow 的 inset 形态）：前面一个 12px 图标（History，描边 1.5）与月份行的箭头同一列（面板内 16）、
 * 图标与文字间距 6，文字 12px 常规字重、次级文字色，悬停铺 panel-2、文字与图标转主文字色——第 6 轮曾改成主文字色 500 去和日期小标题拉开，却与命名版本
 * （主文字色 600 + 下一行次级色说明）几乎一样，扫视时像一个版本条目（r6 审计）；带图标、常规字重的安静行既不像小标题、也不像版本。
 * 下面的保留口径说明与它隔开 12（原 8），不读成它的副标题。加载中的状态行同样左对齐（kit LoadingRow，转圈在 16）。
 * 焦点（07 §2：焦点不掉到 body，异步替换不静默转移焦点）：按「加载更早版本」后按钮换成加载中的状态行，焦点交给这一行（tabIndex −1，role=status，
 * 读屏名「正在加载更早版本」：role=status 不从内容取名，没有它焦点落下时只念「状态」）；
 * 加载完成、状态行随之消失时，焦点交给新出现的第一行（更早的月份「7 月 · 导入版本」），用户已经把焦点移到别处时不动
 */
function ListEnd({ vh, frozen }: { vh: Vh; frozen: boolean }) {
  return (
    <div className="flex flex-col items-start gap-3 pt-2 pb-2">
      {vh.more !== "done" &&
        (vh.more === "loading" ? (
          <LoadingRow focusable label="正在加载更早版本" data-vh-more-status="">
            正在加载…
          </LoadingRow>
        ) : (
          <Button
            variant="ghost"
            className="h-8 justify-start px-2 font-normal"
            disabled={frozen}
            reason={frozen ? "离线时不可用" : undefined}
            data-vh-more=""
            onClick={() => {
              // 按钮随之换成加载行：同步提交后立刻把焦点交给加载行（同一个任务里交接，焦点不在 body 停留一帧）
              flushSync(() => vh.setMore("loading"))
              document.querySelector<HTMLElement>("[data-vh-more-status]")?.focus({ preventScroll: true })
              // 模拟翻页请求；不随组件卸载取消（面板收起后结果照样写回场景状态）
              window.setTimeout(() => {
                const a = document.activeElement
                const waiting = !a || a === document.body || !!a.closest("[data-vh-more-status]")
                flushSync(() => vh.setMore("done"))
                const first = MORE[0]
                if (waiting && first) document.querySelector<HTMLElement>(`[data-vh-anchor="${first.id}"]`)?.focus({ preventScroll: true })
              }, 700)
            }}
          >
            <History size={12} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
            加载更早版本
          </Button>
        ))}
      <p className="px-2 text-[12px] leading-[18px] text-(--v3-text-2)">
        <Phrases parts={["较早的自动版本按天保留，", "命名版本永久保留"]} />
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ 命名当前版本 */

/**
 * 命名当前版本（03-07「交互说明」、50/08 §9）：在面板顶部原位展开的一节，名称 ≤ 30 字（计数常显）、说明可选；
 * 「保存」先 flush 本端未落库的更改再提交，成功后今天最前面出现这个命名版本并提示；名称为空时「保存」不可用。
 * 备选（未采用）：Figma 的模态对话框。原位展开不遮挡画布，也不离开列表。
 */
function NameForm({ vh }: { vh: Vh }) {
  const init = vh.data.naming ? NEW_NAME : { name: "", note: "" }
  const [name, setName] = useState(init.name)
  const [focusOnMount] = useState(() => userHasInteracted())
  const noteBox = useRef<HTMLDivElement>(null)
  const empty = !name.trim()
  const save = () => {
    if (empty) return
    // 每文档命名版本上限 200（409 server.snapshots.named_limit_reached）：表单留着、出错误提示（50/08 §9）
    if (vh.data.limit) {
      vh.setToast(null)
      requestAnimationFrame(() => vh.setToast("name-limit"))
      return
    }
    const note = noteBox.current?.querySelector("textarea")?.value.trim() ?? ""
    // 本场景里可以连着命名几次：第二次起新版本的 id 加序号（data.ts namedVersion）
    // 焦点先交给「当前版本」一行，再收起表单（名称框随之卸载，焦点不经过 body）
    focusRowNow("current")
    vh.setExtra((cur) => [namedVersion(name.trim(), note, cur.filter((v) => v.kind === "named").length), ...cur])
    vh.setNaming(false)
    vh.setToast("named")
  }
  return (
    <Section title="命名当前版本" anchor="version-history.name-form">
      <TextField
        aria="版本名称"
        value={name}
        onChange={(v) => setName(v.slice(0, 30))}
        // 名称框里按 ↵ 即保存（与评论编辑的「↵ 保存」一致）；输入法组合中的 ↵ 不提交；名称为空时不提交
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.nativeEvent.isComposing) return
          e.preventDefault()
          save()
        }}
        placeholder="如：提案定稿"
        autoFocus={focusOnMount}
        leading={<span className="shrink-0 text-[12px] leading-none text-(--v3-text-2)">名称</span>}
        trailing={<span className="shrink-0 text-[11px] leading-none text-(--v3-text-2) tabular-nums">{name.length}/30</span>}
      />
      <div ref={noteBox}>
        <TextArea aria="版本说明（可选）" placeholder="说明（可选）：这一版改了什么" rows={2} defaultValue={init.note} />
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            focusRowNow("current")
            vh.setNaming(false)
          }}
        >
          取消
        </Button>
        <Button variant="primary" disabled={empty} reason={empty ? "请输入名称" : undefined} onClick={save}>
          保存
        </Button>
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ 最近删除 */

/**
 * 最近删除（M3，仅所有者；「彻底删除元素」的唯一入口，rulings §4.18 CO-07、50/04 §7.1）：面板顶部的可折叠分组，缺省收起；
 * 每行：元素与所在页 · 删除者 · 删除时间 / 剩余保留时长 ·［彻底删除］。不设恢复按钮（找回走删除方撤销或「恢复元素」）。
 * 彻底删除先弹确认框（不可撤销的销毁性操作用确认框，03-05 §6）；确认后该行消失、提示「已彻底删除 1 个元素」（不带撤销）。离线时不可用。
 * 标题行是列表的折叠行（kit FoldRow：▸ 最近删除 3，与月份行、自动版本组行、评论「已解决 N」同一个件），不再用检查器的 FoldSection（右侧 ▾、600 字重）；
 * 开合是场景状态（初值 data.deletedOpen），面板收起再打开时保持。
 */
function RecentlyDeleted({ vh }: { vh: Vh }) {
  // 正在确认彻底删除的元素：场景状态（初值 data.purge）。关掉确认框后清空，面板收起再打开不会重放演示用的确认框
  const [purgeId, setPurgeId] = useSceneState<string | null>("version-history.purge", vh.data.purge ?? null)
  const [open, setOpen] = useSceneState<boolean>("version-history.deleted-open", !!vh.data.deletedOpen)
  const purge: Deleted | null = vh.deleted.find((x) => x.id === purgeId) ?? null
  const setPurge = (d: Deleted | null) => setPurgeId(d?.id ?? null)
  return (
    <>
      <section data-v3-anchor="version-history.deleted" className="border-b border-(--v3-border) px-2 py-1">
        <h3>
          {/* headAnchor：彻底删除确认框关闭后焦点交回这一行 */}
          <VhFoldRow kind="deleted" open={open} onToggle={() => setOpen(!open)} headAnchor="version-history.deleted-head" nav={false}>
            最近删除
            <span className="tabular-nums">{vh.deleted.length}</span>
          </VhFoldRow>
        </h3>
        {open && (
          <div className="flex flex-col gap-3 px-2 pt-1 pb-2">
            <p className="text-[12px] leading-[18px] text-(--v3-text-2)">
              <Phrases parts={["到期后自动清除；", "要找回，请由删除者撤销，", "或由被删方在提示里恢复"]} />
            </p>
            <ul className="flex flex-col gap-3">
              {vh.deleted.map((d) => (
                <li key={d.id} className="flex flex-col gap-1">
                  <p className="text-[12px] leading-[18px] text-(--v3-text)">
                    {d.label} · 第 {d.page} 页<span className="text-(--v3-text-2)"> · {d.by.name} · {d.ago}</span>
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] leading-4 text-(--v3-text-2)">{d.left}</span>
                    <Button
                      variant="secondary"
                      disabled={!!vh.purgeReason}
                      reason={vh.purgeReason}
                      data-v3-anchor={`version-history.purge-${d.id}`}
                      onClick={() => setPurge(d)}
                    >
                      彻底删除
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      {purge && (
        <Dialog
          variant="confirm"
          title={`彻底删除「${purge.label}」？`}
          description={<Phrases parts={["删除后无法恢复。", "历史版本仍含该内容，", "要连历史清除请永久删除文档。"]} />}
          open
          onOpenChange={(o) => !o && setPurge(null)}
          secondary={{ label: "取消" }}
          primary={{
            label: "彻底删除",
            danger: true,
            onClick: () => {
              vh.setDeleted((cur) => cur.filter((x) => x.id !== purge.id))
              vh.setToast("purged")
            },
          }}
          returnFocus="version-history.deleted-head"
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ 加载失败 */

/** 加载失败（03-07「错误」）：替换整个内容区（kit PanelState，与插件面板、插件整页面板的出错态同一画法）；「重试」回到加载中，加载完成后出列表（面板内联错误态，不进横幅通道，03-12） */
function ErrorBlock({ vh }: { vh: Vh }) {
  return (
    <div data-vh-error="">
      <PanelState
        title="版本历史加载失败"
        action={
          <Button
            variant="secondary"
            onClick={() => {
              // 「重试」随错误态卸载：同步提交加载中（「当前版本」一行本地即有、随之挂上），同一个任务里把焦点交给它，不掉到 body
              flushSync(() => vh.setStatus("loading"))
              focusRowNow("current")
              // 模拟重新请求：本组件随状态切换卸载，计时器不能跟着取消
              window.setTimeout(() => vh.setStatus("ready"), 900)
            }}
          >
            重试
          </Button>
        }
      >
        请检查网络连接后重试
      </PanelState>
    </div>
  )
}
