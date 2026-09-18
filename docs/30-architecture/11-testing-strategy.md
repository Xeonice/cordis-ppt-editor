> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-14 | 依赖：charter v0.1

# 11 测试策略（Testing Strategy）：金字塔、conformance kit、iso 冒烟、生命周期、OOXML round-trip、视觉 oracle、协同模拟、e2e、性能门禁、语料库

> 读者：搭建测试基础设施的工程师；每个包的实现者（知道自己必须交付哪些测试）；CI 维护者。
> 章程锚点：D9（Vitest/Playwright）、§5.3 规则 5（`node --import` 冒烟）、§7（M1 部件级 diff 零差异；M3 store 替换仅改 preset）、Univer A17（规则须有负向测试）、A19（patch 覆盖率）、A20（同构零测试）、A25（卸载断言）、K5。
> 借鉴：pptx-renderer 的「PowerPoint 真机导出为 oracle 的视觉回归（SSIM/IoU）+ 语料库元数据入库、二进制不入库」。
> lint/CI 工作流细节由 09-07 承接；本文定义**测什么、用什么、放在哪、门禁阈值**。

---

## 0. 金字塔与门禁一览

```
                       ┌──────────────┐  e2e（Playwright，apps/web+apps/server）        PR：冒烟子集；main：全量   ── 慢
                       │  e2e / 性能   │  性能基准（budgets.json，回归 >10% 失败）
                    ┌──┴──────────────┴──┐
                    │ 视觉 oracle · 协同模拟 │  SSIM/IoU 对 PowerPoint 基线；多客户端 fuzz 收敛      PR：门禁类别；nightly：全量
                 ┌──┴─────────────────────┴──┐
                 │ 集成：round-trip · 服务端集成 │  语料库部件级 diff 零差异；testcontainers（PG/Redis/MinIO）   PR
              ┌──┴───────────────────────────┴──┐
              │ 契约：conformance kit · 生命周期   │  每个 Definition 一套 kit，所有 Provider 必过；load/unload/PENDING/替换  PR
           ┌──┴─────────────────────────────────┴──┐
           │ 单测 · 类型测试 · iso 冒烟                │  Vitest；expectTypeOf；node --import 每个 iso 包                     PR，每包
           └──────────────────────────────────────────┘
```

| 门禁 | 阈值 | 失败即阻断？ |
|---|---|---|
| 单测/契约/生命周期 | 全绿 | 是 |
| patch 覆盖率（改动行） | 行 ≥ 80%，分支 ≥ 70%；总覆盖率**不下降** | 是（A19） |
| 类型测试 | 全绿 | 是 |
| iso 冒烟 | 每个 iso 包在 Node 与浏览器均可 import | 是（A20） |
| round-trip | 语料库「gated」样本部件级 diff 零差异 | 是（M1 起） |
| 视觉 oracle | `capabilities.json` 标记 gated 的类别：SSIM ≥ 阈值且 IoU ≥ 阈值 | 是；非 gated 仅报告趋势 |
| 协同模拟 | 固定种子集全部收敛 + 随机 200 轮无失败 | 是 |
| e2e 冒烟 | 全绿 | 是 |
| 性能 | 绝对预算 + 相对回归 ≤ 10%（5 次取中位数） | 是（main 分支）；PR 上仅告警 |
| 规则负向测试 | 每条自定义 lint/扫描规则有 fixture 触发失败 | 是（A17，由 09 执行） |

---

## 1. 单元测试（Vitest）

- 位置：`packages/<pkg>/src/**/__tests__/*.test.ts`（与源码同树），文件名与被测模块同名。
- 环境：iso 包默认 `environment: 'node'`（**不**用 jsdom，避免掩盖 DOM 依赖）；dom 包默认 `happy-dom`（纯逻辑、DOM 结构、属性 diff；A 线 C-8 定稿），凡涉及 `measureText`/`getBBox`/字体加载/IME 事件/滚动与 IntersectionObserver 的用例必须走 `vitest browser mode`（Chromium，真实 DOM/字体/Canvas）——文件名后缀 `.browser.test.ts` 由共享配置自动路由；jsdom 一律不用。
- 共享配置：`tooling/vitest-config`（coverage provider v8、reporters、`test.typecheck`）。
- 约定：不 mock 内核；用 `@oce/kernel/testing` 的 `createTestHost()` 启动真实 cordis 宿主（快，< 5 ms）；只 mock IO（transport、storage、fetch）。
- 确定性：所有涉及 id/时钟/随机的测试通过 `testing` 子路径注入 `FixedClock`、`SeededRandom`、固定 Yjs `clientID`。

