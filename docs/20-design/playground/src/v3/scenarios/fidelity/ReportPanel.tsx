import { useEffect, useRef } from "react"
import { flushSync } from "react-dom"
import { ChevronLeft, ChevronRight, CircleCheck, LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Button, closeWithFocusBack, EmptyNote, ICON, IconButton, InspectorTakeover, PanelState, Phrases, Progress, scrollIntoPanel, Section, Segmented, useEditor, useSceneState, type SegOption,
} from "../../kit"
import { countOf, GENERATING, GROUPS, pagesOf, SOURCE_FILE, type Occurrence, type ReportItem, type Variant } from "./data"
import { useFocusItem, useLocate, useLocated, useReport, useReportDialogOpen, useReportOpen, useReturnFocus, useScope, type Located, type Scope } from "./store"

/**
 * 保真报告（03-10）的 v3 呈现：检查器整栏面板（kit InspectorTakeover，DS-26 先例）；宽度沿用检查器 280、不加宽，打开 / 关闭时画布不跳动（与版本历史同一取舍）。
 * 不用模态对话框：报告的主要用法是「看一条、定位、再看下一条」，面板开着时画布始终可见，定位后不必重开（对话框画法见 alt-dialog）。
 * 结构：标题行「保真报告 · 导入自 <原文件名>」→ 概要（一行「9 项差异 · 涉及 8 页 · 1 项以占位显示」，放不下按词组换行；「内容都已原样保留」）+ 范围「全部 · 本页」
 * → 按类型分组（无法解析 · 图表 · 图形与对象 · 动画与切换 · 外部内容 · 字体），每类一行、同类合并计数。
 * 一行压回 03-10 线框的两段（标杆对照「报告条目的密度」）：第一行「类型图标 · 名称 · 计数」，右端「定位」（已定位、多处时「‹ 1 / 4 ›」）；
 * 第二段是支持级措辞（text-2），页码接在后面（「…导出后可在 PowerPoint 查看 · 第 7 页」；超过 5 页「· 共 6 页」+「查看全部页码」，03-10 边界）；
 * 字体条目的对照（「汉仪旗黑」→「思源黑体」）在两段之间。上下内边距 6，没有单独的页码行。
 * 「定位」跳到第一处所在页并在画布上短暂高亮（对象 2px 强调色外框、整页 2px 外圈），这一行成为当前项（强调色淡底），
 * 页码的位置换成「第 n 页 · 是什么」（主文字色）。状态色只给条目图标（无法解析 danger、以占位显示 warning），概要与文字一律 text / text-2（标杆对照「报告概要的颜色」，Q3）。
 * 报告内容是文件事实，对所有角色一致；评审、查看者照常可开、可定位（只读角色画布不画手柄，本来也不改选中）。
 */

/**
 * 检查器整栏的保真报告（状态声明的整栏面板 inspector.takeover，开关是 useReportOpen = kit useTakeoverOpen，见 fidelity.scenario.tsx）。
 * 用户打开时焦点进面板第一个可聚焦项（InspectorTakeover autoFocus；主菜单、右键菜单关闭时不再把焦点抢回触发处）。
 */
export function ReportPanel() {
  const [, setOpen] = useReportOpen()
  const [, setLoc] = useLocated()
  const [ret] = useReturnFocus()
  // 交回打开它的控件（03-10 §2）：主菜单按钮、横幅按钮、右键的占位（面板开着时都在）先聚焦再收起；检查器「保真详情」、页级提示条「查看详情」随面板关闭才重新挂上，
  // 同步提交关闭后在同一个任务里交过去；没有来源时交给画布——焦点都不经过 body（kit closeWithFocusBack）
  const close = () =>
    closeWithFocusBack(
      () => {
        setOpen(false)
        setLoc(null)
      },
      ret,
      document.querySelector("[data-v3-takeover]"),
    )
  return (
    <InspectorTakeover title="保真报告" subtitle={`导入自 ${SOURCE_FILE}`} width={280} onClose={close}>
      {/* relative：正文里读屏用的 sr-only 播报区（绝对定位）以这一层为包含块、随面板滚动区裁住，不把整页撑出纵向滚动（第 2 批集成修正，README §9） */}
      <div className="relative flex min-h-full flex-col">
        <ReportBody />
      </div>
    </InspectorTakeover>
  )
}

