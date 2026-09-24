> 状态：草稿 | 负责：产品 | 更新：2026-09-19（按 2026-09-18 裁决：AS 行入总表、M2 补 `shell:home` / `shell:account-menu`、`master:view` / `layout:apply` / `master:edit` 按 Q11 / Q12 / Q16 修订）；2026-09-24（rulings §4.15：M0 依赖改为 Q1–Q10 已裁决；M1 SmartArt/OLE 必渲染；M2 EMF 栅格化、过渡封面、客户端安全基线；M3 图表五类、组管理推迟、OIDC、缩略图/PDF 分列、RLS/撤销跳过/墓碑/两级 ack/按权重准入验收、compose 洁净栈出口；M4 JWT/API Key 与 Helm；SV-15 残留修正）；2026-09-24（rulings §4.16：Q13 不定周期、Q15 M1 P1 去掉 `.pptm`、Q11 M4 试点改为内部非核心成员、Q16 排他锁标已裁决）；2026-09-24（复核修正，rulings §4.17） | 依赖：charter v0.2；rulings §4.10、§4.15、§4.16

# 05 里程碑与范围

> 里程碑骨架来自章程 §7（M0–M5），本文细化每个里程碑的**范围（按需求编号）**、**机械/半机械可验证的验收标准**、**必含的可插拔证据**、**依赖**与**风险**。范围变更只能通过修订本文并在 README「待决事项」记录；不得在里程碑内静默加减。周期：**不定周期**——按范围与验收推进，每个里程碑开工前再估（章程 Q13，rulings §4.16；README PD-13 已裁决）。

---

## 0. 总览

```
 M0 蓝图 ──► M1 打开与保真 ──► M2 单人编辑 ──► M3 协同 ──► M4 插件 SDK 公开 ──► M5 多文档类型孵化
 文档+门禁    viewer+round-trip   命令/撤销/导出   Yjs+Nest      manifest/文档/CTK     model-doc/sheet 骨架

 每个里程碑的出口 = 全部 P0 需求验收通过 + 可插拔证据通过 + 非功能门禁通过 + 评审签字
```

### 0.1 优先级在里程碑中的含义

| 优先级 | 含义 | 滑动规则 |
|---|---|---|
| P0 | 里程碑出口条件；缺一不可 | 不可滑动；砍 P0 = 修订本文 + 章程评审 |
| P1 | 里程碑目标 | 可在该里程碑内延后，但不可跨里程碑；跨里程碑需在 README 待决事项登记 |
| P2 | 机会项 | 可自由滑动，不影响出口 |

### 0.2 需求 → 里程碑总表（P0/P1 摘要；P2 见各功能文件）

| 域 | M1 | M2 | M3 | M4 | M5 |
|---|---|---|---|---|---|
| 打开/保真 OF | 01–15 (P0)、17(P1 M2)、18 零编辑、20、24、25 | 16、17、18 编辑后、19 PNG/SVG、21、22 | 19 PDF（服务端） | 保真副线（矩阵 M4+ 列） | — |
| 编辑 ED | — | 01–09、11、12、14、16、17（P0/P1）、22、23、29；10 单元格、13、18、19、20、21、24、28 E~（P1） | 10 结构、15、17 跨文档、28 E | 27 触控（P2） | — |
| 母版/版式/主题 ML | — | 01 母版视图、02 版式应用与重置（P0） | 03 母版与版式编辑（P0）、04 主题（P1） | 05 备注/讲义母版（P2） | — |
| 应用壳 AS | — | 01 开始页、06 账户菜单（P0）；02 最近与固定、04 指南与帮助入口（P1） | 03 模板库（P1）；05 首次使用引导（P2） | — | — |
| 协同 CO | — | — | 01–09、11、12（P0）；07、13、15（P1） | 06 跨刷新持久化、14（P2） | — |
| 插件 PS | 01、02（内部）、11、15 | 02、04（首个示例）、07（内部）、09 | 14 | 01–09、10、12、16（公开） | 02 `core.documentType` Stable |
| 嵌入 EM | 01（查看器）、12、16 | 01、02、05–09、11、13、14、15、17 | 03（OIDC）、04（服务端）、10、18 | 03（集成方签名 JWT / API Key，rulings §4.15 Q6）；形态 F（P2） | — |
| 服务端 SV | — | 04 过渡封面（包内 `thumbnail.jpeg`，P1，随 AS-02） | 01–10、12（P0）；11、13、**15**（P1，15 由 M4 提前，rulings §4.12 U-14） | 06（JWT / API Key）、09（离线包 / 多架构 / Helm，P1）；14（P2） | — |
| 非功能 NF | 01 打开、02、04 输入、06 源语言、07 Chrome | 01 交互/体积、03、04 CSP、05、06 首批语言、07 全矩阵 | 01 协同/服务端、03 SLO、04 渗透、10、11 | 06 RTL | — |

