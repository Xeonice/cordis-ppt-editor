import type { MasterViewImpl } from "./types"

/**
 * 母版实现的登记口（与 registerCommentsBody、registerToolLayer、registerSlideThemeControl 同一做法）：场景模块在导入时登记一次，
 * scenario-registry 用 glob 预先导入全部场景，宿主（Editor.tsx）不需要 import 场景代码。第一步登记的是 scenarios/masters-themes/master-impl.tsx
 * （把现有母版件包成 MasterViewImpl 的适配层），第二步换成按标杆重做的件，宿主与两份契约（types.ts）不动。
 * 仅演示、不迁移：产品由 viewMode 的 when 驱动各贡献点（50/11 §2），没有这一层。
 */
let impl: MasterViewImpl | null = null

export function registerMasterView(i: MasterViewImpl) {
  impl = i
}

/** 当前登记的母版实现；没有登记时宿主不进入母版视图（入口按不可用处理） */
export function getMasterView(): MasterViewImpl | null {
  return impl
}
