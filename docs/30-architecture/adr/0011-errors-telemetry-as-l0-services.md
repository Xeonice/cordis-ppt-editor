# ADR-0011 `errors` / `telemetry` 作为 L0 服务；sink 为贡献点

> 状态：草稿 | 负责：架构-结构 | 更新：2026-09-14；2026-09-25（矛盾收口，rulings §4.18） | 依赖：charter v0.1；裁决 `docs/00-charter/rulings-2026-09-14.md` §4.18 GV-15

## 状态

提议（运行时细节——日志字段、指标名、OTel 映射——由 10 承接）。

## 背景

章程 D11：`errors`（类型化错误码，禁止裸 `throw new Error`）、`telemetry`、结构化 logger 为 L0 服务，从 M1 起接入。Univer 的 `ILogContext`/错误码/telemetry 零实现、包外引用 0（A24）。PRD 要求：错误码表可生成并与文档同步（EM-12）；遥测事件必须先注册后使用（06 §5）；遥测出口可替换（`telemetry.sink`）；SDK 出厂 no-op（PD-10）。

## 决策

1. **两个 L0 服务在 kernel**：`errors`（`ErrorsService`）与 `telemetry`（`TelemetryService`），契约见 03 §1.3；logger 沿用 cordis 内建 `ctx.logger` 并加结构化包装（不新增服务名）。
2. **出口是贡献点，不是 HostOptions 回调**（与 D3 一致，也与 PRD 的 `telemetry.sink` 命名一致）：kernel 定义 `errors.sink`（`{ id; report(err, ctx) }`）与 `telemetry.sink`（`{ id; counter/histogram/span/event 的接收端 }`）两个贡献点；服务把调用扇出到全部 sink；默认 sink（控制台 / no-op）由 kernel 插件自身贡献，`createHost({ defaultSinks: false })` 可关闭。应用侧的 Sentry / OTel 适配就是一个贡献 sink 的插件。
3. **错误码**：`defineErrors(pkg, table)` 生成 `${pkg}/${CODE}` 字面量类型；`CordexError { code; data; cause; fiber }`；`errors.report` 归类 `CordexError | CordisError | ValidationError | unknown`。生产代码禁止 `throw new Error` 与 `console.*`。
4. **错误码目录生成**（EM-12）：扫描器 `scan-observability-identifiers`（09-type-discipline/06 §13；原写路径 `tooling/scanners/error-codes-catalog` 作废，rulings §4.18 GV-15）从全部 `defineErrors` 表生成 `docs/…/error-codes.md`（码、消息、data schema、所属包、首次出现版本）；CI diff 校验；重复码失败。
5. **遥测事件注册表**：`defineTelemetryEvents(pkg, table)` 声明事件名与属性 schema；`telemetry.event(name, attrs)` 的 `name` 类型受限于已声明集合；扫描器拒绝未声明事件；PRD 06 的事件目录由该注册表生成（单一来源）。
6. **两个命名空间**：cordis `Events`（进程内、`<域>/<动作>`、非采样）与遥测事件（可采样、出口）分离；同名允许且鼓励（`command/executed` 既 emit 也上报），但 `perf/*` 只存在于遥测（无 cordis 事件）。
7. **失败隔离**：sink 抛错被吞并计数（`telemetry.sinkErrors`），绝不影响业务路径；`errors.report` 自身永不抛。
8. **可插拔验收**（章程 §5.4）：移除全部 sink → 服务降级为 no-op，系统正常启动。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 直接使用 Sentry/OTel SDK（全局单例） | 模块级状态（A10）；SDK 不能出厂 no-op；多 host 互相污染 |
| 每包自带 logger/错误类，不经服务 | Univer A24：零消费者、包外引用 0；无法统一 sink 与采样 |
| sink 经 `HostOptions` 回调 | 第二种注册方式（违反 D3）；不能在运行时增删、不能由插件贡献、无诊断 |
| 只有 cordis logger | 缺类型化错误码与遥测；logger 不是指标/追踪出口 |

## 后果

- 正：错误与遥测有统一出口、可替换、可测、可生成文档；无声明的遥测事件在 CI 被拒（PRD 06 §5）。
- 负：多一层 `defineErrors/defineTelemetryEvents` 仪式；sink 扇出有微小开销（热路径事件采样在服务内完成）。

## 如何被机械验证

- lint `no-bare-throw`（生产代码只允许 `throw ctx.errors.create(...)` 或 `throw new CordexError(...)` 子类）、`no-console`（sink 文件白名单）。
- 扫描器 `scan-observability-identifiers` 规则 (c)（09-type-discipline/06 §13，TD-073：错误码登记唯一且有消费者，原 `error-codes-unique`、`error-codes-catalog --check`）与 lint `cordex/telemetry-events-must-be-declared`（09-type-discipline/02 §4.15，原 `telemetry-events-declared`）（2026-09-25 按正式名改写，rulings §4.18 GV-15，对照见 08 §11）。
- kernel `__tests__/sinks.test.ts`：无 sink 时 no-op；sink 抛错不传播；两个 sink 都收到；卸载 sink 插件后不再收到。
- 契约：`ErrorsService`/`TelemetryService` 在 api-extractor 基线中。

## 关联

章程 D11、§5.4、§5.5；Univer A24、A10；PRD EM-12、PD-10、06 §5、PS-02（`telemetry.sink`）；03 §1.3；10。
