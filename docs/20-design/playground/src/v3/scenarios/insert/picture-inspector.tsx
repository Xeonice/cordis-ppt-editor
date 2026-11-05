import { useState, type ReactNode } from "react"
import { Crop, FlipHorizontal2, FlipVertical2, Link2, Minimize2, Replace, RotateCcw, Target, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Button, CheckRow, ColorField, Cols, Field, GeometrySection, ICON, IconButton, inspectorPanel, inspectorSections, NumberField, Section, SliderField, SwatchPicker, Tag, Tip,
  TextArea, ToggleStrip, useSceneState, type Box, type InspectorCtx, type InspectorSectionDef, type SwatchColor,
} from "../../kit"
import { CROP_BOX, CROPPED, PhotoArt } from "./photo"

/**
 * 「picture」（图片，含 SVG 与图标）与「media」（已有视频 / 音频）两种选中种类的检查器分区（03-18；DS-5 ui.inspectorSection）。
 * 由 image-editing 场景注册一次，别的场景（如右键菜单）直接设 selection: "picture" 复用。状态数据（EditorConfig.data.picture）决定细节：
 *   kind  "photo"（缺省）| "icon"：图标多一节「图形填充」，压缩禁用
 *   name / meta：图片名称与格式尺寸     alt：替代文本（缺省为空 → 画布与检查器都给警示）     decorative：标记为装饰性
 * 分区 id 与 order：picture.graphic-fill 5（仅图标）· picture.image 10 · picture.opacity 15 · picture.layout 20 · picture.alt 30；
 * media.video 10，并与图片共用 picture.layout、picture.alt。
 */
export interface PictureData {
  kind?: "photo" | "icon"
  name?: string
  meta?: string
  alt?: string
  decorative?: boolean
  x?: string
  y?: string
  w?: string
  h?: string
}

const pictureOf = (data: Record<string, unknown>): PictureData => (data.picture ?? {}) as PictureData

/** 不可用的文字按钮：文字退到 text-3、不响应悬停，仍可聚焦，工具提示给原因 */
function DisabledButton({ children, reason }: { children: ReactNode; reason: string }) {
  return (
    <Tip label={reason}>
      <button
        type="button"
        aria-disabled="true"
        aria-label={`${typeof children === "string" ? children : ""}（${reason}）`}
        className="inline-flex h-7 min-w-0 items-center justify-center gap-1.5 rounded-[6px] bg-(--v3-panel-2) px-2 text-[12px] leading-none font-medium whitespace-nowrap text-(--v3-text-3)"
      >
        {children}
      </button>
    </Tip>
  )
}

const THEME: SwatchColor[] = [
  { hex: "#FFFFFF", name: "白色" },
  { hex: "#141B2D", name: "深墨" },
  { hex: "#3A5CE6", name: "品牌蓝" },
  { hex: "#7F98F1", name: "品牌蓝 · 浅 30%" },
  { hex: "#AFC0F8", name: "品牌蓝 · 浅 50%" },
  { hex: "#1F2A5C", name: "藏青" },
  { hex: "#4B566B", name: "正文灰" },
  { hex: "#8A93A6", name: "说明灰" },
  { hex: "#5E9684", name: "青绿" },
  { hex: "#E8553A", name: "橙红" },
]
const RECENT: SwatchColor[] = [
  { hex: "#141B2D", name: "深墨" },
  { hex: "#5E9684", name: "青绿" },
  { hex: "#E8553A", name: "橙红" },
]

/** 图形填充（只对单色 SVG 图标）：主题色网格 + 最近使用 + 自定义；改色即时生效，生成新的 SVG 与回退图，一个撤销步 */
function GraphicFillSection({ data }: InspectorCtx) {
  if (pictureOf(data).kind !== "icon") return null
  return (
    <Section title="图形填充">
      <SwatchPicker
        aria="图标颜色"
        defaultValue="#3A5CE6"
        groups={[
          { label: "主题颜色", colors: THEME },
          { label: "最近使用", colors: RECENT },
        ]}
      />
      <ColorField color="#3A5CE6" aria="自定义图标颜色" />
    </Section>
  )
}

