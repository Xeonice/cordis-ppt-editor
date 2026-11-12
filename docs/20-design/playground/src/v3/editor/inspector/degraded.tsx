import type { ComponentProps, KeyboardEvent, ReactNode } from "react"
import { BringToFront, Captions, ClipboardPaste, Copy, CopyPlus, ExternalLink, Group, Info, MessageSquarePlus, Scissors, Trash2, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { SelectionBox, type Box } from "../../kit/canvas"
import { READONLY_MENU_NOTE, readOnlyMenu, type MenuSpec } from "../../kit/Menu"
import { useSceneState, type SetSceneState } from "../../kit/scene"
import { Button, ICON, Section } from "../../ui"
import { useEditorMaybe, type EditorCtx } from "../context"
import { GeometrySection, type GeometryProps, type GeometryValue } from "./geometry"
import { inspectorPanel, inspectorSections, type InspectorCtx } from "./registry"

/**
 * 「无法显示的对象」的检查器（selectionKind = degraded，50/10 §5、50/25 §2.5；03-03「降级元素」行、03-13 元素级、PRD OF-13 / PM-12）。
 * 第 2 批集成统一：保真降级（新式图表、SmartArt / OLE 无预览、未知对象…）与缺插件的元素是同一个选中种类、同一套分区——
 *   对象说明 · 位置与大小（不旋转、不翻转；能否调整大小按对象）· 对象自己的其余节（替代文本、缺少的插件…）。
 * 对象说明与第 1 批图表「此类型仅支持查看」（chart.readonly-type 的 ReadonlyTypeSection，已拍板）同一画法（rulings §4.25 DS-52）：
 *   中性 Info 图标（次级文字色，不用警告色）+ 12px 600 标题 + 一句次级文字色说明（原因与「已原样保留」）+ 次按钮入口（「保真详情」/「查看详情」，
 *   与图表那颗「保真详情」同样带 14px 外链图标：本文件的 DegradedDetailButton，第 2 批统一——原来这里不带图标，与 DS-52「同一画法」对不上）；
 *   不再写「可以移动、缩放、复制和删除，不能编辑内部」——能做什么由画布上的手柄与右键菜单表达。图标由这里统一给，场景不能换（两种对象同一画法）。
 * 次序与图表「此类型仅支持查看」一致：说明在最上，用户先知道为什么不能编辑。没有任何内部编辑控件。
 * 内容由场景写在 EditorConfig.data.degraded（DegradedInfo；画布上任何状态都能点选占位时写在场景级 data 里）。
 * 纸面上的占位（保真占位与缺插件占位）也只有一份画法：本文件的 DegradedPlaceholder。
 */
export interface DegradedInfo {
  /** 面板标题：对象的类型名，如「新式图表」「二维码形状（占位）」 */
  title: string
  /** 对象说明：一句标题（12px 600）、说明（一句，次级文字色；长句用 Phrases 分段）、入口按钮（DegradedDetailButton：次按钮 + 外链图标，同第 1 批图表「保真详情」）；说明的图标统一是中性 Info，不由场景给 */
  about: { heading: ReactNode; text: ReactNode; action?: ReactNode }
  /** 位置与大小（与画布尺寸角标同一组数，pt） */
  geometry: GeometryValue
  /** 「位置与大小」的选项：缺省不旋转、不翻转并在节末注明；不能调整大小时写 sizeDisabled（原因） */
  geometryProps?: Partial<Pick<GeometryProps, "ratio" | "note" | "sizeDisabled">>
  /** 对象自己的其余节（一个或几个 Section）：替代文本、缺少的插件… */
  sections?: ReactNode
}

const infoOf = (ctx: InspectorCtx) => ctx.data.degraded as DegradedInfo | undefined

/** 这个对象能不能在画布上改大小：「位置与大小」没写 sizeDisabled 就能（保真占位），写了就不能（缺插件占位，插件不可用时不能调整大小） */
export const degradedResizable = (info: DegradedInfo | undefined) => !info?.geometryProps?.sizeDisabled

/**
 * 选中的「无法显示的对象」的位置与大小：场景状态（换状态即复位），初值是 data.degraded.geometry。同一页有几个同类占位时（如第 6 页三个缺插件占位），
 * 场景点选另一个就把它的值写进来（[, setGeometry]），检查器「位置与大小」与画布选中框的尺寸角标读同一份——选中框跟到哪一个，检查器就写哪一个的数。
 */
export function useDegradedGeometry(): [GeometryValue | undefined, SetSceneState<GeometryValue | undefined>] {
  const info = useEditorMaybe()?.data.degraded as DegradedInfo | undefined
  return useSceneState<GeometryValue | undefined>("v3.degraded.geometry", info?.geometry)
}

/**
 * 「无法显示的对象」在画布上的选中框（两种占位共用这一处，场景不再各自决定手柄）：与检查器「位置与大小」的示能一致——
 * 能改大小：8 个缩放手柄（含边中点）+ 尺寸角标；不能改大小：只留 1px 选中框与尺寸角标，不画手柄（原因写在检查器 W / H 下方的说明里）。
 * 都没有旋转手柄（不旋转、不翻转）；评审 / 查看等只读角色只画选中框，不画手柄与角标。尺寸角标取检查器同一组数（pt）。
 */
export function DegradedSelection({ box, info, readOnly }: { box: Box; info: DegradedInfo | undefined; readOnly?: boolean }) {
  const [geometry] = useDegradedGeometry()
  const g = geometry ?? info?.geometry
  const label = !readOnly && g ? `${g.w} × ${g.h}` : undefined
  return <SelectionBox box={box} handles={readOnly || !degradedResizable(info) ? "none" : "all"} label={label} />
}

/**
 * 「无法显示的对象」在纸面上的占位（03-13 元素级降级、03-09 §6.2 缺插件占位；OF-13 / PM-12）。保真占位与缺插件占位同属「降级对象」（DS-52），
 * 画法与字号只有这一份：虚线框 + 类型图标 + 一行标题 + 一行原因，「内容已保留」这类信息并进原因行（原缺插件占位是「插件名 / 原因 / 内容已保留」三行、
 * 保真占位两行，DS-52 统一为两行）。画在 SlideFrame 里：尺寸一律 cqw（缩略图与画布同一份渲染，虚线在缩略图里至少 1px），颜色用 --s-*（状态色不进纸面）。
 * className 给位置与大小（absolute + top / left / w / h，或网格里的 aspect-square w-full）。
 * 第 1 批 main-states 缺插件各状态第 6 页的二维码占位（main-states/slides.tsx QrSlide）用的也是这一份（DS-52，2026-10-15 由三行改为两行）。
 */
export function DegradedPlaceholder({ icon: Icon, title, reason, className }: { icon: LucideIcon; title: ReactNode; reason: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-[1cqw] rounded-[0.6cqw] border-[max(1px,0.14cqw)] border-dashed border-(--s-mute)/70 bg-(--s-card) px-[1cqw] text-center",
        className,
      )}
    >
      <Icon className="size-[3.2cqw] shrink-0 text-(--s-mute)" strokeWidth={1.5} aria-hidden="true" />
      <span className="mt-[0.4cqw] text-[1.7cqw] leading-[1.25] font-semibold text-(--s-ink)">{title}</span>
      <span className="text-[1.4cqw] leading-[1.4] text-(--s-body)">{reason}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ 右键菜单（两种占位共用一份） */

const SEP: MenuSpec = { type: "separator" }

/**
 * 「无法显示的对象」的右键菜单条目（保真占位与缺插件元素共用一份，第 2 批集成上移）：按 50/25 §2.5「能摆放」的口径——
 * 剪切 · 复制 · 粘贴 · 原位复制 ┊ 排列 ▸ · 组合 ┊ 编辑替代文本… · 添加评论 C ┊ 〈详情入口〉┊ 删除；没有格式类命令、没有旋转。
 * 单选时「组合」不可用（需选中 2 个以上对象）；替代文本留在原位不可用并写原因（altReason：AlternateContent 系「需在 PowerPoint 中修改」、缺插件元素「插件不可用时不能修改」）。
 * detail 是末组的详情入口：保真占位「查看保真详情」打开保真报告，缺插件元素「查看详情」打开个人插件面板（与检查器「对象说明」的按钮同一个去处）。
 * 评审、只读浏览与降权照常出这份菜单，编辑类命令不可用（rulings §4.25 DS-64，即 §4.22 D-10 禁用而不隐藏；见 fidelity.degraded-menu-review）：传 readOnly（degradedReadOnly(ctx) 按模式取）时
 * 走 kit readOnlyMenu 的画法——剪切、粘贴、原位复制、排列、组合、编辑替代文本…与删除留在原位、不可用，同一原因写在菜单顶部一行（不逐项写原因，删除不用危险色）；
 * 「复制」与详情入口照常可用，「添加评论」只在有评论权限时可用（readOnly.comment）。右键与 ⇧F10 / 菜单键在三种只读形态里都打开它，关闭后焦点回到占位。
 */
export function degradedMenuItems({
  detail,
  altReason,
  readOnly,
}: {
  detail: { label: string; icon: ReactNode; onSelect: () => void }
  altReason: string
  /** 只读形态（评审 / 只读浏览 / 降权）：顶部说明与能否评论；缺省是编辑模式的菜单 */
  readOnly?: DegradedReadOnly
}): MenuSpec[] {
  const items = degradedMenuEditItems(detail, altReason)
  return readOnly ? readOnlyMenu(items, ["copy", "detail", ...(readOnly.comment ? ["comment"] : [])], readOnly.note) : items
}

/** 无法显示的对象的菜单在只读形态下的两样差别：顶部说明行（03-05 §4）与「添加评论」能不能用 */
export interface DegradedReadOnly {
  note: string
  comment: boolean
}

/**
 * 按编辑器当前的模式取只读形态（03-05 §4，DS-64）：评审「评审模式：编辑类命令需要编辑权限」、可以评论；只读浏览「只有查看权限」、不能评论；
 * 编辑模式已降权写状态的 readonlyDegraded（「需要编辑权限」），降为可评审、评论照常（同第 1 批 main-states.degraded：评论工具照常可用）；编辑模式没降权返回 undefined
 */
export function degradedReadOnly(ctx: Pick<EditorCtx, "mode" | "readonlyDegraded">): DegradedReadOnly | undefined {
  if (ctx.mode === "review") return { note: READONLY_MENU_NOTE.review, comment: true }
  if (ctx.mode === "viewer") return { note: READONLY_MENU_NOTE.viewer, comment: false }
  if (ctx.readonlyDegraded) return { note: ctx.readonlyDegraded, comment: true }
  return undefined
}

function degradedMenuEditItems(detail: { label: string; icon: ReactNode; onSelect: () => void }, altReason: string): MenuSpec[] {
  return [
    { id: "cut", label: "剪切", icon: <Scissors {...ICON} />, kbd: "⌘X" },
    { id: "copy", label: "复制", icon: <Copy {...ICON} />, kbd: "⌘C" },
    { id: "paste", label: "粘贴", icon: <ClipboardPaste {...ICON} />, kbd: "⌘V" },
    { id: "duplicate", label: "原位复制", icon: <CopyPlus {...ICON} />, kbd: "⌘D" },
    SEP,
    {
      type: "sub",
      id: "arrange",
      label: "排列",
      icon: <BringToFront {...ICON} />,
      items: [
        { id: "front", label: "置于顶层", kbd: "⇧⌘]" },
        { id: "forward", label: "上移一层", kbd: "⌘]" },
        { id: "backward", label: "下移一层", kbd: "⌘[" },
        { id: "back", label: "置于底层", kbd: "⇧⌘[" },
      ],
    },
    { id: "group", label: "组合", icon: <Group {...ICON} />, kbd: "⌘G", disabled: true, reason: "需选中 2 个以上对象" },
    SEP,
    { id: "alt", label: "编辑替代文本…", icon: <Captions {...ICON} />, disabled: true, reason: altReason },
    { id: "comment", label: "添加评论", icon: <MessageSquarePlus {...ICON} />, kbd: "C" },
    SEP,
    { id: "detail", label: detail.label, icon: detail.icon, onSelect: detail.onSelect },
    SEP,
    { id: "delete", label: "删除", icon: <Trash2 {...ICON} />, kbd: "⌫", danger: true },
  ]
}

/** 菜单在占位上的落点（占位内的相对坐标）：静态样张（fidelity.degraded-menu、plugins.missing-menu）与键盘打开（⇧F10 / 菜单键）用同一处 */
export const DEGRADED_MENU_AT = { x: 0.56, y: 0.4 }

/**
 * 右键菜单的键盘等价：焦点在占位上按 ⇧F10 / 菜单键时，在 DEGRADED_MENU_AT 的落点派发 contextmenu（kit ContextMenu 只听 contextmenu 事件，macOS 上 ⇧F10 不会产生它），
 * 打开的就是右键的同一份菜单；关闭后焦点回到占位（kit ContextMenu 交回被右键的元素）。挂在占位按钮的 onKeyDown 上，返回有没有处理。
 */
export function openContextMenuFromKey(e: KeyboardEvent<HTMLElement>, at: { x: number; y: number } = DEGRADED_MENU_AT): boolean {
  if (!(e.key === "ContextMenu" || (e.shiftKey && e.key === "F10"))) return false
  e.preventDefault()
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + r.width * at.x, clientY: r.top + r.height * at.y }))
  return true
}

