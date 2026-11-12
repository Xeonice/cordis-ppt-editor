import { useEffect, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { useEditorMaybe, usePageMaybe, useSceneState } from "../../kit"

/**
 * 偏好设置（03-23）的样张状态与文案（第 3 批 · g4）。
 * 全部是个人本地偏好（Preferences，存 cordex.prefs，设备级，50/02 §10.1）：不同步给协作者，改了即生效、没有保存按钮。
 * 例外（rulings §4.25 TB-118，NF-11、PD-10：同意须由本人作出）：diagnostics.* 两项（发送错误报告、发送使用统计）按账户记，换人时回到部署默认值。
 * 集成方锁定（TB-118）：preset 选项 preferences: { locked?: ('theme'|'locale'|'unit'|'readingOrder'|'autosave')[], values?: Partial<Preferences> }（先在 40/10 §2.5 登记）；
 * SDK 里出现的组：外观 · 语言与单位 · 编辑（仅单人 preset）· 无障碍 · 关于（通知、隐私与诊断、插件一行只在参考应用里有）。
 * 主题与账户菜单的主题同一个偏好、同一组值与顺序（浅色 / 深色 / 跟随系统，rulings §4.25 DS-90；样张的主题就是 URL 参数 theme）；出厂默认跟随系统（03-23）。
 * 文案有中英两份：语言切到 English 后对话框里的文案即时换掉、不刷新页面（EM-11、NF-06 ≤ 200 ms；样张放慢到 300 ms 以便看清转圈；编辑器其余文案在样张里仍是中文）。
 */

export type ThemePref = "light" | "dark" | "system"
export type Locale = "zh-CN" | "en-US"
export type Unit = "cm" | "in" | "pt" | "px"
export type ReadingOrder = "z" | "placeholder"
export type Autosave = "15" | "30" | "60" | "off"

/** 状态私有数据（EditorConfig.data / PageConfig.data） */
export interface SettingsData {
  /** 状态一出现对话框就开着（缺省 true） */
  sOpen?: boolean
  /** 形态：dialog 居中对话框（DS-113，缺省）· drawer 右侧抽屉 320（DS-113 未采纳的备选）· sheet 手机（< 640）的底部面板（TB-118，settings.phone） */
  sForm?: "dialog" | "drawer" | "sheet"
  /** 画不画「无障碍」一组（缺省画；DS-116 未采纳的备选 alt-reading-order-inspector 里阅读顺序在检查器，偏好设置没有这一组） */
  sA11y?: boolean
  /** 嵌入（SDK 单人 preset）：主题、语言由集成方锁定，多「编辑 › 自动保存间隔」，没有通知、隐私与诊断与插件一行 */
  sEmbed?: boolean
  /** 语言：switching 正在切到 English（一出现就在转圈，用户第一次操作后完成）· failed 语言包加载失败 */
  sLang?: "switching" | "failed"
  /** 一出现就是「已复制到剪贴板」 */
  sCopied?: boolean
  /** M3：部署开了产品遥测出口（RuntimeConfig telemetry.otlp），隐私与诊断多「发送使用统计」 */
  sTelemetry?: boolean
  /** 开发构建或 features.developerMenu：关于多「开发者面板」 */
  sDev?: boolean
}

export interface SettingsUi {
  open: boolean
  theme: ThemePref
  locale: Locale
  /** 正在切换到的语言（转圈中） */
  pending: Locale | null
  langError: boolean
  unit: Unit
  order: ReadingOrder
  autosave: Autosave
  notifyJoin: boolean
  errorReports: boolean
  usage: boolean
  copied: boolean
  /** 只给读屏的一句（切换语言成功等，polite），出现后几秒清空 */
  announce: string
  /** 打开后焦点要落到的设置项（命令面板「阅读顺序…」= order，DS-116 第二入口）；落下后清空 */
  focus: "order" | null
}

const KEY = "settings.ui"

/** 宿主信息：编辑器或页面宿主（开始页） */
export function useSettingsHost() {
  const ed = useEditorMaybe()
  const pg = usePageMaybe()
  const data = (ed?.data ?? pg?.data ?? {}) as SettingsData & Record<string, unknown>
  return { data, home: !ed && pg?.host === "home", editor: !!ed }
}

export function useSettingsUi(): [SettingsUi, (p: Partial<SettingsUi> | ((u: SettingsUi) => Partial<SettingsUi>)) => void] {
  const { data } = useSettingsHost()
  const [ui, setUi] = useSceneState<SettingsUi>(KEY, () => ({
    open: data.sOpen ?? true,
    theme: "system",
    locale: "zh-CN",
    pending: data.sLang === "switching" ? "en-US" : null,
    langError: data.sLang === "failed",
    unit: "cm",
    order: "z",
    autosave: "30",
    notifyJoin: false,
    errorReports: true,
    usage: false,
    copied: !!data.sCopied,
    announce: "",
    focus: null,
  }))
  return [ui, (p) => setUi((u) => ({ ...u, ...(typeof p === "function" ? p(u) : p) }))]
}

/** 样张的主题就是 URL 参数 theme（V3Root 读它）：只改这一个参数、replace，不新增历史（同账户菜单的主题切换） */
export function useApplyTheme(): (pref: ThemePref) => void {
  const [, setSp] = useSearchParams()
  return (pref) => {
    const t = pref === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : pref
    setSp(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set("theme", t)
        return next
      },
      { replace: true },
    )
  }
}

