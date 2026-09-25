# 矛盾收口计划（2026-09-25）

> 来源：5 个簇复核后的 121 条（FE 21、BE 36、CO 20、UX 20、GV 24）+ 原始清单 contradictions-raw.json（120 项，除 #91 状态报告外均已被某条覆盖）。本文件只读产出，未改仓库。

## 概览

| 类别 | 数量 | 说明 |
|---|---|---|
| 决策（交互问答） | 15 | 分 4 轮，每轮 ≤4 题，按影响排序，安全类优先 |
| 默认值（一次性确认） | 23 | 正文空白，给一句话默认值 |
| 机械修正 | 67 | 有权威可判，按权威改即可 |
| 剔除 | 17 | 跨簇合并 7、resolved 5、not-an-issue 5（含 raw #91）|

## 去重与改判说明

- **跨簇合并**：FE-03→BE-04；FE-10→BE-04（改名写入其选项影响）；CO-04→UX-03；BE-17→CO-08；BE-33→CO-09；BE-34→GV-16；BE-32 拆入 CO-19（Provider 名）与 GV-20（套件名）。
- **改判**：CO-04 原判 mechanical，但已接受的 ADR-0029:93 用「30 s」、架构 06 正文用「6 次」，没有干净权威，随 UX-03 作为决策。BE-15 原判 gap（impact high），因涉及删除/隐私且新增处理器、参与者登记与房间拦截，升级为决策。
- **依赖关系**：若干机械项的部分内容取决于决策结果（见机械清单「依赖」列）；独立的机械项可立即执行，GV-07（行数重算）放在最后。

## 一、交互问答（决策）

### 第 1 轮 服务端鉴权与部署拓扑（安全类优先）

#### Q1 BE-01 · IdP与存储入口（影响 high）

ADR-0037 把 Casdoor 与 SeaweedFS 都放在 internal 的 backend 网络、edge 只放行 api/collab，但 OIDC 授权码流程要浏览器直接打开 IdP 登录页，预签名直传与直读也要浏览器直连 S3 端点，默认 compose 下两者都到不了；浏览器应经什么入口访问 IdP 与对象存储？

