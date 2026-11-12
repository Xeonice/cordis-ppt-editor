#!/usr/bin/env python3
"""check-links：docs/ 严格链接与章节引用检查（rulings §4.20 TX-04）。

只用标准库、只读。两类检查在同一遍历里完成：

1. 链接：Markdown 行内链接 / 图片、引用式链接定义与 HTML `<a href>`、`<img src>`；
   围栏代码块与行内代码里的链接不查，外链（带协议）与仓库外路径不查。
   - 目标文件（或目录）必须存在，大小写精确匹配（GitHub 区分大小写）；
   - 带 `#锚点` 且目标是 .md 时，锚点必须**精确**等于目标文件的某个标题锚点或显式 id：
     标题锚点按 GitHub 规则生成——取渲染后的文字（反引号内的文字保留，链接取链接文字，
     HTML 标签去掉），小写，只留字母 / 数字 / 组合符号 / 连接符号（含 `_`）/ 空格 / 连字符，
     空格变连字符，重名依次加 -1、-2；显式 id 认 `<a id="…">`、`<a name="…">` 等带 id 的标签。
   - 不做「相近改指」：文档站 gen-docs-site.py 会把写错的锚点按近似标题改指，那只是阅读兜底，
     不算通过。
2. 章节引用：带目录前缀的「NN/MM §x.y」「<线目录>/MM §x.y」（NN ∈ 10…70，线目录如
   `60-backend`），以及同一行紧接着写的「、§x.y」；目标解析为唯一的
   `docs/<线目录>/MM-*.md`，要求其中存在以该编号开头的标题（`## 4.`、`### 4.1`、`## §4`
   都算；§4 也被 `4.2` 这类子节满足；§4.1 不被 4.10 满足）。不带目录前缀的「08 §4.1」有歧义，不查；
   `> 状态：` 头行是变更记录，不查章节引用。

失配逐条报「文件:行 → 目标（原因）」，有失配退出码 1，否则 0。

用法：
  python3 docs/_tools/check-links.py                 # 全量（docs/ 下全部 .md，跳过目录同文档站）
  python3 docs/_tools/check-links.py docs/60-backend/15-rest-api-catalog.md …   # 只查这些来源文件
  选项：--no-sections 只查链接；--no-links 只查章节引用；--summary 只打印汇总
"""
import os
import re
import sys
import unicodedata
import urllib.parse
from html import unescape

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.normpath(os.environ.get("CORDEX_DOCS_ROOT") or os.path.join(HERE, ".."))
REPO = os.path.dirname(DOCS)
# 与 gen-docs-site.py 的 SKIP_DIRS 一致
SKIP_DIRS = {"node_modules", "dist", "playground", "_evidence", "mockups", "prototype", ".git"}
LINE_DIRS = {
    "10": "10-prd", "20": "20-design", "30": "30-architecture", "40": "40-modules",
    "50": "50-frontend", "60": "60-backend", "70": "70-testing",
}

FENCE_RE = re.compile(r"^(\s*(?:>\s?)*)(`{3,}|~{3,})")
HEADING_RE = re.compile(r"^ {0,3}(?:>\s?)*(#{1,6})(?:[ \t]+(.*?))?[ \t]*$")
ID_TAG_RE = re.compile(r"<(?:a|span|div|p|h[1-6]|section|dt|li|td|tr|table)\b[^>]*?\s(?:id|name)\s*=\s*[\"']([^\"']+)[\"']", re.I)
INLINE_LINK_RE = re.compile(r"(!?)\[((?:[^\[\]]|\[[^\[\]]*\])*)\]\(\s*(<[^>]*>|[^()\s]*(?:\([^()\s]*\)[^()\s]*)*)(?:\s+(?:\"[^\"]*\"|'[^']*'|\([^)]*\)))?\s*\)")
REF_DEF_RE = re.compile(r"^ {0,3}\[([^\]]+)\]:\s*(<[^>]*>|\S+)")
HTML_LINK_RE = re.compile(r"<(?:a|img)\b[^>]*?\s(?:href|src)\s*=\s*[\"']([^\"']*)[\"']", re.I)
SCHEME_RE = re.compile(r"^[a-zA-Z][\w+.-]*:")
NUM = r"(\d+(?:\.\d+)*[a-z]?)"
SECTION_RE = re.compile(
    r"(?<![A-Za-z0-9_/.\-])(?:(10|20|30|40|50|60|70)|(10-prd|20-design|30-architecture|40-modules|50-frontend|60-backend|70-testing))"
    r"/(\d{2})\s*§\s?" + NUM + r"(?![\d.]*\d)")
CHAIN_RE = re.compile(r"\s*、\s*§\s?" + NUM + r"(?![\d.]*\d)")
HEAD_NUM_RE = re.compile(r"^§?\s*(\d+(?:\.\d+)*[a-z]?)(?![\w])")


