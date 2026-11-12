import { useEffect, useRef, type ReactNode } from "react"
import { ArrowUpRight, ChevronDown, Cpu, Keyboard, LoaderCircle, Lock, ShieldCheck, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, goToState, hasCjk, ICON, IconButton, InspectorNotice, LoadingRow, PanelState, Switch, Tag, Tip } from "../../kit"
import { Note, Nowrap, PluginTile, SI, StatusIcon, StatusText } from "./bits"
import { CONFLICTS, CORE, DIAGNOSTICS, findPlugin, HOST_VERSION, MISSING, MISSING_REASON, PHASE_LABEL, sourceLabel, type MissingEntry, type PluginInfo, type SessionStatus } from "./data"
import { usePlugins, type PluginsApi } from "./store"

/**
 * 个人插件面板的内容（03-09 §2–§7）：对话框（推荐）与检查器整栏面板（备选）共用同一份，compact 时按 400 宽排（版本与来源并到第二行、说明进详情）。
 * 结构：计数行 → 本文档缺少的插件（仅缺插件时）→ 我的界面插件（M3，个人开关）→ 本部署统一启用（只读，「由管理员统一」）；空分组连标题一起隐藏。
 * v3 画法：分组之间不套卡片（对话框 / 整栏就是唯一的一层）；行与行之间不画线，靠图标与行距分行，悬停铺 panel-2 浅底（圆角 6、左右内缩 8，
 * 与快捷键冲突的当前项同一个形状）；组与组之间（从第二组起）在组顶部画一条贴边的 1px 分隔（标杆对照「密度：行间分隔线」，同分享、版本历史的列表）。
 * 行距不变（55：行高 54 + 列表行间 1px）。展开详情是同一行里缩进的键值表，不另铺浅底卡片；
 * 状态不只靠颜色（PM-16），正常态不着色（Q3）；贡献与能力声明用等宽文字列出，不画胶囊（Q4）。
 */
export function PluginPanelBody({ compact = false }: { compact?: boolean }) {
  const api = usePlugins()
  const { ui, data } = api
  if (ui.load === "loading") return <LoadingList />
  if (ui.load === "error")
    return (
      <ErrorState
        onRetry={() => {
          api.set({ load: null })
          // 「重试」随错误态卸载：焦点交给列表区（可聚焦的滚动区），不落回对话框本身
          requestAnimationFrame(() => document.querySelector<HTMLElement>('[role="region"][aria-label="插件列表"]')?.focus({ preventScroll: true }))
        }}
      />
    )
  const conflict = data.pConflict ? CONFLICTS[data.pConflict] : null
  // 组与组之间的分隔从第二组起画（第一组紧跟计数行，不画）：按实际出现的分组算
  const groups = [data.pMissing && "missing", api.mine.length > 0 && "mine", "deploy"].filter(Boolean)
  const divided = (g: string) => groups.indexOf(g) > 0
  return (
    // break-keep：中文只在标点与空格处换行，不把「界面插件」「管理员」这类词断在两行（Q7）
    <div className="flex min-h-full flex-col pb-3 break-keep">
      {/* 重试、开关、复制的结果经 polite 区域播报（PM-16）；可见的反馈在对话框底栏 / 整栏面板形态的轻提示里 */}
      <p className="sr-only" aria-live="polite">
        {liveText(api)}
      </p>
      {conflict && <ConflictBand api={api} />}
      {data.pNoOptional && (
        <div className="flex items-start gap-2 border-b border-(--v3-border) px-4 py-2.5 text-[12px] leading-[18px] text-(--v3-text-2)">
          <span className="flex h-[18px] shrink-0 items-center">
            <Lock {...ICON} aria-hidden="true" />
          </span>
          <p>可选插件由管理员设置：本部署目前没有开放给个人开关的插件</p>
        </div>
      )}
      <Counts api={api} />
      {data.pMissing && (
        <Group id="pl-missing" title="本文档缺少的插件" count={MISSING.length} divided={divided("missing")} note="相关内容以占位显示、数据原样保留；可选中、移动、删除，不能编辑内部">
          {MISSING.map((m) => (
            <MissingRow key={m.id} entry={m} admin={api.admin} compact={compact} />
          ))}
        </Group>
      )}
      {api.mine.length > 0 && (
        <Group id="pl-mine" title="我的界面插件" count={api.mine.length} tag="M3" divided={divided("mine")} note={data.pM2 ? "开关在 M3 提供；现在可以查看状态、诊断信息与重试" : "只影响你自己；切换即时生效，随账号保存"}>
          {api.mine.map((p) => (
            <PluginRow key={p.id} api={api} plugin={p} compact={compact} mine highlight={conflict?.pluginId === p.id} />
          ))}
        </Group>
      )}
      <Group
        id="pl-deploy"
        title="本部署统一启用"
        divided={divided("deploy")}
        count={api.deploy.length + CORE.length}
        badge={
          <span className="inline-flex items-center gap-1 text-[12px] leading-4 text-(--v3-text-2)">
            <Lock {...SI} />
            由管理员统一
          </span>
        }
        note="会影响文档内容或渲染的插件，所有协作者一致；个人不能关闭"
      >
        {api.deploy.map((p, i) => (
          <DeploySlot key={p.id} before={i === api.problems ? <CoreRow api={api} compact={compact} /> : null}>
            <PluginRow api={api} plugin={p} compact={compact} highlight={conflict?.pluginId === p.id} />
          </DeploySlot>
        ))}
      </Group>
    </div>
  )
}

