> 状态：草稿 v0.1 | 负责：架构-模块（阶段二） | 更新：2026-09-21 | 依赖：00-module-map.md M-12 行/§1/§3 BC-18…27/§4.2/§5.3/§6.1/§7/§9；40-modules/08-server-identity-documents-and-storage.md §2.4/§2.5/§3/§7/§12 G-11；40-modules/09-server-collab-gateway-and-headless-host.md §2.1/§2.5/§3/§4/§6/§7/§12 G-19–22；40-modules/02-kernel-protocol-and-document-core.md §4.3/§5.3；40-modules/04-ooxml-format-and-pptx-codec.md §2.6；30-architecture/08-backend-nestjs.md §1/§2/§5/§7/§9.3/§10/§12/§16.1–16.6；30-architecture/10-observability-and-errors.md 全篇；PRD 10-prd/03-features/06-server-and-ops.md SV-01/02/04/07/08/09/10/13；PRD 10-prd/03-features/03-collaboration.md CO-04；ADR-0026/0030/0031

# 12 服务端作业、评论与运维（限界上下文 BC-23 导入导出与作业编排、BC-24 缩略图、BC-25 评论、BC-26 审计与健康运维、BC-30 出站集成〔Webhook〕）

## 0. 一页总览

| 项 | 值 |
|---|---|
| 职责一句话 | 导入/导出作业编排与 BullMQ 基础设施（BC-23）；缩略图/PDF 渲染作业（BC-24）；评论镜像读模型与通知扇出（BC-25）；审计只追加记录、健康探针、指标与内部运维端点（BC-26）——实际格式转换/CRDT/渲染全部委托 M-09，本模块只做编排、校验、审计与限流 |
| 覆盖的上下文 | BC-23 导入导出与作业编排、BC-24 缩略图、BC-25 评论、BC-26 审计与健康运维、BC-30 出站集成（Webhook，2026-09-21 新增登记，此前寄生于 BC-25，rulings §4.13 S-5） |
| 承载包 / 目录 | `apps/server/src/modules/{import-export,jobs,thumbnails,comments,audit,health,metrics,internal,webhooks}`（`webhooks` 为新增，rulings §4.12 U-14）、`apps/server/src/common/*`、`apps/server/src/config/*`（均 L8 · node · app，秩 80）；`apps/server/src/cordis-host/adapters/*` **只引用、新增 0 个文件**（物理归属 M-09，2026-09-18 跨模块评审 C-10 结案，见 §12 G-23） |
| cordis 形态 | library（9 个 Nest 模块 + `common/`/`config/` 全部纯 Nest DI，非 cordis Fiber，module-map §4.2 第 5 条；`webhooks` 为新增，rulings §4.12 U-14） |
| 运行位置 | 服务端 |
| 上游（依赖） | M-08（`DocumentRepository`、`DocumentRoleGuard`/`RoleResolverService`、`SessionGuard`、`ctx.blobStore` 读取面）、M-09（`server-headless.{importPptx,exportPptx,validateSnapshotTask,migrateTask,diffSnapshots,HeadlessJobContext}`、`ThumbnailRenderer`、`collabServer`/`Room.broadcastControl`、`CordisHostService.diagnostics()`） |
| 下游（被依赖） | 无（终端模块，module-map §7 M-12 行） |
| 对外服务 | 无 cordis 服务（全部 REST + BullMQ 处理器） |
| 贡献点 | 提供：无；消费：无 |
| Nest 侧导出（非 cordis 贡献点） | `common/` 的 `@Audited()`/`@RateLimit()` 装饰器 + 解释器（供 M-08 controller 标注使用，M-08 §1.3 已记录为反向消费）；`JobRunsRepository`/`GetJobUseCase`（`jobs` 模块导出，供 `import-export`/`thumbnails` 复用） |
| doc / sheet 通用性 | BC-23/24 parametrized（导入导出按 `DocumentType` 分派 M-09 编解码任务、缩略图渲染页路由）；BC-25/26/30 generic（回应 module-map §10 Q-M4：本文档把 BC-25 从 module-map §6.1 的暂定 `parametrized` 改判为 `generic`，理由见 §8/§12 G-27；BC-30 投递骨架对事件来源文档类型无知，同判 `generic`，见 §12 G-34） |
| 批次 | 3 |

### 0.1 图示

**图 0-1 模块内 Nest 模块与上下游关系**

```mermaid
flowchart LR
subgraph up["上游"]
  m08["M-08 身份文档与存储"]
  m09["M-09 协同网关与Headless宿主"]
end
subgraph mod["M-12 服务端作业评论与运维"]
  jobsMod["jobs / import-export / thumbnails"]
  commentsMod["comments"]
  opsMod["audit / health / metrics / internal"]
end
m08 -- "DocumentRepository、DocumentRoleGuard、ctx.blobStore" --> jobsMod
m09 -- "HeadlessJobContext、ThumbnailRenderer" --> jobsMod
m09 -- "collabServer Room广播" --> commentsMod
m08 -- "SessionGuard、RoleResolverService" --> commentsMod
m09 -- "CordisHostService.diagnostics" --> opsMod
```

图怎么读：本模块是终端模块（无下游），全部能力都是编排 M-08/M-09 已有服务；三组内部模块分别对应作业类、评论镜像与运维三块职责。

## 1. 限界上下文与边界

### 1.1 职责与非职责

**BC-23 导入导出与作业编排**
- 做：导入 REST（预签名直传 ≥10 MB 分片 / multipart ≤10 MB）+ BullMQ `import` 处理器编排（拉取原件 → 调用 M-09 `importPptx` → 写快照 `kind='import'` + 媒体关联 → 创建/更新文档 → 审计）；导出 REST + BullMQ `export` 处理器编排（最新/指定快照 → 调用 M-09 `exportPptx` → `BlobStore` → 预签名下载 URL）；进度查询、失败重试、幂等键应用；PDF/PNG/JPEG 导出受理后委托 BC-24 的 Chromium 池处理（§7）。
- 不做：不做 OOXML 编解码本身与 SV-02 字节级一致性的算法保证（M-04/M-09 的 `ooxml-pptx.encode` 纯函数）；不做 BullMQ 通用队列/重试/死信基础设施（本 BC 内 `jobs` 子模块承担）。

**BC-24 缩略图**
- 做：缩略图 REST（按版本/页查询，ETag/immutable 缓存头）+ BullMQ `thumbnails`/`render-export` 处理器；调用 M-09 `ThumbnailRenderer.render()`/`.renderPdf()`；按 `layoutAlgoVersion` + 字体 profile 的缓存键与失效判定；按 `DocumentType` 参数化的渲染页路由透传。
- 不做：不做 Chromium 进程池管理本身（`browser-pool.ts` 在 M-09 `server-headless`）；不做实际像素渲染（M-06/M-07/M-11 的 `/render` 路由）。

**BC-25 评论**
- 做：观察 M-09 `collabServer` 的 Room 广播（`CONTROL.event{comments.changed}`）后 upsert 只读镜像表；线程列表/详情/@我 REST 查询；@提及解析与通知扇出（跨文档索引、审计、预留 webhook 钩子）；镜像层对 5,000 字符/线程、5,000 线程/文档、500 回复/线程上限的只读展示口径校验；「导入为可编辑线程」（P1）触发的服务端 CRDT 事务编排。
- 不做：不持有评论事实数据（事实源是 Snapshot 内 `resources.comments.*`，ADR-0031 v0.2）；不执行评论写入的作者级权限判定（M-09 软门禁，ADR-0034）；不提供评论 CRUD 的 REST 写路径（客户端经协同 WS 命令直写 CRDT，本模块 controller 除「导入为可编辑线程」外全部只读）。

**BC-26 审计与健康运维**
- 做：`audit_log` 只追加写入（AOP `@Audited()` 拦截器 + 事件订阅两条通路）、按租户/时间范围/类别查询与导出；`/healthz`/`/readyz` 探针（pg/redis/s3/headless 宿主/RoomManager draining）；`/metrics` Prometheus 端点；`/internal/*` 诊断与管理端点；`common/*` 的异常过滤器/审计拦截器/限流解释器/日志字段；`config/*` 的环境变量 Standard Schema。
- 不做：不做鉴权/租户策略本身（M-08）；不做协同门禁/CRDT 修复（M-09）；不物理定义 `cordis-host/adapters/{pino-logger,otel-telemetry,errors-reporter}`（已由 M-09 完整定义并物理归属该模块，见 §12 G-23）。

**BC-30 出站集成（Webhook）**（2026-09-21 新增登记，此前寄生于 BC-25，rulings §4.13 S-5）
- 做：Webhook 订阅管理（注册/更新/删除/查询，租户管理员）；事件投递（HMAC 签名 + 指数退避重试 + 死信队列）；投递前出站地址校验（拒绝私网/回环/链路本地/云元数据端点，防 DNS 重绑定，rulings §4.13 S-4）；投递日志查询。
- 不做：不产生事件本身（事件源是 `comments` 的镜像变更，未来 M4 扩大到文档事件）；不做入站 Webhook 接收（本上下文只出站）；不做通用消息总线（只服务"事件→HTTP 回调"这一种投递形态）。

### 1.2 通用语言

| 术语 | 定义 | 所在文件 |
|---|---|---|
| `JobRun` | 跨域通用作业记录（`job_runs` 一行）：`kind/docId/status/attempts/errorCode/payload/result` | `jobs/domain/job-run.ts` |
| `IdempotencyKey` | 幂等键，约定 `<域>:<docId>:<inputHash>`，同键重复入队直接返回既有 `JobRun` | `jobs/domain/idempotency-key.ts` |
| `ImportJob`/`ExportJob` | `JobRun` 的导入/导出特化视图（`kind='import'\|'export'`），携带保真报告/下载 URL | `import-export/domain/{import-job,export-job}.ts` |
| `Thumbnail` | `doc_id+slide_id+snapshot_seq` 的渲染产物元数据 | `thumbnails/domain/thumbnail.ts` |
| `ThumbnailKey` | 缓存键值对象：`{docId,slideId,snapshotSeq,layoutAlgoVersion,fontProfile}` | `thumbnails/domain/thumbnail-key.ts` |
| `CommentThread`（镜像） | `comments` 表一行的读模型投影，非事实源 | `comments/domain/comment-thread.ts` |
| `Anchor`（镜像） | `{slideId,shapeId?,range?,snapshotSeq}`，服务端只校验格式不解码 CRDT（ADR-0031 §2） | `comments/domain/anchor.ts` |
| `AuditEntry` | `audit_log` 一行：`actorType/action/targetType/docId/details` | `audit/domain/audit-entry.ts` |
| `RetentionPolicy` | 审计/导入原件/缩略图各自的保留期判定（SV-07/SV-11） | `audit/domain/retention-policy.ts` |
| `HealthProbe` | 单项依赖探针结果：`{name,status,latencyMs,details?}` | `health/domain/probe-result.ts` |
| `RenderStateToken` | 一次性 token，渲染页凭它换取快照字节 | `internal/domain/render-state-token.ts` |

### 1.3 上下文映射

| 上游 | 下游 | 关系类型 | 防腐层落点 | 传递的契约 |
|---|---|---|---|---|
| 模块外 BC-03 协议（M-02） | BC-23/24/25/26 | Published Language | 各 `*.controller.ts` 的 `@Body()`/`@Query()` | `z.infer` DTO、错误码、`ErrorEnvelope` |
| 模块外 BC-19（M-08） | BC-23 | Customer–Supplier | `import-export/infrastructure/source-file.accessor.ts` | `DocumentRepository`（创建/更新目录条目） |
| 模块外 BC-18/19（M-08） | BC-23/24/25/26 全部 controller | Customer–Supplier（Open Host Service，DI `exports`） | 各 `interface/*.controller.ts` | `SessionGuard`/`DocumentRoleGuard`/`RoleResolverService` |
| 模块外 BC-27（M-09 `server-headless`） | BC-23/24 | Customer–Supplier（Conformist：只调用不重实现，铁律 4） | `import-export/infrastructure/{import,export}.processor.ts`、`thumbnails/infrastructure/*.processor.ts` | `HeadlessJobContext`、`importPptx`/`exportPptx`/`ThumbnailRenderer` |
| 模块外 BC-21（M-09 `server-collab`） | BC-25 | Customer–Supplier | `comments/infrastructure/comment-mirror.observer.ts` | `CONTROL.event{comments.changed}` |
| 模块外 BC-20（M-08 `server-storage`） | BC-23/24 | Open Host Service（`ctx.blobStore`） | `import-export/infrastructure/source-file.accessor.ts`、`thumbnails/infrastructure/thumbnails.repository.ts` | `ServerBlobStore` |
| BC-26（`common/`） | 模块外 BC-18/19/20（M-08）、BC-21/22（M-09） | Open Host Service（反向：本模块是被消费方） | `common/decorators/{audited,rate-limit}.decorator.ts` | 审计记录契约、限流策略 |
| BC-26（事件订阅） | 模块外 BC-01/05/21（kernel/M-02/M-09） | ACL（cordis 事件 → `audit_log` 行） | `audit/infrastructure/audit-event.subscriber.ts` | `command/audited`、`plugin/failed`、`collab-server/repair`、`permission/denied` |
| BC-23（`jobs` 子模块） | BC-23（`import-export`）、BC-24（`thumbnails`） | Shared Kernel（模块内） | `jobs/infrastructure/{queues,base.processor,job-runs.repository}.ts` | `JobRun`、`IdempotencyKey`、BullMQ 队列注册表 |
| BC-25（`comments`） | BC-30（`webhooks`，2026-09-21 新增，rulings §4.13 S-5） | Customer–Supplier（模块内，评论镜像变更触发投递） | `comments/application/mirror-comment-change.usecase.ts` | `DeliverWebhookEventUseCase.enqueue(tenantId,event,payload)` |

命名冲突处理：错误码沿用 10-observability-and-errors §1.1 的 `<domain>.<snake_case_name>` 格式；本模块新增 domain：`server.import`/`server.export`/`server.thumbnails`/`server.comments`/`server.audit`（该文档 §1.1 domain 清单原未列出，标"新增建议"，§12 G-24）；`server.jobs` 沿用既有清单。**审计 `action` 口径（2026-09-18，跨模块评审 C-24）**：本模块 `@Audited(action)` 标注一律使用点式串（`import.created`/`export.created`/`comment.import-as-editable`/`admin.compact` 等），与 M-08 §2.4 的六个记账域同口径，不使用 `<域>/<动作>` 事件形式（见 §2.4 通路②）。

## 2. 领域模型

