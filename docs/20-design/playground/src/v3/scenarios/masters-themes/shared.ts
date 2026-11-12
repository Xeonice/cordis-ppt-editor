/** masters-themes 各场景共用的小工具（跨区域共享的状态直接用 kit 的 useSceneState，键带「masters.」前缀）。 */

/** 「第 3–6 页」「第 1、3 页」：页码列表的中文写法（连续的合并成区间）。 */
export function pagesText(pages: readonly number[]): string {
  if (!pages.length) return "未使用"
  const sorted = [...pages].sort((a, b) => a - b)
  const parts: string[] = []
  let start = sorted[0]!
  let prev = start
  for (const n of sorted.slice(1).concat(Number.NaN)) {
    if (n === prev + 1) {
      prev = n
      continue
    }
    parts.push(start === prev ? `${start}` : `${start}–${prev}`)
    start = n
    prev = n
  }
  return `第 ${parts.join("、")} 页`
}
