import type { ReactNode } from "react"
import { defineScenario, type EditorConfig } from "../types"
import { GEOMETRY_NOW } from "./geometry-now"

/**
 * quiet-leftovers：TB-58 留下的四项（rulings §4.25 DS-74；拍板结果 DS-133…DS-136）——DS-35 安静控件那一轮只改了右侧面板，这四处各出一组「现画法 / 改后」，拍板时逐项定了改不改
 * （暗色珊瑚强调色下当前工具图标的对比度一项 DS-74 已结案：珊瑚未采用，DS-2）。
 * 拍板结果：① 视图切换改分段（DS-133）、② 备注区改凹陷底且亮色占位提到 text-2（DS-134）、④ 锁定比例未锁时断开的链（DS-136）采用改后；③ 拖动把手维持现画法（DS-135）。
 * 采用的三项第 3 批转正时进了底座（editor/chrome.tsx ViewToggle、editor/Stage.tsx 备注区与 v3.css 的 --v3-notes-*、editor/inspector/geometry.tsx），第 1、2 批凡露出这几处的画面随之变、重存了基线；
 * 所以「改后」三态（view-toggle-after、view-toggle-grid-after、notes-after、lock-ratio-after）不再覆盖样式，就是底座画面。
 * 未采纳的保留下来对照（DS-63，标题「未采纳 · 」）：①②④ 的「现画法」态（view-toggle-now、view-toggle-grid-now、notes-now、lock-ratio-now）反过来在本场景的状态里经 regions 包一层
 * （display: contents，不影响布局）把第 1 批的原画法覆盖回来、或换一节原画法的检查器分区；③ 的改后（handle-after）与 ② 的另一档（notes-after-text3）照旧覆盖。画面上只有被对照的那一处不同。
 * 依据：设计 04 §1 第 6 条与待决事项「控件画法 · 仍待办」、03-02 §3.3（备注区）、§3.1（左栏顶行）、§5.1（网格胶囊）；对比度按 WCAG 公式（07 §8、04 §2.6）。
 */

/**
 * DS-133 未采纳的「现画法」：第 1 批原来的视图切换——两枚图标按钮、间距 4，左栏 24 × 24（圆角 4）、网格胶囊 28 × 28（圆角 6），当前视图是按下态（只铺 panel-2 淡底、
 * 图标描边 2，--v3-on-*，DS-35），另一枚 ghost；没有分段的槽。底座 ViewToggle 已是分段画法，这里把槽、间距、尺寸与选中块覆盖回原样（按钮、读屏名、工具提示、焦点交接都不变）
 */
const toggleNow = (size: 24 | 28) =>
  [
    "contents",
    "[&_[data-v3-anchor=view-toggle]]:gap-1",
    "[&_[data-v3-anchor=view-toggle]]:rounded-none",
    "[&_[data-v3-anchor=view-toggle]]:bg-transparent",
    size === 24 ? "[&_[data-v3-anchor=view-toggle]>button]:size-6 [&_[data-v3-anchor=view-toggle]>button]:rounded-[4px]" : "[&_[data-v3-anchor=view-toggle]>button]:rounded-[6px]",
    "[&_[data-v3-anchor=view-toggle]>button[aria-pressed=true]]:bg-(--v3-on-fill)",
    "[&_[data-v3-anchor=view-toggle]>button[aria-pressed=true]]:ring-(--v3-on-line)",
  ].join(" ")

/**
 * DS-134 未采纳的「现画法」：第 1 批原来的备注框——panel 底 + 1px --v3-border、圆角 8、内边距 12，占位 text-3，悬停不变。
 * 底座备注区已是凹陷底（--v3-notes-fill / --v3-notes-placeholder，描边透明、悬停出细边），这里把两个 token 与描边覆盖回原样
 */
const NOTES_NOW = [
  "contents",
  "[--v3-notes-fill:var(--v3-panel)] [--v3-notes-placeholder:var(--v3-text-3)]",
  "[&_[data-v3-anchor=notes]]:border-(--v3-border)",
  "[&_[data-v3-anchor=notes]:hover]:border-(--v3-border)",
].join(" ")

/**
 * DS-134 未采纳的另一档（notes-after-text3）：占位字两种主题都保持 text-3（不破 DS-9 的例），亮色的底只能淡到 #EFEFEF（与画布 1.05，text-3 刚好 3.00）；
 * 暗色与底座（采纳的 notes-after）相同，所以只覆盖亮色的两个 token
 */
const NOTES_TEXT3 = "contents [[data-v3-theme=light]_&]:[--v3-notes-fill:#EFEFEF] [[data-v3-theme=light]_&]:[--v3-notes-placeholder:var(--v3-text-3)]"

/** DS-135 未采纳的改后：备注拖动把手淡一档——静止时 --v3-hover-line（text-3 与分隔线各半），悬停 / 拖动 / 聚焦照旧（text-2、焦点环） */
const HANDLE_LIGHTER = "contents [--v3-handle:var(--v3-hover-line)]"

