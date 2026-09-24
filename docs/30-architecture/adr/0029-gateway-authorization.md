> 状态：已接受 | 负责：架构-运行时 | 更新：2026-09-24；2026-09-24 复核修正（rulings §4.17 D1/D3；复核报告 M11：门禁名 `check-rls-coverage`） | 依赖：charter v0.1；裁决 `docs/00-charter/rulings-2026-09-14.md` §4.13 S-1、§4.15 T-0/Q6、§4.17

# ADR-0029 协同网关鉴权与授权：短票据握手 + 每帧角色检查 + 权限版本传播

## 状态

**已接受**（2026-09-24，用户裁决 `00-charter/rulings-2026-09-14.md` §4.15 T-0 与 Q6）。原状态「提议（章程 D12、Q6）」。接受时的修订见文末「2026-09-24 修订」：单组织完全去租户；服务端只认 OIDC（外置 IdP，compose 可选 Casdoor），集成方签名 JWT 与 API Key 降为 M4；`auth.selfSignup` 部署级开关默认关；数据访问兜底加文档级 Postgres RLS；组管理推迟。凡正文与该节冲突处以该节为准，下文已就地标注。

## 背景

D12：fail-closed，检查点在命令管线与服务端网关两处。WS 无法像 REST 那样每请求校验 cookie/头；权限可能在会话中途变化；票据泄漏面要小；多实例下权限变更要即时。

## 决策

1. **票据**：`POST /documents/:id/collab-ticket` 由 REST 会话鉴权后签发 JWT（ES256，60 s，`jti` 单次），claims：`sub, doc, role, perm_ver, sid?`（2026-09-24 删去 `tid`——T-0 去租户）。网关验签 + `jti` 防重放（Redis SETNX 60 s）+ `perm_ver` 对比 Redis 最新值（不一致以库为准）。
2. **握手**：连接后首帧必须为 `CONTROL.auth`（5 s 超时 → 4408）；成功前任何 SYNC/AWARENESS 帧 → 4401。
3. **每帧检查**：`SYNC update/step2` 帧要求 `session.role ≥ editor`；`AWARENESS` 允许 `viewer+`；CONTROL 只允许白名单类型。违规 → `error{collab.forbidden}`，累计 3 次 → 4403。
4. **权限变更即时生效**：PermissionsService 写库后 `perm_ver++` 并 `PUBLISH perm:doc:{id}`；各实例对相关 Session 重算 role → `CONTROL.permission` 或关闭 4403；预算 ≤ 1 s p95。
5. **文档锁定**（`documents.status='locked'`）：网关拒写（同降权），用于导入/恢复/迁移窗口。
6. **观看链接（share link）**：REST 换票据时把 link 角色折叠进 `role`；WS 不直接接受 link token。**匿名访问路径与登录前置条件的完整定义见下方"2026-09-21 修订"一节**（rulings §4.13 S-1）。
7. **API Key**：**降为 M4**（rulings §4.15 Q6），M1–M3 服务端不接受 API Key；M4 引入时仍不允许直接走 WS，须先经 REST 换票据（原 B7 待决随之结案）。

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

- **凭据两种形态**：(a) 一方票据（60 s、`jti` 单次），用于 `apps/web` 与 OIDC 登录用户——**M1–M3 唯一形态**；(b) **集成方签名 JWT**（≤ 1 h，JWKS 验签；claims 草案 `sub`、`doc`、`caps[]`（能力位）、`exp`；2026-09-24 删去 `tenant`）直接放入 `CONTROL.auth`，无需先换票据——**2026-09-24 起降为 M4**，届时按 `sub` JIT 建影子用户（`documents.owner_id`、`comments.author_id` 需外键），ticket-verifier 增加该分支（14 §5.10 G-19）。
- **权限来源可替换**（随 (b) 降为 M4；M1–M3 权限来源只有服务端 `permissions` 表）：默认读 JWT claims（`caps[]` → Role/能力位）；可配置为回调集成方权限服务（缓存 ≤ 60 s）；撤销通过 `perm:doc:{id}` 推送 ≤ 2 s 生效（不等缓存过期）。
- **令牌刷新**：客户端 `getToken()` 在到期前 60 s 刷新并以 `CONTROL.auth.refresh{ token }` 续期（不断连）；服务端校验后更新 session 的过期时间与 role；刷新失败 → `reconnecting` → 30 s → `offline`。
- **单人模式**：无服务端时集成方直接传入能力位，客户端命令管线 fail-closed（CO-05）。
- **错误码映射**：PRD `auth/invalid-token`、`auth/expired`、`auth/forbidden` → `server.auth.invalid_token`、`server.auth.expired`、`server.auth.forbidden`（HTTP 401/401/403；WS 4401/4401/4403），均触发 `collab/auth-failed` 事件且不泄露内部细节（10 §11.2）。
- **构造消息绕过客户端**（CO-05）：服务端拒绝该 update 并在累计 3 次后断开（4403），审计 `collab.update_rejected`。

