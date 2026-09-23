> 状态：工具 v0.1 | 负责：总编排 | 更新：2026-09-23 | 依赖：40-modules/_template.md

# docs/_tools —— 文档线工具

三个在文档评审过程中沉淀下来的脚本，随仓库走，换机器后可直接用。

| 脚本 | 用途 | 运行方式 | 依赖 |
|---|---|---|---|
| `validate-module.py` | 校验 `40-modules` 模块文档结构：§0…§13 齐全、代码围栏成对、§4 目录树文件数与 §5 逐文件表行数对应、DDD 五目录到位；顺带把表格里的「同上」展开为显式值 | `python3 docs/_tools/validate-module.py docs/40-modules/0*.md docs/40-modules/1*.md` | 仅标准库 |
| `mermaid-check.cjs` | 用无头 Chrome 跑 `mermaid.parse` 逐张校验 Markdown 里的 ```mermaid 图，报出文件与行号 | `node docs/_tools/mermaid-check.cjs docs/40-modules/*.md` | 全局 `playwright` + Chrome；从 CDN 取 mermaid 11 |
| `gen-review-site.py` | 把 `40-modules` 的 Markdown 生成多页 HTML 评审站（索引 + 决策面板 + 每份文档一页，带章节目录、表格过滤、Mermaid 原生渲染） | `python3 docs/_tools/gen-review-site.py <输出目录> [--preview]` | `pip install markdown`（建议装在 venv 里） | 

换机器请看 [`MIGRATION.md`](MIGRATION.md)：仓库、项目记忆、Node 依赖、GitHub 凭据四件事的完整步骤。

## 说明

- `gen-review-site.py` 的源目录默认取本脚本同级的 `../40-modules`，可用环境变量 `OCE_DOCS_SRC` 覆盖；`--preview` 会给页面注入 CDN 版 mermaid 以便本地预览（发布用的产物不注入，由宿主原生渲染）。
- 评审站发布为 claude.ai artifact；链接是账号级的，换机器登录同一账号即可访问与更新。
- 三个脚本都只读仓库内容，`validate-module.py` 是唯一会写回的（只展开「同上」简写）。
