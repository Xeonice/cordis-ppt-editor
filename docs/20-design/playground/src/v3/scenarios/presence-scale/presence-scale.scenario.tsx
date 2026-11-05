import { CARD_POS, RemoteCursor, RemoteSelection, WANG, type CollaboratorsConfig } from "../../kit"
import { defineScenario, type EditorConfig } from "../types"
import { byName, PresenceRoster, roster, shownPeople, twoBadges, type BadgeFn, type Member } from "./people"

/**
 * presence-scale：第 13 位起协作者头像的序号角标（rulings §4.25 DS-42「画法随第 3 批复核」，README D15 ⑤；PRD CO-03），rulings §4.25 DS-132（按推荐采纳）。
 * 示例在场 20 人（名额上限 20 编辑者，CO-01）：前 12 位占满 12 色，第 13 位起复用颜色（people.tsx）；同一账号多个窗口（05 §9、§1a：头像与名额按用户合并）。
 * 画在检查器协作行的头像组（底座 Collaborators，前 5 位含自己 +「+15」）、「+15」展开的在线列表与画布上（远端光标、选区与名签）。
 * 头像角标是底座的（kit AvatarBadge，Avatar 给 seq 就画；第 3 批转正时由 people.tsx 并入）；在线列表是本场景的 20 人版本（people.tsx PresenceRoster），
 * 经底座 inspector.collaborators.list 交给「+N」的弹层、listOpen 一出现就开着（原来在 document 捕获阶段拦下「+N」点按的 RosterLayer 随之删去）。
 * 画布上 20 人同时在场时的密度规则（9–20 组只保留 5 秒内有活动者的完整名签、其余光标 60%，05 §1a）不属本题，这里画面上只放 2–3 组。
 * 摸底列为可选、没另出样张的：备选③「不画序号角标」（同 Figma，三家标杆都不画；只靠名签区分，需改 PRD CO-03 与 DS-42）——画面就是去掉角标的 avatars-reuse，未采纳（文字备选）。
 * 同目录：people（在场者、角标、在线列表）。
 */

const LIST = roster()

/**
 * 检查器协作行（底座 Collaborators）：头像组 = people 的前 5 位（含自己）+「+15」，「+15」点开的在线列表 = list 的 20 行；
 * people 与列表可以不是同一份 roster（列表按状态写窗口数与所在页，头像组只看序号）
 */
const collab = (list: Member[], { people = LIST, badge, sessionsInRow, listOpen }: { people?: Member[]; badge?: BadgeFn; sessionsInRow?: boolean; listOpen?: boolean } = {}): CollaboratorsConfig => ({
  people: shownPeople(people, badge),
  extra: people.length - 5,
  list: <PresenceRoster list={list} badge={badge} sessionsInRow={sessionsInRow} />,
  listOpen,
})

/** 姚远（第 15 位加入、复用 sage）与李雷同色；唐宁（第 17 位加入、复用 denim，与第 11 位的曹宇同色）在第 2 页 */
const YAO = byName("姚远").p
const LI_P = byName("李雷").p
const TANG = byName("唐宁").p

/** 第 3 页三张指标卡（幻灯片百分比，与 SlideArt 关键指标页同一组坐标） */
const CARD_REVENUE = { x: 7, y: 33.8, w: 26.7, h: 48.9 }
const CARD_MARGIN = { x: 66.3, y: 33.8, w: 26.7, h: 48.9 }

/** 共同：检查器协作行 20 人（前 5 位 +「+15」），远端光标由状态自己画 */
const BASE: EditorConfig = {
  stage: { cursor: false },
  inspector: { collaborators: collab(LIST) },
}

/** 同一账号两个窗口：我在另一个窗口里也开着这份文档（05 §9） */
const MULTI = roster({ 周明远: 2 })

/** 未采纳的备选：两种角标都上头像（姚远：同色第 2 位、开着 3 个窗口；我：2 个窗口） */
const TWO = roster({ 周明远: 2, 姚远: 3 })

