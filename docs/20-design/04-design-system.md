> 状态：草稿 v0.5 | 负责：设计 | 更新：2026-09-19；2026-09-24（rulings §4.15 收口：§3 与 §6 K7 行的「命名空间属性待定」按 C-21 结案表述） | 依赖：charter v0.2（D10 修订）、09-design-specification v3.1、rulings §4.8–§4.10；可执行取值源 `playground/src/index.css`
>
> v0.5 修订（2026-09-18）：§2.2 / §2.3 色板按 `index.css` 现值回写并括注 shadcn 变量（与 §9 一致）；§2.6 对比度按现值重算；§2.8 字体改 `'Geist Variable'` 优先；§2.13 Ribbon 高度改 页签行 36 + 内容区 91（旧值 88 / 64 作废）；§2.14 图标改 Lucide 线性（删 Phosphor / SVG sprite）；§3 补 playground 主题选择器约定（`.dark` class + 宿主 `data-theme` 兼容）；§5 断点表与信息架构 §6 逐格对齐；§7 历史表述加"原"标注、"母版树"改"母版缩略图窗格"；§9 追加 v0.5 条目。

# 04 设计系统（Design System）

本文档定义 `@cordexjs/design`（L7，零依赖，见架构 §5.2）导出的 token 体系与原子组件清单，以及 `@cordexjs/ui-core`/`@cordexjs/ui-react` 之上组合而成的复合组件清单。所有 token 以 CSS 自定义属性（`--cordex-*`）发布，这是 `@cordexjs/design` 对外的**唯一契约**（K7：零依赖，token 覆盖非颜色维度）。前端工程师应能直接以本节的表格作为 `@cordexjs/design` 的实现基线。

---

## 1. 设计原则回顾（对 token 体系的约束）

1. **token 化优先**：任何在两个以上组件中出现的视觉数值（颜色、间距、圆角、阴影、层级、时长）必须来自 token，禁止组件内魔法数字。
2. **零依赖**：`@cordexjs/design` 不依赖 React/cordis/任何框架；仅导出 CSS（token + 原子组件类名/极少量无框架 Web Component 或纯 CSS 类）与类型化的 token 常量（供 JS 侧读取，如图表插件取色）。架构 02 §4.18 的依赖规则机械保证这一点：`ui-core` 对 `@cordexjs/design` 只允许 `.css` 与 type-only import（depcruise 规则 `ui-core-no-react` 的姊妹规则），任何运行时 JS 依赖都会被 CI 拦截。
3. **语义先于数值**：组件永远引用语义 token（如 `--cordex-color-text-primary`），不得直接引用调色板原语（如 `--cordex-palette-gray-900`）。调色板原语只在 token 定义文件内部使用。
4. **暗色不是反色**：暗色主题的语义 token 单独指定数值，不是对亮色简单取反或降低透明度。
5. **不牺牲对比度换取美观**：所有语义配对必须满足 §2.6 的对比度基线，与 07-accessibility-and-i18n.md 一致。

---

## 2. Token 体系

### 2.1 颜色 —— 调色板原语（Palette Primitives）

调色板原语不直接用于组件，仅作为语义 token 的取值来源，避免语义 token 定义分散。

| 原语组 | 步进 | 值（十六进制） |
|---|---|---|
| `--cordex-palette-gray-100` … `900` | 100/200/300/400/500/600/700/800/900 | `#F5F6F8` `#E9EBEF` `#D7DBE2` `#B7BEC9` `#8A93A2` `#667085` `#4A5468` `#2E3648` `#1A2030` |
| `--cordex-palette-accent-100` … `900` | 同上 | `#E8EAFD` `#C7CCFA` `#9CA4F5` `#6B93FF` `#3A5CE6` `#3A3FC4` `#2C2FA0` `#21237A` `#171854` |
| `--cordex-palette-success-100/500/700` | 3 档 | `#E6F6ED` `#1E9E5A` `#146B3D` |
| `--cordex-palette-warning-100/500/700` | 3 档 | `#FFF4E0` `#B76E00` `#8A5300` |
| `--cordex-palette-danger-100/500/700` | 3 档 | `#FDEAEA` `#D92D20` `#A11C10` |
| `--cordex-palette-info-100/500/700` | 3 档 | `#E7F1FE` `#1570CF` `#0C4A93` |
| `--cordex-palette-presence-1..12` | 12 色，协作者专用，见 §2.4（PRD CO-03 要求 12 色板；2026-09-15 UX 评审后 7 色按 WCAG 对比度脚本核算替换，见 §2.4/§2.6） | `#8B5CF6` `#DB2777` `#D9480F` `#B45309` `#0E8A7A` `#0B7FBF` `#C026D3` `#64748B` `#7C3AED` `#BE185D` `#C2410C` `#0F766E` |

`accent`（靛蓝）为产品强调色，用于主操作按钮、选中态、链接、品牌焦点，不与任何语义色（success/warning/danger/info）或协作者色（presence）复用色相，避免"这是错误还是选中？"的语义混淆。gray-500 `#8A93A2` 自 2026-09-16 起不再作 `border-control` / 字段填充（`--input`）的取值（现 `#A3ABB9` / `#DFE3EA`，见 §2.2、§9），仅保留为调色板原语与 `text-disabled` 的核算基线。

### 2.2 颜色 —— 语义 token（亮色 `:root` 默认值）

> 2026-09-18（v0.5）：取值按 `playground/src/index.css` `:root` 现值回写，**与 §9 一致**；括注"= `--x`"为对应的 shadcn 变量名（§8），实现层以该变量为准，`--cordex-*` 名仅作取值来源与对比度核算记录。

