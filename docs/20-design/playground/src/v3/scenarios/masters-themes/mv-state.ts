import {
  holdFocusDuring, layoutOfSlide, LI, ptOf, useEditor, useSceneState, WANG, ZHANG, type Box, type DeckSlide, type Person, type SceneStore,
} from "../../kit"
import { MASTERS, mastersOfSet, NEW_DOC_MASTERS, type LayoutDef, type MasterDef, type MasterId, type MasterSetKey } from "./data"
import { artTextStyleOf, LEVELS_META, placeholdersFor, PT_PER_CQW, type ArtOverride, type ArtShape, type ArtTone, type PhDef, type PhType, type Target } from "./LayoutArt"
import { pagesText } from "./shared"

/**
 * 母版视图的状态、数据键与规则（50/11 §4 MasterViewState 的样张版；2026-10-30 母版视图改版第二步按规格 §1.3、§2.2、§4.4 重写，第一步的导出都还在）。
 *   在不在母版视图：读宿主的模式接口 useEditor().masterView.on（第一步起）；进入 / 退出走宿主（enter / exit），每次从普通视图进入时由登记处
 *   （master-impl.tsx onEnter）把下面的运行时键重置为「当前页所用的版式、无选中」。
 *   pane    窗格选中项：版式 id（如 office-title-content）或母版 id（office / simple）。点哪编辑哪：选中母版就编辑母版、选中版式就编辑版式（推荐画法）
 *   scope   编辑范围：由窗格选中项决定（母版 → master，版式 → layout，DS-146）；只有对比场景里未采纳的 A′（mvVariant.scope = segment）保留独立的范围
 *   ph / shape   画布上选中的占位符 / 普通形状；multi 多选的版式（只限同一母版）；caret 提示文本编辑中插入符所在的级别
 * 一切页数、页码、名称、原因、可用与否、删除之后选中谁都由数据与下面的规则算出（规格 §1.3）；演示数据（状态的 data）只写输入。
 * 选中种类（检查器分区）随之写进编辑器的 selection：layout / master / master-view-placeholder / master-view-inherited / master-view-multi / shape。
 */

export type Scope = "layout" | "master"
export type MvStatus = "ready" | "loading" | "failed"

/** 场景仓里母版视图的运行时键（登记处 master-impl.tsx 在进入 / 退出 / Esc 时直接读写同一组键） */
export const MV_KEYS = {
  pane: "masters.mv.pane",
  scope: "masters.mv.scope",
  ph: "masters.mv.ph",
  multi: "masters.mv.multi",
  phTool: "masters.mv.phTool",
  phMenu: "masters.mv.phMenu",
  // 第二步
  /** 画布上选中的普通形状 id */
  shape: "masters.mv.shape",
  /** 提示文本编辑：{ ph, level }（插入符所在的占位符与级别）；null 不在编辑 */
  caret: "masters.mv.caret",
  /** 就地改名：{ id, value } */
  rename: "masters.mv.rename",
  /** 运行时改动的版式清单（插入、复制、删除、重排、改名）：MvEdits */
  edits: "masters.mv.edits",
  /** 运行时的轻提示：{ seed, n, undo } */
  toast: "masters.mv.toast",
  /** 轻提示的序号（换一条提示就换一个 key） */
  toastN: "masters.mv.toastN",
  /** 状态种子里的轻提示（data.mvToast）已收起：进出母版视图、点了撤销或 × 之后不再画 */
  seedToastOff: "masters.mv.seedToastOff",
  /** 删除前的确认：{ kind: "layout" | "layouts" | "master", ids } */
  confirm: "masters.mv.confirm",
  /** 拖拽重排进行中：{ id, to, at } */
  drag: "masters.mv.drag",
  /** 「保留母版」的运行时值：{ 母版 id: 是否保留 } */
  preserve: "masters.mv.preserve",
  /** 提交之后要聚焦的锚点（画布在布局阶段接走，焦点不经过 body）：{ anchor, n } */
  focus: "masters.mv.focus",
  // 第二步第二棒
  /** 窗格的右键菜单：{ id, x, y, n, open }（锚在 id 那一行上，x / y 是行内的相对位置；窗格是唯一画它的地方，MasterRail.tsx PaneMenu） */
  ctx: "masters.mv.ctx",
  /** 演示种子（状态 layers 里的 LayoutContextMenu / MasterContextMenu）已经打开过一次：换数据、进出母版视图都不再自己打开 */
  ctxSeeded: "masters.mv.ctxSeeded",
  /** 演示种子里的删除确认框（layers 里的 Delete…Dialog）已经关掉：进出母版视图后不再自己弹出 */
  seedDialogOff: "masters.mv.seedDialogOff",
  /** 「重置为母版值」之后：种子里覆盖的字号（data.mvOverride）不再生效，画布、缩略图与检查器一起回到母版值 */
  ovOff: "masters.mv.ovOff",
} as const

/** 窗格右键菜单的运行时值（MV_KEYS.ctx） */
export interface CtxMenu {
  /** 菜单锚在哪一行（版式或母版 id） */
  id: string
  /** 落点在这一行里的相对位置（0–1）：指针右键取指针处，⇧F10 / 菜单键与演示种子取行内固定一点 */
  x: number
  y: number
  /** 第几次打开（每次打开重新挂一份菜单） */
  n: number
  /** 关上之后先留一拍（open false），让 kit 菜单把焦点交回这一行 */
  open: boolean
}

/** 窗格里一行的锚点（右键菜单、对话框关闭后的焦点交回处） */
export const rowAnchorOf = (id: string, master: boolean): string => (master ? `master-view.master-${id}` : `master-view.layout-${id}`)

/* ------------------------------------------------------------------ 数据键（规格 §4.4）与对比变体 */

/**
 * 对比变体：打开未采纳的备选画法（rulings §4.25 DS-63、DS-173：拍板用的对比场景照 DS-63 保留）。只在对比场景 master-view-options 的状态数据里写；
 * 缺省值就是已采纳的推荐画法，其余状态一律不写
 */
export interface MvVariant {
  /** DS-145：缺省 context（上下文条，已采纳）；toolbar = 未采纳的备选 C（工具条末端的模式段） */
  bar?: "context" | "toolbar"
  /** DS-146：缺省 pane（窗格选中即编辑对象，已采纳）；segment = 未采纳的 A′（条里的「版式 | 母版」分段，保留独立范围） */
  scope?: "pane" | "segment"
  /** DS-148：缺省 labels（虚线 + 类型名，已采纳）；hover = 未采纳的备选 1（选中才写类型）；legacy = 未采纳的备选 2（实线 / 虚线 + 图例） */
  ph?: "labels" | "hover" | "legacy"
  /** DS-155：缺省 inspector（盖检查器栏，两种视图同一画法，已采纳）；anchor = 未采纳的原位置（贴「调整主题」向左、定宽 300，盖画布右侧） */
  themePop?: "inspector" | "anchor"
}

/** 数据集的三个固定键（data.ts MasterSetKey）：default 示例文档的两个母版 · new-doc 新文档的缺省母版 · single 只留首个母版 */
export type MvDataset = MasterSetKey
/** 协作者（取 kit 的示例人物） */
export type MvWho = "WANG" | "LI" | "ZHANG"
const PEOPLE: Record<MvWho, Person> = { WANG, LI, ZHANG }
export const personOf = (who: MvWho): Person => PEOPLE[who]

/** 轻提示种子（规格 §4.4 mvToast；文案由 toastTextOf 按数据算） */
export type MvToast =
  | { kind: "deleted"; layout?: string; layouts?: string[] }
  | { kind: "reassigned"; layout: string; layouts?: string[] }
  | { kind: "ph-removed" }
  | { kind: "committed" }
  | { kind: "limit"; type: string }
  | { kind: "remote-deleted"; layout: string; who: MvWho }
  | { kind: "theme-applied"; theme?: string }

