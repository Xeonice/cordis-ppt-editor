> 状态：已同步（用户 2026-09-18 交互式裁决 Q11–Q20；机械回写按既定裁决执行完毕） | 负责：总编排 | 更新：2026-09-18 | 依赖：rulings §4.8–§4.10、08-prd-design-alignment-2026-09-17、20-design README §8 v5–v22、09 v3.1、04 v0.5、03-screens/26 v16

# 09 PRD 与设计稿一致性复核（2026-09-18）

用户指示："用 agent 再核对一遍 PRD 和设计稿的一致性"，随后"用交互模式确认一下这块"。

## 0. 结论

- **playground 实现与 Q1–Q10 全部裁决一致**（四路独立核对确认）；PRD 主体、章程 D10 / §5.2、ADR-0017、设计 README §8 已落地。
- **问题集中在设计文档层**：2026-09-16/17 的裁决只更新了各文件的入口表、标题与头注，正文与线框未回写。四路核对点名了同一批文件（03-screens/26、01-information-architecture、02-user-flows、03-screens/02/20/23/24、06-extensibility-ux、09、04）。
- **另有 9 处 PRD 与设计的真实矛盾**，已由用户逐项裁决（rulings §4.10 Q11–Q20，见 §2）。

## 1. 复核方法与统计

| 路 | 方向 | 范围 | 发现（高 / 中 / 低） |
|---|---|---|---|
| A | 正向 PRD → 设计 | `03-features/*`、NFR、里程碑、覆盖矩阵 → 设计文档 + playground | 6 / 14 / 17 |
| B | 反向 设计 → PRD | `03-screens/01–29`、01/02/06/09/12、playground 源码 → PRD | 19 / 17 / 13 |
| C | 设计文档 ↔ playground | 09 / 04 / 重点界面文档 ↔ `index.css`、Ribbon、检查器、路由登记 | 3 / 18 / 13 |
| D | 裁决落地矩阵 | Q1–Q10 与 08 §4 十四项 在 PRD / 设计 / playground / 章程 / 变更记录五处 | 22 条明细 |

四份原始报告与合并汇总保存在总编排 scratchpad（`consistency/`）；高严重度条目由总编排逐条抽查原文确认，无误报。

## 2. 用户裁决（rulings §4.10）

| # | 议题 | PRD 原说法 | 设计 / playground 原说法 | 裁决 |
|---|---|---|---|---|
| Q11 | 删除被引用的版式 | 阻断确认 + 「全部改为」 | 确认后自动改默认版式、不可撤销 | **按设计**；PRD ML-03 / G-73 / F-P16 改 |
| Q12 | 母版视图在评审模式与窄屏 | 评审可只读进入，窄屏改抽屉 | 不提供入口 | **按设计**；PRD ML-01 / G-70 / G-71 改；设计 20 删自相矛盾句 |
| Q13 | 换版式不匹配提示 | toast + 撤销 | 27 内联条 / 14 toast 无撤销 / 代码对话框描述 | **按 PRD**；设计 27、14 与 playground 统一 |
| Q14 | 编辑器应用栏账户头像 | 编辑器共用账户菜单 | 应用栏无头像 | **加头像**；设计 02 与 playground 编辑器族 |
| Q15 | 切换效果页签 | M1–M3 不编辑动画 | 完整可编辑 UI | **playground 改只读展示** |
| Q16 | 设计有、PRD 无的 8 项 | 无 | 范围条双态单选、版式搜索、跨母版换版式即换母版、母版加载/失败态、版式多选批量删除、占位符上限、应用栏「影响 N 页」徽标、重置二次确认卡 | **全部保留并补进 PRD**（重置确认卡为 D9 显式例外） |
| Q17 | 「设置为默认主题」「另存为新主题」 | 无 | 设计 28 与 playground 有 | **删除**（ML-04 不变） |
| Q18 | 查看器缩略图导航与备注查看 | OF-14 有 | 设计 25 / IA 明确不含 | **按 PRD**；设计 25 与 playground 补可选缩略图条与备注抽屉（默认关） |
| Q19 | 响应断点 | 1024 / 640 | 09 T-01 与 playground 768 | **统一 1024 / 640** |
| Q20 | 编辑器应用栏「⋯」菜单 | 四条流程依赖 | playground 无 | **补**：导出… / 保真报告 / 版本历史 / 插件管理器 / 重命名 / 创建副本 /（开发者） |

同时确认：机械回写按既定裁决直接执行；快捷键面板入口保持三个（Ribbon「?」、账户菜单、`Mod+/`），「唯一入口」只对「设置」成立。

