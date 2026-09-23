> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-21 | 依赖：charter v0.1

# 08 后端（NestJS 11 壳 + cordis 宿主）：模块图、目录级结构、数据模型、存储布局、队列、网关扩展、安全、部署

> 读者：实现 `apps/server`、`@oce/server-collab`、`@oce/server-storage`、`@oce/server-headless` 的工程师；运维。
> 章程锚点：R4、D8（Nest 只是传输壳，业务逻辑在 `server-*`，Nest 内嵌 cordis 宿主复用 iso 插件）、D11、D12、§5.3 规则 4（`@nestjs/*` 仅 `apps/server`）、§10 Q5/Q6/Q8/Q10。
> 相关 ADR：0022（存储栈）、0023（传输协议）、0025（update 持久化与压缩）、0026（headless 渲染）、0029（网关鉴权）、0030（观测栈）、0031（评论存储）、0034（服务端校验与修复）、0035（网关横向扩展）。
> 协同语义见 06；渲染见 07；错误/日志/遥测见 10。REST/WS DTO 全部来自 `@oce/protocol`（zod，D2）。

---

## 0. 一页总览

```
                     ┌──────────────────────────── apps/server（NestJS 11，Fastify 适配器） ────────────────────────────┐
  浏览器 ── HTTPS ──►│ Auth(OIDC) · Tenants · Users · Documents(+Permissions,ShareLinks) · Media · Snapshots · Comments   │
  (apps/web)         │ ImportExport(API) · Thumbnails(API) · Audit · Health · Metrics · Internal                          │
           ── WSS ──►│ CollabGateway(薄) ──► @oce/server-collab RoomManager ──► Room = 服务端 Unit（cordis 宿主内）        │
                     │                                          │                                                        │
                     │ CordisHostModule：createHost → preset-server（kernel 基础服务适配 + model-core + store-yjs +       │
                     │                  model-slide + ooxml-core + ooxml-pptx [+ engine-layout]）                        │
                     │ JobsModule(BullMQ) ──► worker 角色：import.processor · export.processor · thumbnails.processor    │
                     │                                     └──► @oce/server-headless（同一宿主；Playwright 池）           │
                     └───────────┬───────────────────────────┬─────────────────────────────┬───────────────────────────┘
                                 ▼                           ▼                             ▼
                        Postgres 16                     Redis 7                        S3 兼容（MinIO）
             documents / updates / snapshots /   pub/sub 扇出 · 权限变更通知 ·      media（内容寻址）· 大快照 ·
             permissions / comments / audit …    租约锁 · BullMQ · 房间计数        导入原件 · 导出结果 · 缩略图
```

进程角色（同一镜像，`OCE_ROLE` 环境变量）：`api`（REST）、`collab`（WS 网关 + 房间）、`worker`（队列处理器 + headless）、`all`（单体，docker-compose 默认）。K8s 下分开扩缩（§10）。

---

## 1. Nest 模块图与职责

```
AppModule(按 role 装配)
├── ConfigModule(global)          zod 解析环境变量；启动即失败（D2）
├── ObservabilityModule(global)   OTel SDK / pino / 请求上下文 AsyncLocalStorage（10）
├── DbModule(global)              Drizzle + pg Pool；迁移在启动前由独立命令执行
├── RedisModule(global)           ioredis：pub/sub 连接与命令连接分离
├── CordisHostModule(global)      宿主生命周期（§4）
├── AuthModule                    OIDC 登录/回调/登出、会话 JWT、API Key、collab ticket 签发
├── TenantsModule · UsersModule   租户/成员/配额；OIDC subject ↔ user 映射
├── DocumentsModule               文档 CRUD、回收站、锁定；PermissionsService；ShareLinks
├── StorageModule                 绑定 @oce/server-storage Provider；预签名 URL
├── MediaModule                   内容寻址媒体上传/下载/去重/嗅探/消毒/配额
├── CollabModule(role collab)     CollabGateway + ticket 校验 + Redis FanoutBus/Lock/Authz 实现 → server-collab
├── SnapshotsModule               版本列表、latest（ETag/zstd）、命名、恢复
├── ImportExportModule            导入/导出 REST + processors（role worker）
├── ThumbnailsModule              缩略图 REST + processor（role worker，依赖 server-headless）
├── CommentsModule                评论线程 CRUD、锚点、解决、实时通知（经 room 控制帧）
├── AuditModule                   AuditService（append-only）+ 查询
├── JobsModule                    BullMQ 队列/处理器基类/死信
├── HealthModule                  /healthz /readyz（terminus）
├── MetricsModule                 /metrics（独立端口）
└── InternalModule                /internal/*（网络策略限内网）：render state、diagnostics、admin 操作
```

| 模块 | 依赖的 `server-*`/`@oce` 包 | 关键不变量 |
|---|---|---|
| CollabModule | server-collab、protocol | Gateway 内**零协同逻辑**：只做连接适配、票据校验、限流计数 |
| ImportExportModule/ThumbnailsModule | server-headless、server-storage | 处理器只编排；转换逻辑全在 `server-headless.tasks` |
| DocumentsModule/SnapshotsModule | server-collab（SnapshotService）、protocol | 权限变更必须 publish `perm:doc:{id}`（06 §10） |
| MediaModule/StorageModule | server-storage | 媒体只按 sha256 寻址；从不信任客户端声明的 MIME |
| 所有 controller | protocol | 入参 `zod.parse`，出参也经 schema（防泄漏字段） |

---

## 2. `apps/server` 目录级结构

