// 用法：node capture-screens.cjs <dist 服务 URL> <输出目录> [--only=08,13]
// 为文档站「设计集中展示」实拍 playground（先 npm run build，再用静态服务器在 <URL> 提供 docs/20-design/playground/dist/）：
// 每个路由拍默认态 + 至多 3 个代表态；每态亮/暗各一张 1440×900（DSF 1，JPEG q78），另以 DSF 0.5 同视口拍 720×450 缩略图；
// 输出 <输出目录>/*.jpg 与 manifest.json（29 个 03-screens 文档全部登记；无专属路由的 states 为 []，用 seeAlso 指向相关界面）。
// 切换演示态：点击 DesignBar 的演示状态下拉 [data-slot=select-trigger]，再点对应文字的 [data-slot=select-item]；
// 暗色：页面脚本运行前把 localStorage["cordex-theme"] 设为 dark/light（src/lib/theme.ts 中显式选择优先级最高），并同步 colorScheme。
const fs = require("fs"); const path = require("path"); const { execSync } = require("child_process");
// playwright 解析顺序：环境变量 PLAYWRIGHT_MODULE（模块目录）→ 本地 node_modules → 全局 npm root
const pw = (() => {
  const cands = [process.env.PLAYWRIGHT_MODULE, "playwright"];
  try { cands.push(execSync("npm root -g").toString().trim() + "/playwright"); } catch {}
  for (const c of cands.filter(Boolean)) { try { return require(c); } catch {} }
  throw new Error("找不到 playwright：设置 PLAYWRIGHT_MODULE=<.../node_modules/playwright> 或全局安装");
})();
const PLAYGROUND_URL = "https://claude.ai/code/artifact/cf6e1a1a-986b-48bb-b743-5758dff419d2";
const TRIGGER = '[data-slot=select-trigger][aria-label="演示状态"]';
// 状态：[value, label（须与下拉文字一致）, 选项]；同一路由同一 value 只拍一次，文件名取首个登记的编号。
// 选项 click：不切下拉，点击该文字的演示按钮（toast）；hover：拍前把鼠标移到该名称的 application 区域；note：展示补充说明。
const S = (id, file, title, group, route, states = [], seeAlso) => ({ id, doc: `03-screens/${file}`, title, group, route, states, seeAlso });
const SCREENS = [
  S("01", "01-document-list.md", "文档列表（应用壳）", "应用壳", "/documents", [["default", "默认（有文档）"], ["empty", "空状态"]]),
  S("02", "02-editor-main.md", "编辑器主界面", "编辑器·画布", "/editor", [["default", "默认 · 选中形状"], ["text", "文本编辑态"], ["review", "评审 · 有条目"]]),
  S("03", "03-properties-panel.md", "格式/属性面板", "编辑器·面板", null, [], ["02"]),
  S("04", "04-insert-menu.md", "插入菜单", "编辑器·面板", null, [], ["15"]),
  S("05", "05-context-menu.md", "上下文菜单", "编辑器·画布", null, [], ["02"]),
  S("06", "06-comments-panel.md", "评论面板", "协同", "/editor/comments", [["default", "默认（有评论）"], ["detached", "已脱离锚点筛选"]]),
  S("07", "07-version-history.md", "版本历史", "协同", "/editor/history", [["default", "默认（有历史）"], ["readonly", "编辑者：只能查看，不能恢复 / 命名"]]),
  S("08", "08-share-permissions-dialog.md", "分享与权限对话框", "协同", "/editor/share",
    [["default", "默认（所有者视角）"], ["no-account", "无账号者打开分享链接"], ["invite-error", "邀请失败（selfSignup 关，默认）"]]),
  S("09", "09-plugin-manager.md", "插件管理器", "编辑器·面板", "/editor/plugins", [["default", "默认"], ["error", "管理器加载失败"]]),
  S("10", "10-fidelity-report.md", "导入保真报告", "导入导出", "/editor/fidelity",
    [["default", "部分保留（默认）"], ["partial-fail", "部分解析失败但可继续打开"], ["full", "完全高保真"]]),
  S("11", "11-present-mode.md", "放映模式", "查看器与放映", "/present",
    [["default", "默认（移动鼠标显示控制条）", { hover: "放映舞台" }], ["following", "协同跟随（观众端）", { hover: "放映舞台" }], ["slide-error", "单页渲染失败", { hover: "放映舞台" }]]),
  S("12", "12-offline-conflict-banner.md", "离线/冲突横幅", "协同", "/offline",
    [["offline", "离线"], ["quota-soft", "配额：元素总数接近上限（软警告）"], ["viewers-full", "配额：查看者名额已满（阻断）"], ["readonly-degraded", "权限降级 · 未保存改动"]]),
  S("13", "13-import-progress-and-degraded-states.md", "打开与导入：进度、失败态、降级占位", "导入导出", "/import",
    [["progress", "进度：解析母版与版式"], ["err-macro", "失败：包含宏（.pptm）"], ["err-quota", "失败：超出规模上限（配额）"], ["external-confirm", "外链资源：confirm（需确认加载）"]]),
  S("14", "14-slide-management-and-layouts.md", "幻灯片管理与版式选择器", "编辑器·面板", null, [], ["27", "02"]),
  S("15", "15-insert-menu-and-shape-library.md", "插入菜单与形状库/变换手柄", "编辑器·面板", "/editor/insert",
    [["default", "默认 · 形状/表格/图表入口"], ["handles", "变换手柄（缩放/旋转）"]]),
  S("16", "16-text-editing-and-formatting.md", "文本编辑态与格式化", "编辑器·画布", "/editor/text",
    [["editing", "编辑中 · 迷你工具条"], ["restricted-font", "受限字体三处提示"], ["bullets", "项目符号 · 多级缩进"]]),
  S("17", "17-selection-alignment-and-snapping.md", "选择、多选、对齐、分布、吸附、网格与参考线", "编辑器·画布", null, [], ["02"]),
  S("18", "18-image-editing.md", "图片操作（上传/裁剪/替代文本）", "编辑器·画布", null, [], ["15", "02"]),
  S("19", "19-undo-redo-clipboard-and-save-state.md", "撤销重做、剪贴板反馈、保存态与离开保护", "编辑器·画布", "/editor",
    [["default", "默认 · 选中形状", { note: "应用栏撤销/重做按钮与保存态" }], ["undo-skipped", "协同撤销已跳过（toast）", { click: "演示：撤销已跳过" }]]),
  S("20", "20-view-zoom-and-navigation.md", "视图、缩放与导航——\"视图\"页签", "编辑器·画布", null, [], ["02"]),
  S("21", "21-find-and-replace.md", "查找与替换", "编辑器·画布", null, [], ["02"]),
  S("22", "22-export-dialog.md", "导出对话框", "导入导出", "/export", [["default", "默认"], ["progress", "生成中"], ["error", "失败"]]),
  S("23", "23-settings-panel.md", "设置（主题/密度/语言/单位）", "设置与帮助", "/settings", [["settings", "设置面板"], ["settings-locked", "设置：集成方锁定态"]]),
  S("24", "24-keyboard-shortcuts-panel.md", "快捷键速查面板", "设置与帮助", "/settings", [["shortcuts", "快捷键面板"], ["shortcuts-search", "快捷键：搜索过滤"]]),
  S("25", "25-viewer-preset-shell.md", "只读查看器 preset 壳", "查看器与放映", "/viewer", [["default", "默认"], ["summary", "保真摘要卡片"]]),
  S("26", "26-master-view-and-editing.md", "母版视图与母版/版式编辑", "母版与主题", "/editor/masters",
    [["layout", "编辑版式（默认）"], ["master", "编辑母版"], ["placeholder", "占位符属性 · 覆盖态"]]),
  S("27", "27-layout-picker-and-reset.md", "版式选择器（基于母版分组）与重置页", "母版与主题", "/editor/layouts",
    [["picker", "版式选择器（默认）"], ["cross-master", "跨母版选择提示"], ["reset", "重置占位符确认"]]),
  S("28", "28-design-tab-and-themes.md", "设计页签：主题、变体、主题色与字体编辑", "母版与主题", "/editor/design",
    [["browse", "浏览已应用主题（默认）"], ["color", "自定义颜色编辑中"]]),
  S("29", "29-home-start-page.md", "应用首页（开始页）", "应用壳", "/home", [["default", "默认（有最近文档）"], ["first-run", "首次使用（无文档，突出指南）"]]),
]
// 非 03-screens 的补充界面（样式指南：09-design-specification §2），生成器可选用
const EXTRAS = [{ ...S("styleguide", "", "样式指南（组件状态矩阵）", "设计系统", "/styleguide", [["default", "默认", { noBar: true }]]), doc: "09-design-specification.md" }]

