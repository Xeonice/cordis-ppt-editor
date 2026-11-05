import { useEffect, useLayoutEffect, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { LoaderCircle, Presentation, SearchX, Trash2, Users } from "lucide-react"
import {
  Button,
  CardList,
  cardAnchor,
  docCardMenu,
  DocumentCard,
  EmptyBlock,
  ListHead,
  LoadingRow,
  PanelState,
  Quoted,
  registerDocShareLayer,
  useLibraryOps,
  usePage,
  useSceneState,
  type DocShareLayerProps,
  type Layout,
  type LibrarySeed,
  type Person,
} from "../../kit"
import { searchDocs, TRASH_DAYS, trashLabel, trashLine, VIEW_DOCS, VIEW_TITLE, type LibDoc, type ViewId } from "../../library"
import { ShareDialog, type ShareSeed } from "../share/ShareDialog"
import { DIRECTORY, MEMBERS_DEFAULT, SELF, type Member } from "../share/people"

/**
 * 文档列表的主区（03-01，第 3 批 · 应用壳族；rulings §4.25 DS-79…DS-88 拍板后的画法）：
 * 列表头（左：回收站的说明 · 右：网格 / 列表）+ 卡片网格（四列，同开始页「最近」）；没有页内筛选条（DS-79：左栏就是筛选）、没有排序（DS-84）。
 * 列表头、搜索下拉与搜索结果一律不写数量（DS-80：60/15 游标分页没有总数，标杆也不写）。
 * 卡片、卡片菜单、列表操作（移到回收站 / 撤销、重命名、固定、恢复、永久删除、从卡片分享）、轻提示与浮层都是底座的件（kit DocumentCard / docCardMenu / useLibraryOps /
 * LibraryToasts / LibraryLayers，2026-10-22 第 3 批转正时由本目录并入底座，画法与行为逐字相同）；这里只按场景状态的 page.data（LibData）取视图与初值，之后的操作可以点着走。
 * 从卡片「分享…」打开的分享对话框是第 2 批分享场景的件，由本模块登记给底座（registerDocShareLayer，见文件末尾）。
 */

export interface LibData extends LibrarySeed {
  view: ViewId | "search"
  layout?: Layout
  /** 搜索结果页（DS-80「查看全部结果」进入）：检索词取地址里的 q；q 是截图用的缺省关键词 */
  searchPage?: boolean
  q?: string
  /** 内容阶段：ready（缺省）· loading（DS-86：超过 300 ms 才出现的加载行）· error · empty（当前视图没有文档） */
  phase?: "ready" | "loading" | "error" | "empty"
  /** 这张卡片的「⋯」一出现就打开 */
  menuOn?: string
  /** 离线（DS-92 横幅由状态的 shell.banner 给；这里管卡片与菜单） */
  offline?: boolean
  /** 样张定格：悬停 / 键盘焦点在这张卡片上 */
  demo?: { hover?: string; focus?: string }
  /**
   * 里程碑（文档列表是 M2 的页面，03-01 §3）：M2（缺省）卡片菜单「分享…」留在原位、不可用，标 M3、右侧「后续版本提供」（rulings §4.25 DS-137）；
   * M3 起「分享…」照常打开分享对话框（TB-109，share-from-card）。回收站的 M2 / M3 形态另由 trashM2 管
   */
  milestone?: "M2" | "M3"
  /** 回收站的 M2 形态：没有到期清理与永久删除（SV-11 是 M3） */
  trashM2?: boolean
  /** 滚动翻页：列表末尾的加载行（DS-86） */
  loadMore?: boolean
  /** 网格列数（缺省四列；紧凑窗口三列，DS-87） */
  cols?: string
}

const OFFLINE_OPEN = "离线时只能打开本次打开过的文档"

const ICON20 = { size: 20, strokeWidth: 1.5, "aria-hidden": true } as const

/** 搜索结果页的顶栏标题：「搜索「预算」」随地址里的 q 更新（标题即结果页的 h1；不写结果数，DS-80） */
export function SearchTitle({ fallback = "预算" }: { fallback?: string }) {
  const [sp] = useSearchParams()
  const q = sp.get("q") ?? fallback
  return (
    <>
      搜索<Quoted>{q}</Quoted>
    </>
  )
}

export function Library() {
  const { data } = usePage()
  const d = data as unknown as LibData
  const [sp] = useSearchParams()
  const [layout, setLayout] = useSceneState<Layout>("docs.layout", () => d.layout ?? "grid")
  const ops = useLibraryOps(d)
  const view = d.view
  const q = d.searchPage ? (sp.get("q") ?? d.q ?? "") : ""

  if (d.phase === "loading")
    return (
      <LoadingRow center className="pt-20">
        正在加载文档…
      </LoadingRow>
    )
  if (d.phase === "error")
    return (
      // 画布底上的次按钮一律 outline（TB-128，kit 约定：亮色画布上才看得出按钮形状）
      <PanelState title="文档列表加载失败" action={<Button variant="outline">重试</Button>} className="pt-20">
        请检查网络连接后重试
      </PanelState>
    )

  const all = view === "search" ? searchDocs(q) : VIEW_DOCS[view]
  const list = d.phase === "empty" ? [] : all.filter((x) => !ops.hidden.includes(x.id)).map(ops.live)
  // 「最近」：固定的排在最前（DS-84；开始页「最近」同一口径）
  const docs = view === "recent" ? [...list.filter((x) => x.pinned), ...list.filter((x) => !x.pinned)] : list

  if (!docs.length) {
    if (view === "search")
      return (
        // 同已拍板的「没有匹配「…」的人 / 图标」（第 2 批分享、图标库）：检索词用「」、不断行
        <EmptyBlock
          icon={<SearchX {...ICON20} />}
          title={
            <>
              没有匹配<Quoted>{q}</Quoted>的文档
            </>
          }
        >
          检查拼写，或尝试其他关键词
        </EmptyBlock>
      )
    if (view === "shared")
      return (
        <EmptyBlock icon={<Users {...ICON20} />} title="还没有人与你共享文档">
          别人与你共享的演示文稿会显示在这里
        </EmptyBlock>
      )
    if (view === "trash")
      return (
        <EmptyBlock icon={<Trash2 {...ICON20} />} title="回收站是空的">
          {d.trashM2 ? "移到回收站的文档可以在这里恢复" : `移到回收站的文档会保留 ${TRASH_DAYS} 天，期间可以恢复`}
        </EmptyBlock>
      )
    // 空态不放按钮、只留引导句（DS-88：顶栏已有「导入 .pptx」「新建演示文稿」，入口不重复；放次按钮的未采纳备选见 home.alt-empty-create）
    return (
      <EmptyBlock icon={<Presentation {...ICON20} />} title="这里还没有任何文档">
        新建一份演示文稿，或导入已有的 .pptx 文件
      </EmptyBlock>
    )
  }

  const trash = view === "trash"
  // 列表头左侧：只有回收站写一句说明（保留天数）；数量一律不写（DS-80）
  const head = trash ? (d.trashM2 ? "移到回收站的文档可以在这里恢复" : `回收站里的文档 ${TRASH_DAYS} 天后永久删除`) : null

  return (
    <section aria-label={view === "search" ? `搜索「${q}」的结果` : VIEW_TITLE[view]}>
      <ListHead view={layout} onView={setLayout}>
        {head}
      </ListHead>
      <CardList view={layout} label={view === "search" ? "搜索结果" : VIEW_TITLE[view]} cols={d.cols}>
        {docs.map((doc) => (
          <LibraryCard key={doc.id} doc={doc} view={view} layout={layout} d={d} ops={ops} />
        ))}
      </CardList>
      {d.loadMore && (
        <LoadingRow center className="py-6">
          正在加载更多文档…
        </LoadingRow>
      )}
      <LoadMoreScroll on={!!d.loadMore} />
    </section>
  )
}

/** 滚动翻页的状态：一出现就滚到底，末尾的加载行在视口里（截图用；产品滚到底前 1 屏预取下一页） */
function LoadMoreScroll({ on }: { on: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!on) return
    const scroller = ref.current?.closest(".overflow-y-auto")
    if (scroller) scroller.scrollTop = scroller.scrollHeight
  }, [on])
  return <span ref={ref} aria-hidden="true" />
}

