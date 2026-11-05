import { useState } from "react"
import { Lock, X } from "lucide-react"
import { CanvasTag, deckWith, Dialog, HoverBox, ICON, IconButton, Menu, Popover, SelectionBox, slideOf, TEXT_BODY_L1, TEXT_BODY_L2, Toast, Toasts, useSceneState, type EditorCtx, type TextData, registerToolLayer } from "../../kit"
import { defineScenario, type EditorConfig } from "../types"
// 副作用导入：注册空内容占位符（placeholder-empty）的检查器分区
import "./inspector"
import { placeholderOrigin, type PlaceholderData } from "./inspector"
import {
  AgendaLinkSlide, CoverDateSlide, DT_FIELD, framePt, LAYOUT_CONTENT_PICTURE, LAYOUT_TWO_CONTENT_PICTURE, PLAN_BODY, PLAN_BODY_PT, PLAN_LONG, PLAN_TITLE_PT, PlaceholderSlide, PlanSlide,
  TEXT_EDIT_MASTERS, type AgendaOpts, type DtField, type PhLayout, type PlanOpts,
} from "./pages"
import { pctBox } from "./paper"
import { PhOverlay, PhToasts, type PhOverlayProps } from "./placeholder"
import { BULLET_MENU, DateTimePicker, DT_DEFAULT, EaFontPicker, LinkForm, LinkHoverCard, LinkToasts, NUMBERING_MENU, TextColorPicker } from "./pickers"

/**
 * 03-16 文本编辑态与格式化（v3）。
 * - 文本编辑：双击进入编辑——文本框 1px 强调色描边（无手柄）+ 插入符 + 选区；格式全部在检查器「文本」五个分区（字体 / 段落 / 颜色 / 列表 / 文本框，
 *   已并入底座的内置 text 选中态，所有场景共用；这里只用 data.text 换成正文段落的值）。
 *   v3 不再有迷你工具条：它与检查器重复（Q2），格式类入口只在检查器（DS-1）；⌘B / ⌘I / ⌘U 等快捷键照常。
 * - 空内容占位符：画布上的图标条是唯一常驻入口（另有工具条创建工具在选中空占位符时直接填入，§4.22 Q1）；检查器 placeholder-empty 只放属性。
 * - 日期和时间：工具条「更多 › 日期和时间…」或命令面板（⌘K）「插入日期和时间」，弹层锚在「更多」上方（与工具弹层同一定位规则），不移走插入符。
 * - 链接：⇧⌘K（DS-11；⌘K 是命令面板）或右键「链接…」打开「插入链接」对话框（命令名统一为「链接…」，TB-6）；编辑态悬停已有链接出小卡（Esc 收起，可前往、编辑、移除）。
 * 页面：第 6 页「下半年计划」改成两级项目符号正文；第 7 页是新建的空白页（空占位符）；第 1 页封面底行插入日期；第 2 页议程条目链接到本文稿中的页。
 * 母版：场景级的 data.mvMasters 是本场景自带的一份（pages.tsx TEXT_EDIT_MASTERS：示例文档的母版 + 第 7 页用的「内容与图片」「两栏内容与图片」），
 * 第 7 页的「版式」字段、空占位符与文本框的「转到版式」、进入后的母版视图都按它认版式（rulings §4.25 DS-174）。
 */

/* ------------------------------------------------------------------ 页面 */

const planDeck = (o: PlanOpts) => deckWith({ 6: { name: "下半年计划", layout: "标题和内容", render: (r) => <PlanSlide {...r} {...o} /> } })

const phDeck = (layout: PhLayout, drop?: string) =>
  deckWith({}, [
    {
      n: 7,
      name: "幻灯片 7",
      layout: layout.name,
      render: (r) => <PlaceholderSlide {...r} layout={layout} drop={drop} editingObj={r.selection === "text" ? layout.phs.find((p) => p.type === "obj")?.id : undefined} />,
    },
  ])

const coverDeck = (field?: string) => deckWith({ 1: { render: (r) => <CoverDateSlide {...r} field={field} /> } })

