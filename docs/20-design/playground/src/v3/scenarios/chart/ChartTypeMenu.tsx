import { useContext, useEffect, useRef, useState, type ReactNode, type Ref } from "react"
import { createPortal } from "react-dom"
import { ChevronRight, TriangleAlert } from "lucide-react"
import { DropdownMenu as DM } from "radix-ui"
import { cn } from "@/lib/utils"
import { anchorPlacement, ICON, MENU_CONTENT, MENU_ITEM, MENU_SEPARATOR, useAnchorElement, useMarkAnchorOpen, useTrackedRect, type Align, type Side } from "../../kit"
import { V3RootContext } from "../../V3Root"
import { ChartSvg } from "./ChartSvg"
import { FAMILIES, sampleData, type ChartKind, type ChartSpec, type ChartSubtype } from "./model"

/**
 * 图表类型菜单（03-31「图表 ▾ 菜单与子类型 flyout」；50/21 §3 ③）：六项（五类，柱形 / 条形分两项）+ 子类型缩略图 flyout，饼图只有一个子类型、点即选。
 * v3 里三处入口共用这一个组件，只换首行说明与锚点：工具条「图表」（插入）、空内容占位符图标条 › 图表（填入占位符）、检查器「类型」字段（更改类型，高亮当前子类型）。
 * 外观用 kit 的菜单 token（panel 实底、1px 边、浮层阴影、圆角 8；条目 28px）；子类型格 92 宽、72 × 48 纸色缩略图（幻灯片内容色，不随界面亮暗变化）。
 * 锚定打开（不经过原触发器）：给锚点元素加 data-v3-open（触发器按下态），场景状态里打开时不抢焦点。
 * 检查器里打开时菜单在检查器左侧，flyout 以画布列为碰撞边界、放不下就翻到左侧，不盖住检查器（flyoutBoundary="canvas"）。
 */

/** 当前子类型格、当前类别（饼图项）的高亮：强调色浅底 + 1px 强调色内描边（选中，Q3） */
const CURRENT = "bg-(--v3-accent-soft) ring-1 ring-(--v3-accent) ring-inset data-highlighted:bg-(--v3-accent-soft)"

/**
 * 挂载后第一帧之前为 false：Radix 子菜单在 effect 清理时会发一次「关闭」，开发模式 StrictMode 挂载时会走一遍清理，
 * 静态展开的 flyout 因此一出现就被关掉；用它忽略这段时间里的关闭（同 kit Menu 的 openPath）。
 */
function useArmed() {
  const armed = useRef(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      armed.current = true
    })
    return () => cancelAnimationFrame(id)
  }, [])
  return armed
}

export interface ChartTypeMenuProps {
  /** 锚点名：tool-chart / chart.ph-chart / chart.type-field */
  anchor: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 首行说明（12px text-2，不可选） */
  header: ReactNode
  /** 当前图表的类型（更改类型时传）：该类别图标着强调色，flyout 里当前子类型格高亮 */
  current?: ChartSpec
  /** 选中子类型；返回 false 时菜单保持打开（底部出确认段） */
  onPick: (st: ChartSubtype) => boolean | void
  /** 底部插槽（前面自动加分隔线）：类型切换需确认时放 TypeSwitchConfirm */
  footer?: ReactNode
  /** 静态展开的 flyout（演示态） */
  flyout?: ChartKind | null
  /** flyout 的碰撞边界：canvas = 画布列（检查器里打开时 flyout 翻到左侧） */
  flyoutBoundary?: "canvas"
  side?: Side
  align?: Align
  sideOffset?: number
  /** 关闭后焦点：unpicked 只在没选类型时回到触发按钮（插入后焦点交给数据网格）；always 选过也回（更改类型） */
  returnFocus?: "unpicked" | "always"
  label: string
}