/** 切换语言（≤ 200 ms，NF-06；样张 300 ms）：转圈期间下拉不可用，完成后对话框文案即时换掉；失败时保留原语言并在语言一行下写原因 */
export const LANG_DELAY = 300

/** 「已复制」一行停留的时间 */
export const COPIED_MS = 4000

/** 语言切换中的演示（language-switching）：一出现就在转圈，等用户第一次点按或按键后才完成（截图定格在转圈） */
export function useFinishPendingOnInteraction(pending: Locale | null, finish: () => void) {
  const ref = useRef(finish)
  ref.current = finish
  const armed = useRef(pending !== null)
  useEffect(() => {
    if (!armed.current) return
    const go = () => {
      armed.current = false
      remove()
      window.setTimeout(() => ref.current(), LANG_DELAY)
    }
    const remove = () => {
      document.removeEventListener("pointerdown", go, true)
      document.removeEventListener("keydown", go, true)
    }
    document.addEventListener("pointerdown", go, true)
    document.addEventListener("keydown", go, true)
    return remove
  }, [])
}

/* ------------------------------------------------------------------ 文案（简体中文 / English） */

const ZH = {
  title: "偏好设置",
  description: "改动立即生效，只保存在这台设备上，不影响协作者。",
  /** SDK 单人 preset：没有协作者，不写「不影响协作者」（g4-11） */
  descriptionSolo: "改动立即生效，只保存在这台设备上。",
  appearance: "外观",
  theme: "主题",
  themeLight: "浅色",
  themeDark: "深色",
  themeSystem: "跟随系统",
  langUnits: "语言与单位",
  language: "界面语言",
  unit: "度量单位",
  unitHint: "字号、段距与固定行距始终以磅显示",
  units: { cm: "厘米 (cm)", in: "英寸 (in)", pt: "磅 (pt)", px: "像素 (px)" } as Record<Unit, string>,
  editing: "编辑",
  autosave: "自动保存间隔",
  autosaveHint: "有改动时按这个间隔交给宿主应用保存",
  autosaves: { "15": "15 秒", "30": "30 秒", "60": "1 分钟", off: "关闭" } as Record<Autosave, string>,
  a11y: "无障碍",
  order: "阅读顺序",
  orderHint: "读屏软件朗读、按 Tab 切换对象时的先后",
  orders: { z: "按叠放次序", placeholder: "按占位符次序" } as Record<ReadingOrder, string>,
  orderHints: { z: "从底层到顶层", placeholder: "标题 → 副标题 → 正文 → 其余" } as Record<ReadingOrder, string>,
  notify: "通知",
  notifyJoin: "协作者加入时提示",
  notifyJoinHint: "有人打开同一份文档时，在画布底部提示",
  privacy: "隐私与诊断",
  errorReports: "发送错误报告",
  errorReportsHint: "出错时把错误信息发给本部署的服务器，不含文档内容",
  usage: "发送使用统计",
  usageHint: "功能使用情况与性能数据，只发给本部署的服务器",
  about: "关于",
  version: "版本",
  versionValue: "0.3.2（4f2a9c1）",
  diagnostics: "诊断信息",
  diagnosticsHint: "版本、插件与近期事件，不含文档与令牌",
  copy: "复制",
  copyDiagnostics: "复制诊断信息",
  // 复制后的反馈（XG-15：对话框里按 DS-56 写在框内，文案与第 2 批插件面板统一为「已复制诊断信息」）
  copied: "已复制诊断信息",
  plugins: "插件",
  pluginsHint: "本会话有 15 个插件在运行",
  view: "查看",
  viewPlugins: "查看本会话的插件",
  devtools: "开发者面板",
  // 写它是什么（g4-10：出现条件是开发构建或 features.developerMenu，不只开发构建；内容是贡献列表、事件流、协同诊断，PS-09、CO-13）
  devtoolsHint: "贡献列表、事件流与协同诊断",
  open: "打开",
  openDevtools: "打开开发者面板",
  locked: "由宿主应用设置",
  langFailed: "语言包加载失败，已保留当前语言",
  langSwitching: "正在切换语言",
  langDone: "界面语言已切换为简体中文",
  closeHint: "关闭",
  closeSheet: "关闭偏好设置",
}

