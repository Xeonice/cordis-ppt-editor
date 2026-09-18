> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-14 | 依赖：charter v0.1

# ADR-0028 文本编辑宿主：单一隐藏 textarea + 自绘光标/选区

## 状态

提议。

## 背景

文本编辑必须：与 ADR-0027 的自有断行像素一致；直接写入 Store 的富文本类型（Univer A32：无第二份编辑缓冲）；支持 IME（中日韩输入法组合态）、移动端虚拟键盘、基本 a11y；协同下光标随 RelativePosition 稳定。

## 决策

1. 每个 Unit 的 Surface 只有 **一个隐藏 `<textarea>`**（`render-dom/text-host`），聚焦即进入文本编辑；光标、选区高亮、组合中文本全部**自绘**在 overlay 层。
2. 事件 → Mutation：`beforeinput`（`insertText`/`deleteContent*`/`insertParagraph`/`insertFromPaste`）与非字符 `keydown`（导航/快捷键）转为命令；`compositionstart/update/end` 维持瞬态组合串，`compositionend` 才提交一次 `text.insert` 事务。
3. IME 候选窗定位：把 textarea 移到光标的像素位置（1×1、透明），组合期间跟随。
4. a11y 镜像：textarea 的值 = 当前段落纯文本，选区同步；`aria-activedescendant` 指向当前形状；只读态暴露 `role=document` 的语义文本树。
5. 文本几何来自 `CaretMap`（engine-layout）；远端光标同路径渲染。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 每个文本框 `contenteditable`（HTML 文本） | 浏览器自行排版与我们的行模型冲突；DOM 变更反推为 Y 操作极易出错（ProseMirror 用数万行解决此问题）；`foreignObject` 内 contenteditable 在 Safari 不稳定；协同光标映射困难 |
| 引入 ProseMirror（y-prosemirror）承载每个文本框 | 成熟的协同富文本编辑，但仍是 HTML 排版（与自绘 SVG 文本不一致）、每文本框一个编辑器实例的内存/初始化成本、与 PowerPoint 段落/run 模型的 schema 映射额外一层；作为**备选升级路径**保留：若 a11y 要求超出镜像方案，可在「a11y 模式」用 PM 渲染当前文本框 |
| 单一 `contenteditable` 镜像（Google Docs 早期）而非 textarea | 语音输入/拼写检查行为更接近原生，但 contenteditable 的 `beforeinput` 覆盖差异更大，textarea 更可控；两者可切换，实现细节不影响契约 |
| 原生 SVG `<text>` 直接可编辑 | 浏览器不支持 |

## 后果

正面：编辑态与只读态一致；输入事件直接写 Store（A32）；协同映射简单；跨浏览器行为可控；移动端可用。

负面 / 代价：
- a11y 为「段落级朗读」而非原生富文本编辑体验（R2 待决级别）。
- 拼写检查/自动更正需自行接入或关闭（textarea `spellcheck` 只作用于镜像段落，可利用之显示下划线）。
- 组合态下的远端并发插入：组合完成后按 RelativePosition 锚点插入，位置正确但用户可能看到组合串短暂位移；可接受。
- 需要完整的键盘导航实现（方向键跨行/跨段落/跨形状、Home/End、Shift 选区、Ctrl 词跳）——在 slide-ui/ui-core 的输入管线中实现（05/ui），这里只提供 `CaretMap` 与选区 API。

## 补充（v0.2）：IME 宿主 spike 计划（PRD R-M2-1，M2 首要风险）

- **可替换性**：`TextInputHost` 是 `render-dom` 内的 Definition（贡献点 `render.textInputHost`，key = id），两个 Provider：`hidden-textarea`（本 ADR 默认）与 `contenteditable-mirror`（02 §4.15 `ime-host.ts` 的形态，备选）。spike 结束前两者并存，preset 选择。
- **时间盒**：M2 第 1 月，2 名工程师，2 周。
- **范围**：Chrome/Edge/Firefox/Safari（macOS）+ iOS Safari + Android Chrome；输入法：中文拼音（Windows 微软拼音、macOS 简体拼音、搜狗）、日文（Windows IME、macOS 日本語）、韩文；场景：段中输入、行尾换行处输入、跨 run 边界输入、选区替换、候选窗定位跟随缩放/滚动、组合中远端并发插入、撤销粒度。
- **退出标准**：(1) 全部场景无丢字/重复字；(2) 候选窗与光标像素偏差 ≤ 4 px；(3) IME 组合更新 p95 ≤ 80 ms（NF-01 1.2）；(4) `compositionend` 恰一次事务；(5) VoiceOver/NVDA 可朗读当前段落并跟随光标；(6) 双 Provider 在 spike 场景矩阵上的通过率对比表。
- **决策规则**：`hidden-textarea` 通过全部退出标准 → 定稿并把 `contenteditable-mirror` 降为兼容备选；若 Safari/iOS 上仅 contenteditable 通过 → 按 UA 选择 Provider（同一 Definition），不改契约。
- **产出**：`test/e2e/specs/ime/*.spec.ts`（Playwright 合成组合事件 + 真机手测清单）、spike 报告回写本 ADR 状态。

## 如何被机械验证

- vitest browser mode：合成 `compositionstart/update/end` 序列 → 恰一次事务，中间无 Store 写入；`beforeinput insertText` 每字一次事务且被 captureTimeout 合并为一个撤销步。
- e2e（Playwright）：中文输入法模拟（`page.keyboard.insertText` + 组合事件）、移动端视口聚焦弹出键盘（Chromium 模拟）。
- 一致性：编辑中截图与失焦后截图像素相同（除光标/选区层）。
- a11y 自动化（axe）：可聚焦、有名称、只读语义树存在。

## 关联

Univer A32；ADR-0021/0027/0024；架构 07 §6、05（命令管线）；设计 20-design/07。