## 2. 类型测试

- `*.test-d.ts` 与 vitest `expectTypeOf`（或 `expect-type`）；`vitest --typecheck` 作为独立 job。
- 必测清单：品牌类型不可互赋（`Emu` ≠ `Pt`）；Mutation schema **无** `index` 字段（06 I4）；`EntityTable` 值不为数组；`ErrorCodes` 未登记码编译失败；事件参数类型与 `Events` 声明一致；`ElementRenderer<T>` 泛型推断；Config `z.infer` 与插件签名一致；`protocol` DTO 无 `any`。
- 负向类型测试：`// @ts-expect-error` 用例必须存在于每个 Definition 的 `contracts/*.test-d.ts`。

## 3. Definition 的 Provider 一致性套件（conformance kit）

规则：**每个 Definition 在 `@oce/<pkg>/testing` 子路径导出 `runXxxConformance(factory, options)`；每个 Provider 的 `__tests__/conformance.test.ts` 必须调用它。** 扫描器（09-06）核对：凡 `provide=['x']` 的插件，其包内必有对该 Definition kit 的调用。

| Definition（所在包） | kit | 覆盖 |
|---|---|---|
| `DocumentStore`（model-core） | `runDocumentStoreConformance` | 6 原语读写、事务原子性、observe 路径精确性、undo/redo 按 origin、stablePosition 在并发插入后稳定、snapshot 幂等、无下标 API |
| `CollabService`/`Transport`/`Presence`（collab-core） | `runCollabConformance` | join→synced、断线重连、离线队列、降权拒写、房间满、schema 过新、awareness 超时 |
| `RenderTarget`/`ElementRenderer`（engine-render） | `runRenderTargetConformance`、`runElementRendererConformance` | 挂载/更新/卸载、脏路径只影响自身、错误隔离、hitTest 一致 |
| `Measurer`（engine-layout） | `runMeasurerConformance` | 单调性、缓存一致、空串、CJK |
| `BlobStorage`（server-storage） | `runBlobStorageConformance` | put/get/head/delete、预签名、完整性 |
| `UpdateStore`/`SnapshotStore`/`FanoutBus`/`LeaseLock`（server-collab） | `runServerCollabAdaptersConformance` | 顺序、幂等、租约过期、去重 |
| `FormatCodec`（model-core，A 线） | `runFormatCodecConformance` | 引用 A 线；round-trip 见 §6 |
| kernel 基础服务 `errors/logger/telemetry` | `runKernelServiceConformance` | no-op 降级、脱敏、登记校验 |

kit 设计约束：只依赖 Definition 与 `testing` fakes；参数 `factory()` 返回 `{ ctx, provider, dispose }`；每个用例后断言 `assertNoLiveEffects`。

## 4. 插件生命周期测试（每个 `plugin.ts` 必配 `__tests__/lifecycle.test.ts`）

模板（`@oce/kernel/testing` 提供 `describePluginLifecycle(plugin, { config, deps })`）：
1. **load**：在提供全部 `inject` 的宿主里加载 → `ACTIVE`；`provide` 的服务可解析。
2. **PENDING**：缺任一 `inject` → 状态 `PENDING`（不是错误、不抛）；补齐后自动 `ACTIVE`。
3. **unload**：`fiber.dispose()` 后 `getEffects()` 为空；提供的服务不可解析；贡献从 `ctx.contributions` 消失。
4. **Provider 替换**：替换某个依赖的 Provider → 本插件重跑（消费者不缓存旧引用；用 spy 断言重新初始化）。
5. **无重复注册**：`restart()` 两次后事件监听/贡献数量不变（A10、cordis 指南 §108）。
6. **多实例**：同一插件在两个 UnitScope 各加载一次，互不可见、互不干扰。
7. **配置校验**：非法 Config → `ValidationError`，不部分激活。

