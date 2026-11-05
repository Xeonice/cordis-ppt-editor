import { useEffect, useLayoutEffect } from "react"
import { deckWith, RailList, RailThumb, scrollIntoPanel, SlideFooter, SlideTitle, useSceneState, type DeckSlide, type EditorCtx } from "../../kit"

/**
 * import 场景 thumbs-virtualized：200 页文档的缩略图虚拟化（03-13 G-05、PRD OF-15 M1 P0、PRD 07 G-05 的「占位」一态）。
 * 文档是示例文档 6 页之后接 194 页附录「客户回款明细」（每页 6 家客户，按签约时间排列；数据按页码算出，缩略图与画布同一份真实渲染）。
 * 左栏只为视口附近的页生成缩略图（数值以前端 50/10 §6 为准），还没生成好的页在原位画成与缩略图同尺寸的中性块（panel-2，
 * 同第 1 批母版视图加载中的占位块——DS-53 豁免的同一画法），页码照常在左侧，读屏名照常「第 n 页」（可访问树不随虚拟化裁剪，50/05 §11）。
 */

const TOTAL = 200

/* ================================================================== 附录页：客户回款明细 */

/** 客户（示例名，不对应真实企业）与所在城市 → 区域 */
const NAMES = ["星河科技", "远航物流", "金桥制造", "海川医疗", "云帆教育", "瑞丰零售", "博远能源", "恒通汽车", "嘉禾食品", "启明软件", "新程置业", "众诚咨询", "华晟电子", "天衡化工", "安宏建材", "明德传媒", "鼎盛机械", "润泽环保", "长青农业", "锦程纺织", "蓝海航运", "思远数据", "君和酒店", "青禾生物"]
const CITIES: { city: string; region: string }[] = [
  { city: "上海", region: "华东" },
  { city: "杭州", region: "华东" },
  { city: "南京", region: "华东" },
  { city: "苏州", region: "华东" },
  { city: "广州", region: "华南" },
  { city: "深圳", region: "华南" },
  { city: "厦门", region: "华南" },
  { city: "北京", region: "华北" },
  { city: "天津", region: "华北" },
  { city: "济南", region: "华北" },
  { city: "成都", region: "西部" },
  { city: "重庆", region: "西部" },
  { city: "西安", region: "西部" },
]

interface Receivable {
  name: string
  region: string
  /** 合同额（万元） */
  contract: number
  /** 已回款（万元） */
  paid: number
  /** 回款率（%） */
  rate: number
}

const PER_PAGE = 6
const FIRST_APPENDIX = 7

/** 全部附录行（194 页 × 6 行，按签约顺序，不排序：同一页的数各不相同）；第一次用到时才算（模块顶层只放常量） */
let ROWS: Receivable[] | null = null
function allRows(): Receivable[] {
  if (ROWS) return ROWS
  const out: Receivable[] = []
  for (let k = 0; k < (TOTAL - FIRST_APPENDIX + 1) * PER_PAGE; k++) {
    const c = CITIES[(k * 5) % CITIES.length]!
    const contract = 80 + ((k * 37) % 420)
    const rate = 35 + ((k * 23) % 61)
    out.push({ name: `${c.city}${NAMES[(k * 7) % NAMES.length]}`, region: c.region, contract, paid: Math.round((contract * rate) / 100), rate })
  }
  ROWS = out
  return ROWS
}

const COLS = "grid grid-cols-[34fr_12fr_14fr_14fr_12fr] items-center gap-x-[1.6cqw]"

function DetailPage({ n }: { n: number }) {
  const start = (n - FIRST_APPENDIX) * PER_PAGE
  const rows = allRows().slice(start, start + PER_PAGE)
  return (
    <>
      <SlideTitle>附录 · 客户回款明细</SlideTitle>
      <p className="absolute top-[15.2cqw] right-[7cqw] text-[1.3cqw] leading-none text-(--s-body)">单位：万元 · 按签约时间排列</p>
      <div className="absolute top-[18cqw] left-[7cqw] w-[86cqw]">
        <div className={`${COLS} h-[3.6cqw] border-b-[0.12cqw] border-(--s-line) text-[1.45cqw] leading-none text-(--s-body)`}>
          <span>客户</span>
          <span>区域</span>
          <span className="text-right">合同额</span>
          <span className="text-right">已回款</span>
          <span className="text-right">回款率</span>
        </div>
        {rows.map((r) => (
          <div key={r.name + r.contract} className={`${COLS} h-[4.2cqw] border-b-[0.12cqw] border-(--s-line) text-[1.75cqw] leading-none`}>
            <span className="truncate font-medium">{r.name}</span>
            <span className="text-(--s-body)">{r.region}</span>
            <span className="text-right tabular-nums">{r.contract}</span>
            <span className="text-right tabular-nums">{r.paid}</span>
            <span className="text-right font-semibold tabular-nums">{`${r.rate}%`}</span>
          </div>
        ))}
      </div>
      <SlideFooter page={n} />
    </>
  )
}

