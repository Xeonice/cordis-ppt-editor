import { LoaderCircle, Puzzle, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Banner, Button, deckWith, DegradedPlaceholder, failedPluginsCopy, ICON, PluginBanner, RailList, RailThumb, SlideFooter, SlideTitle, useEditor, useSceneState, type DeckSlide } from "../../kit"
import { QrSlide } from "../main-states/slides"
import type { EditorConfig } from "../types"
import { SI } from "./bits"
import { MISSING } from "./data"
import { goAdmin } from "./PluginList"
import { usePlugins } from "./store"

/**
 * 插件横幅（03-09 §6、03-02 §6.2「插件横幅」）接上本场景的个人插件面板：「查看详情」真的打开面板（第 1 批 main-states 的同名横幅只画外观）。
 * 文案与第 1 批拍板的横幅逐字一致；新增两种：同时缺多个插件（03-09 §6.2 表末行）、「插件设置已更新」点了「重新加载」之后的保存中。
 * 画法（rulings §4.25 DS-41）：插件横幅一律不阻断编辑，所以用中性底加状态色图标——缺少插件是警告色拼图、启动失败是危险色图标，读屏仍是 role=status
 * （kit PluginBanner，第 1 批 main-states.plugin-missing / -undeclared / -version / plugin-failed 用的是同一个件）；不再整条铺警告 / 危险浅底
 * （启动失败的粉底比「其余功能照常」读起来更严重，也吃掉了次按钮的细边，见标杆对照）。
 */

/**
 * 插件启动失败（取代原状态栏入口，DS-6）：kit PluginBanner 中性底 + 危险色图标、不阻断（role=status，DS-41）；「查看详情」打开面板，失败行排在两组各自的最前（TB-78）。
 * 标题按 DS-55：一个插件失败时「插件「X」未能启动」、说明行只写「暂时不可用，其余功能照常」；多个时「N 个插件启动失败」、说明行列出名字（kit failedPluginsCopy）。
 * × 的读屏名「关闭提示」（03-12 §2.6 可关闭横幅的口径，与缺少插件横幅同一个；kit Banner 缺省是「关闭横幅」）
 */
export function FailedBanner({ names = ["现场投票", "演示激光笔"], onClose }: { names?: string[]; onClose?: () => void }) {
  const api = usePlugins()
  const copy = failedPluginsCopy(names)
  return (
    <PluginBanner
      kind="failed"
      title={copy.title}
      actions={
        <Button variant="secondary" onClick={api.openPanel}>
          查看详情
        </Button>
      }
      onClose={onClose ?? (() => undefined)}
      closeLabel="关闭提示"
    >
      {copy.names}
      {copy.text}
    </PluginBanner>
  )
}

const MISSING_TOTAL = MISSING.reduce((a, m) => a + m.count, 0)

/** 同时缺多个插件：标题「本文档用到了 N 个当前不可用的插件」，说明行同一句；平台管理员多「去管理 › 插件」。kit PluginBanner 中性底 + 警告色拼图（DS-41） */
export function MissingManyBanner({ onClose }: { onClose?: () => void }) {
  const api = usePlugins()
  return (
    <PluginBanner
      kind="missing"
      title={`本文档用到了 ${MISSING.length} 个当前不可用的插件`}
      actions={
        <>
          <Button variant="secondary" onClick={api.openPanel}>
            查看详情
          </Button>
          {api.admin && (
            <Button variant="secondary" onClick={() => goAdmin()}>
              去管理 › 插件
            </Button>
          )}
        </>
      }
      onClose={onClose ?? (() => undefined)}
      closeLabel="关闭提示"
    >
      {MISSING_TOTAL} 处内容以占位显示，内容已保留；可选中、移动或删除，暂不能编辑内部
    </PluginBanner>
  )
}

