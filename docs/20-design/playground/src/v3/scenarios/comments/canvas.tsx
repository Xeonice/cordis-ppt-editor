import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from "react"
import { Check, Link2, MessageSquarePlus, RotateCcw, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  boxStyle, CanvasHint, canvasFocusTarget, ContextMenu, findAnchor, focusBack, HintDivider, HoverBox, ICON, KeyCap, overlayOpen, Popover, POPOVER_SURFACE, PopoverTitle, SelectionBox, TONE_BG,
  useEditor, useInspectorTab, useLayerClose, userHasInteracted, useSceneState, type Box, type InspectorTab, type MenuSpec, type Person,
} from "../../kit"
import { CANVAS_MENU, readOnlyMenu, SHAPE_MENU } from "../slides-selection/menus"
import { Composer } from "./Composer"
import { PAGE_OBJECTS, PAGE_PIN, pinned, resolveReason, U, type Thread } from "./model"
import {
  newId, useAnnounce, useConfirm, useData, useDraft, useDraftDirty, useFlash, useHoverPin, useKeptDrafts, useLocate, usePerms, useSelected, useThreads, useToast, type CommentsData,
  type Draft,
} from "./store"
import { AuthorAvatar } from "./Thread"

/**
 * 画布上的评论（slideOverlay，03-06「画布对应锚点」、03-02 §3.2 评论钉、03-05 评论钉右键）。
 * - 评论钉：第 1 批定稿的样子（24px 身份色、白色首字、左下角尖角指向锚点、2px 白描边，kit CommentPin）；这里补三种态——
 *   选中（强调色外圈，Q3「选中」）、临时（正在撰写的新评论：自己的钉 + 强调色外圈）、聚合（落点几乎重合时合并成深色中性钉「3」，点开选择具体线程）。
 *   已解决的线程不画钉（选中时临时显示）；已脱离锚点、锚点无法解析的没有钉。点钉 = 定位线程（检查器自动切到「评论」页签，01 §2.3 唯一的例外）。
 * - 悬停预览（PRD CO-04「悬停预览」）：钉旁一张小卡（作者 · 时间 · 正文前两行 · 回复数），不可交互、不抢焦点。
 * - 选中线程的锚点：元素画 1px 强调色虚线框（不画手柄，区别于选中对象），文本范围铺强调色淡底；整页不标。
 * - 评论工具（C，工具条「评论」）：画布上悬停的对象出强调色细框（成为元素锚点），点空白处为页级锚点；点下去出现临时钉与浮动撰写框（不切检查器页签；
 *   DS-44 未采纳的备选 alt-tool-tab 用场景参数 toolSwitchesTab 演示「工具按下时切到「评论」页签」，见 ToolTabSync）。
 *   这是新评论唯一的常驻入口（面板里不再常驻底部撰写框，Q2；右键 / ⇧F10 菜单里的「添加评论」是不常驻的第二入口，DS-45）；未采纳的备选 alt-panel-composer 里评论工具只认对象，整页评论在面板底部撰写。
 *   Esc 逐层：先关撰写框（写了内容时不关，免得丢稿；「取消」才放弃）、再退出评论工具。发表或取消后评论工具保持按下（rulings §4.25 DS-44，同 Figma 评论模式，
 *   是图片、表格、图表等插入工具「用后回到选择」的例外）：下一次点画布接着落钉，没有撰写框时按 Esc 或 V 回到「选择」。
 *   键盘等价（KeyboardCompose）：「评论」上按 ↵、或工具开着时焦点在画布上按 ↵ → 当前页放页级临时钉（默认落点不盖住标题与已有的钉，撰写框也不压幻灯片文字行）并打开撰写框；
 *   有选中对象时按 C 或 ↵ → 元素锚点；画布上 ⇧F10 / 菜单键（或幻灯片空白处右键）的菜单里有「添加评论 C」。键盘与菜单打开的撰写框因 Esc /「取消」关闭时焦点回到来源。
 * - 右键评论钉（或焦点在钉上按 ⇧F10 / 菜单键）：菜单贴在钉的右侧展开、不盖住钉（与静态样张同一位置）——解决 · 复制链接 ┊ 删除讨论串…
 *   （只有文档所有者，03-05 §3、50/08 §4）；评审者对他人线程、导入的批注，「解决」不可用并写原因；查看者没有这个菜单。
 */

const PIN = "absolute flex size-6 -translate-y-full items-center justify-center rounded-full rounded-bl-none text-[12px] leading-none font-medium text-white ring-2 ring-white outline-none"
/** 选中 / 临时：白描边外再一圈 2px 强调色（Tailwind 的 ring 与 shadow 叠加） */
const PIN_ON = "z-[12] shadow-[0_0_0_4px_var(--v3-accent)]"

export function Pin({
  person,
  neutral,
  x,
  y,
  dx = 0,
  label,
  selected,
  anchor,
  pulse,
  touch,
  text,
  onClick,
  onKeyDown,
  onEnter,
  onLeave,
}: {
  person: Person
  /** 中性深色（聚合钉、导入批注的作者不是协作者）：--v3-pin-neutral */
  neutral?: boolean
  x: number
  y: number
  /** 小幅偏移（聚合钉展开时，px） */
  dx?: number
  label: string
  selected?: boolean
  anchor?: string
  /** 脉冲一次（定位时；值变一次放一次） */
  pulse?: number
  /** 仅查看形态：点按区扩到 44 */
  touch?: boolean
  /** 钉里的字（缺省是首字；聚合钉是数量） */
  text?: string
  onClick?: () => void
  /** 钉上的按键（临时钉：Tab 进撰写框，见 CommentLayer） */
  onKeyDown?: (e: ReactKeyboardEvent<HTMLButtonElement>) => void
  onEnter?: () => void
  onLeave?: () => void
}) {
  return (
    <button
      type="button"
      data-v3-anchor={anchor}
      aria-label={label}
      onClick={(e: MouseEvent) => {
        e.stopPropagation()
        onClick?.()
      }}
      onKeyDown={onKeyDown}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      className={cn(
        PIN,
        "z-10 focus-visible:shadow-[0_0_0_4px_var(--v3-accent)]",
        // 中性钉用专用变量（v3.css --v3-pin-neutral，与原先借用的工具提示底同值，画面不变）
        neutral ? "bg-(--v3-pin-neutral)" : TONE_BG[person.tone],
        selected && PIN_ON,
        touch && "before:absolute before:-inset-2.5 before:content-['']",
      )}
      style={{ left: dx ? `calc(${x}% + ${dx}px)` : `${x}%`, top: `${y}%` }}
    >
      {text ?? person.name.slice(0, 1)}
      {pulse ? (
        <span
          key={pulse}
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[3px] rounded-full rounded-bl-none border-2 border-(--v3-accent) motion-safe:animate-ping motion-reduce:hidden [animation-fill-mode:forwards]! [animation-iteration-count:2]!"
        />
      ) : null}
    </button>
  )
}

