import { useContext, useEffect, useId, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronRight, ExternalLink } from "lucide-react"
import { DropdownMenu as DM } from "radix-ui"
import { cn } from "@/lib/utils"
import { hasCjk, MENU_CONTENT, MENU_ITEM, MENU_SEPARATOR } from "../ui"
import { V3RootContext } from "../V3Root"
import { anchorPlacement, useAnchorElement, useMarkAnchorOpen, useTrackedRect, type Align, type Rect, type Side } from "./anchor"
import { Tag } from "./controls"
import { focusBack, InDialogContext, keepMovedFocus, useFocusBackOnClose } from "./layer"

/**
 * 菜单条目（数据描述，Menu / ContextMenu 共用）。外观沿用 ui.tsx 的 MENU_CONTENT / MENU_ITEM：
 * 面板 panel 实底 + 1px 边 + 阴影、圆角 8px；条目 28px、圆角 4px、12px 字；不可用时文字退到 text-3，原因写在右侧（text-2，读屏经 aria-describedby）。
 */
export type MenuSpec = MenuItemSpec | MenuCheckSpec | MenuRadioSpec | MenuSubSpec | MenuSeparatorSpec | MenuLabelSpec | MenuNoteSpec | MenuCustomSpec

interface RowCommon {
  label: string
  /** 16px 图标（同一面板里有一项带图标，其余项也留出图标列，文字对齐） */
  icon?: ReactNode
  /** 快捷键提示，如 "⌘C"、"⇧⌘V"（11px） */
  kbd?: string
  /** 右侧补充说明（灰），如「适应屏幕」 */
  hint?: string
  /** 标签后的小标记，如 "P2"、"M3" */
  tag?: string
  /**
   * 不可用：留在原位、文字退到 text-3；aria-disabled 且仍可聚焦（键盘能停上去听到原因，03-05 / 03-30 §5.3 / rulings §4.20 FE-06），选了无效
   */
  disabled?: boolean
  /** 不可用原因：写在右侧（代替快捷键），读屏经 aria-describedby 读出，如「剪贴板为空」「M3 提供」 */
  reason?: string
  /** aria-describedby：指向说明行（note 的 id）。不可用且没写 reason 的项缺省指向同一面板里带 id 的说明行（一组共用原因） */
  describedBy?: string
}

export interface MenuItemSpec extends RowCommon {
  type?: "item"
  id: string
  /** 危险操作（删除）：文字用危险色，放在菜单末尾 */
  danger?: boolean
  /**
   * 外链条目（在新标签页打开，rulings §4.25 DS-89：帮助菜单、账户菜单「帮助中心」、编辑器主菜单「帮助 › 帮助中心」）：文字后 12px ExternalLink（方框加箭头，text-2；
   * 与第 2 批「在新标签页中登录」、DS-52 的外链图标同一个，ArrowUpRight 在第 1、2 批是站内跳转），读屏名带「（在新标签页打开）」；不可用、勾选列与图标列对齐照常。
   * 第 3 批转正时由 scenarios/documents/shell.tsx 的 extItem（custom 条目自绘的 DM.Item）并入，画法逐像素相同
   */
  external?: boolean
  onSelect?: () => void
}

export interface MenuCheckSpec extends RowCommon {
  type: "checkbox"
  id: string
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
}

export interface MenuRadioSpec {
  type: "radio"
  id: string
  /** 单选组的读屏名（如「角色」「链接权限」「排序」）：菜单里有几组单选或组没有小标题时写上 */
  label?: string
  value: string
  options: (Omit<RowCommon, "label"> & { value: string; label: string })[]
  onValueChange?: (value: string) => void
  /**
   * 选了即关菜单（选值的下拉：角色、链接权限、有效期…）。缺省不关——为账户菜单的主题切换而设，选了马上能看到换肤效果、菜单还在。
   * 不可用的选项选了照样不关、不改值
   */
  closeOnSelect?: boolean
}

