> 状态：占位 v0（正文 M3 开工前补齐） | 负责：前端设计线（包级规划）；总编排（落点确认） | 更新：2026-09-26（§4.20：按 rulings §4.20 FE-09 确认 00-module-map §10 Q-M8，新建本文件占位）；2026-10-15（design-language-v3 第 2 批：§2 命令清单注明 `comments.deleteThread` 只给文档 owner，rulings §4.25 DS-40；评论面板、撰写与钉的界面落在 slide-ui，见 40/10 §4.4；本文仍是占位） | 依赖：00-module-map.md §7 M-12 行与 §10 Q-M8、charter §5.2 `@cordexjs/comments` 行、rulings §4.19 D-COMMENTS-PKG、§4.20 FE-01/FE-09、ADR-0031 v0.2、50-frontend/08（行为事实源）、40-modules/10、11、12

# 20 评论客户端包（限界上下文 BC-25 评论的客户端部分）

> **本文件目前是占位。** rulings §4.20 FE-09 确认 00-module-map §10 Q-M8：iso 包 `@cordexjs/comments` 的包级规划单独成文，不并入 M-12（只含服务端）或 M-05（其四包对评论无感知）。**行为以 [50-frontend/08](../50-frontend/08-comments-and-version-history.md) 为准**；本文只负责包 / 文件级规划。正文按 `_template.md` 的 §0…§13 结构，由前端设计线在 **M3 开工前**补齐（rulings §4.20 推迟项「FE-09·正文」）。下面各节先写明已经定下的事实与待补清单，未定的内容不在此处先行假设。

## 0. 一页总览

| 项 | 值 |
|---|---|
| 职责一句话 | 评论的横向能力，**文档类型盲**：threads / replies 实体、ResourceHook `comments.threads`、`comments.*` 命令、`comment/*` 事件、锚点抽象（具体锚点由文档类型以 resolver 提供） |
| 覆盖的上下文 | BC-25（客户端部分；服务端镜像读模型、Webhook 与 REST 在 M-12） |
| 承载包 / 目录 | `@cordexjs/comments`（L4，秩 40，iso）；`package.json#cordex = { layer:'L4', iso:'iso', role:'plugin' }`，依赖上限 `model-core`（kernel、shared、protocol 按 L0 隐式口径），不依赖 `collab-*`（章程 §5.2） |
| cordis 形态 | plugin：宿主级贡献 ResourceHook 与命令；按 Unit 的 `comments` 服务经 preset 的 `scope:'unit'` 条目在 mount 时由 `units.registerUnitProvider` 登记（rulings §4.20 FE-01，M-02 §2.1） |
| 装配 | M3 起只装入 `preset-slide-collab`（条目 id `comments`，M-11 §3.1）；`preset-slide` 与查看器不装，未装时评论数据原样保留 |
| 里程碑 | M3（PRD CO-04 P0；「导入为可编辑线程」与重新锚定为 P1） |
| 文件规模 | 待补 |

## 1. 限界上下文与边界

### 1.1 职责与非职责

- 做：客户端评论数据（ResourceHook）、`comments.*` 命令与 Mutation、`comment/*` 事件、按 Unit 的只读查询服务、`comments.anchorResolver` 贡献点定义。
- 不做：slide 专属锚点解析、检查器「评论」页签、画布评论钉与缩略图角标（均由 `slide-ui` 贡献，M-10 §4.4：`infrastructure/comments/slide-anchor-resolver.ts`、`ui/inspector/CommentsTab.tsx`、`ui/canvas-overlays/CommentPins.tsx`）；服务端镜像、软门禁作者规则、Webhook 与跨文档「@我」REST（M-12 `comments`、`webhooks` 模块，60/07）。

### 1.2 通用语言

待补。术语以 50/08 §3（`Thread`、`Reply`、锚点 `anchor.kind`）与 ADR-0031 v0.2 为准。

### 1.3 上下文映射

待补。已定关系：下游 `slide-ui`（锚点 resolver、UI 贡献）；上游 `model-core`（ResourceHook、命令管线、UnitScope）；服务端镜像经协同 Y 状态与 `CONTROL.event{comments.changed}` 衔接（M-09、M-12）。

## 2. 领域模型

