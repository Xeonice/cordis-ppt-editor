import { Check, RefreshCw } from "lucide-react"
import { RailStatus } from "../../kit"
import { useExport } from "./model"

/**
 * export 场景的小件：左栏同步状态行（随「等待同步」倒数实时变）。
 * 没有导出权限时主菜单「文件 › 导出…」的置灰（原 fileItemsWithoutExport / NO_EXPORT_REASON）在第 3 批转正时并入底座：kit exportReasonOf 按模式、编辑权限与降权取原因
 * （查看者「只有查看权限」、评审者与编辑中被降权「需要编辑权限」，rulings §4.25 DS-105），⇧⌘E 同时无效。
 */

const SI = { size: 12, strokeWidth: 1.75, "aria-hidden": true } as const

/** 这一批待同步的更改条数（打开对话框时还没获服务端确认的 3 项；等待同步一态剩 2 项，即已确认 1 项） */
const SYNC_BATCH = 3

/**
 * 左栏文件名下方的同步状态行：与第 1 批已拍板的写法同一格式「同步中 N%」（03-02 §3.1 表、main-states.syncing；12px 刷新图标 + 文字、text-2，中性），
 * 不另造「同步中…」。百分比 = 这一批更改里已获服务端确认的比例：3 项都未确认 0%，剩 2 项 33%、剩 1 项 67%；
 * 「等待同步」倒数归零后回到缺省的「✓ 已同步」——与对话框里的条数是同一份数据
 */
export function LiveSyncStatus() {
  const { ui } = useExport()
  if (ui.unsynced <= 0) return <RailStatus icon={<Check {...SI} />}>已同步</RailStatus>
  const total = Math.max(SYNC_BATCH, ui.unsynced)
  const pct = Math.round(((total - ui.unsynced) / total) * 100)
  return <RailStatus icon={<RefreshCw {...SI} />}>{`同步中 ${pct}%`}</RailStatus>
}
