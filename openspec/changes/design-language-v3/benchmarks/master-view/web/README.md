# 母版视图标杆 · 网页产品（A 组）

> 2026-10-28 · 变更 `design-language-v3`（L2）· 母版视图改版的摸底，只收集资料，没有改动样张与文档。
> 范围：Google Slides 主题生成器（Theme builder / Edit theme）、Figma Slides 模板样式，并确认 Pitch、Canva 有没有版式编辑。PowerPoint 幻灯片母版、Keynote「编辑幻灯片版式」由 B 组另收。
> 同目录 `sources.json` 收了 35 张图，逐张写了 observed（画面内容、栏宽、原文文案、进入与退出、继承与影响范围、选中态与强调色）。下文用文件名前缀引用，例如「gslides-03」。其中来自第三方教程站的 9 张（gslides-02、03、04、06、07、08、10、11、14）原图 2026-11-12 公开前已移除，`sources.json` 里这 9 条标 `removed`、出处与 observed 照旧，下文引用它们时只剩文字描述。

## 0. 结论先行

- 四个网页产品里，**只有 Google Slides 有真正的母版 / 版式编辑模式**，叫主题生成器（Theme builder，2021-05 由「Master」视图改名）。它是编辑器里的一种视图：左侧多出一栏深色主题窗格（THEME 一张大卡 + LAYOUTS 缩进列表），画布上方一条深色标题条「Editing: 〈主题〉 - 〈版式〉 (Used by N slides) [Rename] … ×」，点 × 退出。没有右侧属性栏，也没有大横幅。
- **Figma Slides、Pitch、Canva 都没有母版和版式编辑。** 三家的模板都是一份普通演示文稿的副本，发布或修改后只影响之后新建的文件，已有的页不会跟着变。它们统一外观靠「样式」：Figma 的 Template style、Pitch 的 Slide style（Style builder）、Canva 的 Styles 和 Color themes。统一页脚、页码靠组件、复制到每页或锁定。
- 对 v3 最有用的三点：Google 的「贴着画布的上下文条」和「(Used by N slides)」写法；Pitch 的「Used on 23 slides + Select」和颜色悬停列出用途；Figma 把模板样式放在检查器的无选中态、用浮层编辑的安静画法。详见 §6。
- 不宜照搬的：Google 的深色窗格和深色画布、生成器里保留页缩略栏、「Reapply to all」、模态改名；Figma、Pitch、Canva 的「复制式模板」模型；Figma 靠换强调色表示模式。原因见 §7。

## 1. 收集方法与来源说明

- **来源优先级**：官方帮助中心与用户指南（support.google.com、help.figma.com、help.pitch.com、canva.com/help）→ 官方博客与开发者文档（workspaceupdates.googleblog.com、developers.google.com）→ 官方视频封面 → 第三方教程。官方没有对应画面时才用第三方，并在 `note` 里写明。
- **Google Slides 的官方图很少**：帮助 1705254 和 Learning Center 9282978 只有步骤文字和小图标；官方博文只有入口菜单（gslides-01）、生成器 Insert 菜单的局部（gslides-05）、主题颜色侧栏（gslides-09）和图片占位符（gslides-12）。生成器整屏、版式右键菜单、改名对话框、移动端用了第三方：BrightCarbon（2023 更新的录屏）、SlideModel（2024）、How-To Geek（2021）、Elgin Community College（约 2021）、TechRepublic（2021）。
- **GIF 取帧**：用 Playwright 调 Chrome 的 ImageDecoder 按帧号解码，存成原尺寸 PNG，不缩放也不改像素；帧号和时间写在 `note` 里。
- **Canva**：canva.com 的帮助页对脚本请求返回 403（Cloudflare 质询），用 Playwright 驱动本机 Chrome（有界面）打开后读取正文和图片地址；帮助文章大多只嵌 YouTube 视频，所以有两张用的是官方视频封面（canva-02、canva-04）。
- **Pitch**：配图是 Intercom 的签名链接（有效期到 2026-10-28 06:15 UTC），已在过期前下载，`imageUrl` 去掉了查询串。
- 所有网页检索于 2026-10-28。文中引号内的英文是界面或帮助原文。

