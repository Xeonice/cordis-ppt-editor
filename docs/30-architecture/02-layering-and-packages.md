# 02 分层与包：仓库目录树、逐包结构、package.json 策略、依赖规则

> 状态：草稿 | 负责：架构-结构 | 更新：2026-09-18 | 依赖：charter v0.1
> 本文是 M0 后半段「创建仓库骨架」的直接输入。包名/层号/同构类以章程 §5.2 为准，不得更名；本文只细化到目录与文件。接口只给「签名级草案」（标注「草案」），不写实现。

---

## 1. 分层网格（章程 §5.1 的落地版）

```
                     水平层（文档类型盲）                                    同构类   角色
 L0  基础     shared ─ kernel ─ protocol ─ i18n                              iso     库 / 插件
 L1  文档内核 model-core ─ [store-memory | store-yjs]                         iso     Definition / Provider
 L3  格式基础 ooxml-core                                                     iso     库
 L4  协同     collab-core ─ [collab-yjs] ─ [collab-transport-ws] ─ [collab-offline-idb]   iso/dom Definition / Provider
 L5  引擎     engine-layout ─ engine-render ─ [render-dom]                   iso/dom Definition / Provider
 L7  UI 基座  design ─ ui-core ─ [ui-react]                                  dom     Definition / Provider
 L8  组装     preset-slide-viewer ─ preset-slide ─ preset-slide-collab ─ apps/web ─ apps/server   dom/node Bundle / App
 LS  服务端   server-collab ─ server-storage ─ server-headless               node    库 / Provider

                     垂直束（每束横跨 V-model / V-codec / V-render / V-ui 四个「层带」）
                   slide（M1–）            doc（M5）            sheet（M5）        允许依赖的水平层
 V-model   model-slide              model-doc            model-sheet         ≤ L1               iso
 V-codec   ooxml-pptx               ooxml-docx           ooxml-xlsx          ≤ L3 + 本束 V-model iso
 V-render  slide-render             doc-render           sheet-render        ≤ L5 + 本束 ≤V-codec dom
           slide-render-chart（M3 起从 slide-render 拆出的可选图表渲染插件）
 V-ui      slide-ui                 doc-ui               sheet-ui            ≤ L7 + 本束 ≤V-render dom
```

「层带」是本文对章程「L2/L3/L6 垂直束视为各自层号」的机械化解读（README C-1；**总编排已裁决采纳，章程 v0.2 起不再使用 L2/L6 作层号**）。机械化形式是一张**秩表**（类型治理线 depcruise 用数值比较，语义与本文 §7 R2 的允许矩阵等价）：

```
 layer     L0   L1   V-model   L3   V-codec   L4   L5   V-render   LS   L7   V-ui   L8
 rank       0   10     15      30     35      40   50     55       58   70    75    80
 规则：rank(to) ≤ rank(from)
       ∧ 束间隔离（不同 bundle 互不 import；无 bundle 的水平层不得 import 任何 bundle 包）
       ∧ 同构类（node 不得 import dom；iso 只能 import iso）
 例：V-model(15)→L1(10) ✓  V-model→L3(30) ✗  V-codec(35)→V-model(15) ✓  V-render(55)→L5(50) ✓
     LS(58)→engine-layout/engine-render(L5, iso) ✓  LS→render-dom(L5, dom) ✗（同构类拦截）  LS→L7 ✗  L8→任意 ✓
```

第 7 节把它写成 dependency-cruiser 规则的语义；`package.json#oce` 字段编码见 §4.0.1。

---

## 2. 仓库根目录

```
/
├── package.json                 私有工作区根：packageManager=pnpm@10.x（corepack）、engines.node>=22、脚本：build/typecheck/lint/test/depcruise/api/manifest/policy/check（check = 全部门禁）
├── pnpm-workspace.yaml          packages: apps/*, packages/*, tooling/*；catalog: 第三方版本目录（cordis、zod、yjs、react、vitest、typescript…），各包用 catalog: 引用，保证单版本
├── turbo.json                   任务图：build(dependsOn ^build, outputs lib/**)、typecheck、lint、test、depcruise、api-extract、manifest-gen、iso-smoke、policy-check；远程缓存可选
├── tsconfig.json                solution 文件：只含 references（全部包 + apps），`tsc -b` 入口；无 files
├── tsconfig.base.json           extends tooling/tsconfig/base.json；仅供编辑器发现；包不直接 extends 此文件（各包按同构类 extends iso/dom/node）
├── eslint.config.js             flat config：import @oce-tooling/eslint-config 预设；按 package.json#oce 派生同构类/层级规则参数
├── biome.json                   仅 formatter（缩进/引号/行宽）；linter 关闭（lint 归 ESLint，避免双规则集冲突）
├── .dependency-cruiser.cjs      引用 tooling/depcruise 生成的规则；规则语义见 §7；配置由 09-03 承接
├── lefthook.yml                 pre-commit：biome format + eslint --fix（staged）；pre-push：typecheck + depcruise + manifest-gen --check + policy-check；commit-msg：conventional commits（09-07）
├── .changeset/config.json       Changesets：fixed 组 = 水平 L0–L1 lockstep 包（ADR-0002）；ignore apps/*
├── .npmrc                       strict-peer-dependencies=true、auto-install-peers=false、node-linker=isolated、shamefully-hoist=false（幻影依赖为零，K9）
├── .editorconfig / .gitignore / .gitattributes（fixtures/**/*.pptx 走 Git LFS）
├── README.md                    仓库说明：一句话定义、快速开始、文档入口（docs/README.md）
├── LICENSE                      待决 A-7（建议 Apache-2.0）
├── CONTRIBUTING.md              贡献流程：openspec change → 实现 → 门禁；「规范↔执行」勾选表
├── SECURITY.md                  漏洞披露；pptx 输入视为不可信（zip 限额，04 §5.6）
├── .github/                     见 §2.1
├── apps/                        见 §3
├── packages/                    见 §4
├── tooling/                     见 §5
├── fixtures/                    见 §6
├── docs/                        本目录（章程 §8 文档树）
└── openspec/                    变更管理（proposal/design/specs/tasks），实现变更引用 docs/
```

### 2.1 `.github/`

```
.github/
├── workflows/
│   ├── ci.yml                   PR 门禁（全部在 pull_request 触发，A18）：install → build → typecheck → lint（禁 --quiet，A16）→ depcruise → manifest-gen --check → api-extract --check → test:unit → iso-smoke → schema-lock → type-budget → policy-check
│   ├── e2e.yml                  Playwright（apps/web）+ 视觉 oracle（11）；PR 触发，允许 fixtures 缺失时跳过 oracle 并标注
│   ├── release.yml              Changesets 版本与发布（main 分支）
│   └── policy-matrix.yml        运行 tooling/policy-check：09-08 矩阵中每条规范的执行 job 必须存在于 ci.yml/e2e.yml 且在 PR 触发器中
├── CODEOWNERS                   packages/{shared,kernel,protocol,model-core,engine-*}/ → 架构 owner；packages/*-slide*/ → slide 团队；tooling/ → 类型治理
├── pull_request_template.md     勾选：涉及哪些规范、对应执行点是否新增/修改、是否有 changeset、是否更新 manifest/api.md
└── ISSUE_TEMPLATE/              bug（附最小 pptx）、feature、plugin-compat
```

---

## 3. `apps/`