function DeploySlot({ before, children }: { before: ReactNode; children: ReactNode }) {
  return (
    <>
      {before}
      {children}
    </>
  )
}

/* ------------------------------------------------------------------ 计数行（03-09 §2.1） */

function Counts({ api }: { api: PluginsApi }) {
  const rows = [...api.deploy, ...api.mine.filter((p) => api.ui.mine[p.id])]
  const n = (...st: SessionStatus[]) => rows.filter((p) => st.includes(api.statusOf(p))).length
  // 顺序固定：运行中 → 启动失败 → 等待依赖 → 版本不兼容 → 未加载；只列非零项；运行中把核心组件的 4 个成员算在内
  // 状态色只给图标（rulings §4.25 DS-41）：计数一律 text-2；启动失败、版本不兼容前面是与行内同一个危险色图标
  const items: { label: string; value: number; icon?: SessionStatus }[] = [
    { label: "运行中", value: n("running") + CORE.length },
    { label: "启动失败", value: n("failed", "retrying"), icon: "failed" as const },
    { label: "等待依赖", value: n("pending") },
    { label: "版本不兼容", value: n("incompatible"), icon: "incompatible" as const },
    { label: "未加载", value: n("lazy") },
  ].filter((x) => x.value > 0)
  // 分隔点挂在前一项的末尾（同一行时与挂在后一项开头的间距相同）：400 宽的整栏形态里计数行折行时，「·」留在上一行末尾，新行不以「·」开头
  const more = (i: number) => i < items.length - 1 || api.readOnly
  return (
    <div className="flex min-h-7 flex-wrap items-center gap-x-1.5 gap-y-1 px-4 pt-3 pb-1 text-[12px] leading-4 text-(--v3-text-2)">
      {items.map((x, i) => (
        <span key={x.label} className="inline-flex items-center whitespace-nowrap">
          {x.icon && (
            <span className="mr-1 inline-flex">
              <StatusIcon status={x.icon} />
            </span>
          )}
          {x.label}&nbsp;<span className="tabular-nums">{x.value}</span>
          {more(i) && <span aria-hidden="true" className="ml-1.5 text-(--v3-text-2)">·</span>}
        </span>
      ))}
      {api.readOnly && <span className="whitespace-nowrap">只读：编辑类命令不可用</span>}
      {api.admin && <AdminLink className="ml-auto -my-1" />}
    </div>
  )
}

