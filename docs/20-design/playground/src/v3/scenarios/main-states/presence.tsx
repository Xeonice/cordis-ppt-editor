import { TriangleAlert } from "lucide-react"
import { RemoteCursor, type Person } from "../../kit"

/**
 * main-states 场景的「人」与画布叠加件：远端协作者光标 / 选区 / 文本选区（05 §3）、评论钉、缩略图警示角标。
 * 身份色用 v3.css 的 --v3-tone-*（与头像底色一一对应），「头像什么色、光标就什么色」；光标、姓名签、远端选区与评论钉直接用 kit（TONE_BG / TONE_BORDER / TONE_SOFT）。
 */
/** 示例文档之外的在场者（8 人在线时用；kit 里已有 ME 周明远、WANG 王小明、LI 李雷、ZHANG 张三）。 */
export const CHEN: Person = { name: "陈静", tone: "mist" }
export const LIU: Person = { name: "刘洋", tone: "slate" }
export const ZHAO: Person = { name: "赵敏", tone: "sand" }
export const SUN: Person = { name: "孙悦", tone: "sage" }

/**
 * 远端光标（多人版）：kit RemoteCursor 换成该协作者的身份色。
 * label=false 表示光标静止一段时间后收起姓名签（05 §3「仅在光标移动或短暂静止时显示标签」）。
 */
export function PresenceCursor({ person, at, label = true }: { person: Person; at: string; label?: boolean }) {
  return <RemoteCursor at={at} name={person.name} tone={person.tone} label={label} />
}

/** 远端对象选区、远端文本选区与评论钉已并入 kit（canvas.tsx）：仅查看形态（narrow 场景）的评论钉与这里同一个组件。 */
export { CommentPin, RemoteSelection, RemoteTextSelection } from "../../kit"

/**
 * 缩略图警示角标：数字 = 该页以占位显示的元素数（03-13 缩略图级）。与评论角标同位置同尺寸，
 * 但用警告色图标 + 警告浅底，两者一眼可分（警示用 warning 语义色，评论用中性色）。放在 RailThumb 的 children 里。
 */
export function WarnBadge({ n }: { n: number }) {
  return (
    <span
      aria-label={`${n} 处内容以占位显示`}
      className="absolute top-1 right-1 inline-flex h-4 items-center gap-0.5 rounded-[4px] border border-(--v3-border) bg-(--v3-warning-soft) px-1 text-[11px] leading-none text-(--v3-text) tabular-nums"
    >
      <TriangleAlert size={10} strokeWidth={1.75} aria-hidden="true" className="text-(--v3-warning)" />
      {n}
    </span>
  )
}
