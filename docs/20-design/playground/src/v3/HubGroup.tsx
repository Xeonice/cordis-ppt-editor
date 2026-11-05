import { Fragment, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { routes } from "@/routes/registry"
import { hostPath, v3Href, type V3Accent, type V3EditorState, type V3Host, type V3Theme } from "./params"
import { hubScenarios, scenarioHref } from "./scenario-registry"
import type { Scenario } from "./scenarios/types"

const EDITOR_STATES: { state: V3EditorState; label: string }[] = [
  { state: "empty", label: "无选中（幻灯片属性）" },
  { state: "shape", label: "选中形状" },
  { state: "text", label: "编辑文本" },
  { state: "shapes-menu", label: "形状菜单展开" },
]

const THEMES: { theme: V3Theme; label: string }[] = [
  { theme: "dark", label: "暗色" },
  { theme: "light", label: "亮色" },
]

const ACCENTS: { accent: V3Accent; label: string }[] = [
  { accent: "blue", label: "蓝（默认）" },
  { accent: "violet", label: "紫" },
  { accent: "coral", label: "珊瑚" },
]

/**
 * URL 参数说明的断行：只在「?」「&」之前、「|」之后断，参数名和取值都不会从中间断开（「shapes-menu」的连字符也不断）。
 * 优先在参数之间断：每个参数是一个 inline-block，放不下就整段换到下一行，比一整行还宽才在内部的「|」后断；
 * 每个参数的最后两个取值连成一段，行首不会只剩一个取值（如单独一行的「coral」）。
 */
function ParamCode({ query }: { query: string }) {
  // 「?」「&」留在参数开头，「|」留在取值末尾
  const params = query.split(/(?=[?&])/)
  return (
    <code className="text-xs text-muted-foreground">
      {params.map((param, i) => {
        const vals = param.split("|").map((v, j, all) => (j < all.length - 1 ? `${v}|` : v))
        if (vals.length > 1) vals.splice(-2, 2, vals.slice(-2).join(""))
        return (
          <Fragment key={i}>
            {i > 0 && <wbr />}
            <span className="inline-block">
              {vals.map((v, j) => (
                <Fragment key={j}>
                  {j > 0 && <wbr />}
                  <span className="whitespace-nowrap">{v}</span>
                </Fragment>
              ))}
            </span>
          </Fragment>
        )
      })}
    </code>
  )
}

/** 行标签只在「（」前断：窄卡片里是「网格视图 / （全部幻灯片）」，不会把「幻灯片」拆开、第二行只剩「片）」。 */
function RowLabel({ text }: { text: string }) {
  const k = text.indexOf("（")
  if (k <= 0) return text
  return (
    <>
      <span className="whitespace-nowrap">{text.slice(0, k)}</span>
      <wbr />
      <span className="whitespace-nowrap">{text.slice(k)}</span>
    </>
  )
}

function LinkRow({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground" title={note}>
        <RowLabel text={label} />
      </span>
      <span className="flex shrink-0 items-center gap-1">{children}</span>
    </div>
  )
}

/** Hub 目录页的 v3 分组：「设计语言 v3 样张」（编辑器四个基础状态、首页、强调色对比），其下按批次（Scenario.batch，缺省 1）列出场景样张；还没有场景的批次不显示。 */
export function V3HubGroup() {
  return (
    <>
      <V3BaseGroup />
      {BATCHES.map((b) => (
        <ScenarioGroup key={b} batch={b} />
      ))}
    </>
  )
}

/** 迁移批次（rulings §4.25 DS-8） */
const BATCHES = [1, 2, 3] as const

const BATCH_TITLE: Record<1 | 2 | 3, string> = {
  1: "第 1 批 · 编辑器族",
  2: "第 2 批 · 协作族",
  3: "第 3 批 · 应用壳族",
}

/** 第 2、3 批分组的范围说明（DS-8）；第 1 批沿用原来的整段说明 */
const BATCH_SCOPE: Record<2 | 3, string> = {
  2: "评论、版本历史、分享、插件、保真报告、离线与冲突",
  // DS-71 登录与错误页、DS-72 模板库、DS-73 嵌入形态并入第 3 批
  3: "文档列表、模板库、导入导出、放映、查看器、嵌入、设置、管理、快捷键、登录与错误页",
}

/** 批次进度徽标（rulings §4.25 DS-8）：第 1 批已于 2026-10-07 拍板（DS-21），其余批次进行中 */
const BATCH_BADGE: Record<1 | 2 | 3, { label: string; className: string }> = {
  1: { label: "已拍板", className: "border-transparent bg-success-muted text-success-foreground" },
  2: { label: "进行中", className: "border-transparent bg-warning-muted text-warning-foreground" },
  3: { label: "进行中", className: "border-transparent bg-warning-muted text-warning-foreground" },
}

/**
 * 场景样张分组（rulings §4.25 DS-8 的迁移批次）：按场景元数据自动生成，src/v3/scenarios/ 下新增 *.scenario.tsx 即出现在这里。
 * 每个场景一张卡：标题、界面规格编号、说明，每个状态一行暗色 / 亮色链接（行标签悬停显示状态说明）。以「_」开头的场景（如 _kit）不展示。
 */
function ScenarioGroup({ batch }: { batch: 1 | 2 | 3 }) {
  const list = hubScenarios(batch)
  // 第 3 批（应用壳族）在还没有场景时也出现：先列出页面级宿主（各组开工后场景卡片接在后面）
  if (!list.length && batch !== 3) return null
  const id = `v3-batch-${batch}`
  return (
    <section aria-labelledby={id} className="mt-10">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 id={id} className="text-sm font-semibold">{BATCH_TITLE[batch]}</h2>
        <Badge variant="outline" className={BATCH_BADGE[batch].className}>{BATCH_BADGE[batch].label}</Badge>
      </div>
      {batch === 1 ? (
        <p className="mb-4 max-w-[70ch] text-sm text-pretty text-muted-foreground">
          按界面规格（03-screens）组织的 v3 场景样张，链接写成
          <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs whitespace-nowrap">state=场景.状态</code>
          。行为与边界情况<span className="whitespace-nowrap">以界面规格为准</span>，视觉以 v3 为准。
        </p>
      ) : (
        <p className="mb-4 max-w-[70ch] text-sm text-pretty text-muted-foreground">
          {BATCH_SCOPE[batch]}
          <span className="whitespace-nowrap">（rulings §4.25 DS-8）</span>。<span className="whitespace-nowrap">链接写法与依据同第 1 批。</span>
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {batch === 3 && <HostCard />}
        {list.map((s) => (
          <ScenarioCard key={s.id} scenario={s} />
        ))}
      </div>
    </section>
  )
}

/** 第 3 批的页面级宿主（PageHost.tsx，rulings §4.25 DS-71…DS-73）：不带 state 时首页是已拍板的首页，其余宿主打开第一个声明了它的场景状态（还没有就显示「找不到场景状态」与写法） */
const HOSTS: { host: V3Host; label: string }[] = [
  { host: "home", label: "首页（应用壳）" },
  { host: "documents", label: "文档列表（应用壳）" },
  { host: "templates", label: "模板库（应用壳）" },
  { host: "admin/plugins", label: "管理 › 插件（应用壳）" },
  { host: "page", label: "整屏页（登录、错误页）" },
  { host: "embed", label: "嵌入（宿主外框 + iframe）" },
]

function HostCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">页面级宿主</CardTitle>
        <CardDescription className="max-xl:text-balance">
          场景写 host 声明自己的宿主，链接写成
          <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs whitespace-nowrap">#/v3/宿主?state=场景.状态</code>
          ；应用壳四个宿主共用首页的左栏与顶栏，编辑器照旧是 #/v3/editor。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {HOSTS.map((h) => (
          <LinkRow key={h.host} label={h.label}>
            {THEMES.map((t) => (
              <Button key={t.theme} asChild variant="outline" size="sm">
                <Link to={`${hostPath(h.host)}?theme=${t.theme}&accent=blue`}>{t.label}</Link>
              </Button>
            ))}
          </LinkRow>
        ))}
        <ParamCode query="?state=场景.状态&theme=dark|light&accent=blue|violet|coral&frame=宽x高" />
      </CardContent>
    </Card>
  )
}

