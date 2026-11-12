import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import { AtSign } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, Button, FIELD_FRAME, ICON, IconButton, POPOVER_SURFACE, userHasInteracted } from "../../kit"
import { MAX_CHARS, MENTION_CANDIDATES, type User } from "./model"

/**
 * 撰写框（03-06「撰写框与 @ 候选」）：画布上的浮动撰写框（评论工具 / 右键「添加评论」：常驻入口只有评论工具，右键菜单是不常驻的第二入口）、线程里的回复、编辑自己的评论共用；
 *   备选 alt-panel-composer 里还有面板底部的页级撰写框（panel）。
 * - 安静样式（DS-35）：输入只铺淡底、不描边（FIELD_FRAME），聚焦时换强调色线；收起时是 28px 的单行字段，焦点在撰写框里（含底部一行的按钮）或有内容时展开成多行 + 底部一行。
 *   展开 / 收起看的是整个撰写框有没有焦点（不只文本框）：空框里按 Tab 走到「提及协作者」「发送」时底部一行不会先收起、焦点不掉到 body。
 * - 键位（rulings §4.25 DS-44：桌面 ↵ 发送、⇧↵ 换行；手机 ↵ 换行、只用「发送」）：↵ 发送、⇧↵ 换行，输入法组合中的 ↵ 不发送（07 §4）；Esc 先关 @ 候选；之后——
 *   编辑：取消编辑；浮动撰写框：没写内容时关闭，写了内容时不关（免得丢稿，与「写了内容时点外面不关」同一保护，「取消」才放弃）；
 *   回复：不清空已写的内容（「取消」才清空）；面板撰写框：收起底部一行、焦点留在文本框。
 * - @ 提及（50/08 §4）：输入 @ 或点「@」弹出候选（在场的排在最前，其余按最近协作），↑↓ 选择、↵ / Tab 插入、Esc 只取消候选；
 *   候选是挂在字段上的 listbox，焦点留在文本框里（aria-activedescendant）；离线时候选只来自在场缓存，并写「离线时无法搜索用户」。
 *   没有用户目录回调时 @ 作为普通字符插入、不弹候选（noDirectory）。
 * - 发送按钮在内容为空或超过 5,000 字时不可用并写原因（07 §3：aria-disabled + 读出原因）；接近上限时显示字数。
 */

export interface ComposerProps {
  variant: "panel" | "reply" | "canvas" | "edit"
  value: string
  onChange: (v: string) => void
  onSubmit: (v: string) => void
  /** Esc（没有候选开着时）或「取消」 */
  onCancel?: () => void
  placeholder: string
  /** 读屏名（不只靠占位文字，07 §3）：「添加评论」「回复王小明」 */
  aria: string
  submitLabel?: string
  /** 展开着（聚焦或有内容）；不传时按焦点与内容自己判断 */
  expanded?: boolean
  /** 一出现就展开、像聚焦了一样（场景状态演示，不真的抢焦点） */
  showFocused?: boolean
  /** 一出现就弹出 @ 候选（场景状态演示） */
  mentionOpen?: boolean
  /** 离线：候选只来自在场缓存 */
  offline?: boolean
  /** 用户打开时把焦点放进文本框（画布撰写框、编辑） */
  autoFocus?: boolean
  /** @ 候选在字段上方还是下方弹出 */
  listSide?: "top" | "bottom"
  rows?: number
  className?: string
}

/** 光标前是不是一个正在输入的 @提及：返回查询词（可为空），不是则 null */
function mentionQuery(text: string, caret: number): string | null {
  const m = /(^|[\s，。；、（「])@([^\s@，。；、]{0,12})$/.exec(text.slice(0, caret))
  return m ? (m[2] ?? "") : null
}

