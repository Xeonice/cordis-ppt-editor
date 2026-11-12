import type { ReactNode } from "react"
import { CircleAlert, CircleCheck } from "lucide-react"
import { Button, Dialog, ICON, InspectorTakeover, MainMenuLayer, Toast, Toasts, useEditorCommand } from "../../kit"
import { feedbackText, PluginPanelBody } from "./PluginList"
import { usePlugins } from "./store"

/**
 * 对话框形态的固定高度（与内容无关）：720，视口不够时取视口高减 64（kit Dialog 的最大高）。能放下常见列表的头部、计数行与约 10 行，
 * 列表更长时在对话框内部滚动；加载中、加载失败也是这个高度、内容在框内居中——打开后、数据到了、重试之后框体都不跳
 * （原来加载与出错撑满视口高减 64 = 936、加载完成后随内容 851–936，换态时框体上下跳）
 */
const DIALOG_HEIGHT = "h-[min(720px,calc(100dvh-64px))]"

/**
 * 个人插件面板的两种呈现（03-09；入口主菜单「插件…」，DS-18、DS-21）：
 *   - 推荐：居中模态对话框（03-09 §2：宽 640 = kit lg，固定高 720〔视口不够时为视口减 64〕，内容区独立滚动）。插件管理是设置类、低频、与当前选中无关，
 *     一行要放状态 + 开关 + 展开（需要宽行），对话框不占检查器（rulings §4.25 DS-38；标杆对照改过的理由：不再援引 Figma「Manage plugins」）。
 *     模态遮罩会盖住画布底部的轻提示，所以开关、重试、复制的结果写在对话框底栏（polite 播报 +「撤销」），不另弹轻提示。
 *   - 备选：检查器整栏面板（kit InspectorTakeover，DS-26 先例，栏宽 400）：非模态、画布仍可操作，开关结果走画布底部的轻提示。
 * 打开时焦点：用户打开的对话框落在对话框本身（kit Dialog initialFocus="dialog"，不自动聚焦第一个开关，避免误触，03-09 §2），整栏面板落在列表区；
 * 状态里一出现就打开的不抢焦点。入口：底座主菜单「插件…」发命令 plugins（kit/commands.ts），这里接住。
 */

/** 对话框形态的宿主：放在每个状态的 layers 里（开关由场景状态 plugins.ui.open 管，主菜单「插件…」、横幅「查看详情」都打开它）；两种形态的「插件…」命令都在这里接 */
export function PluginsDialogHost() {
  const api = usePlugins()
  useEditorCommand("plugins", api.openPanel)
  if (api.form !== "dialog") return null
  const fb = feedbackText(api)
  return (
    <Dialog
      title="插件"
      description="本会话已装配的插件。「我的界面插件」只影响你，不影响协作者，也不会进入文档。"
      size="lg"
      open={api.ui.open}
      onOpenChange={(v) => api.set({ open: v, feedback: v ? api.ui.feedback : null })}
      // 打开它的控件还在（横幅、检查器的「查看详情」）时焦点交回它；触发处已随菜单卸载时交回 returnTo（右键的占位），缺省主菜单按钮
      returnFocus={api.ui.returnTo ?? "main-menu"}
      initialFocus="dialog"
      bodyClassName="p-0"
      // 各状态同一个固定高度（DIALOG_HEIGHT）：加载中、加载失败、列表都在这个框里，空态 / 加载 / 出错在框内居中，列表超出时框内滚动
      className={DIALOG_HEIGHT}
      footerStart={
        fb ? (
          <p className="flex min-w-0 items-start gap-2 text-[12px] leading-4">
            {fb.tone === "success" && <CircleCheck {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-success)" />}
            {fb.tone === "error" && <CircleAlert {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-danger)" />}
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-(--v3-text)">{fb.title}</span>
              {fb.description && <span className="text-(--v3-text-2)">{fb.description}</span>}
            </span>
          </p>
        ) : undefined
      }
      footer={
        fb?.undo ? (
          <Button variant="secondary" onClick={api.undo}>
            撤销
          </Button>
        ) : undefined
      }
    >
      <ListRegion>
        <PluginPanelBody />
      </ListRegion>
    </Dialog>
  )
}

/**
 * 列表区：可聚焦的滚动区域（读屏名「插件列表」），键盘可直接上下滚动。对话框形态打开时焦点落在对话框本身（initialFocus="dialog"），Tab 先到这里；
 * 整栏面板形态打开时 InspectorTakeover 把焦点给内容区第一个可聚焦项——就是它，不是第一个开关（03-09 §2）。
 */
function ListRegion({ children }: { children: ReactNode }) {
  return (
    <div role="region" aria-label="插件列表" tabIndex={0} className="flex min-h-full flex-col focus-visible:outline-offset-[-2px]">
      {children}
    </div>
  )
}

/** 备选：检查器整栏面板形态（inspector.takeover 直接声明，一出现就开着；「关闭」/ Esc 收起，主菜单「插件…」再打开） */
export function PluginsTakeover() {
  return (
    <InspectorTakeover title="插件" subtitle="本会话已装配的插件；「我的界面插件」只影响你" returnFocus="main-menu" width={400}>
      <ListRegion>
        <PluginPanelBody compact />
      </ListRegion>
    </InspectorTakeover>
  )
}

/** 整栏面板形态的反馈：画布底部的轻提示（非模态，看得见）；对话框形态的反馈在对话框底栏 */
export function PluginsToasts() {
  const api = usePlugins()
  const fb = feedbackText(api)
  if (api.form !== "takeover" || !fb) return null
  return (
    <Toasts>
      <Toast
        key={JSON.stringify(api.ui.feedback)}
        tone={fb.tone ?? "neutral"}
        description={fb.description}
        action={fb.undo ? "撤销" : undefined}
        onAction={fb.undo ? api.undo : undefined}
        onClose={() => api.set({ feedback: null })}
      >
        {fb.title}
      </Toast>
    </Toasts>
  )
}

/** 静态打开的主菜单，「插件…」设为当前项（入口演示，DS-18）；选它发底座命令 plugins，打开面板 */
export function PluginsMenuLayer() {
  return <MainMenuLayer highlight="插件…" />
}
