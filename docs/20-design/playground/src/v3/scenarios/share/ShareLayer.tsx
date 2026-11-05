import { useLayoutEffect } from "react"
import { useEditor, useEditorCommand, useSceneState, useSharePending } from "../../kit"
import type { AccessRequest } from "./people"
import { ShareDialog, type ShareSeed } from "./ShareDialog"

/*
 * 待处理的访问申请数（rulings §4.25 DS-48：有待处理申请时「分享」按钮右上角带强调色小圆点，工具提示与读屏名「分享（N 个待处理的访问申请）」；
 * 检查器顶行与网格右上胶囊是同一个按钮）：由这里按对话框里「访问申请 N」的同一份数据（场景仓 share.requests）实时写进 kit useSharePending（场景仓 v3.share.pending）——
 * 批准 / 拒绝后随之减少，没有申请时为 0；别的场景不写，读的一方缺省 0，第 1 批与其余状态不受影响。按钮是底座件（editor/chrome.tsx ShareButton，第 2 批第 6 轮集成补上圆点与读屏名）。
 */

/**
 * 分享对话框的入口（03-08 / DS-1）：检查器顶行的「分享」（网格视图与紧凑形态在右上「协作与分享」胶囊里，同一个锚点 share）。
 * 底座「分享」点了发命令 share（kit/commands.ts），这里接住、用 useSceneState 记开关：关掉后再点「分享」重新打开，
 * 焦点由 kit Dialog 交还给按下的那个「分享」（场景状态里一出现就开着的，关闭后交给锚点 share）。「分享」不可用（打开中、文档已被删除）时底座不发命令。
 * 同时把待处理的访问申请数写进场景仓（kit useSharePending），供「分享」按钮的待处理提示读。
 */
export function ShareLayer() {
  const { data } = useEditor()
  const seed = (data.share ?? {}) as ShareSeed
  const [open, setOpen] = useSceneState("share.open", () => !seed.closed)
  useEditorCommand("share", () => setOpen(true))
  // 与对话框（ShareDialog OwnerBody）同一个键、同一个初值：对话框关着时也读得到申请数；只有所有者处理申请（非所有者的只读视图没有这一节，也不带点）
  const [requests] = useSceneState<AccessRequest[]>("share.requests", () => seed.requests ?? [])
  const pending = (seed.view ?? "owner") === "owner" ? requests.length : 0
  const [, setPending] = useSharePending(pending)
  // 布局阶段写：第一帧画「分享」按钮时就是对的数（读的一方先挂载、按 0 初始化时也在绘制前改正）
  useLayoutEffect(() => {
    setPending(pending)
  }, [pending, setPending])
  return <ShareDialog seed={seed} open={open} onOpenChange={setOpen} />
}