/** 评论工具的光标替身（产品用 CSS 光标；系统光标拍不进截图时的样张替身）：深色气泡 + 白色加号，尖角就是落点 */
function CommentCursor({ x, y }: { x: number; y: number }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="pointer-events-none absolute z-20 -translate-y-full" style={{ left: `${x}%`, top: `${y}%` }}>
      <path d="M1 21V9a8 8 0 0 1 8-8h4a8 8 0 0 1 8 8v4a8 8 0 0 1-8 8Z" className="fill-(--v3-tooltip-bg) stroke-white" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11 6.5v9M6.5 11h9" className="stroke-white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** 悬停预览卡：钉右侧（靠右的钉放左侧），不可交互 */
function HoverCard({ t }: { t: Thread }) {
  const root = t.replies[0]
  if (!root) return null
  const left = t.anchor.x > 60
  const n = t.replies.length - 1
  return (
    <div
      role="tooltip"
      className={cn(POPOVER_SURFACE, "pointer-events-none absolute z-20 w-[240px] p-3")}
      style={left ? { right: `calc(${100 - t.anchor.x}% + 8px)`, top: `calc(${t.anchor.y}% - 24px)` } : { left: `calc(${t.anchor.x}% + 32px)`, top: `calc(${t.anchor.y}% - 24px)` }}
    >
      <div className="flex h-5 items-center gap-2">
        <AuthorAvatar u={root.by} imported={!!t.imported} />
        {/* 作者名中等字重（500，04 §2.8：600 只给节标题），时间 text-2——同线程与回复 */}
        <span className="truncate text-[12px] leading-none font-medium text-(--v3-text)">{root.by.name}</span>
        <span className="shrink-0 text-[12px] leading-none text-(--v3-text-2)">{root.when}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-[12px] leading-[18px] text-(--v3-text)">{root.body}</p>
      <p className="mt-2 text-[12px] leading-4 text-(--v3-text-2)">{n > 0 ? `${n} 条回复 · ` : ""}点按查看</p>
    </div>
  )
}

/**
 * 等浮层关完、交还焦点之后再把焦点交给某个元素（浮层关闭时 Radix / kit 会在下一个任务里把焦点还给锚点或画布，这里排在它们之后）；
 * 再兜一次：那时焦点若落在画布或 body 上（锚点已随之卸载），再拉回来（用户已经点到别处时不动）
 */
function focusAfterLayer(find: () => HTMLElement | null | undefined) {
  const go = () => find()?.focus({ preventScroll: true })
  window.setTimeout(() => requestAnimationFrame(go), 30)
  window.setTimeout(() => {
    const a = document.activeElement
    if (!a || a === document.body || a.matches('[data-v3-anchor="stage"], [data-v3-anchor="canvas"]')) go()
  }, 160)
}

const pinEl = (id: string) => document.querySelector<HTMLElement>(`[data-v3-anchor="comments.pin-${CSS.escape(id)}"]`)

/**
 * 聚合钉的线程列表（点聚合钉打开）：逐条头像 · 姓名 / 正文预览，点一条即定位；聚合钉随之展开成单独的钉，焦点交给被定位的那一枚（同桌面点钉：焦点留在钉上）。
 * 正文预览最多两行（line-clamp-2，超出才省略；与钉悬停卡、已解决摘要同一口径，Q7 不逐条截成一行省略号），完整内容在线程里；03-06 对聚合钉的列表只写了「点击展开选择具体线程」，没有相反规定。
 * 作者名中等字重（500），同线程与回复。
 */
function ClusterList({ items, onPick }: { items: Thread[]; onPick: (id: string) => void }) {
  const close = useLayerClose()
  return (
    <div className="flex flex-col">
      <PopoverTitle className="px-2 pt-1.5 pb-2">{items.length} 条评论</PopoverTitle>
      {items.map((t) => {
        const r = t.replies[0]
        if (!r) return null
        return (
          <button
            key={t.id}
            type="button"
            data-cluster-item={t.id}
            onClick={() => {
              close()
              onPick(t.id)
              focusAfterLayer(() => pinEl(t.id))
            }}
            className="flex min-w-0 items-start gap-2 rounded-[4px] px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-(--v3-panel-2)"
          >
            {/* 头像首字不进按钮的读屏名（否则读成「王 王小明 …」） */}
            <span aria-hidden="true" className="flex shrink-0">
              <AuthorAvatar u={r.by} imported={!!t.imported} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex h-5 items-center leading-none font-medium text-(--v3-text)">{r.by.name}</span>
              {/* text-pretty：折到第二行时不留一个字的尾行（只调最后几行的断点，长正文被截成两行时不影响可见的两行） */}
              <span data-cluster-preview="" className="line-clamp-2 leading-[18px] break-words text-pretty text-(--v3-text-2)">
                {r.body}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * 正在撰写的新评论：浮动撰写框（锚在临时钉上；有内容时点外面不关，免得丢稿；Esc 关闭）。
 * 工具（DS-44，同 Figma 评论模式）：发表或取消后只收起撰写框，评论工具保持按下——这是插入工具「用后回到选择」（03-04「按下与回落」）的例外，
 * 评审时常连续落多条：下一次点画布接着落钉；没有撰写框时按 Esc 或 V 才回到「选择」（Esc 逐层：先关撰写框、再退工具）。指针与键盘（KeyboardCompose、GridCompose、右键「添加评论」）都走这里，口径一致。
 * 焦点（07 §2「关闭时焦点精确归还到触发元素」）：键盘与右键菜单打开的撰写框记着来源（draft.from：工具条「评论」、画布、被右键的对象），
 * 因 Esc /「取消」关闭时先把焦点交回来源、再收起；指针在画布上点出来的（没有来源）、以及发送之后，照旧交给画布。都是先交出焦点再卸载，不经过 body。
 * 换页（rulings §4.25 DS-65、TB-84：进网格视图同此）：写了内容的撰写框随旧页收起、草稿按页留在内存（写的字随输入写回场景仓的 draft.text，DraftKeeper 收起与恢复）；
 * 回到那一页时临时钉与撰写框原样出现、内容与 @ 提及都在，不抢焦点（draft.restored，TB-79）——点临时钉或在钉上按 Tab 进撰写框。
 * 收起时焦点若还在框里（键盘翻页、评审条「上一处 / 下一处」），先交给画布再卸载（TB-79：不经过 body）；焦点在用户点的缩略图上则不动
 */
function DraftComposer({ draft }: { draft: Draft }) {
  const [, setDraft] = useDraft()
  const [, setDirty] = useDraftDirty()
  const [, setThreads] = useThreads()
  const [, setFlash] = useFlash()
  const announce = useAnnounce()
  const [text, setTextState] = useState(draft.text ?? "")
  // 写的字同时写回场景仓的草稿（DS-65）：撰写框随旧页收起后 DraftKeeper 按 draft.text 判断有没有内容、留下原文，回到那一页时原样恢复
  const setText = (v: string) => {
    setTextState(v)
    setDraft((d) => (d ? { ...d, text: v } : d))
  }
  // 随旧页（或单页视图）收起：在 DOM 移除之前（布局阶段的清理）把框里的焦点交给画布，不经过 body（TB-79）；Esc /「取消」/ 发送时已先交出焦点，这里不会再动
  useLayoutEffect(
    () => () => {
      const box = document.querySelector('[role="dialog"][aria-label="新评论"]')
      if (box?.contains(document.activeElement)) canvasFocusTarget()?.focus({ preventScroll: true })
    },
    [],
  )
  /** 正在因 Esc /「取消」退回来源：焦点移出撰写框时不再按「写了内容」挡住收起 */
  const leaving = useRef(false)
  // 写没写字告诉点选层（只在有无之间变化时写场景仓，不每个字都写）；收起时清掉
  const dirty = !!text.trim()
  useEffect(() => {
    setDirty(dirty)
  }, [dirty, setDirty])
  useEffect(() => () => setDirty(false), [setDirty])
  // 换到新落点（撰写框空着时点画布别处，CaptureLayer）：同一个撰写框跟着临时钉移过去（弹层锚在钉上，钉一动就跟着重新定位），焦点放回文本框。
  // 不按落点重新挂载：这一下点按被画布拦下，Radix 不当作「点了外面」、不关旧弹层；重挂时旧弹层卸载后才交还焦点（到钉或画布上），
  // 会把刚挂上的新撰写框当作「焦点移出」关掉
  const at = `${draft.page}:${draft.x},${draft.y}`
  const placedAt = useRef(at)
  useEffect(() => {
    if (placedAt.current === at) return
    placedAt.current = at
    if (userHasInteracted()) document.querySelector<HTMLElement>('[role="dialog"][aria-label="新评论"] textarea')?.focus({ preventScroll: true })
  }, [at])
  /** 只收起撰写框：评论工具保持按下（见上） */
  const close = () => setDraft(null)
  /** 先把焦点交出去、再收起（撰写框卸载时焦点不经过 body）：Esc /「取消」交回来源（指针点出来的没有来源，交给画布），发送后交给画布 */
  const handOff = (to: string) => {
    leaving.current = true
    focusBack(findAnchor(document, to))
  }
  const toSource = () => handOff(draft.from ?? "stage")
  return (
    <Popover
      anchor={draft.anchor.kind === "text" && draft.anchor.box ? "comments.draft-range" : "comments.draft-pin"}
      open
      onOpenChange={(v) => !v && close()}
      label="新评论"
      side={draft.anchor.kind === "text" ? "bottom" : (draft.side ?? (draft.x > 60 ? "left" : "right"))}
      align={draft.anchor.kind === "text" ? "start" : (draft.align ?? "start")}
      sideOffset={draft.anchor.kind === "text" ? 8 : 10}
      alignOffset={draft.anchor.kind === "text" ? 0 : -6}
      snap={false}
      // 换页回来恢复的撰写框不是用户此刻打开的：挂上时不把焦点移进来（TB-79）
      autoFocus={!draft.restored}
      onInteractOutside={(e) => {
        if (text.trim() && !leaving.current) e.preventDefault()
      }}
      // @ 候选开着时 Esc 只关候选（03-06），撰写框留着：候选在文本框自己的按键处理里关；
      // 写了内容时 Esc 也不关（与「写了内容时点外面不关」同一保护，免得丢稿），「取消」才放弃
      onEscapeKeyDown={(e) => {
        if (document.querySelector('[role="listbox"][aria-label="提及协作者"]') || text.trim()) {
          e.preventDefault()
          return
        }
        toSource()
      }}
      className="w-[288px] p-3"
    >
      <p className="mb-2 flex h-4 min-w-0 items-center text-[12px] leading-4 text-(--v3-text-2)">
        <span className="truncate">评论 · {draft.anchor.label}</span>
      </p>
      <Composer
        variant="canvas"
        value={text}
        onChange={setText}
        autoFocus={!draft.restored}
        listSide="bottom"
        mentionOpen={draft.mention}
        offline={draft.offline}
        placeholder="写评论，输入 @ 提及协作者"
        aria={`添加评论（${draft.anchor.label}）`}
        onCancel={() => {
          toSource()
          close()
        }}
        onSubmit={(v) => {
          const id = newId()
          const t: Thread = {
            id,
            page: draft.page,
            anchor: { kind: draft.anchor.kind, label: draft.anchor.label, x: draft.x, y: draft.y, box: draft.anchor.box },
            createdBy: U.zhou.id,
            activity: 0,
            replies: [{ id: newId(), by: U.zhou, when: "刚刚", body: v }],
          }
          setThreads((ts) => [t, ...ts])
          setFlash({ id, n: Date.now() })
          handOff("stage")
          close()
          announce("已发表评论")
        }}
      />
    </Popover>
  )
}

/**
 * 评论工具的点选层：悬停对象出细框，点下去放临时钉（对象上 = 元素锚点，空白处 = 页级锚点；objectsOnly 备选里空白处不落钉）。
 * 发表后工具保持按下，点选层一直在：撰写框空着时点别处 = 换到新落点（同一个撰写框跟着钉移过去，见 DraftComposer）；写了字时点别处不动（不丢稿，useDraftDirty）
 */
function CaptureLayer({ page, hoverAt, objectsOnly }: { page: number; hoverAt?: { x: number; y: number }; objectsOnly?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useDraft()
  const [dirty] = useDraftDirty()
  const [hover, setHover] = useState<{ x: number; y: number } | null>(hoverAt ?? null)
  const objs = PAGE_OBJECTS[page] ?? []
  const pt = (e: MouseEvent) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return null
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }
  }
  const hit = (p: { x: number; y: number }) => [...objs].reverse().find((o) => p.x >= o.box.x && p.x <= o.box.x + o.box.w && p.y >= o.box.y && p.y <= o.box.y + o.box.h)
  const obj = hover ? hit(hover) : undefined
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="absolute inset-0 z-[5] cursor-crosshair"
      onMouseMove={(e) => setHover(pt(e))}
      onMouseLeave={() => setHover(null)}
      onClick={(e) => {
        e.stopPropagation()
        if (dirty) return
        const p = pt(e)
        if (!p) return
        const o = hit(p)
        if (!o && objectsOnly) return
        setDraft({ page, x: p.x, y: p.y, anchor: o ? { kind: "element", label: o.label, box: o.box } : { kind: "page", label: "整页" } })
      }}
    >
      {!draft && obj && <HoverBox box={obj.box} />}
      {hoverAt && !draft && <CommentCursor x={hoverAt.x} y={hoverAt.y} />}
    </div>
  )
}

/**
 * 文字编辑态（compose-text：编辑文字时对选中的文字发起评论，data.textEdit）：文本框 1px 强调色描边（无手柄，同 03-16 / 第 1 批 text-edit 的编辑描边）+ 选区选中色。
 * DS-44 写明的例外：撰写时工具仍是「选择」，发表或取消后回到文字编辑——撰写框收起后描边与选区都还在（选中种类仍是 text、检查器仍是「文本」），点空白退出编辑后随之消失。
 * 撰写框开着时选区由撰写框的锚点（AnchorMark draft，同一个选中色）画，这里不再叠一层
 */
function TextEditMarks({ edit, draftBox }: { edit: NonNullable<CommentsData["textEdit"]>; draftBox?: Box }) {
  const same = (a?: Box, b?: Box) => !!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h
  // 编辑描边比文字外扩一圈（同第 1 批 text-edit 的 EditFrame：左右各 1.2cqw、上下各 0.8cqw；这里按幻灯片宽高的百分比换算，16:9）
  const b = edit.box
  const dy = (0.8 * 16) / 9
  const frame: Box = { x: b.x - 1.2, y: b.y - dy, w: b.w + 2.4, h: b.h + 2 * dy }
  return (
    <>
      <div aria-hidden="true" data-comments-text-edit="" className="pointer-events-none absolute border border-(--v3-accent)" style={boxStyle(frame)} />
      {edit.sel && !same(edit.sel, draftBox) && <div aria-hidden="true" data-comments-text-sel="" className="pointer-events-none absolute bg-(--v3-sel)" style={boxStyle(edit.sel)} />}
    </>
  )
}

/** 选中线程（或正在撰写）的锚点：元素虚线框、文本范围淡底（正在撰写的文本范围带锚点名，浮动撰写框贴在它下方，不盖住这一行） */
function AnchorMark({ kind, box, draft }: { kind: string; box: Box; draft?: boolean }) {
  if (kind === "text")
    return <div aria-hidden="true" data-v3-anchor={draft ? "comments.draft-range" : undefined} className={cn("pointer-events-none absolute", draft ? "bg-(--v3-sel)" : "bg-(--v3-accent-soft)")} style={boxStyle(box)} />
  return <SelectionBox box={box} handles="none" dashed />
}

/** 落点几乎重合的钉合并成一组（03-06「堆叠过密时合并为聚合图钉」）；选中的那一组按小幅偏移展开 */
function clusterize(list: Thread[]) {
  const groups: { id: string; items: Thread[]; x: number; y: number }[] = []
  for (const t of list) {
    const g = groups.find((x) => Math.abs(x.x - t.anchor.x) < 2.6 && Math.abs(x.y - t.anchor.y) < 4.2)
    if (g) g.items.push(t)
    else groups.push({ id: t.id, items: [t], x: t.anchor.x, y: t.anchor.y })
  }
  return groups
}

/**
 * 评论钉右键：解决 / 重新打开 · 复制链接 ┊ 删除讨论串…（文档所有者）。
 * 在钉上右键、或焦点在钉上按 ⇧F10 / 菜单键（与缩略图右键同一套写法），菜单都贴在这枚钉的右侧展开（锚在钉上，不在指针处，所以不盖住钉）；关闭后焦点回到钉。
 */
function PinMenu() {
  const d = useData()
  const perms = usePerms()
  const [threads, setThreads] = useThreads()
  const [, setToast] = useToast()
  const [, setConfirm] = useConfirm()
  const [sel, setSel] = useSelected()
  // 打开在哪一枚钉上（key 每次加一：同一枚钉再右键也重新定位）；状态 data.pinMenu 一出现就打开
  const [at, setAt] = useState<{ id: string; key: number } | null>(d.pinMenu ? { id: d.pinMenu, key: 0 } : null)
  useEffect(() => {
    const pinOf = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>('[data-v3-anchor^="comments.pin-"]') : null)
    const show = (el: HTMLElement) => {
      const id = (el.dataset.v3Anchor ?? "").replace("comments.pin-", "")
      if (id) setAt((cur) => ({ id, key: (cur?.key ?? 0) + 1 }))
    }
    const onContextMenu = (e: globalThis.MouseEvent) => {
      const el = pinOf(e.target)
      if (!el || e.defaultPrevented) return
      e.preventDefault()
      show(el)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !(e.key === "ContextMenu" || (e.shiftKey && e.key === "F10"))) return
      const el = pinOf(document.activeElement)
      if (!el) return
      e.preventDefault()
      show(el)
    }
    document.addEventListener("contextmenu", onContextMenu)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("contextmenu", onContextMenu)
      document.removeEventListener("keydown", onKey)
    }
  }, [])
  if (!perms.comment || !at) return null
  const t = threads.find((x) => x.id === at.id)
  const canResolve = t ? perms.resolve(t) : false
  const items: MenuSpec[] = t
    ? [
        {
          id: "resolve",
          label: t.resolved ? "重新打开" : "解决",
          icon: t.resolved ? <RotateCcw {...ICON} /> : <Check {...ICON} />,
          disabled: !canResolve,
          reason: canResolve ? undefined : resolveReason(t),
          onSelect: () => {
            setThreads(threads.map((x) => (x.id === t.id ? { ...x, resolved: x.resolved ? undefined : { by: U.zhou, when: "刚刚" } } : x)))
            if (!t.resolved) {
              if (sel === t.id) setSel(null)
              setToast({ text: "已解决", action: "重新打开", reopen: t.id })
            }
          },
        },
        { id: "link", label: "复制链接", icon: <Link2 {...ICON} />, onSelect: () => setToast({ text: "已复制评论链接" }) },
        ...(perms.deleteThread
          ? ([
              { type: "separator" },
              { id: "delete", label: "删除讨论串…", icon: <Trash2 {...ICON} />, danger: true, onSelect: () => setConfirm({ kind: "thread", threadId: t.id, returnTo: `comments.pin-${t.id}` }) },
            ] as MenuSpec[])
          : []),
      ]
    : []
  return (
    <ContextMenu
      key={at.key}
      label="评论操作"
      items={items}
      target={false}
      at={{ anchor: `comments.pin-${at.id}`, x: 1.1, y: 0.7 }}
      onOpenChange={(v) => !v && setAt(null)}
    />
  )
}

/* ------------------------------------------------------------------ 键盘新建评论（评论工具的键盘等价） */

/**
 * 浮动撰写框的尺寸（w-[288px] p-3），挑默认落点时用：高度由固定的几行组成——上下内边距 12 × 2、边 1 × 2、锚点说明一行 16 + 间距 8、
 * 三行文本框 3 × 18 + 10、间距 8 + 底部一行 28 = 150（实测同），不随内容变化
 */
const COMPOSER_W = 288
const COMPOSER_H = 150
/** 临时钉 24 × 24，钉尖（左下角）就是落点 */
const PIN_SIZE = 24
/** 撰写框与幻灯片文字行至少隔开 8（撰写框下沿 ≤ 下一行文字顶 − 8，左右与上方同此） */
const TEXT_GAP = 8
/** 钉、撰写框与已有的钉之间，钉与文字之间留 4 */
const PIN_GAP = 4

type PxRect = { l: number; t: number; r: number; b: number }
const overlaps = (a: PxRect, b: PxRect) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b
const grow = (r: PxRect, d: number): PxRect => ({ l: r.l - d, t: r.t - d, r: r.r + d, b: r.b + d })

/** 撰写框相对临时钉的摆法（与 DraftComposer 的 Popover 同一组参数：sideOffset 10、alignOffset −6） */
type Placement = { side: "right" | "left" | "top"; align: "start" | "end" }
const PLACEMENTS: Placement[] = [
  { side: "right", align: "start" },
  { side: "right", align: "end" },
  { side: "left", align: "start" },
  { side: "left", align: "end" },
  { side: "top", align: "start" },
]

/** 钉尖落在 (px, py) 时撰写框的矩形（幻灯片坐标 px）：右 / 左侧上沿对齐时比钉顶高 6，下沿对齐时比钉底低 6；上方时左缘比钉左 6 */
function composerRect(px: number, py: number, p: Placement): PxRect {
  const pinTop = py - PIN_SIZE
  if (p.side === "top") return { l: px - 6, t: pinTop - 10 - COMPOSER_H, r: px - 6 + COMPOSER_W, b: pinTop - 10 }
  const l = p.side === "right" ? px + PIN_SIZE + 10 : px - 10 - COMPOSER_W
  const t = p.align === "start" ? pinTop - 6 : py + 6 - COMPOSER_H
  return { l, t, r: l + COMPOSER_W, b: t + COMPOSER_H }
}

/**
 * 当前页幻灯片上的文字行（幻灯片坐标 px）：读画布上这一页的真实渲染——HTML 与 SVG 里的每个文字节点、每一行一个矩形（Range.getClientRects）。
 * 只读幻灯片内容本身（SlideFrame，.v3-slide），不含叠加层（评论钉、选中框）。换页、换文档、换视口都按当下的版面算，不按页号写死。
 */
function slideTextLines(frame: Element, origin: DOMRect): PxRect[] {
  const out: PxRect[] = []
  const walker = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim()) continue
    range.selectNodeContents(n)
    for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) out.push({ l: r.left - origin.left, t: r.top - origin.top, r: r.right - origin.left, b: r.bottom - origin.top })
  }
  return out
}

