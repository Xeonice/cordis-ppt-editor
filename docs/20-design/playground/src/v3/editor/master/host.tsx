import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react"
import { BannerStack } from "../../kit/Banner"
import { canvasFocusTarget, holdFocusDuring, openOverlays, overlayOpen, rescueFocus, takeCanvasEscape } from "../../kit/layer"
import { Toast, Toasts } from "../../kit/Toast"
import type { EditorConfig, RegionDefaults } from "../../scenarios/types"
import type { EditorCtx } from "../context"
import type { SceneStore } from "../scene"
import type { MasterViewImpl, MasterViewMode } from "./types"

/**
 * 宿主在母版视图里的几件事（2026-10-28，母版视图改版第一步；前端 50/11 §2）：
 *   MasterModeKeys   ⌥⌘M 与 Esc 逐层（document 捕获阶段，不显示任何东西）；
 *   MasterModeToast  ⌥⌘M 不可用时的轻提示「母版视图：〈原因〉」（只在有提示时渲染）；
 *   masterRegions()  母版视图里的区域决策与横幅叠放：区域一律用母版实现的件，形态外框（masterView.frameRegions）照常套在外面，母版横幅常驻在上。
 * 产品里对应 ui-react ui/shell/EditorShell.tsx（视图模式外框）+ slide-ui application/master-view.ts（Mod+Alt+M 与 Esc 逐级链的最后一级，50/10 §7.1）。
 */

/* ------------------------------------------------------------------ 区域与横幅 */

/**
 * 母版视图里的区域：Rail / Inspector / Toolbar 拿底座缺省渲染作 base（可复用 240 左栏顶部与检查器外框），Stage 整块换掉；网格视图不画网格，按单页结构画。
 * 状态写了 masterView.frameRegions（narrow 的形态外框）时，它的 regions 照常调用，只是拿到的 defaults 换成母版区域；其余状态的 regions 在母版视图里一律不用。
 * 横幅：状态没有横幅时只画母版横幅；有横幅（离线、降权…）时 BannerStack 叠放，母版横幅常驻在上（TB-14）。
 */
export function masterRegions({ impl, defaults, cfg, ctx, banner }: { impl: MasterViewImpl; defaults: RegionDefaults; cfg: EditorConfig; ctx: EditorCtx; banner: ReactNode }) {
  const md: RegionDefaults = {
    leftRail: (over) => <impl.Rail base={defaults.leftRail} over={over} />,
    stage: () => <impl.Stage />,
    inspector: (over) => <impl.Inspector base={defaults.inspector} over={over} />,
    toolbar: (over) => <impl.Toolbar base={defaults.toolbar} over={over} />,
    // 母版视图没有网格形态（03-26 §6.8），宿主按单页结构画，不会用到
    grid: () => <impl.Stage />,
  }
  const frame = !!cfg.masterView && !!cfg.masterView.frameRegions
  const region = (name: keyof RegionDefaults): ReactNode => {
    const custom = frame ? cfg.regions?.[name] : undefined
    return custom ? custom(ctx, md) : md[name]()
  }
  const has = banner !== null && banner !== undefined && banner !== false
  return {
    defaults: md,
    region,
    banner: has ? (
      <BannerStack>
        <impl.Banner />
        {banner}
      </BannerStack>
    ) : (
      <impl.Banner />
    ),
  }
}

/* ------------------------------------------------------------------ 轻提示 */

