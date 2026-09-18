> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-14 | 依赖：charter v0.1

# ADR-0020 CRDT 选型：Yjs（Loro 为已评估替代）

## 状态

提议（默认值，用户可否决；章程 §6.2 / §10 Q3）。

## 背景

- 章程 D5：协同模式下 CRDT 文档是唯一事实源；D4：Mutation 是唯一修改途径，逆操作由 Store 推导。
- 必须回答三件事：形状/页顺序的并发移动语义；富文本（Paragraph/Run）映射；WASM 体积与加载。
- 候选：**Yjs**（JS 实现，YATA；周下载约 920K；配套 y-protocols/y-websocket/y-indexeddb/y-prosemirror/Hocuspocus 成熟）与 **Loro**（Rust/WASM；Fugue 富文本、原生 movable tree/list、性能领先；生态年轻，JS 绑定与 provider 生态少）。
- 参考：`ChristopherVR/pptx-viewer` 已用 Yjs 做 pptx 协同雏形；Univer 协同为闭源 OT（A13），无可借鉴实现。

## 决策

1. 采用 **Yjs**（`yjs` + `y-protocols`），仅由 `@oce/store-yjs` / `@oce/collab-yjs` / `@oce/server-collab` 引入（章程 §5.3 规则 4）。
2. **移动语义**：不用 `Y.Array` 的删除+插入，不等待未发布的 y-move；实体放 `Y.Map<id, Y.Map>`，顺序用实体属性上的 **fractional index**（ADR-0032）。并发移动 = 单键 LWW，无重复无丢失；跨父移动（进出组）= `parentId` LWW + 环修复规则（06 §8 #5）。
3. **富文本**：`Y.XmlFragment`（`<p>` 元素 + 带属性 `Y.XmlText`，embed 表示 br/fld/opaque），理由见 06 §1.4。
4. **Loro 作为已评估替代**：保持 `DocumentStore` 原语集（06 §1.2）与 CRDT 无关；如未来切换，新增 `@oce/store-loro`/`@oce/collab-loro` Provider，Definition 与 Consumer 不变（章程 §5.4「可替换为 store-loro」）。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| Loro | 生态与生产验证不足（provider、IndexedDB 持久化、社区工具少）；WASM 约 1–2 MB（gzip 后数百 KB）需异步加载并影响首屏；Rust 侧 bug 无法在 TS 内修复；团队技能。其 movable tree 对我们有吸引力，但 fractional index 已能满足 Q5 规模下的语义需求 |
| Automerge | 性能与体积历史上弱于 Yjs；富文本与 XML 结构支持晚于 Yjs；provider 生态更小 |
| 自研 OT（Univer 路线） | 需要服务端 transform 与全序，离线/多实例复杂；Univer 该部分闭源（A13）；违背「开放 Provider」原则 |
| Yjs + y-move | 未发布/不稳定 |

## 后果

正面：生产验证充分；y-protocols 让服务端逻辑简单（无 transform）；UndoManager 按 origin 满足 D4；RelativePosition 直接服务光标/评论锚点；y-prosemirror 等可复用。

负面 / 代价：
- Yjs 删除留下结构元数据（GC 后仍占空间）：需要 `oce_ydoc_structs` 监控与 epoch 机制（06 §9.4）。
- 移动语义靠 fractional index 而非原生 move：需要键长治理（ADR-0032）与环修复。
- 富文本分段/合段是「删+插」：并发格式化落在被移动文本上会丢失（06 §8 #8）。
- `Y.snapshot` 需 `gc:false`，我们放弃它改用服务端完整状态快照（ADR-0025）。
- 切换到 Loro 的成本估计：store-yjs（~3–4k 行）与 collab-yjs（~2k 行）重写 + server-collab 持久化编码切换 + 全部 conformance/fuzz 复跑；Definition/Consumer/UI 不变。**触发重评估条件**：Loro 发布 1.x 稳定 JS API 且有生产级 provider；或我们的规模需求超过 Q5（≥ 1000 页、≥ 100 并发）。

## 补充（v0.2）：有序实体的移动语义（`StoreOp` 无 `move`）、富文本映射结论、WASM 体积、CO-08 收敛表

> 回答架构 README A-1 / 04 §10「移动语义进 ADR-0020」与 PRD CO-08 的依赖。总编排最终裁决：`StoreOp` 为 5 原语 `set/delete/insert/remove/text`，**无 `move`**。

### A. 有序列表的并发移动（`StoreOp` 5 原语 `set/delete/insert/remove/text`，04 §2.3；移动 = `set` order 键）

| 列表 | Snapshot 形态（04，A-9） | store-memory | store-yjs（本 ADR） |
|---|---|---|---|
| 页序（`slides` 实体表） | 每 slide 实体保留 `order: FracKey`（ADR-0013 第 7 条，不转数组） | 同一键模型：按 `(order, id)` 排序的读视图；移动 = `set` order 键 | 键写入 Y.Map 单键 LWW（`set(slides/<id>/order, key)`，键由命令层算出）：一份实体、一个位置、全序 `(order, id)` |
| `grpSp.childIds` / spTree z 序 | `ShapeId[]` | 同上 | 子形状 `parentId` + `z: FracKey`；跨组移动 = `parentId` 写 + 新 `z`；父子环由修复规则消除 |
| `tbl.rows` / `row.cells` | 实体数组 | 同上 | `order` 键；并发插行/插列都保留 |
| `txBody.paragraphs` | 段落数组 | 同上 | `Y.XmlFragment` 子元素；段落移动 = `remove` + `insert`（唯一的删除+插入式移动，06 §18.1） |
| 原子数组（色标、路径命令、`gridCol`） | 值数组 | 整体替换 | 整体 `set`（LWW） |