## 3. 机械回写清单（裁决已定，不需拍板）

### 3.1 设计文档
| 文件 | 问题（复核时位置） | 处置 |
|---|---|---|
| 03-screens/26 | §1 首段"同级视图模式/互斥/替换三区"；§2 "母版树/检查器仅属性"；§3 整节 Tree 模型；§6/§7 尺寸 196/152/272；线框；L7 "PRD 07 尚未落地"；mockups 引用；§10 待决 | 正文重写（v16） |
| 01-information-architecture | §2.4 / §5a 母版树、侧栏顶部分段主入口、`Mod+Shift+M`、仅属性、Ribbon 收窄单页签；§1 应用壳无开始页；§9 路由表与 registry 不符 | 重写 |
| 02-user-flows | F10 `Mod+Shift+M`、侧栏分段、母版树；F1 无开始页入口；L289 CO-07 数值 | 重写 |
| 03-screens/02 | §2.4 与规格表侧栏顶部分段主入口；线框"返回列表"、应用栏无 ⋯/头像；混合值"多个值"；缩放"状态栏滑块" | 重写 |
| 03-screens/20 | L5/L57/L96 侧栏分段等价说法；L75/L91/L92 自相矛盾 | 按 Q12 统一 |
| 03-screens/23 | L72 入口"⋯"菜单 | 改账户菜单唯一入口 + 关闭规则 |
| 03-screens/24 | L7/L73 状态栏 "?"；清单缺 `Mod+Alt+M` / `Mod+,` / `Mod+/` | 改三入口 + 补三条 |
| 06-extensibility-ux | §2.10a Ribbon 整体替换、三 Tab 禁用、selectionKind 收窄；L66 Phosphor | 重写 |
| 09-design-specification | L14 母版树；L91/L134 Sheet 圆角未实现；L98 属性行网格；L115 宽 168/280；L129 "仅属性"残句；L133 T-07 含"设置"；L142 防线"末尾"；L172 glow 值；L180 退化范围；L185 待实现标注；T-01 断点/⋯/头像 | v3.1 |
| 04-design-system | §2.2/§2.3 旧 token；§2.8 系统字体优先；§2.13 ribbon 88；§2.14 Phosphor；§3 主题选择器 | v0.5 |
| 20-design/README | 日期；L35 母版树；索引缺 29、仍列 prototype；"18 条路由" | 更新 + §8 v22 |
| 03-screens/03 / 07 / 14 / 15 / 27 / 28 / 25 / 11 / 01 / 22 / 10 / 12 | 字段口径、CO-07 数值、toast 文案、母版树图标、Phosphor、树形/内联条/尺寸、线框/两项删除/尺寸/字体、查看器可选条、演讲者视图占位、品牌名、⋯ 入口、评审稿历史标注 | 逐项回写 |

### 3.2 PRD
| 文件 | 问题 | 处置 |
|---|---|---|
| 07-design-coverage-and-gaps | L6 计数；L18 记号；ED-16/ED-25 行状态；ML-01 行"完整"高估；G-76 悬空；§2 落点旧编号 14 处；G-70/G-71（Q12、Q16）；G-73（Q11）；F-P16 母版树；D9 例外；新增 D26/D27 | 回写 |
| 08-app-shell | AS-06 "设置与快捷键为唯一入口" | 仅设置唯一；快捷键三入口 |
| 05-milestones | §0.2 总表无 AS 行；M2 验收无开始页/账户菜单；`master:view` 无 Q12 条 | 补 |
| 10-prd/README | "六个功能域"；索引缺本文件；D 计数 | 更新 |
| 07-masters | ML-01 / ML-02 / ML-03 按 Q11 / Q12 / Q16；L49 按钮名 | 修订 |
| 01-open-and-fidelity | OF-14 按 Q18 补可选说明 | 补 |
| 08-prd-design-alignment-2026-09-17 | 依赖行 v5–v20 | v5–v21 |
| docs/README | 28 份 / 第 3 版 / 15 路由 | 更新 |

### 3.3 章程 / ADR / 架构线
- charter.md：D10 "母版树" → "母版缩略图窗格"；§5.2 补应用栏 ⋯ 与头像；头部日期。
- ADR-0017：`MasterTree` → `MasterThumbnails`；日期；修订段。
- 30-architecture/README.md 与 02-layering-and-packages.md：`radix-nova` → `radix-rhea`；`MasterTree` / 版式树 → `MasterThumbnails` / 母版缩略图窗格。

