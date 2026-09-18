import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Info, LayoutTemplate, RotateCcw, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AppBar, CanvasElementBox, DesignBar, EditorShell, Inspector, InheritedPlaceholderOutline,
  MasterRibbon, NumberField, PropertyRow, PropertyRowPair, SelectionBox, SlideCanvas, StatusBar, StatusText,
  ThumbnailRail,
} from "@/components/editor"
import type { MasterSelection } from "@/components/editor/ThumbnailRail"
import type { LayoutDeleteTarget, MasterRibbonTabValue } from "@/components/editor/Ribbon"
import { collaborators, documentTitle, masters } from "@/lib/mock-data"

/**
 * 03-screens/26 母版视图。裁决 2026-09-18 §4.10：Q11 删除被引用版式走确认（MasterTab）；Q16 保留范围条双态单选、
 * 应用栏「改动将影响 N 页」徽标、加载骨架 / 失败态；Q16-e 缩略图窗格版式多选，画布侧显示「已选中 N 个版式」占位。
 */
type DemoState = "layout" | "master" | "placeholder" | "readonly" | "loading" | "error"

const stateOptions = [
  { value: "layout", label: "编辑版式（默认）" },
  { value: "master", label: "编辑母版" },
  { value: "placeholder", label: "占位符属性 · 覆盖态" },
  { value: "readonly", label: "只读（评审/无权限）" },
  { value: "loading", label: "加载骨架" },
  { value: "error", label: "母版加载失败" },
]

