import { CloudOff, LoaderCircle, Lock, RefreshCw } from "lucide-react"
import { RailStatus } from "../../kit"

/**
 * main-states 场景的同步状态行（左栏文件名下方，DS-6）。
 * 工具条的各种形态（不可用、评审条、浏览条、只读提示）已并入底座：EditorConfig.mode（review / viewer）与 toolbar.disabled / comments / canEdit / hint；
 * 进度条用 kit 的 Progress；网格视图左上胶囊里的紧凑形态由底座按 rail.status 自动渲染。
 */

const SI = { size: 12, strokeWidth: 1.75, "aria-hidden": true } as const

/**
 * 文件名下方的会话状态行：图标 + 文字在同一行切换（05 §7 的六态 + 打开进度）。字号、高度与缺省「✓ 已同步」相同（12px text-2、16px 高）。
 * 只有离线用警告色图标（离线是需要用户知道的异常）；其余状态中性。
 */
export const STATUS = {
  opening: <RailStatus icon={<LoaderCircle {...SI} className="motion-safe:animate-spin" />}>正在打开…</RailStatus>,
  rest: <RailStatus icon={<LoaderCircle {...SI} className="motion-safe:animate-spin" />}>其余页面加载中 4/6</RailStatus>,
  syncing: <RailStatus icon={<RefreshCw {...SI} />}>同步中 58%</RailStatus>,
  reconnecting: <RailStatus icon={<RefreshCw {...SI} />}>重连中…</RailStatus>,
  offline: <RailStatus icon={<CloudOff {...SI} className="text-(--v3-warning)" />}>离线 · 3 项待同步</RailStatus>,
  degraded: <RailStatus icon={<Lock {...SI} />}>只读 · 权限已变更</RailStatus>,
}