async function shoot(ctx, base, st, file, theme) {
  const page = await ctx.newPage(); const errs = []; const notes = []; let switched = false;
  page.on("pageerror", (e) => errs.push("pageerror " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.location().url || "")) errs.push("console " + m.text().slice(0, 160)) });
  try {
    await page.goto(`${base.replace(/\/$/, "")}/#${st.route}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const trig = page.locator(TRIGGER).first();
    if (!st.noBar) {
      await trig.waitFor({ timeout: 15000 });
      if (!st.click && (await trig.innerText()).trim() !== st.label) {
        await trig.click();
        await page.locator("[data-slot=select-content] [data-slot=select-item]").filter({ hasText: new RegExp(`^${st.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).click();
        await page.locator("[data-slot=select-content]").waitFor({ state: "detached" });
        switched = true;
        await page.waitForTimeout(300);
        // 兜底：个别演示态（如查看器「保真摘要卡片」Popover）会被下拉关闭时的焦点回收立刻关掉并复位，改为直接调用 DesignBar 的 onStateChange
        // （DOM 节点上的 fiber 可能是旧树，Radix Select 内部 setValue 闭包会过期；DesignBar 回调只包 setState，旧闭包也可用）
        if ((await trig.innerText()).trim() !== st.label) {
          notes.push(`点击切换未保持，已改用 DesignBar onStateChange 直设「${st.value}」`);
          await page.evaluate(({ sel, value }) => {
            const el = document.querySelector(sel); const k = Object.keys(el).find((x) => x.startsWith("__reactFiber$"));
            for (let f = el[k]; f; f = f.return) { const p = f.memoizedProps; if (p && typeof p.onStateChange === "function" && p.stateOptions) return p.onStateChange(value) }
          }, { sel: TRIGGER, value: st.value });
        }
      }
      if (st.click) await page.getByRole("button", { name: st.click, exact: true }).click();
      // 下拉关闭后焦点回到触发器会留下焦点环（演示控制条而非设计本身），仅当焦点仍在触发器/演示按钮上时移除
      await page.evaluate((sel) => { const a = document.activeElement; if (a && (a.matches(sel) || a.closest(".glass.z-\\[60\\]"))) a.blur() }, TRIGGER);
      // 鼠标移到 DesignBar 标题（纯文本）上，避免停在下拉项原位置触发画面上的悬停态/提示
      const title = page.locator("span.whitespace-nowrap.font-medium").first();
      const tb = await title.boundingBox(); if (tb) await page.mouse.move(tb.x + 4, tb.y + tb.height / 2);
    }
    if (st.hover) {
      const b = await page.getByRole("application", { name: st.hover }).boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.move(b.x + b.width / 2 + 12, b.y + b.height / 2 + 8);
    }
    await page.waitForTimeout(st.click ? 900 : 700);
    const chk = await page.evaluate(() => ({ hash: location.hash, dark: document.documentElement.classList.contains("dark"), text: document.body.innerText }));
    if (chk.hash !== `#${st.route}`) errs.push(`路由跳走：${chk.hash}`);
    if (chk.dark !== (theme === "dark")) errs.push(`主题不符：期望 ${theme}`);
    if (/Unexpected Application Error|404 Not Found/.test(chk.text)) errs.push("出现错误页");
    if (!st.noBar && !st.click && (await trig.innerText()).trim() !== st.label) errs.push(`下拉未切到「${st.label}」`);
    await page.screenshot({ path: file, type: "jpeg", quality: 78 });
  } catch (e) { errs.push("异常 " + String(e.message || e).split("\n")[0]) }
  await page.close();
  return { switched, errs, notes };
}

