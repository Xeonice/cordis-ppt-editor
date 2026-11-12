import { useEffect } from "react"
import { LoaderCircle } from "lucide-react"
import { ICON, InspectorNotice, Toast, Toasts, useEditor, useSceneState, type EditorCtx, type RegionDefaults } from "../../kit"
import { CROP_BOX, CROPPED, PICTURE_BOX, useUploadState } from "./photo"
import { CROP_SECTION } from "./picture-inspector"
import { CropOverlay, PictureSelected, UploadFailed, UploadPlaceholder } from "./picture-overlays"

/**
 * image-editing 场景里浮条与占位框按钮的去向（03-18、03-04）：
 * - 裁剪模式：「取消 Esc」恢复原样，「完成 ↵」应用裁剪（照片按裁剪框显示），两者都退出裁剪模式——工具条回来、检查器换回图片的完整分区；
 *   完成后轻提示带撤销（撤销恢复未裁剪的样子）。
 * - 上传中：不另发轻提示，进度只在原位占位框里（03-18 §4、03-04 §7.5）；「取消上传」去掉占位框。上传失败：「重试」回到上传中，「移除」去掉占位框。
 *   取消与移除各给一句结果轻提示，原位不弹窗。
 * 状态放场景共享状态（换状态即复位），初值取状态的 data：crop（是否在裁剪模式）、upload（uploading / failed）。
 */

const CROP = "image-editing.crop"
const TOAST = "image-editing.toast"

interface PicToast {
  key: number
  text: string
  undo?: () => void
}

function useCrop() {
  const { data } = useEditor()
  return useSceneState<boolean>(CROP, () => !!data.crop)
}

const useUpload = useUploadState

/* ------------------------------------------------------------------ 裁剪 */

/** 裁剪模式时工具条临时收起（regions.toolbar；画布照样给它留位置，进出时不跳动） */
export function CropToolbar({ d }: { d: RegionDefaults }) {
  const [cropping] = useCrop()
  return cropping ? null : <>{d.toolbar()}</>
}

/** 裁剪模式时检查器只留裁剪数值（regions.inspector）；退出后换回图片的完整分区 */
export function CropInspector({ d }: { d: RegionDefaults }) {
  const [cropping] = useCrop()
  return <>{cropping ? d.inspector({ title: "裁剪图片", sections: [CROP_SECTION], notice: <InspectorNotice>正在裁剪 · 其余属性暂不可改</InspectorNotice> }) : d.inspector()}</>
}

/** 画布：裁剪模式画遮罩、裁剪框与浮条；退出后画选中框（裁剪过的按裁剪框） */
export function CropStage({ ctx }: { ctx: EditorCtx }) {
  const [cropping, setCropping] = useCrop()
  const [cropped, setCropped] = useSceneState<boolean>(CROPPED, false)
  const [, setToast] = useSceneState<PicToast | null>(TOAST, null)
  const cancel = () => setCropping(false)
  const done = () => {
    setCropping(false)
    setCropped(true)
    setToast({ key: Date.now(), text: "已裁剪图片", undo: () => setCropped(false) })
  }
  // Esc 取消、Enter 完成（焦点在检查器的裁剪数值框、或别的浮层里时不接）
  useEffect(() => {
    if (!cropping) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || (e.key !== "Escape" && e.key !== "Enter")) return
      const a = document.activeElement
      if (a?.closest("input, textarea, [data-radix-popper-content-wrapper], [role=dialog][data-state=open]")) return
      if (e.key === "Enter" && a?.closest("button, [role=button]")) return
      e.preventDefault()
      if (e.key === "Escape") cancel()
      else done()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  })
  if (ctx.slide !== 5) return null
  if (cropping) return <CropOverlay picture={PICTURE_BOX} crop={CROP_BOX} onCancel={cancel} onDone={done} />
  if (ctx.selection !== "picture") return null
  const box = cropped ? CROP_BOX : PICTURE_BOX
  return <PictureSelected box={box} label={cropped ? `${Math.round((box.w / 100) * 960)} × ${Math.round((box.h / 100) * 540)}` : "480 × 320"} />
}

/* ------------------------------------------------------------------ 上传占位框 */

/** 画布：上传中 / 失败的占位框（按钮可用）；取消或移除后不再画 */
export function UploadStage({ ctx }: { ctx: EditorCtx }) {
  const [state, setState] = useUpload()
  const [, setToast] = useSceneState<PicToast | null>(TOAST, null)
  if (ctx.slide !== 5 || !state || state === "gone") return null
  if (state === "uploading")
    return (
      <UploadPlaceholder
        box={PICTURE_BOX}
        onCancel={() => {
          setState("gone")
          setToast({ key: Date.now(), text: "已取消上传，未插入图片" })
        }}
      />
    )
  return (
    <UploadFailed
      box={PICTURE_BOX}
      onRetry={() => setState("uploading")}
      onRemove={() => {
        setState("gone")
        setToast({ key: Date.now(), text: "已移除上传失败的图片" })
      }}
    />
  )
}

/* ------------------------------------------------------------------ 轻提示 */

/**
 * 画布轻提示（canvasOverlay）：上传中不另发轻提示（进度只在画布占位框里，同一信息不在同屏出现两次），只先挂好轻提示容器，
 * 裁剪完成、取消上传、移除占位框后给一句结果（每条轻提示自己是播报区、出现后两帧才把内容放进无障碍树，kit Toast；第 2 批第 6 轮集成起容器不再是 aria-live）。
 */
export function PictureToasts() {
  const [state] = useUpload()
  const [t, setT] = useSceneState<PicToast | null>(TOAST, null)
  if (!t && state !== "uploading") return null
  return (
    <Toasts>
      {/* 上传中的进度只在画布占位里（同一信息不在同屏出现两次） */}
      {t && (
        <Toast
          key={t.key}
          action={t.undo ? "撤销" : undefined}
          onAction={() => {
            t.undo?.()
            setT(null)
          }}
          onClose={() => setT(null)}
        >
          {t.text}
        </Toast>
      )}
    </Toasts>
  )
}
