import { useEffect, useRef } from "react"
import { focusBack, overlayOpen, userHasInteracted } from "../../kit"
import type { SetChart } from "./store"

/**
 * 数据面板（桌面：检查器坞加宽；紧凑：底部 Sheet）的键盘与焦点（03-31「Esc：编辑中放弃本格输入；未在编辑时收起数据面板，回到图表选中」、07 §2）。
 * 逐层退出：行列右键菜单等浮层先关（Radix 自己处理）→ 格内有未提交的输入时先放弃（DataGrid，焦点留在格内）→ 再按 Esc 关闭面板，焦点还给触发处。
 */

/** 单元格里有没有未提交的输入：值改过，或是被判为非法的输入（aria-invalid，格里显示的是没提交的文本） */
export const cellDirty = (el: Element | null): boolean =>
  el instanceof HTMLInputElement && el.hasAttribute("data-cell") && (el.value !== el.defaultValue || el.getAttribute("aria-invalid") === "true")

/**
 * 面板开着时 Esc 关闭它（挂在 document 捕获阶段）：焦点在面板里、在画布上、在 body 上（点过空白、单元格失焦后）都关得掉；
 * 比工具提示的 Esc 先处理（键盘聚焦到「关闭」时提示会自动弹出，不必按两次）。
 * 格内有未提交输入时不管，由单元格先放弃（preventDefault + 焦点留在格内）；浮层（行列菜单）开着时不管，由它先关。
 */
export function useDataPanelEsc(close: () => void) {
  const ref = useRef(close)
  ref.current = close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return
      if (cellDirty(document.activeElement) || overlayOpen()) return
      e.preventDefault()
      ref.current()
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [])
}

/**
 * 用户打开面板（点「展开」、双击图表等）时，把焦点交给网格首个数值格——触发它的「展开」按钮随检查器一起卸载了，焦点不能掉到 body；
 * 场景状态里一出现就打开的面板（还没有人操作过）不抢焦点，截图里没有焦点环。
 */
export function useFocusFirstCell() {
  useEffect(() => {
    if (!userHasInteracted()) return
    document.querySelector<HTMLInputElement>('[aria-label="编辑图表数据"] input[inputmode="decimal"]')?.focus({ preventScroll: true })
  }, [])
}

/**
 * 面板关闭（Esc、×）或「收起到检查器」之后，焦点还给触发处：
 * 触发它的「展开」按钮在检查器「数据」分区里——关闭后分区收起（回到只选中图表），回来的是分区标题按钮；收起到检查器时分区展开着，回来的是「展开」按钮；
 * 检查器不在页面上（紧凑窗口的抽屉没开）时交给 fallback（打开抽屉的开关）、再没有就交给画布。等检查器重新渲染出来再找（下一帧）。
 */
export function closeDataPanel(set: SetChart, to: "header" | "expand" = "header", fallback?: string) {
  set(to === "expand" ? { panel: false, dataOpen: true, gridMenu: null } : { panel: false, dataOpen: false, invalid: null, gridMenu: null })
  window.requestAnimationFrame(() => {
    const sec = document.querySelector<HTMLElement>('[data-v3-anchor="section-chart.data"]')
    const header = sec?.querySelector<HTMLElement>("h3 button") ?? null
    const expand = Array.from(sec?.querySelectorAll<HTMLElement>("button") ?? []).find((b) => b.textContent?.trim() === "展开") ?? null
    // fallback：检查器不在页面上时的次选落点（选择器，如紧凑窗口里打开抽屉的「显示检查器」开关），再没有就交给画布
    focusBack((to === "expand" ? (expand ?? header) : header) ?? (fallback ? document.querySelector<HTMLElement>(fallback) : null))
  })
}
