> 状态：草稿 | 负责：设计（审计） | 更新：2026-09-16；2026-10-04（design-language-v3 第 0 批：状态头注明已被取代，正文不改）；2026-10-05（design-language-v3 第 0 批修正：取代说明补命令面板快捷键的改读（⌘⇧P → `Mod+K`，rulings §4.25 DS-11），正文不改） | 依赖：09-design-specification v2.0、04-design-system v0.3、playground `dist` 构建产物快照（2026-09-16，未重新构建）
> **已被 rulings §4.25 DS-1/DS-2 取代**（2026-10-04，设计语言 v3）：本文以 iOS Liquid Glass 为参照的审计结论只作历史参考，现行规范见 09 v4.0、04 v1.0；正文保持原样不再修订。文中命令面板的快捷键 ⌘⇧P 是当时的取值，2026-10-05 起为 `Mod+K`（rulings §4.25 DS-11，PRD ED-30），旧值作废。

# 10 现代化审计（Modernization Audit）—— 对照 iOS Liquid Glass 的逐屏挑刺

> 本轮任务范围：**只审计，不改代码、不改规范文档**。审计对象是 `docs/20-design/playground/dist` 的当前构建产物，覆盖 `registry.ts` 登记的 18 条路由 + 根路由 `/`（Hub），亮/暗各一张，共 38 张截图。所有结论均可在截图与源码（`src/components/ui/*`、`src/components/editor/*`）中找到对应证据，证据位置随文标注。
>
> **范围澄清（先说明，避免误判）**：几乎每条路由截图的最顶部都有一行"目录 / 路由标题 / spec 编号 / 状态切换下拉 / 屏幕·太阳·月亮图标"，这是 playground 自带的**评审工具条**（供设计/工程切换演示状态、主题、视口），不会进入 Cordex 产品最终 chrome。下文涉及该行的观察仅作为"同一视觉毛病在评审工具条里又出现了一次"的佐证，**不建议为这一行单独投入改造**；真正的整改目标是它下方的产品级 chrome（AppBar、Ribbon、缩略图栏、检查器、状态栏、画布、放映舞台、各类弹层）。

---

## 1. 审计标准：把"现代 iOS 风格 / Liquid Glass"拆成可核对的条目

| 维度 | 判定标准（可核对） | 现状常见反例（证据） |
|---|---|---|
| 材质与层次 | 悬浮的容器（侧栏、检查器、工具条、弹层）应有半透明背景+`backdrop-filter: blur()`，让背后内容透出模糊轮廓，制造"这是浮在另一层之上的玻璃"的直觉 | 全稿唯一的模糊痕迹是 `dialog.tsx`/`sheet.tsx` 的 `supports-backdrop-filter:backdrop-blur-xs`（仅 4px）+ `bg-black/10`；侧栏、检查器、Ribbon、状态栏**零材质**，纯色贴合背景（`AppBar.tsx` `bg-background`、`ThumbnailRail`/`Inspector` 无背景色声明即继承页面底色） |
| 圆角与胶囊 | 悬浮程度越高，圆角应越大；工具条/分段控件/徽标应收敛为胶囊（`border-radius: 9999px`） | `--radius` 基准仅 8px，派生 `rounded-lg`(8px)/`rounded-xl`(11.2px) 已是按钮和卡片的最大值（`button.tsx`、`card.tsx`、`dialog.tsx`）；全稿只有 `badge.tsx`(`rounded-4xl`=20.8px≈胶囊) 与放映舞台控制条（`bg-stage-chrome rounded-full`）两处真正的胶囊，且后者未配材质 |
| 悬浮与留白 | 面板应与视口/相邻面板保持 8–16px 呼吸间隙，而不是贴边零间距 | `EditorShell.tsx` 的 `ResizablePanel` 直接 `border-r`/`border-l` 贴边分栏；`settings` 路由的 `Sheet` 贴齐视口右边缘、直角、零边距 |
| 分隔线与边框用量 | 分区优先用留白/材质差异表达，1px 实线仅作最后手段且要克制使用 | `Ribbon` 分组用竖直 `border-r`（`ribbon/primitives.tsx` `RibbonGroup`）；三栏布局、检查器 Tab（`border-b-2`）、状态栏（`border-t`）、离线横幅（`border-b`）全部靠硬线分区，是全稿最大公约数问题（见 §3-1） |
| 阴影 | 悬浮元素用柔和大半径低不透明度阴影表达"浮起"（如 `0 20px 40px rgba(0,0,0,.12)`），而不是描边 | `card.tsx`/`dialog.tsx` 只有 `ring-1 ring-foreground/10` 发丝描边，**无 `shadow-*` 类**；`popover.tsx`/`dropdown-menu.tsx`/`context-menu.tsx` 有 `shadow-md`/`shadow-lg` 但强度中规中矩，未做"大半径柔光"处理 |
| 字体与字重节奏 | 层级靠字重与不透明度变化，同屏字号级差不宜过密 | 09 §1.3 定义的字阶克制（12/14/16/20px）本身合理，但 Ribbon/Inspector 里大量 11–12px 密集文字标签（分组标签、属性行标签）与正文同权重摆放，节奏被压平 |
| 色彩饱和与灰度 | 强调色克制使用，制造"高光时刻"；大面积保持中性灰阶 | Hub 页 15 张卡片全部挂实心 `primary` 徽标"已完成"，直接违反 09 §0 S-06"一屏实心 primary ≤3 处"（见 §2 Hub 行） |
| 图标一致性 | 单一图标家族、统一描边粗细与视觉重量，主次分明 | 现状统一用 Lucide（符合 09 §1.4），家族一致这点没问题；问题在**密度与主次**：Ribbon/Inspector/插件列表里 16–20px 单色图标等权重密集排列，无主次降级（见 §3-10） |
| 动效 | 材质/弹层进入应有轻缩放+淡入，克制的弹性缓动；尊重 `prefers-reduced-motion` | 截图无法验证动效，但 `dialog.tsx` 已有 `data-open:zoom-in-95 fade-in-0` 基础动效，`index.css` 已处理 `prefers-reduced-motion`（降为 1ms）；**未处理 `prefers-reduced-transparency`**（见 §5） |
| 密度 | 舒适默认，但控件尺寸/圆角应有呼吸感，不因信息密集而牺牲触达舒适度 | 04 §2.13 密度 token 设计合理（舒适/紧凑两档），但 playground 截图全部是舒适档下呈现的效果依然拥挤（尤其 Ribbon 60px 高塞 6 组），说明问题不在密度参数，而在分组视觉语言本身 |

