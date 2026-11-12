import { useState, type ComponentType } from "react"
import {
  Calendar, ChartColumn, CircleX, Film, Hash, Heading, Image as ImageIcon, ImageOff, LayoutList, LayoutTemplate, Layers,
  PaintBucket, Paintbrush, Palette, PanelBottom, Plus, SquareDashed, SquarePen, Table, Text, Trash2, Type, Workflow,
} from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ColorSwatch } from "../ColorPickerPopover"
import { ThemeEditorPanel } from "../ThemeEditorPanel"
import { RibbonBigButton, RibbonGroup, RibbonTextButton } from "./primitives"

/**
 * Q11 / Q16-e：「删除版式」的目标——当前选中的一个或多个版式及其被页面引用的总数。
 * 引用数 > 0 → AlertDialog 确认，确认后入撤销栈并给带 [撤销] 的 toast（rulings §4.20 FE-05，Q11 修订）；= 0 → 直接删除 + 可撤销 toast。
 */
export interface LayoutDeleteTarget {
  /** 待删除的版式数量（缩略图窗格 Shift/⌘ 多选时 > 1） */
  count: number
  /** 这些版式被页面引用的总数 */
  refCount: number
  /** 单选时的版式名，用于对话框标题与 toast 文案 */
  name?: string
}

/** Q16-f：占位符类型补齐为 OOXML 全部 11 类（id 取 p:ph@type），页脚三件套单独成组 */
const placeholderTypes: { id: string; label: string; icon: ComponentType<{ className?: string }>; footer?: boolean }[] = [
  { id: "obj", label: "内容", icon: LayoutList },
  { id: "title", label: "标题", icon: Heading },
  { id: "body", label: "正文", icon: Text },
  { id: "pic", label: "图片", icon: ImageIcon },
  { id: "chart", label: "图表", icon: ChartColumn },
  { id: "tbl", label: "表格", icon: Table },
  { id: "media", label: "媒体", icon: Film },
  { id: "dgm", label: "SmartArt", icon: Workflow },
  { id: "dt", label: "日期", icon: Calendar, footer: true },
  { id: "ftr", label: "页脚", icon: PanelBottom, footer: true },
  { id: "sldNum", label: "页码", icon: Hash, footer: true },
]

/**
 * T-02 母版页签：分组与 PowerPoint"幻灯片母版"页签对应（编辑母版 / 母版版式 / 主题 / 背景 / 关闭）。
 * 排布节奏与"开始"页签一致：每组 = 左侧大按钮（60px）+ 右侧一列两行小控件（28px），不行列混排；
 * 图标一律 Lucide 线性图标（不用彩色方块、红圈等脱离体系的图示）。
 * 裁决 2026-09-18 §4.10：Q11 删除被引用版式走确认对话框；Q16-f 占位符 11 类 + 同类超上限阻止插入。
 */
