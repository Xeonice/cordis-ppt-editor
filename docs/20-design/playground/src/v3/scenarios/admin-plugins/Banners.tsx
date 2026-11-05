import { ShieldAlert } from "lucide-react"
import { Banner, BannerStack, ICON } from "../../kit"
import { STATUS } from "./data"
import { useAdmin } from "./store"

/**
 * 管理页的两条页级横幅，都走应用壳的横幅通道（kit ShellLayout banner；位置按 rulings §4.25 DS-92：主区顶栏之下、只横跨主区，导航不动、标题不跳；
 * 未采纳的 alt-banner-top 放在主区最顶、顶栏之上）。高 40（含 1px 底边，带按钮的上下内边距 5，rulings §4.25 DS-75）。两条同时成立时非生产警示在上、被拒在下，最多两条（BannerStack）。
 * 清单还没到（加载中、加载失败）时都不出现：数据未知（03-32 §11.2）。
 */
export function AdminBanners() {
  const api = useAdmin()
  if (api.load !== "ready") return null
  const unsigned = !!api.data.allowUnsigned
  const rejected = api.forcedRejected.length > 0
  if (unsigned && rejected)
    return (
      <BannerStack>
        <UnsignedBanner />
        <RejectedBanner />
      </BannerStack>
    )
  if (unsigned) return <UnsignedBanner />
  if (rejected) return <RejectedBanner />
  return null
}

/**
 * 被拒横幅（03-32 §3，PM-05）：声明为强制启用的插件未通过部署校验时出现——需要部署方处理，危险浅底 + 危险色图标，标题与正文用主文字色（DS-41）；
 * 单行：标题「N 个声明为强制启用的插件未通过部署校验」+ 正文列出「名称（状态）」与「没有进入任何会话」；不可关闭。
 * 只陈述事实、不放按钮（rulings §4.25 DS-96，采纳原备选：原 03-32 §3 的次按钮「只看被拒插件」与筛选里的「未通过部署校验」是同一个操作，筛选就在下方，质量门 Q2 入口唯一；
 * 按钮随筛选消失时的焦点交接随之删去）。原来红条里的「启动日志已告警 · /readyz」与「请由部署方修复后重新部署」挪进「未通过部署校验」分组的常驻说明。
 * 读屏 role=status：页面打开即成立的状态，不是这一刻发生的错误，不用 alert 抢读（rulings §4.25 TB-119；前端 50/16 §8 横幅一行：应用壳页面上一打开就成立的状态横幅用 status，会话中发生的错误才用 alert）。
 */
function RejectedBanner() {
  const api = useAdmin()
  const list = api.forcedRejected
  return (
    <Banner tone="error" role="status" title={`${list.length} 个声明为强制启用的插件未通过部署校验`}>
      {list.map((p) => `${p.name}（${STATUS[api.statusOf(p)].label}）`).join("、")}，没有进入任何会话
    </Banner>
  )
}

/**
 * 非生产部署允许未签名（M4，03-32 §8.2，PM-05）：配置 plugins.allowUnsigned = true 时整页常驻、不可关闭。
 * 中性底 + 警告色盾牌、不可关闭、role=status（rulings §4.25 TB-119；09 §3.3「不阻断、不丢数据的用中性底 + 状态色图标」）——
 * 这是部署方有意打开的开关，管理页上没有要处理的事（同插件横幅，DS-41），警告色只给盾牌图标；03-32 §8.2 同此、引用 09 §3.3（原「警告浅底」作废）。
 */
function UnsignedBanner() {
  return (
    <Banner tone="info" role="status" icon={<ShieldAlert {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-warning)" />} title="非生产部署：已允许未签名插件">
      配置 <code className="font-mono text-[11px]">plugins.allowUnsigned = true</code>，生产环境会拒绝这个开关；未签名插件以「未签名」标出
    </Banner>
  )
}
