/**
 * 全局主题：在应用启动时应用一次，之后由 ThemeToggle 通过 store 修改。
 * 解析顺序：页面内显式选择（light/dark）> 宿主显式标记（artifact 查看器等在 <html data-theme> 上盖章）> 系统偏好。
 * 之前主题逻辑挂在 ThemeToggle 的 effect 里：没有渲染 ThemeToggle 的路由首屏不会应用主题，且多个实例各自为政。
 */
export type ThemeMode = "system" | "light" | "dark"

const KEY = "cordex-theme"
const listeners = new Set<() => void>()
let mode: ThemeMode = readStored()

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    return v === "light" || v === "dark" ? v : "system"
  } catch {
    return "system"
  }
}

function hostTheme(): "light" | "dark" | null {
  const t = document.documentElement.getAttribute("data-theme")
  return t === "dark" || t === "light" ? t : null
}

export function resolveDark(m: ThemeMode = mode): boolean {
  if (m === "dark") return true
  if (m === "light") return false
  const host = hostTheme()
  if (host) return host === "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function applyTheme(): void {
  const dark = resolveDark()
  const root = document.documentElement
  root.classList.toggle("dark", dark)
  root.style.colorScheme = dark ? "dark" : "light"
}

export function getThemeMode(): ThemeMode {
  return mode
}

export function setThemeMode(next: ThemeMode): void {
  mode = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* 私密窗口等情况忽略 */
  }
  applyTheme()
  listeners.forEach((l) => l())
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

let initialized = false
export function initTheme(): void {
  if (initialized) return
  initialized = true
  applyTheme()
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme)
  // 宿主（artifact 查看器）切换主题时只改 data-theme 属性，不会通知页面
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      mode = readStored()
      applyTheme()
      listeners.forEach((l) => l())
    }
  })
}
