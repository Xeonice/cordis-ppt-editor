import { useRef } from "react"
import { cn } from "@/lib/utils"
import {
  Button, CanvasTag, DEFAULT_DECK, deckWith, LayoutGallery, LayoutThumb, Popover, Section, SelectTrigger, SlideFooter, SlideTitle, Tag, TONE_BG, useEditLayoutAction, useLayoutPicker, WANG,
  type DeckSlide, type InspectorSectionDef, type Person, type Tone,
} from "../../kit"

/**
 * offline-conflict 场景的软冲突件（PRD CO-08 / 02-user-flows F4 / 05 §5）：软冲突一律不用横幅（横幅留给会话状态，03-12「使用准则」），
 * 优先原地 / 内联提示，对象被移动或整体消失时才追加轻提示，任何分支都不用阻断式对话框。
 * B 同一文本框同一位置并发编辑：文本框边缘的预防性提示「X 也在编辑此文本框」+ 对方插入符（presence 的延伸，不是锁，CO-10）；
 * C 被并发移动：轻提示 +「恢复我的值」；D 对象被删除时我在编辑它的文字：对象消失 + 轻提示「恢复元素（含我的编辑）」（P1）；
 * E 页被删除时我在往上加东西：该页从左栏消失 + 轻提示「恢复页」（P1）；I 并发更换同一页版式：检查器「版式」字段原地提示 +「恢复我的值」。
 * 字段级的「远端覆盖正在输入的值」第 1 批已画（main-states.remote-overwrite），I 沿用它的画法：字段外圈换成对方身份色、节末写谁改成了什么。
 */

/* ------------------------------------------------------------------ D：第 2 页的要点卡已被删除 */

const AGENDA = [
  { no: "01", label: "关键指标", page: 3 },
  { no: "02", label: "营收趋势", page: 4 },
  { no: "03", label: "区域分布", page: 5 },
  { no: "04", label: "下半年计划", page: 6 },
]

/** 第 2 页「议程」去掉右侧要点卡（被王小明删除后的样子；列表、标题与页脚与示例页同一画法）。 */
function AgendaWithoutCard() {
  return (
    <>
      <SlideTitle>议程</SlideTitle>
      <ol className="absolute top-[19cqw] left-[7cqw] w-[54.5cqw]">
        {AGENDA.map((a, i) => (
          <li key={a.no} className={cn("flex h-[7.2cqw] items-center", i > 0 && "border-t-[0.12cqw] border-(--s-line)")}>
            <span className="w-[6cqw] text-[2cqw] leading-none font-semibold text-(--s-brand) tabular-nums">{a.no}</span>
            <span className="flex-1 text-[3cqw] leading-none font-medium">{a.label}</span>
            <span className="text-[1.7cqw] leading-none text-(--s-mute) tabular-nums">P{a.page}</span>
          </li>
        ))}
      </ol>
      <SlideFooter page={2} />
    </>
  )
}

/** 要点卡被删除后的文档：左栏、网格与画布同一份（删除胜，元素成为墓碑、不再显示）。 */
export const DECK_CARD_DELETED: DeckSlide[] = deckWith({ 2: { render: () => <AgendaWithoutCard /> } })

/* ------------------------------------------------------------------ E：第 6 页已被删除 */

/** 第 6 页被删除后的文档：只剩 5 页（页是墓碑，「恢复页」以原 id、原位置恢复，我在页上新增的元素随页复原）。 */
export const DECK_PAGE_DELETED: DeckSlide[] = DEFAULT_DECK.filter((s) => s.n !== 6)

/* ------------------------------------------------------------------ B：同一文本框同一位置 */

/** 远端插入符（不带姓名签：名字写在文本框边缘的提示里，免得两处重复）：身份色 2px 竖线，位置为幻灯片百分比。 */
function RemoteCaret({ person, x, y, h }: { person: Person; x: number; y: number; h: number }) {
  return <div aria-hidden="true" className={cn("pointer-events-none absolute w-[2px]", TONE_BG[person.tone])} style={{ left: `${x}%`, top: `${y}%`, height: `${h}%` }} />
}

/**
 * B 的预防性提示：对方插入符与我的插入符落在同一处时，文本框上沿外侧出现中性提示签「● 王小明也在编辑此文本框」（色点是「谁」的身份色）；
 * role=status 播报一次；不阻止输入，两段插入相邻并存、顺序确定（CO-08 B）。awareness 级、非持久，断线即消失。
 */