---

## M0 蓝图（本阶段）

- **目标**：PRD / 设计 / 架构 / 类型治理文档通过评审；仓库目录骨架与全部门禁配置就位（无业务代码）。
- **范围**：本 PRD 全部文件；设计 20-design；架构 30-architecture 含 ADR-0001/0002/0003/0020/0021/0022/0023/0040 至少「已提议」状态；`tooling/*` 门禁配置。
- **验收标准（机械/半机械）**：
  1. 文档评审：三条线 README 的「待决事项」全部有决策人，「对章程的异议」全部有总编排裁决记录（人工，评审纪要）。
  2. 术语一致：脚本扫描 `docs/` 中出现的术语与章程 §4 + 各 README 术语补充的并集，未定义术语数 = 0。
  3. 需求可追溯：本 PRD 每条 P0 需求有唯一 id、优先级、里程碑、验收标准（脚本校验字段齐全）。
  4. 门禁就位：「规范 ↔ 执行」矩阵 CI 校验通过（章程 §7 M0 可插拔证据）；dependency-cruiser、eslint、tsconfig、扫描器、lefthook 在空骨架上跑通。
  5. ADR-0001 声明合并 spike 有结论（可行 / 退路）。
- **依赖**：章程 v0.2；章程 §10 Q1–Q10 已由用户裁决（2026-09-24，rulings §4.15）；Q1（npm org 注册，首次公开发布前）与 Q9（pnpm 11 + Node 26 工具链）须在「首个可运行切片」之前落地。
- **风险**：R-M0-1 ADR-0001 类型方案不可行 → 退路（primer §5.2）已定义；R-M0-2 各条线术语漂移 → 术语扫描脚本。

---

## M1 打开与保真

- **一句话验收（章程 v0.2）**：任意合法 pptx：打开 → 高保真只读渲染 → 未修改导出与原文件语义等价（D7 口径）；`preset-slide-viewer` 可用。
- **范围（P0）**：OF-01、02、03、04、05、06、07、08、09、10、11（保留）、12、13、14、15、18（零编辑往返）、20、24、25；PS-01/02/11/15（内部）；EM-01（查看器形态）、EM-12、EM-16；NF-01（打开、内存）、NF-02（M1 列）、NF-04（输入/供应链）、NF-06（源语言）、NF-07（Chrome/Edge）。
- **范围（P1）**：OF-17 内嵌字体（可滑到 M2 初）；矩阵中标 P1 的 M1 项（`.ppsx/.potx`、分栏、bidi、组合图表、TIFF 占位）。
- **明确不做**：任何编辑 UI；协同；服务端（除 CI 用的 Node 冒烟与 headless 导出校验）。
- **验收标准（机械/半机械）**：
  1. `fidelity:roundtrip`：T1（≥ 80）+ T2（≥ 200）零编辑往返，部件级 diff 零差异 100%（OF-18 §4.1）。
  2. `fidelity:visual`：SSIM 全语料中位数 ≥ 0.90、P10 ≥ 0.80；各矩阵行阈值达标（OF §4.2）；文本行数一致率 ≥ 95%。
  3. `fidelity:interop`：导出文件在 PowerPoint 365 Win/Mac 打开无修复 100%（半机械：自动化 COM/AppleScript 打开并截图，人工复核失败项）。
  4. `perf:open`：D50 首页 ≤ 1.5 s、D200 ≤ 3.0 s（RM-A，p75，5 次取中位）；内存稳态达标；20 次开关无泄漏。
  5. `errors:codes`：`.ppt`/加密/损坏/超限四类各 ≥ 3 个样本返回正确错误码。
  6. `degrade:isolate`：注入抛错的 `ElementRenderer`，同页其它元素渲染，事件 `render/element-failed` 触发。
  7. 187 种 `prstGeom` IoU ≥ 0.95。
  8. 多实例：同页 4 个 `Unit` 打开不同文件，各自渲染正确，关闭一个不影响其它。
  9. `viewer:preset`：`preset-slide-viewer` 打开 T1 语料 100% 成功，初始加载 ≤ 350 KB gzip，包内无编辑命令（扫描器）。
  10. `fidelity:objects`（rulings §4.15 Q7）：表格、图表（D16 只读解析，非预览位图）与 SmartArt（`dsp:drawing`）为 M1 gated，阈值按 OF-08/09/10；OLE 必须显示 `mc:Fallback` 预览图；chartex 与未知 `graphicData` 显示诊断占位；`mc:AlternateContent` 对象可删除且导出后 PowerPoint 打开无修复；含 `mailto:`/`file://` 等非 http(s) 外部关系的文件零编辑往返关系全部保留。