export function EditorMasters() {
  const navigate = useNavigate()
  // 再按 Mod+Alt+M 退出母版视图（T5 四种退出方式之一；Esc 交给画布选区处理，不在此绑定）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.altKey || e.code !== "KeyM") return
      e.preventDefault()
      navigate("/editor")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [navigate])
  const [demoState, setDemoState] = useState<DemoState>("layout")
  const [role, setRole] = useState("owner")
  const [selection, setSelection] = useState<MasterSelection>({ masterId: "m-corp", layoutId: "l-tc" })
  const [scope, setScope] = useState<"layout" | "master">("layout")
  const [ribbonTab, setRibbonTab] = useState<MasterRibbonTabValue>("master")

  const readOnly = demoState === "readonly" || role === "commenter" || role === "viewer"
  const master = masters.find((m) => m.id === selection.masterId) ?? masters[0]!
  const layout = master.layouts.find((l) => l.id === selection.layoutId)
  // Q16-e：多选时 selectedLayouts.length > 1；单选为 [layout]；选中母版时为空
  const selectedLayouts = selection.layoutIds
    ? master.layouts.filter((l) => selection.layoutIds!.includes(l.id))
    : layout ? [layout] : []
  const multi = selectedLayouts.length > 1
  const effectiveScope = layout ? (demoState === "master" ? "master" : scope) : "master"
  const impactedPages = multi
    ? selectedLayouts.reduce((s, l) => s + l.pageCount, 0)
    : layout?.pageCount ?? master.layouts.reduce((s, l) => s + l.pageCount, 0)
  // Q11：删除目标 = 当前选中的版式（引用数取 mock 数据的 pageCount）；选中母版时无目标，按钮禁用
  const deleteTarget: LayoutDeleteTarget | undefined =
    selectedLayouts.length === 0 || readOnly
      ? undefined
      : { count: selectedLayouts.length, refCount: selectedLayouts.reduce((s, l) => s + l.pageCount, 0), name: layout?.name }

  function handleSelect(sel: MasterSelection) {
    setSelection(sel)
    if (!sel.layoutId) setScope("master")
  }

  const appBar = (
    <AppBar
      title={documentTitle}
      badges={<Badge variant="outline" className="border-info/40 bg-info-muted text-info-foreground">母版视图</Badge>}
      collaborators={collaborators.filter((c) => !c.isSelf)}
    >
      <Badge variant="outline" className="gap-1 border-info/40 bg-info-muted px-2 text-info-foreground">
        <Info className="size-3" /> 改动将影响 {impactedPages} 个使用{multi ? "所选版式" : "此版式"}的页面
      </Badge>
    </AppBar>
  )

  if (demoState === "error") {
    return (
      <div className="flex h-dvh flex-col bg-canvas">
        <DesignBar title="母版视图" spec="03-screens/26" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} role={role} onRoleChange={setRole} />
        <div className="glass-strong mx-2 mt-2 rounded-2xl">{appBar}</div>
        <Empty className="flex-1">
          <EmptyMedia variant="icon"><TriangleAlert className="text-destructive" /></EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>母版信息加载失败</EmptyTitle>
            <EmptyDescription>可重试，或退回普通视图继续编辑</EmptyDescription>
          </EmptyHeader>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/editor")}>退回普通视图</Button>
            <Button onClick={() => setDemoState("layout")}>重试</Button>
          </div>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar title="母版视图" spec="03-screens/26" state={demoState} onStateChange={(v) => setDemoState(v as DemoState)} stateOptions={stateOptions} role={role} onRoleChange={setRole} />
      <EditorShell
        appBar={appBar}
        ribbon={
          <MasterRibbon
            value={ribbonTab}
            onValueChange={setRibbonTab}
            scopeLabel={layout?.name ?? master.name}
            onClose={() => navigate("/editor")}
            currentMasterId={selection.masterId}
            currentLayoutId={selection.layoutId ?? master.layouts[0]?.id ?? ""}
            onOpenShortcuts={() => navigate("/settings?panel=shortcuts")}
            deleteTarget={deleteTarget}
            onDeleteLayouts={() => handleSelect({ masterId: selection.masterId })}
          />
        }
        thumbnailRail={
          <ThumbnailRail
            mode="master"
            slides={[]}
            masterSelection={selection}
            onSelectMasterNode={handleSelect}
            loading={demoState === "loading"}
          />
        }
        canvas={
          demoState === "loading" ? (
            <div className="flex flex-1 items-center justify-center bg-canvas"><Skeleton className="aspect-video w-2/3" /></div>
          ) : multi ? (
            <Empty className="flex-1">
              <EmptyMedia variant="icon"><LayoutTemplate /></EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>已选中 {selectedLayouts.length} 个版式</EmptyTitle>
                <EmptyDescription>
                  {selectedLayouts.map((l) => l.name).join("、")} · 共被 {impactedPages} 页使用。可在「母版」页签批量删除；单击任一版式恢复单选。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="glass mx-2 mt-2 flex h-9 shrink-0 items-center gap-3 rounded-2xl px-4 text-xs">
                <div className="flex shrink-0 items-center gap-3 whitespace-nowrap">
                  <span className="text-muted-foreground">正在编辑：</span>
                  <RadioGroup value={effectiveScope} onValueChange={(v) => setScope(v as "layout" | "master")} className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="layout" id="scope-layout" disabled={!layout} />
                      <Label htmlFor="scope-layout" className="text-xs font-normal">版式</Label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="master" id="scope-master" />
                      <Label htmlFor="scope-master" className="text-xs font-normal">母版</Label>
                    </div>
                  </RadioGroup>
                </div>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {effectiveScope === "layout" ? layout?.name : master.name}
                  {layout && effectiveScope === "layout" && <span className="text-muted-foreground"> · 继承自「{master.name}」</span>}
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-3 whitespace-nowrap text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><span className="h-px w-3 bg-foreground" />此版式定义</span>
                  <span className="inline-flex items-center gap-1"><span className="h-px w-3 border-t border-dashed border-muted-foreground" />继承自母版</span>
                </span>
              </div>
              <SlideCanvas hideZoomBar={false}>
                <MasterCanvasScene scope={effectiveScope} demoState={demoState} onSelectPlaceholder={() => setDemoState("placeholder")} />
              </SlideCanvas>
            </div>
          )
        }
        inspector={
          <Inspector
            value="properties"
            onValueChange={() => {}}
            readOnly={readOnly}
            readOnlyReason="只读 · 评审模式下不可编辑"
            disabledTabs={["comments"]}
            disabledReason="母版与版式不支持评论（与 PowerPoint 母版视图一致）"
            tabs={[
              { value: "properties", label: "属性", content: demoState === "placeholder" ? <PlaceholderPropertiesPanel /> : <MasterPropertiesEmptyHint /> },
              { value: "comments", label: "评论", content: null },
              { value: "history", label: "历史", content: null },
              { value: "plugins", label: "插件", content: null },
            ]}
          />
        }
        statusBar={
          <StatusBar
            left={[
              multi
                ? `已选中 ${selectedLayouts.length} 个版式 · ${master.name}`
                : `编辑${effectiveScope === "layout" ? "版式" : "母版"} · ${effectiveScope === "layout" ? layout?.name : master.name}`,
              readOnly ? undefined : impactedPages > 0 ? `未保存改动 · 影响 ${impactedPages} 页` : "未保存改动",
            ].filter(Boolean) as string[]}
            right={[
              <StatusText key="sync" status={{ kind: "sync", state: "synced" }} variant="dot" />,
              <Tooltip key="info"><TooltipTrigger asChild><button type="button" className="inline-flex items-center gap-1 hover:text-foreground"><Info className="size-3.5" /> 关于母版继承</button></TooltipTrigger><TooltipContent className="max-w-64">虚线表示该占位符继承自母版；在"版式"范围内只读查看，切到"母版"范围可编辑。</TooltipContent></Tooltip>,
            ]}
          />
        }
      />
    </div>
  )
}