export interface MenuSubSpec extends Omit<RowCommon, "kbd" | "hint"> {
  type: "sub"
  id: string
  /** 子菜单条目 */
  items?: MenuSpec[]
  /** 或者自定义的子面板内容（如图表子类型的缩略图网格），给了就不用 items */
  content?: ReactNode
  /** 自定义子面板的内边距 / 宽度，如 "p-2 w-[264px]" */
  contentClassName?: string
}

export interface MenuSeparatorSpec {
  type: "separator"
}

/** 分组小标题（12px text-2，不可点），可挂小标记（「插入 M3」） */
export interface MenuLabelSpec {
  type: "label"
  label: string
  tag?: string
  id?: string
}

/**
 * 常驻说明行（不可点、可换行），如 03-05 的「表格结构编辑在 M3 提供」。text 可以是多行节点（按句分行用 block 的 span）；
 * tag 放在句首；给了 id 时，同一面板里不可用且没写 reason 的项用 aria-describedby 指向它（一组共用原因）。
 */
export interface MenuNoteSpec {
  type: "note"
  text: ReactNode
  tag?: string
  id?: string
}

export interface MenuCustomSpec {
  type: "custom"
  id: string
  render: ReactNode
}

/**
 * 菜单的只读形态（03-05 §4「禁用而不隐藏」，rulings §4.22 D-10）：条目与编辑模式相同，编辑类命令留在原位、不可用；keep 里的条目（复制、全选、网格与参考线、
 * 有评论权限时的「添加评论」、详情入口…）照常可用。同一原因的一组不可用项共用菜单顶部一行常驻说明（note），不逐项写原因、删除不再用危险色。
 * 画布与对象的右键都用这一份（第 2 批 context-menu.readonly、评论场景的画布菜单、无法显示的对象 DS-64），原在 slides-selection/menus.tsx，2026-10-15 上移到 kit。
 */
export function readOnlyMenu(items: MenuSpec[], keep: string[], note: string): MenuSpec[] {
  const walk = (list: MenuSpec[]): MenuSpec[] =>
    list.map((it) => {
      switch (it.type) {
        case "separator":
        case "label":
        case "note":
        case "custom":
        case "radio":
          return it
        case "sub":
          return keep.includes(it.id) ? { ...it, items: it.items && walk(it.items) } : { ...it, disabled: true, reason: undefined }
        case "checkbox":
          return keep.includes(it.id) ? it : { ...it, disabled: true, reason: undefined }
        default:
          return keep.includes(it.id) ? it : { ...it, disabled: true, reason: undefined, danger: false }
      }
    })
  // 说明行带 id：同一面板里没写 reason 的不可用项由 kit Menu 自动 aria-describedby 指向它（03-05「一组共用原因」）
  return [{ type: "note", id: "context-menu.readonly-reason", text: note }, SEP_SPEC, ...walk(items)]
}

const SEP_SPEC: MenuSpec = { type: "separator" }

/**
 * 画布与对象右键在只读形态下顶部说明行的文字（03-05 §4）：评审「评审模式：编辑类命令需要编辑权限」、只读浏览（查看者）「只有查看权限」、
 * 编辑模式已降权「需要编辑权限」（与主菜单的不可用原因同一口径）。缩略图右键另有一套（「评审模式下不可用」，editor/thumb-menu.tsx）
 */
export const READONLY_MENU_NOTE = { review: "评审模式：编辑类命令需要编辑权限", viewer: "只有查看权限", degraded: "需要编辑权限" } as const

const CHECK_COL = "flex w-4 shrink-0 items-center justify-center"

function Indicator() {
  return (
    <span className={CHECK_COL}>
      <DM.ItemIndicator>
        <Check size={12} strokeWidth={2} />
      </DM.ItemIndicator>
    </span>
  )
}

