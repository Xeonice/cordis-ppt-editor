import { cloneElement, createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactElement, type RefObject } from "react"
import { flushSync } from "react-dom"
import { findAnchor } from "./anchor"

/**
 * 最近一层 kit 浮层（Popover / Dialog）的关闭函数。浮层自己提供，浮层里的「关闭」「取消」「完成」「插入」等按钮调用它，
 * 浮层照常走 onOpenChange(false)、焦点回到触发处（与按 Esc 同一条路径）。不在 kit 浮层里时是空操作。
 */
export const LayerCloseContext = createContext<(() => void) | null>(null)

/**
 * 在 kit Dialog 里面（Dialog 提供 true）。kit Menu 据此处理「对话框里一出现就展开的下拉」：同一次提交里挂载时，菜单的 Portal 会先于对话框插进根节点、被对话框盖住，
 * 焦点也会被对话框的初始聚焦拿走；所以等对话框挂好之后再展开（晚一次渲染），菜单排在对话框之上、焦点进菜单（分享对话框的角色 / 链接下拉）。
 */
export const InDialogContext = createContext(false)

const noop = () => {}

/**
 * 在浮层内容组件里拿到关闭函数：
 *
 *   function ColorPicker() {
 *     const close = useLayerClose()
 *     return <IconButton label="关闭" onClick={close}>…</IconButton>
 *   }
 */
export function useLayerClose(): () => void {
  return useContext(LayerCloseContext) ?? noop
}

/**
 * 包一层：点里面的按钮后关闭最近一层浮层。原 onClick 先执行（调用 e.preventDefault() 可以不关）；
 * kit 的 Button / IconButton 不可用时根本不调用 onClick，所以不可用的按钮点了也不会关。
 * 给 Dialog 的 footer / footerStart 这类在浮层外面写好的按钮用（那里拿不到 useLayerClose）：
 *
 *   footer={<><LayerClose><Button>取消</Button></LayerClose><LayerClose><Button variant="primary">全部应用</Button></LayerClose></>}
 */
export function LayerClose({ children }: { children: ReactElement<{ onClick?: (e: MouseEvent<HTMLElement>) => void }> }) {
  const close = useLayerClose()
  const own = children.props.onClick
  return cloneElement(children, {
    onClick: (e: MouseEvent<HTMLElement>) => {
      own?.(e)
      if (!e.defaultPrevented) close()
    },
  })
}

/**
 * 用户有没有在这个编辑器里操作过（按过键、点过按）。场景状态里「一出现就是打开的」浮层（还没有人操作过）不抢焦点，截图才干净；
 * 之后由用户打开的浮层（键盘或指针）一律把焦点移进浮层第一个可聚焦项：Tab / ⇧Tab 在层内循环，Esc 关闭后焦点回触发处（02 §7、07 §2）。
 * 挂载与卸载时机无法区分「场景状态」与「用户刚打开」（条件渲染的浮层每次打开都是新挂载），所以以「有没有人操作过」为准。
 * 监听挂在 document 捕获阶段、模块加载时装一次；换场景状态（编辑器重新挂载）时由 Editor 调 resetInteraction() 复位。
 */
let interacted = false
/** 下一次复位时保留「操作过」：用户的操作把编辑器换到了另一个场景状态（命令兜底转到演示它的场景），新状态里随之打开的面板照常接住焦点 */
let carried = false
/** 随之带过去的入口锚点（触发命令的那颗按钮，如主菜单 main-menu）；新状态挂载时移到 arrived */
let carriedFrom: string | null = null
let arrived: string | null = null
if (typeof document !== "undefined") {
  const mark = () => {
    interacted = true
  }
  for (const type of ["keydown", "pointerdown", "mousedown", "click"] as const) document.addEventListener(type, mark, true)
}
/** 指针按下到抬起之间（document 捕获阶段记，早于 Radix 的「点外面」处理）：useFocusBackOnClose 据此判断这次关闭是不是同一次按压里点外面关的 */
let pressing = false
if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    () => {
      pressing = true
    },
    true,
  )
  const release = () => {
    pressing = false
  }
  for (const type of ["pointerup", "pointercancel"] as const) document.addEventListener(type, release, true)
}
export const userHasInteracted = () => interacted
export const resetInteraction = () => {
  interacted = carried
  arrived = carried ? carriedFrom : null
  carried = false
  carriedFrom = null
}
/**
 * 由用户操作触发的换状态（Editor.tsx 的命令兜底）：调完再导航，新状态挂载时不把「操作过」复位；
 * from 是触发它的固定入口（锚点名，kit/commands COMMAND_ENTRY），新状态里用 arrivedVia() 取
 */
