> 状态：已接受 | 负责：架构-运行时 | 更新：2026-09-24；2026-09-24 复核修正（rulings §4.17 D2；复核报告 M21、L6、L20）；2026-09-25（补图）；2026-09-25（矛盾收口，rulings §4.18）；2026-09-25（§4.19：名额字段落点改指 60-backend/05；多实例扇出仍为 M3，M2 协同后端为单实例，rulings §4.19 D-M2-CONTENT） | 依赖：charter v0.1；裁决 `docs/00-charter/rulings-2026-09-14.md` §4.15 Q5/Q10、§4.17、§4.18

# ADR-0035 协同网关横向扩展：多副本房间 + Redis 协议扇出（默认 Valkey），不依赖房间亲和

## 状态

**已接受**（2026-09-24，用户裁决 `00-charter/rulings-2026-09-14.md` §4.15 Q10：自托管 compose、同镜像按 `CORDEX_ROLE` 拆 collab 实例，Helm 为 M4 P1；Q5：房间**按文档实测权重准入**、多副本内存相乘）。原状态「提议（章程 Q10：单体起步，K8s 后续）」。v0.2 补充中的固定 MB/房间准入被下方「2026-09-24 修订」取代。Redis 协议实现默认 Valkey（ADR-0022），下文「Redis」均指 Redis 协议兼容实现。2026-09-25 按 rulings §4.18 修订决策 9（PG 不可达时的下线收尾与遗留溢写回放，CO-16）与修订第 2 条（「实例内存预算」定义，BE-29；内存压力下先回收空置房间，CO-14），以「原：…作废」就地保留演进。

## 背景

多实例下同一文档的客户端可能连到不同实例；需要：正确性不依赖路由；滚动发布不整房间断连；单写者任务（压缩/迁移）不重复；在线人数权威值。

## 决策

1. 任一实例都可服务任一文档：每个实例为其有客户端的文档维护一份 Room（Y.Doc 副本，= 服务端 Unit）。
2. **扇出**：实例把通过门禁的 SYNC/AWARENESS/CONTROL 帧 `PUBLISH collab:doc:{id}`（含 `instanceId`），其他实例订阅并应用/转发；自身发布的消息按 `instanceId` 忽略。CRDT 幂等保证重复无害。
3. **持久化**：每个实例只持久化**自己客户端**发来的 update（避免重复行）；跨实例收到的 update 只应用不落库。
4. **单写者任务**：压缩、迁移、rekey、epoch 通过 Redis 租约锁（`SET NX PX` + fencing token）选举执行者。快照 REST 与管理动作（compact/migrate/epoch）只在 collab（及 `all`）角色装配（ADR-0037 决策 1）：快照恢复在接到请求的实例上打开 Room 执行，多副本经扇出收敛；`forceEpoch` 递增 epoch 后经 Valkey 通知其他持有该 Room 的 collab 实例一并踢出会话（2026-09-25，rulings §4.18 BE-03）。
5. **在线人数**：`HSET room:{id}:clients {instanceId} n`（TTL 60 s 心跳），`CONTROL.room{clients}` 取聚合值。
6. **权限传播**：`perm:doc:{id}` 频道（ADR-0029）。
7. **可选偏好亲和**：LB 可按 `documentId` 一致性哈希偏好某实例以减少副本数，但不是正确性前提；实例失联时客户端重连到任何实例。
8. **Redis 故障**：实例内部一致；跨实例延迟直至恢复；`/readyz` 返回 503 让 LB 停止新连接（旧连接保留）；恢复后客户端重连触发 step1/step2 补齐。
9. **滚动发布**：SIGTERM → `/readyz` 503 → 向客户端发 1012 → flush/persist → 退出（≤ 30 s）；客户端 1012 首轮不退避。**PG 不可达时**（2026-09-25 修订，rulings §4.18 CO-16）：flush 阶段先把内存档强制写入一级溢写再退出，不在 `persisting` 久等（30 s 预算等不起）；存活实例只回放**自己 `instanceId`** 的溢写行（`readAllOrdered(docId, instanceId)`，与决策 3「只持久化自己客户端的 update」一致、避免两实例重复回放）；心跳已过期（决策 5，TTL 60 s）实例遗留的溢写行，由下一次加载该文档的 Room 在 bootstrap 之后持 `lock:spill:{doc}` 租约认领回放。在线客户端不受影响：收到 1012 后带着未得 db ack 的 pending 重连到其他实例，step2 自然补齐；溢写兜底的只是已离开客户端的更改。（原：只写「flush/persist → 退出」，未覆盖 PG 不可达，40-modules/09 曾写「PG 恢复前 Room 停留 persisting」并按 docId 读出全部实例的溢写行，作废。）

