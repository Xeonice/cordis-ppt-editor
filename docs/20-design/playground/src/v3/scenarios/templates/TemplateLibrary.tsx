import { useRef, type ReactNode } from "react"
import { CircleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { boxStyle, Button, Dialog, goToState, ICON, layoutName, LoadingRow, placeholdersFor, roving, Segmented, Tip, usePage, useRovingGrid, useSceneState, type PhDef } from "../../kit"
import type { LayoutKind } from "../../editor/layouts/data"
import { BUILTIN_TEMPLATES, ORG_SOURCE, ORG_TEMPLATES, templateOf, type MasterLayer, type SourceId, type TemplateDef } from "./data"

/**
 * 模板库页 /templates（rulings §4.25 DS-72 最小样张、DS-93 M3 只做来源分段与预览；PRD AS-03 M3、G-76）：壳内页面，入口只有开始页「更多模板 →」，左栏「首页」保持当前项（模板库是首页的下一层，读屏为 aria-current="true"、不是「当前页面」），
 * 顶栏标题「模板」、不放「导入 / 新建」（rulings §4.25 TB-110：模板库只做从模板新建，新建空白与导入在开始页）。
 * - 来源分段「全部 · 内置 · 〈集成方来源名〉」只在集成方配置了模板源时出现（kit Segmented，单选）；「全部」按来源分组（组标题 13px 600，不写数量——DS-80：列表头一律不写数量），选了某个来源只列它；
 * - 模板网格同首页「从模板开始」的模板卡（16:9 真实封面、圆角 6 + 1px 边、悬停描边变强调色，名称 12px text-2），五列；网格键盘按 TB-107（一组一个 Tab 停靠点，方向键漫游，Enter 打开预览）；
 * - 点模板打开预览对话框（lg 640）：首页大图 · 主题色条 · 标题 / 正文字体 · 版式（数量 + 按这套模板自己的母版画的版式缩略），主按钮「使用此模板」；
 * - 模板源加载中：那一组一行加载行（DS-86）；加载失败：那一组内联报错 +「重试」，内置照常（G-76）；
 * - 分类与搜索（AS-03 原文）不做（DS-93），内容来源与审核（PD-23）不在本批定。
 */

export interface TemplatesData {
  /** 集成方配置了模板源（缺省 true）：false 时没有来源分段、只列内置 */
  sources?: boolean
  /** 集成方模板源的加载：ready（缺省）· loading · error */
  orgPhase?: "ready" | "loading" | "error"
  /** 初始分段 */
  filter?: "all" | SourceId
  /** 预览对话框一出现就开着（模板 id） */
  preview?: string
  /** 正在用这套模板新建 */
  creating?: boolean
  /** 离线：「使用此模板」不可用（G-76） */
  offline?: boolean
}

export const tplData = (d: TemplatesData) => d as unknown as Record<string, unknown>

const CREATING = "正在创建演示文稿"
const OFFLINE = "离线时不可用"

type Filter = "all" | SourceId

/** 模板卡（首页「从模板开始」同一画法）：整卡一个按钮，读屏名「预览模板「商务」」；在漫游网格里（TB-107）；不可用时（正在用别的模板新建）变淡、写原因 */
function TemplateCard({ t, onOpen, reason }: { t: TemplateDef; onOpen: () => void; reason?: string }) {
  const off = !!reason
  const label = `预览模板「${t.name}」`
  const btn = (
    <button
      type="button"
      {...roving}
      aria-label={off ? `${label}（${reason}）` : label}
      aria-haspopup="dialog"
      aria-disabled={off || undefined}
      data-v3-anchor={`templates.card-${t.id}`}
      onClick={() => {
        if (!off) onOpen()
      }}
      className={cn("group block w-full p-2 text-left", off && "cursor-default")}
    >
      <span className={cn("block overflow-hidden rounded-[6px] border border-(--v3-border) transition-colors", !off && "group-hover:border-(--v3-accent)", off && "opacity-50")}>{t.cover}</span>
      <span className={cn("mt-2 block text-[12px] leading-4 transition-colors", off ? "text-(--v3-text-3)" : "text-(--v3-text-2) group-hover:text-(--v3-text)")}>{t.name}</span>
    </button>
  )
  return <li>{off ? <Tip label={reason!}>{btn}</Tip> : btn}</li>
}

function Group({ id, title, children }: { id: string; title?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={title ? id : undefined} aria-label={title ? undefined : "模板"} className="mt-6 first:mt-0">
      {title && (
        <div className="flex h-7 items-center">
          <h2 id={id} className="text-[13px] leading-5 font-semibold">
            {title}
          </h2>
        </div>
      )}
      {children}
    </section>
  )
}

/** 一组模板的网格：一个 Tab 停靠点，方向键 / Home / End 漫游、Enter 打开预览（TB-107，kit useRovingGrid） */
function Grid({ items, onOpen, reason }: { items: TemplateDef[]; onOpen: (t: TemplateDef) => void; reason?: string }) {
  const ref = useRef<HTMLUListElement>(null)
  useRovingGrid(ref)
  return (
    <ul ref={ref} className="mt-2 -mx-2 grid grid-cols-5">
      {items.map((t) => (
        <TemplateCard key={t.id} t={t} onOpen={() => onOpen(t)} reason={reason} />
      ))}
    </ul>
  )
}

/** 集成方来源那一组的内联状态（加载中一行加载行；失败一行危险色图标 + 说明 +「重试」，同第 2 批分享对话框的出错行） */
function OrgState({ phase, onRetry }: { phase: "loading" | "error"; onRetry: () => void }) {
  if (phase === "loading")
    return (
      <LoadingRow className="mt-2 -mx-2 rounded-[4px]" label={`正在加载「${ORG_SOURCE.name}」`}>
        {`正在加载「${ORG_SOURCE.name}」…`}
      </LoadingRow>
    )
  return (
    <div role="alert" className="mt-2 flex h-8 items-center gap-2">
      <CircleAlert {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-danger)" />
      <p className="text-[12px] leading-4 text-(--v3-text)">模板源加载失败，内置模板不受影响</p>
      {/* 画布底上的次按钮 outline（TB-128） */}
      <Button variant="outline" onClick={onRetry} className="ml-2">
        重试
      </Button>
    </div>
  )
}

export function TemplatesBody() {
  const { data } = usePage()
  const d = data as unknown as TemplatesData
  const sources = d.sources !== false
  const [filter, setFilter] = useSceneState<Filter>("tpl.filter", () => d.filter ?? "all")
  const [orgPhase, setOrgPhase] = useSceneState<"ready" | "loading" | "error">("tpl.org", () => d.orgPhase ?? "ready")
  const [, setPreview] = useSceneState<string | null>("tpl.preview", () => d.preview ?? null)
  const [creating] = useSceneState("tpl.creating", () => !!d.creating)
  const reason = creating ? CREATING : undefined
  const open = (t: TemplateDef) => setPreview(t.id)
  const retry = () => {
    setOrgPhase("loading")
    window.setTimeout(() => setOrgPhase("ready"), 1200)
  }
  const options = [
    { value: "all" as const, label: "全部", text: "全部" },
    { value: "builtin" as const, label: "内置", text: "内置" },
    { value: "org" as const, label: ORG_SOURCE.name, text: ORG_SOURCE.name },
  ]
  if (!sources) {
    return (
      <Group id="tpl-builtin">
        <Grid items={BUILTIN_TEMPLATES} onOpen={open} reason={reason} />
      </Group>
    )
  }
  const showBuiltin = filter !== "org"
  const showOrg = filter !== "builtin"
  const grouped = filter === "all"
  return (
    <>
      <Segmented<Filter> options={options} value={filter} onValueChange={setFilter} aria="模板来源" role="radiogroup" className="w-[280px]" />
      <div className="mt-4">
        {showBuiltin && (
          <Group id="tpl-builtin" title={grouped ? "内置" : undefined}>
            <Grid items={BUILTIN_TEMPLATES} onOpen={open} reason={reason} />
          </Group>
        )}
        {showOrg && (
          <Group id="tpl-org" title={grouped ? ORG_SOURCE.name : undefined}>
            {orgPhase === "ready" ? <Grid items={ORG_TEMPLATES} onOpen={open} reason={reason} /> : <OrgState phase={orgPhase} onRetry={retry} />}
          </Group>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ 版式缩略：按模板自己的母版画 */

/** 新建页上的空占位符（同 kit LayoutArt 的 prompts="slide"：虚线框 + 灰色提示文字，字号与母版样式一致）；在深色区域上换成浅色 */
function Prompt({ def, inverse, center }: { def: PhDef; inverse?: boolean; center?: boolean }) {
  const c = center && "text-center"
  let body: ReactNode
  switch (def.type) {
    case "cover-title":
      body = <p className={cn("w-full px-[0.75cqw] text-[5.6cqw] leading-[1.2] font-bold whitespace-nowrap", c)}>单击此处添加标题</p>
      break
    case "title":
      body = <p className="w-full px-[0.75cqw] text-[4.6cqw] leading-[1.2] font-bold whitespace-nowrap">单击此处添加标题</p>
      break
    case "section-title":
      body = <p className={cn("w-full px-[0.75cqw] text-[5.2cqw] leading-[1.2] font-bold whitespace-nowrap", c)}>单击此处添加标题</p>
      break
    case "subtitle":
      body = <p className={cn("w-full px-[0.75cqw] text-[2.6cqw] leading-[1.3] whitespace-nowrap", c)}>单击此处添加副标题</p>
      break
    case "header":
    case "section-text":
      body = <p className={cn("w-full px-[0.75cqw] text-[2.4cqw] leading-[1.3] whitespace-nowrap", c)}>单击此处添加文本</p>
      break
    case "body":
      body = (
        <div className="flex w-full flex-col gap-[1.2cqw] self-start px-[1.4cqw] pt-[1.4cqw] text-[2.6cqw] leading-[1.3] whitespace-nowrap">
          <p>• 单击此处添加文本</p>
          <p className="pl-[2.6cqw] text-[2.2cqw]">– 第二级</p>
        </div>
      )
      break
    default:
      return null
  }
  return (
    <div
      className={cn("absolute flex items-center overflow-hidden border-[0.16cqw] border-dashed", inverse ? "border-white/55 text-white/75" : "border-(--s-mute)/70 text-(--s-mute)")}
      style={boxStyle(def.box)}
    >
      {body}
    </div>
  )
}

/**
 * 一个版式的缩略（HAT-01）：底色、母版图形与占位符位置都按这套模板自己的母版（data.tsx master）——
 * 标题幻灯片就是封面的样子（同一条标题带 / 同一块底色 / 同样的图形，占位符落在封面标题与副标题处，深色区域上的提示文字换成浅色），章节标题是同一套图形的变体，
 * 其余版式用 Office 版式的占位符位置 + 这套模板的轻量图形。颜色取模板的主题配色（内置主题类 / 集成方的实时配色类），与封面同一份。
 * 版式名在缩略下面另写一行，缩略本身对读屏隐藏（不重复念）。
 */
function TemplateLayout({ t, kind }: { t: TemplateDef; kind: LayoutKind }) {
  const layer: MasterLayer = kind === "title" ? t.master.title : kind === "section" ? t.master.section : t.master.content
  let defs = placeholdersFor("office", kind).filter((p) => p.type !== "footer" && p.type !== "date" && p.type !== "number")
  if ((kind === "title" || kind === "section") && layer.title) {
    defs = defs.map((p) =>
      p.id === "title" ? { ...p, box: layer.title! } : (p.id === "subtitle" || p.id === "text") && layer.sub ? { ...p, box: layer.sub } : p,
    )
  }
  return (
    <div className={cn("contents", t.previewClass)} style={t.previewStyle}>
      <div aria-hidden="true" className={cn("v3-slide @container relative aspect-video w-full overflow-hidden", layer.bg ?? "bg-white")}>
        {layer.art}
        {defs.map((p) => (
          <Prompt key={p.id} def={p} inverse={layer.inverse} center={layer.center} />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 预览对话框 */

/** 主题色条：强调色 1–6 的色块（读屏念「6 种主题色」，不念一串十六进制，HAT-12） */
function Swatches({ colors }: { colors: string[] }) {
  return (
    <span className="flex items-center gap-1" aria-label={`${colors.length} 种主题色`} role="img">
      {colors.map((c, i) => (
        <span key={i} className="size-4 rounded-[4px] ring-1 ring-(--v3-border) ring-inset" style={{ backgroundColor: c }} />
      ))}
    </span>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[12px] leading-4 text-(--v3-text-2)">{label}</span>
      <div className="flex min-h-4 items-center text-[12px] leading-4 text-(--v3-text)">{children}</div>
    </div>
  )
}

/**
 * 预览对话框（kit Dialog lg 640，顶部锚定：版式数不同、高度会变，标题不跟着上下动）：
 * 标题是模板名，说明行写来源；正文——首页大图（16:9，圆角 6 + 1px 边）· 两列要点（主题色条：强调色 1–6；字体：标题 / 正文）·
 * 「版式 N」一节：按这套模板自己的母版画的版式缩略（TemplateLayout），四列，名称 12px text-2。
 * 底栏：「关闭」·「使用此模板」（主按钮）；正在创建时主按钮换成 kit 主按钮的不可用态 + 转圈「正在创建…」（kit Dialog 的 busy：aria-busy、不可再点；rulings §4.25 DS-123），
 * 作业成功后进编辑器（首页为标题版式，D14）；关闭对话框不取消作业（同开始页模板卡）。离线时「使用此模板」不可用，写「离线时不可用」。
 */
export function PreviewDialog() {
  const { data } = usePage()
  const d = data as unknown as TemplatesData
  const [preview, setPreview] = useSceneState<string | null>("tpl.preview", () => d.preview ?? null)
  const [creating, setCreating] = useSceneState("tpl.creating", () => !!d.creating)
  if (!preview) return null
  const t = templateOf(preview)
  const source = t.source === "builtin" ? "内置模板" : `${ORG_SOURCE.name} · 由集成方提供`
  const use = () => {
    setCreating(true)
    window.setTimeout(() => goToState("editor", "empty"), 1600)
  }
  return (
    <Dialog
      title={t.name}
      description={source}
      size="lg"
      anchor="top"
      open
      onOpenChange={(v) => {
        if (!v) setPreview(null)
      }}
      returnFocus={`templates.card-${t.id}`}
      bodyClassName="p-4"
      // 「使用此模板」之后对话框留着（转圈「正在创建…」），只有「关闭」关它：不按主 / 次按钮自动关闭
      closeOnAction={false}
      secondary={{ label: "关闭", onClick: () => setPreview(null) }}
      primary={creating ? { label: "正在创建…", busy: true } : { label: "使用此模板", disabled: !!d.offline, reason: d.offline ? OFFLINE : undefined, onClick: use }}
    >
      <div className="overflow-hidden rounded-[6px] border border-(--v3-border)">{t.cover}</div>
      <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-8">
        <Fact label="主题色">
          <Swatches colors={t.colors} />
        </Fact>
        <Fact label="字体">
          <span className="truncate">{t.heading === t.body ? `标题与正文 ${t.heading}` : `标题 ${t.heading} · 正文 ${t.body}`}</span>
        </Fact>
      </div>
      <h3 className="mt-5 flex items-center gap-1.5 text-[12px] leading-4 font-semibold">
        版式
        <span className="font-normal text-(--v3-text-2) tabular-nums">{t.layouts.length}</span>
      </h3>
      <ul className="mt-2 grid grid-cols-4 gap-x-3 gap-y-3">
        {t.layouts.map((k) => (
          <li key={k} className="flex min-w-0 flex-col gap-1.5">
            <span className="block overflow-hidden rounded-[4px] border border-(--v3-border)">
              <TemplateLayout t={t} kind={k} />
            </span>
            <span className="truncate text-[12px] leading-4 text-(--v3-text-2)">{layoutName(k)}</span>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
