import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, Download, FileLock2, FileWarning, Fullscreen, Info, Minus, Plus, Search, StickyNote, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { BlockingPage, Button, DeckSlideView, FIELD_FRAME, ICON, IconButton, Menu, PluginBanner, Progress, TOGGLE_ON, useEditor, useSceneState, ZOOM_COMMANDS, type MenuSpec } from "../../kit"
import { FindHits, FindPanel, REVENUE_HITS, useFind } from "../find-view-undo/FindReplace"
import { OPENING_DECK } from "../main-states/slides"
import { useNoFindShortcut, useNotesOpen, usePaging, useViewerForm, useViewerSeed, type ZoomValue } from "./data"
import { AltNarrowViewer, NarrowViewer } from "./narrow"
import { NotesText, ThumbStrip } from "./parts"
import { SUMMARY_ANCHOR, SUMMARY_KEY } from "./summary"

/**
 * 查看器壳（03-25，preset-slide-viewer 的 viewer-shell；50/12 §3 定行为）的 v3 画法，第 3 批定稿。用 regions 把左栏、检查器、工具条换成 null、stage 换成整个壳（同第 2 批 fidelity.viewer-shell）。
 * 产品里壳是框架无关的 TS + CSS、≤ 15 KB（rulings §4.3、C-06），样张用 React 画、只取画法与 token：控件都是朴素件（图标按钮、页码输入、读数菜单、贴边面板），不取 ui-react 组件。
 *
 * 桌面（容器宽 ≥ 640）：
 * - 顶部条：贴边、高 48、panel 底、1px 下边线（与 fidelity.viewer-shell 同高同位置，第 2 批 ⓘ 卡的位置不变）：
 *   上一页 ← · 下一页 → · 页码输入「3」/ 6 ┊（居中）缩小 − · 读数「118% ▾」· 放大 + ┊ 全屏 F · 搜索（宿主开 search；不占 ⌘F，见 data.ts useNoFindShortcut）· ⓘ 保真摘要 ·（宿主开 notes）备注。
 *   没有标题、返回、左栏、检查器、评论、协同与插件面板（01-IA §8.1）。
 * - 缩放读数是量出来的实际比例（幻灯片显示宽 ÷ 1280，与编辑器同一口径），点开与编辑器 03-20 §4 同一份菜单：比例输入（10–400）· 放大 / 缩小 · 适应窗口 / 适应宽度 · 50–200%，
 *   补上 OF-14「适应窗口」的入口；放大超过窗口时画布出原生滚动条。查看器的快捷键按 50/12 §3：+ / − 缩放（编辑器是 ⌘+ / ⌘−，查看器嵌在宿主页里不抢浏览器缩放）。
 * - 全屏（F）：整个查看器容器进入浏览器全屏、工具条照常；宿主 iframe 没授权全屏（document.fullscreenEnabled 为假）时不渲染这个按钮、不留占位。
 *   图标用 Fullscreen（Maximize 在仅查看形态的「更多」里已表示「适应窗口」，一个图标只表示一件事）；03-25 / 01-IA §8.1 写的「全屏/放映」改为只有「全屏」（查看器没有放映舞台）。
 * - 键盘（50/12 §3）：← → / PageUp PageDown 翻页、Home / End 首末页、+ / − 缩放、F 全屏；工具条按钮都能 Tab 到；焦点在输入、菜单、面板、缩略图条里时这些键交给它们。
 */

const SLIDE_W = 1280
const STEPS = [10, 25, 50, 75, 100, 125, 150, 200, 300, 400]
const PAD_X = 48
const PAD_Y = 40
const OFF = "文档打开后可用"

/** 放进 regions.stage：按打开阶段与形态取画面 */
export function Viewer() {
  const v = useViewerSeed()
  const form = useViewerForm()
  // ⓘ 卡的开合：与第 2 批 ViewerSummary 共用的场景状态，壳先读到、按本状态写初值
  useSceneState<boolean>(SUMMARY_KEY, !!v.summaryOpen)
  // 不占浏览器的 ⌘F（50/12 §3 的查看器键位没有它；搜索只从 🔍 打开）
  useNoFindShortcut()
  if (v.phase === "failed") return <ViewerFailed />
  if (form === "narrow") return <NarrowViewer />
  if (form === "narrow-alt") return <AltNarrowViewer />
  return <DesktopViewer />
}

