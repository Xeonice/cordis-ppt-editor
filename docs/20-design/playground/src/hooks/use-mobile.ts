import { useSyncExternalStore } from "react"

/**
 * 响应断点（裁决 Q19，与信息架构 §6 / PRD NF-07 / 设计 04 §5 统一）：
 * - desktop ≥ 1024：完整编辑器；
 * - compact 640–1024：紧凑，缩略图栏收为 44px 图标条、检查器按需浮层（Sheet）；
 * - narrow < 640：仅查看，两侧栏都改抽屉。
 */
export const BREAKPOINT_DESKTOP = 1024
export const BREAKPOINT_COMPACT = 640

export type Breakpoint = "desktop" | "compact" | "narrow"

const desktopQuery = `(min-width: ${BREAKPOINT_DESKTOP}px)`
const compactQuery = `(min-width: ${BREAKPOINT_COMPACT}px)`

function subscribe(onChange: () => void) {
  const lists = [window.matchMedia(desktopQuery), window.matchMedia(compactQuery)]
  lists.forEach((mql) => mql.addEventListener("change", onChange))
  return () => lists.forEach((mql) => mql.removeEventListener("change", onChange))
}

function getSnapshot(): Breakpoint {
  if (window.matchMedia(desktopQuery).matches) return "desktop"
  if (window.matchMedia(compactQuery).matches) return "compact"
  return "narrow"
}

function getServerSnapshot(): Breakpoint {
  return "desktop"
}

/** 当前断点；多处调用共享同一组 matchMedia 订阅，窗口跨越阈值时同步更新。 */
export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** 兼容旧调用（ui/sidebar.tsx 等）：是否窄屏（< 640）。 */
export function useIsMobile(): boolean {
  return useBreakpoint() === "narrow"
}
