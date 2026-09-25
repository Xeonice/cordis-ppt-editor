# 架构文档总览（30-architecture）

> 状态：草稿 | 负责：架构-结构 | 更新：2026-09-18；2026-09-24（rulings §4.15：C-9 结案——删「全局 yarn」前提，改 pnpm 11 双锁 + Node 26；A-9 注明 Q3 未覆盖；UI 组件库行 shadcn 命令改 pnpm dlx）；2026-09-25（补图）；2026-09-25（矛盾收口，rulings §4.18）；2026-09-25（§4.19：§2 登记三条设计线与三线总边界表，08 / 11 改为摘要 + 链接、06 §0.1 与 08 §0.1 写 M2/M3 新边界）；2026-09-25（设计线拆分：§2 首加「前端 / 后端 / 测试设计以 50 / 60 / 70 为准」，07、10 索引行改注摘要 + 链接）；2026-09-26（§4.20）（FE-01：§3 UnitScope 行登记 Unit 默认 Provider 登记表） | 依赖：charter v0.1
> 本 README 由架构-结构条线起草；「文档索引」中 06/07/08/10/11 由架构-运行时条线撰写，09-type-discipline/ 由类型治理条线撰写。总编排合并时以此为入口。

---

## 0. 这套文档解决什么问题

章程（`docs/00-charter/charter.md`）定义了**要建什么**：一个以 cordis 4 为内核、每一级可插拔、文档类型盲的办公文档 SDK。本目录回答**怎么建**，并且细化到能让一名资深工程师直接创建仓库骨架、写出 `@cordexjs/kernel` 与 `@cordexjs/model-core` 的程度：

- `02` 给出整个仓库的目录树（根、`apps/`、`packages/` 每个包的 `src/` 逐文件职责、`tooling/`），以及每个包 `package.json` 的字段策略与依赖规则；
- `03`/`04`/`05` 给出内核、文档模型、命令系统的**签名级草案**；
- 每一条架构规则都标明**如何被机械验证**（哪个 lint / dependency-cruiser 规则 / 测试套件 / CI job），细节由 `09-type-discipline/` 承接；
- 每一个抽象都写明**为什么不像 Univer 那样做**（引用 `reference-univer-lessons.md` 的 K/A 编号）。

---

## 1. 架构原则（与章程 §0 一致，加上本条线的落地解读）

| # | 原则 | 落地解读 | 执行点 |
|---|---|---|---|
| P1 | **SDK 优先** | 一切能力都在 `packages/*` 中；`apps/web` 与 `apps/server` 只含组装与传输壳，零业务逻辑 | depcruise `cordex-apps-only-assemble`：`apps/*` 只能 import 白名单包（apps/web：`preset-*`/`protocol`/`design`/`ui-react`/`i18n`/`shared`/`kernel`（值导入仅 host 目录）；apps/server：`server-*`/`protocol`/`kernel` 类型，`cordis-host/**` 另可装配 iso 插件；02 §3、09-03 §3.7）；lint `no-restricted-syntax`：`apps/**` 内禁止 `defineCommand`/`defineMutation` 等领域定义（09-02 §3；原称扫描器 `no-domain-defs-in-apps`，rulings §4.18 FE-05/GV-15） |
| P2 | **每一级可插拔** | 每个可替换能力都有 Definition（契约包或契约文件）、≥1 个 Provider、Consumer 只依赖 Definition；移除任一 Provider 系统仍可启动（降级） | depcruise 三角色规则（09-03）；`preset-*` 的「移除 Provider 仍可启动」矩阵测试（02 §6、11） |
| P3 | **文档类型盲** | 水平层不出现 `slide`/`doc`/`sheet` 的知识；一切文档类型知识经 `core.documentType` 等贡献点注入 | depcruise R3：非组合根的水平层禁 import 垂直束（`compositionRoot: true` 的 preset-*/apps 豁免但仍受 R4/R9，rulings §4.18 FE-01）；lint `cordex/no-doc-type-literals`；`fixture` 文档类型的盲测套件（12） |
| P4 | **规范必有执行点** | 本目录每条「规则」旁都有「机械验证」小节；没有执行点的规则不得写入 | `scan-policy`（`tooling/scripts/scan-policy.ts`，CI job `policy-check`）读取 09-08 矩阵并校验 CI job 存在且在 PR 触发（A16–A19） |
| P5 | **唯一注册抽象** | 全代码库只有 `ContributionPoint`；不存在 `register*` 方法与模块级 `Map` | lint `cordex/no-register-methods-outside-kernel`、`cordex/no-module-level-mutable-state`（09-02） |
| P6 | **时间可组合** | 激活期创建的一切资源都归 `ctx.effect()` 所有；卸载后 `fiber.getEffects()` 为空 | `@cordexjs/kernel/testing` 的 `defineLifecycleSuite` 对每个插件包强制运行（11） |
| P7 | **单一事实源** | 运行时模型只经 `DocumentStore` 读写；协同模式下 CRDT 文档即事实源；派生数据不入 Snapshot | 类型测试 `Persisted<T>` 剔除 `Derived<T>`；快照 schema 校验（04 §7） |
| P8 | **失败可传播、失败可隔离** | 命令返回 `Result<T, E>`，不返回 `boolean`；插件 `apply` 抛错只让自身 Fiber `FAILED`，兄弟不受影响 | lint `cordex/no-boolean-command-result`；kernel 失败隔离测试（03 §8） |

---

## 2. 文档索引

> **前端 / 后端 / 测试设计以 [50-frontend](../50-frontend/README.md) / [60-backend](../60-backend/README.md) / [70-testing](../70-testing/README.md) 为准**（rulings §4.19）：本目录只保留跨端原则、跨端协议、iso 契约与 ADR；下表中标注「摘要 + 链接」的文件，其运行侧细节已迁入三条设计线，冲突时以设计线为准（已接受 ADR 与 rulings 除外）。边界表见本节末。

