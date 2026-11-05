import { SHARE_LATER } from "../../kit"
import { defineScenario, type EditorConfig } from "../types"
import type { PaletteData } from "../command-palette/CommandPalette"
import "./master-impl"
import "./master-sections"
import { DeleteLayoutDialog, DeleteLayoutsDialog, DeleteMasterDialog, EntryMenu, ExportUnusedDialog } from "./MasterChrome"
import { LayoutContextMenu, MasterContextMenu } from "./MasterRail"
import { KIND, type MvData } from "./mv-state"
import type { ThemeData } from "./ThemeParts"
import {
  boxStyle, deckWith, HitArea, layoutOfSlide, MainMenuLayer, PaperScope, PlaceholderIconBar, placeholdersFor, PT_PER_CQW, ptOf, px, SelectionBox, SLIDE_BODY_PROMPT_META, useEditor, type EditorCtx,
} from "../../kit"
import { ShortcutsHost, type ShortcutsData } from "../shortcuts/ShortcutsPanel"
import { newSlide } from "../slides-selection/slides"
import type { PlaceholderData } from "../text-edit/inspector"
import { MasterHintDemo } from "./MasterChrome"
import { typeNameOf } from "./mv-state"

/**
 * 03-26 母版视图与母版 / 版式编辑（v3）。
 * 同一个编辑器，只换「正在编辑的对象」：左栏换成母版与版式窗格，画布渲染所选版式 / 母版，检查器换成版式 / 母版 / 占位符属性，
 * 工具条在「选择」之后加「占位符 ▾」；画布列最上一条上下文条写明在哪、改谁、影响哪些页，右侧是唯一的出口「关闭母版视图」。
 * 入口在主菜单「视图 › 母版视图」（⌥⌘M、命令面板等价；普通视图另有检查器「编辑版式」与占位符的「转到版式」，见 entry-inspector、goto-layout）。
 * 2026-10-28（母版视图改版第一步「全局接线」）起母版视图是编辑器宿主的全局模式（editor/master/）：任何可编辑的桌面状态都能从入口进入、四种方式退出；
 * 本场景只写 masterView: { open: true } 让各状态载入时就在母版视图里，普通视图态从下面的 NORMAL 起写。
 * 2026-10-30（母版视图改版第二步「按标杆重做」，第二步规格 §4）：母版视图里的件由登记处 master-impl.tsx 给（上下文条、窗格、画布、检查器、工具条、轻提示与母版键位）。
 * 状态的 data 只写输入——选中谁、是谁、覆盖多少字号、删除前选中的是谁…（键见 mv-state.ts 的 MvData 与 README §3g）；页数、页码、名称、原因、可用与否、删除之后选中谁都由数据与规则算出。
 * 右键菜单与确认框写成种子件放进 layers（MasterRail 的 LayoutContextMenu / MasterContextMenu，MasterChrome 的确认框件），轻提示写 data.mvToast，不往 canvasOverlay 里放母版的内容。
 */

const base: EditorConfig = {
  selection: KIND.layout,
  stage: { cursor: false },
  // 载入时已在母版视图（宿主的全局模式）：左栏、画布、检查器、工具条与上下文条由登记处 master-impl.tsx 给，退出后是普通视图、可以再进
  masterView: { open: true },
  data: { mvPane: "office-title-content" } satisfies MvData,
}

/**
 * 普通视图态的底座（2026-10-30，母版视图改版第二步）：本场景新写的普通视图态（载入时不在母版视图里的）一律从这里起写——{ ...NORMAL, … }。
 * 场景级 base 是母版视图的配置（selection: KIND.layout、masterView.open: true），mergeConfig 对状态没写的顶层字段沿用场景级的值（scenarios/types.ts mergeConfig），
 * 不写 selection 就会按「版式」种类画出母版视图的检查器分区。entry 态早已显式写了这两项，不改
 */
const NORMAL: EditorConfig = { selection: "none", masterView: { open: false } }

/**
 * goto-layout 的输入：新建的第 7 页（slides-selection 的 newSlide，缺省「标题和内容」），选中的是它的内容占位符（id body）。
 * 检查器的占位符数据（名称、类型、索引、来自哪个版式、位置与大小）与画布上的选中框都由这页的版式与 placeholdersFor 算出，不另写
 */
