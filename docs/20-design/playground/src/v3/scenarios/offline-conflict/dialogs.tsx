import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { FileBraces, Move, SquarePlus, Type, type LucideIcon } from "lucide-react"
import { Button, Dialog, FileTypeIcon, ICON, ICON_LG, LayerClose, RadioRow, useEditor, useEditorCommand, useSceneState } from "../../kit"
import { useV3Params, v3Href } from "../../params"
import { EXPORT_COPY, useExportFlow, useRefreshConfirm } from "./banners"

/**
 * offline-conflict 场景的对话框：
 * 1. 「离开 / 刷新将丢失未同步更改」（03-12「离开保护」、05 §7、03-19 §7；50/04「应用内路由离开」、50/02 §12「刷新前」）——
 *    浏览器自己的 beforeunload 提示文案与外观都不能定制（现代浏览器忽略自定义文字），所以这句话只能出现在应用内触发的离开与刷新上：
 *    主菜单「返回首页」、隔离态「刷新」、插件设置「重新加载」、发现新版本「刷新」。先 flush（≤ 5 / 10 s），仍有未同步项才弹。
 * 2. 「导出本地副本」（03-12 readonly-degraded、05 §8；50/07 §8.2 第 5 步）：列出未被保存的更改（取被拒事务的摘要：命令名 + 所在页），
 *    再选格式——演示文稿副本（.pptx，缺省）或更改摘要（.json，供人工比对）。系统不承诺把副本自动合并回文档。
 *    格式行与通用导出对话框同一画法（03-22 §2.3）：单选圈与名称之间放 20px 文件类型图标——.pptx 一行是 Tabler file-type-ppt（kit FileTypeIcon，同导出对话框），
 *    .json 一行是 lucide FileBraces（20、描边 1.5；Tabler 没有 json 的文件类型图标）；中性色、只作装饰（rulings §4.25 DS-143、TB-182，2026-10-23）。
 * 确认类用 kit Dialog 的 confirm 变体；危险的那一项（仍要离开 / 仍要刷新）用危险色主按钮，次按钮是安全项（留下 / 取消），用户打开时初始焦点在它上面（initialFocus="secondary"）。
 * 说明文字与其他对话框同一口径：每句以句号结尾（第 1 批对话框、评论与版本历史的确认框都如此）。
 */

/**
 * 这些更改为什么还没同步（离开与刷新确认的第一句随之换）：offline 离线 · auth 登录已过期 · paused 隔离态（协同已暂停）· server 服务器保存延迟（发起方）·
 * drift 发现新版本（会话已因版本不一致关闭，03-12 §9；第 3 批转正时由 doc-banners 并入，kitRequest g7 K4）。
 * 第二句与按钮相同：先导出本地副本，或「留下」/「仍要离开」（刷新：「取消」/「仍要刷新」；退出登录：「取消」/「仍要退出」）。
 * 退出登录（shell-pages.logout-unsynced-confirm，第 3 批转正时并入为 kind logout）用同一张表，动词「离开」换成「退出」。
 */
export type LeaveCause = "offline" | "auth" | "paused" | "server" | "drift"
const LEAVE_FIRST: Record<LeaveCause, string> = {
  offline: "网络恢复后这些更改会自动同步，现在离开会丢失它们。",
  auth: "重新登录后这些更改会自动同步，现在离开会丢失它们。",
  paused: "协同已暂停，这些更改还没有提交到服务器。",
  server: "服务器恢复后这些更改会自动保存，现在离开会丢失它们。",
  drift: "发现新版本，这些更改还没有提交到服务器。",
}

/** 未同步更改的条数与离开 / 刷新 / 退出登录三种入口的文案。 */
const UNSYNCED = {
  leave: {
    title: "离开将丢失 3 项未同步更改",
    lines: ["网络恢复后这些更改会自动同步，现在离开会丢失它们。", "可以先导出本地副本，再离开。"],
    stay: "留下",
    go: "仍要离开",
    returnFocus: "main-menu",
  },
  refresh: {
    title: "刷新将丢失 3 项未同步更改",
    lines: ["协同已暂停，这些更改还没有提交到服务器。", "可以先导出本地副本，再刷新页面。"],
    stay: "取消",
    go: "仍要刷新",
    returnFocus: "offline-conflict.refresh",
  },
  logout: {
    title: "退出登录将丢失 3 项未同步更改",
    lines: ["网络恢复后这些更改会自动同步，现在退出会丢失它们。", "可以先导出本地副本，再退出登录。"],
    stay: "取消",
    go: "仍要退出",
    returnFocus: "account",
  },
} as const