## 2. Google Slides：主题生成器（Theme builder / Edit theme）

| 方面 | 看到的做法 | 图 / 出处 |
|---|---|---|
| 进入路径 | 两处入口：主菜单 **View › Theme builder**（和 Grid view 同组，无快捷键）；主菜单 **Slide › Edit theme**（和 Change theme 一组）。工具查找器（2023 起）在新建文件后会建议「Edit theme」。 | gslides-01（官方博文 2021-05-25）、gslides-02；帮助 1705254「Slide › Edit theme › Colors」；博文 2023-04《Enhancing tool discovery》 |
| 整屏结构 | 外壳（标题、菜单、工具条）不变，Slide 菜单置灰，工具条无选中时只剩 Background、Colors。主体从左到右：普通页缩略栏（约 10–13%）→ 深色主题窗格（约 16–19%）→ 画布（约 68–74%，深灰底）。画布上方一条深色标题条，高约 48px。**没有右侧属性栏，没有大横幅。** | gslides-03（1920×1080 整屏）、gslides-04、gslides-06 |
| 左栏 | 普通页缩略栏**仍然在**，缩略图随母版改动实时更新（gslides-03 里刚加的背景已出现在 6 页上）。主题窗格：顶部主题名（如「Simple Light」）+ 上下箭头（一份文稿可有多个主题，推测用于切换，没见到展开态）；小标题「THEME」下一张大缩略图；小标题「LAYOUTS」下是缩进的版式缩略图。两级只靠小标题和缩进区分，**没有连接线**。选中项是黄色粗框。 | gslides-03、gslides-04、gslides-06 |
| 画布 | 母版页显示提示文字「Click to edit theme title style」和 First…Ninth level 九级项目符号；「#」是页码占位；PPTX 导入后不支持的占位符就地写「Unsupported placeholder」。**画布上不区分「本版式定义」和「继承自母版」**，选中占位符就是普通的蓝框加 8 个手柄。继承关系只靠两样东西表达：标题条的「Used by N slides」，以及缩略图的实时变化。 | gslides-03、gslides-04；继承口径见开发者文档 gslides-13 |
| 右栏 | 没有常驻属性栏。点工具条「Colors」打开右侧「Theme colors」侧栏（可关闭，约 23% 宽）：当前主题名、「Choose a theme color」下拉列出 11 个色槽（Text and background 1–4、Accent 1–6、Link），选中后改色，即时作用全文。Learning Center 的步骤还提到在生成器里可以「on the right, select a theme」，也就是右侧的主题面板。 | gslides-09；support.google.com/a/users/answer/9282978 |
| 占位符 | 主菜单 **Insert › Placeholder ▸**：Title placeholder、Subtitle placeholder、Body text placeholder ┊ Image placeholder ▸（Rectangle / Rounded rectangle / Oval）。工具条文本框下拉里也有前三种。页码走 Insert › Slide numbers。普通页上的图片占位符是浅灰底加中央「图片」按钮，点开选来源（电脑、搜索、Drive、Photos、URL、相机）。 | gslides-05（官方）、gslides-06、gslides-12（官方） |
| 版式管理 | 新建：Insert › New layout（Ctrl+M），新版式默认叫「Custom Layout 1」。右键版式：Cut / Copy / Paste / Paste without formatting / Delete ┊ New layout / Duplicate layout / Rename layout ┊ Change background / Change theme ┊ Comment。改名：标题条「Rename」→ 模态对话框「Rename layout」（OK / Cancel）。版式在普通视图里通过右键或 Slide 菜单的「Apply layout ▸」画廊使用（按主题真实渲染、带名称）。没有找到拖动重排、删除被引用版式时如何处理的资料。 | gslides-05、gslides-06、gslides-07、gslides-08、gslides-11 |
| 主题 | 主题 = 颜色 + 字体 + 背景 + 版式（帮助原文「Theme: A preset group of colors, fonts, background, and layouts」）。颜色用 Colors 侧栏；字体、字号靠编辑母版上的文字样式（Learning Center：「Keep text size and color consistent」）；背景用 Background；可从其他演示文稿或 PPTX 导入主题。一份文稿可以同时有多个主题（Tim Jackson 2023 博文；iOS 主题面板的「In this presentation」页签）。 | gslides-09、gslides-14；帮助 1705254 |
| 影响范围 / 用量 | 标题条的对象名后跟灰字：选母版时是「(Used by all slides)」，选版式时是「(Used by 1 slide)」「(Used by 0 slides)」。没用到的版式照常显示，不隐藏也不用警示色。改了版式后条上会出现蓝色「Reapply to all」（官方没说明何时出现；TechRepublic 说加了图片或链接后要点它）。 | gslides-03、gslides-04、gslides-05、gslides-08 |
| 退出 | 标题条最右端的「×」；Learning Center 原文「When you're done, at the top of the slide, click Close」。点了直接回到普通视图，没有确认和提示。 | gslides-03 → gslides-10 |
| 窄屏 | 手机和平板 App **没有主题生成器**：帮助 1705254 的 iPhone & iPad 版、Android 版都只有 Change theme / Change layout / Change background 三节（iOS 换背景有「Apply to theme」，Android 版写「open your presentation on a computer」）。 | gslides-14（第三方）；帮助 1705254 移动端版本 |

