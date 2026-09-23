#!/usr/bin/env python3
"""校验 40-modules 模块设计文档的结构完整性。

用法：python3 docs/_tools/validate-module.py docs/40-modules/0*.md docs/40-modules/1*.md

检查项：
  1. §0…§13 十四个章节齐全（模板 _template.md 规定）
  2. 代码围栏成对闭合
  3. §4 目录树的文件数与 §5 逐文件职责表的行数是否对应
  4. DDD 五目录（domain/application/infrastructure/interface|ui/testing）的出现情况
  5. 表格里的「同上」简写（跨文档引用时会丢失语义），顺带展开为上一行的显式值
"""
import re, sys

def split_row(l):
    return re.split(r"(?<!\\)\|", l)

def main(paths):
    for p in paths:
        lines = open(p, encoding="utf-8").read().split("\n")
        prev = None
        changed = 0
        for i, l in enumerate(lines):
            if l.startswith("|") and not re.match(r"^\|\s*-{2,}", l):
                cells = split_row(l)
                if prev and len(prev) == len(cells):
                    for j, c in enumerate(cells):
                        cs, pv = c.strip(), prev[j].strip()
                        if cs == "同上":
                            cells[j] = f" {pv} "; changed += 1
                        elif cs.startswith("同上 + "):
                            cells[j] = f" {pv} + {cs[5:]} "; changed += 1
                        elif re.match(r"^同上 / (.+)$", cs):
                            cells[j] = f" {pv.split(' / ')[0]} / {cs[5:]} "; changed += 1
                        elif re.match(r"^同上（.+）", cs):
                            m = re.match(r"^同上(（.+）)(.*)$", cs)
                            base = re.sub(r"（.+?）", "", pv).strip()
                            cells[j] = f" {base}{m.group(1)}{m.group(2)} "; changed += 1
                    lines[i] = "|".join(cells)
                prev = split_row(lines[i])
            else:
                prev = None
        if changed:
            open(p, "w", encoding="utf-8").write("\n".join(lines))
        s = "\n".join(lines)
        nums = [int(m.group(1)) for l in lines for m in [re.match(r"^## (\d+)\.", l)] if m]
        sec4 = s[s.find("## 4."):s.find("## 5.")]
        sec5 = s[s.find("## 5."):s.find("## 6.")]
        tree = len([l for l in sec4.split("\n") if re.search(r"[├└]── [^\s/]+\.[a-z]+", l)])
        rows = len([l for l in sec5.split("\n")
                    if l.startswith("|") and "`" in l
                    and not l.startswith("|---") and not re.match(r"^\|\s*文件", l)])
        ddd = sum(1 for d in ["domain/", "application/", "infrastructure/", "interface/", "ui/", "testing/"] if d in sec4)
        ok = "齐" if nums == list(range(14)) else str(nums)
        fence = "偶" if s.count("```") % 2 == 0 else "奇!"
        print(f"{p}: {len(lines)} 行 | 章节{ok} | 围栏{fence} | §4 文件 {tree} | §5 行 {rows} | DDD 目录种类 {ddd} | 同上展开 {changed} | 余 {s.count('同上')}")

if __name__ == "__main__":
    main(sys.argv[1:])
