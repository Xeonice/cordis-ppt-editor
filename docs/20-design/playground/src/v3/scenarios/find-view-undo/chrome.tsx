import type { ReactNode } from "react"
import { Check, HardDrive, LoaderCircle, TriangleAlert } from "lucide-react"
import { RailStatus, Tip } from "../../kit"

/**
 * 编辑器外框上的局部小件：文件名下方的保存状态行（03-19）。
 * 原来这里的「主菜单按钮的已打开底色」与「单人模式隐藏头像组」已并入底座：kit 锚定菜单自动给锚点加 data-v3-open；inspector.collaborators: { people: [] }。
 */

/* ------------------------------------------------------------------ 保存状态（SDK 嵌入的回调式保存，03-19 保存态全集） */

const STATUS_ICON = { size: 12, strokeWidth: 1.75, "aria-hidden": true } as const

/**
 * 文件名下方的保存状态行（替代原应用栏文案，DS-6）：与缺省「✓ 已同步」同一行、同一字号（12px、16px 高），只换图标、文字与颜色。
 * 只用于 SDK 嵌入的单人回调式保存（PRD EM-02 (a)）；参考应用自 M2 起是协同模式，这一行显示 05 §7 的会话状态（第 2 批）。
 * 语义色只在对应状态出现（Q3）：已保存与保存中是常态，用中性 text-2；失败用危险色、本地保存用警告色。
 */
export const SAVE_STATUS: Record<"saved" | "savedNow" | "saving" | "unsaved" | "failed" | "local", ReactNode> = {
  saved: <RailStatus icon={<Check {...STATUS_ICON} />}>已保存</RailStatus>,
  savedNow: <RailStatus icon={<Check {...STATUS_ICON} />}>已保存 · 刚刚</RailStatus>,
  saving: <RailStatus icon={<LoaderCircle {...STATUS_ICON} className="motion-safe:animate-spin" />}>保存中…</RailStatus>,
  // 未保存：没有强调文案，「已保存」消失；行高保留，下面的「新建幻灯片」不跳动。读屏仍能读到状态
  unsaved: (
    <RailStatus>
      <span className="sr-only">有未保存的更改</span>
    </RailStatus>
  ),
  failed: (
    <RailStatus icon={<TriangleAlert {...STATUS_ICON} />} className="text-(--v3-danger)">
      <Tip label="保存请求失败，更改仍保留在本机；之后的编辑会合并进下一次重试">
        <span>保存失败</span>
      </Tip>
      <span aria-hidden="true" className="text-(--v3-text-3)">
        ·
      </span>
      <button type="button" className="rounded-[2px] font-medium text-(--v3-text) hover:underline">
        重试
      </button>
    </RailStatus>
  ),
  local: (
    <RailStatus icon={<HardDrive {...STATUS_ICON} />} className="text-(--v3-warning)">
      <Tip label="集成方的保存服务暂时不可达，更改已保存在本机，恢复后自动保存">
        <span>已在本地保存</span>
      </Tip>
    </RailStatus>
  ),
}
