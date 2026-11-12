import { useRef } from "react"
import { Search, X } from "lucide-react"
import { ICON, IconButton } from "../../kit"
import { useAdmin } from "./store"

/**
 * 顶栏右侧的搜索框（03-32 §3：宽 288、「按名称或 id 搜索」，即时过滤全部分组）：外框与首页左栏搜索同一组 token（--v3-search-*：透明底 + 细边、悬停铺 panel-2、聚焦换强调色，DS-35），
 * 有内容时尾部一个「清除搜索」（24；点了焦点回到输入框，不随按钮卸载掉到 body），Esc 先清空。深链里部署没有声明的插件 id 也填在这里（TB-76）。
 */
export function AdminSearch() {
  const api = useAdmin()
  const input = useRef<HTMLInputElement>(null)
  return (
    <label className="flex h-7 w-72 items-center gap-2 rounded-[6px] bg-(--v3-search-fill) px-2 text-(--v3-text-2) ring-1 ring-(--v3-search-line) transition-colors ring-inset focus-within:ring-(--v3-accent) hover:bg-(--v3-search-fill-hover)">
      <Search {...ICON} aria-hidden="true" className="shrink-0" />
      <input
        ref={input}
        value={api.query}
        onChange={(e) => api.setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && api.query) {
            e.preventDefault()
            api.setQuery("")
          }
        }}
        placeholder="按名称或 id 搜索"
        aria-label="按名称或 id 搜索插件"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-[12px] leading-none text-(--v3-text) outline-none placeholder:text-(--v3-text-3)"
      />
      {api.query && (
        <IconButton
          label="清除搜索"
          size={24}
          className="-mr-1.5"
          onClick={() => {
            input.current?.focus()
            api.setQuery("")
          }}
        >
          <X {...ICON} />
        </IconButton>
      )}
    </label>
  )
}
