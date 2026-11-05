# 03 门禁

> 状态：草稿 | 负责：总编排 | 更新：2026-10-04（rulings §4.25 新建：CI 硬门禁 G1–G7 的判定、实现脚本、运行位置与上线时间）；2026-10-04（评审：§4 源文件范围改为含测试文件，DP-8）；2026-10-04（实现偏差：G5 补基线棘轮） | 依赖：charter v0.2；rulings §4.25；[01](01-change-lifecycle.md)；[02](02-traceability-and-ownership.md)；[70/12](../70-testing/12-ci-gates-mapping.md)；[70/13](../70-testing/13-requirements-traceability.md)；[40/01](../40-modules/01-tooling-and-governance.md)

门禁全部是硬门禁：不过即阻断，不设告警级别（[30/09/07](../30-architecture/09-type-discipline/07-hooks-and-ci.md) §3）。G1–G3 检查流程是否走对，G4–G6 检查内容是否一致，G7 是已有的文档检查。

## 1. 总表

| 门禁 | 判定 | 实现 | CI 步骤（`scanners` job 内） | 上线 |
|---|---|---|---|---|
| G1 关联变更 | 改动触及代码路径（§2.1）时，分支名为 `change/<id>` 或 PR 正文首行为 `Change: <id>`，且 `openspec/changes/<id>/` 存在、未归档；一个 PR 只关联一个变更 | `docs/_tools/check-change-impact.py --gate link` | `scanners/process-change-link` | 脚本随 `dev-process`；CI 随 `m0-ci-workflows` |
| G2 评审门 | 同一触发条件下：proposal 级别为 L2 时，docs-sync 的评审行为「已确认」；级别为 L1 时为「L1 自审」且写了理由；否则失败 | 同上 `--gate review` | `scanners/process-review-gate` | 同上 |
| G3 矩阵核对 | proposal 有 6 行影响矩阵且表态合法；「需更新」行在 docs-sync 有回写记录、文件存在且在本分支有改动；新增功能的强制行（[02](02-traceability-and-ownership.md) §4）；与其他进行中变更声明了同一文件时写了「依赖」；设计质量门触发时 docs-sync 有样张路由、对照截图、Q1–Q10 结论与拍板行 | 同上 `--gate impact` | `scanners/process-impact` | 同上 |
| G4 需求覆盖 | [02](02-traceability-and-ownership.md) §1.3：P0 / P1 需求在设计、前后端、测试文档都有落点或有落点豁免；对基线只减不增 | `docs/_tools/check-req-coverage.py` | `scanners/process-req-coverage` | 同上 |
| G5 文档引用反查 | [02](02-traceability-and-ownership.md) §3 首批六类引用全部能在归属文档中解析；对基线只减不增 | `docs/_tools/check-doc-refs.py` | `scanners/process-doc-refs` | 同上 |
| G6 代码 ↔ 文档登记 | 代码中的对外标识符都在归属文档登记（§3）；源文件（含测试文件）与 40-modules 目录树一致（§4） | `docs/_tools/check-doc-registry.py`、`docs/_tools/check-module-tree.py` | `scanners/process-doc-registry`、`scanners/process-module-tree` | 脚本、CI 均随 `m0-governance-gates`，在空骨架上跑通 |
| G7 文档检查 | `check-links`、`check-terms`、`check-plugin-counts`、`check-scanner-names` 全量；改了图跑 `mermaid-check`，改了 40-modules 跑 `validate-module`，改了 60-backend 的 SQL 跑 `ddl-check` | `docs/_tools` 现有脚本 | `scanners/docs-links`、`scanners/docs-terms`、`scanners/docs-plugin-counts`、`scanners/docs-scanner-names`、`scanners/docs-mermaid`、`scanners/docs-validate-module`、`scanners/docs-ddl` | 脚本已有；CI 随 `m0-ci-workflows` |

这些步骤挂在 [70/12](../70-testing/12-ci-gates-mapping.md) 已有的 `scanners` job 下，不新增 job（13 个 job 名是封闭集合，rulings §4.18）；登记进 70/12 §2、§7 与 `tooling/ci/steps.json` 的工作在 `dev-process` 的文档步完成。`m0-ci-workflows` 之前没有 CI，agent 在本地运行全部门禁，把输出摘要写进 docs-sync 的「检查结果」。

## 2. G1–G3 细则

### 2.1 代码路径

