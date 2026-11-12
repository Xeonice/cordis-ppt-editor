import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { useNavigate } from "react-router-dom"
import { Check, CircleCheck, CloudOff, FileQuestionMark, KeyRound, Link2Off, SearchX, TriangleAlert, Wrench } from "lucide-react"
import { BlockingPage, Button, ICON, LoadingRow, usePage, useSceneState } from "../../kit"
import { useV3Params } from "../../params"
import { RequestAccessButton, RequestSentLine, useAccessRequest } from "../share/RequestAccess"
import { BRAND, type AuthErrorCode } from "./LoginPage"

/**
 * shell-pages 场景的其余页面：OIDC 回调、新窗口重新登录回调、路由兜底与错误页（rulings §4.25 DS-71）。
 * 全部沿用已拍板的阻断页画法（kit BlockingPage：32px 线性图标 text-2 · 16px 标题 · 12px 说明 · 一行按钮；主操作 primary、返回类 outline，03-02 §6.2），
 * 过渡态用居中的一行加载行（kit LoadingRow，DS-53：超过 300 ms 才出现，不画骨架）。
 * 产品名一行（BlockingPage context）：回调页（/auth/callback、/auth/popup-callback）上的阻断页一律在图标下、标题上写产品名一行——刚从 IdP 跳回、
 * 或在单独的小窗 / 新标签里，用产品名接上「这是哪个应用」；登录页把产品名并进标题「登录 Cordex」；其余错误页（404、页面出错了、配置错误、文档类失败页）不写。
 * 页面宿主（#/v3/page）里的页面读 usePage()；文档类的失败页（找不到该文档、链接已失效）是编辑器路由 /documents/:id 的 failed 态，
 * 放在编辑器宿主里（offline-conflict/pages.tsx 的 blockingPage 配置，与第 1 批 open-failed 同一做法），「申请访问」是第 2 批同一个留言弹层（share/RequestAccess.tsx）；
 * 发送后按钮留在原位不可用：kit 主按钮的不可用态（rulings §4.25 DS-123，画布底上同此；原 offOutline 选项随裁决删去）。
 */

const BIG = { size: 32, strokeWidth: 1.5, "aria-hidden": true } as const

/** 站内跳转（沿用当前主题与强调色）：返回首页、返回文档列表、退出后回登录页 */
export function useGo() {
  const navigate = useNavigate()
  const { theme, accent } = useV3Params()
  return (path: string, state?: string) => {
    const q = new URLSearchParams()
    if (state) q.set("state", state)
    q.set("theme", theme)
    q.set("accent", accent)
    navigate(`${path}?${q.toString()}`)
  }
}

/** 整屏居中的一行加载行（回调页、新窗口回调页；启动时探测会话同一画法）。其余属性（focusable、label、data-*）原样给 LoadingRow */
export function CenterLoading({ children, ...rest }: { children: ReactNode; focusable?: boolean; label?: string } & Omit<HTMLAttributes<HTMLDivElement>, "children" | "role">) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center pb-10">
      <LoadingRow center {...rest}>
        {children}
      </LoadingRow>
    </div>
  )
}

/* ------------------------------------------------------------------ /auth/callback */

/**
 * 回调页拿到会话但 GET /auth/me 网络失败（超时、离线、502/503/504，50/02 §4.2 classifyAuthError → network；rulings §4.25 TB-122）：会话 cookie 已设好，只是确认不了。
 * 回调页上的阻断页，标题上方写产品名一行（同 alt-callback-failed、popup 两页）。
 * 「重试」原地再调 /auth/me（不重走 IdP）：先把焦点交给加载行、再换状态（07 §2.4 第 3 条），加载行可程序聚焦并带读屏名；
 * 样张里约 1.2 秒后视为成功，转到开始页（产品转到 nextAfterLogin(next)）。
 */
export function CallbackNetworkError() {
  const [phase, setPhase] = useSceneState<"error" | "loading">("shell-pages.callback-phase", "error")
  const go = useGo()
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const retry = () => {
    flushSync(() => setPhase("loading"))
    document.querySelector<HTMLElement>("[data-shell-pages-loading]")?.focus({ preventScroll: true })
    timer.current = window.setTimeout(() => go("/v3/home"), 1200)
  }
  if (phase === "loading")
    return (
      <CenterLoading focusable label="正在登录" data-shell-pages-loading="">
        正在登录…
      </CenterLoading>
    )
  return (
    <BlockingPage
      icon={<CloudOff {...BIG} />}
      context={BRAND}
      title="暂时无法确认登录状态"
      actions={
        <Button variant="primary" onClick={retry}>
          重试
        </Button>
      }
      headingId="shell-pages-callback"
    >
      请检查网络连接后重试
    </BlockingPage>
  )
}

