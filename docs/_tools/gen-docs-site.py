#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cordex 文档站生成器：把 docs/ 下全部 Markdown 生成为多页静态站。

用法：python3 docs/_tools/gen-docs-site.py <输出目录> [--screens <截图目录>] [--inline-screens]
依赖：python-markdown（pip install markdown）；前端资源在同级 docs-site/（site.css、site.js）。
截图目录可选：内含 manifest.json（界面截图清单）时，设计画廊与界面页展示截图，否则显示占位；
--inline-screens 把截图以 data URI 内嵌进页面、不输出 screens/（发布目标限制文件条数时用）。
源目录默认取本脚本上一级（docs/），可用环境变量 CORDEX_DOCS_ROOT 覆盖。
"""
import argparse
import base64
import difflib
import html
import json
import os
import re
import shutil
import sys
import unicodedata
import urllib.parse

import markdown
from markdown.extensions import toc as md_toc

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.abspath(os.environ.get("CORDEX_DOCS_ROOT") or os.path.dirname(HERE))
REPO = os.path.dirname(DOCS)
DOCS_REL = os.path.relpath(DOCS, REPO).replace(os.sep, "/")  # 通常为 "docs"
ASSET_DIR = os.path.join(HERE, "docs-site")
BRANCH = "ppt在线编辑器初始化"
GH = "https://github.com/Xeonice/cordis-ppt-editor/"
GH_BLOB = GH + "blob/" + urllib.parse.quote(BRANCH) + "/"
GH_TREE = GH + "tree/" + urllib.parse.quote(BRANCH) + "/"
PLAYGROUND = "https://claude.ai/code/artifact/cf6e1a1a-986b-48bb-b743-5758dff419d2"
CDN_MERMAID = "https://cdn.jsdelivr.net/npm/mermaid@11.16.1/dist/mermaid.min.js"
CDN_HLJS = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"
FONTS = ("https://fonts.googleapis.com/css2?family=Geist:wght@400..700"
         "&family=Geist+Mono:wght@400..600&display=swap")
SITE_NAME = "Cordex 文档站"
SKIP_DIRS = {"node_modules", "dist", "playground", "_evidence", "mockups", "prototype", ".git"}

# 分区：(键, 标签, 说明, docs 相对前缀)；归属取最长匹配前缀
SECTIONS = [
    ("overview", "总览", "文档地图、阅读顺序与文档线工具", ""),
    ("charter", "章程与裁决", "章程 v0.2、裁决记录、cordis 4 基线与 Univer 教训", "00-charter"),
    ("prd", "产品", "背景目标、角色场景、八个功能域、非功能需求、里程碑与指标", "10-prd"),
    ("design", "设计", "界面画廊、设计系统与规范、信息架构、用户流程、协同与扩展 UX", "20-design"),
    ("arch", "架构", "系统上下文与容器、分层与包、内核插件、文档模型、协同、渲染、后端、类型治理",
     "30-architecture"),
    ("frontend", "前端", "前端设计线：应用壳与会话、装配、渲染与文本编辑、协同客户端、UI 体系、性能、客户端安全、遥测与无障碍",
     "50-frontend"),
    ("backend", "后端", "后端设计线：模块与角色矩阵、鉴权链、完整 DDL 与 RLS、存储与保留、REST 与 WS、部署与观测",
     "60-backend"),
    ("testing", "测试", "测试设计线：分层与契约套件、保真与视觉 oracle、协同模拟、e2e、性能与安全、CI 门禁与需求追溯",
     "70-testing"),
    ("adr", "ADR", "架构决策记录：背景、决策、备选方案与后果", "30-architecture/adr"),
    ("modules", "模块", "限界上下文 × cordis 插件：逐文件职责、模块依赖与架构图集", "40-modules"),
]
SEC = {s[0]: s for s in SECTIONS}
TRACKS = ("frontend", "backend", "testing")  # rulings §4.19：各为该侧设计的唯一事实源
SUBDIR_LABEL = {"03-features": "功能域", "03-screens": "界面规格", "_tools": "文档线工具"}

ICONS = {
    "overview": '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
    "charter": '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>'
               '<path d="M14 3v5h5M9 13h6M9 17h6"/>',
    "prd": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    "design": '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/>',
    "arch": '<path d="M12 2 2 7l10 5 10-5z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
    "frontend": '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M6.5 6.5h.01M9.5 6.5h.01M8 14l-2 2 2 2M16 14l2 2-2 2"/>',
    "backend": '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8v-13"/>'
               '<path d="M4.5 12c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8"/>',
    "testing": '<path d="M9 3h6M10 3v6.2L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.2V3"/><path d="M7.2 15h9.6"/>',
    "adr": '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/>'
           '<path d="M6 8.5v7M18 8.5a6 6 0 0 1-6 6H8.5"/>',
    "modules": '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/>'
               '<rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
    "search": '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4'
           'M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    "moon": '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    "menu": '<path d="M4 7h16M4 12h16M4 17h16"/>',
    "expand": '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    "external": '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    "close": '<path d="M6 6l12 12M18 6 6 18"/>',
    "left": '<path d="m15 18-6-6 6-6"/>',
    "right": '<path d="m9 18 6-6-6-6"/>',
    "image": '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/>'
             '<path d="m21 15-5-5L5 21"/>',
    "file": '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
}


def icon(name, cls="ic"):
    return ('<svg class="%s" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>' % (cls, ICONS[name]))


def esc(s):
    return html.escape(s or "", quote=True)


def gh_slug(value, separator="-"):
    """GitHub 风格标题锚点：小写、只留字母/数字/空格/连字符/下划线、空格变连字符。"""
    out = []
    for ch in value.strip().lower():
        if ch in " -_" or unicodedata.category(ch)[0] in "LNM":
            out.append(ch)
    return "".join(out).replace(" ", "-")


def _unique(id_, ids):
    """与 GitHub 一致的重名后缀：foo、foo-1、foo-2。"""
    base, n = id_, 0
    while id_ in ids or not id_:
        n += 1
        id_ = "%s-%d" % (base, n)
    ids.add(id_)
    return id_


md_toc.unique = _unique  # toc 扩展在运行时按模块全局名查找 unique


def natural_key(s):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


def strip_tags(s):
    return re.sub(r"<[^>]+>", "", s)


def text_of(html_s):
    return re.sub(r"\s+", " ", html.unescape(strip_tags(html_s))).strip()


def relurl(target, cur):
    """站内相对链接：target、cur 都是相对站点根的路径。"""
    return os.path.relpath(target, os.path.dirname(cur) or ".").replace(os.sep, "/")


def gh_url(repo_rel, is_dir=False):
    return (GH_TREE if is_dir else GH_BLOB) + urllib.parse.quote(repo_rel, safe="/")


# ---------------------------------------------------------------- Markdown 预处理
FENCE_OPEN = re.compile(r"^( {0,3})(`{3,}|~{3,})[ \t]*([^\s`]*)[^`]*$")
ITEM_RE = re.compile(r"^( *)([-*+]|\d{1,3}\.)[ \t]+\S")
TABLE_SEP_RE = re.compile(r"^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$")
HEADING_RE = re.compile(r"^#{1,6}\s")
ALLOWED_TAGS = ("br|details|summary|sup|sub|kbd|b|i|em|strong|code|span|div|a|img|table|thead|tbody|tr|td|th|p|"
                "ul|ol|li|hr|pre|small|mark|del|s|u|abbr|blockquote|h[1-6]|figure|figcaption|dl|dt|dd")
STRAY_LT = re.compile(r"<(?!/?(?:%s)\b[^<>]*>|!--|https?://|mailto:)" % ALLOWED_TAGS, re.I)
CODE_SPAN = re.compile(r"(`+)(.+?)\1")


def extract_fences(md):
    """把围栏代码块替换为占位符，返回 (新文本, 代码块列表)。围栏可缩进（列表内）。"""
    lines, out, blocks, i = md.split("\n"), [], [], 0
    while i < len(lines):
        m = FENCE_OPEN.match(lines[i])
        if not m:
            out.append(lines[i])
            i += 1
            continue
        indent, fence, lang = len(m.group(1)), m.group(2), m.group(3).lower()
        close = re.compile(r"^ {0,%d}%s%s*\s*$" % (indent + 3, re.escape(fence), re.escape(fence[0])))
        j, buf = i + 1, []
        while j < len(lines) and not close.match(lines[j]):
            ln = lines[j]
            k = 0
            while k < indent and k < len(ln) and ln[k] == " ":
                k += 1
            buf.append(ln[k:])
            j += 1
        blocks.append({"lang": lang, "code": "\n".join(buf)})
        ph = "CXFENCE%dX" % (len(blocks) - 1)
        out.extend(["", ("    " + ph) if indent else ph, ""])
        i = j + 1
    return "\n".join(out), blocks


def escape_stray_lt(line):
    """正文里的 `<T>` 之类不是 HTML：转义 `<`，但跳过行内代码与白名单标签。"""
    if "<" not in line:
        return line
    parts, last = [], 0
    for m in CODE_SPAN.finditer(line):
        parts.append(STRAY_LT.sub("&lt;", line[last:m.start()]))
        parts.append(m.group(0))
        last = m.end()
    parts.append(STRAY_LT.sub("&lt;", line[last:]))
    return "".join(parts)


def preprocess(md):
    """补齐 python-markdown 与 GitHub 口径的差异：列表/表格/标题前补空行，2 空格嵌套列表换算为 4 空格。"""
    src = md.split("\n")
    out, in_list, stack = [], False, []
    for idx, raw in enumerate(src):
        line = escape_stray_lt(raw)
        prev = out[-1] if out else ""
        stripped = line.strip()
        if stripped.startswith("|") and idx + 1 < len(src) and TABLE_SEP_RE.match(src[idx + 1]):
            if prev.strip() and not prev.strip().startswith("|"):
                out.append("")
                prev = ""
            in_list = False
        if HEADING_RE.match(line):
            if prev.strip():
                out.append("")
            in_list = False
            out.append(line)
            continue
        m = ITEM_RE.match(line)
        if m:
            ind = len(m.group(1))
            if not in_list:
                if ind > 3:
                    out.append(line)
                    continue
                if prev.strip() and not ITEM_RE.match(prev):
                    out.append("")
                in_list, stack = True, [ind]
                out.append(line.lstrip(" "))
                continue
            while stack and stack[-1] > ind:
                stack.pop()
            if not stack or ind > stack[-1]:
                stack.append(ind)
            out.append(" " * (4 * (len(stack) - 1)) + line.lstrip(" "))
            continue
        if in_list:
            if not stripped:
                out.append(line)
                continue
            ind = len(line) - len(line.lstrip(" "))
            if ind == 0:
                if not prev.strip() or stripped.startswith(("|", ">")):
                    in_list, stack = False, []
                out.append(line)
                continue
            lvl = max(1, sum(1 for s in stack if s < ind))
            out.append(" " * (4 * lvl) + line.lstrip(" "))
            continue
        out.append(line)
    return "\n".join(out)


# ---------------------------------------------------------------- 文档头解析
STATUS_LINE = re.compile(r"^>\s*状态\s*[：:]")
DATE_RE = re.compile(r"20\d\d-\d\d-\d\d")


def split_head(text):
    """取出 H1 标题、「> 状态：…」元信息行与紧随其后的说明引用块，其余为正文。"""
    lines = text.split("\n")
    title = status = None
    notes, i = [], 0
    while i < len(lines):
        ln, st = lines[i], lines[i].strip()
        if title is None and ln.startswith("# "):
            title, i = ln[2:].strip(), i + 1
            continue
        if status is None and STATUS_LINE.match(ln):
            status, i = re.sub(r"^>\s?", "", ln).strip(), i + 1
            while i < len(lines) and lines[i].startswith(">"):
                notes.append(re.sub(r"^>\s?", "", lines[i]))
                i += 1
            continue
        if not st or (st in ("---", "***") and status is not None):
            i += 1
            continue
        break
    body = lines[i:]
    if title is None:
        for k, ln in enumerate(body):
            if ln.startswith("# "):
                title = ln[2:].strip()
                del body[k]
                break
    return title, status, "\n".join(notes).strip(), "\n".join(body)


def parse_status(s):
    """「状态：A | 负责：B | 更新：C | 依赖：D」→ [(键, 值)]；只在「| 键：」处切分，值里的竖线不受影响。"""
    if not s:
        return []
    parts = re.split(r"\s+\|\s+(?=[^|：:\s]{1,8}\s*[：:])", s)
    fields = []
    for p in parts:
        m = re.match(r"^([^：:|]{1,8})\s*[：:]\s*(.*)$", p, re.S)
        fields.append((m.group(1).strip(), m.group(2).strip()) if m else ("", p.strip()))
    return fields


def split_updates(v):
    """更新字段按日期切成条目：2026-09-19（…）；2026-09-24（…）。"""
    items = [x.strip(" ；;、，,") for x in re.split(r"[；;、，,]\s*(?=20\d\d-\d\d-\d\d)", v)]
    return [x for x in items if x]


def status_tone(v):
    if re.search(r"已接受|接受|已定|定稿|Accepted", v):
        return "ok"
    if re.search(r"提议|Proposed|评审中", v):
        return "info"
    if re.search(r"废弃|取代|退役|Deprecated|Superseded", v):
        return "muted"
    if re.search(r"草稿|draft", v, re.I):
        return "warn"
    return "accent"


# ---------------------------------------------------------------- 代码块与图
LANG_MAP = {"ts": "typescript", "tsx": "typescript", "typescript": "typescript", "js": "javascript",
            "javascript": "javascript", "jsonc": "json", "json": "json", "bash": "bash", "sh": "bash",
            "shell": "bash", "zsh": "bash", "sql": "sql", "yaml": "yaml", "yml": "yaml", "css": "css",
            "html": "xml", "xml": "xml", "diff": "diff", "text": "plaintext", "txt": "plaintext", "": "plaintext"}
ASCII_ART = re.compile(r"[─│┌┐└┘├┤┬┴┼═║╔╗╚╝▶▼◀▲►]")
FIG_RE = re.compile(
    r'(?P<tp><p><strong>(?P<t>(?:(?!</p>).)*?)</strong>(?P<rest>(?:(?!</p>).)*)</p>\s*)?'
    r'<p>\s*CXFENCE(?P<n>\d+)X\s*</p>'
    r'(?P<hp>\s*<p>(?:<strong>)?图?怎么读(?:</strong>)?\s*[：:]?\s*(?P<how>(?:(?!</p>).)*)</p>)?', re.S)
HEAD_RE = re.compile(r"<h([1-4])[^>]*>(.*?)</h\1>", re.S)


SQL_HEAD = re.compile(r"^\s*--\s*(migrate:\s*(?P<mig>\S+)|(?P<ex>example)\b)", re.I)


def render_code(b):
    lang = b["lang"]
    cls = LANG_MAP.get(lang, lang)
    ascii_art = cls == "plaintext" and ASCII_ART.search(b["code"])
    label = "示意图" if ascii_art else (lang or "text")
    hl = "nohighlight" if cls == "plaintext" else "language-" + cls
    tags, extra = "", ""
    if cls == "sql":
        # 60-backend 的 SQL 围栏首行约定（60/08 §11）：「-- migrate: NNNN_name」可执行，「-- example」只做语法解析
        m = SQL_HEAD.match(b["code"])
        if m and m.group("mig"):
            tags = '<span class="code-tag is-mig" title="ddl-check 按编号在 PostgreSQL 18 中顺序执行">迁移 %s</span>' % esc(m.group("mig"))
        elif m and m.group("ex"):
            tags = '<span class="code-tag" title="ddl-check 只做语法解析，不作为迁移执行">示例 · 只解析</span>'
        n = b["code"].count("\n") + 1
        tags += '<span class="code-lines">%d 行</span>' % n
        extra = " sql"
    return ('<div class="code%s%s"><div class="code-bar"><span class="code-meta"><span class="code-lang">%s</span>%s</span>'
            '<button class="code-copy" type="button" aria-label="复制代码">复制</button></div>'
            '<pre><code class="%s">%s</code></pre></div>'
            % (" ascii" if ascii_art else "", extra, esc("SQL" if cls == "sql" else label), tags, hl, esc(b["code"])))


def render_figure(fid, src, title_html, sub_html, how_html, fallback):
    if title_html:
        titles = '<span class="fig-title">%s</span>' % title_html
        if text_of(sub_html):
            titles += '<span class="fig-sub">%s</span>' % sub_html.strip()
    else:
        titles = '<span class="fig-kicker">图</span><span class="fig-title is-derived">%s</span>' % esc(fallback)
    how = ('<figcaption class="fig-how"><span class="how-label">怎么读</span><span>%s</span></figcaption>'
           % how_html) if how_html else ""
    return ('<figure class="fig" id="%s"><div class="fig-head"><div class="fig-titles">%s</div>'
            '<button class="fig-zoom" type="button" aria-label="放大查看">%s<span>放大</span></button></div>'
            '<div class="fig-body"><pre class="cx-mermaid">%s</pre></div>%s</figure>'
            % (fid, titles, icon("expand"), esc(src), how))


def fill_fences(body, blocks, figs):
    """占位符 → 代码块 / 图卡片；图名取上一段加粗标题，「怎么读」段落收为 figcaption。"""
    heads = [(m.start(), text_of(m.group(2))) for m in HEAD_RE.finditer(body)]

    def last_heading(pos):
        t = ""
        for p, txt in heads:
            if p > pos:
                break
            t = txt
        return t.rstrip("#").strip()

    def rep(m):
        b = blocks[int(m.group("n"))]
        if b["lang"] != "mermaid":
            return (m.group("tp") or "") + render_code(b) + (m.group("hp") or "")
        fid = "fig-%d" % (len(figs) + 1)
        title_html = m.group("t") or ""
        fallback = last_heading(m.start())
        figs.append({"id": fid, "title": text_of(title_html) or fallback, "src": b["code"],
                     "how": text_of(m.group("how") or ""), "bold": bool(title_html)})
        return render_figure(fid, b["code"], title_html, m.group("rest") or "", m.group("how") or "", fallback)

    body = FIG_RE.sub(rep, body)

    def bare(m):
        b = blocks[int(m.group(1))]
        if b["lang"] == "mermaid":
            fid = "fig-%d" % (len(figs) + 1)
            figs.append({"id": fid, "title": "", "src": b["code"], "how": "", "bold": False})
            return render_figure(fid, b["code"], "", "", "", "")
        return render_code(b)
    return re.sub(r"CXFENCE(\d+)X", bare, body)


# ---------------------------------------------------------------- 站点模型
def classify(rel):
    """docs 相对路径 → (分区键, 分组子目录, 输出文件名)。"""
    cands = [s for s in SECTIONS if s[3] == "" or rel.startswith(s[3] + "/")]
    sec = max(cands, key=lambda s: len(s[3]))
    sub = rel[len(sec[3]) + 1:] if sec[3] else rel
    parts = sub.split("/")
    group = "/".join(parts[:-1])
    name = sub[:-3].replace("/", "-")
    if name.lower().endswith("readme"):
        name = name[:-6] + "readme"
    return sec[0], group, name


GENERIC_HEADS = {"模块设计"}


def nav_label(title):
    parts = [x.strip() for x in re.split(r"\s*——\s*", (title or "").replace("`", "").replace("**", "")) if x.strip()]
    t = parts[0] if parts else ""
    if len(parts) > 1 and re.match(r"^[\w./-]+$", t) and "/" in t:
        t = parts[1]  # 「docs/_tools —— 文档线工具」这类路径式主标题取副标题
    t = re.sub(r"（[^（）]{10,}）$", "", t).strip()
    if len(t) > 26 and "：" in t:
        head = t.split("：")[0]
        # 「模块设计：…」这类只有类别词的前缀单独做导航名会失去区分度，保留全名
        if re.sub(r"^\d{2}\s*", "", head) not in GENERIC_HEADS:
            t = head
    return t


def nav_num_and_text(doc):
    base = os.path.basename(doc["rel"])[:-3]
    m = re.match(r"^(\d{2,4})-", base)
    num = m.group(1) if m else ""
    t = doc["nav"]
    t = re.sub(r"^(ADR-\d+\s*[：:]?\s*|\d{2}-\d{2}\s+|\d{2}\s*·\s*|\d{2}\s+|功能域\s*\d+[：:]\s*)", "", t)
    return num, (t or doc["nav"])


class Site:
    def __init__(self, out, screens_dir):
        self.out = out
        self.screens_dir = screens_dir
        self.docs = []            # 文档记录（按分区与导航顺序）
        self.by_repo_rel = {}     # 仓库相对 md 路径 → 文档记录
        self.nav = {}             # 分区键 → 导航条目列表（含生成页）
        self.ids = {}             # 输出页 → 页内 id 集合
        self.anchor_checks = []   # (目标页, 锚点, 来源)
        self.missing = []         # 指向不存在文件的链接
        self.search = []
        self.all_figs = []
        self.manifest = None

    # -------------------------------------------------------- 发现与读取
    def discover(self):
        rels = []
        for root, dirs, files in os.walk(DOCS):
            dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not d.startswith("."))
            for f in files:
                if f.endswith(".md"):
                    rels.append(os.path.relpath(os.path.join(root, f), DOCS).replace(os.sep, "/"))
        for rel in rels:
            sec, group, name = classify(rel)
            text = open(os.path.join(DOCS, rel), encoding="utf-8").read()
            title, status, notes, body = split_head(text)
            title = title or os.path.basename(rel)[:-3]
            d = {"rel": rel, "repo_rel": DOCS_REL + "/" + rel, "sec": sec, "group": group,
                 "out": "pages/%s/%s.html" % (sec, name), "title": title, "nav": nav_label(title),
                 "status": status, "fields": parse_status(status), "notes": notes, "body": body,
                 "lines": text.count("\n") + 1, "mermaid": len(re.findall(r"^ {0,3}```mermaid", text, re.M)),
                 "kind": "doc"}
            self.docs.append(d)
            self.by_repo_rel[d["repo_rel"]] = d

        def key(d):
            fname = os.path.basename(d["rel"])
            rank = 0 if fname == "README.md" else (2 if fname.startswith("_") else 1)
            return ([s[0] for s in SECTIONS].index(d["sec"]), 1 if d["group"] else 0,
                    natural_key(d["group"]), rank, natural_key(fname))
        self.docs.sort(key=key)

    def group_label(self, sec, group):
        if not group:
            return ""
        leaf = group.split("/")[-1]
        if leaf in SUBDIR_LABEL:
            return SUBDIR_LABEL[leaf]
        prefix = SEC[sec][3]
        readme = self.by_repo_rel.get("/".join(x for x in (DOCS_REL, prefix, group, "README.md") if x))
        return nav_label(readme["title"]) if readme else leaf

    # -------------------------------------------------------- 链接
    def resolve_href(self, href, doc):
        if not href or re.match(r"^[a-zA-Z][\w+.-]*:", href) or href.startswith("//"):
            return href
        if href.startswith("#"):
            self.anchor_checks.append((doc["out"], urllib.parse.unquote(href[1:]), doc["rel"], doc["out"], href))
            return href
        path, _, frag = href.partition("#")
        path = urllib.parse.unquote(path)
        base = "" if path.startswith("/") else os.path.dirname(doc["repo_rel"])
        repo_rel = os.path.normpath(os.path.join(base, path.lstrip("/"))).replace(os.sep, "/")
        if repo_rel.startswith(".."):
            return href
        full = os.path.join(REPO, repo_rel)
        page = self.by_repo_rel.get(repo_rel)
        if page is None and os.path.isdir(full):
            page = self.by_repo_rel.get(repo_rel + "/README.md")
        tail = ("#" + frag) if frag else ""
        if page is not None:
            new = relurl(page["out"], doc["out"]) + tail
            if frag:
                self.anchor_checks.append((page["out"], urllib.parse.unquote(frag), doc["rel"], doc["out"], new))
            return new
        if not os.path.exists(full):
            self.missing.append((doc["rel"], href))
        return gh_url(repo_rel, os.path.isdir(full)) + tail

    def find_page(self, path, doc):
        for base in (os.path.dirname(doc["repo_rel"]), DOCS_REL, ""):
            cand = os.path.normpath(os.path.join(base, path)).replace(os.sep, "/")
            if cand in self.by_repo_rel:
                return self.by_repo_rel[cand]
        return None

    # -------------------------------------------------------- 渲染
    def rewrite_links(self, body, doc):
        def rep(m):
            new = self.resolve_href(html.unescape(m.group(1)), doc)
            ext = re.match(r"^https?://", new) is not None
            return '<a href="%s"%s' % (esc(new), ' target="_blank" rel="noopener"' if ext else "")
        body = re.sub(r'<a href="([^"]*)"', rep, body)

        def code_link(m):
            page = self.find_page(m.group(1), doc)
            if page is None:
                return m.group(0)
            frag = m.group(2) or ""
            href = relurl(page["out"], doc["out"]) + ("#" + frag if frag else "")
            if frag:
                self.anchor_checks.append((page["out"], urllib.parse.unquote(frag), doc["rel"], doc["out"], href))
            return '<a class="code-link" href="%s">%s</a>' % (esc(href), m.group(0))
        parts = re.split(r"(<a\b[^>]*>.*?</a>)", body, flags=re.S)
        for i in range(0, len(parts), 2):
            parts[i] = re.sub(r"<code>([\w./@-]+\.md)(?:#([^<\s]+))?</code>", code_link, parts[i])
        return "".join(parts)

    @staticmethod
    def swatches(body, cells):
        body = re.sub(r"<code>(#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?|#[0-9A-Fa-f]{3})</code>",
                      r'<code class="hex"><i class="sw" style="--c:\1"></i>\1</code>', body)
        if not cells:
            return body

        def cell(m):
            out, depth = [], 0
            for tok in re.split(r"(<[^>]+>)", m.group(2)):
                if tok.startswith("<"):
                    if re.match(r"<(code|a)\b", tok):
                        depth += 1
                    elif re.match(r"</(code|a)>", tok):
                        depth -= 1
                    out.append(tok)
                elif depth == 0:
                    out.append(re.sub(r"(?<![\w#&;])(#[0-9A-Fa-f]{6})\b",
                                      r'<span class="hex"><i class="sw" style="--c:\1"></i>\1</span>', tok))
                else:
                    out.append(tok)
            return m.group(1) + "".join(out) + m.group(3)
        return re.sub(r"(<td[^>]*>)(.*?)(</td>)", cell, body, flags=re.S)

    def render_md(self, md_text, doc, figs):
        body_md, blocks = extract_fences(md_text)
        conv = markdown.Markdown(extensions=["tables", "sane_lists",
                                             md_toc.TocExtension(toc_depth="2-4", slugify=gh_slug)])
        body = conv.convert(preprocess(body_md))
        toc = conv.toc_tokens
        body = body.replace("\\|", "|")
        body = body.replace("<table>", '<div class="tbl"><table>').replace("</table>", "</table></div>")
        body = re.sub(r'<h([2-4]) id="([^"]+)">(.*?)</h\1>',
                      lambda m: '<h%s id="%s">%s<a class="h-anchor" href="#%s" aria-label="本节链接">#</a></h%s>'
                      % (m.group(1), m.group(2), m.group(3), m.group(2), m.group(1)), body, flags=re.S)
        body = self.rewrite_links(body, doc)
        body = self.swatches(body, doc["sec"] == "design")
        body = fill_fences(body, blocks, figs)
        return body, toc

    def inline_md(self, s, doc):
        s = escape_stray_lt(s)
        if re.match(r"^\d+\.\s", s):
            s = re.sub(r"^(\d+)\.", r"\1\\.", s)  # 「1. xxx」这类单元格不应变成有序列表
        elif re.match(r"^(#{1,6}(\s|$)|[-*+]\s|>)", s):
            s = "\\" + s  # 表头「#」、以「- 」开头的单元格等不应被当成块级语法
        h = markdown.markdown(s)
        h = re.sub(r"^<p>(.*)</p>$", r"\1", h.strip(), flags=re.S)
        return self.rewrite_links(h, doc)

    # -------------------------------------------------------- 页面外壳
    def landing(self, sec):
        return "index.html" if sec == "overview" else self.nav[sec][0]["out"]

    def nav_html(self, sec, cur):
        out, i, items = [], 0, self.nav[sec]
        while i < len(items):
            g = items[i]["group"]
            j = i
            while j < len(items) and items[j]["group"] == g:
                j += 1
            links = "".join(self.nav_item(e, cur) for e in items[i:j])
            if not g:
                out.append('<div class="nav-list">%s</div>' % links)
            else:
                has_cur = any(e["out"] == cur for e in items[i:j])
                out.append('<details class="nav-group"%s><summary><span>%s</span><span class="nav-count">%d</span>'
                           '</summary><div class="nav-list">%s</div></details>'
                           % (" open" if has_cur or (j - i) <= 8 else "", esc(self.group_label(sec, g)), j - i, links))
            i = j
        return "".join(out)

    @staticmethod
    def nav_item(e, cur):
        active = e["out"] == cur
        num = '<span class="nav-num">%s</span>' % esc(e["num"]) if e["num"] else ""
        return ('<a class="nav-item%s" href="%s" title="%s"%s>%s<span class="nav-text">%s</span></a>'
                % (" is-active" if active else "", esc(relurl(e["out"], cur)), esc(e["title"]),
                   ' aria-current="page"' if active else "", num, esc(e["label"])))

    @staticmethod
    def toc_html(tokens):
        def items(ts, depth):
            if not ts:
                return ""
            lis = []
            for t in ts:
                sub = items(t.get("children") or [], depth + 1) if depth < 2 else ""
                lis.append('<li><a href="#%s" data-toc="%s"><span>%s</span></a>%s</li>'
                           % (esc(t["id"]), esc(t["id"]), t["name"], sub))
            return "<ul>%s</ul>" % "".join(lis)
        return items(tokens, 1)

    def chrome(self, cur, sec, title, main, toc="", desc=""):
        root = relurl("index.html", cur)[:-len("index.html")]
        tabs = "".join('<a class="tab%s" href="%s">%s</a>' % (" is-active" if s[0] == sec else "",
                                                                esc(relurl(self.landing(s[0]), cur)), esc(s[1]))
                       for s in SECTIONS)
        side_secs = "".join('<a class="side-sec%s" href="%s">%s<span>%s</span></a>'
                            % (" is-active" if s[0] == sec else "", esc(relurl(self.landing(s[0]), cur)),
                               icon(s[0]), esc(s[1])) for s in SECTIONS)
        toc_aside = ('<aside class="toc" aria-label="本页目录"><div class="toc-inner"><div class="toc-title">本页目录</div>'
                     '%s</div></aside>' % toc) if toc else ""
        page_title = SITE_NAME if cur == "index.html" else "%s · %s" % (text_of(title), SITE_NAME)
        return TEMPLATE.format(
            title=esc(page_title), desc=esc(desc or SEC[sec][2]), fonts=FONTS, root=root, hljs=CDN_HLJS,
            mermaid=CDN_MERMAID, sec=sec, tabs=tabs, side_secs=side_secs, sec_label=esc(SEC[sec][1]),
            sec_desc=esc(SEC[sec][2]), sec_icon=icon(sec), nav=self.nav_html(sec, cur), main=main,
            toc=toc_aside, has_toc=(" has-toc" if toc else "") + (" is-home" if cur == "index.html" else ""),
            i_menu=icon("menu"), i_search=icon("search"),
            i_sun=icon("sun", "ic ic-sun"), i_moon=icon("moon", "ic ic-moon"), i_close=icon("close"),
            i_left=icon("left"), i_right=icon("right"))

    def pager(self, sec, cur):
        items = self.nav[sec]
        idx = next((k for k, e in enumerate(items) if e["out"] == cur), None)
        if idx is None:
            return ""
        cells = []
        for k, cls, lab in ((idx - 1, "prev", "上一篇"), (idx + 1, "next", "下一篇")):
            if 0 <= k < len(items):
                e = items[k]
                cells.append('<a class="pager-%s" href="%s"><span class="pager-k">%s</span>'
                             '<span class="pager-t">%s</span></a>' % (cls, esc(relurl(e["out"], cur)), lab,
                                                                       esc(e["label"])))
            else:
                cells.append('<span class="pager-%s is-empty"></span>' % cls)
        return '<nav class="pager" aria-label="上一篇与下一篇">%s</nav>' % "".join(cells)


LOGO = ('<svg class="brand-logo" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3.5" width="20" height="17" '
        'rx="5" fill="currentColor"/><path d="M7 9h6.5M7 12.5h10M7 16h4.5" stroke="var(--primary-fg)" '
        'stroke-width="1.9" stroke-linecap="round"/></svg>')

TEMPLATE = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='2' y='3.5' width='20' height='17' rx='5' fill='%233A5CE6'/%3E%3Cpath d='M7 9h6.5M7 12.5h10M7 16h4.5' stroke='white' stroke-width='1.9' stroke-linecap='round'/%3E%3C/svg%3E">
<script>(function(){{try{{var t=localStorage.getItem('cx-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}}catch(e){{}}}})()</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{fonts}">
<link rel="stylesheet" href="{root}site.css">
<script defer src="{hljs}"></script>
<script defer src="{mermaid}"></script>
<script defer src="{root}site.js"></script>
</head>
<body data-root="{root}" data-section="{sec}">
<a class="skip-link" href="#main">跳到正文</a>
<header class="topbar">
  <button class="icon-btn nav-toggle" type="button" data-nav-open aria-label="打开导航" aria-controls="sidebar">{i_menu}</button>
  <a class="brand" href="{root}index.html" aria-label="Cordex 文档站首页">""" + LOGO + """<span class="brand-name">Cordex</span><span class="brand-sub">文档站</span></a>
  <nav class="tabs" aria-label="分区">{tabs}</nav>
  <div class="top-actions">
    <button class="search-btn" type="button" data-search-open aria-label="搜索文档">{i_search}<span class="search-btn-text">搜索</span><kbd class="search-kbd" data-mod-k>⌘K</kbd></button>
    <button class="icon-btn theme-btn" type="button" data-theme-toggle aria-label="切换亮色或暗色主题">{i_sun}{i_moon}</button>
  </div>
</header>
<div class="shell{has_toc}">
  <aside class="sidebar" id="sidebar" aria-label="{sec_label}导航">
    <div class="side-head"><button class="icon-btn side-close" type="button" data-nav-close aria-label="关闭导航">{i_close}</button></div>
    <nav class="side-secs" aria-label="全部分区">{side_secs}</nav>
    <div class="side-title">{sec_icon}<div><div class="side-name">{sec_label}</div><div class="side-desc">{sec_desc}</div></div></div>
    <nav class="side-nav">{nav}</nav>
  </aside>
  <div class="scrim" data-nav-close></div>
  <main class="main" id="main" tabindex="-1">
{main}
  </main>
  {toc}
</div>
<div class="lightbox" id="lightbox" hidden role="dialog" aria-modal="true" aria-label="放大查看">
  <div class="lb-stage" id="lb-stage"><div class="lb-content" id="lb-content"></div></div>
  <div class="lb-bar">
    <span class="lb-title" id="lb-title"></span>
    <div class="lb-tools">
      <button type="button" data-lb="out" aria-label="缩小">−</button>
      <button type="button" data-lb="one" class="lb-pct" id="lb-pct" aria-label="原始大小">100%</button>
      <button type="button" data-lb="in" aria-label="放大">+</button>
      <button type="button" data-lb="fit">适应</button>
      <button type="button" data-lb="close" aria-label="关闭">{i_close}</button>
    </div>
  </div>
  <div class="lb-hint">滚轮或双指缩放 · 拖动平移 · 双击复位 · Esc 关闭</div>
</div>
<div class="search" id="search" hidden role="dialog" aria-modal="true" aria-label="搜索文档">
  <div class="search-panel">
    <div class="search-field">{i_search}<input id="search-input" type="text" placeholder="搜索标题、章节与正文" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="search-results" aria-autocomplete="list"><kbd>Esc</kbd></div>
    <div class="search-results" id="search-results" role="listbox" aria-label="搜索结果"></div>
    <div class="search-foot"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>Enter</kbd> 打开</span><span><kbd>Esc</kbd> 关闭</span></div>
  </div>
</div>
</body>
</html>
"""