## 3. Figma Slides：没有母版 / 版式模式

**怎么确认没有**（都是官方帮助，2026-10 更新的版本）：

- 《Explore Figma Slides》：编辑器只有两种模式，slides mode 和 design mode；右栏「If you don't have anything selected, you can access the styles available for templates used in your deck」。
- 《Find and use slide deck templates》：模板提供「curated colors, fonts, and slide layouts」，加进来后「replace the placeholder elements with your own content」，而且「you're not limited to one template per deck」。版式加进 deck 就是普通页，没有母版引用。
- 《Publish slide deck templates to a team or organization》：改模板就是打开原 deck 修改，然后「Click Publish changes on the banner at the top of the page」；「Published changes only apply to new slide decks that are made with the template」；「Published templates can only have one template style」。
- 《Publish slide deck templates to the Figma Community》：更新后「won't update any existing duplicates of the template」。
- 帮助中心搜索「master slide」没有母版相关文章（Zendesk 搜索接口，2026-10-28）。

**它最接近母版的东西**：模板样式（Template style）、设计模式、组件、页码对象、批量编辑。

| 方面 | 看到的做法 | 图 / 出处 |
|---|---|---|
| 进入路径 | 没有「进入母版」。模板样式在右栏无选中态的「Template style」节，点样式旁的滑杆图标进入「Edit template style」浮层。设计模式用工具条末端的开关或 Shift D。 | figma-01、figma-06、figma-07、figma-03 |
| 整屏结构 | 三栏都是浮在浅灰画布上的白色圆角卡片：左栏约 14%（页列表）、右栏约 18–19%（Design / Animate 两个页签）、底部居中浮动工具条。强调色在幻灯片模式是橙色，设计模式切成蓝色。侧栏可以收起成左上、右上两个胶囊。 | figma-01、figma-02、figma-03、figma-11 |
| 「换模式」的表达 | 设计模式只换三样：强调色（橙 → 蓝）、工具条的工具集、侧栏内容（左栏多出 Layers，右栏换成 Position / Layout / Fill 等完整属性）。没有横幅，也没有「关闭」按钮，进出是同一个开关。 | figma-02 → figma-03 |
| 左栏 | 普通的页列表（可分组、单页 / 网格切换、「New slide ▾」和「+」）。「New slide」打开模板选择器，点进某个模板后是该模板全部版式的两列网格（无名称），点一下插入一页。这是唯一接近「版式列表」的画面，但只能选，不能编辑。 | figma-04、figma-05 |
| 画布 | 就是普通页面。模板版式里的「placeholder elements」只是示例内容，没有占位符类型，也没有继承显示。 | figma-01、figma-02 |
| 右栏 | 无选中态：「Slide N」、Template style 下拉（三色条 + 样式名 + 字体名）、Background（纯色 / 渐变 / 图片）。选中对象后，模板颜色出现在 Fill 浮层顶部的「Template colors」，文字样式出现在 Text 下拉里（Title · 256、Header · 100…）。 | figma-01、figma-06、figma-08、figma-09 |
| 占位符的替代 | 页码是「Slide number」对象（Assets › Slide number），右栏有 Count / Include total / Format 和「Add to all slides」，把页码复制到每页同一位置，之后可逐页挪动。统一页脚用组件：主组件改了，所有实例跟着改（帮助举的例子正是「reusable footer」）。重复文字用「Multi-edit text」批量改。 | figma-10、figma-11；《Bulk edit layers in a slide deck》 |
| 版式管理 | 没有。只能在模板的源 deck 里像普通页一样增删改，再发布。 | 《Publish slide deck templates…》 |
| 主题 | 「Edit template style」浮层：Text styles（Title / Header / Subheader / Body / Caption，各带字体与字号，可 +）和 Colors（色块网格，可 +）；右上删除、关闭。改动即时作用到所有用该样式的对象；改名只影响本 deck；没有对象使用的样式刷新后自动移除。可以逐页切换 Template style，还有「Remix template colors」随机换配色。 | figma-06、figma-07；《Find and use slide deck templates》 |
| 影响范围 / 用量 | 没有任何「被多少页使用」的显示。 | — |
| 退出 | 浮层右上 ×；设计模式再点一次开关。 | figma-07、figma-03 |
| 窄屏 | 手机 App 只能查看、评论、演示；帮助原文「It's not possible to edit Figma Design files or Figma Slides decks using the mobile app」。 | figma-12 |

