import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useEditorMaybe } from "../editor/context"

/**
 * 白色纸面（幻灯片）上的界面件：空占位符的图标条与「插入 ▾」、上传占位框里的按钮与进度条……纸面恒为白色，
 * 所以不论界面主题都取亮色 token——在这一小块上再开一个 v3 作用域（data-v3-theme="light"，背景透明），表面色、描边、文字一并换成亮色。
 * 强调色跟随当前界面（data-v3-accent），并把外层（当前主题）的强调色记在 --paper-accent：画在纸面上的选中框、焦点环与它同色。
 * 与 .v3-paper 的区别：.v3-paper 只换文字色，这里整套 token 都换。
 *
 *   slideOverlay: <PaperScope className="pointer-events-none absolute inset-0">…</PaperScope>
 */
export function PaperScope({ className, children }: { className?: string; children: ReactNode }) {
  const accent = useEditorMaybe()?.accent ?? "blue"
  return (
    <div className="contents [--paper-accent:var(--v3-accent)]">
      <div data-v3-theme="light" data-v3-accent={accent} className={cn("v3-root bg-transparent", className)}>
        {children}
      </div>
    </div>
  )
}
