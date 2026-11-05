import { useState } from "react"
import { Blocks, Copy, Lock, Maximize2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Attribution, Button, CheckRow, closeWithFocusBack, deckWith, EmptyNote, GeometrySection, HitArea, ICON, IconButton, InspectorNotice, inspectorPanel, inspectorSections, InspectorTakeover, InspectorTopRow, PanelState, PanelTitle, Phrases, px, Section, sectionsFor, SelectionBox, SlideFooter, SlideTitle, StaticRow, TextField, useAnchorElement, useEditor, useSceneState, useTrackedRect, ZoomMenu, type DeckSlide, type EditorCtx, type InspectorCtx, type RegionDefaults } from "../../kit"

import { PluginPlaceholder } from "./banners"
import { DIAGNOSTICS, pct, POLL, POLL_TOTAL } from "./data"

/**
 * 插件整页面板作为检查器页签的呈现（06 §2.2 `ui.panel{slot:'inspector'}`，rulings §4.25 DS-38 定为整栏面板）：以第三方插件「现场投票」（beta:live-poll）为例。
 *   - 推荐：整栏面板（同 DS-26 图表「编辑数据」）——入口是该插件为自己的元素贡献的检查器分区「现场投票」（ui.inspectorSection）右上的「展开」；
 *     检查器栏由 280 临时加宽到 400、整栏换成面板，协作行不动，标题行「现场投票」+ 归属（第三方插件 · Beta Labs）+「收起到检查器」+「关闭」。
 *   - 备选：检查器第三个页签（设计 · 评论 · 现场投票），面板常驻、宽度只有 280（见 TabInspector）。
 * 宿主插件 FAILED 时面板内容区换成「该面板不可用」+ 摘要 + 重试（06 §2.2、§3）；评审 / 只读角色下面板顶部一行权限说明、写操作不出现（DS-15，不加禁用蒙版）。
 * 投票结果只在画布上的投票元素里画一份（标杆对照「插件面板内容」：Figma Slides 的投票结果也只在画布上）：面板与检查器分区都不再列四条结果，
 * 「状态」写一行汇总「进行中 · 已进行 12 分钟 · 128 人已投票」（POLL_SUMMARY）。
 */

/** 投票状态的一行汇总（面板「状态」节与检查器插件分区共用）：按词组换行，窄栏里不断在词中间（Q7） */
const POLL_SUMMARY = ["进行中 · ", `${POLL.elapsed} · `, `${POLL_TOTAL} 人已投票`]

/* ------------------------------------------------------------------ 幻灯片：第 6 页换成「现场投票」，投票元素由插件绘制 */

/** 投票元素在幻灯片上的位置（960 × 540 设计稿坐标，pt） */
const POLL_BOX = px(67, 170, 826, 296)

function PollElement() {
  return (
    <div className="absolute top-[17.7cqw] left-[7cqw] flex h-[30.8cqw] w-[86cqw] flex-col rounded-[1cqw] bg-(--s-card) p-[3cqw]">
      <p className="text-[2.6cqw] leading-none font-semibold text-(--s-ink)">{POLL.question}</p>
      <div className="mt-[2.6cqw] flex flex-col gap-[1.7cqw]">
        {POLL.options.map((o) => (
          <div key={o.label} className="flex items-center gap-[2cqw]">
            <span className="w-[17cqw] shrink-0 text-[1.9cqw] leading-none text-(--s-ink)">{o.label}</span>
            <span className="relative h-[2.2cqw] flex-1 overflow-hidden rounded-[0.4cqw] bg-(--s-brand-soft)">
              <span className="absolute inset-y-0 left-0 rounded-[0.4cqw] bg-(--s-brand)" style={{ width: `${pct(o.votes)}%` }} />
            </span>
            <span className="w-[10cqw] shrink-0 text-right text-[1.9cqw] leading-none font-semibold text-(--s-ink) tabular-nums">{pct(o.votes)}%</span>
          </div>
        ))}
      </div>
      <p className="mt-auto text-[1.5cqw] leading-none text-(--s-mute)">
        {POLL_TOTAL} 人已投票 · 扫码或访问 {POLL.link} 参与
      </p>
    </div>
  )
}

function PollSlide({ failed }: { failed?: boolean }) {
  return (
    <>
      <SlideTitle>现场投票</SlideTitle>
      {failed ? <PluginPlaceholder name="现场投票" reason="插件启动失败" className="top-[17.7cqw] left-[7cqw] h-[30.8cqw] w-[86cqw]" /> : <PollElement />}
      <SlideFooter page={6} />
    </>
  )
}

export const POLL_DECK: DeckSlide[] = deckWith({ 6: { name: "现场投票", render: () => <PollSlide /> } })
export const POLL_FAILED_DECK: DeckSlide[] = deckWith({ 6: { name: "现场投票", render: () => <PollSlide failed /> } })

/**
 * 画布：第 6 页上的投票元素可点选（选中种类 plugins-poll），选中时画选中框。
 * 评审 / 只读浏览（画布只读，设计 04 §2.3a、DS-23）只画 1px 强调色框，不画手柄与尺寸角标——与图表 chart/overlays.tsx（handles={ro ? "none" : "all"}）同一口径
 */
