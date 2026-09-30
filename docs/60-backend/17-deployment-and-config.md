# 17 部署拓扑与配置 schema
> 状态：v0.1 | 负责：后端设计线 | 更新：2026-09-25；2026-09-25（§4.19）；2026-09-26（§4.20）；2026-09-26（§4.21：collab 反代改为按 documentId 一致性哈希；新增 `collab.hocuspocus.*` 与 `limits.ws.*` 五个键，`firstFrameTimeoutMs` 语义改为认证期限；XML 限额改引用 ADR-0019；镜像版本锁表；OTel 预加载入口；cron 子命令）；2026-09-26（§4.21 整合：§5.7 collab.persist.flushMs / batchMax 改为空闲即刷的上限；§12 CFG-05 写明失败条件；§5.14 废止键补环境变量名；§3.2 登记 M4 RTL 的 shaping 开关与 wasm-unsafe-eval 下发预留）；2026-09-26（§4.21 Remap：原 30/08 引用按 60-backend/README §6.1 改指新位置，30/08 已删除）；2026-10-01（§4.23 插件管理：新增 §5.16 插件配置键与声明文件格式、web 容器 /plugins/{sha256}/ 静态路径与变量、ops 命令 plugins:check、CFG-06） | 依赖：[ADR-0037](../30-architecture/adr/0037-deployment-topology-and-packaging.md)、[ADR-0022](../30-architecture/adr/0022-server-storage.md)、[ADR-0030](../30-architecture/adr/0030-observability-stack.md)、[01](./01-service-overview-and-roles.md) §0、§4（原 30/08 §10）、[40/12 §4.13](../40-modules/12-server-jobs-comments-and-ops.md)、[rulings §4.15 Q2·Q5·Q9·Q10 / §4.16 Q17·Q19 / §4.18 / §4.21](../00-charter/rulings-2026-09-14.md)、[ADR-0039](../30-architecture/adr/0039-collab-server-hocuspocus.md)、[ADR-0019](../30-architecture/adr/0019-xml-lexer-and-fidelity-tree.md)、[19](./19-reuse-and-dependency-catalog.md)、[01](./01-service-overview-and-roles.md)、[08](./08-db-conventions-roles-rls-migrations.md)、[14](./14-valkey-object-storage-and-retention.md)、[50/14](../50-frontend/14-client-security.md)

> 读者：运维、写 `apps/server/src/config/**`、Dockerfile 与 compose 的工程师。
> 本文是**配置 schema 全字段表**（§5）的唯一源，也是 compose、web 容器、镜像、迁移作业与备份的部署事实源。进程角色的模块装配矩阵在 [01](./01-service-overview-and-roles.md)；CSP 策略正文在 [50/14](../50-frontend/14-client-security.md)，本文只负责「每响应生成 nonce 并下发」；RuntimeConfig 的字段在 [50/02](../50-frontend/02-app-shell-routing-and-session.md)，本文只负责「启动时渲染进 index.html」。

## 0. 本文拥有与引用

| 本文拥有 | 本文引用 |
|---|---|
| compose 服务、profile、网络、卷；web 容器的路径分流、子域、安全头、缓存头、nonce 生成 | CSP 策略正文、Trusted Types：[50/14](../50-frontend/14-client-security.md)；RuntimeConfig 字段：[50/02](../50-frontend/02-app-shell-routing-and-session.md) |
| 镜像构成、字体包、digest / SBOM / 许可门禁的产物形态 | 许可白名单与门禁判定：ADR-0037 决策 2、6；执行：[70/08](../70-testing/08-deployment-and-environment-e2e.md) |
| 配置 schema 全字段表、环境变量命名、机密来源、角色 × 机密矩阵、启动校验 | 模块装配与启动断言：[01](./01-service-overview-and-roles.md)；保留期语义：[14 §8](./14-valkey-object-storage-and-retention.md) |
| 迁移作业与 ops 命令的入口、升级步骤、备份恢复、主机规格口径 | 迁移纪律：[08 §10](./08-db-conventions-roles-rls-migrations.md)；探针与告警：[18](./18-observability-and-ops-endpoints.md) |

## 1. 交付形态

依据：ADR-0037 决策 1–7；rulings §4.15 Q9 / Q10。

- M1–M5 只交付**集成方或自有部署的 docker-compose 洁净栈**，不自营 SaaS；一次部署 = 一个组织（T-0）。
- 自建镜像三个：`cordex-server`（`CORDEX_ROLE` 选择 `all`、`api`、`collab`、`worker`）、`cordex-server` 的 `renderer` 构建目标（`CORDEX_ROLE=renderer`，§4）、`cordex-web`（静态前端 + 反向代理，§3）。同一版本号一起构建、一起发布。
- compose 默认 `CORDEX_ROLE=all` 单进程；拆分部署按 §8。
- **M4 P1**：Helm chart（按角色拆 Deployment）、离线安装包（镜像 tar + 字体包 + SBOM + 校验和）、amd64 / arm64 多架构镜像；不进 M3 出口。

## 2. compose

### 2.1 服务清单

| 服务 | 镜像 | profile | 网络 | 卷 / 挂载 | 说明 |
|---|---|---|---|---|---|
| `web` | `cordex-web` | 默认 | edge、backend | TLS 证书（只读） | **唯一开宿主端口的服务**（443，另 80 只做跳转）；backend 网络只用于 `idp.`、`s3.` 两个子域转发，并在 backend 上登记网络别名 `idp.<域名>`，供应用做 OIDC 发现与取 JWKS |
| `app` | `cordex-server`，`CORDEX_ROLE=all` | 默认 | edge、backend、render | 机密目录、`fonts.extraDirs`（均只读） | 出站只有两类：Webhook 与外部 IdP 经 edge；内置 Casdoor 时 OIDC 发现与 JWKS 经 web 在 backend 上的别名 `idp.<域名>`，不出宿主（ADR-0037 决策 3） |
| `migrate` | `cordex-server`，命令 `cordex-ops db:migrate storage:init` | 默认 | backend | 机密目录 | 一次性；`app` 以 `service_completed_successfully` 依赖它 |
| `ops-cron` | `cordex-server`，命令 `cordex-ops cron` | 默认 | backend | 机密目录 | 常驻进程，按内置时刻表（croner）每日执行 `audit-rotate`（§9）；只读根文件系统、无端口 |
| `renderer` | `cordex-server` 的 renderer 目标 | 默认（M3 起） | **只有** render | `fonts.extraDirs`（只读） | 零出站、无凭据、非 root、`--shm-size` 而非 `--ipc=host` |
| `postgres` | `postgres:18` | 默认 | backend | `pg-data`；初始化钩子（只读） | 初始化钩子执行 0001、设置三个角色口令、建 `casdoor` 库与角色（§9） |
| `valkey` | `valkey/valkey` 9.1.2（§4.1） | 默认 | backend | `valkey-data` | `--appendonly yes --appendfsync everysec --maxmemory-policy noeviction`（[14 §1](./14-valkey-object-storage-and-retention.md)） |
| `seaweedfs` | `chrislusf/seaweedfs` 4.47（§4.1） | 默认 | backend | `seaweedfs-data` | S3 网关 8333；两个桶由 `storage:init` 建立 |
| `otel-collector`、`jaeger`、`prometheus` | 各官方镜像 | 默认 | backend | — | Apache-2.0；默认告警规则随 compose 提供（ADR-0030 决策 7）；Collector 另配 spanmetrics connector，把产品事件 span 转成 Prometheus 指标（[18](./18-observability-and-ops-endpoints.md) §9.2） |
| `node-exporter` | `prom/node-exporter` | 默认 | backend | 宿主 `/proc`、`/sys`、根文件系统（只读） | Apache-2.0（rulings §4.15 Q10 许可白名单）；PRD SV-10 默认告警含「磁盘 > 85%」，需要宿主磁盘与内存指标；只被 Prometheus 抓取、不开宿主端口 |
| `casdoor` | `casbin/casdoor` v4.10.x（§4.1） | `idp` | backend | — | 使用同一 PG 实例的 `casdoor` 库；未启用时必须配置外部 issuer |
| `grafana`、`loki` | 各官方镜像 | `observability-agpl` | backend | — | AGPL-3.0，启用时打印许可提示 |
| `mock-oidc` | `oidc-provider` mock | `dev` | backend | — | 仅开发与 CI；web 容器在 dev 下把 `idp.` 子域指向它 |

全部镜像以 `@sha256:` digest 引用（§4）。容器一律：非 root、只读根文件系统（需要写的路径用 tmpfs）、`no-new-privileges`、丢弃全部 Linux capability。

### 2.2 profile 与网络

- profile：**默认**（`docker compose up`）；`idp`（Casdoor）；`observability-agpl`（Grafana、Loki，显式开启）；`dev`（mock-oidc）。
- 网络：`edge`（对外，普通 bridge）；`backend`（`internal: true`）；`render`（`internal: true`，只有 `app` / worker 与 `renderer`）。Casdoor 与 SeaweedFS 不开宿主端口，浏览器只能经 web 容器的子域到达（rulings §4.18 BE-01）。
- 卷：`pg-data`、`valkey-data`、`seaweedfs-data`；机密目录以只读 bind mount 挂入，文件权限 0400、属主为容器用户。

**图 2-1 compose 拓扑：服务、网络与 profile**

```mermaid
flowchart LR
  browser["浏览器"] --> web
  subgraph edgeNet["edge 网络：对外"]
    web["web：静态前端 + 反向代理，唯一宿主端口"]
    app["app：CORDEX_ROLE=all"]
  end
  subgraph backendNet["backend 网络：internal"]
    pg[("postgres:18，卷 pg-data")]
    vk[("valkey：noeviction + AOF")]
    sw[("seaweedfs：data 与 snapshots 两个桶")]
    obs["otel-collector、jaeger、prometheus、node-exporter"]
    once["migrate 一次性作业与 ops-cron"]
    casdoor["casdoor：idp profile"]
  end
  subgraph renderNet["render 网络：internal"]
    renderer["renderer：零出站、无凭据"]
  end
  web -- "/api、/collab" --> app
  web -- "idp 子域，保持 Host" --> casdoor
  web -- "s3 子域，保持 Host" --> sw
  app --> pg & vk & sw
  app -. "OTLP 与抓取" .-> obs
  app -- "签名 RPC" --> renderer
  once -- "cordex_migrator" --> pg
  casdoor -- "独立 casdoor 库" --> pg
  app -. "经 edge 出站：OIDC 发现、Webhook" .-> ext["外部 IdP 与 Webhook 目标"]
```

怎么读：方框分组是 compose 网络；实线是网络内调用，虚线是观测与出站。web 是浏览器唯一入口，按路径转给 app、按子域转给 Casdoor 与 SeaweedFS；renderer 只挂 render 网络，任何出站都不可达。`observability-agpl` 与 `dev` profile 默认不启动，图中不画。
依据：ADR-0037 决策 2–4；rulings §4.18 BE-01、BE-11、BE-14。

### 2.3 compose 骨架

```yaml
# 节选：镜像一律 @sha256 引用；完整文件随发布件提供
networks:
  edge: {}
  backend: { internal: true }
  render: { internal: true }
x-hardening: &hardening
  read_only: true
  security_opt: ["no-new-privileges:true"]
  cap_drop: ["ALL"]
services:
  web:
    <<: *hardening
    image: cordex-web@sha256:…
    ports: ["443:8443", "80:8080"]
    networks:
      edge: {}
      backend: { aliases: ["${CORDEX_WEB_IDP_HOST}"] }   # idp.<域名>：应用经此别名访问内置 Casdoor 的对外 issuer
    env_file: [web.env]
  migrate:
    <<: *hardening
    image: cordex-server@sha256:…
    command: ["cordex-ops", "db:migrate", "storage:init"]   # 多个子命令按序执行，首个失败即退出
    networks: [backend]
    depends_on: { postgres: { condition: service_healthy }, seaweedfs: { condition: service_healthy } }
  app:
    <<: *hardening
    image: cordex-server@sha256:…
    environment: { CORDEX_ROLE: all }
    env_file: [server.env]
    volumes: ["./secrets:/run/secrets/cordex:ro"]
    networks: [edge, backend, render]
    depends_on: { migrate: { condition: service_completed_successfully } }
    stop_grace_period: 40s
  renderer:
    <<: *hardening
    image: cordex-server@sha256:…   # renderer 构建目标
    environment: { CORDEX_ROLE: renderer }
    volumes: ["./secrets/render-verify.pub:/run/secrets/cordex/render-verify.pub:ro"]
    networks: [render]
    shm_size: 1gb
  valkey:
    image: valkey/valkey@sha256:…
    command: ["valkey-server", "--appendonly", "yes", "--appendfsync", "everysec", "--maxmemory-policy", "noeviction"]
    networks: [backend]
    volumes: ["valkey-data:/data"]
```

## 3. web 容器

依据：决策 CSP-NONCE（rulings §4.15 Q2「CSP nonce M2」+ §4.18 BE-11「其余静态文件由 web 容器提供」+ 原 30/08 篇 §10.1）、RUNTIME-CONFIG、VERSION-DRIFT-SW、INC-25（Referrer-Policy）。基础镜像 `nginx-unprivileged`（非 root，监听 8080 / 8443）。

### 3.1 路径与子域分流

「哪条路径进哪个角色」以 [01 §7](./01-service-overview-and-roles.md) 为准；本表在其上补 nginx 实现要点（体积上限、超时、透传头、日志）。

| 主机 / 路径 | 去向 | 要点 |
|---|---|---|
| `<host>/internal/*`、`/metrics`、`/healthz`、`/readyz` | **404** | 内部端点与探针不对外；编排器在 backend 网络直接探测应用 |
| `<host>/api/v1/documents/{id}/snapshots*`、`…/elements/purge`、`…/comments/import` | collab | 须在 Room 内执行事务的 REST 只在 collab 装配（rulings §4.18 BE-03、CO-07；评论导入为 P1，[15](./15-rest-api-catalog.md) §3.11）；三类路径共用一条 location 正则；与 `/collab/*` 同一 upstream、同一哈希键（路径里的 `{id}`），落到持有该文档的实例；`all` 模式同一进程 |
| `<host>/api/*` | api | 请求体上限 11 MiB（≤ 10 MB multipart 直传）；透传 `Origin`、`X-Cordex-Request`、`X-Cordex-Share-Token` |
| `<host>/collab/*` | collab | WS 升级；`proxy_read_timeout` 与 `proxy_send_timeout` 3600 s；**按路径中的 `documentId` 一致性哈希选实例**：偏好亲和、不是会话粘性，实例增减只迁移一部分文档，正确性不依赖它（rulings §4.21 H:q-hp-fanout，ADR-0035 决策 7 由可选改为默认；原：无粘性） |
| `<host>/assets/*`、`<host>/fonts/*` | 静态文件 | `Cache-Control: public, max-age=31536000, immutable`（文件名带内容哈希，字体路径带 fontProfile 版本） |
| `<host>/plugins/{sha256}/*`（M4，2026-10-01，rulings §4.23） | 静态文件：挂载目录中第三方插件的浏览器侧产物 | 容器启动时按插件声明文件（`CORDEX_WEB_PLUGINS_CATALOG_FILE`）为每个挂载目录条目渲染一条 `alias`，`{sha256}` 取条目的包摘要，映射到 `CORDEX_WEB_PLUGINS_DIR` 下该条目 `source` 目录的浏览器产物；内容寻址，`Cache-Control: public, max-age=31536000, immutable`；`nosniff`；同源，CSP `script-src 'self'` 不放宽（[50/14](../50-frontend/14-client-security.md) §2）；声明文件里没有的路径 404。是否装配由应用决定：浏览器只 `import()` `GET /users/me/plugins` 返回的 `entry`（被拒或禁用的插件不出现在那里），web 容器不做签名校验 |
| `<host>/` 其余路径 | `index.html`（SPA 回落） | 每响应生成 nonce；`Cache-Control: no-store` |
| `idp.<域名>` | casdoor:8000 | 保持 Host，`X-Forwarded-Proto https`；管理后台路径（随 Casdoor 版本维护的清单文件）只允许 `CORDEX_WEB_IDP_ADMIN_ALLOW` 中的来源 IP |
| `s3.<域名>` | seaweedfs:8333 | 保持 Host（SigV4 把 Host 算进签名）；`proxy_request_buffering off`；单请求上限 32 MiB（≥ 10 MB 的上传走分片）；访问日志只记路径不记 query（query 里有预签名签名）；响应一律加 `Content-Security-Policy: sandbox` 与 `nosniff`（预签名 GET 返回的是用户上传内容，不得在该源执行，[04 §11](./04-modules-documents-storage-media.md)） |

