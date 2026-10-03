# 13 需求 → 测试可追溯矩阵

> 状态：v0.1 | 负责：测试设计线 | 更新：2026-09-25；2026-09-25（§4.19）；2026-09-25（§4.19 N1）；2026-09-26（§4.20）；2026-09-26（§4.21：新增能力 id 追溯——`@cap` 标签、`capabilities.json`、R11 与 §5a 能力 id → 测试用例表）；2026-09-26（§4.21 整合：§3.3 / §3.4 登记 PRD 05 M2 验收 18、M3 验收 19 为既有检查子集（ED-15a、ED-31–ED-35；图表编辑往返判定）；§6 CO-10 行改 step2 单设 16 MiB；§7 0023 行改 provider v3/v4 互连，新增 0039 行；关闭码测试名改 close-policy.test）；2026-09-26（§4.21 复核：能力数改 165，补 INS-20 行）；2026-10-01（§4.23 插件管理：`@req` 前缀加 `PM`、§1.1 登记 `4.23` 的 id 生成口径；§3 新增 `plugins:diagnose`（M2）、`plugins:admin` 与 `plugins:consistency`（M3）、`plugins:trust`（M4）；§5 加 PM 域；新增 §6.5 §4.23 裁决映射与 PM-01…PM-16 → 测试表；`@cap` 前缀加 `PLG`、§5a 加 PLG-01…PLG-07 行，计数改 26 域 172 项）；2026-10-03（§4.24 设计线对齐审计：§1.1、§2 登记 `4.21`、`4.22`、`4.24` 的 id 生成口径；§6 新增 §6.6 §4.21（23 题与有测试要求的默认值）、§6.7 §4.22（Q1–Q3、SF、D、DF 中有测试要求的条目）、§6.8 §4.24（AL-1…AL-7、TA-1…TA-10），图 13-9；§7 新增 ADR 0018、0019、0036、0049、0050 五行；§3 插件四个检查名与§5a TBL / CHT 行补本轮新增测试；§11 登记） | 依赖：[50/18](../50-frontend/18-editor-capabilities.md) §1.3、§2–§26（rulings §4.21）、rulings §4.20（含来源所指 `_evidence/leftovers-plan-2026-09-26.json` 的 `plan.mechanical`、`plan.deferred`）、rulings §4.19（含末句所指 `_evidence/design-tracks-plan-2026-09-25.json` 的 `leftoverDecisions`）、[30/11 §17](../30-architecture/11-testing-strategy.md)、[09-06 §12](../30-architecture/09-type-discipline/06-scanners.md)、[09-07 §2.1](../30-architecture/09-type-discipline/07-hooks-and-ci.md)、[PRD 04](../10-prd/04-non-functional-requirements.md) NF-09、[PRD 05](../10-prd/05-milestones-and-scope.md) §0.2 / M0 验收 3 / M0–M5 验收与可插拔证据 / §6、[PRD README](../10-prd/README.md) §1.3、[PRD 03/03](../10-prd/03-features/03-collaboration.md) CO-01–CO-15、30-architecture/adr 各 ADR「如何被机械验证」、rulings §4.15 / §4.17 / §4.18、[40/14 §5](../40-modules/14-cross-module-review.md)

本文是需求追溯的唯一事实源：测试上的三类追溯标签怎么写、需求与检查名清单从哪里生成、矩阵怎么产出和判定、PRD 检查名目录、NFR / 裁决 / ADR 到测试的映射、人工与半机械项、维护流程。标签的格式与存在性检查、矩阵产出由扫描器 `scan-requirement-tags`（09-06 §12）执行；完整性判定在 `test/requirement-matrix` 步骤（[12](./12-ci-gates-mapping.md)）；扫描器本身不判定完整性（09-06 §12 的职责边界）。

**本文拥有 / 引用**

| 本文拥有 | 引用（以对方为准） |
|---|---|
| 标签语法与位置；`requirements.json`、`capabilities.json` 等清单的生成口径；判定规则 R1–R11；能力 id → 测试用例的追溯表（§5a）；PRD 检查名 → 测试 → 步骤 → 形态的目录；NFR、裁决、ADR 的映射与义务清单；人工项的统计口径；维护流程 | 需求本身：PRD；能力 id、所属域与里程碑：[50/18](../50-frontend/18-editor-capabilities.md)；验收阈值与检查名定义：PRD 05；扫描器规格：09-06 §12；CI 步骤名与激活：[12](./12-ci-gates-mapping.md)；证据文件头格式：[01 §8](./01-strategy-and-layers.md)；安全用例目录：[10](./10-security-testing.md) |

---

## 1. 机制

依据：决策 T-REQ（needsUser=false；authority：PRD NF-09 + 09-06 §12「扫描器不判定完整性」+ rulings §4.18 条目编号与 PRD 同形）。

### 1.1 三类标签

| 标签 | 语法（正则） | 例 | 指向 | 存在性校验来源 |
|---|---|---|---|---|
| `@req` | `PRD:(OF\|ED\|CO\|PS\|EM\|SV\|ML\|AS\|PM\|NF)-\d{2}` | `@req PRD:SV-05` | PRD 需求 id（PRD 03 九个功能域（2026-10-01 加 PM，rulings §4.23） + PRD 04 的 NF；PRD 06 的 MT 指标不是需求，不作标签） | `tooling/policy/requirements.json` |
| `@ruling` | `4\.\d{1,2}/[A-Z][A-Z0-9]*(-[0-9A-Za-z]+)*` | `@ruling 4.18/CO-08`、`@ruling 4.15/Q3`、`@ruling 4.17/D4`、`@ruling 4.19/SESSION` | rulings 各节的条目 id（表格第一列；§4.18 另含「规格空白默认值」列表与「机械修正」清单的 id，§2）；组合 id（如 `INC-03/04/05`、`C-20/G-13/G-14`）拆成单个 id 各写一次 | `tooling/policy/rulings.json` |
| `@adr` | `\d{4}/\d{1,2}` | `@adr 0029/3`、`@adr 0025/8` | ADR「决策」节的条目序号（决策只有一段时记为 1） | `tooling/policy/adrs.json` |
| `@cap`（2026-09-26 追加） | `(SEL\|ALN\|ARR\|INS\|TXT\|FMT\|PIC\|MED\|TBL\|CHT\|ML\|SLD\|VIEW\|FND\|CLP\|UND\|CMT\|SHW\|EXP\|COL\|OFF\|KEY\|UI\|A11Y\|I18N\|DOC\|PLG)-\d{2}` | `@cap SEL-10`、`@cap INS-13`、`@cap PLG-02` | 编辑器能力 id（[50/18](../50-frontend/18-editor-capabilities.md) 各域能力表首列，26 域 172 项；2026-10-01 加插件管理域 `PLG`，§26a） | `tooling/policy/capabilities.json` |

- **为什么要前缀**：rulings §4.18 的条目编号（`CO-08`、`BE-02`、`UX-03`…）与 PRD 需求编号同形，`CO-08` 单独出现时无法判断指 PRD「冲突语义」还是裁决「故障期广播」。`PRD:` 与 `<节>/` 前缀使两者不会混淆。
- **`4.19`**：§4.19 的条目集合 = 该节表格第一列的 5 项用户裁决（D-M2-CONTENT、INC-09、C-06、D-COMMENTS-PKG、D-TEST-INFRA）+ 表末单独一行的补完阶段用户裁决 `N1-IMPORT-OVERWRITE-RESTORE-LOCK`（2026-09-25 追加）+ 按 §4.19 末句读取 `00-charter/_evidence/design-tracks-plan-2026-09-25.json` 的 `leftoverDecisions[].id`（共 81 条，含上述 5 项，其余 76 项为 INC-*、SESSION、C-*、T-* 等；组合 id 拆开，省略前缀的段继承前一段前缀，如 `INC-03/04/05` → `INC-03`、`INC-04`、`INC-05`，`C-20/G-13/G-14` → `C-20`、`G-13`、`G-14`）。两部分取并集，都由生成脚本写入 `rulings.json`（§2），`@ruling 4.19/<id>` 与其它节一样做存在性检查：`@ruling 4.19/SESSION`、`@ruling 4.19/T-CI` 等标签只有在读取 evidence 后才能通过，不另设「只查格式」的过渡口径。
- **`4.20`**（2026-09-26 追加）：§4.20 的条目集合 = 该节表格第一列 15 项（3 项用户决策 + 12 项默认值）+ 按 §4.20 来源所指读取 `00-charter/_evidence/leftovers-plan-2026-09-26.json` 的 `plan.mechanical[].id`（25 条）与 `plan.deferred[].id`（5 条）。组合 id 按 `+` 拆开（`BE-01+TX-03` → `BE-01`、`TX-03`）；`·` 之后的后缀先去掉再拆（`BE-07+TX-05·登记` → `BE-07`、`TX-05`，`FE-09·正文` → `FE-09`）；拆出的重复 id 合并。例：`@ruling 4.20/BE-01`、`@ruling 4.20/TX-22`、`@ruling 4.20/FE-04`。
- **`4.23`**（2026-10-01 追加）：§4.23 的条目集合 = 裁决表的三题（第一列为纯数字，生成脚本记为 `Q1`、`Q2`、`Q3`）+ 开放问题表 `O-1`…`O-4`（2026-10-01 用户确认按推荐）。§4.23「本节新增编号」中的 PM-01…PM-16 是 PRD 需求 id，走 `@req PRD:PM-xx`，G-84…G-87 是设计缺口、无测试要求，均不进 `rulings.json`。例：`@ruling 4.23/Q3`、`@ruling 4.23/O-1`。
- **`4.21`**（2026-10-03 追加，rulings §4.24 要求补登）：§4.21 的条目集合 = 裁决表第一列 23 项 + 「默认值」各簇列出的 `R-d-01`…`R-d-78`、`H-d-01`…`H-d-32`。裁决表的 id 是小写并可带证据前缀，不满足 `@ruling` 正则，生成脚本按固定规则改写：冒号换连字符、整体转大写（`q-table-depth` → `Q-TABLE-DEPTH`，`H:q-hp-step2-cap` → `H-Q-HP-STEP2-CAP`，`X:q-xml-lexer` → `X-Q-XML-LEXER`）；R 与 X 都有 `q-xml-lexer`，分别为 `Q-XML-LEXER` 与 `X-Q-XML-LEXER`，两行口径一致，标签写哪一个都可。默认值 id 原样保留（`R-d-65`、`H-d-08` 本身满足正则）；「`R-d-61、R-d-62`」「`H-d-01…H-d-03`」这类并列与区间写法拆成单个 id（区间按序号展开）。例：`@ruling 4.21/Q-TABLE-DEPTH`、`@ruling 4.21/H-Q-HP-PERSIST-ACK`、`@ruling 4.21/R-d-65`。
- **`4.22`**（2026-10-03 追加）：§4.22 的条目集合 = 裁决表三题（`Q1-insert-placement`、`Q2-placeholder-table-icon`、`Q3-table-row-limit`，原样，满足正则）+ 「默认值」与「推迟项」中的 `SF-01`…`SF-14`、`D-01`…`D-25`、`DF-01`…`DF-10`；「`D-04、D-05`」「`SF-10…SF-12`」「`D-19、D-20`」等并列与区间写法拆开。§4.22 的 `D-xx` 与 §4.17 的 `D1`…`D5` 靠节号前缀区分（`4.22/D-03` 与 `4.17/D3` 不同形）。「待用户确认的样张取舍」`SR-1`…`SR-5` 未裁决、无测试要求，不进 `rulings.json`。例：`@ruling 4.22/Q1-insert-placement`、`@ruling 4.22/D-13`、`@ruling 4.22/DF-10`。
- **`4.24`**（2026-10-03 追加）：§4.24 的条目集合 = 用户裁决表 `AL-1`…`AL-7` + 总编排裁定表 `TA-1`…`TA-10`，原样（满足正则）；「需要下游落地的清单」按线分行、无 id，不进 `rulings.json`。例：`@ruling 4.24/AL-3`、`@ruling 4.24/TA-9`。
- **`@cap`**（2026-09-26 追加，rulings §4.21）：能力 id 比 PRD 需求 id 细一级（例如 PRD ED-05 下分出 SEL-10 调整手柄、SEL-11 翻转、INS-03 形状库），用来回答「编辑器的每一项能力有没有测试」。它不替代 `@req`：同一个测试通常同时带 `@req PRD:ED-05` 与 `@cap SEL-11`，P0 / P1 的门禁仍由 `@req` 经 R1、R5 执行，`@cap` 只进 R11 报告。能力 id 前缀没有冒号前缀，因为它们与 PRD（`PRD:`）和裁决（`4.xx/`）的编号都不同形。
- **旧写法作废**：30/11 §17 的文件顶部 `// @req CO-08` 与 09-06 §12 规则 (a) 的正则 `^[A-Z]{2,3}-\d{2,3}$` 按本节改写（回写见 §11）；旧写法由规则 (a) 报错并提示新写法。

### 1.2 写在哪里

- 写在 `describe` / `it` / `test` 正上方的 JSDoc 里；一个 JSDoc 可以有多个标签，同一标签后可跟多个以空格分隔的 id。`describe` 上的标签作用于其内全部用例。
- **文件级**：文件中第一个 JSDoc 块（位于任何 `import` 之前）视为文件级，作用于该文件全部用例。Vitest、Playwright、`*.int-spec.ts`、`*.e2e-spec.ts`、`*.type-test.ts` 同一写法。
- **人工证据**：`test/evidence/<里程碑>/<检查名>.md` 的文件头（YAML）用同名字段 `req`、`ruling`、`adr` 列出 id，语法同上；`check` 字段写 PRD 检查名（字段全集见 [01 §8](./01-strategy-and-layers.md)）。

```ts
/**
 * @req PRD:SV-05 PRD:NF-03
 * @ruling 4.18/CO-08
 * @ruling 4.19/INC-09
 */
describe('PG 断开期间照常广播', () => {
  /** @adr 0025/1 */
  it('两客户端互见编辑，PG 恢复后 seq 连续', async () => { /* … */ })

  /** @adr 0025/8 */
  it('溢写期只回 tier spill 的 ack，客户端 pending 不清', async () => { /* … */ })
})
```

### 1.3 产出与判定

- **扫描器 `scan-requirement-tags`**（`scanners` job 与 pre-commit，09-07 §2.1）：规则 (a) 语法；(b) id 存在于对应清单；(c) 产出 `dist/requirement-test-matrix.json`，条目扩展为 `{ tag: 'req' | 'ruling' | 'adr' | 'cap', id, tests: [{ file, title, line, scope: 'file' | 'describe' | 'test' }] }[]`（回写 09-06 §12，§11）。
- **判定器 `test/traceability/judge.ts`**（`test/requirement-matrix` 步骤）：读矩阵、`requirements.json`、`check-names.json`、`obligations.json`（本文 §4、§6、§7 的机器副本）、`tooling/ci/steps.json`、`tooling/policy/milestones.json`、证据文件头、`test/security/*.json`，产出 `dist/traceability-report.{json,html}` 与一条 PR 注释。
- **里程碑状态**：`milestones.json` 为每个里程碑记录 `status ∈ {planned, active, exit-review, done}`（在既有「完成日期」字段之外新增，回写见 §11）。

| 规则 | 内容 | 失败还是报告 |
|---|---|---|
| R1 | P0 需求：所属里程碑为 `exit-review` 或 `done` 时，至少一个带 `@req PRD:<id>` 的测试被某个已激活步骤（`mode ≠ off`）收集；清单中标为人工的需求改为要求 `result: pass` 的证据文件 | 失败 |
| R2 | 同上，但所属里程碑为 `active`：列出缺口 | 报告 |
| R3 | 覆盖只增不减：main 上已有覆盖的 id（任一标签），PR 后失去全部覆盖即失败；需求已从 PRD 删除（不在新 `requirements.json` 中）除外 | 失败 |
| R4 | PRD 检查名：`exit-review` / `done` 里程碑的每个检查名在 `check-names.json` 中映射到的步骤都已激活、测试文件模式非空、人工项有证据 | 失败（`active` 时报告） |
| R5 | `e2e:editing`：M2 进入 `exit-review` 起，每条 P0 / P1 的 ED 需求至少一个标签位于 `apps/web/e2e/**` | 失败 |
| R6 | 义务：`obligations.json` 中里程碑已到 `exit-review` / `done` 的裁决与 ADR 义务都有对应 `@ruling` / `@adr` 标签 | 失败（`active` 时报告） |
| R7 | 本 PR 新增、却没有任何追溯标签的测试文件 | 报告（PR 注释提示） |
| R8 | 安全用例目录与 ASVS 映射完整（[10 §16](./10-security-testing.md)） | 失败 |
| R9 | 证据文件头字段齐全、`result` 取值合法 | 失败 |
| R10 | `gen-requirements --check`：PRD、rulings 或 50/18 改动后未重新生成清单 | 失败 |
| R11 | 能力 id（2026-09-26 追加）：`capabilities.json` 中主里程碑为 `exit-review` / `done`、本轮后覆盖度为「已写清」或「补齐」的能力，没有任何带 `@cap` 的测试被已激活步骤收集；逐域列出缺口（§5a） | 报告 |

**图 13-1 追溯矩阵的生成与门禁**

```mermaid
flowchart LR
  tests["测试文件与证据文件头：@req、@ruling、@adr"] --> scan["扫描器 scan-requirement-tags：语法与存在性"]
  scan --> matrix["dist/requirement-test-matrix.json"]
  prd["PRD 03 与 04：需求 id、优先级、里程碑"] --> gen["gen-requirements"]
  prd05["PRD 05：验收检查名"] --> gen
  rul["rulings 与 ADR 全文"] --> gen
  gen --> reqj["requirements.json、check-names.json、rulings.json、adrs.json"]
  reqj --> scan
  obl["obligations.json：本文 §4、§6、§7"] --> judge["test/requirement-matrix：判定 R1–R11"]
  steps["tooling/ci/steps.json"] --> judge
  ms["milestones.json：里程碑状态"] --> judge
  matrix --> judge
  reqj --> judge
  judge --> report["traceability-report 与 PR 注释"]
  judge --> fail["缺 P0、覆盖倒退、义务缺失：失败"]
  report --> review["里程碑出口评审读取"]
```

怎么读：左侧三类输入分别生成清单与矩阵；清单同时喂给扫描器（做存在性检查）与判定器；判定器结合步骤激活表与里程碑状态得出「失败」或「报告」，报告供出口评审使用。

依据：决策 T-REQ；09-06 §12；PRD 04 NF-09；PRD 05 §6（范围变更须更新矩阵）。

**图 13-2 追溯数据模型**

```mermaid
erDiagram
  REQUIREMENT }o--|| MILESTONE : "目标里程碑"
  CHECK_NAME }o--|| MILESTONE : "所属里程碑"
  CHECK_NAME }o--o{ REQUIREMENT : "验收"
  TEST_FILE }o--o{ REQUIREMENT : "@req 标签"
  TEST_FILE }o--o{ RULING_ITEM : "@ruling 标签"
  TEST_FILE }o--o{ ADR : "@adr 标签"
  TEST_FILE }o--|| CI_STEP : "被收集"
  CHECK_NAME }o--o{ CI_STEP : "执行于"
  CHECK_NAME ||--o{ EVIDENCE : "人工证据"
  CI_STEP }o--|| MILESTONE : "激活于"
  RULING_ITEM }o--o| MILESTONE : "义务到期"
  REQUIREMENT {
    string id PK "PRD:OF-18"
    string priority "P0 P1 P2 或 NF"
  }
  CHECK_NAME {
    string id PK "fidelity:roundtrip 或 M1#7"
    string form "机械 半机械 人工"
  }
  CI_STEP {
    string id PK "test/fidelity-roundtrip"
    string mode "off report gated"
  }
  MILESTONE {
    string id PK "M0 至 M5"
    string status "planned active exit-review done"
  }
  EVIDENCE {
    string path PK "test/evidence/M3/security-pentest.md"
    string result "pass fail waived"
  }
```

怎么读：实体是判定器读入的七类数据加人工证据；连线上的文字是关系来源。测试文件与需求、裁决条目、ADR 是多对多（经标签）；每个测试文件恰被一个 CI 步骤收集（[12 §2](./12-ci-gates-mapping.md) 的收集范围两两不相交）。

依据：本节 §1.1–§1.3；[12 §2](./12-ci-gates-mapping.md)。

---

## 2. 清单从哪里来

依据：决策 T-REQ（requirements.json 由 tooling 脚本从 PRD 03 / 04 生成，与 M0 验收 3 同一脚本）。

- **生成脚本** `tooling/scripts/gen-requirements.ts`（工具脚本，不计入 14 个扫描器）。生成物入库、文件头标 `generated`；`--check` 模式重新生成并与入库文件比对，有 diff 即失败（R10，与 `scan-manifest --check` 同一模式）。
- **输入与解析口径**：

| 来源 | 解析 | 生成物 |
|---|---|---|
| `10-prd/03-features/*.md` | `### <ID> <标题>` 及其后的「- 优先级：Px \| 目标里程碑：My …」行；多里程碑写法（如「M3（会话内队列）/ M4（…）」）取第一个为主里程碑，全部记入 `milestones[]`；有无「验收标准」段记为 `acceptance` | `tooling/policy/requirements.json` 的 `requirements[]`：`{ id, domain, title, priority, milestone, milestones[], acceptance, source }` |
| `10-prd/04-non-functional-requirements.md` | `## NF-xx` 标题；优先级记为 `NF`，里程碑取该节各表「里程碑」列的并集 | 同上（`priority: 'NF'`，完整性按 §4 的义务判定，不走 R1） |
| `10-prd/05-milestones-and-scope.md` | 各里程碑「验收标准」编号条目**开头**（首个冒号之前）以反引号包裹的 `域:名`，可多个以 `+` 相连（如 M3 验收 10 的三项）；条目正文中其它反引号内容（如 `dsp:drawing`、`doc-type:new`）不算；无名条目记为 `<里程碑>#<序号>`（如 `M1#7`）；「可插拔证据」段「CI 检查」后的 `pluggable:mN`；「发布前检查」等非验收列表不解析 | 同一文件的 `checks[]`：`{ id, milestone, text }` |
| `00-charter/rulings-2026-09-14.md` | 各节表格第一列的条目 id 与所在节号；§4.18「规格空白默认值」各列表项开头加粗的 id（如 **CO-10**）；§4.18「机械修正」按正文所指读取 `00-charter/_evidence/contradiction-plan-2026-09-25.json` 的 `plan.mechanical[].id`（如 `UX-13`、`CO-11`）；§4.19 表格第一列 5 项与表末 `N1-IMPORT-OVERWRITE-RESTORE-LOCK` 行，另按 §4.19 末句读取 `00-charter/_evidence/design-tracks-plan-2026-09-25.json` 的 `leftoverDecisions[].id`（与 §4.18 机械修正读取 evidence 同一先例）；§4.20 表格第一列 15 项，另读取 `00-charter/_evidence/leftovers-plan-2026-09-26.json` 的 `plan.mechanical[].id` 与 `plan.deferred[].id`（拆法见 §1.1）；§4.21 裁决表 23 项（按 §1.1 改写为大写连字符形）与默认值各簇行首加粗的 `R-d-*`、`H-d-*`；§4.22 裁决表三题与默认值、推迟项各条行首加粗的 `SF-*`、`D-*`、`DF-*`；§4.23 见 §1.1；§4.24 两张表第一列（2026-10-03 追加）；组合 id 一律拆开 | `tooling/policy/rulings.json` |
| `30-architecture/adr/*.md` | 「决策」节的编号条目与 ADR 状态 | `tooling/policy/adrs.json` |
| `50-frontend/18-editor-capabilities.md`（2026-09-26 追加） | 各域能力表中首列匹配 `@cap` 语法的行：id、所在节、「出处」列里的 PRD id、「里程碑」列的主里程碑（取最先出现的 `Mn`）、「覆盖度」列箭头后的值 | `tooling/policy/capabilities.json`：`{ id, domain, section, prd[], milestone, coverage }[]` |