**图 1 多副本房间与 Redis 协议扇出**

```mermaid
flowchart TD
  clientA["客户端 A"] --> lb["LB：可选按 documentId 一致性哈希偏好，非正确性前提"]
  clientB["客户端 B"] --> lb
  lb --> instA["collab 实例 A：文档 X 的 Room 副本，Y.Doc = 服务端 Unit"]
  lb --> instB["collab 实例 B：文档 X 的 Room 副本"]
  instA -- "PUBLISH collab:doc:{id}，含 instanceId" --> valkey["Valkey：Redis 协议，另承载租约锁 SET NX PX + fencing 与在线人数 HSET room:{id}:clients，TTL 60 s 心跳"]
  valkey -- "订阅，应用或转发，忽略自身 instanceId" --> instB
  instA -- "只持久化自己客户端发来的 update" --> pg["Postgres"]
  instB -- "只持久化自己客户端发来的 update" --> pg
```

怎么读：箭头是帧与数据的流向；图中只画了 A → B 一个方向的扇出，B → A 对称。Valkey 同时是两个实例共用的协调点：压缩、迁移、rekey、epoch 靠租约选出单写者，在线人数取各实例上报的聚合值。跨实例收到的 update 只应用不落库，所以 PG 中不会出现重复行。

**图 2 滚动发布时一个实例的下线顺序**

```mermaid
sequenceDiagram
  participant lb as LB
  participant inst as 下线中的 collab 实例
  participant client as 该实例上的客户端
  participant other as 其它 collab 实例
  Note over inst: 收到 SIGTERM
  inst-->>lb: /readyz 返回 503，LB 停止新连接
  inst->>client: 关闭码 1012
  inst->>inst: flush 与 persist，PG 不可达时强制写一级溢写
  Note over inst: 从 SIGTERM 到退出 ≤ 30 s
  client->>other: 首轮不退避，≤ 5 s 重连
  Note over client,other: step1 与 step2 补齐，未落库的 update 由客户端重发
```

怎么读：纵线是参与方，自上而下是时间顺序。客户端被 1012 断开后立刻重连到其它实例，正确性由 CRDT 幂等与 ack 机制保证，不依赖原实例。

依据：本文决策 8–9、「后果」与补充（v0.2）滚动发布一条。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 严格房间亲和（粘性路由，单副本） | 实例故障/发布导致整房间断连并等待新实例 bootstrap；LB 需要理解 URL；仍需 fallback 逻辑 |
| y-redis 架构（Redis 为主存 + worker 持久化） | 与 PG 为持久层的决策冲突（ADR-0022）；引入另一套房间模型 |
| 独立协调服务（如 NATS/JetStream） | 增加基础设施；Q5 规模 Redis pub/sub 足够 |
| 单实例 | 不满足可用性与发布需求（compose 阶段可单实例运行，本方案兼容） |

## 后果

正面：无粘性、发布无感（客户端秒级重连）、正确性由 CRDT 保证、实现简单。