---

## 2. 逐屏审计表

严重度基于"与 iOS Liquid Glass 目标的观感落差 × 该屏的使用频率/首因效应"综合判定。

| 路由 | 截图（亮/暗） | 亮色下最刺眼的问题（2–4 条，具体到组件与位置） | 严重度 | 暗色新增/加剧的问题 |
|---|---|---|---|---|
| `/`（Hub） | hub-light / hub-dark | 1) 15 张卡片全部挂实心 `primary` 徽标"已完成"，违反 09 §0 S-06 的"≤3 处实心 primary"红线，整屏是一面靛蓝色点阵；2) 卡片零阴影仅 `ring-1 ring-foreground/10`，在浅灰 `bg-canvas` 上几乎不分层；3) `rounded-xl`(11.2px) 圆角相对 240px 卡宽比例很小，视觉接近直角 | 中 | 卡片背景(`#1C2233`)与画布背景(`#0B0F19`)亮度差极小且无阴影，卡片边界几乎只靠一圈几不可见的 `ring` 辨认，暗色下"融进"背景 |
| `/styleguide` | styleguide-light / styleguide-dark | 1) 同屏可见至少 3 种 Tab 视觉（方形描边演示、Ribbon 会用的下划线、Inspector 会用的 2px 底边），组件库内部就不统一；2) Command 搜索框直接嵌在页面流里，与真正浮层态的命令面板观感不同，易被当成普通搜索框；3) Avatar 演示为纯灰平面圆，未展示 presence 彩色环的典型状态 | 中 | 无新增问题，色值置换正确，但同一堆卡片分区容器的"零阴影只靠描边"问题在暗色下更难辨认分区边界 |
| `/documents` | documents-light / documents-dark | 1) 文档卡片缩略图用灰色骨架条（`Skeleton` 样式）充当"空文档预览"，与真正的加载态骨架屏视觉完全相同，用户无法区分"占位内容"还是"正在加载"（§3-6）；2) 卡片 `rounded-xl` + 零阴影 + 密集排列，观感接近资源管理器缩略图视图而非现代文档网格；3) 顶部产品级工具簇的视图/主题切换图标按钮无可见容器，与旁边高对比的搜索框、"新建"实心按钮反差大 | 高 | 缩略图灰色骨架条与卡片背景在暗色下亮度更接近，占位符观感进一步弱化，几乎"消失"在卡片里 |
| `/import` | import-light / import-dark | 1) 底部进度条贴底通高、零侧边距、4px 极细，配合下方纯文字状态行，组合成"浏览器下载条+终端日志"而非应用内反馈（§3-8）；2) 主画布"加载中"占位是大灰色矩形，与 `bg-canvas` 几乎同色，只能靠边缘一点明暗差辨认，容易被误读为"空白/出错"；3) 顶部"取消"是纯文字链接，无按钮边界，可发现性低 | 高 | 进度条 track（`bg-muted` #0F1420）在暗色下几乎不可见，只剩一条悬浮的靛蓝细线，缺少可辨识的"轨道"参照 |
| `/editor` | editor-light / editor-dark | 1) Ribbon 用竖直 `border-r` 分组 + 组下 11px 灰标签，六组塞进 60px 高一行，图标 16–20px 单色密集（`Ribbon.tsx`/`ribbon/primitives.tsx`），是最直接的"Office 2013 Ribbon"复刻；2) 三栏布局靠 `EditorShell.tsx` 的 `border-r`/`border-l` 硬分割，三块背景色几乎相同，零阴影/零材质表达"独立面板"；3) 检查器 Tab 用 `border-b-2` + 明确 `data-active:shadow-none`（`Inspector.tsx`），是四套并存 Tab 视觉里最"经典网页化"的一种；4) 选中框控制点是 6×6px 直角小白块，无圆角无材质，与 Figma/Keynote 的现代手柄差距明显 | 高 | 三栏分割线对比度更低（`#232A3B` on `#151A26`），面板边界更难辨认；缩略图 3 的"降级内容"斜纹底纹在暗色下线条更清晰刺眼，视觉噪音反而增加 |
| `/editor/masters` | editor-masters-light / editor-masters-dark | 1) "改动将影响 4 个使用此版式的页面"在 09 §3 T-02 明定应为 `Alert`(info) 组件，实现里只是纯文字，无底色/图标，是规范与实现不一致的直接证据；2) 版式画布上的母版占位符没有虚线框/背景提示"这是可编辑占位符"，与普通静态文字无区别；3) 右侧属性面板空态只有一个纤细描边圆圈感叹号图标 + 一行说明文字，未使用 09 §2 已定义的 `Empty` 组件完整插图版式，观感单薄 | 高 | 母版树选中态背景块 + 2px 左边条在暗色下对比更弱，二级版式的缩进引导线缺失，层级关系比亮色更难读 |
| `/editor/layouts` | editor-layouts-light / editor-layouts-dark | 1) 弹层背后确认 `backdrop-blur-xs`(4px) 生效但 `bg-black/10` 太浅，背景内容基本仍清晰可读，没有起到"聚焦对话框"的作用——这是全稿**唯一的玻璃材质线索**，强度不足以构成语言；2) 同一对话框里两张卡片同时打勾（"与当前页相同·默认"与"标题和内容"），当前默认与已选中未做区分，是语义级问题；3) 版式缩略图内部用灰色骨架条表示"文本占位"，是骨架灰条模式第 3 次重复出现 | 中 | 卡片网格描边在暗色下更难与背景区分，选中态蓝色描边成为唯一可靠的视觉锚点 |
| `/editor/design` | editor-design-light / editor-design-dark | 1) 主题/变体色板用 56×52px、24px 方形色块，圆角近似 `rounded-md`、无阴影，密集排列像取色器网格而非精品主题预览卡；2) 右侧"颜色/字体"两态切换已经是本稿少数真正的胶囊控件，可作为向其它 Tab 推广的种子（见 §4-F3）；3) 主题色板本身内容合理，问题主要是容器缺材质 | 中 | "背景浅1/2""文字深1/2"色板 icon 在暗色下呈现空心/未填充方块，与亮色下的实心色块观感不一致，疑似暗色专属的对比度/填充丢失，需工程复核是否为 bug |
| `/editor/insert` | editor-insert-light / editor-insert-dark | 1) 右侧检查器未选中对象时是一段贴顶左对齐的纯灰说明文字，面板其余 ~90% 高度纯色空白，观感像"没做完"而非"有意留白"；2) 插入对象演示（矩形/图片占位/表格/图表/文本框）的选中框、占位框样式各不相同（虚线/实线/纯色填充混用），组合在一屏时秩序感弱 | 中 | 无显著新增问题，图片占位块在暗色下为中灰矩形，对比尚可 |
| `/editor/text` | editor-text-light / editor-text-dark | 1) 迷你浮动工具条是全稿唯一的"浮动上下文控件"雏形，但只是白底细描边 + 轻 `shadow-md` 矩形条，图标间距极窄、`rounded-md` 小圆角，与 iOS 选中文字弹出的胶囊工具条差距明显；2) 右侧检查器只显示"字体/字号"两行，面板大片留白无内容 | 中 | 无显著新增问题 |
| `/editor/comments` | editor-comments-light / editor-comments-dark | 1) 评论线程纯靠间距分组、无卡片包裹，长列表时容易糊在一起；2) "回复.../标记已解决"是纯文字链接而非按钮，图形上不像可点击操作，而"已解决/原对象已删除"状态徽标反而很显眼——常用操作与状态展示的视觉权重是反的；3) 输入框"发送"按钮空输入时呈浅灰近乎不可见的禁用态 | 中 | 评论内容与背景对比正常，未见新增问题 |
| `/editor/history` | editor-history-light / editor-history-dark | 1) 时间轴列表没有竖向连接线（无 timeline rail），每条记录是独立一行 dot+时间，"历史时间轴"的叙事感被削弱成日志列表；2) 右侧预览卡片用了完整卡片描边+留白，与缩略图栏的 `rounded-md` 极简缩略图是两套不同的"小卡片"视觉，未统一 | 低 | 无新增问题 |
| `/editor/share` | editor-share-light / editor-share-dark | 1) 邀请行（邮箱输入 + 角色下拉 + "邀请"按钮）三个独立控件并排但未做视觉分组（未用 `InputGroup`/`ButtonGroup` 统一），像偶然排在一起的表单元素；2) 权限列表里"所有者"用纯文字，其余行用可交互 `Select` 下拉，同一列表两种视觉权重不一致；3) 对话框标题用直角引号包裹文件名，排印细节生硬 | 中 | 背景模糊/scrim 同 `Dialog` 一致的问题（强度不足），无新增 |
| `/editor/plugins` | editor-plugins-light / editor-plugins-dark | 1) 全部插件用同一个占位图标（齿轮/拼图方块底），6 个插件无法靠图标区分身份，可扫读性差；2) 错误态操作"重试 查看详情 禁用"三个纯文字链接挤在一起、同色同权重，易误触；3) 分组标题的计数徽标视觉不统一（"启动失败2"用红色 outline 强调，其余分组计数无强调），强调规则不明确 | 中 | 无显著新增问题 |
| `/export` | export-light / export-dark | 1) 格式/范围用纯 `RadioGroup` 文本列表，未对选中项做卡片高亮，与 `editor/layouts` 的"卡片+勾选角标"选择模式是同一产品里两套并存的"单选"视觉方案；2) 对话框同样只有 `ring-1` 无阴影，浮空感弱 | 中 | 背景模糊/scrim 同上，无新增 |
| `/present` | present-light / present-dark | 全稿视觉最佳的一屏：真黑舞台、留白充分、标题/副标题字号对比清晰。底部控制条已是 `rounded-full` 胶囊 + 半透明深色（`stage-chrome rgba(22,22,22,.85)`），是最接近 Liquid Glass 的现有实现，**但未加 `backdrop-blur`**，胶囊内按钮之间无分组/无强调、完全等距 | 低（保留优点，作为推广种子而非整改对象） | 与亮色渲染结果相同——`stage-*` token 不随主题切换，属预期行为（04 §2.2a），非缺陷 |
| `/viewer` | viewer-light / viewer-dark | 1) 工具条居左单行排列，翻页/缩放/搜索/信息四类操作无分组（无 `Separator` 或视觉分区），挤在一条线上；2) 页码输入框是唯一强边框控件，与旁边纯 `ghost` 图标按钮反差较大；3) 整体是第二好的一屏（居中卡片+轻阴影），适合作为"floating toolbar"试点 | 低 | 无显著新增问题 |
| `/settings` | settings-light / settings-dark | 1) `Sheet` 抽屉贴齐视口右边缘、直角零边距，与"floating card"目标差距全稿最大之一；2) 分区之间纯靠 `border-t` 细线分隔，无区块卡片化；3) 密度切换用两个并排 `RadioGroup`+`Label`，而非 09 §2 组件映射表自己推荐的 `ToggleGroup` 分段控件——是规范与实现不一致的又一证据 | 高（使用频率低，但改造成本最低、独立浮层不涉及三栏布局，示范效应大） | 面板与背景对比更弱（`#151A26` 面板 vs 更深背景），右边缘分界只依赖一条 `border-l` |
| `/offline` | offline-light / offline-dark | 1) 离线横幅是手写的 `border-b px-4 py-2` 平铺 `div`（`Offline.tsx` `BannerContent`），**未复用已有的 `Alert` 组件**（`alert.tsx` 本身就有 `rounded-lg border`），贴边直角，是全稿"该用组件但没用组件"的最直接证据；2) 其余同 `/editor` 的通病（Ribbon/三栏分割线/状态栏终端化）原样出现 | 高（强打断场景，横幅是第一眼看到的东西，此刻的廉价感被放大） | `warning-muted` 在暗色下（`rgba(226,163,61,.16)`）更低调，横幅存在感被进一步削弱，恰恰在最需要引起注意的时刻最不显眼 |