- **可插拔证据（章程）**：`store-memory` 与 `render-dom` 均可被 no-op Provider 替换后仍能启动 —— CI job `pluggable:m1`：以 `store=noop` 启动宿主并打开文件 → 触发 `unit/open-failed{code:"store.unavailable"}` 而非崩溃；以 `render.target=noop` 启动 → `unit/opened` 触发、画布为空、无异常。另：不加载图表渲染器插件时图表占位（OF-09）。
- **依赖**：架构 04（模型 + 不透明保留）、07（渲染）、ADR-0021、ADR-0003（清单生成，内部）、类型治理全套门禁；oracle 生成脚本与 PowerPoint 授权机器（Win + Mac 各 1）。
- **风险**：

| 编号 | 风险 | 缓解 |
|---|---|---|
| R-M1-1 | 文本度量与 PowerPoint 差异导致换行不一致 | 早期建立文本专项语料；度量器可插拔，允许用 Canvas 度量与字体解析度量对比；阈值 95% 允许尾部差异 |
| R-M1-2 | 元素级不透明保留（脏部件重生成时带回 `extLst`）实现复杂，M1 只做零编辑往返可能掩盖问题 | M1 增加「解析 → 无编辑重生成 → 规范化比对」测试（不依赖编辑），提前暴露 |
| R-M1-3 | 真实语料获取与脱敏 | 内部文档 + 公开领域文件 + 生成器（python-pptx）合成；T2 允许 M1 中期从 100 增至 200 |
| R-M1-4 | 图表渲染库体积/许可 | 按需加载 + 许可白名单；候选评估记录到架构 07 |
| R-M1-5 | Strict 文件占比未知 | T2 统计；归一化表沿用 pptx-viewer 的 48 组映射思路（自研实现） |

---

## M2 单人编辑

