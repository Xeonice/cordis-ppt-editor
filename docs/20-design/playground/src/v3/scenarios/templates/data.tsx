import type { CSSProperties, ReactNode } from "react"
import { CoverArt } from "../../CoverArt"
import { px, type Box } from "../../kit"
import { BUILTIN_THEMES, type BuiltinThemeId, type LayoutKind } from "../../editor/layouts/data"
import { ExtraCover } from "../../DocCover"

/**
 * 模板库的示例数据（DS-72 最小样张）。
 * - 内置 5 套：就是开始页「从模板开始」与编辑器主题画廊的 5 套（简约 / 商务 / 暗色 / 学术 / 活力，DS-33；模板 = 主题 + 母版 + 版式包，AS-03），
 *   名称、配色、字体取同一份数据（editor/layouts/data.ts BUILTIN_THEMES），封面就是首页模板卡的 CoverArt；版式 7 种（同示例文档的 Office 版式）。
 * - 集成方来源：示例来源名「公司模板」（不代表任何真实机构），3 套，封面是底座 DocCover.tsx 的真实渲染（原 documents/covers.tsx，2026-10-22 并入底座）；配色用 LayoutArt 的实时配色类（mt-live-a1 / mt-live-dk1）套上来源的品牌色。
 * - 母版（master）：每套模板自己的母版图形与底色，按版式分三组——标题幻灯片（就是封面的样子：同一条标题带、同一块底色、同样的图形，占位符落在封面标题与副标题的位置）·
 *   章节标题（同一套图形的变体）· 其余版式（标题和内容、两栏、比较、仅标题、空白：同一套的轻量图形）。预览里的版式缩略按它画（HAT-01：「使用此模板」后的首页就是标题版式，
 *   预览里看到的标题版式要与封面大图一致；标杆 Keynote 的主题缩略就是标题版式本身）。
 * 「空白」不在模板库里（新建空白在开始页与顶栏，rulings §4.25 TB-110）。
 */

export type SourceId = "builtin" | "org"

/** 集成方来源（RuntimeConfig 里配置的模板源，PD-23 待决；名称由集成方给） */
export const ORG_SOURCE = { id: "org" as const, name: "公司模板" }

/** 母版的一组版式（画在占位符之下）：底色类（只给集成方模板；内置主题的底色由主题类给）、图形（cqw 尺寸）、占位符在深色区域上（浅色提示）、标题 / 副标题占位符的位置（960 × 540 设计坐标） */
export interface MasterLayer {
  bg?: string
  art?: ReactNode
  inverse?: boolean
  title?: Box
  sub?: Box
  /** 标题与副标题居中（学术） */
  center?: boolean
}

export interface TemplateMaster {
  title: MasterLayer
  section: MasterLayer
  content: MasterLayer
}

export interface TemplateDef {
  id: string
  name: string
  source: SourceId
  cover: ReactNode
  /** 主题色条：强调色 1–6 */
  colors: string[]
  heading: string
  body: string
  layouts: LayoutKind[]
  /** 版式预览的配色：内置主题类，或集成方模板的实时配色类 + 变量 */
  previewClass?: string
  previewStyle?: CSSProperties
  master: TemplateMaster
}

const ALL7: LayoutKind[] = ["title", "title-content", "two-content", "comparison", "title-only", "section", "blank"]

/** 其余版式标题下的短线（Office 版式的标题框 60,50,840,70 之下） */
const UNDERLINE = <div className="absolute top-[13.4cqw] left-[6.25cqw] h-[0.55cqw] w-[4.2cqw] bg-(--s-brand)" />

/* ------------------------------------------------------------------ 内置 5 套（图形取主题的 --s-* 内容 token，与封面同一份） */

