#!/usr/bin/env python3
"""check-req-coverage：需求覆盖门禁 G4（docs/80-process/02 §1.3、03 §1；rulings §4.25 TP-1）。

只用标准库；除 --write-baseline 写基线文件外只读。判定 PRD 每条 P0 / P1 需求在设计、前后端、测试三条线的文档里都有
落点（引用了它的编号），或在 PRD 该需求下写了落点豁免；缺口按基线棘轮执行。

需求清单（PRD 解析）、正文切分与需求编号引用识别的规则只在共享模块 prdlib.py 里实现（check-change-impact.py、
check-doc-refs.py 用同一份代码），规则清单见 prdlib.py 文件头；成文规格 docs/80-process/02 §1.1–§1.3、§3。本脚本另做：
  - PRD 的格式检查：prdlib 解析时报出的全部格式错误（未闭合的围栏或注释、像需求定义却不合格式的标题、缺优先级或目标
    里程碑、写错的字段、表格引用行里的字段、重复定义等）与读取问题都报出，退出码 1；
  - 各线引用：设计 20-design（排除 20-design 下的 playground/、mockups/、prototype/）、前端 50-frontend、后端 60-backend、
    测试 70-testing，只扫 .md，其余子目录照常扫描；按读者看得见的文字计（prdlib.ref_lines(include_fences=True)）：HTML
    注释与「> 状态：」头行里的编号不算，围栏代码块里的照算（mermaid 节点、代码示例里的 @req 标签都看得见；G5 只查正文，
    这是 G4 自己的扫描范围）；prdlib.classify_refs 归类为 prd 的编号才计（CO 须带 PRD 字样、证据条目与能力 id 不算），
    只计 PRD 中存在的编号；各线文档不是 UTF-8、读不了、HTML 注释直到文件尾没闭合时报错（围栏不闭合不丢引用，不报）；
    证据清单读不了时报错；
  - 不带 PRD 字样的 CO 编号不计，在该需求的缺口原因里提示改写为「PRD CO-xx」。

覆盖规则（80/02 §1.3）：P0、P1 需求须 设计 ≥ 1 处、前端与后端合计 ≥ 1 处、测试 ≥ 1 处，或有对应的落点豁免
（「前后端」豁免前后端合计这一项；只写「前端」或只写「后端」不抵合计，两者都写才抵）；P2 与无优先级的需求只进报告，
不判失败；已删除的需求不检查。缺口以（需求编号, 线）为单位，线取 设计 / 前后端 / 测试。

棘轮（80/02 §1.3；design.md 决策 5）：基线缺省为 <docs>/_tools/req-coverage-baseline.json（随 CORDEX_DOCS_ROOT 变），
不存在时视为空。不在基线里的缺口（新增）即失败；基线里已不存在的缺口（可收紧）也失败，提示运行 --write-baseline 收紧，
使基线在仓库里只减不增。--write-baseline 按当前缺口重写基线并退出 0；PRD、各线文档或证据清单有任何解析错误时不写、
退出 1（解析出错时算出的缺口不可信，写进基线就成了被放行的缺口；design.md 决策 5），与 --json 同用时照样输出机读结果。
基线带 generated 说明字段，按需求排序、一条缺口一行，便于审阅 diff；读基线时任意排版、键序都能定位条目所在行。

输出：先打印汇总行「check-req-coverage：需求 N 条（P0 a、P1 b、P2 c、无优先级 d[、已删除 e]）；缺口 X 处（基线内 Y、
新增 Z）；可收紧 W 处」（括号里各项相加等于 N；无优先级的是 PRD 04 的 NF——70/13 §2 记作 NF——以及优先级没写对的
PRD 03 需求，后者另报格式错误），再逐条列出格式错误、
新增缺口（报 PRD 中该需求的「文件:行」与原因）与可收紧条目（报基线的「文件:行」）；有任何一项退出码 1，否则 0。

用法：
  python3 docs/_tools/check-req-coverage.py                    # 按基线检查
  python3 docs/_tools/check-req-coverage.py --report           # 另按功能域列出全部缺口（含只报告的）
  python3 docs/_tools/check-req-coverage.py --json             # 机读输出：需求清单、各线引用、缺口、可收紧
  python3 docs/_tools/check-req-coverage.py --write-baseline   # 按当前缺口重写基线
  选项：--baseline <路径> 改用别的基线文件；环境变量 CORDEX_DOCS_ROOT 改用别的 docs 根目录（自测用，缺省
  基线随之变为 <CORDEX_DOCS_ROOT>/_tools/req-coverage-baseline.json）
"""
import json
import os
import re
import sys
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:                 # 以模块方式加载（importlib、别的目录下运行）时也找得到同目录的 prdlib
    sys.path.insert(0, HERE)
