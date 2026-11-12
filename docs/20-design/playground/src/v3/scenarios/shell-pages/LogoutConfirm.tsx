import { useEffect } from "react"
import { useEditor, useEditorCommand, useSceneState } from "../../kit"
import { EXPORT_COPY, useExportFlow } from "../offline-conflict/banners"
import { ExportDialog, LeaveGuard, UnsyncedConfirm } from "../offline-conflict/dialogs"
import { useGo } from "./pages"

/**
 * 退出登录时还有未同步更改（前端 50/02 §10.2 第 1 步；PRD AS-06）才弹这个模态确认，没有时直接退出（rulings §4.25 DS-40 第三档：
 * 不可撤销的丢弃用模态确认，初始焦点在安全项「取消」）。走向与第 2 批已拍板的离开确认（offline-conflict.leave-confirm，DS-59）相同
 * （rulings §4.25 TB-122）：判断前先尝试同步（≤ 5 / 10 s），仍有未同步项才弹；导出后回到编辑器、不自动退出。画法也相同：
 *   标题写条数 · 说明两句（每句一行、句末句号，DS-62）· 左下「导出为本地副本」· 右侧「取消」+ 危险色「仍要退出」。
 * 就是第 2 批的 UnsyncedConfirm（kind logout，第 3 批转正时并入）：第一句与离开确认同一张按原因换的表（离线 / 登录已过期 / 协同已暂停 / 服务器保存延迟，
 * 动词「离开」换成「退出」），样张只画离线一种；本文件只留开关、底座命令的接线与导出后的焦点。
 * 账户菜单「退出登录」发底座命令 account.logout（第 3 批转正并入）：本状态由这里接住、打开这个确认；没有场景接住时按 shell-pages 的 provides 直接转到登录页。
 * 「导出为本地副本」打开第 2 批同一个导出本地副本对话框；导出后回到编辑器，再点「退出登录」时仍有未同步项就再弹这个确认。
 * 「仍要退出」：按 50/02 §10.2 第 2–4 步 POST /auth/logout、清理本地数据、整页跳 IdP 登出后回到登录页（样张转到 shell-pages.login）。
 * 关闭后焦点回自己的头像（锚点 account，账户菜单的触发处）。
 * 同一状态里主菜单「返回首页」照样先弹第 2 批的离开确认（LeaveGuard），两个确认共用一个导出对话框：从哪个确认打开，关闭后焦点就回哪个确认的触发处。
 */

/**
 * 导出本地副本对话框说明的第二句：离线 / 退出登录写「恢复连接后可以对照重做」（rulings §4.25 DS-129：按原因换第二句；
 * 第 2 批的缺省是降权原句「获得编辑权限后…」，这里用户并没有失去编辑权限）。本状态里离开确认与退出确认共用这一个导出对话框，两处都是离线。
 * 文案取 offline-conflict/banners.tsx 的同一张表（EXPORT_COPY.offline），文字不变
 */
const REDO_OFFLINE = EXPORT_COPY.offline.redo

export function LogoutGuard() {
  const { data } = useEditor()
  const go = useGo()
  const [open, setOpen] = useSceneState("shell-pages.logout-open", !!data.logoutOpen)
  // 账户菜单「退出登录」（底座命令）：有未同步更改，先确认
  useEditorCommand("account.logout", () => setOpen(true))
  // 离开确认（LeaveGuard）的开关在同一个场景仓里：记下导出对话框是从哪个确认打开的
  const [leaveOpen] = useSceneState("offline-conflict.leave-open", false)
  const [from, setFrom] = useSceneState<"logout" | "leave">("shell-pages.export-from", "logout")
  useEffect(() => {
    if (open) setFrom("logout")
  }, [open, setFrom])
  useEffect(() => {
    if (leaveOpen) setFrom("leave")
  }, [leaveOpen, setFrom])
  const exp = useExportFlow()
  return (
    <>
      <UnsyncedConfirm kind="logout" cause="offline" open={open} onOpenChange={setOpen} onConfirm={() => go("/v3/page", "shell-pages.login")} />
      <LeaveGuard cause="offline" withExport={false} />
      <ExportDialog
        open={exp.open}
        onOpenChange={exp.setOpen}
        onExport={() => exp.setExported(true)}
        returnFocus={from === "leave" ? "main-menu" : "account"}
        redo={REDO_OFFLINE}
      />
    </>
  )
}