/**
 * ⌥⌘M 不可用时的轻提示（rulings §4.25 DS-163：「母版视图：〈原因〉」，与命令面板执行不可用命令时的播报同一写法；3.5 秒（50/10 §11 规则 8 的缺省时长），宿主计时；
 * 同一原因连按不另出一条、不重复播报——条目不重新挂载，播报区里的字不变，50/11 §3、50/16 §6.4）。放在画布列里，落点同其他轻提示（kit Toasts，工具条上方 12）。
 * 与状态里已在显示的轻提示叠放（50/10 §11「多条自下而上叠放、新的在下」）：各功能的轻提示各挂一叠、落点相同，这一条是最新的——画在最下面，
 * 显示期间在画布列 main 上写 --v3-toast-push（这一叠的高度 + 间距 8），缺省落点的其余几叠整体上移（kit Toasts），收起即删去。
 * 2026-10-29 补完（复验 R1-N4：原来与 version-history.restored 这类状态已有的轻提示完全重叠）。
 * 之后变成可以进入时，宿主进入的同时清掉这一条（DS-163，Editor.tsx enterMaster），不带进母版视图。
 */
export function MasterModeToast({ toast }: { toast: { reason: string } | null }) {
  const box = useRef<HTMLDivElement>(null)
  const reason = toast?.reason
  useLayoutEffect(() => {
    if (!reason) return
    const lane = box.current?.firstElementChild
    const main = box.current?.closest<HTMLElement>('[data-v3-anchor="canvas"]')
    if (!(lane instanceof HTMLElement) || !main) return
    main.style.setProperty("--v3-toast-push", `${lane.offsetHeight + 8}px`)
    return () => {
      main.style.removeProperty("--v3-toast-push")
    }
  }, [reason])
  if (!toast) return null
  return (
    // display: contents：不占版面，只用来找到下面这一叠（定位仍相对画布列 main）；这一叠写明 bottom 74，不随 --v3-toast-push 上移
    <div ref={box} className="contents">
      <Toasts bottom={74}>
        <Toast key={toast.reason}>母版视图：{toast.reason}</Toast>
      </Toasts>
    </div>
  )
}

/* ------------------------------------------------------------------ 键位 */

/** 焦点在这些地方时 Esc 不触发退出（输入框、可编辑文本、菜单、弹层与对话框里，UX-06；03-26 §1.1 第 4 条） */
const TYPING = "input, textarea, select, [contenteditable='true'], [role='menu'], [role='dialog'], [role='alertdialog']"

/** 模态对话框开着（kit Dialog / Drawer / BottomSheet 与命令面板都写 aria-modal）：⌥⌘M 不响应（rulings §4.25 DS-165） */
function modalOpen(): boolean {
  return !!document.querySelector('[aria-modal="true"]:not([data-state="closed"]), [role="alertdialog"][data-state="open"]')
}

/**
 * 焦点在输入框或可编辑文本里时先提交再切换（03-26 §1.1：文本编辑中按下先提交并退出文本编辑）：把焦点直接交给画布（失焦即提交），不先让输入框失焦、落到 body——
 * 进入时的落点（窗格选中行）要等母版视图挂上才有，这之前停在画布；画布接不住焦点时才退回让输入框自己失焦（由 closeOverlaysThen 挂着的 holdFocusDuring 接住，交给画布）。
 * 焦点所在的弹层随之按「焦点移到外面」收起；写了内容的评论撰写框不收（点外面不关，免得丢稿），由切换本身收起（comments/canvas.tsx DraftKeeper）。
 * 2026-10-28 第一步修复第 1 轮：原来直接让输入框失焦，焦点先落到 body、再等收起浮层的几帧，进入前在 body 上停约 80 ms（复验 B1）。
 * （注释里不写失焦方法的英文名：Tailwind 扫源码时会把单独成词的它当成工具类、多生成一条没人用的 CSS，2026-10-29 补完，复验 R3-N6）
 */
