> 状态：草稿 | 负责：架构-类型治理 | 更新：2026-09-14；2026-09-26（§4.20）（TX-11：scan-manifest 锚点改为 06 §6 现行标题） | 依赖：charter v0.1

# ADR-0040：类型预算与 Ratchet

## 状态

提议中（M0 蓝图阶段）。

## 背景

R7 要求"强类型规约"，理想状态是生产代码里 `any`/`as`/`!`/`@ts-ignore` 的数量恒为零。但真实代码库（尤其是本项目要处理的 OOXML 这类结构不透明的外部输入、与未完整类型化的第三方库交互的场景）在某些角落短期内确实做不到零逃逸。如果规则只有"禁止"没有"如何在做不到时仍然可控"，团队的实际反应历史上只有两种：要么大量使用行内禁用注释（不受任何统计，等于规则名存实亡），要么干脆放弃这条规则。[lessons A16](../../00-charter/reference-univer-lessons.md) 正是这一失败模式的实证：Univer 配置了复杂度门禁，但 CI 用 `--quiet` 让 `warn` 全部失效，458 处豁免从未被真正治理过——门禁"存在"但从未"生效"。

章程 §6.2 已将"类型预算与 ratchet"列为待 ADR 条目（"每包 `any`/`as`/`!`/`@ts-*` 计数预算只减不增；基线值与例外流程"），本 ADR 是该条目的正式决议。

## 决策

1. 预算记录在 `tooling/policy/budgets.json`，键为 `<package>:<src|test>:<kind>`（`kind` ∈ `any`/`as`/`non-null`/`angle-assertion`/`ts-expect-error-undescribed`/`cordex-allow-<rule>` 等，具体口径见 [06-scanners.md §2](../09-type-discipline/06-scanners.md#2-scan-type-escapes)），值为非负整数上限。
2. **M0 阶段基线**：仓库当前无生产代码，全部键的基线值为 **0**。新增包默认继承基线 0，不预先为"可能需要"的场景开放非零额度。
3. 任何 PR 若使某个键的实际计数超过当前预算，CI 失败；若同时需要把预算本身上调，必须遵循 §「例外流程」。
4. **例外流程**：在 issue 追踪系统开一条 issue，写明（a）为什么当前做不到该键为其原有预算值，（b）计划的收敛路径或"暂不收敛"的技术原因（如第三方库声明文件缺陷，需等待上游修复）。PR 描述链接该 issue，且 PR 里对应的 `cordex-allow`/`@ts-expect-error` 注释同样链接该 issue（[02§3](../09-type-discipline/02-lint-rules.md#3-禁用清单--具体规则映射) 的格式要求）。评审者认可后随 PR 一并合入 `budgets.json` 的上调——**不设置额外的审批层**（不需要总编排或架构组另行批准），保持例外流程轻量，避免流程本身成为"绕开它"的诱因。
5. 预算数值下降始终允许、始终鼓励；[06 scan-type-escapes](../09-type-discipline/06-scanners.md#2-scan-type-escapes) 检测到"实际用量低于预算"时在报告中提示可下调，但**不自动改写**该文件（预算下调本身是一个值得被看见的 PR，不应作为构建副产物静默发生）。
6. 预算按 `src`/`test` 分离统计：测试代码历史上确有更多构造"故意错误类型"的合理需求（fixture、负向测试本身），但依然记账、依然只减不增——不是无限豁免，只是初始基线口径可以不同（同样从 0 起步，按需走例外流程）。
7. **机制可复用，不专属于类型逃逸计数**：本 ADR 决策的核心是"预算文件 + 只减不增 + 轻量例外流程"这一**模式**，不是"只能管 `any`/`as` 计数"。响应架构-运行时/架构-结构条线关于保真度/性能阈值与垂直束构建产物体积也应有 ratchet 治理的诉求，`budgets.json` 同一文件、同一比对机制已扩展出 `bundle-size-bytes` 键（[06 scan-bundle-budget](../09-type-discipline/06-scanners.md#14-scan-bundle-budget)）；保真度/渲染性能类阈值若由架构-运行时条线选择采用同一模式，应复用本 ADR 的例外流程约定（issue 链接 + PR 描述），不需要另立一套治理机制——类型治理条线只对"机制本身"负责，具体阈值的所有权与取值仍归内容 owner。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 全局单一预算（不分包） | 无法定位到具体包的问题严重度；一个包会很快用光额度，且激励扭曲——团队会倾向于把逃逸塞进"预算充裕"的包而非按实际需要处理 |
| 只统计趋势、不设硬上限（fitness function 仪表盘，不阻断 CI） | 与「先失败」原则冲突；是 Univer"声明了复杂度门禁但因 `--quiet`/`warn` 形同虚设"的同款失败模式，本质上没有解决问题，只是把观测和阻断解耦，观测不产生后果就不是治理 |
| 完全零容忍，不设任何预算/豁免机制 | 与真实代码库渐进采用的现实冲突；历史经验（包括 Univer 报告本身的证据）表明，规则一旦在个别场景下"完全没有出路"，团队会转向不受任何统计的手段（大范围行内禁用、绕过 lint 配置本身）来绕过它，结果比"有一个显式、可追溯的豁免机制"更糟 |

## 后果

**正面**：技术债的每一次增加都是一次显式的、reviewer 可见的、可追溯到 issue 的决定，不是悄悄发生的；预算文件本身是仓库当前"类型逃逸密度"的实时快照，任何人无需额外工具即可读懂现状。

**负面**：`budgets.json` 是一个高频被多个并发 PR 触碰的文件，合并冲突会比普通配置文件更常见（多个 PR 同时把某个键从 3 改到不同的新值）；团队需要适应"这是预期内的摩擦，解决办法是合并冲突本身，而不是绕过预算机制"。

## 如何被机械验证

- [06 scan-type-escapes](../09-type-discipline/06-scanners.md#2-scan-type-escapes)：统计实际逃逸数并与 `budgets.json` 比对。
- CI（`scanners` job）对比 PR 分支与 `main` 分支的 `budgets.json`，任何数值上升且无例外流程记录即失败。
- [06 scan-manifest](../09-type-discipline/06-scanners.md#6-scan-manifest) 对类型专用依赖误置的预算走同一套 ratchet 机制（[lessons A34](../../00-charter/reference-univer-lessons.md)）。

## 关联

- 章程 §6.2「ADR-0040 类型预算与 ratchet」条目本身；R7。
- [lessons A16](../../00-charter/reference-univer-lessons.md)（`--quiet` 使门禁形同虚设）。
- [02-lint-rules.md](../09-type-discipline/02-lint-rules.md) §3/§4（逃逸禁用清单与自定义规则的豁免格式）、[06-scanners.md](../09-type-discipline/06-scanners.md) §2/§9（预算文件的读写口径）、[08-policy-enforcement-matrix.md](../09-type-discipline/08-policy-enforcement-matrix.md)（豁免方式列的"cordex-allow（预算制）"取值均指向本 ADR）。
