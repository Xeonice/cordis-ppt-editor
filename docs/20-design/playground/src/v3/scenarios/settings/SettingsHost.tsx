import { useEffect } from "react"
import { BottomSheet, Dialog, Drawer, scrollIntoPanel } from "../../kit"
import { useV3Params } from "../../params"
import { usePlugins } from "../plugins/store"
import { useAppWiring } from "../shortcuts/nav"
import { STRINGS, LANG_DELAY, useApplyTheme, useFinishPendingOnInteraction, useSettingsHost, useSettingsUi, type Locale } from "./prefs"
import { Says, SettingsBody } from "./SettingsBody"

/** 「阅读顺序」下拉（SettingsBody 给它挂的锚点）：命令面板「阅读顺序…」打开偏好设置后焦点落在这里 */
const ORDER_TRIGGER = '[data-v3-anchor="settings.reading-order"]'

/**
 * 偏好设置的宿主（03-23；第 3 批 · g4）。rulings §4.25 DS-113：居中模态对话框——kit Dialog md 480，标题「偏好设置」+ 说明一句，高随内容，
 * 超出时正文滚动、标题与说明固定；顶部锚定、只向下伸展（09 §3.4：内容会增减的对话框——语言包失败多一行、M3 的使用统计多一行，
 * 标题不随之上下移动；最高到视口底留 32）；改了即生效、没有保存按钮；× / Esc / 点遮罩关闭，焦点回打开它的控件，它已随菜单卸载时回自己的头像或开始页左栏的用户行（锚点都是 account）。
 * 几何（DS-113 写明）：水平居中、顶部锚定在 max(64px, 12vh)、只向下伸展，最高到视口底留 32（kit Dialog anchor="top"；视口 1000 高时顶 120、最高 848，760 高时顶 91、最高 637）。
 * 未采纳的备选（settings.alt-drawer）：右侧贴边整高抽屉 320、带遮罩（kit Drawer，盖住检查器），同一份正文换成上下排的 stack 布局。
 * 手机（< 640，settings.phone，rulings §4.25 TB-118）：仅查看形态那种贴底的底部面板（kit BottomSheet，上沿留 24；2026-10-23 由本目录的 sheet.tsx 并入底座，导入对话框的手机形态同用），正文同 stack 布局、控件按触控尺寸 44。
 * SDK 单人 preset（sEmbed）：说明一句不写「不影响协作者」（没有协作者，g4-11）。
 * 入口：账户菜单「偏好设置… ⌘,」是唯一入口（DS-10、DS-18、AS-06），另有 ⌘,——都发底座命令 account.preferences（第 3 批转正并入），本宿主接住；
 * 命令面板「偏好设置…」与「阅读顺序…」（DS-116 第二入口）在命令面板样张里打开同一个对话框（那里也挂了本宿主）。
 */
