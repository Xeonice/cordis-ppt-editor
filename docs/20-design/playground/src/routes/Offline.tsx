import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  CheckCircle2, Info, Lock, LogIn, RotateCw, ShieldAlert, X, Zap,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AppBar, DesignBar, EditorShell, Inspector, SlideCanvas, SlideContent, StatusBar, StatusText, ThumbnailRail } from "@/components/editor"
import { EditorRibbon } from "@/components/editor/Ribbon"
import type { RibbonTabValue } from "@/components/editor/Ribbon"
import { collaborators, documentTitle, slides } from "@/lib/mock-data"

type BannerKey =
  | "none" | "offline" | "reconnecting" | "syncing" | "restored" | "auth-expired" | "access-revoked"
  | "readonly-degraded" | "seats-full" | "quarantined"

const stateOptions: { value: BannerKey; label: string }[] = [
  { value: "none", label: "无横幅（正常）" },
  { value: "offline", label: "离线" },
  { value: "reconnecting", label: "重连中" },
  { value: "syncing", label: "同步中" },
  { value: "restored", label: "已恢复（自动消失）" },
  { value: "auth-expired", label: "登录已过期" },
  { value: "access-revoked", label: "访问权限已变更" },
  { value: "readonly-degraded", label: "权限降级 · 未保存改动" },
  { value: "seats-full", label: "编辑者名额已满" },
  { value: "quarantined", label: "隔离态（不可关闭）" },
]

export function Offline() {
  const navigate = useNavigate()
  const [banner, setBanner] = useState<BannerKey>("offline")
  const [dismissed, setDismissed] = useState(false)
  const [ribbonTab, setRibbonTab] = useState<RibbonTabValue>("home")
  const currentSlide = slides[0]!
  const readOnly = banner === "readonly-degraded" || banner === "seats-full"

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar
        title="离线与降级"
        spec="03-screens/12"
        state={banner}
        onStateChange={(v) => { setBanner(v as BannerKey); setDismissed(false) }}
        stateOptions={stateOptions}
        extra={
          <div className="flex gap-1.5">
            <Button variant="ghost" size="xs" onClick={() => toast("已自动修正 1 处结构问题", { action: { label: "查看", onClick: () => toast.success("已定位到受影响元素") } })}>演示：软门禁修复 Toast</Button>
          </div>
        }
      />
      <EditorShell
        appBar={<AppBar onBack={() => navigate("/editor")} backLabel="返回编辑器" title={documentTitle} collaborators={collaborators.filter((c) => !c.isSelf)} status={readOnly ? undefined : { kind: "sync", state: banner === "syncing" ? "syncing" : banner === "reconnecting" ? "reconnecting" : banner === "offline" ? "offline" : "synced" }} />}
        ribbon={
          <div className="flex flex-col">
            {!dismissed && banner !== "none" && <BannerContent banner={banner} onDismiss={() => setDismissed(true)} onAction={(msg) => toast(msg)} />}
            <EditorRibbon value={ribbonTab} onValueChange={setRibbonTab} currentMasterId={currentSlide.masterId} currentLayoutId={currentSlide.layoutId} />
          </div>
        }
        thumbnailRail={<ThumbnailRail mode="normal" slides={slides} currentSlideId={currentSlide.id} />}
        canvas={<SlideCanvas hideZoomBar><SlideContent slide={slides[0]!} fill /></SlideCanvas>}
        inspector={
          <Inspector
            value="properties"
            onValueChange={() => {}}
            readOnly={readOnly}
            readOnlyReason={banner === "seats-full" ? "编辑者名额已满，你已以查看身份加入" : "权限已变更为可评审"}
            tabs={[{ value: "properties", label: "属性", content: null }]}
          />
        }
        statusBar={<StatusBar left={[`第 ${currentSlide.index}/${slides.length} 页`, readOnly && "只读"].filter(Boolean) as string[]} right={[<StatusText key="s" status={{ kind: "sync", state: banner === "offline" ? "offline" : "synced" }} variant="dot" />]} />}
      />
    </div>
  )
}

