# Docs Sync

## 回写记录

| 线 | 文件 | 章节 | 摘要 |
|---|---|---|---|
| 产品 | docs/10-prd/05-milestones-and-scope.md | M0 验收 4 | 补「研发流程门禁 G1–G7 在空骨架上跑通」 |
| 设计 | docs/20-design/README.md | 设计质量门（新增节） | 界面改动先样张、对照截图、Q1–Q10、拍板后回写；指向 80/01 §4 |
| 测试 | docs/70-testing/12-ci-gates-mapping.md | §2、§6、§7、§12 | `scanners` job 登记 `process-*`（G1–G6）与 `docs-*`（G7）步骤；文档工具行改挂 `scanners/docs-terms`；激活时间；本地复现命令 |
| 测试 | docs/70-testing/13-requirements-traceability.md | §9 第 7 条、§10 | 文档侧覆盖（G4）与代码侧 R1–R11 的分工 |
| 其他 | docs/80-process/README.md | 全文（新建） | 原则 P1–P6、一页总览、路线图、待决 W-1 / W-2 |
| 其他 | docs/80-process/01-change-lifecycle.md | 全文（新建） | 三档、五步、提案要素、设计质量门、偏差、rulings 关系、分支提交、缺陷评审发布、断点续做 |
| 其他 | docs/80-process/02-traceability-and-ownership.md | 全文（新建） | 需求编号主键与覆盖规则、事实归属表、引用反查、影响矩阵 |
| 其他 | docs/80-process/03-gates.md | 全文（新建） | G1–G7 判定、脚本、CI 步骤、上线时间；G6 标识符登记与 40-modules 目录树规则 |
| 其他 | docs/00-charter/rulings-2026-09-14.md | §4.25（新增） | DP-1…DP-7、DS-1、DS-2、TP-1…TP-5、被修订的既有口径 |
| 其他 | docs/00-charter/charter.md | §8、§9.1、§9.2 第 9 条 | 文档树加 80-process；分工加「研发流程」；docs/ 之外文件只经 OpenSpec 变更创建 |
| 其他 | docs/README.md | 阅读顺序 13、目录、口径链、与 OpenSpec 的关系 | 加 80-process；OpenSpec 只作变更容器 |
| 其他 | openspec/config.yaml、openspec/schemas/cordex-docs-first/ | 全文（新建） | 项目上下文与写作规则；工作流 proposal → docs-sync → design → tasks |
| 其他 | CLAUDE.md | 全文（新建） | agent 会话流程摘要 |
| 其他 | docs/00-charter/rulings-2026-09-14.md、docs/80-process/02-traceability-and-ownership.md、docs/80-process/03-gates.md、docs/70-testing/12-ci-gates-mapping.md、CLAUDE.md、openspec/config.yaml、openspec/schemas/cordex-docs-first/ | §4.25 DP-8；80/03 §4；80/02 归属表；70/12 §2 | 评审时裁决：源文件含测试文件逐个登记；TP-1…TP-5 与路线图经评审确认 |

## 检查结果

2026-10-05 实现收尾时在仓库根复跑全部检查，本表取代文档步写的结果；其中 G1–G5 与文档站是门禁脚本落地后补跑的。