/* ------------------------------------------------------------------ 打开失败 */

/**
 * 打开失败（03-25「失败」、50/12 §3）：容器里只剩阻断页——与编辑器打开失败同一布局（kit BlockingPage：32px 线性图标 · 16px 标题 · 12px 说明 · 一行按钮），
 * 文案按 03-13 错误码表；按钮只有宿主提供下载回调时的「下载原文件」（画布底上的次按钮 outline），没有「返回文档列表」（查看器没有文档列表）、「重试」（来源在宿主手里）
 * 与「复制诊断信息」（诊断由集成方经 error/raised 事件取）。没提供下载回调时不出按钮、不留空位。
 */
function ViewerFailed() {
  const v = useViewerSeed()
  const encrypted = v.failure === "encrypted"
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-(--v3-canvas)">
      <BlockingPage
        headingId="viewer-open-failed"
        icon={encrypted ? <FileLock2 size={32} strokeWidth={1.5} aria-hidden="true" /> : <FileWarning size={32} strokeWidth={1.5} aria-hidden="true" />}
        title={encrypted ? "此文件已加密，当前版本无法打开" : "无法打开该文档"}
        actions={
          v.host.download ? (
            <Button variant="outline">
              <Download {...ICON} aria-hidden="true" />
              下载原文件
            </Button>
          ) : undefined
        }
      >
        {encrypted ? "请先在 PowerPoint 中去除密码后再打开" : "请稍后重试；如果问题持续，请联系管理员"}
      </BlockingPage>
    </div>
  )
}

/* ------------------------------------------------------------------ 桌面 */