- **M0 验收 3「字段齐全」**：同一脚本对每条 P0 需求检查 id 唯一、优先级、目标里程碑、验收标准四项齐全，缺一即列出并失败。
- **人工维护、生成脚本不碰的两份映射**：`test/traceability/check-names.json`（§3 的机器副本：检查名 → 测试文件模式、步骤、形态）与 `test/traceability/obligations.json`（§4、§6、§7 的机器副本：NF / 裁决 / ADR 义务 → 里程碑、步骤、文件模式）。判定器断言 `check-names.json` 的键集合 = 生成的 `checks[]`（多一个或少一个都失败）。
- 需求清单的消费者：扫描器 `scan-requirement-tags` 规则 (b) 读 `requirements.json` 做存在性检查（09-06 §12 的「若清单存在」前提自 M0 起成立）。

---

## 3. PRD 检查名目录

每行给出检查名、断言摘要、测试落点、CI 步骤与形态；阈值原文以 PRD 05 为准，本表只写能定位用例的摘要。「形态」：机械 = 全自动判定；半机械 = 自动执行 + 人工复核失败项；人工 = 证据归档（§8）。按步骤反查的索引见 [12 §6](./12-ci-gates-mapping.md)。

### 3.1 M0

| 检查 | 断言摘要 | 落点 | 步骤 | 形态 |
|---|---|---|---|---|
| `M0#1` | 三条线 README 的待决事项都有决策人、对章程的异议都有裁决记录 | `test/evidence/M0/docs-review.md` | — | 人工 |
| `M0#2` | 术语表登记的旧名在正文中残留 0 处（PRD 05 验收 2 按 rulings §4.20 TX-02 改写）：`docs/_tools/terms.json` 登记已裁定更名的内部标识符（首批 `FakeClock` / `FakeServerClock` → `FixedClock`、`FixedMetricsMeasurer` → `FixedWidthMeasurer`、`*.test-d.ts` → `*.type-test.ts`、`render/error` → `render/element-failed`、`collab/permission-changed` → `permission/changed`、`ui.statusbar` → `ui.statusBar`、`@oce` / `oce-` → `@cordexjs` / `cordex`），跳过 rulings、`_evidence/` 与 `adr/`，放行状态头行、同行含正名或更名标注的行与各条的 `allowIn` 文件 | `docs/_tools/check-terms.py`（只用标准库、只读，有残留退出码 1；改文档后与评审时运行） | 文档工具，不属 13 个 job | 机械 |
| `M0#3` | 每条 P0 需求字段齐全 | `gen-requirements --check` | `test/requirement-matrix` | 机械 |
| `M0#4` | 规范 ↔ 执行矩阵 CI 校验通过；各门禁在空骨架上跑通且负向夹具失败 | `scan-policy`；13 个 job | `policy-check` 与全部 job | 机械 |
| `M0#5` | ADR-0001 声明合并 spike 有结论 | `test/evidence/M0/adr-0001-spike.md` | — | 人工 |

### 3.2 M1

| 检查 | 断言摘要 | 落点 | 步骤 | 形态 |
|---|---|---|---|---|
| `fidelity:roundtrip` | T1 + T2 零编辑往返部件级零差异 | `test/roundtrip/**`（[03 §4](./03-fidelity-roundtrip-and-corpus.md)） | `test/fidelity-roundtrip`（nightly 全量为出口证据） | 机械 |
| `fidelity:visual` | SSIM 中位数与 P10、各矩阵行阈值、文本行数一致率 | `test/oracle/**`（[04 §6](./04-visual-oracle.md)） | `e2e/oracle-gated` | 机械 |
| `fidelity:interop` | PowerPoint 365 Windows 打开无修复（macOS 基线与 Mac 抽检自 M2 起，rulings §4.19 D-TEST-INFRA） | 维护机脚本 + 人工复核（[03 §12](./03-fidelity-roundtrip-and-corpus.md)） | — | 半机械 |
| `perf:open` | D50 / D200 首页可见、内存稳态、20 次开关无泄漏 | `test/perf/scenarios/open-*`（[09 §3](./09-performance-and-capacity.md)） | `perf/perf-client` | 机械 |
| `errors:codes` | `.ppt`、加密、损坏、超限各类样本返回正确错误码 | `test/roundtrip/error-corpus.test.ts`（[03 §8](./03-fidelity-roundtrip-and-corpus.md)） | `test/fidelity-roundtrip` | 机械 |
| `degrade:isolate` | 注入抛错的 `ElementRenderer`，同页其它元素渲染、`render/element-failed` 触发 | engine-render `error-isolation.test.ts` | `test/unit` | 机械 |
| `M1#7` | 187 种 `prstGeom` IoU ≥ 0.95 | `test/oracle/**`（[04 §5](./04-visual-oracle.md)） | `e2e/oracle-gated` | 机械 |
| `M1#8` | 同页 4 个 Unit 各自渲染正确，关闭一个不影响其它 | model-core `unit-scope.test.ts`；`apps/web/e2e/viewer/multi-instance.spec.ts` | `test/unit`、`e2e/full-compose` | 机械 |
| `viewer:preset` | 查看器打开 T1 全部成功、初始加载 ≤ 350 KB gzip、无编辑命令 | `preset-slide-viewer` 的 `readonly.test.ts`；体积 | `test/unit`、`scanners/scan-bundle-budget`、`depcruise` | 机械 |
| `fidelity:objects` | 表格、图表、SmartArt gated；OLE 预览；chartex 与未知对象占位；外部关系保留 | [03 §9](./03-fidelity-roundtrip-and-corpus.md)、[04 §7](./04-visual-oracle.md) | `test/fidelity-roundtrip`、`e2e/oracle-gated` | 机械 |
| `pluggable:m1` | store 与 render.target 换 no-op 仍能启动；无图表渲染器时占位 | `preset-slide` 的 `pluggable.test.ts`（[02 §10](./02-contract-suites-and-pluggability.md)） | `test/unit` | 机械 |

**图 13-3 M1 出口与检查名**

```mermaid
flowchart TB
  subgraph gFid["test/fidelity-roundtrip"]
    c1["fidelity:roundtrip"]
    c5["errors:codes"]
    c10["fidelity:objects"]
  end
  subgraph gOracle["e2e/oracle-gated"]
    c2["fidelity:visual"]
    c7["M1 验收 7：prstGeom IoU"]
  end
  subgraph gLife["test/unit 的 preset 用例与体积门禁"]
    c9["viewer:preset"]
    cP["pluggable:m1"]
  end
  subgraph gUnit["test/unit 与 e2e 全量段"]
    c6["degrade:isolate"]
    c8["M1 验收 8：多实例"]
  end
  subgraph gPerf["perf/perf-client"]
    c4["perf:open"]
  end
  subgraph gHuman["半机械：test/evidence/M1"]
    c3["fidelity:interop"]
  end
  exit["M1 出口：P0 全绿 + 可插拔证据 + NF 门禁 + 评审签字"]
  gFid --> exit
  gOracle --> exit
  gLife --> exit
  gUnit --> exit
  gPerf --> exit
  gHuman --> exit
```

怎么读：每个分组是承载这些检查的主要 CI 步骤，组内是 PRD 05 的检查名；全部分组汇入出口节点。跨多个步骤的检查放在主要步骤下，完整的步骤列表见上表。

依据：PRD 05 M1 验收与可插拔证据、图 0-2。

### 3.3 M2

| 检查 | 断言摘要 | 落点 | 步骤 | 形态 |
|---|---|---|---|---|
| `e2e:editing` | 每条 P0 / P1 ED 需求至少一个 Playwright 用例且全部通过 | `apps/web/e2e/editing/**` | `e2e/full-compose`；覆盖由 `test/requirement-matrix`（R5） | 机械 |
| `fidelity:edit-roundtrip` | 编辑脚本语料：未触碰部件字节相同、脏部件 XSD 有效、diff 只在被编辑子树 | `test/roundtrip/edit-scripts/**`（[03 §5](./03-fidelity-roundtrip-and-corpus.md)）；PowerPoint 打开无修复部分见 `fidelity:interop` | `test/fidelity-roundtrip`、`xsd-validate` | 机械 |
| `history:property` | 1,000 步随机命令全撤销回初始、全重做回终态（100 个种子） | model-slide 性质测试（[05 §10](./05-collab-simulation-and-property-tests.md)） | `test/unit`（nightly 放大） | 机械 |
| `perf:interact` | 键入 p95、拖动帧率、撤销、导出 D50 | `test/perf/scenarios/*` | `perf/perf-client` | 机械 |
| `size:budget` | 查看器 ≤ 350 KB、编辑器 ≤ 900 KB gzip | `config/bundle-budget.json` | `scanners/scan-bundle-budget` | 机械 |
| `a11y:axe` | 全部面板零严重 / 重大违规；键盘 e2e 覆盖主要区域 | `apps/web/e2e/a11y/**`（[06 §7](./06-frontend-component-and-e2e.md)） | `e2e/a11y` | 机械 |
| `embed:multi` | 同页 4 个编辑器实例、快捷键按焦点分派、销毁无残留 | `apps/web/e2e/embed/multi-instance.spec.ts` | `e2e/full-compose` | 机械 |
| `csp:strict` | 严格 CSP + nonce 下 e2e 全部通过；TT Report-Only 零报告；`externalResources` 三档收紧；注入扫描零命中 | SEC-CL-01 / 02、SEC-CT-01 / 05（[10](./10-security-testing.md)） | `e2e/smoke`、全部浏览器 e2e 的安全夹具、`lint` | 机械 |
| `master:view` | 进入 ≤ 300 ms、缩略图与引用数、SSIM ≥ 0.90、入口可见性规则 | `apps/web/e2e/master/**`；oracle 抽样 | `e2e/full-compose`、`e2e/oracle-gated`、`perf/perf-client` | 机械 |
| `layout:apply` | 版式重匹配与规则表一致、跨母版一步撤销、重置 SSIM ≥ 0.98 | 编辑脚本语料的版式分节（[03 §5](./03-fidelity-roundtrip-and-corpus.md)）；oracle | `test/fidelity-roundtrip`、`e2e/oracle-gated`、`e2e/full-compose` | 机械（PowerPoint 打开部分半机械） |
| `shell:home` | 开始页四态、可交互 ≤ 1.0 s、三类入口、离线禁用 | `apps/web/e2e/shell/home.spec.ts` | `e2e/full-compose`、`perf/perf-client` | 机械 |
| `shell:account-menu` | 三处入口打开同一菜单；设置、快捷键、帮助、退出登录各有用例 | `apps/web/e2e/shell/account-menu.spec.ts` | `e2e/full-compose` | 机械 |
| `embed:framework-free` | `UiRenderer('vanilla')` 过 UI 渲染契约；形态 B 产物无 react / radix | `runUiRendererConformance`（[02 §7.3](./02-contract-suites-and-pluggability.md)）；依赖规则 | `test/contract`、`depcruise` | 机械 |
| `pluggable:m2` | 示例插件只用公开入口；插入、渲染、导出、撤销；内核六包零 diff | [02 §10](./02-contract-suites-and-pluggability.md) | `depcruise`、`e2e/full-compose`；零 diff 为证据文件 | 机械 + 证据 |
| `server:import` | 两步导入 D50 / D200 时长；超天花板拒绝、包络外可导入；上传与解析阶段可取消且不留原件与产物；新建空白 / 模板走同一作业、导入即有包内封面 | [07 §11.2–§11.3](./07-backend-integration-and-api-e2e.md) J1–J4；[03 §10](./03-fidelity-roundtrip-and-corpus.md) B1、B3、B4；[09 §6](./09-performance-and-capacity.md) `import-*`；[06 §5](./06-frontend-component-and-e2e.md) 第 7、21 行 | `test/server-integration`、`perf/perf-server`、`e2e/full-compose` | 机械 |
| `collab:persist` | 快照引导打开与初始同步；落库后才回 db ack、持久化滞后；≥ 500 update 触发压缩、压缩 10k update 时长；kill -9 零丢失 50 次；关闭重开哈希一致；同一用户两标签页互见；编辑 e2e 走网关路径 | [07 §8](./07-backend-integration-and-api-e2e.md) D10、§9 W2–W4；[02 §5](./02-contract-suites-and-pluggability.md) `durability/*`、`ack/*`；[05](./05-collab-simulation-and-property-tests.md) M2 档；[09 §6](./09-performance-and-capacity.md) `collab-bootstrap-*`、`persist-lag`、`compaction-10k`；[06 §5](./06-frontend-component-and-e2e.md) 第 2、22 行 | `test/server-integration`、`test/contract`、`test/collab-sim`、`perf/perf-collab`、`perf/perf-server`、`e2e/full-compose` | 机械 |
| `collab:gate` | Ticket 握手与六种失败码；硬门禁拒绝即不广播不落库；5% 非法 update 最终全部合法；修复规则黄金用例；修复与拒绝入审计；媒体只经资源通道 | [02 §5.2](./02-contract-suites-and-pluggability.md) `gate/*`、`session/*`；[05 §8](./05-collab-simulation-and-property-tests.md)；[07 §6](./07-backend-integration-and-api-e2e.md) A10、§9 W8、W11 | `test/contract`、`test/collab-sim`、`test/unit`、`test/server-integration` | 机械 |
| `collab:degraded` | 单实例 PG 写失败下不拒新编辑，超阈值依次溢写 Valkey → 对象存储、溢写期只回 spill ack 且 pending 保留；恢复后回放补 db ack、seq 连续且不重复落库；降级期两客户端仍互见；`persist` 信号 ≤ 1 s；发起方横幅与其余会话状态胶囊按三分支判据出现、恢复后消失；有未确认更改时离开保护 | [02 §5.2](./02-contract-suites-and-pluggability.md) `durability/pg-down-db-ack-withheld`、`degraded/*`；[07 §9](./07-backend-integration-and-api-e2e.md) W5a、W5、W6（单实例）；[05 §9](./05-collab-simulation-and-property-tests.md) `rs/unsaved-indicator`；[06 §5](./06-frontend-component-and-e2e.md) 第 22 行 | `test/server-integration`、`test/contract`、`test/unit`、`e2e/full-compose` | 机械 |
| `plugins:diagnose`（§4.23） | 个人插件面板三分组与空分组隐藏；激活抛错的插件显示错误码、版本、traceId 与复制诊断信息，本会话重试成功后移入运行中，等待依赖与版本不兼容无重试；带 `plugin-qr-shape` 足迹的文档在未装配该插件时占位、横幅写明 `id` 与所需版本、导出原数据字节不变；第一方 manifest 的 `scope` 与判定表一致 | [06 §5](./06-frontend-component-and-e2e.md) 第 28、29、34 行、§2.2 插件三行与插件横幅行；[02 §10.1](./02-contract-suites-and-pluggability.md) `scope/*`、`footprint/*`、`exclude/*`；[07 §7.5](./07-backend-integration-and-api-e2e.md) PL1 | `e2e/full-compose`、`test/unit`、`test/fidelity-roundtrip`、`test/server-integration` | 机械 |

**图 13-4 M2 出口与检查名**

```mermaid
flowchart TB
  subgraph gCompose["e2e/full-compose"]
    e1["e2e:editing"]
    e7["embed:multi"]
    e9["master:view"]
    e11["shell:home"]
    e12["shell:account-menu"]
    eP["pluggable:m2"]
  end
  subgraph gFid["test/fidelity-roundtrip 与 xsd-validate"]
    e2["fidelity:edit-roundtrip"]
    e10["layout:apply"]
  end
  subgraph gUnit["test/unit 与 test/contract"]
    e3["history:property"]
    e13["embed:framework-free"]
  end
  subgraph gCollab["协同后端：server-integration、collab-sim、perf-collab / perf-server"]
    e14["server:import"]
    e15["collab:persist"]
    e16["collab:gate"]
    e17["collab:degraded"]
  end
  subgraph gPr["e2e 的 PR 段：smoke 与 a11y"]
    e8["csp:strict"]
    e6["a11y:axe"]
  end
  subgraph gPerf["性能与体积：perf-client、scan-bundle-budget"]
    e4["perf:interact"]
    e5["size:budget"]
  end
  exit["M2 出口：P0 全绿 + 可插拔证据 + NF 门禁 + 评审签字"]
  gCompose --> exit
  gFid --> exit
  gUnit --> exit
  gPr --> exit
  gPerf --> exit
  gCollab --> exit
```

怎么读：同图 13-3；M2 的大部分检查落在 main 段的全量浏览器 e2e 上，因此 M2 出口评审读取 main 与 nightly 的结果，而不只是 PR 结果。协同后端四项（`server:import`、`collab:persist`、`collab:gate`、`collab:degraded`）是 PRD 05 按 rulings §4.19 D-M2-CONTENT 新增的 M2 验收 14–17。

依据：PRD 05 M2 验收与可插拔证据。

**rulings §4.19 D-M2-CONTENT 对检查名的影响**（PRD 05 已按裁决修订，M2 / M3 边界以 PRD 05 §0.3 为准）：协同网关、Room（单实例）、update 持久化与快照、服务端导入提前到 M2，新增 M2 验收 14–17（上表 `server:import`、`collab:persist`、`collab:gate`、`collab:degraded`）；原 M3 的 `collab:softgate` 主体提前为 `collab:gate`，`server:jobs` 只剩服务端导出，`server:durability` 只剩多实例部分（含跨实例溢写认领；单实例溢写与两级 ack 在 M2 `collab:degraded`）（§3.4）。`check-names.json` 与本节同一 PR 更新（§9 第 2 条）。

**rulings §4.21 插入元素**（2026-09-26 整合登记）：PRD 05 M2 验收 18「插入元素」是既有检查 `e2e:editing` 与 `fidelity:edit-roundtrip` 的子集，不新增检查名；PRD 02 本轮新增的需求编号 ED-15a、ED-31、ED-32、ED-33、ED-34、ED-35 照常以 `@req PRD:ED-xx` 进入需求矩阵（用例文件 `editing/ed-<编号>-*.spec.ts`，[06 §5](./06-frontend-component-and-e2e.md) 第 2 行），其中到 M2 的条目计入 `e2e:editing` 的 R5 覆盖，其余按各自里程碑激活。

### 3.4 M3

