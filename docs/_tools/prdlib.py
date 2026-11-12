#!/usr/bin/env python3
"""prdlib：流程门禁共用的「PRD 需求编号解析」与「文档中需求编号引用识别」（docs/80-process/02 §1.1、§1.2、§3）。

check-change-impact.py（G1–G3）、check-req-coverage.py（G4）、check-doc-refs.py（G5）都 import 本模块：需求清单、
引用判定、Markdown 正文切分与 GFM 表格识别只有这一份实现，三个脚本不再各写一份。成文规格是 80/02 §1.1–§1.3、§3 与
docs/_tools/README.md「流程门禁·需求编号口径」；下文是本模块的完整规则，其中比成文规格细的部分（需求块的终点、表格行
定义的附加条件、标题行不取优先级、「已删除」的认法、CO 须带 PRD 字样的三种认法、证据与能力 id 的排除、引用行字段报错等）
尚待回写到上述文档。改规则先改文档，再改这里。只用标准库，兼容 Python 3.9。脚本以 python3 docs/_tools/<脚本>.py
运行时 sys.path 含本目录，直接 import prdlib。python3 docs/_tools/prdlib.py 运行内置自测。

正文切分（scan_markdown；行号不变）：
  - 换行按 CommonMark：LF、CRLF 与单独的 CR 都算行结束；文件开头的 BOM 去掉；不是 UTF-8 时报首个坏字节所在行，按替换
    字符继续；
  - 围栏代码块：``` 或 ~~~ 至少 3 个开头，反引号围栏的信息串不能含反引号（行首的 ```code``` 是行内代码）；闭合行是同一
    字符、不短于开头、其后只有空白，且带与开头同层的引用前缀「>」；开头在引用块里时，引用块结束围栏随之结束；
  - HTML 注释：行首（至多 3 个空格）的「<!--」开始注释块，到含「-->」的行为止（其后的文字保留），注释块里的围栏标记
    不算；行中的「<!-- … -->」是行内注释，代码片段里的「<!--」不算，可以跨行但只在同一段落里——续行须与起始行同层引用、
    非空，且不是 ATX 标题、列表项、表格行、分隔线或 setext 下划线；标题行、表格行里的注释只能在本行闭合；段落里没闭合的
    按字面保留；
  - 正文 = 去掉围栏代码块、HTML 注释与「> 状态：」状态头行之后的行（body_lines）；围栏或注释块直到文件尾没闭合时
    返回 unclosed，调用方报错（其后的内容都不是正文）；
  - 引用识别的取行（ref_lines）：缺省同正文；include_fences=True 时另取围栏代码块里的行（G4 按读者看得见的文字计
    落点：mermaid 节点、代码示例里的 @req 标签都算；缩进代码块不识别、本来就照计）。PRD 解析与 G5 只看正文。

GFM 表格（iter_tables）：表头行含竖线、下一行是单元格数相同的分隔行（每格 :?-+:?）；数据行是其后行号相连、直到空行或
另一个块级结构（ATX 标题、引用、围栏、分隔线、列表项、HTML 块）开头的行——不含竖线的行算只有首格的一行（GFM 规范
例 202）。单元格按未转义的「|」切，首尾竖线可省；少于表头的补空格，多于表头的忽略。

PRD 需求清单（parse_prd / load_prd）：
  - 来源：PRD 03（10-prd/03-features/*.md）九个功能域 OF、ED、CO、PS、EM、SV、ML、AS、PM（任一文件可定义其中任一域），
    PRD 04（10-prd/04-non-functional-requirements.md）的 NF；只看正文；
  - 编号形如 [A-Z]{2,3}-[0-9]{2}[a-z]?（ED-15a；字母、数字只认半角），其后不能紧跟 ASCII 字母数字；
  - 定义行：标题行「### <ID> <标题>」（## 或 ###，# 顶格、后跟空格或制表符；PRD 04 用 ##）；或表格行首格（行以「|」开头，
    「| 」后可带 * 与反引号）。表格行另须同时满足：功能域是本文件以标题行定义的需求所用的功能域（文件里没有标题行定义
    时不限）；首格里编号之后不紧跟区间或列表符（– — ~ … 至 到 、 ， / ； 与 和 及 或），也没有别的编号；该编号没有在
    PRD 任何地方以标题行定义。不满足的是引用行（区间、接口表、需求汇总表）；GFM 表格里不以「|」开头、首格以功能域编号
    开头的行（表头行或数据行）也是引用行；
  - 引用行不属于任何需求块：行里若写了需求字段——「优先级：P0|P1|P2」「目标里程碑：M<n>」或「落点豁免：<线>——」出现在
    行内任意处，或以「优先级」「目标里程碑」「落点豁免」为标签的单元格（标签后是冒号或取值，写法不合规也算；「粘贴优先级：」
    这类措辞不算）——报格式错误，这些字段不归入任何需求（也不归入它所在的标题需求块）；
  - 需求块：从定义行到下一个需求，或到级别高于该需求标题（# 更少）的标题之前——「### OF-01」的块越过同级小标题
    「### 验收」，止于「## 4. 与其它域的接口」；PRD 04「## NF-01」的块含其 ### 小节，止于下一个 NF 或「# 」标题；
    表格行定义的需求遇到任何标题即止；
  - 优先级：块内（标题行定义的不含标题行；表格行定义的含该行编号之后的单元格）首个「优先级：P0|P1|P2」；目标里程碑：
    块内首个「目标里程碑：M<n>」（可带 +，如 M4+；取第一个，「M2（内部）/ M4（公开）」记 M2）；PRD 04 的 NF 不写，记无；
  - 落点豁免：块内（不含定义行）「- 落点豁免：<线>——<理由>」（行首「- 」后至少一个空格，冒号、破折号前后不留空格），
    线取 设计 / 前端 / 后端 / 前后端 / 测试；理由去掉空白与零宽、软连字符等格式字符后不能为空，也不能是「<理由>」这类
    模板占位或「无」「-」「TBD」「待定」一类占位值；同一条线取第一条；表格定义行的单元格里写的落点豁免不算（报错）；
  - 已删除：标题末尾的「（已删除）」「（已删除，<说明>）」（说明前可用 ，,；;：: 或「 <日期>」，不认「、」）且块内没有
    优先级；块内仍写了优先级时报错并按未删除的需求处理；
  - 同一编号重复定义以首次为准，后面的同号块整块不算（报错）。
  格式检查只把静默失效变成报错，不改变上面解析出的结果：目录或文件缺失、某个 PRD 文件没有解析到任何需求、未闭合的围栏
  或注释、像需求定义却不合格式的标题或表格首格（级别、缩进、加粗、全角、数字位数、「新增：」一类标签、功能域不属于
  本文件、setext 标题）、PRD 03 的需求缺优先级或目标里程碑（80/02 §1.1：每条带优先级与目标里程碑）、块内多于一处优先级
  或目标里程碑、像这两个字段或落点豁免却写错的行（行首或单元格开头以该标签开头：半角冒号、冒号前空格、加粗、反引号、
  全角字母数字、取值越界；落点豁免写在引用块里、用别的列表符、「-」后无空格、破折号或线名写错、理由为空或占位）、不在
  任何需求块内的这些字段、上面的引用行字段、表格定义行里的落点豁免、标题带「已删除」括注而块内有优先级、重复定义。

需求编号引用识别（classify_refs；各脚本只在正文里调用）：
  - 文本中独立出现的编号（前后不是 ASCII 字母数字，所以「PRD:ED-05」「PRD ED-05」照常识别）；只有类别 prd 是需求引用；
  - CO 前缀与 rulings §4.18 的条目编号同形，须带 PRD 字样才算（80/02 §3）：编号前 15 个字符内有「PRD」；或编号是指向
    10-prd 的链接文字（「[CO-15](../10-prd/…)」），或紧跟在指向 10-prd 的路径、链接之后；或是列表续项——与前一个编号之间
    只隔 、 , ， / ~ – — … 至 到 与 和 及 或（可带空白、* 与反引号）且前一个编号带 PRD 字样。编号前 15 个字符内有
    「§4.18」「4.18/」「rulings」时不算（co-ruling），带 PRD 也一样，列表续项沿用前一个编号的这一判定；不带 PRD 字样的
    记 co-bare；
  - 证据条目（evidence）：写在「证据」之后的编号链（链里的编号可是任意大小写的证据编号，以列表或区间符分隔）中，属于证据
    清单（docs/_evidence 与 docs/*/_evidence 下 *.json 的 "id"）的编号；不在清单里的照常算；
  - 能力 id（own）：GFM 表格里表头为「能力 id」的列，以及表头为「id | 能力 | …」的表的首列，单元格里的编号（80/02 §1.2：
    引用能力 id 不替代引用需求编号）；「需求 id」「ID」「用例 id」等其余列照常算。
"""
import glob
import os
import re
import sys
import unicodedata
from collections import OrderedDict

