> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-14；2026-09-24（rulings §4.15：Q3 Yjs 13.6.x 精确锁版本、撤销语义统一（§2.2、§8 #2/#3/#10/#11）、软删除墓碑 + TTL；S-3a 两级 ack（§6.3/§6.4）；Q5 房间按文档实测权重准入、内存按实测（§9.1、§14）；T-0 去租户（§12、§18.6）；Q10 Valkey；Q9 Node 26）；2026-09-24（复核修正，rulings §4.17：D4 撤销永不复活他人删除的元素（§2.2、§8 #10）；D5/M2 `store/undo-skipped` 载荷 `{skipped, wholeStep}`、单独统计；M1 ack 帧形状以 M-02 为准；M3 撤销契约用例名照抄 M-02 §2.5；M20 P1/P2 标注 Q16/Q17 已裁决、local-batcher 注释补 tier；M21 删「≥ 200 活跃房间」）；2026-09-25（补图）；2026-09-25（矛盾收口，rulings §4.18：UX-03 离线判据改按时间 30 s（`offlineAfterMs`）、CO-03 offline 后 30 s 周期重连（§4.3、§5.1、§12）；UX-02 令牌刷新按原因分流、401 直接进「登录已过期」（§18.3）；CO-08 PG 故障降级期照常广播（§6.4）；CO-09 ack 在途 FIFO 对应、CO-10 step2 视同一帧与超限拆块（§6.3、§6.4、§9.3、§12）；CO-14 空闲房间 LRU 提前回收、CO-16 PG 不可达收尾与遗留溢写回放（§5.2、§6.4、§14）；BE-29 实例内存预算定义（§14）；BE-02 票据 `lnk` 与链接角色重算、BE-23 权限 REST 动词、BE-11 `/api/v1` 前缀（§5.3、§10）；CO-07 术语「彻底删除元素 / 永久删除文档」（§8、§18.1）；CO-20 P8 已裁决（§11、§15、§18.5）；GV-20 契约套件名（§3.2、§4.2）；CO-15 回放期 Room 保持 active、BE-15 purging 拒绝加入（§5.2）；CO-12 协同模式不走 Worker 分批打开（§9.1）；GV-15 `index` 字段检查改指 lint `cordex/no-index-in-mutation`（§1、§17）） | 依赖：charter v0.1

# 06 协同（Collaboration）：CRDT 映射、同步协议、房间与会话、presence、离线、权限即时性、冲突语义

> 读者：实现 `@cordexjs/store-yjs`、`@cordexjs/collab-core`、`@cordexjs/collab-yjs`、`@cordexjs/collab-transport-ws`、`@cordexjs/server-collab` 的工程师；评审协同语义的产品/设计。
> 章程锚点：D4（Mutation 唯一改 Store）、D5（CRDT 单一事实源）、D6（Snapshot 编解码边界）、D12（fail-closed）、§5.2 包边界、§5.3 规则 4（`yjs`/`y-protocols` 单点引入）、§10 Q3/Q5。
> 相关 ADR：0020（CRDT 选型）、0023（传输与协议）、0024（presence）、0025（update 持久化与压缩）、0032（有序集合的 fractional index）、0033（离线持久化）、0034（服务端校验与修复）、0035（网关横向扩展）。
> 术语：本文只用章程 §4 词表；新增术语见文末「术语补充」。内核/UnitScope 见架构 03；模型与 OOXML 映射见架构 04；命令管线见架构 05——本文不重新定义它们。

---

## 0. 一页总览

**协同一页总览：浏览器 Unit 与服务端 Room**

```mermaid
flowchart LR
  subgraph browser["浏览器：每个 Unit 一个 UnitScope"]
    commands["commands"]
    store["store：store-yjs，Y.Doc = 唯一事实源，transact origin=local，UndoManager trackedOrigins"]
    observe["observe"]
    renderUi["render / UI"]
    yjsBackend["yjsBackend"]
    collabYjs["collab-yjs：SyncEngine 与 awareness"]
    transportWs["collab-transport-ws：重连 / 握手"]
    offline["offline：y-indexeddb，可选"]
  end
  subgraph server["服务端：apps/server + server-collab"]
    gateway["CollabGateway：Nest，薄"]
    roomManager["RoomManager：每个 Room = 服务端 Unit，同一份 store-yjs + model-slide 代码"]
    hardGate["硬门禁：鉴权 / 权限 / 大小 / 速率"]
    softGate["软门禁：schema 校验 → 修复事务"]
    persist["持久化：updates 追加 + 快照压缩"]
    fanout["扇出：Valkey pub/sub 跨实例"]
  end
  pg[("Postgres：document_updates / snapshots")]
  valkey[("Valkey：扇出 / presence / 锁 / 溢写")]
  commands -- "Mutation" --> store
  store --> observe --> renderUi
  store --> yjsBackend --> collabYjs --> transportWs
  collabYjs -. "可选" .-> offline
  transportWs <-->|"WS 帧：SYNC / AWARE / CONTROL"| gateway
  gateway --> roomManager --> hardGate --> softGate --> persist --> fanout
  persist --> pg
  fanout --> valkey
  roomManager -. "presence / 锁 / 溢写" .-> valkey
```

怎么读：左框是浏览器里一个 Unit 的协同链路，右框是服务端一个 Room 的处理链路，两者只经 WS 帧往来；右框从 RoomManager 起的链条是一个入站 update 依次经过的环节（默认 `persistBeforeBroadcast=true`，PG 可用时先落库后扇出；PG 故障降级期通过门禁后即扇出、不等持久化，§6.4）。圆柱是存储。
依据：本文 §2–§6、§11、§12。

**协同相关包依赖**

```mermaid
flowchart TB
  storeYjs["@cordexjs/store-yjs"]
  collabCore["@cordexjs/collab-core：Definition，无 yjs"]
  collabYjs["@cordexjs/collab-yjs"]
  transportWs["@cordexjs/collab-transport-ws：iso，用全局 WebSocket"]
  offlineIdb["@cordexjs/collab-offline-idb：L4 dom，OfflineStore Provider"]
  serverCollab["@cordexjs/server-collab：node"]
  protocol["@cordexjs/protocol"]
  modelCore["@cordexjs/model-core"]
  kernel["@cordexjs/kernel"]
  shared["@cordexjs/shared"]
  yjs["yjs"]
  yProtocols["y-protocols"]
  lib0["lib0"]
  yIdb["y-indexeddb"]
  storeYjs --> yjs & modelCore & shared
  collabCore --> modelCore & protocol & kernel & shared
  collabYjs --> yjs & yProtocols & collabCore & storeYjs & protocol
  transportWs --> collabCore & protocol
  offlineIdb -. "实现 OfflineStore 契约" .-> collabCore
  offlineIdb -. "唯一 import，或自写 IDB 适配" .-> yIdb
  serverCollab --> yjs & yProtocols & lib0 & collabCore
  serverCollab --> storeYjs & modelCore & protocol & kernel
```

怎么读：实线是各包 `package.json` 声明的依赖，虚线是 Provider 对 Definition 的实现关系与 S1/S2 的单点引入约定。`yjs` 只被 store-yjs、collab-yjs、server-collab 三处引入；collab-core 与 collab-transport-ws 都不碰 yjs，因此可被其他 CRDT Provider 复用。
依据：本文 §2.4、§3.2、§4.2、§4.3、§16 S1/S2、§18.6；08 §3.1。

十条不变量（后文逐条给出机械验证）：

| # | 不变量 | 验证入口 |
|---|---|---|
| I1 | 协同模式下 Y.Doc 是唯一模型；不存在第二份可写模型（A31） | store-yjs 无独立缓存字段；`observe` 只由 Y 事件驱动（单测 + 代码扫描：store-yjs 内禁止 `Map<…, Model>` 类缓存） |
| I2 | 所有修改经 Mutation → `store.transact`；Y 类型对象**不外泄**到 store-yjs 之外（除 `yjsBackend` 给 collab-yjs） | api-extractor 基线：store-yjs 公共 API 不含 `Y.*` 类型（由 09-04 承接） |
| I3 | 撤销只回滚**本地 origin** 的事务，且不覆盖他人后写的键、整步被跳过即停（rulings §4.15 Q3） | 单测：远端 update 不进入撤销栈；契约用例 `remote-conflict-skip`、`undo-skip-no-cascade` |
| I4 | 实体以 id 定位，顺序以 fractional key 表达，**禁止数组下标** | Mutation schema 无 `index` 字段（类型测试）；fuzz 收敛 |
| I5 | 服务端与客户端运行同一份 store-yjs/model-slide 代码 | iso 冒烟 + server-headless 加载清单 |
| I6 | 权限 fail-closed 且双点：客户端命令管线 + 服务端网关 | conformance：viewer 发送 update 被拒且连接保活 |
| I7 | 任意 update 顺序、重复、乱序都收敛到同一状态 | collab-sim fuzz |
| I8 | 服务端从不把未校验通过的帧扇出 | 单测：坏帧 → 关闭码 4400，无广播 |
| I9 | 离线期间的修改在恢复后**要么被合并要么被明确告知拒绝**，不静默丢失 | e2e：离线编辑 → 降权 → 重连 → 提示导出 |
| I10 | 房间关闭前所有 `ack{tier:'db'}` 确认的 update 已落库（at-least-once 持久化；`tier:'spill'` 不算落库，客户端保留 pending，S-3a） | 单测：kill 进程前的 `ack` 语义；集成：重启后状态相同；spill-and-replay 测试断言回放后无 `pendingStructs` |

---

## 1. model-slide 在 Y.Doc 中的结构

### 1.1 设计原则

1. **Store 对文档类型盲**：store-yjs 不认识「幻灯片」，只认识 6 种**值形状**（§1.2；作用于其上的操作是 04 §2.3 的 5 种 `StoreOp`）。model-slide 用这 6 种值形状声明自己的树形 schema（在架构 04 的 `DocumentType` 声明中），store-yjs 与 store-memory 都实现同一原语集，从而满足 M3 验收「store-yjs 替换 store-memory 仅改 preset 配置」。
2. **实体表 + 引用**，不用嵌套数组：所有有身份的东西（slide/layout/master/theme/shape/media）都是 `EntityTable` 中以 id 为键的 `Record`；顺序用 `order` 类型的 fractional key 属性表达（ADR-0032）。
3. **属性粒度 = 用户可独立编辑的最小单位**：任何能被两个用户同时独立修改的属性必须是独立的 Y.Map 键（例如 `xfrm.off.x` 与 `xfrm.ext.cx` 分开），使并发的「移动」与「缩放」都能存活。
4. **富文本用 `Y.XmlFragment`**，段落是元素、文本是带属性的 `Y.XmlText`（§1.4）。
5. **媒体不进 CRDT**：Y.Doc 只存 `BlobRef`（内容哈希 + mime + 尺寸），字节走对象存储（08）。
6. **不透明保留**照常成立：未建模的 XML 子树以字符串放在 `extensions`（`Opaque` 原语）里，随实体一起同步、导出时原样写回（D7）。

### 1.2 存储原语（Store primitives，提请 A 线纳入 04/05 的 `DocumentStore` Definition，草案）

| 原语 | 语义 | store-yjs 映射 | store-memory 映射 | 并发语义 |
|---|---|---|---|---|
| `Record` | 键固定或半固定的对象 | `Y.Map`；嵌套 Record 为嵌套 `Y.Map`；叶子为 JSON 标量 | 不可变对象 | 键级 LWW（Yjs 时钟 + clientID 决定） |
| `EntityTable<Id, Record>` | 以 id 为键的实体集合 | `Y.Map<Id, Y.Map>` | `Map<Id, Record>` | 增删 = 键级；删除胜过并发编辑（delete-wins） |
| `Ordered` | 实体的相对顺序 | 实体 Record 上的 `order: FracKey`（字符串） | 同 | 移动 = 单键 LWW；排序键 `(order, id)` 全序 |
| `RichText` | 段落序列 + 带属性文本 + 内嵌对象 | `Y.XmlFragment` | 段落/run 不可变数组 + 稳定位置表 | 字符级合并（YATA） |
| `BlobRef` | 媒体引用 | JSON `{ sha256, mime, bytes, w?, h? }` 叶子 | 同 | LWW |
| `Opaque` | 不透明保留的 XML/字节 | `string`（XML）或 base64 叶子 | 同 | LWW |

> 由此，`Mutation` 经 `lower()` 只能降为 04 §2.3 的 **5 种 `StoreOp`**（总编排定稿）：`set(path, value)` / `delete(path)` / `insert(path, index, items)` / `remove(path, index, count)` / `text(path, delta)`。有身份实体的移动 = `set(entities/<id>/order, key)`（键由命令层经 `@cordexjs/shared/order` 算出，ADR-0032），因此**没有 `move` 原语**；原子数组极少移动，用 `remove` + `insert`。逆操作由 Store 从原语推导（D4），store-yjs 由 `Y.UndoManager` 实现，store-memory 由不可变快照 diff 实现。

### 1.3 Y.Doc 顶层布局（草案）

```
Y.Doc (guid = unitId)                                 说明
├── meta: Y.Map                                       { schemaVersion: number, docType: 'slide', epoch: 0, createdAt }
│                                                     schemaVersion 与 A 线 D6 的迁移注册表对应；epoch 见 §9.4
├── presentation: Y.Map                               根 Record
│   ├── slideSize: Y.Map { cx: Emu, cy: Emu, type? }
│   ├── notesSize: Y.Map
│   ├── defaultTextStyle: string(Opaque)              a:defaultTextStyle 原样保留（M1–M3 不编辑）
│   ├── sectionList?: Y.Map<SectionId, Y.Map>         节（order + name + slideIds 由 slide.sectionId 反推）
│   └── extensions: Y.Map<string, string>             p:presentation 下未建模子树（Opaque）
├── themes:   Y.Map<ThemeId,  Y.Map>                  a:theme（clrScheme/fontScheme/fmtScheme 建模为 Record；其余 Opaque）
├── masters:  Y.Map<MasterId, Y.Map>                  { themeId, clrMap, txStyles(Opaque), shapes: EntityTable, background, extensions }
├── layouts:  Y.Map<LayoutId, Y.Map>                  { masterId, type, name, shapes: EntityTable, showMasterSp, extensions }
├── slides:   Y.Map<SlideId,  Y.Map>                  见 1.3.1
├── notes?:   Y.Map<NotesId,  Y.Map>                  备注页（M1 保留，M3 可编辑文本）
├── media:    Y.Map<MediaId,  Y.Map>                  { ref: BlobRef, originalPartName }；MediaId = sha256 前 16 hex
└── resources: Y.Map<string, Y.Map>                   ResourceHook 数据；键为 `${pluginId}.${string}`（见架构 04）
```

