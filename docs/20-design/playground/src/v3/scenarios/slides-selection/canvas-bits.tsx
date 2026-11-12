import { Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { boxStyle, SelectionBox, SizeTag, type Box } from "../../kit"

/**
 * 03-17 用到、kit 里还没有的画布叠加件（放在 slideOverlay，父元素是幻灯片框，百分比定位）。颜色只用强调色与白色手柄底（同 kit 手柄）。
 * 建议并入 kit/canvas.tsx：ConnectionPoint（连接点 / 吸附目标 / 已连接端点）、LockedBox（锁定对象的选中框）、GroupBounds（组合编辑中的外框）。
 */

/**
 * 连接点（cxnLst）与连接符端点：
 * point  悬停形状时显示的连接点：8px 白底、1px 强调色边的圆点；
 * target 正在吸附的连接点：强调色实心 + 2px 强调色外圈（隔 2px 白）；
 * end    已连接的端点：强调色实心 + 2px 白边（未连接的端点用 point 画法）。
 */
export function ConnectionPoint({ x, y, kind = "point" }: { x: number; y: number; kind?: "point" | "target" | "end" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full",
        kind === "point" && "size-2 border border-(--v3-accent) bg-(--v3-handle-fill)",
        kind === "target" && "size-2.5 bg-(--v3-accent) ring-2 ring-(--v3-accent) ring-offset-2 ring-offset-(--v3-handle-fill)",
        kind === "end" && "size-2.5 border-2 border-(--v3-handle-fill) bg-(--v3-accent)",
      )}
      style={{ left: `${x}%`, top: `${y}%` }}
    />
  )
}

const CORNERS = ["-top-2 -left-2", "-top-2 -right-2", "-bottom-2 -left-2", "-right-2 -bottom-2"]

/** 锁定对象（spLocks）的选中框：四角手柄换成锁形图标，拖动无效；下方仍有尺寸标签。 */
export function LockedBox({ box, label }: { box: Box; label?: string }) {
  return (
    <div className="pointer-events-none absolute border border-(--v3-accent)" style={boxStyle(box)}>
      {CORNERS.map((p) => (
        <span key={p} className={cn("absolute flex size-4 items-center justify-center rounded-[4px] border border-(--v3-accent) bg-(--v3-handle-fill) text-(--v3-accent)", p)}>
          <Lock size={10} strokeWidth={2} aria-hidden="true" />
        </span>
      ))}
      {label && <SizeTag className="absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2">{label}</SizeTag>}
    </div>
  )
}

/** 组合编辑中：组合外围的浅色虚线框（强调色 50%），提示「正在组合内编辑」。 */
export function GroupBounds({ box }: { box: Box }) {
  return <div className="pointer-events-none absolute border border-dashed border-(--v3-accent)/50" style={boxStyle(box)} />
}

/**
 * 多选的统一包围盒：虚线框 + 8 个缩放手柄（不显示旋转手柄，03-17），画在所选对象外 3px，
 * 这样与每个对象自己的 1px 描框不重叠，虚线看得出来。
 */
export function UnionBox({ box, label }: { box: Box; label?: string }) {
  return (
    <div className="pointer-events-none absolute" style={boxStyle(box)}>
      <SelectionBox at="-inset-[3px]" dashed handles="all" label={label} />
    </div>
  )
}