# ---------------------------------------------------------------- 常量
FEATURE_DOMAINS = ("OF", "ED", "CO", "PS", "EM", "SV", "ML", "AS", "PM")
NFR_DOMAINS = ("NF",)
DOMAINS = FEATURE_DOMAINS + NFR_DOMAINS
ID_PATTERN = r"[A-Z]{2,3}-[0-9]{2}[a-z]?"
EXEMPT_TRACKS = ("设计", "前端", "后端", "前后端", "测试")
STATUS_PREFIX = "> 状态："
FEATURES_REL = os.path.join("10-prd", "03-features")
NFR_REL = os.path.join("10-prd", "04-non-functional-requirements.md")

# 特殊空白（正则字符类片段与逐字符集合两种形式）：全角空格、不换行空格、U+2000–U+200B、窄不换行空格、数学空格、BOM
UNI_SPACES = "　  -​  ﻿"
UNI_SPACE_CHARS = "　 " + "".join(chr(c) for c in range(0x2000, 0x200c)) + "  ﻿"
WS = "[ \t" + UNI_SPACES + "]"
WS_MARK = "[ \t" + UNI_SPACES + "*_`~]"
LEAD_CHARS = " \t" + UNI_SPACE_CHARS

# ---------------------------------------------------------------- 正文切分
FENCE_RE = re.compile(r"^[ \t]*((?:>[ \t]?)*)[ \t]*(`{3,}|~{3,})(.*)$")
QUOTE_RE = re.compile(r"^[ \t]*((?:>[ \t]?)*)")
BLOCK_COMMENT_RE = re.compile(r"^ {0,3}<!--")
ATX_RE = re.compile(r"^ {0,3}(#{1,6})(?:[ \t]|$)")
LINE_SPLIT_RE = re.compile(r"\r\n|\r|\n")
# 打断段落的块起始（去掉引用前缀之后）：ATX 标题、列表项、表格行、分隔线、setext 下划线
PARA_BREAK_RE = re.compile(r"^ {0,3}(?:#{1,6}(?:[ \t]|$)|(?:[-*+]|[0-9]{1,9}[.)])(?:[ \t]|$)|\||"
                           r"(?:\*[ \t]*){3,}$|(?:_[ \t]*){3,}$|(?:-[ \t]*){2,}$|=+[ \t]*$)")
UNCLOSED_KINDS = ("围栏代码块", "HTML 注释")

# ---------------------------------------------------------------- GFM 表格
DELIM_CELL_RE = re.compile(r"^:?-+:?$")
# 结束表格的块起始：ATX 标题、引用、围栏、分隔线、列表项、HTML 块
BLOCK_START_RE = re.compile(r"^ {0,3}(?:#{1,6}(?:[ \t]|$)|>|`{3,}|~{3,}|(?:\*[ \t]*){3,}$|(?:-[ \t]*){3,}$|"
                            r"(?:_[ \t]*){3,}$|(?:[-*+]|[0-9]{1,9}[.)])(?:[ \t]|$)|<[A-Za-z/!?])")

# ---------------------------------------------------------------- PRD 需求清单
HEADING_RE = re.compile(r"^(#{2,3})[ \t]+(" + ID_PATTERN + r")(?![A-Za-z0-9])")
TABLE_RE = re.compile(r"^\s*\|\s*[*`]*(" + ID_PATTERN + r")(?![A-Za-z0-9])")
# 表格首格里编号之后紧跟区间或列表符：这一行是引用（区间、列表），不是定义
TABLE_CELL_LIST_RE = re.compile(r"^[ \t*`_]*(?:[–—~～…、,，/／;；]|至|到|与|和|及|或)")
PRIORITY_RE = re.compile(r"优先级：\s*(P[012])")
MILESTONE_RE = re.compile(r"目标里程碑：\s*(M[0-9]+\+?)")
EXEMPT_RE = re.compile(r"^\s*-[ \t]+落点豁免：(" + "|".join(EXEMPT_TRACKS) + r")——(.*)$")
DELETED_RE = re.compile(r"[（(][ \t]*已删除(?:[ \t]*[，,；;：:][^（）()]*|[ \t]+[0-9]{4}-[0-9]{2}-[0-9]{2}[^（）()]*)?"
                        r"[ \t]*[)）][ \t*_~`]*$")
# 行内任意处的落点豁免严格写法（引用行、表格定义行里出现即报错）
EXEMPT_ANY_RE = re.compile(r"落点豁免：(?:" + "|".join(EXEMPT_TRACKS) + r")——")
# GFM 表格首格以功能域编号开头（不以「|」开头的表格行用）
CELL_ID_RE = re.compile(r"^[ \t*`_]*(" + ID_PATTERN + r")(?![A-Za-z0-9])")

# 格式检查用的「像……」识别式（只报错，不改变解析结果）
ID_LIKE = r"([A-ZＡ-Ｚ]{2,3})" + WS + r"*[-‐‑‒–—－]" + WS + r"*([0-9０-９]{1,3})"
QUOTE_LIKE = "^[ \t" + UNI_SPACES + ">]*"
CHANGE_LABEL = r"(?:新增|修改|变更|调整|需求|删除|已删除|废弃)" + WS + r"*[：:]" + WS_MARK + "*"
HEAD_LIKE_RE = re.compile(QUOTE_LIKE + r"#{1,6}" + WS_MARK + r"*(?:" + CHANGE_LABEL + r")?" + ID_LIKE)
TABLE_LIKE_RE = re.compile(QUOTE_LIKE + r"\|" + WS_MARK + r"*" + ID_LIKE)
SETEXT_LIKE_RE = re.compile(r"^ {0,3}" + WS_MARK + r"*" + ID_LIKE)
SETEXT_UNDERLINE_RE = re.compile(r"^ {0,3}(?:=+|-+)[ \t]*$")
LIST_MARK_LIKE_RE = re.compile(r"(?:[-*+－–—•·]|[0-9０-９]{1,9}[.)．、])")
# 像字段的行：行首（引用、列表符、加粗之后）或单元格开头（「|」之后）以标签开头，标签后是冒号或取值（见 field_positions）
PRIORITY_TAIL_RE = re.compile(r"[ \t*_`]*(?:[:：]|[PpＰｐ][0-9０-９])")
MILESTONE_TAIL_RE = re.compile(r"[ \t*_`]*(?:[:：]|[MmＭｍ][0-9０-９])")
EXEMPT_TAIL_RE = re.compile(r"[ \t*_`~" + UNI_SPACES + r"]*[:：]")
FULLWIDTH = {ord(c): ord(c) - 0xFEE0 for c in "ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ０１２３４５６７８９"}
UNCLOSED_PRD = "%s从这一行起直到文件尾都没有闭合：其后的需求定义、优先级与落点豁免都不会被解析（补上闭合行）"

# ---------------------------------------------------------------- 引用识别
REF_RE = re.compile(r"(?<![A-Za-z0-9])(" + ID_PATTERN + r")(?![A-Za-z0-9])")
RULING_MARKERS = ("§4.18", "4.18/", "rulings")
RULING_WINDOW = 15
PRD_MARKER = "PRD"
LIST_SEP = r"(?:[、,，/／~～–—]|…+|\.{2,3}|至|到|与|和|及|或)"
# 两个编号之间只隔列表或区间符（可带空白、* 与反引号；前一个编号可是链接文字，后一个可以「[」开头）
CHAIN_GAP_RE = re.compile(r"^(?:[*_`]*\]\([^)\s]*\))?[ \t*_`]*" + LIST_SEP + r"[ \t*_`]*\[?$")
PRD_PATH_BEFORE_RE = re.compile(r"10-prd/[^\s`()<>\[\]]*[`)\]>]*[ \t*_]*[：:]?[ \t*_]*$")
PRD_PREFIX_RE = re.compile(r"PRD\s*[:：]?\s*$")
LINK_OPEN_BEFORE_RE = re.compile(r"\[[*_`]*$")
LINK_TAIL_RE = re.compile(r"[*_`]*\]\(([^)\s]*)\)")
EVIDENCE_TOKEN = r"[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+"
EVIDENCE_CHAIN_RE = re.compile(r"证据[ \t`*]*[：:]?[ \t`*]*(?:" + EVIDENCE_TOKEN + r"[ \t`*]*" + LIST_SEP
                               + r"[ \t`*]*)*$")