import prdlib  # noqa: E402

DOCS = os.path.abspath(os.environ.get("CORDEX_DOCS_ROOT") or os.path.join(HERE, ".."))
REPO = os.path.dirname(DOCS)
BASELINE = os.path.join(DOCS, "_tools", "req-coverage-baseline.json")
DOMAINS = prdlib.DOMAINS

# ---------------------------------------------------------------- 覆盖规则
TRACK_DIRS = OrderedDict([("设计", "20-design"), ("前端", "50-frontend"), ("后端", "60-backend"), ("测试", "70-testing")])
TRACK_EXCLUDES = {"设计": ("playground", "mockups", "prototype")}   # 只排除该线目录下这几个顶层子目录
GAP_TRACKS = ("设计", "前后端", "测试")
CHECKED_PRIORITIES = ("P0", "P1")
BASELINE_NOTE = ("由 docs/_tools/check-req-coverage.py --write-baseline 生成，勿手改。gaps 为 P0 / P1 需求的文档覆盖缺口"
                 "（id 为 PRD 需求编号，track 取 设计 / 前后端 / 测试），规则见 docs/80-process/02 §1.3；"
                 "基线只减不增（G4 棘轮），由 docs-coverage-baseline 变更清零。")
OBJ_RE = re.compile(r"\{[^{}]*\}")


# ---------------------------------------------------------------- 通用
def show(path):
    """仓库内的路径显示为相对仓库根的路径，仓库外的显示绝对路径。"""
    return prdlib.show_path(path, REPO)


def gap_key(rid, track):
    return prdlib.id_key(rid) + (GAP_TRACKS.index(track) if track in GAP_TRACKS else len(GAP_TRACKS),)


# ---------------------------------------------------------------- PRD 需求清单与各线引用
def parse_requirements():
    """返回 (需求列表, 错误列表)：prdlib.load_prd 的需求与全部格式错误、读取问题。错误为 (文件, 行, 原因)。"""
    res = prdlib.load_prd(DOCS)
    return list(res.reqs.values()), res.read_errors + res.errors


def iter_track_files(track, track_dir, errors):
    root = os.path.join(DOCS, track_dir)
    excluded = TRACK_EXCLUDES.get(track, ())

    def onerror(exc):
        errors.append((show(getattr(exc, "filename", None) or root), 0,
                       "目录无法读取（%s），其下文档未统计" % (getattr(exc, "strerror", None) or exc)))

    for base, dirs, files in os.walk(root, onerror=onerror):
        dirs[:] = sorted(d for d in dirs if not (base == root and d in excluded))
        for f in sorted(files):
            if f.endswith(".md"):
                yield os.path.join(base, f)


def scan_refs(known, evidence_ids):
    """返回 ({线: {ID: [(文件, 行)]}}, {线: {CO 编号: [(文件, 行)]}}（不带 PRD 字样的提及）, {线: 扫描文件数}, 错误列表)，
    只记 known 中的编号。"""
    refs, bare, nfiles, errors = OrderedDict(), OrderedDict(), OrderedDict(), []
    for track, d in TRACK_DIRS.items():
        refs[track], bare[track], nfiles[track] = {}, {}, 0
        root = os.path.join(DOCS, d)
        if not os.path.isdir(root):
            errors.append((show(root), 0, "「%s」线目录不存在：该线的引用无从统计" % track))
            continue
        for path in iter_track_files(track, d, errors):
            nfiles[track] += 1
            shown = show(path)
            try:
                text, problem = prdlib.read_text(path)
            except OSError as exc:
                errors.append((shown, 1, "无法读取（%s），按空文件处理" % (exc.strerror or exc)))
                continue
            if problem:
                errors.append((shown, problem[0], problem[1]))
            items, unclosed = prdlib.scan_markdown(text)
            if unclosed and unclosed[1] == prdlib.UNCLOSED_KINDS[1]:     # 围栏不闭合时其后照算，不丢引用
                errors.append((shown, unclosed[0], "HTML 注释从这一行起直到文件尾都没有闭合：其后的引用都不计（补上「-->」）"))
            caps = prdlib.capability_spans(items)
            for ln, line in prdlib.ref_lines(items, include_fences=True):
                for rid, _, _, kind in prdlib.classify_refs(line, caps.get(ln, ()), evidence_ids):
                    if rid not in known:
                        continue
                    if kind == "prd":
                        refs[track].setdefault(rid, []).append((shown, ln))
                    elif kind == "co-bare":
                        bare[track].setdefault(rid, []).append((shown, ln))
    return refs, bare, nfiles, errors



