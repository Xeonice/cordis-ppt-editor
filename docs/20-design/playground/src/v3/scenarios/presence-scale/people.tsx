import type { ReactNode } from "react"
import { Avatar, AvatarBadge, LI, ME, PopoverTitle, reasonTip, Tag, Tip, toneOf, WANG, withReason, ZHANG, type Person, type PresencePerson } from "../../kit"
import { useFollowOffReason } from "../../editor/chrome"

/**
 * presence-scale 的示例在场者（20 人，PRD CO-01 名额 20 编辑者 + 50 查看者、CO-03；设计 05 §1a、§2、§9）与在线列表（rulings §4.25 DS-132）。
 * 2026-10-22 第 3 批转正：头像角标（kit AvatarBadge、Avatar seq）、「+N」的列表内容可按状态给（inspector.collaborators.list / listOpen）都并进了底座，
 * 原来这里的角标件与「+N」点按的捕获拦截（RosterLayer）随之删去，画面不变；这里只剩示例的 20 人、在线列表的内容（PresenceRoster）与未采纳备选的两种角标。
 * 取色（05 §2、kit/tone.ts assignTones）：按加入顺序逐个取哈希色，同场撞色顺延到下一个未占用的色；示例的固定人物周明远 slate、王小明 sand、李雷 sage、张三 clay
 * 保持写死的色（集成方给了颜色，kit data.ts），占掉 12 色的前 4 个；第 5–12 位按顺延的结果写出（陈静 moss、吴昊 mist、郑婷 lake、冯磊 olive、何雪 rose、许诺 iris、
 * 曹宇 denim、邓佳 plum——哈希撞上已占用的色就往后顺延，如吴昊的哈希是 clay、许诺是 mist、曹宇是 slate、邓佳是 clay），前 12 位正好占满 12 色；
 * 第 13 位起没有空色可顺延，复用自己的哈希色（toneOf：彭程 rose、田甜 moss、姚远 sage、韩梅 sage、唐宁 denim、沈博 mist、罗兰 rose、蒋涛 plum）。
 * 序号 = 这个颜色在场里的第几位（按加入顺序数；第一位不画），所以同一色出现第三次时写 3（rose：何雪 · 彭程 2 · 罗兰 3；sage：李雷 · 姚远 2 · 韩梅 3）。
 * 名额与头像按用户合并，同一账号多个会话（窗口）只算一个（rulings §4.15 Q5；称呼统一为「窗口」，rulings §4.25 TB-124）。
 */

export interface Member {
  p: Person
  id: string
  role: "所有者" | "编辑者" | "评审者" | "查看者"
  page: number
  /** 同色里的第几位（第一位不写） */
  seq?: number
  /** 这个账号开着几个窗口（标签页、窗口或另一台设备上的会话） */
  sessions?: number
  self?: boolean
}

const m = (name: string, id: string, tone: Person["tone"] | null, role: Member["role"], page: number, seq?: number): Member => ({ p: { name, tone: tone ?? toneOf(id) }, id, role, page, seq })

/** 加入顺序（第 5–12 位的色是顺延后的结果；第 13 位起复用哈希色，序号写在 seq） */
export const JOINED: Member[] = [
  { p: ME, id: "u-zhou", role: "所有者", page: 2, self: true },
  { p: WANG, id: "u-wang", role: "编辑者", page: 2 },
  { p: LI, id: "u-li", role: "编辑者", page: 3 },
  { p: ZHANG, id: "u-zhang", role: "评审者", page: 4 },
  m("陈静", "u-chen", "moss", "编辑者", 2),
  m("吴昊", "u-wu", "mist", "编辑者", 5),
  m("郑婷", "u-zheng", "lake", "评审者", 4),
  m("冯磊", "u-feng", "olive", "编辑者", 6),
  m("何雪", "u-he", "rose", "查看者", 1),
  m("许诺", "u-xu", "iris", "编辑者", 3),
  m("曹宇", "u-cao", "denim", "查看者", 1),
  m("邓佳", "u-deng", "plum", "评审者", 4),
  // 第 13 位起：12 色已占满，取自己的哈希色（复用），序号按这个颜色在场里的先后
  m("彭程", "u-pengcheng", null, "查看者", 1, 2),
  m("田甜", "u-tiantian", null, "查看者", 2, 2),
  m("姚远", "u-yao", null, "编辑者", 3, 2),
  m("韩梅", "u-han", null, "查看者", 1, 3),
  m("唐宁", "u-tangning", null, "查看者", 2, 2),
  m("沈博", "u-shenbo", null, "评审者", 4, 2),
  m("罗兰", "u-luolan", null, "查看者", 1, 3),
  m("蒋涛", "u-jiangtao", null, "查看者", 6, 2),
]