| 文件 | 内容 | 负责 |
|---|---|---|
| [`01-overview.md`](./01-overview.md) | C4 L1/L2、四大原则、打开/编辑/协同/导出端到端数据流 | 结构 |
| [`02-layering-and-packages.md`](./02-layering-and-packages.md) | ★ 分层网格、**整个仓库目录树**（逐文件职责）、`package.json` 策略、依赖规则表 | 结构 |
| [`03-kernel-and-plugin-model.md`](./03-kernel-and-plugin-model.md) | kernel 封装、ContributionPoint、Manifest、UnitScope、插件形态与生命周期、失败隔离、preset/loader、版本协商 | 结构 |
| [`04-document-model.md`](./04-document-model.md) | model-core 抽象、model-slide 对象模型、OOXML 映射表、不透明保留、样式继承、单位、稳定 id、schema 迁移 | 结构 |
| [`05-command-and-history.md`](./05-command-and-history.md) | 命令三分法契约、执行管线、Mutation 类型化与降级、Store 推导逆操作、协同撤销、失败传播 | 结构 |
| [`06-collaboration.md`](./06-collaboration.md) | CRDT 映射、同步协议、presence、离线、权限即时性、冲突语义 | 运行时（B） |
| [`07-rendering.md`](./07-rendering.md) | 渲染介质与坐标、贡献点与帧管线契约、SceneProvider / TextMeasurer / RenderTarget、打开管线契约、headless 渲染跨端约束；目录树、文本编辑宿主、命中与缩略图、性能预算为摘要 + 链接（40-modules/06、07，50-frontend/04–06、13，60-backend/06，70-testing/09） | 运行时（B） |
| [`08-backend-nestjs.md`](./08-backend-nestjs.md) | 后端一页总览、五条跨端原则、服务端里程碑边界；其余各节为 60-backend 的摘要与链接 | 运行时（B） |
| [`09-type-discipline/`](./09-type-discipline/README.md) | 类型治理：tsconfig、lint、boundaries、api-surface、runtime-boundaries、scanners、hooks-and-ci、policy 矩阵、plugin 类型契约 | 类型治理 |
| [`10-observability-and-errors.md`](./10-observability-and-errors.md) | 错误码体系（格式、域登记、HTTP/WS 映射）、日志命名与脱敏、遥测 API 与命名规则、公开事件定稿；Sink、span / 指标清单、诊断与客户端错误上报为摘要 + 链接（50-frontend/15、60-backend/18） | 运行时（B） |
| [`11-testing-strategy.md`](./11-testing-strategy.md) | 测试原则与门禁口径摘要；各类测试细则链接 70-testing | 运行时（B） |
| [`12-extension-to-doc-and-sheet.md`](./12-extension-to-doc-and-sheet.md) | 文档类型盲验证方案、model-doc/model-sheet 对水平层的抽象要求、盲测套件定义 | 结构 |
| [`adr/README.md`](./adr/README.md) | ADR 索引：0001–0019 结构、0020–0039 运行时、0040–0049 类型治理 | 结构（索引）|

### 三条设计线与本目录的边界（rulings §4.19）

2026-09-25 起，前端、后端、测试设计分出三条设计线，各为该侧设计的**唯一事实源**；本目录保留跨端原则、跨端协议与 ADR，40-modules 保留包 / 文件级规划，重复段落改为引用。本目录某节与设计线不一致时，以设计线为准（已接受 ADR 与 rulings 除外）。

| 主题 | 本目录保留（跨端） | 唯一事实源 |
|---|---|---|
| 前端（浏览器应用壳、preset 装配、渲染与缩略图、协同客户端、评论与版本历史、性能与体积、客户端安全、事件与遥测、i18n 与无障碍） | 01 总图、02 包级定位、05 命令契约、06 协议与语义、07 管线契约、10 命名与脱敏规则 | [50-frontend](../50-frontend/README.md) |
| 后端（Nest 模块与角色矩阵、鉴权链、完整 DDL、对象存储与保留、REST 目录、WS 服务端视角、部署配置、观测端点） | 08 一页总览与五条跨端原则、06 协议、10 错误码登记与 http-map | [60-backend](../60-backend/README.md) |
| 测试（分层、契约套件、round-trip 与语料、视觉 oracle、协同模拟、e2e、性能与容量、安全、CI 映射、需求追溯） | 11 原则与门禁口径摘要、09-type-discipline 的扫描器与 lint 定义 | [70-testing](../70-testing/README.md) |

里程碑口径：协同后端（网关、Room、update 持久化与快照、服务端导入）随 M2 交付，M3 为多人协同体验层（rulings §4.19 D-M2-CONTENT；逐项以 PRD 05 §0.3 为准，本目录落点见 06 §0.1、08 §0.1）。

### 阅读顺序建议

1. 先读 `01` 建立整体图；
2. 要建仓库骨架：`02` → `03` → `09-type-discipline/01..03`；
3. 要写 `model-core`/`model-slide`/`ooxml-*`：`04` → `05` → `adr/0007`、`0008`、`0009`、`0013`、`0014`；
4. 要写协同/渲染/服务端：读 `03`/`04`/`05` 中「对 B 线的契约」小节后转 `06`/`07`/`08`。

**文档地图与阅读路径**

```mermaid
flowchart TB
  subgraph structLine["结构线"]
    direction LR
    d01["01 总览"]
    d02["02 分层与包"]
    d03["03 内核与插件模型"]
    d04["04 文档模型"]
    d05["05 命令与历史"]
    d12["12 扩展到 doc / sheet"]
  end
  subgraph runtimeLine["运行时线 B"]
    direction LR
    d06["06 协同"]
    d07["07 渲染"]
    d08["08 后端 NestJS"]
    d10["10 观测与错误"]
    d11["11 测试策略"]
  end
  subgraph typeLine["类型治理线"]
    direction LR
    d09a["09-type-discipline/01..03：tsconfig、lint、boundaries"]
    d09b["09-type-discipline/04..09 与 README"]
  end
  adr["adr/0007、0008、0009、0013、0014"]
  contracts["03 / 04 / 05 中「对 B 线的契约」小节"]
  d01 -- "建仓库骨架" --> d02 --> d03 --> d09a
  d01 -- "写 model-core / model-slide / ooxml-*" --> d04 --> d05 --> adr
  d03 --> contracts
  d04 --> contracts
  d05 --> contracts
  contracts -- "写协同 / 渲染 / 服务端" --> d06
  contracts --> d07
  contracts --> d08
```

