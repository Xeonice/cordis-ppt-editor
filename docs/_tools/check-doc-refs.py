#!/usr/bin/env python3
"""check-doc-refs：流程门禁 G5 文档引用反查（docs/80-process/02 §3、03 §1，rulings §4.25）。

只用标准库（兼容 Python 3.9）；除 --write-baseline 外只读。文档里引用了归属在别处的键时，键必须在归属文档中存在。
首批六类引用与归属（80/02 §3）：

  类别        引用形式                                         必须存在于
  需求编号    PRD:ED-05、PRD ED-05 或功能域前缀的裸编号         PRD 需求清单（prdlib.load_prd）
  REST 路由   反引号内「GET|POST|PUT|PATCH|DELETE /路径」       60-backend/15 路由表（方法列 + 路径列）
  错误码      反引号内点分小写码，如 server.plugins.conflict    30-architecture/10 登记的错误码集合
  界面        03-screens/NN、「设计 03-NN」                     20-design/03-screens/NN-*.md
  ADR         ADR-00NN                                          30-architecture/adr/00NN-*.md
  裁决小节    rulings §4.N                                      rulings 中的「## 4.N」标题

共享模块 prdlib.py（check-req-coverage.py、check-change-impact.py 用同一份代码，规则清单见其文件头）负责：读文件与解码、
Markdown 正文切分（围栏代码块、HTML 注释、「> 状态：」头行）、GFM 表格与单元格、行内代码片段的配对、PRD 需求清单、需求
编号引用的归类（CO 须带 PRD 字样、证据条目、能力 id）与「明示 PRD」判定。本脚本只实现 G5 自己的部分，即下文各条。

扫描范围与豁免（80/02 §3：豁免沿用 check-terms.py 的口径）：
  - docs/ 下全部 .md，跳过 00-charter/rulings-*（裁决原文）、_evidence/（证据快照）、playground（含源码）、mockups、
    prototype、node_modules、dist、docs-site 与点开头的目录。给出文件参数时只查这些文件（按绝对路径去重），docs/
    里的文件同样适用这些路径豁免；
  - 只查正文（prdlib.ref_lines 的缺省取行：去掉围栏代码块、HTML 注释与「> 状态：」头行，行号不变）；
  - 历史陈述行整行不查、不计数：行内含 check-terms.py 的历史陈述标记「原名 / 原称 / 原： / 弃 / 作废 / 取代 / 替换 /
    → 2026- / 旧名」（即 80/02 §3 所说「原 / 旧 / 作废 / 取代 / → 2026-」；词表与 check-terms.py 的 MARKERS 逐字
    相同）时，该行六类引用都不看，表格行同样整行豁免；词表不增不减，也不按片段或单元格细分；
  - 归属文档自己登记的已删除、已废弃键不算引用：60/15「已删除端点」表的行与「仍未排期的端点」段落，以及 60/15
    别处提到的、它自己登记为已删除或未排期的端点（§9 路由决定表里的「删除 `GET /imports/:jobId`」）；30/10 里提到的、
    它自己声明废弃的码（见下文「错误码」）。别的文档提到这些键照常按失配报出（60/15：「任何文档、代码或测试再出现
    即视为回退」），除非该行带历史陈述标记。
  读取问题（来源文件或归属文档）：不是 UTF-8 的按替换字符继续检查，报首个坏字节所在行；围栏代码块或 HTML 注释直到文件
  尾没闭合时报起始行（其后的内容都不检查）；读不了的来源文件（断链、无权限）报在第 1 行。读取问题以退出码 1 结束，
  --write-baseline 时不写基线。

需求编号：
  - 需求清单与引用归类都用 prdlib（规则见 prdlib.py 文件头「PRD 需求清单」「需求编号引用识别」）：classify_refs 归为
    prd、且前缀是功能域的编号才是需求引用；不带 PRD 字样或属于 rulings §4.18 的 CO 编号、证据条目、能力 id 不查也不计数。
    G5 只用编号是否存在；PRD 的格式错误由 G4（check-req-coverage.py）报，这里不重复，PRD 读不了或不是 UTF-8 时照样报
    读取问题。--registry 输出需求清单（prdlib.req_json，与 G4 的 --json 同一结构）供交叉核对；
  - G5 的归属解析：需求引用在 PRD 中即有效。不在 PRD 时，明示 PRD 的编号（prdlib.explicit_prd_flags：ID 前紧挨「PRD:」
    「PRD 」、指向 10-prd 的链接文字或紧跟 10-prd 路径、这些编号的列表续项；以及所有算作需求引用的 CO 编号）直接报
    失配，同形编号另有归属（rulings §4.18 的条目、50/18 的能力 id）时在原因里注明；其余裸编号再查 50-frontend/18
    能力表（表头「id | 能力」）的能力 id（表外写的「- **ML-09**：…」「能力 ML-09」），没有才报失配。

REST 路由：反引号内的「方法 /路径」，方法可并列（「PUT / DELETE /x」「PUT|DELETE /x」「GET、PUT /x」「GET, PUT /x」拆成
  多处）；路径遇到空白、反引号或中文标点（、，。；：（）「」【】）即止；比较前去掉 /api/v1 前缀与查询串、末尾斜杠，
  :param、{param}、<param> 统一为占位（{ param } 内可带空格），段内「a|b」「{a|b}」展开为多条；请求体提示——紧贴路径的
  「{…}」（不在段首，如「POST /imports{ uploadId }」）或路径之后隔空白的「{…}」（「POST /imports { uploadId }」）——不参与
  路由匹配；末尾「*」是前缀通配（「GET/PATCH /admin/plugins*」「GET /documents/*」：有该方法的路由以这些段开头即可）；
  没有字母的路径（如「GET /…」占位）不算引用。路由表取 60/15 中表头含「方法」「路径」两列的全部表格；路径格里
  「name ∈ a | b」写明取值的占位段只认这些取值。逐段比对：引用的占位段只匹配路由的占位段；引用的字面段匹配路由的同名
  字面段，或填进路由的占位段——带取值的占位只收取值，其余占位只收示例值：不像 60/15 路由字面段（「小写字母开头、只含
  小写字母数字与连字符」的词）的值，如「A」「T」「__cover」「test:ui-q」「123」「3f2a…」，以及 UUID（8-4-4-4-12 位
  十六进制）与 ≥ 8 位、兼有数字和字母的十六进制串；与某个路由字面段只差大小写的值（「Comments」）不收。所以
  「GET /documents/serch」「GET /jobs/bogus16」「/documents/doc-1」「/documents/abc123」不会被「/documents/:id」
  「/jobs/:id」吸收、「POST /automation/fill-template」不会被「/automation/:kind（kind ∈ convert | validate | migrate）」
  吸收。以「…/」开头的省略写法从路由某一段起对齐，首段必须对上同名字面段（或占位对占位），之后的段按上面规则，窗口
  之后只允许剩占位段（「GET …/diff」认「…/diff/:b」）。60/15 的另两类登记：「已删除端点」表（首列「端点」）的行不算
  引用，别处再用这些端点按失配报出并注明替代；「仍未排期的端点」段落本身不算引用，别处出现其中的端点按失配报出并注明
  「尚未进路由表」。这两类登记带请求体提示时（「PATCH /documents/:id{ pinned }」「POST /documents{ template }」），同方法、
  同路径且提示里有同名字段的引用（提示紧贴或隔空白都算）照样按已删除 / 未排期报出，即使去掉提示后与活路由重名；不带
  提示的同路径引用按活路由判定。

错误码：
  - 登记集合（30/10）：「域 | 码」登记表（§1.1a，域 × 码展开）、表头以「码」「错误码」开头或为「定稿」的列里的码（§1.4、
    配额三码表、§11.2；紧跟在「原 / 原名 / 原称 / 旧 / 废 / 弃」之后的旧码不算）、TS 围栏里 'x.y': 形式的声明键；「*.名」
    通配只在同一单元格列了域时对这些域展开，没列域的（§1.4 的 *.validation_failed 等 HTTP / WS 映射规则）不展开。已登记
    域 = 登记表的域 + 已登记码的域 + §1.1 中以空格分隔连写的域清单（≥ 3 个）；命名空间 = 已登记域的首段。已废弃码 =
    30/10 正文里紧挨在「废 / 作废 / 废弃 / 弃用 / 不再使用 / 原 / 原名 / 原称 / 旧 / 旧名」之后、或紧跟着「不再使用 /
    作废 / 已作废 / 已废弃 / 废弃 / 弃用 / 已弃用」的未登记码形 token（末段含下划线），以列表符（、 / 与 和 及 或 , ，）
    连写的同组 token 一并算；30/10 里提到这些码不算引用；
  - 另有归属的键（80/02 §2，与错误码共用命名空间）：40-modules/16 的贡献点 id（表头首格「贡献点…」）、60-backend/07 的
    审计 action（首格「action」）、50-frontend/15 与 60-backend/18 的 span 名（首格「span」）及 30/10 §3.2 正文列出的
    span、60-backend/17 的配置键（首格「路径」「键」）、30-architecture/05 的命令与变更 id（首格「id」「type」）；
  - 候选 token：反引号内首段属于命名空间的点分小写 token（各段 [a-z][a-z0-9_]*；片段内紧跟「: 」的也算，「slide.ui:zh-CN」
    这类紧贴冒号的键、含大写字母的键不算），含通配「x.*」「x.y.*」；末段为文件扩展名的是文件名（前缀为已登记的两段域时
    除外，如 server.documents.lock 仍按码看），与已登记域同名的是域引用，都不看；
  - 错误码语境（只用于下面的 ③ 与 ⑥）。同一单元格（表格行）或同一行内判断：
      强语境：片段所在表格列的表头含「码」（「编码」「代码」除外）或为「定稿」；片段前 12 字以内（同一分句）紧挨
        「…码」（同样除外编码、代码）或「错误域（前缀）」，其后可带「为 / 是」、左括号、冒号或等号；片段内有错误用法
        （errors.report( / errors.create( / err( / code: / code= / Error< / ?error= / error:）；以列表符（、 / 或 与 和 及
        , ，）与上一个强语境片段连写；
      弱语境（含强语境）：表头另含「错误」「诊断」「点式值」；片段前紧挨「错误域 / 错误类型 / 错误 / 诊断 / 抛 / 抛出 /
        报 / 报错 / 拒绝 / 失败（时）返回 / 失败（时）为 / Result 为 / reason（为）/ error（code）/ code」或 HTTP / WS 状态码
        （可带「为 / 是」、左括号、冒号或等号；「上报 / 汇报 / 通报 / 播报 / 预报 / 简报 / 情报 / 警报 / 电报」不算）；片段
        后紧跟括注状态码（「`x`（409）」）或「错误 / 报错」；「以 `x` 失败」；同一分句（按「。；」切）出现「错误码」
        「诊断码」；以列表符与上一个弱语境片段连写；
  - 判定顺序（每个候选 token 取第一条成立的）：
      ① 已登记的码：有效引用。通配「p.*」有已登记码以「p.」开头即有效（只登记了域、没有码的前缀不算）；
      ② 30/10 记为已废弃的码，以及前缀下只有已废弃码的通配：失配（注明已废弃）；
      ③ 不是错误码的同形键：另有归属的键；通配「p.*」中 p 是另有归属的键或其真前缀，或 p 的首段在 30/10 没有任何登记码、
         而另有归属的键用这个首段（现有 slide、command、layout、store）；以及表头以「键」「键名」结尾的列（budgets.json 键、
         配置键）里的 token。这些不看、不计数，只在强语境里才按错误码核对（30/10 没有即失配，注明同形键的归属）；
      ④ 其余通配一律核对，不需要语境：没有已登记码以「p.」开头即失配（transport.*、format.docx.*、server.nonexist.*）；
      ⑤ 码形 token，未登记即失配，不需要语境：server 命名空间的两段 token（server.<资源> 是域引用，资源未登记即失配，
         如 server.webhook）与三段及以上 token（server 下的码都是 server.<资源>.<名>，server.document.locked 这类域名写错
         的也要报）；前两段是已登记的两段域（format.pptx.x）；其余三段且末段含下划线（域未登记，注明）；两段且末段含
         下划线、或末段是已登记码用过的单词名（forbidden、unavailable、conflict 等）、或与同域已登记码只差一两个字符
         （疑似拼错）；
      ⑥ 其余非通配 token——server 之外两段且末段是普通单词（store.transact、slide.crop 的同形写法）、server 之外三段且
         末段不含下划线、server 之外四段及以上——只在弱语境里才算引用（这些同形写法在现有文档里多是命令、API、作业名、
         i18n 命名空间与 DOM 接口；只按命名空间过滤会多报约 200 处误报）。

界面：「03-screens/NN」；「设计 03-NN」「设计：03-NN」，及其后以「、」「/」「与」「和」「及」「或」「，」连写的「03-MM」（可带
  链接）；「设计 [03-NN](…/03-screens/NN-x.md)」只计一处。
裁决小节：「rulings §4.N」，以及链接与文件名写法「[rulings](…/rulings-2026-09-14.md) §4.N」「`00-charter/rulings-2026-09-14.md`
  §4.N」「rulings-2026-09-14.md §4.N」；其后以「、」「/」「，」「与」「和」「及」「或」「+」连写的「§4.M」同样计入，中间可隔
  一个条目 id（「rulings §4.21 Q3、§4.22 Q5」「rulings §4.25/§4.24」）。界面号、ADR 号、裁决小节号的数字只认半角。

棘轮（80/02 §3）：基线（缺省 <docs>/_tools/doc-refs-baseline.json，随 CORDEX_DOCS_ROOT 变）以（文件, 类别, 引用）为键、
出现次数为值，不含行号。现有次数超过基线即「新增」，失败；基线里有、现在少了即「可收紧」，同样失败，提示运行
--write-baseline 收紧，使基线只减不增，由变更 docs-coverage-baseline 清零。基线文件不存在时视为空；不是合法 JSON 或条目
不合法时报「基线文件:行」、退出码 1（--write-baseline 不带文件参数时照样整体重写）。给出文件参数时只对这些文件的键做
比对；--write-baseline 此时只替换这些文件的键、保留其余。

输出：先打印汇总行
  check-doc-refs：来源 N 个文件；引用 M 处（各类计数）；失配 X 处（基线内 Y、新增 Z）；可收紧 W 处[；读取问题 R 处][；基线问题 B 处]
再逐条列出读取问题与基线问题（「文件:行 → 原因」）、新增失配「文件:行 → 引用（原因）」（同一行同一引用出现多次时只列一行并注明处数）与可收紧条目。
退出码：0 通过；1 有新增失配、可收紧条目、读取问题或基线不合法；2 环境或用法错误（未知选项、文件参数不存在或是目录、
docs 根目录不存在、归属文档或基线文件读不了、内部错误），--json 时照样输出含 error 字段的 JSON。

用法：
  python3 docs/_tools/check-doc-refs.py                     # 全量，按缺省基线棘轮判定
  python3 docs/_tools/check-doc-refs.py <文件...>           # 只查这些来源文件
  选项：--baseline <路径>   改用别的基线文件
        --write-baseline    按当前失配重写基线并退出 0（较原基线新增的键逐条列出，须在评审中说明；与 --json 同用时
                            输出机读结果）
        --json              机读输出（汇总、逐键失配与行号、可收紧条目、读取问题）
        --all               另列出基线内的失配
        --summary           只打印汇总行
        --registry          打印解析出的归属集合（需求清单含优先级、里程碑与豁免，证据清单编号，路由与取值枚举，已删除
                            与未排期端点，错误码、已废弃码与命名空间，另有归属的键，rulings §4.18 条目，能力 id，界面号，
                            ADR 号，裁决小节）的 JSON，供交叉核对，不做检查
环境变量 CORDEX_DOCS_ROOT 换 docs 根目录（自测用，缺省基线随之变为 <CORDEX_DOCS_ROOT>/_tools/doc-refs-baseline.json）。
"""
import difflib
import glob
import json
import os
import re
import sys
import traceback
from collections import Counter, OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:                 # 以模块方式加载（importlib、别的目录下运行）时也找得到同目录的 prdlib
    sys.path.insert(0, HERE)
