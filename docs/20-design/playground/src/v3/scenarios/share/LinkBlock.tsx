import { useEffect, useRef, useState, type ReactNode } from "react"
import { Building2, Check, Link2, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, FIELD_FRAME, ICON, Menu, reasonTip, SelectTrigger, Tip, useSceneState, withReason, type MenuSpec } from "../../kit"
import { Block, InlineConfirm } from "./parts"
import { DOC_URL, EXPIRY_DATE, EXPIRY_LABEL, LINK_LABEL, LINK_RANK, SHARE_URL, type Expiry, type LinkAccess } from "./people"

export interface LinkSeed {
  access?: LinkAccess
  expiry?: Expiry
  /** 一出现就展开的下拉 */
  menu?: "access" | "expiry"
  /** 收紧到这一项、正在行内确认 */
  confirm?: LinkAccess
  /** 「复制链接」停在「已复制」上（场景状态里不自动恢复；用户点了照常 1.5 秒后恢复） */
  copied?: boolean
  /**
   * 选了这个期限的链接已到期（rulings §4.25 DS-66：到期等同收紧）：所有者再打开时链接权限回到「仅邀请」，说明行在含义之后补「原链接已于〈到期日〉到期」；
   * 再放宽就像撤销之后一样生成新链接（DS-47），这句随之消失。access 应写 invite
   */
  expired?: Exclude<Expiry, "never">
}

export interface LinkValue {
  access: LinkAccess
  expiry: Expiry
  /** 原链接的到期日（DS-66，所有者读到的链接记录）：只在「仅邀请」时写进说明行；放宽（生成新链接）即清掉 */
  expiredOn?: string
}

