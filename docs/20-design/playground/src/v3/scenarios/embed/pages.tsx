import { useEffect, useRef, useState } from "react"
import { Check, ExternalLink, FileWarning, KeyRound, LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { BlockingPage, Button, DOC_TITLE, ICON, Phrases, Tip, useBreakpoint, usePage, useSceneState } from "../../kit"

/**
 * 嵌入形态 E（/embed/:id?mode=view|edit，50/12 §9）iframe 里的两种自己的页面——其余都是第 1、2 批已拍板的编辑器形态，放进容器里按容器宽度取形态（DS-17、DS-21）。
 * 两页都用阻断页画法（kit BlockingPage，与编辑器打开失败、登录页、错误页同一画法：画布底色上居中一列，32px 线性图标 text-2 · 16px 标题 · 12px 说明 · 一行按钮）。
 * 画在 #/v3/page 宿主（整屏 bare、画布底色）上，由 embed 场景的外框用 iframe 加载（embed-frame 是隐藏场景，Hub 不展示）。
 */

export type AuthPhase = "idle" | "pending" | "blocked"

/** 登录窗口打开期间「使用组织账号登录」的原因提示（同第 2 批「登录已过期」横幅的「登录窗口已打开，完成后自动恢复」，嵌入里改「自动刷新」） */
const PENDING_TIP = "登录窗口已打开，完成后自动刷新"

/**
 * iframe 里没有会话（50/12 §9「请在新窗口登录」）：IdP 通常禁止被嵌入，所以不做顶层 OIDC 跳转——按 50/02 §5 的弹窗流程在新窗口登录，
 * 收到 BroadcastChannel cordex-auth 的 reauth-done 后重新加载 iframe 内容；同时向父页发 cordex:auth-required（看不见）。
 * 三个阶段是同一页、同一颗按钮（文案与第 2 批「登录已过期」横幅的三段同一套措辞，offline-conflict.auth-expired / -pending / -popup-blocked）：
 * - idle：「使用组织账号登录」（主按钮，与登录页 shell-pages.login 的主按钮同一句）；点按时在手势里同步 window.open（520 × 680）；
 * - pending：登录窗口已打开——同一颗按钮（同一个元素，焦点留在原处）转圈、不可用，说明改为「请在新窗口中完成登录…」，这一句由常驻的 polite 区播报一次；
 *   窗口关掉而没登录完时恢复可点；
 * - blocked：浏览器拦截了登录窗口——标题改「请在新标签页中登录」，按钮换成链接「在新标签页中登录」（外链图标，target=_blank、rel=noopener），说明改为浏览器拦截了登录窗口。
 * 按钮的画法与宽度同登录页（shell-pages/LoginPage.tsx，rulings §4.25 TB-122「同一句主按钮在登录页与嵌入登录提示用同一宽度规则」）：
 *   桌面定宽 240、高 28；触控或容器 < 640（useBreakpoint narrow，iframe 里按容器宽度）占满列宽、最宽 400、高 44、圆角 8（设计 04 §2.13 触控按钮）。
 *   进行中照用 kit 主按钮的不可用态（panel-2 底 + text-3）加转圈，与 shell-pages.login-redirecting、第 2 批「申请访问」发送后同一画法（rulings §4.25 DS-123：采纳原备选「kit 不可用态」，
 *   第 3 批转正时删去这里按进行中切到 outline 的局部写法）。
 */
export function AuthRequiredPage() {
  const { data } = usePage()
  const [phase, setPhase] = useSceneState<AuthPhase>("embed.auth-phase", (data.phase as AuthPhase | undefined) ?? "idle")
  const [said, setSaid] = useState("")
  const [quiet, setQuiet] = useState(false)
  const touch = useBreakpoint() === "narrow"
  const pending = phase === "pending"
  const blocked = phase === "blocked"
  // 按词组换行（kit Phrases：每段不折行，段间才断），窄容器里不断在「自动 / 刷新」这种词中间
  const text = pending
    ? ["请在新窗口中完成登录；", "登录后这里会自动刷新"]
    : blocked
      ? ["浏览器拦截了登录窗口，", "请改在新标签页中登录；", "登录后回到这里会自动刷新"]
      : ["嵌入的页面里打不开登录页；", "在新窗口登录后，", "这里会自动刷新"]
  // 宽度规则同登录页：桌面 240；触控占满列宽、最宽 400（BlockingPage 的按钮行按内容收缩，所以写定宽）
  const btn = touch ? "h-11 w-full rounded-[8px] text-[13px]" : "w-full"
  const action = (
    <div className={touch ? "w-[min(400px,calc(100vw-32px))]" : "w-[240px]"}>
      {blocked ? (
        <Button variant="primary" className={btn}>
          在新标签页中登录
          <ExternalLink {...ICON} aria-hidden="true" />
        </Button>
      ) : (
        <Tip label={PENDING_TIP} hidden={!pending || quiet}>
          <Button
            variant="primary"
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={() => {
              setPhase("pending")
              setSaid(PENDING_TIP)
              setQuiet(true)
            }}
            onBlur={() => setQuiet(false)}
            onPointerEnter={() => setQuiet(false)}
            className={btn}
          >
            {pending && <LoaderCircle {...ICON} aria-hidden="true" className="motion-safe:animate-spin" />}
            使用组织账号登录
          </Button>
        </Tip>
      )}
    </div>
  )
  return (
    <>
      <BlockingPage
        headingId="embed-auth-required"
        icon={<KeyRound size={32} strokeWidth={1.5} aria-hidden="true" />}
        title={blocked ? "请在新标签页中登录" : "请在新窗口登录"}
        actions={action}
        className={cn(touch && "px-4")}
      >
        <Phrases parts={text} />
      </BlockingPage>
      <span aria-live="polite" className="sr-only">
        {said}
      </span>
    </>
  )
}

/**
 * 嵌入里的打开失败（03-13 打开失败态、编辑器 main-states.open-failed 同一布局与文案；rulings §4.25 TB-115）：嵌入里没有「文档列表」可回，
 * 按钮组去掉「返回文档列表」，只留「重试」（主）与「复制诊断信息」（画布底上的次按钮 outline，TB-128）；同时向父页发 cordex:error（code 为 protocol 已登记的错误码），离开交给宿主。
 * 「复制诊断信息」点后原位变为「已复制」1.5 秒（同 shell-pages.app-error 与 03-08「复制链接」：不用系统级通知，按钮定宽不跳，polite 播报一次「已复制诊断信息」）。
 * 文案按 03-13 错误码表换；没有访问权限、名额已满是同一布局的阻断页，在小容器里复用，同样去掉「返回文档列表」。
 */
export function EmbedOpenFailedPage() {
  const [copied, setCopied] = useState(false)
  const [said, setSaid] = useState("")
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = () => {
    setCopied(true)
    setSaid("已复制诊断信息")
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1500)
  }
  return (
    <>
      <BlockingPage
        headingId="embed-open-failed"
        icon={<FileWarning size={32} strokeWidth={1.5} aria-hidden="true" />}
        context={DOC_TITLE}
        title="无法打开该文档"
        actions={
          <>
            <Button variant="primary">重试</Button>
            <Button variant="outline" onClick={copy} className="min-w-[100px]">
              {copied && <Check {...ICON} aria-hidden="true" />}
              {copied ? "已复制" : "复制诊断信息"}
            </Button>
          </>
        }
      >
        请稍后重试；如果问题持续，请复制诊断信息并联系管理员
      </BlockingPage>
      <span aria-live="polite" className="sr-only">
        {said}
      </span>
    </>
  )
}