export default defineScenario({
  id: "presence-scale",
  title: "在场规模与头像角标",
  specs: ["03-02"],
  batch: 3,
  summary: "20 人在场：第 13 位起复用身份色、头像组里序号角标挂在头像下沿；在线列表；同一账号多个窗口只占一个头像、列表写「2 个窗口」；画布上同色两人靠名签区分",
  states: [
    {
      id: "avatars-reuse",
      title: "头像组 · 20 人在场",
      note: "rulings §4.25 DS-132。检查器协作行：自己的头像在首位、带常驻外圈（DS-18），其后按最近编辑活动排 4 位，第 6 位起折叠为「+15」（PRD CO-03 最多 5 个，组的读屏名「正在协作的人：20 人」）。前 12 位加入的人占满 12 色（DS-42，第 5–12 位按顺延的结果取色），第 13 位起没有空色可顺延、复用自己的哈希色——这里第 3 个头像姚远（第 15 位加入）与第 4 个李雷同为 sage：姚远的头像带一枚 14px 圆形数字角标「2」（同色里的第 2 位；第一位不画），面板底 + 与分隔线同档的细边、11px 数字。头像组是叠放的（后一个左移 6 压住前一个），角标若放在右下角，正落在与右邻两圆的交界处，同色相邻时看不出是谁的；所以组里的角标挂在这枚头像看得见的那一段（左边 18）的底部中线上、向下多出 7：不压头像字，也碰不到左右邻居（自己的头像不被压，挂在正中）。在线列表里头像不叠放，角标留在右下（presence-list-reuse）。头像的读屏名「姚远，同色第 2 位」。画布停在第 2 页：王小明选中了要点卡，唐宁（第 17 位加入、复用 denim，同色第 2 位，也在第 2 页）的光标与名签——名签不加序号，靠名字区分。点「+15」展开在线列表",
      editor: {
        ...BASE,
        slideOverlay: (
          <>
            <RemoteSelection person={WANG} at={CARD_POS} />
            <RemoteCursor at="left-[30%] top-[58%]" name={TANG.name} tone={TANG.tone} />
          </>
        ),
      },
    },
    {
      id: "presence-list-reuse",
      title: "在线列表 · 20 人",
      note: "DS-132。点「+15」：在线列表（05 §1a，与第 1 批 main-states.presence-list 同一画法、同宽 256，贴头像组左缘向下、间距 8）——标题「20 人在线」与「最近编辑的在前」，自己在最上（不可点），其余逐行头像 + 姓名 + 角色 + 所在页，点按进入跟随；复用了颜色的 8 位头像带同一枚序号角标（列表里头像不叠放，角标在 20px 头像右下，12px：姚远、唐宁、沈博、彭程、田甜、蒋涛「2」，韩梅、罗兰「3」——rose、sage 各被用了三次），行的读屏名带上「同色第 N 位」。20 行高 560，在 1600 × 1000 下放得下；窗口矮时列表在弹层里滚动，标题与底部说明常驻。关闭后焦点回「+15」",
      editor: { ...BASE, inspector: { collaborators: collab(LIST, { listOpen: true }) } },
    },
    {
      id: "multi-session",
      title: "同一账号两个窗口",
      note: "DS-132。我在另一个窗口里也开着这份文档（05 §9）：头像组与名额按用户合并——我仍只占一个头像、一个名额，组里仍是 20 人；窗口数不上头像（一个头像只有一种角标），写在在线列表我那一行「2 个窗口」（读屏名同写）。那一行因此比第 1 批的列表长：列表按内容加宽到约 277（最窄仍是 256；第 1 批 main-states.presence-list 随 DS-132 同改），从头像组左缘放不下，按视口边距 8 往左让，右缘与检查器右缘内 8 对齐，左缘伸出检查器约 15、落在画布右侧留白上，不盖幻灯片。画布上另一个窗口作为独立的远端光标出现，身份色同我的头像（slate），名签「周明远（你 · 窗口 2）」——同一账号多个会话统一称「窗口」，自称与列表的「（你）」一致（rulings §4.25 TB-124；05 §9 同此，原示例「(我·标签2)」作废）",
      editor: {
        ...BASE,
        inspector: { collaborators: collab(MULTI, { listOpen: true }) },
        slideOverlay: <RemoteCursor at="left-[30%] top-[58%]" name="周明远（你 · 窗口 2）" tone="slate" />,
      },
    },
    {
      id: "cursors-reuse",
      title: "画布 · 同色两人同屏",
      note: "DS-132。第 3 页：李雷选中了「营收」卡、姚远选中了「毛利率」卡，两人都是 sage——画布上的远端选区框与名签同色，靠名签上的名字区分，名签不加序号（序号只在头像组与在线列表的头像上，DS-132）；检查器协作行里姚远的头像下沿挂着「2」，与画布上同色的选区对得上。我这一态停在第 3 页（点「+15」时列表里我那一行也写「第 3 页」）",
      editor: {
        ...BASE,
        slide: 3,
        inspector: { collaborators: collab(roster({}, { 周明远: 3 })) },
        slideOverlay: (
          <>
            <RemoteSelection person={LI_P} box={CARD_REVENUE} />
            <RemoteSelection person={YAO} box={CARD_MARGIN} />
          </>
        ),
      },
    },
    {
      id: "alt-two-badges",
      title: "未采纳 · 两种角标都上头像",
      note: "未采纳（DS-132 定为头像只挂同色序号、窗口数写在在线列表那一行，见 avatars-reuse、multi-session）：序号与窗口数都画在头像上（05 §1a / §9「角标显示会话数」的字面读法）。头像组叠放，角落正落在邻居的交界处，所以两枚都挂在头像看得见的那一段的中线上：序号在下沿（同 avatars-reuse）、窗口数在上沿；在线列表里头像不叠放，序号在右下、窗口数在右上，行里不再写「N 个窗口」。姚远（同色第 2 位、开着 3 个窗口）的 24px 头像上下各一枚数字「2」「3」，分不清哪个是序号、哪个是窗口数；我开着 2 个窗口，自己的头像上沿也多了「2」，一行头像高低错落",
      editor: {
        ...BASE,
        inspector: { collaborators: collab(TWO, { people: TWO, badge: twoBadges, sessionsInRow: false, listOpen: true }) },
      },
    },
  ],
})