- **一句话验收（章程 v0.2 + 2026-09-15 裁决）**：文本/形状/图片/幻灯片增删排序/属性编辑/撤销重做/导出；表格单元格文本编辑（P1）；基础放映（P1，无动画）；母版视图（只读）与版式应用/重置（ML-01/02，P0）；性能预算达标。
- **范围（P0）**：ED-01、02、03、04、05、06（纯色/线条）、07、08、09（吸附）、11、12、14、16、17（内部/文本/图片）、22、23、29；OF-18（编辑后导出）；EM-01、02、05、06、07、08、09、11、13、14、15、17；**AS-01 开始页、AS-06 账户菜单**；PS-02（内部）、PS-04 首个示例、PS-07、PS-09；NF-01（交互/体积）、NF-03、NF-05（UI P0 项）、NF-07 全矩阵；**ML-01 母版视图、ML-02 版式应用与重置**（`03-features/07-masters-layouts-and-themes.md`）。
- **范围（P1）**：ED-06（渐变/阴影）、09（对齐分布）、10（单元格文本）、13、18、19、20、21（基础放映，含放映主序列可见性终态）、24、26（替代文本）、28（E~）；OF-16、17、19（PNG/SVG）、22；矩阵 M2 列 P1 项（含 EMF/WMF 惰性栅格化、`mc:AlternateContent` 对象移动/缩放）；SV-04 M2 过渡封面；NF-06 首批语言；**AS-02 最近与固定、AS-04 指南与帮助入口**。
- **明确不做**：表格结构编辑、图表数据编辑、动画播放、母版/版式**编辑**与主题编辑（母版视图只读与版式应用在范围内）、协同。
- **验收标准（机械/半机械）**：
  1. `e2e:editing`：每条 P0/P1 ED 需求 ≥ 1 个 Playwright 用例，全部通过；用例元数据含需求 id（需求 ↔ 测试矩阵无缺失 P0）。
  2. `fidelity:edit-roundtrip`：编辑脚本语料（≥ 50 个「打开 → 执行 N 个命令 → 导出」脚本）：未触碰部件字节相同 100%，脏部件 XSD 有效 100%，规范化 diff 仅在被编辑子树 100%，PowerPoint 打开无修复 100%。
  3. `history:property`：随机 1,000 步命令序列 → 全部撤销 → 模型哈希 == 初始；再全部重做 == 终态（100 个随机种子）。
  4. `perf:interact`：键入 p95 ≤ 50 ms、拖动 ≥ 55 fps、撤销 ≤ 50 ms、导出 D50 ≤ 3 s（RM-A）。
  5. `size:budget`：查看器 ≤ 350 KB、编辑器 ≤ 900 KB gzip。
  6. `a11y:axe`：全部 UI 面板零严重/重大违规；键盘 e2e 覆盖 ribbon/缩略图栏/画布/属性面板/备注。
  7. `embed:multi`：同页 4 个编辑器实例、快捷键按焦点分派、销毁无残留。
  8. `csp:strict`：在 `script-src 'self'` + CSP nonce 的测试页中编辑器全部 e2e 通过；Trusted Types 以 report-only 运行且零违规报告；`externalResources` 三档（auto/confirm/never）下 CSP `img-src`/`media-src` 随之收紧（EM-14）；文档内容注入扫描器零命中。
  9. `master:view`：进入母版视图 ≤ 300 ms（D50，p75）；缩略图窗格显示全部母版与版式缩略图且引用数正确；选中任一节点的画布合成与 PowerPoint 母版视图截图 SSIM ≥ 0.90（抽样 20 个版式）；范围条「编辑版式 | 母版」切换 ≤ 100 ms 且不改变窗格选中项；应用栏「改动将影响 N 页」徽标与状态栏数字一致；数据未就绪显示骨架、加载失败显示「重试」且可切回普通视图；关闭后回到原页与原缩放；进入/退出不产生历史项；**评审模式、放映模式、无 `doc.write` 或视口 < 1024 时无入口**（视图分段不渲染、视图页签「母版视图」按钮禁用且带 tooltip、`Mod+Alt+M` 无效——e2e 各 ≥ 1 条，Q12），已在母版视图中缩窄到 < 1024 不退出。
  10. `layout:apply`：更换版式脚本语料（≥ 30 个「页 × 目标版式」组合，含 ≥ 5 个跨母版组合）的占位符重匹配结果与 ML-02 规则表 100% 一致；跨母版选版式为一个事务（撤销一步回到原版式与原母版，主题解析链随之切换）；不匹配提示为 toast + 撤销；版式选择器搜索框过滤结果正确；重置页走「确认卡 + 可撤销 toast」双层，重置后与「基于版式新建 + 填入同文本」的渲染 SSIM ≥ 0.98；导出后 PowerPoint 打开无修复。
  11. `shell:home`：开始页四态（已登录默认 / 加载中骨架 / 最近为空 / 离线）各 ≥ 1 个 e2e 用例；可交互 ≤ 1.0 s（p75，已登录、列表 ≤ 50 条）；空白 / 模板 / 导入三类入口分别进入编辑器（首页为标题版式，D14）或 OF-01 流程；离线时三类入口禁用且 tooltip 正确，已缓存的最近文档可打开（AS-01 / AS-02）。
  12. `shell:account-menu`：开始页侧栏用户行、文档列表与编辑器应用栏头像三处打开同一 `UserMenu`；设置（`Mod+,`）/ 键盘快捷键（`Mod+/`）/ 帮助中心 / 退出登录各有 e2e；退出登录在参考应用走 OIDC 登出、嵌入时调用集成方回调，未配置时提示「由宿主应用管理登录」；设置抽屉除账户菜单外无其他入口（UI 树扫描），快捷键面板三个入口（Ribbon「?」/ 账户菜单 / `Mod+/`）均可达（AS-06、D12 / D13）。
  13. `embed:framework-free`（rulings §4.15 Q2）：`examples/embed-vanilla` 以 `UiRenderer('vanilla')` 通过 UI 渲染契约；形态 B 产物中不含 react/radix 模块。
- **可插拔证据（章程）**：第三方示例插件新增一种元素渲染与一个 ribbon 按钮，零改内核 —— CI job `pluggable:m2`：构建 `examples/plugin-qr-shape`（只 import 公开入口，depcruise 校验），e2e 验证插入二维码元素、渲染、导出（作为图片回退 + `extLst` 数据）、撤销；该 PR 对 `packages/{kernel,model-core,engine-render,render-dom,ui-core,ui-react}` diff = 0 行。
- **依赖**：架构 05（命令/历史/自动逆操作）、07（覆盖层/命中测试）、03（贡献点 UI）、设计 01/03/04/06；React 19；`@cordexjs/design` token。
- **风险**：

