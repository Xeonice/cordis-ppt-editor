> 状态：草稿 | 负责：架构-类型治理 | 更新：2026-09-14 | 依赖：charter v0.1

# ADR-0046：TS 7 原生编译器（tsgo）评估计划

## 状态

提议中（M0 蓝图阶段）——**评估结论：暂不采用，记录再评估触发条件**，非"最终否决"。

## 背景

Microsoft 把 TypeScript 编译器用 Go 重写（原生编译器，早期以 `tsgo`/`@typescript/native-preview` 为代号），目标是数量级的性能提升。截至本 ADR 撰写时（2026-09-14）检索到的公开信息：TypeScript 7.0 已于 2026-07-08 正式发布（RC 于 2026-06-18 发布），命令名回归为标准的 `tsc`（不再是预览期的 `tsgo` 可执行文件名），npm 包 `typescript@7.0.2` 为当前最新稳定版；性能提升方面，官方给出"通常比 TypeScript 6.0 快约 10 倍"的量级描述，第三方在 VS Code 代码库上的实测显示全量类型检查从 125.7 秒（TS 6）降到 10.6 秒（TS 7），约 11.9 倍。

**关键限制，直接决定本 ADR 结论**：TypeScript 7.0 **没有稳定的可编程 API**（programmatic API）。这意味着依赖"以编程方式调用 TS 编译器/类型检查器"的下游工具——包括 typescript-eslint（本方案 [02](../09-type-discipline/02-lint-rules.md) 的类型感知规则的运行基础）、ts-morph（本方案 [06](../09-type-discipline/06-scanners.md) 全部扫描器读取/分析源码 AST 与类型信息的基础库）、ts-jest——**均无法运行在 TS 7 原生编译器之上**。该可编程 API 预计在 TypeScript 7.1 才会提供，据报道"还需要数月"（截至 2026 年年中的估计）。

## 决策

