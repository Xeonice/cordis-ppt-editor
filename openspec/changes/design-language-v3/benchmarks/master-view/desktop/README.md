# 母版视图标杆 · B 组（PowerPoint 幻灯片母版视图 / Keynote 编辑幻灯片版式）

> 2026-10-28 收集，变更 `design-language-v3`，摸底阶段。同目录 32 张图（PowerPoint 25 张、Keynote 7 张），逐张说明见 `sources.json`（字段：file / product / title / url / imageUrl / observed / usedFor / pixelSize / note / retrieved）。
> 图片都是官方帮助或官方视频的原图：没有缩放，没有裁切。视频截帧按 1920×1080 原尺寸保存。只有 `ppt-15` 来自第三方，原因是官方没有这个画面；这张原图 2026-11-12 公开前已移除（目录现存 31 张），`sources.json` 里标 `removed`、出处与 observed 照旧。红框、箭头、说明文字都是原文档自带的标注，不属于界面。
> 下文「对 v3」各条写的是 2026-10-28 收集时的规则与已拍板口径，出处写文档编号或 rulings 编号；母版视图改版之后，v3 的规则与已拍板口径见设计 03-26 与 rulings §4.25。本文只描述标杆，不改任何规则；涉及已拍板口径的地方都标了「需裁决」。

## 0. 结论先行

- **PowerPoint**：母版视图就是在同一个窗口里换一套「Slide Master」功能区页签。左栏是「母版大缩略图 + 缩进的版式缩略图 + 树形虚线」，画布上所有占位符都画成虚线框，并写着「Click to edit Master … style」。没有检查器，属性分散在功能区和按需打开的右侧窗格里。出口是功能区最右边的「Close Master View」（Mac 版叫「Close Master」）。只有 Windows 和 Mac 桌面版有这个视图，网页版、iPad 和手机都没有。
- **Keynote**：编辑版式也是同一个窗口里的一种模式。左栏换成版式列表，名称写在缩略图下面。Mac 版在画布底部有一条蓝色模式条，写「Edit Master Slide / Edit Slide Layout: 〈名称〉」，右端是「Done」；iPad 把同一句话放在顶栏正中，「完成」改成左上角的 ✓。右侧 Format 栏换成版式属性：标题、正文、页码勾选、对象占位符、背景。Keynote **没有母版层**，版式之间是平级的。iPad 和 iPhone 都能编辑版式，iCloud 网页版不能。
- 两家**都没有**「版式 | 母版」范围切换，也都没有「继承用虚线、本地用实线」的区分；常驻显示「被几页使用」两家也都没做（PowerPoint 只有悬停提示，而且会截断；Keynote 完全没有）。这三点见 §6。

## 1. 图片清单

