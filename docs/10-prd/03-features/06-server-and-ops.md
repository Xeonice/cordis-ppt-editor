> 状态：草稿 | 负责：产品 | 更新：2026-09-15 | 依赖：charter v0.2

# 功能域 06：服务端能力与运维

> 需求编号前缀 `SV-`。服务端 = `apps/server`（NestJS 11 传输壳）+ `server-collab`/`server-storage`/`server-headless`（业务逻辑，章程 D8、R4）。本文定义服务端对外提供的产品能力（导入导出、快照、缩略图、审计、配额）与运维/管理员的需求；模块划分、存储结构、部署拓扑由架构 08 与 ADR-0022/0023 决定。

---

## 0. 本域的产品立场

1. **服务端与客户端跑同一份模型/格式代码**（章程 §2.2）：导入、导出、校验、迁移在 `server-headless` 的 cordis 宿主中用 `iso` 插件完成，不存在「服务端另一套解析器」。
2. **服务端是权限与持久化的最终裁决者**：客户端体验优先，服务端安全兜底（D12）。
3. **可运维即产品能力**：健康检查、指标、审计、配额、备份恢复是 M3 验收项，不是「上线后再补」。
4. **单体起步、可水平扩展**：M3 交付 docker-compose 单体（Q10），但协同网关从第一天支持多实例（Redis pub/sub），不做架构返工。

---

## 1. 能力总览

```
                    ┌──────────────────────────── apps/server (NestJS 11) ────────────────────────────┐
  集成方/前端 ────► │ Auth │ Documents │ Collab Gateway │ ImportExport │ Snapshots │ Thumbnails │ Audit │
                    └──┬────────┬────────────┬──────────────┬────────────┬────────────┬──────────┬────┘
                       │        │            │              │            │            │          │
                     OIDC/   Postgres    server-collab   server-headless  server-collab  server-headless  Postgres
                     JWKS    (元数据)    (房间/广播/    (cordis 宿主:    (update 追加/  (headless      (审计表)
                                         update 持久化)  iso 插件)       快照压缩)     Chromium)
                                              │              │
                                           Redis          server-storage (S3/MinIO/本地)
                                        (pub/sub, presence)
```

---

## 2. 需求

### SV-01 文档导入（服务端）

- 优先级：P0 | 目标里程碑：M3 | 依赖能力：`server-headless`（cordis 宿主加载 `ooxml-pptx` 等 `iso` 插件）、`server-storage`、`FormatCodec`、`Snapshot`
- 用户故事：作为集成方后端工程师，我希望上传一个 pptx 后服务端生成协同所需的初始 `Snapshot` 与资源清单，客户端打开时直接加入房间而不必各自解析原文件。
- 验收标准：
  - 上传：预签名直传到 blob 存储（≥ 10 MB 分片），随后调用「导入」API；也支持小文件（≤ 10 MB）直接 multipart。
  - 导入为异步作业：返回 `jobId`；状态 `queued → running → succeeded | failed`；进度阶段与客户端 OF-01 一致；D50 ≤ 5 s（p95）、D200 ≤ 20 s（p95）；并发导入队列可配置（默认 4/实例）。
  - 输出：初始 `Snapshot`（`schemaVersion` 当前值）、资源清单（媒体部件 → `BlobRef`）、不透明保留的部件原字节（以 `BlobRef` 内容寻址保存，构成 `SnapshotBundle`，即「基线包」，随文档生命周期保留、不受原件保留期限制）、诊断报告（降级项、缺失字体、限制命中）；上传的原始文件（导入原件）另存 30 天（章程 Q17）。
  - 输入限制与客户端一致（OF-24），可按租户配额覆盖（SV-08）。
  - 失败：类型化错误码（与客户端同一张表）；保留失败样本（可配置、脱敏路径）用于排障。
  - 病毒扫描钩子（P2）：导入前调用集成方扫描回调，拒绝即失败。

### SV-02 文档导出（服务端）