function useBox(ref: RefObject<HTMLElement | null>) {
  const [box, setBox] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setBox({ w: r.width, h: r.height })
    const ro = new ResizeObserver(([e]) => {
      if (e) setBox({ w: e.contentRect.width, h: e.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return box
}

function DesktopViewer() {
  const ed = useEditor()
  const v = useViewerSeed()
  const host = v.host
  const loading = v.phase === "loading"
  const root = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLDivElement>(null)
  const box = useBox(canvas)
  const [zoom, setZoom] = useSceneState<ZoomValue>("viewer.zoom", v.zoom ?? "fit")
  const [notesOpen, setNotesOpen] = useNotesOpen()
  const [find, setFind] = useFind()
  const [summaryOpen, setSummaryOpen] = useSceneState<boolean>(SUMMARY_KEY, !!v.summaryOpen)
  const [pluginBar, setPluginBar] = useState(!!v.pluginBar)
  const p = usePaging()

  // 打开中：幻灯片下方多一行进度，适应窗口时给它留出高度
  const extra = loading ? 52 : 0
  // 四周留白：同编辑器 48 / 40；容器窄于 960（宿主页面里的小容器）时收到 16，先保证幻灯片大
  const tight = box.w > 0 && box.w < 960
  const padX = tight ? 16 : PAD_X
  const padY = tight ? 16 : PAD_Y
  const availW = Math.max(0, box.w - 2 * padX)
  const availH = Math.max(0, box.h - 2 * padY - extra)
  const fitW = Math.min(availW, (availH * 16) / 9)
  const slideW = zoom === "fit" ? fitW : zoom === "fit-width" ? availW : (SLIDE_W * zoom) / 100
  const readout = Math.round((slideW / SLIDE_W) * 100)
  const stepZoom = (dir: 1 | -1) => setZoom(dir > 0 ? (STEPS.find((s) => s > readout) ?? 400) : ([...STEPS].reverse().find((s) => s < readout) ?? 10))
  const fullscreenOk = typeof document !== "undefined" && document.fullscreenEnabled !== false
  const fullscreen = () => {
    void root.current?.requestFullscreen?.().catch(() => undefined)
  }

  // 键盘（50/12 §3）：焦点在输入、菜单、面板、缩略图条里时交给它们
  const keys = useRef<(e: KeyboardEvent) => void>(() => undefined)
  keys.current = (e) => {
    if (loading || e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return
    const t = e.target instanceof HTMLElement ? e.target : null
    if (t?.closest("input, textarea, [role=menu], [role=dialog], [data-viewer-strip], [data-viewer-notes]")) return
    switch (e.key) {
      case "ArrowLeft":
      case "PageUp":
        p.prev()
        break
      case "ArrowRight":
      case "PageDown":
        p.next()
        break
      case "Home":
        p.first()
        break
      case "End":
        p.last()
        break
      case "+":
      case "=":
        stepZoom(1)
        break
      case "-":
        stepZoom(-1)
        break
      case "f":
      case "F":
        if (fullscreenOk) fullscreen()
        break
      default:
        return
    }
    e.preventDefault()
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => keys.current(e)
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [])

  const notesBtn = useRef<HTMLButtonElement>(null)
  const closeNotes = () => {
    notesBtn.current?.focus({ preventScroll: true })
    setNotesOpen(false)
  }
  // 打开中：这一页的版式骨架（与编辑器打开中同一份 OPENING_DECK）
  const slide = loading ? (OPENING_DECK.find((s) => s.n === ed.slide) ?? ed.current) : ed.current

  return (
    <div ref={root} className="flex min-h-0 flex-1 flex-col bg-(--v3-canvas)">
      <header aria-label="查看器工具条" className="flex h-12 shrink-0 items-center gap-1 border-b border-(--v3-border) bg-(--v3-panel) px-3">
        <IconButton label="上一页" kbd="←" disabled={loading || p.atFirst} reason={loading ? OFF : "已是第一页"} onClick={p.prev}>
          <ChevronLeft {...ICON} />
        </IconButton>
        <IconButton label="下一页" kbd="→" disabled={loading || p.atLast} reason={loading ? OFF : "已是最后一页"} onClick={p.next}>
          <ChevronRight {...ICON} />
        </IconButton>
        <PageField disabled={loading} />
        <div className="mx-auto flex items-center gap-1">
          <IconButton label="缩小" kbd="−" disabled={loading || readout <= 10} reason={loading ? OFF : "已是最小"} onClick={() => stepZoom(-1)}>
            <Minus {...ICON} />
          </IconButton>
          <ZoomReadout readout={readout} disabled={loading} defaultOpen={!!v.zoomMenu} onZoom={setZoom} onStep={stepZoom} />
          <IconButton label="放大" kbd="+" disabled={loading || readout >= 400} reason={loading ? OFF : "已是最大"} onClick={() => stepZoom(1)}>
            <Plus {...ICON} />
          </IconButton>
        </div>
        {fullscreenOk && (
          <IconButton label="全屏" kbd="F" disabled={loading} reason={OFF} onClick={fullscreen}>
            <Fullscreen {...ICON} />
          </IconButton>
        )}
        {host.search && (
          <IconButton
            label="搜索"
            disabled={loading}
            reason={OFF}
            aria-haspopup="dialog"
            aria-expanded={find.open}
            data-state={find.open ? "open" : "closed"}
            onClick={() => setFind({ open: !find.open })}
          >
            <Search {...ICON} />
          </IconButton>
        )}
        {/* ⓘ 开关摘要卡：受控（关掉后再点或按 ↵ 重新打开），aria-expanded 读出开合；卡片关闭后焦点回到它（kit Popover）——同第 2 批 fidelity.viewer-shell */}
        <IconButton
          label="保真摘要"
          data-v3-anchor={SUMMARY_ANCHOR}
          aria-haspopup="dialog"
          aria-expanded={summaryOpen}
          disabled={loading}
          reason={OFF}
          onClick={() => setSummaryOpen(!summaryOpen)}
        >
          <Info {...ICON} />
        </IconButton>
        {host.notes && (
          // 备注是开关（aria-pressed）：按下态强调色淡底（DS-36，同放映的「黑屏」）
          <IconButton
            ref={notesBtn}
            label="备注"
            pressed={notesOpen}
            disabled={loading}
            reason={OFF}
            onClick={() => setNotesOpen(!notesOpen)}
            className={notesOpen ? cn(TOGGLE_ON, "text-(--v3-text) hover:bg-(--v3-toggle-on) hover:text-(--v3-text)") : undefined}
          >
            <StickyNote {...ICON} />
          </IconButton>
        )}
      </header>

      {/* DS-110 未采纳的备选（alt-missing-plugin-bar）：工具条下方一条可关闭的缺插件细条（与编辑器缺插件横幅同一个件，DS-41 中性底 + 警告色拼图；查看器没有插件面板，所以没有「查看详情」） */}
      {pluginBar && (
        <PluginBanner kind="missing" title="本文档用到了插件「二维码形状」" onClose={() => setPluginBar(false)} closeLabel="关闭提示">
          3 处内容以占位显示，内容已保留
        </PluginBanner>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={canvas} className="relative min-h-0 flex-1">
            <div className="absolute inset-0 overflow-auto">
              <div className="flex min-h-full w-max min-w-full" style={{ padding: `${padY}px ${padX}px` }}>
                <div className="m-auto flex shrink-0 flex-col items-center gap-6">
                  <div className="relative rounded-[4px] shadow-(--v3-slide-shadow)" style={{ width: slideW }}>
                    <DeckSlideView slide={slide} where="canvas" className="rounded-[4px]" />
                    {host.search && !loading && <FindHits hits={REVENUE_HITS} />}
                  </div>
                  {loading && (
                    // 打开中（与编辑器 main-states.opening 同一画法：版式骨架 + 进度与一句阶段文字）；没有「取消」——来源在宿主手里
                    <div className="flex h-7 items-center gap-3 whitespace-nowrap">
                      <span className="text-[12px] leading-none text-(--v3-text-2)">正在解析母版与版式…</span>
                      <Progress value={62} label="打开进度" className="w-40" />
                      <span className="w-7 text-[11px] leading-none text-(--v3-text-2) tabular-nums">62%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/*
              搜索（03-21 查找面板，去掉替换区，M2 P1）：画布右上、工具条下方。没有替换区时 FindPanel 自己把「展开替换」那一列收成 0、查找框贴左（离面板左缘 12）
              （2026-10-22 第 3 批转正并入 kitRequest g3 K6，原来这里的类名覆盖随之删去，画面不变）
            */}
            {host.search && !loading && <FindPanel hits={REVENUE_HITS} canReplace={false} />}
          </div>
          {host.thumbnails && !loading && p.total > 1 && <ThumbStrip />}
        </div>
        {host.notes && notesOpen && !loading && <NotesPanel onClose={closeNotes} />}
      </div>
    </div>
  )
}

/** 页码输入：28 高、字段外框（同检查器数值字段）；输入页号 ↵ 跳转，越界或空时恢复为当前页 */
function PageField({ disabled }: { disabled?: boolean }) {
  const p = usePaging()
  const [text, setText] = useState(String(p.slide))
  useEffect(() => setText(String(p.slide)), [p.slide])
  return (
    <>
      <label className={cn(FIELD_FRAME, "ml-1 flex h-7 w-10 items-center justify-center", disabled ? "bg-(--v3-field-fill-off)" : "transition-colors hover:bg-(--v3-field-fill-hover) focus-within:ring-(--v3-accent)")}>
        <input
          value={text}
          readOnly={disabled}
          aria-disabled={disabled || undefined}
          aria-label={`页码（1–${p.total}）`}
          inputMode="numeric"
          onChange={(e) => setText(e.target.value.replace(/\D/g, "").slice(0, 3))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const n = Number(text)
              if (p.pages.includes(n)) p.go(n)
              else setText(String(p.slide))
            }
          }}
          onBlur={() => setText(String(p.slide))}
          className={cn("w-full bg-transparent text-center text-[12px] leading-none tabular-nums outline-none", disabled ? "text-(--v3-text-3)" : "text-(--v3-text)")}
        />
      </label>
      <span className="text-[12px] leading-none text-(--v3-text-2) tabular-nums">/ {p.total}</span>
    </>
  )
}

/** 缩放读数 + 菜单（03-20 §4 同一份：比例输入 10–400 · 放大 / 缩小 · 适应窗口 / 适应宽度 · 50–200%）；查看器的键位按 50/12 §3 写 + / −，其余命令不带快捷键 */
function ZoomReadout({ readout, disabled, defaultOpen, onZoom, onStep }: { readout: number; disabled?: boolean; defaultOpen: boolean; onZoom: (z: ZoomValue) => void; onStep: (d: 1 | -1) => void }) {
  const cls =
    "flex h-7 items-center gap-1 rounded-[6px] px-2 text-[12px] leading-none tabular-nums transition-colors data-[state=open]:bg-(--v3-panel-2) data-[state=open]:text-(--v3-text)"
  if (disabled)
    return (
      <button type="button" aria-label={`缩放 ${readout}%（${OFF}）`} aria-disabled="true" className={cn(cls, "cursor-default text-(--v3-text-3)")}>
        {readout}%
        <ChevronDown {...ICON} />
      </button>
    )
  const act: Record<string, () => void> = {
    "zoom-in": () => onStep(1),
    "zoom-out": () => onStep(-1),
    "zoom-fit": () => onZoom("fit"),
    "zoom-fit-width": () => onZoom("fit-width"),
  }
  const KBD: Record<string, string | undefined> = { "zoom-in": "+", "zoom-out": "−" }
  const items: MenuSpec[] = [
    { type: "custom", id: "zoom-input", render: <ZoomInput key={readout} value={readout} onZoom={onZoom} /> },
    { type: "separator" },
    ...ZOOM_COMMANDS.map((it): MenuSpec => {
      if (it.type !== undefined && it.type !== "item") return it
      const pct = /^zoom-(\d+)$/.exec(it.id)?.[1]
      return { ...it, kbd: KBD[it.id], onSelect: pct ? () => onZoom(Number(pct)) : act[it.id] }
    }),
  ]
  return (
    <Menu
      defaultOpen={defaultOpen}
      align="center"
      sideOffset={4}
      label="缩放"
      className="w-[200px]"
      items={items}
      trigger={
        <button type="button" aria-label={`缩放 ${readout}%`} className={cn(cls, "text-(--v3-text-2) hover:bg-(--v3-panel-2) hover:text-(--v3-text)")}>
          {readout}%
          <ChevronDown {...ICON} />
        </button>
      }
    />
  )
}

/** 菜单顶部的比例输入（同 03-20 §4：28 高、字段外框，↵ 确认并夹到 10–400；按键不冒泡给菜单） */
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
              const z = Math.min(400, Math.max(10, Math.round(n)))
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

/* ------------------------------------------------------------------ 备注面板（宿主 notes: true） */

/**
 * 备注面板（03-25「备注抽屉」，Q18）：右侧贴边、非模态（不加遮罩、点画布不关），宽 320、panel 底、1px 左边线，从工具条下沿到底（v3 面板贴边，原玻璃 rounded-l-3xl 作废）。
 * 标题行高 56（与检查器整栏面板带说明时同高）：「备注 · 第 3 页」13px 600 + 页标题 12px text-2 + 关闭 × Esc；正文 13px / 20 只读纯文本、保留换行、不渲染富文本；
 * 翻页时保持打开并换成那一页的备注；没有备注时一句「这一页没有演讲者备注」（rulings §4.25 DS-138：与桌面只读态、编辑器仅查看形态的只读备注同一句）。Esc（焦点在面板里）或 × 关闭，焦点回到「备注」按钮。
 */
function NotesPanel({ onClose }: { onClose: () => void }) {
  const ed = useEditor()
  const text = ed.current.notes
  return (
    <aside
      aria-label={`备注 · 第 ${ed.slide} 页`}
      data-viewer-notes=""
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.defaultPrevented) {
          e.preventDefault()
          onClose()
        }
      }}
      className="flex w-80 shrink-0 flex-col border-l border-(--v3-border) bg-(--v3-panel)"
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-(--v3-border) pr-3 pl-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] leading-4 font-semibold text-(--v3-text)">备注 · 第 {ed.slide} 页</h2>
          <p className="mt-1 text-[12px] leading-4 text-(--v3-text-2)">{ed.current.name}</p>
        </div>
        <IconButton label="关闭备注" kbd="Esc" onClick={onClose}>
          <X {...ICON} />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <NotesText text={text} />
      </div>
    </aside>
  )
}