/**
 * 「去管理 › 插件」（只给平台管理员，PM-10「管理员在编辑器里仍是普通用户」）：跳 /admin/plugins（03-32，第 3 批）。不用强调色链接（Q3），用 ghost 文字按钮。
 * 整个面板只有这一处文字入口，在计数行右端（03-09 §2.1；missing-detail 等管理员视角的状态都在这里）：失败行原来另有一颗同名同去处的按钮（failed-admin 同一对话框出现两次），
 * 按质量门 Q2（同一操作只留一个入口）去掉，失败行改用逐个插件的深链 AdminDeepLink（离问题最近，与「本文档缺少的插件」行尾同一画法；第 2 轮评审 1.12）
 */
function AdminLink({ className }: { className?: string }) {
  return (
    <Button variant="ghost" className={cn("px-2", className)} onClick={() => goAdmin()}>
      <ShieldCheck {...ICON} aria-hidden="true" />
      去管理 › 插件
    </Button>
  )
}

/**
 * 去管理页（第 3 批 admin-plugins 场景，宿主 #/v3/admin/plugins；rulings §4.25 TB-76，第 3 批转正时接上 kitRequest g5 K2，只接行为、画面不变）：
 * 总入口进清单（admin-plugins.default）；给了插件 id 时带 &plugin=<id>——部署里有这个插件就打开它的详情抽屉，没有就把 id 填进搜索框。
 * id 用 cordis 插件 id（TA-5、TB-121）：个人插件面板的数据就是插件 id（2026-10-22 起与管理页同一份，data.ts），原样带上（model-slide、ooxml-pptx 是 @cordexjs/…，不能去前缀）
 */
export function goAdmin(pluginId?: string) {
  goToState("admin/plugins", "admin-plugins.default", pluginId ? { plugin: pluginId } : {}, { carry: true })
}

/** 平台管理员：直达管理页里这个插件的详情（24px 深链图标，读屏名「在管理页查看「〈插件名〉」」）；计数行的「去管理 › 插件」是总入口，这里是逐个插件的深链 */
function AdminDeepLink({ name, pluginId, className }: { name: string; pluginId: string; className?: string }) {
  return (
    <IconButton label={`在管理页查看「${name}」`} size={24} className={className} onClick={() => goAdmin(pluginId)}>
      <ArrowUpRight {...ICON} />
    </IconButton>
  )
}

/* ------------------------------------------------------------------ 分组 */

/**
 * 分组：标题 · 计数 · 标记 · 说明，下面是行。divided（从第二组起）：组顶部一条贴边的 1px 分隔（section 本身不缩进，线横贯对话框 / 整栏），
 * 线下留 16（pt-4，即原来组间的 mt-4）；行与行之间不画线，列表行间 1px 透明间隔让行距保持 55（行高 54）
 */
function Group({ id, title, count, tag, badge, note, divided, children }: { id: string; title: string; count: number; tag?: string; badge?: ReactNode; note?: string; divided?: boolean; children: ReactNode }) {
  return (
    <section aria-labelledby={id} data-plugin-group={id} className={divided ? "border-t border-(--v3-border) pt-4" : "mt-4"}>
      <div className="flex min-h-5 flex-wrap items-center gap-x-1.5 px-4">
        <h2 id={id} className="text-[12px] leading-4 font-semibold text-(--v3-text)">
          {title}
        </h2>
        <span className="text-[12px] leading-4 text-(--v3-text-2) tabular-nums">{count}</span>
        {tag && <Tag>{tag}</Tag>}
        {badge && <span className="ml-1">{badge}</span>}
      </div>
      {note && <p className="mt-0.5 px-4 text-[12px] leading-4 text-(--v3-text-2)">{note}</p>}
      <ul className="mt-1.5 flex flex-col gap-px">{children}</ul>
    </section>
  )
}

