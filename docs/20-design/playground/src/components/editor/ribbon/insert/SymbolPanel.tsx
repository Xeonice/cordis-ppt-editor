import { useEffect, useMemo, useRef, useState } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"
import { blockOf, codePoint, recentSymbols, symbolBlocks, symbolNames } from "./symbols-data"

/**
 * 插入 › 文本 › 符号（rulings §4.21：M3 P2；R elementDesign「符号 / 特殊字符」）。
 * 仅在文本编辑态可用（光标在文本里）；非模态面板，插入后焦点回到文本、面板保持打开，便于连续插入。
 * 左栏按 Unicode 区块分类（首项「最近使用」），右侧 8 列字符网格（格 36）；底栏预览 + 名称 + 码位；
 * Enter / 双击 / 「插入」三种方式等价，调用 slide.insertText（无需新命令）。检索支持中文名、英文字符名与十六进制码位。
 */
export function SymbolPanel({ onInsert }: { onInsert: (ch: string) => void }) {
  const [block, setBlock] = useState("arrows")
  const [q, setQ] = useState("")
  const [sel, setSel] = useState("→")
  const nav = useRef<HTMLElement>(null)
  useEffect(() => {
    // 首次打开把当前区块滚到侧栏中部（只滚侧栏自身，不用 scrollIntoView 以免带动外层）
    const n = nav.current, el = n?.querySelector<HTMLElement>("[aria-current]")
    if (n && el) n.scrollTop = el.offsetTop - n.clientHeight / 2 + el.offsetHeight / 2
  }, [])
  const chars = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^u\+/, "")
    if (s) {
      const all = Array.from(new Set([...recentSymbols, ...symbolBlocks.flatMap((b) => Array.from(b.chars))]))
      return all.filter((ch) => {
        const n = symbolNames[ch]; const b = blockOf(ch)
        return codePoint(ch).toLowerCase().includes(s) || (n && (n.zh.includes(s) || n.en.toLowerCase().includes(s))) || (b && b.label.includes(s))
      })
    }
    return Array.from(block === "recent" ? recentSymbols : symbolBlocks.find((b) => b.id === block)?.chars ?? "")
  }, [block, q])
  const cur = symbolBlocks.find((b) => b.id === block)
  const name = symbolNames[sel]
  const selBlock = blockOf(sel)

  return (
    <div className="flex flex-col gap-3">
      <InputGroup>
        <InputGroupAddon><Search /></InputGroupAddon>
        <InputGroupInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索名称或码位，如 箭头、2192" aria-label="搜索符号" />
      </InputGroup>

      <div className="flex h-[252px] gap-3">
        <nav ref={nav} aria-label="Unicode 区块" className="relative -ml-1 flex w-32 shrink-0 flex-col gap-0.5 overflow-y-auto pl-1">
          {[{ id: "recent", label: "最近使用" }, ...symbolBlocks].map((b) => (
            <button
              key={b.id}
              type="button"
              aria-current={!q && block === b.id ? true : undefined}
              onClick={() => { setBlock(b.id); setQ("") }}
              className={cn(
                "flex h-7 shrink-0 items-center rounded-lg px-2 text-left text-xs text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                !q && block === b.id && "bg-accent font-medium text-foreground"
              )}
            >
              {b.label}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="flex h-4 items-baseline justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{q ? "搜索结果" : cur?.label ?? "最近使用"}</span>
            <span className="font-mono text-2xs">{q ? `${chars.length} 个` : cur?.range ?? "仅自己可见"}</span>
          </p>
          <div role="listbox" aria-label="符号" className="grid flex-1 auto-rows-[36px] grid-cols-8 content-start gap-0.5 overflow-y-auto rounded-2xl bg-foreground/[0.03] p-1">
            {chars.map((ch) => (
              <button
                key={ch}
                type="button"
                role="option"
                aria-selected={sel === ch}
                aria-label={`${symbolNames[ch]?.zh ?? ""} ${codePoint(ch)}`.trim()}
                onClick={() => setSel(ch)}
                onDoubleClick={() => onInsert(ch)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onInsert(ch) } }}
                className={cn(
                  "flex items-center justify-center rounded-lg text-lg leading-none text-foreground outline-none transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-foreground/10",
                  sel === ch && "bg-primary/10 text-primary ring-2 ring-primary hover:bg-primary/15 dark:hover:bg-primary/20"
                )}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-foreground/5 pt-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-background text-2xl leading-none ring-1 ring-foreground/10 dark:bg-foreground/10" aria-hidden="true">{sel}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name?.zh ?? selBlock?.label ?? "符号"}</p>
          <p className="truncate font-mono text-2xs text-muted-foreground">{codePoint(sel)}{name ? ` · ${name.en}` : ""}{selBlock ? ` · ${selBlock.label}` : ""}</p>
        </div>
        <Button size="sm" onClick={() => onInsert(sel)} className="gap-1.5">
          插入 <Kbd className="bg-primary-foreground/20 text-primary-foreground">Enter</Kbd>
        </Button>
      </div>
    </div>
  )
}
