/** 设计稿路由登记表：Hub 目录页据此渲染；status 由实现者维护。 */
export type RouteStatus = "ready" | "wip" | "planned"

export interface RouteEntry {
  path: string
  title: string
  description: string
  spec: string
  status: RouteStatus
}

export const routes: RouteEntry[] = [
  // 旧版（ribbon 版）组件状态矩阵：产品 /styleguide（a11y 与 csp-strict 门禁的对象，只在测试环境挂出）按 v3 kit 重写，它的样张是 v3 编辑器的 _kit 场景（rulings §4.25 TB-3、TB-50）；本页随 DS-7 全量迁移后删除
  { path: "/styleguide", title: "样式指南", description: "全部 shadcn 组件在 Cordex 主题下的状态矩阵与用法（旧版；v3 组件全状态页的样张见 #/v3/editor?state=_kit）", spec: "09 §2", status: "ready" },
  { path: "/home", title: "应用首页", description: "开始页：新建与模板、最近文档、指南入口", spec: "03-screens/29", status: "ready" },
  { path: "/documents", title: "文档列表", description: "应用壳：文档卡片、搜索、新建、导入", spec: "03-screens/01", status: "ready" },
  { path: "/import", title: "打开与导入", description: "进度阶段、失败态全集、降级占位", spec: "03-screens/13", status: "ready" },
  { path: "/editor", title: "编辑器主界面", description: "应用栏、Ribbon、缩略图栏、画布、检查器、状态栏", spec: "03-screens/02", status: "ready" },
  { path: "/editor/masters", title: "母版视图", description: "母版缩略图窗格、版式画布、占位符编辑、母版页签", spec: "03-screens/26", status: "ready" },
  { path: "/editor/layouts", title: "版式选择与重置", description: "按母版分组的版式画廊、重置页", spec: "03-screens/27", status: "ready" },
  { path: "/editor/design", title: "设计页签与主题", description: "主题、变体、主题色/字体编辑", spec: "03-screens/28", status: "ready" },
  { path: "/editor/insert", title: "插入", description: "插入页签七组、形状库 72 项、插入工具态、操作设置、页眉和页脚、图标、符号", spec: "03-screens/04、15", status: "ready" },
  { path: "/editor/text", title: "文本编辑与格式化", description: "编辑态、迷你工具条、字体/段落/项目符号；空内容占位符图标条（G-80，含窄占位符折叠、表格网格）与占位符检查器、日期和时间格式（G-81）", spec: "03-screens/16", status: "ready" },
  { path: "/editor/table", title: "表格编辑", description: "插入网格与对话框（含超限）、占位符表格网格、单元格编辑与选区；M2 灰显与只读；M3 行列「+」、调列宽、右键菜单、合并、边框、样式库 74 种", spec: "03-screens/30（G-32 / G-62）", status: "ready" },
  { path: "/editor/chart", title: "图表编辑", description: "图表 ▾ 五类与子类型、数据网格（右键、截断、原工作簿提示）、更改类型下拉与确认、标题 / 图例 / 标签、只读类型、占位符图表（M3）、M2 选中导入图表", spec: "03-screens/31（G-63）", status: "ready" },
  { path: "/editor/comments", title: "评论", description: "线程、@提及、解决、脱离锚点", spec: "03-screens/06", status: "ready" },
  { path: "/editor/history", title: "版本历史", description: "自动/命名版本、对比、恢复", spec: "03-screens/07", status: "ready" },
  { path: "/editor/share", title: "分享与权限", description: "邀请、角色、链接权限、即时反馈", spec: "03-screens/08", status: "ready" },
  { path: "/editor/plugins", title: "插件面板（个人）", description: "三分组：本部署统一启用（只读）/ 我的界面插件（为我关闭，即时生效）/ 本文档缺少的插件；失败详情与本会话重试、等待依赖、版本不兼容、快捷键冲突、只读角色；缺插件横幅三种原因与「重新加载」横幅", spec: "03-screens/09（PM-10–12）", status: "ready" },
  { path: "/editor/fidelity", title: "导入保真报告", description: "完全保真、部分保留（动画/切换/SmartArt/OLE/EMF/chartex/外链/字体）、部分解析失败", spec: "03-screens/10", status: "ready" },
  { path: "/export", title: "导出", description: "格式、范围、进度、失败重试", spec: "03-screens/22", status: "ready" },
  { path: "/present", title: "放映", description: "舞台、控制条、跟随", spec: "03-screens/11", status: "ready" },
  { path: "/viewer", title: "只读查看器", description: "preset-slide-viewer 极简壳", spec: "03-screens/25", status: "ready" },
  { path: "/settings", title: "设置与快捷键", description: "主题/密度/语言/单位；快捷键面板", spec: "03-screens/23、24", status: "ready" },
  { path: "/admin/plugins", title: "管理 › 插件", description: "管理员插件清单：来源 / 作用域 / 必需性 / 八种部署级状态、策略三态与锁定、详情抽屉、变更确认卡、依赖与互斥冲突、首次启用第三方（M4）、被拒插件、无权限页", spec: "03-screens/32（PM-03–09）", status: "ready" },
  { path: "/offline", title: "离线与降级", description: "会话六态横幅、权限降级、门禁反馈", spec: "03-screens/12", status: "ready" },
  // 设计语言 v3 样张：第 0–3 批都已拍板（rulings §4.25 DS-2 第 0 批、DS-21 第 1 批、DS-38…DS-63 第 2 批、DS-79…DS-143 第 3 批；2026-10-22 第 3 批转正，2026-10-23 评审修改 DS-140…DS-143 转正）。
  // 各场景与状态由 src/v3/scenario-registry.ts 自动发现，Hub「设计语言 v3」按批分组列出；这里登记 v3 的宿主路由——编辑器、首页与第 3 批的页面级宿主（src/v3/scenarios/README.md §3e「宿主与路由」）。
  // v3 各行的 spec 不写「03-screens/编号」：docs/_tools/gen-docs-site.py 按那个写法给界面文档配样张路由（旧版各行），v3 的路由不参与
  { path: "/v3/editor", title: "编辑器 · 设计语言 v3", description: "去 ribbon 的 Figma 式三栏：底部浮动工具条只管创建，右侧检查器只管当前选中对象的属性", spec: "样张 v3（rulings §4.25 第 0–3 批已拍板：DS-2、DS-21、DS-38…DS-63、DS-79…DS-143）", status: "ready" },
  { path: "/v3/home", title: "首页 · 设计语言 v3", description: "左侧导航贴边，模板与最近文档都是真实渲染的 16:9 封面；?state=home.<状态> 是开始页各态", spec: "样张 v3（rulings §4.25 DS-2、DS-12 第 0 批已拍板，第 3 批补态与修正 DS-79…DS-143 已拍板）", status: "ready" },
  { path: "/v3/documents", title: "文档列表 · 设计语言 v3", description: "第 3 批页面级宿主（应用壳）：左栏五项即筛选、搜索框下拉与结果页、同一张卡片与菜单、回收站、「导入」对话框；?state=documents.<状态>", spec: "样张 v3 第 3 批（rulings §4.25 DS-79…DS-88、DS-92、DS-137、DS-140、DS-141；界面 03-01）", status: "ready" },
  { path: "/v3/templates", title: "模板库 · 设计语言 v3", description: "第 3 批页面级宿主（应用壳）：来源分段与预览，M3；?state=templates.<状态>", spec: "样张 v3 第 3 批（rulings §4.25 DS-72、DS-93；界面 03-29）", status: "ready" },
  { path: "/v3/admin/plugins", title: "管理 › 插件 · 设计语言 v3", description: "第 3 批页面级宿主（应用壳 + 管理导航）：插件清单、策略草稿与保存条、详情抽屉与深链；?state=admin-plugins.<状态>&plugin=<插件 id>", spec: "样张 v3 第 3 批（rulings §4.25 DS-86、DS-92、DS-94…DS-96、TB-119…TB-121；界面 03-32）", status: "ready" },
  { path: "/v3/page", title: "登录与错误页 · 设计语言 v3", description: "第 3 批页面级宿主（整屏 bare）：登录、登录回调与新窗口登录、找不到页面、页面出错了、配置错误；?state=shell-pages.<状态>", spec: "样张 v3 第 3 批（rulings §4.25 DS-71、DS-118…DS-125；界面 03-33）", status: "ready" },
  { path: "/v3/embed", title: "嵌入 · 设计语言 v3", description: "第 3 批页面级宿主：中性宿主外框 + iframe 容器——完整 / 紧凑 / 仅查看形态、请在新窗口登录、嵌入里的打开失败；?state=embed.<状态>&frame=宽x高", spec: "样张 v3 第 3 批（rulings §4.25 DS-73、DS-112、TB-115、TB-145；前端 50/12 §9）", status: "ready" },
]
