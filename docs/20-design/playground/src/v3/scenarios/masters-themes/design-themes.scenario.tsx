import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { defineScenario } from "../types"
import { themeOf } from "./data"
import { THEME_BACKGROUND_SECTION, THEME_SECTION } from "./slide-sections"
import { livePreview, ThemeToast, useThemeState, type ThemeData } from "./ThemeParts"

/**
 * 03-28 设计：主题、变体、主题颜色与字体（v3）。原 Ribbon「设计」页签拆进检查器「幻灯片 N › 主题」节（DS-1、DS-5）：
 * 点主题卡展开主题画廊（内置 5 套主题——简约 / 商务 / 暗色 / 学术 / 活力，与开始页模板同一份数据，rulings §4.25 DS-33——的真实预览 + 变体；
 * 示例文档自带的 Office 不在内置清单里，画廊首位放「当前」卡），点卡片右侧「调整主题」打开主题颜色与字体；母版视图的「主题」节是同一个卡片与面板（见 master-view.theme）。
 * 已应用的主题给左栏缩略图与画布换色；编辑中的颜色 / 字体只在画布上预览（缩略图不变）。第 2 页「议程」全部引用主题色，换色最完整。
 */

/** 左栏、网格：套已应用主题的配色。 */
function AppliedTheme({ children }: { children: ReactNode }) {
  const t = useThemeState()
  return <div className={cn("contents", themeOf(t.current).className)}>{children}</div>
}

/** 画布：已应用主题 + 编辑中的实时预览。 */
function PreviewTheme({ children }: { children: ReactNode }) {
  const t = useThemeState()
  const live = livePreview(t.live)
  return (
    <div className={cn("contents", themeOf(t.current).className, live.className)} style={live.style}>
      {children}
    </div>
  )
}

const td = (data: ThemeData): Record<string, unknown> => ({ ...data })

export default defineScenario({
  id: "design-themes",
  title: "主题与主题编辑",
  specs: ["03-28"],
  batch: 1,
  summary: "检查器「主题」卡展开主题画廊（真实预览、变体），「调整主题」编辑 12 色槽与标题 / 正文字体，应用即生效并可撤销",
  editor: {
    slide: 2,
    stage: { cursor: false },
    inspector: { sections: ["slide.layout", THEME_SECTION, THEME_BACKGROUND_SECTION, "slide.playback"] },
    regions: {
      leftRail: (_ctx, d) => <AppliedTheme>{d.leftRail()}</AppliedTheme>,
      grid: (_ctx, d) => <AppliedTheme>{d.grid()}</AppliedTheme>,
      stage: (_ctx, d) => <PreviewTheme>{d.stage()}</PreviewTheme>,
    },
    canvasOverlay: <ThemeToast pages={6} />,
  },
  states: [
    {
      id: "gallery",
      title: "主题画廊",
      note: "03-28 §1：点检查器主题卡展开——首位「当前」卡是示例文档自带的 Office（不在内置清单里，名称后带「当前」标记），其后是内置 5 套主题：简约、商务、暗色、学术、活力，与开始页模板同一份配色与字体（rulings §4.25 DS-33）；都用示例文档第 2 页真实预览（暗色主题的卡片与画布一致），当前主题选中；下方是当前主题的 3 个变体（DS-32）。点卡片或变体即应用，不弹确认；画廊开着期间「当前」卡不变，可点它回到原主题",
      editor: { data: td({ themeGallery: true }) },
    },
    {
      id: "applied",
      title: "应用主题 · 可撤销",
      note: "03-28 §3（rulings §4.20 FE-07）：应用内置主题「简约」后左栏与画布一起换色，轻提示「已应用主题「简约」，影响 6 页」带撤销（一步回到 Office）；第 4、5 页图表的显式颜色按 §5 保持不变",
      editor: { data: td({ themeCurrent: "minimal", themePrev: "office", themeToast: "简约" }) },
    },
    {
      id: "colors",
      title: "编辑主题颜色",
      note: "03-28 §2–§3：「调整主题」打开主题颜色与字体——12 个色槽用产品化名称，选中「强调色 1」在下方改色（标准色 / 最近使用 / 色值）；画布实时预览当前页，缩略图不变，[取消][应用]",
      editor: { data: td({ themeEditor: true, themeTab: "colors", themeSlot: 4, themeLive: { a1: "#0F8B8D" } }) },
    },
    {
      id: "fonts",
      title: "编辑主题字体",
      note: "03-28 §2：「字体」页——标题、正文字体 + 20px 示例；标题换成思源宋体，画布标题实时预览；写明只影响文档内容字体，不影响编辑器界面",
      editor: { data: td({ themeEditor: true, themeTab: "fonts", themeLive: { serif: true } }) },
    },
    {
      id: "dark-theme",
      title: "深色文档主题",
      note: "03-28 §5：文档主题的明暗与编辑器界面的亮 / 暗无关——应用内置主题「暗色」后幻灯片变深，界面仍按自己的主题（暗、亮两套截图对照）",
      editor: { data: td({ themeCurrent: "dark" }) },
    },
    {
      id: "readonly",
      title: "评审模式 · 只能查看",
      note: "03-28 §3：评审模式下主题卡只显示当前主题与字体，不能展开画廊、没有「调整主题」；工具条换成评审条、左栏不提供新建（与 03-02 评审模式同一外壳）",
      // mode = review：评审条、左栏不提供新建、检查器只读并注明（底座缺省）；内置「幻灯片」各节在只读时只写当前值，没有画廊与「调整主题」入口
      editor: { mode: "review", inspector: { sections: ["slide.layout", "slide.theme", "slide.background", "slide.playback"] } },
    },
  ],
})
