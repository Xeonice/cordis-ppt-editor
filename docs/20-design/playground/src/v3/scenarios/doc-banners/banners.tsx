import { useEffect, useState } from "react"
import { Info, LoaderCircle, Lock, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Banner, Button, ICON, useSceneState } from "../../kit"
import { RejectedBanner } from "../offline-conflict/banners"
import { EXPORTED_NOTE, useDriftRefresh } from "./dialogs"

/**
 * doc-banners 的横幅（横幅通道，03-02 §6.2、03-12 §2、§8.6；kit Banner 高 40 含底边，DS-75）。三条都归「权限 / 文档状态」档（rulings §4.25 TB-66），
 * 底色、图标与能否关闭由第 3 批定（TB-80；rulings §4.25 DS-126 / DS-127 / DS-128，都按推荐采纳）：画法按 03-12 §2.4「浅底只给有数据风险、要用户处理的横幅」与 §2.5「六类之外一般可关闭」两条通则推出。
 * 图标与正文：状态色只给图标，正文主文字色；右侧次按钮（DS-37）。读屏：要用户立即处理的为 alert，其余 status（03-12 §15）。
 */

const noop = () => undefined
const icon = (I: typeof Info, cls: string) => <I {...ICON} aria-hidden="true" className={cn("shrink-0", cls)} />

/** 「发现新版本」横幅的标题（03-12 §8.6、50/02 §12，两种来源同一句） */
export const DRIFT_TITLE = "发现新版本，刷新后继续"

/**
 * 发现新版本（rulings §4.25 DS-126）：警告浅底 + 刷新图标（警告色）、不可关闭、唯一按钮「刷新」，读屏 alert（同「登录已过期」：不处理就不能继续编辑）。
 * 两种来源（50/02 §12）：
 * - closed：协同以 4426 / 4427 关闭（内容级插件集已变、schema 过新、协议不兼容）——会话已关闭、刷新前不接受新写入；本端还有未同步的更改时「刷新」先弹应用内确认
 *   「刷新将丢失 N 项未同步更改」（03-12 §9、DS-59：会话已关闭，没法先同步，只能先导出），没有就直接刷新；
 * - chunk：惰性代码块（图表渲染器等）重试一次仍失败——会话还在，「刷新」先同步（Session.flush，最长 10 s）：按钮换成转圈「正在保存更改…」、不可用，
 *   与「插件设置已更新」点了「重新加载」同一画法（plugins.reload-saving），同步完成即刷新；仍有未同步项时同样弹确认。
 * 与「插件设置已更新」同时成立时只出这一条（PRD 07 G-87、TB-66），文案与动作以本条为准。
 * stack：仅查看形态（< 640）按钮换到文案下方独占一行、高 44（kit Banner stack，DS-60）。
 */
export function VersionDriftBanner({ source, stack }: { source: "closed" | "chunk"; stack?: boolean }) {
  const [, setConfirm] = useDriftRefresh()
  const [saving, setSaving] = useSceneState("doc-banners.drift-saving", false)
  const action = saving ? (
    <Button variant="secondary" disabled aria-busy="true" data-v3-anchor="doc-banners.refresh">
      <LoaderCircle {...ICON} aria-hidden="true" className="motion-safe:animate-spin" />
      正在保存更改…
    </Button>
  ) : (
    <Button
      variant="secondary"
      data-v3-anchor="doc-banners.refresh"
      onClick={() => {
        if (source === "closed") setConfirm(true)
        else setSaving(true)
      }}
    >
      刷新
    </Button>
  )
  return <Banner tone="warning" role="alert" icon={icon(RefreshCw, "text-(--v3-warning)")} title={DRIFT_TITLE} actions={action} stack={stack} />
}

/** DS-126 未采纳的备选（alt-new-version-neutral）：中性底 + 刷新图标（次级文字色）、不可关闭——同「插件设置已更新」的画法，更平静，但会话已关闭、写入已受阻时看不出要紧 */
export function VersionDriftNeutralBanner() {
  const [, setConfirm] = useDriftRefresh()
  return (
    <Banner
      icon={icon(RefreshCw, "text-(--v3-text-2)")}
      role="status"
      title={DRIFT_TITLE}
      actions={
        <Button variant="secondary" data-v3-anchor="doc-banners.refresh" onClick={() => setConfirm(true)}>
          刷新
        </Button>
      }
    />
  )
}

/** 换纪元的两种标题（50/07 §9 的 4428）：本会话此前收到过导入锁定（room.locked.reason = import）写前一句，否则写后一句 */
export const EPOCH_TITLE = { replaced: "文档已替换为导入的文件", rebuilt: "文档已由管理员重建" } as const
export type EpochKind = keyof typeof EPOCH_TITLE

/**
 * 换纪元的正文（03-12 §8.6；rulings §4.25 DS-127，并入复验 N8）：写明撤销历史已清空——内容整份换了、撤销没了，
 * 这正是横幅不自动消失的理由，与降权、「有更改过大」横幅的「撤销历史已清空」（DS-58）同一说法
 */
const EPOCH_TEXT = "文档已重新载入，撤销历史已清空"