| 检查 | 断言摘要 | 落点 | 步骤 | 形态 |
|---|---|---|---|---|
| `collab:converge` | 20 客户端 × 1,000 命令 × 100 种子收敛、导出 XSD 有效 | `test/collab-sim/**`（[05 §4](./05-collab-simulation-and-property-tests.md)） | `test/collab-sim`（nightly 规模档为出口证据） | 机械 |
| `collab:soft-conflict` | CO-08 表每行确定性用例，收敛与提示 100% 相符 | [05 §6](./05-collab-simulation-and-property-tests.md) | `test/collab-sim` | 机械 |
| `collab:latency` | A → B p50 / p95、presence | `test/perf/scenarios/collab-*` | `perf/perf-collab` | 机械 |
| `perm:fail-closed` | 无写权限构造 update 被拒并断开；撤销 ≤ 2 s 生效；未声明能力位的命令进不了代码库 | SEC-AZ-03 / 04 / 06 / 07（[10 §7](./10-security-testing.md)） | `test/server-integration`、`test/contract`、`scanners/scan-command-capabilities`；2 s 在 `perf/perf-collab` | 机械 |
| `offline:queue` | 断网编辑后重连合并；5 MiB 离线更改无超限断连；30 s 离线判据；≤ 36 s 自动回连 | [05 §9](./05-collab-simulation-and-property-tests.md)；传输与离线 kit；双浏览器冒烟 | `test/collab-sim`、`test/contract`、`e2e/smoke`、`perf/perf-collab` | 机械 |
| `server:jobs` | 服务端导出 pptx 时长（与客户端导出规范化一致）；导出可取消、下载链接 1 h；导入条目已提前为 M2 `server:import`，M3 在多实例部署下回归 | [07 §11.2](./07-backend-integration-and-api-e2e.md) J5、J6；[09 §6](./09-performance-and-capacity.md) `export-*` | `test/server-integration`、`perf/perf-server` | 机械 |
| `server:thumbnails` | 首页 ≤ 10 s、D200 ≤ 90 s；按页哈希失效；renderer 安全测试 | [07 §11](./07-backend-integration-and-api-e2e.md)；SEC-RS-01…07 | `perf/perf-server`、`test/server-integration`、`e2e/smoke`、`scanners/check-image-policy`、`e2e/oracle-gated` | 机械 |
| `server:pdf` | PDF D50 ≤ 10 s、SSIM ≥ 0.85；与缩略图分队列 | 性能场景；oracle PDF 通道（[04 §1](./04-visual-oracle.md)） | `perf/perf-server`、`e2e/oracle-gated`、`test/server-integration` | 机械 |
| `server:durability` | 多实例：kill -9 任一实例后重连到其它实例、已 ack(db) 零丢失；PG 故障期间跨实例扇出仍互见、恢复后 seq 连续；只回放本实例溢写、遗留行由下一个加载实例认领；未发起更改的协作者只见状态胶囊弱提示（单实例部分已在 M2 `collab:persist`、`collab:degraded`） | [07 §9](./07-backend-integration-and-api-e2e.md) W1、W2、W5、W6；[02 §5.2](./02-contract-suites-and-pluggability.md) `degraded/*`、`replay/*`；[06 §5](./06-frontend-component-and-e2e.md) 第 12 行 | `test/server-integration`（PR 5 次，nightly 50 次）、`test/contract`、`e2e/full-compose` | 机械 |
| `server:scale` | 单实例 2,000 WS、按权重准入、广播与跨实例时延、名额按用户计 | [09 §6–§7](./09-performance-and-capacity.md) | `perf/perf-server`、`perf/perf-collab` | 机械 |
| `security:pentest` | ASVS L2 自评 + 第三方渗透无高危未修复 | [10 §14](./10-security-testing.md) | — | 人工 |
| `ops:compose` | compose 洁净栈到 `/readyz` 200 ≤ 3 min | [08 §3](./08-deployment-and-environment-e2e.md) | `e2e/full-compose` | 机械 |
| `ops:airgap` | 断网环境 compose e2e 通过、无出站 | [08 §5](./08-deployment-and-environment-e2e.md) | `e2e/full-airgap` | 机械 |
| `ops:image-licenses` | digest 钉死、SBOM、镜像许可门禁；备份恢复演练脚本通过 | [08 §6、§9](./08-deployment-and-environment-e2e.md) | `scanners/check-image-policy`、`e2e/full-compose`（演练在 nightly） | 机械 |
| `comments:roundtrip` | 评论导出为现代评论部件，PowerPoint 365 可见且作者与时间正确（抽样 20） | 结构断言 [03 §9](./03-fidelity-roundtrip-and-corpus.md)；抽样证据 | `test/fidelity-roundtrip`；证据 `test/evidence/M3/comments-roundtrip.md` | 半机械 |
| `collab:softgate` | 主体已随网关提前为 M2 `collab:gate`；M3 在多实例与多客户端下重跑，并补 commenter 触及评论以外路径、修改他人评论两条修复规则的黄金用例 | [05 §8](./05-collab-simulation-and-property-tests.md) `inject/unauthorized-path`、`inject/foreign-author` 的 commenter 变体；审计集成 | `test/collab-sim`、`test/unit`、`test/server-integration` | 机械 |
| `collab:rejected-rollback` | 降权后被拒的 pending → 导出后重载，状态一致、未同步更改可导出 | [05 §9](./05-collab-simulation-and-property-tests.md)；`apps/web/e2e/collab/**` | `test/collab-sim`、`e2e/full-compose` | 机械 |
| `master:edit` | 母版与版式编辑脚本语料、引用页 ≤ 500 ms 更新、删除被引用版式与母版规则（确认后可撤销、删除母版按目标母版同 `type` 选版式，rulings §4.20 FE-05、FE-23）、ML-03 冲突表 | 编辑脚本语料；性能；oracle；[05 §6、§7.1](./05-collab-simulation-and-property-tests.md)；[06 §5](./06-frontend-component-and-e2e.md) 第 25 行 | `test/fidelity-roundtrip`、`perf/perf-client`、`e2e/oracle-gated`、`test/collab-sim`、`test/unit`、`e2e/full-compose` | 机械 |
| `theme:edit`（P1） | 主题重算 ≤ 300 ms、显式颜色像素不变、`theme*.xml` 重生成与字节保留；应用主题直接执行并给可撤销 Toast（rulings §4.20 FE-07） | 编辑脚本语料；性能；oracle；[06 §5](./06-frontend-component-and-e2e.md) 第 25 行 | `test/fidelity-roundtrip`、`perf/perf-client`、`e2e/oracle-gated`、`e2e/full-compose` | 机械 |
| `history:restore-revert` | 版本恢复可撤销（U-07，ADR-0038 version-restore-undo）：撤销只回退恢复事务改写且其后未被写过的键（按恢复事务的 struct 范围判定，不按值相等）、恢复时删除的元素以原 id 复活、全部被跳过则整步不提交、墓碑 TTL 已过的元素不复活；「谁能撤销」「可撤销时效」随 ADR 定稿补断言 | [05 §7.2](./05-collab-simulation-and-property-tests.md) `rs/restore-revert-*`（占位）；路由、能力位与审计的集成用例随 ADR 定稿登记在 [07 §9](./07-backend-integration-and-api-e2e.md) | `test/collab-sim`、`test/server-integration` | 机械 |
| `security:rls` | 绕过应用层直连 PG 越权被 RLS 拒绝；OIDC 登录、`selfSignup` 默认关、分享链接要求登录各有 e2e | SEC-DA-01 / 02、SEC-AU-02、SEC-AZ-09 | `e2e/smoke`、`scanners/check-rls-coverage`、`test/server-integration` | 机械 |
| `collab:undo` | 同键跳过、整步不连撤、墓碑与恢复、TTL 与永久删除不等 TTL、彻底删除元素后整步跳过；两个 store 同一套件 | `runDocumentStoreConformance` 中性撤销分节（[02 §4](./02-contract-suites-and-pluggability.md)）；[05 §7](./05-collab-simulation-and-property-tests.md)；[07 §10](./07-backend-integration-and-api-e2e.md) | `test/contract`、`test/collab-sim`、`test/server-integration` | 机械 |
| `pluggable:m3` | 两个 preset 的 Manifest 差异恰为白名单 `{−store-memory, +store-yjs, −collab-core#local-presence, +collab-yjs, +collab-transport-ws, +comments}`；M2 编辑 e2e 在 store-yjs 下重跑；移除 collab 仍能启动 | [02 §10](./02-contract-suites-and-pluggability.md)（白名单按 rulings §4.19 D-COMMENTS-PKG 定稿；`manifest-diff.test.ts` 自 M2 起运行、M2 期间不含 `+comments`） | `test/unit`、`e2e/full-compose` | 机械 |
| `plugins:admin`（§4.23，P1） | `member` 调策略写接口 403；内容级只有两态、必需项锁定；禁用被依赖者出确认卡且依赖方等待依赖；互斥不能同时启用；保存后新会话按新策略装配、在线会话 ≤ 60 s 出现重新加载横幅且不中断编辑；每次保存写 `plugin.policy_changed`；个人启停即时生效、刷新后保持、不写审计 | [07 §7.5](./07-backend-integration-and-api-e2e.md) PL2–PL7、PL9–PL11，§9 W22；[06 §5](./06-frontend-component-and-e2e.md) 第 28、30、35、39 行与 §2.2 管理员页草稿行；SEC-AZ-16 | `test/server-integration`、`e2e/full-compose`、`e2e/a11y` | 机械 |
| `plugins:consistency`（§4.23，P0） | A、B 同 Room 启用内容插件 P 后 B 未重新加载见占位、不改动 P 元素数据、两端模型哈希一致；界面级插件写命令被拒并记 `plugin/scope-violation`；服务端与客户端导出用同一内容级集合；内容插件版本变化后旧会话 4426 `collab.plugins_outdated`、先 flush 再刷新、刷新前写入被拒 | [06 §5](./06-frontend-component-and-e2e.md) 第 31 行；[07 §9](./07-backend-integration-and-api-e2e.md) W21、W22；[02 §10.1](./02-contract-suites-and-pluggability.md) `scope/ui-write-command-denied`；SEC-AZ-17、SEC-RS-08；服务端导出一致沿用 `server:jobs` 的规范化比对，按策略装配与 renderer 取集合见 [03 §6](./03-fidelity-roundtrip-and-corpus.md) X6–X8、[07 §9](./07-backend-integration-and-api-e2e.md) W23（2026-10-03，rulings §4.24） | `e2e/full-compose`、`test/server-integration`、`test/unit` | 机械 |

**rulings §4.21 插入图表与表格结构**（2026-09-26 整合登记）：PRD 05 M3 验收 19 同样是 `e2e:editing`（M3 子集）与 `fidelity:edit-roundtrip` 的子集，不新增检查名。其中图表编辑往返（ED-15 / ED-15a）的判定为：编辑后导出由维护机打开无修复、「编辑数据」可打开内嵌工作簿（半机械，归 `fidelity:interop`，[03 §5.3](./03-fidelity-roundtrip-and-corpus.md)）；导出 PNG 按 `chart` 类别达标（[04 §8.1](./04-visual-oracle.md)，`e2e/oracle-gated`）。

**图 13-5 M3 出口与检查名（协同与权限）**

```mermaid
flowchart TB
  subgraph gSim["test/collab-sim"]
    k1["collab:converge"]
    k2["collab:soft-conflict"]
    k12["collab:softgate"]
    k13["collab:rejected-rollback"]
    k5["offline:queue"]
    k18["history:restore-revert，随 ADR-0038"]
  end
  subgraph gContract["test/contract"]
    k17["collab:undo"]
  end
  subgraph gSrv["test/server-integration"]
    k4["perm:fail-closed"]
  end
  subgraph gLife["test/unit 的 preset 用例"]
    kP["pluggable:m3"]
  end
  subgraph gPerf["perf/perf-collab"]
    k3["collab:latency"]
  end
  exit["M3 出口：协同部分"]
  gSim --> exit
  gContract --> exit
  gSrv --> exit
  gLife --> exit
  gPerf --> exit
```

怎么读：同图 13-3；M3 检查较多，按「协同与权限」与「服务端、部署、安全与编辑」拆成两张图，两张图的出口节点合起来才是 M3 出口。

**图 13-6 M3 出口与检查名（服务端、部署、安全与编辑）**

```mermaid
flowchart TB
  subgraph gSrv["test/server-integration"]
    s6["server:jobs"]
    s7["server:durability"]
  end
  subgraph gPerf["perf/perf-server"]
    s6a["server:thumbnails"]
    s6b["server:pdf"]
    s8["server:scale"]
  end
  subgraph gSmoke["e2e/smoke"]
    s16["security:rls"]
  end
  subgraph gCompose["e2e/full-compose"]
    s10a["ops:compose"]
    s10c["ops:image-licenses"]
  end
  subgraph gAirgap["e2e/full-airgap"]
    s10b["ops:airgap"]
  end
  subgraph gFid["test/fidelity-roundtrip"]
    s14["master:edit"]
    s15["theme:edit"]
  end
  subgraph gHuman["人工与半机械：test/evidence/M3"]
    s9["security:pentest"]
    s11["comments:roundtrip"]
  end
  exit["M3 出口：服务端、部署、安全与编辑部分"]
  gSrv --> exit
  gPerf --> exit
  gSmoke --> exit
  gCompose --> exit
  gAirgap --> exit
  gFid --> exit
  gHuman --> exit
```

怎么读：同图 13-5；`ops:*` 三项与 `server:durability` 的 nightly 档都在合入后才运行，M3 出口评审读取 main 与 nightly 的结果。

依据：PRD 05 M3 验收与可插拔证据；rulings §4.15 Q10、§4.18 GV-16。

**rulings §4.20 对检查名的影响**：TX-01+BE-10 在 PRD 05 的 M3 验收加检查名 `history:restore-revert`（上表末行，图 13-5 `test/collab-sim` 组），它的用例随 ADR-0038 定稿入库，ADR 未定稿则 M3 的版本恢复不开工，该检查名随之不进入 M3 出口；`check-names.json` 与 PRD 05 同一 PR 更新（§9 第 2 条）。BE-07+TX-05 的 `host-footprint`（[09 §6](./09-performance-and-capacity.md)）不是 PRD 检查名、只出报告；PRD 05 M3 验收 10（`ops:compose`）目前不引用它，若日后把最低主机规格写进该验收，在 `ops:compose` 行登记这份产物。

### 3.5 M4

| 检查 | 断言摘要 | 落点 | 步骤 | 形态 |
|---|---|---|---|---|
| `docs:coverage` | 公开 API、贡献点、错误码文档覆盖率 100%；文档示例代码全部编译 | 文档站构建脚本 | `api-surface/docs-coverage` | 机械 |
| `ctk:self` | 官方插件与示例全部通过 CTK；负向样例各自在对应检查上失败 | `test/plugin-compat/self.test.ts`（[02 §12](./02-contract-suites-and-pluggability.md)） | `test/contract` | 机械 |
| `manifest:ci` | `cordex-manifest.json` 与运行时一致；`hostApi` 范围外宿主拒绝加载 | `scan-manifest --check`；kernel `manifest-verify.test.ts` | `scanners/scan-manifest --check`、`test/unit` | 机械 |
| `scaffold:e2e` | 脚手架 8 个模板各生成一次，install / test / build 通过 ≤ 5 min | `packages/create-plugin` 的模板冒烟 | `api-surface/scaffold-e2e` | 机械 |
| `pilot:external` | 内部非核心成员仅凭公开文档完成插件 ≤ 2 人日、CTK 通过、提问 ≤ 3 次 | `test/evidence/M4/pilot-external.md` | — | 半机械 |
| `version:policy` | 弃用 API 带移除版本；到期扫描器失败用例 | 扫描器 `scan-deprecations` 的负向夹具 | `scanners/scan-deprecations`、`test/unit` | 机械 |
| `plugins:trust`（§4.23，P0） | 声明文件格式错误退出码 78（`--dry-run` 同）；无签名且无审核记录的插件被拒、不进任何会话；摘要不符、`hostApi` 不覆盖、作用域声明低于推出结果各被拒并在管理员界面显示原因；强制启用插件被拒时 `/readyz` 附 `pluginsRejected`；生产拒绝允许未签名；界面无上传或安装入口 | [08](./08-deployment-and-environment-e2e.md) §2 RA13、§3 C9、§4 G13；SEC-SC-09、SEC-SC-10 | `test/server-integration`、`e2e/full-compose` | 机械 |

### 3.6 M5

| 检查 | 断言摘要 | 落点 | 步骤 | 形态 |
|---|---|---|---|---|
| `depcruise:blind` | 非组合根水平层对垂直束 import = 0；组合根豁免与反例 | depcruise 规则与夹具（[02 §11](./02-contract-suites-and-pluggability.md)） | `depcruise` | 机械 |
| `diff:horizontal` | 新增 doc / sheet 骨架的 PR 对冻结范围 diff = 0 行 | `fixtures/horizontal-freeze.lock` | `scanners/horizontal-freeze` | 机械 |
| `boot:empty` | 不加载任何 DocumentType 时宿主启动，打开文件返回 `format.no_document_type` | `test/preset-blind/preset-blind.test.ts` 的 `boot/empty` 用例（[02 §11](./02-contract-suites-and-pluggability.md)） | `test/preset-blind` | 机械 |
| `coexist` | 同页 slide + doc + sheet 三个 Unit 互不影响 | `test/preset-blind/preset-coexist.test.ts` | `test/preset-blind` | 机械 |
| `roundtrip:docx-xlsx`（P1） | docx 与 xlsx 零编辑往返各 ≥ 20 个样本零差异 | [03 §14](./03-fidelity-roundtrip-and-corpus.md) | `test/fidelity-roundtrip` | 机械 |

---

## 4. NFR 映射

NF 条目没有 P0 / P1，按下表作为义务登记进 `obligations.json`（`kind: 'nf'`），在所列里程碑进入出口评审时适用 R6。数值只引用 PRD 04。

| NF | 范围 | 场景或测试 | 步骤 | 里程碑 |
|---|---|---|---|---|
| NF-01 §1.1 | 打开与首屏、跳页、主线程长任务 | `open-*`、跳转已解析 / 未解析页、longtask 观察（[09 §3–§4](./09-performance-and-capacity.md)） | `perf/perf-client` | M1 |
| NF-01 §1.2 / §1.4 | 交互与渲染、导出 | 键入、IME、拖拽与缩放帧率、撤销、命中测试、吸附、搜索与替换、主题切换、导出 | `perf/perf-client` | M2 |
| NF-01 §1.3 | 内存 | 稳态与峰值、20 次开关堆增长 ≤ 5%（[06 §11](./06-frontend-component-and-e2e.md)）、卸载后 effects 为空、blob URL 泄漏为 0 | `perf/perf-client`、`e2e/full-compose`、`test/lifecycle` | M1 |
| NF-01 §1.5 | 体积 | 唯一阻断点 `scan-bundle-budget`（决策 T-BUNDLE） | `scanners/scan-bundle-budget` | M1 / M2 |
| NF-01 §1.6 / §1.7 | 协同、服务端 | [09 §6–§7](./09-performance-and-capacity.md)（快照 bootstrap、持久化滞后、压缩、导入、单实例溢写回放 M2 起；多人延迟、在场、容量、优雅停机、导出与缩略图 M3） | `perf/perf-collab`、`perf/perf-server` | M2 / M3 |
| NF-01 材质层 | 同屏玻璃面板数、降级为不透明、对比度；forced-colors | 浏览器断言与 design 对比度测试；forced-colors 用例 | `e2e/full-compose`、`test/unit`、`e2e/a11y`（M3） | M2 / M3 |
| NF-02 | 保真门禁 | 往返、XSD、oracle 两层阈值与「中位数下降 > 0.01 即失败」（决策 T-ORACLE） | `test/fidelity-roundtrip`、`xsd-validate`、`e2e/oracle-gated` | M1–M3 |
| NF-03 | 可用性与数据安全 | 已 ack(db) 零丢失与 PG 故障连续性（[07 §9](./07-backend-integration-and-api-e2e.md)）；插件失败隔离；导出失败可重试不损坏源；灾备演练（[08 §9](./08-deployment-and-environment-e2e.md)）；崩溃自由会话率为线上指标，出口评审读取试运行数据 | `test/server-integration`、`test/lifecycle`、`test/unit`、`e2e/full-compose`（nightly）；线上指标为人工 | M2 / M3 |
| NF-04 | 安全 | [10](./10-security-testing.md) 全部 SEC 条目、ASVS 与渗透 | 见 10 §2 | M1–M3 |
| NF-05 | 可访问性 | axe、键盘、目标尺寸、焦点、对比度（[06 §7](./06-frontend-component-and-e2e.md)）；屏幕阅读器矩阵与 VPAT 为人工 | `e2e/a11y`；人工 | M2 / M3 / M4 |
| NF-06 | 国际化 | 各语言键集合一致（`scan-contributions` 规则 (f)）、缺键编译失败、伪本地化与 RTL 伪语言、语言包 ≤ 30 KB、切换 ≤ 200 ms（[06 §8](./06-frontend-component-and-e2e.md)） | `scanners/scan-contributions`、`typecheck`、`e2e/full-compose`、`scanners/scan-bundle-budget`、`perf/perf-client` | M1 / M2 |
| NF-07 | 浏览器与运行时矩阵 | Playwright 工程按里程碑扩展（[06 §3](./06-frontend-component-and-e2e.md)）；Node 26 基线（`lockfile-guard`） | 全部浏览器 e2e 步骤、`scanners/lockfile-guard` | M1 / M2 / M3 |
| NF-08 | 互操作 | PowerPoint 打开无修复（半机械）；LibreOffice 不崩溃（nightly 报告）；多生产方输入打开 100%（T2 语料） | 证据；`test/fidelity-roundtrip` | M1 / M2 |
| NF-09 | 可维护性与质量门禁 | 本文 R1–R11；patch 覆盖率；语料 PR ≤ 10 min；PR 性能 D50；类型逃逸预算 | `test/requirement-matrix`、`coverage-patch`、`test/fidelity-roundtrip`、`perf/perf-client`、`scanners` | M0 起 |
| NF-10 | 容量 | 2,000 WS、按权重准入、单文档 update 日志 ≤ 10 × 快照、每实例 4 并发作业 | `perf/perf-server`、`perf/perf-collab`、`test/server-integration` | M3 |
| NF-11 | 隐私与合规 | SEC-CL-04…06、SEC-DA-07；数据处理清单 | `e2e/full-compose`、`test/server-integration`；证据 | M2 / M3 |
| NF-12 | 文档与支持 | `docs:coverage`（M4）；错误码手册由登记表生成、每个码有文案键（`scan-observability-identifiers`、决策 ERR-COPY 的 `scan-contributions` 子规则）；其余为交付物清单 | `api-surface/docs-coverage`、`scanners` | M1 / M4 |

---

## 5. 按功能域摘要

逐条需求 → 测试文件的明细由生成的 `dist/traceability-report.html` 承载（每条需求列出全部带标签的用例、所在步骤与最近一次结果），本节只给各域的测试文件族，供写新测试时判断放哪里、打什么标签。

| 域 | 主要测试文件族 | 主要步骤 | 细则 |
|---|---|---|---|
| OF 打开 / 保真 | `packages/ooxml-*/src/**/__tests__/`、渲染包同位测试、`test/roundtrip/`、`test/oracle/`、`apps/web/e2e/{open,viewer}/**` | `test/unit`、`test/fidelity-roundtrip`、`e2e/oracle-gated`、`perf/perf-client` | [03](./03-fidelity-roundtrip-and-corpus.md)、[04](./04-visual-oracle.md) |
| ED 编辑 | `packages/model-slide`、`packages/slide-ui` 同位测试；编辑脚本语料；`apps/web/e2e/editing/**` | `test/unit`、`test/fidelity-roundtrip`、`e2e/full-compose`、`e2e/a11y` | [03 §5](./03-fidelity-roundtrip-and-corpus.md)、[06 §5](./06-frontend-component-and-e2e.md) |
| ML 母版 / 版式 / 主题 | model-slide 版式与继承测试、slide-render 母版继承、编辑脚本语料的版式分节、`apps/web/e2e/master/**` | `test/unit`、`test/fidelity-roundtrip`、`e2e/oracle-gated`、`e2e/full-compose` | 同上 |
| AS 应用壳 | `apps/web/src/**/__tests__/`（domain 与 application，msw）、`apps/web/e2e/shell/**` | `test/unit`、`e2e/full-compose`、`perf/perf-client` | [06](./06-frontend-component-and-e2e.md) |
| CO 协同 | `packages/{collab-*,store-yjs}` 同位测试、`test/collab-sim/`、`apps/server/test/{integration,e2e}/collab/**`、`apps/web/e2e/collab/**` | `test/contract`、`test/collab-sim`、`test/server-integration`、`e2e/smoke`、`perf/perf-collab` | [02](./02-contract-suites-and-pluggability.md)、[05](./05-collab-simulation-and-property-tests.md)、[07](./07-backend-integration-and-api-e2e.md) |
| PS 插件 SDK | `packages/kernel` 同位测试、各包 `lifecycle.test.ts`、`test/plugin-compat/`、`examples/**` | `test/lifecycle`、`test/contract`、`test-typecheck`、`api-surface` | [02](./02-contract-suites-and-pluggability.md) |
| EM 嵌入集成 | `packages/preset-*/src/__tests__/`、`examples/embed-*`、`apps/web/e2e/embed/**` | `test/lifecycle`、`test/unit`、`e2e/full-compose`、`scanners/scan-bundle-budget` | [02 §10](./02-contract-suites-and-pluggability.md)、[06](./06-frontend-component-and-e2e.md) |
| SV 服务端运维 | `apps/server/src/**/__tests__/`、`apps/server/test/{integration,e2e}/**`、`test/deploy/` | `test/server-integration`、`e2e/smoke`、`e2e/full-compose`、`e2e/full-airgap`、`perf/perf-server` | [07](./07-backend-integration-and-api-e2e.md)、[08](./08-deployment-and-environment-e2e.md)、[10](./10-security-testing.md) |
| PM 插件管理（2026-10-01，§4.23） | `apps/web/src/{domain,application}/plugins/` 与 `__tests__/pages/` 的插件页面测试、`apps/web/e2e/{plugins,admin}/**`、`packages/kernel` 的足迹与越权测试、`test/plugin-scope/`、`apps/server/test/e2e/plugins/**`、`test/deploy/compose/plugins/` | `test/unit`、`test/server-integration`、`e2e/full-compose`、`e2e/a11y`、`test/fidelity-roundtrip` | [02 §10.1](./02-contract-suites-and-pluggability.md)、[06 §5](./06-frontend-component-and-e2e.md) 第 28–31 行、[07 §7.5](./07-backend-integration-and-api-e2e.md)、[08](./08-deployment-and-environment-e2e.md) RA13 / C9 / G13、本文 §6.5 |