**Y.Doc 实体引用关系**

```mermaid
flowchart LR
  subgraph ydoc["Y.Doc：guid = unitId"]
    presentation["presentation：根 Record，含 sectionList"]
    themes["themes"]
    masters["masters：含 shapes 实体表"]
    layouts["layouts：含 shapes 实体表"]
    slides["slides"]
    shapes["slides/SlideId/shapes：扁平实体表"]
    media["media：ref = BlobRef，MediaId = sha256 前 16 hex"]
  end
  blob[("对象存储：媒体字节，见 08")]
  slides -- "layoutId" --> layouts
  layouts -- "masterId" --> masters
  masters -- "themeId" --> themes
  slides -- "sectionId" --> presentation
  slides -- "shapes" --> shapes
  shapes -- "parentId 指向同表 grpSp" --> shapes
  shapes -- "cxn 的 stCxn / endCxn" --> shapes
  shapes -- "pic.mediaId、fill 的 blip" --> media
  media -- "BlobRef.sha256" --> blob
```

怎么读：箭头是「以 id 引用」，不是嵌套——所有实体都在各自顶层 `Y.Map` 中以 id 为键（§1.1 原则 2）；组合层级靠 `parentId` 在同一张扁平 shapes 表内自引用（§1.3.2 备注）；媒体字节不进 Y.Doc，只经 BlobRef 指向对象存储（§1.1 原则 5）。

#### 1.3.1 slide 实体（草案）

```
slides/<SlideId>: Y.Map
├── id: SlideId                        与键相同，便于 observe 时定位
├── order: FracKey                     幻灯片顺序（ADR-0032）
├── layoutId: LayoutId
├── sectionId?: SectionId
├── show: boolean                      p:sld/@show（隐藏页）
├── background?: Y.Map                 { fill: Y.Map(Record), extensions }
├── clrMapOvr?: Y.Map
├── timing?: string(Opaque)            动画/切换：M1–M3 只保留（章程 Q7）
├── transition?: string(Opaque)
├── shapes: Y.Map<ShapeId, Y.Map>      **扁平**实体表：组合的子形状也在此表中，用 parentId 表达层级
└── extensions: Y.Map<string, string>
```

#### 1.3.2 shape 实体（草案，kind 为开放字符串，见 `slide.shapeKind` 贡献点/架构 04）

```
slides/<SlideId>/shapes/<ShapeId>: Y.Map
├── id: ShapeId
├── kind: 'sp' | 'pic' | 'grpSp' | 'cxnSp' | 'graphicFrame' | <第三方 kind>
├── parentId: ShapeId | null           null = 直接位于 spTree 下；否则为 grpSp 的 id
├── z: FracKey                         同一 parent 内的绘制顺序（z-order）
├── nv: Y.Map                          { name, descr, hidden, placeholder?: { type, idx, orient, sz }, hlinkClick(Opaque) }
├── xfrm: Y.Map                        { off: Y.Map{x,y}, ext: Y.Map{cx,cy}, rot, flipH, flipV, chOff?, chExt? }   叶子独立键
├── geom: Y.Map                        { preset?: string, adj: Y.Map<string, number>, custom?: string(Opaque) }
├── fill: Y.Map                        Record（solid/gradient/pattern/blip/none；blip 引用 MediaId）
├── ln: Y.Map                          线型 Record
├── effects?: string(Opaque)           a:effectLst / a:scene3d：M1–M3 保留
├── style?: Y.Map                      a:style 引用（lnRef/fillRef/effectRef/fontRef）
├── txBody?: Y.Map                     { bodyPr: Y.Map, lstStyle: string(Opaque), text: Y.XmlFragment }   见 1.4
├── pic?: Y.Map                        { mediaId, srcRect, extensions }
├── graphic?: Y.Map                    graphicFrame 内容：{ uri, table?: Y.Map(建模), chart?: string(Opaque, M3 起建模数据), ole?: Opaque }
├── cxn?: Y.Map                        { stCxn: {id, idx}, endCxn }
└── extensions: Y.Map<string, string>
```

> 备注：把组合的子形状**扁平化**到同一 `shapes` 表（而非嵌套在 grpSp 内）的原因：(1) 进/出组只是改 `parentId` 一个键，天然支持并发；(2) observe 事件路径深度固定，dirty 追踪简单；(3) 避免 Yjs 深嵌套类型在整组删除时的事件爆炸。代价是需要一个「父子环检测与修复」（§8 冲突 #5）。

### 1.4 富文本：Run/Paragraph → `Y.XmlFragment`

```
txBody.text: Y.XmlFragment
└── <p> : Y.XmlElement('p')                 每个 a:p 一个元素；属性 = pPr 的标量（algn、lvl、indent、marL、bullet(JSON 字串)、
    │                                        spcBef/spcAft/lnSpc、endParaRPr(JSON 字串)、x(Opaque 字串：未建模 pPr 子树)）
    └── Y.XmlText                            段落正文；a:r 折叠为**带属性的文本区间**（属性 = rPr：b/i/u/strike/sz/baseline/spc/kern/lang、
                                             latin/ea/cs/sym 字体、fill(JSON 字串)、hlink(JSON 字串)、x(Opaque)）
                                             a:br → insertEmbed({ br: 1 })；a:fld → insertEmbed({ fld: { type, id, text } })
                                             a14:m / mc:AlternateContent 等 → insertEmbed({ opaque: '<xml…>' })
```

选择 `Y.XmlFragment` 而非「`Y.Text` + `\n` 携带段落属性」（Quill 惯例）的理由：段落拥有元素身份，段落属性不寄生在换行字符上（分段/合段时属性不漂移）；与 OOXML `a:p/a:r` 一一对应，编解码无歧义；`Y.RelativePosition` 可同时定位段落元素与字符偏移（用于光标与评论锚点）；若未来接入 ProseMirror，`y-prosemirror` 直接可用。代价：每段约多 ~40 B 的结构开销（200 页 × 30 段 = 6000 段 ≈ 240 KB，可接受）。详见 ADR-0020 §富文本。

**编辑操作 → Y 操作**（store-yjs `mapping/rich-text.ts` 实现）：`text.insert(path, pos, str, attrs)` → `XmlText.insert`；`text.format(path, range, attrs)` → `XmlText.format`；`splitParagraph(path, pos)` → 新建 `<p>` 元素 + 移动尾部文本（删除 + 插入，携带属性）；`mergeParagraph` 对称。**已知限制**：分段时被移动的尾部文本若被他人并发格式化，格式化落在已删除文本上而丢失（与 y-prosemirror 相同的取舍，见 §8 冲突 #8）。

### 1.5 属性值的编码规则

| 值类型 | 编码 | 理由 |
|---|---|---|
| 标量（数、布尔、枚举字串、品牌单位 `Emu`/`Pt`） | 直接 JSON 叶子 | LWW 粒度最细 |
| 小型复合值且总是整体替换（颜色、字体引用、超链接） | JSON **字符串**（稳定序列化：键排序） | 避免为每个颜色建 Y.Map 的开销；并发时整体 LWW 符合用户预期 |
| 用户可分别编辑的复合值（xfrm、fill、ln、bodyPr） | 嵌套 `Y.Map` | 并发独立编辑存活 |
| 未建模 XML | 字符串（原始 XML，命名空间归一化后） | D7 |
| 二进制 | 不进 Y.Doc；`BlobRef` | 体积 |

**机械验证**：`@cordexjs/model-slide/testing` 导出 schema → 类型测试断言 `EntityTable` 值中不出现 `Array<Entity>`；lint 规则 `cordex/no-index-in-mutation`（09-02 §4.17，TD-065）检查 Mutation schema 无 `index` 字段。

---

## 2. `@cordexjs/store-yjs`：DocumentStore Provider

### 2.1 职责与边界

- **唯一** import `yjs` 的模型侧包；对外 API 不暴露 `Y.*` 类型（api-extractor 基线守护）。
- 为每个 Unit 提供 `store`（UnitScope 内），并额外提供 `yjsBackend` 服务（同 UnitScope）给 `collab-yjs` 使用——这是 Provider 间**受控的**类型依赖（章程 §5.2 已允许 collab-yjs 依赖 store-yjs）。
- 一个 Unit 一个 Fiber（插件由 preset 在 UnitScope 内加载），Y.Doc 归该 Fiber 的 effect 所有：Unit 关闭 → `doc.destroy()`。

### 2.2 `DocumentStore` 契约在 store-yjs 中的实现要点（签名级草案；契约本身由 A 线在 04/05 定义）

```ts
// 草案：store-yjs 期望的 DocumentStore 表面（提请 A 线在 model-core 中定型）
interface DocumentStore {
  readonly kind: string                                    // 'yjs' | 'memory'
  transact<T>(fn: (tx: StoreTx) => T, meta: TransactionMeta): T
  observe(listener: (change: ChangeSet) => void): Disposable  // 由 ctx.effect 拥有
  get<T>(path: StorePath): T | undefined
  undo(scope?: UndoScope): boolean;  redo(scope?: UndoScope): boolean
  canUndo(): boolean;  canRedo(): boolean
  createStablePosition(path: StorePath, offset: number): StablePosition   // Yjs: RelativePosition
  resolveStablePosition(pos: StablePosition): { path: StorePath; offset: number } | null
  exportSnapshot(): Snapshot;  importSnapshot(s: Snapshot): void        // D6 边界
}
interface TransactionMeta {
  origin: TransactionOrigin        // { kind: 'local', txnId, commandId, actor } | { kind: 'remote' } | { kind: 'undo' | 'redo' } | { kind: 'repair', by: 'server' } | { kind: 'import' | 'migration' }
  undoable: boolean
}
interface ChangeSet {
  origin: TransactionOrigin; local: boolean
  paths: readonly StorePath[]          // 变更的最小路径集合（去重、父路径合并），供 07 的脏区追踪消费
  entities: { added: EntityRef[]; removed: EntityRef[]; reordered: EntityRef[] }
}
```

- `transact`：包装 `doc.transact(fn, origin)`。`origin` 对象即 Yjs 事务的 origin，`UndoManager.trackedOrigins` 只包含本 Unit 的 `local` origin **类**（用 class 标识，而非对象实例，避免每个事务一个 origin 实例无法被 Set 命中的经典错误）。
- `observe`：`doc.on('afterTransaction')` → 把 `transaction.changed`/`changedParentTypes` 转为 `ChangeSet.paths`（`mapping/change-set.ts`）。**不**为每个 Y 类型单独 `observeDeep`（避免 O(类型数) 的监听器）。
- `undo/redo`：`Y.UndoManager({ trackedOrigins, captureTimeout: 500 })`，作用域为整份 Y.Doc（除 `resources.<presence-like>` 这类不该撤销的命名空间，通过 `UndoManager` 的 `scope` 参数排除）。`history` 服务（A 线，UnitScope）只是它的薄门面；`store.undo()` 返回是否发生了变化。
- **撤销语义不跟随 Yjs 默认**（rulings §4.15 Q3，契约字段 `undo.remoteConflict: 'skip'`，05 §6）：undo 包装层（`undo/undo-manager.ts`）在弹出栈项前比对该项涉及的 Y.Map 键的当前写入者（`item.id.client` 与本地 clientID）；已被远端后写的键**不回退**并收集到 `store/undo-skipped{ skipped: UndoSkip[], wholeStep }`（载荷以 40-modules/02 §2.4 为准）；若整项的键都被跳过 → 本次撤销不生效、**停止**（Yjs 默认会继续弹出下一项，即「连撤两步」，包装层阻断）。有身份实体删除以 `_deleted` 墓碑表示（04 §3.1a），撤销**自己的**删除 = 清除墓碑、原 id 复活；撤销目标已被**他人**删除（墓碑 TTL 内亦然）→ 该键跳过并提示，**撤销永不复活他人删除的元素**（rulings §4.17 D4）。Yjs 版本锁 13.6.x 精确版本（不跟 dist-tag，`@y/y` 的 latest 指向旧 rc）；Yjs 14 GA 后于 M3 前做升级 spike。
- 撤销粒度对齐事务：命令管线一个 Command = 一个 `transact`；连续键入由 `captureTimeout` 合并；拖拽由命令层显式用同一 `txnGroup`（A 线契约：`TransactionMeta.group?: string`，store-yjs 用 `UndoManager.stopCapturing()` 边界实现）。
- `createStablePosition`：`Y.createRelativePositionFromTypeIndex(xmlText, offset)` → base64；用于本地光标、远端光标（awareness）与评论锚点（08）。
- `importSnapshot`：只允许在**空** Y.Doc 上调用（导入/服务端 bootstrap），否则抛 `store.snapshot_import_on_nonempty`；Snapshot 保留 `order: FracKey` 键（ADR-0013 第 7 条），原样写入，不做数组转换。

### 2.3 `yjsBackend` 服务（供 collab-yjs，草案）

```ts
interface YjsBackend {
  encodeStateVector(): Uint8Array
  encodeStateAsUpdate(targetVector?: Uint8Array): Uint8Array   // V2 编码
  applyUpdate(update: Uint8Array, origin: TransactionOrigin): void
  onUpdate(listener: (update: Uint8Array, origin: TransactionOrigin) => void): Disposable  // 只回调非 remote 的 update
  awareness(): AwarenessHandle       // 由 collab-yjs 创建后挂回（y-protocols/awareness 需要 doc）
  stats(): { structs: number; deletedStructs: number; bytes: number }   // 供 telemetry
}
```

### 2.4 目录结构（`packages/store-yjs/`）

