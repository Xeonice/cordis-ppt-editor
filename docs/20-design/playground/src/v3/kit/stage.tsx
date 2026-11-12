import type { HTMLAttributes, ReactNode, Ref } from "react"
import { cn } from "@/lib/utils"
import { useEditorMaybe } from "../editor/context"
import { useV3Params } from "../params"

/**
 * 舞台作用域（03-11 放映；第 3 批转正时由 scenarios/present/scope.tsx 并入底座，kitRequest g3 K1）：放映舞台与压在舞台上的界面件（控制条、「更多」菜单、跳页条、跟随条、结束页）
 * 与界面主题无关，一律取暗色 token——在舞台这一块再开一个 v3 作用域（data-v3-theme="dark"，强调色跟随当前界面），做法同 kit PaperScope（白纸面一律取亮色 token）。
 * 所以暗、亮两套截图里的舞台一模一样（质量门 Q9 对舞台没有差别），控制条在两套主题下都是暗色的浮动工具条（与编辑器暗色底部工具条同一外观）。
 * 舞台自己的颜色在 v3.css 的 .v3-root 里（两套主题同值）：--v3-stage #0A0A0A（舞台底与留边）、--v3-stage-black #000000（黑屏、结束页）、--v3-stage-white #FFFFFF（白屏）。
 */
export function StageScope({
  className,
  children,
  ref,
  ...rest
}: { className?: string; children: ReactNode; ref?: Ref<HTMLDivElement> } & Omit<HTMLAttributes<HTMLDivElement>, "className" | "children">) {
  const ed = useEditorMaybe()
  const params = useV3Params()
  const accent = ed?.accent ?? params.accent
  return (
    <div ref={ref} data-v3-theme="dark" data-v3-accent={accent} className={cn("v3-root bg-(--v3-stage)", className)} {...rest}>
      {children}
    </div>
  )
}
