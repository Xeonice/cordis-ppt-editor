/**
 * import 场景的示例数据：导入的文件、服务端作业的阶段文案、按错误码的失败文案（03-13「打开失败态」表 + 第 3 批补的几行）。
 * 文案只在这里写一份，导入对话框（dialog.tsx、pages.tsx）与状态说明（import.scenario.tsx 的 note）都从这里取，免得两处说法不一。
 * 2026-10-23（rulings §4.25 DS-140）起失败都在导入对话框里原位显示（整块状态 PanelState + 底栏「关闭」），原整屏失败页删去；
 * 对话框里画出的三种是可重试（network）、不是有效的演示文稿（invalid-package）、超出规模上限（quota），其余错误码同一画法只换图标与文案（OTHER_FAILURES、FOLDED）。
 */

/** 导入的文件：文件名（含扩展名）与大小（界面按 1 位小数写 MB） */
export interface ImportFile {
  name: string
  size: string
}

/** 主流程的文件：导入成功后的文档标题是去掉扩展名的文件名（60-backend/06 §6.4 第 3 步），与示例文档 DOC_TITLE 一致 */
export const MAIN_FILE: ImportFile = { name: "2026 年 Q2 业绩汇报.pptx", size: "48.2 MB" }

/**
 * 服务端导入作业的阶段（60-backend/06 §6.3 的 stage）→ 导入对话框「服务端解析」一行的文案。前端只用 stage 换文案、不换算百分比
 * （DS-53 的加载画法是转圈 + 一句话，v3 没有不确定态进度条）。fetch 与 unzip 都写「正在检查文件…」；parse-presentation 与 parse-slide 同一句。
 */
export const STAGES = {
  queued: "正在排队，马上开始…",
  fetch: "正在检查文件…",
  unzip: "正在检查文件…",
  "parse-presentation": "正在解析幻灯片…",
  "parse-slide": "正在解析幻灯片…",
  "decode-media": "正在处理图片与媒体…",
  persist: "正在创建文档…",
} as const

export type StageId = keyof typeof STAGES

/** 导入对话框里画出来的三种失败的示例文件（pages.tsx FILES；其余错误码同一画法、只换图标与文案，见 OTHER_FAILURES、FOLDED） */
export type DialogFileId = "invalid-package" | "quota" | "network"

/**
 * 不另画、沿用导入对话框失败态画法只换图标与文案的错误码（原整屏失败页 failed-unsupported、failed-too-complex、failed-storage 的文案，2026-10-23 随 DS-140 并进
 * dialog-failed-invalid-package 的说明）：整块状态（危险色图标 20 · 标题 · 说明）+ 补充说明「文件名 · 大小」，底栏只有「关闭」，都不给重试。
 * - unsupported：format.unsupported_binary（.ppt 与拖入的非 .pptx；按扩展名在申请上传时就被拒 415，不经上传）；不用「已损坏」措辞
 * - tooComplex：headless.task_timeout / task_oom（解析超过 60 秒或线程堆 2 GB，60/06 §6.3；terminal，同一文件重跑结果不变）；拆分建议与规模上限同一句
 * - storage（M3，PRD SV-08）：storage.quota_exceeded{dimension: bytes}（60/04 §9 每用户存储配额，申请上传时就 413）；dimension: documents（429，每用户文档数）
 *   同一画法换说明「你的文档数已达上限（500 份）」，回收站里的同样计入；数值读配置
 */
export const OTHER_FAILURES = {
  unsupported: { icon: "FileX2", title: "不支持的文件格式", lines: ["请在 PowerPoint 中另存为 .pptx 后重试"], file: "2025 年度销售总结.ppt · 12.6 MB" },
  tooComplex: {
    icon: "FileWarning",
    title: "文件过于复杂，无法完成导入",
    lines: ["解析超出了服务器的处理时间或内存上限，重试结果不会改变", "可以在 PowerPoint 中把它拆成几份较小的文件后再分别导入"],
    file: "工厂产线仿真演示.pptx · 64.0 MB",
  },
  storage: {
    icon: "HardDrive",
    title: "存储空间不足，无法导入",
    lines: ["你的文档已占用 9.96 GB，上限 10 GB，放不下这个文件", "删除不需要的文档（回收站里的也占用空间）后再导入，或联系管理员"],
    file: "客户案例合集.pptx · 92.7 MB",
  },
} as const