const agendaDeck = (o: AgendaOpts) => deckWith({ 2: { render: (r) => <AgendaLinkSlide {...r} {...o} /> } })

/** 空占位符页的叠加层：函数形式，只在第 7 页画；演示用的焦点 / 弹层 / 拖入只在初始状态传入 */
const phOverlay = (o: PhOverlayProps) => (ctx: EditorCtx) =>
  ctx.slide === 7 ? (
    <PhOverlay
      layout={o.layout}
      primary={o.primary}
      readOnly={o.readOnly}
      focusKind={ctx.initial ? o.focusKind : undefined}
      tableOpen={ctx.initial && o.tableOpen}
      menuOpen={ctx.initial && o.menuOpen}
      drop={ctx.initial ? o.drop : undefined}
      keyHint={ctx.initial ? o.keyHint : undefined}
    />
  ) : null

/* ------------------------------------------------------------------ 检查器数据 */

/** 编辑文字的状态：检查器用内置「文本」五个分区（底座 editor/inspector/text.tsx），值从 data.text 读 */
const textState = (text: Partial<TextData>, over: EditorConfig = {}): EditorConfig => ({
  ...over,
  selection: "text",
  data: { ...over.data, text: { ...TEXT_BODY_L2, ...text } },
})

/** 不在列表里的普通段落（封面底行、议程条目） */
const PLAIN: Partial<TextData> = { bullet: "无", numbering: "无", level: 0, autofit: "不自动调整", after: "0" }

/**
 * 空占位符检查器的数据（第 7 页左侧 / 第一栏的内容占位符）：版式名取第 7 页的版式（这两个版式在本场景自带的母版里，TEXT_EDIT_MASTERS）；
 * 检查器顶行「转到版式」按它在场景的母版里找到版式、按类型与索引选中版式上的占位符（rulings §4.25 DS-174）
 */
const PH_LEFT: PlaceholderData = { title: "内容占位符", type: "内容", idx: 1, layout: LAYOUT_CONTENT_PICTURE.name, geo: { x: 60, y: 124, w: 540, h: 360 }, layoutValues: { h: 348 } }
const PH_C1: PlaceholderData = { title: "内容占位符", type: "内容", idx: 1, layout: LAYOUT_TWO_CONTENT_PICTURE.name, geo: { x: 60, y: 124, w: 264, h: 360 } }

/**
 * 编辑文字的状态里选中的文本框来自版式的哪个占位符（检查器顶行「转到版式」的输入，rulings §4.25 DS-174）：
 * 第 6 页「下半年计划」的两级要点与第 2 页的议程列表都在版式的内容占位符里，同时选中第 6 页的标题与要点两个框时只写版式。
 * 只写哪一页、版式上的哪个占位符（id），版式名、类型与索引由 placeholderOrigin 按这一页的版式（在本场景的母版里认）算出；第 1 页底行的日期一行不是占位符，日期两态不写
 */
const PLAN_PAGE = slideOf(planDeck({}), 6)
const PH_PLAN_BODY = { placeholder: placeholderOrigin(PLAN_PAGE, "body", TEXT_EDIT_MASTERS) }
const PH_PLAN_BOTH = { placeholder: placeholderOrigin(PLAN_PAGE, undefined, TEXT_EDIT_MASTERS) }
const PH_AGENDA_BODY = { placeholder: placeholderOrigin(slideOf(agendaDeck({}), 2), "body", TEXT_EDIT_MASTERS) }

/* ------------------------------------------------------------------ 画布小件 */

