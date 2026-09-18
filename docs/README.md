# 文档地图

> 项目：基于 cordis 的可插拔办公文档 SDK 与在线协同编辑器（首个文档类型：PowerPoint / .pptx）
> 阶段：M0 蓝图 | 更新：2026-09-18

## 阅读顺序

1. `00-charter/charter.md` —— 章程 v0.2：定义、硬约束、术语、架构基线（层带与秩表）、已定决策 D1–D16、里程碑、文档树、待用户决策 Q1–Q20。**先读这份。**
2. `00-charter/reference-univer-lessons.md` —— 从《Univer 架构评估》提炼的继承/规避清单（下游按编号引用）。
3. `00-charter/cordis-primer.md` —— cordis 4 的 API 摘要与本项目铁律。
4. `00-charter/rulings-2026-09-14.md` —— 对五条线异议/建议的逐条裁决（采纳/否决/待用户），解释 v0.1 → v0.2 的每处变化。
   下游文档状态头标注「依赖：charter v0.1」者，均已按裁决做了针对性修订；v0.2 与 v0.1 兼容（只增不改语义）。
4. `10-prd/` —— 产品需求（背景、角色、功能域、非功能、里程碑、指标）。
5. `20-design/` —— 设计（信息架构、流程、29 份界面规格、设计系统、协同 UX、扩展 UX、可访问性、原型自审与 v2 规划、高保真设计稿、设计 playground）。
   - **设计 playground**（`20-design/playground/`，shadcn/ui + Tailwind 实现的真实组件页面，2026-09-15 起唯一设计基准；第 21 版 2026-09-17：shadcn Rhea 风格 + Liquid Glass 材质层，应用首页 + 样式指南 + 17 条界面路由（共 19 条 hash 路由，全部 ready，登记表 `20-design/playground/src/routes/registry.ts`）亮/暗）：https://claude.ai/code/artifact/cf6e1a1a-986b-48bb-b743-5758dff419d2
   - **现代化改造（2026-09-16，已按路线 B 实施）**：审计 `20-design/10-modernization-audit.md`、提案 `20-design/11-modern-glass-redesign-proposal.md`；可点击样张（Rhea + 玻璃）：https://claude.ai/code/artifact/b6766867-9da7-4198-9ec4-fb05f43a7c76 ；三栏对比画廊：https://claude.ai/code/artifact/9d47af4e-3520-48bd-a6e9-f10dbd485e65
   - **编辑器族评审截图**（2026-09-16，108 张，宿主外壳内）：https://claude.ai/code/artifact/f8169a76-10d3-4440-9051-afea486adecf ；评审文档 `20-design/12-editor-routes-review.md`
   - 历史静态稿目录（`20-design/mockups/`，13 稿含母版视图，已被 playground 取代）：https://claude.ai/code/artifact/f4ed564b-f919-473e-9a1b-01644267366a
   - 可点击原型（`20-design/prototype/index.html`）**已退役**：交互基准以 playground 的 19 条路由为准；历史链接：https://claude.ai/code/artifact/a834469c-a2ea-46a8-8dad-28615c015803
   历史静态稿与原型本地直接打开亦可。
6. `30-architecture/` —— 架构（总览、分层与包目录、内核与插件模型、文档模型、命令与历史、协同、渲染、后端、类型治理、观测性、测试、多文档类型扩展、ADR）。

## 目录

```
docs/
├── README.md
├── 00-charter/          共同输入（总编排）
├── 10-prd/              产品条线
├── 20-design/           设计条线（含 prototype/index.html）
└── 30-architecture/     架构条线：结构 / 运行时 / 类型治理（09-type-discipline/）+ adr/
```

## 状态约定

- 每个文档首行状态头：`> 状态：草稿 | 负责：<条线> | 更新：YYYY-MM-DD | 依赖：charter vX.Y`
- 状态取值：`草稿` → `评审中` → `已批准` → `已过时`
- 与章程冲突：不得擅改章程，写入本条线 README「对章程的异议/建议」
- 未决事项：写入本条线 README「待决事项」并标注决策人

## 与 OpenSpec 的关系

本目录是长期有效的产品/设计/架构基线。具体的实现变更通过 `openspec/changes/<name>/`（proposal / design / specs / tasks）推进，并引用本目录中的文档。M0 结束时建议创建首个 change（如 `bootstrap-monorepo-and-gates`）把「目录骨架 + 全部门禁」落地。