import prdlib  # noqa: E402

DOCS = os.path.normpath(os.path.abspath(os.environ.get("CORDEX_DOCS_ROOT") or os.path.join(HERE, "..")))
REPO = os.path.dirname(DOCS)
DEFAULT_BASELINE = os.path.join(DOCS, "_tools", "doc-refs-baseline.json")     # 随 CORDEX_DOCS_ROOT 变（同 G4）
TOOL = "check-doc-refs"

REST_CATALOG = os.path.join(DOCS, "60-backend", "15-rest-api-catalog.md")
ERRORS_DOC = os.path.join(DOCS, "30-architecture", "10-observability-and-errors.md")
SCREENS_DIR = os.path.join(DOCS, "20-design", "03-screens")
ADR_DIR = os.path.join(DOCS, "30-architecture", "adr")
CHARTER_DIR = os.path.join(DOCS, "00-charter")
CAPABILITIES_DOC = os.path.join(DOCS, "50-frontend", "18-editor-capabilities.md")
# 与错误码同一命名空间、但归属在别处的键（80/02 §2）：(文件, 表头首格, 类别)，取首列反引号里的键
OTHER_KEY_TABLES = (
    (os.path.join(DOCS, "40-modules", "16-plugin-catalog.md"), r"^贡献点", "贡献点 id（40-modules/16）"),
    (os.path.join(DOCS, "60-backend", "07-modules-comments-webhooks-audit.md"), r"^action$",
     "审计 action（60-backend/07）"),
    (os.path.join(DOCS, "50-frontend", "15-events-errors-and-telemetry.md"), r"^span$", "span 名（50-frontend/15）"),
    (os.path.join(DOCS, "60-backend", "18-observability-and-ops-endpoints.md"), r"^span$", "span 名（60-backend/18）"),
    (os.path.join(DOCS, "60-backend", "17-deployment-and-config.md"), r"^(?:路径|键)$", "配置键（60-backend/17）"),
    (os.path.join(DOCS, "30-architecture", "05-command-and-history.md"), r"^(?:id|type)$",
     "命令 / 变更 id（30-architecture/05）"),
)
SPAN_SECTION = "3.2"          # 30/10 §3.2 正文列出的 span 名

# 与 check-links.py / gen-docs-site.py 一致，另跳过生成物 docs-site 与点开头的目录
SKIP_DIRS = {"node_modules", "dist", "playground", "_evidence", "mockups", "prototype", ".git", "docs-site"}
SKIP_PREFIXES = ("00-charter/rulings-", "00-charter/_evidence/", "_evidence/")
# 与 check-terms.py 的 MARKERS 逐字相同（80/02 §3：「原 / 旧 / 作废 / 取代 / → 2026-」等历史陈述标记）；含其一的行整行不查
MARKERS = ("原名", "原称", "原：", "弃", "作废", "取代", "替换", "→ 2026-", "旧名")

CATEGORIES = OrderedDict([
    ("req", "需求编号"), ("rest", "REST 路由"), ("errcode", "错误码"),
    ("screen", "界面"), ("adr", "ADR"), ("ruling", "裁决小节"),
])

HEADING_NUM_RE = re.compile(r"^\s{0,3}(#{1,6})\s+(\S+)")
UNCLOSED_MSG = "%s从这一行起直到文件尾都没有闭合：其后的内容都不检查（补上闭合行）"

# ------------------------------------------------------------------ 需求编号（G5 的归属解析；识别与 PRD 解析在 prdlib）
REQ_ID = prdlib.ID_PATTERN
ENTRY_ROW_RE = re.compile(r"^\s*\|\s*[*`]*(" + REQ_ID + r")(?![A-Za-z0-9])")
ENTRY_BULLET_RE = re.compile(r"^\s*[-*+]\s*\*\*(" + REQ_ID + r")\*\*")
EVIDENCE_REF_RE = re.compile(r"^_evidence/[\w.\-]+\.json$")
EVIDENCE_ID_RE = re.compile(r'"id"\s*:\s*"(' + REQ_ID + r')"')

# ------------------------------------------------------------------ 其他类别的识别式
METHOD = r"(?:GET|POST|PUT|PATCH|DELETE)"
METHOD_SEP = r"\s*(?:/|\\?\||、|,|，)\s*"
# 路径不含空白、反引号与中文标点；「{…}」整体算路径的一部分（可带空格：「/documents/{ docId }」「/imports{ uploadId }」）
PATH_CHAR = r"[^\s`{、，。；：（）「」【】]"
REST_REF_RE = re.compile(r"(?<![A-Za-z])(" + METHOD + r"(?:" + METHOD_SEP + METHOD + r")*)\s+"
                         r"((?:…|\.\.\.)?/(?:" + PATH_CHAR + r"|\{[^{}`]*\})*)(\s+\{[^{}`]*\})?")
