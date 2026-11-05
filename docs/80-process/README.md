# 80 研发流程

> 状态：草稿 | 负责：总编排 | 更新：2026-10-04（rulings §4.25：新建研发流程线——OpenSpec 变更为载体、文档先行、CI 硬门禁、需求编号贯穿五线、一个事实一个归属、设计质量门、main 主干 + PR；先补完 M0） | 依赖：charter v0.2；rulings §4.25；[PRD 05](../10-prd/05-milestones-and-scope.md) M0；[70/12](../70-testing/12-ci-gates-mapping.md)；[70/13](../70-testing/13-requirements-traceability.md)

本线规定从「想做一件事」到「代码合入、文档归档」的完整研发流程。它回答四个问题：

1. **一项工作怎么开、怎么走完**：一项功能或修正 = 一个 OpenSpec 变更，按五步推进，按三档决定要不要你确认（[01](01-change-lifecycle.md)）。
2. **新增功能怎么同时更新产品、设计、前端、后端、测试文档**：需求编号是贯穿五条线的主键，脚本检查每条需求在五条线都有落点；每类事实只有一个归属文档，其余只引用（[02](02-traceability-and-ownership.md)）。
3. **代码怎么被约束在文档之内**：CI 硬门禁 G1–G7——代码改动必须挂在评审通过的变更上，代码里的对外标识符与源文件必须先在文档登记（[03](03-gates.md)）。
4. **设计质量怎么守住**：界面改动先出样张，与标杆产品同尺寸对照、过检查清单，你拍板后才回写文档（[01](01-change-lifecycle.md) §4）。

## 1. 原则

| # | 原则 | 含义 | 依据 |
|---|---|---|---|
| P1 | 文档是唯一事实源 | 行为、界面、接口、数据、文件结构以 `docs/` 为准。代码与文档不一致时先判定谁错：文档错就先改文档，代码错就改代码。OpenSpec 不另建规格库（`openspec/specs/` 保持为空），变更只是工作容器 | 章程 §8；rulings §4.25 DP-1、DP-5 |
| P2 | 文档先行 | 改行为的变更先回写文档、经你确认，才进入写码；写码中发现文档不对，停下来先改文档 | rulings §4.25 DP-4 |
| P3 | 需求编号贯穿五线 | 每条需求在设计、前端或后端、测试文档中都能按编号找到落点，代码与测试用 `@req` 标注；缺一线且未声明「不涉及」即不通过 | rulings §4.25 TP-1 |
| P4 | 一个事实一个归属 | 每类事实只在一个文档里定义，其他文档只引用编号或链接；引用必须能解析 | rulings §4.25 TP-2 |
| P5 | 机械可验证 | 以上各条都由脚本检查，CI 不过不能合入，不设告警级别 | rulings §4.25 DP-2；[30/09/07](../30-architecture/09-type-discipline/07-hooks-and-ci.md)「不存在 warn 级别」 |
| P6 | 界面先样张后文档 | 界面改动先做 playground 样张并截图对照，你拍板后才回写设计文档 | rulings §4.25 TP-4；用户设计验收习惯 |

## 2. 一页总览

**图 1 一个变更从开到关**

```mermaid
flowchart LR
  pr["1 提案 proposal.md"]
  ds["2 文档 回写五线与样张"]
  rv["3 评审 你确认"]
  im["4 实现 design + tasks + 代码"]
  ar["5 归档 合入并归档"]
  pr --> ds --> rv --> im --> ar
  rv -->|"要改"| ds
  im -->|"发现文档不对"| ds
```

怎么读：一个变更依次经过五步；评审不通过、或实现中发现文档有误，都回到第 2 步先改文档。第 3 步之前不写产品代码；L1 变更的第 3 步由 agent 自审，不打扰你（[01](01-change-lifecycle.md) §1）。
依据：rulings §4.25 DP-1、DP-4；[01](01-change-lifecycle.md) §2。