class Pages(Site):
    """各类页面：文档页、首页、设计画廊、决策面板。"""

    # -------------------------------------------------------- 文档页
    def meta_html(self, d):
        f = dict(d["fields"])
        items = []
        st = f.get("状态")
        if st:
            short = re.split(r"[（(]", st)[0].strip() or st
            short = short if len(short) <= 18 else short[:18] + "…"
            items.append('<span class="chip tone-%s" title="%s">%s</span>' % (status_tone(st), esc(st), esc(short)))
        if f.get("负责"):
            items.append('<span class="meta-kv"><span class="k">负责</span>%s</span>' % self.inline_md(f["负责"], d))
        upd = f.get("更新", "")
        dates = DATE_RE.findall(upd)
        if dates:
            items.append('<span class="meta-kv"><span class="k">更新</span>%s</span>' % max(dates))
        stat = "%d 行" % d["lines"] + (" · %d 张图" % d["mermaid"] if d["mermaid"] else "")
        items.append('<span class="meta-kv">%s</span>' % stat)
        items.append('<a class="meta-src" href="%s" target="_blank" rel="noopener">%s源文件</a>'
                     % (esc(gh_url(d["repo_rel"])), icon("file")))
        rows = []
        for k, v in d["fields"]:
            if k == "更新":
                ents = split_updates(v)
                val = "<ol class=\"upd-list\">%s</ol>" % "".join("<li>%s</li>" % self.inline_md(x, d) for x in ents)
            else:
                val = self.inline_md(v, d)
            rows.append("<div class=\"meta-row\"><dt>%s</dt><dd>%s</dd></div>" % (esc(k or "说明"), val))
        n_upd = len(split_updates(upd)) if upd else 0
        more = ""
        if rows:
            more = ('<details class="meta-more"><summary>元信息与变更记录%s</summary><dl>%s</dl></details>'
                    % ('<span class="count">%d 条修订</span>' % n_upd if n_upd else "", "".join(rows)))
        return '<div class="doc-meta">%s</div>%s' % ("".join(items), more)

    def crumbs(self, d):
        sec = SEC[d["sec"]]
        g = self.group_label(d["sec"], d["group"])
        return ('<nav class="crumbs" aria-label="位置"><a href="%s">%s</a>%s</nav>'
                % (esc(relurl(self.landing(d["sec"]), d["out"])), esc(sec[1]),
                   ('<span class="sep">/</span><span>%s</span>' % esc(g)) if g else ""))

    def build_doc(self, d):
        figs = []
        body, toc = self.render_md(d["body"], d, figs)
        notes = ""
        if d["notes"]:
            nb, _ = self.render_md(d["notes"], d, figs)
            opened = "" if len(d["notes"]) > 360 else " open"
            notes = ('<details class="doc-notes"%s><summary>修订说明与阅读须知</summary>'
                     '<div class="prose notes-body">%s</div></details>' % (opened, nb))
        special, extra = "", ""
        if d["group"] == "03-screens" and d["sec"] == "design":
            special = self.screen_block(d)
        if d["rel"] == "20-design/04-design-system.md":
            special = self.palette_block()
            toc = [{"id": "palette", "name": "色板（亮 / 暗）", "children": []}] + list(toc)
        if os.path.basename(d["rel"]) == "README.md" and not d["group"] and d["sec"] not in ("overview", "design"):
            extra = self.section_cards(d["sec"], d["out"])
            toc = list(toc) + [{"id": "section-docs", "name": "本分区全部文档", "children": []}]
        main = ('<article class="doc"><header class="doc-head">%s<h1 class="doc-title">%s</h1>%s</header>%s%s'
                '<div class="prose">%s</div>%s%s</article>'
                % (self.crumbs(d), self.inline_md(d["title"], d), self.meta_html(d), notes, special, body, extra,
                   self.pager(d["sec"], d["out"])))
        self.write_page(d["out"], d["sec"], d["title"], main, self.toc_html(toc))
        for f in figs:
            f["doc"] = d
        self.all_figs.extend(figs)
        heads = []

        def walk(ts):
            for t in ts:
                heads.append([html.unescape(t["name"]), t["id"]])
                walk(t.get("children") or [])
        walk(toc)
        prose = re.sub(r'<figure class="fig".*?</figure>|<div class="code.*?</pre></div>', " ", body, flags=re.S)
        self.search.append({"u": d["out"], "t": text_of(self.inline_md(d["title"], d)), "s": SEC[d["sec"]][1],
                            "g": self.group_label(d["sec"], d["group"]), "h": heads, "x": text_of(prose)[:1200]})

    def write_page(self, out, sec, title, main, toc=""):
        page = self.chrome(out, sec, title, main, toc)
        self.ids[out] = set(re.findall(r'\sid="([^"]+)"', page))
        path = os.path.join(self.out, out)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(page)

    # -------------------------------------------------------- 界面截图
    def registry_routes(self):
        p = os.path.join(DOCS, "20-design/playground/src/routes/registry.ts")
        out = {}
        if os.path.exists(p):
            src = open(p, encoding="utf-8").read()
            for m in re.finditer(r'path:\s*"([^"]+)"[^\n]*?spec:\s*"([^"]*)"', src):
                sm = re.search(r"03-screens/([\d、,，\s]+)", m.group(2))
                for sid in re.findall(r"\d+", sm.group(1)) if sm else []:
                    out.setdefault(sid.zfill(2), m.group(1))
        return out

    def load_screens(self):
        mf = None
        if self.screens_dir and os.path.exists(os.path.join(self.screens_dir, "manifest.json")):
            with open(os.path.join(self.screens_dir, "manifest.json"), encoding="utf-8") as fh:
                mf = json.load(fh)
        self.manifest = mf
        self.playground = ((mf or {}).get("playgroundUrl") or PLAYGROUND).split("#")[0]
        reg = self.registry_routes()
        self.screens = {}
        for d in self.docs:
            if d["sec"] != "design" or d["group"] != "03-screens":
                continue
            sid = re.match(r"(\d+)", os.path.basename(d["rel"])).group(1)
            route = reg.get(sid, "")
            grp = ("编辑器" if route.startswith("/editor") else "应用与外壳") if route else "仅文档"
            self.screens[d["rel"]] = {"id": sid, "doc": d, "title": re.sub(r"^\d{2}-\d{2}\s*", "", d["title"]),
                                      "group": grp, "route": ("#" + route) if route else "", "states": []}
        by_id = {s["id"]: s for s in self.screens.values()}
        for m in (mf or {}).get("screens", []):
            doc = m.get("doc", "")
            s = self.screens.get("20-design/" + doc) or self.screens.get(doc) or by_id.get(str(m.get("id", "")).zfill(2))
            if not s:
                continue
            s["title"] = m.get("title") or s["title"]
            s["group"] = m.get("group") or s["group"]
            s["route"] = m.get("route") or s["route"]
            s["states"] = [st for st in m.get("states", []) if st.get("light") or st.get("dark")]
            s["see"] = [str(x).zfill(2) for x in (m.get("seeAlso") or [])]
        self.screen_by_id = by_id

    def see_also(self, s):
        """没有独立截图的界面：manifest 的 seeAlso 指向能看到它一部分的界面（只取有截图的）。"""
        return [self.screen_by_id[x] for x in s.get("see", []) if x in self.screen_by_id and self.screen_by_id[x]["states"]]

    def copy_screens(self, inline=False):
        """截图复制到 screens/；inline 时不落文件，改为页面内 data URI（发布目标限制文件条数时用）。"""
        n, self.inline, self.data_uri = 0, inline, {}
        if not self.manifest:
            return n
        dst = os.path.join(self.out, "screens")
        if not inline:
            os.makedirs(dst, exist_ok=True)
        for s in self.screens.values():
            for st in s["states"]:
                for k in ("light", "dark", "thumbLight", "thumbDark"):
                    f = st.get(k)
                    src = os.path.join(self.screens_dir, f) if f else None
                    if src and os.path.exists(src):
                        name = os.path.basename(f)
                        if inline:
                            if name not in self.data_uri:
                                with open(src, "rb") as fh:
                                    self.data_uri[name] = "data:image/jpeg;base64," + base64.b64encode(fh.read()).decode()
                                n += 1
                        elif not os.path.exists(os.path.join(dst, name)):
                            shutil.copy2(src, os.path.join(dst, name))
                            n += 1
                    elif f:
                        st[k] = None
        return n

    def shot_src(self, f, cur):
        name = os.path.basename(f)
        return self.data_uri[name] if getattr(self, "inline", False) else relurl("screens/" + name, cur)

    def img_pair(self, st, cur, big, alt):
        lk, dk = ("light", "dark") if big else ("thumbLight", "thumbDark")
        light = st.get(lk) or st.get("light") or st.get(dk) or st.get("dark")
        dark = st.get(dk) or st.get("dark") or light
        if not light:
            return ""
        wh = 'width="1440" height="900"' if big else 'width="720" height="450"'
        return ('<img class="only-light" src="%s" alt="%s（亮色）" loading="lazy" decoding="async" %s>'
                '<img class="only-dark" src="%s" alt="%s（暗色）" loading="lazy" decoding="async" %s>'
                % (esc(self.shot_src(light, cur)), esc(alt), wh, esc(self.shot_src(dark, cur)), esc(alt), wh))

    def screen_block(self, d):
        s = self.screens.get(d["rel"])
        route = s["route"] if s else ""
        rt = '<code>%s</code>' % esc(route) if route else ""
        pg = ('<a class="btn btn-sm" href="%s" target="_blank" rel="noopener">%s在 playground 中打开</a>'
              % (esc(self.playground), icon("external")))
        states = s["states"] if s else []
        if not states:
            see = self.see_also(s) if s else []
            rel = ""
            if see:
                rel = ('<div class="shots-see"><div class="shots-see-t">在这些界面的截图里能看到它的一部分</div>'
                       '<div class="see-grid">%s</div></div>'
                       % "".join('<a class="see-card" href="%s"><span class="see-media">%s</span><span class="see-body">'
                                 '<span class="see-id">%s</span><span class="see-t">%s</span><span class="see-m">%s · %d 个状态'
                                 '</span></span></a>'
                                 % (esc(relurl(x["doc"]["out"], d["out"])), self.img_pair(x["states"][0], d["out"], False, x["title"]),
                                    esc(x["id"]), esc(x["title"]), esc(x["route"] or "—"), len(x["states"])) for x in see))
            return ('<section class="shots is-empty"><div class="shots-empty">%s<div><div class="shots-empty-t">暂无截图'
                    '</div><div class="shots-empty-d">%s</div></div>%s</div>%s</section>'
                    % (icon("image", "ic ic-lg"),
                       ("playground 路由 %s 暂无该界面的状态截图；打开 playground 后从目录进入该路由查看。" % rt) if rt
                       else "该界面没有独立的 playground 路由，线框、状态与边界情况见下文。", pg, rel))
        segs, frames = [], []
        for k, st in enumerate(states):
            lab = st.get("label") or st.get("value") or "状态 %d" % (k + 1)
            segs.append('<button type="button" role="tab" class="seg-btn%s" aria-selected="%s" data-shot-tab="%d">%s</button>'
                        % (" is-active" if k == 0 else "", "true" if k == 0 else "false", k, esc(lab)))
            frames.append('<figure class="shot" data-shot-frame="%d"%s><button class="shot-img" type="button" '
                          'data-zoom-img aria-label="放大截图：%s">%s</button><figcaption>%s · 状态 '
                          '<b>%s</b>%s</figcaption></figure>'
                          % (k, "" if k == 0 else " hidden", esc(lab), self.img_pair(st, d["out"], True, s["title"] + " · " + lab),
                             ("playground 路由 " + rt) if rt else "playground", esc(lab),
                             (' <span class="muted">（%s）</span>' % esc(st["value"])) if st.get("value") else ""))
        return ('<section class="shots" data-shots><div class="shots-bar"><div class="seg" role="tablist" '
                'aria-label="界面状态">%s</div><div class="shots-nav"><button class="icon-btn" type="button" data-shot="prev" '
                'aria-label="上一个状态">%s</button><span class="shots-count" data-shot-count>1 / %d</span><button '
                'class="icon-btn" type="button" data-shot="next" aria-label="下一个状态">%s</button></div></div>'
                '<div class="shots-stage">%s</div><div class="shots-foot">%s<span class="muted">截图 1440×900，随站点亮/暗主题切换，'
                '点击放大</span></div></section>'
                % ("".join(segs), icon("left"), len(states), icon("right"), "".join(frames), pg))

    # -------------------------------------------------------- 色板
    def palette_block(self):
        p = os.path.join(DOCS, "20-design/playground/src/index.css")
        if not os.path.exists(p):
            return ""
        css = open(p, encoding="utf-8").read()
        color = re.compile(r"^(#[0-9A-Fa-f]{3,8}|rgba?\([^()]*\))$")

        def props(sel):
            d = {}
            for blk in re.findall(sel + r"\s*\{([^{}]*)\}", css):
                for name, val in re.findall(r"--([\w-]+)\s*:\s*([^;]+);", blk):
                    if color.match(val.strip()):
                        d[name] = val.strip()
            return d
        light, dark = props(r"(?m)^:root"), props(r"(?m)^\.dark")
        groups = [("语义色", lambda n: not re.match(r"(chart|presence|sidebar|glass|success|warning|info|canvas|doc|stage)", n)),
                  ("状态色", lambda n: re.match(r"(success|warning|info)", n)),
                  ("图表色", lambda n: n.startswith("chart")),
                  ("画布、纸面与舞台", lambda n: re.match(r"(canvas|doc|stage)", n)),
                  ("材质（玻璃）", lambda n: n.startswith("glass")),
                  ("侧栏", lambda n: n.startswith("sidebar")),
                  ("协作者在场色", lambda n: n.startswith("presence"))]
        out, seen = [], set()
        for label, pred in groups:
            names = [n for n in light if n not in seen and pred(n)]
            if not names:
                continue
            seen.update(names)
            rows = []
            for n in names:
                lv, dv = light[n], dark.get(n, light[n])
                rows.append('<div class="pal-row"><code class="pal-name">--%s</code>'
                            '<div class="pal-cell on-light"><span class="pal-sw" style="--c:%s"></span><span class="pal-v">%s</span></div>'
                            '<div class="pal-cell on-dark"><span class="pal-sw" style="--c:%s"></span><span class="pal-v">%s%s</span></div></div>'
                            % (n, esc(lv), esc(lv), esc(dv), esc(dv), "" if n in dark else "（同亮色）"))
            out.append('<div class="pal-group"><div class="pal-gtitle">%s<span class="count">%d</span></div>'
                       '<div class="pal-head"><span>token</span><span>亮色 :root</span><span>暗色 .dark</span></div>%s</div>'
                       % (label, len(names), "".join(rows)))
        src = gh_url(DOCS_REL + "/20-design/playground/src/index.css")
        return ('<section class="palette" aria-labelledby="palette"><h2 id="palette">色板（亮 / 暗）</h2>'
                '<p class="palette-note">由生成器直接读取 <a href="%s" target="_blank" rel="noopener"><code>playground/src/index.css</code></a> '
                '的 <code>:root</code> 与 <code>.dark</code> 颜色 token 渲染，与 playground 实现保持同源；数值口径以下文 §2 为准。</p>%s</section>'
                % (esc(src), "".join(out)))

    # -------------------------------------------------------- 分区文档卡片（含行数统计）
    def doc_card(self, d, cur):
        num, label = nav_num_and_text(d)
        st = dict(d["fields"]).get("状态", "")
        chip = ('<span class="chip tone-%s">%s</span>' % (status_tone(st), esc(re.split(r"[（(]", st)[0].strip()[:12]))
                if st else "")
        return ('<a class="dcard" href="%s"><span class="dcard-top"><span class="dcard-num">%s</span>%s</span>'
                '<span class="dcard-t">%s</span><span class="dcard-m">%d 行%s</span></a>'
                % (esc(relurl(d["out"], cur)), esc(num or ("README" if d["rel"].endswith("README.md") else "—")),
                   chip, esc(label), d["lines"],
                   " · %d 张图" % d["mermaid"] if d["mermaid"] else ""))

    def section_cards(self, sec, cur, heading=True):
        docs = [d for d in self.docs if d["sec"] == sec]
        lines, figs = sum(d["lines"] for d in docs), sum(d["mermaid"] for d in docs)
        groups, out = [], []
        for d in docs:
            if d["group"] not in groups:
                groups.append(d["group"])
        for g in groups:
            cards = "".join(self.doc_card(d, cur) for d in docs if d["group"] == g)
            gl = self.group_label(sec, g)
            out.append(('<div class="dgroup-t">%s</div>' % esc(gl) if gl else "") + '<div class="dcards">%s</div>' % cards)
        head = ('<h2 id="section-docs">本分区全部文档<span class="h-note">%d 篇 · %s 行 · %d 张图</span></h2>'
                % (len(docs), format(lines, ","), figs)) if heading else ""
        return '<section class="doc-index">%s%s</section>' % (head, "".join(out))

    # -------------------------------------------------------- 设计画廊
    def design_doc_entries(self, docs, cur):
        """画廊上方的设计文档入口：规范与体系类做紧凑卡片（规范、设计系统在前），评审与演进类收成一行链接。"""
        review = re.compile(r"审|提案|总览|现状|评审")
        main = [d for d in docs if not review.search(d["title"])]
        rest = [d for d in docs if review.search(d["title"])]
        main.sort(key=lambda d: (0 if "规范" in d["title"] else 1 if "设计系统" in d["title"] else 2,
                                 natural_key(os.path.basename(d["rel"]))))
        cards = []
        for d in main:
            num, label = nav_num_and_text(d)
            st = re.split(r"[（(]", dict(d["fields"]).get("状态", ""))[0].strip()
            cards.append('<a class="gdoc" href="%s" title="%s"><span class="gdoc-num">%s</span><span class="gdoc-main">'
                         '<span class="gdoc-t">%s</span><span class="gdoc-m">%s%d 行%s</span></span></a>'
                         % (esc(relurl(d["out"], cur)), esc(d["title"]), esc(num or "—"), esc(label),
                            (esc(st[:14]) + " · ") if st else "", d["lines"],
                            " · %d 张图" % d["mermaid"] if d["mermaid"] else ""))
        more = "".join('<a href="%s" title="%s">%s</a>' % (esc(relurl(d["out"], cur)), esc(d["title"]),
                                                             esc(" ".join(x for x in nav_num_and_text(d) if x)))
                       for d in rest)
        return ('<div class="gdocs">%s</div>%s' % ("".join(cards), ('<div class="gdoc-more"><span class="k">评审与演进</span>%s</div>'
                                                                   % more) if more else ""))

    def build_gallery(self):
        cur = "pages/design/index.html"
        docs = [d for d in self.docs if d["sec"] == "design" and not d["group"]]
        screens = sorted(self.screens.values(), key=lambda s: natural_key(s["id"]))
        groups = []
        for s in screens:
            if s["group"] not in groups:
                groups.append(s["group"])
        n_states = sum(len(s["states"]) for s in screens)
        n_shot = sum(1 for s in screens if s["states"])
        chips = ['<button type="button" class="fchip is-active" data-filter="" aria-pressed="true">全部<span>%d</span></button>'
                 % len(screens)]
        for g in groups:
            chips.append('<button type="button" class="fchip" data-filter="%s" aria-pressed="false">%s<span>%d</span></button>'
                         % (esc(g), esc(g), sum(1 for s in screens if s["group"] == g)))
        cards = []
        for s in screens:
            st = s["states"][0] if s["states"] else None
            media = self.img_pair(st, cur, False, s["title"]) if st else ""
            see = self.see_also(s)
            if not media:
                media = '<span class="scard-ph">%s<span>暂无独立截图</span>%s</span>' % (
                    icon("image"), ('<span class="scard-see">可见于 %s</span>' % "、".join(x["id"] + " " + esc(x["title"]) for x in see))
                    if see else "")
            meta = ("%d 个状态" % len(s["states"])) if s["states"] else ("暂无截图" if s["route"] else "无独立路由")
            cards.append('<a class="scard" href="%s" data-group="%s"><span class="scard-media">%s<span class="scard-id">%s</span>'
                         '</span><span class="scard-body"><span class="scard-title">%s</span><span class="scard-meta">'
                         '<span>%s</span><span>%s</span></span>%s</span></a>'
                         % (esc(relurl(s["doc"]["out"], cur)), esc(s["group"]), media, esc(s["id"]), esc(s["title"]),
                            esc(s["group"]), meta, ('<code class="scard-route">%s</code>' % esc(s["route"])) if s["route"] else ""))
        shot_note = ("截图取自设计 playground 真实路由（1440×900），亮/暗随站点主题切换" if self.manifest
                     else "截图清单尚未生成，卡片先以占位显示；生成器读到 manifest.json 后自动填充")
        main = ('<article class="doc doc-wide"><header class="doc-head"><nav class="crumbs" aria-label="位置"><a href="%s">设计</a>'
                '</nav><h1 class="doc-title">界面画廊</h1><p class="lede">%d 份界面规格集中展示：每张卡片对应 '
                '<code>20-design/03-screens</code> 的一份文档，点进去看线框、全部状态与边界情况；%s。</p>'
                '<div class="doc-meta"><span class="meta-kv">%d 个界面</span><span class="meta-kv">%d 个有截图 · %d 个状态</span>'
                '<a class="meta-src" href="%s" target="_blank" rel="noopener">%s打开设计 playground</a></div></header>'
                '<section class="g-docs" aria-labelledby="design-docs"><h2 id="design-docs">设计文档</h2>%s</section>'
                '<section class="gallery"><div class="gal-head"><h2 id="screens">界面<span class="h-note">%d</span></h2>'
                '<div class="gal-filter" role="toolbar" aria-label="按分组筛选">%s</div></div><div class="gal-grid">%s</div>'
                '</section>%s</article>'
                % (esc(relurl(cur, cur)), len(screens), shot_note, len(screens), n_shot, n_states,
                   esc(self.playground), icon("external"), self.design_doc_entries(docs, cur), len(screens),
                   "".join(chips), "".join(cards), self.pager("design", cur)))
        self.write_page(cur, "design", "界面画廊", main)
        self.search.append({"u": cur, "t": "界面画廊", "s": "设计", "g": "",
                            "h": [[s["id"] + " " + s["title"], ""] for s in screens],
                            "x": "设计文档集中展示：%d 份界面规格、playground 截图、分组筛选。" % len(screens)})