```
packages/store-yjs/
├── package.json                      exports: "." 与 "./testing"；dependencies: yjs（唯一）、@cordexjs/model-core、@cordexjs/shared
├── src/
│   ├── index.ts                      re-export 插件、Config、YjsBackend 类型、encode/decode 工具（不含 Y.* 类型）
│   ├── plugin.ts                     函数插件 name='store-yjs'；inject=['units']（读取当前 Unit 元数据）；provide=['store','yjsBackend']；
│   │                                 apply：ctx.effect 创建 Y.Doc({guid: unitId, gc: config.gc}) → 注册两个 Service → 返回 doc.destroy
│   ├── manifest.ts                   Manifest：provides ['store','yjsBackend']、injects、iso class 'iso'
│   ├── config.ts                     zod Config：{ gc: true, undo: { captureTimeout: 500, excludedNamespaces: [], remoteConflict: 'skip' }, maxDocBytes: 64 MiB, maxElementsPerDoc: 20000 }（中性字段名，与 CRDT 无关；store-memory 同名同义；40-modules/02 的两处 Config 以此为准）
│   ├── store.contribution.ts         declare module '@cordexjs/kernel' { interface Context { yjsBackend: YjsBackend } }（store 由 model-core 声明）
│   ├── services/
│   │   ├── yjs-document-store.service.ts   DocumentStore Provider（extends Service，name 'store'）：transact/observe/get/undo/redo/stablePosition/snapshot
│   │   └── yjs-backend.service.ts          YjsBackend Provider（name 'yjsBackend'）
│   ├── mapping/
│   │   ├── primitives.ts             6 种值形状 ↔ Y 类型的构造与读取；FracKey 比较器（键的生成在命令层，来自 @cordexjs/shared/order）
│   │   ├── paths.ts                  StorePath（['slides', id, 'shapes', sid, 'xfrm', 'off', 'x']）↔ Y.AbstractType 定位；路径规范化与父路径折叠
│   │   ├── mutations.ts              原语操作 → 事务内的 Y 操作；批量应用；对不存在目标的操作返回 Result.err('store.target_missing')
│   │   ├── rich-text.ts              RichText 操作 → Y.XmlFragment/Y.XmlText；embed 编解码；分段/合段；RelativePosition 编解码
│   │   ├── change-set.ts             Y.Transaction → ChangeSet（paths、entities）；合并父路径；标注 local/origin
│   │   └── snapshot.ts               Snapshot(JSON, schemaVersion) ↔ Y.Doc；数组 → FracKey；导出时按 (order, id) 排序
│   ├── undo/
│   │   └── undo-manager.ts           Y.UndoManager 封装：origin 类判定、captureTimeout、txnGroup 边界、栈变化事件 → 'store/history-changed'；remoteConflict='skip'（同键被他人后写不回退）、整步跳过即停、emit 'store/undo-skipped'
│   ├── origin.ts                     TransactionOrigin 类（LocalOrigin/RemoteOrigin/UndoOrigin/RepairOrigin/ImportOrigin）与 isLocal()
│   ├── encoding.ts                   V2 update/state vector 薄封装；mergeUpdates；diffUpdate；不导出 Y 类型
│   ├── limits.ts                     文档体积/结构数守卫：超过 maxDocBytes 触发 'store/limit-exceeded' 与 errors 上报（不阻断）；实体数（墓碑计入）供命令层 maxElementsPerDoc 守卫读取（05 §8）
│   ├── errors.ts                     错误码：store.target_missing / store.snapshot_import_on_nonempty / store.limit_exceeded / store.invalid_path
│   └── __tests__/
│       ├── conformance.test.ts       运行 @cordexjs/model-core/testing 的 DocumentStore conformance kit（所有 Provider 必过，见 11）
│       ├── mapping.paths.test.ts     路径定位/规范化
│       ├── rich-text.test.ts         run 折叠、embed、分段/合段、RelativePosition 稳定性（并发插入后仍指向同一字符）
│       ├── undo-origin.test.ts       远端 update 不入栈；captureTimeout 合并；txnGroup
│       ├── undo-remote-conflict.test.ts  实例化 40-modules/02 §2.5「中性撤销语义」用例（名称照抄）：remote-conflict-skip（同键他人后写 → 跳过 + 事件）；undo-skip-no-cascade（整步跳过不连撤）；soft-delete-tombstone；delete-vs-edit-undo（撤销删除 = 同 id 复活、无重复元素）；read-path-filters-tombstone
│       ├── convergence.test.ts       两 Doc 随机原语操作、乱序交换 update 后状态相等
│       ├── snapshot-roundtrip.test.ts Snapshot → Doc → Snapshot 幂等（顺序保持）
│       └── lifecycle.test.ts         Fiber 卸载后 getEffects() 为空；两个 Unit 的 store 互不可见（isolate）
└── testing/
    ├── index.ts                      `@cordexjs/store-yjs/testing`：createLinkedStores(n)（进程内 n 个 store 通过内存管道交换 update）、
    │                                 applyUpdatesShuffled、YjsStoreHarness（可注入时钟/clientID 便于确定性测试）
    └── fixtures/                     小型 Snapshot 样本（空演示、3 页、含组合/表格/富文本）
```

---

## 3. `@cordexjs/collab-core`：Definition

### 3.1 服务与契约（签名级草案）

```ts
// ctx.collab（根作用域服务，管理各 Unit 的 Session）
interface CollabService {
  join(unitId: UnitId, opts: JoinOptions): Session          // 幂等：同 Unit 重复 join 返回同一 Session
  leave(unitId: UnitId): Promise<void>
  session(unitId: UnitId): Session | undefined
}
interface Session {
  readonly state: SessionState                              // 见 §5 状态机；变化触发 'collab/session-state'
  readonly role: Role                                       // 来自服务端 auth.ok / permission 帧（@cordexjs/protocol Role）
  readonly stats: SessionStats                              // pendingLocalUpdates、lastSyncedAt、bytesIn/Out、rtt
  flush(): Promise<void>                                    // 等待本地 pending 全部被服务端 ack（用于「关闭前保存」）
  reconnectNow(): void
  close(): Promise<void>
}
// ctx.presence（UnitScope 服务）
interface PresenceService {
  setLocal(patch: Partial<PresenceState>): void             // 节流由 Provider 做
  readonly local: PresenceState
  readonly remotes: ReadonlyMap<ClientId, PresenceState>    // 反应式；变化触发 'presence/changed'
}
// ctx.collabTransport（根作用域，可替换：ws / webrtc / memory）
interface CollabTransport {
  connect(target: TransportTarget, ticket: string, signal: AbortSignal): Promise<Connection>
}
interface Connection {
  send(frame: Uint8Array): void                             // 背压：返回前不阻塞；超过 outboundHighWater 触发 'collab/backpressure'
  onFrame(listener: (frame: Uint8Array) => void): Disposable
  onClose(listener: (code: number, reason: string) => void): Disposable
  close(code?: number, reason?: string): void
}
// SyncEngine（CRDT 相关的同步逻辑，collab-yjs 实现；transport/gateway 对其不可知）
interface SyncEngine {
  initialFrames(): Uint8Array[]                              // Yjs: SyncStep1 + 本地 awareness
  handleInbound(payload: Uint8Array): SyncOutcome           // 返回需回发的帧与「是否已同步」
  onLocalUpdate(listener: (payload: Uint8Array) => void): Disposable
}
// OfflineStore（可选 Provider；缺失时降级为「仅内存」）
interface OfflineStore { load(unitId): Promise<Uint8Array | null>; append(unitId, update): Promise<void>; compact(unitId, state): Promise<void>; clear(unitId): Promise<void> }
```

事件（在 `collab.contribution.ts` 中 `declare module '@cordexjs/kernel'`）：`collab/session-state(unitId, prev, next)`（定稿名 `collab/state-changed`，10 §11）、`collab/synced(unitId)`、`collab/rejected(unitId, code, count)`（定稿名 `collab/update-rejected`）、`collab/backpressure(unitId, queued)`、`presence/changed(unitId, clientId | null)`。权限变更事件 `permission/changed` **不由 collab 发出**：由 `permissions` 服务在 `applyRemoteDecisions` 之后唯一发出（§18.3；原草稿 `collab/permission-changed` 弃用）。

### 3.2 目录结构（`packages/collab-core/`）

```
packages/collab-core/
├── package.json                      exports "." "./testing"；deps: @cordexjs/model-core @cordexjs/protocol @cordexjs/kernel @cordexjs/shared（无 yjs）
├── src/
│   ├── index.ts
│   ├── collab.contribution.ts        Context 增强（collab/presence/collabTransport/offlineStore）+ Events 增强
│   ├── contracts/
│   │   ├── collab.service.ts         CollabService/Session/JoinOptions/SessionStats
│   │   ├── session-state.ts          SessionState 联合类型 + 事件类型 + 允许的转换表（纯数据）
│   │   ├── transport.ts              CollabTransport/Connection/TransportTarget；背压水位常量
│   │   ├── sync-engine.ts            SyncEngine/SyncOutcome
│   │   ├── presence.ts               PresenceState schema（zod，来自 @cordexjs/protocol 的 AwarenessState）与 PresenceService
│   │   ├── offline.ts                OfflineStore
│   │   └── permission-gate.ts        PermissionGate：把网关 Role/能力位映射为 `permissions.applyRemoteDecisions(decisions)` 的入参（权限进入客户端的唯一入口）；事件 `permission/changed` 由 permissions 发出
│   ├── fsm/
│   │   └── session-fsm.ts            reduce(state, event) → { next, effects[] }（无 IO，effects 为描述对象，由 Provider 执行）
│   ├── backoff.ts                    指数退避 + 抖动 的纯函数（transport 与 room 复用）
│   ├── errors.ts                     collab.* 错误码声明（见 10）
│   └── __tests__/session-fsm.test.ts / backoff.test.ts
└── testing/
    ├── index.ts                      `@cordexjs/collab-core/testing`：runCollabTransportConformance(factory)、runOfflineStoreConformance(factory)
    │                                 （两个可替换 Definition 的契约套件，命名按章程 run<Definition>Conformance；`collab` 与 store-yjs 强耦合，
    │                                 不设独立套件，见 40-modules/05 §2.5）、MemoryTransport（进程内、可注入延迟/乱序/丢包/断线）、FakeTicketIssuer
    └── scenarios/                    conformance 用例脚本：join→synced、断线重连、离线队列、降权拒写、房间满、schema 过新
```

---

## 4. `@cordexjs/collab-yjs` 与 `@cordexjs/collab-transport-ws`：Provider

### 4.1 collab-yjs 的运行时装配（每个 Unit）

**collab-yjs 的运行时装配**

```mermaid
flowchart TB
  subgraph unitScope["UnitScope：unit U"]
    storeYjs["store-yjs：provide store、yjsBackend"]
    subgraph collabYjs["collab-yjs：inject store、yjsBackend、collabTransport、permissions、telemetry，可选 ctx.get offlineStore"]
      syncEngine["YjsSyncEngine：y-protocols/sync 的 readSyncMessage、writeSyncStep1、writeUpdate，applyUpdate 时 origin=RemoteOrigin"]
      awarenessAdapter["AwarenessAdapter：y-protocols/awareness 的 Awareness doc，本地状态节流，远端状态 zod 清洗后进 presence"]
      localBatcher["LocalBatcher：yjsBackend.onUpdate → 50 ms 内 Y.mergeUpdates → 一帧发送，离线时写 OfflineStore"]
      permissionGate["PermissionGate：role 低于 editor 时本地拦截 outbound update 并触发 collab/rejected，接收 CONTROL.permission 帧更新 permissions"]
      sessionDriver["SessionDriver：执行 session-fsm 的 effects，即 connect、send、schedule、backoff、notify"]
    end
    transportWs["collab-transport-ws：provide collabTransport，根作用域也可"]
  end
  storeYjs -- "store、yjsBackend" --> collabYjs
  transportWs -- "collabTransport" --> collabYjs
```

怎么读：外框是一个 Unit 的作用域，内框是 collab-yjs 插件拆出的五个内部组件；箭头表示服务注入方向（provide → inject）。PermissionGate 是客户端 UX 检查点，服务端网关仍是安全边界（§10）。

### 4.2 目录结构（`packages/collab-yjs/`）

```
packages/collab-yjs/
├── package.json                      deps: yjs, y-protocols, @cordexjs/collab-core, @cordexjs/store-yjs, @cordexjs/protocol
├── src/
│   ├── index.ts
│   ├── plugin.ts                     name='collab-yjs'；inject 如上；provide=['collab'（根）,'presence'（Unit）]；apply 里全部资源走 ctx.effect
│   ├── manifest.ts
│   ├── config.ts                     zod：{ flushMs: 50, awareness: { cursorHz: 20, stateHz: 2, timeoutMs: 30000 }, maxUpdateBytes: 1 MiB,
│   │                                       outboundHighWater: 200, offline: { enabled: true, maxBytes: 50 MiB } }
│   ├── services/
│   │   ├── yjs-collab.service.ts     CollabService Provider：Session 创建、SessionDriver、与 transport/offline 协调、stats
│   │   └── yjs-presence.service.ts   PresenceService Provider：基于 AwarenessAdapter；RelativePosition 光标编码；节流
│   ├── sync/
│   │   ├── yjs-sync-engine.ts        SyncEngine 实现（step1/step2/update）；「已同步」判定 = 收到 step2 且本地 pending 为空
│   │   ├── frame-codec.ts            @cordexjs/protocol 信封（type 字节 + payload）↔ y-protocols 负载（lib0 encoding）；CONTROL JSON zod 解析
│   │   └── local-batcher.ts          合并/节流/背压；ack 追踪（服务端 CONTROL.ack，两级 `tier:'spill'|'db'`，仅 `tier:'db'`（带 seq）清 pending，见 §6.4，S-3a）
│   ├── awareness/
│   │   ├── awareness-adapter.ts      Awareness 生命周期（随 Fiber）；远端状态 schema 校验，非法状态丢弃并计数
│   │   └── cursor-codec.ts           选区/光标 ↔ RelativePosition base64
│   ├── offline/
│   │   └── offline-queue.ts          OfflineStore 之上的队列：启动时 load → applyUpdate(origin=LocalOrigin 重放，不入撤销栈)；synced 后 compact
│   ├── permission/
│   │   └── permission-gate.ts        CONTROL.permission → `permissions.applyRemoteDecisions(decisions)`（唯一入口）；outbound 拦截；不自发权限事件
│   ├── errors.ts
│   └── __tests__/
│       ├── conformance.test.ts       对内置内存 OfflineStore 跑 runOfflineStoreConformance；收敛由 store-yjs 的 runDocumentStoreConformance 协同分节覆盖
│       ├── sync-engine.test.ts       step1/step2/update 与 y-websocket 参考实现帧互操作
│       ├── batcher.test.ts           50 ms 合并、背压事件、ack 回收
│       ├── awareness.test.ts         节流、超时清理、非法状态清洗
│       ├── permission-gate.test.ts   降权后本地拦截、升权恢复、事件顺序
│       ├── offline-queue.test.ts     离线积累 → 重连合并；拒绝路径保留可导出
│       └── lifecycle.test.ts         多 Unit 并存；卸载无 effect；Provider 替换（memory transport ↔ ws）
└── testing/
    └── index.ts                      `@cordexjs/collab-yjs/testing`：createCollabCluster(n, networkModel)（n 个客户端 + 内存服务端）、NetworkModel
```

### 4.3 目录结构（`packages/collab-transport-ws/`）

