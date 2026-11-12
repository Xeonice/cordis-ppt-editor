#!/usr/bin/env python3
"""检查文档里写成「扫描器 + 反引号名字」的名字都能在类型治理线的登记处查到（rulings §4.18 GV-15）。

用法：python3 docs/_tools/check-scanner-names.py [docs 根目录，默认为本脚本的上一级目录]

登记处（名字以反引号、或以 06 的章节标题形式出现在其中之一即算登记）：
  - 30-architecture/09-type-discipline/06-scanners.md 全文
  - 30-architecture/09-type-discipline/08-policy-enforcement-matrix.md 的 §11 命名对照表
匹配口径：去掉路径前缀与 .ts 后缀；`x` 与 `scan-x` 视为同名（08 §11：两者只差 scan- 前缀的书写风格）。
被检查的写法：扫描器 `a`；扫描器 `a`、`b`（顿号、逗号、斜杠、与/和/及/或 连接的列表）。
「`a`（扫描器）」这类括注多指被扫描的对象（如被禁的 import），不当作扫描器名检查。
不检查：_evidence/、playground/、mockups/、prototype/、node_modules/、dist/ 下的文件；
       行内带「→ 2026-」回写标注的行（历史评审稿 14、15 只加标注、不改原文）。
只读，不改文件；有查不到的名字时退出码为 1。本检查不改变 06 的扫描器清单与「14 个」上限。
"""
import os
import re
import sys

SKIP_DIRS = ("_evidence", "playground", "mockups", "prototype", "node_modules", "dist")
SCANNERS = "30-architecture/09-type-discipline/06-scanners.md"
MATRIX = "30-architecture/09-type-discipline/08-policy-enforcement-matrix.md"
MENTION = re.compile(r"扫描器\s*((?:`[^`\n]+`\s*(?:[、，,/／]|与|和|及|或)?\s*)+)")
HISTORY_MARK = re.compile(r"→\s*20\d\d-")


def norm(name):
    name = name.strip().split()[0] if name.strip() else ""
    name = name.rsplit("/", 1)[-1]
    if name.endswith(".ts"):
        name = name[:-3]
    return name[5:] if name.startswith("scan-") else name


def registry(root):
    names = set()
    text = open(os.path.join(root, SCANNERS), encoding="utf-8").read()
    names.update(norm(m) for m in re.findall(r"`([^`\n]+)`", text))
    names.update(norm(m) for m in re.findall(r"^##\s+\d+\.\s+(scan-[\w-]+)", text, re.M))
    text = open(os.path.join(root, MATRIX), encoding="utf-8").read()
    start = text.find("\n## 11.")
    end = text.find("\n## ", start + 1)
    if start < 0:
        sys.exit(f"找不到 {MATRIX} 的 §11 命名对照表")
    names.update(norm(m) for m in re.findall(r"`([^`\n]+)`", text[start:end if end > 0 else None]))
    names.discard("")
    return names


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    known = registry(root)
    checked, bad = 0, []
    for dp, dn, fn in os.walk(root):
        dn[:] = [d for d in dn if d not in SKIP_DIRS]
        for f in sorted(fn):
            if not f.endswith(".md"):
                continue
            p = os.path.join(dp, f)
            for i, line in enumerate(open(p, encoding="utf-8").read().split("\n"), 1):
                if HISTORY_MARK.search(line):
                    continue
                found = [n for m in MENTION.finditer(line) for n in re.findall(r"`([^`\n]+)`", m.group(1))]
                for name in found:
                    checked += 1
                    if norm(name) not in known:
                        bad.append((os.path.relpath(p, root), i, name))
    for p, i, name in bad:
        print(f"✗ {p}:{i} 扫描器 `{name}` 未在 06-scanners 或 08 §11 命名对照表登记")
    print(f"checked {checked} scanner mentions, {len(bad)} unresolved")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