export const pollOverlay = (ctx: EditorCtx) => {
  if (ctx.slide !== 6) return null
  const ro = ctx.mode !== "edit"
  return (
    <>
      <HitArea box={POLL_BOX} label="投票（现场投票插件）" onClick={() => ctx.setSelection("plugins-poll")} />
      {ctx.selection === "plugins-poll" && <SelectionBox box={POLL_BOX} handles={ro ? "none" : "corners"} label={ro ? undefined : "826 × 296"} />}
    </>
  )
}

/* ------------------------------------------------------------------ 检查器：插件元素的分区（ui.inspectorSection，排在内置分区之后） */

/** 整栏面板开着没有（场景状态，初值读 data.pollPanel）；「展开」打开、「收起到检查器」/「关闭」/ Esc 收起 */
export function usePollPanel() {
  const ed = useEditor()
  return useSceneState<boolean>("plugins.poll-panel", () => !!ed.data.pollPanel)
}

function PollGeometry({ readOnly }: InspectorCtx) {
  return <GeometrySection value={{ x: 67, y: 170, w: 826, h: 296 }} readOnly={readOnly} rotate={false} note="投票元素不旋转、不翻转（插件声明）" />
}

/**
 * 插件分区「现场投票」：问题与一行状态汇总（结果只在画布上的投票元素里画一份，不在分区里再列四行）；标题后是归属标识。右下「展开」打开整栏面板（推荐方案的入口），
 * 与图表「数据」分区的「展开」同一画法（次按钮 + Maximize2，DS-26）。备选方案（页签）下不出现「展开」：页签就是入口（Q2）。
 */
function PollSection({ readOnly, data }: InspectorCtx) {
  const [, setOpen] = usePollPanel()
  const tab = !!data.pollTab
  return (
    <Section title="现场投票" owner={{ plugin: "现场投票", vendor: "Beta Labs" }}>
      {readOnly ? <StaticRow label="问题">{POLL.question}</StaticRow> : <TextField aria="投票问题" defaultValue={POLL.question} />}
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 py-[5px] text-[12px] leading-[18px] text-(--v3-text-2)">
          <Phrases parts={POLL_SUMMARY} />
        </p>
        {!tab && (
          <Button variant="secondary" className="shrink-0 gap-1 px-2" data-v3-anchor="plugins.poll-expand" onClick={() => setOpen(true)}>
            <Maximize2 size={14} strokeWidth={1.5} aria-hidden="true" />
            展开
          </Button>
        )}
      </div>
    </Section>
  )
}

inspectorPanel({ kind: "plugins-poll", title: "投票" })
inspectorSections([
  { id: "plugins.poll-geometry", kinds: ["plugins-poll"], order: 10, component: PollGeometry },
  { id: "plugins.poll", kinds: ["plugins-poll"], order: 100, component: PollSection },
])

/* ------------------------------------------------------------------ 面板内容（推荐的整栏面板与备选的页签共用） */

/** 问题、参与方式、状态三节；结果只在画布上的投票元素里（不再有「实时结果」一节），状态节写一行汇总 */
export function PollPanelContent({ readOnly }: { readOnly?: boolean }) {
  return (
    <>
      {readOnly && <InspectorNotice icon={<Lock {...ICON} aria-hidden="true" />}>只读 · 评审模式下不可编辑</InspectorNotice>}
      <Section title="问题">{readOnly ? <p className="text-[12px] leading-[18px] text-(--v3-text)">{POLL.question}</p> : <TextField aria="投票问题" defaultValue={POLL.question} />}</Section>
      <Section title="参与方式">
        {readOnly ? (
          <>
            <StaticRow label="链接">{POLL.link}</StaticRow>
            <StaticRow label="匿名投票">允许</StaticRow>
            <StaticRow label="放映时">显示实时结果</StaticRow>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <TextField aria="投票链接" defaultValue={POLL.link} className="flex-1" />
              <IconButton label="复制链接">
                <Copy {...ICON} />
              </IconButton>
            </div>
            <CheckRow label="允许匿名投票" defaultChecked />
            <CheckRow label="放映时显示实时结果" defaultChecked />
          </>
        )}
      </Section>
      <Section title="状态">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 text-[12px] leading-[18px] text-(--v3-text)">
            <Phrases parts={POLL_SUMMARY} />
          </span>
          {!readOnly && <Button variant="secondary">结束投票</Button>}
        </div>
      </Section>
    </>
  )
}

/** 面板标题行的说明：归属（06 §2.2「插件面板必须在标题栏右侧带归属标识」，§4），写成文字、不靠悬停 */
const POLL_SUBTITLE = (
  <span className="inline-flex items-center gap-1">
    <Blocks size={12} strokeWidth={1.5} aria-hidden="true" />
    第三方插件 · Beta Labs
  </span>
)