怎么读：三个子图对应三条撰写条线，箭头是上面「阅读顺序建议」的路径：先读 01，再按目的分叉为「建仓库骨架」与「写模型/格式」两条；第 4 条从 03/04/05 中「对 B 线的契约」小节转入 06/07/08（指向契约节点的三条边表示该小节所在文档）；没有箭头的文档按需查阅。

---

## 3. 结构线的关键设计决策速览（详见 ADR）

| 决策 | 一句话 | ADR |
|---|---|---|
| 声明合并桥接 | kernel 自有 `Events`/`Context` 空接口，cordis 的同名接口 `extends` 它们；插件只 `declare module '@cordexjs/kernel'` | 0001 |
| 版本策略 | 水平 L0–L1 lockstep（Changesets fixed 组）；垂直束与 Provider 独立 semver；`peerDependencies` 在**加载期**校验，失配即 FAILED（不是 log） | 0002 |
| Manifest | `src/manifest.ts` 由静态分析**生成并入库**，CI 校验无 diff；运行时与实际 provide/contribute/on 比对 | 0003 |
| 工具链 | pnpm + Turborepo；库用 `tsc -b` 产出未打包 ESM + 逐文件 `.d.ts`；apps 用 Vite；Changesets | 0004 |
| UnitScope | 每个 Unit 是一个插件 Fiber，其 `apply` 内 `ctx.isolate()` 隔离 `store/history/selection/render/presence` + 文档类型声明的服务；挂哪些 Provider 由 `units.registerUnitProvider` 登记表决定（model-core 只登记 history、selection，其余由 preset 的 `scope:'unit'` 条目登记，同一 `provides` 只登记一次，03 §5.1a，rulings §4.20 FE-01） | 0005 |
| 唯一注册 | `defineContributionPoint` / `ctx.contribute` / `ctx.contributions`；贡献由 effect 拥有 | 0006 |
| Store 与撤销 | `DocumentStore` 是 Definition；逆操作由 Provider 在 `StoreOp` 层推导；`history` 是策略层 | 0007 |
| 不透明保留 | 部件级 verbatim + 节点级 `OpaqueXml` 槽 + 脏部件重生成；二进制走内容寻址 blob | 0008 |
| Snapshot 版本 | 每个 `documentType` 一个整数 `schemaVersion`；`core.migration` 贡献点；schema-lock 防止未升版本改 schema | 0009 |
| preset vs loader | 浏览器与服务端默认程序化 preset；loader 仅 `server-headless` 可选 | 0010 |
| errors/telemetry | L0 服务、默认控制台/no-op Provider；`throw new Error` 被 lint 禁止 | 0011 |
| 权限放置 | fail-closed；两处检查点：`commands` 管线（含 Mutation 级）与服务端网关；Store 不检查 | 0012 |
| Mutation 降级 | 语义 Mutation（文档类型贡献）→ 纯函数 `lower()` → 5 种 `StoreOp` 原语（`set/delete/insert/remove/text`）；有序实体用 `order: FracKey`（ADR-0032），无 `move` 原语；Store 只懂原语 | 0013 |
| 稳定 id | 模型节点用 CRDT 友好 `NodeId`（UUIDv7）；OOXML `cNvPr/@id` 与 `a16:creationId` 作为字段保留并双向映射 | 0014 |
| 单一执行入口 | Command 与 Operation 都经 `commands.execute`；Mutation 只能在事务内产生，外部**不可执行** | 0015 |
| 盲测夹具 | `model-core/testing` 提供 `fixture` 文档类型；水平层测试禁 import 垂直束；M5「水平层零改动」以文件哈希冻结校验 | 0016 |
| UI 组件库 | **shadcn/ui 复制模式**（CLI 4.21，`radix-rhea` 风格——2026-09-16 起，原 `radix-nova`；Radix + Tailwind 4 + Lucide + Geist）：源码复制进 `ui-react/src/components/ui/`，`components.json` 入库，升级走 `pnpm dlx shadcn@4.21.0 diff`（仓库根禁用 npx，rulings §4.15 Q9）；`@cordexjs/design` 只交付主题变量 CSS（shadcn 变量 + `--cordex-*`），组件依赖全部落在 ui-react/`*-ui`；`ui-core` 仍无 React；设计 playground 是 ui-react 的种子（用户指令，章程 D10 修订） | 0017 |

---

## 4. 待决事项（按默认值推进；决策人见右列）

