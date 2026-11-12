import { Fragment, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useAnchorElement, useTrackedRect } from "../kit/anchor"
import { TakeoverHostContext, useTakeoverOpen } from "../kit/InspectorTakeover"
import { useSceneState, type SetSceneState } from "../kit/scene"
import type { InspectorConfig } from "../scenarios/types"
import { Avatar, PanelTitle, reasonTip, Section, Tip, withReason } from "../ui"
import { useBreakpoint } from "./breakpoint"
import { InspectorTopRow, ZoomMenu } from "./chrome"
import { useEditorMaybe } from "./context"
import type { DeckSlide } from "./deck"
import "./inspector/builtin"
import "./inspector/degraded"
import { getInspectorSection, panelTitleFor, sectionsFor, type InspectorCtx, type InspectorSectionDef, type SelectionKind } from "./inspector/registry"
import { PANEL_LIMITS, PanelResizer } from "./resize"

/** 幻灯片的设计宽度：缩放读数 = 画布上幻灯片的显示宽度 ÷ 1280（与网格视图同一口径）。 */
const SLIDE_W = 1280

/** 单页视图的缩放读数：量画布上的幻灯片框（锚点 slide），随视口变化更新。 */
function useStageZoom(): string {
  // 母版视图加载中 / 失败、自定义画布等情况下画布上可能没有幻灯片框：不警告，读数显示「—」
  const rect = useTrackedRect(useAnchorElement(useEditorMaybe()?.masterView.on ? "master-view.slide" : "slide", { quiet: true }))
  return rect ? `${Math.round((rect.width / SLIDE_W) * 100)}%` : "—"
}

/**
 * 右栏贴边（缺省 280，左缘分隔条可拖到 240–480 并按文档记在本机，03-20、PRD ED-12；只在单页视图出现）：顶部协作者与分享，其下页签「设计 / 评论」，再往下是随选中对象变化的属性节。
 * 命令不在这里：创建在底部工具条，其余进菜单、右键、命令面板 ⌘K 与快捷键（DS-1、DS-11）。
 * 顶行：头像组里自己的头像点开账户菜单（DS-18，chrome.tsx Collaborators）；放映按钮从当前页开始，提示「从当前页放映 ⇧F5」（rulings §4.25 TB-103，ED-16；从头放映 F5）。
 * 属性节来自检查器分区注册表（ui.inspectorSection，见 ./inspector/registry.ts）：按选中种类取分区、按 order 排序。
 * config 另可：换头像组（collaborators）、隐藏或禁用「评论」页签（commentsTab）、整栏暂不可用（locked，打开中）、换掉「设计」页签的内容（body）、
 * 换掉「评论」页签的内容（commentsBody）、整栏换成面板（takeover，kit InspectorTakeover，DS-26）。
 * 锚点：inspector（整栏）、collaborators、account（自己的头像）、present、share、tab-design、tab-comments、zoom，以及各分区与控件（见 builtin.tsx）。
 */
interface InspectorProps {
  slide: DeckSlide
  sel: SelectionKind
  /** 场景状态的检查器配置 */
  config?: InspectorConfig
  /** 状态配置的选中种类：sections / title / hide 只在当前选中种类等于它时生效 */
  forKind?: SelectionKind
  data?: Record<string, unknown>
  /** 换掉「设计」页签的内容（已解析的 config.body） */
  body?: ReactNode
  /** 换掉「评论」页签的内容（已解析的 config.commentsBody） */
  commentsBody?: ReactNode
  /** 整栏面板（已解析的 config.takeover）：开着时整栏换成它，关闭后回到常规检查器 */
  takeover?: ReactNode
  /** 栏宽（缺省 280）；给了 onWidth 且是桌面形态时左缘有分隔条 */
  width?: number
  onWidth?: (w: number) => void
  /** 分隔条显示悬停 / 拖动中的样子（演示） */
  resizeActive?: boolean
}

/** 检查器当前页签的场景状态键：编辑器挂载时按状态的 inspector.tab 写进场景仓（Editor.tsx），检查器卸载再挂载（网格 ↔ 单页、紧凑抽屉开合）后仍停在原页签 */
export const INSPECTOR_TAB_KEY = "v3.inspector.tab"

/**
 * 「评论」页签的底座缺省内容（rulings §4.25 TB-82）：评论场景登记一次（comments.scenario.tsx 的 registerCommentsBody），状态没写 inspector.commentsBody 时都用它——
 * 第 1 批编辑态点钉、第 2 批版本历史等场景点钉或手动切到「评论」页签时也是第 2 批的评论面板；不改任何初始画面（一出现就停在「评论」页签的状态都自己写了 commentsBody）。
 * 没有登记时（评论场景没加载）退回本页评论的静态列表（CommentsPane）。与 registerToolLayer 同一做法
 */
