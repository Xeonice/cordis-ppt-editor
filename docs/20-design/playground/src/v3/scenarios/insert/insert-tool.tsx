import type { ReactNode } from "react"
import { boxStyle, SelectionBox, SizeTag, type Box } from "../../kit"
import { HintDivider, Key, ModeHint } from "./local-ui"
import { ShapeThumb, type ShapePreset } from "./shapes"

/**
 * 插入工具态（03-15「插入工具态」）与变换手柄的画布叠加件。
 * 提示条放 canvasOverlay（画布顶部居中）；拖出预览、十字光标、变换手柄放 slideOverlay（幻灯片百分比坐标）。
 * 颜色只用强调色（预览、手柄、角标）与纸面中性色（光标示意），Q3。
 */

/** 画布顶部的插入提示条：形状缩略图 · 插入 · 名称 · 单击 / 拖出说明 │ 修饰键（替代 ribbon 版的状态栏「插入工具：名称」） */
export function InsertHint({ shape }: { shape: ShapePreset }) {
  return (
    <ModeHint label={`插入工具：${shape.name}`}>
      <span className="flex items-center gap-2 text-(--v3-text)">
        <ShapeThumb shape={shape} size={16} className="text-(--v3-accent)" />
        <span className="font-semibold">插入 · {shape.name}</span>
      </span>
      <span>单击插入 72 × 72 pt，或拖出大小</span>
      <HintDivider />
      <span className="flex items-center gap-1.5">
        <Key>Shift</Key>锁定比例
      </span>
      <span className="flex items-center gap-1.5">
        <Key>Alt</Key>从中心
      </span>
      <span className="flex items-center gap-1.5">
        <Key>Esc</Key>取消
      </span>
    </ModeHint>
  )
}

/**
 * 十字光标示意：深色细线 + 白色描边，任何底色上都可辨。产品只用 CSS cursor: crosshair，这里是系统光标拍不进截图时的样张替身。
 * x、y 为幻灯片百分比。
 */
export function Crosshair({ x, y }: { x: number; y: number }) {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 23 23"
      aria-hidden="true"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <path d="M11.5 1v21M1 11.5h21" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M11.5 1v21M1 11.5h21" stroke="#141B2D" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * 拖出预览：按下后移动超过 4 px 才算拖出——起点 6px 强调色圆点（白色外圈）、1.5px 强调色虚线包围框、
 * 按真实几何的幽灵预览（强调色 10% 填充、45% 描边；圆角矩形默认圆角 = 短边 × 16.667%）、包围框下方尺寸角标；终点是十字光标。
 * w、h 是 960 × 540 坐标下的宽高（决定幽灵几何与角标数字）。
 */
export function DragPreview({ box, w, h }: { box: Box; w: number; h: number }) {
  const rx = Math.min(w, h) * 0.16667
  return (
    <>
      <div className="pointer-events-none absolute" style={boxStyle(box)} aria-hidden="true">
        <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 size-full overflow-visible">
          <rect x="0" y="0" width={w} height={h} rx={rx} strokeWidth="1.5" vectorEffect="non-scaling-stroke" className="fill-(--v3-accent)/10 stroke-(--v3-accent)/45" />
        </svg>
        <div className="absolute inset-0 border-[1.5px] border-dashed border-(--v3-accent)" />
        <span className="absolute top-0 left-0 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--v3-accent) ring-2 ring-white" />
        <SizeTag className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2">{`${Math.round(w)} × ${Math.round(h)}`}</SizeTag>
      </div>
      <Crosshair x={box.x + box.w} y={box.y + box.h} />
    </>
  )
}

/**
 * 选中后的变换手柄：8 个缩放手柄（kit SelectionBox handles="all"）+ 上方独立的旋转手柄（圆形，接一段 16px 连线）
 * + 调整手柄（菱形、强调色实心白边，只在有 avLst 的形状上；ribbon 版的黄色改为强调色，靠形状区分，Q3）。
 * adjust：调整手柄在上边沿的位置（占框宽的百分比）。
 */
export function TransformBox({ box, label, adjust, rotate = true, children }: { box: Box; label?: string; adjust?: number; rotate?: boolean; children?: ReactNode }) {
  return (
    <SelectionBox box={box} handles="all" label={label}>
      {rotate && (
        <>
          <span aria-hidden="true" className="absolute bottom-[calc(100%+4px)] left-1/2 h-3 w-px -translate-x-1/2 bg-(--v3-accent)" />
          <span aria-hidden="true" className="absolute bottom-[calc(100%+16px)] left-1/2 size-2.5 -translate-x-1/2 rounded-full border border-(--v3-accent) bg-white" />
        </>
      )}
      {adjust !== undefined && (
        <span
          aria-hidden="true"
          className="absolute top-0 size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] border border-white bg-(--v3-accent)"
          style={{ left: `${adjust}%` }}
        />
      )}
      {children}
    </SelectionBox>
  )
}

/** 线条选中：只有两个端点手柄（圆形），没有旋转手柄（03-15「线条两端点手柄」）。坐标为幻灯片百分比。 */
export function LineHandles({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <>
      {[
        [x1, y1],
        [x2, y2],
      ].map(([x, y]) => (
        <span
          key={`${x}-${y}`}
          aria-hidden="true"
          className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-(--v3-accent) bg-white"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      ))}
    </>
  )
}
