> 状态：操作手册 v0.1 | 负责：总编排 | 更新：2026-09-23

# 换机器：把这个项目搬到另一台开发机

仓库本身 `git clone` 即可，真正容易漏的是**仓库外**的三样东西：项目记忆、Node 依赖、GitHub 凭据。

## 0. 目标机前置

| 需要 | 检查 | 缺了怎么办 |
|---|---|---|
| git | `git --version` | 系统自带或 `brew install git` |
| Node 20+ | `node --version` | `brew install node` |
| Python 3 | `python3 --version` | 系统自带；评审站生成器另需 `markdown` 包 |
| gh（可选） | `gh --version` | `brew install gh`，用于 `gh auth login` 配 GitHub 凭据 |

macOS 上经 SSH 执行命令时 Homebrew 不在 PATH 里，脚本开头加 `export PATH="/opt/homebrew/bin:$PATH"`。

## 1. 仓库

**有 GitHub 凭据时**（推荐，之后能直接 push）：

```bash
gh auth login                       # 或配 SSH key
mkdir -p ~/orca/projects && cd ~/orca/projects
git clone git@github.com:Xeonice/cordis-ppt-editor.git
cd cordis-ppt-editor && git checkout ppt在线编辑器初始化
```

**没有凭据时**（从旧机器直接搬，不碰 GitHub 账号设置）：

```bash
# 旧机器
git bundle create /tmp/oce.bundle --all
scp /tmp/oce.bundle <user>@<host>:/tmp/

# 新机器
mkdir -p ~/orca/projects && cd ~/orca/projects
git clone /tmp/oce.bundle cordis-ppt-editor
cd cordis-ppt-editor
git remote set-url origin git@github.com:Xeonice/cordis-ppt-editor.git
git checkout ppt在线编辑器初始化
```

bundle 含完整历史（约 2 MB），clone 后 remote 改回 GitHub，等配好凭据就能 push。

## 2. 项目记忆（最容易漏）

Claude Code 的项目记忆按**主仓绝对路径**编码目录名，换机器后路径变了，目录名也要跟着改，否则新会话读不到之前的决策上下文。

```bash
# 旧机器：路径 /Users/A/orca/projects/cordis-ppt-editor
#   → ~/.claude/projects/-Users-A-orca-projects-cordis-ppt-editor/memory/
# 新机器：路径 /Users/B/orca/projects/cordis-ppt-editor
#   → ~/.claude/projects/-Users-B-orca-projects-cordis-ppt-editor/memory/

NEW="-Users-B-orca-projects-cordis-ppt-editor"
ssh <user>@<host> "mkdir -p ~/.claude/projects/$NEW/memory"
scp ~/.claude/projects/-Users-A-orca-projects-cordis-ppt-editor/memory/*.md \
    <user>@<host>:"~/.claude/projects/$NEW/memory/"
```

规则：绝对路径去掉开头的 `/`，其余 `/` 换成 `-`，前面再补一个 `-`。

## 3. Node 依赖

```bash
cd docs/20-design/playground && npm install    # node_modules 约 221 MB，不入库
npm run build                                   # 产物 dist/ 也不入库
npm install -g playwright && npx playwright install chrome   # 供文档工具与截图校验
```

## 4. 文档工具（`docs/_tools/`）

```bash
python3 -m venv ~/.venv/oce && ~/.venv/oce/bin/pip install markdown
python3 docs/_tools/validate-module.py docs/40-modules/0*.md docs/40-modules/1*.md
node docs/_tools/mermaid-check.cjs docs/40-modules/*.md
~/.venv/oce/bin/python docs/_tools/gen-review-site.py /tmp/review-site
```

## 5. 不用迁的

- **claude.ai artifact**（评审站、设计 playground）是账号级的，新机器登录同一账号即可访问与更新。
- **git worktree 布局**（主仓 `~/orca/projects/`、工作树 `~/orca/workspaces/`）不必复制，新机器直接 clone 单个仓库即可。

## 6. 落地检查

```bash
git log --oneline -1                          # 应为最新提交
ls docs/40-modules/*.md | wc -l               # 应为 20
ls ~/.claude/projects/<新目录名>/memory/*.md  # 应为 5 个
node --version && npm --version
```
