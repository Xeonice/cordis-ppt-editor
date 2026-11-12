import { useCallback, type ComponentType } from "react"
import { flushSync } from "react-dom"
import { usePageMaybe } from "../page/context"
import { useSceneState } from "./scene"

/**
 * 「导入」对话框的底座接口（rulings §4.25 DS-140、TB-179…TB-181，2026-10-23）：导入全程在叠在原页上的对话框里（选文件、拖入、上传、服务端解析与失败都在框里原位换）。
 * 对话框本身在导入场景里（scenarios/import/dialog.tsx 的 ImportDialog：正文、文案与示例数据都是导入场景的），由它在模块加载时登记给底座（registerImportDialog，
 * 同 registerDocShareLayer、registerCommentsBody 的做法），底座这里不依赖场景代码；页面宿主（PageHost.tsx）在应用壳四个宿主（home、documents、templates、admin/plugins）里
 * 渲染 ImportDialogLayer。底座的入口只经这里打开它：
 * - 顶栏「导入 .pptx」（kit ShellDefaultActions，锚点 IMPORT_ENTRY、aria-haspopup=dialog）：从选文件开始，关闭后焦点回到这颗按钮；
 * - 开始页、文档列表主区的拖入落区（kit DropOverlay）：松开即打开上传态（TB-180），焦点落在「取消」。
 * 开关与阶段放在场景仓 IMPORT_DIALOG_KEY（换状态即复位）；状态一出现就开着的写 page.data.importDialog（至少给 phase，其余字段由对话框自己读，见 ImportDialogSeed）。
 */

/** 对话框的阶段：选文件 · 拖入悬停 · 上传中 · 服务端解析 · 失败 */
export type ImportDialogPhase = "pick" | "dragover" | "uploading" | "parsing" | "failed"

/** 开关与阶段（场景仓 IMPORT_DIALOG_KEY 的底座部分）；登记的对话框在同一份里加自己的字段（失败原因、进度、「已复制」…） */
export interface ImportDialogState {
  open: boolean
  phase: ImportDialogPhase
}

/** 场景仓键：顶栏按钮、拖入落区与对话框读写同一份 */
export const IMPORT_DIALOG_KEY = "import.dialog"

/** 顶栏「导入 .pptx」的锚点：对话框关闭后焦点回到这里（状态里一出现就开着、没有触发处时也回到它） */
export const IMPORT_ENTRY = "import.entry"

/**
 * 读写开关与阶段。初值按状态数据 page.data.importDialog：写了就一出现即开着（阶段取 seed.phase，缺省选文件），没写就关着；
 * 谁先挂上谁初始化，各处都用这一个函数，取同一个初值
 */
export function useImportDialogState<T extends ImportDialogState = ImportDialogState>(): [T, (patch: Partial<T>) => void] {
  const page = usePageMaybe()
  const seed = page?.data.importDialog as { phase?: ImportDialogPhase } | undefined
  const [ui, setUi] = useSceneState<T>(IMPORT_DIALOG_KEY, () => ({ open: !!seed, phase: seed?.phase ?? "pick" }) as T)
  const set = useCallback((patch: Partial<T>) => setUi((u) => ({ ...u, ...patch })), [setUi])
  return [ui, set]
}

/**
 * 打开导入对话框：pick 从选文件开始（顶栏「导入 .pptx」）；uploading 直接到上传中（主区拖入落区松开，TB-180）。
 * 打开时的初始焦点由 kit Dialog 给（用户打开：正文第一个控件——选文件阶段是「从电脑选择文件…」，上传阶段正文没有控件、落在底栏的「取消」）；
 * 拖放不算「操作过」（不经 pointerdown / keydown），所以 uploading 另在提交后把焦点交给底栏第一颗按钮
 */
export function useOpenImportDialog(): (phase?: "pick" | "uploading") => void {
  const [, set] = useImportDialogState()
  return useCallback(
    (phase = "pick") => {
      flushSync(() => set({ open: true, phase }))
      if (phase === "uploading") document.querySelector<HTMLElement>('[data-v3-dialog] [data-v3-dialog-footer] button')?.focus({ preventScroll: true })
    },
    [set],
  )
}

let IMPORT_DIALOG: ComponentType | null = null

/** 导入场景登记对话框（模块加载时调一次；没有登记时顶栏按钮与拖入落区只改场景仓、什么也不弹） */
export function registerImportDialog(c: ComponentType) {
  IMPORT_DIALOG = c
}

/** 页面宿主渲染的一层（应用壳四个宿主都挂）：登记的对话框自己按开关渲染，关着时不出 DOM */
export function ImportDialogLayer() {
  const C = IMPORT_DIALOG
  return C ? <C /> : null
}