| 检查 | 结果 |
|---|---|
| check-links | 来源 228 个文件，失配 0 |
| check-terms | 旧名残留 0 |
| check-plugin-counts | 失配 0（cordis 插件 48） |
| check-scanner-names | 0 unresolved（121 处） |
| mermaid-check（80-process 全量语法校验） | 2 张图 0 invalid |
| openspec schema validate cordex-docs-first | valid |
| G1–G3 `check-change-impact.py --change dev-process` | 三项通过：G1 触及代码路径 5 个（`openspec/schemas/cordex-docs-first/` 等）；G2 级别 L2、评审已确认（2026-10-04，见「## 评审」的说明）；G3 矩阵 6 行、需更新 4 行，回写记录 14 条、路径 21 个，与其他进行中变更无重叠，设计质量门不触发 |
| G1–G3 `check-change-impact.py --change design-language-v3` | G1 通过；G2 失败，评审行为「评审：待确认」；G3 失败，产品、设计、前端、测试、其他五条线表态需更新而「## 回写记录」为空，逐行报在 proposal.md:25–30。与该变更现状一致，符合 tasks 2.2 的预期 |
| G4 `check-req-coverage.py` | 按棘轮通过（退出 0）：需求 164 条（P0 93、P1 44、P2 15、无优先级 12），与 PRD 03、04 中 `##` / `###` 需求标题的独立计数一致；缺口 134 处全在基线内（设计 53、前后端 17、测试 64），新增 0、可收紧 0；PRD 格式错误 0；P2 与无优先级的只报告缺口 22 处 |
| G5 `check-doc-refs.py` | 按棘轮通过（退出 0）：来源 227 个文件、引用约 1.4 万处；失配 188 处全在基线内（错误码 159、REST 路由 29；需求编号、界面、ADR、裁决小节都是 0），新增 0、可收紧 0，读取问题 0 |
| 门禁自测 | `python3 docs/_tools/prdlib.py` 内置自测 45 项全过。场景测试是实现期的一次性验证脚本、未入库：G1–G3 在本地一次性克隆中构造合规与不合规的变更与分支共 150 例，G4 51 例（缺口、豁免、棘轮与拒写），G5 144 例（六类引用的正确与错误写法、棘轮），全部符合预期 |
| `gen-docs-site.py`（生成到临时目录） | 232 页；「研发流程」分区 4 篇（`pages/process/`）；决策面板与首页「裁决进度」含 §4.25（16 / 16）；站内锚点 326 处，改指 0、仍失配 0，指向不存在文件的链接 0 |

### G4 基线抽样核对（tasks 3.2）

从 `req-coverage-baseline.json` 的 134 处缺口按线分层、等距抽 14 处（设计每 10 处取 1、测试每 13 处取 1、前后端每 6 处取 1），另加 3 处由口径细化直接决定的缺口（CO-12、CO-13 的设计线，PS-02 的测试线），共 17 处。核对不经 prdlib：在该线目录的全部 `.md`（设计不含顶层 `playground/`、`mockups/`、`prototype/`）里原样检索编号，逐处判断命中是否算需求引用（80/02 §1.2），再查 PRD 需求块里有没有落点豁免。

| 缺口 | 核对 | 结论 |
|---|---|---|
| CO-02、EM-03、EM-16、OF-20、PS-14、SV-12 × 设计 | 原样检索 0 处，PRD 无落点豁免 | 真 |
| AS-03、ED-08、EM-03、PS-05 × 测试 | 同上 | 真 |
| EM-15、PS-08 × 前后端 | 同上 | 真 |
| ML-01 × 测试 | 命中 1 处：70/13:559「ML-01–03、ML-09」在表头为「能力 id」的列，是 50/18 的能力 id（§1.2 第 5 条） | 真 |
| PS-02 × 测试 | 命中 1 处：70/02:351「证据 PS-02、K6」，PS-02 是证据清单 `docs/00-charter/_evidence/hocuspocus-adoption-2026-09-26.json` 的条目（§1.2 第 4 条） | 真 |
| CO-02 × 前后端 | 原样检索命中 8 处（含 2 处状态头行，G4 本就不计），都是 rulings §4.18 的 CO-02（首次挂载 200 ms 只作分解目标），不是 PRD CO-02（实时同步与收敛）。其中 50/05:704、50/13:82 两处前 15 字内没有 §4.18 字样，G4 原因里附的「须写作 PRD CO-02」提示对这两处不适用 | 真 |
| CO-12 × 设计 | 命中 1 处：20-design/03-screens/12:220「（G-51，CO-12/ADR-0034）」，指 PRD CO-12（协同安全、门禁与资源），但不带 PRD 字样（§1.2 第 2 条） | 真（按规则；补缺口时改写为「PRD CO-12」） |
| CO-13 × 设计 | 命中 2 处：20-design/03-screens/24:7、:111，指 PRD CO-13（协同诊断与遥测），不带 PRD 字样 | 真（同上，改写为「PRD CO-13」） |