## 5. 同构冒烟（iso）

- `test/iso-smoke/node.mjs`：对每个 `isomorphism: 'iso'` 的包执行 `node --import ./register.mjs -e "import('@oce/<pkg>')"`，并调用 `plugin` 在最小宿主中加载一次（不只 import）。
- 浏览器侧：vitest browser mode 中 `import('@oce/<pkg>')` 并加载；两者都在 CI 矩阵中。
- 附加断言：iso 包的构建产物不含 `document`/`window`/`node:` 字面引用（扫描器）；tsconfig 无 `dom` lib（09-01）。

## 6. OOXML 语料库 round-trip（M1 验收）

- 流程：`pptx → ooxml-pptx.decode → Snapshot → store(memory 与 yjs 各一次) → ooxml-pptx.encode → pptx'`；`diffPackage(pptx, pptx')`（`@oce/ooxml-core/testing`）按部件比较：
  - 未修改部件：字节相同（或经**登记的规范化**后 XML 相同：属性顺序、空白、命名空间前缀、Strict→Transitional 归一化——规范化规则列于 `test/corpus/normalizers.md`，每条有测试）。
  - `[Content_Types].xml`/`.rels`：语义等价（集合比较）。
  - 允许差异必须在样本 `manifest.json` 的 `expect.allowedDiffs` 中显式登记，否则失败。
- 变更后导出：对 gated 样本执行「修改一个文本 → 导出」并断言**只有**相关部件变化（脏部件追踪，D7）。
- 双 store 一致：memory 与 yjs 路径产出的 `pptx'` 部件级相同（M3 证据）。

## 7. 视觉 oracle（借鉴 pptx-renderer）

- 基线：PowerPoint（Windows 365 与 macOS 各一 profile）导出 PNG @1920×1080；记录 `{ pptx sha256, png sha256, ppVersion, os, fontProfile }` 于 `test/oracle/baselines.json`；PNG 二进制在 Git LFS（小）或对象存储（大，按 sha256 拉取）。
- 被测输出：(a) 客户端 render-dom 在 Playwright Chromium 截图；(b) server-headless 缩略图路径；两者互相也要一致（像素差 ≤ 0.5%）。
- 度量：`ssim.js`（SSIM）、元素包围盒 IoU（从 DOM 读取几何 vs 基线的人工/半自动标注框）、颜色直方图距离、可选 `pixelmatch` 差异图；阈值按类别：

| 类别 | SSIM | IoU | 说明 |
|---|---|---|---|
| 几何/填充/线（无文本） | ≥ 0.97 | ≥ 0.95 | gated（M1） |
| 文本（西文） | ≥ 0.93 | ≥ 0.90 | gated（M1，字体 profile 固定） |
| 文本（CJK/混排） | ≥ 0.90 | ≥ 0.88 | gated（M2） |
| 表格 | ≥ 0.92 | ≥ 0.90 | gated（M2） |
| 图片/裁切 | ≥ 0.95 | ≥ 0.95 | gated |
| 图表/SmartArt/效果/3D | 仅报告 | 仅报告 | 非 gated（Q7） |

- `test/oracle/capabilities.json` 声明每个样本/类别是否 gated；报告为 HTML（并排 + 差异图 + 分数），作为 CI artifact。
- 字体 profile：CI 容器安装 `corpus-fonts-v1`（Noto/Liberation/Carlito/Caladea + 语料库嵌入字体）；基线与被测使用同一 profile，否则度量无效。

## 8. 协同模拟（fuzz）

