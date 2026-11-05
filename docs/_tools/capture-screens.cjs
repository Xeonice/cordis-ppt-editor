// 用法：node capture-screens.cjs <dist 服务 URL> <输出目录> [--only=08,13]
// 为文档站「设计集中展示」实拍 playground（先 npm run build，再用静态服务器在 <URL> 提供 docs/20-design/playground/dist/）：
// 03-screens 的条目第 3 批起全部登记 v3 样张状态（能代表规格的状态，标签同各界面文档「状态」一节，30 / 31 登记全部状态），见 SCREENS 注释；旧版路由只剩 EXTRAS 的样式指南（拍默认态）；
// 每态亮/暗各一张 1440×900（DSF 1，JPEG q78），另以 DSF 0.5 同视口拍 720×450 缩略图；
// 输出 <输出目录>/*.jpg 与 manifest.json（33 个 03-screens 文档全部登记；无专属路由的 states 为 []，用 seeAlso 指向相关界面）。
// 旧版路由切换演示态：点击 DesignBar 的演示状态下拉 [data-slot=select-trigger]，再点对应文字的 [data-slot=select-item]；
// 暗色：页面脚本运行前把 localStorage["cordex-theme"] 设为 dark/light（src/lib/theme.ts 中显式选择优先级最高），并同步 colorScheme。
// 设计语言 v3 分支（design-language-v3：第 0 批 02 → /v3/editor、29 → /v3/home；第 1 批（2026-10-07 拍板，rulings §4.25 DS-21）04、05、14–21、26–28、30、31
//   → /v3/editor 的场景状态 state=<场景>.<状态>；2026-10-08 按 DS-31 补的快速样式、样式库与「文件」菜单三个状态登记在 02；第 2 批（2026-10-15 拍板，DS-38…DS-63）
//   06–10、12 → 场景 comments、version-history、share、plugins、fidelity、offline-conflict，13 的外链确认与降级占位、25 的保真摘要也改拍 v3 状态；
//   第 3 批（应用壳族，2026-10-22 转正，DS-79…DS-136）01、11、13、22–25、29、32 改拍 v3 场景状态，新增 33；
//   母版视图改版（2026-11-03 拍板，DS-144…DS-177）26 改登记 14 态（含普通视图的三个入口与 M2 一态），27 的 readonly 标签随 DS-147 子题跟改）：
//   第 3 批有页面级宿主 #/v3/home、#/v3/documents、#/v3/templates、#/v3/admin/plugins、#/v3/page（登录与错误页）、#/v3/embed，地址 #/v3/<宿主>?state=<场景>.<状态>
//   （宿主与路由见 src/v3/scenarios/README.md §3e；各状态的宿主看场景与状态的 host，或页面里 window.__V3_SCENARIOS__[].states[].href）。在别的宿主路由上打开
//   一个状态会自动转到它的宿主、地址被改写（按问题报），所以每个状态都登记在自己的宿主路由上：条目 route 写主宿主，宿主不同的个别状态用 route 覆盖。
//   只登记 1440×900 下能正确呈现的状态：紧凑、手机、平板与新窗口小窗等专属视口的状态不登记；标「未采纳 · 」的备选（alt-*，DS-63）不进文档站，
//   母版视图的对比场景 master-view-options（未采纳的对比画法与推荐并排，03-26 §6.9，DS-173）同样不登记。
//   路由以 /v3/ 开头的条目没有 DesignBar 演示下拉，状态、主题与强调色全走 URL 参数（src/v3/params.ts），主题也不读 localStorage / html.dark。
//   状态写成 [value, label, { q }]：q 是除 theme / accent 以外的参数，state=<编辑器状态 empty|shape|text|shapes-menu 或 场景.状态>、view=grid
//   （场景状态自带网格视图的，q 里要写 view=grid，否则挂载后地址被补上 view 参数、按「地址被改写」报问题），
//   没有参数的不写 q（如首页默认）；脚本打开 #<route>?<q>&theme=<light|dark>&accent=blue，等 .v3-root 出现后直接拍，跳过 DesignBar 逻辑。
//   value 在同一条目里不能重名（文件名取 <编号>--<value>）：一个界面登记几个场景、状态 id 撞名时加前缀（如 24 的 command-palette、29 的 account-member）。
//   URL 表达不了的页内状态（如首页「列表」）用 { click: "<按钮的可访问名称>" } 点出，点后鼠标移到左上角、焦点移出，免得拍到悬停底与工具提示。
//   检查：主题挂在 v3 根节点（src/v3/V3Root.tsx 写 data 属性），要求 .v3-root 的 data-v3-theme 与计算后的 color-scheme 都等于期望主题、
//   data-v3-accent 为 blue；地址的路径与参数集合没被页面改写；没有通用错误页，也没有 state 写错时编辑器顶部的「找不到场景状态」横幅（src/v3/Editor.tsx）。
//   同一路由按「q + click」去重；manifest 里 v3 状态另记 query（即 q），默认态（画廊封面）取第一个登记的状态。
const fs = require("fs"); const path = require("path"); const { execSync } = require("child_process");
// playwright 解析顺序：环境变量 PLAYWRIGHT_MODULE（模块目录）→ 本地 node_modules → 全局 npm root
const pw = (() => {
  const cands = [process.env.PLAYWRIGHT_MODULE, "playwright"];
  try { cands.push(execSync("npm root -g").toString().trim() + "/playwright"); } catch {}
  for (const c of cands.filter(Boolean)) { try { return require(c); } catch {} }
  throw new Error("找不到 playwright：设置 PLAYWRIGHT_MODULE=<.../node_modules/playwright> 或全局安装");
})();
const PLAYGROUND_URL = "https://claude.ai/code/artifact/cf6e1a1a-986b-48bb-b743-5758dff419d2";
const TRIGGER = '[data-slot=select-trigger][aria-label="演示状态"]';
const V3_ACCENT = "blue"; // 产品只发布品牌蓝（rulings §4.25 DS-2）
const isV3 = (route) => /^\/v3\//.test(route || "");
// v3 地址：参数顺序同 src/v3/params.ts 的 v3Href（state、view、theme、accent）
const v3Hash = (route, q, theme) => { const p = new URLSearchParams(q || ""); p.set("theme", theme); p.set("accent", V3_ACCENT); return `#${route}?${p}` };
// 地址没被改写：路径相同、参数集合相同（不计顺序）
const sameHash = (a, b) => {
  const norm = (h) => { const [p, q = ""] = h.split("?"); return p + "?" + [...new URLSearchParams(q)].map((kv) => kv.join("=")).sort().join("&") };
  return norm(a) === norm(b);
};
// 状态：[value, label（旧版须与下拉文字一致）, 选项]；同一路由同一 value（v3 为同一 q + click）只拍一次，文件名取首个登记的编号。
// 选项 click：不切下拉，点击该文字的演示按钮（toast；v3 为页内按钮）；hover：拍前把鼠标移到该名称的 application 区域；note：展示补充说明；q：v3 的地址参数；
// route：只覆盖这一个状态的路由（v3 条目里宿主不同的个别状态用，如 01 的 trash-blocked 在 /v3/editor、23 的 from-home 在 /v3/home、29 的模板库在 /v3/templates，第 3 批）；
// direct（旧版路由用；第 3 批 25 改拍 v3 后已没有条目登记）：该演示态是受控打开、又不忽略 DesignBar 焦点归还的弹层（原 25「保真摘要卡片」Popover 的 onOpenChange
// 一律复位为默认），下拉切换必被关掉，登记后不点下拉、直接调用 DesignBar 的 onStateChange（即下方兜底的同一做法，按登记走不记兜底；未登记的演示态走到兜底仍记为问题）。
const S = (id, file, title, group, route, states = [], seeAlso) => ({ id, doc: `03-screens/${file}`, title, group, route, states, seeAlso });
const SCREENS = [
  // 01：design-language-v3 第 3 批（2026-10-22 转正，rulings §4.25 DS-79…DS-88、DS-92）改拍 v3 场景 documents（宿主 /v3/documents），标签同 03-01 §3 的样张标题
  //     （不带表里标宿主的「（编辑器）」）；trash-blocked 画在编辑器宿主（route 覆盖）；compact（1000 × 760）有专属视口，不登记
  S("01", "01-document-list.md", "文档列表（应用壳）", "应用壳", "/v3/documents",
    [["recent", "最近（缺省）", { q: "state=documents.recent" }],
     ["mine", "我的文档 · 悬停与键盘焦点", { q: "state=documents.mine" }],
     ["card-menu", "卡片「⋯」菜单（所有者，最近）", { q: "state=documents.card-menu" }],
     ["list", "列表显示", { q: "state=documents.list" }],
     ["search-dropdown", "搜索框下拉", { q: "state=documents.search-dropdown" }],
     ["trash", "回收站（M3）", { q: "state=documents.trash" }],
     ["trash-blocked", "所有者打开回收站里的文档", { route: "/v3/editor", q: "state=documents.trash-blocked" }],
     ["empty", "我的文档为空", { q: "state=documents.empty" }],
     ["error", "加载失败", { q: "state=documents.error" }],
     ["offline", "离线", { q: "state=documents.offline" }]]),
  // 02：design-language-v3 第 0 批改拍 v3 样张，标签同 03-02 §6.1「样张已覆盖」；评审模式是 §6.2 的场景状态 main-states.review（评审条有条目，DS-23，2026-10-07 第 1 批拍板）；
  //     快速样式行（§4.2）、42 格样式库与主菜单「文件」（§2.3，「幻灯片大小…」P2）是 2026-10-08 按 rulings §4.25 DS-31 补的三个 main-states 状态，标签同样张状态标题
  S("02", "02-editor-main.md", "编辑器主界面", "编辑器·画布", "/v3/editor",
    [["shape", "选中形状", { q: "state=shape" }], ["text", "编辑文字", { q: "state=text" }],
     ["review", "评审模式 · 有条目", { q: "state=main-states.review", note: "评审条替换底部工具条（03-02 §6.2，rulings §4.25 DS-23）" }], ["grid", "网格视图", { q: "view=grid" }],
     ["quick-styles", "选中形状 · 快速样式", { q: "state=main-states.quick-styles", note: "形状检查器「填充」节上方的快速样式行（03-02 §4.2，rulings §4.25 DS-31）" }],
     ["quick-styles-gallery", "快速样式 · 样式库", { q: "state=main-states.quick-styles-gallery", note: "7 列 × 6 行 42 格样式库（DS-31，设计 04 §4.1a）" }],
     ["file-menu", "主菜单 · 文件", { q: "state=main-states.file-menu", note: "「幻灯片大小…」P2 不可用（03-02 §2.3，DS-31）" }]]),
  S("03", "03-properties-panel.md", "格式/属性面板", "编辑器·面板", null, [], ["02"]),
  // 04：design-language-v3 第 1 批改拍 v3 场景 insert（标签同 03-04 §7.1）；从它打开的页眉和页脚、图标、符号面板登记在 15
  S("04", "04-insert-menu.md", "插入菜单", "编辑器·面板", "/v3/editor",
    [["more", "更多 · 未在编辑文字", { q: "state=insert.more" }], ["more-editing", "更多 · 光标在文本里", { q: "state=insert.more-editing" }],
     ["image-menu", "图片 ▾", { q: "state=insert.image-menu" }], ["image-url", "来自 URL", { q: "state=insert.image-url" }],
     ["main-menu", "主菜单 · 插入", { q: "state=insert.main-menu" }]]),
  // 05：第 1 批改拍 v3 场景 context-menu（标签同 03-05 §5）
  S("05", "05-context-menu.md", "上下文菜单", "编辑器·画布", "/v3/editor",
    [["shape", "形状", { q: "state=context-menu.shape" }], ["text", "文本", { q: "state=context-menu.text" }],
     ["canvas", "画布空白处", { q: "state=context-menu.canvas" }], ["thumbnail", "缩略图", { q: "state=context-menu.thumbnail" }],
     ["image", "图片", { q: "state=context-menu.image" }], ["readonly", "评审模式 · 禁用而不隐藏", { q: "state=context-menu.readonly" }]]),
  // 06–10、12：design-language-v3 第 2 批（2026-10-15 拍板，rulings §4.25 DS-38…DS-63）改拍 v3 场景，标签同各界面文档「状态」一节的样张标题；
  //     只登记能代表规格的推荐状态，标「未采纳」的备选（alt-*，DS-63）不进文档站
  S("06", "06-comments-panel.md", "评论面板", "协同", "/v3/editor",
    [["default", "评论页签 · 当前页", { q: "state=comments.default" }],
     ["locate", "点评论钉 · 定位线程", { q: "state=comments.locate" }],
     ["resolved", "已解决 · 展开与角标", { q: "state=comments.resolved" }],
     ["compose", "评论工具 · 浮动撰写框", { q: "state=comments.compose" }],
     ["mention", "撰写框 · @提及候选", { q: "state=comments.mention" }],
     ["pin-menu", "右键评论钉", { q: "state=comments.pin-menu" }],
     ["delete-thread", "删除讨论串 · 确认", { q: "state=comments.delete-thread" }],
     ["phone", "手机 · 发表评论", { q: "state=comments.phone" }]]),
  S("07", "07-version-history.md", "版本历史", "协同", "/v3/editor",
    [["default", "打开版本历史 · 当前版本", { q: "state=version-history.default" }],
     ["preview", "预览命名版本「提案定稿」", { q: "state=version-history.preview" }],
     ["auto-group", "自动版本分组 · 预览自动版本", { q: "state=version-history.auto-group" }],
     ["name-version", "命名当前版本", { q: "state=version-history.name-version" }],
     ["restore-confirm", "恢复确认", { q: "state=version-history.restore-confirm" }],
     ["restored", "恢复完成", { q: "state=version-history.restored" }],
     ["error", "加载失败", { q: "state=version-history.error" }],
     ["recently-deleted", "最近删除（所有者）", { q: "state=version-history.recently-deleted" }]]),
  S("08", "08-share-permissions-dialog.md", "分享与权限对话框", "协同", "/v3/editor",
    [["default", "所有者视角", { q: "state=share.default" }],
     ["role-menu", "成员 · 角色下拉", { q: "state=share.role-menu" }],
     ["remove-confirm", "成员 · 移除前行内确认", { q: "state=share.remove-confirm" }],
     ["link-expiry", "链接 · 有效期", { q: "state=share.link-expiry" }],
     ["link-tighten", "链接 · 收紧前确认", { q: "state=share.link-tighten" }],
     ["no-permission", "权限不足 · 非所有者打开", { q: "state=share.no-permission" }],
     ["access-requests", "访问申请（所有者端）", { q: "state=share.access-requests" }],
     ["request-access", "申请访问 · 留言弹层（申请人）", { q: "state=share.request-access" }]]),
  S("09", "09-plugin-manager.md", "插件面板（个人）", "编辑器·面板", "/v3/editor",
    [["default", "个人插件面板", { q: "state=plugins.default" }],
     ["failed", "启动失败 · 详情与重试", { q: "state=plugins.failed" }],
     ["conflict", "快捷键冲突 · 可为我关闭", { q: "state=plugins.conflict" }],
     ["missing-selected", "缺插件的元素 · 选中", { q: "state=plugins.missing-selected" }],
     ["banner-queue", "插件横幅的先后 · 关掉缺插件后轮到启动失败", { q: "state=plugins.banner-queue" }],
     ["panel", "插件整页面板 · 整栏", { q: "state=plugins.panel" }],
     ["more-many", "「更多」· 很多插件（折叠）", { q: "state=plugins.more-many" }],
     ["sections-many", "检查器 · 很多插件分区（折叠）", { q: "state=plugins.sections-many" }]]),
  S("10", "10-fidelity-report.md", "导入保真报告", "导入导出", "/v3/editor",
    [["default", "打开后有差异 · 轻提示", { q: "state=fidelity.default" }],
     ["report", "保真报告 · 检查器整栏面板", { q: "state=fidelity.report" }],
     ["locate", "定位到对象", { q: "state=fidelity.locate" }],
     ["page-hint", "本页提示条", { q: "state=fidelity.page-hint" }],
     ["degraded-selected", "选中无法显示的对象", { q: "state=fidelity.degraded-selected" }],
     ["degraded-menu", "无法显示的对象 · 右键", { q: "state=fidelity.degraded-menu" }],
     ["generating", "报告生成中", { q: "state=fidelity.generating" }],
     ["no-differences", "完全保真", { q: "state=fidelity.no-differences" }]]),
  // 11：第 3 批改拍 v3 场景 present（编辑器宿主，放映状态整块替换左栏、画布与检查器），标签同 03-11 §3 的样张标题；舞台不随界面亮暗（两套截图相同）；
  //     控制条一出现就是浮现的样子，不再像旧版那样把鼠标移到舞台上（hover）；手机竖屏、横屏（phone、phone-landscape）有专属视口，不登记
  S("11", "11-present-mode.md", "放映模式", "查看器与放映", "/v3/editor",
    [["default", "放映中 · 控制条浮现", { q: "state=present.default" }],
     ["idle", "放映中 · 鼠标静止", { q: "state=present.idle" }],
     ["more-menu", "「更多」展开", { q: "state=present.more-menu" }],
     ["black", "黑屏", { q: "state=present.black" }],
     ["page-jump", "敲数字跳页", { q: "state=present.page-jump" }],
     ["slide-failed", "单页渲染失败", { q: "state=present.slide-failed" }],
     ["end", "末页之后 · 结束页", { q: "state=present.end" }],
     ["following", "观众 · 跟随主讲人", { q: "state=present.following" }],
     ["follow-lost", "观众 · 与主讲人失去连接", { q: "state=present.follow-lost" }],
     ["editor-following", "编辑器里 · 跟随协作者", { q: "state=present.editor-following" }]]),
  S("12", "12-offline-conflict-banner.md", "离线/冲突横幅", "协同", "/v3/editor",
    [["offline-no-network", "离线 · 浏览器报告断网", { q: "state=offline-conflict.offline-no-network" }],
     ["recovered", "已恢复", { q: "state=offline-conflict.recovered" }],
     ["degraded-export", "降权 · 导出本地副本", { q: "state=offline-conflict.degraded-export" }],
     ["access-revoked", "访问权限已变更 · 阻断页", { q: "state=offline-conflict.access-revoked" }],
     ["viewers-full", "查看人数已满 · 阻断页", { q: "state=offline-conflict.viewers-full" }],
     ["quarantine", "隔离态 · 协同已暂停", { q: "state=offline-conflict.quarantine" }],
     ["master-offline", "母版视图 · 两条横幅（离线）", { q: "state=offline-conflict.master-offline" }],
     ["conflict-same-text", "软冲突 B · 同一文本框同一位置", { q: "state=offline-conflict.conflict-same-text" }]]),
  // 13：第 3 批评审修改（2026-10-23，rulings §4.25 DS-140）起导入是叠在开始页 / 文档列表上的对话框：对话框各态在 home 宿主（dialog-documents 在 documents 宿主）上，
  //     用 route 覆盖；其余各态（快照打开、缩略图虚拟化）与第 2 批改拍的 fidelity 三态仍在编辑器宿主。标签同 03-13「样张状态（import）」的样张标题；
  //     手机底部面板（dialog-phone，390 × 844）与未采纳的备选不登记
  S("13", "13-import-progress-and-degraded-states.md", "打开与导入：导入对话框、打开进度、降级占位", "导入导出", "/v3/editor",
    [["dialog", "导入对话框（开始页）", { route: "/v3/home", q: "state=import.dialog" }],
     ["dialog-documents", "导入对话框（文档列表）", { route: "/v3/documents", q: "state=import.dialog-documents" }],
     ["dialog-dragover", "导入对话框 · 拖入悬停", { route: "/v3/home", q: "state=import.dialog-dragover" }],
     ["dialog-uploading", "导入对话框 · 上传中", { route: "/v3/home", q: "state=import.dialog-uploading" }],
     ["dialog-parsing", "导入对话框 · 服务端解析", { route: "/v3/home", q: "state=import.dialog-parsing" }],
     ["dialog-failed-network", "导入对话框 · 失败（可重试）", { route: "/v3/home", q: "state=import.dialog-failed-network" }],
     ["dialog-failed-invalid-package", "导入对话框 · 失败（不是有效的演示文稿）", { route: "/v3/home", q: "state=import.dialog-failed-invalid-package" }],
     ["dialog-failed-quota", "导入对话框 · 失败（超出规模上限）", { route: "/v3/home", q: "state=import.dialog-failed-quota" }],
     ["snapshot-opening", "打开服务端文档 · 协同快照", { q: "state=import.snapshot-opening" }],
     ["thumbs-virtualized", "200 页文档 · 缩略图虚拟化", { q: "state=import.thumbs-virtualized" }],
     ["page-hint", "本页提示条", { q: "state=fidelity.page-hint" }],
     ["degraded-selected", "选中无法显示的对象", { q: "state=fidelity.degraded-selected" }],
     ["external-confirm", "外部内容需确认后加载", { q: "state=fidelity.external-confirm" }]]),
  // 14：第 1 批改拍 v3 场景 slide-management（标签同 03-14 §5）；grid-reorder 自带网格视图，q 带 view=grid
  S("14", "14-slide-management-and-layouts.md", "幻灯片管理与版式选择器", "编辑器·面板", "/v3/editor",
    [["new-slide-menu", "新建幻灯片 · 版式库", { q: "state=slide-management.new-slide-menu" }], ["drag-reorder", "拖动排序", { q: "state=slide-management.drag-reorder" }],
     ["sections", "节的显示与折叠", { q: "state=slide-management.sections" }], ["hidden", "隐藏的幻灯片", { q: "state=slide-management.hidden" }],
     ["change-layout", "更换版式", { q: "state=slide-management.change-layout" }], ["grid-reorder", "网格视图 · 多选拖动", { q: "state=slide-management.grid-reorder&view=grid" }]]),
  // 15：第 1 批改拍 v3 场景 shape-library 与 insert 的面板状态（标签同 03-15 §9.1）
  S("15", "15-insert-menu-and-shape-library.md", "插入菜单与形状库/变换手柄", "编辑器·面板", "/v3/editor",
    [["quick", "形状 ▾ · 全部形状入口", { q: "state=shape-library.quick" }], ["library", "全部形状 · 72 项", { q: "state=shape-library.library" }],
     ["insert-drag", "拖出预览", { q: "state=shape-library.insert-drag" }], ["inserted", "已插入 · 变换手柄", { q: "state=shape-library.inserted" }],
     ["action-settings", "动作按钮 · 操作设置", { q: "state=shape-library.action-settings" }], ["header-footer", "页眉和页脚", { q: "state=insert.header-footer" }],
     ["icons", "插入图标 · 已选 3 个", { q: "state=insert.icons" }], ["symbols", "符号面板 · 编辑文本", { q: "state=insert.symbols" }]]),
  // 16：第 1 批改拍 v3 场景 text-edit（标签同 03-16 §2 的标题列）；含 G-80 空内容占位符图标条与 G-81 日期和时间
  S("16", "16-text-editing-and-formatting.md", "文本编辑态与格式化", "编辑器·画布", "/v3/editor",
    [["editing", "编辑中 · 检查器「文本」", { q: "state=text-edit.editing" }], ["bullets", "项目符号库 · 两级", { q: "state=text-edit.bullets" }],
     ["font", "中文字体 · 可搜索", { q: "state=text-edit.font" }], ["color", "文字颜色 · 主题色 10 × 6", { q: "state=text-edit.color" }],
     ["restricted-font", "受限字体 · 编辑时替代", { q: "state=text-edit.restricted-font" }], ["placeholder", "空占位符 · 提示文字与图标条", { q: "state=text-edit.placeholder" }],
     ["placeholder-focus", "图标条 · 键盘焦点与禁用原因", { q: "state=text-edit.placeholder-focus" }], ["placeholder-collapsed", "窄栏 · 折叠为「插入 ▾」", { q: "state=text-edit.placeholder-collapsed" }],
     ["placeholder-table", "占位符 · 表格网格", { q: "state=text-edit.placeholder-table" }], ["placeholder-drop", "图片拖入空占位符", { q: "state=text-edit.placeholder-drop" }],
     ["datetime", "日期和时间 · 格式选择器", { q: "state=text-edit.datetime" }], ["link-dialog", "链接 · 本文稿中的页", { q: "state=text-edit.link-dialog" }]]),
  // 17：第 1 批改拍 v3 场景 selection（标签同 03-17 §9）
  S("17", "17-selection-alignment-and-snapping.md", "选择、多选、对齐、分布、吸附、网格与参考线", "编辑器·画布", "/v3/editor",
    [["marquee", "框选中", { q: "state=selection.marquee" }], ["multi-select", "多选 · 包围盒与混合值", { q: "state=selection.multi-select" }],
     ["smart-guides", "拖动 · 智能参考线", { q: "state=selection.smart-guides" }], ["grid-visible", "显示网格", { q: "state=selection.grid-visible" }],
     ["align-menu", "异类多选 · 对齐与分布菜单", { q: "state=selection.align-menu" }], ["connector-snap", "连接符 · 端点吸附", { q: "state=selection.connector-snap" }]]),
  // 18：第 1 批改拍 v3 场景 image-editing（标签同 03-18 §2 的标题列）
  S("18", "18-image-editing.md", "图片操作（上传/裁剪/替代文本）", "编辑器·画布", "/v3/editor",
    [["selected", "选中图片 · 缺替代文本", { q: "state=image-editing.selected" }], ["crop", "裁剪模式", { q: "state=image-editing.crop" }],
     ["uploading", "上传中", { q: "state=image-editing.uploading" }], ["upload-failed", "上传失败", { q: "state=image-editing.upload-failed" }],
     ["compress", "大图压缩提示", { q: "state=image-editing.compress" }], ["icon", "图标改色", { q: "state=image-editing.icon" }],
     ["video", "已有视频 · 临时播放", { q: "state=image-editing.video" }]]),
  // 19：第 1 批改拍 v3 场景 undo-clipboard（标签同 03-19 §3 的样张标题）
  S("19", "19-undo-redo-clipboard-and-save-state.md", "撤销重做、剪贴板反馈、保存态与离开保护", "编辑器·画布", "/v3/editor",
    [["edit-menu", "主菜单 · 编辑", { q: "state=undo-clipboard.edit-menu" }], ["undo-partial", "协同撤销 · 部分跳过", { q: "state=undo-clipboard.undo-partial" }],
     ["undo-blocked", "协同撤销 · 整步被跳过", { q: "state=undo-clipboard.undo-blocked" }], ["paste-html", "粘贴网页内容 · 格式已简化", { q: "state=undo-clipboard.paste-html" }],
     ["clipboard-denied", "剪贴板未授权", { q: "state=undo-clipboard.clipboard-denied" }], ["saving", "保存态 · 保存中", { q: "state=undo-clipboard.saving" }],
     ["save-failed", "保存态 · 保存失败", { q: "state=undo-clipboard.save-failed" }]]),
  // 20：第 1 批改拍 v3 场景 view-zoom 的全部 6 个状态（标签同 03-20 §3）
  S("20", "20-view-zoom-and-navigation.md", "视图、缩放与导航", "编辑器·画布", "/v3/editor",
    [["zoom-menu", "缩放菜单", { q: "state=view-zoom.zoom-menu" }], ["zoomed", "放大到 150%", { q: "state=view-zoom.zoomed" }],
     ["view-menu", "主菜单 · 视图", { q: "state=view-zoom.view-menu" }], ["grid-guides", "显示网格与参考线", { q: "state=view-zoom.grid-guides" }],
     ["panel-size", "面板尺寸与记忆", { q: "state=view-zoom.panel-size" }], ["page-jump", "数字跳页", { q: "state=view-zoom.page-jump" }]]),
  // 21：第 1 批改拍 v3 场景 find-replace（标签同 03-21 §3 的样张标题）
  S("21", "21-find-and-replace.md", "查找与替换", "编辑器·画布", "/v3/editor",
    [["default", "查找 · 有匹配", { q: "state=find-replace.default" }], ["replace", "查找 + 替换", { q: "state=find-replace.replace" }],
     ["no-match", "无结果", { q: "state=find-replace.no-match" }], ["replaced", "全部替换完成", { q: "state=find-replace.replaced" }],
     ["hidden-slide", "命中位于隐藏页", { q: "state=find-replace.hidden-slide" }]]),
  // 22：第 3 批改拍 v3 场景 export（编辑器宿主），标签同 03-22 §3 的样张标题
  S("22", "22-export-dialog.md", "导出对话框", "导入导出", "/v3/editor",
    [["default", "默认 · PowerPoint 整份", { q: "state=export.default" }],
     ["png", "选 PNG · 宽度与范围", { q: "state=export.png" }],
     ["m3-pdf", "选 PDF · 插件格式同屏（M3）", { q: "state=export.m3-pdf" }],
     ["custom-range-error", "自定义页码有误", { q: "state=export.custom-range-error" }],
     ["unsynced-client", "有未同步更改 · 浏览器生成的格式", { q: "state=export.unsynced-client" }],
     ["waiting-sync", "等待同步", { q: "state=export.waiting-sync" }],
     ["generating", "生成中（浏览器）", { q: "state=export.generating" }],
     ["failed", "导出失败", { q: "state=export.failed" }],
     ["exported-toast", "完成 · 关闭并轻提示", { q: "state=export.exported-toast" }],
     ["no-permission", "查看者 · 导出不可用", { q: "state=export.no-permission" }],
     ["unsynced-server", "需先同步 · 服务端格式", { q: "state=export.unsynced-server" }]]),
  // 23：第 3 批改拍 v3 场景 settings（编辑器宿主；from-home 画在开始页，route 覆盖），标签同 03-23 §3 的样张标题（不带表里标宿主的「（开始页）」），
  //     标题随 03-23 改为「偏好设置」；phone（390 × 844）、compact（1000 × 760）有专属视口，不登记
  S("23", "23-settings-panel.md", "偏好设置", "设置与帮助", "/v3/editor",
    [["default", "默认 · 编辑器里打开", { q: "state=settings.default" }],
     ["from-home", "从开始页打开", { route: "/v3/home", q: "state=settings.from-home" }],
     ["embedded-locked", "嵌入 · 集成方锁定", { q: "state=settings.embedded-locked" }],
     ["language-switching", "切换语言中", { q: "state=settings.language-switching" }],
     ["language-failed", "语言包加载失败", { q: "state=settings.language-failed" }],
     ["copied", "已复制诊断信息", { q: "state=settings.copied" }],
     ["telemetry", "M3 · 部署开了产品遥测出口", { q: "state=settings.telemetry" }],
     ["dev-build", "开发构建", { q: "state=settings.dev-build" }]]),
  // 24：第 3 批改拍 v3 场景 shortcuts（标签同 03-24 §3 的样张标题，不带「（开始页）」）与 command-palette（标签同 §8.6），编辑器宿主；shortcuts.from-home
  //     画在开始页（route 覆盖），grid 自带网格视图、q 带 view=grid；标题随 03-24 改为「键盘快捷键面板与命令面板」；compact（1000 × 760）有专属视口，不登记
  S("24", "24-keyboard-shortcuts-panel.md", "键盘快捷键面板与命令面板", "设置与帮助", "/v3/editor",
    [["default", "默认 · 编辑器（macOS）", { q: "state=shortcuts.default" }],
     ["entry-main-menu", "入口 · 主菜单「帮助」", { q: "state=shortcuts.entry-main-menu" }],
     ["search", "搜索：缩放", { q: "state=shortcuts.search" }],
     ["conflict", "冲突 · 可为我关闭", { q: "state=shortcuts.conflict" }],
     ["windows", "Windows / Linux 键名", { q: "state=shortcuts.windows" }],
     ["from-home", "从开始页打开", { route: "/v3/home", q: "state=shortcuts.from-home" }],
     ["review", "评审模式里打开", { q: "state=shortcuts.review" }],
     ["grid", "网格视图里打开", { q: "state=shortcuts.grid&view=grid" }],
     ["command-palette", "打开 · 常用命令", { q: "state=command-palette.default" }],
     ["command-palette-search", "搜索结果「顺序」", { q: "state=command-palette.search" }]]),
  // 25：第 3 批改拍 v3 场景 viewer（编辑器宿主），标签同 03-25 §3 的样张标题；「ⓘ 保真摘要」由第 2 批的 fidelity.viewer-shell 换成 viewer.summary
  //     （DS-110：第 2 批搭的最小壳换成查看器桌面壳，ⓘ 卡片不动）；窄屏 narrow-*（390 × 844）有专属视口，不登记；嵌入形态 C（embed.viewer-box）随嵌入归 33
  S("25", "25-viewer-preset-shell.md", "只读查看器 preset 壳", "查看器与放映", "/v3/editor",
    [["default", "桌面默认", { q: "state=viewer.default" }],
     ["loading", "打开中", { q: "state=viewer.loading" }],
     ["failed", "打开失败 · 通用兜底", { q: "state=viewer.failed" }],
     ["failed-code", "打开失败 · 按错误码", { q: "state=viewer.failed-code" }],
     ["summary", "ⓘ 保真摘要卡", { q: "state=viewer.summary" }],
     ["missing-plugin", "缺插件元素", { q: "state=viewer.missing-plugin" }],
     ["zoom-menu", "缩放读数菜单", { q: "state=viewer.zoom-menu" }],
     ["search", "搜索", { q: "state=viewer.search" }],
     ["thumbnails", "宿主开启缩略图条", { q: "state=viewer.thumbnails" }],
     ["notes", "宿主开启备注", { q: "state=viewer.notes" }]]),
  // 26：第 1 批改拍 v3 场景 master-view（标签同 03-26 §6 主表的样张标题）；母版视图改版（2026-11-03 拍板，rulings §4.25 DS-144…DS-177）改登记 14 态：
  //     普通视图的三个入口（主菜单「视图」、检查器「编辑版式」、「转到版式」，DS-147）、编辑版式与编辑母版、占位符与继承项、M2 浏览版式（DS-156）、
  //     插入占位符、右键、多选、主题、加载中与降权（原登记的 delete-confirm 不再登记）。紧凑与仅查看形态的母版视图（narrow.compact-master*，1000 × 760；
  //     narrow.viewonly-master-key，390 × 844）有专属视口，归 03-02 §5a 与 03-26 §6.6，不在此登记；对比场景 master-view-options 只作对照（03-26 §6.9），不登记
  S("26", "26-master-view-and-editing.md", "母版视图与母版 / 版式编辑", "母版与主题", "/v3/editor",
    [["default", "编辑版式（默认）", { q: "state=master-view.default" }],
     ["entry", "入口 · 主菜单「视图」", { q: "state=master-view.entry" }],
     ["entry-inspector", "入口 · 检查器「编辑版式」", { q: "state=master-view.entry-inspector" }],
     ["goto-layout", "入口 · 转到版式", { q: "state=master-view.goto-layout" }],
     ["edit-master", "编辑母版", { q: "state=master-view.edit-master" }],
     ["placeholder", "占位符属性 · 覆盖与重置", { q: "state=master-view.placeholder" }],
     ["inherited", "选中继承的页脚", { q: "state=master-view.inherited" }],
     ["m2-default", "M2 · 浏览版式", { q: "state=master-view.m2-default" }],
     ["insert-placeholder", "插入占位符（M3）", { q: "state=master-view.insert-placeholder" }],
     ["context-menu", "右键版式缩略图（M3）", { q: "state=master-view.context-menu" }],
     ["multi-select", "多选版式（M3）", { q: "state=master-view.multi-select" }],
     ["theme", "编辑主题 · 预览当前母版", { q: "state=master-view.theme" }],
     ["loading", "加载中", { q: "state=master-view.loading" }],
     ["readonly", "只读 · 已在其中被降权", { q: "state=master-view.readonly" }]]),
  // 27：第 1 批改拍 v3 场景 layout-picker（标签同 03-27 §4 的样张标题）；readonly 的标签 2026-11-04 随 rulings §4.25 DS-147 子题由「评审模式 · 入口不出现」改为
  //     「评审模式 · 画廊入口不出现」（只读时检查器「版式」节标题右侧的「编辑版式」留在原位、不可用，没有的只是画廊入口）
  S("27", "27-layout-picker-and-reset.md", "版式选择器（按母版分组的版式画廊）与重置页", "母版与主题", "/v3/editor",
    [["default", "版式画廊 · 多母版分组", { q: "state=layout-picker.default" }], ["cross-master", "选中其它母版的版式", { q: "state=layout-picker.cross-master" }],
     ["search", "搜索过滤", { q: "state=layout-picker.search" }], ["mismatch", "应用后有元素不匹配", { q: "state=layout-picker.mismatch" }],
     ["reset-confirm", "重置占位符 · 确认", { q: "state=layout-picker.reset-confirm" }], ["readonly", "评审模式 · 画廊入口不出现", { q: "state=layout-picker.readonly" }]]),
  // 28：第 1 批改拍 v3 场景 design-themes 的全部 6 个状态（标签同 03-28 §3 的样张标题）；主题画廊 2026-10-08 按 DS-33 换成内置 5 套主题（与开始页模板同一份数据）+ 首位「当前」卡，状态 id 不变
  S("28", "28-design-tab-and-themes.md", "设计主题：主题画廊、变体、主题颜色与字体", "母版与主题", "/v3/editor",
    [["gallery", "主题画廊", { q: "state=design-themes.gallery" }], ["applied", "应用主题 · 可撤销", { q: "state=design-themes.applied" }],
     ["colors", "编辑主题颜色", { q: "state=design-themes.colors" }], ["fonts", "编辑主题字体", { q: "state=design-themes.fonts" }],
     ["dark-theme", "深色文档主题", { q: "state=design-themes.dark-theme" }], ["readonly", "评审模式 · 只能查看", { q: "state=design-themes.readonly" }]]),
  // 29：design-language-v3 第 0 批改拍 v3 首页；第 3 批改拍场景 home（标签同 03-29 §3 的样张标题）、account-menu 在开始页的三态（同 §3 账户菜单表）与 templates
  //     （宿主 /v3/templates，route 覆盖，标签同 §7 的状态表）。不带 state 的首页随第 3 批转正就是 home.m2-default 的画法，原「默认」改登记 m2-default；
  //     「列表显示」照旧由「显示方式」的「列表」按钮点出（HomeBody 没有对应 URL 参数）。紧凑与手机（compact*、phone*）有专属视口，不登记；
  //     account-menu 的 editor、embedded-logout 两态在编辑器宿主，不在此登记
  S("29", "29-home-start-page.md", "应用首页（开始页）", "应用壳", "/v3/home",
    [["m2-default", "M2 默认", { q: "state=home.m2-default" }],
     ["list", "列表显示", { click: "列表" }],
     ["card-menu", "最近卡片的「⋯」菜单", { q: "state=home.card-menu" }],
     ["first-run", "首次使用（最近为空）", { q: "state=home.first-run" }],
     ["offline", "离线", { q: "state=home.offline" }],
     ["creating", "正在创建", { q: "state=home.creating" }],
     ["help-menu", "帮助菜单", { q: "state=home.help-menu" }],
     ["account-member", "普通成员（M2，开始页用户行）", { q: "state=account-menu.member" }],
     ["account-admin", "平台管理员（M3）", { q: "state=account-menu.admin" }],
     ["profile-dialog", "个人资料对话框（M3）", { q: "state=account-menu.profile-dialog" }],
     ["templates", "模板库（配置了集成方模板源）", { route: "/v3/templates", q: "state=templates.default" }],
     ["template-preview", "预览", { route: "/v3/templates", q: "state=templates.preview" }]]),
  // 30 / 31：第 1 批改拍 v3 场景 table、chart 的全部状态（30 为 19 个，标签同 03-30 §11；31 为 16 个，标签同 03-31「状态」的标题列）；
  // 旧版 /editor/table、/editor/chart 的登记（§4.21 样张，含 31 的 drawer、type-confirm-menu）随 rulings §4.25 DS-7 作废
  S("30", "30-table-editing.md", "表格编辑", "编辑器·画布", "/v3/editor",
    [["grid", "插入网格 · 3 行 × 4 列", { q: "state=table.grid" }], ["placeholder-grid", "占位符 · 表格网格", { q: "state=table.placeholder-grid" }],
     ["table-dialog", "插入表格对话框", { q: "state=table.table-dialog" }], ["table-dialog-error", "对话框 · 超出上限", { q: "state=table.table-dialog-error" }],
     ["inserted", "插入后 · 首格光标", { q: "state=table.inserted" }], ["inserted-free", "插入后 · 页上没有空占位符", { q: "state=table.inserted-free" }],
     ["cell-nav", "单元格编辑 · Tab 导航", { q: "state=table.cell-nav" }], ["m2-range", "M2 · 单元格选区", { q: "state=table.m2-range" }],
     ["m2-menu", "M2 · 右键结构编辑灰显", { q: "state=table.m2-menu" }], ["range", "M3 · 单元格选区", { q: "state=table.range" }],
     ["context-menu", "M3 · 右键行列与合并", { q: "state=table.context-menu" }], ["merged", "M3 · 合并单元格后", { q: "state=table.merged" }],
     ["borders", "M3 · 边框选择器", { q: "state=table.borders" }], ["hover-insert", "M3 · 悬停插入手柄", { q: "state=table.hover-insert" }],
     ["resize", "M3 · 拖分隔线调列宽", { q: "state=table.resize" }], ["styles", "M3 · 表格样式库与 6 个标志", { q: "state=table.styles" }],
     ["styles-all", "M3 · 样式库全部 74 种", { q: "state=table.styles-all" }], ["remote-delete", "他人删除了正在编辑的行", { q: "state=table.remote-delete" }],
     ["readonly", "评审者 · 只读", { q: "state=table.readonly" }]]),
  S("31", "31-chart-editing.md", "图表编辑", "编辑器·画布", "/v3/editor",
    [["inserted", "插入后 · 示例图表与数据", { q: "state=chart.inserted" }], ["menu", "工具条「图表」· 五类与子类型", { q: "state=chart.menu" }],
     ["placeholder-chart", "占位符图标条 › 图表", { q: "state=chart.placeholder-chart" }], ["data-panel", "数据面板 · 非法输入", { q: "state=chart.data-panel" }],
     ["grid-menu", "数据网格 · 行列右键菜单", { q: "state=chart.grid-menu" }], ["compact-overflow", "紧凑网格 · 超过 8 × 4", { q: "state=chart.compact-overflow" }],
     ["workbook-notice", "数据面板 · 原工作簿提示", { q: "state=chart.workbook-notice" }], ["type-menu", "类型下拉 · 当前子类型", { q: "state=chart.type-menu" }],
     ["type-switch", "更改类型之后", { q: "state=chart.type-switch" }], ["type-confirm", "类型下拉 · 会移除导入内容", { q: "state=chart.type-confirm" }],
     ["options", "标题 / 图例 / 数据标签", { q: "state=chart.options" }], ["pie", "饼图 · 百分比标签", { q: "state=chart.pie" }],
     ["readonly-type", "只读类型 · 雷达图", { q: "state=chart.readonly-type" }], ["m2-disabled", "M2 · 图表禁用 · 选中导入图表", { q: "state=chart.m2-disabled" }],
     ["review", "评审模式 · 只读", { q: "state=chart.review" }], ["viewer", "查看者 · 只读饼图", { q: "state=chart.viewer" }]]),
  // 32：rulings §4.23 新建管理员插件管理（G-84 / G-85，PM-03…PM-09）；第 3 批改拍 v3 场景 admin-plugins（宿主 /v3/admin/plugins），标签同 03-32 §14
  //     状态清单的样张标题，标题随 03-32 改为「管理员插件管理（管理 › 插件）」；旧版 /admin/plugins 的 11 个演示态（含已删去的「无权限」，TB-101）作废
  S("32", "32-admin-plugin-management.md", "管理员插件管理（管理 › 插件）", "应用壳", "/v3/admin/plugins",
    [["default", "默认", { q: "state=admin-plugins.default" }],
     ["rejected", "未通过部署校验", { q: "state=admin-plugins.rejected" }],
     ["draft", "草稿与保存条", { q: "state=admin-plugins.draft" }],
     ["mutex", "互斥 · 阻止保存", { q: "state=admin-plugins.mutex" }],
     ["dep-conflict", "禁用被依赖的插件", { q: "state=admin-plugins.dep-conflict" }],
     ["first-enable", "首次启用第三方（M4）", { q: "state=admin-plugins.first-enable" }],
     ["change-confirm", "变更确认卡", { q: "state=admin-plugins.change-confirm" }],
     ["detail", "详情抽屉 · 数据图表增强", { q: "state=admin-plugins.detail" }],
     ["unsigned-allowed", "非生产允许未签名（M4）", { q: "state=admin-plugins.unsigned-allowed" }],
     ["error", "加载失败", { q: "state=admin-plugins.error" }]]),
  // 33：第 3 批新建（rulings §4.25 DS-71）。场景 shell-pages（宿主 /v3/page；not-found-doc、link-expired、logout-unsynced-confirm 在编辑器宿主，route 覆盖）
  //     标签同 03-33 §3 的样张标题；场景 embed（宿主 /v3/embed，route 覆盖）标签同 §9.4——嵌入归 33（§9 写嵌入形态自己的页面），只登记 §9.1、§9.2 的
  //     请在新窗口登录与打开失败，完整 / 紧凑 / 仅查看形态归 03-02 §5a.4；login-narrow（390 × 844）、popup-completing、popup-failed（520 × 680）有专属视口，不登记
  S("33", "33-login-session-and-error-pages.md", "登录、会话与错误页", "应用壳", "/v3/page",
    [["login", "登录 · 默认", { q: "state=shell-pages.login" }],
     ["login-redirecting", "登录 · 正在跳转", { q: "state=shell-pages.login-redirecting" }],
     ["login-error-retry", "登录 · 登录没有完成", { q: "state=shell-pages.login-error-retry" }],
     ["callback-network-error", "回调 · 网络失败", { q: "state=shell-pages.callback-network-error" }],
     ["not-found-route", "找不到此页面", { q: "state=shell-pages.not-found-route" }],
     ["not-found-doc", "找不到该文档", { route: "/v3/editor", q: "state=shell-pages.not-found-doc" }],
     ["link-expired", "链接已失效", { route: "/v3/editor", q: "state=shell-pages.link-expired" }],
     ["app-error", "页面出错了", { q: "state=shell-pages.app-error" }],
     ["config-error", "配置错误", { q: "state=shell-pages.config-error" }],
     ["logout-unsynced-confirm", "退出登录 · 有未同步更改", { route: "/v3/editor", q: "state=shell-pages.logout-unsynced-confirm" }],
     ["auth-required", "请在新窗口登录 · 未登录（容器 960 × 540）", { route: "/v3/embed", q: "state=embed.auth-required" }],
     ["open-failed", "嵌入里的打开失败（容器 960 × 540）", { route: "/v3/embed", q: "state=embed.open-failed" }]]),
]
// 非 03-screens 的补充界面（样式指南：09-design-specification §2），生成器可选用
const EXTRAS = [{ ...S("styleguide", "", "样式指南（组件状态矩阵）", "设计系统", "/styleguide", [["default", "默认", { noBar: true }]]), doc: "09-design-specification.md" }]

