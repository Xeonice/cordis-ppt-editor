import { Fragment, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { LayoutArt, MASTER_REASON, useEditor, type ThumbFrames } from "../../kit"
import { CompactStage, CompactToolbar, InspectorDrawer, RailDrawer } from "../narrow/compact"
import { useCloseDrawerOnMasterToggle } from "../narrow/form"
import { defineScenario, mergeConfig, type EditorConfig, type RegionDefaults, type Scenario } from "../types"
import { layoutOf } from "./data"
import designThemes from "./design-themes.scenario"
import layoutPicker from "./layout-picker.scenario"
import { placeholdersFor } from "./LayoutArt"
import masterView from "./master-view.scenario"
import { KIND, kindFor, phMatch, type MvData, type MvVariant } from "./mv-state"

/**
 * 母版视图改版第二步的对比场景：五题（后来定为 DS-145、DS-146、DS-148、DS-149、DS-155）的推荐与备选画法，放在同一份数据、同一视口、同一选中下并排，供用户逐题选定。
 * 用户五题都选了推荐（rulings §4.25 DS-145、DS-146、DS-148、DS-149、DS-155），推荐画法已是母版视图与普通视图的缺省；本场景照 DS-63 保留（DS-173）：
 * 没有采纳的状态标题前加「未采纳 · 」、说明开头写由哪条 DS 定为推荐，推荐各态的说明写「已采纳」与同一画法的状态。路由不变，实现以推荐状态为准（40/10 §3a：不迁移）。
 * - 场景级配置直接取母版视图场景的场景级配置（同离线与冲突场景的取法，不另抄一份）。
 * - 被对照的母版视图状态，取它在母版视图场景里的那份状态级配置，只叠对比变体（数据键 mvVariant：未采纳的备选画法由它打开），推荐与备选只差这一处（masterFrom）。
 * - 两个普通视图态取被对照状态（版式画廊、主题颜色）的整份配置（normalFrom）：采纳的画法已是缺省，不另写开关。
 * - 「在母版中编辑」之后选中谁、各处的名称与尺寸，都由数据与规则算出；状态里只写输入。
 * - 紧凑形态的备选 C 用窄屏场景导出的紧凑外框件拼（画布、工具条、两个抽屉）；单页与网格两块外框都在进出母版视图时收起抽屉（对齐门 K6）。
 * - 缩略图对照板 ThumbBoard 是本场景私有的件。
 */

/* ------------------------------------------------------------------ 取被对照状态的配置 */

/** 母版视图场景里某个状态的状态级配置，再叠对比变体（场景级两边相同：本场景的场景级配置就是母版视图场景的） */
function masterFrom(stateId: string, variant?: MvVariant): EditorConfig {
  const st = masterView.states.find((x) => x.id === stateId)
  if (!st) console.error(`[master-view-options] 找不到对照状态 master-view.${stateId}`)
  const c = st?.editor ?? {}
  if (!variant) return c
  const prev = ((c.data ?? {}) as MvData).mvVariant
  return { ...c, data: { ...c.data, mvVariant: { ...prev, ...variant } } }
}

/** 被对照的普通视图状态的整份配置（场景级 + 状态级，与宿主同一个 mergeConfig）：采纳的画法已是普通视图的缺省，不另写开关 */
function normalFrom(s: Scenario, stateId: string): EditorConfig {
  const st = s.states.find((x) => x.id === stateId)
  if (!st) console.error(`[master-view-options] 找不到对照状态 ${s.id}.${stateId}`)
  const c = mergeConfig(s.editor, st?.editor)
  // mergeConfig 的结果里 masterView 键总在（可能是 undefined），要用 ?? 补，不能写在展开之前
  return { ...c, selection: c.selection ?? "none", masterView: c.masterView ?? { open: false } }
}

/**
 * DS-146 推荐「点哪编辑哪」（已采纳）：从 master-view.inherited（窗格选中场景级种子的那个版式、画布上选中它继承来的占位符）点检查器顶行「在母版中编辑」之后的样子——
 * 窗格选中这个版式的母版，母版上的占位符按同一条规则（phMatch：同族同索引）选中。选中谁是算出来的，不另写
 */
const seedLayout = layoutOf(((masterView.editor?.data ?? {}) as MvData).mvPane ?? "")
const inheritedPh = seedLayout ? placeholdersFor(seedLayout.master, seedLayout.kind).find((p) => p.id === ((masterFrom("inherited").data ?? {}) as MvData).mvPh) : undefined
const masterPh = seedLayout && inheritedPh ? phMatch({ type: inheritedPh.type, index: inheritedPh.idx }, placeholdersFor(seedLayout.master, "master")) : undefined
if (!masterPh) console.error("[master-view-options] scope-pane：算不出「在母版中编辑」之后母版上选中的占位符")

/* ------------------------------------------------------------------ 未采纳的备选 C 的紧凑形态外框（窄屏场景导出的件拼成，不引用紧凑母版外框） */

/** 画布：母版视图里左上胶囊没有单页 / 网格、主菜单「视图」里是「关闭母版视图」；退出后是普通的紧凑画布。进出母版视图时收起抽屉 */
function CompactStageFrame({ d }: { d: RegionDefaults }) {
  const { masterView: mode } = useEditor()
  useCloseDrawerOnMasterToggle()
  if (!mode.on) return <CompactStage d={d} />
  return <CompactStage d={d} viewToggle={false} menu={{ master: { active: true, onToggle: () => mode.exit("menu") } }} />
}

/** 网格视图的外框：带网格参数载入、退出回网格时单页的外框随之卸下，由这里补做「进出母版视图时收起抽屉」 */
function CompactGridFrame({ d }: { d: RegionDefaults }) {
  useCloseDrawerOnMasterToggle()
  return <>{d.grid()}</>
}

/** 工具条：在未遮挡的区域里居中（母版视图里是母版工具条，末端带未采纳的备选 C 的模式段）；母版视图按单页结构画，网格参数下不画 */
function CompactToolbarFrame({ d }: { d: RegionDefaults }) {
  const { view, masterView: mode } = useEditor()
  if (mode.on && view !== "single") return null
  return <CompactToolbar d={d} />
}

const COMPACT_REGIONS: EditorConfig["regions"] = {
  leftRail: (_, d) => <RailDrawer d={d} />,
  inspector: (_, d) => <InspectorDrawer d={d} />,
  stage: (_, d) => <CompactStageFrame d={d} />,
  grid: (_, d) => <CompactGridFrame d={d} />,
  toolbar: (_, d) => <CompactToolbarFrame d={d} />,
}

/* ------------------------------------------------------------------ 缩略图对照板（DS-149，本场景私有） */

/**
 * 三列：同一份缩略渲染的三种框线画法。第 1 列已采纳（DS-149），第 2、3 列未采纳；板上的列标题是画面的一部分，保持对比时的写法
 * （「现画法」指改版前的版式缩略画法）
 */
const BOARD_COLS: { frames: ThumbFrames; title: string; sub: string }[] = [
  { frames: "line", title: "推荐", sub: "一种细线" },
  { frames: "none", title: "备选 1", sub: "不画框" },
  { frames: "legacy", title: "备选 2", sub: "现画法，修裁字" },
]

type Place = "pane" | "gallery" | "field"
const PLACE_NAME: Record<Place, string> = { pane: "窗格缩略", gallery: "版式画廊卡片", field: "检查器「版式」字段" }

/** 四行（输入：画在哪、哪个版式、放大几倍）；版式名取数据 */
const BOARD_ROWS: { place: Place; layout: string; factor: number }[] = [
  { place: "pane", layout: "office-title-content", factor: 4 },
  { place: "pane", layout: "office-comparison", factor: 4 },
  { place: "gallery", layout: "office-title-content", factor: 2 },
  { place: "field", layout: "office-title-content", factor: 6 },
]

/**
 * 版式画廊卡片的实际宽：照画廊弹层的排法（弹层宽与 1px 边、正文左右内距、四列与列距，同 LayoutGallery.tsx 与 kit 弹层）排一个看不见的格子，量它的宽。
 * 画廊排法变了这里要跟着变——交互检查 X33 拿它与 layout-picker.default 里画廊卡片的实测宽比，不一致就失败
 */
function useGalleryCardWidth(): [RefObject<HTMLSpanElement | null>, number | null] {
  const probe = useRef<HTMLSpanElement>(null)
  const [w, setW] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = probe.current
    if (!el) return
    const read = () => setW(el.getBoundingClientRect().width)
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [probe, w]
}

/** 一格的缩略图：外框照它在界面里的样子画（窗格缩略的 92 宽外框、画廊卡片的外框、检查器字段的 32 × 18 外框），里面是同一份缩略渲染、只换框线画法 */
function PlaceThumb({ place, layout, frames, cardWidth }: { place: Place; layout: string; frames: ThumbFrames; cardWidth: number }) {
  const l = layoutOf(layout)
  if (!l) return null
  const art = <LayoutArt master={l.master} target={l.kind} prompts="thumb" thumbFrames={frames} />
  if (place === "field") return <span className="relative block h-[18px] w-8 shrink-0 overflow-hidden rounded-[2px] border border-(--v3-border) bg-white">{art}</span>
  if (place === "gallery")
    return (
      <span className="relative block overflow-hidden rounded-[4px] border border-(--v3-border)" style={{ width: cardWidth }}>
        {art}
      </span>
    )
  return <span className="relative block w-[92px] shrink-0 overflow-hidden rounded-[4px] border border-(--v3-border)">{art}</span>
}

/**
 * 放大的一格：先按原尺寸排版，再整体缩放（线宽、框的取整与整段取舍都照原尺寸的样子放大）；外层按量出来的原尺寸 × 倍数留位置。
 * 不用等比放大属性：那样框按放大后的尺寸取整，窗格里页脚那种只有两三像素高的框会画成空心框，原尺寸下其实是实心的一条（对照见 options 组笔记）。
 * 格下一行写实际尺寸与倍数——尺寸是量出来的，不另写数字
 */
function ZoomCell({ factor, children }: { factor: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => {
      const r = el.getBoundingClientRect()
      const next = { w: r.width / factor, h: r.height / factor }
      setSize((s) => (s && Math.abs(s.w - next.w) < 0.01 && Math.abs(s.h - next.h) < 0.01 ? s : next))
    }
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [factor])
  return (
    <figure className="flex flex-col items-start gap-2">
      <div className="relative" style={size ? { width: size.w * factor, height: size.h * factor } : undefined}>
        <div ref={ref} className="absolute top-0 left-0 origin-top-left" style={{ transform: `scale(${factor})` }}>
          {children}
        </div>
      </div>
      {size && size.w > 0 && (
        <figcaption className="text-[12px] leading-4 whitespace-nowrap text-(--v3-text-2)">
          实际 {Math.round(size.w)} × {Math.round(size.h)} · 放大 {factor} 倍
        </figcaption>
      )}
    </figure>
  )
}

/**
 * 缩略图对照板（thumbs 态的整块画布，左右栏都不画）：三列 = 推荐一种细线（已采纳）/ 备选 1 不画框 / 备选 2 原画法修裁字（这两列未采纳），每列上方一行标题；
 * 四行 = 窗格缩略两个版式、版式画廊卡片、检查器「版式」字段的缩略（采纳后这两处已与窗格同一画法）；同一行同一倍数，三列左缘、各行上沿对齐
 */
function ThumbBoard() {
  const [probe, cardWidth] = useGalleryCardWidth()
  return (
    <div className="relative flex min-h-0 flex-1 overflow-auto">
      <div aria-hidden="true" className="pointer-events-none invisible absolute top-0 left-0 w-[472px] border">
        <div className="px-3">
          <div className="grid grid-cols-4 gap-x-2">
            <span ref={probe} className="block" />
          </div>
        </div>
      </div>
      <section aria-label="缩略图三种画法" className="m-auto flex flex-col gap-5 px-12 py-8">
        <p className="text-[12px] leading-4 text-(--v3-text-2)">三种画法用同一份内容渲染；先按原尺寸排版再整体放大，线宽与整段取舍照原尺寸的样子放大。有框的两种，上边的框线画在框外、与框隔开半个像素，标题与首行文字的字顶不压线；放大后极小的字位置略偏上，离上边框线比原尺寸下近一点</p>
        <div className="grid items-start" style={{ gridTemplateColumns: `max-content repeat(${BOARD_COLS.length}, max-content)`, columnGap: 48, rowGap: 24 }}>
          <span aria-hidden="true" />
          {BOARD_COLS.map((c) => (
            <p key={c.frames} className="text-[12px] leading-4 whitespace-nowrap">
              <span className="font-medium text-(--v3-text)">{c.title}</span>
              <span className="text-(--v3-text-2)"> · {c.sub}</span>
            </p>
          ))}
          {BOARD_ROWS.map((r, i) => (
            <Fragment key={i}>
              <p className="flex flex-col text-[12px] leading-4">
                <span className="font-medium whitespace-nowrap text-(--v3-text)">{PLACE_NAME[r.place]}</span>
                <span className="whitespace-nowrap text-(--v3-text-2)">版式「{layoutOf(r.layout)?.name}」</span>
              </p>
              {BOARD_COLS.map((c) => (
                <ZoomCell key={c.frames} factor={r.factor}>
                  {r.place === "gallery" && cardWidth === null ? null : <PlaceThumb place={r.place} layout={r.layout} frames={c.frames} cardWidth={cardWidth ?? 0} />}
                </ZoomCell>
              ))}
            </Fragment>
          ))}
        </div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ 场景 */

const barToolbar = masterFrom("default", { bar: "toolbar" })

export default defineScenario({
  id: "master-view-options",
  title: "母版视图 · 拍板对比",
  specs: ["03-26"],
  batch: 1,
  summary: "推荐与备选并排：上下文条与工具条模式段、编辑范围分段、占位符标注三种、缩略图三种、主题弹层两种位置。推荐已采纳（DS-145、DS-146、DS-148、DS-149、DS-155），备选未采纳、照 DS-63 保留（DS-173）",
  editor: masterView.editor,
  states: [
    {
      id: "bar-recommended",
      title: "推荐 · 上下文条",
      note: "已采纳（DS-145），与 master-view.default 同一画法。推荐的上下文条（桌面），与 master-view.default 同一份配置、同一画面，放在这里与备选并排——一行写清在哪（母版视图）、改谁（版式与它继承的母版）、影响多少（改动将影响的页）、怎么出去（关闭母版视图）",
      editor: masterFrom("default"),
    },
    {
      id: "bar-toolbar",
      title: "未采纳 · 备选 C · 工具条模式段",
      note: "未采纳：DS-145 定为推荐（master-view-options.bar-recommended）。备选 C——不画上下文条，横幅通道空出来；工具条末端「母版视图 · 完成」，点「完成」退出母版视图，借评审条「评审模式 · 返回编辑」的写法（DS-23）；影响多少页的说明挪到检查器面板标题下一行。采纳它要改 DS-1、DS-21、TB-14 等处「横幅」的措辞。数据同 master-view.default",
      editor: barToolbar,
    },
    {
      id: "bar-toolbar-compact",
      title: "未采纳 · 备选 C · 紧凑形态",
      note: "未采纳：DS-145 定为推荐（narrow.compact-master）。视口 1000 × 760。备选 C 在紧凑形态里：没有上下文条，两个胶囊从窗口顶端开始，工具条末端「母版视图 · 完成」；影响多少页的说明只在检查器抽屉打开后才看得到，平时没有常驻位置。与 narrow.compact-master 同一视口、同一份数据并排",
      editor: {
        ...barToolbar,
        rail: { menu: { master: { reason: MASTER_REASON } } },
        masterView: { open: true, frameRegions: true },
        regions: COMPACT_REGIONS,
        data: { ...barToolbar.data, form: "compact" },
      },
    },
    {
      id: "scope-pane",
      title: "推荐 · 点哪编辑哪",
      note: "已采纳（DS-146），与 master-view.edit-master 同一画法（窗格选中母版即编辑母版，没有范围单选）。推荐——取消范围单选，窗格选中即编辑对象。这是从 master-view.inherited（版式上选中继承来的页脚）点检查器顶行「在母版中编辑」之后的画面：窗格选中母版，母版上同类型的占位符被选中（可编辑，8 个手柄），上下文条换成母版；比「切换范围 → 选中被清空 → 再找一次」少两步。范围条的规则文字同日一起改（DS-146）",
      editor: { selection: kindFor("master", masterPh, 0), data: { mvPane: seedLayout?.master, mvPh: masterPh?.id ?? null } satisfies MvData },
    },
    {
      id: "scope-segment",
      title: "未采纳 · 备选 A′ · 条里的范围分段",
      note: "未采纳：DS-146 定为推荐（master-view-options.scope-pane）。备选 A′——不动规则，范围单选并进上下文条（DS-35 分段「版式 │ 母版」）。同一个版式切到「母版」之后：窗格仍选中版式，母版行写「正在编辑」；分段可点，窗格选中母版时「版式」档留在原位不可用并写原因。「编辑母版」的常驻入口仍有两个（窗格母版行与条上的「母版」档），设计质量门 Q2 不通过",
      // 窗格选中项沿用场景级的种子（与推荐、master-view.default 同一个版式），只把范围切到母版
      editor: { selection: KIND.master, data: { mvVariant: { scope: "segment" }, mvScope: "master" } satisfies MvData },
    },
    {
      id: "ph-labels",
      title: "推荐 · 虚线 + 类型名",
      note: "已采纳（DS-148），与 master-view.default 同一画法。推荐——本版式的占位符全部虚线，类型名写在框外上方（同一画面只用一种落位，放不全时整画面改嵌在上边框，仍放不下的省去），继承项点线 +「母版 · 类型」，与普通视图空占位符同一条线；与 master-view.default 同一份配置。图例随之去掉（DS-148）",
      editor: masterFrom("default"),
    },
    {
      id: "ph-hover",
      title: "未采纳 · 备选 1 · 选中才写类型",
      note: "未采纳：DS-148 定为推荐（master-view-options.ph-labels）。备选 1——本版式的框照画虚线，静止时不写类型名（悬停时出现），继承项常驻「母版 · 类型」；与 ph-labels、ph-legacy 同一版式、同一份数据，都没有选中。采纳它要把 PRD ML-01 的「类型标签」改成「类型提示」",
      editor: masterFrom("default", { ph: "hover" }),
    },
    {
      id: "ph-hover-selected",
      title: "未采纳 · 备选 1 · 选中时的类型标签",
      note: "未采纳：DS-148 定为推荐（master-view.placeholder）。备选 1 选中内容占位符：框上方贴一枚强调色实底的类型标签（同 figma-10）；与推荐的选中画法 master-view.placeholder 同一份配置并排——推荐画法选中时不写自己的类型名，类型写在检查器面板标题里",
      editor: masterFrom("placeholder", { ph: "hover" }),
    },
    {
      id: "ph-legacy",
      title: "未采纳 · 备选 2 · 实线 / 虚线 + 图例",
      note: "未采纳：DS-148 定为推荐（master-view-options.ph-labels）。备选 2——维持原画法：本版式实线，继承项虚线 + 框外纸面小字「母版 · 类型」，幻灯片右上方外侧画图例「此版式定义 / 继承自母版」；不改 PRD 文字，图例与线型的矛盾留着。与 ph-labels 同一版式、同一份数据",
      editor: masterFrom("default", { ph: "legacy" }),
    },
    {
      id: "thumbs",
      title: "缩略图三种",
      note: "第 1 列已采纳（DS-149），与母版视图窗格、普通视图版式画廊同一画法（master-view-options.gallery-thumbs）；第 2、3 列未采纳：DS-149 定为推荐（第 1 列）。板上的列标题保持对比时的写法（「现画法」指改版前的画法）。同一份缩略渲染的三种框线画法放大并排——推荐一种细线 / 备选 1 不画框 / 备选 2 原画法修裁字；四行是窗格缩略（两个版式）、版式画廊卡片与检查器「版式」字段的缩略（采纳后这两处已与窗格同一画法）。先按原尺寸排版再整体放大，线宽与整段取舍照原尺寸的样子放大，每格下写实际尺寸与倍数；有框的两种，上边的框线画在框外、与框隔开半个像素，字顶不压线；放大后极小的字位置略偏上（离上边框线比原尺寸下近一点）",
      editor: {
        selection: "none",
        masterView: { open: false },
        regions: { leftRail: () => null, inspector: () => null, stage: () => <ThumbBoard /> },
        toolbar: { hidden: true, collapse: true },
      },
    },
    {
      id: "gallery-thumbs",
      title: "推荐 · 版式画廊缩略",
      note: "已采纳（DS-149），与 layout-picker.default 同一画法。普通视图的版式画廊（与 layout-picker.default 同一份配置）：画廊卡片、检查器「版式」字段与重置确认里的缩略，都用与母版视图窗格同一种画法；画廊里照常可以选卡、应用",
      editor: normalFrom(layoutPicker, "default"),
    },
    {
      id: "theme-over-inspector",
      title: "推荐 · 盖检查器栏",
      note: "已采纳（DS-155），与 master-view.theme 同一画法。推荐——「主题颜色与字体」盖在检查器栏上（左缘对齐检查器、右缘贴窗口、顶在页签行下沿，宽随检查器），画布整页可见、开合时不动也不缩放；可以改色、取消、应用。与 master-view.theme 同一份配置",
      editor: masterFrom("theme"),
    },
    {
      id: "theme-over-canvas",
      title: "未采纳 · 原位置（盖画布右侧）",
      note: "未采纳：DS-155 定为推荐（master-view-options.theme-over-inspector）。原位置——弹层贴检查器左缘向左展开（定宽 300），盖住画布右侧，实时预览要看的页码与文字右半被挡住；与 theme-over-inspector 同一份数据、同一改色",
      editor: masterFrom("theme", { themePop: "anchor" }),
    },
    {
      id: "theme-normal",
      title: "推荐 · 普通视图同改",
      note: "已采纳（DS-155），与 design-themes.colors 同一画法。普通视图同一件同改——与 design-themes.colors 同一份配置：弹层盖在检查器栏上，画布照常实时预览当前页",
      editor: normalFrom(designThemes, "colors"),
    },
  ],
})
