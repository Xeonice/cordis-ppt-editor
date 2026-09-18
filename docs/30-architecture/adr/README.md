# ADR 索引

> 状态：草稿 | 负责：总编排（合并自三条架构子线） | 更新：2026-09-15 | 依赖：charter v0.2
> 编号分配（章程 §8）：0001–0019 结构线；0020–0039 运行时线；0040–0049 类型治理线。M0 阶段全部 ADR 为**提议**状态，进入 M1 前经评审转为「已接受」；跨线分歧的裁决见 `docs/00-charter/rulings-2026-09-14.md`。

## 模板

每份 ADR 依次包含：**状态**（提议 / 已接受 / 已否决 / 已替代）、**背景**、**决策**、**备选方案与放弃原因**、**后果（正 / 负）**、**如何被机械验证**、**关联**（章程条目、Univer K/A 编号、相关文档）。

## 结构线（0001–0019）

| 编号 | 标题 | 章程关联 |
|---|---|---|
| [0001](./0001-declaration-merging-bridge.md) | 声明合并桥接：插件只 `declare module '@oce/kernel'`（含 spike 矩阵 S1–S8 与退路） | §6.2、primer §5.2 |
| [0002](./0002-versioning-strategy.md) | 版本策略：L0–L1 lockstep + 插件独立 semver + `peerDependencies` 加载期校验（失配即 FAILED） | §6.2 |
| [0003](./0003-manifest-generation.md) | Manifest：静态分析生成、入库、CI 与运行时三方一致性 | §6.2、A9 |
| [0004](./0004-monorepo-and-build-toolchain.md) | monorepo 与构建工具链：pnpm + Turborepo；库 `tsc -b`；apps Vite；Changesets | D9 |
| [0005](./0005-unit-scope-via-isolate.md) | UnitScope 的实现：Unit = 插件 Fiber + `createIsolatedScope` 服务集 | §4、K2、裁决 C-4 |
| [0006](./0006-contribution-point-as-sole-registry.md) | ContributionPoint 作为唯一注册抽象 | D3、A8、A10、K11 |
| [0007](./0007-document-store-and-derived-undo.md) | DocumentStore 契约与 Store 推导的逆操作 | D4、D5、K1 |
| [0008](./0008-opaque-preservation.md) | 不透明保留（部件级 + 节点级）与脏部件重生成；Strict 三案 | D7、R6、Q14 |
| [0009](./0009-snapshot-schema-version-and-migrations.md) | Snapshot `schemaVersion`、迁移注册表与 schema 哈希锁 | D6、A23、裁决 Q-T9 |
| [0010](./0010-preset-vs-loader-composition.md) | preset（程序化）与 loader（配置驱动）的分工；惰性条目 | primer §3.6 |
| [0011](./0011-errors-telemetry-as-l0-services.md) | `errors`/`telemetry` 作为 L0 服务；`errors.sink`/`telemetry.sink` 为贡献点 | D11、A24 |
| [0012](./0012-permission-fail-closed-placement.md) | 权限 fail-closed 的放置：命令管线（含 Mutation 级）+ 服务端网关；`CommandDef.permission` 必填 | D12、裁决 Q-T8 |
| [0013](./0013-mutation-lowering-and-store-ops.md) | Mutation 降级与 `StoreOp` 原语集（5 种；有序实体用 `order: FracKey`） | D4、A2、裁决「原语数」 |
| [0014](./0014-stable-ids.md) | 稳定 id：CRDT 友好 `NodeId`（UUIDv7）与 OOXML id 的双向映射 | R6 |
| [0015](./0015-single-execution-entry-and-non-executable-mutations.md) | 单一执行入口：Command 与 Operation 都经 `commands.execute`；Mutation 不可外部执行 | D4、D12 |
| [0016](./0016-doc-type-blindness-verification.md) | 文档类型盲的验证：夹具文档类型、水平层测试隔离与水平层冻结 | R5、M5 |
| [0017](./0017-ui-component-library-shadcn-copy-model.md) | UI 组件库选型：shadcn/ui 复制模式（Radix + Tailwind 4 + Lucide + Geist）；`@oce/design` 只交付主题变量 CSS；组件依赖全部在 ui-react/`*-ui` | 已接受（用户指令 2026-09-15；D10 修订、rulings §4.7） |
| 0018–0019 | （预留） | — |