| token | 亮色值 | 用途 |
|---|---|---|
| `--cordex-color-bg-canvas` | `#EEF1F8`（= `--canvas`；原 `#EDEFF3` 作废，2026-09-16 随材质层改冷蓝灰并叠 `--canvas-glow` 光斑，见 09 §6.2） | 画布视口背景 / `body` 背景层（幻灯片之外的留白区） |
| `--cordex-color-bg-surface` | `#FFFFFF`（= `--background`） | 不透明面板默认表面；玻璃态面板另见 09 §6 |
| `--cordex-color-bg-surface-raised` | `#FFFFFF`（= `--card` / `--popover`） | 浮层退化态（不支持 / 关闭透明时）的面板底；正常态浮层为 `glass-strong` |
| `--cordex-color-bg-inset` | `#F5F6F8`（=gray-100；= `--muted`） | 凹陷 / 弱化表面（说明块、Tabs 轨道退化态）；输入框填充改用下行 `bg-field` |
| `--cordex-color-bg-field` | `#DFE3EA`（= `--input`，**2026-09-16 新增**：Rhea 把 `--input` 当"字段填充基色"，Input / Select / Textarea / InputGroup 以 `bg-input/50` 叠白 ≈ `#EFF1F4` 填充、`border-transparent`；原按 3:1 描边取的 gray-500 `#8A93A2` 叠白后成 `#C4C9D0` 重灰、像禁用态，作废） | 字段填充；悬停 64%、聚焦转 `--card`（09 §2） |
| `--cordex-color-bg-secondary` | `#F5F6F8`（= `--secondary`，新增映射） | 次要按钮底 |
| `--cordex-color-bg-overlay-scrim` | `rgba(26,32,48,0.45)` | 对话框背后的遮罩 |
| `--cordex-color-bg-selected` | `#E8EAFD`（=accent-100；shadcn 层无同名变量——Toggle / Tabs 选中态由 `[data-slot]` 规则用前景 8% 底 / `--card` 表达，Ribbon 大按钮按下态 `bg-accent`，首页导航当前项 `bg-primary/10`，见 09 §2） | 列表/菜单项选中背景（保留供核算） |
| `--cordex-color-bg-hover` | `#EEF0F4`（= `--accent`；原 `rgba(26,32,48,0.05)` 作废） | 菜单项 / 列表 hover 高亮（比 muted 再亮一档） |
| `--cordex-color-border-subtle` | `#E4E7EC`（= `--border`；原 `#E9EBEF`=gray-200 作废；白底 1.24:1） | 仅列表内发丝线与退化态边框（09 S-09：不用边到边分区线）；不达 3:1，仅作视觉分割，不承载"这是一个可交互控件"的语义 |
| `--cordex-color-border-default` | `#D7DBE2`（=gray-300，白底 1.39:1） | **仅**分隔线与非必要边框；不得用于表单控件（不达 WCAG 1.4.11 的 3:1），控件边界改用 `border-control` |
| `--cordex-color-border-control` | `#757F8F`（= `--border-control`；2026-09-18 用户裁决由 `#A3ABB9` 提高：白底 4.05:1、画布 3.58:1、字段填充 3.14:1，满足 1.4.11；此前 2026-09-16 由 gray-500 `#8A93A2` 改为 `#A3ABB9` 时仅 2.3:1） | 描边型控件边界（outline 分段、主题切换）；字段本身用 `--input` 填充、透明描边 |
| `--cordex-color-border-strong` | `#8A93A2`（=gray-500，白底 3.10:1；未映射 shadcn 变量） | 仅为 09 §6.3 `prefers-contrast: more` 描边预留（待实现）；画布选中框实际用 `border-primary` |
| `--cordex-color-border-focus` | `#3A5CE6`（=accent-500；= `--ring`；2026-09-16 去紫修订，原 `#4A54E1`） | 焦点环、当前编辑态边框 |
| `--cordex-color-text-primary` | `#1A2030`（=gray-900；= `--foreground`） | 主文字 |
| `--cordex-color-text-secondary` | `#4A5468`（=gray-700；shadcn 层无同名变量，实现以 `text-foreground/80` 近似） | 次要文字（说明、时间戳） |
| `--cordex-color-text-tertiary` | `#5F6B80`（= `--muted-foreground`；2026-09-16 由 `#667085` 加深：白底 5.38:1、字段填充 `#EFF1F4` 上 4.76:1、glass-strong 上 ≈ 5.3:1；此前 2026-09-15 曾由 gray-500 `#8A93A2` 3.10:1 改正为 `#667085` 4.97:1，现均作废） | 占位符、说明性小字；**gray-500 (`#8A93A2`) 之后只作装饰/禁用用，不再直接做可读文字** |
| `--cordex-color-text-disabled` | `#8A93A2`（=gray-500，白底 3.10:1；2026-09-15 由 `#B7BEC9` 1.87:1 改正——原值违反 07 §8 的 ≥3:1 底线；shadcn / Rhea 无独立 disabled 色，实现为 `disabled:opacity-50`，本值仅作核算基线） | 禁用态文字；**禁用态不得只靠颜色表达**，必须同时施加 `opacity: 0.5` + `cursor: not-allowed` + `aria-disabled="true"`（规则 disabled-states，见 §4.1） |
| `--cordex-color-text-inverse` | `#FFFFFF` | 深色/强调色背景之上的文字 |
| `--cordex-color-text-link` | `#3A3FC4`（=accent-600） | 链接文字 |
| `--cordex-color-accent-default` | `#3A5CE6`（=accent-500；= `--primary`，白字 5.45:1、画布底 4.82:1；2026-09-16 去紫修订，原 `#4A54E1`） | 主操作按钮背景、开关开启态、当前页环、链接 |
| `--cordex-color-accent-hover` | `#3A3FC4`（=accent-600） | 主操作 hover |
| `--cordex-color-accent-active` | `#2C2FA0`（=accent-700） | 主操作按下 |
| `--cordex-color-accent-subtle` | `#E8EAFD`（=accent-100） | 强调色的弱化背景（选中的 ribbon 按钮） |
| `--cordex-color-success-default/subtle/emphasis` | `#1E9E5A` / `#E6F6ED` / `#146B3D`（白底 6.56:1） | `default`=图标/边框/填充；`subtle`=提示条/徽标背景；**`emphasis`=文字**（"已保存""已解决"等成功态文字一律用 emphasis，见 §2.5） |
| `--cordex-color-warning-default/subtle/emphasis` | `#B76E00` / `#FFF4E0` / `#8A5300`（白底 6.33:1） | 同上分工；离线/需注意场景的文字用 emphasis |
| `--cordex-color-danger-default/subtle/emphasis` | `#D92D20` / `#FDEAEA` / `#A11C10` | 同上分工；错误/删除文字用 emphasis，不用 default |
| `--cordex-color-info-default/subtle/emphasis` | `#1570CF` / `#E7F1FE` / `#0C4A93` | 同上分工 |
| `--cordex-color-focus-ring` | `#3A5CE6` | `:focus-visible` 外环颜色，见 07 |
| `--cordex-color-selection-self` | `--cordex-color-accent-default` | 画布中"我"的选中框 |
| `--cordex-color-selection-remote-fill` | `color-mix(in srgb, var(--cordex-color-presence-current) 12%, transparent)` | 远端选区半透明填充（`--cordex-color-presence-current` 由渲染时按用户动态赋值为下列 presence-N 之一） |

### 2.2a 文档内容与舞台色（与主题无关，2026-09-15 新增）

以下 token **不随亮/暗主题切换**，在 `:root` 与两套暗色覆盖块中取值相同——理由：文档内容（幻灯片纸面）与放映舞台是**数据**，不是编辑器 chrome，用户不会因为把编辑器切成暗色主题就希望幻灯片纸面本身变黑（这与 07-accessibility-and-i18n.md §6 RTL 一节"画布内容不随编辑器方向镜像"是同一原则的颜色维度版本）：

| token | 值 | 用途 |
|---|---|---|
| `--cordex-color-doc-paper` | `#FFFFFF` | 幻灯片画布本身的默认纸面色（未设置背景时） |
| `--cordex-color-doc-ink` | `#1A2030` | 幻灯片默认文字色（未显式设置颜色时的回退） |
| `--cordex-color-stage-bg` | `#0A0A0A` | 放映模式的舞台背景（03-screens/11） |
| `--cordex-color-stage-chrome` | `rgba(22,22,22,.85)` | 放映模式浮动控制条背景 |
| `--cordex-color-stage-fg` | `#FFFFFF` | 放映模式浮动控制条文字/图标 |

组件内**禁止裸写十六进制色值**（规则 color-semantic）：放映模式与画布纸面必须引用以上 token，不得直接写 `#000`/`#fff` 等字面量，即使视觉上恰好与亮色主题的某个语义 token 相同——因为它们的"不随主题切换"是语义保证，与恰好同值的可切换 token 混用会在未来改主题时悄悄出错。

### 2.3 颜色 —— 暗色主题覆盖

暗色语义值仅覆盖以下 token（未列出的语义 token 沿用同名变量，但取值随下表变化；调色板原语在暗色下不整体翻转，而是补充暗色专属取值，见右列）：

> 2026-09-18（v0.5）：取值按 `playground/src/index.css` `.dark` 块现值回写，**与 §9 一致**（暗色填充类 token 必须比表面更亮，2026-09-16 极性修正）；括注为对应的 shadcn 变量名。

