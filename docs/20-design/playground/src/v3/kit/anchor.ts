import { useContext, useLayoutEffect, useState } from "react"
import { V3RootContext } from "../V3Root"

/**
 * 锚点：编辑器里可以挂浮层的元素都带 data-v3-anchor="<名字>"。kit 的 Popover / Menu / ContextMenu 用名字找到元素并贴着它定位，
 * 场景不必改共享组件就能把弹层「挂」在工具条按钮、检查器控件、左栏按钮上。
 * 同一时刻只渲染一种视图，所以单页与网格里同一个东西用同一个名字（如 main-menu、thumb-3）。
 * 场景自己画的元素也可以加 data-v3-anchor（名字带场景前缀，如 "table.border-menu"）。
 */
export const ANCHORS = {
  /** 底部浮动工具条整体与各工具按钮 */
  toolbar: "toolbar",
  toolSelect: "tool-select",
  toolText: "tool-text",
  toolShapes: "tool-shapes",
  toolImage: "tool-image",
  toolTable: "tool-table",
  toolChart: "tool-chart",
  toolComment: "tool-comment",
  toolMore: "tool-more",
  /** 评审条（EditorConfig.mode = review）的「高亮」 */
  toolHighlight: "tool-highlight",
  /** 左栏（单页）/ 左上胶囊（网格） */
  rail: "rail",
  mainMenu: "main-menu",
  docMenu: "doc-menu",
  syncStatus: "sync-status",
  viewToggle: "view-toggle",
  /** 「新建幻灯片 ▾」（网格胶囊里是「+ 新建幻灯片」） */
  newSlide: "new-slide",
  /** 左栏「新建幻灯片」右侧的 + */
  newSlidePlus: "new-slide-plus",
  /** 画布列、画布、当前页幻灯片框、备注框 */
  canvas: "canvas",
  stage: "stage",
  slide: "slide",
  notes: "notes",
  /** 检查器（单页）/ 右上胶囊（网格）里的东西 */
  inspector: "inspector",
  collaborators: "collaborators",
  present: "present",
  share: "share",
  zoom: "zoom",
  tabDesign: "tab-design",
  tabComments: "tab-comments",
  /** 内置分区里的控件 */
  layoutField: "layout-field",
  themeCard: "theme-card",
  themeAdjust: "theme-adjust",
  backgroundColor: "background-color",
  fillColor: "fill-color",
  /** 内置「文本」分区（03-16）：西文 / 中文字体、文字颜色、高亮、项目符号、编号 */
  fontLatin: "font-latin",
  fontEa: "font-ea",
  textColor: "text-color",
  textHighlight: "text-highlight",
  listBullets: "list-bullets",
  listNumbering: "list-numbering",
} as const

/** 第 n 页的缩略图（左栏或网格，取当前视图里的那个）。 */
export const thumbAnchor = (n: number) => `thumb-${n}`
/** 检查器分区（内置分区为 section-<分区 id>，如 section-shape.fill）。 */
export const sectionAnchor = (id: string) => `section-${id}`

/** 在 v3 根节点内按名字找锚点元素。 */
export function findAnchor(root: ParentNode | null, name: string): HTMLElement | null {
  if (!root) return null
  return root.querySelector<HTMLElement>(`[data-v3-anchor="${CSS.escape(name)}"]`)
}

/**
 * 找到锚点元素并跟踪它：锚点稍后才挂载（切换视图、打开面板）或被替换时自动更新；1 秒后仍找不到就在控制台警告一次（quiet 时不警告：锚点本来就可能不在，如检查器量画布上的幻灯片）。
 * 返回 null 时调用方不渲染浮层。
 */
