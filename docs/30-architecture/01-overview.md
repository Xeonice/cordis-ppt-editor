# 01 架构总览：系统上下文、容器、原则与端到端数据流

> 状态：草稿 | 负责：架构-结构 | 更新：2026-09-14 | 依赖：charter v0.1

---

## 1. C4 L1 — 系统上下文

```
                         ┌──────────────────────────┐
                         │  编辑者 / 评审者（浏览器） │
                         └─────────────┬────────────┘
                                       │ 打开 / 编辑 / 协同 / 导出 .pptx
                                       ▼
 ┌──────────────┐   OIDC    ┌────────────────────────────────────────┐   S3 API   ┌──────────────┐
 │ 身份提供方    │◄─────────►│  OCE（本系统）                          │◄──────────►│ 对象存储      │
 │ (IdP)        │           │  = 浏览器 SDK（cordis 宿主 + preset）    │            │ (S3/MinIO)   │
 └──────────────┘           │  + 服务端（NestJS + 内嵌 cordis 宿主）   │            └──────────────┘
                            └───────┬──────────────────┬─────────────┘
                                    │                  │
             ┌──────────────────────┘                  └───────────────────────┐
             ▼                                                                 ▼
 ┌────────────────────────┐                                    ┌──────────────────────────────┐
 │ 插件开发者 / 集成方      │  嵌入 SDK、开发插件、对接鉴权/存储     │ .pptx 文件（PowerPoint 产出） │
 │（第三方代码，同源可信）   │                                    │ 输入：任意合法 pptx；输出：合法 pptx│
 └────────────────────────┘                                    └──────────────────────────────┘
```

- **用户**：编辑者、评审者（PRD 02 的角色）；**插件开发者**与**集成方**同样是一等用户（章程 §2.2）。
- **外部系统**：OIDC IdP（章程 Q6）、S3 兼容对象存储（Q10）、PowerPoint 作为文件的生产者/消费者（也是视觉回归的 oracle，见 11）。
- **信任边界**：插件与宿主同源可信（章程 §2.3），不做运行时沙箱；`isolate()` 只是解析域。

---

## 2. C4 L2 — 容器

```
 浏览器                                              服务端（docker-compose 单体，Q10）
 ┌───────────────────────────────────────────┐      ┌──────────────────────────────────────────────┐
 │ apps/web（Vite + React 19 应用壳）          │      │ apps/server（NestJS 11）                       │
 │  ├─ 登录 / 文档列表 / 编辑器路由            │ REST │  ├─ Auth（OIDC）      ├─ Documents              │
 │  └─ <EditorHost host=…>                    │◄────►│  ├─ Snapshots         ├─ ImportExport（任务）   │
 │       │                                    │  WS  │  ├─ Collab Gateway ───┼─ Thumbnails（M3）       │
 │       ▼                                    │◄────►│  ├─ Audit             └─ Health                │
 │ OCE SDK = createHost() 根 Context           │      │  └─ infra: cordis 宿主(server-headless)、       │
 │  ├─ L0 kernel/shared/protocol/i18n         │      │     Postgres 客户端、Redis 客户端、Blob 存储     │
 │  ├─ L1 model-core + store-memory|store-yjs │      └──────┬───────────────┬──────────────┬──────────┘
 │  ├─ L2/L3 model-slide + ooxml-core/pptx    │             │               │              │
 │  ├─ L4 collab-core/yjs/transport-ws        │       ┌─────▼─────┐   ┌─────▼─────┐  ┌─────▼──────┐
 │  ├─ L5 engine-layout/engine-render/dom     │       │ Postgres  │   │  Redis    │  │ 对象存储    │
 │  ├─ L6 slide-render/slide-ui               │       │ 元数据、   │   │ pub/sub、 │  │ 原始 pptx、│
 │  ├─ L7 design/ui-core/ui-react             │       │ CRDT 更新、│   │ presence  │  │ blob、快照包│
 │  └─ L8 preset-slide[-collab]               │       │ 快照索引   │   │           │  │            │
 └───────────────────────────────────────────┘       └───────────┘   └───────────┘  └────────────┘
```

