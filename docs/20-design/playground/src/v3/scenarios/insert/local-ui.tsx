
/**
 * insert 场景的局部件：键帽与画布模式提示条已并入 kit（KeyCap、CanvasHint、HintDivider），这里只是转出，旧引用不用改。
 * 原来这里的单选（RadioRow / RadioDot）、可禁用输入框、多行输入、双动作轻提示、纸面亮色 token 岛、带禁用项的分段页签已并入 kit：
 * RadioRow、TextField（disabled / error）、TextArea、Toast 的 actions、PaperScope、Segmented 的 role="tablist" 与单项 disabled / tag。
 */

/* ------------------------------------------------------------------ 键帽与提示条 */

/** 键帽：kit 的 KeyCap（形状库底部提示与插入工具态提示条共用） */
export { KeyCap as Key } from "../../kit"

/** 画布顶部居中的模式提示条：kit 的 CanvasHint（数字跳页等提示与它同一外观） */
export { CanvasHint as ModeHint, HintDivider } from "../../kit"
