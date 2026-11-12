import type { ReactNode } from "react"
import { Toast, Toasts, registerToolLayer } from "../../kit"
import { defineScenario, type EditorConfig } from "../types"
import { ActionSettingsDialog } from "./ActionSettings"
import { ACTION_BOX, flowDeck, SLOT3 } from "./flow-slide"
import { Crosshair, DragPreview, TransformBox } from "./insert-tool"
import { ArmedHint, PickableToolbar, PlacedToast, ShapeStageLayer } from "./shape-pick"
import { ACTION_BUTTON_SECTIONS, NEW_SHAPE_SECTIONS } from "./shape-sections"

/**
 * 每个状态的画布叠加：插入工具态（shape-pick.tsx）的提示条、点击插入区与插入后的轻提示，加上状态自己的演示叠加。
 * armed：工具态演示（十字光标、拖出预览，只在仍处于工具态时画）；overlay：状态本身的画面（变换手柄等）；toast：状态自带的轻提示。
 */
const pickLayers = ({ armed, overlay, toast }: { armed?: ReactNode; overlay?: ReactNode; toast?: ReactNode } = {}): EditorConfig => ({
  slideOverlay: (ctx) => <ShapeStageLayer ctx={ctx} armedOverlay={armed} overlay={overlay} />,
  canvasOverlay: (
    <>
      <ArmedHint />
      {toast}
      <PlacedToast />
    </>
  ),
})

/**
 * 03-15 形状库与插入工具态：工具条「形状」的 4 × 3 弹层加一行「全部形状」，在原位展开完整形状库（10 类 72 项）——已并入底座工具条
 * （toolbar.shapesOpen / shapesView / shapesActive），这里的状态直接用底座的弹层；
 * 选中一项进入插入工具态（顶部提示条、十字光标、拖出预览与尺寸角标），插入后选中并显示变换手柄；
 * 动作按钮插入后立即弹出「操作设置」。画面里的第 6 页换成「下半年计划」流程图变体，用户正在画第 3 个阶段框。
 * 交互（shape-pick.tsx）：点形状库或常用 4 × 3 里的格子即进入该形状的插入工具态，Esc 退出；工具态里单击画布在落点插入 72 × 72 pt 并选中，轻提示带撤销。
 */
// 检查器「操作」（底座 shape.action，任何状态的形状都有）点开的同一个操作设置对话框：普通形状缺省「无动作」，关闭后焦点回到那一行
registerToolLayer("shape:action", () => <ActionSettingsDialog shapeId="rect" initial="none" returnFocus="section-shape.action" />)

export default defineScenario({
  id: "shape-library",
  title: "形状库与插入工具",
  specs: ["03-15"],
  summary: "全部形状、插入工具态、拖出预览、变换手柄与动作按钮操作设置",
  editor: {
    deck: flowDeck("empty3"),
    slide: 6,
    stage: { cursor: false },
    regions: { toolbar: (_ctx, d) => <PickableToolbar d={d} /> },
    ...pickLayers(),
  },
  states: [
    {
      id: "quick",
      title: "形状 ▾ · 全部形状入口",
      note: "工具条「形状」的 4 × 3 常用形状不变，底部加一行「全部形状 72 ›」，点它在原位展开完整形状库（50/19 §1.2「在弹层里展开」）",
      editor: { toolbar: { tool: "shapes", shapesOpen: true } },
    },
    {
      id: "library",
      title: "全部形状 · 72 项",
      note: "03-15「形状库」：最近使用置顶 + 9 类，类名列 56、格子 28；线条末三项 P2 禁用而不隐藏并挂 P2 标记；底部提示单击 / 拖出与修饰键",
      editor: { toolbar: { tool: "shapes", shapesOpen: true, shapesView: "library" } },
    },
    {
      id: "insert-ready",
      title: "插入工具就绪",
      note: "03-15「插入工具态」：形状按钮保持按下；画布顶部提示条写明工具名、单击 / 拖出与 Shift / Alt / Esc（替代 ribbon 版的状态栏）；画布十字光标",
      editor: { toolbar: { tool: "shapes" }, data: { armed: "roundRect" }, ...pickLayers({ armed: <Crosshair x={70.5} y={44.5} /> }) },
    },
    {
      id: "insert-drag",
      title: "拖出预览",
      note: "03-15「拖出预览」：起点圆点、1.5px 强调色虚线框、按真实几何的幽灵预览（圆角 = 短边 × 16.667%）、下方尺寸角标，终点十字光标",
      editor: { toolbar: { tool: "shapes" }, data: { armed: "roundRect" }, ...pickLayers({ armed: <DragPreview box={SLOT3} w={246} h={120} /> }) },
    },
    {
      id: "library-armed",
      title: "工具态中再开形状库",
      note: "03-15「插入工具态视觉 · Ribbon」：再次打开形状库时当前工具格高亮（强调色浅底 + 强调色图形），提示条仍在",
      editor: { toolbar: { tool: "shapes", shapesOpen: true, shapesView: "library" }, data: { armed: "roundRect" } },
    },
    {
      id: "inserted",
      title: "已插入 · 变换手柄",
      note: "03-15「插入交互」与「变换手柄」：松手后选中新形状，8 个缩放手柄 + 旋转手柄 + 调整手柄（菱形）；检查器填充 / 描边显示「主题样式」；轻提示带撤销",
      editor: {
        deck: flowDeck("new3"),
        selection: "shape",
        inspector: { title: "圆角矩形", sections: NEW_SHAPE_SECTIONS },
        ...pickLayers({
          overlay: <TransformBox box={SLOT3} label="246 × 120" adjust={8.14} />,
          toast: (
            <Toasts>
              <Toast action="撤销">已插入 · 圆角矩形</Toast>
            </Toasts>
          ),
        }),
      },
    },
    {
      id: "action-settings",
      title: "动作按钮 · 操作设置",
      note: "03-15 G-79：动作按钮插入完成的同一刻弹出，默认动作按按钮预选（前进或下一项 → 下一张幻灯片）；悬停页签 P2 禁用而不隐藏",
      editor: {
        deck: flowDeck("complete"),
        selection: "shape",
        inspector: { title: "动作按钮", sections: ACTION_BUTTON_SECTIONS },
        ...pickLayers({ overlay: <TransformBox box={ACTION_BOX} label="63 × 42" /> }),
        layers: <ActionSettingsDialog />,
      },
    },
    {
      id: "action-slide",
      title: "操作设置 · 指定幻灯片",
      note: "03-15「附加字段」：选「指定幻灯片…」时下方出现页选择（序号. 标题）；选「网址（URL）…」时为地址输入",
      editor: {
        deck: flowDeck("complete"),
        selection: "shape",
        inspector: { title: "动作按钮", sections: ACTION_BUTTON_SECTIONS },
        ...pickLayers({ overlay: <TransformBox box={ACTION_BOX} label="63 × 42" /> }),
        layers: <ActionSettingsDialog initial="slide" />,
      },
    },
  ],
})
