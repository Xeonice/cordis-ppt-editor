import { useEffect, useMemo, useRef, useState } from "react"
import { Check, CornerDownLeft, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, ICON, TextField } from "../../kit"

/**
 * 符号面板样张数据（03-15 G-83；rulings §4.21：符号 M3 P2，自建 Unicode 表）。按 Unicode 区块分类，每块列常用码位；
 * 产品里由 UCD 生成（名称取 Unicode 字符名，中文别名自建）。刻意避开默认以彩色 emoji 呈现的码位，保证插入后按正文字体渲染。
 */
const BLOCKS: { id: string; label: string; range: string; chars: string }[] = [
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

/** 最近使用：每人记忆（不写入文档） */
const RECENT = "✓→①±°※℃×÷≈≤≥"

const NAMES: Record<string, { zh: string; en: string }> = {
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

const codePoint = (ch: string) => "U+" + (ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")
const blockOf = (ch: string) => BLOCKS.find((b) => Array.from(b.chars).includes(ch))

/**
 * 符号面板（03-15 G-83；M3 P2）：非模态弹层宽 468，入口工具条「更多 › 符号…」与主菜单「插入 › 符号…」，仅在文本编辑态可用。
 * 打开时不抢文本光标；插入后焦点回到文本、面板保持打开以便连续插入（按钮短暂显示「已插入」、字符排到「最近使用」最前）；Esc 关闭并回到文本光标。
 * 搜索（中文名、英文字符名、区块名、码位）· 区块栏 128（首项「最近使用」）· 8 列字符网格（格高 36、字号 18）· 预览底栏 + 「插入 ↵」。
 */
export function SymbolPanel() {
  const [block, setBlock] = useState("arrows")
  const [q, setQ] = useState("")
  const [sel, setSel] = useState("→")
  /** 刚插入的字符：「插入」按钮短暂显示「已插入」，并排到「最近使用」最前（面板保持打开以便连续插入） */
  const [inserted, setInserted] = useState<string | null>(null)
  const [recent, setRecent] = useState(RECENT)
  const nav = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!inserted) return
    const t = setTimeout(() => setInserted(null), 1500)
    return () => clearTimeout(t)
  }, [inserted])
  const insert = () => {
    setInserted(sel)
    setRecent((r) => (sel + Array.from(r).filter((c) => c !== sel).join("")).slice(0, 12))
  }
  useEffect(() => {
    // 首次打开把当前区块滚到栏中部（只滚侧栏自身）
    const n = nav.current
    const el = n?.querySelector<HTMLElement>("[aria-current]")
    if (n && el) n.scrollTop = el.offsetTop - n.clientHeight / 2 + el.offsetHeight / 2
  }, [])
  const chars = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^u\+/, "")
    if (s) {
      const all = Array.from(new Set([...recent, ...BLOCKS.flatMap((b) => Array.from(b.chars))]))
      return all.filter((ch) => {
        const n = NAMES[ch]
        const b = blockOf(ch)
        return codePoint(ch).toLowerCase().includes(s) || (!!n && (n.zh.includes(s) || n.en.toLowerCase().includes(s))) || (!!b && b.label.includes(s))
      })
    }
    return Array.from(block === "recent" ? recent : (BLOCKS.find((b) => b.id === block)?.chars ?? ""))
  }, [block, q, recent])
  const cur = BLOCKS.find((b) => b.id === block)
  const name = NAMES[sel]
  const selBlock = blockOf(sel)

  return (
    <div className="flex flex-col gap-3">
      <TextField aria="搜索符号" value={q} onChange={setQ} placeholder="搜索名称或码位，如 箭头、2192" leading={<Search {...ICON} className="shrink-0" />} />

      {/* 高 226 = 6 行字符格（36 + 2 间距）：滚动区底边落在整行上，不切掉半行 */}
      <div className="flex h-[226px] gap-3">
        <nav ref={nav} aria-label="Unicode 区块" className="flex w-32 shrink-0 flex-col gap-0.5 overflow-y-auto">
          {[{ id: "recent", label: "最近使用" }, ...BLOCKS].map((b) => (
            <button
              key={b.id}
              type="button"
              aria-current={!q && block === b.id ? true : undefined}
              onClick={() => {
                setBlock(b.id)
                setQ("")
              }}
              className={cn(
                "flex h-7 shrink-0 items-center rounded-[4px] px-2 text-left text-[12px] leading-none whitespace-nowrap transition-colors",
                !q && block === b.id ? "bg-(--v3-panel-2) font-medium text-(--v3-text)" : "text-(--v3-text-2) hover:bg-(--v3-panel-2) hover:text-(--v3-text)",
              )}
            >
              {b.label}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="flex h-4 items-center justify-between">
            <span className="text-[12px] leading-none font-semibold text-(--v3-text)">{q ? "搜索结果" : (cur?.label ?? "最近使用")}</span>
            <span className={cn("leading-none text-(--v3-text-2) tabular-nums", q || !cur ? "text-[12px]" : "text-[11px]")}>{q ? `${chars.length} 个` : (cur?.range ?? "仅自己可见")}</span>
          </p>
          <div role="listbox" aria-label="符号" className="grid flex-1 auto-rows-[36px] grid-cols-8 content-start gap-0.5 overflow-y-auto">
            {chars.map((ch) => (
              <button
                key={ch}
                type="button"
                role="option"
                aria-selected={sel === ch}
                aria-label={`${NAMES[ch]?.zh ?? ""} ${codePoint(ch)}`.trim()}
                onClick={() => setSel(ch)}
                className={cn(
                  "flex items-center justify-center rounded-[6px] text-[18px] leading-none transition-colors",
                  sel === ch ? "bg-(--v3-accent-soft) text-(--v3-accent) ring-1 ring-(--v3-accent) ring-inset" : "text-(--v3-text) hover:bg-(--v3-panel-2)",
                )}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="-mx-3 flex items-center gap-3 border-t border-(--v3-border) px-3 pt-3">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-[4px] border border-(--v3-border) bg-(--v3-panel-2) text-[24px] leading-none text-(--v3-text)">
          {sel}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-4 font-semibold text-(--v3-text)">{name?.zh ?? selBlock?.label ?? "符号"}</p>
          <p className="mt-1 text-[12px] leading-4 whitespace-nowrap text-(--v3-text-2) tabular-nums">
            {codePoint(sel)}
            {name ? ` · ${name.en}` : ""}
            {selBlock ? ` · ${selBlock.label}` : ""}
          </p>
        </div>
        <Button variant="primary" className="min-w-[72px] gap-1.5" onClick={insert}>
          {inserted ? (
            <>
              <Check size={12} strokeWidth={2} aria-hidden="true" />
              已插入
            </>
          ) : (
            <>
              插入
              <CornerDownLeft size={12} strokeWidth={1.75} aria-hidden="true" className="opacity-70" />
            </>
          )}
        </Button>
        <span role="status" className="sr-only">
          {inserted ? `已插入「${inserted}」` : ""}
        </span>
      </div>
    </div>
  )
}
