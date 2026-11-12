import { useEffect, useState } from "react"
import { FileUp } from "lucide-react"
import { useImportDialogState, useOpenImportDialog } from "./importDialog"
import { overlayOpen } from "./layer"

/**
 * 拖入 .pptx 时的落区（开始页与文档列表；第 3 批转正时由 scenarios/documents/DropOverlay.tsx 并入 kit）。
 * 文件拖进主区时，顶栏以下整块换成落区：画布底色上内缩 16 的落区框——强调色 1px 虚线 + 强调色淡底、圆角 8（主区落区是页面级大块，与卡片同为 8；
 * 导入对话框里的落区嵌在框里取 4）——居中 32px FileUp ·「松开以导入」· 一行限制说明。拖入悬停的高亮与导入对话框里的落区同一画法（rulings §4.25 TB-180、DS-141：
 * 强调色只表达「松开就会接住」；2026-10-23 起取代原来中性的 --v3-border-control 虚线）：淡底同为 panel 上叠 --v3-accent-soft，两处同色——
 * 直接叠在画布底上时亮色说明行（text-2 #666）对底只有 4.25:1、不到 AA，叠在 panel 上是 4.58:1（暗色 5.4:1 以上），DS-9。
 * 松开即在原页上打开「导入」对话框的上传态（DS-140、TB-180；kit importDialog，焦点落在对话框底栏的「取消」），不在列表里生成占位卡（UX-14）；拖出窗口或按 Esc 恢复原样。
 * 浏览器在拖动过程中拿不到文件名（只有类型），所以落区不写文件名；拖的不是 .pptx 时照样显示，松开后在对话框里报「不支持的文件格式」（03-13）。
 * 放在 page.overlay：主区（relative）里绝对定位，盖住顶栏以下（top 56），顶栏与左栏不动。样张里状态一出现就是「拖着文件悬在主区上」的样子；
 * 可以真的从桌面拖一个文件进来：拖进窗口时出现、拖出窗口或按 Esc 时收起，松开即打开对话框的上传态；对话框开着时不再出现。
 */
export function DropOverlay() {
  const [shown, setShown] = useState(true)
  const [dialog] = useImportDialogState()
  const openImport = useOpenImportDialog()
  const dialogOpen = dialog.open

  useEffect(() => {
    // 对话框开着时由它自己处理拖放（只有选文件阶段接收，TB-180）
    if (dialogOpen) return
    let depth = 0
    const isFile = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files")
    const onEnter = (e: DragEvent) => {
      if (!isFile(e)) return
      e.preventDefault()
      depth += 1
      if (!overlayOpen()) setShown(true)
    }
    const onOver = (e: DragEvent) => {
      if (!isFile(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"
    }
    const onLeave = (e: DragEvent) => {
      if (!isFile(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setShown(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!isFile(e)) return
      e.preventDefault()
      depth = 0
      setShown(false)
      openImport("uploading")
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !overlayOpen()) setShown(false)
    }
    window.addEventListener("dragenter", onEnter)
    window.addEventListener("dragover", onOver)
    window.addEventListener("dragleave", onLeave)
    window.addEventListener("drop", onDrop)
    document.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("dragenter", onEnter)
      window.removeEventListener("dragover", onOver)
      window.removeEventListener("dragleave", onLeave)
      window.removeEventListener("drop", onDrop)
      document.removeEventListener("keydown", onKey)
    }
  }, [dialogOpen, openImport])

  if (!shown || dialogOpen) return null
  return (
    <div className="absolute inset-x-0 top-14 bottom-0 z-20 bg-(--v3-canvas) p-4">
      <div
        role="status"
        className="flex h-full flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed border-(--v3-accent) bg-(--v3-panel) [background-image:linear-gradient(var(--v3-accent-soft),var(--v3-accent-soft))] text-center"
      >
        <FileUp size={32} strokeWidth={1.5} aria-hidden="true" className="text-(--v3-text-2)" />
        <p className="text-[13px] leading-5 font-semibold text-(--v3-text)">松开以导入</p>
        <p className="text-[12px] leading-4 text-(--v3-text-2)">只支持 .pptx，单个文件最大 200 MB</p>
      </div>
    </div>
  )
}
