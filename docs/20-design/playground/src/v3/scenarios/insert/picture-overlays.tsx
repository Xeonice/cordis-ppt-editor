import { CircleAlert, CornerDownLeft, ImageUp, Play, TriangleAlert, X } from "lucide-react"
import { BarDivider, boxStyle, Button, FloatingBar, ICON, PaperScope, type Box } from "../../kit"
import { TransformBox } from "./insert-tool"

/**
 * 图片相关的画布叠加件（放 slideOverlay，幻灯片百分比坐标）：选中框 + 缺替代文本角标、裁剪模式、上传中 / 上传失败占位框。
 */

/** 缺少替代文本的画布角标：图片右上角内缩 8px，panel 底、1px 边，警告色图标（只在该状态出现，Q3）。未选中时同样显示。 */
export function AltWarning({ box }: { box: Box }) {
  return (
    <div className="pointer-events-none absolute" style={boxStyle(box)}>
      <span
        role="img"
        aria-label="缺少替代文本"
        className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-[4px] border border-(--v3-border) bg-(--v3-panel) text-(--v3-warning) shadow-(--v3-shadow)"
      >
        <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
      </span>
    </div>
  )
}

/** 图片选中：8 个缩放手柄 + 旋转手柄 + 尺寸角标（图片缩放缺省锁定比例）；missingAlt 时叠缺替代文本角标 */
export function PictureSelected({ box, label, missingAlt }: { box: Box; label: string; missingAlt?: boolean }) {
  return (
    <>
      {missingAlt && <AltWarning box={box} />}
      <TransformBox box={box} label={label} />
    </>
  )
}

/** 裁剪手柄：四角 L 形 + 四边短条，强调色 3px、外描 2px 白边，在照片任何底色上都看得清 */
function CropHandles() {
  const L = "M2 16V2H16"
  const corner = (cls: string, rotate: number) => (
    <svg key={cls} width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className={`absolute ${cls}`} style={{ transform: `rotate(${rotate}deg)` }}>
      <path d={L} fill="none" stroke="white" strokeWidth="5" strokeLinecap="square" />
      <path d={L} fill="none" strokeWidth="3" strokeLinecap="square" className="stroke-(--v3-accent)" />
    </svg>
  )
  const bar = (cls: string, vertical: boolean) => (
    <svg key={cls} width={vertical ? 6 : 20} height={vertical ? 20 : 6} viewBox={vertical ? "0 0 6 20" : "0 0 20 6"} aria-hidden="true" className={`absolute ${cls}`}>
      <path d={vertical ? "M3 2V18" : "M2 3H18"} stroke="white" strokeWidth="5" strokeLinecap="square" />
      <path d={vertical ? "M3 2V18" : "M2 3H18"} strokeWidth="3" strokeLinecap="square" className="stroke-(--v3-accent)" />
    </svg>
  )
  return (
    <>
      {corner("-top-0.5 -left-0.5", 0)}
      {corner("-top-0.5 -right-0.5", 90)}
      {corner("-right-0.5 -bottom-0.5", 180)}
      {corner("-bottom-0.5 -left-0.5", 270)}
      {bar("-top-[3px] left-1/2 -translate-x-1/2", false)}
      {bar("-bottom-[3px] left-1/2 -translate-x-1/2", false)}
      {bar("top-1/2 -left-[3px] -translate-y-1/2", true)}
      {bar("top-1/2 -right-[3px] -translate-y-1/2", true)}
    </>
  )
}

/**
 * 裁剪模式（03-18）：图片外的部分（原图在裁剪框外的区域）盖一层遮罩（--v3-scrim，与对话框遮罩同一 token），裁剪框 1px 强调色 + 三分线 + 8 个裁剪手柄；
 * 框下方浮条「取消 Esc / 完成 ↵」是裁剪模式唯一的出口（与 Enter / Esc 等价）。拖动图片本体在框内平移可见区（光标 move）。
 */
export function CropOverlay({ picture, crop, onCancel, onDone }: { picture: Box; crop: Box; onCancel?: () => void; onDone?: () => void }) {
  // 遮罩：裁剪框四周、图片范围内的四块（百分比相对整页）
  const top = { x: picture.x, y: picture.y, w: picture.w, h: crop.y - picture.y }
  const bottom = { x: picture.x, y: crop.y + crop.h, w: picture.w, h: picture.y + picture.h - (crop.y + crop.h) }
  const left = { x: picture.x, y: crop.y, w: crop.x - picture.x, h: crop.h }
  const right = { x: crop.x + crop.w, y: crop.y, w: picture.x + picture.w - (crop.x + crop.w), h: crop.h }
  return (
    <>
      {[top, bottom, left, right].map((b, i) => (
        <div key={i} aria-hidden="true" className="pointer-events-none absolute bg-(--v3-scrim)" style={boxStyle(b)} />
      ))}
      <div aria-hidden="true" className="pointer-events-none absolute border border-dashed border-white/70" style={boxStyle(picture)} />
      <div role="group" aria-label="裁剪范围" className="absolute cursor-move" style={boxStyle(crop)}>
        <div className="pointer-events-none absolute inset-0 border border-(--v3-accent)" />
        <div className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/45" />
        <div className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/45" />
        <div className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/45" />
        <div className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/45" />
        <CropHandles />
      </div>
      <FloatingBar box={crop} placement="below" label="裁剪">
        <Button variant="ghost" className="gap-2 px-2.5 text-(--v3-text)" onClick={onCancel}>
          取消
          <span className="text-[11px] text-(--v3-text-2)">Esc</span>
        </Button>
        <BarDivider />
        <Button variant="primary" className="gap-2 px-2.5" onClick={onDone}>
          完成
          <CornerDownLeft size={12} strokeWidth={1.75} aria-hidden="true" className="opacity-70" />
        </Button>
      </FloatingBar>
    </>
  )
}

