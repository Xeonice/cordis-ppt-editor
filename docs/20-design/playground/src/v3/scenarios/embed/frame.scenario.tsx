import { MainMenuLayer } from "../../kit"
import { useV3Params } from "../../params"
import { CompactStage, CompactToolbar, InspectorDrawer, RailDrawer } from "../narrow/compact"
import { EMBED_MASTER_REASON, MASTER_REASON } from "../narrow/data"
import { defineScenario, type EditorConfig } from "../types"
import { AuthRequiredPage, EmbedOpenFailedPage } from "./pages"

/**
 * embed-frame（隐藏场景，Hub 不展示）：嵌入外框（embed 场景，#/v3/embed）的 iframe 里加载的页面。
 * - 嵌入形态自己的页面（请在新窗口登录三态、嵌入里的打开失败）画在 #/v3/page 宿主（整屏 bare、画布底色）；
 * - 两个编辑器态（host editor）只为在外框里看清「嵌入里的出口」（rulings §4.25 DS-112）：完整形态与紧凑形态的主菜单静态打开——
 *   iframe 的地址带 embedded=1，底座主菜单不渲染「返回首页」，紧凑形态「视图 › 母版视图」不可用的原因写「当前区域太窄，暂不可用」。
 * 单独打开也可以（#/v3/page?state=embed-frame.<状态>，编辑器态是 #/v3/editor?state=…），就是 iframe 里的样子铺满窗口；不带 embedded=1 时主菜单与 apps/web 相同。
 * 规格写在 embed 场景对应状态的 note 里。
 */

/** 紧凑形态（第 1 批 narrow 的抽屉与胶囊原样，narrow/compact.tsx；同 narrow-review 的接法） */
const COMPACT: EditorConfig = {
  regions: {
    leftRail: (_, d) => <RailDrawer d={d} />,
    inspector: (_, d) => <InspectorDrawer d={d} />,
    stage: (_, d) => <CompactStage d={d} />,
    toolbar: (_, d) => <CompactToolbar d={d} />,
  },
}

/** 紧凑形态的主菜单（静态打开「视图」）：母版视图不可用的原因与胶囊里的主菜单同一份（嵌入里「当前区域太窄，暂不可用」） */
function CompactMenuLayer() {
  const { embedded } = useV3Params()
  return <MainMenuLayer openPath={["view"]} master={{ reason: embedded ? EMBED_MASTER_REASON : MASTER_REASON }} />
}

export default defineScenario({
  id: "embed-frame",
  title: "嵌入 · iframe 里的页面",
  specs: [],
  batch: 3,
  hidden: true,
  host: "page",
  states: [
    { id: "auth-required", title: "请在新窗口登录 · 未登录", page: { body: <AuthRequiredPage />, data: { phase: "idle" } } },
    { id: "auth-popup-open", title: "请在新窗口登录 · 登录窗口已打开", page: { body: <AuthRequiredPage />, data: { phase: "pending" } } },
    { id: "auth-blocked", title: "请在新标签页中登录 · 弹窗被拦截", page: { body: <AuthRequiredPage />, data: { phase: "blocked" } } },
    { id: "open-failed", title: "嵌入里的打开失败", page: { body: <EmbedOpenFailedPage /> } },
    { id: "editor-menu", title: "完整形态 · 主菜单", host: "editor", editor: { layers: <MainMenuLayer /> } },
    { id: "compact-menu", title: "紧凑形态 · 主菜单 › 视图", host: "editor", editor: { ...COMPACT, layers: <CompactMenuLayer /> } },
  ],
})