/** 200 页的文档：第 1–6 页是示例文档原样，第 7–200 页是附录 */
export const BIG_DECK: DeckSlide[] = deckWith(
  {},
  Array.from({ length: TOTAL - FIRST_APPENDIX + 1 }, (_, i) => {
    const n = FIRST_APPENDIX + i
    return { n, name: "附录 · 客户回款明细", layout: "仅标题", render: () => <DetailPage n={n} /> }
  }),
)

/** 用跳页提示条（03-20 §7）从第 2 页转到的这一页 */
export const BIG_CURRENT = 120

/* ================================================================== 左栏：虚拟化的缩略图列表 */

/**
 * 一出现时已生成的缩略图：画布先画当前页，缩略图从当前页向两边生成——第 118–121 页已好，刚滚进视口上下两端的页（第 117、122、123 页）还在生成。
 * 演示：第一次点按、按键或滚动之后，停下约 0.4 秒就把视口上下各约 6 页（overscan）生成好；继续滚动，新滚进来的页先是中性块，停下后再换成缩略图。
 */
const INITIAL_READY = [118, 119, 120, 121]
/** 视口外预先生成的范围（约 6 页高） */
const OVERSCAN_PX = 6 * 122

export function VirtualRail({ ctx }: { ctx: EditorCtx }) {
  const [ready, setReady] = useSceneState<number[]>("import.thumbs-ready", INITIAL_READY)
  const done = new Set(ready)

  // 打开时左栏滚到当前页（放在视口中间；只滚左栏自己的滚动区）
  useLayoutEffect(() => {
    scrollIntoPanel(document.querySelector<HTMLElement>(`[data-v3-anchor="thumb-${ctx.slide}"]`), { align: "center" })
    // 只在挂载时（进入这一态、网格视图切回单页）对齐一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(`[data-v3-anchor="thumb-${BIG_CURRENT}"]`)?.closest("nav")
    if (!nav) return
    // 用户第一次点按、按键或滚轮之前不动（打开时自己滚到当前页的那一下不算），静态截图不受时序影响
    let armed = false
    let timer = 0
    const settle = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const box = nav.getBoundingClientRect()
        const near: number[] = []
        nav.querySelectorAll<HTMLElement>('[data-v3-anchor^="thumb-"]').forEach((el) => {
          const r = el.getBoundingClientRect()
          if (r.bottom >= box.top - OVERSCAN_PX && r.top <= box.bottom + OVERSCAN_PX) near.push(Number(el.dataset.v3Anchor?.slice("thumb-".length)))
        })
        setReady((prev) => {
          const next = new Set(prev)
          for (const n of near) next.add(n)
          return next.size === prev.length ? prev : [...next]
        })
      }, 400)
    }
    const arm = () => {
      armed = true
      settle()
    }
    const onScroll = () => armed && settle()
    document.addEventListener("pointerdown", arm, true)
    document.addEventListener("keydown", arm, true)
    nav.addEventListener("wheel", arm, { passive: true })
    nav.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      document.removeEventListener("pointerdown", arm, true)
      document.removeEventListener("keydown", arm, true)
      nav.removeEventListener("wheel", arm)
      nav.removeEventListener("scroll", onScroll)
      window.clearTimeout(timer)
    }
  }, [setReady])

  return (
    <RailList>
      {ctx.deck.map((s) => (
        // 还没生成缩略图的页：kit RailThumb pending（与缩略图同尺寸的中性块，不画转圈与文字；第 3 批转正时由这里的局部写法并入）
        <RailThumb key={s.n} slide={s} pending={!done.has(s.n)} current={s.n === ctx.slide} onPick={ctx.goTo} />
      ))}
    </RailList>
  )
}
