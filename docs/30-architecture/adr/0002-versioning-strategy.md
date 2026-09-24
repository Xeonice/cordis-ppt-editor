# ADR-0002 版本策略：内核 lockstep + 插件独立 semver + `peerDependencies` 加载期校验

> 状态：草稿 | 负责：架构-结构 | 更新：2026-09-24 | 依赖：charter v0.1；裁决 `docs/00-charter/rulings-2026-09-14.md` §4.15 Q1

## 状态

提议。

## 背景

SDK 由 ~30 个包组成，第三方插件将依赖其中一部分。Univer 全部包 lockstep 且版本失配「仅 log 不阻断」，导致运行期出现难以诊断的不兼容。我们需要：(1) 让紧耦合的内核层保持一致；(2) 让垂直束与 Provider 能独立演进；(3) 让不兼容在**加载期**可见并阻断。

## 决策

1. **lockstep 组**（Changesets `fixed`）：`@cordexjs/shared`、`@cordexjs/kernel`、`@cordexjs/protocol`、`@cordexjs/i18n`、`@cordexjs/model-core`、`@cordexjs/store-memory`、`@cordexjs/store-yjs`（L0–L1 全部）。它们同一版本号、同时发版。组成员由 `cordex.layer` 自动生成（见「如何被机械验证」），包名随 rulings §4.15 Q1 的 scope 更名由全仓统一替换，本 ADR 不单独改写。私有包（eslint-config、eslint-plugin、test-suite，`private:true`）不进 fixed 组、不发布。
2. **独立 semver**：其余全部包（L3–L8、LS、垂直束）。
3. **peer 声明与内部依赖协议**：任何 plugin/provider/definition 包对 `@cordexjs/kernel`、`@cordexjs/model-core` 及其它需要单实例的 `@cordexjs/*` 使用 `peerDependencies`；`@cordexjs/shared` 为普通 dependency。**仓库内部依赖一律使用 `workspace:` 协议**（rulings §4.15 Q1）：`peerDependencies` 写 **`workspace:^`**（发布时替换为 `^x.y.z`），`dependencies`/`devDependencies` 写 **`workspace:*`**（发布时替换为精确版本）；禁止对内部包写 semver 范围——pnpm 11 下 semver 范围会走 registry 解析，叠加 scope 被他人占有时构成依赖混淆面。
4. **加载期校验**：manifest-gen 把 `peerDependencies` 复制进 `manifest.kernel`/`manifest.peers`；kernel 在挂载插件时 `satisfies(manifest.kernel, host.kernelVersion)`；不满足 → `kernel/VERSION_MISMATCH` → Fiber `FAILED`（阻断该插件，不影响兄弟）。对其它 `@cordexjs/*` peer 的校验：以各包 `manifest.version` 为实际值，任一不满足同样 FAILED。
5. **preset 锁定**：`preset-*` 用 `^` 依赖其组成插件，且 preset 的 major 随任一组成插件 major 变化而变化（preset 是产品形状，用户只需盯一个版本）。
6. **弃用**：`@deprecated` 注解必须带 `removeIn: <version>`；扫描器在到达该版本时失败（A22）。
7. **公共 API 变更可见**：api-extractor `.api.md` 入库，PR diff 必审；破坏性变更必须伴随 major changeset（`changeset-check` 校验 `.api.md` 有 breaking 标记时 changeset 类型为 major）。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 全仓 lockstep（Univer） | 垂直束/Provider 的小改动迫使全部包发版；第三方插件无法表达「兼容内核 1.x」 |
| 全部独立 semver | L0–L1 之间接口紧耦合（`Context` 增强、`StoreOp`），独立版本会产生大量无意义的兼容矩阵 |
| 版本失配只 log | Univer 的教训：失配在运行期以奇怪的方式暴露 |
| 校验放在 `npm install`（peer 冲突报错） | 只覆盖安装期；运行时组合（preset override、第三方插件动态挂载）不经过安装 |

## 后果

- 正：内核层像一个整体演进；插件生态可表达兼容范围；失配立即可见且局部化。
- 负：需要 `satisfies` 的 iso 实现（避免拉入 `semver` 包及其 Node 依赖，kernel 自带 ≤ 100 行实现，只支持 `^`/`~`/`>=`/精确/`||`）；peer 声明增加 package.json 维护量（`peer-policy` 扫描器兜底）。

## 如何被机械验证

- `tooling/changeset-config`：fixed 组从 `cordex.layer ∈ {L0, L1}` 自动生成，CI 校验 `.changeset/config.json` 与之一致。
- 扫描器 `peer-policy`：`cordex.role ∈ {plugin, provider, definition}` 的包，其 `@cordexjs/*` 运行时依赖必须在 `peerDependencies`（`shared` 例外）。
- kernel `__tests__/version-mismatch.test.ts`：manifest.kernel 与 host 版本不满足 → Fiber FAILED + `kernel/VERSION_MISMATCH`；满足 → ACTIVE。
- `syncpack`：第三方依赖单版本；`manypkg check`：内部依赖协议一致。
- （2026-09-24）09-type-discipline/08 矩阵新增一行 TD：内部依赖必须为 `workspace:` 协议——`peerDependencies` 为 `workspace:^`、其余为 `workspace:*`；负向用例：内部包写 `^1.0.0` 或 peer 写 `workspace:*` 即失败。`09-type-discipline/03-boundaries.md` 的 syncpack 规则「一律 `workspace:*`」与本条冲突，以本条为准（由该文件回写）。
- 扫描器 `deprecated-expiry`（A22）。
- `changeset-check`：api-extractor breaking → major changeset。

## 关联

章程 §6.2 ADR-0002；`00-charter/rulings-2026-09-14.md` §4.15 Q1/Q9；Univer A21/A22/A34；03 §10；02 §4.0.1；09-type-discipline/03、08；ADR-0004。