/** DS-120 未采纳的备选（alt-callback-failed）：回调页就地显示失败页（按码的标题与说明 +「重新登录」+「返回登录页」） */
export function CallbackFailedPage() {
  const go = useGo()
  return (
    <BlockingPage
      icon={<KeyRound {...BIG} />}
      context={BRAND}
      title="登录没有完成"
      actions={
        <>
          <Button variant="primary">重新登录</Button>
          <Button variant="outline" onClick={() => go("/v3/page", "shell-pages.login")}>
            返回登录页
          </Button>
        </>
      }
      headingId="shell-pages-callback-failed"
    >
      登录信息已失效，请重新登录
    </BlockingPage>
  )
}

/* ------------------------------------------------------------------ /auth/popup-callback（新窗口重新登录，50/02 §5） */

/**
 * 新标签里登录完成、window.close() 关不掉：「已重新登录」+ 回到原来的页面；不放按钮（关不掉，也不引导在这里另开一份文档）。
 * 原来的页面可能是编辑器（登录已过期横幅）、只读浏览或嵌入的仅查看（embed-frame.auth-blocked），所以只说「回到原来的页面」，不说「继续编辑」
 */
export function PopupDoneTab() {
  return (
    <BlockingPage icon={<CircleCheck {...BIG} />} context={BRAND} title="已重新登录" headingId="shell-pages-popup-done">
      可以关闭此页，回到原来的页面
    </BlockingPage>
  )
}

/**
 * 新窗口回调带了 error：按码一句原因（data.popupError，缺省 invalid_token）+「关闭此窗口」（脚本打开的窗口关得掉）。
 * 新标签里（弹窗被拦截时）关不掉：不放按钮，原因句末改为「…请关闭此页，回到原来的页面重新登录」（样张不另画）
 */
const POPUP_REASON: Record<AuthErrorCode, string> = {
  invalid_token: "登录信息已失效，请回到原来的页面重新登录",
  idp_unavailable: "暂时无法连接登录服务，请稍后在原来的页面重新登录",
  // DS-125：停用那句后补半句，指向原页离开 / 刷新确认里的「导出为本地副本」（原页横幅与频道协议都不改）
  account_disabled: "你的账号已停用，请联系管理员；原来页面里未同步的更改，可在离开时导出为本地副本",
}

export function PopupFailed() {
  const { data } = usePage()
  const code = (data.popupError as AuthErrorCode | undefined) ?? "invalid_token"
  return (
    <BlockingPage
      icon={<KeyRound {...BIG} />}
      context={BRAND}
      title="登录没有完成"
      actions={
        <Button variant="outline" onClick={() => window.close()}>
          关闭此窗口
        </Button>
      }
      headingId="shell-pages-popup-failed"
    >
      {POPUP_REASON[code]}
    </BlockingPage>
  )
}

/* ------------------------------------------------------------------ 路由兜底与错误页 */

/** 路由兜底 *（50/02 §2 errors/NotFoundPage）：未登记的路径；「返回首页」 */
export function NotFoundRoute() {
  const go = useGo()
  return (
    <BlockingPage
      icon={<SearchX {...BIG} />}
      title="找不到此页面"
      actions={
        <Button variant="outline" onClick={() => go("/v3/home")}>
          返回首页
        </Button>
      }
      headingId="shell-pages-not-found"
    >
      链接可能有误，或页面已不存在
    </BlockingPage>
  )
}

/** 诊断信息（EM-12：不含文档内容）：应用版本、路由（不含查询与片段）、时间、错误名与消息、traceId */
const DIAG = [
  "app: cordex-web 2.0.0",
  "route: /documents/:id",
  "time: 2026-10-16T09:41:07+08:00",
  "error: TypeError: Cannot read properties of undefined (reading 'layout')",
  "traceId: 4f2c9a1e7b3d4e05",
].join("\n")

/**
 * 根错误边界（50/02 §2 AppErrorBoundary、50/15 §4.3）：「重新加载」（主）·「复制诊断信息」（outline）。
 * 「复制诊断信息」点后原位变为「已复制」1.5 秒（同 03-08「复制链接」：不用系统级通知，按钮定宽不跳，polite 播报一次）
 */
export function AppErrorPage() {
  const [copied, setCopied] = useState(false)
  const [said, setSaid] = useState("")
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = () => {
    try {
      void navigator.clipboard?.writeText(DIAG).catch(() => undefined)
    } catch {
      // 剪贴板不可用（非安全上下文）时只演示按钮反馈
    }
    setCopied(true)
    setSaid("已复制诊断信息")
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1500)
  }
  return (
    <>
      <BlockingPage
        icon={<TriangleAlert {...BIG} />}
        title="页面出错了"
        actions={
          <>
            <Button variant="primary" onClick={() => window.location.reload()}>
              重新加载
            </Button>
            <Button variant="outline" onClick={copy} className="min-w-[100px]">
              {copied && <Check {...ICON} aria-hidden="true" />}
              {copied ? "已复制" : "复制诊断信息"}
            </Button>
          </>
        }
        headingId="shell-pages-app-error"
      >
        请重新加载；如果问题持续，请复制诊断信息并联系管理员
      </BlockingPage>
      <p aria-live="polite" className="sr-only">
        {said}
      </p>
    </>
  )
}

