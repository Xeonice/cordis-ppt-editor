import { Link } from "react-router-dom"
import { ArrowRight, LayoutTemplate } from "lucide-react"
import { Brand } from "@/components/brand"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import { routes, type RouteStatus } from "@/routes/registry"

const statusLabel: Record<RouteStatus, string> = {
  ready: "已完成",
  wip: "进行中",
  planned: "规划中",
}

/** 状态徽标：语义色 subtle 胶囊，避免整屏堆满实心 primary（09 §0 S-06：一屏实心 primary ≤3 处）。 */
const statusBadgeClass: Record<RouteStatus, string> = {
  ready: "border-transparent bg-success-muted text-success-foreground",
  wip: "border-transparent bg-warning-muted text-warning-foreground",
  planned: "text-muted-foreground",
}

export function Hub() {
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="p-3 sm:px-6 sm:pt-4">
        <header className="glass-strong flex h-14 items-center gap-3 rounded-2xl px-4 sm:px-6">
          <Brand to="/" subtitle="设计 playground" />
          <h1 className="sr-only">Cordex 幻灯片 · 设计 playground</h1>
          <Badge variant="secondary" className="hidden sm:inline-flex">radix-rhea · Lucide · Geist</Badge>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/styleguide">
                <LayoutTemplate /> 样式指南
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </header>
      </div>
      <main className="mx-auto max-w-6xl px-3 pb-8 sm:px-6">
        <p className="mb-6 max-w-[70ch] text-sm text-muted-foreground">
          每个界面都是用 shadcn/ui 组件实现的真实页面，而不是静态图。设计规范见
          <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">docs/20-design/09-design-specification.md</code>
          ，组件映射与主题 token 以本 playground 为准。
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {routes.map((r) => (
            <Card key={r.path} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">{r.title}</CardTitle>
                  <Badge variant="outline" className={`ml-auto ${statusBadgeClass[r.status]}`}>
                    {statusLabel[r.status]}
                  </Badge>
                </div>
                <CardDescription>{r.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">#{r.path}</span>
                <Button asChild variant="ghost" size="sm" disabled={r.status === "planned"}>
                  <Link to={r.path}>
                    打开 <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
