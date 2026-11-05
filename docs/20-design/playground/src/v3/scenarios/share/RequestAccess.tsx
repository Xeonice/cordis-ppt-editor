import { CircleCheck, Lock } from "lucide-react"
import { Button, LayerClose, Popover, PopoverTitle, reasonTip, TextArea, useEditor, useSceneState } from "../../kit"
import { OpenFailedPage } from "../main-states/panels"

/**
 * 申请人一侧的「申请访问」（PRD 07 G-56；03-12「权限变更的双向反馈补充」写明这个弹层属于分享对话框 03-08 的补充，所以归分享场景）：
 * 阻断页上的主操作「申请访问」点开一张锚在按钮下方的小弹层——可选留言（≤ 200 字，计数常显）+「取消 / 发送」；
 * 发送后弹层收起，按钮留在原位不可用（24 小时内不能重复申请，工具提示写原因），页上写「已发送申请，等待文档所有者批准」（常驻、polite 播报一次）；
 * 不再另出轻提示（同一件事不说两遍，第 2 轮评审；通知由集成方发给所有者，依据 rulings §4.25 DS-67 的 Webhook 事件 access_request.created）。所有者端是分享对话框顶部的「访问申请」（share.access-requests）。
 * 两处入口共用这一个件：打开时就没有权限（share.request-access / -sent，与第 1 批 main-states.open-failed-access 同一页面）、
 * 会话中访问被撤销（offline-conflict.access-revoked / access-requested 的阻断页）。
 * 访问申请随分享在 M3 开放（DS-48）：M2 的「申请访问」留在原位、不可用、仍可聚焦，保持 kit 主按钮的不可用态，工具提示与读屏说明「申请访问 · 后续版本提供」，
 * 不弹留言弹层；「返回文档列表」照常（rulings §4.25 TB-156，与 DS-137 的「分享」同一规则，§4.20 FE-06）——状态数据写 request: { later: true }。
 * 现有各态都没有写明是 M2（第 1、2 批不写里程碑；shell-pages.link-expired 的分享链接本身是 M3），都维持 M3 的画法。
 */

/** 状态初值（EditorConfig.data.request）：open 弹层一出现就开着 · sent 已发送 */
export interface RequestSeed {
  open?: boolean
  sent?: boolean
  /** M2：「申请访问」留在原位、不可用，写「后续版本提供」（rulings §4.25 TB-156） */
  later?: boolean
}

const MAX = 200
const SENT_REASON = "已发送申请，24 小时内不能重复申请"
/** M2 的不可用原因（TB-156，同 DS-137「分享」的「后续版本提供」） */
const LATER_REASON = "后续版本提供"

/** 申请访问的场景状态（场景内共享，换状态即复位）：弹层开着没有、已发送没有 */
export function useAccessRequest() {
  const { data } = useEditor()
  const seed = (data.request ?? {}) as RequestSeed
  const [open, setOpen] = useSceneState("share.request-open", !!seed.open)
  const [sent, setSent] = useSceneState("share.request-sent", !!seed.sent)
  return { open, setOpen, sent, setSent, later: !!seed.later }
}

/**
 * 「申请访问」主按钮 + 留言弹层；发送后按钮留在原位不可用并写原因（不隐藏）：kit 主按钮的不可用态（panel-2 底）——画布底上同此
 * （rulings §4.25 DS-123：第 3 批曾加的 offOutline「outline 不可用态」选项随裁决删去，shell-pages.link-expired、alt-404-merged 与第 2 批同一画法）
 */
export function RequestAccessButton() {
  const r = useAccessRequest()
  // M2（TB-156）：同一颗主按钮留在原位、不可用（aria-disabled、仍可聚焦），没有留言弹层
  if (r.later)
    return (
      <Button variant="primary" data-v3-anchor="share.request-access" disabled reason={reasonTip("申请访问", LATER_REASON)}>
        申请访问
      </Button>
    )
  return (
    <>
      <Button
        variant="primary"
        data-v3-anchor="share.request-access"
        aria-haspopup="dialog"
        aria-expanded={r.open}
        disabled={r.sent}
        reason={r.sent ? SENT_REASON : undefined}
        onClick={() => r.setOpen(!r.open)}
      >
        申请访问
      </Button>
      <Popover
        anchor="share.request-access"
        open={r.open && !r.sent}
        onOpenChange={r.setOpen}
        // 点按钮本身由按钮自己切换开合
        onInteractOutside={(e) => {
          const t = e.target instanceof Element ? e.target : null
          if (t?.closest('[data-v3-anchor="share.request-access"]')) e.preventDefault()
        }}
        side="bottom"
        align="center"
        sideOffset={8}
        snap={false}
        label="申请访问"
        className="w-[320px] p-3"
      >
        <PopoverTitle>申请访问</PopoverTitle>
        <p className="mt-1 text-[12px] leading-[18px] text-(--v3-text-2)">文档所有者批准后即可打开</p>
        <TextArea aria="留言（可选）" placeholder="留言（可选）：说明你为什么需要访问" max={MAX} rows={3} className="mt-3" />
        <div className="mt-3 flex justify-end gap-2">
          <LayerClose>
            <Button variant="secondary">取消</Button>
          </LayerClose>
          <Button
            variant="primary"
            onClick={() => {
              r.setSent(true)
              r.setOpen(false)
              // 按钮换成不可用（带原因提示）时会重新挂载：等弹层交还焦点之后，把焦点放回这颗按钮（不掉到画布或 body）
              window.setTimeout(() => document.querySelector<HTMLElement>('[data-v3-anchor="share.request-access"]')?.focus({ preventScroll: true }), 30)
            }}
          >
            发送
          </Button>
        </div>
      </Popover>
    </>
  )
}

/**
 * 已发送后的说明行（页上，成功色对勾只给图标）：等待所有者批准。播报区常驻（role=status，polite）、发送后才填内容，
 * 读屏在发送时念一次（播报区随内容一起插入时不一定会念）；没发送时是空的、不占高度
 */
export function RequestSentLine({ sent }: { sent: boolean }) {
  return (
    <span role="status" className={sent ? "mt-3 flex items-center justify-center gap-1.5 text-(--v3-text)" : "block"}>
      {sent && (
        <>
          <CircleCheck size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-(--v3-success)" />
          已发送申请，等待文档所有者批准
        </>
      )}
    </span>
  )
}

/** 打开时就没有权限的阻断页（与第 1 批 main-states.open-failed-access 同一页面与文案），主操作接上留言弹层 */
export function NoAccessPage() {
  const r = useAccessRequest()
  return (
    <OpenFailedPage
      icon={<Lock size={32} strokeWidth={1.5} aria-hidden="true" />}
      title="你没有权限访问此文档"
      actions={
        <>
          <RequestAccessButton />
          <Button variant="outline">返回文档列表</Button>
        </>
      }
    >
      <span className="block">可以向文档所有者申请访问，获得批准后即可打开</span>
      <RequestSentLine sent={r.sent} />
    </OpenFailedPage>
  )
}
