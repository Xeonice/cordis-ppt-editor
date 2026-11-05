import { createContext, useContext } from "react"
import type { SceneStore } from "../editor/scene"
import type { V3Accent, V3Host, V3Theme } from "../params"

/**
 * 页面级宿主（第 3 批：home / documents / templates / admin/plugins / page / embed，PageHost.tsx）的运行时上下文：
 * 场景的 body / overlay / layers 插槽里的组件用 usePage() 读状态数据与宿主信息。编辑器宿主仍用 useEditor()（editor/context.ts）。
 * 场景内跨区域共享的状态照常用 kit 的 useSceneState（页面宿主每次挂载新建一个仓，换状态即复位，同编辑器）。
 */
export interface PageCtx {
  /** 当前宿主 */
  host: V3Host
  /** 场景 id 与状态 id（URL state=<场景>.<状态>）；首页不带 state 时为 "home" / "default" */
  scenarioId: string
  stateId: string
  /** 状态私有数据（PageConfig.data，场景级与状态级逐字段合并） */
  data: Record<string, unknown>
  theme: V3Theme
  accent: V3Accent
  /** 场景内跨区域共享的状态仓（kit useSceneState 读写它，不必直接碰） */
  scene: SceneStore
}

export const PageContext = createContext<PageCtx | null>(null)

/** 在页面宿主的场景组件里读状态；只能在页面宿主（#/v3/home、documents、templates、admin/plugins、page、embed）内使用。 */
export function usePage(): PageCtx {
  const ctx = useContext(PageContext)
  if (!ctx) throw new Error("usePage() 只能在 v3 页面宿主（#/v3/home、documents、templates、admin/plugins、page、embed）内使用")
  return ctx
}

/** 同 usePage，但不在页面宿主内时返回 null（编辑器与页面宿主都可能渲染的组件用）。 */
export function usePageMaybe(): PageCtx | null {
  return useContext(PageContext)
}
