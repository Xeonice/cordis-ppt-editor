import { MainMenuLayer, ME, OfflineBanner, RailList, RailThumb, SHARE_LATER, type EditorCtx } from "../../kit"
import { ReviewBar, ViewerBar } from "../comments/chrome"
import { DECK_COMMENTS } from "../comments/comments.scenario"
import { deckFor } from "../fidelity/slides"
import { STATUS } from "../main-states/bars"
import { defineScenario, type EditorConfig, type Slot } from "../types"
import { ExportController } from "./controller"
import { ExportDialogLayer } from "./ExportDialog"
import { ICON_SOURCE } from "./fileTypeIcons"
import type { ExportSeed } from "./model"
import { LiveSyncStatus } from "./parts"

/**
 * export：03-22 通用导出对话框（主菜单「文件 › 导出…」⇧⌘E，PRD 07 G-25、D17；第 3 批 · 应用壳族，rulings §4.25 DS-62、DS-78）。
 * 与第 2 批「导出本地副本」（offline-conflict 的降权 / 离开确认里那个，03-12 §7.2，TB-85）是两个对话框，画法一致。
 * 对话框状态机能点着走：选项 → （有未同步更改）仍要导出 / 等待同步倒数 → （服务端格式）排队 → 生成中 → 关闭 + 轻提示（DS-100）或停在「导出完成」（DS-100 未采纳的备选）；
 * 生成中「取消」、Esc、× 都回到选项（DS-101；这几个阶段 × 的名字是「取消导出」、点遮罩不关闭）；失败给「重试」。别的样张里选主菜单「文件 › 导出…」会转到这里（provides，查看者转到 no-permission）。
 * 没有导出权限：查看者 no-permission（「只有查看权限」）、评审者 no-permission-reviewer（「需要编辑权限」），两态停在有评论的第 4 页、照第 1 批画评论钉（TB-126）；
 * 编辑中被降权时「导出…」同样不可用、写「需要编辑权限」（DS-105，第 1 批 main-states.degraded-menu 随之改）；三种都由底座主菜单按 kit exportReasonOf 置灰，⇧⌘E 同时无效。
 * 2026-10-22 拍板（rulings §4.25）：DS-100 完成后关闭并轻提示（未采纳 alt-done-state）、DS-101 服务端导出只有「取消」一个出口、DS-102 PNG 的范围与生成位置、DS-103 pptx 只导整份 / 隐藏页缺省不含 / 不放 JPEG、DS-104 不加打印入口、DS-105 降权后不可用。
 * 可选状态的取舍（摸底 states-g2-import-export.md）：pdf 并进 unsynced-server 与 server-generating（选 PDF 的选项页就在那里）；hidden-slides 并进 png（这份文档第 5 页已隐藏）；
 * loading-rest（渐进打开还没到齐，只在本地 / SDK）与 downloads-blocked（嵌入 iframe 缺 allow-downloads，M3 P2）的规格写在 default 的说明末尾（03-22 §5.3、§10），
 * too-many-pages 写在 png 的说明里（浏览器端 PNG 按宽度分档的页数上限，初值 1280 px 200 页、1920 px 100 页、3840 px 25 页，M2 实测后只收紧，rulings §4.25 TB-148；
 * SVG 不设分档上限，TB-152，见 svg 的说明；03-22 §4.3），都不另画。
 * 同目录：model（状态、格式、页码校验、文件名）、ExportDialog（对话框）、controller（命令、计时、轻提示）、parts（同步状态行）、
 * fileTypeIcons（格式图标里 DS-143 未采纳的两套）；文件名的长名规则与导入对话框同一个件（import/FileName.tsx）。
 * 2026-10-23（rulings §4.25 DS-142、DS-143、TB-182、TB-183）：对话框按全站新画法（标题栏 40、圆角 12、× 正文色）；格式行在单选圈与名称之间放 20px 文件类型图标
 * （Tabler Icons，kit FileTypeIcon，各态缺省就带），插件格式没有专属图标时用通用 file 字形；M3 选 PDF 与插件格式同屏的样子是 m3-pdf（原 icons-tabler-m3 转正）。
 * 拍板时与缺省重复的 icons-tabler、icons-tabler-png 删去；未采纳的 Phosphor、Bootstrap 两套各留 M2 与 M3 两态（alt-icons-*，DS-63）；
 * 彩色文件图标（Untitled UI）授权不明，原件与 alt-icons-color、alt-icons-color-m3 两态一并删去（TB-183）。
 */

/** 状态数据：这份文档有原样保留的部件（导入的 pptx），pptx 时底部一行说明 */
const seed = (s: ExportSeed = {}) => ({ export: { preserved: true, ...s } satisfies ExportSeed })

