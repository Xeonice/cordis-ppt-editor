# Cordex 项目约定

给每个在本仓库工作的 agent 会话。完整流程见 `docs/80-process/README.md`，本文只列必须遵守的部分。

## 事实源

- `docs/` 是唯一事实源：行为、界面、接口、数据、文件结构都以它为准。先读 `docs/README.md` 的阅读顺序，再读与任务相关的文档；不要凭印象写。
- 每类事实只有一个归属文档（`docs/80-process/02` §2），其他文档只引用编号或链接。
- OpenSpec 只作变更容器（`openspec/changes/<id>/`，工作流 `cordex-docs-first`），不使用 `openspec/specs/`。

## 变更流程

- 改代码或配置的工作必须挂在一个 OpenSpec 变更上；只改文档且不改含义的（L0）可以不开。
- 级别：L0 文档修正 / L1 不改行为 / L2 改行为（`docs/80-process/01` §1），拿不准按 L2。
- L2 文档先行：提案 → 按影响矩阵回写五线文档 → 用户确认（docs-sync 评审行）→ design / tasks → 写码。评审行只能由用户确认后填写，不得代填。
- 界面改动先做 playground 样张，与标杆产品同尺寸对照截图、过检查清单 Q1–Q10，用户拍板后才回写设计文档。
- 实现中发现文档不对：停下，先改文档并在 docs-sync 记偏差；影响行为、界面、接口或数据的回到用户确认。
- 需要用户决定的问题逐题提问；给推荐项与备选。

## 代码与文档一致

- 代码里的对外标识符（错误码、REST 路由、协同消息、事件名、配置键、迁移文件、插件 id、贡献点 id、包名）必须先在归属文档登记。
- 每个新增或移动的源文件（含测试文件）先登记到 40-modules 对应模块的 §4 目录树与 §5 文件表，再写代码。
- 测试带 `@req PRD:<编号>`（`docs/70-testing/13`）。

## 检查

改文档后在仓库根运行：

```bash
python3 docs/_tools/check-links.py
python3 docs/_tools/check-terms.py
python3 docs/_tools/check-plugin-counts.py
python3 docs/_tools/check-scanner-names.py
python3 docs/_tools/check-req-coverage.py                      # G4 需求覆盖（按基线棘轮）
python3 docs/_tools/check-doc-refs.py                          # G5 文档引用反查（按基线棘轮）
node docs/_tools/mermaid-check.cjs --lint-only <改动的 md>   # 改了图
python3 docs/_tools/validate-module.py <改动的 40-modules 文档>  # 改了 40-modules
bash docs/_tools/ddl-check.sh                                  # 改了 60-backend 的 SQL，需要 Docker
```

进行中的变更另跑 `python3 docs/_tools/check-change-impact.py --change <id>`（G1–G3，在该变更的分支上）。

G6（代码标识符与源文件登记）的脚本随 `m0-governance-gates` 落地（`docs/80-process/03`）。

## 提交与工具

- 提交、推送、开 PR、合并都只在用户要求时做；提交前确认没有 `debugger`。
- 分支：main 为主干，每个变更一个分支 `change/<id>`，PR 正文首行 `Change: <id>`。
- OpenSpec CLI 未全局安装时用 `npx -y @fission-ai/openspec@1.14.0` 代替 `openspec`（设置 `OPENSPEC_TELEMETRY=0`）。
- 回复用户用中文。