CODE_TOKEN_RE = re.compile(
    r"(?<![A-Za-z0-9_.\-/@*$])([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+(?:\.\*)?|[a-z][a-z0-9_]*\.\*)"
    r"(?![A-Za-z0-9_\-/(.=])(?!:\S)")
FILE_EXTS = {"ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs", "json", "jsonc", "md", "mdx", "css", "scss",
             "html", "xml", "yaml", "yml", "toml", "sql", "sh", "py", "txt", "csv", "lock", "env", "rels", "bin",
             "pptx", "pptm", "potx", "ppt", "docx", "xlsx", "zip", "pdf", "png", "jpg", "jpeg", "gif", "svg",
             "webp", "emf", "wmf", "ttf", "otf", "woff", "woff2", "map", "wasm", "lua", "d", "log"}
SCREEN_PATH_RE = re.compile(r"(?<![A-Za-z0-9])03-screens/([0-9]{2})(?![0-9])")
SCREEN_DESIGN_RE = re.compile(r"设计\s*[：:]?\s*\[?03-([0-9]{2})(?![0-9])")
SCREEN_CHAIN_RE = re.compile(r"\]?(?:\([^)\s]*\))?\s*(?:、|/|／|与|和|及|或|,|，)\s*\[?03-([0-9]{2})(?![0-9])")
LINK_TARGET_RE = re.compile(r"\]\(([^)\s]*)\)")
ADR_RE = re.compile(r"(?<![A-Za-z0-9])ADR-([0-9]{4})(?![0-9])")
# 「rulings §4.N」「[rulings](…) §4.N」「`…/rulings-2026-09-14.md` §4.N」「rulings-2026-09-14.md §4.N」「[x](…/rulings-….md) §4.N」
RULING_RE = re.compile(r"(?<![A-Za-z0-9])rulings(?:-[0-9]{4}-[0-9]{2}-[0-9]{2}(?:\.md)?(?:#[^\s)`\]]*)?)?"
                       r"(?:[`*_]*\]\([^)\s]*\)|[`*_]*\)?)\s*[*_]*\s*§\s?4\.([0-9]+)(?![0-9])")
RULING_ENTRY = r"[A-Za-z][A-Za-z0-9]*(?:[-:+][A-Za-z0-9]+)*"      # 条目 id：Q3、BE-02、S-3a、X:q-xml-ns、BE-01+TX-03
RULING_CHAIN_RE = re.compile(r"(?:[*_`]*\]\([^)\s]*\))?(?:\s*" + RULING_ENTRY + r")?\s*(?:、|/|／|,|，|与|和|及|或|\+)"
                             r"\s*\[?[*_`]*§\s?4\.([0-9]+)(?![0-9])")

# 错误码语境（文件头「错误码·错误码语境」）
STATUS = r"(?:[1-5][0-9]{2}|4[0-9]{3}|10[0-9]{2})"
CODE_WORD = r"(?<![编代])码"
CTX_TAIL = r"\s*[*_]*\s*(?:为|是)?\s*[（(]?\s*[：:=]?\s*$"
CODE_HEADER_RE = re.compile(CODE_WORD + r"|^定稿$")                       # 强：码列
ERR_HEADER_RE = re.compile(CODE_WORD + r"|错误|诊断|点式值|^定稿$")        # 弱（含强）
KEY_HEADER_RE = re.compile(r"键(?:名)?$")                                 # 非错误键列：budgets.json 键、配置键
ERR_SPAN_RE = re.compile(r"errors?\.(?:report|create|raise|wrap)\(|(?<![A-Za-z])err\(|(?<![A-Za-z])code\s*[:=]"
                         r"|Error<|[?&]error=|(?<![A-Za-z])error\s*[:=]")
STRONG_BEFORE_RE = re.compile(r"(?:" + CODE_WORD + r"|错误域(?:前缀)?)" + CTX_TAIL)
ERR_BEFORE_RE = re.compile(r"(?:" + CODE_WORD + r"|错误域(?:前缀)?|错误类型|错误|诊断|抛出?|报错|(?<![上汇通播预简情警电])报|"
                           r"拒绝|失败(?:时)?(?:返回|为)|返回码|(?<![A-Za-z])Result\s*为|(?<![A-Za-z])reason(?:\s*为)?|"
                           r"(?<![A-Za-z])error(?:\s+code)?|(?<![A-Za-z])code|(?<!\d)" + STATUS + r")" + CTX_TAIL, re.I)
ERR_AFTER_RE = re.compile(r"^\s*[*_]*\s*(?:[（(]\s*" + STATUS + r"(?!\d)|错误|报错)")
WITH_BEFORE_RE = re.compile(r"以\s*[*_]*\s*$")
FAIL_AFTER_RE = re.compile(r"^\s*[*_]*\s*失败")
LIST_SEP_RE = re.compile(r"^\s*(?:、|/|或|与|和|及|,|，)\s*$")
CLAUSE_BOUNDARY_RE = re.compile(r"[，,；;。！？!?]")

# 30/10 里声明废弃的码（只用于解析归属文档，不是引用侧的豁免）
DEPRECATE_BEFORE_RE = re.compile(r"(?:不再使用|作废|废弃|弃用|原名|原称|旧名|(?<![还复恢源草])原|(?<![作报])废|旧)"
                                 r"\s*[：:]?\s*$")
DEPRECATE_AFTER_RE = re.compile(r"^\s*(?:均|都|一律|也|亦)?\s*(?:不再使用|已作废|作废|已废弃|废弃|已弃用|弃用)")


class EnvError(Exception):
    """环境或用法错误：退出码 2。"""


# ------------------------------------------------------------------ 通用
def rel_repo(path):
    return prdlib.show_path(path, REPO)


def rel_docs(path):
    r = os.path.relpath(os.path.abspath(path), DOCS)
    return None if r.startswith("..") else r.replace(os.sep, "/")


def scan_text(text, shown, problems):
    """正文切分（prdlib.scan_markdown）；围栏或注释直到文件尾没闭合时记进 problems。返回 items。"""
    items, unclosed = prdlib.scan_markdown(text)
    if unclosed:
        problems.append((shown, unclosed[0], UNCLOSED_MSG % unclosed[1]))
    return items


def load_items(path, problems):
    """读入并切分：返回 prdlib.scan_markdown 的 items；不是 UTF-8 时按替换字符继续并记进 problems；读不了抛 OSError。"""
    text, bad = prdlib.read_text(path)
    shown = rel_repo(path)
    if bad:
        problems.append((shown, bad[0], bad[1]))
    return scan_text(text, shown, problems)


def code_spans(line):
    """行内代码片段 [(起点, 终点, 内容)]：配对规则同 prdlib.code_ranges（反引号串与其后第一个等长的串配对）。"""
    out = []
    for a, b in prdlib.code_ranges(line):
        n = 0
        while a + n < b and line[a + n] == "`":
            n += 1
        out.append((a, b, line[a + n:b - n]))
    return out


def tables(items):
    """正文里的 GFM 表格（prdlib.iter_tables，不含围栏行）：产出 (表头单元格, [(行号, 行文本, 单元格)])。"""
    rows = [(it[0], it[1]) for it in items if not it[2]]
    for _, header, body in prdlib.iter_tables(rows):
        yield header, [(no, rows[j][1], cells) for j, no, cells in body]


def clause_of(text, start, end, pos):
    """text[start:end] 中 pos 所在的分句（按「。」「；」切）。"""
    seg = text[start:end]
    cut = [m.end() for m in re.finditer(r"[。；;]", seg)]
    lo, hi = 0, len(seg)
    for c in cut:
        if c <= pos - start:
            lo = c
        else:
            hi = c
            break
    return seg[lo:hi]


def history_line(line):
    """历史陈述行（check-terms.py 的口径）：含 MARKERS 中任一标记，整行不查。"""
    return any(mk in line for mk in MARKERS)


# ------------------------------------------------------------------ 归属：需求编号的辅助集合
def parse_ruling_entries(docs):
    """rulings §4.18 的条目编号中与 PRD 同形的 CO 编号（只用于失配原因里的提示）：§4.18 表格首列、
    「- **CO-NN**」条目，以及 §4.18 指明的 _evidence/*.json 清单（如机械修正 67 条）里的 "id"。"""
    ids = set()
    for path in sorted(glob.glob(os.path.join(CHARTER_DIR, "rulings-*.md"))):
        in_sec, evidence = False, set()
        for _, line in prdlib.body_lines(docs.items(path)):
            h = HEADING_NUM_RE.match(line)
            if h and len(h.group(1)) <= 2:
                in_sec = h.group(2) == "4.18"
                continue
            if not in_sec:
                continue
            m = ENTRY_ROW_RE.match(line) or ENTRY_BULLET_RE.match(line)
            if m:
                ids.add(m.group(1))
            for _, _, c in code_spans(line):
                if EVIDENCE_REF_RE.match(c.strip()):
                    evidence.add(c.strip())
        for ref in sorted(evidence):
            try:
                text, _ = prdlib.read_text(os.path.join(os.path.dirname(path), ref))
            except OSError:
                continue
            ids.update(EVIDENCE_ID_RE.findall(text))
    return {i for i in ids if prdlib.domain_of(i) == "CO"}


def parse_capabilities(docs):
    """50-frontend/18 能力表（表头「id | 能力」）首列的能力 id。"""
    caps = set()
    if not os.path.isfile(CAPABILITIES_DOC):
        return caps
    for header, rows in tables(docs.items(CAPABILITIES_DOC)):
        if len(header) >= 2 and prdlib.plain(header[0]).lower() == "id" and prdlib.plain(header[1]) == "能力":
            for _, _, cells in rows:
                m = re.match(r"^[*`]*(" + REQ_ID + r")(?![A-Za-z0-9])", cells[0]) if cells else None
                if m:
                    caps.add(m.group(1))
    return caps


# ------------------------------------------------------------------ 归属：REST 路由表
PARAM_SEG_RE = re.compile(r"^(?::([A-Za-z_][\w-]*)|\{([^{}/|]*)\}|<([^<>/|]*)>)$")
ALT_SEG_RE = re.compile(r"^\{([^{}/]*\|[^{}/]*)\}$")
ENUM_RE = re.compile(r"([A-Za-z_][\w-]*)\s*∈\s*([^）)`；;，,]+)")
ROUTE_WORD_RE = re.compile(r"^[a-z][a-z0-9-]*$")                  # 60/15 路由字面段的形状
EXAMPLE_VALUE_RE = re.compile(r"^[A-Za-z0-9_:@.~-]*[A-Za-z0-9][A-Za-z0-9_:@.~-]*$")
# 一眼可知是 id 的示例值：UUID（8-4-4-4-12 位十六进制）、≥ 8 位且兼有数字和字母的十六进制串
ID_VALUE_RE = re.compile(r"^(?:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|(?=[0-9a-f]*[0-9])(?=[0-9a-f]*[a-f])[0-9a-f]{8,})$")
HINT_FIELD_RE = re.compile(r"[A-Za-z_$][\w$]*")
HINT_LITERALS = {"true", "false", "null", "undefined"}


