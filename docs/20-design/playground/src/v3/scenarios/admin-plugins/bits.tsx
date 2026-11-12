import type { ReactNode } from "react"
import { Puzzle, TriangleAlert, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { hasCjk } from "../../kit"
import { STATUS, type DeployStatus } from "./data"

/**
 * admin-plugins 的小件。插件图标块、状态文字、行下说明的画法与第 2 批个人插件面板（scenarios/plugins/bits.tsx）同一套——
 * 管理清单与个人面板是同一种插件行（标杆对照：Figma Slides 插件列表的行密度与图标块）；这里多了 20 / 40 两档图标块（详情抽屉的依赖行与头部）。
 */

/** 行内小图标（12px，同个人面板 SI） */
export const SI = { size: 12, strokeWidth: 1.75, "aria-hidden": true } as const

const TILE = { 20: "size-5", 28: "size-7", 32: "size-8", 40: "size-10" } as const
const TILE_ICON = { 20: 12, 28: 16, 32: 16, 40: 20 } as const

/**
 * 插件图标块：圆角 4（缩略图档）、panel-2 底；没有图标用拼图兜底（06 §2.1）。dim：被拒、已声明或策略为禁用，图标退到 text-3（不用半透明，03-32 §4.1）。
 * onCanvas：落在画布底上（管理清单的行）时改成 panel 底 + 1px 细边——同 kit outline 按钮「画布底上的件」的约定；亮色的 panel-2（#F2F2F2）落在画布（#F5F5F5）上
 * 几乎看不见（复验 AP-04、标杆 Figma 缩略图带框）。对话框、抽屉里落在 panel 上的图标块不变
 */
export function Tile({ icon: Icon = Puzzle, size = 32, dim, onCanvas }: { icon?: LucideIcon; size?: keyof typeof TILE; dim?: boolean; onCanvas?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 items-center justify-center rounded-[4px]", onCanvas ? "border border-(--v3-border) bg-(--v3-panel)" : "bg-(--v3-panel-2)", TILE[size])}
    >
      <Icon size={TILE_ICON[size]} strokeWidth={1.5} className={dim ? "text-(--v3-text-3)" : "text-(--v3-text-2)"} />
    </span>
  )
}

/** 部署级状态：12px 图标 + 12px 文字；危险的四种只有图标用危险色、文字用主文字色，其余整段 text-2（状态色只给图标，正常态不着色，DS-41） */
export function StatusLabel({ status, className }: { status: DeployStatus; className?: string }) {
  const m = STATUS[status]
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 text-[12px] leading-4 whitespace-nowrap", m.danger ? "text-(--v3-text)" : "text-(--v3-text-2)", className)}>
      <m.Icon {...SI} className={cn("shrink-0", m.danger && "text-(--v3-danger)")} />
      {m.label}
    </span>
  )
}

/** 只要状态的图标（筛选分段的组名前、状态说明）：与行内状态同一个图标、同一着色 */
export function StatusIcon({ status, size = 12 }: { status: DeployStatus; size?: 12 | 16 }) {
  const m = STATUS[status]
  return <m.Icon size={size} strokeWidth={size === 12 ? 1.75 : 1.5} aria-hidden="true" className={cn("shrink-0", m.danger ? "text-(--v3-danger)" : "text-(--v3-text-2)")} />
}

/** 行下说明的一行：可带 12px 图标；文字 12px，tone 取主文字色或次级文字色（状态色只给图标） */
export function Note({ icon, tone = "muted", children, className }: { icon?: ReactNode; tone?: "muted" | "text"; children: ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-start gap-1 text-[12px] leading-4 break-keep", tone === "text" ? "text-(--v3-text)" : "text-(--v3-text-2)", className)}>
      {icon && <span className="flex h-4 shrink-0 items-center">{icon}</span>}
      <span className="min-w-0">{children}</span>
    </p>
  )
}

/** 引号内的名称与代码串不断行（Q7） */
export const Nowrap = ({ children }: { children: ReactNode }) => <span className="whitespace-nowrap">{children}</span>

/** 代码串（插件 id、贡献点、能力、错误码）：等宽 11px（只有西文）；含中文的用 12px 正文字体 */
export function Code({ children, muted }: { children: string; muted?: boolean }) {
  return hasCjk(children) ? (
    <span className={cn("text-[12px] leading-4 whitespace-nowrap", muted ? "text-(--v3-text-2)" : "text-(--v3-text)")}>{children}</span>
  ) : (
    <code className={cn("font-mono text-[11px] leading-4 whitespace-nowrap", muted ? "text-(--v3-text-2)" : "text-(--v3-text)")}>{children}</code>
  )
}

/**
 * 带代码串的一句话：数据里用反引号标出代码串（贡献点、命令 id、配置键、接口路径、公钥指纹），渲染成等宽 11px（Code），其余照常——
 * 被拒原因、分组说明、信任来源都用它，免得「core.mutation」这类串混在正文字体里（Q4 / Q9）。
 */
export function Rich({ text, muted }: { text: string; muted?: boolean }) {
  const parts = text.split("`")
  return (
    <>
      {parts.map((s, i) =>
        i % 2 === 1 ? (
          <Code key={i} muted={muted}>
            {s}
          </Code>
        ) : (
          s
        ),
      )}
    </>
  )
}

/** 去掉反引号的纯文字（读屏名、工具提示） */
export const plain = (text: string) => text.split("`").join("")

/**
 * 警示色块（03-32 §7.2 / §7.3 / §9「缺席后果」「同源可信」）：警告浅底 + 警告色图标，正文用主文字色（rulings §4.25 DS-41）。
 * 圆角 6、不描边，放在对话框与抽屉的正文里（不是卡片：不套别的底、不带阴影）。
 */
export function WarnBlock({ title, children, icon }: { title?: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <div role="note" className="flex items-start gap-2 rounded-[6px] bg-(--v3-warning-soft) px-3 py-2 text-[12px] leading-[18px] text-(--v3-text)">
      <span className="flex h-[18px] shrink-0 items-center text-(--v3-warning)">{icon ?? <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />}</span>
      <p className="min-w-0">
        {title && <span className="font-semibold">{title}</span>}
        {children}
      </p>
    </div>
  )
}

/** 键值表（详情「概要」）：左列 88 的标签（text-2）· 右列值（text） */
export function KvList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[12px] leading-4">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-(--v3-text-2)">{k}</dt>
          <dd className="min-w-0 text-(--v3-text)">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
