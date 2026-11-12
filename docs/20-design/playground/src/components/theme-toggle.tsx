import { useSyncExternalStore } from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { getThemeMode, setThemeMode, subscribeTheme, type ThemeMode } from "@/lib/theme"

/** 主题分段（跟随系统 / 亮 / 暗）：多个实例共享同一 store，任一处切换全局同步。 */
export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribeTheme, getThemeMode)
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={mode}
      onValueChange={(v) => v && setThemeMode(v as ThemeMode)}
      aria-label="主题"
    >
      <ToggleGroupItem value="system" aria-label="跟随系统">
        <Monitor />
      </ToggleGroupItem>
      <ToggleGroupItem value="light" aria-label="亮色">
        <Sun />
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="暗色">
        <Moon />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