/** 六态+ 横幅统一走 Alert：浮在 EditorShell 的 glass-strong 工具卡内，mx-2 mt-2 留白+圆角，不贴边平铺。 */
function BannerContent({ banner, onDismiss, onAction }: { banner: BannerKey; onDismiss: () => void; onAction: (msg: string) => void }) {
  const base = "m-2 shrink-0"
  switch (banner) {
    case "offline":
      return (
        <Alert role="status" aria-live="polite" className={`${base} border-warning/40 bg-warning-muted text-warning-foreground`}>
          <Zap />
          <AlertTitle>离线</AlertTitle>
          <AlertDescription className="text-warning-foreground/80">更改已保存在本地，将在重新连接后同步</AlertDescription>
        </Alert>
      )
    case "reconnecting":
      return (
        <Alert role="status" aria-live="polite" className={`${base} border-info/40 bg-info-muted text-info-foreground`}>
          <RotateCw className="animate-spin" />
          <AlertTitle>正在恢复连接…</AlertTitle>
        </Alert>
      )
    case "syncing":
      return (
        <Alert role="status" aria-live="polite" className={`${base} border-info/40 bg-info-muted text-info-foreground`}>
          <RotateCw className="animate-spin" />
          <AlertTitle>正在同步 12 项更改…</AlertTitle>
        </Alert>
      )
    case "restored":
      return (
        <Alert role="status" aria-live="polite" className={`${base} border-success/40 bg-success-muted text-success-foreground`}>
          <CheckCircle2 />
          <AlertTitle>已恢复协同并同步完成</AlertTitle>
          <AlertAction>
            <Button variant="ghost" size="icon-xs" className="text-success-foreground" aria-label="关闭" onClick={onDismiss}><X /></Button>
          </AlertAction>
        </Alert>
      )
    case "auth-expired":
      return (
        <Alert role="alert" aria-live="assertive" className={`${base} border-warning/40 bg-warning-muted text-warning-foreground`}>
          <Zap />
          <AlertTitle>登录已过期，本地更改尚未同步</AlertTitle>
          <AlertAction>
            <Button size="xs" variant="outline" className="border-warning-foreground/40 text-warning-foreground" onClick={() => onAction("正在跳转到登录…")}><LogIn /> 重新登录</Button>
          </AlertAction>
        </Alert>
      )
    case "access-revoked":
      return (
        <Alert role="alert" aria-live="assertive" className={`${base} border-destructive/40 bg-destructive/10 text-destructive`}>
          <ShieldAlert />
          <AlertTitle>访问权限已变更，你可能无法继续编辑此文档</AlertTitle>
          <AlertAction>
            <Button size="xs" variant="outline" className="border-destructive/40 text-destructive" onClick={() => onAction("已发送访问申请，等待批准")}>申请访问</Button>
          </AlertAction>
        </Alert>
      )
    case "readonly-degraded":
      return (
        <Alert role="alert" aria-live="assertive" className={`${base} border-destructive/40 bg-destructive/10 text-destructive`}>
          <Lock />
          <AlertTitle>你的权限已变更为「可评审」，3 项更改未被保存</AlertTitle>
          <AlertDescription className="text-destructive/80">文档已重新载入服务端版本，撤销历史已清空</AlertDescription>
          <AlertAction>
            <Button size="xs" variant="outline" className="border-destructive/40 text-destructive" onClick={() => onAction("已导出为本地副本")}>导出为本地副本</Button>
          </AlertAction>
        </Alert>
      )
    case "seats-full":
      return (
        <Alert role="alert" aria-live="assertive" className={`${base} border-destructive/40 bg-destructive/10 text-destructive`}>
          <Lock />
          <AlertTitle>编辑者名额已满，你已以查看身份加入（≤ 20 编辑者）</AlertTitle>
        </Alert>
      )
    case "quarantined":
      return (
        <Alert role="alert" aria-live="assertive" className={`${base} border-destructive/40 bg-destructive/10 text-destructive`}>
          <Info />
          <AlertTitle>你的会话已被暂停协同，请刷新页面重新加入；如持续出现请联系管理员</AlertTitle>
          <AlertAction>
            <Button size="xs" variant="outline" className="border-destructive/40 text-destructive" onClick={() => onAction("正在刷新…")}>刷新</Button>
          </AlertAction>
        </Alert>
      )
    default:
      return null
  }
}
