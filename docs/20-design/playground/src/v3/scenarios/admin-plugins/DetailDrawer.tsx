import type { ReactNode } from "react"
import { BadgeCheck, ClipboardCheck, PackageCheck, ShieldAlert } from "lucide-react"
import { Drawer, Section, TextField } from "../../kit"
import { Code, KvList, Nowrap, Rich, StatusLabel, Tile, WarnBlock } from "./bits"
import { HOST_VERSION, isInactive, isRejected, M4_REASON, NECESSITY_LABEL, POLICY_LABEL, scopeLabel, sourceLong, type AdminPlugin, type Policy } from "./data"
import { CodeList, trustText } from "./Dialogs"
import { detailAnchor } from "./PluginTable"
import { useAdmin, type AdminApi } from "./store"

/**
 * 插件详情抽屉（03-32 §9；rulings §4.25 DS-94：模态——右侧贴边整高、宽 480、带遮罩，与设置未采纳的抽屉备选同一个件 kit Drawer；未采纳的 alt-drawer-nonmodal 无遮罩）。
 * 打开时焦点落在抽屉本身（读屏念标题，03-32 §9），Esc / × / 点遮罩关闭，关闭后焦点回到这一行的「›」；打开它的那一行在遮罩后保留强调色淡底。
 * 抽屉只读：策略改动在清单行里做，头部的策略文字随草稿同步。区块之间 1px 分隔（kit Section，同检查器），不套卡片：
 * 头部 · 概要 · 信任来源 · 依赖与冲突 · 贡献点摘要 · 能力声明 · 最近策略变更（审计）· 配置（M4，禁用而不隐藏）。字段来源见 60/15 §3.15.1 AdminPluginDetail。
 * 不加「恢复部署默认」（PATCH /admin/plugins 的 reset 不经界面、供运维脚本用，rulings §4.25 TB-119）。
 * 从深链进入（?plugin=<cordis 插件 id>，TB-76、TB-121）是同一个抽屉、同一套焦点规则。
 */
export function DetailDrawer() {
  const api = useAdmin()
  const p = api.detail ? api.find(api.detail) : undefined
  return (
    <Drawer
      open={!!p}
      onOpenChange={(v) => !v && api.closeDetail()}
      // 读屏名即标题（插件名，Radix 以 aria-labelledby 指向标题）
      title={p?.name ?? ""}
      width={480}
      modal={api.drawerModal}
      returnFocus={p ? detailAnchor(p.id) : undefined}
      initialFocus="dialog"
      // break-keep：中文只在标点与空格处换行（Q6）
      className="break-keep"
      bodyClassName="p-0"
    >
      {p && <DetailBody api={api} p={p} />}
    </Drawer>
  )
}

