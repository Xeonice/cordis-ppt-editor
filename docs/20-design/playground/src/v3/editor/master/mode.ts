import { useLayoutEffect, useRef, useSyncExternalStore } from "react"
import { PanelsTopLeft } from "lucide-react"
import type { MainMenuOptions } from "../../kit/mainMenu"
import { useV3Params } from "../../params"
import type { EditorConfig } from "../../scenarios/types"
import type { Breakpoint } from "../breakpoint"
import { useEditor, useEditorMaybe } from "../context"
import type { SceneStore } from "../scene"
import type { MasterEntry, MasterViewMode } from "./types"

/**
 * 母版视图的入口判定、原因文案、入口守卫与会话记忆的读写（2026-10-28，母版视图改版第一步；前端 50/11 §2「会话记忆」、§3）。
 * masterEntryOf 是 50/11 §3 masterEntryState 的样张版（带上原因文案）；产品里原因由 ui-core explainWhen 给出，命令面板、tooltip 与轻提示共用同一组 i18n 键。
 */

/* ------------------------------------------------------------------ 原因文案（03-26 §1.1；由 scenarios/narrow/data.ts 迁入，原处改为转出） */

/**
 * 紧凑与仅查看形态下母版视图入口的不可用原因：不是桌面完整形态即不可进入，提示「在更大窗口中编辑」，与仅查看形态顶部的说明同一口径
 * （rulings §4.25 TB-44、TB-16；03-02 §2.4、§5a.1；原写「需要 ≥ 1024 宽度」作废）
 */
export const MASTER_REASON = "在更大窗口中编辑"

/**
 * 嵌入形态 E（iframe 里，URL 带 embedded=1）的同一处原因：容器尺寸由宿主定，「在更大窗口中编辑」用户可能照做不了，
 * 改写「当前区域太窄，暂不可用」（rulings §4.25 DS-112）；不在嵌入里时仍是 MASTER_REASON。
 * 触控设备（平板，触控、≥ 640）上的同类原因一律写「在电脑上编辑」（TABLET_MASTER_REASON，rulings §4.25 TB-136，含外接键盘按母版视图等快捷键时的提示，TB-44、TB-125 细化），
 * 嵌入又是平板时也以它为准（TB-159：嵌入只改写「在更大窗口中编辑」这一句）。手机（< 640）不论是否触控都按窗口窄写：MASTER_REASON，嵌入里 EMBED_MASTER_REASON
 * （TB-163：「触控设备」只指平板，先看窗口窄、再看触控）
 */
export const EMBED_MASTER_REASON = "当前区域太窄，暂不可用"

/** 平板（触控、≥ 640，仅查看形态）：外接键盘按 ⌥⌘M、从命令面板请求时的原因（TB-136、TB-159） */
export const TABLET_MASTER_REASON = "在电脑上编辑"

/** 评审 / 只读浏览时的原因（与主菜单其余项同一口径，kit/mainMenu.tsx mainMenuItems 的 roReason） */
export const MODE_MASTER_REASON = { review: "评审模式下不可用", viewer: "只有查看权限" } as const

/**
 * 母版视图的图标（I-03；2026-10-30 第二步规格 §3.10 第 1 条）：上下文条、检查器「编辑版式」、命令面板与背景分段「跟随母版」共用这一处。
 * 取命令面板「母版视图」现用的那个（command-palette/commands.ts），普通视图零变化；「更换版式…」用的版式图标不拿来用，免得「编辑版式」读成「换版式」。
 */
export const MASTER_VIEW_ICON = PanelsTopLeft

/* ------------------------------------------------------------------ 形态 */

/** 宿主眼里的形态：desktop（底座外壳只有桌面画法）· compact · narrow（仅查看） */
export type MasterForm = Breakpoint