(async () => {
  const [base, out] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const only = (process.argv.find((a) => a.startsWith("--only=")) || "--only=").slice(7).split(",").filter(Boolean);
  if (!base || !out) { console.error("用法：node capture-screens.cjs <dist 服务 URL> <输出目录> [--only=08,13]"); process.exit(1) }
  fs.mkdirSync(out, { recursive: true });
  const browser = await pw.chromium.launch({ channel: "chrome" }).catch(() => pw.chromium.launch());
  const ctxs = {};
  for (const theme of ["light", "dark"]) for (const [suffix, dsf] of [["", 1], [".thumb", 0.5]]) {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dsf, colorScheme: theme, locale: "zh-CN" });
    await c.addInitScript((t) => { try { localStorage.setItem("cordex-theme", t) } catch {} }, theme);
    ctxs[theme + suffix] = c;
  }
  const done = new Map(); const issues = []; let shots = 0; const routes = new Set();
  const build = async (s) => {
    const e = { doc: s.doc, id: s.id, title: s.title, group: s.group, route: s.route ? `#${s.route}` : null, states: [], ...(s.seeAlso ? { seeAlso: s.seeAlso } : {}) };
    for (const [value, label, opt = {}] of s.states) {
      const key = `${s.route}|${value}`; let rec = done.get(key);
      if (!rec && (!only.length || only.includes(s.id))) {
        const stem = `${s.id}--${value}`; routes.add(s.route);
        const files = { light: `${stem}--light.jpg`, dark: `${stem}--dark.jpg`, thumbLight: `${stem}--light.thumb.jpg`, thumbDark: `${stem}--dark.thumb.jpg` };
        const jobs = [["light", files.light, "light"], ["dark", files.dark, "dark"], ["light.thumb", files.thumbLight, "light"], ["dark.thumb", files.thumbDark, "dark"]];
        // 四个上下文并行；python http.server 并发时偶发连接重置，失败的单张错开重试至多 2 次，只保留最后一次的问题
        const res = await Promise.all(jobs.map(async ([ck, f, theme], i) => {
          let r; for (let n = 0; n < 3; n++) {
            await new Promise((ok) => setTimeout(ok, i * 120 + n * 800));
            r = await shoot(ctxs[ck], base, { route: s.route, value, label, ...opt }, path.join(out, f), theme); if (!r.errs.length) break;
          }
          return r;
        }));
        res.forEach((r, i) => [...r.errs, ...r.notes.map((m) => "（兜底）" + m)].forEach((m) => issues.push(`${jobs[i][1]}: ${m}`)));
        rec = { files, isDefault: !opt.click && res.every((r) => !r.switched) }; done.set(key, rec); shots += 4;
        console.log(`✓ ${stem}${rec.isDefault ? "（默认态）" : ""}`);
      }
      if (rec && Object.values(rec.files).every((f) => fs.existsSync(path.join(out, f))))
        e.states.push({ value, label, ...(rec.isDefault ? { default: true } : {}), ...(opt.note ? { note: opt.note } : {}), ...rec.files });
    }
    return e;
  };
  const screens = []; for (const s of SCREENS) screens.push(await build(s));
  const extras = []; for (const s of EXTRAS) extras.push(await build(s));
  await browser.close();
  if (!only.length) {
    const manifest = { playgroundUrl: PLAYGROUND_URL, generatedAt: new Date().toISOString(), viewport: "1440x900", thumb: "720x450", screens, extras };
    fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  }
  console.log(`routes ${routes.size}, shots ${shots}, issues ${issues.length}`); issues.forEach((m) => console.log("✗ " + m));
})();