type Ops = ReturnType<typeof useLibraryOps>

function LibraryCard({ doc, view, layout, d, ops }: { doc: LibDoc; view: ViewId | "search"; layout: Layout; d: LibData; ops: Ops }) {
  const trash = view === "trash"
  const purging = ops.purging === doc.id
  const offline = !!d.offline
  const editing = ops.editing?.id === doc.id
  const menu = purging ? undefined : docCardMenu(doc, view, ops.handlers, { offline, trashM2: d.trashM2, shareLater: d.milestone !== "M3" })
  const menuAnchor = `documents.more-${doc.id}`
  const demo = d.demo?.hover === doc.id ? "hover" : d.demo?.focus === doc.id ? "focus" : undefined

  if (trash) {
    const left = trashLine(doc, d.trashM2)
    // 「恢复」常驻（指针一下就能点）；键盘用户在卡片上按 ⇧F10，菜单首项就是「恢复」，所以它不进 Tab 顺序（TB-107：整个网格一个停靠点）
    const restore = (
      <Button variant="outline" tabIndex={-1} onClick={() => ops.handlers.restore(doc)} aria-label={`恢复「${doc.title}」`}>
        恢复
      </Button>
    )
    return (
      <DocumentCard
        doc={doc}
        view={layout}
        anchor={cardAnchor(doc.id)}
        label={trashLabel(doc, { m2: d.trashM2, purging })}
        inert
        dim
        hidePin
        menu={menu}
        menuOpen={d.menuOn === doc.id}
        menuAnchor={menuAnchor}
        demo={demo}
        meta={purging ? <PurgingLine /> : left}
        metaCols={purging ? [<PurgingLine key="p" />, <span key="e" />] : [<span key="a" className="truncate text-[12px] leading-4 text-(--v3-text-2)">{`${doc.trashed?.ago}移入`}</span>, <span key="b" className="truncate text-[12px] leading-4 text-(--v3-text-2)">{d.trashM2 ? "—" : left}</span>]}
        trailing={purging ? null : restore}
      />
    )
  }

  return (
    <DocumentCard
      doc={doc}
      view={layout}
      anchor={cardAnchor(doc.id)}
      menu={menu}
      menuOpen={d.menuOn === doc.id}
      menuAnchor={menuAnchor}
      disabled={offline && !doc.alive ? OFFLINE_OPEN : undefined}
      demo={demo}
      editing={
        editing
          ? {
              value: ops.editing!.value,
              onChange: (v) => ops.setEditing({ id: doc.id, value: v }),
              onCommit: ops.commitRename,
              onCancel: ops.cancelRename,
            }
          : undefined
      }
    />
  )
}