TLS 证书覆盖 `<host>`、`idp.<域名>`、`s3.<域名>` 三个名字；前面另有 TLS 终止的负载均衡时设 `CORDEX_WEB_TLS_MODE=upstream`，此时 web 只监听 8080 并信任一跳 `X-Forwarded-*`：nginx 以 realip 模块只信任 `CORDEX_WEB_TRUSTED_LB_CIDRS` 网段来的这一跳（`set_real_ip_from` 逐项取该变量、`real_ip_header X-Forwarded-For`、不递归，即取 LB 追加的最后一个地址），该变量为空时容器拒绝启动。使用客户自有 S3 或外部 IdP 时省略对应子域（`CORDEX_WEB_S3_HOST` / `CORDEX_WEB_IDP_HOST` 置空）。

**来源 IP 口径**（rulings §4.20 BE-04）：web 容器转发给应用的请求一律**覆盖**（不追加）`X-Forwarded-For $remote_addr`，客户端伪造的 `X-Forwarded-For` 首跳因此到不了应用；应用按 `http.trustProxy = 1`（compose 拓扑固定为 1，§5.1）只信 web 容器这一跳，HTTP 与 WS 升级共用 `clientIp()`（[15](./15-rest-api-catalog.md) §8、[16](./16-ws-protocol-server-view.md) §1）。`upstream` 模式下 realip 已把 `$remote_addr` 换成 LB 报告的客户端地址，所以 `$remote_addr`、应用看到的来源 IP、审计 `ip_hash` 与 Casdoor 管理路径的来源 IP 白名单（`CORDEX_WEB_IDP_ADMIN_ALLOW`）四者一致。

### 3.2 CSP nonce 与响应头

- **每响应生成**：nonce 取 nginx 的 `$request_id`（每请求 16 字节随机数的 hex，128 bit）。同一个值经 `sub_filter` 替换 index.html 模板里的占位符 `__CSP_NONCE__`（`<script nonce>` 与 `<meta name="cordex-nonce">`），并写进同一响应的 CSP 头。nonce 的消费链（injectCss 单例、第三方运行时 style 读 meta）见 [50/14 §3](../50-frontend/14-client-security.md)。
- **策略正文只在 [50/14 §2](../50-frontend/14-client-security.md)**：容器启动时把 50/14 的模板与本容器的环境变量（`CORDEX_WEB_S3_PUBLIC_ORIGIN`、`CORDEX_WEB_WS_BASE`、`CORDEX_WEB_EMBED_ALLOWED_ORIGINS`）渲染成 `/etc/nginx/cordex/csp.conf`，其中保留 `$request_id` 供 nginx 逐请求代入；本文不复写任何指令。
- **模式**：CSP（含 nonce）自 M2 起始终以强制头 `Content-Security-Policy` 下发；`CORDEX_WEB_CSP_MODE=report-only | enforce` 只决定 Trusted Types 的两条指令放在 `Content-Security-Policy-Report-Only` 还是并入强制头——M2 为 report-only，M3 起 enforce（rulings §4.15 Q2「CSP nonce M2、Trusted Types M2 report-only → M3 强制」；指令归属见 50/14 §2）。
- **M4 RTL 预留**（2026-09-26 整合登记，[50/14](../50-frontend/14-client-security.md) §2.7）：复杂文种 shaping（harfbuzzjs，WebAssembly）随 M4 RTL 立项时，在本节登记它的部署开关（与 shaping Provider 的启用共用同一配置，同时写进 RuntimeConfig）以及 `script-src` 追加 `'wasm-unsafe-eval'` 的下发规则：只有开关打开时 web 容器与 `/render` 变体才追加；未启用（默认）时策略不变。M1–M3 不下发该源表达式。
- index.html 不得以预压缩文件（`gzip_static`）提供，否则 `sub_filter` 无法替换；动态 gzip 不受影响。
- nginx 的 `add_header` 不向下继承：每个自己写了 `add_header` 的 location 都要再 `include security-headers.conf`（见 §3.5 片段）。

### 3.3 RuntimeConfig 渲染

依据：决策 RUNTIME-CONFIG。容器**启动时**（不是每请求）从 `CORDEX_WEB_*` 环境变量生成 RuntimeConfig 的 JSON，写进 index.html 模板中的非执行数据块 `<script type="application/json" id="cordex-runtime-config">`（数据块不执行，不需要 nonce）；字段集合与 schema 以 [50/02 §3](../50-frontend/02-app-shell-routing-and-session.md) 为准，JSON 经转义防止 `</script>` 截断。只放静态部署项（`apiBase`、`wsBase`、`publicUrl`、`storagePublicOrigin`、`auth.mode`、`externalResources`、`telemetry` 默认开关、`embed.allowedHostOrigins`、`brand`、`features`、`help`；`appVersion` 取镜像构建时写入的版本号，不可配置）；`selfSignup`、IdP 显示名等可变开关只来自 `GET /api/v1/auth/config`。`auth.mode=none` 只存在于 dev 构建的镜像，生产镜像的启动脚本拒绝该值。

### 3.4 安全响应头

| 头 | 值 | 适用 |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | 三个域名（`TLS_MODE=upstream` 时由上游设置） |
| `X-Content-Type-Options` | `nosniff` | 全部 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | 全部（决策 INC-25） |
| `Cross-Origin-Opener-Policy` | `same-origin` | 主域（重新登录弹窗经 BroadcastChannel 通信，不依赖 `window.opener`） |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | 主域 |
| `Content-Security-Policy`；M2 另加只含 Trusted Types 两条指令的 `Content-Security-Policy-Report-Only` | 50/14 模板 + 本响应的 nonce | 主域的 index.html |
| `Content-Security-Policy: sandbox` | 固定值 | `s3.` 子域全部响应 |
| `Cache-Control` | index.html `no-store`；`/assets/`、`/fonts/` `public, max-age=31536000, immutable` | 主域静态 |

不设 `X-Frame-Options`：嵌入形态由 CSP `frame-ancestors` 控制（50/14）——`/embed/*` 的 `frame-ancestors` 取 `CORDEX_WEB_EMBED_ALLOWED_ORIGINS`（为空即 `'none'`，默认禁止任何站点嵌入），其余路径恒为 `'none'`。版本漂移的处理（惰性 chunk 加载失败、4426 / 4427 → 提示刷新）归 50/02；M1–M4 不引入 Service Worker（决策 VERSION-DRIFT-SW）。

### 3.5 配置片段

```nginx
# /etc/nginx/conf.d/cordex.conf 节选（启动时由模板渲染；$request_id 为每请求 128 bit 随机 hex）
map $http_upgrade $connection_upgrade { default upgrade; '' close; }
log_format cordex_noquery '$remote_addr [$time_local] "$request_method $uri" $status $body_bytes_sent';
# collab 的哈希键：WS 路径与在 Room 内执行的 REST 路径都取 documentId（rulings §4.21 H:q-hp-fanout）
map $uri $cordex_doc_id {
  ~^/collab/v1/rooms/(?<ws_doc>[0-9a-f-]{36})$                                   $ws_doc;
  ~^/api/v1/documents/(?<rest_doc>[0-9a-f-]{36})/(snapshots|elements/purge|comments/import)  $rest_doc;
  default                                                                        "";
}
upstream collab_upstream {
  hash $cordex_doc_id consistent;   # 偏好亲和，非会话粘性；拆分部署时服务名解析出的全部 collab 副本都在此列
  server ${CORDEX_WEB_UPSTREAM_COLLAB};
}
upstream api_upstream { server ${CORDEX_WEB_UPSTREAM_API}; }
server {
  listen 8443 ssl;
  server_name ${CORDEX_WEB_HOST};
  include /etc/nginx/cordex/tls.conf;
  include /etc/nginx/cordex/security-headers.conf;
  location ^~ /internal/ { return 404; }
  location ~ ^/(metrics|healthz|readyz)$ { return 404; }
  location ~ ^/api/v1/documents/[^/]+/(snapshots|elements/purge|comments/import) {
    proxy_pass http://collab_upstream; include /etc/nginx/cordex/proxy.conf;
  }
  location /api/ { client_max_body_size 11m; proxy_pass http://api_upstream; include /etc/nginx/cordex/proxy.conf; }
  # proxy.conf 含 proxy_set_header X-Forwarded-For $remote_addr;（覆盖，不用 $proxy_add_x_forwarded_for 追加，BE-04）
  # TLS_MODE=upstream 时 server 块另 include realip.conf：set_real_ip_from 取 CORDEX_WEB_TRUSTED_LB_CIDRS 每项；real_ip_header X-Forwarded-For;
  location /collab/ {
    proxy_pass http://collab_upstream; include /etc/nginx/cordex/proxy.conf;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_read_timeout 3600s; proxy_send_timeout 3600s;
  }
  location ~ ^/(assets|fonts)/ {
    root /usr/share/nginx/html;
    include /etc/nginx/cordex/security-headers.conf;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
  }
  location / { root /usr/share/nginx/html; try_files $uri /index.html; }
  location = /index.html {
    root /usr/share/nginx/html;
    sub_filter_once off;
    sub_filter '__CSP_NONCE__' $request_id;
    include /etc/nginx/cordex/security-headers.conf;
    include /etc/nginx/cordex/csp.conf;   # 由 50/14 的模板渲染，正文不在本文
    add_header Cache-Control "no-store" always;
  }
}
server {
  listen 8443 ssl;
  server_name ${CORDEX_WEB_S3_HOST};
  include /etc/nginx/cordex/tls.conf;
  access_log /var/log/nginx/s3.log cordex_noquery;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Content-Security-Policy "sandbox" always;   # 用户上传内容在该源不可执行
  client_max_body_size 32m;
  proxy_request_buffering off;
  location / { proxy_pass http://seaweedfs:8333; proxy_set_header Host $host; }
}
# idp 子域同理：proxy_set_header Host $host；include idp-admin-paths.conf（allow 来源 IP 白名单；deny all）
```

### 3.6 web 容器的环境变量

前缀 `CORDEX_WEB_`；应用容器忽略这一前缀（§6）。RuntimeConfig 各字段的含义以 50/02 为准。

| 变量 | 默认 | 用途 |
|---|---|---|
| `CORDEX_WEB_HOST` | —（必填） | 主域名；`server_name` |
| `CORDEX_WEB_PUBLIC_URL` | `https://${CORDEX_WEB_HOST}` | RuntimeConfig `publicUrl` |
| `CORDEX_WEB_API_BASE` | `${PUBLIC_URL}/api/v1` | RuntimeConfig `apiBase`（rulings §4.18 BE-11） |
| `CORDEX_WEB_WS_BASE` | `wss://${CORDEX_WEB_HOST}` | RuntimeConfig `wsBase`（客户端拼 `{wsBase}/collab/v1/rooms/{documentId}`，50/02 §3）；CSP 模板变量 |
| `CORDEX_WEB_S3_HOST` / `CORDEX_WEB_S3_PUBLIC_ORIGIN` | `s3.${域}` / `https://s3.${域}` | `s3.` 子域；RuntimeConfig 与 CSP 模板中的存储源；置空 = 使用客户自有 S3 的对外地址 |
| `CORDEX_WEB_IDP_HOST` | `idp.${域}` | `idp.` 子域；置空 = 外部 IdP |
| `CORDEX_WEB_IDP_ADMIN_ALLOW` | `127.0.0.1/32` | Casdoor 管理后台允许的来源 CIDR 列表 |
| `CORDEX_WEB_AUTH_MODE` | `oidc` | RuntimeConfig `auth.mode`；生产镜像只接受 `oidc` |
| `CORDEX_WEB_EXTERNAL_RESOURCES` | 以 50/02 schema 默认为准 | RuntimeConfig `externalResources`（`auto`、`confirm`、`never`） |
| `CORDEX_WEB_ERROR_REPORTS_DEFAULT` / `CORDEX_WEB_PRODUCT_TELEMETRY_DEFAULT` / `CORDEX_WEB_OTLP_DEFAULT` | `on` / `off` / `off` | RuntimeConfig `telemetry` 三个默认开关（决策 TELEMETRY-DEFAULT） |
| `CORDEX_WEB_RUNTIME_CONFIG_FILE` | 空 | 可选的只读 JSON 文件，提供 `brand`、`features`、`help` 等结构化字段，与上面各变量合并后整体按 50/02 的 `RuntimeConfigSchema` 校验，失败即容器拒绝启动 |
| `CORDEX_WEB_CSP_MODE` | M2 `report-only`，M3 起 `enforce` | 只作用于 Trusted Types 两条指令（§3.2） |
| `CORDEX_WEB_EMBED_ALLOWED_ORIGINS` | 空 | 允许以 iframe 嵌入 `/embed/*` 的宿主源列表（逗号分隔的 `https://` 源）；空 → `/embed/*` 的 `frame-ancestors 'none'`。同一份值渲染进 CSP 与 RuntimeConfig `embed.allowedHostOrigins`（前端据此做 postMessage 来源白名单，[50/12](../50-frontend/12-viewer-embedding-and-render-page.md) §9、[50/14](../50-frontend/14-client-security.md) §2），两处不会不一致 |
| `CORDEX_WEB_PLUGINS_CATALOG_FILE` / `CORDEX_WEB_PLUGINS_DIR`（M4，2026-10-01） | 空 / `/opt/cordex/plugins` | 与应用容器同一份插件声明文件与只读挂载目录（§5.16）；据此渲染 `/plugins/{sha256}/` 的静态路径（§3.1）；声明文件空 = 不提供该路径 |
| `CORDEX_WEB_ENV` | `production` | `production` 或 `test`；只有 e2e 预览服务器与 [70/08](../70-testing/08-deployment-and-environment-e2e.md) 的 `compose.test.yml` 设为 `test`，供下一行的启动校验判定 |
| `CORDEX_WEB_DIAGNOSTICS_E2E_TRACE` | `false` | RuntimeConfig `diagnostics.e2eTrace`（[50/02](../50-frontend/02-app-shell-routing-and-session.md) §3、[50/15](../50-frontend/15-events-errors-and-telemetry.md) §10）；为 `true` 且 `CORDEX_WEB_ENV` 不是 `test` 时容器拒绝启动（生产部署配置拒绝其为真，§5.15） |
| `CORDEX_WEB_TLS_MODE` | `terminate` | `terminate` 或 `upstream` |
| `CORDEX_WEB_TRUSTED_LB_CIDRS` | 空 | `upstream` 模式必填：前置负载均衡所在网段（逗号分隔的 CIDR），渲染为 realip 的 `set_real_ip_from`；为空时 `upstream` 模式拒绝启动，`terminate` 模式忽略（§3.1，rulings §4.20 BE-04） |
| `CORDEX_WEB_UPSTREAM_API` / `CORDEX_WEB_UPSTREAM_COLLAB` | `app:3000` / `app:3000` | 拆分部署时分别指向 api、collab（§8）；collab 的 upstream 以 `hash $cordex_doc_id consistent` 分流（§3.5），服务名在 nginx 启动时解析出的全部副本都参与哈希，collab 扩缩容后 web 容器需 reload |

**图 3-1 web 容器的分流、子域与 nonce 生成**