```
packages/collab-transport-ws/
├── package.json                      deps: @cordexjs/collab-core @cordexjs/protocol；iso：使用全局 WebSocket（Node ≥ 22 起内建；项目基线 Node 26），不依赖 ws 包
├── src/
│   ├── index.ts
│   ├── plugin.ts                     provide=['collabTransport']；Config 校验（url 模板、超时、退避）
│   ├── manifest.ts
│   ├── config.ts                     zod：{ urlTemplate: 'wss://{host}/collab/v1/rooms/{documentId}', connectTimeoutMs: 5000,
│   │                                       backoff: { baseMs: 1000, maxMs: 30000, jitter: 0.2 }, offlineAfterMs: 30000,
│   │                                       offlineRetryMs: 30000, heartbeatMs: 15000 }
│   │                                     离线判据按时间（rulings §4.18 UX-03）：自进入重连起累计 offlineAfterMs 仍未连上即 offline，
│   │                                     不再按重试次数；offline 后每 offlineRetryMs（±20% 抖动）周期重连一次（CO-03）
│   ├── ws-transport.service.ts       CollabTransport Provider：connect → 握手（handshake.ts）→ Connection；binaryType='arraybuffer'
│   ├── handshake.ts                  发送 CONTROL.auth{ticket, protocolVersion, clientId, capabilities} → 等待 auth.ok / auth.denied（5 s 超时）
│   ├── heartbeat.ts                  应用层 ping/pong（CONTROL.ping）用于浏览器不可见的 WS ping；2 次未响应即判死
│   ├── reconnect.ts                  使用 collab-core/backoff；离线计时（offlineAfterMs，令牌刷新的网络失败共用同一计时）与
│   │                                 offline 周期重连（navigator.onLine=false 期间暂停）；online/offline 事件钩子（可注入，iso 安全）
│   ├── errors.ts                     transport.*（connect_timeout、auth_timeout、closed_by_server{code}）
│   └── __tests__/                    用 devDependency `ws` 起本地服务端；断线/超时/退避/握手拒绝
```

---

## 5. 房间（Room）与会话（Session）生命周期

### 5.1 客户端 Session 状态机（collab-core `session-fsm.ts`，Provider 执行 effects）

**客户端 Session 状态机**

```mermaid
stateDiagram-v2
  [*] --> idle
  idle --> connecting: join 调用
  connecting --> authenticating: transport open
  connecting --> backoff: connect error 或 timeout
  authenticating --> syncing: CONTROL.auth.ok，携带 role、docState
  authenticating --> denied: CONTROL.auth.denied，携带 code
  authenticating --> backoff: auth timeout，5 s
  syncing --> live: SyncStep2 applied 且 pending 为 0
  syncing --> backoff: transport closed
  live --> live: update、awareness、ack
  live --> readonly: CONTROL.permission，role 低于 editor
  readonly --> live: CONTROL.permission，role 不低于 editor
  live --> backoff: transport closed，1001、1006、1012、4503；或令牌刷新网络错误
  live --> denied: 令牌刷新 401，登录已过期
  readonly --> backoff: transport closed
  backoff --> connecting: timer fired
  backoff --> offline: 进入重连起累计 30 s 未连上，或 navigator.onLine=false
  offline --> connecting: online 事件、reconnectNow 调用，或 30 s 周期重连（onLine=false 时暂停）
  live --> quarantined: close 4409，schema repair threshold
  denied --> connecting: permission granted later，或重新登录后换新票据
  live --> closed: leave 调用或 unit closed
  offline --> closed: leave 调用
  quarantined --> closed: leave 调用
```

怎么读：箭头是状态转换，冒号后是触发条件；`live --> live` 是停留在 live 时处理的帧。对外只暴露投影后的 `SyncState`（§18.3），本图是内部 FSM。进入 offline 的判据按时间（rulings §4.18 UX-03：累计 30 s，`navigator.onLine=false` 立即），offline 的三条出口见 CO-03 默认值；令牌刷新失败按原因分流（UX-02：网络错误走 backoff 并共用同一 30 s 计时，401 直接进 denied，对外投影为「登录已过期」）。

- **本地编辑在任何非 `closed` 状态下都允许**（含 `offline`/`backoff`），前提是 `role ≥ editor`；`readonly`/`denied` 下 `permissions` 快照使 commands 管线拒绝 Mutation（D12 客户端检查点）。
- `syncing` 期间用户已可编辑（先应用 HTTP bootstrap 快照，见 §9.1），本地 update 进入 pending 队列，`live` 后冲刷。
- 每次状态变化：`ctx.emit('collab/session-state', …)` + telemetry 计数 `cordex_collab_session_transitions_total{from,to}`。

### 5.2 服务端 Room 状态机（server-collab `RoomManager`）

**服务端 Room 状态机**

```mermaid
stateDiagram-v2
  [*] --> loading: first join，携带 documentId
  loading --> active: bootstrap ok，snapshot + updates → Unit opened → migrated?
  loading --> failed: bootstrap error → joins rejected 4503
  active --> active: join、leave、update、awareness、persist tick
  active --> draining: last client left，grace 60 s，SV-05
  draining --> active: join
  draining --> persisting: grace elapsed，或内存压力、准入不足时按 LRU 提前结束
  active --> evicting: shutdown 或 memory pressure 且回收空闲房间后仍超预算 → clients get 1012
  evicting --> persisting
  persisting --> closed: pending flushed + compaction decision + Unit closed；PG 不可达时先把内存档强制写入一级溢写
  failed --> [*]
  closed --> [*]
```

怎么读：箭头是 Room 生命周期转换，冒号后是触发条件或该转换伴随的动作；draining 的 60 s 宽限期内有人重新加入即回到 active。内存压力或准入不足时先按 LRU 提前结束 draining 房间（无在线客户端，不发 1012），仍超预算才驱逐 active 房间；没有 draining → evicting 这条边（rulings §4.18 CO-14）。

- 一个 Room = 服务端 cordis 宿主里的一个 **Unit**（同一份 store-yjs + model-slide 代码；D5/D8），因此 schema 校验、修复、迁移与客户端行为一致。
- **PG 故障期与溢写回放期间 Room 保持 `active`**（`spillTier ≠ none` 或 `replaying = true` 只是 active 内的持久化子状态）：在线客户端不断连、不拒写；`persisting` 只通向 `closed`，不回 active（rulings §4.18 CO-15）。
- **PG 不可达时的收尾**（rulings §4.18 CO-16）：宽限到期、SIGTERM 或驱逐进入 `persisting` 时若 PG 不可达，不在 persisting 久等（SIGTERM 只有 30 s，ADR-0035 决策 9），先把内存档强制写入一级溢写再进入 `closed`；遗留溢写行的回放见 §6.4。
- 文档处于 `purging`（文档擦除编排，rulings §4.18 BE-15）时，加入房间一律拒绝；已打开的 Room 由擦除作业令 collab 踢出会话并关闭后才清理 update 与快照（落点 40-modules/08、09、12）。
- `loading` 的 bootstrap：读最新快照（`document_snapshots`）+ 其后 `document_updates` → `applyUpdate` 逐条 → 若 `meta.schemaVersion < 当前` 则在 Valkey 锁 `collab:migrate:{doc}` 下运行迁移事务（origin=`migration`）并立即落一个 `kind:'migration'` 快照。
- 预算：8 MB 状态的 bootstrap ≤ 500 ms（p95）；测量：span `server.room.load`。

### 5.3 时序：加入 → 同步 → 编辑 → 离开（正常路径）

**加入 → 同步 → 编辑 → 离开（正常路径）**

```mermaid
sequenceDiagram
  participant C as Client
  participant API as apps/server REST
  participant G as Gateway/Room
  participant PG as Postgres
  participant VK as Valkey
  C->>API: GET /api/v1/documents/:id/snapshots/latest，HTTP，ETag
  API-->>C: 200 state，V2，zstd
  C->>C: importState，local
  C->>API: POST /api/v1/documents/:id/collab-ticket
  API-->>C: ticket，60 s
  C->>G: WS connect /collab/v1/rooms/:id
  C->>G: CONTROL.auth{ticket}
  G->>G: verify JWT → role → room.join
  G-->>C: CONTROL.auth.ok{sessionId, role, serverSeq}
  C->>G: SYNC step1，sv
  G-->>C: SYNC step2，diff
  G->>C: SYNC step1，server asks
  C->>G: SYNC step2，diff of local pending
  Note over C,G: step2 视同一个 update 帧，恰好回一帧 db ack，空 diff 也回
  G->>G: apply → validate → persist
  G->>PG: INSERT document_updates
  G-->>C: CONTROL.ack{seq,tier:'db'}
  G->>VK: publish collab:doc:{id}
  C->>G: AWARENESS，local
  G->>G: fan-out
  G-->>C: SYNC update 与 AWARENESS，来自其他客户端
  C->>G: 编辑：SYNC update，其后处理同上
  C->>G: close 1000
  G->>G: leave → draining 60 s → persisting
```

怎么读：从上到下是时间顺序，实线箭头是请求或推送，虚线箭头是响应；自指箭头是该方的内部处理。两个 HTTP 请求由 apps/server 的 Snapshots 与 Documents 模块提供（08 §2），REST 统一挂 `/api/v1` 前缀、WS 维持 `/collab/v1/rooms/:id`（rulings §4.18 BE-11）；拆分部署时 `…/snapshots*` 由反代转给 collab 角色（BE-03）。握手的拒绝分支见 §6.3 下图，ack 的两级语义与 step2 的对应规则见 §6.4。

---

## 6. 同步协议帧（复用 y-protocols；信封定义在 `@cordexjs/protocol`）

### 6.1 决策

- **复用 y-protocols** 的 sync（`messageYjsSyncStep1/2`、`messageYjsUpdate`）与 awareness 编码，不自造 CRDT 同步；理由：与 y-websocket/Hocuspocus 生态互操作、经过生产验证、编码紧凑（lib0）。
- **自定义信封与控制面**：y-protocols 不覆盖鉴权、权限、ack、错误、房间控制。信封与 CONTROL 消息在 `@cordexjs/protocol` 定义（protocol 是 L0、不 import y-protocols：sync/awareness 的 payload 对 protocol 是 `Uint8Array` 不透明体，由 collab-yjs/server-collab 解码）。详见 ADR-0023。

### 6.2 二进制信封（`@cordexjs/protocol/src/collab/frame.ts`，草案）

```
byte 0        : FrameType   0x00 SYNC | 0x01 AWARENESS | 0x02 CONTROL | 0x03 QUERY_AWARENESS
byte 1..      : payload
  SYNC        : y-protocols sync 编码（varUint msgType: 0 step1 | 1 step2 | 2 update）
  AWARENESS   : y-protocols awareness 编码
  CONTROL     : UTF-8 JSON，schema = ControlMessage（zod 判别联合，见 6.3）
```

与 y-websocket 的 `messageSync=0 / messageAwareness=1 / messageAuth=2 / messageQueryAwareness=3` 保持编号一致（我们把 2 泛化为 CONTROL），便于用现成客户端做互操作测试。

### 6.3 CONTROL 消息（zod 判别联合 `type`，草案）

| 方向 | type | 字段 | 说明 |
|---|---|---|---|
| C→S | `auth` | `ticket, protocolVersion: 1, clientId: number(Yjs clientID), capabilities: string[], appVersion` | 连接后首帧；5 s 内未到 → 关闭 4408 |
| S→C | `auth.ok` | `sessionId, role, serverSeq, schemaVersion, limits{maxUpdateBytes, updateRateHz}, serverTime` | 成功后客户端才发 SYNC |
| S→C | `auth.denied` | `code: 'collab.unauthenticated' \| 'collab.forbidden' \| 'collab.doc_not_found' \| 'collab.schema_too_new' \| 'collab.room_full'` | 之后关闭 4401/4403/4404/4426/4503 |
| S→C | `permission` | `role, reason: 'granted' \| 'revoked' \| 'changed', permVersion` | 权限即时生效（§10） |
| S→C | `ack` | `{kind:'ack', tier:'spill'} \| {kind:'ack', tier:'db', seq: number}`（帧形状以 40-modules/02 `ws/frames.ts` 为准，不含 `count`/`localCounter`） | 两级 ack（rulings §4.15 S-3a）：服务端对每个入站 update 帧（含重连的 SyncStep2，§6.4）按到达顺序恰好回一帧 `tier:'db'`，带**该帧落库时分配的 seq**（逐帧应答，不是累计确认；at-least-once 保证的可观察点，客户端以在途 FIFO 队首对应并清 pending，§6.4）；`tier:'spill'` 表示 PG 故障期已写入溢写存储，无 seq，客户端**保留** pending、不据它做对应 |
| S→C | `error` | `code, retryable, details?` | 非致命错误（例如单个 update 被拒） |
| S→C | `repair` | `reason, paths[]` | 服务端发出修复事务时通知（§11） |
| C↔S | `ping` / `pong` | `t` | 应用层心跳 |
| S→C | `room` | `clients: number, draining?: boolean` | 房间元信息（用于 UI「N 人在线」的权威值） |

所有 CONTROL 消息经 zod `parse`（D2）；解析失败 → 4400 并记录 `collab.bad_frame`。

**Ticket → WS 握手与拒绝分支**

```mermaid
sequenceDiagram
  participant C as 客户端 collab-transport-ws
  participant G as CollabGateway
  participant TV as ticket-verifier
  participant VK as Valkey
  participant RM as RoomManager
  C->>G: WS 升级 /collab/v1/rooms/:documentId
  G->>G: 连接计数、IP 限流、启动首帧 5 s 计时
  alt 5 s 内未收到 CONTROL.auth
    G-->>C: 关闭 4408
  else 收到首帧
    C->>G: CONTROL.auth{ticket, protocolVersion:1, clientId, capabilities, appVersion}
    G->>TV: 校验 ticket
    TV->>TV: JWT 验签
    TV->>VK: jti 防重放，SETNX 60 s
    TV->>VK: 对比 permVersion，与最新值不同则以库为准
    TV-->>G: claims：sub、doc、role、permVersion，可选 sid 与 lnk
    G->>RM: attach connection 与 ticketClaims
    alt 准入成功
      RM-->>C: CONTROL.auth.ok{sessionId, role, serverSeq, schemaVersion, limits, serverTime}
      C->>RM: 此后才发 SYNC step1
    else 拒绝
      RM-->>C: CONTROL.auth.denied{code}
      Note over C,RM: unauthenticated→4401，forbidden→4403，doc_not_found→4404，schema_too_new→4426，room_full→4503
      Note over C,RM: 协议版本协商失败 collab.protocol_mismatch→4427，见 §18.5
    end
  end
```

怎么读：两层 `alt` 分别是「首帧是否按时到达」与「鉴权和准入是否通过」；拒绝时先回 `auth.denied` 再按注记里的 code→关闭码映射关闭连接。票据 claims 中 `sid` 是登录会话 id，`lnk` 是可选的分享链接 id（凭链接取得角色时才有，rulings §4.18 BE-02），供 §10 的角色重算复核链接状态。房间满时的只读降级见 §14 下图。
依据：本文 §6.3、§6.5、§10、§18.5；08 §2 `collab.gateway.ts`、`ticket-verifier.ts`、`ticket.service.ts`。

