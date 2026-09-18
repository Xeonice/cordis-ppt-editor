import { useState, type ReactNode } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Lock, Monitor, Moon, Search, Sun, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DesignBar } from "@/components/editor"

type DemoState = "settings" | "settings-locked" | "shortcuts" | "shortcuts-search"

/** 演示态切换在 DesignBar 里（设置 / 快捷键两块抽屉都从这里切，不再在页头放像顶栏设置按钮的入口）。 */
const stateOptions = [
  { value: "settings", label: "设置面板" },
  { value: "settings-locked", label: "设置：集成方锁定态" },
  { value: "shortcuts", label: "快捷键面板" },
  { value: "shortcuts-search", label: "快捷键：搜索过滤" },
]

/**
 * 路由参数 `?panel=shortcuts` 直接打开快捷键抽屉——账户菜单「键盘快捷键」、Ribbon 页签行「?」、
 * 首页指南卡、Mod+/ 三个入口都落到这里；缺省或 `?panel=settings` 打开设置抽屉。
 */
function panelToState(panel: string | null): DemoState {
  return panel === "shortcuts" ? "shortcuts" : "settings"
}

/** 组合键按空格拆成 Kbd；单独的 "/" 表示"或"，渲染为分隔文字（这样 ⌘/ 本身可作为一个键显示）。 */
const shortcutGroups = [
  { name: "全局", items: [["命令面板", "⌘⇧P"], ["撤销/重做", "⌘Z / ⌘Y"], ["保存", "⌘S"], ["设置", "⌘,"], ["键盘快捷键", "⌘/"]] },
  { name: "画布", items: [["全选", "⌘A"], ["组合/取消组合", "⌘G / ⌘⇧G"], ["复制对象", "⌘D"], ["缩小", "⌘-", "conflict"]] },
  { name: "文本编辑", items: [["粗/斜/下划线", "⌘B / ⌘I / ⌘U"]] },
  { name: "缩略图栏", items: [["新建幻灯片", "⌘M"], ["页面重排", "⌘⇧↑ / ⌘⇧↓"]] },
  { name: "视图", items: [["进入/退出母版视图", "⌘⌥M"]] },
  { name: "放映", items: [["下一页/上一页", "→ ← Space"]] },
]

