> 状态：模板 v0.1 | 负责：架构-模块（总编排） | 更新：2026-09-18；2026-09-25（矛盾收口，rulings §4.18：`cordex` 封闭八键、`publicEntry` 子路径口径、扫描器名与 CI job 名口径）；2026-09-25（§4.19）；2026-10-08（design-language-v3 第 1 批收口：§5、§9 注明测试文件迁入 §4 / §5 的时机按 rulings §4.25 TB-48——G6 落地前由模块线一次性迁入，此前新增测试先登记 §9（DP-8）） | 依赖：40-modules/00-module-map.md、charter v0.2 §4–§5、30-architecture 02/03、09-type-discipline

# 模块设计文档模板（阶段二每个模块必须遵守）

> 用法：复制本文件为 `docs/40-modules/<NN>-<slug>.md`，把每个"（…）"替换为实内容；标题层级与编号不得改动、不得省略；UI / 基础设施类模块的 §2 按括号内说明改写标题但保留编号。粒度要求：**目录树完整到文件，§5 逐文件一行**，不允许"其它工具"之类笼统条目。

---

> 状态：草稿 v0.1 | 负责：架构-模块（阶段二） | 更新：YYYY-MM-DD | 依赖：00-module-map.md M-xx、charter §5.2 对应包行、30-architecture 02 §4.x、ADR-xxxx

# NN 〈模块名〉（限界上下文 BC-xx〈上下文名〉）

## 0. 一页总览

| 项 | 值 |
|---|---|
| 职责一句话 | （…） |
| 覆盖的上下文 | BC-xx、BC-yy |
| 承载包 / 目录 | `@cordexjs/<pkg>`（层 Lx / 层带 V-x，秩 nn，iso\|dom\|node）、`apps/<x>/src/<dir>` |
| cordis 形态 | plugin \| definition \| provider \| bundle \| library \| host |
| 运行位置 | 浏览器 \| 服务端 \| 两端 |
| 上游（依赖） | M-xx（服务 / 类型） |
| 下游（被依赖） | M-yy |
| 对外服务 | `ctx.<name>`… |
| 贡献点 | 提供：… ；消费：… |
| doc / sheet 通用性 | generic \| parametrized \| vertical |
| 批次 | 1 \| 2 \| 3 |

## 1. 限界上下文与边界

### 1.1 职责与非职责
（做什么；明确不做什么并指向负责的模块）

### 1.2 通用语言
（引用 charter §4 的术语条目；本上下文特有术语表：术语 / 定义 / 对应类型名）

### 1.3 上下文映射
（与每个相邻上下文的关系类型〔Shared Kernel · Customer–Supplier · Conformist · ACL · Open Host Service · Published Language〕、防腐层落点（文件）、传递的契约）

## 2. 领域模型
（**2026-09-25 起（rulings §4.19）**：领域模型与运行时设计——状态机、时序、行为规则、错误与重试、遥测口径——见 50-frontend / 60-backend 对应文件，本节**只列链接与本包接口签名**（类型名、签名草案、所在文件），不复写行为；与 50/60 冲突时以 50/60 为准并在 §12 登记。UI / 基础设施类模块：2.1 视图模型与状态、2.2 输入管线与适配器契约、2.3 纯函数、2.4 事件、2.5 外部契约、2.6 命令；标题按此替换，编号保留）

> 事实源：（列出本模块对应的 50/xx 或 60/xx 文件与节号，如「状态机见 50/07 §3，本节只登记类型落点」）

### 2.1 聚合与实体
（聚合根、实体、ID 品牌类型的类型签名与所在文件；不变量与 CRDT 合并语义写一句话并链接 50/60 对应节）

### 2.2 值对象
（名称 / 字段 / 校验 schema（Standard Schema）/ 所在文件）

### 2.3 领域服务
（纯函数清单：签名草案 / 所在文件 / 是否两端共用；行为说明链接 50/60）

### 2.4 领域事件
（`<域>/<动作>` / 载荷类型 / 发布者文件；订阅者与遥测口径链接 50/15 或 60 对应文件；**事件域须在 charter §5.5 白名单内，否则标「新增建议」**）

### 2.5 仓储 / 存储契约
（Definition 名与 id、方法签名草案、默认 Provider、契约套件 `run<Definition>Conformance` 与 kit 文件（决策 T-KITS）；套件断言见 70/02）

### 2.6 应用服务与命令
（Command / Mutation 清单：id、参数 schema、权限能力位、所在文件；事务边界、逆操作与交互行为链接 50/04 或 60 对应文件）

## 3. cordis 插件定义

| 项 | 值 |
|---|---|
| 插件名 / `name` | （…） |
| `inject`（必需 / 可选） | （…） |
| `provide` | （…） |
| 贡献点：提供 | id / 载荷 schema / 校验规则 |
| 贡献点：消费 | id / 消费方式（ctx.contributions 查询时机） |
| 事件：发布 / 订阅 | （…） |
| 配置 schema | （Standard Schema 字段表） |
| 生命周期 | ready / dispose；UnitScope 内外；PENDING 依赖 |
| Manifest 片段 | （JSON 片段） |

## 4. 目录树（完整到文件）