export function useAnchorElement(name: string | undefined, { quiet = false }: { quiet?: boolean } = {}): HTMLElement | null {
  const root = useContext(V3RootContext)
  const [el, setEl] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (!root || !name) {
      setEl(null)
      return
    }
    const sync = () => {
      const found = findAnchor(root, name)
      setEl((cur) => (cur === found ? cur : found))
      return found
    }
    sync()
    const mo = new MutationObserver(() => sync())
    mo.observe(root, { childList: true, subtree: true })
    const t = window.setTimeout(() => {
      if (!quiet && !findAnchor(root, name)) console.warn(`[v3 kit] 找不到锚点「${name}」：检查名字，或确认锚点元素在当前视图里（见 kit/anchor.ts ANCHORS）`)
    }, 1000)
    return () => {
      mo.disconnect()
      window.clearTimeout(t)
    }
  }, [root, name, quiet])
  return el
}

/** 同一锚点上同时打开的 kit 浮层数（菜单里再开子弹层时不提前去掉标记）。 */
const OPEN_COUNT = new WeakMap<HTMLElement, number>()

/**
 * 锚定打开的浮层（Popover / Menu 的 anchor 模式）开着时，给锚点元素加 data-v3-open：
 * 触发器按 data-[v3-open] 显示按下态（与 Radix 触发器自己打开时的 data-state=open 同一外观，见 ui.tsx OPEN_GHOST），
 * 菜单看起来从它展开。场景不必再用 regions 包一层给按钮补底色。
 */
export function useMarkAnchorOpen(el: HTMLElement | null, open: boolean) {
  useLayoutEffect(() => {
    if (!el || !open) return
    OPEN_COUNT.set(el, (OPEN_COUNT.get(el) ?? 0) + 1)
    el.setAttribute("data-v3-open", "")
    return () => {
      const n = (OPEN_COUNT.get(el) ?? 1) - 1
      OPEN_COUNT.set(el, n)
      if (n <= 0) el.removeAttribute("data-v3-open")
    }
  }, [el, open])
}

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

const sameRect = (a: Rect | null, b: Rect) => !!a && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height

/**
 * 量元素的视口矩形，并随视口尺寸、元素尺寸、滚动变化更新（给代理触发器定位用）。
 * fraction 给了时返回元素内某一点（0–1 的相对坐标）的零尺寸矩形——右键菜单的落点。
 */
export function useTrackedRect(el: HTMLElement | null, fraction?: { x: number; y: number }): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null)
  const fx = fraction?.x
  const fy = fraction?.y
  useLayoutEffect(() => {
    if (!el) {
      setRect(null)
      return
    }
    const measure = () => {
      const r = el.getBoundingClientRect()
      const next = fx === undefined || fy === undefined ? { left: r.left, top: r.top, width: r.width, height: r.height } : { left: r.left + r.width * fx, top: r.top + r.height * fy, width: 0, height: 0 }
      setRect((cur) => (sameRect(cur, next) ? cur : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, true)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", measure, true)
    }
  }, [el, fx, fy])
  return rect
}

export type Side = "top" | "bottom" | "left" | "right"
export type Align = "start" | "center" | "end"

/** 浮层在锚点上的缺省位置：工具条按钮 → 向上居中、离工具条上沿 8px；检查器里 → 贴检查器左缘向左展开；左栏里 → 贴左栏右缘向右；其余 → 下方左对齐。 */
export function anchorPlacement(name: string, el: HTMLElement | null): { side: Side; align: Align; sideOffset: number; region: "inspector" | "rail" | null } {
  // 工具按钮上沿到工具条外沿是 4px 内边距 + 1px 边，再留 8px 间隙（与内置形状弹层一致）
  if (name.startsWith("tool-")) return { side: "top", align: "center", sideOffset: 13, region: null }
  if (name === "toolbar") return { side: "top", align: "center", sideOffset: 8, region: null }
  if (el?.closest('[data-v3-anchor="inspector"]') && name !== "inspector") return { side: "left", align: "start", sideOffset: 8, region: "inspector" }
  if (el?.closest('[data-v3-anchor="rail"]') && name !== "rail") return { side: "right", align: "start", sideOffset: 8, region: "rail" }
  return { side: "bottom", align: "start", sideOffset: 4, region: null }
}
