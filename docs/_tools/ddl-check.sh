#!/usr/bin/env bash
# ddl-check：把 docs/60-backend 的 SQL 围栏按迁移编号在 PostgreSQL 18 容器里执行并核对（需求见 60-backend/08 §11）。
#
# 用法：bash docs/_tools/ddl-check.sh [--out <目录>] [--keep]
#   --out <目录>  提取出的迁移脚本、示例清单与 schema 导出放这里（默认 mktemp 目录）；每个迁移一个文件 NNNN-<name>.sql
#   --keep        新起的临时容器结束后不删除（排查用）
# 环境变量：
#   CORDEX_DDL_CONTAINER  复用一个已在运行的 postgres:18 容器（不起新容器），如本地的 cordex-ddl-pg
#   CORDEX_DDL_IMAGE      新起容器时用的镜像，默认 postgres:18（应与 compose 同 digest，60-backend/17 §1）
#   CORDEX_DDL_DB         库名，默认 cordex；每次先 DROP DATABASE IF EXISTS … WITH (FORCE) 再新建
# 步骤：① 扫描围栏（首行只能是 `-- migrate: NNNN_<name>` 或 `-- example`；编号唯一、在所属文件号段内）
#       ② 空库执行：0001 以超级用户执行，其余 SET ROLE cordex_migrator 后执行，每个迁移一个事务（ON_ERROR_STOP=1），
#          成功后写迁移台账；全部完成后再执行一次 0001 验证可重复执行
#       ③ 结构核对（08 §11 第 4 条）：表集合、禁建表、带 doc_id 的表 RLS、policy 命名与 current_setting、
#          SECURITY DEFINER 集合、外键前导索引、无 DEFAULT 分区、无触发器
#       ④ `-- example` 围栏：每段一个回滚事务；带 $N 参数的 DML 用 PREPARE 做解析与语义分析，
#          其余语句真实执行（DROP 与不能进事务块的语句只做语法解析），因此示例里的断言脚本也会真正跑一遍
#       ⑤ 导出 pg_dump --schema-only 到 <out>/schema.sql
# 退出码：0 全部通过；1 围栏、执行、核对或示例失败；2 用法或环境错误。只读仓库，不改任何文档。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT=""
KEEP=0
while [ $# -gt 0 ]; do
  case "$1" in
    --out) OUT="${2:?--out 需要目录}"; shift 2 ;;
    --keep) KEEP=1; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "未知参数：$1" >&2; exit 2 ;;
  esac
done
[ -n "$OUT" ] || { T="${TMPDIR:-/tmp}"; OUT="$(mktemp -d "${T%/}/cordex-ddl.XXXXXX")"; }
mkdir -p "$OUT"
rm -f "$OUT"/[0-9][0-9][0-9][0-9]-*.sql "$OUT"/_*.sql "$OUT"/manifest.tsv
DB="${CORDEX_DDL_DB:-cordex}"

# ---------- ① 提取围栏（python 只用标准库） ----------
python3 - "$ROOT" "$OUT" <<'PY'
import glob, hashlib, os, re, sys
root, out = sys.argv[1], sys.argv[2]
RANGES = {  # 08 §9 号段表；0100 起任何文件可用
    "08": [(1, 9), (95, 99)], "09": [(10, 19), (30, 39), (90, 90)], "10": [(20, 29), (50, 59), (91, 91)],
    "11": [(40, 49), (92, 92)], "12": [(60, 69), (93, 93)], "13": [(70, 79), (94, 94)],
}
MIG = re.compile(r"^-- migrate: (\d{4})_([a-z0-9_]+)\s*$")
errors, migs, examples = [], {}, []
for path in sorted(glob.glob(os.path.join(root, "docs/60-backend/[0-9][0-9]-*.md"))):
    rel = os.path.relpath(path, root)
    lines = open(path, encoding="utf-8").read().split("\n")
    i = 0
    while i < len(lines):
        if lines[i].strip() != "```sql":
            i += 1
            continue
        j = i + 1
        while j < len(lines) and lines[j].strip() != "```":
            j += 1
        body, loc = lines[i + 1:j], f"{rel}:{i + 1}"
        head = body[0] if body else ""
        m = MIG.match(head)
        if m:
            num, name = int(m.group(1)), m.group(2)
            ranges = RANGES.get(os.path.basename(path)[:2], [])
            if num < 100 and not any(a <= num <= b for a, b in ranges):
                errors.append(f"{loc}：迁移 {m.group(1)} 不在本文件号段内（08 §9）")
            if num in migs:
                errors.append(f"{loc}：迁移编号 {m.group(1)} 重复（另见 {migs[num][2]}）")
            migs[num] = (name, "\n".join(body) + "\n", loc, i + 1)
        elif head.strip() == "-- example":
            examples.append((loc, i + 1, "\n".join(body) + "\n"))
        else:
            errors.append(f"{loc}：未标记的 SQL 围栏（首行须为 -- migrate: NNNN_<name> 或 -- example）")
        i = j + 1
