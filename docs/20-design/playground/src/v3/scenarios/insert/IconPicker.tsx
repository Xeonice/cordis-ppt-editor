import { useMemo, useState } from "react"
import { Check, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, Dialog, ICON, IconButton, LayerClose, TextField, Tip } from "../../kit"
import { useInsertToast } from "./feedback"
import { ALL_ICONS, ICON_CATEGORIES, matchIcon } from "./icons-data"

/**
 * 插入图标（03-15 G-82；M3 P2）：入口为工具条「更多 › 图标…」与主菜单「插入 › 图标…」。
 * 模态对话框宽 680：顶部搜索（放大镜前缀，有检索词时尾部「N 个结果」）；左侧分类栏 128（28px 行、右侧等宽计数、底注许可）；
 * 右侧 8 列网格（区域高 308，超出滚动），格内图标 24；可多选：选中格为强调色浅底 + 强调色图标 + 右上角对勾点。
 * 底栏左侧写出插入结果（72 × 72 pt、颜色取主题文字色），右侧「插入 N 个」（未选时禁用）。
 * 无结果时网格区居中给出空态，分类栏保持可点，清空检索即恢复。
 */
export function IconPickerDialog({ query = "", picked: initialPicked = ["trending-up", "target", "users"] }: { query?: string; picked?: string[] }) {
  const [cat, setCat] = useState("all")
  const [q, setQ] = useState(query)
  const [picked, setPicked] = useState<string[]>(initialPicked)
  const list = useMemo(() => (cat === "all" ? ALL_ICONS : (ICON_CATEGORIES.find((c) => c.id === cat)?.items ?? [])).filter((i) => matchIcon(i, q)), [cat, q])
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const cats = [{ id: "all", label: "全部", count: ALL_ICONS.length }, ...ICON_CATEGORIES.map((c) => ({ id: c.id, label: c.label, count: c.items.length }))]
  const n = picked.length
  const toast = useInsertToast()

  return (
    <Dialog
      title="插入图标"
      size="lg"
      returnFocus="tool-more"
      description="线性图标，插入后是可改色的 SVG 图片；可多选。"
      bodyClassName="flex flex-col gap-3 p-4"
      footerStart={<span className="text-[12px] leading-4 text-(--v3-text-2)">{n > 0 ? `已选 ${n} 个` : "未选择"} · 插入为 72 × 72 pt，颜色取主题文字色</span>}
      footer={
        // 「取消」「插入 N 个」都关闭对话框（LayerClose；未选时「插入」不可用，点了不关）；插入后画布上轻提示带撤销
        <>
          <LayerClose>
            <Button variant="secondary">取消</Button>
          </LayerClose>
          <LayerClose>
            <Button variant="primary" disabled={n === 0} reason={n === 0 ? "先选择至少一个图标" : undefined} onClick={() => toast(`已插入 ${n} 个图标`, { undo: true })}>
              {n > 0 ? `插入 ${n} 个` : "插入"}
            </Button>
          </LayerClose>
        </>
      }
    >
      <TextField
        aria="搜索图标"
        value={q}
        onChange={setQ}
        placeholder="搜索图标，如 增长、团队、目标"
        leading={<Search {...ICON} className="shrink-0" />}
        trailing={
          q ? (
            <span className="flex items-center gap-1">
              <span className="text-[12px] leading-none whitespace-nowrap text-(--v3-text-2) tabular-nums">{list.length} 个结果</span>
              <IconButton label="清除检索" size={24} className="-mr-1.5" onClick={() => setQ("")}>
                <X {...ICON} />
              </IconButton>
            </span>
          ) : undefined
        }
      />

      <div className="flex gap-4">
        <nav aria-label="图标分类" className="flex w-32 shrink-0 flex-col gap-0.5">
          {cats.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-current={cat === c.id || undefined}
              onClick={() => setCat(c.id)}
              className={cn(
                "flex h-7 items-center justify-between rounded-[4px] px-2 text-left text-[12px] leading-none transition-colors",
                cat === c.id ? "bg-(--v3-panel-2) font-medium text-(--v3-text)" : "text-(--v3-text-2) hover:bg-(--v3-panel-2) hover:text-(--v3-text)",
              )}
            >
              {c.label}
              <span className="text-[11px] font-normal text-(--v3-text-2) tabular-nums">{c.count}</span>
            </button>
          ))}
          <p className="mt-auto px-2 pt-3 text-[12px] leading-4 whitespace-nowrap text-(--v3-text-2)">Lucide 图标（ISC）</p>
        </nav>

        <div className="h-[308px] min-w-0 flex-1 overflow-y-auto">
          {list.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
              <p className="text-[12px] leading-[18px] text-(--v3-text)">
                没有匹配<span className="whitespace-nowrap">「{q}」</span>的图标
              </p>
              <p className="text-[12px] leading-[18px] text-(--v3-text-2)">换个说法试试，如「飞机」「科技」，或清空检索浏览全部分类</p>
            </div>
          ) : (
            <div role="listbox" aria-multiselectable="true" aria-label="图标" className="grid grid-cols-8 gap-1.5">
              {list.map((it) => {
                const on = picked.includes(it.id)
                return (
                  <Tip key={it.id} label={it.name}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={on}
                      aria-label={it.name}
                      onClick={() => toggle(it.id)}
                      className={cn(
                        "relative flex aspect-square items-center justify-center rounded-[6px] transition-colors",
                        on ? "bg-(--v3-accent-soft) text-(--v3-accent)" : "text-(--v3-text) hover:bg-(--v3-panel-2)",
                      )}
                    >
                      <it.icon size={24} strokeWidth={1.5} />
                      {on && (
                        <span aria-hidden="true" className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-(--v3-accent) text-(--v3-accent-fg)">
                          <Check size={10} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  </Tip>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}