- `test/collab-sim/`：`createCollabCluster(n ∈ [2,5])`（内存服务端 + 客户端，来自 `@oce/collab-yjs/testing`）+ `NetworkModel{ delay: U(0,200ms), reorder, drop 5%, partition 10% 时长 ≤ 2 s, offlineBursts }` + 随机操作生成器（来自 `@oce/model-slide/testing` 的 `randomCommand(seed)`：增删移页、增删移改形状、进出组、富文本插删格式分段合段、换版式）。
- 每轮 1,000 操作，静止后断言：
  1. 所有客户端与服务端 `encodeStateAsUpdateV2` 相等（或 JSON snapshot 相等）；
  2. schema 校验通过、不变量成立（无环、无孤儿、order 合法、id 唯一）；
  3. 每客户端撤销 k 步不抛错且不变量仍成立；
  4. 服务端软门禁若触发修复，所有端一致（注入 5% 非法 update 的变体）；
  5. 降权路径：被拒 update 不出现在任何其他端。
- 失败处理：记录种子；自动最小化（删操作二分）生成 `test/collab-sim/repros/<seed>.json`，作为确定性回归用例入库。
- PR：固定种子集 50 个 + 随机 200 轮（≈ 2 min）；nightly：10,000 轮。

## 9. 性能基准与预算门禁

- `test/perf/budgets.json`：07 §9、06 §14、08 §12 的数字（单一事实源；文档引用它）。
- 场景：`open-30p`、`open-200p`、`type-latency`、`drag-fps`、`zoom-fps`、`layout-switch`、`collab-roundtrip-2clients`、`bootstrap-200p`、`server-update-p95`（k6 或自写压测对 server-collab）。
- 运行：Playwright trace + `performance.mark` 由 telemetry Provider 在测试模式下写入；5 次取中位数；专用 runner（GitHub larger runner 或自托管）以控噪声。
- 门禁：绝对预算超出 → 失败；相对上一 main 基线回归 > 10% → 失败（main）/告警（PR）。结果存 `perf-history/`（分支，长期趋势）。

## 10. e2e（Playwright）

- `test/e2e/`：启动 `apps/server`（testcontainers：PG/Redis/MinIO + mock OIDC `oidc-provider`）与 `apps/web` 预览构建。
- 用例族：打开与渲染、编辑与撤销、导出下载与 round-trip 校验、双浏览器协同（presence 可见、编辑传播、断网重连、降权横幅）、离线编辑恢复、评论、版本恢复、插件启停（示例插件的 ribbon 按钮出现/消失、卸载后无残留 DOM）。
- 页面对象放 `page-objects/`；选择器只用 `data-testid`（由 ui 包保证，不依赖文案）。
- 内存预算：e2e 结尾用 CDP `HeapProfiler.collectGarbage` + `Runtime.getHeapUsage` 断言 07 §9 的堆预算与「打开/关闭 20 次不增长 > 10%」（A25 的 e2e 版）。

## 11. 语料库来源与管理

| 来源 | 说明 | 许可 |
|---|---|---|
| 自建（PowerPoint 365 Win/mac） | 每个特性一个最小 deck（几何、填充、文本、表格、组合、占位符继承、Strict 模式、嵌入字体、媒体） | 自有 |
| 合成（python-pptx 生成器） | `test/corpus/generators/`：参数化批量样本（借鉴 pptx-renderer `generate_pypptx_cases.py`） | 自有 |
| 其他产出方 | Keynote/Google Slides/LibreOffice/WPS 导出的同一内容 deck（产出方差异） | 自有 |
| 公共领域/CC0 | 少量真实世界 deck | 需登记 |
| 用户报告 | 复现用样本经脱敏与授权后加入 | 授权 |

管理：`test/corpus/manifest.json` 每条 `{ id, path|sha256, source, license, generator?, features[], sizeBytes, gated: boolean, expect: { roundtrip: 'exact'|'normalized', allowedDiffs[] }, oracle?: { baselineId } }`；> 2 MB 的文件不入 git（LFS 或对象存储，按 sha256 校验）。新增特性支持 → 先加样本再实现（测试先行）。

## 12. 测试目录级布局