```
apps/server/
├── package.json                        唯一允许 @nestjs/*；deps：@oce/server-collab @oce/server-storage @oce/server-headless @oce/protocol @oce/kernel
├── nest-cli.json · tsconfig.json · tsconfig.build.json
├── Dockerfile                          多阶段：build → runtime(node:22-slim + fonts 包 + chromium 仅 worker 变体)
├── docker/
│   ├── entrypoint.sh                   迁移（可选）→ 按 OCE_ROLE 启动
│   └── healthcheck.sh
├── drizzle.config.ts
├── src/
│   ├── main.ts                         顺序：OTel SDK → 读配置 → NestFactory(Fastify) → WsAdapter(ws) → 全局 filter/pipe/interceptor → 优雅关闭钩子（SIGTERM：拒新连接 → drain rooms → flush jobs → 退出，上限 30 s）
│   ├── app.module.ts                   根模块；`forRole(role)` 组合
│   ├── config/
│   │   ├── config.schema.ts            zod：{ role, http:{port,trustProxy}, db:{url,poolMax}, redis:{url}, storage:{provider,s3:{…}}, auth:{oidc:{issuer,clientId,clientSecret,redirectUri}, jwt:{keys, ttl}, ticketTtlSec:60}, collab:{…server-collab Config}, limits:{upload, zip, rate}, headless:{chromiumPath, poolSize}, telemetry:{otlpUrl, sampling} }
│   │   ├── config.module.ts            解析一次、注入 typed `AppConfig`；解析失败 → 进程退出码 78
│   │   └── roles.ts                    role → 模块列表
│   ├── common/
│   │   ├── filters/oce-exception.filter.ts        OceError → RFC 9457 problem+json（映射表：protocol/errors/http-map）；ZodError → 400；未知错误 → 500 + errors.report
│   │   ├── interceptors/request-context.interceptor.ts   requestId/traceparent/tenant/user → ALS；`ctx.extend` 元数据供日志
│   │   ├── interceptors/audit.interceptor.ts     `@Audited(action)` 的 handler 成功后写 audit_log（含前后差异摘要）
│   │   ├── guards/session.guard.ts                会话 JWT / API Key → `Principal`
│   │   ├── guards/document-role.guard.ts          `@RequireDocRole('editor')`：查 permissions（含 share link、租户默认）→ 无显式允许即 403（D12）
│   │   ├── guards/tenant-admin.guard.ts
│   │   ├── pipes/zod.pipe.ts                      protocol schema → parse
│   │   ├── decorators/{principal,tenant,audited,require-doc-role}.ts
│   │   └── rate-limit/{rate-limit.guard.ts, redis-token-bucket.ts}
│   ├── cordis-host/
│   │   ├── cordis-host.module.ts       OnModuleInit：createHost；OnApplicationBootstrap：加载 preset-server 并 `await fiber.await()`；OnApplicationShutdown：dispose（§4）
│   │   ├── cordis-host.service.ts      `root: Context`；`openUnit(docId, source)`/`closeUnit`；`withRequestMeta(meta, fn)`；`diagnostics()`（dumpFiberTree/effects/PENDING）
│   │   ├── preset-server.ts            服务端插件束与默认配置（见 §4.2）
│   │   └── adapters/{pino-logger.adapter.ts, otel-telemetry.adapter.ts, errors-reporter.adapter.ts}   kernel 基础服务的 Node 实现（10）
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.module.ts · auth.controller.ts（/auth/oidc/login, /callback, /logout, /me, /token/refresh）· auth.service.ts
│   │   │   ├── oidc/{oidc.client.ts（openid-client v6，discovery 缓存）, pkce.ts, state-store.ts（Redis, 10 min）}
│   │   │   ├── tokens/{jwt.service.ts（ES256、JWKS 轮换、kid）, session-cookie.ts（httpOnly/SameSite=Lax）, ticket.service.ts（collab ticket：sub/tid/doc/role/permVersion/jti/exp 60 s）}
│   │   │   ├── api-keys/{api-key.service.ts（哈希存储、scopes）, api-key.guard.ts}
│   │   │   └── principal.ts            Principal = { kind:'user'|'apiKey'|'shareLink', id, tenantId, scopes }
│   │   ├── tenants/{tenants.module.ts, tenants.controller.ts, tenants.service.ts, quotas.service.ts}
│   │   ├── users/{users.module.ts, users.controller.ts, users.service.ts}
│   │   ├── documents/
│   │   │   ├── documents.module.ts · documents.controller.ts（GET/POST /documents, GET/PATCH/DELETE /documents/:id, POST /:id/restore, POST /:id/collab-ticket）
│   │   │   ├── documents.service.ts · documents.repository.ts
│   │   │   ├── permissions/{permissions.controller.ts（GET/PUT/DELETE /documents/:id/permissions…）, permissions.service.ts（写库 + permVersion++ + PUBLISH perm:doc:{id} + audit）, role-resolver.ts（principal → Role，含 share link 与租户默认；结果缓存 5 s）}
│   │   │   └── share-links/{share-links.controller.ts, share-links.service.ts}
│   │   ├── storage/{storage.module.ts（按 config 绑定 S3/local Provider）, presign.controller.ts}
│   │   ├── media/{media.module.ts, media.controller.ts（POST /media/presign, POST /media/commit, GET /media/:sha256）, media.service.ts（sha256 校验、MIME 嗅探、SVG 消毒、尺寸探测、配额、document_media 关联）, sniff.ts, svg-sanitize.ts}
│   │   ├── collab/
│   │   │   ├── collab.module.ts
│   │   │   ├── collab.gateway.ts       `@WebSocketGateway({ path: '/collab/v1/rooms/:documentId' })`（ws 适配器）：连接计数、IP 限流、首帧 5 s 超时、把 socket 包装为 ServerConnection 交给 RoomManager.attach()
│   │   │   ├── ws-connection.adapter.ts   ws.WebSocket → server-collab `ServerConnection`（send/close/onFrame/remoteInfo）
│   │   │   ├── ticket-verifier.ts      JWT 验签 + jti 防重放（Redis SETNX 60 s）+ permVersion 对比
│   │   │   ├── redis-fanout.bus.ts     server-collab `FanoutBus` 的 Redis 实现（channel collab:doc:{id}；instanceId 去重）
│   │   │   ├── redis-lease-lock.ts     `LeaseLock`（SET NX PX + 续租 + fencing token）
│   │   │   ├── pg-update-store.ts      `UpdateStore`（批量 INSERT document_updates；loadSince）
│   │   │   ├── pg-snapshot-store.ts    `SnapshotStore`（≤ 1 MiB 内联 bytea，否则 S3 引用）
│   │   │   └── authz-source.ts         `AuthorizationSource`（role-resolver + perm:doc 订阅）
│   │   ├── snapshots/{snapshots.module.ts, snapshots.controller.ts（GET /documents/:id/snapshots, GET …/latest（ETag、zstd、Cache-Control: private, max-age=0, must-revalidate）, GET …/:snapshotId, POST …（命名）, POST …/:snapshotId/restore）, snapshots.service.ts}
│   │   ├── import-export/
│   │   │   ├── import-export.module.ts · imports.controller.ts（POST /imports{storageKey|multipart≤200MB}, GET /imports/:jobId）· exports.controller.ts（POST /documents/:id/export, GET /exports/:jobId）
│   │   │   ├── import.processor.ts     BullMQ `import`：拉原件 → server-headless.importPptx → 写 snapshot(kind import) + media 关联 → 创建/更新 document → audit
│   │   │   ├── export.processor.ts     BullMQ `export`：latest state → server-headless.exportPptx → S3 exports/ → 24 h 签名 URL
│   │   │   └── import-export.service.ts
│   │   ├── thumbnails/{thumbnails.module.ts, thumbnails.controller.ts（GET /documents/:id/thumbnails/:slideId?seq=）, thumbnails.processor.ts（BullMQ `thumbnails`；去重键 doc:seq；调用 server-headless.renderThumbnails）, thumbnails.service.ts（版本判定、S3 键、缓存头）}
│   │   ├── comments/{comments.module.ts, comments.controller.ts, comments.service.ts（线程/回复/解决/删除；锚点格式校验；权限 commenter+）, comments.notifier.ts（通过 server-collab Room.broadcastControl 发 `CONTROL.event{comments.changed}`）}
│   │   ├── audit/{audit.module.ts, audit.service.ts（append-only，批量写）, audit.controller.ts（租户管理员查询）}
│   │   ├── jobs/{jobs.module.ts, queues.ts（队列名/默认重试/退避）, base.processor.ts（trace 传播、错误分类、死信）, job-runs.repository.ts（PG 镜像用于审计/查询）}
│   │   ├── health/{health.module.ts, health.controller.ts（/healthz 进程活；/readyz：PG ping、Redis ping、S3 head、宿主 ACTIVE、role=collab 时 RoomManager 未 draining）}
│   │   ├── metrics/{metrics.module.ts, prometheus.controller.ts（内部端口 9464）}
│   │   └── internal/{internal.module.ts, render-state.controller.ts（GET /internal/render/:token/state：一次性 token → 快照字节）, diagnostics.controller.ts（GET /internal/diagnostics/fibers|effects|pending|contributions）, admin.controller.ts（POST /internal/admin/documents/:id/compact|migrate|epoch）}
│   └── db/
│       ├── schema/{tenants.ts, users.ts, documents.ts, document_updates.ts, document_snapshots.ts, media.ts, permissions.ts, share_links.ts, comments.ts, thumbnails.ts, audit_log.ts, job_runs.ts, api_keys.ts, collab_sessions.ts}
│       ├── migrations/                 SQL（drizzle-kit 生成 + 手写分区/索引）
│       ├── seed/dev-seed.ts
│       └── client.ts                   pg Pool（statement_timeout 30 s、application_name=oce-{role}）
└── test/
    ├── e2e/                            Nest Testing + testcontainers（PG/Redis/MinIO）+ mock OIDC（oidc-provider）
    ├── fixtures/
    └── helpers/
```