EVIDENCE_ID_RE = re.compile(r'"id"\s*:\s*"(' + ID_PATTERN + r')"')
CAP_ID_COLUMN_RE = re.compile(r"^能力\s*id$", re.I)

# ---------------------------------------------------------------- 占位值
PLACEHOLDER_RE = re.compile(r"^(?:<[^<>]*>|[.…。]+)?$")
# 字面非空、语义上等于没填的值（比较时去首尾标点与成对括号、不分大小写）
PLACEHOLDER_VALUES = ("-", "--", "---", "—", "——", "–", "/", "无", "没有", "暂无", "略", "空", "待定", "待补", "待填",
                      "未定", "未填", "某某", "某人", "xx", "xxx", "tbd", "tba", "todo", "n/a", "na", "none", "null",
                      "nil", "?", "？", "??", "？？", "???", "？？？")


# ================================================================ 文本读取
def show_path(path, repo):
    """仓库内的路径显示为相对仓库根的路径（/ 分隔），仓库外的显示绝对路径。"""
    path = os.path.abspath(path)
    r = os.path.relpath(path, os.path.abspath(repo))
    return path.replace(os.sep, "/") if r.startswith("..") else r.replace(os.sep, "/")


def decode_text(data):
    """bytes → (文本, 问题)。去掉开头的 BOM；不是 UTF-8 时按替换字符解码，问题为 (行号, 原因)，否则为 None。"""
    problem = None
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        line = len(LINE_SPLIT_RE.split(data[:exc.start].decode("utf-8", "replace")))
        text = data.decode("utf-8", errors="replace")
        problem = (line, "不是 UTF-8 编码（第 %d 字节起无法解码），已按替换字符继续解析" % (exc.start + 1))
    if text.startswith("﻿"):
        text = text[1:]
    return text, problem


def read_text(path):
    """读文件 → (文本, 问题)（见 decode_text）；读不了（断链、无权限、是目录）抛 OSError。"""
    with open(path, "rb") as fh:
        return decode_text(fh.read())


# ================================================================ 正文切分
def quote_depth(line):
    return QUOTE_RE.match(line).group(1).count(">")


def unquote(line, depth):
    """去掉 depth 层引用前缀「>」；层数不够时返回 None。"""
    s = line
    for _ in range(depth):
        s = s.lstrip(" \t")
        if not s.startswith(">"):
            return None
        s = s[1:]
        if s[:1] in (" ", "\t"):
            s = s[1:]
    return s


def code_ranges(line):
    """行内代码片段的 [起, 止) 区间：反引号串与其后第一个等长的反引号串配对，配不上的按字面处理。"""
    runs = [(m.start(), m.end()) for m in re.finditer(r"`+", line)]
    out, i = [], 0
    while i < len(runs):
        n = runs[i][1] - runs[i][0]
        j = next((j for j in range(i + 1, len(runs)) if runs[j][1] - runs[j][0] == n), None)
        if j is None:
            i += 1
        else:
            out.append((runs[i][0], runs[j][1]))
            i = j + 1
    return out


def _comment_can_span(line):
    """行内注释的起始行能否跨行：ATX 标题行、表格行里的注释只能在本行闭合。"""
    inner = unquote(line, quote_depth(line)) or ""
    return not (ATX_RE.match(inner) or inner.lstrip().startswith("|"))


def _para_continues(rows, j, depth):
    """rows[j] 是否是上一行所在段落的续行：行号相连（中间没有围栏）、引用层数与起始行相同、非空，且去掉引用前缀后
    不以能打断段落的块起始开头。"""
    if j >= len(rows) or rows[j][0] != rows[j - 1][0] + 1:
        return False
    text = rows[j][1]
    if quote_depth(text) != depth:
        return False
    inner = unquote(text, depth)
    return inner is not None and bool(inner.strip()) and not PARA_BREAK_RE.match(inner)


def _strip_inline_comments(rows):
    """就地去掉行内的 <!-- … -->（rows 为非围栏行的 [行号, 文本, …]）。"""
    k = 0
    while k < len(rows):
        line = rows[k][1]
        codes, parts, pos, search, jump, start = code_ranges(line), [], 0, 0, None, -1
        while True:
            start = line.find("<!--", search)
            while start >= 0 and any(a <= start < b for a, b in codes):
                start = line.find("<!--", start + 4)
            if start < 0:
                break
            end = line.find("-->", start + 2)
            if end >= 0:
                parts.append(line[pos:start])
                pos = search = end + 3
                continue
            if _comment_can_span(line):
                depth = quote_depth(line)
                j = k + 1
                while _para_continues(rows, j, depth) and "-->" not in rows[j][1]:
                    j += 1
                if _para_continues(rows, j, depth):
                    jump = j
                    break
            search = start + 4
        if jump is None:
            parts.append(line[pos:])
            rows[k][1] = "".join(parts)
            k += 1
            continue
        parts.append(line[pos:start])
        rows[k][1] = "".join(parts)
        for x in range(k + 1, jump):
            rows[x][1] = ""
        rows[jump][1] = rows[jump][1][rows[jump][1].find("-->") + 3:]
        k = jump


def scan_markdown(text):
    """逐行切分 Markdown（规则见文件头「正文切分」）。返回 (items, unclosed)：items 为
    [(行号, 文本, 是否属于围栏代码块, 围栏信息串（小写，非围栏行为 ""）)]，HTML 注释已去掉、行号不变；
    unclosed 为 (起始行号, "围栏代码块" 或 "HTML 注释") 或 None。"""
    items, fence, comment_from = [], None, None
    for no, line in enumerate(LINE_SPLIT_RE.split(text), 1):
        if fence is not None:
            ch, size, depth, start, info = fence
            if depth and quote_depth(line) < depth:
                fence = None                    # 引用块结束，围栏随之结束；本行照常处理
            else:
                inner = unquote(line, depth)
                if inner is not None and re.match(r"^[ \t]*%s{%d,}[ \t]*$" % (re.escape(ch), size), inner):
                    fence = None
                items.append([no, line, True, info])
                continue
        if comment_from is not None:
            end = line.find("-->")
            if end < 0:
                items.append([no, "", False, ""])
                continue
            comment_from = None
            items.append([no, line[end + 3:], False, ""])
            continue
        m = FENCE_RE.match(line)
        if m and not (m.group(2)[0] == "`" and "`" in m.group(3)):
            info = m.group(3).strip().lower()
            fence = (m.group(2)[0], len(m.group(2)), m.group(1).count(">"), no, info)
            items.append([no, line, True, info])
            continue
        if BLOCK_COMMENT_RE.match(line):
            start = line.find("<!--")
            end = line.find("-->", start + 2)
            if end < 0:
                comment_from = no
                items.append([no, "", False, ""])
                continue
            line = line[:start] + line[end + 3:]
        items.append([no, line, False, ""])
    _strip_inline_comments([it for it in items if not it[2]])
    unclosed = (fence[3], UNCLOSED_KINDS[0]) if fence is not None else \
        ((comment_from, UNCLOSED_KINDS[1]) if comment_from else None)
    return [tuple(it) for it in items], unclosed


def is_status(text):
    return text.lstrip().startswith(STATUS_PREFIX)


def body_lines(items):
    """正文行 [(行号, 文本)]：去掉围栏代码块与状态头行（注释已在 scan_markdown 去掉）。"""
    return [(it[0], it[1]) for it in items if not it[2] and not is_status(it[1])]


def ref_lines(items, include_fences=False):
    """引用识别的取行 [(行号, 文本)]：缺省同 body_lines；include_fences 为真时围栏代码块里的行也取（G4 的落点按读者
    看得见的文字计）。HTML 注释（scan_markdown 已去掉）与状态头行都不取。"""
    return [(it[0], it[1]) for it in items if (include_fences or not it[2]) and not is_status(it[1])]


# ================================================================ GFM 表格
def cell_spans(line):
    """表格行各单元格在行内的 [起, 止)：按未转义的「|」切，首尾竖线可省；没有竖线时整行是首格（GFM）。"""
    end = len(line.rstrip(" \t"))
    lead = len(line) - len(line.lstrip(" \t"))
    if end <= lead:
        return []
    bars = [i for i in range(lead, end) if line[i] == "|" and (i == 0 or line[i - 1] != "\\")]
    start, cuts = lead, bars
    if bars and bars[0] == lead:
        start, cuts = lead + 1, bars[1:]
    spans = []
    for b in cuts:
        spans.append((start, b))
        start = b + 1
    if start < end:
        spans.append((start, end))
    return spans