export interface MvData {
  mvPane?: string
  /** 只在未采纳的 A′ 变体（mvVariant.scope = segment）下有效；推荐画法忽略 */
  mvScope?: Scope
  mvPh?: string | null
  mvMulti?: string[]
  mvStatus?: MvStatus
  mvM2?: boolean
  /** 已删除的版式（id） */
  mvRemoved?: string[]
  /** 有未提交的本地交互（拖拽、字段已输入未提交）：上下文条写「未保存改动 · 影响 N 页」 */
  mvUnsaved?: boolean
  /** 工具条「占位符 ▾」的菜单一出现就开着（原来只写在场景的 mv() 参数类型里，2026-10-30 第二步改为正式的键） */
  mvPhMenu?: boolean
  /**
   * 版式上覆盖的字号：哪个占位符（id）、第几级、多少 pt（演示数据只写这一份输入，画布、缩略图与检查器都从它算）。
   * 原来是布尔值（只画覆盖行、字号写死），2026-10-30 第二步改为对象。作用在种子对象上（mvPane 写的那个，没写时是进入时选中的版式）
   */
  mvOverride?: ArtOverride
  /** 演示：某个工具提示一出现就开着（检查器「编辑版式」/ 主题卡「调整主题」） */
  mvTip?: "edit-layout" | "theme-adjust"
  /** 删除前选中的版式：给了就不写 mvPane / selection，删除后的选中由 selectionAfterDelete 算 */
  mvSelBefore?: string
  /**
   * 数据集：default 示例文档的两个母版 · new-doc 新文档的缺省母版（11 个版式）· single 只留首个母版；或直接给一份母版清单（场景自带的母版，
   * 如 text-edit：第 7 页用的两个版式只在它那一份里，场景级写一次）。普通视图的版式画廊、检查器「版式」字段与「转到版式」读同一份（data.ts mastersOfSet）
   */
  mvMasters?: MvDataset | readonly MasterDef[]
  /** 改名：{ 版式 id: 新名 }；空串 = 未命名（显示「未命名版式 n」） */
  mvNames?: Record<string, string>
  /** 「保留母版」的值（缺省：导入的母版为真） */
  mvPreserve?: Record<string, boolean>
  /** 就地改名进行中的输入 */
  mvRename?: { id: string; value: string }
  /** 拖拽重排进行中：拖的是谁、拖到谁的前 / 后（跨母版是否禁止由数据算） */
  mvDrag?: { id: string; to: string; at: "before" | "after" }
  /** 拖动占位符中（pt）：作用在种子对象的这个占位符上 */
  mvMove?: { ph: string; dx: number; dy: number }
  /** 在场：谁正在编辑哪个版式 */
  mvPresence?: { layout: string; who: MvWho }[]
  /** 提示文本编辑中、插入符所在的级别（作用在 mvPh） */
  mvCaret?: { level: number }
  /** 检查器里展开的下拉 */
  mvMenu?: "ph-type"
  /** 种子对象上的普通形状（种子对象是母版时，它的版式也画这些形状，作为母版图形、不可选） */
  mvShapes?: ArtShape[]
  mvShapeSel?: string
  /** 已删的占位符：{ 版式（或母版）id: 占位符 id[] } */
  mvRemovedPh?: Record<string, string[]>
  /** 远端改了一个几何字段（pt）：作用在种子对象的这个占位符上 */
  mvRemote?: { ph: string; key: "x" | "y" | "w" | "h"; value: number; who: MvWho }
  mvToast?: MvToast
  mvVariant?: MvVariant
}

export const KIND = {
  layout: "layout",
  master: "master",
  placeholder: "master-view-placeholder",
  inherited: "master-view-inherited",
  multi: "master-view-multi",
} as const

/** 窗格选中的是示例文档里的母版（第一步的写法，按 MASTERS 判；第二步的件按当前数据集判，用 MasterView.isMaster） */
export const isMasterId = (id: string): id is MasterId => MASTERS.some((m) => m.id === id)

/* ------------------------------------------------------------------ 占位符类型的产品名与版式按名称查找（规格 §1.3） */

/**
 * 占位符类型的产品化名称（DS-30：内容 / 文本 / 图片 / 表格 / 图表 / 媒体 ┊ 标题 / 页脚 / 日期 / 页码）；母版上的正文区是「文本」，版式里的是「内容」（TB-34）。
 * 原在 master-sections.tsx（检查器「类型」一行），2026-10-30 挪到这里，检查器与普通视图的「转到版式」共用一份
 */
const TYPE_NAME: Record<PhType, string> = {
  title: "标题",
  "cover-title": "标题",
  "section-title": "标题",
  subtitle: "副标题",
  body: "内容",
  header: "文本",
  "section-text": "文本",
  footer: "页脚",
  date: "日期",
  number: "页码",
  picture: "图片",
}

/** 占位符的产品名：类型表里取；正文型而标签是「文本占位符」的（母版正文区、说明文字）写「文本」；表里没有的写「内容」 */
export function typeNameOf(p: { type: string; label: string }): string {
  if (p.type === "body" && p.label === "文本占位符") return "文本"
  return (TYPE_NAME as Record<string, string | undefined>)[p.type] ?? "内容"
}

/**
 * 产品名换回占位符类型（MasterTarget.placeholder.type 用类型键，规格 §2.4）：取类型表里第一个叫这个名字的类型——
 * 「标题」→ title、「副标题」→ subtitle、「内容」→ body、「文本」→ header、「图片」→ picture、「页脚 / 日期 / 页码」→ footer / date / number。
 * 同名的几种属于同一族（标题族、正文族），进入母版视图后按族与索引匹配（phMatch），取哪一个不影响匹配结果。不认识的名字返回 undefined
 */
export function phTypeKeyOf(name: string): PhType | undefined {
  return (Object.keys(TYPE_NAME) as PhType[]).find((k) => TYPE_NAME[k] === name)
}

/**
 * 按名称精确找版式（「转到版式」：普通视图占位符检查器里写的是版式名）：按母版顺序取第一个同名的，不按页码回退（区别于 layoutOfSlide）；
 * 找不到返回 undefined（调用处据此判断动作可不可用）。masters 缺省是示例文档的母版（第二步起传 mastersOf 的结果）
 */
export function layoutByName(name: string, masters: readonly MasterDef[] = MASTERS): LayoutDef | undefined {
  for (const m of masters) {
    const hit = m.layouts.find((l) => l.name === name)
    if (hit) return hit
  }
  return undefined
}

/* ------------------------------------------------------------------ 数据集与运行时改动（规格 §3.2.8、§3.2.10） */

/** 运行时对版式清单的改动（样张只改场景仓里的清单，轻提示的「撤销」恢复到改动前的一份，不做真正的撤销栈） */
export interface MvEdits {
  /** 插入、复制出来的版式：排在 after 那个版式之后（null 排到母版末尾），按先后依次放 */
  added: { def: LayoutDef; after: string | null }[]
  /** 重排：依次把 id 挪到 to 的前 / 后（只在同一母版内） */
  moves: { id: string; to: string; at: "before" | "after" }[]
  /** 删掉的版式 */
  removed: string[]
  /** 改名（与 data.mvNames 同一写法，后写的覆盖；键是母版 id 时改母版名，空串不改母版名） */
  names: Record<string, string>
  /** 撤销了演示种子里的删除：data.mvRemoved 里的这些版式回来 */
  restored: string[]
  /** 撤销了演示种子里删掉的占位符：{ 对象 id: 占位符 id[] } 回来 */
  phRestored: Record<string, string[]>
}
export const NO_EDITS: MvEdits = { added: [], moves: [], removed: [], names: {}, restored: [], phRestored: {} }

/** 数据集本身（未套改名、删除与运行时改动）：三个固定键照旧，给的是一份清单就用它（与普通视图同一个取法，data.ts mastersOfSet） */
export function datasetOf(set: MvData["mvMasters"]): readonly MasterDef[] {
  return mastersOfSet(set)
}

/** 已删除的版式：数据给的（撤销过的除外）+ 运行时删的 */
export function removedOf(data: MvData, edits: MvEdits = NO_EDITS): string[] {
  return [...(data.mvRemoved ?? []).filter((x) => !edits.restored.includes(x)), ...edits.removed]
}

/** 某个对象上已删的占位符：数据给的（撤销过的除外） */
export function removedPhOf(data: MvData, id: string, edits: MvEdits = NO_EDITS): string[] {
  const back = edits.phRestored[id] ?? []
  return (data.mvRemovedPh?.[id] ?? []).filter((x) => !back.includes(x))
}

