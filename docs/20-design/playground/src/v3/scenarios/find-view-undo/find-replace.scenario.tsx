import { DECK_PINS, deckWith, Toast, Toasts } from "../../kit"
import { defineScenario } from "../types"
import { FindHits, FindPanel, FindRail, REVENUE_HITS, type FindState } from "./FindReplace"
import { TrendSlide } from "./slides"

/**
 * 03-21 查找与替换（v3）。入口：⌘F / ⇧⌘H（DS-16；Windows / Linux 为 Ctrl+H）、主菜单「编辑 › 查找… / 替换…」、命令面板（DS-1：不在工具条、不在检查器）。
 * 各状态的查找初值写在 data.find（面板、命中高亮与左栏标记读同一份场景状态）。
 * 面板是画布右上角的浮动面板（FloatingPanel，位置固定、不可拖动，横幅出现时自动下移），命中高亮画在幻灯片上，
 * 命中所在页在左栏缩略图右下角打中性小标记（与右上角的评论计数区分）。查询词用示例文档里真实出现 6 次的「营收」。
 * 编辑模式照常显示评论钉（rulings §4.25 DS-43，2026-10-15）：场景级 stage.commentPins，底座画布在第 4 页画示例文档的 3 枚评论钉（点钉切到检查器「评论」页签）。
 */

/** 「全部替换」后的文档：第 4 页的标题与正文跟着变（缩略图同步）；版面与图表不变，评论仍锚在原处，钉照常画（pins 沿用第 4 页的同一组，DS-43）。 */
const REPLACED_DECK = deckWith({ 4: { name: "收入趋势", render: () => <TrendSlide word="收入" />, pins: DECK_PINS[4] } })

const replaced: Partial<FindState> = { replace: true, replaceWith: "收入", index: 0 }

export default defineScenario({
  id: "find-replace",
  title: "查找与替换",
  specs: ["03-21"],
  summary: "画布右上角浮动面板：命中高亮与跳页、缩略图命中标记、替换与全部替换、无结果与隐藏页",
  editor: { slide: 4, stage: { cursor: false, commentPins: true } },
  states: [
    {
      id: "default",
      title: "查找 · 有匹配",
      note: "⌘F 打开：计数 3 / 6，当前命中（第 4 页标题）浅强调色底，本页其余命中描边；命中所在的第 2–5 页缩略图右下角打放大镜计数标记。↵ / ⇧↵ 跳转会自动换页。画布上照常画第 4 页的 3 枚评论钉（编辑模式照常显示评论钉）（2026-10-15 按 rulings §4.25 DS-43 改）",
      editor: {
        canvasOverlay: <FindPanel hits={REVENUE_HITS} />,
        slideOverlay: () => <FindHits hits={REVENUE_HITS} />,
        rail: { list: <FindRail hits={REVENUE_HITS} /> },
      },
    },
    {
      id: "replace",
      title: "查找 + 替换",
      note: "⇧⌘H（Windows / Linux 为 Ctrl+H，DS-16）打开或点 › 展开替换行：「替换」只换当前命中，「全部替换」作用于全文档、一个撤销步（M2 不提供仅当前页）。画布上照常画第 4 页的 3 枚评论钉（编辑模式照常显示评论钉）（2026-10-15 按 rulings §4.25 DS-43 改）",
      editor: {
        data: { find: { replace: true, replaceWith: "收入" } },
        canvasOverlay: <FindPanel hits={REVENUE_HITS} />,
        slideOverlay: () => <FindHits hits={REVENUE_HITS} />,
        rail: { list: <FindRail hits={REVENUE_HITS} /> },
      },
    },
    {
      id: "no-match",
      title: "无结果",
      note: "计数 0 / 0，上一个 / 下一个不可用，面板底部一行「未找到匹配内容」；画布与缩略图不画任何命中标记。画布上照常画第 4 页的 3 枚评论钉（编辑模式照常显示评论钉）（2026-10-15 按 rulings §4.25 DS-43 改）",
      editor: {
        data: { find: { query: "预算", index: 0 } },
        canvasOverlay: <FindPanel hits={[]} />,
      },
    },
    {
      id: "searching",
      title: "搜索中",
      note: "全文搜索超出 200 ms 预算时，计数区显示「搜索中…」、放大镜换成转圈，而不是卡住无反馈（OF-16 / ED-13）。画布上照常画第 4 页的 3 枚评论钉（编辑模式照常显示评论钉）（2026-10-15 按 rulings §4.25 DS-43 改）",
      editor: {
        data: { find: { query: "同比", index: 0 } },
        canvasOverlay: <FindPanel hits={[]} searching />,
      },
    },
    {
      id: "replaced",
      title: "全部替换完成",
      note: "全部替换是一个事务：轻提示「已替换 6 处」+ 撤销；第 4 页标题与正文已变为「收入」，查询词「营收」随之无结果。画布上照常画第 4 页的 3 枚评论钉（编辑模式照常显示评论钉）（2026-10-15 按 rulings §4.25 DS-43 改）",
      editor: {
        deck: REPLACED_DECK,
        data: { find: replaced },
        canvasOverlay: (
          <>
            <FindPanel hits={[]} />
            <Toasts>
              <Toast action="撤销">
                已替换 6 处
              </Toast>
            </Toasts>
          </>
        ),
      },
    },
    {
      id: "replaced-partial",
      title: "全部替换 · 部分未替换（协同）",
      note: "提交前目标文字已被他人删除的位置跳过：「已替换 4 处（2 处因内容变化未替换）」，警告色图标，仍可一步撤销。画布上照常画第 4 页的 3 枚评论钉（编辑模式照常显示评论钉）（2026-10-15 按 rulings §4.25 DS-43 改）",
      editor: {
        deck: REPLACED_DECK,
        data: { find: replaced },
        canvasOverlay: (
          <>
            <FindPanel hits={[]} />
            <Toasts>
              <Toast tone="warning" action="撤销">
                已替换 4 处（2 处因内容变化未替换）
              </Toast>
            </Toasts>
          </>
        ),
      },
    },
    {
      id: "hidden-slide",
      title: "命中位于隐藏页",
      note: "计数包含隐藏页；跳到第 5 页（已隐藏：缩略图变淡、页码加斜线并带斜线眼睛图标，检查器「放映」节「放映时跳过此页」已勾选，03-14、DS-25）时面板底部提示「该内容位于已隐藏的幻灯片」，不自动取消隐藏",
      editor: {
        slide: 5,
        // slideHidden：无选中检查器「放映」节的「放映时跳过此页」与左栏的隐藏页画法是同一个状态（DS-25）
        data: { find: { index: 5 }, slideHidden: true },
        canvasOverlay: <FindPanel hits={REVENUE_HITS} hidden={[5]} />,
        slideOverlay: () => <FindHits hits={REVENUE_HITS} />,
        rail: { list: <FindRail hits={REVENUE_HITS} hidden={[5]} /> },
      },
    },
  ],
})