```
repo/
├── packages/<pkg>/
│   ├── src/**/__tests__/*.test.ts            单测/契约调用/生命周期（每个 plugin.ts 必配 lifecycle.test.ts）
│   ├── src/**/*.test-d.ts                    类型测试
│   ├── testing/                              `@oce/<pkg>/testing`：conformance kit、fakes、fixtures、确定性工具（不得被 src 引用：depcruise）
│   └── vitest.config.ts                      继承 tooling/vitest-config（node 或 browser 环境）
├── test/                                      根级 workspace 包 `@oce-internal/test-suite`（不发布）
│   ├── corpus/
│   │   ├── manifest.json                     样本清单（见 §11）
│   │   ├── decks/**.pptx                     小样本；大样本 LFS/对象存储
│   │   ├── generators/{gen_cases.py, requirements.txt, README.md}
│   │   └── normalizers.md                    允许的规范化差异（每条有测试）
│   ├── roundtrip/{runner.test.ts, diff-report.ts}
│   ├── oracle/
│   │   ├── baselines.json · baselines/**.png（LFS）
│   │   ├── capabilities.json · thresholds.json
│   │   ├── runner/{render-client.ts, render-server.ts, metrics.ts（ssim/iou/histogram）, report.ts}
│   │   └── fonts/corpus-fonts-v1.lock        字体 profile 清单（sha256）
│   ├── collab-sim/{cluster.ts, network-model.ts, op-generator.ts, invariants.ts, minimize.ts, seeds.json, repros/*.json, sim.test.ts}
│   ├── e2e/{playwright.config.ts, fixtures/, page-objects/, specs/**.spec.ts, mock-oidc/}
│   ├── perf/{budgets.json, scenarios/*.ts, runner.ts, compare.ts, README.md}
│   ├── iso-smoke/{node.mjs, browser.test.ts, register.mjs}
│   ├── server-integration/{testcontainers.ts, collab-cluster.test.ts（两实例扇出/崩溃恢复/drain）, import-export.test.ts}
│   └── plugin-compat/                        M4：外部插件兼容套件（manifest 校验、生命周期、版本协商）
├── tooling/vitest-config/                    共享配置、coverage 阈值、reporters
└── .github/workflows/                        由 09-07 承接（job 矩阵：unit · types · iso · contract · roundtrip · oracle · collab-sim · e2e · perf）
```

## 13. 与 Univer 的对照

| 编号 | Univer | 本项目 |
|---|---|---|
| A17 | lint 规则实现是 no-op | 每条自定义规则/扫描器必须有负向 fixture（09 执行）；每个 conformance kit 必须有一个「故意错误的 Provider」用例证明 kit 能失败 |
| A19 | `patch: off` | patch 覆盖率门禁 |
| A20 | 0 个 node 测试 | iso 冒烟双环境 + browser mode 真 DOM |
| A25 | 无 dispose 门禁 | lifecycle 模板 + e2e 内存增长断言 |
| A28/A29 | 脏区/缓存无人读 | 反制单测在 engine-render（07 §2.2） |
| K5 | Disposable 纪律靠人 | `assertNoLiveEffects` 在 kit 与 lifecycle 模板中自动执行 |

## 14. 待决事项

| # | 事项 | 默认 | 决策人 |
|---|---|---|---|
| T1 | 大基线/样本的存储：Git LFS vs 对象存储 | 对象存储 + sha256 清单（LFS 配额与 fork 体验差） | 团队/运维 |
| T2 | 性能 runner：GitHub larger runner vs 自托管 | larger runner 起步 | 运维 |
| T3 | PowerPoint 基线的生成机器与版本锁定 | 一台 Windows 365 固定版本 + 一台 macOS | 团队 |
| T4 | e2e 在 PR 上的范围 | 冒烟 8 条 | 团队 |

## 15. 对章程的异议/建议

- **S10**：§5.3 规则 7 的允许子路径建议明确为 `.`、`./testing`（且 `./testing` 只能被测试代码与其他包的 `testing/` 引用），并加入 dependency-cruiser 规则（09-03）。

## 16. 跨条线要求