/** 全部母版与版式（含已删除的，删除之后找「前一个版式」、算删前用量要用）：数据集 → 运行时插入与重排 → 改名 */
export function mastersAll(data: MvData, edits: MvEdits = NO_EDITS): MasterDef[] {
  const names: Record<string, string> = { ...data.mvNames, ...edits.names }
  return datasetOf(data.mvMasters).map((m) => {
    const list = [...m.layouts]
    for (const a of edits.added) {
      if (a.def.master !== m.id || list.some((l) => l.id === a.def.id)) continue
      const i = a.after ? list.findIndex((l) => l.id === a.after) : -1
      list.splice(i < 0 ? list.length : i + 1, 0, a.def)
    }
    for (const mv of edits.moves) {
      const from = list.findIndex((l) => l.id === mv.id)
      const item = list[from]
      if (!item || mv.id === mv.to || !list.some((l) => l.id === mv.to)) continue
      list.splice(from, 1)
      const to = list.findIndex((l) => l.id === mv.to)
      list.splice(mv.at === "before" ? to : to + 1, 0, item)
    }
    const layouts = list.map((l) => (names[l.id] !== undefined ? { ...l, name: names[l.id]! } : l))
    const mName = names[m.id]
    return { ...m, name: mName ? mName : m.name, layouts }
  })
}

/** 去掉已删除的版式 */
export function liveMasters(all: readonly MasterDef[], removed: readonly string[]): MasterDef[] {
  return all.map((m) => ({ ...m, layouts: m.layouts.filter((l) => !removed.includes(l.id)) }))
}

/** 母版视图实际的母版与版式（规格 §1.3 mastersOf）：数据集 → 运行时增删与重排 → mvNames 改名 → 去掉 mvRemoved 与运行时删掉的 */
export function mastersOf(data: MvData, edits: MvEdits = NO_EDITS): MasterDef[] {
  return liveMasters(mastersAll(data, edits), removedOf(data, edits))
}

export const findMaster = (id: string, masters: readonly MasterDef[]): MasterDef | undefined => masters.find((m) => m.id === id)
export function findLayout(id: string, masters: readonly MasterDef[]): LayoutDef | undefined {
  for (const m of masters) {
    const hit = m.layouts.find((l) => l.id === id)
    if (hit) return hit
  }
  return undefined
}
/** 各数据集里出现过的全部版式定义（数据集里找不到的 id——换过数据集——按它取母版与种类） */
const KNOWN_LAYOUTS: LayoutDef[] = [...MASTERS, ...NEW_DOC_MASTERS].flatMap((m) => m.layouts)

/* ------------------------------------------------------------------ 用量（规格 §1.3） */

/**
 * 某页用的版式 id：本页在版式画廊里换过的（场景仓 layouts.applied.<页>）→ 页面的版式名在数据集里对应的版式（layoutOfSlide）。
 * dataset 是数据集本身（datasetOf 的结果，未套改名）：按页认版式与普通视图同一份母版，运行时改的名不影响页用的是哪个版式
 */
export function slideLayoutId(slide: Pick<DeckSlide, "n" | "layout">, applied?: string, dataset: readonly MasterDef[] = MASTERS): string {
  return applied ?? layoutOfSlide(slide, dataset).id
}

/**
 * 删版式后的改派（I-ML2 回退链，PRD ML-03 §1，03-26 §8）：同母版同种类的首个未删版式 → 该母版首个未删版式 →
 * （母版不在数据集里时）首个母版里同种类的 → 首个母版首个未删版式。masters 传含已删除的全部清单
 */
export function defaultLayoutOf(id: string, masters: readonly MasterDef[], removed: readonly string[]): string {
  const live = (l: LayoutDef) => l.id !== id && !removed.includes(l.id)
  const self = findLayout(id, masters) ?? KNOWN_LAYOUTS.find((l) => l.id === id)
  const own = self ? findMaster(self.master, masters) : undefined
  const first = masters[0]
  const hit =
    (self && own?.layouts.find((l) => live(l) && l.kind === self.kind)) ||
    own?.layouts.find(live) ||
    (self && !own && first?.layouts.find((l) => live(l) && l.kind === self.kind)) ||
    first?.layouts.find(live)
  return hit?.id ?? id
}

/** 每页 → 版式 id（已删的、数据集里没有的按 defaultLayoutOf 改派），返回「版式 id → 升序页码」；dataset 同 slideLayoutId（按页认版式用的数据集本身） */
export function deckUsage(
  deck: readonly Pick<DeckSlide, "n" | "layout">[],
  appliedOf: (n: number) => string | undefined,
  masters: readonly MasterDef[],
  removed: readonly string[],
  dataset: readonly MasterDef[] = MASTERS,
): Map<string, number[]> {
  const map = new Map<string, number[]>()
  for (const s of deck) {
    const raw = slideLayoutId(s, appliedOf(s.n), dataset)
    const id = !removed.includes(raw) && findLayout(raw, masters) ? raw : defaultLayoutOf(raw, masters, removed)
    map.set(id, [...(map.get(id) ?? []), s.n])
  }
  for (const [k, v] of map) map.set(k, [...v].sort((a, b) => a - b))
  return map
}

/** 版式取自己的引用页；母版取其（未删）版式的引用页之和，去重升序（R-26） */
export function usageOf(map: ReadonlyMap<string, readonly number[]>, target: LayoutDef | MasterDef): number[] {
  if ("layouts" in target) return [...new Set(target.layouts.flatMap((l) => map.get(l.id) ?? []))].sort((a, b) => a - b)
  return [...(map.get(target.id) ?? [])]
}

/** 检查器「使用此版式」：有页「N 页 · 第 x 页」，没有「未使用」 */
export function usageText(pages: readonly number[]): string {
  return pages.length ? `${pages.length} 页 · ${pagesText(pages)}` : "未使用"
}

/** 显示名：名称为空时「未命名版式 n」（n = 同母版里空名版式的序号，从 1 起，R-31） */
export function displayNameOf(layout: LayoutDef, masters: readonly MasterDef[]): string {
  if (layout.name.trim()) return layout.name
  const own = findMaster(layout.master, masters)?.layouts ?? [layout]
  const blanks = own.filter((l) => !l.name.trim())
  const i = blanks.findIndex((l) => l.id === layout.id)
  return `未命名版式 ${i < 0 ? blanks.length + 1 : i + 1}`
}

/* ------------------------------------------------------------------ 上下文条、原因（规格 §1.3、§3.10 第 12 条） */

/** 规则函数读的事实（MasterView 就满足它；检查脚本与别的件也可以只拼这几项） */
export interface MvFacts {
  status: MvStatus
  readOnly: boolean
  m2: boolean
  unsaved: boolean
  scope: Scope
  master: MasterDef
  paneLayout: LayoutDef | undefined
  targetName: string
  /** 当前对象（版式或母版）的引用页 */
  usage: number[]
  multiLayouts: LayoutDef[]
  selectedPh: PhDef | undefined
  variant: MvVariant
}

const segment = (v: Pick<MvFacts, "variant">) => v.variant.scope === "segment"

/** 上下文条的对象段（dir §2.1）：多选、加载中、失败没有对象段 */
export function contextObjectOf(v: MvFacts): { kind: "版式" | "母版"; name: string; from: string } | null {
  if (v.status !== "ready" || v.multiLayouts.length > 1) return null
  if (v.scope === "master") return { kind: "母版", name: v.master.name, from: `${v.master.layouts.length} 个版式继承此母版` }
  return { kind: "版式", name: v.targetName, from: `继承自母版「${v.master.name}」` }
}

/** 上下文条的说明段（R-25 八条，按序取第一条）；降权一句按 DS-146 写，对比场景里未采纳的 A′ 变体写原句 */
export function contextDetailOf(v: MvFacts): string {
  if (v.status === "loading") return "正在加载母版与版式…"
  if (v.status === "failed") return "母版信息未能加载"
  if (v.readOnly) return segment(v) ? "只能查看母版与版式，可以切换范围" : "只能查看母版与版式"
  if (v.m2) return "可以查看并选中占位符，版式编辑将在后续版本提供"
  if (v.multiLayouts.length > 1) return `已选中 ${v.multiLayouts.length} 个版式`
  const n = v.usage.length
  if (v.unsaved) return n > 0 ? `未保存改动 · 影响 ${n} 页（${pagesText(v.usage)}）` : "未保存改动"
  if (n > 0) return `改动将影响 ${n} 页（${pagesText(v.usage)}）`
  return v.scope === "master" ? "此母版还没有页面使用" : "此版式还没有页面使用"
}