export type Strings = typeof ZH

const EN: Strings = {
  title: "Preferences",
  description: "Changes apply right away and are saved on this device only. Collaborators aren't affected.",
  descriptionSolo: "Changes apply right away and are saved on this device only.",
  appearance: "Appearance",
  theme: "Theme",
  themeLight: "Light",
  themeDark: "Dark",
  themeSystem: "System",
  langUnits: "Language and units",
  language: "Language",
  unit: "Units",
  unitHint: "Font size and paragraph spacing always use points",
  units: { cm: "Centimeters (cm)", in: "Inches (in)", pt: "Points (pt)", px: "Pixels (px)" },
  editing: "Editing",
  autosave: "Autosave every",
  autosaveHint: "Saves to the host app at this interval when there are changes",
  autosaves: { "15": "15 seconds", "30": "30 seconds", "60": "1 minute", off: "Off" },
  a11y: "Accessibility",
  order: "Reading order",
  orderHint: "The order screen readers and Tab follow on a slide",
  orders: { z: "By stacking order", placeholder: "By placeholder order" },
  orderHints: { z: "Back to front", placeholder: "Title → subtitle → body → others" },
  notify: "Notifications",
  notifyJoin: "Notify me when collaborators join",
  notifyJoinHint: "Shows a notice when someone opens the same document",
  privacy: "Privacy and diagnostics",
  errorReports: "Send error reports",
  errorReportsHint: "Sends error details to this deployment's server, without document content",
  usage: "Send usage statistics",
  usageHint: "Feature usage and performance data, sent only to this deployment's server",
  about: "About",
  version: "Version",
  versionValue: "0.3.2 (4f2a9c1)",
  diagnostics: "Diagnostics",
  diagnosticsHint: "Version, plugins and recent events; no document content or tokens",
  copy: "Copy",
  copyDiagnostics: "Copy diagnostics",
  copied: "Diagnostics copied",
  plugins: "Plugins",
  pluginsHint: "15 plugins running in this session",
  view: "View",
  viewPlugins: "View plugins in this session",
  devtools: "Developer panel",
  devtoolsHint: "Contributions, event stream and collaboration diagnostics",
  open: "Open",
  openDevtools: "Open developer panel",
  locked: "Set by the host app",
  langFailed: "Couldn't load the language pack. Kept the current language.",
  langSwitching: "Switching language",
  langDone: "Language changed to English",
  closeHint: "Close",
  closeSheet: "Close preferences",
}

export const STRINGS: Record<Locale, Strings> = { "zh-CN": ZH, "en-US": EN }

/** 语言名用各自的写法（autonym），两种界面语言下相同 */
export const LOCALE_NAMES: Record<Locale, string> = { "zh-CN": "简体中文", "en-US": "English" }

/** 诊断信息（EM-12 diagnostics.dump() 的样子）：不含文档内容与令牌 */
export const DIAGNOSTICS_TEXT = JSON.stringify(
  { app: "cordex-web", version: "0.3.2", build: "4f2a9c1", locale: "zh-CN", plugins: 15, events: "最近 200 条事件的名称与非内容属性（截断）" },
  null,
  2,
)
