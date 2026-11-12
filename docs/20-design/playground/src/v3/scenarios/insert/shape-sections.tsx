import { Image as ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  ColorChip, GeometrySection, getInspectorSection, ICON, inspectorPanel, inspectorSections, NEW_SHAPE_QUICK_STYLE, QuickStyleSection, Section, Segmented, SELECT_FRAME,
  type InspectorCtx, type InspectorSectionDef,
} from "../../kit"
import { ShapeActionSection } from "../../editor/inspector/builtin"
import { FillGradientIcon, FillNoneIcon, FillSolidIcon } from "../../shape-icons"
import { PlacedTitle, usePlacedGeometry } from "./shape-pick"

/**
 * shape-library 场景里刚插入的形状用的检查器分区（状态私有，不注册到「shape」种类，免得改动别的场景里「shape」的样子；
 * 文末另给场景私有种类 shape-library-new 注册了一组，供单击画布插入的新形状使用）：
 * 位置 / 尺寸取新形状的真实数值；快速样式为新形状缺省的「彩色填充 · 强调色 1」（DS-31），填充与描边显示「主题样式」（新插入的形状只写 p:style 主题引用，R-d-63，03-15「交互说明」）；
 * 「操作」一行是操作设置对话框在检查器里的入口（普通形状也可设置，03-15「操作设置 · 触发」）。
 */

function ThemeColorRow({ color, name, aria }: { color: string; name: string; aria: string }) {
  return (
    <button
      type="button"
      aria-label={`${aria}：${name}`}
      className={cn(SELECT_FRAME, "flex h-7 w-full items-center text-left transition-colors hover:bg-(--v3-select-fill-hover)")}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2 pl-2">
        <ColorChip color={color} />
        <span className="truncate text-[12px] leading-none text-(--v3-text)">{name}</span>
      </span>
      <span aria-hidden="true" className="h-4 w-px bg-(--v3-border)" />
      <span className="w-12 pr-2 text-right text-[12px] leading-none text-(--v3-text) tabular-nums">100%</span>
    </button>
  )
}

/** 位置与大小：底座共用的几何分区（与默认矩形、图片、表格、图表同一套字段与单位） */
function makeGeometry(x: string, y: string, w: string, h: string): InspectorSectionDef {
  return { id: "shape-library.geometry", kinds: ["shape"], order: 10, component: (ctx) => <GeometrySection anchor="section-shape.geometry" readOnly={ctx.readOnly} value={{ x, y, w, h }} /> }
}

const THEMED_FILL: InspectorSectionDef = {
  id: "shape-library.fill",
  kinds: ["shape"],
  order: 30,
  component: () => (
    <Section title="填充">
      <Segmented
        aria="填充类型"
        defaultValue="solid"
        options={[
          { value: "none", label: "无", icon: <FillNoneIcon /> },
          { value: "solid", label: "纯色", icon: <FillSolidIcon /> },
          { value: "gradient", label: "渐变", icon: <FillGradientIcon /> },
          // 图片填充 P2：留在原位、标 P2、不可用（rulings §4.25 TB-43）
          { value: "image", label: "图片", icon: <ImageIcon {...ICON} />, tag: "P2", disabled: true, reason: "后续版本提供" },
        ]}
      />
      <ThemeColorRow color="#3A5CE6" name="主题样式 · 强调 1" aria="填充" />
    </Section>
  ),
}

const THEMED_STROKE: InspectorSectionDef = {
  id: "shape-library.stroke",
  kinds: ["shape"],
  order: 40,
  component: () => (
    <Section title="描边">
      <Segmented
        aria="描边样式"
        defaultValue="solid"
        options={[
          { value: "none", label: "无", text: "无" },
          { value: "solid", label: "实线", text: "实线" },
          { value: "dashed", label: "虚线", text: "虚线" },
        ]}
      />
      <ThemeColorRow color="#2C47C2" name="主题样式 · 强调 1 深色 25%" aria="描边" />
    </Section>
  ),
}

/** 快速样式：新插入的形状缺省「彩色填充 · 强调色 1」（与要点卡分开记，场景状态键 shape-library.quick-style） */
const NEW_STYLE: InspectorSectionDef = {
  id: "shape-library.style",
  kinds: ["shape"],
  order: 20,
  component: (ctx) => <QuickStyleSection {...ctx} stateKey="shape-library.quick-style" initial={NEW_SHAPE_QUICK_STYLE} />,
}

/** 「操作」：底座的 shape.action（点开即操作设置对话框，与右键「操作设置…」同一对话框）；值来自 data.shapeAction，这里给定值 */
function makeAction(value: string): InspectorSectionDef {
  return { id: "shape-library.action", kinds: ["shape"], order: 70, component: (ctx) => <ShapeActionSection {...ctx} data={{ ...ctx.data, shapeAction: value }} /> }
}

/** 刚插入的圆角矩形（第 3 个流程框）：246 × 120，位于 647, 221 */
export const NEW_SHAPE_SECTIONS: (string | InspectorSectionDef)[] = [
  "shape.align",
  makeGeometry("647", "221", "246", "120"),
  NEW_STYLE,
  THEMED_FILL,
  THEMED_STROKE,
  "shape.shadow",
  "shape.opacity",
  makeAction("无动作"),
]

/** 刚插入的「前进或下一项」动作按钮：63 × 42，位于 830, 420，默认动作「下一张幻灯片」 */
export const ACTION_BUTTON_SECTIONS: (string | InspectorSectionDef)[] = [
  "shape.align",
  makeGeometry("830", "420", "63", "42"),
  NEW_STYLE,
  THEMED_FILL,
  THEMED_STROKE,
  "shape.shadow",
  "shape.opacity",
  makeAction("下一张幻灯片"),
]

/* ------------------------------------------------------------------ 在画布上单击插入的新形状（shape-pick.tsx，场景私有种类 shape-library-new） */

/** 内置分区（对齐、不透明度）按 id 在渲染时取，免得模块加载顺序早于内置分区注册 */
function builtin(id: string) {
  return function Builtin(ctx: InspectorCtx) {
    const Def = getInspectorSection(id)?.component
    return Def ? <Def {...ctx} /> : null
  }
}

function PlacedGeometry() {
  const g = usePlacedGeometry()
  return <GeometrySection anchor="section-shape.geometry" value={{ x: g?.x ?? 0, y: g?.y ?? 0, w: 72, h: 72 }} />
}

inspectorPanel({ kind: "shape-library-new", title: () => <PlacedTitle /> })
inspectorSections([
  { id: "shape-library.new-align", kinds: ["shape-library-new"], order: 0, placement: "top", component: builtin("shape.align") },
  { id: "shape-library.new-geometry", kinds: ["shape-library-new"], order: 10, component: PlacedGeometry },
  { ...NEW_STYLE, id: "shape-library.new-style", kinds: ["shape-library-new"] },
  { ...THEMED_FILL, id: "shape-library.new-fill", kinds: ["shape-library-new"] },
  { ...THEMED_STROKE, id: "shape-library.new-stroke", kinds: ["shape-library-new"] },
  { id: "shape-library.new-shadow", kinds: ["shape-library-new"], order: 50, component: builtin("shape.shadow") },
  { id: "shape-library.new-opacity", kinds: ["shape-library-new"], order: 60, component: builtin("shape.opacity") },
  { id: "shape-library.new-action", kinds: ["shape-library-new"], order: 70, component: builtin("shape.action") },
])
