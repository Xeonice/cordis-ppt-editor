import { ArrowRight, ChevronDown, LoaderCircle, Monitor, Plus, Presentation } from "lucide-react"
import { cn } from "@/lib/utils"
import { CoverArt } from "./CoverArt"
import { TEMPLATES } from "./data"
import { DocumentCard } from "./kit/DocumentCard"
import { PanelState, LoadingRow } from "./kit/controls"
import { cardAnchor, CardList, docCardMenu, EmptyBlock, useLibraryOps, ViewSwitch, type Layout, type ToastSeed } from "./kit/library"
import { goToState } from "./kit/nav"
import { useSceneState } from "./kit/scene"
import { ShellSearch } from "./kit/ShellLayout"
import { HOME_RECENT, type LibDoc } from "./library"
import { usePageMaybe } from "./page/context"
import { Button, ICON, Tip, V3Menu } from "./ui"

/**
 * 已拍板首页的主区（开始页，#/v3/home 不带 state 时的内容）：2026-10-22 第 3 批转正时由 scenarios/home/HomeMain.tsx 的画法并入（g1 K7），
 * 首页宿主的缺省 body（PageHost.tsx）；第 3 批开始页补态（home 场景）的各态也可以直接用它（page.data 给 HomeData）。
 * 单独成一个模块（不经 Home.tsx / PageHost.tsx），场景引用它时不绕回场景注册表。
 */

/**
 * 开始页主区的状态数据（PageConfig.data；已拍板首页不带 state 时全部取缺省 = M2、内容就绪、桌面形态）。
 * 第 3 批开始页补态（home 场景）的各态也按这一份写：加载 / 出错 / 首次使用（DS-86、DS-88）、离线与正在创建、紧凑与手机形态（DS-87）
 */
export interface HomeData {
  /** 里程碑：M2（缺省：不显示「更多模板 →」，新建的文档是占位封面，卡片菜单「分享…」留在原位、不可用 DS-137）· M3 */
  milestone?: "M2" | "M3"
  /** 「最近」区：ready · loading（DS-86 加载行）· skeleton（DS-86 未采纳的骨架）· error · empty（首次使用） */
  recent?: "ready" | "loading" | "skeleton" | "error" | "empty"
  /** 首次使用的备选：空态里照 PRD AS-02 原文放次按钮「新建演示文稿」（DS-88 未采纳；推荐只留引导句） */
  emptyCreate?: boolean
  offline?: boolean
  /** 正在创建：被点的模板 id（或 "new" = 顶栏「新建演示文稿」） */
  creating?: string
  menuOn?: string
  hidden?: string[]
  toast?: ToastSeed
  /**
   * 形态（DS-87，由状态数据显式给）：desktop · compact（640–1024：左栏收成左侧抽屉）· phone（手机 < 640：单列、抽屉、不放网格 / 列表与排序）。
   * 平板（触控、≥ 640）不另设形态：左栏与列数按窗口宽度取 desktop / compact，网格 / 列表与排序照常，其余照触控形态——不提供新建与导入、
   * 顶部提示行「在电脑上新建或导入演示文稿」、命中区 44、「⋯」常显（rulings §4.25 TB-165、TB-170、TB-153；样张没有单画平板）
   */
  form?: "desktop" | "compact" | "phone"
  /** DS-87 未采纳的备选：手机上照常显示新建与导入 */
  phoneCreate?: boolean
}

const SORTS = ["最近打开", "最近编辑", "名称", "创建时间"].map((x) => ({ value: x, label: x }))
const OFFLINE = "离线时不可用"
const CREATING = "正在创建演示文稿"
const OFFLINE_OPEN = "离线时只能打开本次打开过的文档"

/* ------------------------------------------------------------------ 从模板开始 */

/**
 * 「从模板开始」一行（已拍板首页同一画法：等宽六列，卡内边距 8；封面圆角 6 + 1px 边，悬停描边变强调色、名称转 text）。
 * - M2 不显示「更多模板 →」（PRD AS-03）；M3 显示，命中区补足 24 高（外观不变，WCAG 2.5.8），点了进模板库；
 * - 不可用（离线、正在创建别的）：封面与名称变淡、不响应悬停，工具提示与读屏名写原因（FE-06）；
 * - 正在创建：被点的那张名称换成转圈 +「正在创建…」（aria-busy），其余新建入口暂不能点；作业成功后进编辑器（50/02 §8、UX-14）；
 * - 读屏名：「新建空白演示文稿」/「从模板「商务」新建」。
 * scroll：紧凑形态（与 DS-87 未采纳的手机形态）——六张等宽、最小 156：放得下时铺满一行，放不下才一行横向滚动，不换行、不缩小封面。
 * 这一行 6 张照常逐个 Tab（TB-107 的漫游只管首页「最近」、文档列表、模板库三处卡片网格）。
 */