| 编号 | 风险 | 缓解 |
|---|---|---|
| R-M2-1 | IME 在 DOM/SVG 自绘文本上的体验（候选框定位、组合态） | M2 首月完成 IME spike（中/日/韩 + Safari）；`render-dom` 的 IME 宿主是独立可替换组件 |
| R-M2-2 | 自动逆操作在富文本上的正确性 | 属性测试（验收 3）从 M2 第一周起跑 |
| R-M2-3 | 体积预算与 React/ribbon 组件库冲突 | 组件自研或选择可 tree-shake 的原子库；体积门禁每 PR |
| R-M2-4 | 保真在编辑后回归（只写覆盖 vs 烤继承） | `fidelity:edit-roundtrip` 每 PR 跑子集 |
| R-M2-5 | 快捷键与浏览器/宿主冲突 | 作用域 + 可重映射；宿主保留键表 |

---

## M3 协同

- **一句话验收（章程 v0.2 + 2026-09-15 裁决 + rulings §4.15）**：多人实时协同、presence、权限（单组织、OIDC、按人分享）、评论、离线重连；服务端导入/导出/快照；服务端缩略图（前半段）与 PDF 导出（后半段）；自托管 compose 洁净栈；表格结构编辑；图表数据编辑（bar / line / pie / area / scatter 五类，Q18 已裁决，rulings §4.12 U-06）；母版与版式编辑（ML-03，P0）。
- **范围（P0）**：CO-01、02、03、04、05、06（会话内）、08、09、11、12；SV-01–10、12；EM-03、04（服务端 Provider）、10；ED-10（结构）、ED-15、ED-17（跨文档）、ED-28（E）；OF-19（服务端 PDF，M3 后半段）；PS-14；NF-01（协同/服务端）、NF-03（SLO）、NF-04（渗透、镜像供应链）、NF-10、NF-11；**ML-03 母版与版式编辑**。（原「组管理（SV-06 内，rulings §4.12 U-11）」已按 rulings §4.15 Q6 推迟，M3 只按人分享。）
- **范围（P1）**：CO-07 版本历史、CO-13、CO-15（参考应用分享）、SV-11、SV-13、**SV-15**（Webhook 与事件出口，由 M4 提前，rulings §4.12 U-14）、EM-18；移动端查看 + 评论（PD-15 / 章程 Q20）；**ML-04 主题**；**AS-03 模板库**（AS-05 首次使用引导为 P2）。
- **明确不做**：排他编辑锁（章程 Q16 已裁决「不做」，rulings §4.16；CO-10 仅 awareness 软提示，P2）、跨刷新离线持久化（`collab-offline-idb`，M4）、只读大规模广播、多租户 / 自营 SaaS（rulings §4.15 T-0）、组管理（U-11 推迟）、集成方签名 JWT 与 API Key（M4）、离线安装包 / 多架构 / K8s Helm chart（M4 P1）。
- **验收标准（机械/半机械）**：
  1. `collab:converge`：20 客户端 × 1,000 随机命令 + 随机分区/重连（100 个种子）→ 模型哈希一致 100%；导出 XSD 有效。
  2. `collab:soft-conflict`：CO-08 表每行 ≥ 1 个确定性用例，收敛结果与提示 100% 符合。
  3. `collab:latency`：A → B p50 ≤ 150 ms、p95 ≤ 400 ms（同区域测试床，20 编辑者）；presence ≤ 200 ms。
  4. `perm:fail-closed`：无 `doc.write` 的客户端构造 update → 服务端拒绝并断开；权限撤销 ≤ 2 s 生效；未声明能力位的命令被扫描器拒绝进入代码库。
  5. `offline:queue`：断网 5 分钟编辑 500 步 → 重连 ≤ 3 s 合并 → 与在线端哈希一致。
  6. `server:jobs`：导入 D50 ≤ 5 s、导出 pptx D50 ≤ 3 s（与客户端导出规范化一致）；超包络文件（页数 / 单页元素 / 总元素，DX-20K 之外）导入被拒绝并返回 `format.quota_exceeded`（SV-08）。
  6a. `server:thumbnails`（M3 前半段，rulings §4.15 Q8）：导入后首页缩略图 ≤ 10 s，D200 全量 ≤ 90 s；按页内容哈希失效（只改一页只重生成该页）；renderer sidecar 安全测试通过（非 root、沙箱、seccomp、零出站、无凭据）。
  6b. `server:pdf`（M3 后半段）：PDF D50 ≤ 10 s（SSIM ≥ 0.85），与缩略图分队列、首页缩略图优先。
  7. `server:durability`：kill -9 网关后重启，已 ack（`tier:'db'`）update 零丢失（混沌测试 50 次）；Postgres 故障注入下两级 ack 生效：`tier:'spill'` 期间客户端保留 pending，回放后断言无 `pendingStructs`（S-3a）。
  8. `server:scale`：单实例 2,000 WS，活跃房间按文档规模分档（NF-01 §1.7）且按实测权重准入，p95 广播 ≤ 100 ms；双实例跨实例传播 ≤ 50 ms；名额按用户计（同一用户多标签占 1、owner 不占编辑者名额）。
  9. `security:pentest`：OWASP ASVS L2 自评 + 第三方渗透报告无高危未修复项（人工）。
  10. `ops:compose` + `ops:airgap` + `ops:image-licenses`（rulings §4.15 Q10）：`docker compose up`（Postgres 18 / Valkey / SeaweedFS / renderer / 可选 Casdoor）到 `/readyz` 200 ≤ 3 min；断网环境下 compose e2e 通过；全部镜像 digest 钉死；镜像 SBOM 生成；镜像许可门禁（D13 对镜像的解释）通过；备份恢复演练脚本通过。
  11. `comments:roundtrip`：评论导出为现代评论部件 → PowerPoint 365 可见且作者/时间正确（抽样 20 个）。
  12. `collab:softgate`：注入 5% 非法 update（父子环/悬空引用/越权路径），所有端最终一致且合法；每条修复规则有黄金用例；修复与拒绝进入审计（ADR-0034）。
  13. `collab:rejected-rollback`：降权后仍有 pending update → 服务端拒绝 → 客户端「导出后重载」，本地状态与服务端一致，「未同步更改」可导出（架构 06 §18.4）。
  14. `master:edit`：母版/版式编辑脚本语料（≥ 20 个：占位符增删与类型修改、母版文本样式、背景、版式增删改名与重排）→ 全部引用页与缩略图 ≤ 500 ms 更新（D50）；删除被引用版式经确认对话框后受影响页在同一事务内改用同母版默认版式且不可撤销（Q11），引用数 = 0 时可撤销；Shift / Mod 多选批量删除一次确认；同类占位符达上限时插入被阻止并 toast（Q16）；导出后 PowerPoint 母版视图一致（SSIM ≥ 0.90）；ML-03 协同冲突表 5 行各 ≥ 1 个模拟用例收敛且提示正确。
  15. `theme:edit`（P1）：修改 12 主题色与主题字体后全文重算 ≤ 300 ms（D50），显式 `srgbClr` 元素像素不变；导出 `theme*.xml` 重生成且 `extraClrSchemeLst` 字节保留；从模板应用主题两种模式各 ≥ 5 个样本正确。
  16. `security:rls`：绕过应用层直接以另一用户身份查询/写入无权限文档被文档级 Postgres RLS 拒绝（rulings §4.15 Q6）；OIDC 登录、`auth.selfSignup` 默认关、分享链接要求登录各有 e2e（CI：Casdoor 容器 + oidc-provider mock）。
  17. `collab:undo`（rulings §4.15 Q3）：他人后写同一键 → 撤销跳过该键并提示；整步被跳过 → 停下不连撤（`undo-skip-no-cascade`）；删除 vs 编辑 → 软删除墓碑、恢复沿用原 id、与删除方撤销并发不产生重复元素；TTL 到期硬删除、文档擦除不等 TTL；`store-memory` 与 `store-yjs` 同一契约套件通过。
