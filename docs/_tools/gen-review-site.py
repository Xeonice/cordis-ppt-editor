import re, os, html, json, sys
import markdown
from markdown.extensions.toc import TocExtension, slugify_unicode

# 源目录：默认取本脚本所在 docs/_tools 的同级 40-modules；可用环境变量 OCE_DOCS_SRC 覆盖
SRC = os.environ.get("OCE_DOCS_SRC") or os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "40-modules")
OUT=sys.argv[1]
PREVIEW=len(sys.argv)>2 and sys.argv[2]=="--preview"
MM_TAG='<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script><script>mermaid.initialize({startOnLoad:true,securityLevel:"loose"})</script>' if PREVIEW else ""
GH="https://github.com/Xeonice/cordis-ppt-editor/blob/ppt%E5%9C%A8%E7%BA%BF%E7%BC%96%E8%BE%91%E5%99%A8%E5%88%9D%E5%A7%8B%E5%8C%96/docs/"
PAGES=[("00-module-map.md","00 · 模块切分总图"),
 ("01-tooling-and-governance.md","M-01 · 工具链与治理骨架"),
 ("02-kernel-protocol-and-document-core.md","M-02 · 内核、协议与文档内核"),
 ("03-slide-domain-model.md","M-03 · 幻灯片领域模型"),
 ("04-ooxml-format-and-pptx-codec.md","M-04 · OOXML 格式与 PPTX 编解码"),
 ("05-collaboration-client.md","M-05 · 协同（客户端）"),
 ("06-layout-and-render-engine.md","M-06 · 布局与渲染引擎"),
 ("07-slide-rendering.md","M-07 · 幻灯片渲染"),
 ("08-server-identity-documents-and-storage.md","M-08 · 服务端身份、文档与对象存储"),
 ("09-server-collab-gateway-and-headless-host.md","M-09 · 服务端协同网关与 Headless 宿主"),
 ("10-ui-shell-and-slide-ui.md","M-10 · UI 基座与幻灯片 UI"),
 ("11-preset-assembly-and-app-shell.md","M-11 · 预设装配与应用壳"),
 ("12-server-jobs-comments-and-ops.md","M-12 · 服务端作业、评论与运维"),
 ("13-doc-sheet-extension-skeleton.md","M-13 · doc / sheet 扩展骨架"),
 ("14-cross-module-review.md","14 · 跨模块评审（阶段三）"),
 ("15-server-architecture-review.md","15 · 服务端模块拆分评审"),
 ("16-plugin-catalog.md","16 · 插件总账与可插拔矩阵"),
 ("17-plugin-authoring-patterns.md","17 · 插件书写模式手册"),
 ("_template.md","模板 · 模块设计文档结构")]
PAGES=[(f,l) for f,l in PAGES if os.path.exists(os.path.join(SRC,f))]
NAMES={p for p,_ in PAGES}
os.makedirs(os.path.join(OUT,"pages"),exist_ok=True)

def rewrite_links(md, from_index):
    def rep(m):
        target=m.group(2); frag=m.group(3) or ""
        base=os.path.basename(target)
        if base in NAMES or base=="README.md":
            if base=="README.md": href=("index.html" if from_index else "../index.html")
            else:
                page=base[:-3]+".html"; href=("pages/"+page if from_index else page)
            return f"{m.group(1)}{href}{frag})"
        if target.startswith("../") or re.match(r"^\d\d-", target) or target.startswith("00-charter") or target.startswith("30-architecture") or target.startswith("10-prd") or target.startswith("20-design"):
            rel=target[3:] if target.startswith("../") else target
            return f"{m.group(1)}{GH}{rel}{frag})"
        return m.group(0)
    return re.sub(r"(\]\()([^)#\s]+\.md)(#[^)\s]*)?\)", rep, md)