function DetailBody({ api, p }: { api: AdminApi; p: AdminPlugin }) {
  const status = api.statusOf(p)
  const rejected = isRejected(status)
  const declared = status === "declared"
  const policy: Policy = api.policyOf(p)
  const draft = policy !== api.serverPolicyOf(p)
  const deps = (p.injects ?? []).map((i) => ({ ...i, provider: api.find(i.provider) }))
  const dependents = api.dependentsOf(p.id)
  const mutex = (p.mutex ?? []).map((m) => ({ ...m, other: api.find(m.with) }))
  return (
    <div className="relative">
      {/* 头部：图标 40 · id · 作用域 · 部署状态 · 当前策略（含草稿值）· 描述 */}
      <Section>
        <div className="flex items-start gap-3">
          <Tile icon={p.icon} size={40} dim={isInactive(status) || policy === "disabled"} />
          <div className="min-w-0">
            <p className="flex h-5 items-center">
              <Code muted>{p.id}</Code>
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] leading-4 text-(--v3-text-2)">
              <span>{scopeLabel(p)}</span>
              <span aria-hidden="true">·</span>
              <StatusLabel status={status} />
              <span aria-hidden="true">·</span>
              {rejected ? (
                <span>无开关 · 需重新部署</span>
              ) : declared ? (
                // 已声明：同清单只读，策略写「校验中」（TB-119）
                <span>校验中</span>
              ) : (
                <span className="text-(--v3-text)">
                  {p.lock ? `${POLICY_LABEL[policy]}（${p.lock === "core" ? "核心组件" : "部署锁定"}）` : POLICY_LABEL[policy]}
                  {draft && <span className="text-(--v3-text-2)"> · 未保存</span>}
                </span>
              )}
            </p>
          </div>
        </div>
        <p className="mt-1 text-[12px] leading-[18px] text-(--v3-text)">{p.description}</p>
      </Section>

      <Section title="概要">
        <KvList
          rows={[
            ["版本", <span className="tabular-nums">{p.version}</span>],
            ["来源", sourceLong(p)],
            ["宿主兼容", <span className="tabular-nums">{`${p.hostRange}（当前 ${HOST_VERSION}）`}</span>],
            ["必需性", NECESSITY_LABEL[p.necessity]],
            ["近 24 h 失败", <Failures24h api={api} p={p} />],
          ]}
        />
      </Section>

      <Section title="信任来源">
        <TrustLine p={p} />
      </Section>

      <Section title="依赖与冲突" bodyClassName="flex flex-col gap-3">
        <RelBlock label="依赖" empty="不依赖其他插件">
          {deps.map((d) =>
            d.provider ? (
              <RelRow key={d.service} api={api} q={d.provider}>
                注入 <Code muted>{d.service}</Code>
              </RelRow>
            ) : null,
          )}
        </RelBlock>
        <RelBlock label="被依赖" empty="没有插件依赖它">
          {dependents.map((q) => (
            <RelRow key={q.id} api={api} q={q}>
              禁用本插件后将进入等待依赖
            </RelRow>
          ))}
        </RelBlock>
        <RelBlock label="互斥" empty="无">
          {mutex.map((m) =>
            m.other ? (
              <RelRow key={m.with} api={api} q={m.other}>
                {/* 引号里的形状键也是代码串，等宽（同清单的互斥说明，复验 AP-06） */}
                都注册 <Code muted>slide.shapeKind</Code>
                <Nowrap>
                  「<Code muted>{m.key}</Code>」
                </Nowrap>
              </RelRow>
            ) : null,
          )}
        </RelBlock>
        {p.absence && <WarnBlock title="缺席后果：">{p.absence}</WarnBlock>}
      </Section>

      <Section title="贡献点摘要">
        <CodeList items={p.contributes} />
      </Section>

      <Section title="能力声明" action={<Aside>仅展示，不做运行时限制</Aside>}>
        {p.capabilities?.length ? <CodeList items={p.capabilities} /> : <Empty>未声明额外能力</Empty>}
      </Section>

      <Section title="最近策略变更" action={<Aside>来自审计</Aside>}>
        {p.audit?.length ? (
          <ol className="flex flex-col gap-2">
            {p.audit.slice(0, 5).map((a) => (
              <li key={a.at + a.change} className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-3 text-[12px] leading-4">
                <span className="text-(--v3-text-2) tabular-nums">{a.at}</span>
                <span className="text-(--v3-text)">
                  {a.actor} · {a.change}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>暂无变更记录</Empty>
        )}
      </Section>

      <Section title="配置" tag="M4" action={<Aside>仅部署级一份</Aside>} bodyClassName="flex flex-col gap-3">
        {p.config?.length ? (
          <>
            {p.config.map((f) => (
              <div key={f.key} className="flex flex-col gap-1">
                <span className="text-[12px] leading-4 text-(--v3-text-2)">
                  {f.label}
                  {f.secret && " · 机密"}
                </span>
                {/* M3：禁用而不隐藏（只读、aria-disabled、可聚焦，工具提示写原因，FE-06）；机密字段只写不读，显示 *** */}
                <TextField aria={f.label} defaultValue={f.value} disabled reason={`插件配置 · ${M4_REASON}`} />
                {f.hint && <span className="text-[12px] leading-4 text-(--v3-text-2)">{f.hint}</span>}
              </div>
            ))}
            <p className="text-[12px] leading-[18px] text-(--v3-text-2)">保存时校验，失败不部分生效；审计只记字段路径，不记值。</p>
          </>
        ) : (
          <Empty>该插件没有可配置项</Empty>
        )}
      </Section>
    </div>
  )
}

/**
 * 近 24 h 失败：非零时主文字色加粗、附最近错误码与阶段（TB-77；阶段取后端清单行与详情里的 lastErrorPhase，即 kernel.plugin_failed 的 details.phase，
 * rulings §4.25 TB-119）；被拒写「—（不进入会话）」，已声明写「—（校验尚未完成）」
 */
function Failures24h({ api, p }: { api: AdminApi; p: AdminPlugin }) {
  const status = api.statusOf(p)
  if (isRejected(status)) return <span className="text-(--v3-text-2)">—（不进入会话）</span>
  if (status === "declared") return <span className="text-(--v3-text-2)">—（校验尚未完成）</span>
  const n = p.failures ?? 0
  if (!n || !p.lastError) return <span className="tabular-nums">{n}</span>
  return (
    <span>
      <span className="font-semibold tabular-nums">{n} 个会话</span>
      <span className="text-(--v3-text-2)"> · 最近错误码 </span>
      <Code>{p.lastError.code}</Code>
      <span className="text-(--v3-text-2)">（阶段：{p.lastError.phase === "activate" ? "启动" : "贡献"}）</span>
    </span>
  )
}

/** 信任来源：内置 / 签名公钥指纹 / 审核记录 / 未签名（M4 非生产放行时警告色盾牌）。正常态图标不着色（DS-41） */
function TrustLine({ p }: { p: AdminPlugin }) {
  const t = p.trust
  const text = p.unsignedAllowed ? "未签名 · 非生产部署允许（`plugins.allowUnsigned`）" : trustText(t)
  const Icon = t.kind === "builtin" ? PackageCheck : t.kind === "signature" ? BadgeCheck : t.kind === "review" ? ClipboardCheck : ShieldAlert
  const warn = t.kind === "unsigned"
  return (
    <p className="flex items-start gap-2 text-[12px] leading-[18px] text-(--v3-text)">
      <span className="flex h-[18px] shrink-0 items-center">
        <Icon size={14} strokeWidth={1.5} aria-hidden="true" className={warn ? (p.unsignedAllowed ? "text-(--v3-warning)" : "text-(--v3-danger)") : "text-(--v3-text-2)"} />
      </span>
      <span className="min-w-0">
        <Rich text={text} />
      </span>
    </p>
  )
}

/** 依赖 / 被依赖 / 互斥的一小块：左列 48 的标签，右列逐行（图标 20 · 名称 + 说明 · 对方当前策略）；空时一句 */
function RelBlock({ label, empty, children }: { label: string; empty: string; children: ReactNode[] }) {
  const items = children.filter(Boolean)
  return (
    <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-3 text-[12px] leading-4">
      <span className="pt-0.5 text-(--v3-text-2)">{label}</span>
      {items.length ? <ul className="flex flex-col gap-2">{items}</ul> : <span className="pt-0.5 text-(--v3-text-2)">{empty}</span>}
    </div>
  )
}

function RelRow({ api, q, children }: { api: AdminApi; q: AdminPlugin; children: ReactNode }) {
  const s = api.statusOf(q)
  return (
    <li className="flex items-start gap-2">
      <Tile icon={q.icon} size={20} dim={isInactive(s) || api.policyOf(q) === "disabled"} />
      <div className="min-w-0 flex-1">
        <p className="text-(--v3-text)">{q.name}</p>
        <p className="mt-0.5 text-(--v3-text-2)">{children}</p>
      </div>
      <span className="shrink-0 pt-0.5 whitespace-nowrap text-(--v3-text-2)">{isRejected(s) ? "未通过校验" : s === "declared" ? "校验中" : POLICY_LABEL[api.policyOf(q)]}</span>
    </li>
  )
}

const Aside = ({ children }: { children: ReactNode }) => <span className="mr-1.5 text-[12px] leading-4 font-normal text-(--v3-text-2)">{children}</span>
const Empty = ({ children }: { children: ReactNode }) => <p className="text-[12px] leading-4 text-(--v3-text-2)">{children}</p>