## 4. Pitch：没有版式编辑，有 Style builder

- **版式**：「Add slide › Layouts」是一个固定的插页库（Agenda、Charts and data、People and teams…），外观随当前页的样式变化。FAQ 原文「Can I select which Layouts to show in the slide picker? No, the Layouts collection is pre-defined for everyone in the workspace.」（pitch-05）
- **模板**：把一份演示文稿「Convert to template」放进工作区 Library，用的时候复制（《Create a template》，2026-06-26 更新）。
- **样式（Slide style）是唯一的「主题」编辑**，有独立的编辑画面 Style builder：

| 方面 | 看到的做法 | 图 / 出处 |
|---|---|---|
| 进入路径 | 右侧 Slide 面板（取消选中时出现）的「Slide style ▾」→「+ New style」，或某个样式的 ⋮ → Edit；页面下方的 slide editor 条里也有「Slide style」；工具条 Text › Edit 也能打开。 | pitch-02、pitch-03；《Create your own slide style》 |
| 整屏结构 | 整个编辑器换成专门画面。顶部一条白色标题栏：左「Style builder」，右「Cancel」文字按钮 + 紫色「Save」主按钮。左侧大预览约 61%，按顺序排出标题、大标题、小标题、正文、链接、项目符号、小号正文、表格；右侧面板约 27%；最右一条约 50px 的样式竖栏。 | pitch-01 |
| 右栏 | 「Edit style / Used on 23 slides」→ Name → Style colors（悬停可看每个颜色的用途）→ Style fonts → Background color → Bullet points color → Link ›、Title ›、Headline ›…（可展开的分项）。点预览里某一段会跳到对应分项。 | pitch-01、pitch-04 |
| 影响范围 / 用量 | 面板标题下「Used on 23 slides」；样式 ⋮ 菜单底部「Used on 23 slides  Select」，Select 一键选中用这个样式的所有页；颜色悬停列出「Background / Table background / Table alternating background / Shape text」。 | pitch-01、pitch-03、pitch-04 |
| 覆盖与重置 | 在页面上改了某个文本块的格式后，出现带蓝点的刷子图标，可选「Update」（更新样式，全文同类文本跟着改）或「Reset」（回到样式）。 | 《Create your own slide style》（无配图） |
| 版式管理 / 占位符 | 没有。 | pitch-05 |
| 退出 | 右上「Cancel / Save」，是整体保存或放弃的事务式编辑。 | pitch-01 |
| 窄屏 | 手机 App 只能浏览、分享、管理成员、查看和编辑演讲者备注，不能编辑幻灯片或样式（《Intro to our mobile apps》，2023-11-10 更新；未取图）。 | help.pitch.com/en/articles/5695566 |