/**
 * 「超出规模上限」的超出项（format.quota_exceeded{dimension, limit, actual}，rulings §4.15 Q5、§4.17 D2）：
 * 多项按 文件大小 → 页数 → 单页元素 → 总元素 排序，主说明句取第一项；数值读部署配置（scale.*），不写死在界面里——这里是示例值。
 */
export const QUOTA_ROWS: { dimension: string; label: string; actual: string; limit: string }[] = [
  { dimension: "slides", label: "页数", actual: "236 页", limit: "200 页" },
  { dimension: "elementsTotal", label: "文档总元素", actual: "24,180 个", limit: "20,000 个" },
]

/** 「技术详情」三行（format.pptx.invalid_package：首个失败部件路径；复制诊断信息时连同文件名、大小与时间一起复制，不含文档内容） */
export const INVALID_DETAILS: { k: string; v: string }[] = [
  { k: "错误码", v: "format.pptx.invalid_package" },
  { k: "部件", v: "ppt/slides/slide7.xml" },
  { k: "traceId", v: "4be1f07c9a2d4e31" },
]

/**
 * 同属「不支持的文件格式」一类、只换文案的错误码（同一画法；文案照抄 03-13「打开失败态」表，rulings §4.16 Q15），写进状态说明（dialog-failed-invalid-package）。
 * - format.encrypted：「此文件已加密，当前版本无法打开」·「请先在 PowerPoint 中去除密码后再导入」（图标 FileLock2）
 * - format.macro_rejected（.pptm、改名为 .pptx 但含宏）：「不支持包含宏的演示文稿」·「请另存为 .pptx 后再导入」；不给重试、不给「忽略宏打开」
 * - format.limit_exceeded：「文件超出处理上限」· 写出被触发的限制名与上限值，如「媒体总量 312 MB，超过 256 MB 的上限」；与规模上限的文案不混用
 * - format.no_document_type（只在 SDK 集成，参考应用不会出现）：「未加载可打开此文件的文档类型插件」· 底栏另有「复制诊断信息」
 * - 其余未归类（server.import.checksum_mismatch 等）：落到第 1 批的通用兜底「无法打开该文档」（main-states.open-failed）；
 *   上传凭证失效（server.import.upload_forbidden）不在此列，是可重试的「导入没有完成」（RETRY_CAUSES.expired）
 */
export const FOLDED = {
  encrypted: { title: "此文件已加密，当前版本无法打开", text: "请先在 PowerPoint 中去除密码后再导入" },
  macro: { title: "不支持包含宏的演示文稿", text: "请另存为 .pptx 后再导入" },
  limit: { title: "文件超出处理上限", text: "媒体总量 312 MB，超过 256 MB 的上限" },
  noDocumentType: { title: "未加载可打开此文件的文档类型插件", text: "请确认已注册能打开 .pptx 的文档类型插件" },
} as const

/**
 * 可重试的「导入没有完成」（瞬时错误）按原因换第二行与图标：标题「导入没有完成」、正文里的次按钮「重试」与底栏「关闭」不变。
 * 只有上传中断 / 离线说「网络」（离线云图标）；超时、5xx、上传凭证失效不是用户的网络问题，用中性的警示图标、各写各的原因（与导出失败按错误码换原因句同一口径）。
 * cause 写进状态说明（dialog-failed-network），与 03-13「打开失败态」表「导入没有完成」一行逐句一致。
 */
export const RETRY_CAUSES = {
  network: { cause: "上传中断或离线", text: "网络连接中断，请重试" },
  timeout: { cause: "服务器响应超时", text: "服务器响应超时，请重试" },
  server: { cause: "服务端 5xx", text: "服务暂时不可用，请稍后重试" },
  expired: { cause: "上传凭证失效（server.import.upload_forbidden：上传超过 1 小时，重试时重新申请上传）", text: "上传用时过长，请重试" },
} as const

export type RetryCause = keyof typeof RETRY_CAUSES
