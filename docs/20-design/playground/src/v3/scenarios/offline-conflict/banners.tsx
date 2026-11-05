import { useState, type ReactNode } from "react"
import { CircleCheck, CirclePause, CloudAlert, CloudOff, ExternalLink, FileX2, KeyRound, LoaderCircle, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Banner, Button, ICON, OFFLINE_TEXT as APPROVED_OFFLINE_TEXT, OfflineBanner as KitOfflineBanner, Tip, useDemoOpen, useEditor, useSceneState } from "../../kit"
import { AffectedPages } from "./affected"

/**
 * offline-conflict 场景的横幅（横幅通道，03-02 §6.2；kit Banner：至少 40 高、底部 1px 分隔、信息为 panel 底、警告 / 错误为对应浅底，
 * 状态色只给图标，正文用 text；右侧次按钮透明底加细边，DS-37）。
 * 读屏：离线、同步、已恢复、服务器保存、名额已满为 status（polite）；登录已过期、权限降级与错误类为 alert（assertive，03-12「语义与播报」）。
 * 未处理前不可关闭的只有四类（UX-04）：权限降级（导出前）、访问权限已变更、隔离态、登录已过期；本场景另把「文档已被删除」「有更改过大无法同步」
 * 也画成导出前不可关闭（理由见状态说明与 decisions）。其余横幅给 ×（可读名称「关闭提示」）。
 */

const noop = () => undefined
const icon = (I: typeof CloudOff, cls: string) => <I {...ICON} aria-hidden="true" className={cn("shrink-0", cls)} />

/* ------------------------------------------------------------------ 连接类 */

/** 已恢复（success，03-12）：中性 panel 底 + 成功色对勾（状态色只给图标）；产品里 3 秒后自动滑出（样张不计时，停住便于对照），也可以手动关闭。 */
export function RecoveredBanner() {
  return <Banner icon={icon(CircleCheck, "text-(--v3-success)")} title="已恢复协同并同步完成" onClose={noop} closeLabel="关闭提示" />
}

/**
 * 离线超过 24 小时后重连（P1，PRD CO-06、05 §7、F5）：在「已恢复」这一条上追加「较长时间离线，合并后请检查」并列出受影响页；
 * 页码是可点的链接（切到该页），带检查清单的这一条不自动滑出，看完手动关闭。受影响页取被合并的待同步事务所在页（50/07 §4「长离线提示」）；
 * 超过 3 页时只列前 3 页、其后写「等 N 页」（affected.tsx，rulings §4.25 DS-59）。
 * 图标用中性 Info（kit Banner info 缺省，text-2），不用成功色对勾：这一条要用户回头检查，对勾会让人以为不用处理（标杆对照：Figma 在「已同步但可能有冲突」时
 * 把对勾换成「!」）；标题、正文、页码链接与「不自动滑出」不变。普通的「已恢复」（RecoveredBanner）仍是成功色对勾。
 */
export function LongOfflineBanner({ pages }: { pages: number[] }) {
  const { goTo, slide } = useEditor()
  return (
    <Banner title="已恢复协同并同步完成" onClose={noop} closeLabel="关闭提示">
      较长时间离线（超过 24 小时），合并后请检查
      <AffectedPages pages={pages} current={slide} onPick={goTo} />
    </Banner>
  )
}

/** 离线横幅的正文：第 1 批已拍板的文案（kit OFFLINE_TEXT，DS-59 不改）；copy="refresh" 是 DS-59 未采纳的备选文案（M2–M3 的待同步队列只在本页内存里，刷新即丢）。 */
const OFFLINE_TEXT = {
  approved: APPROVED_OFFLINE_TEXT,
  refresh: "更改暂存在本页，重新连接后自动同步；关闭或刷新本页会丢失这些更改",
} as const