export const byName = (n: string) => JOINED.find((x) => x.p.name === n)!

/** 列表顺序：自己在最上，其余按最近有编辑活动排序（05 §1a；取远端选区 / 插入符最近变化的时间）——编辑者在动东西的在前，评审者、查看者在后 */
const ORDER = ["周明远", "王小明", "姚远", "李雷", "吴昊", "陈静", "冯磊", "许诺", "郑婷", "张三", "邓佳", "沈博", "何雪", "曹宇", "彭程", "田甜", "韩梅", "唐宁", "罗兰", "蒋涛"]

/**
 * 在线列表的行。sessions：这一刻各账号开着的窗口数（缺省 1）；pages：这一态里所在页与示例数据不同的人（如画布停在第 3 页时我也在第 3 页），
 * 列表里写的「第 N 页」与画布对得上
 */
export function roster(sessions: Record<string, number> = {}, pages: Record<string, number> = {}): Member[] {
  return ORDER.map((n) => {
    const x = byName(n)
    return { ...x, page: pages[n] ?? x.page, sessions: sessions[n] ?? 1 }
  })
}

/** 头像的读屏名：同色序号写进去（与看得见的角标对应）；窗口数另写在列表行里，不上头像 */
export const avatarLabel = (x: Member) => (x.seq ? `${x.p.name}，同色第 ${x.seq} 位` : x.p.name)

/**
 * 角标画在哪：group = 检查器协作行的头像组（24px 头像叠放，后一个左移 6 压住前一个的右侧）；list = 在线列表（20px 头像，逐行不叠放）
 */
export type BadgeWhere = "group" | "list"
/** 给一位在场者画哪些角标（undefined = 不画） */
export type BadgeFn = (x: Member, where: BadgeWhere) => ReactNode

/*
 * 头像角标的画法与位置就是 kit AvatarBadge（ui.tsx；DS-132 采纳的推荐，复验 g7-rv-02 后的位置：头像组挂在可见段的底部中线、在线列表在右下；
 * 尺寸按头像 24 配 14、20 配 12，TB-124）。slot = sessions 只给未采纳的备选（两种角标都上头像）。
 */

/** DS-132：只有序号角标（头像组挂在可见段的底部中线、在线列表在右下）；头像组里由底座 Avatar 的 seq 画，这里给在线列表用 */
export const seqBadge: BadgeFn = (x, where) => (x.seq ? <AvatarBadge n={x.seq} where={where} self={x.self} /> : undefined)

/** DS-132 未采纳的备选（两种角标都上头像，alt-two-badges）：序号同上；窗口数在头像组里挂在可见段的上方中线、在线列表里在右上 */
export const twoBadges: BadgeFn = (x, where) =>
  x.seq || (x.sessions ?? 1) > 1 ? (
    <>
      {x.seq ? <AvatarBadge n={x.seq} where={where} self={x.self} /> : null}
      {(x.sessions ?? 1) > 1 ? <AvatarBadge n={x.sessions!} where={where} self={x.self} slot="sessions" /> : null}
    </>
  ) : undefined

/**
 * 检查器协作行的头像组：前 5 位（含自己），其余折叠为「+N」。缺省只带同色序号（底座 Avatar seq：挂 kit AvatarBadge、读屏名「姓名，同色第 N 位」）；
 * 未采纳的备选给 badge（两种角标都上头像），读屏名同写序号
 */
export function shownPeople(list: Member[], badge?: BadgeFn): PresencePerson[] {
  return list.slice(0, 5).map((x) => (badge ? { ...x.p, badge: badge(x, "group"), label: avatarLabel(x) } : { ...x.p, seq: x.seq }))
}

/* ------------------------------------------------------------------ 在线列表（「+N」展开） */