export const carryInteraction = (from?: string) => {
  carried = true
  carriedFrom = from ?? null
}
/**
 * 这次挂载是命令兜底从别的样张转过来的：触发它的入口锚点（如主菜单 main-menu），否则 null。
 * 新状态里随之打开着的面板没有别的来源可交回时，关闭后焦点交回这个入口（03-10 §2「交回打开它的控件」：那颗按钮在新状态里还是同一个位置）
 */
export const arrivedVia = () => arrived

/** 有没有打开着的工具提示（ui.tsx Tip 的内容带 data-slot="v3-tooltip"） */
export const tooltipShowing = () => !!document.querySelector('[data-slot="v3-tooltip"]')

/** overlayOpen / openOverlays 的判据（见下） */
const OVERLAY_OPEN = [
  '[role="menu"][data-state="open"]',
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[role="listbox"][data-state="open"]',
  '[data-radix-popper-content-wrapper] [data-state="open"]:not([data-slot="v3-tooltip"])',
  '[aria-haspopup][aria-expanded="true"]',
].join(", ")

/**
 * 有没有打开着的浮层（菜单、弹层、对话框、下拉，含自己画的「带 aria-haspopup 的触发器已展开」的弹层）。工具提示不算（不是用户打开的）；
 * 页面上一直在的 role="listbox"（如母版窗格的缩略图列表）也不算——只认带 data-state="open" 的 Radix 浮层与已展开的弹出触发器。
 * Esc 逐层退出用：最上层的浮层先关（Radix 自己处理），再轮到抽屉、再轮到母版视图的选区与退出，不越级。
 */
export function overlayOpen(): boolean {
  return !!document.querySelector(OVERLAY_OPEN)
}

/**
 * 同 overlayOpen 的判据，返回开着的那些元素（按文档顺序）。2026-10-28 母版视图第一步修复第 1 轮补：宿主「先收起浮层再切换」（editor/master/host.tsx closeOverlaysThen）
 * 发一下 Esc 之后拿它比对，最上面一层没接（如写了内容的评论撰写框按设计不接 Esc）就不再空等
 */
export function openOverlays(): Element[] {
  return Array.from(document.querySelectorAll(OVERLAY_OPEN))
}

/**
 * 画布浮动层在 Esc 逐层里的一级（2026-10-29 母版视图第一步修复第 3 轮，复验 R3-B1）。
 * 自己画、不是 Radix 浮层的画布浮动层——查找和替换面板（kit FloatingPanel）、页导航「转到第 N 页」提示条（kit PageJumpHint）——开着时用它登记
 * 「这一下 Esc 接不接」：take(e) 接住就收起（清掉）并返回 true，不接返回 false。只登记、不另装监听：普通视图里各层照旧由自己的键盘监听处理 Esc，行为不变。
 * 母版视图的宿主（editor/master/host.tsx MasterModeKeys，document 捕获阶段）在 Radix 浮层、抽屉、整栏面板之后，母版内部选中与退出之前，
 * 按后开先问的顺序问它们（takeCanvasEscape），有一层接住就到此为止——查找面板开着时 Esc 先收起面板、仍在母版视图，不越过它直接退出
 * （03-26 §1.1「退出」第 4 条 Esc 逐级、不越级，50/10 §7.1，50/11 §2 退出④）。
 * 由宿主在捕获阶段直接问、再 preventDefault：焦点在窗格选中行时自动弹出的工具提示不会先吞掉这一下（工具提示不算一层，同 useEscapeThroughTooltip），
 * 层自己的监听随后见到 defaultPrevented（或自己的状态已清掉）也不再重复处理。
 * 只在焦点在自己里面时才接 Esc 的层（键盘快捷键面板：Esc 挂在面板根上）不登记——焦点在它里面时宿主本来就不处理（role=dialog），
 * 焦点在别处时它不接，Esc 照常往下走（母版视图里照旧退出），不会变成「按 Esc 没反应」。
 */
const canvasEscapes: { take: (e: KeyboardEvent) => boolean }[] = []

