# 文档地图

> 项目：基于 cordis 的可插拔办公文档 SDK 与在线协同编辑器（首个文档类型：PowerPoint / .pptx）
> 阶段：M0 蓝图 | 更新：2026-09-18；2026-09-24（章程 §10 Q1–Q10 已由用户裁决，见 rulings §4.15；单组织、自托管）；2026-09-24（其余 Q11–Q20 已裁决，见 rulings §4.16——章程 §10 全部结案）；2026-09-25（矛盾收口，rulings §4.18）：阅读顺序重编号为 1–8，40-modules 先读 00 再翻 18/19 图集；目录注释改为 playground 为设计基准、补 18/19 图集与文档站/截图/绘图规范工具

## 阅读顺序

1. `00-charter/charter.md` —— 章程 v0.2：定义、硬约束、术语、架构基线（层带与秩表）、已定决策 D1–D16、里程碑、文档树、待用户决策 Q1–Q20（已全部裁决：Q1–Q10 见 rulings §4.15，Q14/Q18 见 §4.12，其余见 §4.16）。**先读这份。**
2. `00-charter/reference-univer-lessons.md` —— 从《Univer 架构评估》提炼的继承/规避清单（下游按编号引用）。
3. `00-charter/cordis-primer.md` —— cordis 4 的 API 摘要与本项目铁律。
4. `00-charter/rulings-2026-09-14.md` —— 对五条线异议/建议的逐条裁决（采纳/否决/待用户），解释 v0.1 → v0.2 的每处变化；§4.15 为章程 §10 Q1–Q10 的用户裁决（2026-09-24：单组织去租户、OIDC/Casdoor、Yjs 撤销语义、DOM/SVG、规模两层口径、保真落点、缩略图、pnpm 11 + Node 26、自托管洁净栈），§4.16/§4.17 为其余待决与复核裁决，§4.18 为文档矛盾收口裁决（2026-09-25：15 项决策、23 项默认值、67 项机械修正），调研证据包在 `00-charter/_evidence/`。
   下游文档状态头标注「依赖：charter v0.1」者，均已按裁决做了针对性修订；v0.2 与 v0.1 兼容（只增不改语义）。
5. `10-prd/` —— 产品需求（背景、角色、功能域、非功能、里程碑、指标）。
6. `20-design/` —— 设计（信息架构、流程、29 份界面规格、设计系统、协同 UX、扩展 UX、可访问性、原型自审与 v2 规划、高保真设计稿、设计 playground）。
   - **设计 playground**（`20-design/playground/`，shadcn/ui + Tailwind 实现的真实组件页面，2026-09-15 起唯一设计基准；第 21 版 2026-09-17：shadcn Rhea 风格 + Liquid Glass 材质层，应用首页 + 样式指南 + 17 条界面路由（共 19 条 hash 路由，全部 ready，登记表 `20-design/playground/src/routes/registry.ts`）亮/暗）：https://claude.ai/code/artifact/cf6e1a1a-986b-48bb-b743-5758dff419d2
   - **现代化改造（2026-09-16，已按路线 B 实施）**：审计 `20-design/10-modernization-audit.md`、提案 `20-design/11-modern-glass-redesign-proposal.md`；可点击样张（Rhea + 玻璃）：https://claude.ai/code/artifact/b6766867-9da7-4198-9ec4-fb05f43a7c76 ；三栏对比画廊：https://claude.ai/code/artifact/9d47af4e-3520-48bd-a6e9-f10dbd485e65
   - **编辑器族评审截图**（2026-09-16，108 张，宿主外壳内）：https://claude.ai/code/artifact/f8169a76-10d3-4440-9051-afea486adecf ；评审文档 `20-design/12-editor-routes-review.md`
   - 历史静态稿目录（`20-design/mockups/`，13 稿含母版视图，已被 playground 取代）：https://claude.ai/code/artifact/f4ed564b-f919-473e-9a1b-01644267366a
   - 可点击原型（`20-design/prototype/index.html`）**已退役**：交互基准以 playground 的 19 条路由为准；历史链接：https://claude.ai/code/artifact/a834469c-a2ea-46a8-8dad-28615c015803
   历史静态稿与原型本地直接打开亦可。
7. `30-architecture/` —— 架构（总览、分层与包目录、内核与插件模型、文档模型、命令与历史、协同、渲染、后端、类型治理、观测性、测试、多文档类型扩展、ADR）。
8. `40-modules/` —— 模块设计线（2026-09-18）：按 DDD 限界上下文 × cordis 插件切分的 13 个模块，每份细到目录树与逐文件职责；先读 `00-module-map.md`，再翻 `18`/`19` 两份架构图集建立全景，然后按 `40-modules/README.md` 的阅读顺序读（`_template` 模板、14 跨模块评审、16 插件总账、17 书写模式、15 服务端评审，最后按批次读 01–13）。

## 目录

```
docs/
├── README.md
├── 00-charter/          共同输入（总编排；_evidence/ 为裁决调研证据包）
├── 10-prd/              产品条线
├── 20-design/           设计条线（playground/ 为设计基准；prototype/、mockups/ 已退役）
├── 30-architecture/     架构条线：结构 / 运行时 / 类型治理（09-type-discipline/）+ adr/
├── 40-modules/          模块设计线：DDD 限界上下文 × cordis 插件（00 总图 / _template / 01–13 模块 / 14 跨模块评审 / 15 服务端评审 / 16 插件总账 / 17 书写模式 / 18、19 架构图集 / README）
└── _tools/              文档线工具：模块文档结构校验、Mermaid 校验（含绘图规范）、扫描器名校验、文档站生成器（gen-docs-site.py）与界面截图（capture-screens.cjs）、换机器迁移手册（MIGRATION.md）
```

## 状态约定

- 每个文档首行状态头：`> 状态：草稿 | 负责：<条线> | 更新：YYYY-MM-DD | 依赖：charter vX.Y`
- 状态取值：`草稿` → `评审中` → `已批准` → `已过时`
- 与章程冲突：不得擅改章程，写入本条线 README「对章程的异议/建议」
- 未决事项：写入本条线 README「待决事项」并标注决策人
- 图：Mermaid 11，改图后须通过 `_tools/mermaid-check.cjs`（0 invalid）；界面 ASCII 线框、目录树与代码结构仍用文本块（章程 §9.2 第 4 条；画法见 `_tools/README.md`「绘图规范」）

## 与 OpenSpec 的关系

本目录是长期有效的产品/设计/架构基线。具体的实现变更通过 `openspec/changes/<name>/`（proposal / design / specs / tasks）推进，并引用本目录中的文档。M0 结束时建议创建首个 change（如 `bootstrap-monorepo-and-gates`）把「目录骨架 + 全部门禁」落地。