---

## 5a. 能力 id 追溯（2026-09-26 追加，rulings §4.21）

[50/18](../50-frontend/18-editor-capabilities.md) 把编辑器拆成 26 个域、172 项能力（§1.3 统计；2026-09-26 复核从 INS-16 拆出 INS-20；2026-10-01 按 rulings §4.23 新增插件管理域 PLG-01…PLG-07），每项有能力 id（`SEL-`、`INS-`、`TXT-`…）。本节回答「每项能力由哪些测试覆盖」：测试在 JSDoc 里写 `@cap <能力 id>`（§1.1），扫描器把它并入追溯矩阵，判定器按 R11 逐域报告缺口。下表是人工正本，列出每项能力**应当**落在哪些测试文件与步骤；带「新增」的测试文件由本轮能力补齐引入，文件登记随 40-modules 各篇的测试布局（§9）回写。区间写法 `SEL-01–04` 表示 SEL-01、SEL-02、SEL-03、SEL-04，`doc-sync.test.ts` 展开后与 50/18 的能力 id 集合比对（§10）。

**图 13-7 能力 id 进入追溯矩阵**

```mermaid
flowchart LR
  cap["50/18 各域能力表"] --> gen["gen-requirements：解析能力行"]
  gen --> cj["capabilities.json：id、域、PRD、里程碑、覆盖度"]
  test["测试 JSDoc：@req 与 @cap"] --> scan["scan-requirement-tags：语法与存在性"]
  cj --> scan
  scan --> matrix["requirement-test-matrix.json，tag 含 cap"]
  matrix --> judge["判定器：R11 逐域报告"]
  cj --> judge
  table["本节 §5a 表"] --> sync["doc-sync.test.ts：id 集合一致"]
  cap --> sync
  judge --> report["traceability-report：能力覆盖分域表"]
```

怎么读：能力表是唯一来源，生成物与本节表格都从它派生；`@cap` 只进报告（R11），门禁仍由 `@req` 承担（R1、R5），所以一个能力缺测试不会单独挡住合并，但会出现在里程碑出口评审读取的报告里。

依据：rulings §4.21；50/18 §1.3、§30；本文 §1.1、§1.3。

| 能力 id | 单元与组件测试（包内 `src/__tests__/` 或同位） | 浏览器 e2e（`apps/web/e2e/`） | 步骤 | 主里程碑 |
|---|---|---|---|---|
| SEL-01–04 | slide-ui `canvas-interaction.test.ts`（点选、框选、Tab 循环）、`selection-kind.test.ts`；engine-render 命中测试同位单测；ui-core `shortcuts.service.test.ts`（Esc 链） | `editing/ed-01-*.spec.ts` | `test/unit`、`e2e/full-compose` | M2 |
| SEL-05、SEL-15 | slide-ui `handles.test.ts`（锁定时手柄隐藏或显示锁形）；model-slide `shape-commands` 同位单测（`setLocks`，新增） | `editing/element-handles.spec.ts` | `test/unit`、`e2e/full-compose` | M2 |
| SEL-06 | slide-ui `selection-pane.test.tsx`（新增，P2） | — | `test/unit` | M2 P2 |
| SEL-07–09 | slide-ui `canvas-interaction.test.ts`（N 帧一次命令、Esc 零命令）；engine-layout `affine.test.ts` | `editing/ed-05-*.spec.ts` | `test/unit`、`e2e/full-compose`、`perf/perf-client`（拖动帧率） | M2 |
| SEL-10、SEL-11 | slide-ui `handles.test.ts`（调整手柄反解与一次命令）；model-slide `flipShapes` 同位单测（旋转角取反、文字不镜像） | `editing/element-handles.spec.ts` | `test/unit`、`e2e/full-compose`、`e2e/oracle-gated`（翻转样例） | M2 |
| SEL-12、SEL-13、SEL-16 | slide-ui `inspector-sections.test.tsx`（数值与单位换算）、`shortcuts.test.ts`（微移与 `Shift+Alt+方向键`） | `a11y/**` 键盘用例（[06 §7.3](./06-frontend-component-and-e2e.md)「拖拽的键盘等价」行） | `test/unit`、`e2e/a11y` | M2 |
| SEL-14 | slide-ui `shortcuts.test.ts`（`Mod+D` 偏移 0.2 in、连按等距）、`canvas-interaction.test.ts`（`Mod` 拖动） | `editing/ed-08-*.spec.ts` | `test/unit`、`e2e/full-compose` | M2 |
| ALN-01 | slide-ui `guides` 同位单测（候选与 4 px 阈值、Alt 关闭） | `editing/ed-09-*.spec.ts` | `test/unit`、`perf/perf-client`（吸附 p95） | M2 |
| ALN-02–04 | model-slide `alignShapes` / `distributeShapes` 同位单测（`relativeTo`）；render-dom 网格覆盖层单测（新增）；`setGuides`（P2） | `editing/ed-09-*.spec.ts` | `test/unit`、`e2e/full-compose` | M2 |
| ARR-01–05 | model-slide `shape-commands` 同位单测（`bringToFront` / `sendToBack` 只改 `order`、取消组合折算、`renameShape`、`setAltText` 与 `decorative`）；`mutations-property.test.ts` | `editing/ed-08-*.spec.ts`、`editing/ed-26-*.spec.ts` | `test/unit`、`e2e/full-compose`、`test/fidelity-roundtrip`（`adec:decorative` 往返） | M2 |
| INS-01、INS-02 | slide-ui `insert-tool.test.ts`（工具态、Esc 零命令、空文本框与插入合并） | `editing/insert-tools.spec.ts` | `test/unit`、`e2e/full-compose` | M2 |
| INS-03、INS-04 | slide-ui `shape-gallery.test.ts`（72 项数据与缩略图一致）、`handles.test.ts`（端点与连接点）；engine-layout `connector-routing.test.ts` | `editing/insert-tools.spec.ts`、`editing/element-handles.spec.ts` | `test/unit`、`e2e/full-compose`、`e2e/oracle-gated`（形状库快照） | M2 |
| INS-05 | model-slide `insertFreeform` 同位单测（新增，P2） | — | `test/unit` | M2 P2 |
| INS-06–08 | render-dom `image-preprocess.test.ts`（尺寸与 DPI、SVG 回退、压缩）；apps/web 上传队列单测 | `editing/insert-upload.spec.ts` | `test/unit`、`e2e/full-compose` | M2 |
| INS-09 | model-slide `table-commands` 同位单测（默认样式与尺寸） | `editing/ed-10-*.spec.ts` | `test/unit`、`e2e/full-compose` | M2 |
| INS-10 | slide-render-chart `chart-data-roundtrip.test.ts`（插入后导出） | `editing/ed-15a-*.spec.ts` | `test/unit`、`test/fidelity-roundtrip` | M3 |
| INS-11、INS-12、INS-15 | model-slide `media-commands` 同位单测（`insertMedia` 不写 `p:timing`、`insertIcons`）；slide-ui 符号面板单测（新增） | `editing/ed-35-*.spec.ts`、`editing/ed-32-*.spec.ts`、`editing/ed-33-*.spec.ts` | `test/unit`、`e2e/full-compose` | M2 P2 / M3 |
| INS-13 | slide-ui 超链接对话框单测（新增，协议白名单）；ui-core `openExternal` 单测 | `editing/ed-19-*.spec.ts` | `test/unit`、`e2e/full-compose`、`e2e/smoke`（`javascript:` 拒写，[10](./10-security-testing.md)） | M2 |
| INS-14、INS-17 | model-slide `header-footer-commands`、`fill-placeholder-commands` 同位单测 | `editing/ed-31-*.spec.ts`、`editing/insert-upload.spec.ts`（空占位符填入） | `test/unit`、`e2e/full-compose` | M2 |
| INS-16 | ooxml-pptx 往返语料（只读对象可移动删除、原样写回） | — | `test/fidelity-roundtrip` | 非目标 |
| INS-20 | 公式 OMML 往返语料（M1–M3 只读原样写回）；M4+ 立项时补 OMML↔MathML 转换单测 | — | `test/fidelity-roundtrip` | M4+ |
| INS-18、INS-19 | `preset-slide` 的 `pluggable.test.ts`；model-slide `slide-commands` 同位单测 | `plugins/plugin-qr-shape.spec.ts`、`editing/ed-11-*.spec.ts` | `test/unit`、`e2e/full-compose` | M2 |
| TXT-01–03 | slide-ui `text-editing.test.ts`；render-dom `ime-composition.test.ts`（vitest browser） | `ime/*.spec.ts`、`editing/ed-02-*.spec.ts` | `test/unit`、`e2e/full-compose`；真机手测见 §8 | M2 |
| TXT-04–08 | model-slide `text-commands` 同位单测（`setFontFamily{script}`、`setBaseline`、`setCaps`、`setParagraphSpacing`、`setIndent`、`setBullet` 预设、`setBodyProperties`）；slide-ui `command-bindings.test.ts`（字号阶梯） | `editing/ed-03-*.spec.ts`、`editing/ed-04-*.spec.ts` | `test/unit`、`e2e/full-compose`、`test/fidelity-roundtrip`（编辑脚本语料） | M2 |
| TXT-09、TXT-10 | engine-layout autofit 收敛单测；slide-render `elements.render.test.ts`；ui-react `hosts.test.tsx`（迷你工具条锚定） | `editing/ed-24-*.spec.ts`、`editing/ed-12-*.spec.ts` | `test/unit`、`e2e/full-compose` | M2 |
| TXT-11–15、TXT-18 | 各自落地时的同位单测（P2 与 M4+） | — | `test/unit` | M2 P2 / M4+ |
| TXT-16 | slide-ui `table-selection.test.ts`（新增，跨格导航） | `editing/ed-10-*.spec.ts` | `test/unit`、`e2e/full-compose` | M2 |
| TXT-17 | slide-ui 备注栏文本宿主单测 | `editing/ed-18-*.spec.ts` | `test/unit`、`e2e/full-compose` | M3 |
| FMT-01–03 | ui-react 颜色选择器单测（主题格 → `schemeClr` + 明暗修饰）；slide-ui 渐变编辑器单测（新增） | `editing/ed-06-*.spec.ts` | `test/unit`、`e2e/full-compose`、`test/fidelity-roundtrip` | M2 |
| FMT-04–11 | model-slide `setShapeStyle`（不烤显式值）、`changeShape`、效果预设同位单测；ui-react `MixedValueField` 单测 | `editing/ed-06-*.spec.ts` | `test/unit`、`e2e/full-compose`、`e2e/oracle-gated`（箭头与阴影快照） | M2 |
| PIC-01–06 | slide-ui `crop.test.ts`（裁剪模式一次命令、Esc 零命令、`srcRect` 单位）；model-slide `picture-commands` 同位单测（重置、透明度、填充 / 适合） | `editing/ed-07-*.spec.ts`、`editing/element-handles.spec.ts` | `test/unit`、`e2e/full-compose`、`test/fidelity-roundtrip` | M2 |
| PIC-07–10 | slide-render `emf-rasterizer` 与 `degrade.test.ts`；render-dom `image-preprocess.test.ts`（GIF 首帧）；外链策略单测 | `open/open-render.spec.ts`、`editing/insert-upload.spec.ts`（占位与重试） | `test/unit`、`e2e/full-compose`、`e2e/oracle-gated` | M1 / M2 |
| MED-01–04 | render-dom `media-playback.test.ts`（不写 Store、翻页即停）；slide-ui `present.test.ts` | `editing/ed-21-*.spec.ts`、`resources/**`（播放元素不泄漏，[06 §11](./06-frontend-component-and-e2e.md)） | `test/unit`、`e2e/full-compose` | M1 / M2 |
| TBL-01 | slide-ui `table-selection.test.ts`（新增，状态机） | `editing/ed-10-*.spec.ts`、`editing/table-edit.spec.ts`（[06 §5](./06-frontend-component-and-e2e.md) 第 32 行，2026-10-03） | `test/unit`、`e2e/full-compose` | M2 |
| TBL-02–06 | model-slide `table-commands` 同位单测；不变量 I-TBL1 / I-TBL2 性质测试；协同插行插列并发收敛 | `editing/ed-10-*.spec.ts`（M3 段）、`editing/table-structure.spec.ts`（06 §5 第 32 行，10 个边框预设与只拆合并格） | `test/unit`、`test/collab-sim`（[05](./05-collab-simulation-and-property-tests.md)）、`test/fidelity-roundtrip`、`e2e/oracle-gated`（表格 SSIM） | M3 |
| CHT-01、CHT-02、CHT-05 | slide-render-chart `renderers.test.ts`（SSIM 与墨迹 IoU）；slide-render `degrade.test.ts`（占位） | `open/open-render.spec.ts` | `test/unit`、`e2e/oracle-gated` | M1 |
| CHT-03、CHT-04 | slide-render-chart `chart-data-roundtrip.test.ts`；slide-ui 数据网格单测（新增） | `editing/ed-15-*.spec.ts`、`editing/chart-edit.spec.ts`、`editing/chart-data-grid.spec.ts`（[06 §5](./06-frontend-component-and-e2e.md) 第 33 行，2026-10-03）；软冲突 [05 §6](./05-collab-simulation-and-property-tests.md) `sc-30`、`sc-31` | `test/unit`、`test/fidelity-roundtrip`、`e2e/full-compose` | M3 |
| ML-01–03、ML-09 | slide-ui `master-view.test.ts`、`layout-actions.test.ts`；model-slide `setSlideBackground` 同位单测 | `editing/master-view.spec.ts`、`editing/layout-apply.spec.ts`、`editing/ed-20-*.spec.ts` | `test/unit`、`e2e/full-compose`、`e2e/oracle-gated` | M2 |
| ML-04–08 | 同上；model-slide 命令层集成（删除确认后可撤销） | `editing/master-layout-delete.spec.ts`、`editing/theme-apply.spec.ts` | `test/unit`、`e2e/full-compose`、`test/collab-sim` | M3 |
| ML-10 | 落地时补 | — | — | M4 |
| SLD-01–04、SLD-08 | slide-ui `thumbnails.test.tsx`（虚拟化、拖拽与键盘等价、节标题行）；model-slide `element-limits` 单测 | `editing/ed-11-*.spec.ts` | `test/unit`、`e2e/full-compose` | M2 |
| SLD-05–07 | model-slide 节命令与 `pasteSlides` 同位单测（新增） | `editing/ed-11-*.spec.ts`（M3 段） | `test/unit`、`e2e/full-compose` | M3 / M2 P2 |
| VIEW-01–05 | engine-render 视口单测；ui-react `editor-shell.breakpoints.test.tsx` | `editing/ed-22-*.spec.ts`、`viewer/viewer.spec.ts` | `test/unit`、`e2e/full-compose` | M2（VIEW-04 待决、VIEW-05 M4） |
| FND-01–04 | model-slide `text-search` 同位单测（新增，跨 run 命中、全字）；`replaceAll` 一个事务 | `editing/ed-13-*.spec.ts`、`viewer/viewer.spec.ts`（查看器搜索） | `test/unit`、`e2e/full-compose`、`perf/perf-client`（`client.search.d200`） | M2 |
| CLP-01–04 | ui-core `input-pipelines.test.ts`（MIME 优先级、HTML 取文本） | `editing/ed-17-*.spec.ts` | `test/unit`、`e2e/full-compose`、`e2e/smoke`（粘贴零外呼） | M2 / M3 |
| UND-01–03 | `runDocumentStoreConformance` 撤销分节（[02 §4](./02-contract-suites-and-pluggability.md)）；`history:property` | `editing/edit-undo-export.spec.ts`、`collab/collab-two-browsers.spec.ts` | `test/unit`、`test/contract`、`test/collab-sim`、`e2e/full-compose` | M2 / M3 |
| CMT-01 | `@cordexjs/comments` 同位单测；slide-ui 锚点 resolver 单测 | `comments/*.spec.ts` | `test/unit`、`e2e/full-compose` | M3 |
| SHW-01–06 | slide-ui `present.test.ts`（动词清单、黑白屏、全屏目标） | `editing/ed-21-*.spec.ts` | `test/unit`、`e2e/full-compose` | M2 |
| EXP-01–06 | ooxml-pptx 往返与 `determinism.test.ts`；slide-render `thumbnails.test.ts`（`exportImage` 含 `svg`）；apps/web 导出作业状态机单测 | `editing/export-*.spec.ts` | `test/unit`、`test/fidelity-roundtrip`、`e2e/full-compose`、`perf/perf-server` | M2 / M3 |
| COL-01–03 | ui-core `collab-ui-state` 单测；协同契约与模拟 | `collab/collab-two-browsers.spec.ts`、`collab/single-user-persist.spec.ts` | `test/contract`、`test/collab-sim`、`e2e/full-compose` | M2 / M3 |
| OFF-01–03 | 离线计时与 step2 上限（[05 §9](./05-collab-simulation-and-property-tests.md)） | `collab/offline.spec.ts` | `test/collab-sim`、`e2e/full-compose` | M2 / M3 / M4 |
| KEY-01–03 | slide-ui `shortcuts.test.ts`（默认表无冲突、逐条对齐 ED-16）；ui-core `chord.test.ts` | `a11y/**` 键盘用例 | `test/unit`、`e2e/a11y` | M2 |
| UI-01–05 | slide-ui `selection-kind.test.ts`、`inspector-spec.test.ts`、`ribbon-spec.test.ts`（命令已注册）、`contributions.test.ts`；ui-react `contribution-renderer.test.tsx`（禁用带原因） | `editing/ed-12-*.spec.ts`、`editing/ed-30-*.spec.ts` | `test/unit`、`e2e/full-compose` | M2 |
| A11Y-01 | slide-render `a11y-descriptor` 单测（装饰性不进树） | `a11y/**` | `test/unit`、`e2e/a11y` | M1 / M2 |
| I18N-01、I18N-02 | i18n 缺 key 回退单测；`scan-contributions` 规则 (f) | `i18n/pseudo-*.spec.ts`、`i18n/nohost-handoff.spec.ts`（[06 §8](./06-frontend-component-and-e2e.md)） | `test/unit`、`e2e/full-compose`、`perf/perf-client`（`locale-switch`） | M1 / M2 |
| DOC-01、DOC-02 | ooxml-pptx `import-admission.test.ts`、`import-envelope.test.ts` | `open/open-render.spec.ts`、`shell/home.spec.ts` | `test/unit`、`test/fidelity-roundtrip`、`e2e/full-compose` | M1 / M2 |
| PLG-01…PLG-07（2026-10-01，§4.23） | `apps/web/src/__tests__/pages/{PluginManagerPage,AdminPluginsPage,footprint-banner}.test.tsx`、`domain/plugins/compute-exclude.test.ts`、`application/plugins/toggle.usecase.test.ts`；kernel `plugin-footprint.test.ts`（PLG-03） | `plugins/personal-panel.spec.ts`（PLG-01、PLG-02）、`plugins/missing-plugin.spec.ts`（PLG-03）、`admin/plugins.spec.ts`（PLG-04、PLG-05、PLG-06；PLG-07 为 M4 追加）（[06 §5](./06-frontend-component-and-e2e.md) 第 28–30 行） | `test/unit`、`e2e/full-compose`、`e2e/a11y` | M2（PLG-01、PLG-03）/ M3（PLG-02、PLG-04–PLG-06）/ M4（PLG-07） |

- **与 §3、§5 的关系**：`e2e:editing` 的「每条 P0 / P1 ED 需求至少一个用例」不变（R5，文件名 `ed-<编号>-*.spec.ts`）；本表把同一批 spec 细分到能力，新测试在 `@req` 之外加写 `@cap`。表中 `editing/insert-tools.spec.ts`、`element-handles.spec.ts`、`insert-upload.spec.ts` 见 [06 §5](./06-frontend-component-and-e2e.md) 第 26 行。
- **缺口口径**：50/18 中覆盖度为「后置」「非目标」「待决」的能力不计入 R11；「补齐」的能力在其主里程碑进入 `exit-review` 前必须补上表中的测试，否则出现在报告的「能力缺口」分域表里。

---

## 6. 裁决项映射

本节是 `obligations.json` 中 `kind: 'ruling'` 的人工正本：每行一个带测试要求的裁决条目，测试须带对应的 `@ruling` 标签。只列有测试要求的条目；纯文档口径或命名修正的条目（如 GV-04、GV-05、GV-08、GV-24）不列。

### 6.1 §4.15–§4.17