/**
 * 形态的取法（前端 50/11 §3 第 3 条）：状态的 data.form 为 compact → compact；以 narrow 开头 → narrow；为 auto → 真实视口（useBreakpoint）；
 * 都不是 → desktop（data.form 是 narrow 场景起的约定，评论、快捷键等借用紧凑外框的状态同一个键）
 */
export function masterFormOf(setting: unknown, viewport: Breakpoint): MasterForm {
  if (setting === "compact") return "compact"
  if (typeof setting === "string" && setting.startsWith("narrow")) return "narrow"
  if (setting === "auto") return viewport
  return "desktop"
}

const Q_SMALL = "(max-width: 639.98px)"
const Q_TOUCH = "(pointer: coarse)"

function subscribeTraits(cb: () => void): () => void {
  if (typeof matchMedia !== "function") return () => undefined
  const qs = [matchMedia(Q_SMALL), matchMedia(Q_TOUCH)]
  for (const q of qs) q.addEventListener("change", cb)
  return () => {
    for (const q of qs) q.removeEventListener("change", cb)
  }
}

function traitsSnapshot(): string {
  if (typeof matchMedia !== "function") return "00"
  return `${matchMedia(Q_SMALL).matches ? 1 : 0}${matchMedia(Q_TOUCH).matches ? 1 : 0}`
}

/** 原因要分开写的两个视口特征（随窗口与指针类型变化）：窗口窄（< 640）、触控（pointer: coarse） */
export function useViewportTraits(): { small: boolean; touch: boolean } {
  const s = useSyncExternalStore(subscribeTraits, traitsSnapshot, () => "00")
  return { small: s[0] === "1", touch: s[1] === "1" }
}

/** 不是桌面形态时的原因：先看窗口窄、再看触控、最后是紧凑（rulings §4.25 TB-163）；嵌入只改写「在更大窗口中编辑」那一句（DS-112、TB-159） */
export function formReasonOf(form: MasterForm, t: { small: boolean; touch: boolean; embedded: boolean }): string | undefined {
  if (form === "desktop") return undefined
  if (t.small) return t.embedded ? EMBED_MASTER_REASON : MASTER_REASON
  if (t.touch) return TABLET_MASTER_REASON
  return t.embedded ? EMBED_MASTER_REASON : MASTER_REASON
}

/* ------------------------------------------------------------------ 入口判定 */

export interface MasterEntryInput {
  /** 已在母版视图里：恒为可用（降权或缩到紧凑后仍能退出，50/11 §3「实现上」段） */
  on: boolean
  /** 状态的 masterView 配置：false = 这个状态没有母版入口 */
  config: EditorConfig["masterView"]
  /** 有没有登记母版实现（registerMasterView） */
  implemented: boolean
  /** toolbar.collapse：工作区被整屏换掉（阻断页、查看器壳） */
  collapse: boolean
  form: MasterForm
  /**
   * 状态显式写的原因（rail.menu.master.reason：借用紧凑外框的状态写的「在更大窗口中编辑」）：说的是形态，排在模式与权限、外壳的形态守卫之后（masterEntryOf 第 4 条）；
   * 外壳不在时（这些状态的网格视图没有紧凑外壳）由它说明原因
   */
  explicitReason?: string
  mode: "edit" | "review" | "viewer"
  /** rail.readonlyDegraded（会话内被降权，「需要编辑权限」） */
  readonlyDegraded?: string
  /** 场景组件挂载期间声明的守卫（useMasterEntryGuard），按挂载先后；form 为真的是外壳声明的形态（masterEntryOf 第 3 条），其余是场景条件（第 5 条） */
  guards: MasterGuard[]
  /** inspector.locked（打开中「文档打开后可用」等：整栏不可用的那一条原因） */
  locked?: string
  small: boolean
  touch: boolean
  embedded: boolean
}

