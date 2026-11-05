/** 母版与版式的真实渲染已并入底座（editor/layouts/LayoutArt.tsx）：版式画廊卡片、检查器「版式」缩略、新建的空白页与母版视图共用一份。这里只是转出。 */
export { LayoutArt, placeholdersFor, type PhDef, type PhType, type Target } from "../../editor/layouts/LayoutArt"
// 2026-10-30 母版视图改版第二步：canvas / thumb 画法的数值表与参数类型
export { LEVELS_META, PT_PER_CQW, artTextStyleOf, type ArtOverride, type ArtShape, type ArtTextStyle, type ArtTone, type ThumbFrames } from "../../editor/layouts/LayoutArt"
// 2026-10-31 core 修复：普通形状的填充 token 表（画布与检查器「填充」字段同读一份）
export { ART_FILL_TOKEN } from "../../editor/layouts/LayoutArt"