- 优先级：P0 | 目标里程碑：M3 | 依赖能力：`server-headless`、`FormatCodec` 导出、`RenderTarget`（headless Chromium 中的 `render-dom`）、导出专用 `core.format`（`canImport:false`）
- 验收标准：
  - 导出 pptx：从最新快照（或指定版本）+ 基线包生成；与客户端导出**字节级一致**（同一代码路径，CI 断言同一 Snapshot 在浏览器与 Node 导出的规范化结果相同）；D50 ≤ 3 s、D200 ≤ 12 s（p95）。
  - 导出 PDF（引擎见 PD-16）：headless Chromium 打印全部/选定页，A4/16:9 原始尺寸，嵌入字体子集；与 oracle PDF 逐页 SSIM ≥ 0.85；D50 ≤ 10 s（p95）。
  - 导出 PNG/JPEG：按页，宽度 1280/1920/3840；D200 全量 ≤ 90 s。
  - 导出为异步作业（同 SV-01），结果为预签名下载 URL（有效期可配，默认 1 h）。
  - 字体：服务端默认字体包 Noto + Liberation + Carlito/Caladea，不内置 CJK 商业字体（章程 Q19，待用户）；字体目录可配置（集成方提供商用字体），缺失字体按 OF-05 回退并在导出报告中列出。
  - 插件贡献的导出专用 `core.format`（`canImport:false`，如 Markdown）在服务端同样可用（PS-14）。

### SV-03 快照与 update 持久化

- 优先级：P0 | 目标里程碑：M3 | 依赖能力：`server-collab`（update 追加、快照压缩）、ADR-0022 存储、`Snapshot`、`migrations`
- 用户故事：作为管理员，我希望任何时刻服务器宕机都不会丢失用户已同步的编辑，并且历史版本可追溯。
- 验收标准：
  - 每条被服务端接受的 CRDT update 在返回 ack 前持久化（追加表/日志）；RPO ≤ 1 s（已 ack 的 update 不丢）。
  - 压缩（Compaction）：按策略（章程 Q17 默认：每 500 个 update 或 10 分钟）把 update 折叠为新的快照并保留 update 尾巴用于重连；压缩 10,000 update ≤ 2 s。
  - 版本（CO-07）与保留（章程 Q17，待用户）：自动版本 = 压缩点的快照 + 元数据（贡献者集合、时间），保留 30 天；命名版本 = 用户触发的快照，永久；update 追加表保留 7 天（压缩后）；导入原件保留 30 天；过期清理为后台作业。不透明保留所需的部件 Blob 随文档生命周期保留，不在此列。
  - 新客户端加入：下发最新快照 + 尾巴 update；D50 初始同步 ≤ 2 s、D200 ≤ 5 s（p75）。
  - 迁移：服务端启动时对旧 `schemaVersion` 的快照惰性迁移（读取时），并可运行「全量迁移」作业；迁移失败的文档标记并告警，不影响其它文档。
  - 一致性：多实例场景下同一文档的 update 顺序由 CRDT 保证，持久化只需「至少一次」；重复 update 幂等。

### SV-04 缩略图服务

- 优先级：P0 | 目标里程碑：M3 前半段（章程 Q8 v0.2） | 依赖能力：`server-headless` 的 headless Chromium 适配（ADR-0026）、`RenderTarget`
- 验收标准：
  - 文档首页缩略图（文档列表卡片）：导入完成后 ≤ 10 s 可用；编辑后按页脏标记异步刷新（≤ 60 s）；每页缩略图 400 px 宽 WebP，缓存于 blob 存储，键含 `documentId + pageId + contentHash`。
  - 全页缩略图（版本预览、分享预览）：按需生成，D200 ≤ 90 s。
  - 并发与隔离：Chromium 进程池（默认 2/实例），单页超时 10 s，失败重试 1 次后返回占位图并上报。
  - M1/M2 由客户端生成（OF-15）；M3 起客户端上传缩略图为可选优化。

### SV-05 协同网关

