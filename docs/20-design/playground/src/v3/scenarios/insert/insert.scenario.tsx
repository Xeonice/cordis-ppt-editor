import { DEFAULT_DECK, Dialog, MainMenuLayer, Menu, Popover, slideOf, TextField, registerToolLayer, MORE_ALIAS_OUTSIDE_TEXT, useWiredMenu, type MenuSpec } from "../../kit"
import { placeholderOrigin } from "../text-edit/inspector"
import { defineScenario } from "../types"
import { InsertToasts, useInsertToast } from "./feedback"
import { HeaderFooterDialog } from "./HeaderFooter"
import { IconPickerDialog } from "./IconPicker"
import { IMAGE_MENU, moreMenu } from "./menus"
import { SymbolPanel } from "./SymbolPanel"

/** 来自 URL…：下载后内嵌，不保留外链（03-04「图片按钮下拉菜单」）；只接受 https 地址（50/14 §5，rulings §4.25 TB-7），单张上限 25 MB（03-18「插入路径」） */
function ImageUrlDialog() {
  const toast = useInsertToast()
  return (
    <Dialog
      title="从 URL 插入图片"
      size="md"
      returnFocus="tool-image"
      description="图片会下载并内嵌到文稿里，不保留外部链接。"
      secondary={{ label: "取消" }}
      // 插入后画布原位出上传占位框（见 image-editing 场景「上传中」）；这里只给一句结果
      primary={{ label: "插入", onClick: () => toast("正在下载图片，完成后内嵌到文稿", { tone: "neutral" }) }}
    >
      <div className="flex flex-col gap-2">
        <TextField aria="图片地址" defaultValue="https://cdn.example.com/2026q2/east-center.jpg" />
        <p className="text-[12px] leading-[18px] text-(--v3-text-2)">支持 https 地址的 JPG、PNG、GIF、SVG，单张不超过 25 MB。</p>
      </div>
    </Dialog>
  )
}

/*
 * 真实工具条（任何状态）里「更多」「图片 ▾」的条目打开的面板：登记给底座（editor/insert-menus.tsx），与本场景的静态状态是同一批组件。
 * 对话框每次打开重新挂载、关闭后焦点回到「更多」/「图片」；符号面板是锚在「更多」上的非模态弹层。
 */
registerToolLayer("more:header-footer", () => <HeaderFooterDialog />)
registerToolLayer("more:icon", () => <IconPickerDialog picked={[]} />)
registerToolLayer("image:url", () => <ImageUrlDialog />)
registerToolLayer("more:symbol", ({ open, onOpenChange }) => (
  <Popover anchor="tool-more" label="符号" open={open} onOpenChange={onOpenChange} className="w-[468px] p-3">
    <SymbolPanel />
  </Popover>
))

/** 编辑第 1 页标题时（「更多」的文本组、符号面板）选中的是版式「标题幻灯片」的标题占位符：检查器顶行「转到版式」的输入（rulings §4.25 DS-174），版式名、类型与索引由 placeholderOrigin 按版式算 */
const PH_COVER_TITLE = { placeholder: placeholderOrigin(slideOf(DEFAULT_DECK, 1), "title") }

/** 静态打开的插入菜单：条目与真实工具条同一份、接上同一批面板（选「页眉和页脚…」「图标…」「来自 URL…」真的打开对话框） */
function StaticInsertMenu({ anchor, label, items, prefix, alias }: { anchor: string; label: string; items: MenuSpec[]; prefix: string; alias?: Record<string, string> }) {
  const [wired, layer] = useWiredMenu(items, prefix, alias)
  return (
    <>
      <Menu anchor={anchor} label={label} items={wired} />
      {layer}
    </>
  )
}

/**
 * 03-04 插入菜单：ribbon「插入」页签按 DS-1 拆开后的入口——创建类在底部工具条（文本 / 形状 / 图片 / 表格 / 图表 / 评论）与「更多」，
 * 主菜单「插入」列全部插入命令（第二入口）。本场景覆盖「更多」两种上下文、图片 ▾、主菜单，以及从它们打开的
 * 页眉和页脚、图标、符号、来自 URL 四个面板（规格在 03-15、03-18）。
 * 形状库与插入工具态见 shape-library 场景，表格网格与图表类型菜单归 table / chart 场景（03-30 §2、03-31）。
 */