/** 这份文档第 5 页已隐藏、左栏多选了第 2–4 页（PNG 的范围要用到）：左栏的显示与对话框的页数是同一组数 */
const HIDDEN = [5]
const SELECTED = [2, 3, 4]

/** 本端还有没同步的更改（打开对话框时就判，50/04 §8.3）：左栏同步状态行随倒数实时变 */
const UNSYNCED: EditorConfig = { rail: { status: <LiveSyncStatus /> } }

/** 文档有无法显示的内容（第 2 批 fidelity 的同一份文档：第 7 页瀑布图占位），左栏第 7 页带警告角标 */
const DEGRADED: EditorConfig = {
  deck: deckFor("main"),
  slide: 7,
  rail: {
    list: (ctx) => (
      <RailList>
        {ctx.deck.map((s) => (
          <RailThumb key={s.n} slide={s} current={s.n === ctx.slide} onPick={ctx.goTo} warn={s.n === 7 ? 1 : undefined} />
        ))}
      </RailList>
    ),
  },
}

/** 插槽取值（节点或拿编辑器上下文的函数），拼两份插槽时用 */
const fill = (s: Slot | undefined, ctx: EditorCtx) => (typeof s === "function" ? s(ctx) : s)

/**
 * 没有导出权限的两态（查看者 / 评审者）：从只读浏览 / 评审起步、停在有评论的第 4 页，评论钉由场景自己画（rulings §4.25 TB-83：评审 / 只读浏览起步的状态由场景画；
 * TB-126）——照第 1 批 main-states 的 REVIEW 写法并入评论场景的 DECK_COMMENTS：CommentLayer 评论钉（点钉定位线程）、左栏实时角标、
 * 「评论」页签的评论面板、删除确认，工具条换成评论场景的 ViewerBar / ReviewBar（「上一处 / 下一处评论」接上定位、计数实时）；data.role 写 viewer / commenter。
 * 检查器仍停在「设计」页签（与改前同一画面）。本场景的常驻控制件（ExportController）与主菜单「文件」的静态展开照旧，和评论场景的叠加层、浮层拼在一起。
 * 「文件 › 导出…」的置灰由底座按模式与编辑权限给（kit exportReasonOf，DS-105；原来在这里换「文件」条目，第 3 批转正时删去）
 */
function noPermission(role: "viewer" | "commenter"): EditorConfig {
  const viewer = role === "viewer"
  return {
    ...DECK_COMMENTS,
    mode: viewer ? "viewer" : "review",
    slide: 4,
    toolbar: viewer ? {} : { canEdit: false },
    rail: { ...DECK_COMMENTS.rail, menu: viewer ? {} : { canEdit: false } },
    regions: { toolbar: () => (viewer ? <ViewerBar /> : <ReviewBar canEdit={false} />) },
    canvasOverlay: (ctx) => (
      <>
        <ExportController />
        {fill(DECK_COMMENTS.canvasOverlay, ctx)}
      </>
    ),
    layers: (ctx) => (
      <>
        {viewer ? <MainMenuLayer openPath={["file"]} /> : <MainMenuLayer openPath={["file"]} canEdit={false} />}
        {fill(DECK_COMMENTS.layers, ctx)}
      </>
    ),
    data: { ...DECK_COMMENTS.data, role, ...seed({ open: false, noPermission: true }) },
  }
}

/* 格式行的文件类型图标（rulings §4.25 DS-143、TB-182）：各态共用的说明句 */
const ICONS_LAYOUT =
  "「格式」每行：单选圈 16 · 8 · 文件类型图标 20 · 8 · 名称 · 右侧说明（kit RadioRow 的 icon 插槽）；行高仍是 28（kit 控件高，图标上下各留 4），对话框不变高。图标取 20、不取 RadioRow 图标插槽已有先例的 16（insert 的动作设置用 ICON 16）：为了字样可辨，16px 时字高只剩约 4px。选中不改图标颜色（选中只由单选圈表达）；不可用的行（M2 的 PDF「M3」）图标随文字一起降为 text-3。图标只作装饰：aria-hidden，单选项的读屏名照旧是格式名（不可用时带原因）。只有「格式」一节带图标（「图片宽度」「字体」「范围」不是文件类型，不加），名称列因此比其余各节的单选项右移 28（图标 20 + 间距 8），单选圈仍对齐左缘；图标里的字样约 5px 高，信息与旁边的名称重复，只作辅助识别"
/** 采纳的一套（DS-143） */
const ICONS_ADOPTED =
  "图标取 Tabler Icons outline 的 file-type-ppt / png / svg / pdf（npm @tabler/icons 3.49.0，MIT，Copyright (c) 2020-2026 Paweł Kuna；原件逐字照抄，描边原件 2、取 1.5，与 v3 的 lucide 图标同一描边参数；kit FileTypeIcon），中性色：可用 text-2（暗 #B0B0B0、亮 #666666）、不可用 text-3，守 Q3。图上字样是「PPT」（Tabler 没有 pptx），名称照旧写「PowerPoint（.pptx）」、图标 aria-hidden 只作装饰（DS-143 定为接受这一字样）。设计 04 §2.14「单一图标家族」只为文件类型图标开这一个例外，产品里把这几个 SVG 复制进 ui-react 的图标件、写明出处与许可证，不新增运行时依赖（TB-182）"