```mermaid
flowchart LR
  browser["浏览器"]
  subgraph web["web 容器：nginx-unprivileged"]
    main["主域 server：TLS、路径分流"]
    idpS["idp 子域：保持 Host，管理路径限来源 IP"]
    s3S["s3 子域：保持 Host，日志不记 query"]
    nonce["每响应的 $request_id，128 bit"]
    idx["index.html：sub_filter 写入 nonce，no-store"]
    csp["CSP 头：模板正文见 50/14"]
    assets["assets 与 fonts：immutable 一年"]
    deny["internal、metrics、healthz、readyz：404"]
  end
  api["api"]
  collab["collab"]
  casdoor["casdoor"]
  seaweed["seaweedfs S3 网关"]
  browser --> main & idpS & s3S
  main -- "/api/v1/…" --> api
  main -- "快照与元素彻底删除，按 documentId 哈希" --> collab
  main -- "/collab，WS 读超时 3600 s，按 documentId 哈希" --> collab
  main --> assets
  main --> deny
  main -- "其余路径回落" --> idx
  nonce --> idx
  nonce --> csp
  idpS --> casdoor
  s3S --> seaweed
```

怎么读：浏览器的三个域名都进同一个 web 容器；主域按路径分流到 api、collab 或静态文件（collab 按 `documentId` 一致性哈希挑实例），两个子域原样转发并保持 Host。nonce 在每个 index.html 响应上生成一次，同时写进页面与 CSP 头，所以两者一定一致、每次响应都不同。
依据：决策 CSP-NONCE、RUNTIME-CONFIG；rulings §4.18 BE-01、BE-03、BE-11、§4.21 H:q-hp-fanout；ADR-0037 决策 3；ADR-0035 决策 7。

## 4. 镜像

依据：ADR-0037 决策 1、2、6、7；rulings §4.15 Q9（Node 26）、§4.16 Q19（字体）；决策 FONTS。

| 镜像 | 基础 | 内容 | 运行用户 |
|---|---|---|---|
| `cordex-server`（runtime 目标） | `node:26-slim@sha256:…` | `apps/server` 生产依赖（`pnpm deploy --prod`）、`cordex-ops` 入口、tini、字体包；**不含 Chromium** | uid 10001 |
| `cordex-server`（renderer 目标） | 上一行 runtime 目标 | 另加钉死版本的 `chromium-headless-shell`、同版本的 `/render` 静态包、seccomp 配置 | uid 10001；`chromiumSandbox: true` |
| `cordex-web` | `nginxinc/nginx-unprivileged@sha256:…` | `apps/web` 构建产物、`/fonts/` 字体子集、nginx 模板与启动渲染脚本 | nginx 默认非 root 用户 |

多阶段 Dockerfile：

```text
deps      pnpm fetch（锁文件驱动，可缓存）
build     pnpm -r build（turbo）：apps/server、apps/web 及其依赖包
prune     pnpm deploy --prod --filter apps/server → /out/server
runtime   FROM node:26-slim@sha256:…；COPY /out/server、字体包；USER 10001；ENTRYPOINT ["tini","--","node","--import","./dist/observability/otel.js","dist/main.js"]
renderer  FROM runtime；安装钉死版本 chromium-headless-shell；COPY apps/web 的 /render 静态包；CORDEX_ROLE=renderer
web       FROM nginx-unprivileged@sha256:…；COPY apps/web dist 与 /fonts/；COPY nginx 模板与 entrypoint 渲染脚本
```

入口带 `--import ./dist/observability/otel.js`（2026-09-26，rulings §4.21 q-nest-major）：Nest 12 是纯 ESM，`apps/server` 产物改为 ESM，OTel 必须在入口模块之前预加载才能给随后 import 的 `pg`、`ioredis` 等打补丁（[18](./18-observability-and-ops-endpoints.md) §1.1、ADR-0030 修订）；renderer 目标沿用同一入口，`otel.js` 按 `CORDEX_ROLE` 不启动 SDK。`cordex-ops` 入口（`node dist/ops/cli.js`）不预加载 OTel。

**renderer 镜像二选一，取「`cordex-server` 的 renderer 构建目标」**：
- 理由：同一次构建产出 worker 与 renderer，`/render` 静态包、fontProfile 与 RPC 契约版本天然一致，ADR-0037 的「renderer 与 worker 版本锁」由构建方式直接保证，不需要额外的锁步流水线；renderer 入口本来就是 `apps/server` 的 `CORDEX_ROLE=renderer`，另做最小镜像仍要带上这部分代码。
- 代价与对策：镜像比自建最小 Chromium 镜像大；镜像里有服务端代码。对策是运行时约束而非删文件：只挂 render 网络、零出站、不挂任何凭据、启动时检测到凭据环境变量即拒绝启动、进程内不建 DB / Valkey / S3 客户端（[01](./01-service-overview-and-roles.md)），并由治理检查 `check-image-policy` 静态核对非 root、无凭据、沙箱开启。
- 每周随 Chrome 稳定版重建并与 worker 同版本发布。

**字体包**（决策 FONTS）：一份字体清单（fontProfile id、版本、每个文件的 sha256，含内置 Noto（含 CJK）、Liberation、Carlito / Caladea）被三个镜像共用——runtime（`node-font` 度量）、renderer（Chromium 渲染）、web（`/fonts/{profileVersion}/…`，按 unicode-range 子集供浏览器按需加载）。部署方自有授权字体只读挂载到 `fonts.extraDirs`（rulings §4.16 Q19）。三个镜像中同名字体的 sha256 必须一致（`check-image-policy` 的子规则）。

**供应链**：全部镜像（自建与第三方）以 digest 钉死；自建镜像随发布附 SBOM（buildx 生成的 SPDX 证明并导出文件）与 CVE 扫描报告；`ops:image-licenses` 门禁要求默认 profile 每个镜像的主组件许可在白名单内，AGPL / SSPL / RSAL 只允许出现在显式 profile（ADR-0037 决策 2、6）。

### 4.1 镜像版本锁表（2026-09-26）

依据：R-d-59（2026-09 核实）；ADR-0022 修订；ADR-0037 决策 2、6。compose 与 Helm 一律写 `镜像:版本@sha256:…`，版本号只作可读标注，拉取以 digest 为准；选型理由与替代见 [19](./19-reuse-and-dependency-catalog.md) §13。

| 镜像 | 版本 | 许可 | profile | 升级注意 |
|---|---|---|---|---|
| `postgres` | 18.x（ddl-check 实跑 18.6；客户自带下限 16） | PostgreSQL License | 默认 | 小版本随 digest 升级并重跑 ddl-check；主版本另行评估 |
| `valkey/valkey` | 9.1.2（2026-09-01；不用 9.2.0-rc1） | BSD-3-Clause | 默认 | 客户自带只要求 Redis ≥ 7.2 协议；升级回归 Lua 脚本、pub/sub 与 BullMQ |
| `chrislusf/seaweedfs` | 4.47（2026-09-14） | Apache-2.0 | 默认 | 升级重跑 `runBlobStoreConformance`（含预签名经反代、按版本删除） |
| `casbin/casdoor` | v4.10.x（v4.10.0，2026-09-25） | Apache-2.0 | `idp` | 发版频繁，升级回归 OIDC 登录、登出与 JWKS |
| `node` | 26-slim | MIT | —（`cordex-server` 基础） | 与 `engines >=26` 一致 |
| `nginxinc/nginx-unprivileged` | digest 钉死 | BSD-2-Clause | —（`cordex-web` 基础） | — |
| `chromium-headless-shell` | 与 `playwright-core` 1.63 绑定的修订 | BSD 系 | —（renderer 目标内安装） | 每周随 Chrome 稳定版重建，renderer 与 worker 同版本发布 |
| OTel Collector、Jaeger、Prometheus、`prom/node-exporter` | digest 钉死，版本随发布件清单确定 | Apache-2.0 | 默认 | 本轮证据未核定版本号，首次发布时补登 |
| Grafana、Loki（Tempo） | 同上 | AGPL-3.0 | `observability-agpl` | 只在显式 profile |
| `oidc-provider` mock | 9.12.2 | MIT | `dev` | 只在开发与 CI |

## 5. 配置 schema 全字段表（唯一源）

`apps/server/src/config/config.schema.ts`（zod）是本表的代码形态；解析一次，注入 typed `AppConfig`。统一键名：房间容量只在 `collab.room.*`（废 `room.*`），保留期只在 `retention.*`（40/12 的 `RetentionPolicy` 值对象改为读这里），单帧与速率只在 `limits.*`（决策 INC-07），溢写阈值只在 `spill.*`（决策 SPILL）。旧键名一律拒绝启动并提示新键名（§5.14）。单位写在键名后缀里（`Ms`、`Sec`、`Hours`、`Days`、`Bytes`）；「生产必填」指 `NODE_ENV=production` 时缺失即退出码 78；机密一律经 `*File` 读文件（§6）。「生产必填」按角色取舍：机密项以 §6 的角色 × 机密矩阵为准；renderer 只读取 `role`、`http.port`、`headless.*`、`fonts.extraDirs`、`telemetry.logLevel`，其余键对它不适用。

### 5.1 进程与 HTTP

| 路径 | 类型 | 默认 | 范围 / 校验 | 生产必填 | 环境变量 | 机密 |
|---|---|---|---|---|---|---|
| `role` | 枚举 | `all` | `all`、`api`、`collab`、`worker`、`renderer` | 是 | `CORDEX_ROLE` | 否 |
| （运行环境） | 枚举 | `development` | `production`、`development`、`test` | 是 | `NODE_ENV` | 否 |
| `publicUrl` | URL | — | https、无路径 | 是 | `CORDEX_PUBLIC_URL` | 否 |
| `http.port` | 整数 | 3000 | 1–65535 | — | `CORDEX_HTTP_PORT` | 否 |
| `http.internalPort` | 整数 | 9464 | ≠ `http.port`；只绑 backend 网络（`/metrics`、`/internal/*`） | — | `CORDEX_HTTP_INTERNAL_PORT` | 否 |
| `http.internalHost` | 字符串 | dev 为 `127.0.0.1` | 内部端口的监听地址；production 必须显式配置且不得为通配地址 `0.0.0.0` / `::`（[01 §6](./01-service-overview-and-roles.md) A10）；compose 模板注入容器在 backend 网络上的地址 | 是（api、collab、worker） | `CORDEX_HTTP_INTERNAL_HOST` | 否 |
| `http.trustProxy` | 整数 | 1 | 0–3（可信反代跳数）；compose 拓扑固定为 1（web 容器一跳；`upstream` 模式下 LB 那一跳已由 web 容器的 realip 剥掉，§3.1）；`clientIp()` 按此跳数自右向左取来源 IP，限流与审计 `ip_hash` 共用（[15 §8](./15-rest-api-catalog.md)） | — | `CORDEX_HTTP_TRUST_PROXY` | 否 |
| `http.bodyLimitBytes` | 整数 | 262144 | ≤ 16 MiB；未另注明路由的 JSON 请求体上限，按路由的覆盖值见 [15 §8](./15-rest-api-catalog.md) | — | `CORDEX_HTTP_BODY_LIMIT_BYTES` | 否 |
| `http.multipartMaxBytes` | 整数 | 10485760 | ≤ 10 MiB（小文件 multipart 直传） | — | `CORDEX_HTTP_MULTIPART_MAX_BYTES` | 否 |
| `http.shutdownGraceMs` | 整数 | 30000 | 5000–60000（SIGTERM 排空上限） | — | `CORDEX_HTTP_SHUTDOWN_GRACE_MS` | 否 |

### 5.2 数据库

| 路径 | 类型 | 默认 | 范围 / 校验 | 生产必填 | 环境变量 | 机密 |
|---|---|---|---|---|---|---|
| `db.host` / `db.port` / `db.database` | 字符串 / 整数 / 字符串 | `postgres` / 5432 / `cordex` | — | 是 | `CORDEX_DB_HOST` / `CORDEX_DB_PORT` / `CORDEX_DB_DATABASE` | 否 |
| `db.sslMode` | 枚举 | `disable` | `disable`、`require`、`verify-full`；库在容器网络之外时须 `verify-full` | — | `CORDEX_DB_SSL_MODE` | 否 |
| `db.app.user` | 字符串 | `cordex_app` | — | — | `CORDEX_DB_APP_USER` | 否 |
| `db.app.passwordFile` | 路径 | — | 可读文件 | api、collab、worker | `CORDEX_DB_APP_PASSWORD_FILE` | 是 |
| `db.app.poolMax` | 整数 | 20 | 1–200 | — | `CORDEX_DB_APP_POOL_MAX` | 否 |
| `db.app.statementTimeoutMs` | 整数 | 30000 | 1000–120000 | — | `CORDEX_DB_APP_STATEMENT_TIMEOUT_MS` | 否 |
| `db.system.user` | 字符串 | `cordex_system` | — | — | `CORDEX_DB_SYSTEM_USER` | 否 |
| `db.system.passwordFile` | 路径 | — | api 与 renderer 配置即拒绝启动 | collab、worker | `CORDEX_DB_SYSTEM_PASSWORD_FILE` | 是 |
| `db.system.poolMax` | 整数 | 20 | 1–200 | — | `CORDEX_DB_SYSTEM_POOL_MAX` | 否 |
| `db.system.statementTimeoutMs` | 整数 | 120000 | 1000–600000 | — | `CORDEX_DB_SYSTEM_STATEMENT_TIMEOUT_MS` | 否 |
| `db.migrator.user` | 字符串 | `cordex_migrator` | 只供 `cordex-ops` | — | `CORDEX_DB_MIGRATOR_USER` | 否 |
| `db.migrator.passwordFile` | 路径 | — | 应用进程（任何 `CORDEX_ROLE`）配置即拒绝启动 | ops 命令 | `CORDEX_DB_MIGRATOR_PASSWORD_FILE` | 是 |

### 5.3 Valkey

| 路径 | 类型 | 默认 | 范围 / 校验 | 生产必填 | 环境变量 | 机密 |
|---|---|---|---|---|---|---|
| `valkey.url` | URL | `redis://valkey:6379` | `redis://` 或 `rediss://`，不含口令 | 是（renderer 除外） | `CORDEX_VALKEY_URL` | 否 |
| `valkey.passwordFile` | 路径 | — | 可选 | — | `CORDEX_VALKEY_PASSWORD_FILE` | 是 |
| `valkey.keyPrefix` | 字符串 | `cordex:` | `^[a-z0-9-]+:$`（[14 §2](./14-valkey-object-storage-and-retention.md)） | — | `CORDEX_VALKEY_KEY_PREFIX` | 否 |

### 5.4 对象存储