---

## 3. 跨屏共性问题（按影响面排序）

路由计数以 19 条路由（18 登记路由 + Hub）为分母，基于逐屏审计的实际截图判读与源码 `grep` 交叉核对（关键计数已用 `grep -l` 核实使用了 `EditorShell`/Ribbon/`StatusBar`/`ThumbnailRail` 的路由源文件）。

| # | 问题 | 出现路由数（约） | iOS 风格下应变成什么 |
|---|---|---|---|
| 1 | **三栏/多区布局靠 `border-r`/`border-l`/`border-t` 硬线分区，而非留白+材质** —— `EditorShell.tsx` 的 `ResizablePanel` 直接贴边加边框；状态栏/离线横幅同理 | 10/19（Main/Masters/Design/Insert/TextEditing/Comments/History/Share/Layouts + Offline 复用同一壳） | 面板之间靠 8–16px 间隙 + 各自的材质背景/阴影分层，边框只在极少数需要精确对齐时才用，且用极浅色（`border-black/5`）而非当前的 `--border` 实色 |
| 2 | **Ribbon 是"Office 2013"式：竖线分组 + 11px 灰标签 + 密集单色小图标**（`Ribbon.tsx` + `ribbon/primitives.tsx` 的 `RibbonGroup`） | 10/19（同上，含 Layouts 背景可见部分） | 分组靠间距而非竖线；组标签默认隐藏或移入 tooltip；整条 Ribbon 做成悬浮材质条，离画布边缘留出可见的 `bg-canvas` 缝隙 |
| 3 | **状态栏/进度条"终端化"** —— 28px 纯文字状态栏（点+文字）+ Import 贴底 4px 通宽进度条 | 13/19（12 条用 `StatusBar` 的编辑器相关路由 + Import） | 状态信息收进语义色 `subtle` 底的胶囊徽标（`Badge` 已具备 `rounded-4xl`，只是很多地方没用上）；进度条离屏幕边缘留白，或改用更粗的轨道+可辨识圆角 |
| 4 | **骨架灰条身兼二职：同一视觉（`Skeleton` 灰条/灰块）既表示"加载中"又表示"空文档/空文本内容占位"** | ≥12/19（10 条编辑器缩略图栏 + Documents 卡片缩略图 + Import 加载态） | 区分"真正 loading"（shimmer 动画+固定灰度）与"内容占位/空态"（换成更有信息量的极简线框示意图，而非灰条） |
| 5 | **卡片/对话框/面板零阴影，仅 `ring-1 ring-foreground/10` 发丝描边** —— `card.tsx`、`dialog.tsx`、`sheet.tsx` 均无 `shadow-*` | 约 10/19（Hub、Documents、Styleguide 分区卡、Layouts/Share/Export 对话框、Settings 面板） | 悬浮容器一律加大半径低不透明度阴影（如 `shadow-[0_20px_50px_-12px_rgba(0,0,0,.18)]`），描边降级为可选的"内高光"而非主要分层手段 |
| 6 | **Tab 视觉至少 3–4 套并存**：Ribbon 顶部下划线（`TabsList variant="line"`）、Inspector 的 `border-b-2` 底边、Styleguide 演示的方形描边默认态、Design 页的两态胶囊切换 | 约 11/19（9 条同屏可见 Ribbon+Inspector 两套 + Styleguide + Design） | 收敛为一套"分段胶囊"视觉：容器弱材质背景，选中态用浮起的浅色/白色胶囊块+轻阴影，而非描边或下划线 |
| 7 | **图标按钮缺乏可见容器，命中区不可预期** —— Documents/Import/Viewer 等路由产品级头部的视图/主题切换图标按钮无背景、无 hover 态提示（注：`AppBar.tsx` 自身的返回/撤销/重做已用 `ghost`+`Tooltip`+`ButtonGroup`，相对达标，问题集中在非编辑器路由的头部工具簇） | 约 7/19（Documents/Import/Viewer/Settings/Offline 等路由的产品级头部） | 图标按钮默认给一圈极浅的圆形底（`rounded-full hover:bg-foreground/5`），静止态也有可辨识的可点击暗示，而不是完全依赖 hover 才现形 |
| 8 | **圆角整体偏小且分层不明显**：按钮/输入/卡片/对话框全部挤在 6.4–11.2px 区间，只有 `Badge` 和舞台控制条是真胶囊 | 19/19（token 级，覆盖全部） | 按刻度拉开：按钮/输入 10–14px，卡片 16–20px，对话框/抽屉 20–28px，工具条/分段控件/徽标用 `9999px` 全胶囊——"越浮越圆"作为硬规则 |
| 9 | **全稿唯一的材质/模糊线索强度不足**：`Dialog`/`Sheet` 的 `backdrop-blur-xs`(4px) + `bg-black/10` 在截图里几乎不可感知 | 4/19（Layouts/Share/Export/Settings 等弹层路由），但因为是"唯一线索"，价值在于改起来成本最低、示范效应最大 | scrim 提到 `black/25–35%`（暗色 `black/45–55%`），blur 提到 12–20px；不只弹层，悬浮工具条/侧栏也要用同一套材质语言，而不是只在最外层模态出现一次 |
| 10 | **密集单色小图标缺主次节奏**：Ribbon/Inspector/插件列表里 16–20px 图标等权重平铺 | 约 13/19（编辑器相关路由 + Plugins） | 主操作图标稍大+配文字，次操作降级为纯图标+tooltip，制造视觉呼吸感而非一整排等权重色块 |

