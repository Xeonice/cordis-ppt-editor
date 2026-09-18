#!/usr/bin/env python3
"""用 claude.ai artifact 宿主的真实外壳（Artifact read 返回的骨架与 reset）包裹构建产物，供本地复现宿主内的渲染。
用法：python3 gen-hostwrap.py <dist_dir> <out_dir>
"""
import os, re, sys
dist, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
html = open(os.path.join(dist, "index.html"), encoding="utf-8").read()
head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)
head = re.sub(r"\s*<meta[^>]*>", "", head)
head = re.sub(r"\s*<title>.*?</title>", "", head, flags=re.S)
HOST = ('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1">'
        '<style>:root{color-scheme:light}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}'
        'img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>\n'
        '<title>OCE 设计 Playground</title>\n' + head.strip() + '\n' + body.strip() + '\n</body></html>')
open(os.path.join(out, "index.html"), "w", encoding="utf-8").write(HOST)
link = os.path.join(out, "assets")
if os.path.islink(link) or os.path.exists(link): os.remove(link)
os.symlink(os.path.join(dist, "assets"), link)
print("hostwrap:", os.path.join(out, "index.html"))