inspectorPanel({ kind: "degraded", title: (ctx) => infoOf(ctx)?.title ?? "无法显示的对象" })

/**
 * 对象说明：与图表「此类型仅支持查看」（chart/inspector.tsx ReadonlyTypeSection）同一画法——中性 Info 图标（text-2）+ 12px 600 标题、
 * 一句 text-2 说明、次按钮靠左（DegradedDetailButton：与图表「保真详情」同一颗，带 14px 外链图标；DS-52）。状态色不进检查器：「以占位显示」的级别由缩略图角标与保真报告的条目图标表达（Q3）。
 */
function AboutSection(ctx: InspectorCtx) {
  const info = infoOf(ctx)
  if (!info) return null
  const { heading, text, action } = info.about
  return (
    <Section anchor="section-degraded.about">
      <h3 className="flex items-center gap-1.5 text-[12px] leading-4 font-semibold text-(--v3-text)">
        <Info {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />
        {heading}
      </h3>
      <p className="text-[12px] leading-[18px] text-(--v3-text-2)">{text}</p>
      {action && <div className="flex">{action}</div>}
    </Section>
  )
}

/**
 * 对象说明的入口（「保真详情」打开保真报告、「查看详情」打开个人插件面板）：与第 1 批图表「此类型仅支持查看」的「保真详情」（chart/inspector.tsx
 * ReadonlyTypeSection，已拍板）同一颗——次按钮 + 14px 外链图标（ExternalLink，描边 1.5）+ 文字，DS-52 的「同一画法」。图标由这里统一给，
 * 场景只给文字、点按与锚点（两种对象同一画法：原来这两处不带图标、图表那颗带，画法对不上）。
 */
export function DegradedDetailButton({ children, ...rest }: Omit<ComponentProps<typeof Button>, "variant">) {
  return (
    <Button variant="secondary" {...rest}>
      <ExternalLink size={14} strokeWidth={1.5} aria-hidden="true" />
      {children}
    </Button>
  )
}

function GeometryPart(ctx: InspectorCtx) {
  const info = infoOf(ctx)
  // 选中的是哪一个占位，就写哪一个的数（与画布选中框同一份，useDegradedGeometry）
  const [geometry] = useDegradedGeometry()
  if (!info) return null
  return (
    <GeometrySection
      anchor="section-degraded.geometry"
      readOnly={ctx.readOnly}
      value={geometry ?? info.geometry}
      rotate={false}
      note="此类对象不旋转、不翻转"
      {...info.geometryProps}
    />
  )
}

function ExtraSections(ctx: InspectorCtx) {
  return <>{infoOf(ctx)?.sections ?? null}</>
}

inspectorSections([
  { id: "degraded.about", kinds: ["degraded"], order: 10, component: AboutSection },
  { id: "degraded.geometry", kinds: ["degraded"], order: 20, component: GeometryPart },
  { id: "degraded.sections", kinds: ["degraded"], order: 30, component: ExtraSections },
])