---

## 4. 按组件族的改造方向

标注：**[token]** 只需改 `index.css` 变量或 Tailwind 工具类组合；**[组件类]** 需改 `src/components/ui/*` 共享源码（改一处、全局生效，符合 09 §5 的 shadcn 复制模式）；**[布局]** 需改 `src/components/editor/*` 组合层的结构/尺寸计算，成本更高。

### A. 应用壳（AppBar / 顶部工具簇）
1. **[组件类]** 图标按钮统一加 `rounded-full hover:bg-foreground/5 dark:hover:bg-foreground/10` 静止态弱提示，替换当前完全依赖 hover 才现形的裸图标（`button.tsx` ghost 变体默认态）。
2. **[token]** "已同步"等状态从纯文字/outline 方框改为语义色 `subtle` 底的胶囊徽标——`Badge` 已有 `rounded-4xl` 基础，只需在 `status.tsx`/`StatusText` 里应用 `bg-success-muted text-success-foreground`。
3. **[布局]** AppBar 加 `backdrop-blur-xl bg-background/70`，使其在画布内容之上呈现漂浮属性；需确认画布是否会滚到 AppBar 下方（当前多为静态布局，先从材质做起，收益立即可见）。
4. **[组件类]** `ButtonGroup`（撤销/重做）圆角与间距可直接受益于 B 族的分段胶囊统一方案，无需额外改动。