**弃用 `move` 原语的原因**（总编排裁决）：有身份实体的顺序已由 `order: FracKey` 承载，移动只是 `set` 一个字段；原子数组的移动极少见且 `Y.Array` 无原生 move，`remove` + `insert` 即可，其并发重复的已知风险由幂等规则与 rekey 兜底。

并发结果矩阵（写进 `runDocumentStoreConformance` 协同分节；memory 与 yjs 在「双客户端同步」模式下结果必须相同）：
- 同一实体两处并发移动（`set` order）→ LWW（Yjs 时钟 + clientID），两端一致，无重复。
- 并发 `insert` 同一间隙 → 两者都在，顺序由 `(order, id)` 决定，两端一致。
- 移动（`set` order）与并发 `delete` 同一实体 → 删除胜。
- 移动（`set` order）与并发修改同一实体其他属性 → 都保留。
- 段落移动（`remove` + `insert`）与并发段落移动 → 可能两份同 `id` 段落 → 修复规则保留位置靠前者（确定性）。
- 键由命令层经 `@oce/shared/order` 计算，Mutation 携带最终键，`lower()` 与 Store 都不解析下标，CRDT 不携带下标（06 I4；ADR-0032 第 7 条）。
- 协同分节新增两条用例：「并发同位插入按 `(order, id)` 全序一致」「rekey 后顺序不变」。

### B. 富文本映射结论

`TextBody` = `Y.XmlFragment`；每 `a:p` = `Y.XmlElement('p')`（段属性为元素属性）；段内 runs 折叠为一个 `Y.XmlText`，`rPr` 为属性区间，`a:br`/`a:fld`/未建模内容为 embed。04 的 `text` op（`TextDelta`，与 Y.Text delta 同形）作用于**段落级** `Y.XmlText`，memory/yjs 两端 delta 语义一致（契约套件断言）。放弃 `Y.Array<Y.Map>`（run 数组）：并发编辑同一 run 内字符无法合并，分裂 run 需删除+插入两个实体；放弃 `Y.Text + '\n' 携带段属性`：段属性寄生在换行字符上，分/合段时漂移。

### C. WASM 体积

Yjs：纯 JS，`yjs + y-protocols + lib0` ≈ 60–80 KB gzip，在 PRD NF-01 1.5「协同增量 ≤ 200 KB」内。Loro：WASM 约 1–2 MB（gzip 数百 KB），需异步加载且须在首屏前完成初始化 → 超出协同增量预算，是放弃的量化理由之一。

### D. PRD CO-08 逐行收敛结果

| CO-08 场景 | 原语层机制 | 收敛结果 | 提示来源（`collab/soft-conflict{type}`） |
|---|---|---|---|
| 同一文本框不同位置 | 段落 `Y.XmlText` YATA | 两处都保留 | – |
| 同一文本框同一位置 | YATA 以 clientID 定序 | 两段相邻、顺序确定、两端一致 | presence `caret`/`editing`（预防性「X 也在编辑」）；`text-same-pos` |
| A/B 同时移动同一形状 | `xfrm.off.*` 键级 LWW | 后写者胜 | 本地 60 s 内写过该键且被远端覆盖 → `prop-lww` + 撤销按钮 |
| A 删元素，B 编辑其文本 | delete-wins | 删除胜 | B 端 `removed ∩ 近期本地事务` → `delete-vs-edit` + 「恢复元素（含我的编辑）」（新 id 事务） |
| A 删页，B 在页内新增 | delete-wins | 删除胜 | 同上，粒度为页 |
| 两人同时重排页 | 每页 `order` 键 LWW | 无重复无丢页；顺序确定 | 缩略图栏动画；`reorder` |
| A 组合，B 编辑子元素 | 组合 = 新 grpSp 实体 + 子 `parentId` 写；B 改子元素其他键 | 两者都保留 | – |
| A 取消组合，B 移动组合 | 取消 = 删 grpSp + 子 `parentId=null` + 组变换烤进子 `xfrm`；B 写已删 grpSp 的 `xfrm` 落空 | 取消组合胜；子元素保持视觉位置 | – |
| 同页版式并发更换 | `layoutId` LWW | 后写者胜 | `prop-lww` |
| A 解决线程，B 回复 | 评论为 ResourceHook 实体（ADR-0031 v0.2）：`resolved` 键与新回复实体独立 | 回复保留且线程已解决 | 面板「已解决线程有新回复」 |
| 同时插入图片 | 媒体内容寻址（sha256）；部件名在导出时由 MediaId 生成 | 不会同名 | – |

## 如何被机械验证

- `dependency-cruiser`：`yjs`/`y-protocols`/`lib0` 只允许出现在三包（09-03）。
- api-extractor：`@oce/store-yjs` 与 `@oce/collab-yjs` 公共 API 不含 `Y.*` 类型（Consumer 与 CRDT 解耦的证据）。
- `runDocumentStoreConformance` 对 store-memory 与 store-yjs 都通过（Provider 可替换的证据）。
- collab-sim fuzz（11 §8）：随机移动/进出组/分段在乱序网络下收敛、无环、无重复。

## 关联

章程 D4/D5、§5.4、§10 Q3；Univer K1、A13、A31；ADR-0032、0025、0024；架构 06。