def split_cells(line):
    """表格行的单元格文字（去首尾空白，「\\|」还原为「|」）。"""
    return [line[a:b].strip().replace("\\|", "|") for a, b in cell_spans(line)]


def plain(cell):
    """单元格去掉反引号与 * 后的文字。"""
    return cell.replace("`", "").replace("*", "").strip()


def has_pipe(line):
    return any(c == "|" and (i == 0 or line[i - 1] != "\\") for i, c in enumerate(line))


def table_break(line):
    """数据行之后的这一行是否结束表格：空行，或另一个块级结构开头。"""
    return not line.strip() or bool(BLOCK_START_RE.match(line))


def is_delimiter_row(line, ncols):
    if not has_pipe(line) or "-" not in line:
        return False
    cells = split_cells(line)
    return len(cells) == ncols and all(DELIM_CELL_RE.match(c) for c in cells)


def iter_tables(rows):
    """rows 为 [(行号, 文本)]（不含围栏行；行号不相连处视为隔断）。产出 (表头下标, 表头单元格, [(行下标, 行号, 单元格)])。"""
    i = 0
    while i + 1 < len(rows):
        no, text = rows[i]
        if has_pipe(text) and not table_break(text) and rows[i + 1][0] == no + 1:
            header = split_cells(text)
            if is_delimiter_row(rows[i + 1][1], len(header)):
                body, j = [], i + 2
                while j < len(rows) and rows[j][0] == rows[j - 1][0] + 1 and not table_break(rows[j][1]):
                    body.append((j, rows[j][0], split_cells(rows[j][1])))
                    j += 1
                yield i, header, body
                i = j
                continue
        i += 1


# ================================================================ 占位值
def _visible(text):
    """去掉空白与格式字符（零宽空格、软连字符、BOM 等 Unicode Cf 类）后的文字。"""
    return "".join(c for c in text if not c.isspace() and unicodedata.category(c) != "Cf")


def is_placeholder(text):
    """空串（含只有零宽、软连字符等格式字符）、模板占位「<理由>」「<名>」、只有省略号，或「-」「无」「TBD」「待定」
    「？」「N/A」一类占位值，视为没填。"""
    t = _visible(text).strip("。.，,；;")
    while len(t) >= 2 and (t[0], t[-1]) in (("（", "）"), ("(", ")"), ("【", "】"), ("[", "]"), ("「", "」")):
        t = t[1:-1].strip("。.，,；;")
    return bool(PLACEHOLDER_RE.match(t)) or t.lower() in PLACEHOLDER_VALUES


# ================================================================ PRD 需求清单
class PrdResult(object):
    """parse_prd / load_prd 的结果。reqs：OrderedDict 编号 → 需求（文件顺序，重复定义取首次）；errors：格式错误
    [(文件, 行, 原因)]；read_errors：读取问题（不是 UTF-8、读不了）。"""

    def __init__(self):
        self.reqs = OrderedDict()
        self.errors = []
        self.read_errors = []

    def all_errors(self):
        return self.read_errors + self.errors


def domain_of(rid):
    return rid.split("-")[0]


def id_key(rid):
    """排序键：按功能域（DOMAINS 顺序）、编号数字、后缀。"""
    m = re.match(r"^([A-Z]{2,3})-([0-9]{2})([a-z]?)$", rid)
    if not m:
        return (len(DOMAINS), rid, 0, "")
    dom = m.group(1)
    return (DOMAINS.index(dom) if dom in DOMAINS else len(DOMAINS), dom, int(m.group(2)), m.group(3))


def prd_sources(docs_root):
    """[(文件, 该文件允许的功能域)]：PRD 03 各 .md 按文件名排序，最后是 PRD 04。"""
    out = []
    feat = os.path.join(docs_root, FEATURES_REL)
    if os.path.isdir(feat):
        for f in sorted(os.listdir(feat)):
            p = os.path.join(feat, f)
            if f.endswith(".md") and os.path.isfile(p):
                out.append((p, FEATURE_DOMAINS))
    nfr = os.path.join(docs_root, NFR_REL)
    if os.path.isfile(nfr):
        out.append((nfr, NFR_DOMAINS))
    return out


def _first_cell(rest):
    cut = re.search(r"(?<!\\)\|", rest)
    return rest[:cut.start()] if cut else rest


def table_ref_reason(rid, rest, domains, own, head_ids):
    """表格首格的编号 rid 不算定义的原因，算定义时返回 None（rest 为该行编号之后的文字）。"""
    dom = domain_of(rid)
    if dom not in domains:
        return "功能域 %s 不在本文件（%s）" % (dom, "PRD 04 只定义 NF" if domains == NFR_DOMAINS
                                          else "NF 只在 PRD 04 定义")
    if dom not in own:
        return "功能域 %s 不是本文件以标题行定义的功能域（%s）" % (dom, "、".join(own))
    if rid in head_ids:
        return "%s 已在 %s 以标题行定义" % (rid, head_ids[rid])
    first = _first_cell(rest)
    if TABLE_CELL_LIST_RE.match(first) or REF_RE.search(first):
        return "首格是区间或列表"
    return None


def definition_at(line, domains, own, head_ids):
    """该行若定义了需求，返回 (编号, 标题, 同一行里属于该需求的文字, 标题级别；表格行为 None)，否则 None。"""
    heading = HEADING_RE.match(line)
    if heading:
        rid = heading.group(2)
        if domain_of(rid) not in domains:
            return None
        return rid, line[heading.end():].strip(), "", len(heading.group(1))   # 标题行不取优先级
    m = TABLE_RE.match(line)
    if not m:
        return None
    rid, rest = m.group(1), line[m.end():]
    if table_ref_reason(rid, rest, domains, own, head_ids):
        return None
    cells = [c.strip(" \t*`") for c in re.split(r"(?<!\\)\|", rest)]
    title = cells[0] or (cells[1] if len(cells) > 1 else "")
    return rid, title, rest, None


def _malformed_definition(line, nxt, domains, own, is_nfr):
    """像需求定义却不合格式时返回原因（只在 definition_at 不认的行上调用；nxt 为紧接的下一行）。"""
    raw = line.strip()
    form = "「## NF-NN <标题>」" if is_nfr else "「### <ID> <标题>」"
    head = HEAD_LIKE_RE.match(line)
    if head:
        dom = head.group(1).translate(FULLWIDTH)
        if dom not in DOMAINS:
            return None
        if dom not in domains:
            where = "PRD 04 只定义 NF" if is_nfr else "PRD 03 只定义 %s，NF 只在 PRD 04 定义" % "、".join(FEATURE_DOMAINS)
            return "编号 %s-%s 的功能域不属于本文件（%s）：%s" % (dom, head.group(2), where, raw)
        return ("像需求定义但格式不合规，不会进入需求清单：应写作%s或表格首列「| <ID> |」，# 顶格、# 后留一个普通空格、"
                "ID 半角且不加粗或反引号、前面不加「新增：」一类标签，数字两位（可带小写后缀如 ED-15a）：%s" % (form, raw))
    tab = TABLE_LIKE_RE.match(line)
    if tab:
        if tab.group(1).translate(FULLWIDTH) not in own or TABLE_RE.match(line):
            return None
        return ("像需求定义但表格首列的编号不合规，不会进入需求清单：ID 半角、数字两位（可带小写后缀如 ED-15a）、"
                "不加反引号以外的标记：%s" % raw)
    if nxt is not None and SETEXT_UNDERLINE_RE.match(nxt):
        s = SETEXT_LIKE_RE.match(line)
        if s and s.group(1).translate(FULLWIDTH) in domains:
            return "像需求定义但写成了 setext 标题（下一行是 === 或 ---），不会进入需求清单：应写作%s：%s" % (form, raw)
    return None


def exempt_like(line):
    """像落点豁免的行（可在引用块里、用任意列表符、标签加粗、冒号半角）：线性扫描，长空白行也不回溯。"""
    s = line.lstrip(LEAD_CHARS + ">")
    m = LIST_MARK_LIKE_RE.match(s)
    if m:
        s = s[m.end():]
    s = s.lstrip(LEAD_CHARS + "*_`")
    if not s.startswith("落点豁免"):
        return False
    return s[4:].lstrip(LEAD_CHARS + "*_`~")[:1] in ("：", ":")