### B. 工具条（Ribbon）
1. **[布局]** 组间竖线 `border-r`（`ribbon/primitives.tsx` `RibbonGroup`）换成纯间距 `gap-4`/`gap-6`；如需轻分隔，用 `bg-foreground/[0.04]` 的圆角分组容器代替竖线。
2. **[组件类]** 组标签（11px）默认隐藏，仅密度设为"舒适+显示标签"时出现，减少视觉噪音。
3. **[布局]** 整条 Ribbon 容器加 `mx-3 mt-2 rounded-2xl bg-background/80 backdrop-blur-lg shadow-[0_8px_24px_rgba(0,0,0,.08)]`，从"贴顶通栏"变成"悬浮条"，四周露出 `bg-canvas`；此项影响整体高度计算，需要 `EditorShell` 联动调整。
4. **[组件类]** `RibbonBigButton` 从直角 ghost hover 改为选中态用浅色胶囊底 `rounded-xl bg-accent/60`。
5. **[组件类]** 插件页签强调色文字保留，但整条 Tabs 视觉并入 F-3 的分段胶囊统一方案。

### C. 侧栏与检查器（缩略图栏 / 母版树 / Inspector）
1. **[布局]** 两侧栏从"贴边 + `border-r`/`border-l`"改为距窗口/画布边缘 8–12px 的悬浮玻璃卡：`rounded-2xl bg-white/70 dark:bg-white/[.06] backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10` + 外阴影；`ResizablePanelGroup` 的分隔手柄样式需要同步调整。
2. **[组件类]** Inspector Tab 从 `border-b-2` 改为面板内嵌的分段胶囊（同 F-3）。
3. **[token]** 缩略图当前页指示保留 `ring-2 ring-primary`，缩略图卡片本身加大圆角 + 轻阴影，替代当前几乎无阴影的平贴感。
4. **[组件类]** 母版树选中行的"左侧 2px 条"改为整行浅色胶囊背景（`rounded-lg mx-1`）+ 更明显字重差异，不再主要依赖 2px 条。
5. **[组件类]** Accordion 分区（位置与大小/填充/边框…）之间用留白替代隐式边框，展开内容区给一个极浅底色区块。