## 5. Canva：没有母版 / 版式编辑

- **帮助中心搜「master slide」「slide master」都返回「We couldn't find a quick answer」**，推荐的是《Refine your presentation》（Edit Page 面板里的 Layouts / Styles）。（2026-10-28）
- **Layouts**：按当前页内容生成的重排方案，「Applying a layout rearranges and resizes your elements」，只对演示文稿可用，元素锁定时要先解锁（canva-04）。
- **Styles / Color themes**：配色、字体组合一次性套用，默认只改当前页，选「Apply to all pages」改整份（canva-02；《Add and apply color themes》）。
- **Brand Templates**：发布出来的模板，用的时候选「Apply all pages」或「Brand Template Style」（canva-01）。修改要「Edit original」→ 改完点编辑器上方菜单栏的「Republish with changes」→「Publish and close」，发布后才对他人可见（《Edit Brand Templates》）。官方最佳实践建议模板里用占位文字和占位图片、用锁保护版式结构（《Publish designs as Brand Templates》）。
- **Locks**：元素锁 Lock / Lock position only、页面锁、背景锁；锁要在发布品牌模板之前设好（《Apply locks to Brand Templates》）。Brand Controls 可以限定只能用品牌套件的颜色和字体（canva-03）。
- 整屏结构：顶部渐变菜单栏、左侧图标竖栏 + 展开面板（合计约占 49%）、右侧画布、底部页缩略条，没有右侧属性栏（canva-01）。
- 没有模式、没有退出、没有用量显示；移动端可以编辑，但同样没有母版（未取图）。

## 6. 对 v3（Figma 式、安静、三栏）最有参考价值的 8 条

每条按「标杆做法 → v3 现状 → 建议」写。「不动规则」的只是画法；标了「需裁决」的会碰到已拍板口径，要另请用户决定。「v3 现状」写的是 2026-10-28 收集时的规则，出处写文档编号或 rulings 编号；母版视图改版之后，v3 的规则与已拍板口径见设计 03-26 与 rulings §4.25。

1. **模式标识用一条贴着画布的上下文条，一行说清「在编辑什么、影响多少页、怎么出去」。**
   Google 是「Editing: Simple Light - Theme (Used by all slides) [Rename] … ×」（gslides-03/04）。Figma 和 Canva 编辑模板源文件时，也是在页面顶部放一条带发布按钮的条；Pitch 是「Style builder … Cancel | Save」（pitch-01）。
   v3 已有同构的设计：03-26 L18「画布列顶部一条横幅：母版视图标识 + 影响范围 + 右侧『关闭母版视图』」，DS-21、TB-14，高 40（DS-75）。
   建议：保留横幅形态；内容按 Google 收成一行，左边是「对象名 + 灰字影响范围」（文案沿用 03-26 §6.3），右端是「关闭母版视图」（DS-37 次按钮）。底色用中性面板色加 1px 底边（DS-2），不用 Google 的深色。不动规则。

