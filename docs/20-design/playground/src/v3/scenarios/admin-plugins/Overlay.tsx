import { CircleAlert } from "lucide-react"
import { Button, Popover, PopoverTitle, Toast, Toasts } from "../../kit"
import { SI, StatusLabel } from "./bits"
import { STATUS, type DeployStatus } from "./data"
import { DetailDrawer } from "./DetailDrawer"
import { AdminDialogs } from "./Dialogs"
import { useAdmin } from "./store"

/**
 * 主区叠加层（page.overlay）：底部保存条与轻提示。
 * 保存条（03-32 §6）：有草稿时出现在主区底部居中——panel 底、1px 边、浮层阴影、圆角 12、高 48（同编辑器底部工具条，不再是玻璃胶囊）；
 * 「N 项未保存的变更 · 保存后新会话生效」+ 次按钮「放弃」+ 主按钮「检查并保存…」（保存条是 panel 底，次按钮照常用 secondary）；有互斥时中间换成危险色图标 +「N 处互斥冲突」（文字主文字色，DS-41），
 * 「检查并保存…」留在原位不可用并写原因。region「未保存的变更」，Tab 可达。
 * 轻提示（kit Toasts bottom 24：应用壳没有底部工具条；保存条在时让到它上方）：保存成功「已保存 N 项插件变更」+ 说明一行（成功色图标、中性底，DS-41）。
 */
export function AdminOverlay() {
  const api = useAdmin()
  const n = api.changes.length
  return (
    <>
      {n > 0 && <SaveBar />}
      {api.toast !== null && (
        <Toasts bottom={n > 0 ? 84 : 24}>
          <Toast key={api.toast} tone="success" description="新会话生效；已打开的会话会在 60 秒内收到重新加载提示" onClose={() => api.setToast(null)}>
            已保存 {api.toast} 项插件变更
          </Toast>
        </Toasts>
      )}
    </>
  )
}

function SaveBar() {
  const api = useAdmin()
  const n = api.changes.length
  const mutex = api.mutexPairs
  const why = mutex.length ? `先解决互斥冲突：${mutex.map((c) => `「${c.a.name}」与「${c.b.name}」`).join("、")}不能同时启用，把其中一个设为禁用后再保存` : undefined
  return (
    <div
      role="region"
      aria-label="未保存的变更"
      className="absolute bottom-6 left-1/2 z-[16] flex h-12 -translate-x-1/2 items-center gap-3 rounded-[12px] border border-(--v3-border) bg-(--v3-panel) pr-2 pl-4 whitespace-nowrap text-[12px] leading-4 shadow-(--v3-shadow)"
    >
      {mutex.length ? (
        <>
          <span className="text-(--v3-text)">
            <span className="font-semibold tabular-nums">{n}</span> 项未保存的变更
          </span>
          {/* 阻止态：中间换成危险色图标 +「N 处互斥冲突」（图标本身就是分隔，不再加「·」，03-32 §6） */}
          <span className="inline-flex items-center gap-1 text-(--v3-text)">
            <CircleAlert {...SI} className="text-(--v3-danger)" />
            {mutex.length} 处互斥冲突
          </span>
        </>
      ) : (
        // 「N 项未保存的变更 · 保存后新会话生效」（50/03 §10.1 原文带「·」，复验 AP-08）
        <span className="text-(--v3-text)">
          <span className="font-semibold tabular-nums">{n}</span> 项未保存的变更
          <span className="text-(--v3-text-2)"> · 保存后新会话生效</span>
        </span>
      )}
      <div className="ml-2 flex items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            // 「放弃」后保存条随之卸载：焦点先交给主区（不掉到 body），再清空草稿
            document.querySelector<HTMLElement>('main[data-v3-anchor="canvas"]')?.focus({ preventScroll: true })
            api.discard()
          }}
        >
          放弃
        </Button>
        <Button variant="primary" data-v3-anchor="admin-plugins.save" disabled={!!why} reason={why} onClick={() => api.setConfirm(true)}>
          检查并保存…
        </Button>
      </div>
    </div>
  )
}

/** 浮层（page.layers）：详情抽屉、几张确认卡、状态说明弹层 */
export function AdminLayers() {
  return (
    <>
      <DetailDrawer />
      <AdminDialogs />
      <StatusLegend />
    </>
  )
}

const TOP: DeployStatus[] = ["failed", "pending", "enabled", "disabled", "declared"]
const REJECTED: DeployStatus[] = ["incompatible", "unsigned", "invalid"]

/**
 * 「状态说明」弹层（03-32 §4.2，宽 384）：八种部署级状态各一行（图标 + 名称 · 一句说明），按清单的分组次序；三种被拒状态另起一段，段首写明「只能由部署方修复后重新部署」。
 * 图标与清单、第 2 批个人面板同一套（data.ts STATUS）。点触发按钮本身由按钮切换（不当作点外面），Esc 关闭后焦点回到「状态说明」。
 */
function StatusLegend() {
  const api = useAdmin()
  if (!api.legend) return null
  return (
    <Popover
      anchor="admin-plugins.legend"
      side="bottom"
      align="end"
      label="部署级状态说明"
      className="w-96 p-3"
      onOpenChange={(v) => !v && api.setLegend(false)}
      onInteractOutside={(e) => {
        const t = e.target
        if (t instanceof Element && t.closest('[data-v3-anchor="admin-plugins.legend"]')) e.preventDefault()
      }}
    >
      <PopoverTitle>部署级状态（8 种）</PopoverTitle>
      <ul className="mt-2 flex flex-col gap-2">
        {TOP.map((s) => (
          <LegendRow key={s} status={s} />
        ))}
      </ul>
      <p className="mt-3 border-t border-(--v3-border) pt-3 text-[12px] leading-[18px] text-(--v3-text-2)">未通过部署校验：没有开关与重试，只能由部署方修复后重新部署</p>
      <ul className="mt-2 flex flex-col gap-2">
        {REJECTED.map((s) => (
          <LegendRow key={s} status={s} />
        ))}
      </ul>
    </Popover>
  )
}

function LegendRow({ status }: { status: DeployStatus }) {
  return (
    <li className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 text-[12px] leading-[18px]">
      <StatusLabel status={status} className="h-[18px]" />
      <span className="text-(--v3-text-2)">{STATUS[status].hint}</span>
    </li>
  )
}
