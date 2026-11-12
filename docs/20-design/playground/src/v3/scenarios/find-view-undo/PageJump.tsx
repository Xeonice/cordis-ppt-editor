import { useEffect, useRef, useState } from "react"
import { PageJumpHint, useCanvasEscape, useDismissOnMasterToggle, useEditor } from "../../kit"

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

/** 这一下按键不归页导航：输入框里、带修饰键（⌘ / Ctrl / ⌥）时一律不接 */
const ignored = (e: KeyboardEvent) => isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey

/**
 * 03-20 页导航「数字 + ↵」（画布聚焦、非文本编辑态）：敲数字时画布顶部居中浮出一个提示签，写明要去哪一页，↵ 跳转、Esc 取消。
 * 没有这一页时提示「没有第 N 页 · 共 M 页」，↵ 不动。PageUp / PageDown、Home / End 直接翻页，不出提示。
 * 提示条：kit PageJumpHint（2026-10-22 第 3 批转正并入 kit，与放映跳页同一个件，TB-104；画法逐像素不变：kit CanvasHint 36 高、圆角 12 的浮动胶囊档、浮层阴影，按键用 KeyCap，数字等宽加粗）。放 canvasOverlay。
 * 本状态可以直接在页面上敲数字试（输入框里不响应）。
 */
export function PageJump({ initial = "" }: { initial?: string }) {
  const ed = useEditor()
  const [digits, setDigitsState] = useState(initial)
  const ref = useRef(initial)
  const setDigits = (v: string) => {
    ref.current = v
    setDigitsState(v)
  }
  const n = Number(digits)
  const total = ed.deck.length
  const exists = ed.deck.some((s) => s.n === n)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ignored(e)) return
      const d = ref.current
      if (/^\d$/.test(e.key)) setDigits((d + e.key).replace(/^0+/, "").slice(0, 3))
      else if (e.key === "Backspace" && d) setDigits(d.slice(0, -1))
      else if (e.key === "Escape" && d) setDigits("")
      else if (e.key === "Enter" && d) {
        const target = Number(d)
        if (ed.deck.some((s) => s.n === target)) {
          ed.goTo(target)
          setDigits("")
        }
      } else if (e.key === "PageDown" || e.key === "PageUp" || e.key === "Home" || e.key === "End") {
        e.preventDefault()
        const ns = ed.deck.map((s) => s.n)
        const i = ns.indexOf(ed.slide)
        const next = e.key === "Home" ? ns[0] : e.key === "End" ? ns[ns.length - 1] : ns[Math.min(ns.length - 1, Math.max(0, i + (e.key === "PageDown" ? 1 : -1)))]
        if (next !== undefined) ed.goTo(next)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [ed])

  // Esc 逐层里的一级（kit useCanvasEscape；2026-10-29 母版视图第一步修复第 3 轮，复验 R3-B1）：提示条在时登记。母版视图里宿主在退出之前先问它——
  // 这一下只取消跳页（提示条上写的「Esc 取消」），不同时退出母版视图；接不接与上面的监听同一组判断（ignored）。
  // 宿主接住时已清掉 ref，上面的监听随后见到的是空串、不再重复处理；普通视图不经这里
  useCanvasEscape(!!digits, (e) => {
    if (ignored(e) || !ref.current) return false
    setDigits("")
    return true
  })

  // 进出母版视图时清掉（rulings §4.25 DS-158、TB-204）：普通视图里敲到一半的页码不带进母版视图，母版视图里敲出的提示条退出时一并清掉；
  // 清掉 ref 的同时提示条卸下，上面登记的那一级 Esc 随之注销
  useDismissOnMasterToggle(!!digits, () => setDigits(""))

  if (!digits) return null
  return <PageJumpHint digits={digits} total={total} exists={exists} />
}
