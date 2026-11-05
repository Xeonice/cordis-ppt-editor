import { useEditor, useSceneState, useTakeoverOpen, LI, ME } from "../../kit"
import { buildList, DELETED, EMPTY_DAYS, flatVersions, MORE, namedVersion, NEW_NAME, OLDER, PROPOSAL, RECENT, restoredVersions, type Deleted, type Item, type Version } from "./data"
import type { DeckKey } from "./slides"

/**
 * 版本历史场景的共享状态（kit useSceneState：左栏、画布、横幅、检查器整栏面板读写同一份，换状态即复位）。
 * 各状态的初值写在 EditorConfig.data.vh（VhData）。整栏面板的开关是底座的 useTakeoverOpen()（inspector.takeover 声明在场景级；状态出现时收着的写 inspector.takeoverOpen: false）。
 */

export type VhStatus = "ready" | "loading" | "error" | "empty" | "offline" | "offline-cached"
export type VhToast = "named" | "name-limit" | "restored" | "restored-remote" | "purged" | "copied"

export interface VhData {
  /** 选中的版本（缺省 current = 当前版本，画布是正在编辑的文档） */
  selected?: string
  /** 展开的自动版本分组 / 月份 */
  expanded?: string[]
  /** 列表滚到这一项（分组或月份 id） */
  scrollTo?: string
  /** 命名表单开着（带示例输入） */
  naming?: boolean
  /** 命名版本已达上限（每文档 200）：「保存」返回 409，表单留着、出错误提示 */
  limit?: boolean
  /** 恢复确认卡开着 */
  confirm?: boolean
  /** 备选 alt-confirm-dialog：恢复确认用模态确认框（横幅「恢复此版本」打开的是对话框，不是确认卡） */
  confirmDialog?: boolean
  /** 加载状态 */
  status?: VhStatus
  /** 所选版本的大预览还在加载（快照较大） */
  previewLoading?: boolean
  /** 角色：owner 所有者（缺省）· editor 编辑者（只能浏览与预览，rulings U-09、§4.18 UX-17） */
  role?: "owner" | "editor"
  /** 已恢复到「提案定稿」：今天最前面多出恢复版本与恢复前的自动版本；by 谁恢复的 */
  restored?: "me" | "li"
  /** 已命名当前版本：今天最前面多出命名版本 */
  named?: boolean
  /** 最近删除展开 */
  deletedOpen?: boolean
  /** 彻底删除确认对话框开着（元素 id） */
  purge?: string
  /** 一出现就显示的轻提示 */
  toast?: VhToast
  /** 编辑者状态：「恢复此版本」的不可用原因提示常开 */
  tipOpen?: boolean
  /** 整栏面板宽度（缺省 280 = 检查器宽，备选 400 = DS-26 先例） */
  width?: number
}

export function useVhData(): VhData {
  return (useEditor().data.vh ?? {}) as VhData
}

/** 状态一出现时「今天」最前面已有的新增版本（命名、恢复），新的在前 */
function initialExtra(d: VhData): Version[] {
  const out: Version[] = []
  if (d.named) out.push(namedVersion(NEW_NAME.name, NEW_NAME.note))
  if (d.restored) out.push(...restoredVersions(PROPOSAL, [d.restored === "li" ? LI : ME]))
  return out
}

/** 版本历史的全部共享状态与派生值 */
export function useVh() {
  const d = useVhData()
  const ed = useEditor()
  const [open, setOpen] = useTakeoverOpen()
  const [selected, setSelected] = useSceneState<string>("version-history.selected", d.selected ?? "current")
  const [expanded, setExpanded] = useSceneState<string[]>("version-history.expanded", d.expanded ?? [])
  const [naming, setNaming] = useSceneState<boolean>("version-history.naming", !!d.naming)
  const [confirm, setConfirm] = useSceneState<boolean>("version-history.confirm", !!d.confirm)
  const [status, setStatus] = useSceneState<VhStatus>("version-history.status", d.status ?? "ready")
  const [previewLoading, setPreviewLoading] = useSceneState<boolean>("version-history.preview-loading", !!d.previewLoading)
  /** 当前文档的内容：live = 编辑器的 deck；在这个场景里点「确认恢复」之后换成所恢复版本的内容 */
  const [live, setLive] = useSceneState<DeckKey>("version-history.live", "live")
  /** 「今天」最前面新增的版本（命名、恢复），新的在前；与今天原有的版本一起收组（data.ts buildList） */
  const [extra, setExtra] = useSceneState<Version[]>("version-history.extra", () => initialExtra(d))
  const [more, setMore] = useSceneState<"idle" | "loading" | "done">("version-history.more", "idle")
  const [toast, setToast] = useSceneState<VhToast | null>("version-history.toast", d.toast ?? null)
  // 空态是刚导入的文档：还没有删除过什么
  const [deleted, setDeleted] = useSceneState<Deleted[]>("version-history.deleted", d.status === "empty" ? [] : DELETED)
  /** 最近一次恢复到哪个版本（提示文案用），如「提案定稿」 */
  const [restoredFrom, setRestoredFrom] = useSceneState<string>("version-history.restored-from", d.restored ? "「提案定稿」" : "")

  const role = d.role ?? "owner"
  const offline = status === "offline" || status === "offline-cached"
  // 列表由每天的版本推导（收组、组的条数与起止、月份摘要，data.ts groupDay / monthItem）；空态是刚导入的文档，只有今天的导入版本、没有更早的月份
  const empty = status === "empty"
  const list: Item[] = buildList(empty ? EMPTY_DAYS : RECENT, empty ? [] : OLDER, extra, more === "done" ? MORE : [])
  const all = flatVersions(list)
  const version: Version | undefined = selected === "current" ? undefined : all.find((v) => v.id === selected)
  /** 正在预览历史版本：画布与左栏显示所选版本、横幅通道出预览横幅、工具条收起 */
  const previewing = open && !!version

  /** 不可用原因（undefined = 可用） */
  const restoreReason = role === "editor" ? "需要所有者权限" : offline ? "恢复连接后才能恢复版本" : previewLoading ? "版本加载完成后可用" : undefined
  const nameReason = role === "editor" ? "需要所有者权限" : offline ? "离线时不可用" : undefined
  const purgeReason = offline ? "离线时不可用" : undefined

  return {
    data: d,
    ed,
    open,
    setOpen,
    selected,
    setSelected,
    expanded,
    setExpanded,
    naming,
    setNaming,
    confirm,
    setConfirm,
    status,
    setStatus,
    previewLoading,
    setPreviewLoading,
    live,
    setLive,
    extra,
    setExtra,
    more,
    setMore,
    toast,
    setToast,
    deleted,
    setDeleted,
    restoredFrom,
    setRestoredFrom,
    role,
    offline,
    list,
    version,
    previewing,
    restoreReason,
    nameReason,
    purgeReason,
    width: d.width ?? 280,
  }
}

export type Vh = ReturnType<typeof useVh>