| token | 暗色值 |
|---|---|
| `--cordex-color-bg-canvas` | `#101523`（= `--canvas`；原 `#0B0F19` 作废，现仅为 `--canvas-glow` 线性渐变终点） |
| `--cordex-color-bg-surface` | `#151A26`（= `--background`） |
| `--cordex-color-bg-surface-raised` | `#1C2233`（= `--card` / `--popover`） |
| `--cordex-color-bg-inset` | `#232A3B`（= `--muted`；原 `#0F1420` 作废——比玻璃表面 ≈ `#192031` 更暗，使 Rhea 填充式选中态呈"凹陷黑洞"，2026-09-16 极性修正，见 §9；`text-tertiary` 在其上 4.68:1） |
| `--cordex-color-bg-field` | `#6B7689`（= `--input`，暗色字段填充基色，以 50% 叠加于表面） |
| `--cordex-color-bg-secondary` | `#262E40`（= `--secondary`） |
| `--cordex-color-bg-overlay-scrim` | `rgba(3,5,10,0.6)` |
| `--cordex-color-bg-selected` | `#2B2A88`（=accent-800，降低饱和以适配暗底；shadcn 层无同名变量，暗色选中态由 `[data-slot]` 规则用白 14% 底 + 内高光表达，见 09 §2） |
| `--cordex-color-bg-hover` | `#2C3548`（= `--accent`；原 `rgba(255,255,255,0.06)` 作废） |
| `--cordex-color-border-subtle` | `#2A3245`（= `--border`；原 `#232A3B` 作废） |
| `--cordex-color-border-default` | `#323A4E`（仅分隔线，同亮色规则不用于控件） |
| `--cordex-color-border-control` | `#6B7689`（= `--border-control`；暗表面 `#151A26` 底 3.79:1；2026-09-15 新增） |
| `--cordex-color-border-strong` | `#7A8599`（暗表面底 4.67:1；2026-09-15 由 `#5A6479` 2.93:1 改正——不达 3:1） |
| `--cordex-color-border-focus` | `#7DA2FF`（= `--ring`；暗表面 7.0:1，暗底提亮以维持对比度；2026-09-16 去紫修订，原 `#7B82FF`） |
| `--cordex-color-text-primary` | `#F1F3F8`（= `--foreground`） |
| `--cordex-color-text-secondary` | `#B7BEC9` |
| `--cordex-color-text-tertiary` | `#8A94A6`（= `--muted-foreground`；暗表面 5.69:1、`--muted` 上 4.68:1、glass-strong 上 ≈ 5.4:1；2026-09-16 由 `#7C8697` 提亮，原值 ≈ 4.45:1 不达标，见 09 §6.5） |
| `--cordex-color-text-disabled` | `#6B7689`（暗表面底 3.79:1；2026-09-15 由 `#4A5468` 2.28:1 改正——不达 3:1；与 `border-control` 同值，语义不同） |
| `--cordex-color-text-inverse` | `#101425` |
| `--cordex-color-text-link` | `#9CA4F5`（=accent-300） |
| `--cordex-color-accent-default` | `#6B93FF`（=accent-400；= `--primary`，暗表面 6.0:1，配 `--primary-foreground #101425` 6.3:1；2026-09-16 去紫修订，原 `#6F79EE`） |
| `--cordex-color-accent-hover` | `#8790F5` |
| `--cordex-color-accent-active` | `#9CA4F5` |
| `--cordex-color-accent-subtle` | `#232A5E` |
| `--cordex-color-success-default/subtle/emphasis` | `#3BC682` / `rgba(59,198,130,.16)` / `#8DF0BB`（暗表面底 ≈12.7:1；2026-09-15 补齐——§2.5 新规则要求语义文字必须能引用暗色 emphasis，此前版本缺失会静默回退到亮色值） |
| `--cordex-color-warning-default/subtle/emphasis` | `#E2A33D` / `rgba(226,163,61,.16)` / `#F3C578` |
| `--cordex-color-danger-default/subtle/emphasis` | `#F0685E` / `rgba(240,104,94,.16)` / `#F8A69F` |
| `--cordex-color-info-default/subtle/emphasis` | `#5AA6EE` / `rgba(90,166,238,.16)` / `#9AC8F5` |

阴影在暗色下普遍不可见，暗色表面改用「浅色描边 + 略深阴影」共同表达层级（见 §2.7 阴影表的暗色列）。

### 2.4 协作者在场色（Presence Palette）

12 色循环调色板（PRD CO-03 明确"按用户 id 稳定哈希分配 12 色板"；此前版本按经验值定为 8 色，现已按产品需求扩充为 12 色），专用于协作者头像环、远端光标、远端选区，**不得**用于其他 UI 语义（避免用户把协作者颜色误读为状态色）：

`--cordex-color-presence-1` … `--cordex-color-presence-12` = 调色板原语 `presence-1..12`（§2.1）。新增的 9–12 号为 1/2/3/5 号的深色调变体（深紫/深玫红/深橙棕/深青），在保持与前 8 色视觉关联的同时提供更多可辨识的档位。

分配规则（详见 05-collaboration-ux.md §2）：按 `hash(userId) mod 12` 取初始色，若与当前会话内已在场的相邻协作者颜色冲突则顺延下一个索引；第 13 位及以上协作者复用编号但在头像上叠加序号角标以区分（PRD CO-03：房间容量上限 ≤ 20 编辑者，因此实践中很少需要复用）。亮/暗主题下 presence 色值保持一致（不随主题切换），但描边（头像环）在暗色下改用 2px 描边 + 8% 提亮，避免深色背景下饱和色显得刺眼。

### 2.5 语义色使用矩阵

| 语义 | default 用于（仅图标/边框/填充，≥ 3:1 即可） | subtle 用于 | emphasis 用于（**所有文字**，≥ 4.5:1） |
|---|---|---|---|
| success | 图标、边框、状态点 | 提示条/徽标背景 | "已保存""已完成"等全部成功文字 |
| warning | 离线横幅图标、边框、评论钉填充 | 离线横幅背景 | 警示文字、评论钉上的编号（白字压在 emphasis 上） |
| danger | 错误图标、边框 | 错误提示背景、销毁性操作确认卡片背景 | 删除类菜单项文字、"此操作不可撤销"等 |
| info | 同步中图标 | 提示条背景 | 同步中文字 |

> **规则（2026-09-15 UX 评审）**：`*-default` 一律不得用于 18.66px 以下的文字——亮色 success-default 白底仅 3.45:1、warning-default 仅 4.00:1；文字必须引用 `*-emphasis`（success-emphasis 6.56:1、warning-emphasis 6.33:1、danger-emphasis 7.81:1）。反例：原型早期"已保存 ✓"用 success-default、评论钉用 warning-default 底白字，均已改正。

### 2.6 对比度基线（与 07-accessibility-and-i18n.md 对齐）

| 配对 | 最低比值 | 说明 |
|---|---|---|
| `text-primary` / `bg-surface` | ≥ 7:1 | 正文文字 |
| `text-secondary` / `bg-surface` | ≥ 4.5:1 | 次要文字 |
| `text-inverse` / `accent-default` | ≥ 4.5:1 | 主按钮文字 |
| `text-tertiary` / `bg-surface` 与 `bg-field` | ≥ 4.5:1 | 说明/时间戳/占位文字：现值 `#5F6B80` 白底 5.38 / 字段填充 4.76（2026-09-16）；历史：2026-09-15 曾由 `#8A93A2` 改为 `#667085`（4.97 / 4.60），现作废 |
| 任一 `*-emphasis` / `bg-surface` | ≥ 4.5:1 | 语义色文字（§2.5 规则） |
| `text-disabled` / `bg-surface` | ≥ 3:1 | 禁用态文字仍需可辨识（07 §8）；亮 3.10、暗 3.79 |
| `border-control` / `bg-surface` | ≥ 3:1 | 描边型控件边界（WCAG 1.4.11）；亮色 `#757F8F` 白底 4.05:1 / 画布 3.58:1 / 字段填充 3.14:1（2026-09-18 提高后达标）、暗色 `#6B7689` 3.97:1（accent 悬停面 2.68:1，M2 复核） |
| `border-focus` / 相邻背景 | ≥ 3:1 | 焦点环（图形对象对比度基线） |
| 任一 `presence-*` / `bg-canvas`（亮 **与** 暗） | ≥ 3:1 | 远端光标可辨识性；两套画布分别验证，新增协作者色前必须复核；另用 1px `bg-surface` 描边与名字标签"表面底 + presence 边框 + text-primary 文字"做对比度无关化 |

对比度以脚本核算（WCAG 相对亮度公式），核算结果与验证脚本约定见 07 §8；任何 token 取值变更必须附核算结果。

