import { createContext, useContext, useMemo } from "react"
import { useEditor, useInspectorTab, useSceneState, type Box, type SetSceneState } from "../../kit"
import { mentionsMe, permsFor, threadsFor, type AnchorKind, type Dataset, type Filter, type Perms, type Role, type Sort, type Thread } from "./model"

/**
 * 评论场景的运行时状态（kit useSceneState：画布评论钉、检查器「评论」页签、左栏角标、评审条与浏览条读写同一份；换状态即复位）。
 * 每个场景状态用 EditorConfig.data 给初值（见 CommentsData）。
 */

/** 画布上正在撰写的新评论（评论工具点选后、或右键「添加评论」）：临时钉 + 浮动撰写框 */
export interface Draft {
  page: number
  x: number
  y: number
  anchor: { kind: AnchorKind; label: string; box?: Box }
  text?: string
  /** 一出现就弹出 @ 候选（场景状态演示） */
  mention?: boolean
  /** 离线：@ 候选只来自在场缓存 */
  offline?: boolean
  /**
   * 撰写框在钉的哪一侧、哪端对齐（缺省：落点靠右时在左侧，否则在右侧，上沿对齐）：键盘新建页级评论的默认落点按页面内容挑出（canvas.tsx defaultPagePin），
   * 放不下时换到钉的上方或另一侧，不压幻灯片文字行
   */
  side?: "right" | "left" | "top"
  align?: "start" | "end"
  /**
   * 打开撰写框的来源（锚点名：工具条「评论」tool-comment、画布 stage、被右键的对象）：键盘与右键菜单打开的撰写框因 Esc /「取消」关闭时焦点交回这里；
   * 指针在画布上点出来的不记（交给画布）；发送后照旧交给画布
   */
  from?: string
  /**
   * 换页（或进网格视图）时写了内容、随旧页收起后又恢复的草稿（rulings §4.25 DS-65、TB-84，canvas.tsx DraftKeeper）：撰写框原样出现、内容与 @ 提及都在，
   * 但不是用户此刻打开的，所以不抢焦点（TB-79）——焦点留在用户换页时所在处，点临时钉或在钉上按 Tab 才进撰写框
   */
  restored?: boolean
}

export interface ToastSpec {
  text: string
  action?: string
  /** 「撤销」时恢复的线程集（删除自己的评论） */
  undo?: Thread[]
  /** 「重新打开」的线程（刚解决的） */
  reopen?: string
}

export interface ConfirmSpec {
  kind: "thread" | "reply"
  threadId: string
  replyId?: string
  /** 确认框关闭（取消 / Esc）后焦点交回的锚点：打开它的「⋯」或评论钉（缺省：这条线程的「⋯」） */
  returnTo?: string
}

/** 状态初值（EditorConfig.data）：都可省 */
export interface CommentsData {
  dataset?: Dataset
  role?: Role
  filter?: Filter
  sort?: Sort
  selected?: string | null
  hoverPin?: string | null
  draft?: Draft | null
  /** 正在内联编辑的回复 id */
  editing?: string | null
  /** 面板底部撰写框（只在备选 alt-panel-composer 里有）：文字与是否处于聚焦（展开）的样子；mention 演示 @ 候选 */
  composer?: { text?: string; focused?: boolean; mention?: boolean; offline?: boolean }
  /** 备选 alt-panel-composer：面板底部常驻撰写框发起页级评论，评论工具只认对象（点空白处不落钉） */
  panelComposer?: boolean
  /** 已解决的线程一出现就展开（缺省收在「已解决 N」一行里） */
  resolvedOpen?: boolean
  /** 备选 alt-load-failed：评论页签整块加载失败（PanelState） */
  loadFailed?: boolean
  toast?: ToastSpec | null
  confirm?: ConfirmSpec | null
  /** 排序菜单一出现就打开 */
  sortMenu?: boolean
  /** 评论钉右键菜单一出现就打开（线程 id） */
  pinMenu?: string | null
  /** 聚合钉的线程列表一出现就打开（聚合钉 id） */
  clusterOpen?: string | null
  /** 检查器「评论」页签的内容在加载（文档打开中） */
  loading?: boolean
  /** 左栏某页评论角标的工具提示一出现就展开（页码） */
  badgeTip?: number | null
  /** 评审者：「解决」不可用的原因提示一出现就展开（线程 id） */
  resolveTip?: string | null
  /**
   * 评论工具按下时检查器自动切到「评论」页签、工具回到「选择」时恢复按下之前的页签（DS-44 未采纳的备选 alt-tool-tab，同 Figma 评论模式）。
   * 推荐方案不切（01 §2.3：点评论钉是唯一的自动切换），所以用场景参数表达，不按状态名判断（canvas.tsx ToolTabSync）
   */
  toolSwitchesTab?: boolean
  /**
   * 编辑文字时对选中的文字发起评论（compose-text）：正在编辑的文本框与选区（DS-44 写明的例外——撰写时工具仍是「选择」，发表或取消后回到文字编辑）。
   * 选中种类是 text、且在这一页时，画布画出文字编辑态：文本框 1px 强调色描边（无手柄，同 03-16 / 第 1 批文本编辑）+ 选区选中色；
   * 撰写框收起后（发表 / 取消 / Esc）这两样还在、工具仍是「选择」，即回到文字编辑；点空白退出编辑后随之消失（canvas.tsx TextEditMarks）
   */
  textEdit?: { page: number; box: Box; sel?: Box }
}

