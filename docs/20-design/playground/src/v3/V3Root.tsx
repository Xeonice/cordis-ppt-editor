import "./v3.css"
import { createContext, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { THEME_CSS } from "./editor/layouts/data"
import { useV3Params } from "./params"

/** 浮层（菜单等）挂到 v3 根节点内，才能继承作用域内的 token；null 表示根节点尚未挂载。 */
export const V3RootContext = createContext<HTMLElement | null>(null)

/** v3 根节点：读取 URL 的 theme / accent 并写成 data 属性，全部 token 只在它之内生效；内置主题的幻灯片配色（THEME_CSS）也挂在这里。 */
export function V3Root({ children, className }: { children: ReactNode; className?: string }) {
  const { theme, accent } = useV3Params()
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  return (
    <V3RootContext.Provider value={el}>
      <div ref={setEl} data-v3-theme={theme} data-v3-accent={accent} className={cn("v3-root", className)}>
        {/* 文档主题的预览配色（内置 5 套主题 + 主题编辑中的实时预览，editor/layouts/data.ts THEME_CSS）：编辑器与首页的模板封面共用一份 */}
        <style>{THEME_CSS}</style>
        {children}
      </div>
    </V3RootContext.Provider>
  )
}
