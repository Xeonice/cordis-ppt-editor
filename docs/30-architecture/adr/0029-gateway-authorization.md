> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-14 | 依赖：charter v0.1

# ADR-0029 协同网关鉴权与授权：短票据握手 + 每帧角色检查 + 权限版本传播

## 状态

提议（章程 D12、Q6）。

## 背景

D12：fail-closed，检查点在命令管线与服务端网关两处。WS 无法像 REST 那样每请求校验 cookie/头；权限可能在会话中途变化；票据泄漏面要小；多实例下权限变更要即时。

## 决策

1. **票据**：`POST /documents/:id/collab-ticket` 由 REST 会话鉴权后签发 JWT（ES256，60 s，`jti` 单次），claims：`sub, tid, doc, role, perm_ver, sid?`。网关验签 + `jti` 防重放（Redis SETNX 60 s）+ `perm_ver` 对比 Redis 最新值（不一致以库为准）。
2. **握手**：连接后首帧必须为 `CONTROL.auth`（5 s 超时 → 4408）；成功前任何 SYNC/AWARENESS 帧 → 4401。
3. **每帧检查**：`SYNC update/step2` 帧要求 `session.role ≥ editor`；`AWARENESS` 允许 `viewer+`；CONTROL 只允许白名单类型。违规 → `error{collab.forbidden}`，累计 3 次 → 4403。
4. **权限变更即时生效**：PermissionsService 写库后 `perm_ver++` 并 `PUBLISH perm:doc:{id}`；各实例对相关 Session 重算 role → `CONTROL.permission` 或关闭 4403；预算 ≤ 1 s p95。
5. **文档锁定**（`documents.status='locked'`）：网关拒写（同降权），用于导入/恢复/迁移窗口。
6. **观看链接（share link）**：REST 换票据时把 link 角色折叠进 `role`；WS 不直接接受 link token。
7. **API Key**：M3 不允许走 WS（B7 待决）。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| WS 升级请求带会话 cookie | 跨站嵌入（SDK 场景）下 cookie 不可用；无法携带 doc 级权限快照；升级请求的头在部分代理/日志中可见 |
| 长时 access token 放 URL query | 泄漏面（日志、Referer、代理）；无法单次使用 |
| 每个 update 帧查库校验权限 | 延迟与库压力；改为会话内缓存 role + 版本号推送 |
| 仅客户端检查权限 | 不是安全边界 |
| `Sec-WebSocket-Protocol` 传 token | 非标准用法、代理兼容差、长度限制 |

## 后果

正面：泄漏面小；权限变更秒级生效；网关无需查库即可校验；多实例一致。

负面 / 代价：重连必须先换票据（一次 REST）；票据签发端点需独立限流；`perm_ver` 需在 Redis 与 PG 双写（PG 为准，Redis 缓存；缓存缺失时回源）。

## 补充（v0.2）：PRD EM-03 / CO-05 的承接

- **凭据两种形态**：(a) 一方票据（60 s、`jti` 单次），用于 `apps/web` 与 OIDC 登录用户；(b) **集成方签名 JWT**（≤ 1 h，JWKS 验签；claims 草案 `sub`、`tenant`、`doc`、`caps[]`（能力位）、`exp`）直接放入 `CONTROL.auth`，无需先换票据。Auth 模块同时支持 OIDC 与「集成方签名 JWT」两种模式。
- **权限来源可替换**：默认读 JWT claims（`caps[]` → Role/能力位）；可配置为回调集成方权限服务（缓存 ≤ 60 s）；撤销通过 `perm:doc:{id}` 推送 ≤ 2 s 生效（不等缓存过期）。
- **令牌刷新**：客户端 `getToken()` 在到期前 60 s 刷新并以 `CONTROL.auth.refresh{ token }` 续期（不断连）；服务端校验后更新 session 的过期时间与 role；刷新失败 → `reconnecting` → 30 s → `offline`。
- **单人模式**：无服务端时集成方直接传入能力位，客户端命令管线 fail-closed（CO-05）。
- **错误码映射**：PRD `auth/invalid-token`、`auth/expired`、`auth/forbidden` → `server.auth.invalid_token`、`server.auth.expired`、`server.auth.forbidden`（HTTP 401/401/403；WS 4401/4401/4403），均触发 `collab/auth-failed` 事件且不泄露内部细节（10 §11.2）。
- **构造消息绕过客户端**（CO-05）：服务端拒绝该 update 并在累计 3 次后断开（4403），审计 `collab.update_rejected`。

## 如何被机械验证

- conformance/e2e：过期票据 4401；重放票据 4401；viewer 发 update → error 且连接保持；3 次后 4403；降权 → ≤ 1 s 收到 permission 帧且后续 update 被拒；锁定文档拒写。
- 单测：`jti` 单次；`perm_ver` 不一致时以库为准（模拟旧票据）。
- 安全扫描：WS URL/日志中不出现票据以外的凭据（日志脱敏测试）。
- 审计：`permission.*`、`collab.join/leave/forbidden` 事件存在于 `audit_log`（集成测试断言）。

## 关联

章程 D12、Q6；ADR-0023/0035；架构 06 §10、08 §2（auth/collab 模块）、§9.1。
