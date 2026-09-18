# ADR-0014 稳定 id：CRDT 友好 `NodeId` 与 OOXML id 的双向映射

> 状态：草稿 | 负责：架构-结构 | 更新：2026-09-14 | 依赖：charter v0.1

## 状态

提议（`NodeId` 生成器形态见 README A-5）。

## 背景

OOXML 的 id 是**部件局部**的：`p:cNvPr/@id` 是 uint32、每个 slide 部件内唯一；`p:sldId/@id` 在 256..2147483647；`a16:creationId` 是 PowerPoint 用于 Morph/协作匹配的 GUID（可缺失）。协同编辑需要**全局唯一、离线可生成、不冲突**的 id 作为实体表键与评论锚点；复制粘贴跨文档也不应冲突。pptx-viewer 的 Morph 匹配顺序（`!!` 命名 → `creationId` → `cNvPr/@id` → 类型/位置）说明 OOXML 侧 id 语义值得保留。

## 决策

1. **模型层 id**：`NodeId`（`@oce/shared/ids`），品牌细分 `SlideId/ShapeId/MasterId/LayoutId/ThemeId/MediaId/NotesId`；生成 `newNodeId()`（UUIDv7：时间有序，利于 Y.Map 键局部性与日志；A-5 可改为 26 字符 base32）。导入时为每个实体分配；新建时同。
2. **OOXML id 作为数据保留**：`Shape.ooxml = { cNvPrId?: number; creationId?: string }`、`Slide.ooxml = { sldId?: number }`。
3. **导入映射**：`OoxmlIdMap`（部件名 + cNvPrId → NodeId）用于解析部件内引用（连接线 `stCxn/@id`、动画 `spid`、评论锚点）；缺失/重复 id → 分配并发 `ID_COLLISION_REPAIRED` 诊断（warning）。
4. **导出回写**：干净部件 verbatim（id 不变）；脏部件：已有 `cNvPrId` 复用；新形状分配部件内未占用的最小 uint（> 现有最大值，避免与不透明子树中的引用碰撞）；`sldId` 同理；rels `rId` 每次重生成。
5. **`creationId`**：原值往返；新建形状**不**伪造（PowerPoint 语义）；若产品需要 Morph 兼容（PD 未列），可作为可选命令参数显式生成。
6. **顺序不是 id**：`order: FracKey` 与 id 分离（ADR-0032）。
7. **评论/协同锚点**引用 `NodeId`；删除实体后锚点进入「脱离」态（PRD `comment/orphaned`），不复用 id。
8. **粘贴跨文档**：粘贴时**重新生成** `NodeId`（源 id 留在 `meta.copiedFrom` 便于追溯）；`cNvPrId` 清空由导出分配。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 直接用 `cNvPr/@id` 作模型 id | 部件局部、uint、并发新建必冲突；跨部件不唯一 |
| 用 `creationId` 作模型 id | 常缺失；PowerPoint 语义（Morph）不应被我们的实体身份绑架 |
| 顺序编号（自增） | 离线/多端冲突 |
| 随机 UUIDv4 | 可用，但无时间局部性；v7 更利于排序与调试 |
| 复合 id（partName + cNvPrId） | 移动形状跨页/进出组时 id 变化，破坏锚点与 CRDT 身份 |

## 后果

- 正：实体身份跨部件、跨设备、跨复制稳定；OOXML id 语义无损往返；冲突可诊断可修复。
- 负：每个实体多两个字段；id 长度 36 字符占 Y.Doc 体积（A-5 评估）；导出需 id 分配步骤（简单）。

## 如何被机械验证

- `ooxml-pptx/__tests__/ids.test.ts`：往返后 `cNvPrId`/`creationId`/`sldId` 不变；新增形状 id 唯一且不与不透明子树引用碰撞（扫描 `p:timing` 的 `spid`）；重复 id 语料修复并诊断。
- `shared/__tests__/ids.test.ts`：`newNodeId` 单调（同毫秒内递增）、格式校验。
- model-slide property test：任意 Mutation 序列后实体表键唯一、`parentId` 无环。
- 扫描器 `no-numeric-model-ids`：`model-*` 中实体表键类型必须为 `NodeId` 品牌。

## 关联

章程 R6、§4 Unit；04 §9；ADR-0008、ADR-0032；参照 pptx-viewer（Morph 匹配顺序）。
