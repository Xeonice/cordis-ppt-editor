# ADR-0016 文档类型盲的验证：夹具文档类型、水平层测试隔离与水平层冻结

> 状态：草稿 | 负责：架构-结构 | 更新：2026-09-15 | 依赖：charter v0.1

## 状态

提议。

## 背景

章程 R5/M5：水平层文档类型盲；M5 用 `model-doc`/`model-sheet` 骨架验证「水平层零改动」。Univer 的 `core` 里有 3.4 万行 sheets/docs 模型（A1），`unitId + subUnitId` 是 workbook 形状（A2）。仅靠 depcruise 不足：形状泄漏可以不 import 任何包（例如 `SceneNode.slideId` 字段、`'slide'` 字面量分支）。

## 决策

四层验证（12 §4）：

1. **静态**：depcruise R3/R4（水平层禁 import 垂直束；束间互不依赖）；lint `no-doc-type-literals`（水平层源码禁止 `slide|slides|sheet|workbook|docx|pptx|xlsx|paragraph` 等词根的字面量/标识符片段，允许列表：fixtures、注释、`model-core/testing/fixture-*`、`ooxml-core` MIME 常量表）；扫描器 `no-doc-fields-in-contracts`（`engine-render`/`model-core` 公共类型属性名同样禁词）。
2. **夹具**：`@oce/model-core/testing` 提供 `fixture` 文档类型（键值树 + 文本块）与 `fixture-grid`（网格键空间，模拟 sheet），各含 Mutation/Command/Operation/FormatCodec/ResourceHook/Migration/SceneProvider/ElementRenderer/UI 贡献；**水平层包的 `__tests__` 只允许使用夹具类型**（depcruise `horizontal-tests-use-fixture-only`：水平层测试不得 import `@oce/model-slide*`/`ooxml-pptx`/`slide-*`）。
3. **运行时**：`preset-blind.test.ts`：仅水平层 + 夹具 → 打开、编辑、撤销、快照往返、迁移、渲染（RecordingTarget）全流程；两个夹具类型同页共存；移除全部 `DocumentType` 后打开返回 `format.no_document_type`（PRD CS-05 口径），host 仍健康。
4. **冻结**：`tooling/scanners/horizontal-freeze` 计算无 `oce.bundle` 的包 `src/**`（排除 `__tests__`）内容哈希 → `fixtures/horizontal-freeze.lock`；M5 的 `model-doc`/`model-sheet` PR 要求锁文件无 diff；确需改水平层 → PR 附 ADR 并显式更新锁（可审计）。
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

- CI job `doc-type-blindness`：R3/R4 + `no-doc-type-literals` + `no-doc-fields-in-contracts` + `horizontal-tests-use-fixture-only` + `preset-blind.test.ts`。
- CI job `horizontal-freeze`（M5 起为 PR 必需）。
- 夹具类型自身通过 `defineLifecycleSuite`、`runDocumentStoreConformance`（作为 body 样例）。

## 关联

章程 R5、M5、§5.4；PRD CS-05、R-M5-1；Univer A1/A2；12；02 §7；09-02/03/06。

## 修订 2026-09-18（14 §1 C-16）

错误码拼写统一：「移除全部 `DocumentType` 后打开」的错误码由本文此前的 `format/no-document-type`（误用事件名的 `/` 分隔符）改为点式值 `format.no_document_type`，与章程 §5.4 原文、PRD `05-milestones-and-scope.md`、`00-module-map.md` §6.5 的拼写一致（TS 常量名仍为 UPPER_SNAKE，错误码**值**一律点式的双口径通则见 `40-modules/14-cross-module-review.md` §1 C-16）。
