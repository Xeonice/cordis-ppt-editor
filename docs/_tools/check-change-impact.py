#!/usr/bin/env python3
"""check-change-impact：研发流程门禁 G1–G3（docs/80-process/03 §1、§2；rulings §4.25）。

只用标准库、只读（只调用只读的 git 子命令）。PRD 需求清单、Markdown 正文切分（围栏代码块、HTML 注释）、GFM 表格与需求
编号引用识别都调用共享模块 prdlib.py：与 check-req-coverage.py（G4）、check-doc-refs.py（G5）是同一份实现，规则见
prdlib.py 文件头，本脚本不另写一份。三道门禁共用一份上下文：

  变更 id     依次取 --change、环境变量 CORDEX_CHANGE、环境变量 PR_BODY 首行「Change: <id>」、当前分支名 change/<id>。
              分支名取 git symbolic-ref -q HEAD 中 refs/heads/ 之后的部分（不用 --short：有同名标签或远端引用时它输出
              消歧后的 heads/change/<id>）；HEAD 游离时取 GITHUB_HEAD_REF。没给出 id 的来源跳过：未设置、为空，或
              PR_BODY 首行「Change:」后为空或是占位值（无、N/A、-、none、<id> 一类，按 prdlib.is_placeholder，可带括注，
              如「Change: 无（L0 文档修正）」：只改文档的 L0 PR 不开变更，80/01 §1）。给出的 id 不合法（须为单个
              kebab-case id；「feat-x（文档步）」「feat-x, other」都不合法）时记为问题并顺延到下一个来源；第一个给出合法 id
              的来源说了算，其后的来源不再看，只是 PR 正文首行与分支名都给出合法 id 且不同时另记一条问题（一个 PR 只关联
              一个变更）。这些问题 G1 触发时由 G1 报（记在首个代码路径上），G3 总是报（记在来源上：CORDEX_CHANGE:1、
              PR_BODY:1、HEAD:1 或 GITHUB_HEAD_REF:1），所以写错的来源不会让只改文档的分支静默通过；G3 照常核对顺延
              得到的变更。
  本分支改动  git merge-base <base> HEAD 之后的提交 + 工作区改动（暂存与未暂存）+ 未跟踪文件（80/03 §2.3）；
              --base 缺省 origin/main，不存在时退到 main，都不存在时报错、退出码 2。
  代码路径    80/03 §2.1：packages/**、apps/**、tooling/**、.github/**、openspec/schemas/**，以及仓库根的
              package.json、pnpm-workspace.yaml、pnpm-lock.yaml、tsconfig*.json、lefthook.yml、.node-version。
  变更目录    openspec/changes/<id>/ 须存在且大小写精确（macOS 默认不区分大小写，CI 区分）；proposal.md、
              docs-sync.md、.openspec.yaml 同样按精确大小写查找。

G1 关联变更（--gate link）：本分支改动触及代码路径时，必须关联到变更 id，且 openspec/changes/<id>/ 存在、
   未归档；变更来源有问题（见上）也失败。未触及代码路径记「不触发」。
G2 评审门（--gate review）：触发条件同 G1。proposal 的级别行「级别：L0」「级别：L1」或「级别：L2」：L2 要求
   docs-sync「## 评审」下的评审行恰好是「评审：已确认 | 确认人：<名> | 日期：YYYY-MM-DD」；L1 要求恰好是
   「评审：L1 自审 | 理由：<…>」；L0 改代码直接失败。缺级别行、级别行写了多个级别（「L1/L2」「L1 或 L2」、
   照抄的「L0|L1|L2」；括注里的不算）或级别不在 L0–L2 之内、几行级别互相矛盾、评审行多于一行、「## 评审」节
   重复（见 G3 第 7 条）都失败。
   评审行是「## 评审」下键为「评审」的行；键带括注的（「评审（L2）：」）也是评审行，但格式不对、不算确认；没有
   这两种行时，键以「评审」开头且值像评审状态的行（「评审结论：已确认 | …」）按键写错报出；「评审意见：」
   「评审人：」「评审页：」等其他行是说明，不参与判定。
   评审行严格按格式核对（80/03 §2.2）：状态恰好是「已确认」或「L1 自审」，不带括注、不带其他文字；字段恰好是
   「确认人」「日期」（已确认）或「理由」（L1 自审），按此顺序、各一次，多出的字段（「备注：…」「范围：…」）不算；
   确认人不能为空、占位值或带括注；日期恰好是有效的 YYYY-MM-DD，其后不带括注；「已确认」的行里任何位置出现
   「部分」或「待定」「未确认」等未定字样都不算确认（「已确认（部分）」「已确认（有条件，待补测试）」都不算）。
   说明另起一行写在本节里。L1 的理由是自由文字，不查这些字样。评审状态是「待确认」一类（可带括注）时按未确认处理。
G3 矩阵核对（--gate impact）：只要关联到变更就运行（含只改文档的文档步）。
   1. proposal「## 文档影响矩阵」节内恰好一张表（列「线」「表态」）：多于一张（照抄的示例表、修订前的旧表）判失败，
      不猜哪张算数；表恰好 6 行，线名为产品、设计、前端、后端、测试、其他；表态只能是「需更新」或「不涉及：<理由>」
      （理由不能为空，也不能是占位值，见下）。矩阵只认该节内（80/02 §4）：节外标题含「文档影响矩阵」的节（任意
      级别）与节外表头含「线」「表态」列的表判格式错误；节外的矩阵不核对，以节内那张为准（修订就地改表）。
   2. 「需更新」行在 docs-sync「## 回写记录」表（列「线」「文件」）至少有一条同线记录，同线记录里至少一个
      路径落在该线目录：
        产品 docs/10-prd/   设计 docs/20-design/   前端 docs/50-frontend/   后端 docs/60-backend/
        测试 docs/70-testing/   其他 docs/00-charter/、docs/30-architecture/、docs/40-modules/、
        docs/80-process/、docs/_tools/、docs/README.md、openspec/、CLAUDE.md
      节内所有表都算回写记录表（分轮追加的第二张表、### 小标题下的表也核对、也参与重叠）；表头缺「线」或
      「文件」列的表报错。回写记录只认「## 回写记录」节内（80/02 §4）：节外标题含「回写记录」的节（任意级别，
      如追加在文件末尾、落进「## 偏差记录」的「### 回写记录（第二轮）」，另起的「## 补充回写记录」），以及节外
      表头含「线」「文件」列的表，都判格式错误；这些标题下的表（到下一个级别不低于它的标题为止，一级标题到下一个
      一、二级标题为止）与节外的这类表照样按回写记录核对、参与重叠，不会被静默丢掉（与第 7 条节重复同一做法）。
      文件列可列多个路径（以「、」「,」「，」分隔，也认「；」与 <br>；可带反引号，路径
      后可带括注如「（新建）」；目录写作 `dir/`）；写成链接时取链接目标（按 docs-sync 所在目录解析，以 / 开头
      的按仓库根），目标不存在而链接文字是存在的完整路径时取文字。列出的每个路径都必须是相对仓库根的完整
      路径、存在（大小写精确）且属于本分支改动（目录：其下有文件改动）。
   3. 新增功能。新增编号 = proposal「## 需求编号」声明的新增编号 ∪ PRD 在本分支新增的编号（merge-base 与
      工作区两份 PRD 的编号集合之差；基点上解析不到任何需求时不比对，在摘要注明）。
      声明的识别：「新增」作标签——后接冒号（「新增：」「新增需求：」「**新增**：」，半角冒号也算）或直接后接
      编号（「新增 AS-09」）——可在行中任意位置（「修改：AS-01；新增：AS-09」），取到下一个标签（修改、实现、
      删除、涉及、依赖、见等）或句号为止；「新增：」后为空或写「见下」时取其后的列表或段落；「### 新增」
      小标题取到下一个同级标题；表格中某格为「新增」时取同一行的其他格，表头某列为「新增」时取该列。
      括注（「（…）」「(…)」）里的编号不算（括注里只写「无」的按「无」算）；区间「ED-97…ED-99」「ED-97–ED-99」
      逐个展开，无法展开的报格式错误（两端的编号照常算作声明）；紧跟在「不」「无」「未」「非」「没」之后的
      「新增」不算标签，「新增 AS-09 的验收标准」（给已有需求加内容）也不算声明。
      判失败：声明的编号在 PRD 中找不到（80/01 §3：先在 PRD 定编号）；PRD 在本分支新增了编号而 proposal 没有
      声明。「新增」标签后取不到编号（「新增：待定」）不判失败——规格只在声明了编号时核对强制行——只在摘要
      注明未据此核对；PRD 一旦写进新编号，由上面的比对兜底。
      有新增编号时：产品、测试必须需更新；设计必须需更新，除非这些编号在 PRD 中都写了
      「- 落点豁免：设计——<理由>」；前端、后端至少一行需更新（80/02 §4）。
   4. 重叠：其他进行中变更（openspec/changes/* 除 archive 与自身）的回写记录与本变更声明了同一文件（目录按
      包含关系算）时，创建较晚者的 proposal 必须有「依赖：<另一 id>」（80/01 §7）。先后按 .openspec.yaml 的
      created：两边都写了时刻（如 2026-10-04T09:30:00Z；不带时区按 UTC）时比时刻，否则只比日期；相同则按 id
      字母序，靠后者算较晚。有重叠而本变更的 created 缺失或无效时判失败；对方的 created 缺失或无效时按对方
      较晚处理；本变更较早时只在摘要里提示，由对方声明。对方写在「## 回写记录」节外的回写记录（第 2 条）同样
      计入，只在摘要「注：」里写明。对方有 docs-sync 却读不出回写记录（不是 UTF-8，或节内节外都没有含「线」「文件」
      列的回写记录表：缺节、缺表或缺列；有一张表缺列时其余表照常核对）时无法核对，判失败（修好对方的 docs-sync，
      或声明依赖）。对方回写记录里以 / 开头的裸路径按仓库根解析，含通配符（* ? [）的路径按 fnmatch 比较：这两种
      写法在对方自己的 G3 里会失败，但重叠检查不能因此看不见。只扫描当前检出里的变更目录。
   5. 设计质量门：设计行需更新、docs-sync「## 设计质量门」不是「不触发」、且评审行为「评审：已确认…」时，
      该节必须含样张路由（含 #/）、至少一个存在的截图路径、Q1–Q10 全部出现，以及
      「拍板：已确认 | 日期：YYYY-MM-DD」（80/01 §4）。该节只有一行「不触发」「不触发（理由）」「不触发：理由」
      时才算不触发（「不触发的条件……」不算）；写了「不触发」又有其他内容判失败，并照常核对质量门。拍板行
      只能有一行，严格按格式核对：状态恰好是「已确认」、不带括注；字段只有「日期」一个（确认人、范围等字段不算）；
      日期恰好是有效的 YYYY-MM-DD，其后不带括注；行里任何位置出现「部分」或「待定」「未确认」等字样都不算拍板
      （「拍板：已确认（整体方向；强调色另议） | …」不算）。键带括注的（「拍板（用户）：」）也是拍板行、报格式错误；
      「拍板人：」这类其他行是说明。说明另起一行写在本节里。
      截图路径相对变更目录或仓库根，须落在本变更目录或 docs/20-design/ 内、存在且大小写精确，是图片文件或
      直接含图片的目录（不递归，不认 node_modules、dist 与隐藏目录）。
   6. 只改文档时 G2 不触发：「## 评审」里写错格式的评审行（键写错或带括注、状态不合法、字段多了或少了、缺确认人
      或日期、L1 缺理由、多于一行）由 G3 报出，免得设计质量门被静默跳过；设计行需更新时缺评审节或评审行也报。
   7. 节重复：docs-sync 的模板节（回写记录、检查结果、设计质量门、评审、偏差记录）与 proposal 的机读节（需求编号、
      文档影响矩阵）各只能有一个；同名或带后缀的二级标题（「## 回写记录（第二轮）」）出现第二次即判格式错误（G2
      触发时「## 评审」的重复由 G2 报）。核对时同名节的内容按出现顺序合并，所以重复节里的回写记录照样核对、参与
      重叠，不会被静默丢掉；读取其他进行中变更的 docs-sync 时也按合并处理。分轮追加的内容写进原节（在它的下一个
      二级标题之前另起一张表或用 ### 小标题）：追加在文件末尾的 ### 小标题落在最后一节里，按第 2 条判格式错误。
   proposal 与 docs-sync 的标题、列名按 openspec/schemas/cordex-docs-first/templates/ 的模板解析。
   机读行（级别、依赖、评审、拍板、表态、「不触发」）允许行首列表符与加粗，冒号全角半角都算，竖线可写全角
   「｜」，归一之后再按上面的格式核对。确认人、理由（L1 理由、不涉及理由）为空串、模板占位「<…>」、省略号，或
   「-」「—」「无」「TBD」「待定」「？」「N/A」一类占位值时算没填（prdlib.is_placeholder）。表格按 GFM 识别
   （prdlib.iter_tables）：首尾竖线可省；表格到空行或另一个块级结构（标题、列表项、引用、围栏、分隔线、HTML 块）
   为止，其间不含竖线的行按只有首格的一行计入（GFM 规范例 202），其后的行照常解析、不会被丢掉；单元格少于表头的
   短行按空单元格补齐，多于表头时多出的格按 GFM 忽略（摘要里注明）。围栏代码块与 HTML 注释不参与解析
   （prdlib.scan_markdown，规则见 prdlib.py 文件头「正文切分」）。本变更的 proposal、docs-sync 有未闭合的围栏或
   注释块时判失败（其后内容无法解析）。

需求编号：PRD 需求清单（定义行、需求块、优先级、落点豁免、已删除、重复定义）用 prdlib.load_prd 解析；基点上的 PRD
用 git cat-file 取出后同样交给 prdlib.parse_prd，所以与 G4、G5 的口径逐字一致（就是同一份代码）。G3 只用到其中的
编号、所在文件与行、落点豁免；PRD 的格式错误由 G4 报，本脚本只报读不了的 PRD（不是 UTF-8、无法读取）。proposal
「## 需求编号」里的编号用 prdlib.classify_refs 识别，只去掉 rulings §4.18 的 CO 条目（co-ruling）：该节的编号按模板
都是 PRD 需求编号，所以不带 PRD 字样的 CO 编号（co-bare）也算，「证据」与能力 id 的排除不适用；只认 PRD 的十个
功能域（prdlib.DOMAINS）。

输出：首行是上下文（变更 id 与来源、基点、改动数；变更来源有问题时附注意）；每个门禁一行
「G1 关联变更：通过 / 失败 / 不触发 — 摘要」，失败项逐条「  - <文件>:<行> <原因>」（缺失类问题记在该文件
第 1 行，G1 的失败记在首个代码路径上，变更来源的问题在 G3 记在来源上）；不判失败的提示写在摘要末尾「注：」后。
任一门禁失败退出码 1；不是 git 仓库、基点不存在、求不出 merge-base 等环境错误退出码 2。不是 UTF-8 编码的
文件报「<文件>:<首个坏字节所在行> 不是 UTF-8 编码」、不解析；意外异常报内部错误、退出码 2（--json 时照样输出
JSON 的 error 字段；设环境变量 CORDEX_DEBUG=1 可看 Traceback）。

用法：
  python3 docs/_tools/check-change-impact.py [--gate link|review|impact|all] [--change <id>] [--base <ref>] [--json]
  python3 docs/_tools/check-change-impact.py --list-reqs   # 打印 prdlib 解析出的 PRD 需求（JSON，每条与
                                                         # check-req-coverage --json 的 requirements 同一结构）与
                                                         # PRD 格式错误；有错误时退出码 1
CI 中 --base 取 PR 目标分支（如 origin/main），需要它可达（浅克隆先 git fetch）。
"""
import datetime
import fnmatch
import json
import os
import posixpath
import re
import subprocess
import sys
import traceback
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:                 # 以模块方式加载（importlib、别的目录下运行）时也找得到同目录的 prdlib
    sys.path.insert(0, HERE)
