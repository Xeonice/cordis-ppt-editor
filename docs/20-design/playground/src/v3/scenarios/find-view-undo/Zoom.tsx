import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { DeckSlideView, FIELD_FRAME, ICON, Menu, useAnchorElement, useEditor, useSceneState, useTrackedRect, type MenuSpec } from "../../kit"
import type { RegionDefaults } from "../types"
import { ZOOM_COMMANDS } from "./MainMenu"

/**
 * 03-20 缩放（v3）：检查器页签行右端的「77% ▾」。
 * - 读数是量出来的实际比例（幻灯片显示宽 ÷ 1280，与网格右上胶囊同一口径），所以菜单只放命令、不带选中态（同网格缩放菜单的理由）。
 * - 菜单：顶部输入框（10–400，↵ 确认）· 放大 ⌘+ / 缩小 ⌘− · 适应窗口 ⌘0 / 适应宽度 · 50 / 75 / 100 ⌘1 / 150 / 200%。
 * - 放大超过适应窗口时，画布出现原生滚动条（不自定义样式），滚轮或空格 + 拖拽平移；⌘0 或菜单「适应窗口」一键归位。
 * 底座的单页缩放菜单是固定档位单选「57%」，与实测不符（1600 × 1000 视口下幻灯片 984 宽 ≈ 77%），本目录的状态里用这一版替换（见交付说明）。
 */

/** 设计宽度：100% = 幻灯片显示 1280px 宽（与网格视图的读数口径一致）。 */
const SLIDE_W = 1280
const STEPS = [10, 25, 50, 75, 100, 125, 150, 200, 300, 400]

export type ZoomValue = "fit" | "fit-width" | number

/** 缩放比例的场景共享状态（kit useSceneState：检查器读数、菜单与画布读写同一份，换状态即复位）；各状态的初值写在 data.zoom（缺省适应窗口）。 */
export function useZoom(): [ZoomValue, (z: ZoomValue) => void] {
  const { data } = useEditor()
  return useSceneState<ZoomValue>("find-view-undo.zoom", (data.zoom as ZoomValue | undefined) ?? "fit")
}

/** 当前读数：量画布上幻灯片框的宽度（适应窗口、适应宽度、任意比例都一样准）。 */
function useReadout(): number {
  useZoom()
  const rect = useTrackedRect(useAnchorElement("slide"))
  return rect ? Math.round((rect.width / SLIDE_W) * 100) : 0
}

const clamp = (n: number) => Math.min(400, Math.max(10, Math.round(n)))

function step(cur: number, dir: 1 | -1): number {
  if (dir > 0) return STEPS.find((s) => s > cur) ?? 400
  return [...STEPS].reverse().find((s) => s < cur) ?? 10
}

/** 菜单顶部的比例输入框：28px，与检查器数值字段同一外观（FIELD_FRAME：淡底、不描边，悬停出细边，rulings §4.25 DS-35）；↵ 确认并夹到 10–400。按键不冒泡给菜单（否则菜单的首字母检索会抢焦点）。 */
function ZoomInput({ value, onZoom }: { value: number; onZoom: (z: ZoomValue) => void }) {
  const [text, setText] = useState(String(value))
  return (
    <label className={`${FIELD_FRAME} flex h-7 items-center gap-2 px-2 transition-colors hover:bg-(--v3-field-fill-hover) focus-within:ring-(--v3-accent)`}>
      <span className="shrink-0 text-[12px] leading-none text-(--v3-text-2)">缩放</span>
      <input
        value={text}
        aria-label="缩放比例（10%–400%）"
        inputMode="numeric"
        spellCheck={false}
        onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ""))}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === "Enter") {
            const n = Number(text)
            if (n) {
              const z = clamp(n)
              setText(String(z))
              onZoom(z)
            }
          }
        }}
        className="min-w-0 flex-1 bg-transparent text-[12px] leading-none text-(--v3-text) tabular-nums outline-none"
      />
      <span className="shrink-0 text-[11px] leading-none text-(--v3-text-2)">%</span>
    </label>
  )
}

/** 缩放菜单条目：输入框 + 与主菜单「视图 › 缩放」相同的命令（点了真的缩放）。 */
function zoomMenuItems(readout: number, setZoom: (z: ZoomValue) => void): MenuSpec[] {
  const act: Record<string, () => void> = {
    "zoom-in": () => setZoom(step(readout, 1)),
    "zoom-out": () => setZoom(step(readout, -1)),
    "zoom-fit": () => setZoom("fit"),
    "zoom-fit-width": () => setZoom("fit-width"),
  }
  return [
    { type: "custom", id: "zoom-input", render: <ZoomInput key={readout} value={readout} onZoom={setZoom} /> },
    { type: "separator" },
    ...ZOOM_COMMANDS.map((it): MenuSpec => {
      if (it.type !== undefined && it.type !== "item") return it
      const pct = /^zoom-(\d+)$/.exec(it.id)?.[1]
      return { ...it, onSelect: pct ? () => setZoom(Number(pct)) : act[it.id] }
    }),
  ]
}