export interface PagePinSpot {
  x: number
  y: number
  side: Placement["side"]
  align: Placement["align"]
}

/**
 * 页级评论的默认落点（键盘新建，幻灯片百分比 + 撰写框的摆法）：从「标题右侧的上沿空白」起（标题右缘 + 4%，最多 60%；高 8.5%），
 * 按离它的远近逐个试钉的位置（4px 一档）与撰写框的摆法（右侧上沿对齐 → 右侧下沿对齐 → 左侧 → 钉的上方），挑第一个同时满足的：
 * - 临时钉在幻灯片内，不盖标题、已有的评论钉与文字；
 * - 撰写框不盖标题与已有的钉，离每一行幻灯片文字至少 8（撰写框下沿 ≤ 下一行文字顶 − 8）；
 * - 撰写框先只在幻灯片里找；幻灯片里放不下时（如第 4 页标题与说明文字之间不够 152 高）才允许伸出幻灯片，挑伸出最少的，且留在画布内（离边 8，浮层不会翻转或平移）。
 * 文字与对象的几何读当下的渲染（slideTextLines）与模型里的标题框（PAGE_OBJECTS），按页面内容通用计算，不按页号写死。
 */
export function defaultPagePin(page: number, pins: { x: number; y: number }[]): PagePinSpot {
  const slide = document.querySelector<HTMLElement>('[data-v3-anchor="stage"] [data-v3-anchor="slide"]')
  const stage = slide?.closest<HTMLElement>('[data-v3-anchor="stage"]')
  const title = (PAGE_OBJECTS[page] ?? []).find((o) => o.label === "标题 1")?.box
  const x0 = title ? Math.min(title.x + title.w + 4, 60) : 30
  const y0 = 8.5
  if (!slide || !stage) return { x: x0, y: y0, side: "right", align: "start" }
  const box = slide.getBoundingClientRect()
  const W = box.width
  const H = box.height
  const s = stage.getBoundingClientRect()
  // 撰写框能去的范围：画布（舞台）以内、离边 8（与 Popover 的 collisionPadding 一致，放得下就不会被翻转或平移）
  const bounds: PxRect = { l: s.left - box.left + 8, t: s.top - box.top + 8, r: s.right - box.left - 8, b: s.bottom - box.top - 8 }
  const frame = slide.querySelector(".v3-slide")
  const lines = frame ? slideTextLines(frame, box) : []
  const titleRect: PxRect | null = title ? { l: (title.x / 100) * W, t: (title.y / 100) * H, r: ((title.x + title.w) / 100) * W, b: ((title.y + title.h) / 100) * H } : null
  const pinRects = pins.map((p) => grow({ l: (p.x / 100) * W, t: (p.y / 100) * H - PIN_SIZE, r: (p.x / 100) * W + PIN_SIZE, b: (p.y / 100) * H }, PIN_GAP))
  const hard = [...pinRects, ...(titleRect ? [titleRect] : [])]
  const forPin = [...hard, ...lines.map((r) => grow(r, PIN_GAP))]
  const forComposer = [...hard, ...lines.map((r) => grow(r, TEXT_GAP))]
  const px0 = (x0 / 100) * W
  const py0 = (y0 / 100) * H
  // 候选钉位：以起点为原点、4px 一档铺满幻灯片（钉整个在幻灯片里），按离起点的远近排好；
  // 每一列另加几档「撰写框正好贴住幻灯片上沿 / 下沿」的高度（各种摆法各一档），空白只比撰写框高一点点时也放得进幻灯片
  const flush = [PIN_SIZE + 6, COMPOSER_H - 6, PIN_SIZE + 10 + COMPOSER_H, H - COMPOSER_H + PIN_SIZE + 6, H - 6]
  const ys: number[] = []
  for (let py = py0 - Math.floor((py0 - PIN_SIZE) / 4) * 4; py <= H; py += 4) ys.push(py)
  for (const py of flush) if (py >= PIN_SIZE && py <= H) ys.push(py)
  const cands: { px: number; py: number; d: number }[] = []
  for (let px = px0 - Math.floor(px0 / 4) * 4; px <= W - PIN_SIZE; px += 4) for (const py of ys) cands.push({ px, py, d: Math.hypot(px - px0, py - py0) })
  cands.sort((a, b) => a.d - b.d)
  const pinOk = (px: number, py: number) => {
    const pin = { l: px, t: py - PIN_SIZE, r: px + PIN_SIZE, b: py }
    return !forPin.some((a) => overlaps(a, pin))
  }
  const compOk = (c: PxRect) => c.l >= bounds.l && c.r <= bounds.r && c.t >= bounds.t && c.b <= bounds.b && !forComposer.some((a) => overlaps(a, c))
  const spot = (px: number, py: number, p: Placement): PagePinSpot => ({ x: (px / W) * 100, y: (py / H) * 100, side: p.side, align: p.align })
  // 先只在幻灯片里找：离起点最近的那个
  for (const c of cands) {
    if (!pinOk(c.px, c.py)) continue
    for (const p of PLACEMENTS) {
      const r = composerRect(c.px, c.py, p)
      if (r.l >= 0 && r.t >= 0 && r.r <= W && r.b <= H && compOk(r)) return spot(c.px, c.py, p)
    }
  }
  // 幻灯片里放不下：允许伸出幻灯片（仍在画布内），伸出最少的优先，其次离起点近
  let best: { cost: number; at: PagePinSpot } | null = null
  for (const c of cands) {
    let pin: boolean | null = null
    for (const p of PLACEMENTS) {
      const r = composerRect(c.px, c.py, p)
      const out = Math.max(0, -r.l) + Math.max(0, -r.t) + Math.max(0, r.r - W) + Math.max(0, r.b - H)
      const cost = out * 1000 + c.d
      if (best && cost >= best.cost) continue
      if (!compOk(r)) continue
      pin ??= pinOk(c.px, c.py)
      if (!pin) break
      best = { cost, at: spot(c.px, c.py, p) }
    }
  }
  return best?.at ?? { x: x0, y: y0, side: "right", align: "start" }
}

