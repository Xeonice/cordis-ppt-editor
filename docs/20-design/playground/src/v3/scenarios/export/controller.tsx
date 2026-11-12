import { useEffect, useRef, useState } from "react"
import { holdFocusDuring, Toast, Toasts, useEditorCommand } from "../../kit"
import { FileName } from "../import/FileName"
import { isBusy, useExport } from "./model"

/**
 * export 场景常驻在画布叠加层的控制件（单页与网格视图都在）：
 * 1. 底座命令 file.export（主菜单「文件 › 导出…」与 ⇧⌘E——Windows / Linux Ctrl+Shift+E，rulings §4.25 DS-78；⇧⌘E 由底座 useBaseKeys 发，第 3 批转正时删去这里的 document 级监听）
 *    打开对话框，记住上次的格式与范围（D17）；没有导出权限时不接（菜单项不可用、底座也不发 ⇧⌘E，DS-105）。
 * 2. 计时：等待同步倒数、服务端排队、生成进度；走完时按 DS-100 关闭对话框并出轻提示（或停在「导出完成」，DS-100 未采纳的备选）。
 *    状态一出现就在这些阶段（或一出现就有轻提示）时定格，用户第一次点按或按键后才开始走（静态截图不受时序影响）。
 * 3. 完成轻提示：画布底部、工具条上方（kit Toasts）；中性、无图标，「已导出「X」」；服务端生成的格式另带「下载」（浏览器拦了自动下载时再点）。
 *    约 5 秒后自己收起，悬停或焦点在里面时停住、移开后重新计时（同页级提示条的停留规则）。
 */
export function ExportController() {
  const x = useExport()
  const { ui, set, seed } = x
  // 计时回调里要读最新的推导值（服务端格式、文件名）
  const live = useRef(x)
  live.current = x

  const open = () => {
    holdFocusDuring()
    set({ open: true, phase: "options", progress: 0, held: false })
  }
  // 对话框已经开着时（生成中按 ⇧⌘E）不再回到选项
  useEditorCommand("file.export", seed.noPermission ? null : () => {
    if (!live.current.ui.open) open()
  })

  // 演示定格：第一次点按或按键后开始走
  useEffect(() => {
    if (!ui.held) return
    const release = () => set({ held: false })
    document.addEventListener("pointerdown", release, true)
    document.addEventListener("keydown", release, true)
    return () => {
      document.removeEventListener("pointerdown", release, true)
      document.removeEventListener("keydown", release, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.held])

  // 等待同步 → （服务端）排队 → 生成中 → 完成
  useEffect(() => {
    if (ui.held || !ui.open || !isBusy(ui.phase)) return
    const cur = live.current
    if (ui.phase === "waiting") {
      const id = window.setTimeout(() => {
        if (ui.unsynced > 1) set({ unsynced: ui.unsynced - 1 })
        else set({ unsynced: 0, phase: cur.server ? "queued" : "generating", progress: 0 })
      }, 900)
      return () => window.clearTimeout(id)
    }
    if (ui.phase === "queued") {
      const id = window.setTimeout(() => set({ phase: "generating" }), 1400)
      return () => window.clearTimeout(id)
    }
    const id = window.setTimeout(() => {
      const next = Math.min(100, ui.progress + 6)
      if (next < 100) return set({ progress: next })
      const done = live.current
      if (done.seed.done === "dialog") set({ phase: "done", progress: 100 })
      else set({ open: false, phase: "options", progress: 0, toast: { name: done.fileName, server: done.server, key: Date.now() } })
    }, 150)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.phase, ui.progress, ui.unsynced, ui.held, ui.open])

  return <ExportToast />
}

/**
 * 完成轻提示。读屏结构与第 2 批定的一致：每条轻提示自己是一个播报区（kit Toast 的 role=status），是 Toasts 容器的直接子项，只经这一条通道播报一次——
 * 带文字按钮「下载」的也一样（同 _kit.toast 的「撤销」），不在外面再套一层非播报区的包装。悬停或焦点在提示里时停住：事件挂在不占版面的外层
 * （display: contents，在 Toasts 容器之外），不改提示本身的结构。文件名过长时中间省略、保留扩展名（FileName，与对话框同一个件）
 */
function ExportToast() {
  const { ui, set } = useExport()
  const [paused, setPaused] = useState(false)
  const t = ui.toast
  // 换了一条（新的一次导出）时不沿用上一条的停住状态：提示在指针下收起时不会再收到 mouseleave
  useEffect(() => setPaused(false), [t?.key])
  useEffect(() => {
    if (!t || ui.held || paused) return
    const id = window.setTimeout(() => set({ toast: null }), 5000)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.key, ui.held, paused])
  if (!t) return null
  return (
    <span className="contents" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <Toasts>
        <Toast key={t.key} action={t.server ? "下载" : undefined}>
          已导出「<FileName name={t.name} className="max-w-[360px]" />」
        </Toast>
      </Toasts>
    </span>
  )
}