/**
 * 离线（warning，03-12；第 1 批 main-states.offline 已拍板，kit OfflineBanner）：本场景只补三种变体——
 * noNetwork：浏览器报告离线（navigator.onLine = false）期间「立即重连」不可用，工具提示「网络恢复后可重连」（状态一出现就展开，演示原因）；
 * copy：DS-59 未采纳的备选文案；
 * neutral：DS-41 未采纳的选项「离线横幅也改中性底」的画面（alt-offline-neutral）——中性底（kit Banner tone="info"）+ 警告色离线图标（同一个 CloudOff，经 Banner 的 icon 传入），
 * 标题、正文、按钮与读屏语义（status）都不变。只在这一个对照状态里拼，kit 的 OfflineBanner 不改（DS-41 定为离线横幅仍用警告浅底；缺少插件、插件启动失败横幅按 DS-41 已改中性底，kit PluginBanner）。中性底上不可用按钮的文字按 kit 规则用 text-3（浅底上才提到 text-2）。
 */
export function OfflineBanner({ noNetwork, copy = "approved", neutral }: { noNetwork?: boolean; copy?: keyof typeof OFFLINE_TEXT; neutral?: boolean }) {
  const demo = useDemoOpen()
  const reconnect = noNetwork ? (
    <Tip label="网络恢复后可重连" open={demo ? true : undefined} side="bottom">
      <Button variant="secondary" disabled>
        立即重连
        <span className="sr-only">（网络恢复后可重连）</span>
      </Button>
    </Tip>
  ) : undefined
  if (neutral)
    return (
      <Banner tone="info" icon={icon(CloudOff, "text-(--v3-warning)")} title="离线" actions={reconnect ?? <Button variant="secondary">立即重连</Button>}>
        {OFFLINE_TEXT[copy]}
      </Banner>
    )
  return <KitOfflineBanner actions={reconnect}>{OFFLINE_TEXT[copy]}</KitOfflineBanner>
}

/* ------------------------------------------------------------------ 服务器保存 */

/**
 * 发起方「未保存到服务器 N 项」（warning，role=status，可关闭，03-12 INC-09）：本端有未获 db 确认的更改时出现；连接与协作照常。
 * 关闭后同步状态行保留警告指示，直到全部获确认、room.persist 回到 ok（横幅自动消失，不另弹「已恢复」）。
 */
export function ServerUnsavedBanner() {
  return (
    <Banner tone="warning" icon={icon(CloudAlert, "text-(--v3-warning)")} title="未保存到服务器 3 项" onClose={noop} closeLabel="关闭提示">
      服务器存储暂时不可用，更改已暂存，恢复后自动保存
    </Banner>
  )
}

/* ------------------------------------------------------------------ 鉴权 */

/**
 * 登录已过期（03-12「需要人工操作」，UX-02）：令牌刷新遇 401 直接进本态；处理前不可关闭、role=alert。
 * 「重新登录」在弹窗里完成，原页不跳转、待同步队列保留；phase：
 * idle 初始 · pending 登录窗口已打开（按钮转圈、不可用，窗口关闭而未完成时恢复）· blocked 弹窗被浏览器拦截，退化为「在新标签页中登录」。
 * 点「重新登录」会切到 pending（场景内共享状态，换状态即复位）。
 * 读屏（同一件事只走一条通道）：横幅以 role=alert 出现时播报一次；之后随用户自己的操作改了说明（进行中），横幅不再作为 live 区（kit Banner role="none"，
 * 与改文案同一次渲染），不以 assertive、atomic 整条重读；进行中的一句只由下面常驻的 polite 区播报一次；按钮名不加后缀，原因由工具提示（aria-describedby）按需提供
 * （刚点过时不当场弹出，焦点离开再回来或悬停时出现）。
 */
