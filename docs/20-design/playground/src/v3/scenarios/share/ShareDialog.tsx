import { useEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { CircleAlert, CloudOff, Lock, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, Button, Dialog, DOC_TITLE, ICON, IconButton, InspectorNotice, LoadingRow, TextField, useSceneState, userHasInteracted } from "../../kit"
import { InviteBox, type InviteSeed } from "./InviteBox"
import { LinkBlock, ReadonlyLink, type LinkSeed } from "./LinkBlock"
import { Block, InlineConfirm, RoleSelect, StaticRole } from "./parts"
import { MEMBERS_DEFAULT, ROLE_LABEL, SELF, type AccessRequest, type Member, type Person, type Role } from "./people"

/**
 * 分享与权限对话框（03-08，`ui.dialog` 内置贡献，kit Dialog md 480）的样张。
 * 所有者视角：邀请协作者 ┊ 有权限的用户 ┊ 通过链接分享（另有「访问申请」时排在最上）；权限变更即时生效，所以没有「完成 / 应用」底栏，
 * 唯一的主按钮是「邀请」，关闭走右上 × 与 Esc，关闭后焦点回到检查器顶行的「分享」。
 * 非所有者：「谁能访问…」只读视图（DS-15 的只读口径：只列人与角色，不画不可用控件，顶部一行说明权限）。
 * 状态的初值来自场景状态的 data.share（ShareSeed）；成员、申请与链接设置记在场景状态里（kit useSceneState），关掉对话框再从「分享」打开仍在。
 */

export interface ShareSeed {
  /** owner 所有者视角（缺省）· readonly 非所有者打开（03-08「权限不足」） */
  view?: "owner" | "readonly"
  /** 成员与链接设置：ready（缺省）· loading 加载中（转圈一行，不画骨架条）· load-failed 加载失败 */
  phase?: "ready" | "loading" | "load-failed"
  offline?: boolean
  members?: Member[]
  invite?: InviteSeed
  selfSignup?: boolean
  failNetwork?: boolean
  /** 这一行的角色下拉一出现就展开 */
  roleMenu?: string
  /** 这一行正在行内确认移除 */
  confirm?: string
  /** 刚邀请进来的这一行（短暂铺 panel-2 底） */
  added?: string
  link?: LinkSeed
  requests?: AccessRequest[]
  /** 移除入口：menu 角色下拉末项（缺省，推荐）· x 行尾 ×（03-08 原文，备选） */
  removeStyle?: "menu" | "x"
  /** 「大量成员」的搜索词 */
  search?: string
  /** 链接区显示只读链接地址（备选 alt-link-url，03-08 线框原样） */
  linkUrl?: boolean
  /** 场景状态一出现时对话框是关着的 */
  closed?: boolean
}

const OFFLINE = "离线时不可用"
/** 超过约 20 人时显示成员搜索框（03-08 边界情况） */
const SEARCH_FROM = 20

/** 自己排第一，其次所有者，其余按加入顺序（最近邀请的排在所有者之后的第一位） */
function ordered(list: Member[]): Member[] {
  return [...list.filter((m) => m.id === SELF.id), ...list.filter((m) => m.id !== SELF.id && m.role === "owner"), ...list.filter((m) => m.id !== SELF.id && m.role !== "owner")]
}

/** 焦点交给某一行的第一个控件（角色下拉）；那一行没了就交给邀请输入框 */
function focusRow(id: string | undefined) {
  requestAnimationFrame(() => {
    const row = id ? document.querySelector<HTMLElement>(`[data-share-member="${CSS.escape(id)}"] button`) : null
    ;(row ?? document.querySelector<HTMLElement>('[role="dialog"] [role="combobox"]'))?.focus({ preventScroll: true })
  })
}

/** 批准 / 拒绝之后那一条申请消失：焦点交给下一条申请的第一个控件；没有申请了交给新加入的成员（批准时）或邀请输入框（不落回对话框本身） */
function focusAfterRequest(nextId: string | undefined, addedId: string | undefined) {
  requestAnimationFrame(() => {
    const next = nextId ? document.querySelector<HTMLElement>(`[data-share-request="${CSS.escape(nextId)}"] button`) : null
    if (next) {
      next.focus({ preventScroll: true })
      return
    }
    focusRow(addedId)
  })
}

export function ShareDialog({
  seed,
  open,
  onOpenChange,
  docTitle = DOC_TITLE,
  returnFocus = "share",
}: {
  seed: ShareSeed
  open: boolean
  onOpenChange: (v: boolean) => void
  /** 第 3 批：从文档列表 / 开始页的卡片「分享…」打开时换成那份文档的名字（缺省示例文档） */
  docTitle?: string
  /** 第 3 批：关闭后焦点回到哪里（锚点名，缺省检查器顶行的「分享」；从卡片打开时回卡片，T3） */
  returnFocus?: string
}) {
  const owner = (seed.view ?? "owner") === "owner"
  return (
    // 顶部锚定（kit Dialog anchor="top"）：内容会增减（加载完成、邀请成功、出错、访问申请、人多时的搜索框），只向下伸展，标题与邀请框不跟着上下移动
    <Dialog title={owner ? `分享「${docTitle}」` : `谁能访问「${docTitle}」`} open={open} onOpenChange={onOpenChange} returnFocus={returnFocus} bodyClassName="p-0" anchor="top">
      {owner ? <OwnerBody seed={seed} /> : <ReadonlyBody seed={seed} />}
    </Dialog>
  )
}

/** 成员区在加载中 / 加载失败时的留高：按加载完成时的 3 行（40 × 3）算，加载完成后下面的「通过链接分享」不跳 */
const MEMBERS_MIN_H = "min-h-[120px]"

/* ------------------------------------------------------------------ 所有者视角 */

function OwnerBody({ seed }: { seed: ShareSeed }) {
  const [members, setMembers] = useSceneState<Member[]>("share.members", () => seed.members ?? MEMBERS_DEFAULT)
  const [requests, setRequests] = useSceneState<AccessRequest[]>("share.requests", () => seed.requests ?? [])
  const [phase, setPhase] = useSceneState<"ready" | "loading" | "load-failed">("share.phase", () => seed.phase ?? "ready")
  // 演示用的初值（一出现就展开的下拉、行内确认、联想、刚邀请的闪一下）只在状态第一次打开对话框时生效：
  // 关掉对话框再从「分享」打开时按缺省态渲染（与产品一致），不再重放
  const [demoUsed, setDemoUsed] = useSceneState("share.demo-used", false)
  const [demo] = useState(() => !demoUsed)
  useEffect(() => {
    if (!demoUsed) setDemoUsed(true)
    // 只在挂载时
  }, [])
  const [announce, setAnnounce] = useState("")
  const [added, setAdded] = useState(demo ? seed.added : undefined)
  const [confirm, setConfirm] = useState(demo ? seed.confirm : undefined)
  const [removing, setRemoving] = useState<string>()
  // 一出现就展开的角色下拉（seed.roleMenu）直接开着挂载：kit Menu 不把对话框挂载时的初始聚焦当成「焦点移出」
  const [menuFor, setMenuFor] = useState<string | undefined>(demo ? seed.roleMenu : undefined)
  const [query, setQuery] = useState(seed.search ?? "")
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))

  const offline = !!seed.offline
  const reason = offline ? OFFLINE : undefined
  const removeStyle = seed.removeStyle ?? "menu"
  const list = useMemo(() => ordered(members), [members])
  const many = members.length > SEARCH_FROM
  const q = query.trim().toLowerCase()
  const shown = many && q ? list.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)) : list

  const add = (p: Person, role: Role) => {
    setMembers((cur) => {
      if (cur.some((m) => m.id === p.id)) return cur.map((m) => (m.id === p.id ? { ...m, role } : m))
      const head = cur.filter((m) => m.id === SELF.id || m.role === "owner")
      return [...head, { ...p, role }, ...cur.filter((m) => m.id !== SELF.id && m.role !== "owner")]
    })
    setAdded(p.id)
    later(() => setAdded((a) => (a === p.id ? undefined : a)), 1600)
  }

  const remove = (m: Member) => {
    const i = list.findIndex((x) => x.id === m.id)
    const next = list[i + 1]?.role === "owner" ? undefined : (list[i + 1] ?? list[i - 1])
    setConfirm(undefined)
    setRemoving(m.id)
    // 确认后该行 240ms 淡出，再从列表移除（03-08）
    later(() => {
      setMembers((cur) => cur.filter((x) => x.id !== m.id))
      setRemoving(undefined)
      setAnnounce(`已移除${m.name}`)
      if (userHasInteracted()) focusRow(next && next.role !== "owner" ? next.id : undefined)
    }, 240)
  }

  // 「重试」随出错行卸载：焦点先交给加载中的状态行（tabIndex −1，读屏念「正在加载…」），加载完成后交给邀请输入框（不落回对话框本身）
  const retry = () => {
    // 同步提交后立刻聚焦（同一个任务里交接，「重试」与加载行之间、加载行与邀请框之间焦点都不在 body 停留一帧）
    flushSync(() => setPhase("loading"))
    document.querySelector<HTMLElement>("[data-share-loading]")?.focus({ preventScroll: true })
    later(() => {
      const a = document.activeElement
      const waiting = !a || a === document.body || !!a.closest("[data-share-loading]")
      flushSync(() => setPhase("ready"))
      if (waiting) document.querySelector<HTMLElement>('[role="dialog"] [role="combobox"]')?.focus({ preventScroll: true })
    }, 900)
  }

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      {/* 面板 / 对话框里的状态说明一律是 InspectorNotice（与本对话框的「只读」行、版本历史面板的离线说明同一画法）；警告色横幅只在横幅通道（背后的编辑器已有离线横幅） */}
      {offline && <InspectorNotice icon={<CloudOff {...ICON} aria-hidden="true" />}>离线时无法邀请协作者或生成分享链接；成员列表为离线前的内容</InspectorNotice>}
      {requests.length > 0 && phase === "ready" && (
        <RequestsBlock
          requests={requests}
          disabled={offline}
          reason={reason}
          onApprove={(r, role) => {
            const next = requests[requests.findIndex((x) => x.id === r.id) + 1] ?? requests.find((x) => x.id !== r.id)
            setRequests((cur) => cur.filter((x) => x.id !== r.id))
            add(r, role)
            setAnnounce(`已批准${r.name}的申请（${ROLE_LABEL[role]}）`)
            if (userHasInteracted()) focusAfterRequest(next?.id, r.id)
          }}
          onDeny={(r) => {
            const next = requests[requests.findIndex((x) => x.id === r.id) + 1] ?? requests.find((x) => x.id !== r.id)
            setRequests((cur) => cur.filter((x) => x.id !== r.id))
            setAnnounce(`已拒绝${r.name}的申请`)
            if (userHasInteracted()) focusAfterRequest(next?.id, undefined)
          }}
        />
      )}
      <InviteBox
        members={members}
        seed={demo ? seed.invite : seed.invite && { ...seed.invite, suggest: false }}
        selfSignup={seed.selfSignup}
        failNetwork={seed.failNetwork}
        disabled={offline}
        reason={reason}
        onInvite={(p, role) => {
          add(p, role)
          setAnnounce(`已邀请${p.name}（${ROLE_LABEL[role]}）`)
        }}
      />
      {phase !== "ready" ? (
        <>
          {/*
            加载中与加载失败同一结构（不画骨架条，Q8）：两节标题都在，各一行占位——「有权限的用户」是一行 kit LoadingRow（转圈 14 + 一句话，左对齐、行高 32，
            与版本历史的加载行同一件）或出错行（危险色图标 + 一句话 +「重试」，只出现这一次，说的是成员与链接设置），成员区按加载完成时的 3 行留高；
            「通过链接分享」一行 text-2：加载中「加载完成后可设置」、加载失败「暂时无法设置」。邀请一节照常可用。
            「重试」后的焦点目标就是加载行本身（tabIndex −1 + 读屏名「正在加载成员与链接设置」，role=status 不从内容取名）
          */}
          <Block title="有权限的用户">
            <div className={MEMBERS_MIN_H}>
              {phase === "loading" ? (
                <LoadingRow focusable label="正在加载成员与链接设置" data-share-loading="" className="-mx-2 rounded-[4px]">
                  正在加载成员与链接设置…
                </LoadingRow>
              ) : (
                <div role="alert" className="flex items-center gap-2">
                  <CircleAlert {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-danger)" />
                  <p className="min-w-0 flex-1 text-[12px] leading-[18px] text-(--v3-text)">成员与链接设置加载失败，请稍后重试</p>
                  <Button variant="secondary" onClick={retry}>
                    重试
                  </Button>
                </div>
              )}
            </div>
          </Block>
          <Block title="通过链接分享">
            {/* 同一行高、同一位置：加载中「加载完成后可设置」；加载失败时已经不在加载了，写「暂时无法设置」（与上面的出错行不矛盾，重试成功后才有链接设置） */}
            <p className="flex h-7 items-center text-[12px] leading-4 text-(--v3-text-2)">{phase === "loading" ? "加载完成后可设置" : "暂时无法设置"}</p>
          </Block>
        </>
      ) : (
        <>
          <Block title="有权限的用户" count={members.length}>
            {many && (
              <TextField
                aria="搜索有权限的用户"
                placeholder="搜索姓名或邮箱"
                value={query}
                onChange={setQuery}
                leading={<Search {...ICON} aria-hidden="true" className="shrink-0" />}
                trailing={q ? <span className="text-[12px] leading-none whitespace-nowrap text-(--v3-text-2)">{`${shown.length} 人`}</span> : undefined}
                className="mb-2"
              />
            )}
            {/* 人多时列表在节内滚动（03-08「虚拟滚动 + 搜索框过滤」），邀请与链接两节留在原位 */}
            {/* 块级列表（不是 flex 列）：限高滚动时行不被压扁；多露出半行，看得出还能往下滚 */}
            <ul className={cn(many && "-mr-2 max-h-[260px] overflow-y-auto pr-2")}>
              {shown.map((m) =>
                confirm === m.id ? (
                  <li key={m.id} data-share-member={m.id} className="flex min-h-10 items-center">
                    <InlineConfirm
                      className="w-full"
                      leading={<Avatar name={m.name} tone={m.tone} />}
                      confirmLabel="移除"
                      onCancel={() => {
                        setConfirm(undefined)
                        if (userHasInteracted()) focusRow(m.id)
                      }}
                      onConfirm={() => remove(m)}
                    >
                      移除<span className="whitespace-nowrap">{m.name}</span>？对方将立即失去访问权限
                    </InlineConfirm>
                  </li>
                ) : (
                  <MemberRow
                    key={m.id}
                    m={m}
                    removeStyle={removeStyle}
                    menuOpen={menuFor === m.id}
                    onMenu={(v) => setMenuFor(v ? m.id : undefined)}
                    onRole={(role) => {
                      setMembers((cur) => cur.map((x) => (x.id === m.id ? { ...x, role } : x)))
                      setAnnounce(`${m.name}的权限已改为${ROLE_LABEL[role]}`)
                    }}
                    onAskRemove={() => setConfirm(m.id)}
                    removing={removing === m.id}
                    flash={added === m.id}
                    reason={reason}
                  />
                ),
              )}
              {many && q && !shown.length && <li className="py-2 text-[12px] leading-[18px] text-(--v3-text-2)">没有匹配「{query.trim()}」的人</li>}
            </ul>
            {/* 搜索结果数播报给读屏（polite；输入框右侧的「N 人」只是视觉） */}
            {many && (
              <p aria-live="polite" className="sr-only">
                {q ? `找到 ${shown.length} 位` : ""}
              </p>
            )}
          </Block>
          <LinkBlock seed={demo ? seed.link : seed.link && { access: seed.link.access, expiry: seed.link.expiry }} urlField={seed.linkUrl} disabled={offline} reason={reason} onAnnounce={setAnnounce} />
        </>
      )}
    </>
  )
}

