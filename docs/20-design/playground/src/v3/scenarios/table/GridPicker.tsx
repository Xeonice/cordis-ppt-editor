import { useEffect, useState } from "react"
import { Popover, TableGridPicker, useEditor, registerToolLayer } from "../../kit"
import { InsertTableDialog } from "./InsertTableDialog"
import { useTableUi } from "./store"

/**
 * 网格弹层 + 「插入表格…」对话框的一条流程（layers）：锚在工具条「表格」（tool-table）或占位符的表格图标（table.ph-table）。
 * 选定行列即插入并关闭；「插入表格…」先关网格、再开对话框；取消 / Esc 后焦点回到打开网格的按钮（03-30 §2.2）。
 * 弹层开关记在场景仓（useTableUi().gridOpen），占位符图标的按下态读同一值；从工具条打开的，关闭后工具回到「选择」。
 * 占位符图标打开的网格按 03-16 §6.6（图标条归属，03-30 §12 第 22 行统一）：图标正下方居中、距 8，网格下多一行「填入这个占位符，表格宽度取占位符宽」；
 * 下方放不下时自动翻到上方（rulings §4.25 TB-10）。
 */
export function GridFlow({ anchor, hover = { r: 3, c: 4 } }: { anchor: "tool-table" | "table.ph-table"; hover?: { r: number; c: number } }) {
  const ed = useEditor()
  const [ui, set] = useTableUi()
  const [dialog, setDialog] = useState(false)
  const fromToolbar = anchor === "tool-table"

  // 工具条按钮的按下态跟随弹层：弹层关了、也没开对话框时回到「选择」
  useEffect(() => {
    if (fromToolbar && !ui.gridOpen && !dialog && ed.tool === "table") ed.setTool("select")
  }, [fromToolbar, ui.gridOpen, dialog, ed])

  return (
    <>
      <Popover
        anchor={anchor}
        label={fromToolbar ? "插入表格" : "插入表格到占位符"}
        open={ui.gridOpen}
        onOpenChange={(o) => set({ gridOpen: o })}
        {...(fromToolbar ? {} : { side: "bottom" as const, align: "center" as const, sideOffset: 8 })}
        className="p-2"
      >
        <TableGridPicker
          initial={hover}
          note={
            fromToolbar ? undefined : (
              <>
                填入这个占位符，表格宽度取<span className="whitespace-nowrap">占位符宽</span>
              </>
            )
          }
          onPick={() => set({ gridOpen: false })}
          onOpenDialog={() => {
            set({ gridOpen: false })
            setDialog(true)
          }}
        />
      </Popover>
      {dialog && <InsertTableDialog returnFocus={anchor} onClose={() => setDialog(false)} />}
    </>
  )
}

/**
 * 真实工具条「表格」网格 ›「插入表格…」打开的对话框（底座按 table:dialog 取，任何状态都能打开）：关闭后焦点回到「表格」按钮。
 */
function ToolbarTableDialog() {
  const [shown, setShown] = useState(true)
  return shown ? <InsertTableDialog returnFocus="tool-table" onClose={() => setShown(false)} /> : null
}

registerToolLayer("table:dialog", () => <ToolbarTableDialog />)
