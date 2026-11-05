import { createContext, useContext } from "react"
import type { V3Accent, V3Theme, V3View } from "../params"
import type { DeckSlide } from "./deck"
import type { SelectionKind } from "./inspector/registry"
import type { MasterViewMode } from "./master/types"
import type { SceneStore } from "./scene"
import type { ToolId } from "./Toolbar"

/**
 * 编辑器运行时上下文：场景的叠加层、浮层、分区、整块替换（regions）里的组件用 useEditor() 读写编辑器状态。
 * 页面初始状态由 URL 的场景状态决定，之后可以正常点按（换页、改选中、换工具），这里拿到的是当前值。
 */
export interface EditorCtx {
  /** 当前场景 id 与状态 id（URL state=<场景>.<状态>）；旧状态 empty / shape / text / shapes-menu 为 legacy.<状态> */
  scenarioId: string
  stateId: string
  view: V3View
  /** 切换视图（与左栏 / 胶囊 / 主菜单同一入口逻辑：进网格时收起工具弹层、回到选择工具） */
  setView: (v: V3View) => void
  deck: DeckSlide[]
  /** 当前页页码 */
  slide: number
  /** 当前页 */
  current: DeckSlide
  /** 切到第 n 页并取消选中（同点缩略图） */
  goTo: (n: number) => void
  selection: SelectionKind
  setSelection: (k: SelectionKind) => void
  tool: ToolId
  setTool: (t: ToolId) => void
  notes: boolean
  setNotes: (v: boolean) => void
  theme: V3Theme
  accent: V3Accent
  /** 还停在场景状态的初始页与初始选中上（用户没换页、没改选中）。ReactNode 形式的 slideOverlay 只在此时显示 */
  initial: boolean
  /** 状态私有数据（EditorConfig.data） */
  data: Record<string, unknown>
  /** 模式（EditorConfig.mode 是初值）：edit / review / viewer */
  mode: "edit" | "review" | "viewer"
  /**
   * 同一状态里切换编辑 / 评审（rulings §4.25 TB-83：不重新挂载编辑器，草稿、页与选中都留着，演示 TB-84、TB-87）：主菜单「视图 › 模式」与评审条「返回编辑」调它；
   * 查看者没有模式可切，评审者（toolbar.canEdit 为 false）切不回编辑（调了不变）
   */
  setMode?: (m: "edit" | "review") => void
  /**
   * 编辑模式已降权时改文档的命令不可用的原因（状态的 rail.readonlyDegraded，典型「需要编辑权限」；03-12 readonly-degraded、DS-15）；没降权时 undefined。
   * 对象右键的只读形态按它取顶部说明（03-05 §4，如无法显示的对象 DS-64：kit degradedReadOnly）
   */
  readonlyDegraded?: string
  /**
   * 有没有编辑权限（状态的 toolbar.canEdit，缺省 true）：评审者为 false。主菜单「文件 › 导出…」按它与模式、降权置灰（rulings §4.25 DS-105：
   * 查看者「只有查看权限」、评审者与编辑中被降权「需要编辑权限」；场景里静态打开的 MainMenuLayer 与底座主菜单同一规则），⇧⌘E 同时无效
   */
  canEdit?: boolean
  /**
   * 「分享」按钮这一刻的样子（检查器顶行、网格右上胶囊、紧凑形态右上胶囊同一个按钮；由状态的 inspector.share 与 locked 算出，rulings §4.25 TB-161，editor/chrome.tsx shareReasonOf）：
   * undefined 可用；字符串 = 不可用的原因（M2「后续版本提供」DS-137、打开中、文档已被删除…）；null = 宿主没给，不渲染
   */
  shareReason?: string | null
  /** 场景内跨区域共享的状态仓（每次挂载新建）：用 kit 的 useSceneState 读写，不必直接碰它 */
  scene: SceneStore
  /**
   * 母版视图（宿主的全局模式，2026-10-28 母版视图改版第一步；editor/master/types.ts）：在不在母版视图、能不能进入（原因与主菜单同一条）、进入前的位置，
   * 与进入 / 退出 / 切换（enter 可带版式与占位符目标，exit 可带要停的页）。主菜单、⌥⌘M、命令面板、横幅都走它；kit useMasterViewMode() 取的就是它。
   * 母版视图里 view 恒为 single（URL 的 view 不改），setView 无效
   */
  masterView: MasterViewMode
}

export const EditorContext = createContext<EditorCtx | null>(null)

/** 在场景组件里读写编辑器状态；只能在 v3 编辑器内使用。 */
export function useEditor(): EditorCtx {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error("useEditor() 只能在 v3 编辑器（#/v3/editor）内使用")
  return ctx
}

/** 同 useEditor，但不在编辑器内时返回 null（给可能被单独渲染的 kit 组件用）。 */
export function useEditorMaybe(): EditorCtx | null {
  return useContext(EditorContext)
}