### D. 画布背景
1. **[token]** `bg-canvas` 叠加极低对比度的 radial-gradient，避免大面积纯色平板感（需验证不影响内容对比度）。
2. **[布局]** 选中框控制点从 6×6px 直角小白块改为 10–12px 圆形手柄（白底 + 主色描边 + 轻阴影），贴近 Figma/Keynote 现代手柄——改 `SlideCanvas.tsx`。
3. **[token]** 远端协作者选区/光标标签已有胶囊雏形，统一加 `shadow-sm` + 稍大内边距，与迷你工具条共用同一套"浮动标签"语言。
4. **[token]** 评论钉加白色描边 + 阴影，使其在任意页面底色上都能"浮出"。

### E. 对话框与弹层
1. **[组件类]** Overlay scrim 从 `bg-black/10 backdrop-blur-xs` 提到约 `bg-black/30 dark:bg-black/50 backdrop-blur-md`(12–16px)——改 `dialog.tsx`/`sheet.tsx`/`drawer.tsx` 共享的 Overlay 类，一处改动全局生效。
2. **[组件类]** 对话框内容 `ring-1` 之外加大半径阴影（`shadow-2xl`），`rounded-xl` 提到 `rounded-2xl`/`rounded-3xl`。
3. **[组件类]** `Sheet`（Settings 抽屉）即使贴边也保留朝内一侧的圆角（`rounded-l-2xl`），并与顶/底各留 8–12px，弱化"整块嵌入屏幕"的生硬感。
4. **[组件类]** 统一"从多选项中选一个"的视觉方案：`Export` 的 `RadioGroup` 列表建议也换成 `Layouts` 式的卡片+勾选角标（或至少给选中行加 `bg-accent/40 rounded-lg`），消除两套选择范式并存。
5. **[token]** `Popover`/`DropdownMenu` 已有 `shadow-md`/`shadow-lg` + `ring-1`，直接加大圆角到 `rounded-2xl` 即可，成本最低。

### F. 菜单与命令面板
1. **[组件类]** `Command`/`CommandDialog`（⌘⇧P）需确认统一套用 E-1 的新 Overlay 规则，突出"命令面板悬浮于一切之上"的语义。
2. **[token]** 右键菜单/下拉菜单圆角提升到 `rounded-2xl`，选中/hover 态沿用现有 `bg-accent/60` 过渡即可。
3. **[组件类]** Tabs 统一方案落地：Ribbon 顶部 Tab、Inspector Tab、Design 页颜色/字体切换、Styleguide 演示收敛为同一套"胶囊分段控件"——在 `tabs.tsx` 新增/整理 variant，而不是让各消费方各自定制。

### G. 表单控件
1. **[token]** `Input`/`Select` 默认 `rounded-lg`(8px) 提到 `rounded-xl`(约12px)，focus 态的 `ring-3 ring-ring/50` 可加大模糊/提高不透明度模拟"发光"。
2. **[组件类]** `Share` 对话框里 email 输入 + 角色 `Select` + "邀请"按钮的三件套用 `InputGroup` 封装为一个圆角胶囊容器，内部细分隔线分区（09 §2 已定义 `InputGroup`，属于"该用没用"）。
3. **[组件类]** Settings 的密度切换改用 `ToggleGroup` 胶囊，而非当前两个并排 `RadioGroup`+`Label`——这同时修正了 09 §2 组件映射表与实现的偏差。
4. **[token]** 滑块（透明度/缩放）轨道加高并圆角化，滑块把手加轻阴影提升可抓取感。

### H. 徽标与状态
1. **[组件类]** `StatusBar.tsx` 右侧的"已同步/离线/N 人在线"从纯文字改为 `Badge`（`rounded-4xl` 已具备胶囊基础，只是没被用在这里）。
2. **[组件类]** 离线横幅改用 `Alert` 组件（已有 `rounded-lg border`）替换 `Offline.tsx` 里绕开它的自定义 `border-b` 平铺 `div`；材质上可进一步做成 `bg-warning-muted/90 backdrop-blur-sm` 的轻量通知条。
3. **[组件类+内容]** 插件图标从统一占位符改为按类别区分的彩色图标底，需要产品侧补充插件图标资产，非纯设计系统改动。