| 路径 | 类型 | 默认 | 范围 / 校验 | 生产必填 | 环境变量 | 机密 |
|---|---|---|---|---|---|---|
| `storage.provider` | 枚举 | `s3` | `s3`、`local`；production 只允许 `s3` | 是 | `CORDEX_STORAGE_PROVIDER` | 否 |
| `storage.local.dir` | 路径 | — | 仅 dev / test | — | `CORDEX_STORAGE_LOCAL_DIR` | 否 |
| `storage.s3.endpoint` | URL | `http://seaweedfs:8333` | 内网地址，服务端自身读写 | 是 | `CORDEX_STORAGE_S3_ENDPOINT` | 否 |
| `storage.s3.publicEndpoint` | URL | — | 浏览器可达；预签名一律按它生成（rulings §4.18 BE-01） | 是 | `CORDEX_STORAGE_S3_PUBLIC_ENDPOINT` | 否 |
| `storage.s3.region` | 字符串 | `us-east-1` | — | — | `CORDEX_STORAGE_S3_REGION` | 否 |
| `storage.s3.forcePathStyle` | 布尔 | `true` | — | — | `CORDEX_STORAGE_S3_FORCE_PATH_STYLE` | 否 |
| `storage.s3.accessKeyIdFile` / `storage.s3.secretAccessKeyFile` | 路径 | — | renderer 配置即拒绝启动 | 是 | `CORDEX_STORAGE_S3_ACCESS_KEY_ID_FILE` / `CORDEX_STORAGE_S3_SECRET_ACCESS_KEY_FILE` | 是 |
| `storage.s3.buckets.data` | 字符串 | `cordex-data` | S3 桶名规则 | — | `CORDEX_STORAGE_S3_BUCKETS_DATA` | 否 |
| `storage.s3.buckets.snapshots` | 字符串 | `cordex-snapshots` | ≠ `buckets.data` | — | `CORDEX_STORAGE_S3_BUCKETS_SNAPSHOTS` | 否 |
| `storage.s3.presign.putTtlSec` | 整数 | 600 | 60–3600；媒体上传的预签名 PUT 有效期。导入原件的 PUT 不读本键，固定等于 `uploadId` 寿命 1 h（rulings §4.18 BE-10；落点隔离区 `uploads/tmp/{uploadId}`，UPLOAD-QUARANTINE，[06 §6.1](./06-modules-jobs-import-export-thumbnails.md)） | — | `CORDEX_STORAGE_S3_PRESIGN_PUT_TTL_SEC` | 否 |
| `storage.s3.presign.getTtlSec` | 整数 | 3600 | 60–86400 | — | `CORDEX_STORAGE_S3_PRESIGN_GET_TTL_SEC` | 否 |
| `storage.s3.snapshotsNoncurrentDays` | 整数 | 7 | ≥ 1，且 ≥ PG 备份保留天数（[14 §11](./14-valkey-object-storage-and-retention.md)） | — | `CORDEX_STORAGE_S3_SNAPSHOTS_NONCURRENT_DAYS` | 否 |

### 5.5 鉴权

| 路径 | 类型 | 默认 | 范围 / 校验 | 生产必填 | 环境变量 | 机密 |
|---|---|---|---|---|---|---|
| `auth.oidc.issuer` | URL | — | 浏览器可达的对外地址（内置 Casdoor 时为 `https://idp.<域名>`）；启动时能完成发现 | 是（api） | `CORDEX_AUTH_OIDC_ISSUER` | 否 |
| `auth.oidc.clientId` | 字符串 | — | — | 是（api） | `CORDEX_AUTH_OIDC_CLIENT_ID` | 否 |
| `auth.oidc.clientSecretFile` | 路径 | — | 只有 api 持有 | 是（api） | `CORDEX_AUTH_OIDC_CLIENT_SECRET_FILE` | 是 |
| `auth.oidc.redirectUri` | URL | `{publicUrl}/api/v1/auth/oidc/callback` | 与 `publicUrl` 同源 | — | `CORDEX_AUTH_OIDC_REDIRECT_URI` | 否 |
| `auth.oidc.scopes` | 字符串数组 | `openid,profile,email` | 必含 `openid` | — | `CORDEX_AUTH_OIDC_SCOPES` | 否 |
| `auth.oidc.displayName` | 字符串 | `单点登录` | ≤ 40 字；经 `GET /auth/config` 下发 | — | `CORDEX_AUTH_OIDC_DISPLAY_NAME` | 否 |
| `auth.oidc.requireEmailVerified` | 布尔 | `true` | `false` 时接受不下发 `email_verified` 的企业 IdP 邮箱（[02 §3](./02-auth-chain.md)） | — | `CORDEX_AUTH_OIDC_REQUIRE_EMAIL_VERIFIED` | 否 |
| `auth.oidc.postLogoutRedirectPath` | 字符串 | `/login` | 以 `/` 开头的站内路径；RP-initiated logout 的 `post_logout_redirect_uri` = `publicUrl` + 本值，须在 IdP 侧登记为允许的回跳地址（[02 §4.4](./02-auth-chain.md)） | — | `CORDEX_AUTH_OIDC_POST_LOGOUT_REDIRECT_PATH` | 否 |
| `auth.selfSignup` | 布尔 | `false` | 经 `GET /auth/config` 下发 | — | `CORDEX_AUTH_SELF_SIGNUP` | 否 |
| `auth.bootstrapAdmins` | 字符串数组 | 空 | 已验证邮箱列表；只在部署内不存在任何 active 平台管理员时生效（[02 §3](./02-auth-chain.md)） | — | `CORDEX_AUTH_BOOTSTRAP_ADMINS` | 否 |
| `auth.session.accessTtlSec` | 整数 | 900 | 300–3600（会话 JWT） | — | `CORDEX_AUTH_SESSION_ACCESS_TTL_SEC` | 否 |
| `auth.session.refreshTtlSec` | 整数 | 604800 | ≤ `absoluteTtlSec`（刷新滑动窗口） | — | `CORDEX_AUTH_SESSION_REFRESH_TTL_SEC` | 否 |
| `auth.session.absoluteTtlSec` | 整数 | 2592000 | ≤ 90 天（会话绝对封顶，[02 §4.1](./02-auth-chain.md)） | — | `CORDEX_AUTH_SESSION_ABSOLUTE_TTL_SEC` | 否 |
| `auth.session.revocationCacheMs` | 整数 | 5000 | ≤ 5000；SessionGuard 进程内缓存与 collab 的 WS 会话批量复核周期（吊销 ≤ 5 s 生效，决策 SESSION；[02 §4.2、§9.5](./02-auth-chain.md)） | — | `CORDEX_AUTH_SESSION_REVOCATION_CACHE_MS` | 否 |
| `auth.jwt.signingKeysFile` | 路径 | — | ES256 私钥 JWKS，可含多个 `kid` 以便轮换；只有 api 持有 | 是（api） | `CORDEX_AUTH_JWT_SIGNING_KEYS_FILE` | 是 |
| `auth.jwt.verifyKeysFile` | 路径 | — | 同一组密钥的公钥 JWKS；轮换期保留旧公钥至最长令牌寿命 | 是（collab） | `CORDEX_AUTH_JWT_VERIFY_KEYS_FILE` | 否 |
| `auth.ticket.ttlSec` | 整数 | 60 | 30–120（collab 票据） | — | `CORDEX_AUTH_TICKET_TTL_SEC` | 否 |

### 5.6 安全与机密

| 路径 | 类型 | 默认 | 范围 / 校验 | 生产必填 | 环境变量 | 机密 |
|---|---|---|---|---|---|---|
| `security.allowedOrigins` | URL 数组 | `publicUrl` 的 origin | 每项是 origin；CSRF 与 WS Origin 白名单（决策 INC-24） | — | `CORDEX_SECURITY_ALLOWED_ORIGINS` | 否 |
| `secrets.kekFile` | 路径 | — | 32 字节；AES-256-GCM 加密 Webhook 签名密钥（决策 C-16/INC-30）；api 与 worker 持有 | 是（M3 起） | `CORDEX_SECRETS_KEK_FILE` | 是 |
| `ops.tokenFile` | 路径 | — | ≥ 32 字节；`/internal/*` 常量时间比较（决策 INC-26） | 是 | `CORDEX_OPS_TOKEN_FILE` | 是 |
| `audit.hashSaltFile` | 路径 | — | ≥ 32 字节；`ip_hash`、`ua_hash` 与限流 IP 主体的盐 | 是 | `CORDEX_AUDIT_HASH_SALT_FILE` | 是 |
| `audit.recordClientIp` | 布尔 | `true` | `false` 时审计行 `ip_hash` 恒为空（[07](./07-modules-comments-webhooks-audit.md)） | — | `CORDEX_AUDIT_RECORD_CLIENT_IP` | 否 |
| `webhooks.egressAllowlist` | 字符串数组 | 空（严格模式） | CIDR 或主机名；放宽 SSRF 默认拒绝的显式白名单 | — | `CORDEX_WEBHOOKS_EGRESS_ALLOWLIST` | 否 |

### 5.7 协同

| 路径 | 类型 | 默认 | 范围 / 校验 | 生产必填 | 环境变量 | 机密 |
|---|---|---|---|---|---|---|
| `collab.room.maxEditors` | 整数 | 20 | 1–100；> 20 为超包络 | — | `CORDEX_COLLAB_ROOM_MAX_EDITORS` | 否 |
| `collab.room.maxViewers` | 整数 | 50 | 0–500；> 50 为超包络 | — | `CORDEX_COLLAB_ROOM_MAX_VIEWERS` | 否 |
| `collab.room.memoryAdmissionPct` | 整数 | 75 | 10–95；实例内存预算 = cgroup 限额 × 本值（rulings §4.18 BE-29） | — | `CORDEX_COLLAB_ROOM_MEMORY_ADMISSION_PCT` | 否 |
| `collab.room.weightBytesPerElement` | 整数 | 14336 | 房间权重 = `documents.element_count` × 本值（[05 §4.1](./05-modules-collab-and-snapshots.md)，CO-17） | — | `CORDEX_COLLAB_ROOM_WEIGHT_BYTES_PER_ELEMENT` | 否 |
| `collab.room.weightBudgetBytes` | 整数 | 无 | 可选的绝对覆盖值 | — | `CORDEX_COLLAB_ROOM_WEIGHT_BUDGET_BYTES` | 否 |
| `collab.room.drainGraceMs` | 整数 | 60000 | 0–600000（空置房间销毁延迟） | — | `CORDEX_COLLAB_ROOM_DRAIN_GRACE_MS` | 否 |
| `collab.membership.heartbeatMs` / `collab.membership.staleMs` | 整数 | 15000 / 60000 | stale ≥ 3 × heartbeat（名额登记刷新与过期，决策 C-11，[14 §4](./14-valkey-object-storage-and-retention.md)） | — | `CORDEX_COLLAB_MEMBERSHIP_HEARTBEAT_MS` / `CORDEX_COLLAB_MEMBERSHIP_STALE_MS` | 否 |
| `collab.compaction.maxPendingUpdates` | 整数 | 500 | 50–10000 | — | `CORDEX_COLLAB_COMPACTION_MAX_PENDING_UPDATES` | 否 |
| `collab.compaction.maxPendingBytes` | 整数 | 5242880 | 1 MiB–64 MiB | — | `CORDEX_COLLAB_COMPACTION_MAX_PENDING_BYTES` | 否 |
| `collab.compaction.maxAgeMs` | 整数 | 600000 | 60000–3600000（三个阈值任一满足即压缩，ADR-0025 决策 3） | — | `CORDEX_COLLAB_COMPACTION_MAX_AGE_MS` | 否 |
| `collab.compaction.maxLogToSnapshotRatio` | 整数 | 10 | 2–100（update 日志达到最新快照大小的本值倍数即压缩，NF-10，[05 §7](./05-modules-collab-and-snapshots.md)） | — | `CORDEX_COLLAB_COMPACTION_MAX_LOG_TO_SNAPSHOT_RATIO` | 否 |
| `collab.persist.flushMs` / `collab.persist.batchMax` | 整数 | 100 / 50 | 10–1000 / 1–500；写入器组提交「空闲即刷」的**上限**（2026-09-26 整合改写语义）：没有进行中的提交时到达的帧立即落库，提交进行中到达的帧入组，组内等待不超过 `flushMs`、条数不超过 `batchMax`（[16](./16-ws-protocol-server-view.md) §5 第 3 条；原「固定 100 ms 窗口」作废，它会把单连接限到约 10 帧/s） | — | `CORDEX_COLLAB_PERSIST_FLUSH_MS` / `CORDEX_COLLAB_PERSIST_BATCH_MAX` | 否 |
| `collab.persist.persistBeforeBroadcast` | 布尔 | `true` | 只约束 PG 可用时的顺序；PG 降级期照常广播（rulings §4.18 CO-08） | — | `CORDEX_COLLAB_PERSIST_PERSIST_BEFORE_BROADCAST` | 否 |
| `collab.persist.retryWindowMs` / `collab.persist.probeIntervalMs` | 整数 | 800 / 1000 | PG 抖动重试窗口，超过即进入降级期并溢写；降级期 PG 探活间隔（[05 §5、§6](./05-modules-collab-and-snapshots.md)） | — | `CORDEX_COLLAB_PERSIST_RETRY_WINDOW_MS` / `CORDEX_COLLAB_PERSIST_PROBE_INTERVAL_MS` | 否 |
| `collab.softGate.mode` / `collab.softGate.schemaMode` | 枚举 | `repair` / `report-only` | `repair`、`report-only`、`off`（ADR-0034；默认值按 rulings §4.1 P8：不变量 repair、schema report-only） | — | `CORDEX_COLLAB_SOFT_GATE_MODE` / `CORDEX_COLLAB_SOFT_GATE_SCHEMA_MODE` | 否 |
| `collab.repair.quarantineThreshold` / `collab.repair.windowMs` | 整数 | 5 / 600000 | 窗口内修复次数达阈值即隔离（4409，ADR-0034 决策 2，[16 §13](./16-ws-protocol-server-view.md)） | — | `CORDEX_COLLAB_REPAIR_QUARANTINE_THRESHOLD` / `CORDEX_COLLAB_REPAIR_WINDOW_MS` | 否 |
| `collab.hocuspocus.timeoutMs` | 整数 | 45000 | ≥ `limits.idleTimeoutMs`；Hocuspocus 的 `timeout`，**只作兜底**：它同时是认证前的绝对期限与空闲超时，检查间隔等于自身，实际 45–90 s 才判死；5 s 认证期限与 45 s 空闲判死由适配层计时（§5.8 `limits.ws.firstFrameTimeoutMs`、`limits.idleTimeoutMs`） | — | `CORDEX_COLLAB_HOCUSPOCUS_TIMEOUT_MS` | 否 |
| `collab.hocuspocus.maxUnauthenticatedQueueBytes` / `collab.hocuspocus.maxUnauthenticatedQueueMessages` | 整数 | 5242880 / 1000 | Hocuspocus 的 `maxUnauthenticatedQueueSize` / `maxUnauthenticatedQueueMessages`（默认值）；认证通过后、文档加载期间仍用这条队列，保持宽上限以覆盖加载窗口（最长 30 s），超限按 4205 关闭；严格的认证前限额是适配层的 `limits.ws.preAuthMax*`（§5.8） | — | `CORDEX_COLLAB_HOCUSPOCUS_MAX_UNAUTHENTICATED_QUEUE_BYTES` / `CORDEX_COLLAB_HOCUSPOCUS_MAX_UNAUTHENTICATED_QUEUE_MESSAGES` | 否 |
| `collab.hocuspocus.flushDelayMs` | 整数 | 0 | ≥ 0；服务端 Hocuspocus 的 `flushDelay`：0 表示同一事件循环内合并，不额外延迟；调大会等量推迟文档更新广播、吃掉房间内广播 p95 ≤ 100 ms 的预算，不建议非零；满员 awareness 合并不靠它（§5.8 `limits.awarenessTick*`） | — | `CORDEX_COLLAB_HOCUSPOCUS_FLUSH_DELAY_MS` | 否 |

名额按用户计、owner 不占编辑者名额、commenter 计入查看者是固定规则（rulings §4.15 Q5），不是配置项。

`collab.hocuspocus.*`（2026-09-26 新增，rulings §4.21 q-ws-gateway 与 H 组裁决）是 [ADR-0039](../30-architecture/adr/0039-collab-server-hocuspocus.md)「Hocuspocus 配置」表中需要部署可调的三组（`timeout`、认证前队列两项、服务端 `flushDelay`），键名与默认值以本表为唯一源，取值理由见 [16](./16-ws-protocol-server-view.md) §13。step2 上限由适配层执行，登记为 `limits.ws.step2MaxBytes`（§5.8），不放在 `collab.hocuspocus.*` 下。其余构造参数是代码常量、不开放配置：`maxPendingDocuments = 1`（一 WS 一文档）、`debounce` / `maxDebounce` 取默认 2000 / 10000（只驱动 `onStoreDocument` 的压缩检查节拍）、`unloadImmediately` 取默认 `true`、`yDocOptions` 取默认 `{gc: true}`（与 ADR-0025 决策 7 一致）；M3 extension-redis 的 `prefix`、`identifier` 由 `valkey.keyPrefix` 与实例 id 派生，`lockTimeout`、`disconnectDelay`、`awaitInitialSyncTimeout` 为常量（[16](./16-ws-protocol-server-view.md) §13、[14](./14-valkey-object-storage-and-retention.md) §3.1）。