/** 当前选中的对象（元素锚点）：样张里能选中的只有第 2 页的要点卡（底座 Stage 的 selection = shape） */
const SELECTION_OBJECT: Record<string, string> = { shape: "要点卡" }
function selectedObject(page: number, selection: string) {
  const label = SELECTION_OBJECT[selection]
  return label ? (PAGE_OBJECTS[page] ?? []).find((o) => o.label === label) : undefined
}

/**
 * 「添加评论」：有选中对象时落元素锚点（钉在对象右上角），否则在当前页放页级临时钉（默认落点与撰写框的摆法见 defaultPagePin）；
 * 打开浮动撰写框、焦点进文本框（撰写框自己接）。from：打开它的来源（锚点名），撰写框因 Esc /「取消」关闭时焦点交回这里
 */
function useComposeHere() {
  const ctx = useEditor()
  const [threads] = useThreads()
  const [sel] = useSelected()
  const [, setDraft] = useDraft()
  const live = useRef({ ctx, threads, sel })
  live.current = { ctx, threads, sel }
  return (from?: string) => {
    const { ctx: c, threads: ts, sel: s } = live.current
    if (c.view !== "single") return
    const page = c.slide
    const obj = selectedObject(page, c.selection)
    if (obj) {
      setDraft({ page, x: obj.box.x + obj.box.w, y: obj.box.y, anchor: { kind: "element", label: obj.label, box: obj.box }, from })
      return
    }
    if ((c.data as { panelComposer?: boolean }).panelComposer) {
      // 备选 alt-panel-composer：评论工具只认对象，页级评论在面板底部撰写——焦点交给那个撰写框
      document.querySelector<HTMLElement>('textarea[aria-label^="添加评论（第"]')?.focus({ preventScroll: true })
      return
    }
    const at = defaultPagePin(page, pinned(ts, page, s).map((t) => t.anchor))
    setDraft({ page, x: at.x, y: at.y, side: at.side, align: at.align, anchor: { kind: "page", label: "整页" }, from })
  }
}