/** 插件格式的图标（TB-182） */
const ICONS_PLUGIN =
  "插件贡献的格式（M3 PS-14，样张的「Markdown 导出」）没有专属图标时用 Tabler 的通用 file 字形（icons/outline/file.svg，与格式图标同一描边），不留空位，也不用 §2.14 的回退图标 Puzzle——这一格表示文件类型，插件归属已由行右侧的 Blocks +「来自「Markdown 导出」」表达（TB-182）"
/** 「导出本地副本」对话框同一套（TB-182） */
const ICONS_LOCAL_COPY =
  "「导出本地副本」对话框（03-12 §7.2，offline-conflict/dialogs.tsx，与本对话框画法一致）的格式行同样带图标：.pptx 一行同一套（Tabler file-type-ppt），.json 一行用 lucide FileBraces（TB-182）"
/** 未采纳两套各态的说明开头（DS-63） */
const ICONS_ALT = "未采纳（DS-143 定为 Tabler Icons，各态缺省就带，见 default、m3-pdf）："

/** 两态共同的一句（评论钉，TB-126） */
const PINS_NOTE =
  "停在有评论的第 4 页：画布照常画 3 枚评论钉（张、李、王）、左栏第 4 页角标与工具条「3 条评论」一致（DS-43 只有放映与母版视图不显示评论钉；TB-83 评审 / 只读浏览起步的状态由场景自己画，TB-126）——照第 1 批 main-states 的写法并入评论场景（评论钉可点、定位线程，「上一处 / 下一处评论」接上定位），检查器仍停在「设计」页签"