| # | 事项 | 当前默认 | 影响 | 决策人 |
|---|---|---|---|---|
| A-1 | ~~`StoreOp.move` 在 CRDT 下的语义~~ | **已解决**：采纳 B 线 ADR-0032——有序实体 = 实体表 + `order: FracKey`，移动 = 单键 `set`；`move` 原语删除（ADR-0013）；04 §2.3、05 §4 已同步 | — | 已结（保留追溯） |
| A-2 | 同构 XML 解析器：自研保真 DOM vs `@xmldom/xmldom` / `fast-xml-parser` | 自研最小保真 DOM（保留前缀/顺序/空白/注释，SafeXmlNode 遍历） | `ooxml-core/xml` 工作量与保真度 | 架构-结构 + 类型治理（依赖许可与 iso 检查） |
| A-3 | Strict 一致性类输入**有编辑**时的导出一致性类（与 PRD PD-03 合并为一条） | 三案：**A 混合**（脏部件写 Transitional、干净部件 verbatim，本条线旧默认）——**放弃**：同一包内命名空间混用、`p:presentation/@conformance` 与部件不一致，PowerPoint 很可能触发修复，违反产品硬要求「PowerPoint 365 打开无修复」；**B 整包转 Transitional**（产品倾向）——满足两条硬要求，代价：Strict 输入一经编辑**全部**部件重生成（含不透明部件的命名空间改写，改写不透明 XML 有风险），「未触碰部件字节相同」对 Strict 输入失效；**C 保持原一致性类**（脏部件经 Transitional→Strict 反向映射写回 Strict、干净部件 verbatim）——两条硬要求 + 未触碰部件字节相同，代价：维护反向表并对 Strict XSD 校验。**推荐：C 为目标、B 为自动回退**（导出时 C 的产物未通过 Strict XSD 或反向表缺项 → 回退 B 并诊断 `STRICT_FALLBACK_TRANSITIONAL`）。零编辑往返在三案下均字节相同（04 §4.4） | `ooxml-core/xml/normalize.ts` 反向表、导出校验步骤、保真承诺表述 | 用户 + 总编排（产品 PD-03 与本条合并裁决） |
| A-4 | 库构建：`tsc -b` 未打包 ESM（默认）vs `tsdown` 打包 | `tsc -b`；`tsdown` 仅用于未来「独立浏览器包」 | 09-04 publint/attw 配置 | 类型治理 |
| A-5 | `NodeId` 生成器：UUIDv7（36 字符）vs 26 字符 base32 | UUIDv7 | Y.Doc 体积、日志可读性 | 架构-结构（听取 B 对体积的评估） |
| A-6 | `commands.execute` 的 unit 定位：显式 `unitId` 参数（默认）vs 从调用方 ctx 推导 | 显式 `unitId`；应用级命令传 `null` | 所有命令调用点 | 架构-结构（已定默认，可否决） |
| A-7 | 仓库自身许可证 | 建议 Apache-2.0（SDK 场景的专利授权） | 依赖审查基线、第三方插件生态 | 用户 |
| A-8 | `server-headless` 是否启用 `@cordisjs/plugin-loader` 配置驱动组合 | 关闭；preset 程序化组合 | 运维配置形态 | 架构-运行时（08）+ 运维 |
| A-9 | 幻灯片 body 形态 | 归一化实体表 + 每实体 `order: FracKey`（与 B 线 ADR-0032 一致，无顺序数组）。**残余分歧**：Snapshot 中 `order` 键**保留**（A，ADR-0013 第 7 条：使 `toSnapshotBody() ≡ state()`、导入不必重生成键、memory/yjs 一致）vs **转数组**（B，ADR-0032 第 6 条：人类可读） | Snapshot 契约、迁移语料形态、调试工具 | 总编排合并（A 推荐保留键，数组视图交给调试工具）。2026-09-24 注：rulings §4.15 Q3 只裁定 CRDT 选型（Yjs 13.6.x）与撤销语义（同键跳过并提示 / 整步跳过即停 / 软删除墓碑 + TTL），**未涉及** `order` 键的 Snapshot 形态，本项不随 Q3 结案，仍待裁决 |
| A-10 | `@cordexjs/design` 原子组件形态：Web Components vs 纯 CSS 类 + 最小 TS | 纯 CSS 类 + 最小 TS 行为 | ui-react 的复用方式 | 设计条线 |
| A-11 | 图表建模深度与 M1 查看路径 | **已对齐 PRD OF-09**：M1 `c:chart` 部件不透明保留（`Chart.partRef`），**图表渲染器只读解析**该部件（`ooxml-core/chartml/`：`c:chartSpace` 的图表类型/系列/`numCache`/`strCache`/轴/图例/标题 → 只读 `ChartReadModel`）并渲染为 SVG；**不**依赖位图预览（pptx 图表部件通常无预览，旧措辞作废）；M1–M2 不建可编辑模型。M3 起 `model-slide` 增加可编辑 `Chart.data`（ED-15；内嵌工作簿策略 PD-06 由 B 决定）。渲染器为惰性块：M1–M2 `@cordexjs/slide-render/chart` 子路径，M3 拆为 `@cordexjs/slide-render-chart`（总编排已接受） | `ooxml-core/chartml/`、`slide-render/chart/`、EM-07 图表块 ≤ 400 KB | 产品已表态、架构采纳；待总编排确认 |
| A-12 | 「部件级 diff 零差异」口径 | **已与 PRD CS-01 合并**为 04 §5.4 唯一口径：零编辑 = 部件路径集合与每部件 SHA-256 相同（含 `[Content_Types].xml`/`.rels`；zip 条目顺序/时间戳/压缩方法不计）；编辑后 = 未触碰部件字节相同 + 脏部件良构且通过 XSD + 规范化（C14N + 属性排序 + 忽略无意义空白）diff 仅在被编辑元素子树 + 被编辑元素的未知属性/子元素/`extLst` 全部保留 + `cNvPr@id` 部件内唯一且引用一致 + 派生部件白名单（`docProps/core.xml` 的 `dcterms:modified`、`docProps/app.xml` 页数/字数、`docProps/thumbnail.jpeg`、`[Content_Types].xml` 新增类型、受新增/删除部件影响的 `.rels`）+ 删页无孤儿部件 | M1/M2 验收脚本 `ooxml-pptx/testing/roundtrip.ts`、`test` job 的 `fidelity-roundtrip` 步骤（CI job 名以 09-07 §3 的 13 个封闭集合为准，rulings §4.18 GV-14） | 待总编排确认后回写章程 §7 |
| A-13 | 单文件 ≤ 200 MB（Q5）时 zip 读取形态：全量内存 vs 流式/Range | 全量内存 + 懒解压媒体（`fflate` 同构）；M3 评估流式 | `ooxml-core/opc/zip.ts` | 架构-运行时（性能预算，07/11） |