import prdlib  # noqa: E402

DOCS = os.path.normpath(os.environ.get("CORDEX_DOCS_ROOT") or os.path.join(HERE, ".."))
REPO = os.path.dirname(DOCS)
CHANGES = "openspec/changes"
ARCHIVE = "archive"
TOOL = "check-change-impact"

GATES = OrderedDict([("link", ("G1", "关联变更")), ("review", ("G2", "评审门")), ("impact", ("G3", "矩阵核对"))])
STATUS_TEXT = {"pass": "通过", "fail": "失败", "skip": "不触发"}

# 80/03 §2.1 代码路径
CODE_DIRS = ("packages/", "apps/", "tooling/", ".github/", "openspec/schemas/")
CODE_ROOT_FILES = ("package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml", "lefthook.yml", ".node-version")
CODE_ROOT_TSCONFIG = re.compile(r"^tsconfig[^/]*\.json$")

# 80/02 §4 影响矩阵的 6 条线与各线目录
MATRIX_LINES = ("产品", "设计", "前端", "后端", "测试", "其他")
LINE_DIRS = OrderedDict([
    ("产品", ("docs/10-prd/",)),
    ("设计", ("docs/20-design/",)),
    ("前端", ("docs/50-frontend/",)),
    ("后端", ("docs/60-backend/",)),
    ("测试", ("docs/70-testing/",)),
    ("其他", ("docs/00-charter/", "docs/30-architecture/", "docs/40-modules/", "docs/80-process/",
             "docs/_tools/", "docs/README.md", "openspec/", "CLAUDE.md")),
])
SHOT_SKIP_DIRS = ("node_modules", "dist")
IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif")

CHANGE_ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
# 节标题（任意级别的 ATX 标题；PRD 的需求标题由 prdlib 识别）
HEADING_RE = re.compile(r"^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$")
LIST_MARK_RE = re.compile(r"^(?:[-*+]|\d{1,3}[.)])[ \t]+")
# 「已确认」的评审行、拍板行里出现这些字样时不算确认（「已确认 | 确认人：部分成员 | …」「拍板：已确认（强调色待定）」）
PENDING_WORDS = ("待定", "未定", "待确认", "未确认", "待评审", "未评审", "评审中", "待拍板", "未拍板")
UNSETTLED_WORDS = ("部分",) + PENDING_WORDS
# 评审行、拍板行的状态与字段值里不能出现的括号（带括注即不算确认）
BRACKET_CHARS = "（）()【】[]〔〕"
CJK_COLON_RE = re.compile(r"(?<=[\u3400-\u9fff])[ \t]*[:：][ \t]*")
NOTE_TAIL_RE = re.compile(r"[ \t]*[（(].*$")
PAREN_RE = re.compile(r"[（(][^（）()]*[）)]")
URL_RE = re.compile(r"^[A-Za-z][\w+.-]*:")