def _skip(text, pos, chars):
    while pos < len(text) and text[pos] in chars:
        pos += 1
    return pos


def field_positions(text, label, tail_re):
    """像字段的标签在行内的下标：行首（引用前缀、列表符、加粗之后）或单元格开头（「|」之后）以 label 开头、其后是
    tail_re。逐个候选起点线性扫描（不用回溯正则，长空白行也不慢）。"""
    out = []
    starts = [0] + [i + 1 for i, c in enumerate(text) if c == "|"]
    for k, s in enumerate(starts):
        pos = _skip(text, s, LEAD_CHARS + ">") if k == 0 else _skip(text, s, LEAD_CHARS)
        m = LIST_MARK_LIKE_RE.match(text, pos)
        if m:
            pos = _skip(text, m.end(), LEAD_CHARS)
        pos = _skip(text, _skip(text, pos, "*_`"), LEAD_CHARS)
        if text.startswith(label, pos) and tail_re.match(text, pos + len(label)):
            out.append(pos)
    return out


def priority_like(text):
    return bool(field_positions(text, "优先级", PRIORITY_TAIL_RE))


def milestone_like(text):
    return bool(field_positions(text, "目标里程碑", MILESTONE_TAIL_RE))


def exempt_in_cells(text):
    """行内有落点豁免写法：严格写法在任意处，或单元格（行首、「|」之后）以「落点豁免」为标签、其后是冒号。"""
    return bool(EXEMPT_ANY_RE.search(text) or field_positions(text, "落点豁免", EXEMPT_TAIL_RE))


def row_fields(text):
    """引用行里写了的需求字段名：块内会被取用（严格写法在行内任意处）或会报写法错误（单元格以标签开头）的写法；
    「粘贴优先级：高」这类措辞不算。"""
    names = []
    if PRIORITY_RE.search(text) or priority_like(text):
        names.append("优先级")
    if MILESTONE_RE.search(text) or milestone_like(text):
        names.append("目标里程碑")
    if exempt_in_cells(text):
        names.append("落点豁免")
    return names


def _gfm_first_cells(body):
    """{行号: 首格文字}：正文里 GFM 表格的表头行与数据行（含不以「|」开头的行）。"""
    out = {}
    for hi, header, rows in iter_tables(body):
        out[body[hi][0]] = header[0] if header else ""
        for _, no, cells in rows:
            out[no] = cells[0] if cells else ""
    return out


def _ref_row(text, first_cell, domains, own, head_ids):
    """该行（不是定义行）若是首格以功能域编号开头的表格行，返回 (编号, 不算定义的原因)，否则 None。"""
    t = TABLE_RE.match(text)
    if t:
        if domain_of(t.group(1)) not in DOMAINS:
            return None
        why = table_ref_reason(t.group(1), text[t.end():], domains, own, head_ids)
        return t.group(1), why or "首格不合定义格式"
    if first_cell is None:
        return None
    c = CELL_ID_RE.match(first_cell)
    if not c or domain_of(c.group(1)) not in DOMAINS:
        return None
    return c.group(1), "表格行不以「|」开头"


def parse_prd(sources):
    """sources：[(显示路径, 文本, 允许的功能域)]，PRD 03 各文件（FEATURE_DOMAINS）在前、PRD 04（NFR_DOMAINS）在后。
    返回 PrdResult（规则见文件头「PRD 需求清单」）。每条需求：id、domain、title、priority、milestone、deleted、file、
    line、exemptions（OrderedDict 线 → {reason, line}）、domainTitle。"""
    res = PrdResult()
    errors = res.errors
    files, head_ids = [], OrderedDict()
    for shown, text, domains in sources:
        items, unclosed = scan_markdown(text)
        if unclosed:
            errors.append((shown, unclosed[0], UNCLOSED_PRD % unclosed[1]))
        body = body_lines(items)
        own = []
        for no, t in body:
            h = HEADING_RE.match(t)
            if h and domain_of(h.group(2)) in domains:
                head_ids.setdefault(h.group(2), "%s:%d" % (shown, no))
                if domain_of(h.group(2)) not in own:
                    own.append(domain_of(h.group(2)))
        files.append((shown, domains, tuple(own) or domains, body))
    seen = {}
    for shown, domains, own, body in files:
        is_nfr = domains == NFR_DOMAINS
        domain_title = next((t[2:].strip() for _, t in body if t.startswith("# ")), shown)
        first_cells = _gfm_first_cells(body)
        rows = []          # (行号, 文本, 定义或 None, 普通标题级别或 None, 引用行 (编号, 原因) 或 None)
        for k, (no, text) in enumerate(body):
            d = definition_at(text, domains, own, head_ids)
            ref = None
            if not d:
                nxt = body[k + 1][1] if k + 1 < len(body) and body[k + 1][0] == no + 1 else None
                why = _malformed_definition(text, nxt, domains, own, is_nfr)
                if why:
                    errors.append((shown, no, why))
                ref = _ref_row(text, first_cells.get(no), domains, own, head_ids)
            heading = ATX_RE.match(text)
            rows.append((no, text, d, len(heading.group(1)) if heading and not d else None, ref))
        blocks, current, n_defs = [], None, 0
        for no, text, d, level, ref in rows:
            if d:
                n_defs += 1
                # 标题行定义的块止于级别高于它（# 更少）的标题；表格行定义的块遇到任何标题即止
                current = {"no": no, "def": d, "lines": [(no, d[2])] if d[2] else [], "end": d[3] - 1 if d[3] else 6}
                blocks.append(current)
                continue
            if current is not None and level is not None and level <= current["end"]:
                current = None
            if ref is not None:
                fields = row_fields(text)
                if fields:
                    host = "（也不归入它所在的 %s 需求块）" % current["def"][0] if current is not None else ""
                    errors.append((shown, no, "表格首格的 %s 不是需求定义（%s），这一行的%s不归入任何需求%s：要在表格里"
                                   "定义需求，行以「|」开头、首格只写一个本文件功能域且未以标题行定义的编号；这一行若是引用，"
                                   "删去这些字段" % (ref[0], ref[1], "、".join("「%s」" % f for f in fields), host)))
                continue
            if current is not None:
                current["lines"].append((no, text))
                continue
            for found, label in ((exempt_like(text), "落点豁免"), (priority_like(text), "优先级"),
                                 (milestone_like(text), "目标里程碑")):
                if found:
                    errors.append((shown, no, "%s不在任何需求块内（应写在该需求标题之后、下一个需求或更高级别（# 更少）的"
                                              "标题之前）" % label))
        if n_defs == 0:
            errors.append((shown, 1, "本文件没有解析到任何需求：%s（文件被清空、截断，或标题写法不合规时也会这样）"
                           % ("PRD 04 的需求标题须为「## NF-NN <标题>」" if is_nfr else
                              "PRD 03 每个文件定义需求，标题须为「### <ID> <标题>」")))
        for b in blocks:
            _finish_block(res, seen, b, shown, is_nfr, domain_title)
    return res


def _fields(b, shown, rid, errors, tail_re, strict_re, label, form):
    """块内某个字段的取值 [(行号, 值)]；像该字段却写错的行报错。"""
    found = []
    for j, text in b["lines"]:
        for pos in field_positions(text, label, tail_re):
            if not strict_re.match(text, pos):
                errors.append((shown, j, "%s 的%s写法不合规范：应为%s（全角冒号、冒号前不留空格、不加粗不加反引号、"
                                         "半角字母与数字）：%s" % (rid, label, form, text.strip())))
        found.extend((j, m.group(1)) for m in strict_re.finditer(text))
    return found