# ---------------------------------------------------------------- 覆盖判定
def front_back_exempt(ex):
    return "前后端" in ex or ("前端" in ex and "后端" in ex)


def evaluate(reqs, refs):
    """返回 (判失败的缺口, 只报告的缺口)。缺口为 {id, track, req}；已删除的需求不检查。"""
    checked, report_only = [], []
    for q in reqs:
        if q["deleted"]:
            continue
        ex, rid = q["exemptions"], q["id"]
        n = {t: len(refs[t].get(rid, ())) for t in TRACK_DIRS}
        missing = []
        if n["设计"] == 0 and "设计" not in ex:
            missing.append("设计")
        if n["前端"] + n["后端"] == 0 and not front_back_exempt(ex):
            missing.append("前后端")
        if n["测试"] == 0 and "测试" not in ex:
            missing.append("测试")
        target = checked if q["priority"] in CHECKED_PRIORITIES else report_only
        target.extend({"id": rid, "track": t, "req": q} for t in missing)
    return checked, report_only


def bare_hits(g, bare):
    sides = ("前端", "后端") if g["track"] == "前后端" else (g["track"],)
    return [loc for t in sides for loc in bare[t].get(g["id"], ())]


def gap_reason(g, bare):
    q, track = g["req"], g["track"]
    if track == "前后端":
        why = "%s 与 %s 下都没有引用，也没有「前后端」落点豁免" % (
            show(os.path.join(DOCS, TRACK_DIRS["前端"])), show(os.path.join(DOCS, TRACK_DIRS["后端"])))
        single = [t for t in ("前端", "后端") if t in q["exemptions"]]
        if single:
            why += "（只写「%s」豁免不抵前后端合计）" % single[0]
    else:
        why = "%s 下没有引用，也没有落点豁免" % show(os.path.join(DOCS, TRACK_DIRS[track]))
    hits = bare_hits(g, bare)
    if hits:
        why += "；另有 %d 处不带「PRD」字样的 %s（%s:%d%s），CO 编号须写作「PRD %s」才算需求引用（80/02 §3，避免与 " \
               "rulings §4.18 的条目混淆）" % (len(hits), g["id"], hits[0][0], hits[0][1], " 等" if len(hits) > 1 else "", g["id"])
    return why


def stale_reason(key, by_id, refs):
    rid, track = key
    q = by_id.get(rid)
    if q is None:
        return "PRD 中已没有这条需求"
    if q["deleted"]:
        return "需求已标注「已删除」"
    if q["priority"] not in CHECKED_PRIORITIES:
        return "优先级已不是 P0 / P1（现为 %s）" % (q["priority"] or "无优先级")
    if track not in GAP_TRACKS:
        return "线名不合法"
    sides = ("前端", "后端") if track == "前后端" else (track,)
    if track == "前后端" and front_back_exempt(q["exemptions"]):
        names = [t for t in ("前后端", "前端", "后端") if t in q["exemptions"]]
        return "已写落点豁免（%s）" % "、".join("%s——%s" % (t, q["exemptions"][t]["reason"]) for t in names)
    if track in q["exemptions"]:
        return "已写落点豁免（%s——%s）" % (track, q["exemptions"][track]["reason"])
    for t in sides:
        if refs[t].get(rid):
            f, ln = refs[t][rid][0]
            return "已有落点（%s:%d）" % (f, ln)
    return "已不是缺口"


