import { defineScenario, type EditorConfig } from "../types"
import { DISPLAY_DEFAULT, DisplayOverlay, type DisplayPrefs } from "./display"
import { MainMenuLayer } from "./MainMenu"
import { PageJump } from "./PageJump"
import { InspectorWithZoom, StageWithZoom } from "./Zoom"

/**
 * 03-20 视图、缩放与导航（v3）。原 Ribbon「视图」页签取消（DS-1），三组内容的去处：
 * - 显示（网格 / 参考线 / 智能参考线）：主菜单「视图」与画布空白处右键「网格与参考线 ▸」，呈现偏好、不入撤销历史。
 * - 缩放：检查器页签行右端的读数 ▾（网格视图在右上胶囊），读数为实测比例，菜单只放命令；主菜单「视图 › 缩放」是第二入口。
 * - 窗口：备注在主菜单「视图」；母版视图在主菜单「视图」与 ⌥⌘M；「缩略图侧栏」开关取消（左栏承载主菜单与文件名，不能整栏隐藏）。
 * 页导航：PageUp / PageDown、Home / End；画布聚焦时敲数字 + ↵ 跳页（提示签）。
 */

/* 缩放比例与显示偏好是场景共享状态（Zoom.tsx useZoom、display.tsx useDisplay）：各状态的初值写在 data.zoom / data.display，切换单页 / 网格时不复位。 */

/** 缩放、跳页这几个状态不看参考线（偏好关掉），画面只留要看的东西。 */
const NO_GUIDES: DisplayPrefs = { ...DISPLAY_DEFAULT, guides: false }

/** 本场景各状态共用：第 3 页（标题、指标卡与文件参考线对齐），检查器换上实测读数的缩放控件，画布支持固定比例缩放，网格与参考线叠在幻灯片上。 */
const BASE: EditorConfig = {
  slide: 3,
  stage: { cursor: false },
  slideOverlay: () => <DisplayOverlay />,
  regions: {
    inspector: (_, d) => <InspectorWithZoom>{d.inspector()}</InspectorWithZoom>,
    stage: (_, d) => <StageWithZoom defaults={d} overlay={<DisplayOverlay />} />,
  },
}

export default defineScenario({
  id: "view-zoom",
  title: "视图、缩放与导航",
  specs: ["03-20"],
  summary: "实测读数的缩放菜单（输入 10–400、适应窗口 ⌘0、100% ⌘1）、放大后原生滚动条、主菜单「视图」的显示开关、网格与参考线、数字跳页",
  editor: BASE,
  states: [
    {
      id: "zoom-menu",
      title: "缩放菜单",
      note: "检查器页签行右端「77% ▾」：读数是实测比例（1600 × 1000 下幻灯片 984 宽 ÷ 1280），菜单只放命令：输入框（10–400，↵ 确认）· 放大 / 缩小 · 适应窗口 ⌘0 / 适应宽度 · 50–200% 预设（100% ⌘1）。菜单项点了真的缩放",
      editor: {
        data: { display: NO_GUIDES },
        regions: { inspector: (_, d) => <InspectorWithZoom menuOpen>{d.inspector()}</InspectorWithZoom> },
      },
    },
    {
      id: "zoomed",
      title: "放大到 150%",
      note: "超过适应窗口：画布出现原生滚动条（不自定义样式），滚轮或空格 + 拖拽平移；读数 150%，⌘0 或菜单「适应窗口」一键归位；备注框位置不变",
      editor: { data: { zoom: 150, display: NO_GUIDES } },
    },
    {
      id: "view-menu",
      title: "主菜单 · 视图",
      note: "单页 / 网格（与左栏顶部同一状态）· 备注 · 网格与参考线 ▸（与画布空白处右键同一张清单：显示网格 / 显示参考线 · 吸附到网格 / 智能参考线 · 网格间距）· 缩放 ▸ · 母版视图 ⌥⌘M · 模式（与 main-states 同位）。「显示参考线」开着，第 3 页上看得到文件里存的四条参考线（强调色虚线）；勾选项都真的生效",
      editor: {
        layers: <MainMenuLayer openPath={["view", "grid-guides"]} />,
      },
    },
    {
      id: "grid-guides",
      title: "显示网格与参考线",
      note: "网格：线距等于网格间距（缺省 12 pt，「网格与参考线 ▸ › 网格间距」可换 6 / 18 pt，画布跟着变，DS-27）、中性细线、每 4 格加深一档，画在纸面上、与 UI 主题无关，与 selection.grid-visible 同一画法（03-20 §5）；参考线：1px 强调色虚线（拖动时的智能参考线为实线，见 03-17）。两者都是呈现偏好，不入撤销历史",
      editor: { data: { display: { grid: true, guides: true, smartGuides: true } } },
    },
    {
      id: "panel-size",
      title: "面板尺寸与记忆",
      note: "03-20「面板尺寸与记忆」、02 §3.3：左栏右缘、检查器左缘各有一条竖分隔条（悬停 / 拖动时显出 2px 中性线，指针变成左右箭头），备注上方的把手可上下拖；键盘 ← → / ↑ ↓ 每次 8（⇧ 32）、Home / End 到最小 / 最大、Enter 或双击回到缺省。左栏 160–420（缺省 240）、检查器 240–480（缺省 280，PRD ED-12、TB-25）、备注 64–320（缺省 120），按文档记在本机，下次打开原样恢复。演示态：左栏拖到 300（分隔条显示拖动中）、备注拉高到 180",
      editor: {
        data: { display: NO_GUIDES },
        panels: { rail: 300, notes: 180, active: "rail" },
      },
    },
    {
      id: "page-jump",
      title: "数字跳页",
      note: "画布聚焦时敲数字：顶部居中提示「转到第 5 页 · ↵ 跳转 · Esc 取消」；没有该页时提示「没有第 N 页 · 共 6 页」。可以直接在页面上敲数字、PageUp / PageDown、Home / End 试",
      editor: {
        data: { display: NO_GUIDES },
        canvasOverlay: <PageJump initial="5" />,
      },
    },
  ],
})