> 本模块九个 Nest 模块（含新增 `webhooks`，rulings §4.12 U-14）均非 cordis 插件（library，module-map §3 BC-23/24/25/26/30 行"cordis 形态：library"，BC-30 为 2026-09-21 新增登记），下列"聚合/实体/仓储"均为普通 Nest `@Injectable`/Drizzle 类型，非 cordis Definition/Provider——与 M-08 §2 的裁定一致（08 §2.5 前言）。

### 2.1 聚合与实体

| 聚合 / 实体 | 字段 / 持有 | 不变量 / 并发语义 | 所在文件 |
|---|---|---|---|
| `JobRun`（聚合根，跨域通用） | `id,tenantId,kind,docId?,status,attempts,errorCode?,payload,result?,queuedAt,startedAt?,finishedAt?` | `status` 只能沿 `queued→running→succeeded\|failed` 迁移（`canTransitionJobStatus`）；同 `IdempotencyKey` 的重复创建请求直接返回既有行，不新建 | `jobs/domain/job-run.ts` |
| `ImportJob`（`JobRun` 特化视图，`kind='import'`） | `+ sourceKey,fidelityReport,createdDocId?` | `succeeded` 态必然存在对应 `document_snapshots(kind='import')` 行且 `baselineKey` 非空（09 §12 G-16） | `import-export/domain/import-job.ts` |
| `ExportJob`（`JobRun` 特化视图，`kind='export'`） | `+ format:'pptx'\|'pdf'\|'png'\|'jpeg',snapshotSeq,downloadUrl?,expiresAt?` | `format='pptx'` 时必须字节级可复现（SV-02，由 M-09 纯函数保证，本模块只搬运结果）；非 `pptx` 转发至 `thumbnails` 模块的 `render-export` 队列（§7） | `import-export/domain/export-job.ts` |
| `Thumbnail`（聚合，`thumbnails` 表一行） | `docId,slideId,snapshotSeq,layoutAlgoVersion,storageKey,width,height,contentHash` | 联合主键 `(docId,slideId)` 只保留最新 `snapshotSeq` 一行；旧版本对象由 blob 生命周期规则清理，行本身被覆盖（ADR-0026 决策 5） | `thumbnails/domain/thumbnail.ts` |
| `CommentThread`（读模型聚合，`comments` 表一行） | `id,docId,threadId,parentId?,authorId,body,anchor,anchorKey,anchorState,resolvedAt?,resolvedBy?,createdAt,editedAt?,deletedAt?`（`anchorKey` 为新增生成列，§3.9 回执） | 只由 `comment-mirror.observer.ts` 写入；REST 层除「导入为可编辑线程」外不可变更任何行（事实源在客户端 CRDT，ADR-0031 v0.2）；`anchorKey` 由 `deriveAnchorKey(anchor)`（§2.3）按判别式提取，索引建在 `anchorKey` 而非具体字段名，doc/sheet 新锚点变体零改动 | `comments/domain/comment-thread.ts` |
| `AuditEntry`（聚合，`audit_log` 一行，只追加） | `id,tenantId,actorType,actorId?,action,targetType,targetId,docId?,sessionId?,requestId,ipHash?,userAgentHash?,details,createdAt,prevHash,hash`（`prevHash`/`hash` 为新增，rulings §4.12 U-15） | 数据库角色对 `audit_log` 无 `UPDATE`/`DELETE` 权限（数据库层强制，非仅应用层约定，SV-07）；按月分区；`hash = chainHash(prevHash, entry)` 形成链式校验，任一历史行被篡改则后续校验失败（M3 即实现，见 §2.3/§2.6） | `audit/domain/audit-entry.ts` |
| `WebhookSubscription`（聚合根，新增，rulings §4.12 U-14） | `id,tenantId,targetUrl,eventFilter,signingSecretHash,status:'active'\|'disabled'` | `targetUrl` 必须 `https://`（生产环境）；`signingSecretHash` 落库只存 hash，明文只在创建响应出现一次；`status='disabled'` 时投递直接跳过（不入队）；创建/更新时经 `egress-guard.ts` 尽力校验非私网/回环/链路本地/云元数据地址，关键防线在每次投递前重新校验（S-4/§3.8 回执，rulings §4.13） | `webhooks/domain/webhook-subscription.ts` |
| `WebhookDelivery`（实体，隶属 WebhookSubscription，新增，rulings §4.12 U-14） | `id,subscriptionId,event,payloadHash,attempt,status:'pending'\|'succeeded'\|'failed'\|'dead-lettered',responseCode?,deliveredAt?` | `attempt` 递增触发指数退避重试；超过最大重试次数后转 `dead-lettered`，不再自动重试 | `webhooks/domain/webhook-delivery.ts` |

### 2.2 值对象

| 名称 | 字段 / 校验 | 所在文件 |
|---|---|---|
| `JobStatus` | `'queued'\|'running'\|'succeeded'\|'failed'`（字面量联合，非 enum） | `jobs/domain/job-status.ts` |
| `IdempotencyKey` | `Brand<string,'IdempotencyKey'>`，格式 `` `${domain}:${docId}:${inputHash}` `` | `jobs/domain/idempotency-key.ts` |
| `FidelityReportSummary` | `{degradedParts:string[],missingFonts:string[],limitHits:LimitHit[]}`，服务端对 M-04 `ooxml-pptx/testing` `PartDiff[]` 的投影（04 §2.6） | `import-export/domain/import-job.ts` |
| `ThumbnailKey` | `{docId,slideId,snapshotSeq,layoutAlgoVersion,fontProfile}` → 缓存/去重键字符串 | `thumbnails/domain/thumbnail-key.ts` |
| `RenderRoute` | 按 `DocumentType` 参数化的渲染页查询参数 `{documentType,mode:'thumbnail'\|'print'}`（BC-24 唯一的参数化落点，§8） | `thumbnails/domain/thumbnail-key.ts`（与 `ThumbnailKey` 同文件） |
| `Anchor`（镜像） | `{slideId,shapeId?,range?:{anchor:string,head:string},snapshotSeq}`；服务端只校验 zod 形状，不解码 `RelativePosition`（ADR-0031 §2） | `comments/domain/anchor.ts` |
| `CommentLimits` | `{maxBodyChars:5000,maxThreadsPerDoc:5000,maxRepliesPerThread:500}`（CO-04/SV-08） | `comments/domain/comment-limits.ts` |
| `RetentionPolicy` | `{auditDays:365,importSourceDays:30,exportDays:1,thumbnailStale:'on-invalidate'}`（SV-07/SV-11/16.5，租户可调） | `audit/domain/retention-policy.ts` |
| `RenderStateToken` | `{token,docId,seq,expiresAt,consumed:boolean}`，一次性、TTL 60 s | `internal/domain/render-state-token.ts` |

### 2.3 领域服务（纯函数）

| 函数 | 签名草案 | 所在文件 | 两端共用 |
|---|---|---|---|
| `buildIdempotencyKey` | `(domain:string,docId:string,inputHash:string) => IdempotencyKey` | `jobs/domain/idempotency-key.ts` | 否（服务端专属） |
| `canTransitionJobStatus` | `(from:JobStatus,to:JobStatus) => boolean` | `jobs/domain/job-status.ts` | 否 |
| `buildThumbnailKey` / `shouldInvalidateThumbnail` | `(params) => ThumbnailKey`；`(existing:Thumbnail,incoming:{seq,algoVersion}) => boolean` | `thumbnails/domain/thumbnail-key.ts` | 否 |
| `extractMentionTokens` | `(body:string) => string[]`（纯文本扫描 `@[a-zA-Z0-9_-]+` token，不做用户目录解析） | `comments/infrastructure/mention-parser.ts` | 否（用户目录解析需 M-08 用户仓储，属应用层） |
| `checkCommentLimits` | `(body:string,threadCount:number,replyCount:number,limits:CommentLimits) => Result<void,'body_too_long'\|'thread_limit'\|'reply_limit'>` | `comments/domain/comment-limits.ts` | 否（镜像层只读展示口径，写路径硬校验在客户端 + M-09 软门禁，ADR-0031 §2） |
| `deriveAnchorKey`（新增，§3.9 回执） | `(anchor:Anchor) => string`（纯函数：按 `Anchor` 判别式提取扁平索引键，如 slide 变体取 `slideId`，不依赖具体字段名；未来 doc/sheet 变体各自的判别分支产出各自的键） | `comments/domain/anchor.ts` | 否 |
| `isBlockedEgressAddress`（新增，S-4/§3.8 回执） | `(ip:string) => boolean`（纯函数：判定 RFC1918 私网段 / 回环 / 链路本地（含 `169.254.169.254` 云元数据端点）/ 其它保留地址；只做地址段判定，不做 DNS 解析） | `webhooks/infrastructure/egress-guard.ts` | 否 |
| `isOrphanedQueueRow`（新增，§3.5 回执） | `(row:{status:string,queuedAt:Date},now:Date,timeoutMs:number) => boolean`（纯函数：判定 `job_runs`/`webhook_deliveries` 行是否 `status='queued'\|'pending'` 且 `now - queuedAt` 超过阈值（2× 处理器超时），供 `reconciliation.job.ts` 逐行调用后决定是否重新入队） | `jobs/infrastructure/reconciliation.job.ts` | 否 |
| `shouldRetainAuditRow` | `(entry:AuditEntry,policy:RetentionPolicy,now:Date) => boolean` | `audit/domain/retention-policy.ts` | 否 |
| `chainHash`（新增，rulings §4.12 U-15） | `(prevHash:string\|null,entry:Omit<AuditEntry,'hash'\|'prevHash'>) => string`（sha256 摘要，纯函数） | `audit/domain/audit-chain.ts` | 否 |
| `evaluateReadiness` | `(probes:readonly HealthProbe[]) => {status:'ok'\|'degraded'\|'down',failing:string[]}` | `health/application/evaluate-readiness.usecase.ts` | 否 |

### 2.4 领域事件

本模块九个 Nest 模块均非 cordis 插件（library），"领域事件"经三条互不相同的通路进入本模块，不可混同：

| 通路 | 事件 / 载荷 | 来源 | 消费者文件 |
|---|---|---|---|
| ① cordis 事件订阅（经共享宿主 `ctx.on`） | `command/audited`（服务端 `principal='system'` 执行命令时）、`plugin/failed`、`permission/denied` | M-02 命令管线、kernel（BC-01） | `audit/infrastructure/audit-event.subscriber.ts` |
| ① 同上 | `collab-server/repair`、`collab-server/update-rejected` | M-09 `server-collab`（**事件名以此为准，2026-09-18 结案，C-08**；module-map BC-26 行历史写作 `collab/repair`，回填见 §12 G-25） | `audit/infrastructure/audit-event.subscriber.ts` |
| ② Nest AOP 拦截（`@Audited(action)` + `AuditInterceptor`，**非** cordis 事件） | M-08 各 usecase 标注的 action（`tenant.created`/`document.created`/`permission.granted`/`auth.login`…，08 §2.4 已列，点式串口径 2026-09-18 经 C-24 确认）；本模块自身 controller 标注的 action（`import.created`/`export.created`/`comment.import-as-editable`/`admin.compact`…，同一点式串口径） | 被装饰的 controller/usecase 方法成功返回后 | `common/interceptors/audit.interceptor.ts` |
| ③ 协同控制帧（协同信封消息，**非** cordis 事件） | `CONTROL.event{type:'comments.changed',threadId}` | M-09 `server-collab`（Room 观察 `resources.comments.*` 变更后广播） | `comments/infrastructure/comment-mirror.observer.ts` |

发布（本模块对外）：无 cordis 事件；SV-15 服务端 Webhook 出口经新增 `webhooks` 模块**M3 即实现**（用户裁决 rulings §4.12 U-14，原"P2/M4 预留、不在 M3 范围内实现"作废，`comments/application/resolve-notification-fanout` 一名同步作废）：`comments/application/mirror-comment-change.usecase.ts` 在镜像变更后调用 `WebhooksModule` 导出的 `DeliverWebhookEventUseCase` 触发投递（HMAC 签名 + 指数重试 + 死信队列），投递本身是出站 HTTP 请求，不经 cordis 事件；用例见 §2.6，模块见 §4.11/§5.11，§13 Q-6 结案。

**图 2-1 评论读模型与审计写入**

```mermaid
flowchart LR
crdt["客户端 CRDT 事实源 resources.comments"]
roomBroadcast["M-09 Room广播 CONTROL.event"]
mirror["comment-mirror.observer 唯一写入口"]
commentsTable["comments 镜像表"]
mention["extractMentionTokens 通知扇出"]
domainEvents["M-08 / M-09 事件"]
auditSub["AuditEventSubscriber"]
auditInterceptor["AuditInterceptor Audited装饰器"]
auditLog["audit_log 只追加"]
crdt -- "变更后广播" --> roomBroadcast
roomBroadcast -- "comments.changed" --> mirror
mirror -- "upsert" --> commentsTable
commentsTable --> mention
domainEvents -- "command.audited 等" --> auditSub
auditSub --> auditLog
auditInterceptor -- "controller/usecase 成功后" --> auditLog
```

图怎么读：评论镜像永远是只读投影，事实源始终在客户端 CRDT；`audit_log` 有两条互不相同的写入通路——事件订阅与 AOP 拦截器——但都只追加，不更新不删除。

### 2.5 仓储 / 存储契约

全部为普通 Nest `@Injectable` 仓储（Drizzle 直连 Postgres），无 cordis Definition/Provider 与 `run*Conformance` 契约套件——与 M-08 §2.5 对普通仓储的裁定一致。

| 仓储 | 方法签名草案 | 所在文件 |
|---|---|---|
| `JobRunsRepository` | `create\|findById\|findByIdempotencyKey\|updateStatus\|listByDocAndKind(docId,kind,opts)` | `jobs/infrastructure/job-runs.repository.ts` |
| `ThumbnailsRepository` | `findLatest(docId,slideId)\|upsert\|listByDoc(docId)\|deleteByDoc(docId)` | `thumbnails/infrastructure/thumbnails.repository.ts` |
| `CommentsRepository` | `upsertThread\|upsertReply\|listByDoc(docId,view)\|findMentioned(userId)\|markDetached(threadId)` | `comments/infrastructure/comments.repository.ts` |
| `WebhookRepository`（新增，rulings §4.12 U-14） | `createSubscription\|updateSubscription\|deleteSubscription\|findSubscriptionsByEvent(tenantId,event)\|insertDelivery\|updateDeliveryStatus\|listDeliveries(subscriptionId,cursor)` | `webhooks/infrastructure/webhook.repository.ts` |
| `AuditRepository` | `insert(entry)\|insertBatch(entries)\|queryByTenant(range,category,cursor)\|exportRange(range)`——仅 `INSERT`/`SELECT`，无 `update`/`delete` 方法（数据库角色层面也禁止） | `audit/infrastructure/audit.repository.ts` |