/**
 * 能不能进入母版视图（50/11 §3 masterEntryState 的样张版，判定顺序以它为准：模式先于权限、权限先于形态，R-12）：按顺序取第一条命中——
 *   1. 没有入口（silent，不提示、命令面板不列）：masterView: false、没有母版实现、silent 守卫在场（放映进行中），或 toolbar.collapse（阻断页、查看器壳；
 *      仅查看形态 data.form narrow 例外：这一形态没有主菜单，但外接键盘按 ⌥⌘M 要说明原因，03-26 §1.1）；
 *      collapse 的状态里有外壳声明了带原因的守卫时同样例外——手机 / 平板的仅查看外壳（comments/phone.tsx 的 PhoneViewer、TabletViewer，useViewOnlyMasterGuard）
 *      没写 data.form，由外壳挂载期间按设备说明原因（2026-10-28 第一步修复第 1 轮，复验 B2）；
 *   2. 模式与权限（50/11 §3 第 1、2 条）：评审「评审模式下不可用」、查看者「只有查看权限」，再看会话内被降权 rail.readonlyDegraded（「需要编辑权限」）；
 *   3. 外壳声明的形态（form 守卫：紧凑外壳 CompactStage、手机 / 平板仅查看外壳）——外壳知道自己画在嵌入里还是平板上，句子按 03-26 §1.1（DS-112、TB-136）；
 *   4. 状态显式写的原因（rail.menu.master.reason，同样说的是形态；外壳不在时，如借用紧凑外框的状态在网格视图里，由它说明）；
 *   5. 场景守卫的原因（如版本历史面板开着「关闭版本历史后可用」）；
 *   6. inspector.locked（打开中「文档打开后可用」）；
 *   7. data.form 给的形态（formReasonOf：narrow 场景的仅查看形态、data.form 为 auto 时按真实视口）。
 * 主菜单（masterMenuOption 以这里的原因为准）、命令面板与 ⌥⌘M 的轻提示取同一条（50/11 §3「实现上」段：同一组键、同一优先级，R-13）；
 * 同一状态里切换编辑 / 评审（TB-83）后三处一起变。判断只看状态配置与运行时事实，不按状态 id 区分。
 * 2026-10-29 第一步修复第 4 轮：原来第 2 条是「显式原因 ?? 锁定原因」，显式原因排在模式之前，借用紧凑外框的状态
 *   切到评审后三处都写「在更大窗口中编辑」；外壳的形态守卫原来与场景守卫一起按挂载先后排在显式原因之后，手写 embedded=1 打开这些状态时，⌥⌘M 与命令面板写显式的那句、
 *   菜单写「当前区域太窄，暂不可用」。载入时没有哪个状态同时是紧凑形态又是评审 / 查看者 / 降权，不在嵌入里时外壳守卫与显式原因是同一句，载入画面不变。
 */
export function masterEntryOf(i: MasterEntryInput): MasterEntry {
  if (i.on) return { ok: true }
  if (i.config === false || !i.implemented || i.guards.some((g) => g.silent)) return { ok: false, silent: true }
  if (i.collapse && i.form !== "narrow" && !i.guards.some((g) => !!g.reason)) return { ok: false, silent: true }
  const reason =
    (i.mode === "review" || i.mode === "viewer" ? MODE_MASTER_REASON[i.mode] : i.readonlyDegraded) ||
    i.guards.find((g) => g.form && g.reason)?.reason ||
    i.explicitReason ||
    i.guards.find((g) => !g.form && g.reason)?.reason ||
    i.locked ||
    formReasonOf(i.form, i)
  return reason ? { ok: false, reason } : { ok: true }
}

