import { BackgroundControl, inspectorSection, Section, useEditorMaybe, type InspectorCtx, type InspectorSectionDef, type MasterTarget } from "../../kit"
import { registerSlideThemeControl } from "../../editor/inspector/builtin"
import type { PlaceholderData } from "../text-edit/inspector"
import { themeOf } from "./data"
import { TopReason } from "./master-sections"
import { layoutByName, mastersOf, phTypeKeyOf, type MvData } from "./mv-state"
import { ThemeControl, useThemeState } from "./ThemeParts"

/**
 * 普通视图「幻灯片 N」的两个状态私有分区变体（用 EditorConfig.inspector.sections 换进去，不改内置注册）：
 *   THEME_SECTION      主题卡可点：点卡片展开主题画廊，点「调整主题」打开主题颜色与字体（03-28）
 * 评审模式（只读）不再单独定义：用 mode = review，内置「幻灯片」各节在只读时只写当前值、没有入口（03-27 §4「画廊入口不出现」、03-28 §3「自定义不可交互」）
 */

function ThemeSection() {
  return (
    <Section title="主题" anchor="section-slide.theme">
      <ThemeControl cardAnchor="theme-card" adjustAnchor="theme-adjust" previewOf="当前页" />
    </Section>
  )
}

export const THEME_SECTION: InspectorSectionDef = { id: "design-themes.theme", kinds: ["none"], order: 20, component: ThemeSection }

// 底座「幻灯片 N › 主题」节在任何状态里都用这一套可点的卡片与弹层（卡片展开画廊、「调整主题」打开颜色与字体）
registerSlideThemeControl(() => <ThemeControl cardAnchor="theme-card" adjustAnchor="theme-adjust" previewOf="当前页" />)

/**
 * 背景跟随已应用的主题：用底座同一个「背景」节（BackgroundControl，DS-20），只是色块快捷项与色槽名取当前主题——
 * 换成深色主题后颜色字段写「#10131C 背景 1」、快捷项是深色主题的六色，不再写着「白色」。
 */
function ThemeBackgroundSection() {
  const t = useThemeState()
  const theme = themeOf(t.current)
  return <BackgroundControl key={t.current} theme={theme} />
}

export const THEME_BACKGROUND_SECTION: InspectorSectionDef = { id: "design-themes.background", kinds: ["none"], order: 30, component: ThemeBackgroundSection }

/**
 * 普通视图检查器顶行的「转到版式」（rulings §4.25 DS-147；出现在哪些选中上见 DS-174）：只在选中对象本身是占位符形状时画——
 * 空占位符（placeholder-empty），或来自版式占位符的标题、文本框（text，含正在编辑文字）；填进占位符的表格、图表、图片与媒体按各自对象的分区，不画这一行。
 * 一行写这个对象从哪里来：信息图标「继承自版式「〈名〉」」+ 下一行右侧「转到版式 ›」（母版视图检查器顶行的同一个件 TopReason）；
 * 点它进入母版视图、选中这个版式，并选中版式上对应的占位符（类型取产品名的反查 phTypeKeyOf、索引照写，进入后按类型族与索引匹配，TB-205）。
 * 读状态数据 ctx.data.placeholder（类型、索引、来自哪个版式；空占位符是 text-edit 的 PlaceholderData，文本框只写这三项，由 text-edit/inspector.tsx placeholderOrigin 按版式数据算）：
 * 没有这份数据（选中的文本框不是从版式占位符来的）就不画。版式按名称在文档的母版里找（mastersOf：与进入后母版视图的窗格读同一份数据，不按页码回退），
 * 找不到时整行不画（TB-205）。
 * 可用与否、原因取宿主的 masterView.entry，与主菜单「视图 › 母版视图」、检查器「编辑版式」同一条；只读（评审）时仍画这一行，动作留在原位不可用并写原因（03-03）。
 * 这个状态里根本没有母版视图入口时（entry.silent：主菜单也不列）不画。
 */
function InheritanceNotice({ data }: InspectorCtx) {
  const ed = useEditorMaybe()
  if (!ed || ed.masterView.entry.silent) return null
  const ph = data.placeholder as Partial<PlaceholderData> | undefined
  const layout = ph?.layout ? layoutByName(ph.layout, mastersOf(data as MvData)) : undefined
  if (!layout) return null
  const type = ph?.type ? phTypeKeyOf(ph.type) : undefined
  const target: MasterTarget = type ? { layout: layout.id, placeholder: { type, index: ph?.idx } } : { layout: layout.id }
  const { entry } = ed.masterView
  return <TopReason text={`继承自版式「${layout.name}」`} action={{ label: "转到版式", onClick: () => ed.masterView.enter("goto", target), disabled: !entry.ok, reason: entry.reason }} />
}

/** 分区 id 是 master-view.inheritance-notice（不是状态 id）：画在面板标题之上（placement top），排在最前；空占位符与文本两种选中种类 */
export const INHERITANCE_NOTICE_SECTION = inspectorSection({ id: "master-view.inheritance-notice", kinds: ["placeholder-empty", "text"], placement: "top", order: 0, component: InheritanceNotice })