## 3. 本线文件与配套文件

| 文件 | 内容 |
|---|---|
| [01-change-lifecycle.md](01-change-lifecycle.md) | 三档分级、五步的进入条件与产出、设计质量门、偏差处理、分支与提交、缺陷、代码评审、发布 |
| [02-traceability-and-ownership.md](02-traceability-and-ownership.md) | 需求编号主键与覆盖规则、事实归属表、文档间引用反查、变更的文档影响矩阵 |
| [03-gates.md](03-gates.md) | CI 硬门禁 G1–G7 的判定、实现脚本、运行位置与上线时间 |
| `openspec/config.yaml` | OpenSpec 项目上下文与各产物写作规则 |
| `openspec/schemas/cordex-docs-first/` | 本项目的 OpenSpec 工作流：proposal → docs-sync → design → tasks（不含 specs） |
| 仓库根 `CLAUDE.md` | 每个 agent 会话都会读到的流程摘要与禁止事项 |

## 4. 路线图

先补完 M0（rulings §4.25 DP-3），M0 范围按 PRD 05 原文执行、全部门禁在空骨架上跑通（DP-6）。设计语言 v3 与 M0 并行，只动文档与 playground。

| 序 | 变更 id | 内容 | 对应 | 级别 | 并行 |
|---|---|---|---|---|---|
| 1 | `dev-process` | 本线文档、OpenSpec 工作流、`CLAUDE.md`；`docs/_tools` 下 G1–G5 检查脚本与基线覆盖报告 | — | L2 | 与 2 并行 |
| 2 | `design-language-v3` | 去 ribbon、Figma 式结构与中性平面视觉（DS-1、DS-2）：样张 → 拍板 → 回写 PRD、设计 32 个界面、50/09、50/10、40/10、70/06 → playground 全量迁移 | — | L2 | 与 1 并行 |
| 3 | `docs-coverage-baseline` | 修补 `dev-process` 基线报告列出的需求覆盖缺口与引用失配 | G4、G5 归零 | L0/L2 | 1 之后 |
| 4 | `m0-monorepo-skeleton` | pnpm workspace、tsconfig 基线、按章程 §5.2 与 40-modules 目录树建全部空包与 `apps/*` 外壳；工具链版本（W-1） | M0 验收 4 前提 | L2 | 1 之后 |
| 5 | `m0-governance-gates` | eslint 配置与 21 条自定义规则、dependency-cruiser、api-extractor、14 个扫描器、`tooling/policy`、lefthook、commitlint，在空骨架上全部跑通 | M0 验收 4 | L2 | 4 之后 |
| 6 | `m0-ci-workflows` | `.github/workflows` 按 [70/12](../70-testing/12-ci-gates-mapping.md) 建全部 job，接入 G1–G7；main 分支保护必需检查 | M0 验收 4 | L2 | 5 之后 |
| 7 | `m0-adr-0001-spike` | 声明合并 spike，ADR-0001 给出「可行 / 退路」结论 | M0 验收 5 | L2 | 与 5、6 并行 |
| 8 | `m0-acceptance` | PRD 需求字段齐全脚本（验收 3）、M0 验收 1–5 逐项核对与评审纪要 | M0 验收 1–5 | L1 | 最后 |

M0 全部归档后，按 PRD 05 M1 范围拆 M1 变更，追加到本表。

## 5. 待决事项

| # | 事项 | 需要谁决策 | 默认处理 |
|---|---|---|---|
| W-1 | 工具链版本：章程 Q9 定 pnpm 11 + Node 26，本机现为 Node 24、pnpm 12 | 用户 | 在 `m0-monorepo-skeleton` 的提案里给出选项再裁决 |
| W-2 | 把「ppt在线编辑器初始化」合入 main、开启 main 分支保护的时点 | 用户（对外操作） | 合入在 `dev-process` 评审通过后提请；分支保护在 `m0-ci-workflows` 归档时提请 |