| 容器 | 技术 | 职责 | 详见 |
|---|---|---|---|
| 浏览器 SDK | TS，cordis 4，React 19 绑定 | 打开、渲染、编辑、协同客户端、导出；**全部能力都是插件** | 02、03 |
| `apps/web` | Vite 7 + React 19 | 组装 preset，路由与登录；零业务逻辑 | 02 §3 |
| `apps/server` | NestJS 11 | 传输壳：REST、WS 网关、任务；业务逻辑在 `server-*` 包 | 08 |
| 服务端 cordis 宿主 | `@oce/server-headless` | 在 Node 中加载同一批 iso 插件做导入/导出/校验/迁移/缩略图 | 02 §4.26、08 |
| Postgres | 16 | 文档元数据、权限、CRDT update 追加表、快照索引、审计 | 08、ADR-0022 |
| Redis | 7 | 跨实例 pub/sub、presence | 08 |
| 对象存储 | S3 兼容 | 原始 pptx、内容寻址 blob（媒体、不透明部件）、快照包 | 04 §2.5、08 |

**同一份模型/格式代码在两端运行**（章程 §2.2）：`model-core`、`model-slide`、`ooxml-*`、`store-*`、`engine-layout` 均为 `iso` 类；浏览器与 Node 各自提供 `TextMeasurer` Provider 与 `RenderTarget` Provider。

---

## 3. 四大原则（章程 §0 三关键词 + R7）

| 原则 | 结构层面的含义 | 一个反例（我们禁止的） |
|---|---|---|
| **SDK 优先** | `packages/*` 是产品；`preset-*` 是「产品形状」；`apps/*` 只是样例组装 | 在 `apps/web/src` 里写「插入形状」的逻辑 |
| **每一级可插拔** | 每层至少一个 Definition + 可替换 Provider；Consumer 只依赖 Definition；移除 Provider → 降级不崩 | `ui-core` 直接 `import { YjsStore } from '@oce/store-yjs'` |
| **文档类型盲** | 水平层不知道幻灯片；`DocumentType`、`Mutation`、`SceneProvider`、UI 贡献全部由垂直束注入 | `model-core` 里出现 `slideId`（Univer A1/A2） |
| **规范必有执行点** | 本目录每条规则配「机械验证」；`policy-check` 校验规则 ↔ CI job 对应 | 写在 README 里的「请勿深引用 src」（Univer A17/A27） |

---

## 4. 端到端数据流总图

### 4.1 打开文档（单人，M1）

```
 用户            apps/web            SDK(host)            formats/ooxml-pptx        model-core            渲染
  │  点击文档       │                     │                       │                       │                 │
  │──────────────►│ GET /documents/:id  │                       │                       │                 │
  │               │────────────────────►│ (server) 返回元数据 + 原始 pptx 的预签名 URL     │                 │
  │               │ fetch(bytes)        │                       │                       │                 │
  │               │────────────────────►│ units.open({ documentType:'slide',             │                 │
  │               │                     │   source:{ format:'…presentationml…', bytes }})│                 │
  │               │                     │──── formats.import(bytes) ───►│               │                 │
  │               │                     │                       │ OPC 读 → Part 表       │                 │
  │               │                     │                       │ 分类：建模 / 不透明     │                 │
  │               │                     │                       │ 解析 → Snapshot + blobs│                 │
  │               │                     │◄── { snapshot, blobs, diagnostics } ──────────│                 │
  │               │                     │──── migrations.run(snapshot) ────────────────►│                 │
  │               │                     │──── 创建 UnitScope（isolate store/history/…）─►│                 │
  │               │                     │     挂载 store-memory → store.load(snapshot)   │                 │
  │               │                     │     挂载 model-slide.unitPlugins（slides 服务）│                 │
  │               │                     │──── emit 'unit/opened' ───────────────────────┼────────────────►│
  │               │                     │                       │                       │ render.attach(domTarget)
  │               │                     │                       │                       │ SceneProvider('slide').build(page 1)
  │               │                     │                       │                       │ layout 度量 → paint
  │◄──────────────┼─────────────────────┼───────────────────────┼───────────────────────┼─ 首屏 ──────────│
```

