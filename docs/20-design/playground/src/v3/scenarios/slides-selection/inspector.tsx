import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical,
  AlignVerticalDistributeCenter, Link2, type LucideIcon,
} from "lucide-react"
import {
  Button, CheckRow, ColorField, Cols, GeometrySection, ICON, IconButton, inspectorPanel, inspectorSections, MenuField, NumberField, PropRow, QuickStyleSection, Section, Segmented,
  SliderField, type InspectorCtx, type InspectorSectionDef,
} from "../../kit"

/**
 * 03-17 的检查器：多选（同类 / 异类）、组合、锁定、连接符。
 * 真实种类 mixed（异类多选，只显示交集分区）与 group（整个组合被选中）由本组注册（README §4：负责它的场景注册一次）；
 * 同类多选沿用 shape 种类、连接符沿用 connector 种类，用状态级 inspector.sections 写分区（不注册，避免与形状 / 线条场景的注册冲突）。
 * 字段值从 EditorConfig.data 读：data.geo = { x, y, w, h }（null 表示「多个值」），data.count 选中个数，data.locked 已锁定移动。
 */

export interface Geo {
  x: string | null
  y: string | null
  w: string | null
  h: string | null
}

const geoOf = (data: Record<string, unknown>): Geo => (data.geo as Geo | undefined) ?? { x: null, y: null, w: null, h: null }
const countOf = (data: Record<string, unknown>) => (typeof data.count === "number" ? data.count : 2)

/* ------------------------------------------------------------------ 标题上方的对齐行（多选时带分布与参照） */

const ALIGN: { label: string; Icon: LucideIcon }[] = [
  { label: "左对齐", Icon: AlignStartVertical },
  { label: "水平居中", Icon: AlignCenterVertical },
  { label: "右对齐", Icon: AlignEndVertical },
  { label: "顶对齐", Icon: AlignStartHorizontal },
  { label: "垂直居中", Icon: AlignCenterHorizontal },
  { label: "底对齐", Icon: AlignEndHorizontal },
]

const DIST: { label: string; Icon: LucideIcon }[] = [
  { label: "横向分布", Icon: AlignHorizontalDistributeCenter },
  { label: "纵向分布", Icon: AlignVerticalDistributeCenter },
]

/**
 * 对齐行：六向对齐 + 横向 / 纵向分布（不足 3 个对象时 aria-disabled、仍可聚焦，提示原因）。
 * 多选时第二行是「对齐参照」：所选对象 / 页面（03-17；单选时固定为页面，不显示这一行）。只读与锁定时整行不可用。
 */
function AlignTop({ data, readOnly }: InspectorCtx) {
  const count = countOf(data)
  const locked = !!data.locked || readOnly
  const lockReason = data.locked ? "已锁定移动" : "需要编辑权限"
  return (
    <Section className="px-2.5 py-2" anchor="section-selection.align">
      <div className="flex items-center justify-between">
        {ALIGN.map(({ label, Icon }) => (
          <IconButton key={label} label={label} disabled={locked} reason={lockReason}>
            <Icon {...ICON} />
          </IconButton>
        ))}
        <span aria-hidden="true" className="h-4 w-px bg-(--v3-border)" />
        {DIST.map(({ label, Icon }) => (
          <IconButton key={label} label={label} disabled={locked || count < 3} reason={locked ? lockReason : "需选中 3 个以上对象"}>
            <Icon {...ICON} />
          </IconButton>
        ))}
      </div>
      {count > 1 && (
        <div className="flex h-7 items-center justify-between pl-1.5">
          <span className="text-[12px] leading-4 text-(--v3-text-2)">对齐参照</span>
          <Segmented
            aria="对齐参照"
            defaultValue="selection"
            className="w-[152px]"
            options={[
              { value: "selection", label: "所选对象", text: "所选对象" },
              { value: "page", label: "页面", text: "页面" },
            ]}
          />
        </div>
      )}
    </Section>
  )
}

/* ------------------------------------------------------------------ 位置与大小（混合值、锁定、只读） */