- 优先级：P0 | 目标里程碑：M3 | 依赖能力：`server-collab`（房间、awareness 广播、跨实例 pub/sub）、`protocol`（WS 帧、握手）、Redis
- 验收标准：
  - 房间生命周期：首个连接创建、最后一个连接离开后延迟 60 s 销毁（期间保留内存状态以应对快速重连）；房间状态可查询（管理 API）。
  - 握手：令牌校验（EM-03）、文档能力位加载、容量检查（20 编辑者 + 50 查看者，超限只读加入，再超 → `collab.room_full`，关闭码 4503）、协议版本协商（不兼容 → `collab/auth-failed{code: collab.protocol_mismatch}`，关闭码 4427）。
  - 门禁：硬门禁（应用前）与软门禁（应用后，ADR-0034：`softGate.mode = repair`、`schemaMode = report-only`）的行为与用户可见结果见 CO-12。
  - 权限即时性：权限变更事件（来自 Documents 模块或集成方回调）在 ≤ 2 s 内推送到房间内该用户的所有连接，降级为只读或断开。
  - 消息限制：单消息 ≤ 1 MB；速率 ≤ 200 msg/s/连接；awareness 广播节流 ≥ 50 ms；超限限流并记录。
  - 多实例：同一文档的连接可落在不同实例，通过 Redis pub/sub 转发 update 与 awareness；跨实例传播 ≤ 50 ms（同机房）。
  - 容量（单实例 2 vCPU / 4 GB）：≥ 2,000 并发 WS、≥ 200 活跃房间（**以 D50 级文档 ≈ 12 MB/房间为前提**；D200 级 ≈ 40 MB/房间时按内存折减，RSS > 75% 时新房间转由其它实例服务，架构 08）、p95 广播延迟 ≤ 100 ms、CPU < 70%。
  - 优雅停机：收到 SIGTERM 后停止接受新连接、通知客户端重连（`collab/reconnect{reason:"server-shutdown"}`）、flush 持久化、≤ 30 s 退出；客户端在 ≤ 5 s 内重连到其它实例。

### SV-06 鉴权、租户与权限

- 优先级：P0 | 目标里程碑：M3 | 依赖能力：`apps/server` Auth 模块、`protocol` 权限模型（能力位，无 `enum`，规避 Univer A3）
- 验收标准：
  - 模式：OIDC（授权码 + PKCE，用于 `apps/web`）与「集成方签名 JWT」（用于嵌入）；JWKS 轮换支持。
  - 多租户：所有资源带 `tenantId`；跨租户访问 100% 拒绝（安全测试用例）；租户级配置（配额、保留策略、字体目录、存储桶）。
  - 文档权限：角色 → 能力位（CO §1）；管理 API：授予/撤销/列出；分享链接（P1，参考应用）：可设角色与过期。
  - fail-closed：未知能力位、缺 claim、过期令牌一律拒绝；权限检查覆盖 REST 与 WS 两处（架构 05/08）。
  - 服务间：API Key（scoped，可轮换）用于集成方后端调用导入/导出/管理 API。

### SV-07 审计

- 优先级：P0 | 目标里程碑：M3 | 依赖能力：`commands` 管线 `waterfall` 审计检查点（章程 D12/K1）、Audit 模块
- 用户故事：作为管理员，我需要回答「谁在什么时候对哪个文档做了什么」，以满足合规与排查。
- 验收标准：
  - 事件类别：访问（打开/加入房间/导出/下载）、编辑（`Transaction` 摘要：命令 id、影响页与元素数，不含内容）、评论（增删改解决）、权限（授予/撤销/变更）、版本（创建/恢复）、管理（删除/配额变更）、安全（鉴权失败、限流、越权尝试、硬门禁拒绝 `collab.update_rejected`、软门禁修复 `collab.repaired`，ADR-0034）。
  - 每条：时间（服务端）、租户、文档、主体（用户 id / API key id）、来源 IP（可配置脱敏）、客户端版本、结果。
  - 保留：默认 365 天（可配）；导出 CSV/JSON（按租户、时间范围、类别）；不可篡改（追加写，P1：哈希链）。
  - 编辑审计吞吐：每文档 ≤ 50 事务/s 时无背压；超出时按事务合并（每用户每秒一条汇总）。

### SV-08 配额与限制

- 优先级：P0 | 目标里程碑：M3 | 依赖能力：租户配置、网关容量检查、导入限制
- 验收标准（默认值，租户级可调；PD-17）：