/**
 * 主菜单「视图 › 母版视图」条目的缺省选项（底座 MainMenu、网格与紧凑胶囊、场景里静态打开的 MainMenuLayer 同一套，设计 03-26 §1.1），以宿主的 entry 为准：
 * 母版视图里一律由宿主给「关闭母版视图」；不在母版视图里时可进入给 onToggle，不可进入写 entry 的原因——与 ⌥⌘M 的轻提示、命令面板同一条、同一优先级（50/11 §3、R-13）。
 * 外壳或状态显式传的 options.master 只补宿主没给的字段：宿主没有入口（silent）时条目照旧；宿主可进入时它带的原因留着——只在外壳的形态守卫登记之前那一下渲染里用得上
 * （紧凑外壳与嵌入的静态菜单显式写的就是外壳守卫的同一句，useMasterReason），守卫一登记宿主就给出同一句。
 * 2026-10-29 第一步修复第 4 轮（复验 R4-B1）：原来显式传的逐字段盖在宿主的缺省上（{ ...host, ...explicit }），紧凑外壳显式写的形态原因盖住了宿主的「评审模式下不可用」
 */
export function masterMenuOption(mv: MasterViewMode | undefined, explicit?: MainMenuOptions["master"]): MainMenuOptions["master"] {
  if (!mv) return explicit
  if (mv.on) return { active: true, onToggle: () => mv.exit("menu") }
  const host: MainMenuOptions["master"] = mv.entry.ok ? { onToggle: () => void mv.enter("menu") } : mv.entry.silent ? undefined : { reason: mv.entry.reason }
  return host || explicit ? { ...explicit, ...host } : undefined
}

/* ------------------------------------------------------------------ 入口守卫 */

/**
 * 场景组件声明的「现在不能进入」：reason 写在菜单与轻提示上；silent = 这一刻没有编辑器外壳（放映进行中），不提示；
 * form = 这条说的是形态（外壳声明「这里不是桌面完整形态」：紧凑外壳、手机 / 平板仅查看外壳），排在模式与权限之后、状态显式写的原因与场景条件之前（masterEntryOf 第 3 条）
 */
export interface MasterGuard {
  reason?: string
  silent?: boolean
  form?: boolean
}

interface GuardBag {
  list: Map<number, MasterGuard>
  subs: Set<() => void>
  ver: number
  subscribe: (cb: () => void) => () => void
  snapshot: () => number
}

/** 守卫登记在本次挂载的场景仓上（换状态即清空），做法同 useEditorCommand */
const BAGS = new WeakMap<SceneStore, GuardBag>()
let seq = 0

function bagOf(store: SceneStore): GuardBag {
  let b = BAGS.get(store)
  if (!b) {
    const bag: GuardBag = {
      list: new Map(),
      subs: new Set(),
      ver: 0,
      subscribe: (cb) => {
        bag.subs.add(cb)
        return () => {
          bag.subs.delete(cb)
        }
      },
      snapshot: () => bag.ver,
    }
    BAGS.set(store, bag)
    b = bag
  }
  return b
}

function bump(b: GuardBag) {
  b.ver += 1
  for (const fn of [...b.subs]) fn()
}

/**
 * 场景组件挂载期间声明「现在不能进入母版视图」（reason 为假且不是 silent 时不登记）：
 *   useMasterEntryGuard(vh.open ? "关闭版本历史后可用" : false)        版本历史面板开着（场景条件）
 *   useMasterEntryGuard("放映中", { silent: true })                    放映进行中（没有编辑器外壳）
 *   useMasterEntryGuard(reason, { form: true })                        外壳声明的形态（紧凑外壳、仅查看外壳）：先于状态显式写的原因与场景条件
 * 布局阶段登记（首帧之前），菜单与命令面板第一次画出来就是这条原因；已在母版视图里时不影响退出。
 */
export function useMasterEntryGuard(reason: string | false | null | undefined, opts: { silent?: boolean; form?: boolean } = {}) {
  const store = useEditorMaybe()?.scene
  const silent = !!opts.silent
  const form = !!opts.form
  useLayoutEffect(() => {
    if (!store || (!reason && !silent)) return
    const bag = bagOf(store)
    const id = ++seq
    bag.list.set(id, { reason: reason || undefined, silent, form })
    bump(bag)
    return () => {
      bag.list.delete(id)
      bump(bag)
    }
  }, [store, reason, silent, form])
}