- A 线：`@oce/model-core/testing` 提供 `runDocumentStoreConformance`、`runFormatCodecConformance`；`@oce/model-slide/testing` 提供 `randomCommand(seed)`、不变量检查器、最小 Snapshot fixtures；`@oce/ooxml-core/testing` 提供 `diffPackage` 与规范化器；`@oce/kernel/testing` 提供 `createTestHost`、`describePluginLifecycle`、`assertNoLiveEffects`。
- 类型治理线：扫描器核对「每个 provide 有 conformance 调用」「每个 plugin.ts 有 lifecycle 测试」「testing 子路径不被 src 引用」；patch 覆盖率与 job 矩阵（09-07）。
- 产品：T3/T4；视觉阈值是否需要产品验收参与。

---

## 17. v0.2 补充：与 A 线命名的对齐、PRD 验收口径的承接

- **命名对齐**（总编排裁决：契约套件统一命名 `run<Definition>Conformance`）：`runDocumentStoreConformance`（`model-core/testing`）**是 store-yjs 的验收**，其「协同分节」承载 06 §8 与 ADR-0020 补充表的并发用例，并新增「并发同位插入按 `(order, id)` 全序一致」「rekey 后顺序不变」两条；`runFormatCodecConformance` 等同理；生命周期套件沿用 A 线 `defineLifecycleSuite`（`kernel/testing`，本文 `describePluginLifecycle` 读作此名）；`command-harness`（05）与 `runDocumentStoreConformance` 的运行矩阵：`{ memory, yjs } × { 单机, 双客户端同步 } × { 单人策略, 协同分节 }`，在 model-core、store-memory、store-yjs、collab-yjs 四个包的 CI job 中各跑一次。
- **双端导出一致（SV-02）**：`test/roundtrip/export-parity.test.ts`：同一 Snapshot（含图片、嵌入字体、不透明部件样本）在 Playwright Chromium 与 Node 各导出一次，断言 sha256 相等；前提是 zip 写入器确定性（08 §16.2，对 A 线的要求）。
- **协同模拟规模（CO 验收）**：20 客户端 × 1,000 随机命令（文本插删、形状增删移、页重排、组合/取消组合）、随机分区与重连；收敛后模型哈希一致且导出 pptx 通过 XSD 校验（`test/collab-sim/xsd/`，ECMA-376 Transitional schema）。CO-08 每行有确定性脚本，并断言 `collab/soft-conflict` 提示出现率 100%。
- **视觉 oracle 增补**：PDF 通道——服务端 PDF 逐页栅格化后与 PowerPoint 导出 PDF 比对，SSIM ≥ 0.85（SV-02）；OF-05 的「行数一致率 ≥ 95%、行首字符一致率 ≥ 90%」作为文本类别的结构断言（从 DOM 行模型读取）；服务端 PNG 与客户端截图像素差 ≤ 0.5%。
- **预算来源单一化**：`test/perf/budgets.json` 的 `gate` = PRD 04 NF-01 各表，`target` = 07 §14.6 / 06 §18.5 / 08 §16.5 的更严值；`gate` 超出即失败，`target` 超出仅告警。参考文稿 D50 / D200 / DX-1000 / DX-DEEP / DX-MEDIA 是语料库 `manifest.json` 中 `perf: true` 的固定成员（T3）；参考机 RM-A/RM-B/RM-S 的 runner 标签进入 perf job 矩阵，RM-B 以「预算 × 2 仍须满足」执行。
- **打开管线用例**（NF-01）：`open-*` 场景断言 `PerformanceObserver('longtask')` 无 > 50 ms 任务、`unit/open-progress` 阶段时间戳满足 §14.6 表、跳转未解析页 ≤ 300 ms。
- **IME spike 用例**（ADR-0028 补充）：`test/e2e/specs/ime/*.spec.ts` 的场景矩阵与真机手测清单。
- **需求追溯（NF-09）**：每个测试文件顶部 `// @req CO-08 CO-05`（或 `test.meta({ req: [...] })`）；类型治理线的扫描器校验 id 存在于 PRD 并生成需求 ↔ 测试矩阵；无 `@req` 的新测试文件在 PR 上告警。