| 标签 | 测试要求 | 测试 | 步骤 | 到期 |
|---|---|---|---|---|
| `4.15/T-0` | 单组织，无租户字段 | SEC-DA-04 | `test/server-integration`、`test-typecheck`、`scanners` | M2 |
| `4.15/Q1` | 包名 scope、`workspace:` 协议 | `scan-manifest` 规则 (g)、`check-workspace-protocol` | `scanners` | M0 |
| `4.15/Q2` | UI 核心框架无关；CSP nonce M2；TT M2 Report-Only → M3 强制 | TD-082 依赖规则、`embed:framework-free`、SEC-CL-01 / 02 | `depcruise`、`test/contract`、`e2e/smoke` | M2 / M3 |
| `4.15/Q3` | 同键跳过、整步不连撤、软删除墓碑 + TTL | `runDocumentStoreConformance` 中性撤销分节；协同模拟撤销断言 | `test/contract`、`test/collab-sim` | M3 |
| `4.15/S-3a` | 两级 ack：spill 不清 pending、db 才清；回放后无 pendingStructs | `runCollabServerConformance`、`batcher.test`、PG 故障注入集成 | `test/contract`、`test/unit`、`test/server-integration` | M2（单实例：db ack、spill 档与 pending 保留）/ M3（多实例，PRD 05 §0.3） |
| `4.15/Q4` | DOM / SVG 单实现、禁 innerHTML 注入；M3 末最小 canvas Provider 过 RenderTarget 契约 | SEC-CT-01 / 02；`canvas-target-contract.test.ts` | `lint`、`test/unit`、`test/contract` | M1 / M3 |
| `4.15/Q5` | 两层口径、按权重准入、名额按用户计、超天花板拒绝 | `open-dx20k`、`room-full-fanout`、`room-weight-admission`、`import-over-ceiling`；SEC-RL-04 / 05 | `perf/*`、`test/contract`、`test/fidelity-roundtrip` | M1 / M2 / M3 |
| `4.15/Q6` | 外置 OIDC、`selfSignup` 默认关、文档级 RLS、CI 分层认证 | SEC-AU-01 / 02、SEC-DA-01；login-* 冒烟；Keycloak nightly | `e2e/smoke`、`test/server-integration` | M2 / M3 |
| `4.15/Q7` | SmartArt、OLE 预览、chartex 占位、外部关系全部保留 | `fidelity:objects` | `test/fidelity-roundtrip`、`e2e/oracle-gated` | M1 |
| `4.15/Q8` | 缩略图时长、页哈希失效、renderer 沙箱与零出站 | `server:thumbnails`；SEC-RS-* | `perf/perf-server`、`e2e/smoke` | M3 |
| `4.15/Q9` | pnpm 11 双锁、Node 26 | `lockfile-guard` | `scanners/lockfile-guard` | M0 |
| `4.15/Q10` | 洁净栈：断网 compose、digest 钉死、SBOM、镜像许可 | `ops:*` | `e2e/full-compose`、`e2e/full-airgap`、`scanners/check-image-policy` | M3 |
| `4.16/Q15` | 加密与 `.pptm` 拒绝 | 错误码语料、SEC-IN-07 | `test/fidelity-roundtrip` | M1 |
| `4.16/Q17` | 保留期默认值全部可配 | 周期作业与配置 schema 断言（[07 §11](./07-backend-integration-and-api-e2e.md)） | `test/server-integration` | M3 |
| `4.17/D1` | 无待接受邀请表；不存在的账号返回明确错误 | SEC-AZ-14 | `test/server-integration` | M3 |
| `4.17/D2` | 编辑期超上限 `document.quota_exceeded`（409，不关连接） | model-slide 命令守卫单测 | `test/unit` | M2 |
| `4.17/D3` | 第 14 个扫描器 | SEC-DA-03 | `scanners` | M2 |
| `4.17/D4` | 撤销不复活他人删除的元素 | `delete-vs-edit-undo` | `test/contract`、`test/collab-sim` | M3 |
| `4.17/D5` | `store/undo-skipped` 单独统计 | 遥测事件单测 | `test/unit` | M3 |

### 6.2 §4.18

| 标签 | 测试要求 | 测试 | 步骤 | 到期 |
|---|---|---|---|---|
| `4.18/BE-01` | 预签名经保持 Host 的反代可用；OIDC 经 `idp.` 子域；宿主端口不开放 | `runBlobStoreConformance` 反代用例；compose 断言（[08 §4](./08-deployment-and-environment-e2e.md)） | `test/server-integration`、`e2e/full-compose` | M2（预签名直传随导入与媒体进 M2）/ M3（compose） |
| `4.18/BE-02` | 链接解析归权限模块；WS 重算、撤销 ≤ 1 s 降权、到期降权 | SEC-AZ-07 / 09 | `test/server-integration` | M3 |
| `4.18/BE-03` | 快照与管理动作只在 collab 装配 | 角色装配（[08 §2](./08-deployment-and-environment-e2e.md)） | `test/server-integration` | M3 |
| `4.18/BE-04` | 取消拉取端点，两种模式 `/render` 请求数为 0 | SEC-RS-01 / 02；`render-page.spec.ts`（[06 §6](./06-frontend-component-and-e2e.md)） | `e2e/smoke`、`test/server-integration` | M3 |
| `4.18/BE-06` | 全局 SessionGuard 与 `@Public` 快照 | SEC-AZ-01 | `test/server-integration` | M2 |
| `4.18/BE-10` | 两步上传，他人对象键或 uploadId 403 | SEC-AZ-10 | `test/server-integration` | M2 |
| `4.18/BE-11` | `/api/v1` 前缀、`/internal` 不经反代 | 路由快照；SEC-RS-04 | `test/server-integration` | M2 / M3 |
| `4.18/BE-13` | 模块 × 角色装配矩阵与启动断言 | 角色装配 | `test/server-integration` | M2 |
| `4.18/BE-15` | 永久删除单作业与参与者，无残留、重试一致 | SEC-DA-06 | `test/server-integration` | M3 |
| `4.18/BE-18` | 幂等键：并发同键一行、失败后同键新行 | [07 §11](./07-backend-integration-and-api-e2e.md) | `test/server-integration` | M2 |
| `4.18/BE-19` | Webhook 队列、周期作业与投递状态 | [07 §11–§12](./07-backend-integration-and-api-e2e.md) | `test/server-integration` | M2（`reconciliation`、上传隔离区清理）/ M3（保留期清理、Webhook） |
| `4.18/BE-30` | 浏览器遥测端点 401 / 413 / 429、只转发 traces | SEC-RL-02 | `test/server-integration` | M2 |
| `4.18/BE-31` | 最近 / 固定只返回本人行、纳入 purge 参与者 | RLS 矩阵；SEC-DA-06 | `e2e/smoke`、`test/server-integration` | M2 / M3 |
| `4.18/FE-01` | 组合根豁免与反例；soft-gate-repair 在组合根；M5 `server-*` 零 diff | 依赖规则五例；`soft-gate-repair.int-spec.ts`；冻结 | `depcruise`、`test/server-integration`、`scanners/horizontal-freeze` | M1 / M2 / M5 |
| `4.18/FE-02` | 内部依赖 ⊆ 上限 ∪ 隐式 L0 | `scan-manifest` 规则 (i) | `scanners` | M0 |
| `4.18/FE-09` | `/render` ready 判据与两类超时分别计数 | `render-page.spec.ts` | 见 [06 §6](./06-frontend-component-and-e2e.md) | M3 |
| `4.18/FE-21` | 包元数据封闭八键 | `scan-policy` 全局不变式（TD-102） | `policy-check` | M0 |
| `4.18/CO-03` | offline 后每 30 s 自动重连、服务端恢复后 ≤ 36 s 回连 | 传输 kit（FixedClock） | `test/contract` | M3 |
| `4.18/CO-07` | 彻底删除元素：只墓碑态、限 owner、审计、之后撤销整步跳过 | 中性撤销分节硬删除分支；集成 | `test/contract`、`test/server-integration` | M3 |
| `4.18/CO-08` | 降级期照常广播、指标递增、恢复后 seq 连续 | PG 断开集成用例 | `test/server-integration` | M3 |
| `4.18/CO-10` | step2 恰一帧 db ack；step2 不切块、单设 16 MiB 上限，超限 4413（`rs/step2-over-16mib`，§4.21 H:q-hp-step2-cap 改写原「按 localSeq 拆分」）；5 MiB 离线无 4413（`rs/offline-5mib-single-step2`） | `batcher.test`；[05 §9](./05-collab-simulation-and-property-tests.md)；[02 §5.2](./02-contract-suites-and-pluggability.md) `gate/step2-over-16mib-4413` | `test/unit`、`test/collab-sim` | M2（step2 应答）/ M3（离线 5 MiB） |
| `4.18/CO-11` | 跳转已解析未装载页 ≤ 100 ms | 打开管线场景 | `perf/perf-client`、`test/fidelity-roundtrip` | M1 |
| `4.18/CO-12` | 首批装载即 `unit/opened`、到齐 `unit/loaded`、追加批次不标脏 | 渐进打开 P1–P7（[03 §7](./03-fidelity-roundtrip-and-corpus.md)） | `test/fidelity-roundtrip` | M1 |
| `4.18/CO-14` | 先回收空闲房间再驱逐活跃房间 | 准入单测与集群用例 | `test/contract`、`test/server-integration` | M2（单实例准入）/ M3（集群用例） |
| `4.18/CO-16` | 各实例只回放本实例溢写；遗留溢写由新实例认领；SIGTERM 且 PG 不可达先写一级溢写 | `spill-and-replay` | `test/server-integration` | M3 |
| `4.18/UX-02` | 刷新遇 401 直接「登录已过期」；换人不重放队列 | SEC-AU-10；传输 kit | `test/collab-sim`、`test/contract`、`e2e/full-compose` | M2 / M3 |
| `4.18/UX-03` | 累计 29.9 s 未离线、30 s 离线 | 传输 kit（FixedClock） | `test/contract` | M3 |
| `4.18/UX-05` | 导出「等待同步」态与服务端格式的提示 | 导出对话框 e2e | `e2e/full-compose` | M2（等待同步）/ M3（离线禁用、服务端格式） |
| `4.18/UX-11` | 评审、放映、无写权限或窄屏时母版视图无入口 | `master:view` 入口用例 | `e2e/full-compose` | M2 |
| `4.18/UX-13` | 超天花板拒绝、包络外天花板内可导入 | 错误码语料边界样本 | `test/fidelity-roundtrip`、`test/server-integration` | M1 / M2 |
| `4.18/UX-14` | 导入可在上传或解析阶段取消，不留原件与产物 | `server:jobs` 取消用例 | `test/server-integration` | M2 |
| `4.18/UX-19` | 查看者是编辑器只读变体，计入查看者名额 | viewer-readonly 冒烟 M3 段；SEC-AZ-02 | `e2e/smoke`、`test/server-integration` | M3 |
| `4.18/UX-20` | 切评审即退出母版视图；降权不退出 | `master-view.test`；母版 e2e | `test/unit`、`e2e/full-compose` | M2 |
| `4.18/GV-14` | 只用 13 个 job 名 | `scan-policy` 规则 (1) | `policy-check` | M0 |
| `4.18/GV-15` | 文档中的扫描器名可在 06 或 08 §11 查到 | `docs/_tools/check-scanner-names.py` | 文档工具 | M0 |
| `4.18/GV-16` | security-rls 与 renderer-egress 进 PR 冒烟，M3 起阻断 | [12 §4](./12-ci-gates-mapping.md) | `e2e/smoke` | M3 |

### 6.3 §4.19（三线拆分：5 项用户裁决、补完阶段的 N1 与 76 项遗留口径）

标签写 `@ruling 4.19/<决策 id>`；id 集合按 §1.1 生成（表格第一列 5 项 + 表末 N1 行 + evidence 的 `leftoverDecisions[].id`），与其它节一样做存在性检查。

| 标签 | 测试要求 | 测试 | 步骤 | 到期 |
|---|---|---|---|---|
| `4.19/INC-09` | PG 写失败 ≤ 1 s 内推 `room.persist='degraded'`，回放完成且无溢写后推 `ok`；客户端判据三分支（`persist`、仅获 spill 确认、最老在途 ≥ `unsavedWarnAfterMs` 15,000 ms）；受众分级：有本地未获 db 确认项的发起方横幅「未保存到服务器 N 项」，其余协作者状态胶囊弱提示「服务器保存延迟」 | 02 §5.2 `degraded/room-persist-signal`；07 §9 W5；[05 §9](./05-collab-simulation-and-property-tests.md) `rs/unsaved-indicator`；06 §5 第 12、22 行 | `test/contract`、`test/server-integration`、`test/unit`、`e2e/full-compose` | M2（服务端信号、三分支判据与两类受众，PRD 05 M2 验收 17）/ M3（多人与多实例回归） |
| `4.19/INC-24` | CSRF 与 WS Origin | SEC-XS-01 / 02 | `e2e/smoke` | M2 |
| `4.19/SESSION` | cookie 属性、refresh 轮换、吊销 ≤ 5 s、停用与擦除踢出 WS | SEC-AU-05…07 | `test/server-integration` | M2 / M3 |
| `4.19/C-11` | 准入 Lua 原子、按用户去重、并发不超额 | SEC-RL-04 | `test/contract`、`test/server-integration` | M3 |
| `4.19/C-25` | 媒体 `detached_at` 置位与清空；最老保留快照晚于 `detached_at` 后删关联；`unreferenced_since` 超保留期后删行与对象；被命名快照引用则保留 | 媒体 GC 集成用例（[07 §11](./07-backend-integration-and-api-e2e.md)） | `test/server-integration` | M2（压缩时置位 `detached_at`、`snapshots-retention` 删关联与 `media-gc`，[60/06](../60-backend/06-modules-jobs-import-export-thumbnails.md) §4）/ M3（被命名快照引用而保留的分支，随命名版本） |
| `4.19/INC-06` | 关闭码全表（含 1011、4427、4428）的客户端行为 | `close-policy.test`；传输 kit | `test/unit`、`test/contract` | M2 |
| `4.19/N1-IMPORT-OVERWRITE-RESTORE-LOCK` | 恢复不锁、覆盖导入换纪元：恢复期间无 `room{locked}`、协作者写入照常获 db ack、在线不断连；覆盖导入期间 `locked`（`reason:'import'`），成功后 `documents.epoch` 加一、指针指向新纪元 `import` 快照，在线会话 4428 后重新 bootstrap，未获 db 确认项移入 `rejected` 可导出；漏收通知由纪元栅栏兜底；锁原因只有 `import` / `migration` | [02 §5.2](./02-contract-suites-and-pluggability.md) `lock/room-locked-signal`、`epoch/external-epoch-control-closes-4428`、`restore/no-lock`、`put/import-bumps-epoch`；[07 §9](./07-backend-integration-and-api-e2e.md) W14、W16、W17 与 §11.2 J7；[05 §9](./05-collab-simulation-and-property-tests.md) `rs/import-overwrite`；[06 §5](./06-frontend-component-and-e2e.md) 第 15、21 行 | `test/contract`、`test/server-integration`、`test/unit`、`e2e/full-compose` | M2（覆盖导入）/ M3（恢复、两实例变体） |
| `4.19/INC-07` | `maxUpdateBytes` 不含类型头、超限 4413；速率字段 | SEC-RL-03 | `test/contract`、`test/server-integration` | M2 |
| `4.19/INC-20`、`4.19/INC-21`、`4.19/INC-25`、`4.19/INC-27` | 无效令牌 403 带 `details.reason`；媒体文档作用域；令牌只经请求头；`auth.refresh` 校验后重新绑定、不延长会话寿命 | SEC-AZ-09、SEC-AZ-11、SEC-XS-03、SEC-AZ-05 | `test/server-integration`、`e2e/smoke` | M2（INC-21、INC-27）/ M3（INC-20、INC-25） |
| `4.19/OIDC-LINK` | 跨 issuer 不自动关联 | SEC-AU-08 | `test/server-integration` | M2 |
| `4.19/SG-01`、`4.19/INC-26` | renderer 签名 RPC；内部端点与运维令牌 | SEC-RS-03、SEC-RS-04 | `test/server-integration`、`e2e/full-compose` | M3 |
| `4.19/CSP-NONCE`、`4.19/TT-CSP-REPORT` | nonce 每响应不同；TT 与违规上报端点 | SEC-CL-01 / 02、SEC-RL-02 | `e2e/smoke`、`e2e/full-compose`、`test/server-integration` | M2 / M3 |
| `4.19/C-16` | Webhook 密钥加密存储与验签 | SEC-EG-02 | `test/server-integration` | M3 |
| `4.19/C-20` | 审计只追加、哈希链、封存与分区轮换后续验 | SEC-DA-05 | `test/server-integration` | M3 |
| `4.19/C-24` | 用户擦除原地脱敏、身份行删除、会话吊销 | SEC-DA-07 | `test/server-integration` | M3 |
| `4.19/RLS-GUC`、`4.19/DB-ROLES`、`4.19/C-21` | RLS 上下文、角色与 GRANT、启用 RLS 的表清单 | SEC-DA-01 / 02；GRANT 快照（[07 §4](./07-backend-integration-and-api-e2e.md)） | `e2e/smoke`、`scanners/check-rls-coverage`、`test/server-integration` | M2 / M3 |
| `4.19/C-03` | M-08 仓储 SQL 不写 M-09 列 | [07 §8](./07-backend-integration-and-api-e2e.md) | `test/server-integration` | M2 |
| `4.19/C-07` | 导入原件复制为基线，30 天清理原件不影响导出 | 基线包 B1–B6（[03 §10](./03-fidelity-roundtrip-and-corpus.md)） | `test/server-integration` | M2（B1–B4、B6）/ M3（B5 永久删除；B3 的服务端导出段） |
| `4.19/G-09`、`4.19/SG-05` | 存储配额按 owner；用户搜索枚举面 | SEC-RL-06、SEC-AZ-12 | `test/server-integration` | M2（G-09）/ M3（SG-05） |
| `4.19/KEYS` | Valkey 键名只经键模板生成且与 60/14 一致 | 键名与 TTL 断言（[07 §11](./07-backend-integration-and-api-e2e.md)） | `test/server-integration` | M2 |
| `4.19/RESTORE-CMD` | 「恢复我的值」为新事务；「恢复元素」仅墓碑态可用 | [05 §7](./05-collab-simulation-and-property-tests.md) | `test/collab-sim`、`test/unit` | M3 |
| `4.19/VERSION-DRIFT-SW` | 惰性 chunk 加载失败或 4426 / 4427 → 「发现新版本」横幅，协同中先 flush 再刷新 | 版本漂移 e2e | `e2e/full-compose` | M2 |
| `4.19/TELEMETRY-DEFAULT`、`4.19/ERR-COPY` | 遥测默认值；`user:true` 错误码必须有中英文案键 | SEC-CL-06；`scan-contributions` 子规则 | `e2e/full-compose`、`scanners` | M2 |
| `4.19/D-M2-CONTENT` | M2 协同后端：服务端导入与快照 bootstrap——服务端文档经 `GET snapshots/latest`（带 `X-Cordex-Epoch`）+ collab-ticket + WS 打开，单人编辑经协同持久化；新建空白 / 模板与 .pptx 导入都走两步服务端导入并写 import 快照、基线与 embedded 封面；不存在任何 pptx 内容版本路由与对象键；两步上传的归属、魔数与大小把关 | [07](./07-backend-integration-and-api-e2e.md) §8 D10、§9（起始 M2 的行）、§11.2 J1–J4、§11.3；[03 §10](./03-fidelity-roundtrip-and-corpus.md) B1、B3、B4；[06 §5](./06-frontend-component-and-e2e.md) 第 21、22 行；SEC-IN-06、SEC-AZ-10 的 M2 段 | `test/server-integration`、`test/fidelity-roundtrip`、`e2e/full-compose` | M2 |
| `4.19/C-06` | 30 天内 auto 快照全量保留、此后每个 UTC 日留最后一个至 `retention.autoSnapshotDailyDays`（默认 365，0 = 永久）；import / migration / restore / epoch 按 auto 口径但每文档最新 import 快照与 `latest_snapshot_id` 所指快照不删；named 永久、每文档上限 200 | [07 §11.4](./07-backend-integration-and-api-e2e.md) `snapshots-retention`；边界做法 [11 §3](./11-test-data-fixtures-and-determinism.md) | `test/server-integration` | M2（`snapshots-retention` 随协同后端，PRD 05 §0.3「持久化与快照」行）/ M3（named 上限随命名版本） |
| `4.19/D-COMMENTS-PKG` | `pluggable:m3` 白名单 `{−store-memory, +store-yjs, −collab-core#local-presence, +collab-yjs, +collab-transport-ws, +comments}`；`@cordexjs/comments` 文档类型盲 | `manifest-diff.test.ts`（[02 §10](./02-contract-suites-and-pluggability.md)）；水平层依赖规则 | `test/unit`、`depcruise` | M3（`manifest-diff.test.ts` M2 起运行，不含 `+comments`） |
| `4.19/D-TEST-INFRA` | `perf/perf-client` 的 runner 标签为 `perf-larger`（M1 起），`perf/perf-collab` 与 `perf/perf-server` 为 `perf-selfhosted`（M2 起）；视觉基线条目带维护机 profile（`win365`，M2 起另有 `mac365`）与评审签字 | `test/conventions` 读取 `tooling/ci/steps.json` 的 runner 标签；`test/oracle` 基线清单校验 `signedOffBy` 与 profile（[04 §2](./04-visual-oracle.md)） | `test/unit`、`e2e/oracle-gated` | M1 / M2 |

### 6.4 §4.20（遗留小项收口：3 项决策、12 项默认值、25 项机械修正）

标签写 `@ruling 4.20/<id>`；id 集合按 §1.1 生成（表格第一列 15 项 + evidence 的 `plan.mechanical[].id`、`plan.deferred[].id`，组合 id 拆开）。只列有测试要求的条目；纯文档口径的条目（如 FE-10、FE-13、FE-14、FE-17、TX-11、TX-23、BE-11、TX-12）不列。