/**
 * 仅查看形态的外壳（左栏、检查器、工具条都不渲染，状态写 toolbar.collapse）挂载期间声明「现在不能进入母版视图」，原因按为什么进了这一形态写
 * （03-26 §1.1「仅查看形态」一行、50/11 §3 narrow 一行：外接键盘按 ⌥⌘M 或从命令面板请求时不切换、说明原因）——
 *   phone（窗口窄 < 640，不论是否触控，TB-163）：「在更大窗口中编辑」，嵌入里「当前区域太窄，暂不可用」（DS-112）；
 *   tablet（触控、≥ 640）：「在电脑上编辑」，嵌入里也是（TB-136、TB-159），与平板外壳顶部状态行同一口径（TB-125）。
 * 设备取外壳自己演示的那一种（状态的 data.device），不看真实视口：样张的外壳在任何窗口里都画成那一种形态，原因跟着外壳走、与它的状态行一致。
 * 原因的先后仍由 formReasonOf 一处给出。有了这条带原因的守卫，宿主不再把 collapse 的外壳当成「没有编辑器外壳」静默（masterEntryOf 第 1 条），
 * 命令面板也随之挂上（⌘K 原地打开，「母版视图」置灰写同一原因）。2026-10-28 第一步修复第 1 轮（复验 B2）
 * 说的是形态（form 守卫，masterEntryOf 第 3 条）：查看者的外壳仍先写「只有查看权限」（第 2 条）。2026-10-29 第一步修复第 4 轮标明
 */
export function useViewOnlyMasterGuard(device: "phone" | "tablet") {
  const { embedded } = useV3Params()
  useMasterEntryGuard(formReasonOf("narrow", { small: device === "phone", touch: device === "tablet", embedded }), { form: true })
}

/** 宿主读当前的守卫（随登记变化重新渲染） */
export function useMasterGuards(store: SceneStore): MasterGuard[] {
  const bag = bagOf(store)
  useSyncExternalStore(bag.subscribe, bag.snapshot, bag.snapshot)
  return [...bag.list.values()]
}

/** 场景组件里读宿主的模式接口（= useEditor().masterView） */
export function useMasterViewMode(): MasterViewMode {
  return useEditor().masterView
}

/* ------------------------------------------------------------------ 进出时收起另一视图的浮动层 */

/**
 * 进出母版视图时收起另一视图的浮动层（rulings §4.25 TB-204；DS-158 进入时一起收起，DS-169 往返后不再弹出）。
 * 画布浮动层（状态的 canvasOverlay 与 layers 里的件、宿主常驻的轻提示）在两种视图里位置不变、切换时不卸载，开着没有由各自记着；
 * 用这个钩子声明「这一层现在开着」（active）与「怎么收起」（dismiss），宿主进出时由它自己收起：
 *   - 从普通视图进入（masterView.session 加 1）：这时开着的这一层是普通视图里的，收起，母版视图里不画；
 *   - 退出母版视图：这时开着的这一层是在母版视图里打开的（如 Mod+F 再开的查找面板，DS-158 归母版视图），同样收起，退出后普通视图不再弹出。
 * 挂在哪个视图：取宿主上下文（masterView 的 on 与 session）在这一层上一次提交时的样子，记在这一层自己身上，不另设模块级记录；
 * 不在编辑器里（开始页等页面上的同一个件）时没有 masterView，什么都不做。
 * 首次挂载不触发：载入即开着的演示态照常开着；这次切换里才挂上的件属于新视图（母版视图自己的轻提示、普通视图重新挂上的区域），同样不触发。
 * 在布局阶段、进出的同一次提交里判（不靠计时器）：收起之后才绘制，新视图的第一帧里就没有它。
 * dismiss 只管收起：焦点由宿主在同一次提交里交给落点（进入：窗格选中行；退出：画布），这里不再交还焦点（不调 rescueFocus、focusBack 一类）。
 * 钩子要写在件里提前返回之前：
 *   useDismissOnMasterToggle(s.open, () => set({ open: false }))     查找面板（开关在场景仓）
 *   useDismissOnMasterToggle(!!digits, () => setDigits(""))         跳页提示条（开关在件自己的状态里）
 */
