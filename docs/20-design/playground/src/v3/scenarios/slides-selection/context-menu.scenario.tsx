import { ContextMenu, DEFAULT_DECK, deckWith, Guide, HoverBox, SelectionBox, slideOf, Toast, Toasts } from "../../kit"
import { placeholderOrigin } from "../text-edit/inspector"
import { defineScenario } from "../types"
import { TransformBox } from "../insert/insert-tool"
import { photoDeck, PICTURE_BOX } from "../insert/photo"
import { PosterPlay } from "../insert/picture-overlays"
import { ConnectionPoint } from "./canvas-bits"
import { CONNECTOR_SECTIONS } from "./inspector"
import { CANVAS_MENU, CONNECTOR_MENU, GROUP_MENU, IMAGE_MENU, MEDIA_MENU, readOnlyMenu, SHAPE_MENU, TEXT_MENU, thumbMenu, withComment } from "./menus"
import { railToCurrent } from "./rail"
import { AgendaArt, flowDeck } from "./slides"

/**
 * 03-05 右键菜单：画布空白处、形状、文本、缩略图、组合、图片、媒体（视频 / 音频）、连接符八种目标，评审模式（禁用而不隐藏），删除后的可撤销提示。
 * 外观用 kit ContextMenu（8px 圆角、panel 底、浮层阴影，条目 28px、快捷键右对齐、不可用项退到 text-3 并写原因）；
 * 在同一目标上再右键会在指针处重开。表格单元格、评论图钉、降级元素的变体由对应场景（03-30 / 03-06 / 03-13）负责；
 * 图片、媒体、连接符的条目依据 03-05「补充」与 03-18（图片与已有媒体）、03-17（连接符），选中框与检查器复用 image-editing / selection 场景的同一批件。
 */

/** 图片的替代文本（已填写：画布上不叠缺替代文本角标，检查器不警示——这组状态演示的是右键菜单） */
const IMAGE_ALT = "华东交付中心外景：玻璃幕墙办公楼与两侧裙楼，前方是铺装广场和行道树"
/** 第 7 页「交付流程」上连接符所在的水平线（百分比）：选中的箭头连接符在「需求评审」与「方案设计」之间 */
const LINE_Y = 55.556

/** 第 2 页要点卡（百分比）。 */
const CARD = { x: 65.5, y: 43, w: 27.5, h: 32.59 }

