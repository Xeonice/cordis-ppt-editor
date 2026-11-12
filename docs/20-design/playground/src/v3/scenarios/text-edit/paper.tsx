import { useLayoutEffect, useRef, useState } from "react"

/**
 * 03-16 场景的小工具（只在 scenarios/text/ 里用）。
 * 原来的 PaperScope（纸面亮色 token 岛）、OpenTip（可常开、按句分行的工具提示）、StopClicks（挡住浮层点击冒泡）已并入 kit：
 * PaperScope、Tip 的 open / lines、kit 浮层自带的 stopPropagation。
 */

/** 幻灯片在屏幕上的缩放（屏幕宽 / 960）：叠加层按屏幕尺寸绘制界面件时，用它把占位符框换成屏幕像素，判断放不放得下。 */
export function useSlideScale() {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setScale(el.clientWidth / 960 || 1)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, scale }
}

/** 960 × 540 设计稿坐标（pt）→ 幻灯片百分比框（style）。 */
export interface PtBox {
  x: number
  y: number
  w: number
  h: number
}
export const pctStyle = (b: PtBox) => ({ left: `${(b.x / 960) * 100}%`, top: `${(b.y / 540) * 100}%`, width: `${(b.w / 960) * 100}%`, height: `${(b.h / 540) * 100}%` })
export const pctBox = (b: PtBox) => ({ x: (b.x / 960) * 100, y: (b.y / 540) * 100, w: (b.w / 960) * 100, h: (b.h / 540) * 100 })
