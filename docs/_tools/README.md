> 状态：工具 v0.3 | 负责：总编排 | 更新：2026-09-23；2026-09-25（评审站 gen-review-site.py 由文档站 gen-docs-site.py 取代；新增 capture-screens.cjs）；2026-09-25（矛盾收口，rulings §4.18）：新增「绘图规范」一节（GV-04），`mermaid-check.cjs` 增加引号、「< 后接字母」、超限三项检查与既有超限图豁免表（GV-04/GV-05/GV-23），新增 `check-scanner-names.py`（GV-15）；2026-09-25（§4.19）：新增 `ddl-check.sh`（60-backend/08 §11 的 ddl-check 实现）；2026-09-25（设计线拆分：文档站新增前端 / 后端 / 测试三个分区，SQL 代码块标迁移号与行数，决策面板纳入 §4.19） | 依赖：40-modules/_template.md、charter §9.2、60-backend/08 §11

# docs/_tools —— 文档线工具

在文档评审过程中沉淀下来的脚本，随仓库走，换机器后可直接用。

| 脚本 | 用途 | 运行方式 | 依赖 |
|---|---|---|---|
| `validate-module.py` | 校验 `40-modules` 模块文档结构：§0…§13 齐全、代码围栏成对、§4 目录树文件数与 §5 逐文件表行数对应、DDD 五目录到位；顺带把表格里的「同上」展开为显式值 | `python3 docs/_tools/validate-module.py docs/40-modules/0*.md docs/40-modules/1*.md` | 仅标准库 |
| `mermaid-check.cjs` | 逐张校验 Markdown 里的 `` ```mermaid `` 图，报出文件与行号：PARSE（无头 Chrome 跑 `mermaid.parse`）、QUOTE（引号口径）、LT（标签内「< 后接字母」）、SIZE（单图 ≤40 行 ≤25 节点，既有超限图走脚本内豁免表）四类，全部报错、有错退出码 1；规则见下文「绘图规范」 | `node docs/_tools/mermaid-check.cjs docs/40-modules/*.md`；只跑后三类（不需要浏览器）加 `--lint-only`；playwright 不在全局时加环境变量 `PLAYWRIGHT_MODULE=<.../node_modules/playwright>` | `playwright` + Chrome；从 CDN 取 mermaid 11.16.1（与文档站同版本） |
| `check-scanner-names.py` | 文档里写成「扫描器 + 反引号名字」的名字，必须能在 `30-architecture/09-type-discipline/06-scanners.md` 或 `08-policy-enforcement-matrix.md` §11 命名对照表查到（`x` 与 `scan-x` 视为同名；带「→ 2026-」回写标注的历史行不查），查不到即报文件与行号、退出码 1；只读，不改变 06 的扫描器清单与「14 个」上限（rulings §4.18 GV-15） | `python3 docs/_tools/check-scanner-names.py` | 仅标准库 |
| `ddl-check.sh` | 60-backend 的 DDL 可执行性检查（需求见 `60-backend/08` §11）：提取 `docs/60-backend/*.md` 的 ```` ```sql ```` 围栏，检查首行标记、迁移编号唯一且在所属号段内；在 PostgreSQL 18 容器的空库里按编号执行全部 `-- migrate:` 围栏（0001 以超级用户、其余 `SET ROLE cordex_migrator`，每个迁移一个事务、`ON_ERROR_STOP=1`，写台账，再重跑一次 0001）；随后做结构核对（表集合 = 08 §1、禁建表不出现、带 `doc_id` 的表 RLS 与 policy、policy 命名与不含 `current_setting`、SECURITY DEFINER 集合 = 08 §4.3、外键前导索引、无 DEFAULT 分区与触发器，期望集合都从 08 原文解析）；最后逐段执行 `-- example`（带 `$N` 的 DML 用 `PREPARE` 分析，其余在回滚事务中真实执行，08 §13 的 RLS 负向断言因此每次都跑）。失败报「文档:行号 + 迁移编号 + PG 错误」、退出码 1；成功导出 `schema.sql` | `bash docs/_tools/ddl-check.sh [--out <目录>] [--keep]`；复用已有容器加 `CORDEX_DDL_CONTAINER=cordex-ddl-pg`，换镜像加 `CORDEX_DDL_IMAGE=postgres:18-alpine`，换库名加 `CORDEX_DDL_DB=…`（每次先 DROP 再建）；`--out` 目录里是按编号拆好的 `NNNN-<name>.sql`、`manifest.tsv`、`_checks.sql`、`_examples.sql` 与日志 | Docker + `postgres:18` 镜像；`python3`（仅标准库）；不改仓库文件 |
| `gen-docs-site.py` | 把 `docs/` 全部 Markdown 生成为多页「Cordex 文档站」：总览首页、章程与裁决（含决策面板）、产品、设计（界面画廊 + 每个界面的多状态截图）、架构、前端、后端、测试（三条设计线，rulings §4.19）、ADR、模块（含图集 18/19） | `python3 docs/_tools/gen-docs-site.py <输出目录> [--screens <截图目录>] [--inline-screens]` | `pip install markdown`（建议装在 venv 里）；前端资源在 `docs-site/` |
| `capture-screens.cjs` | 实拍设计 playground 的各界面状态（亮/暗 × 原图/缩略图），输出截图与 `manifest.json`，供文档站的界面画廊与界面页使用 | `node docs/_tools/capture-screens.cjs <playground dist 的本地 URL> <输出目录> [--only=08,13]` | `playwright` + Chrome；先在 `docs/20-design/playground/` 执行 `npm run build` |

换机器请看 [`MIGRATION.md`](MIGRATION.md)：仓库、项目记忆、Node 依赖、GitHub 凭据四件事的完整步骤。

## 绘图规范

章程 §9.2 第 4 条：图用 Mermaid 11，且须通过 `mermaid-check.cjs`；界面 ASCII 线框（`20-design/03-screens/`）、目录树与代码结构仍用文本代码块。具体画法以下面五条为准（rulings §4.18 GV-04/GV-05/GV-23），前三条与第五条由 `mermaid-check.cjs` 机械检查，全部报错、不设告警级别（与 `30-architecture/09-type-discipline/07-hooks-and-ci.md`「不存在 warn 级别」一致）。

1. **引号口径**：只用 `flowchart`、`sequenceDiagram`、`stateDiagram-v2`、`classDiagram`、`erDiagram` 五类。`flowchart` 的节点文字、子图标题、连线标签一律加双引号（`a["文字"]`、`subgraph g["标题"]`、`-->|"标签"|`）；`stateDiagram` 的状态文字写成 `state "文字" as id`。反过来，`sequenceDiagram` 的参与方别名、消息、`Note` 与 `alt`/`opt`/`loop` 等分支标签，`stateDiagram` 的转移标签与状态描述，`classDiagram` 的成员，一律**不加**双引号（加了会原样显示）。消息里的单引号是协议字面量原文（如 `tier:'db'`），不受此限。
2. **转义**：只转义会破坏解析、或会被 HTML 净化吞掉的字符，用 Mermaid 实体写法。标签里「`<` 后接字母」必须写成 `#60;`（如 `role#60;editor`，否则渲染后 `<editor)` 整段消失）；`<br>` 换行与 `<<choice>>` 这类注解除外。`stateDiagram` 转移标签里的函数调用圆括号（如 `join()`、`auth.ok(role, docState)`）在 mermaid 11.16.1 下实测正常，允许保留；圆括号、花括号只在破坏解析时才写成 `#40;`/`#41;`、`#123;`/`#125;`。
3. **规模**：单图 ≤40 个非空行、≤25 个节点（`flowchart` 不计子图；状态图计状态；时序图计参与方），超了就拆图。既有 3 张超限图（`40-modules/00-module-map.md` 水平层网格图、`15-server-architecture-review.md` §4.2/§4.3 两张模块图）保留不拆（原登记的 `02-kernel-protocol-and-document-core.md` 命令执行管线图已于 2026-09-25 拆为两张，移出豁免），登记在 `mermaid-check.cjs` 顶部的 `EXEMPT` 表（文件 + 登记时起始行 + 首行锚点）；新增豁免须经总编排裁决。
4. **图名、怎么读、依据**：每张图的上一行是加粗图名（如 `**图 5-1 名称**`；带编号时同一文档内按出现顺序编号，见 GV-08 先例）；图后紧跟一段「怎么读：」，说明箭头、虚线、带叉边或分组的含义与阅读顺序；图的内容来自章程条目、裁决或其他文档时，再跟一段「依据：」写明出处。文档站把加粗图名作为图卡标题、「怎么读」收为图注。
5. **必须过校验**：改图后在仓库根目录对改动文件运行 `node docs/_tools/mermaid-check.cjs <文件...>`（全量时传 `docs/` 下全部 `.md`），要求 `0 invalid`。

## 文档站（`gen-docs-site.py`）

生成一次的完整步骤：

```bash
# 1. 截图（可选；不给 --screens 时画廊与界面页显示「暂无截图」占位）
(cd docs/20-design/playground && npm run build)
python3 -m http.server 8765 --directory docs/20-design/playground/dist &   # 任意静态服务器
node docs/_tools/capture-screens.cjs http://127.0.0.1:8765/ /tmp/cordex-screens
# 2. 生成站点（会先清空输出目录）
~/.venv/cordex/bin/python docs/_tools/gen-docs-site.py /tmp/cordex-site --screens /tmp/cordex-screens
```

产物结构：`index.html`（首页）+ `pages/<分区>/<文件名>.html` + 共用的 `site.css`、`site.js`、`search-index.json` + `screens/`（截图）。发布目标限制文件条数时（claude.ai artifact 每个版本至多 255 个文件），加 `--inline-screens` 把截图以 data URI 内嵌进页面、不输出 `screens/`，文件数降到约 210 个（2026-09-25 三条设计线加入后为 209 个）。

- **覆盖范围**：`docs/` 下全部 `.md`（跳过 `node_modules`、`dist`、`playground` 源码、`_evidence`、`mockups`、`prototype`）。源目录默认取本脚本上一级，可用环境变量 `CORDEX_DOCS_ROOT` 覆盖。
- **文档头**：`> 状态：… | 负责：… | 更新：… | 依赖：…` 解析为元信息条（状态胶囊、负责人、最新更新日期、行数与图数），完整变更记录折叠在「元信息与变更记录」里。
- **图**：每个 `` ```mermaid `` 围栏输出为 `<pre class="cx-mermaid">`，由页面自带的 mermaid 11.16.1 按站点 token 渲染、切换主题时重渲染；图名取上一行加粗标题，「怎么读」段落收为图注；每张图可「放大」到全屏浮层缩放平移；渲染失败时显示错误与源码，不会静默。
- **链接**：md 相对链接改写为站内页面；指向站外仓库文件的改为 GitHub 链接（分支 `ppt在线编辑器初始化`）。源文档里写错的锚点按近似标题改指，生成结束时报告仍失配的数量。
- **代码块**：每块带语言标签与「复制」按钮，由 highlight.js 高亮；SQL 围栏按 60-backend/08 §11 的首行约定在标题栏标出「迁移 NNNN_name」（可执行，ddl-check 顺序执行）或「示例 · 只解析」，并显示行数。
- **设计线分区**：前端、后端、测试三个分区排在「架构」之后、「ADR」之前，顶栏页签、首页分区卡片（标「设计线 · 唯一事实源」）、左侧导航与搜索都包含它们。
- **旧评审站的功能**：决策面板（章程 §10 与 rulings §4.12/§4.13/§4.15/§4.16/§4.17/§4.18/§4.19 的裁决表，原文照录 + 状态列）、超过 20 行的表格过滤框、每篇文档的行数统计，都在文档站里保留。
- **设计分区**：首页是界面画廊，读截图目录的 `manifest.json` 为 29 个界面出卡片（可按分组筛选，亮/暗主题显示对应截图）；每个界面页顶部是多状态截图切换，注明 playground 路由与状态名；设计系统页由 `playground/src/index.css` 直接渲染亮/暗色板。

## 说明

- 文档站发布为 claude.ai artifact；链接是账号级的，换机器登录同一账号即可访问与更新。
- 这些脚本都只读仓库内容，`validate-module.py` 是唯一会写回的（只展开「同上」简写）。
- `ddl-check.sh` 会在目标容器里 `DROP DATABASE IF EXISTS <库名> WITH (FORCE)`：复用容器时不要把 `CORDEX_DDL_DB` 指向有用的库。改了 60-backend 的任何 SQL 围栏都要重跑它，要求末行输出「通过」。
