#!/usr/bin/env python3
"""从 playground/dist 生成 artifact 发布入口（去壳 index.html）与 assets 映射 files.json。
用法：python3 gen-publish.py <dist_dir> <out_dir>
"""
import json, os, re, sys

dist, out = sys.argv[1], sys.argv[2]
title = sys.argv[3] if len(sys.argv) > 3 else "Cordex 设计 Playground"
os.makedirs(out, exist_ok=True)
html = open(os.path.join(dist, "index.html"), encoding="utf-8").read()

head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)

# 去掉 charset / viewport meta 与原 title（宿主会补 meta；title 由我们指定）
head = re.sub(r"\s*<meta[^>]*charset[^>]*>", "", head, flags=re.I)
head = re.sub(r"\s*<meta[^>]*viewport[^>]*>", "", head, flags=re.I)
head = re.sub(r"\s*<title>.*?</title>", "", head, flags=re.S)
head_lines = [ln for ln in head.splitlines() if ln.strip()]

entry = f"<title>{title}</title>\n" + "\n".join(head_lines) + "\n" + body.strip() + "\n"
open(os.path.join(out, "index.html"), "w", encoding="utf-8").write(entry)

files = {}
for root, _, names in os.walk(os.path.join(dist, "assets")):
    for n in names:
        rel = os.path.relpath(os.path.join(root, n), dist)
        files[rel] = rel
json.dump(files, open(os.path.join(out, "files.json"), "w", encoding="utf-8"), ensure_ascii=False)

# 校验入口引用的资源都在映射里
refs = re.findall(r'(?:src|href)="\./(assets/[^"]+)"', entry)
missing = [r for r in refs if r not in files]
print("entry:", os.path.join(out, "index.html"))
print("assets:", len(files), "| referenced:", refs, "| missing:", missing)
sys.exit(1 if missing else 0)
