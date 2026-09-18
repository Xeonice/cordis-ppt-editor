> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-14 | 依赖：charter v0.1

# ADR-0026 服务端 headless 渲染与缩略图

## 状态

提议（章程 §10 Q8：M3 起服务端 headless Chromium；M1/M2 客户端生成）。

## 背景

需要：文档列表封面、缩略图侧栏的非可见项、分享预览、视觉回归的服务端路径；要求与客户端像素一致（同一文档在不同端不应看起来不同）。

## 决策

1. **服务端渲染 = 同一份客户端渲染代码在 headless Chromium 中运行**（Playwright `playwright-core`，进程内 1 browser、N 页面池）。渲染页为 `apps/web` 的 `/render` 路由（viewer 模式 preset，无 UI/协同），通过一次性 token 从 `/internal/render/:token/state` 拉取快照状态（R4 待决：是否独立 `apps/render-page`）。
2. 触发：压缩完成事件、导入完成、admin；BullMQ `thumbnails` 队列，去重键 `doc:{id}:seq:{seq}`；更高 seq 到来时旧任务作废。
3. 输出：PNG @2×（默认 1280×720 逻辑尺寸）→ S3 `thumbs/{slideId}/{seq}-{algo}.png` → `thumbnails` 表；客户端通过 `GET /documents/:id/thumbnails/:slideId?seq=` 获取（ETag、immutable）。
4. 客户端缩略图 Provider 策略：可见项 `dom-scaled`（实时），其余 `server-png`；本地脏页在 PNG 到达前用 dom-scaled 兜底（07 §8）。
5. 一致性键：`layout_algo_version`（engine-layout 断行算法版本）+ 字体 profile 进入缓存键；不一致 → 重新生成。
6. 安全：渲染 Chromium 禁外网（仅允许 apps/server 内部地址）；不加载外部图片；每页渲染超时 10 s；进程崩溃自愈重建 browser。
7. 预算：≤ 400 ms/页 p95；单 job ≤ 200 页 ≤ 60 s；worker 内存 request 2 GiB。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| Node 内 canvas 渲染（node-canvas/skia-canvas）第二套渲染器 | 第二份渲染实现 = 双倍保真工作与不一致来源（违背 D5 精神的「单一实现」） |
| SVG → resvg/sharp 栅格化 | 需要把文本预先转为字形路径或依赖 resvg 的字体回退，与浏览器排版不一致；滤镜支持差 |
| LibreOffice 转换 | 保真与我们渲染器不同；重依赖；无法体现编辑器实际外观 |
| 仅客户端生成并上传缩略图 | 依赖某个客户端在线；恶意客户端可上传任意图片；导入后无人打开则无封面 |
| 在 `server-headless` 内自带 Vite 渲染页构建 | node 包内含 dom 构建目标，破坏同构分类；改为复用 apps/web 路由或独立 app（R4） |

## 后果

正面：像素一致；视觉 oracle 可同时校验两端；无第二套渲染器。

负面 / 代价：worker 需要 Chromium（镜像 +300 MB）与字体包；渲染吞吐受浏览器限制（并发 2 页/进程）；`apps/web` 需提供 `/render` 路由与 `window.__oce.ready` 协议（apps 组装职责可接受）。

## 补充（v0.2）：PDF 导出（PD-16 / SV-02）、预算与分层规则

- **PDF**：同一 Chromium 池与渲染页，`/render?mode=print` → `page.pdf({ width: slideW, height: slideH, printBackground: true, preferCSSPageSize: true })`，全部/选定页；页面尺寸 = 幻灯片尺寸；字体由 Chromium 以子集嵌入；D50 ≤ 10 s（p95）；与 PowerPoint 导出 PDF 逐页栅格化后 SSIM ≥ 0.85（11 §17）。自研矢量 PDF 为后续（PD-16：headless Chromium 池为 M3 引擎）。
- **缩略图预算**（NF-01 1.7）：D200 全量 ≤ 90 s；导入完成后首页缩略图 ≤ 10 s（导入 processor 完成即入队「首页优先」任务，不等全量）。
- **分层规则**（章程 v0.2 层号编码）：`server-headless`（LS）可依赖 `engine-layout`/`engine-render` 的 iso 契约，不得 import `render-dom`；绘制发生在 Chromium 内加载的 `apps/web` `/render` 页面。`package.json#oce = { layer: 'LS', iso: 'node' }`。
- **客户端路径**：`RenderTarget.toImage`（02 §4.15 `export/to-image.ts`）承担 M1/M2 客户端 PNG 与可选缩略图；服务端 PNG 由本 ADR 路径生成，二者像素差 ≤ 0.5%（同字体 profile）。
- **渲染页归属**：默认 `apps/web` 的 `/render` 路由（无章程改动，R4 待决保留 `apps/render-page` 备选）。

## 如何被机械验证

- 视觉 oracle：服务端 PNG 与客户端 Playwright 截图像素差 ≤ 0.5%（同字体 profile）。
- 单测：去重键作废旧任务；超时/崩溃自愈。
- 集成：导入 → 压缩 → 缩略图存在且 `layout_algo_version` 匹配；改算法版本后触发重生成。
- 安全测试：渲染页尝试加载外网图片被拒（网络策略）。

## 关联

章程 Q7/Q8；ADR-0021/0027；架构 07 §8/§10、08 §3.3/§7。
