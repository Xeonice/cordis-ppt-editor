/**
 * 场景内跨区域共享的状态仓：左栏、画布、检查器、浮层分别渲染在不同子树里，没有共同的父组件可放 useState。
 * 编辑器每次挂载（换场景状态时整个编辑器按 key 重新挂载）新建一个仓，放进 EditorCtx.scene；kit 的 useSceneState 读写它。
 */
export interface SceneStore {
  has(key: string): boolean
  get(key: string): unknown
  /** 首次读取时写入初值：不通知订阅者（发生在渲染期间，通知会触发「渲染中更新别的组件」） */
  init(key: string, value: unknown): void
  set(key: string, value: unknown): void
  subscribe(fn: () => void): () => void
  /** 每次 set 加一：useSyncExternalStore 的快照 */
  version(): number
}

export function createSceneStore(): SceneStore {
  const values = new Map<string, unknown>()
  const subs = new Set<() => void>()
  let ver = 0
  return {
    has: (k) => values.has(k),
    get: (k) => values.get(k),
    init(k, v) {
      if (!values.has(k)) values.set(k, v)
    },
    set(k, v) {
      if (values.has(k) && Object.is(values.get(k), v)) return
      values.set(k, v)
      ver += 1
      for (const fn of subs) fn()
    },
    subscribe(fn) {
      subs.add(fn)
      return () => {
        subs.delete(fn)
      }
    },
    version: () => ver,
  }
}
