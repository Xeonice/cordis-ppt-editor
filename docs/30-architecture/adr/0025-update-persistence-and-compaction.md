> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-14 | 依赖：charter v0.1

# ADR-0025 Update 持久化与快照压缩策略

## 状态

提议。

## 背景

CRDT update 是小而多的二进制增量；需要：崩溃不丢已 ack 的更新、快速 bootstrap（06 §9.1 预算 ≤ 500 ms @ 8 MB）、版本历史（命名快照/恢复）、审计回放、存储上限治理。Yjs 的 `Y.snapshot` 需 `gc:false`（体积持续增长），不采用。

## 决策

1. **追加日志**：`document_updates(doc_id, seq, update bytea, …)`；服务端把收到的每个（合并后的）update 帧批量写入（100 ms 或 50 条），提交后回 `ack{seq}`；默认 `persistBeforeBroadcast=true`。
2. **快照**：`document_snapshots` 存整份 `encodeStateAsUpdateV2(doc)`（zstd），`kind ∈ import|auto|named|migration|restore|epoch`；≤ 1 MiB 内联 PG，否则 S3。`documents.latest_snapshot_id` 指向最新 `auto/import/migration/restore/epoch`。
3. **压缩（compaction）触发**：自上次快照起 pending updates ≥ 500 **或** ≥ 5 MiB **或** ≥ 10 分钟且有新 update；由持有 `lock:compact:{doc}` 租约的实例执行：写新 `auto` 快照 → 裁剪 `seq ≤ seq_upto` 且 `created_at < now()-7d` 的 update 行。
4. **bootstrap**：latest snapshot + `updates where seq > seq_upto`；客户端也可直接 `GET /snapshots/latest` 做 HTTP 预加载（06 §9.1）。
5. **命名快照**：用户显式「保存版本」→ `kind named`（永久保留，P2 待决）；自动快照保留 30 天后按天稀疏化（每天保留最后一个）。
6. **恢复（restore）**：不回滚日志；把目标快照加载到临时 Unit，与当前状态做**模型级 diff**（A 线 `diffSnapshots`）生成一次事务（origin `restore`）写回当前文档并落 `kind restore` 快照——CRDT 连续性保持，在线客户端无需重连。
7. **GC**：所有对端 `gc:true`；版本历史完全由服务端快照承担。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 仅存最新状态（每次 update 后覆写一行） | 高频写放大且无法实现精确 ack/回放；崩溃窗口内更新语义模糊 |
| 每 update 一行永久保留（无压缩） | bootstrap 线性变慢；存储无上限 |
| Yjs `Y.snapshot` + `gc:false` 做版本历史 | 文档体积无界增长；所有客户端都需 `gc:false`；恢复语义（`createDocFromSnapshot`）产出新 doc 断开连续性 |
| 恢复 = 回滚日志到 seq | 会丢弃其后所有人的工作且与离线客户端分叉；CRDT 不支持「撤销他人的历史」 |
| 用对象存储存所有 update（每帧一个对象） | 小对象海量、按 doc 顺序读慢 |

## 后果

正面：at-least-once 持久化可观察（ack）；bootstrap 有界；版本历史与 CRDT 内部机制解耦；存储可裁剪。

负面 / 代价：
- 「按时间点恢复」在 7 天外只能到快照粒度（P2）。
- 恢复需要模型级 diff（A 线契约），复杂度在 model-slide；M3 可先实现「整体替换式 diff」（删除全部实体再插入）——正确但撤销栈与他人光标体验差，M4 精化。
- 压缩期间的租约丢失（fencing）需处理：写快照前校验 token；失败仅记录，下一次再试。
- 快照 zstd：Node 内置 `zlib.zstdCompress`（Node ≥ 22.15）或 `@bokuweb/zstd-wasm`；浏览器解压走 `DecompressionStream('zstd')` 可用性检测，回退 gzip（在 `Content-Encoding` 协商中处理）。

## 补充（v0.2）：PRD NF-01 1.7 / NF-10 的预算承接

- 压缩 10,000 update ≤ 2 s（RM-S）：`encodeStateAsUpdateV2` + zstd 对 ≤ 16 MB 状态在 2 vCPU 上约 300–800 ms，余量用于写库；超时则下次再试并告警。
- 单文档 update 日志**压缩后 ≤ 10 × 最新快照大小**（NF-10）：压缩器在 `maxPendingBytes` 之外增加此比值触发条件；裁剪保留 7 天窗口内的行（P2 待决可调）。
- 持久化滞后（update 接收 → 落盘 ack）p99 ≤ 1 s：flush 100 ms / 50 条 → 正常 p95 ≈ 150 ms；PG 抖动时批量退避上限 800 ms，超过则 ack 延迟但不丢（客户端 pending 计数可见）。
- 导入基线包（SV-01）：`kind import` 快照记录 `baseline_key`（原 pptx 对象键），供导出复用不透明部件（08 §16.2）。

## 如何被机械验证

- 单测（server-collab）：触发条件三选一均触发压缩；租约丢失不写；裁剪只删符合条件的行。
- 集成：写 1,000 updates → 压缩 → bootstrap 状态与全量重放相等（`encodeStateAsUpdateV2` 相等）。
- 崩溃测试：在 `ack` 前 kill 进程，重启后客户端重发的 update 被幂等应用，状态一致；`ack` 后 kill，重启后状态包含该 update。
- 恢复测试：restore 后在线客户端不断连且状态 = 目标快照；随后编辑可继续同步。
- 指标：`oce_snapshot_compactions_total`、`oce_collab_persist_latency_ms` 有仪表盘引用（10）。

## 关联

章程 D5/D6/Q5；ADR-0022/0034/0035；架构 06 §6.4、08 §5。