---

## 5. 对章程的异议 / 建议（不擅改章程，待总编排裁决）

| # | 章程条目 | 问题 | 建议 |
|---|---|---|---|
| C-1 | §5.3 规则 2「只向下：import 目标的层号 ≤ 自身层号」 | 与 §5.2 冲突：`slide-ui`（L6）依赖 `ui-react`（L7），`slide-ui` 依赖 `slide-render`（L6）依赖 `render-dom`（L5）没问题，但 L6→L7 按数字是「向上」 | 把规则 2 的机械形式改为**显式允许矩阵**（每个包 `package.json#cordex.layer` + 允许的目标层集合，见 02 §7），并在章程中把垂直束的层号改为「层带」：V-model（可依赖 ≤L1）、V-codec（≤L3）、V-render（≤L5）、V-ui（≤L7）。数字比较只对水平层生效 |
| C-2 | §5.5 服务名列表 | 缺少 `selection`（§4 UnitScope 定义中明确列出 selection 被隔离；model-core 也定义了通用 Selection 类型） | 在 §5.5 增加 `selection`（UnitScope 内） |
| C-3 | §5.5 贡献点 id 列表 | `ui.command` 语义不明：命令的**可执行定义**属于 model-core，不属于 UI | 明确 `ui.command` = 命令的**呈现元数据**（title/icon/when/keybinding 展示）；新增 `core.command`（可执行定义）、`core.mutation`、`core.migration`、`core.resource`、`core.permissionPolicy`、`render.scene`、`render.overlay`、`layout.measurer`、`errors.sink`、`telemetry.sink`、`i18n.bundle`、`ui.toolbar`/`ui.statusBar`/`ui.dialog`/`ui.notification`/`ui.theme`（完整表见 03 §3.6；id 一律 camelCase） |
| C-4 | §5.2 `kernel` 职责 vs primer §5.1 | primer 把 `openUnitScope(ctx, unit)` 放在 kernel，章程把 `Unit/UnitScope` 放在 model-core | 采用：kernel 提供**文档无关**的 `createIsolatedScope(ctx, { services, meta })`；model-core 拥有 `Unit`/`UnitScope`/`units` 服务。建议 primer §5.1 措辞改为 `createIsolatedScope` |
| C-5 | §5.2 `render-dom` 依赖上限「engine-render」 | `engine-layout` 的 `TextMeasurer` 是 Definition，浏览器 canvas 度量器 Provider 必须落在 dom 包 | `render-dom` 依赖上限改为「engine-render, engine-layout」；`server-headless` 提供 Node 字体度量 Provider |
| C-6 | §5.2 `ui-core` 依赖「design(token 契约)」 | 若 ui-core 在运行时 import `@cordexjs/design`，则 UI 基座与设计系统耦合；K7 的初衷是 design 对 SDK 零依赖（反向） | 允许 ui-core 仅 import `@cordexjs/design/theme.css`（主题变量）与 token 名类型（type-only）；lint 禁止 ui-core import design 的运行时 TS（09-03 三角色规则的一个特例）；组件依赖（Radix/Tailwind/Lucide）只在 ui-react 与 `*-ui`（ADR-0017） |
| C-7 | §4 `Snapshot` 定义 | 未说明二进制（媒体、不透明部件字节）的归属；若进 JSON/Y.Doc 会撑爆协同文档 | 术语补充 `SnapshotBundle = Snapshot(JSON) + Blob 集合（内容寻址）`；`Snapshot` 内只含 `BlobRef`。建议章程 §4 吸收 |
| C-8 | §6.1 D9 「Vitest；Playwright」 | 未指定 dom 包的单测环境 | 建议：dom 包默认 `happy-dom`，涉及真实布局/IME 的用例走 Vitest browser mode（Chromium），由 11 定稿 |
| C-9 | §10 Q9 包管理器 | **已结案**（rulings §4.15 Q9）：原「用户全局 `packageManager` 指向 yarn、会冲突」的前提经实测不成立，已删除 | pnpm 11 双锁：根 `package.json` 写 `packageManager`（精确版本）+ `devEngines.packageManager/runtime`（onFail:error），corepack 仅为可选安装渠道；全部 pnpm 设置写入 `pnpm-workspace.yaml`，删除 `.npmrc` 非鉴权设置；lockfile-guard（lefthook pre-commit + CI）只允许根 `pnpm-lock.yaml`；Node 26 基线（`engines >=26`）；pnpm 12 切换检查点最迟 2027-03-31（02 §2、09-07 §2.1、09-08 TD-079） |
| C-10 | §5.2 `ooxml-core` 依赖上限「shared」 | DrawingML 是三种文档共用的绘图词汇；若其运行时类型放在 `ooxml-core`（L3），`model-slide`（V-model，只能依赖 ≤L1）就必须向上依赖 L3 | DrawingML 运行时类型与 schema 放在 `model-core/src/drawing/`（无 XML、无文档类型知识），`ooxml-core/drawingml/` 只做编解码；`ooxml-core` 依赖上限改为「shared, model-core」（02 §4.9） |

---

## 6. 术语补充（章程 §4 之外，本条线新引入；建议回写章程）