if errors:
    print("\n".join(errors), file=sys.stderr)
    sys.exit(1)
with open(os.path.join(out, "manifest.tsv"), "w", encoding="utf-8") as mf:
    for num in sorted(migs):
        name, sql, loc, start = migs[num]
        fn = f"{num:04d}-{name}.sql"
        open(os.path.join(out, fn), "w", encoding="utf-8").write(sql)
        sha = hashlib.sha256(sql.encode()).hexdigest()
        opts = "no-transaction" if "-- migrate-opts: no-transaction" in sql.split("\n")[1:2] else "tx"
        mf.write(f"{num}\t{name}\t{fn}\t{loc.split(':')[0]}\t{start}\t{sha}\t{opts}\n")
print(f"围栏：{len(migs)} 个 migrate、{len(examples)} 个 example", file=sys.stderr)
PY

# ---------- 容器 ----------
CONTAINER="${CORDEX_DDL_CONTAINER:-}"
STARTED=""
cleanup() { local rc=$?; if [ -n "$STARTED" ] && [ "$KEEP" = 0 ]; then docker rm -f "$STARTED" >/dev/null 2>&1 || true; fi; exit "$rc"; }
trap cleanup EXIT
if [ -z "$CONTAINER" ]; then
  CONTAINER="cordex-ddl-check-$$"
  docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=ddl-check "${CORDEX_DDL_IMAGE:-postgres:18}" >/dev/null || exit 2
  STARTED="$CONTAINER"
  for _ in $(seq 1 60); do
    docker exec "$CONTAINER" pg_isready -U postgres -q 2>/dev/null && \
      docker exec "$CONTAINER" psql -U postgres -Xqtc 'select 1' >/dev/null 2>&1 && break
    sleep 1
  done
fi
psql_admin() { docker exec -i "$CONTAINER" psql -U postgres -X -q -v ON_ERROR_STOP=1 "$@"; }
echo "PostgreSQL：$(psql_admin -d postgres -tAc 'show server_version')（容器 ${CONTAINER}，库 ${DB}，输出 ${OUT}）" >&2
psql_admin -d postgres -c "SET client_min_messages = warning" -c "DROP DATABASE IF EXISTS \"$DB\" WITH (FORCE)" -c "CREATE DATABASE \"$DB\""

# ---------- ② 按编号执行迁移 ----------
# 出错时把 psql 报告的输入行号换算回「文档:行号」（围栏首行在文档中的行号 + 偏移）
report_error() { # $1 日志 $2 文档 $3 围栏起始行 $4 前置行数 $5 编号
  local n
  n="$(sed -n 's/^psql:<stdin>:\([0-9]*\): ERROR.*/\1/p' "$1" | head -1)"
  if [ -n "$n" ]; then
    echo "FAIL $2:$(( $3 + n - $4 ))  迁移 $5" >&2
  else
    echo "FAIL $2:$3  迁移 $5" >&2
  fi
  sed 's/^/    /' "$1" >&2
}
run_migration() { # $1 编号 $2 名称 $3 文件 $4 文档 $5 行号 $6 sha $7 opts
  local log="$OUT/_last.log" pre=0 tx=(-1)
  [ "$7" = "no-transaction" ] && tx=()
  {
    if [ "$1" != 1 ]; then echo "SET ROLE cordex_migrator;"; fi
    cat "$OUT/$3"
  } > "$OUT/_run.sql"
  [ "$1" != 1 ] && pre=1
  # 台账写入与迁移同一事务（no-transaction 迁移另起一条语句）
  printf "INSERT INTO cordex_schema_migrations (id, name, checksum, app_version) VALUES (%d, '%s', decode('%s', 'hex'), 'ddl-check') ON CONFLICT (id) DO NOTHING;\n" \
    "$1" "$2" "$6" >> "$OUT/_run.sql"
  if ! psql_admin -d "$DB" ${tx[@]+"${tx[@]}"} -f - < "$OUT/_run.sql" > "$log" 2>&1; then
    report_error "$log" "$4" "$5" "$pre" "$(printf %04d "$1")_$2"
    return 1
  fi
}
count=0
while IFS=$'\t' read -r num name file doc start sha opts; do
  run_migration "$num" "$name" "$file" "$doc" "$start" "$sha" "$opts" || exit 1
  count=$((count + 1))