结论：17 处都是真缺口，未见脚本误报。12 处原样检索为 0；5 处有命中，但按 §1.2 都不算落点：rulings §4.18 条目、能力 id、证据条目，以及 CO-12、CO-13 设计线不带 PRD 字样的真实需求引用。最后这类在 `docs-coverage-baseline` 补缺口时改写即可，不改规则。

### G5 基线抽样核对（tasks 4.2）

`doc-refs-baseline.json` 的 188 处失配只有两类：错误码 159 处（103 个键）、REST 路由 29 处（21 个键）。按（类别, 文件, 引用）排序后等距抽取，错误码每 13 个键取 1、REST 路由每 5 个键取 1，共 13 个键。核对不经 `check-doc-refs.py`：错误码在 30/10 原样检索，REST 路由在 60/15 检索路径的全部字面段，再对照原文判断。

| 引用 | 位置 | 核对 | 结论 |
|---|---|---|---|
| `format.no_document_type` | 00-charter/charter.md:864；40-modules/00-module-map.md:1204 | 30/10 原样检索 0 处；两处都是错误码用法（「以错误码 … 失败」「打开返回 …」） | 真：未登记 |
| `format.broken_relationship`、`format.pptx.strict_normalized` | 40-modules/04-ooxml-format-and-pptx-codec.md:947、:979 | 30/10 0 处；在 40/04 文件表的错误码映射里 | 真：未登记 |
| `render.element_failed` | 50-frontend/01-overview-and-runtime-map.md:494 | 30/10 0 处；原文 `errors.report('render.element_failed')` | 真：未登记 |
| `command.vetoed` | 50-frontend/04-document-commands-and-undo.md:190 | 30/10 0 处；原文「Result 为 `command.vetoed`」（弱语境，判定 ⑥） | 真：未登记 |
| `storage.key_rejected` | 60-backend/04-modules-documents-storage-media.md:390 | 30/10 0 处；原文「即抛 `storage.key_rejected`」 | 真：未登记 |
| `headless.decode_failed` | 40-modules/09-server-collab-gateway-and-headless-host.md:930 | 30/10:158 写明它「不再使用（改为 `format.pptx.*`）」；本行是「2026-09-25 删 …」的删除说明 | 真：已废弃码；「删」不在历史陈述词表（§3.1） |
| `GET /snapshots/latest` | 30-architecture/adr/0025-update-persistence-and-compaction.md:18 | 60/15 只有 `GET /documents/:id/snapshots/latest`；省略写法须以「…/」开头（§3.3） | 真 |
| `GET /imports/:jobId` | 40-modules/11-preset-assembly-and-app-shell.md:185；50-frontend/02-app-shell-routing-and-session.md:372 | 60/15 §9 已删除端点（替代 `GET /jobs/:id`）；原文分别是「删 …」「不再使用 …」 | 真：已删除端点的删除说明 |
| `GET /internal/render/:token/state` | 40-modules/12-server-jobs-comments-and-ops.md:341；60-backend/06-modules-jobs-import-export-thumbnails.md:620 | 60/15 §9 已删除（BE-04）；原文分别是「删 …」「… 已取消」 | 真：同上 |

结论：13 个键都是真失配，未见脚本误报。7 个是未登记的错误码，处理是在 30/10 登记或改正写法；1 个是 REST 路由的省略写法没有用「…/」。另 5 个（1 个已废弃码、4 个已删除端点）出现在删除说明里，因为「删」「不再使用」「已取消」不在历史陈述词表而被报出。80/02 §3.1 规定词表不增不减，所以在 `docs-coverage-baseline` 中改用词表里的写法（如「作废」「取代」）或删去这些提及。

## 设计质量门

不触发（本变更不改界面；设计语言改版在 `design-language-v3`）

## 评审

评审：已确认 | 确认人：用户 | 日期：2026-10-04

说明：上面的评审行记的是 2026-10-04 的确认。之后实现中按 80/01 §5 回写了门禁口径（偏差记录第 2–4 行），改变了 G3、G4、G5 的判定，须用户重新确认；确认后更新评审行的日期。

## 偏差记录