## 补充（2026-09-21 修订）：分享链接不引入匿名 Principal，链接角色叠加在已登录 Principal 上；个人账号自助注册路径与外部访问审计

服务端拆分评审（`40-modules/15-server-architecture-review.md` §3.2）指出：决策 6"REST 换票据时把 link 角色折叠进 role"一句，隐含前提是访客已持有一个可供"折叠"的 `Principal`，但完全匿名（无 OIDC 账号）的访客如何先获得这个 `Principal`，本 ADR 此前从未定义——这是一处真实的鉴权路径缺口，而非文字疏漏。用户已就此裁决（`00-charter/rulings-2026-09-14.md` §4.13 S-1），修订如下：

- **不支持真正匿名访问**：分享链接的 `role` 只叠加在**已登录**的 `Principal` 上（M1–M3 仅 `kind:'user'`；`'apiKey'` 随 API Key 降 M4）——同一部署内任意已登录账号凭有效链接令牌即可访问文档并获得链接角色（2026-09-24 删去「包括其它租户的用户」——T-0）。服务端**不产出** `Principal.kind='shareLink'`；`@cordexjs/protocol` 与 `40-modules/08` 的 `Principal` 类型不再声明该字面量（40-modules/08 §1.2 同步）。
- **鉴权路径**：REST 侧新增 `ShareLinkGuard`（`share-links/interface/guards/share-link-access.guard.ts`）——在 `SessionGuard`/`ApiKeyGuard` 已解析出 `Principal` 之后运行，解析请求中的分享令牌（Header 或 Query）→ 校验未撤销（`revokedAt` 为空）且未过期（`expiresAt` 未到）→ 把令牌对应的 `role` 叠加进当前 `Principal.scopes`，不落库、不产生新 `Principal`。未登录访客访问带分享令牌的资源时，`SessionGuard`/`ApiKeyGuard` 按原有 fail-closed 语义返回 401，由前端跳转登录（不是本 ADR 新增行为，只是明确"分享链接不豁免登录检查"这一前提）。
- **无账号访客的路径**（2026-09-24 改写，原「服务端 `register-personal-account.usecase.ts` 创建 `tenantId=null` 的个人 User」作废——服务端不持有密码、无租户）：由部署级开关 **`auth.selfSignup`（默认关）** 决定。关闭时由管理员在 IdP 中建号（**服务端不设「待接受邀请」表、无邀请兑现流程**；分享邀请只对已存在账号生效，被邀请者尚无账号时提示「联系管理员开通账号」——2026-09-24 复核修正，rulings §4.17 D1）；开启时访客在 **IdP**（compose 可选 Casdoor 或任意 OIDC IdP）自助注册，服务端在**首次 OIDC 登录时 JIT 建号**。登录成功后即为已登录 `Principal`，随后按上一条路径兑现分享链接。
- **WS 侧不变**：决策 2/6 原有"WS 不直接接受 link token"维持不变——协同 ticket 签发（`POST /documents/:id/collab-ticket`）本身就挂在 `DocumentRoleGuard`（≥ viewer）之后，同样可选叠加 `ShareLinkGuard`；票据一旦签发，claims 里的 `role` 已经是叠加后的最终角色，WS 网关侧无需感知令牌来源。
- **外部访问审计**：`ShareLinkGuard` 每次成功叠加角色（即每次真实的外部访问）写一条审计 `share-link.accessed`（`{docId,linkId,principalId,role}`，仅审计，不采样），由 `40-modules/12` 审计模块消费；对照决策 6 表格上方"如何被机械验证"的既有断言口径，本条新增审计断言（见下）。
- **PRD 承接**：`10-prd/03-features/03-collaboration.md` CO-15 原"免登录"表述改为"登录后凭链接即得角色"（由对应回写员同步，不在本 ADR 重复措辞）。

落地文件清单：`40-modules/08-server-identity-documents-and-storage.md` §1.2/§2.4/§2.6/§3/§4.1/§4.6/§5.1/§5.6/§6/§12 G-19/§13 Q-8。

## 修订（2026-09-24，rulings §4.15 T-0 / Q6）：单组织去租户、外置 IdP、文档级 RLS

> 方向性裁决：多租户/SaaS 设计属过度复杂化，本项目只做**单组织「用户登录 + 协同」**。证据包 `00-charter/_evidence/q1-q10-decision-pack.json` 的 Q6 推荐（三种凭据模式、Keycloak、tenant_memberships、租户级 RLS、另立 ADR-0036）与本节冲突处**以本节为准**；不另开 ADR-0036，身份与去租户口径记录在本节。