export function SameTextHint() {
  return (
    <>
      {/* 我的插入符在「Q2 业绩」之后（x 64.35%）：对方的插入符落在同一处，向右错开 0.4% 画，两条竖线都看得见 */}
      <RemoteCaret person={WANG} x={64.75} y={33.5} h={12.2} />
      <div role="status">
        {/* 贴在文字编辑框（左 9.3%、上 30.76%）上沿外侧、左对齐，相距 6px */}
        <CanvasTag at="left-[9.3%] bottom-[calc(69.24%+6px)]">
          <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", TONE_BG[WANG.tone])} />
          <span>
            <b className="font-medium text-(--v3-text)">{WANG.name}</b>也在编辑此文本框
          </span>
        </CanvasTag>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ I：并发更换同一页版式 */

/** 协作者身份色的外圈（与第 1 批 remote-overwrite 的字段外圈同一画法；类名写全，Tailwind 才扫描得到） */
const TONE_RING: Record<Tone, string> = {
  slate: "ring-(--v3-tone-slate)",
  sand: "ring-(--v3-tone-sand)",
  sage: "ring-(--v3-tone-sage)",
  clay: "ring-(--v3-tone-clay)",
  mist: "ring-(--v3-tone-mist)",
  olive: "ring-(--v3-tone-olive)",
  iris: "ring-(--v3-tone-iris)",
  lake: "ring-(--v3-tone-lake)",
  rose: "ring-(--v3-tone-rose)",
  denim: "ring-(--v3-tone-denim)",
  plum: "ring-(--v3-tone-plum)",
  moss: "ring-(--v3-tone-moss)",
}

/**
 * I：「幻灯片 N › 版式」被并发更换（LWW，后写者胜）。字段显示胜出的版式、外圈换成对方身份色（隔 1px 面板底）；节末一行写谁改成了什么、
 * 我选的哪个没生效，给「恢复我的值」（新事务，把版式写回我的选择、覆盖对方后写，可再撤销；05 §5 I、§6）。字段照常可点开版式画廊。
 * 节标题右侧的「编辑版式」与内置「版式」分区同一处取（kit useEditLayoutAction，rulings §4.25 DS-147）：可用与否、原因随宿主的母版视图入口
 */
function LayoutRemoteSection() {
  const p = useLayoutPicker("change")
  const trigger = useRef<HTMLButtonElement>(null)
  const action = useEditLayoutAction(p.current)
  return (
    <Section title="版式" anchor="section-slide.layout" action={action}>
      <div className={cn("rounded-[4px] ring-2 ring-offset-1 ring-offset-(--v3-panel)", TONE_RING[WANG.tone])}>
        <SelectTrigger
          ref={trigger}
          aria-label={`版式：${p.current.name}（刚被${WANG.name}更新）`}
          aria-haspopup="dialog"
          aria-expanded={p.open}
          data-v3-anchor="layout-field"
          onClick={() => p.setOpen(!p.open)}
        >
          <LayoutThumb layout={p.current} />
          <span className="truncate">{p.current.name}</span>
        </SelectTrigger>
      </div>
      <div role="status" className="flex flex-col gap-1.5">
        {/* 两句各占一行（检查器内容宽 248，连排时引号里的名称会被挤到下一行、留下参差的行尾） */}
        <p className="flex items-start gap-1.5 text-[12px] leading-[18px] text-(--v3-text-2)">
          <Tag>已更新</Tag>
          <span>
            <span className="block">
              {WANG.name}同时改成了<span className="whitespace-nowrap">「{p.current.name}」</span>
            </span>
            <span className="block">
              你选的<span className="whitespace-nowrap">「标题和内容」</span>没有生效
            </span>
          </span>
        </p>
        <Button variant="secondary" className="self-start">
          恢复我的值
        </Button>
      </div>
      <Popover
        anchor="layout-field"
        label="版式画廊"
        open={p.open}
        onOpenChange={p.setOpen}
        onInteractOutside={(e) => {
          if (trigger.current?.contains(e.target as Node)) e.preventDefault()
        }}
        className="w-[472px] p-0"
      >
        <LayoutGallery mode="change" />
      </Popover>
    </Section>
  )
}

/** 状态私有的「版式」分区（替换内置 slide.layout，只在 I 这个状态里用，经 inspector.sections 传入）。 */
export const LAYOUT_REMOTE: InspectorSectionDef = { id: "offline-conflict.layout-remote", kinds: ["none"], order: 10, component: LayoutRemoteSection }