def hint_fields(hint):
    hint = re.sub(r"'[^']*'|\"[^\"]*\"", "", hint)
    return frozenset(f for f in HINT_FIELD_RE.findall(hint) if f not in HINT_LITERALS)


def body_hint(p):
    """路径里紧贴的请求体提示（不在段首的「{…}」）：返回 (去掉提示的路径, 提示里的字段名集合)。"""
    m = re.search(r"(?<!/)\{", p)
    if not m:
        return p, frozenset()
    return p[:m.start()], hint_fields(p[m.start():])


def path_variants(raw, spaced_hint=""):
    """返回 (候选列表, 是否省略前缀, 请求体提示字段集合)；候选为段元组，段为 ("lit", 值) 或 ("param", 名)，
    末尾的「*」（前缀通配，如「/admin/plugins*」「/documents/*」）记为一段 ("any", "*")。无法作为路径时候选为空。
    spaced_hint 为路径之后隔空白的「{…}」（「POST /imports { uploadId }」），与紧贴的提示同样处理。"""
    p = raw.replace("\\|", "|")
    elided = False
    if p.startswith("…"):
        elided, p = True, p[1:]
    elif p.startswith("..."):
        elided, p = True, p[3:]
    p = re.split(r"[?#]", p, 1)[0]
    p, hint = body_hint(p)
    if spaced_hint and spaced_hint.strip():
        hint = hint | hint_fields(spaced_hint)
    p = p.rstrip("）)，,。；;：:、")
    wildcard = p.endswith("*")
    p = p.rstrip("*")
    if p.startswith("/api/v1/") or p == "/api/v1":
        p = p[len("/api/v1"):] or "/"
    if len(p) > 1:
        p = p.rstrip("/")
    if not p.startswith("/") or not re.search(r"[A-Za-z]", p):
        return [], elided, hint
    variants = [[]]
    for seg in p.split("/")[1:]:
        alt = ALT_SEG_RE.match(seg)
        if alt:
            alts = [x.strip() for x in alt.group(1).split("|")]
        elif "|" in seg:
            alts = seg.split("|")
        else:
            alts = [seg]
        nxt = []
        for v in variants:
            for a in alts:
                pm = PARAM_SEG_RE.match(a)
                nxt.append(v + [("param", next(g for g in pm.groups() if g is not None).strip())
                                if pm else ("lit", a)])
        variants = nxt
    if wildcard:
        variants = [v + [("any", "*")] for v in variants]
    return [tuple(v) for v in variants], elided, hint


def show_route(segs):
    if segs and segs[-1][0] == "any":
        return show_route(segs[:-1]).rstrip("/") + "/*"
    return "/" + "/".join(":param" if s[0] == "param" else s[1] for s in segs)


def show_hint(hint):
    return "{%s}" % ",".join(sorted(hint)) if hint else ""


def example_value(value, literals):
    """能否作为示例值填进不带取值的占位：不像路由字面段的词，或一眼可知是 id；与路由字面段只差大小写的不收。"""
    if not EXAMPLE_VALUE_RE.match(value) or value.lower() in literals:
        return False
    return not ROUTE_WORD_RE.match(value) or bool(ID_VALUE_RE.match(value))


def seg_ok(ref, route, enums, literals, fill=True):
    """一段比对：占位只配占位；字面段配同名字面段，或（fill 时）填进路由占位——带取值的占位只收取值，
    其余只收示例值（example_value）。"""
    if ref[0] == "param":
        return route[0] == "param"
    if route[0] == "lit":
        return ref[1] == route[1]
    if not fill:
        return False
    values = enums.get(route[1])
    if values is not None:
        return ref[1] in values
    return example_value(ref[1], literals)


def path_matches(ref, elided, segs, enums, literals):
    if ref and ref[-1][0] == "any":      # 前缀通配：路由以这些段开头即可（含恰好相等）
        head = ref[:-1]
        if not elided:
            return len(segs) >= len(head) and all(seg_ok(x, r, enums, literals) for x, r in zip(head, segs))
        return any(path_matches(head, True, segs[:j], enums, literals) for j in range(len(head), len(segs) + 1))
    if not elided:
        return len(ref) == len(segs) and all(seg_ok(x, r, enums, literals) for x, r in zip(ref, segs))
    for i in range(0, len(segs) - len(ref) + 1):
        window = segs[i:i + len(ref)]
        if (seg_ok(ref[0], window[0], enums, literals, fill=False)
                and all(seg_ok(x, r, enums, literals) for x, r in zip(ref[1:], window[1:]))
                and all(s[0] == "param" for s in segs[i + len(ref):])):
            return True
    return False


def rest_matches(text):
    """片段内容里的 REST 引用：产出 (方法列表, 候选列表, 是否省略前缀, 提示字段, 原文)。"""
    for m in REST_REF_RE.finditer(text):
        variants, elided, hint = path_variants(m.group(2), m.group(3) or "")
        yield re.findall(METHOD, m.group(1)), variants, elided, hint, m.group(0)


def parse_routes(docs):
    """返回 (路由列表 [(方法, 段元组, {占位名: 取值集合})], 已删除端点 {(方法, 显示路径): [(提示字段, 替代)]},
    60/15 自身不算引用的行号集合（已删除表的行、未排期段落）, 未排期端点 {(方法, 显示路径): [提示字段]})。"""
    routes, deleted, deleted_lines, pending = [], OrderedDict(), set(), OrderedDict()
    if not os.path.exists(REST_CATALOG):
        return routes, deleted, deleted_lines, pending
    items = docs.items(REST_CATALOG)

    def endpoints(text):
        for _, _, c in code_spans(text):
            for methods, variants, _, hint, _ in rest_matches(c):
                for meth in methods:
                    for segs in variants:
                        yield (meth, show_route(segs)), hint

    # 「仍未排期的端点」段落：未进路由表，别处出现即失配；段落本身与「已删除端点」表的行一样不算引用
    for ln, line in prdlib.body_lines(items):
        if re.match(r"^\s*(?:\*\*)?仍未排期的端点", line):
            for key, hint in endpoints(line):
                pending.setdefault(key, []).append(hint)
            deleted_lines.add(ln)
    seen = set()
    for header, rows in tables(items):
        if "方法" in header and "路径" in header:
            mi, pi = header.index("方法"), header.index("路径")
            for _, _, cells in rows:
                if max(mi, pi) >= len(cells):
                    continue
                methods = re.findall(METHOD, cells[mi])
                spans = [c for _, _, c in code_spans(cells[pi]) if c.strip().startswith("/")]
                raw = spans[0].strip() if spans else cells[pi].strip()
                enums = {name: frozenset(v.strip() for v in values.split("|") if v.strip())
                         for name, values in ENUM_RE.findall(cells[pi])}
                for meth in methods:
                    for segs in path_variants(raw)[0]:
                        key = (meth, segs, tuple(sorted(enums.items())))
                        if key not in seen:
                            seen.add(key)
                            routes.append((meth, segs, enums))
        elif header and prdlib.plain(header[0]) == "端点":
            for ln, _, cells in rows:
                deleted_lines.add(ln)
                repl = cells[2] if len(cells) > 2 else ""
                for key, hint in endpoints(cells[0]):
                    deleted.setdefault(key, []).append((hint, repl))
    return routes, deleted, deleted_lines, pending


# ------------------------------------------------------------------ 归属：错误码登记
DOMAIN_TOKEN_RE = re.compile(r"^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)?$")
CODE_NAME_RE = re.compile(r"^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$")
TS_KEY_RE = re.compile(r"""['"]([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+)['"]\s*:""")
OLD_BEFORE_RE = re.compile(r"(?:原|原名|原称|旧|废|弃)\s*$")
OTHER_KEY_RE = re.compile(r"^[a-z][A-Za-z0-9_]*(?:\.(?:[a-z][A-Za-z0-9_]*|\*))+$")


def code_tokens(text):
    for m in CODE_TOKEN_RE.finditer(text):
        yield m.group(1), m


def cell_bounds_of(line, cells, pos):
    """pos 所在单元格在行内的 [起, 止)；cells 为 prdlib.cell_spans 的结果，不在表格行（cells 为 None）时取整行。"""
    if cells:
        for a, b in cells:
            if a <= pos < b:
                return a, b
    return 0, len(line)


def deprecation_spans(line, spans, bounds):
    """30/10 一行里声明废弃的反引号片段下标（文件头「错误码·已废弃码」）：紧挨前置标记或后置标记的片段，
    以及与它以列表符连写、同一单元格里的片段。只用于解析归属文档。"""
    n = len(spans)
    flags = [False] * n

    def listed(i):
        """第 i - 1 与第 i 个片段之间只隔列表符，且在同一单元格。"""
        return 0 < i < n and bounds[i] == bounds[i - 1] and bool(LIST_SEP_RE.match(line[spans[i - 1][1]:spans[i][0]]))

    carry = False
    for i in range(n):
        left = line[max(bounds[i][0], spans[i - 1][1] if i > 0 else 0):spans[i][0]]
        carry = bool(DEPRECATE_BEFORE_RE.search(left)) or (carry and listed(i))
        flags[i] = carry
    carry = False
    for i in range(n - 1, -1, -1):
        right = line[spans[i][1]:min(bounds[i][1], spans[i + 1][0] if i + 1 < n else len(line))]
        carry = bool(DEPRECATE_AFTER_RE.match(right)) or (carry and listed(i + 1))
        flags[i] = flags[i] or carry
    return [i for i in range(n) if flags[i]]