### 3.4 playground
- 路由登记表描述"母版树"；AppBar 默认"返回文档列表"→"返回首页"，右侧补「⋯」与账户头像（Q14/Q20）；账户菜单"键盘快捷键"与 Ribbon "?" 改为打开快捷键面板（`/settings?panel=shortcuts`）；快捷键清单补三条；mock 邮箱改示例域名；放映"演讲者视图"占位删除（D3）；断点 1024/640 与紧凑/仅查看态（Q19）；查看器可选缩略图条与备注抽屉（Q18）；玻璃退化规则覆盖浮层（09 §6.3）；切换页签只读（Q15）；母版视图入口按 Q12；不匹配 toast（Q13）；删除被引用版式（Q11）；删"设置为默认主题/另存为新主题"（Q17）；版式多选与 11 类占位符 + 上限提示（Q16）；过期注释与死代码清理。

## 4. 处置结果

7 路并行回写（设计文档 ×3、PRD、章程/ADR/架构、playground ×2）于 2026-09-18 完成；总编排随后做零散残留修正、全仓扫描（现行口吻残留 0 处；剩余命中均为历史记录或"由 X 改为 Y"说明）、类型检查、构建、宿主外壳冒烟（10 个用例，控制台无错误）与发布。

| 范围 | 文件 | 结果 |
|---|---|---|
| 设计·母版族与结构 | 03-screens/26（v16 正文重写）、01-information-architecture、02-user-flows、06-extensibility-ux、20-design/README、12（历史快照标注） | 已回写；Q11 场景下不匹配 toast 不带「撤销」（整体不可撤销），普通换版式（ML-02）带「撤销」 |
| 设计·界面文档 | 02、20、23、24、03（含 G-74 三种上下文分区）、07（CO-07 数值）、14、15、27、28（Q17 删两项）、25（Q18 两节）、11（D3）、01、22、10；04/06/12/17 加实现口径头注 | 已回写 |
| 设计·规范与系统 | 09 v3.1、04 v0.5 | 已回写；核算出亮色 `--border-control #A3ABB9` 白底 2.3:1（< 1.4.11 的 3:1），用户裁决提高为 `#757F8F`（Q21，09 / 04 / playground 已同步） |
| PRD | 07-masters（ML-01/02/03 按 Q11/Q12/Q16）、07-coverage（G-70/71/72/73、F-P16、§2 落点编号、G-76 新增、D9 例外、D26/D27 新增）、08-app-shell（AS-06 措辞）、05-milestones（AS 行、验收条）、README（八个功能域、索引、D1–D27）、01-open（OF-14）、08-alignment 依赖行、docs/README、02-editing ED-16 措辞 | 已回写 |
| 章程 / ADR / 架构 | charter D10 与 §5.2、ADR-0017、30-architecture/README、02-layering（含 `reassignTo` 描述按 Q11） | 已回写；ADR 原决策段保留 `radix-nova` 原文由修订段覆盖 |
| playground 壳层 | registry、AppBar（返回首页、⋯ 菜单、账户头像、紧凑/窄屏按钮）、EditorShell（1024/640、图标条、Sheet、仅查看提示）、use-mobile、user-menu（avatar 形态、示例邮箱、快捷键入口）、Settings（`?panel=shortcuts`、清单三条、演示按钮移除）、Viewer（可选缩略图条、备注抽屉）、index.css（退化覆盖浮层）、Present（演讲者视图占位删除）、Home、Main、HomeTab、Import/Export/Offline（backLabel） | 已实现，tsc 通过 |
| playground 编辑功能 | TransitionTab（只读）、Ribbon/ViewTab（`masterEntry` 三态）、Layouts（Q13 toast）、Masters（多选、徽标、加载态、`Mod+Alt+M` 退出）、MasterTab（11 类占位符、上限提示、删除确认）、ThumbnailRail（多选、死代码清理）、DesignTab/ThemeEditorPanel（Q17）、Design、Inspector/MiniSlide 注释、SlideCanvas 评论钉对比度、Main（`Mod+Alt+M` 进入） | 已实现，tsc 通过 |
| 发布 | playground artifact Version 24（47 个资源，46 个旧资源置空）；Q21 后 Version 25 | 已发布 |

已知未尽（M2）：暗色 `--border-control` 在 accent 悬停面 2.68:1 待复核；< 640 Ribbon 未收为 48px 查看工具条、紧凑态 Ribbon「更多」溢出未做；Sheet 圆角留白、`contain: paint`、`data-interacting`、`prefers-contrast: more` 未实现；Esc 退出母版视图交由画布选区处理（playground 未绑定）；ML-03「删除被引用母版」的目标版式选取细则待设计 26 补稿。
