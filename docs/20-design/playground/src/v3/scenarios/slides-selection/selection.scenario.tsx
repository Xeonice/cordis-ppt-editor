import { Lock } from "lucide-react"
import { CanvasTag, ContextMenu, deckWith, Guide, HoverBox, InspectorNotice, Marquee, SelectionBox, SlideGrid, type Box } from "../../kit"
import { defineScenario } from "../types"
import { ConnectionPoint, GroupBounds, LockedBox, UnionBox } from "./canvas-bits"
import { CHILD_SHAPE_SECTIONS, CONNECTOR_SECTIONS, MULTI_SHAPE_SECTIONS } from "./inspector"
import { multiMenu } from "./menus"
import { railToCurrent } from "./rail"
import { flowDeck, MetricsArt } from "./slides"

/**
 * 03-17 选择、多选、对齐、分布、吸附与连接符。
 * 颜色：选中框、参考线、连接点一律强调色（规格原写「品红」，v3 只留一种 UI 彩色，Q3）；页面中心 / 边缘对齐用实线，与其它对象对齐用虚线，
 * 等间距写数值角标。状态栏在 v3 已取消（DS-6），「吸附已临时关闭」改为画布上的提示签。
 */

/** 第 3 页三张指标卡（百分比）：x 7 / 36.667 / 66.333，y 33.78，宽 26.667，高 48.89（960 × 540：x 67 / 352 / 637，y 182，256 × 264）。 */
const CARD: Box[] = [
  { x: 7, y: 33.78, w: 26.667, h: 48.89 },
  { x: 36.667, y: 33.78, w: 26.667, h: 48.89 },
  { x: 66.333, y: 33.78, w: 26.667, h: 48.89 },
]

/** 第 2 页：标题文本框、议程列表、要点卡。 */
const AGENDA_TITLE: Box = { x: 6.2, y: 10.2, w: 55.3, h: 12.4 }
const AGENDA_LIST: Box = { x: 6.2, y: 33, w: 55.3, h: 52.8 }
const AGENDA_CARD: Box = { x: 65.5, y: 43, w: 27.5, h: 32.59 }

/** 第 7 页「交付流程」：矩形 3 与它的四个连接点；连接符在 y = 55.556%。 */
const BOX3: Box = { x: 70.833, y: 44.444, w: 20.833, h: 22.222 }
const LINE_Y = 55.556

/** 第 7 页在末尾：左栏滚到它。 */
const railTo7 = railToCurrent