| 文件 | 产品 / 版本 | 方面（usedFor） | 一句话 |
|---|---|---|---|
| `ppt-01-win-master-view-2024.png` | PowerPoint Windows · M365（2024） | chrome, pane, canvas, placeholders, exit, layouts-manage, theme | **整屏大图**：Slide Master 页签 6 组、左栏两级树、全虚线占位符 |
| `ppt-02-win-view-tab-slide-master.png` | PowerPoint Windows · M365 | entry | View › Master Views › Slide Master |
| `ppt-03-win-master-view-window-2016.png` | PowerPoint 2016 Windows | chrome, pane, canvas, exit, layouts-manage | 带标题栏和状态栏的整窗；状态栏写「Slide Master」；选中母版时版式专用控件置灰 |
| `ppt-04-win-video-view-tab-before-enter.png` | PowerPoint Windows · M365（官方视频帧） | entry, chrome | 进入前的页签行（还有 Design、Slide Show） |
| `ppt-05-win-video-master-pane-states.png` | 同上 | chrome, pane, canvas | 进入后页签行替换；左栏悬停和选中两种橙框 |
| `ppt-06-win-video-theme-fonts-menu.png` | 同上 | theme | 母版视图里的 Fonts 下拉，悬停实时预览 |
| `ppt-07-win-video-close-master-view.png` | 同上 | exit, theme | 点 Close Master View 退出 |
| `ppt-08-win-insert-placeholder-menu.png` | PowerPoint 2016 Windows | placeholders | Insert Placeholder 菜单 8 种类型 |
| `ppt-09-win-footers-checkbox.png` | PowerPoint Windows · M365 | placeholders, canvas | 版式的 Footers 勾选，受母版 Master Layout 约束 |
| `ppt-10-win-rename-layout-dialog.jpg` | PowerPoint Windows（2013 样式） | layouts-manage | Rename Layout 模态对话框 |
| `ppt-11-win-two-masters-pane.jpg` | PowerPoint Windows（2013 样式） | pane, theme | 两个母版各带一组版式，母版标序号 1、2 |
| `ppt-12-win-master-themes-gallery.png` | PowerPoint 2016 Windows | theme | 母版视图的 Themes 画廊 |
| `ppt-13-win-theme-colors-dialog.png` | PowerPoint 2016 Windows | theme | Create New Theme Colors（12 个色槽） |
| `ppt-14-win-theme-fonts-dialog.png` | PowerPoint Windows | theme | Create New Theme Fonts（标题 / 正文两级） |
| `ppt-15-win-layout-usage-tooltip.png` | PowerPoint Windows（**第三方**：Indezine） | usage | 「… Layout: used by slide(s) 18-19, 54, ...」悬停提示（原图已移除，见 `sources.json`） |
| `ppt-16-mac-slide-master-ribbon.png` | PowerPoint 2016 Mac | chrome, exit, layouts-manage, placeholders, theme | Mac 版 Slide Master 页签整条，出口叫「Close Master」 |
| `ppt-17-mac-view-menu-master.png` | PowerPoint Mac | entry | 菜单栏 View › Master ▸ |
| `ppt-18-mac-view-tab-slide-master-on.png` | PowerPoint Mac · M365（2023） | entry, chrome | 母版视图中 View 页签的 Slide Master 呈按下态，Notes 置灰 |
| `ppt-19-mac-master-thumbnail-pane.png` | PowerPoint Mac | pane, canvas | Mac 版左栏：母版大、版式小且缩进 |
| `ppt-20-mac-insert-placeholder-menu.png` | PowerPoint Mac | placeholders | Insert Placeholder 菜单 10 种（含竖排） |
| `ppt-21-mac-background-styles.png` | PowerPoint Mac | theme | Background Styles 画廊 |
| `ppt-22-mac-format-background-pane.png` | PowerPoint Mac | inspector, theme | Format Background 任务窗格（PowerPoint 最接近检查器的东西） |
| `ppt-23-web-open-in-desktop-app.png` | PowerPoint for the web | other, entry | 网页版没有母版视图，只能「Open in Desktop App」 |
| `ppt-24-web-slide-layout-gallery.png` | PowerPoint for the web | other | 网页版最接近的功能：只能套用的版式画廊 |
| `ppt-25-phone-floating-toolbar-layout.png` | PowerPoint for Android / iPhone | narrow, other | 手机端最接近的功能：浮动工具条上的 Layout（只能套用） |
| `keynote-01-mac-edit-master-window-v6.png` | Keynote 6.5 Mac（2015） | chrome, exit, pane, canvas, inspector, placeholders | **整窗大图**：底部蓝色模式条「Edit Master Slide: Title & Subtitle」+ Done |
| `keynote-02-mac-layout-navigator-v15.png` | Keynote 15 Mac（macOS 26） | pane, layouts-manage | 现行版左栏版式列表 + Add Slide（＝新建版式） |
| `keynote-03-mac-format-sidebar-edit-layout.png` | Keynote 13 Mac | entry, inspector, placeholders | Format 栏「Slide」面板底部的「Edit Slide Layout」按钮 |
| `keynote-04-ipad-edit-slide-layout.png` | Keynote iPad（iPadOS 26） | chrome, exit, pane, canvas, layouts-manage, narrow | **整屏大图**：顶栏「Edit Slide Layout: Title & Photo Alt」+ 左上 ✓ |
| `keynote-05-iphone-edit-slide-layout.png` | Keynote iPhone（iOS 26） | narrow, pane, exit | 手机竖屏：浮动导航 + 左上 ✓，没有标题 |
| `keynote-06-mac-theme-chooser.png` | Keynote 15 Mac | theme | 主题选择器（Keynote 没有主题色和字体编辑器） |
| `keynote-07-mac-background-controls.png` | Keynote 15 Mac | theme, inspector | Format 栏 Background 节 |

## 2. PowerPoint 幻灯片母版视图