/**
 * 「离开 / 刷新将丢失未同步更改」确认框（sm 360）：左下「导出为本地副本」（导出后照常可以离开），右侧安全项 + 危险项。
 * open / onOpenChange 受控时随场景状态开关；不传时一出现就是打开的（静态演示）。
 * 第一句按原因换（cause；缺省离开与退出登录是离线、刷新是协同已暂停，即第 2 批的原句）；returnFocus 换掉关闭后焦点交回的锚点（缺省离开回主菜单、刷新回隔离态横幅的「刷新」、退出登录回自己的头像）
 */
export function UnsyncedConfirm({
  kind,
  cause,
  open,
  onOpenChange,
  onConfirm,
  returnFocus,
}: {
  kind: keyof typeof UNSYNCED
  /** 为什么还没同步（第一句随之换） */
  cause?: LeaveCause
  open?: boolean
  onOpenChange?: (v: boolean) => void
  /** 危险项（仍要离开 / 仍要刷新）选了之后 */
  onConfirm?: () => void
  /** 关闭后焦点交回的锚点 */
  returnFocus?: string
}) {
  const t = UNSYNCED[kind]
  const first = LEAVE_FIRST[cause ?? (kind === "refresh" ? "paused" : "offline")]
  const lines = [kind === "logout" ? first.replace("现在离开", "现在退出") : first, t.lines[1]]
  const { setOpen: setExportOpen } = useExportFlow()
  return (
    <Dialog
      variant="confirm"
      title={t.title}
      // 每句一行：360 宽里连排会把「可以」「本地」这类词断在两行之间
      description={lines.map((l) => (
        <span key={l} className="block">
          {l}
        </span>
      ))}
      open={open}
      onOpenChange={onOpenChange}
      returnFocus={returnFocus ?? t.returnFocus}
      // 用户打开时焦点先落在安全项「留下 / 取消」（50/10 规则 3），不是左下的「导出为本地副本」
      initialFocus="secondary"
      footerStart={
        <LayerClose>
          <Button variant="secondary" onClick={() => setExportOpen(true)}>
            导出为本地副本
          </Button>
        </LayerClose>
      }
      secondary={{ label: t.stay }}
      primary={{ label: t.go, danger: true, onClick: onConfirm }}
    />
  )
}

/**
 * 离开拦截（03-12「离开保护」、05 §7）：本端有未同步更改的状态里接管主菜单「返回首页」（底座命令 home）——不直接跳转，先弹
 * 「离开将丢失 3 项未同步更改」确认（初始焦点在「留下」，关闭后焦点回主菜单）；「仍要离开」才回首页，「导出为本地副本」打开导出对话框。
 * 场景状态 data.leaveOpen 给初值（leave-confirm 一出现就开着）。withExport：这个状态的 layers 里还没有导出对话框时由这里挂一个（焦点回主菜单；
 * 说明的第二句按原因换：离线「恢复连接后可以对照重做」，其余中性句，REDO_BY_CAUSE，DS-129、TB-139）。
 */
export function LeaveGuard({ cause, withExport = true }: { cause: LeaveCause; withExport?: boolean }) {
  const { data } = useEditor()
  const navigate = useNavigate()
  const { theme, accent } = useV3Params()
  const [open, setOpen] = useSceneState("offline-conflict.leave-open", !!data.leaveOpen)
  useEditorCommand("home", () => setOpen(true))
  return (
    <>
      <UnsyncedConfirm kind="leave" cause={cause} open={open} onOpenChange={setOpen} onConfirm={() => navigate(v3Href("/v3/home", { theme, accent }))} />
      {withExport && <ExportLayer returnFocus="main-menu" redo={REDO_BY_CAUSE[cause]} />}
    </>
  )
}

/** 隔离态横幅「刷新」打开的确认框（受控：场景内共享状态，换状态即复位）。 */
export function RefreshConfirmLayer() {
  const [open, setOpen] = useRefreshConfirm()
  return <UnsyncedConfirm kind="refresh" open={open} onOpenChange={setOpen} />
}

/** 未被保存的更改：取被拒事务的摘要（TransactionRecord.label + 触及的页，30/04 §2.4、50/07 §8.2）。示例与降权前在第 3、5 页做的三步一致。 */
const CHANGES: { Icon: LucideIcon; label: string; page: number }[] = [
  { Icon: Type, label: "修改文字「毛利率」", page: 3 },
  { Icon: Move, label: "移动「活跃客户」卡片", page: 3 },
  { Icon: SquarePlus, label: "插入文本框", page: 5 },
]

const FORMATS = [
  { id: "pptx", label: "演示文稿副本（.pptx）", hint: "含这些更改的完整文档，可直接打开", icon: <FileTypeIcon type="pptx" /> },
  { id: "json", label: "更改摘要（.json）", hint: "逐项列出更改，供人工比对", icon: <FileBraces {...ICON_LG} aria-hidden="true" /> },
] as const

