import type { ReactNode } from "react"

/**
 * 只读的一行（评审模式、只读角色，DS-15）：只列属性与当前值，不是字段（没有底色、边界与 ▾），也不画不可用的控件，一看就不能点。
 * 节的结构与编辑模式相同（用户能对上号），只是每节只写当前值（02 §6.2「设计页签只读展示」）。
 * label：左侧 64px 标签列（text-2，与图表等场景的只读行同一画法）；leading：值前面的色块、缩略图。高 28，值不截断、过长时换行（Q7）。
 * 两列并排时用 <Cols className="gap-y-0">，节用 bodyClassName="gap-0"，行与行之间不再留空。
 */
export function StaticRow({ label, leading, children }: { label?: string; leading?: ReactNode; children: ReactNode }) {
  return (
    <div data-slot="static-row" className="flex min-h-7 min-w-0 items-start gap-2 py-[5px] text-[12px] leading-[18px] text-(--v3-text)">
      {label && <span className="w-16 shrink-0 text-(--v3-text-2)">{label}</span>}
      {leading && <span className="flex h-[18px] shrink-0 items-center">{leading}</span>}
      <span className="min-w-0 break-words">{children}</span>
    </div>
  )
}
