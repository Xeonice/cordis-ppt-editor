# ADR-0004 monorepo 与构建工具链：pnpm + Turborepo；库 `tsc -b`；apps Vite；Changesets

> 状态：草稿 | 负责：架构-结构 | 更新：2026-09-14 | 依赖：charter v0.1

## 状态

提议（具体配置由 09-01/04/07 承接）。

## 背景

章程 D9 已定：pnpm workspaces + Turborepo、TS ≥ 5.9 最严格集 + `isolatedDeclarations`、Vitest、Playwright、Changesets、ESLint（typescript-eslint 类型感知）+ Biome 格式化。未定：库的构建方式（`tsc -b` 项目引用 vs `tsdown` 打包）、产物形态、开发期解析方式、包管理器细节（Q9）。

## 决策

| 项 | 决策 | 理由 |
|---|---|---|
| 包管理器 | pnpm 10.x，`packageManager` 字段 + corepack；`.npmrc`：`strict-peer-dependencies=true`、`node-linker=isolated`、`auto-install-peers=false` | 幻影依赖为零（K9）；peer 失配安装期即报 |
| 版本目录 | `pnpm-workspace.yaml#catalog` 统一第三方版本；`syncpack` 校验 | 单版本 |
| 任务编排 | Turborepo：`build`(dependsOn `^build`)、`typecheck`、`lint`、`test`、`depcruise`、`manifest`、`api`、`iso-smoke`、`policy`；输出缓存 `lib/**`、`etc/**` | 增量与缓存 |
| **库构建** | **`tsc -b`（项目引用）产出未打包 ESM + 逐文件 `.d.ts` + sourcemap**；`isolatedDeclarations: true`；`type: module`；不发 CJS | (1) 消除 dev/prod 分叉：开发与发布都用 `lib/`；(2) 逐文件 `.d.ts` 保留 `declare module` 增强（ADR-0001 S4）；(3) `isolatedDeclarations` 使 d.ts 生成并行且快；(4) 消费方（Vite/Node）自行打包与 tree-shake（`sideEffects:false`） |
| 打包器 | 不用于库；`tsdown` 保留给未来「独立浏览器包」（如 pptx-renderer 的 `browser.es.js` 形态）—— 单独包 `@oce/standalone`（未列入 v0.1） | 避免双构建产物不一致 |
| apps | Vite 7（web）；Nest CLI（server，`tsc`）；apps 通过 workspace 依赖消费 `lib/` | |
| 开发期解析 | 根 `tsc -b --watch`；**不**用 `exports.development` 条件或 Vite alias 指向 `src` | 与发布形态一致；避免「编译过、运行崩」类问题（A27 的同族） |
| 测试 | Vitest（workspace 模式；iso→node 环境，dom→happy-dom + browser mode 子集）；Playwright（apps/web e2e、视觉 oracle） | |
| 格式与 lint | Biome 只做 formatter；ESLint flat config + typescript-eslint `strict-type-checked` + 自定义规则包 | 规则集单一来源 |
| 发布 | Changesets；fixed 组见 ADR-0002；`publint` + `attw` 门禁 | A27 |
| Node | ≥ 22 LTS | `--import` 冒烟、原生 ESM |
| TypeScript | ≥ 5.9；`moduleResolution: bundler`（apps）/ `nodenext`（libs 与 server） | |

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| `tsdown`/`tsup` 打包每个库 | 与 `tsc` 的 d.ts 双产物需保持一致；bundled d.ts 常丢 `declare module` 增强；开发期又要另一套解析 |
| `exports.development` → `src` | dev/prod 分叉；`isolatedDeclarations` 下收益低 |
| Nx | 团队熟悉度与配置量；Turborepo 足够 |
| Bun/yarn | Q9 默认 pnpm；`node-linker=isolated` 的严格性是 K9 的机械保证 |
| 同时发 CJS | Node ≥ 22 与所有 bundler 支持 ESM；双格式是 attw 问题的主要来源 |

## 后果

- 正：一套产物；类型增强完整；增量构建快；幻影依赖为零。
- 负：库不预打包，消费方冷启动需处理更多文件（可接受；`sideEffects:false` 保证 tree-shake）；`tsc -b` 首次全量构建较慢（Turborepo 远程缓存缓解）。

## 如何被机械验证

- CI：`pnpm install --frozen-lockfile`（strict peers）；`turbo run build typecheck lint test depcruise manifest api iso-smoke policy`。
- `publint` + `attw --pack` 对每个包。
- `tooling/scripts/sync-references`：tsconfig `references` 与 package.json 依赖一致。
- lefthook 拒绝非 pnpm lockfile（`yarn.lock`/`package-lock.json` 出现即失败）。
- 扫描器 `no-src-conditions`：任何包 `exports` 不得含 `development`/`source` 条件或指向 `src/`。

## 关联

章程 D9、Q9；Univer A27/A34、K9；02 §2、§4.0.1；09-01/04/07。
