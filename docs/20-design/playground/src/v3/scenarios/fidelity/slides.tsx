import { ChartColumnDecreasing, FileWarning, Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import { DEFAULT_DECK, deckWith, DegradedPlaceholder, PagePlaceholder, SlideFooter, SlideTitle, type DeckSlide } from "../../kit"
import type { Variant } from "./data"
import { useExtLoaded } from "./store"

/**
 * fidelity 场景的文档：示例文档 6 页之后接两页导入进来的内容（画在 SlideFrame 里，尺寸一律 cqw，颜色用 --s-*，缩略图与画布同一份渲染）。
 * - 第 7 页「成本结构」：右侧是一张瀑布图（chartex），画不出来，原位显示元素级占位（03-13「降级占位三层」元素级）：底座 DegradedPlaceholder——
 *   虚线框 + 类型图标 + 一行标题 + 一行原因，与缺插件占位同一画法与字号（rulings §4.25 DS-52「同属降级对象」），不遮挡相邻元素。
 * - 第 8 页「附录」：SmartArt 组织结构图（按 dsp:drawing 渲染为静态图形）、嵌入的 Excel 工作表（OLE 预览图）、EMF 标志（已转为图片）、外部图片（cdn.example.com）。
 *   这些都能画出来，按 03-13「能渲染的不显示任何降级标记」画成原样，只在保真报告里登记。
 * 变体：parse 第 8 页整页无法解析（页级占位「此页内容无法解析」，F1 E2）；confirm 外部图片先显示「此图片来自外部网站」占位（externalResources = confirm）；
 * generating 第 6–8 页还是版式骨架（03-13「其余页面加载中 x/N」）；clean 只有示例文档 6 页（完全保真）。
 * 占位的配色与 main-states 缺插件占位一致（虚线 --s-mute、底 --s-card），状态色不进纸面。
 */

/** 元素级占位的外框（虚线、浅底；缩略图里至少 1px） */
const PLACEHOLDER = "flex flex-col items-center justify-center rounded-[0.6cqw] border-[max(1px,0.14cqw)] border-dashed border-(--s-mute)/70 bg-(--s-card) text-center"

/* ------------------------------------------------------------------ 第 7 页：成本结构 */

const COSTS = [
  { name: "人力", share: "52%", amount: "4,139" },
  { name: "云资源", share: "21%", amount: "1,672" },
  { name: "营销", share: "15%", amount: "1,194" },
  { name: "其他", share: "12%", amount: "955" },
]

function CostPage() {
  return (
    <>
      <SlideTitle>成本结构</SlideTitle>
      {/* 正文文本框（导入时用的「汉仪旗黑」缺失，以「思源黑体」显示） */}
      <div className="absolute top-[19cqw] left-[7cqw] w-[34cqw]">
        <p className="text-[1.7cqw] leading-none font-medium text-(--s-body)">Q2 总成本</p>
        <p className="mt-[1.6cqw] flex items-baseline text-[5.4cqw] leading-none font-bold tracking-[-0.01em] tabular-nums">
          7,960<span className="ml-[0.6cqw] text-[2.6cqw] font-semibold">万元</span>
        </p>
        <p className="mt-[1.4cqw] text-[1.7cqw] leading-[1.4] text-(--s-body)">同比 +9%，低于营收增速（+18%）</p>
        <ul className="mt-[2.4cqw] border-t-[0.12cqw] border-(--s-line)">
          {COSTS.map((c) => (
            <li key={c.name} className="flex h-[3.6cqw] items-center border-b-[0.12cqw] border-(--s-line) text-[1.8cqw] leading-none">
              <span className="flex-1 font-medium">{c.name}</span>
              <span className="w-[9cqw] text-right text-(--s-body) tabular-nums">{c.amount}</span>
              <span className="w-[7cqw] text-right font-semibold tabular-nums">{c.share}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* 瀑布图（chartex）：暂不支持显示，原位占位（不显示文件里「此图表在你的版本中不可用」那段兜底文字，03-13）；位置与 data.ts CHARTEX_BOX 同一组数 */}
      <DegradedPlaceholder
        icon={ChartColumnDecreasing}
        title="瀑布图暂不支持显示"
        reason="已原样保留，导出后可在 PowerPoint 查看"
        className="absolute top-[17cqw] left-[46cqw] h-[31cqw] w-[47cqw]"
      />
      <SlideFooter page={7} />
    </>
  )
}

/* ------------------------------------------------------------------ 第 8 页：附录 */

/** SmartArt 组织结构图：按包内 dsp:drawing 渲染的静态图形（OF-10） */
function OrgChart() {
  const teams = [
    { name: "平台组", sub: "6 人" },
    { name: "应用组", sub: "9 人" },
    { name: "设计组", sub: "4 人" },
  ]
  return (
    <div className="absolute top-[19cqw] left-[7cqw] h-[28cqw] w-[40cqw]">
      <p className="text-[1.6cqw] leading-none font-medium text-(--s-body)">项目组织</p>
      <div className="absolute top-[4.4cqw] left-1/2 flex h-[5cqw] w-[15cqw] -translate-x-1/2 flex-col items-center justify-center rounded-[0.6cqw] bg-(--s-brand) text-white">
        <span className="text-[1.8cqw] leading-none font-semibold">项目组</span>
        <span className="mt-[0.5cqw] text-[1.3cqw] leading-none opacity-80">周明远</span>
      </div>
      {/* 连线：上方节点 → 横线 → 三个下级 */}
      <div className="absolute top-[9.4cqw] left-1/2 h-[2.2cqw] w-[0.14cqw] -translate-x-1/2 bg-(--s-mute)/60" />
      <div className="absolute top-[11.6cqw] right-[6.5cqw] left-[6.5cqw] h-[0.14cqw] bg-(--s-mute)/60" />
      <div className="absolute inset-x-0 top-[11.6cqw] grid grid-cols-3 gap-[1.5cqw]">
        {teams.map((t) => (
          <div key={t.name} className="flex flex-col items-center">
            <div className="h-[2.2cqw] w-[0.14cqw] bg-(--s-mute)/60" />
            <div className="flex h-[5.6cqw] w-full flex-col items-center justify-center rounded-[0.6cqw] bg-(--s-brand-soft)">
              <span className="text-[1.7cqw] leading-none font-semibold">{t.name}</span>
              <span className="mt-[0.6cqw] text-[1.3cqw] leading-none text-(--s-body)">{t.sub}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="absolute top-[22.6cqw] left-0 text-[1.4cqw] leading-[1.5] text-(--s-mute)">三个小组分别负责数据接入、报表与看板、交付规范。</p>
    </div>
  )
}

/** 嵌入的 Excel 工作表：显示包内预览图（mc:Fallback 的图片），这里按预览图的样子画（网格线、列标、行号） */
function SheetPreview() {
  const rows = [
    ["项目", "Q1", "Q2"],
    ["人力", "3,980", "4,139"],
    ["云资源", "1,412", "1,672"],
    ["营销", "1,276", "1,194"],
  ]
  return (
    <div className="absolute top-[19cqw] left-[51cqw] h-[13.5cqw] w-[42cqw] overflow-hidden border-[max(1px,0.1cqw)] border-(--s-mute)/50 bg-white">
      <div className="flex h-[2.3cqw] items-center bg-(--s-card) px-[1cqw] text-[1.25cqw] leading-none font-semibold text-(--s-ink)">Q2 成本明细（万元）</div>
      <div className="grid grid-cols-[3cqw_1fr_1fr_1fr] text-[1.25cqw] leading-none">
        {["", "A", "B", "C"].map((h, i) => (
          <div key={`h${i}`} className="flex h-[2.2cqw] items-center justify-center border-t border-r border-(--s-line) bg-(--s-card) text-(--s-mute)">
            {h}
          </div>
        ))}
        {rows.map((r, ri) => (
          <div key={r[0]} className="contents">
            <div className="flex h-[2.2cqw] items-center justify-center border-t border-r border-(--s-line) bg-(--s-card) text-(--s-mute) tabular-nums">{ri + 1}</div>
            {r.map((c, ci) => (
              <div key={`${r[0]}-${ci}`} className={cn("flex h-[2.2cqw] items-center border-t border-r border-(--s-line) px-[0.8cqw] tabular-nums", ci > 0 && "justify-end", ri === 0 && "font-semibold")}>
                {c}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** 门店分布：外部图片（https://cdn.example.com/…），externalResources = auto 时自动加载。画成一张图（viewBox 与框同比例 420 × 120，点不变形） */
const STORES = [
  [76, 36], [100, 58], [130, 48], [160, 68], [186, 40], [218, 76], [244, 52], [266, 86], [296, 62], [320, 42], [346, 72], [198, 94], [148, 86],
] as const

function StoreMap() {
  return (
    <div className="absolute top-[35cqw] left-[51cqw] h-[12cqw] w-[42cqw] overflow-hidden rounded-[0.6cqw] bg-(--s-brand-soft)">
      <svg viewBox="0 0 420 120" aria-hidden="true" className="absolute inset-0 size-full">
        <path d="M24 88 C 84 70, 126 98, 186 82 S 296 60, 396 72" fill="none" strokeWidth="2" className="stroke-(--s-brand-mid)" />
        <path d="M40 34 C 110 22, 168 44, 244 30 S 344 20, 404 34" fill="none" strokeWidth="2" className="stroke-(--s-brand-mid)" />
        {STORES.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="4.5" strokeWidth="2" className="fill-(--s-brand) stroke-white" />
        ))}
      </svg>
      <span className="absolute top-[0.9cqw] left-[1cqw] rounded-[0.4cqw] bg-white/85 px-[0.8cqw] py-[0.5cqw] text-[1.25cqw] leading-none font-semibold text-(--s-ink)">门店分布 · 128 家</span>
    </div>
  )
}

/** externalResources = confirm：先显示来源域名占位，画布上叠「加载」按钮（按钮是纸面上的界面件，画在 slideOverlay，见 canvas.tsx） */
function ExternalPlaceholder() {
  return (
    <div className={cn(PLACEHOLDER, "absolute top-[35cqw] left-[51cqw] h-[12cqw] w-[42cqw] items-start gap-[0.7cqw] px-[2cqw]")}>
      <span className="flex items-center gap-[0.8cqw]">
        <Globe className="size-[2cqw] text-(--s-mute)" strokeWidth={1.5} aria-hidden="true" />
        <span className="text-[1.5cqw] leading-none font-semibold text-(--s-ink)">此图片来自外部网站</span>
      </span>
      <span className="text-[1.3cqw] leading-none text-(--s-body)">cdn.example.com</span>
    </div>
  )
}

/** 外部图片：confirm 变体里没点「加载」时是占位，点了之后（本次打开内有效）画出图片 */
function ExternalImage({ confirm }: { confirm: boolean }) {
  const [loaded] = useExtLoaded()
  return confirm && !loaded ? <ExternalPlaceholder /> : <StoreMap />
}

function AppendixPage({ confirm }: { confirm: boolean }) {
  return (
    <>
      <SlideTitle>附录</SlideTitle>
      {/* EMF 标志（M2 起已转为图片显示，导出时保留原文件） */}
      <div className="absolute top-[6.3cqw] left-[81cqw] flex h-[4.2cqw] w-[12cqw] items-center justify-end gap-[0.8cqw]">
        <span className="flex size-[2.8cqw] items-center justify-center rounded-[0.6cqw] bg-(--s-ink) text-[1.5cqw] leading-none font-bold text-white">A</span>
        <span className="text-[2cqw] leading-none font-bold tracking-[0.06em]">ACME</span>
      </div>
      <OrgChart />
      <SheetPreview />
      <ExternalImage confirm={confirm} />
      <SlideFooter page={8} />
    </>
  )
}

/** 整页解析失败（03-13 页级占位「此页内容无法解析」，F1 E2）：母版的页脚照常，页面内容区是一个占位（kit PagePlaceholder，2026-10-22 第 3 批转正并入 kit，画法不变） */
function UnparsedPage() {
  return <PagePlaceholder icon={FileWarning} title="此页内容无法解析" reason="原内容已保留，导出时原样写回；其余页面不受影响" page={8} />
}

/* ------------------------------------------------------------------ 版式骨架（生成中：其余页面还没解析，与 main-states 打开中同一画法） */

const PH = "absolute rounded-[0.5cqw] border-[max(1px,0.13cqw)] border-dashed border-(--s-mute)/45"

function Skeleton({ page }: { page: number }) {
  return (
    <>
      <div className={cn(PH, "top-[5.6cqw] left-[7cqw] h-[6.6cqw] w-[40cqw]")} />
      <div className="absolute top-[13.4cqw] left-[7cqw] h-[0.55cqw] w-[4.2cqw] bg-(--s-brand)" />
      <SlideFooter page={page} />
    </>
  )
}

/* ------------------------------------------------------------------ 各变体的文档 */

const P7: DeckSlide = { n: 7, name: "成本结构", layout: "仅标题", render: () => <CostPage /> }
const p8 = (confirm: boolean): DeckSlide => ({ n: 8, name: "附录", layout: "仅标题", render: () => <AppendixPage confirm={confirm} /> })

export function deckFor(v: Variant): DeckSlide[] {
  switch (v) {
    case "clean":
      return DEFAULT_DECK
    case "parse":
      return deckWith({}, [P7, { n: 8, name: "附录", layout: "仅标题", render: () => <UnparsedPage /> }])
    case "generating":
      return deckWith({ 6: { render: () => <Skeleton page={6} />, comments: 0 } }, [
        { n: 7, name: "成本结构", layout: "仅标题", render: () => <Skeleton page={7} /> },
        { n: 8, name: "附录", layout: "仅标题", render: () => <Skeleton page={8} /> },
      ])
    case "confirm":
      return deckWith({}, [P7, p8(true)])
    default:
      return deckWith({}, [P7, p8(false)])
  }
}
