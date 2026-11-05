import { useEditor, useSceneState } from "../../kit"
import { EXPORT_COPY } from "../offline-conflict/banners"
import { ExportLayer, LeaveGuard, UnsyncedConfirm } from "../offline-conflict/dialogs"

/**
 * doc-banners 的确认框（03-12 §9 应用内的离开与刷新，DS-59）：会话已因发现新版本关闭（4426 / 4427），本端还有 3 项没提交到服务器的更改——
 * 横幅「刷新」与主菜单「返回首页」都先弹应用内确认，就是第 2 批 offline-conflict 的「刷新 / 离开将丢失 N 项未同步更改」（UnsyncedConfirm、LeaveGuard，kit Dialog confirm，sm 360）：
 * 左下「导出为本地副本」（03-12 §7.2 的同一个对话框，offline-conflict ExportLayer）、右侧安全项「取消 / 留下」与危险色「仍要刷新 / 仍要离开」，
 * 用户打开时初始焦点在安全项，关闭后焦点回到触发处（横幅的「刷新」/ 主菜单按钮）。
 * 第一句按原因换（03-12 §9 的写法）：原因 drift「发现新版本，这些更改还没有提交到服务器。」——第 3 批转正时并入 offline-conflict UnsyncedConfirm 的原因表
 * （刷新确认也按原因换第一句），原来在这里照抄的确认框随之删去。
 */

/**
 * 「导出本地副本」第二句按原因换（rulings §4.25 DS-129）：换纪元、发现新版本时用户没有失去编辑权限，不写降权的「获得编辑权限后…」——
 * REDO_NOTE 是导出对话框说明的第二句（offline-conflict ExportDialog / ExportLayer 的 redo），EXPORTED_NOTE 是导出后「已导出本地副本」的正文（RejectedBanner exportedNote）。
 * 按原因的整张表在 offline-conflict/banners.tsx 的 EXPORT_COPY（第 2 批那几态 2026-10-22 已按它改），这里取换纪元那一行，文字不变
 */
export const REDO_NOTE = EXPORT_COPY.epoch.redo
export const EXPORTED_NOTE = EXPORT_COPY.epoch.exported

/** 横幅「刷新」打开的确认框开着没有（场景内共享状态，初值 data.refreshOpen；换状态即复位） */
export function useDriftRefresh() {
  const { data } = useEditor()
  return useSceneState("doc-banners.refresh-open", !!data.refreshOpen)
}

/**
 * 会话已因发现新版本关闭时的两个确认框 + 导出对话框（一份）：横幅「刷新」→ 刷新确认（关闭后焦点回横幅的「刷新」）；
 * 主菜单「返回首页」（底座命令 home）→ 离开确认（第 2 批 LeaveGuard，原因 drift）。
 * 导出对话框关闭后焦点交回横幅的「刷新」（从离开确认打开时触发处是主菜单，确认框已收起，同 offline-conflict.quarantine 的接法）。
 */
export function DriftGuards() {
  const [refreshOpen, setRefreshOpen] = useDriftRefresh()
  return (
    <>
      <UnsyncedConfirm kind="refresh" cause="drift" open={refreshOpen} onOpenChange={setRefreshOpen} returnFocus="doc-banners.refresh" />
      <LeaveGuard cause="drift" withExport={false} />
      <ExportLayer returnFocus="doc-banners.refresh" redo={REDO_NOTE} />
    </>
  )
}
