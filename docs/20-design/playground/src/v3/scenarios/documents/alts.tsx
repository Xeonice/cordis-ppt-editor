import { useState } from "react"
import { ChevronDown, Trash2 } from "lucide-react"
import { BlockingPage, Button, CardList, cardAnchor, docCardMenu, DocumentCard, goToState, ICON, ListHead, Menu, Segmented, useLibraryOps, useSceneState, type Layout, type MenuSpec } from "../../kit"
import { ALL, MINE, RECENT, SHARED, TRASH, trashLabel, trashLine, type LibDoc } from "../../library"

/* ------------------------------------------------------------------ DS-79 未采纳：页内分段筛选 */

type Filter = "all" | "owned" | "shared" | "recent" | "trashed"
const FILTERS: { value: Filter; label: string; text: string }[] = [
  { value: "all", label: "全部", text: "全部" },
  { value: "owned", label: "我拥有", text: "我拥有" },
  { value: "shared", label: "共享给我", text: "共享给我" },
  { value: "recent", label: "最近", text: "最近" },
  { value: "trashed", label: "回收站", text: "回收站" },
]
const FILTER_DOCS: Record<Filter, LibDoc[]> = { all: ALL, owned: MINE, shared: SHARED, recent: RECENT, trashed: TRASH }

/**
 * rulings §4.25 DS-79 未采纳的备选：保留页内分段筛选「全部 / 我拥有 / 共享给我 / 最近 / 回收站」（50/02 的 filter 原样），左栏「最近 / 我的文档 / 与我共享」只是预置筛选，
 * 页面标题统一为「文档」。与左栏重复（同一筛选两个常驻入口，Q2），回收站只在页内。DS-79 定为左栏即筛选（documents.recent）。
 */
export function FilterTabsBody({ initial = "owned" }: { initial?: Filter }) {
  const [filter, setFilter] = useState<Filter>(initial)
  const [layout, setLayout] = useState<Layout>("grid")
  const ops = useLibraryOps({})
  const docs = FILTER_DOCS[filter].map(ops.live)
  const trash = filter === "trashed"
  return (
    <section aria-label="文档">
      <div className="flex h-7 items-center justify-between gap-4">
        <Segmented<Filter> options={FILTERS} value={filter} onValueChange={setFilter} aria="筛选" role="radiogroup" className="w-[360px]" />
        <ListHead view={layout} onView={setLayout} />
      </div>
      {/* 列表头不写数量（DS-80）；回收站只写保留天数 */}
      {trash && <p className="mt-4 text-[12px] leading-4 text-(--v3-text-2)">回收站里的文档 30 天后永久删除</p>}
      <CardList view={layout} label="文档" className={trash ? undefined : "mt-4"}>
        {docs.map((d) =>
          trash ? (
            <DocumentCard
              key={d.id}
              doc={d}
              view={layout}
              anchor={cardAnchor(d.id)}
              label={trashLabel(d)}
              inert
              dim
              hidePin
              menu={docCardMenu(d, "trash", ops.handlers)}
              meta={trashLine(d)}
              trailing={
                <Button variant="outline" tabIndex={-1} aria-label={`恢复「${d.title}」`}>
                  恢复
                </Button>
              }
            />
          ) : (
            <DocumentCard key={d.id} doc={d} view={layout} anchor={cardAnchor(d.id)} menu={docCardMenu(d, filter === "recent" ? "recent" : "mine", ops.handlers)} />
          ),
        )}
      </CardList>
    </section>
  )
}

/* ------------------------------------------------------------------ DS-84 未采纳：列表头排序菜单 */

/** 与已拍板首页「最近」的排序菜单同一份、同一次序（HomeBody.tsx SORTS） */
const SORTS = ["最近打开", "最近编辑", "名称", "创建时间"]

/**
 * rulings §4.25 DS-84 未采纳的备选：列表头在网格 / 列表切换右侧加排序菜单（与已拍板首页「最近」同一份、同一位置、同一次序：最近打开 / 最近编辑 / 名称 / 创建时间），
 * 只有缺省项不同——「我的文档」缺省「最近编辑」；REST 要补 sort 参数与索引（GET /documents 没有 sort）。DS-84 定为不排序（documents.mine）。
 */
export function SortMenuBody() {
  const [layout, setLayout] = useSceneState<Layout>("docs.layout", "grid")
  const [sort, setSort] = useState("最近编辑")
  const ops = useLibraryOps({})
  const docs = sort === "名称" ? [...MINE].sort((a, b) => a.title.localeCompare(b.title, "zh-CN")) : MINE
  const items: MenuSpec[] = [{ type: "radio", id: "sort", label: "排序", value: sort, closeOnSelect: true, onValueChange: setSort, options: SORTS.map((s) => ({ value: s, label: s })) }]
  return (
    <section aria-label="我的文档">
      <ListHead
        view={layout}
        onView={setLayout}
        trailing={
          <Menu
            items={items}
            defaultOpen
            align="end"
            label="排序"
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
        }
      />
      <CardList view={layout} label="我的文档">
        {docs.map((d) => (
          <DocumentCard key={d.id} doc={ops.live(d)} view={layout} anchor={cardAnchor(d.id)} menu={docCardMenu(d, "mine", ops.handlers)} />
        ))}
      </CardList>
    </section>
  )
}

/* ------------------------------------------------------------------ DS-85：编辑器里回收站的文档 */

/**
 * rulings §4.25 DS-85：所有者从旧链接或书签打开回收站里的文档，不进编辑器、换成阻断页（同第 1 批「打开失败」的画法，kit BlockingPage）：
 * 文档名「旧版产品介绍」（回收站里的那一份，21 天后到期）·「此文档在回收站中」· 说明（阻断页一律不加句号）· 主按钮「恢复」（恢复后照常打开）·「返回文档列表」（落「最近」，DS-79）。
 * 其他人按角色分两种（60/02 §6 守卫顺序：DocumentRoleGuard 在前、DocumentStateGuard 在后）：有角色的非所有者得 404，看到 shell-pages.not-found-doc「找不到该文档」（DS-122）；
 * 从未获授权的人得 403「没有访问权限」+「申请访问」（TB-73：照常记下申请、不透露在回收站）。
 */
export function TrashBlockedPage() {
  return (
    <BlockingPage
      icon={<Trash2 size={32} strokeWidth={1.5} aria-hidden="true" />}
      context="旧版产品介绍"
      title="此文档在回收站中"
      headingId="documents-trash-blocked"
      actions={
        <>
          <Button variant="primary" onClick={() => goToState("editor", "empty")}>
            恢复
          </Button>
          <Button variant="outline" onClick={() => goToState("documents", "documents.recent")}>
            返回文档列表
          </Button>
        </>
      }
    >
      恢复后即可打开和编辑；21 天后将永久删除
    </BlockingPage>
  )
}