export default defineScenario({
  id: "selection",
  title: "选择、对齐与吸附",
  specs: ["03-17"],
  summary: "框选、多选包围盒、智能参考线与等间距、Alt 临时关闭吸附、对齐分布与参照、组合编辑、锁定对象、连接符端点吸附",
  editor: { stage: { cursor: false } },
  states: [
    {
      id: "marquee",
      title: "框选中",
      note: "03-17 选择模型：空白处拖出半透明框选矩形；默认「完全包含」才选中（第 1、2 张卡描出预选框，被框到一半的第 3 张不选），提示签说明按住 Alt 相交即选",
      editor: {
        slide: 3,
        slideOverlay: (
          <>
            <Marquee box={{ x: 4, y: 27, w: 68, h: 61 }} />
            <HoverBox box={CARD[0]} />
            <HoverBox box={CARD[1]} />
            <CanvasTag box={{ x: 73.2, y: 88.4 }}>按住 Alt 相交即选</CanvasTag>
          </>
        ),
      },
    },
    {
      id: "multi-select",
      title: "多选 · 包围盒与混合值",
      note: "03-17：多选统一显示虚线包围盒 + 8 个缩放手柄（不显示旋转手柄），每个对象描 1px 框；检查器标题「2 个对象」，对齐行带分布（不足 3 个对象时不可用）与「对齐参照」，不一致的 X 显示「多个值」（03-03）",
      editor: {
        slide: 3,
        selection: "shape",
        data: { count: 2, geo: { x: null, y: "182", w: "256", h: "264" }, fill: "#F4F6FB" },
        inspector: { title: "2 个对象", sections: MULTI_SHAPE_SECTIONS },
        slideOverlay: (
          <>
            <HoverBox box={CARD[0]} />
            <HoverBox box={CARD[1]} />
            <UnionBox box={{ x: 7, y: 33.78, w: 56.333, h: 48.89 }} label="541 × 264" />
          </>
        ),
      },
    },
    {
      id: "smart-guides",
      title: "拖动 · 智能参考线",
      note: "03-17 智能参考线：拖动第 2 张卡时与页面中心对齐（实线）、与左右两张卡顶边对齐（虚线）、两侧间距相等（角标 29）；吸附阈值 4px（屏幕空间）",
      editor: {
        slide: 3,
        selection: "shape",
        data: { count: 1, geo: { x: "352", y: "182", w: "256", h: "264" }, fill: "#F4F6FB" },
        inspector: { sections: CHILD_SHAPE_SECTIONS },
        slideOverlay: (
          <>
            <Guide orientation="v" at={50} from={3} to={97} />
            <Guide orientation="h" at={33.78} from={7} to={93} dashed />
            <Guide orientation="h" at={58.2} from={33.667} to={36.667} label="29" />
            <Guide orientation="h" at={58.2} from={63.333} to={66.333} label="29" />
            <SelectionBox box={CARD[1]} handles="none" label="X 352 · Y 182" />
          </>
        ),
      },
    },
    {
      id: "snap-off",
      title: "按住 Alt · 吸附临时关闭",
      note: "03-17：按住 Alt 拖动时参考线消失、不吸附；原「状态栏短暂显示」改为画布上的提示签（v3 无状态栏）；缩略图在松手后才更新",
      editor: {
        deck: deckWith({ 3: { render: ({ where }) => <MetricsArt shift={where === "canvas" ? { i: 1, x: 1.6, y: 3.2 } : undefined} /> } }),
        slide: 3,
        selection: "shape",
        data: { count: 1, geo: { x: "367", y: "213", w: "256", h: "264" }, fill: "#F4F6FB" },
        inspector: { sections: CHILD_SHAPE_SECTIONS },
        slideOverlay: (
          <>
            <CanvasTag box={{ x: 38.267, y: 26.6 }}>吸附已临时关闭 · 松开 Alt 恢复</CanvasTag>
            <SelectionBox box={{ x: 38.267, y: 39.47, w: 26.667, h: 48.89 }} handles="none" label="X 367 · Y 213" />
          </>
        ),
      },
    },
    {
      id: "grid-visible",
      title: "显示网格",
      note: "03-17 网格与参考线：打开「显示网格」后画布上叠加 12 pt 网格（缺省间距，DS-27；线距等于网格间距、中性细线、每 4 格加深一档，与 view-zoom.grid-guides 同一画法，03-20 §5），只在编辑时显示，不进缩略图与放映；开关、间距与吸附在右键「网格与参考线 ▸」与主菜单「视图 › 网格与参考线 ▸」（同一张清单），只存本机偏好、不同步给协作者",
      editor: {
        slide: 3,
        slideOverlay: <SlideGrid spacing={12} />,
      },
    },
    {
      id: "align-menu",
      title: "异类多选 · 对齐与分布菜单",
      note: "03-17 对齐与分布 + 03-05 多选交集：标题、列表（文本）与要点卡（形状）一起选中，右键只留共有命令；「对齐与分布」展开六向对齐、横向 / 纵向分布与参照「所选对象 / 页面」；检查器只显示交集分区（位置与大小、不透明度）",
      editor: {
        slide: 2,
        selection: "mixed",
        data: { count: 3, geo: { x: null, y: null, w: null, h: null } },
        slideOverlay: (
          <>
            <HoverBox box={AGENDA_TITLE} />
            <HoverBox box={AGENDA_LIST} />
            <HoverBox box={AGENDA_CARD} />
            <UnionBox box={{ x: 6.2, y: 10.2, w: 86.8, h: 75.6 }} label="833 × 408" />
          </>
        ),
        layers: <ContextMenu at={{ anchor: "slide", x: 0.79, y: 0.6 }} openPath={["align"]} label="3 个对象" items={multiMenu(3)} />,
      },
    },
    {
      id: "group-edit",
      title: "组合编辑中",
      note: "03-17：双击组合内的子对象进入组合编辑，组合外围浅色虚线框 + 「组合编辑中」提示，选中的子对象照常有选中框；Esc 逐级退出（文本编辑 → 子对象 → 整个组合 → 取消选择）",
      editor: {
        slide: 6,
        selection: "shape",
        data: { count: 1, geo: { x: "67", y: "229", w: "61", h: "61" }, fill: "#E8EDFD" },
        inspector: {
          title: "圆角矩形",
          sections: CHILD_SHAPE_SECTIONS,
          notice: (
            <InspectorNotice>
              <p>在组合「拓展企业客户」内编辑</p>
              <p>按 Esc 返回整个组合</p>
            </InspectorNotice>
          ),
        },
        slideOverlay: (
          <>
            <GroupBounds box={{ x: 7, y: 37.33, w: 26, h: 40.98 }} />
            <CanvasTag box={{ x: 7, y: 31 }}>组合编辑中</CanvasTag>
            <SelectionBox box={{ x: 7, y: 42.4, w: 6.4, h: 11.38 }} />
          </>
        ),
      },
    },
    {
      id: "locked",
      title: "锁定对象",
      note: "03-17：锁定的对象（spLocks，来自原文件）选中后四角手柄换成锁形图标，拖动无效并提示「已锁定移动」；检查器仍可查看属性，「位置与大小」字段留在原位不可用（原因「已锁定移动」）",
      editor: {
        slide: 1,
        selection: "group",
        data: { count: 1, children: 6, locked: true, geo: { x: "613", y: "319", w: "279", h: "221" } },
        inspector: {
          notice: (
            <InspectorNotice icon={<Lock size={16} strokeWidth={1.5} aria-hidden="true" />}>
              <p>此组合在原文件中已锁定移动</p>
              <p>可以查看属性，不能拖动或缩放</p>
            </InspectorNotice>
          ),
        },
        slideOverlay: (
          <>
            <LockedBox box={{ x: 63.9, y: 59.11, w: 29.1, h: 40.89 }} label="279 × 221" />
            <CanvasTag box={{ x: 63.9, y: 51.6 }}>
              <Lock size={12} strokeWidth={1.75} aria-hidden="true" />
              该组合已锁定移动
            </CanvasTag>
          </>
        ),
      },
    },
    {
      id: "connector-snap",
      title: "连接符 · 端点吸附",
      note: "03-17 G-39：用箭头线从「方案设计」右侧连接点拉出，悬停「交付上线」时显示它的 4 个连接点，靠近左侧连接点时高亮并吸附；起点已连接（实心端点）",
      editor: {
        deck: flowDeck(true),
        slide: 7,
        toolbar: { tool: "shapes" },
        rail: { list: railTo7 },
        slideOverlay: (
          <>
            <HoverBox box={BOX3} />
            <ConnectionPoint x={81.25} y={44.444} />
            <ConnectionPoint x={91.667} y={LINE_Y} />
            <ConnectionPoint x={81.25} y={66.667} />
            <ConnectionPoint x={70.833} y={LINE_Y} kind="target" />
            <ConnectionPoint x={60.417} y={LINE_Y} kind="end" />
            <CanvasTag box={{ x: 70.833, y: 69.5 }}>连接到「交付上线」</CanvasTag>
          </>
        ),
      },
    },
    {
      id: "connector-connected",
      title: "连接符 · 已连接",
      note: "03-17 G-39：选中已连接的箭头连接符，两端实心端点；检查器「连接」写明起点 / 终点连到哪个形状的哪个连接点，拖离即断开、无需确认；肘形 / 曲线的跟随重算为 M3",
      editor: {
        deck: flowDeck(false),
        slide: 7,
        selection: "connector",
        data: { geo: { x: "280", y: "300", w: "100", h: "0" } },
        inspector: { title: "箭头连接符", sections: CONNECTOR_SECTIONS },
        rail: { list: railTo7 },
        slideOverlay: (
          <>
            <Guide orientation="h" at={LINE_Y} from={29.167} to={39.583} />
            <ConnectionPoint x={29.167} y={LINE_Y} kind="end" />
            <ConnectionPoint x={39.583} y={LINE_Y} kind="end" />
          </>
        ),
      },
    },
  ],
})