| 标签 | 测试要求 | 测试 | 步骤 | 到期 |
|---|---|---|---|---|
| `4.20/BE-01`、`4.20/TX-03` | WS 升级先扣后退：验签通过即退还，4401、票据文档不符的 4403、4408、4427 与升级后未认证即断开的不退；每用户单实例并发上限（默认 32）超出 → `auth.denied{collab.rate_limited}` + 4429；同一出口 IP 30 人 1012 后 ≤ 5 s 重连完；`ws-capacity` 在默认限额下爬升无 429 | SEC-RL-03 (a)–(e)；[02 §5.2](./02-contract-suites-and-pluggability.md) `admission/per-user-connection-cap-4429`；[07 §9](./07-backend-integration-and-api-e2e.md) W4；[09 §6](./09-performance-and-capacity.md) `ws-capacity` | `test/contract`、`test/server-integration`、`perf/perf-server` | M2（升级限流与每用户上限）/ M3（两实例集体重连、`ws-capacity`） |
| `4.20/BE-04` | 限流与审计的客户端 IP 统一取 `clientIp()`：伪造 `X-Forwarded-For` 首跳不改变限流主体与 `ip_hash`（REST、WS 升级各一例；web 容器 `terminate` 与 `upstream` 两种模式） | SEC-RL-01、SEC-RL-03 (f)；[08 §4](./08-deployment-and-environment-e2e.md) G12 | `test/server-integration`、`e2e/full-compose` | M2 / M3（web 容器随 08 §11 在 M3 出口） |
| `4.20/BE-05`、`4.20/TX-22` | 擦除与停用响应附 `soleOwnerDocCount`；`cordex-ops documents:reassign-owner` 写 owner 授权、`perm_version` 加 1、审计 `admin.owner_reassigned`、在线会话 ≤ 1 s 重算；新 owner 可撤链接、授权、永久删除；非法目标无写入 | [07 §7.4](./07-backend-integration-and-api-e2e.md) O1–O5；SEC-DA-07 | `test/server-integration` | M3 |
| `4.20/BE-03`、`4.20/TX-14` | 迁移目录与 DDL 围栏逐字一致（DB-13） | `scanners/check-migrations-sync`（[12 §7](./12-ci-gates-mapping.md)） | `scanners` | M1（首批迁移入库的 PR） |
| `4.20/BE-07`、`4.20/TX-05` | 主机规格测量场景产出 core 与 core+idp 两档 `host-footprint.json` | [09 §6](./09-performance-and-capacity.md) `host-footprint` | `perf/perf-server`（nightly，报告） | M3 出口前 |
| `4.20/TX-01`、`4.20/BE-10` | 版本恢复可撤销（ADR-0038 定稿后）：只回退恢复事务改写且其后未被写过的键（按 struct 范围判定）、恢复时删除的元素以原 id 复活、整步跳过不提交、墓碑 TTL 已过不复活 | [05 §7.2](./05-collab-simulation-and-property-tests.md) `rs/restore-revert-*`（占位）；检查名 `history:restore-revert`（§3.4） | `test/collab-sim`、`test/server-integration` | M3（ADR-0038 于 M2 出口评审前定稿） |
| `4.20/FE-01` | UnitScope 默认 Provider 登记表：重复登记被拒并记诊断、只影响之后打开的 Unit、dispose 后无残留；model-core 只登记 history、selection | [02 §9.1](./02-contract-suites-and-pluggability.md) `units/*` | `test/unit` | M1 |
| `4.20/FE-02` | 放映中远端更新始终实时应用、无暂停开关 | [06 §5](./06-frontend-component-and-e2e.md) 第 12 行 | `e2e/full-compose` | M3 |
| `4.20/FE-03` | `defaultLayoutOf` 三级回退、跳过墓碑与 `exclude`，slide-ui 调用同一导出符号；`deleteLayout(reassignTo)` 与 I-ML2 修复一致；软门禁的悬空版式按 I-ML2 链修复 | [05 §7.1](./05-collab-simulation-and-property-tests.md) `ml/default-layout-of-chain`、§10 删除版式性质、§8 `inject/dangling-layout` | `test/unit`、`test/collab-sim` | M2（软门禁）/ M3 |
| `4.20/FE-04` | 版式成墓碑后的并发引用：墓碑期读时容错、撤销即恢复、硬删时同事务修复且只写一次、导出引用存活版式 | [05 §6](./05-collab-simulation-and-property-tests.md) `sc-20` 变体 a / b | `test/collab-sim` | M3 |
| `4.20/FE-05` | 删除被引用版式 / 母版确认后可撤销：一个事务、撤销栈加 1、一步恢复引用与原 id；协同下他人后写的页按 Q3 跳过并提示；对话框无「操作不可撤销」、Toast 带「撤销」 | [05 §7.1](./05-collab-simulation-and-property-tests.md) `ml/delete-layout-undo-one-step`、`ml/delete-master-undo-one-step`、`undo/delete-layout-revert-skips-later-writes`；[06 §5](./06-frontend-component-and-e2e.md) 第 25 行 | `test/unit`、`test/collab-sim`、`e2e/full-compose` | M3 |
| `4.20/FE-06` | `enablement` 为假或 `can.*` 未授予时控件 `aria-disabled`、不隐藏、给原因；`can.` 前缀保留与 `enablement` 子句校验 | [06 §2.2](./06-frontend-component-and-e2e.md)「禁用而不隐藏」；`scan-contributions` 规则 (e) 三条负向夹具（TD-089） | `test/unit`、`scanners` | M2 |
| `4.20/FE-07` | 应用主题直接执行，Toast 含影响页数 N，撤销后主题与 12 个色槽复原 | [06 §5](./06-frontend-component-and-e2e.md) 第 25 行 | `e2e/full-compose` | M3 |
| `4.20/FE-16` | 嵌入挂载前后宿主 `html`、`body` 计算样式不变，`:root` 无新增自定义属性 | [06 §11](./06-frontend-component-and-e2e.md)「嵌入样式隔离」 | `e2e/full-compose` | M2 |
| `4.20/FE-18`、`4.20/TX-06` | TT `default` 策略只逐字放行登记的两段 Radix 常量、其余拒绝；sonner、Radix、react-resizable-panels 触发后 TT 与 `style-src` 违规为 0，计算样式与基线一致 | SEC-CL-02；[06 §10.1](./06-frontend-component-and-e2e.md) | `e2e/smoke`（csp-strict）、`test/unit` | M2（报告）/ M3（强制） |
| `4.20/FE-23` | 删除母版的 `reassignTo` 是目标母版：同 `type` 保持、无同 `type` 落首个、单事务；UI 默认取按 `order` 首个剩余母版 | [05 §7.1](./05-collab-simulation-and-property-tests.md) `ml/delete-master-*`、§10 性质；[06 §5](./06-frontend-component-and-e2e.md) 第 25 行 | `test/unit`、`e2e/full-compose` | M3 |
| `4.20/TX-02`、`4.20/TX-04` | 术语旧名残留 0 处；文档链接锚点与带目录前缀的章节引用全部可解析、不做相近改指 | `docs/_tools/check-terms.py`、`docs/_tools/check-links.py` | 文档工具 | M0 |
| `4.20/TX-08` | 生产与测试代码禁 `Date.now`、`Math.random`、无参 `new Date()`，测试另禁 `performance.now` | TD-110 负向夹具四例（[11 §12](./11-test-data-fixtures-and-determinism.md)） | `lint` | M0 |
| `4.20/TX-09` | 每个 Definition 至少一个 `*.type-test.ts` 以标识符引用它 | `scan-manifest` 规则 (e3)（TD-111）负向夹具两例 | `scanners` | M0 |
| `4.20/TX-13` | typescript、yjs、y-protocols 版本钉 | SEC-SC-05（TD-079 负向夹具三例） | `scanners/lockfile-guard` | M1 |
| `4.20/TX-16` | 语料桶四个变量缺失即失败、不跳过 | [11 §10](./11-test-data-fixtures-and-determinism.md)；[12 §3](./12-ci-gates-mapping.md) | `test/fidelity-roundtrip`、`e2e/oracle-gated` | M1 |

### 6.5 §4.23（插件管理：3 题用户裁决与 O-1…O-4，2026-10-01）

标签写 `@ruling 4.23/<id>`，id 集合按 §1.1「`4.23`」一条生成。O-1…O-4 已于 2026-10-01 由用户确认按推荐，测试要求按推荐答案写。

| 标签 | 测试要求 | 测试 | 步骤 | 到期 |
|---|---|---|---|---|
| `4.23/Q1` | 两级管理：只有 `platformRole='admin'` 能改策略；普通用户只能在 `optional` 范围内个人启停 | [07 §7.5](./07-backend-integration-and-api-e2e.md) PL2、PL6；SEC-AZ-16；[06 §5](./06-frontend-component-and-e2e.md) 第 30 行 | `test/server-integration`、`e2e/full-compose` | M3 |
| `4.23/Q2` | 只认部署预置：插件只经声明文件加入；无签名且无审核记录被拒；界面无上传、安装入口 | [08](./08-deployment-and-environment-e2e.md) RA13、C9、G13；SEC-SC-09、SEC-SC-10 | `test/server-integration`、`e2e/full-compose` | M4（镜像内置部分 M3） |
| `4.23/Q3` | 内容级按部署统一、界面级个人启停；缺插件照常打开、降级并提示 | [02 §10.1](./02-contract-suites-and-pluggability.md) `scope/*`、`footprint/*`；[06 §5](./06-frontend-component-and-e2e.md) 第 29、31 行；SEC-AZ-17 | `test/unit`、`e2e/full-compose` | M2（作用域与足迹）/ M3（一致性） |
| `4.23/O-1` | 管理员变更新会话生效，已开会话 ≤ 60 s 横幅「重新加载」且先 flush；内容插件版本变化走 4426 `collab.plugins_outdated`；个人启停即时热切换 | [07 §9](./07-backend-integration-and-api-e2e.md) W21、W22；[06 §5](./06-frontend-component-and-e2e.md) 第 28、30、31 行 | `test/server-integration`、`e2e/full-compose` | M3 |
| `4.23/O-2` | 个人选择服务端按账号保存：换浏览器上下文登录后保持；管理员改 `forced` 后记录保留、改回恢复 | [07 §7.5](./07-backend-integration-and-api-e2e.md) PL6、PL7；[06 §5](./06-frontend-component-and-e2e.md) 第 28 行 | `test/server-integration`、`e2e/full-compose` | M3 |
| `4.23/O-3` | 文档记录内容插件足迹（`id`、最低版本、负责的元素类型），同事务维护、只增不减；导出 pptx 保留、导入读回 | [02 §10.1](./02-contract-suites-and-pluggability.md) `footprint/first-write-same-tx`、`footprint/monotonic`、`footprint/pptx-roundtrip` | `test/unit`、`test/fidelity-roundtrip` | M2 |
| `4.23/O-4` | 管理员插件页 M3 能看能改，审计与生效时机同时交付 | [07 §7.5](./07-backend-integration-and-api-e2e.md) PL3；[06 §5](./06-frontend-component-and-e2e.md) 第 30 行；检查名 `plugins:admin` | `test/server-integration`、`e2e/full-compose` | M3 |

**PM 需求 → 测试**（`@req PRD:PM-xx` 的人工正本；逐条结果以生成的报告为准，R1 / R5 照常对 P0 / P1 判定）：

| 需求 | 优先级与里程碑 | 测试 |
|---|---|---|
| PM-01 角色与权限 | P0；M2 / M3 | [07 §7.5](./07-backend-integration-and-api-e2e.md) PL2、PL6；SEC-AZ-16；[06 §5](./06-frontend-component-and-e2e.md) 第 30 行（普通用户直访回开始页） |
| PM-02 作用域声明与校验 | P0；M2 / M4 | [02 §10.1](./02-contract-suites-and-pluggability.md) `scope/*`、§12 `ctk/scope`；[08](./08-deployment-and-environment-e2e.md) C9 ⑥ |
| PM-03 管控三态 | P1；M3 | [07 §7.5](./07-backend-integration-and-api-e2e.md) PL3、PL5、PL7；[06 §2.2](./06-frontend-component-and-e2e.md) 管理员三态控件 |
| PM-04 部署预置与声明文件 | P1 / P0；M3 / M4 | [08](./08-deployment-and-environment-e2e.md) RA13、C9、G13；SEC-SC-10 |
| PM-05 签名、审核与部署时校验 | P0；M4 | [08](./08-deployment-and-environment-e2e.md) C9；SEC-SC-09 |
| PM-06 管理员界面：清单与状态 | P1；M3 | [06 §5](./06-frontend-component-and-e2e.md) 第 30 行；[07 §7.5](./07-backend-integration-and-api-e2e.md) PL2 |
| PM-07 依赖、冲突与变更影响提示 | P1；M3 | [06 §5](./06-frontend-component-and-e2e.md) 第 30 行；[07 §7.5](./07-backend-integration-and-api-e2e.md) PL5 |
| PM-08 生效时机 | P1；M3 | [07 §9](./07-backend-integration-and-api-e2e.md) W21、W22，§7.5 PL9；[06 §5](./06-frontend-component-and-e2e.md) 第 28、30 行 |
| PM-09 插件配置 | P1；M4 | [07 §7.5](./07-backend-integration-and-api-e2e.md) PL8 |
| PM-10 个人插件面板 | P0 / P1；M2 / M3 | [06 §2.2](./06-frontend-component-and-e2e.md) 个人插件面板、§5 第 28 行；[07 §7.5](./07-backend-integration-and-api-e2e.md) PL1、PL6 |
| PM-11 快捷键冲突入口 | P1；M2 / M3 | [06 §5](./06-frontend-component-and-e2e.md) 第 28 行（冲突跳转、为我关闭） |
| PM-12 缺插件降级与提示 | P1；M2 / M3 | [02 §10.1](./02-contract-suites-and-pluggability.md) `footprint/compare-reasons`、`footprint/unknown-preserved`；[06 §2.2](./06-frontend-component-and-e2e.md) 缺插件横幅、§5 第 29 行 |
| PM-13 协同一致性规则 | P0；M3 | [06 §5](./06-frontend-component-and-e2e.md) 第 31 行；[07 §9](./07-backend-integration-and-api-e2e.md) W21；SEC-AZ-17 |
| PM-14 审计 | P1；M3 | [07 §7.5](./07-backend-integration-and-api-e2e.md) PL3、PL6（不写审计）、PL8，§12.3 插件 action；[08](./08-deployment-and-environment-e2e.md) C9（`plugin.rejected`） |
| PM-15 可观测 | P1；M2 / M3 | [07 §7.5](./07-backend-integration-and-api-e2e.md) PL2（失败会话数）、PL9（通知计数）、§12.4 指标名；[08](./08-deployment-and-environment-e2e.md) C9（`cordex_plugins_rejected` 与告警） |
| PM-16 无障碍 | P0；M2 / M3 | [06 §7](./06-frontend-component-and-e2e.md) §7.2 `/admin/plugins` 与插件面板、§7.3「插件管理」、§7.7 |

**图 13-8 PM 需求、检查名与测试文件的对应**

```mermaid
flowchart LR
  diag["M2 plugins:diagnose：PM-02、PM-10、PM-12"]
  admin["M3 plugins:admin：PM-01、PM-03、PM-06–PM-08、PM-14"]
  cons["M3 plugins:consistency：PM-13"]
  trust["M4 plugins:trust：PM-04、PM-05"]
  t02["02 §10.1 作用域与足迹契约"]
  t06["06 §5 第 28–31 行 e2e 与 §7 a11y"]
  t07["07 §7.5 PL1–PL9 与 §9 W21–W22"]
  t08["08 RA13、C9、G13"]
  t10["10 SEC-AZ-16、17 与 SEC-SC-09、10"]
  diag --> t02
  diag --> t06
  admin --> t07
  admin --> t06
  cons --> t06
  cons --> t07
  cons --> t02
  trust --> t08
  trust --> t10
  admin --> t10
```

怎么读：左列是 PRD 05 的四个插件检查名与其覆盖的 PM 需求，右列是承载它们的测试小节；一条检查可以落到多个文件，同一文件也服务多条检查。PM-09 与 PM-15、PM-16 不单列检查名，分别由 `plugins:trust` 的 M4 批次、`plugins:admin` 与 `a11y:axe` 承担。
依据：PRD 05 M2 验收 19、M3 验收 20 与 21、M4 验收 7；PRD 09 §4；rulings §4.23。

### 6.6 §4.21（复用优先、架构三件套与编辑器元素：23 题与默认值，2026-09-26）

标签写 `@ruling 4.21/<id>`，id 按 §1.1「`4.21`」一条改写。只列有测试要求的条目；纯文档或组织口径的条目（`Q-ARCH-REORG`、R-d-01…R-d-09 的文档重组）、尚未立项的 M4+ 条目（`Q-SMARTART`、`Q-EQUATION`，立项时补行）不列。依赖选型类条目的测试要求是「选型被锁住、替代品进不来」，由扫描器与依赖规则承担。

| 标签 | 测试要求 | 测试 | 步骤 | 到期 |
|---|---|---|---|---|
| `4.21/Q-LICENSE-TIERS` | 许可按 ADR-0049 分级判定，传递依赖、字体资产、数据文件与内置源码同扫；逐包例外附证据 | `scanners/license-allowlist`（TD-050，负向夹具九例，§7 ADR-0049 行）；[12 §7](./12-ci-gates-mapping.md) | `scanners` | M0 |
| `4.21/Q-TABLE-DEPTH` | M2 插入表格并编辑单元格文字；M3 结构与样式；归一化模型与 I-TBL1 / I-TBL2 | [06 §5](./06-frontend-component-and-e2e.md) 第 26、32 行；[03 §5.3](./03-fidelity-roundtrip-and-corpus.md) 表格往返；[05 §6](./05-collab-simulation-and-property-tests.md) `sc-25`、`sc-26`；§5a TBL 行 | `e2e/full-compose`、`test/fidelity-roundtrip`、`test/collab-sim`、`test/unit` | M2 / M3 |
| `4.21/Q-CHART-ROUTE` | M1 只读渲染 SSIM ≥ 0.80、惰性子路径；M3 五类编辑、数据网格、内嵌 xlsx 与 numfmt | [04 §8.1](./04-visual-oracle.md) 图表语料；[06 §5](./06-frontend-component-and-e2e.md) 第 33 行；§7 ADR-0036 行；`scanners/scan-bundle-budget`（图表 chunk ≤ 400 KB） | `e2e/oracle-gated`、`e2e/full-compose`、`test/unit`、`scanners` | M1 / M3 |
| `4.21/Q-DB-ACCESS` | 漂移检查直查 `pg_catalog`，含 relkind `p` 的分区父表 | [07 §4](./07-backend-integration-and-api-e2e.md) MG7 | `test/server-integration` | M2 |
| `4.21/Q-WS-GATEWAY` | Hocuspocus 4 嵌入 Fastify 同端口、不用 Server 类与 WsAdapter；协同契约直接跑 Hocuspocus 实例 | [07 §9](./07-backend-integration-and-api-e2e.md) W18；[02 §5.2](./02-contract-suites-and-pluggability.md) `runCollabServerConformance`；§7 ADR-0039 行 | `test/server-integration`、`test/contract` | M2 |
| `4.21/Q-XML-LEXER`、`4.21/X-Q-XML-LEXER` | 自研词法与保真树：W3C 合规子集、21 条边界探针、与 saxes / libxml2-wasm 差分一致；DOCTYPE 一律拒绝 | SEC-IN-02、SEC-IN-03、SEC-IN-10；[05 §10](./05-collab-simulation-and-property-tests.md) XML 往返与差分性质；§7 ADR-0019 行 | `test/unit`、`test/fidelity-roundtrip` | M1 |
| `4.21/Q-NEST-MAJOR` | Nest 12 纯 ESM：五个角色经 `node --import` 预加载启动、`/readyz` 转 200 | [12 §4](./12-ci-gates-mapping.md) 第 13 条 `server-esm-start`；步骤 `iso-smoke/server-esm` | `e2e/smoke`、`iso-smoke` | M1 |
| `4.21/Q-MEDIA-INSERT` | 插入音视频不写 `p:timing`，导出后点击控件播放 | [03 §5.3](./03-fidelity-roundtrip-and-corpus.md) 音视频往返 | `test/fidelity-roundtrip` | P2（随条目启用） |
| `4.21/Q-FRACKEY` | rocicorp 键格式：整数头 + 随机后缀、后缀不以 '0' 结尾、连续追加键不增长 | [05 §10](./05-collab-simulation-and-property-tests.md) 分数索引性质（`order.test.ts`）；§7 ADR-0032 行 | `test/unit`、`test/collab-sim` | M1 |
| `4.21/Q-WEBHOOK-SIG` | Standard Webhooks 三头与测试向量；已废止的旧签名头不再出现 | [07 §12.2](./07-backend-integration-and-api-e2e.md) H1、H2；SEC-EG-02 | `test/server-integration` | M3 |
| `4.21/Q-EXTRA-INSERTS` | 图标与符号插入（M3 P2）：符号面板键盘、图标经 `<img>` 预览、零外呼 | [06 §5](./06-frontend-component-and-e2e.md) 第 27 行；[12 §4](./12-ci-gates-mapping.md) 第 5 条 csp-strict（插入图标面板） | `e2e/full-compose`、`e2e/smoke` | M3 |
| `4.21/H-Q-HP-PERSIST-ACK` | 逐帧落库后才放行广播，`ack{tier,seq}` 经 Stateless 下发；存储失败不丢（exp2 反例） | [07 §9](./07-backend-integration-and-api-e2e.md) W3、W5a、W20；[02 §5.2](./02-contract-suites-and-pluggability.md) 两级 ack 分节 | `test/server-integration`、`test/contract` | M2 |
| `4.21/H-Q-HP-FANOUT` | extension-redis + 文档哈希偏好亲和；Valkey 宕机不杀进程 | [07 §9](./07-backend-integration-and-api-e2e.md) W1、W19 | `test/server-integration` | M3 |
| `4.21/H-Q-HP-PROVIDER` | 官方 provider：`autoConnect:false`、自有调度器重连、FIFO 垫片；v3 / v4 互连 | [05 §9](./05-collab-simulation-and-property-tests.md) `rs/*` 脚本、§11 provider 互连 | `test/unit`、`test/server-integration` | M2 |
| `4.21/H-Q-HP-SERVER-TX` | 版本恢复、彻底删除、墓碑清扫先在临时 Unit 上执行并落库再广播；软门禁修复仍先广播 | [07 §9](./07-backend-integration-and-api-e2e.md) W16；§10.1 墓碑与彻底删除 | `test/server-integration` | M2 / M3 |
| `4.21/H-Q-HP-AWARENESS-TICK` | 只对 awareness 帧按连接 100 ms 合并，文档更新不受影响；满员广播 p95 ≤ 100 ms | [07 §9](./07-backend-integration-and-api-e2e.md) W13；[09 §7.1](./09-performance-and-capacity.md) `room-full-fanout` | `test/server-integration`、`perf/perf-server` | M3 |
| `4.21/H-Q-HP-STEP2-CAP` | update ≤ 1 MiB；step2 单设 16 MiB，超限 4413；离线累计 5 MiB 重连一帧落库 | [07 §9](./07-backend-integration-and-api-e2e.md) W8；[02 §5.2](./02-contract-suites-and-pluggability.md) `gate/step2-over-16mib-4413`；[05 §9](./05-collab-simulation-and-property-tests.md) `rs/step2-over-16mib`、`rs/offline-5mib-single-step2` | `test/server-integration`、`test/contract`、`test/collab-sim` | M2 |
| `4.21/X-Q-CONTENT-TYPES` | `[Content_Types].xml` 与 `.rels` 结构不变即原样写回，变了才重生成且 c14n 等价 | [03 §4.2](./03-fidelity-roundtrip-and-corpus.md)、§5.2 E7 | `test/fidelity-roundtrip` | M1 |
| `4.21/X-Q-XML-PACKAGE` | `@cordexjs/xml` 零运行时依赖、格式盲、不抛异常 | §7 ADR-0019 行（depcruise 零依赖、lint 格式盲与禁 `throw`） | `depcruise`、`lint` | M0 |
| `4.21/R-d-62`、`4.21/R-d-66` | 插入工具态（十字光标、4 px 阈值、Esc 取消、插入后选中）；形状库首批 72 项可插入 | [06 §5](./06-frontend-component-and-e2e.md) 第 26 行 | `e2e/full-compose` | M2 |
| `4.21/R-d-64`、`4.21/R-d-65` | 新元素只写 `p:style` 引用、线条落 `p:cxnSp`；空文本框退出即删除且与插入同一撤销步 | [03 §5.3](./03-fidelity-roundtrip-and-corpus.md)；[06 §2.2](./06-frontend-component-and-e2e.md)「单击插入的文本框不输入即退出」 | `test/fidelity-roundtrip`、`test/unit` | M2 |
| `4.21/R-d-67`、`4.21/R-d-68` | 超链接 M2 P1 与激活白名单；视频编辑态临时播放不写 Store | [06 §5](./06-frontend-component-and-e2e.md) 第 27 行 | `e2e/full-compose` | M2 |
| `4.21/H-d-08`、`4.21/H-d-09` | 连接污染：丢过写入帧的连接之后不落库、不回 ack，权限升级后 1012 重建 | [02 §5.2](./02-contract-suites-and-pluggability.md) `gate/no-ack-after-drop`；[05 §8](./05-collab-simulation-and-property-tests.md) `inject/rejected-then-dependent` | `test/contract`、`test/collab-sim` | M2 |
| `4.21/H-d-19`、`4.21/H-d-20`、`4.21/H-d-21`、`4.21/H-d-22` | 钩子自包 try/catch、未预期异常 1011、关闭码 4205 与扩展的 4408、自写 `drainAll` 停机顺序 | [07 §9](./07-backend-integration-and-api-e2e.md) W4、W9、W19；`close-policy.test` | `test/server-integration`、`test/unit` | M2 |