/**
 * 图片（面板标题已是「图片」，这一节不再重复标题）：预览 + 名称 + 格式尺寸；替换（保留位置、尺寸与裁剪）、裁剪、重置（撤销全部裁剪与调整）、
 * 压缩（P1；GIF / SVG / EMF 不参与压缩，禁用并给原因）。
 */
function ImageSection({ data }: InspectorCtx) {
  const p = pictureOf(data)
  const icon = p.kind === "icon"
  return (
    <Section>
      <div className="flex items-center gap-3">
        <span className={cn("relative flex h-10 w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-(--v3-border)", icon && "bg-white")}>
          {icon ? <Target size={20} strokeWidth={1.75} aria-hidden="true" className="text-[#3A5CE6]" /> : <PhotoArt />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] leading-4 text-(--v3-text)">{p.name ?? "华东交付中心.jpg"}</p>
          <p className={cn("mt-0.5 leading-4 whitespace-nowrap text-(--v3-text-2) tabular-nums", icon ? "text-[12px]" : "text-[11px]")}>{p.meta ?? "JPEG · 3024 × 2016 · 2.4 MB"}</p>
        </div>
      </div>
      <Cols>
        <Button variant="secondary" className="px-2">
          <Replace {...ICON} aria-hidden="true" />
          替换…
        </Button>
        <Button variant="secondary" className="px-2">
          <Crop {...ICON} aria-hidden="true" />
          裁剪
        </Button>
        <Button variant="secondary" className="px-2">
          <RotateCcw {...ICON} aria-hidden="true" />
          重置
        </Button>
        {icon ? (
          <DisabledButton reason="该格式不支持压缩">
            <Minimize2 {...ICON} aria-hidden="true" />
            压缩
          </DisabledButton>
        ) : (
          <Button variant="secondary" className="px-2">
            <Minimize2 {...ICON} aria-hidden="true" />
            压缩…
          </Button>
        )}
      </Cols>
    </Section>
  )
}

function OpacitySection() {
  return (
    <Section title="不透明度">
      <SliderField aria="不透明度" defaultValue={100} />
    </Section>
  )
}

/** 960 × 540 设计稿里的 pt（取整） */
const ptOf = (b: Box) => ({ x: String(Math.round((b.x / 100) * 960)), y: String(Math.round((b.y / 100) * 540)), w: String(Math.round((b.w / 100) * 960)), h: String(Math.round((b.h / 100) * 540)) })

/** 位置与大小（底座共用的几何分区）：图片缺省锁定比例（缩放手柄与数值输入同一 Mutation，WCAG 2.5.7）；裁剪完成后取裁剪框（与画布角标同一数值）；视频没有翻转。 */
function LayoutSection({ data, selection, readOnly }: InspectorCtx) {
  const [cropped] = useSceneState<boolean>(CROPPED, false)
  const p = cropped ? ptOf(CROP_BOX) : pictureOf(data)
  const media = selection === "media"
  return (
    <GeometrySection
      key={cropped ? "cropped" : "original"}
      anchor="section-picture.geometry"
      readOnly={readOnly}
      value={{ x: p.x ?? "67", y: p.y ?? "154", w: p.w ?? "480", h: p.h ?? "320" }}
      ratioLocked
      flip={!media}
    />
  )
}