/** 一行的外形（插件行、核心组件行、缺少插件行共用）：左右内缩 8、圆角 6、上下 10；悬停铺 panel-2，当前项（快捷键冲突）铺强调色淡底。行间不画线 */
const ROW_BOX = "rounded-[6px] px-2 py-2.5 transition-colors"
const rowTone = (highlight?: boolean) => (highlight ? "bg-(--v3-accent-soft)" : "hover:bg-(--v3-panel-2)")

/* ------------------------------------------------------------------ 插件行（03-09 §3.1、§4） */

function PluginRow({
  api,
  plugin: p,
  compact,
  mine,
  highlight,
}: {
  api: PluginsApi
  plugin: PluginInfo
  compact: boolean
  /** 我的界面插件（有开关） */
  mine?: boolean
  /** 快捷键冲突的相关插件：当前项的画法（强调色淡底、圆角 6、左右内缩 8，同保真报告的当前项），进入时滚进视区 */
  highlight?: boolean
}) {
  const { ui, data } = api
  const raw = api.statusOf(p)
  const retrying = raw === "retrying"
  // 重试中这一行仍是「启动失败」，按钮自己显示 spinner +「重试中…」（03-09 §4.1）
  const status: SessionStatus = retrying ? "failed" : raw
  const busy = ui.retrying !== null
  const diag = DIAGNOSTICS[p.id]
  const expanded = ui.expanded.includes(p.id)
  const on = !!ui.mine[p.id]
  const conflict = data.pConflict ? CONFLICTS[data.pConflict] : null
  const differs = mine && on !== (p.userDefault === "on")
  const lead = mine ? `管理员默认${p.userDefault === "on" ? "开" : "关"}${differs ? ` · 你已${on ? "开启" : "关闭"}` : ""}` : p.scope === "ui" && !p.scopeUpgraded ? "强制启用的界面插件" : null
  const meta = `${p.version} · ${sourceLabel(p)}`
  const subtitle = compact ? [lead, meta].filter(Boolean).join(" · ") : [lead, p.description].filter(Boolean).join(" · ")
  const busyReason = busy && !retrying ? "正在重试另一个插件" : undefined
  // 内容级失败行给平台管理员的深链（与「本文档缺少的插件」行尾同一个 24px 图标，见 AdminDeepLink）
  const adminDeep = status === "failed" && !mine && api.admin
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (highlight) return scrollToCenter(ref.current)
  }, [highlight])

  return (
    // data-plugin-row：重试完成后「重试中…」按钮随失败态卸载，焦点交给这一行的开关或「展开详情」（不落回对话框本身）
    <li ref={ref} data-plugin-row={p.id} className="px-2">
      {/*
        三列网格：图标 · 内容 · 右侧（状态、开关、展开）。DOM 顺序 = 名称与副标题 → 右侧控件 → 说明、操作与详情，
        Tab 先到同一行右上角的开关与「展开详情」，再往下到「重试 / 为我关闭」与详情里的按钮（与阅读顺序一致）；视觉位置不变。
      */}
      <div className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3", ROW_BOX, rowTone(highlight))}>
        <div className="row-span-2 self-start">
          <PluginTile icon={p.icon} size={compact ? 28 : 32} dim={status === "off"} />
        </div>
        <div className="col-start-2 row-start-1 min-w-0">
          <div className="flex min-h-4 flex-wrap items-center gap-x-1.5">
            <span className={cn("text-[12px] leading-4 font-medium", status === "off" ? "text-(--v3-text-2)" : "text-(--v3-text)")}>{p.name}</span>
            {!compact && <span className="text-[12px] leading-4 text-(--v3-text-2)">{meta}</span>}
            {p.scopeUpgraded && <ScopeMark />}
          </div>
          {subtitle && <p className="mt-0.5 text-[12px] leading-4 text-(--v3-text-2)">{subtitle}</p>}
        </div>

        <div className="col-start-3 row-span-2 row-start-1 flex h-8 items-center gap-2 self-start">
          <StatusText status={status} />
          {adminDeep && <AdminDeepLink name={p.name} pluginId={p.id} />}
          {mine && (
            <Switch
              checked={on}
              label={`${p.name}，个人设置，只影响你`}
              disabled={!!data.pM2 || busy}
              reason={data.pM2 ? "M3 提供" : busy ? "重试进行中" : undefined}
              onChange={(v) => api.toggleMine(p, v)}
            />
          )}
          <ExpandButton name={p.name} expanded={expanded} onClick={() => api.toggleExpanded(p.id)} />
        </div>

        <div className="col-start-2 row-start-2 min-w-0">
          {/* 状态说明行：直接写原因（状态名与图标已在右侧的状态里，不重复；与启动失败行的写法一致） */}
          {status === "pending" && (
            <Note className="mt-1.5">
              {p.waitsFor ? <><Nowrap>「{p.waitsFor}」</Nowrap>已被管理员停用</> : "依赖的服务尚未就绪"}；依赖恢复后自动启动，无需重试
            </Note>
          )}
          {status === "incompatible" && (
            <Note className="mt-1.5">
              需要宿主 {p.hostRange}，当前 {HOST_VERSION}；无法重试，{api.admin ? "请在管理页查看" : "如需使用请联系管理员"}
            </Note>
          )}
          {status === "failed" && diag && (
            <Note tone="text" className="mt-1.5">
              {diag.summary}
            </Note>
          )}
          {api.readOnly && p.writeCommands && (
            <Note icon={<Lock {...SI} />} className="mt-1.5">
              编辑类命令不可用（你只有查看权限）
            </Note>
          )}
          {highlight && conflict && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <Note tone="warning" icon={<TriangleAlert {...SI} />}>
                <span className="text-(--v3-text)">
                  与内置<Nowrap>「{conflict.builtin}」</Nowrap>冲突（{conflict.key}）
                </span>
              </Note>
              {conflict.userCanTurnOff ? (
                <Button variant="secondary" disabled={!on} reason={!on ? "已为你关闭" : undefined} onClick={() => api.toggleMine(p, false)}>
                  为我关闭
                </Button>
              ) : (
                <span className="text-[12px] leading-4 text-(--v3-text-2)">请联系管理员</span>
              )}
            </div>
          )}

          {/*
            启动失败：本会话重试（任何用户）+ 为我关闭（界面级可选）/ 说明（内容级、强制启用：普通用户「请联系管理员」，
            平台管理员「请在管理页查看」——同版本不兼容行的管理员写法；去处是计数行的「去管理 › 插件」或行尾的深链）
          */}
          {status === "failed" && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button variant="secondary" disabled={busy} reason={retrying ? undefined : busyReason} aria-busy={retrying || undefined} onClick={() => api.retry(p)}>
                {retrying && <LoaderCircle {...SI} className="motion-safe:animate-spin" />}
                {retrying ? "重试中…" : "重试"}
              </Button>
              {mine ? (
                <Button variant="secondary" disabled={busy} reason={busyReason} onClick={() => api.toggleMine(p, false)}>
                  为我关闭
                </Button>
              ) : (
                <span className="text-[12px] leading-4 text-(--v3-text-2)">仅在本会话重试；如持续失败，{api.admin ? "请在管理页查看" : "请联系管理员"}</span>
              )}
            </div>
          )}

          {expanded && <Details api={api} plugin={p} status={status} compact={compact} />}
        </div>
      </div>
    </li>
  )
}