2. **影响范围紧跟对象名，用灰字括注；没人用的也照常显示。**
   Google 用「(Used by 0 slides)」，Pitch 用「Used on 23 slides」（gslides-08、pitch-01）。
   v3 的写法已经一致：窗格行「N 页 / 未使用」不隐藏、不用警示色（PRD 07 §3 表 L251–252），横幅「改动将影响 N 页（第 x–y 页）」（03-26 §6.3、PRD ML-01）。
   建议：窗格行、横幅、检查器「使用此版式」三处用同一种写法。不动规则。

3. **在用量旁边给「选中这些页」的动作。**
   Pitch 样式菜单底部是「Used on 23 slides  Select」（pitch-03）。
   v3 已有同义命令：右键「在普通视图查看引用页（退出母版视图并选中这些页）」（PRD 07 §3 表 L252、03-26 §3，M3）。
   建议：可以在检查器「使用此版式」字段旁加同一个动作，作为第二个入口。新增入口，需裁决。

4. **窗格：母版大卡 + 缩进的版式列表 + 小标题，不画连接线也读得清。**
   Google 用「THEME / LAYOUTS」两个小标题加缩进，没有连接线（gslides-03）。
   v3 现状是版式行「缩进 18、左侧 1px 连接线」（03-26 L167；PRD 07 §3 表 L252）。
   建议：想更安静的话，可以去掉连接线，改为只缩进或加「母版 / 版式」小标题。这改的是 PRD 写明的画法，需裁决。

5. **主题编辑放在检查器的无选中态，用浮层编辑，改了马上生效。**
   Figma 是右栏无选中态的「Template style」卡（样式名 + 字体名两行、左侧色条）加「Edit template style」浮层（figma-01/06/07）；Google 是可关闭的 Theme colors 侧栏（gslides-09）。
   v3 现状与 Figma 同构：主题卡 + 弹层，与普通视图共用（PRD ML-04，03-28）。
   建议：维持。主题卡可以借 Figma 的「样式名 + 字体名」两行写法。Pitch 悬停颜色时列出用途（pitch-04）是新增信息，需裁决。

6. **插占位符集中在一个「插入」入口，类型少而明确。**
   Google 是 Insert › Placeholder 四类，图片占位符再分三种外形，工具条文本框下拉里也有（gslides-05/06）。
   v3 现状一致：工具条「占位符」菜单，类型清单已定（DS-30、TB-34）。
   建议：维持。Google 的「图片占位符外形」二级菜单可作 v3 以后扩展的参考。不动规则。

7. **退出固定在条的最右端，点了直接走，不确认。**
   Google 的 × 在标题条最右（gslides-03 → gslides-10），Pitch 的 Save 在右上。
   v3 现状一致：横幅右侧「关闭母版视图」，四种退出等价（03-26 §1.1），有未提交改动时也不弹离开确认（设计 02 F10 的边界表）。
   建议：维持，位置不变。不动规则。

8. **换模式不必换整套外壳。**
   Figma 设计模式只换强调色、工具集和侧栏内容（figma-02 → 03）；Google 只多出一栏窗格和一条标题条，菜单、工具条照旧（gslides-03）。
   v3 现状一致：母版视图是同一编辑器的视图状态（PRD 07 §0）。左栏沿用同一个 240 左栏，换成母版窗格和「新建版式 ▾」（03-02 L142）；检查器换成母版 / 版式属性；工具条换成占位符等（03-26 §1.2 去向表）。
   建议：改版时继续守住「三栏不变、只换内容」，不要做成全屏专用编辑器（Pitch 式）。不动规则。

## 7. 不适合照搬的地方及原因