const MASTERS: Record<BuiltinThemeId, TemplateMaster> = {
  // 简约：白底，标题左对齐，标题下一截粗短线（封面「简约演示」）
  minimal: {
    title: { art: <div className="absolute top-[34.5cqw] left-[8cqw] h-[0.5cqw] w-[9cqw] bg-(--s-brand)" />, title: px(77, 186, 806, 100), sub: px(77, 356, 600, 48) },
    section: { art: <div className="absolute top-[30.2cqw] left-[8cqw] h-[0.5cqw] w-[9cqw] bg-(--s-brand)" />, title: px(77, 196, 806, 84), sub: px(77, 304, 806, 44) },
    content: { art: <div className="absolute top-[13.4cqw] left-[6.25cqw] h-[0.5cqw] w-[9cqw] bg-(--s-brand)" /> },
  },
  // 商务：藏青标题带（35cqw）+ 标题上方蓝色短条、右下一截细线；章节整页藏青；其余版式顶边一条藏青细带
  business: {
    title: {
      art: (
        <>
          <div className="absolute inset-x-0 top-0 h-[35cqw] bg-(--s-ink)" />
          <div className="absolute top-[11cqw] left-[8cqw] h-[0.7cqw] w-[5cqw] bg-(--s-brand)" />
          <div className="absolute right-[8cqw] bottom-[7cqw] h-[0.35cqw] w-[14cqw] bg-(--s-line)" />
        </>
      ),
      inverse: true,
      title: px(77, 128, 806, 84),
      sub: px(77, 222, 600, 44),
    },
    section: {
      art: (
        <>
          <div className="absolute inset-0 bg-(--s-ink)" />
          <div className="absolute top-[17.6cqw] left-[8cqw] h-[0.7cqw] w-[5cqw] bg-(--s-brand)" />
        </>
      ),
      inverse: true,
      title: px(77, 196, 806, 84),
      sub: px(77, 296, 806, 44),
    },
    content: {
      art: (
        <>
          <div className="absolute inset-x-0 top-0 h-[1.2cqw] bg-(--s-ink)" />
          {UNDERLINE}
        </>
      ),
    },
  },
  // 暗色：深底，右上两道圆环、标题下强调色短条
  dark: {
    title: {
      art: (
        <>
          <div className="absolute -top-[10cqw] -right-[12cqw] size-[56cqw] rounded-full border-[0.25cqw] border-(--s-line)" />
          <div className="absolute top-[5cqw] -right-[1cqw] size-[34cqw] rounded-full border-[0.25cqw] border-(--s-line)" />
          <div className="absolute top-[31.5cqw] left-[9cqw] h-[0.7cqw] w-[7cqw] bg-(--s-brand)" />
        </>
      ),
      title: px(86, 168, 760, 100),
      sub: px(86, 322, 600, 44),
    },
    section: {
      art: (
        <>
          <div className="absolute -right-[16cqw] -bottom-[20cqw] size-[56cqw] rounded-full border-[0.25cqw] border-(--s-line)" />
          <div className="absolute top-[30.2cqw] left-[9cqw] h-[0.7cqw] w-[7cqw] bg-(--s-brand)" />
        </>
      ),
      title: px(86, 196, 780, 84),
      sub: px(86, 304, 780, 44),
    },
    content: {
      art: (
        <>
          <div className="absolute -top-[9cqw] -right-[9cqw] size-[22cqw] rounded-full border-[0.25cqw] border-(--s-line)" />
          {UNDERLINE}
        </>
      ),
    },
  },
  // 学术：米色纸面，上下双线、标题居中（衬线由主题给）
  academic: {
    title: {
      art: (
        <>
          <div className="absolute inset-x-[9cqw] top-[7cqw] h-[0.2cqw] bg-(--s-ink)" />
          <div className="absolute inset-x-[9cqw] top-[8.4cqw] h-[0.1cqw] bg-(--s-ink)" />
          <div className="absolute inset-x-[9cqw] bottom-[8.4cqw] h-[0.1cqw] bg-(--s-ink)" />
          <div className="absolute inset-x-[9cqw] bottom-[7cqw] h-[0.2cqw] bg-(--s-ink)" />
        </>
      ),
      center: true,
      title: px(86, 168, 788, 96),
      sub: px(180, 288, 600, 44),
    },
    section: {
      art: (
        <>
          <div className="absolute inset-x-[9cqw] top-[7cqw] h-[0.2cqw] bg-(--s-ink)" />
          <div className="absolute inset-x-[9cqw] top-[8.4cqw] h-[0.1cqw] bg-(--s-ink)" />
        </>
      ),
      center: true,
      title: px(86, 196, 788, 84),
      sub: px(180, 296, 600, 44),
    },
    content: {
      art: (
        <>
          <div className="absolute inset-x-[6.25cqw] top-[13.4cqw] h-[0.1cqw] bg-(--s-ink)" />
          <div className="absolute inset-x-[6.25cqw] bottom-[4.4cqw] h-[0.1cqw] bg-(--s-ink)" />
          <div className="absolute inset-x-[6.25cqw] bottom-[3cqw] h-[0.2cqw] bg-(--s-ink)" />
        </>
      ),
    },
  },
  // 活力：左侧强调色色块 + 黄圆、青方、黑色四分之一圆，标题在右；章节色块收窄；其余版式左缘一条强调色
  vibrant: {
    title: {
      art: (
        <>
          <div className="absolute inset-y-0 left-0 w-[40cqw] bg-(--s-brand)" />
          <div className="absolute top-[8cqw] left-[9cqw] size-[19cqw] rounded-full bg-(--s-a2)" />
          <div className="absolute top-[31cqw] left-[20cqw] size-[14cqw] bg-(--s-a3)" />
          <div className="absolute bottom-0 left-0 h-[13cqw] w-[13cqw] rounded-tr-full bg-(--s-ink)" />
        </>
      ),
      title: px(451, 158, 470, 100),
      sub: px(451, 288, 420, 44),
    },
    section: {
      art: (
        <>
          <div className="absolute inset-y-0 left-0 w-[28cqw] bg-(--s-brand)" />
          <div className="absolute top-[18cqw] left-[7cqw] size-[14cqw] rounded-full bg-(--s-a2)" />
        </>
      ),
      title: px(310, 196, 610, 84),
      sub: px(310, 296, 610, 44),
    },
    content: {
      art: (
        <>
          <div className="absolute inset-y-0 left-0 w-[1.6cqw] bg-(--s-brand)" />
          {UNDERLINE}
        </>
      ),
    },
  },
}