# ---------------------------------------------------------------- 裁决表解析（决策面板与首页进度共用）
def md_section(text, num):
    """取「## <num> …」到下一个二级标题之间的文本，返回 (标题, 正文)。"""
    m = re.search(r"^##\s+%s[\s.].*$" % re.escape(num), text, re.M)
    if not m:
        return "", ""
    rest = text[m.end():]
    nxt = re.search(r"^## ", rest, re.M)
    return m.group(0).lstrip("#").strip(), rest[:nxt.start()] if nxt else rest


def split_row(line):
    s = line.strip()
    s = s[1:] if s.startswith("|") else s
    s = s[:-1] if s.endswith("|") and not s.endswith("\\|") else s
    cells, buf, tick, i = [], [], False, 0
    while i < len(s):
        c = s[i]
        if c == "\\" and i + 1 < len(s) and s[i + 1] == "|":
            buf.append("|")
            i += 2
            continue
        if c == "`":
            tick = not tick
        if c == "|" and not tick:
            cells.append("".join(buf).strip())
            buf = []
        else:
            buf.append(c)
        i += 1
    cells.append("".join(buf).strip())
    return cells


def md_tables(block):
    """段内全部表格；表格被空行打断后紧跟的无表头行并回上一张表（源文档 §4.12 即如此）。"""
    lines, tables, i = block.split("\n"), [], 0
    while i < len(lines):
        ln = lines[i].strip()
        if ln.startswith("|") and i + 1 < len(lines) and TABLE_SEP_RE.match(lines[i + 1]):
            head, rows, i = split_row(ln), [], i + 2
            while i < len(lines):
                cur = lines[i].strip()
                if cur.startswith("|") and not (i + 1 < len(lines) and TABLE_SEP_RE.match(lines[i + 1])):
                    rows.append(split_row(cur))
                    i += 1
                elif not cur and i + 1 < len(lines) and lines[i + 1].strip().startswith("|") and not (
                        i + 2 < len(lines) and TABLE_SEP_RE.match(lines[i + 2])):
                    i += 1
                else:
                    break
            tables.append((head, rows))
        else:
            i += 1
    return tables