const wrapStage = (cls: string): EditorConfig => ({ regions: { stage: (_, d) => <div className={cls}>{d.stage()}</div> } })
const wrap = (cls: string, node: ReactNode) => <div className={cls}>{node}</div>

/** 选中第 2 页要点卡（形状）：检查器「位置与大小」里有锁定比例按钮（未锁） */
const SHAPE: EditorConfig = { slide: 2, selection: "shape", stage: { cursor: false } }

export default defineScenario({
  id: "quiet-leftovers",
  title: "安静控件遗留四项",
  specs: ["03-02"],
  batch: 3,
  summary: "TB-58 四项各一组「现画法 / 改后」对照（DS-133…136）：视图切换改分段、备注区凹陷底、备注拖动把手维持现画法、锁定比例未锁时断开的链；未采纳的一侧标「未采纳」",
  states: [
    /* ---------------------------------------------------------------- ① 视图切换（DS-133：改分段） */
    {
      id: "view-toggle-now",
      title: "未采纳 · ① 视图切换 · 现画法（左栏）",
      note: "未采纳（DS-133 定为改分段画法，见 view-toggle-after）：第 1 批原来的画法——左栏顶行右侧两枚 24 × 24 图标按钮「单页 / 网格」，当前视图是按下态（只铺 panel-2 淡底、图标描边 2，--v3-on-*，DS-35），另一枚是 ghost（次级文字色，悬停铺 panel-2）；两枚间距 4。底座已改成分段，本态包一层覆盖样式还原原画法",
      editor: { regions: { leftRail: (_, d) => wrap(toggleNow(24), d.leftRail()) } },
    },
    {
      id: "view-toggle-after",
      title: "① 视图切换 · 改后（左栏分段）",
      note: "rulings §4.25 DS-133（采用改后）：改为与检查器分段控件同一画法（kit Segmented）——28 高的槽铺 panel-2、不描边，选中块是面板色 + 与分隔线同档的细边、贴边、圆角 4（TB-55），两项各 28 × 28、间距 0；按钮、读屏名（「视图」组里两个 aria-pressed 按钮）、工具提示与切换后的焦点交接不变。读起来是「两种视图选一种」而不是两个独立的开关，与检查器里的分段一致；代价是左栏顶行多占 4 宽（原画法 24 + 间距 4 + 24 = 52，改后 28 + 28 = 56）、比主菜单按钮更显眼。第 3 批转正时进了底座（editor/chrome.tsx ViewToggle），本态就是底座画面；第 1、2 批凡露出左栏顶行的画面随之变。网格胶囊同改见 view-toggle-grid-after",
    },
    {
      id: "view-toggle-grid-now",
      title: "未采纳 · ① 视图切换 · 现画法（网格胶囊）",
      note: "未采纳（DS-133 定为改分段画法，见 view-toggle-grid-after）：第 1 批原来的画法——网格视图左上「文档」胶囊最右的「单页 / 网格」两枚 28 × 28 图标按钮、间距 4，「网格」按下（淡底、描边 2）。底座已改成分段，本态包一层覆盖样式还原原画法",
      editor: { view: "grid", regions: { grid: (_, d) => wrap(toggleNow(28), d.grid()) } },
    },
    {
      id: "view-toggle-grid-after",
      title: "① 视图切换 · 改后（网格胶囊分段）",
      note: "DS-133：网格胶囊里的同一个切换按左栏改后的画法（分段槽 + 选中块，两项 28 × 28、贴边）；与左栏同一个件，切换视图时位置与长相不跳（胶囊里这一段由 60 变 56）。本态就是底座画面",
      editor: { view: "grid" },
    },

    /* ---------------------------------------------------------------- ② 备注区（DS-134：凹陷底、亮色占位 text-2） */
    {
      id: "notes-now",
      title: "未采纳 · ② 备注区 · 现画法",
      note: "未采纳（DS-134 定为凹陷底、亮色占位字提到 text-2，见 notes-after）：第 1 批原来的画法（03-02 §3.3）——备注框 panel 底 + 1px --v3-border、圆角 8、内边距 12，占位「添加演讲者备注…」text-3——在画布上像一张浮起的卡片（框与画布：暗 1.19 / 亮 1.09，描边与画布：暗 1.71 / 亮 1.16；占位字在 panel 上暗 3.78 / 亮 3.45）。底座已改成凹陷底，本态包一层覆盖样式还原原画法",
      editor: { stage: { cursor: false }, ...wrapStage(NOTES_NOW) },
    },
    {
      id: "notes-after",
      title: "② 备注区 · 改后（凹陷底）",
      note: "rulings §4.25 DS-134（采用改后）：去掉描边，铺一块比画布深一档的底——暗 #151515、亮 #EBEBEB，与画布都是 1.09（暗色原来的 panel 框比画布亮 1.19、像浮起的卡片；现在两种主题都比画布深，读作嵌进画布的输入区），悬停出与分隔线同档的细边（同字段，DS-35）。占位字「添加演讲者备注…」要在这块底上 ≥ 3:1（DS-9）：暗色 text-3 4.94；亮色 text-3 只有 2.89，提到 text-2（4.81，同 DS-41 方案 B 的先例）——亮色的占位字比别处的占位深一档。不能直接套字段淡底 panel-2：亮色 #F2F2F2 与画布只有 1.02、框看不见，暗色 #383838 比画布亮（1.42）、看起来是浮起。第 3 批转正时进了底座：备注区底色 token --v3-notes-fill（暗 #151515 / 亮 #EBEBEB）与它上面的占位字色 --v3-notes-placeholder（v3.css），editor/Stage.tsx 备注框，本态就是底座画面。只改这一处：把手、高度与位置不变。未采纳的另一档（占位仍用 text-3）见 notes-after-text3",
      editor: { stage: { cursor: false } },
    },
    {
      id: "notes-after-text3",
      title: "未采纳 · ② 备注区 · 改后（凹陷底 · 占位仍用 text-3）",
      note: "未采纳（DS-134 定为亮色占位提到 text-2 的那一档，见 notes-after）：占位字两种主题都保持 text-3（DS-9「占位用 text-3」不破例），亮色的底就只能淡到 #EFEFEF——与画布 1.05（notes-after 是 1.09），text-3 在上面刚好 3.00；框更淡，靠占位字与悬停细边认出范围。暗色同 notes-after（#151515，与画布 1.09，text-3 4.94）。本态在底座外包一层，只覆盖亮色的两个 token",
      editor: { stage: { cursor: false }, ...wrapStage(NOTES_TEXT3) },
    },

    /* ---------------------------------------------------------------- ③ 拖动把手（DS-135：维持现画法） */
    {
      id: "handle-now",
      title: "③ 拖动把手 · 现画法",
      note: "rulings §4.25 DS-135（维持现画法，第 1 批已拍板）：备注区上方居中的把手 40 × 4、圆角 2，静止 --v3-handle = --v3-border-control（与画布：暗 4.52 / 亮 3.17，≥ 3:1——把手是控件本身，同「边框就是控件本身」一类，DS-9、WCAG 1.4.11），悬停 / 拖动 text-2，键盘焦点另有 2px 强调色焦点环（03-20）；左栏底部面板、Sheet 的把手同一个 token，一并不变。未采纳的淡一档见 handle-after",
      editor: { stage: { cursor: false } },
    },
    {
      id: "handle-after",
      title: "未采纳 · ③ 拖动把手 · 改后（淡一档）",
      note: "未采纳（DS-135 定为维持现画法 --v3-border-control，见 handle-now）：把手静止时改为 --v3-hover-line（text-3 与分隔线各半：暗 #656565、亮 #B8B8B8；与画布：暗 2.86 / 亮 1.82），更安静；悬停 / 拖动仍换 text-2、键盘焦点环不变。代价：静止时低于控件边界 3:1（WCAG 1.4.11），只能靠悬停与光标形状发现可拖；若采用，--v3-handle 要改值（左栏底部面板、Sheet 的把手同一个 token 跟着变淡）",
      editor: { stage: { cursor: false }, ...wrapStage(HANDLE_LIGHTER) },
    },

    /* ---------------------------------------------------------------- ④ 锁定比例（DS-136：未锁时断开的链） */
    {
      id: "lock-ratio-now",
      title: "未采纳 · ④ 锁定比例 · 现画法（未锁）",
      note: "未采纳（DS-136 定为未锁时断开的链 Unlink2，见 lock-ratio-after）：第 1 批原来的画法（03-03）——选中要点卡，检查器「位置与大小」W / H 右侧 28 × 28 的锁定比例按钮，未锁是相连的链（Link2）、ghost（次级文字色）；锁定时同一个图标 + 按下态（淡底、描边 2）。两种状态图形相同，只靠按下态区分（图片缺省锁定）。底座已改，本态换一节原画法的分区（quiet-leftovers/geometry-now.tsx，字段网格与底座逐项相同）",
      editor: { ...SHAPE, inspector: { sections: ["shape.align", GEOMETRY_NOW, "shape.style", "shape.fill", "shape.stroke", "shape.shadow", "shape.opacity", "shape.action"] } },
    },
    {
      id: "lock-ratio-after",
      title: "④ 锁定比例 · 改后（未锁 = 断开的链）",
      note: "rulings §4.25 DS-136（采用改后）：未锁时换成断开的链（Unlink2），锁定时是相连的链 + 按下态；点按在两者之间切换（试一下）。图形本身就说明了状态，不只靠淡底（与 Figma「约束比例」的做法一致）；读屏名「锁定比例」+ aria-pressed 不变。第 3 批转正时进了底座（editor/inspector/geometry.tsx），本态就是底座画面；第 1、2 批露出锁定比例按钮的检查器画面随之变",
      editor: SHAPE,
    },
  ],
})