/* ------------------------------------------------------------------ 正文（面板与对话框备选共用） */

export function ReportBody({ onLocate }: { onLocate?: () => void }) {
  const ed = useEditor()
  const { variant, items } = useReport()
  const [scope, setScope] = useScope()
  const [loc] = useLocated()
  const [focus, setFocus] = useFocusItem()
  const list = useRef<HTMLDivElement>(null)

  // 从检查器「保真详情」、字体轻提示「详情」打开时滚到那一条（「定位到字体分组」，03-13）。只在打开时滚这一次、滚过即清掉：
  // 整栏面板随进出母版视图卸下又挂上时不再把内容区滚回这一条，宿主照原样写回进入前的滚动（rulings §4.25 DS-162）
  useEffect(() => {
    if (!focus) return
    scrollIntoPanel(list.current?.querySelector<HTMLElement>(`[data-fidelity-item="${focus}"]`))
    setFocus(null)
  }, [focus, setFocus])

  if (variant === "clean") return <Clean />

  const page = ed.slide
  const rows = items.map((it) => ({ it, occ: scope === "page" ? it.occ.filter((o) => o.page === page) : it.occ })).filter((r) => r.occ.length > 0)
  const located = loc ? items.find((it) => it.id === loc.id) : undefined
  const at = located?.occ[loc?.i ?? -1]

  return (
    <>
      <Summary items={items} variant={variant} page={page} scope={scope} onScope={setScope} />
      <div ref={list}>
        {GROUPS.map((g) => {
          const mine = rows.filter((r) => r.it.group === g.id)
          if (!mine.length) return null
          return (
            <Section key={g.id} title={g.title} anchor={`fidelity.group-${g.id}`}>
              {/*
                条目列表左右探出 8（条目自己内缩 8，当前项的淡底贴近节的左右边距），上下各探出 4：条目的上下内边距（6）与节的上下内边距部分重叠，
                节标题到第一条文字 10、最后一条文字到节的分隔线 14；条目之间不留间隔（文字间距 = 两条的内边距 12）——280 栏首屏能看全 8 条
              */}
              <ul className="-mx-2 -my-1 flex flex-col">
                {mine.map(({ it, occ }) => (
                  <ReportRow key={it.id} item={it} occ={occ} current={loc?.id === it.id ? loc : null} onLocate={onLocate} />
                ))}
              </ul>
            </Section>
          )
        })}
        {rows.length === 0 && <EmptyNote>第 {page} 页没有差异</EmptyNote>}
        {variant === "generating" && (
          <p className="px-4 pt-1 pb-4 text-[12px] leading-[18px] text-(--v3-text-2)">
            <Phrases parts={[`第 ${GENERATING.done + 1}–${GENERATING.total} 页`, "检查完成后补全"]} />
          </p>
        )}
      </div>
      {/* 定位结果播报给读屏（画布高亮只是视觉） */}
      <p className="sr-only" aria-live="polite">
        {located && at ? `已定位到第 ${at.page} 页：${at.what}` : ""}
      </p>
    </>
  )
}

/* ------------------------------------------------------------------ 概要与范围 */

