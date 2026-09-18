# ADR-0008 不透明保留与脏部件重生成

> 状态：草稿 | 负责：架构-结构 | 更新：2026-09-15 | 依赖：charter v0.1

## 状态

提议。

## 背景

R6/D7：直接读取 pptx 并在线协同编辑，未建模部分不透明保留，导出为合法 pptx 且未修改部分**零丢失**（M1 验收：部件级 diff 零差异）。OOXML 极大（动画、SmartArt、OLE、VBA、自定义 XML、厂商扩展），任何「先建模再导出」的方案在 M1–M3 都会丢内容。现有 TS 库：pptx-viewer 声称保留但以模型为中心；`@hokkyss/pptx` 强调 AST 往返但范围有限；pptx-renderer 只读。

## 决策

三层捕获 + 脏部件重生成（算法见 04 §5）：

1. **部件级**：每个 Part 读入即 `sha256 → BlobRef`（原字节保留于 `BlobStore`）；未建模部件成为 `opaqueParts[partName] = OpaquePartRef`，导出 verbatim。
2. **节点级 / 元素级**（PRD CS-06、OF-18「元素级保留」）：已建模部件解析时，未知子元素捕获为 `OpaqueXml { xml, anchor{ after, ordinal }, namespaces }` 挂到最近已建模实体的 `extensions`；导出重生成该部件时按 XSD 子元素顺序表（`schema-order`）插回。**被触碰的元素也遵守同一规则**：编辑一个形状只改它的建模字段，它的 `extLst`/未知属性/未知子元素随 `extensions` 原样回写；同部件内未被触碰的兄弟元素、`p:timing`/`p:transition` 等不透明子树规范化后逐字节一致。
3. **属性级**：未知属性同样进入 `extensions`（属性变体）。
4. **脏追踪**：`DirtyTracker` 维护 `Path 前缀 → Part` 映射；每个事务的 `ChangeSet.touched` 标脏部件；导出时**干净部件 verbatim、脏部件重生成**。
5. **永不 verbatim 的部件**：`[Content_Types].xml`、已建模部件的 `.rels`——始终由 `PartTable` 生成，保证一致性；opaque 部件的 rels 随部件 verbatim。
6. **二进制不进 JSON/Y.Doc**：媒体、opaque 部件字节、嵌入字体全部为 `BlobRef`（内容寻址、不可变、协同无冲突）。
7. **Strict 一致性**（README A-3 与 PRD PD-03 合并裁决，暂为待决）：导入归一化已建模部件并记录 `conformance`；零编辑往返三案皆字节相同。有编辑时：推荐 **C 保持原一致性类**（脏部件经反向映射写回 Strict，干净部件 verbatim）为目标，**B 整包转 Transitional** 为自动回退（C 产物未过 Strict XSD 或反向表缺项时，诊断 `STRICT_FALLBACK_TRANSITIONAL`）；**A 混合**（脏部件 Transitional、干净 verbatim）因 PowerPoint 修复风险放弃。
8. **失败模式**：无法解析的已建模部件（畸形 XML）→ 整个部件降级为 opaque（可渲染性下降但不丢失），并发 `error` 级诊断；zip 超限 → 拒绝打开（安全）。
9. **不透明子树中的引用维护**（PRD OF-12）：删除被 `p:timing` 引用的形状时，导出前 `export/timing-refs.ts` 从该不透明子树移除对应 `spid` 引用（或整段失效的 `p:par`）；这是对不透明内容**唯一**允许的修改，且有专门测试。
10. **只读解析不透明部件是允许的**：渲染器可以读取 `Chart.partRef`/notes 部件的 XML 做只读呈现（M1 图表、备注文本），但不得据此产生第二份可编辑模型；不透明保留只约束**写回**。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 全量建模后导出（Univer 式「模型即文件」） | OOXML 覆盖不可能在 M1–M3 完成；任何缺口都是丢失 |
| 只做部件级 verbatim，不做节点级 | 改一个形状就得重生成整页 XML，页内所有未建模元素（extLst、a14/p14 扩展、动画引用）随之丢失 |
| 保留原 XML DOM 作为事实源，模型只是视图（DOM-first） | 协同与撤销必须在结构化模型上做；DOM 无法进 CRDT；双事实源（D5 违反） |
| 原字节进 Y.Doc | 撑爆协同文档；每次同步传输二进制 |
| 差分补丁（对原 XML 打 patch） | 补丁定位脆弱；与模型语义脱节 |

## 后果

- 正：M1 即可承诺「未修改零丢失」；建模范围可以渐进扩大（把某类 OpaqueXml 升级为建模字段时只需迁移）；导出成本与修改范围成正比。
- 负：模型里有 `extensions` 噪音；重生成部件的保真依赖 `schema-order` 表与编解码往返测试；同一部件内「已建模 + 不透明」混合的顺序恢复需要锚点算法（已定义）；Strict 混合包需向用户说明。

## 如何被机械验证

- 口径 = 04 §5.4（与 PRD CS-01/§4.1 合并）。`ooxml-pptx/testing/roundtrip.ts` 实现：零编辑 → 部件集合与每部件 SHA-256 相同（含 `[Content_Types].xml` 与 `.rels`；zip 元数据不计）；编辑后 → 未触碰部件字节相同 + 脏部件良构且通过 ECMA-376 XSD（`tooling/xsd/`，Transitional 与 Strict 两套）+ 规范化 diff 仅在被编辑子树 + 被编辑元素 `extensions` 全保留 + `cNvPr@id` 唯一且引用一致 + 派生部件白名单 + 删页无孤儿（CI job `fidelity-roundtrip`：M1 零编辑、M2 编辑后）。
- 元素级保留测试：对 `fixtures/pptx/features/preserve-*`（含 `extLst`/未知属性/`p:timing`）编辑同页另一元素 → 目标元素与不透明子树 c14n 逐字节一致；编辑带 `extLst` 的元素本身 → 其 `extLst` 仍在且顺序合法。
- `timing-refs.test.ts`：删除被动画引用的形状 → 导出无悬空 `spid`，XSD 通过。
- `dirty-tracker.test.ts` + 随机单形状修改测试：脏部件集合 == 预期；其它部件字节相等。
- codec 往返测试：已建模部件 `parse → generate → c14n` 与原 c14n 相等；差异计数进保真指标。
- `schema-order` 生成器单测覆盖已建模复杂类型。
- 安全：`zip-limits.test.ts`（超限拒绝）、外部关系 URL 协议白名单测试。
- 扫描器 `no-bytes-in-snapshot`：`Snapshot` 类型与 Y 映射中不得出现 `Uint8Array`/`ArrayBuffer`（只允许 `BlobRef`）。

## 关联

章程 R6、D7、§4 不透明保留/Part；01 §4.4；04 §4/§5；README A-3、A-12、C-7；参照 pptx-viewer（Strict 归一化）、pptx-renderer（ZipLimits、SafeXmlNode）、@hokkyss/pptx（AST 往返）。