export function Settings() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const panel = searchParams.get("panel")
  // DesignBar 的手动切换只在当前 panel 参数下有效；参数一变（例如从账户菜单再次进入）以参数为准
  const [demoOverride, setDemoOverride] = useState<{ panel: string | null; state: DemoState } | null>(null)
  const demoState: DemoState = demoOverride && demoOverride.panel === panel ? demoOverride.state : panelToState(panel)
  const setDemoState = (state: DemoState) => setDemoOverride({ panel, state })
  const [density, setDensity] = useState("comfortable")
  const [query, setQuery] = useState(demoState === "shortcuts-search" ? "缩" : "")

  const settingsOpen = demoState === "settings" || demoState === "settings-locked"
  const shortcutsOpen = demoState === "shortcuts" || demoState === "shortcuts-search"
  const locked = demoState === "settings-locked"

  /** 关闭抽屉 = 回到打开它的页面（浏览器返回）；直接打开本路由时回首页。 */
  function closeDrawer() {
    if (window.history.length > 1) navigate(-1)
    else navigate("/home")
  }
  const filteredGroups = shortcutGroups
    .map((g) => ({ ...g, items: g.items.filter((it) => !query || it[0]!.includes(query)) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <DesignBar title="设置与快捷键" spec="03-screens/23、24" state={demoState} onStateChange={(v) => { setDemoState(v as DemoState); setQuery(v === "shortcuts-search" ? "缩" : "") }} stateOptions={stateOptions} />
      <header className="glass-strong m-2 flex h-12 shrink-0 items-center gap-2 rounded-2xl px-4">
        <Button variant="ghost" size="sm" onClick={closeDrawer}>返回</Button>
        <span className="text-xs text-muted-foreground">抽屉浮在打开它的页面之上；此处为占位背景</span>
      </header>
      <div className="flex-1 bg-canvas" />

      <Sheet open={settingsOpen} onOpenChange={(v) => !v && closeDrawer()}>
        <SheetContent side="right" className="w-80 gap-0 p-0">
          <SheetHeader className="border-b border-foreground/5 px-4 py-3"><SheetTitle>设置</SheetTitle><p className="text-xs text-muted-foreground">个人偏好，不影响协作者；关闭即保存</p></SheetHeader>
          <ScrollArea className="flex-1">
            <div className="oce-well m-3 flex flex-col gap-5 p-3">
              <SettingsSection title="外观">
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="set-theme" className="flex-1 text-sm font-normal">主题</FieldLabel>
                  {locked ? <LockedValue value="亮色" /> : (
                    <ToggleGroup type="single" size="sm" variant="outline" defaultValue="system" aria-label="主题">
                      <ToggleGroupItem value="system" aria-label="跟随系统"><Monitor /></ToggleGroupItem>
                      <ToggleGroupItem value="light" aria-label="亮色"><Sun /></ToggleGroupItem>
                      <ToggleGroupItem value="dark" aria-label="暗色"><Moon /></ToggleGroupItem>
                    </ToggleGroup>
                  )}
                </Field>
                <div className="flex items-center justify-between">
                  <span className="text-sm">密度</span>
                  <ToggleGroup type="single" size="sm" variant="outline" value={density} onValueChange={(v) => v && setDensity(v)} aria-label="密度">
                    <ToggleGroupItem value="comfortable">舒适</ToggleGroupItem>
                    <ToggleGroupItem value="compact">紧凑</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </SettingsSection>
              <SettingsSection title="语言">
                <Select defaultValue="zh-CN">
                  <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="zh-CN">简体中文</SelectItem><SelectItem value="en-US">English</SelectItem></SelectContent>
                </Select>
              </SettingsSection>
              <SettingsSection title="度量单位">
                <Select defaultValue="cm">
                  <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="cm">厘米 (cm)</SelectItem><SelectItem value="in">英寸 (in)</SelectItem><SelectItem value="pt">磅 (pt)</SelectItem><SelectItem value="px">像素 (px)</SelectItem></SelectContent>
                </Select>
              </SettingsSection>
              <SettingsSection title="编辑">
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="set-autosave" className="flex-1 text-sm font-normal">自动保存间隔</FieldLabel>
                  <Select defaultValue="30">
                    <SelectTrigger id="set-autosave" size="sm" className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="15">15 秒</SelectItem><SelectItem value="30">30 秒</SelectItem><SelectItem value="60">60 秒</SelectItem></SelectContent>
                  </Select>
                </Field>
                <label className="flex items-center gap-2 text-sm"><Checkbox defaultChecked /> 智能参考线默认开启</label>
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="set-paste" className="flex-1 text-sm font-normal">粘贴默认</FieldLabel>
                  <Select defaultValue="keep">
                    <SelectTrigger id="set-paste" size="sm" className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="keep">保留源格式</SelectItem><SelectItem value="text">仅文本</SelectItem></SelectContent>
                  </Select>
                </Field>
              </SettingsSection>
              <SettingsSection title="通知">
                <label className="flex items-center gap-2 text-sm"><Checkbox /> 协作者加入时提示</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox defaultChecked /> 评论 @ 我时提示</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox defaultChecked /> 导入完成后高亮详情</label>
              </SettingsSection>
              <SettingsSection title="关于">
                <p className="text-xs text-muted-foreground">版本 0.1.0-m2</p>
                <Button variant="outline" size="sm" className="w-fit" onClick={() => { navigator.clipboard?.writeText("oce-diag-0.1.0-m2"); toast("已复制诊断信息") }}>复制诊断信息</Button>
                <Button variant="link" size="sm" className="h-auto w-fit p-0" onClick={() => navigate("/editor/plugins")}>已加载插件：5 个 → 管理</Button>
              </SettingsSection>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Sheet open={shortcutsOpen} onOpenChange={(v) => !v && closeDrawer()}>
        <SheetContent side="right" className="w-80 gap-0 p-0">
          <SheetHeader className="border-b border-foreground/5 px-4 py-3">
            <SheetTitle>快捷键</SheetTitle>
            <InputGroup className="mt-1">
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupInput placeholder="搜索快捷键..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="搜索快捷键" />
            </InputGroup>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <div className="oce-well m-3 flex flex-col gap-4 p-3">
              {filteredGroups.map((g) => (
                <div key={g.name}>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{g.name}</p>
                  <div className="flex flex-col gap-1.5">
                    {g.items.map(([label, combo, flag]) => (
                      <div key={label} className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1.5">{flag && <TriangleAlert className="size-3.5 text-warning-foreground" />}{label}</span>
                          <KbdGroup>
                            {combo!.split(/\s+/).map((k, i) =>
                              k === "/" ? <span key={i} className="px-0.5 text-xs text-muted-foreground/60">/</span> : <Kbd key={i}>{k}</Kbd>
                            )}
                          </KbdGroup>
                        </div>
                        {flag && (
                          <p className="pl-5 text-xs text-warning-foreground">与「插件A：聚焦搜索」冲突，<Button variant="link" size="xs" className="h-auto p-0 text-xs" onClick={() => navigate("/editor/plugins")}>查看插件管理器</Button></p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">插件（来自 ACME）</p>
                <div className="flex items-center justify-between text-sm">
                  <span>插入流程图节点</span>
                  <KbdGroup><Kbd>⌘</Kbd><Kbd>⇧</Kbd><Kbd>F</Kbd></KbdGroup>
                </div>
              </div>
              {filteredGroups.length === 0 && <p className="text-center text-xs text-muted-foreground">没有匹配的快捷键</p>}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}

/** iOS 分组内嵌列表：标题 12px 半粗淡色置于组外，组内容用浅色底圆角容器包裹，组间靠留白分区不靠分割线。 */
function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="px-1 text-xs font-semibold text-muted-foreground">{title}</h3>
      <div className="oce-group flex flex-col gap-2.5 p-3">{children}</div>
    </div>
  )
}

function LockedValue({ value }: { value: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Lock className="size-3" /> {value}（由宿主应用设置）
    </span>
  )
}