export function MasterTab({
  scopeLabel,
  onClose,
  deleteTarget,
  onDeleteLayouts,
}: {
  scopeLabel: string
  onClose: () => void
  /** 未选中版式（选中的是母版）时省略，「删除版式」按钮禁用 */
  deleteTarget?: LayoutDeleteTarget
  /** 删除确认后（或引用数为 0 直接删除时）回调，由路由更新选中态 */
  onDeleteLayouts?: () => void
}) {
  const [showTitle, setShowTitle] = useState(true)
  const [showFooters, setShowFooters] = useState(true)
  const [hideBackgroundGraphics, setHideBackgroundGraphics] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [editThemeOpen, setEditThemeOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(scopeLabel)

  const multi = (deleteTarget?.count ?? 0) > 1
  // 多选时带前导空格，拼出「删除 3 个版式」「已删除 3 个版式」；单选为「版式「X」」
  const deleteLabel = deleteTarget ? (multi ? ` ${deleteTarget.count} 个版式` : `版式「${deleteTarget.name ?? scopeLabel}」`) : ""

  function requestDelete() {
    if (!deleteTarget) return
    if (deleteTarget.refCount > 0) {
      setDeleteOpen(true)
      return
    }
    // Q11：引用数 = 0 → 直接删除 + 可撤销 toast
    onDeleteLayouts?.()
    toast(`已删除${deleteLabel}`, { action: { label: "撤销", onClick: () => toast.success("已撤销") } })
  }

  function confirmDelete() {
    if (!deleteTarget) return
    setDeleteOpen(false)
    onDeleteLayouts?.()
    // FE-05：确认 + 可撤销双层——执行后入撤销栈，toast 带 [撤销]（5 s），一步恢复各页引用与原 id 的版式
    toast(`已删除${deleteLabel}，${deleteTarget.refCount} 页已改用默认版式`, { action: { label: "撤销", onClick: () => toast.success("已撤销") } })
  }

  function insertPlaceholder(p: (typeof placeholderTypes)[number]) {
    // Q16-f：同类占位符超过版式上限时阻止插入并 toast；mock：当前版式已含一个标题占位符（每版式至多 1 个）
    if (p.id === "title") {
      toast.warning("该版式已包含标题占位符", { description: "每个版式最多 1 个标题占位符，未插入" })
      return
    }
    toast(`已插入${p.label}占位符`)
  }

  return (
    <>
      <RibbonGroup label="编辑母版">
        <RibbonBigButton icon={Layers} label="新建母版" onClick={() => toast("已新建母版")} />
        <RibbonBigButton icon={LayoutTemplate} label="插入版式" onClick={() => toast("已插入新版式")} />
        <div className="flex flex-col gap-1">
          <RibbonTextButton
            icon={Trash2}
            label={multi ? `删除${deleteLabel}` : "删除版式"}
            disabled={!deleteTarget}
            aria-label={deleteTarget ? `删除${deleteLabel}` : "删除版式（请先在缩略图窗格选中版式）"}
            onClick={requestDelete}
          />
          <Popover open={renameOpen} onOpenChange={setRenameOpen}>
            <PopoverTrigger asChild>
              <RibbonTextButton icon={SquarePen} label="重命名" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64">
              <Field>
                <FieldLabel htmlFor="master-rename">重命名「{scopeLabel}」</FieldLabel>
                <Input id="master-rename" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Button size="sm" className="mt-2 w-full" onClick={() => { setRenameOpen(false); toast(`已重命名为「${name}」`) }}>确定</Button>
            </PopoverContent>
          </Popover>
        </div>
      </RibbonGroup>

      <RibbonGroup label="母版版式">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <RibbonBigButton icon={SquareDashed} label="插入占位符" withCaret className="w-auto px-2" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {placeholderTypes.filter((p) => !p.footer).map((p) => {
              const Icon = p.icon
              return <DropdownMenuItem key={p.id} onSelect={() => insertPlaceholder(p)}><Icon /> {p.label}</DropdownMenuItem>
            })}
            <DropdownMenuSeparator />
            {placeholderTypes.filter((p) => p.footer).map((p) => {
              const Icon = p.icon
              return <DropdownMenuItem key={p.id} onSelect={() => insertPlaceholder(p)}><Icon /> {p.label}</DropdownMenuItem>
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex flex-col gap-1 text-xs">
          <label className="flex h-7 items-center gap-1.5 px-2">
            <Checkbox checked={showTitle} onCheckedChange={(v) => setShowTitle(!!v)} /> 标题
          </label>
          <label className="flex h-7 items-center gap-1.5 px-2">
            <Checkbox checked={showFooters} onCheckedChange={(v) => setShowFooters(!!v)} /> 页脚
          </label>
        </div>
      </RibbonGroup>

      <RibbonGroup label="主题">
        <RibbonBigButton icon={Palette} label="编辑主题" className="w-auto px-2" onClick={() => setEditThemeOpen(true)} />
        <div className="flex flex-col gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <RibbonTextButton icon={Paintbrush} label="颜色" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72"><ThemeEditorPanel defaultTab="color" /></PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <RibbonTextButton icon={Type} label="字体" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72"><ThemeEditorPanel defaultTab="font" /></PopoverContent>
          </Popover>
        </div>
      </RibbonGroup>

      <RibbonGroup label="背景">
        <Popover>
          <PopoverTrigger asChild>
            <RibbonBigButton icon={PaintBucket} label="背景样式" withCaret className="w-auto px-2" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56">
            <p className="mb-2 text-xs font-medium text-muted-foreground">背景样式</p>
            <div className="grid grid-cols-6 gap-1.5">
              {["#FFFFFF", "#F5F6F8", "#E8EAF2", "#1A2030", "#4A54E1", "#0E8A7A"].map((hex) => (
                <ColorSwatch key={hex} hex={hex} label={hex} onClick={() => toast(`背景已设为 ${hex}`)} />
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex flex-col gap-1 text-xs">
          <label className="flex h-7 items-center gap-1.5 px-2">
            <Checkbox checked={hideBackgroundGraphics} onCheckedChange={(v) => setHideBackgroundGraphics(!!v)} />
            <ImageOff className="size-3.5 text-muted-foreground" aria-hidden="true" /> 隐藏背景图形
          </label>
          <RibbonTextButton icon={Plus} label="背景格式…" onClick={() => toast("背景格式面板：见检查器")} />
        </div>
      </RibbonGroup>

      {/* PowerPoint "关闭"组：母版页签最右侧独立成组，是退出母版视图的主出口 */}
      <RibbonGroup label="关闭" className="ml-auto">
        <RibbonBigButton icon={CircleX} label="关闭母版视图" className="w-auto px-2.5 [&_svg]:text-destructive" onClick={onClose} />
      </RibbonGroup>

      <Dialog open={editThemeOpen} onOpenChange={setEditThemeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>编辑主题</DialogTitle></DialogHeader>
          <ThemeEditorPanel onApply={() => { setEditThemeOpen(false); toast("主题已应用", { description: "影响该主题下全部母版、版式与页面" }) }} onCancel={() => setEditThemeOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Q11（§4.20 FE-05 修订）：删除仍被页面引用的版式 —— 影响批量页面，先确认、确认后仍可撤销；按钮顺序 [删除][取消] 与裁决一致 */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>删除{deleteLabel}？</AlertDialogTitle>
            <AlertDialogDescription>
              {multi ? `所选 ${deleteTarget?.count} 个版式` : "该版式"}仍被 {deleteTarget?.refCount} 个页面使用，删除后这些页面将改用「与当前页相同」的默认版式
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>删除</AlertDialogAction>
            <AlertDialogCancel>取消</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