# ------------------------------------------------------------------ 通用
def rel(path):
    return os.path.relpath(path, REPO).replace(os.sep, "/")


def iter_md_files():
    for root, dirs, files in os.walk(DOCS):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not d.startswith("."))
        for f in sorted(files):
            if f.endswith(".md"):
                yield os.path.join(root, f)


def exists_exact(path):
    """按路径逐段比对目录项，大小写精确（macOS 文件系统默认不区分大小写，GitHub 区分）。"""
    path = os.path.normpath(path)
    if not os.path.exists(path):
        return False
    r = os.path.relpath(path, REPO)
    if r.startswith(".."):
        return True
    cur = REPO
    for part in r.split(os.sep):
        if part in ("", "."):
            continue
        try:
            if part not in os.listdir(cur):
                return False
        except OSError:
            return False
        cur = os.path.join(cur, part)
    return True


def md_lines(path):
    """逐行产出 (行号, 行文本, 是否在围栏内)。围栏可在列表或引用块里缩进。"""
    with open(path, encoding="utf-8") as fh:
        lines = fh.read().split("\n")
    fence = None
    for i, line in enumerate(lines, 1):
        m = FENCE_RE.match(line)
        if fence is None:
            if m:
                fence = (m.group(2)[0], len(m.group(2)))
                yield i, line, True
                continue
            yield i, line, False
        else:
            if m and m.group(2)[0] == fence[0] and len(m.group(2)) >= fence[1] and line.strip().strip(fence[0]) == "":
                fence = None
            yield i, line, True


def strip_inline_code(line):
    """把行内代码替换为等长空白（反引号串长度须匹配），返回 (去代码后的文本, 代码片段列表)。"""
    out, codes, i = [], [], 0
    while i < len(line):
        if line[i] == "`":
            j = i
            while j < len(line) and line[j] == "`":
                j += 1
            ticks = line[i:j]
            k = line.find(ticks, j)
            while k != -1 and (k + len(ticks) < len(line) and line[k + len(ticks)] == "`"):
                k = line.find(ticks, k + len(ticks) + 1)
            if k == -1:
                out.append(ticks)
                i = j
                continue
            codes.append(line[j:k])
            out.append(" " * (k + len(ticks) - i))
            i = k + len(ticks)
        else:
            out.append(line[i])
            i += 1
    return "".join(out), codes


# ------------------------------------------------------------------ 锚点
def heading_text(raw):
    """标题的渲染文字：反引号内文字保留、链接取文字、图片与 HTML 标签去掉、反斜杠转义与实体还原。"""
    raw = re.sub(r"[ \t]+#+[ \t]*$", "", raw or "")
    raw = re.sub(r"^#+[ \t]*$", "", raw)
    codes = []

    def keep_code(m):
        codes.append(m.group(2).strip() if m.group(2).strip() else m.group(2))
        return "\x00%d\x00" % (len(codes) - 1)
    s = re.sub(r"(`+)(.+?)\1", keep_code, raw)
    s = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", s)
    s = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", s)
    s = re.sub(r"\[([^\]]*)\]\[[^\]]*\]", r"\1", s)
    s = re.sub(r"<[^>\x00]+>", "", s)
    s = re.sub(r"\\([!-/:-@\[-`{-~])", r"\1", s)
    s = unescape(s)
    s = re.sub(r"\x00(\d+)\x00", lambda m: codes[int(m.group(1))], s)
    return s.strip()


def gh_slug(text):
    out = []
    for ch in text.lower():
        if ch in " -" or unicodedata.category(ch)[0] in "LNM" or unicodedata.category(ch) == "Pc":
            out.append(ch)
    return "".join(out).replace(" ", "-")


_ANCHORS = {}


def anchors_of(path):
    """返回 (锚点集合, 标题列表[(行号, 渲染文字)])。"""
    key = os.path.normpath(path)
    if key in _ANCHORS:
        return _ANCHORS[key]
    ids, heads, seen = set(), [], {}
    for ln, line, in_fence in md_lines(path):
        if in_fence:
            continue
        for m in ID_TAG_RE.finditer(line):
            ids.add(m.group(1))
        m = HEADING_RE.match(line)
        if not m:
            continue
        text = heading_text(m.group(2))
        heads.append((ln, text))
        base = gh_slug(text)
        slug = base
        # github-slugger 的重名规则：foo、foo-1、foo-2 …
        while slug in seen:
            seen[base] += 1
            slug = "%s-%d" % (base, seen[base])
        seen[slug] = 0
        ids.add(slug)
    _ANCHORS[key] = (ids, heads)
    return _ANCHORS[key]