def parse_error_registry(docs):
    """返回 dict(codes, domains, domains2（两段域）, namespaces, code_namespaces（有登记码的命名空间）,
    words（已登记码用过的单词名）, deprecated（30/10 声明废弃的码）)。"""
    codes, domains, deprecated = set(), set(), set()
    empty = dict(codes=codes, domains=domains, domains2=set(), namespaces=set(), code_namespaces=set(), words=set(),
                 deprecated=deprecated)
    if not os.path.exists(ERRORS_DOC):
        return empty
    items = docs.items(ERRORS_DOC)
    body = prdlib.body_lines(items)
    tabs = list(tables(items))

    def registry_table(header):
        return len(header) >= 2 and header[0].startswith("域") and header[1].startswith("码")

    # 1) 域：「域 | 码」登记表的域列
    for header, rows in tabs:
        if registry_table(header):
            for _, _, cells in rows:
                ds = [c.strip() for _, _, c in code_spans(cells[0]) if DOMAIN_TOKEN_RE.match(c.strip())]
                if ds:
                    domains.add(ds[0])
    # 2) 域：§1.1 中以空格分隔连写的域清单（≥ 3 个），不含旧域（旧域以「、」「与」连写，不成清单）
    in_11 = False
    for _, line in body:
        h = HEADING_NUM_RE.match(line)
        if h:
            in_11 = h.group(2) == "1.1"
            continue
        if not in_11:
            continue
        runs, run, prev_end = [], [], None
        for a, b, c in code_spans(line):
            tok = c.strip()
            if prev_end is None or line[prev_end:a].strip() or not DOMAIN_TOKEN_RE.match(tok):
                runs.append(run)
                run = []
            if DOMAIN_TOKEN_RE.match(tok):
                run.append(tok)
            prev_end = b
        runs.append(run)
        for r in runs:
            if len(r) >= 3:
                domains.update(r)
    # 3) 码：域 × 码登记表
    for header, rows in tabs:
        if registry_table(header):
            for _, _, cells in rows:
                ds = [c.strip() for _, _, c in code_spans(cells[0]) if DOMAIN_TOKEN_RE.match(c.strip())]
                if not ds or len(cells) < 2:
                    continue
                for _, _, c in code_spans(cells[1]):
                    name = c.strip()
                    if CODE_NAME_RE.match(name):
                        codes.add(ds[0] + "." + name)
    # 4) 码：表头以「码」开头或为「定稿」的列；「*.名」只对同一单元格列出的域展开，没列域的是映射规则，不展开
    for header, rows in tabs:
        if registry_table(header):
            continue
        cols = [i for i, h in enumerate(header) if re.match(r"^(?:错误)?码", h) or h == "定稿"]
        for _, _, cells in rows:
            for ci in cols:
                if ci >= len(cells):
                    continue
                cell = cells[ci]
                spans = code_spans(cell)
                wild_names = [c.strip()[2:] for _, _, c in spans if re.match(r"^\*\.[a-z][a-z0-9_]*$", c.strip())]
                listed = []
                prev_end = 0
                for a, b, c in spans:
                    old = OLD_BEFORE_RE.search(cell[prev_end:a])
                    prev_end = b
                    if old:
                        continue
                    for tok, _ in code_tokens(c):
                        if tok.endswith(".*"):
                            continue
                        if tok in domains:
                            listed.append(tok)
                        else:
                            codes.add(tok)
                if listed:
                    for name in wild_names:
                        codes.update(d + "." + name for d in listed)
    # 5) 码：TS 围栏里的声明键 'x.y':
    for it in items:
        info = it[3].split()
        if it[2] and info and info[0] in ("ts", "typescript", "tsx"):
            for m in TS_KEY_RE.finditer(it[1]):
                codes.add(m.group(1))
    domains.update(c.rsplit(".", 1)[0] for c in codes)
    namespaces = {d.split(".")[0] for d in domains}
    # 6) 已废弃码：30/10 正文里声明废弃的码形 token（未登记、命名空间已登记、末段含下划线）
    row_cells = {}
    for header, rows in tabs:
        for no, text, _ in rows:
            row_cells[no] = prdlib.cell_spans(text)
    for no, line in body:
        spans = code_spans(line)
        if not spans:
            continue
        cells = row_cells.get(no)
        bounds = [cell_bounds_of(line, cells, a) for a, _, _ in spans]
        for idx in deprecation_spans(line, spans, bounds):
            for tok, _ in code_tokens(spans[idx][2]):
                if (not tok.endswith(".*") and tok.split(".")[0] in namespaces and tok not in codes
                        and tok not in domains and "_" in tok.rsplit(".", 1)[1]):
                    deprecated.add(tok)
    words = {c.rsplit(".", 1)[1] for c in codes if "_" not in c.rsplit(".", 1)[1]}
    return dict(codes=codes, domains=domains, domains2={d for d in domains if "." in d}, namespaces=namespaces,
                code_namespaces={c.split(".")[0] for c in codes}, words=words, deprecated=deprecated)


def prefix_hits(tok, pool):
    """通配「p.*」：pool 里以「p.」开头的码。"""
    prefix = tok[:-1]
    return sorted(c for c in pool if c.startswith(prefix))


def code_registered(tok, errs):
    """已登记的码；通配「p.*」须有已登记码以「p.」开头（只登记了域、没有码的不算）。"""
    if tok.endswith(".*"):
        return bool(prefix_hits(tok, errs["codes"]))
    return tok in errs["codes"]


def code_deprecated(tok, errs):
    """30/10 记为已废弃的码；通配「p.*」须前缀下有已废弃码（已登记码由 code_registered 先判）。"""
    if tok.endswith(".*"):
        return bool(prefix_hits(tok, errs["deprecated"]))
    return tok in errs["deprecated"]


def close_codes(tok, errs, cutoff):
    dom = tok.rpartition(".")[0]
    pool = [c for c in errs["codes"] if c.rpartition(".")[0] == dom]
    return difflib.get_close_matches(tok, pool, n=1, cutoff=cutoff)


def parse_other_keys(docs):
    """同一命名空间下另有归属的键（文件头「另有归属的键」）：返回 {键: 类别}。"""
    keys = OrderedDict()
    for path, head_re, kind in OTHER_KEY_TABLES:
        if not os.path.isfile(path):
            continue
        for header, rows in tables(docs.items(path)):
            if not header or not re.match(head_re, prdlib.plain(header[0])):
                continue
            for _, _, cells in rows:
                for _, _, c in code_spans(cells[0] if cells else ""):
                    k = c.strip()
                    if OTHER_KEY_RE.match(k):
                        keys.setdefault(k, kind)
    if os.path.isfile(ERRORS_DOC):        # 30/10 §3.2 正文列出的 span 名
        in_sec = False
        for _, line in prdlib.body_lines(docs.items(ERRORS_DOC)):
            h = HEADING_NUM_RE.match(line)
            if h:
                in_sec = h.group(2) == SPAN_SECTION
                continue
            if in_sec:
                for _, _, c in code_spans(line):
                    if OTHER_KEY_RE.match(c.strip()):
                        keys.setdefault(c.strip(), "span 名（30-architecture/10 §3.2）")
    return keys


# ------------------------------------------------------------------ 归属：界面、ADR、裁决小节
def parse_screens():
    if not os.path.isdir(SCREENS_DIR):
        return set()
    return {f[:2] for f in os.listdir(SCREENS_DIR) if re.match(r"^[0-9]{2}-.+\.md$", f)}


def parse_adrs():
    if not os.path.isdir(ADR_DIR):
        return set()
    return {f[:4] for f in os.listdir(ADR_DIR) if re.match(r"^[0-9]{4}-.+\.md$", f)}


def parse_rulings(docs):
    secs = set()
    for path in sorted(glob.glob(os.path.join(CHARTER_DIR, "rulings-*.md"))):
        for _, line in prdlib.body_lines(docs.items(path)):
            m = re.match(r"^##\s+4\.([0-9]+)(?![0-9])", line)
            if m:
                secs.add(m.group(1))
    return secs


class OwnerDocs(object):
    """归属文档的读取缓存：同一文件只读一次；不是 UTF-8、未闭合记进 problems；读不了是环境错误（EnvError）。"""

    def __init__(self):
        self.cache = {}
        self.problems = []

    def items(self, path):
        key = os.path.abspath(path)
        if key not in self.cache:
            try:
                self.cache[key] = load_items(path, self.problems)
            except OSError as exc:
                raise EnvError("归属文档 %s 无法读取（%s）" % (rel_repo(path), exc.strerror or exc))
        return self.cache[key]


class Registry(object):
    def __init__(self):
        if not os.path.isdir(DOCS):
            raise EnvError("docs 根目录不存在：%s" % rel_repo(DOCS))
        docs = OwnerDocs()
        prd = prdlib.load_prd(DOCS)
        self.problems = list(prd.read_errors)          # PRD 的格式错误由 G4 报，G5 只报读取问题
        self.reqs = prd.reqs
        self.evidence_ids, evidence_errors = prdlib.load_evidence_ids(DOCS)
        self.problems.extend(evidence_errors)
        self.ruling_entries = parse_ruling_entries(docs)
        self.capabilities = parse_capabilities(docs)
        self.routes, self.deleted_routes, self.deleted_route_lines, self.pending_routes = parse_routes(docs)
        self.route_literals = frozenset(s[1] for _, segs, _ in self.routes for s in segs if s[0] == "lit")
        self.errors = parse_error_registry(docs)
        self.other_keys = parse_other_keys(docs)
        self.other_prefix_kinds = {}      # 另有归属的键的真前缀 → 这些键的类别
        for k, kind in self.other_keys.items():
            parts = k.split(".")
            for i in range(1, len(parts)):
                self.other_prefix_kinds.setdefault(".".join(parts[:i]), set()).add(kind)
        # 30/10 没有任何登记码、却是另有归属的键的首段的命名空间（slide、command、layout、store 等）
        self.keyonly_namespaces = {k.split(".")[0] for k in self.other_keys} & (
            self.errors["namespaces"] - self.errors["code_namespaces"])
        self.screens = parse_screens()
        self.adrs = parse_adrs()
        self.rulings = parse_rulings(docs)
        self.problems.extend(docs.problems)

    def other_kind(self, tok):
        """另有归属的同形键（文件头「错误码」③）：返回类别说明，不是时返回 None。"""
        if not tok.endswith(".*"):
            return self.other_keys.get(tok)
        p = tok[:-2]
        if p in self.other_keys:
            return self.other_keys[p] + "的前缀"
        if p in self.other_prefix_kinds:
            return "、".join(sorted(self.other_prefix_kinds[p])) + "的前缀"
        ns = p.split(".")[0]
        if ns in self.keyonly_namespaces:
            return "命名空间 %s 在 30-architecture/10 没有登记码，%s 只用作另有归属的键（%s）的前缀" % (
                ns, ns, "、".join(sorted(self.other_prefix_kinds.get(ns, ()))))
        return None

    def as_json(self):
        reqs = list(self.reqs.values())
        by_prio = Counter(r["priority"] or "无" for r in reqs)
        kinds = Counter(self.other_keys.values())

        def endpoint_list(table, with_repl):
            out = set()
            for (meth, path), items in table.items():
                for item in items:
                    hint = item[0] if with_repl else item
                    out.add("%s %s%s" % (meth, path, show_hint(hint)))
            return sorted(out)

        return OrderedDict([
            ("requirements", OrderedDict([("total", len(reqs)), ("byPriority", OrderedDict(sorted(by_prio.items()))),
                                          ("deleted", sum(1 for r in reqs if r["deleted"])),
                                          ("items", [prdlib.req_json(r) for r in reqs])])),
            ("evidenceIds", sorted(self.evidence_ids)),
            ("rulingEntries418", sorted(self.ruling_entries)),
            ("capabilityIds", sorted(self.capabilities)),
            ("routes", sorted(set("%s %s" % (m, show_route(s)) for m, s, _ in self.routes))),
            ("routeEnums", sorted(set("%s %s：%s ∈ %s" % (m, show_route(s), k, " | ".join(sorted(v)))
                                      for m, s, e in self.routes for k, v in e.items()))),
            ("deletedRoutes", endpoint_list(self.deleted_routes, True)),
            ("pendingRoutes", endpoint_list(self.pending_routes, False)),
            ("errorCodes", sorted(self.errors["codes"])),
            ("errorCodeWords", sorted(self.errors["words"])),
            ("deprecatedErrorCodes", sorted(self.errors["deprecated"])),
            ("errorDomains", sorted(self.errors["domains"])),
            ("errorNamespaces", sorted(self.errors["namespaces"])),
            ("errorNamespacesWithoutCodes", sorted(self.errors["namespaces"] - self.errors["code_namespaces"])),
            ("keyOnlyNamespaces", sorted(self.keyonly_namespaces)),
            ("otherKeys", OrderedDict([("byKind", OrderedDict(sorted(kinds.items()))),
                                       ("items", OrderedDict(sorted(self.other_keys.items())))])),
            ("screens", sorted(self.screens)),
            ("adrs", sorted(self.adrs)),
            ("rulingSections", sorted(self.rulings, key=int)),
            ("problems", [OrderedDict([("file", f), ("line", ln), ("message", msg)]) for f, ln, msg in self.problems]),
        ])