/**
 * 换纪元 · 没有未提交的更改（rulings §4.25 DS-127）：中性底 + 信息图标（次级文字色）、可关闭（×「关闭提示」）、不自动消失，读屏 status。
 * 没有数据风险，不铺浅底（03-12 §2.4）；撤销栈已清空、画布是新纪元的内容，这件事要让用户看到，所以不像「已恢复」那样 3 秒后滑走（50/07 §9 的暂行写法「3 s 后自动消失」作废）。
 */
export function EpochBanner({ kind }: { kind: EpochKind }) {
  return (
    <Banner icon={icon(Info, "text-(--v3-text-2)")} title={EPOCH_TITLE[kind]} onClose={noop} closeLabel="关闭提示">
      {EPOCH_TEXT}
    </Banner>
  )
}

/**
 * 换纪元 · 有未提交的更改（rulings §4.25 DS-127）：与「有更改过大无法同步」同一画法（03-12 §2.4 表、§8.4）——危险浅底 + 圆圈感叹号（危险色）、导出前不可关闭、读屏 alert；
 * 正文追加「N 项更改未提交」，右侧「导出为本地副本」打开 03-12 §7.2 的同一个对话框（offline-conflict ExportLayer，TB-85），导出后降级为可关闭的「已导出本地副本」。
 * 横幅件就是降权 / 更改过大那一条（offline-conflict RejectedBanner，glyph alert），这里只换标题、正文与导出后的正文（EXPORTED_NOTE）。
 */
export function EpochPendingBanner({ kind }: { kind: EpochKind }) {
  return (
    <RejectedBanner title={EPOCH_TITLE[kind]} glyph="alert" exportedNote={EXPORTED_NOTE}>
      {EPOCH_TEXT}；3 项更改未提交
    </RejectedBanner>
  )
}

/**
 * DS-127 未采纳的备选（alt-epoch-autohide）：没有未提交更改时按 50/07 §9 的暂行写法 3 秒后自动滑出（同「已恢复」），不设 ×。
 * 样张不在载入时计时：用户第一次点按或按键后才开始数 3 秒（截图里停在出现时的样子）；减少动态效果时到点直接收起，本来就没有滑出动画
 */
export function EpochAutoHideBanner({ kind }: { kind: EpochKind }) {
  const hidden = useHideAfterFirstInteraction(3000)
  if (hidden) return null
  return (
    <Banner icon={icon(Info, "text-(--v3-text-2)")} title={EPOCH_TITLE[kind]}>
      {EPOCH_TEXT}
    </Banner>
  )
}

/** 用户第一次点按或按键后 ms 毫秒变为 true（演示「出现后若干秒自动消失」，载入时不计时） */
function useHideAfterFirstInteraction(ms: number): boolean {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    let t: number | undefined
    const start = () => {
      if (t === undefined) t = window.setTimeout(() => setHidden(true), ms)
    }
    document.addEventListener("pointerdown", start, true)
    document.addEventListener("keydown", start, true)
    return () => {
      document.removeEventListener("pointerdown", start, true)
      document.removeEventListener("keydown", start, true)
      if (t !== undefined) window.clearTimeout(t)
    }
  }, [ms])
  return hidden
}

/**
 * 元素上限只读打开的标题与正文（03-12 §8.6：标题即这一句；正文写数字与出路「元素数量超过本部署的上限（实际 / 上限）；如需编辑，请联系管理员」——部署天花板只有管理员能调，60/05 §4.1）。
 * 示例数字取低于缺省硬上限 20,000 的部署天花板 15,000（这种情况只在部署调低天花板后出现，60/05 §4.1；与 offline-conflict.quota-hard「每份文档 20,000 个元素的上限」不矛盾）
 */
export const CEILING_TITLE = "文档已达元素上限，只读打开"
export const CEILING_TEXT = "元素数量超过本部署的上限（18,240 / 15,000）；如需编辑，请联系管理员"

/**
 * 文档已达元素上限，只读打开（rulings §4.25 DS-128）：与「编辑者名额已满」同一画法——中性底 + 锁形（次级文字色）、可关闭（×「关闭提示」）、没有按钮，读屏 status。
 * 不提供「重试以编辑身份加入」（元素数降到天花板以下之前结果不变，50/07 §8.1）；关掉后同步状态行与检查器顶部仍写「只读 · 文档已达元素上限」。
 * 这里没有数据风险（以只读加入，本端没有写入），不铺浅底（03-12 §2.4）
 */
export function OverCeilingBanner() {
  return (
    <Banner icon={icon(Lock, "text-(--v3-text-2)")} title={CEILING_TITLE} onClose={noop} closeLabel="关闭提示">
      {CEILING_TEXT}
    </Banner>
  )
}

/** DS-128 未采纳的备选（alt-element-cap-warning）：警告浅底 + 锁形（警告色）、不可关闭（类似 Figma 内存用尽时锁定文件的提示，更醒目；但这里没有数据风险，浅底违背 03-12 §2.4） */
export function OverCeilingWarningBanner() {
  return (
    <Banner tone="warning" icon={icon(Lock, "text-(--v3-warning)")} title={CEILING_TITLE}>
      {CEILING_TEXT}
    </Banner>
  )
}
