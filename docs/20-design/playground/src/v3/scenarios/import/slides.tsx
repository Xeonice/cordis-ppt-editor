import { forwardRef, useEffect } from "react"
import { ExternalLink, Globe, LoaderCircle, VideoOff, type LucideIcon, type LucideProps } from "lucide-react"
import { cn } from "@/lib/utils"
import { boxStyle, CanvasTag, deckWith, DegradedPlaceholder, ICON, px, SlideFooter, SlideTitle, Tip, useSceneState, type Box, type DeckSlide } from "../../kit"
import { PhotoArt } from "../insert/photo"

/**
 * import 场景里「打开后的零散态」用的文档页（03-13 G-06 媒体查看态、外链资源、EMF 栅格化）：示例文档 6 页之后接一页，画在 SlideFrame 里
 * （尺寸一律 cqw，颜色用 --s-*，缩略图与画布同一份渲染）。纸面上的占位一律用底座 DegradedPlaceholder（与保真占位、缺插件占位同一画法，DS-52）；
 * 界面件（视频上的角标、「在新标签页打开」）画在 slideOverlay，跟随界面主题、不进缩略图。
 */

/* ================================================================== 第 7 页「视频资料」：浏览器放不了的格式 + 在线视频 */

/** 两段视频在页面上的位置（960 × 540，16:9 海报） */
export const VIDEO_WMV: Box = px(67, 165, 394, 222)
export const VIDEO_ONLINE: Box = px(499, 165, 394, 222)

/** 在线视频的海报帧（文档里存的那张图）：发布会舞台与大屏，扁平色块（文档内容，颜色不受界面配色限制） */
function StagePoster() {
  const heads = Array.from({ length: 15 }, (_, i) => 22 + i * 43)
  return (
    <svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="block size-full">
      <rect width="640" height="360" fill="#151C2E" />
      <path d="M96 0h86l110 252H36Z" fill="#FFFFFF" fillOpacity="0.05" />
      <path d="M458 0h86l60 252H348Z" fill="#FFFFFF" fillOpacity="0.05" />
      {/* 大屏放在上部三分之一：海报正中是界面的「在新标签页打开」，两者之间留出空隙 */}
      <rect x="168" y="12" width="304" height="108" rx="6" fill="#2F52D9" />
      <rect x="168" y="12" width="304" height="108" rx="6" fill="none" stroke="#5C7BF0" strokeWidth="2" />
      <text x="320" y="62" textAnchor="middle" fontSize="27" fontWeight="700" fill="#FFFFFF">
        2026 产品发布会
      </text>
      <text x="320" y="94" textAnchor="middle" fontSize="15" fill="#CBD6FF">
        新一代交付平台
      </text>
      <rect y="252" width="640" height="14" fill="#2A3550" />
      <rect x="296" y="210" width="48" height="42" rx="3" fill="#3B4868" />
      <circle cx="320" cy="186" r="12" fill="#0E1322" />
      <path d="M304 210c0-12 8-18 16-18s16 6 16 18Z" fill="#0E1322" />
      {heads.map((x, i) => (
        <g key={x} fill="#0A0F1C">
          <circle cx={x} cy={i % 2 ? 314 : 320} r="15" />
          <rect x={x - 21} y={i % 2 ? 326 : 332} width="42" height="40" rx="14" />
        </g>
      ))}
    </svg>
  )
}

function VideosPage() {
  return (
    <>
      <SlideTitle>视频资料</SlideTitle>
      <div className="absolute overflow-hidden rounded-[0.4cqw] bg-(--s-card)" style={boxStyle(VIDEO_WMV)}>
        <PhotoArt />
      </div>
      <div className="absolute overflow-hidden rounded-[0.4cqw] bg-(--s-card)" style={boxStyle(VIDEO_ONLINE)}>
        <StagePoster />
      </div>
      <p className="absolute top-[42.2cqw] left-[7cqw] w-[41cqw] text-[1.6cqw] leading-[1.4] text-(--s-body)">交付中心巡览 · 原片（.wmv，1 分 30 秒）</p>
      <p className="absolute top-[42.2cqw] left-[52cqw] w-[41cqw] text-[1.6cqw] leading-[1.4] text-(--s-body)">2026 产品发布会回放 · 在线视频（video.example.com）</p>
      <SlideFooter page={7} />
    </>
  )
}

export const MEDIA_DECK: DeckSlide[] = deckWith({}, [{ n: 7, name: "视频资料", layout: "仅标题", render: () => <VideosPage /> }])

/**
 * 视频上的界面件（03-13 G-06）：浏览器放不了的编码（wmv / avi）或 DRM——海报帧左上角一枚中性提示签「此格式无法在浏览器中播放」，没有播放按钮，
 * 仍可选中、移动、缩放、删除；在线视频（视频网站页面链接）只显示海报 + 居中「在新标签页打开」（不在页面里嵌入第三方播放器），工具提示写域名。
 * 两者都跟随界面主题（同第 1 批海报帧的播放按钮 PosterPlay），不进缩略图
 */
export function MediaOverlay() {
  return (
    <>
      <CanvasTag box={{ x: VIDEO_WMV.x + 1, y: VIDEO_WMV.y + 1.8 }}>
        <VideoOff {...ICON} className="shrink-0" />
        此格式无法在浏览器中播放
      </CanvasTag>
      <div className="pointer-events-none absolute flex items-center justify-center" style={boxStyle(VIDEO_ONLINE)}>
        <Tip label="在新标签页打开 video.example.com">
          <button
            type="button"
            aria-label="在新标签页打开在线视频（video.example.com）"
            className="pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-(--v3-border) bg-(--v3-panel) px-3 text-[12px] leading-none font-medium text-(--v3-text) shadow-(--v3-shadow) transition-colors hover:bg-(--v3-panel-2)"
          >
            <ExternalLink size={14} strokeWidth={1.5} aria-hidden="true" />
            在新标签页打开
          </button>
        </Tip>
      </div>
    </>
  )
}

