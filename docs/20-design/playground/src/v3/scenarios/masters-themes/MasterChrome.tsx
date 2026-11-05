import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react"
import { cn } from "@/lib/utils"
import {
  CalendarDays, ChartColumn, ChevronDown, Hash, Heading, Image as ImageIcon, LayoutPanelTop, Lock, PanelBottom, Shapes, SquareDashed, Table, Type, Video,
  type LucideIcon,
} from "lucide-react"
import {
  Banner, Button, Dialog, EmptyNote, ICON, ICON_LG, IconButton, MainMenuLayer, MASTER_VIEW_ICON, Menu, MoreTool, PanelTitle, reasonTip, SEG_ON, sectionsFor, SelectTool, Tip, Toast, Toasts,
  ToolbarDivider, ToolbarLabel, ToolbarShell, ToolButton, useEditor, useSceneState, userHasInteracted, withReason,
  type InspectorCtx, type MenuItemSpec, type MenuSpec,
} from "../../kit"
import { panelTitleFor } from "../../editor/inspector/registry"
import { phrases, TopReason, withMasterShape } from "./master-sections"
import {
  contextDetailOf, contextObjectOf, familyOf, findLayout, findMaster, KIND, kindFor, MV_KEYS, rowAnchorOf, toastTextOf, typeNameOf, useMasterView,
  type MasterView, type MvData, type MvToast, type Scope,
} from "./mv-state"
import { pagesText } from "./shared"
import { useThemeState } from "./ThemeParts"

/**
 * 母版视图的外框件（2026-10-30 母版视图改版第二步，规格 §2.2、§3.1、§3.4、§3.5、§3.9；dir §2.1、§2.4、§2.5）：
 *   MasterContextBar   上下文条（画布列最上的横幅：模式 ┊ 对象 ┊ 说明 + 唯一常驻出口「关闭母版视图」）
 *   MasterToolbar      底部工具条（「占位符 ▾」排第 2，PhTypeIcon 菜单图标；对比场景里未采纳的备选 C 的末端模式段）
 *   MasterInspectorBody 检查器「设计」页签的内容（顶行、只写类型的面板标题、分区）
 *   MasterOverlay      画布列里的母版件：轻提示、母版键位（P、T / S、⌘M、⌘D）、删除确认框
 *   DeleteLayoutDialog / DeleteLayoutsDialog / DeleteMasterDialog / ExportUnusedDialog   确认框件（文案全部由数据算）
 *   EntryMenu、MasterHintDemo（普通视图里的入口演示）、MASTER_COMMENTS_TAB
 * 一切页数、页码、名称、原因由 mv-state 的规则算出（规格 §1.3）。
 */

/* ------------------------------------------------------------------ 普通视图里的入口演示 */

/**
 * 普通视图：主菜单「视图」子菜单展开，指向「母版视图」（锚在左栏的 main-menu 上，点它真的进入母版视图；条目接的就是宿主的缺省）。
 * 一直挂着：进入后菜单已随选中收起、留在收起的样子，退出后不会再弹开
 */
export function EntryMenu() {
  return <MainMenuLayer openPath={["view"]} highlight="母版视图" />
}

/** MasterHintDemo 重新请求的间隔：短于宿主轻提示的 3.5 秒（Editor.tsx hint），提示一直在 */
const HINT_DEMO_MS = 2000

/**
 * 演示「⌥⌘M 不可用」的轻提示（规格 §2.2 末段；放在不可进入的状态的 canvasOverlay 里，如评审模式、仅查看形态）：
 * 只在宿主的 masterView.entry.ok 为假时调 masterView.enter("shortcut")——与用户按 ⌥⌘M 走同一条路，宿主按 entry 出一次「母版视图：〈原因〉」，
 * 文案、原因的先后都由宿主算（可进入的状态里挂了它也不会真进母版视图）；没有编辑器外壳的状态（entry.silent）宿主本来就不提示。
 * 用户第一次操作（kit userHasInteracted）之前每 2 秒再调一次：宿主对同一原因只重算计时、不另出一条，截图时提示一直在；
 * entry.ok 变真或用户操作过即停。不画任何东西，宿主不用改。
 * 第一次请求放到下一个任务里：外壳的形态守卫在布局阶段才登记（useMasterEntryGuard），等宿主按登记后的守卫重算过 entry 再问，原因与菜单上的同一句。
 */