### 6.4 ack 与 at-least-once 持久化

- 客户端为每个发出的 update 帧分配本地 `localSeq`；服务端在持久化（INSERT 提交）后回 `ack{seq, tier:'db'}`；客户端**只在收到 `tier:'db'` 时**清理 OfflineStore 中的已确认段并统计 `pendingLocalUpdates`。
- **ack 与 localSeq 的对应**（以 40-modules/02 `ws/frames.ts` 的逐帧应答为唯一事实源，rulings §4.18 CO-09）：客户端按连接维护**在途 FIFO**（元素为 `localSeq`），每收到一帧 `tier:'db'` 弹出队首并 `ackUpTo(该 localSeq)`；`seq` 只更新 `meta.lastAckSeq`，从不与 `localSeq` 比较；`tier:'spill'` 不参与 FIFO 对应，只更新 `SessionStats`（degraded 标志、已接收计数）；断线清空 FIFO，未确认的 pending 留待重连发送（方式见下条）。
- **重连 step2 的应答与超限拆块**（rulings §4.18 CO-10）：`SyncStep2` 视同一个入站 update 帧——服务端对每个 step2 恰好回一帧 `tier:'db'`（空 diff 也回，seq 取当前 head）；客户端以发送 step2 时 pending 的最大 `localSeq` 作为**一个** FIFO 条目，收到即 `ackUpTo`，被 step2 覆盖的 pending 不再逐帧重发（避免重复落库）。step2 超过 `maxUpdateBytes`（1 MiB，§11 L1）时，先按 `localSeq` 用 `mergeUpdates` 切成不超限的块、逐块以普通 update 帧发送（每块一个 FIFO 条目，取块内最大 `localSeq`），再发只含剩余差量的 step2——剩余差量按服务端 step1 的 state vector 并上已发各块的 state vector 计算，通常为空；仍超限则上报遥测并提示导出、不无限重试（与 §9.3 编辑期拆分互相引用）。拆块只改客户端算法，帧格式与服务端门禁都不变。
- **PG 故障溢写期（S-3，细化为两级 ack，rulings §4.15 S-3a）**：update 写入溢写存储（Valkey / 对象存储）成功后回 `ack{tier:'spill'}`，客户端保留 pending；溢写行以 provisional key `(instanceId, localCounter)` 排序，**正式 seq 在 PG 恢复后回放时由 PG 分配**，回放完成后逐个回 `ack{seq, tier:'db'}`（补发时原会话已断开即丢弃，由重连 step2 兜底）；回放完成前新到的 update 排在回放队列之后落库，以保持 db ack 顺序；回放 bootstrap 之后断言服务端 Y.Doc 无 `pendingStructs`。即使溢写数据丢失，客户端重连 step2 仍凭 update 幂等性补齐，NF-03「已 ack（db）零丢失」成立；多实例临时 seq 冲突与 seqRange 契约矛盾一并消除。
- **回放归属**（rulings §4.18 CO-16）：存活实例只回放自己 `instanceId` 的溢写行（`readAllOrdered(docId, instanceId)`），不读其他在线实例的行，避免两实例重复回放（ADR-0035 决策 3）；心跳过期实例留下的行，由下次加载该文档的 Room 在 bootstrap 之后持 `lock:spill:{doc}` 租约认领回放。
- **降级期照常广播**（rulings §4.18 CO-08）：PG 写失败即进入降级期，update 通过门禁、进入 none（内存退避重试）/ valkey / blob 任一档后，**立即**在本实例广播并跨实例扇出，不等持久化；`persistBeforeBroadcast` 只约束 PG 可用时的顺序。持久性由发起方 pending 兜底（收到 `tier:'db'` 才清），其他收到广播的客户端重连时经 step2 回填，风险窗口与 `persistBeforeBroadcast=false` 相同，NF-03 不受影响；UI 显示「未保存到服务器」；指标 `cordex_collab_broadcast_before_persist_total` 记录降级广播次数。
- `Session.flush()` = 等待 `pending == 0`；关闭页面前由 UI 调用（`beforeunload` 提示）。
- 服务端崩溃于「已广播未落库」窗口：其他客户端已应用该 update 但库中缺失 → 它们下次同步时 step1/step2 会把该内容回填给服务端（CRDT 幂等），因此**最终不丢**；只有当所有持有该 update 的客户端都消失时才丢，故要求：PG 可用时广播前先落库（默认），或在配置 `persistBeforeBroadcast=false`（低延迟模式）时接受这一窄窗口。默认 `true`。

**update 两级 ack 时序**

```mermaid
sequenceDiagram
  participant C as 客户端 collab-yjs LocalBatcher
  participant R as server-collab Room
  participant PG as Postgres
  participant SP as 溢写存储 Valkey 或对象存储
  C->>C: 为 update 帧分配 localSeq，计入 pending
  C->>R: SYNC update
  alt PG 正常
    R->>PG: INSERT document_updates，seq 与 head_seq 同事务分配
    PG-->>R: 提交
    R-->>C: ack{seq, tier:'db'}
    R->>R: 落库后广播与跨实例扇出
    C->>C: 弹出在途 FIFO 队首 localSeq，ackUpTo
  else PG 故障降级期
    R->>R: 通过门禁即广播与跨实例扇出，不等持久化
    R->>SP: 写入，provisional key 为 instanceId、localCounter
    SP-->>R: 写入成功
    R-->>C: ack{tier:'spill'}，无 seq
    C->>C: 保留 pending，不参与 FIFO 对应
    Note over R,PG: PG 恢复后回放，过程见下图
    R->>PG: 按 provisional key 顺序回放，由 PG 分配正式 seq
    R-->>C: 逐个回 ack{seq, tier:'db'}，原会话已断开则丢弃
    C->>C: 此时才弹出 FIFO 队首并清理 pending
  end
  Note over C: Session.flush 等待 pending 为 0，关闭页面前由 UI 调用
```

怎么读：`alt` 两个分支分别是 PG 可用与 PG 故障降级期；只有 `tier:'db'` 的 ack 让客户端弹出在途 FIFO 队首并清 pending，`tier:'spill'` 只表示已进溢写存储、客户端必须继续保留（S-3a）。PG 可用时先落库后广播（`persistBeforeBroadcast=true`），降级期通过门禁即广播（rulings §4.18 CO-08）。
依据：本文 §6.3、§6.4；08 §5 写路径关键约束、§3.1 `update-writer.ts`、`spill-store.ts`；rulings §4.15 S-3a、§4.18 CO-08/CO-09。

**PG 故障溢写与回放**

```mermaid
flowchart TB
  pgDown["PG 写失败：进入降级期"] --> tier["update 通过门禁，进入 none、valkey 或 blob 任一档"]
  tier --> bcast["立即本实例广播并跨实例扇出，不等持久化；计数 cordex_collab_broadcast_before_persist_total"]
  tier --> spill["超一级阈值：写入溢写存储，Valkey 或对象存储"]
  spill --> ackSpill["回 ack{tier:'spill'}：无 seq，客户端保留 pending"]
  ackSpill --> pgUp["PG 恢复"]
  pgUp --> order["只读本实例 instanceId 的溢写行，按 provisional key 排序"]
  order --> assign["回放：正式 seq 由 PG 在回放时分配，新到 update 排在回放之后"]
  assign --> ackDb["逐个回 ack{seq, tier:'db'}：客户端据此清 pending"]
  ackDb --> assertNo["回放 bootstrap 之后断言服务端 Y.Doc 无 pendingStructs"]
  orphan["心跳过期实例的遗留行"] -. "下次加载该文档的 Room 持 lock:spill 租约认领" .-> order
  spill -. "溢写数据丢失" .-> lost["客户端重连，step2 凭 update 幂等性补齐"]
  assertNo --> nf03["NF-03「已 ack db 零丢失」成立"]
  lost --> nf03
```

怎么读：实线是正常的降级—溢写—回放主路径，虚线是两条兜底：遗留溢写行由下次加载该文档的 Room 认领回放（CO-16），溢写数据本身丢失时由客户端 step2 补齐；两条路径都收敛到 NF-03。降级期的广播与持久化并行，Room 始终保持 active（§5.2）。由于正式 seq 只在回放时由 PG 分配，多实例临时 seq 冲突与 seqRange 契约矛盾一并消除。

### 6.5 关闭码约定（`@cordexjs/protocol/src/collab/close-codes.ts`）

| 码 | 含义 | 客户端行为 |
|---|---|---|
| 1000 | 正常 | closed |
| 1001/1006 | 网络/对端离开 | backoff 重连 |
| 1012 | 服务重启/驻留实例驱逐 | 立即重连（不退避首轮） |
| 4400 | 坏帧 | 上报 bug，重连（计数超 3 次进入 quarantined） |
| 4401 | 未认证/票据过期 | 换票据重连 |
| 4403 | 无权限 | denied（监听权限变化） |
| 4404 | 文档不存在/已删除 | closed + 提示 |
| 4408 | 认证超时 | 重连 |
| 4409 | 被隔离（重复触发修复） | quarantined，提示刷新 |
| 4413 | 帧过大 | 丢弃该 update 到「未同步更改」并提示 |
| 4426 | schema 过新（客户端需升级） | 提示刷新 |
| 4429 | 速率限制 | 退避后重连 |
| 4503 | 房间不可用/满/draining | 退避重连 |

---

## 7. Awareness / Presence 模型（详见 ADR-0024）

### 7.1 状态 schema（`@cordexjs/protocol/src/collab/awareness.ts`，zod，草案）

```ts
interface AwarenessState {
  v: 1
  user: { id: UserId; name: string; color: string; avatar?: string }
  client: { id: number; device: 'desktop' | 'tablet' | 'phone'; appVersion: string }
  view?: { slideId: SlideId; zoom?: number }                        // Operation（视图状态）的广播形态
  selection?: { slideId: SlideId; shapeIds: ShapeId[] }
  caret?: { shapeId: ShapeId; anchor: string; head: string }        // RelativePosition(base64)
  editing?: ShapeId                                                 // 正在文本编辑的形状（用于「锁定提示」而非锁）
  idle?: boolean
  ts: number                                                        // 客户端时间，仅用于排序显示
}
```

- 大小上限 2 KiB/状态；服务端对超限或 schema 非法的 awareness 帧**丢弃**并计数（不关闭连接）。
- 频率：`caret`/`selection` 变化最多 20 Hz；`view` 等 2 Hz；`idle` 在 60 s 无输入后置位。awareness 超时 30 s（y-protocols 默认）→ 服务端也在会话断开时主动广播「移除」。
- Presence 服务是 UnitScope 服务，UI 覆盖层（07 §7）与设计 20-design/05 消费 `presence.remotes`。
- 不持久化、不审计内容（只审计 join/leave）。

**Awareness 广播时序**

```mermaid
sequenceDiagram
  participant A as 客户端 A，presence 与 AwarenessAdapter
  participant S as server-collab awareness-relay
  participant F as FanoutBus 基于 Valkey
  participant B as 客户端 B
  A->>A: presence.setLocal，caret 与 selection 至多 20 Hz，view 等 2 Hz，60 s 无输入置 idle
  A->>S: AWARENESS 帧
  alt 超过 2 KiB 或 schema 非法
    S->>S: 丢弃并计数，不关闭连接
  else 合法
    S->>B: 房间内扇出
    S->>F: 跨实例扇出，携带 instanceId 去重
    B->>B: zod 清洗 → presence.remotes → presence/changed
  end
  Note over S: 新加入者拿全量，满员房间由服务端做 awareness 合并 tick，查看者只上报 view
  A--xS: 会话断开
  S->>B: 主动广播移除
  Note over A,B: awareness 超时 30 s，不持久化，只审计 join 与 leave
```

怎么读：实线是 awareness 状态的流向，`--x` 表示连接中断；`alt` 是服务端对单个 awareness 帧的两种处理。客户端 B 收到后由 UI 覆盖层（07 §7）消费 `presence.remotes`。
依据：本文 §4.1、§7.1、§14；08 §3.1 `awareness-relay.ts`、`awareness-tick.ts`、`broadcast.ts`。

### 7.2 「软锁」语义

文本编辑不加锁（Yjs 字符级合并），但 UI 显示「X 正在编辑」（来自 `editing`）；形状拖拽亦不加锁，靠 LWW 收敛。**不做排他编辑锁**（章程 Q16 已裁决，rulings §4.16：只有 awareness 软提示，冲突按 CO-08 软冲突规则）；如将来需要，可作为可选插件基于 awareness + 服务端仲裁另立项。

---

## 8. 软冲突语义（并发但无「冲突错误」；全部自动收敛）

