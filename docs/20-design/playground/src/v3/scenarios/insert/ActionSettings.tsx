import { useState, type ComponentType } from "react"
import { Ban, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, GalleryVerticalEnd, History, Info, Link2, SquareX } from "lucide-react"
import { CheckRow, Dialog, ICON, MenuField, RadioRow, Segmented, TextField } from "../../kit"
import { shapeById, ShapeThumb, type ActionTarget } from "./shapes"

const TARGETS: { v: ActionTarget; l: string; Icon: ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { v: "none", l: "无动作", Icon: Ban },
  { v: "next", l: "下一张幻灯片", Icon: ChevronRight },
  { v: "prev", l: "上一张幻灯片", Icon: ChevronLeft },
  { v: "first", l: "第一张幻灯片", Icon: ChevronsLeft },
  { v: "last", l: "最后一张幻灯片", Icon: ChevronsRight },
  { v: "lastViewed", l: "最近观看的幻灯片", Icon: History },
  { v: "end", l: "结束放映", Icon: SquareX },
  { v: "slide", l: "指定幻灯片…", Icon: GalleryVerticalEnd },
  { v: "url", l: "网址（URL）…", Icon: Link2 },
]

const SLIDES = ["1. 2026 年 Q2 业绩汇报", "2. 议程", "3. 关键指标", "4. 营收趋势", "5. 区域分布", "6. 下半年计划"]

/**
 * 动作按钮「操作设置」（03-15 G-79；R-d-77）：插入动作按钮后立即弹出，也可从检查器「操作」与右键「操作设置…」打开。
 * 宽 520；页签「单击鼠标 / 鼠标悬停（P2，禁用而不隐藏）」；9 个跳转目标两列单选（「无动作」独占一行）；
 * 选「指定幻灯片…」出现页选择、选「网址（URL）…」出现地址输入；「单击时突出显示」默认勾选；运行程序等不在此设置的说明常驻。
 * 插入与设置同一事务、一个撤销步；取消时按钮保留并带默认动作。
 */
export function ActionSettingsDialog({ shapeId = "actionButtonForwardNext", initial, returnFocus = "tool-shapes" }: { shapeId?: string; initial?: ActionTarget; returnFocus?: string }) {
  const shape = shapeById(shapeId)
  const [target, setTarget] = useState<ActionTarget>(initial ?? shape.defaultAction ?? "next")
  const isButton = shape.id.startsWith("actionButton")
  const name = shape.name.replace("动作按钮：", "")
  return (
    <Dialog
      title="操作设置"
      size="md"
      // 插入动作按钮的同一刻弹出：关闭后焦点回到插入它的工具条「形状」；从检查器「操作」打开时回到那一行
      returnFocus={returnFocus}
      description={
        <span className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-(--v3-accent-soft) text-(--v3-accent)">
            <ShapeThumb shape={shape} size={16} />
          </span>
          <span>
            {isButton ? "动作按钮" : "形状"}
            <span className="whitespace-nowrap">「{name}」</span>· 放映时生效，编辑时 ⌘ + 单击可预览
          </span>
        </span>
      }
      secondary={{ label: "取消" }}
      primary={{ label: "应用" }}
    >
      <div className="flex flex-col gap-3">
        <Segmented
          role="tablist"
          aria="触发方式"
          defaultValue="click"
          options={[
            { value: "click", label: "单击鼠标", text: "单击鼠标" },
            { value: "hover", label: "鼠标悬停", text: "鼠标悬停", disabled: true, tag: "P2", reason: "悬停触发的动作排在后续版本（P2）；导入文件里已有的悬停动作原样保留" },
          ]}
        />
        <div className="flex flex-col gap-1">
          <p className="text-[12px] leading-4 text-(--v3-text-2)">单击时</p>
          <div role="radiogroup" aria-label="单击时" className="grid grid-cols-2 gap-x-6">
            {TARGETS.map((t) => (
              <RadioRow
                key={t.v}
                checked={target === t.v}
                label={t.l}
                icon={<t.Icon {...ICON} />}
                onSelect={() => setTarget(t.v)}
                className={t.v === "none" ? "col-span-2 justify-self-start" : undefined}
              />
            ))}
          </div>
          {target === "slide" && (
            <div className="pl-6">
              <MenuField aria="目标幻灯片" items={SLIDES} defaultValue="3. 关键指标" />
            </div>
          )}
          {target === "url" && (
            <div className="pl-6">
              <TextField aria="网址" placeholder="https://example.com" />
            </div>
          )}
        </div>
        <CheckRow label="单击时突出显示" defaultChecked />
        <p className="flex items-start gap-2 text-[12px] leading-[18px] text-(--v3-text-2)">
          <span className="flex h-[18px] shrink-0 items-center">
            <Info {...ICON} aria-hidden="true" />
          </span>
          运行程序、运行宏、播放声音不在此设置；导入文件里已有的会原样保留。
        </p>
      </div>
    </Dialog>
  )
}