/**
 * 一行的内容：勾选列 · 图标列 · 文字（+ 标记）· 右侧说明 / 不可用原因 · 快捷键 · 子菜单箭头。
 * 右侧的说明、快捷键与不可用原因是可读信息，用 text-2（DS-9：text-3 只给占位与不可用项本身）；不可用项的文字、图标与快捷键退到 text-3。
 * 不可用原因（reasonId）：可见文字在右侧，读屏经条目的 aria-describedby 读到（这里 aria-hidden，免得名称里再念一遍）。
 */
function RowInner({ spec, check, inset, iconCol, chevron, reasonId, external }: { spec: RowCommon; check?: boolean; inset: boolean; iconCol: boolean; chevron?: boolean; reasonId?: string; external?: boolean }) {
  const reason = spec.disabled && spec.reason ? spec.reason : undefined
  const right = reason ?? spec.hint
  return (
    <>
      {check ? <Indicator /> : inset ? <span aria-hidden="true" className="w-4 shrink-0" /> : null}
      {iconCol && <span className="flex size-4 shrink-0 items-center justify-center text-(--v3-text-2) [[data-disabled]_&]:text-(--v3-text-3)">{spec.icon}</span>}
      <span className="flex min-w-0 flex-1 items-center gap-1.5 whitespace-nowrap">
        {spec.label}
        {spec.tag && <Tag>{spec.tag}</Tag>}
      </span>
      {external && <ExternalLink size={12} strokeWidth={1.5} aria-hidden="true" className="ml-4 shrink-0 text-(--v3-text-2) [[data-disabled]_&]:text-(--v3-text-3)" />}
      {external && <span className="sr-only">（在新标签页打开）</span>}
      {right && (
        <span id={reason ? reasonId : undefined} aria-hidden={reason ? true : undefined} className={cn("ml-4 shrink-0 whitespace-nowrap text-(--v3-text-2)", hasCjk(right) ? "text-[12px]" : "text-[11px]")}>
          {right}
        </span>
      )}
      {spec.kbd && !reason && (
        <kbd className={cn("shrink-0 font-sans text-(--v3-text-2) [[data-disabled]_&]:text-(--v3-text-3)", right ? "ml-2" : "ml-4", hasCjk(spec.kbd) ? "text-[12px]" : "text-[11px]")}>{spec.kbd}</kbd>
      )}
      {chevron && <ChevronRight size={12} strokeWidth={1.5} aria-hidden="true" className="ml-2 shrink-0 text-(--v3-text-2) [[data-disabled]_&]:text-(--v3-text-3)" />}
    </>
  )
}

const hasIcon = (items: MenuSpec[]) =>
  items.some((i) => (i.type === "radio" ? i.options.some((o) => o.icon) : "icon" in i && !!i.icon))

/**
 * 不可用项的公共属性：aria-disabled + data-disabled（沿用 MENU_ITEM 的 text-3 外观），不传 Radix 的 disabled，所以仍可聚焦、方向键可达（03-05「禁用项」、03-30 §5.3）。
 * describedBy：不可用原因（本行右侧的原因文字，或同一面板里的常驻说明行）。
 */
function offProps(disabled: boolean | undefined, describedBy: string | undefined) {
  return disabled ? { "aria-disabled": true as const, "data-disabled": "", "aria-describedby": describedBy } : describedBy ? { "aria-describedby": describedBy } : {}
}

/** 条目的不可用原因：自己写了 reason 的指向本行的原因文字（id 由面板前缀 + 条目 id 拼成），否则沿用 describe 的结果 */
const reasonIdOf = (prefix: string, id: string) => `${prefix}-why-${id}`

/** 小标题 / 说明行的左缩进：与条目文字对齐（勾选列 16 + 图标列 16 + 间距） */
const indent = (inset: boolean, iconCol: boolean, none: string) => (inset || iconCol ? (inset && iconCol ? "pl-14" : "pl-8") : none)