/** 替代文本（G-38）：≤ 250 字带计数；「标记为装饰性」与描述互斥（勾选后描述禁用但保留文字）；两者都没有时警示（07 §3） */
function AltSection({ data }: InspectorCtx) {
  const p = pictureOf(data)
  const [decorative, setDecorative] = useState(!!p.decorative)
  const missing = !p.alt && !decorative
  return (
    <Section title="替代文本">
      <TextArea aria="替代文本" defaultValue={p.alt ?? ""} placeholder="描述图片里的内容，供读屏软件朗读" max={250} disabled={decorative} reason={decorative ? "已标记为装饰性，取消勾选后可编辑" : undefined} />
      <CheckRow label="标记为装饰性" checked={decorative} onCheckedChange={setDecorative} />
      {missing && (
        <p className="flex items-start gap-2 text-[12px] leading-[18px] text-(--v3-warning)">
          <span className="flex h-[18px] shrink-0 items-center">
            <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
          </span>
          缺少替代文本，读屏软件无法描述此图
        </p>
      )}
      {decorative && <p className="text-[12px] leading-[18px] text-(--v3-text-2)">导出为空替代文本，读屏软件会跳过这张图片</p>}
    </Section>
  )
}

/**
 * 已有视频（03-18「视频与音频（已有媒体）」）：海报帧 + 换海报（M2 P1）；裁剪 P2 禁用并给原因。
 * 临时播放的入口在画布上（海报中央的播放图标、选中后按 Enter），检查器不再放第二个播放按钮（Q2），只写一行说明。
 */
function VideoSection() {
  return (
    <Section>
      <div className="flex items-center gap-3">
        <span className="relative h-10 w-[60px] shrink-0 overflow-hidden rounded-[4px] border border-(--v3-border)">
          <PhotoArt />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] leading-4 text-(--v3-text)">交付中心巡览.mp4</p>
          <p className="mt-0.5 text-[11px] leading-4 whitespace-nowrap text-(--v3-text-2) tabular-nums">MP4 · 1:30 · 1920 × 1080</p>
        </div>
      </div>
      <Cols>
        <Button variant="secondary" className="px-2">
          <Replace {...ICON} aria-hidden="true" />
          换海报…
        </Button>
        <DisabledButton reason="裁剪视频排在后续版本（P2）">
          <Crop {...ICON} aria-hidden="true" />
          裁剪
          <Tag>P2</Tag>
        </DisabledButton>
      </Cols>
      <p className="text-[12px] leading-[18px] text-(--v3-text-2)">按 ↵ 或点画面上的播放图标临时播放；不写入文档、不广播，导出不受影响</p>
    </Section>
  )
}

/** 裁剪模式里检查器只剩这一节（其余分区临时收起）：上 / 下 / 左 / 右裁剪的数值输入，是拖动手柄的键盘等价路径 */
export const CROP_SECTION: InspectorSectionDef = {
  id: "picture.crop",
  kinds: ["picture"],
  order: 10,
  component: () => (
    <Section title="裁剪">
      <Cols>
        <NumberField label="上" defaultValue="8" unit="%" aria="上裁剪" />
        <NumberField label="下" defaultValue="4" unit="%" aria="下裁剪" />
      </Cols>
      <Cols>
        <NumberField label="左" defaultValue="10" unit="%" aria="左裁剪" />
        <NumberField label="右" defaultValue="6" unit="%" aria="右裁剪" />
      </Cols>
      <p className="text-[12px] leading-[18px] text-(--v3-text-2)">拖动手柄调整范围，拖动图片在框内平移；只记录裁剪范围，不改原图</p>
    </Section>
  ),
}

inspectorPanel({ kind: "picture", title: ({ data }) => (pictureOf(data).kind === "icon" ? "图标" : "图片") })
inspectorPanel({ kind: "media", title: "视频" })
inspectorSections([
  { id: "picture.graphic-fill", kinds: ["picture"], order: 5, component: GraphicFillSection },
  { id: "picture.image", kinds: ["picture"], order: 10, component: ImageSection },
  { id: "picture.opacity", kinds: ["picture"], order: 15, component: OpacitySection },
  { id: "media.video", kinds: ["media"], order: 10, component: VideoSection },
  { id: "picture.layout", kinds: ["picture", "media"], order: 20, component: LayoutSection },
  { id: "picture.alt", kinds: ["picture", "media"], order: 30, component: AltSection },
])