done < "$OUT/manifest.tsv"
first="$(head -1 "$OUT/manifest.tsv")"
IFS=$'\t' read -r num name file doc start sha opts <<< "$first"
[ "$num" = 1 ] || { echo "FAIL 缺少 0001" >&2; exit 1; }
run_migration "$num" "$name" "$file" "$doc" "$start" "$sha" "$opts" || { echo "FAIL 0001 不可重复执行" >&2; exit 1; }
echo "迁移：$count 个按编号执行通过；0001 重复执行通过" >&2

# ---------- ③ 结构核对（期望集合取自 08 原文：§1 表清单与「外键索引」行、§4.3 SECURITY DEFINER 清单、§6.4 例外 JSON） ----------
python3 - "$ROOT" "$OUT" <<'PY'
import json, os, re, sys
root, out = sys.argv[1], sys.argv[2]
doc = open(os.path.join(root, "docs/60-backend/08-db-conventions-roles-rls-migrations.md"), encoding="utf-8").read()
lines = doc.split("\n")
tick = lambda s: re.findall(r"`([a-z_][a-z0-9_]*)`", s)
arr = lambda xs: "ARRAY[" + ", ".join("'%s'" % x for x in xs) + "]::text[]"
inv = next(l for l in lines if l.startswith("**表清单"))
tables, forbidden = tick(inv.split("不建")[0]), tick(inv.split("不建：")[1].split("；")[0])
exceptions = [e["table"] for e in json.loads(re.search(r"```json\n(\{.*?\})\n```", doc, re.S).group(1))["exceptions"]]
secdef = sorted({t for t in tick(next(l for l in lines if "SECURITY DEFINER 只有" in l))
                 if t not in ("cordex_app", "cordex_system", "cordex_migrator")})
