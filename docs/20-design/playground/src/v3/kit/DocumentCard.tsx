import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react"
import { MoreHorizontal, Pin } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CoverId } from "../CoverArt"
import { ME, type Person } from "../data"
import { DocCover, type ExtraCoverId } from "../DocCover"
import { openState, ROLE_TAG, type DocRole } from "../library"
import { useV3Params } from "../params"
import { Avatar, ICON, ICON_LG, IconButton, Tip } from "../ui"
import { Tag } from "./controls"
import { Menu, type MenuSpec } from "./Menu"
import { roving } from "./roving"

/**
 * 文档卡片：首页最近、文档列表、回收站、搜索结果同一个件（rulings §4.25 DS-81「同一份菜单、按视图与角色增减」），由已拍板首页「最近」的卡片抽出（DS-12、设计 03-29 §3）；
 * 第 3 批转正（2026-10-22，kitRequest g1 K2）时并入文档组 DocCard 的全部能力，画法与 scenarios/documents/DocCard.tsx 逐像素相同、属性同名：
 * - grid：16:9 封面（圆角 6、1px 边）· 标题（13px 500，单行截断）+ 标记 · 第二行（12px text-2，「编辑者 · 相对时间」，DS-83）· 右下头像（16）；整卡 8 圆角、悬停铺 --v3-card-hover。
 *   list：一行 120 封面 · 标题 · 编辑者 96 · 时间 132 · 头像（列表头由调用处画，不画列名行，DS-84）。
 *   第二行缺项（rulings §4.25 TB-171，03-01 §4.2；样张数据每条都有编辑者与时间，没有演示）：缺最近编辑者（系统作业建的文档）只写相对时间；最近编辑者与内容更新时间都缺（还没有快照）时
 *   按创建时间写相对时间、不写编辑者；不拿所有者顶替编辑者；列表形态的「编辑者 · 时间」两列、搜索下拉与搜索结果页的每一行同此；开始页「最近编辑」排序缺内容时间时取创建时间。
 * - 卡片是链接（rulings §4.25 TB-108）：<a href>，读屏念「链接」；浏览器原生的新标签页打开（⌘ / Ctrl 点按、中键）、右键里的「复制链接地址」照常可用，
 *   我们的菜单不加「在新标签页打开」；「⋯」是与链接并列的按钮（不嵌套）。缺省 href 按我的角色链到编辑器的对应形态（编辑 / 评审 / 只读浏览，第 1 批 main-states）。
 * - 键盘（TB-107）：整个网格一个 Tab 停靠点（kit useRovingGrid，卡片元素带 data-v3-roving），Enter 打开，⇧F10 / 菜单键开「⋯」菜单，「⋯」不进 Tab 顺序（焦点在卡片上时露出、指针照常可点）。
 * - 标题后的标记：固定的 12px 图钉（PRD AS-02）、角色徽标「仅查看 / 可评论」（UX-19，01 §5.1）；标题照常单行截断，标记不被挤掉。
 * - 右下按 DS-83 取：我拥有的共享文档叠 2 位协作者，别人共享给我的是一枚所有者头像（读屏名「所有者 X」）；doc.shared 是旧写法（直接给人），照样画。
 * - 内联重命名（03-01「交互说明」）：标题换成输入框并全选原名，Enter 确认、Esc 取消、失焦保存，名字长时换到两行（最多两行）。
 * - disabled（离线时不能打开）：留在原位、封面与文字变淡，没有 href（role=link + aria-disabled，仍在漫游里能停上去），工具提示与读屏名写原因（rulings §4.20 FE-06）。
 * - inert（回收站：不能打开，DS-85）：卡片是可聚焦的容器（role=group、读屏名由 label 给），不铺悬停底，Enter 不打开；右键与 ⇧F10 打开「恢复 ┊ 永久删除…」；
 *   dim（回收站封面变淡）、touch（触控形态，手机与平板：「⋯」常显在文字行末，44 命中区，DS-87、TB-165）。
 * - 无封面（cover null）：白纸面 + 居中 24px Presentation（03-29 §2.3、03-01「卡片封面来源」，不画骨架条）；coverNode 换掉封面；badge 封面左上角小标（kit 示例）。
 * - demo：样张定格悬停 / 键盘焦点的样子（只为截图，产品没有这个属性）。
 * 读屏名写全「标题，编辑者 X，时间，标记，所有者 / 共享给」（不靠封面图与 16px 头像拼）。卡片自己渲染 <li>，外面包 kit CardList（四列网格、整组一个 Tab 停靠点）。
 */