export default defineScenario({
  id: "export",
  title: "导出",
  specs: ["03-22"],
  batch: 3,
  summary: "通用导出对话框：格式（pptx / PNG / SVG / PDF）与范围、未同步与等待同步、生成中与取消、失败、完成后的轻提示、没有导出权限",
  // 别的样张里选主菜单「文件 › 导出…」（那里没有场景接住 file.export）：转到对话框开着的选项页；查看者没有导出权限，转到 no-permission
  provides: { "file.export": { edit: "default", review: "default", viewer: "no-permission" } },
  editor: {
    stage: { cursor: false },
    // 里程碑跟 ExportSeed.milestone（model.ts：缺省 M2）：M2 的「分享」留在原位、不可用（rulings §4.25 DS-137、TB-161）；标 M3 的四态各自覆盖为照常可用
    inspector: { share: SHARE_LATER },
    layers: <ExportDialogLayer />,
    canvasOverlay: <ExportController />,
    data: seed(),
  },
  states: [
    /* ---------------------------------------------------------------- 选项 */
    {
      id: "default",
      title: "默认 · PowerPoint 整份",
      note:
        "rulings §4.25 DS-103（pptx 只导整份、对话框不放 JPEG）、DS-104（不加打印入口，需要打印时导出 PDF）。03-22 默认态 / PRD 07 G-25、D17：主菜单「文件 › 导出…」⇧⌘E（DS-78；Windows / Linux Ctrl+Shift+E）打开，kit Dialog md 480、顶部锚定（内容随格式与阶段增减，标题不跳动），标题「导出「文档名」」。「格式」单选行与第 2 批「导出本地副本」同一画法（12px 标签 + 右侧次级文字说明），单选圈与名称之间放 20px 文件类型图标（rulings §4.25 DS-143）：PowerPoint（.pptx）· 可在 PowerPoint 中继续编辑 / PNG 图片 · 每页一张图片 / SVG 矢量图 · 每页一个矢量文件 / PDF——M3 后半段前留在原位、不可用、标 M3、右侧「后续版本提供」，不隐藏（rulings §4.20 FE-06），图标随文字降为 text-3；不放 JPEG（JPEG 与质量参数留给 API 与自动化，SV-02、SV-13）。pptx 时「范围」只有一行「全部 6 页 · PowerPoint 格式只导出整份文档」（要部分页先「创建副本」再删页）。文档有原样保留的部件时底部一行「未修改的内容将原样保留」（只对 pptx 成立）。底栏「取消 / 导出」。缺省 pptx + 全部页，之后记住上次的格式与范围（D17，本机偏好）；文件名 = 文档标题。另两种情况不单独画，规格写在这里（03-22 §5.3、§10 同此）：① 其余页面还没载入（loading-rest，渐进打开还没到齐，50/04 §2；只在本地字节 / SDK 的渐进打开里出现，M1 / M2（SDK）；参考应用的服务端文档以协同快照一次装载，不会出现）——对话框先显示加载行（DS-53 转圈 +「正在载入其余页面…」，role=status），底栏只有「取消」（关闭对话框），到齐后自动换成选项页、焦点落在第一个格式；② 嵌入 iframe 不允许下载（downloads-blocked，宿主的 iframe 缺 allow-downloads，50/14 §11.2；M3 P2）——选项页顶部一行说明（与未同步说明同一画法 InspectorNotice、中性信息图标）「请在独立窗口中打开后导出」，「导出」留在原位不可用、工具提示同一句（FE-06），格式与范围照常可选；背后的编辑器是 M2（ExportSeed 缺省 M2，本场景除标 M3 的五态外同此）：「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）。" +
        `文件类型图标（DS-143、TB-182）：${ICONS_ADOPTED}。${ICONS_LAYOUT}。${ICONS_LOCAL_COPY}。对话框画法同全站（DS-142：标题栏 40、圆角 12、× 正文色）`,
      editor: { data: seed() },
    },
    {
      id: "png",
      title: "选 PNG · 宽度与范围",
      note: "rulings §4.25 DS-102（M2 四种范围都在浏览器生成、多页打成一个 .zip）、DS-103（隐藏页缺省不含）。选 PNG 多一节「图片宽度」分段 1280 / 1920 / 3840 px（OF-19，缺省 1280；旧样张的 960 作废）；「范围」四项——全部页（这份文档第 5 页已隐藏：「5 页 · 不含 1 张隐藏页」；点名到隐藏页的范围照常导出）· 当前页 · 选定页（左栏多选了第 2–4 页：「3 页」）· 自定义页码（输入框常在、聚焦即选中这一项，占位「例如 1,3,5-8」）；多页时范围下一行「多页会打包成一个 .zip 文件。」（「标题.zip」里是「标题-01.png」…，单页直接是「标题-02.png」；对话框里的说明句末加句号，DS-62，同第 2 批分享对话框；带图标的说明行与整块状态不加）。浏览器端多页 PNG 的页数上限按所选宽度分档，先按初值登记：1280 px 200 页（等于系统天花板，即不另设限）、1920 px 100 页、3840 px 25 页，M2 实测后只收紧（rulings §4.25 TB-148，前端 50/13 §3、设计 03-22 §4.3）；所选范围超出当前宽度那一档时范围下一行写「一次最多导出 N 页图片。」、「导出」不可用（工具提示同一句），改小宽度或缩小范围即恢复。M3 起「全部页」改由服务端生成，范围下一行写「全部页由服务端生成，只含已同步的内容。」，其余范围与 SVG 仍在浏览器（DS-102）。母版视图里打开时「当前页 / 选定页」不可用，写「母版视图下不可用」",
      editor: { rail: { hidden: HIDDEN, selected: SELECTED }, data: seed({ format: "png", hidden: HIDDEN, selected: SELECTED }) },
    },
    {
      id: "svg",
      title: "选 SVG · 内嵌字体",
      note: "选 SVG：没有宽度，多一节「字体」——勾选「内嵌字体」（PRD OF-19 要求、03-22 漏画；缺省不勾，右侧「文件会变大，没有这些字体的电脑也显示原字体」：内嵌的是部署字体包里用到的字体文件，授权字体的再分发由用户自己选，50/18 EXP-03）。范围同 PNG；没在左栏多选时「选定页」留在原位不可用、右侧与工具提示写「先在左栏选中多页」；这里选了「当前页」，单页不打包（文件名「标题-02.svg」）。SVG 不设分档上限，只受每份文档的页数天花板（rulings §4.25 TB-152，03-22 §4.3；逐页序列化、不栅格化，所以选 SVG 时不出「一次最多导出 N 页图片。」）",
      editor: { data: seed({ format: "svg", range: "current" }) },
    },
    {
      id: "custom-range-error",
      title: "自定义页码有误",
      note: "自定义页码有误：输入「1,3,x」后离开输入框——字段 1px 危险色内描边 + 下方一行「页码格式不正确，请使用如 1,3,5-8 的格式」（aria-invalid + aria-describedby）；超出页数写「第 15 页不存在，共 6 页」；中文逗号与空格照认。「导出」留在原位不可用、工具提示「页码有误，改正后才能导出」，空着时写「请输入要导出的页码」。离开过输入框之后边输边校验，改对后错误即消失",
      editor: { data: seed({ format: "png", range: "custom", custom: "1,3,x", customTouched: true }) },
    },

    /* ---------------------------------------------------------------- 未同步与等待同步（rulings §4.18 UX-05） */
    {
      id: "unsynced-client",
      title: "有未同步更改 · 浏览器生成的格式",
      note: "rulings §4.18 UX-05、50/04 §8.3：打开对话框时就判——本端有 3 项更改还没获服务端确认：选项页顶部一行说明（InspectorNotice：警告色图标 + 主文字色第一句「有 3 项更改还没同步」+ 次级文字「导出将包含本地最新内容，可能与其他协作者看到的版本不同」；对话框里不放横幅），条数随同步实时变，归零时说明行消失、底栏回到「取消 / 导出」。浏览器生成的格式（pptx、PNG、SVG）底栏换成「仍要导出」（次）+「等待同步」（主），× / Esc 关闭。左栏同步状态行与第 1 批同一格式「同步中 N%」（03-02 §3.1、main-states.syncing；不另造「同步中…」）：百分比是这一批待同步更改里已获服务端确认的比例——3 项都未确认时「同步中 0%」，剩 2 项 33%、剩 1 项 67%，归零回到「✓ 已同步」",
      editor: { ...UNSYNCED, data: seed({ unsynced: 3 }) },
    },
    {
      id: "waiting-sync",
      title: "等待同步",
      note: "点「等待同步」：对话框停在等待态——加载行「正在同步 2 项更改…」（DS-53 转圈 + 一句话，条数实时变）+ 下一行「同步完成后将自动开始导出。」（与加载行的文字左对齐），底栏只有「取消」；归零后自动进入生成中（Session.flush，50/04 §8.3）。「取消」、Esc、× 都是取消这次导出、回到选项（逐层退出，不越级关闭）——所以这一阶段（与排队、生成中）标题栏 × 的读屏名与工具提示写「取消导出 Esc」（kit Dialog closeLabel），名字与它做的事一致，选项页、失败与完成时仍是「关闭」。左栏同步状态行「同步中 33%」（这一批 3 项已确认 1 项）。演示：第一次点按或按键后开始倒数，状态行随之走到 67%，再回到「✓ 已同步」",
      editor: { ...UNSYNCED, data: seed({ phase: "waiting", unsynced: 2 }) },
    },
    {
      id: "unsynced-offline",
      title: "有未同步更改 · 不能同步时",
      note: "不能同步时（离线、重连中、登录已过期、协同已暂停）：说明行多一句原因，「等待同步」留在原位不可用、工具提示同一句——离线「恢复连接后才能同步」、重连中「重新连接后才能同步」、登录已过期「重新登录后才能同步」、协同已暂停「协同已暂停，刷新后才能同步」；浏览器生成的格式仍可「仍要导出」，服务端格式只剩「取消」。编辑器上照常是第 1 批的离线横幅与同步状态行「离线 · 3 项待同步」",
      editor: {
        rail: { status: STATUS.offline },
        banner: <OfflineBanner />,
        inspector: { collaborators: { people: [ME] } },
        data: seed({ unsynced: 3, sync: "offline" }),
      },
    },

    /* ---------------------------------------------------------------- 生成、失败与完成 */
    {
      id: "generating",
      title: "生成中（浏览器）",
      note: "生成中（浏览器）：正文换成文件名（12px 500）· 阶段文案 + 百分比 · 确定态进度条（kit Progress，进度不用强调色）——pptx「正在写入幻灯片…」→「正在重新打包未修改的部件…」，多页图片「正在生成第 3 / 6 页…」；导出在 Worker 里跑、不改文档（PRD OF-18）。文件名一行：放不下时中间省略——开头照常、末尾保留扩展名与它前面 6 个字，完整名进工具提示（title），读屏念全名（设计 07 §7、03-01「文件名超长」；与导入页、导出完成的轻提示同一个件，取代原「文件名整段不折行」）。底栏只有「取消」：rulings §4.25 DS-101——「取消」、Esc、× 等同，停掉这次导出（浏览器停 Worker；服务端格式调导出取消端点）、回到选项、焦点落在「导出」，不做后台继续；这一阶段 × 的读屏名与工具提示是「取消导出 Esc」（同 waiting-sync）。点遮罩不关闭（kit Dialog dismissOnOutside，等待同步、排队同此）：误点遮罩不丢掉这次导出。读屏：进入生成中 polite 播报一次「正在导出「文件名」」（文件名加书名号，同轻提示「已导出「X」」），逐页与百分比不播报，完成由轻提示播报。演示：第一次点按或按键后走完，按 DS-100 关闭对话框并出轻提示",
      editor: { data: seed({ phase: "generating", progress: 58 }) },
    },
    {
      id: "failed",
      title: "导出失败",
      note:
        "导出失败：正文换成整块状态（kit PanelState：危险色图标 +「导出没有完成」+ 按错误码的原因，如「生成文件时超时，请重试；文档本身不受影响」/「服务暂时不可用，请稍后重试」+ 次按钮「重试」），底栏「关闭」；不影响文档编辑。「重试」用同样的格式与范围重新生成，焦点交给「取消」。" +
        "浏览器生成的图片导出（M2 的 PNG / SVG）某一页走了运行时页级回退（渲染出错、画成「此页内容暂时无法显示」）时，这次导出同样进这一态，不把一时的占位写进文件；整页无法解析的保真占位是确定内容，照常导出（rulings §4.25 TB-166，前端 50/18 EXP-03；服务端格式同一口径，TB-157）。" +
        "原因句按错误码（前端 50/15 §4.3，设计 03-22 §6）：页面渲染出错（render.page_failed，浏览器生成与服务端格式同一句）写「有一页暂时无法生成，请重试；文档本身不受影响」（TB-173）；服务端格式（M3）单页超时（headless.render_timeout）写「生成文件时超时，请重试；文档本身不受影响」（TB-175）——样张画的仍是超时这一句",
      editor: { data: seed({ phase: "failed" }) },
    },
    {
      id: "exported-toast",
      title: "完成 · 关闭并轻提示",
      note: "rulings §4.25 DS-100：文件就绪即开始下载并关闭对话框，焦点回到打开前的位置（从主菜单打开的回主菜单按钮，按 ⇧⌘E 打开的回画布）；画布底部、工具条上方一条轻提示「已导出「2026 年 Q2 业绩汇报.pptx」」（中性、无图标；约 5 秒后自己收起，悬停或焦点在里面时停住，同页级提示条；文件名过长时中间省略、保留扩展名，同 generating）。读屏：这条轻提示自己是播报区（role=status，Toasts 容器的直接子项），只经这一条通道播报一次——同第 2 批定的轻提示结构，外面不再套非播报区的包装。对话框里不设「完成」态，也不写「下载链接 1 小时内有效」（GET /exports/:jobId 每次现签地址，60/15 §3.9）。之后再开「文件 › 导出…」沿用这次的格式与范围（D17）。演示不真的下载文件。未采纳的「停在导出完成」见 alt-done-state",
      editor: { data: seed({ open: false, toast: { name: "2026 年 Q2 业绩汇报.pptx" } }) },
    },
    {
      id: "degraded-note",
      title: "文档有无法显示的内容",
      note: "PRD 07 G-03：文档有无法显示 / 无法解析的内容时，底部说明行按格式写——PNG / SVG / PDF「第 7 页有 1 处内容无法显示，PNG 中会按占位画出」，pptx「…，导出时原样写回」（取代 03-22 原「未修改的内容将原样保留 [查看导入详情]」）；右侧「查看保真报告」（与检查器「保真详情」同一颗：次按钮 + 外链图标）先关对话框、再打开整栏保真报告（样张里经底座命令 file.fidelity 转到 fidelity.report）。文档同第 2 批 fidelity（第 7 页瀑布图占位，左栏第 7 页警告角标）；8 页都导出，范围下一行照常写打包",
      editor: { ...DEGRADED, data: seed({ format: "png", degraded: { count: 1, pages: [7] } }) },
    },
    {
      id: "no-permission",
      title: "查看者 · 导出不可用",
      note: `查看者（没有 doc.export，PRD 03 §1、rulings §4.12 U-09）：主菜单「文件 › 导出…」留在原位、不可用，右侧写「只有查看权限」——与同一菜单「插入」「排列」的原因同一句（FE-06，第 1 批 main-states.viewer 的写法；不另造「导出权限」这个用户看不到的概念），快捷键提示让位给原因、⇧⌘E 无效；「保真报告」照常。这是改第 1 批 03-02 §2.3「文件照常」的写法（rulings §4.25 DS-105）：底座主菜单按模式与编辑权限置灰（kit exportReasonOf，2026-10-22 第 3 批转正并入），第 1 批 main-states.viewer 与第 2 批只读形态的主菜单随之改。${PINS_NOTE}；工具条是只读浏览的浏览条（上一处 / 下一处评论 ┊「只读浏览中」，data.role viewer）。别的样张里查看者选「导出…」会转到这一态（provides）。评审者见 no-permission-reviewer`,
      editor: noPermission("viewer"),
    },
    {
      id: "no-permission-reviewer",
      title: "评审者 · 导出不可用",
      note: `评审者（commenter：评审模式、没有编辑权限，同第 1 批 main-states.commenter）：「文件 › 导出…」留在原位、不可用，右侧写「需要编辑权限」（doc.export 只到编辑者）——不写「评审模式下不可用」：编辑者切到评审模式照常可以导出，原因按权限写、不按模式写；⇧⌘E 无效，「保真报告」照常。底座主菜单按 canEdit 置灰（kit exportReasonOf）。${PINS_NOTE}；工具条是评审条、没有「返回编辑」（data.role commenter）。编辑中被降权时「文件 › 导出…」同样不可用、写「需要编辑权限」（rulings §4.25 DS-105；第 1 批 main-states.degraded / degraded-menu 随之改，未保存的更改仍走横幅「导出为本地副本」，CO-05），本态不涉及`,
      editor: noPermission("commenter"),
    },

    /* ---------------------------------------------------------------- M3：服务端生成的格式与插件格式 */
    {
      id: "m3-pdf",
      title: "选 PDF · 插件格式同屏（M3）",
      note:
        "M3 后半段的选项页（2026-10-23 由评审态 icons-tabler-m3 转正，rulings §4.25 DS-143）：PDF 可用并选中——右侧「由服务端生成，页面大小与幻灯片相同」，范围四项同图片（全部页 · 当前页 · 选定页 · 自定义页码）；格式列表末尾多一行插件贡献的「Markdown（.md）」（PRD PS-14：右侧 12px Blocks +「来自「Markdown 导出」」）。" +
        `PDF 可用后图标与其余可用行同为 text-2，选中只由单选圈表达、图标不变色；${ICONS_PLUGIN}。种子与 unsynced-server、server-generating（PDF 选中）、plugin-format（插件格式）同一份，没有未同步更改，底栏「取消 / 导出」；点「导出」先排队（DS-101，同 server-generating）。${ICONS_LAYOUT}`,
      editor: { inspector: { share: undefined }, data: seed({ format: "pdf", milestone: "m3", plugin: true }) },
    },
    {
      id: "unsynced-server",
      title: "需先同步 · 服务端格式（M3）",
      note: "M3 后半段：选 PDF（服务端生成，页面大小与幻灯片相同，范围同图片）——本端有未同步更改时说明行写「需先同步 3 项更改」「PDF 由服务端生成，只包含已同步到服务器的内容」，没有「仍要导出」，底栏「取消 / 等待同步」（rulings §4.18 UX-05）；左栏同步状态行「同步中 0%」（同 unsynced-client）。M3 起 PNG「全部页」同此（DS-102）。外链图片在服务端 PDF 里一律画为占位、受限字体按只读渲染用原字体（03-13）",
      editor: { ...UNSYNCED, inspector: { share: undefined }, data: seed({ format: "pdf", milestone: "m3", unsynced: 3 }) },
    },
    {
      id: "server-generating",
      title: "服务端排队与生成中（M3）",
      note: "rulings §4.25 DS-101（M3 服务端格式）：没有未同步更改或同步完成后，先排队——加载行「正在排队，马上开始…」+ 下一行「PDF 由服务端生成，完成后自动下载。」（这张静态图画的是这一步）；作业开始后同一位置换成生成中，按作业进度显示确定态进度「正在生成第 3 / 6 页…」，画法同 export.generating（演示：第一次点按或按键后约 1.4 秒进入生成中）。两步都只有「取消」一个出口（Esc、× 等同，× 的名字是「取消导出」），取消即调导出取消端点（后端需补，同导入取消的口径；PRD 05 M3 验收 6「导出作业可取消」），不做后台继续与「重新查看」。完成按 DS-100 关闭并出带「下载」的轻提示（exported-server）。（2026-10-21 标题由「服务端生成中」改为「服务端排队与生成中」，与静态画面一致）",
      editor: { inspector: { share: undefined }, data: seed({ format: "pdf", milestone: "m3", phase: "queued" }) },
    },
    {
      id: "exported-server",
      title: "完成 · 服务端格式带「下载」（M3）",
      note: "rulings §4.25 DS-100（服务端格式）：同浏览器生成的格式一样关闭对话框、开始下载，轻提示多一个文字按钮「下载」（浏览器拦了自动下载时再点；产物保留 24 小时，每次点都现签地址，60/15 §3.9）。带按钮的这条轻提示同样自己是一个 status、只经一个播报区（同 _kit.toast 的「撤销」）",
      editor: { inspector: { share: undefined }, data: seed({ open: false, format: "pdf", milestone: "m3", toast: { name: "2026 年 Q2 业绩汇报.pdf", server: true } }) },
    },
    {
      id: "plugin-format",
      title: "插件贡献的导出格式（M3）",
      note: "PRD PS-14（M3 P1）：浏览器端注册了 canExport 的插件格式追加在格式列表末尾；右侧说明的位置写归属——12px Blocks 图标 +「来自「Markdown 导出」」（设计 06 §4 列表条目「来自〈插件名〉」、命令面板 TB-106 同一说法；图标同「更多」菜单的插件分组标题，DS-56 归属标识 12px），文字可见、并进单选项的读屏名，不再另挂只有悬停才看得到的归属图标；只导整份，范围同 pptx 一行。内置的 slideMarkdownCodec 只给自动化（SV-13 convert），不进对话框。这一态是 M3 后半段（PDF 已可用）",
      editor: { inspector: { share: undefined }, data: seed({ format: "md", milestone: "m3", plugin: true }) },
    },

    /* ---------------------------------------------------------------- 未采纳的备选（DS-63） */
    {
      id: "alt-done-state",
      title: "未采纳 · 对话框停在「导出完成」",
      note: "未采纳（DS-100 定为文件就绪即关闭对话框、画布底部轻提示，见 exported-toast）：对话框停在「导出完成」（03-22 原画法）——整块状态（成功色对勾 +「导出完成」+「2026 年 Q2 业绩汇报.pptx · 48.6 MB」：未修改的部件原样写回，大小与导入的原件 48.2 MB 相当，03-22 旧线框的 2.4 MB 作废；文件名过长时中间省略、大小照常跟在后面），底栏「完成」；服务端格式另有「下载」。比 DS-100 多一步「完成」",
      editor: { data: seed({ phase: "done", done: "dialog" }) },
    },

    /* ---------------------------------------------------------------- 未采纳的格式图标两套（DS-143、DS-63；各有 M2 与 M3 两态） */
    {
      id: "alt-icons-phosphor",
      title: "未采纳 · 格式图标 · Phosphor",
      note: `${ICONS_ALT}B · Phosphor Icons regular——${ICON_SOURCE.phosphor}；路径逐字照抄、只去掉尺寸。256 网格的填充轮廓：笔画 16 / 256（20px 时 1.25px，与 Tabler 同重，但笔画是填充出来的、不是描边，产品里不能走 icon-registry 的统一描边）；字母比 Tabler 略大、更圆，文件轮廓的折角更方，线端与拐角的处理和 lucide 不完全一样，画面重量相近。颜色 currentColor 同 Tabler（text-2、不可用 text-3）。字样同样是「PPT」（Phosphor 只有 file-ppt）；有 file-md、没有 file-json。设计系统上同样要在 04 §2.14「单一家族」下开例外，且比 Tabler 多一条：不走统一描边。${ICONS_LAYOUT}。M3 形态在 alt-icons-phosphor-m3。其余同 export.default`,
      editor: { data: seed({ iconSet: "phosphor" }) },
    },
    {
      id: "alt-icons-phosphor-m3",
      title: "未采纳 · 格式图标 · Phosphor · M3 选 PDF",
      note: `${ICONS_ALT}同 alt-icons-phosphor 一套（Phosphor），画面同 m3-pdf 只换图标：PDF 可用并选中、图标为 text-2、选中不变色；插件格式行画 Phosphor 的通用文件字形（assets/regular/file.svg）。排法、来源与代价同 alt-icons-phosphor`,
      editor: { inspector: { share: undefined }, data: seed({ format: "pdf", milestone: "m3", plugin: true, iconSet: "phosphor" }) },
    },
    {
      id: "alt-icons-bootstrap",
      title: "未采纳 · 格式图标 · Bootstrap（PPTX 字样）",
      note: `${ICONS_ALT}D · Bootstrap Icons——${ICON_SOURCE.bootstrap}；路径逐字照抄、只去掉尺寸。为「PPT」字样画的一套：查过的单色图标库里只有它有 pptx，图上写「PPTX」，与名称「PowerPoint（.pptx）」一致；另有 filetype-md、filetype-json。代价：16 格的填充造型（轮廓 1 / 16，20px 时 1.25px，与 Tabler 同重，但笔画是填充出来的、线端是平头，产品里不能走 icon-registry 的统一描边）；字样挤在左下角、压断文件轮廓，四个字母高约 5px、笔画约 1px，比 Tabler 的字小一号、细一档，1 倍屏上又细又淡、只能勉强认出。颜色 currentColor 同 Tabler（text-2、不可用 text-3）。设计系统上同 Phosphor，要在 04 §2.14「单一家族」下开例外、且不走统一描边。${ICONS_LAYOUT}。M3 形态在 alt-icons-bootstrap-m3。其余同 export.default`,
      editor: { data: seed({ iconSet: "bootstrap" }) },
    },
    {
      id: "alt-icons-bootstrap-m3",
      title: "未采纳 · 格式图标 · Bootstrap · M3 选 PDF",
      note: `${ICONS_ALT}同 alt-icons-bootstrap 一套（Bootstrap Icons），画面同 m3-pdf 只换图标：PDF 可用并选中、图标为 text-2、选中不变色；插件格式行画 Bootstrap 的通用文件字形（icons/file-earmark.svg）——按「插件没带图标就回退通用字形」的规则，不因这套恰好有 filetype-md 就画 MD。排法、来源与代价同 alt-icons-bootstrap`,
      editor: { inspector: { share: undefined }, data: seed({ format: "pdf", milestone: "m3", plugin: true, iconSet: "bootstrap" }) },
    },
  ],
})
