import { useRef, type KeyboardEvent, type ReactNode } from "react"
import { Info, LayoutTemplate, RotateCcw, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { EmptyNote, Tag, TextField } from "../../kit/controls"
import { Dialog } from "../../kit/Dialog"
import { useDemoOpen, useLayerClose } from "../../kit/layer"
import { Popover, PopoverTitle } from "../../kit/Popover"
import { useSceneState } from "../../kit/scene"
import { Toast, Toasts } from "../../kit/Toast"
import { Button, ICON, IconButton, reasonTip, Section, SelectTrigger, Tip, withReason } from "../../ui"
import { useEditor, useEditorMaybe } from "../context"
import type { DeckSlide } from "../deck"
import { StaticRow } from "../inspector/parts"
import type { InspectorCtx } from "../inspector/registry"
import { MASTER_VIEW_ICON, useDismissOnMasterToggle } from "../master/mode"
import { ALL_LAYOUTS, layoutOf, MASTERS, mastersOfSet, type LayoutDef, type MasterDef, type MasterSetKey } from "./data"
import { LayoutArt } from "./LayoutArt"

/**
 * 版式画廊（底座唯一的一份，03-14 D14 + 03-27）：「新建幻灯片 ▾」（左栏 / 网格胶囊）与检查器「版式」字段打开的是同一个组件，
 * 只有标题、默认高亮项、主按钮与选择后的动作不同（03-14「共用同一个版式库 flyout」）。
 * - 按母版分组：当前页所用母版置顶并标注，其余按文档顺序；导入的母版标「导入」；组标题下写明「会同时切换母版」。单母版文档退化为扁平网格（不显示组标题）。
 * - 「与当前页相同」只在当前母版组、默认高亮；新建时当前页是标题幻灯片，第一张换成「建议：标题和内容」（首页之后很少再要一张标题页）。
 * - 搜索按名称过滤全部分组，0 命中的组连标题隐藏；Esc 先清空搜索再关闭（Popover 的 onEscapeKeyDown）。
 * - 卡片是版式的真实渲染，与母版视图窗格同一种缩略画法（LayoutArt 的 thumb：同一份内容 + 一种细线框，放不下的段整段不画；rulings §4.25 DS-149），
 *   选中项强调色边 + 0.5px 外圈，「当前」标记当前版式。检查器「版式」字段的 32 × 18 缩略与重置确认里的预览同一画法。
 * - 键盘：方向键按卡片的实际位置移动（跨组也行），选中跟随焦点；Enter 执行主按钮（新建 / 应用版式），双击同。
 * - 更换版式：左下「重置为版式默认…」降权为次要操作 → 二次确认（D9 显式例外，Q16）→ 可撤销轻提示；应用后有元素不匹配时轻提示（Q13）。
 * 跨区域的状态放 useSceneState（键 layouts.*）：画廊开关、搜索词、选中卡、确认框、轻提示、本页已应用的版式。
 * 状态初值从 EditorConfig.data 读（LayoutPickerData：lpOpen、lpQuery、lpSelected、lpSingle、lpDeleted、lpReset、lpToast、lpApplied、lpUnmatched）。
 * 文档有哪些母版与版式读状态的 data.mvMasters（data.ts mastersOfSet；与母版视图的窗格同一份，不写时是示例文档的 MASTERS）：
 * 本页用哪个版式、画廊列哪些分组都按它，场景自带母版时（text-edit）进入母版视图前后对得上。
 */

export interface LayoutPickerData {
  /** 检查器「版式」的画廊一出现就是打开的 */
  lpOpen?: boolean
  lpQuery?: string
  /** 选中的卡：版式 id 或 "same"（与当前页相同） */
  lpSelected?: string
  /** 只显示当前页所用母版（单母版文档） */
  lpSingle?: boolean
  /** 画廊打开期间被他人删除的版式 */
  lpDeleted?: string[]
  lpReset?: boolean
  lpToast?: "mismatch" | "reset" | null
  /** 已应用到本页的版式（缺省为本页原来的版式） */
  lpApplied?: string
  /** 更换版式后匹配不到占位符的元素数（轻提示里的 N，缺省 2） */
  lpUnmatched?: number
}

/**
 * 某页用的版式：按页面的版式名在文档的母版里找（按母版顺序取第一个同名的，示例文档里即 Office 母版的那一个），找不到按页码（各版式的 pages），
 * 再找不到取清单里的第 2 个版式（示例文档里是「标题和内容」）。masters 缺省是示例文档的 MASTERS；场景自带母版时传 mastersOfSet 的结果——
 * 按名称认的是母版数据本来的名称（母版视图里运行时改的名不算，页还是那一页的版式）
 */
export function layoutOfSlide(slide: Pick<DeckSlide, "n" | "layout">, masters: readonly MasterDef[] = MASTERS): LayoutDef {
  const all = masters.flatMap((m) => m.layouts)
  return all.find((l) => l.name === slide.layout) ?? all.find((l) => l.pages.includes(slide.n)) ?? all[1] ?? all[0] ?? ALL_LAYOUTS[1]!
}

/** 状态里写的文档母版（data.mvMasters，与母版视图读同一个键；不写时示例文档的 MASTERS） */
const docMastersOf = (data: unknown): readonly MasterDef[] => mastersOfSet((data as { mvMasters?: MasterSetKey | readonly MasterDef[] }).mvMasters)

type Mode = "new" | "change"

/** 画廊与检查器字段共用的状态（换页时「本页已应用的版式」各页分开记）。 */
export function useLayoutPicker(mode: Mode = "change") {
  const ed = useEditor()
  const d = ed.data as LayoutPickerData
  const masters = docMastersOf(ed.data)
  const original = layoutOfSlide(ed.current, masters)
  const [open, setOpen] = useSceneState("layouts.open", !!d.lpOpen)
  const [query, setQuery] = useSceneState(`layouts.${mode}.query`, mode === "change" ? (d.lpQuery ?? "") : "")
  const [selected, setSelected] = useSceneState(`layouts.${mode}.selected`, mode === "change" ? (d.lpSelected ?? "same") : "same")
  const [reset, setReset] = useSceneState("layouts.reset", !!d.lpReset)
  const [toast, setToast] = useSceneState<"mismatch" | "reset" | null>("layouts.toast", d.lpToast ?? null)
  const [applied, setApplied] = useSceneState(`layouts.applied.${ed.slide}`, (ed.initial && d.lpApplied) || original.id)
  const current = layoutOf(applied, masters) ?? original
  return {
    mode, open, setOpen, query, setQuery, selected, setSelected, reset, setReset, toast, setToast, current, original, setApplied, masters,
    single: !!d.lpSingle, deleted: d.lpDeleted ?? [], unmatched: d.lpUnmatched ?? 2, slide: ed.slide,
  }
}

type Picker = ReturnType<typeof useLayoutPicker>

/* ------------------------------------------------------------------ 卡片 */

const frameCls = (on: boolean, off?: boolean) =>
  cn(
    "relative block overflow-hidden rounded-[4px] border border-(--v3-border) transition-colors",
    "group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-(--v3-accent)",
    on ? "border-(--v3-accent) ring-[0.5px] ring-(--v3-accent)" : !off && "group-hover:border-(--v3-hover-line)",
    off && "opacity-40",
  )

function Card({
  l,
  label,
  sub,
  on,
  isCurrent,
  deleted,
  onPick,
  onConfirm,
}: {
  l: LayoutDef
  label?: string
  /** 第二行灰字：「与当前页相同」「建议」写出它是哪个版式 */
  sub?: string
  on: boolean
  isCurrent?: boolean
  deleted?: boolean
  onPick: () => void
  onConfirm: () => void
}) {
  const name = label ?? l.name
  return (
    <button
      type="button"
      role="option"
      aria-selected={on}
      aria-disabled={deleted || undefined}
      aria-label={`${name}${sub ? `：${sub}` : ""}${isCurrent ? "（当前）" : ""}${deleted ? "（已被删除）" : ""}`}
      tabIndex={on ? 0 : -1}
      onClick={() => !deleted && onPick()}
      onDoubleClick={() => !deleted && onConfirm()}
      onFocus={() => !deleted && !on && onPick()}
      className={cn("group flex min-w-0 flex-col gap-1.5 rounded-[4px] text-left outline-none", deleted && "cursor-default")}
    >
      <span className={frameCls(on, deleted)}>
        <LayoutArt master={l.master} target={l.kind} prompts="thumb" />
      </span>
      <span className="flex flex-col">
        <span className="flex h-[18px] items-center gap-1 text-[12px] leading-none whitespace-nowrap">
          <span className={cn(deleted ? "text-(--v3-text-3)" : "text-(--v3-text)", on && "font-medium")}>{name}</span>
          {isCurrent && <Tag>当前</Tag>}
          {deleted && <Tag>已被删除</Tag>}
        </span>
        {sub && <span className="text-[12px] leading-4 whitespace-nowrap text-(--v3-text-2)">{sub}</span>}
      </span>
    </button>
  )
}

function Group({ p, m, first, layouts, withSame, onConfirm }: { p: Picker; m: MasterDef; first: boolean; layouts: LayoutDef[]; withSame: boolean; onConfirm: () => void }) {
  const isCurrentMaster = m.id === p.current.master
  // 新建：当前页是标题幻灯片时第一张换成「建议：标题和内容」
  const suggest = p.mode === "new" && p.current.kind === "title" ? (m.layouts.find((l) => l.kind === "title-content") ?? p.current) : null
  const same = suggest ?? p.current
  return (
    <section aria-label={`母版 ${m.name}`} className={cn(!first && "mt-4")}>
      {!p.single && (
        <div className="mb-2 flex flex-col gap-1">
          <h4 className="flex h-[18px] items-center gap-1.5 text-[12px] leading-none">
            <LayoutTemplate {...ICON} aria-hidden="true" className="text-(--v3-text-2)" />
            <span className="font-semibold text-(--v3-text)">{m.name}</span>
            {isCurrentMaster && <span className="text-(--v3-text-2)">· 当前页所用母版</span>}
            {m.imported && <Tag>导入</Tag>}
          </h4>
          {!isCurrentMaster && (
            <p className="flex items-start gap-1.5 text-[12px] leading-[18px] text-(--v3-text-2)">
              <Info {...ICON} aria-hidden="true" className="mt-px shrink-0" />
              <span>
                {p.mode === "new" ? "用这里的版式新建的页属于母版" : "选择这里的版式会同时把本页所属母版切换为"}
                <span className="whitespace-nowrap">「{m.name}」</span>
              </span>
            </p>
          )}
        </div>
      )}
      <div role="listbox" aria-label={`${m.name} 的版式`} className="grid grid-cols-4 items-start gap-x-2 gap-y-3">
        {withSame && (
          <Card l={same} label={suggest ? "建议" : "与当前页相同"} sub={same.name} on={p.selected === "same"} onPick={() => p.setSelected("same")} onConfirm={onConfirm} />
        )}
        {layouts.map((l) => (
          <Card
            key={l.id}
            l={l}
            on={p.selected === l.id}
            isCurrent={p.mode === "change" && l.id === p.current.id}
            deleted={p.deleted.includes(l.id)}
            onPick={() => p.setSelected(l.id)}
            onConfirm={onConfirm}
          />
        ))}
      </div>
    </section>
  )
}

/** 方向键按卡片的实际位置移动：左右取同一行的前后一张，上下取上 / 下一行里水平距离最近的一张（跨组同样适用）。 */
function moveFocus(e: KeyboardEvent<HTMLDivElement>) {
  const dir = { ArrowRight: "r", ArrowLeft: "l", ArrowDown: "d", ArrowUp: "u" }[e.key] as "r" | "l" | "d" | "u" | undefined
  if (!dir) return
  const cur = (e.target as HTMLElement).closest<HTMLElement>("[role=option]")
  if (!cur) return
  const all = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[role=option]:not([aria-disabled=true])"))
  const a = cur.getBoundingClientRect()
  let best: HTMLElement | undefined
  if (dir === "r" || dir === "l") {
    const i = all.indexOf(cur)
    best = all[dir === "r" ? i + 1 : i - 1]
  } else {
    let score = Infinity
    for (const el of all) {
      const b = el.getBoundingClientRect()
      const dy = dir === "d" ? b.top - a.bottom : a.top - b.bottom
      if (dy < -1) continue
      const s = dy * 1000 + Math.abs(b.left - a.left)
      if (s < score) {
        score = s
        best = el
      }
    }
  }
  e.preventDefault()
  best?.focus()
}

/**
 * 画廊正文（弹层内容，宽 472）：标题行、搜索、按母版分组的卡片、底栏。mode：new 新建幻灯片（左栏「新建幻灯片 ▾」）· change 更换版式（检查器「版式」、缩略图右键「更换版式…」）。
 * 放进 kit Popover：关闭走最近一层浮层（useLayerClose，与 Esc 同一条路径、焦点回到触发处）。
 */
export function LayoutGallery({ mode = "change" }: { mode?: Mode }) {
  const p = useLayoutPicker(mode)
  const close = useLayerClose()
  const q = p.query.trim().toLowerCase()
  const match = (name: string) => !q || name.toLowerCase().includes(q)
  // 当前页所用母版置顶，其余按文档顺序；单母版文档只有一组且不显示组标题。分组取文档的母版（p.masters，与母版视图的窗格同一份）
  const ordered = [...p.masters].sort((a, b) => (a.id === p.current.master ? -1 : b.id === p.current.master ? 1 : 0)).filter((m) => !p.single || m.id === p.current.master)
  const groups = ordered
    .map((m) => ({ m, layouts: m.layouts.filter((l) => match(l.name)), same: m.id === p.current.master && (match("与当前页相同") || match("建议") || match(p.current.name)) }))
    .filter((g) => g.layouts.length || g.same)
  const confirm = () => {
    if (mode === "change" && p.selected !== "same" && p.selected !== p.current.id) {
      p.setApplied(p.selected)
      p.setToast("mismatch")
    }
    close()
  }
  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 px-3 pt-3">
        <div className="flex h-6 items-center justify-between gap-4">
          <PopoverTitle>{mode === "new" ? `新建幻灯片 · 插入到第 ${p.slide} 页之后` : `更换版式 · 第 ${p.slide} 页`}</PopoverTitle>
          <IconButton label="关闭" kbd="Esc" size={24} onClick={close}>
            <X {...ICON} />
          </IconButton>
        </div>
        <TextField aria="搜索版式" placeholder="搜索版式" value={p.query} onChange={p.setQuery} leading={<Search {...ICON} className="shrink-0" />} />
      </div>
      <div
        className="max-h-[440px] min-h-0 overflow-y-auto px-3 pt-3 pb-3"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).closest("[role=option]")) {
            e.preventDefault()
            confirm()
            return
          }
          moveFocus(e)
        }}
      >
        {groups.length ? (
          groups.map((g, i) => <Group key={g.m.id} p={p} m={g.m} first={i === 0} layouts={g.layouts} withSame={g.same} onConfirm={confirm} />)
        ) : (
          <EmptyNote className="py-8">
            未找到匹配<span className="whitespace-nowrap">「{p.query}」</span>的版式
          </EmptyNote>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-(--v3-border) px-3 py-3">
        {mode === "change" ? (
          <Button
            variant="ghost"
            className="-ml-2 mr-auto px-2"
            onClick={() => {
              close()
              p.setReset(true)
            }}
          >
            <RotateCcw {...ICON} />
            重置为版式默认…
          </Button>
        ) : (
          <span className="mr-auto" />
        )}
        <Button variant="secondary" onClick={close}>
          取消
        </Button>
        <Button variant="primary" onClick={confirm}>
          {mode === "new" ? "新建幻灯片" : "应用版式"}
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 检查器「版式」字段 */

/** 字段里的版式缩略（32 × 18，真实渲染，不是骨架条，Q8；与画廊卡片同一种 thumb 画法，DS-149）。 */
export function LayoutThumb({ layout }: { layout?: LayoutDef }) {
  const l = layout ?? ALL_LAYOUTS[1]!
  return (
    <span aria-hidden="true" className="relative block h-[18px] w-8 shrink-0 overflow-hidden rounded-[2px] border border-(--v3-border) bg-white">
      <LayoutArt master={l.master} target={l.kind} prompts="thumb" />
    </span>
  )
}

/**
 * 「版式」节标题右侧的「编辑版式」（普通视图的常驻上下文入口，rulings §4.25 DS-147）。
 * 节标题右侧的 24px 动作位（03-02 §3.5「节与控件」）：图标与母版视图的上下文条同一个（MASTER_VIEW_ICON，TB-186），工具提示「编辑版式 ⌥⌘M」。
 * 点它进入母版视图、选中本页所用的版式（含在画廊里换过的：useLayoutPicker 的 current），焦点由宿主交给窗格里的选中行（同其他入口）。
 * 可用与否、原因一律取宿主的 masterView.entry，与主菜单「视图 › 母版视图」、⌥⌘M、命令面板同一条（03-26 §1.1）：不能进入时留在原位、不可用并写原因；
 * 检查器只读展示（评审、查看者、降权）时同样留在原位不可用，原因就是这一条（「评审模式下不可用」「只有查看权限」「需要编辑权限」），
 * 是 DS-15「只读展示不画禁用控件」的例外（DS-147 子题：进入另一个模式的动作，与同一检查器里「转到版式」只读时照画一致）。
 * 这个状态里根本没有母版视图入口时（entry.silent：主菜单也不列这一项）不画，连同节标题右侧的动作位一起省去（见下 useEditLayoutAction）。
 * 演示：状态数据 mvTip 为 edit-layout 时工具提示一出现就开着，第一次点按或按键后收起（kit useDemoOpen）
 */
function EditLayoutAction({ layout }: { layout: LayoutDef }) {
  const ed = useEditor()
  const demoTip = useDemoOpen((ed.data as { mvTip?: string }).mvTip === "edit-layout")
  const { entry } = ed.masterView
  return (
    <IconButton
      label="编辑版式"
      kbd="⌥⌘M"
      size={24}
      disabled={!entry.ok}
      reason={entry.reason}
      tipOpen={demoTip}
      data-v3-anchor="layout-edit"
      onClick={() => ed.masterView.enter("goto", { layout: layout.id })}
    >
      <MASTER_VIEW_ICON {...ICON} aria-hidden="true" />
    </IconButton>
  )
}

/**
 * 「版式」节标题右侧的动作位（Section 的 action）：「编辑版式」；没有母版视图入口的状态（entry.silent）返回 undefined，整个动作位不画。
 * 内置分区与状态私有的「版式」节变体（如 offline-conflict 软冲突 I 的远端覆盖画法）同用这一处
 */
export function useEditLayoutAction(layout: LayoutDef): ReactNode {
  const { masterView } = useEditor()
  return masterView.entry.silent ? undefined : <EditLayoutAction layout={layout} />
}

/**
 * 检查器「幻灯片 N › 版式」（内置分区 slide.layout）：版式缩略 + 当前版式名 + ▾，点开的是版式画廊（不是简单下拉），弹层贴检查器左缘、与字段顶端对齐。
 * 锚点 layout-field；按下态由 kit Popover 给锚点加 data-v3-open。只读（评审 / 浏览）只写当前版式、没有画廊入口（03-27 §4「画廊入口不出现」）；
 * disabled（降权、打开中）字段留在原位不可用、工具提示写原因。重置的二次确认也挂在这里（Dialog 挂到 v3 根节点）。
 * 节标题右侧的「编辑版式」（useEditLayoutAction，DS-147）三条分支都画、画在同一个动作位；只读时它留在原位、不可用并写原因（DS-15 的例外，见上）。
 */
export function SlideLayoutSection({ readOnly, disabled }: InspectorCtx) {
  const p = useLayoutPicker("change")
  const trigger = useRef<HTMLButtonElement>(null)
  const action = useEditLayoutAction(p.current)
  if (readOnly)
    return (
      <Section title="版式" anchor="section-slide.layout" action={action}>
        <StaticRow leading={<LayoutThumb layout={p.current} />}>{p.current.name}</StaticRow>
      </Section>
    )
  if (disabled) {
    const field = (
      <SelectTrigger aria-label={withReason(`版式：${p.current.name}`, disabled)} aria-disabled="true" data-v3-anchor="layout-field">
        <LayoutThumb layout={p.current} />
        <span className="truncate">{p.current.name}</span>
      </SelectTrigger>
    )
    return (
      <Section title="版式" anchor="section-slide.layout" action={action}>
        <Tip label={reasonTip("版式", disabled)}>{field}</Tip>
      </Section>
    )
  }
  return (
    <Section title="版式" anchor="section-slide.layout" action={action}>
      <SelectTrigger ref={trigger} aria-label={`版式：${p.current.name}`} aria-haspopup="dialog" aria-expanded={p.open} data-v3-anchor="layout-field" onClick={() => p.setOpen(!p.open)}>
        <LayoutThumb layout={p.current} />
        <span className="truncate">{p.current.name}</span>
      </SelectTrigger>
      <Popover
        anchor="layout-field"
        label="版式画廊"
        open={p.open}
        onOpenChange={p.setOpen}
        // 03-27：Esc 先清空搜索，再按才关闭
        onEscapeKeyDown={(e) => {
          if (p.query) {
            e.preventDefault()
            p.setQuery("")
          }
        }}
        // 点的是「版式」字段本身：交给字段切换开关，不在这里先关再被字段重开
        onInteractOutside={(e) => {
          if (trigger.current?.contains(e.target as Node)) e.preventDefault()
        }}
        className="w-[472px] p-0"
      >
        <LayoutGallery mode="change" />
      </Popover>
      <ResetDialog />
    </Section>
  )
}

/* ------------------------------------------------------------------ 重置确认与轻提示 */

/** 重置页的二次确认（D9 显式例外：确认卡 + 可撤销轻提示两层，rulings §4.10 Q16）；带当前版式的预览（与画廊卡片同一种 thumb 画法，DS-149）。 */
export function ResetDialog() {
  const p = useLayoutPicker("change")
  return (
    <Dialog
      variant="confirm"
      open={p.reset}
      onOpenChange={p.setReset}
      title={`重置「${p.current.name}」占位符？`}
      description="已对占位符做的位置、样式改动将恢复为版式定义；你新增的形状、图片不受影响。"
      secondary={{ label: "取消" }}
      primary={{ label: "确认重置", onClick: () => p.setToast("reset") }}
      // 触发它的「重置为版式默认…」在版式画廊里，画廊一关就卸载了：关闭后焦点回到检查器「版式」字段
      returnFocus="layout-field"
    >
      <div className="mx-auto w-[220px] overflow-hidden rounded-[4px] border border-(--v3-border)">
        <LayoutArt master={p.current.master} target={p.current.kind} prompts="thumb" />
      </div>
    </Dialog>
  )
}

/** 画布上的轻提示（编辑器画布列里常驻挂一份）：版式不匹配（Q13，统一文案）/ 已重置占位符属性，均带「撤销」，5 s。 */
export function LayoutToasts() {
  const ed = useEditorMaybe()
  if (!ed) return null
  return <LayoutToastsInner />
}

function LayoutToastsInner() {
  const p = useLayoutPicker("change")
  // 进出母版视图时收起（rulings §4.25 TB-204）：清掉驱动它的场景状态，不只收起 kit 轻提示——这一份常驻、不换 key，
  // 只收起件本身的话往返之后同一位置的下一条就画不出来；收起后退出母版视图也不再弹出（DS-169）
  useDismissOnMasterToggle(!!p.toast, () => p.setToast(null))
  if (!p.toast) return null
  return (
    <Toasts>
      {p.toast === "mismatch" ? (
        <Toast
          tone="warning"
          action="撤销"
          onAction={() => {
            p.setApplied(p.original.id)
            p.setToast(null)
          }}
        >
          {p.unmatched} 个元素无法匹配新版式的占位符，已保留为普通形状
        </Toast>
      ) : (
        <Toast action="撤销" onAction={() => p.setToast(null)}>
          已重置占位符属性
        </Toast>
      )}
    </Toasts>
  )
}