export interface DocCardData {
  id: string
  title: string
  /** 封面（CoverArt / DocCover 的 id）；null 为没有封面 */
  cover?: CoverId | ExtraCoverId | null
  /** 第二行的编辑者（「我」或姓名）与相对时间（DS-83：最近一次编辑的人与时间；缺项时的写法见文件头，TB-171） */
  editor: string
  when: string
  /** 所有者（我拥有的写 ME；缺省视为我拥有） */
  owner?: Person
  /** 我对这份文档的角色（缺省 owner）：评审者徽标「可评论」、查看者「仅查看」，链接落到编辑器的对应形态 */
  role?: DocRole
  /** 我拥有、且共享给了别人：右下叠放的协作者（最多 2 位，DS-83） */
  collaborators?: Person[]
  /** 旧写法：右下直接叠这几位（kit 示例 data.ts RECENT_DOCS） */
  shared?: Person[]
  /** 固定（PRD AS-02）：标题后 12px 图钉 */
  pinned?: boolean
}

export interface DocumentCardProps {
  doc: DocCardData
  view?: "grid" | "list"
  /** 链接地址（缺省按我的角色链到编辑器的对应形态，见 useDocHref） */
  href?: string
  /** 点按打开（给了就拦下链接的缺省跳转、改调它；旧写法） */
  onOpen?: () => void
  /** 「⋯」菜单条目（DS-81：分享… · 创建副本 · 重命名 ┊ 固定 / 取消固定 · 从最近移除 ┊ 移到回收站；回收站「恢复 ┊ 永久删除…」） */
  menu?: MenuSpec[]
  /** 「⋯」菜单一出现就打开（场景状态） */
  menuOpen?: boolean
  /** 换掉第二行（grid） */
  meta?: ReactNode
  /** 换掉列表的第 3、4 列（编辑者、时间） */
  metaCols?: [ReactNode, ReactNode]
  /** 换掉右下（列表行尾）；null 不画 */
  trailing?: ReactNode | null
  /** 封面左上角的小标 */
  badge?: ReactNode
  /** 换掉封面 */
  coverNode?: ReactNode
  /** 不能打开（回收站）：可聚焦的容器，不是链接、不铺悬停底 */
  inert?: boolean
  /** 封面变淡（回收站） */
  dim?: boolean
  /** 不能打开的原因（离线）：aria-disabled、封面与文字变淡、工具提示写原因 */
  disabled?: string
  /** 读屏名（缺省 cardLabel；回收站写「在回收站中，N 天后永久删除」） */
  label?: string
  /** 内联重命名 */
  editing?: { value: string; onChange: (v: string) => void; onCommit: () => void; onCancel: () => void }
  /** 样张定格：悬停（铺底 +「⋯」）或键盘焦点（焦点环） */
  demo?: "hover" | "focus"
  /** 触控形态：「⋯」常显在文字行末、44 命中区 */
  touch?: boolean
  /** 不画固定图钉（回收站） */
  hidePin?: boolean
  /** 卡片元素的 data-v3-anchor（焦点交还、菜单定位用） */
  anchor?: string
  /** 「⋯」按钮的 data-v3-anchor */
  menuAnchor?: string
  className?: string
}

/** 共享头像：16px、白边、叠放 -3（首页已拍板画法）；读屏名「共享给 …」 */
export function SharedAvatars({ people, label }: { people: Person[]; label?: string }) {
  return (
    <span className="flex shrink-0 items-center" aria-label={label ?? `共享给 ${people.map((p) => p.name).join("、")}`}>
      {people.map((p, i) => (
        <Avatar key={p.name} name={p.name} tone={p.tone} size={16} ring="canvas" className={cn(i > 0 && "-ml-[3px]")} />
      ))}
    </span>
  )
}