/** 位置与大小：底座共用的几何分区（多选时不同的值写「多个值」；已锁定移动时字段留在原位不可用，写原因） */
function GeometrySections({ data, readOnly, selection }: InspectorCtx) {
  const g = geoOf(data)
  const reason = data.locked ? "已锁定移动" : undefined
  // 连接符的位置与大小由两端决定：不旋转、不翻转、不锁比例
  const line = selection === "connector"
  return (
    <GeometrySection
      anchor="section-selection.geometry"
      readOnly={readOnly}
      disabled={reason}
      value={{ x: g.x, y: g.y, w: g.w, h: g.h, rotate: countOf(data) > 1 && g.x === null ? null : "0" }}
      rotate={!line}
      ratio={!line}
      note={line ? "由两端的连接点决定，拖动端点即可改变" : undefined}
    />
  )
}

/** 不透明度：滑块 + 数值（与矩形、图片同一画法）；多选时值不同则数值框写「多个值」 */
function OpacitySection({ data }: InspectorCtx) {
  const v = typeof data.opacity === "string" ? data.opacity : "100%"
  const n = Number.parseInt(v, 10)
  return (
    <Section title="不透明度" anchor="section-selection.opacity">
      <SliderField aria="不透明度" defaultValue={Number.isFinite(n) ? n : 100} />
    </Section>
  )
}

function FillSection({ data }: InspectorCtx) {
  const fill = typeof data.fill === "string" ? data.fill : "#F4F6FB"
  return (
    <Section title="填充" anchor="section-selection.fill">
      <ColorField color={fill} hex={fill.toUpperCase()} aria="填充" />
    </Section>
  )
}

/* ------------------------------------------------------------------ 组合 */

function GroupSection({ data, readOnly }: InspectorCtx) {
  const n = typeof data.children === "number" ? data.children : 4
  return (
    <Section title="组合" anchor="section-selection.group">
      <PropRow label={`包含 ${n} 个对象`}>
        <Button variant="secondary" disabled={readOnly} reason={readOnly ? "需要编辑权限" : undefined}>
          取消组合
        </Button>
      </PropRow>
    </Section>
  )
}

/* ------------------------------------------------------------------ 注册：mixed（异类多选）与 group（组合） */

inspectorPanel({ kind: "mixed", title: ({ data }) => `${countOf(data)} 个对象` })
inspectorPanel({ kind: "group", title: "组合" })

inspectorSections([
  { id: "selection.mixed-align", kinds: ["mixed"], order: 0, placement: "top", component: AlignTop },
  { id: "selection.mixed-geometry", kinds: ["mixed"], order: 10, component: GeometrySections },
  { id: "selection.mixed-opacity", kinds: ["mixed"], order: 30, component: OpacitySection },

  { id: "selection.group-align", kinds: ["group"], order: 0, placement: "top", component: AlignTop },
  { id: "selection.group-geometry", kinds: ["group"], order: 10, component: GeometrySections },
  { id: "selection.group-info", kinds: ["group"], order: 20, component: GroupSection },
  { id: "selection.group-opacity", kinds: ["group"], order: 30, component: OpacitySection },
])

/* ------------------------------------------------------------------ 状态级分区（inspector.sections 里直接用，不注册） */

/**
 * 同类多选（两个矩形）：对齐行带分布与参照 + 混合值的位置尺寸 + 快速样式 + 填充；描边 / 阴影 / 不透明度沿用内置形状分区。
 * 两张指标卡用的是显式填充、没有套用主题样式，快速样式行没有当前格（DS-31；读屏名「多个值」，选一格即统一套用到所选对象）。
 */
export const MULTI_SHAPE_SECTIONS: (string | InspectorSectionDef)[] = [
  { id: "selection.multi-align", kinds: ["shape"], order: 0, placement: "top", component: AlignTop },
  { id: "selection.multi-geometry", kinds: ["shape"], order: 10, component: GeometrySections },
  { id: "selection.multi-style", kinds: ["shape"], order: 20, component: (ctx) => <QuickStyleSection {...ctx} stateKey="selection.multi-quick-style" initial={null} /> },
  { id: "selection.multi-fill", kinds: ["shape"], order: 30, component: FillSection },
  "shape.stroke",
  "shape.shadow",
  "shape.opacity",
]