function ExpandButton({ name, expanded, onClick }: { name: string; expanded: boolean; onClick: () => void }) {
  return (
    <IconButton label={expanded ? `收起「${name}」详情` : `展开「${name}」详情`} size={24} aria-expanded={expanded} onClick={onClick} className="-mr-1">
      <ChevronDown {...ICON} className={cn("transition-transform", expanded && "rotate-180")} />
    </IconButton>
  )
}

/**
 * 作用域徽标「内容级 · 部署指定」：部署声明文件把界面级升为内容级（03-09 §3）。
 * 徽标 18 高、标题行 16 高：上下各收 1px（-my-px）不撑高行盒，这一行与同组其余行同为 54 高、行距 55（标杆对照的样张修改第 9 处）
 */
function ScopeMark() {
  return (
    <Tip label="插件声明为界面级，部署声明文件把它升为内容级：全员统一，个人不能关闭" lines={["插件声明为界面级，部署声明文件把它升为内容级：", "全员统一，个人不能关闭"]}>
      <span tabIndex={0} className="-my-px inline-flex rounded-[4px]">
        <Tag>内容级 · 部署指定</Tag>
      </span>
    </Tip>
  )
}

/** 展开详情（03-09 §3.1）：贡献、能力声明（仅展示，PS-13）；启动失败另列错误码、阶段（TB-77）、traceId 与「复制诊断信息」（复制四行：插件 id、错误码、阶段、traceId，TB-96）。说明行已完整写出摘要，详情不再重复 */
function Details({ api, plugin: p, status, compact }: { api: PluginsApi; plugin: PluginInfo; status: SessionStatus; compact: boolean }) {
  const diag = status === "failed" ? DIAGNOSTICS[p.id] : undefined
  return (
    <div className="mt-2.5">
      <dl className="grid grid-cols-[56px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12px] leading-4">
        {compact && (
          <>
            <dt className="text-(--v3-text-2)">说明</dt>
            <dd className="text-(--v3-text)">{p.description}</dd>
          </>
        )}
        <dt className="text-(--v3-text-2)">贡献</dt>
        <dd className="flex flex-wrap gap-x-3 gap-y-1">
          {p.contributes.map((c) => (
            <Code key={c}>{c}</Code>
          ))}
        </dd>
        <dt className="text-(--v3-text-2)">能力声明</dt>
        <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {p.capabilities?.length ? p.capabilities.map((c) => <Code key={c}>{c}</Code>) : <span className="text-(--v3-text)">未声明</span>}
          <span className="text-(--v3-text-2)">（仅展示）</span>
        </dd>
        {diag && (
          <>
            <dt className="text-(--v3-text-2)">错误码</dt>
            <dd>
              <Code>{diag.code}</Code>
            </dd>
            {/* 启动与贡献失败同一个码（kernel.plugin_failed，30/10），阶段另写一行（details.phase，rulings §4.25 TB-77） */}
            <dt className="text-(--v3-text-2)">阶段</dt>
            <dd className="text-(--v3-text)">{PHASE_LABEL[diag.phase]}</dd>
            <dt className="text-(--v3-text-2)">traceId</dt>
            <dd className="break-all">
              <Code>{diag.traceId}</Code>
            </dd>
          </>
        )}
      </dl>
      {diag && (
        <Button variant="secondary" className="mt-2" onClick={() => api.copyDiag(p, diag)}>
          复制诊断信息
        </Button>
      )}
    </div>
  )
}