def read_doc(rel):
    p = os.path.join(DOCS, rel)
    return open(p, encoding="utf-8").read() if os.path.exists(p) else ""


def rulings_file():
    d = os.path.join(DOCS, "00-charter")
    names = sorted(f for f in os.listdir(d) if f.startswith("rulings")) if os.path.isdir(d) else []
    return "00-charter/" + names[-1] if names else ""


def ruling_sets():
    """返回决策面板要展示的表：[(键, 标题, 来源 md 相对路径, 锚点, 表头, 行)]。"""
    sets = []
    charter = read_doc("00-charter/charter.md")
    title, body = md_section(charter, "10")
    for head, rows in md_tables(body)[:1]:
        sets.append(("c10", title, "00-charter/charter.md", gh_slug(title), head, rows))
    rf = rulings_file()
    text = read_doc(rf) if rf else ""
    for num in ("4.20", "4.19", "4.18", "4.15", "4.16", "4.17", "4.12", "4.13"):
        title, body = md_section(text, num)
        for head, rows in md_tables(body)[:1]:
            sets.append((num.replace(".", ""), title, rf, gh_slug(title), head, rows))
    return sets, text


class Build(Pages):
    # -------------------------------------------------------- 决策面板
    def row_state(self, key, head, row, text_after):
        rid = row[0].strip("~*` ")
        if key == "c10":
            joined = " ".join(row)
            return ("ok", "已裁决") if "已裁决" in joined else ("warn", "待裁决")
        later = [n for n, t in text_after if re.search(r"(?<![\w-])%s(?![\w-])" % re.escape(rid), t)]
        verdict = " ".join(row[1:])
        if "专项设计" in verdict:
            return "info", "专项设计"
        if later:
            return "alt", "后续裁决涉及 §" + "、§".join(later)
        return "ok", "已裁决"

    def build_decisions(self):
        cur = "pages/charter/decisions.html"
        sets, rtext = ruling_sets()
        later_secs = [(n, md_section(rtext, n)[1]) for n in ("4.15", "4.16", "4.17", "4.18", "4.19", "4.20")]
        fake = {"rel": "00-charter/decisions", "repo_rel": DOCS_REL + "/00-charter/decisions.md", "out": cur, "sec": "charter"}
        blocks, toc, tiles = [], [], []
        for key, title, src, anchor, head, rows in sets:
            order = [n for n, _ in later_secs]
            after = later_secs[order.index(key[0] + "." + key[1:]) + 1:] if key != "c10" and (key[0] + "." + key[1:]) in order \
                else ([] if key == "c10" else later_secs)
            trs, ok = [], 0
            for r in rows:
                tone, lab = self.row_state(key, head, r, after)
                ok += tone in ("ok", "alt", "info")
                rid = r[0].strip("~*` ")
                cells = "".join("<td>%s</td>" % self.inline_md(c, fake) for c in r)
                trs.append('<tr id="r-%s-%s">%s<td><span class="chip tone-%s">%s</span></td></tr>'
                           % (key, esc(gh_slug(rid)), cells, tone, esc(lab)))
            ths = "".join("<th>%s</th>" % self.inline_md(h, fake) for h in head) + "<th>状态</th>"
            src_page = self.by_repo_rel.get(DOCS_REL + "/" + src)
            link = relurl(src_page["out"], cur) + "#" + anchor if src_page else gh_url(DOCS_REL + "/" + src)
            sid = "set-" + key
            label = ("章程 §" if key == "c10" else "rulings §") + title
            blocks.append('<section class="dset" id="%s"><h2>%s<a class="h-anchor" href="#%s">#</a></h2><p class="sec-note">'
                          '%d 行 · 来源 <a href="%s">%s</a></p><div class="tbl"><table><thead><tr>%s</tr></thead><tbody>%s'
                          '</tbody></table></div></section>' % (sid, esc(label), sid, len(rows), esc(link),
                                                                  esc(src.split("/")[-1]), ths, "".join(trs)))
            toc.append({"id": sid, "name": esc(label if len(label) < 40 else label[:38] + "…"), "children": []})
            tiles.append('<a class="stat-tile" href="#%s"><span class="stat-n">%d<small> / %d</small></span>'
                          '<span class="stat-k">%s</span></a>' % (sid, ok, len(rows), esc(re.sub(r"（.*$", "", label))))
        main = ('<article class="doc doc-wide"><header class="doc-head"><nav class="crumbs" aria-label="位置"><a href="%s">'
                '章程与裁决</a></nav><h1 class="doc-title">决策面板</h1><p class="lede">把章程 §10 与裁决记录里需要用户拍板的'
                '议题汇总成一页：每行保留原文（问题、裁决、落点），末列为生成器按原文判定的状态。「后续裁决涉及」表示该编号在'
                '更晚的裁决节中被再次提及，以更晚者为准。</p></header><div class="stat-row">%s</div>%s%s</article>'
                % (esc(relurl(self.landing("charter"), cur)), "".join(tiles), "".join(blocks), self.pager("charter", cur)))
        self.write_page(cur, "charter", "决策面板", main, self.toc_html(toc))
        self.search.append({"u": cur, "t": "决策面板", "s": "章程与裁决", "g": "",
                            "h": [[text_of(t["name"]), t["id"]] for t in toc],
                            "x": "章程 §10 Q1–Q20、rulings §4.12 U-01…U-16、§4.13 S-1…S-5、§4.15 T-0/Q1–Q10/S-3a、"
                                 "§4.16 Q11–Q20、§4.17 D1–D6、§4.18 矛盾收口 15 项、§4.19 三条设计线拆分 5 项、§4.20 遗留小项收口用户裁决汇总"})
        return sets

    # -------------------------------------------------------- 首页
    def key_figures(self):
        def prefer(f):
            rel = f["doc"]["rel"]
            return (0 if re.match(r"40-modules/(18|19)-", rel) else 1 if f["doc"]["sec"] == "charter"
                    else 2 if f["doc"]["sec"] == "arch" else 3)
        wants = [("系统上下文",), ("包分层", "层带", "分层", "水平层"), ("容器",)]
        chosen = []
        for kws in wants:
            cands = []
            for f in self.all_figs:
                hit = [k for k in kws if k in f["title"]]
                if hit and f not in chosen:
                    cands.append(((prefer(f), kws.index(hit[0]), not f["bold"]), f))
            if cands:
                chosen.append(min(cands, key=lambda c: c[0])[1])
        for f in sorted(self.all_figs, key=prefer):
            if len(chosen) >= 3:
                break
            if f not in chosen and prefer(f) == 0:
                chosen.append(f)
        return chosen[:3]

    def home_figure(self, f, k):
        d = f["doc"]
        fig = render_figure("home-fig-%d" % k, f["src"], esc(f["title"]), "", esc(f["how"]), f["title"])
        src = '<a class="fig-src" href="%s#%s">出自 %s · %s</a>' % (esc(d["out"]), f["id"], esc(SEC[d["sec"]][1]), esc(d["nav"]))
        return '<div class="home-fig">%s%s</div>' % (fig, src)

    def home_parts(self, sets):
        cur = "index.html"
        readme = read_doc("README.md")
        stage = re.search(r"阶段[：:]\s*([^|｜\n]+)", readme)
        stage = stage.group(1).strip() if stage else "M0 蓝图"
        charter = read_doc("00-charter/charter.md")
        _, s0 = md_section(charter, "0")
        lede = re.search(r"^>\s*(.+)$", s0, re.M)
        fake = {"rel": "README.md", "repo_rel": DOCS_REL + "/README.md", "out": cur, "sec": "overview"}
        lede_html = self.inline_md(lede.group(1), fake) if lede else ""
        all_dates = [max(DATE_RE.findall(dict(d["fields"]).get("更新", "")) or [""]) for d in self.docs]
        latest = max(all_dates) if all_dates else ""
        total_lines = sum(d["lines"] for d in self.docs)
        total_figs = sum(d["mermaid"] for d in self.docs)
        stats = [(len(self.docs), "篇文档"), (format(total_lines, ","), "行"), (total_figs, "张 Mermaid 图"),
                 (len(self.screens), "个界面"), (sum(1 for d in self.docs if d["sec"] == "adr" and d["group"] == ""
                                                  and d["rel"].split("/")[-1][:4].isdigit()), "份 ADR")]
        hero = ('<section class="hero"><div class="hero-kicker"><span class="chip tone-accent">%s</span><span>更新至 %s</span>'
                '</div><h1 class="hero-title">Cordex</h1><p class="hero-lede">%s</p><div class="hero-stats">%s</div>'
                '<div class="hero-actions"><a class="btn btn-primary" href="%s">先读章程</a><a class="btn" href="%s">'
                '界面画廊</a><a class="btn" href="%s">决策面板</a><button class="btn" type="button" data-search-open>%s搜索'
                '<kbd data-mod-k>⌘K</kbd></button></div></section>'
                % (esc(stage), latest, lede_html,
                   "".join('<div class="hstat"><span class="hstat-n">%s</span><span class="hstat-k">%s</span></div>' % s
                           for s in stats),
                   esc(self.landing("charter")), "pages/design/index.html", "pages/charter/decisions.html",
                   icon("search")))
        cards = []
        for s in SECTIONS[1:]:  # 首页本身就是总览，分区卡片从章程开始（总览文档经「阅读顺序」入口进入）
            ds = [d for d in self.docs if d["sec"] == s[0]]
            track = s[0] in TRACKS
            cards.append('<a class="sec-card%s" href="%s"><span class="sec-top"><span class="sec-ic">%s</span>%s</span>'
                         '<span class="sec-name">%s</span>'
                         '<span class="sec-desc">%s</span><span class="sec-meta">%d 篇 · %s 行%s</span></a>'
                         % (" is-track" if track else "",
                            esc(self.landing(s[0]) if s[0] != "overview" else "pages/overview/readme.html"),
                            icon(s[0]), '<span class="sec-badge">设计线 · 唯一事实源</span>' if track else "",
                            esc(s[1]), esc(s[2]), len(ds), format(sum(d["lines"] for d in ds), ","),
                            " · %d 张图" % sum(d["mermaid"] for d in ds) if any(d["mermaid"] for d in ds) else ""))
        figs = self.key_figures()
        fig_html = "".join(self.home_figure(f, k + 1) for k, f in enumerate(figs))
        if not figs:
            fig_html = '<p class="sec-note">尚未发现带标题的架构图。</p>'
        return hero, cards, fig_html, stage, sets

    def build_home(self, sets):
        cur = "index.html"
        hero, cards, fig_html, stage, _ = self.home_parts(sets)
        rul = []
        for key, title, src, anchor, head, rows in sets:
            if key not in ("c10", "420", "419", "418", "417", "415"):
                continue
            chips, done = [], 0
            for r in rows:
                rid = r[0].strip("~*` ")
                decided = ("已裁决" in " ".join(r)) if key == "c10" else bool(r[2].strip() if len(r) > 2 else "")
                done += decided
                tip = text_of(self.inline_md(r[1], {"rel": "", "repo_rel": DOCS_REL + "/x.md", "out": cur, "sec": "charter"}))
                chips.append('<a class="rchip%s" href="pages/charter/decisions.html#r-%s-%s" title="%s">%s</a>'
                             % ("" if decided else " is-open", key, esc(gh_slug(rid)), esc(tip), esc(rid)))
            pct = int(round(100.0 * done / len(rows))) if rows else 0
            name = {"c10": "章程 §10 待用户决策", "420": "§4.20 遗留小项收口", "419": "§4.19 三条设计线拆分", "418": "§4.18 文档矛盾收口", "417": "§4.17 回写后复核裁决", "415": "§4.15 章程 Q1–Q10 与方向性裁决"}[key]
            rul.append('<div class="rul-card"><div class="rul-top"><span class="rul-k">%s</span><span class="rul-n">%d / %d</span>'
                       '</div><div class="bar" role="img" aria-label="已裁决 %d%%"><i style="width:%d%%"></i></div>'
                       '<div class="rul-chips">%s</div><div class="rul-src">%s</div></div>'
                       % (name, done, len(rows), pct, pct, "".join(chips), esc(title)))
        recent = sorted(self.docs, key=lambda d: (max(DATE_RE.findall(dict(d["fields"]).get("更新", "")) or [""]),
                                                   d["lines"]), reverse=True)[:8]
        rec = []
        for d in recent:
            upd = split_updates(dict(d["fields"]).get("更新", ""))
            last = upd[-1] if upd else ""
            dt = max(DATE_RE.findall(last) or [""])
            rec.append('<a class="rec" href="%s"><span class="rec-date">%s</span><span class="rec-t">%s</span>'
                       '<span class="rec-s">%s</span></a>' % (esc(d["out"]), dt, esc(d["nav"]), esc(SEC[d["sec"]][1])))
        main = ('<div class="home">%s<section class="home-sec"><div class="home-head"><h2 id="sections">分区</h2>'
                '<a href="pages/overview/readme.html">阅读顺序 →</a></div><div class="sec-grid">%s</div></section>'
                '<section class="home-sec"><div class="home-head"><h2 id="key-figures">关键架构图</h2><span class="sec-note">'
                '系统上下文、分层与容器视图；点「放大」可缩放平移</span></div><div class="home-figs">%s</div></section>'
                '<section class="home-sec"><div class="home-head"><h2 id="rulings">裁决进度</h2><a href="pages/charter/'
                'decisions.html">决策面板 →</a></div><div class="rul-grid">%s</div></section>'
                '<section class="home-sec"><div class="home-head"><h2 id="recent">最近更新</h2><span class="sec-note">按文档头'
                '「更新」字段的最新日期</span></div><div class="rec-list">%s</div></section></div>'
                % (hero, "".join(cards), fig_html, "".join(rul), "".join(rec)))
        self.write_page(cur, "overview", SITE_NAME, main)
        self.search.append({"u": cur, "t": "首页", "s": "总览", "g": "", "h": [["分区", "sections"],
                            ["关键架构图", "key-figures"], ["裁决进度", "rulings"], ["最近更新", "recent"]],
                            "x": "Cordex 文档站首页：%s；分区入口、关键架构图、裁决进度、最近更新。" % stage})

    # -------------------------------------------------------- 导航与产物
    def build_nav(self):
        self.nav = {s[0]: [] for s in SECTIONS}
        for d in self.docs:
            num, label = nav_num_and_text(d)
            self.nav[d["sec"]].append({"out": d["out"], "title": d["title"], "label": label, "num": num,
                                       "group": d["group"]})

        def gen(out, label):
            return {"out": out, "title": label, "label": label, "num": "", "group": ""}
        self.nav["overview"].insert(0, gen("index.html", "首页"))
        self.nav["design"].insert(0, gen("pages/design/index.html", "界面画廊"))
        self.nav["charter"].insert(1 if self.nav["charter"] else 0, gen("pages/charter/decisions.html", "决策面板"))
        for s in SECTIONS:
            if not self.nav[s[0]]:
                self.nav[s[0]].append(gen("index.html", "首页"))

    def write_assets(self):
        for f in ("site.css", "site.js"):
            shutil.copy2(os.path.join(ASSET_DIR, f), os.path.join(self.out, f))
        with open(os.path.join(self.out, "search-index.json"), "w", encoding="utf-8") as fh:
            json.dump({"v": 1, "docs": self.search}, fh, ensure_ascii=False, separators=(",", ":"))

    def fix_anchors(self):
        """源文档里写错的锚点（标题改过编号、按旧口径算 slug）按唯一的近似标题改指，保证站内锚点能跳。"""
        def norm(x):
            return re.sub(r"[\W_]", "", x).lower()

        def core(x):
            return re.sub(r"^[\d-]+", "", x)
        # 源文档有时把锚点指向「**加粗引导语**：」段落而非标题：给目标页里 slug 相同的加粗段首补 id
        for t in sorted({t for t, f, _, _, _ in self.anchor_checks if f and f not in self.ids.get(t, set())}):
            want = {f for tt, f, _, _, _ in self.anchor_checks if tt == t and f and f not in self.ids.get(t, set())}
            path = os.path.join(self.out, t)
            with open(path, encoding="utf-8") as fh:
                page = fh.read()

            def para(m):
                slug = gh_slug(text_of(m.group(1)))
                if slug in want and slug not in self.ids[t]:
                    self.ids[t].add(slug)
                    return '<p id="%s"><strong>%s</strong>' % (esc(slug), m.group(1))
                return m.group(0)
            new = re.sub(r"<p><strong>((?:(?!</strong>).){2,60})</strong>", para, page, flags=re.S)
            if new != page:
                with open(path, "w", encoding="utf-8") as fh:
                    fh.write(new)
        edits, self.fixed = {}, 0
        for t, f, _, src, emitted in self.anchor_checks:
            ids = self.ids.get(t, set())
            if not f or f in ids:
                continue
            best = [i for i in ids if norm(i) == norm(f)]
            if not best and core(f):
                best = [i for i in ids if core(i) == core(f)]
            if not best and len(core(f)) >= 4:
                best = [i for i in ids if core(i).startswith(core(f)) or (len(core(i)) >= 4 and core(f).startswith(core(i)))]
            if not best and len(f) >= 8:
                # 标题中间插了几个字（如「目录树」→「目录与继承树」）：取相似度最高且明显领先的唯一候选
                scored = sorted(((difflib.SequenceMatcher(None, f, i).ratio(), i) for i in ids), reverse=True)
                if scored and scored[0][0] >= 0.82 and (len(scored) == 1 or scored[0][0] - scored[1][0] >= 0.08):
                    best = [scored[0][1]]
            if len(best) == 1:
                new = emitted.split("#")[0] + "#" + best[0]
                edits.setdefault(src, set()).add((emitted, new))
        for src, pairs in edits.items():
            path = os.path.join(self.out, src)
            with open(path, encoding="utf-8") as fh:
                page = fh.read()
            for old, new in pairs:
                n = page.count('href="%s"' % esc(old))
                page = page.replace('href="%s"' % esc(old), 'href="%s"' % esc(new))
                self.fixed += n
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(page)
        checks = []
        for t, f, s, src, e in self.anchor_checks:
            moved = dict(edits.get(src, ())).get(e)
            checks.append((t, moved.split("#", 1)[1] if moved else f, s, src, moved or e))
        self.anchor_checks = checks

    def report(self, n_img):
        broken = [(t, f, s) for t, f, s, _, _ in self.anchor_checks if f and f not in self.ids.get(t, set())]
        files = sum(len(fs) for _, _, fs in os.walk(self.out))
        pages = sum(1 for k in self.ids)
        print("页面 %d · 文件 %d · 文档 %d · 图 %d · 截图文件 %d" % (pages, files, len(self.docs), len(self.all_figs), n_img))
        print("站内锚点检查 %d 处：源文档锚点按近似标题改指 %d 处，仍失配 %d 处；指向不存在文件的链接 %d 处"
              % (len(self.anchor_checks), getattr(self, "fixed", 0), len(broken), len(self.missing)))
        if getattr(self, "fixed", 0) or broken or self.missing:
            # 改指只是阅读兜底：相近改指的数量不算通过，锚点正确与否以 check-links.py 为准（rulings §4.20 TX-04）
            print("注意：相近改指的 %d 处不算通过；请运行 python3 docs/_tools/check-links.py 定位并修正源文档"
                  % getattr(self, "fixed", 0))
        for t, f, s in broken[:20]:
            print("  锚点失配：%s → %s#%s" % (s, t, f))
        for s, h in self.missing[:20]:
            print("  文件不存在：%s → %s" % (s, h))
        if not self.manifest:
            print("提示：未找到截图 manifest.json，画廊与界面页显示「暂无截图」占位")