`packages/**`、`apps/**`、`tooling/**`、`.github/**`、`openspec/schemas/**`，以及仓库根的 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`tsconfig*.json`、`lefthook.yml`、`.node-version`。只改 `docs/**` 的提交是 L0，不触发 G1–G3，只过 G4、G5、G7。

### 2.2 proposal 与 docs-sync 的机读格式

- proposal：一行 `级别：L0|L1|L2`；可选一行 `依赖：<id>[、<id>]`；`## 文档影响矩阵` 下的表格，列为「线 / 表态 / 说明」，6 行线名固定为产品、设计、前端、后端、测试、其他。
- docs-sync：`## 回写记录` 表（线 / 文件 / 章节 / 摘要）；`## 检查结果` 表（检查 / 结果）；`## 评审` 下一行 `评审：已确认 | 确认人：<名> | 日期：<YYYY-MM-DD>` 或 `评审：L1 自审 | 理由：<…>`；设计质量门触发时 `## 设计质量门` 下列样张路由、截图路径、Q1–Q10 结论与 `拍板：已确认 | 日期：<…>`；`## 偏差记录` 表（日期 / 发现 / 处理 / 是否重新评审）。
- 模板在 `openspec/schemas/cordex-docs-first/templates/`，G3 按模板的标题与列名解析。

### 2.3 「在本分支有改动」

以 `git merge-base origin/main HEAD` 为基点，文件在基点之后的提交或工作区中有改动即算。CI 中基点取 PR 的目标分支。

## 3. G6：标识符登记

| 标识符 | 代码中怎么识别 | 归属文档 |
|---|---|---|
| 错误码 | 错误码定义处的字符串常量 | `30-architecture/10` |
| REST 路由 | Nest 控制器前缀 + 方法装饰器路径 | `60-backend/15` |
| 协同消息类型、关闭码 | `@cordexjs/protocol` 的消息与关闭码常量 | `30-architecture/06` |
| 事件名 | 事件发布处的事件名字符串 | `50-frontend/15`、`30-architecture/10` |
| 配置键 | 配置 schema 的键路径 | `60-backend/17` |
| 迁移文件 | `apps/server/src/db/migrations/NNNN_*.sql` | `60-backend/08` §10.1（内容逐字一致仍由 `scanners/check-migrations-sync` 负责） |
| cordis 插件 id、贡献点 id | 插件定义的 `id` 与贡献点声明 | `40-modules/16` |
| npm 包名 | `packages/*/package.json` 的 `name` | 章程 §5.2 |
| 需求标签 | 测试中的 `@req` | PRD；语法与存在性沿用 `scan-requirement-tags`（[70/13](../70-testing/13-requirements-traceability.md) §10），G6 不重复 |

每类标识符的具体抽取方式（正则或 TypeScript AST）在 `m0-governance-gates` 的 design.md 里确定；方向是「代码 → 文档」：代码出现、文档没有即失败。文档登记了而代码尚未实现的，只进覆盖报告。

## 4. G6：源文件与 40-modules 目录树

用户裁决 40-modules 在代码落地后继续逐文件维护（rulings §4.25 DP-5），且测试文件同样逐个登记（DP-8）：

- **源文件**：`packages/*/` 与 `apps/*/` 下的全部源码与测试文件——`src/**`、各包测试目录（`test/**`、`e2e/**` 等，落点见 [70/01](../70-testing/01-strategy-and-layers.md) 与各模块 §9）——**测试文件也逐个登记**（rulings §4.25 DP-8）。构建产物、依赖目录与锁文件不在范围内。
- **代码 → 文档**：每个源文件都必须出现在所属模块文档的 §4 目录树与 §5 文件表中，否则失败。新增或移动源文件的变更先改 40-modules，再写代码。
- **文档 → 代码**：模块文档 §4 标题下写一行 `落地：未开始 | 进行中 | 完成`。「完成」的模块，目录树登记的每个文件都必须存在（两个集合相等）；「未开始」「进行中」只检查代码 → 文档方向。
- 所属模块按 40-modules/00 模块总图的包 → 模块映射确定。

## 5. 本地运行

- **lefthook pre-commit**：对暂存的文档跑 G7 中相关的快速检查（链接、术语、改了图时的 mermaid lint）。
- **lefthook pre-push**：G1–G6 全量。
- lefthook 在 `m0-governance-gates` 落地之前，agent 手动运行同样的命令。命令清单与本地复现方式登记在 `docs/_tools/README.md` 与 [70/12](../70-testing/12-ci-gates-mapping.md) §12。
