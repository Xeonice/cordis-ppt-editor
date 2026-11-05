import type { ReactNode } from "react"
import { LibraryLayers, LibraryToasts } from "../../kit"
import { HomeBody } from "../../HomeBody"
import { HOME_SHELL, HomeDrawer, homeData, NavToggle } from "../home/HomeMain"
import type { PageConfig } from "../types"

/**
 * 叠在开始页上的状态的背景（settings.from-home、settings.phone、shortcuts.from-home）：拍板后的开始页——与 home.m2-default 同一版（即已拍板首页 #/v3/home：
 * 左栏 5 项含回收站 DS-79 · 搜索框下拉 DS-80 · 「帮助」打开帮助菜单 DS-89 · 用户行是 M2 的账户菜单 DS-90 / DS-91 · 主区 HomeBody、M2 不显示「更多模板 →」），
 * 应用壳与主区都是底座的件（2026-10-22 第 3 批转正并入），不另画一份；手机形态同 home.phone（DS-87）。
 * 本组的入口不必再接：账户菜单「偏好设置… ⌘,」「键盘快捷键 ⌘/」、帮助菜单「键盘快捷键 ⌘/」与 ⌘, ⌘/ 都发底座命令（account.preferences / help.shortcuts），
 * 叠在上面的宿主（SettingsHost、ShortcutsHost）接住；原来在外面一层捕获阶段接点按、等菜单收起再发本地命令的做法随之删去。
 */

/**
 * 桌面开始页（home.m2-default 同一版）：overlay 画在主区里（快捷键面板），layers 是浮层（偏好设置对话框）；data 与 M2 首页数据合并（状态私有数据并在一起）
 */
export function homePage({ overlay, layers, data = {} }: { overlay?: ReactNode; layers?: ReactNode; data?: Record<string, unknown> }): PageConfig {
  return {
    shell: HOME_SHELL,
    body: <HomeBody />,
    overlay: (
      <>
        {overlay}
        <LibraryToasts />
      </>
    ),
    layers: (
      <>
        <LibraryLayers />
        {layers}
      </>
    ),
    data: { ...homeData({ milestone: "M2" }), ...data },
  }
}

/** 手机形态的「显示导航」开关：同 home.phone（顶栏内边距 32，开关左移 16 与内容左缘 16 对齐） */
function NavToggleEdge() {
  return (
    <span className="-ml-4 flex">
      <NavToggle />
    </span>
  )
}

/**
 * 手机开始页（home.phone 同一版，DS-87：390 × 844，左栏收进抽屉、不渲染新建与导入）：layers 放底部面板形态的偏好设置。
 * 抽屉里用户行的账户菜单「偏好设置…」发底座命令 account.preferences，叠在上面的底部面板形态的偏好设置接住（TB-118）；
 * 「键盘快捷键」照常发 help.shortcuts——手机上的快捷键面板本批没画（见 shortcuts 场景文件头），这里没有宿主接，转到 shortcuts.from-home
 */
export function homePhonePage({ layers, data = {} }: { layers?: ReactNode; data?: Record<string, unknown> }): PageConfig {
  return {
    shell: { ...HOME_SHELL, rail: false, actions: null, headerStart: <NavToggleEdge />, bodyClassName: "px-4 pt-4 pb-8" },
    body: <HomeBody />,
    overlay: (
      <>
        <HomeDrawer search={false} />
        <LibraryToasts />
      </>
    ),
    layers: (
      <>
        <LibraryLayers />
        {layers}
      </>
    ),
    data: { ...homeData({ milestone: "M2", form: "phone" }), ...data },
  }
}