let defaultCommentsBody: (() => ReactNode) | null = null
export function registerCommentsBody(render: () => ReactNode) {
  defaultCommentsBody = render
}

/**
 * 检查器页签（「设计 / 评论」）的受控接口：[当前页签, 切换]。场景里要「定位到某条评论就切到评论页签」（01 §2.3 唯一允许自动切页签的场景）时用它，
 * 不必去点页签按钮。页签被设为不可用（commentsTab: { reason }）时切过去也只是停在原样：不可用的页签按钮本来就点不动，场景自己别切。
 */
export function useInspectorTab(): [InspectorTab, SetSceneState<InspectorTab>] {
  return useSceneState<InspectorTab>(INSPECTOR_TAB_KEY, "design")
}
export type InspectorTab = "design" | "comments"

export function Inspector(props: InspectorProps) {
  const t = props.takeover
  if (t === undefined || t === null || t === false) return <InspectorMain {...props} />
  return <TakeoverSwitch {...props} />
}

/** 状态声明了整栏面板（inspector.takeover）：开着时整栏交给面板（协作行的配置经 TakeoverHostContext 传下去），关闭后回到常规检查器。 */
function TakeoverSwitch(props: InspectorProps) {
  const [open] = useTakeoverOpen()
  if (!open) return <InspectorMain {...props} />
  return (
    <TakeoverHostContext.Provider value={{ collaborators: props.config?.collaborators, locked: props.config?.locked, share: props.config?.share }}>{props.takeover}</TakeoverHostContext.Provider>
  )
}