export function AuthExpiredBanner({ phase: initial = "idle" }: { phase?: "idle" | "pending" | "blocked" }) {
  const [phase, setPhase] = useSceneState<"idle" | "pending" | "blocked">("offline-conflict.auth-phase", initial)
  /** 横幅出现时的阶段：还在这一阶段时是 alert（出现即播报）；用户操作换了阶段之后不再是 live 区 */
  const [shownAs] = useState(phase)
  /** 进行中的文案播报一次（常驻的 polite 区，挂载时就在、内容为空） */
  const [said, setSaid] = useState("")
  /**
   * 刚点过「重新登录」：原因提示先不当场弹出（进行中的一句已由 polite 区播报过，不再经 aria-describedby 同时再给一遍）；
   * 焦点离开、或指针重新移上来之后照常弹出——原因随时可查（悬停 / 重新聚焦）
   */
  const [quiet, setQuiet] = useState(false)
  const text =
    phase === "pending"
      ? "请在新窗口中完成登录；本页不会跳转，更改不会丢失"
      : phase === "blocked"
        ? "浏览器拦截了登录窗口，请改在新标签页中登录；本页不会跳转，更改不会丢失"
        : "本地更改尚未同步；重新登录在新窗口中进行，本页不会跳转，更改不会丢失"
  const pending = phase === "pending"
  // 「重新登录」与进行中是同一颗按钮（同一个元素，只换文案前的转圈与 aria-disabled），点了焦点留在原处、不掉到 body（07 §2.3）；
  // 原因提示挂在外层一直在的 Tip 上（不可用时才弹），不让 kit Button 因「有没有原因」换一层包裹而重新挂载
  const action =
    phase === "blocked" ? (
      <Button variant="secondary">
        在新标签页中登录
        <ExternalLink {...ICON} aria-hidden="true" className="text-(--v3-text-2)" />
      </Button>
    ) : (
      <Tip label={RELOGIN_PENDING} hidden={!pending || quiet}>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setPhase("pending")
            setSaid(RELOGIN_PENDING)
            setQuiet(true)
          }}
          onBlur={() => setQuiet(false)}
          onPointerEnter={() => setQuiet(false)}
        >
          {pending && <LoaderCircle {...ICON} aria-hidden="true" className="motion-safe:animate-spin" />}
          重新登录
        </Button>
      </Tip>
    )
  return (
    <>
      <Banner tone="warning" role={phase === shownAs ? "alert" : "none"} icon={icon(KeyRound, "text-(--v3-warning)")} title="登录已过期" actions={action}>
        {text}
      </Banner>
      <span aria-live="polite" className="sr-only">
        {said}
      </span>
    </>
  )
}

const RELOGIN_PENDING = "登录窗口已打开，完成后自动恢复"

/* ------------------------------------------------------------------ 权限与「导出为本地副本」 */

/** 导出流程的场景内状态：对话框开着没有、导出完成没有（按状态的 data 取初值：exportOpen、exported）。 */
export function useExportFlow() {
  const { data } = useEditor()
  const [open, setOpen] = useSceneState("offline-conflict.export-open", !!data.exportOpen)
  const [exported, setExported] = useSceneState("offline-conflict.exported", !!data.exported)
  return { open, setOpen, exported, setExported }
}

/** 「导出为本地副本」按钮：带锚点，导出对话框关闭后焦点交回这里。exporting：正在生成副本（转圈、不可用，完成后横幅降级为「已导出」）。 */
function ExportButton({ exporting }: { exporting?: boolean }) {
  const { setOpen } = useExportFlow()
  if (exporting)
    return (
      <Button variant="secondary" disabled reason="正在生成副本，完成后自动下载" data-v3-anchor="offline-conflict.export">
        <LoaderCircle {...ICON} aria-hidden="true" className="motion-safe:animate-spin" />
        正在导出…
      </Button>
    )
  return (
    <Button variant="secondary" data-v3-anchor="offline-conflict.export" onClick={() => setOpen(true)}>
      导出为本地副本
    </Button>
  )
}

/**
 * 降权横幅的正文（03-12 G-51 的新写法，rulings §4.25 DS-58）：「3 项更改未被保存；文档已重新载入服务端版本，撤销历史已清空」——
 * 原「导出后可另行申请编辑权限再重新应用」移到导出对话框与「已导出本地副本」提示里。第 2 批各处的降权横幅（离线与冲突、母版视图降权、
 * 有更改过大、版本历史 degraded-menu）与第 1 批 main-states.degraded / degraded-menu / degraded-thumb-menu 都取这一份原文。
 */