- **可插拔证据（章程）**：`store-yjs` 替换 `store-memory` 仅改 preset 配置 —— CI job `pluggable:m3`：比对 `preset-slide` 与 `preset-slide-collab` 的 Manifest，差异集合恰为白名单 `{-store-memory, +store-yjs, +collab-core, +collab-yjs, +collab-transport-ws, +comments-ui, +presence-ui, +history-ui}`；M2 全部编辑 e2e 在 `store-yjs`（本地、无服务端）下重跑通过；移除 `collab-*` 后仍能启动（CO-11）。
- **依赖**：ADR-0020（CRDT 与页序/富文本映射，已接受）、0022（存储）、0023（协议/权限即时性）、0026（headless 缩略图，已接受）、0029（鉴权）、0035、0037（部署拓扑，新增）、架构 06/08、`protocol` 包；设计 05、设计 08（分享对话框，去组）；Postgres 18 / Valkey / SeaweedFS 测试床（testcontainers）、Casdoor 容器 + oidc-provider mock；PowerPoint 机器用于评论互操作。
- **风险**：

| 编号 | 风险 | 缓解 |
|---|---|---|
| R-M3-1 | 页顺序/形状顺序并发移动语义 | 已由 ADR-0020/0032 回答（`order` 键 fractional index，单键 LWW）；剩余风险为 fuzz 覆盖与环修复规则一致性（CO-08） |
| R-M3-2 | 富文本 CRDT 映射与 `a:r` run 属性模型的对齐 | 架构 04/06 联合评审；文本专项收敛测试 |
| R-M3-3 | 权限即时性（M3 权限源在服务端；M4 起可能依赖集成方回调延迟） | 推送 + 60 s 缓存 + 令牌短期三重保障；文档写明 |
| R-M3-4 | headless Chromium 稳定性与资源 | 独立零出站 renderer sidecar + 每任务新 BrowserContext + 定期回收 + 超时 + 占位图降级；M2 以包内封面过渡；指标告警 |
| R-M3-5 | 评论在 pptx 中的现代评论 schema 文档不全 | 以 PowerPoint 365 生成样本逆向 + oracle 验证；导出可关闭 |
| R-M3-6 | 大二进制走 CRDT 导致膨胀 | 资源通道（CO-12）为 P0 |
| R-M3-7 | 母版/版式编辑触发的反向失效（layout → slides → shapes）在 D200 上的重绘成本 | 反向索引 + 模板层缓存（架构 07）；`master:edit` 预算以 D50 门禁、D200 观测；缩略图按可视区优先刷新 |

