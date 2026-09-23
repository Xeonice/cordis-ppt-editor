// 用法：node mermaid-check.cjs <md 文件...>：提取 ```mermaid 围栏，用 mermaid.parse 校验语法
const fs = require("fs"); const { execSync } = require("child_process");
const pw = require(execSync("npm root -g").toString().trim() + "/playwright");
const files = process.argv.slice(2); const blocks = [];
for (const f of files) {
  const t = fs.readFileSync(f, "utf8"); const re = /```mermaid\n([\s\S]*?)```/g; let m, i = 0;
  while ((m = re.exec(t))) { i++; const line = t.slice(0, m.index).split("\n").length; blocks.push({ f, i, line, src: m[1] }); }
}
(async () => {
  const b = await pw.chromium.launch({ channel: "chrome" }); const p = await b.newPage();
  await p.setContent(`<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>`);
  await p.waitForFunction(() => window.mermaid, null, { timeout: 30000 });
  await p.evaluate(() => mermaid.initialize({ startOnLoad: false, securityLevel: "loose" }));
  let bad = 0;
  for (const blk of blocks) {
    const r = await p.evaluate(async (src) => { try { await mermaid.parse(src); return null; } catch (e) { return String(e.message || e).slice(0, 200); } }, blk.src);
    if (r) { bad++; console.log(`✗ ${blk.f}:${blk.line} (#${blk.i}) ${r.replace(/\n/g, " ")}`); }
  }
  console.log(`checked ${blocks.length} diagrams in ${files.length} files, ${bad} invalid`);
  await b.close();
})();
