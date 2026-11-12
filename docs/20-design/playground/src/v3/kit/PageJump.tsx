import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { FIELD_FRAME } from "../ui"
import { CanvasHint } from "./FloatingPanel"
import { KeyCap } from "./controls"
import { userHasInteracted } from "./layer"

/**
 * 页导航「数字 + ↵」的提示条（03-20 §7；放映的跳页复用同一个件，rulings §4.25 TB-104、DS-62 同一种状态只留一种画法）——第 3 批转正时由 find-view-undo/PageJump.tsx 的提示条画法
 * 与 present/stage.tsx 的 JumpHint / JumpInput 合并进 kit（kitRequest g3 K2），画法逐像素相同：kit CanvasHint（36 高、圆角 12 的浮动胶囊档、浮层阴影），按键用 KeyCap，数字等宽加粗。
 * - PageJumpHint：敲数字时浮出「转到第 N 页 ┊ ↵ 跳转 ┊ Esc 取消」；没有这一页时「没有第 N 页 · 共 M 页」（↵ 不出现）。esc：写不写「Esc 取消」（编辑器写，放映不写：放映里 Esc 是退出放映）。
 * - PageJumpInput：放映「更多 › 跳至页码…」的输入形态——「转到第 [__] 页」（28 高的数字输入，字段外框 FIELD_FRAME；用户打开时焦点在输入里）· 共 M 页 ┊ ↵ 跳转；点别处收起。
 *   点在条上不冒泡（放映里单击舞台是翻页）。
 */
export function PageJumpHint({ digits, total, exists, esc = true }: { digits: string; total: number; exists: boolean; esc?: boolean }) {
  const n = Number(digits)
  return (
    <CanvasHint label="转到页">
      {exists ? (
        <span className="text-(--v3-text)">
          转到第 <b className="text-[13px] font-semibold tabular-nums">{n}</b> 页
        </span>
      ) : (
        <span>
          没有第 <b className="font-semibold text-(--v3-text) tabular-nums">{n}</b> 页 · 共 {total} 页
        </span>
      )}
      {exists && (
        <span className="flex items-center gap-1.5">
          <KeyCap>↵</KeyCap>
          跳转
        </span>
      )}
      {esc && (
        <span className="flex items-center gap-1.5">
          <KeyCap>Esc</KeyCap>
          取消
        </span>
      )}
    </CanvasHint>
  )
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()
const stopProps = { onPointerDown: stop, onPointerUp: stop, onClick: stop }

export function PageJumpInput({ total, pages, onCommit, onClose }: { total: number; pages: number[]; onCommit: (n: number) => void; onClose: () => void }) {
  const [v, setV] = useState("")
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (userHasInteracted()) ref.current?.focus({ preventScroll: true })
  }, [])
  const n = Number(v)
  const exists = !!v && pages.includes(n)
  return (
    <div {...stopProps}>
      <CanvasHint label="跳至页码">
        <label className="flex items-center gap-2 text-(--v3-text)">
          转到第
          <input
            ref={ref}
            value={v}
            inputMode="numeric"
            aria-label={`页码（1–${total}）`}
            onChange={(e) => setV(e.target.value.replace(/\D/g, "").slice(0, 3))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                if (exists) onCommit(n)
              }
            }}
            onBlur={onClose}
            className={cn(FIELD_FRAME, "h-7 w-12 px-2 text-center text-[13px] leading-none text-(--v3-text) tabular-nums outline-none focus:ring-(--v3-accent)")}
          />
          页
        </label>
        <span>
          {v && !exists ? (
            <>
              没有第 <b className="font-semibold text-(--v3-text) tabular-nums">{n}</b> 页 · 共 {total} 页
            </>
          ) : (
            <>共 {total} 页</>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <KeyCap>↵</KeyCap>
          跳转
        </span>
      </CanvasHint>
    </div>
  )
}