/**
 * 网格视图里在工具条「评论」上按的 ↵：记下来源（tool-comment），单页画布挂上后由 KeyboardCompose 接着放临时钉、打开撰写框（见 GridCompose）。
 * 场景状态，换状态即复位
 */
const usePendingCompose = () => useSceneState<string | null>("comments.compose-on-single", null)

/**
 * 网格视图里的键盘新建评论：焦点在工具条「评论」上按 ↵，按钮自己的点按带着评论工具回单页（底座：网格里选创建工具 = 回单页）；
 * 这里记下来源，单页画布挂上后 KeyboardCompose 接着放页级临时钉、打开撰写框——一次 ↵ 就到（同「文件 › 保真报告」在网格里先回单页再打开）；
 * 撰写框因 Esc /「取消」关闭时焦点回到「评论」。画布（连同 KeyboardCompose）只在单页里有，这一段挂在画布列的叠加层上（两种视图都在）。
 */
export function GridCompose() {
  const ctx = useEditor()
  const perms = usePerms()
  const [, setPending] = usePendingCompose()
  const live = useRef({ ctx, perms })
  live.current = { ctx, perms }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { ctx: c, perms: p } = live.current
      if (e.key !== "Enter" || e.shiftKey || e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || !p.comment || c.view !== "grid") return
      const btn = document.activeElement?.closest('[data-v3-anchor="tool-comment"]')
      if (!btn || btn.getAttribute("aria-disabled") === "true") return
      setPending("tool-comment")
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [])
  return null
}