/** 配置项与取值（代码串，等宽、主文字色：同 plugins 的插件 id 写法，与周围的 text-2 说明分开） */
function Code({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[12px] leading-[18px] whitespace-nowrap text-(--v3-text)">{children}</code>
}

/**
 * RuntimeConfig 校验失败（50/02 §3）：静态页、内置中英两段、零网络请求（不读偏好、不加载 i18n 包），不放按钮；
 * 列出出错的配置项（路径 + 原因，中英各一句；配置项与取值都用等宽主文字色，英文句不以小写的取值开头）。
 * 示例：生产构建里 auth.mode 设成了 none（50/02 §3：none 只在 dev 构建生效）
 */
export function ConfigErrorPage() {
  return (
    <BlockingPage
      icon={<Wrench {...BIG} />}
      title="应用配置有误，无法启动"
      notice={
        <div className="flex flex-col items-center gap-0.5 text-(--v3-text-2)">
          <Code>auth.mode</Code>
          <span>
            生产构建不接受取值 <Code>none</Code>
          </span>
          <span lang="en">
            The value <Code>none</Code> is not allowed in production builds
          </span>
        </div>
      }
      headingId="shell-pages-config-error"
    >
      <span className="block">请联系部署管理员检查下面的配置项</span>
      <span lang="en" className="mt-2 block">
        The app can’t start because its configuration is invalid. Contact your deployment administrator to check the item below.
      </span>
    </BlockingPage>
  )
}

/* ------------------------------------------------------------------ 编辑器路由 /documents/:id 的 failed 态（编辑器宿主，blockingPage 配置） */

/** rulings §4.25 DS-122：文档 404 单独一页，只有「返回文档列表」（拿不到元数据，不写文档名） */
export function NotFoundDocPage() {
  const go = useGo()
  return (
    <BlockingPage
      icon={<FileQuestionMark {...BIG} />}
      title="找不到该文档"
      actions={
        <Button variant="outline" onClick={() => go("/v3/documents")}>
          返回文档列表
        </Button>
      }
      headingId="shell-pages-not-found-doc"
    >
      文档可能已被删除，或链接有误
    </BlockingPage>
  )
}

/**
 * 分享链接已撤销或到期、又没有直接授权（50/02 §11 第 5 步）：「没有访问权限」阻断页的变体——换断链图标、标题与第一句说明；
 * 「申请访问」是第 1、2 批同一个留言弹层（DS-48），发送后按钮留在原位不可用（kit 主按钮的不可用态，DS-123）、页上写「已发送申请，等待文档所有者批准」
 */
export function LinkExpiredPage() {
  const go = useGo()
  const r = useAccessRequest()
  return (
    <BlockingPage
      icon={<Link2Off {...BIG} />}
      title="链接已失效"
      actions={
        <>
          <RequestAccessButton />
          <Button variant="outline" onClick={() => go("/v3/documents")}>
            返回文档列表
          </Button>
        </>
      }
      headingId="shell-pages-link-expired"
    >
      {/* 两句各占一行：420 宽里连排会把「申请」断在两行之间（同 offline-conflict RevokedPage） */}
      <span className="block">这个分享链接已被撤销或已过期</span>
      {!r.sent && <span className="block">可以向文档所有者申请访问，获得批准后即可打开</span>}
      <RequestSentLine sent={r.sent} />
    </BlockingPage>
  )
}

/** DS-122 未采纳的备选（alt-404-merged）：404 与 403 合成一页（「找不到文档，或你没有访问权限」+「申请访问」） */
export function MergedNotFoundPage() {
  const go = useGo()
  const r = useAccessRequest()
  return (
    <BlockingPage
      icon={<FileQuestionMark {...BIG} />}
      title="找不到文档，或你没有访问权限"
      actions={
        <>
          <RequestAccessButton />
          <Button variant="outline" onClick={() => go("/v3/documents")}>
            返回文档列表
          </Button>
        </>
      }
      headingId="shell-pages-merged-404"
    >
      <span className="block">文档可能已被删除、链接有误，或你还没有访问权限</span>
      {!r.sent && <span className="block">可以向文档所有者申请访问，获得批准后即可打开</span>}
      <RequestSentLine sent={r.sent} />
    </BlockingPage>
  )
}