/** 别人共享给我的文档：一枚所有者头像（DS-83） */
export function OwnerAvatar({ owner }: { owner: Person }) {
  return (
    <span className="flex shrink-0 items-center" aria-label={`所有者 ${owner.name}`}>
      <Avatar name={owner.name} tone={owner.tone} size={16} ring="canvas" />
    </span>
  )
}

/** 右下的头像（DS-83）：旧写法 shared 直接画；我拥有的共享文档 → 协作者（最多 2 位）；别人共享给我的 → 所有者 */
export function defaultTrailing(d: DocCardData): ReactNode {
  if (d.shared?.length) return <SharedAvatars people={d.shared} />
  if (d.owner && d.owner.name !== ME.name) return <OwnerAvatar owner={d.owner} />
  if (d.collaborators?.length) return <SharedAvatars people={d.collaborators.slice(0, 2)} />
  return null
}

/** 卡片的读屏名 */
export function cardLabel(d: DocCardData, extra?: string): string {
  const parts = [d.title, `编辑者 ${d.editor}，${d.when}`]
  if (d.pinned) parts.push("已固定")
  const tag = d.role ? ROLE_TAG[d.role] : undefined
  if (tag) parts.push(tag)
  const people = d.shared ?? d.collaborators
  if (d.owner && d.owner.name !== ME.name) parts.push(`所有者 ${d.owner.name}`)
  else if (people?.length) parts.push(`共享给 ${people.map((p) => p.name).join("、")}`)
  if (extra) parts.push(extra)
  return parts.join("，")
}

/**
 * 卡片的链接地址（TB-108）：产品是 /documents/:id；样张链到同一份文档在编辑器里的对应形态（按我的角色：编辑 / 评审 / 只读浏览，第 1 批 main-states），
 * 沿用当前主题与强调色——点按、⌘ 点按（新标签页）、复制链接地址都能用
 */
export function useDocHref(d: DocCardData): string {
  const { theme, accent } = useV3Params()
  return `#/v3/editor?${new URLSearchParams({ state: openState(d), theme, accent }).toString()}`
}

function Adornments({ doc, hidePin, off }: { doc: DocCardData; hidePin?: boolean; off?: boolean }) {
  const tag = doc.role ? ROLE_TAG[doc.role] : undefined
  return (
    <>
      {doc.pinned && !hidePin && <Pin size={12} strokeWidth={1.5} aria-hidden="true" className={cn("shrink-0", off ? "text-(--v3-text-3)" : "text-(--v3-text-2)")} />}
      {tag && <Tag className={off ? "text-(--v3-text-3)" : undefined}>{tag}</Tag>}
    </>
  )
}

/** 内联重命名的输入框：外框同字段（淡底、聚焦为强调色 1px 线），文字位置与标题对齐；最多两行 */
function RenameField({ doc, editing }: { doc: DocCardData; editing: NonNullable<DocumentCardProps["editing"]> }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus({ preventScroll: true })
    el.select()
  }, [])
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault()
      editing.onCommit()
    } else if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      editing.onCancel()
    }
  }
  return (
    <span className="-mx-1.5 flex rounded-[4px] bg-(--v3-field-fill) px-1.5 ring-1 ring-(--v3-accent) ring-inset">
      <textarea
        ref={ref}
        rows={1}
        value={editing.value}
        aria-label={`重命名「${doc.title}」`}
        spellCheck={false}
        onChange={(e) => editing.onChange(e.target.value.replace(/\n/g, ""))}
        onKeyDown={onKeyDown}
        onBlur={editing.onCommit}
        className="field-sizing-content max-h-10 min-h-5 w-full min-w-0 resize-none overflow-hidden bg-transparent py-0 text-[13px] leading-5 font-medium text-(--v3-text) outline-none"
      />
    </span>
  )
}