def render(md_text):
    md=markdown.Markdown(extensions=["tables","fenced_code","sane_lists",TocExtension(toc_depth="2-3",slugify=slugify_unicode,anchorlink=False)])
    body=md.convert(md_text)
    body=body.replace("<table>","<div class=\"tbl\"><table>").replace("</table>","</table></div>")
    body=body.replace("\\|","|")  # 表格内转义竖线在代码段中会原样保留，显示为字面 |
    def _mm(m):
        import html as _h
        return '<pre class="mermaid">'+_h.unescape(m.group(1))+'</pre>'
    body=re.sub(r'<pre><code class="language-mermaid">([\s\S]*?)</code></pre>', _mm, body)
    return body, md.toc

def split_head(text):
    lines=text.split("\n"); status=None; title=None; out=[]
    for l in lines:
        if status is None and l.startswith("> 状态"): status=l[2:].strip(); continue
        if title is None and l.startswith("# "): title=l[2:].strip(); continue
        out.append(l)
    return title, status, "\n".join(out)

def layout(title, status, toc, body, prev, nxt, depth):
    up="../" if depth else ""
    nav=[]
    if prev: nav.append(f'<a class="nav" href="{prev[0]}">← {html.escape(prev[1])}</a>')
    nav.append(f'<a class="nav" href="{up}index.html">索引</a>')
    if nxt: nav.append(f'<a class="nav" href="{nxt[0]}">{html.escape(nxt[1])} →</a>')
    st=f'<p class="status">{html.escape(status)}</p>' if status else ""
    return f"""<meta charset="utf-8"><title>{html.escape(title)}</title>
<link rel="stylesheet" href="{up}site.css">
<header class="top"><div class="brand"><a href="{up}index.html">OCE 模块设计评审</a></div><div class="navs">{' '.join(nav)}</div></header>
<div class="shell">
<aside class="side"><details open><summary>目录</summary><div class="toc">{toc}</div></details></aside>
<main class="main"><h1>{html.escape(title)}</h1>{st}
<div class="content">{body}</div>
<footer class="foot">{' '.join(nav)}</footer></main>
</div>
<script src="{up}site.js"></script>{MM_TAG}
"""

pages_meta=[]
for i,(fn,label) in enumerate(PAGES):
    text=open(os.path.join(SRC,fn),encoding="utf-8").read()
    title,status,rest=split_head(text)
    rest=rewrite_links(rest, from_index=False)
    body,toc=render(rest)
    out=fn[:-3]+".html"
    prev=(PAGES[i-1][0][:-3]+".html", PAGES[i-1][1]) if i>0 else None
    nxt=(PAGES[i+1][0][:-3]+".html", PAGES[i+1][1]) if i<len(PAGES)-1 else None
    open(os.path.join(OUT,"pages",out),"w",encoding="utf-8").write(layout(label if not title else f"{label}", status, toc, body, prev, nxt, depth=1))
    pages_meta.append({"file":out,"label":label,"lines":text.count("\n")+1})
    print("page", out, pages_meta[-1]["lines"])