/**
 * 不可用的原因（规格 §3.10 第 12 条；同一对象有几条原因时按表里的先后取第一条）：
 *   select 选择工具 · create 文本 / 形状 / 图片 / 表格 / 图表 / 更多 · placeholder「占位符 ▾」与 P · newLayout「新建版式 ▾ / +」与 ⌘M ·
 *   field 检查器字段 · rename 改名 · menu 右键菜单能不能打开（M2 不开）· theme「调整主题」·
 *   duplicate 复制版式与 ⌘D · delete 删除（Delete、右键「删除」）· pages「在普通视图查看引用页」（本步加的三项，见笔记）
 */
export type MvReasonWhat = "select" | "create" | "placeholder" | "newLayout" | "field" | "rename" | "menu" | "theme" | "duplicate" | "delete" | "pages"

export function mvReasonOf(v: MvFacts, what: MvReasonWhat): string | undefined {
  const multi = v.multiLayouts.length > 1
  if (what === "pages") {
    if (v.status !== "ready") return "母版信息加载后可用"
    if (v.usage.length) return undefined
    // 母版没有「在普通视图查看」的入口（R-39 只在版式菜单里）；万一用到，写上下文条 R-25 第 8 条的原句，不另造新句
    return multi ? "没有页面使用所选版式" : v.scope === "master" ? "此母版还没有页面使用" : "没有页面使用此版式"
  }
  if (v.status !== "ready") return "母版信息加载后可用"
  if (what === "select") return undefined
  // 右键菜单：降权时照开只读菜单（kit readOnlyMenu：改文档的条目留在原位不可用，导航照常），M2 不开（dir L271）
  if (what === "menu") return v.m2 ? "版式编辑将在后续版本提供" : undefined
  if (v.readOnly) return "需要编辑权限"
  if (v.m2) return what === "theme" ? "当前版本暂未开放" : "版式编辑将在后续版本提供"
  if (what === "field") {
    const p = v.selectedPh
    if (p && p.inherited && v.scope === "layout") return segment(v) ? "继承自母版，切换到「母版」后编辑" : "继承自母版，在母版中编辑"
    return undefined
  }
  if (!multi) return undefined
  switch (what) {
    case "placeholder":
      return "多选版式时不能插入占位符"
    case "create":
    case "newLayout":
      return "多选版式时不能插入"
    case "rename":
      return "多选版式时不能重命名"
    case "duplicate":
      return "多选版式时不能复制"
    default:
      return undefined
  }
}

/* ------------------------------------------------------------------ 级别样式与角标（规格 §1.3） */

export interface LevelStyle {
  level: number
  /** 字号（pt） */
  size: number
  /** 缩进（pt） */
  indent: number
  /** 行距（倍） */
  lineHeight: number
  /** 段距（pt） */
  spacing: number
  bullet: string
}

/**
 * 第 level 级（1–9）的文本样式：由 LayoutArt 的 LEVELS_META 换算（1cqw = 9.6 pt），检查器写的就是画布实际画出来的值（Q8）——
 * 第 1–5 级字号 29 / 24 / 20 / 18 / 16 pt、段距 14 pt；第 6–9 级沿用第 5 级字号，缩进按第 1→2 级的增量继续加
 */
export function levelStyleOf(level: number): LevelStyle {
  const n = Math.min(9, Math.max(1, Math.round(level)))
  const metas = LEVELS_META
  const last = metas[metas.length - 1]!
  const first = metas[0]!
  const step = (metas[1]?.padCqw ?? 0) - first.padCqw
  const m = metas[n - 1] ?? { ...last, padCqw: last.padCqw + step * (n - metas.length) }
  return {
    level: n,
    size: Math.round(m.cqw * PT_PER_CQW),
    indent: Math.round(m.padCqw * PT_PER_CQW),
    lineHeight: m.lineHeight,
    spacing: Math.round(m.gapCqw * PT_PER_CQW),
    bullet: "•",
  }
}

/** 检查器「文本样式」一组字段的值（textStyleOf） */
export interface TextStyle extends LevelStyle {
  weight: number
  tone: ArtTone
}

/**
 * 一个占位符在第 level 级（单段的类型只有第 1 级）的文本样式：字号、字重、颜色取画布实际的画法（LayoutArt artTextStyleOf，Q8），
 * 缩进、行距、段距、项目符号取 levelStyleOf；说明文字这类给了 textPt 的正文，缩进与段距按同一比例缩小（同 canvas / thumb 画法）
 */
export function textStyleOf(p: Pick<PhDef, "type" | "textPt">, level: number): TextStyle {
  const body = p.type === "body"
  const ls = levelStyleOf(body ? level : 1)
  const scale = body && p.textPt ? p.textPt / (LEVELS_META[0]!.cqw * PT_PER_CQW) : 1
  const art = artTextStyleOf(p, ls.level)
  return { ...ls, size: art.pt, weight: art.weight, tone: art.tone, indent: Math.round(ls.indent * scale), spacing: Math.round(ls.spacing * scale) }
}

/** 尺寸角标「840 × 300」（960 × 540 pt 设计坐标，取整） */
export function phSizeText(box: Box): string {
  const p = ptOf(box)
  return `${p.w} × ${p.h}`
}
/** 拖动中的位置角标「X 84 · Y 62」 */
export function phPosText(box: Box): string {
  const p = ptOf(box)
  return `X ${p.x} · Y ${p.y}`
}

/* ------------------------------------------------------------------ 占位符匹配（规格 §1.3） */

/** 类型族：标题族、正文族（内容 / 文本 / 图片）、副标题、页脚、日期、页码各自一族 */
const FAMILY: Record<PhType, string> = {
  title: "title",
  "cover-title": "title",
  "section-title": "title",
  body: "body",
  header: "body",
  "section-text": "body",
  picture: "body",
  subtitle: "subtitle",
  footer: "footer",
  date: "date",
  number: "number",
}
export const familyOf = (type: string): string => (FAMILY as Record<string, string | undefined>)[type] ?? type

/** 先按类型族、再按索引（OOXML idx）；索引对不上取同族第一个（「转到版式」「在母版中编辑」的占位符目标） */
export function phMatch(target: { type: string; index?: number } | null | undefined, placeholders: readonly PhDef[]): PhDef | undefined {
  if (!target) return undefined
  const fam = familyOf(target.type)
  const same = placeholders.filter((p) => familyOf(p.type) === fam)
  return (target.index !== undefined ? same.find((p) => p.idx === target.index) : undefined) ?? same[0]
}

/* ------------------------------------------------------------------ 删除与改名（规格 §1.3） */

/**
 * 删掉的是当前选中项时：本地删除 → 同母版里它前面的未删版式，没有就选母版（R-64，03-26 §8）；他人删除 → 它的母版（R-70，50/11 §10）。
 * 删的不是选中项时选中不变。v.all 是含已删除的全部清单，v.removed 是删之前已删的（这一次删的由 removedIds 给）
 */
export function selectionAfterDelete(
  v: { pane: string; all: readonly MasterDef[]; removed: readonly string[] },
  removedIds: string | readonly string[],
  cause: "local" | "remote",
): string {
  const gone = typeof removedIds === "string" ? [removedIds] : removedIds
  if (!gone.includes(v.pane)) return v.pane
  const l = findLayout(v.pane, v.all)
  if (!l) return v.pane
  if (cause === "remote") return l.master
  const own = findMaster(l.master, v.all)?.layouts ?? []
  const at = own.findIndex((x) => x.id === l.id)
  for (let i = at - 1; i >= 0; i--) {
    const x = own[i]
    if (x && !gone.includes(x.id) && !v.removed.includes(x.id)) return x.id
  }
  return l.master
}

/** 改名的错误（去首尾空白后）：超过 64 字；版式名同母版内重名（不计自己）。空串不报错（提交时还原原名） */
export function renameErrorOf(value: string, target: LayoutDef | MasterDef, masters: readonly MasterDef[]): string | undefined {
  const v = value.trim()
  if (!v) return undefined
  if ([...v].length > 64) return "名称最多 64 个字"
  if ("layouts" in target) return undefined
  const dup = findMaster(target.master, masters)?.layouts.find((l) => l.id !== target.id && displayNameOf(l, masters) === v)
  return dup ? `同一母版里已有「${v}」` : undefined
}