### 2.7 间距（Spacing）

4px 基准，`rem`（根字号 16px）：

| token | 值 | px |
|---|---|---|
| `--cordex-space-0` | `0` | 0 |
| `--cordex-space-1` | `0.25rem` | 4 |
| `--cordex-space-2` | `0.5rem` | 8 |
| `--cordex-space-3` | `0.75rem` | 12 |
| `--cordex-space-4` | `1rem` | 16 |
| `--cordex-space-5` | `1.25rem` | 20 |
| `--cordex-space-6` | `1.5rem` | 24 |
| `--cordex-space-8` | `2rem` | 32 |
| `--cordex-space-10` | `2.5rem` | 40 |
| `--cordex-space-12` | `3rem` | 48 |
| `--cordex-space-16` | `4rem` | 64 |

用法约定：控件内部 padding 用 1–3；组件之间 gap 用 3–5；区域级留白（面板内边距、对话框内边距）用 4–6；页面级留白用 6–12。原型的外层容器左右内边距使用 `--cordex-space-4`（16px）作为窄屏最小值，见 §5。

### 2.8 字号与行高

| token | 字号 | 行高 | 用途 |
|---|---|---|---|
| `--cordex-font-size-2xs` / `--cordex-line-height-2xs` | 0.6875rem(11px) | 1rem(16px) | **仅限**徽标、kbd 键帽、槽位标签、角标计数；不得用于可读说明文字（2026-09-15 新增；此前原型出现 9–10px 裸字号，已清除） |
| `--cordex-font-size-xs` / `--cordex-line-height-xs` | 0.75rem(12px) | 1rem(16px) | 时间戳、状态栏、说明文字的最小字号 |
| `--cordex-font-size-sm` / `--cordex-line-height-sm` | 0.8125rem(13px) | 1.125rem(18px) | 菜单项、ribbon 按钮标签、表格单元 |
| `--cordex-font-size-base` / `--cordex-line-height-base` | 0.875rem(14px) | 1.25rem(20px) | 编辑器 chrome 默认正文（属性面板、对话框正文） |
| `--cordex-font-size-md` / `--cordex-line-height-md` | 1rem(16px) | 1.5rem(24px) | 评论正文、列表主标题 |
| `--cordex-font-size-lg` / `--cordex-line-height-lg` | 1.125rem(18px) | 1.75rem(28px) | 面板/分区标题 |
| `--cordex-font-size-xl` / `--cordex-line-height-xl` | 1.25rem(20px) | 1.75rem(28px) | 对话框标题 |
| `--cordex-font-size-2xl` / `--cordex-line-height-2xl` | 1.5rem(24px) | 2rem(32px) | 空状态标题 |
| `--cordex-font-size-3xl` / `--cordex-line-height-3xl` | 1.875rem(30px) | 2.25rem(36px) | 文档列表大标题（应用壳） |

字重：`--cordex-font-weight-regular`(400) / `-medium`(500) / `-semibold`(600) / `-bold`(700)。

字族：`--cordex-font-family-ui`（= Tailwind `--font-sans`，`--font-heading` 同值，`index.css` L10）`: 'Geist Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif` —— 用户裁决 2026-09-16 Q6 **保留 Geist**：`'Geist Variable'` 优先 → 系统字体 → PingFang SC / Microsoft YaHei 回退（CJK 仍走系统字体）；Geist 为 SIL OFL 1.1，经 `@fontsource-variable/geist` 随包自托管、不外链，因此 2026-09-15 "系统字体优先，规避外链字体许可与加载成本"的原裁决在自托管前提下作废；`--cordex-font-family-mono`（用于版本号、文件路径、错误码）：`ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`。

> 注：以上是**编辑器 chrome**（UI 外壳）的字号 token，不用于**文档内容**（幻灯片内文字）。文档内容字号来自 `model-slide` 的文本样式（pt 单位），与本 token 体系无关，避免"改 UI 主题影响文档呈现"的错误耦合。

### 2.9 圆角

| token | 值 | 用途 |
|---|---|---|
| `--cordex-radius-none` | 0 | 贴边元素（横幅、状态栏） |
| `--cordex-radius-sm` | 4px | 徽标、小按钮、输入框 |
| `--cordex-radius-md` | 6px | 按钮、卡片、菜单项 |
| `--cordex-radius-lg` | 8px | 面板、对话框、弹出菜单 |
| `--cordex-radius-xl` | 12px | 大卡片（文档列表卡片） |
| `--cordex-radius-full` | 9999px | 头像、开关、圆形按钮 |

### 2.10 阴影（Elevation）

| token | 亮色值 | 暗色值（描边+弱阴影） | 用途 |
|---|---|---|---|
| `--cordex-shadow-sm` | `0 1px 2px rgba(16,24,40,.06)` | `0 0 0 1px var(--cordex-color-border-subtle)` | 卡片、输入框 focus 之外的静态层级 |
| `--cordex-shadow-md` | `0 2px 8px rgba(16,24,40,.10)` | `0 0 0 1px var(--cordex-color-border-default), 0 2px 8px rgba(0,0,0,.4)` | 下拉菜单、工具提示 |
| `--cordex-shadow-lg` | `0 8px 24px rgba(16,24,40,.14)` | `0 0 0 1px var(--cordex-color-border-default), 0 8px 24px rgba(0,0,0,.5)` | 弹出面板、右键菜单 |
| `--cordex-shadow-xl` | `0 16px 48px rgba(16,24,40,.18)` | `0 0 0 1px var(--cordex-color-border-default), 0 16px 48px rgba(0,0,0,.6)` | 对话框、命令面板 |

### 2.11 z-index 尺度

统一层级 token，禁止组件自行硬编码数字（呼应类型治理对"魔法数字"的一般性约束）：

```
0    --cordex-z-canvas            画布内容本身
10   --cordex-z-canvas-overlay    远端光标/选区、评论锚点、选中手柄（render.overlay 贡献，见设计 06）
20   --cordex-z-chrome            ribbon、缩略图侧栏、检查器坞、状态栏（常驻外壳）
100  --cordex-z-dropdown          下拉菜单、flyout 画廊（插入形状网格等）
110  --cordex-z-popover           弹出框（颜色选择器、@提及建议）
120  --cordex-z-sticky            吸顶元素（如横幅固定在 chrome 之上时）
300  --cordex-z-toast             通知 toast
400  --cordex-z-modal-backdrop    对话框遮罩
410  --cordex-z-modal             对话框本体
500  --cordex-z-command-palette   命令面板（须盖过对话框，允许"对话框打开时仍可呼出命令面板"这一可选高级行为预留层级空间）
600  --cordex-z-tooltip           工具提示（最高层，任何上下文都必须可读）
```

### 2.12 动效