# ------------------------------------------------------------------ 来源扫描
def iter_md_files():
    for root, dirs, files in os.walk(DOCS):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not d.startswith("."))
        for f in sorted(files):
            if f.endswith(".md"):
                yield os.path.join(root, f)


def path_exempt(path):
    """docs/ 里的路径豁免（与全量扫描同一口径）；docs/ 之外的文件（自测用）不豁免。"""
    r = rel_docs(path)
    if r is None:
        return False
    if r.startswith(SKIP_PREFIXES):
        return True
    return any(part in SKIP_DIRS or part.startswith(".") for part in r.split("/")[:-1])


# ------------------------------------------------------------------ 需求编号的归属解析
def req_problem(rid, explicit, reg):
    """G5 归属解析（文件头「需求编号」）：返回失配原因，解析成功返回 None。"""
    if rid in reg.reqs:
        return None
    explicit = explicit or prdlib.domain_of(rid) == "CO"      # CO 需求引用本就带 PRD 字样
    owner = ("rulings §4.18 的条目" if rid in reg.ruling_entries
             else "50-frontend/18 的能力 id" if rid in reg.capabilities else None)
    if owner and not explicit:
        return None
    if owner:
        return "PRD 需求清单中没有该编号（同形的 %s 是 %s，引用它时不加 PRD 字样）" % (rid, owner)
    return "PRD 需求清单中没有该编号"


# ------------------------------------------------------------------ REST、界面、裁决小节的识别
def rest_refs(spans):
    for idx, (_, _, content) in enumerate(spans):
        for methods, variants, elided, hint, text in rest_matches(content):
            for meth in methods:
                for segs in variants:
                    shown = "%s %s%s%s" % (meth, "…" if elided else "", show_route(segs), show_hint(hint))
                    yield shown, meth, segs, elided, hint, text, idx


def rest_problem(meth, segs, elided, hint, reg):
    """返回 None（有效）或 (类型, 原因)：类型 deleted / pending 是 60/15 自己登记的已删除、未排期端点，missing 是没有该路由。"""
    key = (meth, show_route(segs))
    if not elided and hint:              # 已删除 / 未排期条目带请求体提示：同名字段的引用先按登记判定
        for h, repl in reg.deleted_routes.get(key, ()):
            if h and h & hint:
                return "deleted", "已删除端点（60-backend/15 §9：%s %s%s）%s" % (
                    meth, key[1], show_hint(h), "，替代：%s" % repl if repl else "")
        for h in reg.pending_routes.get(key, ()):
            if h and h & hint:
                return "pending", "60-backend/15 只把 %s %s%s 列在「仍未排期的端点」，尚未进路由表" % (
                    meth, key[1], show_hint(h))
    if route_matches(meth, segs, elided, reg):
        return None
    if not elided and key in reg.deleted_routes:
        repl = next((r for _, r in reg.deleted_routes[key] if r), "")
        return "deleted", "已删除端点（60-backend/15 §9）" + ("，替代：%s" % repl if repl else "")
    if not elided and key in reg.pending_routes:
        return "pending", "60-backend/15 只把它列在「仍未排期的端点」，尚未进路由表"
    others = sorted({m for m, s, e in reg.routes if path_matches(segs, elided, s, e, reg.route_literals)})
    return "missing", ("60-backend/15 中该路径只登记了 %s" % "、".join(others) if others
                       else "60-backend/15 路由表中没有该路由")


def route_matches(meth, ref, elided, reg):
    return any(m == meth and path_matches(ref, elided, segs, enums, reg.route_literals)
               for m, segs, enums in reg.routes)


def screen_refs(line):
    """产出 (界面号, 原文, 起点)；「设计 [03-NN](…/03-screens/NN-x.md)」只计一处。"""
    consumed = []
    for m in SCREEN_DESIGN_RE.finditer(line):
        items = [(m.group(1), m.group(0), m.start(), m.end())]
        pos = m.end()
        while True:
            c = SCREEN_CHAIN_RE.match(line, pos)
            if not c:
                break
            items.append((c.group(1), "03-" + c.group(1), c.start(1) - 3, c.end()))
            pos = c.end()
        for num, text, start, end in items:
            link = LINK_TARGET_RE.match(line, end)
            if link:
                consumed.append((link.start(1), link.end(1), num))
            yield num, text, start
    for m in SCREEN_PATH_RE.finditer(line):
        if not any(a <= m.start() < b and n == m.group(1) for a, b, n in consumed):
            yield m.group(1), m.group(0), m.start()


def ruling_refs(line):
    for m in RULING_RE.finditer(line):
        yield m.group(1), m.group(0), m.start()
        pos = m.end()
        while True:
            c = RULING_CHAIN_RE.match(line, pos)
            if not c:
                break
            yield c.group(1), "§4." + c.group(1), c.start(1)
            pos = c.end()


# ------------------------------------------------------------------ 错误码判定
def error_class(tok, reg):
    """错误码判定（文件头「错误码·判定顺序」）：返回 None（不是候选）或
    ok ① / deprecated ② / other ③ / wild ④ / domain、shaped ⑤ / plain ⑥。"""
    errs = reg.errors
    wild = tok.endswith(".*")
    base = tok[:-2] if wild else tok
    segs = base.split(".")
    if segs[0] not in errs["namespaces"]:
        return None
    if not wild:
        if segs[-1] in FILE_EXTS and ".".join(segs[:-1]) not in errs["domains2"]:
            return None                  # 文件名
        if base in errs["domains"]:
            return None                  # 域引用
    if code_registered(tok, errs):
        return "ok"
    if code_deprecated(tok, errs):
        return "deprecated"
    if reg.other_kind(tok):
        return "other"
    if wild:
        return "wild"
    if segs[0] == "server":
        return "domain" if len(segs) == 2 else "shaped"
    if len(segs) > 3:
        return "plain"
    dom, name = ".".join(segs[:-1]), segs[-1]
    if dom in errs["domains2"]:
        return "shaped"
    if len(segs) == 3:
        return "shaped" if "_" in name else "plain"
    if "_" in name or name in errs["words"] or close_codes(base, errs, 0.88):
        return "shaped"
    return "plain"


def error_reason(tok, cls, reg, kind=None):
    errs = reg.errors
    if cls == "deprecated":
        if tok.endswith(".*"):
            return "30-architecture/10 中该前缀下只有记为已废弃的码（%s），不能再用" % "、".join(
                prefix_hits(tok, errs["deprecated"]))
        return "30-architecture/10 记为已废弃的码，不能再用"
    if cls == "domain":
        why = "30-architecture/10 未登记错误域 %s（server 下的码都在已登记的两段域 server.<资源> 里）" % tok
        near = difflib.get_close_matches(tok, sorted(d for d in errs["domains2"] if d.startswith("server.")),
                                         n=1, cutoff=0.8)
        return why + ("；相近的已登记域：%s" % near[0] if near else "")
    if tok.endswith(".*"):
        why = "30-architecture/10 中没有以该前缀登记的码"
        if tok[:-2] in errs["domains"]:
            why += "（域 %s 只登记了域、没有码）" % tok[:-2]
    else:
        dom = tok.rpartition(".")[0]
        why = "30-architecture/10 未登记该错误码"
        if tok.startswith("server.") and tok.count(".") >= 3:
            why += "（server 下的码都是三段的 server.<资源>.<名>）"
        elif dom not in errs["domains"]:
            why += "（域 %s 也未登记）" % dom
        near = difflib.get_close_matches(tok, sorted(errs["codes"]), n=1, cutoff=0.8)
        if near:
            why += "；相近的已登记码：%s" % near[0]
    if kind:
        why += "；写在错误码语境里，按错误码核对（同形的键：%s）" % kind
    return why


def span_contexts(line, spans, bounds, header_cells):
    """每个反引号片段的 (强语境, 弱语境)（文件头「错误码·错误码语境」）。header_cells[i] 为片段 i 所在列的表头文字
    （不在表格里为 None）。"""
    out = []
    for idx, (a, b, content) in enumerate(spans):
        start, end = bounds[idx]
        hcell = header_cells[idx]
        listed = (idx > 0 and bounds[idx - 1] == bounds[idx]
                  and bool(LIST_SEP_RE.match(line[spans[idx - 1][1]:a])))
        before = CLAUSE_BOUNDARY_RE.split(line[max(start, a - 12):a])[-1]
        after = line[b:min(end, b + 12)]
        strong = ((hcell is not None and bool(CODE_HEADER_RE.search(hcell))) or bool(ERR_SPAN_RE.search(content))
                  or bool(STRONG_BEFORE_RE.search(before)) or (listed and out[idx - 1][0]))
        weak = (strong or (hcell is not None and bool(ERR_HEADER_RE.search(hcell))) or (listed and out[idx - 1][1])
                or bool(ERR_BEFORE_RE.search(before)) or bool(ERR_AFTER_RE.match(after))
                or (bool(WITH_BEFORE_RE.search(before)) and bool(FAIL_AFTER_RE.match(after))))
        if not weak:
            clause = clause_of(line, start, end, a)
            weak = "错误码" in clause or "诊断码" in clause
        out.append((strong, weak))
    return out