def _finish_block(res, seen, b, shown, is_nfr, domain_title):
    errors = res.errors
    rid, title, _, level = b["def"]
    i = b["no"]
    form_head = "「## NF-NN <标题>」" if is_nfr else "「### <ID> <标题>」"
    pri = _fields(b, shown, rid, errors, PRIORITY_TAIL_RE, PRIORITY_RE, "优先级", "「优先级：P0|P1|P2」")
    ms = _fields(b, shown, rid, errors, MILESTONE_TAIL_RE, MILESTONE_RE, "目标里程碑", "「目标里程碑：M<n>」")
    for found, label in ((pri, "优先级"), (ms, "目标里程碑")):
        if len(found) > 1:
            errors.append((shown, found[1][0], "%s 的需求块里有 %d 处「%s：」（%s）：每条需求只写一处；多出的一处若属于"
                           "另一条需求，检查那条需求的定义行（%s）是否写对" % (
                               rid, len(found), label, "、".join("第 %d 行 %s" % f for f in found), form_head)))
    priority = pri[0][1] if pri else None
    milestone = ms[0][1] if ms else None
    exemptions = OrderedDict()
    if level is None and b["lines"] and b["lines"][0][0] == i and exempt_in_cells(b["lines"][0][1]):
        errors.append((shown, i, "%s 的落点豁免写在了表格定义行的单元格里，不算：落点豁免须单独成行「- 落点豁免：<线>——<理由>」，"
                                 "写在该需求块内（表格行定义的需求块止于下一个需求或标题；需要豁免时改用标题行「### <ID> <标题>」"
                                 "定义）" % rid))
    for j, text in b["lines"]:
        if j == i or not exempt_like(text):
            continue
        m = EXEMPT_RE.match(text)
        if not m or is_placeholder(m.group(2)):
            errors.append((shown, j, "%s 的落点豁免格式不合法：应为「- 落点豁免：<%s>——<理由>」（行首「- 」后留空格，不写在"
                                     "引用块里，冒号、破折号前后不留空格），理由不能为空、模板占位或「无」「待定」一类占位值"
                           % (rid, "|".join(EXEMPT_TRACKS))))
            continue
        exemptions.setdefault(m.group(1), {"reason": m.group(2).strip(), "line": j})
    if rid in seen:
        errors.append((shown, i, "需求编号 %s 重复定义（首次在 %s）" % (rid, seen[rid])))
        return
    seen[rid] = "%s:%d" % (shown, i)
    marked_deleted = bool(DELETED_RE.search(title))
    deleted = marked_deleted and priority is None
    if marked_deleted and not deleted:
        errors.append((shown, i, "%s 的标题末尾带「已删除」括注，块内却写了「优先级：%s」（第 %d 行）：删除的需求去掉优先级行"
                                 "（80/02 §1.1：标注「已删除」并保留编号）；括注若只是需求内容的措辞，改写标题。本次按未删除的"
                                 "需求处理" % (rid, priority, pri[0][0])))
    if not is_nfr and not deleted:
        if priority is None:
            note = "；标题行里写的优先级不算" if level and PRIORITY_RE.search(title) else ""
            errors.append((shown, i, "%s 没有可解析的优先级：PRD 03 的每条需求须在标题之后写「优先级：P0|P1|P2」（80/02 §1.1；"
                                     "表格定义的需求写在该行的单元格里%s）" % (rid, note)))
        if milestone is None:
            errors.append((shown, i, "%s 没有可解析的目标里程碑：PRD 03 的每条需求须在标题之后写「目标里程碑：M<n>」"
                                     "（80/02 §1.1）" % rid))
    res.reqs[rid] = OrderedDict([
        ("id", rid), ("domain", domain_of(rid)), ("title", title), ("priority", priority), ("milestone", milestone),
        ("deleted", deleted), ("file", shown), ("line", i), ("exemptions", exemptions), ("domainTitle", domain_title),
    ])


def load_prd(docs_root):
    """读 docs_root 下的 PRD 03、04 并解析：返回 PrdResult（缺目录、缺文件、读不了、PRD 03 没有任何需求都记进错误）。"""
    repo = os.path.dirname(os.path.abspath(docs_root))
    feat = os.path.join(docs_root, FEATURES_REL)
    nfr = os.path.join(docs_root, NFR_REL)
    head_errors, read_errors, sources = [], [], []
    if not os.path.isdir(feat):
        head_errors.append((show_path(feat, repo), 1, "PRD 03 目录不存在：需求清单缺少九个功能域"))
    if not os.path.isfile(nfr):
        head_errors.append((show_path(nfr, repo), 1, "PRD 04 不存在：需求清单缺少 NF"))
    for path, domains in prd_sources(docs_root):
        shown = show_path(path, repo)
        try:
            text, problem = read_text(path)
        except OSError as exc:
            read_errors.append((shown, 1, "无法读取（%s），按空文件处理" % (exc.strerror or exc)))
            text, problem = "", None
        if problem:
            read_errors.append((shown, problem[0], problem[1]))
        sources.append((shown, text, domains))
    res = parse_prd(sources)
    res.errors[:0] = head_errors
    res.read_errors = read_errors
    if os.path.isdir(feat) and not any(q["domain"] in FEATURE_DOMAINS for q in res.reqs.values()):
        res.errors.append((show_path(feat, repo), 1, "PRD 03 没有解析到任何需求：需求标题须为「### <ID> <标题>」"))
    return res


def req_json(q):
    """需求的机读形式（三个脚本输出同一结构，供交叉核对）。"""
    return OrderedDict([
        ("id", q["id"]), ("domain", q["domain"]), ("title", q["title"]), ("priority", q["priority"]),
        ("milestone", q["milestone"]), ("deleted", q["deleted"]), ("file", q["file"]), ("line", q["line"]),
        ("exemptions", [OrderedDict([("track", t), ("reason", e["reason"]), ("line", e["line"])])
                        for t, e in q["exemptions"].items()]),
    ])


# ================================================================ 需求编号引用识别
def prd_link(line, start, end):
    """编号本身是指向 10-prd 的链接文字：「[CO-15](../10-prd/…)」。"""
    if not LINK_OPEN_BEFORE_RE.search(line, 0, start):
        return False
    m = LINK_TAIL_RE.match(line, end)
    return bool(m) and "10-prd/" in m.group(1)


def classify_refs(line, own_spans=(), evidence_ids=frozenset(), lo=0, hi=None):
    """一行里每个需求形编号的归类（规则见文件头「需求编号引用识别」），产出 (编号, 起点, 终点, 类别)。
    类别：prd 需求引用；own 能力 id；evidence 证据条目；co-ruling rulings §4.18 的 CO 条目；co-bare 不带 PRD 字样的
    CO 编号。只有 prd 是需求引用。不判断编号是否存在、前缀是否是功能域。lo、hi 只限定产出哪些位置的编号，归类照样
    看整行（PRD 字样、列表续项可以在 lo 之前）。"""
    matches = list(REF_RE.finditer(line))
    marked, ruled = [], []
    for i, m in enumerate(matches):
        rid, start, end = m.group(1), m.start(1), m.end(1)
        window = line[max(0, start - RULING_WINDOW):start]
        chained = i > 0 and bool(CHAIN_GAP_RE.match(line[matches[i - 1].end(1):start]))
        marked.append(PRD_MARKER in window or (chained and marked[i - 1])
                      or bool(PRD_PATH_BEFORE_RE.search(line, 0, start)) or prd_link(line, start, end))
        ruled.append(any(mk in window for mk in RULING_MARKERS) or (chained and ruled[i - 1]))
        if start < lo or (hi is not None and start >= hi):
            continue
        if any(a <= start < b for a, b in own_spans):
            kind = "own"
        elif rid in evidence_ids and EVIDENCE_CHAIN_RE.search(line, 0, start):
            kind = "evidence"
        elif rid.startswith("CO-"):
            kind = "co-ruling" if ruled[i] else ("prd" if marked[i] else "co-bare")
        else:
            kind = "prd"
        yield rid, start, end, kind


def explicit_prd_flags(line):
    """{起点: 是否明示 PRD}：编号前紧挨「PRD:」「PRD 」，或是指向 10-prd 的链接文字、紧跟 10-prd 路径，或是这类编号的
    列表续项（G5 归属解析用：明示 PRD 的编号不在 PRD 里就报失配，不再回退去查能力 id）。"""
    out, prev_end, prev = {}, None, False
    for m in REF_RE.finditer(line):
        start, end = m.start(1), m.end(1)
        chained = prev_end is not None and bool(CHAIN_GAP_RE.match(line[prev_end:start]))
        flag = (bool(PRD_PREFIX_RE.search(line[max(0, start - 6):start])) or bool(PRD_PATH_BEFORE_RE.search(line, 0, start))
                or prd_link(line, start, end) or (chained and prev))
        out[start] = flag
        prev, prev_end = flag, end
    return out


def capability_spans(items):
    """{行号: [(起, 止)]}：能力 id 单元格的区间——GFM 表格里表头为「能力 id」的列，以及表头「id | 能力 | …」的表的首列。
    items 为 scan_markdown 的结果。"""
    rows = [(it[0], it[1]) for it in items if not it[2]]
    out = {}
    for _, header, body in iter_tables(rows):
        names = [plain(h) for h in header]
        cols = {c for c, h in enumerate(names) if CAP_ID_COLUMN_RE.match(h)}
        if len(names) >= 2 and names[0].lower() == "id" and names[1] == "能力":
            cols.add(0)
        if not cols:
            continue
        for j, no, _ in body:
            spans = cell_spans(rows[j][1])
            chosen = [spans[c] for c in sorted(cols) if c < len(spans)]
            if chosen:
                out[no] = chosen
    return out