# ---------------------------------------------------------------- 基线
def load_baseline(path):
    """返回 ({(id, track): 基线中的行号}, 错误列表, 文件是否存在)。行号取条目 "id" 键所在行，任意排版、键序都能定位。"""
    entries, errors = OrderedDict(), []
    if not os.path.exists(path):
        return entries, errors, False
    shown = show(path)
    try:
        with open(path, encoding="utf-8-sig") as fh:
            text = fh.read()
    except (OSError, UnicodeDecodeError) as exc:
        errors.append((shown, 1, "基线文件无法读取（%s）" % exc))
        return entries, errors, True
    try:
        data = json.loads(text)
    except ValueError as exc:
        errors.append((shown, getattr(exc, "lineno", 1), "基线文件不是合法 JSON（%s）" % getattr(exc, "msg", exc)))
        return entries, errors, True
    gaps = data.get("gaps") if isinstance(data, dict) else None
    at = text.find('"gaps"')
    gaps_line = text.count("\n", 0, at) + 1 if at >= 0 else 1
    if not isinstance(gaps, list):
        errors.append((shown, gaps_line, "基线文件缺少 gaps 列表"))
        return entries, errors, True
    located = []                      # [(对象, 行号)]，按出现顺序
    for m in OBJ_RE.finditer(text, max(at, 0)):
        try:
            obj = json.loads(m.group(0))
        except ValueError:
            continue
        k = m.group(0).find('"id"')
        located.append((obj, text.count("\n", 0, m.start() + max(k, 0)) + 1))

    def line_of(item):
        for idx, (obj, ln) in enumerate(located):
            if obj == item:
                del located[idx]
                return ln
        return gaps_line

    for item in gaps:
        ln = line_of(item) if isinstance(item, dict) else gaps_line
        if not (isinstance(item, dict) and isinstance(item.get("id"), str) and item.get("track") in GAP_TRACKS):
            errors.append((shown, ln, "基线条目不合法：%s（应为 {\"id\": <需求编号>, \"track\": 设计|前后端|测试}）"
                           % json.dumps(item, ensure_ascii=False)))
            continue
        key = (item["id"], item["track"])
        if key in entries:
            errors.append((shown, ln, "基线条目重复：%s / %s（首次在第 %d 行）" % (key[0], key[1], entries[key])))
            continue
        entries[key] = ln
    return entries, errors, True


def baseline_text(keys):
    keys = sorted(set(keys), key=lambda k: gap_key(*k))
    out = ["{", '  "generated": %s,' % json.dumps(BASELINE_NOTE, ensure_ascii=False)]
    if not keys:
        out.append('  "gaps": []')
    else:
        out.append('  "gaps": [')
        for i, (rid, track) in enumerate(keys):
            item = json.dumps(OrderedDict([("id", rid), ("track", track)]), ensure_ascii=False)
            out.append("    %s%s" % (item, "," if i < len(keys) - 1 else ""))
        out.append("  ]")
    out.append("}")
    return "\n".join(out) + "\n"


# ---------------------------------------------------------------- 输出
def priority_counts(reqs):
    counts = OrderedDict([("P0", 0), ("P1", 0), ("P2", 0), (None, 0)])
    deleted = 0
    for q in reqs:
        if q["deleted"]:
            deleted += 1
        else:
            counts[q["priority"]] += 1
    return counts, deleted


def summary_lines(reqs, n_gaps, n_base, n_new, n_stale):
    """单行汇总：括号里各项相加等于需求总数（无优先级的是 PRD 04 的 NF，只报告；已删除的不检查）。"""
    counts, deleted = priority_counts(reqs)
    parts = ["P0 %d" % counts["P0"], "P1 %d" % counts["P1"], "P2 %d" % counts["P2"], "无优先级 %d" % counts[None]]
    if deleted:
        parts.append("已删除 %d" % deleted)
    return ["check-req-coverage：需求 %d 条（%s）；缺口 %d 处（基线内 %d、新增 %d）；可收紧 %d 处"
            % (len(reqs), "、".join(parts), n_gaps, n_base, n_new, n_stale)]


def ref_counts(refs, rid):
    return "〔%s〕" % "｜".join(str(len(refs[t].get(rid, ()))) for t in TRACK_DIRS)