`apps/*` 只做组装与传输壳（章程 R2、P1）。**机械验证**：depcruise 规则 `apps-only-assemble`（apps/web 只可 import `@oce/preset-*`、`@oce/protocol`、`@oce/ui-react`（仅 `<EditorHost>`）、`@oce/design`；apps/server 只可 import `@oce/server-*`、`@oce/protocol`、`@oce/kernel`（类型））；扫描器规则 `no-domain-defs-in-apps`（apps/** 内不得出现 `defineCommand`/`defineMutation`/`ctx.contribute(`）。

### 3.1 `apps/web`（L8，dom）

```
apps/web/
├── package.json                 private；deps: @oce/preset-slide-viewer, @oce/preset-slide, @oce/preset-slide-collab, @oce/ui-react, @oce/design, @oce/protocol, react, react-dom, react-router
├── vite.config.ts               React 插件；resolve 走 workspace 的 lib/（不 alias 到 src，避免 dev/prod 分叉）；chunk 按垂直束拆分
├── tsconfig.json                extends tooling/tsconfig/dom.json；references 到依赖包
├── index.html                   单页入口
├── public/                      静态资源（favicon、示例 pptx 链接）
├── src/
│   ├── main.tsx                 React 根；读取运行时配置（API base、WS URL、OIDC）；不创建 host（host 在 EditorPage 内按文档创建，支持多编辑器实例）
│   ├── app/
│   │   ├── routes.tsx           路由：/login、/documents、/documents/:id（编辑器）
│   │   ├── auth/                OIDC PKCE 客户端、token 存储、刷新；只用 protocol 的 DTO
│   │   └── api/                 REST 客户端：documents/snapshots/import-export/audit；全部经 protocol schema `parse`（parse, don't validate）
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DocumentsPage.tsx    文档列表/新建/上传（上传 = 调用 import 任务或直接本地打开）
│   │   └── EditorPage.tsx       创建 host（见 host/）、units.open、渲染 <EditorHost host unitId>；卸载时 host.dispose()
│   ├── host/
│   │   ├── create-editor-host.ts  组装：createHost({ sinks }) + ctx.plugin(createSlidePreset(options)) 或 createSlideCollabPreset(options)；options 来自 URL/租户配置；这里是 apps/web 唯一「知道插件存在」的地方
│   │   └── sinks.ts               errors/telemetry 的应用侧 Provider 选择（控制台 / Sentry / OTel Web）——通过 host options 注入，不在此实现
│   ├── styles/                  应用壳样式：`@import "@oce/ui-react/styles.css"`（含 preflight + 主题变量）+ 应用页面自身的 Tailwind 工具类（`@tailwindcss/vite`，`@source` 指向 apps/web/src）；壳页面（文档列表、分享/权限、插件管理器宿主页）的原子组件来自 `@oce/ui-react/ui`（R17 允许 apps/*）
│   └── env.d.ts
├── e2e/                         Playwright：打开示例 pptx、编辑、导出、协同双浏览器（11）
└── README.md
```

### 3.2 `apps/server`（L8，node）

```
apps/server/
├── package.json                 private；deps: @nestjs/*（唯一允许 import @nestjs 的包，§5.3 规则 4）、@oce/server-collab、@oce/server-storage、@oce/server-headless、@oce/protocol、pg/drizzle、ioredis、ws
├── nest-cli.json / tsconfig.json / tsconfig.build.json
├── src/
│   ├── main.ts                  bootstrap：env schema 校验（zod）→ Nest app → WS adapter
│   ├── app.module.ts            模块装配
│   ├── config/
│   │   └── env.schema.ts        环境变量 Standard Schema（DB/Redis/S3/OIDC/限额）；启动前失败（primer MUST #4）
│   ├── modules/
│   │   ├── auth/                OIDC 校验、Principal 构造（protocol.Principal）、租户解析
│   │   ├── documents/           文档 CRUD、权限元数据（fail-closed guard）
│   │   ├── snapshots/           快照包索引、blob 预签名 URL、压缩任务触发（策略在 server-collab）
│   │   ├── collab-gateway/      WS 网关：握手帧校验、房间接入、把帧交给 server-collab；权限变更下发
│   │   ├── import-export/       异步任务 API；任务执行调用 server-headless（worker）
│   │   ├── thumbnails/          M3：headless Chromium 缩略图任务（server-headless 适配）
│   │   ├── audit/               审计记录查询；写入由拦截器完成
│   │   └── health/
│   ├── infra/
│   │   ├── cordis-host.provider.ts  Nest Provider 包装 server-headless 的 host（每进程一个；任务在 worker 内再建 host）
│   │   ├── db/                  drizzle schema + migrations（表：documents、permissions、crdt_updates、snapshots、audit）
│   │   ├── redis/               pub/sub、presence 键空间
│   │   └── storage/             绑定 server-storage 的 Provider（S3/MinIO/本地）
│   └── common/
│       ├── filters/error-envelope.filter.ts   OceError → protocol.ErrorEnvelope（含 traceId）
│       ├── guards/permission.guard.ts         fail-closed：无显式允许即 403
│       └── interceptors/audit.interceptor.ts  写审计
├── test/                        e2e（supertest + ws 客户端）
├── Dockerfile / docker-compose.yml（Postgres/Redis/MinIO，Q10）
└── README.md
```

模块细节、部署拓扑由 08 负责；本文只固定目录与「业务逻辑不在 apps/server」的边界（机械验证：depcruise `server-app-thin`——`apps/server/src/modules/**` 不得 import `yjs`/`@oce/model-*`/`@oce/ooxml-*`，只能经 `@oce/server-*`）。

---

## 4. `packages/`

### 4.0 包模板（所有包相同的骨架）

```
packages/<name>/
├── package.json                 见 §4.0.1
├── tsconfig.json                extends ../../tooling/tsconfig/{iso|dom|node}.json；compilerOptions.rootDir=src、outDir=lib、composite=true、isolatedDeclarations=true；references: 依赖包（与 package.json 依赖一一对应，由 tooling/scripts/sync-references 校验）
├── tsconfig.test.json           extends tsconfig.json；include src/**/__tests__、src/testing；types: vitest/globals
├── vitest.config.ts             environment：iso→node；dom→happy-dom（真实布局用例 browser mode）；node→node；setupFiles 引入 @oce/kernel/testing 的 matchers
├── api-extractor.json           extends ../../tooling/api-extractor/base.json；mainEntryPointFilePath lib/index.d.ts；reportFolder etc/
├── etc/<name>.api.md            api-extractor 报告基线（入库；PR diff 必审，A21）
├── README.md                    包职责、公共 API 概览；「服务/贡献点/事件」表由 manifest-gen 写入标记区（保持与 manifest 一致）
├── CHANGELOG.md                 Changesets 生成
├── oce-manifest.json            构建产物（由 src/manifest.ts 序列化；发布时包含；仅插件包有）
├── src/
│   ├── index.ts                 仅 re-export 公共 API（api-extractor 入口）；禁止副作用（sideEffects:false 的保证）
│   ├── plugin.ts                函数插件：export const name/inject/provide/Config + export function apply(ctx, config)（仅插件包有；纯库无）
│   ├── manifest.ts              生成物（头部标记 generated），export const manifest: Manifest（ADR-0003）
│   ├── <pkg>.contribution.ts    declare module '@oce/kernel' 增强（Context/Events/I18nKeys）+ 贡献点定义导出；不得含运行时 import（lint contribution-file-purity）
│   ├── contracts/               Definition：接口、请求/结果类型、Standard Schema
│   ├── services/                Provider：Service 子类（*.service.ts）
│   ├── errors.ts                本包错误码（defineErrors）
│   ├── events.ts                本包事件名常量（与 contribution 文件声明一致；扫描器 events-declared 校验）
│   ├── testing/index.ts         `./testing` 子路径：测试替身、构造器、契约套件工厂；可 import vitest 类型但不得 import 测试运行器实现
│   └── __tests__/               单测；插件包必含 lifecycle.test.ts（调用 defineLifecycleSuite）
└── lib/                         构建产物（gitignore）：逐文件 .js + .d.ts + .map
```

#### 4.0.1 `package.json` 字段策略

```jsonc
{
  "name": "@oce/model-core",
  "version": "0.1.0",                       // 水平 L0–L1 lockstep；其余独立（ADR-0002）
  "type": "module",                          // ESM only；不发 CJS（Node ≥22 与所有 bundler 均支持）
  "sideEffects": false,                      // 所有包均无导入副作用；design 的 css 文件例外，用数组显式列出 ["./css/*.css"]
  "files": ["lib", "etc/*.api.md", "oce-manifest.json", "README.md", "CHANGELOG.md"],
  "exports": {                               // 显式子路径，禁止 "./*"（A27）；publint + attw 门禁
    ".":           { "types": "./lib/index.d.ts",         "default": "./lib/index.js" },
    "./testing":   { "types": "./lib/testing/index.d.ts", "default": "./lib/testing/index.js" },
    "./package.json": "./package.json",
    "./oce-manifest.json": "./oce-manifest.json"
  },
  "peerDependencies": {                      // 需要单实例的 @oce 包全部是 peer（kernel 必须单例，否则两套 cordis）
    "@oce/kernel": "workspace:^",
    "@oce/protocol": "workspace:^"
  },
  "dependencies": {                          // 纯库、无状态、可多实例的包作为普通依赖
    "@oce/shared": "workspace:^"
  },
  "devDependencies": { "@oce/kernel": "workspace:*", "@oce/protocol": "workspace:*" },  // peer 的开发副本
  "oce": {                                   // 本项目元数据（总编排裁决的规范编码，章程 v0.2 采纳）；schema 在 tooling/depcruise/oce-field.schema.json（09-03）
    "layer": "L1",                           // L0|L1|L3|L4|L5|L7|L8|LS|V-model|V-codec|V-render|V-ui（不再使用 L2/L6）；秩表见 §1
    "bundle": undefined,                     // slide|doc|sheet —— 当且仅当 layer 以 V- 开头时必填；水平层不得出现此键（depcruise 由此判定盲性与束间隔离）
    "iso": "iso",                            // iso|dom|node —— 决定 tsconfig 预设、vitest 环境、iso-smoke 是否运行、同构类依赖规则（node ✗→dom；iso 只→iso）
    "role": "definition",                    // library|plugin|definition|provider|bundle|app|tooling（provider 需给出 implements）
    "implements": [],                        // provider 实现的 Definition 服务名，例如 ["store"]
    "stability": "beta"                      // stable|beta|experimental —— 公共面稳定级（PRD PS-02；进入 manifest.stability 与 api-extractor 报告）
  }
  // 垂直束示例：{ "layer": "V-model", "bundle": "slide", "iso": "iso", "role": "plugin", "stability": "beta" }
}
```

规则摘要与执行点：

| 规则 | 执行点 |
|---|---|
| `exports` 显式枚举 `.`/`./testing`（+ `package.json`、`oce-manifest.json`）；无 `./*` | `publint`、`@arethetypeswrong/cli`、扫描器 `exports-explicit`（09-04） |
| `sideEffects: false`（design 例外列 css） | 扫描器：`src/index.ts` 无顶层调用表达式；bundler 验证 |
| 第三方单点：`cordis` 仅 kernel；`yjs`/`y-protocols` 仅 store-yjs/collab-yjs/server-collab；`y-indexeddb`（或自写 IDB 适配）仅 collab-offline-idb；`react`、`radix-ui`、`class-variance-authority`、`clsx`、`tailwind-merge`、`lucide-react`、`tailwindcss`/`@tailwindcss/*`、`tw-animate-css`、`cmdk`、`sonner`、`vaul`、`react-resizable-panels`、`@fontsource-variable/geist` 仅 ui-react 与 `*-ui`（shadcn 复制件所在，章程 §5.3 规则 4、ADR-0017）；`@nestjs/*` 仅 apps/server；`fflate` 仅 ooxml-core/server-storage；`zod` 仅 protocol/kernel（Standard Schema 实现选择集中）；图表绘制库（Apache-2.0/MIT）仅 slide-render/chart → slide-render-chart | depcruise `third-party-single-entry`（09-03）；`syncpack` 单版本 |
| `@oce/*` 需要单实例者为 `peerDependencies`；`shared` 为 dependency | 扫描器 `peer-policy` 读取 `oce.role`：plugin/provider 的 `@oce/kernel`、`@oce/model-core` 等必须在 peer |
| `oce` 字段必填、schema 校验（`layer` 取值集合；`bundle` 当且仅当 `V-*` 时存在；`iso`；`stability`） | `manypkg check` + 自定义 schema（09-03）；depcruise 规则由该字段生成（§7） |
| 同构类：`iso` 包 tsconfig 无 `dom` lib、无 `@types/node`；禁止 `node:*` | tsconfig 预设 + `no-restricted-imports` + `iso-smoke`（`node --import` 冒烟）（A20） |

#### 4.0.2 `./testing` 子路径的约定

- 仅导出**测试辅助**：替身（fake/recording）、构造器（builders）、契约套件工厂（`defineXxxSuite`）、fixture 加载器。
- 不得导出生产代码；生产代码不得 import 任何 `./testing`（depcruise `no-testing-in-prod`）。
- 契约套件是 Provider 的验收：`store-memory`/`store-yjs` 的 `__tests__` 必须实例化 `@oce/model-core/testing` 的 `runDocumentStoreConformance`。契约套件统一命名为 `run<Definition>Conformance`（总编排裁决；如 `runFormatCodecConformance`、`runRenderTargetConformance`、`runTextMeasurerConformance`），由各 Definition 包的 `testing/` 导出；生命周期套件 `defineLifecycleSuite` 不受影响。

---

### 4.1 `@oce/shared` — L0 · iso · library

职责：纯工具、品牌类型、`Result`、断言；**零依赖**（不依赖 cordis、zod）。

```
packages/shared/src/
├── index.ts
├── brand.ts               Brand<T, Tag> 工具类型；brand()/unbrand()；`declare const tag: unique symbol` 模式
├── ids.ts                 UnitId、NodeId、DocumentId 等品牌 id（模板字面量前缀可选）；newNodeId()（UUIDv7，ADR-0014）；isNodeId()
├── units/
│   ├── emu.ts             Emu/Pt/Px/Inch/Cm/Mm 品牌数值；常量 EMU_PER_INCH=914400、EMU_PER_PT=12700；emu()/pt()/toPx(emu, dpi)
│   ├── angle.ts           Angle60k（1/60000 度）、Percent1000（千分比）、Percent100k（10 万分比，DrawingML）；转换与归一
│   └── index.ts
├── result.ts              Result<T,E> = Ok<T> | Err<E>；ok()/err()/isOk()/map()/andThen()/unwrapOr()/collect()；错误传播基元（禁止用 boolean 表示失败）
├── assert.ts              invariant(cond, msg)/assertNever(x)/unreachable()；生产保留（抛 AssertionFailure，由 errors 服务归类）
├── json.ts                JsonValue/JsonObject/JsonArray；isJsonValue()；stableStringify()（键排序，用于哈希与快照 diff）
├── path.ts                Path = readonly PathSegment[]；PathSegment = string | number | { id: string }；pathEquals/startsWith/append/toString
├── order.ts               FracKey 品牌与 between(a?, b?)（base-62、最短键 + 2 字符随机后缀）、compareOrder((order, id))、rekey(keys)（ADR-0032 的纯函数实现；供命令层生成键、Store/渲染排序使用）
├── collections.ts         不可变友好的 Map/Set 工具、groupBy、sortBy、binarySearchBy、dedupe；无模块级可变状态
├── hash.ts                sha256(bytes)（WebCrypto subtle，同构）；fnv1a32(string)（快速非加密）
├── text.ts                grapheme 切分（Intl.Segmenter 封装 + 降级）、Unicode 空白/标点判定基元（供 layout 与 model-doc）
├── disposable.ts          Disposable = () => void | Promise<void>；composeDisposers()、once()（非 cordis 场景使用；插件内一律用 ctx.effect）
├── deep-freeze.ts         deepFreeze()（开发期，store-memory 不变性校验）
├── typed-events.ts        极简类型化 emitter（仅供不在 cordis 生命周期内的纯库使用，如 opc 读取进度）
├── testing/
│   └── index.ts           fast-check arbitraries：ids、units、JsonValue、Path
└── __tests__/
```

为什么不像 Univer：Univer 的 `core` 里工具与领域模型混杂（A1）；这里 `shared` 明确「无领域知识、无框架」，以 depcruise `shared-has-no-deps`（`shared` 的 dependencies 必须为空）机械保证。

### 4.2 `@oce/kernel` — L0 · iso · plugin（内核）

职责：唯一 import `cordis`；re-export 类型；`createHost`；ContributionPoint；Manifest；`errors`/`telemetry`；`createIsolatedScope`；诊断。详见 03。

```
packages/kernel/src/
├── index.ts                 re-export：type { Context, Service, Plugin, Fiber, Events, Inject }、FiberState、CordisError、ValidationError；createHost；defineContributionPoint；Manifest 类型；errors/telemetry 契约；createIsolatedScope；diagnostics
├── augment.ts               export interface Events {} / Context {} / I18nKeys {}（本项目的可增强接口）；declare module 'cordis' { interface Events extends OceEvents {} interface Context extends OceContext {} }（ADR-0001）
├── host.ts                  createHost(options: HostOptions): OceHost —— new Context()、挂载 kernel 插件（本包 plugin.ts）、版本协商、失败隔离；OceHost = { ctx, dispose(), kernelVersion, diagnostics }
├── host-options.ts          HostOptions 的 Standard Schema：{ kernelVersion?: string, strictManifest?: boolean, defaultSinks?: boolean（默认 true：kernel 自身贡献控制台 errors.sink 与 no-op telemetry.sink）, loggerSink?, clock? }
├── plugin.ts                kernel 插件：provide ['contributions','errors','telemetry']；apply 内挂载三个服务与失败隔离监听；使内核服务本身可被同名 Provider 替换（§5.4）
├── manifest.ts              生成物
├── kernel.contribution.ts   declare module '@oce/kernel'：Context.contributions/errors/telemetry；Events（公开，按 10 §11）'plugin/loaded'、'plugin/failed'、'plugin/incompatible'、'error/raised'、'contribution/changed'；内部诊断事件 'kernel/manifest-mismatch'；贡献点定义 ErrorSinkPoint('errors.sink')、TelemetrySinkPoint('telemetry.sink')（ADR-0011）
├── contribution/
│   ├── point.ts             defineContributionPoint<T, K extends string>(spec: { id: PointId; schema: StandardSchemaV1<unknown, T>; key: (item: T) => K; conflict?: 'error' | 'replace'; describe?: (item: T) => string }): ContributionPoint<T, K>；PointId = `${Lowercase}.${string}`
│   ├── service.ts           ContributionService extends Service（name 'contributions'）：[Service.invoke](point) → ReadonlyContributionSet；contribute(point, item) → disposer（effect 拥有）；diagnostics()
│   ├── set.ts               ReadonlyContributionSet<T, K>：get(key)/has/values()/keys()/size/observe(listener) → disposer；变更通知合并到微任务
│   ├── mixin.ts             ctx.mixin('contributions', ['contribute'])（**全仓唯一** mixin 调用点，A12；lint no-mixin-outside-kernel）
│   └── diagnostics.ts       ContributionDiagnostic：{ pointId, key?, reason: 'schema' | 'duplicate' | 'unknown-point', issues, fiberName }
├── manifest/
│   ├── types.ts             Manifest 接口（id/version/iso/kernel/provides/injects/optional/contributes/points/events/config）与 ContributionEntry
│   ├── schema.ts            Manifest 的 Standard Schema（运行时校验 oce-manifest.json）
│   ├── verify.ts            verifyManifestAgainstRuntime(fiber, manifest) → MismatchReport；strictManifest 时使 Fiber FAILED，否则 errors.report + emit 'kernel/manifest-mismatch'
│   └── version.ts           satisfies(range, version) 最小 semver 实现（避免引入 semver 依赖到 iso 包）；kernel peer 校验（ADR-0002）
├── scope.ts                 createIsolatedScope(ctx, spec: { services: readonly string[]; meta?: Record<PropertyKey, unknown> }) → Context：依次 extend(meta) 与 isolate(name)；文档无关（model-core 用它建 UnitScope）
├── services/
│   ├── errors.service.ts    ErrorsService（'errors'）：defineErrors(pkg, table)、create(code, data)、report(err, ctx?)、wrap(unknown)、isOceError；report 扇出到 contributions(errors.sink)，sink 抛错被吞并计数；OceError { code, data, cause, fiber }
│   ├── telemetry.service.ts TelemetryService（'telemetry'）：defineTelemetryEvents(pkg, table)（遥测事件注册表，PRD 06 §5）、counter/gauge/histogram/span/event；扇出到 contributions(telemetry.sink)；采样在服务内完成
│   ├── sinks/console-error-sink.ts / noop-telemetry-sink.ts   默认 sink（kernel 插件在 defaultSinks !== false 时贡献；no-console lint 的白名单文件；ADR-0011）
│   └── logger.ts            对 cordis 内建 ctx.logger 的结构化包装：字段化、级别、脱敏钩子；不新增服务名
├── failure-isolation.ts     监听 Fiber 状态迁移（rc.10：internal/status）→ FAILED 时 errors.report + emit 'plugin/failed'({ pluginId, version, code, phase })；ACTIVE 时 'plugin/loaded'；版本协商失败 'plugin/incompatible'；断言兄弟 Fiber 状态不变（A11）
├── errors.ts                kernel 错误码（`defineErrors('kernel', …)`；运行时字符串为点式 `kernel.plugin_failed` 等，10 §1.1 / rulings §4.3；源码以大写标识符引用）：PLUGIN_FAILED、VERSION_MISMATCH、CONTRIBUTION_REJECTED、MANIFEST_MISMATCH、DUPLICATE_KEY、UNKNOWN_POINT
├── diagnostics/
│   ├── fiber-tree.ts        dumpFiberTree(ctx) → FiberNode[]：name/state/uid/effects(label 树)/children
│   └── assert.ts            assertNoLiveEffects(fiber)、assertSingleProvider(ctx, name)、assertState(fiber, state)
├── testing/
│   ├── index.ts
│   ├── create-test-host.ts  createTestHost(opts?)：记录型 errors/telemetry sink；mountAndAwait(plugin, config)、expectPending(fiber)、expectFailed(fiber, code)
│   ├── lifecycle-suite.ts   defineLifecycleSuite({ plugin, config, provides?, injects? })：初始挂载 / 缺依赖 PENDING / 依赖后到激活 / 卸载后 getEffects 为空 / 重复挂载 N 次无重复注册 / Provider 替换重跑（primer MUST #7）
│   └── fakes.ts             RecordingErrors、RecordingTelemetry
└── __tests__/
```

为什么不像 Univer：Univer 没有清单、没有统一注册、没有失败隔离（A8/A9/A11）；这里内核只做四件事（贡献点、清单、基础服务、作用域工具），**没有任何文档知识**。机械验证：depcruise `only-kernel-imports-cordis`；lint `no-mixin-outside-kernel`；kernel 自身 `__tests__` 包含「注入抛错插件，其它插件仍 ACTIVE」。

### 4.3 `@oce/protocol` — L0 · iso · library

职责：前后端共享契约，全部 zod（Standard Schema）定义并导出推导类型；**禁止 `enum`**（A3）。

```
packages/protocol/src/
├── index.ts
├── schema.ts               z 实例导出约定、Infer<T>、strictObject 默认（拒绝未知键，除显式 passthrough）
├── ids.ts                  DocumentId/UserId/TenantId/RoomId/SessionId/TaskId 品牌 schema（z.string().brand）
├── version.ts              PROTOCOL_VERSION、兼容矩阵（客户端 ↔ 服务端）
├── errors/
│   ├── codes.ts            错误码字面量联合（`auth/*`、`document/*`、`collab/*`、`task/*`、`protocol/*`）→ HTTP 状态映射表
│   └── envelope.ts         ErrorEnvelope { code, message, details?, traceId }
├── permissions/
│   ├── actions.ts          PermissionAction 字面量联合：document.read/edit/comment/export/share/manage（开放：垂直束经模板字面量 `${string}.${string}` 扩展）
│   ├── principal.ts        Principal { userId, tenantId, roles, sessionId }
│   └── decision.ts         PermissionDecision = { allow: true } | { allow: false; reason }
├── rest/
│   ├── documents.ts        列表/详情/创建/重命名/删除/权限设置 DTO
│   ├── snapshots.ts        快照包索引、blob 预签名 URL（GET/PUT）
│   ├── import-export.ts    任务创建/查询；TaskState 字面量联合 queued/running/succeeded/failed
│   ├── auth.ts             login/refresh/me
│   ├── audit.ts            AuditRecord { id, principal, unitId?, commandId?, mutationTypes[], at, result }
│   └── index.ts
├── ws/
│   ├── handshake.ts        握手帧：{ token, documentId, clientVersion, protocolVersion }；服务端应答 { roomId, permissions, serverVersion }
│   ├── frames.ts           帧判别联合：sync(payload bytes) / awareness(bytes) / permission-changed(decisions) / error(envelope) / ping|pong
│   └── index.ts
├── snapshot/
│   └── envelope.ts         SnapshotEnvelope { documentType, schemaVersion, bodyRef: BlobRef, blobs: BlobRef[], createdAt, byVersion }
├── blob.ts                 BlobRef { hash: sha256-hex, size, contentType }（与 model-core 共用同一定义；model-core re-export）
├── testing/index.ts        DTO 工厂（faker 风格，确定性 seed）
└── __tests__/              schema 快照测试（JSON Schema 输出入库，作为跨语言契约基线）
```

机械验证：lint `no-enum-in-protocol`；`zod-to-json-schema` 输出入库并 diff（契约变更可见）。

### 4.4 `@oce/i18n` — L0 · iso · plugin

```
packages/i18n/src/
├── index.ts
├── plugin.ts               provide ['i18n']；Config { locale: string; fallback: 'zh-CN' }
├── manifest.ts
├── i18n.contribution.ts    Context.i18n；Events 'i18n/locale-changed'(locale)；贡献点 i18n.bundle 定义（key = `${namespace}:${locale}`）；interface I18nKeys {}（垂直束增强）
├── services/i18n.service.ts I18nService：t<K extends keyof I18nKeys>(key, params)、locale、setLocale()（Operation 域）；从 contributions(i18n.bundle) 合并；缺 key 走 fallback 并 telemetry
├── keys.ts                 从 locales/zh-CN.json 推导的 key 类型（`as const` JSON 导入 + 递归键路径类型）；缺 key 编译失败（K8）
├── format.ts               ICU MessageFormat 子集（plural/select）+ Intl 数字/日期
├── locales/
│   ├── zh-CN.json          源语言（key 权威）
│   └── en-US.json          翻译；CI 校验 key 集合 == 源
├── testing/index.ts        fixedLocale() 测试 Provider
└── __tests__/
```

机械验证：脚本 `i18n-keys-sync`（所有 locale 的 key 集合等于 zh-CN）；类型测试 `t('不存在的key')` 必须报错。

### 4.5 `@oce/model-core` — L1 · iso · definition（文档内核）

职责：Unit/UnitScope、DocumentType 贡献点、DocumentStore 定义、Command/Mutation/Operation + `commands` 服务、`history`、`Transaction`、Snapshot 编解码 + `schemaVersion` + `migrations`、ResourceHook、`permissions`（fail-closed）、`formats` 贡献点、通用 `Selection`。签名级草案见 04/05。

```
packages/model-core/src/
├── index.ts
├── plugin.ts                     provide ['units','documentTypes','commands','formats','resources','migrations','permissions']；inject ['contributions','errors','telemetry']；Config { defaultStoreProvider?: string; historyLimit: number; coalesceMs: number }
├── manifest.ts
├── model-core.contribution.ts    declare module '@oce/kernel'：服务表、事件表（按 10 §11 定稿：unit/opened|open-progress|open-failed|closed|dirty-changed|saved|migrated、command/execute(waterfall，内部拦截点)|executed|rejected|failed|audited、store/transaction|loaded、history/changed、selection/changed、permission/changed|denied、export/started|completed|failed）；导出贡献点：DocumentTypePoint('core.documentType')、CommandPoint('core.command')、MutationPoint('core.mutation')、FormatPoint('core.format')、ResourcePoint('core.resource')、MigrationPoint('core.migration')、PermissionPolicyPoint('core.permissionPolicy')
├── unit/
│   ├── unit.ts                   Unit { id: UnitId; documentType: string; meta: { title?, source? }; state: 'opening'|'ready'|'closing'|'failed' }
│   ├── unit-descriptor.ts        OpenUnitDescriptor { documentType; source: { kind:'snapshot'; bundle } | { kind:'bytes'; mime?; name?; bytes } | { kind:'state'; encoding:'yjs-update' | 'snapshot-json'; bytes; blobs? }（服务端/离线恢复直接加载存储状态，B 线 08）| { kind:'empty' }; storeProvider?: string; principal?: Principal }
│   ├── unit-scope.ts             UnitScope { unit; ctx: Context; fiber: Fiber; dispose(): Promise<void> }；ISOLATED_SERVICES = ['store','history','selection','render','presence'] as const；实际隔离集 = ISOLATED_SERVICES ∪ documentType.unitServices ∪ 所选 store Provider 的全部 provide 名（如 store-yjs 的 'yjsBackend'）；unit 元数据 symbol 键
│   ├── unit-plugin.ts            unitPlugin(ctx, { descriptor, documentType, storeProvider })：在 Fiber 内 createIsolatedScope → 挂载 store Provider → store.load(snapshot) → 挂载 history/selection 默认 Provider → 挂载 documentType.unitPlugins → emit unit/opened（ADR-0005）
│   └── units.service.ts          UnitsService（'units'）：open(descriptor) → Promise<Result<UnitScope, UnitError>>；close(unitId)；get(unitId)；list()；observe()；解析 storeProvider（Config 默认 → 描述符覆盖）
├── document-type/
│   ├── document-type.ts          DocumentType<S> { id; displayName; schemaVersion: number; bodySchema: StandardSchemaV1<unknown, S>; shape: BodyShapeHints（entityTables/atomicLists/richTexts 路径前缀，供 store-yjs 选 Y 类型、store 校验原语适用范围）; createEmpty(): S; unitPlugins: readonly Plugin[]; unitServices: readonly string[]; selectionKinds: readonly string[]; viewModes: readonly string[]（`view.setMode` 的合法取值）; invariants: readonly Invariant<S>[]（check/repair 纯函数，服务端修复 ADR-0034）; validateChangeSet(view, changeSet): Result<void, Violation[]>; diff?(a, b): Mutation[]（M3 版本恢复）}（04 §2.1）
│   ├── document-type.point.ts    defineContributionPoint({ id:'core.documentType', key: d => d.id, conflict:'error' })
│   └── document-types.service.ts DocumentTypesService（'documentTypes'）：get(id)/list()/observe()；resolveByMime(mime) 经 formats
├── store/
│   ├── store.ts                  DocumentStore<S> Definition（草案见 04 §2.2）：state()/get(path)/transact(fn, opts)/observe(listener)/undo(origin)/redo(origin)/canUndo/canRedo/toSnapshotBody()/load(body)/dirty(): ChangeSet|null/schemaVersion
│   ├── ops.ts                    StoreOp 判别联合（set/delete/insert/remove/text 五种；无 move——有身份实体的顺序是 `order: FracKey` 属性，ADR-0013/0032）；TextDelta（Quill 风格 insert/retain/delete + attributes）；isStoreOp() schema
│   ├── transaction.ts            Transaction { origin; label; meta; mutate(m: Mutation): Result<void, MutationError>; readonly ops: readonly StoreOp[] }；TransactionRecord { id, origin, label, mutations: Mutation[], ops: RecordedOp[]（StoreOp + 可选 anchor{ after?, before? }，供审计/版本 diff 可读）, inverse: StoreOp[], at, undoable }
│   ├── change-set.ts             ChangeSet { transactionId; origin; ops: StoreOp[] | null（远端 CRDT 应用后可能为 null/近似）; derived: boolean; touched: Path[]（权威字段，前缀去重）}；mergeChangeSets()
│   ├── origin.ts                 Origin：local(clientId, via?: 'undo' | 'redo') / remote / system(reason: load | import | migration | repair | restore | maintenance) / replay；isLocal()（与 06 §2.2 对齐）
│   └── store-provider.ts         StoreProviderPlugin 约定：函数插件，provide ['store']，Config { initialBody, schemaVersion }；由 unit-plugin 在隔离 ctx 下挂载
├── command/
│   ├── command.ts                CommandDef<P, R>（草案见 05 §2）；OperationDef<P>（handler 无 tx）；defineCommand()/defineOperation() 仅为类型辅助（不注册）
│   ├── command.point.ts          'core.command'，key = def.id，conflict 'error'
│   ├── mutation.ts               MutationDef<M>：{ type; documentType; schema; lower(m, view): StoreOp[]; permission?(m): PermissionAction; describe(m): string }；Mutation 基形 { type: string; unitId: UnitId }
│   ├── mutation.point.ts         'core.mutation'，key = def.type
│   ├── commands.service.ts       CommandsService（'commands'）：execute<P,R>(unitId: UnitId | null, id, params, opts?) → Promise<Result<R, CommandError>>；has(id)；describe(id)；observeExecutions()
│   ├── pipeline.ts               阶段实现：resolve → validate → waterfall 'command/execute' → transact → history → events → audit；阶段计时 telemetry（05 §3）
│   ├── permission-gate.ts        内置 prepend 监听（fail-closed）：命令级 + Mutation 级（在 tx.mutate 内二次调用）
│   ├── audit.ts                  内置监听（最外层）：构造 AuditRecord（protocol）→ emit 'command/audited'
│   └── errors.ts                 COMMAND_NOT_FOUND / INVALID_PARAMS / PERMISSION_DENIED / UNIT_NOT_FOUND / HANDLER_FAILED / MUTATION_REJECTED / STORE_UNAVAILABLE
├── history/
│   ├── history.ts                History Definition（UnitScope）：undo()/redo()/canUndo/canRedo/entries()/beginGroup(label)/endGroup()/clear()；事件 history/changed
│   ├── history.service.ts        HistoryService（'history'）默认 Provider：策略层（按 origin 只撤本地、合并窗口、容量、分组），委托 store.undo/redo
│   └── coalesce.ts               合并规则（同 label、同 origin、间隔 < coalesceMs）
├── snapshot/
│   ├── snapshot.ts               Snapshot<S> { documentType; schemaVersion; unitId; body: Persisted<S>; resources: Record<ResourceNamespace, { version: number; data: JsonValue }>; blobs: BlobRef[] }；SnapshotBundle { snapshot; blobs: BlobStore }
│   ├── codec.ts                  encodeSnapshot(unitScope) / decodeSnapshot(bundle, documentType) → Result；校验 body schema 与 resources schema
│   ├── derived.ts                Derived<T> 品牌；Persisted<T> 映射类型（递归剔除 Derived 字段）；类型测试辅助 expectPersistedEquals<T, U>()
│   ├── blob-store.ts             BlobStore Definition：get(ref)/put(bytes, contentType) → ref/has(ref)；MemoryBlobStore 默认 Provider（IndexedDB/S3 Provider 在别处）
│   └── validate.ts               validateSnapshot(snapshot, documentType, resourceHooks) → Diagnostics
├── migration/
│   ├── migration.ts              Migration<S1, S2> { documentType; from: number; to: number; migrate(body: S1): S2; migrateResources?(r): r }
│   ├── migration.point.ts        'core.migration'，key = `${documentType}:${from}->${to}`
│   └── migrations.service.ts     MigrationsService（'migrations'）：plan(documentType, from, to) → Result<Migration[]>；run(snapshot) → Result<Snapshot>；缺链 → MIGRATION_PATH_MISSING
├── resource/
│   ├── resource-hook.ts          ResourceHook<T> { namespace: `${PluginId}.${string}`; version: number; schema; toJson(unitScope): T | undefined; fromJson(unitScope, data: T): void }
│   ├── resource.point.ts         'core.resource'，key = namespace
│   └── resources.service.ts      ResourcesService（'resources'）：collect(unitScope) / apply(unitScope, resources)；逐 hook 容错（一个失败记录诊断，不阻断其它，K6）
├── permission/
│   ├── permission.ts             PermissionRequest { principal; unitId?: UnitId; action: PermissionAction; resource?: { kind; id } }；PermissionPolicy { id; decide(req): PermissionDecision | undefined }
│   ├── permission.point.ts       'core.permissionPolicy'，key = policy.id
│   └── permissions.service.ts    PermissionsService（'permissions'）：check(req) → PermissionDecision（无策略给出 allow → deny；任一 deny → deny）；setPrincipal(unitId, principal)；applyRemoteDecisions(unitId, decisions)（网关下发）；事件 permission/denied
├── format/
│   ├── format-codec.ts           FormatCodec { id; documentType; mimeTypes; extensions; canImport; canExport; import(bytes, opts, blobs): Promise<Result<ImportResult>>; export(unitScope, opts): Promise<Result<Uint8Array>> }；ImportResult { snapshot; diagnostics }
│   ├── format.point.ts           'core.format'，key = codec.id；按 mime 二级索引
│   └── formats.service.ts        FormatsService（'formats'）：detect(bytes | filename) → codec?；import()/export()；事件 export/started|completed|failed（10 §11；导入完成即 unit/opened，无独立事件）
├── selection/
│   ├── selection.ts              Selection<A = unknown> { kind: string; unitId; anchors: readonly A[]; primary?: number }；selectionEquals()、serialize（presence 用）
│   └── selection.service.ts      SelectionService（'selection'，UnitScope）默认 Provider：get()/set(sel)/observe()；事件 selection/changed；不入历史
├── drawing/                      DrawingML 共享绘图词汇的**运行时类型 + zod schema**（三种文档类型共用；无 XML 知识、无文档类型字面量；决策见 §4.9）
│   ├── color.ts                  Color { spec: srgb|scheme|system|preset|hsl|scrgb; modifiers: ColorModifier[] }；SchemeColorName；ColorMapKey
│   ├── fill.ts                   Fill = noFill | solid | gradient | blip | pattern | groupFill
│   ├── line.ts                   Line { width: Emu; cap; compound; alignment; fill; dash; join; headEnd; tailEnd }
│   ├── effect.ts                 EffectList（outerShadow/innerShadow/glow/reflection/softEdge/blur）+ OpaqueXml 余量
│   ├── geometry.ts               Geometry = preset(preset, adjustments) | custom(paths, adjustments, guides, connectionSites, textRect)；GeometryPath 命令集
│   ├── transform.ts              Transform { offset; extent; rotation: Angle60k; flipH; flipV }；GroupTransform
│   ├── font.ts                   FontRef { typeface | '+mj-lt' | '+mn-lt' | '+mj-ea' | '+mn-ea' | '+mj-cs' | '+mn-cs'; panose?; pitchFamily?; charset? }
│   ├── text.ts                   TextBody / BodyProperties / Paragraph / ParagraphProperties / Inline(Run|LineBreak|Field) / RunProperties / ListStyle / Bullet / Spacing / TabStop
│   ├── hyperlink.ts              Hyperlink { target: { kind:'external'; url } | { kind:'internal'; ref: string（文档类型自解释）} | { kind:'action'; action }; tooltip? }
│   ├── opaque.ts                 OpaqueXml { xml; anchor: { after?: QName; ordinal }; namespaces }；OpaqueSlot；OpaquePartRef { partName; contentType; blob: BlobRef; rels?: BlobRef }
│   ├── schema/                   以上每个类型的 zod schema
│   └── index.ts
├── events.ts                     事件名常量对象（与 contribution 声明一致）
├── errors.ts                     model-core 错误码
├── testing/
│   ├── index.ts
│   ├── fixture-document-type.ts  'fixture' 文档类型：body = { nodes: Record<NodeId, { kind; props; parentId; order: FracKey }>; texts: Record<NodeId, RichText> }；shape hints（nodes 为 entityTables、texts 为 richTexts）；含 3 个 Mutation、2 个 Command、1 个 JSON FormatCodec、1 个 ResourceHook、1 个 Migration（v1→v2）、2 个 Invariant（无父子环、order 合法）（ADR-0016）
│   ├── document-store-conformance.ts   runDocumentStoreConformance(createStore: (body) => DocumentStore)：事务原子性、observe 时序、undo/redo 语义（含 origin 过滤）、快照往返等价、并发事务拒绝、text delta 语义
│   ├── command-harness.ts        createCommandHarness(host, unitScope)：执行命令并断言 ops/事件/审计/权限调用
│   └── permission-fakes.ts       allowAllPolicy、denyAllPolicy、recordingPolicy
└── __tests__/
```

为什么不像 Univer：Univer `core` 内含 3.4 万行 sheets/docs 模型且 `unitId + subUnitId` 寻址是 workbook 形状（A1/A2）。这里 `model-core` 没有任何寻址假设（`Path` 与 `Selection<A>` 参数化），没有任何文档类型字面量。机械验证：lint `no-doc-type-literals`（水平层源码不得出现 `'slide'|'sheet'|'doc'` 等字面量，允许列表在 09-02）；depcruise 水平层禁 import 垂直束；`__tests__` 只使用 `fixture` 文档类型。

### 4.6 `@oce/store-memory` — L1 · iso · provider（implements `store`）

```
packages/store-memory/src/
├── index.ts
├── plugin.ts                provide ['store']；Config { initialBody; schemaVersion; historyLimit: 200; freezeInDev: true }（在 UnitScope 隔离 ctx 下挂载）
├── manifest.ts
├── store-memory.contribution.ts
├── memory-store.ts          MemoryStore<S> implements DocumentStore<S>：不可变树 + 结构共享；transact 内串行应用 ops；失败回滚到事务前引用
├── apply-op.ts              applyOp(state, op) → { next; inverse: StoreOp }：五种原语各自的应用与逆推导（set→set/delete、insert→remove、remove→insert、text→delta 逆）
├── produce.ts               最小 path-based 不可变更新（无第三方 immer；≤200 行）；{id} 选择器在数组中按 id 字段查找
├── text-delta.ts            富文本 delta 应用/求逆/组合（与 Y.Text delta 兼容的形状）
├── history-stack.ts         事务记录栈（含 origin）、undo/redo 指针、容量淘汰（淘汰策略必须被测试调用，A29）
├── observe.ts               观察者分发：事务提交后同步一次、传 ChangeSet
├── testing/index.ts         createMemoryStore(body)
└── __tests__/               含 runDocumentStoreConformance 实例化；property test：apply(inverse(apply(s, op))) ≡ s
```

### 4.7 `@oce/store-yjs` — L1 · iso · provider（implements `store`；唯一 import `yjs` 的模型侧包）

```
packages/store-yjs/src/
├── index.ts
├── plugin.ts                provide ['store','yjsBackend']（两者都在 UnitScope 隔离域内）；Config { clientId?; gc: boolean; undoCaptureTimeout: 500 }（与 05 §6 `coalesceMs` 统一为 500）
├── manifest.ts
├── store-yjs.contribution.ts
├── yjs-store.ts             YjsStore<S> implements DocumentStore<S>：持有 Y.Doc；transact → doc.transact(fn, origin)；observe → observeDeep 事件 → ChangeSet
├── mapping/
│   ├── path-resolver.ts     Path → Y.Map/Y.Array/Y.Text 定位；{id} 选择器按元素 id 字段查找（归一化实体表时通常为 Y.Map 键）
│   ├── apply-op.ts          StoreOp → Y 操作（set/delete → Y.Map；insert/remove → Y.Array（仅无身份值列表）；text → Y.Text.applyDelta）；实体 `order` 是普通 Y.Map 键写入（ADR-0032）
│   ├── to-json.ts           Y 树 → 不可变 JSON 视图（增量缓存，按 Y 事件失效）
│   └── from-json.ts         load(body) → 构建 Y 树
├── undo.ts                  Y.UndoManager 封装：trackedOrigins = { localOrigin }；captureTimeout；与 history 服务对接 canUndo/canRedo
├── yjs-backend.service.ts   YjsBackend 服务（'yjsBackend'，UnitScope）：给 collab-yjs 的受控访问面（encodeStateAsUpdate/applyUpdate/onUpdate/stateVector/stats；不外泄 Y.* 类型到公共 API，06 §2.3）。取代旧稿 symbol 键 `doc-access`（B 线建议二选一，选服务：依赖在 manifest 可见、store-memory 下 collab-yjs 自然 PENDING）
├── testing/index.ts         createYjsStore(body)、twoDocsInSync() 测试助手
└── __tests__/               含 runDocumentStoreConformance 实例化；双文档收敛测试（06）
```

### 4.8 `@oce/model-slide` — V-model · iso · plugin（垂直束 slide）

职责：幻灯片对象模型、命令与变更、样式继承纯函数、`slides` 服务、`slide.shapeKind` 贡献点、`extensions` 不透明槽。模型字段草案见 04 §3。

```
packages/model-slide/src/
├── index.ts
├── plugin.ts                    主入口插件（`@oce/model-slide`）：inject ['contributions','documentTypes']；apply：contribute core.documentType(slideDocumentType)、core.migration(全部)、slide.shapeKind(内建)；**不含**命令与变更（查看器可只加载它）
├── editing.ts                   编辑子插件（子路径 `@oce/model-slide/editing`，独立 chunk）：inject ['commands']；apply：contribute core.mutation(全部)、core.command(全部)；preset-slide/collab 加载，preset-slide-viewer 不加载（ADR-0015 只读双保险之一）
├── manifest.ts
├── slide.contribution.ts        declare module '@oce/kernel'：Context.slides（UnitScope）；Events 'slide/slide-added'|'slide/slide-removed'|'slide/shape-added'|'slide/shape-removed'|'slide/shape-changed'；I18nKeys 'slide.*'；导出 ShapeKindPoint('slide.shapeKind')
├── document-type.ts             slideDocumentType: DocumentType<PresentationBody> { id:'slide'; schemaVersion: 1; bodySchema; shape; createEmpty; unitPlugins:[slidesServicePlugin]; unitServices:['slides']; selectionKinds:['slides','shapes','text','tableCells']; viewModes:['normal','master','presenter']; invariants; validateChangeSet; diff }
├── ids.ts                       SlideId/MasterId/LayoutId/ThemeId/ShapeId/MediaId/NotesId 品牌（基于 NodeId）；OoxmlIds { cNvPrId?: number; creationId?: string }
├── model/
│   ├── body.ts                  PresentationBody（归一化实体表，A-9）：{ presentation; masters: Record<MasterId, SlideMaster>; layouts; slides: Record<SlideId, Slide>; themes; shapes: Record<ShapeId, Shape>; media: Record<MediaId, MediaRef>; opaqueParts: Record<PartName, OpaquePartRef> }
│   ├── presentation.ts          Presentation { slideSize: { cx: Emu; cy: Emu }; notesSize?; defaultTextStyle?: ListStyle; sections?: Record<SectionId, Section & { order: FracKey }>; properties: DocumentProperties; conformance: 'transitional'|'strict'; extensions: OpaqueSlot }（页序/母版序不在此：见各实体的 order）
│   ├── master.ts                SlideMaster { id; order: FracKey; name?; commonSlide: CommonSlideData; colorMap: ColorMap; textStyles: { title; body; other }: ListStyle; themeId: ThemeId; headerFooter?: HeaderFooter; preserve: boolean; timing?: OpaqueXml; transition?: OpaqueXml; ooxml: { sldMasterId? }; extensions }（ML-01/03，04 §12）
│   ├── layout.ts                SlideLayout { id; order: FracKey; masterId; type: LayoutType; name?; matchingName?; commonSlide; colorMapOverride?; showMasterShapes: boolean; preserve: boolean; userDrawn: boolean; ooxml: { sldLayoutId? }; extensions }
│   ├── slide.ts                 Slide { id; order: FracKey; layoutId; commonSlide; colorMapOverride?; showMasterShapes; hidden; notesId?: NotesId; transition?: OpaqueXml; timing?: OpaqueXml; ooxml: { sldId? }; extensions }
│   ├── common-slide-data.ts     CommonSlideData { name?; background?: Background; controls?: OpaqueXml; customData?: OpaqueXml; extensions }（形状不在此：shapes 表按 containerId 反查，按 (order, id) 排序）
│   ├── shape/
│   │   ├── shape.ts             Shape = Sp | Pic | GrpSp | CxnSp | GraphicFrame | UnknownShape（判别字段 kind）；ShapeBase { id; kind; containerId: SlideId | LayoutId | MasterId; parentId: ShapeId | null; order: FracKey; nonVisual: NonVisualProps; ooxml: OoxmlIds; extensions }
│   │   ├── non-visual.ts        NonVisualProps { name; hidden; description?; title?; hyperlink?: Hyperlink; placeholder?: PlaceholderRef; locks?: ShapeLocks }
│   │   ├── sp.ts                Sp { kind:'sp'; properties: ShapeProperties; style?: ShapeStyle; textBody?: TextBody; useBackgroundFill: boolean }
│   │   ├── pic.ts               Pic { kind:'pic'; blipFill: BlipFill(mediaId, sourceRect?, stretch|tile); properties; style?; media?: MediaLink（视频/音频） }
│   │   ├── grp-sp.ts            GrpSp { kind:'grpSp'; groupProperties: { transform: GroupTransform（含 childOffset/childExtent）} }（子形状 = parentId 指向本组者，按 (order, id) 排序；无 childIds 数组）
│   │   ├── cxn-sp.ts            CxnSp { kind:'cxnSp'; properties; style?; startConnection?: { shapeId; index }; endConnection? }
│   │   ├── graphic-frame.ts     GraphicFrame { kind:'graphicFrame'; transform: Transform; graphic: Table | Chart | Ole | Diagram | UnknownGraphic }
│   │   ├── table.ts             Table { kind:'table'; columnWidths: Emu[]; rows: TableRow[]; properties: TableProperties(styleId, firstRow, bandRow…) }；TableRow { height; cells: TableCell[] }；TableCell { textBody; properties; gridSpan; rowSpan; hMerge; vMerge }
│   │   ├── chart.ts             Chart { kind:'chart'; partRef: OpaquePartRef; embeddedWorkbook?: OpaquePartRef }（M1–M2 部件不透明写回；M1 查看由渲染器经 ooxml-core/chartml 只读解析 partRef，不依赖位图预览；M3 起 data 字段，ED-15 / A-11）
│   │   ├── ole.ts               Ole { kind:'ole'; progId; embedRef: OpaquePartRef; preview?: MediaId }
│   │   ├── diagram.ts           Diagram（SmartArt）{ kind:'diagram'; parts: OpaquePartRef[]; fallbackShapeIds?: ShapeId[]（dsp drawing 的可渲染回退）}
│   │   ├── unknown.ts           UnknownShape { kind:'unknown'; xml: OpaqueXml }（mc:AlternateContent 等）
│   │   └── placeholder.ts       PlaceholderRef { type: PlaceholderType; index?: number; orientation?; size?; hasCustomPrompt }
│   ├── text/
│   │   ├── text-body.ts         TextBody { bodyProperties: BodyProperties; listStyle?: ListStyle; paragraphs: Paragraph[] }
│   │   ├── body-properties.ts   BodyProperties { anchor; anchorCenter; wrap; insets: {l,t,r,b: Emu}; autofit: none|normal(fontScale, lnSpcReduction)|shape; vertical: TextVertical; columns?; rotation?; upright }
│   │   ├── paragraph.ts         Paragraph { properties: ParagraphProperties; runs: Inline[]; endProperties?: RunProperties }；Inline = Run | LineBreak | Field
│   │   ├── paragraph-properties.ts ParagraphProperties { level: 0..8; alignment; indent: Emu; marginLeft/Right: Emu; spaceBefore/After: Spacing; lineSpacing: Spacing; bullet: Bullet; tabs?: TabStop[]; defaultRunProperties?; rtl?; latinLineBreak?; hangingPunct? }
│   │   ├── run.ts               Run { kind:'run'; text: string; properties?: RunProperties }；LineBreak { kind:'br'; properties? }；Field { kind:'field'; type: string; id: string; text; properties? }
│   │   ├── run-properties.ts    RunProperties { size?: HundredthPt; bold?; italic?; underline?: UnderlineStyle; strike?; caps?; baseline?: Percent1000; spacing?; kerning?; fill?: Fill; highlight?: Color; latin?/eastAsian?/complexScript?/symbol?: FontRef; hyperlink?: Hyperlink; language?; altLanguage?; effects?: OpaqueXml }
│   │   ├── list-style.ts        ListStyle { levels: Partial<Record<0..8, ParagraphProperties>>; default?: ParagraphProperties }
│   │   └── bullet.ts            Bullet = none | inherit | char(char, font?, color?, size?) | autoNumber(scheme, startAt) | picture(mediaId)
│   ├── drawing/                 DrawingML 词汇：**re-export `@oce/model-core/drawing`**（Color/Fill/Line/EffectList/Geometry/Transform/FontRef/TextBody…，见 §4.5 与 §4.9 决策）+ 幻灯片特有扩展：
│   │   ├── index.ts             re-export
│   │   ├── shape-properties.ts  ShapeProperties { transform?: Transform; geometry?: Geometry; fill?: Fill; line?: Line; effects?: EffectList; scene3d?: OpaqueXml; shape3d?: OpaqueXml; blackWhiteMode? }
│   │   ├── shape-style.ts       ShapeStyle { lineRef; fillRef; effectRef; fontRef }（各含 idx 与 color）
│   │   ├── background.ts        Background = { kind:'properties'; fill; effects?; shadeToTitle } | { kind:'reference'; idx; color }
│   │   └── slide-hyperlink.ts   把 model-core Hyperlink.target.internal 的 ref 解释为 `slide:<SlideId>` | `first|last|next|previous`
│   ├── theme.ts                 Theme { id; name; colorScheme: Record<SchemeColorName, Color>; fontScheme: { major: FontSet; minor: FontSet }; formatScheme: { fills: Fill[]; lines: Line[]; effects: EffectList[]; backgroundFills: Fill[] }; extensions }；ColorMap = Record<ColorMapKey, SchemeColorName>
│   ├── media.ts                 MediaRef { id: MediaId; blob: BlobRef; contentType; originalPartName? }
│   ├── properties.ts            DocumentProperties { core: { title; creator; modified… }（建模）; app: OpaquePartRef; custom?: OpaquePartRef }
│   ├── extensions.ts            OpaqueSlot = OpaqueXml[]；OpaqueXml { xml: string; anchor: { after?: QName; ordinal: number }; namespaces: Record<prefix, uri> }；OpaquePartRef { partName; contentType; blob: BlobRef; rels?: BlobRef }
│   ├── derived.ts               标注 Derived<T> 的字段集合（例如 Shape.bounds?: Derived<Rect>），集中列出便于审计
│   └── schema/                  每个实体的 zod schema（bodySchema 的组成）；schema-lock 哈希入库（ADR-0009）
├── style/
│   ├── placeholder-match.ts     placeholderFamily / matchPlaceholder / planLayoutChange / planReset（ML-02 版式应用与重置的纯函数，04 §12.2）
│   ├── effective.ts             masterTextStyleKind / inheritedParagraphProperties / resolvePlaceholderBox / effectiveBackground / effectiveColorMap / dependentsOf（母版继承与反向索引，04 §12.2）
│   ├── inheritance-chain.ts     buildChain(body, shapeId, paragraphIndex, runIndex) → StyleChain（run→paragraph→textBody.listStyle→shape→layout placeholder→master placeholder→master textStyles→presentation defaultTextStyle→theme）
│   ├── resolve-run.ts           resolveRunProperties(chain): ResolvedRunProperties（纯函数；所有字段非 optional）
│   ├── resolve-paragraph.ts     resolveParagraphProperties(chain)
│   ├── resolve-shape.ts         resolveShapeVisual(body, shapeId): { fill; line; effects }（style refs → theme formatScheme）
│   ├── resolve-color.ts         resolveColor(color, ctx: { theme; colorMap; overrides }) → Rgba（scheme→clrMap→theme→修饰符）
│   └── cache.ts                 createStyleCache(): memo 按 (shapeId, revision)；invalidate(changeSet)（04 §6）
├── query/
│   ├── selectors.ts             getSlide/getShape/getPlaceholderOnLayout/getMasterOf/slidesInOrder/shapesOf(containerId)/childrenOf(groupId)…（对 body 的纯读取；有序结果按 (order, id) 排序，带派生排序缓存）
│   └── traverse.ts              walkShapes(body, rootIds, visitor)（深度优先、z 序）；pathOfShape()
├── mutations/
│   ├── index.ts                 allSlideMutations: MutationDef[]
│   ├── slide.ts                 slide.insert / slide.remove / slide.setOrder / slide.setLayout / slide.setHidden / slide.setBackground（载荷携带 order: FracKey，无下标）
│   ├── shape.ts                 shape.insert / shape.remove / shape.setOrder(z 序与进出组：order + parentId) / shape.setTransform / shape.setProperties / shape.setStyle / shape.group / shape.ungroup
│   ├── text.ts                  text.applyDelta / paragraph.setProperties / run.setProperties / textBody.setBodyProperties
│   ├── table.ts                 table.insertRow / removeRow / insertColumn / removeColumn / setCellProperties / merge / split
│   ├── media.ts                 media.add（BlobRef 注册）
│   ├── layout.ts                slide.layout.insert / remove / setName / setOrder / setProperties / setBackground；slide.slide.setLayout（携带 PlaceholderRemap）；slide.shape.clearOverrides / setPlaceholder（ML-02/03，05 §13.1）
│   ├── master.ts                slide.master.insert / remove / setOrder / setTheme / setProperties / setBackground / setTextStyle（ML-03）
│   ├── theme.ts                 slide.theme.insert / remove / setColors / setFonts（ML-04）
│   └── lower.ts                 降级工具：bodyPath.slides(id).shapes…，把语义变更转为 StoreOp（ADR-0013）
├── commands/
│   ├── index.ts                 allSlideCommands
│   ├── slide-commands.ts        slide.addSlide / deleteSlides / duplicateSlide / reorderSlides / changeLayout
│   ├── shape-commands.ts        slide.insertShape / deleteShapes / moveShapes / resizeShapes / rotateShapes / setFill / setLine / bringForward / sendBackward / group / ungroup
│   ├── text-commands.ts         slide.insertText / deleteText / toggleBold / setFontSize / setAlignment / setBullet
│   ├── picture-commands.ts      slide.insertPicture（含 blob 注册）/ replacePicture / crop
│   ├── table-commands.ts        slide.insertTable / …
│   ├── layout-commands.ts       slide.applyLayout / resetSlide / insertLayout / duplicateLayout / deleteLayout(reassignTo, fail-closed LAYOUT_IN_USE) / renameLayout / reorderLayouts / addPlaceholder / removePlaceholder / updatePlaceholder（ML-02/03，05 §13.2）
│   ├── master-commands.ts       slide.setMasterBackground / setLayoutBackground / setMasterTextStyle / insertMaster / duplicateMaster / deleteMaster（ML-03）
│   ├── theme-commands.ts        slide.setThemeColors / setThemeFonts / applyTheme（ML-04）
│   └── operations.ts            slide.setCurrentSlide / slide.setSelection / slide.setZoom / slide.selectMasterOrLayout（母版视图编辑目标）（Operation；`view.setMode` 为 ui-core 的水平层 Operation）
├── selection.ts                 SlideSelectionAnchor = { kind:'slide'; slideId } | { kind:'shape'; slideId; shapeId } | { kind:'text'; shapeId; start; end } | { kind:'tableCell'; shapeId; row; col }
├── services/
│   └── slides.service.ts        SlidesService（'slides'，UnitScope）：body()/slide(id)/shape(id)/order()/resolvedRun(...)/resolvedShape(...)/styleCache；只读 + 便捷命令封装（内部仍走 commands.execute）
├── shape-kind/
│   ├── shape-kind.point.ts      ShapeKindPoint（'slide.shapeKind'）：{ kind; schema; createDefault(box): Shape; capabilities: { text; resize; rotate; group }; describe }
│   └── builtin.ts               sp/pic/grpSp/cxnSp/graphicFrame:table|chart|ole|diagram/unknown 的内建贡献
├── migrations/
│   └── index.ts                 slide 的 Migration 列表（M1 为空数组但注册表存在，A23）
├── invariants/
│   ├── index.ts                 slideDocumentType.invariants：无父子环、parentId/containerId/layoutId/masterId/themeId 存在、order 为合法 FracKey 且同级 (order, id) 全序、占位符引用有效、媒体 BlobRef 被引用；含 04 §12.3 的 I-ML2…I-ML8（悬空版式/母版/主题的重指与级联修复）；每条 { id; check; repair? } 纯函数（服务端软门禁与修复，ADR-0034）
│   └── validate-change-set.ts   validateChangeSet(view, changeSet)：按 touched 前缀选取相关 invariants 求值（默认实现来自 model-core，此处只配置映射）
├── diff.ts                      diffBodies(a, b): SlideMutation[]（M3：版本恢复 = 以 restore origin 的一个事务写回；实体表逐键比对 + 文本 delta 计算）
├── create-empty.ts              createEmptyPresentation(): PresentationBody（默认主题、1 母版、若干版式、1 空白页）
├── testing/
│   ├── index.ts
│   ├── builders.ts              presentation().slide().shape('sp', {...}).text('…').build()
│   └── fixtures.ts              典型 body：单页文本、母版继承、分组、表格
└── __tests__/                   含 property test：所有 Mutation 的 lower 结果经 store-memory 应用后 body 仍满足 bodySchema
```

为什么不像 Univer：Univer slides 为 alpha 且模型即快照（A6）；这里模型有显式 `Derived<T>` 边界、`extensions` 不透明槽、归一化实体表（利于 CRDT 与路径寻址），并且**样式解析是纯函数**（可缓存、可测试、可在 Node 复用）。

### 4.9 `@oce/ooxml-core` — L3 · iso · library

职责：OPC、命名空间感知 XML、Strict↔Transitional 归一化、DrawingML 共享编解码、脏部件追踪与不透明保留引擎。**不依赖 model-core**（纯库，供任意 OOXML 格式复用）。

```
packages/ooxml-core/src/
├── index.ts
├── opc/
│   ├── package.ts            OpcPackage：open(bytes, limits) → { parts: PartTable; contentTypes; rootRels }；write(table) → bytes；[Content_Types].xml 与 *.rels **始终**由表生成
│   ├── part.ts               Part { name: PartName; contentType; bytes(): Promise<Uint8Array>（懒解压）; rels: Relationship[]; hash?: sha256 }
│   ├── part-table.ts         PartTable：按名/按内容类型/按关系类型索引；add/replace/remove；dirty 标记
│   ├── content-types.ts      Default/Override 解析与生成；扩展名 ↔ 内容类型表
│   ├── relationships.ts      .rels 解析/生成；Target 规范化（内部相对路径 / External）；rId 分配
│   ├── zip.ts                fflate 同构封装；ZipLimits { maxEntries; maxEntryBytes; maxTotalBytes; maxMediaBytes }（借鉴 pptx-renderer RECOMMENDED_ZIP_LIMITS）；超限 → 诊断错误而非崩溃；**写入确定性**（B 线 SV-02）：条目按部件名排序、固定 mtime（1980-01-01）、固定压缩级别/方法、无平台属性位 → 同输入两端产物字节相同
│   └── part-name.ts          PartName 品牌（以 / 开头、规范化大小写与 ../）
├── xml/
│   ├── parser.ts             同构命名空间感知解析（待决 A-2：默认自研）；保留前缀、属性顺序、空白文本、注释、PI；输出 XmlDocument
│   ├── node.ts               XmlElement/XmlText/XmlCData/XmlComment/XmlPI；QName { ns; local }；SafeXmlNode 空安全遍历（child().attr() 链式，缺失返回空节点，借鉴 pptx-renderer）
│   ├── serializer.ts         确定性序列化：声明头、前缀映射、属性顺序保持、UTF-8；空元素 `<a/>` 风格与源一致
│   ├── namespaces.ts         OOXML 命名空间常量（a/p/r/mc/a14/a16/p14/c/dgm…）；Strict↔Transitional URI 映射表
│   ├── normalize.ts          normalizeToTransitional(doc) → { doc; wasStrict }；toStrict(doc)（可选，A-3）
│   ├── mce.ts                mc:AlternateContent：Choice(Requires) 判定支持集 → 选可渲染分支；整体保留为 OpaqueXml
│   └── c14n.ts               canonicalize(doc) 供测试比较（属性排序、空白规范）；不用于导出
├── drawingml/
│   ├── color.ts              a:srgbClr/schemeClr/sysClr/prstClr/hslClr/scrgbClr + 修饰符 ↔ Color 结构（与 model-slide drawing/color 同形：定义放在 ooxml-core 的 `drawingml/types.ts`，model-slide re-export —— 见 §4.9 注）
│   ├── types.ts              DrawingML 共享类型（Color/Fill/Line/Effect/Geometry/Transform/Font/TextBody…）—— **model-slide 与未来 model-doc/sheet 共用**；不含任何 PresentationML 概念
│   ├── fill.ts / line.ts / effect.ts / geometry.ts / transform.ts / font.ts
│   ├── text.ts               a:bodyPr/a:lstStyle/a:p/a:pPr/a:r/a:rPr/a:br/a:fld ↔ TextBody 结构
│   └── index.ts
├── chartml/                  ChartML（`c:` 命名空间）**只读**解析（M1 图表查看路径，PRD OF-09；不写回、不进模型）
│   ├── types.ts              ChartReadModel：图表类型（bar/col/line/area/pie/doughnut/radar/scatter/bubble/stock/combo）、系列（名称、类别、值：来自 numCache/strCache）、轴、图例、标题、数据标签、样式引用；标注为只读视图类型
│   ├── parser.ts             parseChartSpace(xml) → Result<ChartReadModel, Diagnostic[]>：只读 `c:chartSpace`；缺缓存 → 诊断（不读内嵌工作簿）
│   ├── cache.ts              numCache/strCache 提取与 ptCount 上限（借鉴 pptx-renderer：≤ 10,000 点）
│   └── index.ts
├── preserve/
│   ├── opaque.ts             captureUnknown(element, knownChildren) → OpaqueXml[]（含锚点）；reinsert(parent, opaques, order) 按 schema 顺序表插回；被触碰元素自身的 extensions 同样经此回写（元素级保留，PRD CS-06）
│   ├── schema-order.ts       主要 CT_* 复杂类型的子元素顺序（生成物：从 ECMA-376 XSD 编译，仅覆盖已建模类型）
│   ├── dirty-tracker.ts      DirtyTracker：registerPart(partName, pathPrefixes[])；markDirty(paths) → 受影响部件；isDirty(partName)；clear()
│   └── verbatim.ts           原字节保留：Part 读入时计算 sha256 → BlobRef；导出时干净部件按 ref 取回
├── units.ts                  ST_Coordinate/ST_Angle/ST_Percentage（"50%" 与 50000 两种词法）/ST_TextFontSize ↔ 品牌数值
├── diagnostics.ts            ImportDiagnostic { severity: 'info'|'warning'|'error'; partName; path: string（XPath 风格）; code; message; data? }；DiagnosticsCollector
├── errors.ts                 ooxml-core 错误码：ZIP_LIMIT_EXCEEDED / MALFORMED_XML / MISSING_PART / BROKEN_RELATIONSHIP / UNSUPPORTED_CONFORMANCE
├── testing/
│   ├── index.ts
│   ├── xml-fixtures.ts       最小 XML 片段构造器
│   └── package-builder.ts    构造最小合法 OPC 包（测试用）
└── __tests__/                含往返 property：parse(serialize(parse(x))) ≡c14n parse(x)
```

**DrawingML 类型归属（决策）**：DrawingML（`a:` 命名空间）是 PresentationML / WordprocessingML / SpreadsheetML 三者共用的绘图词汇，它**不是文档类型知识**，但也不是零领域的工具。因此：

- `Color / Fill / Line / EffectList / Geometry / Transform / FontRef / TextBody…` 的**运行时类型与 zod schema** 放在 `@oce/model-core/src/drawing/`（L1，iso；无 XML 知识，无 slide/doc/sheet 字面量）；`model-slide` 的 `model/drawing/*` 只做 re-export 与幻灯片特有扩展（如 `Background`、`Hyperlink.target.slide`）。
- `ooxml-core/drawingml/*` 只做 **XML ↔ 上述类型的编解码**，因此 `ooxml-core` 依赖 `model-core`（L3 → L1，向下合法）。
- 依赖方向检查：`model-slide → model-core`（V-model → ≤L1 ✔）；`ooxml-pptx → ooxml-core, model-slide`（V-codec ✔）；`model-slide` **不** import `ooxml-core`。
- 放弃的方案：(a) 类型放 `ooxml-core`——会迫使 `model-slide`（V-model）向上依赖 L3；(b) 类型放 `shared`——违反 `shared` 零领域知识的约束。

这需要把章程 §5.2 中 `ooxml-core` 的依赖上限由「shared」改为「shared, model-core」，已登记为 README C-10。`no-doc-type-literals` lint 同样覆盖 `model-core/src/drawing/`，保证其中不出现文档类型字面量。

### 4.10 `@oce/ooxml-pptx` — V-codec · iso · plugin（FormatCodec Provider）

```
packages/ooxml-pptx/src/
├── index.ts
├── plugin.ts                  contribute core.format(pptxCodec)；Config { lazySlides: true; zipLimits; strictWriteBack: 'transitional' }
├── manifest.ts
├── ooxml-pptx.contribution.ts
├── codec.ts                   pptxCodec: FormatCodec { id:'ooxml-pptx'; documentType:'slide'; mimeTypes:[presentationml.presentation, .slideshow, .template, macroEnabled.*]; extensions:['.pptx','.ppsx','.potx','.pptm'] }
├── import/
│   ├── reader.ts              importPptx(bytes, blobs, opts) → Result<ImportResult>：OPC 打开 → 定位 presentation 部件 → 遍历 rels 图 → 分类 → 解析 → 组装 PresentationBody + opaqueParts + media → Snapshot
│   ├── classify.ts            按内容类型/关系类型分类：modeled（presentation/master/layout/slide/theme）| opaque-part（notes/handout/comments/tableStyles/presProps/viewProps/customXml/vba/charts/embeddings…）| media
│   ├── presentation.ts / master.ts / layout.ts / slide.ts / theme.ts   各部件 XML → 模型实体（调用 ooxml-core/drawingml）；未知子元素 → captureUnknown → extensions
│   ├── shape-tree.ts          p:spTree → shapes 表（containerId = 本部件实体；顶层 parentId = null；order 按文档顺序生成等距 FracKey；按 kind 分派；mc:AlternateContent → unknown）
│   ├── placeholder.ts         p:ph 解析与 layout/master 占位符索引
│   ├── table.ts / chart.ts / ole.ts / diagram.ts   graphicFrame 内容
│   ├── media.ts               媒体部件 → BlobRef（sha256 去重）→ MediaRef
│   ├── notes-text.ts          备注部件的**只读**文本提取（供备注面板 M1 显示，PRD OF-11）；部件本身仍不透明保留
│   ├── comments.ts            M3：现代评论部件（modernComment_*.xml / commentAuthors）→ resources['slide-comments.threads']（ResourceHook 由 comments 插件定义；存储见 ADR-0031）；M1–M2 仅不透明保留
│   ├── ids.ts                 cNvPr/@id + a16:creationId → NodeId 分配；构建 OoxmlIdMap（ADR-0014）
│   └── lazy.ts                懒解析：先建 slide 索引（部件名、顺序、layout 关系），slide 内容按需解析（渲染/搜索/导出时物化）（借鉴 pptx-renderer）
├── export/
│   ├── writer.ts              exportPptx(unitScope, opts) → bytes：读取 body + DirtyTracker → 干净部件 verbatim / 脏部件重生成 / 新部件生成 → PartTable → OPC 写出；**不读时钟、不读 layout**（docProps 时间戳来自 DocumentProperties.core.modified 模型字段；R2 秩表禁止 V-codec import engine-layout）→ 浏览器与服务端产物字节一致（SV-02）
│   ├── presentation.ts / master.ts / layout.ts / slide.ts / theme.ts   模型 → XML（reinsert OpaqueXml）
│   ├── shape-tree.ts
│   ├── ids.ts                 NodeId → cNvPr/@id 回写（复用原 id；新节点分配未占用 uint；重复修复）；creationId 回写
│   ├── rels.ts                关系重建（新增 slide/media 的 rId）；notesSlide 等 opaque 部件的 rels 原样保留
│   ├── timing-refs.ts         删除形状后清理不透明 p:timing 子树中的悬空 spid 引用（或整段失效 p:par）（PRD OF-12；对不透明内容唯一允许的修改）
│   ├── comments.ts            M3：resources['slide-comments.threads'] → 现代评论部件（可关：PD-04）；M1–M2 评论部件 verbatim
│   ├── chart-workbook.ts      M3 P1：从可编辑 Chart.data 生成最小内嵌 .xlsx（PD-06；不可行时移除内嵌并诊断 CHART_WORKBOOK_DROPPED，由 B 线定降级）
│   ├── conformance-writer.ts  §4.4 三案实现：C（Transitional→Strict 反向映射写回，依赖 ooxml-core/xml/normalize.toStrict 与 OpaqueXml.namespaces 原始 URI）→ XSD 校验 → 失败回退 B（整包 Transitional）并诊断 STRICT_FALLBACK_TRANSITIONAL
│   └── content-types.ts       新增媒体扩展名注册
├── mapping/
│   └── part-map.ts            registerPartPrefixes(dirtyTracker, body)：slides.<id>.* → /ppt/slides/slideN.xml 等（供 DirtyTracker）
├── conformance.ts             检测 Strict（命名空间）并记录到 Presentation.conformance；导出策略选择（04 §4.4 三案，README A-3 待决：推荐 C 目标 + B 回退）
├── errors.ts / diagnostics.ts 代码：UNSUPPORTED_PART / PLACEHOLDER_UNRESOLVED / ID_COLLISION_REPAIRED / STRICT_NORMALIZED / STRICT_FALLBACK_TRANSITIONAL / TIMING_REF_REMOVED / CHART_CACHE_MISSING
├── testing/
│   ├── index.ts
│   └── roundtrip.ts           roundTrip(bytes) → { partDiff: PartDiff[]; canonicalDiff }（M1 验收工具：逐部件字节比较；排除容器元数据，A-12）
└── __tests__/                 fixtures/pptx 语料：minimal（全部 verbatim）、features（脏一个部件后其它 verbatim）、wild
```

### 4.11 `@oce/collab-core` — L4 · iso · definition

契约包；运行时细节由 06 负责。

```
packages/collab-core/src/
├── index.ts
├── collab.contribution.ts       Context.collab（root）、Context.presence（UnitScope）、Context.collabTransport、Context.offlineStore；Events（10 §11 定稿）collab/state-changed|synced|soft-conflict|auth-failed|reconnect|update-rejected|repair、presence/joined|left|changed
├── contracts/
│   ├── collab.service.ts        abstract CollabService extends Service（'collab'）：join(unitScope, room: RoomDescriptor) → Promise<Result<Session>>；leave(unitId)；status(unitId)
│   ├── session.ts               Session { state: SyncState; observe(); dispose() }；SyncState = disconnected|connecting|syncing|synced|offline|error
│   ├── room.ts                  RoomDescriptor { documentId; token; endpoint }
│   ├── transport.ts             Transport Definition：connect(handshake) / send(frame) / onFrame(cb) / close()；Backoff 策略接口
│   ├── awareness.ts             AwarenessState { user; selection: SerializedSelection; page?; color; lastActive }
│   ├── offline-queue.ts         OfflineQueue 接口（enqueue/flush/size）
│   └── permission-checkpoint.ts onPermissionChanged(unitId, decisions) → permissions.applyRemoteDecisions（与 model-core 对接）
├── presence/
│   ├── presence.service.ts      PresenceService Definition（UnitScope）：self()/peers()/setLocal(partial)/observe()
│   └── local-presence.ts        单人默认 Provider（无 peers）；preset-slide 使用
├── sync-state.ts                状态机 reducer（纯函数）
├── errors.ts
├── testing/index.ts             FakeTransport（可脚本化断线/延迟）、FakeCollab
└── __tests__/
```

### 4.12 `@oce/collab-yjs` / `@oce/collab-transport-ws` — L4 · iso · provider

```
packages/collab-yjs/src/
├── index.ts / plugin.ts（provide ['collab','presence']；inject ['store','yjsBackend','collabTransport','permissions','telemetry']；可选 ctx.get('offlineStore')——与 06 §3 一致）/ manifest.ts / collab-yjs.contribution.ts
├── yjs-collab.service.ts        YjsCollabService extends CollabService：y-protocols sync（step1/step2/update）与 awareness 编解码；把帧交给 Transport
├── awareness-bridge.ts          y-protocols awareness ↔ PresenceService（Selection 序列化）
├── offline-queue.ts             基于 Y.Doc 本地 update 缓冲的离线队列实现
├── testing/index.ts
└── __tests__/                   双客户端 + FakeTransport 收敛测试

packages/collab-transport-ws/src/
├── index.ts / plugin.ts（provide ['collabTransport']——Transport 的服务名，06 定稿）/ manifest.ts / contribution.ts
├── ws-transport.ts              WebSocket 连接、握手帧、重连退避（jitter）、心跳
├── backoff.ts
├── testing/index.ts             内存 ws 对（服务端替身）
└── __tests__/
```

### 4.12b `@oce/collab-offline-idb` — L4 · dom · provider（implements `offlineStore`；总编排接受的 B 线新增包）

职责：`OfflineStore` Provider——把本地未确认的 CRDT update 与文档快照持久化到 IndexedDB，实现跨刷新的离线编辑（PRD PD-05 M4 P2；M3 会话内队列由 collab-yjs 的内存实现承担）。**唯一**允许 import `y-indexeddb`（或自写 IDB 适配）的包。契约（`OfflineStore` Definition）在 `collab-core/contracts/offline-queue.ts` 由 06 给出签名。

```
packages/collab-offline-idb/src/
├── index.ts
├── plugin.ts                    provide ['offlineStore']（UnitScope 内挂载，随 Unit 打开建库、关闭释放）；Config { dbNamePrefix; maxPendingBytes; ttlDays }
├── manifest.ts
├── collab-offline-idb.contribution.ts
├── idb-offline-store.ts         IdbOfflineStore implements OfflineStore：persistUpdate/loadPending/ack/clear；配额与 TTL 淘汰（淘汰策略有测试，A29）
├── adapter/                     y-indexeddb 封装或自写 IDB 事务适配（单点引入）
├── testing/index.ts             fake-indexeddb 环境助手
└── __tests__/                   刷新后恢复、配额淘汰、Unit 关闭后无残留连接（defineLifecycleSuite）
```

### 4.13 `@oce/engine-layout` — L5 · iso · plugin（含 `TextMeasurer` Definition）

```
packages/engine-layout/src/
├── index.ts
├── plugin.ts                  provide ['layout']；inject ['contributions']；Config { dpi: 96; fallbackFonts: string[] }
├── manifest.ts
├── layout.contribution.ts     Context.layout；贡献点 layout.measurer（TextMeasurer Provider，key = id）；Events layout/measurer-changed
├── text/
│   ├── measurer.ts            TextMeasurer Definition { id; measure(text, font: ResolvedFont) → { width: Px; ascent; descent }; supports(font) }；ResolvedFont { family; size: Pt; bold; italic }
│   ├── line-breaker.ts        UAX#14 子集 + CJK 规则；使用 shared/text 的 grapheme
│   ├── paragraph-layout.ts    layoutParagraph(paragraph: LayoutParagraphInput, width, measurer) → Line[]（Line { fragments: Fragment[]; ascent; descent; width }）；输入是**布局用的中性结构**（不是 model-slide 类型）
│   ├── body-layout.ts         layoutTextBody(input: LayoutBodyInput, box, measurer) → LayoutResult（锚点、插图、autofit 缩放、竖排、多列）
│   └── font-fallback.ts       主题字体占位（+mj-lt 等）→ 具体字体 → 主机可用性（measurer.supports）→ 通用族
├── geometry/
│   ├── preset-geometry.ts     presetPath(preset, adjustments, box) → GeometryPath[]（187 种 prstGeom）
│   ├── preset-table/          生成物：从 presetShapeDefinitions.xml 编译出的公式表（tooling/scripts/compile-preset-geometry）
│   ├── custom-geometry.ts     customPath(geometry, box)
│   ├── formula.ts             OOXML 几何公式求值器（+- */ ?: abs at2 cat2 cos max min mod pin sat2 sin sqrt tan val）
│   └── path.ts                GeometryPath { commands: (moveTo|lineTo|arcTo|quadTo|cubicTo|close)[]; fill; stroke; extrusionOk } → toSvgPath()
├── units.ts                   Emu ↔ Px（dpi）、Pt ↔ Px
├── services/layout.service.ts LayoutService（'layout'）：measurer()（当前 Provider，可切换）、layoutTextBody（带内容哈希缓存，淘汰策略有测试）、geometryPath
├── errors.ts
├── testing/index.ts           FixedMetricsMeasurer（每字符固定宽度，确定性快照）
└── __tests__/
```

`LayoutBodyInput` 是引擎的中性输入类型（字符串、字号、字体、缩进等），由 `slide-render` 从 `ResolvedRunProperties` 转换；引擎不 import `model-slide`（A4）。

### 4.14 `@oce/engine-render` — L5 · iso · definition（渲染契约与管线）

```
packages/engine-render/src/
├── index.ts
├── plugin.ts                     provide ['render']（UnitScope 内挂载）；inject ['layout','contributions']
├── manifest.ts
├── render.contribution.ts        Context.render；贡献点 render.target（RenderTarget Provider，key = id）、render.element（ElementRenderer，key = `${targetId}:${kind}`）、render.scene（SceneProvider，key = documentType）、render.overlay（覆盖层贡献，key = id）；Events（按 10 §11 定稿）render/first-paint(unitId, stats)、render/frame(unitId, stats)（进程内消费，公开订阅 ≥ 50 ms 合并；遥测事件 perf/frame 由其派生；render/painted 弃用）、render/element-failed(unitId, nodeId, kind, code)、render/element-degraded(unitId, nodeId, kind, reason)、render/font-fallback(unitId, requested, fallback, scope)
├── scene/
│   ├── scene.ts                  Scene { id; size: { w; h: Emu }; nodes: SceneNode[]; background?: SceneNode }；SceneNode { id: NodeId; kind: string; bbox: Rect(Emu); transform?: Transform; zIndex: number; children?: SceneNode[]; data: unknown（渲染器按 kind 解释）; revision: number }
│   ├── scene-provider.ts         SceneProvider Definition { documentType; build(unitScope, view: ViewDescriptor) → Scene; diff(changeSet, prev: Scene) → DirtySet }；ViewDescriptor { mode: 'edit' | 'master' | 'thumbnail' | 'present'; page?: NodeId; target?: NodeId（mode 'master' 时为版式/母版 id）; [k: string]: unknown（文档类型自定义字段，12 §2）}（ML-01 母版视图，04 §12.4）
│   └── dirty.ts                  DirtySet { nodeIds: Set<NodeId>; full: boolean; changed?: Map<NodeId, PathKey[]> }（changed 为可选的属性级精度，供渐进式局部更新；B 线 07 要求）；必须被 paint 消费（RecordingTarget 断言，A28）
├── target/
│   ├── render-target.ts          RenderTarget Definition { id; mount(container: unknown) → TargetHandle; paint(scene, dirty) ; hitTest(point) → HitResult | null; toImage?(scene, opts) → Promise<Blob | Uint8Array>; dispose() }
│   ├── element-renderer.ts       ElementRenderer<TData> { targetId; kind; render(node: SceneNode & { data: TData }, ctx: RenderContext) → ElementHandle; update(handle, node); dispose(handle) }；RenderContext { layout; resolveMedia(blobRef); onError }
│   └── overlay.ts                OverlayLayer 契约：selection box / handles / remote cursors 的绘制接口（由 target 实现，由 UI 驱动）
├── viewport/
│   ├── viewport.ts               Viewport { zoom; pan; page }；emuToPx/pxToEmu；fit 模式
│   └── virtualization.ts         可见页窗口（缩略图列表/连续滚动）
├── hit-test/hit-test.ts          HitResult { nodeId; region: 'body'|'handle'|'text'; local: Point }；bail 链：overlay → target
├── services/render.service.ts    RenderService（'render'，UnitScope）：attach(targetId, container) / detach / setView / invalidate(dirty) / requestPaint()（rAF 合并；Node 下微任务）/ hitTest / snapshotImage
├── scheduler.ts                  帧调度抽象（browser: requestAnimationFrame；node: setImmediate）—— 以 Definition 形式注入，保持 iso
├── errors.ts
├── testing/index.ts              RecordingTarget（记录 paint/dirty）、fakeScene()
└── __tests__/
```

为什么不像 Univer：Univer `engine-render` 66% 是三产品组件，`IRange` 进入通用契约（A1/A5）。这里契约只认 `kind: string` + 几何盒；元素渲染器是**查表**而非拦截链（A30）。机械验证：depcruise `engine-render` 禁 import 任何 `model-*`；api-extractor 基线中 `Scene*` 类型不得出现文档类型字段。

### 4.15 `@oce/render-dom` — L5 · dom · provider（implements `render.target:'dom'`、`layout.measurer:'canvas'`）

```
packages/render-dom/src/
├── index.ts
├── plugin.ts                  contribute render.target(domTarget)、layout.measurer(canvasMeasurer)；Config { svgPrecision: 2 }
├── manifest.ts
├── render-dom.contribution.ts
├── dom-target.ts              DomRenderTarget：容器管理、图层（background/content/overlay/ime）、CSS transform 缩放、ResizeObserver（effect 拥有）
├── layers/
│   ├── content-layer.ts       每页一个 <svg viewBox=EMU>；节点 <g data-oce-node=id>；paint server（defs：渐变/图案/裁剪）
│   ├── overlay-layer.ts       选择框、手柄、参考线、远端光标（HTML 绝对定位 + SVG）
│   └── ime-host.ts            隐藏 contenteditable 宿主：compositionstart/update/end → 输入事件对象（交给 ui-core 输入管线）
├── paint/
│   ├── painter.ts             paint(scene, dirty)：按 dirty 集增量更新；查表 contributions(render.element) by `dom:${kind}`；逐节点 try/catch → 占位渲染 + render/element-failed（A11、PRD OF-13）
│   └── reconcile.ts           键控 diff（z 序变化只移动节点）
├── measurer/canvas-measurer.ts OffscreenCanvas/Canvas 2D measureText；字体可用性检测（document.fonts）
├── hit-test.ts                elementFromPoint → data-oce-node；几何回退（旋转盒）
├── export/to-image.ts         SVG 序列化 → Image → Canvas → PNG/JPEG（客户端缩略图，M1/M2）
├── styles/layers.css          仅结构定位样式；不依赖 @oce/design
├── errors.ts
├── testing/index.ts           mountInHappyDom()
└── __tests__/                 happy-dom 单测 + browser mode（真实 measureText）
```

### 4.16 `@oce/slide-render` — V-render · dom · plugin

```
packages/slide-render/src/
├── index.ts
├── plugin.ts                  contribute render.scene(slideSceneProvider)、render.element × { dom } × { sp, pic, grpSp, cxnSp, graphicFrame:table, graphicFrame:chart, graphicFrame:ole, graphicFrame:diagram, unknown, background }
├── manifest.ts
├── slide-render.contribution.ts
├── scene/
│   ├── slide-scene-provider.ts build(unitScope, view)：读取 slides 服务 → 母版/版式/页三层合成 → SceneNode 树（data = 渲染所需的已解析样式 + 布局输入）
│   ├── compose.ts              合成规则：showMasterShapes、占位符 type/idx 匹配、背景来源（slide→layout→master）；mode 'master'：渲染目标版式/母版并叠加继承来源、占位符提示框（ML-01，04 §12.4）
│   ├── to-layout-input.ts      ResolvedRunProperties/Paragraph → engine-layout 的 LayoutBodyInput
│   └── dirty-mapping.ts        ChangeSet.touched → 受影响 SceneNode（shape 路径 → 节点；layout/master 变化 → 使用它的页全量）
├── elements/
│   ├── sp.ts                   几何 path（layout.geometryPath）+ fill/line/effect → <g><path/><text…/></g>
│   ├── text-body.ts            LayoutResult → SVG <text>/<tspan>（行、片段、bullet、下划线/删除线）
│   ├── pic.ts                  <image> + 裁剪 + 几何裁剪；媒体 blob URL 生命周期由 effect 拥有
│   ├── grp-sp.ts               子坐标系变换
│   ├── cxn-sp.ts
│   ├── table.ts                单元格网格、合并、样式（tableStyles 部件 M2 起解析）
│   ├── chart/                  图表渲染子插件（子路径 `@oce/slide-render/chart`，独立惰性 chunk ≤ 400 KB，PRD EM-07；M3 起拆为 `@oce/slide-render-chart`，见 §4.16b）
│   │   ├── plugin.ts           contribute render.element 'dom:graphicFrame:chart'；缺席时主包的 chart-placeholder 占位（可插拔证据，OF-09）
│   │   ├── read-model.ts       Chart.partRef → BlobStore 取 XML → ooxml-core/chartml.parseChartSpace → ChartReadModel（只读，按 partRef.hash 缓存）
│   │   ├── svg-chart.ts        ChartReadModel → SVG（自研或 Apache-2.0/MIT 图表库单点引入）；plot-bound/data-ink 诊断供视觉 oracle（借鉴 pptx-renderer）
│   │   └── placeholder.ts      渲染器未加载/解析失败时的占位框 + render/element-degraded{reason:'chart-unavailable'}
│   ├── chart-placeholder.ts    主包内的默认占位渲染器（render.element 'dom:graphicFrame:chart'，conflict 'replace' 由 chart 子插件覆盖）
│   ├── ole.ts / diagram.ts     预览图或回退形状
│   ├── unknown.ts              虚线占位 + 诊断（错误隔离的落点）
│   ├── background.ts
│   └── paint/fill.ts / line.ts / effect.ts   DrawingML → SVG paint server（linearGradient/radialGradient/pattern/filter）
├── thumbnail.ts               缩略图（view.mode='thumbnail' 的 Scene + target.toImage）
├── errors.ts
├── testing/index.ts           renderSlideToSvgString()（快照测试）
└── __tests__/                 视觉 oracle 夹具接入（11）；局部重绘断言（RecordingTarget）
```

### 4.16b `@oce/slide-render-chart` — V-render · dom · plugin（**M3 起**从 slide-render 拆出；总编排接受）

职责：可选、可替换的图表渲染插件；M1–M2 以 `@oce/slide-render/chart` 子路径存在（同一代码、同一惰性边界），M3 拆包时 preset 条目只改 import 路径。骨架（M3）：

```
packages/slide-render-chart/src/
├── index.ts / plugin.ts（contribute render.element 'dom:graphicFrame:chart'，覆盖 slide-render 的占位渲染器）/ manifest.ts / contribution.ts
├── read-model.ts                M1–M2 的 read-model.ts 迁入；M3 起优先读 model-slide 的可编辑 Chart.data，无则回退 partRef 只读解析
├── renderers/                   按图表类型拆分（bar/line/pie/…），可被第三方 render.element 覆盖
├── interaction/                 M3：点选系列/数据点（→ 属性面板编辑，ED-15）
├── testing/index.ts
└── __tests__/                   与 PowerPoint oracle 的 SSIM/IoU 用例（OF-09 口径）
```

`oce`：`{ layer: 'V-render', bundle: 'slide', iso: 'dom', role: 'plugin' }`；图表绘制第三方库（Apache-2.0/MIT）的单点引入位置随拆包迁移。

### 4.17 `@oce/design` — L7 · dom · library（对 SDK 零依赖；只交付主题变量 CSS，ADR-0017）

职责（章程 D10 修订、rulings §4.7）：设计 token 的**唯一事实源**与生成的主题变量 CSS。不再包含原子组件与图标：组件由 shadcn/ui 复制件（`ui-react/src/components/ui/`）承担，图标用 Lucide。`design` 与 `ui-react`/`*-ui` 之间的唯一契约 = CSS 变量名（shadcn 变量 + `--oce-*` 扩展）。运行时零依赖、零 JS 副作用（K7）。

```
packages/design/
├── package.json               exports：`.`（仅类型）、`./theme.css`、`./tailwind-theme.css`；`sideEffects: ["*.css"]`；`dependencies: {}`（R18 `design-css-only`）
├── theme.css                  生成物（入库便于 diff 评审）：`:root{…}`（light）、`[data-oce-theme="dark"], .dark{…}`、`[data-oce-theme="high-contrast"]{…}`、`[data-oce-density="compact"]{…}`；变量名 = shadcn 约定（--background/--foreground/--card/--popover/--primary/--secondary/--muted/--accent/--destructive/--border/--input/--ring/--chart-1..5/--sidebar-*/--radius）+ OCE 扩展 `--oce-*`；ui-react/*-ui/apps 唯一 import 的 design 产物
├── tailwind-theme.css         生成物：Tailwind 4 `@theme inline { --color-background: var(--background); … --color-oce-canvas: var(--oce-canvas-bg); --radius-lg: var(--radius); … }` 注册片段，使工具类指向主题变量；由 ui-react/*-ui 的样式入口 `@import`
├── src/
│   ├── index.ts               仅导出类型与常量：ThemeVarName（shadcn 变量 | `--oce-*` 字面量联合）、ThemeName（light|dark|high-contrast）、DensityName（comfortable|compact）；无运行时逻辑
│   ├── tokens/
│   │   ├── color.ts           语义色：shadcn 12+ 变量的三主题取值 + OCE 扩展（画布背景、参考线、选区框/手柄、协作者 8 色、状态色、降级占位）
│   │   ├── typography.ts      UI 字体栈（Geist Variable → 系统栈回退；画布内容字体不在此）、字号/行高梯度、密度对应的 UI 字号（最小 11px，rulings §4.6）
│   │   ├── spacing.ts / radius.ts / shadow.ts   间距梯度、圆角（`--radius` + 派生）、阴影层级
│   │   ├── z-index.ts         `--oce-z-*`：画布 < 覆盖层 < 面板 < 浮层（popover/menu）< 对话框 < 通知；集成方可整体平移（EM-06）
│   │   ├── motion.ts          时长/曲线；`prefers-reduced-motion` 下的取值
│   │   ├── density.ts         `comfortable`/`compact` 的控件高度、行高、内边距（属性 `data-oce-density`，rulings §4.3）
│   │   └── index.ts           TokenSet 类型与三主题对象
│   └── scripts/build-theme.ts 生成器：tokens → theme.css + tailwind-theme.css；`--check` 模式校验入库产物与 tokens 一致
├── testing/index.ts           解析 theme.css 变量表的测试助手
└── __tests__/                 token 快照；WCAG AA 对比度（三主题全部前景/背景配对）；`build-theme --check`
```

为什么不像 Univer：Univer 的 `design` 包正确地做到了对 SDK 零依赖（K7），但 token 只覆盖颜色；这里 token 覆盖颜色、间距、字号、圆角、阴影、层级、动效、密度，并且**组件不在 design 里**——组件是 ui-react 的 shadcn 复制件，design 因此可被未来的非 React 绑定复用。

### 4.18 `@oce/ui-core` — L7 · dom · plugin（框架无关的 UI 基座）

```
packages/ui-core/src/
├── index.ts
├── plugin.ts                  provide ['ui','shortcuts','theme']；inject ['commands','contributions','i18n','units']
├── manifest.ts
├── ui.contribution.ts         贡献点：ui.ribbon（tab/group/item）、ui.toolbar、ui.panel、ui.contextMenu、ui.shortcut、ui.command（呈现元数据）、ui.statusBar、ui.dialog、ui.notification、ui.theme（token 覆盖集，Beta）；id 一律 camelCase；Context.ui/shortcuts/theme；Events ui/panel-opened|closed、ui/context-key-changed
├── model/                     每个贡献点的类型 + schema：{ id; slot; order; when?: WhenClause; commandId?; component?: ComponentRef（泛型占位，由绑定层具体化）}
├── when-clause.ts             `when` 表达式（`unitType == 'slide' && selectionKind == 'shapes'`）解析与求值；上下文键反应式
├── context-keys.ts            ContextKeys 服务内部：set/get/observe；标准键 unitType、viewMode（受 documentType.viewModes 约束）、editTargetKind、selectionKind、selectionCount、canUndo、canRedo、isCollab、isReadOnly、platform、density（03 §3.6；扫描器 when-keys-declared）
├── operations.ts              水平层 Operation：view.setMode（{ unitId; mode }，mode ∈ documentType.viewModes；更新 viewMode 键、render.setView、emit view/mode-changed；文档类型盲）、ui.openPanel / closePanel / toggleRibbonTab（05 §13.3）
├── input/
│   ├── keyboard.ts            键位规范化（平台、chord）、匹配 → shortcuts
│   ├── pointer.ts             指针手势 → 命令/操作（拖动阈值、双击）；只产生**意图**对象
│   ├── clipboard.ts           复制/粘贴 MIME 协商（内部 JSON、image、text/html）
│   └── drag.ts                拖放（文件导入、缩略图排序）
├── services/
│   ├── ui.service.ts          UiService（'ui'）：contributions(slot, ctxKeys) 过滤排序；openPanel/closePanel/openDialog/notify（Operation 域，不入历史）
│   ├── shortcuts.service.ts   ShortcutsService（'shortcuts'）：bind(chord, commandId, when)、resolve(event)、conflicts() 诊断
│   └── theme.service.ts       ThemeService（'theme'）：set(theme, density)、observe()；把 theme/density 暴露为状态并写根元素属性 `data-oce-theme` / `data-oce-density`（ui-react 的 ThemeBridge 读取；多 host 各自作用域）；注入 `@oce/design/theme.css`（单一 <style>，按 host 去重）；读取 `ui.theme` 贡献的 token 覆盖集；**不** import React/Radix/Tailwind（R14）
├── errors.ts
├── testing/index.ts           fakeContextKeys()、dispatchKey()
└── __tests__/
```

为什么不像 Univer：Univer 移动端整包复刻（A7）；这里移动端只是一组 `ui.*` 贡献 + `when` 子句（`platform == 'mobile'`）。机械验证：depcruise `ui-core-no-react`（禁 import react）；`ui-core` 对 `@oce/design` 只允许 `.css` 与 type-only import（README C-6）。

### 4.19 `@oce/ui-react` — L7 · dom · provider（React 19 绑定；shadcn/ui 复制模式，ADR-0017）

职责：把 ui-core 的贡献渲染为 React 组件；持有全部 UI 组件依赖（shadcn 复制件 + Radix + Tailwind 4 + Lucide + Geist）。种子 = `docs/20-design/playground/`（Vite 8 + React 19 + TS strict，`components.json` style `radix-rhea`——2026-09-16 起，原 `radix-nova`，ADR-0017 修订）：M2 启动时其 `src/components/ui/*`、`lib/utils.ts`、`hooks/use-mobile.ts`、`index.css` 迁入本包，随后 playground 改为依赖 workspace 的 `@oce/ui-react`，保证**全仓只有一份复制件**（扫描器 `single-shadcn-copy`）。

```
packages/ui-react/
├── components.json              shadcn CLI 配置（入库）：style `radix-rhea`、rsc false、tsx、tailwind.css `src/styles/index.css`、baseColor neutral、cssVariables true、iconLibrary lucide、aliases `@/components` `@/components/ui` `@/lib` `@/hooks`；`npx shadcn add|diff` 以此运行
├── package.json                 exports：`.`（EditorHost、hooks、components/editor 组合、UiRenderer 插件）、`./ui`（shadcn 复制件桶文件；仅供 `*-ui` 与 `apps/*`，R17）、`./styles.css`（构建产物）、`./testing`；peer：react、react-dom；dependencies：radix-ui、class-variance-authority、clsx、tailwind-merge、lucide-react、tw-animate-css、cmdk、sonner、vaul、react-resizable-panels、@fontsource-variable/geist（全部为本包与 `*-ui` 的单点引入，R5）；devDependencies：tailwindcss、@tailwindcss/cli（库构建 → lib/styles.css）、@tailwindcss/vite（浏览器模式测试/styleguide）
└── src/
    ├── index.ts                 re-export：EditorHost、hooks、editor 组合、UiRendererPlugin
    ├── plugin.ts                provide ['uiRenderer']（ui-core 的 UiRenderer Definition 的 React Provider）；inject ['ui','shortcuts','theme','commands','i18n']
    ├── manifest.ts
    ├── ui-react.contribution.ts declare module '@oce/kernel'：ComponentRef 在 React 绑定下 = React.ComponentType<SlotProps>（A14：全泛型，无 any）
    ├── lib/utils.ts             `cn()`（clsx + tailwind-merge）—— shadcn 约定，复制件依赖
    ├── hooks/
    │   ├── use-mobile.ts        shadcn 复制件依赖
    │   └── use-service.ts / use-contributions.ts / use-command.ts / use-selection.ts / use-unit.ts / use-context-key.ts   订阅 Provider/贡献/上下文键变化（避免陈旧引用）
    ├── styles/
    │   ├── index.css            样式入口：`@import "tailwindcss";`（含 preflight，**全仓仅此一处**）`@import "tw-animate-css"; @import "@oce/design/theme.css"; @import "@oce/design/tailwind-theme.css";` + `@source "../"`；`@tailwindcss/cli` 构建为 lib/styles.css，apps 引 `@oce/ui-react/styles.css`
    │   └── canvas-isolation.css `.oce-canvas-host` 的隔离规则（画布内容层由 render-dom 的 layers.css 显式设定 svg/img/video 的 display/尺寸，不依赖 preflight；视觉 oracle 回归保证一致）
    ├── components/
    │   ├── ui/                  **shadcn/ui 复制件（radix-rhea）**：不手改结构，升级走 `npx shadcn diff` → add/合并；`index.ts` 桶文件 = `./ui` 子路径
    │   │   └── （已用 45 个组件族）accordion · alert · alert-dialog · avatar · badge · breadcrumb · button · button-group · card · checkbox · collapsible · command · context-menu · dialog · drawer · dropdown-menu · empty · field · hover-card · input · input-group · item · kbd · label · menubar · popover · progress · radio-group · resizable · scroll-area · select · separator · sheet · sidebar · skeleton · slider · sonner · spinner · switch · table · tabs · textarea · toggle · toggle-group · tooltip
    │   └── editor/              OCE 特有组合（只组合 `ui/*`，不重写原子；章程 D10）
    │       ├── EditorHost.tsx   <EditorHost host unitId layout?>：HostContext.Provider + 默认布局（Ribbon / ThumbnailRail|MasterThumbnails / SlideCanvas / Inspector / StatusBar / NotesBar；resizable 面板）
    │       ├── HostContext.ts   React Context 携带 cordis ctx（只读）
    │       ├── Ribbon/          三级 tab → group → control（`ui.ribbon` 贡献驱动，编码由 03 §3.6 在 M0 收尾定稿）；tabs + menubar + toggle-group + tooltip + dropdown-menu；`when` 过滤（viewMode 等）
    │       ├── ThumbnailRail/   缩略图栏：虚拟列表 + scroll-area + context-menu；拖拽排序 → slide.reorderSlides；节分组（M2）
    │       ├── MasterThumbnails/ 母版缩略图窗格（ML-01）：母版大缩略图 + 缩进版式缩略图（卡片、选中环与 ThumbnailRail 同款，不是文字树）；scroll-area + skeleton（加载态）+ context-menu；内容由 slide-ui 的 master-view 贡献填充
    │       ├── SlideCanvas/     画布宿主：把 render.target 'dom' 容器挂进 React 树，生命周期与 UnitScope 对齐；覆盖层槽位（`render.overlay`）
    │       ├── Inspector/       属性检查器骨架：tabs + field + input-group + slider + select + toggle；分组由 `ui.panel` 贡献填充，按 selectionKind/editTargetKind 切换
    │       ├── StatusBar/       `ui.statusBar` 贡献：缩放 slider、页码、协同状态、保存状态
    │       ├── NotesBar/        备注栏（可折叠；M1 只读，M3 编辑）
    │       ├── DesignBar/       设计页签/主题面板容器（ML-04；`ui.theme` 贡献 + `theme` 服务）
    │       ├── CommandPalette/  cmdk（`ui.command` 贡献 + `shortcuts`）
    │       ├── Dialogs/ Notifications/   dialog/alert-dialog/sheet/drawer 与 sonner；由 `ui.dialog`/`ui.notification` 贡献驱动；焦点管理与 live region（设计 07）
    │       └── presence/        协作者头像堆叠（avatar + tooltip；折叠规则见设计 05）、远端光标标签、跟随模式指示
    ├── bridge/contribution-renderer.tsx   贡献项 → 元素；每个贡献一个 React 错误边界（A11）
    ├── theme/ThemeBridge.tsx    读取 `theme` 服务，把 theme/density 写为根元素属性 `data-oce-theme` / `data-oce-density`（不使用 next-themes；多 host 各自作用域）
    ├── testing/index.ts         renderWithHost()；styleguide 路由（组件状态基准，Playwright + axe）
    └── __tests__/
```

### 4.20 `@oce/slide-ui` — V-ui · dom · plugin

```
packages/slide-ui/src/
├── index.ts
├── plugin.ts                   contribute ui.ribbon（插入/格式/排列/放映页签）、ui.panel（thumbnails、properties、notes）、ui.contextMenu、ui.shortcut（默认键位表）、ui.command（slide.* 命令的 title/icon/when）、i18n.bundle（slide, zh-CN/en-US）
├── manifest.ts
├── slide-ui.contribution.ts    I18nKeys 'slide.ui.*'
├── ribbon/insert-tab.tsx / format-tab.tsx / arrange-tab.tsx / present-tab.tsx / master-tab.tsx（`when: viewMode == 'master'`：插入占位符/版式、母版背景、主题颜色/字体、关闭母版视图；ML-01/03/04）
├── master-view/
│   ├── MasterThumbnails.tsx           母版缩略图窗格（母版大缩略图 + 缩进版式缩略图；拖拽排序 → slide.reorderLayouts、重命名、删除：被引用时确认对话框，确认后以同母版默认版式作为 reassignTo 在同一事务内删除〔rulings §4.10 Q11〕）；选择 → slide.selectMasterOrLayout
│   ├── PlaceholderPalette.tsx         占位符类型面板（→ slide.addPlaceholder）
│   └── ThemePanel.tsx                 主题颜色/字体方案编辑（→ slide.setThemeColors / setThemeFonts / applyTheme；ML-04）
├── panels/
│   ├── thumbnails/ThumbnailPanel.tsx  虚拟列表；拖拽排序 → slide.reorderSlides；缩略图来自 slide-render.thumbnail
│   ├── properties/PropertiesPanel.tsx 按 selectionKind 切换 inspector（shape/text/table/slide）
│   └── notes/NotesPanel.tsx           M2：只读展示 notes（opaque）；M3 编辑
├── canvas/
│   ├── selection-interaction.ts       指针意图 → 选择/移动/缩放/旋转命令；手柄绘制走 OverlayLayer
│   ├── text-editing.ts                进入/退出文本编辑态；IME 宿主事件 → text.applyDelta 命令
│   └── guides.ts                      智能参考线（派生数据，不入 Store）
├── presenter/PresenterMode.tsx        放映（全屏、翻页）；动画/切换 M1–M3 不播放
├── shortcuts.ts                       默认键位表
├── styles/index.css             `@import "tailwindcss/theme" layer(theme); @import "tailwindcss/utilities" layer(utilities); @import "@oce/design/tailwind-theme.css";`（**无 preflight**，preflight 只在 ui-react）+ `@source "../"`；`@tailwindcss/cli` 构建为 lib/styles.css；原子组件一律 `import … from '@oce/ui-react/ui'`（shadcn 复制件；R17）
├── locales/zh-CN.json / en-US.json
├── testing/index.ts
└── __tests__/
```

### 4.21 `@oce/preset-slide` — L8 · dom · bundle

```
packages/preset-slide/src/
├── index.ts                createSlidePreset(options?: SlidePresetOptions): Plugin
├── plugin.ts               函数插件：apply 内以**无序**方式 ctx.plugin 各子插件（依赖由 inject 反应式解决）；每个子插件用稳定 id 记录以便 fiber.update 局部重配置
├── manifest.ts             聚合清单（子插件 manifest 引用列表）
├── options.ts              SlidePresetOptions（zod）：{ locale; theme; storeProvider: 'memory'（固定）; renderTarget: 'dom'; permissions: 'allowAll' | PermissionPolicy[]; exclude?: PluginId[]; override?: Record<PluginId, Plugin> }
├── plugins.ts              显式列表：kernel 已在 host；model-core、store-memory、model-slide、ooxml-pptx、engine-layout、engine-render、render-dom、slide-render、design(css)、ui-core、ui-react、slide-ui、i18n、collab-core(local presence)
├── testing/index.ts        mountSlidePreset(host, opts)
└── __tests__/              「移除任一 Provider 仍可启动」矩阵：exclude 每个 provider 逐一测试 host 启动成功且 errors 无致命项（章程 §5.4、M1 验收）
```

`@oce/preset-slide-collab`：同结构；`plugins.ts` 用 `store-yjs` 替换 `store-memory`，追加 `collab-yjs`、`collab-transport-ws`（M4 P2 可选 `collab-offline-idb`），`presence` Provider 由 collab-yjs 提供；`options.ts` 增加 `{ endpoint; token }`（M3 验收：从 preset-slide 切到 collab 只改 preset）。

### 4.21b `@oce/preset-slide-viewer` — L8 · dom · bundle（只读查看器；总编排纳入章程包清单，PRD OF-14 / EM-07 ≤ 350 KB）

职责：仅含「打开 + 渲染」的 preset：无编辑 UI、无编辑命令、无 collab、无 React。用于文档预览、评论查看、嵌入形态 C。只读由两道机械保证（ADR-0015）：不加载 `@oce/model-slide/editing`（编辑命令与变更不存在 → `COMMAND_NOT_FOUND`）+ `readOnly` 权限策略（即使被 override 加载也 `PERMISSION_DENIED`）。

```
packages/preset-slide-viewer/src/
├── index.ts                createSlideViewerPreset(options?): Plugin
├── plugin.ts               无序挂载 plugins.ts 条目；PresetReport
├── manifest.ts             聚合清单
├── options.ts              ViewerPresetOptions（zod）：{ locale; theme; fit: 'contain'|'width'; showThumbnails: true; showNotes: true; lazy: { charts: true; locales: true }; exclude?; override? }
├── plugins.ts              条目：model-core、store-memory、model-slide（主入口，不含 editing）、ooxml-pptx、engine-layout、engine-render、render-dom、slide-render、i18n、design(css)、collab-core(local presence)、readOnlyPermissionPolicy；惰性：slide-render/chart（遇图表元素）、语言包（切换 locale）
├── policies/read-only.ts   core.permissionPolicy：仅 allow doc.read / doc.export（导出可关）；其余 deny
├── shell/                  极简框架无关查看器壳（≤ 15 KB，不依赖 ui-core/ui-react；PRD OF-14 的翻页/缩放/适应窗口/缩略图导航/备注查看/超链接点击）
│   ├── viewer-shell.ts     mount(container) → 页导航条、缩放控件、键盘（←/→/Home/End/+/-）、超链接点击 → view/page-changed
│   ├── thumbnail-strip.ts  使用 slide-render.thumbnail + 虚拟化（仅视口内 + 上下 10 项）
│   └── notes-pane.ts       显示 ooxml-pptx/import/notes-text.ts 提取的备注文本（只读）
├── styles/viewer.css       使用 @oce/design token 变量
├── testing/index.ts        mountViewerPreset()
└── __tests__/              readonly.test.ts（ADR-0015）；bundle-budget（≤ 350 KB gzip，不含图表块）；无编辑命令断言：contributions(core.command) 中不存在 documentType='slide' 的 command 类条目
```

`oce`：`{ layer: 'L8', iso: 'dom', role: 'bundle' }`。`apps/web` 的 `/documents/:id?mode=view` 路由使用它；`preset-slide` 的 `plugins.ts` 以「viewer 全部 + editing + ui-*」定义，保证两者不漂移（`preset-slide/__tests__/superset.test.ts` 断言 preset-slide ⊇ preset-slide-viewer 的条目集合，减去 `shell/` 与 `readOnly` 策略）。

### 4.22 `@oce/server-collab` — LS · node · library（与 Nest 解耦）

```
packages/server-collab/src/
├── index.ts
├── room/room.ts / room-manager.ts      房间生命周期、成员、权限快照
├── protocol/frames.ts                  帧编解码（protocol.ws）+ y-protocols 服务端步骤
├── persistence/update-log.ts           CRDT update 追加写（接口）+ 周期压缩为快照（策略）
├── awareness/broadcast.ts              awareness 广播；Redis pub/sub 抽象（接口）
├── permission/checkpoint.ts            join/update 时的权限检查（fail-closed）；权限变更推送
├── testing/index.ts
└── __tests__/                          多实例一致性模拟（08/06）
```

### 4.23 `@oce/server-storage` — LS · node · provider（BlobStore）

```
packages/server-storage/src/
├── index.ts
├── blob-store.ts             BlobStore Definition 的服务端形态（与 model-core.BlobStore 同接口 + 预签名 URL）
├── providers/s3.ts / minio.ts（S3 兼容配置）/ local-fs.ts
├── content-addressing.ts     sha256 命名、去重
├── testing/index.ts          MemoryBlobStore（与 model-core 一致）
└── __tests__/
```

### 4.24 `@oce/server-headless` — LS · node · plugin/host

```
packages/server-headless/src/
├── index.ts
├── host.ts                   createHeadlessHost(options)：createHost + 挂载 iso 插件集（model-core、store-memory、model-slide、ooxml-core 无插件、ooxml-pptx、engine-layout + node 度量器）；无 UI、无 dom
├── loader.ts                 可选：@cordisjs/plugin-loader 驱动（ADR-0010，默认关闭）
├── measurer/font-measurer.ts Node 字体度量（opentype 解析；字体目录配置）—— layout.measurer Provider 'node-font'
├── tasks/
│   ├── import.ts             bytes → SnapshotBundle（写 blob）
│   ├── export.ts             SnapshotBundle/Y.Doc 状态 → bytes
│   ├── validate.ts           打开 + 快照校验 + 诊断
│   ├── migrate.ts            批量迁移快照
│   └── thumbnail.ts          M3：headless Chromium（playwright-core）渲染 render-dom 输出
├── worker.ts                 worker_threads 任务运行器（超时/内存限额；每任务新 host）
├── testing/index.ts
└── __tests__/                iso 插件在 Node 下打开 fixtures 全部语料（同构冒烟的强化版）
```

---

## 5. `tooling/`

一行说明；详细规格由 09 承接。

```
tooling/
├── tsconfig/              base.json（最严格集 + isolatedDeclarations + verbatimModuleSyntax）、iso.json（lib: ES2023，无 dom，无 @types/node）、dom.json、node.json、test.json → 09-01
├── eslint-config/         flat config 预设（typescript-eslint strict-type-checked）+ 自定义规则包 `@oce-tooling/eslint-plugin`：no-register-methods、no-module-level-mutable-state、no-bare-throw、no-doc-type-literals、contribution-file-purity、no-unit-scoped-inject-at-root、no-mixin-outside-kernel、no-boolean-command-result、no-enum-in-protocol、effect-owned-timers、events-declared → 09-02
├── depcruise/             规则生成器：读取各包 package.json#oce → 生成 .dependency-cruiser 规则（层带允许矩阵、三角色、单点引入、同构、no-testing-in-prod、no-orphans）→ 09-03
├── api-extractor/         base.json；报告目录约定 → 09-04
├── manifest-gen/          ts-morph 静态分析 → src/manifest.ts + oce-manifest.json；--check 模式 → ADR-0003、09-06
├── scanners/              预算与一致性扫描：type-budget（any/as/!/@ts-*）、exports-explicit、peer-policy、schema-lock、i18n-keys-sync、config-fields-read（Config 字段必须有读取点，A26）、deprecated-expiry（A22）→ 09-06
├── policy-check/          读取 docs/30-architecture/09-type-discipline/08-policy-enforcement-matrix.md → 校验每条规范的执行机制存在（lint 规则启用 / depcruise 规则存在 / CI job 在 PR 触发）→ 09-07
├── iso-smoke/             对每个 oce.iso=iso 的包执行 `node --import <pkg>` 与 `--conditions` 冒烟（A20）→ 09-03
├── scripts/
│   ├── create-package.ts  从 §4.0 模板生成新包（写入 oce 字段、tsconfig references、changeset）
│   ├── sync-references.ts tsconfig references ↔ package.json 依赖一致性
│   ├── compile-preset-geometry.ts  presetShapeDefinitions.xml → engine-layout/geometry/preset-table
│   └── compile-schema-order.ts     XSD → ooxml-core/preserve/schema-order
└── changeset-config/      fixed 组生成（读取 oce.layer ∈ {L0, L1} 的包）
```

---

## 6. `fixtures/`

```
fixtures/
├── README.md              语料分级与来源许可；如何新增
├── pptx/
│   ├── minimal/           最小合法文件（空白页、单文本框）—— M1 全 verbatim 往返
│   ├── features/          按特性一文件：占位符继承、分组、表格、图表、SmartArt、媒体、Strict 命名空间、宏（.pptm）、备注、评论
│   └── wild/              真实世界文件（脱敏，LFS）
├── snapshots/             各 documentType 各 schemaVersion 的快照样本（迁移测试语料，ADR-0009）
└── oracle/                PowerPoint 导出的 PNG/PDF 基准（11）
```

---

## 7. 依赖规则（章程 §5.3 的 dependency-cruiser 语义描述）

每条规则 severity 一律 `error`（A16）。具体配置由 09-03 承接；规则**必须配负向测试**（故意违规样例）才允许进入配置（A17）。

| # | 规则名 | from | to | 语义 |
|---|---|---|---|---|
| R1 | `no-circular` | 任意 | 任意 | 包级与文件级无环 |
| R2 | `layer-rank` | 包（读 `oce.layer`） | 包 | **秩表比较**（总编排裁决，§1）：`rank(to) ≤ rank(from)`，其中 L0=0、L1=10、V-model=15、L3=30、V-codec=35、L4=40、L5=50、V-render=55、LS=58、L7=70、V-ui=75、L8=80。与本文旧「允许矩阵」语义等价：V-model → ≤L1；V-codec → ≤L3 + 同束 V-model；V-render → ≤L5 + 同束 ≤V-codec；V-ui → ≤L7 + 同束 ≤V-render；LS → ≤L5（且经 R16 只达 iso 包：engine-layout/engine-render 可、render-dom 不可）；L8 → 任意；apps 见 R9 |
| R3 | `doc-type-blind` | 无 `oce.bundle` 的包 | 有 `oce.bundle` 的包 | 禁止（水平层不得 import 垂直束；秩表允许但本规则否决，如 L3→V-model） |
| R4 | `bundle-isolation` | `oce.bundle == X` | `oce.bundle == Y ≠ X` | 禁止（束与束互不依赖） |
| R5 | `third-party-single-entry` | 任意 | `cordis`/`yjs`/`y-protocols`/`y-indexeddb`/`react`/`radix-ui`/`class-variance-authority`/`clsx`/`tailwind-merge`/`lucide-react`/`tailwindcss`/`@tailwindcss/*`/`tw-animate-css`/`cmdk`/`sonner`/`vaul`/`react-resizable-panels`/`@fontsource-variable/geist`/`@nestjs/*`/`fflate`/`zod` | 仅允许清单内的包 import（§4.0.1 表；UI 组件依赖仅 ui-react 与 `*-ui`，ADR-0017） |
| R6 | `iso-no-dom-no-node` | `oce.iso == 'iso'` | `node:*`、`dom` 全局 | 禁止（配合 tsconfig lib 与 `no-restricted-globals`） |
| R7 | `three-roles` | `oce.role == 'provider'` | 另一 `provider`（同 `implements`） | 禁止 Provider 互相 import；`consumer` 只可 import `definition`（读 `implements` 与 `provide`） |
| R8 | `no-deep-import` | 任意 | `@oce/*/src/*`、`@oce/*/lib/*` | 禁止；只能 `@oce/x` 与 `@oce/x/testing` |
| R9 | `apps-only-assemble` | `apps/web` / `apps/server` | 见 §3 | apps 只 import preset/server-*/protocol/ui-react(EditorHost)/design |
| R10 | `no-testing-in-prod` | `src/**`（非 `testing/`、非 `__tests__/`） | `@oce/*/testing` | 禁止 |
| R11 | `shared-has-no-deps` | `@oce/shared` | 任意外部/内部包 | 禁止 |
| R12 | `only-kernel-imports-cordis` | 非 kernel | `cordis`、`@cordisjs/*` | 禁止（server-headless 的 loader 例外：`@cordisjs/plugin-loader` 允许，ADR-0010） |
| R13 | `no-orphans` / `not-in-pkg` | 任意 | 任意 | 无孤儿文件；import 的包必须在自身 package.json 依赖中（K9） |
| R14 | `ui-core-no-framework` | `@oce/ui-core` | `react`、`vue`、`radix-ui`、`tailwindcss`、`lucide-react`、`@oce/design`（运行时 TS） | 禁止（`.css` 与 type-only 允许）；ui-core 只定义贡献点/输入管线/`UiRenderer` Definition |
| R15 | `engine-no-model` | `@oce/engine-*`、`@oce/render-dom` | `@oce/model-*` | 禁止（A4/A5） |
| R16 | `iso-class-matrix` | 包（读 `oce.iso`） | 包（读 `oce.iso`） | `node` 不得 import `dom`；`iso` 只能 import `iso`；`dom` 可 import `iso`/`dom`；`node` 可 import `iso`/`node`（配合 R6 的 API 级禁令） |
| R17 | `shadcn-ui-dir-private` | 除 `@oce/ui-react`、`oce.layer == 'V-ui'` 的包（`*-ui`）与 `apps/*` 之外的任何包 | `@oce/ui-react/ui` 子路径、`packages/ui-react/src/components/ui/**` | 禁止（shadcn 复制件只供 UI 绑定层、垂直束 UI 与应用壳使用；水平层/模型/渲染包不得依赖 UI 原子）；配套扫描器 `shadcn-components-sync`（`components.json` ↔ 文件 ↔ 桶文件一致）、`single-shadcn-copy`（全仓仅一份复制件）（ADR-0017） |
| R18 | `design-css-only` | `@oce/design` | 任意运行时依赖（含 react/radix-ui/tailwindcss） | 禁止：`dependencies` 为空、`src/**` 无运行时 import、`exports` 只含类型入口与 `.css`；配套扫描器 `theme-vars-contract`（ui-react/`*-ui`/apps 使用的 `--oce-*` 与 `@theme inline` 名必须在 `theme.css` 声明）（K7、ADR-0017） |