/** 渲染一个菜单面板里的条目（Menu、ContextMenu、子菜单共用）。openPath：静态展开的子菜单 id 路径。 */
export function MenuItems({ items, openPath = [] }: { items: MenuSpec[]; openPath?: string[] }) {
  const inset = items.some((i) => i.type === "checkbox" || i.type === "radio")
  const iconCol = hasIcon(items)
  const sharedNote = items.find((i): i is MenuNoteSpec => i.type === "note" && !!i.id)?.id
  const prefix = useId()
  /** aria-describedby：显式写的 → 本行的原因文字 → 同一面板里带 id 的说明行（一组共用原因） */
  const describe = (it: RowCommon & { id?: string }, key: string) =>
    it.describedBy ?? (it.disabled ? (it.reason ? reasonIdOf(prefix, key) : sharedNote) : undefined)
  return (
    <>
      {items.map((it, i) => {
        switch (it.type) {
          case "separator":
            return <DM.Separator key={`sep-${i}`} className={MENU_SEPARATOR} />
          case "label":
            return (
              <DM.Label key={`label-${i}`} id={it.id} className={cn("flex h-6 items-center gap-1.5 text-[12px] leading-none text-(--v3-text-2) select-none", indent(inset, iconCol, "px-2"))}>
                {it.label}
                {it.tag && <Tag>{it.tag}</Tag>}
              </DM.Label>
            )
          case "note":
            return (
              <div key={`note-${i}`} id={it.id} role="note" className={cn("max-w-[280px] py-1 pr-2 text-[12px] leading-[18px] text-(--v3-text-2)", indent(inset, iconCol, "pl-2"))}>
                {it.tag && <Tag className="mr-1.5 align-[1px]">{it.tag}</Tag>}
                {it.text}
              </div>
            )
          case "custom":
            return <div key={it.id}>{it.render}</div>
          case "checkbox":
            return (
              <DM.CheckboxItem
                key={it.id}
                checked={it.checked}
                {...offProps(it.disabled, describe(it, it.id))}
                onCheckedChange={(v) => {
                  if (!it.disabled) it.onCheckedChange?.(v === true)
                }}
                onSelect={(e) => e.preventDefault()}
                className={MENU_ITEM}
              >
                <RowInner spec={it} check inset={inset} iconCol={iconCol} reasonId={reasonIdOf(prefix, it.id)} />
              </DM.CheckboxItem>
            )
          case "radio":
            return <RadioGroup key={it.id} spec={it} inset={inset} iconCol={iconCol} sharedNote={sharedNote} prefix={prefix} />
          case "sub":
            return <SubMenu key={it.id} spec={it} inset={inset} iconCol={iconCol} openPath={openPath} describedBy={describe(it, it.id)} reasonId={reasonIdOf(prefix, it.id)} />
          default:
            return (
              <DM.Item
                key={it.id}
                {...offProps(it.disabled, describe(it, it.id))}
                onSelect={(e) => {
                  if (it.disabled) {
                    e.preventDefault()
                    return
                  }
                  it.onSelect?.()
                }}
                className={cn(MENU_ITEM, it.danger && "text-(--v3-danger)")}
              >
                <RowInner spec={it} inset={inset} iconCol={iconCol} reasonId={reasonIdOf(prefix, it.id)} external={it.external} />
              </DM.Item>
            )
        }
      })}
    </>
  )
}

function RadioGroup({ spec, inset, iconCol, sharedNote, prefix }: { spec: MenuRadioSpec; inset: boolean; iconCol: boolean; sharedNote?: string; prefix: string }) {
  const [v, setV] = useState(spec.value)
  return (
    <DM.RadioGroup
      aria-label={spec.label}
      value={v}
      onValueChange={(x) => {
        if (spec.options.find((o) => o.value === x)?.disabled) return
        setV(x)
        spec.onValueChange?.(x)
      }}
    >
      {spec.options.map((o) => (
        <DM.RadioItem
          key={o.value}
          value={o.value}
          {...offProps(o.disabled, o.describedBy ?? (o.disabled ? (o.reason ? reasonIdOf(prefix, `${spec.id}-${o.value}`) : sharedNote) : undefined))}
          onSelect={(e) => {
            if (!spec.closeOnSelect || o.disabled) e.preventDefault()
          }}
          className={MENU_ITEM}
        >
          <RowInner spec={o} check inset={inset} iconCol={iconCol} reasonId={reasonIdOf(prefix, `${spec.id}-${o.value}`)} />
        </DM.RadioItem>
      ))}
    </DM.RadioGroup>
  )
}