### 5.8 限额与限流

| 路径 | 类型 | 默认 | 范围 / 校验 | 生产必填 | 环境变量 | 机密 |
|---|---|---|---|---|---|---|
| `limits.maxUpdateBytes` | 整数 | 1048576 | 64 KiB–4 MiB；单帧 payload 上限（不含帧头：2026-09-26 起线上是 Hocuspocus 帧，帧头为文档名与类型前缀，原「不含 1 字节 FrameType」随信封格式作废），超限 4413；step2 例外见 `limits.ws.step2MaxBytes` | — | `CORDEX_LIMITS_MAX_UPDATE_BYTES` | 否 |
| `limits.msgRateHz` / `limits.msgBurst` | 整数 | 200 / 500 | 对全部帧限速（决策 INC-07） | — | `CORDEX_LIMITS_MSG_RATE_HZ` / `CORDEX_LIMITS_MSG_BURST` | 否 |
| `limits.awarenessMinIntervalMs` / `limits.awarenessMaxBytes` | 整数 | 50 / 2048 | — | — | `CORDEX_LIMITS_AWARENESS_MIN_INTERVAL_MS` / `CORDEX_LIMITS_AWARENESS_MAX_BYTES` | 否 |
| `limits.structsPerUpdate` | 整数 | 50000 | — | — | `CORDEX_LIMITS_STRUCTS_PER_UPDATE` | 否 |
| `limits.updateBytesPerMin` | 整数 | 10485760 | 每连接每分钟写入字节，超限 4429（[16 §13](./16-ws-protocol-server-view.md)） | — | `CORDEX_LIMITS_UPDATE_BYTES_PER_MIN` | 否 |
| `limits.awarenessTickThreshold` / `limits.awarenessTickMs` | 整数 | 20 / 100 | 房间在线人数达阈值后 awareness 按 tick 合并转发（16 §7） | — | `CORDEX_LIMITS_AWARENESS_TICK_THRESHOLD` / `CORDEX_LIMITS_AWARENESS_TICK_MS` | 否 |
| `limits.idleTimeoutMs` | 整数 | 45000 | 适配层逐帧计时：每 `limits.ws.idleCheckIntervalMs` 检查一次，连续这么久没有任何入站帧即 `ws.close(4408)`；客户端 awareness 每 15 s 续期保证在线连接总有帧（应用层 ping/pong 已删，rulings §4.21 H-d-07；原：「客户端 15 s 心跳 × 3」）；Hocuspocus 的 `timeout` 只兜底（§5.7） | — | `CORDEX_LIMITS_IDLE_TIMEOUT_MS` | 否 |
| `limits.ws.maxConnectionsPerInstance` | 整数 | 4000 | RM-S 单实例 ≥ 2,000 连接的 2 倍余量；数值归 [16 §13](./16-ws-protocol-server-view.md) | — | `CORDEX_LIMITS_WS_MAX_CONNECTIONS_PER_INSTANCE` | 否 |
| `limits.ws.connectPerIpPerMin` / `limits.ws.firstFrameTimeoutMs` | 整数 | 10 / 5000 | 前者：IP 令牌桶 `ws-connect` 的补充速率与容量，升级前扣 1、票据验签通过退还（先扣后退，[16 §1](./16-ws-protocol-server-view.md)）；不属 L1–L4 门禁，可以调高（更大的办公出口）。后者：键名沿用，语义自 2026-09-26 改为**认证期限**——适配层从升级完成计到 Hocuspocus 发出 `Authenticated` 为止，超时 `ws.close(4408)`；「首帧必须是 auth」已删（H-d-04），取票期间先到的 update 由 Hocuspocus 排队 | — | `CORDEX_LIMITS_WS_CONNECT_PER_IP_PER_MIN` / `CORDEX_LIMITS_WS_FIRST_FRAME_TIMEOUT_MS` | 否 |
| `limits.ws.preAuthMaxFrames` / `limits.ws.preAuthMaxBytes` | 整数 | 16 / 65536 | 新增（§4.21）：适配层对认证前入站帧的严格计数，只计到 `Authenticated`，超限 4205；Hocuspocus 自己的队列保持宽上限（§5.7）；数值归 [16 §13](./16-ws-protocol-server-view.md) | — | `CORDEX_LIMITS_WS_PRE_AUTH_MAX_FRAMES` / `CORDEX_LIMITS_WS_PRE_AUTH_MAX_BYTES` | 否 |
| `limits.ws.authTokenMaxBytes` | 整数 | 8192 | 新增（§4.21）：Auth 帧里 token（JSON）的上限，超限 4400 | — | `CORDEX_LIMITS_WS_AUTH_TOKEN_MAX_BYTES` | 否 |
| `limits.ws.step2MaxBytes` | 整数 | 16777216 | 新增（§4.21）：≥ `limits.maxUpdateBytes`；重连 step2 的单帧上限（rulings §4.21 H:q-hp-step2-cap），同时是 ws `maxPayload` 的硬顶；超限 4413，客户端导出后重载；普通 update 仍受 `limits.maxUpdateBytes` 约束；调大前须压测单帧门禁与落库时延 | — | `CORDEX_LIMITS_WS_STEP2_MAX_BYTES` | 否 |
| `limits.ws.idleCheckIntervalMs` | 整数 | 5000 | 新增（§4.21）：适配层空闲检查间隔，须 < `limits.idleTimeoutMs` | — | `CORDEX_LIMITS_WS_IDLE_CHECK_INTERVAL_MS` | 否 |
| `limits.ws.maxConnectionsPerUser` | 整数 | 32 | ≥ 1；每用户在单个 collab 实例上的已认证 WS 连接数上限（进程内计数），超限 `auth.denied{collab.rate_limited}` + 4429；数值归 [16 §13](./16-ws-protocol-server-view.md)（rulings §4.20 BE-01+TX-03） | — | `CORDEX_LIMITS_WS_MAX_CONNECTIONS_PER_USER` | 否 |
| `limits.rate.<档>.perMin` / `limits.rate.<档>.burst` | 整数 | 见表后各档默认 | 令牌桶的补充速率与容量；档名、适用路由与主体以 [15 §8](./15-rest-api-catalog.md) 为准，桶键见 [14 §3.2](./14-valkey-object-storage-and-retention.md)；只可收紧 | — | `CORDEX_LIMITS_RATE_<档>_PER_MIN` / `CORDEX_LIMITS_RATE_<档>_BURST`（档名转大写蛇形） | 否 |
| `limits.media.maxBytes` | 整数 | 104857600 | 资源上传单文件 100 MiB | — | `CORDEX_LIMITS_MEDIA_MAX_BYTES` | 否 |
| `limits.zip.maxEntries` | 整数 | 4000 | 只可收紧；放宽不超过 2 倍（OF-24），否则拒绝启动 | — | `CORDEX_LIMITS_ZIP_MAX_ENTRIES` | 否 |
| `limits.zip.maxEntryUncompressedBytes` / `limits.zip.maxTotalUncompressedBytes` | 整数 | 64 MiB / 512 MiB | 同上 | — | `CORDEX_LIMITS_ZIP_MAX_ENTRY_UNCOMPRESSED_BYTES` / `CORDEX_LIMITS_ZIP_MAX_TOTAL_UNCOMPRESSED_BYTES` | 否 |
| `limits.zip.maxCompressionRatio` / `limits.zip.maxMediaBytes` | 整数 | 100 / 256 MiB | 同上 | — | `CORDEX_LIMITS_ZIP_MAX_COMPRESSION_RATIO` / `CORDEX_LIMITS_ZIP_MAX_MEDIA_BYTES` | 否 |
| `limits.xml.maxDepth` / `limits.xml.maxAttributesPerElement` / `limits.xml.maxTextLength` / `limits.xml.maxAttributeValueLength` | 整数 | 见 [ADR-0019](../30-architecture/adr/0019-xml-lexer-and-fidelity-tree.md) 决策 6 的 XmlLimits 表 | 与 XmlLimits 字段一一对应，默认值与计量只在该表定义、本表不重述数值（2026-09-26，rulings §4.21 X:q-xml-lexer；`maxTextLength` 原名 `maxTextNodeBytes`，`maxAttributeValueLength` 为新增）；只可收紧，放宽不超过默认的 2 倍（OF-24），否则拒绝启动；遇 DOCTYPE 一律拒绝，不可配置 | — | `CORDEX_LIMITS_XML_MAX_DEPTH` / `CORDEX_LIMITS_XML_MAX_ATTRIBUTES_PER_ELEMENT` / `CORDEX_LIMITS_XML_MAX_TEXT_LENGTH` / `CORDEX_LIMITS_XML_MAX_ATTRIBUTE_VALUE_LENGTH` | 否 |
| `limits.fonts.maxEmbeddedBytes` / `limits.fonts.maxEmbeddedTotalBytes` | 整数 | 20 MB / 60 MB | PRD OF-17 | — | `CORDEX_LIMITS_FONTS_MAX_EMBEDDED_BYTES` / `CORDEX_LIMITS_FONTS_MAX_EMBEDDED_TOTAL_BYTES` | 否 |
| `limits.import.parseTimeoutMs` | 整数 | 60000 | 10000–300000 | — | `CORDEX_LIMITS_IMPORT_PARSE_TIMEOUT_MS` | 否 |

**协同限额的分层与 Hocuspocus 键的映射**（2026-09-26，rulings §4.21；H 证据 docPlan「§5.7 与 `limits.ws.*` 的映射」）。严格限额一律在适配层执行、在 Hocuspocus 之前生效，Hocuspocus 自身的同类参数只作兜底或内部机制：

| 关注点 | 权威键（适配层，先生效） | 对应的 Hocuspocus 参数（兜底或内部） |
|---|---|---|
| 认证期限 | `limits.ws.firstFrameTimeoutMs`（5 s，计到 `Authenticated`，4408） | `collab.hocuspocus.timeoutMs`（认证前绝对期限） |
| 空闲判死 | `limits.idleTimeoutMs`（45 s）+ `limits.ws.idleCheckIntervalMs`（5 s），4408 | `collab.hocuspocus.timeoutMs`（空闲超时） |
| 认证前与加载期间的排队 | `limits.ws.preAuthMaxFrames` / `preAuthMaxBytes`（只计到 `Authenticated`，4205）；`limits.ws.authTokenMaxBytes`（4400） | `collab.hocuspocus.maxUnauthenticatedQueue*`（宽上限，覆盖加载期间，超限 4205） |
| 单帧大小 | `limits.maxUpdateBytes`（1 MiB，4413）；step2 例外为 `limits.ws.step2MaxBytes`（16 MiB，4413） | ws `maxPayload` = `limits.ws.step2MaxBytes`（Hocuspocus 本身没有单帧门禁） |
| 帧速率与写入量 | `limits.msgRateHz` / `limits.msgBurst`、`limits.updateBytesPerMin` | 无（Hocuspocus 没有消息速率限制） |
| 连接数 | `limits.ws.maxConnectionsPerInstance`、`limits.ws.maxConnectionsPerUser`、`limits.ws.connectPerIpPerMin` | 无（`maxPendingDocuments` 固定为 1） |
| 满员 awareness 合并 | `limits.awarenessTickThreshold` / `limits.awarenessTickMs`（包装 `Connection.send`，只合并 awareness 帧） | `collab.hocuspocus.flushDelayMs`（文档级，不用于 awareness） |

**图 5-1 一个协同帧依次经过的限额层**

```mermaid
flowchart LR
  up["WS 升级"]
  pre["升级前：UUID、Origin、ws-connect 桶、实例与每用户连接数"]
  auth["认证期限 limits.ws.firstFrameTimeoutMs 与 preAuthMax*"]
  l1["帧预过滤 L1：maxUpdateBytes 或 ws.step2MaxBytes、msgRate、updateBytesPerMin"]
  idle["空闲判死 limits.idleTimeoutMs"]
  queue["Hocuspocus 连接队列：maxUnauthenticatedQueue* 宽上限"]
  gate["钩子：L2、L3 门禁与落库，L4 修复"]
  fallback["Hocuspocus timeout：只兜底"]
  up --> pre --> auth --> l1 --> queue --> gate
  idle -. "逐帧计时" .-> l1
  fallback -. "兜底" .-> queue
```

怎么读：实线是一个帧从升级到进入门禁经过的层，左边的层先生效；虚线是两个计时器，适配层的空闲判死按帧计时，Hocuspocus 的 `timeout` 只在适配层计时器失效时兜底。

依据：rulings §4.21 q-ws-gateway 与 H:q-hp-step2-cap；H-d-04、H-d-07、H-d-20；ADR-0039「Hocuspocus 配置」「故障模式与加固」。

`limits.rate` 各档默认（perMin / burst）：`default` 600 / 100、`upload` 60 / 20、`job` 60 / 10、`ticket` 120 / 30、`search` 30 / 10、`public` 300 / 100 取自 15 §8（已评审定稿，rulings §4.20 BE-02）；`telemetryErrors` 6 / 5、`telemetryOtlp` 60 / 20、`csp` 30 / 10 取自 18 §9.1（`csp` 另有全局每秒 100 次，为常量）。档名同时是 Valkey 桶名 `rl:{档}:{subject}`；WS 升级限流不在此列，用 `limits.ws.connectPerIpPerMin`（桶 `ws-connect`）。

### 5.9 规模与配额

| 路径 | 类型 | 默认 | 范围 / 校验 | 生产必填 | 环境变量 | 机密 |
|---|---|---|---|---|---|---|
| `scale.maxPages` / `scale.softWarnPages` | 整数 | 200 / 150 | soft ≤ max；> 200 为超包络（§7） | — | `CORDEX_SCALE_MAX_PAGES` / `CORDEX_SCALE_SOFT_WARN_PAGES` | 否 |
| `scale.maxElementsPerSlide` | 整数 | 1000 | > 1000 为超包络 | — | `CORDEX_SCALE_MAX_ELEMENTS_PER_SLIDE` | 否 |
| `scale.maxElementsPerDoc` / `scale.softWarnElementsPerDoc` | 整数 | 20000 / 15000 | 墓碑计入；> 20000 为超包络 | — | `CORDEX_SCALE_MAX_ELEMENTS_PER_DOC` / `CORDEX_SCALE_SOFT_WARN_ELEMENTS_PER_DOC` | 否 |
| `scale.maxFileBytes` | 整数 | 209715200 | 单文件导入上限 200 MiB；更大为超包络 | — | `CORDEX_SCALE_MAX_FILE_BYTES` | 否 |
| `quota.storageTotalBytes` / `quota.storagePerUserBytes` / `quota.documentsPerUser` | 整数或空 | 空（不限） | 超限 `storage.quota_exceeded`（按 owner 汇总，决策 G-09） | — | `CORDEX_QUOTA_STORAGE_TOTAL_BYTES` / `CORDEX_QUOTA_STORAGE_PER_USER_BYTES` / `CORDEX_QUOTA_DOCUMENTS_PER_USER` | 否 |
| `quota.commentThreadsPerDoc` / `quota.namedSnapshotsPerDoc` | 整数 | 5000 / 200 | PRD SV-08 | — | `CORDEX_QUOTA_COMMENT_THREADS_PER_DOC` / `CORDEX_QUOTA_NAMED_SNAPSHOTS_PER_DOC` | 否 |

### 5.10 溢写

依据：决策 SPILL（规格空白；阈值只收紧）。在 M2 前落地的自托管专用 runner 上压测校准（rulings §4.19 D-TEST-INFRA），只能收紧。