已定事实（形状以 50/08 §3–§4 与 ADR-0031 v0.2 为准，本文补齐时只登记落点）：

- **实体**：`Thread`、`Reply`，位于 `resources['comments.threads']` 下两张实体表；不入撤销栈（Store `undo.excludedNamespaces` 含 `comments.threads`，命令 `undoable:false`）。
- **Mutation**：`comments.thread.*`、`comments.reply.*`。
- **命令**：`comments.addThread`、`comments.reply`、`comments.editReply`、`comments.deleteReply`、`comments.deleteThread`、`comments.resolve`、`comments.reopen`、`comments.importThreads`（P1）、`comments.reanchor`（P1）；能力位与作者规则见 50/08 §4。2026-10-15（rulings §4.25 DS-40）：`comments.deleteThread` 只给文档 owner（`doc.manage`），发起人只能删自己的回复，服务端软门禁同一口径（ADR-0034 修订 2026-10-15、60/07 §2）。
- **事件**：`comment/*`（带 `origin`；正文默认脱敏、选项 `comments.events.includeBody`，50/15 §2，rulings §4.20 FE-16）。
- **UnitScope 服务** `comments`：按筛选列线程、单线程、每页未解决数、已脱离锚点列表。
- **贡献点** `comments.anchorResolver`：按 `documentType` 键，由文档类型提供锚点解析与校验 schema。

### 2.1 聚合与实体

待补。

### 2.2 值对象

待补。

### 2.3 领域服务

待补。

### 2.4 领域事件

待补。

### 2.5 仓储 / 存储契约

待补。

### 2.6 应用服务与命令

待补（命令清单已在本节开头列出，文件落点待补）。

## 3. cordis 插件定义

待补。已定：宿主级插件贡献 ResourceHook `comments.threads` 与命令；按 Unit 的 `comments` 服务以 `scope:'unit'` 条目登记为 UnitScope 默认 Provider（rulings §4.20 FE-01，不经文档类型的 `unitPlugins`）。

## 4. 目录树（完整到文件）

待补（M3 开工前）。须登记：`comments.anchorResolver` 贡献点定义、`comments` UnitScope 服务、`comments.reanchor` 与 `comments.importThreads` 的文件落点、契约套件文件、`./testing` 子路径。

## 5. 文件职责表

待补，与 §4 一一对应。

## 6. 对外 API 面

待补。须与 `slide-ui` 约定 resolver 接口（`slide-ui` `infrastructure/comments/slide-anchor-resolver.ts` 的实现契约），并按 `publicEntry` 规则登记子路径。

## 7. 前后端与运行时

待补。已定：iso 包，浏览器与服务端同一份源码；服务端镜像只按 `comments.` 前缀识别，不识别文档类型（决策 INC-39）。

## 8. doc / sheet 扩展缝

待补。已定：包本身文档类型盲，doc / sheet 只需各自贡献 `comments.anchorResolver`。

## 9. 测试布局

待补。测试场景与断言以 50/08 §12 与 70-testing 为准。

## 10. 机械约束

待补。已定：`package.json#cordex` 与依赖上限见 §0；秩规则由 depcruise 兜底。

## 11. 里程碑与实施顺序

M3（随 `preset-slide-collab` 装入）；P1 项可在 M3 后半段交付（50/08 §13）。**本文正文须在 M3 开工前补齐。**

## 12. 与现有文档的差异与追加建议

| # | 涉及文档 | 差异 / 发现 | 追加建议 |
|---|---|---|---|
| G-1 | 00-module-map §7 M-12 行、§10 Q-M8 | 包级规划此前寄放在 M-12 行、标注「待补」 | 已按 rulings §4.20 FE-09 确认落点为本文件；00 §7 M-12 行与 §10 Q-M8、README 索引已同步 |

## 13. 未决问题

| # | 问题 | 推荐默认值 | 影响范围 |
|---|---|---|---|
| Q-1 | 本文正文（目录树、文件职责、契约套件、resolver 接口）何时补齐、由谁补 | M3 开工前，由前端设计线补齐（rulings §4.20 推迟项「FE-09·正文」） | 本文件；M-10 `slide-ui` 评论相关文件；M-11 `collab.entries.ts` 的 `commentsEntry` |
