#!/usr/bin/env python3
"""check-plugin-counts：包数、cordis 插件数与各 preset 装配数的唯一口径核对。

口径（rulings §4.23 补充裁决「插件仅计 cordis 插件」，2026-10-01）：「插件」只指 cordis 插件，即
host / definition / provider / plugin / bundle 五种形态；纯库（library）与 Nest 模块不是插件，不计入
任何插件数，只和插件一起列在 40/16 §2 的「运行时单元」总账里（运行时单元 = 插件 + 纯库 + Nest 模块）。

只用标准库、只读。数字的唯一来源是 40-modules/16-plugin-catalog.md（§2 主表、§3 Definition 表、
§4 贡献点表、§5.1 preset-server 装配表）与 00-charter/charter.md §5.2 包清单；本脚本从这些表
机械重算，得到与 docs/_tools/plugin-counts.json 同结构的数字，然后做四件事：

  1. 重算值与 plugin-counts.json 逐项比对，不一致报「json 键: 文件值 → 重算值」；
  2. 40/16 §2 主表「插件」列与「形态」列互查：cordis 五种形态必须记「是」，纯库记「否（纯库）」，
     Nest 模块记「否（Nest 模块）」；
  3. charter §5.2 的 M1–M4 npm 包集合与 40/16 §2「承载包」列出现的 @cordexjs/* 包集合互查，
     任一侧多出的包都报出来（M5 的 preset-doc / preset-sheet 不参与互查）；
  4. 扫描 docs/ 下全部 .md，找出计数句，数字与 json 不一致即报「文件:行」：
       「N 个插件」「N 个 cordis 插件」       = plugins.total（或同一行点名的 preset 的装配数）
       「N 个运行时单元」                      = runtimeUnits.total
       「N 个纯库」                            = runtimeUnits.library
       「N 个 npm 包」                         = packages.npm 或 packages.npmWithM5
       「共 N 个 Nest 模块」                   = runtimeUnits.nest

有任何失配退出码 1，否则 0。

计数句豁免（与 check-terms.py 同一思路）：
  - 跳过 00-charter/rulings-*、_evidence/、30-architecture/adr/、_tools/（裁决原文、证据快照、ADR 原文、生成物）；
  - 跳过「> 状态：」头行（变更记录）；
  - 数字前 12 个字符内有「由 / 原 / 旧 / 此前 / 曾 / 从」，或其后 10 个字符内有「减为 / 增为 / 调整 / → / 改为」
    的历史陈述放行；整行含「~~」（删除线）放行；
  - 「N 个插件」「N 个 cordis 插件」的 N 也可以是同一行前文点名的 preset 的装配数（viewer / slide / collab / server）；
  - 裸「N 个插件」另外豁免：20-design/（界面样张里的演示数据，如「1 个插件启动失败」）、00-charter/reference-*
    （外部系统的对照材料），以及数字前紧挨「约 / ~ / ～ / 近」的约数（说的是别的系统）。

用法：
  python3 docs/_tools/check-plugin-counts.py            # 全量核对
  python3 docs/_tools/check-plugin-counts.py --emit     # 把重算结果按 json 打到标准输出（重新生成 json 用：
                                                        #   ... --emit > docs/_tools/plugin-counts.json）
  选项：--summary 只打印汇总
改了 40/16 的 §2–§5.1 或 charter §5.2 后必跑；数字变化时先 --emit 重新生成 json，再改引用处的文字。
"""
import json
import os
import re
import sys
from collections import Counter, OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.normpath(os.environ.get("CORDEX_DOCS_ROOT") or os.path.join(HERE, ".."))
CATALOG = os.path.join(DOCS, "40-modules", "16-plugin-catalog.md")
CHARTER = os.path.join(DOCS, "00-charter", "charter.md")
JSON_PATH = os.path.join(HERE, "plugin-counts.json")
SKIP_DIRS = {"node_modules", "dist", "playground", "_evidence", "mockups", "prototype", ".git", "docs-site"}
SKIP_PREFIXES = ("00-charter/rulings-", "_evidence/", "30-architecture/adr/", "_tools/")


def rel(path):
    return os.path.relpath(path, DOCS).replace(os.sep, "/")