/** 在线列表的头像：20px，角标在右下（列表里不叠放，角标不会被邻居盖住） */
function ListAvatar({ x, badge }: { x: Member; badge: BadgeFn }) {
  const b = badge(x, "list")
  return (
    <span className="relative flex shrink-0">
      <Avatar name={x.p.name} tone={x.p.tone} size={20} />
      {b}
    </span>
  )
}

/**
 * 「+N」展开的在线列表（05 §1a，第 1 批 main-states.presence-list 的同一画法与宽度 256）：标题「20 人在线 · 最近编辑的在前」，逐行头像 + 姓名 + 角色 + 所在页，
 * 自己在最上、不可点，其余点按进入跟随；复用了颜色的头像带同一枚序号角标；同一账号开着几个窗口时这一行写「2 个窗口」（窗口数不上头像，DS-132）。
 * 宽度：最窄 256（同第 1 批）；有人开着多个窗口时，那一行多出「N 个窗口」，列表按内容加宽（自己那一行约 277）——DS-132 带来的变化，第 1 批 main-states 的列表随之改（最窄 256、按内容加宽）。
 * 这份内容经底座 inspector.collaborators.list 交给「+N」的弹层（贴头像组左缘向下、间距 8，关闭后焦点回「+N」）；按内容加宽后从头像组左缘放不下时，按视口边距 8 往左让。
 * 20 行高 560，窗口矮时列表在弹层里滚动（标题行与底部说明常驻）。
 * 母版视图里各行的「跟随」留在原位、不可用，同头像组与第 1 批的在线列表（rulings §4.25 DS-177、TB-203；editor/chrome.tsx useFollowOffReason）：外观不变、只去掉悬停底色，
 * aria-disabled，读屏名在原来的后面加「（母版视图下不可用）」，工具提示「跟随 〈姓名〉 · 母版视图下不可用」，点了不跟随；
 * 底部的说明随之改写「母版视图下不能跟随协作者」（普通视图仍是「点按协作者即可跟随其视图」；设计 03-26 §1.1）
 */
export function PresenceRoster({ list, badge = seqBadge, sessionsInRow = true }: { list: Member[]; badge?: BadgeFn; sessionsInRow?: boolean }) {
  const off = useFollowOffReason()
  return (
    <div className="flex w-max min-w-[256px] flex-col">
      <div className="flex h-8 shrink-0 items-center justify-between gap-4 px-2">
        <PopoverTitle>{`${list.length} 人在线`}</PopoverTitle>
        <span className="text-[12px] leading-none text-(--v3-text-2)">最近编辑的在前</span>
      </div>
      <ul className="flex max-h-[min(560px,calc(100dvh-160px))] flex-col overflow-y-auto">
        {list.map((x) => {
          const windows = sessionsInRow && (x.sessions ?? 1) > 1 ? `${x.sessions} 个窗口` : null
          const inner = (
            <>
              <ListAvatar x={x} badge={badge} />
              <span className="text-[12px] leading-none whitespace-nowrap text-(--v3-text)">
                {x.p.name}
                {x.self && <span className="text-(--v3-text-2)">（你）</span>}
              </span>
              <Tag>{x.role}</Tag>
              {windows && <span className="text-[12px] leading-none whitespace-nowrap text-(--v3-text-2)">{windows}</span>}
              <span className="ml-auto text-[12px] leading-none whitespace-nowrap text-(--v3-text-2)">{`第 ${x.page} 页`}</span>
            </>
          )
          const say = [x.role, `第 ${x.page} 页`, x.seq ? `同色第 ${x.seq} 位` : null, windows].filter(Boolean).join("，")
          const label = `跟随 ${x.p.name}（${say}）`
          return (
            <li key={x.id}>
              {x.self ? (
                <div aria-label={`${x.p.name}（你，${say}）`} className="flex h-7 items-center gap-2 px-2">
                  {inner}
                </div>
              ) : off ? (
                <Tip label={reasonTip(`跟随 ${x.p.name}`, off)} side="left">
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
      <div className="-mx-1 my-1 h-px shrink-0 bg-(--v3-border)" />
      {/* off 只在母版视图里有值（useFollowOffReason），这时各行都不可用，说明跟着换 */}
      <p className="px-2 pt-0.5 pb-1 text-[12px] leading-[18px] text-(--v3-text-2)">{off ? "母版视图下不能跟随协作者" : "点按协作者即可跟随其视图"}</p>
    </div>
  )
}