# ------------------------------------------------------------------ 逐文件扫描
def scan_items(path, items, reg):
    """返回 (引用计数 Counter, 失配列表[(类别, 引用键, 行号, 原文, 原因)])。"""
    counts = Counter()
    problems = []
    row_info = {}                         # 行号 → (表头单元格, 本行单元格区间)
    for header, rows in tables(items):
        plain_header = [prdlib.plain(h) for h in header]
        for no, text, _ in rows:
            row_info[no] = (plain_header, prdlib.cell_spans(text))
    here = os.path.abspath(path)
    own_catalog = here == os.path.abspath(REST_CATALOG)
    own_errors = here == os.path.abspath(ERRORS_DOC)
    caps = prdlib.capability_spans(items)
    for ln, line in prdlib.ref_lines(items):
        if history_line(line):
            continue                     # 历史陈述行（check-terms.py 的口径）整行不查
        header, cells = row_info.get(ln, (None, None))
        spans = code_spans(line)
        bounds = [cell_bounds_of(line, cells, a) for a, _, _ in spans]
        # 1) 需求编号
        explicit = None
        for rid, start, _, kind in prdlib.classify_refs(line, caps.get(ln, ()), reg.evidence_ids):
            if kind != "prd" or prdlib.domain_of(rid) not in prdlib.DOMAINS:
                continue                 # 能力 id、证据条目、不带 PRD 字样或属于 rulings §4.18 的 CO 编号不是需求引用
            counts["req"] += 1
            if rid in reg.reqs:
                continue
            if explicit is None:
                explicit = prdlib.explicit_prd_flags(line)
            why = req_problem(rid, explicit.get(start, False), reg)
            if why:
                problems.append(("req", rid, ln, rid, why))
        # 2) REST 路由（60/15 的已删除表与未排期段落，以及 60/15 里出现的它自己登记的已删除、未排期端点是登记，不算引用）
        if not (own_catalog and ln in reg.deleted_route_lines):
            for shown, meth, segs, elided, hint, text, _ in rest_refs(spans):
                problem = rest_problem(meth, segs, elided, hint, reg)
                if problem and own_catalog and problem[0] in ("deleted", "pending"):
                    continue
                counts["rest"] += 1
                if problem:
                    problems.append(("rest", shown, ln, text, problem[1]))
        # 3) 错误码（30/10 里出现的它自己声明废弃的码是登记，不算引用）
        ctx = None
        for idx, (a, b, content) in enumerate(spans):
            for tok, _ in code_tokens(content):
                cls = error_class(tok, reg)
                if cls is None or (cls == "deprecated" and own_errors):
                    continue
                if ctx is None:
                    header_cells = []
                    for x, _, _ in spans:
                        ci = next((i for i, (p, q) in enumerate(cells or ()) if p <= x < q), None)
                        header_cells.append(header[ci] if header is not None and ci is not None and ci < len(header)
                                            else None)
                    ctx = (span_contexts(line, spans, bounds, header_cells), header_cells)
                (strong, weak), hcell = ctx[0][idx], ctx[1][idx]
                kind = None
                if cls == "other":
                    kind = reg.other_kind(tok)
                elif cls in ("wild", "domain", "shaped", "plain") and hcell is not None and KEY_HEADER_RE.search(hcell):
                    kind = "表头为「%s」的列里的键" % hcell
                if kind is not None:
                    if not strong:
                        continue         # ③ 另有归属的同形键、非错误键列：只在强语境里才按错误码核对
                elif cls == "plain" and not weak:
                    continue             # ⑥ 只在弱语境里才算引用
                counts["errcode"] += 1
                if cls != "ok":
                    problems.append(("errcode", tok, ln, tok, error_reason(tok, cls, reg, kind)))
        # 4) 界面
        for num, text, _ in screen_refs(line):
            counts["screen"] += 1
            if num not in reg.screens:
                problems.append(("screen", "03-" + num, ln, text, "20-design/03-screens 下没有 %s-*.md" % num))
        # 5) ADR
        for m in ADR_RE.finditer(line):
            counts["adr"] += 1
            if m.group(1) not in reg.adrs:
                problems.append(("adr", "ADR-" + m.group(1), ln, m.group(0),
                                 "30-architecture/adr 下没有 %s-*.md" % m.group(1)))
        # 6) 裁决小节
        for num, text, _ in ruling_refs(line):
            counts["ruling"] += 1
            if num not in reg.rulings:
                problems.append(("ruling", "§4." + num, ln, text, "rulings 中没有「## 4.%s」标题" % num))
    return counts, problems


# ------------------------------------------------------------------ 基线
def load_baseline(path):
    """返回 ({(文件, 类别, 引用): 次数}, 文件是否存在, 问题列表[(文件, 行, 原因)])。读不了、是目录时抛 EnvError；
    不是合法 JSON 或条目不合法时问题非空（条目照样尽量读出）。"""
    if not os.path.exists(path):
        return {}, False, []
    shown = rel_repo(path)
    if os.path.isdir(path):
        raise EnvError("基线文件 %s 是目录，不是文件" % shown)
    try:
        with open(path, "rb") as fh:
            raw = fh.read()
    except OSError as exc:
        raise EnvError("基线文件 %s 无法读取（%s）" % (shown, exc.strerror or exc))
    text, bad = prdlib.decode_text(raw)
    if bad:
        return {}, True, [(shown, bad[0], "基线文件" + bad[1])]
    try:
        data = json.loads(text)
    except ValueError as exc:
        return {}, True, [(shown, getattr(exc, "lineno", 1), "基线文件不是合法 JSON（%s）" % getattr(exc, "msg", exc))]

    def line_of(*keys):
        pos = 0
        for k in keys:
            at = text.find(json.dumps(k, ensure_ascii=False), pos)
            if at < 0:
                break
            pos = at
        return text.count("\n", 0, pos) + 1

    entries = data.get("entries") if isinstance(data, dict) else None
    if not isinstance(entries, dict):
        return {}, True, [(shown, 1, "基线文件缺少 entries 对象")]
    out, problems = {}, []
    for f, cats in entries.items():
        if not isinstance(cats, dict):
            problems.append((shown, line_of(f), "基线条目不合法：entries[%s] 应为对象" % json.dumps(f, ensure_ascii=False)))
            continue
        for cat, refs in cats.items():
            if cat not in CATEGORIES or not isinstance(refs, dict):
                problems.append((shown, line_of(f, cat), "基线条目不合法：entries[%s][%s]（类别取 %s，值为对象）" % (
                    json.dumps(f, ensure_ascii=False), json.dumps(cat, ensure_ascii=False), " / ".join(CATEGORIES))))
                continue
            for ref, n in refs.items():
                if isinstance(n, bool) or not isinstance(n, int) or n < 1:
                    problems.append((shown, line_of(f, cat, ref), "基线条目不合法：entries[%s][%s][%s] = %s（次数应为正整数）" % (
                        json.dumps(f, ensure_ascii=False), cat, json.dumps(ref, ensure_ascii=False),
                        json.dumps(n, ensure_ascii=False))))
                    continue
                out[(f, cat, ref)] = n
    return out, True, problems


def write_baseline(path, current):
    entries = OrderedDict()
    for (f, cat, ref), n in sorted(current.items(), key=lambda kv: (kv[0][0], list(CATEGORIES).index(kv[0][1])
                                                                    if kv[0][1] in CATEGORIES else 99, kv[0][2])):
        entries.setdefault(f, OrderedDict()).setdefault(cat, OrderedDict())[ref] = n
    by_cat = Counter()
    for (_, cat, _), n in current.items():
        by_cat[cat] += n
    data = OrderedDict([
        ("$comment", "由 docs/_tools/check-doc-refs.py --write-baseline 生成，勿手改。G5 文档引用反查的棘轮基线："
                     "entries[文件][类别][引用] = 失配次数（不含行号）；类别 req 需求编号、rest REST 路由、errcode 错误码、"
                     "screen 界面、adr ADR、ruling 裁决小节。新增失配即失败，已消失的失配须重新 --write-baseline 收紧；"
                     "只减不增，由变更 docs-coverage-baseline 清零（docs/80-process/02 §3）。"),
        ("total", sum(current.values())),
        ("byCategory", OrderedDict((c, by_cat[c]) for c in CATEGORIES if by_cat[c])),
        ("entries", entries),
    ])
    try:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    except OSError as exc:
        raise EnvError("无法写入基线 %s（%s）" % (rel_repo(path), exc.strerror or exc))


# ------------------------------------------------------------------ 主流程
USAGE = __doc__[__doc__.index("\n用法：\n") + 1:]


def parse_args(argv):
    opts = {"baseline": DEFAULT_BASELINE, "baseline_given": False, "write": False, "json": False, "all": False,
            "summary": False, "registry": False, "files": []}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a in ("-h", "--help"):
            opts["help"] = True
        elif a == "--baseline":
            if i + 1 >= len(argv):
                raise EnvError("--baseline 需要一个路径")
            opts["baseline"], opts["baseline_given"] = argv[i + 1], True
            i += 1
        elif a.startswith("--baseline="):
            opts["baseline"], opts["baseline_given"] = a.split("=", 1)[1], True
        elif a == "--write-baseline":
            opts["write"] = True
        elif a == "--json":
            opts["json"] = True
        elif a == "--all":
            opts["all"] = True
        elif a == "--summary":
            opts["summary"] = True
        elif a == "--registry":
            opts["registry"] = True
        elif a.startswith("--"):
            raise EnvError("未知选项 %s（--help 查看用法）" % a)
        else:
            opts["files"].append(a)
        i += 1
    if opts["baseline_given"] and not opts["baseline"]:
        raise EnvError("--baseline 需要一个路径")
    opts["baseline"] = os.path.abspath(opts["baseline"])
    return opts


def shell_quote(s):
    return s if re.match(r"^[\w./@%+=:,-]+$", s) else "'" + s.replace("'", "'\\''") + "'"