def read_lines(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read().split("\n")


def split_row(line):
    body = line.strip()
    if body.startswith("|"):
        body = body[1:]
    if body.endswith("|"):
        body = body[:-1]
    # 表格单元里的竖线一律写作 \|，先保护再切分
    parts = body.replace("\\|", "\x00").split("|")
    return [p.replace("\x00", "|").strip() for p in parts]


def find_table(lines, header_prefix, path):
    """返回 (表头列名列表, 行列表[dict], 首行行号)。header_prefix 匹配表头行开头。"""
    for i, line in enumerate(lines):
        if line.startswith(header_prefix):
            header = split_row(line)
            rows = []
            j = i + 2
            while j < len(lines) and lines[j].startswith("|"):
                cells = split_row(lines[j])
                if len(cells) != len(header):
                    raise SystemExit(f"{rel(path)}:{j + 1}: 列数 {len(cells)} ≠ 表头 {len(header)}")
                rows.append(dict(zip(header, cells), _line=j + 1))
                j += 1
            return header, rows, i + 1
    raise SystemExit(f"{rel(path)}: 找不到以「{header_prefix}」开头的表")


# ---------- 40/16 §2 主表 ----------
FORMS = OrderedDict([("host", "host"), ("definition", "definition"), ("provider", "provider"),
                     ("plugin", "plugin"), ("bundle", "bundle"), ("library", "library"), ("Nest 模块", "nest")])
NECESSITY = OrderedDict([("内核必需", "core"), ("契约必需", "contract"), ("可选·降级", "optionalDegrade"),
                         ("可选扩展", "optionalExtension"), ("N/A", "na")])
SCOPE = {"内容级": "content", "界面级": "ui", "—": "na"}
LOCATION = {"两端": "both", "浏览器": "browser", "服务端": "server"}
CORDIS_FORMS = ("host", "definition", "provider", "plugin", "bundle")
# §2 主表「插件」列的应填值：cordis 五种形态记「是」，纯库与 Nest 模块记「否」（rulings §4.23 补充裁决）
PLUGIN_MARK = {"library": "否（纯库）", "nest": "否（Nest 模块）"}
PLUGIN_MARK.update({f: "是" for f in CORDIS_FORMS})
PRESET_TOKEN = re.compile(r"(viewer|slide|collab|server)([●◐▲○])")
PKG_RE = re.compile(r"@cordexjs/[a-z0-9-]+")


def classify(value, table, what, line):
    for key, code in table.items():
        if value.startswith(key):
            return code
    raise SystemExit(f"{rel(CATALOG)}:{line}: 无法识别的{what}「{value}」")


def package_of(cell):
    m = PKG_RE.search(cell)
    if m:
        return m.group(0)
    if cell.startswith("`apps/server`") or cell.startswith("同上"):
        return "apps/server"
    if cell.startswith("`apps/web`"):
        return "apps/web"
    if cell.startswith("`preset-slide-viewer/"):
        return "@cordexjs/preset-slide-viewer"
    if cell.startswith("`preset-*/"):
        return "preset-*（各 preset 自带语言包）"
    return cell


MILESTONES = ("M1", "M2", "M3", "M4")


def cumulative(counter):
    out, acc = OrderedDict(), 0
    for m in MILESTONES:
        acc += counter[m]
        out[m] = acc
    return out


def compute_units(lines):
    """返回 (plugins, runtimeUnits, 浏览器 preset, server 单元, 逐包, 「插件」列失配)。插件统计只算 cordis 五种形态。"""
    _, rows, _ = find_table(lines, "| # | 单元名", CATALOG)
    nums = [int(r["#"]) for r in rows]
    if nums != list(range(1, len(rows) + 1)):
        raise SystemExit(f"{rel(CATALOG)}: §2 主表行号不连续（应为 1…{len(rows)}）")
    form_c, nec_c, scope_c, loc_c, ms_c = Counter(), Counter(), Counter(), Counter(), Counter()
    all_ms, lib_ms, nest_ms = Counter(), Counter(), Counter()
    presets = {p: Counter() for p in ("viewer", "slide", "collab", "server")}
    by_pkg = OrderedDict()
    mark_problems = []
    for r in rows:
        ln = r["_line"]
        form = classify(r["形态"], FORMS, "形态", ln)
        form_c[form] += 1
        is_plugin = form in CORDIS_FORMS
        if r["插件"] != PLUGIN_MARK[form]:
            mark_problems.append(f"{rel(CATALOG)}:{ln}: §2 第 {r['#']} 行形态 {form}，「插件」列应为「{PLUGIN_MARK[form]}」，"
                                 f"实为「{r['插件']}」")
        nec = classify(r["必需性"], NECESSITY, "必需性", ln)
        if r["作用域"] not in SCOPE:
            raise SystemExit(f"{rel(CATALOG)}:{ln}: 无法识别的作用域「{r['作用域']}」")
        if r["运行位置"] not in LOCATION:
            raise SystemExit(f"{rel(CATALOG)}:{ln}: 无法识别的运行位置「{r['运行位置']}」")
        ms = r["首装"]
        if ms not in MILESTONES:
            raise SystemExit(f"{rel(CATALOG)}:{ln}: 无法识别的首装里程碑「{ms}」")
        all_ms[ms] += 1
        if is_plugin:
            nec_c[nec] += 1
            scope_c[SCOPE[r["作用域"]]] += 1
            loc_c[LOCATION[r["运行位置"]]] += 1
            ms_c[ms] += 1
        elif form == "library":
            lib_ms[ms] += 1
        else:
            nest_ms[ms] += 1
        seen = set()
        # 只数 cordis 插件：纯库（如 design）虽标了 viewer●，但不是被装配的插件条目
        tokens = PRESET_TOKEN.findall(r["所属 preset"]) if is_plugin else []
        for name, mark in tokens:
            if name in seen:
                continue
            seen.add(name)
            if mark in "●▲":
                presets[name]["resident"] += 1
            elif mark == "◐":
                presets[name]["lazy"] += 1
        pkg = package_of(r["承载包"])
        entry = by_pkg.setdefault(pkg, {"units": 0, "plugins": 0, "rows": []})
        entry["units"] += 1
        entry["plugins"] += 1 if is_plugin else 0
        entry["rows"].append(int(r["#"]))
    plugin_total = sum(form_c[f] for f in CORDIS_FORMS)
    plugins = OrderedDict([
        ("total", plugin_total),
        ("byForm", OrderedDict((f, form_c[f]) for f in CORDIS_FORMS)),
        ("byNecessity", OrderedDict((n, nec_c[n]) for n in NECESSITY.values())),
        ("byLocation", OrderedDict((k, loc_c[k]) for k in ("both", "browser", "server"))),
        ("byScope", OrderedDict((k, scope_c[k]) for k in ("content", "ui", "na"))),
        ("byMilestone", OrderedDict((m, ms_c[m]) for m in MILESTONES)),
        ("cumulativeByMilestone", cumulative(ms_c)),
    ])
    runtime = OrderedDict([
        ("$comment", "运行时单元 = cordis 插件 + 纯库 + Nest 模块；后两者不是插件，不计入任何插件数"),
        ("total", len(rows)),
        ("plugins", plugin_total),
        ("library", form_c["library"]),
        ("nest", form_c["nest"]),
        ("byMilestone", OrderedDict((m, all_ms[m]) for m in MILESTONES)),
        ("cumulativeByMilestone", cumulative(all_ms)),
        ("libraryByMilestone", OrderedDict((m, lib_ms[m]) for m in MILESTONES)),
        ("nestByMilestone", OrderedDict((m, nest_ms[m]) for m in MILESTONES)),
    ])
    browser_presets = OrderedDict()
    for key, name in (("viewer", "preset-slide-viewer"), ("slide", "preset-slide"), ("collab", "preset-slide-collab")):
        c = presets[key]
        browser_presets[name] = OrderedDict([("resident", c["resident"]), ("lazy", c["lazy"]),
                                             ("total", c["resident"] + c["lazy"])])
    server_units = OrderedDict([("resident", presets["server"]["resident"]), ("partial", presets["server"]["lazy"]),
                                ("total", presets["server"]["resident"] + presets["server"]["lazy"])])
    pkgs = OrderedDict((k, OrderedDict([("units", v["units"]), ("plugins", v["plugins"]), ("rows", v["rows"])]))
                       for k, v in by_pkg.items())
    return plugins, runtime, browser_presets, server_units, pkgs, mark_problems


def compute_server_entries(lines):
    _, rows, _ = find_table(lines, "| 条目 | 装载状态 | 激活角色", CATALOG)
    res = OrderedDict([("resident", 0), ("partial", 0), ("unstated", 0)])
    roles = OrderedDict((r, Counter()) for r in ("api", "collab", "worker", "all", "renderer"))
    for r in rows:
        st = r["装载状态"]
        kind = "resident" if st.startswith("●") else "partial" if st.startswith("◐") else "unstated"
        res[kind] += 1
        if kind == "unstated":
            continue
        active = r["激活角色"]
        for role in roles:
            if role == "renderer":
                continue
            if role == "all" or active == "api/collab/worker" or active == role:
                roles[role][kind] += 1
    out = OrderedDict([("resident", res["resident"]), ("partial", res["partial"]),
                       ("total", res["resident"] + res["partial"]), ("unstated", res["unstated"])])
    by_role = OrderedDict()
    for role, c in roles.items():
        by_role[role] = OrderedDict([("resident", c["resident"]), ("partial", c["partial"]),
                                     ("total", c["resident"] + c["partial"])])
    return out, by_role


def count_table_rows(lines, header_prefix):
    return len(find_table(lines, header_prefix, CATALOG)[1])


# ---------- charter §5.2 包清单 ----------
BANDS = OrderedDict([("L0", "L0"), ("L1", "L1"), ("L3", "L3"), ("L4", "L4"), ("L5", "L5"), ("L7", "L7"),
                     ("L8", "L8"), ("V-", "vertical"), ("LS", "LS")])


def compute_packages(charter_lines):
    _, rows, _ = find_table(charter_lines, "| 包 | 层/层带 |", CHARTER)
    npm, m5, apps, tooling = [], [], [], []
    band_c, iso_c = Counter(), Counter()
    for r in rows:
        name = r["包"].strip("`")
        if name.startswith("@cordexjs/"):
            if re.search(r"\bM5\b", r["职责边界"]):
                m5.append(name)
                continue
            npm.append(name)
            band = r["层/层带"]
            band_c[next(code for key, code in BANDS.items() if band.startswith(key))] += 1
            iso_c[r["同构"]] += 1
        elif name.startswith("apps/"):
            apps.append(name)
        elif name.startswith("tooling"):
            tooling.append(name)
    return npm, m5, apps, tooling, band_c, iso_c


def compute(emit_packages_units=None):
    cat = read_lines(CATALOG)
    plugins, runtime, browser_presets, server_units, by_pkg, mark_problems = compute_units(cat)
    server_entries, server_roles = compute_server_entries(cat)
    definitions = count_table_rows(cat, "| Definition | 定义方")
    points = count_table_rows(cat, "| 贡献点 id | 定义方")
    npm, m5, apps, tooling, band_c, iso_c = compute_packages(read_lines(CHARTER))
    non_plugin = [p for p, v in by_pkg.items() if p.startswith("@cordexjs/") and v["plugins"] == 0]
    presets = OrderedDict(browser_presets)
    presets["preset-server"] = OrderedDict([("entries", server_entries), ("units", server_units),
                                            ("entriesByRole", server_roles)])
    data = OrderedDict([
        ("$comment", "由 docs/_tools/check-plugin-counts.py --emit 从 40-modules/16-plugin-catalog.md §2–§5.1 与 "
                     "00-charter/charter.md §5.2 机械重算生成，勿手改；改表后重新 --emit。插件只计 cordis 插件"
                     "（plugins，rulings §4.23 补充裁决）；纯库与 Nest 模块只在 runtimeUnits 里分列。"),
        ("source", OrderedDict([("catalog", "docs/40-modules/16-plugin-catalog.md"),
                                ("packages", "docs/00-charter/charter.md §5.2")])),
        ("packages", OrderedDict([
            ("npm", len(npm)),
            ("npmWithM5", len(npm) + len(m5)),
            ("m5InCharter", m5),
            ("m5SkeletonUnits", 10),
            ("byBand", OrderedDict((code, band_c[code]) for code in BANDS.values())),
            ("byIso", OrderedDict((k, iso_c[k]) for k in ("iso", "dom", "node"))),
            ("apps", apps),
            ("tooling", tooling),
            ("nonPluginNpm", non_plugin),
        ])),
        ("plugins", plugins),
        ("runtimeUnits", runtime),
        ("definitions", definitions),
        ("contributionPoints", points),
        ("presets", presets),
        ("presetCount", 4),
        ("unitsByPackage", by_pkg),
    ])
    return data, set(npm), mark_problems


# ---------- 计数句扫描 ----------
HIST_BEFORE = re.compile(r"(由|原|旧|此前|曾|从)[^。；]{0,12}$")
HIST_AFTER = re.compile(r"^[^。；]{0,10}(减为|增为|调整|→|改为)")
PRESET_WORDS = OrderedDict([("preset-slide-viewer", "preset-slide-viewer"), ("viewer", "preset-slide-viewer"),
                            ("preset-slide-collab", "preset-slide-collab"), ("collab", "preset-slide-collab"),
                            ("preset-server", "preset-server"), ("server", "preset-server"),
                            ("preset-slide", "preset-slide"), ("slide", "preset-slide")])
NUM = r"\**(\d+)\**\s*"


BARE_PLUGIN_SKIP = ("20-design/", "00-charter/reference-")
APPROX_BEFORE = re.compile(r"(约|~|～|近)\s*\**$")


def sentence_rules(data):
    pl, ru = data["plugins"], data["runtimeUnits"]
    return [
        ("运行时单元", re.compile(NUM + r"个\s*\**\s*运行时(?:插件)?单元"), {ru["total"]}),
        ("cordis 插件", re.compile(NUM + r"个\s*\**\s*cordis\s*(?:可插拔(?:插件)?(?:单元)?|插件(?:单元)?|单元)"),
         {pl["total"]}),
        ("插件", re.compile(NUM + r"个\s*\**\s*插件(?!化|式|名|管理|面板|清单|声明|条目|形态|入口)"), {pl["total"]}),
        ("纯库", re.compile(NUM + r"个\s*\**\s*纯库"), {ru["library"]}),
        ("npm 包", re.compile(NUM + r"个\s*\**\s*npm\s*包"), {data["packages"]["npm"], data["packages"]["npmWithM5"]}),
        ("Nest 模块（总数）", re.compile(r"共\s*" + NUM + r"个\s*\**\s*Nest\s*模块"), {ru["nest"]}),
    ]


def preset_numbers(data, prefix):
    allowed = set()
    low = prefix.lower()
    for word, name in PRESET_WORDS.items():
        if word in low:
            pr = data["presets"][name]
            if name == "preset-server":
                for sub in ("entries", "units"):
                    allowed |= {pr[sub]["resident"], pr[sub]["partial"], pr[sub]["total"]}
            else:
                allowed |= {pr["resident"], pr["lazy"], pr["total"]}
    return allowed


def iter_md_files():
    for root, dirs, files in os.walk(DOCS):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not d.startswith("."))
        for f in sorted(files):
            if f.endswith(".md"):
                yield os.path.join(root, f)


