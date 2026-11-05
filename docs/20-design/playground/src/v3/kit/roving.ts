import { useLayoutEffect, type RefObject } from "react"

/**
 * 卡片网格的键盘模型（rulings §4.25 TB-107；07 §1.2b、TB-5）——首页「最近」、文档列表（含回收站、搜索结果）、模板库三处同一份（第 3 批转正时由 scenarios/documents/roving.ts 并入底座）：
 * - 整个网格一个 Tab 停靠点（漫游 tabindex）：只有「当前」那张卡片 tabIndex 0，其余 −1；第一次 Tab 进来落在第一张，离开再回来落在上次那张；
 * - ← → 前后一张、↑ ↓ 上下一行（列数取网格实际的列数，同编辑器幻灯片网格 02 §5.3；列表显示时一行一张），Home / End 第一张 / 最后一张，到头不绕回；
 * - Enter 打开（文档卡片是链接，TB-108；模板卡打开预览）；⇧F10 / 菜单键开「⋯」菜单（kit DocumentCard 自己接）；回收站卡片可聚焦、Enter 不打开；
 * - 卡片里的「⋯」「恢复」不进 Tab 顺序（tabIndex −1），焦点在卡片上时露出、指针照常可点；
 * - 焦点落到哪张（点按、方向键、程序交过去）哪张就成为当前；当前那张移走或换掉（移到回收站、重命名结束）时退到第一张，焦点另由列表交给相邻卡片。
 * 卡片元素带 data-v3-roving（文档卡片的链接、回收站卡片的容器、模板卡的按钮）；网格是 ul，每张卡片一个 li。
 */
export const ROVING_ATTR = "data-v3-roving"
export const roving = { [ROVING_ATTR]: "" } as const

/** 一张卡片（li）里的卡片元素 */
export const rovingItemIn = (li: Element | null | undefined): HTMLElement | null => li?.querySelector<HTMLElement>(`[${ROVING_ATTR}]`) ?? null

export function useRovingGrid(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    let current: HTMLElement | null = null
    const items = () => Array.from(root.querySelectorAll<HTMLElement>(`[${ROVING_ATTR}]`))
    const sync = () => {
      const list = items()
      if (!current || !list.includes(current)) current = list[0] ?? null
      for (const el of list) {
        // 按属性比：没有 tabindex 属性的 div（回收站卡片）tabIndex 读出来也是 −1，但不可聚焦，要真的写上
        const t = el === current ? "0" : "-1"
        if (el.getAttribute("tabindex") !== t) el.setAttribute("tabindex", t)
      }
    }
    sync()
    // 卡片增减、换掉（撤销、重命名结束、加载更多）后重新排一次（只看子树结构，不看属性，自己改 tabIndex 不会再触发）
    const mo = new MutationObserver(sync)
    mo.observe(root, { childList: true, subtree: true })
    const onFocusIn = (e: FocusEvent) => {
      const li = e.target instanceof Element ? e.target.closest("li") : null
      const it = li && root.contains(li) ? rovingItemIn(li) : null
      if (it && it !== current) {
        current = it
        sync()
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented || e.isComposing) return
      const t = e.target
      // 只在焦点在卡片本身时：「⋯」、重命名输入框里的方向键照常
      if (!(t instanceof HTMLElement) || !t.hasAttribute(ROVING_ATTR)) return
      const list = items()
      const i = list.indexOf(t)
      if (i < 0) return
      // 网格实际的列数（grid-template-columns 的轨道数；列表显示是 flex，取到 "none" → 一列）
      const cols = Math.max(1, getComputedStyle(root).gridTemplateColumns.split(" ").filter((x) => x && x !== "none").length)
      const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }
      let to: number | null = null
      if (e.key in step) to = i + step[e.key]!
      else if (e.key === "Home") to = 0
      else if (e.key === "End") to = list.length - 1
      if (to === null) return
      e.preventDefault()
      // 上下越过最后一行不完整的位置时落在最后一张（同编辑器幻灯片网格）；左右到头不绕回
      const next = list[Math.min(list.length - 1, Math.max(0, to))]
      if (next && next !== t) next.focus()
    }
    root.addEventListener("focusin", onFocusIn)
    root.addEventListener("keydown", onKeyDown)
    return () => {
      mo.disconnect()
      root.removeEventListener("focusin", onFocusIn)
      root.removeEventListener("keydown", onKeyDown)
    }
  }, [ref])
}
