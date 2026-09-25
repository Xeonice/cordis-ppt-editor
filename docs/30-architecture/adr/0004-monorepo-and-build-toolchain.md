# ADR-0004 monorepo 与构建工具链：pnpm + Turborepo；库 `tsc -b`；apps Vite；Changesets

> 状态：草稿 | 负责：架构-结构 | 更新：2026-09-24；2026-09-25（矛盾收口，rulings §4.18） | 依赖：charter v0.1；裁决 `docs/00-charter/rulings-2026-09-14.md` §4.15 Q9、§4.18 FE-13/GV-15

## 状态

提议（具体配置由 09-01/04/07 承接）。其中**包管理器、版本锁定、Node 基线**三项已由用户裁决（2026-09-24，rulings §4.15 Q9），不再是待定项。

## 背景

章程 D9 已定：pnpm workspaces + Turborepo、TS ≥ 5.9 最严格集 + `isolatedDeclarations`、Vitest、Playwright、Changesets、ESLint（typescript-eslint 类型感知）+ Biome 格式化。未定：库的构建方式（`tsc -b` 项目引用 vs `tsdown` 打包）、产物形态、开发期解析方式。（原「包管理器细节（Q9）」已结案：见下表「包管理器」「lockfile 门禁」「Node」三行。）

## 决策

| 项 | 决策 | 理由 |
|---|---|---|
| 包管理器 | **pnpm 11**（11.27.1）**双锁**：根 `package.json` 同时写 `packageManager`（精确版本，可附哈希）与 `devEngines.packageManager` / `devEngines.runtime`（`onFail: "error"`）；**corepack 降为可选安装渠道**，不作锁定依据（Node 25 起官方构建不带 corepack）。**全部设置显式写入 `pnpm-workspace.yaml`**：`nodeLinker: isolated`、`strictPeerDependencies: true`、`autoInstallPeers: false`、`minimumReleaseAge: 1440`、`blockExoticSubdeps: true`、`allowBuilds` 白名单；**`.npmrc` 只保留鉴权设置**（非鉴权设置全部删除——pnpm 11 不再从 `.npmrc` 读取它们，strict-peer 与 auto-install-peers 会被静默削弱）。仓库根目录命令一律 `pnpm` / `pnpm dlx`（`onFail:error` 下根目录 `npm`/`npx` 全部失败） | 幻影依赖为零（K9）；peer 失配安装期即报；安全设置不依赖版本默认值 |
| lockfile 门禁 | `tooling/scripts/lockfile-guard.ts` 为主执行点，挂 lefthook pre-commit 与 CI（并入现有 job，不改 13 个 job 名的封闭集合）；**全仓只允许根目录 `pnpm-lock.yaml`** | `devEngines` 挡不住自带 `package.json` 的子目录里 `npm install` 生成 `package-lock.json`（实测） |
| pnpm 12 切换 | **检查点**：M2 结束前评估，**最迟 2027-03-31** 完成切换 | pnpm 10.x 与 11.x 均于 2027-04-30 停止支持 |
| 设计 playground | `docs/20-design/playground` 纳入根 workspace（M0 骨架阶段删 `package-lock.json`、设 `private`）；**不进 turbo 门禁与 eslint 范围**，lockfile-guard 不开例外 | 单一 lockfile；根 workspace 建好前可继续用 npm |
| 版本目录 | `pnpm-workspace.yaml#catalog` 统一第三方版本；`syncpack` 校验；**`typescript` 在 catalog 中显式钉在 5.9 或 6.x**（TypeScript `latest` 已是 7.x，按 ADR-0046 暂不采用） | 单版本；避免被 `latest` 带到原生编译器 |
| 任务编排 | Turborepo：`build`(dependsOn `^build`)、`typecheck`、`lint`、`test`、`depcruise`、`manifest`、`api`、`iso-smoke`、`policy`；输出缓存 `lib/**`、`etc/**` | 增量与缓存 |
| **库构建** | **`tsc -b`（项目引用）产出未打包 ESM + 逐文件 `.d.ts` + sourcemap**；`isolatedDeclarations: true`；`type: module`；不发 CJS | (1) 消除 dev/prod 分叉：开发与发布都用 `lib/`；(2) 逐文件 `.d.ts` 保留 `declare module` 增强（ADR-0001 S4）；(3) `isolatedDeclarations` 使 d.ts 生成并行且快；(4) 消费方（Vite/Node）自行打包与 tree-shake（`sideEffects:false`） |
| 打包器 | 不用于库；`tsdown` 保留给未来「独立浏览器包」（如 pptx-renderer 的 `browser.es.js` 形态）—— 单独包 `@cordexjs/standalone`（未列入 v0.1） | 避免双构建产物不一致 |
| apps | Vite 8 + React 19 + react-router 8（包名 `react-router`）（web）；Nest CLI（server，`tsc`）；apps 通过 workspace 依赖消费 `lib/` | 2026-09-25 按 rulings §4.15 决策包 `results[10].decisions[1].docUpdates[4]` 改写（rulings §4.18 FE-13；原「Vite 7（web）」作废），与 playground 基线一致 |
| 开发期解析 | 根 `tsc -b --watch`；**不**用 `exports.development` 条件或 Vite alias 指向 `src` | 与发布形态一致；避免「编译过、运行崩」类问题（A27 的同族） |
| 测试 | Vitest（workspace 模式；iso→node 环境，dom→happy-dom + browser mode 子集）；Playwright（apps/web e2e、视觉 oracle） | |
| 格式与 lint | Biome 只做 formatter；ESLint flat config + typescript-eslint `strict-type-checked` + 自定义规则包 | 规则集单一来源 |
| 发布 | Changesets；fixed 组见 ADR-0002；`publint` + `attw` 门禁 | A27 |
| Node | **Node 26 基线**（开发 / CI / 服务端镜像）；`.node-version` = 26；`devEngines.runtime` 与各包 `engines.node` 写 `>=26` | Node 26 于 2026-10-28 成为 Active LTS；Node 22 于 2027-04-30 EOL，落在 M3–M4 期间（原「≥ 22 LTS」作废） |
| TypeScript | ≥ 5.9，catalog 钉 5.9 / 6.x（见「版本目录」）；`moduleResolution: bundler`（apps）/ `nodenext`（libs 与 server） | |

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| `tsdown`/`tsup` 打包每个库 | 与 `tsc` 的 d.ts 双产物需保持一致；bundled d.ts 常丢 `declare module` 增强；开发期又要另一套解析 |
| `exports.development` → `src` | dev/prod 分叉；`isolatedDeclarations` 下收益低 |
| Nx | 团队熟悉度与配置量；Turborepo 足够 |
| Bun/yarn | Q9 已裁 pnpm；`nodeLinker: isolated` 的严格性是 K9 的机械保证。原 §10 Q9「全局 yarn 冲突」前提经实测不成立（最近的 `packageManager` 字段优先生效，全局设置不渗入仓库），已删除 |
| pnpm 10 | 与 11 同于 2027-04-30 停止支持且 2026-07 后无新版；`minimumReleaseAge` 等安全设置两版都支持，差别只在默认值——不构成留在 10 的理由 |
| pnpm 12 立即采用 | `latest` 已是 12.x，但 corepack 0.34 运行 pnpm 12 报 `MODULE_NOT_FOUND`（实测），生态兼容待观察；按检查点在 2027-03-31 前切换 |
| 只靠 corepack 锁版本 | Node 25+ 官方构建不带 corepack，brew 的 Node 26 也没有；其行为随 Node 补丁号变化；无法拒绝错误的包管理器 |
| Node 24 基线 | 用户裁决直接取 Node 26（rulings §4.15 Q9）；Node 24 仅作为 CI 兼容冒烟的可选项 |
| 同时发 CJS | Node 26 与所有 bundler 支持 ESM；双格式是 attw 问题的主要来源 |