def scan_sentences(data, files):
    rules = sentence_rules(data)
    problems = []
    for path in files:
        r = rel(path)
        if r.startswith(SKIP_PREFIXES):
            continue
        for no, line in enumerate(read_lines(path), 1):
            if line.lstrip().startswith("> 状态") or "~~" in line:
                continue
            for label, rx, allowed in rules:
                for m in rx.finditer(line):
                    n = int(m.group(1))
                    before, after = line[:m.start()], line[m.end():]
                    if HIST_BEFORE.search(before) or HIST_AFTER.search(after):
                        continue
                    if label == "插件" and (r.startswith(BARE_PLUGIN_SKIP) or APPROX_BEFORE.search(before)):
                        continue
                    ok = set(allowed)
                    if label in ("cordis 插件", "插件"):
                        ok |= preset_numbers(data, before[-60:])
                    if n not in ok:
                        want = "/".join(str(x) for x in sorted(allowed))
                        problems.append(f"{r}:{no}: 「{m.group(0).strip()}」计数 {n} ≠ {want}（{label}，plugin-counts.json）")
    return problems


def diff(path, a, b, out):
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k == "$comment":
                continue
            diff(f"{path}.{k}" if path else k, a.get(k), b.get(k), out)
    elif a != b:
        out.append(f"plugin-counts.json: {path}: 文件值 {json.dumps(a, ensure_ascii=False)} → 重算值 {json.dumps(b, ensure_ascii=False)}")