/**
 * data.dataset 没写时用哪一组线程：评论场景自己是 base（示例 6 条）；底座缺省的「评论」页签（rulings §4.25 TB-82：其余场景点钉或切到「评论」页签时也是本场景的面板，
 * comments.scenario.tsx 登记）包一层 deck——第 1 批示例文档原样（第 4 页 3 条、都未解决），与底座画的 3 枚评论钉、缩略图角标一致
 */
export const DatasetFallback = createContext<Dataset>("base")

export const useData = (): CommentsData => {
  const d = useEditor().data as CommentsData
  const fallback = useContext(DatasetFallback)
  return useMemo(() => (d.dataset ? d : { ...d, dataset: fallback }), [d, fallback])
}

export function useThreads(): [Thread[], SetSceneState<Thread[]>] {
  const d = useData()
  return useSceneState<Thread[]>("comments.threads", () => threadsFor(d.dataset))
}

export function useFilter(): [Filter, SetSceneState<Filter>] {
  const d = useData()
  return useSceneState<Filter>("comments.filter", d.filter ?? "page")
}

export function useSort(): [Sort, SetSceneState<Sort>] {
  const d = useData()
  return useSceneState<Sort>("comments.sort", d.sort ?? "newest")
}

export function useSelected(): [string | null, SetSceneState<string | null>] {
  const d = useData()
  return useSceneState<string | null>("comments.selected", d.selected ?? null)
}

export function useHoverPin(): [string | null, SetSceneState<string | null>] {
  const d = useData()
  return useSceneState<string | null>("comments.hover", d.hoverPin ?? null)
}

export function useDraft(): [Draft | null, SetSceneState<Draft | null>] {
  const d = useData()
  return useSceneState<Draft | null>("comments.draft", d.draft ?? null)
}

/**
 * 随旧页收起、按页留在内存里的草稿（rulings §4.25 DS-65、TB-84）：写了内容的撰写框遇到换页或进网格视图时收进这里，回到单页的那一页时原样恢复（canvas.tsx DraftKeeper）；
 * 场景状态，离开场景或切换状态（相当于关闭文档）即丢弃。页码 → 草稿
 */
export function useKeptDrafts(): [Record<number, Draft>, SetSceneState<Record<number, Draft>>] {
  return useSceneState<Record<number, Draft>>("comments.kept-drafts", {})
}

/**
 * 浮动撰写框里有没有写字（DraftComposer 在有无之间变化时写入，卸载时清掉；初值取 data.draft.text）：
 * 评论工具发表后保持按下（DS-44），点选层一直在——写了字时点画布别处不把稿子换到新落点（与「写了内容时点外面不关」同一保护，免得丢稿）
 */
export function useDraftDirty(): [boolean, SetSceneState<boolean>] {
  const d = useData()
  return useSceneState<boolean>("comments.draft-dirty", !!d.draft?.text?.trim())
}

export function useEditing(): [string | null, SetSceneState<string | null>] {
  const d = useData()
  return useSceneState<string | null>("comments.editing", d.editing ?? null)
}

export function useToast(): [ToastSpec | null, SetSceneState<ToastSpec | null>] {
  const d = useData()
  return useSceneState<ToastSpec | null>("comments.toast", d.toast ?? null)
}

