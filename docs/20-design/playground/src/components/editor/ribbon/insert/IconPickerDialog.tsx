import { useMemo, useState } from "react"
import { Check, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { allIcons, iconCategories, matchIcon } from "./icons-data"

/**
 * 插入 › 形状 › 图标…（rulings §4.21：M3 P2；R elementDesign「图标」）。
 * 左栏分类 + 右侧 8 列网格（格 56，图标 24），可多选；底栏给出插入结果（1 in × 1 in、颜色取主题 tx1、成为 SVG 图片）。
 * 检索：中文名 + 补充词 + 英文 id；分类与检索同时生效。多选后「插入 N 个」按视口中心依次错位插入（slide.insertIcons）。
 */
export function IconPickerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [cat, setCat] = useState("all")
  const [q, setQ] = useState("")
  const [picked, setPicked] = useState<string[]>(["trending-up", "target", "users"])
  const list = useMemo(() => (cat === "all" ? allIcons : iconCategories.find((c) => c.id === cat)?.items ?? []).filter((i) => matchIcon(i, q)), [cat, q])
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const cats = [{ id: "all", label: "全部", count: allIcons.length }, ...iconCategories.map((c) => ({ id: c.id, label: c.label, count: c.items.length }))]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>插入图标</DialogTitle>
          <DialogDescription>线性图标，插入后是可改色的 SVG 图片；可多选。</DialogDescription>
        </DialogHeader>

        <InputGroup>
          <InputGroupAddon><Search /></InputGroupAddon>
          <InputGroupInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索图标，如 增长、团队、目标" aria-label="搜索图标" />
          {q && <InputGroupAddon align="inline-end" className="text-xs tabular-nums">{list.length} 个结果</InputGroupAddon>}
        </InputGroup>

        <div className="flex gap-4">
          <nav aria-label="图标分类" className="flex w-32 shrink-0 flex-col gap-0.5">
            {cats.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-current={cat === c.id || undefined}
                onClick={() => setCat(c.id)}
                className={cn(
                  "flex h-7 items-center justify-between rounded-lg px-2 text-left text-xs text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                  cat === c.id && "bg-accent font-medium text-foreground"
                )}
              >
                {c.label}
                <span className="text-2xs tabular-nums text-muted-foreground">{c.count}</span>
              </button>
            ))}
            <p className="mt-auto px-2 pt-3 text-2xs leading-4 whitespace-nowrap text-muted-foreground">Lucide 图标（ISC）</p>
          </nav>

          <div className="h-[308px] min-w-0 flex-1 overflow-y-auto rounded-2xl bg-foreground/[0.03] p-2">
            {list.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">没有匹配「{q}」的图标</div>
            ) : (
              <div role="listbox" aria-multiselectable="true" aria-label="图标" className="grid grid-cols-8 gap-1.5">
                {list.map((it) => {
                  const on = picked.includes(it.id)
                  return (
                    <Tooltip key={it.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          role="option"
                          aria-selected={on}
                          aria-label={it.name}
                          onClick={() => toggle(it.id)}
                          className={cn(
                            "relative flex aspect-square items-center justify-center rounded-xl text-foreground/85 outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-foreground/10",
                            on && "bg-primary/10 text-primary ring-2 ring-primary hover:bg-primary/15 hover:text-primary dark:hover:bg-primary/20"
                          )}
                        >
                          <it.icon className="size-6" strokeWidth={1.75} />
                          {on && (
                            <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
                              <Check className="size-3" strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{it.name}</TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {picked.length > 0 ? `已选 ${picked.length} 个` : "未选择"} · 插入为 1 in × 1 in，颜色取主题文字色
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button
              disabled={picked.length === 0}
              onClick={() => { onOpenChange(false); toast(`已插入 ${picked.length} 个图标`, { action: { label: "撤销", onClick: () => toast.success("已撤销") } }) }}
            >
              插入 {picked.length > 0 ? `${picked.length} 个` : ""}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