export const BUILTIN_TEMPLATES: TemplateDef[] = BUILTIN_THEMES.map((t) => ({
  id: t.id,
  name: t.name,
  source: "builtin",
  cover: <CoverArt id={t.id as BuiltinThemeId} />,
  colors: t.slots.slice(4, 10).map((s) => s.hex),
  heading: t.heading,
  body: t.body,
  layouts: ALL7,
  previewClass: t.className,
  master: MASTERS[t.id as BuiltinThemeId],
}))

/* ------------------------------------------------------------------ 集成方来源 3 套（颜色同各自的封面） */

const live = (a1: string, dk1: string) => ({ previewClass: "mt-live-a1 mt-live-dk1", previewStyle: { "--mt-a1": a1, "--mt-dk1": dk1 } as CSSProperties })

/** 公司标识（季度经营汇报的母版图形：方块 + 字样，同封面） */
const ORG_MARK = (
  <div className="absolute top-[9cqw] left-[8cqw] flex items-center gap-[1.2cqw]">
    <span className="size-[3.6cqw] rounded-[0.8cqw] bg-[#0E7C7B]" />
    <span className="text-[1.8cqw] leading-none font-medium text-[#0E7C7B]">公司标识</span>
  </div>
)

export const ORG_TEMPLATES: TemplateDef[] = [
  {
    id: "tpl-report",
    name: "季度经营汇报",
    source: "org",
    cover: <ExtraCover id="tpl-report" />,
    colors: ["#0E7C7B", "#12302F", "#3FA6A2", "#9FD3CF", "#F0A030", "#5B7472"],
    heading: "思源黑体",
    body: "思源黑体",
    layouts: ALL7,
    ...live("#0E7C7B", "#12302F"),
    // 白底、顶边一条青色带、左上公司标识、右下一截浅青细线
    master: {
      title: {
        art: (
          <>
            <div className="absolute inset-x-0 top-0 h-[2.4cqw] bg-[#0E7C7B]" />
            {ORG_MARK}
            <div className="absolute right-[8cqw] bottom-[8cqw] h-[0.3cqw] w-[16cqw] bg-[#9FD3CF]" />
          </>
        ),
        title: px(77, 175, 806, 96),
        sub: px(77, 282, 600, 44),
      },
      section: {
        art: (
          <>
            <div className="absolute inset-x-0 top-0 h-[2.4cqw] bg-[#0E7C7B]" />
            {ORG_MARK}
            <div className="absolute top-[20.8cqw] left-[5.2cqw] h-[8.8cqw] w-[0.8cqw] bg-[#0E7C7B]" />
          </>
        ),
        title: px(77, 196, 806, 84),
        sub: px(77, 296, 806, 44),
      },
      content: {
        art: (
          <>
            <div className="absolute inset-x-0 top-0 h-[1.2cqw] bg-[#0E7C7B]" />
            <span className="absolute top-[2.2cqw] right-[6.25cqw] size-[2.4cqw] rounded-[0.6cqw] bg-[#0E7C7B]" />
            <div className="absolute right-[6.25cqw] bottom-[4cqw] h-[0.3cqw] w-[12cqw] bg-[#9FD3CF]" />
            {UNDERLINE}
          </>
        ),
      },
    },
  },
  {
    id: "tpl-kickoff",
    name: "项目立项",
    source: "org",
    cover: <ExtraCover id="tpl-kickoff" />,
    colors: ["#0E7C7B", "#0B6564", "#3FA6A2", "#BFE6E3", "#F0A030", "#12302F"],
    heading: "思源黑体",
    body: "苹方",
    layouts: ["title", "title-content", "two-content", "title-only", "section", "blank"],
    ...live("#0B6564", "#12302F"),
    // 整页青色 + 右侧斜切的深青块与一道浅青斜条（标题与章节）；其余版式白底、顶边青色带
    master: {
      title: {
        bg: "bg-[#0E7C7B]",
        art: (
          <>
            <div className="absolute top-0 -right-[6cqw] h-full w-[34cqw] -skew-x-12 bg-[#0B6564]" />
            <div className="absolute top-0 right-[22cqw] h-full w-[3cqw] -skew-x-12 bg-[#3FA6A2]" />
          </>
        ),
        inverse: true,
        title: px(77, 158, 560, 100),
        sub: px(77, 272, 520, 44),
      },
      section: {
        bg: "bg-[#0E7C7B]",
        art: <div className="absolute top-0 right-[10cqw] h-full w-[3cqw] -skew-x-12 bg-[#3FA6A2]" />,
        inverse: true,
        title: px(77, 196, 640, 84),
        sub: px(77, 296, 640, 44),
      },
      content: {
        art: (
          <>
            <div className="absolute inset-x-0 top-0 h-[1.6cqw] bg-[#0E7C7B]" />
            {UNDERLINE}
          </>
        ),
      },
    },
  },
  {
    id: "tpl-training",
    name: "培训课件",
    source: "org",
    cover: <ExtraCover id="tpl-training" />,
    colors: ["#0E7C7B", "#2E5754", "#4D6E6B", "#9ED8D4", "#F0A030", "#12302F"],
    heading: "思源黑体",
    body: "思源黑体",
    layouts: ["title", "title-content", "two-content", "section", "blank"],
    ...live("#0E7C7B", "#2E5754"),
    // 浅青纸面；标题页右侧三条目录色块（首条青色，同封面）；章节左侧青色序号块
    master: {
      title: {
        bg: "bg-[#EEF7F6]",
        art: (
          <div className="absolute top-[12cqw] right-[8cqw] flex w-[30cqw] flex-col gap-[1.8cqw]">
            {["bg-[#0E7C7B]", "bg-white", "bg-white"].map((c, i) => (
              <div key={i} className={`h-[5.4cqw] rounded-[0.8cqw] ${c}`} />
            ))}
          </div>
        ),
        title: px(77, 96, 500, 96),
        sub: px(77, 204, 460, 44),
      },
      section: {
        bg: "bg-[#EEF7F6]",
        art: <div className="absolute top-[19cqw] left-[8cqw] size-[10cqw] rounded-[1.2cqw] bg-[#0E7C7B]" />,
        title: px(202, 182, 700, 84),
        sub: px(202, 282, 700, 44),
      },
      content: { bg: "bg-[#EEF7F6]", art: UNDERLINE },
    },
  },
]

export const ALL_TEMPLATES: TemplateDef[] = [...BUILTIN_TEMPLATES, ...ORG_TEMPLATES]

export const templateOf = (id: string): TemplateDef => ALL_TEMPLATES.find((t) => t.id === id) ?? BUILTIN_TEMPLATES[0]!