1. **Google 的深色主题窗格和深色画布。** 与 DS-2「中性灰阶平面、品牌蓝只做强调」冲突，暗色主题下也失去区分作用。v3 靠横幅文案和窗格内容就能区分模式。
2. **Google 在生成器里保留普通页缩略栏（相当于左边多一栏）。** 与 PRD 07 L84「母版视图不显示页缩略图」冲突；v3 只有一个 240 左栏（03-02 L14、L47）。v3 的影响范围用文字（03-26 §6.3）和依赖页 ≤ 500 ms 内更新（PRD ML-03）来表达。
3. **Google 的「Reapply to all」。** v3 是命令一执行就提交，所有引用页即时更新（PRD ML-03、前端 50/11 §4），不需要手动重新套用；属性级的覆盖与重置在检查器里做（03-26 §5）。
4. **Google 用模态对话框改名。** v3 改名入口是检查器「名称」字段，右键「重命名」只把焦点移过去（TB-46，03-26 §3），比对话框安静。
5. **Google 版式右键菜单里混着剪切、复制、粘贴、评论。** v3 的右键命令集合更收敛（03-26 §3），而且母版视图里评论不可用（PRD 07 L84）。
6. **Figma、Pitch、Canva 的「复制式模板」**（发布或修改只影响新建文件，已有页不变）。v3 要忠实于 OOXML 的母版继承（章程「忠实优先」；PRD 07 §0、ML-03），这些产品只能借样式编辑的画法，不能借模型。
7. **Figma 靠换强调色（橙 → 蓝）表示模式。** v3 只有品牌蓝一种强调色（DS-2）；母版视图还要写明影响范围（03-26 §6.3），不能只靠颜色（色彩不作唯一编码，03-26 §9）。
8. **Pitch 全屏 Style builder 的「Cancel / Save」事务式编辑。** v3 没有整体保存或取消（前端 50/11 §4），退出也不弹确认（设计 02 F10 的边界表）；而且 v3 要求母版视图沿用三栏（第 6 节第 8 条）。
9. **Canva 的 AI Layouts 和模板锁。** 两者都不是母版概念，v3 目前也没有对应需求。

## 8. 没取到图的方面与原因

- **Google Slides**：官方没有生成器整屏、版式右键菜单、改名对话框和移动端的截图，这几张用的是第三方（各条 `note` 已写；原图 2026-11-12 公开前已移除）。没找到任何来源展示：拖动重排版式、删除被引用版式时的处理、多主题切换的展开态、生成器里的键盘操作（如 Esc）。
- **Figma Slides**：没有母版 / 版式模式，所以「版式管理」「用量」没有对应画面。编辑模板源 deck 时顶部的「Publish changes」横幅，帮助文章只有文字没有截图。
- **Pitch**：没有版式编辑和占位符，「版式管理」只有固定 Layouts 库的图（pitch-05）。移动端只取了文字证据，没取图。样式「Update / Reset」的覆盖提示只有文字。
- **Canva**：没有母版模式，「退出」「检查器」「用量」都不存在。帮助文章几乎只嵌视频，所以用了两张官方视频封面（界面小且被压暗）。锁定菜单只在 canva-03 的浮动工具条上看到锁图标，没有展开态的图。移动端没取。
- **其他**：上一次（2026-10-23）下载的图已被系统清理，这次全部重新下载，并逐张用 Read 看过。

## 9. 出处