```text
packages/<pkg>/
├── package.json              # cordex（封闭八键）: { layer, iso, bundle?, role, implements?, compositionRoot?, publicEntry, stability? }
├── tsconfig.json
├── src/
│   ├── index.ts              # 公共 API 面（§6）
│   ├── plugin.ts             # cordis 插件入口（§3）
│   ├── domain/               # 聚合 / 值对象 / 领域服务 / 领域事件
│   ├── application/          # 命令 / 应用服务 / 查询
│   ├── infrastructure/       # Provider / 适配器 / 编解码
│   ├── interface/            # 对外接口（UI 模块用 ui/）
│   └── testing/              # 契约套件与夹具（子路径导出 ./testing）
└── tests/
```
（每个目录一句职责；多包模块每个包一棵树；`apps/*` 的目录同样列出）

## 5. 文件职责表

| 文件 | 职责 | 主要导出 | 允许依赖 | 备注 |
|---|---|---|---|---|
| `src/index.ts` | （…） | （…） | （…） | （…） |

（逐文件一行；与 §4 一一对应；测试文件暂放 §9：rulings §4.25 DP-8 要求测试文件也逐个登记进 §4 与 §5，TB-48 定为在 G6（`m0-governance-gates`）落地前由模块线一次性迁入、各模块同一口径，在此之前文档阶段新增的测试先登记在 §9）

## 6. 对外 API 面
（`index.ts` 导出清单：类型 / 值；子路径导出——须与 `package.json#exports` 及 `cordex.publicEntry` 逐一相等，跨包只能 import 这里登记的子路径，禁 `./*` 通配与 `src`/`lib` 深引用；api-extractor 稳定级；关键类型契约草案 TS 代码块 ≤ 40 行）

## 7. 前后端与运行时
（浏览器 / Node / 两端；同一 Definition 的不同 Provider；`apps/web` / `apps/server` 的接入文件路径；进程间契约经 `@cordexjs/protocol` 的哪些 schema）

## 8. doc / sheet 扩展缝
（generic / parametrized / vertical 标注到文件；扩展为 doc / sheet 时新增或替换的文件清单；"必须零改动"的文件清单；对应 12 §3 的参数化点）

## 9. 测试布局

（**2026-09-25 起（rulings §4.19、决策 T-NAMING）**：本节只列**测试文件清单**（路径完整到文件，与 §4 目录树一致）；测试场景、断言、夹具与阈值见 [70-testing](../70-testing/README.md) 对应文件，本节不复写。**2026-10-08（rulings §4.25 TB-48）**：本节清单在 G6 落地前由模块线一次性迁入 §4 目录树与 §5 文件表（DP-8），迁入前新增的测试先登记在这里；浏览器 e2e 一律登记在 `apps/web/e2e/`（40/11 §9，70/06 §3.1））

```text
packages/<pkg>/src/
├── __tests__/
│   ├── <name>.test.ts            # 同位单测与组件测试
│   ├── lifecycle.test.ts         # defineLifecycleSuite（plugin 角色包必有）
│   └── <name>.type-test.ts       # 类型测试（test-typecheck job）
└── testing/
    └── conformance/kit.ts        # run<Definition>Conformance 套件工厂（Definition 包，决策 T-KITS）
apps/server/test/integration/<area>/<name>.int-spec.ts   # 容器集成（服务端模块）
apps/server/test/e2e/<name>.e2e-spec.ts                  # 服务端 API e2e
test/<suite>/<name>.test.ts                              # 仓库根跨包套件（如 collab-sim、preset-blind）
```
（每个文件一行对应到 70 的哪一节、由哪个 CI 步骤收集（步骤名见 70/12 §2）；覆盖率与性能预算只引用 70/01 §9、70/09，不在此列数值）

## 10. 机械约束
（depcruise 规则 id、eslint `no-restricted-imports/globals` 条目、扫描器检查项、`package.json#cordex` 字段值、api-extractor 报告；引用 09-type-discipline 规则编号。写成「扫描器 `x`」的名字必须能在 09-type-discipline/06 或 08 §11 查到——不在十四个扫描器之列的检查写成对应的扫描器子规则、lint 规则或测试断言；CI 只引用 09-07 §3 的 13 个 job 名，其余检查写成某个 job 的步骤，步骤名以 70/12 §2 与 `tooling/ci/steps.json` 为准）

## 11. 里程碑与实施顺序
（M0 骨架 / M1 / M2 / M3 各建哪些文件；首个可运行切片及其验收命令）

## 12. 与现有文档的差异与追加建议
（对 02 §4.x / 03 / 04–08 / ADR 的差异逐条；需要章程或 ADR 修订的项，不得擅自更名。**条目编号在本文件内从 1 起；跨文档引用一律写 `M-xx/G-n`，不使用全局连号**，见 `14-cross-module-review.md` §1 C-29）

## 13. 未决问题
（编号 / 问题 / 推荐默认值 / 影响范围。**条目编号在本文件内从 1 起；跨文档引用一律写 `M-xx/Q-n`**，不使用 `Q-01`/`Q1`/`Q-05-1` 等历史写法，见 `14-cross-module-review.md` §1 C-29）