**消费的外部契约（本模块不定义，只调用）**：`HeadlessJobContext`/`importPptx`/`exportPptx`/`validateSnapshotTask`/`migrateTask`/`diffSnapshots`（`@oce/server-headless`，M-09 §6）；`ThumbnailRenderer.render()`/`.renderPdf()`（M-09 §2.5 适配器接口，**经 `HeadlessHost.thumbnails` 只读字段取得，2026-09-18 结案，C-09，§12 G-26/§13 Q-1**）；`ServerBlobStore`（`@oce/server-storage`，M-08 §2.5）；`CollabServer`/`Room.broadcastControl`（`@oce/server-collab`，M-09 §2.5）；`DocumentRepository`/`RoleResolverService`（M-08 §2.5/§3）。

> 注（S-4/§3.8 回执，rulings §4.13）：`EgressGuard`（`webhooks/infrastructure/egress-guard.ts`）不是仓储，是投递前置校验契约——`assertAllowed(targetUrl):Promise<{ip:string}>` 解析主机名、经 `isBlockedEgressAddress`（§2.3）拒绝阻断地址、返回锁定的目标 IP 供后续连接固定使用（防 DNS 重绑定）；只用 Node 内置 `dns`/`net`，不引入外部服务依赖。
> 注（§3.9 回执，rulings §4.13）：`comments` 表原按 `anchor->>'slideId'` 具名字段建索引，改为对生成列 `anchor_key`（`deriveAnchorKey`，§2.1/§2.3）建索引，文档类型无关；索引 DDL 归属架构 08 §5（由另一路回写员落地）。

### 2.6 应用服务与命令

本模块没有 `CommandDef`/`MutationDef`（那是 BC-05 CRDT 内容层的专属机制）；"命令"是普通 Nest 用例，事务边界是数据库事务或"编排一次 headless/collab 调用"。

| 用例 | 参数（protocol DTO） | 权限能力位 / 前置检查 | 事务边界 | 补偿/逆操作 | 所在文件 |
|---|---|---|---|---|---|
| 创建导入作业 | `rest/import-export.ts` create schema | 租户成员（`doc.write`，若指定 `docId` 更新既有文档） | 单事务写 `job_runs` + 异步 BullMQ 入队 | 无（失败可用同幂等键重新提交） | `import-export/application/create-import-job.usecase.ts` |
| 查询作业状态 | `{jobId}` | `doc.read` 或作业创建者 | 只读 | 不适用 | `jobs/application/get-job.usecase.ts`（跨模块复用） |
| 创建导出作业 | `{docId,format,snapshotId?}` | `doc.export` | 单事务写 `job_runs`；`format='pptx'` 入队 `export`，`pdf\|png\|jpeg` 转发 `thumbnails` 模块 `render-export` 队列 | 无 | `import-export/application/create-export-job.usecase.ts` |
| 模板填充 / 校验 / 迁移 / 转换（占位，M4，rulings §4.12 U-13） | `rest/import-export.ts`（M4 扩展）draft schema | 待 M4 定（暂定按动作分别为 `doc.write`/`doc.export`） | 待 M4 定 | 待 M4 定 | `import-export/application/{fill-template,validate,migrate,convert}.usecase.ts`（占位，M4；四者均并入 `import-export`，不新增 `modules/automation/`，见 §12 G-31） |
| 查询/惰性生成缩略图 | `{docId,slideId,seq?}` | `doc.read` | 只读，未命中时触发入队 | 不适用 | `thumbnails/application/get-thumbnail.usecase.ts` |
| 失效缩略图（内部） | `{docId,slideId,newSeq}` | 系统调用（compaction/导入完成事件触发） | 只读判定 + 入队 | 不适用 | `thumbnails/application/invalidate-thumbnails.usecase.ts` |
| 列出评论线程 | `{docId,view:'all'\|'page'\|'unresolved'\|'mentions'}` | `doc.read` | 只读 | 不适用 | `comments/application/list-threads.usecase.ts` |
| 镜像评论变更（内部） | Room 广播载荷 | 系统调用（观察者，唯一写入口） | 单事务 upsert | 不适用（镜像可从 CRDT 重放重建） | `comments/application/mirror-comment-change.usecase.ts` |
| 导入为可编辑线程（P1） | `{docId,importedThreadIds}` | `doc.comment` | 单事务：经 `HeadlessJobContext` 触发服务端 CRDT 写入 | 逆操作 = 客户端手动删除 | `comments/application/import-as-editable-thread.usecase.ts` |
| 跨文档「@我」查询（新增，rulings §4.12 U-14） | `{cursor?}`（无需 `docId`） | `SessionGuard`（按 `RoleResolverService` 逐文档过滤，同列表口径） | 只读，跨文档聚合查询 | 不适用 | `comments/application/list-my-mentions.usecase.ts` |
| 注册/更新/删除 Webhook 订阅（新增，rulings §4.12 U-14） | `rest/webhooks.ts`（新增）create/update schema、`{id}` | 租户管理员 | 单事务 | 更新/删除互为逆操作；创建的逆操作=删除 | `webhooks/application/manage-webhook-subscription.usecase.ts` |
| 投递 Webhook 事件（内部，新增，rulings §4.12 U-14） | `{tenantId,event,payload}` | 系统调用（`comments` 模块触发，唯一入口）；投递前经 `EgressGuard.assertAllowed(targetUrl)`（§2.3/§2.5）前置校验，拒绝则直接标记 `failed` 不发出出站请求（S-4/§3.8 回执） | 无库事务（BullMQ 入队）；`webhook_deliveries` 落状态行 | HMAC 签名 + 指数退避重试；超限转死信队列 | `webhooks/application/deliver-webhook-event.usecase.ts` |
| 查询投递日志（新增，rulings §4.12 U-14） | `{subscriptionId,cursor?}` | 租户管理员 | 只读 | 不适用 | `webhooks/application/list-webhook-deliveries.usecase.ts` |
| 清理文档缩略图（内部，新增，S-2/§3.3 回执） | `{docId}` | 系统调用（`documents`〔M-08〕`schedule-purge` 宽限期满后编排触发） | 单事务：删除该文档全部 `thumbnails` 行 | 幂等，可重复执行；不适用逆操作 | `thumbnails/application/purge-document-thumbnails.usecase.ts` |
| 清理文档评论镜像（内部，新增，S-2/§3.3 回执） | `{docId}` | 系统调用（同上编排触发） | 单事务：删除该文档全部 `comments` 镜像行 | 幂等；镜像可从 CRDT 重放重建，无需逆操作 | `comments/application/purge-document-comments.usecase.ts` |
| 对账扫描孤儿作业与投递（内部，新增，§3.5 回执） | 无（cron 触发） | 系统调用 | 只读扫描 `job_runs`/`webhook_deliveries` 中 `status='queued'\|'pending'` 且超阈值（2× 处理器超时）无对应 BullMQ job 的行 → 重新入队 + 告警 | 幂等（重复扫描不重复入队，见 §4.1） | `jobs/infrastructure/reconciliation.job.ts` |
| 记录审计事件 | `AuditEntry` 草稿 | 系统调用（拦截器/订阅器唯一入口） | 单批量 insert（每用户每秒合并，SV-07 吞吐要求）；写入前计算 `chainHash(prevHash,entry)` 得到 `hash`，与 `prevHash` 同事务落库（rulings §4.12 U-15，M3 即实现） | 不适用（append-only） | `audit/application/record-audit-event.usecase.ts` |
| 查询 / 导出审计 | `{tenantId,range,category}` | 租户管理员 | 只读 + CSV/JSON 流式导出 | 不适用 | `audit/application/query-audit-log.usecase.ts` |
| 校验哈希链（新增，rulings §4.12 U-15） | `{tenantId,range}` | 租户管理员 | 只读：逐行重算 `chainHash` 比对 `hash`/`prevHash` | 不适用 | `audit/application/verify-chain.usecase.ts` |
| 每日封存作业（内部，新增，rulings §4.12 U-15） | 无（cron 触发） | 系统调用 | 单事务：对前一日全部 `audit_log` 行重算校验 + 落一条封存摘要记录 | 不适用（append-only） | `audit/infrastructure/seal.job.ts` |
| 就绪判定 | 无 | 无（内部探针） | 只读并发探测 5 项 | 不适用 | `health/application/evaluate-readiness.usecase.ts` |
| 签发渲染态 token（内部） | `{docId,seq}` | 系统调用（缩略图/PDF 处理器内部） | 无库事务（Redis `SETNX`） | 一次性，60 s 过期 | `internal/application/issue-render-state-token.usecase.ts` |
| 管理动作（compact/migrate/epoch） | `{docId,action}` | 租户管理员 + 高权能力位 | 单事务，委托 M-09 `collabServer`/`server-headless` 执行 | 视动作而定（`epoch` 不可逆） | `internal/application/run-admin-action.usecase.ts` |

**图 2-2 导入作业管线**

```mermaid
flowchart LR
upload["上传 预签名或multipart"]
validate["校验与幂等键 IdempotencyKey"]
queue["BullMQ import 队列"]
headlessImport["HeadlessJobContext importPptx"]
snapshot["快照写入 kind import"]
fidelity["保真报告 FidelityReportSummary"]
thumbJob["缩略图作业入队"]
retry["失败重试"]
upload --> validate
validate -- "同键复用既有JobRun" --> queue
queue -- "worker拉取" --> headlessImport
headlessImport --> snapshot
snapshot --> fidelity
snapshot -- "invalidateThumbnails" --> thumbJob
headlessImport -. "失败" .-> retry
retry -. "沿用同幂等键重新提交" .-> queue
```

图怎么读：幂等键在入队前就去重，失败重试沿用同一个键回到队列而不是产生新作业；快照写入成功后并行触发保真报告与缩略图失效两条支线。

## 3. Nest 模块定义表

Nest 模块不是 cordis Fiber（module-map §5.3），本节列 imports/providers/controllers/exports，取代模板原 §3 的插件定义表（与 M-08 §3、M-09 §3.3 体例一致）。

| 模块 | imports | providers（关键） | controllers | exports |
|---|---|---|---|---|
| `JobsModule`、`WebhooksModule`（对账作业读 `webhook_deliveries`；仅读，不写） | `ConfigModule`、`RedisModule`（BullMQ 连接） | `JobRunsRepository`、`GetJobUseCase`、`BaseProcessor`（抽象基类，非 DI token） | `JobsController`（`GET /jobs/:id` 通用状态查询） | `JobRunsRepository`、`GetJobUseCase`、`QUEUE_NAMES`、`BaseProcessor` |
| `ImportExportModule` | `JobsModule`、`ThumbnailsModule`（取 `RenderExportProducerService`）、`CordisHostModule`（M-09）、`StorageModule`/`DocumentsModule`（M-08） | `CreateImportJobUseCase`、`CreateExportJobUseCase`、`ImportProcessor`、`ExportProcessor`、`SourceFileAccessor` | `ImportsController`、`ExportsController` | 无 |
| `ThumbnailsModule` | `JobsModule`、`CordisHostModule` | `ThumbnailsRepository`、`GetThumbnailUseCase`、`InvalidateThumbnailsUseCase`、`ThumbnailsProcessor`、`RenderExportProcessor`、`HeadlessRendererAccessor` | `ThumbnailsController` | `RenderExportProducerService`（供 `ImportExportModule` 注入的跨模块生产者，§7） |
| `CommentsModule` | `CordisHostModule`（取 `collabServer` 观察 Room 广播）、`DocumentsModule`（M-08）、`WebhooksModule`（新增，触发投递，U-14） | `CommentsRepository`、`ListThreadsUseCase`、`MirrorCommentChangeUseCase`、`ImportAsEditableThreadUseCase`、`ListMyMentionsUseCase`（新增）、`CommentMirrorObserver` | `CommentsController` | 无 |
| `WebhooksModule`（新增，rulings §4.12 U-14） | `ConfigModule`、`RedisModule`（BullMQ 连接） | `WebhookRepository`、`ManageWebhookSubscriptionUseCase`、`DeliverWebhookEventUseCase`、`ListWebhookDeliveriesUseCase`、`WebhookDeliveryProcessor` | `WebhooksController` | `DeliverWebhookEventUseCase`（供 `CommentsModule` 注入）、`WebhookRepository`（供 `JobsModule` 的对账作业扫描 `webhook_deliveries`，§3.5） |
| `AuditModule`（`global`） | `ConfigModule`、`CordisHostModule` | `AuditRepository`、`RecordAuditEventUseCase`、`QueryAuditLogUseCase`、`AuditEventSubscriber`、`VerifyChainUseCase`（新增，U-15）、`SealJob`（新增，U-15，每日封存） | `AuditController` | `RecordAuditEventUseCase`（供 `common/interceptors/audit.interceptor.ts` 注入） |
| `HealthModule` | `ConfigModule`、`DbModule`、`RedisModule`、`CordisHostModule`（`@nestjs/terminus`） | `EvaluateReadinessUseCase`（内联调用 `CordisHostService.diagnostics()` 判定宿主/RoomManager draining，不单列探针类）、`PgProbe`/`RedisProbe`/`BlobStoreProbe` | `HealthController`（`/healthz`、`/readyz`） | 无 |
| `MetricsModule` | `ConfigModule` | `PrometheusRegistryProvider` | `PrometheusController`（独立端口 9464） | 无 |
| `InternalModule` | `CordisHostModule`、`RedisModule` | `IssueRenderStateTokenUseCase`、`RunAdminActionUseCase`、`RenderStateTokenStore`、`FiberDiagnosticsAccessor` | `RenderStateController`、`DiagnosticsController`、`AdminController` | `IssueRenderStateTokenUseCase`（供 `ThumbnailsModule` 的 processor 取一次性 token） |

**以 cordis 插件形式存在的 IO 适配器表（`cordis-host/adapters/*` 新增项）**：本模块**新增 0 个文件**。module-map §3 BC-26 行把 `cordis-host/adapters/{pino-logger,otel-telemetry,errors-reporter}.adapter.ts` 列入本模块承载包，但这三个文件已被 M-09 §4.3 完整定义并显式裁定"物理归属本模块"（M-09，非 M-12）——kernel L0 的 `errors`/`telemetry`/`logger` 三个服务已被这三个文件悉数覆盖，本模块（BC-26 的 `metrics`/`health`）不需要、也不应在 `cordis-host/adapters/` 下重复定义或新增第四个适配器；`metrics` 模块的 Prometheus 文本端点是 Nest 内部的 OTel→Prometheus 桥接（`metrics/infrastructure/prometheus-registry.provider.ts`），物理归属 `apps/server/src/modules/metrics/`，不进 `cordis-host/`。这一"留空"是值得记录的架构事实，差异见 §12 G-23。

## 4. 目录树（完整到文件）

