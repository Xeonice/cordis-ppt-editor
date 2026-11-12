import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { presenceRing, roleLabel, type Collaborator } from "@/lib/mock-data"

/**
 * C-11 Avatar + PresenceRing：协作者头像堆叠，自己用 accent 环，他人用各自 presence 色环。
 * F-17：协作者色只出现在头像环/远端光标/远端选区，这里是唯一允许出现 presence 色的入口之一。
 */
export function PresenceStack({
  people,
  max = 3,
  size = "sm",
  className,
}: {
  people: Collaborator[]
  max?: number
  size?: "sm" | "default"
  className?: string
}) {
  const shown = people.slice(0, max)
  const overflow = people.length - shown.length
  return (
    <AvatarGroup className={className}>
      {shown.map((p) => (
        <Tooltip key={p.id}>
          <TooltipTrigger asChild>
            <Avatar
              size={size}
              className={cn(
                "ring-2 ring-offset-2 ring-offset-background",
                p.isSelf ? "ring-primary" : p.presence ? presenceRing[p.presence] : "ring-border"
              )}
            >
              <AvatarFallback className="bg-muted text-foreground">{p.initial}</AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>
            {p.name}
            {p.isSelf ? "（我）" : ` · ${roleLabel(p.role)}`}
          </TooltipContent>
        </Tooltip>
      ))}
      {overflow > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <AvatarGroupCount className={cn(size === "sm" && "size-6 text-xs")}>+{overflow}</AvatarGroupCount>
          </TooltipTrigger>
          <TooltipContent>
            {people.slice(max).map((p) => p.name).join("、")}
          </TooltipContent>
        </Tooltip>
      )}
    </AvatarGroup>
  )
}