---

## 3. `server-*` 包目录级结构

### 3.1 `@oce/server-collab`（node；cordis 插件，提供 `collabServer` 服务）

```
packages/server-collab/
├── package.json                        deps: yjs y-protocols lib0 @oce/collab-core @oce/store-yjs @oce/model-core @oce/protocol @oce/kernel（无 Nest、无 pg、无 ioredis：这些能力经 Definition 注入）
├── src/
│   ├── index.ts
│   ├── plugin.ts                       name='server-collab'；inject=['units','updateStore','snapshotStore','fanoutBus','leaseLock','authzSource','telemetry']；provide=['collabServer']
│   ├── manifest.ts
│   ├── config.ts                       zod：{ room:{ drainGraceMs:60000, maxEditors:20, maxViewers:50, maxActiveRooms:200, memoryAdmissionPct:75 }, limits:{ maxFrameBytes:1 MiB, msgRateHz:200, msgBurst:500, updateBytesPerMin:10 MiB, awarenessMinIntervalMs:50, awarenessMaxBytes:2 KiB, structsPerUpdate:50000 }, persistence:{ flushMs:100, flushMaxUpdates:50, persistBeforeBroadcast:true }, compaction:{ maxPendingUpdates:500, maxPendingBytes:5 MiB, maxAgeMs:600000, retainUpdatesAfterSnapshotMs: 7 d }, softGate:{ mode:'repair'|'report-only'|'off', schemaMode:'report-only' }, repair:{ quarantineThreshold:5, windowMs:600000 } }（值见 §16.5）
│   ├── collab-server.contribution.ts   Context { collabServer, updateStore, snapshotStore, fanoutBus, leaseLock, authzSource }；Events：collab-server/room-opened|closed、collab-server/update-rejected、collab-server/repair
│   ├── contracts/
│   │   ├── connection.ts               ServerConnection{ id, remote:{ip,ua}, send(frame), close(code, reason), onFrame, onClose }
│   │   ├── update-store.ts             UpdateStore{ append(docId, rows[]) → seqs; loadSince(docId, seq) → AsyncIterable<row>; pruneBefore(docId, seq, olderThan) }
│   │   ├── snapshot-store.ts           SnapshotStore{ latest(docId); put(docId, snap); get(id); list(docId); }
│   │   ├── fanout-bus.ts               FanoutBus{ publish(docId, msg{instanceId, frame}); subscribe(docId, handler) → Disposable }
│   │   ├── lease-lock.ts               LeaseLock{ acquire(key, ttlMs) → Lease|null; Lease.renew()/release()/token }
│   │   └── authz-source.ts             AuthorizationSource{ resolveRole(docId, principal) ; onPermissionChanged(docId, cb) → Disposable }
│   ├── room/
│   │   ├── room-manager.ts             docId → Room；容量与驱逐（LRU 空闲房间）；drainAll(reason)；attach(connection, ticketClaims)
│   │   ├── room.ts                     状态机（06 §5.2）；持有 UnitHandle（store-yjs Unit）；sessions；awareness relay；persist ticker
│   │   ├── room-session.ts             role、令牌桶、ack 追踪、最后活动时间、违规计数
│   │   ├── frame-router.ts             信封 → hardGate → sync/awareness/control 分派
│   │   └── broadcast.ts                本地 + FanoutBus；按 instanceId 去重；对 viewer 只发 awareness 与 sync
│   ├── gate/
│   │   ├── hard-gate.ts                L1（信封/大小/速率）、L2（role）、L3（decodeUpdateV2 + 结构数）
│   │   ├── soft-gate.ts                applyUpdate(origin remote) → ChangeSet → `documentType.validateChangeSet`（A 线 04）→ RepairPlanner
│   │   ├── repair-planner.ts           修复规则表 → repair 事务（origin repair）+ CONTROL.repair；隔离阈值
│   │   └── token-bucket.ts
│   ├── persistence/
│   │   ├── update-writer.ts            批量写（flushMs/flushMaxUpdates）→ 提交后回 ack；persistBeforeBroadcast 分支
│   │   ├── bootstrap-loader.ts         latest snapshot（内联/S3）+ loadSince → applyUpdate；schemaVersion 检查
│   │   ├── compactor.ts                触发判定 → leaseLock → encodeStateAsUpdateV2 → snapshotStore.put(kind auto) → pruneBefore（保留 7 d）
│   │   └── migration-runner.ts         leaseLock → `migrations.run(unit, from, to)`（A 线）→ snapshot(kind migration) → 通知客户端 4426（旧客户端）
│   ├── snapshot/
│   │   └── snapshot.service.ts         命名快照；restore：加载目标 state 到临时 Unit → 模型级 diff（A 线 `diffSnapshots`）→ 一次 repair-like 事务写回当前 Unit（origin restore）
│   ├── awareness/
│   │   └── awareness-relay.ts          服务端 Awareness 实例（新加入者拿全量；断开即移除广播）；schema 校验丢弃计数
│   ├── telemetry.ts                    span/metric 常量（10 §4）
│   ├── errors.ts                       collab.server.*（room_full、capacity、bootstrap_failed、lock_lost…）
│   └── __tests__/                      使用 testing/ 的内存实现：两实例去重扇出、崩溃后重放、限流、软门禁修复、容量驱逐、drain
└── testing/
    └── index.ts                        MemoryUpdateStore · MemorySnapshotStore · MemoryFanoutBus · MemoryLeaseLock · StaticAuthz · createServerCluster(n)（多实例 + 内存总线）· MemoryServerConnection
```

### 3.2 `@oce/server-storage`（node）

```
packages/server-storage/
├── src/
│   ├── index.ts
│   ├── plugin.ts                       provide=['blobStore']（实现 model-core `BlobStore` + 服务端扩展，见 §16.1）；Config.provider ∈ 's3'|'local'
│   ├── config.ts                       zod：{ provider, s3:{ endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle }, local:{ rootDir }, presign:{ putTtlSec:600, getTtlSec:3600 } }
│   ├── storage.contribution.ts         Context { blobStore: ServerBlobStore }
│   ├── contracts/blob-store.ts         ServerBlobStore extends BlobStore（model-core：get/put/has，04 §2.5）+ { head(key); delete(key); presignPut(key, {contentType, maxBytes}); presignGet(key, ttl); list(prefix) }
│   ├── providers/s3-blob-storage.ts    @aws-sdk/client-s3 + lib-storage（分片）；MinIO 兼容
│   ├── providers/local-blob-storage.ts 开发/测试
│   ├── keys.ts                         对象键布局函数（§6）
│   ├── hashing.ts                      流式 sha256（与客户端 WebCrypto 结果一致的十六进制小写）
│   ├── errors.ts                       storage.*（not_found、integrity_mismatch、quota_exceeded）
│   └── __tests__/                      runBlobStorageConformance（local；CI 中 testcontainers MinIO）
└── testing/index.ts                    MemoryBlobStorage · runBlobStorageConformance(factory)
```