export const REJECTED_TEXT = "3 项更改未被保存；文档已重新载入服务端版本，撤销历史已清空"

/**
 * 「导出本地副本」对话框说明的第二句（redo）与导出后「已导出本地副本」的正文（exported）按原因换（rulings §4.25 DS-129；没点名的原因用中性句，TB-139；设计 03-12 §7.2 表）：
 * 只有失去编辑权限的原因（降权、登录账号已变更）才写「获得编辑权限后…」，其余不提权限——用户并没有失去编辑权限，话不对题会误导人去申请权限。
 * 从离开 / 刷新 / 退出登录确认框打开的导出（offline、neutral 里确认框那几种），导出后回到原处、不出「已导出」提示，所以只用 redo。
 * 第 2 批 too-large、doc-deleted 与离线、退出登录各态导出后的文案按这张表改（2026-10-22 第 3 批转正第三段；doc-banners 换纪元与 shell-pages 退出登录原先各写一份，改为都取这里）。
 */
export type ExportReason = "degraded" | "identity" | "epoch" | "too-large" | "deleted" | "offline" | "neutral"
export const EXPORT_COPY: Record<ExportReason, { redo: string; exported?: string }> = {
  // 降权、登录账号已变更：保留原句
  degraded: { redo: "导出的副本不会自动合并回文档，获得编辑权限后可以对照重做。", exported: "可另行申请编辑权限后重新应用；系统不会把副本自动合并回文档" },
  identity: { redo: "导出的副本不会自动合并回文档，获得编辑权限后可以对照重做。", exported: "可另行申请编辑权限后重新应用；系统不会把副本自动合并回文档" },
  // 换纪元时有未提交的更改、有更改过大无法同步
  epoch: { redo: "导出的副本不会自动合并回文档，可以对照重做。", exported: "系统不会把副本自动合并回文档，可以对照重做" },
  "too-large": { redo: "导出的副本不会自动合并回文档，可以对照重做。", exported: "系统不会把副本自动合并回文档，可以对照重做" },
  // 文档已被删除
  deleted: { redo: "导出的副本不会自动合并回文档，可以另存为新文档。", exported: "系统不会把副本自动合并回文档，可以另存为新文档" },
  // 离线时的离开确认、退出登录确认（03-33 §8）：从确认框打开，导出后回到原处，没有「已导出」提示
  offline: { redo: "导出的副本不会自动合并回文档，恢复连接后可以对照重做。" },
  // 没点名的原因（TB-139）：登录已过期、协同已暂停、未保存到服务器时的离开或刷新确认、发现新版本时的刷新或离开确认，以及按原因换标题的「文档正忙」「文档已达元素上限」
  //（「已导出」提示只有横幅打开的才有）
  neutral: { redo: "导出的副本不会自动合并回文档，可以对照重做。", exported: "系统不会把副本自动合并回文档，可以对照重做" },
}

/**
 * 有更改被拒、已「导出后重载」的横幅（03-12 readonly-degraded 权限降级分支、G-51；50/07 §8.2 第 4 步）：
 * 危险色、锁形；追加行「文档已重新载入服务端版本，撤销历史已清空」；导出前不可关闭，导出后降级为可关闭的「已导出」提示（ExportedBanner）。
 * title / children 按被拒原因换（权限已变更 · 登录账号已变更 · 有更改过大无法同步）。
 * exportedNote：导出后「已导出本地副本」的正文按原因换（EXPORT_COPY[原因].exported，DS-129：换纪元、更改过大等；ExportedBanner 的 children）；不传时为降权原句，与原来相同。
 */