/** 组合编辑中选中的子对象（圆角矩形）：单选对齐行 + 它自己的位置尺寸、快速样式（显式填充、没有套用主题样式，没有当前格）与填充。 */
export const CHILD_SHAPE_SECTIONS: (string | InspectorSectionDef)[] = [
  { id: "selection.child-align", kinds: ["shape"], order: 0, placement: "top", component: AlignTop },
  { id: "selection.child-geometry", kinds: ["shape"], order: 10, component: GeometrySections },
  { id: "selection.child-style", kinds: ["shape"], order: 20, component: (ctx) => <QuickStyleSection {...ctx} stateKey="selection.child-quick-style" initial={null} emptyLabel="未套用样式" /> },
  { id: "selection.child-fill", kinds: ["shape"], order: 30, component: FillSection },
  "shape.stroke",
  "shape.shadow",
  "shape.opacity",
]

function LineSection() {
  return (
    <Section title="线条" anchor="section-selection.line">
      <Segmented
        aria="线条样式"
        defaultValue="solid"
        options={[
          { value: "solid", label: "实线", text: "实线" },
          { value: "dashed", label: "虚线", text: "虚线" },
        ]}
      />
      <ColorField color="#4B566B" hex="#4B566B" aria="线条" />
      <Cols>
        <NumberField label="粗细" defaultValue="2" unit="pt" aria="线条粗细" />
        <MenuField aria="终点箭头" items={["无箭头", "三角箭头", "圆点"]} defaultValue="三角箭头" />
      </Cols>
    </Section>
  )
}

/** 连接状态：起点 / 终点各连到哪个形状的哪个连接点（03-17 G-39「已连接到：矩形 3」）；拖离即断开，不另设按钮。 */
function ConnectionSection() {
  const row = (label: string, shape: string, side: string) => (
    <PropRow label={label}>
      <span className="text-[12px] leading-4 whitespace-nowrap text-(--v3-text)">
        {shape}
        <span className="text-(--v3-text-2)"> · {side}</span>
      </span>
    </PropRow>
  )
  return (
    <Section title="连接" anchor="section-selection.connection">
      {row("起点", "需求评审", "右侧连接点")}
      {row("终点", "方案设计", "左侧连接点")}
      <p className="text-[12px] leading-[18px] text-(--v3-text-2)">把端点拖离形状即可断开</p>
    </Section>
  )
}

function ConnectorKindSection() {
  return (
    <Section title="类型" anchor="section-selection.connector-kind">
      <Segmented
        aria="连接符类型"
        defaultValue="straight"
        options={[
          { value: "straight", label: "直线", text: "直线" },
          { value: "elbow", label: "肘形", text: "肘形" },
          { value: "curve", label: "曲线", text: "曲线" },
        ]}
      />
    </Section>
  )
}

/** 选中的箭头连接符。 */
export const CONNECTOR_SECTIONS: InspectorSectionDef[] = [
  { id: "selection.connector-connection", kinds: ["connector"], order: 10, component: ConnectionSection },
  { id: "selection.connector-line", kinds: ["connector"], order: 20, component: LineSection },
  { id: "selection.connector-kind", kinds: ["connector"], order: 30, component: ConnectorKindSection },
  { id: "selection.connector-geometry", kinds: ["connector"], order: 40, component: GeometrySections },
]

/* ------------------------------------------------------------------ 幻灯片属性里的「放映」（隐藏此页，03-14 D15） */

/** 「放映」已是底座无选中检查器的常驻一节（slide.playback：切换 M2 只读 + 放映时跳过此页）；这里只按状态给值（data.slideHidden）。 */
export const SLIDE_WITH_PLAYBACK: (string | InspectorSectionDef)[] = ["slide.layout", "slide.theme", "slide.background", "slide.playback"]