export function Composer({
  variant,
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
  aria,
  submitLabel = "发送",
  expanded,
  showFocused,
  mentionOpen,
  offline,
  autoFocus,
  listSide = "top",
  rows,
  className,
}: ComposerProps) {
  const id = useId()
  const ta = useRef<HTMLTextAreaElement>(null)
  /** 焦点在撰写框里（文本框或底部一行的按钮）：按根节点的 focus-within 判断，焦点在框内移动时不收起 */
  const [focused, setFocused] = useState(false)
  /** 面板撰写框按 Esc 收起（焦点仍在文本框里）；再输入或重新进来时展开 */
  const [collapsed, setCollapsed] = useState(false)
  const [query, setQuery] = useState<string | null>(mentionOpen ? "" : null)
  const [active, setActive] = useState(0)
  const open = expanded ?? ((focused && !collapsed) || showFocused || value.length > 0 || variant === "canvas" || variant === "edit")
  const pool = offline ? MENTION_CANDIDATES.filter((u) => u.online) : MENTION_CANDIDATES
  const cands = query === null ? [] : pool.filter((u) => u.name.includes(query)).slice(0, 6)
  const listOpen = query !== null && (cands.length > 0 || offline)
  const over = value.length > MAX_CHARS
  const empty = value.trim().length === 0
  const why = empty ? "先输入评论内容" : over ? `超过 ${MAX_CHARS.toLocaleString("en-US")} 字` : undefined

  // 画布撰写框与编辑：用户打开时焦点进文本框、光标放在末尾（场景状态里一出现就打开的不抢焦点）。
  // 排到下一个任务再聚焦：从「⋯ › 编辑」打开时菜单还在关闭，Radix 交还焦点会把它拽回「⋯」（菜单另用 keepFocus 不抢）
  useEffect(() => {
    if (!autoFocus || !userHasInteracted()) return
    const t = window.setTimeout(() => {
      const el = ta.current
      if (!el) return
      el.focus({ preventScroll: true })
      el.setSelectionRange(el.value.length, el.value.length)
    }, 0)
    return () => window.clearTimeout(t)
  }, [autoFocus])

  const sync = (text: string, caret: number) => {
    const q = mentionQuery(text, caret)
    setQuery(q)
    setActive(0)
  }

  const insert = (u: User) => {
    const el = ta.current
    const caret = el?.selectionStart ?? value.length
    const before = value.slice(0, caret).replace(/@([^\s@，。；、]{0,12})$/, `@${u.name} `)
    const next = before + value.slice(caret)
    onChange(next)
    setQuery(null)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(before.length, before.length)
    })
  }

  const submit = () => {
    if (why) return
    onSubmit(value.trim())
    setQuery(null)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return
    if (listOpen && cands.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        setActive((a) => (a + (e.key === "ArrowDown" ? 1 : cands.length - 1)) % cands.length)
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        const u = cands[active]
        if (u) insert(u)
        return
      }
    }
    if (e.key === "Escape") {
      if (listOpen) {
        // 只取消候选，不退出撰写框（03-06）；挡住外层弹层的 Esc
        e.preventDefault()
        e.stopPropagation()
        setQuery(null)
        return
      }
      const blank = !value.trim()
      if (variant === "edit" || (variant === "canvas" && blank)) {
        // 编辑：取消编辑；浮动撰写框：没写内容时关闭
        if (onCancel) {
          e.preventDefault()
          e.stopPropagation()
          onCancel()
        }
        return
      }
      if (variant === "panel" && blank) {
        // 面板撰写框：收起底部一行，焦点留在文本框（不失焦、不掉到 body）
        e.preventDefault()
        setCollapsed(true)
      }
      // 写了内容（浮动撰写框、回复）：不关、不清空，免得丢稿；「取消」才放弃
      return
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const listId = `${id}-mentions`
  const list = listOpen && (
    <div
      id={listId}
      role="listbox"
      aria-label="提及协作者"
      className={cn(POPOVER_SURFACE, "absolute right-0 left-0 z-20 p-1", listSide === "top" ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]")}
      // 点候选不让文本框失焦
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* 候选只列人：在场的排在最前，不另标角色（Figma 的 @ 候选同样不显示角色；角色的说法在分享对话框里是「可编辑 / 可评审」，这里不出现第二套词） */}
      {cands.map((u, i) => (
        <div
          key={u.id}
          id={`${listId}-${u.id}`}
          role="option"
          aria-selected={i === active}
          onMouseEnter={() => setActive(i)}
          onClick={() => insert(u)}
          className={cn("flex h-8 cursor-default items-center gap-2 rounded-[4px] px-2 text-[12px] leading-none", i === active ? "bg-(--v3-panel-2)" : "")}
        >
          {/* 头像首字不进选项的读屏名 */}
          <span aria-hidden="true" className="flex shrink-0">
            <Avatar name={u.name} tone={u.tone} size={20} />
          </span>
          <span className="text-(--v3-text)">{u.name}</span>
        </div>
      ))}
      {offline && <p className="px-2 pt-1.5 pb-1 text-[12px] leading-4 text-(--v3-text-2)">离线时无法搜索其他用户</p>}
    </div>
  )

  return (
    <div
      className={cn("relative min-w-0 flex-1", className)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setFocused(false)
          setCollapsed(false)
        }
      }}
    >
      {list}
      <div className={cn(FIELD_FRAME, "transition-colors focus-within:ring-(--v3-accent) hover:bg-(--v3-field-fill-hover)", showFocused && "ring-(--v3-accent)")}>
        <textarea
          ref={ta}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setCollapsed(false)
            sync(e.target.value, e.target.selectionStart ?? e.target.value.length)
          }}
          onKeyDown={onKeyDown}
          // @ 候选跟着文本框的插入点走：文本框失焦即收起候选（撰写框本身的展开看根节点的焦点）
          onBlur={() => setQuery(null)}
          onClick={(e) => e.stopPropagation()}
          rows={open ? (rows ?? (variant === "reply" || variant === "edit" ? 2 : 3)) : 1}
          placeholder={placeholder}
          aria-label={aria}
          role="combobox"
          aria-haspopup="listbox"
          aria-multiline="true"
          aria-autocomplete="list"
          aria-expanded={!!listOpen}
          aria-controls={listOpen ? listId : undefined}
          aria-activedescendant={listOpen && cands[active] ? `${listId}-${cands[active]!.id}` : undefined}
          spellCheck={false}
          className="block w-full resize-none bg-transparent px-2 py-[5px] text-[12px] leading-[18px] text-(--v3-text) outline-none select-text placeholder:text-(--v3-text-3)"
        />
      </div>
      {open && (
        <div className="mt-2 flex items-center gap-2">
          {variant !== "edit" && (
            <IconButton
              label="提及协作者"
              size={24}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const el = ta.current
                const caret = el?.selectionStart ?? value.length
                const pre = value.slice(0, caret)
                const glue = pre.length && !/\s$/.test(pre) ? " @" : "@"
                const next = pre + glue + value.slice(caret)
                onChange(next)
                setQuery("")
                setActive(0)
                requestAnimationFrame(() => {
                  el?.focus()
                  el?.setSelectionRange(pre.length + glue.length, pre.length + glue.length)
                })
              }}
            >
              <AtSign {...ICON} />
            </IconButton>
          )}
          {value.length > MAX_CHARS - 500 && (
            <span className={cn("text-[11px] leading-none tabular-nums", over ? "text-(--v3-danger)" : "text-(--v3-text-2)")}>
              {value.length.toLocaleString("en-US")} / {MAX_CHARS.toLocaleString("en-US")}
            </span>
          )}
          {(focused || showFocused) && variant === "panel" && value.length <= MAX_CHARS - 500 && (
            <span className="text-[12px] leading-none whitespace-nowrap text-(--v3-text-2)">↵ 发送 · ⇧↵ 换行</span>
          )}
          <span className="ml-auto flex items-center gap-2">
            {(variant === "edit" || variant === "reply" || variant === "canvas") && onCancel && (value.length > 0 || variant === "edit") && (
              <Button variant="secondary" onMouseDown={(e) => e.preventDefault()} onClick={onCancel}>
                取消
              </Button>
            )}
            <Button variant="primary" disabled={!!why} reason={why} onClick={submit}>
              {submitLabel}
            </Button>
          </span>
        </div>
      )}
    </div>
  )
}