/** 「插件设置已更新」（与第 1 批 main-states.plugin-settings 逐字一致）：信息横幅、「重新加载」，× 即稍后再说 */
function SettingsBanner({ onClose }: { onClose?: () => void }) {
  return (
    <Banner
      icon={<RefreshCw {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />}
      title="管理员更新了插件设置，重新加载后生效"
      actions={<Button variant="secondary">重新加载</Button>}
      onClose={onClose ?? (() => undefined)}
      closeLabel="稍后再说"
    >
      未同步的更改会先保存再刷新；你可以先继续编辑，稍后再重新加载
    </Banner>
  )
}

/** 同时成立的插件横幅的先后（DS-54）：缺少插件 > 启动失败 > 设置已更新 */
export type PluginBannerKind = "missing" | "failed" | "settings"
const QUEUE: PluginBannerKind[] = ["missing", "failed", "settings"]

/**
 * 插件横幅的先后（03-02 §6.2 只写了「先显示缺少插件」；50/10 §11 规则 10 推迟到第 2 批，rulings §4.25 DS-54 定稿）：
 * 同一时刻只放一条，按「缺少插件 > 启动失败 > 设置已更新」取第一条没关过的；关掉一条（×）才轮到下一条，本会话内关过的不再出现。
 * 启动失败横幅关掉后，只在本会话有新插件进入 FAILED 时再出现一次、只写新失败的插件（见 failed-reshow）；失败本身一直在个人插件面板里。
 * 场景状态 data.bannerClosed 给初值（本会话里已经关过的）；failedNames 是这一条要写的插件。
 */
export function PluginBannerQueue({ failedNames }: { failedNames?: string[] }) {
  const { data } = useEditor()
  const [closed, setClosed] = useSceneState<PluginBannerKind[]>("plugins.banner-closed", () => (data.bannerClosed as PluginBannerKind[] | undefined) ?? [])
  const next = QUEUE.find((k) => !closed.includes(k))
  if (!next) return null
  const close = () => setClosed((c) => [...c, next])
  // key：换成下一条时是一条新横幅（kit Banner 自己记着「已关闭」，不能沿用上一条的）
  if (next === "missing") return <MissingManyBanner key={next} onClose={close} />
  if (next === "failed") return <FailedBanner key={next} names={failedNames} onClose={close} />
  return <SettingsBanner key={next} onClose={close} />
}

/**
 * 「插件设置已更新」点了「重新加载」之后（03-09 §6.1）：按钮变为 spinner +「正在保存更改…」（先 flush 未确认的更改再刷新，50/02 §12），
 * 保存期间不可用、× 收起（不能中途「稍后再说」）；刷新完成后轻提示「已重新加载，按新的插件设置装配」。
 */
export function ReloadSavingBanner() {
  return (
    <Banner
      icon={<RefreshCw {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />}
      title="管理员更新了插件设置，重新加载后生效"
      actions={
        <Button variant="secondary" disabled aria-busy="true">
          <LoaderCircle {...SI} className="motion-safe:animate-spin" />
          正在保存更改…
        </Button>
      }
    >
      未同步的更改会先保存再刷新；你可以先继续编辑，稍后再重新加载
    </Banner>
  )
}

/* ------------------------------------------------------------------ 缺插件的文档：第 5 页（组织架构图、数据卡片）与第 6 页（三个二维码）以占位显示 */

/**
 * 元素级占位（03-13 / OF-13）：底座 DegradedPlaceholder——虚线框 + 拼图 + 一行插件名 + 一行原因，「内容已保留」并进原因行
 * （「插件已停用，内容已保留」），与保真占位同一画法与字号（DS-52「同属降级对象」；原为插件名 / 原因 / 内容已保留三行）
 */
export function PluginPlaceholder({ name, reason, className }: { name: string; reason: string; className?: string }) {
  return <DegradedPlaceholder icon={Puzzle} title={name} reason={`${reason}，内容已保留`} className={cn("absolute", className)} />
}

/** 第 5 页「华东区域团队」：左侧组织架构图（本部署没有此插件）、右上数据卡片（数据图表增强版本过旧）以占位显示，其余内容照常 */
function TeamSlide() {
  return (
    <>
      <SlideTitle>华东区域团队</SlideTitle>
      <PluginPlaceholder name="组织架构图" reason="本部署未部署" className="top-[18.5cqw] left-[7cqw] h-[28cqw] w-[52cqw]" />
      <PluginPlaceholder name="数据图表增强" reason="需要 ≥ 1.5" className="top-[18.5cqw] left-[63cqw] h-[13cqw] w-[30cqw]" />
      <div className="absolute top-[34.5cqw] left-[63cqw] w-[30cqw] text-[1.7cqw] leading-[1.6] text-(--s-body)">
        <p className="text-[2.2cqw] leading-none font-semibold text-(--s-ink)">负责人 陈静</p>
        <p className="mt-[1.4cqw]">18 人 · 上海、杭州、南京</p>
        <p>Q2 营收占比 38%</p>
      </div>
      <SlideFooter page={5} />
    </>
  )
}

/** 缺多个插件的文档：第 5、6 页换成带占位的页（第 6 页就是第 1 批 main-states 的「扫码获取资料」同一页 QrSlide，原因写「插件已停用」） */
export const MISSING_DECK: DeckSlide[] = deckWith({
  5: { name: "华东区域团队", render: () => <TeamSlide /> },
  6: { name: "扫码获取资料", render: () => <QrSlide reason="插件已停用" /> },
})

/** 左栏：以占位显示的页右上角警示计数（底座 RailThumb warn；第 5 页 2 处、第 6 页 3 处，与面板「本文档缺少的插件」一致） */
const WARN: Record<number, number> = { 5: 2, 6: 3 }

export const missingRail: EditorConfig["rail"] = {
  list: (ctx) => (
    <RailList>
      {ctx.deck.map((s) => (
        <RailThumb key={s.n} slide={s} current={s.n === ctx.slide} onPick={ctx.goTo} warn={WARN[s.n] ?? 0} />
      ))}
    </RailList>
  ),
}