> 十一棵树：9 个 Nest 模块（含新增 `webhooks`，见 §4.11，rulings §4.12 U-14）+ `common/` + `config/`；`cordis-host/adapters/` 无新增（§3）。每个目录一句职责；DDD 五层套用 00-module-map §1 的规则，`interface/` 是"外部世界进入本目录的唯一入口"。

### 4.1 `apps/server/src/modules/jobs/`

```text
apps/server/src/modules/jobs/
├── jobs.module.ts                    # Nest 模块装配：BullMQ 连接注册 + 导出 JobRunsRepository/GetJobUseCase
├── domain/                           # 纯类型与状态机，无 IO
│   ├── job-run.ts                    # JobRun 聚合类型
│   ├── job-status.ts                 # JobStatus 值对象 + canTransitionJobStatus 纯函数
│   ├── idempotency-key.ts            # IdempotencyKey 值对象 + buildIdempotencyKey 纯函数
│   └── errors.ts                     # server.jobs.* 错误码
├── application/                      # 跨域复用的应用服务
│   └── get-job.usecase.ts            # 通用作业状态查询（供 import-export/thumbnails 复用）
├── infrastructure/                   # BullMQ 与持久化
│   ├── queues.ts                     # 队列名常量 + 默认并发/优先级/重试/退避（import/export/thumbnails/render-export/compaction/maintenance）
│   ├── base.processor.ts             # BullMQ 处理器基类：traceparent 恢复、错误分类 retryable/terminal、死信
│   ├── job-runs.repository.ts        # job_runs 表 Drizzle 仓储（generic CRUD）
│   └── reconciliation.job.ts         # 新增（§3.5 回执）：定期对账扫描孤儿 job_runs/webhook_deliveries 行，重新入队并告警
├── interface/                        # 外部世界进入本模块的唯一入口
│   └── jobs.controller.ts            # GET /jobs/:id
└── __tests__/
    ├── job-status.spec.ts            # 状态机非法迁移拒绝
    └── base.processor.spec.ts        # 错误分类与死信路径
```

### 4.2 `apps/server/src/modules/import-export/`

```text
apps/server/src/modules/import-export/
├── import-export.module.ts           # Nest 模块装配：imports JobsModule/ThumbnailsModule/CordisHostModule
├── domain/
│   ├── import-job.ts                 # ImportJob 值对象 + FidelityReportSummary
│   ├── export-job.ts                 # ExportJob 值对象（含 format 判别）
│   └── errors.ts                     # server.import.*/server.export.* 错误码
├── application/
│   ├── create-import-job.usecase.ts  # 幂等键计算 → job_runs 写入 → 入队 import
│   └── create-export-job.usecase.ts  # 按 format 分派 export / render-export 队列
├── infrastructure/                   # 处理器只编排，转换逻辑全在 server-headless（铁律 4）
│   ├── import.processor.ts           # BullMQ import：拉原件 → HeadlessJobContext.importPptx → 写快照(kind=import)+媒体关联 → 创建/更新文档 → 审计
│   ├── export.processor.ts           # BullMQ export：快照 → HeadlessJobContext.exportPptx → BlobStore → 预签名下载 URL（24 h）
│   └── source-file.accessor.ts       # 经 ctx.blobStore/multipart 读取导入原始文件字节
├── interface/
│   ├── imports.controller.ts         # POST /imports{storageKey|multipart≤10MB}、GET /imports/:jobId
│   └── exports.controller.ts         # POST /documents/:id/export{format}、GET /exports/:jobId
└── __tests__/
    ├── import.processor.spec.ts      # 保真报告生成、失败重试
    └── export.processor.spec.ts      # SV-02 字节级一致断言（复用 M-09 语料库）
```

### 4.3 `apps/server/src/modules/thumbnails/`

```text
apps/server/src/modules/thumbnails/
├── thumbnails.module.ts              # Nest 模块装配：导出 RenderExportProducerService 供 import-export 注入
├── domain/
│   ├── thumbnail.ts                  # Thumbnail 聚合
│   ├── thumbnail-key.ts              # ThumbnailKey/RenderRoute 值对象 + buildThumbnailKey/shouldInvalidateThumbnail
│   └── errors.ts                     # server.thumbnails.* 错误码
├── application/
│   ├── get-thumbnail.usecase.ts      # ETag/immutable 判定；未命中惰性入队
│   ├── invalidate-thumbnails.usecase.ts  # 压缩完成/导入完成/admin 触发的失效判定
│   ├── render-export-producer.service.ts # 跨模块生产者：import-export 的非 pptx 导出请求经此入队 render-export
│   └── purge-document-thumbnails.usecase.ts  # 新增（S-2/§3.3 回执）：响应 documents 编排的硬删除调度，清理该文档全部缩略图行
├── infrastructure/                   # 处理器只编排，Chromium 池与渲染在 server-headless（铁律 4）
│   ├── thumbnails.processor.ts       # BullMQ thumbnails：去重键 doc:{id}:seq:{seq} → ThumbnailRenderer.render()
│   ├── render-export.processor.ts    # BullMQ render-export：pdf/png/jpeg → ThumbnailRenderer.renderPdf()/render()
│   ├── thumbnails.repository.ts      # thumbnails 表 Drizzle 仓储
│   └── headless-renderer.accessor.ts # 经 CordisHostService 打开的 HeadlessHost.thumbnails 只读字段取 ThumbnailRenderer（2026-09-18 结案，C-09，§12 G-26）
├── interface/
│   └── thumbnails.controller.ts      # GET /documents/:id/thumbnails/:slideId?seq=
└── __tests__/
    ├── thumbnail-key.spec.ts         # 缓存键与失效判定
    └── thumbnails.processor.spec.ts  # 去重键作废旧任务、超时重试 1 次后占位图
```

### 4.4 `apps/server/src/modules/comments/`

```text
apps/server/src/modules/comments/
├── comments.module.ts
├── domain/
│   ├── comment-thread.ts             # CommentThread 读模型聚合
│   ├── anchor.ts                     # Anchor 镜像值对象 + deriveAnchorKey 纯函数（生成 anchor_key 索引键，文档类型无关，§3.9 回执）
│   ├── comment-limits.ts             # CommentLimits 值对象 + checkCommentLimits 纯函数
│   └── errors.ts                     # server.comments.* 错误码
├── application/
│   ├── list-threads.usecase.ts       # 全部/当前页/未解决/@我 四种视图（单文档内）
│   ├── mirror-comment-change.usecase.ts  # 观察 Room 广播后 upsert 镜像（唯一写入口）；成功后调用 WebhooksModule.DeliverWebhookEventUseCase（新增，U-14）
│   ├── import-as-editable-thread.usecase.ts  # P1：只读评论 → 经 HeadlessJobContext 转可编辑 CRDT 实体
│   ├── list-my-mentions.usecase.ts   # 新增（rulings §4.12 U-14）：跨文档「@我」查询，无需 docId
│   └── purge-document-comments.usecase.ts  # 新增（S-2/§3.3 回执）：响应 documents 编排的硬删除调度，清理该文档全部评论镜像行
├── infrastructure/
│   ├── comments.repository.ts        # comments 表 Drizzle 仓储（镜像读写）
│   ├── comment-mirror.observer.ts    # 订阅 collabServer 的 Room 广播 CONTROL.event{comments.changed}
│   └── mention-parser.ts             # extractMentionTokens 纯函数 + 经 M-08 UsersRepository 解析显示名
├── interface/
│   └── comments.controller.ts        # GET 线程列表/详情/@我（单文档）、GET /comments/mentions 跨文档「@我」（新增，U-14）；POST 导入为可编辑线程（其余 CRUD 走 CRDT，不经 REST）
└── __tests__/
    ├── comment-limits.spec.ts        # 5,000 字符/5,000 线程/500 回复镜像层断言
    └── mirror-comment-change.usecase.spec.ts  # 幂等 upsert、锚点脱离状态迁移
```

### 4.5 `apps/server/src/modules/audit/`

```text
apps/server/src/modules/audit/
├── audit.module.ts                   # global：导出 RecordAuditEventUseCase 供 common/interceptors 注入
├── domain/
│   ├── audit-entry.ts                # AuditEntry 聚合（append-only；prevHash/hash 新增，U-15）
│   ├── audit-chain.ts                # 新增（rulings §4.12 U-15）：chainHash 纯函数
│   ├── retention-policy.ts           # RetentionPolicy 值对象 + shouldRetainAuditRow 纯函数
│   └── errors.ts                     # server.audit.* 错误码
├── application/
│   ├── record-audit-event.usecase.ts # 写入唯一入口（拦截器与订阅器均调此）；每用户每秒合并（SV-07 吞吐）；写入前计算 chainHash（U-15）
│   ├── query-audit-log.usecase.ts    # 按租户/时间范围/类别查询 + CSV/JSON 导出
│   └── verify-chain.usecase.ts       # 新增（rulings §4.12 U-15）：逐行重算 chainHash 校验哈希链
├── infrastructure/
│   ├── audit.repository.ts           # audit_log 表仓储：仅 insert/insertBatch/query，无 update/delete 方法
│   ├── audit-event.subscriber.ts     # 订阅 command/audited、plugin/failed、collab-server/repair、collab-server/update-rejected、permission/denied（§2.4）
│   └── seal.job.ts                   # 新增（rulings §4.12 U-15）：每日定时封存作业，重算校验前一日全部 audit_log 行
├── interface/
│   └── audit.controller.ts           # GET /audit（租户管理员查询）、GET /audit/export
└── __tests__/
    ├── retention-policy.spec.ts      # 365 天默认 + 月分区判定
    ├── audit.repository.append-only.spec.ts  # 断言数据库角色拒绝 UPDATE/DELETE
    └── audit-chain.spec.ts           # 新增（rulings §4.12 U-15）：chainHash 篡改检测断言
```

### 4.6 `apps/server/src/modules/health/`

```text
apps/server/src/modules/health/
├── health.module.ts                  # @nestjs/terminus 装配
├── domain/
│   └── probe-result.ts               # HealthProbe 值对象
├── application/
│   └── evaluate-readiness.usecase.ts # 聚合 pg/redis/s3/headless 宿主/RoomManager draining 五项判定
├── infrastructure/
│   ├── pg.probe.ts                   # SELECT 1 ping
│   ├── redis.probe.ts                # PING
│   └── blob-store.probe.ts           # ctx.blobStore.head() 探测
├── interface/
│   └── health.controller.ts          # GET /healthz（进程存活）、GET /readyz（就绪前不接流量）
└── __tests__/
    └── evaluate-readiness.usecase.spec.ts  # 任一探针失败 → 503；Redis 不可用单独断言（08-backend-nestjs §8）
```

### 4.7 `apps/server/src/modules/metrics/`

```text
apps/server/src/modules/metrics/
├── metrics.module.ts
├── infrastructure/
│   └── prometheus-registry.provider.ts   # kernel telemetry OTel Provider → Prometheus 文本格式桥接
├── interface/
│   └── prometheus.controller.ts      # GET /metrics（独立内部端口 9464，架构 10 §3.3 指标清单）
└── __tests__/
    └── prometheus.controller.spec.ts # 指标名均在登记表且格式合法
```

### 4.8 `apps/server/src/modules/internal/`

```text
apps/server/src/modules/internal/
├── internal.module.ts                # 网络策略限内网
├── domain/
│   └── render-state-token.ts         # RenderStateToken 值对象 + 校验纯函数（TTL、已消费即失效）
├── application/
│   ├── issue-render-state-token.usecase.ts   # 供 thumbnails 处理器签发一次性 token
│   └── run-admin-action.usecase.ts   # compact|migrate|epoch 三种管理动作编排（委托 M-09）
├── infrastructure/
│   ├── render-state-token.store.ts   # Redis 一次性 token 存储（SETNX + TTL）
│   └── fiber-diagnostics.accessor.ts # 经 CordisHostService.diagnostics() 读 fibers/effects/pending/贡献点
├── interface/
│   ├── render-state.controller.ts    # GET /internal/render/:token/state：一次性 token → 快照字节
│   ├── diagnostics.controller.ts     # GET /internal/diagnostics/{fibers,effects,pending,contributions}
│   └── admin.controller.ts           # POST /internal/admin/documents/:id/{compact,migrate,epoch}
└── __tests__/
    └── run-admin-action.usecase.spec.ts   # epoch 动作不可逆、compact/migrate 幂等
```

### 4.9 `apps/server/src/common/`

```text
apps/server/src/common/
├── filters/
│   └── oce-exception.filter.ts       # OceError → RFC 9457 problem+json；ZodError → 400；未知 → 500 + errors.report
├── interceptors/
│   ├── request-context.interceptor.ts # requestId/traceparent/tenant/user → AsyncLocalStorage
│   └── audit.interceptor.ts          # @Audited(action) 解释器：handler 成功后调 audit 模块 RecordAuditEventUseCase
├── pipes/
│   └── zod.pipe.ts                   # protocol schema → parse（400 走 oce-exception.filter）
├── guards-shared/
│   └── rate-limit.guard.ts           # @RateLimit() 解释器（策略型 Guard 归属 M-08 owning 模块，本文件是唯一"纯机制"限流 Guard，08 §3 已裁定）
├── rate-limit/
│   └── redis-token-bucket.ts         # 令牌桶算法：纯函数 consumeTokenBucket + Redis 状态读写
├── logging/
│   └── log-fields.ts                 # oce.* 字段规范装配（架构 10 §2.2，脱敏交给 kernel logger/redact.ts）
└── decorators/
    ├── audited.decorator.ts          # @Audited(action)
    └── rate-limit.decorator.ts       # @RateLimit(policy)
```

### 4.10 `apps/server/src/config/`

```text
apps/server/src/config/
├── config.module.ts                  # 解析一次，注入 typed AppConfig；解析失败 → 进程退出码 78；支持 --dry-run
├── config.schema.ts                  # zod Standard Schema：role/http/db/redis/storage/auth/collab/limits/headless/telemetry（08-backend-nestjs §2 骨架的权威落点）；新增 webhookEgressAllowlist 部署级放宽白名单项（S-4/§3.8 回执，默认空＝严格模式）
├── roles.ts                          # OCE_ROLE=api|collab|worker → 模块装配列表（roles.ts→AppModule.forRole）
├── env-overrides.ts                  # 按 NODE_ENV/OCE_ROLE 的覆盖合并规则（硬规则"按环境的覆盖"）
└── secrets.ts                        # 机密来源适配（环境变量 | 挂载文件 | 外部 secret manager）+ 启动前存在性校验
```

### 4.11 `apps/server/src/modules/webhooks/`（新增，rulings §4.12 U-14，2026-09-19）