export function SettingsHost() {
  const host = useSettingsHost()
  const [ui, set] = useSettingsUi()
  const applyTheme = useApplyTheme()
  const { theme } = useV3Params()
  const t = STRINGS[ui.locale]
  const form = host.data.sForm ?? "dialog"

  // 打开（账户菜单「偏好设置…」、⌘,、命令面板）：arg 为 reading-order 时打开后焦点落到「阅读顺序」
  useAppWiring({ "account.preferences": (arg) => set({ open: true, focus: arg === "reading-order" ? "order" : null }) })

  // 落点：对话框挂上、自己的初始焦点（对话框本身）落下之后，排到下一个任务把焦点交给「阅读顺序」并滚到它（只滚对话框的正文区）
  useEffect(() => {
    if (!ui.open || ui.focus !== "order") return
    const timer = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(ORDER_TRIGGER)
      if (el) {
        scrollIntoPanel(el, { align: "center", ifNeeded: true })
        el.focus({ preventScroll: true })
      }
      set({ focus: null })
    }, 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.open, ui.focus])

  /** 切换语言：转圈（下拉不可用，菜单不再打开、焦点留在下拉上）→ 完成后文案即时换掉、播报一次；失败时回到原值并在下面写原因 */
  const switchTo = (l: Locale) => {
    if (l === ui.locale) return
    set({ pending: l, langError: false, announce: "" })
    window.setTimeout(() => set({ locale: l, pending: null, announce: STRINGS[l].langDone }), LANG_DELAY)
  }
  // language-switching：一出现就在转圈，用户第一次点按或按键后完成（截图定格在转圈）
  useFinishPendingOnInteraction(ui.pending, () => set((u) => (u.pending ? { locale: u.pending, pending: null, announce: STRINGS[u.pending].langDone } : {})))
  // 只给读屏的那一句播报后清空
  useEffect(() => {
    if (!ui.announce) return
    const timer = window.setTimeout(() => set({ announce: "" }), 3000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.announce])

  const body = (
    <SettingsBodyHost
      layout={form === "dialog" ? "wide" : "stack"}
      touch={form === "sheet"}
      onLocale={switchTo}
      onTheme={(p) => {
        set({ theme: p })
        applyTheme(p)
      }}
      themeNow={theme}
    />
  )

  const close = (v: boolean) => set({ open: v })
  const description = <Says>{host.data.sEmbed ? t.descriptionSolo : t.description}</Says>
  // 关闭后焦点回打开它的控件；它已随菜单卸载（账户菜单里的「偏好设置…」）时回到自己的头像或开始页的用户行（锚点都是 account）；手机形态回顶栏的「显示导航」
  return (
    <>
      {form === "sheet" ? (
        <BottomSheet title={t.title} description={description} closeLabel={t.closeSheet} open={ui.open} onOpenChange={close} returnFocus="home.nav-toggle">
          {body}
        </BottomSheet>
      ) : form === "drawer" ? (
        <Drawer title={t.title} description={description} width={320} open={ui.open} onOpenChange={close} returnFocus="account" initialFocus="dialog" bodyClassName="p-0">
          {body}
        </Drawer>
      ) : (
        <Dialog title={t.title} description={description} anchor="top" open={ui.open} onOpenChange={close} returnFocus="account" initialFocus="dialog" bodyClassName="p-0">
          {body}
        </Dialog>
      )}
      {/* 只给读屏的播报（语言切换完成）：polite、不抢焦点；失败与「已复制」写在框里那一行自己播报 */}
      <span role="status" aria-live="polite" className="sr-only">
        {ui.announce}
      </span>
    </>
  )
}

/** 正文：读写场景状态；编辑器里的「插件 · 查看」关掉设置、打开个人插件面板（第 2 批 03-09 的同一个对话框，关闭后焦点回到头像） */
function SettingsBodyHost({
  layout,
  touch,
  onLocale,
  onTheme,
  themeNow,
}: {
  layout: "wide" | "stack"
  touch?: boolean
  onLocale: (l: Locale) => void
  onTheme: (p: "light" | "dark" | "system") => void
  themeNow: "light" | "dark"
}) {
  const host = useSettingsHost()
  const [ui, set] = useSettingsUi()
  const showPlugins = host.editor && !host.data.sEmbed
  const common = {
    ui,
    t: STRINGS[ui.locale],
    layout,
    embed: !!host.data.sEmbed,
    themeNow,
    telemetry: !!host.data.sTelemetry,
    dev: !!host.data.sDev,
    a11y: host.data.sA11y !== false,
    touch,
    onTheme,
    onLocale,
    onUnit: (u: typeof ui.unit) => set({ unit: u }),
    onOrder: (o: typeof ui.order) => set({ order: o }),
    onAutosave: (a: typeof ui.autosave) => set({ autosave: a }),
    onNotifyJoin: (v: boolean) => set({ notifyJoin: v }),
    onErrorReports: (v: boolean) => set({ errorReports: v }),
    onUsage: (v: boolean) => set({ usage: v }),
    onCopied: (v: boolean) => set({ copied: v }),
  }
  if (showPlugins) return <WithPlugins {...common} />
  return <SettingsBody {...common} showPlugins={false} onPlugins={() => undefined} />
}

function WithPlugins(props: Omit<Parameters<typeof SettingsBody>[0], "showPlugins" | "onPlugins">) {
  const api = usePlugins()
  const [, set] = useSettingsUi()
  return (
    <SettingsBody
      {...props}
      showPlugins
      onPlugins={() => {
        // 同一个任务里：设置收起、个人插件面板打开（对话框接走焦点，设置关闭时不再抢回）；面板关闭后焦点回头像（设置是从它打开的）
        set({ open: false })
        api.openPanelFrom("account")
      }}
    />
  )
}