export function TemplateRow({ m3, reason, creating, scroll }: { m3?: boolean; reason?: string; creating?: string; scroll?: boolean }) {
  return (
    <section aria-labelledby="home-templates">
      <div className="flex h-7 items-center justify-between">
        <h2 id="home-templates" className="text-[13px] leading-5 font-semibold">
          从模板开始
        </h2>
        {m3 && (
          <button
            type="button"
            onClick={() => goToState("templates", "templates.default")}
            className="-mr-1 flex h-6 items-center gap-1 rounded-[4px] px-1 text-[12px] leading-none text-(--v3-text-2) transition-colors hover:text-(--v3-text)"
          >
            更多模板
            <ArrowRight {...ICON} aria-hidden="true" />
          </button>
        )}
      </div>
      <ul className={cn("mt-2 -mx-2 grid", scroll ? "auto-cols-[minmax(156px,1fr)] grid-flow-col overflow-x-auto pb-1" : "grid-cols-6")}>
        {TEMPLATES.map((t) => {
          const busy = creating === t.id
          const off = !busy && !!reason
          const label = t.id === "blank" ? "新建空白演示文稿" : `从模板「${t.name}」新建`
          const btn = (
            <button
              type="button"
              aria-label={off ? `${label}（${reason}）` : label}
              aria-disabled={off || busy || undefined}
              aria-busy={busy || undefined}
              onClick={() => {
                if (!off && !busy) goToState("editor", "empty")
              }}
              className={cn("group block w-full p-2 text-left", off && "cursor-default")}
            >
              <span className={cn("relative block overflow-hidden rounded-[6px] border border-(--v3-border) transition-colors", !off && !busy && "group-hover:border-(--v3-accent)", off && "opacity-50")}>
                <CoverArt id={t.id} />
                {t.id === "blank" && (
                  <span className="v3-paper pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-(--v3-text-2)">
                    <Plus size={24} strokeWidth={1.5} aria-hidden="true" />
                    <span className="text-[12px] leading-4">空白演示文稿</span>
                  </span>
                )}
              </span>
              {busy ? (
                <span role="status" className="mt-2 flex items-center gap-1.5 text-[12px] leading-4 text-(--v3-text)">
                  <LoaderCircle size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 motion-safe:animate-spin" />
                  正在创建…
                </span>
              ) : (
                <span className={cn("mt-2 block text-[12px] leading-4 transition-colors", off ? "text-(--v3-text-3)" : "text-(--v3-text-2) group-hover:text-(--v3-text)")}>{t.name}</span>
              )}
            </button>
          )
          return <li key={t.id}>{off ? <Tip label={reason!}>{btn}</Tip> : btn}</li>
        })}
      </ul>
    </section>
  )
}

/* ------------------------------------------------------------------ 最近 */

function SkeletonCard() {
  return (
    <li aria-hidden="true" className="p-2">
      <span className="block aspect-video rounded-[6px] border border-(--v3-border) bg-(--v3-panel-2)" />
      <span className="mt-3 block h-3 w-3/5 rounded-[4px] bg-(--v3-border)" />
      <span className="mt-2 block h-3 w-2/5 rounded-[4px] bg-(--v3-border)" />
    </li>
  )
}

/**
 * 「最近」（AS-02 最多 8 条；同一份数据是文档列表「最近」的前 8 条，固定的在前）：标题行「最近」· 网格 / 列表 · 排序（已拍板首页的排序菜单原样保留，
 * 是首页这一段的本机视图偏好、不带到文档列表——rulings §4.25 TB-127、DS-84）；网格 / 列表与排序只在有内容时出现（加载中、出错、空态都不放）。
 * 卡片菜单按 DS-81 是「最近」那一份（多「从最近移除」）；M2 的「分享…」留在原位、不可用，标 M3、右侧「后续版本提供」（rulings §4.25 DS-137，M3 起打开分享对话框，TB-109）；
 * 卡片网格的键盘按 TB-107（一个 Tab 停靠点，方向键漫游）。M3 时「未命名演示文稿」有服务端渲染的封面（空白标题页）。
 * 加载中（DS-86）：「最近」区居中一行加载行「正在加载最近的文档…」，不画骨架；首次使用（DS-88）：空态只留引导句、不放按钮。
 * touch：手机形态（< 640）的「最近」——单列、卡片「⋯」常显，不放网格 / 列表与排序；平板（触控、≥ 640）照常放这两样（rulings §4.25 TB-170），只是卡片按触控画（「⋯」常显、44 命中区，TB-165）。
 */
