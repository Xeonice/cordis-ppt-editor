// 用法：node docs/_tools/mermaid-check.cjs [--lint-only] <md 文件...>
// 逐张检查 Markdown 里的 ```mermaid 围栏，任一项不过即计为 invalid，退出码 1（规范见 docs/_tools/README.md「绘图规范」）：
//   PARSE  语法：无头 Chrome 里跑 mermaid 11.16.1（与文档站同版本、securityLevel strict）的 mermaid.parse（--lint-only 跳过，不需要浏览器）
//   QUOTE  引号口径：flowchart 节点/子图/连线文字须加双引号；sequenceDiagram 参与方别名、消息、Note 与分支标签，
//          stateDiagram 转移标签与状态描述，classDiagram 成员不得带双引号（会原样显示）
//   LT     标签内「< 后接字母」会被 HTML 净化当成标签吞掉，须写成 #60;（<br> 与 <<choice>> 这类注解除外）
//   SIZE   单图 ≤40 个非空行、≤25 个节点；既有超限图登记在下方豁免表（rulings §4.18 GV-04/GV-05/GV-23）
const fs = require("fs"); const path = require("path"); const { execSync } = require("child_process");
const MAX_LINES = 40, MAX_NODES = 25;
// 豁免表：file 相对 docs/；line 为登记时的围栏起始行；anchor 为图体第二行，行号因上方增删而漂移时按 anchor 认图
const EXEMPT = [
  { file: "40-modules/00-module-map.md", line: 10, anchor: 'subgraph isoband["共享 iso"]', why: "水平层网格图，43 行 29 节点" },
  { file: "40-modules/15-server-architecture-review.md", line: 178, anchor: 'subgraph apiRole["api 角色进程"]', why: "历史评审稿现状模块图，59 行 29 节点" },
  { file: "40-modules/15-server-architecture-review.md", line: 246, anchor: 'subgraph apiRole2["api 角色进程"]', why: "历史评审稿目标模块图，67 行 32 节点" },
];
const OPEN = /(^|[^\w])([A-Za-z_]\w*)(\[\[|\[\(|\(\[|\(\(|\{\{|\[\/|\[\\|\[|\(|\{|>)/g;
const ARROW = /\s*(?:&|<?(?:-{2,}[->xo]?|={2,}[=>xo]?|-\.+-?>?|~{3,}))\s*/;
const SKIP = /^(style|classDef|class|linkStyle|click|direction|end)\b/;
const stripQ = (s) => s.replace(/"[^"]*"/g, '""');
const isId = (t) => /^[A-Za-z_]\w*$/.test(t) && !/^(end|subgraph|direction|state|note|as)$/.test(t);

function lint(src) {
  const out = []; const err = (n, code, msg) => out.push({ n, code, msg });
  const lines = src.split("\n"); const kind = (lines[0] || "").trim().split(/\s+/)[0];
  const ids = new Set(), subs = new Set(); let body = 0, inClass = false;
  lines.forEach((raw, n) => {
    const t = raw.trim(); if (!t || t.startsWith("%%")) return; body++;
    if (n === 0) return;
    if (/<[A-Za-z]/.test(raw.replace(/<br\s*\/?>/gi, "").replace(/<<[A-Za-z]\w*>>/g, "")))
      err(n, "LT", "标签内「<」后接字母会被 HTML 净化吞字，改写为 #60;");
    const s = stripQ(t);
    if (kind === "flowchart" || kind === "graph") {
      if (SKIP.test(s)) return;
      if (/^subgraph\b/.test(s)) {
        const m = s.match(/^subgraph\s+(\w+)\s*(\[)?(.)?/); if (m) subs.add(m[1]);
        if (m && m[2] && m[3] !== '"') err(n, "QUOTE", "子图标题须加双引号");
        return;
      }
      for (const m of s.matchAll(OPEN)) { if (s[m.index + m[0].length] !== '"') err(n, "QUOTE", `节点 ${m[2]} 的文字须加双引号`); }
      for (const m of s.matchAll(/\|([^|]*)\|/g)) if (!/^\s*""\s*$/.test(m[1])) err(n, "QUOTE", "连线标签须加双引号");
      for (const m of s.matchAll(/(?<![-=.<])(?:--|==)\s+([^->=\s[({][^>[({]*?)\s+(?:-{2,}|={2,})[->xo]?/g)) if (m[1] !== '""') err(n, "QUOTE", "连线文字须加双引号");
      const bare = s.replace(/\|[^|]*\|/g, " ").replace(/(\[\[|\[\(|\(\[|\(\(|\{\{|\[\/|\[\\|\[|\(|\{|>)""(\]\]|\)\]|\]\)|\)\)|\}\}|\/\]|\\\]|\]|\)|\})/g, "");
      for (const tok of bare.split(ARROW)) { const id = tok.trim().replace(/:::\w+$/, ""); if (isId(id)) ids.add(id); }
      for (const m of s.matchAll(OPEN)) ids.add(m[2]);
    } else if (kind === "sequenceDiagram") {
      const p = t.match(/^(participant|actor)\s+(\w+)(?:\s+as\s+(.*))?$/);
      if (p) { ids.add(p[2]); if (p[3] && p[3].includes('"')) err(n, "QUOTE", "参与方别名不加引号"); return; }
      const msg = t.match(/^([\w]+)\s*(?:-{1,2}>{1,2}|-{1,2}[x)]|<<-{1,2}>>)[+-]?\s*(\w+)\s*:(.*)$/);
      if (msg) { ids.add(msg[1]); ids.add(msg[2]); if (msg[3].includes('"')) err(n, "QUOTE", "消息标签不加引号"); return; }
      if (/^(Note|note|alt|else|opt|loop|par|and|critical|option|break|box)\b/.test(t) && t.includes('"')) err(n, "QUOTE", "Note 与分支标签不加引号");
    } else if (kind.startsWith("stateDiagram")) {
      const d = t.match(/^state\s+"[^"]*"\s+as\s+(\w+)/) || t.match(/^state\s+(\w+)/); if (d) { ids.add(d[1]); return; }
      if (/^note\b/.test(t)) return;
      const [lhs, ...rest] = t.split(":"); const label = rest.join(":");
      if (label.includes('"')) err(n, "QUOTE", "转移标签与状态描述不加引号");
      for (const tok of lhs.split("-->")) { const id = tok.trim(); if (isId(id)) ids.add(id); }
    } else if (kind === "classDiagram") {
      if (/^note\b/.test(t)) return;
      const c = t.match(/^class\s+(\w+)/); if (c) ids.add(c[1]);
      if (inClass && t !== "}" && t.includes('"')) err(n, "QUOTE", "类成员不加引号");
      const mem = t.match(/^(\w+)\s*:(.*)$/); if (mem) { ids.add(mem[1]); if (mem[2].includes('"')) err(n, "QUOTE", "类成员不加引号"); }
      const rel = s.match(/^(\w+)\s*(?:""\s*)?(?:<\||\*|o|<)?(?:--|\.\.)(?:\|>|\*|o|>)?\s*(?:""\s*)?(\w+)/); if (rel) { ids.add(rel[1]); ids.add(rel[2]); }
      if (/\{\s*$/.test(t)) inClass = true; if (t === "}") inClass = false;
    } else if (kind === "erDiagram") {
      const r = s.match(/^([\w-]+)\s+\S*--\S*\s+([\w-]+)/); if (r) { ids.add(r[1]); ids.add(r[2]); }
      const e = s.match(/^([\w-]+)\s*\{\s*$/); if (e) ids.add(e[1]);
    }
  });
  for (const x of subs) ids.delete(x);
  return { out, body, nodes: ids.size };
}

const lintOnly = process.argv.includes("--lint-only");
const files = process.argv.slice(2).filter((a) => a !== "--lint-only"); const blocks = [];
for (const f of files) {
  const t = fs.readFileSync(f, "utf8"); const re = /```mermaid\n([\s\S]*?)```/g; let m, i = 0;
  const rel = path.resolve(f).split(path.sep).join("/");
  while ((m = re.exec(t))) { i++; const line = t.slice(0, m.index).split("\n").length; blocks.push({ f, rel, i, line, src: m[1] }); }
}
const exempt = (b) => EXEMPT.find((e) => b.rel.endsWith("/docs/" + e.file) && (e.line === b.line || (b.src.split("\n")[1] || "").trim() === e.anchor));

(async () => {
  let bad = 0; const report = (b, msg) => console.log(`✗ ${b.f}:${b.line} (#${b.i}) ${msg}`);
  let page, browser;
  if (!lintOnly) {
    const pw = (() => {
      const cands = [process.env.PLAYWRIGHT_MODULE, "playwright"];
      try { cands.push(execSync("npm root -g").toString().trim() + "/playwright"); } catch {}
      for (const c of cands.filter(Boolean)) { try { return require(c); } catch {} }
      throw new Error("找不到 playwright：设置 PLAYWRIGHT_MODULE=<.../node_modules/playwright> 或全局安装；只做规范检查可加 --lint-only");
    })();
    browser = await pw.chromium.launch({ channel: "chrome" }); page = await browser.newPage();
    await page.setContent(`<script src="https://cdn.jsdelivr.net/npm/mermaid@11.16.1/dist/mermaid.min.js"></script>`);
    await page.waitForFunction(() => window.mermaid, null, { timeout: 30000 });
    await page.evaluate(() => mermaid.initialize({ startOnLoad: false, securityLevel: "strict" }));
  }
  for (const b of blocks) {
    const errs = [];
    if (page) {
      const r = await page.evaluate(async (src) => { try { await mermaid.parse(src); return null; } catch (e) { return String(e.message || e).slice(0, 200); } }, b.src);
      if (r) errs.push(`PARSE ${r.replace(/\n/g, " ")}`);
    }
    const { out, body, nodes } = lint(b.src);
    for (const e of out) errs.push(`${e.code} 第 ${b.line + 1 + e.n} 行：${e.msg}`);
    if ((body > MAX_LINES || nodes > MAX_NODES) && !exempt(b)) errs.push(`SIZE ${body} 行 / ${nodes} 个节点，超过 ${MAX_LINES} 行 / ${MAX_NODES} 个节点（拆图，或经裁决登记豁免表）`);
    if (errs.length) { bad++; errs.forEach((e) => report(b, e)); }
  }
  console.log(`checked ${blocks.length} diagrams in ${files.length} files, ${bad} invalid${lintOnly ? "（--lint-only：未跑语法校验）" : ""}`);
  if (browser) await browser.close();
  process.exitCode = bad ? 1 : 0;
})();