1. **现阶段（M0-M2 预期）不采用** tsgo/TS 7 原生编译器作为 `typecheck`（[07](../09-type-discipline/07-hooks-and-ci.md#3-ci-工作流矩阵)）或本地开发的日常类型检查工具。章程 D9 锁定的"TS ≥ 5.9"经典 `tsc` 语义链路（本方案 [01](../09-type-discipline/01-tsconfig-baseline.md) 的全部配置基于此）保持不变，本 ADR 不修改 D9。
2. **原因是直接的技术阻塞，不是保守偏好**：本方案的机械约束机制里，[02](../09-type-discipline/02-lint-rules.md) 的类型感知 ESLint 规则依赖 typescript-eslint，[06](../09-type-discipline/06-scanners.md) 的全部扫描器依赖 ts-morph 做 AST/类型分析——这两个依赖目前都无法运行在 TS 7 原生编译器上。切换到 tsgo 会让 R7 的核心机械化手段（自定义规则、扫描器）直接失效，这与"引入 tsgo"想要达成的"更快的开发反馈循环"目标自相矛盾——更快的类型检查、却更慢/更弱的架构治理，不是本项目想要的取舍。
3. **设立明确的再评估触发条件**（而非无限期搁置）：
   - TypeScript 7.1（或后续版本）的可编程 API 正式稳定发布；**且**
   - typescript-eslint 官方确认支持基于该 API 的类型感知 lint（或提供等效的类型信息获取路径）；**且**
   - ts-morph（或本方案愿意迁移到的等效 AST/类型分析库）确认兼容。
   三个条件**全部**满足后，由架构-类型治理条线发起一次独立的迁移评估（预计工作量：CI `typecheck` job 的可执行文件切换 + [01§2.4](../09-type-discipline/01-tsconfig-baseline.md#24-模块系统与解析) 里预留的 `module`/`moduleResolution` 解析行为复核），届时新增本文档 §「迁移路径」章节，不追溯修改本 ADR 的历史决策记录。
4. **不阻止**个别开发者在本地**额外**、**非强制**地用 tsgo 做快速的"语法/明显类型错误"预检（不作为任何门禁的替代），因为这不影响 CI 真源，风险可控；但不得把这类本地预检结果当作"类型检查已通过"的证据提交 PR。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 立即全面切换到 tsgo，放弃 typescript-eslint 类型感知规则与 ts-morph 扫描器，改用 tsgo 自带的诊断能力 | tsgo 原生诊断不能替代本方案的自定义架构规则（`oce/*`）与八个自研扫描器——这些是本项目 R7 的核心资产，不是"随便一个类型检查器"都能提供的能力；为了编译速度放弃这些，本末倒置 |
| 只在本地开发用 tsgo 加速反馈，CI 仍用经典 tsc | 会造成"本地看起来没问题，CI 才报错"的体验落差（两个编译器在早期版本上不保证诊断完全一致），且仍不能让本地的类型感知 lint/扫描器提速（它们仍需经典 tsc 提供的类型信息），收益有限、风险（诊断不一致）不小，暂不采纳；有意愿尝试的开发者按决策 4 的范围自行使用 |
| 完全不设再评估触发条件，长期搁置 | 与本方案"记录待决事项并标注决策人/触发条件"的一贯做法不一致；tsgo 的性能收益是真实且显著的（11.9x 实测），一旦生态兼容性问题解决，重新评估的价值很高，不应该被"当前不可行"埋没成"以后也不考虑" |

## 后果

**正面**：避免在生态尚未就绪时切换导致治理能力（[02](../09-type-discipline/02-lint-rules.md)/[06](../09-type-discipline/06-scanners.md)）失效；再评估触发条件明确、可验证，未来切换不需要重新做一遍背景调研。

**负面**：暂时无法享受 tsgo 的编译速度提升；随着包数增长（M5），经典 `tsc --build` 的全量类型检查耗时可能成为 CI 时长的主要贡献者之一，缓解手段依赖 [07§5](../09-type-discipline/07-hooks-and-ci.md#5-缓存策略) 的 Turborepo 增量缓存而非编译器本身提速，需持续关注该缓存策略在真实规模下是否足够。

## 如何被机械验证

本 ADR 的决策本身（"不采用"）不是一个需要机械验证的正面声明；需要机械验证的是**决策的边界不被意外突破**：CI 配置（[07](../09-type-discipline/07-hooks-and-ci.md)）中 `typecheck`/`lint`/`scanners` 等 job 使用的编译器可执行文件名与版本，作为 CI 环境固化的一部分（非本子线直接管辖的具体流水线文件，但 `policy-check` 的工具版本断言可覆盖——待与 CI 环境配置的实际落点确认后补充为矩阵行）。

## 关联

- 章程 D9（TS ≥ 5.9，经典 tsc 语义）；[01-tsconfig-baseline.md §7](../09-type-discipline/01-tsconfig-baseline.md#7-ts-7-原生编译器tsgo评估位置)。
- [ADR-0045](./0045-isolated-declarations.md)（`isolatedDeclarations` 与单文件转译工具链的关系，是未来评估 tsgo 时需要重新核对的兼容点）。

---

Sources（检索于 2026-09-14，作为本 ADR「背景」章节数据依据）：
- [TypeScript 7.0 RC Moves Microsoft's Go Rewrite Into the Mainline Compiler — Visual Studio Magazine](https://visualstudiomagazine.com/articles/2026/06/22/typescript-7-0-rc-moves-microsofts-go-rewrite-into-the-mainline-compiler.aspx)
- [GitHub — microsoft/typescript-go: Staging repo for development of native port of TypeScript](https://github.com/microsoft/typescript-go)
- [TypeScript 7.0 RC: The Go-Native Compiler Has Landed — Digital Applied](https://www.digitalapplied.com/blog/typescript-7-0-rc-go-native-compiler-2026-upgrade-guide)
- [TypeScript 7 Is Here: The Go Compiler Rewrite — Dennis Morello](https://morello.dev/blog/typescript-7-is-here)