| 维度 | 默认上限 | 超限行为 |
|---|---|---|
| 单文件大小（含媒体） | 200 MB（Q5） | 导入拒绝 `tenant.quota_exceeded{dimension:"file_size"}`（413/429） |
| 单文档页数 | 200（Q5）；软警告 150 | 超软警告提示；超硬上限拒绝新增页 `tenant.quota_exceeded{dimension:"pages"}` |
| 单页元素数 | 1,000 | 拒绝新增元素并提示 |
| 每文档并发编辑者 | 20 | 新加入者只读 |
| 每文档并发查看者 | 50（Q5） | 拒绝加入 `collab.room_full`（503 / 4503） |
| 评论线程 / 文档 | 5,000 | 拒绝新增 |
| 版本数 / 文档（命名） | 200 | 提示删除旧版本 |
| 租户存储 | 由集成方设置 | 导入/插入媒体拒绝 |
| 导入/导出作业速率 | 60/分钟/租户 | 429 + `Retry-After` |
| REST API 速率 | 600/分钟/API key | 429 |
| WS 消息速率 | 200/s/连接 | 限流 + 计数 |
| 资源上传单文件 | 100 MB | 拒绝 |

  - 所有配额有读取点（规避 Univer A26）与测试；配额用量可查询（管理 API 与管理面板）。

### SV-09 部署与运维

- 优先级：P0 | 目标里程碑：M3 | 依赖能力：`apps/server` 配置 schema、健康探针、迁移脚本、ADR-0022
- 验收标准：
  - 部署形态：docker-compose（Nest + Postgres + Redis + MinIO + headless Chromium sidecar）一条命令启动（Q10）；K8s Helm chart 为 M4+（P2），但 M3 的实例已无状态（除内存房间缓存）。
  - 配置：全部环境变量经 Standard Schema 校验，启动失败即打印字段路径；密钥仅从环境/密钥管理器读取；`--dry-run` 校验配置。
  - 探针：`/healthz`（进程存活）、`/readyz`（DB/Redis/Blob 可达 + 迁移已应用）；就绪前不接流量。
  - 数据库迁移：版本化、幂等、可回滚一步；启动时检查未应用迁移并（可选）自动应用。
  - 备份/恢复：文档基线包与 blob 在对象存储（依赖其版本化/复制）；Postgres 定时逻辑备份 + WAL（RPO ≤ 1 min、RTO ≤ 15 min 的操作手册）；演练脚本可从备份恢复一个租户并通过导出校验。
  - 零停机发布：滚动更新 + 优雅停机（SV-05）；协议版本向后兼容一个次版本。
  - 日志：结构化 JSON，含 `requestId`/`tenantId`/`documentId`/`userId`（可脱敏）；级别可调；不记录文档内容。
  - 运维手册：容量规划（每 1,000 并发编辑者所需实例）、常见故障（Redis 断连、Chromium 僵尸进程、磁盘满）、升级步骤。

### SV-10 监控与告警

- 优先级：P0 | 目标里程碑：M3 | 依赖能力：`telemetry` 服务（服务端 Provider：Prometheus/OTel）、`logger`
- 验收标准：
  - 指标（Prometheus 命名草案）：`oce_ws_connections`、`oce_rooms_active`、`oce_update_apply_seconds`（直方图）、`oce_broadcast_latency_seconds`、`oce_import_duration_seconds`、`oce_export_duration_seconds`、`oce_thumbnail_duration_seconds`、`oce_job_queue_depth`、`oce_persist_lag_seconds`、`oce_auth_failures_total`、`oce_rate_limited_total`、`oce_collab_soft_conflicts_total{type}`、`oce_collab_updates_rejected_total{reason}`、`oce_collab_repairs_total{rule}`、`oce_permission_denied_total{action}`、`oce_plugin_failures_total`、进程/DB/Redis 标准指标（命名与架构 10 §11.3 一致）。
  - SLO（初始）：协同服务可用性 99.9%/月；广播延迟 p95 ≤ 100 ms；导入成功率 ≥ 99.5%；导出成功率 ≥ 99.5%；持久化滞后 p99 ≤ 1 s。
  - 告警（默认规则随 compose 提供）：就绪探针失败 > 1 min；p95 广播延迟 > 300 ms 持续 5 min；队列深度 > 100 持续 5 min；鉴权失败突增（> 10× 基线）；磁盘 > 85%；Chromium 池耗尽。
  - 仪表盘模板（Grafana JSON）：总览、协同、作业、安全。
  - 追踪：导入/导出/握手链路 OTel trace（采样可配）。