# 机读行（先经 canon 归一）
LEVEL_KEY_RE = re.compile(r"^级别：[ \t]*(.*)$")
LEVEL_TOKEN_RE = re.compile(r"(?<![0-9A-Za-z])L[0-9]+(?![0-9A-Za-z])")
LEVELS = ("L0", "L1", "L2")
DEPENDS_RE = re.compile(r"^依赖：[ \t]*(.*)$")
DEPEND_ID_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*")
REVIEW_KEY_RE = re.compile(r"^(评审[^：|]{0,8})：[ \t]*(.*)$")
DECIDE_KEY_RE = re.compile(r"^(拍板[^：|]{0,8})：[ \t]*(.*)$")
REVIEW_FORM = "「评审：已确认 | 确认人：<名> | 日期：YYYY-MM-DD」"
L1_FORM = "「评审：L1 自审 | 理由：<…>」"
DECIDE_FORM = "「拍板：已确认 | 日期：YYYY-MM-DD」"
L1_STATUS_RE = re.compile(r"^L1[ \t]*自审$")
NOT_TRIGGERED_RE = re.compile(r"^不触发(?:$|[（(：:—–，,。；;、 \t])")
PENDING_STATES = ("待确认", "未确认", "待评审", "未评审", "评审中", "待定")
CREATED_LINE_RE = re.compile(r"^created:[ \t]*(.*?)[ \t]*$", re.M)
CREATED_VALUE_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})(?:(?:[Tt]|[ \t]+)(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?"
                              r"[ \t]*(?:([Zz])|([+-])(\d{1,2})(?::?(\d{2}))?)?)?$")

# 回写记录的文件列
PATH_SPLIT_RE = re.compile(r"[、,，；;]|<br\s*/?>", re.I)
LINK_RE = re.compile(r"^!?\[([^\]]*)\]\(\s*<?([^)>\s]*)>?(?:\s+[\"'][^\"']*[\"'])?\s*\)$")
GLOB_RE = re.compile(r"[*?\[]")

# 只能出现一次的二级节（80/03 §2.2 与模板）：docs-sync 的模板节、proposal 的机读节
RECORD_TITLE = "回写记录"
MATRIX_TITLE = "文档影响矩阵"
SYNC_SECTIONS = (RECORD_TITLE, "检查结果", "设计质量门", "评审", "偏差记录")
PROPOSAL_SECTIONS = ("需求编号", MATRIX_TITLE)
# 分轮追加回写记录的正确写法（节重复、节外回写记录的报错共用）
RECORD_APPEND_HINT = "分轮追加的内容写进原节：在它的下一个二级标题之前另起一张表或用 ### 小标题"


class EnvError(Exception):
    """环境错误（不是 git 仓库、基点不存在等）：退出码 2。"""


class UsageError(Exception):
    """命令行用法错误：退出码 2。"""


# ------------------------------------------------------------------ 通用
def rel(path):
    return os.path.relpath(path, REPO).replace(os.sep, "/")


def decode_doc(data):
    """bytes → (文本 或 None, (行号, 原因) 或 None)。去掉开头的 BOM（prdlib.decode_text）；不是 UTF-8 时不解析，问题记在
    首个坏字节所在行（换行按 CommonMark，与 prdlib 同一口径）：门禁读的是机读行，替换字符会造成误判。"""
    try:
        data.decode("utf-8")
    except UnicodeDecodeError as exc:
        line = len(prdlib.LINE_SPLIT_RE.split(data[:exc.start].decode("utf-8", "replace")))
        return None, (line, "不是 UTF-8 编码（第 %d 个字节起无法解码），无法解析" % (exc.start + 1))
    return prdlib.decode_text(data)[0], None


def read_doc_text(path):
    """读文件 → decode_doc 的结果；读不了抛 OSError。"""
    with open(path, "rb") as fh:
        return decode_doc(fh.read())


def unsettled_word(text):
    """text 里第一个「部分」或表示未定的字样（「待定」「未确认」等），没有返回 None。"""
    return next((w for w in UNSETTLED_WORDS if w in text), None)


def has_bracket(text):
    return any(c in BRACKET_CHARS for c in text)


def valid_date(text):
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", text):
        return False
    try:
        datetime.date(int(text[:4]), int(text[5:7]), int(text[8:10]))
    except ValueError:
        return False
    return True


def strip_note(text):
    """去掉末尾的括注：「2026-10-04（补记）」→「2026-10-04」。"""
    return NOTE_TAIL_RE.sub("", text).strip()


def exists_exact(path):
    """路径存在且逐段大小写精确（macOS 默认不区分大小写，GitHub 区分），与 check-links.py 同一做法。"""
    path = os.path.normpath(path)
    if not os.path.exists(path):
        return False
    cur = REPO
    for part in os.path.relpath(path, REPO).split(os.sep):
        if part in ("", "."):
            continue
        try:
            if part not in os.listdir(cur):
                return False
        except OSError:
            return False
        cur = os.path.join(cur, part)
    return True


def canon(text):
    """机读行归一：去行首列表符、加粗与整行反引号，全角竖线「｜」改「|」，中文后的冒号（全角或半角，
    前后可有空格）统一为「：」。"""
    s = LIST_MARK_RE.sub("", text.strip(), count=1)
    s = s.replace("**", "").replace("__", "").strip()
    if len(s) > 2 and s.startswith("`") and s.endswith("`") and s.count("`") == 2:
        s = s[1:-1].strip()
    s = s.replace("｜", "|")
    return CJK_COLON_RE.sub("：", s)


def parse_confirm(value, keys):
    """评审行、拍板行的值（已经 canon 归一）按「状态 | 键：值 | 键：值」拆开：返回 (状态, 字段 OrderedDict（只收 keys
    里的键、取首次出现的值）, 字段名序列（没有冒号的段记原文；空段忽略）)。
    「已确认 | 确认人：张三 | 日期：2026-10-04」→ ("已确认", {确认人: 张三, 日期: 2026-10-04}, [确认人, 日期])。"""
    parts = [p.strip() for p in value.split("|")]
    fields, names = OrderedDict(), []
    for p in parts[1:]:
        if not p:
            continue
        key, sep, val = p.partition("：")
        name = key.strip() if sep else p
        names.append(name)
        if sep and name in keys and name not in fields:
            fields[name] = val.strip()
    return parts[0], fields, names


def shape_problems(what, names, keys, forms):
    """机读行的字段名序列 names 与规定的 keys（各一次、按此顺序，80/03 §2.2 的固定格式）的出入：返回原因列表。
    forms 为 {键: 写法}，用于「缺」的提示。"""
    out = ["%s缺「%s」" % (what, forms[k]) for k in keys if k not in names]
    extra = [n for n in names if n not in keys]
    if extra:
        out.append("%s多了%s：只能有%s%s，说明另起一行写" % (
            what, "、".join("「%s」" % n for n in extra), "、".join("「%s」" % k for k in keys),
            "两个字段" if len(keys) == 2 else "一个字段" if len(keys) == 1 else "这些字段"))
    dups = [k for k in keys if names.count(k) > 1]
    if dups:
        out.append("%s的%s写了不止一次" % (what, "、".join("「%s」" % k for k in dups)))
    present = [n for n in names if n in keys]
    if not dups and len(present) == len(keys) and present != list(keys):
        out.append("%s的字段顺序应为「%s」" % (what, " | ".join(keys)))
    return out


def strip_parens(text):
    """去掉括注（「（…）」「(…)」，可嵌套）；括注里只写「无」一类的保留其文字（「新增：（无）」）。"""
    def repl(m):
        inner = m.group(0)[1:-1].strip()
        return " %s " % inner if inner.lower() in NONE_VALUES else " "
    prev = None
    while prev != text:
        prev, text = text, PAREN_RE.sub(repl, text)
    return text


# ------------------------------------------------------------------ Markdown（正文切分与表格识别用 prdlib）
class Doc(object):
    """一份 Markdown：prdlib.scan_markdown 去掉 HTML 注释（保留行号）与围栏代码块后的 (行号, 文本) 列表。
    error 为读取问题（不是 UTF-8 时不解析），error_line 为其所在行；unclosed 为未闭合的围栏或注释块 (起始行号, 种类)。
    存在与否按精确大小写判断（macOS 默认不区分大小写，CI 区分）。"""

    def __init__(self, relpath):
        self.rel = relpath
        self.path = os.path.join(REPO, relpath)
        self.exists = os.path.isfile(self.path) and exists_exact(self.path)
        self.lines, self.error, self.error_line, self.unclosed = [], None, 1, None
        if not self.exists:
            return
        try:
            text, problem = read_doc_text(self.path)
        except OSError as exc:
            self.error = "无法读取（%s）" % (exc.strerror or exc)
            return
        if problem:
            self.error_line, self.error = problem
            return
        items, self.unclosed = prdlib.scan_markdown(text)
        self.lines = [(it[0], it[1]) for it in items if not it[2]]

    def readable(self):
        return self.exists and self.error is None

    def sections(self, title):
        """标题与 title 相符的全部二级节：[(标题行号, [(行号, 文本)])]，每节到下一个一、二级标题之前。"""
        out, cur = [], None
        for no, text in self.lines:
            m = HEADING_RE.match(text)
            if m and len(m.group(1)) <= 2:
                cur = None
                if len(m.group(1)) == 2 and title_matches(m.group(2), title):
                    cur = (no, [])
                    out.append(cur)
                continue
            if cur is not None:
                cur[1].append((no, text))
        return out

    def section(self, title):
        """二级节 title：返回 (首个标题行号, [(行号, 文本)]) 或 None。同名或带后缀的节（「回写记录（第二轮）」）出现多次时，
        正文按出现顺序合并（节与节之间行号不相连，表格不会跨节拼接），不丢内容；重复本身由 duplicate_sections 报格式错误。"""
        found = self.sections(title)
        if not found:
            return None
        return found[0][0], [row for _, body in found for row in body]


def title_matches(heading, title):
    heading = heading.replace("**", "").strip()
    return heading == title or (heading.startswith(title) and heading[len(title)] in " （(：:—-")


def duplicate_sections(doc, titles):
    """doc 里重复出现的二级节：[(文件, 行, 原因)]，每个重复的标题行一条。"""
    out = []
    for title in titles:
        found = doc.sections(title)
        for no, _ in found[1:]:
            out.append((doc.rel, no, "「## %s」节重复（第 %d 行已有同名节）：每节只能有一个，同名或带后缀的标题（如「## %s"
                                     "（第二轮）」）都算重复；%s（追加在文件末尾的 ### 小标题落在最后一节里，"
                                     "同样不算）。本次按同名节合并核对" % (title, found[0][0], title, RECORD_APPEND_HINT)))
    return out


def heading_text(title):
    """标题文字去掉加粗、下划线强调与反引号（判断标题是否含节名、报错时显示用）。"""
    return title.replace("**", "").replace("__", "").replace("`", "").strip()


def outside_layout(doc, title_want):
    """二级节 title_want 之外、却像是该节内容的位置（80/02 §4：回写记录只写在 docs-sync「## 回写记录」节内，影响矩阵只写在
    proposal「## 文档影响矩阵」节内）。节的切分与 Doc.sections 相同：二级节到下一个一、二级标题为止。
    返回 (heads, blocks, loose, where_of)：
      heads    [(行号, 标题, 位置)]：标题含 title_want 却不在该节内的标题，任意级别（二级标题同名或带后缀的「## 回写记录
               （第二轮）」就是该节，按节重复另报）；
      blocks   OrderedDict 标题行号 → 正文 [(行号, 文本)]：这些标题下的内容，到下一个级别不低于它的标题为止（一级标题到
               下一个一、二级标题为止）；嵌在其中的同类标题并入外层；
      loose    [(行号, 文本)]：既不在该节内、也不在 blocks 里的行（调用方在其中找表头像该节表格的表，如含「线」「文件」
               列的回写记录表）；
      where_of {行号: 位置}：loose 各行所在的位置，报错时用。"""
    def place(parent):
        if parent is None:
            return "位于文件开头、第一个标题之前"
        return ("位于「## %s」节内" if parent[0] == 2 else "位于「# %s」之下、第一个二级标题之前") % parent[1]

    heads, blocks, loose, where_of = [], OrderedDict(), [], {}
    in_sec, block, parent = False, None, None
    for no, text in doc.lines:
        m = HEADING_RE.match(text)
        if m:
            level, title = len(m.group(1)), m.group(2)
            shown = heading_text(title)
            if level <= 2:
                in_sec = level == 2 and title_matches(title, title_want)
                parent = (level, shown)
            if block is not None and level <= max(block[1], 2):
                block = None
            if not in_sec and title_want in shown:
                where = "是一级标题" if level == 1 else "是另起的二级节" if level == 2 else place(parent)
                heads.append((no, "%s %s" % ("#" * level, shown), where))
                if block is None:
                    block = (no, level)
                    blocks[no] = []
            continue
        if in_sec:
            continue
        if block is not None:
            blocks[block[0]].append((no, text))
        else:
            loose.append((no, text))
            where_of[no] = place(parent)
    return heads, blocks, loose, where_of


def unclosed_reason(doc):
    no, kind = doc.unclosed
    close = "闭合的 ``` 或 ~~~" if kind == prdlib.UNCLOSED_KINDS[0] else "「-->」"
    return "%s从这一行起没有闭合，其后内容都无法解析（补上%s）" % (kind, close)


# ------------------------------------------------------------------ 表格（GFM，prdlib.iter_tables）
def tables(rows):
    """rows 为 [(行号, 文本)]：返回 [(表头下标, 表头单元格, [(行下标, 行号, 单元格)])]。按 GFM 识别（prdlib.iter_tables）：
    首尾竖线可省；表格到空行或另一个块级结构（标题、列表项、引用、围栏、分隔线、HTML 块）为止，其间不含竖线的行按
    只有首格的一行计入，其后的行照常解析。"""
    return list(prdlib.iter_tables(rows))


def fit_row(cells, ncols):
    """GFM：单元格少于表头时补空单元格，多于表头时多出的格忽略。返回 (单元格, 多出的个数)。"""
    if len(cells) < ncols:
        return cells + [""] * (ncols - len(cells)), 0
    return cells[:ncols], len(cells) - ncols


def column_index(header, name):
    names = [canon(h) for h in header]
    return names.index(name) if name in names else None


def extra_cells_note(file, line, extra, ncols):
    return "%s:%d 单元格多于表头的 %d 列，多出的 %d 格按 GFM 忽略（单元格里的竖线写作 \\|）" % (file, line, ncols, extra)


# ------------------------------------------------------------------ PRD 需求清单与需求编号引用（prdlib）
# 工作区的 PRD 由 prdlib.load_prd 解析（见 Context.prd）；规则只在 prdlib 里实现，与 G4、G5 同一份代码。
def load_prd_at(commit):
    """基点 commit 上的 PRD：用 git 取出 PRD 03、04 的文本，交给 prdlib.parse_prd（与工作区、G4、G5 同一份代码）。
    返回 (prdlib.PrdResult 或 None, 问题[(文件, 行, 原因)], 注记列表)。读不出的文件记为问题；不是 UTF-8 的按替换字符
    解析，只在注记里写明（基点上的编码问题在本分支修不了，不因此判失败）。"""
    docs_rel = rel(DOCS)
    feat = posixpath.join(docs_rel, *prdlib.FEATURES_REL.split(os.sep))
    nfr = posixpath.join(docs_rel, *prdlib.NFR_REL.split(os.sep))
    rc, out, err = git("ls-tree", "-r", "-z", "--name-only", commit, "--", feat, nfr)
    if rc != 0:
        return None, [(feat, 1, "无法列出基点 %s 上的 PRD 文件：%s" % (commit[:7], err))], []
    names = z_list(out)
    files = [(n, prdlib.FEATURE_DOMAINS) for n in sorted(names) if posixpath.dirname(n) == feat and n.endswith(".md")]
    if nfr in names:
        files.append((nfr, prdlib.NFR_DOMAINS))
    sources, problems, notes = [], [], []
    for path, domains in files:
        rc, data, err = git_raw("cat-file", "blob", "%s:%s" % (commit, path))
        if rc != 0:
            problems.append((path, 1, "无法读取基点 %s 上的这份 PRD：%s" % (commit[:7], err)))
            continue
        text, problem = prdlib.decode_text(data)
        if problem:
            notes.append("基点 %s 上的 %s 第 %d 行起不是 UTF-8，按替换字符比对" % (commit[:7], path, problem[0]))
        sources.append((path, text, domains))
    return prdlib.parse_prd(sources), problems, notes


def find_req_refs(text):
    """「## 需求编号」里的 PRD 需求编号：[(编号, 起点)]。按 prdlib.classify_refs 归类，只去掉 rulings §4.18 的 CO 条目
    （co-ruling）：该节的编号按模板都是 PRD 需求编号，所以不带 PRD 字样的 CO（co-bare）也算；只认 PRD 的十个功能域。"""
    return [(rid, start) for rid, start, _, kind in prdlib.classify_refs(text)
            if kind in ("prd", "co-bare") and prdlib.domain_of(rid) in prdlib.DOMAINS]


def ruled_starts(text):
    """text 里 rulings §4.18 的 CO 条目（prdlib.classify_refs 归为 co-ruling）的起点集合。"""
    return {start for _, start, _, kind in prdlib.classify_refs(text) if kind == "co-ruling"}


# ------------------------------------------------------------------ git 与上下文
def git_raw(*args):
    env = dict(os.environ, GIT_PAGER="cat", GIT_TERMINAL_PROMPT="0")
    try:
        p = subprocess.run(["git", "-C", REPO] + list(args), stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    except OSError as exc:
        raise EnvError("无法运行 git：%s" % exc)
    return p.returncode, p.stdout, p.stderr.decode("utf-8", "replace").strip()


def git(*args):
    rc, out, err = git_raw(*args)
    return rc, out.decode("utf-8", "surrogateescape"), err


def git_ok(*args):
    rc, out, err = git(*args)
    if rc != 0:
        raise EnvError("git %s 失败：%s" % (" ".join(args), err or "退出码 %d" % rc))
    return out


def z_list(out):
    return [p for p in out.split("\0") if p]


def ref_exists(ref):
    return git("rev-parse", "--verify", "--quiet", ref + "^{commit}")[0] == 0


def is_code_path(path):
    return path.startswith(CODE_DIRS) or path in CODE_ROOT_FILES or bool(CODE_ROOT_TSCONFIG.match(path))


def branch_changes(base_opt):
    rc, top, _ = git("rev-parse", "--show-toplevel")
    if rc != 0:
        raise EnvError("%s 不是 git 仓库（或 git 不可用）" % REPO)
    if os.path.realpath(top.strip()) != os.path.realpath(REPO):
        raise EnvError("docs 的上一级 %s 不是 git 仓库根（仓库根为 %s）" % (REPO, top.strip()))
    if not ref_exists("HEAD"):
        raise EnvError("仓库还没有提交（HEAD 不存在），无法确定本分支改动")
    if base_opt:
        if not ref_exists(base_opt):
            raise EnvError("找不到基点 %s（--base）" % base_opt)
        base = base_opt
    else:
        base = next((r for r in ("origin/main", "main") if ref_exists(r)), None)
        if base is None:
            raise EnvError("找不到基点：origin/main 与 main 都不存在。浅克隆请先 git fetch origin main，"
                           "或用 --base <ref> 指定基点")
    rc, mb, err = git("merge-base", base, "HEAD")
    if rc != 0 or not mb.strip():
        raise EnvError("求不出 %s 与 HEAD 的 merge-base（浅克隆或没有共同祖先）%s" % (base, "：" + err if err else ""))
    mb = mb.strip()
    committed = set(z_list(git_ok("diff", "--name-only", "--no-renames", "-z", mb, "HEAD")))
    worktree = set(z_list(git_ok("diff", "--name-only", "--no-renames", "-z", "HEAD")))
    untracked = set(z_list(git_ok("ls-files", "--others", "--exclude-standard", "-z")))
    return base, mb, committed, worktree, untracked


HEADS_PREFIX = "refs/heads/"


def current_branch():
    """返回 (分支名 或 None, 来源位置)。分支名取 git symbolic-ref -q HEAD 中 refs/heads/ 之后的部分：不用 --short，
    有同名标签或远端引用时 --short 会输出消歧后的「heads/change/<id>」。取不到（HEAD 游离）时取 GITHUB_HEAD_REF。"""
    rc, out, _ = git("symbolic-ref", "-q", "HEAD")
    ref = out.strip()
    if rc == 0 and ref.startswith(HEADS_PREFIX) and len(ref) > len(HEADS_PREFIX):
        return ref[len(HEADS_PREFIX):], "HEAD"
    head_ref = os.environ.get("GITHUB_HEAD_REF", "").strip()
    if head_ref.startswith(HEADS_PREFIX):
        head_ref = head_ref[len(HEADS_PREFIX):]
    return head_ref or None, "GITHUB_HEAD_REF"


def pr_body_placeholder(value):
    """PR_BODY 首行「Change:」后的值是占位值（无、N/A、-、none、<id> 一类，可带括注，如「无（L0 文档修正）」）：
    按没给出 id 处理（只改文档的 L0 PR 不开变更，80/01 §1）。「feat-x（文档步）」不是占位值，仍按不合法的 id 报。"""
    core = strip_note(value)
    return prdlib.is_placeholder(core) or is_none_value(core)


def cjk_join(prefix, label):
    """中文前缀接来源说明：说明以中文开头时不留空格（「来自环境变量 CORDEX_CHANGE」），以英文开头时留一个
    （「来自 PR_BODY 首行」）。"""
    return prefix + ("" if re.match(r"[\u3400-\u9fff]", label) else " ") + label


def valid_change_id(raw):
    return bool(CHANGE_ID_RE.match(raw)) and raw != ARCHIVE


def resolve_change(opt_change):
    """返回 dict(id, source, problems, tried, branch)。problems 为 [(来源位置, 原因)]。

    没给出 id 的来源跳过（PR_BODY 首行「Change:」后为空或是占位值也算没给出，见 pr_body_placeholder）；给出的 id
    不合法时记为问题并顺延到下一个来源；第一个给出合法 id 的来源说了算，其后的来源不再看；PR 正文首行与分支名都
    给出合法 id 且不同时另记一条问题。"""
    cands, tried = [], []                       # (来源位置, 来源说明, 取到的值)
    if opt_change is not None:
        cands.append(("--change", "--change", opt_change))
    else:
        tried.append("未传 --change")
    env_id = os.environ.get("CORDEX_CHANGE", "").strip()
    if env_id:
        cands.append(("CORDEX_CHANGE", "环境变量 CORDEX_CHANGE", env_id))
    else:
        tried.append("CORDEX_CHANGE 未设置")
    pr_id = None
    body = os.environ.get("PR_BODY", "")
    if body.strip():
        first = body.strip().splitlines()[0].replace("**", "").strip()
        m = re.match(r"^Change\s*[:：]\s*(.*?)\s*$", first, re.I)
        if m:
            value = m.group(1).strip().strip("`").strip()
            if not value:
                tried.append("PR_BODY 首行「Change:」后没有填 id")
            elif pr_body_placeholder(value):
                tried.append("PR_BODY 首行「Change:」后是占位值「%s」，按未给出处理" % value)
            else:
                pr_id = value
                cands.append(("PR_BODY", "PR_BODY 首行", pr_id))
        else:
            tried.append("PR_BODY 首行不是「Change: <id>」")
    else:
        tried.append("PR_BODY 未设置")
    branch, branch_where = current_branch()
    br_id = None
    if branch and branch.startswith("change/"):
        br_id = branch[len("change/"):]
        cands.append((branch_where, "分支 %s" % branch, br_id))
    elif branch:
        tried.append("当前分支「%s」不是 change/<id>" % branch)
    else:
        tried.append("HEAD 游离且 GITHUB_HEAD_REF 未设置")
    cid = source = None
    problems = []
    for where, label, raw in cands:
        if valid_change_id(raw):
            cid, source = raw, label
            break
        many = "，一个 PR 只关联一个变更" if re.search(r"[\s,，、;；|]", raw) else ""
        problems.append((where, "变更 id「%s」（%s）不合法：须为单个 kebab-case id（如 design-language-v3）%s"
                         % (raw, cjk_join("来自", label), many)))
    if pr_id and br_id and pr_id != br_id and valid_change_id(pr_id) and valid_change_id(br_id):
        problems.append(("PR_BODY", "PR 正文首行关联「%s」而分支名关联「%s」，一个 PR 只能关联一个变更"
                         % (pr_id, br_id)))
    if problems and cid is not None:
        gap = "" if re.search(r"[\u3400-\u9fff]$", source) else " "
        moved = "；%s%s给出的「%s」" % (cjk_join("已顺延到", source), gap, cid)
        problems = [(w, p + (moved if p.startswith("变更 id") else "")) for w, p in problems]
    return {"id": cid, "source": source, "problems": problems, "tried": tried, "branch": branch}


def archived_dir(cid):
    base = os.path.join(REPO, CHANGES, ARCHIVE)
    if not os.path.isdir(base):
        return None
    for name in sorted(os.listdir(base)):
        if name == cid or re.match(r"^\d{4}-\d{2}-\d{2}-" + re.escape(cid) + r"$", name):
            return "%s/%s/%s/" % (CHANGES, ARCHIVE, name)
    return None


def change_dir_exists(cid):
    """openspec/changes/<id>/ 存在且大小写精确（macOS 默认不区分大小写，CI 区分）。"""
    path = os.path.join(REPO, CHANGES, cid)
    return os.path.isdir(path) and exists_exact(path)


def change_missing_reason(cid):
    arch = archived_dir(cid)
    if arch:
        return "变更「%s」已归档（%s），归档后不能再关联，请新开变更" % (cid, arch)
    try:
        names = os.listdir(os.path.join(REPO, CHANGES))
    except OSError:
        names = []
    alike = sorted(n for n in names if n.lower() == cid.lower() and n != cid)
    if alike:
        return ("变更目录 %s/%s/ 不存在：磁盘上是 %s/%s/，大小写不符（区分大小写的系统与 CI 上找不到），"
                "目录名须与变更 id 一致" % (CHANGES, cid, CHANGES, alike[0]))
    return "变更目录 %s/%s/ 不存在" % (CHANGES, cid)


class Context(object):
    def __init__(self, opt_change, base_opt):
        self.base, self.merge_base, self.committed, self.worktree, self.untracked = branch_changes(base_opt)
        self.changed = self.committed | self.worktree | self.untracked
        self.code_paths = sorted(p for p in self.changed if is_code_path(p))
        info = resolve_change(opt_change)
        self.change_id = info["id"]
        self.change_source = info["source"]
        self.change_problems = info["problems"]
        self.change_tried = info["tried"]
        self.branch = info["branch"]
        self._prd = None
        self._added = None

    @property
    def prd(self):
        """工作区 PRD：prdlib.load_prd 的结果（PrdResult：reqs、errors、read_errors）。"""
        if self._prd is None:
            self._prd = prdlib.load_prd(DOCS)
        return self._prd

    def prd_added(self):
        """PRD 在本分支新增的编号：返回 (编号列表, 问题, 摘要注记)。基点上没有任何需求（如仓库初始化时整份
        PRD 都在本分支新建）时不比对。"""
        if self._added is None:
            current = self.prd.reqs
            base, problems, notes = load_prd_at(self.merge_base)
            if problems:
                self._added = ([], problems, "（PRD 编号未能与基点比对）")
            elif not base.reqs:
                self._added = ([], [], "（基点 %s 上没有 PRD 需求，未比对 PRD 编号）" % self.merge_base[:7])
            else:
                note = "（%s）" % "；".join(notes) if notes else ""
                self._added = ([rid for rid in current if rid not in base.reqs], [], note)
        return self._added

    def change_dir_ok(self):
        return self.change_id is not None and change_dir_exists(self.change_id)

    def is_changed(self, path):
        if path in self.changed:
            return True
        prefix = path.rstrip("/") + "/"
        return any(c.startswith(prefix) for c in self.changed)

    def code_sample(self):
        n = len(self.code_paths)
        return "%s%s" % (self.code_paths[0], " 等 %d 个" % n if n > 1 else "") if n else ""


class Result(object):
    def __init__(self, key):
        self.key = key
        self.gate, self.name = GATES[key]
        self.status = "pass"
        self.summary = ""
        self.failures = []
        self.notes = []

    def fail(self, file, line, reason):
        self.failures.append((file, line, reason))

    def note(self, text):
        """不判失败、只写进摘要的提示。"""
        if text not in self.notes:
            self.notes.append(text)

    def finish(self, summary_ok, summary_fail=None):
        if self.failures:
            self.status = "fail"
            self.summary = summary_fail or summary_ok
        else:
            self.summary = summary_ok
        return self

    def skip(self, summary):
        self.status = "skip"
        self.summary = summary
        return self


# ------------------------------------------------------------------ G1 关联变更
def gate_link(ctx):
    r = Result("link")
    if not ctx.code_paths:
        return r.skip("仅文档改动（本分支改动 %d 个文件，未触及代码路径）" % len(ctx.changed))
    anchor = ctx.code_paths[0]
    for _, problem in ctx.change_problems:
        r.fail(anchor, 1, "改动触及代码路径，关联变更有误：%s" % problem)
    cid = ctx.change_id
    if cid is None:
        if not ctx.change_problems:
            r.fail(anchor, 1, "改动触及代码路径，但未关联变更：%s。请在 change/<id> 分支上工作，或在 PR 正文首行写"
                              "「Change: <id>」" % "；".join(ctx.change_tried))
        return r.finish("", "触及代码路径（%s），但未关联变更" % ctx.code_sample())
    if not ctx.change_dir_ok():
        r.fail(anchor, 1, "改动触及代码路径，但" + change_missing_reason(cid))
    return r.finish("变更 %s（%s）：%s/%s/ 存在且未归档；触及代码路径 %s" % (
        cid, ctx.change_source, CHANGES, cid, ctx.code_sample()),
        "变更 %s（%s）；触及代码路径 %s" % (cid, ctx.change_source, ctx.code_sample()))


# ------------------------------------------------------------------ G2 评审门
LEVEL_FORMS = "「级别：L0」「级别：L1」或「级别：L2」"


def level_lines(prop):
    """proposal 里的级别行：[(行号, 级别行原文, 值)]。"""
    out = []
    for no, text in prop.lines:
        c = canon(text)
        m = LEVEL_KEY_RE.match(c)
        if m:
            out.append((no, c, m.group(1).strip()))
    return out


def parse_level(value):
    """级别行的值 → (级别 或 None, 问题 或 None)。括注里的文字不算；只能写一个 L0–L2。"""
    tokens = LEVEL_TOKEN_RE.findall(strip_parens(value))
    bad = [t for t in tokens if t not in LEVELS]
    if bad:
        return None, "级别「%s」不合法：只能是 L0、L1、L2 之一" % bad[0]
    levels = []
    for t in tokens:
        if t not in levels:
            levels.append(t)
    if not levels:
        return None, "级别行没有写级别（应为%s）" % LEVEL_FORMS
    if len(levels) > 1:
        return None, ("级别行写了 %s %d 个级别，只能写一个：应为%s（拿不准按 L2，80/01 §1）"
                      % ("、".join(levels), len(levels), LEVEL_FORMS))
    return levels[0], None


def proposal_level(prop):
    """返回 (级别, 行号, 失败列表, 摘要)。"""
    found, fails = [], []
    for no, text, value in level_lines(prop):
        level, problem = parse_level(value)
        if problem:
            fails.append((prop.rel, no, "%s，现为「%s」" % (problem, text)))
        else:
            found.append((no, level))
    if fails:
        return None, None, fails, "proposal 级别行不明确"
    if not found:
        return None, None, [(prop.rel, 1, "缺少级别行（%s，80/03 §2.2）" % LEVEL_FORMS)], "proposal 缺级别行"
    levels = sorted({lv for _, lv in found})
    if len(levels) > 1:
        other = next(no for no, lv in found if lv != found[0][1])
        return None, None, [(prop.rel, other, "级别行互相矛盾：%s（只能写一行）" % "、".join(levels))], \
            "proposal 级别行互相矛盾（%s）" % "、".join(levels)
    return found[0][1], found[0][0], [], ""


def looks_like_review(value):
    """「评审X：」行的值像评审状态（已确认 / L1 自审 / 待确认…）：键多半写错了。"""
    status = value.split("|", 1)[0].strip()
    return bool(re.match(r"^(?:已确认|L1[ \t]*自审)", status)) or strip_note(status) in PENDING_STATES


def review_info(sync):
    """docs-sync「## 评审」的评审行。返回 (信息 或 None, 结构问题[(文件, 行, 原因)])；
    信息为 {no, text, state: pending|confirmed|l1|unknown, who, date, reason, problems[原因]}。state 是该行声称的状态，
    problems 非空时不算确认（G2、设计质量门都按格式不对处理）。
    评审行是键为「评审」的行（键带括注的也算评审行，但报格式错误）；没有时，键以「评审」开头、值像评审状态的行按
    键写错处理；「评审意见：」「评审页：」等其他行是说明，不参与判定。格式严格按 80/03 §2.2 核对，规则见文件头 G2。"""
    sec = sync.section("评审")
    if sec is None:
        return None, [(sync.rel, 1, "缺少「## 评审」节")]
    head, body = sec
    exact, misspelled = [], []
    for no, raw in body:
        c = canon(raw)
        m = REVIEW_KEY_RE.match(c)
        if not m:
            continue
        key, value = m.group(1).strip(), m.group(2).strip()
        if strip_note(key) == "评审":
            exact.append((no, c, key, value))
        elif looks_like_review(value):
            misspelled.append((no, c, key, value))
    cands = exact or misspelled
    if not cands:
        return None, [(sync.rel, head, "「## 评审」下没有「评审：…」行")]
    problems = []
    if len(cands) > 1:
        problems.append((sync.rel, cands[1][0], "「## 评审」下有 %d 行评审行（第 %s 行），只能保留一行"
                         % (len(cands), "、".join(str(c[0]) for c in cands))))
    no, text, key, value = cands[0]
    info = {"no": no, "text": text, "state": "unknown", "who": None, "date": None, "reason": None, "problems": []}
    bad = info["problems"]
    if key != "评审":
        if strip_note(key) == "评审":
            bad.append("评审行的键只能是「评审」，现为「%s」（键不带括注，说明另起一行写）" % key)
        else:
            bad.append("评审行的键应为「评审」，现为「%s」" % key)
    status, fields, names = parse_confirm(value, ("确认人", "日期", "理由"))
    if status.startswith("已确认"):
        info["state"] = "confirmed"
        if status != "已确认":
            bad.append("评审状态只能写「已确认」，现为「%s」：状态后不能带括注或其他文字，部分确认、有条件确认都不算确认"
                       "（说明另起一行写在本节里）" % status)
        bad.extend(shape_problems("评审行", names, ("确认人", "日期"),
                                  {"确认人": "确认人：<名>", "日期": "日期：YYYY-MM-DD"}))
        who, date = fields.get("确认人"), fields.get("日期")
        if who is not None:
            if prdlib.is_placeholder(who):
                bad.append("评审行的确认人为空或是占位值「%s」" % who)
            elif has_bracket(who):
                bad.append("评审行的确认人「%s」带了括注：确认人只写名字，说明另起一行写" % who)
            else:
                info["who"] = who
        if date is not None:
            if valid_date(date):
                info["date"] = date
            else:
                bad.append("评审行的日期「%s」不是有效的 YYYY-MM-DD（日期后不能带括注，说明另起一行写）" % date)
        word = unsettled_word(value[len(status):] if status != "已确认" else value)
        if word:
            bad.append("评审行写了「%s」：只确认了一部分或还有未定项时不算确认，全部确认后再写%s" % (word, REVIEW_FORM))
    elif re.match(r"^L1[ \t]*自审", status):
        info["state"] = "l1"
        if not L1_STATUS_RE.match(status):
            bad.append("评审状态只能写「L1 自审」，现为「%s」：状态后不能带括注或其他文字（说明写进理由），应为%s"
                       % (status, L1_FORM))
        bad.extend(shape_problems("L1 自审", names, ("理由",), {"理由": "理由：<…>"}))
        reason = fields.get("理由")
        if reason is not None:
            if prdlib.is_placeholder(reason):
                bad.append("L1 自审的理由为空或是占位值「%s」" % reason)
            else:
                info["reason"] = reason
    elif strip_note(status) in PENDING_STATES:
        info["state"] = "pending"
    else:
        bad.append("评审行的状态「%s」不合法：应为「待确认」、%s或%s" % (status, REVIEW_FORM, L1_FORM))
    return info, problems


def gate_review(ctx):
    r = Result("review")
    if not ctx.code_paths:
        return r.skip("仅文档改动")
    anchor = ctx.code_paths[0]
    cid = ctx.change_id
    if cid is None or not ctx.change_dir_ok():
        why = "未关联变更" if cid is None else change_missing_reason(cid)
        r.fail(anchor, 1, "%s（见 G1），无法读取 proposal 级别与 docs-sync 评审行" % why)
        return r.finish("", "%s，无法核对评审" % ("未关联变更" if cid is None else "变更目录不可用"))
    prop = Doc("%s/%s/proposal.md" % (CHANGES, cid))
    if not prop.exists:
        r.fail(prop.rel, 1, "找不到 proposal.md")
        return r.finish("", "找不到 proposal.md")
    if prop.error:
        r.fail(prop.rel, prop.error_line, prop.error)
        return r.finish("", "proposal.md 无法读取")
    level, level_no, fails, why = proposal_level(prop)
    for f in fails:
        r.fail(*f)
    if level is None:
        if prop.unclosed:
            r.fail(prop.rel, prop.unclosed[0], unclosed_reason(prop) + "，可能吞掉了级别行")
        return r.finish("", why)
    if level == "L0":
        r.fail(prop.rel, level_no, "级别 L0 只能改 docs/，本分支改动触及代码路径（%s）：应为 L1 或 L2（80/01 §1）"
               % ctx.code_sample())
        return r.finish("", "级别 L0 却改了代码")
    sync = Doc("%s/%s/docs-sync.md" % (CHANGES, cid))
    if not sync.exists:
        r.fail(sync.rel, 1, "找不到 docs-sync.md，无法核对评审行")
        return r.finish("", "级别 %s，缺 docs-sync.md" % level)
    if sync.error:
        r.fail(sync.rel, sync.error_line, sync.error)
        return r.finish("", "级别 %s，docs-sync.md 无法读取" % level)
    info, problems = review_info(sync)
    problems = duplicate_sections(sync, ("评审",)) + problems
    for f in problems:
        r.fail(*f)
    if info is None:
        if sync.unclosed:
            r.fail(sync.rel, sync.unclosed[0], unclosed_reason(sync) + "，可能吞掉了「## 评审」")
        return r.finish("", "级别 %s，缺评审行" % level)
    no = info["no"]
    extra = "，「## 评审」节重复或评审行多于一行" if problems else ""
    if level == "L2":
        if info["state"] != "confirmed":
            r.fail(sync.rel, no, "级别 L2 须由用户确认：评审行应为「评审：已确认 | 确认人：<名> | 日期：YYYY-MM-DD」，"
                                 "现为「%s」" % info["text"])
            return r.finish("", "级别 L2，评审未确认")
        for p in info["problems"]:
            r.fail(sync.rel, no, p)
        return r.finish("级别 L2，评审已确认（%s，%s）" % (info["who"], info["date"]),
                        "级别 L2，评审行不合格式、不算确认" if info["problems"] else "级别 L2" + extra)
    if info["state"] != "l1":
        r.fail(sync.rel, no, "级别 L1 评审行应为「评审：L1 自审 | 理由：<…>」，现为「%s」" % info["text"])
        return r.finish("", "级别 L1，缺 L1 自审")
    for p in info["problems"]:
        r.fail(sync.rel, no, p)
    return r.finish("级别 L1，L1 自审（理由：%s）" % info["reason"],
                    "级别 L1，评审行不合格式" if info["problems"] else "级别 L1" + extra)


# ------------------------------------------------------------------ G3 矩阵核对：矩阵与回写记录
def matrix_outside(prop, r):
    """「## 文档影响矩阵」节外的影响矩阵（80/02 §4）：标题含「文档影响矩阵」的节（任意级别）与表头含「线」「表态」列的表
    都报格式错误。节外的矩阵不核对：矩阵以节内那张表为准，修订就地改表（节内只能有一张表）。"""
    heads, _, loose, where_of = outside_layout(prop, MATRIX_TITLE)
    tail = ("影响矩阵只能写在「## 文档影响矩阵」节内，且节内恰好一张表（修订就地改表，示例与旧表删去）；%s。节外的矩阵不核对，"
            "以节内那张表为准")
    for no, shown, where in heads:
        r.fail(prop.rel, no, "标题「%s」含「文档影响矩阵」，却在「## 文档影响矩阵」节外（%s）：%s"
               % (shown, where, tail % "不是影响矩阵的节请改标题"))
    for i, header, _ in tables(loose):
        if column_index(header, "线") is not None and column_index(header, "表态") is not None:
            no = loose[i][0]
            r.fail(prop.rel, no, "表头含「线」「表态」列的影响矩阵表在「## 文档影响矩阵」节外（%s）：%s"
                   % (where_of[no], tail % "不是影响矩阵的表请改列名"))


def check_matrix(prop, r):
    """返回 OrderedDict：线 → {kind: need|na|bad, line}；结构性问题返回 None。节内须恰好一张表：多于一张（照抄的示例表、
    修订前的旧表）时判失败、不猜哪张算数。节外的矩阵另报格式错误（matrix_outside）。"""
    matrix_outside(prop, r)
    sec = prop.section(MATRIX_TITLE)
    if sec is None:
        r.fail(prop.rel, 1, "缺少「## 文档影响矩阵」节（80/02 §4）")
        return None
    head, body = sec
    found = tables(body)
    if not found:
        r.fail(prop.rel, head, "「## 文档影响矩阵」下没有表格（列：线 / 表态 / 说明）")
        return None
    if len(found) > 1:
        starts = [body[i][0] for i, _, _ in found]
        r.fail(prop.rel, starts[1], "「## 文档影响矩阵」下有 %d 张表（表头在第 %s 行），只能保留一张 6 行的矩阵：示例表、修订前"
                                    "的旧表请删去（无法判断哪张算数，矩阵未核对）" % (len(found), "、".join(str(n) for n in starts)))
        return None
    i, header, trows = found[0]
    hno, rows = body[i][0], [(no, cells) for _, no, cells in trows]
    ci, si = column_index(header, "线"), column_index(header, "表态")
    if ci is None or si is None:
        r.fail(prop.rel, hno, "影响矩阵表头应含「线」「表态」列，现为「%s」" % " / ".join(header))
        return None
    if len(rows) != 6:
        r.fail(prop.rel, hno, "影响矩阵有 %d 行，应恰好 6 行（产品、设计、前端、后端、测试、其他）" % len(rows))
    fitted = []
    for no, cells in rows:
        cells, extra = fit_row(cells, len(header))
        if extra:
            r.note(extra_cells_note(prop.rel, no, extra, len(header)))
        fitted.append((no, canon(cells[ci]), canon(cells[si])))
    seen = set(line for _, line, _ in fitted)
    missing = [l for l in MATRIX_LINES if l not in seen]
    if missing:
        r.fail(prop.rel, hno, "影响矩阵缺少「%s」行" % "」「".join(missing))
    matrix = OrderedDict()
    for no, line, stance in fitted:
        if line not in MATRIX_LINES:
            r.fail(prop.rel, no, "线名「%s」不在 产品、设计、前端、后端、测试、其他 之内" % line)
            continue
        if line in matrix:
            r.fail(prop.rel, no, "线「%s」重复（第 %d 行已有）" % (line, matrix[line]["line"]))
            continue
        if stance == "需更新":
            kind = "need"
        elif stance.startswith("不涉及："):
            kind = "na"
            if prdlib.is_placeholder(stance[len("不涉及："):]):
                kind = "bad"
                r.fail(prop.rel, no, "「%s」表态「不涉及」须写理由：「不涉及：<理由>」，理由不能为空或模板占位" % line)
        else:
            kind = "bad"
            r.fail(prop.rel, no, "「%s」表态「%s」不合法：只能是「需更新」或「不涉及：<理由>」" % (line, stance))
        matrix[line] = {"kind": kind, "line": no}
    return matrix


def norm_record_path(raw):
    """返回 (规范化路径, 问题)。"""
    p = raw.replace("\\", "/")
    if p.startswith("./"):
        p = p[2:]
    if p.startswith("/") or re.match(r"^[A-Za-z]:", p) or URL_RE.match(p):
        return None, "路径「%s」须为相对仓库根的路径" % raw
    n = posixpath.normpath(p)
    if n == "." or n == ".." or n.startswith("../"):
        return None, "路径「%s」越出仓库" % raw
    return n, None


def path_exists(path):
    """规范化后的相对路径存在（大小写精确）。"""
    n, problem = norm_record_path(path)
    return bool(n) and not problem and exists_exact(os.path.join(REPO, n))


def link_path(text, target, base_dir):
    """链接 → 路径：取链接目标（按 docs-sync 所在目录 base_dir 解析，以 / 开头的按仓库根）；目标不存在而
    链接文字是存在的完整路径时取文字；都不存在时取目标（没有目标时取文字）。"""
    text = text.strip().strip("`").strip()
    target = target.strip().split("#")[0]
    cands = []
    if target and not URL_RE.match(target):
        cands.append(posixpath.normpath(target.lstrip("/") if target.startswith("/")
                                        else posixpath.join(base_dir, target)))
    if text and not re.search(r"\s", text) and ("/" in text or "." in text):
        cands.append(text)
    for c in cands:
        if path_exists(c):
            return c
    return cands[0] if cands else text


def record_paths(cell, base_dir):
    """回写记录文件列 → [(原文, 规范化路径或 None, 问题)]。链接按 link_path 取路径，末尾括注（如「（新建）」）
    去掉。"""
    out = []
    for part in PATH_SPLIT_RE.split(cell):
        raw = part.strip()
        lm = LINK_RE.match(raw)
        if lm:
            raw = link_path(lm.group(1), lm.group(2), base_dir)
        raw = raw.strip("`").strip()
        raw = re.sub(r"[ \t]*[（(][^（）()]*[）)][ \t]*$", "", raw).strip().strip("`").strip()
        if raw:
            n, problem = norm_record_path(raw)
            out.append((raw, n, problem))
    return out


def parse_records(sync, r=None, bad_tables=None, stray=None):
    """docs-sync 的回写记录：返回记录 [(行号, 线, [(原文, 规范化路径或 None, 问题)])]（按行号排序），节内节外都没有
    含「线」「文件」列的表时返回 None（读不出）。
    「## 回写记录」节内所有表都算回写记录表（分轮追加的第二张表、### 小标题下的表也核对）；该节重复时各节合并读取
    （Doc.section），重复本身另报。回写记录只能写在该节内（80/02 §4）：节外标题含「回写记录」的节（任意级别）与节外
    表头含「线」「文件」列的表都报格式错误，其中的记录照样读出（outside_layout），所以既核对路径、也参与重叠，不会
    被静默丢掉；这些行号另记进 stray（读取其他变更时用）。表格按 GFM：表格内不含竖线的行算只有首格的一行（线名是
    那行文字、文件为空，照常核对），其后的行不丢。表头缺「线」或「文件」列的表（节内，或节外「回写记录」标题下）
    报错，其表头行号另记进 bad_tables（读取其他变更时用）。单元格多于表头时多出的格按 GFM 忽略（摘要里注明）。
    r 为 None 时（读取其他变更）不报问题。"""
    def fail(line, reason):
        if r is not None:
            r.fail(sync.rel, line, reason)
    base_dir = posixpath.dirname(sync.rel)
    out, usable = [], []

    def take(hno, header, rows, scope):
        ci, fi = column_index(header, "线"), column_index(header, "文件")
        if ci is None or fi is None:
            fail(hno, "回写记录表头应含「线」「文件」列，现为「%s」（%s每张表都按回写记录核对）" % (" / ".join(header), scope))
            if bad_tables is not None:
                bad_tables.append(hno)
            return
        usable.append(hno)
        for _, no, cells in rows:
            cells, extra = fit_row(cells, len(header))
            if extra and r is not None:
                r.note(extra_cells_note(sync.rel, no, extra, len(header)))
            out.append((no, canon(cells[ci]), record_paths(cells[fi], base_dir)))

    sec = sync.section(RECORD_TITLE)
    if sec is None:
        fail(1, "缺少「## 回写记录」节")
    else:
        head, body = sec
        found = tables(body)
        if not found:
            fail(head, "「## 回写记录」下没有表格（列：线 / 文件 / 章节 / 摘要）")
        for i, header, rows in found:
            take(body[i][0], header, rows, "节内")
    # 「## 回写记录」节外的回写记录：报格式错误，记录照样读出
    heads, blocks, loose, where_of = outside_layout(sync, RECORD_TITLE)
    moved = "回写记录只能写在「## 回写记录」节内（%s）" % RECORD_APPEND_HINT
    for no, shown, where in heads:
        fail(no, "标题「%s」含「回写记录」，却在「## 回写记录」节外（%s）：%s；不是回写记录的节请改标题。本次照样核对"
                 "该标题下的回写记录、计入重叠检查" % (shown, where, moved))
        if stray is not None:
            stray.append(no)
    for hno, rows in blocks.items():
        for i, header, trows in tables(rows):
            take(rows[i][0], header, trows, "节外「回写记录」标题下")
    for i, header, trows in tables(loose):
        if column_index(header, "线") is None or column_index(header, "文件") is None:
            continue                            # 不是回写记录表（检查结果、偏差记录等）
        hno = loose[i][0]
        fail(hno, "表头含「线」「文件」列的回写记录表在「## 回写记录」节外（%s）：%s；不是回写记录的表请改列名。本次照样"
                  "核对其中的记录、计入重叠检查" % (where_of[hno], moved))
        if stray is not None:
            stray.append(hno)
        take(hno, header, trows, "")
    out.sort(key=lambda rec: rec[0])
    return out if usable else None


def in_line_dir(path, line):
    for d in LINE_DIRS[line]:
        if d.endswith("/"):
            if path == d[:-1] or path.startswith(d):
                return True
        elif path == d:
            return True
    return False


def missing_path_reason(ctx, n, raw):
    full = os.path.join(REPO, n)
    if os.path.exists(full):
        return "回写记录的路径大小写不符：%s" % raw
    if n in ctx.changed:
        return ("回写记录的路径不存在（本分支删除了它）：%s；删除的文件请记其所在目录或改动了引用的文件" % raw)
    if re.search(r"[\s\u3400-\u9fff]", raw):
        return "回写记录的路径不存在：%s（文件列只写相对仓库根的路径，说明写在「章节」「摘要」列）" % raw
    return "回写记录的路径不存在：%s（须为相对仓库根的完整路径，不能简写）" % raw


def check_records(ctx, sync, records, matrix, prop, r):
    """核对回写记录本身与「需更新」行。返回路径数。"""
    n_paths = 0
    for no, line, paths in records:
        if line not in MATRIX_LINES:
            r.fail(sync.rel, no, "回写记录的线名「%s」不在 产品、设计、前端、后端、测试、其他 之内" % line)
        if not paths:
            r.fail(sync.rel, no, "回写记录没有填写文件")
        for raw, n, problem in paths:
            n_paths += 1
            if problem:
                r.fail(sync.rel, no, "回写记录的%s" % problem)
            elif not exists_exact(os.path.join(REPO, n)):
                r.fail(sync.rel, no, missing_path_reason(ctx, n, raw))
            elif not ctx.is_changed(n):
                r.fail(sync.rel, no, "回写记录的路径在本分支没有改动（基点 %s）：%s" % (ctx.base, raw))
    if matrix is not None:
        for line in [l for l in MATRIX_LINES if matrix.get(l, {}).get("kind") == "need"]:
            mine = [(no, paths) for no, l, paths in records if l == line]
            if not mine:
                r.fail(prop.rel, matrix[line]["line"], "「%s」表态需更新，但 docs-sync「## 回写记录」没有「%s」线的记录"
                       % (line, line))
            elif not any(n and in_line_dir(n, line) for _, paths in mine for _, n, _ in paths):
                r.fail(sync.rel, mine[0][0], "「%s」的回写记录没有落在该线目录（%s）下的文件"
                       % (line, "、".join(LINE_DIRS[line])))
    return n_paths


# ------------------------------------------------------------------ G3：新增功能
NEW_KEY = "新增"
LABEL_KEYS = ("新增", "修改", "实现", "删除", "废弃", "移除", "取消", "合并", "拆分", "调整", "更新", "变更", "涉及",
              "引用", "关联", "相关", "影响", "保留", "沿用", "取代", "替代", "替换", "依赖", "参见", "参考", "对应", "见")
_KEYS = "|".join(sorted(LABEL_KEYS, key=len, reverse=True))
_SUFFIX = r"(?:的)?(?:需求编号|需求|编号|功能|条目)?"
_ID_AHEAD = r"(?=[ \t]*(?:PRD[:：]?[ \t]*)?" + prdlib.ID_PATTERN + r"(?![A-Za-z0-9])(?![ \t]*的))"
# 行中的标签：「新增：」「新增需求：」「新增 AS-09」；紧跟在否定字之后的不算，「新增 AS-09 的验收标准」（给已有需求
# 加内容）也不算
INLINE_LABEL_RE = re.compile(r"(?<![不无未非没])(" + _KEYS + r")" + _SUFFIX + r"[ \t]*(?:[：:][ \t]*|" + _ID_AHEAD + r")")
# 独占一行的标签：「### 新增」「**新增**」「新增：」「- 新增需求」
BLOCK_LABEL_RE = re.compile(r"^(?:#{1,6}[ \t]+)?(?:(?:[-*+]|\d{1,3}[.)])[ \t]+)?(" + _KEYS + r")" + _SUFFIX
                            + r"[ \t]*[：:]?[ \t]*$")
KEY_CELL_RE = re.compile(r"^(" + _KEYS + r")" + _SUFFIX + r"[ \t]*[：:]?$")
RANGE_RE = re.compile(r"(?<![A-Za-z0-9])(" + prdlib.ID_PATTERN + r")[ \t]*(?:…+|\.{2,}|⋯+|–+|—+|~|～|至|到|-)[ \t]*"
                      r"(?:PRD[:：]?[ \t]*)?(" + prdlib.ID_PATTERN + r")(?![A-Za-z0-9])")
NONE_VALUES = ("无", "没有", "暂无", "无新增", "不涉及", "none", "n/a", "na", "-", "—", "——", "/")
SEE_BELOW_RE = re.compile(r"^(?:见|详见|如)?(?:下表|下列|以下|如下|下)")
VALUE_TRIM = " \t。．.，,；;：:、*_`"


def is_new_cell(text):
    m = KEY_CELL_RE.match(text.strip())
    return bool(m) and m.group(1) == NEW_KEY


def is_key_cell(text):
    return bool(KEY_CELL_RE.match(text.strip()))


def is_none_value(text):
    return text.strip(VALUE_TRIM).lower() in NONE_VALUES


def expand_range(a, b):
    """「ED-97」「ED-99」→ [ED-97, ED-98, ED-99]；「ED-15a」「ED-15c」→ [ED-15a, ED-15b, ED-15c]；不能展开返回 None。"""
    ma = re.match(r"^([A-Z]{2,3})-([0-9]{2})([a-z]?)$", a)
    mb = re.match(r"^([A-Z]{2,3})-([0-9]{2})([a-z]?)$", b)
    if ma.group(1) != mb.group(1):
        return None
    dom = ma.group(1)
    if not ma.group(3) and not mb.group(3):
        x, y = int(ma.group(2)), int(mb.group(2))
        return ["%s-%02d" % (dom, n) for n in range(x, y + 1)] if x < y else None
    if ma.group(2) == mb.group(2) and ma.group(3) and mb.group(3) and ma.group(3) < mb.group(3):
        return ["%s-%s%s" % (dom, ma.group(2), chr(c)) for c in range(ord(ma.group(3)), ord(mb.group(3)) + 1)]
    return None


def ids_in_value(value):
    """「新增」标签之后的文字（已去括注）：截到下一个标签或句号，取其中的编号（区间逐个展开）。
    返回 (编号列表, 问题列表, 截取后的文字)。"""
    m = INLINE_LABEL_RE.search(value)
    if m:
        value = value[:m.start()]
    value = value.split("。", 1)[0]
    found, problems, spans = [], [], []
    ruled = ruled_starts(value)
    for rm in RANGE_RE.finditer(value):
        spans.append((rm.start(), rm.end()))
        a, b = rm.group(1), rm.group(2)
        if prdlib.domain_of(a) not in prdlib.DOMAINS or rm.start(1) in ruled:
            continue
        exp = expand_range(a, b)
        if exp is None:
            problems.append("区间「%s」无法逐个展开（须同一功能域、编号递增）：请逐个列出编号" % rm.group(0).strip())
            found.append((rm.start(), [x for x in (a, b) if prdlib.domain_of(x) in prdlib.DOMAINS]))   # 两端照常算声明
        else:
            found.append((rm.start(), exp))
    for rid, pos in find_req_refs(value):
        if not any(s <= pos < e for s, e in spans):
            found.append((pos, [rid]))
    ids = []
    for _, group in sorted(found, key=lambda x: x[0]):
        for rid in group:
            if rid not in ids:
                ids.append(rid)
    return ids, problems, value


def declared_new(prop):
    """proposal「## 需求编号」里声明的新增编号（识别规则见文件头 G3 第 3 条）。
    返回 {head, ids: OrderedDict(编号 → 行号), problems: [(行号, 原因)], notes: [(行号, 原文)]}；没有该节返回
    None。problems 判失败（区间无法展开）；notes 是取不到编号的「新增」标签，只写进摘要。"""
    sec = prop.section("需求编号")
    if sec is None:
        return None
    head, body = sec
    rows = [(no, t.replace("**", "").replace("__", "")) for no, t in body]
    res = {"head": head, "ids": OrderedDict(), "problems": [], "notes": []}

    def no_ids(no, shown):
        res["notes"].append((no, shown))

    def add(pairs):
        for rid, no in pairs:
            res["ids"].setdefault(rid, no)

    def value_ids(text, no):
        ids, probs, cut = ids_in_value(text)
        res["problems"].extend((no, p) for p in probs)
        return [(rid, no) for rid in ids], cut

    def follow(start, level):
        """标签之后的编号：level 为标题级别时取到下一个同级或更高的标题，否则取紧接着的一段列表或段落。"""
        got, state, gap = [], "start", False
        for j in range(start, len(rows)):
            no, text = rows[j]
            s = text.strip()
            if not s:
                gap = gap or state != "start"
                continue
            hm = HEADING_RE.match(s)
            if hm and (level is None or len(hm.group(1)) <= level):
                break
            flat = strip_parens(LIST_MARK_RE.sub("", s, count=1))
            if BLOCK_LABEL_RE.match(s) or INLINE_LABEL_RE.match(flat):
                break                                   # 下一个标签
            if level is None:
                item = bool(LIST_MARK_RE.match(s))
                if state == "start":
                    state = "list" if item else "para"
                elif gap:
                    if not (state == "list" and item):
                        break
                    gap = False
            got.extend(value_ids(flat, no)[0])
        return got

    def inline(text, no, i, shown):
        """行中的「新增」标签（text 已去括注）。i 为行下标，取其后的列表时用；None 表示不往下取。"""
        for m in INLINE_LABEL_RE.finditer(text):
            if m.group(1) != NEW_KEY:
                continue
            got, cut = value_ids(text[m.end():], no)
            rest = cut.strip(VALUE_TRIM)
            if not got and i is not None and (not rest or SEE_BELOW_RE.match(rest)):
                got = follow(i + 1, None)
            if got:
                add(got)
            elif not is_none_value(rest):
                no_ids(no, shown)

    def row(cells, no, shown, header=False):
        """表格的一行：某格为「新增」时取同一行其他格的编号；格内的行中标签照常识别。表头行只在其他格有编号
        时按行处理（否则按列处理，见下）。返回是否按行取到了编号。"""
        cells = [strip_parens(c) for c in cells]
        keyed = [k for k, c in enumerate(cells) if is_new_cell(c)]
        got, none = [], False
        for k, c in enumerate(cells):
            if keyed and k not in keyed and not is_key_cell(c):
                got.extend(value_ids(c, no)[0])
                none = none or is_none_value(c)
        if got:
            add(got)
        elif keyed and not none and not header:
            no_ids(no, shown)
        for c in cells:
            if not is_key_cell(c):
                inline(c, no, None, shown)
        return bool(got)

    roles = {}
    for i, header, trows in tables(rows):
        roles[i], roles[i + 1] = "header", "sep"
        hno = rows[i][0]
        new_cols = [] if row(header, hno, rows[i][1].strip(), header=True) else \
            [k for k, h in enumerate(header) if is_new_cell(strip_parens(h))]
        col_ids, col_none = [], False
        for j, no, cells in trows:
            roles[j] = cells
            for k in new_cols:
                if k < len(cells):
                    col_ids.extend(value_ids(strip_parens(cells[k]), no)[0])
                    col_none = col_none or is_none_value(cells[k])
        add(col_ids)
        if new_cols and not col_ids and not col_none:
            no_ids(hno, rows[i][1].strip())

    for i, (no, text) in enumerate(rows):
        s = text.strip()
        if not s or roles.get(i) in ("header", "sep"):
            continue
        if i in roles or s.startswith("|"):            # 表格行；不成表的竖线行也按行处理
            row(roles.get(i) or prdlib.split_cells(s), no, s)
            continue
        bm = BLOCK_LABEL_RE.match(s)
        if bm:
            if bm.group(1) == NEW_KEY:
                hm = HEADING_RE.match(s)
                got = follow(i + 1, len(hm.group(1)) if hm else None)
                if got:
                    add(got)
                else:
                    no_ids(no, s)
            continue
        inline(strip_parens(s), no, i, s)
    return res


def exempt_error_hint(res, rids):
    """PRD 格式错误里与这些编号的落点豁免有关的（写错了的豁免 prdlib 不认）：返回附在失败原因后的提示或空串。"""
    hits = ["%s:%d %s" % e for e in res.errors if "落点豁免" in e[2] and any(rid in e[2] for rid in rids)]
    if not hits:
        return ""
    return "；PRD 里有相关的格式错误（G4 会报）：%s" % "；".join(hits[:2]) + (" 等 %d 处" % len(hits) if len(hits) > 2 else "")


def check_new_features(ctx, prop, matrix, r):
    """返回摘要片段。PRD 需求清单是 prdlib.load_prd 的结果（与 G4、G5 同一份解析）；PRD 的格式错误由 G4 报，这里只报
    读不了的 PRD 文件（新增编号的核对依据它）。"""
    decl = declared_new(prop)
    declared = decl["ids"] if decl else OrderedDict()
    anchor = decl["head"] if decl else 1
    if decl:
        for no, why in decl["problems"]:
            r.fail(prop.rel, no, why)
        for no, shown in decl["notes"]:
            r.note("%s:%d「%s」的「新增」后没有可识别的需求编号，未据此核对新增功能的强制行（新增功能先在 PRD "
                   "定编号，80/01 §3）" % (prop.rel, no, shown))
    res = ctx.prd
    prd = res.reqs
    for f, ln, why in res.read_errors:
        r.fail(f, ln, "%s（G3 据 PRD 核对新增需求编号）" % why)
    added, diff_problems, diff_note = ctx.prd_added()
    for f in diff_problems:
        r.fail(*f)
    undeclared = [rid for rid in added if rid not in declared]
    if undeclared:
        where = "、".join("%s（%s:%d）" % (rid, prd[rid]["file"], prd[rid]["line"]) for rid in undeclared[:5])
        if len(undeclared) > 5:
            where += " 等 %d 个" % len(undeclared)
        r.fail(prop.rel, anchor, "PRD 在本分支新增了需求编号 %s，proposal「## 需求编号」须声明「新增：%s」"
                                 "（80/01 §3、80/02 §4）%s" % (where, "、".join(undeclared),
                                                              "" if decl else "；proposal 缺少「## 需求编号」节"))
    new_ids = list(declared) + undeclared
    if not new_ids:
        return "新增需求 无" + diff_note
    first_no = declared[new_ids[0]] if new_ids[0] in declared else anchor
    for rid, no in declared.items():
        if rid not in prd:
            r.fail(prop.rel, no, "新增的需求编号 %s 在 PRD（docs/10-prd/03-features/*.md、04）中找不到：新增功能先在 PRD "
                                 "定编号（80/01 §3）" % rid)
    shown = "、".join(new_ids)
    source = "（PRD 本分支新增 %s）" % "、".join(added) if added else diff_note
    if matrix is None:
        return "新增需求 %s%s，矩阵不可用、未核对强制行" % (shown, source)

    def need(line):
        return matrix.get(line, {}).get("kind") == "need"

    def row_no(line):
        return matrix.get(line, {}).get("line") or first_no
    for line in ("产品", "测试"):
        if not need(line):
            r.fail(prop.rel, row_no(line), "新增需求 %s：「%s」必须需更新（80/02 §4）" % (shown, line))
    if not need("设计"):
        lacking = [rid for rid in new_ids if "设计" not in prd.get(rid, {}).get("exemptions", {})]
        if lacking:
            r.fail(prop.rel, row_no("设计"), "新增需求 %s：「设计」必须需更新，除非 PRD 中这些编号都写了"
                                            "「- 落点豁免：设计——<理由>」（%s 没有）%s"
                   % (shown, "、".join(lacking), exempt_error_hint(res, lacking)))
    if not need("前端") and not need("后端"):
        r.fail(prop.rel, row_no("前端"), "新增需求 %s：「前端」「后端」至少一行需更新（80/02 §4）" % shown)
    return "新增需求 %s%s" % (shown, source)


# ------------------------------------------------------------------ G3：重叠
def parse_created(raw):
    """created 的值 → {date, moment, text} 或 None。moment 为带时区的时刻（没写时刻为 None；不带时区按 UTC）。"""
    m = CREATED_VALUE_RE.match(raw)
    if not m:
        return None
    try:
        date = datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        if m.group(4) is None:
            return {"date": date, "moment": None, "text": raw}
        tz = datetime.timezone.utc
        if m.group(9):
            offset = datetime.timedelta(hours=int(m.group(10)), minutes=int(m.group(11) or 0))
            tz = datetime.timezone(offset if m.group(9) == "+" else -offset)
        micro = int(((m.group(7) or "") + "000000")[:6])
        moment = datetime.datetime(date.year, date.month, date.day, int(m.group(4)), int(m.group(5)),
                                   int(m.group(6) or 0), micro, tzinfo=tz)
    except ValueError:
        return None
    return {"date": date, "moment": moment, "text": raw}


def read_created(cid):
    """.openspec.yaml 的 created：返回 (parse_created 的结果 或 None, 问题)。"""
    rp = "%s/%s/.openspec.yaml" % (CHANGES, cid)
    path = os.path.join(REPO, rp)
    if not (os.path.isfile(path) and exists_exact(path)):
        return None, "缺少 %s" % rp
    try:
        text, problem = read_doc_text(path)
    except OSError as exc:
        return None, "%s 无法读取（%s）" % (rp, exc.strerror or exc)
    if problem:
        return None, "%s 第 %d 行%s" % (rp, problem[0], problem[1])
    m = CREATED_LINE_RE.search("\n".join(prdlib.LINE_SPLIT_RE.split(text)))
    if not m:
        return None, "%s 没有 created" % rp
    raw = re.sub(r"[ \t]+#.*$", "", m.group(1)).strip().strip("'\"").strip()
    created = parse_created(raw)
    if created is None:
        return None, "%s 的 created「%s」不是有效的 YYYY-MM-DD（可带时刻，如 2026-10-04T09:30:00Z）" % (rp, raw)
    return created, None


def created_keys(mine, theirs):
    """比较用的两个键与注记：两边都写了时刻时比时刻，否则只比日期。"""
    if mine["moment"] is not None and theirs["moment"] is not None:
        return mine["moment"], theirs["moment"], ""
    one_sided = mine["moment"] is not None or theirs["moment"] is not None
    return mine["date"], theirs["date"], "，一方没写时刻、只比日期" if one_sided else ""


def other_changes(cid):
    base = os.path.join(REPO, CHANGES)
    if not os.path.isdir(base):
        return []
    return [n for n in sorted(os.listdir(base))
            if n not in (ARCHIVE, cid) and not n.startswith(".") and os.path.isdir(os.path.join(base, n))]


def depends_of(prop):
    """proposal 里「依赖：<id>[、<id>]」声明的变更 id 集合（按目录名精确比较），以及首个依赖行的行号。"""
    ids, first = set(), None
    for no, text in prop.lines:
        m = DEPENDS_RE.match(canon(text))
        if m:
            ids.update(DEPEND_ID_RE.findall(m.group(1)))
            first = first or no
    return ids, first


def paths_overlap(a, b):
    """两个声明的路径是否重叠：相同，或一方是另一方的上级目录。含通配符（* ? [）的一方按 fnmatch 匹配另一方（或另一方
    的下级），另一方是通配符之前那段目录的上级目录时也算。"""
    ga, gb = GLOB_RE.search(a), GLOB_RE.search(b)
    if not ga and not gb:
        return a == b or a.startswith(b + "/") or b.startswith(a + "/")
    pat, other, g = (a, b, ga) if ga else (b, a, gb)
    if fnmatch.fnmatchcase(other, pat) or fnmatch.fnmatchcase(other, pat + "/*"):
        return True
    static_dir = posixpath.dirname(pat[:g.start()])
    return bool(static_dir) and (static_dir == other or static_dir.startswith(other + "/")
                                 or (bool(GLOB_RE.search(other)) and paths_overlap(static_dir, other)))


def declared_paths(records, lenient=False):
    """回写记录声明的路径（去重、保持顺序）；有问题的路径不算。lenient（读取其他进行中变更）时，以 / 开头的裸路径按
    仓库根解析（与链接目标同一口径）：这种写法在对方自己的 G3 里会失败，但重叠检查不能因此看不见它。"""
    out = []
    for raw, n, problem in [p for _, _, paths in records for p in paths]:
        if problem and lenient and raw.startswith("/") and not raw.startswith("//"):
            n, problem = norm_record_path(raw.lstrip("/"))
        if n and not problem and n not in out:
            out.append(n)
    return out


def check_overlap(ctx, cid, prop, records, r):
    """返回摘要片段列表（通过与失败都写，与失败项一致）。"""
    mine = declared_paths(records)
    if not mine:
        return []
    created, created_problem = read_created(cid)
    deps, dep_no = depends_of(prop)
    level_no = next((no for no, _, _ in level_lines(prop)), 1)
    anchor = dep_no or level_no
    notes, undecidable = [], []
    for other in other_changes(cid):
        sync = Doc("%s/%s/docs-sync.md" % (CHANGES, other))
        if not sync.exists:
            continue                            # 对方还在提案步，没有回写记录
        bad_tables, stray = [], []
        recs = parse_records(sync, bad_tables=bad_tables, stray=stray) if sync.error is None else None
        if stray:                               # 对方写在「## 回写记录」节外的回写记录：一并计入（它自己的 G3 报格式错误）
            r.note("进行中变更「%s」的 docs-sync 第 %s 行有写在「## 回写记录」节外的回写记录，已一并计入重叠检查"
                   % (other, "、".join(str(n) for n in stray)))
        if recs is not None and bad_tables:      # 读得出一部分：照常核对读得出的表，读不出的表按「无法核对」处理
            if other in deps:
                notes.append("%s 的回写记录第 %s 行的表缺「线」「文件」列，已声明依赖"
                             % (other, "、".join(str(n) for n in bad_tables)))
            else:
                r.fail(prop.rel, anchor, "进行中变更「%s」的 docs-sync 第 %s 行的回写记录表缺「线」或「文件」列，无法核对它"
                                         "与本变更是否声明了同一文件：先修好它的 docs-sync，或在 proposal 写「依赖：%s」"
                                         "（80/01 §7）" % (other, "、".join(str(n) for n in bad_tables), other))
                notes.append("%s 的回写记录有表读不出" % other)
        if recs is None:
            why = ("第 %d 行%s" % (sync.error_line, sync.error)) if sync.error else \
                "读不出「## 回写记录」表（缺节、缺表或缺「线」「文件」列）"
            if other in deps:
                notes.append("未能读取 %s 的回写记录，已声明依赖" % other)
                continue
            r.fail(prop.rel, anchor, "进行中变更「%s」的 docs-sync %s，无法核对它与本变更是否声明了同一文件：先修好"
                                     "它的 docs-sync，或在 proposal 写「依赖：%s」（80/01 §7）" % (other, why, other))
            notes.append("未能读取 %s 的回写记录" % other)
            continue
        if sync.unclosed:
            notes.append("%s 的 docs-sync 第 %d 行起有未闭合的%s，其回写记录可能不全" % ((other,) + sync.unclosed))
        theirs = declared_paths(recs, lenient=True)
        shared = [a for a in mine if any(paths_overlap(a, b) for b in theirs)]
        if not shared:
            continue
        sample = "、".join(shared[:3]) + (" 等 %d 个" % len(shared) if len(shared) > 3 else "")
        if other in deps:
            notes.append("与 %s 重叠 %d 个文件，已声明依赖" % (other, len(shared)))
            continue
        if created_problem:
            undecidable.append((other, sample))
            notes.append("与 %s 重叠 %d 个文件，本变更 created 无效、无法判断先后" % (other, len(shared)))
            continue
        o_created, o_problem = read_created(other)
        if o_problem:
            notes.append("与 %s 重叠 %d 个文件，对方 created 无效（%s），按对方较晚处理，由 %s 声明依赖"
                         % (other, len(shared), o_problem, other))
            continue
        mine_key, their_key, precision = created_keys(created, o_created)
        basis = "created %s / %s%s" % (created["text"], o_created["text"], precision)
        if mine_key == their_key:
            basis += "，相同按 id 字母序"
        if (mine_key, cid) > (their_key, other):
            r.fail(prop.rel, anchor, "与进行中变更「%s」都声明了 %s；本变更创建较晚（%s），proposal 须写「依赖：%s」"
                                     "（80/01 §7）" % (other, sample, basis, other))
            notes.append("与 %s 重叠 %d 个文件，本变更较晚（%s），缺「依赖：%s」" % (other, len(shared), basis, other))
        else:
            notes.append("与 %s 重叠 %d 个文件，本变更较早（%s），由 %s 声明依赖" % (other, len(shared), basis, other))
    if undecidable:
        r.fail("%s/%s/.openspec.yaml" % (CHANGES, cid), 1,
               "本变更与进行中变更%s声明了同一文件（%s），但 %s，无法按 created 判断先后：补上 created"
               "（YYYY-MM-DD，可带时刻），或在 proposal 写「依赖：%s」（80/01 §7）" % ("、".join("「%s」" % o for o, _ in undecidable),
                                                        undecidable[0][1], created_problem,
                                                        "、".join(o for o, _ in undecidable)))
    return notes


# ------------------------------------------------------------------ G3：设计质量门
def screenshot_found(text, cid):
    """该节里第一个存在的截图路径（相对仓库根，目录以 / 结尾）或 None：须落在本变更目录或 docs/20-design/ 内、
    存在且大小写精确，是图片文件或直接含图片的目录（不递归）。"""
    cands = re.findall(r"`([^`\n]+)`", text)
    cands += re.findall(r"\]\(\s*<?([^)\s>]+)>?", text)
    cands += re.findall(r"(?<![A-Za-z0-9_./-])([A-Za-z0-9_./-]+\.(?:png|jpe?g|webp|gif|avif))(?![A-Za-z0-9_])",
                        text, re.I)
    change_dir = os.path.normpath(os.path.join(REPO, CHANGES, cid))
    design_dir = os.path.normpath(os.path.join(DOCS, "20-design"))
    roots = (change_dir, design_dir)
    for c in cands:
        c = c.strip()
        if not c or c.startswith(("#", "//")) or URL_RE.match(c):
            continue
        c = c.split("?")[0].split("#")[0].strip()
        if not c:
            continue
        for base in (change_dir, REPO):
            full = os.path.normpath(os.path.join(base, c))
            if not any(full == root or full.startswith(root + os.sep) for root in roots):
                continue
            parts = os.path.relpath(full, REPO).split(os.sep)
            if any(p in SHOT_SKIP_DIRS or (p.startswith(".") and p not in (".", "..")) for p in parts):
                continue
            if not exists_exact(full):
                continue
            if os.path.isfile(full) and full.lower().endswith(IMAGE_EXTS):
                return rel(full)
            if os.path.isdir(full) and full != design_dir:
                try:
                    names = os.listdir(full)
                except OSError:
                    continue
                if any(n.lower().endswith(IMAGE_EXTS) and os.path.isfile(os.path.join(full, n)) for n in names):
                    return rel(full) + "/"
    return None


def decision_problems(head, body):
    """设计质量门的拍板行：返回问题 [(行号, 原因)]，空列表表示拍板合格。拍板行是键为「拍板」的行（键带括注的也算，
    报格式错误；「拍板人：」这类其他行是说明），只能有一行，严格按 80/03 §2.2「拍板：已确认 | 日期：YYYY-MM-DD」核对：
    状态恰好是「已确认」，字段只有「日期」，日期恰好是有效的 YYYY-MM-DD；状态与日期都不带括注，行里任何位置出现
    「部分」或「待定」「未确认」等字样都不算拍板。"""
    lines = []
    for no, raw in body:
        c = canon(raw)
        m = DECIDE_KEY_RE.match(c)
        if m and strip_note(m.group(1).strip()) == "拍板":
            lines.append((no, c, m.group(1).strip(), m.group(2).strip()))
    if not lines:
        return [(head, "设计质量门缺少%s（80/01 §4）" % DECIDE_FORM)]
    if len(lines) > 1:
        return [(lines[1][0], "设计质量门有 %d 行拍板行（第 %s 行），只能保留一行：%s"
                 % (len(lines), "、".join(str(l[0]) for l in lines), DECIDE_FORM))]
    no, text, key, value = lines[0]
    out = []
    if key != "拍板":
        out.append((no, "拍板行的键只能是「拍板」，现为「%s」（键不带括注，说明另起一行写），应为%s" % (key, DECIDE_FORM)))
    status, fields, names = parse_confirm(value, ("日期",))
    if status != "已确认":
        out.append((no, "拍板行应为%s，现为「%s」（状态只能写「已确认」，不能带括注或其他文字：部分确认、有条件确认、待定都"
                        "不算拍板，说明另起一行写，80/01 §4）" % (DECIDE_FORM, text)))
        return out
    for why in shape_problems("拍板行", names, ("日期",), {"日期": "日期：YYYY-MM-DD"}):
        out.append((no, "%s，应为%s" % (why, DECIDE_FORM)))
    date = fields.get("日期")
    if date is not None and not valid_date(date):
        out.append((no, "拍板行的日期「%s」不是有效的 YYYY-MM-DD（日期后不能带括注，说明另起一行写）" % date))
    word = unsettled_word(value)
    if word:
        out.append((no, "拍板行写了「%s」：只确认了一部分或还有未定项时不算拍板，全部确认后再写%s（80/01 §4）"
                    % (word, DECIDE_FORM)))
    return out


def check_design_gate(cid, sync, matrix, review, r):
    """返回摘要片段。该节只有一行「不触发…」时才算不触发；写了「不触发」又有其他内容判失败并照常核对。"""
    if matrix.get("设计", {}).get("kind") != "need":
        return "设计质量门 不适用（设计不涉及）"
    if review is None or review["state"] != "confirmed":
        return "设计质量门 未核对（评审未确认）"
    sec = sync.section("设计质量门")
    if sec is None:
        r.fail(sync.rel, 1, "设计行需更新且评审已确认，但缺少「## 设计质量门」节（写「不触发」或填写质量门）")
        return "设计质量门 缺节"
    head, body = sec
    content = [(no, t) for no, t in body if t.strip()]
    stated = [no for no, t in content if NOT_TRIGGERED_RE.match(canon(t))]
    if stated and len(content) == 1:
        return "设计质量门 不触发"
    fails = []
    if stated:
        others = [no for no, _ in content if no != stated[0]]
        fails.append((stated[0], "「## 设计质量门」写了「不触发」，但该节还有其他内容（第 %s 行）：不触发时该节只留这一行"
                                 "（理由写在同一行，如「不触发（只改文案措辞）」），触发时删去这一行并填写质量门"
                                 "（80/01 §4）" % "、".join(str(n) for n in others[:5])))
    text = "\n".join(t for _, t in body)
    hint = ""
    if not stated and not content:
        hint = "（不涉及界面时该节写一行「不触发」）"
    elif not stated and "不触发" in text:
        hint = "（不触发时该节只写一行「不触发」「不触发（理由）」或「不触发：理由」）"
    if "#/" not in text:
        fails.append((head, "设计质量门缺少样张路由（含 #/）%s" % hint))
    if not screenshot_found(text, cid):
        fails.append((head, "设计质量门缺少存在的截图路径（本变更目录或 docs/20-design/ 下的图片文件，或直接含图片的"
                            "目录）"))
    absent_q = [q for q in ("Q%d" % i for i in range(1, 11))
                if not re.search(r"(?<![A-Za-z0-9])" + q + r"(?![0-9])", text)]
    if absent_q:
        fails.append((head, "设计质量门缺少检查项 %s（80/01 §4）" % "、".join(absent_q)))
    fails.extend(decision_problems(head, body))
    for no, why in fails:
        r.fail(sync.rel, no, why)
    if not fails:
        return "设计质量门 已核对"
    return "设计质量门 写了「不触发」又有其他内容" if stated else "设计质量门 不完整"


# ------------------------------------------------------------------ G3 汇总
def gate_impact(ctx):
    r = Result("impact")
    cid = ctx.change_id
    for where, problem in ctx.change_problems:   # 写错的来源不能让只改文档的分支静默通过
        r.fail(where, 1, problem)
    if cid is None:
        if ctx.change_problems:
            return r.finish("", "变更来源有误、没有可用的变更 id，无法核对矩阵")
        return r.skip("未关联变更")
    cdir = "%s/%s" % (CHANGES, cid)
    head = "变更 %s：" % cid
    prop = Doc(cdir + "/proposal.md")
    if not ctx.change_dir_ok():
        r.fail(prop.rel, 1, "找不到 proposal.md：" + change_missing_reason(cid))
        return r.finish("", head + "变更目录不可用")
    if not prop.exists:
        r.fail(prop.rel, 1, "找不到 proposal.md")
        return r.finish("", head + "没有 proposal.md")
    if prop.error:
        r.fail(prop.rel, prop.error_line, prop.error)
        return r.finish("", head + "proposal.md 无法读取")
    if prop.unclosed:
        r.fail(prop.rel, prop.unclosed[0], unclosed_reason(prop))
    for f in duplicate_sections(prop, PROPOSAL_SECTIONS):
        r.fail(*f)
    matrix = check_matrix(prop, r)
    parts = []
    need = [l for l in MATRIX_LINES if matrix and matrix.get(l, {}).get("kind") == "need"]
    if matrix is not None:
        parts.append("矩阵 %d 行，需更新 %d 行（%s）" % (len(matrix), len(need), "、".join(need) or "无"))
    sync = Doc(cdir + "/docs-sync.md")
    records = None
    if not sync.exists:
        if need:
            r.fail(sync.rel, 1, "找不到 docs-sync.md，无法核对「需更新」行（%s）的回写记录" % "、".join(need))
    elif sync.error:
        r.fail(sync.rel, sync.error_line, sync.error)
    else:
        if sync.unclosed:
            r.fail(sync.rel, sync.unclosed[0], unclosed_reason(sync))
        # 模板节重复：G2 触发时「## 评审」的重复由 G2 报
        for f in duplicate_sections(sync, [t for t in SYNC_SECTIONS if not (ctx.code_paths and t == "评审")]):
            r.fail(*f)
        records = parse_records(sync, r)
    if records is not None:
        n_paths = check_records(ctx, sync, records, matrix, prop, r)
        parts.append("回写记录 %d 条、路径 %d 个" % (len(records), n_paths))
    parts.append(check_new_features(ctx, prop, matrix, r))
    if records is not None:
        notes = check_overlap(ctx, cid, prop, records, r)
        parts.append("；".join(notes) if notes else "与其他进行中变更无重叠")
    if sync.readable():
        review, structure = review_info(sync)
        if not ctx.code_paths:                  # G2 不触发：评审行的格式问题由 G3 报
            design_need = bool(matrix) and matrix.get("设计", {}).get("kind") == "need"
            if review is not None or design_need:
                for f in structure:
                    r.fail(f[0], f[1], f[2] + ("（设计行需更新，设计质量门要看评审行）" if review is None else ""))
            if review is not None:
                for p in review["problems"]:
                    r.fail(sync.rel, review["no"], "%s（只改文档时 G2 不触发，由 G3 核对评审行格式）" % p)
        if matrix is not None:
            parts.append(check_design_gate(cid, sync, matrix, review, r))
    if r.notes:
        parts.append("注：" + "；".join(r.notes))
    return r.finish(head + "；".join(parts), head + "；".join(parts) + "；失败 %d 项" % len(r.failures))


# ------------------------------------------------------------------ 主流程
RUNNERS = {"link": gate_link, "review": gate_review, "impact": gate_impact}


def parse_args(argv):
    opts = {"gate": "all", "change": None, "base": None, "json": False, "list_reqs": False}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a in ("-h", "--help"):
            opts["help"] = True
        elif a == "--json":
            opts["json"] = True
        elif a == "--list-reqs":
            opts["list_reqs"] = True
        elif a.split("=", 1)[0] in ("--gate", "--change", "--base"):
            key = a.split("=", 1)[0][2:]
            if "=" in a:
                value = a.split("=", 1)[1]
            else:
                i += 1
                if i >= len(argv):
                    raise UsageError("%s 需要一个值" % a)
                value = argv[i]
            opts[key] = value.strip()
        else:
            raise UsageError("不认识的参数：%s" % a)
        i += 1
    if opts["gate"] not in ("link", "review", "impact", "all"):
        raise UsageError("--gate 只能是 link、review、impact 或 all，现为「%s」" % opts["gate"])
    if opts["change"] is not None and (not CHANGE_ID_RE.match(opts["change"]) or opts["change"] == ARCHIVE):
        raise UsageError("--change 的变更 id「%s」不合法：须为 kebab-case（如 design-language-v3）" % opts["change"])
    if opts["base"] is not None and not opts["base"]:
        raise UsageError("--base 不能为空")
    return opts


def header_line(ctx):
    problems = [p for _, p in ctx.change_problems]
    if ctx.change_id:
        change = "变更 %s（%s）" % (ctx.change_id, ctx.change_source)
        if problems:
            change += "；注意：%s" % "；".join(problems)
    elif problems:
        change = "变更未关联（%s）" % "；".join(problems)
    else:
        change = "变更未关联（%s）" % "；".join(ctx.change_tried)
    return ("%s：%s；基点 %s（merge-base %s）；本分支改动 %d 个文件（提交 %d、工作区 %d、未跟踪 %d），"
            "其中代码路径 %d 个" % (TOOL, change, ctx.base, ctx.merge_base[:7], len(ctx.changed), len(ctx.committed),
                               len(ctx.worktree), len(ctx.untracked), len(ctx.code_paths)))


def to_json(ctx, results, code):
    return OrderedDict([
        ("tool", TOOL),
        ("change", OrderedDict([("id", ctx.change_id), ("source", ctx.change_source),
                                ("problems", [OrderedDict([("where", w), ("reason", p)])
                                              for w, p in ctx.change_problems]),
                                ("branch", ctx.branch)])),
        ("base", OrderedDict([("ref", ctx.base), ("mergeBase", ctx.merge_base)])),
        ("changedFiles", OrderedDict([("total", len(ctx.changed)), ("committed", len(ctx.committed)),
                                      ("worktree", len(ctx.worktree)), ("untracked", len(ctx.untracked)),
                                      ("codePaths", ctx.code_paths)])),
        ("gates", [OrderedDict([("gate", res.gate), ("name", res.name), ("option", res.key),
                                ("status", res.status), ("statusText", STATUS_TEXT[res.status]),
                                ("summary", res.summary), ("notes", res.notes),
                                ("failures", [OrderedDict([("file", f), ("line", ln), ("reason", why)])
                                              for f, ln, why in res.failures])])
                   for res in results]),
        ("ok", code == 0),
        ("exitCode", code),
    ])


def error_exit(opts, message):
    if opts.get("json"):
        print(json.dumps(OrderedDict([("tool", TOOL), ("error", message), ("ok", False), ("exitCode", 2)]),
                         ensure_ascii=False, indent=2))
    print("%s：%s" % (TOOL, message), file=sys.stderr)
    return 2


def main(argv):
    try:
        opts = parse_args(argv)
    except UsageError as exc:
        print("%s：%s（用法见 --help）" % (TOOL, exc), file=sys.stderr)
        return 2
    if opts.get("help"):
        print(__doc__)
        return 0
    try:
        if opts["list_reqs"]:
            res = prdlib.load_prd(DOCS)
            errors = res.all_errors()
            print(json.dumps(OrderedDict([
                ("count", len(res.reqs)),
                ("requirements", [prdlib.req_json(q) for q in res.reqs.values()]),
                ("errors", [OrderedDict([("file", f), ("line", ln), ("message", why)]) for f, ln, why in errors]),
            ]), ensure_ascii=False, indent=2))
            for f, ln, why in errors:
                print("%s：%s:%d %s" % (TOOL, f, ln, why), file=sys.stderr)
            return 1 if errors else 0
        ctx = Context(opts["change"], opts["base"])
        keys = list(GATES) if opts["gate"] == "all" else [opts["gate"]]
        results = [RUNNERS[k](ctx) for k in keys]
    except EnvError as exc:
        return error_exit(opts, str(exc))
    except Exception as exc:                    # 意外异常：不吐 Traceback，按环境错误退出 2（CORDEX_DEBUG=1 时原样抛出）
        if os.environ.get("CORDEX_DEBUG"):
            raise
        frame = traceback.extract_tb(exc.__traceback__)[-1]
        return error_exit(opts, "内部错误（%s: %s；%s:%d %s），请把命令与输出反馈给维护者"
                          % (type(exc).__name__, exc, os.path.basename(frame.filename), frame.lineno, frame.name))
    code = 1 if any(res.status == "fail" for res in results) else 0
    if opts["json"]:
        print(json.dumps(to_json(ctx, results, code), ensure_ascii=False, indent=2))
        return code
    print(header_line(ctx))
    for res in results:
        print("%s %s：%s — %s" % (res.gate, res.name, STATUS_TEXT[res.status], res.summary))
        for f, ln, why in res.failures:
            print("  - %s:%d %s" % (f, ln, why))
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
