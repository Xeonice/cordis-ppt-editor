import { useEffect, useId, useState } from "react"
import { useForm, type RegisterOptions } from "react-hook-form"
import { cn } from "@/lib/utils"
import { Button, Dialog, FIELD_FRAME, useEditor } from "../../kit"

/**
 * 对话框行列上限：待性能评估，评估前暂按 75 × 75 占位（用户裁决 Q3；03-30 §2.2、§13 第 6 条，rulings §4.22 DF-10）。
 * 「待评估」是工程备注，不写进界面文案：界面只写当前上限。
 */
const MAX = 75

type Values = { rows: string; cols: string }

/** 单个字段的规则（必填 → 下限 / 上限 → 整数）；字段按字符串登记，非法输入原样留在框里并内联报错 */
function rules(label: "行数" | "列数"): RegisterOptions<Values, "rows" | "cols"> {
  return {
    required: `请输入${label}`,
    min: { value: 1, message: `${label}至少为 1` },
    max: { value: MAX, message: `${label}最多 ${MAX}` },
    pattern: { value: /^\s*\d+\s*$/, message: `${label}须为整数` },
  }
}

/**
 * 「插入表格…」对话框（03-30 §2.2）：kit Dialog（sm 360），行数、列数两个整数字段并排，顺序与网格读数「行 × 列」一致；
 * 由 react-hook-form 管理（mode onChange，打开时先校验一次，演示态传入的超限初值直接画出报错帧）。
 * 说明行常显上限；出错时就地变为内联错误（危险色、role="alert"），出错字段 aria-invalid，两个字段都错时用「；」连接。
 * 主按钮用动词「插入」（对话框主按钮一律写动作，不写「确定」）；非法时仍是同一个按钮：aria-disabled、可聚焦、tooltip 复述错误，Enter 不提交；取消 / Esc 关闭。
 */
export function InsertTableDialog({ rows = "3", cols = "4", onClose, returnFocus }: { rows?: string; cols?: string; onClose?: () => void; returnFocus?: string }) {
  const [open, setOpen] = useState(true)
  const uid = useId()
  const { register, handleSubmit, trigger, formState } = useForm<Values>({ mode: "onChange", defaultValues: { rows, cols } })
  useEffect(() => {
    void trigger()
  }, [trigger])
  const rowErr = formState.errors.rows?.message
  const colErr = formState.errors.cols?.message
  const error = [rowErr, colErr].filter(Boolean).join("；")
  const close = () => {
    setOpen(false)
    onClose?.()
  }
  const submit = handleSubmit(() => close())
  const noteId = `${uid}-note`
  const formId = `${uid}-form`

  const field = (name: keyof Values, label: "行数" | "列数", err?: string) => (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[12px] leading-4 text-(--v3-text-2)">{label}</span>
      <input
        {...register(name, rules(label))}
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={err ? true : undefined}
        aria-describedby={noteId}
        className={cn(
          // 字段外框同 kit 字段（FIELD_FRAME：淡底、不描边，悬停出细边，rulings §4.25 DS-35）；聚焦 / 校验错误只换这条线的颜色
          FIELD_FRAME,
          "h-7 w-full min-w-0 px-2 text-[12px] leading-none text-(--v3-text) tabular-nums outline-none transition-colors hover:bg-(--v3-field-fill-hover)",
          err ? "ring-(--v3-danger)" : "focus:ring-(--v3-accent)",
        )}
      />
    </label>
  )

  return (
    <Dialog
      title="插入表格"
      description="输入行数和列数；插入后光标在第一个单元格。"
      size="sm"
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      // 关闭后焦点回到打开网格的按钮（03-30 §2.2）：由 Dialog 在焦点陷阱撤掉之后交还（在 onClose 里直接 focus 会被陷阱拉回框内）
      returnFocus={returnFocus}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            取消
          </Button>
          {/* 输入不合法时「插入」不可用：kit Button 的不可用态（aria-disabled、仍可聚焦、点了不提交，工具提示写原因） */}
          <Button variant="primary" type="submit" form={formId} disabled={!!error} reason={error || undefined}>
            插入
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3">
          {field("rows", "行数", rowErr)}
          {field("cols", "列数", colErr)}
        </div>
        <p id={noteId} role={error ? "alert" : undefined} className={cn("text-[12px] leading-[18px]", error ? "text-(--v3-danger)" : "text-(--v3-text-2)")}>
          {error || `行数、列数各 1–${MAX}`}
        </p>
      </form>
    </Dialog>
  )
}

/** 场景状态里直接打开的对话框：关闭后工具条回到「选择」、焦点回到「表格」按钮（打开网格的那个按钮） */
export function DialogFlow({ rows, cols }: { rows: string; cols: string }) {
  const ed = useEditor()
  const [shown, setShown] = useState(true)
  if (!shown) return null
  return (
    <InsertTableDialog
      rows={rows}
      cols={cols}
      returnFocus="tool-table"
      onClose={() => {
        setShown(false)
        ed.setTool("select")
      }}
    />
  )
}