/**
 * 成员一行（40 高）：头像（身份色）· 姓名（自己加「（你）」）与邮箱两行 · 角色。所有者一行是静态「所有者」——
 * 转让所有权不在 M3（PRD 07 D5，P2），文档的所有者也不能被降级或移除（60/03 permission.last_owner）。
 * 角色是下拉的列表行内变体（无框文字「可编辑 ⌄」右对齐到行尾，悬停 / 聚焦 / 展开才铺 panel-2 底；标杆 Figma 同此，第 2 批第 6 轮按标杆对照改），
 * 所有者行的「所有者」同样右对齐，右缘与「⌄」一列；邀请行、访问申请行与链接行的下拉仍带细边。
 * 移除入口缺省在角色下拉末项（removeStyle menu）；备选是行尾 ×（removeStyle x，03-08 原文）。
 */
function MemberRow({
  m,
  removeStyle,
  menuOpen,
  onMenu,
  onRole,
  onAskRemove,
  removing,
  flash,
  reason,
}: {
  m: Member
  removeStyle: "menu" | "x"
  menuOpen: boolean
  onMenu: (v: boolean) => void
  onRole: (r: Role) => void
  onAskRemove: () => void
  removing: boolean
  flash: boolean
  reason?: string
}) {
  const self = m.id === SELF.id
  const off = !!reason
  return (
    <li
      data-share-member={m.id}
      className={cn(
        "-mx-2 flex h-10 items-center gap-2 rounded-[4px] px-2 transition-[opacity,background-color] duration-[240ms]",
        removing && "opacity-0",
        flash && "bg-(--v3-panel-2)",
      )}
    >
      <Avatar name={m.name} tone={m.tone} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] leading-4 text-(--v3-text)">
          {m.name}
          {self && <span className="text-(--v3-text-2)">（你）</span>}
        </p>
        <p className="truncate text-[12px] leading-4 text-(--v3-text-2)">{m.email}</p>
      </div>
      {m.role === "owner" ? (
        <StaticRole role="owner" align="end" />
      ) : (
        <RoleSelect
          variant="row"
          value={m.role}
          onChange={onRole}
          aria={`${m.name}的权限`}
          onRemove={removeStyle === "menu" ? onAskRemove : undefined}
          open={menuOpen}
          onOpenChange={onMenu}
          disabled={off}
          reason={reason}
        />
      )}
      {removeStyle === "x" &&
        (m.role === "owner" ? (
          <span aria-hidden="true" className="size-7 shrink-0" />
        ) : (
          <IconButton label={`移除 ${m.name}`} disabled={off} reason={reason} onClick={onAskRemove}>
            <X {...ICON} />
          </IconButton>
        ))}
    </li>
  )
}

