import { cn } from "@/lib/utils"

/**
 * 文件名的长名规则（导入对话框上传、解析与失败态的文件名行、导出对话框的生成中与「导出完成」、导出完成的轻提示，同一个件）：
 * 单行、不折行，放不下时中间省略——开头照常显示，末尾保留扩展名与它前面几个字（「…终版 v3）.pptx」），中间一个省略号；扩展名总看得见
 * （导入失败「不支持的文件格式」的原因就在 .ppt 上，导出的 .zip / .pdf 也要认得出）。完整文件名进工具提示（title），读屏念一整串完整的名字。
 * 依据：设计 07 §7「截断文案一律用省略号 + 完整内容进 title / tooltip，不做无提示的硬截断」、03-01「文件名超长：单行截断 + 省略号，完整文件名进 tooltip」；
 * TB-95 允许文件名到 255 字，折行会把 560 宽的导入对话框与 480 宽的导出对话框撑开。
 * 结构：看得见的一份拆成前段（可裁）、后段（不裁）两个弹性子项，读屏不念（aria-hidden，工具提示挂在这一份上）；读屏念的是另一份完整的串（sr-only），不被拆成两截。
 * 宽度：父级是收缩包裹（整块状态、轻提示）时给一个绝对上限（className 写 max-w-[440px] 这类），父级是撑满的块时用缺省的 max-w-full。
 * suffix 是跟在名字后面、永远不裁的一段（「 · 48.2 MB」）。对齐用 align-top：与同一行的文字同字号、同行高时上沿对齐即视觉对齐。
 */

/** 扩展名前面保留的字数 */
const KEEP = 6

/** 拆成两段：前段可裁、后段（扩展名 + 前面 KEEP 个字）不裁；两段拼起来就是完整文件名 */
export function splitFileName(name: string): [string, string] {
  const ext = /\.[A-Za-z0-9]{1,8}$/.exec(name)?.[0] ?? ""
  const cut = Math.max(0, name.length - ext.length - KEEP)
  return [name.slice(0, cut), name.slice(cut)]
}

export function FileName({ name, suffix, className }: { name: string; suffix?: string; className?: string }) {
  const [head, tail] = splitFileName(name)
  return (
    <span className={cn("inline-flex max-w-full min-w-0 align-top", className)}>
      <span aria-hidden="true" title={name} className="flex min-w-0">
        {/* whitespace-pre：在空格处切开时空格照常保留（nowrap 会吞掉段尾的空格） */}
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-pre">{head}</span>
        <span className="shrink-0 whitespace-pre">{tail}</span>
        {suffix && <span className="shrink-0 whitespace-pre tabular-nums">{suffix}</span>}
      </span>
      <span className="sr-only">{suffix ? `${name}${suffix}` : name}</span>
    </span>
  )
}
