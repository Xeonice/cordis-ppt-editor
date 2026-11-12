import { Avatar, LI, ME, PopoverTitle, reasonTip, Tag, Tip, WANG, withReason, ZHANG, type Person } from "../../kit"
import { useFollowOffReason } from "../../editor/chrome"
import { CHEN, LIU, SUN, ZHAO } from "./presence"

/**
 * main-states 场景的局部面板：在线列表（+N 展开）与打开失败页。
 * 其余原来在这里复刻的件已并入底座：
 * - 不可用 / 只读的「幻灯片」各节 → 内置分区按 InspectorCtx.disabled（inspector.disabled / locked）与 readOnly 自己切换外观；
 * - 打开中的整栏不可用 → inspector.locked；头像组与「+N」→ inspector.collaborators；没有「评论」页签 → inspector.commentsTab: false；
 * - 左栏不可新建 / 不提供新建 / 视图切换不可用 → rail.newSlide、rail.viewToggle（评审 / 浏览模式缺省不提供新建）；
 * - 主菜单打开时按钮的按下态 → kit 锚定菜单自动给锚点加 data-v3-open；主菜单条目 → kit MainMenuLayer（统一条目，含模式与母版视图）；
 * - 网格左上胶囊的同步状态与网格里的横幅 → 底座按 rail.status、banner 渲染。
 */

/** 8 人在线：头像组显示的 5 位 + 折叠的 3 位。 */
export const ONLINE_SHOWN: Person[] = [ME, WANG, LI, ZHANG, CHEN]
export const ONLINE_FOLDED = 3

const ROSTER: { p: Person; role: string; page: number; self?: boolean }[] = [
  { p: ME, role: "所有者", page: 2, self: true },
  { p: WANG, role: "编辑者", page: 2 },
  { p: CHEN, role: "编辑者", page: 2 },
  { p: LI, role: "编辑者", page: 2 },
  { p: ZHANG, role: "评审者", page: 4 },
  { p: LIU, role: "编辑者", page: 5 },
  { p: ZHAO, role: "查看者", page: 1 },
  { p: SUN, role: "查看者", page: 1 },
]

/**
 * 「+N」展开的在线列表（05 §1a）：逐行头像 + 姓名 + 角色 + 所在页；自己在最上，其余按最近有编辑活动排序；
 * 点按某人进入跟随模式（自己那一行不可点）。宽度最窄 256、按内容加宽（rulings §4.25 DS-132：有人开着多个窗口时那一行多出「N 个窗口」，第 3 批 presence-scale 同一画法；
 * 本列表 8 行都放得下 256，画面不变）。
 * 母版视图里各行的「跟随」留在原位、不可用，同头像组（rulings §4.25 DS-177、TB-203；editor/chrome.tsx useFollowOffReason）：外观不变、只去掉悬停底色，
 * aria-disabled，读屏名在原来的后面加「（母版视图下不可用）」，工具提示「跟随 〈姓名〉 · 母版视图下不可用」，点了不跟随；
 * 底部的说明随之改写「母版视图下不能跟随协作者」（普通视图仍是「点按协作者即可跟随其视图」；设计 03-26 §1.1）
 */
export function PresenceList() {
  const off = useFollowOffReason()
  return (
    <div className="flex w-max min-w-[256px] flex-col">
      <div className="flex h-8 items-center justify-between px-2">
        <PopoverTitle>{`${ROSTER.length} 人在线`}</PopoverTitle>
        <span className="text-[12px] leading-none text-(--v3-text-2)">最近编辑的在前</span>
      </div>
      <ul className="flex flex-col">
        {ROSTER.map((r) => {
          const inner = (
            <>
              <Avatar name={r.p.name} tone={r.p.tone} size={20} />
              <span className="text-[12px] leading-none whitespace-nowrap text-(--v3-text)">
                {r.p.name}
                {r.self && <span className="text-(--v3-text-2)">（你）</span>}
              </span>
              <Tag>{r.role}</Tag>
              <span className="ml-auto text-[12px] leading-none whitespace-nowrap text-(--v3-text-2)">{`第 ${r.page} 页`}</span>
            </>
          )
          const label = `跟随 ${r.p.name}（${r.role}，第 ${r.page} 页）`
          return (
            <li key={r.p.name}>
              {r.self ? (
                <div className="flex h-7 items-center gap-2 px-2">{inner}</div>
              ) : off ? (
                <Tip label={reasonTip(`跟随 ${r.p.name}`, off)} side="left">
                  <button type="button" aria-label={withReason(label, off)} aria-disabled="true" onClick={(e) => e.preventDefault()} className="flex h-7 w-full items-center gap-2 rounded-[4px] px-2 text-left">
                    {inner}
                  </button>
                </Tip>
              ) : (
                <button type="button" aria-label={label} className="flex h-7 w-full items-center gap-2 rounded-[4px] px-2 text-left transition-colors hover:bg-(--v3-panel-2)">
                  {inner}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <div className="-mx-1 my-1 h-px bg-(--v3-border)" />
      {/* off 只在母版视图里有值（useFollowOffReason），这时各行都不可用，说明跟着换 */}
      <p className="px-2 pt-0.5 pb-1 text-[12px] leading-[18px] text-(--v3-text-2)">{off ? "母版视图下不能跟随协作者" : "点按协作者即可跟随其视图"}</p>
    </div>
  )
}

/* ================================================================== 打开失败：阻断式全屏 */

/**
 * 打开失败（02 §6.2、03-13「打开失败态」）：第 3 批起提升为 kit BlockingPage（登录页、错误页、嵌入里的阻断页同一画法），这里转出原名，引用处不变。
 * 状态里用 toolbar: { hidden: true, collapse: true }，画布列不再给工具条留位置，内容在整屏垂直居中。
 */
export { BlockingPage as OpenFailedPage } from "../../kit"
