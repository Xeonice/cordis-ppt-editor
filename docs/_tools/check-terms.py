#!/usr/bin/env python3
"""check-terms：术语表登记的旧名在正文中残留 0 处（PRD 05 M0 验收 2，rulings §4.20 TX-02）。

只用标准库、只读。读同目录的 terms.json，逐行扫描 docs/ 下全部 .md（含围栏代码块：
示例代码里的旧名同样算残留），报出旧名残留，有残留退出码 1，否则 0。

豁免规则：
  - 跳过 00-charter/rulings-*（裁决原文）、_evidence/（证据快照）、30-architecture/adr/（ADR 原文与修订记录），
    以及文档站同样跳过的 node_modules、dist、playground、mockups、prototype；
  - 跳过「> 状态：」头行（变更记录）；
  - 同一行同时出现该处的正名（如 FakeClock 行里有 FixedClock、data-oce-x 行里有 data-cordex-x），
    或含更名标注「原名 / 原称 / 原： / 弃 / 作废 / 取代 / 替换 / → 2026- / 旧名」的行放行；
  - 每条的 allowIn 文件整篇放行（更名对照表、废止表与负向断言所在的文件）。

匹配：大小写敏感；旧名以字母数字开头（或结尾）时要求其前（或后）不是字母、数字、下划线，
所以 FakeClock 不会命中 FakeClockX，oce- 不会命中 voice-；旧名里的 * 表示任意标识符前缀（如 *.test-d.ts）。

用法：
  python3 docs/_tools/check-terms.py            # 全量
  python3 docs/_tools/check-terms.py <文件...>  # 只查这些文件（豁免规则同样适用）
  选项：--summary 只打印汇总；--list 列出术语表
新的更名裁决回写时，须把旧名 → 正名登记进 terms.json（rulings 回写流程，见 docs/_tools/README.md）。
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.normpath(os.environ.get("CORDEX_DOCS_ROOT") or os.path.join(HERE, ".."))
REPO = os.path.dirname(DOCS)
TERMS = os.path.join(HERE, "terms.json")
SKIP_DIRS = {"node_modules", "dist", "playground", "_evidence", "mockups", "prototype", ".git"}
SKIP_PREFIXES = ("00-charter/rulings-", "_evidence/", "30-architecture/adr/")
MARKERS = ("原名", "原称", "原：", "弃", "作废", "取代", "替换", "→ 2026-", "旧名")
TOKEN_CHARS = r"[A-Za-z0-9_.@/*#\-]"


def load_terms():
    with open(TERMS, encoding="utf-8") as fh:
        data = json.load(fh)
    rules = []
    for t in data["terms"]:
        olds = t["deprecated"] if isinstance(t["deprecated"], list) else [t["deprecated"]]
        canon = t["canonical"]
        for old in olds:
            core = old.lstrip("*")
            lead = r"(?<![A-Za-z0-9_])" if re.match(r"\w", core) and not old.startswith("*") else ""
            trail = r"(?![A-Za-z0-9_])" if re.search(r"\w$", core) else ""
            rules.append({
                "old": old, "core": core, "canonical": canon, "canon_core": canon.lstrip("*"),
                "source": t.get("source", ""), "allowIn": set(t.get("allowIn", [])),
                "re": re.compile(lead + re.escape(core) + trail),
            })
    return rules


def iter_md_files():
    for root, dirs, files in os.walk(DOCS):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not d.startswith("."))
        for f in sorted(files):
            if f.endswith(".md"):
                yield os.path.join(root, f)


def token_around(line, start, end):
    """把命中扩展成它所在的标识符片段（如 data-oce-root、augment.test-d.ts）。"""
    i, j = start, end
    while i > 0 and re.match(TOKEN_CHARS, line[i - 1]):
        i -= 1
    while j < len(line) and re.match(TOKEN_CHARS, line[j]):
        j += 1
    return line[i:j]


def canonical_present(line, rule, token):
    """同一行是否出现了该处的正名：整条正名（去掉 *）或把这个片段里的旧名换成正名后的写法。"""
    if rule["canon_core"] and rule["canonical"] != rule["canon_core"] and rule["canonical"] in line:
        return True
    replaced = token.replace(rule["core"], rule["canon_core"])
    if replaced != token and replaced in line:
        return True
    # 旧名本身是完整标识符（FakeClock、render/error）时，正名出现在行内即放行
    if rule["core"][:1].isalnum() and rule["core"][-1:].isalnum() and rule["canon_core"] in line:
        return True
    return False


def scan(path, rules):
    relp = os.path.relpath(path, DOCS).replace(os.sep, "/")
    if relp.startswith(SKIP_PREFIXES):
        return []
    active = [r for r in rules if relp not in r["allowIn"]]
    if not active:
        return []
    hits = []
    with open(path, encoding="utf-8") as fh:
        for ln, line in enumerate(fh, 1):
            line = line.rstrip("\n")
            if line.lstrip().startswith("> 状态："):
                continue
            if any(mk in line for mk in MARKERS):
                continue
            for r in active:
                for m in r["re"].finditer(line):
                    tok = token_around(line, m.start(), m.end())
                    if canonical_present(line, r, tok):
                        continue
                    hits.append((relp, ln, tok, r))
    return hits


def main(argv):
    rules = load_terms()
    if "--list" in argv:
        for r in rules:
            print("%s → %s（%s）" % (r["old"], r["canonical"], r["source"]))
        return 0
    paths = [a for a in argv if not a.startswith("--")]
    files = [os.path.abspath(p) for p in paths] if paths else list(iter_md_files())
    hits = []
    for f in files:
        hits.extend(scan(f, rules))
    if "--summary" not in argv:
        for relp, ln, tok, r in hits:
            print("docs/%s:%d: %s → %s（%s）" % (relp, ln, tok, tok.replace(r["core"], r["canon_core"]), r["source"]))
    by_term = {}
    for _, _, _, r in hits:
        by_term[r["old"]] = by_term.get(r["old"], 0) + 1
    detail = "、".join("%s %d" % kv for kv in sorted(by_term.items())) or "无"
    print("check-terms：扫描 %d 个文件、术语 %d 条；旧名残留 %d 处（%s）" % (len(files), len(rules), len(hits), detail),
          file=sys.stderr)
    return 1 if hits else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
