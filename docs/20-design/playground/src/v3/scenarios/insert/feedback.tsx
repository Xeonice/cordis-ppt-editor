import type { ReactNode } from "react"
import { Toast, Toasts, useSceneState } from "../../kit"

/**
 * insert 场景里对话框「应用」「插入」之后的轻提示（放 canvasOverlay）：对话框关掉后画布上给一句结果，可撤销的带「撤销」。
 * 对话框组件用 useInsertToast() 发，画布上的 InsertToasts 显示（场景共享状态 insert.toast，换状态即复位）。
 */

const KEY = "insert.toast"

interface InsertToast {
  key: number
  text: ReactNode
  /** 带「撤销」（这一步可以撤销） */
  undo?: boolean
  tone?: "neutral" | "success"
}

export function useInsertToast() {
  const [, set] = useSceneState<InsertToast | null>(KEY, null)
  return (text: ReactNode, opts: { undo?: boolean; tone?: "neutral" | "success" } = {}) => set({ key: Date.now(), text, undo: opts.undo, tone: opts.tone ?? "success" })
}

export function InsertToasts() {
  const [t, set] = useSceneState<InsertToast | null>(KEY, null)
  if (!t) return null
  return (
    <Toasts>
      <Toast key={t.key} tone={t.tone} action={t.undo ? "撤销" : undefined} onAction={() => set(null)} onClose={() => set(null)}>
        {t.text}
      </Toast>
    </Toasts>
  )
}