/* ================================================================== 第 7 页「门店分布」：外链图片被管理员禁止加载 */

const REGIONS = [
  { name: "华东", n: 46 },
  { name: "华南", n: 31 },
  { name: "华北", n: 27 },
  { name: "西部", n: 24 },
]

function StoresPage() {
  return (
    <>
      <SlideTitle>门店分布</SlideTitle>
      <div className="absolute top-[19cqw] left-[7cqw] w-[32cqw]">
        <p className="text-[1.7cqw] leading-none font-medium text-(--s-body)">门店总数</p>
        <p className="mt-[1.6cqw] flex items-baseline text-[5.4cqw] leading-none font-bold tracking-[-0.01em] tabular-nums">
          128<span className="ml-[0.6cqw] text-[2.6cqw] font-semibold">家</span>
        </p>
        <ul className="mt-[2.6cqw] border-t-[0.12cqw] border-(--s-line)">
          {REGIONS.map((r) => (
            <li key={r.name} className="flex h-[3.6cqw] items-center border-b-[0.12cqw] border-(--s-line) text-[1.8cqw] leading-none">
              <span className="flex-1 font-medium">{r.name}</span>
              <span className="font-semibold tabular-nums">{r.n}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* externalResources = never：外链图片（https://cdn.example.com/…）不加载，原位两行占位「外部内容已被管理员禁止加载」┊ 域名，没有「加载」（03-13 外链资源表） */}
      <DegradedPlaceholder icon={Globe} title="外部内容已被管理员禁止加载" reason="cdn.example.com" className="absolute top-[17cqw] left-[46cqw] h-[31cqw] w-[47cqw]" />
      <SlideFooter page={7} />
    </>
  )
}

export const EXTERNAL_DECK: DeckSlide[] = deckWith({}, [{ n: 7, name: "门店分布", layout: "仅标题", render: () => <StoresPage /> }])

/* ================================================================== 第 7 页「交付流程」：EMF 按需栅格化中 */

/** 转圈图标（只在 motion-safe 下转，DS-53）：给 DegradedPlaceholder 的 icon 用，尺寸与颜色由占位给 */
const SpinningLoader = forwardRef<SVGSVGElement, LucideProps>(function SpinningLoader({ className, ...rest }, ref) {
  return <LoaderCircle ref={ref} {...rest} className={cn(className, "motion-safe:animate-spin")} />
}) as unknown as LucideIcon

const EMF_READY = "import.emf-ready"

/**
 * EMF 栅格化完成没有（场景状态）：演示定格在「正在生成预览…」；用户第一次点按或按键后约 2 秒原位换成图片（同保真提示条的 chipHold：静态截图不受时序影响）
 */
export function useEmfReady() {
  return useSceneState<boolean>(EMF_READY, false)
}

/** 栅格化完成后的流程图（文件里的 EMF：Visio 画的六个阶段） */
function FlowChart() {
  const steps = ["签约", "方案", "实施", "测试", "上线", "验收"]
  return (
    <div className="absolute top-[17cqw] left-[7cqw] flex h-[31cqw] w-[86cqw] items-center justify-between">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className="flex h-[9cqw] w-[11cqw] flex-col items-center justify-center rounded-[0.6cqw] border-[0.14cqw] border-(--s-brand) bg-(--s-brand-soft)">
            <span className="text-[1.3cqw] leading-none text-(--s-body) tabular-nums">{`0${i + 1}`}</span>
            <span className="mt-[0.8cqw] text-[2cqw] leading-none font-semibold">{s}</span>
          </div>
          {i < steps.length - 1 && <span className="mx-[0.6cqw] h-[0.14cqw] w-[2.2cqw] bg-(--s-mute)" />}
        </div>
      ))}
    </div>
  )
}

function FlowPage() {
  const [ready] = useEmfReady()
  return (
    <>
      <SlideTitle>交付流程</SlideTitle>
      {ready ? (
        <FlowChart />
      ) : (
        // 栅格化期间：纸面占位（虚线框 + 转圈 + 一行标题 + 一行说明），取代 03-13 旧写的「骨架（呼吸动效）」；与保真占位同一画法，缩略图同一份
        <DegradedPlaceholder icon={SpinningLoader} title="正在生成预览…" reason="EMF 流程图，完成后自动显示" className="absolute top-[17cqw] left-[7cqw] h-[31cqw] w-[86cqw]" />
      )}
      <SlideFooter page={7} />
    </>
  )
}

export const EMF_DECK: DeckSlide[] = deckWith({}, [{ n: 7, name: "交付流程", layout: "仅标题", render: () => <FlowPage /> }])

/** 常驻在画布叠加层：用户第一次点按或按键后约 2 秒，把 EMF 占位原位换成图片（演示「完成后原位换成图片」，不移动、不弹提示） */
export function EmfRasterizer() {
  const [ready, setReady] = useEmfReady()
  useEffect(() => {
    if (ready) return
    let id = 0
    const start = () => {
      document.removeEventListener("pointerdown", start, true)
      document.removeEventListener("keydown", start, true)
      id = window.setTimeout(() => setReady(true), 2000)
    }
    document.addEventListener("pointerdown", start, true)
    document.addEventListener("keydown", start, true)
    return () => {
      document.removeEventListener("pointerdown", start, true)
      document.removeEventListener("keydown", start, true)
      window.clearTimeout(id)
    }
  }, [ready, setReady])
  return null
}
