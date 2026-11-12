import { V3PageHost } from "./PageHost"

/**
 * 设计语言 v3 · 首页样张（#/v3/home?theme=dark|light&accent=blue|violet|coral；已拍板，DS-12）
 * 左侧 220px 导航贴边；主区 56px 顶栏；模板与最近文档都是真实渲染的 16:9 封面。没有问候语、没有指南卡片区。
 * 左栏底部只有「帮助」（帮助菜单，DS-89）与用户行：设置的唯一入口是账户菜单（DS-10 / PRD AS-06 / D13），用户行点开它（与编辑器右上自己的头像同一份菜单，DS-18）。
 * 搜索框的 ⌘K 是开始页作用域的「聚焦搜索」（03-29 §6 第 6 条），输入后下方弹出前 5 条即时结果 +「查看全部结果」（DS-80）。
 * 第 3 批：壳抽成 kit ShellLayout（左栏 + 顶栏 + 横幅通道），最近的卡片抽成 kit DocumentCard。
 * 2026-10-22 第 3 批转正：主区换成开始页补态（scenarios/home/HomeMain.tsx）的画法——左栏 5 项含「回收站」（DS-79）、M2 不显示「更多模板 →」（AS-03）、
 * 「最近」是文档列表「最近」的前 8 条（固定的在前、图钉、角色徽标、无封面占位、「编辑者 · 相对时间」与 DS-83 的头像口径）、卡片「⋯」菜单（DS-81）。
 * 带 state=<场景>.<状态> 时是首页宿主上的场景状态（PageHost.tsx，如第 3 批首页补态、账户菜单、设置）；不带时是已拍板的首页（M2 普通成员）。
 */
export function V3Home() {
  return <V3PageHost host="home" />
}

/** 首页主区（已拍板首页的内容）在 HomeBody.tsx：这里转出原名，引用处不变 */
export { HomeBody, RecentSection, TemplateRow, type HomeData } from "./HomeBody"
