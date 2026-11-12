/**
 * 符号面板样张数据（rulings §4.21：符号 M3 P2，自建 Unicode 表）。按 Unicode 区块分类，每块列出常用码位；
 * 产品里由 UCD 生成（名称取 Unicode 字符名，中文别名自建），这里只列样张需要的字符与少量名称。
 * 刻意避开默认以彩色 emoji 呈现（Emoji_Presentation=Yes）的码位，保证插入后按正文字体渲染。
 */
export interface SymbolBlock {
  id: string
  label: string
  range: string
  chars: string
}

export const symbolBlocks: SymbolBlock[] = [
  { id: "latin1", label: "拉丁-1 补充", range: "U+0080–00FF", chars: "©®°±µ¶·¼½¾×÷¿¡§¢£¥¤ªº«»¬¹²³¦¨¯´¸" },
  { id: "greek", label: "希腊字母", range: "U+0370–03FF", chars: "αβγδεζηθικλμνξοπρστυφχψωΓΔΘΛΞΠΣΦΨΩ" },
  { id: "punct", label: "常用标点", range: "U+2000–206F", chars: "–—‘’“”†‡•…‰′″‹›‼‖※⁂⁇⁈⁉" },
  { id: "supsub", label: "上标和下标", range: "U+2070–209F", chars: "⁰⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎" },
  { id: "currency", label: "货币符号", range: "U+20A0–20CF", chars: "₠₡₢₣₤₥₦₧₨₩₪₫€₭₮₯₰₱₲₳₴₵₸₹₺₼₽₾₿" },
  { id: "letterlike", label: "字母式符号", range: "U+2100–214F", chars: "℀℁ℂ℃℅℆℉ℊℋℍℎℏℐℒℓℕ№℗℘ℙℚℛℝ℞℠℡™ℤΩ℧℮ℵ" },
  { id: "numforms", label: "数字形式", range: "U+2150–218F", chars: "⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫⅰⅱⅲⅳⅴ" },
  { id: "arrows", label: "箭头", range: "U+2190–21FF", chars: "←↑→↓↔↕↖↗↘↙↚↛↩↪↰↱↲↳↴↵↺↻⇐⇑⇒⇓⇔⇕⇄⇅⇆⇦⇧⇨⇩⇪" },
  { id: "math", label: "数学运算符", range: "U+2200–22FF", chars: "∀∂∃∅∆∇∈∉∋∏∑−∓∕∗∘√∛∝∞∠∧∨∩∪∫∬∮∴∵∼≈≠≡≤≥≪≫⊂⊃⊆⊇⊕⊗⊥⋅" },
  { id: "enclosed", label: "带圈字母数字", range: "U+2460–24FF", chars: "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳⑴⑵⑶⑷⑸⒈⒉⒊ⒶⒷⒸⓐⓑⓒ" },
  { id: "geometric", label: "几何图形", range: "U+25A0–25FF", chars: "■□▢▣▤▥▦▧▨▩▪▫▬▭▮▯▰▱▲△▶▷▼▽◀◁◆◇◈○◎●◐◑◒◓◢◣◤◥◯" },
  { id: "misc", label: "杂项符号", range: "U+2600–26FF", chars: "★☆☎☏☐☑☒☚☛☜☞☟☯☹☺☻♀♂♠♡♢♣♤♥♦♧♩♪♫♬⚐⚑" },
  { id: "dingbats", label: "装饰符号", range: "U+2700–27BF", chars: "✓✔✕✖✗✘✚✜✢✣✤✥✦✧✩✪✫✬✭✮✯✰✱✲✵✶❖❘❙❚❛❜❝❞➔➘➙➚➛➜➝➞" },
  { id: "cjk", label: "CJK 符号和标点", range: "U+3000–303F", chars: "、。〃〄々〆〇〈〉《》「」『』【】〒〓〔〕〖〗〘〙〚〛〜〝〞〟〠〡〢〣" },
  { id: "fullwidth", label: "全角 ASCII", range: "U+FF01–FF5E", chars: "！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝～" },
]

/** 「最近使用」：每人记忆（不写入文档），样张给一组常见项 */
export const recentSymbols = "✓→①±°※℃×÷≈≤≥"

/** 样张里会被选中的码位给出名称；其余只显示码位与区块（产品取 UCD 名称） */
export const symbolNames: Record<string, { zh: string; en: string }> = {
  "→": { zh: "向右箭头", en: "RIGHTWARDS ARROW" },
  "✓": { zh: "对勾", en: "CHECK MARK" },
  "①": { zh: "带圈数字一", en: "CIRCLED DIGIT ONE" },
  "±": { zh: "正负号", en: "PLUS-MINUS SIGN" },
  "°": { zh: "度", en: "DEGREE SIGN" },
  "※": { zh: "参考符号", en: "REFERENCE MARK" },
  "℃": { zh: "摄氏度", en: "DEGREE CELSIUS" },
  "×": { zh: "乘号", en: "MULTIPLICATION SIGN" },
  "÷": { zh: "除号", en: "DIVISION SIGN" },
  "≈": { zh: "约等于", en: "ALMOST EQUAL TO" },
  "≤": { zh: "小于等于", en: "LESS-THAN OR EQUAL TO" },
  "≥": { zh: "大于等于", en: "GREATER-THAN OR EQUAL TO" },
  "€": { zh: "欧元符号", en: "EURO SIGN" },
  "™": { zh: "商标符号", en: "TRADE MARK SIGN" },
}

export const codePoint = (ch: string) => "U+" + ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")

export function blockOf(ch: string) {
  return symbolBlocks.find((b) => Array.from(b.chars).includes(ch))
}