### 2.1 进入路径
- **Windows**：功能区 View › Master Views › Slide Master（`ppt-02`、`ppt-04`）。这是唯一的界面入口：工具栏里没有常驻按钮，官方帮助里也没有快捷键。官方原文：「On the View tab, select Slide Master」（[Customize a slide master](https://support.microsoft.com/en-us/powerpoint/training/customize-a-slide-master)）。
- **Mac**：菜单栏 View › Master › Slide Master（`ppt-17`；原文「On the View menu, select Master > Slide Master」，见 [Change footer formatting … for Mac](https://support.microsoft.com/en-us/powerpoint/change-footer-formatting-on-all-slides-in-powerpoint-for-mac)），或功能区 View › Slide Master（`ppt-18`）。
- 进入后，左栏显示演示中的全部母版和版式，并默认选中、显示当前页所用的版式。官方原文「Select the slide you're having trouble with. On the View tab, select Slide Master. In Slide Master view, the layout for your slide appears in the main pane」（[Troubleshoot footers](https://support.microsoft.com/en-us/powerpoint/troubleshoot-footers-in-powerpoint)）。视频里左栏是滚在当前版式的位置，所以要「Scroll up to see the slide master」（`ppt-05` 字幕）。这与 v3 的「进入时默认编辑当前页所用的版式」（PRD ML-01）一致。

### 2.2 整屏结构与「我在母版模式」的标识
- 同一个窗口，三处变化：
  1. **页签行**替换：File 后面插入「Slide Master」页签并自动切到它，Design 和 Slide Show 两个页签消失（`ppt-04` 对比 `ppt-05`）。
  2. **功能区**换成 6 组：Edit Master｜Master Layout｜Edit Theme｜Background｜Size｜Close（`ppt-01`）。
  3. **状态栏**最左边的页码位置改写「Slide Master」（`ppt-03`）。
- 没有横幅，也没有模式条。Mac 版 View 页签上的 Slide Master 按钮保持按下态，Notes 置灰但不隐藏（`ppt-18`）。
- 版面比例（按 `ppt-01` 估算）：页签行加功能区约占高度 15%；左栏约占宽度 15%；画布区占其余部分，没有右栏。

### 2.3 左栏（母版与版式）
- **两级树**：
  - 母版是最大的缩略图，左边标序号（1、2…），版式不编号。
  - 版式缩略图小一号，向右缩进约 1/5 宽，用一条竖向虚线加一段段短横虚线挂在母版下面（`ppt-01`、`ppt-03`、`ppt-05`）。
  - 每个主题一个母版，多个母版时依次往下排，每组一个序号（`ppt-11`；原文「Each slide master represents a theme」）。
- **没有文字**：缩略图下不写名称，不写使用页数，也不标「未使用」。版式名称和使用情况只在悬停提示里出现，格式是「〈名称〉 Layout: used by slide(s) 18-19, 54, ...」，页码多时会截断（`ppt-15`，第三方图）。
- **状态**：选中项是主题色（橙）细框，悬停时外圈加一道浅橙色粗框（`ppt-05`）。2016 版选中母版时，序号也跟着变色（`ppt-03`）。
- **多选**：Mac 版可以按 Shift 多选几个版式，再一起改背景（`ppt-21` 正文）。
- **右键菜单**：只有文字出处——Rename Layout（[Rename a slide layout](https://support.microsoft.com/en-us/powerpoint/rename-a-slide-layout)），母版上可以 Copy / Paste（[Copy and paste a slide master](https://support.microsoft.com/en-us/powerpoint/copy-and-paste-a-slide-master-from-one-presentation-to-another)）。官方没有右键菜单的截图。

### 2.4 画布
- 显示左栏选中的母版或版式，上方和左侧有标尺（`ppt-01`）。
- 所有占位符都是细虚线框，里面写提示文本：
  - 标题：「Click to edit Master title style」。
  - 正文：五级缩进，「Click to edit Master text styles / Second level … Fifth level」，2016 版第一级写作「Edit Master text styles」。
  - 页脚三件：日期、Footer、「‹#›」。
- 母版上的普通图形（如 `ppt-01` 中的 logo）在版式上显示为背景，不画框。版式上**不区分**「继承自母版」和「本版式定义」，没有图例。
- 页脚的继承规则写在正文里（[Troubleshoot footers](https://support.microsoft.com/en-us/powerpoint/troubleshoot-footers-in-powerpoint)，`ppt-09`）：
  - 母版在 Master Layout 对话框里决定版式「能不能有」日期、页码、页脚；
  - 版式再用 Footers 勾选决定「显不显示」；
  - 母版关掉之后，版式那一侧勾不上。

### 2.5 右栏
- **没有常驻检查器**。属性分三处：
  1. 功能区：Title / Footers 勾选、Hide Background Graphics、Background Styles；
  2. 按需打开的右侧任务窗格：Format Background（`ppt-22`），作用于左栏选中的对象；
  3. 模态对话框：Rename Layout、Master Layout、主题色和字体。
- 功能区按选中对象切换可用项：选中母版时 Insert Placeholder、Title、Footers 置灰（`ppt-03`）；选中版式时 Master Layout、Preserve 置灰（`ppt-01`）。

### 2.6 占位符
- **插入**：Slide Master › Insert Placeholder ▾，选类型后在版式上拖出大小（`ppt-08`、`ppt-20`）。
  - Windows 2016 有 8 种：Content、Text、Picture、Chart、Table、SmartArt、Media、Online Image。
  - Mac 多两种竖排：Content (Vertical)、Text (Vertical)。
  - 2023 年起新增 Cameo（[Insider 博客](https://techcommunity.microsoft.com/blog/microsoft365insiderblog/use-cameo-placeholders-in-your-powerpoint-presentations/4222901)）。
- **删除**：选中占位符的边框，按 Delete。
- **标题和页脚**：版式上用两个勾选（Title、Footers）开关；母版上用 Master Layout 对话框。
- **改提示文本**：直接在占位符里改写（[Add, edit, or remove a placeholder](https://support.microsoft.com/en-us/powerpoint/add-edit-or-remove-a-placeholder-on-a-slide-layout)）。

### 2.7 版式管理
- **母版和版式的增删**：功能区 Edit Master 组——Insert Slide Master、Insert Layout、Delete、Rename、Preserve（`ppt-01`、`ppt-16`）。
- **改名**：唯一要弹模态框的操作，「Rename Layout」（`ppt-10`）。
- **Preserve**：作用于母版，让没有页使用的母版也保留下来。
- 官方没有讲重排版式的界面。
- **复制母版**：在左栏右键 Copy，到另一份演示里 Paste，粘贴时选「Use Destination Theme / Keep Source Formatting」。
- **自动清理**：Microsoft 365 打开含 25 个以上母版、且其中有未使用母版的文件时，会提示可以清理（[What is a slide master](https://support.microsoft.com/en-us/powerpoint/training/what-is-a-slide-master-in-powerpoint)）。

### 2.8 主题
- **入口**：Edit Theme 组的 Themes 画廊（`ppt-12`）。画廊分「This Presentation」和「Office」两组，下面有 Browse for Themes 和 Save Current Theme 两个命令。
- **改主题的组成部分**：Background 组里的 Colors、Fonts、Effects、Background Styles、Hide Background Graphics（`ppt-21`）。
- **自定义**：主题色是 12 个色槽，字体只分标题和正文两级，都在模态对话框里改（`ppt-13`、`ppt-14`）。
- **即时生效**：悬停即在画布上实时预览，改完所有版式一起变（`ppt-06`、`ppt-07`）。
- **范围**：选中某个母版再换主题，只换这一个母版（[Use multiple themes](https://support.microsoft.com/en-us/powerpoint/use-multiple-themes-in-one-presentation)）。
- **注意**：母版的改动临时记在当前主题上，换主题会把这些改动丢掉，要保留得先 Save Current Theme（[placeholder 页 Tip](https://support.microsoft.com/en-us/powerpoint/add-edit-or-remove-a-placeholder-on-a-slide-layout)）。

### 2.9 影响范围
- 界面上只有 `ppt-15` 那个悬停提示，没有任何常驻计数。
- 帮助里另有一条规则：给版式加了占位符之后，已有的页要回普通视图「重新套用版式」才会跟上（[Edit and re-apply a slide layout](https://support.microsoft.com/en-us/powerpoint/edit-and-re-apply-a-slide-layout)）。
- 官方的说法是母版视图「won't change the content, just the look and layout of your slides」（视频字幕，`ppt-05`）。

### 2.10 退出
- Windows：功能区最右 Close 组的「Close Master View」（`ppt-01`、`ppt-07`）。
- Mac：Slide Master 页签最右的「Close Master」（`ppt-16`）。
- 两个平台的图标都是红色 ×，这是整条功能区里最醒目的按钮。
- 官方帮助里没有快捷键退出的说法。
- 退出后回到普通视图；视频里退出后停在原来那一页（`ppt-07` 之后约 3 秒）。

### 2.11 窄屏与网页
- **网页版没有母版视图**（`ppt-23`），官方原文：
  - 「PowerPoint for the web doesn't have a slide master」；
  - 「Viewing a slide master isn't currently possible in PowerPoint for the web」（[Open Slide Master view](https://support.microsoft.com/en-us/office/open-slide-master-view-60533229-9207-4cd5-842b-f0f89935ca21)）；
  - 「Outline and Master views are only available in desktop PowerPoint」（[How certain features behave in web-based PowerPoint](https://support.microsoft.com/en-us/office/how-certain-features-behave-in-web-based-powerpoint-a931f0c8-1305-4428-8f7c-9cfa00ef28c5)）。
- 网页版能做的只有：Editing › Open in Desktop App；或从 Home › Slide Layout 画廊里套用版式，不能编辑（`ppt-24`）。
- **iPad 和手机**：Insider 博客原文「You can only use Slide Master view in PowerPoint for Windows and PowerPoint for Mac」，也就是说移动端没有这个视图。移动端能做的只有在浮动工具条点 Home › Layout，给页面套用版式（`ppt-25`）。

## 3. Keynote 编辑幻灯片版式

### 3.1 进入路径
- **Mac**：
  - 菜单栏 View › Edit Slide Layouts，或工具栏 View 按钮菜单 › Edit Slide Layouts（[Add and edit slide layouts](https://support.apple.com/guide/keynote/add-and-edit-slide-layouts-tan7a2b69972/mac)；[Set up your presentation in Keynote](https://support.apple.com/en-us/119885)）。
  - 也可以在普通编辑中选中某页，点 Format 栏「Slide」面板最底部的整宽按钮「Edit Slide Layout」，直接定位到这一页所用的版式（`keynote-03`，Keynote 13 截图）。
- **iPad 和 iPhone**：点幻灯片空白处 › 更多（…）› Edit Slide Layout；导航收起时左上角会出现「Slide Layouts」按钮。
- **名称沿革**：Keynote 11 及以前叫 master slides，菜单是 Edit / Exit Master Slides；Keynote 12 起改叫 slide layouts（依据是帮助网址：11.0 版为 `add-and-edit-master-slides`，12.0 版起为 `add-and-edit-slide-layouts`）。

### 3.2 整屏结构与模式标识
- **Mac**（`keynote-01`，6.5 版整窗）：
  - 工具栏和左右两栏都保留，只换内容：左栏变成母版（版式）列表，右侧 Format 栏变成「Master Slide Layout」面板。
  - 画布底部加一条**蓝色模式条**，约 26px 高，只横跨画布这一栏。条正中写「Edit Master Slide: **Title & Subtitle**」，前缀常规体、名称粗体；右端是浅蓝底的「Done」按钮。
  - 现行帮助仍写「click Done in the blue bar at the bottom of the screen」，说明这条结构沿用至今，但官方没有给出现行版本的整窗截图。
  - 版面比例：左栏约 9%，画布约 72%，右栏约 19%。
- **iPad**（`keynote-04`）：
  - 顶栏正中写「**Edit Slide Layout:** Title & Photo Alt」。
  - 左上是蓝色圆形「✓」（完成）；右侧只剩播放、撤销、格式三个圆形按钮，插入等按钮都收起来了。
  - 左侧是浮动导航。
- **iPhone**（`keynote-05`）：去掉了标题，只剩左上 ✓ 和右上一个胶囊里的三个按钮。

### 3.3 左栏
- **只有一级**：版式平铺，没有母版层。
- **名称**：写在缩略图下面。
- **选中态**：整块填充。Mac 6.x 是蓝灰底白字，新版是蓝色圆角块白字（`keynote-01`、`keynote-02`、`keynote-04`）。
- **新建**：两种做法都会新建一个版式——点工具栏 Add Slide 再选一个相近的版式，或在导航里选中相近的版式后按 Return。iPad 和 iPhone 点导航底部悬浮的「⊞」，新建后会立刻要求输入版式名（原文「Type a name for the new slide layout, then tap Done」）。
- **改名**：在导航里双击名称，直接输入。
- **删除**：Control-点按缩略图 › Delete；如果有页在用这个版式，会弹框让用户给这些页另选一个版式，再点 Choose。
- 没有使用页数，没有「未使用」标记，也没有重排的说明。

### 3.4 画布
- 显示所选版式的真实外观。占位符平时不画框，用样例文字说明自己是占位符：「Title Text」，正文「Body Level One … Five」逐级缩进，图片占位符右下有圆形「+」（`keynote-01`、`keynote-04`）。
- 画面里可见黄色对齐参考线（`keynote-01`）。
- 版式上新加的普通对象会变成页面背景，在页面上不能编辑（原文「these objects become part of the slide background and aren’t editable in your presentation」）。
- 没有继承显示，因为没有母版层。

### 3.5 右栏（Format）
- **版式模式下**：面板标题是「Master Slide Layout」（6.5 版，`keynote-01`），内容依次为：
  - Appearance 勾选：Title、Body、Slide Number、Object Placeholder；
  - Allow objects on slide to layer with master（现行版叫 Allow layering）；
  - Background。
- **选中某个对象时**：Style 页签有 Define as Text Placeholder / Define as Media Placeholder、Tag，以及 Display（占位符显示文字）。
- **普通编辑时**（`keynote-03`，13 版）：
  - 「Slide」面板顶部是一张版式卡片：缩略图，加「Slide Layout」灰字和版式名，点开可以换版式；
  - 下面是 Appearance 勾选和 Background；
  - 最底部是整宽的白底细边按钮「Edit Slide Layout」；
  - 分段控件的选中段是白色凸起块，不用强调色。macOS 26 的 Background 节改成了蓝色选中段（`keynote-07`）。

### 3.6 占位符
- 任何文本框或形状、图片或视频，都可以在 Style 页签勾「Define as Text / Media Placeholder」变成占位符。
- 占位符按类型自动打 Tag，换版式时内容按 Tag 迁移，Tag 可以手改。
- 每个版式最多一个对象占位符（Object Placeholder，可放表格、图表、图片集）。
- 标题、正文、页码三种用 Appearance 勾选开关（[Show or hide text placeholders](https://support.apple.com/guide/keynote/show-or-hide-text-placeholders-tan30509ce0d/mac)、[Show or hide slide numbers](https://support.apple.com/guide/keynote/show-or-hide-slide-numbers-tan5a0420bc0/mac)）。

### 3.7 主题
- 没有主题色和主题字体编辑器，主题就是「一整套版式加样式」。
- **换主题**：File › Change Theme（或 Document 栏 › Change Theme），在主题选择器里选（`keynote-06` 是新建时的同类界面）。可以勾「Keep your style changes」保留自己的样式改动。
- **存主题**：改过版式后 File › Save Theme，原文「Only changes to slide layouts are saved to a new theme」。
- 背景色块弹出的是主题配色（`keynote-07`）。
- **协作限制**：共享中的演示不能换主题，也不能重新套用版式（[Change a Keynote theme](https://support.apple.com/guide/keynote/change-a-theme-tan20c95bae6/mac)、[Apply a slide layout](https://support.apple.com/guide/keynote/apply-a-slide-layout-tan584189747/mac)）。

### 3.8 影响范围
- 只有正文一句话：「The changes appear on every slide in the presentation that’s based on that layout」。界面上不显示数量。
- 删除被引用的版式时弹「替代版式」选择框。
- 页面上改乱了，可以右键 Reapply Layout to Slide 回到版式原样（[Apply a slide layout](https://support.apple.com/guide/keynote/apply-a-slide-layout-tan584189747/mac)）。

### 3.9 退出
- Mac：点模式条右端的 Done，或 View › Exit Slide Layouts（6.x 叫 Exit Master Slides）。
- iPad 和 iPhone：点左上 ✓。Apple 文章 119885 写的是「tap Done in the upper-right corner」，与 iPadOS 26 截图里的位置不一致，以截图为准。

### 3.10 窄屏与网页
- **iPad 和 iPhone**：完整支持编辑版式，界面压缩成「浮动导航 + 左上 ✓（+ iPad 顶栏标题）」（`keynote-04`、`keynote-05`）。
- **Keynote for iCloud（网页）**：不能编辑版式。Apple 原文「If you want to change the look of slides, slide size, or the theme after initially creating your presentation in Keynote for iCloud, open your presentation in Keynote on your iPhone, iPad, or Mac」（[119885](https://support.apple.com/en-us/119885)，2026-05-11 版）。

## 4. 两家对照

| 方面 | PowerPoint（Windows / Mac） | Keynote（Mac / iPad） |
|---|---|---|
| 层级 | 母版 → 版式两级；一个主题一个母版 | 只有版式一级 |
| 进入 | View 页签按钮 / View 菜单 › Master | View 菜单；Format 栏「Edit Slide Layout」；iPad 点空白处 › … |
| 模式标识 | 页签行替换（多 Slide Master，少 Design、Slide Show）+ 状态栏「Slide Master」 | 模式条或顶栏写「Edit Slide Layout: 〈名称〉」 |
| 出口 | 功能区最右「Close Master View / Close Master」（红色 ×） | 模式条右端「Done」/ 左上 ✓ |
| 左栏 | 大母版 + 缩进版式 + 树形虚线；无名称 | 平铺版式；名称在缩略图下 |
| 画布 | 全部虚线框 + 提示文本 | 样例文字，平时无框 |
| 右栏 | 无（功能区 + 按需窗格 + 对话框） | Format 栏换成版式属性 |
| 新建 / 改名 / 删除 | 功能区按钮；改名弹框 | Add Slide；双击改名；删除时弹框选替代版式 |
| 使用情况 | 只有悬停提示，会截断 | 无 |
| 主题 | 主题、色、字、效果、背景都在母版视图 | 只有换主题、存主题 |
| 窄屏 / 网页 | 都没有 | iPad、iPhone 有；iCloud 网页没有 |

## 5. 对 v3（Figma 式、安静、三栏）最有参考价值的 8 条

1. **模式标识写清「正在编辑哪一个」**
   - 标杆做法：Keynote 把「我在编辑版式」和「编辑的是哪一个」合成一句：「Edit Master Slide: Title & Subtitle」「Edit Slide Layout: Title & Photo Alt」（`keynote-01`、`keynote-04`）。PowerPoint 只说了前半句：页签行替换加状态栏「Slide Master」。
   - 对 v3：母版横幅可以照这个结构写成「母版视图 · 版式「标题与内容」」，影响范围说明按 03-26 §6.3 的条件顺序接在后面。横幅的位置和叠放不动（TB-14）；只改文案结构，需要在 03-26 §6.3 确认。
2. **出口固定在模式 chrome 的最右端，只用一个词**
   - 标杆做法：PowerPoint 是功能区最右「Close」组，Keynote Mac 是模式条右端「Done」（`ppt-07`、`keynote-01`）。
   - 对 v3：与 DS-21 选的「横幅右端『关闭母版视图』是唯一常驻出口」一致，可以保留。按钮画法按 DS-37 用透明底细边，不学两家的红色或蓝色。
3. **在检查器里给一个「编辑版式」的上下文入口**
   - 标杆做法：Keynote 普通编辑时，Format 栏「Slide」面板顶部是版式卡片，最底部是整宽白底细边的「Edit Slide Layout」，点了直接定位到这一页的版式（`keynote-03`）。
   - 对 v3：与「进入时默认编辑当前页的版式」（PRD ML-01）、设计 03-03 占位符说明行的「转到版式」同一思路，按钮样式也正合 DS-37。但它属于「常驻入口」，与 DS-21「不设常驻按钮」冲突，**需裁决**。
4. **左栏用 PowerPoint 的两级树，名称学 Keynote 写在缩略图下，计数常驻显示**
   - 标杆做法：PowerPoint 的「大母版 + 缩进小版式 + 竖向和短横虚线」是两家里唯一能表达两级继承的画法（`ppt-01`、`ppt-11`）。Keynote 把名称写在缩略图下，扫读更快（`keynote-02`）。
   - 对 v3：PRD ML-01 与 03-26 §3 已经规定了这套结构，标杆可以作为画法依据。v3 常驻显示「N 页 / 未使用」，比 PowerPoint 只靠悬停提示（`ppt-15`）好，应保留。选中态继续用 v3 的选中环，不学蓝块或橙框。
5. **版式属性集中到右栏**
   - 标杆做法：Keynote 版式模式下 Format 栏的内容是「Appearance 勾选（Title / Body / Slide Number / Object Placeholder）→ 叠放选项 → Background」（`keynote-01`）。普通编辑时用「版式卡片 + 勾选 + 分段 + 底部整宽次按钮」（`keynote-03`）。PowerPoint 的同类设置散在功能区、窗格和对话框里，是反例。
   - 对 v3：03-26 §5 的版式与母版属性集合（名称、使用此版式、所属母版、占位符勾选、背景、主题）可以直接照 Keynote 13 的节奏排版。Keynote 13 的分段选中态是白色凸起块，与 DS-35 的「安静样式」吻合。
6. **按选中对象让控件置灰，而不是隐藏**
   - 标杆做法：PowerPoint 选中母版时 Insert Placeholder、Title、Footers 置灰，选中版式时 Master Layout、Preserve 置灰（`ppt-03` 对比 `ppt-01`）；母版视图中 Notes 置灰但不隐藏（`ppt-18`）。
   - 对 v3：可以作为三条的标杆依据：入口不可用时置灰并写原因、不隐藏（前端 50/11 §3）；选中母版时「版式」范围不可用（rulings §4.10 Q16，03-26 §3、§4.1）；网格视图、备注置灰并写原因（03-26 §1.1）。v3 母版视图里底部工具条的「占位符 ▾」也照此按选中对象置灰并写原因。
7. **画布的占位符要一眼看出「是占位符」，正文五级要能看见**
   - 标杆做法：两家都用「提示文本」：PowerPoint 是虚线框加「Click to edit Master title style / Second level … Fifth level」，Keynote 是样例文字「Body Level One … Five」（`ppt-01`、`ppt-03`、`keynote-04`）。
   - 对 v3：画布的占位符应带类型提示文本，正文占位符显示 1–5 级样例，与 03-26 §5 占位符属性的「文本样式（大纲级别）」呼应。至于实线和虚线怎么分，见 §6。
8. **主题的改动集中在母版视图，所有版式即时联动**
   - 标杆做法：PowerPoint 在母版视图里改主题字体、配色，悬停实时预览，改完左栏全部缩略图一起变（`ppt-06`、`ppt-07`）。主题数据是 12 个色槽加标题、正文两级字体（`ppt-13`、`ppt-14`）。
   - 对 v3：PRD ML-04 与 03-28 §0 规定主题卡和弹层与普通视图共用，作用于当前母版，与 PowerPoint 的模型一致。弹层里的色槽和字体分组可以对照这两张图来画，用弹层，不用模态框。

## 6. 不适合照搬的地方及原因

- **PowerPoint 整条「Slide Master」功能区**（6 组、20 来个命令、组名、彩色大图标）：v3 已经取消 ribbon（DS-1、DS-5），命令分别落到左栏「新建版式」、底部工具条「占位符」、检查器各节和右键菜单（03-26 §1.2 去向表）。
- **红色 × 的「Close Master View」、橙色选中框、Keynote 的蓝色模式条和蓝色整块选中**：在 v3 里，红色表示危险操作，强调色只用于选中和焦点（DS-2、DS-24），次按钮是透明底细边（DS-37）。模式条可以学结构（名称加完成），不学配色。
- **只在悬停时显示使用页数，而且会截断**（`ppt-15`）：v3 是常驻显示「N 页 / 未使用」（PRD ML-01、03-26 §3），不要退回悬停。
- **编辑版式后要回普通视图「重新套用版式」**（PowerPoint 帮助）：与 v3 的「引用页 ≤500 ms 内更新、撤销一步回退」（PRD ML-03）相反。
- **模态对话框管名称和主题**（Rename Layout、Master Layout、主题色和字体对话框）：v3 的改名入口是检查器名称字段（TB-46），主题用弹层（PRD ML-04、03-28）。模态框只留给删除确认（DS-40，按 DS-142 的规格）。
- **状态栏写「Slide Master」**：v3 已取消状态栏（DS-6），模式标识只能靠横幅。
- **Keynote 新版的毛玻璃浮动侧栏和胶囊按钮**（macOS 26 / iPadOS 26）：用户已经否决毛玻璃和药丸按钮。
- **Keynote 没有母版层，可以把任意对象「定义为占位符」并打 Tag**：v3 必须保留「母版 → 版式」两级（PRD ML-01）和 OOXML 的占位符类型清单（DS-30、TB-34）。照搬属于规则变化，需另行裁决。
- **Keynote 删除被引用的版式时让用户挑替代版式**：v3 已经定为确认后按回退链自动换版式，可以撤销（rulings §4.20 FE-05、03-26 §8），也不加母版选择器（rulings §4.20 FE-23）。
- **Keynote 在 iPad、iPhone 上可以编辑版式**：v3 规定触控设备和窄屏不能进入（rulings §4.10 Q12、§4.25 TB-44），进入仅查看形态时会自动退出（rulings §4.18 UX-20、§4.25 TB-16）。PowerPoint 的「只有桌面能用」与 v3 一致。
- **两家都没有「版式 | 母版」范围切换，也都不在版式上区分继承和本地占位符**：PowerPoint 在左栏点母版缩略图就编辑母版，版式上继承来的图形只是背景，全部占位符一律画虚线。v3 的范围条（rulings §4.10 Q16）和「本版式实线、继承虚线加『母版 · 类型』标签」（当时 03-26 §4.2、§7 的画法，随 DS-21 拍板；PRD ML-01 原文）是 v3 自己加的设计，标杆里找不到对应。改版是否保留，**需用户裁决**；本组不改。

## 7. 没取到图的方面与原因

- **PowerPoint**：
  - 左栏右键菜单（官方只在文字里提到 Rename Layout、Copy、Paste）和 Master Layout 对话框：官方帮助没有截图。
  - 「使用情况」的悬停提示只找到第三方截图（`ppt-15`，原图 2026-11-12 公开前已移除）。
  - 现行版本（2025–2026）的 Mac 整窗母版视图：官方 Mac 图都是 2016 版局部，最新的只有 `ppt-18` 一条功能区。
  - 窄屏：iPad 和手机版没有母版视图，只收了最接近的「浮动工具条 › Layout」（`ppt-25`）。
- **Keynote**：
  - 现行版（14、15）Mac 的整窗模式条截图：官方只给了左上角局部（`keynote-02`），整窗加模式条只有 6.5 版（`keynote-01`）。
  - 版式模式下现行版 Format 栏的截图：只有 6.5 版的「Master Slide Layout」和 13 版普通编辑时的「Slide」面板。
  - 删除被引用版式时的替代选择框、改名时的行内输入状态：只有文字。
  - 「使用情况」：产品本身没有。
  - 主题色和字体编辑：产品本身没有。
  - Keynote for iCloud：不能编辑版式，只有文字证据（Apple 119885）。
- **视频**：Apple Support 没有找到讲编辑版式的官方视频；没有用第三方视频。

## 8. 主要出处

- Microsoft：
  - [Keep your presentation on-brand with Copilot](https://support.microsoft.com/en-us/powerpoint/copilot/keep-your-presentation-on-brand-with-copilot)
  - [Customize a slide master](https://support.microsoft.com/en-us/powerpoint/training/customize-a-slide-master)（含官方视频 Change slide masters）
  - [What is a slide master](https://support.microsoft.com/en-us/powerpoint/training/what-is-a-slide-master-in-powerpoint)
  - [Copy and paste a slide master](https://support.microsoft.com/en-us/powerpoint/copy-and-paste-a-slide-master-from-one-presentation-to-another)
  - [Create and save a PowerPoint template](https://support.microsoft.com/en-us/powerpoint/create-and-save-a-powerpoint-template)
  - [Troubleshoot footers](https://support.microsoft.com/en-us/powerpoint/troubleshoot-footers-in-powerpoint)
  - [Rename a slide layout](https://support.microsoft.com/en-us/powerpoint/rename-a-slide-layout)
  - [Edit and re-apply a slide layout](https://support.microsoft.com/en-us/powerpoint/edit-and-re-apply-a-slide-layout)
  - [Use multiple slide masters](https://support.microsoft.com/en-us/powerpoint/use-multiple-slide-masters-in-one-presentation)
  - [Use multiple themes](https://support.microsoft.com/en-us/powerpoint/use-multiple-themes-in-one-presentation)
  - [Create your own theme](https://support.microsoft.com/en-us/powerpoint/create-your-own-theme-in-powerpoint)
  - [Create a template](https://support.microsoft.com/en-us/word/create-a-template)
  - [Change footer formatting … for Mac](https://support.microsoft.com/en-us/powerpoint/change-footer-formatting-on-all-slides-in-powerpoint-for-mac)
  - [Add the same image or watermark to every slide](https://support.microsoft.com/en-us/powerpoint/add-the-same-image-or-watermark-to-every-slide)
  - [Choose the right view](https://support.microsoft.com/en-us/powerpoint/training/choose-the-right-view-for-the-task-in-powerpoint)
  - [Where’s the slide master?](https://support.microsoft.com/en-us/powerpoint/where-s-the-slide-master)
  - [Open Slide Master view](https://support.microsoft.com/en-us/office/open-slide-master-view-60533229-9207-4cd5-842b-f0f89935ca21)
  - [How certain features behave in web-based PowerPoint](https://support.microsoft.com/en-us/office/how-certain-features-behave-in-web-based-powerpoint-a931f0c8-1305-4428-8f7c-9cfa00ef28c5)
  - [Apply a slide layout](https://support.microsoft.com/en-us/powerpoint/training/apply-a-slide-layout)
  - [Microsoft 365 Insider：Use cameo placeholders](https://techcommunity.microsoft.com/blog/microsoft365insiderblog/use-cameo-placeholders-in-your-powerpoint-presentations/4222901)
- Apple：
  - [Add and edit slide layouts（Mac）](https://support.apple.com/guide/keynote/add-and-edit-slide-layouts-tan7a2b69972/mac)
  - [iPad 版](https://support.apple.com/guide/keynote-ipad/add-and-edit-slide-layouts-tan7a2b69972/ipados)
  - [iPhone 版](https://support.apple.com/guide/keynote-iphone/add-and-edit-slide-layouts-tan7a2b69972/ios)
  - [Keynote 6.5 帮助：Add and edit master slides](https://help.apple.com/keynote/mac/6.5/en.lproj/tan7a2b69972.html)
  - [Change the working view（13.0）](https://support.apple.com/guide/keynote/change-the-working-view-tanae4979928/13.0/mac/1.0)
  - [Apply a slide layout](https://support.apple.com/guide/keynote/apply-a-slide-layout-tan584189747/mac)
  - [Change a Keynote theme](https://support.apple.com/guide/keynote/change-a-theme-tan20c95bae6/mac)
  - [Create and manage Keynote themes](https://support.apple.com/guide/keynote/create-and-manage-custom-themes-tanb343cb739/mac)
  - [Change a slide background](https://support.apple.com/guide/keynote/change-a-slide-background-tan52c1cf827/mac)
  - [Get started with Keynote](https://support.apple.com/guide/keynote/get-started-with-keynote-tan115e144b4/mac)
  - [Set up your presentation in Keynote（119885）](https://support.apple.com/en-us/119885)
- 第三方（只用了 1 张）：[Indezine：Slidewise 1.3](https://blog.indezine.com/2021/10/slidewise-1-3-conversation-with-mike-power.html)
