> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-14 | 依赖：charter v0.1

# ADR-0022 服务端存储栈：Postgres + Redis + S3 兼容对象存储

## 状态

提议（默认值；章程 §6.2 ADR-0022、§10 Q10）。

## 背景

需要存放：元数据（租户/用户/文档/权限/评论/审计）、CRDT update 追加日志与快照、媒体二进制、缩略图、导入导出文件；需要跨实例扇出与租约锁；部署形态从 docker-compose 起步到 K8s（Q10）。

## 决策

| 关注点 | 选择 | 用法 |
|---|---|---|
| 元数据 + update 日志 + 小快照 | **Postgres 16** | 关系表（08 §5）；`document_updates` 按 `hash(doc_id)` 分区；`audit_log` 按月分区、只追加 |
| 扇出 / 通知 / 锁 / 队列 | **Redis 7** | pub/sub（`collab:doc:*`、`perm:doc:*`）、`SET NX PX` 租约锁（fencing token）、房间在线计数、BullMQ、限流计数器 |
| 二进制 | **S3 兼容**（MinIO 自托管 / 云 S3） | 媒体内容寻址、> 1 MiB 快照、导入原件、导出结果、缩略图（08 §6） |
| ORM | Drizzle（草案，待决 B1） | SQL 可见、无运行时代码生成 |

快照与 update 的追加/压缩细则见 ADR-0025；多实例一致性见 ADR-0035；备份/回放见下「后果」。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| MongoDB / DynamoDB 存 update | 无需文档型灵活 schema；关系与事务（seq 分配与 head_seq 同事务）在 PG 更直接；团队与运维栈统一 |
| Kafka 作为 update 日志 | 增加一套基础设施；我们需要按 doc 随机读（bootstrap）而非流消费；Q5 规模 PG 足够 |
| y-leveldb / y-redis / Hocuspocus 内置存储 | 与 Nest 壳、多租户元数据、审计与权限分离；y-redis 的架构（Redis 为主存）与我们「PG 为持久层」冲突 |
| 只存最新状态（无 update 日志） | 丢失崩溃窗口内的持久化粒度与审计回放能力；ack 语义无法精确 |
| 媒体入 PG（bytea） | 体积（Q5 单文件 200 MB）与备份成本；CDN/预签名不可用 |

## 后果

正面：单一关系库承载一致性关键路径；对象存储承载体积；Redis 只做易失协调（丢失可恢复）。

负面 / 代价：
- 三套基础设施（compose 中一并提供）；Redis 故障时跨实例扇出延迟（ADR-0035）。
- **备份/回放**：PG 逐日基础备份 + WAL 归档（PITR）；对象存储版本化仅 `snapshots/`；「按时间点恢复某文档」= 取 ≤ T 的最新快照 + `document_updates`（保留 7 天）重放，超出 7 天只能回到自动/命名快照粒度（P2 待决）。
- `document_updates` 写放大：批量 INSERT（100 ms/50 条）；bytea EXTERNAL 存储。
- 容量估算（Q5）：活跃文档每日 update ≈ 20 编辑者 × 2 h × 10 update/s × 100 B ≈ 150 MB/天/热文档（压缩后 ≈ 30 MB）；7 天保留 + 压缩后快照 ≈ 每热文档 < 300 MB；配额与裁剪任务保证上限。

## 补充（v0.2）：PRD NF-10 容量目标与 EM-04 的承接

- M3 容量目标（NF-10）：全系统并发编辑者 5,000、活跃文档 2,000、文档总量 100 万；网关无状态 + Redis 扇出横向扩展（ADR-0035）；`document_updates` 按 `hash(doc_id)` 16 分区、`audit_log` 按月分区支撑 100 万文档；单文档 update 日志**压缩后 ≤ 10 × 快照大小**（ADR-0025 补充）。
- 每实例导入/导出并发默认 4（作业 worker 水平扩展）；租户配额与噪声邻居限流（SV-08）由 `TenantsModule.quotas` 与令牌桶实现。
- EM-04：`blobStore` Provider 可替换（S3 兼容 / MinIO / 本地 / 集成方自定义），切换只改配置；元数据默认 Postgres；集成方「只用协同网关、自管元数据」为 P2（待决 B8，需要公开表结构与迁移脚本）。

## 如何被机械验证

- `runServerCollabAdaptersConformance` 对 PG/Redis 实现通过（testcontainers）。
- 集成测试：`kill -TERM` 后重启，重放 snapshot+updates 与崩溃前所有已 ack 的状态相同（06 I10）。
- 迁移脚本在 CI 对空库与上一版本库都可执行（向前兼容一版）。
- 扫描器：`server-*` 包禁止 import `pg`/`ioredis`/`@aws-sdk`（除 server-storage 的 S3 Provider）；驱动只在 `apps/server` 适配器（09-03）。

## 关联

章程 D8、Q5、Q10；ADR-0025/0031/0035；架构 08。
