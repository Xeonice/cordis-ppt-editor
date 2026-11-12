import type { LayoutPickerData } from "../../kit"
import { defineScenario } from "../types"
import { THEME_SECTION } from "./slide-sections"

/**
 * 03-27 版式画廊（基于母版分组）与重置页（v3）。
 * 入口：检查器「幻灯片 3 › 版式」字段（格式类在检查器，DS-1）——点开是版式画廊，不是简单下拉；缩略图与画布空白处右键「更换版式…」打开同一个画廊
 * （更换模式，03-27 §0、03-05 右键场景）。评审、只读浏览与降权时右键里的「更换版式…」留在原位不可用（rulings §4.25 TB-17）。
 * 画廊、重置确认与轻提示都已并入底座（editor/layouts/LayoutGallery：内置分区 slide.layout，与左栏「新建幻灯片 ▾」同一个组件），这里只用 data 给各状态的初值。
 * 示例：第 3 页「关键指标」用 Office 母版的「仅标题」；文档另有从模板导入的「简约」母版（尚无页面使用）。
 */

const pd = (data: LayoutPickerData): Record<string, unknown> => ({ lpUnmatched: 3, ...data })

export default defineScenario({
  id: "layout-picker",
  title: "版式画廊与重置",
  specs: ["03-27"],
  batch: 1,
  summary: "检查器「版式」弹出按母版分组的版式画廊（搜索、跨母版提示），左下「重置为版式默认」二次确认 + 可撤销轻提示",
  editor: {
    slide: 3,
    stage: { cursor: false },
    inspector: { sections: ["slide.layout", THEME_SECTION, "slide.background", "slide.playback"] },
  },
  states: [
    {
      id: "default",
      title: "版式画廊 · 多母版分组",
      note: "03-27 §1：当前页所用母版「Office」置顶并标注，「与当前页相同」只在这一组、默认高亮；导入的「简约」组标「导入」，组标题下写明会同时切换母版；左下「重置为版式默认…」与右侧「取消 / 应用版式」分开",
      editor: { data: pd({ lpOpen: true }) },
    },
    {
      id: "cross-master",
      title: "选中其它母版的版式",
      note: "03-27 §2：选中「简约 › 标题和内容」——应用后本页的版式、所属母版与主题解析链在一个事务里一起切换，可一步撤销",
      editor: { data: pd({ lpOpen: true, lpSelected: "simple-title-content" }) },
    },
    {
      id: "search",
      title: "搜索过滤",
      note: "03-27 §1：按名称模糊过滤全部分组；Esc 先清空搜索再关闭",
      editor: { data: pd({ lpOpen: true, lpQuery: "标题" }) },
    },
    {
      id: "no-match",
      title: "搜索无结果",
      note: "03-27 §5：0 命中的分组连同标题隐藏，全部无匹配时正文显示「未找到匹配的版式」",
      editor: { data: pd({ lpOpen: true, lpQuery: "图表" }) },
    },
    {
      id: "single-master",
      title: "只有一个母版",
      note: "03-27 §4：单母版文档退化为扁平网格，不显示分组标题与「会同时切换母版」提示",
      editor: { data: pd({ lpOpen: true, lpSingle: true }) },
    },
    {
      id: "deleted",
      title: "版式刚被他人删除",
      note: "03-27 §6：画廊打开期间协作者删掉了「比较」——卡片置灰并标「已被删除」，点击无效，下次打开时消失",
      editor: { data: pd({ lpOpen: true, lpDeleted: ["office-comparison"] }) },
    },
    {
      id: "mismatch",
      title: "应用后有元素不匹配",
      note: "03-27 §4（rulings §4.10 Q13）：改成「标题和内容」后 3 张指标卡匹配不到占位符，原位保留为普通形状，轻提示带「撤销」（5 s）；检查器字段已显示新版式",
      editor: { data: pd({ lpApplied: "office-title-content", lpToast: "mismatch" }) },
    },
    {
      id: "reset-confirm",
      title: "重置占位符 · 确认",
      note: "03-27 §3：二次确认（D9 显式例外，Q16）带当前版式预览；只恢复占位符的位置与样式，新增的形状、图片与页面背景不受影响",
      editor: { data: pd({ lpReset: true }) },
    },
    {
      id: "reset-done",
      title: "重置后可撤销",
      note: "03-27 §3：确认后给可撤销轻提示「已重置占位符属性」（5 s）",
      editor: { data: pd({ lpToast: "reset" }) },
    },
    {
      id: "readonly",
      title: "评审模式 · 画廊入口不出现",
      note: "03-27 §4：评审模式下检查器只显示当前版式，没有画廊入口；「版式」节标题右侧的「编辑版式」留在原位、不可用（DS-147），原因同主菜单「母版视图」；缩略图右键的「更换版式…」不可用（留在原位，原因写在菜单顶部一行「评审模式下不可用」，03-05、TB-17、TB-22）；工具条换成评审条、左栏不提供新建（与 03-02 评审模式同一外壳）",
      // mode = review：评审条、左栏不提供新建、检查器只读并注明（底座缺省）；内置「幻灯片」各节在只读时只写当前值，没有画廊与「调整主题」入口
      editor: { mode: "review", inspector: { sections: ["slide.layout", "slide.theme", "slide.background", "slide.playback"] } },
    },
  ],
})