def main(argv):
    summary = "--summary" in argv
    data, charter_npm, mark_problems = compute()
    if "--emit" in argv:
        sys.stdout.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
        return 0
    problems = list(mark_problems)
    if not os.path.exists(JSON_PATH):
        problems.append("plugin-counts.json 不存在：先运行 --emit > docs/_tools/plugin-counts.json")
    else:
        with open(JSON_PATH, encoding="utf-8") as fh:
            stored = json.load(fh)
        diff("", stored, json.loads(json.dumps(data)), problems)
    catalog_pkgs = {p for p in data["unitsByPackage"] if p.startswith("@cordexjs/")}
    for p in sorted(charter_npm - catalog_pkgs):
        problems.append(f"charter §5.2 有包 {p}，40/16 §2「承载包」列没有对应单元")
    for p in sorted(catalog_pkgs - charter_npm):
        problems.append(f"40/16 §2「承载包」列有包 {p}，charter §5.2（M1–M4）没有登记")
    problems += scan_sentences(data, list(iter_md_files()))
    if problems and not summary:
        print("\n".join(problems))
    pl, ru = data["plugins"], data["runtimeUnits"]
    forms = "、".join(f"{k} {v}" for k, v in pl["byForm"].items())
    print(f"check-plugin-counts: npm 包 {data['packages']['npm']}（含 M5 {data['packages']['npmWithM5']}），"
          f"cordis 插件 {pl['total']}（{forms}）；另有纯库 {ru['library']}、Nest 模块 {ru['nest']}，不计入插件"
          f"（运行时单元 {ru['total']}）；失配 {len(problems)}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