---

## M4 插件 SDK 公开

- **一句话验收（章程）**：插件开发指南、manifest、示例仓库、版本协商、兼容性测试套件。
- **范围（P0）**：PS-01、02（公开目录与稳定级）、03、04（完整集）、05、06、07、11、15；EM-15；NF-12；EM-03 / SV-06 的集成方签名 JWT 与 API Key（首次出现主体 JIT 建影子用户，rulings §4.15 Q6）。
- **范围（P1）**：PS-08、09（公开）、10、12、14、16；CO-06 跨刷新持久化（`collab-offline-idb`，P2 可滑）；动画/切换播放（P2，章程 §7 M4）；ML-05 备注/讲义母版（P2）、ED-27 触控（P2）；NF-06 RTL（P2）；SV-09 离线安装包 / 多架构镜像 / K8s Helm chart（P1，rulings §4.15 Q10）；SV-14（P2）；SV-15 M4 展望部分（文档事件扩面，P2；SV-15 本体已提前到 M3，rulings §4.12 U-14）。
- **验收标准（机械/半机械）**：
  1. `docs:coverage`：公开 API / 贡献点 / 错误码文档覆盖率 100%（脚本）；文档中示例代码全部编译。
  2. `ctk:self`：全部官方插件与示例通过 CTK（8 项检查）；CTK 负向样例全部失败。
  3. `manifest:ci`：所有插件 `cordex-manifest.json` 与运行时一致；`hostApi` 范围外宿主拒绝加载（用例）。
  4. `scaffold:e2e`：脚手架 8 个模板各生成一次 → `install/test/build` 通过 ≤ 5 min。
  5. `pilot:external`（半机械）：内部非核心成员（未参与内核开发的同事或全新 AI agent 会话）仅凭公开文档按 §1 旅程完成插件 ≤ 2 人日，CTK 通过，提问 ≤ 3 次；过程记录归档为文档缺陷清单并修复。
  6. `version:policy`：弃用 API 带移除版本；到期扫描器失败用例。