function commitTyping() {
  const a = document.activeElement
  if (!(a instanceof HTMLElement) || !(a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return
  const to = canvasFocusTarget()
  if (to && to !== a) {
    to.focus({ preventScroll: true })
    if (document.activeElement === to) return
  }
  a.blur()
}

/** 正在发合成的 Esc（收起浮层）：自己的 Esc 处理不接 */
let synthesizing = false

/**
 * 浮层这一刻的样子：开着的浮层连同各自的整棵子树（outerHTML，自己的 data-state 也在里面），加上工具提示的 data-state
 * （工具提示也算进来：Radix 把它当最上层，一下 Esc 可能只收起提示）。
 * 子树也要比：一下 Esc 可能被浮层里面的子件接住，浮层自己的 data-state 不变、里面变了——分享对话框的行内确认与邀请联想先退
 * （share/parts.tsx useEscapeFirst）、导出对话框在等待同步 / 排队 / 生成中先退回选项（export/ExportDialog.tsx）、版式画廊先清空搜索
 * （editor/layouts/LayoutGallery.tsx）。这也是「这一层接了」，要接着发下一下；写了内容的评论撰写框不接 Esc（comments/canvas.tsx 撰写框的
 * onEscapeKeyDown 只 preventDefault），子树不变，照旧判为不接。
 * 2026-10-29 第一步修复第 2 轮（复验 R2-B1）：原来只比元素与 data-state，经命令面板执行「母版视图」时把这几种对话框判成「不接」，对话框没收起就切进了母版视图
 */
function layerSnapshot(): [Element, string | null][] {
  const tips = Array.from(document.querySelectorAll('[data-slot="v3-tooltip"]'), (el): [Element, string | null] => [el, el.getAttribute("data-state")])
  return [...openOverlays().map((el): [Element, string | null] => [el, el.outerHTML]), ...tips]
}

function sameSnapshot(a: [Element, string | null][], b: [Element, string | null][]): boolean {
  return a.length === b.length && a.every(([el, s], i) => b[i]?.[0] === el && b[i]?.[1] === s)
}

/**
 * 菜单或弹层开着时先收起再切换（rulings §4.25 DS-165；避免「母版退了但菜单还开着」）：每一帧给最上面一层发一次 Esc（Radix 浮层按层收起，与用户按 Esc 同一条路径），
 * 都收起了（或最多 4 层）再执行。没有开着的浮层时同步执行。⌥⌘M 与命令面板（面板已收起，剩下的如版式画廊、主题弹层）两条路径用它；
 * 主菜单路径不用（选中条目时菜单自己收起，别的弹层已被点外面收起）。模态对话框开着时 ⌥⌘M 不响应（DS-165），不交给这里收起。
 * 画布浮动层（查找面板、跳页提示条、轻提示、快捷键面板这类不是 Radix 浮层的）不经这里：进出时由各自收起（rulings §4.25 TB-204，mode.ts useDismissOnMasterToggle）。
 * 发了一下 Esc、到下一帧浮层一点没变（开着哪几层、各自的 data-state 与子树都没变，见 layerSnapshot）：最上面一层不接 Esc（写了内容的评论撰写框按设计不接，免得丢稿）——
 * 不再空等，直接执行（这一层由切换本身收起或留着）。只是浮层里面变了（对话框里的行内确认先退、导出先退回选项）算接了，接着发下一下，直到浮层都收起。
 * switching（这一下真要进入或退出；不可用、只提示原因时为假）：焦点在输入框里先提交（commitTyping）；从按下到切换提交的这几帧里焦点不掉到 body——
 * holdFocusDuring 交给画布，切换提交后宿主再交给落点（进入：窗格选中行；退出：画布），设计 03-26 §1.1。
 * 2026-10-28 第一步修复第 1 轮补（复验 B1）：原来没有 hold、不接 Esc 的层要空等满 4 帧；第 2 轮（复验 R2-B1）「一点没变」连子树一起比
 */
export function closeOverlaysThen(fn: () => void, { switching = false }: { switching?: boolean } = {}) {
  const release = switching ? holdFocusDuring(1000, canvasFocusTarget) : () => undefined
  if (switching) {
    commitTyping()
    // 按下时焦点本来就在 body 上（载入后还没人聚焦过、点过不可聚焦处）：同样先交给画布，切换前不在 body 上等
    rescueFocus()
  }
  let n = 0
  let last: [Element, string | null][] | null = null
  const step = () => {
    const now = layerSnapshot()
    if (!overlayOpen() || n++ >= 4 || (last && sameSnapshot(now, last))) {
      release()
      fn()
      return
    }
    last = now
    synthesizing = true
    try {
      const t = document.activeElement instanceof HTMLElement ? document.activeElement : document.body
      t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }))
    } finally {
      synthesizing = false
    }
    requestAnimationFrame(step)
  }
  step()
}