- Google Workspace Updates：[“Master” view renamed to “Theme Builder”（2021-05）](https://workspaceupdates.googleblog.com/2021/05/theme-builder-for-google-slides.html) · [Image placeholders（2021-07）](https://workspaceupdates.googleblog.com/2021/07/image-placeholders-make-it-easy-to-work.html) · [Easily customize theme colors in Slides（2019-04）](https://workspaceupdates.googleblog.com/2019/04/easily-customize-theme-colors-in-slides.html) · [Theme colors in Sheets and Slides（2021-08）](https://workspaceupdates.googleblog.com/2021/08/easily-customize-theme-colors-in-sheets.html) · [Enhancing tool discovery（2023-04）](https://workspaceupdates.googleblog.com/2023/04/enhancing-tool-discovery-google-docs-sheets-slides%20.html)
- Google 帮助：[Docs Editors 帮助 1705254（电脑 / iPhone & iPad / Android）](https://support.google.com/docs/answer/1705254) · [Learning Center：Tips for great presentations（Theme builder 步骤）](https://support.google.com/a/users/answer/9282978) · [Slides API：Pages, Page Elements, and Properties](https://developers.google.com/workspace/slides/api/concepts/page-elements)
- Google 第三方：[BrightCarbon](https://www.brightcarbon.com/blog/editing-themes-and-layouts-in-google-slides/) · [SlideModel](https://slidemodel.com/master-slide-in-google-slides/) · [How-To Geek](https://www.howtogeek.com/747178/how-to-create-template-slides-with-theme-builder-in-google-slides/) · [Elgin Community College](https://elgin.edu/accessibility/accessibility-in-google-slides/slide-layouts/) · [TechRepublic](https://www.techrepublic.com/article/how-to-select-import-and-customize-google-slides-themes/) · [Tim Jackson（多主题清理，2023-08）](https://www.timj.co.uk/2023/08/cleaning-up-slide-themes-in-google-slides/)
- Figma 帮助：[Explore Figma Slides](https://help.figma.com/hc/en-us/articles/24170630629911-Explore-Figma-Slides) · [Use design mode](https://help.figma.com/hc/en-us/articles/25423848723863-Use-design-mode-in-Figma-Slides) · [Find and use slide deck templates](https://help.figma.com/hc/en-us/articles/26621828788631-Find-and-use-slide-deck-templates) · [Publish templates to a team or organization](https://help.figma.com/hc/en-us/articles/24290529512471-Publish-slide-deck-templates-to-a-team-or-organization) · [Publish templates to the Community](https://help.figma.com/hc/en-us/articles/25923960876567-Publish-slide-deck-templates-to-the-Figma-Community) · [Create components](https://help.figma.com/hc/en-us/articles/30630178611991-Create-components-in-Figma-Slides) · [Add slide numbers](https://help.figma.com/hc/en-us/articles/30436550728087-Add-slide-numbers-to-your-presentation) · [Bulk edit layers](https://help.figma.com/hc/en-us/articles/27336977187863-Bulk-edit-layers-in-a-slide-deck) · [Guide to the Figma mobile app](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app)
- Pitch 帮助：[Create your own slide style](https://help.pitch.com/en/articles/4059534-create-your-own-slide-style) · [Add slides to your deck](https://help.pitch.com/en/articles/7003075-add-slides-using-layouts) · [Create a template](https://help.pitch.com/en/articles/3752837-create-a-template) · [Intro to our mobile apps](https://help.pitch.com/en/articles/5695566-intro-to-our-mobile-apps)
- Canva 帮助：[Use Layouts](https://www.canva.com/help/using-layouts/) · [Refine your presentation](https://www.canva.com/help/use-page-tools/) · [Find color palettes and font combinations](https://www.canva.com/help/color-and-font-combinations/) · [Add and apply color themes](https://www.canva.com/help/color-themes/) · [Design with Brand Kits and Brand Templates](https://www.canva.com/help/using-brand-templates/) · [Edit Brand Templates](https://www.canva.com/help/update-brand-templates/) · [Publish designs as Brand Templates](https://www.canva.com/help/publish-team-template/) · [Apply locks to Brand Templates](https://www.canva.com/help/brand-template-locks/) · [Lock and unlock pages or elements](https://www.canva.com/help/lock-and-unlock-elements/)
- v3 文档：`docs/20-design/03-screens/26-master-view-and-editing.md`（03-26）、`docs/20-design/03-screens/02-editor-main.md`（03-02）、`docs/20-design/02-user-flows.md`（设计 02）、`docs/10-prd/03-features/07-masters-layouts-and-themes.md`（PRD 07）、`docs/50-frontend/11-masters-layouts-and-themes.md`（前端 50/11）、`docs/00-charter/rulings-2026-09-14.md`（DS-2、DS-21、DS-30、DS-37、DS-75、TB-14、TB-34、TB-46）；母版视图改版之后的规则与已拍板口径见 03-26 与 rulings §4.25。