export default defineScenario({
  id: "insert",
  title: "插入菜单",
  specs: ["03-04", "03-15"],
  summary: "工具条「更多」、图片 ▾、主菜单「插入」与页眉页脚、图标、符号面板",
  // 对话框「应用」「插入」之后的轻提示（feedback.tsx）；编辑模式照常显示评论钉（rulings §4.25 DS-43：底座 stage.commentPins，第 4 页 3 枚）
  editor: { stage: { cursor: false, commentPins: true }, canvasOverlay: <InsertToasts /> },
  states: [
    {
      id: "more",
      title: "更多 · 未在编辑文字",
      note: "03-04 七组拆分后进「更多」的条目：日期和时间 / 幻灯片编号改走页眉和页脚；符号、公式（M4+）、视频音频（P2）禁用而不隐藏，右侧写原因；插件项带归属标识",
      editor: { layers: <StaticInsertMenu anchor="tool-more" label="更多插入" items={moreMenu(false)} prefix="more" alias={MORE_ALIAS_OUTSIDE_TEXT} /> },
    },
    {
      id: "more-editing",
      title: "更多 · 光标在文本里",
      note: "03-04「文本组随文本编辑态切换」：符号可用；日期和时间打开格式选择器（03-16）；幻灯片编号直接在光标处插入页码字段",
      editor: { slide: 1, selection: "text", data: PH_COVER_TITLE, layers: <StaticInsertMenu anchor="tool-more" label="更多插入" items={moreMenu(true)} prefix="more" /> },
    },
    {
      id: "image-menu",
      title: "图片 ▾",
      note: "03-04「图片按钮下拉菜单」：此设备… / 来自 URL…（下载后内嵌）/ 屏幕截图、相册 M4+ 禁用而不隐藏；底部说明拖入、粘贴两条路径",
      editor: { toolbar: { tool: "image" }, layers: <StaticInsertMenu anchor="tool-image" label="插入图片" items={IMAGE_MENU} prefix="image" /> },
    },
    {
      id: "image-url",
      title: "来自 URL",
      note: "03-04 / 03-18：图片下载后内嵌，不保留外链；协议与大小限制写在输入框下方",
      editor: { toolbar: { tool: "image" }, layers: <ImageUrlDialog /> },
    },
    {
      id: "main-menu",
      title: "主菜单 · 插入",
      note: "02-editor-main §2.3 / 03-04 §6 主菜单「插入」子项（2026-10-07 第 1 批拍板）：全部插入命令按工具条顺序，是不常驻的第二入口（Q2 不算重复）",
      editor: { layers: <MainMenuLayer openPath={["insert"]} /> },
    },
    {
      id: "header-footer",
      title: "页眉和页脚",
      note: "03-15 G-81：左栏表单、右栏当前页真实预览（三个页脚占位符启用为强调色实线）；底栏写清「应用」与「全部应用」的范围。遮罩后的画布照常画第 4 页的 3 枚评论钉（编辑模式照常显示评论钉）（2026-10-15 按 rulings §4.25 DS-43 改）",
      editor: { slide: 4, layers: <HeaderFooterDialog /> },
    },
    {
      id: "header-footer-missing",
      title: "页眉和页脚 · 版式缺占位符",
      note: "03-15「缺占位符」：版式里没有幻灯片编号占位符时该项禁用并说明「当前版式没有此占位符」，预览里不画编号位。遮罩后的画布照常画第 4 页的 3 枚评论钉（2026-10-15 按 rulings §4.25 DS-43 改）",
      editor: { slide: 4, layers: <HeaderFooterDialog numberMissing /> },
    },
    {
      id: "icons",
      title: "插入图标 · 已选 3 个",
      note: "03-15 G-82：分类栏 + 8 列网格，多选的对勾点；底栏写出插入结果与「插入 3 个」",
      editor: { slide: 6, layers: <IconPickerDialog /> },
    },
    {
      id: "icons-empty",
      title: "插入图标 · 无结果",
      note: "03-15 边界情况：搜索无结果时网格区居中空态，分类栏保持可点，清空检索即恢复；未选时「插入」禁用",
      editor: { slide: 6, layers: <IconPickerDialog query="无人机" picked={[]} /> },
    },
    {
      id: "symbols",
      title: "符号面板 · 编辑文本",
      note: "03-15 G-83：非模态弹层锚在「更多」上方，不抢文本光标；区块栏 + 8 列字符网格 + 预览底栏，插入后面板保持打开",
      editor: {
        slide: 1,
        selection: "text",
        data: PH_COVER_TITLE,
        layers: (
          <Popover anchor="tool-more" label="符号" className="w-[468px] p-3">
            <SymbolPanel />
          </Popover>
        ),
      },
    },
  ],
})