# ---------- index ----------
readme=open(os.path.join(SRC,"README.md"),encoding="utf-8").read()
rtitle,rstatus,rrest=split_head(readme)
rrest=rewrite_links(rrest, from_index=True)
rbody,rtoc=render(rrest)
decided=[
 ("U-01","`preset-doc` / `preset-sheet` 收录章程，不带 `-skeleton` 后缀，用 `oce.stability:'experimental'` 标识未完工","已定"),
 ("U-02","OOXML Strict 写回：M1 即做 C 案完整写回（反向映射表 + 字节级验证），B 回退仅兜底","已定 · 改变推荐"),
 ("U-03","查看器 `allowExport` 默认关，集成方显式开启","已定"),
 ("U-04","开始页「最近 / 固定」M2 即服务端同步（IndexedDB 仅离线缓存）","已定 · 改变推荐"),
 ("U-05","新增诊断码 `format.pptx.signature_invalidated`，架构 04 §4.1 补 `_xmlsignatures/*` 部件行","已定"),
 ("U-06","图表可编辑类型扩到五类：bar / line / pie / area / scatter","已定 · 改变推荐"),
 ("U-07","版本恢复的撤销语义：两个简单方案均否决，须在多人协同场景下专项设计（M-02 × M-05 × M-09 联合，M3 前出 ADR）","专项设计"),
 ("U-08","高对比 / forced-colors 第三套主题 M3 P1；M1–M2 只加系统色兜底","已定"),
 ("U-09","`ROLE_CAPABILITIES`：`doc.export` / `history.read` 下放到 editor","已定"),
 ("U-10","`create-tenant` 不对外开放自助注册，M3 仅内部 / 管理脚本","已定"),
 ("U-11","M3 即实现组管理：Group 聚合、`groups` / `group_members` 表、按组授权","已定 · 改变推荐"),
 ("U-12","服务端操作日志 M3 不做，靠 `audit_log` + 回收站","已定"),
 ("U-13","`fill-template` 等自动化作业并入 import-export（细节 M4 定）","已定"),
 ("U-14","评论事件：客户端回调 + 服务端 Webhook 两者 M3 都做","已定 · 改变推荐"),
 ("U-15","`audit_log` 哈希链 M3 即实现","已定 · 改变推荐"),
 ("U-16","开发者菜单：构建期 DEV 或运行期 `features.developerMenu` 取或","已定"),
]
pending=[]
def mdinline(s):
    return re.sub(r"`([^`]+)`", lambda m:"<code>"+html.escape(m.group(1))+"</code>", html.escape(s)).replace("&lt;code&gt;","<code>").replace("&lt;/code&gt;","</code>")
def mdi(s):
    s=html.escape(s); return re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
panel='<section class="panel" id="决策面板"><h2>决策面板 · 16 项用户级裁决（已全部裁决）</h2>'
panel+='<p class="muted">来源：<a href="pages/14-cross-module-review.html#_6-1-16">14 §6.1</a>；已定项记录在 rulings §4.12。</p>'
panel+='<h3>已裁决（16 / 16，rulings §4.12）</h3><div class="tbl"><table><thead><tr><th>#</th><th>裁决</th><th>状态</th></tr></thead><tbody>'
for u,t,st in decided:
    cls="chip ok" if st=="已定" else ("chip warn" if "专项" in st else "chip alt")
    panel+=f'<tr><td>{u}</td><td>{mdi(t)}</td><td><span class="{cls}">{st}</span></td></tr>'
panel+='</tbody></table></div>'
if pending: panel+='<h3>待裁决</h3><div class="tbl"><table><thead><tr><th>#</th><th>来源</th><th>问题</th><th>推荐默认</th><th>阻塞</th></tr></thead><tbody>'
for u,src,q,rec,ms in pending:
    panel+=f'<tr><td>{u}</td><td>{mdi(src)}</td><td>{mdi(q)}</td><td>{mdi(rec)}</td><td>{ms}</td></tr>'
panel+=('</tbody></table></div>' if pending else '')+'</section>'
cards='<section class="cards" id="页面"><h2>页面</h2><div class="grid">'
for m in pages_meta:
    cards+=f'<a class="card" href="pages/{m["file"]}"><div class="card-t">{html.escape(m["label"])}</div><div class="card-m">{m["lines"]} 行</div></a>'