/** 打开撰写框的来源：焦点所在元素最近的锚点名（工具条「评论」tool-comment、画布 stage…）；焦点在 body 或画布列上时记作画布 */
function sourceOf(el: Element | null): string {
  const name = el && el !== document.body ? el.closest<HTMLElement>("[data-v3-anchor]")?.dataset.v3Anchor : undefined
  return !name || name === "canvas" ? "stage" : name
}

/**
 * 键盘新建评论（07 §1.2a「插入工具按 Enter 插到视口中心」、PRD ED-29 全键盘编辑；推荐方案下新评论的常驻入口只有评论工具，指针点选之外要有键盘等价）：
 * - 焦点在工具条「评论」上按 ↵（按钮自己的点按先打开评论工具；网格视图里先带着工具回单页，GridCompose 记下来源、画布挂上后接着放），或评论工具已开、焦点在画布上按 ↵：在当前页放页级临时钉、打开浮动撰写框（默认落点不盖住标题与已有的钉，撰写框离幻灯片文字行至少 8，见 defaultPagePin）；
 * - 有选中对象时按 C（底座单键先打开评论工具）或 ↵：落元素锚点；
 * - 焦点在画布上按 ⇧F10 / 菜单键（或在幻灯片空白处右键）：画布菜单（03-05 画布空白处同一份条目；选中了对象时是该对象的菜单）里有「添加评论 C」。
 * 查看者没有这些（没有评论权限）；正在撰写时不重开。每条路径都记下来源（「评论」、画布、被右键的对象），撰写框因 Esc /「取消」关闭时焦点交回来源（发送后照旧交给画布）。
 */
function KeyboardCompose() {
  const ctx = useEditor()
  const perms = usePerms()
  const [draft] = useDraft()
  const compose = useComposeHere()
  // 菜单打开时记下来源（画布、被右键的对象）：从菜单「添加评论」打开的撰写框因 Esc /「取消」关闭时焦点交回这里
  const [menu, setMenu] = useState<{ key: number; x: number; y: number; from: string } | null>(null)
  const live = useRef({ ctx, perms, draft, compose })
  live.current = { ctx, perms, draft, compose }

  // 网格视图里在「评论」上按的 ↵（GridCompose 记下来源）：画布随单页挂上后接着放临时钉、打开撰写框（等这一轮提交完，工具已是「评论」）
  // （清掉记号会让这个 effect 再跑一次，所以不在清理函数里取消这次放钉）
  const [pending, setPending] = usePendingCompose()
  useEffect(() => {
    if (!pending) return
    setPending(null)
    window.setTimeout(() => {
      const now = live.current
      if (now.ctx.view === "single" && now.ctx.tool === "comment" && !now.draft) now.compose(pending)
    }, 0)
  }, [pending])

  useEffect(() => {
    const onStage = (a: Element | null) => !a || a === document.body || a.matches('[data-v3-anchor="stage"], [data-v3-anchor="canvas"]')
    const inField = (a: Element | null) => !!a && ((a as HTMLElement).isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))
    const inLayer = (a: Element | null) => !!a?.closest('[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"], [data-radix-popper-content-wrapper]')
    const onKey = (e: KeyboardEvent) => {
      const { ctx: c, perms: p, draft: d } = live.current
      if (e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || !p.comment || c.view !== "single") return
      const a = document.activeElement
      if (e.key === "Enter" && !e.shiftKey) {
        const btn = a?.closest('[data-v3-anchor="tool-comment"]')
        if (btn) {
          if (btn.getAttribute("aria-disabled") === "true") return
          // 按钮自己的点按（Enter 触发 click）先把工具设为「评论」，下一个任务再放临时钉；Esc /「取消」后焦点回到「评论」
          window.setTimeout(() => {
            const now = live.current
            if (now.ctx.tool === "comment" && !now.draft) now.compose("tool-comment")
          }, 0)
          return
        }
        if (c.tool === "comment" && !d && onStage(a)) {
          e.preventDefault()
          live.current.compose(sourceOf(a))
        }
        return
      }
      if (e.key.toLowerCase() === "c" && !e.shiftKey) {
        // 底座的单键 C 先打开评论工具（同一条件：焦点在画布列、不在输入框与浮层里）；有选中对象时接着落元素锚点
        if (d || inField(a) || inLayer(a) || !(onStage(a) || a?.closest('[data-v3-anchor="canvas"]')) || !selectedObject(c.slide, c.selection)) return
        const from = sourceOf(a)
        window.setTimeout(() => {
          const now = live.current
          if (now.ctx.tool === "comment" && !now.draft) now.compose(from)
        }, 0)
        return
      }
      if ((e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) && onStage(a) && !inLayer(a)) {
        e.preventDefault()
        const from = sourceOf(a)
        setMenu((m) => ({ key: (m?.key ?? 0) + 1, x: 0.5, y: 0.4, from }))
      }
    }
    // 幻灯片空白处右键：同一份画布菜单（评论钉、浮层上的右键不在这里）
    const onContextMenu = (e: globalThis.MouseEvent) => {
      const { ctx: c, perms: p } = live.current
      if (e.defaultPrevented || !p.comment || c.view !== "single") return
      const t = e.target instanceof Element ? e.target : null
      const slide = t?.closest<HTMLElement>('[data-v3-anchor="stage"] [data-v3-anchor="slide"]')
      if (!slide || t?.closest('[data-v3-anchor^="comments."], [data-radix-popper-content-wrapper]')) return
      e.preventDefault()
      // 右键在对象上（底座第 2 页的要点卡）：先选中它，菜单是这个对象的（03-05「形状」，其中有「添加评论」）
      if (t?.closest('button[aria-label="选择要点卡"]')) c.setSelection("shape")
      const r = slide.getBoundingClientRect()
      // 来源是被右键的对象：可聚焦的对象交还给它；画布上的对象（选中后点选区随之换成选中框）与空白处交给画布（kit focusBack）
      const from = sourceOf(t)
      setMenu((m) => ({ key: (m?.key ?? 0) + 1, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, from }))
    }
    document.addEventListener("keydown", onKey, true)
    document.addEventListener("contextmenu", onContextMenu)
    return () => {
      document.removeEventListener("keydown", onKey, true)
      document.removeEventListener("contextmenu", onContextMenu)
    }
  }, [])

  if (!menu || !perms.comment) return null
  const comment: MenuSpec = {
    id: "comment",
    label: "添加评论",
    icon: <MessageSquarePlus {...ICON} />,
    kbd: "C",
    onSelect: () => {
      ctx.setTool("comment")
      // 等菜单关完再放临时钉：撰写框挂上后自己把焦点移进文本框（菜单关闭时见焦点已被接走就不再抢回）
      const from = menu.from
      window.setTimeout(() => live.current.compose(from), 0)
    },
  }
  const obj = selectedObject(ctx.slide, ctx.selection)
  const wire = (items: MenuSpec[]): MenuSpec[] => items.map((it) => (it.type === undefined || it.type === "item" ? (it.id === "comment" ? comment : it) : it))
  // 画布空白处：03-05 同一份条目（slides-selection/menus.tsx CANVAS_MENU，「添加评论 C」单独一组排在插件分组之前，DS-44），接上这里的「添加评论」
  const base = obj ? wire(SHAPE_MENU) : wire(CANVAS_MENU)
  const items = ctx.mode === "review" ? readOnlyMenu(base, ["copy", "select-all", "grid-guides", "comment"], "评审模式：编辑类命令需要编辑权限") : base
  return <ContextMenu key={menu.key} label={obj ? obj.label : "画布"} items={items} target={false} at={{ anchor: "slide", x: menu.x, y: menu.y }} onOpenChange={(v) => !v && setMenu(null)} />
}