export function useDismissOnMasterToggle(active: boolean, dismiss: () => void) {
  const mv = useEditorMaybe()?.masterView
  const on = !!mv?.on
  const session = mv?.session ?? 0
  const seen = useRef({ on, session })
  useLayoutEffect(() => {
    const was = seen.current
    if (was.on === on && was.session === session) return
    seen.current = { on, session }
    if (active) dismiss()
    // 只在进出的那一次提交里判；active 与 dismiss 取这次渲染的值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, session])
}

/* ------------------------------------------------------------------ 会话记忆：滚动位置 */

/**
 * 记滚动的几块区域：左栏、网格视图的画布列，以及状态声明的整栏面板（保真报告、插件面板的整栏形态等）。
 * 整栏面板进入时不关、只在母版视图里不画（rulings §4.25 DS-162：恢复到进入前的样子），随检查器换掉而卸下，退出后重新挂上、滚动回到初值，所以同左栏一样记下再写回
 */
const REGION_ROOT = { rail: '[data-v3-anchor="rail"]', grid: '[data-v3-anchor="canvas"]', takeover: "[data-v3-takeover]" } as const

/** 区域里的纵向滚动区：第一个 overflow-y 为 auto / scroll 的后代（左栏是缩略图列表，网格视图的画布列里是幻灯片网格，整栏面板是标题行下面的内容区）。不加标记、不改画面 */
function scrollAreaOf(region: keyof typeof REGION_ROOT): HTMLElement | null {
  const root = document.querySelector(REGION_ROOT[region])
  if (!root) return null
  for (const el of root.querySelectorAll<HTMLElement>("*")) {
    const o = getComputedStyle(el).overflowY
    if (o === "auto" || o === "scroll") return el
  }
  return null
}

/** 进入时记下左栏缩略图列表 / 网格 / 整栏面板内容区的滚动位置（网格只在网格视图里读：单页视图的画布列里第一个滚动区是备注框；整栏面板只在单页视图里有） */
export function readScroll(region: keyof typeof REGION_ROOT): number {
  return scrollAreaOf(region)?.scrollTop ?? 0
}

/** 退出后（提交之后、绘制之前）还原 */
export function writeScroll(region: keyof typeof REGION_ROOT, top: number) {
  const el = scrollAreaOf(region)
  if (el && top > 0) el.scrollTop = top
}

/**
 * 画布本身（[data-v3-anchor="stage"]）的滚动：放大到超过适应窗口时画布自己就是滚动区（view-zoom 的固定比例缩放，overflow auto、原生滚动条）；
 * 适应窗口的画布不滚动，读出来是 0, 0。进入时（单页视图里）读；母版视图里普通画布卸载，退出时重新挂载、滚动回到初值，提交之后、绘制之前写回。
 * 不加标记、不改画面。2026-10-29 第一步修复第 4 轮（复验 R4-B2）
 */
const STAGE = '[data-v3-anchor="stage"]'

export function readStageScroll(): { left: number; top: number } {
  const el = document.querySelector<HTMLElement>(STAGE)
  return { left: el?.scrollLeft ?? 0, top: el?.scrollTop ?? 0 }
}

/** 只在进入前滚动过时写（没滚动过、适应窗口的画布不碰）；画布这时比原来小时浏览器按可滚动范围截断 */
export function writeStageScroll(s: { left: number; top: number }) {
  if (s.left <= 0 && s.top <= 0) return
  const el = document.querySelector<HTMLElement>(STAGE)
  if (!el) return
  el.scrollLeft = s.left
  el.scrollTop = s.top
}