export function RejectedBanner({
  title,
  children,
  glyph = "lock",
  exporting,
  exportedNote,
}: {
  title: string
  children: ReactNode
  glyph?: "lock" | "alert"
  exporting?: boolean
  exportedNote?: ReactNode
}) {
  const { exported } = useExportFlow()
  if (exported) return <ExportedBanner>{exportedNote}</ExportedBanner>
  return (
    <Banner tone="error" icon={glyph === "lock" ? icon(Lock, "text-(--v3-danger)") : undefined} title={title} actions={<ExportButton exporting={exporting} />}>
      {children}
    </Banner>
  )
}

/**
 * 已导出（03-12「已导出，可另行申请编辑权限后重新应用 · 可关闭」）：从「需要操作」降级为中性提示，成功色对勾只给图标。
 * children：正文按原因换（EXPORT_COPY[原因].exported，rulings §4.25 DS-129）；不传时为降权原句，与原来相同。
 */
export function ExportedBanner({ children }: { children?: ReactNode }) {
  return (
    <Banner icon={icon(CircleCheck, "text-(--v3-success)")} title="已导出本地副本" onClose={noop} closeLabel="关闭提示">
      {children ?? EXPORT_COPY.degraded.exported}
    </Banner>
  )
}

/**
 * 编辑者名额已满（readonly-degraded 之二，03-12；50/07 §8.1）：以只读身份加入，画布写入与评论创建都收回；可关闭，关闭后同步状态行仍保留只读指示。
 * {N} 读取部署配置（缺省 20），这里按缺省值画。「重试以编辑身份加入」：本次连接内服务端不会自动升回，由用户重试、重新判定名额（60/05 §4.2）。
 * 语气用中性信息底（没有丢失任何东西；03-12 标题写的 danger 留给「N 项更改未被保存」，见 decisions）。
 */
export function SeatsFullBanner() {
  return (
    <Banner icon={icon(Lock, "text-(--v3-text-2)")} title="编辑者名额已满（上限 20 人）" actions={<Button variant="secondary">重试以编辑身份加入</Button>} onClose={noop} closeLabel="关闭提示">
      你已以只读身份加入；有名额空出后，可以重试以编辑身份加入
    </Banner>
  )
}

/* ------------------------------------------------------------------ 阻断与文档状态 */

/** 隔离态的「刷新」：本端仍有未同步更改时先弹「刷新将丢失…」确认（RefreshConfirmLayer），没有就直接刷新。 */
export function useRefreshConfirm() {
  const { data } = useEditor()
  return useSceneState("offline-conflict.refresh-open", !!data.refreshOpen)
}

/**
 * 隔离态（关闭码 4409，G-51）：同一会话 10 分钟内 ≥ 5 次修复触发；阻断式横幅、role=alert、始终不可关闭，只能刷新退出。
 * 写命令被拒（50/07 §3.2「可编辑：否」），待同步更改保留在内存里供导出，所以「刷新」先走确认。
 */
export function QuarantineBanner() {
  const [, setOpen] = useRefreshConfirm()
  return (
    <Banner
      tone="error"
      icon={icon(CirclePause, "text-(--v3-danger)")}
      title="你的会话已被暂停协同"
      actions={
        <Button variant="secondary" data-v3-anchor="offline-conflict.refresh" onClick={() => setOpen(true)}>
          刷新
        </Button>
      }
    >
      请刷新页面重新加入；如持续出现请联系管理员
    </Banner>
  )
}

/**
 * 文档已被删除（关闭码 4404；PRD CO-06「若文档已被删除，提示并允许导出本地副本」）：会话结束、停止重连，本地更改移入「未同步更改」区。
 * 文档已不存在，关掉横幅只会剩下一个不能保存的编辑器，所以与降权一样导出前不可关闭；导出后同样降级为「已导出」提示，正文写「…可以另存为新文档」（rulings §4.25 DS-129）。
 */