def print_report(reqs, refs, bare, checked, report_only, base_keys):
    print()
    print("覆盖报告：P0 / P1 的缺口判失败（标注 基线 / 新增），P2 与无优先级只报告；〔%s〕是各线引用处数"
          % "｜".join(TRACK_DIRS))
    gaps_of = OrderedDict()
    for g in checked + report_only:
        gaps_of.setdefault(g["id"], []).append(g)
    domains = list(DOMAINS) + sorted({q["domain"] for q in reqs} - set(DOMAINS))
    for dom in domains:
        dreqs = [q for q in reqs if q["domain"] == dom]
        if not dreqs:
            continue
        n_checked = sum(1 for g in checked if g["req"]["domain"] == dom)
        n_report = sum(1 for g in report_only if g["req"]["domain"] == dom)
        print("== %s（%s）：需求 %d 条；缺口 %d 处，只报告 %d 处" % (dom, dreqs[0]["domainTitle"], len(dreqs), n_checked, n_report))
        printed = False
        for q in dreqs:
            for t, ex in q["exemptions"].items():
                print("  %s %s 落点豁免：%s——%s（%s:%d）" % (q["id"], q["priority"] or "无优先级", t, ex["reason"],
                                                       q["file"], ex["line"]))
                printed = True
            if q["deleted"]:
                print("  %s 已删除，不检查（%s:%d）" % (q["id"], q["file"], q["line"]))
                printed = True
            gs = gaps_of.get(q["id"])
            if not gs:
                continue
            if q["priority"] in CHECKED_PRIORITIES:
                tracks = "、".join("%s（%s）" % (g["track"], "基线" if (g["id"], g["track"]) in base_keys else "新增")
                                   for g in gs)
            else:
                tracks = "、".join(g["track"] for g in gs) + "（只报告）"
            unmarked = ["%s %d" % (t, len(bare[t][q["id"]])) for t in TRACK_DIRS if bare[t].get(q["id"])]
            note = "（不带 PRD 字样的 CO 提及：%s）" % "、".join(unmarked) if unmarked else ""
            print("  %s %s 缺 %s %s%s %s %s:%d" % (q["id"], q["priority"] or "无优先级", tracks, ref_counts(refs, q["id"]),
                                                 note, q["title"], q["file"], q["line"]))
            printed = True
        if not printed:
            print("  无缺口")


def json_output(reqs, refs, bare, nfiles, checked, report_only, stale, errors, base_path, base_keys, by_id, written):
    counts, deleted = priority_counts(reqs)

    def gap_obj(g, status):
        q = g["req"]
        return OrderedDict([("id", g["id"]), ("track", g["track"]), ("priority", q["priority"]), ("status", status),
                            ("file", q["file"]), ("line", q["line"]), ("reason", gap_reason(g, bare))])

    n_new = sum(1 for g in checked if (g["id"], g["track"]) not in base_keys)
    data = OrderedDict([
        ("summary", OrderedDict([
            ("requirements", len(reqs)),
            ("byPriority", OrderedDict([("P0", counts["P0"]), ("P1", counts["P1"]), ("P2", counts["P2"]),
                                        ("none", counts[None])])),
            ("deleted", deleted),
            ("gaps", len(checked)), ("inBaseline", len(checked) - n_new), ("new", n_new), ("stale", len(stale)),
            ("reportOnly", len(report_only)), ("errors", len(errors)),
        ])),
        ("baseline", show(base_path)),
        ("baselineWritten", written),
        ("scannedFiles", nfiles),
        ("errors", [OrderedDict([("file", f), ("line", ln), ("message", msg)]) for f, ln, msg in errors]),
        ("gaps", [gap_obj(g, "baseline" if (g["id"], g["track"]) in base_keys else "new") for g in checked]),
        ("reportOnly", [gap_obj(g, "report-only") for g in report_only]),
        ("stale", [OrderedDict([("id", k[0]), ("track", k[1]), ("reason", stale_reason(k, by_id, refs)),
                                ("baselineLine", ln)]) for k, ln in stale]),
        ("requirements", [OrderedDict(list(prdlib.req_json(q).items()) + [
            ("refs", OrderedDict((t, OrderedDict([
                ("count", len(refs[t].get(q["id"], ()))),
                ("files", list(OrderedDict.fromkeys(f for f, _ in refs[t].get(q["id"], ())))),
                ("unmarkedCo", len(bare[t].get(q["id"], ()))),
            ])) for t in TRACK_DIRS)),
        ]) for q in reqs]),
    ])
    print(json.dumps(data, ensure_ascii=False, indent=2))


# ---------------------------------------------------------------- 主流程
def parse_args(argv):
    opts = {"baseline": BASELINE, "write": False, "json": False, "report": False}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--baseline" or a.startswith("--baseline="):
            if "=" in a:
                value = a.split("=", 1)[1]
            elif i + 1 < len(argv) and not argv[i + 1].startswith("--"):
                i += 1
                value = argv[i]
            else:
                value = ""
            if not value:
                raise SystemExit("check-req-coverage：--baseline 需要一个路径")
            opts["baseline"] = os.path.abspath(value)
        elif a == "--write-baseline":
            opts["write"] = True
        elif a == "--json":
            opts["json"] = True
        elif a == "--report":
            opts["report"] = True
        elif a in ("-h", "--help"):
            print(__doc__)
            raise SystemExit(0)
        else:
            raise SystemExit("check-req-coverage：未知参数 %s（可用：--baseline <路径>、--write-baseline、--json、--report）" % a)
        i += 1
    return opts