### 3.3 `@oce/server-headless`（node）

```
packages/server-headless/
├── package.json                        deps: @oce/kernel @oce/model-core @oce/store-yjs @oce/model-slide @oce/ooxml-core @oce/ooxml-pptx @oce/engine-layout playwright-core(可选 peer)
├── src/
│   ├── index.ts
│   ├── host/
│   │   ├── create-server-host.ts       createHost(adapters) + 加载 iso 插件束（顺序无关，inject 反应式）；@cordisjs/plugin-loader 配置驱动默认关闭（A-8 / ADR-0010），preset 程序化组合
│   │   └── unit-runner.ts              withUnit(source: Snapshot | Uint8Array(state), fn(unit)) → 结果；finally 关闭 Unit；dev 下 assertNoLiveEffects
│   ├── tasks/
│   │   ├── import-pptx.ts              bytes → zipLimits 校验（§9.2）→ ooxml-pptx.decode → Snapshot → withUnit(store-yjs importSnapshot) → { state(V2), mediaRefs[], warnings[] }
│   │   ├── export-pptx.ts              state → withUnit → ooxml-pptx.encode（脏部件 + 不透明保留）→ bytes；可选校验（OPC 完整性）
│   │   ├── validate.ts                 全量 schema + 不变量校验报告（供 admin/诊断）
│   │   ├── migrate.ts                  from → to 迁移（server-collab migration-runner 复用）
│   │   └── diff-snapshots.ts           两 state 的模型级 diff → Mutation 列表（restore 使用；纯函数来自 A 线 model-core/model-slide）
│   ├── thumbnails/
│   │   ├── browser-pool.ts             playwright-core Chromium 池：进程 1 个 browser，N 个 context/page；生命周期归 effect；崩溃自愈
│   │   ├── thumbnail-renderer.ts       render(docState, slideIds, opts) → PNG[]：打开渲染页、注入 state、等待 `window.__oce.ready`、逐页截图
│   │   ├── render-page-protocol.ts     与 apps/web `/render` 路由的契约（token、state 拉取 URL、ready 信号、错误上报）
│   │   └── png.ts                      截图后处理（尺寸、sRGB）
│   ├── fonts/font-bundle.ts            字体包清单校验（与 engine-layout fallback 表一致；启动时缺失 → 告警）
│   ├── errors.ts                       headless.*（zip_limit_exceeded、decode_failed、browser_crashed、render_timeout）
│   └── __tests__/                      import→export round-trip（语料库子集）、validate、缩略图（CI 有 Chromium 时）
└── testing/index.ts                    createTestHost()、fixtures
```

---

## 4. Nest 内嵌 cordis 宿主：生命周期映射

### 4.1 映射表

| Nest 生命周期 / 作用域 | cordis 动作 | 说明 |
|---|---|---|
| `main.ts` 最先 | 启动 OTel SDK | 在任何 import 有副作用之前（10） |
| `CordisHostModule.onModuleInit` | `createHost({ logger: PinoAdapter, telemetry: OtelAdapter, errors: ReporterAdapter })` → 根 ctx | 宿主是进程单例；不在 feature 模块里再建根 ctx（primer §14 规则） |
| `onApplicationBootstrap` | `ctx.plugin(presetServer, config)`；`await fiber.await()`；检查无 `PENDING` 关键插件 | 失败 → 抛出 → 进程退出（先失败，不部分激活） |
| `/readyz` | 宿主根 Fiber `ACTIVE` 且必需服务（`units`,`store` Provider 工厂,`formats`）可解析 | 否则 503 |
| 每个 Room | `collabServer` 内部：`ctx.units.open({ docType:'slide', store:'yjs', source })` → UnitScope（`isolate` store/history/…） | 一个 Room 一个 Unit；服务端无 render/selection |
| 每个 HTTP 请求 / job | `ctx.extend({ requestId, traceId, tenantId, principalId })` 仅作为日志/遥测元数据 | **不** isolate、不建 Fiber（避免每请求 Fiber 开销）；业务逻辑通过 `withRequestMeta` 拿到子 ctx |
| 每个 WS 连接 | 无 cordis 对象；`RoomSession` 普通对象 | 连接数量大，不映射为 Fiber |
| `beforeApplicationShutdown(signal)` | `collabServer.drainAll('shutdown')`（1012 → flush → persist）→ 队列 worker 暂停 → `host.dispose()` | 期限 30 s；超时强制退出并记录 |
| dev/test | `assertNoLiveEffects(rootFiber)` | A25 |

### 4.2 `preset-server` 插件束（草案）

```
preset-server
├── kernel 基础服务 Provider：logger(pino) · telemetry(otel) · errors(reporter)
├── @oce/model-core（units/documentTypes/store Definition/commands/history/permissions/formats/resources/migrations）
├── @oce/store-yjs（Provider）                       ← 服务端也用 store-yjs（Room 即 Unit）
├── @oce/model-slide（DocumentType 'slide'）
├── @oce/ooxml-core · @oce/ooxml-pptx（FormatCodec）
├── @oce/engine-layout（可选；导出时 spAutoFit 需要度量 → 需 measurer Provider：fontkit 版，M4+；缺失时 PENDING，导出不做重排）
├── @oce/server-collab（role collab）
├── @oce/server-storage（Provider by config）
└── @oce/server-headless（tasks；role worker 时含 thumbnails）
```

`apps/server` 对 preset 的唯一职责是**配置**（章程：apps 零业务逻辑）；Definition 的 Node 实现（pg/redis 适配器）作为插件由 `apps/server/src/modules/collab/*.ts` 提供——它们是「Nest 模块内的 cordis 插件」，只做 IO 适配。

---

## 5. 数据模型（Postgres 16，草案；字段到草案级）

约定：`id uuid`（v7，时间有序）、`tenant_id` 必填并进入复合索引首列、`created_at/updated_at timestamptz`、软删除用 `deleted_at`。唯一例外：`users.tenant_id` 允许 `null`（个人账号，rulings §4.13 S-1，见下）。