export function DocDeletedBanner() {
  const { exported } = useExportFlow()
  if (exported) return <ExportedBanner>{EXPORT_COPY.deleted.exported}</ExportedBanner>
  return (
    <Banner
      tone="error"
      icon={icon(FileX2, "text-(--v3-danger)")}
      title="文档已被删除"
      actions={
        <>
          <ExportButton />
          <Button variant="secondary">返回文档列表</Button>
        </>
      }
    >
      3 项更改没有同步，可以导出为本地副本
    </Banner>
  )
}

/**
 * 访问权限已变更（DS-50 未采纳的备选画法：横幅留在编辑器上，即 03-12 线框的字面读法）：danger、阻断、不可关闭，「申请访问」「返回文档列表」；
 * 不提供导出本地副本（PRD CO-05）。与 50/07 §8.1「Unit 关闭并清空内存中的文档」冲突：画布上的内容仍然看得见。DS-50 定为阻断页（pages.tsx）。
 */
export function RevokedBanner() {
  return (
    <Banner
      tone="error"
      icon={icon(Lock, "text-(--v3-danger)")}
      title="访问权限已变更"
      actions={
        <>
          <Button variant="secondary">申请访问</Button>
          <Button variant="secondary">返回文档列表</Button>
        </>
      }
    >
      你已无法查看或编辑此文档，未同步的更改已丢弃
    </Banner>
  )
}

/** 有更改过大无法同步（PRD CO-06：重连 step2 超过 16 MiB，4413）：不自动重试，按「导出后重载」处理，与降权同一导出路径。 */
/** 有更改过大无法同步：导出后「已导出本地副本」的正文写「…可以对照重做」（用户没有失去编辑权限，rulings §4.25 DS-129） */
export function TooLargeBanner() {
  return (
    <RejectedBanner title="有更改过大无法同步" glyph="alert" exportedNote={EXPORT_COPY["too-large"].exported}>
      {REJECTED_TEXT}
    </RejectedBanner>
  )
}

/* ------------------------------------------------------------------ 未采纳的备选（DS-63 留作对照）与窄屏 */

/**
 * 状态色的两种方案（04 §2.5「取值第 2 批拍板」，rulings §4.25 DS-41 定为方案 B）：横幅浅底上不可用 / 进行中的按钮原来是 text-3，只有 2.68（暗色警告浅底）/ 2.77（亮色危险浅底），
 * 低于 07 §8 不可用项 3:1 的底线。
 * - 方案 B（DS-41 采纳，现行画法）：浅底 token 不动，kit Banner 把警告 / 错误横幅上不可用、进行中的按钮文字提到 text-2（暗 4.56 / 亮 4.60）；第 1 批横幅画面不变。
 * - 方案 A（未采纳）：浅底调淡——暗色警告由 16% 调到 10%（≈ #403A2F，text-3 3.05、图标 6.03）、亮色危险由 14% 调到 8%（≈ #FBEEEE，text-3 3.05、图标 4.71），按钮文字留在 text-3。
 *   这里只在对照状态里局部覆盖两个变量（并把按钮文字压回 text-3）演示；若采用须改 v3.css 的全局 token，第 1 批离线、降权等浅底横幅的底色都会随之改变。
 */
export const PALER_SOFT =
  "[[data-v3-theme=dark]_&]:[--v3-warning-soft:color-mix(in_srgb,var(--v3-warning)_10%,var(--v3-panel))] [[data-v3-theme=light]_&]:[--v3-danger-soft:color-mix(in_srgb,var(--v3-danger)_8%,var(--v3-panel))] [&_[aria-disabled=true]]:text-(--v3-text-3)!"

/** DS-41 未采纳的备选：已恢复用成功浅底（kit Banner tone="success"，对照已定的中性底 + 成功色图标）。 */
export function RecoveredSoftBanner() {
  return <Banner tone="success" title="已恢复协同并同步完成" onClose={noop} closeLabel="关闭提示" />
}

/** 仅查看形态（390 宽）的离线横幅：kit OfflineBanner 的 stack 画法——按钮换到文案下方独占一行、高 44（03-12「极窄屏」）。 */
export function NarrowOfflineBanner() {
  return <KitOfflineBanner stack />
}