| 选项 | 影响 |
|---|---|
| **反代子域暴露（推荐）** | 反代新增 idp.&lt;域名> 转 Casdoor、s3.&lt;域名> 转 SeaweedFS S3 网关（保持 Host 头），两者仍只在 backend 网络、不开宿主端口；issuer 用对外 URL，预签名改用新配置 storage.s3.publicEndpoint 生成，服务端自身读写走内网 endpoint。影响：改 ADR-0037 决策 3/4 与图 1、ADR-0029 修订 §2、08 §2/§6/§10.1 与 compose；TLS 多两个域名；SeaweedFS 桶配 CORS（允许 PUT/GET、暴露 ETag）；apps/web 的 CSP 与「只含同源」e2e 断言加入存储源；runBlobStoreConformance 增「经保持 Host 的反代后预签名仍可用」；Casdoor 管理后台建议按来源 IP 限制。预签名设计不变，与 PRD SV-01 一致。 |
| **存储走Nest代理** | 只暴露 Casdoor；对象存储上传下载全部经 api 流式代理：每请求鉴权、撤权立即生效、没有 1 h 预签名 URL 外泄、CSP 保持同源。影响：改 08 §6/§16.4、40-modules/08 presign 用例与 BlobStore 契约、11 的取字节路径；与 PRD SV-01「预签名直传」和 ADR-0022:44 的取舍理由相悖，须改 PRD；200 MB 导入与全部媒体流量压在 api 进程上。 |
| **同域子路径暴露** | /idp/* 与 /s3/* 挂在主域名下，不需额外 DNS 与证书。但 Casdoor 子路径部署支持差，S3 SigV4 把 Host 与路径算进签名，经路径改写容易失效，不推荐。 |

- 推荐理由：同一条预签名代码路径同时适用 compose 默认栈、客户自有 S3 与外部 IdP，只多两条反代规则，Casdoor/SeaweedFS 仍不开宿主端口，也不必改 PRD SV-01。
- 关联：BE-11（/api/v1 前缀与反代分流规则一起写）

#### Q2 BE-02 · 分享链接角色（影响 high）

权限模块要调分享链接的解析用例、分享链接模块又 import 权限模块，Nest 依赖成环（文档却称无环）；且 WS 会话在他人改权限触发重算时手里没有分享令牌，只凭链接加入的人会被误降为 none 踢出、链接到期也不触发重算；链接角色应怎样在 REST 与 WS 两侧流转？

| 选项 | 影响 |
|---|---|
| **角色随主体携带（推荐）** | 按 ADR-0029:103 原意，ShareLinkGuard 解析令牌后把 {docId, role, linkId, expiresAt} 写进 Principal.scopes；RoleResolverService 只合并直接授权与 scopes，不再依赖 ShareLinks，环消失，可用 depcruise no-circular 守护；RlsContext 据 scopes 设 app.share_doc_id。ShareLinksModule 导出 ShareLinkGuard 与只读 ShareLinkStatusQuery；票据新增可选 claim lnk（sid 保持登录会话 id 含义）；CollabModule import ShareLinksModule，AuthzSource 重算取 max(直接授权, 有效链接角色)，会话记录 linkExpiresAt 到期主动降权；RoleResolver 5 s 缓存只缓存直接授权。影响：40-modules/08 §1.2/§3/§5.5/§5.6/§7、ADR-0029 决策 1、40-modules/09 AuthzSource；补测试：他人改权限后链接会话不被踢、撤销 ≤1 s 降权、到期主动降权。 |
| **解析归权限模块** | 把 ResolveShareLinkUseCase（经 SECURITY DEFINER 函数只读 share_links）移进 PermissionsModule 并导出，ShareLinks 只管创建、撤销、列表与守卫。也能消环，但 Permissions 多一条读 share_links 的路径，令牌在守卫与 RoleResolver 两处解析须保持一致；WS 重算缺口仍要另补。 |
| **保留双向引用** | 两边用 forwardRef 互相引用，改动最小；环仍在、Nest 初始化顺序脆弱、无法用 no-circular 机械守护，WS 重算缺口另补。 |
| **合并为一个模块** | ShareLinks 并回 PermissionsModule，无环且最简单；但推翻 rulings §4.13「20 个 Nest 模块保持」与 08 §12 G-6 的职责拆分，ADR-0029:103 的守卫路径也要改。 |

- 推荐理由：ADR-0029:103 本就让 ShareLinkGuard 把链接角色叠加进 Principal.scopes，RoleResolver 不必再调 ShareLinks，环自然消失且可机械守护；同时补上 WS 重算把链接用户误踢的安全缺口。
- 关联：BE-05（守卫顺序，机械项与本推荐一致）、BE-07（CollabModule 是否 import ShareLinksModule）、BE-13

#### Q3 BE-03 · 快照所在角色（影响 high）

09 说快照 REST 在 api/collab 均可挂载，但 collabServer 只在 collab 角色激活、快照恢复又必须在持有 Room 的进程内执行，api 角色取到的是 undefined，InternalModule 委托 collabServer 的 compact/migrate/epoch 管理动作在 api/worker 上同样会失败；快照 REST 与管理动作应放在哪个角色？

| 选项 | 影响 |
|---|---|
| **只挂协同角色（推荐）** | SnapshotsModule 与 AdminController（compact/migrate/epoch）只在 collab（及 all）装配，反代把 /documents/:id/snapshots* 转给 collab；恢复在本实例打开 Room 执行、多副本经 FanoutBus 收敛；评论 REST 留在 api，CommentMirrorObserver 只在 collab 注册；DiagnosticsController 留各角色；forceEpoch 递增后经 Valkey 通知其他持有该 Room 的实例踢会话；启动断言「role=api 不装配 SnapshotsModule 与 AdminController」。不增组件，all 模式行为不变，拆分部署只多一条反代路由（与 BE-11 前缀规则一起写）。影响：09 §3.3/§7.1、12 §3/§7.1、08 §0 角色图、ADR-0037 决策 1/3。 |
| **读写分离两角色** | api 上的快照读取直接查 SnapshotStore（PG/S3）不经 collabServer；恢复与管理动作经内部 RPC 或作业转交 collab/worker。需新增 SnapshotReader 与转交通道，组件和测试变多。 |
| **api也装协同** | api 进程也装配 collabServer（不挂 WS）。实现最省，但 api 会打开 Room，房间权重准入与内存口径失真，不推荐。 |

- 推荐理由：不引入新组件，all 模式行为不变，拆分部署只多一条反代路由；恢复与管理动作天然落在持有 Room 的进程。
- 关联：BE-11（反代前缀）、BE-13（角色矩阵）、BE-36（06 §5.3 怎么读补一句）

#### Q4 BE-04 · 渲染拉取端点（影响 medium）

ADR-0026 把 /internal/render/:token/state 的去留交给 M-09，09:280 定为「local 模式兜底」、12 仍保留该控制器，而 11 作为 /render 页属主已删掉拉取并用 lint 断言零外呼，状态机与查询参数却还留着 fetchingState 与 token；local 模式是否保留凭 token 网络拉取快照的兜底？

| 选项 | 影响 |
|---|---|
| **彻底取消拉取（推荐）** | local 与 remote 两种模式都由编排方（Playwright page.evaluate / sidecar RPC）调用 window.__cordex.inject 注入，页面只一条路径（07:636「同一份代码」）。删 12 的 IssueRenderStateTokenUseCase、RenderStateTokenStore、render-state.controller 与 GET 端点，Thumbnails→Internal 依赖消失；RenderPageQuery.token 改为 renderId 仅作日志关联，RenderPageState 的 fetchingState 改为 awaitingInject（原 FE-10），注入超时改为页面常量；ADR-0026 决策 1 写「已取消」，09:280/:283、12 §1.2/§2.2/§2.6/§3/图 2-4/3-2、11 §2.1/§2.5/§7 同步；两种模式各跑一次「/render 网络请求数为 0」e2e。少一个凭 token 换快照字节的内部接口。 |
| **保留本地兜底** | 维持 09 现写法（ADR 授权下的现行默认）。11 要加回 fetch 分支并放宽零外呼 lint（状态名改中性的 awaitingState）；端点须在全局鉴权下显式 @Public 并只认内网来源，补鉴权与 TTL 测试；ThumbnailsModule 要 import InternalModule。 |

- 推荐理由：local 模式下 Playwright 与编排方同进程，完全可以注入；remote 也是注入，网络拉取没有兜底价值。取消后少一个凭 token 换快照字节的内部接口，「/render 零外呼」可机械验证。不拍板则按 ADR-0026 授权以 09:280「local 兜底」为默认，需回改 11。
- 关联：原 FE-03、FE-10 已并入；FE-09（注入等待超时）、BE-07（Thumbnails→Internal 依赖）

### 第 2 轮 包架构与机械治理

#### Q1 FE-01 · 组合根豁免（影响 high）

铁律 1 与 R3 规定无 bundle 的水平层包不得 import 垂直束包，但 preset-*、apps/web、server-headless 按章程 §5.2 依赖上限本就要 import slide 束，照字面 preset 带不带 bundle 都会被拦、server-headless 也会被拦，而豁免按 compositionRoot 还是按层号判定章程没写；R3 的豁免与服务端的文档类型盲怎么定？

| 选项 | 影响 |
|---|---|
| **豁免组合根并盲化（推荐）** | R3 的 from 侧排除 compositionRoot:true 的包（preset-*、apps/web、apps/server）；cordex.bundle 改为「V-* 必填、preset 选填（preset-slide* 标 slide、preset-doc 标 doc），其余省略」，R4 继续拦 preset-doc→slide 束，apps/web 仍受 R9 白名单约束不能直接 import 束包。server-headless 不再 import model-slide/ooxml-pptx：导入导出经 formats/documentTypes 按 documentType 取 codec，createHeadlessHost 接收 apps/server 已有 preset-server.ts 提供的插件清单，worker_threads 按清单模块路径加载；soft-gate-repair 测试迁到 apps/server 集成测试。M5 新增 doc 时 server-* diff=0（PRD 05:230）。影响：章程 §5.1/§5.2/§5.3 与图 5-1/5-10、02、08、01、03-boundaries、09、ADR-0016、18 的规则与图；import-pptx 由原计划 M5 提前改为文档类型无关命名；补 5 个正负向夹具。 |
| **豁免加服务端白名单** | 组合根豁免与 preset bundle 同上，但 server-headless 保持直接 import slide 束，R3 对它单列白名单。改动最少；M5 新增 doc 必须改 server-headless（按 PRD 05:230 先单独提 PR 并在架构 12 记录），no-doc-type-literals 与 horizontal-tests-use-fixture-only 也要给它开例外。 |
| **L8与LS退出水平层** | 铁律 1 只约束 L0–L7，L8 与 LS 可 import 任意束包；preset 仍须带 bundle 以让 R4 生效。规则最简单，但服务端失去文档类型盲的机械保证，server-headless 与 server-collab 可随意引入 slide 知识。 |

- 推荐理由：判据直接读 compositionRoot 元数据即可机械校验；满足 PRD M5「server-* diff=0」；preset-server.ts 在 09 §2 与 11:964 已负责装配 slide 束，主要是文档对齐已有设计。
- 关联：FE-02（上限列）、FE-21（compositionRoot 字段）、FE-05（apps/web 上限）

#### Q2 CO-12 · 渐进打开模型（影响 high）

大文件打开有三种写法并存：架构 07 §14.2 是 Worker 分批解析、主线程分片追加进 Store，M-02 是一次 store.load 全部完成才发 unit/opened，M-04 是同进程先建索引、页内容按需物化；而 NF-01 要求首页 2.0/3.5 s 内可编辑、全量解析允许到 6/20 s，一次装载达不到门禁；Store 与 Unit 生命周期按哪种渐进模型定？

| 选项 | 影响 |
|---|---|
| **首批装载后台追加（推荐）** | 按架构 07 §14.2：Worker 跑 import-pipeline，先完成包络计数（超天花板整体拒绝，不装到一半才失败），再分批回传；首批 store.load 后立即发 unit/opened（可渲染、可编辑），后续批次以 origin system('import') 追加，不入撤销栈、DirtyTracker 忽略该来源（零编辑导出零脏部件），全部到齐发新事件 unit/loaded；全选、查找替换、导出、跨页重排等全文命令在 loaded 前等待或禁用；配合 CO-11 的 prioritize 消息；协同模式不走此路径（Y 状态由 HTTP 快照 bootstrap）。影响：M-02 units.open 第④⑥步与 DocumentStore 契约新增追加语义及用例、ooxml-core DirtyTracker、M-04 lazy.ts 改为 Worker 内解析顺序与抢占并登记 Worker 入口与分批协议、M-03 全文命令守卫、事件表登记 unit/loaded。 |
| **Store内按需物化** | 按 M-04 lazy.ts：一次 store.load 装入全部页索引与未物化占位，首次访问时以 import 事务物化。Store 会长期含未物化页，导出、校验、搜索、快照、不变量检查都得先强制物化，bodySchema 要容纳占位形态，契约面更大；与架构 07 §14.2 冲突，须同时改写 07。 |

- 推荐理由：与架构 07 §14.2 一致（架构正文优先于 M-02/M-04），Store 契约只多一种 import 追加语义，唯一能满足 NF-01「首页可交互」门禁的方案；门禁按 Q5 只收紧不放宽。
- 关联：CO-11（prioritize 消息与 Worker 归属）

#### Q3 GV-15 · 扫描器名对账（影响 high）

类型治理线（06、08）声明 14 个扫描器是完整清单、每条规范都要在 08 矩阵有执行点，但 ADR、架构正文与模块文档里还写着约 31 个「扫描器 xxx」作为机械保证（含已接受 ADR-0017 的三个），它们在 06/08 里既无定义也无别名映射，属于「声明了但没执行」；这批名字怎么处理？

| 选项 | 影响 |
|---|---|
| **全量对账加校验（推荐）** | 逐个归并：能对应既有机制的（如 provider-runs-conformance→scan-manifest 规则 e、manifest-present→scan-manifest、deprecated-expiry→scan-deprecations）补进 08 §11 对照表并把原文改成正式名；对不上的（shadcn 三件套、theme-vars-contract、i18n-keys-sync、no-doc-type-literals-server、preset 几条）落为既有扫描器子规则、lint 规则或测试断言并补 TD-086 起的行；已作废的（如 repo-requires-tenant-id）删去。docs/_tools 新增文档检查「写成扫描器 `x` 的名字必须能在 06 或 08 §11 查到」，scan-policy 职责与「14 个」上限不变；ADR-0017 只改措辞记变更，14/15 历史稿只加行内标注。约 31 个名字、60 来处引用。 |
| **放开扫描器清单** | 有独立价值的名字直接升为第 15…N 个扫描器；数量膨胀，06 首段与各处「十四个」再改一轮，维护面变大。 |
| **只补对照表** | 只把名字补进 08 §11，不加校验；改动小，但以后新写的名字还会漂移。 |

- 推荐理由：你重视可机械验证：多数名字能映射到既有机制，映射不上的落为子规则，不破「14 个」上限；再加一条文档检查防止继续漂移，与 scan-policy「配置路径存在」检查合成闭环。
- 关联：GV-13（02 §5 旧扫描器名）、GV-17（ADR-0003 扫描器名）

#### Q4 GV-14 · CI job 名（影响 low）

07 与 M-01 规定 CI 只有 13 个 job 名的封闭集合，但 11 测试策略、04 文档模型与 ADR-0003/0008/0009/0016/0017（0017 已接受）各自写了 fidelity-roundtrip、oracle、collab-sim、manifest-check、shadcn-diff 等十来个集合外 job 名，实现者照做会多建一批 job；是按封闭集合收编，还是扩大集合？

| 选项 | 影响 |
|---|---|
| **保持13个并入（推荐）** | 集合外名字全部改写为既有 job 的「步骤」：unit/contract/lifecycle/roundtrip/collab-sim/snapshot-migration-corpus 归 test，types 归 test-typecheck，iso 归 iso-smoke，visual oracle 归 e2e（PR 跑 gated 类别、nightly 全量），manifest-check/schema-lock/horizontal-freeze（M5 起）/shadcn-diff 归 scanners，doc-type-blindness 拆回 depcruise/lint/test。已有 ADR-0004:18、07:103、M-01:643 三次先例；保真失败仍阻断合并，只是要到 test job 日志里看。约改 12 处，ADR-0017 只改措辞，scan-policy 封闭集合不动。 |
| **扩为约17个job** | 新增 fidelity-roundtrip、visual-oracle、collab-sim、shadcn-diff 四个 job，其余并入；M1 核心验收（保真）可单独显示、单独设为必需检查。代价：07 §3、M-01 §5.9、scan-policy 常量与十几处「13 个」都要改。 |
| **实现期再定** | 暂不处理；文档继续漂移，实现者自行判断这些名字是 job 还是步骤。 |

- 推荐理由：已有三次同类先例，也避免把 CI 拆得过细；保真失败仍会阻断合并。
- 关联：GV-17（ADR-0003:47 job 名）

### 第 3 轮 删除语义与故障期协同

#### Q1 CO-07 · 元素彻底删除（影响 high）

「立即彻底删除」在架构 04/06 与 ADR-0020 里是元素级 store 操作，在 M-08/09/12/19 里却是文档级回收站永久删除（走 purgeAll），元素级路径没有 PRD 条目、REST、权限、审计与执行者，而且只删当前 Y 状态时 30 天自动快照、命名快照与 update 表里仍有该内容；元素级彻底删除做到什么程度？

| 选项 | 影响 |
|---|---|
| **墓碑态经审计删（推荐）** | 只对已删除（墓碑态）元素开放、只能由 owner 发起：POST /documents/:id/elements/purge{ids} 经 M-08 鉴权，交 M-09 单写者以 system('maintenance') 立即硬删（复用 tombstone-sweeper 事务，与 M-02:1479 相容），写审计 document.element_purged。只清当前文档状态：历史快照与 update 表按保留期存在，引用的图片原件按 30 天无引用 GC，界面明示「历史版本仍含该内容，要连历史清除请永久删除文档」；删除方之后撤销该步按整步跳过（同 TTL 到期，wholeStep:true）。术语拆开：文档级改称「永久删除文档」。工作量：一个 REST、一个 M-09 用例、一个审计事件、一处 UI 入口，可与墓碑同在 M3；状态图统一为「墓碑 → 已硬删除」，PRD 03 CO-08 补验收。 |
| **连同历史一并清** | 元素级彻底删除同时重写历史：裁剪含该元素的 update 行、重生成或剔除相关快照、必要时换 epoch 强制所有人重连。真正彻底，但要改快照链、在线与离线副本，M5+ 级工作量，与「不过度设计」冲突。 |
| **只留文档级删除** | 不做元素级路径，「立即彻底删除」统一指回收站永久删除文档；元素敏感内容靠缩短墓碑 TTL（部署可配）或永久删除文档处理，TTL 内被删内容仍会同步给后加入者。需回写 04/06/ADR-0013/0020/PRD 03 删去元素级边；与决策包收口意见「元素级需经审计路径」不一致。 |

- 推荐理由：保留裁决「元素级需经审计路径」的意图，权限收紧到 owner，不做历史重写；如实告知历史版本仍含内容，要彻底清除走永久删除文档。
- 关联：BE-15（文档级「永久删除文档」术语）

#### Q2 BE-15 · 文档擦除编排（影响 high（由 gap 升级））

文档永久删除（rulings S-2）要求「失败可重试、可审计」，但 08 把编排信号写成「job_runs 或领域事件」二选一，各下游清理成功后由谁删 documents 行与对象没写，在线 Room 清理后仍会把新 update 写回，M-09 的清理用例只在 collab 角色存在，snapshots/ 开了版本化只删当前版本会残留历史；擦除用哪种编排？

| 选项 | 影响 |
|---|---|
| **单作业加参与者（推荐）** | schedule-purge 同一事务把状态置 purging 并写 job_runs(kind=document-purge)，G-37 对账扫描兜底；worker 上的处理器三步：① 让 collab 踢出该文档会话、关闭 Room，M-09 加入房间时检查 documents.status，purging 一律拒绝；② 依次调用各模块以 @PurgeParticipant 登记的幂等 purge 用例（DiscoveryService 收集，documents 不 import 下游），进度写 job_runs.result，失败整作业重试；③ finalize-purge 用 ListObjectVersions 删 docs/{docId}/ 全部对象版本、删 documents 行并写审计。启动断言登记集合 = {permissions, share-links, media, collab, thumbnails, comments, user-marks}；M-09 参与者只依赖 PgUpdateStore/PgSnapshotStore，可在 worker 装配而不激活 collabServer（纳入 BE-13 矩阵）；状态机允许「立即彻底删除」active→purging。测试：在线编辑中立即删除后无 update 落库、对象存储无版本残留、中途失败重试结果一致。 |
| **按下游拆子作业** | 每个下游一个子作业（或 BullMQ Flow 父子作业），全部完成后触发收尾；可并行，但要多维护扇出与汇合逻辑，子作业失败与父作业状态的关系也要另外定义。在线 Room 拦截与版本化清除同样要补。 |
| **进程内领域事件** | 实现最轻，但进程崩溃或下游失败时信号即丢，需另写补偿扫描才能满足 S-2「可重试、可审计」。 |

- 推荐理由：S-2 要求「可重试、可审计」，进程内事件被排除；单作业比子作业少维护扇出汇合与父子失败语义，参与者登记可在启动时机械核对；同时补齐在线 Room 回写、M-09 角色可用性、版本化对象残留三个缺口。因涉及删除/隐私且影响架构，由 gap 升级为决策。
- 关联：BE-13（M-09 purge 参与者装在 worker）、BE-16（share_links 参与者）、BE-31（user-marks 参与者）

#### Q3 UX-02 · 过期重新登录（影响 high）

设计承诺「重新登录前本地未同步更改不丢失」，但应用壳 M-11 在令牌刷新失败后整页跳转 /login，而 M3 的待同步队列只在内存、整页跳转即丢失；架构（含已接受的 ADR-0029:93）还让刷新失败先走「重连中 → 离线」，用户会先看到误导性的「离线」；登录过期时应怎样处理？

| 选项 | 影响 |
|---|---|
| **新窗口重新登录（推荐）** | 横幅「重新登录」在弹窗或新标签完成 OIDC，服务端照常设 httpOnly cookie，回调页经 BroadcastChannel 通知原页（原页重获焦点也探测 /auth/me）；原页不跳转、队列保留，拿到新票据后按架构已有的 denied→connecting 边重连 → 同步中 → 已恢复；弹窗被拦截退化为新标签链接。回来的用户 id 与原会话不同则不重放队列、按只读处理并提供导出本地副本，防止以他人身份提交更改；该横幅处理前不可关闭。令牌刷新遇 401 直接进「登录已过期」，只有网络错误才走重连中。影响：M-11 会话用例在有 pending 时禁止自动跳 /login、新增弹窗回调页、比对 principal.id；需修订已接受的 ADR-0029:93（加修订注记），以及 ADR-0023:100、06:1090、PRD CO-05:146 的刷新失败分流；12 横幅与 02 F5 补边。 |
| **先导出再跳转** | 点「重新登录」时先确认「跳转会丢失 N 项未同步更改」并提供「导出本地副本」，再整页跳转。实现最简单，但协同队列必丢，用户要手动重做；02 F5「重新登录前不丢失」的承诺要删掉。 |
| **提前本地持久化** | 把 collab-offline-idb（IndexedDB 跨刷新队列，PRD CO-06 的 M4 P2）提前到 M3，整页跳转回来后恢复队列。最稳，但连带加密、按 Unit 与用户隔离、多标签一致性一整块 M4 工作，对当前阶段偏重。 |

- 推荐理由：原页不跳转、队列保留，复用架构已有的 denied→connecting 边，不必把 M4 本地持久化提前；同一用户校验防止以他人身份提交，符合「协同语义不接受简单方案」与「安全宁可提前」。
- 关联：UX-04（不可关闭横幅枚举）、UX-01（横幅状态边）、UX-03（网络失败路径的离线计时）

#### Q4 CO-08 · 故障期广播（影响 medium）

默认 persistBeforeBroadcast=true 即先落库再广播，但 PG 故障期落不了库：溢写成功算不算已持久、未到一级阈值只在内存退避重试的 update 要不要广播，ADR-0025、06、09 都没写，若等落库才广播则故障期协作者互相看不到编辑、违背 S-3「溢写而非拒写」；PG 故障期的广播规则怎么定？

| 选项 | 影响 |
|---|---|
| **降级期照常广播（推荐）** | PG 写失败即进入降级期，update 通过门禁、进入 none/valkey/blob 任一档后立即在本实例广播并跨实例扇出，不等持久化；persistBeforeBroadcast 只约束 PG 可用时的顺序。持久性由发起方 pending 兜底（S-3a：收到 tier:'db' 才清），其他收到广播的客户端重连时经 step2 回填，风险窗口与 persistBeforeBroadcast=false 相同，NF-03「已 ack(db) 零丢失」不受影响；UI 显示「未保存到服务器」，新增指标 cordex_collab_broadcast_before_persist_total。影响：ADR-0025 决策 1/8、06 §6.4 时序图、09 §2.6 与图 2-3/2-6、19 图 6-4 补广播；集成测试：PG 断开时两客户端互见编辑、恢复后 seq 连续不丢。 |
| **先溢写再广播** | PG 写失败超过 ADR-0025:101 的 800 ms 退避上限（或立即）就写一级溢写，溢写成功后再广播，保持「广播前已落到某个持久层」不变式、可机械断言（给 S-3 第一阈值补时间条件）。代价：PG 抖动期间协作者之间约 1 s 看不到对方编辑，每次抖动都走一遍溢写与回放。 |
| **故障期暂停广播** | PG 故障期只回 spill ack、不广播，回放落库后补广播。实现最简单，但故障期协同实际被冻结（一级阈值前可能长达数分钟），违背 S-3「不拒写」与 NF「编辑连续性」。 |

- 推荐理由：S-3 本身就选了可用性优先；S-3a 已规定发起方 pending 保留到 db ack，「已 ack(db) 零丢失」不受影响，也不需改 S-3 阈值；PRD NF:227「编辑连续性」同向。
- 关联：CO-15、CO-16（故障期 Room 状态与回放）

### 第 4 轮 会话状态与角色界面

#### Q1 UX-19 · 查看者界面（影响 medium）

只有 doc.read 的查看者打开文档，M-11 自身给了两条互斥路径：:199/:1158 进协同编辑器 mode='view'（占房间名额、看实时修改），:223 走 /documents/:id/view 的 preset-slide-viewer（最新快照、无协同），M-10:1026 示例还把 viewer 映射成 'edit'，设计 IA 没有查看者形态、playground 给查看者留了「评论」按钮；查看者走哪条路？

| 选项 | 影响 |
|---|---|
| **编辑器只读变体（推荐）** | 查看者进 /documents/:id 协同编辑器 mode='view'：评审外观去掉「评论/高亮」等创建类按钮，只保留跳转与阅读评论，模式下拉只列「只读浏览」与放映；能实时看到修改与在场，计入 50 个查看者名额，与 rulings Q5「查看者在房间内只上报视图」一致；/documents/:id/view 只留给 M1 查看器与嵌入。影响：01-IA §5.1 补查看者变体、02 F1 E4 补 viewer、M-10:1026 改三路映射、M-11:223 移出 viewer 入口、playground viewer 分支隐藏评论/高亮、01 卡片徽标与 12 名额横幅区分「仅查看」「可评论」。 |
| **独立查看器** | 查看者打开 /view（最新快照：无实时、无在场、不占房间名额、不显示评论），删去 EditorHost 的 'view' 与 M-11:199 映射。契约更简单、包更小，但查看者看不到实时修改与评论，别人也看不到他在场；Q5 查看者名额只剩评审者与满员降级者在用。M-10:1026 示例同样须改，viewer 不得映射到 'edit'。 |

- 推荐理由：复用 M-10/M-11 已定义的 mode=view，与 Q5「查看者在房间内只上报视图」的名额语义一致，查看者能实时看到修改。无论选哪项，M-10:1026 把 viewer 映射到 edit 都必须改。
- 关联：—

#### Q2 UX-03 · 离线判据（影响 low）

进入「离线」的判据有两套：PRD、设计 05/12/F5、已接受的 ADR-0029:93 与架构 06:1090 写「30 秒仍未连上」，架构 06 正文 :492/:526/:924、草稿 ADR-0023 决策 5 与 M-05 写「6 次重连失败或浏览器报告断网」（按退避与抖动实际约 25 秒到 1 分钟），契约测试无法同时断言；按时间还是按次数判定？

| 选项 | 影响 |
|---|---|
| **按时间30秒（推荐）** | 自进入重连起累计 30 s 仍未连上即 offline，navigator.onLine=false 立即 offline（横幅图补 none→offline，去抖 2 s）；令牌刷新的网络失败共用同一计时，不另设计时器。影响：M-05 BackoffPolicy 的 maxAttemptsBeforeOffline:6 换成 offlineAfterMs:30000（:157/:170/:211/:457），架构 06 :492/:526/:924 与 ADR-0023:19 同步；PRD、设计、ADR-0029 不动，改动面最小；假时钟断言「29.9 s 未离线、30 s 离线」。离线后出口按 CO-03 默认值（每 30 s 周期重连）。 |
| **按重试6次** | 保留架构与 M-05 的次数判据；PRD 三处、设计 05/12/F5、ADR-0029:93（修订已接受 ADR）、ADR-0023:100、06:1090 改为「连续 6 次重连失败（约 25 秒到 1 分钟）或系统报告断网」，用户文案不再承诺秒数；刷新失败路径改为每次重连重取令牌、取不到计一次失败。改动面更大，测试断言次数而非时长。 |

- 推荐理由：PRD、设计与已接受的 ADR-0029 都不动，只改架构正文、草稿 ADR-0023 与 M-05，改动面最小；配合假时钟可机械断言。
- 关联：原 CO-04 已并入；CO-03（离线后周期重连）、UX-01（状态路径）、UX-02（401 分流）

#### Q3 UX-20 · 母版中切评审（影响 low）

26 与 01-IA 规定已在母版视图时通过模式下拉切到评审不强制退出、只禁用母版页签的编辑控件，但评审模式的 Ribbon 已换成评审工具条，根本没有母版页签与「关闭母版视图」按钮（rulings Q12 只裁了缩窄窗口不退出）；已在母版视图中手动切到评审时怎么处理？

| 选项 | 影响 |
|---|---|
| **切评审即退出母版（推荐）** | 手动切到评审即退出母版视图，回到进入前的页、缩放与滚动位置；被降权（仍在编辑模式、readonly-degraded、Ribbon 还在）时保持 26 §6 只读母版态（编辑类禁用、tooltip「需要编辑权限」、四种退出方式可用）；缩窄窗口仍按 Q12 不退出。只改 26 §6、01-IA:226/:247、02-user-flows:422 与 40-modules/10 MasterViewState 及 master-view.test（补「切评审退出」、保留「降权不退出」），评审工具条不变。 |
| **评审条承载母版** | 保留评审模式下的只读母版视图：评审工具条在母版视图下追加「关闭母版视图」按钮与范围条，Esc/分段退出照常。能在评审中继续浏览母版，但评审工具条多一种形态，26 与 playground 需补稿。 |

- 推荐理由：评审工具条不用多出一种形态，行为与「评审模式不提供母版入口」一致；降权与手动切评审分开处理。
- 关联：UX-11（评审模式无视图页签）

## 二、默认值清单（一次性确认）

| # | ID | 标题 | 推荐默认值 | 影响 |
|---|---|---|---|---|
| 1 | CO-10 | 重连 step2 的 ack 对应与超限拆分（影响 high） | SyncStep2 视同一个入站 update 帧，服务端对每个 step2 恰好回一帧 db ack（空 diff 也回、seq 取当前 head），客户端以发送时 pending 的最大 localSeq 作为一个 FIFO 条目、收到即 ackUpTo 且被覆盖的 pending 不再逐帧重发；step2 超过 maxUpdateBytes（1 MiB）时先按 localSeq 用 mergeUpdates 切成不超限的块逐块以普通 update 帧发送（每块一个 FIFO 条目），再发只含剩余差量的 step2，仍超限则上报遥测并提示导出、不无限重试；溢写回放补发 ack 时原会话已断开即丢弃，由重连兜底。 | high |
| 2 | FE-02 | 章程依赖上限列的书写口径 | 沿 C-28 先例把各行上调到实际用法（补 ooxml-pptx→model-core、slide-render-chart→engine-render/model-slide/ooxml-core、server-collab→model-core，server-headless 按 FE-01、apps/web 按 FE-05），kernel/shared/protocol 对非 L0 包隐式允许（design 的 R18 与 shared 的 R11 例外）、L0 包之间仍逐条显式，09-type-discipline/01 的「references 与上限列不多不少」改为「references = package.json 内部依赖 ⊆ 上限列 ∪ 隐式 L0」，上限列导出 tooling/policy/dependency-limits.json 由现有 sync-references 与 scan-manifest 校验并配负向夹具。 | medium |
| 3 | BE-06 | SessionGuard 全局注册与公开白名单 | SessionGuard 由 AppModule 以 APP_GUARD 全局注册、默认拒绝，只用 @Public() 放行 /auth/oidc/login、/auth/oidc/callback、/auth/config、/auth/.well-known/jwks.json、/healthz、/readyz，非 HTTP 上下文直接放行（WS 靠首帧票据），业务模块不再为鉴权 import AuthModule（顺带消除 BE-07 的 Auth↔Permissions 环），并加「遍历路由表、除 @Public 快照清单外无会话一律 401」e2e。 | medium |
| 4 | BE-10 | 导入原件对象键与上传凭证 | 改为两步：POST /imports/uploads 由服务端预分配 jobId（新建文档时同时预分配 docId=UUIDv7）并返回绑定该对象键的预签名 PUT 与绑定 userId、1 h 有效的一次性 uploadId，浏览器直传后 POST /imports{uploadId} 校验归属并 HEAD 确认对象再建作业入队；客户端全程不提交任意对象键，通用 /storage/presign 删除或仅内部使用，提交他人对象键或 uploadId 返回 403。 | medium |
| 5 | BE-11 | REST 路径 /api/v1 前缀 | REST 统一挂 /api/v1 全局前缀（Nest setGlobalPrefix，排除 /healthz、/readyz；/metrics 走独立端口；/internal/* 不加前缀、反代不转发），RuntimeConfig.apiBase 定为 https://&lt;host>/api/v1、各端点表注明「相对 apiBase」，OIDC redirectUri 改为 /api/v1/auth/oidc/callback，WS 维持 /collab/v1/rooms/:id，反代按 /api、/collab、其余静态文件分流。 | medium |
| 6 | BE-13 | CORDEX_ROLE 到模块的装配矩阵 | 在 40-modules/12 §7.1 给出「模块 × 角色 × 部件（rest/producer/processor/observer/cron）」矩阵并由 ADR-0037 决策 1 与 08 §0 引用：api 装全部 REST 与生产者，collab 装 Collab、Snapshots 与管理动作（BE-03）、评论观察器、Webhook 生产者、Permissions、ShareLinks（BE-02），worker 装全部处理器与定时作业（对账、SealJob、maintenance、document-purge 及 M-09 purge 参与者），global 模块与 Health/Metrics/Internal 诊断在三角色都装，renderer 只装入口加精简探针（BE-14），启动断言逐项核对。 | medium |
| 7 | BE-18 | 幂等键命中失败作业的语义 | 幂等只对非失败行生效：同键命中 queued/running/succeeded 返回既有行，命中 failed 则新建一行并以 attempt_of 指向上一行（状态机保持单向），job_runs 增 idempotency_key、attempt_of 两列与部分唯一索引 unique(idempotency_key) where status &lt;> 'failed'，08 §7 不存在的 import_job_id 改由 BE-10 预分配 docId 保证，单测覆盖并发同键只建一行、失败后同键重提得新行。 | medium |
| 8 | BE-19 | Webhook 队列、周期作业与投递状态 | 投递队列定名 webhook-delivery（并发 4、指数退避、最多 8 次）登记进 08 §7 与 queues.ts，全部周期作业（reconciliation 每 1 min、audit-seal 每日、media GC 等）用 BullMQ Job Scheduler 挂 maintenance 队列、只由 worker 启动时注册（墓碑清理仍为 LeaseLock 例外），投递状态为 pending（含重试中）→ succeeded \| failed（出站守卫拒绝、订阅停用、非 408/429 的 4xx 等不可重试）\| dead-lettered（重试用尽）。 | medium |
| 9 | CO-03 | 离线后回到在线的出口 | 进入 offline 后不停止重试：每 30 s（±20% 抖动）自动重连一次，navigator.onLine=false 期间暂停，收到 online 事件或用户点「立即重连」立即进入 connecting；06 §5.1、M-05 两张 FSM 图、ADR-0023 决策 5 与图 2 同步，runCollabConformance 断言服务端恢复后 offline 会话 ≤36 s 自动回连、断网期间不发连接（与 UX-01、UX-03 一起落）。 | medium |
| 10 | CO-16 | PG 不可达时 Room 收尾与遗留溢写回放 | 关闭或 SIGTERM 时若 PG 不可达，先把内存档强制写入一级溢写再进入 closed，不在 persisting 久等（ADR-0035 决策 9 同步）；存活实例只回放自己 instanceId 的溢写行（readAllOrdered(docId, instanceId)），心跳过期实例留下的行由下次加载该文档的 Room 在 bootstrap 之后持 lock:spill:{doc} 租约认领回放，删去 09:983「停留 persisting」。 | medium |
| 11 | UX-05 | 导出「等待同步」后的去向 | 点「等待同步」后对话框停在该态实时显示「正在同步 N 项…」，归零自动进入生成中、期间可取消，离线或重连中时该按钮禁用并提示「恢复连接后才能同步」；PDF 与 M3 起的批量 PNG 等服务端格式不提供「仍要导出」、警告改为「需先同步 N 项更改」，「导出将包含本地最新内容」只用于客户端格式。 | medium |
| 12 | GV-16 | RLS 与 renderer 沙箱测试的运行时机（并入 BE-34） | security:rls（testcontainers 起 PG）与 renderer 零出站测试都进每个 PR 的 e2e 冒烟子集并自 M3 起阻断，renderer 的非 root、无凭据、沙箱开启改由 scanners job 的 check-image-policy 静态检查，断网 compose e2e 仍在 main 全量段；11 §10 与门禁流①、PRD 05:171/:182、40-modules/01 §5.7/§5.9 同步。 | medium |
| 13 | FE-09 | /render 页 ready 判据 | /render 装配 viewer 时关闭惰性加载（lazy.charts、lazy.locales 置 false），ready = 所请求页全部 render/page-mounted ∧ 这些页的字体请求全部结算（fonts-ready 或 font-fallback，无字体需加载视为已结算）∧ 此后出现一次待绘脏区为空的 render/frame（06 的 render/frame 补 pendingDirty 或提供 hasPendingWork()），注入等待超时（页面常量，默认 60 s）与 ADR-0026 每页 10 s 渲染超时分开计，11 与 07:624 统一写这一条并由 render-page.spec.ts 断言。 | low |
| 14 | FE-21 | cordex 字段第八键、rank 与 compositionRoot | 第八个键定为 implements（provider 必填、R7 读取），rank 由 layer 查秩表得出、不写进 package.json（schema 拒绝 rank 等未知键），preset-*、apps/web、apps/server 显式写 compositionRoot:true，preset 的 bundle 按 FE-01 结论写。 | low |
| 15 | BE-30 | 浏览器遥测端点的承接模块 | /api/v1/telemetry/errors 与 otlp 代理由 M-12 新增 client-telemetry 控制器承接、装在 api 角色，要求登录并加令牌桶限流与请求体上限（errors ≤64 KiB，otlp ≤512 KiB 且只转发 traces），30-arch/10 流图补 Collector→Jaeger（traces）与 Collector→Prometheus（metrics）。 | low |
| 16 | BE-31 | 最近/固定记账表与会话表 | 新增 document_user_marks(user_id, doc_id, last_opened_at, pinned_at null, pk(user_id, doc_id)) 归 M-08 documents、受文档级 RLS 且只返回本人行、纳入 S-2 purge 参与者；collab_sessions 在 M1–M3 不建（会话统计走 Prometheus，加入离开走 audit_log 的 collab.join/leave）。 | low |
| 17 | CO-14 | 内存压力下空闲房间回收 | 内存压力或准入不足时先按 LRU 提前结束 draining 房间（draining→persisting→closed，无在线客户端无需 1012），仍超预算才对 active 房间走 active→evicting；删去 09 的 draining→evicting 边，06 §14 准入在预算不足分支前先回收空闲房间再判定，容量测试补对应用例。 | low |
| 18 | UX-06 | 组合编辑态 Esc 的落点 | Esc 逐级：文本编辑 → 选中子元素 → 选中整个组合（退出组合编辑态）→ 取消选择 →（仅母版视图中且已无选区）退出母版视图，与 PowerPoint 一致，17 补选择状态图并同步 16、PRD 02-editing:66 与无障碍 Esc 分流图。 | low |
| 19 | UX-07 | 放映黑屏/白屏如何恢复 | B/W 为切换键：黑屏或白屏时再按同一键、点击画面或按任一翻页键都先恢复到当前页（不翻页），Esc 仍直接退出放映，期间控制条照常可浮现；11 状态图补 blank 子态，PRD ED-21 补半句。 | low |
| 20 | GV-04 | 绘图规范入库与章程「优先 ASCII」 | 章程 §9.2 第 4 条改为「图用 Mermaid 11 且须通过 mermaid-check；界面 ASCII 线框、目录树与代码结构仍用文本块」，docs/_tools/README.md 新增绘图规范五条（引号口径、破坏解析或会被净化吞掉的字符用实体转义、单图 ≤40 行 ≤25 节点、加粗图名+怎么读+依据、必须过校验），mermaid-check.cjs 增加引号、「&lt; 后接字母」与超限三项检查，全部报错，既有超限图进豁免表。 | low |
| 21 | GV-05 | 既有超限图与状态图标签圆括号 | 4 张既有超限图（00-module-map:10、02:391、15:178、15:246）保留不拆并登记进 mermaid-check 豁免表，状态图转移标签里的函数调用圆括号允许保留，只有破坏解析或被 HTML 净化吞掉的字符强制转义（05:153 另按 GV-23 修）。 | low |
| 22 | GV-08 | 09 号模块图号顺序 | 09 §2 按出现顺序重新编号（Room 生命周期状态机改为图 2-2，原 2-2/2-3 顺延为 2-3/2-4，2-5 至 2-7 不变），同步 09:582、09:1131、19-atlas:1010 三处引用。 | low |
| 23 | GV-24 | replace 冲突策略的允许清单 | 各处不再手写 replace 允许清单，统一写「须在贡献点定义时显式声明，当前取值以 03 §3.6 总表 conflict 列为准（ui.*、render.element、render.overlay、i18n.bundle）」，改 03:179–180 注释与 ADR-0006:18（记变更依 K-3），rulings K-3 原文不改、只在回写记录注明。 | low |

## 三、机械修正清单

按影响排序；「依赖」列标出需等决策或默认值确认后再执行的部分，其余可立即执行。

| # | ID | 标题 | 影响 | 依赖 | 权威 | 修正计划 |
|---|---|---|---|---|---|---|
| 1 | FE-04 | 规则 7 只许 . 与 ./testing，与已裁子路径冲突 | high | — | rulings-2026-09-14.md:208（C-07：preset 经 @cordexjs/kernel/preset 子路径 import）、:88（A-9 @cordexjs/shared/order）、:143（§4.7 R17 @cordexjs/ui-react/ui），均晚于规则 7 且以显式子路径为前提；charter.md:502 publicEntry 须与 package.json#exports key 集合逐一相等（已有登记机制） | 改写 charter §5.3 规则 7 为「跨包只能走目标包 exports 显式登记的子路径（= cordex.publicEntry），禁止通配与 src/lib 深引用，./testing 仅限测试」；02 §4.0.1 exports 行与 R8、09-type-discipline/04-api-surface §2（:55-73）、03-boundaries:162 与 §3.6 同口径；01 §5.5 第 8 条 no-deep-import 由固定正则改为查询目标包 publicEntry，补负向夹具（未登记子路径、src 深引用、./* 通配各一）；R17/R18 保留为子路径专项限制；逐包登记 publicEntry：kernel ./preset、shared ./order、model-slide ./editing、protocol ./permissions 与 ./render/page 等、ui-react ./ui 与 ./styles.css、design 四个 css 文件（逐个列、不写通配）、preset-slide(-viewer) ./entries、slide-render ./chart（M1–M2）。 |
| 2 | BE-05 | 分享链接守卫须先于角色守卫 | high | 角色合并部分与 BE-02 推荐一致 | rulings-2026-09-14.md:267 S-1（凭链接即得链接角色，ShareLinkGuard 叠加角色、不产出匿名 Principal）；adr/0029-gateway-authorization.md:103（ShareLinkGuard 在 Principal 解析后运行并把 role 叠加进 Principal.scopes），故链接角色必须在 DocumentRoleGuard 判定前进入 Principal | 顺序固定为 SessionGuard → ShareLinkGuard（请求带 shareToken 时生效）→ DocumentRoleGuard；ADR-0029 图 1 Note 与 :105、30-arch/08 §2 处理链图与怎么读写明（rate-limit 最前；可选把 ShareLinkGuard 注册为紧随 SessionGuard 的第二个 APP_GUARD，无 shareToken 直通）；40-modules/08 §2.6/§3/§5.6/§6 与 19 图中 ShareLinkAccessGuard 全改 ShareLinkGuard（文件名沿用 share-link-access.guard.ts），§6 守卫列按执行顺序书写；RoleResolverService/DocumentRoleGuard 读 Principal.scopes 中本文档链接角色与直接授权取高（与 BE-02 推荐一致）；e2e：只有链接无直接授权的用户访问 GET /documents/:id 与 collab-ticket 返回 200。 |
| 3 | CO-06 | ADR-0034 把 _deleted 合法值写成 true | high | — | 30-architecture/04-document-model.md:322（set(['shapes', id, '_deleted'], { at, by })）与 40-modules/02-kernel-protocol-and-document-core.md:208（Tombstone 类型唯一定义 { at: EpochMs; by: ClientId }）；40-modules/09:337 TTL 判定依赖 _deleted.at | ADR-0034:69 改为「_deleted 不符合 Tombstone 形状 {at: EpochMs, by: ClientId}（缺字段或类型不对）→ 恢复为该键上一个合法值；计数」；「如何被机械验证」的黄金用例按新形状重出：{at, by} 合法，true/缺字段/字符串非法；不加「at 在未来即非法」（客户端时钟偏差会误伤）。 |
| 4 | GV-17 | manifest.ts 是生成物而非手写意图声明 | high | ADR-0003 job/扫描器名随 GV-14/GV-15 | charter.md:87 术语「Manifest……由源码生成」、:688 §6.2「插件清单：静态分析生成并入库，CI 无 diff」；09-type-discipline/06-scanners.md:181 与 09-plugin-type-contracts.md:5 自述生成策略归结构线 03/ADR-0003；adr/0003:35 已否决「手写 manifest.ts」 | 09-plugin-type-contracts.md §3（:65、:66、:73–74、:86）改为「manifest.ts 由 manifest-gen（即 tooling/scripts/scan-manifest.ts）从源码静态分析生成、头部 generated、入库，CI --check 重新生成无 diff；cordex-manifest.json 构建时由 manifest.ts 序列化、随包发布、不入库」并删「人工编写以获得意图声明」；06-scanners.md:183 规则 (a)(b) 同步；17-plugin-authoring-patterns.md:898 第 6 步改为「运行 manifest-gen 生成并提交」；40-modules/01 :152、:627、:227 同步；ADR-0003:21、:50 与 03:350 图中 tooling/manifest-gen 注明即 scan-manifest.ts（M-01 D-1），语义不改；ADR-0003:47、:49 的 job 名与扫描器名随 GV-14/GV-15。 |
| 5 | FE-05 | apps/web 可 import 的包三处口径不一 | medium | 与 FE-01 同批改章程 §5.2 | rulings-2026-09-14.md:292 → _evidence/q1-q10-decision-pack.json results[10].decisions[1].docUpdates[1]（R9 改为「不含领域定义」判据）；rulings:116 设计-2（应用壳页面允许）、:143 R17（apps/* 可引 ui-react/ui）；charter.md:302 createHost 属 kernel 且 02:176 规定 create-editor-host 调用 createHost | 以 11 §10 为准统一：apps/web 可 import preset-*、protocol、design、ui-react（EditorHost、壳组件、./ui、./styles.css）、i18n、shared、kernel（值导入仅限 application/host/**，其余只许 import type），另放行 react、react-dom、react-router、tailwind；charter §5.2 apps/web 上限与图 5-8 同步；02 §3 首段与 §3.1 package.json 补 kernel、shared、i18n；11 §4.4 package.json 补 @cordexjs/kernel，§3.5 接入点表改为与 §10 一致；01 与 03-boundaries 的 apps-only-assemble 配置同步并补负向夹具；18 图 3-7 webDeps 补 kernel（仅 host 目录）、shared、i18n。 |
| 6 | FE-06 | preset 派生方向与 preset 间包依赖 | medium | ./entries 登记随 FE-04 | 30-architecture/02-layering-and-packages.md:1153（preset-slide 以 viewer 全部条目为基础定义，并有超集断言）；40-modules/11 §3.1:335、§4.1:465、§5.1:738、§5.2:760 逐文件一致以 viewer 为基经 ./entries import；rulings:208 C-07 只迁走 assembly/，未取消 ./entries 派生 | 11 图 2-1 改为 presetViewer --「VIEWER_ENTRIES 加编辑与 UI 条目」--> presetSlide --「deriveCollabEntries」--> presetCollab，怎么读同步；§10「L8 同秩定向 import」行与 §12 G-5 结案语改为「C-07 后 assembly 链消失，./entries 派生链仍在：viewer ← slide ← collab，由 R1/R2 约束，不另设规则」；preset-slide 的 dependencies 写 @cordexjs/preset-slide-viewer: workspace:*，preset-slide-collab 写 @cordexjs/preset-slide: workspace:*（上游 preset 用 dependencies，插件包仍按 §10 写 peer）；§4.1 注明 locale-packs 以同 id 替换而非追加；./entries 随 FE-04 登记 publicEntry；18 图 3-7 补两条边、图 4-5 改实线并删分歧说明、§10 第 6 条删除。 |
| 7 | FE-07 | 02 §4.21/§4.21b preset 清单落后于 11 | medium | — | 40-modules/05-collaboration-client.md:820 把 viewer 是否加载 local presence 交给 M-11，40-modules/11:1168 G-13 已裁定不加载；rulings-2026-09-14.md:187 Q18（可选条与抽屉默认关）、:243 U-03（allowExport 默认关） | 02 §4.21 plugins.ts 删 design(css)、补惰性 slide-render-chart（M1–M2 为 slide-render/chart）与语言包，文件名按 11 §4.1 改为 preset.ts、config/options.ts、plugins/*.entries.ts；§4.21b 删 collab-core(local presence)，thumbnails、notes、allowExport 默认 false；超集断言与 11:75 统一为扣除 {read-only, design-css, viewer-shell, viewer-thumbnails/notes/search}；组装关系图 common 去掉 local presence 与 design css（前者挂 slide、后者挂 viewer 专有），lazy 改为三者共有；05 §7:820 与图 :834 改为「viewer 不加载（M-11 G-13 已裁）」；18 图 4-5、3-7 核对。 |
| 8 | FE-08 | M1–M2 图表只读渲染器为惰性子路径 | medium | ./chart 登记随 FE-04 | 30-architecture/02-layering-and-packages.md:959、:964、:977 与 30-architecture/07-rendering.md:374（架构正文优先于 40-modules）：M1–M2 图表渲染为 slide-render 包内惰性子插件 @cordexjs/slide-render/chart，主包只有占位 | 40-modules/07：infrastructure/chart/chart-preview.renderer.ts 作为 ./chart 子路径入口（M1–M2），主包加 chart-placeholder 渲染器、渲染器未加载时发 render/element-degraded{reason:'chart-unavailable'}；§3:381 改为「缺席时落回主包占位」；§6:776 子路径加 ./chart（随 FE-04 登记 publicEntry）；§8:817 改为「主包随首屏加载，图表子路径遇图表元素时惰性加载」；§11:927 同步；02:963-964 措辞同步；18 图 8-4 与 §10 第 4 条删分歧说明。 |
| 9 | BE-07 | 用例级依赖未进 Nest imports 列 | medium | 待 BE-06、BE-02、BE-04 | 40-modules/12-server-jobs-comments-and-ops.md:1052 G-37 结案「JobsModule 增 imports」（依 rulings:273 §4.13 Outbox 对账）；40-modules/08:676 与 40-modules/09:506 文件职责表为定稿；Nest 只能注入经 imports 引入的导出 | （依赖 BE-06 全局守卫、BE-02、BE-04 的结论）40-modules/08 §3：AuthModule imports 增 PermissionsModule，exports 增 ticket 校验函数（或 JwtService）供 M-09；40-modules/09 §3.3：CollabModule imports 增 PermissionsModule（AuthzSource）与 AuthModule（TicketVerifier），BE-02 选项 1 时再增 ShareLinksModule，§5.1:795 依赖列同步（可选：TicketVerifier 改从 ConfigModule 读公钥）；40-modules/12 §3 首行模块列只留 JobsModule、imports 增 WebhooksModule（括注 reconciliation.job 只读 WebhookRepository），图 3-1 虚线改实线；Thumbnails→Internal 按 BE-04（取消则删）；删 19 §9 第 2 条，图 2-1、2-2 同步。 |
| 10 | BE-08 | 架构 08 目录树未执行已采纳回写 | medium | — | rulings-2026-09-14.md:263 §4.13（20 个 Nest 模块逐个保持，permissions、share-links 为独立模块）；adr/0029:103 守卫路径 share-links/interface/guards/；40-modules/14-cross-module-review.md:449-450、:463 处置「采纳→回写」 | 30-arch/08 L21、L93 改为 Documents、Permissions、ShareLinks 三个平级模块；§2 目录树在 modules/ 下拆出平级 permissions/、share-links/；守卫按归属移动：session、platform-admin → auth/interface/guards/，document-role → permissions/interface/guards/，share-link → share-links/interface/guards/，common/ 只留 filters、interceptors、pipes、rate-limit；snapshots.controller 补「GET …/:a/diff/:b（P2）」；§1 模块图同步，处理链图与 BE-05/BE-06 一起改。 |
| 11 | BE-09 | OIDC 换码在服务端完成 | medium | — | adr/0029-gateway-authorization.md:116（服务端是 OIDC RP）；30-architecture/08-backend-nestjs.md:808（httpOnly cookie 会话）、:162（配置含 clientSecret）；40-modules/14:380 M-11/G-4 采纳→回写 | 30-arch/02 §3.1 L169 改为「auth/ 会话客户端（cookie 模式 / 嵌入场景 Bearer 两种）：发起 POST /auth/oidc/login 跳转、/auth/callback 回环页、会话探测与刷新；OIDC 授权码 + PKCE 由服务端 auth 模块完成，浏览器不持有 PKCE verifier 与 IdP token」；PRD 06:325 补「由服务端完成」；删 18 §10 第 1 条。 |
| 12 | BE-12 | 应用壳 REST 路径与服务端不一致 | medium | 两步导入随 BE-10 | 30-architecture/08-backend-nestjs.md:206、:208（架构正文效力高于模块文档）；30-architecture/06-collaboration.md:578-579、:833；40-modules/12:474 与之一致 | 40-modules/11 §1.3:94、§2.6:213/:215/:216、路由表 :416/:422、目录树 :679/:680/:692、文件表 :880/:881：/tasks/* 改为 /imports、/imports/:jobId、/documents/:id/export、/exports/:jobId，tasks.api.ts 改名 import-export.api.ts；latest 改为「GET …/latest 直接取字节（ETag/304）」，snapshots.api.ts 删「预签名 → 字节 fetch」；两步导入随 BE-10 默认值一并改。 |
| 13 | CO-05 | 删除降级产物为 set _deleted | medium | — | adr/0013:91 把 delete 语义落点交给架构 04；30-architecture/04-document-model.md:322 定为 set(['shapes', id, '_deleted'], { at, by })；已接受 adr/0020:102 只规定「store 层落为 _deleted 标记、不新增 op」；Store 属主 40-modules/02:205、:1479 机械检查与 lower 属主 40-modules/03:261 一致（ADR-0013/0032 为提议态） | ADR-0013:90 与图 2（:52）改为「lower() 产出 set(&lt;实体路径>/_deleted, {at, by})，逆操作由 Store 推导为 delete(&lt;实体路径>/_deleted)；实体键的 delete 只由服务端 TTL 硬删除（origin system('maintenance')）、文档擦除和经审计的彻底删除产生」；ADR-0032:60 同改；ADR-0020:102 措辞与图 2（:139）边标签改为「删除 Mutation 降级为 set _deleted」；runDocumentStoreConformance 的 soft-delete-tombstone 用例补断言「用户删除的降级结果中无实体键 delete」。 |
| 14 | CO-09 | 两级 ack 的 seq 与 localSeq 对应（并入 BE-33） | medium | 重连发送随 CO-10 | 40-modules/02-kernel-protocol-and-document-core.md:1085（ack 帧唯一事实源：逐帧应答、客户端以在途 FIFO 队首对应）；30-architecture/06-collaboration.md:1128（OfflineStore 权威签名 ackUpTo(localSeq)）；rulings:329 | 06 §6.4 第一条补：客户端按连接维护在途 FIFO（元素为 localSeq），每收到 tier:'db' 弹出队首并 ackUpTo(该 localSeq)，tier:'spill' 不参与 FIFO 对应、只更新 SessionStats（degraded 标志、已接收计数），断线清空 FIFO、未确认 pending 留待重发（重连发送方式见 CO-10）；06:634「最大 seq」改为「该帧落库时分配的 seq」；M-05:198 改为「ackUpTo(localSeq)，localSeq 取在途 FIFO 队首；seq 只更新 meta.lastAckSeq」；M-02:1085 补「客户端不据 spill 做对应」；ADR-0023 决策 7 与 ADR-0025 修订 2 引用 M-02；M-05 batcher.test（:727）补 FIFO 对应与连续 spill 用例。 |
| 15 | CO-13 | Room 状态集合与转换照抄 06 §5.2 | medium | draining→evicting 随 CO-14 | 30-architecture/06-collaboration.md:547-556（Room 状态机唯一定义，七态）；adr/0023:97（宽限 60 s 取代 30 s） | 40-modules/09:60、:123、:169 的转述改为照抄 06 §5.2 七态与转换；图 2-4 补 failed、active→evicting（shutdown 或内存压力，发 1012）、evicting→persisting，删 evicting→closed，draining→evicting 按 CO-14 默认值删除；40-modules/05:194 补 evicting；ADR-0023:22 改为七态、宽限 60 s。 |
| 16 | CO-15 | 溢写回放期间 Room 保持 active | medium | 无人在线收尾随 CO-16 | 30-architecture/06-collaboration.md:550、:556（persisting 只通向 closed；§6.4 在 2026-09-24 按 S-3a 修订时未为回放新增状态） | 40-modules/09:123、:335、:983 改为「PG 故障期与回放期间 Room 保持 active（spillTier≠none 或 replaying=true）」；图 2-4 删 active↔persisting 两条边，图 2-6 两个 Note 改写；19:1058、:1067、:1071 同改；08:965 预算名改为「PG 恢复 → 回放完成」；写明回放完成前新到的 update 排在回放队列之后落库以保持 db ack 顺序；无人在线 Room 的收尾按 CO-16 默认值。 |
| 17 | CO-18 | 换版式匹配到但有显式 transform 取 inherit | medium | — | 10-prd/03-features/07-masters-layouts-and-themes.md:111（匹配成功时显式覆盖保留）、:110 规则 (4)、:114（脱离占位符不带 p:ph）；30-architecture/04-document-model.md:909（缺省 = 继承）、:894（materialize 后包围盒不变） | 04:925 inherit 改为「找到匹配 → 形状上已有的显式覆盖（含 transform）原样保留、未覆盖字段随新版式继承；匹配到的 (type, idx) 与现有 PlaceholderRef 不同则改写 ref」；:926 materialize 改为「按 InheritableField 全集把旧版式解析值（transform、geometry、fill、line、effects、bodyProperties、listStyle）写成显式值并移除 PlaceholderRef」；05:365 降级列同步；M-03:194 同步；04:894 property 测试补「带显式 transform 的占位符换版式后位置不变」「materialize 后文本渲染快照不变」。 |
| 18 | UX-01 | 断线恢复路径四份文档画法统一 | medium | 离线判据待 UX-03 | 30-architecture/06-collaboration.md:513-532（内部 FSM：backoff→connecting→authenticating→syncing→live，readonly→live，offline→connecting）、:1089（PRD 名称对照）；40-modules/05-collaboration-client.md:166（UI 用 reconnectAttempt>0 派生「重连中」）；10-prd/03-features/03-collaboration.md:175（重连后先鉴权再同步） | （离线进入判据待 UX-03，周期重连按 CO-03）PRD 03-collaboration 图 3-1：reconnecting→synced 改为 reconnecting→syncing（先鉴权再同步），补 offline→reconnecting（网络恢复、手动或周期重连）与 readonly_degraded→synced（权限恢复），删 :455「本文未定义退出条件」；CO-01:69 补「对外载荷为 M-05 SyncState 六态，映射见架构 06 §18.3」；设计 05 §7 :188/:204 同步；02 F5 删 connecting 态，:215-219 起点改为 reconnecting，:224 同步；12 横幅 :24-25 改为 reconn→syncing（同步持续 ≥2 s）、reconn→recovered（2 s 内同步完成）、offline→reconn，:10 补「重连时的 connecting 呈现为重连中」。 |
| 19 | UX-12 | 设计系统仍称 --cordex-* 为唯一契约 | medium | — | rulings-2026-09-14.md:223 C-22（--cordex-* 前缀作废，改 shadcn 变量 + Cordex 扩展裸名变量）；charter.md:320 | 20-design/04:7、:15 改为「以 shadcn 变量 + Cordex 扩展裸名变量（--glass-*、--layer-*、--duration-*、--ease-*、--control-h-*）发布；--cordex-* 仅作取值来源记录」；06 §PS-02 白名单与禁止表改用 --primary/--ring/--background… 与 --layer-*、--duration-*；07-accessibility 与 01-IA 层级表改名或加「原记号已作废」说明；04 §9 补旧名→现名对照表（取值以 playground/src/index.css 为准，未落地的标待实现）。 |
| 20 | UX-13 | 「超包络拒绝导入」应为超系统天花板 | medium | — | adr/0035-gateway-horizontal-scaling.md:88、:100（已接受，复核修正：包络是性能保证，天花板才是拒绝线）；adr/0034:74；10-prd/03-features/06-server-and-ops.md:68 SV-01；决策包 Q5 子问题阈值即天花板数字 | PRD 06:375 改为「超出系统天花板（页数/单页元素/总元素）或文件超过 200 MB 的导入直接拒绝」；PRD README:208、PRD 07:131、charter:815 同步；40-modules/04:388、:426、:669、:1055，02:1574，03:115，09:1121 的「超包络」改「超天花板」（ImportEnvelope/checkImportEnvelope 改名或加注）；rulings §4.15 Q5 原文不改，行末加注「此处超包络即超系统天花板，见 ADR-0035 复核修正」。 |
| 21 | UX-14 | G-54 导入卡片形态与设计 #/import 不符 | medium | — | rulings-2026-09-14.md:126（范围以 07 为准、交互形态以 08 为准）；20-design/08-prototype-audit-and-v2-plan.md:495（导入→跳 #/import）；20-design/03-screens/13:122（确定性错误不提供重试）；PRD 06:66 SV-01（进度阶段与 OF-01 一致） | PRD 07 G-54 落点改为 13 #/import 过渡态：上传中（按字节确定态 + 取消）→ 服务端解析（不确定态 + 取消）→ 打开编辑器；取消即中止上传或取消作业、回到列表，不留卡片与原件（SV-01 作业状态补 cancelled 并清理原件与产物）；确定性错误只给「返回列表」，瞬时错误（网络/超时/5xx）给「重试」（完整重走）；「损坏」改为「无效的演示文稿（format.pptx.invalid_package）」；图 G-54 补 cancel/retry 边；缩略图失败占位一句移到 01 卡片封面；13 打开进度表补「上传中」「服务端解析（作业 queued/running）」两行并注明服务端导入复用同一过渡页。 |
| 22 | UX-16 | IA 仍写放映播放动画与切换 | medium | — | rulings-2026-09-14.md:115 设计-1（M1–M3 放映渲染结束态、不播放，播放为 M4+ P2）；charter.md:56 | 01-IA:186 改为「只读、全屏；M1–M3 渲染每页结束态（主序列可见性终态，M2 P1），不播放动画与切换，播放为 M4+ P2（charter §2.3、rulings 设计-1）」；设计 README:117 术语同步；README §5 第 1 条（:107）与待协调第 7 条（:143）加删除线并标「已结案：rulings 设计-1」。 |
| 23 | UX-17 | 版本历史只读档应为编辑者 | medium | — | rulings-2026-09-14.md:250 U-09（history.read 下放 editor，commenter/viewer 不可）；40-modules/08:184、:187（history.restore 与 doc.manage 仅 owner）；40-modules/09:813（命名快照需 doc.manage）；PRD 03:29 | 02-user-flows:342 改为「编辑者（有 doc.history.read，无 doc.history.restore/doc.manage）」，评审者/查看者归入「无 history.read → 入口不出现」；07-version-history:54 标题改为「只读（编辑者，无恢复权限）」，:56、:65 tooltip 改为「需要所有者权限」并注明「命名当前版本」需 doc.manage。 |
| 24 | GV-13 | 02 的 CI、hook、tooling 目录描述过期 | medium | 旧扫描器名随 GV-15 | 30-architecture/02-layering-and-packages.md:1280（02 自称详细规格由 09 承接）；09-type-discipline/07-hooks-and-ci.md:103（lockfile-guard 并入 scanners job）；40-modules/01-tooling-and-governance.md:899 D-1、:900 D-2（lefthook.yml 位于仓库根） | 02:141 ci.yml 行改为 07 §3 的 13 个 job 名摘要（scanners 含 14 个扫描器中除 scan-policy 外的 13 个，加 4 个治理检查脚本：lockfile-guard + 3 个 check-*），删「并入 install 步骤」；:144 改为「运行 tooling/scripts/scan-policy.ts（job policy-check）」；:119 改为「三阶段内容见 09-07 §2」；02 §5（:1288–:1291）四个旧目录合并为 scripts/ 与 policy/ 并注「详见 40-modules/01 §4/§5」，:113 turbo 任务名对齐，旧扫描器名随 GV-15；00-module-map:1215 M-01 行目录与 README:42 一致；07 §1 目录树注明 lefthook.yml 物理在仓库根。 |
| 25 | GV-18 | 贡献点重复键：拒绝加诊断而非抛异常 | medium | replace 清单随 GV-24 | 09-type-discipline/09-plugin-type-contracts.md:5（运行时语义归 03，本篇只消费）；30-architecture/03-kernel-and-plugin-model.md:214（conflict:'error' → 拒绝后者 + 诊断 duplicate）；rulings-2026-09-14.md:285 K-3（conflict 字段存在） | 09-09 §1.2:41 改为按 conflict 策略：默认拒绝后者、记 duplicate 诊断并 errors.report，ctx.contribute 返回 no-op disposer、不抛异常，删 DuplicateContributionError；§1.1 签名 options 补 conflict?: 'error' \| 'replace' 与 describe?；05-runtime-boundaries.md:141、:150 删「贡献点 key 冲突」例子；03:175、:190 统一为以 schema 为唯一类型参数；replace 清单措辞按 GV-24。 |
| 26 | FE-11 | slide-ui 不向 ui.notification 贡献 | low | — | 40-modules/10-ui-shell-and-slide-ui.md:447（§3 贡献点逐项清单）与 :453（Manifest contributes）为同文定稿，§0 仅摘要 | 10 §0:17 改为「向其中七个（ui.ribbon/panel/toolbar/contextMenu/statusBar/shortcut/command，除 ui.dialog/ui.notification/ui.theme）与 i18n.bundle 贡献条目」；18 §5:737 说明改正，§10 第 3 条删除。 |
| 27 | FE-12 | doc/sheet 预设数量与骨架文件口径 | low | — | rulings-2026-09-14.md:241 U-01（收录 preset-doc/preset-sheet，不带后缀）；charter.md:327-328；40-modules/13:585（M5 骨架只做单人 preset）；13:604「命名待决」已被 U-01/C-19 结案 | 11 §8:1011 目标列改为 preset-doc，viewer/collab 两行标「M5 后续，届时经章程修订登记」；13 §4.9:568 样板依据改为「以 11 §4 为准」；§4.9、§4.10 骨架文件名对齐 11（preset.ts、entries.ts、config/options.ts、plugins/*.entries.ts）；00 §1:128 规则 3 改为「不设 DDD 分层目录，文件布局按 11 §4」；删 13:604「命名待决」；18 图 9-2 与 §10 第 7 条更新。 |
| 28 | FE-13 | apps/web 的 Vite 与 react-router 主版本 | low | — | rulings-2026-09-14.md:292 → _evidence/q1-q10-decision-pack.json results[10].decisions[1].docUpdates[4]（Vite 7 改 8；react-router 8.x，包名 react-router） | 11 §0:11 改为「Vite 8 + React 19 + react-router 8」；ADR-0004:25 apps 行改 Vite 8；02 §2 catalog 若列 react-router 同步 8.x；10:467 playground 迁移注记不变。 |
| 29 | FE-14 | M-04 下游补 M-07 | low | — | rulings-2026-09-14.md:305 §4.15 Q7（C-28 放行 slide-render→ooxml-core）；charter.md:318、:338 | 04 §0:15 下游补「M-07（slide-render 只读解析 chartml 与 dsp:drawing）」并删 :150 差异说明；00 §7:1218 补下游、:1221 补上游，模块依赖图与批次 2 图加 m04-->m07；README:45、:48 同步。 |
| 30 | FE-15 | M-09 依赖 M-05 的 collab-core | low | — | charter.md:329（server-collab 上限含 collab-core）；30-architecture/08-backend-nestjs.md:257 与 30-architecture/06-collaboration.md:76（架构正文把 collab-core 列为 server-collab 的 package.json 依赖） | 00 §7 M-05 行下游补 M-09、M-09 行上游补 M-05，批次 2 图 :1299 改 m05-->m09 实线，标签改「server-collab 依赖 collab-core 契约，帧格式另经 protocol」；09 §0:14 上游补 M-05，§1.1:79 删「无包依赖」，§5 server-collab 文件表补 collab-core 具体使用点；05 的 :19、:62、:90、:112、:117、:822、:843 改为「server-collab 复用 collab-core 的 Definition 契约，不复用 collab-yjs/transport 等 Provider」；README 与 18 图集同步。 |
| 31 | FE-16 | M-13 上游区分运行时与样板参照 | low | — | charter.md:316（render.* 由 engine-render 定义，属 M-06）、:321（ui.* 由 ui-core 定义，属 M-10）、:309（ooxml-core 文档类型盲，供 ooxml-docx 复用，属 M-04）；铁律 2 只禁束间 import | 00 §7 M-13 行上游拆为「运行时：M-02、M-04（ooxml-core）、M-06、M-10（ui-core/ui-react）；样板：M-03、M-07、M-11、ooxml-pptx、slide-ui」，批次 3 图 m02/m04/m06/m10→m13 改实线、m03/m07 保留虚线；13 §0:14、:41 与图 0-1 按贡献点定义方分边（core.* 来自 M-02、render.* 来自 M-06、ui.* 来自 M-10、ooxml-core 来自 M-04）；README:54 同步。 |
| 32 | FE-17 | 13 把上下文键 unitType 当成贡献点 | low | — | charter.md:645（贡献点 id 封闭清单无 ui.contextKey）、:643（服务名无 scenes/docs/sheets）；30-architecture/03-kernel-and-plugin-model.md:309（unitType 是 when 子句上下文键）；40-modules/07-slide-rendering.md:356（slide-render inject 样板） | 13 §3:241-242 doc-ui/sheet-ui 的「贡献点：消费」改为「无（when 子句读取 ui-core 上下文键 unitType）」，图 3-1 pKey 节点改为上下文键并以虚线「when 读取」连接；:239-240 doc-render/sheet-render 的 inject 改为根级 ['contributions']、unitPlugins ['render','layout','store']，「消费 render.target」删去；注明领域读服务需要时再在章程 §5.5 登记 docs/sheets；16 G-13 结案。 |
| 33 | FE-18 | 架构 07 写 render-dom 依赖 design | low | — | charter.md:511 规则 2 rank(to) ≤ rank(from)（L5 不得依赖 L7）；charter.md:317 render-dom 依赖上限「engine-render, engine-layout」 | 30-architecture/07:265 deps 改为「@cordexjs/engine-render @cordexjs/engine-layout」，覆盖层主题色直接写 CSS 变量名字符串；:74 图注删冲突说明。 |
| 34 | FE-19 | ooxml-pptx 导出文件补 model-slide 依赖 | low | — | 40-modules/04-ooxml-format-and-pptx-codec.md:300（encode 以 model-slide 的 PresentationBody 为输入）与 §0:14；charter.md:310（ooxml-pptx 上限含 model-slide） | 04 §5.2:818-824 各导出文件「允许依赖」补 model-slide（类型）；图 4-2 加 infraExport-->modelSlide，:638 怎么读改为「导入、导出两侧都读 model-slide 类型，ACL 仍然单向」。 |
| 35 | FE-20 | 11 图表可编辑类型仍为三类 | low | — | rulings-2026-09-14.md:246 U-06（可编辑类型扩为 bar/line/pie/area/scatter 五类） | 11 §3.1:320 默认配置列改为「无（沿用 slide-render-chart 默认：bar、line、pie、area、scatter）」，默认值只在 07 §3 一处定义。 |
| 36 | BE-14 | renderer 只装精简健康探针、不装 Metrics | low | — | adr/0037-deployment-topology-and-packaging.md:52-53（renderer 只挂 render 网络且零出站，Prometheus 抓不到）、:28（renderer 不装任何含凭据模块）、:73（M3 出口健康探针全部就绪） | 40-modules/12 L895、L900 改为：HealthModule 装 api/collab/worker/all，renderer 装 HealthModule.forRole('renderer') 变体（只 /healthz 与 Chromium 池就绪，不 import DbModule/RedisModule/CordisHostModule）；MetricsModule 装除 renderer 外全部角色，渲染耗时/超时/崩溃指标由 worker 侧 remote-renderer.client 记录；§3 HealthModule 行注明变体；ADR-0037 决策 1 renderer 行补「精简健康探针（容器内、无凭据）」；renderer 中 ObservabilityModule 关闭 OTLP、日志只写 stdout；12 图 3-2 同步；启动断言 role=renderer 时进程内无 DB/Valkey/S3 客户端。 |
| 37 | BE-16 | share_links 清理以「已纳入」为准 | low | 调用方式随 BE-15 | rulings-2026-09-14.md:268 S-2（各自执行 purge 用例，谁的表谁写）；40-modules/08:572、:760 已定稿该用例；40-modules/08:387 编排经订阅不构成 DI 反向依赖 | 40-modules/08 L881 删「share-links 模块在依赖图中只被…纯数据卫生问题）」整句，改为「share_links 由 share-links 模块自己的 purge 用例完成清理」（调用方式随 BE-15 结论）；L1004 G-20 删「已知缺口见 §7」括注；19 §9 第 4 条后半与图 6-16 同步。 |
| 38 | BE-20 | RLS 表清单误列「S-3 溢写行」 | low | — | rulings-2026-09-14.md:269 S-3（溢写落 Redis 与对象存储 BlobStore）、:301 S-3a | ADR-0022 L78 与图 2 L91 删「S-3 溢写行」，L79 后补「S-3 溢写数据不在 PG 中（存于 Valkey 键与 spill/ 对象前缀），不受 RLS 约束，只有 collab 角色的系统上下文可读写；回放写回 document_updates 时仍经 RLS 的系统作业角色」；图 2 怎么读同步；40-modules/01 check-rls-coverage 表清单不含 spill。 |
| 39 | BE-21 | documents.epoch 的写方为 M-09 | low | — | rulings-2026-09-14.md:273 §4.13（head_seq/epoch 写入方收紧为 M-09，仓储入参类型排除这两列） | 40-modules/08 L887 归属改为「M-09（server-collab 的 collabServer.forceEpoch() 递增并踢出会话）；触发入口为 M-12 internal/admin.controller.ts 的 …/epoch 端点，本模块不写」；L121 补「写入由 M-09 执行」。 |
| 40 | BE-22 | 改文档权限的主体是所有者 | low | — | 40-modules/08:74、:187（ROLE_CAPABILITIES 权威定义；PRD 03:29 指定、rulings:250 U-09 确认） | 30-arch/01 L260 节点改为「权限变更：文档所有者（doc.manage）把某人改为只读」，怎么读同步。 |
| 41 | BE-23 | 权限 REST 动词为 PUT/DELETE | low | — | 30-architecture/08-backend-nestjs.md:192 与 40-modules/08:848（REST 端点清单定稿，06 §10 只是引用） | 30-arch/06 L863 改为「REST PUT 或 DELETE /documents/:id/permissions」。 |
| 42 | BE-24 | 墓碑 TTL 配置键统一为 ttlHours | low | — | rulings-2026-09-14.md:329 §4.17 → _evidence/review-2026-09-24.html:251 L10（键名统一并写入 08 配置表）；30-architecture/08:1 文件头与 40-modules/09:67 定为 tombstone.ttlHours | 30-arch/08 L162 改为 tombstone:{ttlHours:24}（保留「与 40-modules/09 同键」括注）；30-arch/04 L325 判定式改为「_deleted.at + ttlHours &lt; now」；排查 PRD 06 SV-11 与 30-arch/11 残留（LeaseLock.acquire 的 ttlMs 参数不改）。 |
| 43 | BE-25 | SQL 补评论 anchor_key 与 baseline_key 列 | low | — | rulings-2026-09-14.md:273 §4.13（评论锚点索引改文档类型无关方案）；30-architecture/08:1013 §16.2（:996 声明以本节为准）；40-modules/14:453 M-09/G-16 采纳→回写 | 30-arch/08 §5：comments 增 anchor_key text not null（comment-mirror 写入时调 deriveAnchorKey 计算，非 PG GENERATED 列），索引改 (doc_id, anchor_key)；document_snapshots 增 baseline_key text null（仅 kind='import' 有值）；ER 图 ①② 同步；40-modules/12 L224「生成列」改「派生列（应用层计算）」。 |
| 44 | BE-26 | 缩略图 source 保留 client 位 | low | — | adr/0026-headless-rendering-and-thumbnails.md:18（已接受：client 为保留位，M1–M3 不写入，保留枚举免改约束） | 30-arch/08 L542 改为 check in ('embedded','server','client') 并注「client 为保留位，M1–M3 不写入（ADR-0026 决策 4）」；40-modules/12 L77、L114 领域类型维持 'embedded'\|'server'，措辞改为「DB 约束保留 client 位，领域层不产生该值」。 |
| 45 | BE-27 | db/schema 目录与数据模型对齐 | low | 表集合随 BE-31 | rulings-2026-09-14.md:304 Q6（API Key 降 M4）；30-architecture/08-backend-nestjs.md:494 同文定稿句；§5 SQL 为数据模型定稿 | 30-arch/08 L220 改为 schema/{users, user_identities, documents, document_user_marks（BE-31）, document_updates, document_snapshots, media_blobs, document_media, permissions, document_perm_versions, share_links, comments, thumbnails, job_runs, audit_log, webhooks（subscriptions + deliveries）}.ts；删 api_keys.ts 并注明 M4 再加；collab_sessions 按 BE-31 删除。 |
| 46 | BE-28 | 队列表并发改为 4/实例 | low | — | 30-architecture/08-backend-nestjs.md:996（§16 优先）与 :1038；40-modules/14:455 M-12/G-29「直接删除 §7 旧数字」采纳→回写 | 30-arch/08 L681-682 改为「并发 4/实例（部署可调）」；删 §16.5 括注「§7 表中的 2 作废」与队列图怎么读中对应句。 |
| 47 | BE-29 | 「实例内存预算」定义 | low | — | 30-architecture/08-backend-nestjs.md:996（§16 优先）与 :1035（≤75% 内存预算）；定稿配置 memoryAdmissionPct:75（30-arch/08:262、40-modules/09:183） | 06 §14 表与图、ADR-0035 修订 §2、08 §8 L800 的「实例内存预算」加括注定义为「容器内存上限（cgroup 限额，Node process.constrainedMemory()；无限额取物理内存）× room.memoryAdmissionPct（默认 75，部署可调）」；08 L162 room.weightBudgetBytes 删去或降为可选绝对覆盖值；PRD 06:219 括注改为「作废的是按 RSS 判定的方式，75% 作为权重预算比例保留（memoryAdmissionPct）」。 |
| 48 | CO-01 | ADR-0021 回退规则顺序措辞 | low | — | adr/0021-rendering-medium.md:72「按序执行」编号 ①②③ 与图 2（:80-90）「自上而下按序执行」（已接受 ADR）；旁证决策包 Q4 复核子决策句序 | ADR-0021:72 ② 改为「仍不达标，再考虑静态层栅格化（SVG/DOM 路线内的最后手段：会碰上 Web 字体问题并破坏一元素一 DOM 节点）」，:87 图 2 节点同步；07-rendering.md:84 改为「先做合成层优化（独立合成层、content-visibility、减少滤镜与 &lt;tspan>）；仍不达标再做静态层栅格化；仍不达标才只在查看/放映启用 canvas」并注依据 ADR-0021 修订 2（与 CO-02 同句一次改完）。 |
| 49 | CO-02 | 07 §1 仍把 200 ms 首帧当独立口径 | low | — | adr/0021-rendering-medium.md:71、:58（已接受，修订 1：200 ms 降为引擎内部分解目标，对外只有 DX-1000） | 07-rendering.md:84 末句改为「≤200 ms 只是引擎内部分解目标（场景构建 + 首次挂载），不作门禁；对外门禁只有 DX-1000：首页可见 ≤2.5 s、交互 ≥30 fps（ADR-0021 修订 1）」；07 §9、§14.6 与 11 门禁表已核对无需改。 |
| 50 | CO-11 | 跳转未解析页须提升 Worker 解析队列 | low | — | 10-prd/03-features/01-open-and-fidelity.md:269（该页优先解析）；30-architecture/07-rendering.md:721（未解析页 ≤300 ms、已解析页 ≤100 ms 两档） | 07 §14.2 图改为三步：M->>W prioritize(slideId)、W 完成当前页后先解析该页所在批次、M 把已解析未装载批次提到装载队首；正文补 prioritize 消息定义（与 CO-12 的 Worker 归属一起落到 M-02/M-04）；11-testing-strategy.md:333 打开管线用例补「已解析未装载页 ≤100 ms」。 |
| 51 | CO-17 | 房间准入先于 bootstrap | low | — | 30-architecture/06-collaboration.md:988-993（先权重准入再新建 Room 进入 loading）；30-architecture/08-backend-nestjs.md:503（element_count 供房间权重准入） | 40-modules/09:396 怎么读改为「按 06 §14：先准入后 loading；权重取 documents.element_count，不需预加载」；图 2-5 把 admitByWeight 移进「Room 不存在」分支，已有 Room 只做名额判定；09:328「加入房间」行补准入步骤。 |
| 52 | CO-19 | 07 §0–§5 v0.1 渲染术语换名（并入 BE-32 的 Provider 名） | low | — | 30-architecture/07-rendering.md:685 与 :689-697 对照表（签名以 02/04 为准，冲突以本节为准）；40-modules/06:15；adr/0027-text-measurement-strategy.md:43 同文定稿句（Provider id canvas/node-font/fixed） | 07 §0–§5、§7 正文、代码块、目录树与图统一换名：PageRenderer→SceneProvider、CompositeSlide→Scene/SceneNode、DirtyRegion→DirtySet、ElementInstance.update→ElementRenderer.update(handle, node)、mount→render、Measurer→TextMeasurer（Provider key canvas、node-font、fixed）；07:409、ADR-0027:18、:62 的 fontkit 改 node-font，fontkit 只作「以 opentype/fontkit 解析字体文件」的实现说明（原 BE-32）；§14.1 表保留作旧名对照；PageView/LayerHandle 注明为 render-dom 内部实现名；40-modules/06:231、:841，00:149、:391，07:508、:651 同步。 |
| 53 | CO-20 | softGate（P8）已裁决 | low | — | rulings-2026-09-14.md:96 §4.1 P8（采纳 ADR-0034：repair 不变量 + report-only schema） | 06:915 删「是否执行仍待 P8 裁决」改为「已裁决（rulings §4.1 P8）」；06:1021 P8 行标结案；06:1106 与 ADR-0034:52「待总编排裁决」改为「已裁决：rulings §4.1 P8」；40-modules/09:1094 保留。 |
| 54 | UX-04 | 横幅「唯一不可关闭」与隔离态冲突 | low | 「登录已过期」一项待 UX-02 | 20-design/03-screens/12-offline-conflict-banner.md:210（隔离态不可关闭）与同文件 :53 | 12:125 括注改为枚举不可关闭的横幅：权限降级（导出前）、访问权限已变更（阻断）、隔离态（刷新前）；若 UX-02 按推荐定稿，再加「登录已过期（处理前）」。 |
| 55 | UX-09 | 流程总览补评审模式发起导出/历史 | low | — | 20-design/03-screens/02-editor-main.md:136（评审应用栏右侧同编辑模式，含 ⋯）；20-design/01-information-architecture.md:196 | 02-user-flows 流程总览图补 review-->sideOps（需 doc.export 或 doc.history.read）与 sideOps-->review；:458 改为「F6/F8 可从编辑或评审模式发起（按能力位），完成后回到发起时的模式」；放映部分维持现图。 |
| 56 | UX-10 | 混合值统一显示「多个值」 | low | — | 20-design/03-screens/03-properties-panel.md:69（统一显示多个值，不再用「—」）；40-modules/10-ui-shell-and-slide-ui.md:623 MixedValueField | 16:59 图文案与 :78 正文改为「多个值」；PRD 07:251、:266 与 PRD 02-editing:212 同步；Ribbon 字体字号控件用 MixedValueField 占位样式。 |
| 57 | UX-11 | 评审模式本无「视图」页签 | low | 母版中切评审待 UX-20 | 20-design/01-information-architecture.md:184（评审 Ribbon 替换为单行评审工具条）；20-design/playground/src/routes/editor/Main.tsx:175-182（评审态只渲染评审工具条）；rulings:181 Q12 措辞同时覆盖无 Ribbon 的放映，只能读作概括 | 20:92 拆两行：「评审模式 → 视图页签不存在；Mod+Alt+M 无效；命令面板「母版视图」禁用并注明评审模式不可用」与「编辑模式已降权 → 按钮禁用，tooltip「需要编辑权限」」；:99-118 判定图 q0 改「放映或评审模式？」、q1 改「有 doc.write？否 → 已降权：按钮禁用」；02-editor-main:136、02-user-flows:422、01-IA:226 对评审改为「视图页签不存在」并把降权单列；40-modules/10:157、:256 masterEntryState 'review' 保留；母版中切评审见 UX-20。 |
| 58 | UX-18 | 协作者离开后头像移除时机 | low | — | 30-architecture/06-collaboration.md:772、:794-795（会话断开即主动广播移除，30 s 为 awareness 超时兜底）；10-prd/03-features/03-collaboration.md:73（关闭 Unit 时优雅 leave） | 02 F3 离开图拆两支：「主动离开/服务端检测到断开 → 立即移除头像与远端光标」与「静默失联 → 最迟 30 s 移除」，删离开链路中的「60 秒无活动先灰显」与「避免网络抖动」，空闲灰显另起一句；PRD CO-03:91 改为「断开即移除；静默失联最迟 30 s 移除（awareness 超时）」；05 §1 不变。 |
| 59 | GV-09 | 文档地图与章程 §8 文档树过期 | low | — | 40-modules/README.md:15–22（阅读顺序含 18/19）；docs/_tools/README.md:1（文档站取代评审站，新增 capture-screens.cjs）；docs/README.md:19（原型已退役）；文件系统实况 | docs/README.md 阅读顺序重编号（1–8），第 7 条改为「先读 00，再翻 18/19 图集，然后按 40-modules/README 顺序读」，:31 改为「设计条线（playground/ 为设计基准；prototype/、mockups/ 已退役）」，:33 补「18/19 架构图集」，:34 改为「文档站生成器（gen-docs-site.py）与界面截图（capture-screens.cjs）」，状态头补 2026-09-25 记录；charter §8 文档树补 00-charter/_evidence/、10-prd 03-features/07、08 与 07/08/09 三份、20-design 08–12 与 mockups/、40-modules 15–19、docs/_tools/，每项一行说明（「30 个 BC」随 GV-10）。 |
| 60 | GV-10 | BC-30 进入前后端切分表与各处区间 | low | — | rulings-2026-09-14.md:271 S-5（webhooks 登记为 BC-30）；40-modules/00-module-map.md:173（编号 BC-01…BC-30）、:796–797（BC-30 卡片：同构类 node、运行位置服务端） | 00:1056 改为「BC-18…26、BC-30（Nest 模块）\| — \| 仅服务端 \| —」；:1081 g10 改「BC-18 至 BC-26、BC-30 Nest 模块」；删 :1094「BC-30 未列入上表」一句；:884 改「BC-18…26 与 BC-30 是 Nest Module」；:1388 行首改「BC-18…20/22…26、30」；README.md:55 改「全部 30 个 BC」；charter.md:771 改「30 个限界上下文」。 |
| 61 | GV-11 | 扫描器计数与编号随 D3 更新 | low | — | rulings-2026-09-14.md:335 D3（doc-access-via-permission 为第 14 个）；09-type-discipline/06-scanners.md:7；40-modules/01:770（horizontal-freeze 纳入后为 15、06 §19）；40-modules/14:723 R-17 路径 tooling/scripts/ | 13:819 路径改 tooling/scripts/scan-horizontal-freeze.ts，括注改「当前不计入 14 个现有扫描器，纳入后为第 15 个（需追加 06 §19）」；00:749「十三个」改「十四个」；00:1195「十三个」改「十四个」、§18 改 §19；17:914 改「14 个扫描器全表」；14:485、:616 追加 D3 行内标注；14:683、:742 历史快照与 06:70、07:103、07:126（scanners job 实跑 13 个，正确）不改。 |
| 62 | GV-12 | 需求标签扫描加入 pre-commit | low | — | 09-type-discipline/07-hooks-and-ci.md:47（hook 阶段以 06 各节标注为准）；09-type-discipline/06-scanners.md:286（§12 scan-requirement-tags 为 pre-commit，&lt;3 s） | 07 §2.1 表加步骤 7「scan-requirement-tags（见 06 §12），失败即阻断」、流程图加 pc7；:35「其余六个扫描器」改「其余十一个扫描器（需要整包视图或构建产物）」；:47「八个扫描器中」改「十四个扫描器中」；02:119 随 GV-13 改为指向 07 §2。 |
| 63 | GV-19 | Store 契约套件 Compliance 旧名 | low | — | charter.md:646（契约套件命名 run&lt;Definition>Conformance，如 runDocumentStoreConformance）；30-architecture/11-testing-strategy.md:99（Provider 的 __tests__/conformance.test.ts） | 09-plugin-type-contracts.md:154、:163、:164、:169 改 runDocumentStoreConformance，:162、:181 改 conformance.test.ts，:177、:204「合规套件」改「契约套件」；06-scanners.md:183 规则 (e) 举例、04-api-surface.md:72 同改；17-plugin-authoring-patterns.md:191 文件名改 conformance.test.ts。 |
| 64 | GV-20 | 架构正文与 ADR 其余契约套件旧名（并入 BE-32 的套件名） | low | — | charter.md:646；30-architecture/02-layering-and-packages.md:318（总编排裁决命名）；30-architecture/08:1002（blobStore）；40-modules/14:431、:443、:181–185 采纳→回写；30-architecture/11:99（每个 Definition 一套） | 11 §3 表：collab 行改 runCollabTransportConformance + runOfflineStoreConformance；engine-render 行删 runElementRendererConformance（暂不落地，M-06 G-8）；Measurer 行改 TextMeasurer/runTextMeasurerConformance；BlobStorage 行改 BlobStore/runBlobStoreConformance；server-collab 行改 runUpdateStoreConformance、runSnapshotStoreConformance、runSpillStoreConformance、runCollabServerConformance、runFanoutBusConformance、runLeaseLockConformance；06:412、:471，07:246、:392（删 ElementRenderer 套件）、:474，08:316–317（MemoryBlobStore）同步；ADR-0022:102（记变更「措辞对齐章程 :646」）、0023:106、0033:73、0027:62 同步；40-modules/16:186、07:702 同步；09 §2.5 补 FanoutBus、LeaseLock 两套契约套件并关闭 16 G-6 对应部分。 |
| 65 | GV-21 | 07 头部残留旧层号 L6 | low | — | charter.md:670 D14（垂直束用层带 V-*）；30-architecture/02-layering-and-packages.md:60 | 07-rendering.md:6「§5.2 L5/L6 包边界」改为「§5.2 L5/V-render 包边界」；01-overview 不改。 |
| 66 | GV-23 | 状态图标签 role&lt;editor 渲染被截断 | low | 检查项随 GV-04 | 40-modules/05-collaboration-client.md:153 源码原文 role&lt;editor（同图 :154 role>=editor 与同节 :167 映射表互证）；mermaid 11.16.1 strict 实测渲染后「&lt;editor)」被净化吞掉 | 05:153 改为 live --> readonly: CONTROL.permission(role#60;editor)；随 GV-04 在 mermaid-check 增加「标签内 &lt; 后接字母即报错」，改完全仓应为 0 处。 |
| 67 | GV-07 | 40-modules 索引「行数」列重算（最后执行） | low | 最后执行 | 40-modules/README.md:40 表头「行数」以 wc -l 实测为准；docs/_tools/README.md:35（文档站自动统计行数） | 本轮全部修正落地后最后一步：用 wc -l docs/40-modules/*.md 重算 README.md:42–61 行数列（00–19 全部），状态头注明「行数按 wc -l 重算」；不新增校验脚本。 |

## 四、剔除清单

- **FE-03**：与 BE-04 同题（/render 状态拉取端点去留），合并入 BE-04 决策（保留更完整的 BE-04）。
- **FE-10**：RenderPageState 的 fetchingState 改名已写入 BE-04 选项 1 的影响（改为 awaitingInject）；若 BE-04 选保留兜底则改为中性的 awaitingState，随 BE-04 一并执行。
- **CO-04**：与 UX-03 同题（离线判据 30 秒 vs 6 次）；已接受的 ADR-0029:93 用 30 s、架构 06 正文用 6 次，无干净权威，由 mechanical 改判并合并入 UX-03 决策。
- **BE-17**：与 CO-08 同题（PG 故障期是否广播），合并入 CO-08，其「超时溢写后广播」方案并入 CO-08 选项「先溢写再广播」。
- **BE-33**：与 CO-09 同题（ackUpTo 入参应为 localSeq），合并入 CO-09。
- **BE-34**：与 GV-16 同题（RLS 与 renderer 安全测试运行时机），合并入 GV-16 默认值。
- **BE-32**：拆分合并——fontkit→node-font 并入 CO-19，runMeasurerConformance→runTextMeasurerConformance 并入 GV-20（ADR-0027:18、:62 已补进两者修正计划）。
- **BE-35**：not-an-issue——renderer 不持有 DB/S3 凭据（ADR-0026 决策 1）即决定由 worker 写存储，与 08 §3.3、12 图 2-4 一致；可选在决策 3 末尾补半句。
- **BE-36**：resolved——06 §5.3 的 HTTP 请求已改为 apps/server REST 参与者；若 BE-03 定快照挂 collab，顺带在怎么读补一句归属。
- **UX-08**：resolved——F3 presence 经 server-collab awareness-relay 转发与架构 06:780-790 一致。
- **UX-15**：not-an-issue——人物场景是叙事文本，不需转 Mermaid，内容与现行裁决一致。
- **GV-01**：resolved——上一轮已统一引号口径（sequenceDiagram/stateDiagram 标签不加引号），全仓 548 张图扫描 0 违规；规范入库随 GV-04。
- **GV-02**：not-an-issue——时序图消息里的 tier:'db' 等单引号是协议字面量原文，不受绘图引号规则约束。
- **GV-03**：not-an-issue——复核 agent 的自查记录，无相互矛盾说法。
- **GV-06**：resolved——40-modules/README 状态头已改为 222 张图，与实测一致。
- **GV-22**：not-an-issue——Fiber 状态图的 LOADING/DISPOSED 来自 cordis rc.10 实际导出状态，与 cordis-primer 一致。
- **raw #91**：补图 agent 的校验状态报告（548 张图 0 错误、156 页构建通过），不是矛盾。

## 五、建议执行顺序

1. 按轮次拍板 15 个决策（第 1 轮安全与部署 → 第 2 轮包架构与治理 → 第 3 轮删除与故障期协同 → 第 4 轮会话与界面）。
2. 一次性确认 23 条默认值（可整体接受，个别改动时逐条说明）。
3. 执行无依赖的机械修正（可按文档目录并行分派）。
4. 按拍板结果执行有依赖的机械修正与决策 fixPlan。
5. 最后执行 GV-07（行数重算），跑 mermaid-check 与 validate-module 复核。