### I. 放映舞台
1. **[token]** 现有 `stage-chrome rounded-full` 胶囊控制条基础良好，加 `backdrop-blur-lg` 即可——舞台内容是真实幻灯片，背景有足够细节支撑模糊效果，是全稿**性价比最高的一处改动**（一行 CSS）。
2. **[组件类]** 控制条内部按钮按功能分组（翻页 / 视图 / 关闭），组间用 `bg-white/10` 极细竖分隔或加大间距，而非当前等距散列。
3. **[组件类]** 顶部退出/设置条也做成同款缩小版悬浮胶囊，目前是一条普通 flex 行，与底部胶囊风格不统一。

---

## 5. 风险与约束

- **`backdrop-filter` 性能**：悬浮工具条+侧栏+检查器+弹层同屏时最多可能 4–5 层同时应用 `blur`，在低端 GPU、大画布缩放/拖拽动画期间可能引发合成开销上升、掉帧。建议：仅静止面板启用 `backdrop-blur`；`ResizablePanel` 拖拽调整宽度期间可临时切换为不透明背景，拖拽结束后再恢复材质；画布本身的缩放/平移不应触发任何面板重新合成模糊层。
- **玻璃上的文字对比度**：半透明底 + `backdrop-blur` 下，文字对比度会随背后内容波动，无法稳定保证 WCAG 4.5:1。对策：材质容器内衬一层不透明或高不透明度（≥80%）的中性色再放文字，文字颜色仍固定引用 `--foreground`/`--muted-foreground` 语义 token；玻璃感只作用于容器背景，不直接把强透明层铺在文字后面。关键数值区域（属性面板输入值、Ribbon 标签）建议保持接近不透明的底衬。
- **暗色玻璃发灰**：暗色下如果直接套用"白色半透明 + blur"，平均亮度会被提高，material 会显得"雾蒙蒙的灰"而非深邃通透。对策：暗色玻璃改用极低不透明度的白（`bg-white/[.06]`~`bg-white/[.10]`），靠提亮 `ring`/内描边模拟高光，而不是整体调高背景不透明度。
- **Windows / 低端机降级**：`backdrop-filter` 在部分集成显卡、旧版浏览器或强制颜色模式下可能不生效或被关闭合成加速。现状 `dialog.tsx` 已示范 `supports-backdrop-filter:` 前缀写法，需要把这个降级策略推广到所有新增材质类；不支持时必须回退到不透明的 `--card`/`--popover` 纯色背景，不能变成"看穿却不模糊"的半透明糊状。
- **`prefers-reduced-transparency`**：`index.css` 当前只处理了 `prefers-reduced-motion`（统一把动效时长压到 1ms），**未处理减少透明度偏好**。建议新增对应媒体查询块，命中时把所有 `backdrop-blur-*` 与半透明背景替换为对应的不透明 `--card`/`--popover` 纯色，逻辑与现有 `prefers-reduced-motion` 全局降级模式一致，写在同一处 `@layer base` 里。
- **与 shadcn 复制模式的兼容**：改动应优先集中在少数共享文件，一处改、全局生效——`button.tsx`（圆角/图标态）、`card.tsx`、`dialog.tsx`/`sheet.tsx`/`drawer.tsx`（Overlay 与 Content）、`tabs.tsx`（新增 pill variant）、`badge.tsx`（已是胶囊，只需推广使用场景）、`popover.tsx`/`dropdown-menu.tsx`/`context-menu.tsx`（圆角提升）、`input.tsx`/`select.tsx`（圆角+focus 光晕）。这些都是"复制进仓库的源码"，符合 09 §5 的实现规则，不违反 S-01 复用优先原则。相对地，`EditorShell.tsx`/`Ribbon.tsx`/`Inspector.tsx`/`ThumbnailRail.tsx`/`SlideCanvas.tsx` 属于 `components/editor/*` 组合层，改动涉及尺寸重算（悬浮留白后可用宽度变化、Ribbon 加外边距后高度联动），成本明显更高，建议单独排期，不与 token/组件类改动混在一个批次。

---

## 6. skill 留痕

以下为本轮实际运行的 `ui-ux-pro-max` 检索，命令、命中数与采纳结论如实记录；0 命中的一条已按协议改写关键词重试一次。