## 后果

- 正：一套产物；类型增强完整；增量构建快；幻影依赖为零。
- 负：库不预打包，消费方冷启动需处理更多文件（可接受；`sideEffects:false` 保证 tree-shake）；`tsc -b` 首次全量构建较慢（Turborepo 远程缓存缓解）。

## 如何被机械验证

- CI：`pnpm install --frozen-lockfile`（strict peers，设置取自 `pnpm-workspace.yaml`）；`turbo run build typecheck lint test depcruise manifest api iso-smoke policy`。
- `publint` + `attw --pack` 对每个包。
- `tooling/scripts/sync-references`：tsconfig `references` 与 package.json 依赖一致。
- `lockfile-guard`（lefthook pre-commit + CI）：除根 `pnpm-lock.yaml` 外任何 lockfile（`yarn.lock`、`package-lock.json`、子目录 `pnpm-lock.yaml`）出现即失败。
- 09-type-discipline/08 矩阵新增一行 TD：`packageManager` 版本 = `devEngines.packageManager` 版本；`pnpm-workspace.yaml` 中上述安全设置全部显式存在；`.npmrc` 不含非鉴权键；`catalog.typescript` 匹配 5.9/6.x。负向用例：子目录出现 `package-lock.json` → 失败；根目录 `npm install` → `EBADDEVENGINES`。
- `.node-version`、`devEngines.runtime`、服务端 Dockerfile 基础镜像三处 Node 主版本一致（26）。
- 扫描器 `scan-manifest` 规则 (c) 的子检查 + publint（09-type-discipline/04 §4，TD-090；原名 `no-src-conditions`、原称独立扫描器，2026-09-25 按 09-type-discipline/08 §11 对照表改写，rulings §4.18 GV-15）：任何包 `exports` 不得含 `development`/`source` 条件或指向 `src/`。

## 关联

章程 D9、Q9；`00-charter/rulings-2026-09-14.md` §1 C-9、§4.15 Q9；Univer A27/A34、K9；02 §2、§4.0.1；09-01/04/07/08；ADR-0002/0017/0046；`docs/_tools/MIGRATION.md`。