| token | 值 | 用途 |
|---|---|---|
| `--cordex-motion-duration-instant` | 80ms | hover 态切换 |
| `--cordex-motion-duration-fast` | 120ms | 按钮按下、菜单项高亮 |
| `--cordex-motion-duration-base` | 180ms | 菜单/面板展开收起、横幅进出 |
| `--cordex-motion-duration-slow` | 240ms | 对话框、命令面板 |
| `--cordex-motion-duration-slower` | 320ms | 缩略图重排、页面切换预览 |
| `--cordex-motion-ease-standard` | `cubic-bezier(.2,0,0,1)` | 默认曲线 |
| `--cordex-motion-ease-decelerate` | `cubic-bezier(0,0,0,1)` | 进入（展开/淡入） |
| `--cordex-motion-ease-accelerate` | `cubic-bezier(.3,0,1,1)` | 退出（收起/淡出） |
| `--cordex-motion-ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | 少量强调动效（新协作者头像出现），克制使用 |

`prefers-reduced-motion: reduce` 时，所有 duration token 由 `@cordexjs/design` 在根节点统一降为 `1ms`（而非组件各自判断），细则见 07-accessibility-and-i18n.md §5。

### 2.13 密度模式（Density）

密度只重映射"控件尺寸"相关的一小簇 token，不改变字号/颜色，避免密度切换时视觉体系跳变：

| token | 舒适（默认，`data-cordex-density="comfortable"` 或未设置） | 紧凑（`data-cordex-density="compact"`） |
|---|---|---|
| `--cordex-control-height-sm` | 28px | 24px |
| `--cordex-control-height-md` | 32px | 28px |
| `--cordex-control-height-lg` | 40px | 32px |
| `--cordex-control-padding-x` | `--cordex-space-3`(12px) | `--cordex-space-2`(8px) |
| `--cordex-row-height` | 36px | 28px |
| `--cordex-ribbon-height` | 页签行 36 + 内容区 91 = 127（组 `self-stretch` 83；小控件 28、堆叠行距 4、大按钮 56×60；原 88px 作废，09 §3） | 待实现（playground 未做密度切换）：预期内容区收为单行小控件，取值 M2 定稿；原 64px 作废 |

密度是用户可切换的个人偏好（存于客户端设置），不是插件可覆盖的贡献点；插件贡献的控件必须使用 `--cordex-control-height-*` 而非自定义高度，才能随密度联动。（2026-09-18：Ribbon 高度旧值 88px / 64px 作废；可执行定义是 09 §3 "悬浮工具卡"行与 `playground/src/components/editor/ribbon/primitives.tsx`。）

---

### 2.14 图标规范（2026-09-15 UX 评审新增；2026-09-18 改 Lucide）

| 规则 | 内容 |
|---|---|
| 图标家族 | **单一家族：Lucide 线性（`lucide-react`，ISC；`components.json` `iconLibrary: "lucide"`，09 S-05）**；不混用第二套图标（原 Phosphor regular 方案作废，2026-09-15 起随 shadcn 复用改为其默认图标库），不用 emoji/Unicode 符号充当图标（评审规则 no-emoji-icons），不用彩色方块 / 红圈等异质图示（红色只出现在 `text-destructive` 的线性图标上，09 §3）；字形类图标（B/I/U）用 Lucide `Bold` / `Italic` / `Underline` |
| 网格与描边 | Lucide 24 网格按 16（`size-4`，按钮内默认 `[&_svg:not([class*='size-'])]:size-4`）/ 20（`size-5`，Ribbon 大按钮）/ 14（`size-3.5`，Ribbon 小按钮与堆叠标签）三档缩放；`fill:none; stroke:currentColor`、圆角端点，不得内嵌固定色值；描边 1.5–2：`lucide-react` 默认 `strokeWidth=2`，playground 沿用默认，若按视觉基线统一到 1.5 需在 `ui-react` 图标包装层设置（M1 定） |
| 交付形态 | 直接从 `lucide-react` 按名导入（tree-shaking，单点引入规则见章程 §5.3-4，仅 `ui-react` 与 `*-ui`）；原 `@cordexjs/design/icons` SVG sprite（`<symbol id="i-*">` + `<use>`）方案作废；插件图标提交 Lucide 图标名或同规范（24 网格、`currentColor` 描边）的 SVG 组件，缺失时回退 `Puzzle` |
| 可访问性 | 装饰性图标（旁有可见文字）`aria-hidden="true"`；仅图标的控件必须有 `aria-label`（不能只靠 tooltip）；按下/展开态用 `aria-pressed`/`aria-expanded` |
| Tooltip | 悬停 400ms 延迟出现，**`:focus-visible` 时立即出现**（键盘用户同样可见）；tooltip 不替代 `aria-label` |
| 命中区 | 图标控件视觉可为 16/20px，但命中区 ≥ 24×24 CSS px；触控场景 ≥ 44×44，相邻目标间距 ≥ 8px（见 §4.1、§5、07 §2） |

---

## 3. 主题应用规则（亮/暗）

**当前可执行约定（playground，2026-09-18 v0.5 补记）**：`src/index.css` 以 `@custom-variant dark (&:is(.dark *))` 声明暗色变体，暗色 token 写在 `.dark { … }` 块（亮色在 `:root`）；`src/lib/theme.ts` 在 `<html>` 上切换 `.dark` class 并同步 `style.colorScheme`，解析顺序：页面内显式选择（`localStorage` 键 `cordex-theme` = light / dark）> 宿主显式标记（`<html data-theme="light|dark">`，artifact 查看器等嵌入宿主盖章，`MutationObserver` 跟随宿主切换）> `prefers-color-scheme`；`initTheme()` 在应用启动时应用一次，多个 `ThemeToggle` 实例共享同一 store。下文的 `data-cordex-theme` 属性方案与早期原型的 `data-theme` 一样，**目前仅作历史 / 规划记录**，未在任何可执行产物中实现；产品化时 `ThemeService` 须把 `.dark` class 与命名空间属性对齐——该项已由 rulings §4.11 C-21 结案：三种选择器（`.dark` / `data-cordex-theme` / 宿主 `data-theme`）长期等价，写成明文契约（含 `prefers-color-scheme` 兜底），组件只读语义 token、不感知用的是哪一种。

**产品运行时的规划约定（架构 02 §4.18；`data-cordex-theme` 尚未实现，见上）**：`@cordexjs/design` 生成的 `tokens.css` 用 `data-cordex-theme` 属性，不是通用的 `data-theme`——形如 `:root[data-cordex-theme=…]{ --cordex-*: … }`；`cordex` 前缀是刻意的命名空间隔离，避免 SDK 被嵌入到已有自己 `data-theme` 约定的宿主页面（多 host 场景）时发生属性冲突（K7 的"零依赖"延伸到"零侵入"）。规则细化：

- `:root` 定义完整亮色 token（默认值，无需媒体查询即可用）。
- `@media (prefers-color-scheme: dark)` 内用 `:root:not([data-cordex-theme="light"])` 覆盖暗色 token（跟随系统，但允许用户显式选亮色覆盖系统）。
- `:root[data-cordex-theme="dark"]` 再显式覆盖一次相同的暗色 token（用户显式选暗色，不依赖系统媒体查询）。
- `body` 显式设置 `background: var(--cordex-color-bg-canvas)`、`color: var(--cordex-color-text-primary)`，不依赖宿主页面背景。
- 三处主题竞态（用户显式选择 vs 系统跟随）的优先级：`[data-cordex-theme]` 显式属性 > `prefers-color-scheme` 媒体查询 > `:root` 默认亮色。
- 组件不得读取 `prefers-color-scheme` 或 `[data-cordex-theme]` 做逻辑分支；只读语义 token，主题切换对组件透明。
- **多 host 去重**：`ThemeService`（`ui-core/services/theme.service.ts`）负责把 `tokens.css` 作为单一 `<style>` 注入宿主页面，注入前检查去重键 `data-cordex-tokens`（已存在则跳过），保证同一宿主页面内多个 `@cordexjs/design` 消费方（如宿主自身 UI + 内嵌的编辑器）不会重复注入同一份 token 表。密度同理建议使用 `data-cordex-density` 属性（与 `data-cordex-theme` 同一命名空间；架构尚未在已读文档中给出显式字段名，此处为设计侧按一致性给出的推荐，见本目录 README 待决事项）。
- **高对比主题**：`@cordexjs/design/tokens/themes/high-contrast.ts` 已作为第三套主题文件存在（架构 02 §4.17），对应 PRD NF-05 的 `forced-colors` 支持（P1，见 07-accessibility-and-i18n.md）。**时机已裁决（2026-09-19，rulings §4.12 U-08）**：M1–M2 只加 `@media (forced-colors: active)` 系统色兜底，不产第三套取值；正式第三套 token 延后到 M3 P1。本文档 §2 目前只给出亮/暗两套具体数值，高对比主题的数值由无障碍验收标准倒推，暂不在此重复定义，详细 token 值列入本目录 README 待决事项。

**（历史）本设计文档早期原型（`prototype/index.html`）的例外**：该原型是独立的低保真演示文件，不是 `@cordexjs/design` 的实际产出，遵循原始任务对 artifact 型页面的通用约束（使用通用的 `data-theme` 属性，见 `prototype/index.html` 自身注释）。两者选择器不同是刻意的，不代表产品 token 命名的不一致——阅读本文档 §2 的 token *取值* 时可直接套用到原型，但主题切换的属性名以本节为准（产品）或原型自身注释为准（演示文件）。

---

## 4. 组件清单

### 4.1 原子组件（`@cordexjs/design`，无框架依赖，仅 CSS 类名 + 可选零依赖 Web Component）

| 组件 | 变体 | 状态 | 说明 |
|---|---|---|---|
| Button | primary / secondary / ghost / danger / icon-only | default/hover/active/disabled/loading/focus-visible | 尺寸随 `--cordex-control-height-*` |
| IconButton | — | 同上 | 命中区 ≥ 24×24（`pointer: coarse` 或 < 640px 时 ≥ 44×44，间距 ≥ 8px），图标 16×16；必须有 `aria-label`（§2.14） |
| Input / TextField | text/number/search | default/hover/focus/disabled/readonly/invalid | 校验态用 `border-danger` + 内联错误文案，禁止原生 `title` 弹窗式校验 |
| Select | 单选下拉 | 同 Input | 键盘可达（见 07） |
| Checkbox / Radio | — | checked/indeterminate/disabled | indeterminate 用于多选混合值 |
| Switch | — | on/off/disabled/loading | 用于插件启用、密度切换 |
| Slider | — | default/dragging/disabled | 用于缩放、透明度 |
| Tooltip | — | — | 悬停 400ms 延迟出现，`:focus-visible` 立即出现；`--cordex-z-tooltip`；不替代 `aria-label` |
| Badge | neutral/success/warning/danger/info | — | 计数、状态角标 |
| Avatar | — | 含 presence 环变体 | 见 05-collaboration-ux |
| Divider | horizontal/vertical | — | — |
| Tabs | — | active/hover/disabled | 用于检查器坞、评论面板筛选 |
| Menu / MenuItem | — | hover/active/disabled/loading | 支撑 ContextMenu、下拉 |
| DialogShell | — | — | 提供遮罩+容器+焦点陷阱结构，内容由消费方填充 |
| PopoverShell | — | — | 定位、翻转、箭头 |
| ToastShell | — | — | 队列、自动消失、`aria-live` |
| ProgressBar / Spinner | determinate/indeterminate | — | 上传、导出、同步进度 |
| ColorSwatchButton | — | — | 触发颜色选择器 |
| Tag / Chip | — | removable | 权限角色、插件分类 |

### 4.2 组合组件（`@cordexjs/ui-core` 定义交互契约，`@cordexjs/ui-react` 提供 React 渲染）

| 组件 | 对应贡献点 | 说明 |
|---|---|---|
| RibbonTabBar / RibbonGroup / RibbonButton | `ui.ribbon` | 见设计 06 §2.1 |
| ThumbnailRail / ThumbnailItem | 内置（非贡献点，宿主提供） | 见 03-screens/02 |
| InspectorDock / PropertySection / PropertyRow | `ui.panel` | 见设计 06 §2.2 |
| ContextMenu | `ui.contextMenu` | 见设计 06 §2.3 |
| CommandPalette | 读取 `ui.command`（呈现）+ `core.command`（能力位门控） | 见设计 06 §2.5 |
| StatusBarItem | `ui.statusBar`（章程 v0.2 §5.5 定稿，camelCase，见设计 06 §2.7） | — |
| ToolbarFloating | `ui.toolbar`（见设计 06 §2.6） | 文本编辑迷你工具条、图片/图表选中快速操作条 |
| CanvasOverlayLayer | `render.overlay`（章程 v0.2 §5.5 定稿，见设计 06 §2.8） | 远端光标/选区、评论锚点、选中手柄 |
| ThemeOverride | `ui.theme` | 插件/主题贡献的 token 覆盖集，见 §7 |
| PresenceStack / PresenceAvatar | 内置 | 见 05-collaboration-ux |
| CommentPin / CommentThread | 内置 | 见 03-screens/06 |
| VersionTimelineItem | 内置 | 见 03-screens/07 |
| PluginCard | 内置（读取 Manifest） | 见 03-screens/09 |
| FidelityReportRow | 内置 | 见 03-screens/10 |
| Banner（离线/冲突） | 内置 | 见 03-screens/12 |
| ShareDialog / PermissionRow | 内置 | 见 03-screens/08 |

---

## 5. 响应式与断点

断点口径与 01-information-architecture.md §6、PRD NF-07 一致（1024/640px，此前版本误用 1280/768px 已更正；rulings §4.10 Q19（2026-09-18）再次统一：09 T-01 与 playground 此前的 768 作废，playground `use-mobile.ts` 已改为 `useBreakpoint()`——`BREAKPOINT_DESKTOP=1024` / `BREAKPOINT_COMPACT=640`，返回 desktop / compact / narrow；本表已与 01 §6 表逐格核对）：

| 断点 | 范围 | 变化点 |
|---|---|---|
| 桌面 | ≥ 1024px | 完整 UI：三栏（缩略图栏 240 · 画布 · 检查器 300，`ResizablePanel` 像素宽，09 T-01）常驻，缩略图栏可折叠为窄图标条；Ribbon 完整多页签 + 分组；画布居中四周留白 |
| 紧凑 | 640–1024px | 紧凑 UI：缩略图栏默认收起为图标条（playground：`glass-strong w-11` 44px 条 + `PanelLeft`），点击展开为浮层（`Sheet side="left" w-72`）；检查器默认收起，点击应用栏右端 `PanelRight` 弹出按需浮层（`Sheet side="right" w-80`，不挤压画布宽度）；Ribbon 分组收窄，低优先级按钮进「更多」溢出（playground 未做）；画布尽可能占满宽度 |
| 仅查看 | < 640px（原型验证至 400px）或 `pointer: coarse` | 产品范围内仅承诺查看/评论体验（NF-07），不承诺完整编辑 UI；两侧栏改抽屉（`Sheet`；playground：顶部 `glass h-9` 「仅查看」提示条，缩略图栏 / 检查器分别由应用栏 `PanelLeft` / `PanelRight` 打开）：缩略图栏收为顶部/底部抽屉、触发按钮常驻，检查器默认显示「评论」、收为底部抽屉；Ribbon 收为**48px 高的查看态工具条，按钮 44×44、间距 ≥ 8px，只保留翻页/缩放/评论/更多**（减少控件而不是缩小控件），编辑类分组经 `when` 收起而非硬编码隐藏；画布全宽，支持双指缩放/平移；详见 01-information-architecture.md §6 |

所有断点变化通过重映射 `--cordex-control-height-*`、区域显隐与布局网格实现，不新建组件变体（呼应 Univer 教训 A7：移动端是变化点而非整包复刻）。窄屏/触控下**禁止**把桌面控件等比缩小（2026-09-15 评审：原型早期在 ≤640px 把 ribbon 按钮缩到 26px 是反例，已改正）。

---

## 6. 与 Univer 教训的对应

| 教训 | 本文档的落实 |
|---|---|
| K7（design 零依赖、单一 `<style>` 注入 + CSS 变量） | `@cordexjs/design` 仅导出 token + 原子组件类，无运行时依赖；主题通过 `:root` / `.dark` class 单点覆盖；`.dark` class、命名空间属性 `data-cordex-theme` 与宿主 `data-theme` 三种选择器按 rulings §4.11 C-21 **长期等价**，已写成明文契约（含 `prefers-color-scheme` 兜底，见 §3、架构 02 §4.18、ADR-0017），不再是待定项 |
| K7 附加修补（Univer 缺失非颜色 token，报告标记为 D 级缺陷） | 本文档 §2.7–§2.13 显式定义间距/字号/圆角/阴影/z-index/动效/密度 token，与颜色同等地位 |
| A5（渲染契约混入产品特定类型） | z-index/覆盖层 token 只描述层级与坐标层，不描述"幻灯片""形状"等垂直概念 |
| A14（`ComponentType<T> = any`） | 组件清单按贡献点分类并给出状态矩阵，供类型治理条线据此收紧 props 类型（非本文档职责，交架构/类型治理落实） |

---

## 7. 与 ui-ux-pro-max 设计系统基线的比对（2026-09-15，本轮新增）

本轮设计（高保真设计稿 + 母版视图）按用户要求以 `ui-ux-pro-max` skill 驱动，第一步运行：

```
python3 search.py "collaborative presentation editor productivity tool professional minimal" \
  --design-system -p "Cordex Slides" --variance 3 --motion 3 --density 8
