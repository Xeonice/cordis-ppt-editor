import { BoxSelect, ClipboardPaste, ClipboardType, Grid3x3, LayoutTemplate, MessageSquarePlus, RotateCcw } from "lucide-react"
import { Avatar, ContextMenu, deckWith, ICON, TEXT_NEW_BOX, Toast, Toasts, useEditor, WANG, type MenuSpec, ME } from "../../kit"
import { defineScenario, type EditorConfig } from "../types"
import { SAVE_STATUS } from "./chrome"
import { useDisplay } from "./display"
import { gridGuidesMenu, MainMenuLayer, PASTE_VARIANTS } from "./MainMenu"
import { DataNotesSlide } from "./slides"

/**
 * 03-19 撤销重做、剪贴板反馈、保存态（v3）。
 * - 撤销 / 重做：不再有应用栏按钮（DS-1、DS-6），入口是主菜单「编辑」（带步骤名）、⌘Z / ⇧⌘Z / ⌘Y 与命令面板；协同下被跳过时走轻提示。
 * - 剪贴板反馈：一律轻提示（Toasts，底部工具条上方）；粘贴变体（P2）在右键「粘贴选项 ▸」与主菜单「编辑」。
 * - 保存态：文件名下方的状态行（左栏），只用于 SDK 嵌入的回调式保存；参考应用是协同模式，这一行显示同步状态（05 §7，第 2 批）。
 */

/* ------------------------------------------------------------------ 右键：画布空白处（粘贴选项展开） */

function BlankCanvasMenu() {
  const [d, setD] = useDisplay()
  const { setTool } = useEditor()
  // 条目与 context-menu 组的「画布空白处」菜单对齐（粘贴 · 全选 · 网格与参考线 · 更换版式 · 重置页 ┊ 添加评论），只在「粘贴」后插入「粘贴选项」；
  // 「添加评论 C」单独一组排在「重置页…」之后（rulings §4.25 DS-44），与按 C 相同：选了即进入评论工具
  const items: MenuSpec[] = [
    { id: "paste", label: "粘贴", icon: <ClipboardPaste {...ICON} />, kbd: "⌘V" },
    { type: "sub", id: "paste-special", label: "粘贴选项", icon: <ClipboardType {...ICON} />, tag: "P2", items: PASTE_VARIANTS },
    { id: "select-all", label: "全选", icon: <BoxSelect {...ICON} />, kbd: "⌘A" },
    { type: "separator" },
    gridGuidesMenu(d, setD, <Grid3x3 {...ICON} />),
    { id: "layout", label: "更换版式…", icon: <LayoutTemplate {...ICON} /> },
    { id: "reset", label: "重置页…", icon: <RotateCcw {...ICON} /> },
    { type: "separator" },
    { id: "comment", label: "添加评论", icon: <MessageSquarePlus {...ICON} />, kbd: "C", onSelect: () => setTool("comment") },
  ]
  return <ContextMenu at={{ anchor: "slide", x: 0.36, y: 0.885 }} openPath={["paste-special"]} label="画布" items={items} />
}

/* ------------------------------------------------------------------ 检查器：刚粘贴出来的文本框 */
// 内置「文本」分区读 data.text：新建文本框的缺省样式（正文字体 18 pt 常规，内置缺省是第 1 页标题的 40 pt 粗体）

/** 第 6 页换成「数据口径」：刚从网页粘贴的一段说明（HTML 已转纯文本，新建文本框并进入编辑态）。 */
const PASTE_DECK = deckWith({ 6: { name: "数据口径", layout: "仅标题", render: (o) => <DataNotesSlide {...o} /> } })

/** 单人编辑：没有协作者，头像组只剩自己（账户菜单入口一直在，DS-18），也没有远端光标。 */
const SOLO: EditorConfig = {
  stage: { cursor: false },
  inspector: { collaborators: { people: [ME] } },
}