export function useCanvasEscape(active: boolean, take: (e: KeyboardEvent) => boolean) {
  const takeRef = useRef(take)
  useLayoutEffect(() => {
    takeRef.current = take
  })
  // 布局阶段登记（层挂上的那一次提交里就在，早于下一次按键）；层收起即注销
  useLayoutEffect(() => {
    if (!active) return
    const entry = { take: (e: KeyboardEvent) => takeRef.current(e) }
    canvasEscapes.push(entry)
    return () => {
      const i = canvasEscapes.indexOf(entry)
      if (i >= 0) canvasEscapes.splice(i, 1)
    }
  }, [active])
}

/** 问一遍开着的画布浮动层（后开先问）：有一层接住这一下 Esc 就返回 true（母版视图的宿主用，见 useCanvasEscape） */
export function takeCanvasEscape(e: KeyboardEvent): boolean {
  for (let i = canvasEscapes.length - 1; i >= 0; i--) if (canvasEscapes[i]?.take(e)) return true
  return false
}

/**
 * Esc 穿过工具提示：键盘聚焦到带工具提示的按钮时提示会自动弹出，Radix 把它当成最上层，第一下 Esc 只收起提示、浮层不动，
 * 用户得按两次（评审记为「Esc 关不掉」）。工具提示不是用户打开的，这里让同一下 Esc 直接关掉所在的浮层（Dialog、Popover、画布小卡）。
 * 只在「有工具提示开着、焦点在这层里（或在 body 上）」时接手；焦点在嵌套的菜单 / 下拉 / 弹层里时不管，由那一层自己先关。
 * 监听挂在 document 捕获阶段，比工具提示打开后才注册的监听先执行。close 拿到原事件：浮层自己的 Esc 规则（如 Popover 的
 * onEscapeKeyDown「先清空搜索」）可以先跑，调用 e.preventDefault() 就不关。
 */
export function useEscapeThroughTooltip(active: boolean, box: RefObject<HTMLElement | null>, close: (e: KeyboardEvent) => void) {
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return
      const el = box.current
      if (!el || !tooltipShowing()) return
      const a = document.activeElement
      if (a && a !== document.body && !el.contains(a)) return
      closeRef.current(e)
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [active, box])
}

/** 浮层里可以 Tab 到的元素（按文档顺序）：焦点陷阱的首尾、打开时的初始焦点用。aria-disabled 的仍算（FE-06：不可用仍可聚焦）。 */
export function tabbables(root: HTMLElement): HTMLElement[] {
  const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  return Array.from(root.querySelectorAll<HTMLElement>(sel)).filter((el) => {
    if (el.hasAttribute("disabled") || el.tabIndex < 0 || el.closest("[inert], [hidden]")) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 || r.height > 0
  })
}

/**
 * 画布：浮层、对话框、横幅、提示关闭后无处可回时的落点（Stage 带 tabIndex=-1；网格视图里是画布列本身）。
 * 画布接不住焦点时（没有 tabIndex：母版视图的画布、放大后的滚动画布）交给画布列 main（tabIndex −1）——2026-10-28 母版视图成为宿主的全局模式后补：
 * 原来在母版视图里关掉浮层、命令面板时焦点落不到画布上、停在 body。普通视图的画布带 tabIndex，落点不变
 */
export function canvasFocusTarget(): HTMLElement | null {
  const stage = document.querySelector<HTMLElement>('[data-v3-anchor="stage"]')
  if (stage && stage.hasAttribute("tabindex")) return stage
  return document.querySelector<HTMLElement>('[data-v3-anchor="canvas"]') ?? stage
}

const focusIf = (el: HTMLElement | null | undefined): boolean => {
  if (!el || !el.isConnected) return false
  el.focus({ preventScroll: true })
  return document.activeElement === el
}

/**
 * 浮层关闭后把焦点交回触发处，键盘用户不会掉到页面顶端（body）：
 * 锚点自己可聚焦就聚焦它；锚点是不可聚焦的容器时——幻灯片画布里的（如右键菜单锚在幻灯片框上）交给画布，其余（含盖在画布列上的面板，如紧凑窗口的数据 Sheet）交给容器里第一个可操作的控件；
 * 都没有时交给画布。返回最后落在哪个元素上。
 */
export function focusBack(el: HTMLElement | null | undefined): HTMLElement | null {
  if (focusIf(el)) return el ?? null
  if (el && el.isConnected && !el.closest('[data-v3-anchor="stage"]')) {
    const first = tabbables(el)[0]
    if (focusIf(first)) return first ?? null
  }
  const canvas = canvasFocusTarget()
  return focusIf(canvas) ? canvas : null
}

