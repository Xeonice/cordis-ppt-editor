/**
 * 长时间离线提示里的受影响页（PRD CO-06、05 §7、50/07 §4「长离线提示」；rulings §4.25 DS-59）：
 * 页码是可点的链接（切到该页检查），最多列出前 3 页；超过 3 页时其后写「等 N 页」（N 为受影响页的总数），页码串不把横幅撑长。
 * 静态样张（3 页）不出现「等 N 页」。这一块只依赖 React（不引 kit、不读编辑器上下文）：verify 在 Node 里直接渲染它，检查 6 页时的输出。
 */

/** 最多列出几页 */
export const AFFECTED_MAX = 3

/** 受影响页的写法：列出的页（可点）与其后的「等 N 页」（不超过上限时为 null） */
export function affectedParts(pages: readonly number[], max = AFFECTED_MAX): { links: number[]; more: string | null } {
  return { links: pages.slice(0, max), more: pages.length > max ? `等 ${pages.length} 页` : null }
}

/** 接在「合并后请检查」后面：「第 2 页、第 3 页、第 5 页」，超过 3 页时「…、第 5 页等 6 页」 */
export function AffectedPages({ pages, current, onPick }: { pages: readonly number[]; current?: number; onPick?: (n: number) => void }) {
  const { links, more } = affectedParts(pages)
  return (
    <>
      {links.map((n, i) => (
        <span key={n}>
          {i > 0 ? "、" : " "}
          <button
            type="button"
            aria-label={`第 ${n} 页，转到这一页检查`}
            aria-current={current === n ? "page" : undefined}
            onClick={() => onPick?.(n)}
            className="rounded-[2px] font-medium whitespace-nowrap text-(--v3-text) underline decoration-(--v3-text-2) underline-offset-[3px] outline-none hover:decoration-current focus-visible:ring-2 focus-visible:ring-(--v3-accent)"
          >
            第 {n} 页
          </button>
        </span>
      ))}
      {more && <span className="whitespace-nowrap">{more}</span>}
    </>
  )
}
