import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { CircleAlert, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, Button, FIELD_FRAME, ICON, POPOVER_SURFACE, Tip, withReason } from "../../kit"
import { Block, RoleSelect, useEscapeFirst } from "./parts"
import { DIRECTORY, ROLE_LABEL, ROLE_RANK, SELF, type Member, type Person, type Role } from "./people"

/** 邀请失败的原因（03-08「错误（邀请失败）」表）：前两项是前端校验、不发请求 */
export type InviteError = "invalid" | "duplicate" | "no-account" | "failed"

const HELP = "输入同事的邮箱或姓名，默认权限为「可评审」"

/** 03-08 表里的文案；「账号不存在」按部署开关 auth.selfSignup（缺省关）分两种。长句的后半句整段不断行（Q7：不把「分享链接」断在两行） */
function errorText(e: InviteError, selfSignup: boolean): ReactNode {
  switch (e) {
    case "invalid":
      return "请输入有效的邮箱地址"
    case "duplicate":
      return "该用户已有此权限"
    case "no-account":
      return selfSignup ? (
        <>
          系统中没有使用该邮箱的账号。请对方先注册并登录，再邀请；<span className="whitespace-nowrap">也可以把分享链接发给对方。</span>
        </>
      ) : (
        <>
          系统中没有使用该邮箱的账号。<span className="whitespace-nowrap">请联系管理员为对方开通账号后再邀请。</span>
        </>
      )
    case "failed":
      return "邀请失败，请稍后重试"
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface InviteSeed {
  text?: string
  role?: Role
  error?: InviteError
  /** 联想列表一出现就展开（焦点在输入框里） */
  suggest?: boolean
  /** 已从联想里选定的人（输入框里是他的姓名） */
  pick?: string
}

/**
 * 「邀请协作者」一节（03-08）：输入框（可见标签即节标题，持久帮助文字，占位符只做示例）· 角色下拉（缺省可评审）· 主按钮「邀请」。
 * - 联想（combobox）：按显示名前缀、至少 2 个字符；邮箱只做精确匹配、不回显（60/15 §3.2，防枚举），所以联想行只有头像与姓名，
 *   输入完整邮箱命中时显示的是用户自己输入的邮箱；只返回本部署已有账号的个人，不返回用户组（rulings §4.15 Q6）。已在列表里的人右侧注明当前角色。
 *   ↑ ↓ 选择、Enter 选定、Esc 先收起联想（不关对话框）；输入法组合中的 Enter 不提交。
 * - 校验与错误内联在这一行正下方（危险色、role="alert"，输入框 aria-invalid 并 aria-describedby 指向它），不用 alert()；
 *   邀请会降低对方已有权限时，邀请前先给一行提示（03-08 边界情况）。
 * - 邀请成功即直接写入权限（没有待接受邀请，rulings §4.17 D1）：交给 onInvite，输入框清空。
 * - 「邀请」在输入框为空时不可用（aria-disabled、仍可聚焦，工具提示写原因）；离线时整行不可用。
 */
export function InviteBox({
  members,
  seed,
  selfSignup = false,
  failNetwork = false,
  disabled,
  reason,
  onInvite,
}: {
  members: Member[]
  seed?: InviteSeed
  /** 部署开关 auth.selfSignup（缺省关）：只决定「账号不存在」的文案 */
  selfSignup?: boolean
  /** 演示「网络 / 服务端错误」：提交时都失败 */
  failNetwork?: boolean
  disabled?: boolean
  reason?: string
  onInvite: (p: Person, role: Role) => void
}) {
  const uid = useId()
  const labelId = `${uid}-label`
  const msgId = `${uid}-msg`
  const listId = `${uid}-list`
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(seed?.text ?? "")
  const [pickedId, setPickedId] = useState<string | undefined>(seed?.pick)
  const [role, setRole] = useState<Role>(seed?.role ?? "commenter")
  const [error, setError] = useState<InviteError | undefined>(seed?.error)
  const [listOpen, setListOpen] = useState(!!seed?.suggest)
  const [active, setActive] = useState(0)

  // 联想一出现就展开的状态：焦点放进输入框（看得到插入符与聚焦线，像用户正在输入）
  useEffect(() => {
    if (!seed?.suggest) return
    const id = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(id)
    // 只在挂载时
  }, [])

  const q = text.trim()
  const isEmail = q.includes("@")
  const picked = pickedId ? DIRECTORY.find((p) => p.id === pickedId) : undefined
  const pickedNow = picked && picked.name === q ? picked : undefined
  const emailHit = isEmail ? DIRECTORY.find((p) => p.id !== SELF.id && p.email.toLowerCase() === q.toLowerCase()) : undefined
  const nameHits = !isEmail && q.length >= 2 ? DIRECTORY.filter((p) => p.id !== SELF.id && p.name.startsWith(q)).slice(0, 20) : []
  const options: Person[] = emailHit ? [emailHit] : nameHits
  const showList = listOpen && !disabled && !pickedNow && (!!emailHit || (!isEmail && q.length >= 2))
  const activeId = showList && options[active] ? `${listId}-${options[active]!.id}` : undefined

  /** 这次邀请会落到谁身上：选定的人 > 邮箱精确命中 > 姓名全等 */
  const target = pickedNow ?? emailHit ?? (isEmail ? undefined : DIRECTORY.find((p) => p.id !== SELF.id && p.name === q))
  const existing = target ? members.find((m) => m.id === target.id) : undefined
  const downgrade = !error && existing && existing.role !== "owner" && ROLE_RANK[existing.role] > ROLE_RANK[role] ? existing : undefined

  const pick = (p: Person) => {
    setText(p.name)
    setPickedId(p.id)
    setListOpen(false)
    setError(undefined)
  }

  const submit = () => {
    if (disabled || !q) return
    if (!target) {
      setError(isEmail && EMAIL_RE.test(q) ? "no-account" : "invalid")
      return
    }
    if (existing && existing.role === role) {
      setError("duplicate")
      return
    }
    if (failNetwork) {
      setError("failed")
      return
    }
    onInvite(target, role)
    setText("")
    setPickedId(undefined)
    setError(undefined)
    setListOpen(false)
    inputRef.current?.focus({ preventScroll: true })
  }

  // 联想展开时 Esc 先收起联想
  useEscapeFirst(showList, () => setListOpen(false))

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      if (!showList) {
        setListOpen(true)
        setActive(0)
        return
      }
      const n = options.length
      if (n) setActive((a) => (e.key === "ArrowDown" ? (a + 1) % n : (a - 1 + n) % n))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (showList && options[active]) pick(options[active]!)
      else submit()
    }
  }

  const emptyReason = "先输入同事的邮箱或姓名"
  const message = error ? (
    <div id={msgId} role="alert" className="mt-2 flex items-start gap-2">
      <CircleAlert {...ICON} aria-hidden="true" className="mt-px shrink-0 text-(--v3-danger)" />
      <p className="min-w-0 flex-1 text-[12px] leading-[18px] text-(--v3-danger)">{errorText(error, selfSignup)}</p>
    </div>
  ) : downgrade ? (
    <div id={msgId} className="mt-2 flex items-start gap-2">
      <TriangleAlert {...ICON} aria-hidden="true" className="mt-px shrink-0 text-(--v3-warning)" />
      <p className="min-w-0 flex-1 text-[12px] leading-[18px] text-(--v3-text)">
        该用户当前为{ROLE_LABEL[downgrade.role]}，邀请后将变为{ROLE_LABEL[role]}
      </p>
    </div>
  ) : (
    <p id={msgId} className="mt-1.5 text-[12px] leading-[18px] text-(--v3-text-2)">
      {HELP}
    </p>
  )

  const field = (
    <label
      className={cn(
        FIELD_FRAME,
        "flex h-7 min-w-0 items-center px-2 transition-colors focus-within:ring-(--v3-accent)",
        disabled ? "bg-(--v3-field-fill-off) ring-(--v3-field-line-off)" : "hover:bg-(--v3-field-fill-hover)",
        error && "ring-(--v3-danger) focus-within:ring-(--v3-danger)",
      )}
    >
      {/* 已选定某个账号：框内先放他的身份色圆点（16px 头像只有底色），表示这串文字已对应到一个人 */}
      {pickedNow && <Avatar name={pickedNow.name} tone={pickedNow.tone} size={16} className="mr-2" />}
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setPickedId(undefined)
          setError(undefined)
          setListOpen(true)
          setActive(0)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setListOpen(false)}
        readOnly={disabled}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-activedescendant={activeId}
        aria-labelledby={labelId}
        aria-describedby={msgId}
        aria-invalid={error ? true : undefined}
        aria-disabled={disabled || undefined}
        placeholder="例如 lilei@example.com"
        autoComplete="off"
        spellCheck={false}
        className={cn("min-w-0 flex-1 bg-transparent text-[12px] leading-none outline-none placeholder:text-(--v3-text-3)", disabled ? "text-(--v3-text-3)" : "text-(--v3-text)")}
      />
    </label>
  )

  return (
    <Block title="邀请协作者" labelId={labelId}>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          {disabled && reason ? <Tip label={withReason("邀请协作者", reason)}>{field}</Tip> : field}
          {showList && (
            <div id={listId} role="listbox" aria-label="本部署的同事" className={cn(POPOVER_SURFACE, "absolute top-[calc(100%+4px)] left-0 z-10 w-full p-1")}>
              {options.length ? (
                options.map((p, i) => {
                  const m = members.find((x) => x.id === p.id)
                  return (
                    <div
                      key={p.id}
                      id={`${listId}-${p.id}`}
                      role="option"
                      aria-selected={i === active}
                      // 按下时不让输入框失焦（失焦会收起联想）
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(p)}
                      className={cn("flex h-8 cursor-default items-center gap-2 rounded-[4px] px-2 text-[12px] leading-none select-none", i === active && "bg-(--v3-panel-2)")}
                    >
                      {/* 头像首字不进选项的读屏名（否则读成「王 王小明」） */}
                      <span aria-hidden="true" className="flex shrink-0">
                        <Avatar name={p.name} tone={p.tone} size={20} />
                      </span>
                      <span className="whitespace-nowrap text-(--v3-text)">{p.name}</span>
                      {emailHit && <span className="min-w-0 truncate text-(--v3-text-2)">{q}</span>}
                      {m && <span className="ml-auto pl-2 whitespace-nowrap text-(--v3-text-2)">{`已有权限 · ${ROLE_LABEL[m.role]}`}</span>}
                    </div>
                  )
                })
              ) : (
                <p className="px-2 py-1.5 text-[12px] leading-[18px] text-(--v3-text-2)">
                  {isEmail ? "输入完整邮箱后按「邀请」" : <>没有姓名以<span className="whitespace-nowrap">「{q}」</span>开头的同事；也可以输入完整邮箱</>}
                </p>
              )}
            </div>
          )}
        </div>
        <RoleSelect value={role} onChange={setRole} aria="邀请后的权限" disabled={disabled} reason={reason} />
        {/* 网络 / 服务端失败后主按钮就是「重试」（03-08 的 [重试]；同一请求只留一个入口，Q2），改了输入框就变回「邀请」 */}
        <Button variant="primary" disabled={disabled || !q} reason={disabled ? reason : !q ? emptyReason : undefined} onClick={submit}>
          {error === "failed" ? "重试" : "邀请"}
        </Button>
      </div>
      {message}
    </Block>
  )
}
