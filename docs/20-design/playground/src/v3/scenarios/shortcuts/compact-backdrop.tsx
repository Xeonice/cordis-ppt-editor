import { CompactStage, CompactToolbar, InspectorDrawer, RailDrawer } from "../narrow/compact"
import { MASTER_REASON } from "../narrow/data"
import type { EditorConfig } from "../types"

/**
 * 紧凑形态（640–1024，03-02 §5a、50/10 §2.2）的编辑器外壳，给设置与快捷键面板的「紧凑窗口」状态当背景：借用第 1 批已拍板的 narrow 场景的件
 * （左上「文档」胶囊、右上「协作与分享」胶囊、两侧抽屉先收着、底部工具条，narrow/compact.tsx），不另画一份。data.form = compact 与 narrow 场景同一个键：
 * 快捷键面板据此让到右上胶囊下方（同紧凑形态的查找面板 narrow.compact-find）。主菜单「帮助」两项照样发底座命令（底座 MainMenu 的缺省），「母版视图」不可用写「在更大窗口中编辑」（TB-44）。
 */
export const COMPACT_BACKDROP: EditorConfig = {
  data: { form: "compact" },
  rail: { menu: { master: { reason: MASTER_REASON } } },
  regions: {
    leftRail: (_, d) => <RailDrawer d={d} />,
    inspector: (_, d) => <InspectorDrawer d={d} />,
    stage: (_, d) => <CompactStage d={d} />,
    toolbar: (_, d) => <CompactToolbar d={d} />,
  },
}