function InspectorMain({ slide, sel, config, forKind, data = {}, body, commentsBody, width, onWidth, resizeActive }: InspectorProps) {
  // 抽屉（紧凑形态，config.drawer）宽度固定、没有分隔条；其余按真实视口
  const desktop = useBreakpoint() === "desktop" && !config?.drawer
  const w = desktop ? (width ?? PANEL_LIMITS.inspector.def) : PANEL_LIMITS.inspector.def
  // 页签是场景状态（useInspectorTab）：初值取状态的 inspector.tab（编辑器挂载时已写进场景仓），场景可以从外面切
  const [sceneTab, setTab] = useSceneState<InspectorTab>(INSPECTOR_TAB_KEY, config?.tab ?? "design")
  const zoom = useStageZoom()
  const locked = config?.locked
  const ct = config?.commentsTab
  const tabs: { v: "design" | "comments"; label: string; reason?: string }[] = [{ v: "design", label: "设计" }]
  if (ct !== false) tabs.push({ v: "comments", label: "评论", reason: ct?.reason })
  // 场景从外面切到「评论」（useInspectorTab），而这个状态没有「评论」页签（M2 未装评论包）时，仍显示「设计」
  const tab = ct === false && sceneTab === "comments" ? "design" : sceneTab
  return (
    <aside data-v3-anchor="inspector" aria-label="检查器" aria-busy={locked ? true : undefined} style={{ width: w }} className="relative flex shrink-0 flex-col border-l border-(--v3-border) bg-(--v3-panel) select-none">
      {desktop && onWidth && <PanelResizer panel="inspector" value={w} onChange={onWidth} active={resizeActive} />}
      {/* 顶行（协作者 · 放映 · 分享，chrome.tsx InspectorTopRow，与整栏面板共用）；紧凑抽屉在它右侧给「收起检查器」开关让位（data-v3-inspector-top） */}
      <InspectorTopRow collaborators={config?.collaborators} locked={locked} share={config?.share} />

      <div className="flex h-11 shrink-0 items-center justify-between border-b border-(--v3-border) px-4">
        <div role="tablist" aria-label="检查器" className="flex items-center gap-1">
          {tabs.map(({ v, label, reason }) => {
            const off = !!locked || !!reason
            const why = reason ?? locked
            const btn = (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={tab === v}
                aria-disabled={off || undefined}
                aria-label={off && why ? withReason(label, why) : undefined}
                data-v3-anchor={`tab-${v}`}
                onClick={() => !off && setTab(v)}
                className={cn(
                  "h-7 rounded-[6px] px-3 text-[12px] leading-none font-medium transition-colors",
                  // 选中的页签：与 IconButton 按下态同一 token（--v3-on-fill / --v3-on-line）——只铺 panel-2、不描边（rulings §4.25 DS-35）；
                  // 未选页签由 v3-off-cue 退回字重 400，选中 500 成为非颜色线索（v3.css）
                  tab === v ? "bg-(--v3-on-fill) ring-1 ring-(--v3-on-line) ring-inset" : "v3-off-cue",
                  off ? "cursor-default text-(--v3-text-3)" : tab === v ? "text-(--v3-text)" : "text-(--v3-text-2) hover:text-(--v3-text)",
                )}
              >
                {label}
              </button>
            )
            return off && why ? (
              <Tip key={v} label={reasonTip(label, why)}>
                {btn}
              </Tip>
            ) : (
              btn
            )
          })}
        </div>
        <ZoomMenu readout={zoom} disabled={!!locked} reason={locked} className="-mr-2" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" data-v3-readonly={config?.readOnly || locked ? "" : undefined}>
        {tab === "comments" ? (
          (commentsBody ?? defaultCommentsBody) !== null ? (
            // 场景换掉的评论内容（没写时是登记的缺省面板，TB-82）：放在占满滚动区高度的纵向 flex 里，回复框可以 mt-auto 贴底（内容超高时整体滚动，sticky 也可用）
            <div className="flex min-h-full flex-col">
              {config?.noticeIn === "all" && config.notice}
              {commentsBody ?? defaultCommentsBody?.()}
            </div>
          ) : (
            <>
              {config?.noticeIn === "all" && config.notice}
              <CommentsPane slide={slide} />
            </>
          )
        ) : body !== undefined && body !== null ? (
          body
        ) : (
          <InspectorBody slide={slide} sel={sel} config={config} own={forKind === undefined || forKind === sel} data={data} />
        )}
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------------ 属性节：按选中种类从注册表取分区 */

function InspectorBody({ slide, sel, config, own, data }: { slide: DeckSlide; sel: SelectionKind; config?: InspectorConfig; own: boolean; data: Record<string, unknown> }) {
  const ctx: InspectorCtx = { selection: sel, slide, readOnly: !!config?.readOnly, disabled: config?.disabled ?? config?.locked, data }
  const list = own && config?.sections ? config.sections : undefined
  const defs: InspectorSectionDef[] = list
    ? list.flatMap((x) => {
        if (typeof x !== "string") return [x]
        const d = getInspectorSection(x)
        if (!d) console.warn(`[v3 检查器] 没有注册 id 为「${x}」的分区`)
        return d ? [d] : []
      })
    : sectionsFor(sel)
  const hide = own ? (config?.hide ?? []) : []
  const visible = defs.filter((d) => !hide.includes(d.id))
  const registeredTitle = panelTitleFor(sel, ctx)
  const title = own && config?.title !== undefined ? config.title : registeredTitle
  const top = visible.filter((d) => d.placement === "top")
  const body = visible.filter((d) => d.placement !== "top")
  return (
    // 换页或换选中种类时整组分区重新挂载，字段的初值跟着当前对象走
    <Fragment key={`${sel}:${slide.n}`}>
      {config?.notice}
      {top.map((d) => (
        <d.component key={d.id} {...ctx} />
      ))}
      {title !== null && <PanelTitle>{title ?? sel}</PanelTitle>}
      {body.map((d) => (
        <d.component key={d.id} {...ctx} />
      ))}
      {visible.length === 0 && (
        <Section>
          <p className="text-[12px] leading-[18px] text-(--v3-text-2)">「{sel}」还没有注册检查器分区（inspectorSection）。</p>
        </Section>
      )}
    </Fragment>
  )
}

/* ------------------------------------------------------------------ 评论页签 */

const THREADS: { who: string; tone: "sand" | "sage" | "clay"; when: string; text: string }[] = [
  { who: "王小明", tone: "sand", when: "2 小时前", text: "6 月的数据是否包含海外业务？建议在图注里写清口径。" },
  { who: "李雷", tone: "sage", when: "昨天", text: "Q2 累计与财务报表对了一遍，数字一致。" },
  { who: "张三", tone: "clay", when: "3 天前", text: "1–3 月用浅色、Q2 用深色，对比会更清楚。" },
]

function CommentsPane({ slide }: { slide: DeckSlide }): ReactNode {
  const count = slide.comments ?? 0
  if (!count) {
    return (
      <div className="px-4 py-10 text-center text-[12px] leading-[18px] text-(--v3-text-2)">第 {slide.n} 页还没有评论</div>
    )
  }
  return (
    <>
      <PanelTitle>{`第 ${slide.n} 页 · ${count} 条评论`}</PanelTitle>
      {THREADS.slice(0, count).map((t) => (
        <Section key={t.who}>
          <div className="flex items-center gap-2">
            <Avatar name={t.who} tone={t.tone} size={20} />
            <span className="text-[12px] leading-none font-semibold">{t.who}</span>
            <span className="text-[12px] leading-none text-(--v3-text-2)">{t.when}</span>
          </div>
          <p className="text-[12px] leading-[18px] text-(--v3-text)">{t.text}</p>
        </Section>
      ))}
    </>
  )
}