export function ChartTypeMenu({ anchor, open, onOpenChange, header, current, onPick, footer, flyout = null, flyoutBoundary, side, align, sideOffset, returnFocus = "unpicked", label }: ChartTypeMenuProps) {
  const root = useContext(V3RootContext)
  const el = useAnchorElement(anchor)
  const rect = useTrackedRect(el)
  useMarkAnchorOpen(el, !!root && !!rect && open)
  const [fly, setFly] = useState<ChartKind | null>(flyout)
  const armed = useArmed()
  const picked = useRef(false)
  const outside = useRef(false)
  const boundary = flyoutBoundary === "canvas" ? (root?.querySelector<HTMLElement>('[data-v3-anchor="canvas"]') ?? undefined) : undefined
  if (!root || !el || !rect) return null
  const place = anchorPlacement(anchor, el)

  const pick = (e: Event, st: ChartSubtype) => {
    if (onPick(st) === false) e.preventDefault()
    else picked.current = true
  }

  return (
    <DM.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) setFly(null)
        onOpenChange(v)
      }}
      modal={false}
    >
      {createPortal(
        <DM.Trigger asChild>
          <span aria-hidden="true" tabIndex={-1} className="pointer-events-none fixed" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />
        </DM.Trigger>,
        root,
      )}
      <DM.Portal container={root}>
        <DM.Content
          side={side ?? place.side}
          align={align ?? place.align}
          sideOffset={sideOffset ?? place.sideOffset}
          collisionPadding={8}
          aria-label={label}
          onInteractOutside={(e) => {
            // 点的是触发按钮本身：交给按钮自己处理，不先关再开
            if (el.contains(e.target as Node)) e.preventDefault()
            else outside.current = true
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            const back = !outside.current && (returnFocus === "always" || !picked.current)
            picked.current = false
            outside.current = false
            if (back) el.focus()
          }}
          // 经 Portal 挂在根节点，React 事件仍沿组件树冒泡：从叠加层打开时点菜单里面不应触发画布的「点空白取消选中」
          onClick={(e) => e.stopPropagation()}
          className={cn(MENU_CONTENT, "w-[240px]")}
        >
          <div role="note" className="px-2 pt-1 pb-1.5 text-[12px] leading-4 text-(--v3-text-2)">
            {header}
          </div>
          {FAMILIES.map((f) => {
            const isCur = current?.kind === f.kind
            if (f.subtypes.length === 1) {
              const st = f.subtypes[0]!
              return (
                // 指针经过「饼图」时不手动收起 flyout：交给 Radix 的指针意图区判断（斜着移向 flyout 时途经饼图不该关掉它）
                <DM.Item key={f.kind} aria-current={isCur || undefined} onSelect={(e) => pick(e, st)} className={cn(MENU_ITEM, isCur && cn(CURRENT, "font-medium"))}>
                  <f.Icon {...ICON} aria-hidden="true" className={isCur ? "text-(--v3-accent)" : "text-(--v3-text-2)"} />
                  <span className="flex-1">{f.label}</span>
                </DM.Item>
              )
            }
            return (
              <DM.Sub
                key={f.kind}
                open={fly === f.kind}
                onOpenChange={(v) => {
                  if (v) return setFly(f.kind)
                  if (f.kind === flyout && !armed.current) return
                  setFly((cur) => (cur === f.kind ? null : cur))
                }}
              >
                <DM.SubTrigger aria-current={isCur || undefined} className={cn(MENU_ITEM, "data-[state=open]:bg-(--v3-panel-2)", isCur && "font-medium")}>
                  <f.Icon {...ICON} aria-hidden="true" className={isCur ? "text-(--v3-accent)" : "text-(--v3-text-2)"} />
                  <span className="flex-1">{f.label}</span>
                  <ChevronRight size={12} strokeWidth={1.5} aria-hidden="true" className="text-(--v3-text-2)" />
                </DM.SubTrigger>
                <DM.Portal container={root}>
                  <DM.SubContent sideOffset={6} alignOffset={-9} collisionPadding={8} collisionBoundary={boundary} className={cn(MENU_CONTENT, "p-2")}>
                    <p className="px-1 pb-1.5 text-[12px] leading-4 text-(--v3-text-2)">{f.label}</p>
                    <div className="flex gap-1">
                      {f.subtypes.map((st) => {
                        const on = isCur && current?.variant === st.variant
                        return (
                          <DM.Item
                            key={st.variant}
                            aria-current={on || undefined}
                            aria-label={st.name}
                            onSelect={(e) => pick(e, st)}
                            className={cn(
                              "flex w-[92px] cursor-default flex-col items-center gap-1.5 rounded-[6px] p-1.5 text-center outline-none select-none data-highlighted:bg-(--v3-panel-2)",
                              on && CURRENT,
                            )}
                          >
                            <span className="overflow-hidden rounded-[4px] bg-white shadow-[inset_0_0_0_1px_var(--v3-swatch-line)]">
                              <ChartSvg spec={st} data={sampleData(st.kind)} width={72} height={48} thumb className="block h-12 w-[72px]" />
                            </span>
                            {/* 标签区固定两行高：同一排里单行与两行的标签上沿对齐、格子等高 */}
                            <span className="min-h-8 text-[12px] leading-4 text-(--v3-text)">
                              {st.lines.map((l) => (
                                <span key={l} className="block whitespace-nowrap">
                                  {l}
                                </span>
                              ))}
                            </span>
                          </DM.Item>
                        )
                      })}
                    </div>
                  </DM.SubContent>
                </DM.Portal>
              </DM.Sub>
            )
          })}
          {footer && (
            <>
              <DM.Separator className={MENU_SEPARATOR} />
              {footer}
            </>
          )}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  )
}

/**
 * 下拉内确认（03-31「会丢东西时先确认」）：从「类型」下拉选了会丢弃导入部件内容的子类型时，菜单不关，底部出这一段；
 * 两个按钮是菜单项（方向键可达），出现时焦点在「切换」；Esc 关掉整个菜单，等同取消。文案只在子类型名之后换行。
 */
export function TypeSwitchConfirm({ subtype, onConfirm, onCancel }: { subtype: ChartSubtype; onConfirm: () => void; onCancel: () => void }) {
  const confirmRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const t = window.setTimeout(() => confirmRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
  }, [])
  const btn = "flex h-7 cursor-default items-center rounded-[6px] px-3 text-[12px] leading-none font-medium outline-none select-none"
  return (
    <div role="group" aria-label="确认更改图表类型" className="flex flex-col gap-2 px-2 pt-1.5 pb-1">
      <p className="flex items-start gap-1.5 text-[12px] leading-[18px] text-(--v3-text)">
        <TriangleAlert {...ICON} aria-hidden="true" className="mt-px shrink-0 text-(--v3-warning)" />
        <span>
          <span className="whitespace-nowrap">切换为{subtype.name}</span>
          <span className="whitespace-nowrap">将移除坐标轴与趋势线</span>
        </span>
      </p>
      <div className="flex justify-end gap-1.5">
        <DM.Item
          onSelect={(e) => {
            e.preventDefault()
            onCancel()
          }}
          className={cn(btn, "bg-(--v3-panel-2) text-(--v3-text) data-highlighted:bg-(--v3-panel-3)")}
        >
          取消
        </DM.Item>
        <DM.Item ref={confirmRef as Ref<HTMLDivElement>} onSelect={onConfirm} className={cn(btn, "bg-(--v3-accent-solid) text-(--v3-accent-fg) data-highlighted:bg-(--v3-accent-solid-hover)")}>
          切换
        </DM.Item>
      </div>
    </div>
  )
}