/** 幻灯片叠加层：评论钉、聚合钉、悬停卡、选中线程的锚点、评论工具与临时钉 */
export function CommentLayer({ touch, onPinTap }: { touch?: boolean; onPinTap?: (id: string) => void }) {
  const ctx = useEditor()
  const d = useData() as ReturnType<typeof useData> & { toolHover?: { x: number; y: number }; altCompose?: Draft }
  const [threads] = useThreads()
  const [sel] = useSelected()
  const [hover, setHover] = useHoverPin()
  const [draft] = useDraft()
  const [flash] = useFlash()
  const [pageDraft] = useSceneState<boolean>("comments.pageDraft", !!d.composer?.focused)
  const [cluster, setCluster] = useSceneState<string | null>("comments.cluster", d.clusterOpen ?? null)
  const locate = useLocate()
  const page = ctx.slide
  const tool = ctx.tool === "comment"

  // 换页时别的页上的临时钉与撰写框随旧页收起：写了内容的草稿按页留在内存、回来时恢复，空的放弃（DS-65，见 DraftKeeper；原「换页即丢弃」作废）

  // 评论工具：Esc 退出（撰写框、菜单开着时先交给它们）
  useEffect(() => {
    if (!tool || draft) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.isComposing || e.defaultPrevented || overlayOpen()) return
      e.preventDefault()
      ctx.setTool("select")
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [tool, draft, ctx])

  const pins = pinned(threads, page, sel)
  const groups = clusterize(pins)
  const objectsOnly = !!(d as { panelComposer?: boolean }).panelComposer
  const selT = threads.find((t) => t.id === sel && t.page === page && !t.anchor.detached && !t.anchor.broken)
  const hoverT = hover ? pins.find((t) => t.id === hover) : undefined
  const pick = onPinTap ?? locate
  const label = (t: Thread) => {
    const r = t.replies[0]
    return `${t.imported ? t.imported.author : (r?.by.name ?? "")}的评论：${r?.body ?? ""}`
  }

  const textEdit = d.textEdit && ctx.selection === "text" && d.textEdit.page === page ? d.textEdit : undefined
  return (
    <>
      {textEdit && <TextEditMarks edit={textEdit} draftBox={draft?.page === page ? draft.anchor.box : undefined} />}
      {selT?.anchor.box && <AnchorMark kind={selT.anchor.kind} box={selT.anchor.box} />}
      {draft?.page === page && draft.anchor.box && <AnchorMark kind={draft.anchor.kind} box={draft.anchor.box} draft />}
      {d.altCompose?.page === page && d.altCompose.anchor.box && <AnchorMark kind={d.altCompose.anchor.kind} box={d.altCompose.anchor.box} draft />}
      {tool && <CaptureLayer page={page} hoverAt={d.toolHover} objectsOnly={objectsOnly} />}

      {groups.map((g) => {
        const open = g.items.some((t) => t.id === sel)
        if (g.items.length > 1 && !open) {
          return (
            <Pin
              key={g.id}
              person={U.zhou}
              neutral
              text={String(g.items.length)}
              x={g.x}
              y={g.y}
              anchor={`comments.cluster-${g.id}`}
              label={`${g.items.length} 条评论，展开选择`}
              touch={touch}
              onClick={() => setCluster(g.id)}
            />
          )
        }
        return g.items.map((t, i) => (
          <Pin
            key={t.id}
            person={t.replies[0]?.by ?? U.zhou}
            neutral={!!t.imported}
            x={t.anchor.x}
            y={t.anchor.y}
            dx={i * 18}
            label={label(t)}
            selected={t.id === sel}
            anchor={`comments.pin-${t.id}`}
            pulse={flash?.id === t.id ? flash.n : undefined}
            touch={touch}
            onClick={() => pick(t.id)}
            onEnter={() => !touch && setHover(t.id)}
            onLeave={() => setHover(null)}
          />
        ))
      })}
      {groups
        .filter((g) => g.id === cluster && g.items.length > 1)
        .map((g) => (
          <Popover key={g.id} anchor={`comments.cluster-${g.id}`} open onOpenChange={(v) => !v && setCluster(null)} label={`${g.items.length} 条评论`} side={g.x > 60 ? "left" : "right"} align="start" sideOffset={8} snap={false} className="w-[264px] p-1">
            <ClusterList items={g.items} onPick={pick} />
          </Popover>
        ))}

      {hoverT && hoverT.id !== sel && !draft && <HoverCard t={hoverT} />}

      {/* 面板底部撰写框聚焦时：页级锚点的临时钉 */}
      {pageDraft && !draft && <Pin person={U.zhou} x={PAGE_PIN.x} y={PAGE_PIN.y} label={`新评论（第 ${page} 页）`} selected anchor="comments.page-draft" />}
      {draft?.page === page && (
        <>
          {/* 临时钉：点它或在它上面按 Tab 进撰写框（恢复的撰写框不抢焦点，从这里进；TB-79） */}
          <Pin person={U.zhou} x={draft.x} y={draft.y} label="新评论" selected anchor="comments.draft-pin" onClick={focusDraftComposer} onKeyDown={tabIntoDraftComposer} />
          {/* 不按落点加 key：空撰写框换落点时同一个撰写框跟着钉移过去（见 DraftComposer），不重新挂载 */}
          <DraftComposer draft={draft} />
        </>
      )}
      {d.altCompose?.page === page && <Pin person={U.zhou} x={d.altCompose.x} y={d.altCompose.y} label="新评论" selected anchor="comments.alt-draft" />}
      {!touch && <PinMenu />}
      {!touch && <KeyboardCompose />}
    </>
  )
}