# ------------------------------------------------------------------ 链接检查
def check_target(src, target):
    """返回失配原因（字符串）或 None。"""
    target = target.strip()
    if target.startswith("<") and target.endswith(">"):
        target = target[1:-1].strip()
    if not target or SCHEME_RE.match(target) or target.startswith("//"):
        return None
    path, _, frag = target.partition("#")
    path = urllib.parse.unquote(path)
    frag = urllib.parse.unquote(frag)
    if path:
        base = REPO if path.startswith("/") else os.path.dirname(src)
        full = os.path.normpath(os.path.join(base, path.lstrip("/")))
        if os.path.relpath(full, REPO).startswith(".."):
            return None
        if not exists_exact(full):
            return "文件不存在" if not os.path.exists(full) else "文件名大小写不符"
    else:
        full = src
    if not frag:
        return None
    if os.path.isdir(full):
        readme = os.path.join(full, "README.md")
        if not os.path.exists(readme):
            return None
        full = readme
    if not full.endswith(".md"):
        return None
    ids, _ = anchors_of(full)
    if frag not in ids:
        return "锚点不存在"
    return None


def link_targets(line):
    """一行（已去掉行内代码）里的全部链接目标。"""
    found = []
    m = REF_DEF_RE.match(line)
    if m:
        found.append(m.group(2))
    for m in INLINE_LINK_RE.finditer(line):
        found.append(m.group(3))
    for m in HTML_LINK_RE.finditer(line):
        found.append(unescape(m.group(1)))
    return found


# ------------------------------------------------------------------ 章节引用
_LINE_FILES = {}


def resolve_section_file(line_dir, num):
    key = (line_dir, num)
    if key not in _LINE_FILES:
        d = os.path.join(DOCS, line_dir)
        cands = []
        if os.path.isdir(d):
            cands = sorted(f for f in os.listdir(d) if f.startswith(num + "-"))
        files = [f for f in cands if f.endswith(".md") and os.path.isfile(os.path.join(d, f))]
        dirs = [f for f in cands if os.path.isdir(os.path.join(d, f))]
        if len(files) == 1 and not dirs:
            _LINE_FILES[key] = ("file", os.path.join(d, files[0]))
        elif not files and dirs:
            _LINE_FILES[key] = ("dir", None)          # 如 10/03 是目录 03-features：有歧义，不查
        elif not files:
            _LINE_FILES[key] = ("missing", None)
        else:
            _LINE_FILES[key] = ("ambiguous", None)
    return _LINE_FILES[key]


def has_section(path, sec):
    _, heads = anchors_of(path)
    for _, text in heads:
        m = HEAD_NUM_RE.match(text)
        if not m:
            continue
        h = m.group(1)
        if h == sec or h.startswith(sec + "."):
            return True
    return False


def section_refs(line):
    """产出 (显示文本, 线目录, 文件号, 节号)。"""
    for m in SECTION_RE.finditer(line):
        line_dir = LINE_DIRS[m.group(1)] if m.group(1) else m.group(2)
        prefix = m.group(1) or m.group(2)
        num = m.group(3)
        secs = [m.group(4)]
        pos = m.end()
        while True:
            c = CHAIN_RE.match(line, pos)
            if not c:
                break
            secs.append(c.group(1))
            pos = c.end()
        for s in secs:
            yield "%s/%s §%s" % (prefix, num, s), line_dir, num, s


# ------------------------------------------------------------------ 主流程
def main(argv):
    do_links = "--no-links" not in argv
    do_sections = "--no-sections" not in argv
    summary_only = "--summary" in argv
    paths = [a for a in argv if not a.startswith("--")]
    if paths:
        sources = [os.path.abspath(p) for p in paths]
    else:
        sources = list(iter_md_files())
    problems = []
    n_links = n_secs = 0
    for src in sources:
        for ln, line, in_fence in md_lines(src):
            if in_fence:
                continue
            text, _ = strip_inline_code(line)
            if do_links:
                for t in link_targets(text):
                    n_links += 1
                    why = check_target(src, t)
                    if why:
                        problems.append(("link", rel(src), ln, t, why))
            if do_sections and not line.lstrip().startswith("> 状态："):
                for shown, line_dir, num, sec in section_refs(text):
                    n_secs += 1
                    kind, path = resolve_section_file(line_dir, num)
                    if kind == "dir":
                        continue
                    if kind != "file":
                        problems.append(("section", rel(src), ln, shown, "找不到唯一的 %s/%s-*.md" % (line_dir, num)))
                    elif not has_section(path, sec):
                        problems.append(("section", rel(src), ln, shown, "%s 中没有以 %s 开头的标题" % (rel(path), sec)))
    if not summary_only:
        for _, f, ln, t, why in problems:
            print("%s:%d → %s（%s）" % (f, ln, t, why))
    n_link_bad = sum(1 for p in problems if p[0] == "link")
    print("check-links：来源 %d 个文件；链接 %d 处、章节引用 %d 处；失配 %d 处（链接 %d、章节引用 %d）"
          % (len(sources), n_links, n_secs, len(problems), n_link_bad, len(problems) - n_link_bad),
          file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