export default defineScenario({
  id: "context-menu",
  title: "右键菜单",
  specs: ["03-05"],
  summary: "画布空白处（含网格与参考线）、形状、文本、缩略图、组合、图片、媒体、连接符八种目标；评审模式禁用而不隐藏；删除后可撤销",
  editor: { stage: { cursor: false } },
  states: [
    {
      id: "shape",
      title: "形状",
      note: "03-05 形状选中右键：剪贴板一组在前；排列（展开）、旋转、更改形状（M2 P1，未开放前不可用并写原因）、组合（单选时不可用并写原因）；链接…（⇧⌘K）、操作设置…、编辑替代文本…、添加评论一组（rulings §4.25 TB-18）；删除单独一组用危险色；插件贡献项在末尾「插件」分组并注明来源",
      editor: {
        slide: 2,
        selection: "shape",
        layers: <ContextMenu at={{ anchor: "slide", x: 0.88, y: 0.5 }} openPath={["arrange"]} label="形状" items={SHAPE_MENU} />,
      },
    },
    {
      id: "text",
      title: "文本",
      note: "03-05 文本选中右键：剪切、复制、粘贴；粘贴为纯文本与主菜单「粘贴选项」同为 P2，留在原位、不可用、标 P2（TB-19）；链接…（命令名统一为「链接…」，TB-6）、添加评论。原「字体…」去掉：字体在检查器「文本 · 字体」分区（DS-1 格式类在检查器）",
      editor: {
        slide: 1,
        selection: "text",
        // 右键的是第 1 页的标题：来自版式「标题幻灯片」的标题占位符，检查器顶行写它继承自哪个版式（「转到版式」，rulings §4.25 DS-174；版式名、类型与索引由 placeholderOrigin 按版式算）
        data: { placeholder: placeholderOrigin(slideOf(DEFAULT_DECK, 1), "title") },
        layers: <ContextMenu at={{ anchor: "slide", x: 0.5, y: 0.45 }} label="文本" items={TEXT_MENU} />,
      },
    },
    {
      id: "canvas",
      title: "画布空白处",
      note: "03-05 画布空白处右键：粘贴、粘贴选项（P2，留在原位不可用、标 P2，03-19 §1.3）、全选；「网格与参考线」展开（与主菜单「视图」同一张清单：显示网格、显示参考线 · 吸附到网格、智能参考线即吸附到对象 · 网格间距 6 / 12 / 18 pt；标尺与添加参考线 P2 灰显占位，03-17 / 03-20）；更换版式、重置页；「添加评论 C」单独一组（与按 C 相同：选了即进入评论工具，工具条「评论」按下）；插件分组在末尾。原「幻灯片属性…」去掉：点空白处时检查器已显示幻灯片属性（2026-10-15 按 rulings §4.25 DS-44 改：在「更换版式… · 重置页…」一组与插件分组之间加「添加评论 C」）",
      editor: {
        slide: 2,
        layers: (ctx) => <ContextMenu at={{ anchor: "slide", x: 0.45, y: 0.2 }} openPath={["grid-guides"]} label="画布" items={withComment(CANVAS_MENU, () => ctx.setTool("comment"))} />,
      },
    },
    {
      id: "thumbnail",
      title: "缩略图",
      note: "03-05 / 03-14 缩略图右键：新建幻灯片（⌘M）、复制幻灯片；更换版式、隐藏幻灯片、移动（⇧⌘↑ / ⇧⌘↓，拖动排序的键盘等价）；删除幻灯片单独一组。原「切换效果…」去掉：切换效果编辑是章程非目标，只读保留",
      editor: {
        slide: 3,
        // 在任意一页缩略图上右键都会在指针处重开，并切到被点的那一页（kit ContextMenu 的锚点前缀 thumb-*）
        layers: (ctx) => (
          <ContextMenu at={{ anchor: "thumb-3", x: 0.62, y: 0.42 }} target="thumb-*" onTarget={(a) => ctx.goTo(Number(a.slice("thumb-".length)))} openPath={["move"]} label={`第 ${ctx.slide} 页`} items={thumbMenu()} />
        ),
      },
    },
    {
      id: "group",
      title: "组合",
      note: "03-05 组合右键：取消组合（⇧⌘G，拆一层）、进入组合编辑（等价于双击，03-17）、排列、添加评论、删除；检查器为组合的位置尺寸 +「包含 4 个对象 · 取消组合」",
      editor: {
        slide: 6,
        selection: "group",
        data: { count: 1, children: 4, geo: { x: "67", y: "202", w: "250", h: "221" } },
        slideOverlay: <SelectionBox box={{ x: 7, y: 37.33, w: 26, h: 40.98 }} label="250 × 221" />,
        layers: <ContextMenu at={{ anchor: "slide", x: 0.25, y: 0.6 }} label="组合" items={GROUP_MENU} />,
      },
    },
    {
      id: "image",
      title: "图片",
      note: "03-05 补充「图片右键」+ 03-18：剪贴板一组在前；裁剪、替换图片…（保留位置、尺寸与裁剪范围）、重置图片（撤销全部裁剪与调整）；排列、旋转、组合（单选不可用并写原因）；编辑替代文本…、另存为图片（P2，禁用而不隐藏）、添加评论；删除单独一组用危险色。插件只给形状贡献命令，所以没有「插件」分组；检查器是图片的四个分区",
      editor: {
        deck: photoDeck(),
        slide: 5,
        selection: "picture",
        data: { picture: { alt: IMAGE_ALT } },
        // 选中框不带尺寸角标：菜单盖在图片下沿，角标只露出一截会像渲染残影（尺寸角标在拖动 / 缩放时才有意义）
        slideOverlay: <TransformBox box={PICTURE_BOX} />,
        layers: <ContextMenu at={{ anchor: "slide", x: 0.3, y: 0.34 }} label="图片" items={IMAGE_MENU} />,
      },
    },
    {
      id: "media",
      title: "媒体（视频 / 音频）",
      note: "03-05 补充「媒体右键」+ 03-18「视频与音频（已有媒体）」：已有视频选中（海报帧 + 播放图标）；播放（↵，临时播放、不写入文档）、替换海报…（M2 P1）、裁剪（P2，禁用而不隐藏）；排列、旋转（视频没有翻转）、组合；替代文本、添加评论；删除。插入视频 / 音频仍是 P2，这里只处理文稿里已有的媒体",
      editor: {
        deck: photoDeck(),
        slide: 5,
        selection: "media",
        data: { picture: { alt: "交付中心巡览视频，约 1 分 30 秒" } },
        slideOverlay: (
          <>
            <PosterPlay box={PICTURE_BOX} />
            <TransformBox box={PICTURE_BOX} />
          </>
        ),
        layers: <ContextMenu at={{ anchor: "slide", x: 0.3, y: 0.34 }} label="视频" items={MEDIA_MENU} />,
      },
    },
    {
      id: "connector",
      title: "连接符",
      note: "03-05 补充「连接符右键」+ 03-17 G-39：选中已连接的箭头连接符（两端实心端点）；只留剪贴板、排列、组合（单选不可用）、添加评论与删除——位置与大小由两端的连接点决定，没有旋转 / 翻转，连接状态在检查器里看、拖离端点即断开，不另设菜单项；没有替代文本与插件分组",
      editor: {
        deck: flowDeck(false),
        slide: 7,
        selection: "connector",
        data: { geo: { x: "280", y: "300", w: "100", h: "0" } },
        inspector: { title: "箭头连接符", sections: CONNECTOR_SECTIONS },
        rail: { list: railToCurrent },
        slideOverlay: (
          <>
            <Guide orientation="h" at={LINE_Y} from={29.167} to={39.583} />
            <ConnectionPoint x={29.167} y={LINE_Y} kind="end" />
            <ConnectionPoint x={39.583} y={LINE_Y} kind="end" />
          </>
        ),
        layers: <ContextMenu at={{ anchor: "slide", x: 0.34, y: 0.5556 }} label="连接符" items={CONNECTOR_MENU} />,
      },
    },
    {
      id: "readonly",
      title: "评审模式 · 禁用而不隐藏",
      note: "03-05 只读：菜单与编辑模式相同，编辑类命令留在原位、禁用，同一原因写在菜单顶部一行；复制与添加评论（评审者有评论权限）照常可用。画布不画选中手柄（02 评审模式）；检查器按 DS-15 只读展示当前值（不画禁用控件、没有对齐行），顶部一行说明权限",
      editor: {
        deck: deckWith({ 2: { render: () => <AgendaArt /> } }),
        slide: 2,
        selection: "shape",
        // mode = review：评审条、左栏不提供新建、检查器只读展示当前值并注明（与 03-02 评审模式同一外壳，内置「矩形」各节的只读形态）
        mode: "review",
        slideOverlay: <HoverBox box={CARD} />,
        layers: <ContextMenu at={{ anchor: "slide", x: 0.88, y: 0.5 }} label="形状" items={readOnlyMenu(SHAPE_MENU, ["copy", "comment"], "评审模式：编辑类命令需要编辑权限")} />,
      },
    },
    {
      id: "object-deleted",
      title: "删除后可撤销",
      note: "03-05：「删除」立即执行、不弹确认，画布底部 5 秒提示「已删除 1 个对象」带「撤销」（role=status、不抢焦点，撤销可 Tab 到达）；确认对话框只留给不可撤销的销毁与会波及其他页的操作（03-05 §6）",
      editor: {
        deck: deckWith({ 2: { render: () => <AgendaArt card={false} /> } }),
        slide: 2,
        canvasOverlay: (
          <Toasts>
            <Toast action="撤销">已删除 1 个对象</Toast>
          </Toasts>
        ),
      },
    },
  ],
})