| 路径 | 类型 | 默认 | 范围 / 校验 | 生产必填 | 环境变量 | 机密 |
|---|---|---|---|---|---|---|
| `spill.tier1MaxBytesPerDoc` | 整数 | 16777216 | 16 MiB；超出后转二级（对象存储分块） | — | `CORDEX_SPILL_TIER1_MAX_BYTES_PER_DOC` | 否 |
| `spill.tier1MaxBytesPerInstance` | 整数 | 268435456 | 256 MiB | — | `CORDEX_SPILL_TIER1_MAX_BYTES_PER_INSTANCE` | 否 |
| `spill.tier2ChunkBytes` | 整数 | 4194304 | 4 MiB | — | `CORDEX_SPILL_TIER2_CHUNK_BYTES` | 否 |

### 5.11 保留期与墓碑

语义与执行者见 [14 §8](./14-valkey-object-storage-and-retention.md)，两处键集合逐项一致。依据：决策 RETENTION、rulings §4.19 C-06、决策 C-24。

`retention.autoSnapshotDailyDays` 默认 365（0 = 永久），rulings §4.19 C-06 已裁定；rulings §4.19 D-M2-CONTENT 裁定不设 pptx 内容版本，`retention.contentRevisions` 与 `collab.room.importWaitMs` 两个键已删除（登记在 §5.14 废止键表，出现即拒绝启动）。

| 路径 | 类型 | 默认 | 范围 / 校验 | 生产必填 | 环境变量 | 机密 |
|---|---|---|---|---|---|---|
| `retention.trashDays` | 整数 | 30 | 1–365 | — | `CORDEX_RETENTION_TRASH_DAYS` | 否 |
| `retention.updatesDays` | 整数 | 7 | 1–90 | — | `CORDEX_RETENTION_UPDATES_DAYS` | 否 |
| `retention.autoSnapshotDays` | 整数 | 30 | 1–365 | — | `CORDEX_RETENTION_AUTO_SNAPSHOT_DAYS` | 否 |
| `retention.autoSnapshotDailyDays` | 整数 | 365（rulings §4.19 C-06） | 0 = 永久；否则 ≥ `autoSnapshotDays` | — | `CORDEX_RETENTION_AUTO_SNAPSHOT_DAILY_DAYS` | 否 |
| `retention.importOriginalDays` | 整数 | 30 | 1–365 | — | `CORDEX_RETENTION_IMPORT_ORIGINAL_DAYS` | 否 |
| `retention.exportHours` | 整数 | 24 | 1–168 | — | `CORDEX_RETENTION_EXPORT_HOURS` | 否 |
| `retention.mediaUnreferencedDays` | 整数 | 30 | 1–365 | — | `CORDEX_RETENTION_MEDIA_UNREFERENCED_DAYS` | 否 |
| `retention.auditDays` | 整数 | 365 | 30–3650；按整月删除分区 | — | `CORDEX_RETENTION_AUDIT_DAYS` | 否 |
| `retention.jobRunsDays` | 整数 | 90 | 7–3650 | — | `CORDEX_RETENTION_JOB_RUNS_DAYS` | 否 |
| `retention.webhookDeliveriesDays` | 整数 | 90 | 7–3650 | — | `CORDEX_RETENTION_WEBHOOK_DELIVERIES_DAYS` | 否 |
| `retention.uploadTmpHours` | 整数 | 24 | 1–168 | — | `CORDEX_RETENTION_UPLOAD_TMP_HOURS` | 否 |
| `retention.erasure.commentBody` | 枚举 | `keep` | `keep`、`redact`；`redact` 在 M4 实现前配置即拒绝启动 | — | `CORDEX_RETENTION_ERASURE_COMMENT_BODY` | 否 |
| `tombstone.ttlHours` | 整数 | 24 | 1–720（rulings §4.15 Q3、§4.18 BE-24） | — | `CORDEX_TOMBSTONE_TTL_HOURS` | 否 |
| `tombstone.sweepIntervalMs` | 整数 | 600000 | 60000–3600000（`tombstone-sweeper` 对本实例活跃房间的清扫间隔，[05 §8](./05-modules-collab-and-snapshots.md)） | — | `CORDEX_TOMBSTONE_SWEEP_INTERVAL_MS` | 否 |

### 5.12 作业、headless 与字体

| 路径 | 类型 | 默认 | 范围 / 校验 | 生产必填 | 环境变量 | 机密 |
|---|---|---|---|---|---|---|
| `jobs.import.concurrency` / `jobs.export.concurrency` | 整数 | 4 / 4 | 1–32（每 worker 实例，rulings §4.18 BE-28） | — | `CORDEX_JOBS_IMPORT_CONCURRENCY` / `CORDEX_JOBS_EXPORT_CONCURRENCY` | 否 |
| `jobs.webhookDelivery.concurrency` | 整数 | 4 | 1–32（重试上限 8 次为固定值，BE-19） | — | `CORDEX_JOBS_WEBHOOK_DELIVERY_CONCURRENCY` | 否 |
| `headless.mode` | 枚举 | `remote` | `remote`、`local`（ADR-0037 为这两个键的事实源） | — | `CORDEX_HEADLESS_MODE` | 否 |
| `headless.endpoint` | URL | `http://renderer:3000`（renderer 的 `http.port`） | `remote` 时必填；只在 render 网络可达 | worker（remote） | `CORDEX_HEADLESS_ENDPOINT` | 否 |
| `headless.poolSize` | 整数 | 2 | 1–16（`remote`：每个 renderer 进程的并发页数，worker 的 `RendererPool` 容量也取此值——按单个 worker、1 个 renderer 副本计，多 worker 或多副本时的超额由 renderer 的 503 背压兜底，[06 §10.5](./06-modules-jobs-import-export-thumbnails.md)；`local`：worker 进程内 Chromium 池大小，[06 §8.2](./06-modules-jobs-import-export-thumbnails.md)）；不设副本数键，M4 Helm 横向扩容时再加（rulings §4.20 BE-08+TX-07） | — | `CORDEX_HEADLESS_POOL_SIZE` | 否 |
| `headless.pageTimeoutMs` | 整数 | 10000 | 每页渲染超时，注入完成后计时（决策 SG-01）；注入等待是 `/render` 页常量 60 s，不设配置键（rulings §4.18 FE-09） | — | `CORDEX_HEADLESS_PAGE_TIMEOUT_MS` | 否 |
| `headless.renderSigningKeyFile` | 路径 | — | Ed25519 私钥；只有 worker 持有 | worker（remote） | `CORDEX_HEADLESS_RENDER_SIGNING_KEY_FILE` | 是 |
| `headless.renderVerifyKeyFile` | 路径 | — | 对应公钥；只有 renderer 持有（公钥不是凭据，renderer 仍零出站） | renderer | `CORDEX_HEADLESS_RENDER_VERIFY_KEY_FILE` | 否 |
| `headless.worker.maxThreads` | 整数 | `min(4, CPU 数)` | 1–32；worker 进程内同时存在的导入导出任务线程上限（[06 §8.2](./06-modules-jobs-import-export-thumbnails.md)） | — | `CORDEX_HEADLESS_WORKER_MAX_THREADS` | 否 |
| `headless.worker.memoryLimitMb` / `headless.worker.timeoutMs` | 整数 | 2048 / 60000 | 每个任务线程的老生代上限与墙钟超时；`maxThreads × memoryLimitMb` 超过容器内存 70% 时启动告警（同 §7） | — | `CORDEX_HEADLESS_WORKER_MEMORY_LIMIT_MB` / `CORDEX_HEADLESS_WORKER_TIMEOUT_MS` | 否 |
| `fonts.extraDirs` | 路径数组 | 空 | 只读目录（rulings §4.16 Q19） | — | `CORDEX_FONTS_EXTRA_DIRS` | 否 |

### 5.13 遥测

| 路径 | 类型 | 默认 | 范围 / 校验 | 生产必填 | 环境变量 | 机密 |
|---|---|---|---|---|---|---|
| `telemetry.otlpEndpoint` | URL | `http://otel-collector:4317` | Node 进程走 OTLP/gRPC（30-architecture/10、[18](./18-observability-and-ops-endpoints.md) §3）；浏览器 traces 由 `/telemetry/otlp` 代理转发到 Collector 的 OTLP/HTTP 4318；renderer 强制关闭 OTLP 导出 | — | `CORDEX_TELEMETRY_OTLP_ENDPOINT` | 否 |
| `telemetry.tracesSampleRatio` | 小数 | 0.1 | 0–1（错误路径在 Collector 尾采样，ADR-0030 决策 6） | — | `CORDEX_TELEMETRY_TRACES_SAMPLE_RATIO` | 否 |
| `telemetry.tracesUpdateSampleRatio` | 小数 | 0.01 | 0–1；WS update 帧处理 span 的独立抽样（[18](./18-observability-and-ops-endpoints.md) §3） | — | `CORDEX_TELEMETRY_TRACES_UPDATE_SAMPLE_RATIO` | 否 |
| `telemetry.browser.errors.enabled` / `telemetry.browser.traces.enabled` | 布尔 | `true` / `true` | 关闭时 `/telemetry/errors`、`/telemetry/otlp` 照常 204 并丢弃（[18 §9.1](./18-observability-and-ops-endpoints.md)） | — | `CORDEX_TELEMETRY_BROWSER_ERRORS_ENABLED` / `CORDEX_TELEMETRY_BROWSER_TRACES_ENABLED` | 否 |
| `telemetry.metricsExporter` | 枚举 | `prometheus` | `prometheus`、`otlp` | — | `CORDEX_TELEMETRY_METRICS_EXPORTER` | 否 |
| `telemetry.logLevel` | 枚举 | `info` | `fatal`…`trace` | — | `CORDEX_TELEMETRY_LOG_LEVEL` | 否 |

### 5.14 废止的键（出现即拒绝启动，并提示新键）

| 旧键 | 新键 |
|---|---|
| `room.*`（`countBy`、`ownerReservedSeat`、`commenterCountsAs`、`maxEditors`、`maxViewers`、`weightBudgetBytes`） | `collab.room.*`；前三项改为固定规则 |
| `compaction.everyUpdates`、`compaction.everyMinutes` | `collab.compaction.maxPendingUpdates`、`collab.compaction.maxAgeMs` |
| `retention.documentUpdatesDays`、`retention.importSourceDays`、`retention.softDeleteDays`、`retention.namedSnapshots` | `retention.updatesDays`、`retention.importOriginalDays`、`retention.trashDays`、`quota.namedSnapshotsPerDoc` |
| `limits.maxFrameBytes`、`limits.updateRateHz`、`limits.zip`（单值）、`limits.rest.perUserPerMin`、`limits.upload.perUserPerMin`、`limits.jobs.perUserPerMin`、`limits.usersSearch.perUserPerMin`、`limits.telemetry.*` | `limits.maxUpdateBytes`、`limits.msgRateHz`、`limits.zip.*`、`limits.rate.<档>.*`（§5.8） |
| `db.url`、`db.poolMax`、`redis.url` | `db.*`（按池拆分）、`valkey.url` |
| `auth.jwt.keys`、`auth.jwt.ttl` / `auth.jwt.ttlSec`、`auth.ticketTtlSec`、`auth.refresh.ttlDays` / `auth.refresh.absoluteDays`、`auth.sessionCheckSec` | `auth.jwt.signingKeysFile` / `verifyKeysFile`、`auth.session.accessTtlSec`、`auth.ticket.ttlSec`、`auth.session.refreshTtlSec` / `auth.session.absoluteTtlSec`、`auth.session.revocationCacheMs` |
| `webhookEgressAllowlist` | `webhooks.egressAllowlist` |
| `renderer.*` | `headless.*`（ADR-0037 决策 3） |
| `externalResources` | web 容器的 `CORDEX_WEB_EXTERNAL_RESOURCES`（服务端永不加载外链，不需要该项） |
| `scale.maxUploadBytes` | `scale.maxFileBytes`（导入）、`limits.media.maxBytes`（媒体） |
| `retention.contentRevisions`、`collab.room.importWaitMs` | 无（rulings §4.19 D-M2-CONTENT：不设 pptx 内容版本） |
| `headless.injectTimeoutMs` | 无（注入等待为 `/render` 页常量 60 s，rulings §4.18 FE-09） |
| `browserPool.*` | `headless.poolSize`（`local` 与 `remote` 共用） |
| `limits.xml.maxTextNodeBytes`（环境变量 `CORDEX_LIMITS_XML_MAX_TEXT_NODE_BYTES`） | `limits.xml.maxTextLength`（环境变量 `CORDEX_LIMITS_XML_MAX_TEXT_LENGTH`；2026-09-26，ADR-0019 决策 6：计量改为源文 UTF-16 码元数，与 XmlLimits 字段同名） |

应用层 `CONTROL.ping` / `pong` 随 Hocuspocus 删除（H-d-07），服务端从来没有独立的 ping 配置键，空闲判死沿用 `limits.idleTimeoutMs`（语义见 §5.8）；客户端的 `heartbeatMs`（`collab-transport-ws`）属前端配置，不在本表。

### 5.15 web 容器键（RuntimeConfig 渲染，不属于应用 `config.schema.ts`）

前端文档以 `web.*` 路径引用的部署键登记在此；它们由 web 容器在启动时读取并渲染（§3.3），应用容器忽略 `CORDEX_WEB_*`（§6），环境变量名沿用 §3.6 的既有名称、不走 §6 的机械映射。

| 路径 | 类型 | 默认 | 范围 / 校验 | 环境变量 | 渲染到 |
|---|---|---|---|---|---|
| `web.embed.allowedHostOrigins` | `https://` 源数组 | 空 | 空 = `/embed/*` 的 `frame-ancestors 'none'`（默认禁止任何站点嵌入）；非空时同一份值写进 `/embed/*` 的 CSP `frame-ancestors`（[50/14](../50-frontend/14-client-security.md) §2）与 RuntimeConfig `embed.allowedHostOrigins`（[50/02](../50-frontend/02-app-shell-routing-and-session.md) §3，postMessage 来源白名单，[50/12](../50-frontend/12-viewer-embedding-and-render-page.md) §9） | `CORDEX_WEB_EMBED_ALLOWED_ORIGINS` | CSP、RuntimeConfig |
| `web.diagnostics.e2eTrace` | 布尔 | `false` | 生产部署配置拒绝其为真：值为 `true` 而 `CORDEX_WEB_ENV` ≠ `test` 时容器拒绝启动（与 `CORDEX_WEB_AUTH_MODE` 只接受 `oidc` 同类约束）；只在 e2e 预览服务器与测试 compose 栈开启 | `CORDEX_WEB_DIAGNOSTICS_E2E_TRACE` | RuntimeConfig `diagnostics.e2eTrace` |

### 5.16 插件（2026-10-01，rulings §4.23）

插件只经两条路进入部署：**镜像内置**（随 `cordex-web` 与 `cordex-server` 构建的第一方插件，随镜像 digest 与 SBOM 受信，§4）与**挂载目录**（部署方把审核过或签名过的第三方插件包放进只读挂载目录，M4）；二者都由一份**插件声明文件**列出（PRD [09-plugin-manager](../10-prd/03-features/09-plugin-manager.md) PM-04、PM-05）。界面与 REST 都不提供上传、URL 安装或下载（[15 §3.15](./15-rest-api-catalog.md)）。