async function shoot(ctx, base, st, file, theme) {
  const page = await ctx.newPage(); const errs = []; const notes = []; let switched = false;
  page.on("pageerror", (e) => errs.push("pageerror " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.location().url || "")) errs.push("console " + m.text().slice(0, 160)) });
  try {
    const v3 = isV3(st.route); const hash = v3 ? v3Hash(st.route, st.q, theme) : `#${st.route}`;
    await page.goto(`${base.replace(/\/$/, "")}/${hash}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const trig = page.locator(TRIGGER).first();
    if (v3) {
      // v3：状态已由地址决定，没有 DesignBar；只有页内状态需要点一下
      await page.locator(".v3-root").first().waitFor({ timeout: 15000 });
      if (st.click) {
        await page.getByRole("button", { name: st.click, exact: true }).click();
        await page.mouse.move(2, 2);
        await page.evaluate(() => { const a = document.activeElement; if (a && a !== document.body) a.blur() });
      }
    } else if (!st.noBar) {
      await trig.waitFor({ timeout: 15000 });
      if (!st.click && (await trig.innerText()).trim() !== st.label) {
        if (!st.direct) {
          await trig.click();
          await page.locator("[data-slot=select-content] [data-slot=select-item]").filter({ hasText: new RegExp(`^${st.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).click();
          await page.locator("[data-slot=select-content]").waitFor({ state: "detached" });
          await page.waitForTimeout(300);
        }
        switched = true;
        // 兜底：个别演示态（如查看器「保真摘要卡片」Popover）会被下拉关闭时的焦点回收立刻关掉并复位，改为直接调用 DesignBar 的 onStateChange
        // （DOM 节点上的 fiber 可能是旧树，Radix Select 内部 setValue 闭包会过期；DesignBar 回调只包 setState，旧闭包也可用）；登记了 direct 的直接走这里
        if ((await trig.innerText()).trim() !== st.label) {
          if (!st.direct) notes.push(`点击切换未保持，已改用 DesignBar onStateChange 直设「${st.value}」`);
          await page.evaluate(({ sel, value }) => {
            const el = document.querySelector(sel); const k = Object.keys(el).find((x) => x.startsWith("__reactFiber$"));
            for (let f = el[k]; f; f = f.return) { const p = f.memoizedProps; if (p && typeof p.onStateChange === "function" && p.stateOptions) return p.onStateChange(value) }
          }, { sel: TRIGGER, value: st.value });
        }
      }
      if (st.click) await page.getByRole("button", { name: st.click, exact: true }).click();
      // 下拉关闭后焦点回到触发器会留下焦点环（演示控制条而非设计本身），仅当焦点仍在触发器/演示按钮上时移除
      await page.evaluate((sel) => { const a = document.activeElement; if (a && (a.matches(sel) || a.closest(".glass.z-\\[60\\]"))) a.blur() }, TRIGGER);
      // 鼠标移到 DesignBar 标题（纯文本）上，避免停在下拉项原位置触发画面上的悬停态/提示
      const title = page.locator("span.whitespace-nowrap.font-medium").first();
      const tb = await title.boundingBox(); if (tb) await page.mouse.move(tb.x + 4, tb.y + tb.height / 2);
    }
    if (st.hover) {
      const b = await page.getByRole("application", { name: st.hover }).boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.move(b.x + b.width / 2 + 12, b.y + b.height / 2 + 8);
    }
    await page.waitForTimeout(st.click ? 900 : 700);
    const chk = await page.evaluate(() => {
      const r = document.querySelector(".v3-root");
      return { hash: location.hash, dark: document.documentElement.classList.contains("dark"), text: document.body.innerText,
        v3: r && { theme: r.getAttribute("data-v3-theme"), accent: r.getAttribute("data-v3-accent"), scheme: getComputedStyle(r).colorScheme } };
    });
    if (v3) {
      if (!sameHash(chk.hash, hash)) errs.push(`地址被改写：${chk.hash}（期望 ${hash}）`);
      if (!chk.v3) errs.push("v3 根节点 .v3-root 未渲染");
      else {
        if (chk.v3.theme !== theme || chk.v3.scheme !== theme) errs.push(`主题不符：期望 ${theme}，data-v3-theme=${chk.v3.theme}、color-scheme=${chk.v3.scheme}`);
        if (chk.v3.accent !== V3_ACCENT) errs.push(`强调色不符：期望 ${V3_ACCENT}，data-v3-accent=${chk.v3.accent}`);
      }
      if (/找不到场景状态/.test(chk.text)) errs.push("state 参数无效：编辑器顶部出现「找不到场景状态」横幅");
    } else {
      if (chk.hash !== hash) errs.push(`路由跳走：${chk.hash}`);
      if (chk.dark !== (theme === "dark")) errs.push(`主题不符：期望 ${theme}`);
      if (!st.noBar && !st.click && (await trig.innerText()).trim() !== st.label) errs.push(`下拉未切到「${st.label}」`);
    }
    if (/Unexpected Application Error|404 Not Found/.test(chk.text)) errs.push("出现错误页");
    await page.screenshot({ path: file, type: "jpeg", quality: 78 });
  } catch (e) { errs.push("异常 " + String(e.message || e).split("\n")[0]) }
  await page.close();
  return { switched, errs, notes };
}