```sql
-- 租户与用户
tenants(id pk, slug unique, name, settings jsonb, plan, quotas jsonb, created_at)
users(id pk, tenant_id fk null, oidc_issuer, oidc_subject, email_hash, display_name, avatar_url, status, created_at, last_seen_at,
      unique(tenant_id, oidc_issuer, oidc_subject))
      -- tenant_id 允许 null（新增，rulings §4.13 S-1，2026-09-21）：个人账号——经分享链接自助注册、无租户归属，
      -- 与"租户不开放自助创建"（U-10）不冲突（开放的是个人账号，不是租户）；unique 约束对 tenant_id=null 的多行不冲突（Postgres NULL 不参与唯一性比较）
api_keys(id pk, tenant_id fk, name, key_hash, scopes text[], created_by fk users, created_at, last_used_at, revoked_at)

-- 组（新增，rulings §4.12 U-11，M3）
groups(id pk, tenant_id fk, name, created_at, unique(tenant_id, name))
group_members(group_id fk, user_id fk users, added_at, primary key(group_id, user_id))
                 -- 删除组时级联撤销以其为 principal 的 permissions 行（同事务，见 40-modules/08 §2.6）

-- 文档
documents(id pk, tenant_id fk, title, doc_type text default 'slide', schema_version int, epoch int default 0,
          owner_id fk users, folder_id null, status text check in ('active','trashed','locked','purging'),
          head_seq bigint default 0,                 -- 已持久化的最大 update seq，唯一写者 M-09（server-collab），本表其余列由 M-08 写（评审 §3.4）
          latest_snapshot_id fk document_snapshots null,
          size_bytes bigint, media_bytes bigint, slide_count int,
          created_at, updated_at, deleted_at, index(tenant_id, updated_at desc))
          -- status='purging'（新增，rulings §4.13 S-2，2026-09-21）：回收站（trashed）满 30 天宽限期，或收到 GDPR 擦除请求，
          -- 由 documents/application/schedule-purge.usecase.ts 置位，单向不可逆；置位后触发编排式级联清理
          -- （permissions/document_perm_versions 由 M-08、document_updates/document_snapshots 由 M-09、thumbnails/comments 由 M-12
          -- 各自清理"自己的表"，见 40-modules/08 §7、40-modules/09 §7.3）；清理完成后该行物理删除或按 GDPR 策略替换为 deleted-user 占位

-- CRDT update 追加表（ADR-0025）
document_updates(doc_id fk, seq bigint,             -- seq 由 documents.head_seq 在同事务内递增分配（单写者按批）
                 update bytea, byte_size int, client_id bigint, session_id uuid, user_id fk null,
                 created_at, primary key(doc_id, seq))
                 -- 按 hash(doc_id) 16 分区；bytea 用 EXTERNAL 存储避免二次压缩

document_snapshots(id pk, doc_id fk, seq_upto bigint, kind text check in ('import','auto','named','migration','restore','epoch'),
                   name text null, state_inline bytea null, state_key text null,   -- ≤ 1 MiB 内联，否则 S3 键
                   state_vector bytea, byte_size int, schema_version int, epoch int, layout_algo_version int,
                   created_by fk users null, created_at, index(doc_id, seq_upto desc))

-- 媒体（内容寻址）
media_blobs(id pk, tenant_id fk, sha256 bytea, mime, byte_size bigint, storage_key, width int null, height int null,
            created_at, unique(tenant_id, sha256))
document_media(doc_id fk, media_id fk, first_seen_seq bigint, primary key(doc_id, media_id))   -- GC：无引用且 30 天 → 删除

-- 权限（fail-closed：无行即无权）
permissions(id pk, doc_id fk, principal_type text check in ('user','group','tenant','link'), principal_id uuid,
            role text check in ('owner','editor','commenter','viewer'), granted_by fk users, created_at, expires_at null,
            unique(doc_id, principal_type, principal_id))
document_perm_versions(doc_id pk fk, perm_version int)   -- 权限变更计数，进入 ticket 与 Redis
share_links(id pk, doc_id fk, token_hash, role, expires_at, created_by, created_at, revoked_at)

-- 评论镜像 / 读模型（ADR-0031 v0.2：事实源是 Snapshot 内 ResourceHook `comments.*`；本表由服务端 Room 观察变更后 upsert，见 §16.6）
comments(id pk, doc_id fk, thread_id uuid,          -- 线程根评论 id
         parent_id fk comments null, author_id fk users, body text, body_format text default 'plain',
         anchor jsonb,                              -- { slideId, shapeId?, range?: { anchor: base64 RelativePosition, head } , snapshotSeq }
         anchor_state text check in ('attached','detached'),
         resolved_at null, resolved_by null, created_at, edited_at, deleted_at,
         index(doc_id, thread_id), index(doc_id, anchor->>'slideId'))

-- 缩略图
thumbnails(doc_id fk, slide_id text, snapshot_seq bigint, layout_algo_version int, storage_key, width int, height int, content_hash bytea,
           created_at, primary key(doc_id, slide_id))

-- 作业与审计
job_runs(id pk, tenant_id, kind text, doc_id null, status text, attempts int, error_code text null, payload jsonb, result jsonb,
         queued_at, started_at, finished_at, index(doc_id, kind, queued_at desc))
audit_log(id bigserial pk, tenant_id, actor_type text, actor_id uuid null, action text,    -- 'document.create' | 'permission.grant' | 'collab.join' …
          target_type, target_id, doc_id null, session_id null, request_id, ip_hash, user_agent_hash, details jsonb,
          prev_hash bytea null, hash bytea, created_at)
          -- 按月分区；仅 INSERT（数据库角色无 UPDATE/DELETE 权限）
          -- prev_hash/hash 新增（rulings §4.12 U-15，M3）：hash = chainHash(prev_hash, entry)，形成链式校验；每日 seal 作业重算校验前一日全部行（见 40-modules/12 §2.3/§2.6）
collab_sessions(id pk, doc_id, user_id null, client_id bigint, instance_id, role, connected_at, disconnected_at null,
                disconnect_code int null, bytes_in bigint, bytes_out bigint, updates_in int, rejected int)   -- 运维/审计；可选

-- Webhook 出口（新增，rulings §4.12 U-14，M3；评论事件的服务端投递通道，与客户端 EM-05 回调并行）
webhook_subscriptions(id pk, tenant_id fk, target_url text, event_filter text[], signing_secret_hash, status text check in ('active','disabled'),
                       created_at, updated_at)
webhook_deliveries(id pk, subscription_id fk, event text, payload_hash bytea, attempt int default 0,
                    status text check in ('pending','succeeded','failed','dead-lettered'), response_code int null,
                    delivered_at null, created_at, index(subscription_id, created_at desc))
```

写路径关键约束：
- `document_updates` 的 `seq` 分配与 `documents.head_seq` 更新在**同一事务**，`ack{seq}` 只在提交后发出。
- 恢复顺序：`latest_snapshot(seq_upto)` + `updates where seq > seq_upto order by seq`。CRDT 本身与顺序无关，排序只是为了可复现。
- `document_updates` 裁剪：仅删除 `seq ≤ 最新 auto 快照.seq_upto` 且 `created_at < now() - 7 d` 的行（保留窗口用于审计回放与「按时间点恢复」）。

---

## 6. 对象存储布局（S3 兼容）

```
{tenantId}/media/{sha256[0:2]}/{sha256}                       内容寻址媒体（不可变；Cache-Control: immutable）
{tenantId}/docs/{docId}/snapshots/{seq_upto}-{kind}.yup2.zst  > 1 MiB 的快照
{tenantId}/docs/{docId}/imports/{jobId}/source.pptx           导入原件（保留 30 天，可配置；用于「重新导入」与故障分析）
{tenantId}/docs/{docId}/exports/{jobId}/{filename}.pptx        导出结果（TTL 24 h，生命周期规则删除）
{tenantId}/docs/{docId}/thumbs/{slideId}/{snapshotSeq}-{algo}.png
```