/**
 * 焦点已落在页面里一个可用的元素上：不是 body / html、还连在文档里、不在 inert 区域里，也不在 layer（正在关闭的这一层）里面，
 * 也不是画布 / 主区这类兜底落点（[data-v3-anchor="stage"]、[data-v3-anchor="canvas"]：rescueFocus、holdFocusDuring 换状态的那几帧临时停放焦点的地方，
 * 关闭后照旧交给触发处或 returnFocus 锚点——如命令兜底转到插件样张、关掉对话框后回到主菜单按钮）。
 * kit Dialog、Drawer、BottomSheet 在 Radix 补发的焦点交还（onCloseAutoFocus：内容卸载后的下一个任务）里先看它，成立就不再移动焦点——
 * 整页随场景状态换掉时（如在对话框里操作后转到别的页面），新页面在布局阶段已把焦点落好，补发的交还不能把它抢到画布或已卸载的旧入口
 * （2026-10-23 第 3 批评审修改时导入对话框发现；同 useFocusBackOnClose「焦点已被别处接走就不碰」的口径）。
 */
export function focusSettledElsewhere(layer?: Element | null): boolean {
  const a = document.activeElement
  if (!(a instanceof HTMLElement) || a === document.body || a === document.documentElement || !a.isConnected) return false
  if (layer?.contains(a)) return false
  if (a.matches('[data-v3-anchor="stage"], [data-v3-anchor="canvas"]')) return false
  return !a.closest("[inert]")
}

/** 焦点已经掉到 body（或已被卸载的元素上）时，交给画布；焦点还在别处（用户点了别的控件）时不动。 */
export function rescueFocus() {
  const a = document.activeElement
  if (!a || a === document.body || !a.isConnected) focusIf(canvasFocusTarget())
}

/**
 * 由菜单打开面板（文档菜单「版本历史」、主菜单「文件 › 保真报告」「插件…」）或先切视图再开（网格里选它们先回单页）：菜单先收起、条目卸载，
 * 焦点会从卸载的条目（及随视图卸载的网格胶囊）掉到 body，再由菜单在下一个任务里交回触发按钮，之后面板才接走（读屏先念一遍触发按钮）。
 * 调用后 ms 毫秒内，焦点一旦要落到 body（focusout 且没有去处），就在同一个任务末尾（微任务，早于下一帧）交给 to() 给的落点（面板里该落的地方，已经挂上时）；
 * 没有落点（如网格 → 单页，面板还没挂上）时交给画布（rescueFocus：单页的画布、网格里是两种视图共用的画布列 main），新视图里的面板挂上后再把焦点接走。
 * 焦点已经有去处时不动（菜单交还焦点时见到焦点已被接走也不再抢，keepMovedFocus）。返回提前解除的函数（面板卸载时调）。
 */
export function holdFocusDuring(ms = 1500, to?: () => HTMLElement | null | undefined): () => void {
  const hold = (e: FocusEvent) => {
    if (e.relatedTarget) return
    queueMicrotask(() => {
      const a = document.activeElement
      if (a && a !== document.body && a.isConnected) return
      if (!focusIf(to?.())) rescueFocus()
    })
  }
  document.addEventListener("focusout", hold, true)
  let id = 0
  const release = () => {
    window.clearTimeout(id)
    document.removeEventListener("focusout", hold, true)
  }
  id = window.setTimeout(release, ms)
  return release
}

/**
 * 收起焦点所在的一层（面板、检查器整栏面板：卸载它）并把焦点交回 back（锚点名）——先交出焦点、再卸载，焦点不经过 body（07 §2，同评论撰写框的 handOff）：
 * - 交回处已在页面上（文件名、主菜单按钮、横幅按钮、画布上的占位）：先聚焦它，再收起；
 * - 交回处要随收起才重新挂上（检查器常规页签里的「保真详情」、报告关上后才重新出现的提示条按钮）：同步提交收起（flushSync），在同一个任务里交过去，不留一帧；
 *   同步提交后仍不在（还要再渲染一次才挂上）时先交给画布，逐帧等它出现再接过去（最多约 8 帧）；
 * - 没有交回处：焦点在这一层里（或已掉到 body）时先交给画布再收起；焦点本来就在别处（用户已点到别的控件）时只收起。
 * layer：要收起的那一层的根元素（判断焦点在不在里面、交回处是不是在它里面）。
 */