评论事件的服务端 Webhook 出口，M3 即实现（用户裁决 U-14，与客户端 EM-05 回调并行，两者都做）；独立于 `comments/` 成模块，理由：HMAC 签名/指数重试/死信队列是与评论读模型正交的技术关注点，参照 M-08 `share-links` 独立于 `permissions` 的先例（08 §12 G-6 DDD 单一职责原则）；`comments` 模块只在镜像变更后调用本模块导出的 `DeliverWebhookEventUseCase`，不反向依赖。

```text
webhooks/
├── webhooks.module.ts                    装配 imports/providers/controllers/exports（见 §3）
├── domain/
│   ├── webhook-subscription.ts           WebhookSubscription 聚合根（§2.1）
│   ├── webhook-delivery.ts               WebhookDelivery 实体（§2.1）
│   └── errors.ts                         webhook.* 错误码
├── application/
│   ├── manage-webhook-subscription.usecase.ts  RegisterWebhookUseCase + UpdateWebhookUseCase + DeleteWebhookUseCase（三合一，同文件）
│   ├── deliver-webhook-event.usecase.ts  HMAC 签名 + 指数退避重试编排（唯一投递入口，供 comments 模块调用）
│   └── list-webhook-deliveries.usecase.ts 投递日志查询
├── infrastructure/
│   ├── webhook.repository.ts             Drizzle：webhook_subscriptions + webhook_deliveries
│   ├── webhook-signer.ts                 HMAC-SHA256 签名纯函数
│   ├── webhook-delivery.processor.ts     BullMQ 处理器：指数退避重试 + 超限转死信队列
│   └── egress-guard.ts                   新增（S-4/§3.8 回执）：解析目标→拒绝私网/回环/链路本地/云元数据端点→防 DNS 重绑定（解析后锁定 IP 再连接）
├── interface/
│   └── webhooks.controller.ts            POST/GET/PATCH/DELETE /webhooks、GET /webhooks/:id/deliveries
└── __tests__/
    ├── manage-webhook-subscription.usecase.spec.ts
    └── webhook-delivery.processor.spec.ts    指数退避与死信断言
```

**`cordis-host/adapters/` 增量**：无新增文件（§3 已述；既有 3 个适配器由 M-09 定义与维护）。

## 5. 文件职责表

### 5.1 `jobs/`

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `jobs.module.ts` | 模块装配 + BullMQ 连接注册 | `JobsModule` | Nest、`@nestjs/bullmq` | exports 见 §3 |
| `domain/job-run.ts` | 通用作业聚合类型 | `JobRun` | 无 | 跨域复用 |
| `domain/job-status.ts` | 状态字面量联合 + 迁移判定 | `JobStatus`、`canTransitionJobStatus` | 无 | 非 enum |
| `domain/idempotency-key.ts` | 幂等键值对象 + 构造函数 | `IdempotencyKey`、`buildIdempotencyKey` | `@oce/shared`（Brand） | `<域>:<docId>:<inputHash>` |
| `domain/errors.ts` | `server.jobs.*` 错误码 | `JobsError` | 无 | queue_unavailable/not_found |
| `application/get-job.usecase.ts` | 通用作业查询 | `GetJobUseCase` | `../infrastructure/job-runs.repository` | 跨模块导出 |
| `infrastructure/queues.ts` | 队列名与默认配置常量 | `QUEUE_NAMES`、`QUEUE_DEFAULTS` | `bullmq` | 并发/优先级/重试/退避表 |
| `infrastructure/base.processor.ts` | 处理器基类 | `BaseProcessor` | `bullmq`、`@oce/kernel`（telemetry 类型） | traceparent 恢复 |
| `infrastructure/job-runs.repository.ts` | `job_runs` 表仓储 | `JobRunsRepository` | `drizzle-orm` | tenant_id 强制 |
| `infrastructure/reconciliation.job.ts`（新增，§3.5 回执） | 对账扫描孤儿 `job_runs`/`webhook_deliveries` 行 | `ReconciliationJob` | `../infrastructure/job-runs.repository`；跨模块消费 `webhooks` 仓储（`WebhooksModule` 已导出 `WebhookRepository`，见 §3） | cron 触发，见 §2.6 |
| `interface/jobs.controller.ts` | 通用状态查询端点 | `JobsController` | protocol `rest/import-export.ts` | `GET /jobs/:id` |
| `__tests__/job-status.spec.ts` | 单测 | — | — | 非法迁移拒绝 |
| `__tests__/base.processor.spec.ts` | 单测 | — | — | 错误分类/死信 |

### 5.2 `import-export/`

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `import-export.module.ts` | 模块装配 | `ImportExportModule` | Nest、`JobsModule`、`ThumbnailsModule` | exports 见 §3 |
| `domain/import-job.ts` | 导入作业值对象 | `ImportJob`、`FidelityReportSummary` | `../../jobs/domain/job-run` | — |
| `domain/export-job.ts` | 导出作业值对象 | `ExportJob` | `../../jobs/domain/job-run` | format 判别 |
| `domain/errors.ts` | 错误码 | `ImportExportError` | 无 | `server.import.*`/`server.export.*` |
| `application/create-import-job.usecase.ts` | 创建导入作业 | `CreateImportJobUseCase` | `../infrastructure/*`、`JobsModule` | 幂等键去重 |
| `application/create-export-job.usecase.ts` | 创建导出作业 | `CreateExportJobUseCase` | `../infrastructure/*`、`JobsModule` + `RenderExportProducerService` | 按 format 分派 |
| `infrastructure/import.processor.ts` | 导入 BullMQ 处理器 | `ImportProcessor` | `@oce/server-headless`（经 `CordisHostService`） | 铁律 4 |
| `infrastructure/export.processor.ts` | 导出 BullMQ 处理器 | `ExportProcessor` | `@oce/server-headless`（经 `CordisHostService`） + `ctx.blobStore` | SV-02 |
| `infrastructure/source-file.accessor.ts` | 原始文件读取 | `SourceFileAccessor` | `ctx.blobStore` | — |
| `interface/imports.controller.ts` | 导入 REST | `ImportsController` | protocol `rest/import-export.ts` | — |
| `interface/exports.controller.ts` | 导出 REST | `ExportsController` | protocol `rest/import-export.ts` | — |
| `__tests__/import.processor.spec.ts` | 单测 | — | — | 保真报告/失败重试 |
| `__tests__/export.processor.spec.ts` | 单测 | — | — | 字节级一致断言 |

### 5.3 `thumbnails/`

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `thumbnails.module.ts` | 模块装配 | `ThumbnailsModule` | Nest、`JobsModule` | exports 见 §3 |
| `domain/thumbnail.ts` | 缩略图聚合 | `Thumbnail` | 无 | — |
| `domain/thumbnail-key.ts` | 缓存键 + 渲染路由值对象 | `ThumbnailKey`、`RenderRoute`、`buildThumbnailKey`、`shouldInvalidateThumbnail` | 无 | BC-24 参数化落点，§8 |
| `domain/errors.ts` | 错误码 | `ThumbnailsError` | 无 | `server.thumbnails.*` |
| `application/get-thumbnail.usecase.ts` | 查询/惰性触发 | `GetThumbnailUseCase` | `../infrastructure/*` | ETag |
| `application/invalidate-thumbnails.usecase.ts` | 失效判定与编排 | `InvalidateThumbnailsUseCase` | `../infrastructure/*` | — |
| `application/render-export-producer.service.ts` | 跨模块生产者 | `RenderExportProducerService` | `../../jobs/infrastructure/queues` | 供 import-export 注入 |
| `application/purge-document-thumbnails.usecase.ts`（新增，S-2/§3.3 回执） | 文档硬删除级联：清理该文档全部缩略图行 | `PurgeDocumentThumbnailsUseCase` | `../infrastructure/thumbnails.repository` | 由 `documents` 编排触发，幂等 |
| `infrastructure/thumbnails.processor.ts` | 缩略图 BullMQ 处理器 | `ThumbnailsProcessor` | `@oce/server-headless` | 铁律 4 |
| `infrastructure/render-export.processor.ts` | PDF/PNG/JPEG 处理器 | `RenderExportProcessor` | `@oce/server-headless` | 共享 Chromium 池 |
| `infrastructure/thumbnails.repository.ts` | `thumbnails` 表仓储 | `ThumbnailsRepository` | `drizzle-orm` | — |
| `infrastructure/headless-renderer.accessor.ts` | 经 `HeadlessHost.thumbnails` 取 `ThumbnailRenderer` 实例 | `HeadlessRendererAccessor` | `CordisHostService` | §12 G-26 结案（C-09） |
| `interface/thumbnails.controller.ts` | 缩略图 REST | `ThumbnailsController` | protocol（新增建议） | ETag/immutable |
| `__tests__/thumbnail-key.spec.ts` | 单测 | — | — | — |
| `__tests__/thumbnails.processor.spec.ts` | 单测 | — | — | 去重/超时/占位图 |

### 5.4 `comments/`

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `comments.module.ts` | 模块装配 | `CommentsModule` | Nest、`CordisHostModule` | exports 见 §3 |
| `domain/comment-thread.ts` | 读模型聚合 | `CommentThread` | 无 | 非事实源 |
| `domain/anchor.ts` | 锚点镜像值对象 + 索引键派生 | `Anchor`、`deriveAnchorKey`（新增，§3.9 回执） | 无 | 只校验格式，不解码 CRDT；`deriveAnchorKey` 按判别式提取 `anchor_key`，文档类型无关 |
| `domain/comment-limits.ts` | 上限值对象 + 校验纯函数 | `CommentLimits`、`checkCommentLimits` | 无 | CO-04/SV-08 |
| `domain/errors.ts` | 错误码 | `CommentsError` | 无 | `server.comments.*` |
| `application/list-threads.usecase.ts` | 四视图查询（单文档内） | `ListThreadsUseCase` | `../infrastructure/comments.repository` | all/page/unresolved/mentions |
| `application/mirror-comment-change.usecase.ts` | 镜像 upsert | `MirrorCommentChangeUseCase` | `../infrastructure/comments.repository`、`WebhooksModule.DeliverWebhookEventUseCase`（新增，U-14） | 唯一写入口；成功后触发 Webhook 投递 |
| `application/import-as-editable-thread.usecase.ts` | 只读转可编辑（P1） | `ImportAsEditableThreadUseCase` | `@oce/server-headless` | 经 CRDT 事务 |
| `application/list-my-mentions.usecase.ts`（新增，rulings §4.12 U-14） | 跨文档「@我」查询 | `ListMyMentionsUseCase` | `../infrastructure/comments.repository`、`RoleResolverService` | 无需 `docId`，按角色逐文档过滤 |
| `application/purge-document-comments.usecase.ts`（新增，S-2/§3.3 回执） | 文档硬删除级联：清理该文档全部评论镜像行 | `PurgeDocumentCommentsUseCase` | `../infrastructure/comments.repository` | 由 `documents` 编排触发，幂等（镜像可从 CRDT 重放重建） |
| `infrastructure/comments.repository.ts` | `comments` 表仓储 | `CommentsRepository` | `drizzle-orm` | — |
| `infrastructure/comment-mirror.observer.ts` | 订阅 Room 控制帧 | `CommentMirrorObserver` | `collabServer`（经 `CordisHostService`） | `CONTROL.event{comments.changed}` |
| `infrastructure/mention-parser.ts` | @提及解析 | `extractMentionTokens`、`MentionResolver` | M-08 `UsersRepository` | 纯函数 + 目录查找分层 |
| `interface/comments.controller.ts` | 评论只读 REST（含跨文档 `GET /comments/mentions`，新增 U-14） | `CommentsController` | protocol（新增建议 `rest/comments.ts`） | 除导入线程外全只读 |
| `__tests__/comment-limits.spec.ts` | 单测 | — | — | 镜像层展示口径断言 |
| `__tests__/mirror-comment-change.usecase.spec.ts` | 单测 | — | — | 幂等 upsert、锚点脱离迁移 |

### 5.5 `audit/`

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `audit.module.ts` | 模块装配（global） | `AuditModule` | Nest | exports 见 §3 |
| `domain/audit-entry.ts` | 聚合（append-only） | `AuditEntry` | 无 | `prevHash`/`hash` 字段新增，U-15 |
| `domain/audit-chain.ts`（新增，rulings §4.12 U-15） | 哈希链纯函数 | `chainHash` | `node:crypto` | sha256 摘要 |
| `domain/retention-policy.ts` | 保留策略值对象 + 纯函数 | `RetentionPolicy`、`shouldRetainAuditRow` | 无 | 365 天默认 |
| `domain/errors.ts` | 错误码 | `AuditError` | 无 | `server.audit.*` |
| `application/record-audit-event.usecase.ts` | 写入唯一入口 | `RecordAuditEventUseCase` | `../infrastructure/audit.repository`、`../domain/audit-chain` | 每用户每秒合并；写入前计算 `chainHash` |
| `application/query-audit-log.usecase.ts` | 查询 + 导出 | `QueryAuditLogUseCase` | `../infrastructure/audit.repository` | CSV/JSON |
| `application/verify-chain.usecase.ts`（新增，rulings §4.12 U-15） | 哈希链校验工具 | `VerifyChainUseCase` | `../infrastructure/audit.repository`、`../domain/audit-chain` | 逐行重算比对 |
| `infrastructure/audit.repository.ts` | `audit_log` 表仓储 | `AuditRepository` | `drizzle-orm` | 仅 insert/select |
| `infrastructure/audit-event.subscriber.ts` | cordis 事件订阅 | `AuditEventSubscriber` | `CordisHostService` | §2.4 通路① |
| `infrastructure/seal.job.ts`（新增，rulings §4.12 U-15） | 每日定时封存作业 | `SealJob` | `../application/verify-chain.usecase` | cron 触发，落封存摘要记录 |
| `interface/audit.controller.ts` | 审计查询 REST | `AuditController` | protocol `rest/audit.ts` | 租户管理员 |
| `__tests__/retention-policy.spec.ts` | 单测 | — | — | 月分区判定 |
| `__tests__/audit.repository.append-only.spec.ts` | 单测 | — | — | 断言 UPDATE/DELETE 被拒 |
| `__tests__/audit-chain.spec.ts`（新增，rulings §4.12 U-15） | 单测 | — | — | 篡改检测断言 |

