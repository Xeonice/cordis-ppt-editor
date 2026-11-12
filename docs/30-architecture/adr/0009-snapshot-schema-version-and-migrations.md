# ADR-0009 Snapshot `schemaVersion` 与迁移注册表

> 状态：草稿 | 负责：架构-结构 | 更新：2026-09-14；2026-09-25（矛盾收口，rulings §4.18）；2026-09-26（§4.21 Remap：原 30/08 引用按 60-backend/README §6.1 改指新位置，30/08 已删除） | 依赖：charter v0.1；裁决 `docs/00-charter/rulings-2026-09-14.md` §4.18 GV-14

## 状态

提议。

## 背景

章程 D6：Snapshot 与运行时模型有显式编解码；`schemaVersion` + 迁移注册表从 M1 起存在。Univer 声明了 `schemaVersion` 但全仓只有 1 个迁移函数（A23），模型即快照导致派生字段混入持久化（A6）。

## 决策

1. **版本粒度**：每个 `documentType` 一个整数 `schemaVersion`（body）；每个 `ResourceHook` 命名空间一个独立整数 `version`。不存在全局版本。
2. **迁移形态**：`Migration { documentType, from, to = from + 1, migrate(body), migrateResources? }`，经 `core.migration` 贡献；`migrations.plan` 求链、`run` 顺序执行并在每步后校验中间 schema（若注册了历史 schema）。缺链 → `MIGRATION_PATH_MISSING`，打开失败且可见。
3. **何时迁移**：`units.open` 在 `store.load` 之前；服务端 `server-headless.tasks.migrate` 可批量预迁移存量快照（60-backend/06 §8）。运行时模型永远是当前版本。
4. **schema-lock**：`fixtures/snapshots/<type>/schema-lock.json` 记录当前 `bodySchema` 的 JSON Schema 规范化哈希与 `schemaVersion`；CI 发现哈希变化而版本未增 → 失败；版本增加而无对应 `Migration` 贡献 → 失败；版本增加而 `fixtures/snapshots/<type>/v<N-1>/` 无样本 → 失败。
5. **样本语料**：每个历史版本至少一个快照样本入库；CI 把全部历史样本迁移到当前版本并通过 `validateSnapshot`。
6. **向后兼容读、不向前写**：新客户端可读旧快照（迁移）；旧客户端遇到更高版本 → `SNAPSHOT_TOO_NEW` 拒绝打开（不做降级迁移）。协同房间要求所有客户端 `schemaVersion` 一致（06：握手帧携带，服务端拒绝低版本客户端）。
7. **派生数据**：`Derived<T>` 品牌 + `Persisted<T>` 映射类型；`bodySchema` 定义在 `Persisted<S>` 上（04 §7）。
8. **Blob 不参与版本**：`BlobRef` 内容寻址、不可变；媒体格式变化不是 schema 变化。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 全局单一版本号 | 一个类型的变化迫使其它类型升版；第三方 ResourceHook 无法独立演进 |
| 语义化版本字符串 | 迁移链需要全序；整数最简单 |
| 允许跳版迁移（from→to 任意） | 链式最短路径复杂且测试组合爆炸；一步一版可组合 |
| 惰性迁移（访问时按需） | 运行时模型出现多版本混合；渲染与命令需处理旧形状（Univer A6 的另一种形式） |
| 不做 schema-lock，靠评审 | Univer 的教训：声明了但没执行（A23） |

## 后果

- 正：schema 变更必有迁移与样本；旧文档永远可打开；ResourceHook 独立演进。
- 负：每次 schema 变化都要写迁移与样本（这是有意的摩擦）；历史 schema 若要每步校验需保留旧 zod schema（可选，默认只校验最终结果）。

## 如何被机械验证

- scanners job 的 `schema-lock` 步骤（哈希锁校验；执行点见 09-type-discipline/08 §11 `schema-lock` 行与 TD-063，脚本落 `tooling/scripts/` 以 40-modules/01 为准，原写 `tooling/scanners/schema-lock.ts`）。
- test job 的 `snapshot-migration-corpus` 步骤：`fixtures/snapshots/**` 全部迁移并校验。
- （2026-09-25，rulings §4.18 GV-14：上两条原为「CI job `schema-lock`」「CI job `snapshot-migration-corpus`」，改写为 07 §3 既有 job 的步骤，13 个 job 名封闭集合不变。）
- model-core `__tests__/migrations.test.ts`：缺链、乱序注册、重复键（`conflict:'error'`）。
- 类型测试：`Persisted<S>` 无 `Derived` 字段；运行时 `bodySchema.parse(toSnapshotBody())`。
- protocol：`SnapshotEnvelope.schemaVersion` 必填；服务端拒绝版本不匹配的协同握手（06/08 测试）。

## 关联

章程 D6、§4 Snapshot；Univer A6、A23；04 §2.5–2.7、§7；ADR-0008。