export function closeWithFocusBack(close: () => void, back: string | null | undefined, layer?: Element | null) {
  const a = document.activeElement
  const inside = !a || a === document.body || !a.isConnected || (!!layer && layer.contains(a))
  if (!back) {
    if (inside) focusIf(canvasFocusTarget())
    close()
    return
  }
  const el = findAnchor(document, back)
  if (el && !layer?.contains(el)) {
    focusBack(el)
    close()
    return
  }
  flushSync(close)
  const now = findAnchor(document, back)
  if (now) {
    focusBack(now)
    return
  }
  rescueFocus()
  const parked = document.activeElement
  let n = 0
  const tick = () => {
    const later = findAnchor(document, back)
    // 等的这几帧里用户把焦点移到了别处：不再抢
    if (later) {
      if (document.activeElement === parked || document.activeElement === document.body) focusBack(later)
    } else if (n++ < 8) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/**
 * 浮层关闭时焦点不在 body 停一帧（07 §2）：Radix 在浮层内容卸载后的下一个任务里才交还焦点（FocusScope 卸载时 setTimeout 0 才发 onCloseAutoFocus），
 * 这中间焦点在 body 上（rAF 采样能看到 13–30ms，读屏可能先念一下页面）。open 由 true 变 false、或这一层整个卸载时，在同一个任务末尾
 * （微任务：内容已经卸载、早于下一帧）就把焦点交给 back() 给的落点（kit focusBack：不可聚焦就交给其中第一个控件或画布）——只在焦点确实掉到 body
 * （或已卸载的元素）上时才动：焦点已被别处接走（菜单项打开的对话框、面板，holdFocusDuring 先接住的落点）就不碰。
 * 之后 Radix 的 onCloseAutoFocus 照常到来，见焦点已有去处，各自的判断照旧（kit Dialog 用 onReturned 记下「已交还」，不再重复交）。
 * 指针点外面关的：交回之后，同一次按压里落在不可聚焦处（html、对话框遮罩）的 mousedown 不再把焦点移回 body（keepFocusThroughPress）。
 * back 返回 undefined / null 时跳过（这次不该交，如弹层是点外面关的）。kit Dialog、ContextMenu、Menu（锚定与普通下拉）、Popover，底座 V3Menu（文档菜单等）
 * 与主菜单都用它（第 2 批第 6 轮集成）；自己画的会卸载的浮层同样用它。
 */
export function useFocusBackOnClose(open: boolean, back: () => HTMLElement | null | undefined, onReturned?: () => void) {
  const was = useRef(open)
  const latest = useRef({ back, onReturned })
  latest.current = { back, onReturned }
  // 两层微任务：Radix 的浮层内容由 Presence 在 open 变 false 之后的那一次同步重渲染里才卸载（同一个任务里、本钩子的布局阶段之后），
  // 卸载时 holdFocusDuring 排下的交接（菜单项打开的面板的落点）要先于这里执行——排在它后面，见焦点已被接走就不动（不让焦点先绕回触发按钮）
  const run = () =>
    queueMicrotask(() =>
      queueMicrotask(() => {
        // 没人操作过（场景状态载入、开发模式 StrictMode 的模拟卸载）：页面焦点本来就在 body 上，不动
        if (!userHasInteracted()) return
        const a = document.activeElement
        if (a && a !== document.body && a.isConnected) return
        const el = latest.current.back()
        if (el === undefined || el === null) return
        if (focusBack(el)) {
          latest.current.onReturned?.()
          if (pressing) keepFocusThroughPress()
        }
      }),
    )
  useLayoutEffect(() => {
    if (was.current && !open) run()
    was.current = open
    // run 只读 ref；只在 open 变化时判断
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  useLayoutEffect(
    () => () => {
      // 整层随场景状态卸载（条件渲染的对话框、菜单）：开着时一样在内容卸载的同一个任务里交出焦点
      if (was.current) run()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
}

/** 按下时能接住焦点的元素（mousedown 的默认动作把焦点交给最近的这类祖先；一个都没有时焦点落到 body） */
const PRESS_FOCUSABLE = 'button, [href], input, select, textarea, summary, [tabindex], [contenteditable]:not([contenteditable="false"])'

/**
 * 指针点外面关掉的浮层：焦点已在 pointerdown 里交回触发处，但同一次按压随后的 mousedown 落在不可聚焦的地方——
 * 模态下拉开着时 body 是 pointer-events: none，落在 html 上；对话框里的下拉落在对话框的遮罩上——它的默认动作会把焦点又移到 body，
 * 绘制前采样能看到 1–2 帧（6–34ms）。这一次按压里拦下这类 mousedown 的默认动作，按压结束（pointerup / pointercancel）即解除；
 * 只拦「没有能接住焦点的祖先」的——点到别的控件或可聚焦的区域（非模态浮层开着时点得到）照常聚焦它。
 */
function keepFocusThroughPress() {
  const stop = (e: Event) => {
    const t = e.target
    if (!(t instanceof Element) || !t.closest(PRESS_FOCUSABLE)) e.preventDefault()
  }
  const done = () => {
    document.removeEventListener("mousedown", stop, true)
    document.removeEventListener("pointerup", done, true)
    document.removeEventListener("pointercancel", done, true)
  }
  document.addEventListener("mousedown", stop, true)
  document.addEventListener("pointerup", done, true)
  document.addEventListener("pointercancel", done, true)
}

/**
 * 菜单（Radix DropdownMenu）的 onCloseAutoFocus：选了某项后焦点已被新打开的面板、对话框接走时，不再把焦点抢回触发按钮
 * （Radix 在菜单卸载后的下一个任务里归还焦点，会抢走整栏面板刚给内容区的焦点）；焦点掉在 body（或已卸载的元素）上时照常交回触发处。
 * 底座主菜单、文档菜单（ui.tsx V3Menu）用它；kit Menu / ContextMenu 的锚定形态自带同样的判断。
 */
export function keepMovedFocus(e: Event) {
  const a = document.activeElement
  if (a && a !== document.body && a.isConnected) e.preventDefault()
}

/**
 * 只滚面板自己的滚动区，把 el 放进视口（不用 scrollIntoView：它会连带滚动外层，含 overflow: hidden 的页面根节点，整个编辑器被推上去）。
 * align：center 放到中间（放不下就贴边）· start 贴顶（offset 留白）；ifNeeded：已经整条可见时不动。滚动区取最近的、纵向可滚动的祖先。
 */
export function scrollIntoPanel(el: HTMLElement | null | undefined, { align = "center", offset = 0, ifNeeded = false }: { align?: "center" | "start"; offset?: number; ifNeeded?: boolean } = {}) {
  if (!el) return
  let box = el.parentElement
  while (box && !(/(auto|scroll)/.test(getComputedStyle(box).overflowY) && box.scrollHeight > box.clientHeight)) box = box.parentElement
  if (!box) return
  const r = el.getBoundingClientRect()
  const b = box.getBoundingClientRect()
  if (ifNeeded && r.top >= b.top && r.bottom <= b.bottom) return
  const target = align === "center" ? box.scrollTop + (r.top - b.top) - (b.height - r.height) / 2 : box.scrollTop + (r.top - b.top) - offset
  box.scrollTop = Math.max(0, Math.min(target, box.scrollHeight - box.clientHeight))
}

/**
 * 播报区「先挂空、下一帧再填内容」的读屏版（外观不变）：返回 false 的这两帧里，live 区里的内容由调用方用 aria-hidden 挡在无障碍树外，之后才放进来——
 * 读屏看到的是「已经在的播报区里出现了新内容」（最稳的播报时机），而不是「带着内容一起插进来的播报区」（部分读屏不念）。等两次 rAF，同 Radix Toast 的 useNextFrame。
 * 画面从第一帧起照常画（只挡无障碍树、不挡渲染），截图与第 1 批逐像素对拍不变；kit Toast 与页级提示条（CanvasHint announce="next-frame"）用它。
 */
export function useRevealAfterMount(active = true): boolean {
  const [shown, setShown] = useState(!active)
  useEffect(() => {
    if (shown) return
    let b = 0
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setShown(true))
    })
    return () => {
      cancelAnimationFrame(a)
      cancelAnimationFrame(b)
    }
  }, [shown])
  return shown
}

/**
 * 演示用的「一出现就展开」：场景状态里为 true（截图看得到提示 / 说明），用户第一次点按或按键后变为 false、回到普通的悬停 / 聚焦才出现
 * （与底座工具条 toolbar.tip 同一口径）。active 为 false 时始终 false。
 */
export function useDemoOpen(active = true): boolean {
  const [open, setOpen] = useState(active)
  useEffect(() => {
    if (!open) return
    const off = () => setOpen(false)
    document.addEventListener("pointerdown", off, true)
    document.addEventListener("keydown", off, true)
    return () => {
      document.removeEventListener("pointerdown", off, true)
      document.removeEventListener("keydown", off, true)
    }
  }, [open])
  return open && active
}
