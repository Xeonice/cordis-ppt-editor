import { useLayoutEffect, useRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { tabbables, userHasInteracted } from "./layer"

/**
 * 阻断页（由第 1 批已拍板的「打开失败」页提升，main-states/panels.tsx OpenFailedPage 现转出这一份；02 §6.2、03-13「打开失败态」、03-02 §6.2）：
 * 替换整个工作区，不渲染残缺的左栏、检查器与工具条。画布底色上居中一组：32px 线性图标（text-2，不用危险色大图标吓人）、16px 标题、12px 说明、一行按钮。
 * 返回入口只有一个：按钮组里的「返回文档列表」（原「顶部返回 + 居中返回」两处合一，Q2）。
 * 用在：编辑器打开失败 / 无权访问 / 查看人数已满 / 会话中被撤销（第 1、2 批），第 3 批的登录页与错误页（#/v3/page 宿主，rulings §4.25 DS-118、DS-120、DS-122）、嵌入里的打开失败与「请在新窗口登录」。
 * 编辑器里：状态写 toolbar: { hidden: true, collapse: true } 并把它放进 regions.stage；页面宿主：放进 page.body（宿主给整屏画布底色）。
 *
 *   <BlockingPage icon={<FileX2 size={32} strokeWidth={1.5} aria-hidden="true" />} context="2026 年 Q2 业绩汇报" title="无法打开此文档"
 *     actions={<><Button variant="primary">重试</Button><Button variant="outline">返回文档列表</Button></>}>文件已损坏…</BlockingPage>
 */
export interface BlockingPageProps {
  /** 32px 线性图标（size 32、strokeWidth 1.5、aria-hidden），颜色由这里给 text-2；登录页放品牌标 */
  icon: ReactNode
  /**
   * 标题上方的一行（12px text-2，可读信息，DS-9）：文档名，或回调页（/auth/callback、/auth/popup-callback）的产品名；
   * 登录页不用它，产品名并进标题「登录 Cordex」；无权访问时拿不到元数据就不写
   */
  context?: ReactNode
  title: ReactNode
  /** 说明（12px text-2，最宽 420） */
  children?: ReactNode
  /** 主按钮上方的一行（如登录失败的内联错误，DS-120：危险色图标 + 一句，role=alert 由调用处给） */
  notice?: ReactNode
  /**
   * 一行按钮（主按钮 primary、其余 outline：画布底上的次按钮，DS-37）。
   * 画布底上的主按钮不可用或进行中也用 kit 主按钮的不可用态（panel-2 底；进行中加转圈），与第 2 批一致（rulings §4.25 DS-123：未采用「一律 outline」）
   */
  actions?: ReactNode
  /** 按钮下方的弱提示（12px text-2，如登录页「没有账号？请联系管理员开通」，DS-119） */
  hint?: ReactNode
  /** 标题的 id（aria-labelledby；同一页有两个阻断页时各给一个） */
  headingId?: string
  /**
   * 由用户操作换到这一页时（kit userHasInteracted：「重试」回到上传中、失败页换页、登录页之间跳转），挂载即把焦点交给按钮行第一颗（07 §2.4：换页的这几帧不掉到 body）；
   * 直接打开（场景状态、截图）时不抢焦点。缺省 true；页面另有自己的落点时传 false。第 3 批转正时由 import/pages.tsx 的 useFocusFirstActionOnArrive 并入
   */
  focusOnArrive?: boolean
  className?: string
}

export function BlockingPage({ icon, context, title, children, notice, actions, hint, headingId = "main-states-open-failed", focusOnArrive = true, className }: BlockingPageProps) {
  const row = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!focusOnArrive || !userHasInteracted()) return
    const a = document.activeElement
    // 焦点已经在这一页里（如页内自己的输入框）就不动
    if (a && a !== document.body && row.current?.closest("section")?.contains(a)) return
    const first = row.current ? tabbables(row.current)[0] : undefined
    first?.focus({ preventScroll: true })
    // 只在挂载时
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <section aria-labelledby={headingId} className={cn("flex min-h-0 flex-1 flex-col items-center justify-center px-12 pb-10 text-center", className)}>
      <span className="text-(--v3-text-2)">{icon}</span>
      {context && <p className="mt-4 text-[12px] leading-4 text-(--v3-text-2)">{context}</p>}
      <h1 id={headingId} className={cn("text-[16px] leading-6 font-semibold text-(--v3-text)", context ? "mt-1" : "mt-4")}>
        {title}
      </h1>
      {children && <p className="mt-1.5 max-w-[420px] text-[12px] leading-[18px] text-(--v3-text-2)">{children}</p>}
      {notice && <div className="mt-4 max-w-[420px] text-[12px] leading-[18px]">{notice}</div>}
      {actions && (
        <div ref={row} className={cn("flex items-center gap-2", notice ? "mt-3" : "mt-6")}>
          {actions}
        </div>
      )}
      {hint && <p className="mt-4 max-w-[420px] text-[12px] leading-[18px] text-(--v3-text-2)">{hint}</p>}
    </section>
  )
}