/** 撰写框里的文本框（浮动撰写框只有一个） */
const draftTextarea = () => document.querySelector<HTMLTextAreaElement>('[role="dialog"][aria-label="新评论"] textarea')

/** 点临时钉：焦点进撰写框、光标放在末尾（恢复的撰写框不抢焦点，用户从钉上进来，TB-79） */
function focusDraftComposer() {
  const el = draftTextarea()
  if (!el) return
  el.focus({ preventScroll: true })
  el.setSelectionRange(el.value.length, el.value.length)
}

/** 临时钉上按 Tab：进撰写框（撰写框挂在浮层平面，不紧跟钉的 DOM 位置，Tab 不会自然走到它）；⇧Tab 照常往回 */
function tabIntoDraftComposer(e: ReactKeyboardEvent<HTMLButtonElement>) {
  if (e.key !== "Tab" || e.shiftKey || !draftTextarea()) return
  e.preventDefault()
  focusDraftComposer()
}

/**
 * 写了内容的浮动撰写框遇到换页（rulings §4.25 DS-65；进网格视图同此，TB-84；进母版视图也同此，母版视图第一步修复第 1 轮）：撰写框与临时钉随旧页收起，草稿按页留在内存（useKeptDrafts），
 * 回到单页的那一页时原样恢复——临时钉、撰写框、已写的内容与 @ 提及都在，标成 restored：不抢焦点（TB-79，焦点留在用户换页时所在处，点钉或按 Tab 进撰写框），
 * 也不改评论工具（用户在别的页回到「选择」，回来时仍是「选择」）。没写内容的空撰写框换页即放弃（同原样）。离开场景或切换状态（相当于关闭文档）即丢弃：草稿只在场景状态里。
 * 挂在画布列的叠加层上（单页与网格视图都在；单页的 CommentLayer 随网格视图卸载）。评审模式切换在样张里是换状态，与关闭文档同样处理
 */
export function DraftKeeper() {
  const ctx = useEditor()
  const [draft, setDraft] = useDraft()
  const [kept, setKept] = useKeptDrafts()
  // 网格视图里没有单页：撰写框随单页收起。母版视图同此（2026-10-28 母版视图第一步修复第 1 轮，复验 B1）：母版视图里生效的视图仍是单页、页也没变，
  // 但画布换成了母版或版式，单页的撰写框随画布收起；退出后回到这一页时原样恢复、标成 restored，不抢焦点（焦点照常交给画布，03-26 §1.1、TB-79、TB-84）
  const page = ctx.view === "single" && !ctx.masterView.on ? ctx.slide : null
  useEffect(() => {
    if (draft && draft.page !== page) {
      // @ 候选是一时的界面，恢复时不再弹出（演示用的 mention 初值只在状态一出现时生效）
      if (draft.text?.trim()) setKept((k) => ({ ...k, [draft.page]: { ...draft, mention: false, restored: true } }))
      setDraft(null)
      return
    }
    if (!draft && page !== null && kept[page]) {
      const back = kept[page]
      setKept((k) => {
        const rest = { ...k }
        delete rest[page]
        return rest
      })
      setDraft(back)
    }
  }, [page, draft, kept, setDraft, setKept])
  return null
}

/** 评论工具的提示条（canvasOverlay，画布顶部居中；与插入工具态同一外观） */
export function ToolHint() {
  const ctx = useEditor()
  const [draft] = useDraft()
  const alt = (ctx.data as { altCompose?: unknown }).altCompose
  const objectsOnly = !!(ctx.data as { panelComposer?: boolean }).panelComposer
  if (ctx.tool !== "comment" || draft || alt || ctx.view !== "single") return null
  return (
    <CanvasHint label="评论工具">
      <span className="flex items-center gap-2 text-(--v3-text)">
        <MessageSquarePlus {...ICON} aria-hidden="true" />
        <span className="font-semibold">评论</span>
      </span>
      <span>{objectsOnly ? "点选对象添加评论" : "点选对象或空白处添加评论"}</span>
      <HintDivider />
      <span className="flex items-center gap-1.5">
        <KeyCap>Esc</KeyCap>退出
      </span>
    </CanvasHint>
  )
}

/**
 * DS-44 未采纳的备选（comments.alt-tool-tab，场景参数 data.toolSwitchesTab）：评论工具按下时检查器自动切到「评论」页签（列表可见，撰写框仍在落点旁），
 * 工具回到「选择」（或换成别的工具）时恢复到按下之前的那个页签——同 Figma 评论模式（工具与评论列表同进同出）。DS-44 定为不切（01 §2.3：点评论钉是唯一的自动切换），
 * 这个备选未采纳（要改 01 §2.3），所以由场景参数打开、不按状态名判断。挂在画布列的叠加层上（两种视图都在），没有这个参数时什么都不做。
 * 焦点：切页签不移动焦点。只有焦点正在要被换掉的页签内容里时（如在评论列表里按 Esc 退出评论工具），先把焦点交给要显示的那个页签按钮再切，不掉到 body。
 * 读屏：用户操作让页签切到「评论」时，经场景常驻的 polite 区（CommentAnnouncer）播报一次「检查器已切到「评论」页签」——焦点不动，不说读屏用户不知道右栏换了内容；
 * 恢复原页签不播报（回到用户自己选的页签，工具按钮的按下态已说明工具退出）；状态一出现就开着的不播报（演示，无人操作）。
 */
export function ToolTabSync() {
  const ctx = useEditor()
  const on = !!(ctx.data as CommentsData).toolSwitchesTab && ctx.tool === "comment"
  const [tab, setTab] = useInspectorTab()
  const announce = useAnnounce()
  /** 按下之前的页签（工具开着时有值） */
  const before = useRef<InspectorTab | null>(null)
  const live = useRef({ tab, setTab, announce })
  live.current = { tab, setTab, announce }
  // 布局阶段切：状态一出现就开着时第一帧画的就是「评论」页签，不闪「设计」
  useLayoutEffect(() => {
    const { tab: now, setTab: set, announce: say } = live.current
    const switchTo = (t: InspectorTab) => {
      const a = document.activeElement
      const inBody = !!a?.closest('[data-v3-anchor="inspector"]') && !a.closest('[data-v3-inspector-top], [role="tablist"], [data-v3-anchor="zoom"]')
      if (inBody) document.querySelector<HTMLElement>(`[data-v3-anchor="tab-${t}"]`)?.focus({ preventScroll: true })
      set(t)
    }
    if (on && before.current === null) {
      before.current = now
      if (now !== "comments") {
        switchTo("comments")
        if (userHasInteracted()) say("检查器已切到「评论」页签")
      }
    } else if (!on && before.current !== null) {
      const back = before.current
      before.current = null
      if (now !== back) switchTo(back)
    }
  }, [on])
  return null
}