/** 受限字体的一次性内联提示（03-13）：屏幕坐标、12px，同一会话每种字体只提示一次，点 × 关闭（本会话不再出现） */
function RestrictedFontNotice() {
  const [closed, setClosed] = useState(false)
  if (closed) return null
  return (
    <div
      role="status"
      onClick={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute z-20 flex h-8 -translate-x-full items-center gap-2 rounded-[8px] border border-(--v3-border) bg-(--v3-panel) pr-1 pl-2.5 text-[12px] leading-none whitespace-nowrap text-(--v3-text) shadow-(--v3-shadow)"
      style={{ left: `${PLAN_BODY.left + PLAN_BODY.width + 1.2}%`, top: "24%" }}
    >
      <Lock {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />
      <span>
        <span className="whitespace-nowrap">「方正兰亭黑」</span>仅授权查看，编辑时显示为<span className="whitespace-nowrap">「微软雅黑」</span>
      </span>
      <IconButton label="关闭提示" size={24} onClick={() => setClosed(true)}>
        <X {...ICON} />
      </IconButton>
    </div>
  )
}

/** 选中标题与正文两个文本框时的外接框（pt） */
const MIXED_UNION = (() => {
  const t = framePt(PLAN_TITLE_PT)
  const b = framePt(PLAN_BODY_PT)
  return { x: t.x, y: t.y, w: Math.max(t.x + t.w, b.x + b.w) - t.x, h: b.y + b.h - t.y }
})()

/** 议程第 n 行条目文字的下缘（%）：行高 7.2cqw、字号 3cqw、从 19cqw 起 */
const agendaTextBottom = (row: number) => ((19 + row * 7.2 + 2.1 + 3) / 56.25) * 100

/** 日期和时间弹层（锚在「更多」上方）：插入后弹层收起，封面底行出现字段，轻提示带撤销 */
function DateTimeLayer({ open: controlled, onOpenChange }: { open?: boolean; onOpenChange?: (v: boolean) => void } = {}) {
  const [, setField] = useSceneState<DtField | null | undefined>(DT_FIELD, undefined)
  const [inner, setInner] = useState(true)
  const open = controlled ?? inner
  return (
    <Popover anchor="tool-more" label="日期和时间" open={open} onOpenChange={(v) => (setInner(v), onOpenChange?.(v))} className="w-[332px] p-3">
      <DateTimePicker onInsert={(f) => setField(f)} />
    </Popover>
  )
}

// 文本编辑态里真实工具条「更多 › 日期和时间…」打开同一个弹层（底座按 more:date 取）
registerToolLayer("more:date", (p) => <DateTimeLayer {...p} />)

/**
 * 插入日期之后的轻提示（03-16 §7.2；v3 没有状态栏，DS-6）：日常可撤销操作，中性、只给「撤销」（去掉字段），不带对勾与 ×，
 * 不露 datetime1 这类内部格式代码——用户看到的是「已插入自动更新的日期「2026/9/30」」。initial：状态本身已插入的字段。
 */
function DtToasts({ initial }: { initial?: DtField }) {
  // undefined = 还是状态的初值；null = 已撤销；对象 = 用户刚插入的（与封面页读同一份，见 pages.tsx DT_FIELD）
  const [cur, setField] = useSceneState<DtField | null | undefined>(DT_FIELD, undefined)
  const [hidden, setHidden] = useState<string | null>(null)
  const field = cur === undefined ? initial : cur
  if (!field || hidden === field.text) return null
  return (
    <Toasts>
      {/* 日常可撤销操作：中性提示、只给「撤销」（不带对勾与 ×，不露 datetime1 这类内部格式代码） */}
      <Toast key={field.text} action="撤销" onAction={() => setField(null)}>
        {field.auto ? "已插入自动更新的日期" : "已插入日期"}
        <span className="whitespace-nowrap">「{field.text}」</span>
      </Toast>
    </Toasts>
  )
}

/* ------------------------------------------------------------------ 场景 */

export default defineScenario({
  // 场景 id 不用「text」：旧状态 state=text（第 1 页标题的编辑态）优先解析，同名场景只写 state=text 时进不来
  id: "text-edit",
  title: "文本编辑与格式",
  specs: ["03-16"],
  summary: "编辑态、检查器字体 / 段落 / 颜色 / 列表 / 文本框分区、项目符号与编号、空内容占位符图标条、日期和时间、链接",
  editor: { stage: { cursor: false }, data: { mvMasters: TEXT_EDIT_MASTERS } },
  states: [
    /* ---------------- 文本编辑 */
    {
      id: "editing",
      title: "编辑中 · 检查器「文本」",
      note: "03-16 进入 / 编辑 / 退出：双击进入编辑，文本框 1px 强调色描边（无手柄）+ 插入符 + 选区；格式在检查器五个分区，v3 去掉迷你工具条（与检查器重复，Q2）。Esc 回到选中，点空白退出并取消选择",
      editor: textState({}, { deck: planDeck({ marks: { "1.0": { sel: [2, 7], caret: 7 } } }), slide: 6, data: PH_PLAN_BODY }),
    },
    {
      id: "bullets",
      title: "项目符号库 · 两级",
      note: "03-16 项目符号与编号：检查器「列表 › 项目符号」下拉，7 种字符 + 无 + 自定义（P2 禁用）；Tab / ⇧Tab 升降级（1–9 级），分区标题右侧显示当前级别",
      editor: textState(
        { open: "bullets" },
        {
          deck: planDeck({ marks: { "0.1": { caret: 9 } } }),
          slide: 6,
          data: PH_PLAN_BODY,
          layers: <Menu anchor="list-bullets" side="bottom" align="start" sideOffset={4} label="项目符号" className="min-w-[240px]" items={BULLET_MENU("空心圆点")} />,
        },
      ),
    },
    {
      id: "numbering",
      title: "编号库 · 起始值",
      note: "03-16 §4.6 编号：九种方案（数字、数字加括号、大写 / 小写字母、字母加括号、大写 / 小写罗马数字、中文数字、中文数字加括号，ED-04 要求 ≥ 8 种）+ 无 + 起始值；一级段落已改为「1. 2. 3.」",
      editor: textState(
        { ...TEXT_BODY_L1, bullet: "无", numbering: "1. 2. 3.", open: "numbering" },
        {
          deck: planDeck({ numbered: true, marks: { "1": { caret: 6 } } }),
          slide: 6,
          data: PH_PLAN_BODY,
          layers: <Menu anchor="list-numbering" side="bottom" align="end" sideOffset={4} label="编号" className="min-w-[240px]" items={NUMBERING_MENU("1. 2. 3.")} />,
        },
      ),
    },
    {
      id: "font",
      title: "中文字体 · 可搜索",
      note: "03-16 字符格式：西文、中文字体分开设置（东亚字体独立）；字体列表可搜索，含主题字体（标题 / 正文）、最近使用；受限内嵌字体带锁形、不能用于新文字（03-13）。弹层贴检查器左缘展开",
      editor: textState(
        { open: "font-ea" },
        {
          deck: planDeck({ marks: { "1.0": { sel: [2, 7], caret: 7 } } }),
          slide: 6,
          data: PH_PLAN_BODY,
          layers: (
            <Popover anchor="font-ea" label="中文字体" className="p-0">
              <EaFontPicker />
            </Popover>
          ),
        },
      ),
    },
    {
      id: "color",
      title: "文字颜色 · 主题色 10 × 6",
      note: "03-16 颜色选择器：主题颜色 10 × 6 明暗变体、标准色、最近使用、自定义色值；方向键在色板内移动、Enter 选择、Esc 关闭",
      editor: textState(
        { open: "color" },
        {
          deck: planDeck({ marks: { "1.0": { sel: [2, 7], caret: 7 } } }),
          slide: 6,
          data: PH_PLAN_BODY,
          layers: (
            <Popover anchor="text-color" label="文字颜色" className="p-0">
              <TextColorPicker />
            </Popover>
          ),
        },
      ),
    },
    {
      id: "mixed",
      title: "选中两个文本框 · 多个值",
      note: "03-16 字符与段落格式：文本框选中（非编辑态）时控件显示当前值，不一致的显示「多个值」（UX-10）；在其中改值即统一应用、计一个事务",
      editor: textState(
        { size: null, color: null, styles: [], bullet: "多个值", numbering: "无", level: 0, after: "6" },
        {
          deck: planDeck({}),
          slide: 6,
          data: PH_PLAN_BOTH,
          inspector: { title: "2 个文本框" },
          slideOverlay: (
            <>
              <HoverBox box={pctBox(framePt(PLAN_TITLE_PT))} />
              <HoverBox box={pctBox(framePt(PLAN_BODY_PT))} />
              <SelectionBox box={pctBox(MIXED_UNION)} label={`${Math.round(MIXED_UNION.w)} × ${Math.round(MIXED_UNION.h)}`} />
            </>
          ),
        },
      ),
    },
    {
      id: "autofit",
      title: "溢出 · 已自动缩小至 92%",
      note: "03-16 normAutofit：输入超出时文字按阶梯缩小，检查器「文本框」写明缩小比例，文本框旁出中性提示签；删减内容后自动恢复",
      editor: textState(
        {
          autofitNote: (
            <>
              文字已缩小至 92%，行距同比缩小；<span className="whitespace-nowrap">删减内容后自动恢复</span>
            </>
          ),
        },
        {
          deck: planDeck({ items: PLAN_LONG, scale: 0.92, marks: { "1.2": { caret: 12 } } }),
          slide: 6,
          data: PH_PLAN_BODY,
          slideOverlay: (
            <CanvasTag at="-translate-x-full" box={{ x: PLAN_BODY.left + PLAN_BODY.width + 1.2, y: ((PLAN_BODY.top + PLAN_BODY.height + 1.6) / 56.25) * 100 }}>
              已缩小至 92%
            </CanvasTag>
          ),
        },
      ),
    },
    {
      id: "restricted-font",
      title: "受限字体 · 编辑时替代",
      note: "03-16 / 03-13：文本进入编辑态时，若用了仅授权查看的内嵌字体，文本框上方出一次性内联提示（屏幕坐标、可关闭）；检查器中文字体显示原字体名 + 锁形，并说明替代字体",
      editor: textState(
        { restricted: { font: "方正兰亭黑", fallback: "微软雅黑" } },
        { deck: planDeck({ marks: { "1.1": { caret: 6 } } }), slide: 6, data: PH_PLAN_BODY, slideOverlay: <RestrictedFontNotice /> },
      ),
    },

    /* ---------------- 空内容占位符 */
    {
      id: "placeholder",
      title: "空占位符 · 提示文字与图标条",
      note: "03-16 空占位符提示 + G-80：新建的「内容与图片」页；标题、内容占位符显示灰色提示（不计字数、不导出）；内容占位符四个图标、图片占位符一个图标，画在叠加层、按屏幕尺寸绘制，缩略图里没有。单击提示文字进入编辑",
      editor: { deck: phDeck(LAYOUT_CONTENT_PICTURE), slide: 7, slideOverlay: phOverlay({ layout: LAYOUT_CONTENT_PICTURE }), canvasOverlay: <PhToasts /> },
    },
    {
      id: "placeholder-selected",
      title: "选中空内容占位符",
      note: "03-16 检查器 placeholder-empty（R-d-72）：v3 只留属性两组——占位符（类型、索引、来自版式）与位置与大小（逐项继承 / 本页修改可重置）；「插入到占位符」按钮组不进检查器（插入不是属性，DS-1；与图标条、工具条重复，Q2）",
      editor: {
        deck: phDeck(LAYOUT_CONTENT_PICTURE),
        slide: 7,
        selection: "placeholder-empty",
        data: { placeholder: PH_LEFT },
        slideOverlay: phOverlay({ layout: LAYOUT_CONTENT_PICTURE }),
        canvasOverlay: <PhToasts />,
      },
    },
    {
      id: "placeholder-focus",
      title: "图标条 · 键盘焦点与禁用原因",
      note: "03-16 键盘聚焦顺序：整条一个 Tab 停靠点（APG Toolbar），←/→ 在图标间移动；焦点停在禁用的「图表 M3」上，原因提示自动展开；操作说明用画布提示签（v3 无状态栏）",
      editor: {
        deck: phDeck(LAYOUT_CONTENT_PICTURE),
        slide: 7,
        selection: "placeholder-empty",
        data: { placeholder: PH_LEFT },
        slideOverlay: phOverlay({ layout: LAYOUT_CONTENT_PICTURE, focusKind: "chart", keyHint: "← → 在图标间移动 · Enter 插入 · Esc 回到占位符" }),
        canvasOverlay: <PhToasts />,
      },
    },
    {
      id: "placeholder-collapsed",
      title: "窄栏 · 折叠为「插入 ▾」",
      note: "03-16 图标条折叠：版式「两栏内容与图片」每栏 264 pt，屏幕上放不下整条（四周各留 8px），两个内容占位符折叠为「插入 ▾」，菜单里是同一组条目、禁用项挂 M3 / P2 并说明原因；单图标的图片占位符仍放得下",
      editor: {
        deck: phDeck(LAYOUT_TWO_CONTENT_PICTURE),
        slide: 7,
        selection: "placeholder-empty",
        data: { placeholder: PH_C1 },
        slideOverlay: phOverlay({ layout: LAYOUT_TWO_CONTENT_PICTURE, primary: "c1", menuOpen: true }),
        canvasOverlay: <PhToasts />,
      },
    },
    {
      id: "placeholder-table",
      title: "占位符 · 表格网格",
      note: "03-16 填入（用户裁决 Q2）：点「表格」在图标旁弹出与工具条「表格」同一网格（悬停 3 行 × 4 列）；选定即填入占位符、宽取占位符框宽，一个撤销步",
      editor: {
        deck: phDeck(LAYOUT_CONTENT_PICTURE),
        slide: 7,
        selection: "placeholder-empty",
        data: { placeholder: PH_LEFT },
        slideOverlay: phOverlay({ layout: LAYOUT_CONTENT_PICTURE, tableOpen: true }),
        canvasOverlay: <PhToasts />,
      },
    },
    {
      id: "placeholder-drop",
      title: "图片拖入空占位符",
      note: "03-16 拖入图片：指针下的图片占位符 2px 强调色实线框 + 6% 底（画在纸面）；「松开以填入图片」与拖动缩略图「+ 1」按屏幕尺寸绘制；其他占位符的图标条不变",
      editor: { deck: phDeck(LAYOUT_CONTENT_PICTURE, "right"), slide: 7, slideOverlay: phOverlay({ layout: LAYOUT_CONTENT_PICTURE, drop: "right" }), canvasOverlay: <PhToasts /> },
    },
    {
      id: "placeholder-readonly",
      title: "评审模式 · 只读",
      note: "03-16 边界情况：只读 / 评审不出图标条，只留虚线框与提示文字，选中框不画手柄；检查器「位置与大小」只读；没有创建工具（03-04「只读」），工具条换成评审条、左栏不提供新建（与 03-02 评审模式同一外壳）",
      editor: {
        mode: "review",
        deck: phDeck(LAYOUT_CONTENT_PICTURE),
        slide: 7,
        selection: "placeholder-empty",
        data: { placeholder: PH_LEFT },
        slideOverlay: phOverlay({ layout: LAYOUT_CONTENT_PICTURE, readOnly: true }),
      },
    },

    /* ---------------- 日期和时间 */
    {
      id: "datetime",
      title: "日期和时间 · 格式选择器",
      note: "03-16 G-81：编辑文字时从工具条「更多 › 日期和时间…」（或 ⌘K）打开，弹层锚在「更多」上方；中文 13 种格式默认 datetime1，单击选中、双击插入；「自动更新」决定插入字段还是固定文本；插入符留在原处",
      editor: textState(
        { ...PLAIN, size: "18", color: { hex: "#8A93A6" } },
        {
          deck: coverDeck(),
          slide: 1,
          layers: <DateTimeLayer />,
          canvasOverlay: <DtToasts />,
        },
      ),
    },
    {
      id: "datetime-field",
      title: "已插入日期字段",
      note: "03-16 §7.2 插入之后：slide.insertField（datetime1），字段带墨色 8% 浅灰底纹（只在编辑态画），插入符在字段之后；中性轻提示「已插入自动更新的日期「2026/9/30」」带「撤销」，不露 datetime1 这类内部格式代码（v3 无状态栏）",
      editor: textState(
        { ...PLAIN, size: "18", color: { hex: "#8A93A6" } },
        {
          deck: coverDeck(DT_DEFAULT.text),
          slide: 1,
          canvasOverlay: <DtToasts initial={{ ...DT_DEFAULT, auto: true }} />,
        },
      ),
    },

    /* ---------------- 链接（「插入链接」对话框，TB-6） */
    {
      id: "link-dialog",
      title: "链接 · 本文稿中的页",
      note: "03-16 G-34：⇧⌘K（DS-11）或右键「链接…」；选「本文稿中的页」时地址栏换成缩略图选择（真实渲染）；确认后文字变为链接样式",
      editor: textState(
        { ...PLAIN, size: "28", color: { hex: "#141B2D" } },
        {
          deck: agendaDeck({ marks: { 关键指标: { sel: [0, 4] } } }),
          slide: 2,
          data: PH_AGENDA_BODY,
          layers: (
            <Dialog title="插入链接" secondary={{ label: "取消" }} primary={{ label: "插入" }}>
              <LinkForm type="slide" text="关键指标" />
            </Dialog>
          ),
        },
      ),
    },
    {
      id: "link-invalid",
      title: "链接 · 不安全的地址",
      note: "03-16 校验：javascript: / data: 等不在白名单的协议内联报错、不能确定；只支持 http、https、mailto、tel",
      editor: textState(
        { ...PLAIN, size: "28", color: { hex: "#141B2D" } },
        {
          deck: agendaDeck({ marks: { 关键指标: { sel: [0, 4] } } }),
          slide: 2,
          data: PH_AGENDA_BODY,
          layers: (
            <Dialog
              title="插入链接"
              secondary={{ label: "取消" }}
              // 地址不合法时「确定」不可用（kit Button 的不可用态：panel-2 底 + text-3，仍可聚焦、工具提示写原因）
              primary={{ label: "插入", disabled: true, reason: "只支持 http、https、mailto、tel 地址" }}
            >
              <LinkForm type="url" address="javascript:alert(document.cookie)" invalid text="关键指标" />
            </Dialog>
          ),
        },
      ),
    },
    {
      id: "link-hover",
      title: "编辑态 · 悬停已有链接",
      note: "03-16 编辑态悬停已有链接：小卡写明目标页与「⌘ 点击前往」（单击目标即前往），可编辑（⇧⌘K）、移除（可撤销），Esc 收起；mailto / tel 链接改为显示目标与「复制」，应用内不打开",
      editor: textState(
        { ...PLAIN, size: "28", color: { hex: "#141B2D" } },
        {
          deck: agendaDeck({ links: { 关键指标: "ok" }, marks: { 下半年计划: { caret: 5 } } }),
          slide: 2,
          data: PH_AGENDA_BODY,
          slideOverlay: <LinkHoverCard target="第 3 页 · 关键指标" label="关键指标" page={3} style={{ left: "13%", top: `calc(${agendaTextBottom(0)}% + 8px)` }} />,
          canvasOverlay: <LinkToasts />,
        },
      ),
    },
    {
      id: "link-broken",
      title: "链接目标页已删除",
      note: "03-16 边界情况：链接到的页已被删除，链接显示为失效态（虚线危险色下划线），悬停小卡提示「目标页已被删除，请重新设置」",
      editor: textState(
        { ...PLAIN, size: "28", color: { hex: "#141B2D" } },
        {
          deck: agendaDeck({ links: { 关键指标: "ok", 区域分布: "broken" }, marks: { 营收趋势: { caret: 4 } } }),
          slide: 2,
          data: PH_AGENDA_BODY,
          slideOverlay: <LinkHoverCard target="第 5 页" label="区域分布" broken style={{ left: "13%", top: `calc(${agendaTextBottom(2)}% + 8px)` }} />,
          canvasOverlay: <LinkToasts />,
        },
      ),
    },
  ],
})
