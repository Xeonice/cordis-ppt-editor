> 状态：草稿 | 负责：产品 | 更新：2026-09-21；2026-09-24（rulings §4.15：T-0 单组织去租户——SV-06/07/08/09/11/14 删租户；Q6 OIDC + 可选 Casdoor、`auth.selfSignup`、文档级 RLS、组管理推迟、JWT/API Key 降 M4；Q5 两层口径与超包络拒绝导入、名额按用户、按权重准入、部署配置完全可调；S-3a 两级 ack；Q8 缩略图与 PDF 时点、独立 renderer sidecar；Q10 自托管洁净栈 Valkey/SeaweedFS、M3 出口；Q3 墓碑 TTL 与擦除）；2026-09-24（rulings §4.16：Q17 保留默认值全部进入部署配置可调、Q19 服务端字体包与自有授权字体目录标已裁决）；2026-09-24（复核修正，rulings §4.17） | 依赖：charter v0.2；rulings §4.15、§4.16

# 功能域 06：服务端能力与运维

> 需求编号前缀 `SV-`。服务端 = `apps/server`（NestJS 11 传输壳）+ `server-collab`/`server-storage`/`server-headless`（业务逻辑，章程 D8、R4）。本文定义服务端对外提供的产品能力（导入导出、快照、缩略图、审计、配额）与运维/管理员的需求；模块划分、存储结构、部署拓扑由架构 08 与 ADR-0022/0023 决定。

---

## 0. 本域的产品立场

1. **服务端与客户端跑同一份模型/格式代码**（章程 §2.2）：导入、导出、校验、迁移在 `server-headless` 的 cordis 宿主中用 `iso` 插件完成，不存在「服务端另一套解析器」。
2. **服务端是权限与持久化的最终裁决者**：客户端体验优先，服务端安全兜底（D12）。
3. **可运维即产品能力**：健康检查、指标、审计、配额、备份恢复是 M3 验收项，不是「上线后再补」。
4. **单体起步、可水平扩展**：M3 交付自托管 docker-compose 洁净栈（Q10），同一镜像按 `CORDEX_ROLE`（`all`/`api`/`collab`/`worker`/`renderer`）运行；协同网关从第一天支持多实例（Valkey pub/sub，Redis 协议兼容），不做架构返工。M1–M5 只交付集成方/自有部署，**不自营 SaaS**。
5. **单组织**（rulings §4.15 T-0）：一次部署 = 一个组织；数据模型、API、权限中没有租户（tenant）概念。将来若做 SaaS 另立项，以迁移加回。

---

## 1. 能力总览