/**
 * 挂载后第一帧之前为 false。Radix 的子菜单在 effect 清理时会发一次「关闭」，开发模式的 StrictMode 挂载时就会走一遍清理，
 * 静态展开的子菜单（openPath）因此一出现就被关掉；用它忽略这段时间里的关闭。
 */
function useArmedAfterMount() {
  const armed = useRef(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      armed.current = true
    })
    return () => cancelAnimationFrame(id)
  }, [])
  return armed
}

function SubMenu({ spec, inset, iconCol, openPath, describedBy, reasonId }: { spec: MenuSubSpec; inset: boolean; iconCol: boolean; openPath: string[]; describedBy?: string; reasonId?: string }) {
  const root = useContext(V3RootContext)
  const mine = openPath[0] === spec.id && !spec.disabled
  const [open, setOpen] = useState(mine)
  const armed = useArmedAfterMount()
  return (
    <DM.Sub
      open={open}
      onOpenChange={(v) => {
        if (v && spec.disabled) return
        if (!v && mine && !armed.current) return
        setOpen(v)
      }}
    >
      <DM.SubTrigger {...offProps(spec.disabled, describedBy)} className={cn(MENU_ITEM, "data-[state=open]:bg-(--v3-panel-2)")}>
        <RowInner spec={spec} inset={inset} iconCol={iconCol} chevron reasonId={reasonId} />
      </DM.SubTrigger>
      <DM.Portal container={root ?? undefined}>
        {/* alignOffset −5：子菜单第一项与触发行对齐（抵掉 4px 内边距 + 1px 边），与主菜单「视图」子菜单一致 */}
        <DM.SubContent sideOffset={4} alignOffset={-5} collisionPadding={8} className={cn(MENU_CONTENT, spec.contentClassName)}>
          {spec.content ?? <MenuItems items={spec.items ?? []} openPath={mine ? openPath.slice(1) : []} />}
        </DM.SubContent>
      </DM.Portal>
    </DM.Sub>
  )
}

/** 代理触发器：一个不接收指针的 fixed 元素，摆在锚点（或右键落点）上，让 Radix 菜单贴着它定位。 */
export function ProxyTrigger({ rect }: { rect: Rect }) {
  return (
    <DM.Trigger asChild>
      <span
        aria-hidden="true"
        tabIndex={-1}
        className="pointer-events-none fixed"
        style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
      />
    </DM.Trigger>
  )
}

export interface MenuProps {
  items: MenuSpec[]
  /** 普通下拉：触发按钮（与 ui.tsx 的 V3Menu 用法相同，条目更丰富） */
  trigger?: ReactNode
  /** 锚定：挂在已有元素上（data-v3-anchor 名字），如 "tool-more"、"main-menu"、"zoom"；场景状态里缺省就是打开的 */
  anchor?: string
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** 位置：锚定时缺省按锚点推断（工具条按钮向上居中），普通下拉缺省向下左对齐 */
  side?: Side
  align?: Align
  sideOffset?: number
  alignOffset?: number
  /** 静态展开的子菜单 id 路径，如 ["arrange"]、["insert", "chart"]（截图子菜单时用） */
  openPath?: string[]
  /** 无障碍名称（锚定菜单没有可见触发器时建议写） */
  label?: string
  /** 面板宽度等，如 "min-w-[220px]" */
  className?: string
  /** 点到外面 / 焦点移到外面：调用 e.preventDefault() 可以不关闭（如点的是触发按钮本身，交给按钮自己切换） */
  onInteractOutside?: (e: Event) => void
  /**
   * 普通下拉（trigger）关闭时，焦点已被选中项打开的东西接走（如「编辑」换出的原位编辑框）就不再抢回触发按钮（kit keepMovedFocus）；
   * 缺省 false：照 Radix 交回触发按钮。锚定菜单本来就这样
   */
  keepFocus?: boolean
}

