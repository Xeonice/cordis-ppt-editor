import { Fragment, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { layoutName, SlideFooter, SlideTitle, useSceneState, type SlideRenderOpts } from "../../kit"
import { layoutDef, MASTERS, type LayoutKind, type MasterDef } from "../masters-themes/data"
import type { PtBox } from "./paper"

/**
 * 03-16 场景用到的自定义页（画在 SlideFrame 里，尺寸一律 cqw，颜色用 --s-*）。
 * 编辑态的插入符、选区、文本框编辑描边只在画布上、且当前选中是 text 时画（缩略图与网格里没有，用户点空白就消失）。
 */

/* ------------------------------------------------------------------ 文字标记：选区与插入符 */

/** 一行文字里的选区 [起, 止) 与插入符位置（字符下标）。 */
export interface Mark {
  sel?: [number, number]
  caret?: number
}

function Caret() {
  return <span aria-hidden="true" className="mx-px inline-block h-[1.05em] w-0 translate-y-[0.16em] border-l-[0.2cqw] border-(--v3-accent)" />
}

/** 按 Mark 切开文字：选区画浅强调色底，插入符画强调色竖线。 */
export function Marked({ text, mark }: { text: string; mark?: Mark }) {
  if (!mark) return <>{text}</>
  const cuts = new Set<number>([0, text.length])
  if (mark.sel) {
    cuts.add(mark.sel[0])
    cuts.add(mark.sel[1])
  }
  if (mark.caret !== undefined) cuts.add(mark.caret)
  const pts = [...cuts].sort((a, b) => a - b)
  const out: ReactNode[] = []
  pts.forEach((p, i) => {
    if (mark.caret === p) out.push(<Caret key={`c${p}`} />)
    const next = pts[i + 1]
    if (next === undefined) return
    const seg = text.slice(p, next)
    const inSel = !!mark.sel && p >= mark.sel[0] && next <= mark.sel[1]
    out.push(
      inSel ? (
        <span key={`s${p}`} className="bg-(--v3-sel)">
          {seg}
        </span>
      ) : (
        <Fragment key={`t${p}`}>{seg}</Fragment>
      ),
    )
  })
  return <>{out}</>
}

/** 文本框编辑描边：1px 强调色（屏幕像素，不随缩放），比文字外扩一圈，不带手柄（编辑态与选中态的区别）。 */
function EditFrame() {
  return <div aria-hidden="true" className="pointer-events-none absolute -inset-x-[1.2cqw] -inset-y-[0.8cqw] border border-(--v3-accent)" />
}

/* ------------------------------------------------------------------ 第 6 页「下半年计划」：两级项目符号正文 */

export interface PlanItem {
  title: string
  subs: string[]
}

export const PLAN: PlanItem[] = [
  { title: "拓展企业客户", subs: ["新增 3 个行业解决方案", "重点突破制造与零售"] },
  { title: "提升交付效率", subs: ["上线自动化交付流程", "平均交付周期缩短 25%"] },
  { title: "优化产品体验", subs: ["重构核心编辑工作流", "NPS 提升至 55 以上"] },
]

/** 内容多出一行（自动缩小演示）：第 2 项多一条 */
export const PLAN_LONG: PlanItem[] = [
  PLAN[0]!,
  { title: "提升交付效率", subs: ["上线自动化交付流程", "平均交付周期缩短 25%", "交付质量投诉下降 30%"] },
  PLAN[2]!,
]

/** 正文文本框（cqw）：左 7、上 18.5、宽 55、高 30.5；标题框：上 6.4、高 5.6、宽 24 */
export const PLAN_BODY = { left: 7, top: 18.5, width: 55, height: 30.5 }
export const PLAN_TITLE = { left: 7, top: 6.4, width: 24, height: 5.6 }
/** cqw（幻灯片宽的 1%）换成 960 × 540 设计稿坐标 */
const cq = (v: number) => (v / 100) * 960
export const PLAN_BODY_PT: PtBox = { x: cq(PLAN_BODY.left), y: cq(PLAN_BODY.top), w: cq(PLAN_BODY.width), h: cq(PLAN_BODY.height) }
export const PLAN_TITLE_PT: PtBox = { x: cq(PLAN_TITLE.left), y: cq(PLAN_TITLE.top), w: cq(PLAN_TITLE.width), h: cq(PLAN_TITLE.height) }
/** 文本框的外框（含内边距，与编辑描边同一圈）：左右各外扩 1.2cqw、上下各 0.8cqw */
export const framePt = (b: PtBox): PtBox => ({ x: b.x - cq(1.2), y: b.y - cq(0.8), w: b.w + cq(2.4), h: b.h + cq(1.6) })

export interface PlanOpts {
  items?: PlanItem[]
  /** 一级段落用编号「1.」而不是圆点 */
  numbered?: boolean
  /** 自动缩小（normAutofit）的字号比例，如 0.92 */
  scale?: number
  /** 编辑态标记：key 为「项下标」或「项下标.子项下标」，如 "1.0" */
  marks?: Record<string, Mark>
}

/** 悬挂缩进：符号列 1.25em，第 2 级的符号与第 1 级的文字左缘对齐 */
function Bullet({ level, numbered, n }: { level: 1 | 2; numbered?: boolean; n: number }) {
  if (level === 1 && numbered) return <span className="w-[1.25em] shrink-0 font-semibold text-(--s-brand) tabular-nums">{n}.</span>
  return (
    <span className="flex h-[1.4em] w-[1.25em] shrink-0 items-center" aria-hidden="true">
      {level === 1 ? (
        <span className="size-[0.38em] rounded-full bg-(--s-brand)" />
      ) : (
        <span className="size-[0.36em] rounded-full border-[0.12em] border-(--s-mute)" />
      )}
    </span>
  )
}

export function PlanSlide({ where, selection, items = PLAN, numbered, scale = 1, marks }: SlideRenderOpts & PlanOpts) {
  const editing = where === "canvas" && selection === "text" && !!marks
  const m = (k: string) => (editing ? marks?.[k] : undefined)
  // 字号按 cqw，自动缩小时整体乘比例（行距同比）
  const l1 = 2.4 * scale
  const l2 = 2 * scale
  return (
    <>
      <SlideTitle>下半年计划</SlideTitle>
      <div className="absolute" style={{ left: `${PLAN_BODY.left}cqw`, top: `${PLAN_BODY.top}cqw`, width: `${PLAN_BODY.width}cqw`, height: `${PLAN_BODY.height}cqw` }}>
        {items.map((it, i) => (
          <div key={it.title} style={{ marginTop: i ? `${scale}cqw` : 0 }}>
            <p className="flex font-semibold text-(--s-ink)" style={{ fontSize: `${l1}cqw`, lineHeight: 1.4 }}>
              <Bullet level={1} numbered={numbered} n={i + 1} />
              <span>
                <Marked text={it.title} mark={m(String(i))} />
              </span>
            </p>
            {it.subs.map((s, j) => (
              <p key={s} className="flex text-(--s-body)" style={{ fontSize: `${l2}cqw`, lineHeight: 1.5, paddingLeft: `${l1 * 1.25}cqw` }}>
                <Bullet level={2} n={j + 1} />
                <span>
                  <Marked text={s} mark={m(`${i}.${j}`)} />
                </span>
              </p>
            ))}
          </div>
        ))}
        {editing && <EditFrame />}
      </div>
      {/* 右侧目标卡（独立文本框）：与正文之间留 4cqw */}
      <div className="absolute top-[18.5cqw] left-[66cqw] flex h-[30.5cqw] w-[27cqw] flex-col rounded-[1.6cqw] bg-(--s-note) p-[2.4cqw]">
        <span className="text-[1.7cqw] leading-none font-medium text-(--s-body)">下半年目标</span>
        <div className="mt-auto flex flex-col gap-[1.6cqw]">
          {[
            { v: "3 个", c: "新增行业解决方案" },
            { v: "−25%", c: "平均交付周期" },
            { v: "55+", c: "NPS 目标" },
          ].map((r) => (
            <div key={r.c}>
              <span className="block text-[3.4cqw] leading-none font-bold tracking-[-0.01em] tabular-nums">{r.v}</span>
              <span className="mt-[0.8cqw] block text-[1.5cqw] leading-[1.25] text-(--s-body)">{r.c}</span>
            </div>
          ))}
        </div>
      </div>
      <SlideFooter page={6} />
    </>
  )
}

/* ------------------------------------------------------------------ 第 1 页封面：底部一行插入日期字段 */

const GROWTH = [
  { h: "h-[5.5cqw]", c: "bg-(--s-brand-soft)" },
  { h: "h-[8cqw]", c: "bg-(--s-brand-soft)" },
  { h: "h-[11cqw]", c: "bg-[#D5DEFB]" },
  { h: "h-[14.5cqw]", c: "bg-(--s-brand-mid)" },
  { h: "h-[18.5cqw]", c: "bg-[#7F98F1]" },
  { h: "h-[23cqw]", c: "bg-(--s-brand)" },
]

/** 插入的日期字段（场景内共享）：undefined = 状态初值（field 参数）、null = 已撤销、对象 = 用户刚从「日期和时间」插入的 */
export const DT_FIELD = "text-edit.dt-field"
export type DtField = { code: string; text: string; auto: boolean }

/**
 * 封面（与示例第 1 页同一版面），底部一行「产品部 · …」：
 * field 为插入的日期（字段带浅灰底纹，只在编辑态画）；editing 时画插入符与文本框编辑描边。
 */
export function CoverDateSlide({ where, selection, field: given, auto: givenAuto = true }: SlideRenderOpts & { field?: string; auto?: boolean }) {
  const editing = where === "canvas" && selection === "text"
  const [inserted] = useSceneState<DtField | null | undefined>(DT_FIELD, undefined)
  const field = inserted === undefined ? given : inserted?.text
  const auto = inserted ? inserted.auto : givenAuto
  return (
    <>
      <div className="absolute top-[18cqw] left-[7cqw] h-[15.2cqw] w-[1cqw] bg-(--s-brand)" />
      <div className="absolute top-[18cqw] left-[10.5cqw]">
        <h1 className="text-[7.2cqw] leading-[1.18] font-bold tracking-[-0.015em] whitespace-nowrap">2026 年 Q2 业绩汇报</h1>
        <p className="mt-[2.2cqw] text-[3cqw] leading-[1.4] text-(--s-body)">增长、效率与下半年计划</p>
      </div>
      <div className="absolute bottom-[6.6cqw] left-[10.5cqw]">
        <p className="text-[1.9cqw] leading-none whitespace-nowrap text-(--s-mute)">
          产品部 ·{" "}
          {field && (
            // 字段底纹：墨色 8%（只在编辑态画，不进缩略图、放映与导出）；固定文本与普通文字无异
            <span className={cn(editing && auto && "rounded-[0.3cqw] bg-[color-mix(in_srgb,var(--s-ink)_8%,transparent)] px-[0.2cqw]")}>{field}</span>
          )}
          {editing && <Caret />}
        </p>
        {editing && <EditFrame />}
      </div>
      <div className="absolute right-[7cqw] bottom-0 flex items-end gap-[1.5cqw]">
        {GROWTH.map((g, i) => (
          <div key={i} className={cn("w-[3.6cqw] rounded-t-[0.5cqw]", g.h, g.c)} />
        ))}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ 第 2 页议程：条目链接到本文稿中的页 */

export const AGENDA = [
  { no: "01", label: "关键指标", page: 3 },
  { no: "02", label: "营收趋势", page: 4 },
  { no: "03", label: "区域分布", page: 5 },
  { no: "04", label: "下半年计划", page: 6 },
]

/** 议程列表文本框（cqw）：左 7、上 19、宽 54.5、每行 7.2；条目文字从左 13 起、字号 3 */
export const AGENDA_BOX = { left: 7, top: 19, width: 54.5, row: 7.2 }

export interface AgendaOpts {
  /** 已有链接：ok 正常，broken 目标页已删除（编辑态下画失效描边） */
  links?: Record<string, "ok" | "broken">
  /** 编辑态标记（按条目文字） */
  marks?: Record<string, Mark>
}

export function AgendaLinkSlide({ where, selection, links: given = {}, marks }: SlideRenderOpts & AgendaOpts) {
  const editing = where === "canvas" && selection === "text" && !!marks
  // 链接小卡里「移除链接」「编辑链接」的结果（场景内共享，缩略图同步）：移除的条目去掉链接样式，重新设置过的失效链接恢复正常
  const [removed] = useSceneState<string[]>("text-edit.link-removed", [])
  const [fixed] = useSceneState<Record<string, number>>("text-edit.link-fixed", {})
  const links: AgendaOpts["links"] = Object.fromEntries(
    Object.entries(given)
      .filter(([k]) => !removed.includes(k))
      .map(([k, v]) => [k, fixed[k] !== undefined ? "ok" : v]),
  )
  return (
    <>
      <SlideTitle>议程</SlideTitle>
      <div className="absolute top-[19cqw] left-[7cqw] w-[54.5cqw]">
      <ol>
        {AGENDA.map((a, i) => {
          const link = links[a.label]
          return (
            <li key={a.no} className={cn("flex h-[7.2cqw] items-center", i > 0 && "border-t-[0.12cqw] border-(--s-line)")}>
              <span className="w-[6cqw] text-[2cqw] leading-none font-semibold text-(--s-brand) tabular-nums">{a.no}</span>
              <span className="flex-1 text-[3cqw] leading-none font-medium">
                <span
                  className={cn(
                    link && "text-(--s-brand) underline decoration-[0.14cqw] underline-offset-[0.5cqw]",
                    link === "broken" && editing && "decoration-(--v3-danger) decoration-dashed",
                  )}
                >
                  <Marked text={a.label} mark={editing ? marks?.[a.label] : undefined} />
                </span>
              </span>
              <span className="text-[1.7cqw] leading-none text-(--s-mute) tabular-nums">P{a.page}</span>
            </li>
          )
        })}
      </ol>
      {editing && <EditFrame />}
      </div>
      <div className="absolute top-[43%] left-[65.5%] flex h-[32.59%] w-[27.5%] flex-col rounded-[2cqw] bg-(--s-note) p-[2.4cqw]">
        <span className="text-[1.7cqw] leading-none font-medium text-(--s-body)">本季关键词</span>
        <span className="mt-[1.8cqw] text-[5cqw] leading-none font-bold tracking-[-0.01em] tabular-nums">增长 18%</span>
        <span className="mt-auto text-[1.45cqw] leading-[1.4] whitespace-nowrap text-(--s-body)">营收、客户、毛利三项同步提升</span>
      </div>
      <SlideFooter page={2} />
    </>
  )
}

/* ------------------------------------------------------------------ 第 7 页：新建的空白页（空占位符） */

export type PhType = "title" | "obj" | "pic"

export interface Placeholder {
  id: string
  type: PhType
  /** 960 × 540 设计稿坐标 */
  box: PtBox
  /** 版式里的占位符索引（idx） */
  idx?: number
}

/**
 * 第 7 页用的版式：kind 是底座版式数据里的种类（版式上的占位符几何在 editor/layouts/LayoutArt.tsx placeholdersFor，名称取 layoutName），
 * phs 是这一页上的占位符（pt，本页叠加层与图标条用）——除「内容与图片」左内容的高在本页改成 360（版式值 348，检查器「位置与大小」写明）外，与版式上的相同
 */
export interface PhLayout {
  name: string
  kind: LayoutKind
  phs: Placeholder[]
}

const TITLE_PH: Placeholder = { id: "title", type: "title", box: { x: 60, y: 36, w: 840, h: 72 } }

/** 「内容与图片」：左内容占位符 540 pt（四个图标），右图片占位符 276 pt（只有图片） */
export const LAYOUT_CONTENT_PICTURE: PhLayout = {
  name: layoutName("content-picture"),
  kind: "content-picture",
  phs: [TITLE_PH, { id: "left", type: "obj", idx: 1, box: { x: 60, y: 124, w: 540, h: 360 } }, { id: "right", type: "pic", idx: 2, box: { x: 624, y: 124, w: 276, h: 360 } }],
}

/** 「两栏内容与图片」：三栏各 264 pt，内容占位符在屏幕上放不下整条图标条，折叠为「插入 ▾」 */
export const LAYOUT_TWO_CONTENT_PICTURE: PhLayout = {
  name: layoutName("two-content-picture"),
  kind: "two-content-picture",
  phs: [
    TITLE_PH,
    { id: "c1", type: "obj", idx: 1, box: { x: 60, y: 124, w: 264, h: 360 } },
    { id: "c2", type: "obj", idx: 2, box: { x: 348, y: 124, w: 264, h: 360 } },
    { id: "pic", type: "pic", idx: 3, box: { x: 636, y: 124, w: 264, h: 360 } },
  ],
}

/**
 * 本场景这份文档的母版（状态 data.mvMasters，场景级写一次；rulings §4.25 DS-174）：示例文档的两个母版，Office 母版末尾多第 7 页用的这两个版式（没有页面用时也在）。
 * 检查器顶行「转到版式」、普通视图「版式」字段与版式画廊、进入后母版视图的窗格与用量都按它认版式；全局的示例母版（MASTERS）不动，别的场景不受影响
 */
export const TEXT_EDIT_MASTERS: MasterDef[] = MASTERS.map((m) =>
  m.id === "office" ? { ...m, layouts: [...m.layouts, ...[LAYOUT_CONTENT_PICTURE, LAYOUT_TWO_CONTENT_PICTURE].map((l) => layoutDef(m.id, l.kind, l.name))] } : m,
)

/** obj 左上「• 单击此处添加文本」一行占的高度（pt）：图标条在其下方的区域里居中 */
export const OBJ_PROMPT_H = 48

const pct = (b: PtBox) => ({ left: `${(b.x / 960) * 100}%`, top: `${(b.y / 540) * 100}%`, width: `${(b.w / 960) * 100}%`, height: `${(b.h / 540) * 100}%` })

/**
 * 占位符表格网格选定尺寸后，该占位符填入表格（§4.22 Q1：宽取占位符框宽，行高 0.4 in = 28.8 pt，超出框高时不再加高）。
 * placeholder.tsx 写、这里画（表格是文档内容：画布、缩略图、网格都有）；撤销即清掉。
 */
export const PH_FILLED = "text-edit.ph-filled"

export interface PhFill {
  /** 填入的是哪个占位符 */
  id: string
  r: number
  c: number
  key: number
}

/** 填入的表格：默认表格样式（首行品牌色、隔行浅底，白色 0.1cqw 分隔线），空单元格 */
function PhTable({ box, r, c }: { box: PtBox; r: number; c: number }) {
  const h = Math.min(box.h, 28.8 * r)
  return (
    <div aria-hidden="true" className="absolute flex flex-col overflow-hidden" style={pct({ x: box.x, y: box.y, w: box.w, h })}>
      {Array.from({ length: r }, (_, i) => (
        <div key={i} className={cn("flex min-h-0 flex-1 border-b-[0.1cqw] border-white last:border-b-0", i === 0 ? "bg-(--s-brand)" : i % 2 ? "bg-(--s-note)" : "bg-(--s-card)")}>
          {Array.from({ length: c }, (_, j) => (
            <div key={j} className="flex-1 border-r-[0.1cqw] border-white last:border-r-0" />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * 空占位符页：虚线框与提示文字只画在画布上（覆盖层语义：不进缩略图、放映与导出），缩略图里只有页脚。
 * drop：图片文件正拖到这个占位符上（2px 强调色实线框 + 强调色 6% 底，画在纸面、随占位符缩放）。
 * editingObj：在这个内容占位符里编辑文字（提示文字隐去、出插入符）。
 * 已从图标条填入表格的占位符（PH_FILLED）画表格本身，不再画虚线框与提示。
 */
export function PlaceholderSlide({ where, layout, drop, editingObj }: SlideRenderOpts & { layout: PhLayout; drop?: string; editingObj?: string }) {
  const canvas = where === "canvas"
  const [filled] = useSceneState<PhFill | null>(PH_FILLED, null)
  const fill = filled && layout.phs.find((p) => p.id === filled.id)
  return (
    <>
      {fill && <PhTable box={fill.box} r={filled.r} c={filled.c} />}
      {canvas &&
        layout.phs.map((p) => {
          if (p.id === fill?.id) return null
          const dropping = drop === p.id
          return (
            <div
              key={p.id}
              className={cn(
                "absolute",
                dropping
                  ? "border-2 border-(--v3-accent) bg-[color-mix(in_srgb,var(--v3-accent)_6%,transparent)]"
                  : "border border-dashed border-[color-mix(in_srgb,var(--s-mute)_70%,transparent)]",
              )}
              style={pct(p.box)}
            >
              {p.type === "title" && (
                <p className="flex h-full items-center px-[1.6cqw] text-[3.4cqw] leading-none text-(--s-mute)">单击此处添加标题</p>
              )}
              {p.type === "obj" &&
                (editingObj === p.id ? (
                  <p className="flex items-center gap-[1.2cqw] px-[1.6cqw] pt-[1.4cqw] text-[2.2cqw] leading-[1.4] text-(--s-ink)">
                    <span className="size-[0.85cqw] rounded-full bg-(--s-ink)" aria-hidden="true" />
                    <Caret />
                  </p>
                ) : (
                  <p className="flex items-center gap-[1.2cqw] px-[1.6cqw] pt-[1.4cqw] text-[2.2cqw] leading-[1.4] text-(--s-mute)">
                    <span className="size-[0.85cqw] rounded-full bg-(--s-mute)" aria-hidden="true" />
                    单击此处添加文本
                  </p>
                ))}
            </div>
          )
        })}
      <SlideFooter page={7} />
    </>
  )
}
