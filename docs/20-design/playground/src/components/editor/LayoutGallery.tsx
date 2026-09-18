import { useMemo, useState } from "react"
import { CircleCheck, LayoutTemplate, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { masters, type LayoutDef, type MasterDef } from "@/lib/mock-data"
import { MiniSlide } from "./MiniSlide"

/**
 * 03-screens/27：按母版分组的版式画廊。当前页所属母版始终置顶；"与当前页相同"仅出现在该组。
 * 复用于：Ribbon"幻灯片"分组"新建▾/版式▾"、缩略图栏"+新建"flyout、/editor/layouts 独立页。
 */
export function LayoutGallery({
  mode,
  currentMasterId,
  currentLayoutId,
  onSelect,
  className,
  mastersOverride,
}: {
  mode: "new" | "change"
  currentMasterId: string
  currentLayoutId?: string
  onSelect: (masterId: string, layout: LayoutDef) => void
  className?: string
  /** 仅供 /editor/layouts 演示"单母版文档"退化为扁平网格的状态，默认使用全局 masters 数据 */
  mastersOverride?: MasterDef[]
}) {
  const [query, setQuery] = useState("")
  const source = mastersOverride ?? masters
  const ordered = useMemo(() => {
    const current = source.find((m) => m.id === currentMasterId)
    const rest = source.filter((m) => m.id !== currentMasterId)
    return current ? [current, ...rest] : source
  }, [currentMasterId, source])

  const filtered = ordered
    .map((m) => ({ master: m, layouts: m.layouts.filter((l) => l.name.includes(query)) }))
    .filter((g) => g.layouts.length > 0)

  const showGroupHeaders = source.length > 1

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput placeholder="搜索版式…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="搜索版式" />
      </InputGroup>

      {filtered.length === 0 ? (
        <Empty className="py-6">
          <EmptyMedia variant="icon">
            <Search />
          </EmptyMedia>
          <EmptyTitle className="text-sm">未找到匹配的版式</EmptyTitle>
        </Empty>
      ) : (
        <ScrollArea className="max-h-80">
          <div className="flex flex-col gap-4 pr-3">
            {filtered.map(({ master, layouts }) => (
              <MasterGroup
                key={master.id}
                master={master}
                layouts={layouts}
                isCurrent={master.id === currentMasterId}
                mode={mode}
                currentLayoutId={currentLayoutId}
                showHeader={showGroupHeaders}
                onSelect={onSelect}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

function MasterGroup({
  master,
  layouts,
  isCurrent,
  mode,
  currentLayoutId,
  showHeader,
  onSelect,
}: {
  master: MasterDef
  layouts: LayoutDef[]
  isCurrent: boolean
  mode: "new" | "change"
  currentLayoutId?: string
  showHeader: boolean
  onSelect: (masterId: string, layout: LayoutDef) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {showHeader && (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <LayoutTemplate className="size-3.5 text-muted-foreground" />
            {master.name}
            {master.imported && <Badge variant="outline" className="text-2xs">导入</Badge>}
            {isCurrent && <span className="font-normal text-muted-foreground">· 当前页所用母版</span>}
          </div>
          {!isCurrent && <p className="text-xs text-muted-foreground">选择其它母版下的版式会同时把本页所属母版切换为「{master.name}」</p>}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {isCurrent && mode === "change" && (
          <LayoutCard
            name="与当前页相同"
            kind={masters.find((m) => m.id === master.id)?.layouts.find((l) => l.id === currentLayoutId)?.kind ?? "title-content"}
            selected
            badge="默认"
            onClick={() => {
              const l = master.layouts.find((x) => x.id === currentLayoutId)
              if (l) onSelect(master.id, l)
            }}
          />
        )}
        {layouts.map((l) => (
          <LayoutCard
            key={l.id}
            name={l.name}
            kind={l.kind}
            selected={isCurrent && mode !== "change" && l.id === currentLayoutId}
            badge={isCurrent && l.id === currentLayoutId ? "当前" : undefined}
            onClick={() => onSelect(master.id, l)}
          />
        ))}
      </div>
    </div>
  )
}

function LayoutCard({
  name,
  kind,
  selected,
  badge,
  onClick,
}: {
  name: string
  kind: LayoutDef["kind"]
  selected?: boolean
  badge?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group relative flex flex-col gap-1 rounded-md border p-1.5 text-left outline-none transition-colors hover:border-ring focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-primary ring-1 ring-primary"
      )}
    >
      <MiniSlide kind={kind} className="rounded-sm border" />
      {selected && (
        <CircleCheck className="absolute top-2 right-2 size-4 rounded-full bg-background text-primary" aria-hidden="true" />
      )}
      <span className="truncate text-[11px] leading-tight text-foreground">
        {name}
        {badge && <span className="ml-1 text-muted-foreground">· {badge}</span>}
      </span>
    </button>
  )
}