export function RecentSection({ d, cols = "grid-cols-4", touch }: { d: HomeData; cols?: string; touch?: boolean }) {
  const [layout, setLayout] = useSceneState<Layout>("docs.layout", "grid")
  const [sort, setSort] = useSceneState("home.sort", "最近打开")
  const ops = useLibraryOps(d)
  const phase = d.recent ?? "ready"
  const docs: LibDoc[] = HOME_RECENT.filter((x) => !ops.hidden.includes(x.id))
    .map(ops.live)
    .map((x) => (d.milestone === "M3" && x.cover === null ? { ...x, cover: "blank" as const } : x))
  const view = touch ? "grid" : layout
  const controls = !touch && (phase === "ready" || phase === "skeleton")
  return (
    <section aria-labelledby="home-recent" className="mt-8">
      <div className="flex h-7 items-center justify-between">
        <h2 id="home-recent" className="text-[13px] leading-5 font-semibold">
          最近
        </h2>
        {controls && (
          <div className="flex items-center gap-2">
            <ViewSwitch view={layout} onView={setLayout} />
            <V3Menu
              value={sort}
              onValueChange={setSort}
              align="end"
              entries={SORTS}
              trigger={
                <button
                  type="button"
                  className="-mr-2 flex h-7 items-center gap-1 rounded-[6px] px-2 text-[12px] leading-none text-(--v3-text-2) transition-colors hover:bg-(--v3-panel-2) hover:text-(--v3-text) data-[state=open]:bg-(--v3-panel-2)"
                >
                  {sort}
                  <ChevronDown {...ICON} />
                </button>
              }
            />
          </div>
        )}
      </div>
      {phase === "loading" ? (
        <LoadingRow center>正在加载最近的文档…</LoadingRow>
      ) : phase === "skeleton" ? (
        <ul aria-hidden="true" className={cn("mt-2 -mx-2 grid", cols)}>
          {Array.from({ length: 8 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </ul>
      ) : phase === "error" ? (
        // 画布底上的次按钮一律 outline（rulings §4.25 TB-128）
        <PanelState title="最近的文档加载失败" action={<Button variant="outline">重试</Button>}>
          请检查网络连接后重试
        </PanelState>
      ) : phase === "empty" ? (
        <EmptyBlock
          icon={<Presentation size={20} strokeWidth={1.5} aria-hidden="true" />}
          title="还没有最近打开的文档"
          action={
            // DS-88：不放按钮（顶栏已有「新建演示文稿」、模板行第一张是「空白」）；未采纳的备选照 AS-02 原文放次按钮（画布底上的次按钮 outline，TB-128）
            d.emptyCreate ? (
              <Button variant="outline" onClick={() => goToState("editor", "empty")}>
                新建演示文稿
              </Button>
            ) : undefined
          }
          className="py-12"
        >
          从上方的模板开始，或新建一份空白演示文稿
        </EmptyBlock>
      ) : (
        <CardList view={view} label="最近" cols={cols}>
          {docs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              view={view}
              touch={touch}
              anchor={cardAnchor(doc.id)}
              menu={docCardMenu(doc, "home", ops.handlers, { offline: d.offline, shareLater: d.milestone !== "M3" })}
              menuOpen={d.menuOn === doc.id}
              menuAnchor={`home.more-${doc.id}`}
              disabled={d.offline && !doc.alive ? OFFLINE_OPEN : undefined}
              editing={
                ops.editing?.id === doc.id
                  ? { value: ops.editing.value, onChange: (v) => ops.setEditing({ id: doc.id, value: v }), onCommit: ops.commitRename, onCancel: ops.cancelRename }
                  : undefined
              }
            />
          ))}
        </CardList>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ 主区（三种形态） */

/**
 * 首页主区的内容（已拍板）：「从模板开始」一行（空白 + 5 套内置主题）与「最近」（网格 / 列表切换、排序）。
 * 首页宿主的缺省 body（PageHost.tsx；不带 state 时就是它）；状态数据取页面宿主的 page.data（HomeData），没有时全部缺省。
 * 形态（DS-87）：compact 模板行一行等宽（放不下才横向滚动）、「最近」三列；phone 不渲染模板行，顶部一行「在更大窗口中新建或导入演示文稿」+ 主区搜索框（触控 44）、「最近」单列、「⋯」常显
 */
export function HomeBody() {
  const page = usePageMaybe()
  const d = (page?.data ?? {}) as HomeData
  const m3 = d.milestone === "M3"
  const reason = d.offline ? OFFLINE : d.creating ? CREATING : undefined
  const form = d.form ?? "desktop"
  if (form === "phone") {
    return (
      <>
        {d.phoneCreate ? (
          <TemplateRow m3={m3} reason={reason} creating={d.creating} scroll />
        ) : (
          <p className="flex items-center gap-2 text-[12px] leading-4 text-(--v3-text-2)">
            <Monitor {...ICON} aria-hidden="true" className="shrink-0" />
            在更大窗口中新建或导入演示文稿
          </p>
        )}
        <ShellSearch touch className="mt-4" />
        <RecentSection d={d} cols="grid-cols-1" touch />
      </>
    )
  }
  return (
    <>
      <TemplateRow m3={m3} reason={reason} creating={d.creating} scroll={form === "compact"} />
      <RecentSection d={d} cols={form === "compact" ? "grid-cols-3" : "grid-cols-4"} />
    </>
  )
}