/**
 * 缩放读数 + 菜单（替换底座检查器页签行右端的缩放按钮，位置、尺寸、外观相同）。
 * 菜单右对齐展开在按钮下方 4px（同底座 ZoomMenu）。
 */
function ZoomControl({ defaultOpen }: { defaultOpen: boolean }) {
  const readout = useReadout()
  const [, setZoom] = useZoom()
  return (
    <Menu
      defaultOpen={defaultOpen}
      align="end"
      sideOffset={4}
      label="缩放"
      className="w-[200px]"
      items={zoomMenuItems(readout, setZoom)}
      trigger={
        <button
          type="button"
          aria-label={`缩放 ${readout}%`}
          data-v3-anchor="view-zoom.zoom"
          className="flex h-7 items-center gap-1 rounded-[6px] px-2 text-[12px] leading-none text-(--v3-text-2) tabular-nums transition-colors hover:bg-(--v3-panel-2) hover:text-(--v3-text) data-[state=open]:bg-(--v3-panel-2) data-[state=open]:text-(--v3-text)"
        >
          {readout}%
          <ChevronDown {...ICON} />
        </button>
      }
    />
  )
}

/**
 * 包一层检查器（regions.inspector）：藏起底座的缩放按钮（占位保留），在同一位置放 ZoomControl。
 * 底座按钮的位置：顶行 48 + 页签行 44 居中（top 56）、右缘 = 280 − 16 + 8（right 8）。
 */
export function InspectorWithZoom({ children, menuOpen = false }: { children: ReactNode; menuOpen?: boolean }) {
  return (
    <div className="relative flex shrink-0 [&_[data-v3-anchor=zoom]]:invisible">
      {children}
      <div className="absolute top-[56px] right-2">
        <ZoomControl defaultOpen={menuOpen} />
      </div>
    </div>
  )
}

/** 备注框（与底座 Stage 相同的结构与尺寸），自定义画布里复用。 */
function NotesBox() {
  return (
    <div className="shrink-0 px-12">
      <div className="mx-auto mb-2 h-1 w-10 rounded-[2px] bg-(--v3-handle)" aria-hidden="true" />
      <div data-v3-anchor="notes" className="h-[120px] rounded-[8px] border border-(--v3-border) bg-(--v3-panel) p-3 text-[12px] leading-[18px] text-(--v3-text-3)">
        添加演讲者备注…
      </div>
    </div>
  )
}

/**
 * 放大后的画布：幻灯片按比例定宽（1280 × 比例），画布区域原生滚动条，四周留出与适应窗口相同的边距（左右 48、上 40、下 24）。
 * 样张打开时停在左上角（实际产品以指针位置为锚点缩放）。备注框照常在下方。
 * 滚动条用浏览器原生样式：macOS 的叠加式滚动条只在滚动时出现，Windows 常驻。
 */
function ZoomedStage({ zoom, overlay }: { zoom: number; overlay?: ReactNode }) {
  const ed = useEditor()
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // 样张从左上角开始看（页边、标题与第一块内容都在视野里，一眼看出是放大了的页面）；产品里以指针位置为锚点
    el.scrollLeft = 0
    el.scrollTop = 0
  }, [zoom])
  return (
    <>
      <div ref={ref} data-v3-anchor="stage" className="relative min-h-0 flex-1 overflow-auto" onClick={() => ed.setSelection("none")}>
        <div className="flex min-h-full w-max min-w-full items-center justify-center px-12 pt-10 pb-6">
          {/* 幻灯片尺寸随缩放比例变化，用 style 给宽度（09 §6.2：幻灯片的位置 / 尺寸允许用 style） */}
          <div data-v3-anchor="slide" className="relative shrink-0 rounded-[4px] shadow-(--v3-slide-shadow)" style={{ width: (SLIDE_W * zoom) / 100 }}>
            <DeckSlideView slide={ed.current} where="canvas" selection={ed.selection} className="rounded-[4px]" />
            {overlay}
          </div>
        </div>
      </div>
      {ed.notes && <NotesBox />}
    </>
  )
}

/** 画布区域（regions.stage）：适应窗口 / 适应宽度时用底座画布（16:9 视口里两者相同），固定比例时换成可滚动的 ZoomedStage。 */
export function StageWithZoom({ defaults, overlay }: { defaults: RegionDefaults; overlay?: ReactNode }) {
  const [zoom] = useZoom()
  return typeof zoom === "number" ? <ZoomedStage zoom={zoom} overlay={overlay} /> : <>{defaults.stage()}</>
}