/** MasterModeKeys 每次按键时取的最新值 */
export interface MasterKeysLive {
  mode: MasterViewMode
  impl: MasterViewImpl | null
  scene: SceneStore
  ctx: EditorCtx
}

/**
 * ⌥⌘M 与 Esc（document 捕获阶段：开始派发时浮层、抽屉都还在，直接查 DOM 就能判断「上面还有没有一层」）。
 * ⌥⌘M（按 e.code，带 Alt 与 Cmd / Ctrl，不带 Shift；按住不放的重复不再切换）：
 *   没有编辑器外壳（entry.silent）时不处理；模态对话框开着时不处理；其余 preventDefault——
 *   母版视图里退出、可进入时进入（焦点在输入框里先提交），不可进入时由 enter 给一次轻提示；菜单或弹层开着时先收起再切换。
 * Esc（只在母版视图里）逐级、不越级：输入法组合中、已被处理、焦点在输入框 / 可编辑区 / 菜单 / 对话框里 → 不处理；
 *   开着的浮层、紧凑形态的抽屉、检查器整栏面板 → 让给它们；画布浮动层（查找和替换面板、页导航提示条，kit useCanvasEscape）接住 → 结束；
 *   母版实现先接（取消占位符选中）→ 结束；否则退出母版视图（rulings §4.25 TB-195）。
 * 画布浮动层挂在状态的 canvasOverlay 里，两种视图里位置不变、切换时不卸载：从普通视图带进来的进入时各自收起，母版视图里不画；
 *   母版视图里再打开的（Mod+F 的查找面板、敲数字出的跳页提示条）归母版视图，Esc 照这里的次序逐层收起，退出母版视图时一并收起
 *   （rulings §4.25 DS-158、TB-204；各层用 mode.ts useDismissOnMasterToggle 自己收起）。
 *   它们不是 Radix 浮层，overlayOpen() 认不出，所以退出之前由这里在捕获阶段先问它们（工具提示不会先吞掉这一下）——
 *   2026-10-29 第一步修复第 3 轮补（复验 R3-B1：原来第一下 Esc 越过查找面板直接退出）
 */
export function MasterModeKeys({ live }: { live: () => MasterKeysLive }) {
  const ref = useRef(live)
  ref.current = live
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (synthesizing) return
      const { mode, impl, scene, ctx } = ref.current()
      if ((e.metaKey || e.ctrlKey) && e.altKey && !e.shiftKey && e.code === "KeyM") {
        if (e.isComposing) return
        if (!mode.on && mode.entry.silent) return
        if (modalOpen()) return
        e.preventDefault()
        if (e.repeat) return
        // 要切换（母版视图里退出，或可进入）：焦点在输入框里先提交、这几帧里焦点不掉到 body（closeOverlaysThen 的 switching）
        closeOverlaysThen(() => ref.current().mode.toggle("shortcut"), { switching: mode.on || mode.entry.ok })
        return
      }
      if (e.key !== "Escape" || !mode.on || e.defaultPrevented || e.isComposing) return
      const t = e.target instanceof HTMLElement ? e.target : null
      if (t && (t.isContentEditable || t.closest(TYPING))) return
      if (overlayOpen() || document.querySelector("[data-v3-drawer], [data-v3-takeover]")) return
      e.preventDefault()
      // 画布浮动层先接：收起查找面板、清掉「转到第 N 页」提示条，仍在母版视图（下一下 Esc 再轮到占位符选中与退出）
      if (takeCanvasEscape(e)) return
      if (impl?.onEscape?.(scene, ctx)) return
      mode.exit("escape")
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [])
  return null
}
