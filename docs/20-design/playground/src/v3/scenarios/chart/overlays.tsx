import { useEffect, type KeyboardEvent } from "react"
import { cn } from "@/lib/utils"
import { boxStyle, HoverBox, PaperScope, PH_M3_ENABLED, PlaceholderIconBar as KitIconBar, SelectionBox, Toast, Toasts, useDismissOnMasterToggle, useEditor, type Box, type EditorCtx } from "../../kit"
import { CHART_PAGE, CONTENT_BOX, findSubtype, LEFT_BOX, pct, RIGHT_BOX, SLIDE_H, type CqBox } from "./model"
import { openDataSection, undoToast, useChart } from "./store"

/**
 * 画布叠加层（画在幻灯片框里、不进缩略图与导出）：图表的点选区域与选中框、空内容占位符的图标条、插入目标框。
 * 图表不设迷你工具条（rulings §4.25 DS-22，DS-13 的延伸，与表格同一取舍）：「编辑数据」在检查器「数据」分区的「展开」，
 * 「更改类型 ▾」是检查器「类型」字段的下拉；双击图表（或图表聚焦时按 Enter）只展开检查器「数据」分区、焦点到首个数值格（50/24 §3.6）。
 * 选中框 8 个缩放手柄、没有旋转手柄（graphicFrame 不旋转、不翻转）；评审 / 查看时不画手柄、空占位符不出图标条。
 */

export const chartOverlay = (ctx: EditorCtx) => <ChartOverlay ctx={ctx} />

function ChartOverlay({ ctx }: { ctx: EditorCtx }) {
  const [m, set] = useChart()
  if (ctx.slide !== CHART_PAGE) return null
  const ro = ctx.mode !== "edit"
  const box = pct(m.page === "m2" ? LEFT_BOX : CONTENT_BOX)
  const hasChart = m.page !== "empty"
  const selected = ctx.selection === "chart"
  const st = findSubtype(m.spec)
  const name = m.page === "radar" ? "雷达图：区域经营雷达（此类型仅支持查看）" : `${st.name}：${m.options.title ? m.options.titleText : "无标题"}`
  const activate = () => {
    if (m.page === "radar")
      set({
        toast: { title: "此类型仅支持查看：雷达图", description: "不在可编辑的五类里；可以移动、缩放和复制，数据与格式保持原样导出。", action: "查看保真详情", tone: "info" },
      })
    else if (m.page === "chart" && !ro) openDataSection(set)
  }
  return (
    <>
      {hasChart && <ChartHit box={box} label={name} onSelect={() => ctx.setSelection("chart")} onActivate={activate} />}
      {hasChart && selected && <SelectionBox box={box} handles={ro ? "none" : "all"} />}
      {m.page === "empty" && ctx.tool === "chart" && <HoverBox box={pct(CONTENT_BOX)} />}
      {m.page === "empty" && !ro && <M3IconBar box={CONTENT_BOX} />}
      {m.page === "m2" && !ro && (
        <IconBarArea box={RIGHT_BOX}>
          <KitIconBar kinds={["table", "picture", "chart", "video"]} />
        </IconBarArea>
      )}
    </>
  )
}

/** 图表对象：可点选、可聚焦；双击或 Enter 触发 onActivate（可编辑图表展开「数据」分区；只读类型弹提示） */
function ChartHit({ box, label, onSelect, onActivate }: { box: Box; label: string; onSelect: () => void; onActivate: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-roledescription="图表"
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onSelect()
        onActivate()
      }}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault()
          onActivate()
        }
      }}
      className="pointer-events-auto absolute cursor-default focus-visible:outline-none"
      style={boxStyle(box)}
    />
  )
}

/* ------------------------------------------------------------------ 空内容占位符的图标条 */

/** 图标条所在区域：占位符框去掉左上「• 单击此处添加文本」一行，余下居中（同 03-16 / 03-30） */
function IconBarArea({ box, hint = true, children }: { box: CqBox; hint?: boolean; children: React.ReactNode }) {
  const area: Box = { x: box.x, y: ((box.y + 5) / SLIDE_H) * 100, w: box.w, h: ((box.h - 5) / SLIDE_H) * 100 }
  return (
    <PaperScope>
      <div className="pointer-events-none absolute flex flex-col items-center justify-center gap-3" style={boxStyle(area)}>
        {children}
        <p className={cn("text-[12px] leading-4 text-(--v3-text-2)", !hint && "invisible")}>单击图标插入，或把图片拖到这里</p>
      </div>
    </PaperScope>
  )
}

/**
 * M3 形态的图标条（03-16 G-80）：kit PlaceholderIconBar，图表已开放（PH_M3_ENABLED）——点「图表」在图标下缘弹出与工具条同一个 ChartTypeMenu
 * （锚点 chart.ph-chart，菜单开着时按下态、aria-expanded），选定即填入此占位符。
 */
function M3IconBar({ box }: { box: CqBox }) {
  const [m, set] = useChart()
  return (
    <IconBarArea box={box} hint={!m.phMenu}>
      <KitIconBar
        kinds={["table", "picture", "chart", "video"]}
        enabled={PH_M3_ENABLED}
        anchors={{ chart: "chart.ph-chart" }}
        popups={{ chart: "menu" }}
        pressedKind={m.phMenu ? "chart" : undefined}
        onPick={(k) => k === "chart" && set({ phMenu: !m.phMenu })}
      />
    </IconBarArea>
  )
}


/* ------------------------------------------------------------------ 轻提示（canvasOverlay） */

/** 插入、更改类型、删除类别 / 系列、只读类型双击的反馈：底部工具条上方居中（v3 无状态栏，DS-6）；10 秒后收起 */
export function ChartToasts() {
  const ed = useEditor()
  const [m, set] = useChart()
  const t = m.toast
  useEffect(() => {
    if (!t) return
    const id = window.setTimeout(() => set({ toast: null }), 10_000)
    return () => window.clearTimeout(id)
  }, [t, set])
  // 进出母版视图时收起（rulings §4.25 TB-204）：清掉驱动它的场景状态，不只收起 kit 轻提示——这一份常驻、不换 key，
  // 只收起件本身的话往返之后计时内同一位置的下一条就画不出来；收起后退出母版视图也不再弹出（DS-169）
  useDismissOnMasterToggle(!!t, () => set({ toast: null }))
  if (!t) return null
  return (
    <Toasts>
      <Toast tone={t.tone ?? "neutral"} description={t.description} action={t.action} onAction={() => (t.undo ? undoToast(m, set, ed) : set({ toast: null }))}>
        {t.title}
      </Toast>
    </Toasts>
  )
}