def main(argv):
    opts = parse_args(argv)
    reqs, prd_errors = parse_requirements()
    by_id = {q["id"]: q for q in reqs}
    evidence_ids, evidence_errors = prdlib.load_evidence_ids(DOCS)
    refs, bare, nfiles, scan_errors = scan_refs(set(by_id), evidence_ids)
    parse_errors = prd_errors + evidence_errors + scan_errors
    checked, report_only = evaluate(reqs, refs)
    current = OrderedDict(((g["id"], g["track"]), g) for g in checked)
    base_path = opts["baseline"]
    base_entries, base_errors, base_exists = load_baseline(base_path)

    if opts["write"]:
        if parse_errors:
            if opts["json"]:
                print(json.dumps(OrderedDict([
                    ("baselineWritten", False), ("baseline", show(base_path)),
                    ("reason", "PRD、各线文档或证据清单有解析错误，缺口不可信，未写基线"),
                    ("errors", [OrderedDict([("file", f), ("line", ln), ("message", msg)]) for f, ln, msg in parse_errors]),
                    ("exitCode", 1)]), ensure_ascii=False, indent=2))
                return 1
            for f, ln, msg in parse_errors:
                print("%s:%d: %s" % (f, ln, msg), file=sys.stderr)
            print("check-req-coverage：PRD、各线文档或证据清单有 %d 处解析错误，缺口不可信，未写基线" % len(parse_errors),
                  file=sys.stderr)
            return 1
        old = set(base_entries)
        try:
            with open(base_path, "w", encoding="utf-8") as fh:
                fh.write(baseline_text(current))
        except OSError as exc:
            print("check-req-coverage：无法写入基线 %s（%s）" % (show(base_path), exc), file=sys.stderr)
            return 1
        added = [k for k in current if k not in old]
        n_removed = len(old - set(current))
        base_keys = set(current)
        if opts["json"]:
            json_output(reqs, refs, bare, nfiles, checked, report_only, [], [], base_path, base_keys, by_id, True)
            return 0
        for line in summary_lines(reqs, len(checked), len(checked), 0, 0):
            print(line)
        print("已写入基线 %s：缺口 %d 处（较原基线新增 %d、移除 %d）" % (show(base_path), len(current), len(added), n_removed))
        if base_errors:
            print("注意：原基线有 %d 处问题（不是合法 JSON 或条目不合法），已整体重写" % len(base_errors))
        elif added and base_exists:
            print("注意：基线新增 %d 处；80/02 §1.3 规定基线只减不增，新增须在评审中说明：" % len(added))
            for k in added:
                g = current[k]
                print("%s:%d: %s（%s）缺「%s」落点" % (g["req"]["file"], g["req"]["line"], k[0], g["req"]["priority"], k[1]))
        return 0

    errors = parse_errors + base_errors
    base_keys = set(base_entries)
    new = [g for g in checked if (g["id"], g["track"]) not in base_keys]
    stale = [(k, ln) for k, ln in base_entries.items() if k not in current]
    if opts["json"]:
        json_output(reqs, refs, bare, nfiles, checked, report_only, stale, errors, base_path, base_keys, by_id, False)
        return 1 if errors or new or stale else 0

    for line in summary_lines(reqs, len(checked), len(checked) - len(new), len(new), len(stale)):
        print(line)
    if report_only:
        print("只报告（P2 与无优先级，不判失败）：缺口 %d 处，用 --report 查看" % len(report_only))
    if errors:
        print("格式错误 %d 处：" % len(errors))
        for f, ln, msg in errors:
            print("%s:%d: %s" % (f, ln, msg))
    if new:
        print("新增缺口 %d 处（不在基线中：补上落点，或在 PRD 该需求下写「- 落点豁免：<线>——<理由>」）：" % len(new))
        for g in new:
            q = g["req"]
            print("%s:%d: %s（%s）缺「%s」落点：%s" % (q["file"], q["line"], g["id"], q["priority"], g["track"],
                                                gap_reason(g, bare)))
    if stale:
        print("可收紧 %d 处（基线中已不存在的缺口；运行 python3 docs/_tools/check-req-coverage.py --write-baseline 收紧基线）："
              % len(stale))
        for k, ln in stale:
            print("%s:%d: %s / %s：%s" % (show(base_path), ln, k[0], k[1], stale_reason(k, by_id, refs)))
    if opts["report"]:
        print_report(reqs, refs, bare, checked, report_only, base_keys)
    return 1 if errors or new or stale else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
