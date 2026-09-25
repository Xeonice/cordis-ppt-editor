> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-24；2026-09-25（矛盾收口，rulings §4.18）；2026-09-25（§4.19 登记的 INC-33：决策 6 产品事件采样按 PRD 06） | 依赖：charter v0.1；裁决 `docs/00-charter/rulings-2026-09-14.md` §4.15 Q10、§4.18 BE-30/BE-14

# ADR-0030 观测性技术栈：OpenTelemetry 全链路 + pino + Prometheus（Sentry 为可选 Provider）

## 状态

提议（章程 D11）。

## 背景

D11 要求 `errors`/`telemetry`/`logger` 为 L0 服务且 M1 接入；§5.4 要求控制台默认实现可替换为 Sentry/OTel 且移除后降级 no-op。需要浏览器与 Node 两端、跨 WS/HTTP/队列的追踪传播、Univer A24 的反制（每个指标有消费者）。

## 决策

1. **协议与 SDK**：OpenTelemetry（traces/metrics/logs）为唯一遥测契约；Node 用 `@opentelemetry/sdk-node` + 自动仪表化（http/pg/ioredis/ws），浏览器用 `@opentelemetry/sdk-trace-web` + OTLP/HTTP 导出（经 `POST /api/v1/telemetry/otlp` 代理，避免暴露 collector）。浏览器错误上报 `POST /api/v1/telemetry/errors` 与 OTLP 代理由 M-12 新增的 `client-telemetry` 控制器承接、装在 **api 角色**（ADR-0037 决策 1）：**要求登录**（登录前页面出的错只留在浏览器控制台），按用户令牌桶限流，请求体上限 errors ≤ 64 KiB、otlp ≤ 512 KiB，OTLP 代理**只转发 traces**（2026-09-25，rulings §4.18 BE-30；原：只给出端点路径，未定承接模块、鉴权与限额）。
2. **日志**：kernel `logger` 适配 cordis logger；Node sink = pino JSON → stdout → OTel Collector（filelog/OTLP）→ OTel logs 后端（Loki 仅在显式开启的 AGPL 可选 profile 中提供）；浏览器 sink = 控制台（dev）/环形缓冲随错误上报（prod）。
3. **指标**：Prometheus 暴露（`/metrics`，内部端口）+ OTel metrics 导出二选一按部署配置；命名见 10 §3.3。renderer 角色例外：它只挂零出站的 `render` 网络，Prometheus 抓不到，因此**不装 `MetricsModule`、关闭 OTLP 导出、日志只写 stdout**，渲染耗时/超时/崩溃指标由 worker 侧 `remote-renderer.client` 按 RPC 结果记录（2026-09-25，rulings §4.18 BE-14，ADR-0037 决策 1）。
4. **错误**：kernel `errors` 的 Reporter Provider 默认 = 日志 + `cordex_errors_total`；可选 Sentry Provider（`apps/*` 装配层选择，SDK 包不依赖 Sentry）。
5. **登记制**：span/metric/event/错误码名称通过声明合并登记，扫描器校验每个名称在登记表中且有 `consumer`（仪表盘/告警/测试）字段（A24 反制）。
6. **采样**：traces 头采样 10%（错误路径 100% 尾采样在 collector）；WS update 帧不建 span（1% 抽样）；产品事件的采样以 PRD 06 为权威（决策 MECH-INC 之 INC-33）：高频事件（`render/frame` 派生的 `perf/frame`、`collab/latency` 等）默认采样 1%，部分事件按 PRD 06 §3.2 事件表的采样率（如 `render/page-rendered`、`selection/changed` 10%、`perf/input-latency` 5%），错误与生命周期事件不采样；全部可配置，一律去标识。（2026-09-25 修订：本 ADR 未接受，不高于 PRD 口径；原：「产品事件不采样但去标识」，作废。）
7. **compose 观测组件**（2026-09-24，rulings §4.15 Q10，D13 镜像口径见 ADR-0037）：默认 profile = **OTel Collector + Jaeger + Prometheus**（均 Apache-2.0），默认告警规则随 compose 提供（SV-10）；**Grafana / Loki（及 Tempo）为 AGPL-3.0，只作为需显式开启的可选 profile**，附许可提示；仪表盘 JSON 仍入库。（原：otel-collector + Jaeger/Tempo + Prometheus/Grafana。）

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 仅 Sentry（错误+性能） | 供应商锁定；指标/日志覆盖弱；SDK 包不应依赖供应商 |
| 供应商 APM（Datadog/New Relic）SDK 直连 | 锁定；OTel 已被这些供应商接收，走 OTel 保持中立 |
| 自定义 telemetry 格式 | 重复造轮子；A24 教训是「声明了没接」而非格式问题 |
| console.log | 无结构、无关联、被 lint 禁止 |

## 后果

正面：两端一套契约；传播标准（`traceparent`）；后端可换；登记制让「无人消费的指标」不可能进入代码。

负面 / 代价：浏览器 OTel SDK 体积（~40–60 KB gzip）→ 仅在 `apps/web` 装配，SDK 包只依赖 kernel 的 no-op 契约；collector 是新增运维组件（compose 已含）；日志与 trace 的关联依赖 ALS 上下文正确传播（WS/队列边界需手工传递 `traceparent`，有测试）。

## 如何被机械验证

- 扫描器 `scan-observability-identifiers`（span/metric 名，09-type-discipline/06 §13）与 `scan-telemetry-events`（产品事件名，06 §10）：`telemetry.span/counter/histogram/event` 的名称 ∈ 登记表且有 consumer（2026-09-25 补写执行点正式名，rulings §4.18 GV-15）；`console.*`/裸 `Error` lint。
- （2026-09-25，rulings §4.18 BE-30）`client-telemetry` 控制器：未登录请求 401；超过 64 KiB 的 errors 与 512 KiB 的 otlp 请求体被拒（413）；超出令牌桶返回 429；OTLP 代理丢弃 metrics/logs 信号、只转发 traces；该控制器只在 api（及 all）角色装配。
- 单测：移除 Provider 后 `telemetry`/`errors`/`logger` 调用不抛且为 no-op；脱敏规则测试（内容字段被拒）。
- 集成：一次「导入 → 房间加入 → 编辑 → 缩略图」的 trace 在 Jaeger 中为单一 trace（e2e 断言 traceId 贯穿 WS auth 帧与 job 数据）。
- 仪表盘即代码：Grafana 面板 JSON 入库并引用登记表中的指标名（CI 校验引用有效）。

## 关联

章程 D11、§5.4；Univer A24/A25；架构 10；60-backend/18（metrics/health 模块）；40-modules/12（`client-telemetry` 控制器，BE-30）；ADR-0037 决策 1（renderer 不装 Metrics，BE-14）。
