import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  closeWithFocusBack, ContextMenu, DeckSlideView, Dialog, holdFocusDuring, ICON, IconButton, overlayOpen, TOOLBAR_BAR, useEditorCommand, userHasInteracted, useSceneState, type RegionDefaults,
} from "../../kit"
import { callOf } from "./data"
import { RESTORE_DESC, RestoreNote, restore, VIEW_LOCK } from "./chrome"
import { focusRow, landingOf, VersionList } from "./HistoryPanel"
import { deckOf } from "./slides"
import { useVh } from "./store"

/**
 * 备选方案（供对照，不是推荐）：
 * - alt-rail-list：版本列表放进左栏（取代缩略图列表），检查器留着（只读）。该版本的页只能放进底部的「缩略图迷你条」（03-07 原文的迷你条），
 *   缩略图从 190 宽缩到 64 宽、左栏丢了它最熟悉的用途；检查器在预览时没有可改的东西，却占着 280。
 * - alt-confirm-dialog：恢复确认用模态确认框（kit Dialog confirm），对照推荐的「锚在横幅按钮下的非模态确认卡」。
 * - alt-duplicate：在版本行右键菜单里加「以此版本创建副本」（Figma 版本菜单的 Duplicate）——目前没有对应能力（POST /documents/:id/duplicate 只复制当前状态），
 *   按 DS-19 推荐不放；要的话需走新增需求的变更（给 duplicate 加 snapshotId，与 export 的 snapshotId? 同一口径）。
 */

/**
 * alt-rail-list 的左栏：上半部分（主菜单、文件名、同步状态）照常，下面换成「版本历史」列表。
 * 开合与推荐方案同一套入口与键盘：文档菜单「版本历史」（底座命令 doc.history）打开、焦点落在选中的版本上；
 * Esc 逐层（浮层开着时不动）：正在预览历史版本时先回到当前版本，再按收起列表；「关闭」与 Esc 收起后焦点交回文件名（文档菜单）。
 */
export function AltRail({ d }: { d: RegionDefaults }) {
  const vh = useVh()
  const [show, setShow] = useSceneState("version-history.alt-rail", true)
  const live = useRef(vh)
  live.current = vh
  // 列表随之卸载：先把焦点交回打开它的文件名、再收起，不经过 body（kit closeWithFocusBack）
  const close = () =>
    closeWithFocusBack(
      () => {
        setShow(false)
        vh.setSelected("current")
        vh.setConfirm(false)
      },
      "doc-menu",
    )
  const closeRef = useRef(close)
  closeRef.current = close
  useEditorCommand("doc.history", () => {
    // 同推荐方案：菜单收起、条目卸载时焦点直接交给选中的版本（不经过 body、不先绕回文件名）
    holdFocusDuring(1500, () => landingOf(live.current))
    setShow(true)
    focusRow(live.current.selected)
  })
  useEffect(() => {
    if (!show) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing || overlayOpen()) return
      e.preventDefault()
      const v = live.current
      if (v.selected !== "current") {
        v.setSelected("current")
        v.setConfirm(false)
        focusRow("current")
        return
      }
      closeRef.current()
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [show])
  // 用户打开的列表：焦点落在选中的版本上（场景状态里一出现就开着的不抢焦点）
  useEffect(() => {
    if (show && userHasInteracted()) focusRow(live.current.selected)
  }, [show])
  if (!show) return <>{d.leftRail()}</>
  return (
    <>
      {d.leftRail({
        newSlide: false,
        viewToggle: VIEW_LOCK,
        list: (
          <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-(--v3-border)">
            <div className="flex h-11 shrink-0 items-center justify-between pr-3 pl-4">
              <h2 className="text-[13px] leading-4 font-semibold text-(--v3-text)">版本历史</h2>
              <IconButton label="关闭" kbd="Esc" onClick={close}>
                <X {...ICON} />
              </IconButton>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <VersionList vh={vh} compact />
            </div>
          </div>
        ),
      })}
    </>
  )
}

/** alt-rail-list 的底部：预览时工具条换成该版本的缩略图迷你条（64 宽），当前页强调色描边 */
export function PageStrip({ d }: { d: RegionDefaults }) {
  const vh = useVh()
  const ed = vh.ed
  if (!vh.previewing || !vh.version) return <>{d.toolbar()}</>
  const deck = deckOf(vh.version.deck, ed.deck)
  return (
    <div role="toolbar" aria-label="此版本的页面" data-v3-anchor="toolbar" className={cn(TOOLBAR_BAR, "gap-1.5 p-1.5")}>
      {deck.map((s) => {
        const on = s.n === ed.slide
        return (
          <button
            key={s.n}
            type="button"
            aria-label={`第 ${s.n} 页`}
            aria-current={on ? "true" : undefined}
            onClick={() => ed.goTo(s.n)}
            className={cn("w-16 overflow-hidden rounded-[4px] border transition-colors", on ? "border-(--v3-accent) ring-[0.5px] ring-(--v3-accent)" : "border-(--v3-border) hover:border-(--v3-hover-line)")}
          >
            <DeckSlideView slide={s} where="thumb" />
          </button>
        )
      })}
    </div>
  )
}

/**
 * alt-confirm-dialog：恢复确认用模态确认框。开关与推荐方案的确认卡是同一个（vh.confirm，状态出现时开着），
 * 关掉后再点横幅「恢复此版本」打开的仍是这个对话框（data.confirmDialog 让横幅不再挂确认卡），评审在备选态里看到的始终是备选形态
 */
export function AltRestoreDialog() {
  const vh = useVh()
  const v = vh.version
  if (!v) return null
  return (
    <Dialog
      variant="confirm"
      title={`恢复到${callOf(v)}？`}
      description={RESTORE_DESC}
      open={vh.confirm}
      onOpenChange={vh.setConfirm}
      secondary={{ label: "取消" }}
      primary={{ label: "确认恢复", onClick: () => restore(vh) }}
      returnFocus="version-history.restore"
    >
      <RestoreNote vh={vh} />
    </Dialog>
  )
}

/** alt-duplicate：版本行的右键菜单（「恢复此版本」是第二入口，不常驻；「以此版本创建副本」为新增需求的示意） */
export function AltDuplicateMenu() {
  const vh = useVh()
  return (
    <ContextMenu
      at={{ anchor: "version-history.row-n-proposal", x: 0.52, y: 0.42 }}
      target="version-history.row-*"
      onTarget={(name) => {
        const id = name.replace("version-history.row-", "")
        vh.setSelected(id)
        vh.setConfirm(false)
      }}
      label="版本"
      items={[
        { id: "restore", label: "恢复此版本", onSelect: () => vh.setConfirm(true) },
        { id: "copy", label: "以此版本创建副本", onSelect: () => vh.setToast("copied") },
      ]}
    />
  )
}