const GOTO_PAGE = 7
const GOTO_PH = "body"
const gotoSlide = newSlide(GOTO_PAGE)
const gotoLayout = layoutOfSlide(gotoSlide)
const gotoPh = placeholdersFor(gotoLayout.master, gotoLayout.kind).find((p) => p.id === GOTO_PH)!
const gotoGeo = ptOf(gotoPh.box)
const GOTO_PLACEHOLDER: PlaceholderData = { title: gotoPh.label, type: typeNameOf(gotoPh), idx: gotoPh.idx, layout: gotoLayout.name, geo: gotoGeo }
/**
 * 新建页内容占位符的提示（「• 单击此处添加文本」「– 第二级」两行）所占的高（pt）：数值取 LayoutArt 新建页画法（prompts = slide）的那张表
 * SLIDE_BODY_PROMPT_META（框顶的上内距、两行的字号与行高、两行之间的空，cqw），PT_PER_CQW 换成 pt。图标条排在两行之下，不另取整、不另留余量
 */
const GOTO_PROMPT_PT =
  (SLIDE_BODY_PROMPT_META.padTopCqw +
    SLIDE_BODY_PROMPT_META.lineCqw.reduce((h, cqw) => h + cqw * SLIDE_BODY_PROMPT_META.lineHeight, 0) +
    SLIDE_BODY_PROMPT_META.gapCqw * (SLIDE_BODY_PROMPT_META.lineCqw.length - 1)) *
  PT_PER_CQW

/**
 * goto-layout 第 7 页的叠加层：点内容占位符选中它（检查器 placeholder-empty）；选中时 8 个手柄 + 尺寸角标（由占位符框算）；
 * 提示两行之下是 03-16 的快速插入图标条（kit PlaceholderIconBar，纸面取亮色 token，PaperScope）。评审 / 只读浏览不画图标条、选中框不画手柄（03-16 边界情况）
 */
function GotoPlaceholderOverlay() {
  const { selection, setSelection, mode } = useEditor()
  const ro = mode !== "edit"
  const bar = px(gotoGeo.x, gotoGeo.y + GOTO_PROMPT_PT, gotoGeo.w, gotoGeo.h - GOTO_PROMPT_PT)
  return (
    <div className="pointer-events-none absolute inset-0">
      <HitArea box={gotoPh.box} label={`选择${gotoPh.label}`} onClick={() => setSelection("placeholder-empty")} />
      {selection === "placeholder-empty" && <SelectionBox box={gotoPh.box} handles={ro ? "none" : "all"} label={`${gotoGeo.w} × ${gotoGeo.h}`} />}
      {!ro && (
        <PaperScope className="pointer-events-none absolute inset-0">
          <div className="absolute flex flex-col items-center justify-center gap-3" style={boxStyle(bar)}>
            <PlaceholderIconBar kinds={["table", "picture", "chart", "video"]} />
            <p className="text-[12px] leading-4 whitespace-nowrap text-(--v3-text-2)">单击图标插入，或把图片拖到这里</p>
          </div>
        </PaperScope>
      )}
    </div>
  )
}

/** 状态私有数据（带类型检查，交给 EditorConfig.data） */
const mv = (data: MvData & ThemeData): Record<string, unknown> => ({ ...data })

/**
 * master-shape 的输入：母版右侧一条整高的品牌浅色竖条（母版上的普通形状，在全部占位符右边、不与它们相交）；
 * 检查器是底座「矩形」的分区，位置与大小、填充等由母版件按这个形状的输入算（MasterChrome 的检查器内容，与画布同一份输入），状态里不另写
 */
const BAND = { id: "band", box: px(920, 0, 40, 540), fill: "brand-soft" as const }

