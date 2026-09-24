import { useNavigate } from "react-router-dom"
import { ChevronsUpDown, Keyboard, LifeBuoy, LogOut, Settings2 } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/** 演示用户：与 mock-data 的协作者 wang 同一人（示例域名邮箱）。 */
const user = { name: "王小明", email: "wang@example.com", initial: "王" }

export type UserMenuVariant = "row" | "avatar"

/**
 * 当前用户菜单：设置 / 键盘快捷键 / 帮助中心 / 退出登录。
 * 现实用法：首页侧栏底部用 `row`；文档列表顶栏与编辑器族应用栏右端（AppBar `showAccount`）用 `avatar`。
 * - `row`：整行触发器（头像 32 + 姓名/邮箱 + 上下箭头），shadcn Sidebar 的 NavUser 范式。
 * - `avatar`：仅 28px 头像（与 icon-sm 按钮同高），无姓名行。
 * 「设置」以此为唯一入口；「键盘快捷键」是三个入口之一（另两个：Ribbon 页签行右侧「?」、Mod+/），
 * 直接打开快捷键面板（`/settings?panel=shortcuts`）而不是设置抽屉。
 * 头像不带在场环（在场环只用于协作者头像组）。
 */
export function UserMenu({ variant = "avatar", className }: { variant?: UserMenuVariant; className?: string }) {
  const navigate = useNavigate()
  const trigger =
    variant === "row" ? (
      <button
        type="button"
        aria-label={`${user.name} 的账户菜单`}
        className={cn("flex h-12 w-full items-center gap-2.5 rounded-xl px-2 text-left outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-foreground/5", className)}
      >
        <Avatar><AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">{user.initial}</AvatarFallback></Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    ) : (
      <button
        type="button"
        aria-label={`${user.name} 的账户菜单`}
        className={cn("flex size-7 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:ring-2 data-[state=open]:ring-ring/50", className)}
      >
        <Avatar className="size-7"><AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">{user.initial}</AvatarFallback></Avatar>
      </button>
    )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "row" ? "start" : "end"} side={variant === "row" ? "top" : "bottom"} className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2.5 py-2 font-normal">
          <Avatar><AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">{user.initial}</AvatarFallback></Avatar>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{user.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/settings")}><Settings2 /> 设置<DropdownMenuShortcut>⌘,</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/settings?panel=shortcuts")}><Keyboard /> 键盘快捷键<DropdownMenuShortcut>⌘/</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toast("帮助中心（外部链接）")}><LifeBuoy /> 帮助中心</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => toast("已退出登录（演示）")}><LogOut /> 退出登录</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