```

（`--variance 3` 偏向克制/居中；`--motion 3` 偏向轻量微交互；`--density 8` 偏向仪表盘级密集布局——三个拨杆按本产品"桌面优先、信息密集、专业工具"的定位选取。）以下逐项核对基线建议与本文档已裁决的决策，裁决不因基线建议而改变（已有决策优先于通用基线），仅记录比对结论：

| 基线建议 | 本文档已裁决 | 处置 | 理由 |
|---|---|---|---|
| 主色 `#0D9488`（青绿）、强调色 `#EA580C`（橙） | `--cordex-color-accent-default #3A5CE6`（蓝靛，2026-09-16 起；原 #4A54E1） | **保留已裁决值，不采纳** | §2.1 已明确 accent 不得与语义色/协作者色复用色相；青绿/橙与 `success`(`#1E9E5A`)、`warning`(`#B76E00`) 的色相过近，会引入"这是强调还是状态"的歧义，靛蓝色相唯一，2026-09-15 UX 评审已核算全部对比度，不重新核算 |
| 字体 Plus Jakarta Sans（标题/正文） | `--cordex-font-family-ui`：原（2026-09-15）为系统字体栈；2026-09-16 Q6 起为 `'Geist Variable'` 优先 + 系统字体回退（§2.8） | **保留已裁决值，不采纳** | 原理由"系统字体优先是为规避 SDK 嵌入场景的外链字体许可与加载成本"（K7 零依赖延伸）；Geist 自托管后该顾虑消除，但仍不引入第二套字体（09 S-05），结论不变 |
| 风格 "Minimalism & Swiss Style"（clean/spacious/grid-based/high-contrast） | 本文档 §1–§6 的整体风格 | **确认一致，视为验证** | 与已裁决的 token 体系（克制阴影、网格化间距、无冗余装饰）方向相同，无需调整 |
| `--density 8` → 紧凑间距刻度 | §2.13 密度模式（舒适/紧凑两档） | **确认一致，强化紧凑档的适用场景** | 验证了母版视图（母版缩略图窗格 + 画布 + 检查器坞三栏同屏，信息密度高）应默认使用 `data-cordex-density="compact"`，曾在已退役的 `mockups/26-master-view.html`、`28-design-tab-and-themes.html` 采用（playground 未实现密度切换，§2.13）；已有的舒适/紧凑两档无需新增第三档（呼应 README D6 无强需求不做） |
| `--motion 3` → scroll-reveal 类淡入位移 | §2.12 动效 token（hover 80–120ms，菜单/面板 180ms，对话框 240ms） | **不适用，不采纳** | 该 GSAP 预设面向营销落地页的滚动揭示动画；编辑器 chrome 没有"滚动进入视口"的叙事场景，已有的分场景时长体系（悬停/按下/展开/对话框/缩略图重排五档）更贴合工具类产品，予以保留 |
| 图表类型建议（Gauge/Bullet/Waffle） | 不适用 | **不适用，本轮设计范围不含数据图表 chrome** | 图表是文档内容（`slide-render-chart` 插件渲染的幻灯片元素），不是编辑器界面本身的图表化数据展示；母版视图状态栏等处的计数展示用 `Badge`/数字即可，未来若新增分析类面板可复用 25 种图表类型库 |
| Pre-Delivery Checklist（无 emoji 图标、hover 过渡 150–300ms、对比度 ≥4.5:1、focus 可见、reduced-motion、断点 375/768/1024/1440） | §2.14 图标规范、§2.6 对比度基线、07-accessibility-and-i18n.md §2/§5、§5 响应式断点 1024/640 | **确认全部已满足，视为验证** | 唯一差异是断点数值（本产品桌面优先，用 1024/640 而非通用的 375/768/1024/1440），差异原因已在 §5 与 01-IA §6 注明（NF-07 屏幕矩阵），不是遗漏 |