def rewrite_command(opts):
    parts = ["python3", "docs/_tools/check-doc-refs.py"]
    if opts["baseline_given"]:
        parts += ["--baseline", rel_repo(opts["baseline"])]
    parts += [rel_repo(f) for f in opts["files"]]
    parts.append("--write-baseline")
    return " ".join(shell_quote(p) for p in parts)


def problem_json(items):
    return [OrderedDict([("file", f), ("line", ln), ("message", msg)]) for f, ln, msg in items]


def dedupe(items):
    return list(OrderedDict.fromkeys(items))


def run(opts):
    if opts["files"]:
        dirs = [p for p in opts["files"] if os.path.isdir(p)]
        if dirs:
            raise EnvError("是目录，不是文件：%s（只接受 .md 文件路径；不带文件参数即全量扫描）" % "、".join(dirs))
        missing = [p for p in opts["files"] if not os.path.lexists(p)]
        if missing:
            raise EnvError("文件不存在：%s" % "、".join(missing))
    reg = Registry()
    if opts["registry"]:
        sys.stdout.write(json.dumps(reg.as_json(), ensure_ascii=False, indent=2) + "\n")
        return 0
    if opts["files"]:
        candidates = list(OrderedDict.fromkeys(os.path.abspath(p) for p in opts["files"]))
        opts["files"] = candidates
    else:
        candidates = list(iter_md_files())
    sources = [p for p in candidates if not path_exempt(p)]
    ref_counts = Counter()
    occurrences = OrderedDict()   # (文件, 类别, 引用) → [(行号, 原文, 原因)]
    read_problems = list(reg.problems)
    for path in sources:
        shown = rel_repo(path)
        try:
            items = load_items(path, read_problems)
        except OSError as exc:            # 断链、无权限：报在第 1 行，退出码 1，不写基线
            read_problems.append((shown, 1, "无法读取（%s）" % (exc.strerror or exc)))
            continue
        counts, problems = scan_items(path, items, reg)
        ref_counts.update(counts)
        for cat, ref, ln, text, why in problems:
            occurrences.setdefault((shown, cat, ref), []).append((ln, text, why))
    read_problems = dedupe(read_problems)
    current = {k: len(v) for k, v in occurrences.items()}
    scanned = {rel_repo(p) for p in sources}

    baseline_all, baseline_exists, baseline_problems = load_baseline(opts["baseline"])
    if opts["files"]:
        baseline = {k: n for k, n in baseline_all.items() if k[0] in scanned}
    else:
        baseline = dict(baseline_all)

    if opts["write"]:
        refuse = None
        if read_problems:
            refuse = "有 %d 处读取问题（不是 UTF-8、未闭合的围栏或注释、读不了），失配不可信，未写基线" % len(read_problems)
        elif baseline_problems and opts["files"]:
            refuse = "原基线不合法，不能只替换部分文件的键；修好或不带文件参数整体重写"
        if refuse:
            listed = read_problems or baseline_problems
            if opts["json"]:
                sys.stdout.write(json.dumps(OrderedDict([
                    ("baselineWritten", False), ("baseline", rel_repo(opts["baseline"])), ("reason", refuse),
                    ("problems", problem_json(listed)), ("exitCode", 1)]), ensure_ascii=False, indent=2) + "\n")
                return 1
            for f, ln, msg in listed:
                print("%s:%d → %s" % (f, ln, msg))
            print("%s：%s" % (TOOL, refuse))
            return 1
        merged = {k: n for k, n in baseline_all.items() if k[0] not in scanned} if opts["files"] else {}
        merged.update(current)
        added = sorted(k for k in current if current[k] > baseline.get(k, 0))
        removed = sorted(k for k in baseline if baseline[k] > current.get(k, 0))
        write_baseline(opts["baseline"], merged)
        if opts["json"]:
            sys.stdout.write(json.dumps(OrderedDict([
                ("baselineWritten", True), ("baseline", rel_repo(opts["baseline"])),
                ("mismatches", sum(merged.values())), ("keys", len(merged)),
                ("onlyFiles", sorted(scanned) if opts["files"] else None),
                ("refs", sum(ref_counts.values())),
                ("refsByCategory", OrderedDict((c, ref_counts[c]) for c in CATEGORIES)),
                ("previousBaselineProblems", problem_json(baseline_problems)),
                ("added", [OrderedDict([("file", k[0]), ("category", k[1]), ("ref", k[2]),
                                        ("baseline", baseline.get(k, 0)), ("current", current[k])])
                           for k in added] if baseline_exists else []),
                ("tightened", [OrderedDict([("file", k[0]), ("category", k[1]), ("ref", k[2]),
                                            ("baseline", baseline[k]), ("current", current.get(k, 0))])
                               for k in removed]),
                ("exitCode", 0)]), ensure_ascii=False, indent=2) + "\n")
            return 0
        print("%s：已写入基线 %s：失配 %d 处（%d 个键）%s" % (
            TOOL, rel_repo(opts["baseline"]), sum(merged.values()), len(merged),
            "；只更新了给出的 %d 个文件的键" % len(scanned) if opts["files"] else ""))
        if baseline_problems:
            print("注意：原基线有 %d 处问题（不是合法 JSON 或条目不合法），已整体重写" % len(baseline_problems))
        elif baseline_exists and added:
            print("注意：较原基线新增 %d 个键（基线应只减不增，须在评审中说明）：" % len(added))
            for k in added:
                print("  %s → %s（%s）：原 %d 处、现 %d 处" % (k[0], k[2], CATEGORIES.get(k[1], k[1]),
                                                       baseline.get(k, 0), current[k]))
        return 0

    total = sum(current.values())
    in_base = sum(min(n, baseline.get(k, 0)) for k, n in current.items())
    new = total - in_base
    tight_items = sorted((k, n, current.get(k, 0)) for k, n in baseline.items() if n > current.get(k, 0))
    tight = sum(n - c for _, n, c in tight_items)
    errors = read_problems + baseline_problems
    exit_code = 1 if (new or tight or errors) else 0
    by_cat = "、".join("%s %d" % (label, ref_counts[c]) for c, label in CATEGORIES.items())
    summary = "%s：来源 %d 个文件；引用 %d 处（%s）；失配 %d 处（基线内 %d、新增 %d）；可收紧 %d 处" % (
        TOOL, len(sources), sum(ref_counts.values()), by_cat, total, in_base, new, tight)
    if read_problems:
        summary += "；读取问题 %d 处" % len(read_problems)
    if baseline_problems:
        summary += "；基线问题 %d 处" % len(baseline_problems)

    def key_order(k):
        return (k[0], list(CATEGORIES).index(k[1]), k[2])

    if opts["json"]:
        items = []
        for k in sorted(occurrences, key=key_order):
            occ = occurrences[k]
            b = baseline.get(k, 0)
            items.append(OrderedDict([
                ("file", k[0]), ("category", k[1]), ("ref", k[2]), ("reason", occ[0][2]),
                ("current", len(occ)), ("baseline", b), ("status", "new" if len(occ) > b else "baseline"),
                ("occurrences", [OrderedDict([("line", ln), ("text", text)]) for ln, text, _ in occ]),
            ]))
        out = OrderedDict([
            ("summary", OrderedDict([
                ("sources", len(sources)), ("refs", sum(ref_counts.values())),
                ("refsByCategory", OrderedDict((c, ref_counts[c]) for c in CATEGORIES)),
                ("mismatches", total), ("inBaseline", in_base), ("new", new), ("tightenable", tight),
                ("readProblems", len(read_problems)), ("baselineProblems", len(baseline_problems)),
                ("baseline", rel_repo(opts["baseline"])), ("baselineExists", baseline_exists),
            ])),
            ("mismatches", items),
            ("tightenable", [OrderedDict([("file", k[0]), ("category", k[1]), ("ref", k[2]),
                                          ("baseline", n), ("current", c)]) for k, n, c in tight_items]),
            ("readProblems", problem_json(read_problems)),
            ("baselineProblems", problem_json(baseline_problems)),
            ("exitCode", exit_code),
        ])
        sys.stdout.write(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
        return exit_code

    print(summary)
    if opts["summary"]:
        return exit_code
    if not baseline_exists:
        print("基线文件 %s 不存在，按空基线判定" % rel_repo(opts["baseline"]))
    for f, ln, msg in errors:
        print("%s:%d → %s" % (f, ln, msg))

    def detail_lines(keys, suffix=""):
        rows = OrderedDict()             # 同一行同一引用多次出现只列一行，注明处数
        for k in keys:
            b = baseline.get(k, 0)
            note = "；基线 %d 处、现 %d 处" % (b, current[k]) if (b and current[k] > b) else ""
            for ln, text, why in occurrences[k]:
                orig = "；原文 %s" % text if k[1] == "rest" and " ".join(text.split()) != k[2] else ""
                body = (k[0], ln, list(CATEGORIES).index(k[1]), k[2], why, note, orig)
                rows[body] = rows.get(body, 0) + 1
        for (f, ln, ci, ref, why, note, orig), n in sorted(rows.items()):
            times = "；本行 %d 处" % n if n > 1 else ""
            print("%s:%d → %s（%s：%s%s%s%s）%s" % (f, ln, ref, list(CATEGORIES.values())[ci], why, note, orig, times,
                                                suffix))

    news = [k for k in occurrences if current[k] > baseline.get(k, 0)]
    if news:
        print("新增失配（修正引用，或先在归属文档登记；不要靠重写基线吸收）：")
        detail_lines(news)
    if opts["all"]:
        olds = [k for k in occurrences if current[k] <= baseline.get(k, 0)]
        if olds:
            print("基线内失配：")
            detail_lines(olds, "［基线内］")
    if tight_items:
        print("可收紧（基线里有、现已减少）：")
        for k, n, c in tight_items:
            print("%s → %s（%s）：基线 %d 处、现 %d 处" % (k[0], k[2], CATEGORIES.get(k[1], k[1]), n, c))
        print("运行 %s 收紧基线，随同一提交入库" % rewrite_command(opts))
    return exit_code


def main(argv):
    want_json = "--json" in argv
    try:
        opts = parse_args(argv)
        if opts.get("help"):
            print(USAGE)
            return 0
        return run(opts)
    except EnvError as exc:
        message = "%s：%s" % (TOOL, exc)
    except Exception as exc:              # 意外异常：内部错误，退出码 2
        traceback.print_exc()
        message = "%s：内部错误（%s: %s）" % (TOOL, type(exc).__name__, exc)
    if want_json:
        sys.stdout.write(json.dumps(OrderedDict([("error", message), ("exitCode", 2)]), ensure_ascii=False, indent=2)
                         + "\n")
    print(message, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