/** 宿主插件失败、面板正开着（06 §2.2、§3）：内容区换成错误态，不整段消失；内容级插件写「如持续失败，请联系管理员」 */
function PollFailed() {
  const diag = DIAGNOSTICS["beta:live-poll"]!
  return (
    <PanelState title="该面板不可用" action={<Button variant="secondary">重试</Button>} note="仅在本会话重试；如持续失败，请联系管理员">
      {diag.summary}
    </PanelState>
  )
}

/** 推荐：检查器整栏面板（随场景状态开关，regions.inspector；同 chart/DataPanel.tsx） */
export const pollInspectorRegion = (ctx: EditorCtx, d: RegionDefaults) => <PollInspectorSwitch ctx={ctx} d={d} />

function PollInspectorSwitch({ ctx, d }: { ctx: EditorCtx; d: RegionDefaults }) {
  const [open, setOpen] = usePollPanel()
  // 面板跟着它的触发处（投票元素的分区）走：选中别的对象或点空白时收起，与检查器随选中切换同一规则
  if (!open || ctx.selection !== "plugins-poll") return <>{d.inspector()}</>
  const failed = !!ctx.data.pollFailed
  // 收起到检查器、关闭、Esc：面板卸载、检查器换回分区后，焦点交回触发它的「展开」（同图表数据面板，DS-26）——
  // 「展开」随面板收起才重新挂上：同步提交收起、在同一个任务里交过去，不经过 body（kit closeWithFocusBack）
  const close = () => closeWithFocusBack(() => setOpen(false), "plugins.poll-expand", document.querySelector("[data-v3-takeover]"))
  return (
    <InspectorTakeover
      title="现场投票"
      label="现场投票面板"
      subtitle={POLL_SUBTITLE}
      width={400}
      onCollapse={close}
      onClose={close}
      footer={failed || ctx.mode !== "edit" ? undefined : <p className="text-[12px] leading-[18px] text-(--v3-text-2)">结果每 5 秒更新；结束投票后结果保留在幻灯片上</p>}
    >
      {failed ? <PollFailed /> : <PollPanelContent readOnly={ctx.mode !== "edit"} />}
    </InspectorTakeover>
  )
}

/* ------------------------------------------------------------------ 备选：检查器第三个页签 */

/** 缩放读数：量画布上的幻灯片框（与底座检查器同一口径：显示宽 ÷ 1280） */
function useZoom() {
  const rect = useTrackedRect(useAnchorElement("slide", { quiet: true }))
  return rect ? `${Math.round((rect.width / 1280) * 100)}%` : "—"
}

type TabId = "design" | "comments" | "poll"

/**
 * 备选方案的检查器（局部版本：底座只有「设计 / 评论」两个页签）：插件面板作为第三个页签常驻在页签行，标签 = 面板标题（≤ 10 字）+ 归属图标；
 * 宽度仍是 280，面板内容按窄栏排；面板入口就是页签，分区里不再有「展开」（Q2 入口唯一）。
 */
export const pollTabRegion = (ctx: EditorCtx) => <TabInspector ctx={ctx} />

function TabInspector({ ctx }: { ctx: EditorCtx }) {
  const [tab, setTab] = useState<TabId>((ctx.data.pollTabInitial as TabId | undefined) ?? "poll")
  const zoom = useZoom()
  const tabs: { v: TabId; label: string }[] = [
    { v: "design", label: "设计" },
    { v: "comments", label: "评论" },
    { v: "poll", label: "现场投票" },
  ]
  const ictx: InspectorCtx = { selection: ctx.selection, slide: ctx.current, readOnly: false, data: ctx.data }
  return (
    <aside data-v3-anchor="inspector" style={{ width: 280 }} className="flex shrink-0 flex-col border-l border-(--v3-border) bg-(--v3-panel) select-none">
      <InspectorTopRow />
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-(--v3-border) px-4">
        <div role="tablist" aria-label="检查器" className="flex items-center gap-1">
          {tabs.map(({ v, label }) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={tab === v}
              aria-label={v === "poll" ? "现场投票（由「现场投票」插件提供）" : undefined}
              onClick={() => setTab(v)}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-[6px] px-3 text-[12px] leading-none font-medium whitespace-nowrap transition-colors",
                tab === v ? "bg-(--v3-on-fill) text-(--v3-text) ring-1 ring-(--v3-on-line) ring-inset" : "v3-off-cue text-(--v3-text-2) hover:text-(--v3-text)",
              )}
            >
              {label}
              {v === "poll" && <Attribution plugin="现场投票" vendor="Beta Labs" />}
            </button>
          ))}
        </div>
        <ZoomMenu readout={zoom} className="-mr-2" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "poll" ? (
          <PollPanelContent />
        ) : tab === "comments" ? (
          <EmptyNote>第 {ctx.slide} 页还没有评论</EmptyNote>
        ) : (
          <>
            <PanelTitle>{ctx.selection === "plugins-poll" ? "投票" : `幻灯片 ${ctx.slide}`}</PanelTitle>
            {sectionsFor(ctx.selection).map((s) => (
              <s.component key={s.id} {...ictx} />
            ))}
          </>
        )}
      </div>
    </aside>
  )
}
