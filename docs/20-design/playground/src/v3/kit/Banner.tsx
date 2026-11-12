import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { CircleAlert, CircleCheck, CloudOff, Info, Puzzle, TriangleAlert, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, ICON, IconButton } from "../ui"
import { rescueFocus } from "./layer"

const TONE = {
  info: { bg: "bg-(--v3-panel)", icon: <Info {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" /> },
  warning: { bg: "bg-(--v3-warning-soft)", icon: <TriangleAlert {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-warning)" /> },
  error: { bg: "bg-(--v3-danger-soft)", icon: <CircleAlert {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-danger)" /> },
  /** 成功浅底：只给「已恢复」这类需要和中性提示区分的确认（03-12 alt-recovered-soft 的对照画法；主推仍是中性 panel 底 + 成功色图标，tone 用 info） */
  success: { bg: "bg-(--v3-success-soft)", icon: <CircleCheck {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-success)" /> },
} as const

/**
 * 横幅：画布列顶部、左右栏之间的一条（v3 取消底部状态栏后，离线、只读、缺插件、版本预览等状态走这里，DS-6）；应用壳页面在主区顶栏之下（kit ShellLayout banner，rulings §4.25 DS-92）。
 * 高 40（含底部 1px 分隔，rulings §4.25 DS-75）：带按钮的上下内边距 5、按钮 28 垂直居中（原 6，带按钮的横幅高 41），只有文字或只带 × 的照旧；
 * 多行时照常撑高。信息为中性 panel 底，警告 / 错误为对应状态色的浅底（只在该状态出现）。
 * 右侧按钮是次按钮（Button secondary：透明底 + 与分隔线同档的细边，rulings §4.25 DS-37），在浅底上不另铺一块面板色。
 * 文字不截断，放不下时换行。同一时刻只放一条（多种状态按 02-editor-main 的合并规则取一条）；母版视图、版本预览这类模式横幅常驻在上时，
 * 其余横幅在它下方另占一条（TB-14 的例外，最多两条），两条用 BannerStack 包起来。
 * 放在 EditorConfig.banner 里；它把自身高度写进父元素的 --v3-banner-h，画布顶部的浮动面板据此让开。
 * 给了 onClose 才有右侧 ×：点了横幅自己收起（先调 onClose），--v3-banner-h 随之清掉，浮动面板回到顶部。
 * stack：一行放不下时的竖排——按钮换到文案下方独占一行、触控高 44，× 也扩到 44。仅查看形态（手机与平板）里横幅在最顶上，按钮只在一行放不下时才换下来；
 *   触控形态按钮照常 44、横幅随之撑高，上面的高 40 只指非触控形态（rulings §4.25 TB-172、DS-75；03-12 §1.2、§11「极窄屏」，07 触控目标）。
 *
 *   banner: <Banner tone="warning" title="已离线" actions={<Button variant="secondary">重试</Button>}>更改将在重新连接后同步</Banner>
 */
export function Banner(props: BannerProps) {
  const [closed, setClosed] = useState(false)
  if (closed) return null
  return (
    <BannerBody
      {...props}
      onClose={
        props.onClose
          ? () => {
              setClosed(true)
              props.onClose?.()
              // × 随横幅卸载：焦点交给画布，不掉到 body
              requestAnimationFrame(rescueFocus)
            }
          : undefined
      }
    />
  )
}

interface BannerProps {
  tone?: keyof typeof TONE
  /** 粗体短标题，如「已离线」「只读」 */
  title?: string
  /** 说明文字 */
  children?: ReactNode
  /** 右侧按钮（用 Button variant="secondary"：次按钮透明底 + 细边，DS-37） */
  actions?: ReactNode
  /** 给了才显示右侧 × */
  onClose?: () => void
  /** × 的可读名称（缺省「关闭横幅」）：03-09 缺插件横幅读作「关闭提示」，插件设置横幅读作「稍后再说」 */
  closeLabel?: string
  /** 自定义左侧图标 */
  icon?: ReactNode
  /**
   * 读屏语义：缺省按色调——错误为 alert（需要立即注意，如权限已变更），其余为 status（polite、不抢焦点，设计 07「轻提示 / 横幅」）。
   * 危险色但不阻断的横幅显式写 status，如「N 个插件启动失败」（03-02 §6.2「插件横幅」：插件横幅一律非阻断 role=status）。
   * none：已经播报过、之后不再作为 live 区（不写 role）——横幅里的内容随用户自己的操作变化时（如「重新登录」进行中改了说明），
   * 进行中的一句由场景自己的常驻 polite 区播报一次，横幅不再以 alert（assertive、atomic）整条重读（同一件事只走一条读屏通道）。
   */
  role?: "alert" | "status" | "none"
  /** 仅查看形态的竖排：文案一行、按钮在下方独占一行（每个按钮等分、高 44、13px），× 扩到 44 */
  stack?: boolean
}

/** 挂载期间把元素高度写进父元素的 --v3-banner-h（随尺寸变化更新），卸载时清掉。Banner 与 BannerStack 共用。 */
function useBannerHeight() {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent) return
    const sync = () => parent.style.setProperty("--v3-banner-h", `${el.offsetHeight}px`)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => {
      ro.disconnect()
      parent.style.removeProperty("--v3-banner-h")
    }
  }, [])
  return ref
}

/**
 * 警告 / 错误浅底上不可用或进行中的按钮（如断网时的「立即重连」、登录窗口打开中的「重新登录」）：文字由 text-3 提到 text-2
 * （暗 4.56 / 亮 4.60:1，浅底上 text-3 只有 2.68 / 2.77，低于 07 §8、04 §2.6 不可用项 3:1 的底线），细边仍是 --v3-btn-line-off、透明底不变；
 * 中性底（info）的横幅照旧 text-3。rulings §4.25 DS-41 方案 B（不改浅底 token）；第 1 批横幅里没有不可用的按钮，画面不变。
 */
const SOFT_OFF = "[&_[aria-disabled=true]]:text-(--v3-text-2)"

/** 横幅本体：挂载期间把自身高度写进父元素的 --v3-banner-h，卸载（含点 × 收起）时清掉。 */
function BannerBody({ tone = "info", title, children, actions, onClose, closeLabel = "关闭横幅", icon, role, stack }: BannerProps) {
  const ref = useBannerHeight()
  const t = TONE[tone]
  const r = role === "none" ? undefined : (role ?? (tone === "error" ? "alert" : "status"))
  const off = tone === "warning" || tone === "error" ? SOFT_OFF : undefined
  if (stack) {
    // 竖排：按钮一行左右对称（两侧都是横幅的 16 内边距），不随图标列缩进
    return (
      <div ref={ref} role={r} className={cn("flex shrink-0 flex-col gap-3 border-b border-(--v3-border) py-3 pr-3 pl-4 text-[12px] leading-[18px] text-(--v3-text)", t.bg)}>
        <div className="flex items-start gap-2">
          <span className="flex h-[18px] shrink-0 items-center">{icon ?? t.icon}</span>
          <p className="min-w-0 flex-1">
            {title && <span className="mr-2 font-semibold">{title}</span>}
            {children}
          </p>
          {onClose && (
            <IconButton label={closeLabel} size={44} onClick={onClose} className="-my-2.5 -mr-2">
              <X {...ICON} />
            </IconButton>
          )}
        </div>
        {actions && <div className={cn("mr-1 flex gap-2 *:h-11 *:flex-1 *:text-[13px]", off)}>{actions}</div>}
      </div>
    )
  }
  return (
    <div
      ref={ref}
      role={r}
      data-v3-banner=""
      className={cn(
        // DS-75：统一高 40（含底边）——带按钮的上下内边距 5（按钮 28 + 5 + 5 + 底边 1 不超过 min-h，按钮在 39 高的行里垂直居中）；只有文字或只带 × 的照旧 6
        "flex min-h-10 shrink-0 items-center gap-2 border-b border-(--v3-border) pr-3 pl-4 text-[12px] leading-[18px] text-(--v3-text)",
        actions ? "py-[5px]" : "py-1.5",
        t.bg,
      )}
    >
      {icon ?? t.icon}
      <p className="min-w-0 flex-1">
        {title && <span className="mr-2 font-semibold">{title}</span>}
        {children}
      </p>
      {actions && <div className={cn("flex shrink-0 items-center gap-2", off)}>{actions}</div>}
      {onClose && (
        <IconButton label={closeLabel} size={24} onClick={onClose}>
          <X {...ICON} />
        </IconButton>
      )}
    </div>
  )
}

/**
 * 两条横幅叠放（模式横幅常驻在上、其余横幅在下：母版视图 TB-14、版本预览）：Banner 各自只把高度写进父元素，两条直接放进 banner 插槽会互相覆盖；
 * 包一层后由这一层把两条的总高度写给画布列（--v3-banner-h），画布顶部的浮动面板、紧凑形态的胶囊按总高度让开。
 *
 *   banner: <BannerStack><MasterBanner /><OfflineBanner /></BannerStack>
 */
export function BannerStack({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useBannerHeight()
  return (
    <div ref={ref} className={cn("flex shrink-0 flex-col", className)}>
      {children}
    </div>
  )
}

/**
 * 不阻断的插件横幅（缺少插件、插件启动失败，03-02 §6.2「插件横幅」、03-09 §6；rulings §4.25 DS-41）：中性底（panel，同「已恢复」）加状态色图标——
 * 缺少插件是警告色拼图，启动失败是危险色 CircleAlert（与危险色横幅同一个图形，只取危险色、不铺浅底）；读屏一律 role=status（不阻断、不抢焦点）。
 * 文案与按钮由调用处给（title / children / actions / onClose / closeLabel，同 Banner）；第 1 批 main-states 的插件横幅与第 2 批 plugins 场景用的是这同一个件。
 * 「插件设置已更新」本来就是中性底 + 刷新图标，不走这里；离线、降权、隔离、登录已过期仍用对应浅底（Banner tone warning / error）。
 */
export function PluginBanner({ kind, ...props }: { kind: "missing" | "failed" } & Omit<BannerProps, "tone" | "icon" | "role" | "stack">) {
  return <Banner {...props} tone="info" role="status" icon={kind === "missing" ? PLUGIN_MISSING_ICON : PLUGIN_FAILED_ICON} />
}

const PLUGIN_MISSING_ICON = <Puzzle {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-warning)" />
const PLUGIN_FAILED_ICON = <CircleAlert {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-danger)" />

/**
 * 启动失败横幅的标题与说明行（rulings §4.25 DS-55，PRD PM-12、03-02 §6.2）：只有一个插件失败时标题写名字「插件「X」未能启动」，
 * 说明行只写「暂时不可用，其余功能照常」（不重复插件名）；多个时标题写数量「N 个插件启动失败」，说明行先列出插件名（names）再接同一句。
 * 说明行渲染成 {names}{text}（多个时插件名与后半句是两段文字，与改前 plugins 场景的画法逐像素一致）。
 */
export function failedPluginsCopy(names: string[]): { title: string; names: string | null; text: string } {
  const text = "暂时不可用，其余功能照常"
  if (names.length === 1) return { title: `插件「${names[0]}」未能启动`, names: null, text }
  return { title: `${names.length} 个插件启动失败`, names: names.map((n) => `「${n}」`).join(""), text }
}

/** 离线横幅的正文（第 1 批 main-states.offline 拍板的文案） */
export const OFFLINE_TEXT = "更改已保存在本地，将在重新连接后同步"

/**
 * 离线横幅（03-12「离线」，第 1 批 main-states.offline 已拍板）：警告浅底、CloudOff 警告色图标、「离线」+ 正文、不可关闭，右侧「立即重连」。
 * 各场景叠在自己的状态上时用这一条，文案与画法只有一份；actions / children 换按钮与正文（如断网时「立即重连」不可用、备选文案），stack 见 Banner。
 */
export function OfflineBanner({ actions, children, stack }: { actions?: ReactNode; children?: ReactNode; stack?: boolean }) {
  return (
    <Banner
      tone="warning"
      icon={<CloudOff {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-warning)" />}
      title="离线"
      stack={stack}
      actions={actions ?? <Button variant="secondary">立即重连</Button>}
    >
      {children ?? OFFLINE_TEXT}
    </Banner>
  )
}