(async () => {
  const [base, out] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const only = (process.argv.find((a) => a.startsWith("--only=")) || "--only=").slice(7).split(",").filter(Boolean);
  if (!base || !out) { console.error("用法：node capture-screens.cjs <dist 服务 URL> <输出目录> [--only=08,13]"); process.exit(1) }
  fs.mkdirSync(out, { recursive: true });
  const browser = await pw.chromium.launch({ channel: "chrome" }).catch(() => pw.chromium.launch());
  const ctxs = {};
  for (const theme of ["light", "dark"]) for (const [suffix, dsf] of [["", 1], [".thumb", 0.5]]) {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dsf, colorScheme: theme, locale: "zh-CN" });
    await c.addInitScript((t) => { try { localStorage.setItem("cordex-theme", t) } catch {} }, theme);
    ctxs[theme + suffix] = c;
  }
  const done = new Map(); const issues = []; let shots = 0; const routes = new Set();
  const build = async (s) => {
    const e = { doc: s.doc, id: s.id, title: s.title, group: s.group, route: s.route ? `#${s.route}` : null, states: [], ...(s.seeAlso ? { seeAlso: s.seeAlso } : {}) };
    for (const [k, [value, label, opt = {}]] of s.states.entries()) {
      const route = opt.route || s.route; const v3 = isV3(route); // 状态可用 route 覆盖条目路由（见上方 SCREENS 注释）
      const key = v3 ? `${route}?${opt.q || ""}|${opt.click || ""}` : `${route}|${value}`; let rec = done.get(key);
      if (!rec && (!only.length || only.includes(s.id))) {
        const stem = `${s.id}--${value}`; routes.add(route);
        const files = { light: `${stem}--light.jpg`, dark: `${stem}--dark.jpg`, thumbLight: `${stem}--light.thumb.jpg`, thumbDark: `${stem}--dark.thumb.jpg` };
        const jobs = [["light", files.light, "light"], ["dark", files.dark, "dark"], ["light.thumb", files.thumbLight, "light"], ["dark.thumb", files.thumbDark, "dark"]];
        // 四个上下文并行；python http.server 并发时偶发连接重置，失败的单张错开重试至多 2 次，只保留最后一次的问题
        const res = await Promise.all(jobs.map(async ([ck, f, theme], i) => {
          let r; for (let n = 0; n < 3; n++) {
            await new Promise((ok) => setTimeout(ok, i * 120 + n * 800));
            r = await shoot(ctxs[ck], base, { ...opt, route, value, label }, path.join(out, f), theme); if (!r.errs.length) break;
          }
          return r;
        }));
        res.forEach((r, i) => [...r.errs, ...r.notes.map((m) => "（兜底）" + m)].forEach((m) => issues.push(`${jobs[i][1]}: ${m}`)));
        rec = { files, isDefault: !opt.click && res.every((r) => !r.switched) }; done.set(key, rec); shots += 4;
        console.log(`✓ ${stem}${(v3 ? k === 0 : rec.isDefault) ? "（默认态）" : ""}`);
      }
      const isDefault = isV3(s.route) ? k === 0 : !opt.route && rec && rec.isDefault; // 旧版条目里改拍 v3 的状态不作封面
      if (rec && Object.values(rec.files).every((f) => fs.existsSync(path.join(out, f))))
        e.states.push({ value, label, ...(isDefault ? { default: true } : {}), ...(opt.note ? { note: opt.note } : {}), ...(v3 ? { query: opt.q || "" } : {}), ...(opt.route ? { route: `#${route}` } : {}), ...rec.files });
    }
    return e;
  };
  const screens = []; for (const s of SCREENS) screens.push(await build(s));
  const extras = []; for (const s of EXTRAS) extras.push(await build(s));
  await browser.close();
  if (!only.length) {
    const manifest = { playgroundUrl: PLAYGROUND_URL, generatedAt: new Date().toISOString(), viewport: "1440x900", thumb: "720x450", screens, extras };
    fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  }
  console.log(`routes ${routes.size}, shots ${shots}, issues ${issues.length}`); issues.forEach((m) => console.log("✗ " + m));
})();