| # | 命令 | 命中 | 采纳结论 |
|---|---|---|---|
| 1 | `search.py "glassmorphism translucent blur" --domain style -n 5` | 1（`glassmorphism` style card） | **采纳**：其 `backdrop-filter: blur(10-20px)`、`translucent white rgba(255,255,255,0.1-0.3)`、`subtle border 1px rgba white 0.2` 的实现参数被用作 §4/§5 材质强度建议（E-1、I-1）的数值依据 |
| 2 | `search.py "ios apple modern minimal" --domain style -n 5` | 1（`minimalism-and-swiss-style`，数据库内未收录名为"Liquid Glass"的独立风格条目） | **部分采纳**：其"grid-based/high-contrast/克制阴影"与现状的 flat/单色倾向本就部分吻合，说明现状问题不是"极简不够"，而是"极简"与"玻璃材质分层"两种取向被无意混同——两者应叠加而非二选一，报告据此在 §1 把"色彩饱和"与"材质层次"拆成独立维度，不互相替代 |
| 3 | `search.py "frosted glass dark mode contrast" --domain ux -n 5` | 3（Contrast Readability / Color Contrast / Focus Appearance） | **采纳**：4.5:1 正文对比度底线、`outline 2px + 3:1` 焦点态规则，直接写入 §5"玻璃上的文字对比度"约束 |
| 4 | `search.py "apple system font pairing" --domain typography -n 5` | 5（均为第三方字体配对：Plus Jakarta Sans / Inter / Roboto / Calistoga 组合，未命中针对 SF Pro / 系统字体栈本身的条目） | **不采纳**：04-design-system.md §2.8 已锁定系统字体栈 + Geist Variable 的零依赖策略（SDK 嵌入场景的架构约束，非纯审美选择），本轮不动字体；如实记录"数据库对苹果系统字体栈本身无专门条目，只有第三方配对建议"这一检索事实 |
| 5 | `search.py "productivity tool professional muted" --domain color -n 5` | 5（Teal/Navy/B2B Navy/Dev Dark/Purple 五套配色方案） | **不采纳具体色值**：04-design-system.md §7 已记录靛蓝强调色与语义色/协作者色"色相分离"的架构级裁决，本轮不重新核算；**采纳其"muted/professional"气质作为背景验证**——现状配色方向本身无需推翻，本次审计发现的问题集中在材质/圆角/分层，不在色相选择 |
| 6 | `search.py "glass card backdrop blur" --stack shadcn -n 5` → 0 命中，按协议重试 → `search.py "card elevation dialog overlay" --stack shadcn -n 5` | 0 → 5（Dialog 应用于模态而非 Alert 仿造 / Card 用 CardHeader+CardContent 组合 / 按需 import / Dialog 受控 open 状态 / Skeleton 专用于 loading 而非 Spinner） | **采纳**：与 §2/§3 独立发现的两条证据直接互相印证——"Offline 横幅绕开 Alert 组件手写 div"、"骨架灰条被挪用为空态占位而非纯 loading"——是本次审计里"设计判读"与"skill 库通用准则"吻合度最高的一条，强化了 §4-H2 的整改优先级 |
| 7 | `search.py "icon weight consistency line style" --domain icons -n 5` | 5（多条特定视觉系统的 Phosphor 图标配置，如 cyberpunk/academia/bold-typography 等，附一条通用准则 `icon-context-accessibility`） | **部分采纳**：具体风格化图标系统不适用（playground 用 Lucide 非 Phosphor，替换图标库不在本轮范围）；`icon-context-accessibility` 条目的"装饰性图标 `aria-hidden`／有意义图标需文本替代／仅图标控件需 `aria-label`"规则与 04-design-system.md §2.14 已有规则一致，视为交叉验证 |
| 8 | `search.py "reduced motion accessibility performance blur" --domain ux -n 5` | 5（Reduced Motion / Motion Sensitivity / Excessive Motion 三条相关，另 2 条 Forms/Performance 不相关） | **采纳前三条**：写入 §5"`prefers-reduced-transparency`"建议时同步确认——现有 `prefers-reduced-motion` 已处理，新增的玻璃材质进入/退出过渡动效同样需要尊重该偏好，不能引入不受控的新动画 |

---

## 7. 附录：38 张截图清单

截图目录（不进仓库）：`<会话临时目录>/scratchpad/audit-shots/`，另附 `index.json` 索引。

| 路由 | 标题 | 亮色截图 | 暗色截图 |
|---|---|---|---|
| `/` | Hub（设计 playground 首页） | hub-light.png | hub-dark.png |
| `/styleguide` | 样式指南 | styleguide-light.png | styleguide-dark.png |
| `/documents` | 文档列表 | documents-light.png | documents-dark.png |
| `/import` | 打开与导入 | import-light.png | import-dark.png |
| `/editor` | 编辑器主界面 | editor-light.png | editor-dark.png |
| `/editor/masters` | 母版视图 | editor-masters-light.png | editor-masters-dark.png |
| `/editor/layouts` | 版式选择与重置 | editor-layouts-light.png | editor-layouts-dark.png |
| `/editor/design` | 设计页签与主题 | editor-design-light.png | editor-design-dark.png |
| `/editor/insert` | 插入 | editor-insert-light.png | editor-insert-dark.png |
| `/editor/text` | 文本编辑与格式化 | editor-text-light.png | editor-text-dark.png |
| `/editor/comments` | 评论 | editor-comments-light.png | editor-comments-dark.png |
| `/editor/history` | 版本历史 | editor-history-light.png | editor-history-dark.png |
| `/editor/share` | 分享与权限 | editor-share-light.png | editor-share-dark.png |
| `/editor/plugins` | 插件管理器 | editor-plugins-light.png | editor-plugins-dark.png |
| `/export` | 导出 | export-light.png | export-dark.png |
| `/present` | 放映 | present-light.png | present-dark.png |
| `/viewer` | 只读查看器 | viewer-light.png | viewer-dark.png |
| `/settings` | 设置与快捷键 | settings-light.png | settings-dark.png |
| `/offline` | 离线与降级 | offline-light.png | offline-dark.png |

共 19 条路由 × 2 主题 = 38 张截图，全部通过 `playwright screenshot --channel=chrome --viewport-size=1440,900 --wait-for-timeout=1200`（暗色加 `--color-scheme=dark`）针对 `dist` 静态服务器（`python3 -m http.server 8765`）采集，一次性全部成功（`ok=38 fail=0`），逐张用 Read 工具人工查看确认。