/** 导出对话框说明的第二句（03-12 §7.2）：ExportDialog / ExportLayer 的 redo 缺省是降权的写法；其余原因取 EXPORT_COPY（banners.tsx，rulings §4.25 DS-129、TB-139） */
const REDO_DEGRADED = EXPORT_COPY.degraded.redo

/** 从离开 / 刷新 / 退出登录确认框打开的导出：第二句按确认框的原因换——离线「恢复连接后可以对照重做」，其余（登录已过期、协同已暂停、未保存到服务器、发现新版本）用中性句（DS-129、TB-139） */
export const REDO_BY_CAUSE: Record<LeaveCause, string> = {
  offline: EXPORT_COPY.offline.redo,
  auth: EXPORT_COPY.neutral.redo,
  paused: EXPORT_COPY.neutral.redo,
  server: EXPORT_COPY.neutral.redo,
  drift: EXPORT_COPY.neutral.redo,
}

/**
 * 「导出本地副本」对话框（md 480）：说明 · 未被保存的 N 项（只读列表，点某一项切到该页对照）· 格式单选 · 取消 / 导出。
 * 导出即下载（临时 Unit 上「服务端状态 + 被拒集合」导出，50/07 §8.2），完成后横幅降级为可关闭的「已导出」。
 * 降权后没有 doc.export 也能导出这份副本（PRD CO-05）。
 * redo：说明的第二句按原因换（EXPORT_COPY[原因].redo、REDO_BY_CAUSE，rulings §4.25 DS-129、TB-139）；不传时为降权原句，与原来相同。
 */
export function ExportDialog({
  open,
  onOpenChange,
  onExport,
  returnFocus = "offline-conflict.export",
  redo = REDO_DEGRADED,
}: {
  open?: boolean
  onOpenChange?: (v: boolean) => void
  onExport?: () => void
  /** 打开它的触发处已卸载时，关闭后焦点交给的锚点（缺省横幅的「导出为本地副本」；从确认框打开时交还给确认框的触发处） */
  returnFocus?: string
  /** 说明的第二句（缺省降权原句） */
  redo?: string
}) {
  const { goTo } = useEditor()
  const [format, setFormat] = useState<(typeof FORMATS)[number]["id"]>("pptx")
  return (
    <Dialog
      title="导出本地副本"
      description={
        <>
          <span className="block">下面 3 项更改没有保存到文档。</span>
          <span className="block">{redo}</span>
        </>
      }
      open={open}
      onOpenChange={onOpenChange}
      returnFocus={returnFocus}
      bodyClassName="flex flex-col gap-4 p-4"
      secondary={{ label: "取消" }}
      primary={{ label: "导出", onClick: onExport }}
    >
      <section aria-labelledby="offline-conflict-changes">
        <h3 id="offline-conflict-changes" className="mb-1 text-[12px] leading-4 font-semibold text-(--v3-text)">
          未保存的更改
        </h3>
        <ul className="flex flex-col">
          {CHANGES.map(({ Icon, label, page }) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => goTo(page)}
                className="-mx-1.5 flex h-7 w-[calc(100%+12px)] items-center gap-2 rounded-[4px] px-1.5 text-left text-[12px] leading-none text-(--v3-text) transition-colors hover:bg-(--v3-panel-2)"
              >
                <Icon {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <span className="shrink-0 text-(--v3-text-2)">{`第 ${page} 页`}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="offline-conflict-format">
        <h3 id="offline-conflict-format" className="mb-1 text-[12px] leading-4 font-semibold text-(--v3-text)">
          格式
        </h3>
        <div role="radiogroup" aria-labelledby="offline-conflict-format" className="flex flex-col">
          {FORMATS.map((f) => (
            <RadioRow key={f.id} checked={format === f.id} label={f.label} icon={f.icon} onSelect={() => setFormat(f.id)}>
              <span className="ml-auto pl-3 text-(--v3-text-2)">{f.hint}</span>
            </RadioRow>
          ))}
        </div>
      </section>
    </Dialog>
  )
}

/** 降权横幅「导出为本地副本」打开的导出对话框（受控；导出后横幅换成「已导出」）。redo：说明的第二句（同 ExportDialog，缺省降权原句）。 */
export function ExportLayer({ returnFocus, redo }: { returnFocus?: string; redo?: string }) {
  const { open, setOpen, setExported } = useExportFlow()
  return <ExportDialog open={open} onOpenChange={setOpen} onExport={() => setExported(true)} returnFocus={returnFocus} redo={redo} />
}