### 6.7 §4.22（设计待决收口：3 题、SF、D 与 DF，2026-09-30）

标签写 `@ruling 4.22/<id>`，id 按 §1.1「`4.22`」一条生成。只列有测试要求的条目；只改样张或文档措辞的条目（SF-01、SF-03、SF-04、SF-08、SF-14、D-02、D-07–D-09、D-16、D-17、D-19–D-22、D-24、D-25）不列，样张自审由设计线的截图登记承担；DF 只列测试线负责出语料、对照或基准的项，触发条件到了才转为门禁。

| 标签 | 测试要求 | 测试 | 步骤 | 到期 |
|---|---|---|---|---|
| `4.22/Q1-insert-placement` | 插入页签插表格、图表、图片时先填空内容占位符（已选中的优先），保留 `p:ph`、走 `slide.fillPlaceholder`；没有才居中；图标与音视频沿用原规则 | [06 §5](./06-frontend-component-and-e2e.md) 第 26 行「插入落点」；50/10 §12.1 V21 `insert-tool.test.ts` | `e2e/full-compose`、`test/unit` | M2（图表填入 M3） |
| `4.22/Q2-placeholder-table-icon` | 空内容占位符的表格图标弹与插入页签同一网格弹层 | [06 §5](./06-frontend-component-and-e2e.md) 第 32 行 | `e2e/full-compose` | M2 |
| `4.22/Q3-table-row-limit`、`4.22/DF-10` | 网格悬停 8 行 × 10 列；对话框行列 1–75（暂定）越界内联报错；上限由大表插入基准定值 | [06 §5](./06-frontend-component-and-e2e.md) 第 32 行；[09 §3.1](./09-performance-and-capacity.md) 大表插入基准 | `e2e/full-compose`、`perf/perf-client` | M2 表格插入开工前（基准）/ M2（对话框） |
| `4.22/SF-02` | 占位符图标条：只看 `enabledKinds`、放不下折叠为「插入 ▾」、APG Toolbar 键盘（一个 Tab 停靠点、←/→ 循环、禁用项可聚焦并给原因） | [06 §7.3](./06-frontend-component-and-e2e.md) 键盘 e2e；[06 §5](./06-frontend-component-and-e2e.md) 第 26 行（图标条消失与恢复） | `e2e/a11y`、`e2e/full-compose` | M2 |
| `4.22/SF-05`、`4.22/SF-06`、`4.22/SF-07` | 表格网格读数与 toast、插入表格对话框、M2 锁定态 tooltip「M3 提供」、只读不画插入符与手柄 | [06 §5](./06-frontend-component-and-e2e.md) 第 32 行 | `e2e/full-compose` | M2 / M3 |
| `4.22/SF-09`、`4.22/SF-10`、`4.22/SF-11`、`4.22/SF-12`、`4.22/SF-13` | 更改类型确认条（两种形态、焦点在「切换」）、只读类型 toast 10 s 去重、数据网格右键菜单与到边禁用、`ChartTypeMenu` 三处共用 | [06 §5](./06-frontend-component-and-e2e.md) 第 33 行 | `e2e/full-compose` | M3 |
| `4.22/D-01`、`4.22/D-06` | M2 无悬停「+」与分隔线手柄；M2 单元格选区出文本条，条尾「表格结构 M3」禁用 | [06 §5](./06-frontend-component-and-e2e.md) 第 32 行 | `e2e/full-compose` | M2 |
| `4.22/D-03` | 边框预设恰为 10 个，与命令枚举一一对应 | [06 §5](./06-frontend-component-and-e2e.md) 第 32 行；model-slide `table-commands` 同位单测（枚举快照） | `e2e/full-compose`、`test/unit` | M3 |
| `4.22/D-04`、`4.22/D-05` | M2「删除表格」可用、一步撤销；M3 只拆合并过的单元格，普通格「拆分单元格…」禁用并给原因 | [06 §5](./06-frontend-component-and-e2e.md) 第 32 行 | `e2e/full-compose` | M2 / M3 |
| `4.22/D-10` | 无编辑权限时右键菜单编辑类项禁用（不隐藏），tooltip「需要编辑权限」 | [06 §5](./06-frontend-component-and-e2e.md) 第 32 行；§6.4 `4.20/FE-06` 的「禁用而不隐藏」 | `e2e/full-compose`、`test/unit` | M2 |
| `4.22/D-11`、`4.22/D-12` | 数据面板两种入口；粘贴超出现有行列自动扩展且一步撤销，超规模整块拒绝 | [06 §5](./06-frontend-component-and-e2e.md) 第 33 行 | `e2e/full-compose` | M3 |
| `4.22/D-13` | 按 `c:lang`（缺省取演示文稿默认语言）解析；numfmt 严格解析，千分位不合规判非法、不提交 | [06 §5](./06-frontend-component-and-e2e.md) 第 33 行；slide-ui 数据网格单测（numfmt 解析表驱动） | `e2e/full-compose`、`test/unit` | M3 |
| `4.22/D-14` | 新插入图表导出写 `c:dispBlanksAs val="gap"`，空值画缺口 | [06 §5](./06-frontend-component-and-e2e.md) 第 33 行；slide-render-chart `chart-data-roundtrip.test.ts` | `e2e/full-compose`、`test/unit` | M3 |
| `4.22/D-15` | 他人删类别 / 系列：先退出格编辑，toast 与「恢复该类别（系列）」，以原 id 复活且含本端修改 | [05 §6](./05-collab-simulation-and-property-tests.md) `sc-30`、`sc-31`；[06 §5](./06-frontend-component-and-e2e.md) 第 33 行 | `test/collab-sim`、`e2e/full-compose` | M3 |
| `4.22/D-18` | 五类以外的图表不进菜单；导入的非五类图表双击或 Enter 时 toast「此类型仅支持查看」 | [06 §5](./06-frontend-component-and-e2e.md) 第 33 行 | `e2e/full-compose` | M3 |
| `4.22/D-23` | 多张图片拖入空占位符：指针下的占位符填第一张，其余在放下点错位 0.2 in 普通插入 | [06 §5](./06-frontend-component-and-e2e.md) 第 26 行（上传与拖入段） | `e2e/full-compose` | M2 |
| `4.22/DF-03`、`4.22/DF-08`、`4.22/DF-09` | 测试线在维护机上交付 PowerPoint 对照与语料：列分隔线拖动语义、三语 `datetime1`…`datetime13`、`obj` 占位符填图的 `xfrm` 与 `srcRect` | [03 §12.1](./03-fidelity-roundtrip-and-corpus.md) | 半机械（`test/evidence/`） | 各自触发条件（M2 P1 / M2 P2 / M3 开工前） |
| `4.22/DF-05` | 图表真实外观按图表语料校准（SSIM ≥ 0.80、数据墨迹 IoU ≥ 0.85） | [04 §8.1](./04-visual-oracle.md) | `e2e/oracle-gated` | slide-render-chart 实现后 |

### 6.8 §4.24（设计线对齐审计：AL-1…AL-7 与 TA-1…TA-10，2026-10-03）

标签写 `@ruling 4.24/<id>`，id 按 §1.1「`4.24`」一条生成。TA-3（ADR-0038 状态按 ADR 文件为准）只改文档引用、无测试要求，不列。

| 标签 | 测试要求 | 测试 | 步骤 | 到期 |
|---|---|---|---|---|
| `4.24/AL-1` | 分享链接只授予 viewer / commenter：API 400、库内 CHECK 兜底、只凭链接者至多 commenter；对话框无「可编辑」 | [07 §7.2](./07-backend-integration-and-api-e2e.md) S8、§4 MG9、§5.1 X3；SEC-AZ-19；[06 §5](./06-frontend-component-and-e2e.md) 第 36 行 | `test/server-integration`、`e2e/smoke`（security-rls）、`e2e/full-compose` | M3 |
| `4.24/AL-2` | 个人插件面板为对话框路由：父路由不卸载、支持 `?state=conflict` 深链与刷新直达 | [06 §5](./06-frontend-component-and-e2e.md) 第 28、35 行 | `e2e/full-compose` | M2 |
| `4.24/AL-3` | renderer 不读库、无凭据；内容级集合只来自 worker → renderer RPC `contentPlugins` | SEC-RS-08；[03 §6](./03-fidelity-roundtrip-and-corpus.md) X8；[07 §11.6](./07-backend-integration-and-api-e2e.md) AU9 | `test/server-integration`、`e2e/smoke`（renderer-egress）、`test/fidelity-roundtrip` | M3 |
| `4.24/AL-4` | 导出里程碑：M2 pptx + 客户端 PNG / SVG（无服务端请求）；M3 服务端批量 PNG / JPEG，M3 后半段 PDF | [06 §5](./06-frontend-component-and-e2e.md) 第 37 行 | `e2e/full-compose` | M2 / M3 |
| `4.24/AL-5` | 分享对话框没有「允许下载 / 打印」开关，后端无对应字段 | [06 §5](./06-frontend-component-and-e2e.md) 第 36 行；[07 §14](./07-backend-integration-and-api-e2e.md) 契约快照（DTO 无该字段） | `e2e/full-compose`、`test/server-integration` | M3 |
| `4.24/AL-6` | 评论不进足迹；单人 preset 与查看器打开带评论的文档不弹缺插件横幅，评论原样往返 | [02 §10.1](./02-contract-suites-and-pluggability.md) `footprint/comments-excluded`；[03 §6](./03-fidelity-roundtrip-and-corpus.md) X7；[06 §5](./06-frontend-component-and-e2e.md) 第 34 行；[05 §10](./05-collab-simulation-and-property-tests.md) 缺插件会话足迹性质 | `test/unit`、`test/fidelity-roundtrip`、`e2e/full-compose`、`test/collab-sim` | M3 |
| `4.24/AL-7` | SV-13 四种作业 M3：受理、幂等、限额、处理、产物与可见性、`automation.job_finished` 同事务回调；迁移 0063 / 0074；不可信输入；批量 100 × D50 ≤ 60 s | [07 §11.6](./07-backend-integration-and-api-e2e.md) AU1–AU10、§12.2 H5、§4 MG9；SEC-IN-11；[09 §6](./09-performance-and-capacity.md) `template-fill-100`；[03 §6](./03-fidelity-roundtrip-and-corpus.md) X9 | `test/server-integration`、`perf/perf-server`、`test/fidelity-roundtrip` | M3 |
| `4.24/TA-1` | 画布评论钉由 slide-ui `CommentPins` 绘制；render-dom 的 `render.overlay` 恰为 3 个条目 | `scanners/scan-manifest --check`（render-dom 清单快照不含 `comment-pins`）；[06 §5](./06-frontend-component-and-e2e.md) 第 14 行（钉点击定位线程） | `scanners`、`e2e/full-compose` | M3 |
| `4.24/TA-2` | 管理员确认卡关闭后焦点回到触发它的三态胶囊 | [06 §5](./06-frontend-component-and-e2e.md) 第 39 行；§7.3 键盘 e2e「插件管理」 | `e2e/full-compose`、`e2e/a11y` | M3 |
| `4.24/TA-4` | 近 24 h 失败会话数取 Valkey 小时桶 HyperLogLog：按会话去重、多实例与重启后一致 | [07 §7.5](./07-backend-integration-and-api-e2e.md) PL11 | `test/server-integration` | M3 |
| `4.24/TA-5` | 服务端与指纹一律用 cordis 插件 id；`computeExclude` 按对应表换算、对应不上的记诊断并忽略 | [02 §10.1](./02-contract-suites-and-pluggability.md) `exclude/dependency-closure`；[07 §7.5](./07-backend-integration-and-api-e2e.md) PL1（响应 `id` 为插件 id） | `test/unit`、`test/server-integration` | M2 |
| `4.24/TA-6` | 被内容级插件必需注入的界面级插件视同强制、不进 `exclude`；管理员页对其「禁用 / 用户选择」不可选 | [02 §10.1](./02-contract-suites-and-pluggability.md) `exclude/dependency-closure`；[06 §2.2](./06-frontend-component-and-e2e.md) 管理员页草稿行、§5 第 39 行 | `test/unit`、`e2e/full-compose` | M2 / M3 |
| `4.24/TA-7` | `server.plugins.*`、`collab.plugins_outdated` 登记且有消费者；缺 `If-Match` 等入参错误 400 `server.plugins.validation_failed` | `scanners/scan-observability-identifiers`（错误码登记唯一且有消费者，§7 ADR-0011 行）；[07 §7.5](./07-backend-integration-and-api-e2e.md) PL4；§9 W21（4426） | `scanners`、`test/server-integration` | M3 |
| `4.24/TA-8` | react-table 只在 ui-react 的 `DataGrid`，不进图表惰性 chunk | depcruise `cordex-third-party-single-entry`（§7 ADR-0036、ADR-0049 行）；`scanners/scan-bundle-budget`（图表 chunk 清单不含 react-table） | `depcruise`、`scanners` | M3 |
| `4.24/TA-9` | 服务端导出写足迹 `p:extLst`、导入读回；headless 按受理时策略取内容级集合；握手先比对插件指纹再准入 | [03 §6](./03-fidelity-roundtrip-and-corpus.md) X6、X8；[07 §9](./07-backend-integration-and-api-e2e.md) W23、§11.6 AU9 | `test/fidelity-roundtrip`、`test/server-integration` | M3 |
| `4.24/TA-10` | 配额用量端点、位图导出 `width` / `quality`、文档列表所有者与协作者摘要（仅 owner）、管理员页头部署与宿主版本 | [07](./07-backend-integration-and-api-e2e.md) §8 D12、D13，§11.2 J8，§7.5 PL10；SEC-AZ-18；[06 §5](./06-frontend-component-and-e2e.md) 第 37、39 行 | `test/server-integration`、`e2e/full-compose` | M2（列表摘要）/ M3 |

**图 13-9 §4.21、§4.22、§4.24 的义务落点**

```mermaid
flowchart LR
  r21["§4.21：23 题与默认值"]
  r22["§4.22：Q1–Q3、SF、D、DF"]
  r24["§4.24：AL-1…AL-7、TA-1…TA-10"]
  f02["02 契约：协同服务端、足迹与 exclude"]
  f03["03 往返：写回口径、足迹 extLst、按策略装配"]
  f05["05 协同模拟：step2、表格与图表软冲突"]
  f06["06 e2e：插入、表格、图表、插件界面、分享与导出"]
  f07["07 后端集成：Hocuspocus、Webhook、自动化、配额"]
  f09["09 性能：大表基准、满员合并、模板填充"]
  f10["10 安全：XML、链接角色、renderer、机密"]
  fsc["扫描器与依赖规则：许可、单点、体积、错误码"]
  r21 --> f02 & f05 & f07 & fsc
  r21 --> f03
  r22 --> f06 & f05 & f09
  r22 --> f03
  r24 --> f06 & f07 & f10
  r24 --> f02 & f03
  r21 --> f10
  r21 --> f09
```

怎么读：左列是三节裁决，右列是承接其测试义务的文件或机制；一节裁决通常分散到多个文件。§4.21 偏协同服务端与依赖治理，§4.22 偏表格与图表的界面与基准，§4.24 偏插件链路、后端新端点与安全面。逐条以上面三张表为准。
依据：rulings §4.21、§4.22、§4.24；本节三张表。

---

## 7. ADR 映射

本节是 `obligations.json` 中 `kind: 'adr'` 的人工正本：逐个 ADR 把「如何被机械验证」落到执行点。标签写 `@adr <编号>/<决策号>`；只有扫描器、lint 或类型检查承载的条目不需要测试标签，由对应规则的负向夹具证明（09-08 的 TD 行）。