function ScenarioCard({ scenario }: { scenario: Scenario }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm">{scenario.title}</CardTitle>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{scenario.specs.join(" · ")}</span>
        </div>
        {scenario.summary && <CardDescription className="max-xl:text-balance">{scenario.summary}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {scenario.states.map((st) => (
          <LinkRow key={st.id} label={st.title} note={st.note}>
            {THEMES.map((t) => (
              <Button key={t.theme} asChild variant="outline" size="sm">
                <Link to={scenarioHref(scenario, st, { theme: t.theme })}>{t.label}</Link>
              </Button>
            ))}
          </LinkRow>
        ))}
        <code className="text-xs break-all text-muted-foreground">?state={scenario.id}.&lt;状态&gt;</code>
      </CardContent>
    </Card>
  )
}

/** 「设计语言 v3 样张」分组：去 ribbon 的 Figma 式结构，状态链接全部列在这里，样张页面自身没有演示控件。 */
function V3BaseGroup() {
  const entry = (path: string) => routes.find((r) => r.path === path)
  const editor = entry("/v3/editor")
  const home = entry("/v3/home")
  return (
    <section aria-labelledby="v3-group">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 id="v3-group" className="text-sm font-semibold">设计语言 v3 样张</h2>
        <Badge variant="outline" className="border-transparent bg-warning-muted text-warning-foreground">进行中</Badge>
      </div>
      <p className="mb-4 max-w-[70ch] text-sm text-pretty text-muted-foreground">
        去掉 ribbon 的 Figma 式结构：底部浮动工具条只管创建，右侧检查器只管当前选中对象，其余命令进菜单、右键、⌘K 与快捷键；
        中性平面，强调色只做强调。现有 ribbon 版保留用于对比。状态全部走 URL（theme、accent、state、view），样张页面上没有演示控件；
        网格视图（view=grid）两侧面板收起，只剩浮动胶囊、全部幻灯片的网格与底部工具条。
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{editor?.title ?? "编辑器样张"}</CardTitle>
            {/*
              当前页的补充说明另起一行：1280–1600 宽下正好一行；卡片更窄时只在逗号后断成两行，不会只剩「第 2 页。」这样的孤字。
              三张卡的说明在 1280px 以下用 text-balance 均分行长（中文每个字都是断点，text-pretty 管不住 1024 宽下「的属性。」这样的短末行）；
              1280px 及以上三栏卡片够宽，保持默认断行，免得均分后说明只占半张卡宽。
            */}
            <CardDescription className="max-xl:text-balance">
              {editor?.description}。
              <span className="mt-1 block">
                <span className="whitespace-nowrap">state=text 时当前页为第 1 页，</span>
                <wbr />
                <span className="whitespace-nowrap">其余为第 2 页。</span>
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {EDITOR_STATES.map((s) => (
              <LinkRow key={s.state} label={s.label}>
                {THEMES.map((t) => (
                  <Button key={t.theme} asChild variant="outline" size="sm">
                    <Link to={v3Href("/v3/editor", { state: s.state, theme: t.theme })}>{t.label}</Link>
                  </Button>
                ))}
              </LinkRow>
            ))}
            <LinkRow label="网格视图（全部幻灯片）">
              {THEMES.map((t) => (
                <Button key={t.theme} asChild variant="outline" size="sm">
                  <Link to={v3Href("/v3/editor", { view: "grid", theme: t.theme })}>{t.label}</Link>
                </Button>
              ))}
            </LinkRow>
            <ParamCode query="?state=empty|shape|text|shapes-menu&view=single|grid&theme=dark|light&accent=blue|violet|coral" />
            <span className="font-mono text-xs text-muted-foreground">{editor?.spec}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{home?.title ?? "首页样张"}</CardTitle>
            <CardDescription className="max-xl:text-balance">{home?.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <LinkRow label="首页">
              {THEMES.map((t) => (
                <Button key={t.theme} asChild variant="outline" size="sm">
                  <Link to={v3Href("/v3/home", { theme: t.theme })}>{t.label}</Link>
                </Button>
              ))}
            </LinkRow>
            <ParamCode query="?theme=dark|light&accent=blue|violet|coral" />
            <span className="font-mono text-xs text-muted-foreground">{home?.spec}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">强调色对比</CardTitle>
            {/* 「一起变」不拆开：1280–1600 宽下末行原本只剩一个「变。」 */}
            <CardDescription className="max-xl:text-balance">
              同一界面（编辑器 · 选中形状）换强调色：选中框、手柄、当前工具、主按钮、当前页描边<span className="whitespace-nowrap">一起变</span>。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {ACCENTS.map((a) => (
              <LinkRow key={a.accent} label={a.label}>
                {THEMES.map((t) => (
                  <Button key={t.theme} asChild variant="outline" size="sm">
                    <Link to={v3Href("/v3/editor", { state: "shape", theme: t.theme, accent: a.accent })}>{t.label}</Link>
                  </Button>
                ))}
              </LinkRow>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