| 术语 | 英文标识 | 定义 | 出处 |
|---|---|---|---|
| 存储原语 | `StoreOp` | Store 唯一理解的 5 种结构操作：`set`/`delete`/`insert`/`remove`/`text`（`insert/remove` 只用于无身份的值列表）；Mutation 经 `lower()` 降级为 `StoreOp[]`；逆操作在此层推导 | 05 §4、ADR-0013 |
| 顺序键 | `FracKey` | 有身份实体（页/形状/母版/版式/节…）的 `order` 属性，fractional index 字串；排序键 `(order, id)`；移动 = 单键写入；由命令层经 `@cordexjs/shared/order.between()` 生成（B 线术语，ADR-0032） | 04 §3.1、ADR-0013 |
| 束 | `bundle` | `package.json#cordex.bundle ∈ slide\|doc\|sheet`，`layer` 以 `V-` 开头时必填；组合根 preset 选填（preset-slide* 标 slide、preset-doc 标 doc），其余省略；depcruise 束间隔离依据（总编排裁决；rulings §4.18 FE-01） | 02 §4.0.1、§7 |
| 降级 | lowering | 文档类型贡献的纯函数 `lower(mutation, view) → StoreOp[]` | 05 §4 |
| 变更集 | `ChangeSet` | 一次事务触及的 `StoreOp[]` + 派生的脏路径集合，供渲染与编解码做脏追踪 | 04 §2.4 |
| 来源 | `Origin` | 事务来源标记：`local(clientId)` / `remote` / `system(load|import|migration|repair|restore|maintenance)` / `replay`；撤销只作用于 `local`；`system('import')` 也用于渐进打开的后续追加批次（不入撤销栈、不标脏，rulings §4.18 CO-12） | 04 §2.2/§2.4、05 §6 |
| 快照包 | `SnapshotBundle` | `Snapshot`（JSON）+ 内容寻址 blob 集合 | 04 §2.5 |
| Blob 引用 | `BlobRef` | `{ hash, size, contentType }`，指向 `BlobStore` 中的不可变字节 | 04 §2.5 |
| 派生类型 | `Derived<T>` | 类型级品牌，标记不得进入 Snapshot 的派生字段；`Persisted<T>` 映射类型将其剔除 | 04 §7 |
| 不透明 XML | `OpaqueXml` | 未建模的 XML 子树，带插入锚点，附着在最近的已建模节点 `extensions` 上 | 04 §5 |
| 不透明部件引用 | `OpaquePartRef` | 未建模的整个 Part 的引用（部件名、内容类型、`BlobRef`） | 04 §5 |
| 脏追踪器 | `DirtyTracker` | 模型路径前缀 ↔ Part 名映射；决定导出时哪些部件 verbatim、哪些重生成 | 04 §5.3 |
| 场景图 | `Scene` / `SceneNode` | 渲染引擎唯一认识的输入：`{ id, kind, bbox, transform, zIndex, children?, data }`；对 `kind` 无知 | 02 §4.15、07 |
| 场景提供者 | `SceneProvider` | 文档类型贡献（`render.scene`）：把 Unit 的某一页/视图构造成 `Scene`，并把 `ChangeSet` 映射为脏节点 | 02 §4.15 |
| 文本度量器 | `TextMeasurer` | `engine-layout` 的 Definition（`layout.measurer`）；Provider：`render-dom` 的 canvas 度量、`server-headless` 的字体解析度量 | 02 §4.13 |
| 隔离作用域 | `createIsolatedScope` | kernel 提供的文档无关工具：对一组服务名逐个 `isolate()` 并 `extend()` 元数据 | 03 §5 |
| 夹具文档类型 | `fixture` | `model-core/testing` 提供的测试专用 `DocumentType`（键值树 + 文本块），用于验证文档类型盲 | 12、ADR-0016 |

---

## 7. 需要总编排协调的跨条线事项

详见本条线汇报；摘要：

