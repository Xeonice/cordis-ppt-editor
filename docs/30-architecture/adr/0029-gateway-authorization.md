> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-21 | 依赖：charter v0.1

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
6. **观看链接（share link）**：REST 换票据时把 link 角色折叠进 `role`；WS 不直接接受 link token。**匿名访问路径与登录前置条件的完整定义见下方"2026-09-21 修订"一节**（rulings §4.13 S-1）。
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

## 补充（2026-09-21 修订）：分享链接不引入匿名 Principal，链接角色叠加在已登录 Principal 上；个人账号自助注册路径与外部访问审计

服务端拆分评审（`40-modules/15-server-architecture-review.md` §3.2）指出：决策 6"REST 换票据时把 link 角色折叠进 role"一句，隐含前提是访客已持有一个可供"折叠"的 `Principal`，但完全匿名（无 OIDC 账号）的访客如何先获得这个 `Principal`，本 ADR 此前从未定义——这是一处真实的鉴权路径缺口，而非文字疏漏。用户已就此裁决（`00-charter/rulings-2026-09-14.md` §4.13 S-1），修订如下：

- **不支持真正匿名访问**：分享链接的 `role` 只叠加在**已登录**的 `Principal` 上（`kind:'user'` 或 `'apiKey'`）——任意已登录账号，包括其它租户的用户，凭有效链接令牌即可访问文档并获得链接角色。服务端**不产出** `Principal.kind='shareLink'`；`@oce/protocol` 与 `40-modules/08` 的 `Principal` 类型不再声明该字面量（40-modules/08 §1.2 同步）。
- **鉴权路径**：REST 侧新增 `ShareLinkGuard`（`share-links/interface/guards/share-link-access.guard.ts`）——在 `SessionGuard`/`ApiKeyGuard` 已解析出 `Principal` 之后运行，解析请求中的分享令牌（Header 或 Query）→ 校验未撤销（`revokedAt` 为空）且未过期（`expiresAt` 未到）→ 把令牌对应的 `role` 叠加进当前 `Principal.scopes`，不落库、不产生新 `Principal`。未登录访客访问带分享令牌的资源时，`SessionGuard`/`ApiKeyGuard` 按原有 fail-closed 语义返回 401，由前端跳转登录（不是本 ADR 新增行为，只是明确"分享链接不豁免登录检查"这一前提）。
- **无账号访客的路径**：走 `auth` 模块新增的**个人账号自助注册**（`auth/application/register-personal-account.usecase.ts`）——创建的是 `tenantId=null` 的个人 `User`，不是新租户，与 U-10"租户不开放自助创建"不冲突（开放的是个人账号，不是租户）。注册成功后即为已登录 `Principal`，随后按上一条路径兑现分享链接。
- **WS 侧不变**：决策 2/6 原有"WS 不直接接受 link token"维持不变——协同 ticket 签发（`POST /documents/:id/collab-ticket`）本身就挂在 `DocumentRoleGuard`（≥ viewer）之后，同样可选叠加 `ShareLinkGuard`；票据一旦签发，claims 里的 `role` 已经是叠加后的最终角色，WS 网关侧无需感知令牌来源。
- **外部访问审计**：`ShareLinkGuard` 每次成功叠加角色（即每次真实的外部访问）写一条审计 `share-link.accessed`（`{docId,linkId,principalId,role}`，仅审计，不采样），由 `40-modules/12` 审计模块消费；对照决策 6 表格上方"如何被机械验证"的既有断言口径，本条新增审计断言（见下）。
- **PRD 承接**：`10-prd/03-features/03-collaboration.md` CO-15 原"免登录"表述改为"登录后凭链接即得角色"（由对应回写员同步，不在本 ADR 重复措辞）。

落地文件清单：`40-modules/08-server-identity-documents-and-storage.md` §1.2/§2.4/§2.6/§3/§4.1/§4.6/§5.1/§5.6/§6/§12 G-19/§13 Q-8。

## 如何被机械验证

- conformance/e2e：过期票据 4401；重放票据 4401；viewer 发 update → error 且连接保持；3 次后 4403；降权 → ≤ 1 s 收到 permission 帧且后续 update 被拒；锁定文档拒写。
- 单测：`jti` 单次；`perm_ver` 不一致时以库为准（模拟旧票据）。
- 安全扫描：WS URL/日志中不出现票据以外的凭据（日志脱敏测试）。
- 审计：`permission.*`、`collab.join/leave/forbidden` 事件存在于 `audit_log`（集成测试断言）。
- 分享链接（新增，2026-09-21，rulings §4.13 S-1）：未登录 + 携带分享令牌访问 → 401（不产出匿名 Principal）；已登录 + 有效令牌 → 能力位含链接角色且 `audit_log` 新增一条 `share-link.accessed`；已登录 + 过期/撤销令牌 → 令牌部分静默忽略，仅保留原有能力位（不报错、不降权）；个人账号自助注册 → 登录态成立且 `tenantId` 为 `null`。

## 关联

章程 D12、Q6；ADR-0023/0035；架构 06 §10、08 §2（auth/collab 模块）、§9.1（分享链接需登录 + 外部访问审计，2026-09-21 补充）；`00-charter/rulings-2026-09-14.md` §4.13 S-1；`40-modules/15-server-architecture-review.md` §3.2；`40-modules/08-server-identity-documents-and-storage.md`。