export function useConfirm(): [ConfirmSpec | null, SetSceneState<ConfirmSpec | null>] {
  const d = useData()
  return useSceneState<ConfirmSpec | null>("comments.confirm", d.confirm ?? null)
}

/** 定位高亮（点评论钉 / 深链 / 评审条翻到某条）：线程描边淡出、画布钉脉冲；n 每次加一，同一条再定位也会重放 */
export function useFlash(): [{ id: string; n: number } | null, SetSceneState<{ id: string; n: number } | null>] {
  return useSceneState<{ id: string; n: number } | null>("comments.flash", null)
}

/** 已解决的线程收在列表末尾的「已解决 N」一行里：展开没有（场景状态，初值 data.resolvedOpen）；选中一条已解决的线程时自动展开 */
export function useResolvedOpen(): [boolean, SetSceneState<boolean>] {
  const d = useData()
  return useSceneState<boolean>("comments.resolved-open", !!d.resolvedOpen)
}

/** 读屏播报（polite）：发表、回复、定位后读一句（CommentAnnouncer 在画布列里常驻，检查器停在哪个页签都读得到）；n 每次加一，同一句也会重读 */
export function useAnnounce(): (text: string) => void {
  const [, set] = useSceneState<{ text: string; n: number } | null>("comments.announce", null)
  return (text) => set((p) => ({ text, n: (p?.n ?? 0) + 1 }))
}
export function useAnnouncement() {
  return useSceneState<{ text: string; n: number } | null>("comments.announce", null)[0]
}

/** 当前角色（data.role；缺省按模式：编辑 = 所有者、评审 = 评审者、只读浏览 = 查看者）与权限 */
export function usePerms(): Perms {
  const { mode, data } = useEditor()
  const role = (data as CommentsData).role ?? (mode === "viewer" ? "viewer" : mode === "review" ? "commenter" : "owner")
  return permsFor(role)
}

/** 新线程 / 回复的 id */
export const newId = () => `n${Math.random().toString(36).slice(2, 9)}`

/**
 * 定位一条线程（点评论钉、聚合钉列表、评审条「上一处 / 下一处」、深链 ?comment=）：
 * 换到线程所在页 → 选中它（已解决的线程选中即展开）→ 检查器切到「评论」页签（01 §2.3：点评论钉是唯一允许自动切页签的场景，深链同此）→ 线程滚入视口并描边淡出、画布钉脉冲一次。
 * 当前筛选看不到这条线程时（如「未解决」里定位一条已解决的）先回到「当前页」。紧凑形态里检查器是抽屉：先展开抽屉。
 * 切页签：底座的受控接口 useInspectorTab（检查器页签是场景状态，抽屉还没展开时也先记下，展开即停在「评论」）。
 */
export function useLocate(): (id: string) => void {
  const ctx = useEditor()
  const [threads] = useThreads()
  const [filter, setFilter] = useFilter()
  const [, setSel] = useSelected()
  const [, setFlash] = useFlash()
  const [, setTab] = useInspectorTab()
  const announce = useAnnounce()
  // 与 narrow 场景的抽屉状态同一个键（narrow/form.ts useDrawer），初值同样取 data.drawer
  const [, setDrawer] = useSceneState<"rail" | "inspector" | null>("narrow.drawer", ((ctx.data as { drawer?: "rail" | "inspector" }).drawer ?? null))
  return (id) => {
    const t = threads.find((x) => x.id === id)
    if (!t) return
    if (t.page !== ctx.slide) ctx.goTo(t.page)
    const visible = filter === "page" || filter === "all" || (filter === "open" && !t.resolved) || (filter === "detached" && !!t.anchor.detached) || (filter === "mine" && mentionsMe(t))
    if (!visible) setFilter("page")
    setSel(id)
    setFlash({ id, n: Date.now() })
    if ((ctx.data as { form?: string }).form === "compact") setDrawer("inspector")
    setTab("comments")
    // 焦点留在钉上（还能接着按 Tab / 方向键），读屏告诉用户检查器切到了哪一条（同保真报告「已定位到第 n 页：…」）
    const who = t.imported ? t.imported.author : (t.replies[0]?.by.name ?? "")
    announce(`已定位到第 ${t.page} 页：${who}的评论`)
  }
}
