> 状态：草稿 | 负责：架构-运行时 | 更新：2026-09-14 | 依赖：charter v0.1

# ADR-0033 离线队列与本地持久化：IndexedDB Provider（独立 dom 包），collab-yjs 保持 iso

## 状态

提议（章程 M3 验收含「离线重连」；S1 已由总编排批准，`@oce/collab-offline-idb`（L4，dom）进入章程 v0.2 包清单）。

## 背景

M3 要求断线期间可继续编辑并在重连后合并；刷新页面不应丢失未同步更改；`collab-yjs` 是 iso 包不能直接依赖 IndexedDB；数据敏感性（文档内容落在本地）。

## 决策

1. `collab-core` 定义 `OfflineStore`（签名级草案见 06 §18.6：`open/clearAll/estimate` + 文档句柄的 `loadState/loadPending/appendPending/ackUpTo/compact/moveToRejected/listRejected/clearRejected/close`）；`collab-yjs` 只依赖该 Definition，缺失 Provider 时降级为同接口的内存实现（刷新即丢，但断线期间仍可编辑）。
2. 新增 dom 包 **`@oce/collab-offline-idb`**（L4，Provider）：IndexedDB 实现（自写薄适配或 `y-indexeddb`），库名 `oce-collab`，按 `{tenant}/{documentId}` 分对象仓：`updates`（本地未 ack 的 update + localSeq）、`state`（compact 后完整状态）、`rejected`（被服务端拒绝的事务快照）、`meta{epoch, schemaVersion, lastAckSeq}`。
3. 恢复流程：打开 Unit → 若本地有 `state` 先应用（origin `import`）→ HTTP 快照 bootstrap → 重放 `updates`（origin local 重放，不入撤销栈）→ WS 同步 → `ack` 后清理 → synced 后 `compact`。
4. 上限：50 MiB/文档；超限停止写入并提示；配额 API（`navigator.storage.estimate`）低于阈值时提示。
5. 安全：登出/切换账号清空该用户全部本地库；不做客户端加密（P4）；`epoch`/`schemaVersion` 不匹配的本地数据 → 移入 `rejected` 供导出后清理。
6. 「未同步更改」UI：来自 `Session.stats.pendingLocalUpdates` 与 `rejected` 计数（设计 20-design/05）。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 不做本地持久化（仅内存队列） | 刷新/崩溃丢失离线编辑，不满足 M3「离线重连」的用户期望 |
| Service Worker + Cache API | 面向资源缓存而非结构化增量；复杂 |
| localStorage | 容量（~5 MB）与同步 API 阻塞主线程 |
| 把 IDB 实现放进 collab-yjs 并动态 `import()` | 包仍需 dom 类型与运行时检测，破坏 iso 分类与 `node --import` 冒烟 |
| 放进 preset-slide-collab | preset 应只做组装（章程 R2） |

## 后果

正面：离线体验完整；iso 边界清晰；Provider 可替换（Capacitor/Electron 可用文件系统实现）。

负面 / 代价：新增一个包（已批准，章程 v0.2）；本地数据治理（清理策略、配额）；`rejected` 的导出格式需定义（JSON：`TransactionRecord` 摘要列表 + 未 ack 的 update 字节 base64，见 06 §18.4）。该包同时提供浏览器侧 `BlobStore` 的 IndexedDB Provider（本地媒体缓存，04 §10）。

## 如何被机械验证

- conformance（`runCollabConformance` 的离线场景）：断线 → 编辑 → 刷新（重新创建宿主并复用同一 IDB fake）→ 重连 → 合并且 `updates` 被 `ack` 清理。
- e2e：Playwright `context.setOffline(true)` 编辑 → reload → 上线 → 另一浏览器看到更改；降权后 `rejected` 可导出。
- 扫描器：`collab-yjs` 无 `indexedDB` 引用；`collab-offline-idb` 为 dom 类。

## 关联

章程 M3、R2、S1（建议）；ADR-0023/0029；架构 06 §12。
