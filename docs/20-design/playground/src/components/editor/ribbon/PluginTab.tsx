import { Blocks, Database, RefreshCw, Workflow } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { RibbonBigButton, RibbonGroup } from "./primitives"

/**
 * 06-extensibility-ux §2.1：插件贡献的 Ribbon 页签排在内置页签之后，页签本身与分组
 * 都带归属标识，不与内置分组混排。这里演示"数据图表增强"插件贡献的页签内容。
 */
export function PluginTab() {
  return (
    <>
      <RibbonGroup
        label={<span className="inline-flex items-center gap-1"><Blocks className="size-3" />数据图表增强 · ACME</span>}
        ariaLabel="数据图表增强（第三方插件：ACME）"
      >
        <RibbonBigButton icon={Database} label="数据绑定" onClick={() => toast("已打开数据绑定面板（插件：ACME）")} />
        <RibbonBigButton icon={RefreshCw} label="刷新联动" onClick={() => toast("已刷新图表联动数据")} />
      </RibbonGroup>
      <RibbonGroup label={<span className="inline-flex items-center gap-1"><Blocks className="size-3" />流程图形状包 · ACME</span>} ariaLabel="流程图形状包（第三方插件：ACME）">
        <RibbonBigButton icon={Workflow} label="流程图" onClick={() => toast("已插入流程图节点")} />
      </RibbonGroup>
      <Badge variant="outline" className="ml-2 shrink-0 self-center text-muted-foreground">由插件贡献 · 非内置功能</Badge>
    </>
  )
}