| 日期 | 发现 | 处理 | 是否重新评审 |
|---|---|---|---|
| 2026-10-04 | 80/02 §3 要求首批引用「全部能解析」，但现有文档已有失配，G5 直接全量失败会阻断一切文档提交 | 80/02 §3 与 80/03 §1 补「G5 同样按基线棘轮执行，直到 docs-coverage-baseline 清零」，与用户已确认的 G4 棘轮口径一致 | 否（不改变门禁含义，只补执行方式） |
| 2026-10-04 | 80/02 §1 只写了编号形式与「编号在各线文档正文中出现」，没有写怎样解析 PRD（定义行、需求块、优先级与目标里程碑、落点豁免、已删除、重复定义），也没有写怎样识别需求引用。按 design.md 初版，三个脚本各写一份解析，实现中多次分叉（块终点、标题行里的优先级、「已删除」的认法、CO 的认法）；G4 为避免误报另加的细化（CO 须带 PRD 字样、证据条目与能力 id 不算）只写在脚本里 | 回写 80/02 §1.1（PRD 解析 9 条与格式错误，格式错误由 G4 报出并判失败）、§1.2（各线的扫描范围；引用识别 6 条：CO 须带 PRD 字样且 G4、G5 同用，rulings §4.18 条目、证据条目、能力 id 不算，G4 另计围栏代码块，G3 的用法）、§1.3（缺口以「需求 × 线」计，「前后端」豁免，已删除的不查，基线里已消失的缺口也判失败，解析出错时拒写基线）。规则改为只在共享模块 `prdlib.py` 实现一份（design.md 决策 1、2），`docs/_tools/README.md` 同步 | 是：改变 G4 判定。不带 PRD 字样的 CO、证据条目、能力 id 不再算落点（CO-12、CO-13 的设计线因此成为缺口，见 G4 抽样），PRD 格式错误判失败；基线 134 处缺口按此口径生成。已重新确认（用户，2026-10-05，按推荐） |
| 2026-10-04 | 80/02 §3 只用一张表列出六类引用。错误码一行写「反引号中形如 `server.plugins.conflict` 的点分小写码」，只按命名空间过滤时，现有文档会多报约 200 处不是错误码的同形写法（`document.title`、`store.transact` 一类）；历史陈述行的词表（原 / 旧 / 作废 / 取代 / → 2026-）与它声称沿用的 check-terms.py 不一致；REST 路由的归一与匹配、界面与裁决小节的连写、归属文档自己的登记都没有规定 | §3 分为 3.1–3.5：扫描范围与豁免（历史陈述词表改为与 check-terms.py 逐字相同）；需求编号等四类的判定（不在 PRD 的裸编号再查 50/18 能力 id）；REST 路由的归一、逐段比对与已删除、未排期端点；错误码的登记、候选 token、强弱语境、判定 ①–⑥ 与取舍；棘轮细则。实现在 `check-doc-refs.py`，`docs/_tools/README.md` 同步 | 是：改变 G5 判定。另有归属的同形键（判定 ③）只在强语境里核对，其余不像码名的写法（判定 ⑥：server 之外两段且末段是普通单词、三段且末段无下划线、四段及以上）只在弱语境里核对，语境之外的未登记写法不报，这条取舍须用户裁定（80/02 §3.4）；历史陈述词表也变了；基线 188 处失配按此口径生成。已重新确认（用户，2026-10-05，按推荐） |
| 2026-10-05 | 80/02 §4 与 80/03 §2.2 只规定了矩阵与回写记录的格式，没有规定写在模板节之外怎么判。不规定时，节外或另起二级节的回写记录、矩阵节里的第二张表会被忽略：路径不核对，也不参与与其他变更的重叠检查，较晚的变更不写依赖也能通过 | 回写 80/02 §4：矩阵只认 `## 文档影响矩阵` 节内、恰好一张表，节外的判格式错误、不核对；回写记录只认 `## 回写记录` 节内（分轮追加的写进原节），节外的判格式错误，其中的记录照样核对并计入重叠。design.md 决策 3 同步 | 是：G3 新增失败条件（节外的矩阵与回写记录、矩阵节内多于一张表）。已重新确认（用户，2026-10-05，按推荐） |
