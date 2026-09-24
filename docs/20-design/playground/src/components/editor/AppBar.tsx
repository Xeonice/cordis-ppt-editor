import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft, Copy, Download, FileCheck, History, MoreHorizontal, PanelLeft, PanelRight, Puzzle, Redo2, SquarePen, Undo2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { UserMenu } from "@/components/user-menu"
import { cn } from "@/lib/utils"
import type { Collaborator } from "@/lib/mock-data"
import { useEditorShell, type EditorShellPanelControl } from "./EditorShell"
import { PresenceStack } from "./PresenceStack"
import { StatusText, type DocStatus } from "./status"

export interface AppBarAction {
  disabled?: boolean
  label: string
  onClick?: () => void
}

/**
 * T-01 应用栏：高 48，内边距 0 16，元素间距 12。
 * 返回 · 标题 · 撤销/重做（19 §D10：位置固定在标题右侧，评审/放映隐藏）· 保存/同步态 ·
 * 右侧固定区（Q14）：在场头像 · 分享 · 模式下拉（children）· 「⋯」更多菜单（Q20）· 账户头像。
 * 编辑器"返回"落到应用首页 `/home`；打开失败态回到文档列表的按钮由路由自己渲染（文案不在此处）。
 * 断点收起的侧栏（EditorShell 上下文）在这里放 PanelLeft / PanelRight 打开按钮；
 * compact（640–1024）隐藏同步文案、在场头像最多 2 个；narrow（< 640，仅查看）只留 返回 · 抽屉按钮 · 标题 · ⋯ · 头像。
 */
export function AppBar({
  onBack,
  backLabel = "返回首页",
  title,
  onRename,
  badges,
  undo,
  redo,
  status,
  collaborators,
  moreMenu = true,
  showAccount = true,
  className,
  children,
}: {
  onBack?: () => void
  backLabel?: string
  title: string
  onRename?: () => void
  badges?: ReactNode
  undo?: AppBarAction
  redo?: AppBarAction
  status?: DocStatus
  collaborators?: Collaborator[]
  /** 「⋯」更多菜单（导出 / 保真报告 / 版本历史 / 插件管理器 / 重命名 / 创建副本），默认显示 */
  moreMenu?: boolean
  /** 账户头像（UserMenu 头像形态），默认显示 */
  showAccount?: boolean
  className?: string
  children?: ReactNode
}) {
  const shell = useEditorShell()
  const breakpoint = shell?.breakpoint ?? "desktop"
  const compact = breakpoint === "compact"
  const narrow = breakpoint === "narrow"
  return (
    <header className={cn("flex h-12 shrink-0 items-center gap-3 px-4", className)}>
      {onBack && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={backLabel} onClick={onBack}>
              <ArrowLeft />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{backLabel}</TooltipContent>
        </Tooltip>
      )}

      {shell?.rail && <PanelToggle control={shell.rail} icon={<PanelLeft />} />}

      <div className="flex min-w-0 items-center gap-1.5">
        <h1 className="truncate text-sm font-semibold" title={title}>
          {title}
        </h1>
        {onRename && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label="重命名文档" onClick={onRename}>
                <SquarePen />
              </Button>
            </TooltipTrigger>
            <TooltipContent>重命名</TooltipContent>
          </Tooltip>
        )}
      </div>

      {badges}

      {!narrow && (undo || redo) && (
        <ButtonGroup>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label={undo?.label ?? "撤销"} disabled={undo?.disabled} onClick={undo?.onClick}>
                <Undo2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{undo?.label ?? "撤销"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label={redo?.label ?? "重做"} disabled={redo?.disabled} onClick={redo?.onClick}>
                <Redo2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{redo?.label ?? "重做"}</TooltipContent>
          </Tooltip>
        </ButtonGroup>
      )}

      {status && breakpoint === "desktop" && <span className="shrink-0 whitespace-nowrap"><StatusText status={status} /></span>}

      <div className="ml-auto flex items-center gap-3">
        {!narrow && collaborators && collaborators.length > 0 && (
          <>
            <PresenceStack people={collaborators} max={compact ? 2 : 3} />
            <Separator orientation="vertical" className="h-6" />
          </>
        )}
        {!narrow && children}
        {(moreMenu || showAccount) && (
          <div className="flex items-center gap-2">
            {moreMenu && <MoreMenu title={title} onRename={onRename} />}
            {showAccount && <UserMenu variant="avatar" />}
          </div>
        )}
        {shell?.inspector && (
          <>
            <Separator orientation="vertical" className="h-6" />
            <PanelToggle control={shell.inspector} icon={<PanelRight />} />
          </>
        )}
      </div>
    </header>
  )
}

/** 断点收起的侧栏打开按钮：与相邻 icon-sm 按钮同高，Sheet 本体由 EditorShell 渲染。 */
function PanelToggle({ control, icon }: { control: EditorShellPanelControl; icon: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`打开${control.label}`} aria-expanded={control.open} onClick={() => control.setOpen(true)}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{control.label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Q20「⋯」更多菜单：导出…（Mod+E）/ 保真报告 / 版本历史 / 插件管理器 / 重命名 / 创建副本。
 * 「开发者」项仅开发模式显示，playground 不展示。
 */
function MoreMenu({ title, onRename }: { title: string; onRename?: () => void }) {
  const navigate = useNavigate()
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="更多">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>更多</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={() => navigate("/export")}><Download /> 导出…<DropdownMenuShortcut>⌘E</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/editor/fidelity")}><FileCheck /> 保真报告</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/editor/history")}><History /> 版本历史</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/editor/plugins")}><Puzzle /> 插件管理器</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => (onRename ? onRename() : toast("重命名文档"))}><SquarePen /> 重命名</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toast(`已创建副本「${title.replace(/\.pptx$/i, "")} - 副本」`)}><Copy /> 创建副本</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
