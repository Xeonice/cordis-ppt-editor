import { useSyncExternalStore } from "react"

/**
 * 编辑器的三种断点形态（50/10 §2.2、50/09 §6.3 detectBreakpoint、设计 01 §6，DS-17）：
 *   desktop ≥ 1024 · compact 640–1024（不含 1024）· narrow < 640 或 pointer: coarse（仅查看）。
 * 与 50/09 的 detectBreakpoint 同源：同一组媒体查询，窗口宽度或指针类型变化时跟着变。
 * 场景要强制某个形态（截图、Hub 链接）就自己读 data（如 narrow 场景的 data.form），真实视口用这里的 useBreakpoint。
 */
export type Breakpoint = "desktop" | "compact" | "narrow"

const Q_NARROW = "(max-width: 639.98px), (pointer: coarse)"
const Q_COMPACT = "(max-width: 1023.98px)"

function subscribe(cb: () => void): () => void {
  const qs = [matchMedia(Q_NARROW), matchMedia(Q_COMPACT)]
  for (const q of qs) q.addEventListener("change", cb)
  return () => {
    for (const q of qs) q.removeEventListener("change", cb)
  }
}

/** 当前视口的断点形态（非 React 处也能用）。 */
export function detectBreakpoint(): Breakpoint {
  if (typeof matchMedia !== "function") return "desktop"
  if (matchMedia(Q_NARROW).matches) return "narrow"
  if (matchMedia(Q_COMPACT).matches) return "compact"
  return "desktop"
}

/** 真实视口对应的断点形态，随窗口变化更新。 */
export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, detectBreakpoint, () => "desktop")
}