cards+='</div></section>'
howto='<section class="howto"><h2>怎么评审</h2><ul><li>每页左侧是章节目录，§4 目录树与 §5 逐文件职责表是评审重点；超过 20 行的表格上方有过滤框，可按文件名或关键词筛。</li><li>指向 40-modules 之外文档的链接跳到 GitHub 私有仓库对应文件（分支 <code>ppt在线编辑器初始化</code>）。</li><li>可以直接在页面上留评论（右上角评论入口），我会按线程处理。</li></ul></section>'
idx=f"""<meta charset="utf-8"><title>OCE 模块设计评审</title>
<link rel="stylesheet" href="site.css">
<header class="top"><div class="brand"><a href="index.html">OCE 模块设计评审</a></div><div class="navs"><a class="nav" href="#决策面板">决策面板</a> <a class="nav" href="#页面">页面</a> <a class="nav" href="pages/00-module-map.html">总图</a> <a class="nav" href="pages/14-cross-module-review.html">评审</a></div></header>
<div class="shell">
<aside class="side"><details open><summary>目录</summary><div class="toc"><ul><li><a href="#决策面板">决策面板</a></li><li><a href="#页面">页面</a></li></ul>{rtoc}</div></details></aside>
<main class="main"><h1>OCE 模块设计评审</h1><p class="status">{html.escape(rstatus or '')}</p>
{howto}{panel}{cards}
<div class="content">{rbody}</div>
</main></div>
<script src="site.js"></script>{MM_TAG}
"""
open(os.path.join(OUT,"index.html"),"w",encoding="utf-8").write(idx)
open(os.path.join(OUT,"site.css"),"w",encoding="utf-8").write(r"""
:root{--bg:#F6F7FA;--paper:#FFFFFF;--ink:#1B1F27;--muted:#5F6B80;--line:#E1E5EC;--accent:#3A5CE6;--accent-soft:#E9EEFF;--code:#F1F3F7;--th:#F3F5F9;--ok:#1E7F4F;--ok-bg:#E4F5EB;--warn:#9A5B00;--warn-bg:#FFF2DB;--alt:#4A3FA8;--alt-bg:#ECE9FB;--shadow:0 1px 2px rgb(20 24 40/.06),0 8px 24px rgb(20 24 40/.06)}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#101523;--paper:#171D2C;--ink:#E7EAF0;--muted:#98A2B6;--line:#2A3245;--accent:#6B93FF;--accent-soft:#1F2A4A;--code:#1F2637;--th:#1C2334;--ok:#6FD39A;--ok-bg:#153524;--warn:#F3C578;--warn-bg:#3B2C10;--alt:#B9AEFF;--alt-bg:#2A2450;--shadow:0 1px 2px rgb(0 0 0/.4),0 8px 24px rgb(0 0 0/.35)}}
:root[data-theme="dark"]{--bg:#101523;--paper:#171D2C;--ink:#E7EAF0;--muted:#98A2B6;--line:#2A3245;--accent:#6B93FF;--accent-soft:#1F2A4A;--code:#1F2637;--th:#1C2334;--ok:#6FD39A;--ok-bg:#153524;--warn:#F3C578;--warn-bg:#3B2C10;--alt:#B9AEFF;--alt-bg:#2A2450;--shadow:0 1px 2px rgb(0 0 0/.4),0 8px 24px rgb(0 0 0/.35)}
body{background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.65;margin:0;padding-inline:16px}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.top{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;margin-inline:-16px;padding-inline:16px;background:color-mix(in srgb,var(--paper) 88%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.brand a{font-weight:700;color:var(--ink);letter-spacing:.2px}.navs{display:flex;flex-wrap:wrap;gap:6px}
.nav{font-size:13px;padding:4px 10px;border:1px solid var(--line);border-radius:999px;background:var(--paper);color:var(--ink)}
.shell{display:grid;grid-template-columns:280px minmax(0,1fr);gap:24px;max-width:1440px;margin:0 auto;padding-block:20px}
.side{position:sticky;top:58px;align-self:start;max-height:calc(100vh - 70px);overflow:auto;font-size:13px}
.side summary{cursor:pointer;font-weight:600;color:var(--muted);margin-bottom:6px}
.toc ul{list-style:none;padding-left:0;margin:0}.toc ul ul{padding-left:12px;border-left:1px solid var(--line);margin-left:4px}.toc li{margin:2px 0}.toc a{display:block;padding:3px 8px;border-radius:6px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.toc a.active,.toc a:hover{background:var(--accent-soft);color:var(--accent);text-decoration:none}
.main{min-width:0;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:28px 32px;box-shadow:var(--shadow)}
h1{font-size:26px;line-height:1.3;margin:0 0 6px;text-wrap:balance}h2{font-size:20px;margin:36px 0 12px;padding-top:12px;border-top:1px solid var(--line)}h3{font-size:16px;margin:24px 0 8px}h4{font-size:14.5px;margin:18px 0 6px}
.status{font-size:12.5px;color:var(--muted);margin:0 0 18px}
.content p{max-width:78ch}.content li{max-width:78ch}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.88em;background:var(--code);padding:1px 5px;border-radius:5px}
pre{background:var(--code);border:1px solid var(--line);border-radius:10px;padding:12px 14px;overflow:auto;font-size:12.5px;line-height:1.5}pre code{background:none;padding:0;font-size:inherit}
blockquote{margin:12px 0;padding:8px 14px;border-left:3px solid var(--accent);background:var(--accent-soft);border-radius:0 8px 8px 0;color:var(--ink)}blockquote p{margin:4px 0}
.tbl{overflow-x:auto;margin:12px 0;border:1px solid var(--line);border-radius:10px}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left}th{background:var(--th);position:sticky;top:0;font-weight:600;white-space:nowrap}tbody tr:nth-child(even){background:color-mix(in srgb,var(--th) 45%,transparent)}
.tfilter{width:100%;box-sizing:border-box;margin:10px 0 -6px;padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink);font-size:13px}
.chip{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap}.chip.ok{color:var(--ok);background:var(--ok-bg)}.chip.warn{color:var(--warn);background:var(--warn-bg)}.chip.alt{color:var(--alt);background:var(--alt-bg)}
.muted{color:var(--muted);font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}.card{display:block;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink)}.card:hover{border-color:var(--accent);text-decoration:none}.card-t{font-weight:600;font-size:14px}.card-m{color:var(--muted);font-size:12px;margin-top:4px}
.foot{margin-top:32px;padding-top:14px;border-top:1px solid var(--line);display:flex;gap:8px;flex-wrap:wrap}
@media (max-width:900px){.shell{grid-template-columns:1fr}.side{position:static;max-height:none}.side details:not([open]) .toc{display:none}.main{padding:18px 16px}}
""")
open(os.path.join(OUT,"site.js"),"w",encoding="utf-8").write(r"""
(function(){
  // 大表过滤
  document.querySelectorAll('.tbl table').forEach(function(t){
    var rows=t.tBodies[0]?Array.from(t.tBodies[0].rows):[]; if(rows.length<20) return;
    var inp=document.createElement('input'); inp.className='tfilter'; inp.type='search'; inp.placeholder='过滤此表（'+rows.length+' 行）…';
    inp.id='f-'+Math.random().toString(36).slice(2,8);
    t.parentNode.parentNode.insertBefore(inp,t.parentNode);
    inp.addEventListener('input',function(){var q=inp.value.trim().toLowerCase();rows.forEach(function(r){r.style.display=(!q||r.textContent.toLowerCase().indexOf(q)>=0)?'':'none';});});
  });
  // 目录高亮
  var links=Array.from(document.querySelectorAll('.toc a[href^="#"]')); if(!links.length) return;
  var map=new Map(); links.forEach(function(a){var id=decodeURIComponent(a.getAttribute('href').slice(1));var el=document.getElementById(id); if(el) map.set(el,a);});
  var current=null;
  var io=new IntersectionObserver(function(es){es.forEach(function(e){ if(e.isIntersecting){ if(current) current.classList.remove('active'); current=map.get(e.target); if(current){current.classList.add('active');} } });},{rootMargin:'-10% 0px -80% 0px',threshold:0});
  map.forEach(function(_,el){io.observe(el);});
})();
""")
print("index + assets written")