- **对运行时线（B）**：`DocumentStore` 契约测试套件 `runDocumentStoreConformance`（命名已裁决为 `run<Definition>Conformance`）是 `store-yjs` 的验收；已按 ADR-0032 删除 `move` 原语并改用 `order: FracKey`，**请 B 修订 ADR-0032 两处**：第 6 条「Snapshot 中顺序以数组表示」建议改为「保留 `order` 键」（见 A-9），第 7 条「由 Store 计算键」建议改为「由命令层经 `@cordexjs/shared/order.between()` 计算，Mutation 携带最终键，`lower()` 保持纯且确定」（ADR-0013 第 2 条）；`Selection<A>` 序列化即 presence 载荷；`permissions.applyRemoteDecisions` 是网关权限变更进入客户端的唯一入口，并由 `permissions` 发 `permission/changed`（不再有 `collab/permission-changed`，见 §7.1）；`SceneProvider`/`RenderTarget`/`ElementRenderer` 的签名以 02/04 为准，07 负责管线与性能；`render.overlay` 贡献点已接受；`server-headless` 使用 `createHost`；`BlobStore` 契约由 `server-storage` 实现；`@cordexjs/collab-offline-idb` 已补入 02（`OfflineStore` Provider 契约请在 06 给签名）。**ML 需求域（母版/版式/主题，总编排提级）**：07 需支持 `ViewDescriptor{ mode: 'master'; target: LayoutId | MasterId }` 的母版视图 SceneProvider（渲染目标版式/母版并叠加母版继承、`showMasterShapes`、占位符提示框；命中测试只作用于目标容器），以及母版/版式/主题变更经 `dependentsOf` 到全部依赖页的脏映射与缩略图更新（OF-15 ≤ 500 ms）；06 需覆盖母版编辑冲突面（删除 vs 引用 → I-ML2 修复 + `collab/soft-conflict{type:'delete-vs-reference'}`、重置 vs 移动同键 LWW、主题逐槽位 LWW、版式复制 vs 母版删除 → I-ML3）与可选软锁（PD-19）；见 04 §12、05 §13。
- **对类型治理线**（2026-09-25 注：下列两条中的旧规则名与「新增扫描器需求」已按 rulings §4.18 GV-15 全量对账——对应既有机制的写正式名，其余归并为既有扫描器子规则、lint 规则或测试断言，不新增扫描器，逐名对照见 09-08 §11/§11.1）：本条线引用的 lint/depcruise/扫描规则清单见 02 §7 与 03 §10（`no-register-methods`、`no-module-level-mutable-state`、`no-bare-throw`、`no-doc-type-literals`、`contribution-file-purity`、`no-unit-scoped-inject-at-root`、`events-declared`、`no-enum-in-protocol`、`no-boolean-command-result`、`exports-explicit`、`schema-lock`、`manifest-diff`）；`Derived<T>` 类型测试；`package.json#cordex` 字段 schema。
- **对产品线**：A-11（图表 M1 只读解析路径）、A-12（保真口径）已按 OF-09/CS-01 对齐；A-3 与 PD-03 合并后给出三案与推荐（C 目标 + B 回退），请产品确认硬要求是否接受 C；`preset-slide-viewer` 已补入 02（OF-14）；CO-05「命令必须声明能力位」已落为 `CommandDef.permission` 必填 + lint（05 §2、ADR-0012）；能力位词汇采用 PRD 形式（`doc.read/comment/write/export/manage/history.*`）放在 `protocol`；PS-01/02 的 Manifest 字段（`stability/documentTypes/permissions/i18n`）已加入 03 §4.1；EM-12 错误码目录生成已加入 ADR-0011；NF-09 需求↔测试矩阵机制请 11/09 承接（结构线只提供 `cordex-allow` 与扫描器框架）；大文件读取（A-13）仍待 B。**ML-01…ML-04** 的模型支撑（字段核对、占位符重匹配/母版样式继承纯函数、I-ML2…I-ML8 不变量与修复）在 04 §12，命令/Mutation/Operation 族在 05 §13；命名说明：`view.setMode` 为水平层 Operation（`mode ∈ documentType.viewModes`），总编排所称 `view.selectMasterOrLayout` 因载荷含 slide 专有 id 落为 `slide.selectMasterOrLayout`，请 PRD 07 同步；`deleteLayout` 对被引用版式 fail-closed（需 `reassignTo`）请在 PRD 07 验收中体现。
- **对类型治理线（补充）**：`package.json#cordex` 字段按总编排裁决编码（`layer` 层带、`bundle`、`iso`、秩表）见 02 §4.0.1/§7 R2；新增扫描器需求：`no-index-in-mutation`、`command-declares-capability`、`capabilities-in-protocol`、`store-transact-callsites`、`telemetry-events-declared`、`error-codes-catalog`、`event-domain-whitelist`（§7.1 第三方前缀规则）、`codec-no-clock`（ooxml-* 禁止读时钟，SV-02；→ 2026-09-25 落为 ESLint 规则 TD-097，其余各名的正式机制见 09-type-discipline/08 §11/§11.1，rulings §4.18 GV-15）。
- **B 线 7 项契约要求的处理状态**（2026-09-15）：
  1. ✅ `undoCaptureTimeout` 统一为 500（02 §4.7）；✅ 二选一取 `yjsBackend` 服务，删除 `doc-access` symbol（02 §4.7、03 §5.2、ADR-0005）；unit-plugin 对 store Provider 的全部 `provide` 名做 isolate。
  2. ✅ `Origin`：`system.reason` += `repair | restore | maintenance`；`local.via?: 'undo' | 'redo'`（04 §2.4、02 §4.5）。
  3. ✅ `TransactionRecord.ops: RecordedOp[]`（可选 `anchor`）；`ChangeSet.ops: StoreOp[] | null` + `derived`；`DirtySet.changed?`；`DocumentType.shape: BodyShapeHints`（entityTables / atomicLists / richTexts）（04 §2.1/§2.4、02 §4.5/§4.14）。
  4. ✅ 导出确定性四条写入 04 §5.3 与 02 §4.9/§4.10（zip 确定性、docProps 时间戳来自模型、编码器不读时钟/不读 layout——后者由 R2 秩表机械禁止）；验证行见 04 §11。
  5. ✅ `DocumentType.invariants / validateChangeSet / diff?`、`migrations.runOnUnit`、`units.open` 的 `source: { kind:'state' }`（04 §2.1/§2.6、03 §5.3、02 §4.5/§4.8）；⏳ 现代评论部件编解码与图表最小内嵌工作簿生成器已在 02 §4.10 登记为 **M3** 文件（`comments.ts`、`chart-workbook.ts`），签名待 M3 前与 B 联合细化。
  6. ✅ 事件表按 10 §11 合并：`render/frame`（定稿；`render/painted` 弃用）、`render/element-failed`、`collab/state-changed`、`permission/changed`、`unit/open-failed`、`export/*`、`plugin/*`；`perf/frame` 取消（02 §4.2/§4.5/§4.11/§4.14、03 §5.3/§8、README §7.1）。
  7. ✅ 状态头保持 `charter v0.1`。
  - ✅ **已裁决**（总编排）：原语数 = 5（`set/delete/insert/remove/text`，无 `move`；`Ordered` 为 `DocumentType.shape` 形状标注，B 线同步删除 `move`）；契约套件命名 = `run<Definition>Conformance`（`runDocumentStoreConformance`、`runFormatCodecConformance`…；`defineLifecycleSuite` 不变）；第三方前缀 = 章程 D15 的 `<vendor>:` 形式；章程 §4 已回写本条线全部术语补充。
  - ⏳ **仍待裁决**：(b) Snapshot 中 `order` 键保留 vs 转数组（A-9）；(d) ADR-0032 第 7 条「由 Store 计算键」→ 建议改为命令层计算（ADR-0013 第 2 条）。

### 7.1 事件名 / 贡献点 id 定稿建议（针对 PRD README §8、EM-05 与 B 线 06/07 的分歧；总编排裁决）