/* ------------------------------------------------------------------ 轻提示文案（规格 §4.4） */

/** 算轻提示要用的数据（MasterView 带一份） */
export interface MvToastCtx {
  /** 含已删除的全部清单（删掉的版式要取名称） */
  all: readonly MasterDef[]
  /** 当前对象的引用页 */
  usage: number[]
  /** 当前母版的引用页 */
  masterUsage: number[]
  /** 这些版式删之前的引用页（并集） */
  usageBefore: (ids: readonly string[]) => number[]
}

export interface MvToastText {
  text: string
  /** 带「撤销」 */
  undo: boolean
  /** 交互触发时多久后自己收起（演示种子一出现就在、不自己收起） */
  ms: number
}

export function toastTextOf(t: MvToast, v: MvToastCtx, themeName?: string): MvToastText {
  const name = (id: string) => {
    const l = findLayout(id, v.all)
    return l ? displayNameOf(l, v.all) : id
  }
  switch (t.kind) {
    case "deleted": {
      const ids = t.layouts ?? (t.layout ? [t.layout] : [])
      return { text: ids.length > 1 ? `已删除 ${ids.length} 个版式` : `已删除版式「${name(ids[0] ?? "")}」`, undo: true, ms: 5000 }
    }
    case "reassigned":
      return { text: `已删除版式，${v.usageBefore(t.layouts ?? [t.layout]).length} 页已改用默认版式`, undo: true, ms: 5000 }
    case "ph-removed":
      return { text: `已影响 ${v.usage.length} 页，其中的占位符已保留为普通形状`, undo: true, ms: 5000 }
    case "committed":
      return { text: `已更新 ${v.usage.length} 页`, undo: false, ms: 3000 }
    case "limit":
      return { text: `该版式已包含${typeNameOf({ type: t.type, label: "" })}占位符`, undo: false, ms: 5000 }
    case "remote-deleted":
      return { text: `「${name(t.layout)}」已被 ${personOf(t.who).name} 删除`, undo: false, ms: 5000 }
    case "theme-applied":
      return { text: `已应用主题「${t.theme ?? themeName ?? ""}」，影响 ${v.masterUsage.length} 页`, undo: true, ms: 5000 }
  }
}

/* ------------------------------------------------------------------ 选中种类 */

/** 当前应有的选中种类（检查器据此取分区）：多选 → 版式多选；普通形状 → shape；选中占位符 → 版式范围下的继承项另算；否则按范围取版式 / 母版 */
export function kindFor(s: Scope, p: PhDef | undefined, m: number, shape?: boolean) {
  if (m > 1) return KIND.multi
  if (shape) return "shape" as const
  if (p) return p.inherited && s === "layout" ? KIND.inherited : KIND.placeholder
  return s === "master" ? KIND.master : KIND.layout
}

/* ------------------------------------------------------------------ 场景仓上的同一套判断（登记处的钩子拿到的是场景仓，不在组件里） */

/** 某页在版式画廊里换过的版式（场景仓 layouts.applied.<页>，普通视图检查器「版式」字段写） */
export function appliedOf(scene: SceneStore, n: number): string | undefined {
  const a = scene.get(`layouts.applied.${n}`)
  return typeof a === "string" ? a : undefined
}

/** 场景仓里的运行时改动（没写过时是空） */
export function editsOf(scene: SceneStore): MvEdits {
  const e = scene.get(MV_KEYS.edits) as MvEdits | undefined
  return e ?? NO_EDITS
}

/** 某个对象（版式或母版 id）上的占位符：去掉已删的（mvRemovedPh）；remote 给了的那个换成远端改过的框 */
export function placeholdersOf(id: string, masters: readonly MasterDef[], data: MvData, seed?: string, edits: MvEdits = NO_EDITS): PhDef[] {
  const m = findMaster(id, masters)
  const l = m ? undefined : findLayout(id, masters)
  const masterId = m?.id ?? l?.master ?? "office"
  const target: Target = m ? "master" : (l?.kind ?? "title-content")
  const gone = removedPhOf(data, id, edits)
  const r = data.mvRemote
  return placeholdersFor(masterId, target)
    .filter((p) => !gone.includes(p.id))
    .map((p) => (r && seed === id && r.ph === p.id ? { ...p, box: remoteBox(p.box, r) } : p))
}

/** 远端改了一个几何字段之后的框（pt → 百分比） */
function remoteBox(b: Box, r: NonNullable<MvData["mvRemote"]>): Box {
  const pct = (v: number, base: number) => (v / base) * 100
  if (r.key === "x") return { ...b, x: pct(r.value, 960) }
  if (r.key === "y") return { ...b, y: pct(r.value, 540) }
  if (r.key === "w") return { ...b, w: pct(r.value, 960) }
  return { ...b, h: pct(r.value, 540) }
}

/** 拖动中的框（pt 位移 → 百分比） */
export function movedBox(b: Box, mv: { dx: number; dy: number }): Box {
  return { ...b, x: b.x + (mv.dx / 960) * 100, y: b.y + (mv.dy / 540) * 100 }
}

/** 进入或载入时的种子对象：状态写的 mvPane（在当前数据集里才算）；没写时是当前页所用的版式（已删的按改派） */
export function seedPaneOf(data: MvData, current: Pick<DeckSlide, "n" | "layout">, applied: string | undefined, all: readonly MasterDef[], removed: readonly string[]): string {
  const live = (id: string) => (!!findMaster(id, all) || !!findLayout(id, all)) && !removed.includes(id)
  if (data.mvPane && live(data.mvPane)) return data.mvPane
  const raw = slideLayoutId(current, applied, datasetOf(data.mvMasters))
  return live(raw) ? raw : defaultLayoutOf(raw, all, removed)
}

/** 载入时的窗格选中：删除演示态（mvSelBefore）按 selectionAfterDelete 算；其余是种子对象 */
export function initialPaneOf(data: MvData, seed: string, all: readonly MasterDef[], removed: readonly string[]): string {
  const before = data.mvSelBefore
  if (!before) return seed
  const cause = data.mvToast?.kind === "remote-deleted" ? "remote" : "local"
  const earlier = removed.filter((x) => x !== before)
  return selectionAfterDelete({ pane: before, all, removed: earlier }, removed.includes(before) ? before : [], cause)
}

/* ------------------------------------------------------------------ useMasterView（规格 §2.2） */

type Toast = { seed: MvToast; n: number; undo?: { edits: MvEdits; pane: string; multi: string[] } }
type Confirm = { kind: "layout" | "layouts" | "master"; ids: string[] }

/**
 * 正在进行的那一次焦点保持（focusAfter 起的 holdFocusDuring）的提前解除函数。窗格、画布、轻提示各调一次 useMasterView，
 * 起保持的那一份与要结束它的那一份常常不是同一个件（窗格里删除、轻提示里撤销），所以放在模块里（同一页面同时只有一个母版视图）。
 * 起新的保持之前先结束旧的（焦点只跟最新的选中行）；轻提示「撤销」恢复选中时结束它——否则删除后 1 秒内按「撤销」，选中已回到被删的版式，
 * 焦点却被保持接到删除后选中的那一行，两者分家（评审 ② 非阻断第 2 条；总编排裁定第 12、16 条：结束保持后焦点照 50/16 §8 交给画布，与 1 秒后按相同）
 */
let releaseHold: (() => void) | null = null
const endHold = () => {
  releaseHold?.()
  releaseHold = null
}

/**
 * 母版视图的状态与动作（窗格、画布、检查器、上下文条、工具条、轻提示共用一份；每个件各调一次，读的是同一个场景仓）。
 * 字段：masters（当前数据集，已删的去掉）、all（含已删的）、pane、paneIsMaster、paneLayout、master、scope、target、objectId、targetName、usage、usageMap、
 *   placeholders、selectedPh、shapes、selectedShape、multiLayouts、status、readOnly、m2、unsaved、variant、caret、rename、drag、dragBlocked、remote、move、override、
 *   toast、confirm、seedPane；以及按 id 取的 isMaster / layoutOf / nameOf / usageFor / artOf / presenceOf / preserveOf。
 * 动作：pick、toggleMulti、selectPh、selectShape、setScope（只在 A′）、focusCanvas、editInMaster、viewInNormal、startText / setCaretLevel / exitText、
 *   startRename / setRenameValue / commitRename / cancelRename、insertLayout、duplicateLayout、deleteSelection、confirmDelete / cancelConfirm、
 *   removeLayouts、reorder、setPreserve、showToast / dismissToast / undoToast、setDrag。
 */