function Summary({ items, variant, page, scope, onScope }: { items: ReportItem[]; variant: Variant; page: number; scope: Scope; onScope: (s: Scope) => void }) {
  const pages = pagesOf(items.flatMap((i) => i.occ)).length
  const danger = items.filter((i) => i.level === "danger")
  const warn = items.filter((i) => i.level === "warning").length
  const onPage = items.filter((i) => i.occ.some((o) => o.page === page)).length
  // 概要只有一行（标杆对照「报告概要的颜色」）：无法解析、以占位显示的计数并进这一行，不再单独成行、不带状态色图标——级别只由条目图标着色；
  // 每段末尾带「 · 」，放不下时在段与段之间换行（Phrases），新行不以「·」开头
  const heads = [
    `${items.length} 项差异`,
    `涉及 ${pages} 页`,
    danger.length > 0 ? `${pagesOf(danger.flatMap((d) => d.occ)).length} 页内容无法解析` : null,
    warn > 0 ? `${warn} 项以占位显示` : null,
  ].filter((x): x is string => !!x)
  const headline = heads.map((h, i) => (i < heads.length - 1 ? `${h} · ` : h))
  const options: SegOption<Scope>[] = [
    {
      value: "all",
      label: `全部 ${items.length} 项`,
      icon: (
        <span>
          全部 <span className="tabular-nums">{items.length}</span>
        </span>
      ),
    },
    {
      value: "page",
      label: `本页（第 ${page} 页）${onPage} 项`,
      icon: (
        <span>
          本页 <span className="tabular-nums">{onPage}</span>
        </span>
      ),
    },
  ]
  return (
    <Section bodyClassName="gap-3">
      {variant === "generating" ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-[12px] leading-[18px] font-semibold text-(--v3-text)">
            <LoaderCircle {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2) motion-safe:animate-spin" />
            正在检查其余页面…
          </p>
          <div className="flex items-center gap-2">
            <Progress value={Math.round((GENERATING.done / GENERATING.total) * 100)} label="保真检查进度" className="flex-1" />
            <span className="text-[11px] leading-none text-(--v3-text-2) tabular-nums">
              {GENERATING.done} / {GENERATING.total}
            </span>
          </div>
          <p className="text-[12px] leading-[18px] text-(--v3-text-2)">
            <Phrases parts={[`已发现 ${items.length} 项差异；`, "不必等待，", "可以照常编辑"]} />
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p data-fidelity-summary="" className="text-[12px] leading-[18px] font-semibold text-(--v3-text)">
            <Phrases parts={headline} />
          </p>
          <p className="text-[12px] leading-[18px] text-(--v3-text-2)">
            <Phrases parts={["内容都已原样保留，", "导出时一并写回"]} />
          </p>
        </div>
      )}
      <Segmented role="radiogroup" aria="显示范围" value={scope} onValueChange={onScope} options={options} />
    </Section>
  )
}

/* ------------------------------------------------------------------ 一行 */

const LEVEL_TONE = { danger: "text-(--v3-danger)", warning: "text-(--v3-warning)", info: "text-(--v3-text-2)" } as const
/** 不只靠颜色（WCAG 1.4.1）：级别也写进读屏名；可见文字里「暂不支持显示」「无法解析」本身就是说明 */
const LEVEL_SR = { danger: "无法解析", warning: "以占位显示", info: "已原样保留" } as const

/**
 * 点过「查看全部页码」的条目（id 列表，场景仓）：报告这次开着期间一直展开——整栏面板随进出母版视图卸下又挂上（宿主进入时不关面板，
 * rulings §4.25 DS-162：恢复到进入前的样子），退出后照原样展开着。报告收起（或对话框备选关闭）时清空，下次打开回到收起（useAllPagesEndWithReport）
 */
const useAllPagesOpen = () => useSceneState<string[]>("fidelity.all-pages", [])

/**
 * 报告从任何入口收起时清掉上面的记录（整栏面板的开关由开到关，或对话框备选由开到关；同 canvas.tsx useLocateEndsWithReport 的判法），
 * 下次打开时各条照旧收起。挂在报告关着时也在的画布列叠加层上（canvas.tsx FidelityCanvasLayer）；进出母版视图不算收起
 */