const FOCUS_DEMO = "outline-2 outline-offset-1 outline-(--v3-accent) outline-solid"

export function DocumentCard({
  doc: d,
  view = "grid",
  href,
  onOpen,
  menu,
  menuOpen,
  meta,
  metaCols,
  trailing,
  badge,
  coverNode,
  inert,
  dim,
  disabled,
  label: labelProp,
  editing,
  demo,
  touch,
  hidePin,
  anchor,
  menuAnchor,
  className,
}: DocumentCardProps) {
  const [open, setOpen] = useState(!!menuOpen)
  const autoHref = useDocHref(d)
  /** 菜单是从卡片本身打开的（⇧F10 / 菜单键、回收站卡片的右键）：关闭后焦点回到卡片，不落在「⋯」上 */
  const fromCard = useRef(false)
  /** 刚用键盘打开了我们的菜单：同一下按键随后的原生 contextmenu 不再弹浏览器菜单 */
  const kbdAt = useRef(0)
  const liRef = useRef<HTMLLIElement>(null)
  const onMenuOpenChange = (v: boolean) => {
    setOpen(v)
    if (v || !fromCard.current) return
    fromCard.current = false
    // 菜单内容卸载、kit 把焦点交还给触发按钮「⋯」之后再交给卡片（逐帧看，最多约 6 帧）；选了打开对话框 / 重命名的项时焦点已经有去处，不动
    let n = 0
    const step = () => {
      const li = liRef.current
      if (!li?.isConnected) return
      const a = document.activeElement
      const onTrigger = !!a && a.getAttribute("aria-haspopup") === "menu" && li.contains(a)
      if (onTrigger || !a || a === document.body) {
        li.querySelector<HTMLElement>(`[data-v3-anchor="${anchor}"]`)?.focus({ preventScroll: true })
        return
      }
      // 焦点还在菜单里（内容尚未卸载）就再等一帧
      if (a.closest('[role="menu"]') && ++n < 6) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }
  const tailNode = trailing === undefined ? defaultTrailing(d) : trailing
  // 不能打开的卡片：右下头像随封面一起变淡（身份色只作标识，不再像可点的东西）
  const tail = disabled && tailNode ? <span className="flex shrink-0 opacity-50">{tailNode}</span> : tailNode
  const off = !!disabled
  const fade = off ? "opacity-50" : dim ? "opacity-60" : undefined
  const textTone = off ? "text-(--v3-text-3)" : undefined
  const label = labelProp ?? cardLabel(d, off ? disabled : undefined)

  // ⇧F10 / 菜单键打开同一份「⋯」菜单（TB-107）
  const onKeyDown = menu
    ? (e: KeyboardEvent) => {
        if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
          e.preventDefault()
          kbdAt.current = performance.now()
          fromCard.current = true
          setOpen(true)
        }
      }
    : undefined
  // 链接上的右键是浏览器原生的链接菜单（新标签页打开、复制链接地址，TB-108）；只吞掉键盘打开我们的菜单时随之而来的那一次
  const onLinkContextMenu = (e: MouseEvent) => {
    if (performance.now() - kbdAt.current < 800) e.preventDefault()
  }
  // 回收站卡片不是链接：右键打开同一份「恢复 ┊ 永久删除…」菜单（DS-85）
  const onInertContextMenu =
    menu && inert
      ? (e: MouseEvent) => {
          e.preventDefault()
          fromCard.current = true
          setOpen(true)
        }
      : undefined

  const menuButton = menu && !editing && (
    <Menu
      items={menu}
      open={open}
      onOpenChange={onMenuOpenChange}
      keepFocus
      align="end"
      label={`「${d.title}」的操作`}
      trigger={
        <IconButton
          label={`更多操作：${d.title}`}
          size={touch ? 44 : 24}
          noTip
          tabIndex={-1}
          aria-haspopup="menu"
          data-v3-anchor={menuAnchor}
          className={cn(
            !touch && "opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100 data-[state=open]:opacity-100",
            !touch && (view === "grid" ? "absolute top-4 right-4 bg-(--v3-panel) ring-1 ring-(--v3-border) ring-inset" : "absolute top-1/2 right-2 -translate-y-1/2"),
            touch && "absolute right-0 bottom-0",
            (demo === "hover" || demo === "focus") && "opacity-100",
          )}
        >
          <MoreHorizontal {...(touch ? ICON_LG : ICON)} />
        </IconButton>
      }
    />
  )

  const cover = <span className={cn("block overflow-hidden rounded-[6px] border border-(--v3-border)", fade)}>{coverNode ?? <DocCover cover={d.cover ?? null} title={d.title} />}</span>

  const titleRow = editing ? (
    <RenameField doc={d} editing={editing} />
  ) : (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className={cn("truncate text-[13px] leading-5 font-medium", textTone)}>{d.title}</span>
      <Adornments doc={d} hidePin={hidePin} off={off} />
    </span>
  )

  const shell = (cls: string, children: ReactNode) => {
    if (editing)
      return (
        <div data-v3-anchor={anchor} className={cls}>
          {children}
        </div>
      )
    if (inert)
      return (
        <div {...roving} data-v3-anchor={anchor} role="group" aria-label={label} onKeyDown={onKeyDown} className={cn(cls, demo === "focus" && FOCUS_DEMO)}>
          {children}
        </div>
      )
    const link = (
      <a
        {...roving}
        data-v3-anchor={anchor}
        href={off ? undefined : (href ?? autoHref)}
        role={off ? "link" : undefined}
        aria-label={label}
        aria-disabled={off || undefined}
        onKeyDown={onKeyDown}
        onContextMenu={onLinkContextMenu}
        onClick={
          onOpen && !off
            ? (e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                e.preventDefault()
                onOpen()
              }
            : undefined
        }
        className={cn(cls, !off && "transition-colors hover:bg-(--v3-card-hover)", off && "cursor-default", demo === "hover" && "bg-(--v3-card-hover)", demo === "focus" && FOCUS_DEMO)}
      >
        {children}
      </a>
    )
    return off ? <Tip label={disabled!}>{link}</Tip> : link
  }

  const badgeNode = badge && <span className={cn("pointer-events-none absolute flex items-center", view === "grid" ? "top-4 left-4" : "top-3 left-3")}>{badge}</span>

  if (view === "grid") {
    const inner = (
      <>
        {cover}
        <span className={cn("mt-2 flex items-end justify-between gap-2", touch && menu && "pr-9")}>
          <span className={cn("block min-w-0", editing && "flex-1")}>
            {titleRow}
            <span className={cn("block truncate text-[12px] leading-4 text-(--v3-text-2)", textTone)}>
              {meta ?? (
                <>
                  {d.editor} · {d.when}
                </>
              )}
            </span>
          </span>
          {tail}
        </span>
      </>
    )
    return (
      <li ref={liRef} className={cn("group/card relative", className)} onContextMenu={onInertContextMenu}>
        {shell("block w-full rounded-[8px] p-2 text-left", inner)}
        {badgeNode}
        {menuButton}
      </li>
    )
  }

  const cells = (
    <>
      {cover}
      {titleRow}
      {metaCols ?? (
        <>
          <span className={cn("truncate text-[12px] leading-4 text-(--v3-text-2)", textTone)}>{d.editor}</span>
          <span className={cn("truncate text-[12px] leading-4 text-(--v3-text-2)", textTone)}>{d.when}</span>
        </>
      )}
      <span className="flex justify-end">{tail}</span>
    </>
  )
  const ROW = cn("grid w-full grid-cols-[120px_minmax(0,1fr)_96px_132px_minmax(44px,auto)] items-center gap-4 rounded-[8px] p-2 text-left", menu && "pr-10")
  return (
    <li ref={liRef} className={cn("group/card relative", className)} onContextMenu={onInertContextMenu}>
      {shell(ROW, cells)}
      {badgeNode}
      {menuButton}
    </li>
  )
}