export function useMasterView() {
  const editor = useEditor()
  const d = editor.data as MvData
  const scene = editor.scene
  const variant: MvVariant = d.mvVariant ?? {}
  const [edits, setEdits] = useSceneState<MvEdits>(MV_KEYS.edits, NO_EDITS)
  const all = mastersAll(d, edits)
  const removed = removedOf(d, edits)
  const masters = liveMasters(all, removed)
  const applied = (n: number) => appliedOf(scene, n)
  /** 数据集本身（未套改名）：按页认版式用（slideLayoutId） */
  const dataset = datasetOf(d.mvMasters)
  const usageMap = deckUsage(editor.deck, applied, all, removed, dataset)
  const seedPane = seedPaneOf(d, editor.current, applied(editor.slide), all, d.mvRemoved ?? [])
  const [paneRaw, setPane] = useSceneState<string>(MV_KEYS.pane, () => initialPaneOf(d, seedPane, all, d.mvRemoved ?? []))
  const [scopeRaw, setScopeRaw] = useSceneState<Scope>(MV_KEYS.scope, d.mvScope ?? "layout")
  const [ph, setPh] = useSceneState<string | null>(MV_KEYS.ph, d.mvPh ?? null)
  const [multi, setMulti] = useSceneState<string[]>(MV_KEYS.multi, d.mvMulti ?? [])
  const [shapeSel, setShapeSel] = useSceneState<string | null>(MV_KEYS.shape, d.mvShapeSel ?? null)
  const [caretRaw, setCaret] = useSceneState<{ ph: string; level: number } | null>(MV_KEYS.caret, d.mvCaret && d.mvPh ? { ph: d.mvPh, level: d.mvCaret.level } : null)
  const [rename, setRename] = useSceneState<{ id: string; value: string } | null>(MV_KEYS.rename, d.mvRename ?? null)
  const [toast, setToast] = useSceneState<Toast | null>(MV_KEYS.toast, null)
  const [confirm, setConfirm] = useSceneState<Confirm | null>(MV_KEYS.confirm, null)
  const [drag, setDrag] = useSceneState<MvData["mvDrag"] | null>(MV_KEYS.drag, d.mvDrag ?? null)
  const [preserve, setPreserveMap] = useSceneState<Record<string, boolean>>(MV_KEYS.preserve, {})
  const [ovOff, setOvOff] = useSceneState<boolean>(MV_KEYS.ovOff, false)
  /** 种子里覆盖的字号（「重置为母版值」之后不再生效） */
  const seedOverride = ovOff ? undefined : d.mvOverride

  const isMaster = (id: string) => !!findMaster(id, masters)
  const exists = (id: string) => isMaster(id) || !!findLayout(id, masters)
  // 窗格选中项不在了（运行时删掉之后没来得及改派，一般不会）：按本地删除的规则落位，再不行取首个母版
  const pane = exists(paneRaw) ? paneRaw : (() => {
    const next = selectionAfterDelete({ pane: paneRaw, all, removed }, paneRaw, "local")
    return exists(next) ? next : (masters[0]?.id ?? paneRaw)
  })()
  const paneIsMaster = isMaster(pane)
  const paneLayout = paneIsMaster ? undefined : findLayout(pane, masters)
  const master: MasterDef = (paneIsMaster ? findMaster(pane, masters) : paneLayout ? findMaster(paneLayout.master, masters) : undefined) ?? masters[0] ?? all[0]!
  const segmentOn = variant.scope === "segment"
  const scope: Scope = paneIsMaster || !paneLayout ? "master" : segmentOn ? scopeRaw : "layout"
  const target: Target = scope === "master" ? "master" : paneLayout!.kind
  const objectId = scope === "master" ? master.id : paneLayout!.id
  const nameOf = (id: string): string => {
    const m = findMaster(id, all)
    if (m) return m.name
    const l = findLayout(id, all)
    return l ? displayNameOf(l, findLayout(id, masters) ? masters : all) : id
  }
  const targetName = nameOf(objectId)
  const usageFor = (id: string): number[] => {
    const m = findMaster(id, masters)
    if (m) return usageOf(usageMap, m)
    const l = findLayout(id, all)
    return l ? usageOf(usageMap, l) : []
  }
  const usage = usageFor(objectId)
  const placeholders = placeholdersOf(objectId, masters, d, seedPane, edits)
  const selectedPh = ph ? placeholders.find((p) => p.id === ph) : undefined
  /** 普通形状：画在种子对象上；种子对象是母版时它的版式也画（母版图形，不可选） */
  const shapesOf = (id: string): ArtShape[] => {
    const s = d.mvShapes ?? []
    if (!s.length) return []
    if (id === seedPane) return s
    const l = findLayout(id, masters)
    return l && l.master === seedPane ? s : []
  }
  const shapes = shapesOf(objectId)
  const selectedShape = shapeSel && objectId === seedPane ? shapes.find((s) => s.id === shapeSel) : undefined
  const multiLayouts = multi.map((id) => findLayout(id, masters)).filter((l): l is LayoutDef => !!l)
  const caret = caretRaw && selectedPh && caretRaw.ph === selectedPh.id ? caretRaw : null
  const move = d.mvMove && objectId === seedPane ? d.mvMove : undefined
  const remote = d.mvRemote && objectId === seedPane ? { ...d.mvRemote, person: personOf(d.mvRemote.who) } : undefined
  const override = seedOverride && objectId === seedPane ? seedOverride : undefined
  const dragBlocked = !!drag && findLayout(drag.id, all)?.master !== (findLayout(drag.to, all)?.master ?? findMaster(drag.to, all)?.id)
  const status: MvStatus = d.mvStatus ?? "ready"
  const readOnly = !!editor.readonlyDegraded
  const m2 = !!d.mvM2
  const unsaved = !!d.mvUnsaved

  const facts: MvFacts = { status, readOnly, m2, unsaved, scope, master, paneLayout, targetName, usage, multiLayouts, selectedPh, variant }
  const toastCtx: MvToastCtx = {
    all,
    usage,
    masterUsage: usageOf(usageMap, master),
    usageBefore: (ids) => {
      const before = deckUsage(editor.deck, applied, all, removed.filter((x) => !ids.includes(x)), dataset)
      return [...new Set(ids.flatMap((id) => before.get(id) ?? []))].sort((a, b) => a - b)
    },
  }

  /** LayoutArt 的参数（画布与缩略图同一份：已删的占位符、普通形状、覆盖字号、远端改过的框、显示名） */
  const artOf = (id: string) => {
    const m = findMaster(id, masters)
    const l = m ? undefined : findLayout(id, all)
    const r = d.mvRemote && id === seedPane ? d.mvRemote : undefined
    const rph = r ? placeholdersOf(id, masters, d, seedPane, edits).find((p) => p.id === r.ph) : undefined
    return {
      master: (m?.id ?? l?.master ?? master.id) as MasterId,
      target: (m ? "master" : (l?.kind ?? "title-content")) as Target,
      omit: removedPhOf(d, id, edits),
      shapes: shapesOf(id),
      override: seedOverride && id === seedPane ? seedOverride : undefined,
      boxes: rph ? { [rph.id]: rph.box } : undefined,
      name: nameOf(id),
    }
  }

  const setSel = (k: ReturnType<typeof kindFor>) => editor.setSelection(k)
  /** 焦点在窗格里（⌘D、Delete、右键菜单交回的行）：窗格里的操作做完后焦点跟着新的选中行走 */
  const inPane = () => !!document.activeElement?.closest('[role="listbox"][aria-label="母版与版式"]')
  const rowAnchor = (id: string) => rowAnchorOf(id, isMaster(id))
  /** 提交之后把焦点交给画布上的某个锚点（画布在布局阶段接走；这之前焦点要掉到 body 时先交给画布） */
  const focusAfter = (anchor: string | null) => {
    const find = () => (anchor ? document.querySelector<HTMLElement>(`[data-v3-anchor="${anchor}"]`) : null) ?? document.querySelector<HTMLElement>('[data-v3-anchor="stage"]')
    endHold()
    releaseHold = holdFocusDuring(1000, find)
    scene.set(MV_KEYS.focus, { anchor, n: ((scene.get(MV_KEYS.focus) as { n?: number } | undefined)?.n ?? 0) + 1 })
  }
  const showToast = (seed: MvToast, undo?: Toast["undo"]) => {
    const n = ((scene.get(MV_KEYS.toastN) as number | undefined) ?? 0) + 1
    scene.set(MV_KEYS.toastN, n)
    scene.set(MV_KEYS.seedToastOff, true)
    setToast({ seed, n, undo })
  }
  const snapshot = (): NonNullable<Toast["undo"]> => ({ edits, pane, multi })
  /** 单选某个对象（窗格单击、多选卡片、删除后的落位）：清掉画布选中与多选，范围按选中项重算 */
  const pickId = (id: string) => {
    setPane(id)
    setMulti([])
    setPh(null)
    setShapeSel(null)
    setCaret(null)
    const s: Scope = isMaster(id) ? "master" : "layout"
    setScopeRaw(s)
    setSel(kindFor(s, undefined, 0))
  }
  /** 删掉一组版式（确认之后、或未被引用时直接删）：选中按 selectionAfterDelete 落位，给可撤销的轻提示 */
  const removeLayouts = (ids: string[], cause: "local" | "remote" = "local") => {
    const live = ids.filter((id) => !!findLayout(id, masters))
    if (!live.length) return
    const undo = snapshot()
    const used = toastCtx.usageBefore(live).length > 0
    setEdits({ ...edits, removed: [...edits.removed, ...live] })
    setConfirm(null)
    const next = selectionAfterDelete({ pane, all, removed }, live, cause)
    const fromPane = inPane() || !!document.activeElement?.closest('[role="alertdialog"], [role="dialog"], [role="menu"]')
    if (next !== pane || multi.length) pickId(next)
    showToast(used ? { kind: "reassigned", layout: live[0]!, layouts: live } : { kind: "deleted", layout: live[0], layouts: live }, undo)
    if (fromPane) focusAfter(rowAnchor(next))
  }

  return {
    ...facts,
    masters,
    all,
    pane,
    paneIsMaster,
    target,
    objectId,
    seedPane,
    usageMap,
    placeholders,
    shapes,
    selectedShape,
    caret,
    rename,
    drag,
    dragBlocked,
    move,
    remote,
    override,
    toast,
    confirm,
    toastCtx,
    isMaster,
    layoutOf: (id: string) => findLayout(id, masters),
    nameOf,
    usageFor,
    artOf,
    presenceOf: (layoutId: string): Person | undefined => {
      const p = d.mvPresence?.find((x) => x.layout === layoutId)
      return p ? personOf(p.who) : undefined
    },
    preserveOf: (masterId: string): boolean => preserve[masterId] ?? d.mvPreserve?.[masterId] ?? !!findMaster(masterId, all)?.imported,
    reason: (what: MvReasonWhat) => mvReasonOf(facts, what),

    /** 单击窗格里的母版或版式：单选、清掉画布选中，范围按选中项重算（R-35） */
    pick: pickId,
    /** ⌘ / Shift 单击：多选同一母版内的版式（不同母版的点了不算） */
    toggleMulti(id: string) {
      const l = findLayout(id, masters)
      if (!l) return
      const base = multi.length ? multi : paneLayout && paneLayout.master === l.master ? [paneLayout.id] : []
      const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id].filter((x) => findLayout(x, masters)?.master === l.master)
      setMulti(next)
      setPh(null)
      setShapeSel(null)
      setCaret(null)
      if (next.length === 1 && next[0]) setPane(next[0])
      setSel(kindFor(scope, undefined, next.length))
    },
    /** A′ 变体的范围分段（推荐画法里没有范围：调了也不变） */
    setScope(s: Scope) {
      if (!segmentOn || paneIsMaster) return
      setScopeRaw(s)
      setPh(null)
      setShapeSel(null)
      setCaret(null)
      setSel(kindFor(s, undefined, 0))
    },
    selectPh(id: string | null) {
      setPh(id)
      setShapeSel(null)
      setCaret(null)
      const p = id ? placeholders.find((x) => x.id === id) : undefined
      setSel(kindFor(scope, p, 0))
    },
    selectShape(id: string | null) {
      setShapeSel(id)
      setPh(null)
      setCaret(null)
      setSel(kindFor(scope, undefined, 0, !!id))
    },
    /** 焦点交给母版画布外框（窗格 Enter / Esc，D-07） */
    focusCanvas() {
      document.querySelector<HTMLElement>('[data-v3-anchor="stage"]')?.focus({ preventScroll: true })
    },
    /**
     * 「在母版中编辑」（选中继承项时检查器顶行的动作，E4）：选中母版行 + 用 phMatch 选中母版上同族同索引的占位符，焦点交给画布上那个占位符。
     * A′ 变体是「切换到母版」：只把范围切到母版（R-40：切换范围时清掉占位符选中）
     */
    editInMaster() {
      const p = selectedPh
      if (!p) return
      if (segmentOn) {
        setScopeRaw("master")
        setPh(null)
        setSel(kindFor("master", undefined, 0))
        focusAfter(null)
        return
      }
      const hit = phMatch({ type: p.type, index: p.idx }, placeholdersOf(master.id, masters, d, seedPane, edits))
      setPane(master.id)
      setMulti([])
      setShapeSel(null)
      setCaret(null)
      setScopeRaw("master")
      setPh(hit?.id ?? null)
      setSel(kindFor("master", hit, 0))
      focusAfter(hit ? `master-view.ph-${hit.id}` : null)
    },
    /** 「在普通视图查看」：退出并选中引用页（同右键「在普通视图查看引用页」，exit 的 slides） */
    viewInNormal(ids?: readonly string[]) {
      const pages = ids ? [...new Set(ids.flatMap((id) => usageFor(id)))].sort((a, b) => a - b) : usage
      if (!pages.length) return
      editor.masterView.exit("goto", { slides: pages })
    },
    /**
     * 双击可编辑的占位符（或选中后按 Enter，插入符在文本末尾，MasterStage）：进入提示文本编辑，插入符落在 level 那一行（M3；M2、降权、继承项不进入）。
     * 不进入时返回原因（字段那一条，同检查器不可用字段的句子）：双击与 Enter 都拿它写画布外框的读屏播报区，同一判法、同一句子（2026-10-31 总编排裁定第 9 条 ②）；
     * 进入了或没有这个占位符时返回 undefined
     */
    startText(phId: string, level: number): string | undefined {
      const p = placeholders.find((x) => x.id === phId)
      if (!p) return undefined
      const why = mvReasonOf({ ...facts, selectedPh: p }, "field")
      if (why) return why
      setPh(p.id)
      setShapeSel(null)
      setCaret({ ph: p.id, level: Math.max(1, level) })
      setSel(kindFor(scope, p, 0))
      return undefined
    },
    setCaretLevel(level: number) {
      if (caret) setCaret({ ...caret, level: Math.max(1, level) })
    },
    exitText() {
      setCaret(null)
    },
    startRename(id: string) {
      if (mvReasonOf(facts, "rename")) return
      const m = findMaster(id, masters)
      const l = m ? undefined : findLayout(id, masters)
      if (!m && !l) return
      setRename({ id, value: m ? m.name : (l?.name ?? "") })
    },
    setRenameValue(value: string) {
      if (rename) setRename({ ...rename, value })
    },
    /** 提交改名：有错误时不提交、返回错误；空串还原原名 */
    commitRename(): string | undefined {
      if (!rename) return undefined
      const m = findMaster(rename.id, masters)
      const l = m ? undefined : findLayout(rename.id, masters)
      const target = m ?? l
      if (!target) {
        setRename(null)
        return undefined
      }
      const err = renameErrorOf(rename.value, target, masters)
      if (err) return err
      const v = rename.value.trim()
      if (v && v !== target.name) setEdits({ ...edits, names: { ...edits.names, [rename.id]: v } })
      setRename(null)
      return undefined
    },
    cancelRename() {
      setRename(null)
    },
    /**
     * 插入版式（「新建版式 ▾ › 插入版式」、「+」、⌘M、窗格行的右键菜单）：在所选版式之后插入一个空的「仅标题」版式（名称空 → 「未命名版式 n」）并选中；选中母版时插到该母版末尾。
     * 焦点在窗格里（⌘M）或 opts.fromRow（窗格行上打开的右键菜单：菜单经 Portal 挂在窗格外，执行时焦点在菜单里）时，做完后焦点跟着新的选中行——
     * 窗格是「选中跟随焦点」的单一 Tab 停靠点，焦点不留在已不选中的原行上（同 ⌘M / ⌘D 与同一菜单里的「删除版式」；2026-10-31 修复第 1 轮）。
     * 「新建版式 ▾」是锚在自己按钮上的菜单，关上后焦点照常回到这枚按钮，不在此列
     */
    insertLayout(opts?: { fromRow?: boolean }) {
      if (mvReasonOf(facts, "newLayout")) return
      const k = edits.added.length + 1
      let id = `${master.id}-new-${k}`
      for (let i = k + 1; findLayout(id, all); i++) id = `${master.id}-new-${i}`
      const def: LayoutDef = { id, master: master.id, kind: "title-only", name: "", pages: [] }
      const fromPane = !!opts?.fromRow || inPane()
      setEdits({ ...edits, added: [...edits.added, { def, after: paneIsMaster ? null : (paneLayout?.id ?? null) }] })
      pickId(id)
      if (fromPane) focusAfter(`master-view.layout-${id}`)
    },
    /** 复制所选版式（⌘D、右键「复制版式」）：「〈名〉 副本」（同母版里重名时加序号）插在原版式之后并选中；焦点的去向同 insertLayout（opts.fromRow：由窗格行的右键菜单发起） */
    duplicateLayout(opts?: { fromRow?: boolean }) {
      if (mvReasonOf(facts, "duplicate") || !paneLayout) return
      const base = `${displayNameOf(paneLayout, masters)} 副本`
      const taken = (n: string) => master.layouts.some((l) => displayNameOf(l, masters) === n)
      let name = base
      for (let i = 2; taken(name); i++) name = `${base} ${i}`
      let id = `${paneLayout.id}-copy-1`
      for (let i = 2; findLayout(id, all); i++) id = `${paneLayout.id}-copy-${i}`
      const def: LayoutDef = { ...paneLayout, id, name, pages: [] }
      const fromPane = !!opts?.fromRow || inPane()
      setEdits({ ...edits, added: [...edits.added, { def, after: paneLayout.id }] })
      pickId(id)
      if (fromPane) focusAfter(`master-view.layout-${id}`)
    },
    /**
     * 删除所选（Delete、右键「删除」）：被引用的先确认（confirm 键，对话框件读它），未引用的直接删 + 可撤销轻提示，多选合并判定（R-63、R-64）；
     * 母版一律先确认（只剩一个母版时不可删）
     */
    deleteSelection() {
      if (mvReasonOf(facts, "delete")) return
      if (paneIsMaster) {
        if (masters.length > 1) setConfirm({ kind: "master", ids: [master.id] })
        return
      }
      const ids = multiLayouts.length > 1 ? multiLayouts.map((l) => l.id) : paneLayout ? [paneLayout.id] : []
      if (!ids.length) return
      if (ids.some((id) => usageFor(id).length)) setConfirm({ kind: ids.length > 1 ? "layouts" : "layout", ids })
      else removeLayouts(ids)
    },
    /** 确认对话框的「删除」 */
    confirmDelete() {
      if (!confirm) return
      if (confirm.kind !== "master") removeLayouts(confirm.ids)
      else setConfirm(null)
    },
    cancelConfirm() {
      setConfirm(null)
    },
    removeLayouts,
    /** 窗格一行的锚点 */
    rowAnchor,
    /** 提交之后把焦点交给窗格里的这一行（改名提交 / 取消、重排之后：行重新排过，焦点不经过 body） */
    focusRow(id: string) {
      focusAfter(rowAnchor(id))
    },
    /**
     * Shift + ↑ / ↓ 扩展多选（R-34，只限同一母版）：ids 是锚点行到焦点行之间的版式（窗格按视觉顺序算好传进来）；
     * 只剩一个时回到单选它
     */
    selectRange(ids: readonly string[]) {
      const first = ids[0] ? findLayout(ids[0], masters) : undefined
      if (!first) return
      const same = ids.filter((id) => findLayout(id, masters)?.master === first.master)
      if (same.length < 2) {
        pickId(first.id)
        return
      }
      setMulti([...same])
      setPh(null)
      setShapeSel(null)
      setCaret(null)
      setSel(kindFor(scope, undefined, same.length))
    },
    /**
     * 检查器「名称」字段的提交（与窗格就地改名同一套规则 renameErrorOf）：有错时不提交、返回错误；空串或没改不提交（字段还原原名）
     */
    renameTo(id: string, value: string): string | undefined {
      const target = findMaster(id, masters) ?? findLayout(id, masters)
      if (!target || mvReasonOf(facts, "rename")) return undefined
      const err = renameErrorOf(value, target, masters)
      if (err) return err
      const v = value.trim()
      if (v && v !== target.name) setEdits({ ...edits, names: { ...edits.names, [id]: v } })
      return undefined
    },
    /** 「↺ 重置为母版值」：种子里覆盖的字号不再生效 */
    resetOverride() {
      setOvOff(true)
    },
    /** 打开窗格某一行的右键菜单（x / y 是行内的相对位置） */
    openMenu(id: string, x: number, y: number) {
      const cur = scene.get(MV_KEYS.ctx) as CtxMenu | null | undefined
      scene.set(MV_KEYS.ctx, { id, x, y, n: (cur?.n ?? 0) + 1, open: true } satisfies CtxMenu)
    },
    /** 重排（拖放、⌘⇧↑ / ↓）：只在同一母版内 */
    reorder(id: string, to: string, at: "before" | "after") {
      const a = findLayout(id, masters)
      const b = findLayout(to, masters)
      if (!a || !b || a.master !== b.master || a.id === b.id) return
      setEdits({ ...edits, moves: [...edits.moves, { id, to, at }] })
    },
    setDrag,
    setPreserve(masterId: string, value: boolean) {
      setPreserveMap({ ...preserve, [masterId]: value })
    },
    showToast,
    dismissToast() {
      setToast(null)
      scene.set(MV_KEYS.seedToastOff, true)
    },
    /**
     * 演示种子里那条轻提示的「撤销」：删掉的版式 / 占位符回来（data.mvRemoved / mvRemovedPh 里的那几个），选中回到删除之前（mvSelBefore）；
     * 别的种子（提交、超限、他人删除）只是收起
     */
    undoSeed() {
      const t = d.mvToast
      // 恢复选中之前结束焦点保持（同 undoToast）
      endHold()
      setToast(null)
      scene.set(MV_KEYS.seedToastOff, true)
      if (!t) return
      if (t.kind === "deleted" || t.kind === "reassigned") {
        const ids = t.layouts ?? (t.layout ? [t.layout] : [])
        setEdits({ ...edits, restored: [...edits.restored, ...ids] })
        const back = d.mvSelBefore && ids.includes(d.mvSelBefore) ? d.mvSelBefore : ids[0]
        if (back) pickId(back)
      } else if (t.kind === "ph-removed") {
        const gone = d.mvRemovedPh?.[seedPane] ?? []
        if (gone.length) setEdits({ ...edits, phRestored: { ...edits.phRestored, [seedPane]: [...(edits.phRestored[seedPane] ?? []), ...gone] } })
      }
    },
    /**
     * 轻提示的「撤销」：把版式清单、窗格选中与多选恢复到改动之前（样张不做真正的撤销栈）。
     * 先结束删除时起的焦点保持：按钮随轻提示卸载后焦点照 50/16 §8 交给画布（kit Toast 下一帧交），删除后 1 秒内、1 秒后按结果相同
     */
    undoToast() {
      const u = toast?.undo
      endHold()
      setToast(null)
      scene.set(MV_KEYS.seedToastOff, true)
      if (!u) return
      setEdits(u.edits)
      setPane(u.pane)
      setMulti(u.multi)
      setPh(null)
      setShapeSel(null)
      setCaret(null)
      const s: Scope = findMaster(u.pane, mastersOf(d, u.edits)) ? "master" : "layout"
      setScopeRaw(s)
      setSel(kindFor(s, undefined, u.multi.length))
    },
  }
}

export type MasterView = ReturnType<typeof useMasterView>
