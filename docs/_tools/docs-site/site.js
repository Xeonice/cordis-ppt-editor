/* Cordex 文档站交互：主题、抽屉导航、本页目录高亮、表格过滤、代码高亮与复制、Mermaid 渲染与放大、截图轮播、画廊筛选、搜索。 */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, body = doc.body;
  var ROOT = body.getAttribute('data-root') || '';
  var isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { /* 隐私模式或禁用存储时忽略 */ }
    return null;
  }
  function escHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t === 'dark' || t === 'light') return t === 'dark';
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  /* ---------------------------------------------------------------- 主题 */
  function setTheme(t) {
    root.setAttribute('data-theme', t);
    store('cx-theme', t);
    renderAllMermaid();
  }
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onScheme = function () { if (!root.getAttribute('data-theme')) renderAllMermaid(); };
    if (mq.addEventListener) mq.addEventListener('change', onScheme); else if (mq.addListener) mq.addListener(onScheme);
  }
  $$('[data-mod-k]').forEach(function (k) { k.textContent = isMac ? '⌘K' : 'Ctrl K'; });

  /* ---------------------------------------------------------------- 抽屉导航 */
  var sidebar = $('#sidebar');
  function openNav() { body.classList.add('nav-open'); var a = sidebar && $('.nav-item.is-active, .nav-item', sidebar); if (a) a.focus(); }
  function closeNav() { body.classList.remove('nav-open'); }
  if (sidebar) {
    var act = $('.nav-item.is-active', sidebar);
    if (act) sidebar.scrollTop = Math.max(0, act.offsetTop - sidebar.clientHeight / 2);
  }

  /* ---------------------------------------------------------------- 本页目录高亮 */
  var tocBox = $('.toc');
  var heads = $$('.toc a[data-toc]').map(function (a) { return [doc.getElementById(a.getAttribute('data-toc')), a]; })
    .filter(function (p) { return p[0]; });
  var activeToc = null, spyQueued = false, userScrolled = false;
  function spy() {
    spyQueued = false;
    var cur = heads.length ? heads[0][1] : null;
    for (var i = 0; i < heads.length; i++) {
      if (heads[i][0].getBoundingClientRect().top < 120) cur = heads[i][1]; else break;
    }
    if (cur === activeToc) return;
    if (activeToc) activeToc.classList.remove('is-active');
    activeToc = cur;
    if (cur) {
      cur.classList.add('is-active');
      if (tocBox && tocBox.scrollHeight > tocBox.clientHeight) {
        var top = cur.offsetTop - tocBox.clientHeight / 3;
        tocBox.scrollTop = Math.max(0, top);
      }
    }
  }
  if (heads.length) {
    window.addEventListener('scroll', function () { if (!spyQueued) { spyQueued = true; requestAnimationFrame(spy); } }, { passive: true });
    spy();
  }
  ['wheel', 'touchmove', 'keydown'].forEach(function (ev) { window.addEventListener(ev, function () { userScrolled = true; }, { passive: true, once: true }); });

  /* ---------------------------------------------------------------- 大表过滤（≥20 行） */
  $$('.tbl > table').forEach(function (t) {
    var rows = t.tBodies[0] ? Array.prototype.slice.call(t.tBodies[0].rows) : [];
    if (rows.length < 20) return;
    var wrap = doc.createElement('div'); wrap.className = 'tfilter-wrap';
    var inp = doc.createElement('input'); inp.className = 'tfilter'; inp.type = 'search';
    inp.placeholder = '过滤此表：输入文件名、编号或关键词'; inp.setAttribute('aria-label', '过滤此表（' + rows.length + ' 行）');
    var cnt = doc.createElement('span'); cnt.className = 'tfilter-count'; cnt.textContent = rows.length + ' 行';
    wrap.appendChild(inp); wrap.appendChild(cnt);
    var box = t.parentNode; box.parentNode.insertBefore(wrap, box);
    inp.addEventListener('input', function () {
      var q = inp.value.trim().toLowerCase(), n = 0;
      rows.forEach(function (r) { var ok = !q || r.textContent.toLowerCase().indexOf(q) >= 0; r.hidden = !ok; if (ok) n++; });
      cnt.textContent = q ? n + ' / ' + rows.length + ' 行' : rows.length + ' 行';
    });
  });

  /* ---------------------------------------------------------------- 代码高亮与复制 */
  if (window.hljs) {
    try { window.hljs.configure({ ignoreUnescapedHTML: true }); } catch (e) { /* 旧版无此配置 */ }
    $$('.code pre code[class*="language-"]').forEach(function (c) {
      var lang = (c.className.match(/language-(\S+)/) || [])[1];
      if (lang && window.hljs.getLanguage(lang)) { try { window.hljs.highlightElement(c); } catch (e) { /* 保持原文 */ } }
    });
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, fail) {
      var ta = doc.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      body.appendChild(ta); ta.select();
      try { doc.execCommand('copy') ? ok() : fail(); } catch (e) { fail(e); }
      body.removeChild(ta);
    });
  }

  /* ---------------------------------------------------------------- Mermaid：站点 token → themeVariables，主题切换时重渲染 */
  var mmBlocks = $$('pre.cx-mermaid');
  mmBlocks.forEach(function (p) { p._src = p.textContent; });
  var mmSeq = 0, mmBusy = false, mmAgain = false, mmFirst = true;
  var FONT = 'Geist, -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif';
  function cssVar(n) { return getComputedStyle(root).getPropertyValue(n).trim(); }
  function mmConfig() {
    var dark = isDark(), v = cssVar;
    var pies = dark ? ['#6B93FF', '#3BC682', '#E2A33D', '#F0685E', '#5AA6EE', '#B89CFF']
      : ['#3A5CE6', '#0E8A7A', '#D9480F', '#B45309', '#0B7FBF', '#8B5CF6'];
    var tv = {
      darkMode: dark, background: v('--fig-bg'), fontFamily: FONT, fontSize: '14px',
      primaryColor: v('--mm-node'), primaryTextColor: v('--fg'), primaryBorderColor: v('--mm-node-border'),
      secondaryColor: v('--mm-node-2'), secondaryTextColor: v('--fg'), secondaryBorderColor: v('--mm-node-2-border'),
      tertiaryColor: v('--mm-node-3'), tertiaryTextColor: v('--fg'), tertiaryBorderColor: v('--mm-node-3-border'),
      lineColor: v('--mm-line'), textColor: v('--fg'), mainBkg: v('--mm-node'), nodeBorder: v('--mm-node-border'),
      nodeTextColor: v('--fg'), clusterBkg: v('--mm-cluster'), clusterBorder: v('--mm-cluster-border'),
      titleColor: v('--fg'), edgeLabelBackground: v('--fig-bg'),
      actorBkg: v('--mm-node'), actorBorder: v('--mm-node-border'), actorTextColor: v('--fg'), actorLineColor: v('--mm-line'),
      signalColor: v('--fg'), signalTextColor: v('--fg'), labelBoxBkgColor: v('--mm-node'),
      labelBoxBorderColor: v('--mm-node-border'), labelTextColor: v('--fg'), loopTextColor: v('--fg'),
      noteBkgColor: v('--mm-note'), noteTextColor: v('--fg'), noteBorderColor: v('--mm-note-border'),
      activationBkgColor: v('--mm-node-2'), activationBorderColor: v('--mm-node-2-border'),
      sequenceNumberColor: dark ? '#101425' : '#FFFFFF', labelColor: v('--fg'), altBackground: v('--mm-cluster'),
      stateLabelColor: v('--fg'), stateBkg: v('--mm-node'), compositeBackground: v('--mm-cluster'),
      compositeTitleBackground: v('--mm-cluster'), compositeBorder: v('--mm-cluster-border'),
      innerEndBackground: v('--mm-node-border'), specialStateColor: v('--mm-line'), classText: v('--fg'),
      attributeBackgroundColorOdd: v('--fig-bg'), attributeBackgroundColorEven: v('--mm-cluster')
    };
    pies.forEach(function (c, i) { tv['pie' + (i + 1)] = c; tv['cScale' + i] = c; });
    return {
      startOnLoad: false, securityLevel: 'strict', theme: 'base', darkMode: dark, fontFamily: FONT, themeVariables: tv,
      flowchart: { htmlLabels: true, useMaxWidth: true, padding: 12 }, sequence: { useMaxWidth: true },
      state: { useMaxWidth: true }, er: { useMaxWidth: true }, class: { useMaxWidth: true }, gantt: { useMaxWidth: true }
    };
  }
  function mmError(p, e) {
    var msg = p.previousElementSibling;
    if (!msg || !msg.classList.contains('cx-mermaid-error')) {
      msg = doc.createElement('div'); msg.className = 'cx-mermaid-error'; msg.setAttribute('role', 'alert');
      p.parentNode.insertBefore(msg, p);
    }
    var text = String((e && (e.message || e.str)) || e || '未知错误').split('\n').filter(Boolean).slice(0, 3).join(' ');
    msg.textContent = '图渲染失败：' + text.slice(0, 300) + '（下方为 Mermaid 源码）';
    p.classList.remove('is-rendered'); p.classList.add('is-error'); p.textContent = p._src;
    p.removeAttribute('data-scale'); fitHint(p, false);
    if (window.console) console.warn('[Cordex 文档站] Mermaid 渲染失败', e);
  }
  /* 图默认按卡片宽度完整显示：宽图等比缩小到卡片宽（不横向滚动），高图随宽度等比缩放、不设高度上限（不截断）；
     小图保持原始大小居中、不放大。缩放比例低于 HINT_SCALE 时在图下给一行提示，引导用「放大」浮层看细节。 */
  var HINT_SCALE = 0.55;
  function fitHint(p, show) {
    var fig = p.closest('.fig'), hint = fig && $('.fig-fit', fig);
    if (!show) { if (hint) hint.hidden = true; return; }
    if (!fig) return;
    if (!hint) {
      hint = doc.createElement('div'); hint.className = 'fig-fit';
      hint.innerHTML = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/></svg>' +
        '<span>图较大，点「<button type="button" class="fig-fit-zoom">放大</button>」查看细节</span>';
      var fb = p.closest('.fig-body') || p;
      fb.parentNode.insertBefore(hint, fb.nextSibling);
    }
    hint.hidden = false;
  }
  function sizeSvg(p) {
    var svg = p.querySelector('svg'), vb = svg && svg.viewBox && svg.viewBox.baseVal;
    if (!vb || !vb.width) return;
    svg.style.width = '100%'; svg.style.maxWidth = vb.width + 'px'; svg.style.height = 'auto';
    var cw = p.clientWidth;
    if (!cw) return; /* 折叠区内尚不可见：展开后由 ResizeObserver 再算 */
    var s = Math.min(1, cw / vb.width);
    p.setAttribute('data-scale', s.toFixed(3));
    fitHint(p, s < HINT_SCALE);
  }
  function resizeAll() { mmBlocks.forEach(function (p) { if (p.classList.contains('is-rendered')) sizeSvg(p); }); }
  if (window.ResizeObserver) {
    /* 只在图容器宽度变化时重算；推迟到下一帧，避免在观察回调里改尺寸引发循环告警 */
    var mmRO = new ResizeObserver(function (es) {
      es.forEach(function (e) {
        var p = e.target, w = Math.round(e.contentRect.width);
        if (p._w === w) return;
        p._w = w;
        if (p.classList.contains('is-rendered')) requestAnimationFrame(function () { sizeSvg(p); });
      });
    });
    mmBlocks.forEach(function (p) { mmRO.observe(p); });
  } else {
    var resizeTimer = null;
    window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(resizeAll, 150); });
  }
  function renderOne(p) {
    var id = 'cxm-' + (++mmSeq);
    return Promise.resolve().then(function () { return window.mermaid.render(id, p._src); }).then(function (r) {
      p.innerHTML = r.svg;
      p.classList.remove('is-error'); p.classList.add('is-rendered'); p.setAttribute('data-rendered', '1');
      var m = p.previousElementSibling;
      if (m && m.classList.contains('cx-mermaid-error')) m.parentNode.removeChild(m);
      if (r.bindFunctions) r.bindFunctions(p);
      sizeSvg(p);
    }, function (e) {
      ['d' + id, id].forEach(function (x) { var s = doc.getElementById(x); if (s && !p.contains(s)) s.parentNode.removeChild(s); });
      mmError(p, e);
    });
  }
  function renderAllMermaid() {
    if (!mmBlocks.length) return;
    if (!window.mermaid) { mmBlocks.forEach(function (p) { if (!p.classList.contains('is-error')) mmError(p, 'Mermaid 运行时未加载（CDN 不可达）'); }); return; }
    if (mmBusy) { mmAgain = true; return; }
    mmBusy = true;
    try { window.mermaid.initialize(mmConfig()); } catch (e) { /* 初始化失败时逐图报错 */ }
    var chain = Promise.resolve();
    mmBlocks.forEach(function (p) { chain = chain.then(function () { return renderOne(p); }); });
    chain.then(function () {
      mmBusy = false;
      body.setAttribute('data-mermaid', 'done');
      if (mmFirst && location.hash && !userScrolled) {
        var t = doc.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (t) t.scrollIntoView();
      }
      mmFirst = false;
      if (mmAgain) { mmAgain = false; renderAllMermaid(); }
    });
  }
  if (mmBlocks.length) {
    var fontsReady = doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve();
    Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 2500); })]).then(renderAllMermaid);
  } else {
    body.setAttribute('data-mermaid', 'done');
  }

  /* ---------------------------------------------------------------- 放大浮层：滚轮/双指缩放、拖动平移 */
  var lb = $('#lightbox'), stage = $('#lb-stage'), lbc = $('#lb-content'), pct = $('#lb-pct'), lbTitle = $('#lb-title');
  var Z = { s: 1, x: 0, y: 0, w: 1, h: 1 }, lastFocus = null, ptrs = {}, pinch = null;
  function lbApply() {
    lbc.style.transform = 'translate(' + Z.x + 'px,' + Z.y + 'px) scale(' + Z.s + ')';
    if (pct) pct.textContent = Math.round(Z.s * 100) + '%';
  }
  function lbFit() {
    var r = stage.getBoundingClientRect(), pad = r.width < 640 ? 12 : 48, top = 64;
    var s = Math.min((r.width - pad * 2) / Z.w, (r.height - top - pad) / Z.h, 2);
    Z.s = Math.max(0.05, s);
    Z.x = (r.width - Z.w * Z.s) / 2;
    Z.y = top + Math.max(0, (r.height - top - pad - Z.h * Z.s) / 2);
    lbApply();
  }
  function lbZoom(f, cx, cy) {
    var ns = Math.min(8, Math.max(0.05, Z.s * f));
    Z.x = cx - (cx - Z.x) * (ns / Z.s); Z.y = cy - (cy - Z.y) * (ns / Z.s); Z.s = ns;
    lbApply();
  }
  function lbCenterZoom(f) { var r = stage.getBoundingClientRect(); lbZoom(f, r.width / 2, r.height / 2); }
  function openLB(node, title, kind) {
    lbc.innerHTML = '';
    var box = doc.createElement('div');
    box.className = 'lb-canvas' + (kind === 'img' ? ' is-img' : '');
    if (kind === 'svg') {
      var vb = node.viewBox && node.viewBox.baseVal;
      var w = (vb && vb.width) || 800, h = (vb && vb.height) || 600;
      node.removeAttribute('style'); node.setAttribute('width', w); node.setAttribute('height', h);
      box.appendChild(node); Z.w = w + 56; Z.h = h + 56;
    } else {
      var iw = node.naturalWidth || 1440, ih = node.naturalHeight || 900;
      node.removeAttribute('loading'); node.className = '';
      node.style.width = iw + 'px'; node.style.height = ih + 'px';
      box.appendChild(node); Z.w = iw; Z.h = ih;
    }
    lbc.appendChild(box);
    lbTitle.textContent = title || '';
    lastFocus = doc.activeElement;
    lb.hidden = false; body.style.overflow = 'hidden';
    lbFit();
    var c = $('[data-lb="close"]', lb); if (c) c.focus();
  }
  function closeLB() {
    lb.hidden = true; lbc.innerHTML = ''; body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  if (lb) {
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = stage.getBoundingClientRect();
      lbZoom(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    stage.addEventListener('pointerdown', function (e) {
      stage.setPointerCapture(e.pointerId);
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      stage.classList.add('is-drag');
      var ids = Object.keys(ptrs);
      if (ids.length === 2) {
        var a = ptrs[ids[0]], b = ptrs[ids[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      }
    });
    stage.addEventListener('pointermove', function (e) {
      var p = ptrs[e.pointerId]; if (!p) return;
      var ids = Object.keys(ptrs);
      if (ids.length >= 2 && pinch) {
        p.x = e.clientX; p.y = e.clientY;
        var a = ptrs[ids[0]], b = ptrs[ids[1]], r = stage.getBoundingClientRect();
        var d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        Z.x += mx - pinch.mx; Z.y += my - pinch.my;
        lbZoom(d / (pinch.d || d), mx - r.left, my - r.top);
        pinch = { d: d, mx: mx, my: my };
        return;
      }
      Z.x += e.clientX - p.x; Z.y += e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      lbApply();
    });
    var up = function (e) {
      delete ptrs[e.pointerId];
      if (Object.keys(ptrs).length < 2) pinch = null;
      if (!Object.keys(ptrs).length) stage.classList.remove('is-drag');
    };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('dblclick', lbFit);
    lb.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lb]'); if (!b) return;
      var k = b.getAttribute('data-lb');
      if (k === 'close') closeLB();
      else if (k === 'fit') lbFit();
      else if (k === 'in') lbCenterZoom(1.25);
      else if (k === 'out') lbCenterZoom(0.8);
      else if (k === 'one') lbCenterZoom(1 / Z.s);
    });
    window.addEventListener('resize', function () { if (!lb.hidden) lbFit(); });
  }

  /* ---------------------------------------------------------------- 统一点击委托 */
  doc.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('[data-theme-toggle]')) { setTheme(isDark() ? 'light' : 'dark'); return; }
    if (t.closest('[data-nav-open]')) { openNav(); return; }
    if (t.closest('[data-nav-close]')) { closeNav(); return; }
    if (t.closest('[data-search-open]')) { openSearch(); return; }
    var z = t.closest('.fig-zoom, .fig-fit-zoom');
    if (z) {
      var fig = z.closest('.fig'), svg = fig && $('pre.cx-mermaid svg', fig);
      if (svg) openLB(svg.cloneNode(true), ($('.fig-title', fig) || {}).textContent || '', 'svg');
      return;
    }
    var zi = t.closest('[data-zoom-img]');
    if (zi) {
      var img = $$('img', zi).filter(function (i) { return getComputedStyle(i).display !== 'none'; })[0];
      if (img) openLB(img.cloneNode(true), img.getAttribute('alt') || '', 'img');
      return;
    }
    var cp = t.closest('.code-copy');
    if (cp) {
      var code = $('pre', cp.closest('.code'));
      copyText(code ? code.innerText : '').then(function () { cp.textContent = '已复制'; }, function () { cp.textContent = '复制失败'; })
        .then(function () { setTimeout(function () { cp.textContent = '复制'; }, 1600); });
      return;
    }
    if (body.classList.contains('nav-open') && t.closest('.sidebar a')) closeNav();
  });

  /* ---------------------------------------------------------------- 界面截图轮播 */
  $$('[data-shots]').forEach(function (box) {
    var tabs = $$('[data-shot-tab]', box), frames = $$('[data-shot-frame]', box), cnt = $('[data-shot-count]', box), cur = 0;
    function show(k, focus) {
      cur = (k + frames.length) % frames.length;
      frames.forEach(function (f, j) { f.hidden = j !== cur; });
      tabs.forEach(function (tb, j) {
        var on = j === cur;
        tb.classList.toggle('is-active', on); tb.setAttribute('aria-selected', on ? 'true' : 'false'); tb.tabIndex = on ? 0 : -1;
      });
      if (cnt) cnt.textContent = (cur + 1) + ' / ' + frames.length;
      var tb = tabs[cur], seg = tb && tb.parentNode;
      if (seg) seg.scrollLeft = tb.offsetLeft - seg.offsetLeft - seg.clientWidth / 2 + tb.offsetWidth / 2;
      if (focus && tb) tb.focus();
    }
    tabs.forEach(function (tb, j) {
      tb.addEventListener('click', function () { show(j); });
      tb.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1, true); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1, true); }
      });
    });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-shot]'); if (!b) return;
      show(cur + (b.getAttribute('data-shot') === 'next' ? 1 : -1));
    });
    tabs.forEach(function (tb, j) { tb.tabIndex = j === 0 ? 0 : -1; });
    /* 状态页签放不下时横向滚动，两端按是否还有内容加渐隐提示 */
    var seg = tabs[0] && tabs[0].parentNode;
    if (seg) {
      var edges = function () {
        seg.classList.toggle('is-more-l', seg.scrollLeft > 2);
        seg.classList.toggle('is-more-r', seg.scrollLeft + seg.clientWidth < seg.scrollWidth - 2);
      };
      seg.addEventListener('scroll', edges, { passive: true });
      window.addEventListener('resize', edges);
      edges();
    }
  });

  /* ---------------------------------------------------------------- 画廊分组筛选（记住上次选择） */
  var gf = $('.gal-filter');
  if (gf) {
    var cards = $$('.scard');
    var applyFilter = function (g, save) {
      var hit = false;
      $$('.fchip', gf).forEach(function (x) {
        var on = (x.getAttribute('data-filter') || '') === g; hit = hit || on;
        x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (!hit) return applyFilter('', save);
      cards.forEach(function (c) { c.hidden = !!g && c.getAttribute('data-group') !== g; });
      if (save) store('cx-gallery-filter', g);
    };
    gf.addEventListener('click', function (e) {
      var b = e.target.closest('.fchip'); if (b) applyFilter(b.getAttribute('data-filter') || '', true);
    });
    var saved = store('cx-gallery-filter');
    if (saved) applyFilter(saved, false);
  }

  /* ---------------------------------------------------------------- 搜索：search-index.json + 简单打分 */
  var sm = $('#search'), si = $('#search-input'), sres = $('#search-results');
  var sIndex = null, sLoading = null, sResults = [], sActive = 0;
  function loadIndex() {
    if (sIndex) return Promise.resolve(sIndex);
    if (sLoading) return sLoading;
    sLoading = fetch(ROOT + 'search-index.json').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      sIndex = j.docs.map(function (d) {
        return { d: d, t: d.t.toLowerCase(), x: (d.x || '').toLowerCase(), g: ((d.s || '') + ' ' + (d.g || '')).toLowerCase(),
          h: d.h.map(function (h) { return h[0].toLowerCase(); }) };
      });
      return sIndex;
    });
    sLoading.catch(function () { sLoading = null; });
    return sLoading;
  }
  function scoreOf(e, terms) {
    var s = 0, hit = null;
    for (var i = 0; i < terms.length; i++) {
      var q = terms[i], m = false;
      if (e.t.indexOf(q) >= 0) { s += e.t === q ? 40 : (e.t.indexOf(q) === 0 ? 22 : 14); m = true; }
      for (var k = 0; k < e.h.length; k++) {
        if (e.h[k].indexOf(q) >= 0) { s += e.h[k] === q ? 10 : 6; if (!hit) hit = e.d.h[k]; m = true; break; }
      }
      if (e.g.indexOf(q) >= 0) { s += 2; m = true; }
      var p = e.x.indexOf(q);
      if (p >= 0) { s += 1 + (p < 200 ? 1 : 0); m = true; }
      if (!m) return null;
    }
    return { e: e, s: s, hit: hit };
  }
  function mark(text, terms) {
    var out = escHtml(text);
    terms.forEach(function (q) {
      if (!q) return;
      var re = new RegExp(escHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      out = out.replace(re, function (m) { return '<mark>' + m + '</mark>'; });
    });
    return out;
  }
  function snippet(x, terms) {
    var lx = x.toLowerCase(), p = -1;
    for (var i = 0; i < terms.length && p < 0; i++) p = lx.indexOf(terms[i]);
    if (p < 0) return x.slice(0, 110);
    var st = Math.max(0, p - 36);
    return (st > 0 ? '…' : '') + x.slice(st, st + 130) + (st + 130 < x.length ? '…' : '');
  }
  function hrefOf(r) { return ROOT + r.e.d.u + (r.hit && r.hit[1] ? '#' + encodeURIComponent(r.hit[1]) : ''); }
  function runSearch() {
    if (!sIndex) return;
    var q = si.value.trim().toLowerCase();
    if (!q) {
      sResults = [];
      sres.innerHTML = '<div class="search-empty">输入关键词，检索 ' + sIndex.length + ' 个页面的标题、各级章节与正文开头。<br>多个词用空格分开（需同时命中）。</div>';
      return;
    }
    var terms = q.split(/\s+/).filter(Boolean);
    sResults = sIndex.map(function (e) { return scoreOf(e, terms); }).filter(Boolean)
      .sort(function (a, b) { return b.s - a.s || a.e.d.t.length - b.e.d.t.length; }).slice(0, 40);
    sActive = 0;
    if (!sResults.length) { sres.innerHTML = '<div class="search-empty">没有找到「' + escHtml(q) + '」相关的页面。</div>'; return; }
    sres.innerHTML = sResults.map(function (r, i) {
      var d = r.e.d;
      return '<a class="sr' + (i === 0 ? ' is-active' : '') + '" role="option" id="sr-' + i + '" aria-selected="' + (i === 0) + '" href="' + escHtml(hrefOf(r)) + '">' +
        '<div class="sr-top"><span class="sr-sec">' + escHtml(d.s + (d.g ? ' · ' + d.g : '')) + '</span><span class="sr-t">' + mark(d.t, terms) + '</span></div>' +
        (r.hit ? '<div class="sr-h">' + mark(r.hit[0], terms) + '</div>' : '') +
        '<div class="sr-x">' + mark(snippet(d.x || '', terms), terms) + '</div></a>';
    }).join('');
    si.setAttribute('aria-activedescendant', 'sr-0');
  }
  function moveActive(dir) {
    if (!sResults.length) return;
    var items = $$('.sr', sres);
    items[sActive].classList.remove('is-active'); items[sActive].setAttribute('aria-selected', 'false');
    sActive = (sActive + dir + items.length) % items.length;
    items[sActive].classList.add('is-active'); items[sActive].setAttribute('aria-selected', 'true');
    items[sActive].scrollIntoView({ block: 'nearest' });
    si.setAttribute('aria-activedescendant', 'sr-' + sActive);
  }
  function openSearch() {
    if (!sm) return;
    closeNav();
    sm.hidden = false; body.style.overflow = 'hidden';
    si.focus(); si.select();
    loadIndex().then(runSearch, function () {
      sres.innerHTML = '<div class="search-empty">搜索索引加载失败：请通过 http 服务访问本站（file:// 下浏览器会拦截读取）。</div>';
    });
  }
  function closeSearch() { if (sm && !sm.hidden) { sm.hidden = true; body.style.overflow = ''; } }
  if (sm) {
    si.addEventListener('input', runSearch);
    si.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
      else if (e.key === 'Enter' && sResults[sActive]) { e.preventDefault(); location.href = hrefOf(sResults[sActive]); closeSearch(); }
    });
    sm.addEventListener('click', function (e) { if (e.target === sm) closeSearch(); });
    sres.addEventListener('click', function (e) { if (e.target.closest('.sr')) closeSearch(); });
  }

  /* ---------------------------------------------------------------- 全局快捷键 */
  doc.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    var typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (sm && !sm.hidden) closeSearch(); else openSearch();
      return;
    }
    if (e.key === 'Escape') {
      if (lb && !lb.hidden) { closeLB(); return; }
      if (sm && !sm.hidden) { closeSearch(); return; }
      if (body.classList.contains('nav-open')) { closeNav(); return; }
    }
    if (lb && !lb.hidden) {
      if (e.key === '+' || e.key === '=') lbCenterZoom(1.25);
      else if (e.key === '-') lbCenterZoom(0.8);
      else if (e.key === '0') lbFit();
      return;
    }
    if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); openSearch(); }
  });
})();
