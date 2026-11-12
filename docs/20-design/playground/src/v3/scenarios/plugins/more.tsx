import { Blocks, CalendarRange, ChartGantt, Columns3, DatabaseZap, Diamond, Network, Palette, Pill, QrCode, Shapes, Spline, Vote, Workflow, type LucideIcon } from "lucide-react"
import { ICON, Menu, MORE_ALIAS_OUTSIDE_TEXT, moreMenu, pluginGroupLabel, useWiredMenu, type MenuSpec } from "../../kit"

/**
 * 工具条「更多」里插件很多时的收纳（rulings §4.25 TB-31；06 §2.6，03-04 §4.3）。
 * 推荐规则（more-few / more-many）：
 *   - 插件不超过 3 个、且每个插件的条目不超过 3 个：每个插件一组平铺（分组标题「〈插件名〉 · 第三方」+ 条目），即第 1 批的暂行规则，不变；
 *   - 否则插件区整体改为「插件」小标题 + 每个插件一行「〈插件名〉 ▸」（行首插件图标），条目进子菜单，子菜单顶部仍是「〈插件名〉 · 第三方」归属标题。
 *   插件区始终排在内置项之后、以分隔线隔开；顺序按 order → 插件声明顺序 → id（06 §2.1）。主菜单「插入」末尾的插件分组用同一规则。
 * 备选（alt-more-one-sub）：全部插件收进一个「插件 ▸」子菜单，里面按插件分组平铺。
 */

interface MorePlugin {
  id: string
  name: string
  vendor: string
  icon: LucideIcon
  items: { id: string; label: string; icon: LucideIcon }[]
}

/** 本部署贡献了创建类入口（create.more）的插件，按声明顺序 */
const QR: MorePlugin = { id: "acme:qr-shape", name: "二维码形状", vendor: "ACME", icon: QrCode, items: [{ id: "qr", label: "二维码…", icon: QrCode }] }
const POLL: MorePlugin = { id: "beta:live-poll", name: "现场投票", vendor: "Beta Labs", icon: Vote, items: [{ id: "poll", label: "投票…", icon: Vote }] }
const GANTT: MorePlugin = {
  id: "acme:gantt",
  name: "甘特图",
  vendor: "ACME",
  icon: ChartGantt,
  items: [
    { id: "gantt", label: "甘特图…", icon: ChartGantt },
    { id: "timeline", label: "时间轴…", icon: CalendarRange },
  ],
}
const FLOW: MorePlugin = {
  id: "acme:flow-shapes",
  name: "流程图形状包",
  vendor: "ACME",
  icon: Shapes,
  items: [
    { id: "flow-node", label: "流程图节点", icon: Workflow },
    { id: "flow-decision", label: "判断", icon: Diamond },
    { id: "flow-terminal", label: "开始 / 结束", icon: Pill },
    { id: "flow-lane", label: "泳道", icon: Columns3 },
    { id: "flow-connector", label: "连接线", icon: Spline },
  ],
}
const BRAND: MorePlugin = { id: "acme:brand-kit", name: "品牌素材包", vendor: "ACME", icon: Palette, items: [{ id: "brand", label: "品牌素材…", icon: Palette }] }
const ORG: MorePlugin = { id: "acme:org-chart", name: "组织架构图", vendor: "ACME", icon: Network, items: [{ id: "org", label: "组织架构图…", icon: Network }] }
const DATA: MorePlugin = { id: "acme:data-binding", name: "数据图表增强", vendor: "ACME", icon: DatabaseZap, items: [{ id: "data-card", label: "数据卡片…", icon: DatabaseZap }] }

export const FEW = [QR, POLL, GANTT]
export const MANY = [QR, POLL, FLOW, GANTT, BRAND, ORG, DATA]

/** 内置部分（与底座「更多」同一份条目，03-04 定稿）：去掉底座示例里的流程图插件分组，换成本场景的插件区 */
const builtin = (): MenuSpec[] => moreMenu(false).slice(0, -2)

/** 插件分组标题（06 §4：12px Blocks +「〈插件名〉 · 第三方」，不可选，读屏名「〈插件名〉（第三方）」）；与 kit pluginGroupLabel 同一画法，名字可换 */
/** 插件分组标题：kit pluginGroupLabel（与主菜单「插入」末尾的插件分组同一件，插件名与读屏名可换） */
const groupLabel = pluginGroupLabel

const pluginGroup = (p: MorePlugin): MenuSpec[] => [
  groupLabel(`label-${p.id}`, `${p.name} · 第三方`, `${p.name}（第三方）`),
  ...p.items.map((it): MenuSpec => ({ id: `${p.id}:${it.id}`, label: it.label, icon: <it.icon {...ICON} /> })),
]

/** 插件区平铺：每个插件一组，组与组之间一条分隔线（06 §4「前面一条分隔线与一行分组标题」） */
const flat = (list: MorePlugin[]): MenuSpec[] => list.flatMap((p, i) => [...(i > 0 ? [{ type: "separator" } as MenuSpec] : []), ...pluginGroup(p)])

/** 插件区折叠：「插件」小标题 + 每个插件一行「〈插件名〉 ▸」 */
const folded = (list: MorePlugin[]): MenuSpec[] => [
  groupLabel("plugins-area", `插件 · ${list.length}`, `插件（${list.length} 个，第三方）`),
  ...list.map((p): MenuSpec => ({ type: "sub", id: `plugin-${p.id}`, label: p.name, icon: <p.icon {...ICON} />, items: pluginGroup(p) })),
]

/** 推荐规则：插件 ≤ 3 个且每个 ≤ 3 条时平铺，否则折叠 */
export const pluginArea = (list: MorePlugin[]): MenuSpec[] => (list.length <= 3 && list.every((p) => p.items.length <= 3) ? flat(list) : folded(list))

/**
 * 静态打开的「更多」：内置条目接上底座同一批面板（页眉和页脚、图标…选了真的打开），插件条目选了只关菜单。
 * 同一份条目也交给底座工具条（状态的 toolbar.moreItems，见 plugins.scenario.tsx）：关掉后再从工具条打开「更多」，内容与载入时一致（第 2 轮评审）
 */
function MoreLayer({ items, openPath }: { items: MenuSpec[]; openPath?: string[] }) {
  const [wired, layer] = useWiredMenu(items, "more", MORE_ALIAS_OUTSIDE_TEXT)
  return (
    <>
      <Menu anchor="tool-more" label="更多插入" items={wired} openPath={openPath} />
      {layer}
    </>
  )
}

/** 三种收纳的「更多」条目（静态打开的菜单与底座工具条共用一份） */
export const MORE_ITEMS = {
  few: (): MenuSpec[] => [...builtin(), ...pluginArea(FEW)],
  many: (): MenuSpec[] => [...builtin(), ...pluginArea(MANY)],
  oneSub: (): MenuSpec[] => [...builtin(), { type: "sub", id: "plugins", label: "插件", icon: <Blocks {...ICON} />, items: flat(MANY) }],
}

/** more-few：3 个插件、每个 ≤ 3 条，平铺（暂行规则的上限） */
export const MoreFew = () => <MoreLayer items={MORE_ITEMS.few()} />

/** more-many：7 个插件，折叠为每个插件一行；「流程图形状包 ▸」展开（5 个条目） */
export const MoreMany = () => <MoreLayer items={MORE_ITEMS.many()} openPath={[`plugin-${FLOW.id}`]} />

/** 备选：全部插件收进一个「插件 ▸」子菜单，里面按插件分组平铺 */
export const MoreOneSub = () => <MoreLayer items={MORE_ITEMS.oneSub()} openPath={["plugins"]} />