export function MasterHintDemo() {
  const { masterView } = useEditor()
  const latest = useRef(masterView)
  latest.current = masterView
  const blocked = !masterView.entry.ok
  useEffect(() => {
    if (!blocked) return
    let timer = 0
    const ask = (): boolean => {
      const mv = latest.current
      if (mv.on || mv.entry.ok || userHasInteracted()) return false
      mv.enter("shortcut")
      return true
    }
    const first = window.setTimeout(() => {
      if (!ask()) return
      timer = window.setInterval(() => {
        if (!ask()) window.clearInterval(timer)
      }, HINT_DEMO_MS)
    }, 0)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [blocked])
  return null
}

/* ------------------------------------------------------------------ 「」引起来的名称 */

/**
 * 「」引起来的名称整段不断行（README §7 Q7 的约定）：做成行内块、最宽一整行——放得下就整段在一行里，比一整行还长（名称最长 64 字）才在名称里换行，
 * 任何宽度下都不伸出所在的区域（同检查器顶行 TopReason 的写法）
 */
function quoted(text: string): ReactNode {
  const parts = text.split(/(「[^」]*」)/)
  if (parts.length === 1) return text
  return parts.map((s, i) =>
    s.startsWith("「") && s.endsWith("」") ? (
      <span key={i} className="inline-block max-w-full">
        {s}
      </span>
    ) : (
      s
    ),
  )
}

/* ------------------------------------------------------------------ 上下文条（规格 §3.1） */

/**
 * 段与段之间的竖分隔：行内块 1 × 12、--v3-border，右距 8（左边的 8 由前一段的右距给，左右对称）。
 * 外层按基线对齐：分隔没有文字，基线取它的下沿，于是下沿落在文字基线上；再往下挪 1，与汉字的字面居中。隐藏参数只是不画（位置照占，换行判断不来回跳）
 */
function CtxDivider({ ref, hidden }: { ref?: Ref<HTMLSpanElement>; hidden?: boolean }) {
  return <span ref={ref} aria-hidden="true" className={cn("relative top-px mr-2 inline-block h-3 w-px shrink-0 bg-(--v3-border)", hidden && "invisible")} />
}

/**
 * 未采纳的备选 A′ 的范围分段（DS-146 定为窗格选中即编辑对象；只在对比场景里由数据 mvVariant.scope = segment 打开，dir L661–668）：DS-35 分段的画法（28 高、选中块贴边），role=radiogroup「编辑范围」。
 * kit Banner 把内容放在 <p> 里，kit Segmented 外层是 div（放进去会出 DOM 嵌套告警），这里用 span 照它的类名画一份。
 * 窗格选中母版时「版式」档留在原位不可用，原因「选中的是母版，只能编辑母版」（R-40 原句）
 */
function ScopeSegment({ mv }: { mv: MasterView }) {
  const opts: { v: Scope; label: string }[] = [
    { v: "layout", label: "版式" },
    { v: "master", label: "母版" },
  ]
  return (
    <span role="radiogroup" aria-label="编辑范围" className="mr-2 flex h-7 shrink-0 gap-(--v3-seg-gap) rounded-[4px] bg-(--v3-seg-track) p-(--v3-seg-pad) ring-1 ring-(--v3-seg-track-line) ring-inset">
      {opts.map((o) => {
        const on = mv.scope === o.v
        const why = o.v === "layout" && mv.paneIsMaster ? "选中的是母版，只能编辑母版" : undefined
        return (
          <Tip key={o.v} label={why ? reasonTip(o.label, why) : o.label}>
            <button
              type="button"
              role="radio"
              aria-checked={on}
              aria-disabled={why ? true : undefined}
              aria-label={withReason(o.label, why)}
              onClick={() => !why && mv.setScope(o.v)}
              className={cn(
                "flex h-full items-center justify-center rounded-(--v3-seg-on-radius) px-2.5 text-[12px] leading-none transition-colors",
                on ? cn(SEG_ON, why ? "text-(--v3-text-2)" : "text-(--v3-text)") : why ? "cursor-default text-(--v3-text-3)" : "text-(--v3-text-2) hover:text-(--v3-text)",
              )}
            >
              {o.label}
            </button>
          </Tip>
        )
      })}
    </span>
  )
}

/**
 * 上下文条（MasterViewImpl.Banner；dir §2.1）：kit Banner（data-v3-banner、DS-75 的 40 高与内边距、高度写进画布列的 --v3-banner-h，画布几何与紧凑抽屉都读它）。
 *   左：母版视图图标（降权时锁形）+「母版视图」（600）┊ 对象段 ┊ 说明段；右：「关闭母版视图」次按钮（常驻界面上唯一的退出入口，⌥⌘M 写在工具提示里）。
 *   对象段「版式「〈名〉」· 继承自母版「〈名〉」」/「母版「〈名〉」· N 个版式继承此母版」（contextObjectOf）；多选、加载中、失败没有对象段，连同它后面的分隔一起不画。
 *   说明段是 R-25 八条按序取第一条（contextDetailOf）。只有按钮可点，对象段是纯文字。
 *   不传 title：kit 把 title 与内容放在同一个 <p> 的行内流里，做不到「说明段换行后与对象段左缘对齐」——这里自己排：右侧容器里对象段与说明段换行，
 *   说明段作为一个整体放不下就整段换到第二行、从右侧容器的左缘开始；换行时它前面的竖分隔不画（布局阶段与 ResizeObserver 里比较两者是否同一行）。
 *   内容全部用 span（外层是 <p>）。对比场景里未采纳的两种：备选 C（mvVariant.bar = toolbar）不画横幅；A′（scope = segment）对象段前加范围分段、对象段用 R-41 原句的格式
 */
export function MasterContextBar() {
  const mv = useMasterView()
  const { masterView } = useEditor()
  const rowRef = useRef<HTMLSpanElement>(null)
  const sepRef = useRef<HTMLSpanElement>(null)
  const detailRef = useRef<HTMLSpanElement>(null)
  const [wrapped, setWrapped] = useState(false)
  const obj = contextObjectOf(mv)
  const detail = contextDetailOf(mv)
  const segment = mv.variant.scope === "segment"
  const show = masterView.on && mv.variant.bar !== "toolbar"
  // 读屏（50/16 §8 横幅行，2026-10-31 修复第 1 轮）：上下文条出现时是 kit 缺省的 status 播报区，念一次；之后对象段、说明段随窗格选中等用户自己的操作改了，
  // 就不再作为播报区（kit Banner 的 role="none"）——换选中时读屏已念过窗格行自己的名称，不再跟着整条重读。改成「不播报」的那一次与内容的改动在同一次提交里，
  // 不会先按播报区念一遍。用户还没操作过时的改动（演示态挂载时按种子对齐选中）不算：只把它当成出现时的内容。关掉母版视图再进来时重新从播报区开始
  const said = `${obj ? `${obj.kind}|${obj.name}|${obj.from}` : ""}|${detail}`
  const [first, setFirst] = useState<{ said: string; quiet: boolean } | null>(null)
  const changedByUser = !!first && !first.quiet && first.said !== said && userHasInteracted()
  if (!show) {
    if (first) setFirst(null)
  } else if (!first) setFirst({ said, quiet: false })
  else if (!first.quiet && first.said !== said) setFirst({ said, quiet: changedByUser })
  const quiet = !!first && (first.quiet || changedByUser)
  useLayoutEffect(() => {
    const row = rowRef.current
    if (!row) return
    // 说明段与竖分隔在不在同一行：两者的竖向范围有交叠就是同一行（只比 offsetTop 会被基线对齐的上下错位骗到）；
    // 竖分隔自己落到了一行的行首（对象段正好占满一行）也不画
    const check = () => {
      const s = sepRef.current?.getBoundingClientRect()
      const d = detailRef.current?.getBoundingClientRect()
      const r = row.getBoundingClientRect()
      const same = !!s && !!d && d.top < s.bottom && s.top < d.bottom
      setWrapped(!same || (!!s && s.left - r.left < 1))
    }
    check()
    // 各段的宽随字体加载、改名而变，换行与否跟着变而整行的高可能不变：每一段都观察，字体加载完再量一次
    const ro = new ResizeObserver(check)
    ro.observe(row)
    for (const c of row.children) ro.observe(c)
    let live = true
    void document.fonts?.ready.then(() => live && check())
    return () => {
      live = false
      ro.disconnect()
    }
  }, [show, obj?.kind, obj?.name, obj?.from, detail, segment])
  if (!show) return null
  const Icon = mv.readOnly ? Lock : MASTER_VIEW_ICON
  return (
    <Banner
      icon={<Icon {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />}
      role={quiet ? "none" : undefined}
      actions={
        <Tip label="关闭母版视图" kbd="⌥⌘M">
          <Button variant="secondary" onClick={() => masterView.exit("banner")}>
            关闭母版视图
          </Button>
        </Tip>
      }
    >
      <span className="flex items-baseline">
        <span className="mr-2 shrink-0 font-semibold">母版视图</span>
        <CtxDivider />
        <span ref={rowRef} className="flex min-w-0 flex-1 flex-wrap items-baseline">
          {obj && segment && <ScopeSegment mv={mv} />}
          {obj && (
            <span className="mr-2">
              {segment ? (
                <span className="font-medium text-(--v3-text)">{quoted(obj.name)}</span>
              ) : (
                <span className="font-medium text-(--v3-text)">
                  {obj.kind}
                  <span className="inline-block max-w-full">「{obj.name}」</span>
                </span>
              )}
              <span className="text-(--v3-text-2)"> · {quoted(obj.from)}</span>
            </span>
          )}
          {obj && <CtxDivider ref={sepRef} hidden={wrapped} />}
          <span ref={detailRef} className="text-(--v3-text-2)">
            {quoted(detail)}
          </span>
        </span>
      </span>
    </Banner>
  )
}

/* ------------------------------------------------------------------ 工具条（规格 §3.5） */

const TOOLS: { id: "text" | "shapes" | "image" | "table" | "chart"; label: string; kbd?: string; Icon: LucideIcon }[] = [
  { id: "text", label: "文本", kbd: "T", Icon: Type },
  { id: "shapes", label: "形状", kbd: "S", Icon: Shapes },
  { id: "image", label: "图片", Icon: ImageIcon },
  { id: "table", label: "表格", Icon: Table },
  { id: "chart", label: "图表", Icon: ChartColumn },
]

/** 「插入占位符」菜单里的类型（03-26 §4.3、DS-30） */
export type PhMenuType = "content" | "text" | "picture" | "table" | "chart" | "media" | "title" | "footer" | "date" | "number"

/** 每种类型叠在虚线框里的图形（Lucide）：与普通插入工具同一批图形，外面套一层虚线框以示「占位符」 */
const PH_GLYPH: Record<PhMenuType, LucideIcon> = {
  content: LayoutPanelTop,
  text: Type,
  picture: ImageIcon,
  table: Table,
  chart: ChartColumn,
  media: Video,
  title: Heading,
  footer: PanelBottom,
  date: CalendarDays,
  number: Hash,
}

/**
 * 插入占位符菜单的图标（规格 §3.5.2；ppt-08、ppt-20 的虚线框变体）：16px 虚线方框（圆角 2、虚线 2 / 2、描边 1.5）里叠一个 8px 的类型图形（描边 2）。
 * Lucide 没有带虚线框的表格 / 图片 / 图表图标，只能组合；颜色随菜单项（不可用时一起退到 text-3）
 */
export function PhTypeIcon({ type }: { type: PhMenuType }) {
  const Glyph = PH_GLYPH[type]
  return (
    <span aria-hidden="true" className="relative flex size-4 shrink-0 items-center justify-center">
      <svg width={16} height={16} viewBox="0 0 16 16" fill="none" className="absolute inset-0">
        <rect x={0.75} y={0.75} width={14.5} height={14.5} rx={2} stroke="currentColor" strokeWidth={1.5} strokeDasharray="2 2" />
      </svg>
      <Glyph size={8} strokeWidth={2} />
    </span>
  )
}

/**
 * 插入占位符的条目（03-26 §4.3）：内容 · 文本 · 图片 · 表格 · 图表 · 媒体（P2）┊ 标题 · 页脚 · 日期 · 页码 ┊ 底部说明。
 * 同类上限（R-48：标题 / 居中标题、日期、页脚、页码各至多 1 个）按当前对象上的占位符算（同一族已有就预先不可用、写「已包含」），不按版式种类猜
 */
function placeholderItems(mv: MasterView, onPick: () => void): MenuSpec[] {
  const has = (family: string) => mv.placeholders.some((p) => familyOf(p.type) === family)
  const item = (id: PhMenuType, label: string, extra: Partial<MenuItemSpec> = {}): MenuSpec => ({ id, label, icon: <PhTypeIcon type={id} />, onSelect: onPick, ...extra })
  const limited = (id: PhMenuType, label: string, family: string) => (has(family) ? item(id, label, { disabled: true, reason: "已包含" }) : item(id, label))
  return [
    item("content", "内容", { hint: "文字、表格、图表、图片" }),
    item("text", "文本"),
    item("picture", "图片"),
    item("table", "表格"),
    item("chart", "图表"),
    item("media", "媒体", { tag: "P2", disabled: true, reason: "后续版本提供" }),
    { type: "separator" },
    limited("title", "标题", "title"),
    limited("footer", "页脚", "footer"),
    limited("date", "日期", "date"),
    limited("number", "页码", "number"),
    { type: "separator" },
    { type: "note", text: "选好类型后在画布上拖出占位符" },
  ]
}

/**
 * 母版视图的底部工具条（dir §2.5）：[选择] [占位符 ▾] ┊ [文本] [形状] [图片] [表格] [图表] [更多 +]——「占位符」挪到「选择」之后第 2 位，
 * 后接竖分隔把「插占位符」和「插普通对象」分开。用底座工具条的公共件拼，外观与普通视图一致。
 * 不可用由规则算（mvReasonOf，规格 §3.5.3）：加载中 / 失败整条不可用（含「选择」）「母版信息加载后可用」；降权、M2 只有「选择」可用；
 * 多选时「占位符」写「多选版式时不能插入占位符」、其余创建工具写「多选版式时不能插入」。
 * 「占位符 ▾」的菜单开关记在场景仓（MV_KEYS.phMenu / phTool，进出母版视图时登记处清掉）；选了一种类型后「占位符」保持按下（插入工具），Esc 回到「选择」。
 * 对比场景里未采纳的备选 C（mvVariant.bar = toolbar，DS-145 定为上下文条）在末端加模式段「母版视图 · 完成」，与评审条「评审模式 · 返回编辑」同一写法（DS-23）
 */
export function MasterToolbar() {
  const { tool, setTool, data, masterView } = useEditor()
  const mv = useMasterView()
  const d = data as MvData
  const [phTool, setPhTool] = useSceneState(MV_KEYS.phTool, !!d.mvPhMenu)
  const [menuOpen, setMenuOpen] = useSceneState(MV_KEYS.phMenu, !!d.mvPhMenu)
  /** 这一次菜单是选了类型才关的（选了：「占位符」保持按下；没选就关了：回到「选择」） */
  const picked = useRef(false)
  const allReason = mv.reason("select")
  const createReason = mv.reason("create")
  const phReason = mv.reason("placeholder")
  const phOn = phTool && !phReason
  return (
    <>
      <ToolbarShell label="创建工具">
        <SelectTool
          on={tool === "select" && !phTool && !allReason}
          disabled={!!allReason}
          reason={allReason}
          onClick={() => {
            setPhTool(false)
            setTool("select")
          }}
        />
        <IconButton
          label="占位符"
          tip={phReason ? undefined : "插入占位符"}
          kbd="P"
          size={36}
          className="w-12 gap-0.5"
          variant={phOn ? "accent" : "ghost"}
          pressed={phTool}
          aria-haspopup="menu"
          aria-expanded={menuOpen && !phReason}
          disabled={!!phReason}
          reason={phReason}
          tipHidden={menuOpen}
          data-v3-anchor="master-view.tool-placeholder"
          onClick={() => {
            setPhTool(!menuOpen)
            setMenuOpen(!menuOpen)
          }}
        >
          <SquareDashed {...ICON_LG} />
          <ChevronDown size={12} strokeWidth={1.5} aria-hidden="true" className={cn(!phOn && !phReason && "text-(--v3-text-2)")} />
        </IconButton>
        <ToolbarDivider />
        {TOOLS.map((t) => (
          <ToolButton
            key={t.id}
            anchor={`tool-${t.id}`}
            label={t.label}
            kbd={t.kbd}
            Icon={t.Icon}
            on={tool === t.id && !phTool && !createReason}
            disabled={!!createReason}
            reason={createReason}
            onClick={() => {
              setPhTool(false)
              setTool(t.id)
            }}
          />
        ))}
        <MoreTool disabled={!!createReason} reason={createReason} />
        {mv.variant.bar === "toolbar" && (
          <>
            <ToolbarDivider />
            <ToolbarLabel icon={<MASTER_VIEW_ICON {...ICON} aria-hidden="true" />}>母版视图</ToolbarLabel>
            <Tip label="关闭母版视图" kbd="⌥⌘M">
              <Button variant="secondary" className="mr-1" onClick={() => masterView.exit("banner")}>
                完成
              </Button>
            </Tip>
          </>
        )}
      </ToolbarShell>
      <Menu
        anchor="master-view.tool-placeholder"
        open={menuOpen && !phReason}
        onOpenChange={(v) => {
          if (!v) {
            if (!picked.current) setPhTool(false)
            picked.current = false
          }
          setMenuOpen(v)
        }}
        // 点的是「占位符」按钮本身：交给按钮切换开关
        onInteractOutside={(e) => {
          if ((e.target as HTMLElement | null)?.closest('[data-v3-anchor="master-view.tool-placeholder"]')) e.preventDefault()
        }}
        side="top"
        align="center"
        sideOffset={13}
        label="插入占位符"
        className="min-w-[240px]"
        items={placeholderItems(mv, () => {
          picked.current = true
          setPhTool(true)
        })}
      />
    </>
  )
}

/* ------------------------------------------------------------------ 检查器（规格 §3.4） */

/**
 * 母版视图检查器「设计」页签的内容（底座检查器的 body 插槽）：外框（协作行、页签行、缩放）仍是底座的，「评论」页签经 commentsTab 禁用并写原因。
 *   顶行（规格 §3.4.1，最多两行，先权限后对象）：降权 → 锁形「只读 · 需要编辑权限」；对象行按序取第一条——选中继承项 →「〈类型〉继承自母版「〈名〉」」+「在母版中编辑 ›」
 *   （对比场景里未采纳的 A′：「切换到母版 ›」）；M2 →「版式编辑将在后续版本提供」。组合：降权 + 继承两行；M2 + 继承只有继承那一行；降权 + M2 只有权限行。
 *   面板标题只写类型（§3.4.2）：「版式」「母版」「〈占位符名〉」「N 个版式」，普通形状用底座登记的标题。
 *   分区仍走 ui.inspectorSection 注册表（master-sections.tsx），按选中种类取。对比场景里未采纳的备选 C 把说明行写在面板标题下（§3.4.12）。
 *   选中母版上的普通形状（mvShapes）时用底座「矩形」的分区，带示例要点卡演示值的几节换成按这个形状的输入算的（withMasterShape，2026-10-31 core 修复 states-C1）。
 *   加载中 / 失败只有一行（§3.4.9，原样）
 */
export function MasterInspectorBody() {
  const editor = useEditor()
  const mv = useMasterView()
  const kind = editor.selection
  if (mv.status === "loading") return <EmptyNote>正在加载母版信息…</EmptyNote>
  if (mv.status === "failed") return <EmptyNote>母版信息未能加载，属性暂不可用</EmptyNote>
  const ctx: InspectorCtx = { selection: kind, slide: editor.current, readOnly: mv.readOnly, data: editor.data }
  const defs = mv.selectedShape ? withMasterShape(sectionsFor(kind)) : sectionsFor(kind)
  const top = defs.filter((d) => d.placement === "top")
  const body = defs.filter((d) => d.placement !== "top")
  const p = mv.selectedPh
  const inherited = !!p?.inherited && mv.scope === "layout" && (kind === KIND.inherited || kind === KIND.placeholder)
  let title: ReactNode
  if (kind === KIND.multi) title = `${mv.multiLayouts.length} 个版式`
  else if (kind === KIND.placeholder || kind === KIND.inherited) title = p?.label ?? "占位符"
  else if (kind === KIND.master) title = "母版"
  else if (kind === KIND.layout) title = "版式"
  else title = panelTitleFor(kind, ctx) ?? kind
  return (
    // 换了对象（窗格选中、范围、选中的占位符或形状）时分区重新挂载，字段的初值跟着当前对象走
    <Fragment key={`${kind}:${mv.pane}:${mv.scope}:${p?.id ?? ""}:${mv.selectedShape?.id ?? ""}`}>
      {mv.readOnly && <TopReason icon={<Lock {...ICON} aria-hidden="true" />} text="只读 · 需要编辑权限" />}
      {inherited && p ? (
        <TopReason
          text={`${typeNameOf(p)}继承自母版「${mv.master.name}」`}
          action={{ label: mv.variant.scope === "segment" ? "切换到母版" : "在母版中编辑", onClick: mv.editInMaster, anchor: "master-view.edit-in-master" }}
        />
      ) : mv.m2 && !mv.readOnly ? (
        <TopReason text="版式编辑将在后续版本提供" />
      ) : null}
      {top.map((d) => (
        <d.component key={d.id} {...ctx} />
      ))}
      <PanelTitle>{title}</PanelTitle>
      {mv.variant.bar === "toolbar" && <p className="px-4 pt-2 text-[12px] leading-[18px] text-(--v3-text-2)">{contextDetailOf(mv)}</p>}
      {body.map((d) => (
        <d.component key={d.id} {...ctx} />
      ))}
    </Fragment>
  )
}

/** 「评论」页签在母版视图里不可用的原因 */
export const MASTER_COMMENTS_TAB = { reason: "母版与版式不支持评论" }

/* ------------------------------------------------------------------ 确认框（规格 §2.2、§3.2.4；03-26 §8） */

/**
 * 确认框的开合：演示种子（状态 layers 里直接放的对话框件）一出现就开着，关掉之后进出母版视图都不再自己弹出（场景仓 MV_KEYS.seedDialogOff）；
 * 交互打开的（删除时由 MasterOverlay 按 mv.confirm 挂上）受控，关掉即清 mv.confirm
 */
function useDialogOpen(runtime: boolean, mv: MasterView): { open: boolean; onOpenChange: (v: boolean) => void } {
  const [off, setOff] = useSceneState<boolean>(MV_KEYS.seedDialogOff, false)
  if (runtime) return { open: true, onOpenChange: (v) => !v && mv.cancelConfirm() }
  return { open: !off, onOpenChange: (v) => !v && setOff(true) }
}

/**
 * 删除被引用的版式（R-63；03-26 §8 文案）：「删除版式「X」？」+「该版式仍被 N 个页面使用（第 x 页），删除后这些页面将改用默认版式，占位符里的内容会保留。删除后可以撤销。」[取消][删除]。
 * 页数、页码、名称都由文档算。键盘打开时焦点在「取消」；关闭后焦点回到该版式的行。runtime：由 MasterOverlay 按 mv.confirm 挂上（「删除」= confirmDelete）
 */
export function DeleteLayoutDialog({ layout, runtime = false }: { layout: string; runtime?: boolean }) {
  const mv = useMasterView()
  const { masterView } = useEditor()
  const st = useDialogOpen(runtime, mv)
  const l = mv.layoutOf(layout)
  if (!masterView.on || !l) return null
  const name = mv.nameOf(l.id)
  const pages = mv.usageFor(l.id)
  return (
    <Dialog
      variant="confirm"
      title={`删除版式「${name}」？`}
      description={phrases([...(pages.length ? [`该版式仍被 ${pages.length} 个页面使用（${pagesText(pages)}），`, "删除后这些页面将改用默认版式，", "占位符里的内容会保留。"] : []), "删除后可以撤销。"])}
      secondary={{ label: "取消" }}
      primary={{ label: "删除", danger: true, onClick: () => (runtime ? mv.confirmDelete() : mv.removeLayouts([l.id])) }}
      initialFocus="secondary"
      returnFocus={rowAnchorOf(l.id, false)}
      open={st.open}
      onOpenChange={st.onOpenChange}
    />
  )
}

/**
 * 多选批量删除（R-64、rulings §4.10 Q16）：读当前多选——「删除 N 个版式？」+「其中 K 个版式仍被 M 个页面使用（第 x 页）…删除后可以撤销。」，
 * 一次确认、同一事务（「删除」删掉全部所选）。K、M 与页码都由文档算；关闭后焦点回到窗格选中的那一行
 */
export function DeleteLayoutsDialog({ runtime = false }: { runtime?: boolean }) {
  const mv = useMasterView()
  const { masterView } = useEditor()
  const st = useDialogOpen(runtime, mv)
  const ids = mv.multiLayouts.map((l) => l.id)
  if (!masterView.on || ids.length < 2) return null
  const used = ids.filter((id) => mv.usageFor(id).length)
  const pages = [...new Set(used.flatMap((id) => mv.usageFor(id)))].sort((a, b) => a - b)
  const who = used.length === ids.length ? `这 ${ids.length} 个版式` : `其中 ${used.length} 个版式`
  return (
    <Dialog
      variant="confirm"
      title={`删除 ${ids.length} 个版式？`}
      description={phrases([...(used.length ? [`${who}仍被 ${pages.length} 个页面使用（${pagesText(pages)}），`, "删除后这些页面将改用默认版式，", "占位符里的内容会保留。"] : []), "删除后可以撤销。"])}
      secondary={{ label: "取消" }}
      primary={{ label: "删除", danger: true, onClick: () => (runtime ? mv.confirmDelete() : mv.removeLayouts(ids)) }}
      initialFocus="secondary"
      returnFocus={rowAnchorOf(mv.pane, mv.isMaster(mv.pane))}
      open={st.open}
      onOpenChange={st.onOpenChange}
    />
  )
}

/**
 * 删除被引用的母版（R-65；rulings §4.20 FE-23）：「删除母版「X」？」+「N 个页面将改用剩余母版「Y」中对应的版式，母版下的 K 个版式会一起删除。删除后可以撤销。」——
 * 目标母版取按顺序的首个剩余母版、不加选择器；N、Y、K 都由数据算。只剩一个母版时不出（右键里「删除母版」本来就不可用）
 */
export function DeleteMasterDialog({ master, runtime = false }: { master: string; runtime?: boolean }) {
  const mv = useMasterView()
  const { masterView } = useEditor()
  const st = useDialogOpen(runtime, mv)
  const m = findMaster(master, mv.masters)
  const rest = mv.masters.find((x) => x.id !== master)
  if (!masterView.on || !m || !rest) return null
  const pages = mv.usageFor(m.id)
  return (
    <Dialog
      variant="confirm"
      title={`删除母版「${m.name}」？`}
      description={phrases([...(pages.length ? [`${pages.length} 个页面将改用剩余母版`, `「${rest.name}」`, "中对应的版式，"] : []), `母版下的 ${m.layouts.length} 个版式会一起删除。`, "删除后可以撤销。"])}
      secondary={{ label: "取消" }}
      primary={{ label: "删除", danger: true, onClick: runtime ? mv.confirmDelete : undefined }}
      initialFocus="secondary"
      returnFocus={rowAnchorOf(m.id, true)}
      open={st.open}
      onOpenChange={st.onOpenChange}
    />
  )
}

/**
 * 导出前提示未使用的母版（R-67；PRD ML-03、03-26 §8）：「保留母版」关闭且没有页面使用的母版——「未使用的母版「X」将被移除」[保留][移除]。
 * 用在普通视图（导出在普通视图里发起）：取当前数据集里 preserveOf 为假、用量为 0 的母版，一个都没有就不出。「保留」= 把它的「保留母版」打开
 */
export function ExportUnusedDialog() {
  const mv = useMasterView()
  const [open, setOpen] = useState(true)
  const unused = mv.masters.filter((m) => !mv.preserveOf(m.id) && mv.usageFor(m.id).length === 0)
  if (!unused.length) return null
  return (
    <Dialog
      variant="confirm"
      title={`未使用的母版${unused.map((m) => `「${m.name}」`).join("")}将被移除`}
      secondary={{ label: "保留", onClick: () => unused.forEach((m) => mv.setPreserve(m.id, true)) }}
      primary={{ label: "移除" }}
      initialFocus="secondary"
      returnFocus="main-menu"
      open={open}
      onOpenChange={setOpen}
    />
  )
}

/* ------------------------------------------------------------------ 画布列里的母版件：轻提示、母版键位与删除确认（MasterViewImpl.Overlay；规格 §3.9、§4.4） */

/** 焦点在这些地方时母版的单键不响应（同宿主的工具单键：输入、菜单、对话框、列表框、弹层里不触发） */
const KEY_BLOCKERS = '[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"], [data-radix-popper-content-wrapper]'

/**
 * 母版视图画布列里的母版件（宿主画在画布列 main 里，只在母版视图里挂着）：
 *   轻提示——演示种子（data.mvToast，一出现就在）与交互触发的（删除、提交、超限…，运行时键，到时自己收起）走同一套文案（mv-state toastTextOf）；
 *     母版视图里应用主题的「已应用主题「X」，影响 N 页」也在这里（页数取当前母版的用量）。一律用 kit Toasts 的缺省落点（不传 bottom）：
 *     ⌥⌘M 不可用的提示显示期间宿主写 --v3-toast-push，缺省落点的这一叠随之上移、两条叠放（第一步补完 R1-N4）。
 *   删除确认——Delete、右键「删除」时被引用的走确认框（mv.confirm；「删除」= confirmDelete），焦点在「取消」。
 *   母版键位（document 捕获阶段，早于宿主在冒泡阶段的工具单键，规格 §3.9）——
 *     P：打开「占位符」菜单（焦点在画布列或页面本身、不在输入 / 菜单 / 对话框 / 列表框里、无修饰键；不可用时不响应）；
 *     T / S：创建工具不可用时 preventDefault，宿主的单键见到 defaultPrevented 就不切换工具（Editor.tsx 的工具单键）；
 *     ⌘M（不带 Alt、Shift：⌥⌘M 归宿主）：插入版式，不在输入框里时生效；⌘D：焦点在窗格（不在改名输入框里）时复制所选版式，并挡住浏览器的书签。
 *   删除演示态（data.mvSelBefore）：挂上时按算出的选中项对齐一次编辑器的选中种类（只做一次，规格 §4.2 末）。
 */
export function MasterOverlay() {
  const ed = useEditor()
  const mv = useMasterView()
  const theme = useThemeState()
  const d = ed.data as MvData
  const [seedOff] = useSceneState<boolean>(MV_KEYS.seedToastOff, false)
  const [aligned, setAligned] = useSceneState<boolean>("masters.mv.aligned", false)
  const latest = useRef({ ed, mv })
  latest.current = { ed, mv }

  useLayoutEffect(() => {
    if (!d.mvSelBefore || aligned) return
    setAligned(true)
    ed.setSelection(kindFor(mv.scope, undefined, mv.multiLayouts.length))
    // 只在挂上时对齐一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return
      const { ed: cur, mv: v } = latest.current
      if (!cur.masterView.on) return
      const a = document.activeElement instanceof HTMLElement ? document.activeElement : null
      const typing = !!a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))
      const mod = e.metaKey || e.ctrlKey
      if (mod && !e.altKey && !e.shiftKey && e.code === "KeyM") {
        if (typing) return
        e.preventDefault()
        if (!e.repeat) v.insertLayout()
        return
      }
      if (mod && !e.altKey && !e.shiftKey && e.code === "KeyD") {
        if (typing || !a?.closest('[role="listbox"][aria-label="母版与版式"]')) return
        e.preventDefault()
        if (!e.repeat) v.duplicateLayout()
        return
      }
      if (mod || e.altKey || e.shiftKey) return
      const k = e.key.toLowerCase()
      if (k !== "p" && k !== "t" && k !== "s") return
      const onCanvas = !a || a === document.body || !!a.closest('[data-v3-anchor="canvas"]')
      if (!onCanvas || typing || a?.closest(KEY_BLOCKERS)) return
      if (k === "p") {
        if (v.reason("placeholder")) return
        e.preventDefault()
        cur.scene.set(MV_KEYS.phTool, true)
        cur.scene.set(MV_KEYS.phMenu, true)
        return
      }
      // T / S：创建工具可用时交给宿主照常切换
      if (v.reason("create")) e.preventDefault()
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [])

  // 交互触发的轻提示到时自己收起（演示种子一出现就在，不收）
  const runtime = mv.toast
  useEffect(() => {
    if (!runtime) return
    const id = window.setTimeout(() => latest.current.mv.dismissToast(), toastTextOf(runtime.seed, latest.current.mv.toastCtx).ms)
    return () => window.clearTimeout(id)
  }, [runtime?.n])
  // 母版视图里应用主题后的提示同样到时收起
  useEffect(() => {
    if (!theme.toast) return
    const id = window.setTimeout(() => theme.setToast(null), 5000)
    return () => window.clearTimeout(id)
  }, [theme.toast])

  const seed: MvToast | undefined = !runtime && !seedOff ? d.mvToast : undefined
  const shown = runtime?.seed ?? seed
  const t = shown ? toastTextOf(shown, mv.toastCtx, theme.toast ?? undefined) : null
  const themeLine = theme.toast ? toastTextOf({ kind: "theme-applied", theme: theme.toast }, mv.toastCtx) : null
  const c = mv.confirm
  return (
    <>
      {c?.kind === "layout" && c.ids[0] && findLayout(c.ids[0], mv.masters) && <DeleteLayoutDialog key={`confirm-${c.ids[0]}`} layout={c.ids[0]} runtime />}
      {c?.kind === "layouts" && <DeleteLayoutsDialog key="confirm-layouts" runtime />}
      {c?.kind === "master" && c.ids[0] && <DeleteMasterDialog key={`confirm-${c.ids[0]}`} master={c.ids[0]} runtime />}
      {(t || themeLine) && (
        <Toasts>
          {themeLine && (
            <Toast key={`theme-${theme.toast}`} action="撤销" onAction={() => (theme.setCurrent(theme.prev), theme.setVariant(0), theme.setToast(null))}>
              {quoted(themeLine.text)}
            </Toast>
          )}
          {t && (
            <Toast key={runtime ? `mv-${runtime.n}` : "mv-seed"} action={t.undo ? "撤销" : undefined} onAction={() => (runtime ? mv.undoToast() : mv.undoSeed())}>
              {quoted(t.text)}
            </Toast>
          )}
        </Toasts>
      )}
    </>
  )
}