- 客户端上传走**预签名 PUT**（`POST /media/presign` 给出 key/URL/最大字节），完成后 `POST /media/commit{ sha256, byteSize }` 由服务端 `HEAD` + 流式重算 sha256 校验一致性，再写 `media_blobs`。
- 下载：`GET /media/:sha256` → 302 到预签名 GET（TTL 1 h）或经服务端流式代理（配置）。
- Bucket 策略：私有；服务端最小权限 IAM；开启版本化仅用于 `snapshots/`。

---

## 7. 任务队列（BullMQ / Redis）

| 队列 | 生产者 | 处理器（role worker） | 并发/重试 | 幂等键 |
|---|---|---|---|---|
| `import` | ImportsController | import.processor → server-headless.importPptx | 并发 2/进程；重试 3（指数 10 s） | jobId；文档创建用 `import_job_id` 唯一 |
| `export` | ExportsController | export.processor → exportPptx | 并发 2；重试 2 | (docId, seq) |
| `thumbnails` | server-collab compactor 完成事件 / 导入完成 / admin | thumbnails.processor → server-headless.renderThumbnails | 并发 1/进程（Chromium 内 2 页） | `doc:{id}:seq:{seq}`（去重：更高 seq 到来时旧任务作废） |
| `compaction`（可选） | RoomManager 判定但本实例负载高时委托 | compaction.processor → server-collab.compactor | 并发 4 | `doc:{id}` |
| `maintenance` | cron | media GC、exports 清理、updates 裁剪、audit 分区维护 | 并发 1 | 日期 |

- 处理器基类：从 job 数据恢复 `traceparent` 建子 span；错误分类为 `retryable/terminal`（OceError.retryable）；死信队列 + 告警。
- `job_runs` PG 镜像用于用户可见的进度查询（`GET /imports/:jobId`）与审计。

---

## 8. 网关横向扩展（ADR-0035）

```
                     ┌── 负载均衡（L7，WS 升级透传，无需粘性） ──┐
                     ▼                                          ▼
              collab 实例 A                               collab 实例 B
        Room(doc1) 副本 ── Redis PUBLISH collab:doc:doc1 ──► Room(doc1) 副本
        持久化：各自写自己客户端的 update（幂等，Yjs 重复应用无副作用）
        压缩/迁移：LeaseLock 单写者
        在线人数：Redis HSET room:doc1:clients {instanceId: n}（TTL 60 s 心跳）
```

- 不要求房间亲和：任何实例都能服务任何文档；跨实例通过 Redis pub/sub 扇出 sync/awareness/control 帧（携带 `instanceId` 去重）。
- 为什么不做亲和：滚动发布/实例故障时亲和会造成整房间断连；CRDT 让多副本天然正确。代价：热门文档在每个实例各有一份副本（内存 ≈ 副本数 × 文档大小；Q5 规模下可接受）。可选优化：LB 按 `documentId` 一致性哈希**偏好**同一实例（降低副本数），但不作为正确性前提。
- Redis 故障：实例间扇出中断 → 各实例内部仍一致，跨实例延迟直到 Redis 恢复后的下一次 step1/step2（客户端重连会触发）；`/readyz` 在 Redis 不可用时返 503 让 LB 停止分配新连接（现有连接保留）。
- 容量：每实例 2,000 WS 连接、200 活跃房间（配置）；超过 → `auth.denied{collab.room_full}` / 4503。

---

## 9. 安全

### 9.1 鉴权与权限（ADR-0029）

- OIDC（Q6）：授权码 + PKCE；会话为 httpOnly cookie（同站）或 Bearer JWT（第三方嵌入）；API Key 用于集成方服务端调用。
- 多租户：所有查询以 `tenant_id` 限定（repository 层强制参数，无租户参数的方法不存在）；对象键前缀含租户。
- **fail-closed 双点**：REST `DocumentRoleGuard` 与 WS 网关（ticket role + 每帧检查）都是「无显式允许即拒绝」；命令管线的客户端检查点是第三点（UX）。角色格：`owner > editor > commenter > viewer > none`；操作矩阵在 `protocol/permissions`。
- collab ticket：60 s、单次使用（jti）、绑定 doc 与 permVersion；WS 不接受长时 access token。
- 权限变更即时生效：06 §10。
- 分享链接（新增，rulings §4.13 S-1，2026-09-21）：不支持匿名访问，需先登录（任意已登录账号，含其它租户用户，或经个人账号自助注册）；`ShareLinkGuard` 把链接角色叠加到已登录 Principal 的能力位集合，不产出匿名 Principal；每次外部访问写外部访问审计（`share-link.accessed`），详见 40-modules/08 §2.6/§2.4。

### 9.2 上传校验与 zip 资源限制（借鉴 pptx-renderer `ZipParseLimits`，按 Q5 放大）

| 限制 | 值 | 目的 |
|---|---|---|
| 文件魔数 | `PK\x03\x04` 且 `[Content_Types].xml` 存在 | 拒绝伪装 |
| 上传大小 | ≤ 200 MB（Q5；租户配额可更小） | — |
| `maxEntries` | 4,000（OF-24 默认；租户可收紧，放宽 ≤ 2×） | zip 炸弹（条目数） |
| `maxEntryUncompressedBytes` | 64 MiB | 单个超大 XML/媒体 |
| `maxTotalUncompressedBytes` | 512 MiB；且压缩比 > 100:1 拒绝 | zip 炸弹（体积） |
| `maxMediaBytes` | 256 MiB | 媒体总量 |
| 图表点数 / 位图预览 | ≤ 10,000 点/序列；≤ 16,777,216 px | 解析器内存（OF-24） |
| XML | 禁 DTD/外部实体（XXE）、深度 ≤ 256、属性 ≤ 1,024/元素、文本节点 ≤ 16 MiB | 解析器资源 |
| 解析时间 | ≤ 60 s/作业 | 处理器超时 |
| 外部关系 `TargetMode="External"` | 只保留 `http/https` 字串，**从不**在服务端抓取 | SSRF |
| 媒体 MIME | 嗅探与声明不符 → 以嗅探为准；不可识别 → 拒绝 | 内容混淆 |
| SVG 媒体 | 消毒（去脚本/事件/外链）或服务端栅格化 | XSS |
| OLE/VBA/宏 | 原样保留为不透明部件，从不执行 | — |
| 嵌入字体 | 反混淆后大小 ≤ 20 MiB/个，总 ≤ 100 MiB | 资源 |

### 9.3 速率与配额

- REST：每 principal 600 req/min，上传 10/min；WS：连接 10/min/IP，帧限制见 06 §9.3；awareness 30 帧/s。
- 租户配额：文档数、存储字节、并发房间；超限 → `tenant.quota_exceeded`（402/429 由策略定）。

### 9.4 其他

- CSP/CORS 由 apps/web 与网关配置；`Sec-WebSocket-Protocol` 不用于鉴权。
- 密钥：JWT 私钥、OIDC secret、S3 凭据只从环境/密钥管理读取；启动校验。
- 审计：文档生命周期、权限、导入导出、协同加入/离开、管理操作；审计表只追加。
- 依赖：`npm audit` + 许可证白名单（D13）由 09-07 承接。

---

## 10. 部署拓扑（Q10）

### 10.1 docker-compose（开发/单体）

```
services: server(all) · web(nginx 静态) · postgres:16 · redis:7 · minio · otel-collector · [jaeger|grafana-tempo] · [prometheus+grafana] · mock-oidc(dev)
volumes: pg-data · minio-data
```

### 10.2 Kubernetes（后续）

