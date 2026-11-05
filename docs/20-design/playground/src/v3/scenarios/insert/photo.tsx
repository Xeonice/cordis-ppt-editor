import { useId } from "react"
import { cn } from "@/lib/utils"
import { deckWith, px, SlideFooter, SlideTitle, useEditorMaybe, useSceneState, type Box, type DeckSlide } from "../../kit"

/**
 * image-editing 场景的文档内容：第 5 页换成「华东交付中心」图文页，左侧一张外景照片（内联 SVG 绘制，不加载外部图片），
 * 右侧要点。照片是文档内容，颜色不受 UI 配色限制（Q3）；同一组件用于画布、缩略图与检查器里的图片预览。
 */

/** 照片在页面上的位置（960 × 540）：x 67、y 154、480 × 320（3:2） */
export const PICTURE_BOX: Box = px(67.2, 153.6, 480, 320)
/** 裁剪中：上 8%、下 4%、左 10%、右 6% */
export const CROP_BOX: Box = px(67.2 + 48, 153.6 + 25.6, 480 - 48 - 28.8, 320 - 25.6 - 12.8)

/** 外景照片：玻璃幕墙办公楼、两侧裙楼、前广场与树（600 × 400 视框）。渐变 id 每个实例唯一，缩略图与画布同时渲染也不串。 */
export function PhotoArt({ className }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const id = (k: string) => `${k}-${uid}`
  const floors = Array.from({ length: 15 }, (_, i) => 76 + i * 15)
  const cols = Array.from({ length: 9 }, (_, i) => 196 + i * 23)
  return (
    <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={cn("block size-full", className)}>
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7FAAD6" />
          <stop offset="0.55" stopColor="#BCD4EA" />
          <stop offset="1" stopColor="#E4EDF5" />
        </linearGradient>
        <radialGradient id={id("sun")} cx="0.82" cy="0.12" r="0.45">
          <stop offset="0" stopColor="#FFF7E6" stopOpacity="0.85" />
          <stop offset="1" stopColor="#FFF7E6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("glass")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4B7BA6" />
          <stop offset="0.6" stopColor="#30587F" />
          <stop offset="1" stopColor="#223F5E" />
        </linearGradient>
        <linearGradient id={id("glint")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.2" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.28" />
          <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.05" />
          <stop offset="0.8" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id("side")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#264766" />
          <stop offset="1" stopColor="#172F47" />
        </linearGradient>
        <linearGradient id={id("plaza")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C9CFD6" />
          <stop offset="1" stopColor="#9BA4AE" />
        </linearGradient>
      </defs>

      {/* 天空、阳光、云 */}
      <rect width="600" height="400" fill={`url(#${id("sky")})`} />
      <rect width="600" height="400" fill={`url(#${id("sun")})`} />
      <g fill="#FFFFFF" opacity="0.55">
        <ellipse cx="96" cy="58" rx="58" ry="12" />
        <ellipse cx="132" cy="50" rx="34" ry="10" />
        <ellipse cx="520" cy="96" rx="46" ry="9" />
      </g>

      {/* 远处城市天际线（雾化） */}
      <g fill="#A9BCCF" opacity="0.9">
        <rect x="0" y="214" width="34" height="70" />
        <rect x="38" y="196" width="22" height="88" />
        <rect x="64" y="226" width="40" height="58" />
        <rect x="470" y="204" width="26" height="80" />
        <rect x="500" y="186" width="20" height="98" />
        <rect x="524" y="220" width="44" height="64" />
        <rect x="572" y="232" width="28" height="52" />
      </g>

      {/* 主楼：正立面玻璃幕墙 + 侧立面 + 顶部檐口 */}
      <rect x="190" y="70" width="210" height="232" fill={`url(#${id("glass")})`} />
      <g stroke="#A9C3DA" strokeOpacity="0.32" strokeWidth="1">
        {floors.map((y) => (
          <line key={y} x1="190" x2="400" y1={y} y2={y} />
        ))}
        {cols.map((x) => (
          <line key={x} x1={x} x2={x} y1="70" y2="302" />
        ))}
      </g>
      <rect x="190" y="70" width="210" height="232" fill={`url(#${id("glint")})`} />
      <polygon points="400,70 452,90 452,302 400,302" fill={`url(#${id("side")})`} />
      <g stroke="#7E9CB8" strokeOpacity="0.28" strokeWidth="1">
        {floors.map((y, i) => (
          <line key={y} x1="400" x2="452" y1={y} y2={y + 20 - i * 1.33} />
        ))}
      </g>
      <polygon points="186,64 404,64 456,84 456,90 400,70 190,70" fill="#E3E8ED" />

      {/* 两侧裙楼：浅色石材 + 深色带窗 */}
      <rect x="92" y="222" width="102" height="80" fill="#DDE2E7" />
      <rect x="92" y="218" width="102" height="5" fill="#EEF1F4" />
      <rect x="100" y="248" width="86" height="30" fill="#2E4D6B" />
      <g stroke="#A9C3DA" strokeOpacity="0.4">
        {[117, 134, 151, 168].map((x) => (
          <line key={x} x1={x} x2={x} y1="248" y2="278" />
        ))}
      </g>
      <text x="143" y="240" textAnchor="middle" fontSize="10" fontWeight="600" fill="#33475C" letterSpacing="1">华东交付中心</text>
      <rect x="452" y="236" width="92" height="66" fill="#D6DCE2" />
      <rect x="452" y="232" width="92" height="5" fill="#E9EDF1" />
      <rect x="460" y="256" width="76" height="26" fill="#2B4864" />

      {/* 入口雨棚与行人 */}
      <rect x="262" y="284" width="66" height="6" fill="#EEF2F5" />
      <rect x="270" y="290" width="50" height="12" fill="#1C3046" />
      <g fill="#2D3A47">
        <rect x="244" y="290" width="4" height="13" rx="2" />
        <rect x="251" y="292" width="4" height="11" rx="2" />
        <rect x="344" y="289" width="4" height="14" rx="2" />
      </g>

      {/* 前广场：铺地向灭点汇聚 */}
      <rect x="0" y="302" width="600" height="98" fill={`url(#${id("plaza")})`} />
      <g stroke="#B5BCC4" strokeOpacity="0.75" strokeWidth="1">
        {[-260, -60, 120, 300, 480, 660, 860].map((x) => (
          <line key={x} x1="300" y1="302" x2={x} y2="400" />
        ))}
        {[312, 326, 346, 374].map((y) => (
          <line key={y} x1="0" x2="600" y1={y} y2={y} />
        ))}
      </g>

      {/* 前景树与树影 */}
      <g>
        <ellipse cx="78" cy="352" rx="70" ry="10" fill="#7C858F" opacity="0.35" />
        <rect x="70" y="300" width="7" height="50" fill="#5A4636" />
        <circle cx="74" cy="282" r="38" fill="#3B6A4D" />
        <circle cx="44" cy="300" r="28" fill="#4C7C59" />
        <circle cx="104" cy="304" r="24" fill="#447352" />
        <circle cx="64" cy="268" r="16" fill="#5E8F68" opacity="0.8" />
        <ellipse cx="540" cy="356" rx="64" ry="9" fill="#7C858F" opacity="0.35" />
        <rect x="534" y="308" width="6" height="46" fill="#5A4636" />
        <circle cx="538" cy="292" r="32" fill="#3E6D50" />
        <circle cx="566" cy="308" r="22" fill="#4E7E5B" />
        <circle cx="512" cy="310" r="20" fill="#467554" />
        <circle cx="528" cy="280" r="13" fill="#5E8F68" opacity="0.8" />
      </g>
    </svg>
  )
}

const STATS = [
  { k: "建筑面积", v: "1.2 万 m²" },
  { k: "交付团队", v: "260 人" },
  { k: "平均交付周期", v: "−25%" },
]

/** 场景共享状态（picture-flow.tsx 写、这里画）：已应用裁剪；上传占位框（取消 / 移除后为 gone，不再画浅色空框） */
export const CROPPED = "image-editing.cropped"
const UPLOAD = "image-editing.upload"

export type UploadState = "uploading" | "failed" | "gone"

/** 上传占位框的状态：初值取状态的 data.upload（uploading / failed）；缩略图、画布、轻提示各处读写同一份（初值各处一致） */
export function useUploadState() {
  const data = useEditorMaybe()?.data
  return useSceneState<UploadState | null>(UPLOAD, () => (data?.upload === "uploading" || data?.upload === "failed" ? data.upload : null))
}

/** 裁剪范围（与 CROP_BOX、检查器「裁剪」一致）：上 8%、右 6%、下 4%、左 10% */
const CROP_INSET = "inset(8% 6% 4% 10%)"

/** 「华东交付中心」图文页。frame：照片还没到位（上传中 / 失败），只在照片位置画一个浅色空框；裁剪完成后照片按裁剪框显示 */
function PhotoSlide({ frame }: { frame?: boolean }) {
  const [cropped] = useSceneState<boolean>(CROPPED, false)
  const [upload] = useUploadState()
  const gone = frame && upload === "gone"
  return (
    <>
      <SlideTitle>华东交付中心</SlideTitle>
      <div
        className={cn("absolute top-[16cqw] left-[7cqw] h-[33.333cqw] w-[50cqw] overflow-hidden", frame && !gone && "bg-(--s-card)")}
        style={!frame && cropped ? { clipPath: CROP_INSET } : undefined}
      >
        {!frame && <PhotoArt />}
      </div>
      <div className="absolute top-[16cqw] right-[7cqw] left-[60.5cqw]">
        <p className="text-[1.8cqw] leading-none font-semibold text-(--s-brand)">7 月 1 日正式启用</p>
        <p className="mt-[1.6cqw] text-[3.2cqw] leading-[1.3] font-bold">
          可同时支撑
          <br />
          40 个项目并行交付
        </p>
        <div className="mt-[3cqw]">
          {STATS.map((s) => (
            <div key={s.k} className="flex h-[5.4cqw] items-center justify-between border-t-[0.12cqw] border-(--s-line)">
              <span className="text-[1.8cqw] leading-none text-(--s-body)">{s.k}</span>
              <span className="text-[2.5cqw] leading-none font-semibold tabular-nums">{s.v}</span>
            </div>
          ))}
        </div>
      </div>
      <SlideFooter page={5} />
    </>
  )
}

/** 示例文档第 5 页换成「华东交付中心」图文页（左栏缩略图、网格同步） */
export function photoDeck(variant: "photo" | "frame" = "photo"): DeckSlide[] {
  return deckWith({ 5: { name: "华东交付中心", layout: "两栏内容", render: () => <PhotoSlide frame={variant === "frame"} /> } })
}