/** 代码串（贡献点 id、能力、错误码）：等宽、11px（只有西文）；含中文的（「实现 store」）用 12px 正文字体 */
function Code({ children }: { children: string }) {
  return hasCjk(children) ? (
    <span className="whitespace-nowrap text-(--v3-text)">{children}</span>
  ) : (
    <code className="font-mono text-[11px] leading-4 whitespace-nowrap text-(--v3-text)">{children}</code>
  )
}

/** 核心组件合并为一行（03-09 §3）：副标题列出成员，展开后逐行 id@版本 */
function CoreRow({ api, compact }: { api: PluginsApi; compact: boolean }) {
  const expanded = api.ui.expanded.includes("core")
  return (
    <li className="px-2">
      <div className={cn("flex gap-3", ROW_BOX, rowTone())}>
        <PluginTile icon={Cpu} size={compact ? 28 : 32} />
        <div className="min-w-0 flex-1">
          <div className="flex min-h-4 items-center gap-x-1.5">
            <span className="text-[12px] leading-4 font-medium text-(--v3-text)">核心组件</span>
            <span className="text-[12px] leading-4 text-(--v3-text-2)">{CORE.length} 个 · 内置</span>
          </div>
          <p className="mt-0.5 text-[12px] leading-4 text-(--v3-text-2)">{CORE.map((p) => p.name).join("、")}</p>
          {expanded && (
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {CORE.map((p) => (
                <li key={p.id} className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-3 text-[12px] leading-4">
                  <span className="text-(--v3-text)">{p.name}</span>
                  <Code>{`${p.id}@${p.version}`}</Code>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex h-8 shrink-0 items-center gap-2">
          <StatusText status="running" />
          <ExpandButton name="核心组件" expanded={expanded} onClick={() => api.toggleExpanded("core")} />
        </div>
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ 本文档缺少的插件（03-09 §6.3） */

function MissingRow({ entry: m, admin, compact }: { entry: MissingEntry; admin: boolean; compact: boolean }) {
  const known = findPlugin(m.id)
  const need = m.reason === "version" ? `需要 ≥ ${m.need}，当前 ${m.have ?? known?.version}` : `需要 ≥ ${m.need}`
  return (
    <li className="px-2">
      <div className={cn("flex gap-3", ROW_BOX, rowTone())}>
        <PluginTile icon={m.icon} size={compact ? 28 : 32} dim />
        <div className="min-w-0 flex-1">
          <div className="flex min-h-4 flex-wrap items-center gap-x-1.5">
            <span className="text-[12px] leading-4 font-medium text-(--v3-text)">{m.name}</span>
            <code className="font-mono text-[11px] leading-4 whitespace-nowrap text-(--v3-text-2)">{m.id}</code>
          </div>
          {/* 启用、升级都在部署与管理员侧完成，本分组不提供操作按钮（03-09 §6.3）：普通用户在说明末尾写「请联系管理员」 */}
          <p className="mt-0.5 text-[12px] leading-4 text-(--v3-text-2)">
            {need} · {m.count} 处内容以占位显示 · {m.pages}
            {admin ? "" : " · 请联系管理员"}
          </p>
        </div>
        <div className="flex h-8 shrink-0 items-center gap-1">
          <span className="inline-flex items-center gap-1 text-[12px] leading-4 whitespace-nowrap text-(--v3-text)">
            <TriangleAlert {...SI} className="text-(--v3-warning)" />
            {MISSING_REASON[m.reason]}
          </span>
          {/* 平台管理员：直达管理页里这个插件的详情（计数行的「去管理 › 插件」是总入口，这里是逐个插件的深链） */}
          {admin && <AdminDeepLink name={m.name} pluginId={m.id} className="-mr-1" />}
        </div>
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ 快捷键冲突的说明块（03-09 §4.4） */

function ConflictBand({ api }: { api: PluginsApi }) {
  const c = CONFLICTS[api.data.pConflict ?? "user"]
  const p = findPlugin(c.pluginId)
  return (
    // 面板 / 对话框里的状态说明一律是 kit InspectorNotice（面板底、1px 下分隔；与分享离线说明同一画法），状态色只给键盘图标；
    // 常驻在内容区顶部（sticky）：高亮行滚到中间时说明仍在眼前
    <div className="sticky top-0 z-[1] bg-(--v3-panel)">
      <InspectorNotice icon={<Keyboard {...ICON} aria-hidden="true" className="text-(--v3-warning)" />}>
        <div className="text-(--v3-text)">
        <p className="font-semibold">快捷键冲突：{c.key}</p>
        <p>
          内置<Nowrap>「{c.builtin}」</Nowrap>与插件<Nowrap>「{p?.name}」</Nowrap>绑定了同一快捷键，当前由内置命令生效。
          {c.userCanTurnOff ? (
            <>
              <Nowrap>「{p?.name}」</Nowrap>是你的界面插件，可以为你关闭。
            </>
          ) : (
            <>
              <Nowrap>「{p?.name}」</Nowrap>由管理员统一启用，个人不能关闭；如需调整，请联系管理员。
            </>
          )}
        </p>
        </div>
      </InspectorNotice>
    </div>
  )
}

/* ------------------------------------------------------------------ 空、加载、错误（03-09 §7） */

/**
 * 加载中（第 2 批统一：不画灰色骨架条，Q8）：整块还没有内容，kit LoadingRow 居中「插件列表加载中…」，与评论、版本历史、分享的加载行同一件；
 * 对话框各状态同一个固定高度（PluginsDialogHost 的 DIALOG_HEIGHT：720，视口不够时视口高减 64），内容在框内居中，加载前后框体不动。
 */
function LoadingList() {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col justify-center">
      <LoadingRow center>插件列表加载中…</LoadingRow>
    </div>
  )
}

/** 面板本身加载失败（03-09 §7）：kit PanelState（与版本历史、插件整页面板的出错态同一画法）；对话框同高、在框内居中 */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col justify-center">
    <PanelState
      title="插件列表加载失败"
      action={
        <Button variant="secondary" onClick={onRetry}>
          重试
        </Button>
      }
    >
      编辑器本身不受影响；已装配的插件照常运行
    </PanelState>
    </div>
  )
}

/* ------------------------------------------------------------------ 反馈文案（对话框底栏、轻提示与 polite 播报共用） */

export function feedbackText(api: PluginsApi): { title: string; description?: string; undo?: boolean; tone?: "success" | "error" } | null {
  const f = api.ui.feedback
  if (!f) return null
  const name = findPlugin(f.id)?.name ?? ""
  if (f.kind === "toggle") return { title: `已为你${f.on ? "开启" : "关闭"}「${name}」`, description: "立即生效，只影响你；随账号保存，换设备也沿用", undo: true }
  if (f.kind === "recovered") return { title: `「${name}」已在本会话恢复运行`, tone: "success" }
  // 保存失败（03-09 §5、50/18 PLG-02）：开关回弹到原值、本会话按原值重新装配，写出失败原因；不另给按钮，再拨一次开关即重试
  if (f.kind === "save-failed") return { title: `没能保存「${name}」的设置，已恢复为${f.on ? "开启" : "关闭"}`, description: "网络连接中断；再拨一次开关即可重试", tone: "error" }
  return { title: "已复制诊断信息" }
}

function liveText(api: PluginsApi) {
  const f = api.ui.feedback
  if (api.ui.retrying) return `正在重试「${findPlugin(api.ui.retrying)?.name ?? ""}」`
  if (!f) return ""
  const name = findPlugin(f.id)?.name ?? ""
  if (f.kind === "recovered") return `「${name}」已恢复运行`
  return feedbackText(api)?.title ?? ""
}

/** 高亮行（从快捷键面板进入的冲突插件）不在可视区时，把它滚到面板内容区中间（对话框正文或整栏面板的滚动区） */
function scrollToCenter(el: HTMLElement | null) {
  if (!el) return
  const id = requestAnimationFrame(() => {
    const box = el.closest<HTMLElement>("[data-v3-dialog-body]") ?? el.closest<HTMLElement>(".overflow-y-auto")
    if (!box) return
    const c = box.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    if (r.top >= c.top && r.bottom <= c.bottom) return
    box.scrollTop += r.top - c.top - (c.height - r.height) / 2
  })
  return () => cancelAnimationFrame(id)
}