| # | 场景 | 原语层结果 | 用户可见结果与缓解 |
|---|---|---|---|
| 1 | A、B 同时把形状 S 移到不同位置（`xfrm.off`） | 两键 LWW，B（更晚时钟/更大 clientID）胜 | A 看到 S 「跳」到 B 的位置；无提示（与主流编辑器一致） |
| 2 | A 删除形状 S，B 同时编辑 S 文本 | 删除 = 写 `_deleted` 墓碑（rulings §4.15 Q3，04 §3.1a），实体与其 `XmlText` 仍在 Y.Doc 中；B 的文本编辑落在墓碑实体上、**不丢失**；读路径过滤使 S 不可见 | B 端：observe 到 S 被标墓碑且本地 60 s 内有对 S 的本地事务 → UI 提示「元素已被 A 删除」+「恢复」（清除墓碑，**原 id** 复活，连同 B 的编辑；这是 B 的新事务而非撤销）；A 撤销删除同样是清除墓碑、原 id 复活，二者并发不会产生重复元素；TTL（默认 24 h）后硬删除，或所有者对墓碑态元素做经审计的「彻底删除元素」（rulings §4.18 CO-07）后立即硬删除，之后不可恢复；删除方此后再撤销该步按整步跳过（`wholeStep:true`），与 TTL 到期同一路径 |
| 3 | A 删除幻灯片 P，B 在 P 中新增形状 | P 写墓碑；B 新增的形状 `containerId` 指向墓碑页 → 随 P 一并不可见（不变量：引用墓碑的形状视为已删除） | 同 #2 的提示，粒度为页；「恢复此页」清除 P 的墓碑，P 以原 id、原 `order` 复活，B 新增的形状随之可见 |
| 4 | A、B 都在第 3 页之后插入新页 | 两页都存在；`order` 键都在 (k3, k4) 之间，比较 `(order, id)` 得到确定顺序 | 两页相邻出现，顺序在所有端一致；无提示 |
| 5 | A 把 X 放入组 G，B 同时把 G 放入 X（父子环） | 两个 `parentId` 各自 LWW 成功 → 形成环 | **修复规则**（客户端 observe 后与服务端软门禁都执行，结果确定）：沿环取 id 字典序最大的节点，把它 `parentId` 置为 null（回到页根）；记录 `collab/repair`。fuzz 断言：修复后无环且所有端一致 |
| 6 | A 改 S 填充色，B 改 S 位置 | 不同键，都存活 | 期望行为 |
| 7 | A、B 同时编辑同一段落不同位置 | Yjs 字符级合并 | 期望行为；光标经 RelativePosition 保持相对位置 |
| 8 | A 在段落中回车分段，B 同时给被移动的尾部文本加粗 | 尾部文本被 A 删除+重插，B 的 format 落空 | 尾部失去加粗；已知限制（y-prosemirror 同）；缓解：分段实现优先「保留头部、移动较短的一侧」以减小受影响范围（**这不改变正确性，只降低概率**） |
| 9 | A 更换幻灯片版式，B 编辑占位符文本 | `layoutId` 与 `txBody` 不同键，都存活 | 渲染按新版式解析继承（架构 04），文本保留 |
| 10 | A 撤销自己的移动，但其间 B 也移动了同一形状 | undo 包装层检测到 `xfrm.off` 已被 B 后写 → **跳过该键、不覆盖他人**（契约字段 `undo.remoteConflict:'skip'`，rulings §4.15 Q3，不采用 Yjs 默认）；该撤销单元的其余键照常回退；若整步都被跳过 → 本次撤销停下，不连撤更早一步 | A 看到提示条「部分内容已被 B 修改，未撤销」+「恢复我的值」（新的本地事务，写回 A 的旧值，可再被撤销）；emit `store/undo-skipped`（**单独统计**跳过次数与整步跳过次数，不计入 `collab/soft-conflict` 软冲突率，rulings §4.17 D5）；撤销目标已被他人删除（墓碑 TTL 内亦然）同样跳过并提示、**不复活**，恢复由删除方撤销或「恢复元素」完成（rulings §4.17 D4）；文档化于设计 05、PRD CO-08/CO-09 |
| 11 | 离线的 A 修改了 S，在线的 B 早已删除 S | S 为墓碑：重连后 A 的修改合入墓碑实体（不可见但不丢）；若 B 的删除已超过 TTL 被硬删除，A 的修改落在已删类型上被丢弃 | A 收到 #2 的提示，可「恢复」（TTL 内）；超 TTL 时 A 的离线更改可从「未同步更改」导出为 JSON |
| 12 | A 被降权为 viewer 时仍有 pending update | 服务端拒绝（`error{collab.forbidden}`），不落库不广播 | A 端把被拒的本地事务放入「未同步更改」（本地 OfflineStore 的 `rejected` 区），横幅提示可导出/复制；本地视图保留还是回滚？→ **回滚**到服务端状态（fail-closed 一致性优先），提供导出（待产品确认 P3） |

**机械验证**：每一行对应 `test/collab-sim/scenarios/<n>.test.ts` 的确定性脚本（固定 clientID 与时钟），加 fuzz 的随机覆盖。

---

## 9. 大文档加载与体积治理（rulings §4.15 Q5 两层口径：性能保证包络 D200 / 20 编辑者 + 50 查看者 / 200 MB；系统天花板 200 页 / 单页 1,000 / 文档总元素 20,000）

### 9.1 加载策略：HTTP 快照 bootstrap + WS 增量

1. `GET /api/v1/documents/:id/snapshots/latest`（ETag = snapshot id；zstd 压缩的 V2 update；可被 CDN/浏览器缓存）→ 客户端在空 Y.Doc 上 `applyUpdate`（origin=`import`，不入撤销栈）。
2. 并行建立 WS；`auth.ok` 后 `SyncStep1` 只交换**差量**（通常几十 KB）。
3. 首屏渲染不等待 `live`：`syncing` 状态即可渲染与编辑（本地 pending 排队）。协同模式**不走** 07 §14.2 的「Worker 分批解析 + 首批装载、后台追加」打开路径（那条路径只用于本地打开 .pptx，rulings §4.18 CO-12）：Y 状态一次由 HTTP 快照 bootstrap。
4. 媒体字节按需拉取（`BlobRef.sha256` → `GET /api/v1/media/:sha256`，强缓存），并受渲染层 LRU（07）约束。

体积估算与预算（供设计容量）：200 页 × 30 形状 × ~25 键 × ~40 B ≈ 6 MB（未压缩 V2 update），富文本 200 页 × 600 字 ≈ 1 MB；**预算：单文档 Y 状态 ≤ 16 MB（未压缩）/ ≤ 4 MB（zstd）**（D200 包络内）。**内存按实测**（决策包实测 Yjs 约 13.8 KB 堆/元素）：D200（≈ 6,000 元素）≈ 85 MB、D50 ≈ 17.8 MB、天花板 20,000 元素 ≈ 276 MB；墓碑在 TTL 内计入元素数与 Y 状态体积。服务端房间准入据此改为**按文档实测权重**（§14），不再按固定 MB/房间；`store.limits` 在 64 MiB 触发告警（不阻断）。**时间预算：** 200 页文档在 10 Mbps 下 time-to-synced ≤ 3 s（p75），首页可见 ≤ 1.5 s（见 07）。测量：span `collab.bootstrap`（含 HTTP 与 step2）。

### 9.2 为什么 M3 不用 Yjs subdocs（按页懒加载）

- 200 页的 CRDT 状态在预算之内；subdocs 的 provider 支持不成熟（y-websocket 部分支持，Hocuspocus 不支持），跨 subdoc 的 UndoManager/RelativePosition/事务原子性（跨页移动形状）都要自造。
- **触发重评估的条件**（写入 ADR-0020 后果）：实测 p95 bootstrap 超预算 2 倍、或产品把规模上限提升到 ≥ 1000 页。届时方案：`slides/<id>` 值改为 `Y.Doc`（subdoc），页顺序仍在父文档。

### 9.3 更新流量治理

- 本地 50 ms 合并（键入 1 字 ≈ 30–60 B；合并后每帧 ≤ 数百 B）。
- 单 update 帧上限 1 MiB（超过多为粘贴大表格/导入）；超限 → 客户端**拆分事务**（命令层按形状分批，A 线契约：`commands` 支持 `chunked` 选项）或走 HTTP 导入路径。本条只覆盖编辑期；重连时离线积累的更改合成的 step2 超限，按 §6.4「重连 step2 的应答与超限拆块」先拆块再发（rulings §4.18 CO-10），不会因 L1 拒收陷入断连重发的死循环。
- 速率上限：每连接 200 帧/s（突发 500，令牌桶；PRD CO-12）、10 MiB/min；awareness 节流 ≥ 50 ms（≤ 20 帧/s）；超限关闭 4429。

### 9.4 长期增长：结构数与 epoch（已知限制）

Yjs 删除留下结构元数据（内容 GC 后仍占若干字节/结构）。监控 `cordex_ydoc_structs`（来自 `yjsBackend.stats()`），阈值 5M。超阈值的治理路径「**换纪元（epoch）**」：服务端在无在线编辑者的维护窗口把当前模型 `exportSnapshot()` 后导入全新 Y.Doc（`meta.epoch + 1`），旧纪元客户端连入时收到 `auth.denied{collab.epoch_changed}` 需刷新；其离线更改通过模型级 diff 转成新纪元的 Mutation（M5+ 才实现；M3 只做监控与手动触发）。列入待决事项 P5。

---

## 10. 权限变更即时生效（D12 双点 fail-closed）

**权限变更即时生效链路**

```mermaid
flowchart TB
  patch["权限变更：REST PUT 或 DELETE /api/v1/documents/:id/permissions，或撤销分享链接"] --> svc["PermissionsService 写库 + permVersion++"]
  svc --> pub["Valkey PUBLISH perm:doc:{id} {permVersion}"]
  pub --> rm["各实例 RoomManager 收到"]
  rm --> recompute["对该 room 的每个 Session 重新计算 role：max（直接授权，票据 lnk 对应链接的有效角色）"]
  recompute -- "升权" --> up["CONTROL.permission{role, 'granted'}"]
  recompute -- "降权" --> down["CONTROL.permission{role, 'changed'}"]
  recompute -- "撤销" --> revoke["CONTROL.permission{role:'none', 'revoked'} + 关闭 4403"]
  up --> upC["客户端：permissions 快照更新 → 命令管线放开，readonly → live"]
  down --> downC["客户端：pending 里 role 不足的 update 本地丢弃到 rejected，live → readonly"]
  revoke --> revokeC["awareness 移除广播"]
  inbound["服务端每个入站 SYNC update 帧"] --> check["检查 session.role ≥ editor：fail-closed，不依赖客户端自律"]
```

怎么读：上半部分是一次权限变更从 REST 写库到各实例、各会话的传播，三个分支按变更方向分别下发不同的 CONTROL.permission；与主链不相连的最后两个节点是与传播并行、始终生效的服务端逐帧检查。客户端侧收到权限帧后经 `permissions.applyRemoteDecisions` 唯一入口生效（§18.3）。

- 票据（ticket）里携带 `permVersion`；连接时若与 Valkey 中的最新值不同则以库为准（防止用旧票据绕过）。
- **凭分享链接加入的会话**（rulings §4.18 BE-02，「解析归权限模块」）：票据增可选 claim `lnk`（shareLinkId；`sid` 仍指登录会话 id）。链接令牌的解析由 PermissionsModule 导出的 `ResolveShareLinkUseCase`（经 SECURITY DEFINER 函数只读 `share_links`）完成，REST 侧 ShareLinkGuard 与 WS 侧 AuthzSource 共用同一用例，两处解析结果必须一致；ShareLinks 模块只管创建、撤销、列表与守卫。AuthzSource 重算时取 `max(直接授权, lnk 对应链接仍有效时的角色)`，因此他人改动文档权限不会把只凭链接加入的会话误降为 none；链接撤销随 `permVersion` 广播，≤ 1 s 降权；会话记录 `linkExpiresAt`，到期由服务端主动重算降权，不等下一次权限事件。机械验证：集成用例「他人改权限不踢链接会话」「撤销链接后 ≤ 1 s 降权」「链接到期后主动降权」（落点 40-modules/08、09）。
- 传播预算：变更到所有在线会话生效 ≤ 1 s（p95；PRD 门禁 ≤ 2 s）；测量：审计事件时间戳与 `permission/changed` 的 telemetry 事件差。
- 客户端检查点（命令管线的 `permissions` waterfall，架构 05）是**UX 守卫**；服务端网关是**安全边界**。两者都缺省拒绝。

---

## 11. 服务端对 update 的校验策略（详见 ADR-0034）

| 层 | 检查 | 失败处理 | 成本 |
|---|---|---|---|
| 硬门禁 L1（帧） | 信封类型合法、CONTROL zod 通过、payload ≤ 1 MiB、速率 | 4400/4413/4429；不广播不落库 | O(1) |
| 硬门禁 L2（权限） | `session.role ≥ editor`；文档非 `locked` | `error{collab.forbidden}`；计数；3 次 → 4403 | O(1) |
| 硬门禁 L3（结构） | `Y.decodeUpdateV2` 可解析；结构数 ≤ 50k/帧 | 4400 | O(帧大小) |
| 软门禁 L4（语义） | 在服务端 Unit 上 `applyUpdate` 后，对 `ChangeSet.paths` 做 zod 校验（model-slide 的 schema，架构 04）与不变量检查（无父子环、`parentId` 存在、`layoutId` 存在、`order` 为合法 FracKey、`schemaVersion` 未被改） | **修复事务**：服务端以 origin=`repair` 写补偿 Mutation（如置 `parentId=null`、恢复 `schemaVersion`、为非法 `order` 生成新键），广播 `CONTROL.repair`；同一 session 10 分钟内触发 ≥ 5 次 → 4409 quarantined | O(变更路径) |

- 为什么不「拒绝并回滚」：CRDT 已把 update 交给了其他客户端（或即将），单点拒绝会导致分叉；补偿事务保持全网收敛（I7）。
- 为什么仍要做：schema 与不变量是渲染/导出代码的前提（fail-closed 的另一面——数据层不能信任任意客户端）。
- 校验只在服务端做完整版；客户端 observe 时做**轻量**环/孤儿修复以保证本地渲染稳定（结果与服务端确定性一致，因为规则相同、输入相同）。

**入站 update 的四层门禁**

```mermaid
flowchart TB
  frame["入站帧"] --> l1{"L1 帧：信封类型合法、CONTROL zod 通过、payload ≤ 1 MiB、速率"}
  l1 -- "失败" --> l1f["关闭 4400 / 4413 / 4429，不广播不落库"]
  l1 -- "通过" --> l2{"L2 权限：session.role ≥ editor 且文档非 locked"}
  l2 -- "失败" --> l2f["error{collab.forbidden} 并计数，3 次 → 4403"]
  l2 -- "通过" --> l3{"L3 结构：Y.decodeUpdateV2 可解析、结构数 ≤ 50k/帧"}
  l3 -- "失败" --> l3f["关闭 4400"]
  l3 -- "通过" --> l4["L4 语义：在服务端 Unit 上 applyUpdate，对 ChangeSet.paths 做 zod 校验与不变量检查"]
  l4 --> ok{"schema 与不变量成立？"}
  ok -- "否" --> repair["修复事务：origin=repair 写补偿 Mutation，广播 CONTROL.repair"]
  repair --> quarantine["同一 session 10 分钟内 ≥ 5 次 → 4409 quarantined"]
  ok -- "是" --> persist["持久化与扇出"]
  repair --> persist
```

怎么读：菱形是逐层判定，L1–L3 是硬门禁，失败即拒绝且不扇出（I8）；L4 是软门禁，不拒绝而是追加修复事务以保持全网收敛（I7）。L4 的行为受 `softGate` 配置（`repair`、`report-only`、`off`）控制：M3 默认不变量 `repair`、schema 类型 `report-only`，已裁决（rulings §4.1 P8：采纳 ADR-0034，§18.5）。

---

## 12. 离线队列与重连（详见 ADR-0033）

