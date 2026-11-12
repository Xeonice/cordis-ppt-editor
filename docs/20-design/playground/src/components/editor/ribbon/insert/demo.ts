/**
 * 演示态辅助（非产品行为）：路由的「演示状态」下拉切到某个弹层时，Radix Select 关闭会把焦点还给下拉触发器，
 * 非模态 Popover 会把这次焦点移动当成「焦点移出」而自行关闭。挂在 PopoverContent 的 onInteractOutside 上，
 * 忽略来自 DesignBar（`[data-slot="design-bar"]`）的焦点与指针事件；产品里没有 DesignBar，这条规则不生效。
 */
export function ignoreDesignBar(e: { target: EventTarget | null; preventDefault(): void; detail?: { originalEvent?: Event } }) {
  const t = (e.detail?.originalEvent?.target ?? e.target) as Element | null
  if (t && typeof t.closest === "function" && t.closest('[data-slot="design-bar"]')) e.preventDefault()
}