### SV-11 数据保留、删除与合规

- 优先级：P1 | 目标里程碑：M3 | 依赖能力：Documents 模块、后台作业
- 验收标准：文档软删除（默认 30 天可恢复）→ 硬删除（快照、update、版本、评论、缩略图、blob、索引全部清除，审计保留）；用户数据擦除 API（GDPR：用 `deleted-user` 替换主体标识，评论正文按租户策略保留/删除）；数据驻留：存储与数据库位置由部署决定，SDK 无隐式跨区调用；导出租户全部数据（P2）。

### SV-12 服务端安全

- 优先级：P0 | 目标里程碑：M3 | 依赖能力：OF-24 输入限制、`protocol` schema、Nest 守卫
- 验收标准：全部输入 schema 校验（REST/WS/文件）；zip 与 XML 限制同客户端；WS Origin 校验与令牌绑定；CSRF 对 cookie 会话防护；速率限制（SV-08）；TLS 终止在代理层，内部可选 mTLS；密钥轮换不停机；依赖漏洞门禁（高危阻断）；渗透测试清单（OWASP ASVS L2）作为 M3 出口条件之一；安全事件进入审计。

### SV-13 Headless 自动化 API

- 优先级：P1 | 目标里程碑：M3 | 依赖能力：`server-headless`、`commands`（模板填充命令）、作业队列
- 用户故事：作为集成方后端，我希望调用 API 把模板中的占位符批量替换为业务数据并导出 pptx/PDF。
- 验收标准：作业类型：`fill-template`（按占位符类型/名称替换文本/图片/表格数据）、`convert`（pptx → pdf/png/markdown）、`validate`（结构校验 + 保真诊断报告）、`migrate`（快照迁移）；幂等键；批量 100 份 D50 填充 + 导出 ≤ 60 s（4 worker）；结果回调（webhook，签名，P1）。

### SV-14 管理面板（参考应用）

- 优先级：P2 | 目标里程碑：M4 | 依赖能力：`apps/web` 管理路由（组装层）
- 验收标准：租户配额与用量、房间列表与强制断开、作业队列、审计查询、插件清单（服务端加载的 `iso` 插件及版本）、健康状态。

### SV-15 Webhook 与事件出口

- 优先级：P2 | 目标里程碑：M4 | 依赖能力：Documents/Audit 模块事件
- 验收标准：文档事件（创建/更新/删除/导出完成/评论/权限）以签名 webhook 推送；重试退避 ≤ 24 h；事件 schema 版本化。

---

## 3. 运维 / 管理员用户故事汇总

| 编号 | 故事 | 对应需求 |
|---|---|---|
| US-O-01 | 我要一条命令把整套服务在测试环境跑起来 | SV-09 |
| US-O-02 | 我要知道现在有多少人在协同、延迟多少 | SV-10 |
| US-O-03 | 服务器重启后不能丢用户已同步的编辑 | SV-03 |
| US-O-04 | 我要限制某租户最多 50 GB、每文档 200 页 | SV-08 |
| US-O-05 | 合规要我拿出某文档过去一年的操作记录 | SV-07 |
| US-O-06 | 用户申请删除个人数据 | SV-11 |
| US-O-07 | 我要滚动升级而用户无感 | SV-05、SV-09 |
| US-O-08 | 安全团队要审计所有越权尝试 | SV-07、SV-12 |

---

## 4. 与其它域的接口

| 本域产出 | 消费方 |
|---|---|
| 作业 API（导入/导出/缩略图/填充） | EM-10 服务端集成；OF-19 服务端 PDF |
| 配额表 | NF-01 容量；README 待决 PD-17 |
| 指标与 SLO | `06-metrics-and-analytics.md` 健康指标 |
| 权限即时性 ≤ 2 s | CO-05；ADR-0023 |