const accessIcon = (a: LinkAccess) => (a === "invite" ? <Lock {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" /> : <Building2 {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />)

/** 说明行开头的含义（03-08 §4.3 链接权限表的「说明行」一列）：所有者与非所有者同一句（DS-69） */
const LINK_MEANING: Record<LinkAccess, string> = {
  invite: "只有上面列出的人能打开此链接",
  view: "本部署的任何人凭链接即可查看",
  comment: "本部署的任何人凭链接即可查看和评论",
}

/**
 * 说明行：这一项的含义 +（有期限时）到期日 / （原链接已到期时，DS-66）原链接的到期日 + 常驻的「打开链接需要先登录」（S-1：没有匿名 / 访客访问）。
 * 后两段各自不断行（whitespace-nowrap）：放不下时整段换到下一行，不留单字尾行（Q7）。
 */
function Describe({ access, expiry, expiredOn }: LinkValue) {
  return (
    <p className="mt-2 text-[12px] leading-[18px] text-(--v3-text-2)">
      {LINK_MEANING[access]}
      {access !== "invite" && expiry !== "never" && (
        <>
          ，<span className="whitespace-nowrap">{`链接 ${EXPIRY_DATE[expiry]}到期`}</span>
        </>
      )}
      {access === "invite" && expiredOn && (
        <>
          ，<span className="whitespace-nowrap">{`原链接已于 ${expiredOn}到期`}</span>
        </>
      )}
      。<span className="whitespace-nowrap">打开链接需要先登录。</span>
    </p>
  )
}

/** 同一外观的静态下拉（离线等暂不可用）：aria-disabled、仍可聚焦，工具提示「名称 · 原因」 */
function OffTrigger({ aria, reason, className, children }: { aria: string; reason?: string; className?: string; children: ReactNode }) {
  const t = (
    <SelectTrigger aria-label={withReason(aria, reason)} aria-disabled="true" className={className}>
      {children}
    </SelectTrigger>
  )
  return reason ? <Tip label={reasonTip(aria, reason)}>{t}</Tip> : t
}

/**
 * 「复制链接」：次按钮（透明底 + 细边，DS-37）带链接图标；点后变为「已复制」1.5 秒再恢复，不用系统级通知（03-08），读屏经 polite 播报。
 * 两种文案同宽（96），切换时这一行不跳。仅邀请时复制文档地址（列表里的人能打开）；链接授予角色时复制带令牌的分享链接（50/02 §11）。
 * copied：场景状态里停在「已复制」上（不自动恢复）；用户点了照常计时。
 */
export function CopyLinkButton({
  invite,
  copied: initial,
  disabled,
  reason,
  onAnnounce,
}: {
  invite: boolean
  copied?: boolean
  disabled?: boolean
  reason?: string
  onAnnounce: (s: string) => void
}) {
  const [copied, setCopied] = useState(!!initial)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = () => {
    try {
      void navigator.clipboard?.writeText(invite ? DOC_URL : SHARE_URL).catch(() => undefined)
    } catch {
      // 剪贴板不可用（非安全上下文）时只演示按钮反馈
    }
    setCopied(true)
    onAnnounce("已复制链接")
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1500)
  }
  return (
    <Button variant="secondary" disabled={disabled} reason={reason} onClick={copy} className="w-[96px]">
      {copied ? <Check {...ICON} aria-hidden="true" /> : <Link2 {...ICON} aria-hidden="true" />}
      {copied ? "已复制" : "复制链接"}
    </Button>
  )
}

/**
 * 非所有者的只读一行（03-08 §1.3，DS-48）：当前链接权限（图标 + 文字）+「复制链接」，下面是与所有者相同的说明行的含义（DS-69），不写有效期与到期日（TB-65）。
 * 「复制链接」：仅邀请时复制文档地址（列表里的人都能打开），链接授予角色时复制凭链接访问的分享链接（DS-69：后端对能读文档的成员返回当前有效链接的令牌）。
 * 说明行是一整句（与拍板时的 share.no-permission 同一画法）：只读视图没有有效期那一段，三种含义都放得进一行
 */
export function ReadonlyLink({ access, onAnnounce }: { access: LinkAccess; onAnnounce: (s: string) => void }) {
  return (
    <>
      <div className="flex h-7 items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-2 text-[12px] leading-none text-(--v3-text)">
          {accessIcon(access)}
          <span className="whitespace-nowrap">{LINK_LABEL[access]}</span>
        </span>
        <CopyLinkButton invite={access === "invite"} onAnnounce={onAnnounce} />
      </div>
      <p className="mt-2 text-[12px] leading-[18px] text-(--v3-text-2)">{`${LINK_MEANING[access]}。打开链接需要先登录。`}</p>
    </>
  )
}

/**
 * 「通过链接分享」一节（03-08）。一行：链接权限下拉 ·（链接授予角色时）有效期下拉 ·「复制链接」；下面一行说明。
 * - 链接权限三项：仅邀请的用户可访问（缺省，链接本身不授予角色）/ 登录用户凭链接可查看 / 登录用户凭链接可评审；不提供「可编辑」（rulings §4.24 AL-1），
 *   菜单末尾一行说明「编辑权限只能通过邀请授予」。原「允许通过链接访问的用户下载 / 打印」开关已删（AL-5）。
 * - 放宽（如仅邀请 → 可查看）直接生效、不确认（03-08）；改回「仅邀请的用户可访问」时，凭链接在线的人会立即失去访问、且不可撤销，在这一节里行内确认；
 *   可评审 → 可查看仍有访问，直接生效（已凭链接进入的会话按 03-12 降权）。
 * - 有效期（PRD SV-06「可设角色与过期」、07 G-61）：永久 / 7 天 / 30 天，只在链接授予角色时出现；说明行写到期日。
 * - 到期等同收紧（rulings §4.25 DS-66，share.link-expired）：选了期限的链接到期后，所有者再打开时链接权限是「仅邀请」、不出有效期，说明行补「原链接已于〈日期〉到期」；
 *   没有确认、不设「续期」，再放宽生成新链接、这句随之消失。
 * - 「复制链接」见 CopyLinkButton。不显示链接地址本身（Figma 做法，见 decisions）。
 */
export function LinkBlock({
  seed,
  urlField = false,
  disabled,
  reason,
  onAnnounce,
}: {
  seed?: LinkSeed
  /** 备选（alt-link-url，03-08 线框原样）：第一行是只读链接地址 +「复制链接」，第二行「链接权限」下拉 */
  urlField?: boolean
  disabled?: boolean
  reason?: string
  onAnnounce: (s: string) => void
}) {
  const [link, setLink] = useSceneState<LinkValue>("share.link", () => ({
    access: seed?.access ?? "invite",
    expiry: seed?.expiry ?? "never",
    expiredOn: seed?.expired ? EXPIRY_DATE[seed.expired] : undefined,
  }))
  // 一出现就展开的下拉（seed.menu）直接开着挂载：kit Menu 不把对话框挂载时的初始聚焦当成「焦点移出」
  const [menu, setMenu] = useState<"access" | "expiry" | undefined>(seed?.menu)
  const [pending, setPending] = useState<LinkAccess | null>(seed?.confirm ?? null)

  /** 行内确认随「取消 / 更改」卸载：焦点交回「链接权限」下拉（不掉到 body 或对话框本身） */
  const backToAccess = () => requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-share-link-access]")?.focus({ preventScroll: true }))

  const choose = (a: LinkAccess) => {
    if (a === link.access) return
    // 收紧到不再授予任何角色：先确认；其余（放宽、可评审 → 可查看）直接生效
    if (a === "invite" && LINK_RANK[link.access] > 0) {
      setPending(a)
      return
    }
    // 放宽即生成新链接（DS-47）：原链接已到期的那一句随之消失（DS-66）
    setLink((l) => ({ ...l, access: a, expiredOn: undefined }))
    onAnnounce(`链接权限已改为「${LINK_LABEL[a]}」`)
  }

  const accessItems: MenuSpec[] = [
    {
      type: "radio",
      id: "access",
      label: "链接权限",
      value: link.access,
      onValueChange: (v) => choose(v as LinkAccess),
      closeOnSelect: true,
      options: (["invite", "view", "comment"] as const).map((a) => ({ value: a, label: LINK_LABEL[a], icon: accessIcon(a) })),
    },
    { type: "separator" },
    { type: "note", text: "编辑权限只能通过邀请授予" },
  ]
  const expiryItems: MenuSpec[] = [
    {
      type: "radio",
      id: "expiry",
      label: "有效期",
      value: link.expiry,
      closeOnSelect: true,
      onValueChange: (v) => {
        setLink((l) => ({ ...l, expiry: v as Expiry }))
        onAnnounce(v === "never" ? "链接改为永久有效" : `链接将于 ${EXPIRY_DATE[v as Exclude<Expiry, "never">]}到期`)
      },
      options: (["never", "7d", "30d"] as const).map((e) => ({ value: e, label: EXPIRY_LABEL[e], hint: e === "never" ? undefined : `${EXPIRY_DATE[e]}到期` })),
    },
  ]

  const accessLabel = (
    <>
      {accessIcon(link.access)}
      <span className="whitespace-nowrap">{LINK_LABEL[link.access]}</span>
    </>
  )
  const expiryLabel = (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-(--v3-text-2)">有效期</span>
      {EXPIRY_LABEL[link.expiry]}
    </span>
  )
  const granting = link.access !== "invite"

  const accessControl = disabled ? (
    <OffTrigger aria={`链接权限：${LINK_LABEL[link.access]}`} reason={reason} className="min-w-0 flex-1">
      {accessLabel}
    </OffTrigger>
  ) : (
    <Menu
      trigger={
        <SelectTrigger aria-label={`链接权限：${LINK_LABEL[link.access]}`} data-share-link-access="" className="min-w-0 flex-1">
          {accessLabel}
        </SelectTrigger>
      }
      items={accessItems}
      open={menu === "access"}
      onOpenChange={(v) => setMenu(v ? "access" : undefined)}
      label="链接权限"
      className="min-w-[264px]"
      // 选了「仅邀请」后焦点由下方的行内确认接走（落在「取消」）：菜单关闭时不再把焦点抢回这个下拉（kit keepMovedFocus）
      keepFocus
    />
  )
  const expiryControl =
    granting &&
    (disabled ? (
      <OffTrigger aria={`链接有效期：${EXPIRY_LABEL[link.expiry]}`} reason={reason} className="w-[132px] shrink-0">
        {expiryLabel}
      </OffTrigger>
    ) : (
      <Menu
        trigger={
          <SelectTrigger aria-label={`链接有效期：${EXPIRY_LABEL[link.expiry]}`} className="w-[132px] shrink-0">
            {expiryLabel}
          </SelectTrigger>
        }
        items={expiryItems}
        open={menu === "expiry"}
        onOpenChange={(v) => setMenu(v ? "expiry" : undefined)}
        align="end"
        label="链接有效期"
        className="min-w-[184px]"
      />
    ))
  const copyButton = <CopyLinkButton invite={link.access === "invite"} copied={seed?.copied} disabled={disabled} reason={reason} onAnnounce={onAnnounce} />

  return (
    <Block title="通过链接分享">
      {urlField ? (
        <>
          <div className="flex items-center gap-2">
            <label className={cn(FIELD_FRAME, "flex h-7 min-w-0 flex-1 items-center gap-2 px-2 transition-colors focus-within:ring-(--v3-accent) hover:bg-(--v3-field-fill-hover)")}>
              <Link2 {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />
              <input
                readOnly
                value={link.access === "invite" ? DOC_URL : SHARE_URL}
                aria-label="分享链接"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-[12px] leading-none text-(--v3-text) outline-none"
              />
            </label>
            {copyButton}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="shrink-0 text-[12px] leading-none text-(--v3-text-2)">链接权限</span>
            {accessControl}
            {expiryControl}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2">
          {accessControl}
          {expiryControl}
          {copyButton}
        </div>
      )}
      {pending ? (
        <InlineConfirm
          className="mt-2"
          confirmLabel="更改"
          onCancel={() => {
            setPending(null)
            backToAccess()
          }}
          onConfirm={() => {
            setLink((l) => ({ ...l, access: pending }))
            setPending(null)
            onAnnounce(`链接权限已改为「${LINK_LABEL[pending]}」`)
            backToAccess()
          }}
        >
          改为<span className="whitespace-nowrap">「{LINK_LABEL[pending]}」</span>？不在上面列表中、<span className="whitespace-nowrap">凭链接打开的人</span>将立即失去访问权限。
          {/* 收紧即撤销（rulings §4.25 DS-47）：令牌轮换，旧链接永久失效，再次放宽时生成新链接——在确认里写明，按分句换行 */}
          <span className="whitespace-nowrap">原链接将永久失效，</span>
          <span className="whitespace-nowrap">再次放宽时会生成新链接。</span>
        </InlineConfirm>
      ) : (
        <Describe {...link} />
      )}
    </Block>
  )
}
