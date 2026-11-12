import type { ReactNode } from "react"
import { Lock, Users } from "lucide-react"
import { Button, DOC_TITLE } from "../../kit"
import { OpenFailedPage } from "../main-states/panels"
import { RequestAccessButton, RequestSentLine, useAccessRequest } from "../share/RequestAccess"
import type { EditorConfig } from "../types"

/**
 * offline-conflict 场景的阻断页：与第 1 批已拍板的「打开失败」同一布局（main-states/panels OpenFailedPage：替换整个工作区，
 * 不渲染残缺的左栏、检查器与工具条；32px 线性图标 text-2 · 文档名 · 16px 标题 · 12px 说明 · 一行按钮）。
 * 1. 会话中访问被撤销（03-12「访问权限已变更」，PRD CO-05、50/07 §8.1）：Unit 关闭、内存中的文档与待同步更改一并清空，
 *    所以画布上不能再留着文档内容——与打开时就没有权限（open-failed-access）收敛为同一个阻断态；不提供导出本地副本。
 *    「申请访问」打开留言弹层（分享场景的 RequestAccess，03-12 写明弹层属于 03-08 的补充；与打开时没有权限的 share.request-access 共用），
 *    发送后按钮留在原位不可用、页上写「已发送申请，等待文档所有者批准」（常驻、polite 播报一次，03-12「requested」、G-56）；不再另出轻提示（同一件事不说两遍）。
 * 2. 查看人数已满（03-12 G-55「房间查看者也已满」，关闭码 4503 / collab.room_full）：只有「返回文档列表」；后台继续按退避重试，
 *    有名额空出时自动打开（50/07 §9）。
 */

/** 阻断页共用的配置：不渲染左栏、检查器与工具条（工具条不留位置，内容整屏垂直居中）。 */
export function blockingPage(page: () => ReactNode): EditorConfig {
  return {
    toolbar: { hidden: true, collapse: true },
    regions: { leftRail: () => null, inspector: () => null, stage: page },
  }
}

const LOCK = <Lock size={32} strokeWidth={1.5} aria-hidden="true" />

/** 会话中访问被撤销的阻断页：「申请访问」打开留言弹层；发送后按钮不可用、页上写「已发送申请，等待批准」（状态初值 data.request）。 */
export function RevokedPage() {
  const r = useAccessRequest()
  return (
    <OpenFailedPage
      icon={LOCK}
      context={DOC_TITLE}
      title="访问权限已变更"
      actions={
        <>
          <RequestAccessButton />
          <Button variant="outline">返回文档列表</Button>
        </>
      }
    >
      {/* 两句各占一行：420 宽里连排会把「申请」断在两行之间 */}
      <span className="block">你已无法查看或编辑此文档，未同步的更改已随之丢弃</span>
      {!r.sent && <span className="block">可以向文档所有者申请访问，获得批准后即可重新打开</span>}
      <RequestSentLine sent={r.sent} />
    </OpenFailedPage>
  )
}

/** 查看人数已满的阻断页（打开时握手被拒）：只有「返回文档列表」；名额空出时自动打开。 */
export function ViewersFullPage() {
  return (
    <OpenFailedPage icon={<Users size={32} strokeWidth={1.5} aria-hidden="true" />} context={DOC_TITLE} title="文档当前查看人数已达上限" actions={<Button variant="outline">返回文档列表</Button>}>
      有名额空出时会自动打开，保持此页即可
    </OpenFailedPage>
  )
}