负面 / 代价：热门文档多副本内存（= 副本数 × 该文档实测权重；D200 ≈ 85 MB/副本，见下方修订；原「≤ 副本数 × 40 MB」作废）；Redis 是扇出关键路径（但不是持久化关键路径）；每实例都做软门禁（重复 CPU，但每帧 ≤ 5 ms）；持久化「只写自己客户端的 update」要求实例崩溃时其未落库的 update 由持有者客户端重发（ack 机制保证）。

## 补充（v0.2）：PRD SV-05 / NF-01 1.7 / NF-10 的量化承接

- 单实例（RM-S 2 vCPU / 4 GB）：≥ 2,000 并发 WS、活跃房间**按文档实测权重准入**（各档 D50 / D200 / 20K 的房间数 M1 实测后回填；原「≥ 200 活跃房间」作废，2026-09-24 复核修正）、CPU < 70%、房间内广播 p95 ≤ 100 ms、跨实例传播 ≤ 50 ms（同机房 Redis）。
- **内存准入**（2026-09-24 起被下方修订取代，保留以示演进）：200 房间在 4 GB 内的前提是 D50 级文档（≈ 12 MB/房间 = Y.Doc + 模型读视图 + 会话）；D200 级 ≈ 40 MB/房间。RoomManager 以 RSS 预算准入：RSS > 75% 时对新房间返回 4503（客户端退避后重连到其它实例，LB 分散），并优先驱逐空置房间；**与 PRD「≥ 200」的差异在此注明**（PRD 值按 D50 级成立）。
- 全系统（NF-10）：5,000 并发编辑者、2,000 活跃文档 → 约 10–12 个 collab 实例（含热文档多副本冗余），Redis pub/sub 吞吐 ≈ 5,000 × 10 帧/s × 副本数 ≤ 20 万消息/s，单 Redis 可承载；超出时按 `hash(doc_id)` 分片频道前缀（`collab:{shard}:doc:{id}`；2026-09-24 删去「按租户」——T-0）。
- 滚动发布：SIGTERM → `/readyz` 503 → 1012 → flush → 退出 ≤ 30 s；客户端 ≤ 5 s 重连（SV-05）。

## 修订（2026-09-24，rulings §4.15 Q5 / Q10）：按文档实测权重准入、多副本相乘、名额按用户计

1. **实测内存**（合成模型，yjs 13.6.32 / Node 24）：约 **13.8 KB 堆/元素**——D200（≈ 6,000 元素）≈ **85 MB**，D50 ≈ **17.8 MB**，天花板 20,000 元素 ≈ 276 MB。v0.2 的 40 / 12 MB/房间估算偏低，作废。
2. **按文档实测权重准入**：RoomManager 为每个房间计算权重 = 该文档实测值（Y 结构数或堆估算，含软删除墓碑——ADR-0020），准入条件为「本实例已有房间权重之和 + 新房间权重 ≤ 实例内存预算」，其中**实例内存预算 = 容器内存上限（cgroup 限额，Node `process.constrainedMemory()`；无限额时取物理内存）× `room.memoryAdmissionPct`（默认 75，部署可调）**（2026-09-25 修订，rulings §4.18 BE-29：作废的只是旧的「按 RSS > 75% 判定」这种方式，75% 作为权重预算比例保留；`room.weightBudgetBytes` 若保留只作可选的绝对覆盖值）；**同一文档在 N 个实例上各有一份副本，集群总占用 = 权重 × N**，偏好亲和（决策 7）是降低 N 的手段。超预算返回 4503（客户端退避后重连其他实例）。内存压力或准入不足时**先按 LRU 提前结束空置（draining）房间**（`draining → persisting → closed`，无在线客户端、无需 1012），仍超预算才对 active 房间走 `active → evicting`（发 1012）；不存在 `draining → evicting` 边（2026-09-25 修订，rulings §4.18 CO-14，与架构 06 §5.2/§14 一致；原：「仍优先驱逐空置房间」，与 evicting 只用于有在线客户端的房间相混，作废）。
3. **规模口径两层**（Q5）：性能保证包络（D200、DX-1000、20 编辑者 + 50 查看者、200 MB）内门禁只收紧；系统天花板 = 200 页 / 单页 1,000 / 文档总元素 20,000（软警告 15,000，墓碑计入）。**超天花板的导入直接拒绝**（`format.quota_exceeded{dimension, limit, actual}`；编辑期超上限为 `document.quota_exceeded`，rulings §4.17 D2；2026-09-24 复核修正：原「超包络」混用了两层口径——包络是性能保证，天花板才是拒绝线）。规模数字为**部署配置、完全可调**；调到包络外时启动告警、`/readyz` 标注，性能承诺不再成立。
4. **房间名额按用户计**：同一用户多标签页/多设备只占 1 个名额；commenter 计入查看者名额；owner 不占编辑者名额、满员时不被降级（`config.room` 增 `countBy:'user'` 等字段，由 60-backend/05 §4 与 40-modules/09 落地）。满员房间（20 + 50）需要服务端 awareness 合并 tick、查看者只上报 view（ADR-0024 / 06 §7 承接）。
5. **单实例口径**：RM-S 2 vCPU / 4 GB 作为 **collab 单实例**口径；NF-01 §1.7「≥ 200 房间」改为按文档规模分档（D50 / D200 / 20K）重算，M1 实测后填入；compose 全家桶的主机规格另见 ADR-0037。
6. **部署拓扑**（Q10）：collab 实例 = 同一镜像 `CORDEX_ROLE=collab`（或 `all` 单进程）；compose 阶段可单实例运行；K8s/Helm 为 M4 P1（ADR-0037）。

