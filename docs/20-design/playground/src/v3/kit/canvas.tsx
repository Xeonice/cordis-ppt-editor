import type { CSSProperties, KeyboardEvent, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { TONE_BG, TONE_BORDER, TONE_SOFT, type Tone } from "../ui"
import type { Person } from "../data"

/**
 * 画在幻灯片上的叠加件（放在 EditorConfig.slideOverlay 里，父元素就是画布上的幻灯片框）。
 * 位置两种写法：box（数值，幻灯片宽高的百分比，0–100）或 at（Tailwind 定位类，如 CARD_POS）。
 * 颜色只用强调色（选中、参考线、尺寸角标）与中性色（提示），Q3。
 */
export interface Box {
  /** 左上角 x、y 与宽高，都是幻灯片宽 / 高的百分比 */
  x: number
  y: number
  w: number
  h: number
}

export const boxStyle = (b: Box): CSSProperties => ({ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` })

/** 960 × 540 设计稿坐标（PPT 常用）换成百分比 Box：px(629, 232, 264, 176)。 */
export const px = (x: number, y: number, w: number, h: number): Box => ({ x: (x / 960) * 100, y: (y / 540) * 100, w: (w / 960) * 100, h: (h / 540) * 100 })

/** px 的反向：百分比 Box 换回 960 × 540 pt 坐标（取整），检查器「位置与大小」与画布上同一个框写同一组数时用：ptOf(box) → { x, y, w, h } */
export const ptOf = (b: Box): { x: number; y: number; w: number; h: number } => ({
  x: Math.round((b.x / 100) * 960),
  y: Math.round((b.y / 100) * 540),
  w: Math.round((b.w / 100) * 960),
  h: Math.round((b.h / 100) * 540),
})

const CORNERS = ["-top-1 -left-1", "-top-1 -right-1", "-bottom-1 -left-1", "-right-1 -bottom-1"]
const EDGES = ["-top-1 left-1/2 -translate-x-1/2", "-bottom-1 left-1/2 -translate-x-1/2", "top-1/2 -left-1 -translate-y-1/2", "top-1/2 -right-1 -translate-y-1/2"]

/** 强调色角标（11px 数字）：尺寸「264 × 176」、间距「24」、角度「15°」。带文字的强调色实底用 --v3-accent-solid（白字 5.44:1，DS-9）。 */
export function SizeTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] items-center rounded-[4px] bg-(--v3-accent-solid) px-1.5 text-[11px] leading-none whitespace-nowrap text-(--v3-accent-fg) tabular-nums",
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * 选中框：1px 强调色线 + 白底强调色边的小方块手柄（四角，或四角加四边中点）+ 下方尺寸角标。
 * 与画布上示例要点卡的选中框同一组件。
 */
export function SelectionBox({
  box,
  at,
  label,
  handles = "corners",
  dashed,
  className,
  children,
}: {
  box?: Box
  at?: string
  /** 下方尺寸角标，如「264 × 176」 */
  label?: string
  handles?: "corners" | "all" | "none"
  /** 虚线框（如占位符、组合内的子对象） */
  dashed?: boolean
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn("pointer-events-none absolute border border-(--v3-accent)", dashed && "border-dashed", at, className)} style={box && boxStyle(box)}>
      {handles !== "none" &&
        (handles === "all" ? [...CORNERS, ...EDGES] : CORNERS).map((p) => <span key={p} className={cn("absolute size-2 rounded-[1px] border border-(--v3-accent) bg-(--v3-handle-fill)", p)} />)}
      {label && (
        <span className="absolute top-[calc(100%+8px)] left-1/2 inline-flex h-[18px] -translate-x-1/2 items-center rounded-[4px] bg-(--v3-accent-solid) px-1.5 text-[11px] leading-none whitespace-nowrap text-(--v3-accent-fg) tabular-nums">
          {label}
        </span>
      )}
      {children}
    </div>
  )
}

/** 框选（拖出的选择框）：1px 强调色虚线 + 浅强调色底。 */
export function Marquee({ box, at, className }: { box?: Box; at?: string; className?: string }) {
  return <div className={cn("pointer-events-none absolute border border-dashed border-(--v3-accent) bg-(--v3-accent-soft)", at, className)} style={box && boxStyle(box)} />
}

/** 悬停高亮（对象被指针掠过、或查找命中项）：1px 强调色线，不带手柄。 */
export function HoverBox({ box, at, fill, className }: { box?: Box; at?: string; /** 加浅强调色底（如查找当前命中） */ fill?: boolean; className?: string }) {
  return <div className={cn("pointer-events-none absolute border border-(--v3-accent)", fill && "bg-(--v3-sel)", at, className)} style={box && boxStyle(box)} />
}

/**
 * 智能参考线 / 间距线：1px 强调色（横 h / 竖 v），at 是线所在的百分比位置，from–to 是线段范围；label 画在线段中点（间距数值）。
 */
export function Guide({ orientation, at, from = 0, to = 100, label, dashed }: { orientation: "h" | "v"; at: number; from?: number; to?: number; label?: string; dashed?: boolean }) {
  const h = orientation === "h"
  const style: CSSProperties = h ? { top: `${at}%`, left: `${from}%`, width: `${to - from}%` } : { left: `${at}%`, top: `${from}%`, height: `${to - from}%` }
  return (
    <div
      className={cn(
        "pointer-events-none absolute",
        h ? "h-0 border-t" : "w-0 border-l",
        dashed ? "border-dashed" : "border-solid",
        "border-(--v3-accent)",
      )}
      style={style}
    >
      {label && <SizeTag className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">{label}</SizeTag>}
    </div>
  )
}

/**
 * 网格（03-20 §5 画法；03-17「显示网格」、主菜单「视图 › 网格与参考线 ▸」）：画在纸面（当前页幻灯片）上，线距等于网格间距
 * （spacing，pt，幻灯片 960 × 540 pt 坐标；三档 6 / 12 / 18、缺省 12，rulings §4.25 DS-27），中性细线 --v3-text-3 18% 不透明、每 4 格加深到 36%；
 * 1px 不随缩放变粗；取亮色纸面 token（.v3-paper），与界面主题无关。只在编辑时叠加，不进缩略图、放映与导出；不是选中，所以不用强调色（Q3）。
 */
export function SlideGrid({ spacing = 12 }: { spacing?: number }) {
  const step = spacing > 0 ? spacing : 12
  // 页边上的线不画（与纸面边缘重合）
  const lines = (total: number) => Array.from({ length: Math.ceil(total / step) - 1 }, (_, i) => ({ at: (i + 1) * step, major: (i + 1) % 4 === 0 }))
  return (
    <svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true" className="v3-paper pointer-events-none absolute inset-0 size-full stroke-(--v3-text-3)">
      {lines(960).map(({ at, major }) => (
        <line key={`x${at}`} x1={at} x2={at} y1={0} y2={540} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeOpacity={major ? 0.36 : 0.18} />
      ))}
      {lines(540).map(({ at, major }) => (
        <line key={`y${at}`} x1={0} x2={960} y1={at} y2={at} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeOpacity={major ? 0.36 : 0.18} />
      ))}
    </svg>
  )
}

/** 画布上的中性提示签（键盘提示、拖入说明、一次性内联提示）：panel 底、1px 边、浮层阴影、12px。box 只取左上角（x、y 百分比）。 */
export function CanvasTag({ box, at, children, className }: { box?: Pick<Box, "x" | "y">; at?: string; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inline-flex h-6 items-center gap-1.5 rounded-[4px] border border-(--v3-border) bg-(--v3-panel) px-2 text-[12px] leading-none whitespace-nowrap text-(--v3-text-2) shadow-(--v3-shadow)",
        at,
        className,
      )}
      style={box && { left: `${box.x}%`, top: `${box.y}%` }}
    >
      {children}
    </div>
  )
}

/**
 * 画布浮条：只用作裁剪这类模式的出口（裁剪框下方「取消 Esc / 完成 ↵」，03-18）——对象一律不设上下文 / 迷你工具条（文字 DS-13，表格、图表 DS-22；
 * 图表「编辑数据」已并入检查器「数据」分区的「展开」，DS-26），不要拿它画对象的工具条。28px 按钮、圆角 8px（6 + 2 内边距）、浮层阴影。
 * box / at 给的是选区；浮条在选区上方（或下方）居中、相距 8px。按钮用 IconButton size={28} 或 Button，分组之间放 BarDivider。
 */
export function FloatingBar({ box, at, placement = "above", label, children }: { box?: Box; at?: string; placement?: "above" | "below"; label: string; children: ReactNode }) {
  return (
    <div className={cn("pointer-events-none absolute z-20", at)} style={box && boxStyle(box)}>
      <div
        role="toolbar"
        aria-label={label}
        // 浮条在幻灯片叠加层里：点上面的按钮不应冒泡到画布的「点空白取消选中」（与 kit 浮层一致）
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "pointer-events-auto absolute left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-[8px] border border-(--v3-border) bg-(--v3-panel) p-0.5 whitespace-nowrap shadow-(--v3-shadow)",
          placement === "above" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]",
        )}
      >
        {children}
      </div>
    </div>
  )
}

/** 浮条 / 浮动面板里按钮分组之间的竖线。 */
export function BarDivider() {
  return <span aria-hidden="true" className="mx-0.5 h-4 w-px shrink-0 bg-(--v3-border)" />
}

/** 透明的点选区域：让自定义页上的对象可以被点中（如点表格 → setSelection("table")）。 */
export function HitArea({
  box,
  at,
  label,
  onClick,
  cursor = "default",
  anchor,
  onKeyDown,
}: {
  box?: Box
  at?: string
  label: string
  onClick: () => void
  cursor?: "default" | "text" | "pointer"
  /** 锚点名（data-v3-anchor）：右键菜单的 target、关闭后焦点交回的地方（如缺插件占位 plugins.qr-1） */
  anchor?: string
  /** 键盘（如 ⇧F10 / 菜单键打开右键菜单，kit openContextMenuFromKey） */
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      data-v3-anchor={anchor}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      // pointer-events-auto：叠加层容器常是 pointer-events-none（属性会继承），点选区域要显式打开
      className={cn("pointer-events-auto absolute", cursor === "text" ? "cursor-text" : cursor === "pointer" ? "cursor-pointer" : "cursor-default", at)}
      style={box && boxStyle(box)}
    />
  )
}

const TONE_FILL: Record<Tone, string> = {
  slate: "fill-(--v3-tone-slate)",
  sand: "fill-(--v3-tone-sand)",
  sage: "fill-(--v3-tone-sage)",
  clay: "fill-(--v3-tone-clay)",
  mist: "fill-(--v3-tone-mist)",
  olive: "fill-(--v3-tone-olive)",
  iris: "fill-(--v3-tone-iris)",
  lake: "fill-(--v3-tone-lake)",
  rose: "fill-(--v3-tone-rose)",
  denim: "fill-(--v3-tone-denim)",
  plum: "fill-(--v3-tone-plum)",
  moss: "fill-(--v3-tone-moss)",
}

/** 远端协作者的姓名签：20px 高、12px 白字、圆角 4，底色取身份色（远端光标、远端选区、远端文本选区共用）。 */
export function PresenceTag({ name, tone = "sage", className }: { name: string; tone?: Tone; className?: string }) {
  return <span className={cn("absolute inline-flex h-5 items-center rounded-[4px] px-1.5 text-[12px] leading-none whitespace-nowrap text-white", TONE_BG[tone], className)}>{name}</span>
}

/**
 * 远端协作者光标：身份色箭头 + 名字签（画布上每页只出现一处，不加更多装饰）。
 * tone 取该协作者头像的底色（缺省 sage = 示例里的「李雷」）；label=false 表示光标静止一段时间后收起姓名签（05 §3）。
 */
export function RemoteCursor({ at, name = "李雷", tone = "sage", label = true }: { at: string; name?: string; tone?: Tone; label?: boolean }) {
  return (
    <div className={cn("pointer-events-none absolute z-10", at)} aria-label={`${name}的光标`}>
      <svg width="14" height="17" viewBox="0 0 14 17" aria-hidden="true" className={cn("block stroke-white", TONE_FILL[tone])} strokeWidth="1" strokeLinejoin="round">
        <path d="M1.2 1.2v12.1l3.1-2.9 2.3 5 2.1-1-2.2-4.9h4.4Z" />
      </svg>
      {label && <PresenceTag name={name} tone={tone} className="top-3.5 left-3" />}
    </div>
  )
}

/** 远端对象选区：身份色 1.5px 实线框，不画手柄（手柄只属于本地操作者，05 §3）；姓名签贴在左上角外侧。 */
export function RemoteSelection({ person, at, box }: { person: Person; at?: string; box?: Box }) {
  return (
    <div className={cn("pointer-events-none absolute border-[1.5px]", TONE_BORDER[person.tone], at)} style={box && boxStyle(box)} aria-label={`${person.name}选中了此对象`}>
      <PresenceTag name={person.name} tone={person.tone} className="bottom-[calc(100%+3px)] -left-[1.5px]" />
    </div>
  )
}

/** 远端文本选区：身份色低透明度底 + 同色 2px 插入符，姓名签在插入符上方（05 §3）。box 为幻灯片百分比。 */
export function RemoteTextSelection({ person, box }: { person: Person; box: Box }) {
  return (
    <div className="pointer-events-none absolute" style={boxStyle(box)} aria-label={`${person.name}正在编辑这段文字`}>
      <div className={cn("absolute inset-0", TONE_SOFT[person.tone])} />
      <div className={cn("absolute -top-[12%] -right-px h-[124%] w-[2px]", TONE_BG[person.tone])} />
      <PresenceTag name={person.name} tone={person.tone} className="bottom-[calc(112%+2px)] -right-px" />
    </div>
  )
}

/**
 * 评论钉（评论锚点）：24px 身份色底、白色首字，左下角为尖角指向锚点；白色 2px 描边保证落在图表等彩色内容上也看得清。
 * x / y 为锚点在幻灯片上的百分比。评审模式下画布上只有它可点（02 §6.2）；touch：仅查看形态（< 640px）把点按区扩到 44（伪元素向外延伸，钉的大小不变）。
 * 视觉在 2026-10-07 第 1 批拍板时已定稿（rulings §4.25 DS-21，03-02 §3.2），评论交互随第 2 批（03-06）定稿。
 */
export function CommentPin({ person, x, y, label, touch, onClick }: { person: Person; x: number; y: number; label: string; touch?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className={cn(
        "absolute z-10 flex size-6 -translate-y-full items-center justify-center rounded-full rounded-bl-none text-[12px] leading-none font-medium text-white ring-2 ring-white",
        touch && "before:absolute before:-inset-2.5 before:content-['']",
        TONE_BG[person.tone],
      )}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {person.name.slice(0, 1)}
    </button>
  )
}