function PurgingLine() {
  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-[12px] leading-4 text-(--v3-text-2)">
      <LoaderCircle size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 motion-safe:animate-spin" />
      正在永久删除…
    </span>
  )
}

/* ------------------------------------------------------------------ 从卡片打开的分享对话框（登记给底座） */

/** 分享对话框的初值（TB-109）：我拥有的——所有者视角，成员是我 + 卡片上的协作者；别人共享给我的——只读「谁能访问…」，成员是我（我的角色）+ 所有者（DS-48） */
const sharePerson = (p: Person) => DIRECTORY.find((x) => x.name === p.name)
function shareSeedFor(d: LibDoc): ShareSeed {
  if (d.role === "owner") {
    const others = (d.collaborators ?? []).flatMap((p, i) => {
      const s = sharePerson(p)
      return s ? [{ ...s, role: i === 0 ? ("editor" as const) : ("commenter" as const) }] : []
    })
    return { members: [{ ...SELF, role: "owner" }, ...others] }
  }
  const owner = sharePerson(d.owner)
  return { view: "readonly", members: [{ ...SELF, role: d.role }, ...(owner ? [{ ...owner, role: "owner" as const }] : [])] }
}

/**
 * 从卡片「分享…」打开的分享对话框（第 2 批 share 场景同一个件，叠在当前列表路由上，TB-109），登记给底座（kit/library.tsx registerDocShareLayer）：
 * 开始页「最近」与文档列表都用底座的列表操作，它们的「分享…」都打开这一份。打开另一份文档时先把那一份的成员写进分享对话框的成员表（场景仓 share.members）
 */
function DocShareLayer({ doc, title, open, onOpenChange, returnFocus }: DocShareLayerProps) {
  const [, setShareMembers] = useSceneState<Member[]>("share.members", () => MEMBERS_DEFAULT)
  const seed = shareSeedFor(doc)
  const last = useRef<string | null>(null)
  useLayoutEffect(() => {
    if (!open || last.current === doc.id) return
    last.current = doc.id
    if (seed.view !== "readonly" && seed.members) setShareMembers(seed.members)
    // 只在打开、换文档时
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doc.id])
  return <ShareDialog seed={seed} docTitle={title} open={open} onOpenChange={onOpenChange} returnFocus={returnFocus} />
}
registerDocShareLayer(DocShareLayer)