| 路径 | 类型 | 默认 | 范围 / 校验 | 生产必填 | 环境变量 | 机密 |
|---|---|---|---|---|---|---|
| `plugins.catalogFile` | 文件路径 | 空 | 空 = 只有镜像内置插件、取 preset 默认组成（与 M2 行为相同）；已配置时文件须存在、可解析、通过下文 schema，否则退出码 78；容器重启才重新读取，不热加载 | — | `CORDEX_PLUGINS_CATALOG_FILE` | 否 |
| `plugins.mountDir` | 目录路径 | `/opt/cordex/plugins` | 只读挂载；声明文件中挂载条目的 `source` 是相对它的路径，规范化后越出本目录的条目被拒（`manifest_invalid`） | — | `CORDEX_PLUGINS_MOUNT_DIR` | 否 |
| `plugins.trustedKeysFile` | 文件路径 | 空 | 受信 Ed25519 公钥列表（JSON：`[{keyId, publicKey, note?}]`，`publicKey` 为 32 字节原始公钥的 base64）；为空时挂载目录插件只能靠审核记录通过 | — | `CORDEX_PLUGINS_TRUSTED_KEYS_FILE` | 否（公钥） |
| `plugins.allowUnsigned` | 布尔 | `false` | 非生产部署可显式允许未签名、无审核记录的挂载插件；`NODE_ENV=production` 时为 `true` 即退出码 78（与 §5.15 `web.diagnostics.e2eTrace` 同类约束）；为 `true` 时管理员界面整页警示条 | — | `CORDEX_PLUGINS_ALLOW_UNSIGNED` | 否 |
| `plugins.policyPollSeconds` | 整数 | 60 | 10–300；collab 读 `plugin_policies` 重算 `policy` 摘要的兜底周期（`plugins:ctl` 丢消息时，在线会话最迟在该周期内收到「插件设置已更新」，[16 §12](./16-ws-protocol-server-view.md)） | — | `CORDEX_PLUGINS_POLICY_POLL_SECONDS` | 否 |

**声明文件格式**（`cordex-plugins.json`，`schemaVersion: 1`；schema 在 `@cordexjs/protocol` 的 `plugins/catalog.ts`，与 `cordex-ops plugins:check` 共用）：

```json
{
  "schemaVersion": 1,
  "plugins": [
    { "id": "@cordexjs/slide-render-chart", "version": "1.4.0", "source": "builtin",
      "initial": { "state": "forced" } },
    { "id": "acme:status-clock", "version": "2.1.0", "source": "acme-status-clock-2.1.0",
      "sha256": "9f2c…（64 位十六进制）", "signature": "acme-status-clock-2.1.0.sig",
      "initial": { "state": "optional", "defaultOn": false } },
    { "id": "acme:qr-shape", "version": "1.2.0", "source": "acme-qr-shape-1.2.0",
      "sha256": "41ab…", "review": { "by": "安全组 张三", "date": "2026-11-02", "link": "https://intra.example/review/118" },
      "initial": { "state": "disabled" }, "lockPolicy": false,
      "config": { "defaultSize": 96 } }
  ]
}
```

- 每项必填 `id`、`version`（精确版本，同一插件一次部署只有一个版本）、`source`（`builtin` 或挂载目录内相对路径）、`initial.state`（`forced` \| `optional` \| `disabled`；`optional` 必带 `defaultOn`）；挂载条目另须 `sha256`（包摘要）与 `signature`（相对路径，Ed25519 分离签名，签的是包的 SHA-256）或 `review`（审核人、日期、依据链接）二者之一。可选 `lockPolicy`（管理员界面只读）、`scope`（只能写 `content`，把界面级升为内容级；写 `ui` 而清单推出为 `content` 时该项被拒 `scope_downgrade`）、`config`（初始配置，须过插件 Config schema；机密字段不得写在这里，只能经 `*File` 机密文件）。
- 未写 `initial` 的镜像内置条目：第一方可选插件默认 `forced`（保持 preset 默认组成），第三方默认 `disabled`。镜像内置插件未出现在声明文件里时按其 preset 默认条目处理。
- **格式错误即拒绝启动**（退出码 78，`--dry-run` 同样覆盖）；**单项校验失败只拒绝该项**，部署照常启动：校验项与原因码见 [03 §12.3](./03-modules-identity-and-access.md)，被拒项写审计 `plugin.rejected`（[07 §9.5](./07-modules-comments-webhooks-audit.md)），`/readyz` 附 `pluginsRejected: [{id, version, reason}]`（不置为未就绪，[18](./18-observability-and-ops-endpoints.md) §6），强制启用的插件被拒时启动日志 `warn`。
- 应用容器（全部角色）与 web 容器读同一份文件：前者做校验与装配，后者只据此渲染 `/plugins/{sha256}/` 静态路径（§3.1、§3.6）。签名校验用 `node:crypto` 的 Ed25519，不引入新依赖（[19](./19-reuse-and-dependency-catalog.md)）。

**图 5-16 插件声明文件的启动校验**

```mermaid
flowchart TD
  read["读取 plugins.catalogFile"]
  empty{"已配置"}
  builtinOnly["只有镜像内置：preset 默认组成"]
  parse{"可解析且通过 schema"}
  exit78["退出码 78"]
  prod{"production 且 allowUnsigned 为 true"}
  each["逐项部署时校验：摘要、签名或审核、清单、hostApi、同构类、前缀、作用域、配置、重复与 Provider 座"]
  ok["通过：进入可用清单，按策略装配"]
  rej["被拒：写 plugin.rejected，readyz 附 pluginsRejected"]
  start["继续启动，计算插件集指纹"]
  read --> empty
  empty -->|"否"| builtinOnly --> start
  empty -->|"是"| parse
  parse -->|"否"| exit78
  parse -->|"是"| prod
  prod -->|"是"| exit78
  prod -->|"否"| each
  each --> ok --> start
  each --> rej --> start
```

怎么读：文件级问题（不可解析、违反 schema、生产环境允许未签名）让整个进程以 78 退出；逐项问题只把那一项挡在可用清单之外，部署照常启动。镜像内置插件同样走逐项校验（M3 只做清单与 hostApi，M4 起挂载条目加签名或审核）。
依据：本节；[03 §12.3](./03-modules-identity-and-access.md)；rulings §4.23 第 2 题；PRD PM-04、PM-05。

## 6. 环境变量命名、机密来源与启动校验

**命名规则**（机械映射，§12 CFG-01 核对唯一性）：`CORDEX_` + 路径各段转大写蛇形、以 `_` 连接（`collab.room.maxEditors` → `CORDEX_COLLAB_ROOM_MAX_EDITORS`）；数组用逗号分隔；布尔只认 `true` / `false`。`NODE_ENV` 是唯一不带前缀的变量。
- 应用容器忽略 `CORDEX_WEB_*`（属于 web 容器）；其余**未登记或已废止**的 `CORDEX_*` 变量一律拒绝启动（防止拼错的键被静默忽略）。
- **机密只从文件读**：键名以 `File` 结尾、变量以 `_FILE` 结尾，指向只读挂载的文件（compose 的 `./secrets`、K8s Secret 卷或密钥管理器注入的文件）；文件须存在、非空、权限不宽于 0400。production 下若以明文变量直接给出口令类值即拒绝启动。
- 启动后日志与 `--dry-run` 输出一律把机密显示为 `***`。

**角色 × 机密矩阵**（启动断言；「禁止」项存在即退出码 78。`all` = api ∪ collab ∪ worker 的要求）：

| 机密（配置键） | api | collab | worker | renderer | ops 命令 |
|---|---|---|---|---|---|
| `db.app.passwordFile` | 必需 | 必需 | 必需 | 禁止 | 仅 `audit-verify` |
| `db.system.passwordFile` | **禁止** | 必需 | 必需 | 禁止 | 仅 `jobs:replay`、`webhooks:replay`、`thumbnails:rebuild`、`documents:reassign-owner` |
| `db.migrator.passwordFile` | 禁止 | 禁止 | 禁止 | 禁止 | `db:migrate`、`db:status`、`audit-rotate` |
| `valkey.passwordFile` | 可选 | 可选 | 可选 | 禁止 | 可选 |
| `storage.s3.accessKeyIdFile` 与 `secretAccessKeyFile` | 必需 | 必需 | 必需 | 禁止 | 必需（`storage:init`） |
| `auth.oidc.clientSecretFile` | 必需 | 禁止 | 禁止 | 禁止 | — |
| `auth.jwt.signingKeysFile` | 必需 | 禁止 | 禁止 | 禁止 | — |
| `secrets.kekFile` | 必需（加密） | 禁止 | 必需（投递时解密） | 禁止 | — |
| `ops.tokenFile` | 必需 | 必需 | 必需 | 禁止 | — |
| `audit.hashSaltFile` | 必需 | 必需 | 必需 | 禁止 | — |
| `headless.renderSigningKeyFile` | 禁止 | 禁止 | 必需（`remote`） | 禁止 | — |

renderer 只接受 `headless.renderVerifyKeyFile`（公钥）与 `fonts.extraDirs`；检测到上表任何一项即拒绝启动（rulings §4.18 BE-14）。collab 验会话与票据只用公钥 `auth.jwt.verifyKeysFile`，签发只在 api——任何被攻破的 collab 实例都无法伪造会话。

**`--dry-run`**：`node dist/main.js --dry-run`（或 `cordex-ops config:check`）完成下图全部校验后打印脱敏的生效配置并以 0 退出，失败以 78 退出；compose 的 `migrate` 作业与 CI 都先跑一次。

**图 6-1 配置加载与启动校验**

```mermaid
flowchart TD
  envIn["读取环境变量：CORDEX_*，忽略 CORDEX_WEB_*"] --> unk{"存在未登记或已废止的键"}
  unk -- "是" --> exit78["打印字段路径与新键名提示，退出码 78"]
  unk -- "否" --> files["读取 *_FILE：存在、非空、权限不宽于 0400"]
  files -- "失败" --> exit78
  files --> parse["zod 解析：类型、默认值、范围"]
  parse -- "失败" --> exit78
  parse --> cross["交叉断言：production 必填项、角色 × 机密矩阵、headless.mode 与 endpoint、限额放宽不超过 2 倍"]
  cross -- "失败" --> exit78
  cross --> env{"超出性能保证包络"}
  env -- "是" --> warn["启动告警；/readyz 附 scaleEnvelopeExceeded"]
  env -- "否" --> dry{"带 --dry-run"}
  warn --> dry
  dry -- "是" --> print["打印脱敏后的生效配置，退出码 0"]
  dry -- "否" --> start["注入 AppConfig，进入角色装配断言，见 01"]
```

怎么读：自上而下是一次启动的配置阶段；任何一步失败都汇入同一个出口（退出码 78，EX_CONFIG），不会带着部分配置继续启动。超包络只告警不阻止启动，因为规模数字是部署方有权调大的（性能承诺随之失效）。
依据：PRD SV-09「配置经 Standard Schema 校验、--dry-run」；本文 §5–§6（`config.module.ts` 的文件级见 40/12 §4.10）；ADR-0037「如何被机械验证」；rulings §4.15 Q5。

## 7. 规模配置与超包络告警

依据：rulings §4.15 Q5（性能保证包络与系统天花板两层口径）；PRD SV-08。性能保证包络 = D200、DX-1000、20 编辑者 + 50 查看者、200 MB；系统天花板 = 200 页 / 单页 1,000 / 文档总元素 20,000。默认值即包络上沿。

| 键 | 默认 | 调小 | 调大 |
|---|---|---|---|
| `scale.maxPages`、`scale.maxElementsPerSlide`、`scale.maxElementsPerDoc` | 200、1000、20000 | 允许，性能承诺保持 | 允许；启动告警、`/readyz` 响应体 `scaleEnvelopeExceeded` 列出这些键（仍返回 200），性能承诺不再成立 |
| `scale.maxFileBytes` | 200 MiB | 同上 | 同上 |
| `collab.room.maxEditors`、`collab.room.maxViewers` | 20、50 | 同上 | 同上 |
| `limits.zip.*`、`limits.xml.*` | zip 见 [06 §6.3](./06-modules-jobs-import-export-thumbnails.md) 表；XML 见 [ADR-0019](../30-architecture/adr/0019-xml-lexer-and-fidelity-tree.md) 的 XmlLimits 表 | 允许 | 最多放宽到默认的 2 倍（OF-24），超过即退出码 78 |
| `spill.*` | §5.10 | 允许 | 不建议；M2 自托管 runner 压测后只收紧 |

超包络时另有指标与告警（名称见 [18](./18-observability-and-ops-endpoints.md)）。

## 8. 按角色拆分部署与副本建议

装配内容以 [01](./01-service-overview-and-roles.md) 的「模块 × 角色 × 部件」矩阵为准；这里只给部署形态。拆分时 web 容器的 `CORDEX_WEB_UPSTREAM_API` 与 `CORDEX_WEB_UPSTREAM_COLLAB` 分别指向 api 与 collab。

| 角色 | 副本建议 | 伸缩依据 | 资源口径 | 注意 |
|---|---|---|---|---|
| api | ≥ 2 | CPU、请求率 | 无状态 | 只有 app 连接池；不装快照 REST 与管理动作 |
| collab | M2：1（单实例 `all`，不装 extension-redis）；M3 起 ≥ 2（滚动发布时房间不整体断连） | 连接数 ≤ `limits.ws.maxConnectionsPerInstance`；房间权重内存 ≤ cgroup 限额 × `collab.room.memoryAdmissionPct` | RM-S：2 vCPU / 4 GB 是 collab **单实例**口径（ADR-0035） | `stop_grace_period` ≥ 40 s（排空 30 s）；多副本必须装 extension-redis（[19](./19-reuse-and-dependency-catalog.md) §3），负载均衡按 `documentId` 一致性哈希（§3.1，偏好亲和、非会话粘性；2026-09-26 由「无粘性、可选哈希」改为默认哈希，rulings §4.21 H:q-hp-fanout） |
| worker | ≥ 1 | 队列深度 | 每实例导入 / 导出并发各 4 | 周期作业经 Job Scheduler 注册，多副本不重复执行 |
| renderer | 按渲染并发 | 渲染队列深度 | 内存 request 2 GiB，每进程并发 2 页（ADR-0026 决策 7） | 与 worker 同版本；只挂 render 网络 |

```yaml
# 拆分部署节选：替换 §2.3 的 app 服务；其余服务不变
  api:
    image: cordex-server@sha256:…
    environment: { CORDEX_ROLE: api }
    networks: [edge, backend]
  collab:
    image: cordex-server@sha256:…
    environment: { CORDEX_ROLE: collab }
    networks: [edge, backend]
    stop_grace_period: 40s
    deploy: { replicas: 2 }
  worker:
    image: cordex-server@sha256:…
    environment: { CORDEX_ROLE: worker }
    networks: [edge, backend, render]   # edge 只用于 Webhook 出站
```

**图 8-1 按角色拆分部署与伸缩依据**

```mermaid
flowchart LR
  lb["web 容器或 Ingress：collab 按 documentId 一致性哈希"]
  api["api × N：无状态"]
  collab["collab × N：多副本 Room"]
  worker["worker × N"]
  renderer["renderer × N：只接受 worker 入站"]
  pg[("Postgres 18")]
  vk[("Valkey")]
  s3[("对象存储：data 与 snapshots")]
  lb -- "/api/v1" --> api
  lb -- "/collab、快照、元素彻底删除" --> collab
  api --> pg & vk & s3
  collab --> pg & vk & s3
  worker --> pg & vk & s3
  worker -- "签名 RPC，render 网络" --> renderer
  hApi["伸缩：CPU 与请求率"] -.-> api
  hCollab["伸缩：连接数与房间权重内存"] -.-> collab
  hWorker["伸缩：队列深度"] -.-> worker
  hRend["伸缩：渲染队列深度，2 GiB"] -.-> renderer
```

怎么读：实线是请求与数据访问，虚线框是各角色的伸缩依据。四个角色可以各自扩缩；collab 多副本的一致性靠 extension-redis 经 Valkey 同步与 CRDT 收敛，按 `documentId` 哈希只是偏好亲和——同一文档常态只落在一个实例，省掉跨实例同步每次变更 O(文档) 的差量计算，但正确性不依赖它；renderer 只能被 worker 调用。
依据：ADR-0035 决策 1–9 与修订；ADR-0037 决策 1、3；ADR-0039 决策 7；rulings §4.21 H:q-hp-fanout；原 30/08 篇 §10.2。

## 9. 数据库迁移作业与 ops 命令