def load_evidence_ids(docs_root):
    """证据清单（docs/_evidence 与 docs/*/_evidence 下 *.json）里与需求同形的 "id"：返回 (集合, 错误列表)。"""
    repo = os.path.dirname(os.path.abspath(docs_root))
    ids, errors = set(), []
    paths = glob.glob(os.path.join(docs_root, "_evidence", "*.json")) + \
        glob.glob(os.path.join(docs_root, "*", "_evidence", "*.json"))
    for p in sorted(set(paths)):
        shown = show_path(p, repo)
        try:
            text, problem = read_text(p)
        except OSError as exc:
            errors.append((shown, 1, "证据清单无法读取（%s）" % (exc.strerror or exc)))
            continue
        if problem:
            errors.append((shown, problem[0], "证据清单" + problem[1]))
        ids.update(EVIDENCE_ID_RE.findall(text))
    return ids, errors


# ================================================================ 自测
def _selftest():
    results = []

    def check(name, cond, detail=""):
        results.append(bool(cond))
        if not cond:
            print("失败 %s\n    %s" % (name, str(detail)[:2000]))

    def prd(*files):
        return parse_prd([(name, text, NFR_DOMAINS if name.startswith("04") else FEATURE_DOMAINS)
                          for name, text in files])

    def brief(res):
        return {r: (q["priority"], q["milestone"], {t: e["reason"] for t, e in q["exemptions"].items()}, q["deleted"],
                    "%s:%d" % (q["file"], q["line"])) for r, q in res.reqs.items()}

    def errs(res, word):
        return [e for e in res.errors if word in e[2]]

    head = "# 编辑\n\n## 3. 需求\n\n"
    ok = "- 优先级：P1 | 目标里程碑：M2\n"
    # 1 需求块止于级别高于它（# 更少）的标题：越过同级、更低级小标题
    r = prd(("02.md", head + "### ED-01 a\n正文\n### 验收\n优先级：P0\n- 落点豁免：设计——纯服务端\n目标里程碑：M2\n"))
    check("同级 ### 小标题不结束需求块，其后的优先级与豁免属于 ED-01（g4 第 3 轮用例 12.1）",
          brief(r)["ED-01"][:3] == ("P0", "M2", {"设计": "纯服务端"}) and not r.errors, (brief(r), r.errors))
    r = prd(("02.md", head + "### ED-01 a\n" + ok + "#### 验收\n- 落点豁免：设计——纯服务端\n## 4. 接口\n- 落点豁免：测试——x\n"))
    check("更低级标题不结束块、更高级标题结束块，其后的豁免报「不在任何需求块内」",
          brief(r)["ED-01"][2] == {"设计": "纯服务端"} and len(errs(r, "落点豁免不在任何需求块内")) == 1,
          (brief(r), r.errors))
    r = prd(("02.md", head + "### ED-01 a\n" + ok + "### ED-02 b\n- 优先级：P2 | 目标里程碑：M3\n## 4. 接口\n优先级：P0\n"))
    check("下一个需求结束块；## 之后的优先级字段报错、不归入 ED-02",
          brief(r)["ED-02"][:2] == ("P2", "M3") and errs(r, "优先级不在任何需求块内"), (brief(r), r.errors))
    r = prd(("04.md", "# 非功能\n\n## NF-01 性能\n### 1.1 细则\n- 落点豁免：设计——x\n## NF-02 保真\n- 落点豁免：测试——y\n"))
    check("PRD 04：## NF 块含其 ### 小节，止于下一个 NF", brief(r)["NF-01"][2] == {"设计": "x"}
          and brief(r)["NF-02"][2] == {"测试": "y"} and not r.errors, (brief(r), r.errors))
    # 2 标题行里的优先级不算
    r = prd(("02.md", head + "### ED-02 b（优先级：P0）\n- 优先级：P2 | 目标里程碑：M3\n"))
    check("标题行里的优先级不算，取块内 P2", brief(r)["ED-02"][:2] == ("P2", "M3"), brief(r))
    # 3 表格行：跨域、列表首格、已以标题定义 → 不是定义；行内字段报错且不归入宿主
    r = prd(("02.md", head + "### ED-01 a\n说明\n\n| PS-20 | 新贡献点 | 优先级：P0 |\n|---|---|---|\n"))
    check("跨域表格行的优先级不归入宿主 ED-01（g4 blocker）",
          brief(r)["ED-01"][0] is None and "PS-20" not in r.reqs and errs(r, "表格首格的 PS-20 不是需求定义")
          and errs(r, "也不归入它所在的 ED-01 需求块") and errs(r, "ED-01 没有可解析的优先级"), (brief(r), r.errors))
    r = prd(("02.md", head + "### ED-01 a\n说明\n\n| ED-40、ED-41 | 两条新需求 | 优先级：P0 |\n"))
    check("列表首格的表格行不是定义，字段报错", "ED-40" not in r.reqs and errs(r, "首格是区间或列表")
          and brief(r)["ED-01"][0] is None, (brief(r), r.errors))
    r = prd(("02.md", head + "| ED-01 | a | 优先级：P0 |\n\n### ED-01 a\n- 优先级：P1 | 目标里程碑：M2\n- 落点豁免：测试——x\n"))
    check("已以标题定义的编号写在汇总表里：表格行是引用，带字段报错", brief(r)["ED-01"][:3] == ("P1", "M2", {"测试": "x"})
          and errs(r, "已在 02.md:7 以标题行定义"), (brief(r), r.errors))
    r = prd(("02.md", head + "### ED-01 a\n" + ok + "\n| ED-40 | 表格定义 | 优先级：P0 | 目标里程碑：M4+ |\n"))
    check("本文件功能域的新编号在表格首格：表格行定义", brief(r).get("ED-40", (None,))[:2] == ("P0", "M4+")
          and brief(r)["ED-01"][0] == "P1", (brief(r), r.errors))
    r = prd(("02.md", head + "### ED-01 a\n" + ok + "\n| PS-05 | 依赖 |\n|---|---|\n| ED-01 | 汇总 |\n"))
    check("不带字段的引用行（跨域接口表、汇总表）不报错", not r.errors and set(r.reqs) == {"ED-01"}, (brief(r), r.errors))
    r = prd(("02.md", head + "### ED-01 a\n说明\n\n| PS-20 | 新贡献点 | 优先级 P0 |\n|---|---|---|\n"
                         "| PS-21 | x | **目标里程碑**: M3 |\n| PS-22 | y | 落点豁免: 设计——z |\n"))
    check("引用行里写错的字段（无冒号、半角冒号、加粗）同样报错、不归入宿主",
          brief(r)["ED-01"][:2] == (None, None) and len(errs(r, "不是需求定义")) == 3
          and errs(r, "「优先级」不归入") and errs(r, "「目标里程碑」不归入") and errs(r, "「落点豁免」不归入"),
          (brief(r), r.errors))
    r = prd(("02.md", head + "### ED-01 a\n" + ok + "\n| PS-05 | 依赖 PS-05 的粘贴优先级：先插件后内置 |\n"))
    check("引用行里「粘贴优先级：」这类措辞不算字段", not r.errors, r.errors)
    r = prd(("02.md", head + "### ED-01 a\n说明\n\n编号 | 说明\n---|---\nPS-20 | 优先级：P0\n"))
    check("不以「|」开头的 GFM 表格行：首格是功能域编号的是引用行，字段报错、不归入宿主",
          brief(r)["ED-01"][0] is None and errs(r, "表格行不以「|」开头") and errs(r, "ED-01 没有可解析的优先级"),
          (brief(r), r.errors))
    r = prd(("02.md", head + "### ED-01 a\n" + ok + "\n| ED-40 | 表格定义 | 优先级：P0 | 目标里程碑：M2 | 落点豁免：设计——x |\n"))
    check("表格定义行单元格里的落点豁免不算并报错", brief(r)["ED-40"][:3] == ("P0", "M2", {})
          and errs(r, "写在了表格定义行的单元格里"), (brief(r), r.errors))
    r = prd(("02.md", head + "### ED-01 a\n" + ok + "\n| MT-01 | 指标 |\n"))
    check("非功能域编号开头的表格行不是引用行、不报错", not r.errors, r.errors)
    # 4 行内注释、围栏
    r = prd(("02.md", head + "### ED-01 a\n" + ok + "说明 <!-- 注释\n### ED-02 b\n- 优先级：P1 | 目标里程碑：M2\n-->\n"))
    check("行内注释遇到标题即止，ED-02 照常定义", "ED-02" in r.reqs, (brief(r), r.errors))
    r = prd(("02.md", head + "### ED-01 a\n" + ok + "```\n### ED-03 c\n```\n<!--\n### ED-04 d\n-->\n"))
    check("围栏与注释块里的标题不算", set(r.reqs) == {"ED-01"}, brief(r))
    # 5 已删除
    r = prd(("02.md", head + "### ED-07 旧功能（已删除，2026-10-01 并入 ED-02）\n说明\n"
                         "### ED-08 回收站（已删除、已归档文档的恢复）\n" + ok))
    check("已删除只认标题末尾括注", r.reqs["ED-07"]["deleted"] and not r.reqs["ED-08"]["deleted"] and not r.errors,
          (brief(r), r.errors))
    r = prd(("02.md", head + "### ED-09 旧需求（已删除）\n" + ok))
    check("标注已删除而块内有优先级：报错、按未删除处理", not r.reqs["ED-09"]["deleted"] and errs(r, "已删除"), r.errors)
    # 6 豁免
    for reason, good in (("纯服务端", True), ("​", False), ("­", False), ("<理由>", False), ("无", False),
                         ("  ", False)):
        r = prd(("02.md", head + "### ED-01 a\n" + ok + "- 落点豁免：设计——%s\n" % reason))
        check("豁免理由「%r」%s" % (reason, "有效" if good else "无效"),
              ("设计" in r.reqs["ED-01"]["exemptions"]) == good and bool(errs(r, "落点豁免格式不合法")) != good,
              (brief(r), r.errors))
    r = prd(("02.md", head + "### ED-01 a\n" + ok + "-落点豁免：设计——x\n"))
    check("「-落点豁免」（短横后无空格）报格式错误", not r.reqs["ED-01"]["exemptions"] and errs(r, "落点豁免格式不合法"),
          r.errors)
    # 7 优先级、里程碑格式
    r = prd(("02.md", head + "### ED-01 a\n- 优先级: P1 | 目标里程碑: M2\n"))
    check("半角冒号的优先级与里程碑都报错", errs(r, "优先级写法不合规范") and errs(r, "目标里程碑写法不合规范")
          and errs(r, "没有可解析的优先级") and errs(r, "没有可解析的目标里程碑"), r.errors)
    r = prd(("02.md", head + "### ED-01 a\n- 优先级：P1 | 目标里程碑：M2（内部）/ M4（公开）\n"))
    check("多个里程碑取第一个", brief(r)["ED-01"][1] == "M2" and not r.errors, (brief(r), r.errors))
    # 8 重复定义、空文件、编号数字只认半角
    r = prd(("02.md", head + "### ED-01 a\n" + ok + "### ED-01 again\n- 优先级：P0 | 目标里程碑：M1\n"))
    check("重复定义以首次为准并报错", brief(r)["ED-01"][0] == "P1" and errs(r, "重复定义"), r.errors)
    r = prd(("02.md", head + "### ED-01 a\n" + ok), ("03.md", ""))
    check("空的 PRD 03 文件报错", errs(r, "本文件没有解析到任何需求"), r.errors)
    r = prd(("02.md", head + "### ED-０９ a\n" + ok))
    check("全角数字不成为需求并报格式错误", "ED-09" not in r.reqs and errs(r, "像需求定义但格式不合规"), r.errors)
    r = prd(("02.md", (head + "### ED-01 a\n" + ok).replace("\n", "\r")))
    check("CR 换行按行结束处理", "ED-01" in r.reqs and r.reqs["ED-01"]["line"] == 5, brief(r))
    r = prd(("04.md", "# 非功能\n\n## NF-01 性能\n\n### 1.1 细则\n- 落点豁免：设计——x\n"))
    check("PRD 04 的 ## NF 块包含其 ### 小节，NF 不要求优先级", brief(r)["NF-01"] == (None, None, {"设计": "x"}, False, "04.md:3")
          and not r.errors, (brief(r), r.errors))

    # 9 引用识别
    def kinds(line, caps=(), ev=frozenset()):
        return [(rid, k) for rid, _, _, k in classify_refs(line, caps, ev)]

    check("PRD 字样、列表续项", kinds("PRD CO-01 / CO-05、CO-08 与 ED-05") ==
          [("CO-01", "prd"), ("CO-05", "prd"), ("CO-08", "prd"), ("ED-05", "prd")], kinds("PRD CO-01 / CO-05、CO-08 与 ED-05"))
    check("rulings §4.18 的 CO 不算、带 PRD 也不算", kinds("rulings §4.18 CO-16；PRD 4.18/CO-17") ==
          [("CO-16", "co-ruling"), ("CO-17", "co-ruling")], kinds("rulings §4.18 CO-16；PRD 4.18/CO-17"))
    check("不带 PRD 的 CO 记 co-bare", kinds("见 CO-12/ADR-0034") == [("CO-12", "co-bare")])
    check("10-prd 链接与路径", kinds("[CO-15](../10-prd/03-features/03-collaboration.md)、`10-prd/03-features/x.md` CO-16")
          == [("CO-15", "prd"), ("CO-16", "prd")])
    check("证据链只排除证据清单里的编号", kinds("证据 TS-01、PS-02；验收证据：OF-01", ev={"PS-02", "TS-01"}) ==
          [("TS-01", "evidence"), ("PS-02", "evidence"), ("OF-01", "prd")])
    items, _ = scan_markdown("| id | 能力 | 需求 |\n|---|---|---|\n| ML-07 | x | ML-01 |\n续行 ML-08\n| ML-09 | y | PRD ML-02 |\n")
    caps = capability_spans(items)
    got = [(rid, k) for no, t, _, _ in items for rid, _, _, k in classify_refs(t, caps.get(no, ()))]
    check("能力表首列（含 GFM 续行）是能力 id，其余列照算", got == [("ML-07", "own"), ("ML-01", "prd"), ("ML-08", "own"),
                                                           ("ML-09", "own"), ("ML-02", "prd")], got)
    check("lo/hi 只限定产出，PRD 字样可在 lo 之前",
          [(r, k) for r, _, _, k in classify_refs("PRD 新增：CO-20", lo=7)] == [("CO-20", "prd")])
    items, _ = scan_markdown("> 状态：草稿 ED-01\n正文 ED-02 <!-- ED-03 -->\n```ts\nreq: ['PRD:ED-04']\n```\n<!--\nED-05\n-->\n")
    got = [(no, t.strip()) for no, t in ref_lines(items) if t.strip()]
    got_f = [(no, t.strip()) for no, t in ref_lines(items, include_fences=True) if t.strip()]
    check("ref_lines：缺省只取正文；include_fences 另取围栏行；注释与状态头行都不取",
          got == [(2, "正文 ED-02")]
          and got_f == [(2, "正文 ED-02"), (3, "```ts"), (4, "req: ['PRD:ED-04']"), (5, "```")], (got, got_f))
    # 10 表格与占位值
    rows = [(1, "| 线 | 文件 |"), (2, "|---|---|"), (3, "| 产品 | a |"), (4, "续行说明"), (5, "| 设计 | b |"), (6, "- 列表"),
            (7, "| x | y |")]
    tabs = list(iter_tables(rows))
    check("GFM：不含竖线的行在表格内算一行，列表项结束表格", len(tabs) == 1 and [c for _, _, c in tabs[0][2]] ==
          [["产品", "a"], ["续行说明"], ["设计", "b"]], tabs)
    check("首尾竖线可省", split_cells("a | b \\| c |") == ["a", "b | c"])
    check("占位值", all(is_placeholder(x) for x in ("", "  ", "​", "<id>", "无", "N/A", "-", "（待定）", "TBD"))
          and not is_placeholder("张三"))
    # 11 长空白行不回溯
    import time
    t0 = time.time()
    for n in (2000, 8000):
        exempt_like(" " * n + "x")
        priority_like(" " * n + "x")
        milestone_like(" " * n + "| " * n + "x")
        HEAD_LIKE_RE.match(" " * n + "x")
    check("长空白行的识别式是线性的（< 0.5 s）", time.time() - t0 < 0.5, time.time() - t0)
    print("prdlib 自测：%d 项，失败 %d 项" % (len(results), results.count(False)))
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(_selftest())