- **可插拔证据（章程）**：内部非核心成员（未参与内核开发的同事或全新 AI agent 会话）仅凭公开文档独立完成一个插件（验收 5；章程 Q11，rulings §4.16）。
- **依赖**：ADR-0002/0003 落地；api-extractor 基线；文档站基础设施；内部非核心试点成员（同事或全新 AI agent 会话，章程 Q11 已裁决）。
- **发布前检查（首次公开发布 npm 包前，rulings §4.15 Q1）**：
  1. 软件类商标检索（Cordex）：确认「Cordex」/「Cordex 幻灯片」/ Cordex Slides 在软件类别无冲突（已知 Cordex® 为 Alpha Technologies 电源类商标）；检索结论归档，冲突时先改名再发布。
  2. npm org `@cordexjs` 已注册；脚手架 `@cordexjs/create-plugin` 与第三方关键字 `cordexjs-plugin` 可用。
  3. 可发布包 `license: Apache-2.0`，根 LICENSE / NOTICE 就位（rulings §4.16 Q12）。
- **风险**：R-M4-1 试点者事先接触过内核实现导致证据失真 → 优先用全新 AI agent 会话，并在验收记录声明试点者背景；R-M4-2 贡献点 API 在 M2/M3 后仍不稳定 → M3 末冻结 `Stable` 集合，其余标 `Beta`。

---

## M5 多文档类型孵化

- **一句话验收（章程）**：`model-doc`/`model-sheet` 骨架通过「文档类型盲」验证：水平层零改动。
- **范围（P0）**：`core.documentType` 贡献点 Stable；`model-doc`、`ooxml-docx`（打开 .docx 并提取段落文本渲染为纯文本页，仅证明管线）、`model-sheet`、`ooxml-xlsx`（打开 .xlsx 并渲染单表网格值，仅证明管线）骨架；`preset-doc`/`preset-sheet`（不带 `-skeleton` 后缀，改用 `package.json#cordex.stability:'experimental'` 标识未完工，2026-09-18，14 §1 C-19）；示例 `doc-type-skeleton`（PS-04）。
- **范围（P1）**：doc/sheet 的零编辑往返（不透明保留在 docx/xlsx 上的复用验证）；三种文档类型在同页共存（各自 `Unit`）。
- **明确不做**：doc/sheet 的编辑、协同、保真承诺（那是后续路线图）。
- **验收标准（机械/半机械）**：
  1. `depcruise:blind`：水平层包对垂直束包 import = 0（含 doc/sheet）；报告入库。
  2. `diff:horizontal`：新增 doc/sheet 骨架的 PR 集合对 `packages/{shared,kernel,protocol,i18n,model-core,store-*,ooxml-core,collab-*,engine-*,render-dom,design,ui-core,ui-react,server-*}` 的 diff = 0 行，以**文件哈希冻结**校验（章程 §7 M5、ADR-0016；CI 在标记 `doc-type:new` 的 PR 上断言）；若确需改水平层，须先以独立 PR 合入并在架构 12 记录原因（该 PR 不得含垂直束代码）。
  3. `boot:empty`：不加载任何 `DocumentType` 时宿主启动，打开文件返回 `format.no_document_type`（章程 §5.4 口径；点式码见 README CS-13）。
  4. `coexist`：同页 slide + doc + sheet 三个 `Unit`，各自打开、渲染、关闭，互不影响。
  5. `roundtrip:docx-xlsx`（P1）：零编辑往返部件级零差异（各 ≥ 20 个样本），验证 `ooxml-core` 不透明保留对其它 OOXML 包的通用性。
- **可插拔证据（章程）**：dependency-cruiser 报告零横向依赖（验收 1 + 2）。
- **依赖**：架构 12；M4 的 `core.documentType` 文档与 CTK 模板。
- **风险**：R-M5-1 `model-core` 的寻址/选区抽象带有幻灯片形状（Univer A2 重演）→ M1 起 `Selection`/`Unit` 抽象评审时用 doc/sheet 反例检查；R-M5-2 `ui-core` 的 ribbon 结构默认「幻灯片形状」→ 设计 06 槽位规范以文档类型为参数。

---

## 6. 跨里程碑事项

| 事项 | 说明 |
|---|---|
| 语料库持续增长 | T2 每里程碑 +100；每个新支持的矩阵行至少 1 个 T1 文件 |
| 保真副线 | 矩阵「M4+」列在 M4/M5 按容量安排，不作为出口条件 |
| 性能预算校准 | 每里程碑中期校准一次（只收紧） |
| 出口评审清单 | P0 验收全绿、可插拔证据全绿、NF 门禁全绿、待决事项无阻塞项、发布说明与已知限制更新、下一里程碑风险复盘 |
| 范围变更流程 | 提案 → README 待决事项登记（决策人）→ 决策 → 修订本文 → 更新需求 ↔ 测试矩阵 |
