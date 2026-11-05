import { SelectionBox, Toast, Toasts } from "../../kit"
import { defineScenario } from "../types"
import { TransformBox } from "./insert-tool"
import { PICTURE_BOX, photoDeck } from "./photo"
import { CropInspector, CropStage, CropToolbar, PictureToasts, UploadStage } from "./picture-flow"
import { type PictureData } from "./picture-inspector"
import { NativeVideoControls, PictureSelected, PosterPlay } from "./picture-overlays"

const ALT = "华东交付中心外景：玻璃幕墙办公楼与两侧裙楼，前方是铺装广场和行道树"

/** 第 6 页「下半年计划」第一栏的「目标」图标（3.2cqw 见方）：960 × 540 下约 83, 244, 31 × 31 */
const ICON_BOX = { x: 8.6, y: 45.24, w: 3.2, h: 5.69 }

const pic = (p: PictureData) => ({ picture: p })

/**
 * 03-18 图片操作：选中图片时的检查器分区（图片 / 不透明度 / 位置与大小 / 替代文本）、缺替代文本警示、裁剪模式、
 * 上传中与上传失败的原位占位框、大图压缩提示、图标（单色 SVG）改色，以及已有视频的编辑态临时播放。
 * 第 5 页换成「华东交付中心」图文页（照片为内联 SVG 绘制，真实渲染）。
 */
export default defineScenario({
  id: "image-editing",
  title: "图片操作",
  specs: ["03-18"],
  summary: "图片检查器、替代文本、裁剪模式、上传占位、压缩提示与图标改色",
  editor: { deck: photoDeck(), slide: 5, stage: { cursor: false } },
  states: [
    {
      id: "selected",
      title: "选中图片 · 缺替代文本",
      note: "03-18「选中态属性面板」：图片（替换 / 裁剪 / 重置 / 压缩）、不透明度、位置与大小（锁比例）、替代文本；未填替代文本时画布角标与检查器同时警示",
      editor: {
        selection: "picture",
        data: pic({}),
        slideOverlay: <PictureSelected box={PICTURE_BOX} label="480 × 320" missingAlt />,
      },
    },
    {
      id: "alt-text",
      title: "替代文本已填写",
      note: "03-18 G-38：描述 ≤ 250 字带计数，填写后画布角标与警示消失",
      editor: {
        selection: "picture",
        data: pic({ alt: ALT }),
        slideOverlay: <PictureSelected box={PICTURE_BOX} label="480 × 320" />,
      },
    },
    {
      id: "decorative",
      title: "标记为装饰性",
      note: "03-18「交互说明」：装饰性与描述互斥——勾选后描述框禁用但保留原文，导出为空替代文本，不再警示",
      editor: {
        selection: "picture",
        data: pic({ alt: ALT, decorative: true }),
        slideOverlay: <PictureSelected box={PICTURE_BOX} label="480 × 320" />,
      },
    },
    {
      id: "crop",
      title: "裁剪模式",
      note: "03-18「裁剪模式」：框外 60% 遮罩、8 个裁剪手柄与三分线，框下浮条「取消 Esc / 完成 ↵」；检查器只留裁剪数值（键盘等价），创建工具条临时收起。取消 / 完成都退出裁剪模式（完成后照片按裁剪框显示，轻提示带撤销）",
      editor: {
        selection: "picture",
        data: { ...pic({ alt: ALT }), crop: true },
        // 裁剪模式进出由 picture-flow.tsx 管：工具条与检查器随之收起 / 恢复
        regions: { toolbar: (_ctx, d) => <CropToolbar d={d} />, inspector: (_ctx, d) => <CropInspector d={d} /> },
        slideOverlay: (ctx) => <CropStage ctx={ctx} />,
        canvasOverlay: <PictureToasts />,
      },
    },
    {
      id: "uploading",
      title: "上传中",
      note: "03-04「加载中」/ 03-18「上传中」：画布原位占位框（纸面亮色）+ 确定态进度 + 取消；上传中不另发轻提示，进度只在占位框里",
      editor: {
        deck: photoDeck("frame"),
        data: { upload: "uploading" },
        slideOverlay: (ctx) => <UploadStage ctx={ctx} />,
        canvasOverlay: <PictureToasts />,
      },
    },
    {
      id: "upload-failed",
      title: "上传失败",
      note: "03-04「错误」：占位框原位变为错误态「图片上传失败 · 文件过大或格式不支持」+ 重试 / 移除，不移动、不弹窗",
      editor: { deck: photoDeck("frame"), data: { upload: "failed" }, slideOverlay: (ctx) => <UploadStage ctx={ctx} />, canvasOverlay: <PictureToasts /> },
    },
    {
      id: "compress",
      title: "大图压缩提示",
      note: "03-18「大图压缩提示」：插入 > 4096 px 的位图后单独一步提示，不阻塞；「压缩」只作用于这张，「保留原图」或超时都不改字节",
      editor: {
        selection: "picture",
        data: pic({ name: "交付中心外景-原图.jpg", meta: "JPEG · 6000 × 4000 · 9.8 MB" }),
        slideOverlay: <PictureSelected box={PICTURE_BOX} label="480 × 320" missingAlt />,
        canvasOverlay: (
          <Toasts>
            <Toast actions={[{ label: "压缩" }, { label: "保留原图" }]}>图片较大，是否压缩到 2048 px？</Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "icon",
      title: "图标改色",
      note: "03-18「SVG 与图标」：单色图标多一节「图形填充」（主题色 + 最近使用 + 自定义），改色即时生效；SVG 不参与压缩（按钮禁用给原因）；替代文本预填图标名",
      editor: {
        deck: undefined,
        slide: 6,
        selection: "picture",
        data: pic({ kind: "icon", name: "图标 1", meta: "SVG · 单色", alt: "目标", x: "83", y: "244", w: "31", h: "31" }),
        slideOverlay: <SelectionBox box={ICON_BOX} label="31 × 31" />,
      },
    },
    {
      id: "video-poster",
      title: "已有视频 · 海报帧",
      note: "03-18「编辑态临时播放」：未选中时显示海报帧 + 居中播放图标；插入视频仍为 P2，文稿里已有的照常查看、移动和缩放",
      editor: { slideOverlay: <PosterPlay box={PICTURE_BOX} /> },
    },
    {
      id: "video",
      title: "已有视频 · 临时播放",
      note: "03-18「编辑态临时播放」：选中后按 Enter 或点播放，在元素上叠原生控件；不写入文档、不广播、不进撤销栈；裁剪为 P2",
      editor: {
        selection: "media",
        data: pic({ alt: "交付中心巡览视频，约 1 分 30 秒" }),
        slideOverlay: (
          <>
            <NativeVideoControls box={PICTURE_BOX} />
            <TransformBox box={PICTURE_BOX} label="480 × 320" />
          </>
        ),
      },
    },
  ],
})