fk_targets = tick(next(l for l in lines if l.startswith("| 外键索引")).split("指向 ", 1)[1].split(" 的外键", 1)[0])
sql = f"""
DO $check$
DECLARE
  want_tables CONSTANT text[] := {arr(tables)};
  forbidden   CONSTANT text[] := {arr(forbidden)};
  exceptions  CONSTANT text[] := {arr(exceptions)};
  want_secdef CONSTANT text[] := {arr(secdef)};
  fk_targets  CONSTANT text[] := {arr(fk_targets)};
  have text[]; problems text[] := ARRAY[]::text[]; r record;
BEGIN
  SELECT array_agg(c.relname ORDER BY c.relname) INTO have FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') AND NOT c.relispartition;
  IF NOT (have @> want_tables AND have <@ want_tables) THEN
    problems := problems || format('表集合与 08 §1 不一致：多出 %s；缺少 %s',
      coalesce((SELECT array_agg(x) FROM unnest(have) x WHERE x <> ALL (want_tables))::text, '无'),
      coalesce((SELECT array_agg(x) FROM unnest(want_tables) x WHERE x <> ALL (have))::text, '无'));
  END IF;
  IF have && forbidden THEN
    problems := problems || format('出现禁建表：%s', (SELECT array_agg(x) FROM unnest(have) x WHERE x = ANY (forbidden)));
  END IF;
  -- 带 doc_id 列的表（例外清单除外）必须 ENABLE + FORCE RLS，且对 cordex_app 与 cordex_system 各有 policy
  FOR r IN SELECT c.oid, c.relname, c.relrowsecurity AND c.relforcerowsecurity AS rls FROM pg_class c
            WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') AND NOT c.relispartition
              AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'doc_id' AND NOT a.attisdropped)
              AND c.relname <> ALL (exceptions) LOOP
    IF NOT r.rls THEN problems := problems || format('%s：带 doc_id 却未 ENABLE + FORCE RLS', r.relname); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = r.oid AND 'cordex_app'::regrole = ANY (p.polroles))
       OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = r.oid AND 'cordex_system'::regrole = ANY (p.polroles)) THEN
      problems := problems || format('%s：缺 cordex_app 或 cordex_system 的 policy', r.relname);
    END IF;
  END LOOP;
  -- policy：不直接读 current_setting；命名 p_{{表}}_{{app|system}}_{{操作|all}}，且名字与实际操作、角色一致
  FOR r IN SELECT p.polname, c.relname,
                  coalesce(pg_get_expr(p.polqual, p.polrelid), '') || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') AS expr,
                  CASE p.polcmd WHEN 'r' THEN 'select' WHEN 'a' THEN 'insert' WHEN 'w' THEN 'update' WHEN 'd' THEN 'delete' ELSE 'all' END AS cmd,
                  CASE WHEN p.polroles = ARRAY['cordex_app'::regrole::oid] THEN 'app'
                       WHEN p.polroles = ARRAY['cordex_system'::regrole::oid] THEN 'system' ELSE '?' END AS who
             FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid LOOP
    IF r.expr ILIKE '%current_setting%' THEN problems := problems || format('%s：policy 直接引用 current_setting', r.polname); END IF;
    IF r.polname <> format('p_%s_%s_%s', r.relname, r.who, r.cmd) THEN
      problems := problems || format('%s：命名应为 p_%s_%s_%s', r.polname, r.relname, r.who, r.cmd);
    END IF;
  END LOOP;
  SELECT array_agg(p.proname::text ORDER BY p.proname) INTO have FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef;
  IF have IS DISTINCT FROM want_secdef THEN
    problems := problems || format('SECURITY DEFINER 集合 %s 与 08 §4.3 的 %s 不一致', have, want_secdef);
  END IF;
  -- 指向会被硬删除表的外键：外键列须为某索引的前导列（08 §1「外键索引」）
  FOR r IN SELECT c.conname, c.conrelid, c.conkey FROM pg_constraint c
            WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
              AND c.confrelid::regclass::text = ANY (fk_targets)
              AND NOT (SELECT relispartition FROM pg_class WHERE oid = c.conrelid) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = r.conrelid
                     AND ((i.indkey::int2[])[0] = r.conkey[1]
                          OR (i.indkey::int2[])[0:cardinality(r.conkey) - 1] @> r.conkey)) THEN
      problems := problems || format('%s：外键列没有前导索引', r.conname);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_partitioned_table WHERE partdefid <> 0) THEN problems := problems || 'DEFAULT 分区存在'::text; END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
              WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal) THEN
    problems := problems || '业务表存在触发器'::text;
  END IF;
  IF cardinality(problems) > 0 THEN
    RAISE EXCEPTION E'结构核对失败（% 项）：\\n  %', cardinality(problems), array_to_string(problems, E'\\n  ');
  END IF;
END $check$;
SELECT format('结构：表 %s（另有分区 %s）、索引 %s（含分区上的 %s）、外键 %s、policy %s、启用 RLS 的表 %s、SECURITY DEFINER 函数 %s',
  count(*) FILTER (WHERE c.relkind IN ('r', 'p') AND NOT c.relispartition),
  count(*) FILTER (WHERE c.relkind IN ('r', 'p') AND c.relispartition),
  count(*) FILTER (WHERE c.relkind IN ('i', 'I')), count(*) FILTER (WHERE c.relkind = 'i' AND c.relispartition),
  (SELECT count(*) FROM pg_constraint k WHERE k.contype = 'f' AND k.connamespace = 'public'::regnamespace
      AND NOT (SELECT relispartition FROM pg_class WHERE oid = k.conrelid)),
  (SELECT count(*) FROM pg_policy),
  count(*) FILTER (WHERE c.relrowsecurity),
  (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef))
  FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace;
"""
open(os.path.join(out, "_checks.sql"), "w", encoding="utf-8").write(sql)
print(f"期望：表 {len(tables)}（含台账）；禁建 {len(forbidden)}；RLS 例外 {len(exceptions)}；"
      f"SECURITY DEFINER {len(secdef)}；外键索引对象 {len(fk_targets)} 张表", file=sys.stderr)
PY
psql_admin -d "$DB" -tA -f - < "$OUT/_checks.sql" > "$OUT/_checks.log" 2>&1 || { echo "FAIL 结构核对" >&2; sed 's/^/    /' "$OUT/_checks.log" >&2; exit 1; }
cat "$OUT/_checks.log" >&2

# ---------- ④ example 围栏：逐句分类后在回滚事务里执行 ----------
python3 - "$ROOT" "$OUT" <<'PY'
import glob, os, re, sys
root, out = sys.argv[1], sys.argv[2]
DML = {"SELECT", "INSERT", "UPDATE", "DELETE", "WITH", "VALUES", "TABLE", "MERGE"}
TXN = {"BEGIN", "COMMIT", "ROLLBACK", "START", "END", "SAVEPOINT", "RELEASE", "ABORT"}