/**
 * 「访问申请 N」（PRD 07 G-56：所有者在分享对话框顶部看到待处理申请，逐条选角色后批准 / 拒绝；申请人一侧是 03-02 / 03-12 的「申请访问」）。
 * 节标题统一为「访问申请」+ 待处理条数（Section count）；PRD G-56 的「待处理申请 N」随 rulings §4.25 DS-48 统一成这一个名字。
 * 同一份数据（场景仓 share.requests）也驱动「分享」按钮上的待处理提示（ShareLayer 写进 kit useSharePending），批准 / 拒绝后两处一起减少。
 * 批准用次按钮：对话框里唯一的主按钮仍是「邀请」（Q3）。批准等同按人邀请——直接写入权限、该人出现在列表里。
 */
function RequestsBlock({
  requests,
  onApprove,
  onDeny,
  disabled,
  reason,
}: {
  requests: AccessRequest[]
  onApprove: (r: AccessRequest, role: Role) => void
  onDeny: (r: AccessRequest) => void
  disabled?: boolean
  reason?: string
}) {
  return (
    <Block title="访问申请" count={requests.length}>
      <ul className="flex flex-col gap-2">
        {requests.map((r) => (
          <RequestRow key={r.id} r={r} onApprove={onApprove} onDeny={onDeny} disabled={disabled} reason={reason} />
        ))}
      </ul>
    </Block>
  )
}