export default defineScenario({
  id: "undo-clipboard",
  title: "撤销重做、剪贴板与保存态",
  specs: ["03-19"],
  summary: "主菜单「编辑」带步骤名的撤销 / 重做、协同撤销被跳过、粘贴选项与剪贴板提示、文件名下方的保存状态",
  editor: { stage: { cursor: false } },
  states: [
    {
      id: "edit-menu",
      title: "主菜单 · 编辑",
      note: "撤销项带步骤名「撤销：移动形状 ⌘Z」，无可重做时置灰并写原因；剪贴板 · 全选 · 查找 ⌘F / 替换 ⇧⌘H · 重置页（与右键同名）；「粘贴选项」M2 禁用标 P2",
      editor: {
        selection: "shape",
        layers: <MainMenuLayer openPath={["edit"]} edit={{ undo: "移动形状" }} />,
      },
    },
    {
      id: "undo-partial",
      title: "协同撤销 · 部分跳过",
      note: "撤销「修改要点卡」：填充照常回退，文字已被王小明后改、跳过该键；轻提示「王小明之后修改了此处，已跳过」中性、左侧是对方头像，可关闭、不打断输入（与 main-states 同款）；撤销后选中受影响的对象",
      editor: {
        selection: "shape",
        stage: { cursor: { at: "left-[86%] top-[44.5%]", name: "王小明" } },
        canvasOverlay: (
          <Toasts>
            <Toast icon={<Avatar name={WANG.name} tone={WANG.tone} size={20} />} onClose={() => undefined}>
              <b className="font-semibold">王小明</b>之后修改了此处，已跳过
            </Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "undo-blocked",
      title: "协同撤销 · 整步被跳过",
      note: "目标已被他人删除（不看墓碑 TTL）：「无法撤销：此处已被王小明删除」警告色，这次 ⌘Z 到此为止、不连带撤销更早一步（与 main-states 同款）；同一位置还有「…已被 X 修改」「无法撤销：该内容已被彻底删除」两种文案",
      editor: {
        slide: 6,
        canvasOverlay: (
          <Toasts>
            <Toast tone="warning" onClose={() => undefined}>
              无法撤销：此处已被<b className="font-semibold">王小明</b>删除
            </Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "paste-options",
      title: "右键 · 粘贴选项（P2 预览）",
      note: "画布空白处右键：粘贴 ⌘V · 粘贴选项 ▸（保留源格式 / 仅文本 ⇧⌘V / 作为图片，P2）· 全选 · 网格与参考线 ▸ · 更换版式… · 重置页… ┊ 添加评论 C（与按 C 相同：选了即进入评论工具）。M2 时「粘贴选项」整项禁用并标 P2（同主菜单「编辑」）（2026-10-15 按 rulings §4.25 DS-44 改：「重置页…」之后加一组「添加评论 C」）",
      editor: { layers: <BlankCanvasMenu /> },
    },
    {
      id: "paste-html",
      title: "粘贴网页内容 · 格式已简化",
      note: "从网页粘贴：HTML 转纯文本（基本格式 P2），新建文本框并进入编辑态，轻提示「部分格式已被简化」；粘贴纯文本时同样新建文本框，但不出提示",
      editor: {
        deck: PASTE_DECK,
        slide: 6,
        selection: "text",
        data: { text: TEXT_NEW_BOX },
        canvasOverlay: (
          <Toasts>
            <Toast tone="info">部分格式已被简化</Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "paste-too-large",
      title: "粘贴超过 25 MB",
      note: "拒绝粘贴并说明上限（ED-17）：错误色图标，可关闭；画布不变",
      editor: {
        slide: 3,
        canvasOverlay: (
          <Toasts>
            <Toast tone="error" onClose={() => undefined}>
              无法粘贴：内容超过 25 MB 上限
            </Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "clipboard-denied",
      title: "剪贴板未授权",
      note: "复制要点卡（⌘C）时浏览器拒绝剪贴板权限：退回编辑器内部剪贴板，本标签页内复制粘贴照常可用（不跨标签页）；警告色图标",
      editor: {
        selection: "shape",
        canvasOverlay: (
          <Toasts>
            <Toast tone="warning" onClose={() => undefined}>
              浏览器未授权访问剪贴板，已使用编辑器内部剪贴板
            </Toast>
          </Toasts>
        ),
      },
    },
    {
      id: "saved",
      title: "保存态 · 已保存",
      note: "SDK 嵌入的回调式保存（单人，无头像组）：文件名下方「✓ 已保存」，中性色；⌘S 完成时短暂显示「已保存 · 刚刚」",
      editor: { ...SOLO, rail: { status: SAVE_STATUS.saved } },
    },
    {
      id: "saving",
      title: "保存态 · 保存中",
      note: "自动保存或 ⌘S：「保存中…」+ 小转圈，中性色；保存期间继续编辑不阻塞，新编辑归入下一次保存",
      editor: { ...SOLO, rail: { status: SAVE_STATUS.saving } },
    },
    {
      id: "unsaved",
      title: "保存态 · 未保存",
      note: "有未持久化的更改、自动保存倒计时中：没有强调文案，「已保存」消失（行高保留，不跳动；读屏读到「有未保存的更改」）；此时关闭标签页触发浏览器原生离开提示",
      editor: { ...SOLO, rail: { status: SAVE_STATUS.unsaved } },
    },
    {
      id: "save-failed",
      title: "保存态 · 保存失败",
      note: "「⚠ 保存失败 · 重试」：危险色只在这一状态出现；本地保留脏状态，之后的编辑并入下一次重试，只保留一条最新的失败提示、不堆叠",
      editor: { ...SOLO, rail: { status: SAVE_STATUS.failed } },
    },
    {
      id: "saved-local",
      title: "保存态 · 已在本地保存",
      note: "集成方保存回调暂时不可达（如回调抛错）：「已在本地保存」警告色；不等同于协同的离线态",
      editor: { ...SOLO, rail: { status: SAVE_STATUS.local } },
    },
  ],
})