配套 lint（非依赖图的边界，见 09-02）：`no-unit-scoped-inject-at-root`（根级插件不得 `inject: ['store'|'history'|'selection'|'render'|'presence']`）、`no-doc-type-literals`、`contribution-file-purity`。

---

## 8. 骨架创建顺序（M0 后半段的操作清单）

1. 根文件 + `tooling/tsconfig`、`tooling/eslint-config`、`tooling/depcruise`、`lefthook.yml`、`ci.yml`（先有门禁，再有代码，章程 M0 验收）。
2. `tooling/scripts/create-package` 生成全部包骨架（仅 `index.ts`/`plugin.ts` 占位/`manifest.ts` 生成/`__tests__/lifecycle.test.ts`），使 `pnpm check` 全绿。
3. 写 `shared` → `kernel`（03）→ `protocol` → `model-core`（04/05）→ `store-memory` → `model-slide` → `ooxml-core` → `ooxml-pptx`（M1 路径）。
4. `engine-layout` → `engine-render` → `render-dom` → `slide-render`（含 `chart/` 惰性块）→ `preset-slide-viewer`（M1 查看器，OF-14）→ `apps/web` 最小壳；M2 起 `model-slide/editing` → `ui-core` → `ui-react` → `slide-ui` → `preset-slide`。

---

## 9. 本文对章程的追加建议（汇总到 README §5）

- **C-10**：`@oce/ooxml-core` 依赖上限由「shared」改为「shared, model-core」，理由见 §4.9 注（DrawingML 运行时类型放在 `model-core/src/drawing/`，避免 `model-slide` 向上依赖 L3）。相应地 `model-core` 新增目录 `src/drawing/`（Color/Fill/Line/Effect/Geometry/Transform/Font/TextBody 词汇的运行时类型与 schema；无 XML、无文档类型知识；文件与 §4.8 `model/drawing/` 同名，§4.8 中 `model/drawing/*` 改为 re-export + slide 特有扩展）。