export default defineScenario({
  id: "master-view",
  title: "母版视图",
  specs: ["03-26"],
  batch: 1,
  summary: "主菜单「视图 › 母版视图」进入；同一个编辑器换成母版与版式：左栏母版与版式窗格、画布虚线框 + 类型名（继承项点线「母版 · 类型」）、检查器版式 / 母版 / 占位符属性，画布列最上的上下文条与「关闭母版视图」",
  editor: base,
  states: [
    {
      id: "entry",
      title: "入口 · 主菜单「视图」",
      note: "03-26 §1.1：入口是主菜单「视图 › 母版视图 ⌥⌘M」，与 ⌥⌘M、命令面板「母版视图」三处等价；点它真的进入母版视图。检查器「版式」节标题右侧另有「编辑版式」（同 entry-inspector，那一态另开着它的工具提示）",
      editor: { selection: "none", masterView: { open: false }, layers: () => <EntryMenu /> },
    },
    {
      id: "default",
      title: "编辑版式（默认）",
      note: "03-26 §2–§4：同一个编辑器换成母版与版式——画布列最上一条上下文条写明在哪（母版视图）、改谁（版式「标题和内容」· 继承自母版「Office」）、影响哪些页，右侧是唯一的出口「关闭母版视图」；窗格里点哪个就编辑哪个。画布上本版式的占位符画虚线、写类型名，从母版继承的页脚、日期、页码画点线、写「母版 · 类型」，文本示例 1–5 级，内容占位符带插入图标条；工具条「占位符 ▾」排在「选择」之后；检查器 版式 → 占位符 → 主题（随母版）→ 背景，「使用此版式」下有「在普通视图查看 ›」。页数与页码都由文档算",
    },
    {
      id: "edit-master",
      title: "编辑母版",
      note: "03-26 §3、§4：窗格选中母版即编辑母版，没有「版式 | 母版」范围单选；上下文条「母版「Office」· N 个版式继承此母版」并写改动将影响的页（各版式引用页的合计）；画布是母版本身的五个占位符，全部虚线 + 类型名、没有继承区分，文本 1–5 级；检查器为母版属性（名称、版式数、使用此母版的页、保留母版、占位符、主题、背景）",
      editor: { selection: KIND.master, data: mv({ mvPane: "office" }) },
    },
    {
      id: "placeholder",
      title: "占位符属性 · 覆盖与重置",
      note: "03-26 §5：选中版式上的内容占位符（M3 可编辑）：八个手柄，框下尺寸角标与检查器的宽 × 高同一组数，选中项不写自己的类型名；检查器 类型 · 方向 · 大小 + 索引 · 来自、位置与大小、文本样式（大纲级别：级别、字体、字号与颜色、项目符号与缩进、行距与段距）。第 1 级字号已在此版式覆盖：数据只写覆盖的一份输入，画布上的文本按它画，检查器节末一行「字号已在此版式覆盖」+「重置为母版值」",
      editor: { selection: KIND.placeholder, data: mv({ mvPh: "body", mvOverride: { ph: "body", level: 1, size: 32 } }) },
    },
    {
      id: "inherited",
      title: "选中继承的页脚",
      note: "03-26 §4.2、50/11 §6：选中从母版继承的页脚——点线框换成强调色虚线、没有手柄；检查器顶行「页脚继承自母版「Office」」+「在母版中编辑 ›」，点它窗格选中母版、母版上的页脚被选中、焦点落在它上面；位置与大小、文本样式留在原位不可用，原因「继承自母版，在母版中编辑」；继承项没有填充与描边",
      editor: { selection: KIND.inherited, data: mv({ mvPh: "footer" }) },
    },
    {
      id: "m2-locked",
      title: "M2 · 占位符只能查看",
      note: "03-26 §4.2 里程碑（PRD ML-01）：M2 占位符可选中、不能移动编辑——选中框是实线、没有手柄，框内左下一枚纸面锁签「版式编辑将在后续版本提供」（暗亮同一外观）；检查器顶行写同一句，字段与「填充与描边」留在原位不可用；上下文条写 M2 的说明；「新建版式」与创建工具不可用，只有「选择」可用；「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）",
      editor: { selection: KIND.placeholder, inspector: { share: SHARE_LATER }, data: mv({ mvPh: "body", mvM2: true }) },
    },
    {
      id: "insert-placeholder",
      title: "插入占位符（M3）",
      note: "03-26 §4.3、50/11 §6：工具条「占位符 ▾」排在「选择」之后第 2 位（母版视图里替换「评论」），菜单图标是虚线框里叠类型图形；按当前版式已有的占位符预先不可用标题 / 页脚 / 日期 / 页码并写「已包含」（DS-30），媒体写「后续版本提供」；窗格选中「仅标题」，上下文条的影响页由文档算",
      editor: { data: mv({ mvPane: "office-title-only", mvPhMenu: true }) },
    },
    {
      id: "context-menu",
      title: "右键版式缩略图（M3）",
      note: "03-26 §3：版式右键——重命名、复制版式 ⌘D、插入版式 ⌘M ┊ 在普通视图查看引用页（右侧写引用页的页码，由文档算）┊ 删除版式 ⌫（危险项置末）；与指针右键、⇧F10 / 菜单键打开的是同一份菜单。重命名、删除不在常驻界面上另设按钮",
      editor: {
        data: mv({ mvPane: "office-title-only" }),
        layers: <LayoutContextMenu layout="office-title-only" />,
      },
    },
    {
      id: "delete-confirm",
      title: "删除被引用的版式",
      note: "03-26 §8（rulings §4.20 FE-05）：被引用的版式先确认，确认后仍可撤销；对话框正文的页数与页码由文档算，文案把「与当前页相同的默认版式」写成「默认版式」；从右键「删除版式」或 Delete 打开时焦点在「取消」（演示态打开时焦点在对话框本身，读屏先念标题），关闭后回到该版式的行",
      editor: {
        data: mv({ mvPane: "office-title-only" }),
        layers: <DeleteLayoutDialog layout="office-title-only" />,
      },
    },
    {
      id: "master-context-menu",
      title: "右键母版缩略图（M3）",
      note: "03-26 §3：母版右键——重命名、复制母版（含全部版式）、插入母版 ┊ 保留母版 ┊ 删除母版 ⌫。「保留母版」是勾选项，未勾时也画一个空的勾选框，勾没勾都看得出（Office 不是导入的母版，缺省未勾）；文档只剩一个母版时「删除母版」不可用并写「至少保留一个母版」（见 single-master-menu）",
      editor: {
        selection: KIND.master,
        data: mv({ mvPane: "office" }),
        layers: <MasterContextMenu master="office" />,
      },
    },
    {
      id: "delete-master-confirm",
      title: "删除被引用的母版",
      note: "03-26 §8（rulings §4.20 FE-23）：删除被引用的母版——确认后各页改用首个剩余母版中同类型的版式，不加母版选择器；一个事务、可撤销。正文里的页数、剩余母版的名称与一起删除的版式数都由数据算",
      editor: {
        selection: KIND.master,
        data: mv({ mvPane: "office" }),
        layers: <DeleteMasterDialog master="office" />,
      },
    },
    {
      id: "delete-undo",
      title: "删除未使用的版式",
      note: "03-26 §8：引用数 0 的版式直接删除，给可撤销轻提示「已删除版式「比较」」；窗格里它消失，选中移到同一母版里它前面的版式，上下文条写「此版式还没有页面使用」。演示数据只写删除前选中的是谁，删除之后选中谁由规则算出",
      editor: { data: mv({ mvSelBefore: "office-comparison", mvRemoved: ["office-comparison"], mvToast: { kind: "deleted", layout: "office-comparison" } }) },
    },
    {
      id: "unsaved",
      title: "未保存改动",
      note: "03-26 §6.3、04 §2.3a：拖动占位符中——框画在移动后的位置、不画手柄，尺寸角标换成位置「X · Y」；上下文条写「未保存改动 · 影响 N 页（第 x 页）」；提交后给轻提示「已更新 N 页」并回到常态（见 committed）",
      editor: { selection: KIND.placeholder, data: mv({ mvPh: "title", mvUnsaved: true, mvMove: { ph: "title", dx: 24, dy: 12 } }) },
    },
    {
      id: "multi-select",
      title: "多选版式（M3）",
      note: "03-26 §6.4：⌘ / Shift 多选同一母版内的版式——画布排出所选版式的真实渲染（每张卡下写名称与用量，点卡片回到单选），上下文条「已选中 3 个版式」；检查器「3 个版式」列出所选版式与背景，节末说明「按 Delete 或右键删除；单击任一版式回到单选」；「占位符」写「多选版式时不能插入占位符」，其余创建工具写「多选版式时不能插入」",
      editor: { selection: KIND.multi, data: mv({ mvPane: "office-comparison", mvMulti: ["office-comparison", "office-section", "office-blank"] }) },
    },
    {
      id: "theme",
      title: "编辑主题 · 预览当前母版",
      note: "03-28 §0：母版视图的「主题」节与普通视图同一张卡片、同一对弹层（两个入口一个面板），预览对象是当前母版；「主题颜色与字体」盖在检查器栏上、宽随检查器，画布整页可见、不动，强调色 1 改成孔雀绿时画布实时预览，缩略图不变",
      editor: { selection: KIND.master, data: mv({ mvPane: "office", themeEditor: true, themeTab: "colors", themeSlot: 4, themeLive: { a1: "#0F8B8D" } }) },
    },
    {
      id: "readonly",
      title: "只读 · 已在其中被降权",
      note: "03-26 §6.5 + DS-15：会话内被降权时不强制退出——上下文条换锁形图标与「只能查看母版与版式」、不再写影响页数；检查器顶行「只读 · 需要编辑权限」，各节只读展示当前值（不画禁用控件），「在普通视图查看 ›」只是导航、照常可用；新建版式、创建工具不可用并写原因，窗格照常可浏览",
      // 降权是会话级事实（宿主的 readonlyDegraded，原 data.mvReadOnly）：主菜单与缩略图右键里改文档的命令不可用并写原因（DS-15），退出后普通视图同样是降权态
      editor: { rail: { readonlyDegraded: "需要编辑权限" } },
    },
    {
      id: "loading",
      title: "加载中",
      note: "03-26 §6.1（DS-53 的统一画法）：数据未就绪且超过 300 ms 才显示——窗格一行转圈 +「正在加载母版与版式…」，画布正中一个转圈（不画空白页框），检查器一行「正在加载母版信息…」；工具条整条不可用（含「选择」），原因「母版信息加载后可用」；上下文条与「关闭母版视图」照常可用",
      editor: { data: mv({ mvStatus: "loading" }) },
    },
    {
      id: "load-failed",
      title: "加载失败",
      note: "03-26 §6.2（DS-53）：窗格一行「母版与版式未能加载」，画布中央图标、标题与说明 +「重试」次按钮（只此一处），检查器一行「母版信息未能加载，属性暂不可用」；工具条整条不可用；上下文条的「关闭母版视图」保持可用，可以退回普通视图",
      editor: { data: mv({ mvStatus: "failed" }) },
    },
    {
      id: "entry-inspector",
      title: "入口 · 检查器「编辑版式」",
      note: "03-02 §3.5：普通视图第 2 页无选中，检查器「版式」节标题右侧的 24px 动作位放「编辑版式」（图标同母版视图的上下文条），点它进入母版视图、窗格选中本页所用的版式（含在版式画廊里换过的），焦点在该行；可用与否与原因同主菜单「视图 › 母版视图」（03-26 §1.1），不能进入时留在原位写原因，评审、查看者与降权的只读检查器里同样留在原位不可用；工具提示「编辑版式 ⌥⌘M」一出现就开着是演示，第一次操作后收起",
      editor: { ...NORMAL, data: mv({ mvTip: "edit-layout" }) },
    },
    {
      id: "goto-layout",
      title: "入口 · 转到版式",
      note: "03-03「母版视图与继承上下文」：新建的第 7 页选中内容占位符，检查器顶行写它继承自哪个版式并给「转到版式」；点它进入母版视图、选中这个版式与版式上对应的占位符，焦点落在画布上那个占位符；评审时这一行照画、动作留在原位不可用并写原因。检查器的占位符信息与画布选中框都由这一页的版式算出",
      editor: {
        ...NORMAL,
        deck: deckWith({}, [gotoSlide]),
        slide: GOTO_PAGE,
        selection: "placeholder-empty",
        data: { placeholder: GOTO_PLACEHOLDER } satisfies { placeholder: PlaceholderData },
        slideOverlay: (ctx: EditorCtx) => (ctx.slide === GOTO_PAGE ? <GotoPlaceholderOverlay /> : null),
      },
    },
    {
      id: "from-grid",
      title: "入口 · 网格视图",
      note: "03-26 §6.8：网格视图左上胶囊的主菜单「视图 › 母版视图 ⌥⌘M」；母版视图没有网格形态，进入时按单页的结构画，退出后回到网格",
      editor: { ...NORMAL, view: "grid", layers: <MainMenuLayer openPath={["view"]} highlight="母版视图" /> },
    },
    {
      id: "entry-blocked",
      title: "入口不可用 · ⌥⌘M",
      note: "03-26 §1.1：评审模式下按 ⌥⌘M 不切换，只用一条轻提示说明原因（与主菜单「视图 › 母版视图」同一句），再按不另出一条；提示由编辑器按入口规则给出，这一态只负责触发",
      editor: { ...NORMAL, mode: "review", canvasOverlay: <MasterHintDemo /> },
    },
    {
      id: "shortcuts",
      title: "键盘快捷键 · 母版视图的键",
      note: "03-24 §4：快捷键面板搜「母版」，母版视图 ⌥⌘M 之外，母版视图里的三个键写进现有分组、作用域写在名称的括号里（同「新建同版式幻灯片（左栏）」）——全局「插入版式（母版视图）⌘M」、工具「占位符（母版视图）P」、左栏缩略图与网格「复制版式（母版窗格）⌘D」",
      editor: { ...NORMAL, canvasOverlay: <ShortcutsHost />, data: { kQuery: "母版" } satisfies ShortcutsData },
    },
    {
      id: "view-menu",
      title: "母版视图里的主菜单「视图」",
      note: "03-26 §1.1：母版视图里主菜单「视图」同一位置是「关闭母版视图 ⌥⌘M」（与上下文条的按钮、⌥⌘M、命令面板等价）；「网格视图」「备注」留在原位不可用并写原因",
      editor: { layers: <MainMenuLayer openPath={["view"]} highlight="关闭母版视图" /> },
    },
    {
      id: "help-menu",
      title: "主菜单「帮助 › 关于母版继承」",
      note: "TB-15、TB-132：母版视图里主菜单「帮助」多一项「关于母版继承」（外链图标，新标签页打开）；只在集成方配置了帮助链接时出现，没配置时连同「帮助中心」都不列（DS-89）",
      editor: { layers: <MainMenuLayer openPath={["help"]} highlight="关于母版继承" /> },
    },
    {
      id: "palette",
      title: "母版视图里的命令面板",
      note: "50/10 §10.1：命令面板在母版视图里原地打开，搜「版式」——「母版」类命令（插入版式 ⌘M、复制所选版式 ⌘D、插入占位符… P、在普通视图查看引用页，另有新建母版、从模板导入母版…）只在母版视图里列，可用与否与原因同「新建版式 ▾」菜单、工具条「占位符 ▾」与窗格右键；「幻灯片」一组（如「更换版式…」）写「母版视图下不可用」，↵ 只播报原因、面板不关；「关闭母版视图 ⌥⌘M」与主菜单同一条",
      editor: { data: { cOpen: true, cQuery: "版式" } satisfies PaletteData },
    },
    {
      id: "m2-default",
      title: "M2 · 浏览版式",
      note: "PRD ML-01（M2）：可浏览版式、可选中占位符，不能改——上下文条「可以查看并选中占位符，版式编辑将在后续版本提供」，检查器顶行「版式编辑将在后续版本提供」，名称、占位符勾选与背景留在原位不可用；工具条只有「选择」可用；窗格没有右键菜单、不能改名或拖动",
      editor: { inspector: { share: SHARE_LATER }, data: mv({ mvM2: true }) },
    },
    {
      id: "m2-edit-master",
      title: "M2 · 浏览母版",
      note: "PRD ML-01（M2）：同 m2-default，窗格选中母版——上下文条换成母版，检查器的母版属性留在原位不可用、原因写在顶行",
      editor: { selection: KIND.master, inspector: { share: SHARE_LATER }, data: mv({ mvM2: true, mvPane: "office" }) },
    },
    {
      id: "m2-inherited",
      title: "M2 · 选中继承项",
      note: "PRD ML-01（M2）、03-26 §4.2：M2 下选中继承的页脚——强调色虚线、无手柄；检查器顶行「页脚继承自母版「Office」」+「在母版中编辑 ›」照常可用（只换查看对象），落到母版后母版页脚的选中框是实线、无手柄；字段的不可用原因写 M2 那一句「版式编辑将在后续版本提供」",
      editor: { selection: KIND.inherited, inspector: { share: SHARE_LATER }, data: mv({ mvM2: true, mvPh: "footer" }) },
    },
    {
      id: "m2-theme",
      title: "M2 · 主题只展示",
      note: "03-28 §3.8：M2 主题只展示——母版的主题卡片照画、不展开画廊，「调整主题」留在原位不可用；工具提示「当前版本暂未开放」一出现就开着是演示，第一次操作后收起",
      editor: { selection: KIND.master, inspector: { share: SHARE_LATER }, data: mv({ mvM2: true, mvPane: "office", mvTip: "theme-adjust" }) },
    },
    {
      id: "master-text-level",
      title: "母版 · 改第 2 级文本",
      note: "PRD ML-03（母版文本样式）、03-26 §5：双击母版的文本占位符进入提示文本编辑——1px 强调色框、无手柄，插入符在「二级」那一行末尾；检查器「级别」跟着是第 2 级，字号、缩进、行距、段距取第 2 级的样式（与画布上实际画出来的同一组数）；Esc 先退出文本编辑",
      editor: { selection: KIND.placeholder, data: mv({ mvPane: "office", mvPh: "body", mvCaret: { level: 2 } }) },
    },
    {
      id: "placeholder-more",
      title: "占位符 · 类型、方向与段落",
      note: "PRD ML-03、03-26 §5：选中「两栏内容」右栏的内容占位符，检查器「类型」下拉展开——同族的内容 · 文本 · 图片 · 表格 · 图表，媒体写「后续版本提供」；其下「方向」（横排 / 竖排）与「大小」（全尺寸 / 半尺寸 / 四分之一），文本样式含项目符号与缩进、行距与段距四项",
      editor: { selection: KIND.placeholder, data: mv({ mvPane: "office-two-content", mvPh: "body-2", mvMenu: "ph-type" }) },
    },
    {
      id: "master-shape",
      title: "母版上的普通形状",
      note: "03-26 §4.2：母版上的普通形状（右侧整高的品牌浅色竖条）按普通对象选中——八个手柄 + 尺寸角标，不写类型名；检查器面板标题「矩形」，位置与大小取这个形状的框；它同时出现在这个母版各版式的缩略图里（母版图形，在版式上不可选）",
      editor: {
        selection: "shape",
        data: mv({ mvPane: "office", mvShapes: [BAND], mvShapeSel: BAND.id }),
      },
    },
    {
      id: "new-doc",
      title: "新文档 · 默认母版",
      note: "03-26 §6.7：新文档自带一个母版「Office」与 11 个标准版式（同 PowerPoint 新建演示文稿的顺序），除「标题幻灯片」外都「未使用」；每个都是真实渲染、放不下的段整段不画，不做空状态插画；上下文条的影响页由文档算",
      editor: { deck: [newSlide(1, "标题幻灯片")], slide: 1, data: mv({ mvMasters: "new-doc", mvPane: "office-title" }) },
    },
    {
      id: "long-names",
      title: "长名与未命名",
      note: "PRD ML-01 边界：版式名换行、不截断，窗格里没有横向滚动；名称为空时显示「未命名版式 n」（n 是同一母版里空名版式的序号）；上下文条、检查器与读屏名用同一个显示名",
      editor: { data: mv({ mvNames: { "office-two-content": "两栏内容（左文右图）带页脚", "office-blank": "" }, mvPane: "office-two-content" }) },
    },
    {
      id: "rename-inline",
      title: "就地改名",
      note: "PRD ML-03、03-26 §3：双击名称或右键「重命名」就地改名（检查器「名称」字段保留，同一套规则）——输入框占名称列；同一母版里重名时这一行下方红字「同一母版里已有「X」」、↵ 不提交，超过 64 字写「名称最多 64 个字」；Esc 取消、焦点回到该行",
      editor: { data: mv({ mvPane: "office-two-content", mvRename: { id: "office-two-content", value: "标题和内容" } }) },
    },
    {
      id: "reorder",
      title: "拖拽重排",
      note: "03-26 §3：拖动版式缩略图重排——源行变淡，目标处一条 2px 强调色插入线，拖影是同一张缩略图（半透明、带浮层阴影）；版式只在所属母版内重排，Esc 取消并回弹",
      editor: { data: mv({ mvDrag: { id: "office-comparison", to: "office-section", at: "after" } }) },
    },
    {
      id: "reorder-blocked",
      title: "拖到别的母版",
      note: "03-26 §3：把版式拖到别的母版——不画插入线，拖影右上角一枚禁止标记，松手回弹；截图拍不到真实光标，禁止标记是它的替身。是否禁止由两个版式所属的母版算出",
      editor: { data: mv({ mvDrag: { id: "office-comparison", to: "simple-title-content", at: "after" } }) },
    },
    {
      id: "readonly-menu",
      title: "降权时的右键菜单",
      note: "TB-22、03-05：降权时右键版式——改文档的条目留在原位不可用，原因相同的一组写在菜单顶部一行「需要编辑权限」，快捷键照写；「在普通视图查看引用页」只是导航，照常可用",
      editor: { rail: { readonlyDegraded: "需要编辑权限" }, layers: <LayoutContextMenu layout="office-title-only" /> },
    },
    {
      id: "single-master-menu",
      title: "只剩一个母版",
      note: "PRD ML-03、03-26 §3：文档只剩一个母版时，母版右键里「删除母版」留在原位不可用并写「至少保留一个母版」",
      editor: { selection: KIND.master, data: mv({ mvMasters: "single", mvPane: "office" }), layers: <MasterContextMenu master="office" /> },
    },
    {
      id: "multi-delete-confirm",
      title: "多选批量删除",
      note: "rulings §4.10 Q16、03-26 §8：多选批量删除合并判定、一次确认、同一事务——「删除 3 个版式？」，正文写其中几个版式仍被几个页面使用与页码（由文档算），删除后可以撤销；用 Delete 打开时初始焦点在「取消」，关闭后回到窗格的行",
      editor: { selection: KIND.multi, data: mv({ mvPane: "office-title-only", mvMulti: ["office-comparison", "office-title-only", "office-blank"] }), layers: <DeleteLayoutsDialog /> },
    },
    {
      id: "delete-reassigned",
      title: "删除被引用的版式之后",
      note: "rulings §4.20 FE-05、03-26 §8：删除被引用的版式之后，受影响的页改用默认版式（同母版同类型的首个，没有就该母版的首个版式），轻提示「已删除版式，N 页已改用默认版式」可撤销；窗格里接手这些页的版式计数随之增加，选中移到它前面的版式。演示数据只写删除前选中的是谁",
      editor: { data: mv({ mvSelBefore: "office-title-only", mvRemoved: ["office-title-only"], mvToast: { kind: "reassigned", layout: "office-title-only" } }) },
    },
    {
      id: "delete-placeholder",
      title: "删除版式上的占位符",
      note: "PRD ML-03：删除版式上的内容占位符——画布与缩略图都不再画它；引用这个版式的页上原来的占位符保留为普通形状，轻提示「已影响 N 页，其中的占位符已保留为普通形状」可撤销",
      editor: { data: mv({ mvPane: "office-title-content", mvRemovedPh: { "office-title-content": ["body"] }, mvToast: { kind: "ph-removed" } }) },
    },
    {
      id: "committed",
      title: "提交之后",
      note: "PRD ML-03（即时更新）：提交拖动之后给轻提示「已更新 N 页」，标题占位符仍选中，上下文条回到「改动将影响 N 页（第 x 页）」",
      editor: { selection: KIND.placeholder, data: mv({ mvPh: "title", mvToast: { kind: "committed" } }) },
    },
    {
      id: "limit-toast",
      title: "竞态超限",
      note: "rulings §4.10 Q16、03-26 §4.3：「占位符 ▾」菜单里同类上限已预先不可用；竞态下仍超限才出这条轻提示「该版式已包含标题占位符」",
      editor: { data: mv({ mvPane: "office-title-only", mvToast: { kind: "limit", type: "title" } }) },
    },
    {
      id: "presence",
      title: "他人在编辑",
      note: "03-26 §3：他人正在编辑的版式行右端一枚身份色头像（王小明），读屏名带「王小明正在编辑」；上下文条不变",
      editor: { data: mv({ mvPresence: [{ layout: "office-title-only", who: "WANG" }] }) },
    },
    {
      id: "remote-deleted",
      title: "选中的版式被他人删除",
      note: "50/11 §10：选中的版式被他人删除——选中移到它的母版，检查器随之是母版属性；轻提示「「两栏内容」已被 王小明 删除」。演示数据只写删除前选中的是谁、谁删的",
      editor: { data: mv({ mvSelBefore: "office-two-content", mvRemoved: ["office-two-content"], mvToast: { kind: "remote-deleted", layout: "office-two-content", who: "WANG" } }) },
    },
    {
      id: "remote-updated",
      title: "他人同时改同一个字段",
      note: "03-02 §4「远端覆盖」（同 main-states.remote-overwrite）：王小明同时改了标题占位符的 Y——画布上标题框在新位置并画王小明的远端选区，检查器 Y 字段外圈换成王小明的身份色，节末一行写明已更新",
      editor: { selection: KIND.placeholder, data: mv({ mvPh: "title", mvRemote: { ph: "title", key: "y", value: 40, who: "WANG" } }) },
    },
    {
      id: "export-unused",
      title: "导出前提示未使用的母版",
      note: "PRD ML-03、03-26 §8：普通视图里导出前，「保留母版」关闭且没有页面使用的母版会被移除——对话框「未使用的母版「简约」将被移除」[保留][移除]，「保留」即把它的「保留母版」打开；列哪个母版由「保留母版」与用量算",
      editor: { ...NORMAL, data: mv({ mvPreserve: { simple: false } }), layers: <ExportUnusedDialog /> },
    },
  ],
})