def clean_out(out):
    guard = {os.path.abspath(x) for x in (REPO, DOCS, HERE, os.path.expanduser("~"), "/")}
    if out in guard or DOCS.startswith(out + os.sep):
        sys.exit("拒绝清空输出目录：%s" % out)
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out)


def main():
    ap = argparse.ArgumentParser(description="生成 Cordex 文档站（docs/ 全部 Markdown → 多页静态站）")
    ap.add_argument("out", help="输出目录（会先清空）")
    ap.add_argument("--screens", help="截图目录：含 manifest.json 与截图文件（可选）")
    ap.add_argument("--inline-screens", action="store_true",
                    help="截图以 data URI 内嵌进页面、不输出 screens/（发布目标限制文件条数时用，页面体积会变大）")
    a = ap.parse_args()
    out = os.path.abspath(a.out)
    clean_out(out)
    b = Build(out, os.path.abspath(a.screens) if a.screens else None)
    b.discover()
    b.build_nav()
    b.load_screens()
    n_img = b.copy_screens(a.inline_screens)
    for d in b.docs:
        b.build_doc(d)
    b.build_gallery()
    sets = b.build_decisions()
    b.build_home(sets)
    b.fix_anchors()
    b.write_assets()
    b.report(n_img)


if __name__ == "__main__":
    main()