```
                    ┌──────────────────────────── apps/server (NestJS 11) ────────────────────────────┐
  集成方/前端 ────► │ Auth │ Documents │ Collab Gateway │ ImportExport │ Snapshots │ Thumbnails │ Audit │
                    └──┬────────┬────────────┬──────────────┬────────────┬────────────┬──────────┬────┘
                       │        │            │              │            │            │          │
                     OIDC    Postgres 18 server-collab   server-headless  server-collab  renderer      Postgres
                   (外置 IdP  (元数据+   (房间/广播/    (cordis 宿主:    (update 追加/  sidecar       (审计表)
                   /可选     RLS)       update 持久化)  iso 插件)       快照压缩)     (headless
                   Casdoor)                                                            Chromium,零出站)
                                              │              │
                                  Valkey（Redis 协议）   server-storage（S3 兼容：默认 SeaweedFS / 本地）
                                  (pub/sub, presence,
                                   S-3 一级溢写)
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
  - 输入限制与客户端一致（OF-24）；文档规模超出系统天花板（页数 / 单页元素 / 文档总元素，SV-08）时**直接拒绝导入**，返回 `format.quota_exceeded{dimension, limit, actual}` 并指明超出哪一项，不做只读降级打开（rulings §4.15 Q5）。上限取自部署配置。
  - 失败：类型化错误码（与客户端同一张表）；保留失败样本（可配置、脱敏路径）用于排障。
  - 病毒扫描钩子（P2）：导入前调用集成方扫描回调，拒绝即失败。

### SV-02 文档导出（服务端）

- 优先级：P0 | 目标里程碑：M3 | 依赖能力：`server-headless`、`FormatCodec` 导出、`RenderTarget`（headless Chromium 中的 `render-dom`）、导出专用 `core.format`（`canImport:false`）
- 验收标准：
  - 导出 pptx：从最新快照（或指定版本）+ 基线包生成；与客户端导出**字节级一致**（同一代码路径，CI 断言同一 Snapshot 在浏览器与 Node 导出的规范化结果相同；`docProps/thumbnail.jpeg` 是 `encode()` 的显式输入、缺省保留原部件，因此不破坏确定性，OF 矩阵 §2.1）；D50 ≤ 3 s、D200 ≤ 12 s（p95）。
  - 导出 PDF（**M3 后半段**，rulings §4.15 Q8；引擎见 PD-16）：与缩略图共用独立 renderer sidecar 与 `/render?mode=print`，走独立的 `render-export` 队列（优先级：首页缩略图 > PDF > 批量缩略图）；headless Chromium 打印全部/选定页，A4/16:9 原始尺寸，嵌入字体子集；动画按「静态全部可见」；与 oracle PDF 逐页 SSIM ≥ 0.85；D50 ≤ 10 s（p95）。
  - 导出 PNG/JPEG（server-png，M3）：按页，宽度 1280/1920/3840；D200 全量 ≤ 90 s。
  - 导出为异步作业（同 SV-01），结果为预签名下载 URL（有效期可配，默认 1 h）。
  - 字体：服务端默认字体包内置 Noto（含 CJK）+ Liberation + Carlito/Caladea，均开源，不内置商业字体（章程 Q19 已裁决，rulings §4.16；随 renderer 镜像发布）；**部署方可挂载自有授权字体目录**（只读卷挂入 renderer，与内置包合并解析）；受限内嵌字体按 OF-17 只用于只读渲染（PDF/缩略图可用）；缺失字体按 OF-05 回退并在导出报告中列出。
  - 插件贡献的导出专用 `core.format`（`canImport:false`，如 Markdown）在服务端同样可用（PS-14）。

### SV-03 快照与 update 持久化

- 优先级：P0 | 目标里程碑：M3 | 依赖能力：`server-collab`（update 追加、快照压缩）、ADR-0022 存储、`Snapshot`、`migrations`
- 用户故事：作为管理员，我希望任何时刻服务器宕机都不会丢失用户已同步的编辑，并且历史版本可追溯。
- 验收标准：
  - 每条被服务端接受的 CRDT update 在返回 ack 前持久化（追加表/日志）；RPO ≤ 1 s（已 ack 的 update 不丢）。Postgres 故障溢写期采用**两级 ack**（rulings §4.15 S-3a，见 SV-05）：只有 `ack{seq, tier:'db'}` 才表示已落库并允许客户端清除 pending。
  - 软删除墓碑（rulings §4.15 Q3）：服务端作为单写者，在墓碑 TTL（默认 24 h，部署可配）到期后执行硬删除（普通事务，origin=`system`）；文档擦除（SV-11）与经审计的「立即彻底删除」不等 TTL。
  - 压缩（Compaction）：按策略（章程 Q17 默认，部署配置可调：每 500 个 update 或 10 分钟）把 update 折叠为新的快照并保留 update 尾巴用于重连；压缩 10,000 update ≤ 2 s。
  - 版本（CO-07）与保留（章程 Q17 已裁决，rulings §4.16：默认值不变，**全部进入部署配置可调**）：自动版本 = 压缩点的快照 + 元数据（贡献者集合、时间），保留 30 天；命名版本 = 用户触发的快照，永久；update 追加表保留 7 天（压缩后）；导入原件保留 30 天；元素墓碑 TTL 24 h；以上均为部署配置默认值；过期清理为后台作业。不透明保留所需的部件 Blob 随文档生命周期保留，不在此列。
  - 新客户端加入：下发最新快照 + 尾巴 update；D50 初始同步 ≤ 2 s、D200 ≤ 5 s（p75）。
  - 迁移：服务端启动时对旧 `schemaVersion` 的快照惰性迁移（读取时），并可运行「全量迁移」作业；迁移失败的文档标记并告警，不影响其它文档。
  - 一致性：多实例场景下同一文档的 update 顺序由 CRDT 保证，持久化只需「至少一次」；重复 update 幂等。

### SV-04 缩略图服务

- 优先级：P0 | 目标里程碑：M2（过渡封面）/ M3 前半段（权威缩略图，章程 Q8，rulings §4.15） | 依赖能力：`server-headless` 的 headless Chromium 适配（ADR-0026 已接受）、独立 renderer sidecar（SV-09）、`RenderTarget('dom')`（与客户端同一份渲染代码）
- 验收标准：
  - **M2 过渡封面**：导入或保存时取包内 `docProps/thumbnail.jpeg` 作为文档卡片封面；服务端**不解码**，只做 JPEG 头校验（SOI/SOF 中的尺寸不超过 OF-24 像素上限，体积 ≤ 1 MB），原字节以 `image/jpeg` + `nosniff` + CSP `sandbox` 头下发，标记 `source=embedded`；包内没有时显示占位。已知限制：M2 编辑后封面会过时（同一设备用本地 dom-scaled 缓存覆盖）；该来源纳入 SV-11 purge。导入完成即有过渡封面（NF-01）。
  - **M3 权威缩略图**：headless Chromium 运行与客户端同一份渲染代码；导入完成后首页高优先生成 ≤ 10 s，其余页按需惰性生成；全量 D200 ≤ 90 s（统一预算）。
  - 规格：只存一档——卡片 640 px WebP（在沙箱内直接输出，不用 sharp/libvips）；分享预览与版本预览按需生成 1280 px。
  - 失效：按**页内容哈希**失效，哈希输入 = 页子树 + 版式/母版/主题依赖闭包 + 媒体 `BlobRef` + `slideSize` + 页序号 + 内嵌字体集合 + `layoutAlgoVersion` + `fontProfile`；外链资源一律占位、不计入哈希；Compaction 之后只把哈希变化的页入队。
  - 并发与隔离：在独立 renderer sidecar 中执行（安全要求见 SV-09）；每个任务新建 BrowserContext，定期回收浏览器；单页超时 10 s，失败重试 1 次后返回占位图并上报。并发口径与 ADR-0026 一致。
  - 不再有「客户端上传缩略图」路径（rulings §4.15 Q8）；客户端侧栏缩略图见 OF-15。

### SV-05 协同网关

- 优先级：P0 | 目标里程碑：M3 | 依赖能力：`server-collab`（房间、awareness 广播、跨实例 pub/sub）、`protocol`（WS 帧、握手）、Valkey（Redis 协议兼容）
- 验收标准：
  - 房间生命周期：首个连接创建、最后一个连接离开后延迟 60 s 销毁（期间保留内存状态以应对快速重连）；房间状态可查询（管理 API）。
  - 握手：令牌校验（EM-03）、文档能力位加载、容量检查（20 编辑者 + 50 查看者，名额按用户计、owner 不占编辑者名额、commenter 计查看者，CO-01；超限只读加入，再超 → `collab.room_full`，关闭码 4503）、协议版本协商（不兼容 → `collab/auth-failed{code: collab.protocol_mismatch}`，关闭码 4427）。
  - 门禁：硬门禁（应用前）与软门禁（应用后，ADR-0034：`softGate.mode = repair`、`schemaMode = report-only`）的行为与用户可见结果见 CO-12。
  - 权限即时性：权限变更事件（来自 Documents 模块；M4 起也可来自集成方回调）在 ≤ 2 s 内推送到房间内该用户的所有连接，降级为只读或断开。
  - 消息限制：单消息 ≤ 1 MB；速率 ≤ 200 msg/s/连接；awareness 广播节流 ≥ 50 ms；超限限流并记录。
  - 多实例：同一文档的连接可落在不同实例，通过 Valkey（Redis 协议）pub/sub 转发 update 与 awareness；跨实例传播 ≤ 50 ms（同机房）。
  - 房间准入（rulings §4.15 Q5）：按文档**实测权重**准入（Y 结构数或堆估算，乘以 ADR-0035 的副本数），不再用固定 MB/房间；实测基线 D200 ≈ 85 MB、D50 ≈ 17.8 MB（墓碑计入）。满员房间由服务端合并 awareness tick，查看者只上报视图。
  - 容量（collab 单实例 2 vCPU / 4 GB，RM-S）：≥ 2,000 并发 WS；活跃房间数按文档规模分档、按文档实测权重准入（见上条；各档房间数 M1 实测后回填，只收紧；原「RSS > 75% 时新房间转其它实例」口径作废，rulings §4.15 Q5）；p95 广播延迟 ≤ 100 ms、CPU < 70%。
  - 优雅停机：收到 SIGTERM 后停止接受新连接、通知客户端重连（`collab/reconnect{reason:"server-shutdown"}`）、flush 持久化、≤ 30 s 退出；客户端在 ≤ 5 s 内重连到其它实例。
  - Postgres 持续故障韧性（rulings §4.13 S-3，§4.15 S-3a 细化）：已在线房间**不拒绝新编辑**——超过第一阈值溢写 Valkey，超过第二阈值分块落对象存储（BlobStore）；两级阈值与回放耗时预算见架构 08 §12、NF-01 §1.7、NF-03。
  - **两级 ack**（S-3a）：溢写成功回 `ack{tier:'spill'}`，客户端**保留 pending**；落库成功回 `ack{seq, tier:'db'}` 才清除 pending。正式 `seq` 在回放时由 Postgres 分配；溢写行按 `(instanceId, localCounter)` 排序回放；回放 bootstrap 之后断言无 `pendingStructs`。即使溢写数据丢失，客户端也能在重连 step2 凭 update 幂等性自动补齐，NF-03「已 ack 零丢失」以 `tier:'db'` 为口径。

### SV-06 鉴权与权限

- 优先级：P0 | 目标里程碑：M3（OIDC、按人分享）/ M4（集成方签名 JWT、API Key） | 依赖能力：`apps/server` Auth 模块、`protocol` 权限模型（能力位，无 `enum`，规避 Univer A3）
- 验收标准（rulings §4.15 T-0 / Q6）：
  - 单组织：一次部署 = 一个组织；资源、API、权限中**没有租户**（无 `tenantId`、无租户解析、无租户角色、无跨租户访问语义）；部署级配置（配额、保留策略、字体目录、存储桶）即全局配置。将来若做 SaaS 另立项。
  - 身份：服务端 M1–M3 **只认 OIDC**（授权码 + PKCE，用于 `apps/web`；JWKS 轮换支持），不持有密码与凭据；可接任意 OIDC IdP，docker-compose 可选内置 **Casdoor**（国内 IM 登录经 Casdoor 代理）；用户以 `(issuer, sub)` 标识，首次登录 JIT 建号。
  - 注册策略：部署级开关 `auth.selfSignup`，**默认关**——由管理员在 IdP（如 Casdoor）建号；开启后在 IdP 自助注册、首次登录 JIT 建号。分享链接始终要求登录（S-1，不支持匿名）。
  - 文档分享邀请**只对已存在账号生效**（rulings §4.17 D1）：邀请即直接授予权限；服务端不保存「待接受邀请」（无 `pending_invitations` 表），没有账号的邮箱返回错误并提示联系管理员（`auth.selfSignup` 开时提示对方先注册），文案见设计 08。
  - 文档权限：角色 → 能力位（CO §1）；权限主体为**用户**与**分享链接**（M3 只按人分享）；管理 API：授予/撤销/列出；分享链接（P1，参考应用）：可设角色与过期。
  - **组管理（U-11）推迟**，不在 M3 范围；按组授予权限随之推迟。
  - 数据访问兜底：应用层文档权限检查（章程 D12）+ **文档级 Postgres RLS**（M3 出口，安全测试覆盖「绕过应用层直接查询越权文档被 RLS 拒绝」）。
  - fail-closed：未知能力位、缺 claim、过期令牌一律拒绝；权限检查覆盖 REST 与 WS 两处（架构 05/08）。
  - CI 分层认证：PR 跑 Casdoor 容器 + oidc-provider mock；nightly 跑 Keycloak / Entra ID / 飞书等外部 IdP 兼容。
  - **M4**：集成方签名 JWT（嵌入场景）与 API Key（scoped、可轮换，用于集成方后端调用导入/导出/管理 API）；首次出现的主体 JIT 建影子用户。

### SV-07 审计

- 优先级：P0 | 目标里程碑：M3 | 依赖能力：`commands` 管线 `waterfall` 审计检查点（章程 D12/K1）、Audit 模块
- 用户故事：作为管理员，我需要回答「谁在什么时候对哪个文档做了什么」，以满足合规与排查。
- 验收标准：
  - 事件类别：访问（打开/加入房间/导出/下载）、编辑（`Transaction` 摘要：命令 id、影响页与元素数，不含内容）、评论（增删改解决）、权限（授予/撤销/变更）、版本（创建/恢复）、管理（删除/配额变更）、安全（鉴权失败、限流、越权尝试、硬门禁拒绝 `collab.update_rejected`、软门禁修复 `collab.repaired`，ADR-0034）。
  - 每条：时间（服务端）、文档、主体（用户 id；M4 起含 API key id）、来源 IP（可配置脱敏）、客户端版本、结果。
  - 保留：默认 365 天（可配）；导出 CSV/JSON（按文档、主体、时间范围、类别）；不可篡改（追加写 + 哈希链 `prevHash`/`hash`，**P1，M3 即实现**，含校验工具与每日封存作业，rulings §4.12 U-15）；数据库角色隔离照旧（无 UPDATE/DELETE）。
  - 编辑审计吞吐：每文档 ≤ 50 事务/s 时无背压；超出时按事务合并（每用户每秒一条汇总）。

### SV-08 配额与限制

- 优先级：P0 | 目标里程碑：M3 | 依赖能力：部署配置、网关容量检查（按权重准入）、导入限制
- 两层口径（rulings §4.15 Q5）：
  - **性能保证包络**：D200（200 页 × 平均 30 ≈ 6,000 元素）、DX-1000 单页 1,000 元素、20 编辑者 + 50 查看者、200 MB。NF-01 性能门禁只在包络内成立，只收紧不放宽。
  - **系统天花板**：200 页（软警告 150）/ 单页 1,000 元素 / **文档总元素 20,000**（软警告 15,000，软删除墓碑计入）；服务端房间按文档实测权重准入（SV-05）。
  - **超包络导入直接拒绝**（`format.quota_exceeded{dimension, limit, actual}`），不做只读降级打开。
  - 所有规模数字**由部署配置完全可调**（无租户层）；调到包络之外时启动告警并在 `/readyz` 中标记，性能承诺不再成立。
  - 数字按对标定稿（暂无客户数据），M1 中期以 T3 语料实测后只收紧。
- 验收标准（默认值，部署级可调；PD-17）。`dimension` 取值照抄架构 10 §3「配额三码并列与 `dimension` 取值表」（rulings §4.17 D2）：导入 `format.quota_exceeded` 与编辑期 `document.quota_exceeded` 用 `slides` / `elementsPerSlide` / `elementsTotal`（导入另有 `fileSize`），存储 `storage.quota_exceeded` 用 `bytes` / `documents`：

| 维度 | 默认上限 | 超限行为 |
|---|---|---|
| 单文件大小（含媒体） | 200 MB（Q5 包络） | 导入拒绝 `format.quota_exceeded{dimension:"fileSize"}`（413） |
| 单文档页数 | 200（Q5）；软警告 150 | 导入超限拒绝（`format.quota_exceeded{dimension:"slides"}`）；编辑中超软警告提示，超硬上限拒绝新增页（`document.quota_exceeded{dimension:"slides"}`，409） |
| 单页元素数 | 1,000（Q5） | 导入超限拒绝（`dimension:"elementsPerSlide"`）；编辑中拒绝新增元素并提示（`document.quota_exceeded{dimension:"elementsPerSlide"}`） |
| 文档总元素数（含墓碑） | 20,000（Q5）；软警告 15,000 | 导入超限拒绝（`format.quota_exceeded{dimension:"elementsTotal"}`）；编辑中超软警告提示，超硬上限拒绝新增（`document.quota_exceeded{dimension:"elementsTotal"}`） |
| 每文档并发编辑者（按用户计） | 20（Q5） | 新加入者只读；owner 不占名额 |
| 每文档并发查看者（按用户计，含 commenter） | 50（Q5） | 拒绝加入 `collab.room_full`（503 / 4503） |
| 评论线程 / 文档 | 5,000 | 拒绝新增 |
| 版本数 / 文档（命名） | 200 | 提示删除旧版本 |
| 部署总存储 | 由部署方设置 | 导入/插入媒体拒绝（`storage.quota_exceeded{dimension:"bytes"}`） |
| 单用户存储（P1） | 由部署方设置，默认不限 | 同上 |
| 每用户文档数（P1） | 由部署方设置，默认不限 | 新建/导入拒绝（`storage.quota_exceeded{dimension:"documents"}`） |
| 导入/导出作业速率 | 60/分钟/用户 | 429 + `Retry-After` |
| REST API 速率 | 600/分钟/用户（M4 起另有每 API key） | 429 |
| WS 消息速率 | 200/s/连接 | 限流 + 计数 |
| 资源上传单文件 | 100 MB | 拒绝 |

  - 所有配额有读取点（规避 Univer A26，`scan-config-usage` 覆盖）与测试；配额用量可查询（管理 API 与管理面板）。错误码以架构 10 为准。

### SV-09 部署与运维

- 优先级：P0 | 目标里程碑：M3 | 依赖能力：`apps/server` 配置 schema、健康探针、迁移脚本、ADR-0022
- 验收标准：
  - 部署形态（rulings §4.15 Q10，自托管洁净栈）：docker-compose 一条命令启动；M1–M5 只面向集成方/自有部署，不自营 SaaS。组件：同一应用镜像按 `CORDEX_ROLE`（`all`/`api`/`collab`/`worker`/`renderer`）运行 + **Postgres 18** + **Valkey**（Redis 协议兼容）+ **SeaweedFS**（S3 兼容，替换 MinIO：上游归档、镜像下架、AGPL）+ 独立 **renderer** sidecar + 可选 **Casdoor**（IdP profile；未启用时接外部 OIDC IdP）。compose 全家桶的主机规格另立（ADR-0037），与 RM-S（collab 单实例口径）分开。M3 的实例已无状态（除内存房间缓存）。
  - renderer sidecar 安全要求（rulings §4.15 Q8，作为 NF-04/SV-12 M3 出口的自动化安全测试）：非 root；`chromiumSandbox=true` 并加载 seccomp；**零出站**——state、`/render` 静态包、字体都经注入/内置提供，只接受 worker 的鉴权内部 RPC 入站，不暴露无鉴权的 Playwright run-server；不挂任何凭据；每任务新建 BrowserContext、定期回收；用 `--shm-size` 而非 `--ipc=host`；自建镜像，每周跟随 Chrome 稳定版重建，与 worker 锁步发布。自带 Nest 的集成方（EM-10 b）保留本地 launch 模式。
  - 镜像许可（章程 D13 对镜像按主组件许可白名单解释）：默认 compose 不含 AGPL 组件；Grafana/Loki 等 AGPL 组件只作为显式开启的可选 profile。
  - **M3 出口**：断网（air-gapped）compose e2e 通过；所有镜像以 digest 钉死；随发布提供 SBOM；镜像许可门禁通过。
  - **M4 P1**：离线安装包、多架构镜像（amd64/arm64）、K8s Helm chart。
  - 配置：全部环境变量经 Standard Schema 校验，启动失败即打印字段路径；密钥仅从环境/密钥管理器读取；`--dry-run` 校验配置。
  - 探针：`/healthz`（进程存活）、`/readyz`（DB/Valkey/Blob 可达 + 迁移已应用；规模配置超出 Q5 包络时附标记）；就绪前不接流量。
  - 数据库迁移：版本化、幂等、可回滚一步；启动时检查未应用迁移并（可选）自动应用。
  - 备份/恢复：文档基线包与 blob 在对象存储（依赖其版本化/复制；SeaweedFS 的 `snapshots/` 版本化必须开启，不可选）；Postgres 定时逻辑备份 + WAL（RPO ≤ 1 min、RTO ≤ 15 min 的操作手册）；演练脚本可从备份恢复整个部署（或指定文档）并通过导出校验。更换对象存储 Provider 后，S-2 purge、S-3 二级溢写、导入原件与缩略图须重跑 `runBlobStoreConformance`。
  - 零停机发布：滚动更新 + 优雅停机（SV-05）；协议版本向后兼容一个次版本。
  - 日志：结构化 JSON，含 `requestId`/`documentId`/`userId`（可脱敏）；级别可调；不记录文档内容。
  - 运维手册：容量规划（每 1,000 并发编辑者所需实例）、常见故障（Valkey 断连、renderer/Chromium 僵尸进程、磁盘满）、升级步骤。

### SV-10 监控与告警

- 优先级：P0 | 目标里程碑：M3 | 依赖能力：`telemetry` 服务（服务端 Provider：Prometheus/OTel）、`logger`
- 验收标准：
  - 指标（Prometheus 命名草案）：`cordex_ws_connections`、`cordex_rooms_active`、`cordex_update_apply_seconds`（直方图）、`cordex_broadcast_latency_seconds`、`cordex_import_duration_seconds`、`cordex_export_duration_seconds`、`cordex_thumbnail_duration_seconds`、`cordex_job_queue_depth`、`cordex_persist_lag_seconds`、`cordex_auth_failures_total`、`cordex_rate_limited_total`、`cordex_collab_soft_conflicts_total{type}`、`cordex_collab_updates_rejected_total{reason}`、`cordex_collab_repairs_total{rule}`、`cordex_permission_denied_total{action}`、`cordex_plugin_failures_total`、进程/DB/Valkey 标准指标（命名与架构 10 §11.3 一致）。
  - SLO（初始）：协同服务可用性 99.9%/月；广播延迟 p95 ≤ 100 ms；导入成功率 ≥ 99.5%；导出成功率 ≥ 99.5%；持久化滞后 p99 ≤ 1 s。
  - 告警（默认规则随 compose 提供）：就绪探针失败 > 1 min；p95 广播延迟 > 300 ms 持续 5 min；队列深度 > 100 持续 5 min；鉴权失败突增（> 10× 基线）；磁盘 > 85%；Chromium 池耗尽。
  - 观测栈（Q10）：compose 默认 OTel Collector + Jaeger + Prometheus，默认告警规则随 compose 提供；仪表盘模板（Grafana JSON：总览、协同、作业、安全）随可选 Grafana/Loki profile 提供（AGPL，需显式开启）。
  - 追踪：导入/导出/握手链路 OTel trace（采样可配）。

### SV-11 数据保留、删除与合规

- 优先级：P1 | 目标里程碑：M3 | 依赖能力：Documents 模块、后台作业
- 验收标准：文档软删除（默认 30 天可恢复）→ 硬删除（快照、update、版本、评论、缩略图（含 M2 包内过渡封面）、blob、索引全部清除，审计保留）；文档擦除立即硬删除，**不等**元素墓碑 TTL（CO-08）；用户数据擦除 API（GDPR：用 `deleted-user` 替换主体标识，评论正文按部署策略保留/删除）；数据驻留：存储与数据库位置由部署决定，SDK 无隐式跨区调用；导出部署全部数据（P2）。保留期（软删除宽限、自动快照 30 天、update 7 天、导入原件 30 天、墓碑 TTL 24 h）均为部署配置默认值，全部可调（章程 Q17，rulings §4.16）。
  - 级联清单（编排式，rulings §4.13 S-2）：`documents` 宽限期满后发起 `schedule-purge`；`permissions`、`media`、`thumbnails`、`comments`、`document_updates`/`document_snapshots`（server-collab）各自执行 purge 用例清理自己的表，谁的表谁写；失败可重试、可审计；GDPR 擦除复用同一编排，仅把"清除"换成"用 `deleted-user` 替换主体标识"。

### SV-12 服务端安全

- 优先级：P0 | 目标里程碑：M3 | 依赖能力：OF-24 输入限制、`protocol` schema、Nest 守卫
- 验收标准：全部输入 schema 校验（REST/WS/文件）；zip 与 XML 限制同客户端；WS Origin 校验与令牌绑定；CSRF 对 cookie 会话防护；速率限制（SV-08）；TLS 终止在代理层，内部可选 mTLS；密钥轮换不停机；依赖漏洞门禁（高危阻断）；渗透测试清单（OWASP ASVS L2）作为 M3 出口条件之一；安全事件进入审计。

### SV-13 Headless 自动化 API

- 优先级：P1 | 目标里程碑：M3 | 依赖能力：`server-headless`、`commands`（模板填充命令）、作业队列
- 用户故事：作为集成方后端，我希望调用 API 把模板中的占位符批量替换为业务数据并导出 pptx/PDF。
- 验收标准：作业类型：`fill-template`（按占位符类型/名称替换文本/图片/表格数据）、`convert`（pptx → pdf/png/markdown）、`validate`（结构校验 + 保真诊断报告）、`migrate`（快照迁移）；四种作业类型**归属统一为 `import-export` 模块**，不新设独立模块，具体 usecase/队列/REST 细节 M4 一起定（rulings §4.12 U-13）；幂等键；批量 100 份 D50 填充 + 导出 ≤ 60 s（4 worker）；结果回调（webhook，签名，P1）。

### SV-14 管理面板（参考应用）

- 优先级：P2 | 目标里程碑：M4 | 依赖能力：`apps/web` 管理路由（组装层）
- 验收标准：部署配额（规模配置）与用量、用户管理（停用；`auth.selfSignup` 关闭时跳转 IdP 建号入口——账号在 IdP 创建，本系统不保存待接受邀请，rulings §4.17 D1）、房间列表与强制断开、作业队列、审计查询、插件清单（服务端加载的 `iso` 插件及版本）、健康状态。

### SV-15 Webhook 与事件出口

- 优先级：P1（**由 P2/M4 提前，rulings §4.12 U-14**） | 目标里程碑：M3 | 依赖能力：Comments/Documents/Audit 模块事件、新增 `webhooks` 模块（`40-modules/12` §2.1/§4.11）
- 用户故事：作为无常驻前端的集成方后端，我希望通过 Webhook 而非事件回调接收评论等协同事件，以便离线处理通知与审批流程。
- 验收标准：
  - **M3 范围**（与客户端 EM-05 事件回调并行，两者都做，CO-04）：评论事件（`comment/added`、`comment/mentioned`、`comment/resolved`）以签名 Webhook 推送；管理 API：注册/更新/删除订阅（目标 URL、事件过滤、状态）；投递采用 HMAC 签名 + 指数退避重试 + 死信队列（超限转死信，不再自动重试）；投递日志可查询；服务端另提供跨文档「@我」REST（无需 `docId`）。
  - 事件 schema 版本化；订阅明文签名密钥仅在创建响应出现一次，落库只存 hash。
  - 出站 SSRF 防护（rulings §4.13 S-4）：默认严格拒绝私网（RFC1918）/回环/链路本地（含云元数据端点 `169.254.169.254`）目标；订阅创建/更新与每次实际投递前均解析主机名并校验，投递前锁定解析出的 IP 再建连以防 DNS 重绑定；提供部署级配置项放宽为显式白名单（面向自托管内网场景）。
  - **M4 展望**：文档事件（创建/更新/删除/导出完成/权限）以同一 Webhook 机制推送，扩大事件覆盖面；重试退避 ≤ 24 h。

---

## 3. 运维 / 管理员用户故事汇总

| 编号 | 故事 | 对应需求 |
|---|---|---|
| US-O-01 | 我要一条命令把整套服务在测试环境跑起来 | SV-09 |
| US-O-02 | 我要知道现在有多少人在协同、延迟多少 | SV-10 |
| US-O-03 | 服务器重启后不能丢用户已同步的编辑 | SV-03 |
| US-O-04 | 我要把部署存储限制在 50 GB、每文档 200 页 / 20,000 元素 | SV-08 |
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