### 5.6 `health/`

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `health.module.ts` | 模块装配 | `HealthModule` | `@nestjs/terminus` | exports 见 §3 |
| `domain/probe-result.ts` | 探针结果值对象 | `HealthProbe` | 无 | — |
| `application/evaluate-readiness.usecase.ts` | 五项判定聚合 | `EvaluateReadinessUseCase` | `../infrastructure/*`、`CordisHostService` | pg/redis/s3/宿主/draining |
| `infrastructure/pg.probe.ts` | PG 探针 | `PgProbe` | `drizzle-orm` | `SELECT 1` |
| `infrastructure/redis.probe.ts` | Redis 探针 | `RedisProbe` | `ioredis` | `PING` |
| `infrastructure/blob-store.probe.ts` | 存储探针 | `BlobStoreProbe` | `ctx.blobStore` | `head()` |
| `interface/health.controller.ts` | 探针端点 | `HealthController` | 无 protocol 依赖（纯运维端点） | `/healthz`、`/readyz` |
| `__tests__/evaluate-readiness.usecase.spec.ts` | 单测 | — | — | 任一探针失败 → 503 |

### 5.7 `metrics/`

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `metrics.module.ts` | 模块装配 | `MetricsModule` | Nest | 独立端口监听 |
| `infrastructure/prometheus-registry.provider.ts` | OTel→Prometheus 桥接 | `PrometheusRegistryProvider` | `@oce/kernel`（telemetry 类型）、`prom-client` | 10 §3.3 指标清单 |
| `interface/prometheus.controller.ts` | 指标端点 | `PrometheusController` | 无 protocol 依赖 | `GET /metrics`（内部端口 9464） |
| `__tests__/prometheus.controller.spec.ts` | 单测 | — | — | 指标名均在登记表 |

### 5.8 `internal/`

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `internal.module.ts` | 模块装配（网络策略限内网） | `InternalModule` | Nest、`CordisHostModule` | exports 见 §3 |
| `domain/render-state-token.ts` | 一次性 token 值对象 | `RenderStateToken` | 无 | TTL 60 s |
| `application/issue-render-state-token.usecase.ts` | 签发 token | `IssueRenderStateTokenUseCase` | `../infrastructure/render-state-token.store` | 供 thumbnails 处理器调用 |
| `application/run-admin-action.usecase.ts` | 管理动作编排 | `RunAdminActionUseCase` | `collabServer`、`@oce/server-headless` | compact/migrate/epoch |
| `infrastructure/render-state-token.store.ts` | Redis token 存储 | `RenderStateTokenStore` | `ioredis` | `SETNX`+TTL |
| `infrastructure/fiber-diagnostics.accessor.ts` | 诊断数据读取 | `FiberDiagnosticsAccessor` | `CordisHostService.diagnostics()` | — |
| `interface/render-state.controller.ts` | 渲染态拉取 | `RenderStateController` | protocol（内部专用） | `GET /internal/render/:token/state` |
| `interface/diagnostics.controller.ts` | 诊断端点 | `DiagnosticsController` | protocol（内部专用） | fibers/effects/pending/contributions |
| `interface/admin.controller.ts` | 管理端点 | `AdminController` | protocol（内部专用） | compact/migrate/epoch |
| `__tests__/run-admin-action.usecase.spec.ts` | 单测 | — | — | epoch 不可逆断言 |

### 5.9 `common/`

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `filters/oce-exception.filter.ts` | 全局异常过滤器 | `OceExceptionFilter` | `@oce/protocol`（`errors/http-map`） | RFC 9457 |
| `interceptors/request-context.interceptor.ts` | 请求上下文注入 | `RequestContextInterceptor` | `AsyncLocalStorage` | requestId/traceparent |
| `interceptors/audit.interceptor.ts` | `@Audited()` 解释器 | `AuditInterceptor` | `AuditModule.RecordAuditEventUseCase` | handler 成功后写 |
| `pipes/zod.pipe.ts` | DTO 校验管道 | `ZodValidationPipe` | `@oce/protocol` | protocol-only DTO |
| `guards-shared/rate-limit.guard.ts` | `@RateLimit()` 解释器 | `RateLimitGuard` | `../rate-limit/redis-token-bucket` | 08 §3 已裁定归属 |
| `rate-limit/redis-token-bucket.ts` | 令牌桶算法 | `consumeTokenBucket` | `ioredis` | 纯函数 + Redis 状态 |
| `logging/log-fields.ts` | 日志字段规范 | `buildLogFields` | 架构 10 §2.2 | 脱敏在 kernel `redact.ts` |
| `decorators/audited.decorator.ts` | 审计标注 | `Audited` | 无 | 供各模块 controller 使用 |
| `decorators/rate-limit.decorator.ts` | 限流标注 | `RateLimit` | 无 | 供各模块 controller 使用 |

### 5.10 `config/`

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `config.module.ts` | 配置解析装配 | `ConfigModule` | `./config.schema` | 失败退出码 78 |
| `config.schema.ts` | 环境变量 Standard Schema | `AppConfigSchema`、`AppConfig` | `zod` | 08-backend-nestjs §2 权威落点；新增 `webhookEgressAllowlist` 部署级放宽白名单项（S-4/§3.8 回执，默认空＝严格模式） |
| `roles.ts` | 角色 → 模块装配表 | `ROLE_MODULES` | `../modules/**`（类型） | `OCE_ROLE=api\|collab\|worker` |
| `env-overrides.ts` | 按环境覆盖合并 | `applyEnvOverrides` | `./config.schema` | NODE_ENV/OCE_ROLE |
| `secrets.ts` | 机密来源适配 | `resolveSecret` | 无（不 import 具体 secret manager SDK，留 Provider 缝） | 启动前存在性校验 |

### 5.11 `webhooks/`（新增，rulings §4.12 U-14）

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `webhooks.module.ts` | 模块装配 | `WebhooksModule` | Nest、`RedisModule` | exports `DeliverWebhookEventUseCase`（见 §3） |
| `domain/webhook-subscription.ts` | 聚合根 | `WebhookSubscription` | 无 | §2.1 |
| `domain/webhook-delivery.ts` | 实体 | `WebhookDelivery` | 无 | §2.1，死信状态机 |
| `domain/errors.ts` | `webhook.*` 错误码 | `WebhookError` | 无 | not_found/invalid_url/disabled |
| `application/manage-webhook-subscription.usecase.ts` | 注册/更新/删除订阅 | `RegisterWebhookUseCase`、`UpdateWebhookUseCase`、`DeleteWebhookUseCase` | `../infrastructure/webhook.repository` | 三合一，同文件 |
| `application/deliver-webhook-event.usecase.ts` | 投递编排 | `DeliverWebhookEventUseCase` | `../infrastructure/*` | HMAC 签名 + 指数重试，供 `CommentsModule` 调用 |
| `application/list-webhook-deliveries.usecase.ts` | 投递日志查询 | `ListWebhookDeliveriesUseCase` | `../infrastructure/webhook.repository` | — |
| `infrastructure/webhook.repository.ts` | `webhook_subscriptions`+`webhook_deliveries` 表 | `WebhookRepository` | `drizzle-orm` | §2.5 |
| `infrastructure/webhook-signer.ts` | HMAC 签名 | `signPayload`、`verifySignature` | `node:crypto` | HMAC-SHA256 |
| `infrastructure/webhook-delivery.processor.ts` | BullMQ 投递处理器 | `WebhookDeliveryProcessor` | `../application/deliver-webhook-event.usecase` | 指数退避 + 死信队列 |
| `infrastructure/egress-guard.ts`（新增，S-4/§3.8 回执） | 出站 SSRF 校验：解析→拒绝私网/回环/链路本地/云元数据端点→锁定 IP 防 DNS 重绑定 | `EgressGuard`、`isBlockedEgressAddress`（§2.3） | `node:dns`、`node:net`、`../../config`（白名单配置） | 订阅创建/更新与每次投递前均调用，投递前为关键防线 |
| `interface/webhooks.controller.ts` | REST 端点 | `WebhooksController` | protocol `rest/webhooks.ts`（新增，§7.2） | — |
| `__tests__/manage-webhook-subscription.usecase.spec.ts` | 单测 | — | — | 覆盖 URL 校验 |
| `__tests__/webhook-delivery.processor.spec.ts` | 单测 | — | — | 覆盖指数退避与死信转移 |

## 6. 对外 API 面

| 包 / 目录 | `.` 导出概要 | `./testing` 导出概要 | 稳定级（推荐） |
|---|---|---|---|
| `apps/server/src/modules/{import-export,jobs,thumbnails,comments,audit,health,metrics,internal}`、`common`、`config` | 无公共包导出（Nest 应用内部模块，不对外发布，与 M-09 §6 对 `collab`/`snapshots`/`cordis-host` 的裁定一致） | — | 不适用（`apps/*` 不产出 npm 包） |

关键类型契约草案（≤ 40 行；跨模块复用的三个面）：

```ts
// jobs：跨模块基础设施面
interface JobRunsRepository {
  create(input: NewJobRun): Promise<JobRun>
  findByIdempotencyKey(key: IdempotencyKey): Promise<JobRun | undefined>
  updateStatus(id: JobRunId, status: JobStatus, patch?: Partial<JobRun>): Promise<void>
}
abstract class BaseProcessor<TPayload, TResult> {
  protected abstract handle(job: Job<TPayload>, ctx: HeadlessJobContext | undefined): Promise<TResult>
  process(job: Job<TPayload>): Promise<TResult>   // 恢复 traceparent → handle → 错误分类 retryable/terminal → 死信
}
// thumbnails：跨模块生产者面（供 import-export 的非 pptx 导出注入）
interface RenderExportProducerService {
  enqueue(docId: DocumentId, format: 'pdf' | 'png' | 'jpeg', opts: RenderExportOptions): Promise<JobRun>
}
// webhooks：跨模块生产者面（供 comments 模块在镜像变更后调用，新增，rulings §4.12 U-14）
interface DeliverWebhookEventUseCase {
  enqueue(tenantId: TenantId, event: 'comment.created' | 'comment.mentioned', payload: unknown): Promise<void>
}
```

## 7. 前后端与运行时

本模块**仅服务端**（module-map §5：BC-23…26 一栏"仅服务端"），无浏览器 Provider，无 iso 共享代码。

### 7.1 服务端进程内位置

| 资源 | 归属 | 激活的进程角色（`OCE_ROLE`） |
|---|---|---|
| `import`/`export` 处理器 | `import-export/infrastructure/*.processor.ts` | `worker` |
| `thumbnails`/`render-export` 处理器 | `thumbnails/infrastructure/*.processor.ts` | `worker`（内含 headless Chromium） |
| `import-export`/`thumbnails`/`comments` REST controller | 各自 `interface/*.controller.ts` | `api` |
| `comment-mirror.observer.ts` | `comments/infrastructure/` | `collab`（挂在 `collabServer` 的 Room 广播上） |
| `AuditModule`（拦截器 + 订阅器） | global，随 `AppModule` 装配 | 全部角色（`api`/`collab`/`worker`） |
| `HealthModule`/`MetricsModule` | 各自模块 | 全部角色（每实例独立探针/指标） |
| `InternalModule` | `internal/` | 全部角色，路由受网络策略限内网 |

### 7.2 与浏览器共享的 protocol schema 清单

| schema | 文件（现状 / 新增建议） | 用途 |
|---|---|---|
| 导入导出任务 DTO | `@oce/protocol` `rest/import-export.ts`（M-02 既有，需按 §2.1 补 `fidelityReport`/进度阶段字段） | `POST /imports`、`POST /documents/:id/export`、状态查询 |
| 通用作业状态 DTO | `@oce/protocol` `rest/import-export.ts`（复用 `TaskState`） | `GET /jobs/:id` |
| 审计记录 DTO | `@oce/protocol` `rest/audit.ts`（M-02 既有骨架，本模块补查询/导出参数） | `GET /audit` |
| 缩略图查询 DTO | `@oce/protocol` `rest/thumbnails.ts`（**新增建议**） | `GET /documents/:id/thumbnails/:slideId` |
| 评论 REST DTO | `@oce/protocol` `rest/comments.ts`（**新增建议**） | 线程列表/详情/导入为可编辑线程/跨文档「@我」（新增，U-14） |
| Webhook 订阅/投递 DTO（新增，rulings §4.12 U-14） | `@oce/protocol` `rest/webhooks.ts`（**新增建议**） | 注册/更新/删除订阅、投递日志查询 |
| 错误码新增 domain | `@oce/protocol` `errors/codes.ts`（**新增建议**，§1.3 末尾/§12 G-24） | `server.import`/`server.export`/`server.thumbnails`/`server.comments`/`server.audit`/`server.webhook`（新增，U-14） |

### 7.3 与 M-08 / M-09 的边界表（谁写哪张表、谁发哪些事件）

| 关注点 | 谁写 | 谁读 / 订阅 |
|---|---|---|
| `job_runs` | **本模块**（`jobs/infrastructure/job-runs.repository.ts`） | 本模块自身（`GetJobUseCase`） |
| `audit_log` | **本模块**（`AuditRepository`，只追加） | 本模块（`QueryAuditLogUseCase`）；M-08/M-09 只发布事件或标注 `@Audited()`，不直接写表 |
| `thumbnails` | **本模块**（`ThumbnailsRepository`；文档硬删除级联由 `purge-document-thumbnails.usecase.ts` 清空整表行，S-2/§3.3 回执） | 本模块自身；客户端经 REST 只读 |
| `comments`（镜像） | **本模块**（`CommentsRepository`，唯一写入口 `comment-mirror.observer.ts`；文档硬删除级联由 `purge-document-comments.usecase.ts` 清空整表行，S-2/§3.3 回执） | 本模块自身；事实源在客户端 CRDT，不在本表范围 |
| `webhook_subscriptions`/`webhook_deliveries`（新增，rulings §4.12 U-14） | **本模块**（`WebhookRepository`） | 本模块自身（`webhooks.controller.ts` 查询投递日志；`reconciliation.job.ts` 对账扫描孤儿投递行，§3.5 回执） |
| 文档硬删除编排触发（新增，S-2/§3.3 回执） | M-08 `documents/application/schedule-purge.usecase.ts`（30 天宽限期满后发起） | 本模块 `thumbnails`/`comments` 各自 purge 用例消费；`permissions`/`media` 归 M-08，`document_updates`/`document_snapshots` 归 M-09，均不在本模块范围 |
| `document_updates`/`document_snapshots` | M-09 | 本模块只读引用 `latest` 快照（导出/审计） |
| `documents.title/status/ownerId/…` | M-08 | 本模块只读展示 |
| `permissions`/`document_perm_versions` | M-08 | 本模块 controller 经 `DocumentRoleGuard`/`RoleResolverService` 消费判定结果 |
| 事件 `command/audited`/`plugin/failed`/`permission/denied` | M-02/kernel 发布 | 本模块 `AuditEventSubscriber` 订阅 |
| 事件 `collab-server/repair`/`collab-server/update-rejected` | M-09 发布 | 本模块 `AuditEventSubscriber` 订阅（命名差异见 §12 G-25） |
| 协同控制帧 `CONTROL.event{comments.changed}` | M-09 转发（观察 Room 内 `resources.comments.*` 变更） | 本模块 `comment-mirror.observer.ts` |