export function useAllPagesEndWithReport() {
  const [open] = useReportOpen()
  const [dialogOpen] = useReportDialogOpen()
  const [, setAll] = useAllPagesOpen()
  const was = useRef({ open, dialogOpen })
  useEffect(() => {
    const closed = (was.current.open && !open) || (was.current.dialogOpen && !dialogOpen)
    was.current = { open, dialogOpen }
    if (closed) setAll((ids) => (ids.length ? [] : ids))
  }, [open, dialogOpen, setAll])
}

function ReportRow({ item, occ, current, onLocate }: { item: ReportItem; occ: Occurrence[]; current: Located | null; onLocate?: () => void }) {
  const locate = useLocate()
  const [allOpen, setAllOpen] = useAllPagesOpen()
  const allPages = allOpen.includes(item.id)
  const rowRef = useRef<HTMLLIElement>(null)
  const pages = pagesOf(occ)
  const curOcc = current ? item.occ[current.i] : undefined
  // 当前项只在它那一处落在这次显示的范围里时才算（「本页」范围里，别的页上的那一处不显示为当前）
  const pos = curOcc ? occ.indexOf(curOcc) : -1
  const cur = pos >= 0 ? curOcc : undefined
  const go = (k: number) => {
    const o = occ[k]
    if (!o) return
    onLocate?.()
    locate(item, item.occ.indexOf(o))
  }
  const n = countOf(item, occ)
  // 措辞的最后一段带上「 · 」再接页码（或当前项的「第 n 页 · 是什么」）：放不下时页码整段换到下一行，「·」留在上一行末尾，新行不以「·」开头
  const note = item.note.map((t, i) => (i === item.note.length - 1 ? `${t} · ` : t))
  return (
    // 当前项：强调色淡底、圆角 6（与插件当前行、左栏当前页同一档），左右内缩 8；上下 6（原 8，标杆对照「报告条目的密度」）
    <li ref={rowRef} data-fidelity-item={item.id} className={cn("flex gap-2 rounded-[6px] px-2 py-1.5 transition-colors", cur && "bg-(--v3-accent-soft)")}>
      <item.Icon {...ICON} aria-hidden="true" className={cn("mt-px shrink-0", LEVEL_TONE[item.level])} />
      <div className="min-w-0 flex-1">
        {/*
          第一段：名称 · 计数，右端「定位」（已定位、多处时「‹ 1 / 4 ›」）。这一行按文字行高 18 排，右端的 24px 按钮上下各探出 3px 到行的内边距里
          （点按区仍是 24），条目不因按钮多占 6px
        */}
        <div className="flex items-start gap-2">
          <h4 className="min-w-0 flex-1 text-[12px] leading-[18px] font-medium text-(--v3-text)">
            {item.name}
            {item.level !== "danger" && (
              <span className="font-normal whitespace-nowrap text-(--v3-text-2)">
                {" · "}
                <span className="tabular-nums">{n}</span> {item.unit}
              </span>
            )}
            <span className="sr-only">（{LEVEL_SR[item.level]}）</span>
          </h4>
          {cur && occ.length > 1 ? <Stepper pos={pos} total={occ.length} onStep={go} /> : <LocateButton name={item.name} page={(cur ?? occ[0])?.page ?? 1} onClick={() => go(0)} />}
        </div>
        {item.detail?.map((l) => (
          <p key={l} className="text-[12px] leading-[18px] text-(--v3-text)">
            {l}
          </p>
        ))}
        {/* 第二段：支持级措辞，页码接在后面；已定位的当前项在同一位置写「第 n 页 · 是什么」（主文字色） */}
        <p className="text-[12px] leading-[18px] text-(--v3-text-2)">
          <Phrases parts={note} />
          <wbr />
          {cur ? (
            <span className="text-(--v3-text)">
              <span className="whitespace-nowrap">{`第 ${cur.page} 页 · `}</span>
              <wbr />
              <span className="whitespace-nowrap">{cur.what}</span>
            </span>
          ) : (
            <PagesTail
              pages={pages}
              all={allPages}
              onAll={() => {
                // 「查看全部页码」随之换成完整页码：同步提交（flushSync），在同一个任务里把焦点交给展开出来的页码文字（tabIndex −1，读屏念出全部页码），
                // 焦点不在 body 停留一帧（原来等下一帧再聚焦，中间停在 body）
                flushSync(() => setAllOpen((ids) => (ids.includes(item.id) ? ids : [...ids, item.id])))
                rowRef.current?.querySelector<HTMLElement>("[data-fidelity-pages]")?.focus({ preventScroll: true })
              }}
            />
          )}
        </p>
      </div>
    </li>
  )
}