- Provider：`OfflineStore` 由 `y-indexeddb`-风格的 IndexedDB 实现；**collab-yjs 本身保持 iso**，IndexedDB 实现放在 dom 包 `@cordexjs/collab-offline-idb`（L4，总编排已批准 S1，进入章程 v0.2 包清单；未加载该 Provider 时 collab-yjs 降级为内存队列，刷新即丢）。
- 存储布局：`cordex-collab/<userId>/<documentId>`（单组织部署无租户维度，rulings §4.15 T-0；按用户分库便于登出清空）：`updates`（追加的本地 update，附 `localSeq`）、`state`（compact 后的完整状态）、`rejected`（被服务端拒绝的事务快照，供导出）、`meta{epoch, schemaVersion, lastAckSeq}`。上限 50 MiB/文档；超限停止写入并提示。
- 安全：登出时清空该用户全部本地库；内容属于文档，**不**做客户端加密（与产品确认 P4）。
- 重连：退避 1 s→2 s→…→30 s（±20% 抖动）；**自进入重连起累计 30 s 仍未连上**（`offlineAfterMs`，令牌刷新的网络失败共用同一计时）或 `navigator.onLine=false` 立即进入 `offline`（继续本地编辑；rulings §4.18 UX-03，按时间而非次数，测试用假时钟断言「29.9 s 未离线、30 s 离线」）。**offline 后不停止重试**（rulings §4.18 CO-03）：每 30 s（±20% 抖动）自动重连一次，`navigator.onLine=false` 期间暂停；收到 `online` 事件或用户点「立即重连」（`reconnectNow`）立即进入 `connecting`，因此服务端故障恢复后会话无需人工操作即可回连（契约场景用例：服务端恢复后 offline 会话 ≤ 36 s 自动回连、断网期间不发起连接，FixedClock 断言）。step1/step2 天然合并离线更改（step2 的应答与超限拆块见 §6.4）；随后 `ack` 清理本地 `updates`。

**离线编辑与重连合并**

```mermaid
sequenceDiagram
  participant U as 用户
  participant CY as collab-yjs Session 与 offline-queue
  participant OS as OfflineStore 即 collab-offline-idb
  participant G as 网关与 Room
  Note over CY,OS: 若离线期间刷新页面：启动时 loadState 与 loadPending，以 origin=LocalOrigin 重放，不入撤销栈
  CY->>CY: 退避 1 s → 2 s → … → 30 s，±20% 抖动
  CY->>CY: 累计 30 s 未连上或 navigator.onLine=false → offline
  U->>CY: 继续本地编辑
  CY->>OS: appendPending，update 与 localSeq
  Note over OS: 单文档上限 50 MiB，超限停止持久化并提示，会话继续编辑
  CY->>CY: online 事件、reconnectNow 或 30 s 周期重连 → connecting
  CY->>G: CONTROL.auth 握手，见 §6.3
  G-->>CY: CONTROL.auth.ok
  CY->>G: SYNC step1
  G-->>CY: SYNC step2，服务端差量
  G->>CY: SYNC step1
  opt 本地差量超过 1 MiB
    CY->>G: 按 localSeq 用 mergeUpdates 拆块，逐块以 update 帧发送
    G-->>CY: 每块一帧 ack{seq, tier:'db'}
  end
  CY->>G: SYNC step2，含离线期间剩余的本地更改
  G-->>CY: ack{seq, tier:'db'}，step2 视同一帧
  CY->>OS: ackUpTo 该 step2 覆盖的最大 localSeq，删除已确认的 pending
  CY->>OS: synced 后 compact state 与 meta
  Note over CY,OS: epoch 或 schemaVersion 与服务端不一致的本地数据移入 rejected
```

怎么读：时间自上而下；离线期间所有本地 update 只追加到 OfflineStore，重连后靠 step1/step2 的双向差量把离线更改合并进服务端，再由 `tier:'db'` 的 ack 逐段清理；`opt` 段是差量超过单帧上限时的先行拆块（rulings §4.18 CO-10）。进入 offline 按时间判据，离开 offline 有三条出口（UX-03、CO-03）。
依据：本文 §4.2 `offline-queue.ts`、§6.4、§12、§18.6。

---

## 13. 与 Univer 的对照

| Univer 条目 | Univer 做法 | 本项目 |
|---|---|---|
| 决策 #1（K1）：Mutation 是协同最小单元 | Mutation 作为 OT 变换单元，服务端 transform（闭源协同） | **继承语义、改变机制**：Mutation 仍是权限/审计/撤销的单元（05），但冲突解决下沉到 CRDT 原语（键级 LWW、字符级 YATA、实体 delete-wins），无需服务端 transform，也无闭源接缝（A13） |
| 缺陷 #3：手写逆操作 | 每个 Mutation 手写 undo mutation | `Y.UndoManager` 按 origin 推导；store-memory 用不可变 diff 推导；**代码库禁止手写逆操作**（lint：Mutation 定义中不允许 `inverse`/`undoMutation` 字段，由 09-02 承接） |
| A31：Worker 第二份模型靠 27 条白名单收敛 | Worker 内维护模型副本 | 单一事实源 Y.Doc；若未来需要 Worker 做纯计算（布局/缩略图），Worker 只接收 update 流并持有**只读**副本（同一份 store-yjs 代码），不接受写入 |
| A32：编辑态跨三个模型两个异步边界 | 编辑缓冲 → 文档模型 → 渲染模型 | 文本编辑直接写 `Y.XmlText`（07 §6：隐藏输入框仅转发按键/IME 事件，组合中文本为**瞬态覆盖层**而非缓冲模型） |
| A10：全局可变注册表污染多实例 | 全局 Registry | 每 Unit 一个 Fiber/Y.Doc；`isolate` 保证同页多文档互不可见（lifecycle 测试） |

---

## 14. 性能与可靠性预算汇总（测量方式见 10/11）

| 指标 | 预算 | 测量 |
|---|---|---|
| 本地回显 | 同步（observe 在 transact 返回前触发） | 单测 |
| 服务端单 update 处理（校验+落库+扇出） | ≤ 20 ms p95 | span `server.collab.update` |
| 端到端传播（客户端→服务端→其他客户端） | ≤ RTT + 100 ms p95 | e2e 双浏览器时间戳差 |
| time-to-synced（200 页，10 Mbps） | ≤ 3 s p75 | span `collab.bootstrap` |
| 键入 update 大小（合并后） | ≤ 200 B p50 | 单测统计 |
| 房间容量 | 20 编辑者 + 50 查看者（Q5/SV-05）；**名额按用户计**（同一用户多标签/多设备占 1；commenter 计入查看者；owner 保席、不占编辑者名额）；编辑者满 → 只读加入，查看者也满 → 拒绝（`collab.room_full`）；满员房间由服务端做 awareness 合并 tick，查看者只上报 view | conformance「房间满」 |
| 权限变更传播 | ≤ 1 s p95 | 审计时间戳 vs 客户端事件 |
| 重连恢复（网络抖动 1 次） | ≤ 3 s 至 live | e2e 断网模拟 |
| Room bootstrap | ≤ 500 ms p95 @ 8 MB | span `server.room.load` |
| 每实例房间准入 | **按文档实测权重**（rulings §4.15 Q5）：房间权重 = 该文档实测 Y 堆（≈ 13.8 KB/元素 × 元素数，墓碑计入；D200 ≈ 85 MB、D50 ≈ 17.8 MB），实例按「已占权重 + 新房间权重 ≤ 实例内存预算」准入；**实例内存预算 = 容器内存上限（cgroup 限额，Node `process.constrainedMemory()`；无限额时取物理内存）× `room.memoryAdmissionPct`（默认 75，部署可调）**（rulings §4.18 BE-29；与 08 §16.5「≤ 75% 内存预算」同义，75% 已含在预算里）；预算不足时先按 LRU 提前结束 draining 房间再重判（CO-14），仍不足 → 引导到其他实例或 `collab.room_full`；ADR-0035 的多副本相乘计入；RM-S（2 vCPU / 4 GB）为 collab 单实例口径，「≥ 200 房间」按文档规模分档、M1 实测后回填 | 指标 `cordex_collab_rooms_active`、`cordex_collab_room_weight_bytes`、进程 RSS |

**房间准入：实例权重与名额**

```mermaid
flowchart TB
  join["鉴权通过的加入请求"] --> hasRoom{"本实例已有该文档的 Room？"}
  hasRoom -- "否" --> weight["房间权重 = 实测 Y 堆 ≈ 13.8 KB/元素 × 元素数，墓碑计入"]
  weight --> budget{"已占权重 + 新房间权重 ≤ 实例内存预算？预算 = 容器内存上限 × memoryAdmissionPct，多副本按副本数相乘计入"}
  budget -- "否" --> reclaim["先按 LRU 提前结束 draining 房间：draining → persisting → closed，无需 1012"]
  reclaim --> rejudge{"回收后重判：仍超预算？"}
  rejudge -- "是" --> instFull["collab.room_full 或 4503，引导到其他实例"]
  rejudge -- "否" --> loading
  budget -- "是" --> loading["新建 Room，进入 loading"]
  hasRoom -- "是" --> role{"按用户计名额：该用户的角色"}
  loading --> role
  role -- "owner" --> ownerSeat["保席加入，不占编辑者名额"]
  role -- "editor" --> editors{"编辑者名额未满 20？"}
  role -- "commenter 或 viewer" --> viewers{"查看者名额未满 50？"}
  editors -- "是" --> asEditor["以 editor 加入"]
  editors -- "否" --> viewers
  viewers -- "是" --> asViewer["只读加入：editor 降级时 auth.ok{role:'viewer', reason:'capacity'}"]
  viewers -- "否" --> denied["auth.denied{collab.room_full}"]
```

怎么读：上半段是实例级准入（按文档实测权重，rulings §4.15 Q5；预算不足时先回收空闲房间再重判，rulings §4.18 CO-14），下半段是房间内名额（按用户计：同一用户多标签/多设备占 1，commenter 计入查看者）。准入先于 loading，权重取 `documents.element_count`，不需预加载文档；本实例已有 Room 时只判名额。满员房间由服务端做 awareness 合并 tick、查看者只上报 view。
依据：本文 §14、§18.5 SV-05；08 §3.1 `room-manager.ts`、§8、§16.5（预算取内存的 75%）。

---

## 15. 待决事项（需要谁决策）

| # | 事项 | 默认 | 决策人 |
|---|---|---|---|
| P1 | 是否需要「排他编辑锁」（形状级/页级） | **已裁决**（章程 Q16，rulings §4.16）：不做，只有 awareness 软提示 | 已裁决 |
| P2 | 版本历史保留策略（自动快照频率与保留期） | **已裁决**（章程 Q17，rulings §4.16）：自动每 10 min 或 500 updates、保留 30 天；命名快照永久；全部进入部署配置可调（08 `retention`/`compaction`） | 已裁决 |
| P3 | 降权后本地未同步更改：回滚还是保留只读视图 | 回滚 + 可导出 | 产品/设计 |
| P4 | 离线本地库是否加密 | 不加密；登出清空 | 安全/产品 |
| P5 | epoch 换纪元的触发与 UX | M3 仅监控；手动维护 | 架构 A + 产品 |
| P6 | 评论锚点在目标删除后的展示 | 转为「已分离」列表（08 §6） | 设计 |
| P7 | `persistBeforeBroadcast` 默认值 | `true`（一致性优先），只约束 PG 可用时的顺序；PG 故障降级期照常广播（rulings §4.18 CO-08，§6.4） | 架构 B（本文默认） |
| P8 | 服务端是否执行语义软门禁（PRD CO-12 说「不做」，ADR-0034 主张「不变量修复」） | **已裁决**（rulings §4.1 P8：采纳 ADR-0034）：`softGate: repair`（不变量）+ `report-only`（schema 类型） | 已裁决 |

## 16. 对章程的异议/建议

- **S1（已批准，进入章程 v0.2）**：新增 dom 包 `@cordexjs/collab-offline-idb`（L4，`OfflineStore` Provider，唯一 import `y-indexeddb` 或自写 IDB 适配）；否则 collab-yjs 无法保持 iso 又提供离线持久化。
- **S2**：§5.3 规则 4 的允许列表补充：`y-indexeddb` 仅 `collab-offline-idb`；`lib0` 仅 `collab-yjs`/`server-collab`（y-protocols 的编码依赖）。
- **S3**：术语表建议新增：Room、Session、Ticket、Update、StateVector、Compaction、Repair（见下）。
- **S4**：D12 建议补一句：「服务端软门禁（schema/不变量修复）是数据完整性边界，与权限边界并列」。

## 17. 跨条线要求（摘要，详见最终汇报）

- 对 A 线（03/04/05）：`DocumentStore` Definition 采用 §1.2 的 6 原语与 §2.2 的 `TransactionMeta.origin`/`ChangeSet.paths`；Mutation 载荷禁止数组下标；`history` 只做 Store 门面；`permissions` 支持外部更新快照；`units.open` 支持「先开空 Unit 后同步」；model-slide 提供 `validateChangeSet(paths)` 与不变量修复规则的纯函数（服务端与客户端共用）。
- 对类型治理线：store-yjs 公共 API 禁止出现 `Y.*` 类型（api-extractor）；Mutation schema 禁止 `index` 字段（lint `cordex/no-index-in-mutation`）；Mutation 定义禁止 `inverse` 字段（lint）。

## 术语补充

| 术语 | 定义 |
|---|---|
| Room | 服务端为一份文档维护的协同会话集合与其 Y.Doc 副本（= 服务端 Unit） |
| Session | 一个客户端与一个 Room 的连接生命周期（状态机见 §5.1） |
| Ticket | 短时（60 s）签名凭据，用于 WS 握手，携带 role 与 permVersion |
| Update | Yjs 的二进制增量（V2 编码） |
| StateVector | Yjs 各 client 已知时钟的向量，用于差量同步 |
| Compaction | 用一个快照替换其前的 update 序列（ADR-0025） |
| Repair | 服务端软门禁发出的补偿事务（origin=`repair`） |
| FracKey | fractional index 字符串（ADR-0032） |

---

## 18. v0.2 补充：与架构 04/05 契约的对齐、PRD（CO/SV/EM）条目的承接

> 追加于 A 线 02/03/04/05 与产品线 10-prd 落盘之后。凡与前文冲突处以本节为准（前文保留以显示演进）。总编排已批准：S1（`@cordexjs/collab-offline-idb`）、服务名 `ctx.collabTransport`、UnitScope 服务 `ctx.selection`。

### 18.1 `StoreOp`（04 §2.3）→ Y 操作（store-yjs `mapping/apply-op.ts`）

04 定义的 **5 种** `StoreOp`（`set/delete/insert/remove/text`；总编排最终裁决去掉 `move`）是**本地**原语（不上网络）；本文 §1.2 的 6 种「值形状」是它们作用的对象。映射：

