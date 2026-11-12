import { ArrowLeft, Puzzle, ScrollText, ServerCog, ShieldCheck, Users, type LucideIcon } from "lucide-react"
import { ICON, ShellNavButton, Tag, Tip, withReason } from "../../kit"
import { M4_REASON } from "./data"
import { useAdmin } from "./store"

/**
 * 管理页的左栏内容（03-32 §10 按 v3 重画）：应用壳左栏 220 不变（品牌行 56 · 底部用户行 = 同一份账户菜单，DS-18），
 * 首页那组主导航换成管理导航——「← 返回首页」（原「返回应用」，回开始页；有草稿时先弹离开确认，DS-59）· 小标题「管理」·
 * 当前项「插件」· 用户与角色 / 审计日志 / 部署与配额三项禁用而不隐藏（aria-disabled、可聚焦、M4 标记、工具提示写原因，rulings §4.20 FE-06）。
 * 画法同首页导航项（kit ShellNavButton：28 高、圆角 6、当前项 panel-2 底 + 500），不再是 224 宽的玻璃导航卡。
 * 放在 ShellLayout 的 navSlot 插槽里（ShellRail 的管理变体，第 3 批转正并入：换掉缺省主导航，不渲染文档搜索与空的 <nav>；原来借 search 插槽、用场景级 className 隐藏空导航的做法随之删去）。
 * 左栏不放「帮助」（03-32 §10，用户 10-01 确认；rulings §4.25 TB-119）：键盘快捷键与帮助中心在账户菜单里（AS-06）。
 */
export function AdminRailNav() {
  const api = useAdmin()
  return (
    <div className="flex flex-col px-3">
      {/* 离开确认关闭后焦点交回这里（锚点在外层，kit focusBack 交给其中的按钮） */}
      <div data-v3-anchor="admin-plugins.back">
        <ShellNavButton Icon={ArrowLeft} label="返回首页" onClick={api.requestLeave} />
      </div>
      <h2 id="admin-nav-title" className="mt-4 flex h-6 items-center gap-1.5 px-2 text-[12px] leading-none font-semibold text-(--v3-text-2)">
        <ShieldCheck size={14} strokeWidth={1.5} aria-hidden="true" />
        管理
      </h2>
      <nav aria-labelledby="admin-nav-title" className="mt-1 flex flex-col gap-1">
        <ShellNavButton Icon={Puzzle} label="插件" on />
        <LaterNav Icon={Users} label="用户与角色" />
        <LaterNav Icon={ScrollText} label="审计日志" />
        <LaterNav Icon={ServerCog} label="部署与配额" />
      </nav>
    </div>
  )
}

/**
 * 管理面板其余页（SV-14，M4）：留在原位、不可用——文字与图标退到 text-3、右侧 M4 标记，可聚焦，工具提示「名称 · 后续版本提供」（原因与第 3 批其余不可用项同一句，
 * 里程碑只在标签里写一次，复验 XG-14），点了没有反应
 */
function LaterNav({ Icon, label }: { Icon: LucideIcon; label: string }) {
  return (
    <Tip label={`${label} · ${M4_REASON}`}>
      <button
        type="button"
        aria-disabled="true"
        aria-label={withReason(label, M4_REASON)}
        onClick={(e) => e.preventDefault()}
        className="flex h-7 w-full cursor-default items-center gap-2 rounded-[6px] px-2 text-[13px] leading-none text-(--v3-text-3)"
      >
        <Icon {...ICON} aria-hidden="true" className="shrink-0" />
        <span className="min-w-0 flex-1 text-left">{label}</span>
        <Tag>M4</Tag>
      </button>
    </Tip>
  )
}
