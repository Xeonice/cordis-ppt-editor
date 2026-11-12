# ADR-0016 文档类型盲的验证：夹具文档类型、水平层测试隔离与水平层冻结

> 状态：草稿 | 负责：架构-结构 | 更新：2026-09-15；2026-09-25（矛盾收口，rulings §4.18） | 依赖：charter v0.1；裁决 `docs/00-charter/rulings-2026-09-14.md` §4.18 FE-01/GV-14/GV-15

## 状态

提议。

## 背景

章程 R5/M5：水平层文档类型盲；M5 用 `model-doc`/`model-sheet` 骨架验证「水平层零改动」。Univer 的 `core` 里有 3.4 万行 sheets/docs 模型（A1），`unitId + subUnitId` 是 workbook 形状（A2）。仅靠 depcruise 不足：形状泄漏可以不 import 任何包（例如 `SceneNode.slideId` 字段、`'slide'` 字面量分支）。

## 决策

四层验证（12 §4）：

1. **静态**：depcruise R3/R4（**非组合根的**水平层禁 import 垂直束；束间互不依赖）。组合根（`cordex.compositionRoot: true` 的 `preset-*`、`apps/web`、`apps/server`）不受 R3 约束：preset 带 `bundle`（`preset-slide*` 标 `slide`、`preset-doc` 标 `doc`），因此受 R4 约束；`apps/web` 仍受 R9 白名单约束、不能直接 import 束包；`server-headless` 不再 import `model-slide`/`ooxml-pptx`，slide 插件集由 `apps/server` 的 `preset-server.ts` 装配（2026-09-25 修订，rulings §4.18 FE-01，用户选「豁免组合根并盲化」；原：「水平层禁 import 垂直束」不分组合根，按字面 preset、apps 与 server-headless 都会被 R3 拦下，与章程 §5.2 依赖上限矛盾，作废）；lint `no-doc-type-literals`（水平层源码禁止 `slide|slides|sheet|workbook|docx|pptx|xlsx|paragraph` 等词根的字面量/标识符片段，允许列表：fixtures、注释、`model-core/testing/fixture-*`、`ooxml-core` MIME 常量表）；lint `cordex/no-doc-type-literals` 的公共类型属性名子检测（`engine-render`/`model-core` 导出类型的属性名同样禁文档类型词根，09-type-discipline/02 §4.12，TD-086）+ api-extractor 基线审查（原名 `no-doc-fields-in-contracts`、原称扫描器，2026-09-25 按 09-type-discipline/08 §11 对照表改写，rulings §4.18 GV-15）。
2. **夹具**：`@cordexjs/model-core/testing` 提供 `fixture` 文档类型（键值树 + 文本块）与 `fixture-grid`（网格键空间，模拟 sheet），各含 Mutation/Command/Operation/FormatCodec/ResourceHook/Migration/SceneProvider/ElementRenderer/UI 贡献；**水平层包的 `__tests__` 只允许使用夹具类型**（depcruise `horizontal-tests-use-fixture-only`：水平层测试不得 import `@cordexjs/model-slide*`/`ooxml-pptx`/`slide-*`）。需要真实 slide 束的服务端测试（如 `server-collab` 的 `soft-gate-repair.test.ts`）迁到 `apps/server` 集成测试——只有组合根能同时 import `server-collab` 与 `model-slide`；`server-collab` 自身测试改用 fixture 文档类型（rulings §4.18 FE-01）。
3. **运行时**：`preset-blind.test.ts`：仅水平层 + 夹具 → 打开、编辑、撤销、快照往返、迁移、渲染（RecordingTarget）全流程；两个夹具类型同页共存；移除全部 `DocumentType` 后打开返回 `format.no_document_type`（PRD CS-05 口径），host 仍健康。
4. **冻结**：`horizontal-freeze` 脚本（落点以 40-modules/01、13 为准）计算**无 `cordex.bundle` 且非组合根**的包 `src/**`（排除 `__tests__`）内容哈希（2026-09-25 修订，rulings §4.18 FE-01：冻结范围排除 `compositionRoot:true` 的包，`server-*` 因已文档类型盲而在冻结范围内，满足 PRD 05 M5「server-* diff = 0」；原：「`tooling/scanners/horizontal-freeze` 计算无 `cordex.bundle` 的包」，作废） → `fixtures/horizontal-freeze.lock`；M5 的 `model-doc`/`model-sheet` PR 要求锁文件无 diff；确需改水平层 → PR 附 ADR 并显式更新锁（可审计）。
5. **设计时**：04/12 中每个水平层抽象必须回答「doc 怎么用 / sheet 怎么用」（12 §2 表）；评审 checklist 项（PRD R-M5-1：`Selection`/`Unit` 用反例评审）。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 只靠 depcruise | 抓不到字段/字面量级泄漏 |
| 在 M1 就实现 doc/sheet 骨架 | 成本高；夹具类型以更低成本覆盖抽象面，且更「陌生」（不像三种真实类型中的任何一种） |
| 靠评审 | Univer 的教训：没有机制保证正确做法被一致采用 |
| 用 `model-slide` 作为水平层测试语料 | 会把 slide 形状悄悄写进水平层测试（测试通过≠盲） |

## 后果

- 正：盲性有四道机械防线；M5 验收可量化（锁文件 diff = 0、depcruise 横向依赖 = 0）。
- 负：夹具类型需要维护（它本身是一个小型垂直束，但只在 `testing/`）；`no-doc-type-literals` 的允许列表需要治理（09-02）。

## 如何被机械验证

- 文档类型盲拆回既有 job 的步骤（2026-09-25，rulings §4.18 GV-14：13 个 job 名封闭集合不变；原「CI job `doc-type-blindness`」「CI job `horizontal-freeze`」作废）：depcruise job 跑 R3/R4 与 `horizontal-tests-use-fixture-only`；lint job 跑 `no-doc-type-literals`（含原 `no-doc-fields-in-contracts` 的属性名子检测）；test job 跑 `preset-blind.test.ts`；scanners job 的 `horizontal-freeze` 步骤（M5 起为 PR 必需）。
- （2026-09-25，rulings §4.18 FE-01）组合根豁免的正负向夹具：`apps/web → preset` 通过、`preset-slide → model-slide` 通过、`engine-render → model-slide` 被 R3 拒绝、`preset-doc → model-slide` 被 R4 拒绝、`apps/web → model-slide` 被 R9 拒绝。
- 夹具类型自身通过 `defineLifecycleSuite`、`runDocumentStoreConformance`（作为 body 样例）。

## 关联

章程 R5、M5、§5.4；PRD CS-05、R-M5-1；Univer A1/A2；12；02 §7；09-02/03/06。

## 修订 2026-09-18（14 §1 C-16）

错误码拼写统一：「移除全部 `DocumentType` 后打开」的错误码由本文此前的 `format/no-document-type`（误用事件名的 `/` 分隔符）改为点式值 `format.no_document_type`，与章程 §5.4 原文、PRD `05-milestones-and-scope.md`、`00-module-map.md` §6.5 的拼写一致（TS 常量名仍为 UPPER_SNAKE，错误码**值**一律点式的双口径通则见 `40-modules/14-cross-module-review.md` §1 C-16）。
