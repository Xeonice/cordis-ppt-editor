import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"
import { deckWith, SlideFooter, SlideTitle, type DeckSlide, type SlideRenderOpts } from "../../kit"
import { alignRight, findStyle, geomOf, mergesOf, paint, PLACEHOLDER, rowsOf, TABLE_PAGE, type Flags, type Merge, type Variant } from "./model"
import { useTableUi } from "./store"

/**
 * 第 5 页「区域分布」：标题 + 一行说明 + 正文占位符位置上的表格（或空占位符）。
 * 表格是幻灯片内容：颜色取文档主题（强调 1），不随界面亮暗变化；左栏缩略图、网格与画布是同一渲染（Q8）。
 * 空占位符的虚线框与提示文字只画在画布上（不进缩略图、放映与导出，03-16）；图标条在画布叠加层（overlays.tsx）。
 */
export function TableSlide({ variant, where }: { variant: Variant; where: SlideRenderOpts["where"] }) {
  return (
    <>
      <SlideTitle>区域分布</SlideTitle>
      <p className="absolute top-[16cqw] left-[7cqw] text-[2.1cqw] leading-none whitespace-nowrap text-(--s-body)">Q2 各区域月度营收，单位：万元</p>
      {variant === "empty" ? where === "canvas" && <EmptyPlaceholder /> : <SlideTableLive variant={variant} />}
      <SlideFooter page={TABLE_PAGE} />
    </>
  )
}

/** 与 03-16（文本组）空占位符同一画法：70% 说明灰虚线框、圆点 +「单击此处添加文本」 */
function EmptyPlaceholder() {
  return (
    <div
      className="absolute border border-dashed border-[color-mix(in_srgb,var(--s-mute)_70%,transparent)]"
      style={{ left: `${PLACEHOLDER.x}cqw`, top: `${PLACEHOLDER.y}cqw`, width: `${PLACEHOLDER.w}cqw`, height: `${PLACEHOLDER.h}cqw` }}
    >
      <p className="flex items-center gap-[1.2cqw] px-[1.6cqw] pt-[1.4cqw] text-[2.2cqw] leading-[1.4] text-(--s-mute)">
        <span className="size-[0.85cqw] rounded-full bg-(--s-mute)" aria-hidden="true" />
        单击此处添加文本
      </p>
    </div>
  )
}

/** 读运行中的样式与标志（检查器改了，画布与缩略图同时刷新） */
function SlideTableLive({ variant }: { variant: Variant }) {
  const [ui] = useTableUi()
  return <SlideTable variant={variant} styleId={ui.styleId} flags={ui.flags} />
}

const covered = (ms: Merge[], r: number, c: number) => ms.some((m) => r >= m.r && r < m.r + m.rs && c >= m.c && c < m.c + m.cs && !(r === m.r && c === m.c))

/**
 * 表格：CSS grid，合并格用 span；单元格边距 0.10 in / 0.05 in（OOXML 缺省），文字顶端对齐（03-30 §2.4、§6.4）。
 * 网格线、强调线用内阴影画，格子按列宽严丝合缝地铺开，叠加层按同一组列宽定位。
 */
export function SlideTable({ variant, styleId, flags }: { variant: Variant; styleId: string; flags: Flags }) {
  const g = geomOf(variant)
  const rows = rowsOf(variant)
  const merges = mergesOf(variant)
  const style = findStyle(styleId)
  const nR = rows.length
  const nC = g.cols.length
  const grid: CSSProperties = {
    left: `${g.x}cqw`,
    top: `${g.y}cqw`,
    gridTemplateColumns: g.cols.map((w) => `${w}cqw`).join(" "),
    gridAutoRows: `${g.rowH}cqw`,
  }
  return (
    <div role="table" aria-label={`区域月度营收表，${nR} 行 ${nC} 列`} className="absolute grid" style={grid}>
      {rows.flatMap((row, r) =>
        row.map((text, c) => {
          if (covered(merges, r, c)) return null
          const m = merges.find((x) => x.r === r && x.c === c)
          const p = paint(style, flags, r, c, nR, nC)
          const lines = [
            p.grid ? `inset -0.12cqw 0 0 ${p.grid}, inset 0 -0.12cqw 0 ${p.grid}` : "",
            p.rule && r === 0 ? `inset 0 -0.22cqw 0 ${p.rule}` : "",
            p.rule && r > 0 ? `inset 0 0.22cqw 0 ${p.rule}` : "",
          ].filter(Boolean)
          return (
            <div
              key={`${r}-${c}`}
              role="cell"
              className={cn(
                "overflow-hidden px-[0.75cqw] py-[0.375cqw] text-[1.9cqw] leading-[1.25] whitespace-nowrap",
                alignRight(variant, c) && "text-right tabular-nums",
              )}
              style={{
                gridRow: m && m.rs > 1 ? `span ${m.rs}` : undefined,
                gridColumn: m && m.cs > 1 ? `span ${m.cs}` : undefined,
                backgroundColor: p.bg,
                color: p.fg,
                fontWeight: p.bold ? 600 : 400,
                boxShadow: lines.length ? lines.join(", ") : undefined,
              }}
            >
              {text}
            </div>
          )
        }),
      )}
    </div>
  )
}

/** 示例文档第 5 页换成表格页（左栏、网格、画布同步）；缺省版式「标题和内容」（有正文占位符），居中插入的演示态用「仅标题」 */
export const deckFor = (variant: Variant): DeckSlide[] =>
  deckWith({
    [TABLE_PAGE]: { name: "区域分布", layout: variant === "new-free" ? "仅标题" : "标题和内容", render: ({ where }) => <TableSlide variant={variant} where={where} /> },
  })
