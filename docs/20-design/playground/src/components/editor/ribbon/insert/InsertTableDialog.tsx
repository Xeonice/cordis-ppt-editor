import { useEffect, type RefObject } from "react"
import { useForm, type RegisterOptions } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * 「插入表格…」对话框的行列上限（用户裁决 2026-09-30 Q3「放宽行数」）：行数不再限 8，列数一并评估；
 * 具体值随 50/24 §2.14 第 1 条的性能评估定（推迟项 DF-10，M2 表格插入开工前），定值前暂按 PowerPoint 对话框的 75 × 75 占位。
 * 悬停网格的范围（8 行 × 10 列）与此无关，见 TableGridPicker。
 */
export const TABLE_DIALOG_MAX = { rows: 75, cols: 75 } as const

const LIMIT_NOTE = "上限待性能评估"

type InsertTableValues = { rows: string; cols: string }

/**
 * 单个字段的规则（react-hook-form 内置校验：必填 → 下限 / 上限 → 整数）：非空、≥ 1、≤ 上限、整数；
 * 字段按字符串登记，非法输入原样留在框里并内联报错，提交时再转成数字
 */
function rules(label: "行数" | "列数", max: number): RegisterOptions<InsertTableValues, "rows" | "cols"> {
  return {
    required: `请输入${label}`,
    min: { value: 1, message: `${label}至少为 1` },
    max: { value: max, message: `${label}最多 ${max} · ${LIMIT_NOTE}` },
    pattern: { value: /^\s*\d+\s*$/, message: `${label}须为整数` },
  }
}

export interface InsertTableDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 确定：与网格走同一条插入命令（slide.insertTable / 占位符 slide.fillPlaceholder），一个撤销步 */
  onConfirm: (rows: number, cols: number) => void
  /** 打开时的初值（演示态可传超限值直接画出报错帧）；缺省 3 行 × 4 列 */
  defaults?: { rows: string | number; cols: string | number }
  /** 关闭后焦点回到的触发按钮（插入页签「表格 ▾」）；缺省由 Radix 还给打开前的焦点 */
  returnFocusRef?: RefObject<HTMLElement | null>
}

/**
 * 插入表格对话框（设计 03-30 §2.2；50/24 §2.3、§2.12；PRD ED-10、G-32）：shadcn Dialog 宽 384（与超链接对话框同宽），
 * 行数、列数两个整数字段，顺序与网格读数「行 × 列」一致；非法值（空、非整数、< 1、超上限）在字段下方的说明行内联报错
 * （说明行变为 destructive 色并 role="alert"，对应字段 aria-invalid），「确定」aria-disabled 并以 tooltip 复述原因；
 * 打开时焦点在对话框容器上，Tab 进入表单（与 03-15 对话框同一口径）；Enter 在任一字段内提交。
 * 两个字段由 react-hook-form 管理（R-d-18）：mode="onChange" 逐字段即时校验，打开时先校验一次（演示态传入的超限初值直接画出报错帧）。
 */
export function InsertTableDialog({ open, onOpenChange, onConfirm, defaults, returnFocusRef }: InsertTableDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-5 sm:max-w-sm"
        onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).focus() }}
        onCloseAutoFocus={returnFocusRef ? (e) => { e.preventDefault(); returnFocusRef.current?.focus() } : undefined}
      >
        {/* 表单挂在 DialogContent 里：对话框每次打开都重新挂载，初值随之复位 */}
        <InsertTableForm
          defaults={defaults}
          onCancel={() => onOpenChange(false)}
          onConfirm={(r, c) => { onOpenChange(false); onConfirm(r, c) }}
        />
      </DialogContent>
    </Dialog>
  )
}

function InsertTableForm({
  defaults,
  onCancel,
  onConfirm,
}: {
  defaults?: { rows: string | number; cols: string | number }
  onCancel: () => void
  onConfirm: (rows: number, cols: number) => void
}) {
  const { register, handleSubmit, trigger, formState: { errors } } = useForm<InsertTableValues>({
    mode: "onChange",
    defaultValues: { rows: String(defaults?.rows ?? 3), cols: String(defaults?.cols ?? 4) },
  })
  useEffect(() => { void trigger() }, [trigger])
  const rowErr = errors.rows?.message ?? null
  const colErr = errors.cols?.message ?? null
  const error = [rowErr, colErr].filter(Boolean).join("；") || null
  const submit = handleSubmit((v) => onConfirm(Number(v.rows.trim()), Number(v.cols.trim())))
  const field = (name: keyof InsertTableValues, label: "行数" | "列数", max: number, err: string | null) => (
    <Field data-invalid={err ? true : undefined} className="gap-1.5">
      <FieldLabel htmlFor={`insert-table-${name}`} className="text-xs font-normal text-muted-foreground">{label}</FieldLabel>
      <Input
        id={`insert-table-${name}`}
        {...register(name, rules(label, max))}
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={err ? true : undefined}
        aria-describedby="insert-table-note"
        className="tabular-nums"
      />
    </Field>
  )
  return (
    <>
      <DialogHeader>
        <DialogTitle>插入表格</DialogTitle>
        <DialogDescription>输入行数和列数；插入后光标在第一个单元格。</DialogDescription>
      </DialogHeader>
      <form id="insert-table-form" onSubmit={submit} className="flex flex-col gap-2" noValidate>
        <div className="grid grid-cols-2 gap-3">
          {field("rows", "行数", TABLE_DIALOG_MAX.rows, rowErr)}
          {field("cols", "列数", TABLE_DIALOG_MAX.cols, colErr)}
        </div>
        <p
          id="insert-table-note"
          role={error ? "alert" : undefined}
          className={cn("text-xs text-pretty", error ? "text-destructive" : "text-muted-foreground")}
        >
          {error ?? `行数、列数各 1–${TABLE_DIALOG_MAX.rows} · ${LIMIT_NOTE}（暂按 ${TABLE_DIALOG_MAX.rows} × ${TABLE_DIALOG_MAX.cols}）`}
        </p>
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>取消</Button>
        {/* 同一个按钮元素：校验状态切换时焦点不丢；非法时 aria-disabled（仍可聚焦），tooltip 复述内联错误 */}
        <Tooltip open={error ? undefined : false}>
          <TooltipTrigger asChild>
            <Button
              type="submit"
              form="insert-table-form"
              aria-disabled={error ? true : undefined}
              className={cn(error && "cursor-not-allowed opacity-50 active:translate-y-0")}
              onClick={(e) => { if (error) e.preventDefault() }}
            >
              确定
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-60 text-pretty">{error}</TooltipContent>
        </Tooltip>
      </DialogFooter>
    </>
  )
}
