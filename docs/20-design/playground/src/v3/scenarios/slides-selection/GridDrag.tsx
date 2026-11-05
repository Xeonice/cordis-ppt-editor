import type { CSSProperties } from "react"
import { DeckSlideView, SizeTag, useAnchorElement, useEditor, useTrackedRect } from "../../kit"

/**
 * 网格视图里的多选与拖动排序（02-editor-main §5.3：与左栏缩略图同一行为，第 1 批定稿）。
 * 网格由底座 GridView 渲染，这里放在 layers 里按 thumb-<n> 锚点量出幻灯片框的位置，叠加：多选描边、拖动源变淡、插入指示线与拖动影子。
 * 页码标签（16px）+ 间距 8px 在幻灯片框上方，所以幻灯片框 = 锚点矩形去掉顶部 24px。建议并入底座 GridView（selected / dragging / insertAt）。
 */

const LABEL = 24

function useFrame(n: number): CSSProperties | null {
  const el = useAnchorElement(`thumb-${n}`)
  const r = useTrackedRect(el)
  return r ? { left: r.left, top: r.top + LABEL, width: r.width, height: r.height - LABEL } : null
}

/** 多选中的页：与当前页相同的 2px 强调色环。 */
function SelectedRing({ n }: { n: number }) {
  const f = useFrame(n)
  return f ? <div className="absolute rounded-[4px] ring-2 ring-(--v3-accent)" style={f} /> : null
}

/** 拖动源：幻灯片框盖一层 60% 画布色（等于 40% 不透明）。 */
function Dimmed({ n }: { n: number }) {
  const f = useFrame(n)
  return f ? <div className="absolute rounded-[4px] bg-(--v3-canvas)/60" style={f} /> : null
}

/** 插入线画在 after 与 before 两页之间的列距正中，上端 8px 空心圆；影子跟在指针右下。 */
function Insert({ after, before, ghost }: { after: number; before: number; ghost: number[] }) {
  const { deck } = useEditor()
  const a = useFrame(after)
  const b = useFrame(before)
  if (!a || !b) return null
  const top = Number(a.top)
  const height = Number(a.height)
  const x = (Number(a.left) + Number(a.width) + Number(b.left)) / 2
  const [first, second] = ghost.map((n) => deck.find((s) => s.n === n))
  return (
    <>
      <div className="absolute w-0.5 -translate-x-1/2 rounded-[1px] bg-(--v3-accent)" style={{ left: x, top, height }} />
      <div className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-(--v3-accent) bg-(--v3-canvas)" style={{ left: x, top }} />
      {first && (
        <div className="absolute" style={{ left: x + 24, top: top + height * 0.3, width: 208 }}>
          {second && (
            <span className="absolute top-1.5 left-1.5 block w-full overflow-hidden rounded-[4px] ring-1 ring-(--v3-border) shadow-(--v3-shadow)">
              <DeckSlideView slide={second} where="grid" />
            </span>
          )}
          <span className="relative block overflow-hidden rounded-[4px] ring-2 ring-(--v3-accent) shadow-(--v3-shadow)">
            <DeckSlideView slide={first} where="grid" />
          </span>
          {ghost.length > 1 && <SizeTag className="absolute -top-2.5 -right-2.5">{ghost.length}</SizeTag>}
        </div>
      )}
    </>
  )
}

export function GridDragOverlay({ selected, dragging, after, before }: { selected: number[]; dragging: number[]; after: number; before: number }) {
  return (
    <div className="absolute inset-0">
      {selected.map((n) => (
        <SelectedRing key={`s${n}`} n={n} />
      ))}
      {dragging.map((n) => (
        <Dimmed key={`d${n}`} n={n} />
      ))}
      <Insert after={after} before={before} ghost={dragging} />
    </div>
  )
}