/** 申请一条：头像 · 姓名、邮箱与时间 / 留言（整宽，不与按钮抢宽度）/ 下一行在文字列下方：批准后的权限 · 拒绝 · 批准 */
function RequestRow({ r, onApprove, onDeny, disabled, reason }: { r: AccessRequest; onApprove: (r: AccessRequest, role: Role) => void; onDeny: (r: AccessRequest) => void; disabled?: boolean; reason?: string }) {
  const [role, setRole] = useState<Role>(r.role)
  return (
    <li data-share-request={r.id} className="flex items-start gap-2">
      <Avatar name={r.name} tone={r.tone} />
      <div className="min-w-0 flex-1">
        <p className="flex h-6 items-center gap-1.5 text-[12px] leading-4 whitespace-nowrap">
          <span className="text-(--v3-text)">{r.name}</span>
          <span className="truncate text-(--v3-text-2)">{r.email}</span>
          <span className="text-(--v3-text-2)">{`· ${r.when}`}</span>
        </p>
        {/* 留言是申请人写的正文（与评论正文同一写法，不加引号：「」的字形左侧留白会让它比姓名缩进半个字） */}
        <p className="text-[12px] leading-[18px] text-(--v3-text)">{r.message ?? "申请访问此文档"}</p>
        <div className="mt-2 flex items-center gap-2">
          <RoleSelect value={role} onChange={setRole} aria={`批准${r.name}后的权限`} disabled={disabled} reason={reason} />
          <Button variant="secondary" disabled={disabled} reason={reason} onClick={() => onApprove(r, role)}>
            批准
          </Button>
          <Button variant="ghost" disabled={disabled} reason={reason} onClick={() => onDeny(r)}>
            拒绝
          </Button>
        </div>
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ 非所有者：只读视图 */

/**
 * 03-08「权限不足」：标题「谁能访问…」，没有邀请框、角色下拉与移除；成员只列姓名与角色（不显示邮箱）；
 * 链接只读：当前链接权限一行 +「复制链接」（LinkBlock ReadonlyLink）——仅邀请时复制文档地址（列表里的人都能打开），链接授予角色时复制分享链接、说明行与所有者相同
 * （rulings §4.25 DS-69，share.no-permission-link；链接权限取 seed.link.access）。说明权限的那一行按 DS-15 放在顶部（与检查器只读说明同一组件）。
 */
function ReadonlyBody({ seed }: { seed: ShareSeed }) {
  const list = ordered(seed.members ?? MEMBERS_DEFAULT)
  const [announce, setAnnounce] = useState("")
  return (
    <>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      <InspectorNotice icon={<Lock {...ICON} aria-hidden="true" />}>只读 · 只有所有者可以更改分享设置</InspectorNotice>
      <Block title="有权限的用户" count={list.length}>
        <ul className="flex flex-col">
          {list.map((m) => (
            <li key={m.id} data-share-readonly-member={m.id} className="flex h-8 items-center gap-2">
              {/* 单行（只有姓名）：头像 20，与其余单行列表（邀请联想、评论作者行）一致；两行的成员行（姓名 + 邮箱）才用 24 */}
              <Avatar name={m.name} tone={m.tone} size={20} />
              <p className="min-w-0 flex-1 truncate text-[12px] leading-4 text-(--v3-text)">
                {m.name}
                {m.id === SELF.id && <span className="text-(--v3-text-2)">（你）</span>}
              </p>
              {/* 只读视图整列都是文字：右对齐到内容右缘 */}
              <StaticRole role={m.role} align="end" className="px-0" />
            </li>
          ))}
        </ul>
      </Block>
      <Block title="通过链接分享">
        <ReadonlyLink access={seed.link?.access ?? "invite"} onAnnounce={setAnnounce} />
      </Block>
    </>
  )
}
