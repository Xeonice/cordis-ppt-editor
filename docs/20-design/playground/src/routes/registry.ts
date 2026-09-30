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
  { path: "/styleguide", title: "样式指南", description: "全部 shadcn 组件在 Cordex 主题下的状态矩阵与用法", spec: "09 §2", status: "ready" },
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
  { path: "/editor/plugins", title: "插件管理器", description: "已安装插件、PENDING/失败恢复、贡献清单", spec: "03-screens/09", status: "ready" },
  { path: "/editor/fidelity", title: "导入保真报告", description: "完全保真、部分保留（动画/切换/SmartArt/OLE/EMF/chartex/外链/字体）、部分解析失败", spec: "03-screens/10", status: "ready" },
  { path: "/export", title: "导出", description: "格式、范围、进度、失败重试", spec: "03-screens/22", status: "ready" },
  { path: "/present", title: "放映", description: "舞台、控制条、跟随", spec: "03-screens/11", status: "ready" },
  { path: "/viewer", title: "只读查看器", description: "preset-slide-viewer 极简壳", spec: "03-screens/25", status: "ready" },
  { path: "/settings", title: "设置与快捷键", description: "主题/密度/语言/单位；快捷键面板", spec: "03-screens/23、24", status: "ready" },
  { path: "/offline", title: "离线与降级", description: "会话六态横幅、权限降级、门禁反馈", spec: "03-screens/12", status: "ready" },
]