## 运行时线（0020–0039）

| 编号 | 标题 | 章程关联 |
|---|---|---|
| [0020](./0020-crdt-selection.md) | CRDT 选型：Yjs（Loro 为已评估替代）；有序实体移动语义；CO-08 逐行收敛表 | Q3、§6.2 |
| [0021](./0021-rendering-medium.md) | 渲染介质：DOM/SVG 优先，Canvas 为可选 RenderTarget | Q4、§6.2 |
| [0022](./0022-server-storage.md) | 服务端存储栈：Postgres + Redis + S3 兼容对象存储 | Q10、§6.2 |
| [0023](./0023-transport-and-protocol.md) | 协同传输与协议：WebSocket + y-protocols 负载 + CONTROL 控制面；权限变更 ≤ 2 s | §6.2 |
| [0024](./0024-presence-and-awareness.md) | Presence / Awareness 模型；`Selection<A>` 序列化即载荷 | §4 |
| [0025](./0025-update-persistence-and-compaction.md) | Update 持久化与快照压缩策略 | Q17 |
| [0026](./0026-headless-rendering-and-thumbnails.md) | 服务端 headless 渲染与缩略图（含 PDF） | Q8 |
| [0027](./0027-text-measurement-strategy.md) | 文本度量与断行策略（导出从不重排） | §5.4 度量 |
| [0028](./0028-text-editing-host.md) | 文本编辑宿主：单一隐藏 textarea + 自绘光标/选区；IME spike 计划 | M2 风险 |
| [0029](./0029-gateway-authorization.md) | 协同网关鉴权与授权：短票据握手 + 每帧角色检查 + 权限版本传播 | D12、Q6 |
| [0030](./0030-observability-stack.md) | 观测性技术栈：OpenTelemetry 全链路 + pino + Prometheus（Sentry 可选 Provider） | D11 |
| [0031](./0031-comments-and-anchors-storage.md) | 评论存储：Snapshot `ResourceHook` 为事实源、Postgres 为镜像；id/RelativePosition 锚点（v0.2 修订） | PRD CO-04 |
| [0032](./0032-ordered-collections-fractional-index.md) | 有序集合的并发语义：实体表 + fractional index；Snapshot 保留 `order` 键 | 裁决 A-9 |
| [0033](./0033-offline-persistence.md) | 离线队列与本地持久化：`collab-offline-idb`（dom），collab-yjs 保持 iso | §5.2 |
| [0034](./0034-server-update-validation-and-repair.md) | 服务端对 update 的校验：硬门禁拒绝 + 软门禁补偿修复（不回滚、不分叉） | D12、裁决 P8 |
| [0035](./0035-gateway-horizontal-scaling.md) | 协同网关横向扩展：多副本房间 + Redis 扇出，不依赖房间亲和 | Q5、Q10 |
| 0036–0039 | （预留） | — |

## 类型治理线（0040–0049）

| 编号 | 标题 | 章程关联 |
|---|---|---|
| [0040](./0040-type-budgets-and-ratchet.md) | 类型预算与 Ratchet（只减不增） | §6.2、R7 |
| [0041](./0041-assertion-policy.md) | 断言策略：`as`/`!` 禁用与替代模式（`as const`/`satisfies` 例外） | R7 |
| [0042](./0042-no-enums-const-objects.md) | 禁 `enum`，用 `as const` 对象与联合类型；协议用字符串 id | A3 |
| [0043](./0043-result-vs-exceptions.md) | Result 与异常的边界（与 10 错误码体系对接） | D11 |
| [0044](./0044-eslint-and-biome-split.md) | ESLint（类型感知规则）与 Biome（格式化）的职责切分 | D9 |
| [0045](./0045-isolated-declarations.md) | 采用 `isolatedDeclarations` | D9 |
| [0046](./0046-native-typescript-compiler-evaluation.md) | TS 7 原生编译器（tsgo）评估计划 | — |
| [0047](./0047-branded-primitive-types.md) | 品牌原始类型（`Emu`/`Pt`/`UnitId`/`NodeId`…） | §4 |
| [0048](./0048-type-testing-tooling.md) | 类型测试工具选型 | 09-09 |
| 0049 | （预留） | — |