1. **单组织、完全去租户（T-0）**：一次部署 = 一个组织；数据模型、API、票据 claims、权限中**无 tenant**（本 ADR 已删 `tid`/`tenant` claim）。U-10「租户不开放自助创建」、S-1 的跨租户措辞、S-3 按租户分桶、§4.13 `GroupRepository.findById` 补 `tenantId` 均以本节为准而失效。将来若做 SaaS 另立项、以迁移加回。
2. **外置 IdP，服务端只认 OIDC（M1–M3）**：服务端是 OIDC RP，**不持有用户密码**；compose 提供**可选** `idp` profile，内置 **Casdoor**（Apache-2.0，Go 实现、轻量；原生支持企业微信/钉钉/飞书，国内 IM 经 Casdoor 代理，服务端不写私有 OAuth 适配器），可换成任意 OIDC IdP。用户以 `(issuer, subject)` 唯一识别，具体表结构由 40-modules/08 定稿（不含租户与成员关系表）。
3. **集成方签名 JWT 与 API Key 降为 M4**：届时按 `sub` JIT 建影子用户；M1–M3 票据只由 OIDC 会话换取。
4. **注册策略 = 部署级开关 `auth.selfSignup`，默认关**：关闭时由管理员在 IdP 建号（邀请仅对已存在账号生效，无待接受邀请表，rulings §4.17 D1）；开启时在 IdP 自助注册、首次登录 JIT 建号。分享链接**始终要求登录**（延续 S-1 不匿名）。`apps/web` 的 `auth.mode:'none'` 只限 dev 构建，服务端在 production 下拒绝无鉴权启动。
5. **数据访问兜底 = 文档权限检查（D12）+ 文档级 Postgres RLS**：RLS 以「当前主体对该 `doc_id` 的权限」为判定（设计见 ADR-0022 修订 §3）；它是纵深防御，不替代本 ADR 决策 1–4 的网关检查与 REST Guard。机械上为**两道防线**（2026-09-24 复核修正，rulings §4.17 D3）：代码层扫描器 `doc-access-via-permission`（M-01 第 14 个扫描器：按文档读写的仓储方法必须经权限服务）+ 数据库层文档级 RLS（治理检查脚本 `check-rls-coverage`）。
6. **CI 分层认证**：PR 门禁 = Casdoor 容器 + `oidc-provider` mock（可离线稳定运行）；nightly / 发布前认证 Keycloak、Entra ID、飞书等外部 IdP。
7. **组管理（U-11）推迟**：M3 只按人分享；权限主体仅 `user`（与分享链接叠加），不出现 `group`。

## 如何被机械验证

- conformance/e2e：过期票据 4401；重放票据 4401；viewer 发 update → error 且连接保持；3 次后 4403；降权 → ≤ 1 s 收到 permission 帧且后续 update 被拒；锁定文档拒写。
- 单测：`jti` 单次；`perm_ver` 不一致时以库为准（模拟旧票据）。
- 安全扫描：WS URL/日志中不出现票据以外的凭据（日志脱敏测试）。
- 审计：`permission.*`、`collab.join/leave/forbidden` 事件存在于 `audit_log`（集成测试断言）。
- 分享链接（新增，2026-09-21，rulings §4.13 S-1）：未登录 + 携带分享令牌访问 → 401（不产出匿名 Principal）；已登录 + 有效令牌 → 能力位含链接角色且 `audit_log` 新增一条 `share-link.accessed`；已登录 + 过期/撤销令牌 → 令牌部分静默忽略，仅保留原有能力位（不报错、不降权）；首次 OIDC 登录 → JIT 建号且登录态成立（2026-09-24 改写，原「个人账号自助注册 → `tenantId` 为 `null`」作废）。

- （2026-09-24）T-0：票据 claims、仓储签名、迁移脚本中不出现 `tid`/`tenant`/`tenantId`（扫描器）。
- （2026-09-24）Q6：M1–M3 服务端拒绝集成方 JWT 与 API Key 凭据（4401/401）；`auth.selfSignup` 缺省为 `false`；production 构建下 `auth.mode:'none'` 启动失败；PR CI 跑 Casdoor 容器 + `oidc-provider` mock 的 OIDC 登录 e2e。
- （2026-09-24）文档级 RLS：`check-rls-coverage` 门禁（40-modules/01 治理检查脚本；原名 `rls-policy-coverage` 作废，2026-09-24 复核修正）+ 故障注入 e2e（绕过应用层权限检查时跨文档读取仍被拒），M3 出口。
- （2026-09-24 复核修正，rulings §4.17 D3）代码层：扫描器 `doc-access-via-permission` 对 `apps/server` 仓储方法生效，与上条 RLS 门禁构成两道防线。
- （2026-09-24 复核修正，rulings §4.17 D1）邀请：对未注册邮箱发起分享邀请 → 返回「账号不存在，请联系管理员」且不落任何待接受记录；服务端无 `pending_invitations` 表与邀请兑现端点。

## 关联

章程 D12、Q6；`00-charter/rulings-2026-09-14.md` §4.15 T-0/Q6；ADR-0022（RLS 设计）/0037（Casdoor profile）；ADR-0023/0035；架构 06 §10、08 §2（auth/collab 模块）、§9.1（分享链接需登录 + 外部访问审计，2026-09-21 补充）；`00-charter/rulings-2026-09-14.md` §4.13 S-1；`40-modules/15-server-architecture-review.md` §3.2；`40-modules/08-server-identity-documents-and-storage.md`。