**补充 `--domain` 检索**（为各界面类别分别检索，命令与命中的规则要点见各 `03-screens/*.md`、`mockups/*.html` 文末"应用的 UX 规则"小节，此处只列汇总；检索方法与retry规则遵循 skill 的 Query Contract，0 命中的查询已按规则重试一次并如实标注）：

| 类别 | 代表查询 | 结论 |
|---|---|---|
| `ux` | `"placeholder empty state"`、`"modal dialog focus"`、`"toast undo"`、`"form inline validation"`、`"resize handle drag"`（"canvas selection handles" 0 命中后的重试）、`"avatar group overflow"`（"presence avatars stack" 0 命中后的重试） | 命中的"Focus Appearance"（2px 描边+3:1 对比）、"Toast Notifications"（3–5s 自动消失）、"Dragging Movements"（拖拽必须有键盘/按钮等价）均与本文档 §2.6/07 §1.2a/07 §5 已有裁决一致，视为交叉验证；"ribbon toolbar dense grouping" 重试后仍 0 命中，如实标注为"未找到匹配，沿用设计 06 §2.1 已有的槽位密度规则（≤6 分组自动收纳）作为唯一依据" |
| `icons` | `"lock toggle state icon"`、`"layout grid icon"`（"template layout master icon" 0 命中后的重试） | 命中 `lock`（Outline）与 `grid-four`/`columns`（Layout 类）确认本轮新增的母版 / 版式图标方向（网格/分区隐喻，现为 Lucide `Layers` / `LayoutTemplate`）与线性描边风格（原 Phosphor regular，2026-09-18 起 Lucide，§2.14）一致 |
| `color` | `"dense dashboard accent color"`、`"semantic status color pairs"` | 返回的分析/状态类仪表盘配色均把强调色与状态色（绿/红/琥珀）分离，与 §2.1 已有的"accent 不复用语义色相"原则同构，视为交叉验证，不改动具体数值 |
| `typography` | `"dense ui small text hierarchy"` | 命中的字体配对（衬线/圆体）均不适配 SDK 嵌入场景，不采纳，字体栈保留（原为系统字体栈，现为 Geist 优先 + 系统回退，§2.8） |
| `chart` | `"chart legend accessible"` | 见上表，本轮不适用 |
| `--stack react` | `"virtualized tree list state"`、`"compound component composition state"` | "Tab + TabPanel sharing context"、"Context for composition, avoid 5+ level prop drilling" 两条**已采纳为实现建议**（非 UX 决策）：检查器坞 Tab 组、母版缩略图窗格的选中态建议用共享 Context 而非逐层传参，写入 06-extensibility-ux.md 实现提示；"Generic props for list components" 用于缩略图侧栏/母版缩略图窗格的虚拟化列表类型提示 |

**结论**：本轮 skill 检索验证了已裁决的 token 体系与断点策略无需变更，唯一新采纳的是 react 组合模式的实现提示（非视觉决策）；颜色/字体/风格类建议因与已记录的架构约束（零依赖字体、色相分离）冲突而不采纳，处置与 README.md §8 此前一轮评审记录的"未采纳的 skill 建议"结论一致，两轮独立检索互相印证。

---

## 待决事项