/**
 * 下拉菜单（含子菜单、勾选、单选、不可用原因、快捷键提示）。
 *
 *   // 锚定在工具条「更多」上、子菜单「媒体」展开：
 *   layers: <Menu anchor="tool-more" openPath={["media"]} items={[...]} />
 *   // 普通下拉：
 *   <Menu trigger={<Button>排列</Button>} items={[...]} />
 */
export function Menu({ items, trigger, anchor, open, defaultOpen, onOpenChange, side, align, sideOffset, alignOffset = 0, openPath, label, className, onInteractOutside, keepFocus }: MenuProps) {
  const root = useContext(V3RootContext)
  const anchored = !trigger
  const el = useAnchorElement(anchored ? anchor : undefined)
  const rect = useTrackedRect(anchored ? el : null)
  const [inner, setInner] = useState(defaultOpen ?? anchored)
  // 对话框里一出现就展开的下拉（分享对话框的角色 / 链接下拉）：等对话框挂好之后再展开（晚一次渲染），菜单才排在对话框之上、焦点进菜单（kit/layer InDialogContext）
  const inDialog = useContext(InDialogContext)
  const [ready, setReady] = useState(() => !(inDialog && !anchored && (open ?? defaultOpen ?? false)))
  useEffect(() => {
    if (!ready) setReady(true)
    // 只在挂载时
  }, [])
  const isOpen = (open ?? inner) && ready
  useMarkAnchorOpen(anchored ? el : null, !!root && !!rect && isOpen)
  // 关闭时焦点不在 body 停一帧（第 2 批第 6 轮集成）：菜单内容卸载的同一个任务末尾就交回锚点 / 触发按钮（kit useFocusBackOnClose）；
  // 焦点已被选中项打开的对话框 / 弹层接走时不动，Radix 随后的 onCloseAutoFocus 照旧（下面的判断）
  const triggerRef = useRef<HTMLButtonElement>(null)
  useFocusBackOnClose(!!root && (anchored ? !!rect : true) && isOpen, () => (anchored ? el : triggerRef.current))
  if (anchored && (!root || !rect)) return null
  const place = anchored ? anchorPlacement(anchor ?? "", el) : { side: "bottom" as const, align: "start" as const, sideOffset: 4 }
  return (
    <DM.Root
      open={isOpen}
      onOpenChange={(v) => {
        setInner(v)
        onOpenChange?.(v)
      }}
      modal={!anchored}
    >
      {trigger ? (
        <DM.Trigger asChild ref={triggerRef}>
          {trigger}
        </DM.Trigger>
      ) : (
        createPortal(<ProxyTrigger rect={rect!} />, root!)
      )}
      <DM.Portal container={root ?? undefined}>
        <DM.Content
          side={side ?? place.side}
          align={align ?? place.align}
          sideOffset={sideOffset ?? place.sideOffset}
          alignOffset={alignOffset}
          collisionPadding={8}
          aria-label={label}
          onCloseAutoFocus={(e) => {
            // 锚定打开的菜单没有真实触发器（代理触发器不可聚焦）：焦点交回锚点元素（工具条按钮、字段…），不掉到 body；
            // 选了某项后焦点已被新打开的对话框 / 弹层接走时不抢
            if (!anchored) {
              if (keepFocus) keepMovedFocus(e)
              return
            }
            e.preventDefault()
            const a = document.activeElement
            if (a && a !== document.body && a.isConnected) return
            focusBack(el)
          }}
          onInteractOutside={onInteractOutside}
          // 经 Portal 挂在根节点，React 事件仍沿组件树冒泡：从叠加层打开的菜单，点里面不应触发画布的「点空白取消选中」
          onClick={(e) => e.stopPropagation()}
          className={cn(MENU_CONTENT, className)}
        >
          <MenuItems items={items} openPath={openPath} />
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  )
}