function MasterCanvasScene({
  scope,
  demoState,
  onSelectPlaceholder,
}: {
  scope: "layout" | "master"
  demoState: DemoState
  onSelectPlaceholder: () => void
}) {
  return (
    <>
      <CanvasElementBox
        box={{ x: 100, y: 60, w: 760, h: 70 }}
        onClick={onSelectPlaceholder}
        className="flex cursor-pointer items-center rounded-sm border border-dashed border-doc-ink/20 bg-doc-ink/[0.02] px-2 text-2xl font-semibold text-doc-ink/60 italic transition-colors hover:border-primary/50 hover:bg-primary/5"
      >
        {scope === "master" ? "母版标题样式" : "[单击此处编辑母版标题样式]"}
      </CanvasElementBox>
      {demoState === "placeholder" && <SelectionBox box={{ x: 100, y: 60, w: 760, h: 70 }} label="标题占位符" showRotate={false} />}

      <CanvasElementBox box={{ x: 130, y: 150, w: 700, h: 40 }} className="flex items-center rounded-sm border border-dashed border-doc-ink/20 px-2 text-[22px] text-doc-ink">第一级大纲文本样式</CanvasElementBox>
      <CanvasElementBox box={{ x: 160, y: 196, w: 670, h: 34 }} className="flex items-center rounded-sm border border-dashed border-doc-ink/20 px-2 text-[18px] text-doc-ink/85">第二级大纲文本样式</CanvasElementBox>
      <CanvasElementBox box={{ x: 190, y: 236, w: 640, h: 30 }} className="flex items-center rounded-sm border border-dashed border-doc-ink/20 px-2 text-[15px] text-doc-ink/70">第三级大纲文本样式</CanvasElementBox>

      {scope === "layout" ? (
        <>
          <InheritedPlaceholderOutline box={{ x: 100, y: 460, w: 300, h: 30 }} label="页脚占位符" />
          <CanvasElementBox box={{ x: 100, y: 460, w: 300, h: 30 }} className="flex items-center px-2 text-xs text-doc-ink/50">页脚占位符 · 母版</CanvasElementBox>
          <InheritedPlaceholderOutline box={{ x: 420, y: 460, w: 180, h: 30 }} label="日期/时间" />
          <CanvasElementBox box={{ x: 420, y: 460, w: 180, h: 30 }} className="flex items-center justify-center text-xs text-doc-ink/50">‹日期/时间›</CanvasElementBox>
          <InheritedPlaceholderOutline box={{ x: 720, y: 460, w: 80, h: 30 }} label="页码" />
          <CanvasElementBox box={{ x: 720, y: 460, w: 80, h: 30 }} className="flex items-center justify-center text-xs text-doc-ink/50">‹#›</CanvasElementBox>
        </>
      ) : (
        <>
          <CanvasElementBox box={{ x: 100, y: 460, w: 300, h: 30 }} className="flex items-center border border-dashed border-doc-ink/20 px-2 text-xs text-doc-ink/60">页脚占位符</CanvasElementBox>
          <CanvasElementBox box={{ x: 420, y: 460, w: 180, h: 30 }} className="flex items-center justify-center border border-dashed border-doc-ink/20 text-xs text-doc-ink/60">‹日期/时间›</CanvasElementBox>
          <CanvasElementBox box={{ x: 720, y: 460, w: 80, h: 30 }} className="flex items-center justify-center border border-dashed border-doc-ink/20 text-xs text-doc-ink/60">‹#›</CanvasElementBox>
        </>
      )}
    </>
  )
}

function MasterPropertiesEmptyHint() {
  return (
    <Empty>
      <EmptyMedia variant="icon"><LayoutTemplate /></EmptyMedia>
      <EmptyHeader>
        <EmptyTitle className="text-sm">未选中占位符</EmptyTitle>
        <EmptyDescription>在画布中单击标题或占位符以查看其属性</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function PlaceholderPropertiesPanel() {
  return (
    <Accordion type="multiple" defaultValue={["type", "text"]} className="inspector-groups m-3 mt-2">
      <AccordionItem value="type">
        <AccordionTrigger className="text-xs font-semibold">占位符类型</AccordionTrigger>
        <AccordionContent>
          <p className="text-[11px] text-muted-foreground">标题占位符</p>
          <p className="font-mono text-xs">type=title, idx=0</p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="position">
        <AccordionTrigger className="text-xs font-semibold">位置与大小</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-1.5">
          <PropertyRowPair a={{ label: "X", children: <NumberField value="100" suffix="pt" /> }} b={{ label: "Y", children: <NumberField value="60" suffix="pt" /> }} />
          <PropertyRowPair a={{ label: "宽", children: <NumberField value="760" suffix="pt" /> }} b={{ label: "高", children: <NumberField value="70" suffix="pt" /> }} />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="text">
        <AccordionTrigger className="text-xs font-semibold">文本样式（大纲级别）</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-2">
          <PropertyRow label="级别">
            <Select defaultValue="1">
              <SelectTrigger size="sm" className="h-7 flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 3].map((n) => <SelectItem key={n} value={String(n)}>级别 {n}</SelectItem>)}</SelectContent>
            </Select>
          </PropertyRow>
          <PropertyRowPair a={{ label: "字号", children: <NumberField value="36" /> }} b={{ label: "字重", children: <NumberField value="600" /> }} />
          <div className="flex items-center justify-between gap-2 pt-1">
            <Badge variant="outline" className="text-primary">已在此版式覆盖</Badge>
            <Button variant="ghost" size="xs" onClick={() => toast("已重置为母版值", { action: { label: "撤销", onClick: () => toast.success("已撤销") } })}>
              <RotateCcw /> 重置为母版值
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="fill">
        <AccordionTrigger className="text-xs font-semibold">填充</AccordionTrigger>
        <AccordionContent className="text-xs text-muted-foreground">无（继承母版）</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