```
Deployment oce-api      (role=api)      HPA by CPU/RPS      无状态
Deployment oce-collab   (role=collab)   HPA by 连接数/内存    Service 长连接超时 ≥ 1 h；PDB minAvailable 1；terminationGracePeriod 40 s（drain 30 s）
Deployment oce-worker   (role=worker)   HPA by 队列深度       含 Chromium；内存 request 2 Gi
CronJob    oce-maintenance
Postgres（托管或 operator）· Redis（哨兵/托管）· 对象存储（云 S3 或 MinIO）· OTel Collector DaemonSet
Ingress：WS 升级、`proxy-read-timeout` ≥ 3600、无粘性
```

- 滚动发布：collab 实例收到 SIGTERM → 停止接受新连接（`/readyz` 503）→ 向客户端发 1012 → flush → 退出；客户端立即重连到其他实例（06 §6.5）。
- 数据库迁移：独立 Job，在新版本上线前运行；向前兼容一版。

---

## 11. 与 `@oce/protocol` 契约的对应

| protocol 子路径（草案，提请 A 线在 02 中采纳） | 内容 | 使用方 |
|---|---|---|
| `protocol/src/collab/frame.ts` | 信封类型常量、`encodeFrame/decodeFrame`（payload 不透明） | collab-yjs、server-collab |
| `protocol/src/collab/control.ts` | CONTROL 消息 zod 判别联合（06 §6.3） | 同上 + Gateway |
| `protocol/src/collab/close-codes.ts` | 关闭码枚举**常量对象**（非 `enum`，A3） | 同上 |
| `protocol/src/collab/awareness.ts` | `AwarenessState` zod | collab-yjs、server-collab |
| `protocol/src/collab/ticket.ts` | ticket claims schema | Auth、Gateway |
| `protocol/src/permissions.ts` | `Role` 常量对象与操作矩阵 `can(role, action)` | 三处检查点 |
| `protocol/src/errors/{codes,http-map}.ts` | 错误码字串联合、HTTP/WS 映射表 | filter、客户端 |
| `protocol/src/rest/{auth,documents,permissions,share-links,media,snapshots,imports,exports,thumbnails,comments,jobs,tenants,users}.ts` | 请求/响应 DTO zod + 推导类型 + 路由常量 | controllers、apps/web |
| `protocol/src/rest/problem.ts` | RFC 9457 problem+json schema | filter |
| `protocol/src/telemetry/client-report.ts` | 客户端错误/指标上报 DTO（10） | apps/web、api |

规则：controller 的 `@Body()` 类型只能是 `z.infer<typeof X>`，且 `X` 必须来自 protocol（lint `no-restricted-imports` + 类型测试，由 09 承接）。

---

## 12. 预算与测量

| 指标 | 预算 | 测量 |
|---|---|---|
| REST p95（读） | ≤ 150 ms | OTel http span |
| Room bootstrap | ≤ 500 ms p95 @ 8 MB | span `server.room.load` |
| update 处理 | ≤ 20 ms p95 | span `server.collab.update` |
| 持久化延迟（收到 → 提交） | ≤ 150 ms p95（flush 100 ms） | `oce_collab_persist_latency_ms` |
| 导入 50 MB pptx | ≤ 30 s p95 | job 时长 |
| 导出 200 页 | ≤ 15 s p95 | job 时长 |
| 缩略图 | ≤ 400 ms/页 p95 | span `thumbnail.render` |
| 权限传播 | ≤ 1 s p95 | 06 §10 |
| 优雅关闭 | ≤ 30 s，零 update 丢失 | 集成测试：kill -TERM 后重启对比状态 |
| 每实例 | 2,000 连接 / 200 房间 / RSS ≤ 8 GiB | 指标 |
| Room 背压溢写一级阈值（新增，rulings §4.13 S-3） | ≤ N MiB/文档未持久化字节（默认量级与 `compaction.maxPendingBytes` 同档，具体值由 `server-collab/config.ts` `spill.tier1MaxBytesPerDoc` 定案，见 40-modules/09 §2.2/§11） | `oce_collab_spill_tier_current`（按 Room 打点，`none\|redis\|blob`） |
| Room 背压溢写二级阈值（新增，rulings §4.13 S-3） | 超一级阈值后继续累积则分块落 `BlobStore`（`spill.tier2ChunkBytes`，量级参考对象存储布局 §6） | 同上 + `oce_collab_spill_tier2_bytes_total` |
| 故障恢复后回放耗时（新增，rulings §4.13 S-3） | PG 恢复 → Room 回到 `active` ≤ 10 s p95（按 D50 级文档溢写窗口估算，随二级溢写字节量线性增长，超大窗口另行观测） | span `server.collab.replay-spilled`；集成测试：故障注入（kill PG 连接 N 秒）后断言 `document_updates` 按 `seq` 完整无重复 |

---

## 13. 待决事项

| # | 事项 | 默认 | 决策人 |
|---|---|---|---|
| B1 | ORM：Drizzle vs Prisma | Drizzle（SQL 可见、无生成运行时、分区友好） | 架构 B + 团队 |
| B2 | HTTP 适配器：Fastify vs Express | Fastify | 架构 B |
| B3 | 上传方式：预签名 S3 vs 经服务端 multipart | 预签名（服务端只校验） | 架构 B/运维 |
| B4 | 评论实时通知走 collab 控制帧 vs 独立 SSE | 控制帧（复用房间） | 架构 B |
| B5 | `document_updates` 保留期 | 7 天 | 产品/合规 |
| B6 | 导入原件保留期 | 30 天 | 合规 |
| B7 | 是否允许 API Key 走 WS（服务端自动化编辑） | M3 不允许 | 产品 |

## 14. 对章程的异议/建议

- **S7**：D8 建议明确「Definition 的 Node 适配器（pg/redis/s3）作为 cordis 插件放在 `apps/server` 的对应模块目录下」——这些是 IO 适配而非业务逻辑，否则需要新增 `server-adapters-*` 包。
- **S8**：包清单建议给 `server-collab` 标注「cordis 插件（提供 `collabServer`）」，与 R2「每个包要么是插件要么是纯库」对齐。

## 15. 跨条线要求（摘要）

- A 线：`units.open` 支持 `source: Uint8Array(state)` 与空文档；`documentType.validateChangeSet(paths)`、`repairRules`、`diffSnapshots(a, b) → Mutation[]`、`migrations.run(unit, from, to)` 为服务端可调用的纯/半纯 API。
- 类型治理线：controller DTO 只能来自 protocol；`@nestjs/*` 单点引入；server-* 包禁止 import `pg`/`ioredis`/`@aws-sdk`（除 server-storage 的 S3）；`apps/server` 的 cordis 适配器目录允许 import 这些驱动。
- 产品：B5/B6/B7 与配额策略。

---

## 16. v0.2 补充：与架构 02/04/05 契约的对齐、PRD（SV/EM/OF）条目的承接、章程 v0.2 裁决

> 追加于 A 线与产品线落盘之后；凡与前文冲突处以本节为准。

### 16.1 对齐表

