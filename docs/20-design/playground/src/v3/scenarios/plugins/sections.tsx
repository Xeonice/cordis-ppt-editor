import type { ReactNode } from "react"
import { Plus } from "lucide-react"
import { Button, CheckRow, FoldSection, ICON, IconButton, MenuField, NumberField, Section, StaticRow, Tag, type InspectorCtx, type InspectorSectionDef } from "../../kit"
import { Note, Nowrap } from "./bits"

/**
 * 检查器插件分区很多时的收纳（rulings §4.25 TB-31；06 §2.12）。示例：第 4 页（营收趋势）无选中，内置「版式 / 主题 / 背景 / 放映」之后是 4 个第三方插件的分区。
 * 推荐规则（sections-few / sections-many）：
 *   - 插件分区一律排在内置分区之后（order ≥ 100），节标题后带归属标识（Blocks，悬停「由〈插件名〉提供」）；
 *   - 同一选中对象的插件分区不超过 2 个时照常展开；超过 2 个时全部默认折叠为一行（标题 + 归属 + ▸），展开状态按分区记在本机。
 *     内置分区的位置与长短因此不随装了多少插件而变，插件区最多占「N × 40px」。
 * 备选（alt-sections-expanded）：维持暂行规则，全部展开、内容区纵向滚动。
 * 这些分区只为本场景的几个状态写成状态私有的分区定义（inspector.sections），不注册到「none」种类，免得出现在别的场景里。
 */

interface PluginSec {
  id: string
  title: string
  plugin: string
  vendor: string
  body: (ctx: InspectorCtx) => ReactNode
}

const DATA_REFRESH: PluginSec = {
  id: "plugins.sec-data-refresh",
  title: "数据刷新",
  plugin: "数据图表增强",
  vendor: "ACME",
  body: ({ readOnly }) =>
    readOnly ? (
      <>
        <StaticRow label="刷新">每 15 分钟</StaticRow>
        <StaticRow label="上次">10:42</StaticRow>
      </>
    ) : (
      <>
        <Note>
          本页 1 个图表绑定了外部数据，<Nowrap>上次刷新 10:42</Nowrap>
        </Note>
        <div className="flex items-center gap-2">
          <MenuField aria="刷新间隔" items={["每 15 分钟", "每小时", "仅手动"]} defaultValue="每 15 分钟" className="flex-1" />
          <Button variant="secondary">立即刷新</Button>
        </div>
      </>
    ),
}

const REHEARSAL: PluginSec = {
  id: "plugins.sec-rehearsal",
  title: "讲稿计时",
  plugin: "演讲排练",
  vendor: "Beta Labs",
  body: () => (
    <>
      <NumberField label="建议时长" defaultValue="90" unit="秒" aria="本页建议时长" />
      <CheckRow label="超时后在演讲者视图里提醒" defaultChecked />
    </>
  ),
}

const TAGS: PluginSec = {
  id: "plugins.sec-tags",
  title: "页面标签",
  plugin: "元数据标签",
  vendor: "ACME",
  body: () => (
    <div className="flex flex-wrap items-center gap-1.5">
      <Tag>财务</Tag>
      <Tag>Q2</Tag>
      <Tag>对外发布</Tag>
      <IconButton label="添加标签" size={24}>
        <Plus {...ICON} />
      </IconButton>
    </div>
  ),
}

const TRANSLATE: PluginSec = {
  id: "plugins.sec-translate",
  title: "翻译",
  plugin: "翻译助手",
  vendor: "Lingo",
  body: () => (
    <>
      <MenuField aria="目标语言" items={["English", "日本語", "繁體中文"]} defaultValue="English" />
      <div className="flex items-center justify-between gap-2">
        <Note>本页 3 段待翻译</Note>
        <Button variant="secondary">翻译本页</Button>
      </div>
    </>
  ),
}

const ALL = [DATA_REFRESH, REHEARSAL, TAGS, TRANSLATE]
const BUILTIN = ["slide.layout", "slide.theme", "slide.background", "slide.playback"]

/** 展开的插件分区（kit Section 外框 + 归属标识） */
const expanded = (s: PluginSec, order: number): InspectorSectionDef => ({
  id: s.id,
  kinds: ["none"],
  order,
  component: (ctx) => (
    <Section title={s.title} owner={{ plugin: s.plugin, vendor: s.vendor }}>
      {s.body(ctx)}
    </Section>
  ),
})

/** 折叠为一行的插件分区（点标题行展开） */
const folded = (s: PluginSec, order: number): InspectorSectionDef => ({
  id: s.id,
  kinds: ["none"],
  order,
  component: (ctx) => (
    <FoldSection title={s.title} owner={{ plugin: s.plugin, vendor: s.vendor }} defaultOpen={false}>
      {s.body(ctx)}
    </FoldSection>
  ),
})

/** sections-few：2 个插件分区，照常展开 */
export const SECTIONS_FEW: (string | InspectorSectionDef)[] = [...BUILTIN, expanded(DATA_REFRESH, 100), expanded(TAGS, 110)]
/** sections-many：4 个插件分区，默认折叠为一行 */
export const SECTIONS_MANY: (string | InspectorSectionDef)[] = [...BUILTIN, ...ALL.map((s, i) => folded(s, 100 + i * 10))]
/** 备选：4 个插件分区全部展开（暂行规则），内容区纵向滚动 */
export const SECTIONS_EXPANDED: (string | InspectorSectionDef)[] = [...BUILTIN, ...ALL.map((s, i) => expanded(s, 100 + i * 10))]
