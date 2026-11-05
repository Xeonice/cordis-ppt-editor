import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, Tip } from "../../kit"
import { withReason } from "./controls"
import { BUILTIN_COUNT, collapsedOf, GROUP_LABEL, paint, TABLE_STYLES, type Flags, type StyleGroup, type TableStyle } from "./model"

/** 样式缩略图：44 : 30 的 5 × 5 示意表，纸色底，按当前主题与 6 个标志着色（与画布同一规则，03-30 §6.3） */
export function StyleThumb({ style, flags }: { style: TableStyle; flags: Flags }) {
  const n = 5
  const w = 44
  const h = 30
  const cw = w / n
  const rh = h / n
  const head = paint(style, flags, 0, 0, n, n)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block size-full" aria-hidden="true">
      <rect width={w} height={h} fill="#FFFFFF" />
      {Array.from({ length: n * n }, (_, i) => {
        const r = Math.floor(i / n)
        const c = i % n
        const p = paint(style, flags, r, c, n, n)
        return <rect key={i} x={c * cw} y={r * rh} width={cw} height={rh} fill={p.bg} stroke={p.grid ?? "none"} strokeWidth={p.grid ? 0.5 : 0} />
      })}
      {flags.headerRow && head.rule && <line x1={0} x2={w} y1={rh} y2={rh} stroke={head.rule} strokeWidth={0.9} />}
      {(style.family === "light-1" || style.family === "light-2") && (
        <>
          <line x1={0} x2={w} y1={0.4} y2={0.4} stroke={style.color} strokeWidth={0.8} />
          <line x1={0} x2={w} y1={h - 0.4} y2={h - 0.4} stroke={style.color} strokeWidth={0.8} />
        </>
      )}
    </svg>
  )
}

/**
 * 表格样式库：文档中 → 浅色 → 中等 → 深色（展开后再加「其它」），组头 12px text-2，每组 5 列、间距 6；
 * 收起时每组只列首屏，「显示全部 74 种」展开后组头带计数（浅色 · 21、中等 · 28、深色 · 11、其它 · 14），按钮变「收起」。
 * 当前样式 2px 强调色外圈（与色块选择同一写法）；悬停 1px 灰圈；tooltip 为样式名。
 * 锁定（M2「M3 提供」/ 评审「需要编辑权限」）：缩略图可见，当前样式保留外圈，其余 60%；点击不生效。展开 / 收起是查看操作，始终可用。
 */
export function StyleGallery({
  value,
  onChange,
  flags,
  reason,
  defaultExpanded = false,
}: {
  value: string
  onChange: (id: string) => void
  flags: Flags
  reason?: string | null
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const groups: StyleGroup[] = expanded ? ["doc", "light", "medium", "dark", "other"] : ["doc", "light", "medium", "dark"]
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => {
        const all = TABLE_STYLES.filter((s) => s.group === g)
        const items = expanded ? all : collapsedOf(g)
        const counted = expanded && g !== "doc"
        return (
          <div key={g} role="group" aria-label={counted ? `${GROUP_LABEL[g]} ${all.length} 种` : GROUP_LABEL[g]} className="flex flex-col gap-2">
            <p className="text-[12px] leading-4 text-(--v3-text-2)">
              {GROUP_LABEL[g]}
              {counted && <span className="tabular-nums"> · {all.length}</span>}
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {items.map((s) => {
                const current = s.id === value
                return (
                  <Tip key={s.id} label={reason ? `${s.name} · ${reason}` : s.name}>
                    <button
                      type="button"
                      aria-label={withReason(s.name, reason)}
                      aria-pressed={current}
                      aria-disabled={reason ? true : undefined}
                      onClick={() => !reason && onChange(s.id)}
                      className={cn(
                        "block aspect-[44/30] w-full overflow-hidden rounded-[4px] border border-(--v3-border) transition-shadow",
                        current
                          ? "ring-2 ring-(--v3-accent) ring-offset-1 ring-offset-(--v3-panel)"
                          : reason
                            ? "cursor-default opacity-60"
                            : "hover:ring-1 hover:ring-(--v3-hover-line) hover:ring-offset-1 hover:ring-offset-(--v3-panel)",
                      )}
                    >
                      <StyleThumb style={s} flags={flags} />
                    </button>
                  </Tip>
                )
              })}
            </div>
          </div>
        )
      })}
      <Button variant="ghost" aria-expanded={expanded} className="-mx-2 -my-1 justify-start gap-1 px-2" onClick={() => setExpanded((v) => !v)}>
        {expanded ? (
          <>
            收起
            <ChevronUp size={12} strokeWidth={1.5} aria-hidden="true" />
          </>
        ) : (
          <>
            显示全部 {BUILTIN_COUNT} 种
            <ChevronDown size={12} strokeWidth={1.5} aria-hidden="true" />
          </>
        )}
      </Button>
    </div>
  )
}