`cordex-ops` 是 `cordex-server` 镜像里的第二个入口，可在一次调用里按序执行多个子命令，首个失败即退出。本节管命令语义；入口文件 `apps/server/src/ops/cli.ts`（与 `main.ts` 同级、共用 `config/` 解析）与「子命令 → 所属模块用例」对照的文件级登记在 [40/12 §4.13](../40-modules/12-server-jobs-comments-and-ops.md)（rulings §4.20 BE-06）。子命令只调用各模块公开导出的用例，不直接写表。参数解析用 `commander` 15，`cron` 子命令的调度用 `croner` 10（版本与替代见 [19](./19-reuse-and-dependency-catalog.md) §11；2026-09-26 补登 `cron` 子命令，R-d-42）。

| 命令 | 作用 | 数据库 / 存储身份 | compose 入口 | Helm 入口（M4） |
|---|---|---|---|---|
| `db:bootstrap` | 执行 0001；从 `*_FILE` 设置三个角色的口令；建 `casdoor` 库与角色 | 数据库管理员 | postgres 首次初始化钩子（同一份 0001 SQL + 设口令脚本） | 由 DBA 执行一次，或 pre-install Job |
| `db:migrate` | 应用台账里没有的迁移（[08 §10.2](./08-db-conventions-roles-rls-migrations.md)） | `cordex_migrator` | `migrate` 一次性服务 | pre-upgrade Job |
| `db:status` | 列出已应用与待应用的迁移 | `cordex_migrator` | 手动 | 手动 |
| `storage:init` | 建两个桶、版本化、生命周期规则、CORS，并读回核对（[14 §5](./14-valkey-object-storage-and-retention.md)） | S3 凭据 | `migrate` 一次性服务 | pre-upgrade Job |
| `audit-rotate` | 预建未来 3 个月审计分区；`DETACH … CONCURRENTLY` + `DROP` 整月早于 `retention.auditDays` 的分区（幂等） | `cordex_migrator` | `ops-cron` 每日 03:00 | CronJob 每日 |
| `cron` | 常驻进程：按内置时刻表执行定时子命令，目前只有 `audit-rotate`（每日 03:00，容器时区默认 UTC，时刻为代码常量）；上一次未结束时跳过本次并记 `warn`，不重入；收到 SIGTERM 等当前任务结束再退出（退出码 0） | `cordex_migrator`（仅 `audit-rotate` 使用） | `ops-cron` 常驻服务 | 不用：Helm 以 CronJob 每日直接运行 `audit-rotate` |
| `audit-verify` | 从最早保留分区之前的封存行起校验审计哈希链 | `cordex_app`（只读） | 手动 | 手动 |
| `jobs:replay` | 按队列或 jobId 重放失败或死信作业：按原 `payload` 新建一行（`attempt_of` 指向原行）再入队，审计 `admin.job_replayed`（[06](./06-modules-jobs-import-export-thumbnails.md) §5.3） | `cordex_system` + Valkey | 手动 | 手动 |
| `webhooks:replay` | 把 `dead-lettered` 或 `failed` 投递重置为 `pending` 并入队，审计 `webhook.delivery_replayed`（[07](./07-modules-comments-webhooks-audit.md) §5.4） | `cordex_system` + Valkey | 手动 | 手动 |
| `thumbnails:rebuild` | 按文档或全部重建缩略图（字体包升级后），审计 `admin.thumbnails_rebuilt`（[06](./06-modules-jobs-import-export-thumbnails.md) §11.1） | `cordex_system` + Valkey | 手动 | 手动 |
| `documents:reassign-owner --doc <id> --to <userId>`（M3） | 唯一 owner 被停用或擦除后给文档指定新 owner：以系统上下文调用 PermissionsModule 导出的 `ReassignOwnerUseCase` 写目标用户的 owner 授权、`perm_version` 加 1（提交后广播，在线会话随之重算），审计 `admin.owner_reassigned`（[03](./03-modules-identity-and-access.md) §4.2、[07](./07-modules-comments-webhooks-audit.md) §9.4）；新 owner 随即可撤销链接、授权或永久删除文档。停用与擦除的响应附「唯一 owner 文档数」提醒管理员执行本命令（[15](./15-rest-api-catalog.md) §3.2）；文档 id 取自协作者手里的文档链接。M4 管理面板直接复用同一用例（rulings §4.20 BE-05+TX-22） | `cordex_system` + Valkey | 手动 | 手动 |
| `plugins:check`（命名草案，2026-10-01） | 只读：按插件声明文件与镜像内置清单跑一遍部署时校验（§5.16、[03 §12.3](./03-modules-identity-and-access.md)），逐项打印部署级状态与被拒原因码，与管理员界面「管理 › 插件」一致；声明文件不可解析时退出码 78，有被拒项时退出码 0 但输出非空 `rejected` | 无（不连库） | `migrate` 之前（与 `config:check` 同一步） | Job 首步 |
| `config:check` | 等同 `--dry-run` | — | `migrate` 之前 | Job 首步 |

- 退出码沿用 sysexits 约定（[01 §6](./01-service-overview-and-roles.md)）：成功 0；配置错误 78。`documents:reassign-owner` 的失败另分三种，均不写任何行、不写审计：`--to` 用户不存在或状态不是 `active`（已停用、已擦除）→ **67**（EX_NOUSER）；`--doc` 文档不存在 → **66**（EX_NOINPUT）；文档处于 `purging` → **65**（EX_DATAERR）。参数缺失或格式不符 → **64**（EX_USAGE）。断言见 [70/07](../70-testing/07-backend-integration-and-api-e2e.md) §7.4 O5（2026-09-26，rulings §4.20 BE-05+TX-22）。

- `audit-rotate` 需要 DDL 权限，不能挂在 worker 的 `maintenance` 队列里（应用进程不持有 `cordex_migrator`），因此是周期作业统一走 Job Scheduler 的第二个例外；Helm 的这一个 CronJob 与 rulings §4.18 BE-19「K8s 不另设 CronJob」不冲突（后者针对 maintenance 队列的作业）。
- `ops-cron` 是唯一长期运行且持有 `cordex_migrator` 口令的容器：只挂 backend 网络、无端口、只读根文件系统、以 `cordex-ops cron` 常驻、只执行 `audit-rotate`；不想常驻时可删掉该服务，改由宿主机 cron 每日执行 `docker compose run --rm ops-cron cordex-ops audit-rotate`（二者择一，不要同时启用）。`/readyz` 在未来分区不足 1 个月时标记降级（[08 §3](./08-db-conventions-roles-rls-migrations.md)）。

**升级步骤**（零停机）：1. `config:check`；2. 拉取新版本镜像（digest）；3. 运行 `migrate`（只做 expand，[08 §10.3](./08-db-conventions-roles-rls-migrations.md)）；4. 依次滚动 api → worker 与 renderer（同版本）→ collab：collab 收到 SIGTERM 后 `/readyz` 返回 503、向客户端发 1012、排空与落库 ≤ 30 s 再退出，客户端首轮不退避地重连到其它实例（ADR-0035 决策 9）；5. 全部 `/readyz` 就绪；6. 下一个版本再做 contract。协议向后兼容一个次版本；不兼容时客户端收到 4426 / 4427 提示刷新。回滚一步 = 把应用镜像退回上一版，数据库不回滚。

## 10. 备份与恢复

目标：RPO ≤ 1 min、RTO ≤ 15 min（PRD SV-09）。数据面的残留与对外声明见 [14 §11](./14-valkey-object-storage-and-retention.md)；演练与测量见 [70/08](../70-testing/08-deployment-and-environment-e2e.md)。

| 对象 | 做法 | 默认 |
|---|---|---|
| PostgreSQL（`cordex` 与 `casdoor` 两个库） | 每日基础备份 + 连续 WAL 归档（`archive_mode = on`、`archive_timeout = 60s`）；参考工具 pgBackRest（MIT），仓库放在与业务桶分离的存储 | 保留 7 天 |
| snapshots 桶 | 桶版本化 + 非当前版本过期规则；`storage.s3.snapshotsNoncurrentDays` ≥ PG 备份保留天数 | 7 天 |
| data 桶 | 生产用客户自有 S3（跨可用区耐久）；默认栈 SeaweedFS 单机须配副本或至少每小时增量同步到第二存储 | 由运维设定 |
| Valkey | 不备份；AOF 只保证重启不丢 | — |
| 机密目录、TLS 证书、`server.env` / `web.env` | 离线保管（密钥管理器或加密备份），不与数据备份放在一起 | — |

**恢复顺序**：1. 恢复对象存储到时点 T₀；2. PG 做 PITR 到时点 T₁ ≤ T₀（对象恢复点不得早于 PG）；3. 清空 Valkey 后启动（全体用户重新登录，队列由 `reconciliation` 从 `job_runs` 补投）；4. 若 T₁ 早于最近的永久删除或擦除，按审计导出重新发起它们（[14 §11](./14-valkey-object-storage-and-retention.md)）；5. 演练脚本以「随机抽取文档导出、与备份前的导出比对 sha256」验证。

## 11. 主机规格

依据：ADR-0037 决策 5——compose 全家桶的最低规格 **与 RM-S 分开写**：RM-S（2 vCPU / 4 GB）只是 collab 单实例口径。数值以「core（默认 profile）」与「core + idp」两档给出；`observability-agpl` 不计入。

**取数与时点**（rulings §4.20 BE-07+TX-05，推迟项）：取数自 [70/09](../70-testing/09-performance-and-capacity.md) §6 的 `host-footprint` 场景（自托管 perf runner、RM-S 负载，core 与 core + idp 两档，`docker stats` 采各容器峰值内存与 CPU，产物 `test/perf/results/host-footprint.json`），按「峰值合计 × 1.3」回填下表；时点为 M3 出口前（renderer 与 worker 落地、`ops:compose` 全绿之后；ADR 字面「M3 前实测」按此理解）。回填后由架构线把 ADR-0037 决策 5 的表改为只留口径、数值链接本节。

| 项 | 口径 | core | core + idp |
|---|---|---|---|
| app（`all`） | 以 collab 负载为主：房间按文档实测权重准入，D200 ≈ 85 MB / 房间，D50 ≈ 17.8 MB / 房间 | 待实测 | 待实测 |
| renderer | 内存 request 2 GiB；每进程并发 2 页 | 2 GiB 起 | 同左 |
| postgres、valkey、seaweedfs | testcontainers 与 compose 基准实测 | 待实测 | 待实测 |
| 观测默认组件 | Jaeger all-in-one 须配置存储上限 | 待实测 | 待实测 |
| casdoor | 轻量，不按 Keycloak 的 1.25 GB 规划 | — | 待实测 |
| 合计 + 余量 | 各项之和 × 1.3 | 待实测 | 待实测 |

## 12. 机械验证

只列断言与落点；执行方式见 [70/08](../70-testing/08-deployment-and-environment-e2e.md)、[70/07](../70-testing/07-backend-integration-and-api-e2e.md)、[70/12](../70-testing/12-ci-gates-mapping.md)。不新增扫描器与 CI job。

| # | 断言 | 落地方式 |
|---|---|---|
| CFG-01 | 配置 schema 快照 = 本文 §5 全字段表（路径、类型、默认、范围、环境变量名、是否机密）；环境变量名按 §6 规则生成且两两不同 | `test/unit` 配置 schema 快照 |
| CFG-02 | 未登记或已废止的 `CORDEX_*` 变量、缺少生产必填项、角色 × 机密矩阵中的「禁止」项、限额放宽超过 2 倍 → 退出码 78；`--dry-run` 输出不含机密明文 | `test/unit` 与 `test/server-integration` 的 role-assembly |
| CFG-03 | 保留期键集合与 [14 §8](./14-valkey-object-storage-and-retention.md) 一致；每个配置键都有读取点 | `test/unit`；扫描器 `scan-config-usage` |
| CFG-04 | 超包络配置启动告警且 `/readyz` 附 `scaleEnvelopeExceeded` | `test/server-integration` |
| DEP-01 | `ops:compose`：默认 profile 一条命令启动，`/readyz` 3 min 内全部就绪；production 下既无 `idp` profile 又未配外部 issuer 即拒绝启动 | `e2e/full-compose` |
| DEP-02 | `ops:airgap`：禁止宿主出站后登录 → 导入 → 协同编辑 → 缩略图 → 导出全链路通过，记录到任何出站尝试即失败 | `e2e/full-airgap` |
| DEP-03 | web 容器：来源 IP 口径（§3.1）——客户端伪造的 `X-Forwarded-For` 首跳不改变限流主体与审计 `ip_hash`，`terminate` 与 `upstream` 两种模式各一例：应用收到的 `X-Forwarded-For` 被 web 容器以 `$remote_addr` 覆盖而非追加，`upstream` 模式下 realip 只信任 `CORDEX_WEB_TRUSTED_LB_CIDRS` 网段来的一跳，该值为空即拒绝启动（rulings §4.20 BE-04；`upstream` 模式的执行点为 [70/08](../70-testing/08-deployment-and-environment-e2e.md) §4 G12）；每次 index.html 响应的 nonce 不同且与 CSP 头一致；CSP 在任何模式下都是强制头，`CORDEX_WEB_CSP_MODE=report-only` 时只有 Trusted Types 两条指令出现在 `-Report-Only` 头；`s3.` 子域响应带 `Content-Security-Policy: sandbox`；index.html `no-store`、`/assets/*` `immutable`；`/internal/*`、`/metrics`、`/readyz` 经反代 404；预签名经 `s3.` 子域且保持 Host 可用；Casdoor 与 SeaweedFS 宿主端口未开放；s3 访问日志不含 query | `e2e/full-compose` |
| DEP-04 | `ops:image-licenses`、digest 钉死、SBOM 存在；renderer 与 worker 镜像同版本；三个镜像的字体 sha256 一致；renderer 非 root、无凭据、沙箱开启 | 治理检查 `check-image-policy`（`scanners`）与 `e2e/full-compose` |
| DEP-05 | 滚动重启期间双浏览器编辑不丢（ack 全部到达）；collab 下线 ≤ 30 s | `e2e/full-compose`（发布演练，70/08 §8） |
| DEP-06 | 备份恢复演练达到 RPO ≤ 1 min、RTO ≤ 15 min，恢复后导出 sha256 与备份前一致 | 70/08 §9（M3，人工证据归档） |
| DEP-07（2026-09-26） | web 容器的 collab upstream 为 `hash $cordex_doc_id consistent`；M3 两副本下同一 `documentId` 的 WS 升级与快照 REST 落到同一实例，停掉该实例后客户端重连到另一实例并继续编辑（亲和不是正确性前提） | `e2e/full-compose`（发布演练，70/08） |
| CFG-06（2026-10-01） | `plugins.*` 按 §5.16 校验：声明文件不可解析或违反 schema、`NODE_ENV=production` 且 `plugins.allowUnsigned=true` → 退出码 78（`--dry-run` 同样）；单项未签名只拒绝该项、`/readyz` 附 `pluginsRejected`；挂载条目 `source` 含 `..` 越出 `plugins.mountDir` 被拒；web 容器只为声明文件中的挂载条目提供 `/plugins/{sha256}/`，其余路径 404 | `test/unit` 配置快照；`e2e/full-compose`（[70/08](../70-testing/08-deployment-and-environment-e2e.md)） |
| CFG-05（2026-09-26） | `collab.hocuspocus.*` 与新增的 `limits.ws.*` 按 §5.7、§5.8 校验，下列任一成立即退出码 78（即要求 `timeoutMs` 不小于 `idleTimeoutMs`、`step2MaxBytes` 不小于 `maxUpdateBytes`、`idleCheckIntervalMs` 小于 `idleTimeoutMs`）：`collab.hocuspocus.timeoutMs` 小于 `limits.idleTimeoutMs`、`limits.ws.step2MaxBytes` 小于 `limits.maxUpdateBytes`、`limits.ws.idleCheckIntervalMs` 不小于 `limits.idleTimeoutMs`；旧键 `limits.xml.maxTextNodeBytes` 出现即拒绝启动并提示 `limits.xml.maxTextLength`；镜像入口含 `--import ./dist/observability/otel.js` | `test/unit` 配置 schema 快照；`check-image-policy` |