要点：
- 导入产出的是 **Snapshot + Blob 集合**，不是运行时对象；Store 再从 Snapshot 构造状态（D6 的显式编解码边界）。
- 未建模的部件和 XML 子树在导入阶段就进入 `extensions`/blob（不透明保留，04 §5），不是导出时才想起来。
- `diagnostics` 是一等产出：渲染前 UI 就能提示「本文件含 SmartArt，将只保留不编辑」。

### 4.2 编辑（M2）

```
 UI 输入 → ui-core 输入管线（键位/指针 → 命令 id + 参数）
        → commands.execute(unitId, 'slide.shape.move', params)
             ├─ 校验参数（schema） ─ 失败 → Result.err(INVALID_PARAMS)
             ├─ waterfall 'command/execute'：权限 fail-closed → 审计 → 遥测（唯一拦截链）
             ├─ store.transact(origin=local) {
             │     handler 产出 Mutation → schema 校验 → Mutation 级权限 → lower() → StoreOp[] → 应用 → 记录逆 op
             │  }
             ├─ history.push(record)                          （策略层：合并、容量）
             ├─ emit 'store/transaction'(changeSet) ─────────► SceneProvider.diff → 脏节点 → render.invalidate → 局部重绘
             └─ emit 'command/executed'                       ► UI 状态（canUndo 等）
```

### 4.3 协同（M3；协议细节见 06）

```
 客户端 A                         服务端 Collab Gateway                       客户端 B
 store-yjs: Y.Doc ── transact ──► update(bytes)                                │
 collab-yjs ──── ws 帧(sync) ────► server-collab 房间：鉴权检查点 → 持久化(Postgres) → 广播(Redis) ──► collab-yjs → Y.Doc.apply
 awareness(presence: Selection 序列化) ───────────────────────────────────────────────────────────────► presence 服务 → 远端光标覆盖层
 权限变更（管理员改为只读）→ 网关下发 permission-changed 帧 → permissions 服务更新 → 下一次 commands.execute 即被拒绝
```

要点：CRDT 文档是唯一事实源（D5）；Mutation 不上网络，网络上只有 CRDT update；权限在两处（管线 + 网关）检查（D12）。

### 4.4 导出（M1 起）

```
 commands.execute(unitId, 'core.export', { mime: pptx })
   → formats.export(unitScope)
       → ooxml-pptx: 读 store 状态 + DirtyTracker
           ├─ 干净部件：从 blob 取原字节 verbatim
           ├─ 脏部件：模型 → XML（重插 OpaqueXml）→ 序列化
           ├─ 媒体：BlobRef → 部件（去重）
           └─ [Content_Types].xml / *.rels：从 Part 表重生成
       → zip bytes → 下载 或 POST /documents/:id/export（服务端同一代码路径经 server-headless）
```

---

## 5. 关键运行时对象关系（一页图）

```
 createHost(options) ──► root Context（cordis）
   ├─ kernel 服务：contributions · errors · telemetry · (logger)
   ├─ model-core 服务：units · documentTypes · commands · formats · resources · migrations · permissions
   ├─ 其它水平层服务：layout · ui · shortcuts · theme · i18n · collab
   ├─ 贡献点表（进程内、按 host）：core.* · render.* · layout.* · ui.* · i18n.* · slide.*
   └─ Unit Fiber（每个打开的文档一个；ctx.plugin(unitPlugin)）
        └─ 隔离 ctx = extend({unit}).isolate('store').isolate('history').isolate('selection').isolate('render').isolate('presence')[.isolate(docType.unitServices…)]
             ├─ store Provider（memory | yjs）  ├─ history  ├─ selection  ├─ render  ├─ presence
             └─ 文档类型 unitPlugins（如 slides 服务）
```

- 一个页面可以有多个 host（多编辑器实例），互不干扰（无模块级状态，A10）。
- 一个 host 可以打开多个 Unit（同页多文档），服务按 Unit 隔离（K2）。

---

## 6. 与其它文档的边界

- 本文只给总图。分层与目录 → 02；内核与插件 → 03；模型与格式 → 04；命令 → 05；协同/渲染/后端/观测/测试 → 06/07/08/10/11（运行时线）；规则的执行细节 → 09（类型治理线）。
