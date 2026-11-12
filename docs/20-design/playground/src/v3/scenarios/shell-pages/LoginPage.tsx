import { useEffect, useState } from "react"
import { CircleAlert, LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { BlockingPage, Button, ICON, useBreakpoint, usePage, useSceneState } from "../../kit"
import { LogoMark } from "../../shape-icons"

/**
 * 登录页 /login（rulings §4.25 DS-71：第 3 批唯一的新版式；前端 50/02 §2、§4.4；PRD EM-03、EM-17、SV-06、G-66）。
 * rulings §4.25 DS-118：与阻断页同一画法——画布底色上居中一列，不加卡片、不放插图（kit BlockingPage）：
 *   品牌标 32（RuntimeConfig.brand）· 标题「登录 Cordex」（产品名并进标题，不单列一行）· 一句说明（IdP 显示名取 GET /auth/config）· 主按钮「使用组织账号登录」·
 *   selfSignup 开时多一个「注册」，关时一行弱提示「没有账号？请联系管理员开通」（DS-119）。
 * rulings §4.25 DS-120：登录失败回到这里，主按钮上方一行内联错误（危险色图标 + 一句，role=alert），主按钮就是重试。
 * 只有组织 OIDC 一种登录：不自绘密码表单、不选租户（rulings §4.15 Q6、§4.13 S-1）；必须点一下才跳 IdP（RP 登出回到这里时 IdP 会话还在，自动跳会被立刻登回去）。
 * 主按钮尺寸与宽度（rulings §4.25 TB-122；与嵌入「请在新窗口登录」的同一句主按钮同一条规则）：桌面 28 高、定宽 240；
 *   触控或 < 640（useBreakpoint narrow，或状态数据 form: "narrow" 强制）：左右 16 边距、按钮占满列宽（最宽 400）、高 44、圆角 8（04 §2.13、§2.9）。
 * 进行中（正在跳转…）照用 kit 主按钮的不可用态加转圈，画布底上与卡片里相同（rulings §4.25 DS-123：采纳原备选「kit 不可用态」，第 3 批转正时删去画布底上切到 outline 的局部写法）。
 * GET /auth/config 取失败按缺省渲染（selfSignup 关、没有 IdP 显示名）；点主按钮时离线就不跳转，主按钮上方内联「无法连接网络，请检查网络后重试」（TB-122）。
 * DS-118 未采纳的备选（card，alt-login-card）：同样的内容放进居中卡片。
 */

/** 回调失败带回的三个错误码（60/02 §2 失败出口），界面只按码写一句，不回显 IdP 原始错误描述（细分原因只进审计） */
export type AuthErrorCode = "invalid_token" | "account_disabled" | "idp_unavailable"

/** 主按钮上方内联错误的来由：回调失败带回的三个码，加上点主按钮时离线（navigator.onLine 为 false，TB-122） */
export type LoginNotice = AuthErrorCode | "offline"

/** 登录页内联错误：「发生了什么，能做什么」两段式（07 §7）；不说「你还没有账号」（DS-119） */
export const LOGIN_ERROR: Record<LoginNotice, string> = {
  invalid_token: "登录没有完成，请重试",
  account_disabled: "你的账号已停用，请联系管理员",
  idp_unavailable: "暂时无法连接登录服务，请稍后重试",
  offline: "无法连接网络，请检查网络后重试",
}

/** 产品名（RuntimeConfig.brand，集成方可换）与 IdP 显示名（GET /auth/config 的 idpDisplayName，示例值，不代表任何真实组织） */
export const BRAND = "Cordex"
export const IDP_NAME = "统一身份认证"

/** 状态数据 data.login */
export interface LoginSeed {
  /** auth.selfSignup 开（缺省关） */
  signup?: boolean
  /** 主按钮上方的内联错误：回调失败带回的错误码（/login?error=<码>），或离线时点了主按钮 */
  error?: LoginNotice
  /** 点了主按钮、正在跳转到 IdP */
  redirecting?: boolean
  /** 强制触控 / 手机形态（截图与 Hub 链接用；真实视口 < 640 或触控时自动） */
  form?: "narrow"
  /** DS-118 未采纳的备选：卡片式 */
  card?: boolean
  /** 没配 IdP 显示名时的说明（GET /auth/config 不带 idpDisplayName） */
  noIdpName?: boolean
  /** GET /auth/config 取失败：按缺省渲染（当作 selfSignup 关、没有 IdP 显示名），不报错（TB-122） */
  configFailed?: boolean
  /** 网络未连接（样张演示 navigator.onLine 为 false）：点主按钮不跳转，主按钮上方内联「无法连接网络…」（TB-122） */
  offline?: boolean
}

const LOGO = <LogoMark className="size-8" />

export function LoginPage() {
  const { data } = usePage()
  const seed = (data.login ?? {}) as LoginSeed
  const bp = useBreakpoint()
  const touch = seed.form === "narrow" || bp === "narrow"
  const card = !!seed.card && !touch
  // /auth/config 取失败时按缺省：没有「注册」、说明用通用句
  const signup = !!seed.signup && !seed.configFailed
  const idpName = !(seed.noIdpName || seed.configFailed)
  const [redirecting, setRedirecting] = useSceneState("shell-pages.redirecting", !!seed.redirecting)
  const [error, setError] = useSceneState<LoginNotice | null>("shell-pages.login-error", seed.error ?? null)
  /** 离线时再点主按钮：换一个错误行节点，role=alert 重新播报一次 */
  const [noticeKey, setNoticeKey] = useState(0)
  /** 进行中的一句由常驻的 polite 区播报一次（按钮名只换文字，不靠它播报） */
  const [said, setSaid] = useState("")
  // 浏览器后退从 IdP 回到本页（bfcache 恢复）时按钮恢复可点
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setRedirecting(false)
    }
    window.addEventListener("pageshow", onShow)
    return () => window.removeEventListener("pageshow", onShow)
  }, [setRedirecting])

  const start = () => {
    if (seed.offline) {
      // 离线时不跳转（顶层导航只会落到浏览器自己的错误页）：主按钮上方内联一句，焦点留在主按钮（TB-122）
      setError("offline")
      setNoticeKey((k) => k + 1)
      return
    }
    // 同一颗按钮转为「正在跳转…」（不换元素，焦点留在原处）；错误行随之消失。产品：顶层导航到 /api/v1/auth/oidc/login?next=…&mode=redirect
    setError(null)
    setRedirecting(true)
    setSaid("正在跳转到登录服务")
  }
  const btn = touch ? "h-11 w-full rounded-[8px] text-[13px]" : "w-full"
  const actions = (
    // 宽：桌面 240；卡片里占满卡片内宽（360 − 边框 2 − 左右内边距 64 = 294）；触控占满列宽、最宽 400（BlockingPage 的按钮行按内容收缩，所以都写定宽）
    <div className={cn("flex flex-col gap-2", touch ? "w-[min(400px,calc(100vw-32px))]" : card ? "w-[294px]" : "w-[240px]")}>
      {/*
        进行中：同一颗按钮（同一个元素，焦点留在原处）转圈、不可用（aria-disabled + aria-busy）——kit 主按钮的不可用态（panel-2 底 + text-3），
        画布底上与卡片里相同，同第 2 批「申请访问」发送后、嵌入「请在新窗口登录」的登录窗口已打开（DS-123）
      */}
      <Button
        variant="primary"
        disabled={redirecting}
        aria-busy={redirecting || undefined}
        onClick={start}
        className={btn}
      >
        {redirecting && <LoaderCircle {...ICON} aria-hidden="true" className="motion-safe:animate-spin" />}
        {redirecting ? "正在跳转…" : "使用组织账号登录"}
      </Button>
      {signup && (
        // 注册页属于 IdP（signupUrl），同一标签页顶层导航过去；卡片里是对话框同档的次按钮（DS-37），画布底上是 outline
        <Button variant={card ? "secondary" : "outline"} disabled={redirecting} className={btn}>
          注册
        </Button>
      )}
    </div>
  )
  const notice = error ? (
    <p key={noticeKey} role="alert" className="flex items-center justify-center gap-1.5 text-(--v3-text)">
      <CircleAlert {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-danger)" />
      {LOGIN_ERROR[error]}
    </p>
  ) : undefined
  const page = (
    <BlockingPage
      icon={LOGO}
      title={`登录 ${BRAND}`}
      notice={notice}
      actions={actions}
      hint={signup ? undefined : "没有账号？请联系管理员开通"}
      headingId="shell-pages-login"
      className={cn(touch && "px-4", card && "flex-none px-0 pb-0")}
    >
      {idpName ? (
        <>
          将跳转到<span className="whitespace-nowrap">「{IDP_NAME}」</span>登录，完成后自动返回
        </>
      ) : (
        "将跳转到组织的登录服务，完成后自动返回"
      )}
    </BlockingPage>
  )
  return (
    <>
      {card ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-12 pb-10">
          {/* 卡片：panel 底 + 1px 边、圆角 8（Q4 弹层档；画它时对话框也是 8，2026-10-23 起对话框改 12，DS-142）、宽 360；不是浮层，不带阴影（Q5） */}
          <div className="w-[360px] rounded-[8px] border border-(--v3-border) bg-(--v3-panel) px-8 py-10">{page}</div>
        </div>
      ) : (
        page
      )}
      <p aria-live="polite" className="sr-only">
        {said}
      </p>
    </>
  )
}