- 文档内容（幻灯片内文字）的默认度量单位（pt / cm / inch）与语言环境的映射规则：需产品条线确认；本设计文档不预设。
- 密度属性名 `data-cordex-density` 为设计侧按 `data-cordex-theme` 的命名空间一致性推荐给出，架构条线尚未在已读文档中给出显式字段名，需架构条线在 `02-layering-and-packages.md` §4.18 `theme.service.ts` 的后续细化中确认或改名。
- 高对比主题（`themes/high-contrast.ts`）的具体 token 数值本文档未定义（P1，非本轮必需），需要在无障碍验收标准（NF-05 `forced-colors`）明确后由设计条线补齐并回写本文件 §2/§3。

---

## 8. 与 shadcn 主题变量的映射（2026-09-15，v0.3）

按用户要求，组件层改为直接复用 shadcn/ui（规范 09 v2.0）。本文档的语义 token **取值不变**，但对外契约改为 shadcn 变量命名：`--background/--foreground/--card/--popover/--primary/--secondary/--muted/--accent/--destructive/--border/--input/--ring/--radius/--sidebar-*`，加 Cordex 扩展 `--success/--warning/--info`（各含 `-foreground` 与 `-muted`）、`--canvas`、`--doc-paper/--doc-ink`、`--stage/--stage-chrome/--stage-foreground`、`--presence-1…12`。完整映射表见 `09-design-specification.md` §1.1/§1.2；可执行定义见 `playground/src/index.css`。`--cordex-*` 命名仅保留在本文档作为取值来源与对比度核算记录，实现层不再使用。

## 9. 2026-09-16 修订：主色去紫、shadcn 风格 Rhea、材质层

- **主色去紫**（用户裁决，rulings §4.8）：保留靛蓝家族但把色相从约 236° 移到约 228°/222°，消除紫味，暗色尤甚。亮色 `--primary #3A5CE6`（白字对比 5.45:1；对画布底 `#EEF1F8` 4.8:1），暗色 `--primary #6B93FF`（对暗底 `#151A26` 6.0:1，配深色 `--primary-foreground #101425` 6.5:1），暗色焦点环 `--ring #7DA2FF`。`--chart-1`、`--sidebar-primary` 随主色。文档内容的主题色（如 mock 文档形状填充 `#4A54E1`）是数据，不随 UI 主色变。
- **shadcn 风格**：`radix-nova` → `radix-rhea`（2026-05 紧凑版 Luma，macOS Tahoe 几何）；组件复制件重生成，`components.json` 是唯一开关。
- **暗色极性修正（2026-09-16 用户截图反馈）**：暗色填充类 token 必须比表面更亮——`--secondary #262E40`、`--muted #232A3B`（原 #0F1420）、`--accent #2C3548`、`--border #2A3245`、`--sidebar-accent/--sidebar-border` 同步；Toggle/ToggleGroup 选中态另由 `[data-slot]` 规则显式化。原因：Rhea 的选中态是 `aria-pressed:bg-muted`，`--muted` 比玻璃表面暗时选中控件呈"凹陷黑洞"。
- **材质层**：新增 `--glass-*` 亮暗双套与 `@utility glass/glass-strong`、背景层渐变、`prefers-reduced-transparency` 与 `@supports` 退化；四层层次模型、圆角刻度与分隔规则见 09 v3.0 §6。§2.9 圆角与 §2.10 阴影的旧值仅作历史记录，实现以 09 v3.0 为准。
- **浅色字段 token（2026-09-16 用户截图反馈）**：Rhea 把 `--input` 当"字段填充基色"（50% 叠加），Nova 时代按 3:1 描边取的 #8A93A2 叠白后成 #C4C9D0 重灰。浅色 `--input` 改 #DFE3EA（填充 ≈ #EFF1F5），新增 `--border-control`（浅 #A3ABB9 / 暗 #6B7689）承担描边需求；浅色 `--muted-foreground` 由 #667085 加深为 #5F6B80（白底 5.4:1、字段填充上 4.7:1）。字段悬停/聚焦态见 09 §2。
- **叠色收敛（2026-09-17 用户反馈"叠色过多"）**：检查器/设置抽屉的"井"层不再着色（`.cordex-well` 透明，仅布局），玻璃面板 → 白卡 → 灰字段两层色阶即可；属性行 `min-w-0` 防止字段固有宽度撑出横向滚动。
- **分组卡三层配色（2026-09-16 用户反馈"配色有点问题"）**：此前面板、分组卡、字段是三层几乎同调的浅灰（≈#FCFDFE / #F1F2F5 / #EFF1F5），字段融进分组卡。改为 Apple 表单层次：浅灰井（前景 3%）→ 白色分组卡（`--card` + 描边 `rgb(15 20 40 / .06)` + 投影）→ 灰字段（`bg-input/50` ≈ #EFF1F5）→ 文字；暗色对应 黑 18% 井 → 白 5% 卡（描边白 6%）→ `--input` 50% 字段。公共类 `.cordex-well` / `.cordex-group`，检查器与设置抽屉共用。
- **v0.5（2026-09-18）回写记录**（按 playground 现值与 rulings §4.9–§4.10）：
  - 色板（§2.2 / §2.3，与本节一致）：亮 `--canvas #EEF1F8`（原 #EDEFF3）、暗 `#101523`（原 #0B0F19）；亮 `--muted-foreground #5F6B80`（原 #667085）、暗 `#8A94A6`；亮 `--border-control #A3ABB9`（原 gray-500 #8A93A2）、暗 `#6B7689`；亮 `--input #DFE3EA`（新增 `bg-field` 行）、暗 `#6B7689`；暗 `--secondary #262E40`、`--muted #232A3B`（原 #0F1420）、`--accent #2C3548`（原 rgba(255,255,255,.06)）、`--border #2A3245`（原 #232A3B）；亮 `--border #E4E7EC`（原 #E9EBEF）、`--accent #EEF0F4`（原 rgba(26,32,48,.05)）；主色亮 #3A5CE6 / 暗 #6B93FF / 暗 ring #7DA2FF。各行括注 shadcn 变量；对比度按 WCAG 公式重算并附于各行——`border-control` 亮色 2.3:1 未达 1.4.11 的 3:1，标注待复核（09 §1.1 同步）。
  - 字体（§2.8）：`'Geist Variable'` 优先 → 系统字体 → PingFang SC / Microsoft YaHei（Q6 保留 Geist，自托管不外链）；"系统字体优先"表述作废，§7 相关行加"原"标注。
  - Ribbon 高度（§2.13）：页签行 36 + 内容区 91（组 83 `self-stretch`）；小控件 28 / 大按钮 60；旧值 88 / 64 作废；紧凑档待实现。
  - 图标（§2.14）：单一家族改 Lucide 线性（`lucide-react`，`components.json` `iconLibrary: "lucide"`）；删 Phosphor 与 SVG sprite；描边沿用 lucide 默认 2（是否统一 1.5 待 M1）。
  - 主题选择器（§3）：补 playground 约定——`.dark` class（`@custom-variant dark`）+ 宿主 `data-theme` 兼容（`src/lib/theme.ts`：显式选择 > 宿主标记 > 系统偏好）；`data-cordex-theme` 与原型 `data-theme` 均标为历史 / 规划记录。
  - 断点（§5）：与 01 §6 表逐格对齐（紧凑态：缩略图栏图标条 + 检查器按需浮层 + Ribbon「更多」；仅查看态：两侧栏抽屉 + 48px 查看态工具条）；Q19 统一 1024 / 640，09 T-01 与 playground 的 768 作废。
  - 措辞：§7 "母版树"改"母版缩略图窗格"（rulings §4.10 口径）。
- **2026-09-18 晚补（用户裁决 Q21）**：亮色 `--border-control` 由 `#A3ABB9` 提高为 `#757F8F`（白底 4.05:1 / 画布 3.58:1 / 字段填充 3.14:1），§2.2 / §2.6 同步；playground `index.css` 已改并发布。