/**
 * 上传中占位框（03-04「加载中」、03-18「上传中」）：画布原位、纸面亮色 token；虚线框内图标 + 文字 + 确定态进度条 + 已传 / 总大小 + 取消。
 * 上传完成后原地换成真实图片，失败则原地变成错误态，都不移动也不弹窗。
 */
export function UploadPlaceholder({ box, percent = 62, onCancel }: { box: Box; percent?: number; onCancel?: () => void }) {
  return (
    <div className="absolute" style={boxStyle(box)}>
      <PaperScope className="flex size-full flex-col items-center justify-center gap-3 border border-dashed border-(--v3-border-control) bg-(--v3-panel-2)">
        <ImageUp size={24} strokeWidth={1.5} aria-hidden="true" className="text-(--v3-text-2)" />
        <div className="flex flex-col items-center gap-2">
          <p className="text-[13px] leading-4 font-medium text-(--v3-text)">正在上传图片…</p>
          <div role="progressbar" aria-label="上传进度" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="h-1 w-[200px] overflow-hidden rounded-[2px] bg-(--v3-panel-3)">
            <div className="h-full rounded-[2px] bg-(--v3-accent)" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-[11px] leading-none text-(--v3-text-2) tabular-nums">1.5 MB / 2.4 MB · {percent}%</p>
        </div>
        <Button variant="ghost" className="gap-1.5 px-2.5 text-(--v3-text)" onClick={onCancel}>
          <X {...ICON} aria-hidden="true" />
          取消上传
        </Button>
      </PaperScope>
    </div>
  )
}

/** 上传失败占位框（03-04「错误」）：危险色浅底 + 虚线，标题、原因、「重试 / 移除」，原位不动 */
export function UploadFailed({ box, onRetry, onRemove }: { box: Box; onRetry?: () => void; onRemove?: () => void }) {
  return (
    <div className="absolute" style={boxStyle(box)}>
      <PaperScope className="flex size-full flex-col items-center justify-center gap-3 border border-dashed border-(--v3-danger)/50 bg-(--v3-danger-soft)">
        <CircleAlert size={24} strokeWidth={1.5} aria-hidden="true" className="text-(--v3-danger)" />
        <div role="alert" className="flex flex-col items-center gap-1">
          <p className="text-[13px] leading-4 font-semibold text-(--v3-text)">图片上传失败</p>
          <p className="text-[12px] leading-[18px] text-(--v3-text-2)">文件过大或格式不支持（单张上限 25 MB）</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onRetry}>
            重试
          </Button>
          <Button variant="ghost" className="text-(--v3-text)" onClick={onRemove}>
            移除
          </Button>
        </div>
      </PaperScope>
    </div>
  )
}

/** 编辑态临时播放（03-18「视频与音频（已有媒体）」）：浏览器原生控件叠在元素底部；示意用的控件条按 Chrome 原生样式简化 */
export function NativeVideoControls({ box }: { box: Box }) {
  return (
    <div className="pointer-events-none absolute" style={boxStyle(box)}>
      <div className="absolute inset-x-0 bottom-0 flex h-10 items-center gap-3 bg-black/55 px-3 text-white">
        <svg viewBox="0 0 16 16" className="size-4 fill-white" aria-hidden="true">
          <rect x="3" y="2.5" width="3.5" height="11" rx="0.8" />
          <rect x="9.5" y="2.5" width="3.5" height="11" rx="0.8" />
        </svg>
        <span className="text-[11px] leading-none tabular-nums">0:12 / 1:30</span>
        <span className="relative h-1 flex-1 rounded-[2px] bg-white/35">
          <span className="absolute inset-y-0 left-0 w-[13%] rounded-[2px] bg-white" />
          <span className="absolute top-1/2 left-[13%] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
        </span>
        <svg viewBox="0 0 16 16" className="size-4 fill-white" aria-hidden="true">
          <path d="M2 6h3l4-3.5v11L5 10H2Z" />
          <path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6 6 0 0 1 0 9" fill="none" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
          <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" fill="none" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

/**
 * 视频海报帧上的居中播放图标（03-18「编辑态临时播放」）：未播放时常显；点它先选中再播放，选中后按 Enter 等价。
 * 圆形按钮跟随 UI 主题（panel 85% 底、1px 边、浮层阴影），在照片任何底色上都看得清。
 */
export function PosterPlay({ box }: { box: Box }) {
  return (
    <div className="pointer-events-none absolute flex items-center justify-center" style={boxStyle(box)}>
      <button
        type="button"
        aria-label="临时播放视频"
        className="pointer-events-auto flex size-14 items-center justify-center rounded-full border border-(--v3-border) bg-(--v3-panel)/85 text-(--v3-text) shadow-(--v3-shadow) transition-colors hover:bg-(--v3-panel)"
      >
        <Play size={22} strokeWidth={1.5} fill="currentColor" aria-hidden="true" className="translate-x-px" />
      </button>
    </div>
  )
}