| ADR | 机械验证要点 | 执行点 |
|---|---|---|
| 0001 声明合并 | 非 kernel 不 import cordis；`declare module` 只在 `*.contribution.ts`；类型测试 | `depcruise`、`lint`、`test-typecheck`、`api-surface` |
| 0002 版本策略 | fixed 组生成一致；peer 依赖；版本不匹配 FAILED；弃用到期 | `api-surface`、`scanners/scan-manifest`、`test/unit`、`scanners/scan-deprecations` |
| 0003 清单生成 | `manifest.ts` 重新生成无 diff；声明与实现不一致 FAILED | `scanners/scan-manifest --check`、`test/unit` |
| 0004 monorepo 工具链 | frozen lockfile；publint 与 attw；references 一致；lockfile 唯一；Node 版本一致 | 全部 job 的安装步骤、`api-surface`、`scanners/lockfile-guard` |
| 0005 UnitScope | 两 Unit 隔离、关闭无残留；Unit 事件首参 `unitId` | `test/unit`、`test/lifecycle`、`lint`、`test-typecheck` |
| 0006 贡献点唯一注册表 | 禁 register 方法与模块级可变状态；贡献可追溯；重复键拒绝并诊断 | `lint`、`scanners/scan-contributions`、`test/unit` |
| 0007 DocumentStore 与派生撤销 | 两个 Provider 过同一 kit；逆操作性质；body 深只读 | `test/contract`、`test/unit`、`test-typecheck` |
| 0008 不透明保留 | 零编辑与编辑后往返、元素级保留、外部关系、Strict、zip 限额 | `test/fidelity-roundtrip`、`xsd-validate`、`test/unit`、`test-typecheck` |
| 0009 快照版本与迁移 | schema 哈希锁；历史样本全部迁移；缺链与乱序报错 | `scanners/schema-lock`、`test/snapshot-migration-corpus`、`test/unit` |
| 0010 preset 与 loader | exclude 矩阵、顺序无关、惰性加载；体积 | `test/lifecycle`、`test/unit`、`scanners/scan-bundle-budget`、`depcruise` |
| 0011 errors / telemetry 为 L0 服务 | 无裸 throw 与 console；错误码登记唯一且有消费者；sink 降级 | `lint`、`scanners/scan-observability-identifiers`、`test/unit` |
| 0012 权限 fail-closed 位置 | 命令声明能力位；零策略全拒；viewer 的 WS update 被拒 | `lint`、`test/unit`、`test/contract`、`test/server-integration`（SEC-AZ-06） |
| 0013 Mutation 降级 | Mutation 无下标字段；逆操作性质；降级确定性；并发 order 收敛 | `lint`、`test/unit`、`test/contract` |
| 0014 稳定 id | 往返 id 不变、新 id 唯一；实体键为 NodeId 品牌 | `test/unit`、`test-typecheck` |
| 0015 单一执行入口 | `transact` 只在两处；执行选项封闭；查看器只读 | `lint`、`test-typecheck`、`test/lifecycle`、`test/unit` |
| 0016 文档类型盲 | R3 / R4、字面量禁用、运行时 fixture、M5 冻结 | `depcruise`、`lint`、`test/preset-blind`、`scanners/horizontal-freeze` |
| 0017 shadcn 复制模型 | 单点引入与目录私有；复制件与主题变量契约；上游 diff；axe；体积 | `depcruise`、`test/unit`、`scanners/shadcn-diff`、`e2e/a11y`、`scanners/scan-bundle-budget` |
| 0018 可追加元素的模型补全与插入命令族（草稿，2026-10-03 登记；接受后 `@adr 0018/*` 标签生效） | 插入超限不开事务（单页 999 / 1,000 / 1,001、全文 19,999 / 20,000 / 20,001 含墓碑）；一次插入一个撤销步与三种合并（空文本框退出、`fillPlaceholder`、带 `setAction` 的动作按钮）；新元素只写 `p:style` 引用；I-TBL1 / I-TBL2 与 I-GRP1 性质（`repair` 一次即净、两种 Store 收敛）；表格与装饰性、`svgBlip` 往返 c14n 等价；连接符导出确定性；`capabilities` 驱动手柄（[06 §2.2](./06-frontend-component-and-e2e.md)、§5 第 26、32 行；[05 §6](./05-collab-simulation-and-property-tests.md) `sc-25`–`sc-29`；[03 §5.3](./03-fidelity-roundtrip-and-corpus.md)） | `test/unit`、`test/collab-sim`、`test/fidelity-roundtrip`、`e2e/full-compose` |
| 0019 XML 词法与保真树（2026-10-03 登记） | `@cordexjs/xml` 零运行时依赖、`devDependencies` 只在 `__tests__/**`；格式盲（禁 OOXML 命名空间与文档类型字面量）；禁 `throw`、模糊测试只出现两个登记码；10 万层嵌套不抛 `RangeError`；同构冒烟；`XmlLimits` 每键恰在上限通过、加一拒绝；写回口径（零编辑 `[Content_Types].xml` 与 `.rels` 字节相同）；W3C 合规、边界探针、差分与流式等价（SEC-IN-02、SEC-IN-03、SEC-IN-10；[03 §4.2](./03-fidelity-roundtrip-and-corpus.md)；[05 §10](./05-collab-simulation-and-property-tests.md)）；废止键名残留由 `check-terms` 报 | `depcruise`、`lint`、`test/unit`、`iso-smoke`、`test/fidelity-roundtrip`、文档工具 |
| 0020 CRDT | yjs 只在三包；公共 API 无 Y 类型；两 store 同契约；模拟收敛；yjs 精确版本；撤销语义 | `depcruise`、`api-surface`、`test/contract`、`test/collab-sim`、`scanners/lockfile-guard` |
| 0021 渲染介质 | oracle；帧率与打开预算；RenderTarget 契约；禁 waterfall 与 HTML 注入 | `e2e/oracle-gated`、`perf/perf-client`、`test/contract`、`lint` |
| 0022 服务端存储 | 七套服务端 kit；RLS 覆盖与绕过测试；无租户；仓储经权限服务；崩溃重放；迁移向前兼容一版 | `test/contract`、`test/server-integration`、`scanners`、`e2e/smoke` |
| 0023 传输与协议 | 传输与离线 kit（FixedClock）；`@hocuspocus/provider` v3 / v4 互连与 y-protocols 编码一致（`apps/server/test/e2e/collab/provider-interop.e2e-spec.ts`，[05 §11](./05-collab-simulation-and-property-tests.md)；§4.21 取代 y-websocket 互操作）；CONTROL schema 快照；protocol 无 yjs | `test/contract`、`test/server-integration`、`test/unit`、`depcruise` |
| 0024 presence | 节流与超时；加入 1 s 内拿到全量；远端光标跟随 | `test/unit`、`test/contract`、`e2e/full-compose` |
| 0025 持久化与压缩 | 压缩触发与租约；bootstrap 等价；崩溃前后 ack；恢复；两级 ack；墓碑；降级期广播；溢写认领；彻底删除元素 | `test/unit`、`test/contract`、`test/server-integration` |
| 0026 headless 缩略图 | 服务端与客户端像素差 ≤ 0.5%；页哈希；封面响应头；renderer 安全；无 sharp；`/render` 零请求与 ready 判据 | `e2e/oracle-gated`、`test/server-integration`、`e2e/smoke`、`scanners/license-allowlist` |
| 0027 文本度量 | 两个度量 Provider 过 kit 且 advance 误差 ≤ 1%；断行黄金用例；竖排与 RTL；受限字体 | `test/contract`、`e2e/oracle-gated`、`test/unit` |
| 0028 文本编辑宿主 | 组合事件一次事务；IME e2e；编辑中与失焦截图一致；axe | `test/unit`、`e2e/full-compose`、`e2e/a11y` |
| 0029 网关鉴权 | 票据、只读写入、降权、锁定、分享链接、凭据模式、路由覆盖、邀请 | SEC-AZ-*、SEC-AU-03 / 04、SEC-DA-01：`test/server-integration`、`e2e/smoke` |
| 0030 可观测栈 | 名称登记与消费者；client-telemetry 限制；no-op 降级；单一 trace 贯穿 | `scanners`、`test/server-integration`、`test/unit`、`e2e/full-compose` |
| 0031 评论与锚点 | commenter 权限；锚点分离与恢复；镜像 ≤ 1 s | `e2e/full-compose`、`test/unit`、`test/server-integration` |
| 0032 分数索引 | 键性质与长度；并发移动收敛；rekey 顺序不变 | `test/unit`、`test/contract`、`test/collab-sim` |
| 0033 离线持久化（M4） | 离线 kit 用 IDB 替身；断网刷新后同步；collab-yjs 不用 indexedDB | `test/contract`、`e2e/full-compose`、`scanners/scan-isomorphic` |
| 0034 服务端校验与修复 | 硬门禁拒绝用例；修复黄金用例；5% 非法注入；软门禁 p95 ≤ 5 ms；审计 | `test/unit`、`test/collab-sim`、`perf/perf-server`、`test/server-integration` |
| 0035 水平扩展 | 两实例扇出与崩溃；Valkey 断开 30 s；滚动发布演练；准入与内存预算；天花板 | `test/server-integration`、`e2e/full-compose`、`perf/*` |
| 0036 图表渲染与编辑路线（2026-10-03 登记） | `chart` 类别三层判定（SSIM ≥ 0.80、数据墨迹 IoU ≥ 0.85，M1 gated；刻度一致率与绘图区 IoU 先报告，[04 §8.1](./04-visual-oracle.md)）；版式纯函数与 `chart-data-roundtrip.test.ts`（写回缓存与 `c:f` 一致、内嵌 xlsx 读回同一份数据、零编辑部件字节相同）；渲染器缺席与 chartex 占位；无图表文档不加载图表 chunk、chunk ≤ 400 KB；d3-* 与 numfmt 只在规定目录、react-table 只在 ui-react（rulings §4.24 TA-8）；数据格提交到重绘 ≤ 100 ms；并发改格与增删类别系列后两端 `Chart.data` 一致（[05 §6](./05-collab-simulation-and-property-tests.md) `sc-30`、`sc-31`）；新图表 `dispBlanksAs=gap` 与 numfmt 严格解析（[06 §5](./06-frontend-component-and-e2e.md) 第 33 行）；维护机「编辑数据」可打开（半机械） | `e2e/oracle-gated`、`test/unit`、`scanners/scan-bundle-budget`、`depcruise`、`perf/perf-client`、`test/collab-sim`、`e2e/full-compose`、`test/evidence/` |
| 0039 协同服务端 Hocuspocus（2026-09-26 整合登记） | `runCollabServerConformance` 直接跑 Hocuspocus 实例；连接污染 `gate/no-ack-after-drop`（[02 §5.2](./02-contract-suites-and-pluggability.md)）；step2 上限 `gate/step2-over-16mib-4413` 与 `rs/step2-over-16mib`；关闭码 `close-policy.test`；嵌入 Fastify 同端口与 Valkey 宕机不杀进程（[07 §9](./07-backend-integration-and-api-e2e.md) W18、W19）；provider v3 / v4 互连 | `test/contract`、`test/collab-sim`、`test/server-integration`、`test/unit` |
| 0037 部署拓扑 | 启动断言与装配矩阵；镜像策略；断网；renderer 安全；反代预签名；SBOM；M4 多架构；决策 5 最低主机规格的实测（`host-footprint`，只报告，rulings §4.20 BE-07+TX-05） | `test/server-integration`、`scanners/check-image-policy`、`e2e/full-airgap`、`e2e/smoke`、`e2e/full-compose`、`perf/perf-server` |
| 0038 版本恢复的撤销（提议；M2 出口评审前定稿，rulings §4.20 TX-01+BE-10） | 撤销只回退恢复事务改写且其后未被写过的键（按 struct 范围判定）；恢复时删除的元素以原 id 复活；整步跳过不提交；墓碑 TTL 已过不复活；「谁能撤销」「可撤销时效」定稿时补 | `test/collab-sim`、`test/server-integration`（[05 §7.2](./05-collab-simulation-and-property-tests.md)；定稿后 `@adr 0038/*` 标签生效） |
| 0040 / 0041 类型预算与断言策略 | 逃逸计数与预算只减不增 | `scanners/scan-type-escapes`、`lint` |
| 0042 / 0043 无 enum、Result 与异常 | lint 与编译选项 | `lint`、`typecheck` |
| 0044 ESLint 与 Biome 分工 | 配置无重叠规则 | `policy-check` |
| 0045 isolatedDeclarations | 编译器强制 | `typecheck` |
| 0046 原生 TS 编译器评估 | 决策为「不采用」，无正向断言；CI 编译器版本固化：catalog 中 `typescript` 为 5.9.x 或 6.x（TD-079，rulings §4.20 TX-13） | `scanners/lockfile-guard`（SEC-SC-05） |
| 0047 品牌类型 | 禁 `as` / `!` 间接闭合；类型测试 | `lint`、`test-typecheck` |
| 0048 类型测试工具 | `test-typecheck` 在每个 PR 运行；负例带说明 | `test-typecheck`、`lint` |
| 0049 依赖准入与许可分级（2026-10-03 登记） | 全部已安装包、字体资产、数据文件与内置源码按附表判定（负向夹具：GPL-3.0 依赖、MPL 包被 patch、OFL 包含 JS 入口、CC0 代码包、缺 license、`OR` 两支都不合档、`OR` 未登记取向、`UNLICENSED` 未登记例外；正向：已登记 EX-01 的 redlock）；第三方库只从单点表允许的包 import；冷却期与安全设置显式存在；新增浏览器依赖进体积预算；nightly 停更报告只报告 | `scanners/license-allowlist`、`depcruise`、`lint`、`scanners/lockfile-guard`、`scanners/scan-bundle-budget` |
| 0050 内容插件足迹（提议，2026-10-03 登记；接受后 `@adr 0050/*` 标签生效） | 写入内容级插件元素后足迹与内容同一 `TransactionRecord`；撤销不回退、界面级插件不产生足迹；写评论不产生足迹、不装 `comments` 的会话打开带评论的文档比对为空且评论原样往返（rulings §4.24 AL-6）；`comparePluginFootprint` 四种原因；导出再导入足迹逐字段相同、零编辑 `ppt/presentation.xml` 字节不变；缺插件会话编辑后足迹不变（[02 §10.1](./02-contract-suites-and-pluggability.md) `footprint/*`；[03 §6](./03-fidelity-roundtrip-and-corpus.md) X6、X7；[05 §10](./05-collab-simulation-and-property-tests.md)；[06 §5](./06-frontend-component-and-e2e.md) 第 29、34 行） | `test/unit`、`test/fidelity-roundtrip`、`test/collab-sim`、`e2e/full-compose` |

---

## 8. 人工与半机械项

依据：决策 T-COVERAGE-EVIDENCE（needsUser=false：人工证据放 `test/evidence/<里程碑>/<检查名>.md`，大文件放对象存储，矩阵中标 manual 并单独统计）。证据文件头字段见 [01 §8](./01-strategy-and-layers.md)。

| 项目 | 对应检查名或需求 | 执行方式 | 证据 | 频率 |
|---|---|---|---|---|
| PowerPoint 互操作 | `fidelity:interop`；`layout:apply`、`master:edit`、`fidelity:edit-roundtrip` 的「PowerPoint 打开无修复」部分；NF-08 | 维护机脚本自动打开并截图，人工复核失败项（[03 §12](./03-fidelity-roundtrip-and-corpus.md)） | `test/evidence/M1/fidelity-interop.md`（M2、M3 各一份） | 每周与里程碑出口前 |
| 评论互操作抽样 | `comments:roundtrip` | 20 个样本在 PowerPoint 365 中核对作者与时间 | `test/evidence/M3/comments-roundtrip.md` | 里程碑出口前 |
| 屏幕阅读器矩阵 | NF-05（NVDA + Chrome、VoiceOver + Safari、JAWS + Edge，P1） | 按清单逐项朗读核对 | `test/evidence/M2/a11y-screen-readers.md`、`test/evidence/M3/…` | 里程碑出口前 |
| IME 真机手测 | ED-02、ADR-0028 | 中、日、韩输入法 × Chrome、Safari 的手测清单（[06 §9](./06-frontend-component-and-e2e.md)） | `test/evidence/M2/ime-manual.md` | 里程碑出口前 |
| ASVS L2 自评 | NF-04、SV-12 | 映射完整性机械校验，结论人工（[10 §14](./10-security-testing.md)） | `test/evidence/M3/security-asvs.md` | M3 出口 |
| 第三方渗透测试 | `security:pentest` | 第三方执行与复测 | `test/evidence/M3/security-pentest.md` | M3 出口 |
| 外部 IdP 登录清单 | SV-06（Entra、飞书经 Casdoor；决策 T-IDP） | 发布前人工登录（[08 §7](./08-deployment-and-environment-e2e.md)） | `test/evidence/M3/idp-manual-login.md` | 每次发布前 |
| 外部试点 | `pilot:external` | 内部非核心成员或全新 AI agent 会话按旅程完成插件 | `test/evidence/M4/pilot-external.md` | M4 出口 |
| 可插拔证据的零 diff 记录 | `pluggable:m2` | 引入示例插件的 PR 的 `git diff --stat` 归档（[02 §10](./02-contract-suites-and-pluggability.md)） | `test/evidence/M2/pluggable-m2.md` | 一次性 |
| 崩溃自由会话率 | NF-03 | 试运行期间的线上指标 | `test/evidence/M2/crash-free-sessions.md` | M2 出口 |
| 数据处理清单 | NF-11 | 人工编写（DPIA 输入） | `test/evidence/M3/privacy-dpia.md` | M3 出口 |
| M0 评审与 spike | `M0#1`、`M0#5` | 评审纪要、spike 报告 | `test/evidence/M0/*.md` | M0 出口 |

**统计与判定**：矩阵把上述项目标为 `manual`，在 `traceability-report` 中单独成表（每个里程碑的 manual 项数、`pass` / `fail` / `waived` 分布），不混入自动化覆盖率。出口评审要求本里程碑全部 manual 项为 `pass`，或为带审批人与理由的 `waived`；P0 检查名对应的人工项不允许 `waived`。证据日期不得早于该里程碑进入 `exit-review` 之前 30 天（R9 的一部分），避免拿旧证据过出口。

---

## 9. 维护流程

1. **新增或修改需求**：改 PRD 的同一 PR 运行 `gen-requirements` 更新清单（否则 R10 失败）。需求所属里程碑为 `active` 时，缺测试只在报告中列出（R2）；实现该需求的 PR 同时加入带 `@req` 的测试。
2. **范围变更**（PRD 05 §6：提案 → 待决登记 → 决策 → 修订 PRD 05 → 更新矩阵）：修订 PRD 05 的 PR 同时更新 `test/traceability/check-names.json` 与本文 §3；检查名增删而映射未改时 R4 失败，因此「更新需求 ↔ 测试矩阵」这一步是机械强制的。
3. **新增裁决或 ADR 验证条目**：rulings 新增带测试要求的条目、ADR 新增「如何被机械验证」时，在本文 §6 / §7 加行并同步 `obligations.json`；本文表格与机器副本的一致性由 `test/traceability/doc-sync.test.ts`（解析本文表格，`test/unit`）核对。
4. **里程碑出口评审**：在出口评审 PR 中把 `milestones.json` 的状态改为 `exit-review` → R1 / R4 / R6 由报告转为失败 → 补齐缺口 → 评审读取 `traceability-report`、main 与 nightly 结果和 `test/evidence/` → 签字后改为 `done`（之后 R3 防止覆盖倒退）。
5. **删除或改名测试**：若使某个 id 失去全部覆盖，R3 失败；须在同一 PR 给出替代测试，或证明该需求已从 PRD 删除。
6. **能力 id 变更**（2026-09-26 追加）：改 50/18 能力表的 PR 同时运行 `gen-requirements` 更新 `capabilities.json`（否则 R10 失败），并同步本文 §5a；能力 id 只追加不复用，拆分或合并时旧 id 在 50/18 标注去向，带旧 `@cap` 的测试在同一 PR 改标签。

---

## 10. 机械验证

| 断言 | 执行点 |
|---|---|
| 标签语法合法、引用的 id 存在（`4.19/*` 的 id 集合按 §1.1 从 rulings §4.19 表格与 evidence `leftoverDecisions` 生成） | 扫描器 `scan-requirement-tags` 规则 (a)(b)（`scanners`、pre-commit） |
| 产出 `dist/requirement-test-matrix.json` | 扫描器 `scan-requirement-tags` 规则 (c) |
| R1–R11 | `test/requirement-matrix` |
| `check-names.json` 的键集合 = 生成的 `checks[]`；每个检查映射的步骤存在于 `tooling/ci/steps.json` 且在该里程碑前已激活 | `test/requirement-matrix` |
| 本文 §3、§4、§6、§7 的表格与 `check-names.json`、`obligations.json` 一致；[12 §6](./12-ci-gates-mapping.md) 的按步骤索引可由 `check-names.json` 重新生成 | `test/unit`（`test/traceability/doc-sync.test.ts`） |
| 证据文件头字段齐全、日期新鲜、P0 人工项未被 `waived` | `test/requirement-matrix`（R9） |
| 需求清单是最新生成物 | `test/requirement-matrix`（R10） |
| `@cap` 标签语法合法、能力 id 存在于 `capabilities.json`；§5a 表中每个能力 id 都在 50/18 中存在、50/18 的每个能力 id 在 §5a 至少出现一次（2026-09-26 追加） | 扫描器 `scan-requirement-tags` 规则 (a)(b)；`test/unit`（`test/traceability/doc-sync.test.ts`） |

---

## 11. 已定裁决与回写

rulings §4.24（2026-10-03）：总编排要求测试线补登 §4.21、§4.22 两节的裁决映射并登记本节。§1.1 与 §2 加入 `4.21`（大写连字符改写规则）、`4.22`、`4.24` 的 id 生成口径；§6.6–§6.8 登记有测试要求的条目，图 13-9；§7 补 ADR 0018、0019、0036、0049、0050（0018 为草稿、0050 为提议，接受后标签生效）；§3 插件四个检查名与 §5a TBL / CHT 行补本轮新增测试。待回写：`gen-requirements.ts` 实现 §1.1 的 §4.21 改写规则与 §4.22、§4.24 的读取口径（[40/01 §5.7–§5.8](../40-modules/01-tooling-and-governance.md)，由总编排执行）。

rulings §4.23（2026-10-01，O-1…O-4 已由用户确认按推荐）：PRD 新增功能域 09 插件管理（PM-01…PM-16），`@req` 正则加 `PM`（§1.1），`gen-requirements` 的输入仍为 `10-prd/03-features/*.md` 故自动纳入；PRD 05 新增四个检查名登记在 §3.3–§3.5，`check-names.json` 同步；§6.5 登记 `4.23/Q1–Q3`、`4.23/O-1…O-4` 与 PM → 测试表。待回写：[09-06 §12](../30-architecture/09-type-discipline/06-scanners.md) `scan-requirement-tags` 规则 (a) 的前缀集合加 `PM`；[50/18](../50-frontend/18-editor-capabilities.md) §26a 新增插件管理域 PLG-01…PLG-07（26 域 172 项），本文 §1.1 `@cap` 前缀集合加 `PLG`、§5a 加 PLG 行已同步；09-06 §12 规则 (a) 的 `@cap` 前缀集合同样加 `PLG`。

rulings §4.21（2026-09-26）：[50/18](../50-frontend/18-editor-capabilities.md) 新建编辑器能力实现总表（25 域、164 项能力 id）。本文随之追加第四类标签 `@cap`（§1.1）、清单 `capabilities.json` 的生成口径（§2）、报告规则 R11（§1.3）与 §5a 能力 id → 测试用例表；`@cap` 只进报告，不改变 R1–R10 的门禁。

rulings §4.20（2026-09-26）已定稿：§1.1 与 §2 加入 `4.20` 的 id 生成口径，§6.4 登记有测试要求的条目，§3.1 `M0#2` 改为 `check-terms.py`，§3.4 新增 `history:restore-revert`（随 ADR-0038），§7 登记 ADR-0038 与 ADR-0037 决策 5 的实测场景。

rulings §4.19 已裁定 INC-09、D-M2-CONTENT、C-06、D-COMMENTS-PKG、D-TEST-INFRA，§6.3 对应行已定稿；PRD 05 已按 D-M2-CONTENT 修订（新增 M2 验收 14–17，§0.3 为 M2 / M3 边界），§3.3 / §3.4 已同步，`check-names.json` 随实现入库时按本文生成。

回写清单（由总编排执行，本组不改其它文档）：

1. [09-06 §12](../30-architecture/09-type-discipline/06-scanners.md)：规则 (a) 的正则改为本文 §1.1 的三类语法（标签位置改为 JSDoc，不再是 `// @req` 注释）；规则 (b) 的存在性来源增加 `rulings.json`、`adrs.json`；规则 (c) 的产物格式按 §1.3 扩展。均为既有扫描器的子规则，不增加扫描器数量。（2026-09-25 §4.19 轮已完成）
2. [30/11 §17](../30-architecture/11-testing-strategy.md)「需求追溯」一条改为链接本文，旧写法 `// @req CO-08`、`test.meta({ req })` 作废。（2026-09-25 §4.19 轮已完成）
3. [40/01 §5.7–§5.8](../40-modules/01-tooling-and-governance.md)：登记工具脚本 `tooling/scripts/gen-requirements.ts`；`tooling/policy/{requirements,rulings,adrs}.json` 改为生成物（`requirements.json` 不再「可选」）；`milestones.json` 增 `status` 字段（`scan-deprecations` 使用的完成日期保留，二者相容）。（2026-09-25 §4.19 轮已完成）
4. ~~rulings：总编排登记 §4.19~~（已完成：§4.19 表格 5 项 + 末句指向 evidence 的 `leftoverDecisions`，生成口径见 §1.1、§2）。
5. ~~PRD 05：建议为未命名的验收条目（M0 验收 1–5、M1 验收 7、M1 验收 8）补检查名；补名前以 `M0#1`、`M1#7` 等作键。~~ 不采纳（rulings §4.20 TX-23）：以 `<里程碑>#<序号>`（如 `M0#1`、`M1#7`）为正式检查名，PRD 05 不补名。
6. ~~`docs/_tools`：M0 验收 2 的术语扫描脚本尚不存在，由总编排实现~~（rulings §4.20 TX-02 已定：`docs/_tools/check-terms.py` + `terms.json`，验收 2 改为「术语表登记的旧名在正文中残留 0 处」，§3.1 已改指；首轮清零与 TX-10 把正文旧名统一为 `FixedClock` 的替换合并执行）。
7. ~~[01 §5](./01-strategy-and-layers.md) 根 `test/` 目录树补 `traceability/`~~（2026-09-25 §4.19 轮已完成）。
8. ~~[01 §8](./01-strategy-and-layers.md) 证据文件头字段补 `req`、`ruling`、`adr`、`reason`、`approver`~~（2026-09-25 §4.19 轮已完成）。
9. [09-06 §12](../30-architecture/09-type-discipline/06-scanners.md)（rulings §4.21）：`scan-requirement-tags` 规则 (a) 增 `@cap` 语法、规则 (b) 的存在性来源增 `capabilities.json`、规则 (c) 的 `tag` 取值增 `cap`；仍是既有扫描器的子规则，不增加扫描器数量。
10. [40/01 §5.7–§5.8](../40-modules/01-tooling-and-governance.md)（rulings §4.21）：`gen-requirements.ts` 增读 `50-frontend/18-editor-capabilities.md`，产出 `tooling/policy/capabilities.json`（生成物，入库，`--check` 同 R10）。
11. 40-modules 各篇 §9 测试布局（rulings §4.21）：登记 §5a 中标「新增」的测试文件（slide-ui `table-selection`、`selection-pane`、超链接与符号面板、数据网格；model-slide `text-search`、节命令与 `pasteSlides`；render-dom 网格覆盖层）。