| 项 | 结论 |
|---|---|
| `BlobStore` | `server-storage` 实现 model-core 的 `BlobStore{ get, put, has }`（04 §2.5）并扩展为 `ServerBlobStore{ head, delete, presignPut, presignGet, list }`；服务名 `blobStore`（§3.2 原 `blobStorage` 作废）。浏览器侧 `BlobStore` 的 IndexedDB Provider 由 `@oce/collab-offline-idb`（S1 已批准）顺带提供（本地媒体缓存），与 presence 无关（04 §10） |
| `server-headless` | 使用 `createHost`（02 §4.24 `createHeadlessHost`）；`@cordisjs/plugin-loader` **默认关闭**（A-8 / ADR-0010）；`tasks.migrate/validate` 调用 `migrations.run` 与 `validateSnapshot`（04 §10）；`worker.ts` 以 `worker_threads` 每任务新 host（超时/内存限额）；`layout.measurer` Provider `node-font`（ADR-0027 补充） |
| 服务端写入路径（05 §11） | 导入 = `units.open` 的 load 路径（origin `system('import')`，不经命令）；迁移/恢复/修复 = 服务端事务（origin `system(reason)`）；需要命令语义的服务端编辑（模板填充等）经命令管线，`principal = system`，权限策略为服务端策略，审计落库 |
| 层号编码（章程 v0.2） | `package.json#oce = { layer: 'LS', iso: 'node' }`；LS 可依赖 L5 的 iso 包（`engine-layout`、`engine-render` 契约），不得依赖 `render-dom` |
| `server-collab` 形态 | 02 定为 library；本文 S8 建议其同时暴露一个薄 cordis 插件外壳（`collabServer` 服务）以复用 effect 生命周期；两者不冲突：库函数 + `plugin.ts` |
| 事件/错误码 | PRD 斜杠形式（`collab/auth-failed`、`auth/invalid-token`、`format/limit-exceeded`…）→ 定稿映射见 10 §11 |

### 16.2 导出字节级一致（SV-02）

- 机制：`ooxml-pptx.encode(snapshot, baselinePackage)` 是**纯函数**——不读 `layout`（L3 不得 import L5）、不读时钟、不读随机源；zip 写入器确定性：固定 mtime（取模型 `modifiedAt`）、条目按部件名排序、固定压缩级别、无 extra 字段；`docProps/core.xml` 的时间戳来自模型字段而非 `Date.now()`。**对 A 线的要求**：`ooxml-core/opc` 的 zip 写入器满足上述确定性；`Snapshot.meta.modifiedAt` 由命令层写入。
- 排版相关的落盘量（autofit 缩放、`spAutoFit` 高度）由编辑端在布局时写回模型（ADR-0027 补充），导出不重排。
- 基线包：导入时把原文件存为 `imports/{jobId}/source.pptx`（§6）并在 `document_snapshots(kind import)` 记录 `baseline_key`；导出复用其不透明部件字节（D7）。客户端导出用内存中的同一原字节。两端输入相同 + 纯函数 ⇒ 输出字节相同。
- 验证：CI 对语料库每个样本在浏览器（Playwright）与 Node 分别导出同一 Snapshot，断言 sha256 相等（11 §17）。

### 16.3 PDF 导出与缩略图（SV-02 / PD-16）

- `pdf.processor`（与 `thumbnails.processor` 同池）：Chromium 加载 `/render?mode=print`，`page.pdf({ width: slideW, height: slideH, printBackground: true })`；字体由 Chromium 子集嵌入；D50 ≤ 10 s（p95）；与 oracle PDF 逐页 SSIM ≥ 0.85；结果入 `exports/`，预签名 URL 默认 1 h。
- 缩略图：D200 全量 ≤ 90 s；导入完成后首页缩略图 ≤ 10 s（导入 processor 完成即入队首页优先任务）。
- 插件贡献的导出专用编解码器（`core.format` 且 `canImport:false`，如 Markdown；裁决：不新增 `export.target`）若为 iso 实现，在 `server-headless` 宿主中同样可用（PS-14）。

### 16.4 资源上传通道（EM-04 / CO-12 / SV-01）

- 预签名直传：`POST /media/presign{ sha256, byteSize, mime }` → `{ uploadUrl | multipart{ uploadId, partUrls[] }, key }`；≥ 10 MB 用 S3 分片，不经 Nest 进程内存；完成后 `POST /media/commit` 校验 sha256/大小/嗅探；≤ 10 MB 允许 multipart 直传 Nest（受 §9.3 限流）。文件导入同：预签名直传后 `POST /imports{ key }`。
- 客户端：`uploadAsset(file) → { assetId }` 回调由集成方或 `apps/web` 默认实现；CRDT 只写 `BlobRef`（06 §18.5）。
- 集成方自管元数据（EM-04 P2）：公开表结构与迁移脚本，仅使用协同网关——列入待决 B8。

### 16.5 网关容量与限制的最终值（SV-05 / CO-12 / OF-24 / NF-01 1.7）

| 项 | 值 |
|---|---|
| 房间 | 20 编辑者 + 50 查看者；超限只读加入；再超 `collab.room_full`；空置销毁延迟 60 s |
| 帧 | ≤ 1 MiB；≤ 200 帧/s/连接（突发 500）；awareness ≥ 50 ms 节流；未知 CONTROL 丢弃计数 |
| 实例（RM-S：2 vCPU / 4 GB） | ≥ 2,000 WS、≥ 200 活跃房间、CPU < 70%。房间准入按**内存预算**：RSS > 75% 时新房间转由其它实例服务（返回 4503 触发重连）；200 房间目标以 D50 级文档（≈ 12 MB/房间）计，D200 级（≈ 40 MB/房间）时容量按内存折减——**与 PRD 的差异在此注明**：PRD 的「≥ 200」以 D50 级为前提 |
| 传播 | 房间内广播 p95 ≤ 100 ms；跨实例 ≤ 50 ms；持久化滞后 p99 ≤ 1 s（本文 flush 100 ms → p95 ≈ 150 ms）；权限 ≤ 2 s |
| zip/XML（OF-24 默认；租户可收紧，放宽不超过 2×） | 条目 ≤ 4,000；单条目 ≤ 64 MiB；总解压 ≤ 512 MiB；媒体 ≤ 256 MiB；深度 ≤ 256；实体扩展禁用；图表点 ≤ 10,000/序列；位图预览 ≤ 16,777,216 px；错误码 `format.limit_exceeded{ limit, actual }`。客户端 Worker 解析使用同一张表（07 §14.2） |
| 服务端作业 | 导入 D50 ≤ 5 s / D200 ≤ 20 s（p95）；导出 pptx ≤ 3 / 12 s；PDF D50 ≤ 10 s；压缩 10,000 update ≤ 2 s；模板填充 + 导出 100 × D50（4 worker）≤ 60 s；导入/导出并发默认 **4/实例**（§7 表中的 2 作废）；优雅停机 ≤ 30 s |

### 16.6 评论镜像（ADR-0031 v0.2）

`comments` 表改为**读模型**：服务端 Room 观察 `resources.comments.*` 变更（任意 origin）→ upsert 镜像行（线程、锚点状态、@提及）→ 用于跨文档查询（@我）、集成方 webhook、审计；写路径全部经 CRDT（客户端命令）；REST 只读，另加「导入为可编辑线程」触发服务端事务。作者/角色规则由软门禁执行（ADR-0034 补充）。

### 16.7 待决补充

| # | 事项 | 默认 | 决策人 |
|---|---|---|---|
| B8 | 公开表结构与迁移脚本供集成方自管元数据（EM-04 P2） | M4 评估 | 产品 |