## 如何被机械验证

- server-integration：`createServerCluster(2)`（内存总线）与 testcontainers Valkey（Redis 协议兼容，ADR-0022；2026-09-24 复核修正）两种模式：A 实例客户端编辑 → B 实例客户端 ≤ 100 ms 看到；B 崩溃 → 其客户端重连 A 后状态一致；两实例同时触发压缩只执行一次（锁）。
- 混沌：Redis 断开 30 s → 恢复后两端一致；`/readyz` 期间为 503。
- 发布演练脚本：滚动重启期间 e2e 双浏览器编辑不丢（`ack` 全部到达）。
- 指标：`cordex_collab_rooms_active{instance}` 与 `room:{id}:clients` 聚合一致（监控校验）。
- （2026-09-24）准入：单测覆盖「权重之和超预算 → `auth.denied{collab.room_full}` / 关闭码 4503」「墓碑计入权重」；perf 场景 DX-20K 与满员房间（20 + 50）扇出压测（11-testing §9、`test/perf/budgets.json`）；同用户双标签页只占 1 名额的集成测试。
- （2026-09-24）导入超天花板（> 200 页 / 单页 > 1,000 / 总元素 > 20,000）返回 `format.quota_exceeded`（2026-09-24 复核修正：原「超包络」「`quota_exceeded`」）。
- （2026-09-25，rulings §4.18 CO-16）`spill-and-replay.test`：两实例同时在线各自只回放本实例的行、无重复行；实例下线后由新实例加载时认领回放；SIGTERM 且 PG 不可达时 ≤ 30 s 内完成「写一级溢写 → 退出」。
- （2026-09-25，rulings §4.18 BE-29/CO-14）准入单测：预算 = 容器内存上限 × `memoryAdmissionPct`（注入假的 `constrainedMemory()`）；内存压力下先结束空置 draining 房间、不向任何客户端发 1012，仍超预算才驱逐 active 房间。

## 关联

章程 Q5/Q10、D8；`00-charter/rulings-2026-09-14.md` §4.15 Q5/Q10、§4.18 BE-03/BE-29/CO-14/CO-16；ADR-0020/0022/0023/0024/0025/0029/0037；架构 06 §5.2、08 §8/§10。