| 分歧 | PRD | 架构草稿（A / B） | 建议定稿 | 理由 |
|---|---|---|---|---|
| 元素渲染失败 | `render/element-failed{kind, code}` | A `render/error`、B `render/element-error` | **`render/element-failed(unitId, nodeId, kind, code)`**（A 已改） | 与 `render/element-degraded`、`render/font-fallback` 同族；公开事件与遥测事件同名 |
| 帧事件 | 遥测 `perf/frame`（采样 1%） | A `render/painted`、B `render/frame` | **总编排定稿**：cordis 事件 **`render/frame(unitId, stats)`**（进程内消费，公开订阅 ≥ 50 ms 合并）+ `render/first-paint`；遥测事件 `perf/frame` 由 `render/frame` 派生（采样）；`render/painted` 弃用（02/03/10 已统一） | 一套名字；帧级遥测与业务事件分离 |
| 协同/单元事件对齐（10 §11） | `unit/open-failed`、`collab/state-changed` 等 | A `unit/failed`、`collab/status-changed`、`format/imported\|exported` | **采用 10 §11**：`unit/open-failed`、`collab/state-changed`、`collab/update-rejected`、`collab/repair`、`export/started\|completed\|failed`（A 已改 02/03）；`kernel/plugin-failed` → `plugin/failed`（+ `plugin/loaded`、`plugin/incompatible`），`kernel/manifest-mismatch` 保持为内部诊断事件不进公开表 | 事件登记表本体在 03（`Events` 增强）+ 各包 `*.contribution.ts`；扫描器 `events-declared` |
| 权限变更 | `permission/changed{added, removed, propagationMs}` | B `collab/permission-changed(unitId, prev, next)` | **`permission/changed(unitId, { added, removed })`**，唯一发出者为 `permissions` 服务（`applyRemoteDecisions` 或本地策略变化后）；collab 层只调用 `applyRemoteDecisions`，不再发自己的事件；`propagationMs` 作为遥测属性 | 本地与远端权限变化对消费者是同一件事；单一发出者便于测试 ≤ 2 s 传播 |
| 状态栏贡献点 | `ui.statusBar` | A `ui.statusbar` | **`ui.statusBar`**（总编排已裁决；02/03 已统一） | 与 `core.documentType`、`ui.contextMenu` 同为 camelCase |
| 覆盖层贡献点 | `render.overlay` | B `render.overlay`；A 仅有 `OverlayLayer` 契约 | **接受 `render.overlay`**（engine-render 定义，03 §3.6 已加） | 选区框/参考线/远端光标可由插件贡献 |
| 遥测/错误出口 | `telemetry.sink` 贡献点 | A `HostOptions` 回调 | **`telemetry.sink` / `errors.sink` 贡献点**（ADR-0011；03 已改） | D3 唯一注册抽象 |
| `collab.transport`、`storage.blob` | 贡献点 | A：服务 Provider 座（`collabTransport`、`BlobStore`） | 保持为**服务 Provider 座**（替换 = 换插件，不是集合）；建议 PRD PS-02 目录把这两项标为「Provider 座」 | 单例能力不是多项集合 |
| `export.target` | 贡献点（PDF/图片/Markdown） | A 无 | **不新增**：= `core.format` 中 `canImport:false` 的 codec；UI 的导出菜单读 `formats` | 复用 `formats` 服务与 `format/exported` 事件 |
| `ui.theme` | 贡献点（token 覆盖集） | A：`theme` 服务 `set()` | **接受 `ui.theme`**（Beta；ui-core 定义、`theme` 服务读取；03 §3.6 已加） | 集成方与插件可贡献主题而非只能命令式设置 |
| 第三方前缀（PRD CS-07） | `x-<pluginId>/<动作>` | A 草稿 `x-<pluginId>` | **定稿：章程 D15 `<vendor>:` 形式**——事件 `<vendor>:<域>/<动作>`，贡献点 `<vendor>:<域>.<名>`，能力位 `<vendor>:<域>.<action>`；`vendor` = 包 npm scope 去 `@`（`@acme/cordex-comments` → `acme:`），扫描器与包名机械对应；错误码本就是 `<pkg>/<CODE>`。内核/垂直束域白名单：`kernel contribution unit command store history selection permission format render layout ui i18n collab presence plugin error perf slide doc sheet`；扫描器 `event-domain-whitelist` 拒绝既不在白名单又无 `<vendor>:` 前缀的域，并校验前缀 == 声明包的 scope（03 §3.6） | 防碰撞；前缀与发布者机械绑定 |
| 契约套件命名 | — | A `defineStoreContractSuite`、B `runDocumentStoreConformance` | **定稿：`run<Definition>Conformance`**（`runDocumentStoreConformance`、`runFormatCodecConformance`、`runRenderTargetConformance`…；由各 Definition 包 `testing/` 导出，可注入 Provider）；03/04/05/12/ADR 已统一；生命周期套件 `defineLifecycleSuite` 不受影响 | 一个名字 |
| 命令拒绝事件 | `command/rejected{reason}` | A `command/failed` 含 `PERMISSION_DENIED` 等 | **两者都保留**：`command/rejected(unitId, id, reason ∈ permission\|validation\|not-found\|readonly)` 用于管线前置阶段（①–③）拒绝；`command/failed(unitId, id, error)` 用于 handler/事务阶段（④）失败与回滚 | 与 PRD MT-12/MT-13 指标对齐；05 §10 已加 |
- **对设计线**：playground（`20-design/playground/`）是 `@cordexjs/ui-react` 的种子——M2 启动时 `components/ui/*`、`lib/utils.ts`、`hooks/use-mobile.ts`、`index.css` 迁入 ui-react，之后 playground 改依赖 workspace 的 `@cordexjs/ui-react`（全仓单一复制件，ADR-0017）；`--cordex-*` 扩展变量与 shadcn 变量的映射表（设计 09 v2.0）就是 `@cordexjs/design/theme.css` 的生成源，请与 02 §4.17 的 tokens 文件划分对齐；`--cordex-*` token 命名与多 host 页面的 `<style>` 去重约定；`ui.*` 贡献点 schema（03 §3.6）与 20-design/06 的槽位规范必须一一对应；母版视图（ML-01）需要线框：母版缩略图窗格（`MasterThumbnails`，在 `ThumbnailRail` 内；母版大缩略图 + 缩进版式缩略图，不是文字树）、占位符类型面板、主题面板、`viewMode == 'master'` 下的 ribbon 页签切换与「关闭母版视图」出口（对应 03 §3.6 的 `viewMode`/`editTargetKind` 上下文键）。
