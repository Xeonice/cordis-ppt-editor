> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-24 | 依赖：charter v0.1；裁决 `docs/00-charter/rulings-2026-09-14.md` §4.15 T-0/Q6/Q9/S-3a

# ADR-0023 协同传输与协议：WebSocket + y-protocols 负载 + 自定义 CONTROL 控制面

## 状态

提议（默认值；章程 §6.2 ADR-0023）。

## 背景

必须回答：房间生命周期、断线重连、权限变更即时生效、鉴权握手在 `@cordexjs/protocol` 中的定义方式。约束：protocol 是 L0 且不得 import y-protocols；传输可替换（章程 §5.4「webrtc 传输」）。

## 决策

1. **传输**：WebSocket（`wss://…/collab/v1/rooms/{documentId}`），客户端 Provider `@cordexjs/collab-transport-ws` 使用全局 `WebSocket`（iso：Node 内建；基线 Node 26，rulings §4.15 Q9），服务端 Nest `ws` 适配器。
2. **负载**：sync 与 awareness 复用 y-protocols 编码（不自造 CRDT 同步）；由 collab-yjs/server-collab 编解码。
3. **信封与控制面**（`@cordexjs/protocol/collab`）：1 字节类型（`SYNC 0 / AWARENESS 1 / CONTROL 2 / QUERY_AWARENESS 3`，与 y-websocket 编号兼容）+ payload；CONTROL 为 UTF-8 JSON，zod 判别联合（`auth`/`auth.ok`/`auth.denied`/`permission`/`ack`/`error`/`repair`/`ping`/`pong`/`room`/`event`），定义见 06 §6.3。
4. **鉴权握手**：REST `POST /documents/:id/collab-ticket` 领取 60 s 单次票据（JWT ES256，含 doc/role/permVersion/jti）；WS 连接后 5 s 内首帧 `auth`，成功前拒绝一切 SYNC/AWARENESS（ADR-0029）。
5. **重连**：指数退避 1 s→30 s（±20% 抖动），6 次失败或 `offline` 事件进入离线模式（本地继续编辑，ADR-0033）；1012（服务端驱逐/重启）首轮不退避。
6. **权限变更**：服务端推 `CONTROL.permission`（06 §10），并对每个入站 update 帧做 role 检查。
7. **ack**（2026-09-24 两级化，S-3a）：服务端落库后回 `ack{seq, tier:'db'}`，客户端据此清理离线队列；PG 故障溢写期先回 `ack{tier:'spill'}`（不清理 pending，只更新「已被服务端接收」状态），回放落库后再回 `tier:'db'`（ADR-0025 决策 8）。
8. **房间生命周期**：06 §5.2 状态机（loading/active/draining/persisting/closed，draining 宽限 30 s）。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 完全采用 y-websocket 协议（无控制面） | 缺鉴权/权限/ack/错误/房间控制；y-websocket 服务端不适合内嵌 Nest 与我们的门禁 |
| Hocuspocus | 优秀，但其扩展模型与我们的 cordis 宿主/Unit 概念重叠；权限与 PG 持久化需大量定制；引入框架级依赖不利「每层可插拔」。我们复用其思路（onAuthenticate/onLoadDocument）而非代码 |
| WebRTC（y-webrtc） | P2P 不满足服务端权限边界（D12）、持久化与审计；保留为可选 `collabTransport` Provider（无服务器演示场景） |
| SSE + HTTP POST | 双通道复杂、代理兼容差、awareness 高频下开销大 |
| 自定义二进制控制面（protobuf） | JSON + zod 足够（控制帧低频）；A3 反对闭合枚举式协议；调试友好 |
| 长时 access token 直接放 WS URL | 泄漏面大（日志/代理）；改为短票据 |

## 后果

正面：与 y-websocket 客户端互操作可用于测试；控制面可演进（`protocolVersion` 协商）；传输可替换。

负面 / 代价：
- 自维护控制面 schema 与关闭码表；需要互操作测试保证与 y-protocols 版本同步。
- 每连接一次 REST 换票据（60 s TTL）：重连风暴时增加 REST 压力 → 票据签发端点有独立限流与缓存（权限解析 5 s 缓存）。
- 应用层 ping（浏览器无 WS ping API）：每 15 s 一帧，可忽略。

## 补充（v0.2）：PRD CO-05 / CO-12 / SV-05 / EM-03 的承接

- **权限变更传播**：门禁 **≤ 2 s**（PRD CO-05/SV-05）；内部目标 ≤ 1 s p95；机制不变（`perm:doc:{id}` 频道 → `CONTROL.permission` → `permissions.applyRemoteDecisions` → 命令管线即时生效 → `permission/changed` 事件）。
- **容量策略**：`maxEditors: 20` + `maxViewers: 50`；编辑者满 → 以 `role: viewer, reason: 'capacity'` 只读加入；查看者也满 → `auth.denied{ collab.room_full }`（4503）。房间空置销毁延迟 **60 s**（取代 30 s）。
- **速率**：每连接 ≤ 200 帧/s（突发 500，令牌桶）；单帧 ≤ 1 MiB；awareness 节流 ≥ 50 ms；未知 CONTROL 类型丢弃并计数（不关闭）。
- **协议版本协商**：`auth.protocolVersion` 与服务端支持窗口 `[min, max]` 比对；不兼容 → `auth.denied{ collab.protocol_mismatch }` + 关闭码 **4427**（与 schema 版本的 4426 区分）。
- **凭据两种形态（EM-03）**：(a) 一方票据（60 s、`jti` 单次，REST 换取）——M1–M3 唯一形态；(b) 集成方签名 JWT（≤ 1 h，JWKS 验签，claims `sub/doc/caps[]/exp`；2026-09-24 删 `tenant`——T-0；**降为 M4**——rulings §4.15 Q6，见 ADR-0029 修订）直接放入 `auth` 帧，无需先换票据；权限来源可为 claims 或集成方回调（缓存 ≤ 60 s，撤销经推送 ≤ 2 s）。到期前 60 s 由 `getToken()` 刷新并以新增 CONTROL 消息 `auth.refresh{ token }` 续期（不断连）；刷新失败 → `reconnecting`，30 s 后 → `offline`。
- **停机与传播**：1012 → 客户端 ≤ 5 s 重连到其它实例；跨实例 ≤ 50 ms；房间内广播 p95 ≤ 100 ms。
- **事件名**：`collab/state-changed`、`collab/auth-failed`、`collab/reconnect{reason}`（PRD EM-05）取代本 ADR 草稿名；定稿表见 10 §11。

## 如何被机械验证

- `runCollabConformance` 覆盖：握手超时、票据过期、降权拒写、重连退避序列（用 FixedClock 断言时刻）、1012 立即重连、ack 清理（2026-09-24：`tier:'spill'` 不清理、`tier:'db'` 才清理）。
- 互操作测试：用 `y-websocket` 官方客户端连接我们的网关（仅 SYNC/AWARENESS 路径）能同步（CI job）。
- zod schema 快照测试：CONTROL 消息 JSON schema 导出后入库，变更需显式更新（API 变更可见）。
- 扫描器：protocol 包无 `y-protocols`/`yjs` import（09-03）。

## 关联

章程 D12、§5.4；`00-charter/rulings-2026-09-14.md` §4.15 T-0/Q6/Q9/S-3a；ADR-0025/0029/0033/0034/0035；架构 06 §5–6、08 §2（collab 模块）。
