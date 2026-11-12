/**
 * 日期和时间格式映射表（50/21 §4 ⑧⑭；50/20 §3）：文本编辑态「日期和时间」选择器（03-16）与「页眉和页脚」对话框（03-15）共用这一张表，
 * 两处列出同样的 13 种 `datetimeN`、同一套界面语言名，存的是格式编码（OOXML 字段 `type`），不是列表下标。
 *
 * 样张固定时刻 2026-09-30（周三）14:32:05，保证截图稳定；产品用注入的时钟与当前 run 的 lang 经 Intl.DateTimeFormat 求值。
 * 每种语言的格式列表对应 OOXML 的 datetime1…datetime13（格式编码在字段 type 里）；映射表自建，待语料核对（50/20 §3 ⑭）。
 */
export interface DateTimeFormatDef {
  /** OOXML 字段类型 datetime1…datetime13 */
  code: string
  /** 按样张固定时刻求得的显示值 */
  text: string
}

export const DATETIME_FORMATS: Record<string, DateTimeFormatDef[]> = {
  "zh-CN": [
    { code: "datetime1", text: "2026/9/30" },
    { code: "datetime2", text: "2026年9月30日星期三" },
    { code: "datetime3", text: "2026年9月30日" },
    { code: "datetime4", text: "2026年9月" },
    { code: "datetime5", text: "9月30日" },
    { code: "datetime6", text: "二〇二六年九月三十日" },
    { code: "datetime7", text: "星期三" },
    { code: "datetime8", text: "2026/9/30 14:32" },
    { code: "datetime9", text: "2026/9/30 14:32:05" },
    { code: "datetime10", text: "14:32" },
    { code: "datetime11", text: "14:32:05" },
    { code: "datetime12", text: "下午2时32分" },
    { code: "datetime13", text: "下午2时32分05秒" },
  ],
  "en-US": [
    { code: "datetime1", text: "9/30/2026" },
    { code: "datetime2", text: "Wednesday, September 30, 2026" },
    { code: "datetime3", text: "30 September 2026" },
    { code: "datetime4", text: "September 30, 2026" },
    { code: "datetime5", text: "30-Sep-26" },
    { code: "datetime6", text: "September 26" },
    { code: "datetime7", text: "Sep-26" },
    { code: "datetime8", text: "9/30/2026 2:32 PM" },
    { code: "datetime9", text: "9/30/2026 2:32:05 PM" },
    { code: "datetime10", text: "14:32" },
    { code: "datetime11", text: "14:32:05" },
    { code: "datetime12", text: "2:32 PM" },
    { code: "datetime13", text: "2:32:05 PM" },
  ],
  "ja-JP": [
    { code: "datetime1", text: "2026/9/30" },
    { code: "datetime2", text: "2026年9月30日水曜日" },
    { code: "datetime3", text: "2026年9月30日" },
    { code: "datetime4", text: "2026年9月" },
    { code: "datetime5", text: "9月30日" },
    { code: "datetime6", text: "令和8年9月30日" },
    { code: "datetime7", text: "水曜日" },
    { code: "datetime8", text: "2026/9/30 14:32" },
    { code: "datetime9", text: "2026/9/30 14:32:05" },
    { code: "datetime10", text: "14:32" },
    { code: "datetime11", text: "14:32:05" },
    { code: "datetime12", text: "午後2時32分" },
    { code: "datetime13", text: "午後2時32分05秒" },
  ],
}

/** 语言下拉：值为 BCP 47 标签，显示名用界面语言（中文界面） */
export const DATETIME_LANGS: { v: string; l: string }[] = [
  { v: "zh-CN", l: "中文（中国）" },
  { v: "en-US", l: "英语（美国）" },
  { v: "ja-JP", l: "日语" },
]

export const DEFAULT_DATETIME_LANG = "zh-CN"

/** 该语言的格式列表；未登记的语言回退到中文 */
export function datetimeFormatsFor(lang: string): DateTimeFormatDef[] {
  return DATETIME_FORMATS[lang] ?? DATETIME_FORMATS[DEFAULT_DATETIME_LANG]!
}

/** 按编码取格式；编码不在该语言列表里时回退到第一种（datetime1） */
export function findDatetimeFormat(lang: string, code: string): DateTimeFormatDef {
  const list = datetimeFormatsFor(lang)
  return list.find((f) => f.code === code) ?? list[0]!
}