/** 「定位」：24px 文字按钮，排在 18 高的第一行里（上下各探出 3px，见 ReportRow） */
function LocateButton({ name, page, onClick }: { name: string; page: number; onClick: () => void }) {
  return (
    <Button variant="ghost" aria-label={`定位：${name}（第 ${page} 页）`} className="-my-[3px] -mr-1 ml-auto h-6 shrink-0 px-2" onClick={onClick}>
      定位
    </Button>
  )
}

/**
 * 接在措辞后面的页码「第 1、3 页」（「 · 」在措辞末尾）；超过 5 页收成「共 6 页」+「查看全部页码」（03-10 边界）。
 * 「查看全部页码」是句中的文字按钮：与这一行同高（18），主文字色以便与 text-2 的措辞区分（同提示条里的「查看详情」）；行内目标不受 24px 下限约束（WCAG 2.5.8 行内例外）
 */
function PagesTail({ pages, all, onAll }: { pages: number[]; all: boolean; onAll: () => void }) {
  if (pages.length > 5 && !all)
    return (
      <>
        <span className="whitespace-nowrap">
          共 <span className="tabular-nums">{pages.length}</span> 页{" "}
        </span>
        <wbr />
        <Button variant="ghost" className="-mx-1 h-[18px] rounded-[4px] px-1 align-top text-(--v3-text)" onClick={onAll}>
          查看全部页码
        </Button>
      </>
    )
  return (
    <span data-fidelity-pages="" tabIndex={all ? -1 : undefined} className={cn("rounded-[4px]", !all && "whitespace-nowrap")}>
      第 <span className="tabular-nums">{pages.join("、")}</span> 页
    </span>
  )
}

/** 多处时逐处查看：‹ 2 / 4 › */
function Stepper({ pos, total, onStep }: { pos: number; total: number; onStep: (k: number) => void }) {
  return (
    <span role="group" aria-label="逐处查看" className="-my-[3px] -mr-1 flex shrink-0 items-center">
      <IconButton label="上一处" size={24} disabled={pos <= 0} reason="已是第一处" onClick={() => onStep(pos - 1)}>
        <ChevronLeft {...ICON} />
      </IconButton>
      <span className="min-w-9 text-center text-[11px] leading-none text-(--v3-text-2) tabular-nums">
        {pos + 1} / {total}
      </span>
      <IconButton label="下一处" size={24} disabled={pos >= total - 1} reason="已是最后一处" onClick={() => onStep(pos + 1)}>
        <ChevronRight {...ICON} />
      </IconButton>
    </span>
  )
}

/** 完全保真（03-10「完全高保真」）：仍保留入口，只说没有需要注意的差异；常态不用状态色（04 §2.5），对勾用 text-2 */
/** 完全保真（03-10）：kit PanelState 的中性形态（常态不用状态色：对勾 text-2），与面板出错态同一结构与间距 */
function Clean() {
  return (
    <PanelState tone="neutral" icon={<CircleCheck size={20} strokeWidth={1.5} aria-hidden="true" />} title="未发现需要注意的差异">
      <Phrases parts={["所有内容都已高保真还原，", "可以正常编辑"]} />
    </PanelState>
  )
}