| StoreOp | 目标值形状 | Y 操作 | 并发语义 |
|---|---|---|---|
| `set(path, value)` | Record 键 / 叶子 | `Y.Map.set`（嵌套 Record 递归建 Y.Map；标量与 JSON 字串直接写） | 键级 LWW |
| `delete(path)` | Record 键 / 实体 | `Y.Map.delete` | delete-wins |
| `insert(path, index, items)` | **有序实体列表**（`slides`、`shapes`（`parentId` + `z`）、`tbl.rows`/`row.cells`、`txBody.paragraphs`） | **不用于实体列表**：命令层经 `@cordexjs/shared/order` 计算键，`lower()` 产出 `set(entities/<id>, record{ order })`（Snapshot 与 Y.Doc 都保留 `order` 键，ADR-0013 第 7 条） | 并发同位插入 → 都存在，按 `(order, id)` 全序 |
| `remove(path, index, count)` | 同上 | **不用于实体列表**：用户删除有身份实体时 `lower()` 产出 `set(entities/<id>/_deleted, {at, by})`（软删除墓碑，rulings §4.15 Q3，04 §3.1a）；`delete(entities/<id>)` 只由 TTL 硬删除作业、文档擦除（「永久删除文档」）与所有者经审计的「彻底删除元素」（只对墓碑态元素，经 `POST /api/v1/documents/:id/elements/purge` 交 server-collab 单写者以 `system('maintenance')` 执行，rulings §4.18 CO-07）产生 | 墓碑 = 键级 LWW（撤销 = 清除墓碑、同 id 复活）；硬删除后 delete-wins |
| （无 `move` 原语） | 有身份实体 | **弃用 `move` 的原因**（总编排裁决）：顺序已由 `order: FracKey` 承载，移动只是 `set(entities/<id>/order, key)`（**单键写**，ADR-0032）；跨父移动 = `set(parentId)` + `set(order)`；原子数组极少移动且 `Y.Array` 无原生 move，`remove` + `insert` 即可 | 实体移动：LWW，无重复无丢失 |
| `insert/remove` | **非身份数组**（schema 声明为 `list` 的渐变色标、几何路径命令、`gridCol` 宽度等） | 直接落为 `Y.Array` 的 `insert/delete`；「移动」= `remove` + `insert`，并发时可能重复或丢失——**已知风险**，由幂等规则（同位同值去重）与 rekey/修复规则兜底；需要整体一致的小数组按 §1.5 用 JSON 叶子 `set` 整体 LWW | 元素级；移动无原生保证 |
| `text(path, delta)` | 段落的 `Y.XmlText` | `applyDelta`（与 Y.Text delta 同形；04 要求与 store-memory 语义一致） | 字符级 YATA |

- 列表形状由 `DocumentType.bodySchema` 注解决定（例：`z.array(idSchema).describe('ordered-entities')`；未注解数组一律按原子数组处理）——**对 A 线的要求**。
- 下标不进入 Store（总编排裁决，ADR-0032 第 7 条）：键由命令层计算，Mutation 携带最终键，`lower()` 纯函数；`TransactionRecord.ops` 因 `set` 自带键而天然可回放，无需锚点字段。索引式 `StoreOp.insert/remove` 只保留给非身份数组（`Y.Array`）；`StoreOp` 无 `move`。
- Snapshot ↔ Y.Doc：Snapshot 的归一化实体表（A-9）**保留 `order: FracKey` 键**（ADR-0013 第 7 条），`load`/`toSnapshotBody` 原样搬运，无数组转换；导出到 OOXML 时由编解码器按 `(order, id)` 排序。
- 富文本：`TextBody.paragraphs` = `Y.XmlFragment` 的子元素序列；`paragraphs[i]` 内文本 = 该 `<p>` 的 `Y.XmlText`。因此 `text` op 的 `path` 必须定位到**段落**（`…/txBody/paragraphs/{paragraphId}`）；段落级 `insert/remove` = XmlFragment 子元素插入/删除；段落移动 = `remove` + `insert`（XmlFragment 无键序，且 `StoreOp` 无 `move`），是本文唯一的删除+插入式移动；并发移动同一段落可能出现两份同 `id` 段落 → 修复规则保留位置靠前者（确定性），fuzz 覆盖。

### 18.2 `Origin` / `TransactOptions` / `ChangeSet` 的对齐

| 本文 v0.1 | 04/05 契约（以之为准） | 备注 |
|---|---|---|
| `TransactionMeta{origin, undoable}` | `TransactOptions{origin, label, meta?, undoable?}` | `label` 参与撤销合并（05 §6，`coalesceMs` 500） |
| `ChangeSet.paths` | `ChangeSet.touched`（前缀去重） | 语义相同 |
| `ChangeSet.ops` | 本地事务 = 已应用 StoreOp；**远端/修复事务**：由 Y 事件推导（`set/delete/text`，尽力而为），`touched` 为权威 | **对 A 线**：远端 `ops` 标注 `derived: true` 或允许为空 |
| `LocalOrigin/RemoteOrigin/ImportOrigin/RepairOrigin…` | `Origin = local(clientId) \| remote \| system(load\|import\|migration) \| replay` | **对 A 线的增补请求**：`system.reason` 增加 `'repair' \| 'restore' \| 'maintenance'`；`local` 增加可选 `via: 'undo' \| 'redo'`（EM-05 要求 `store/transaction` 区分撤销来源） |
| `runDocumentStoreConformance` | 同名（总编排裁决：契约套件统一命名 `run<Definition>Conformance`，位于 `model-core/testing`） | **store-yjs 的验收 = 通过该套件**；本文 §8 冲突表进入其「协同分节」，并新增两条用例：「并发同位插入按 `(order, id)` 全序一致」「rekey 后顺序不变」 |
| `yjsBackend` 服务 | 02 §4.7 `doc-access.ts`（unique symbol，`@internal`） | 二选一；本文建议 `yjsBackend`（可被测试替身替换、不外泄 Y 类型），由 A 线定稿 |
| `undo.captureTimeout: 500` | 02 写 300，05 写 `coalesceMs` 500 | 以 05 的 500 为准，请 A 线修正 02 |

### 18.3 权限、Selection、会话状态与 PRD 名称的对齐

- 网关下发的权限帧 → `permissions.applyRemoteDecisions(decisions)`（collab-core `permission-checkpoint.ts`，02 §4.11）→ 命令管线 `waterfall` 检查点即时生效并 emit `permission/changed`（PRD EM-05 名称）。**`applyRemoteDecisions` 是权限变更进入客户端的唯一入口**：collab-yjs 不维护自己的权限快照、不发权限事件；`permission/changed` 由 `permissions` 服务唯一发出，命令管线与 UI 都只订阅它（`collab/permission-changed` 弃用）。传播预算：**PRD/SV-05 门禁 ≤ 2 s**；内部目标 ≤ 1 s p95。
- `AwarenessState.selection: SerializedSelection` = `Selection<A>.serialize()`（05：`broadcast: true` 的 Operation 经 `presence` 序列化广播）；collab-core 对其内容不透明，由 `DocumentType.selectionKinds` 的 schema 校验。本文 §7.1 的 `selection`/`caret` 字段合并为该结构（幻灯片：`{ kind: 'slides'|'shapes'|'text'|'tableCells', slideId, ids[], range?: { anchor, head } }`，`range` 为 RelativePosition base64）。
- 会话状态：公开 `Session.state: SyncState`（02 §4.11：`disconnected|connecting|syncing|synced|offline|error`）是本文 §5.1 内部 FSM 的投影；PRD 名称对照：`readonly-degraded` = 本文 `readonly`（投影为 `synced` + `role` 降级标志）；`reconnecting` = `backoff`；`quarantined`/`denied` 投影为 `error`（附 code）。事件定稿 `collab/state-changed`（10 §11）。
- 令牌（CO-05/EM-03）：`getToken()` 回调在到期前 60 s 刷新，以新增 CONTROL 消息 `auth.refresh{token}` 续期（不断连）；**刷新失败按原因分流**（rulings §4.18 UX-02）：网络错误 → `reconnecting`（内部 `backoff`，与重连共用同一 30 s 离线计时，不另设计时器）；401（`server.auth.expired` / `collab.unauthenticated`）→ 直接进入「登录已过期」（内部 `denied`，投影 `error`），不经 `reconnecting → offline`，避免先给出误导性的「离线」。「重新登录」在弹窗或新标签完成 OIDC（服务端照常设 httpOnly cookie，回调页经 BroadcastChannel 通知原页），原页不跳转、pending 队列保留，拿到新票据后经 `denied → connecting` 重连 → 同步中 → 已恢复；回来的用户 id 与原会话不同则不重放队列、按只读处理并提供导出本地副本，该横幅处理前不可关闭（应用壳落点 40-modules/11）。M1–M3 令牌只来自 OIDC 登录（rulings §4.15 Q6）；集成方签名 JWT 与 API Key 降为 M4（届时 JIT 建影子用户），见 ADR-0029。

### 18.4 被拒 update 的本地回滚（05 §11 交由 06 决定）

被拒只发生在降权或锁定窗口：服务端未应用、他人未见，但本地 Y.Doc 已含这些事务。策略 = **导出后重载**：
1. `rejectedDiff = encodeStateAsUpdate(localDoc, serverStateVector)`（恰为未被 ack 的本地更改）连同对应 `TransactionRecord` 摘要写入 OfflineStore `rejected` 区（可导出为 JSON / 本地 pptx 副本）；
2. 丢弃本地 Y.Doc → HTTP 快照 + step1/2 重新 bootstrap（origin `system('load')`），撤销栈清空；
3. UI 横幅「你的 N 项更改未被保存（权限已变更）」+ 导出按钮（CO-05 措辞）。
`history` 不参与回退（`collab/update-rejected` 事件仅供 UI/遥测），不用撤销栈做一致性修复。

### 18.5 与 PRD CO/SV/EM 的逐条承接

| PRD | 承接 |
|---|---|
| CO-12 / EM-04 资源上传通道 | 图片/媒体经集成方 `uploadAsset(file) → { assetId }`（协同模式必需）或 `apps/server` 预签名 PUT（≥ 10 MB 分片，不经 Nest 内存；URL 按 `storage.s3.publicEndpoint` 生成、经反代子域到达对象存储，rulings §4.18 BE-01，08 §6）；CRDT 只存 `BlobRef`；上传中/失败元素显示占位并可重试（`pic.mediaId` 先指向本地临时 id，成功后一次 `set` 替换） |
| CO-12 消息限制 | 单帧 ≤ 1 MiB；**每连接 ≤ 200 帧/s（突发 500）**（取代本文 §9.3 的 100/s）；awareness 节流 ≥ 50 ms；未知 CONTROL 类型丢弃并计数 |
| CO-12「服务端不做内容语义校验」 | 与 ADR-0034 软门禁不一致。本文坚持服务端**至少**执行不变量修复：非法结构一旦进入 CRDT 就会永久留在文档中，客户端「解码失败即忽略」无法把它从其他端移除，且服务端导出/缩略图作业自身会消费该模型。折中：配置 `softGate: 'repair' \| 'report-only' \| 'off'`，M3 默认不变量 `repair`、schema 类型 `report-only`。**已裁决（rulings §4.1 P8：采纳 ADR-0034；PRD CO-12 已同步）** |
| SV-05 容量 | `maxEditors: 20`、`maxViewers: 50`，超限只读加入（`auth.ok{ role:'viewer', reason:'capacity' }`），再超 → `auth.denied{ collab.room_full }`；房间空置销毁延迟 **60 s**（取代 30 s）；协议版本协商失败 → `collab.protocol_mismatch`（关闭码 4427，与 schema 版本的 4426 区分） |
| SV-05 多实例与停机 | 跨实例 ≤ 50 ms、房间内广播 p95 ≤ 100 ms、持久化滞后 p99 ≤ 1 s、优雅停机 ≤ 30 s、客户端 ≤ 5 s 重连到其它实例（1012 首轮不退避）；单实例（RM-S 2 vCPU/4 GB）≥ 2,000 WS、CPU < 70%；房间**按文档实测权重准入**（rulings §4.15 Q5，§14、08 §16.5），各档（按文档规模）房间数 M1 实测回填，不再写固定「≥ 200 活跃房间」 |
| CO-05 | 见 18.3/18.4；`permission/denied` 由命令管线发出 |
| CO-08 | 每行收敛结果见 ADR-0020 补充表 D；「X 也在编辑此文本框」的预防性提示来自 presence `caret`/`editing` |
| CO-04 / PD-04 评论 | ADR-0031 v0.2：评论为 Snapshot 内 `ResourceHook`（命名空间 `comments.*`）为事实源；服务端软门禁执行作者规则；PG 为镜像读模型 |
| NF-01 1.6 协同预算 | A→B 可见 p50 ≤ 150 / p95 ≤ 400 ms（门禁；本文 `RTT + 100 ms` 为内部目标）；初始同步 D50 ≤ 2 s / D200 ≤ 5 s（p75）；重连重同步（≤ 5,000 update）≤ 3 s；presence 传播 p95 ≤ 200 ms；权限 ≤ 2 s —— 一并进入 `test/perf/budgets.json` 的 `gate` 字段 |

### 18.6 `OfflineStore` Definition（签名级草案；collab-core `contracts/offline.ts`；Provider：`@cordexjs/collab-offline-idb`，缺失时 collab-yjs 用同接口的内存实现）

```ts
// 草案
interface OfflineStore {
  open(scope: { userId: UserId; documentId: DocumentId }): Promise<OfflineDocStore>   // 无 tenantId（T-0）
  clearAll(scope: { userId: UserId }): Promise<void>                                  // 登出 / 切换账号
  estimate(): Promise<{ usedBytes: number; quotaBytes: number }>                     // navigator.storage.estimate 的封装
}
interface OfflineDocStore {
  readonly meta: OfflineMeta | null                                                   // { epoch, schemaVersion, lastAckSeq, savedAt }
  loadState(): Promise<Uint8Array | null>                                             // compact 后的完整状态（V2 update）
  loadPending(): Promise<readonly PendingUpdate[]>                                    // 未 ack 的本地 update，按 localSeq 升序：{ localSeq, update }
  appendPending(update: Uint8Array, localSeq: number): Promise<Result<void, CordexError<'collab.offline_quota_exceeded'>>>
  ackUpTo(localSeq: number): Promise<void>                                            // 删除 ≤ localSeq 的 pending
  compact(state: Uint8Array, meta: OfflineMeta): Promise<void>                        // 原子替换 state 并清空已 ack 的 pending
  moveToRejected(entries: readonly RejectedEntry[]): Promise<void>                    // { update, records: TransactionRecordSummary[], reason, at }（§18.4）
  listRejected(): Promise<readonly RejectedEntry[]>
  clearRejected(): Promise<void>
  close(): Promise<void>
}
```

- 约束：单文档上限 50 MiB（超限时 `appendPending` 返回 `err`，会话继续编辑但停止持久化并提示）；所有方法幂等；`compact` 与并发的 `appendPending` 在同一存储事务域内保证不丢追加；`epoch`/`schemaVersion` 与服务端不一致的本地数据由 collab-yjs 移入 `rejected`（ADR-0033）。
- 生命周期：`open()` 返回的句柄由 Unit 的 collab Fiber 以 `ctx.effect` 拥有，Unit 关闭时 `close()`。