**图 7-1 进程角色划分**（本模块仅服务端、无浏览器代码，改画 `OCE_ROLE` 三种进程角色与 M-09 headless Chromium 的关系）

```mermaid
flowchart LR
subgraph apiRole["api 角色"]
  restCtl["REST controller 受理并入队"]
end
subgraph workerRole["worker 角色"]
  importProc["import / export 处理器"]
  thumbProc["thumbnails / render-export 处理器"]
end
subgraph collabRole["collab 角色"]
  mirrorObs["comment-mirror.observer"]
end
m09Collab["M-09 collabServer Room广播"]
m09Renderer["M-09 ThumbnailRenderer 内部headless Chromium"]
restCtl -- "BullMQ 队列" --> importProc
restCtl -- "BullMQ 队列" --> thumbProc
thumbProc -- "调用" --> m09Renderer
m09Collab -- "CONTROL.event comments.changed" --> mirrorObs
```

图怎么读：同一份代码按 `OCE_ROLE` 部署成三种进程角色；本模块自己不管理 Chromium 进程池，`thumbnails` 处理器只是 M-09 `ThumbnailRenderer` 的调用方。

## 8. doc / sheet 扩展缝

| 参数化点 | 装配位置 | 扩展 doc/sheet 时的变化 |
|---|---|---|
| 导入/导出任务名 | `import-export/infrastructure/{import,export}.processor.ts` 当前硬编码调用 M-09 `importPptx`/`exportPptx` | M5 起 M-09 把任务改名为文档类型无关的 `import`/`export`（09 §8 已预告），本模块两个处理器改为按 `document.docType` 透传调用，不再硬编码 pptx 专属符号名 |
| 保真报告结构 | `import-export/domain/import-job.ts` 的 `FidelityReportSummary` | 复用同一类型形状（`degradedParts`/`missingFonts`/`limitHits`），字段语义随编解码器变化但类型零改动 |
| 渲染页路由 | `thumbnails/domain/thumbnail-key.ts` 的 `RenderRoute.documentType` | 新增 `documentType='doc'\|'sheet'` 取值透传给 `apps/web` 的 `/render` 路由（M-11），本模块零改动，只是透传字符串集合变大 |
| 评论锚点形状 | `comments/domain/anchor.ts` 的 `Anchor` zod schema | 设计为**开放判别联合**：现有 `{slideId,shapeId?,range?,snapshotSeq}` 之外为 doc/sheet 预留分支位；新增变体只需在 schema 追加 case 并注册，`CommentThread`/`CommentsRepository`/`comments.controller.ts` 全部按不透明 JSON 存取、不解析字段语义，零改动（判断依据见 §12 G-27） |
| 评论锚点索引（新增，§3.9 回执） | `comments/domain/anchor.ts` 的 `deriveAnchorKey` 纯函数 + `comments` 表生成列 `anchor_key` | 原索引 `anchor->>'slideId'` 具名援引 slide 专属字段名，与"generic"判定字面矛盾；改为对生成列 `anchor_key` 建索引，`deriveAnchorKey` 按 `Anchor` 判别式取值（现有 slide 分支取 `slideId`），doc/sheet 新分支只需在该函数追加对应 case，索引 DDL 与仓储查询零改动 |

**"必须零改动"的文件清单**：`jobs/`、`audit/`、`health/`、`metrics/`、`internal/`、`common/`、`config/` 全部文件，以及 BC-23 内除两个 processor 外的其余文件、BC-24 内除 `RenderRoute` 外的其余文件——不得出现任何文档类型字面量分支（沿用 08 §12 G-13 建议的 `no-doc-type-literals-server` 扫描器，本文档要求其覆盖路径扩展至 `apps/server/src/modules/{jobs,import-export,thumbnails,comments,audit,health,metrics,internal}/**`）。对应 `12-extension-to-doc-and-sheet.md` §3 的参数化点：本模块贡献两个新落点（导入/导出任务名透传、渲染页 `documentType` 透传），module-map 原 12 号文档未记录服务端 Nest 模块的参数化点（仅讨论 `packages/*`），均标"新增建议"。

## 9. 测试布局

```text
apps/server/test/                              端到端（跨模块）：Nest Testing + testcontainers（PG/Redis/MinIO）+ mock OIDC
├── e2e/import-export-roundtrip.e2e-spec.ts     上传 → 导入作业 → 快照 → 导出 → 字节级一致（SV-02）
├── e2e/thumbnails-pipeline.e2e-spec.ts         导入完成 → 首页缩略图 ≤ 10 s → 全量缩略图 → 版本变更触发失效
├── e2e/comments-mirror.e2e-spec.ts             客户端经协同 WS 写评论 → 服务端镜像 ≤ 1 s 收敛 → REST 查询一致
├── e2e/webhooks-delivery.e2e-spec.ts           新增（rulings §4.12 U-14）：注册订阅 → 评论事件触发投递 → HMAC 签名验证 → 重试与死信
├── e2e/audit-and-health.e2e-spec.ts            关键动作产生审计行并只追加、哈希链可校验（新增，U-15）；探针依赖故障注入 → 503
├── fixtures/                                    语料库子集（复用 M-04/M-09 fixtures）、租户/文档种子
└── helpers/                                     supertest 封装、BullMQ 测试队列 helper、mock OIDC
```

| 测试类型 | 覆盖 | 对应源文件 |
|---|---|---|
| 单元 | 幂等键、状态机、缓存键、上限校验、保留策略、@提及解析 | 各模块 `__tests__/*.spec.ts`（§5） |
| 处理器集成 | BullMQ 处理器 + 真实 Postgres/Redis（testcontainers） | `{import,export,thumbnails,render-export}.processor.spec.ts` |
| append-only 断言 | 数据库角色拒绝 `audit_log` 的 `UPDATE`/`DELETE` | `audit.repository.append-only.spec.ts` |
| e2e | 见上表四条主链路 | `apps/server/test/e2e/*` |

覆盖率与性能预算引用 08-backend-nestjs.md §12（导入 D50 ≤ 5 s / D200 ≤ 20 s p95、导出 pptx ≤ 3/12 s、缩略图 ≤ 400 ms/页 p95 等）；本模块特有预算：评论镜像收敛 ≤ 1 s（ADR-0031）、审计写入吞吐 ≤ 50 事务/s/文档无背压（SV-07）、`/readyz` 判定 ≤ 200 ms（新增建议，未见于既有文档，§12 G-28）。

## 10. 机械约束

| 约束 | 规则 / 字段 | 引用 |
|---|---|---|
| `package.json#oce`（`apps/server` 整体） | `{layer:'L8',iso:'node',role:'app'}`（本模块与 M-08/M-09 共享同一 `apps/server` 包） | charter §5.2；02 §3.2 |
| `server-app-thin` | `apps/server/src/modules/**` 不得 `import 'yjs'`/`@oce/model-*`/`@oce/ooxml-*`（本模块处理器只经 `CordisHostService`/`HeadlessJobContext` 间接调用，铁律 4） | module-map §9；02 §3.2（与 M-08 §10 同一处理） |
| protocol-only DTO | controller `@Body()`/`@Query()` 类型只能是 `z.infer<typeof X>`，`X` 来自 `@oce/protocol` | module-map §4.2 第 1 条 |
| append-only | `audit_log` 表的数据库角色无 `UPDATE`/`DELETE` 权限（迁移脚本层面授权，非仅应用层约定） | SV-07；硬规则 |
| `provider-runs-conformance` | 不适用——本模块全部仓储为普通 Nest DI，无 cordis Definition/Provider（§2.5 已述） | 对比 M-08 §2.5/M-09 §2.5 |
| `no-doc-type-literals-server`（建议扩展覆盖路径） | 扩展至本模块 9 个 Nest 目录 `apps/server/src/modules/{jobs,import-export,thumbnails,comments,audit,health,metrics,internal,webhooks}/**`（`webhooks` 为新增，rulings §4.12 U-14） | 08 §12 G-13；本文档 §8 |
| 幂等键格式 | `` `${domain}:${docId}:${inputHash}` ``，由 `buildIdempotencyKey` 唯一生成 | 硬规则；§2.2/§2.3 |
| 限流/审计解释器单点 | `@Audited()`/`@RateLimit()` 解释器只能在 `common/`，标注使用点分布在各 BC 自身模块 | M-08 §3 裁定 |
| 09-type-discipline 章节 | 03-boundaries §3.3（L8 · node · app，与 M-08/M-09 共享秩 80） | module-map §9 BC-23…26 行 |

## 11. 里程碑与实施顺序

**M0 骨架**：9 个 `*.module.ts`（含 `webhooks.module.ts`，rulings §4.12 U-14；实现推迟到 M3，见下） + 各 `domain/` 聚合/值对象类型（无实现）+ `common/`/`config/` 全部文件（异常过滤器/审计拦截器骨架可先 no-op）；`AppModule.forRole()` 完成本模块 9 个模块的注册（08-backend-nestjs §2 提及的根装配由本模块补齐，见 §7）；`jobs/infrastructure/queues.ts` 定义全部队列名但处理器为空实现；`config/config.schema.ts` 能让进程以 `--dry-run` 校验通过。

**M1**：`jobs`（`BaseProcessor`/`JobRunsRepository`/`GetJobUseCase` 完整）；`health`/`metrics`（探针与指标端点打通，依赖 M-08/M-09 骨架服务）；`audit`（`AuditInterceptor`+`RecordAuditEventUseCase`+`AuditEventSubscriber` 打通，覆盖 M-08 usecase 的 `@Audited()` 标注点）；`common/`/`config/` 完整（含限流/异常过滤器真实实现）。

**M2 首个可运行切片**：上传 pptx → 创建导入作业（`import.processor.ts` 调用 M-09 `importPptx`，依赖 M-09 M2 交付的 `server-headless` 任务打通）→ 快照写入与文档创建 → 首页缩略图（`thumbnails.processor.ts` 调用 `ThumbnailRenderer`，M-09 该能力属其 M3 展望范围，此处允许降级为占位图直到其就绪）→ `/healthz`/`/readyz` 反映全链路健康。

验收命令（草案，最终以 CI 配置为准）：
```bash
pnpm --filter apps-server test -- jobs audit health            # 单元 + append-only 断言
pnpm --filter apps-server test:e2e -- import-export-roundtrip  # 上传→导入→快照→导出字节级一致（SV-02）
pnpm --filter apps-server test:e2e -- thumbnails-pipeline      # 导入完成→首页缩略图 ≤10s
curl -f http://localhost:$PORT/healthz && curl -f http://localhost:$PORT/readyz
```

**M3 Webhook 出口**（rulings §4.12 U-14，2026-09-19 新增，属本模块交付范围）：新增 `webhooks` 模块——注册/更新/删除订阅、投递（HMAC 签名 + 指数重试 + 死信队列）、投递日志查询（§2.6/§4.11/§5.11）；`comments/application/mirror-comment-change.usecase.ts` 接入 `DeliverWebhookEventUseCase`；`comments` 模块新增跨文档「@我」REST（`list-my-mentions.usecase.ts`）。验收：`pnpm --filter apps-server test:e2e -- webhooks-delivery`（注册→投递→签名验证→重试与死信，见 §9）。

**M3 审计哈希链**（rulings §4.12 U-15，2026-09-19 新增，属本模块交付范围）：`AuditEntry` 增加 `prevHash`/`hash`（§2.1）；纯函数 `chainHash`（§2.3）；`verify-chain.usecase.ts` 校验工具、`seal.job.ts` 每日封存作业（§2.6/§4.5/§5.5）；数据库角色隔离（无 `UPDATE`/`DELETE`）与哈希链并行生效，互不替代。验收：`pnpm --filter apps-server test -- audit-chain`（篡改检测断言，见 §9）。

**M3 展望**（不在 M0/M2 交付范围）：`comments` 模块打通（依赖 M-09 的 `CONTROL.event{comments.changed}` 转发与 ADR-0034 软门禁落地）；PDF/PNG/JPEG `render-export` 队列完整落地。**M4 展望**：SV-13 headless 自动化 API 四种作业类型（`fill-template`/`validate`/`migrate`/`convert`）均并入 `import-export`，经既有 `HeadlessJobContext` + M-02 命令管线编排，不新增 `server-headless` 任务导出，细节 M4 一起定（rulings §4.12 U-13，§2.6 已加占位行，见 §13 Q-3）。

## 12. 与现有文档的差异与追加建议

> 延续 module-map §8、08-server-identity-documents-and-storage §12（G-1…G-14）、09-server-collab-gateway-and-headless-host §12（G-15…G-22）的编号，以下延续为 G-23 起。

