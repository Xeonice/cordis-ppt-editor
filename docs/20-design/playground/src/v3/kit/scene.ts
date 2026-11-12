import { useCallback, useSyncExternalStore } from "react"
import { useEditorMaybe } from "../editor/context"
import { createSceneStore, type SceneStore } from "../editor/scene"
import { usePageMaybe } from "../page/context"

/** 不在编辑器里（如单独渲染的组件）时的兜底仓。 */
const FALLBACK: SceneStore = createSceneStore()

export type SetSceneState<T> = (v: T | ((prev: T) => T)) => void

/**
 * 场景内跨区域共享的状态（如画廊开关、搜索词、查找命中、缩放比例）：同一次编辑器挂载里，左栏、画布、检查器、浮层读写同一份；
 * 换场景状态（编辑器重新挂载）时自动复位。init 只在第一次读取时生效（各处传同一个值；需要按状态取初值就读 useEditor().data）。
 * key 建议带场景前缀，如 "layout-picker.open"。
 *
 *   const [open, setOpen] = useSceneState("layout-picker.open", !!data.lpOpen)
 */
export function useSceneState<T>(key: string, init: T | (() => T)): [T, SetSceneState<T>] {
  // 页面宿主（第 3 批，PageHost.tsx）与编辑器各自每次挂载新建一个仓；两个都不在时用兜底仓
  const page = usePageMaybe()
  const editor = useEditorMaybe()
  const store = page?.scene ?? editor?.scene ?? FALLBACK
  if (!store.has(key)) store.init(key, typeof init === "function" ? (init as () => T)() : init)
  useSyncExternalStore(store.subscribe, store.version, store.version)
  const value = store.get(key) as T
  const set = useCallback<SetSceneState<T>>(
    (v) => {
      const prev = store.get(key) as T
      store.set(key, typeof v === "function" ? (v as (p: T) => T)(prev) : v)
    },
    [store, key],
  )
  return [value, set]
}