def split(sql):
    """按顶层分号切句，跳过注释、字符串、带引号标识符与 $tag$ 块；返回 (起始行偏移, 文本, 用到的 $N 编号集合)。"""
    stmts, i, n, start, line, params, cur_line = [], 0, len(sql), None, 0, set(), None
    while i < n:
        c = sql[i]
        if c == "\n":
            line += 1; i += 1; continue
        if sql.startswith("--", i):
            i = sql.find("\n", i) if sql.find("\n", i) >= 0 else n; continue
        if sql.startswith("/*", i):
            j = sql.find("*/", i + 2); line += sql.count("\n", i, j); i = j + 2; continue
        if start is None and not c.isspace() and c != ";":
            start, cur_line, params = i, line, set()
        if c in "'\"":
            j = i + 1
            while j < n and not (sql[j] == c and (j + 1 >= n or sql[j + 1] != c)):
                j += 2 if sql[j] == c else 1
            line += sql.count("\n", i, j); i = j + 1; continue
        if c == "$":
            m = re.match(r"\$(\d+)", sql[i:])
            if m:
                params.add(int(m.group(1))); i += len(m.group(0)); continue
            m = re.match(r"\$([A-Za-z_][A-Za-z0-9_]*)?\$", sql[i:])
            if m:
                j = sql.find(m.group(0), i + len(m.group(0)))
                line += sql.count("\n", i, j); i = j + len(m.group(0)); continue
        if c == ";" and start is not None:
            stmts.append((cur_line, sql[start:i].strip(), params)); start = None
        i += 1
    if start is not None and sql[start:].strip():
        stmts.append((cur_line, sql[start:].strip(), params))
    return stmts

script, k = [], 0
for path in sorted(glob.glob(os.path.join(root, "docs/60-backend/[0-9][0-9]-*.md"))):
    rel, lines = os.path.relpath(path, root), open(path, encoding="utf-8").read().split("\n")
    i = 0
    while i < len(lines):
        if lines[i].strip() == "```sql" and i + 1 < len(lines) and lines[i + 1].strip() == "-- example":
            j = i + 1
            while lines[j].strip() != "```":
                j += 1
            script.append("BEGIN;")
            for off, stmt, params in split("\n".join(lines[i + 1:j])):
                k += 1
                kw = re.match(r"[A-Za-z]+", stmt).group(0).upper()
                script.append(f"\\warn '@@ {rel}:{i + 2 + off}'")
                if kw in TXN:
                    script.pop(); continue
                if params and kw in DML:
                    # 示例常沿用同一事务里其它语句的编号（如只用 $2、$3）：未出现的编号声明为 text，出现的留给推断
                    types = ", ".join("unknown" if p in params else "text" for p in range(1, max(params) + 1))
                    script.append(f"PREPARE ddlchk_{k} ({types}) AS {stmt}\n;")
                elif (params and kw != "PREPARE") or kw in ("DROP", "VACUUM", "REINDEX") or re.search(r"\bCONCURRENTLY\b", stmt, re.I):
                    script.append(f"CREATE FUNCTION pg_temp.ddlchk_{k}() RETURNS void LANGUAGE sql AS $ddlchk$ {stmt}\n$ddlchk$;")
                else:
                    script.append(stmt + "\n;")  # 换行后再补分号：语句末行可能是注释
            script.append("\\warn '@@ -'\nROLLBACK;\nDEALLOCATE ALL;")
            i = j
        i += 1
open(os.path.join(out, "_examples.sql"), "w", encoding="utf-8").write("\\set ON_ERROR_ROLLBACK on\n" + "\n".join(script) + "\n")
print(f"示例：{k} 条语句", file=sys.stderr)
PY
# 不设 ON_ERROR_STOP（ON_ERROR_ROLLBACK 让出错语句回滚到自动保存点后继续），SQL 错误靠日志判定；psql 本身非 0 退出（连不上等）直接失败
if ! docker exec -i "$CONTAINER" psql -U postgres -X -q -d "$DB" -f - < "$OUT/_examples.sql" 2> "$OUT/_examples.log" >/dev/null; then
  echo "FAIL 示例脚本未能执行" >&2; sed 's/^/    /' "$OUT/_examples.log" >&2; exit 1
fi
if ! awk '/^@@ /{loc=substr($0,4); next} /ERROR:/{print "FAIL " loc "  " $0; bad=1} END{exit bad}' "$OUT/_examples.log" >&2; then
  echo "    完整输出：$OUT/_examples.log" >&2; exit 1
fi
echo "示例：全部通过（DML 以 PREPARE 分析，其余语句在回滚事务中执行）" >&2

# ---------- ⑤ 导出 ----------
docker exec "$CONTAINER" pg_dump -U postgres --schema-only -d "$DB" > "$OUT/schema.sql"
echo "通过；schema 导出：$OUT/schema.sql" >&2