| # | 涉及文档 | 差异 / 发现 | 追加建议（不直接生效） |
|---|---|---|---|
| G-23 | module-map §3 BC-26 行 vs 09 §4.3 | module-map 把 `cordis-host/adapters/{pino-logger,otel-telemetry,errors-reporter}.adapter.ts` 同时列入 BC-26（本模块）承载包，但 09 §4.3 已明确裁定三文件"物理归属"M-09；本文档遵照任务书指示只引用不重复定义，§3/§4 记录本模块在该目录新增 0 个文件 | **已结案（2026-09-18，跨模块评审 C-10）**：`cordis-host/adapters/*` 物理归属 M-09，本模块的引用（非新增）性质确认无误；00-module-map §7 M-12 行"覆盖的包与目录"由总编排回写加注"（引用，非新增，物理归属 M-09）" |
| G-24 | `@oce/protocol` 目录树（M-02 §4.3/§5.3）、10-observability-and-errors §1.1 domain 清单 | `rest/` 缺 `thumbnails.ts`/`comments.ts`/`webhooks.ts`（`webhooks.ts` 为 rulings §4.12 U-14 新增）；`errors/codes.ts` 的 domain 清单未列 `server.thumbnails`/`server.comments`/`server.audit`/`server.import`/`server.export`/`server.webhook`（`server.jobs` 已列） | 建议 M-12 实现期在 `@oce/protocol` 内直接新增 `rest/{thumbnails,comments,webhooks}.ts` 三文件并向 `ErrorCodes` 追加六个 domain 的声明合并（沿用 M-08 §12 G-7 处理方式：先在包内新增，事后知会 M-02/架构 10 文档维护者回补目录清单）；`rest/webhooks.ts` 一项已由总编排回写 `40-modules/02` §4/§5（新增建议→已采纳） |
| G-25 | module-map §3 BC-26 行 vs 09 §2.4/§3.1 | module-map 把本模块订阅的事件写作 `collab/repair`；M-09 §2.4/§3.1 实际发布的事件名是 `collab-server/repair`（与 `collab-server/room-opened` 等三个事件同前缀） | **已结案（2026-09-18，跨模块评审 C-08）**：`collab-server/repair`/`collab-server/update-rejected` 为准（`collab-server` 域已提请收编进 charter §5.5/03 §3.6 保留域名单）；本文档 §2.4/§7.3 已按此订阅；module-map §3 BC-26 行由总编排回填修正 |
| G-26 | 09 §2.5（`ThumbnailRenderer` 定义为"M-12 的 BullMQ 处理器是唯一调用方"）vs 09 §6（对外 API 面表未列 `ThumbnailRenderer`）；08-backend-nestjs §2 写作 `server-headless.renderThumbnails` | `@oce/server-headless` 的公开导出（`createHeadlessHost`/`importPptx`/`exportPptx`/`validateSnapshotTask`/`migrateTask`/`diffSnapshots`/`HeadlessJobContext`）不含任何获取 `ThumbnailRenderer` 实例的方式，且 08 号文档符号名 `renderThumbnails` 与 09 号文档定义的 `ThumbnailRenderer.render()`/`.renderPdf()` 方法形态不一致 | **已结案（2026-09-18，跨模块评审 C-09）**：`HeadlessHost` 增只读字段 `thumbnails: ThumbnailRenderer`，M-09 §6 已补齐该导出；`renderThumbnails` 符号名作废；本文档 §5.3 `headless-renderer.accessor.ts` 已按此实现，§13 Q-1 同步结案 |
| G-27（回应 module-map §10 Q-M4） | module-map §6.1（BC-25 暂定 `parametrized`） | module-map §6.1 把 BC-25 标为 `parametrized`（理由：评论锚点形状随文档类型变化），并在 §10 Q-M4 明确留待"总编排/12 号文档作者正式确认" | 本文档裁定改判为 `generic`：锚点形状的可变性通过把 `comments/domain/anchor.ts` 的 `Anchor` schema 设计为开放判别联合来吸收（§8），本模块仓储/controller/观察者代码本身对锚点字段语义零感知、零分支，doc/sheet 扩展时零改动；建议 module-map §6.1/§10 采纳本文档结论并将 Q-M4 标记已解决 |
| G-28（新增建议） | 08-backend-nestjs §12 预算表 | 该表未给 `/readyz` 判定延迟预算 | 本文档 §9 新增"`/readyz` 判定 ≤ 200 ms"预算，建议补入 08 号文档 §12，登记于 §13 Q-8 |
| G-29 | 08-backend-nestjs §7（"并发 2/进程"）vs §16.5（"导入/导出并发默认 4/实例（§7 表中的 2 作废）"） | 同一文档内两处并发数字冲突，§16.5 显式声明覆盖 §7 | 本文档 §11/§5 一律采纳 §16.5 的 4；建议 08 号文档下次修订直接删除 §7 表格旧数字而非仅在 §16.5 声明作废，避免继续被引用 |
| G-30（新增建议） | 08-backend-nestjs §16.3（"`pdf.processor`（与 `thumbnails.processor` 同池）"）未指派 Nest 模块归属 | PDF/PNG/JPEG 导出与缩略图共享 headless Chromium 池，但两号文档均未明确该 processor 物理归属哪个 Nest 目录 | 本文档裁定归属 `thumbnails` 模块（持有 Chromium/`ThumbnailRenderer` 访问权），经 `RenderExportProducerService` 供 `import-export` 模块的 `ExportsController` 跨模块调用（§3/§7.1）；建议采纳，登记于 §13 Q-4 |
| G-31（新增建议） | PRD `06-server-and-ops.md` SV-13（`fill-template`/`convert`/`validate`/`migrate` 四种作业类型） | SV-13 依赖能力写"`server-headless`、`commands`（模板填充命令）"；`convert`/`validate`/`migrate` 可直接映射到 M-09 已导出的 `exportPptx`/`validateSnapshotTask`/`migrateTask`，但 `fill-template` 没有对应的既有任务导出，且哪个 Nest 模块承载该 REST 面未定 | **已结案（2026-09-19，rulings §4.12 U-13）**：四种作业类型均并入 `import-export` 模块，不新设 `modules/automation/`；`fill-template` 经既有 `HeadlessJobContext` + M-02 `commands.execute()` 编排，不需 M-09 新增任务导出；具体 usecase/队列/REST 细节留待 M4 一并设计（§2.6 已加占位行） |
| G-32（U-14 落地） | `40-modules/14` §6.1；用户裁决 rulings §4.12 U-14 | CO-04"评论事件交给集成方"客户端回调 vs 服务端 Webhook 二选一未定（Q-6） | **已落地（2026-09-19）**：两者 M3 都做——新增 `webhooks` Nest 模块（BC-25 关联，独立于 `comments`）——聚合 `WebhookSubscription`/`WebhookDelivery`（§2.1）、注册/更新/删除订阅+投递+投递日志查询用例（§2.6）、目录树与文件表 §4.11/§5.11（13 个文件）、protocol `rest/webhooks.ts`（§7.2）；`comments/application/mirror-comment-change.usecase.ts` 接入投递；新增跨文档「@我」REST `list-my-mentions.usecase.ts`；M3 交付切片见 §11；架构 `08-backend-nestjs.md` §5 补 `webhook_subscriptions`/`webhook_deliveries` 两表；PRD `06-server-and-ops.md` SV-15 提前到 M3、`03-collaboration.md` CO-04、`05-milestones-and-scope.md` M3 同步 |
| G-33（U-15 落地） | `40-modules/14` §6.1；用户裁决 rulings §4.12 U-15 | `audit_log` 哈希链（SV-07"不可篡改…P1：哈希链"）是否 M3 实现未定（Q-9） | **已落地（2026-09-19）**：M3 即实现——`AuditEntry` 新增 `prevHash`/`hash`（§2.1）、纯函数 `chainHash`（§2.3）、用例链式写入/校验工具/每日封存作业（§2.6）、新增文件 `audit-chain.ts`/`verify-chain.usecase.ts`/`seal.job.ts`（§4.5/§5.5）；M3 交付切片见 §11；架构 `08-backend-nestjs.md` §5 `audit_log` 补 `prev_hash`/`hash` 字段；PRD `06-server-and-ops.md` SV-07 P1 哈希链提前到 M3 |
| G-34（S-5 落地） | `40-modules/00-module-map.md` §3/§4.1/§6.1/§7；评审 `15-server-architecture-review.md` §3.10 | `webhooks` 此前未登记独立限界上下文编号，寄生于 BC-25 | **已落地（2026-09-21）**：module-map 新增 `### BC-30 出站集成（Webhook）`，§4.1 关系表补 BC-25→BC-30、BC-30→外部集成方两行，§6.1 通用性分类补 `generic`，§7 M-12 行"覆盖上下文"改为 BC-23/24/25/26/30；本文档 §0/§1.1/§1.3 同步补充（`40-modules/00-module-map.md`；本文档 §0/§1.1/§1.3）。**结案依据**：用户裁决 rulings §4.13 S-5 |
| G-35（S-4 落地） | 评审 `15-server-architecture-review.md` §3.8 | Webhook 出站请求缺 SSRF 防护 | **已落地（2026-09-21）**：新增 `webhooks/infrastructure/egress-guard.ts`（订阅创建/更新尽力校验、每次投递前关键防线校验，解析后锁定 IP 防 DNS 重绑定）；`config/config.schema.ts` 新增 `webhookEgressAllowlist` 部署级放宽白名单项（自托管场景）；§2.1/§2.3/§2.5/§2.6/§4.11/§5.11 已同步。**结案依据**：用户裁决 rulings §4.13 S-4 |
| G-36（S-2 落地，M-12 部分） | 评审 `15-server-architecture-review.md` §3.3 | SV-11 硬删除级联在 M-12 无归属用例 | **已落地（2026-09-21）**：`thumbnails`/`comments` 各自新增 `purge-document-{thumbnails,comments}.usecase.ts`，响应 `documents`（M-08）编排触发的宽限期满调度，清理各自表；`permissions`/`media` 归 M-08，`document_updates`/`document_snapshots` 归 M-09，不在本模块范围；§2.6/§4.3/§4.4/§5.3/§5.4/§7.3 已同步。**结案依据**：用户裁决 rulings §4.13 S-2 |
| G-37（§3.5 落地） | 评审 `15-server-architecture-review.md` §3.5 | 作业入队与 Webhook 投递缺少 Outbox 保证 | **已落地（2026-09-21）**：`jobs` 模块新增 `infrastructure/reconciliation.job.ts` 定期扫描孤儿 `job_runs`/`webhook_deliveries` 行（已写库未入队或入队后消失）重新入队并告警；判定逻辑拆出纯函数 `isOrphanedQueueRow`（§2.3）；§2.6/§4.1/§5.1 已同步；跨模块消费 `webhooks` 表需要 `WebhooksModule` 补一个仓储/查询导出面，本文档 §3 尚未补（追加建议，非本轮范围）。**结案依据**：rulings §4.13"同时确认"段（评审 §3 其余问题按 §4.4 执行）；§3 导出面已补（`WebhooksModule` 导出 `WebhookRepository`、`JobsModule` 增 imports，2026-09-21 总编排） |
| G-38（§3.9 落地） | 评审 `15-server-architecture-review.md` §3.9 现状 A | `comments` 的 `anchor->>'slideId'` 具名索引与 `generic` 判定字面矛盾 | **已落地（2026-09-21）**：新增生成列 `anchor_key`（`domain/anchor.ts` 的 `deriveAnchorKey` 纯函数按判别式提取，不依赖具体字段名）替代具名字段索引；DDL 归属架构 08 §5（由另一路回写员落地）；§2.1/§2.3/§2.5/§4.4/§5.4/§8 已同步。**结案依据**：rulings §4.13"同时确认"段 |

### 2026-09-18 收敛

> 总编排已采纳 `40-modules/14-cross-module-review.md` §1 全部 30 条裁定，以下五条涉及本文件，逐条落地；详见对应 §0/§1.1/§1.3/§2.4/§2.5/§4.3/§5.3/§7.3/§12/§13 各处的行内标注。

| C 编号 | 裁定摘要 | 本文件落地位置 |
|---|---|---|
| C-08 | 服务端事件名以 `collab-server/repair`、`collab-server/update-rejected` 为准 | §2.4、§7.3（已是既有实现）、§12 G-25 结案、§13 Q-2 结案 |
| C-09 | `ThumbnailRenderer` 经 `HeadlessHost.thumbnails` 只读字段访问 | §2.5、§4.3、§5.3、§12 G-26 结案、§13 Q-1 结案 |
| C-10 | `cordis-host/adapters/*` 引用非新增，物理归属 M-09 | §0（已是既有实现）、§12 G-23 结案 |
| C-24 | 审计 `action` 点式串口径，与 M-08 一致 | §1.3（新增确认段）、§2.4（已是既有实现，补充确认） |
| C-15 | 能力位词汇统一为 `Capability` | 本文件未直接引用 `Capability`/`CapabilityBit`/`PermissionAction`（权限判定委托 M-08 `DocumentRoleGuard`/`RoleResolverService`），无需改动 |

## 13. 未决问题

| # | 问题 | 推荐默认值 | 影响范围 |
|---|---|---|---|
| Q-1 | ~~`ThumbnailRenderer` 的 `@oce/server-headless` 对外导出形态未定~~（G-26）**（结案，2026-09-18）** | `HeadlessHost` 增加只读字段 `thumbnails: ThumbnailRenderer`。**结案依据**：跨模块评审 C-09 采纳本行推荐默认值 | M-09 `server-headless/interface/host/create-server-host.ts`；本模块 `headless-renderer.accessor.ts` |
| Q-2 | ~~`collab-server/repair` 与 module-map BC-26 行 `collab/repair` 命名不一致~~（G-25）**（结案，2026-09-18）** | 以 M-09 §2.4 实际发布名 `collab-server/repair` 为准，module-map 回填。**结案依据**：跨模块评审 C-08 采纳本行推荐默认值 | module-map §3 BC-26 行；本模块 `audit-event.subscriber.ts` |
| Q-3 | ~~SV-13 四种作业类型的 Nest 模块归属（G-31）~~ **（结案，2026-09-19）** | **四者均并入 `import-export`**（细节 M4 一起定），不新设 `modules/automation/`。**结案依据**：用户裁决 rulings §4.12 U-13 | `import-export/` 目录树（§2.6 占位行，M4） |
| Q-4 | PDF/PNG/JPEG 导出物理归属 `thumbnails` 模块是本文档设计判断（G-30），是否需总编排/08 号文档正式采纳 | 采纳（复用 Chromium 池成本最低） | 08-backend-nestjs §1/§2；本文档 §3/§7 |
| Q-5 | `comments/domain/anchor.ts` 的判别联合精确形状（页/元素/文本范围三种现状 + 未来 doc/sheet 分支）由谁在 M3 定稿 | 本模块与 M-09/客户端 `comments` 插件联合定稿，落 `@oce/protocol` `rest/comments.ts`（G-24） | `comments/domain/anchor.ts`；`@oce/protocol` |
| Q-6 | ~~CO-04"评论事件通过事件回调交给集成方"的精确机制——客户端 EM-05 回调 vs 服务端 SV-15 Webhook，M3 范围如何取舍（§2.4/§2.6）~~ **（结案，2026-09-19）** | **两者 M3 都做**：客户端 EM-05 回调（不在本模块范围）+ 服务端 SV-15 Webhook（注册/签名/重试/死信，新增 `webhooks` 模块）+ 服务端跨文档「@我」REST。**结案依据**：用户裁决 rulings §4.12 U-14，落地见 §2.1/§2.4/§2.6/§4.11/§5.11/§11/§12 G-32 | `comments/application/mirror-comment-change.usecase.ts`；`webhooks/` 全模块 |
| Q-7 | 导入/导出并发默认值 2 vs 4 的最终口径（G-29） | 采纳 08-backend-nestjs §16.5 的 4/实例 | `jobs/infrastructure/queues.ts` |
| Q-8 | `/readyz` 判定延迟预算 200 ms（G-28）是否需正式写入 08-backend-nestjs §12 | 是 | 08-backend-nestjs.md §12 |
| Q-9 | ~~`audit_log` 哈希链（SV-07"不可篡改…P1：哈希链"）是否在 M3 范围内实现~~ **（结案，2026-09-19）** | **M3 即实现**：`prevHash`/`hash` 链式校验 + `chainHash` 纯函数 + 校验工具 + 每日封存作业；与数据库角色权限隔离并行生效。**结案依据**：用户裁决 rulings §4.12 U-15，落地见 §2.1/§2.3/§2.6/§4.5/§5.5/§11/§12 G-33 | `audit/domain/audit-entry.ts`；`audit/domain/audit-chain.ts`；`audit.repository.ts` |
