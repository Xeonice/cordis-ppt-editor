import { useLayoutEffect, type ReactNode } from "react"
import { ChevronDown, ChevronRight, CircleAlert, CircleHelp, FileCode, Info, Link2, Lock, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, EmptyNote, ICON, LoadingRow, Menu, PanelState, scrollIntoPanel, Segmented, Tip } from "../../kit"
import { Code, Note, Nowrap, Rich, SI, StatusIcon, StatusLabel, Tile } from "./bits"
import {
  CATALOG_FILE, DECLARED_POLICY_TIP, DEPLOY_VERSION, FILTER_ANCHOR, FINGERPRINT, GROUPS, HOST_VERSION, isContentLevel, isInactive, isRejected, LOCK_LABEL, LOCK_REASON, NECESSITY_LABEL, REJECTED_POLICY_TIP, scopeLabel, slug,
  sourceLabel, USER_CHOICE_CONTENT, type AdminPlugin, type DeployStatus, type FilterKey, type Policy, type UserDefault,
} from "./data"
import { useAdmin, type AdminApi } from "./store"

/**
 * 管理 › 插件的主区内容（顶栏与横幅以下，03-32 §3–§6、§8、§11 按 v3 重画）：
 *   元信息一行（部署版本 · 宿主 · 已声明 N 个 · 插件集指纹，TA-10、PM-13）→ 来源说明两行（原来源说明卡，v3 不套卡片，声明文件路径是等宽小签 + 工具提示）
 *   → 筛选（分段：全部 + 各组计数，0 的组不出；危险的两组组名前带同一个危险色图标；右端「状态说明」）→ 清单。
 * 清单是表格语义（role table / rowgroup / row / cell、columnheader，PM-16），不套卡片：表头吸顶，行间不画线，组与组之间一条 1px 分隔（同 03-09 v3 列表）；
 * 行左右内缩 8、圆角 6，悬停铺浅底，打开详情的那一行铺强调色淡底（强调色只给选中，DS-35）。
 * 列：插件（图标 32 · 名称 + 版本 · 来源 · id）· 作用域 · 必需性 · 策略 · 部署状态 · 24 h 失败 · 详情 ›——版本与来源并进名称行（同个人插件面板的插件行；PM-06 只规定每行要有哪些内容），
 * 表格最小宽 916、1280 宽的窗口放得下；只按桌面设计，更窄时筛选与表格在主区里横向滚动（rulings §4.25 TB-119）。
 * 必需性列 88（放得下 40/16 §2 的「契约必需·可换」，TB-121），部署状态列 80（最长「版本不兼容」「未签名被拒」图标 + 5 字 76），总宽不变。
 */
const GRID = "grid grid-cols-[minmax(240px,1fr)_120px_88px_204px_80px_56px_24px] gap-x-4"
const COLS = 7

export function AdminBody() {
  const api = useAdmin()
  return (
    // relative：读屏播报区（sr-only）随内容区定位，不把页面撑出滚动；break-keep：中文只在标点与空格处换行，不把「URL 安装」「重新加载」这类词断在两行（Q6，同第 2 批个人面板）
    <div className="relative pt-6 break-keep">
      <Intro api={api} />
      {api.load === "error" ? (
        <LoadError api={api} />
      ) : (
        // 表格最小宽 916（1280 宽的窗口放得下）；只按桌面设计，更窄时只有筛选与表格横向滚动，页头说明照常按可视宽度换行（TB-119）
        <div className="min-w-[916px]">
          <FilterRow api={api} />
          <PluginTable api={api} />
        </div>
      )}
      {/* 草稿变化、放弃、保存成功经 polite 播报（03-32 §12） */}
      <p className="sr-only" aria-live="polite">
        {api.live}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ 页头说明 */

/**
 * 元信息与来源说明（03-32 §3）：元信息来自清单接口（GET /admin/plugins 的 deploymentVersion、hostApiVersion、fingerprint），清单没到时不显示但留位（不跳动）；
 * 来源说明常驻：界面上不存在「添加插件」，新增、升级、移除都由部署方改声明文件后重新部署（rulings §4.23 裁决 2）。
 */
function Intro({ api }: { api: AdminApi }) {
  const known = api.load === "ready"
  return (
    <div className="flex flex-col gap-2 text-[12px] leading-[18px]">
      <p aria-hidden={!known || undefined} className={cn("text-(--v3-text-2) tabular-nums", !known && "invisible")}>
        部署版本 {DEPLOY_VERSION} · 宿主 {HOST_VERSION} · 已声明 {api.catalog.length} 个 · 插件集指纹 <code className="font-mono text-[11px] text-(--v3-text)">{FINGERPRINT}</code>
      </p>
      <p className="max-w-[880px] break-keep text-(--v3-text-2)">
        <span className="font-medium text-(--v3-text)">插件由部署预置，这里只管启停。</span>
        插件只能经镜像内置或挂载目录 + 声明文件
        <CatalogFile />
        加入本部署，界面不提供上传、<Nowrap>URL 安装</Nowrap>或插件市场；新增、升级或移除插件请由部署方修改声明文件后重新部署。策略变更在新打开的会话中生效，已打开的会话会收到重新加载提示。
      </p>
    </div>
  )
}

/**
 * 声明文件路径：等宽小签（圆角 4，不是药丸）+ 工具提示，可聚焦读出。落在画布底上：panel 底 + 1px 细边（同 kit outline 约定；
 * 亮色 panel-2 底落在画布上几乎看不见，复验 AP-04）
 */
function CatalogFile() {
  return (
    <Tip label="声明文件（配置键 plugins.catalogFile，只读挂载）">
      <span
        tabIndex={0}
        className="mx-1 inline-flex h-[18px] items-center gap-1 rounded-[4px] border border-(--v3-border) bg-(--v3-panel) px-1.5 align-[-4px] font-mono text-[11px] leading-none whitespace-nowrap text-(--v3-text)"
      >
        <FileCode size={12} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />
        {CATALOG_FILE}
      </span>
    </Tip>
  )
}

/* ------------------------------------------------------------------ 筛选 */

const matches = (p: AdminPlugin, q: string) => {
  const s = q.trim().toLowerCase()
  return !s || p.name.toLowerCase().includes(s) || p.id.toLowerCase().includes(s)
}

/** 搜索后可见的行与各组计数（筛选分段与清单共用） */
function useVisible(api: AdminApi) {
  const visible = api.catalog.filter((p) => matches(p, api.query))
  const counts = Object.fromEntries(GROUPS.map((g) => [g.key, visible.filter((p) => g.match(api.statusOf(p))).length])) as Record<string, number>
  return { visible, counts }
}

/**
 * 筛选（03-32 §4.3）：单选分段（radiogroup），全部 + 各组计数，计数为 0 的组不出（当前选中的除外）；启动失败、未通过部署校验两组非零时组名前带与状态同一个危险色图标，计数不着色（DS-41）。
 * 分段项按文字宽度排（不等分）。清单还在加载时这一行留位但不显示（不知道有哪些组，不写计数），布局不跳。右端 ghost「状态说明」打开八种状态的说明弹层。
 */
function FilterRow({ api }: { api: AdminApi }) {
  const { visible, counts } = useVisible(api)
  const loading = api.load === "loading"
  const options = [
    { value: "all" as FilterKey, label: `全部 ${visible.length} 个`, icon: <SegText text="全部" n={visible.length} /> },
    ...GROUPS.filter((g) => counts[g.key]! > 0 || api.filter === g.key).map((g) => ({
      value: g.key as FilterKey,
      label: `${g.label} ${counts[g.key]} 个`,
      icon: <SegText text={g.label} n={counts[g.key]!} status={g.icon && counts[g.key]! > 0 ? g.icon : undefined} />,
    })),
  ]
  return (
    <div aria-hidden={loading || undefined} className={cn("mt-5 flex items-center justify-between gap-4", loading && "invisible")}>
      <div data-v3-anchor={FILTER_ANCHOR}>
        <Segmented role="radiogroup" aria="按状态筛选" value={api.filter} onValueChange={api.setFilter} options={options} className="w-fit [&>button]:flex-none [&>button]:px-2.5" />
      </div>
      <Button variant="ghost" className="-mr-2 px-2" data-v3-anchor="admin-plugins.legend" aria-expanded={api.legend} aria-haspopup="dialog" onClick={() => api.setLegend(!api.legend)}>
        <CircleHelp {...ICON} aria-hidden="true" />
        状态说明
      </Button>
    </div>
  )
}

function SegText({ text, n, status }: { text: string; n: number; status?: DeployStatus }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      {status && <StatusIcon status={status} />}
      {text}
      <span className="font-normal text-(--v3-text-2) tabular-nums">{n}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ 清单 */

function PluginTable({ api }: { api: AdminApi }) {
  const { visible } = useVisible(api)
  const loading = api.load === "loading"
  const groups = GROUPS.filter((g) => api.filter === "all" || api.filter === g.key)
    .map((g) => ({ ...g, items: visible.filter((p) => g.match(api.statusOf(p))) }))
    .filter((g) => g.items.length > 0)
  // 详情、深链、下拉一出现就要看到的那一行：只滚主区自己的滚动区（kit scrollIntoPanel，已在可视区就不动）
  const focusRow = api.data.scrollTo ?? api.detail ?? api.data.menu
  useLayoutEffect(() => {
    if (!focusRow) return
    const el = document.querySelector<HTMLElement>(`[data-admin-row="${CSS.escape(focusRow)}"]`)
    scrollIntoPanel(el, { align: "center", ifNeeded: true })
    // 只在进页时滚一次（深链只读一次，TB-76）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div role="table" aria-label="已声明的插件" aria-busy={loading || undefined} aria-colcount={COLS} className="mt-4 -mx-2">
      <div role="row" className={cn(GRID, "sticky top-0 z-[1] h-8 items-center border-b border-(--v3-border) bg-(--v3-canvas) px-2 text-[12px] leading-4 text-(--v3-text-2)")}>
        <span role="columnheader">插件</span>
        <span role="columnheader">作用域</span>
        <span role="columnheader">必需性</span>
        <span role="columnheader">策略</span>
        <span role="columnheader">部署状态</span>
        <span role="columnheader" className="text-right">
          24 h 失败
        </span>
        <span role="columnheader">
          <span className="sr-only">详情</span>
        </span>
      </div>
      {loading ? (
        <div role="rowgroup">
          <div role="row">
            <div role="cell" aria-colspan={COLS}>
              {/* 加载画法（rulings §4.25 DS-86，DS-53）：超过 300 ms 才出现，表头下居中一行转圈 + 一句话，不画骨架行 */}
              {api.loadingShown && <LoadingRow center>正在加载插件清单…</LoadingRow>}
            </div>
          </div>
        </div>
      ) : groups.length === 0 ? (
        <div role="rowgroup">
          <div role="row">
            <div role="cell" aria-colspan={COLS}>
              {/* 第 3 批搜索无结果统一一种句式「没有与「X」相关的…」（同快捷键面板、命令面板、文档列表，复验 XG-11） */}
              <EmptyNote>
                没有与<Nowrap>「{api.query.trim()}」</Nowrap>相关的插件
              </EmptyNote>
            </div>
          </div>
        </div>
      ) : (
        groups.map((g, i) => (
          <div key={g.key} role="rowgroup" aria-labelledby={`admin-group-${g.key}`} className={cn(i > 0 && "mt-2 border-t border-(--v3-border)")}>
            <div role="row">
              <div role="cell" aria-colspan={COLS} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-2 pt-4 pb-1.5">
                <h2 id={`admin-group-${g.key}`} className="text-[12px] leading-4 font-semibold text-(--v3-text)">
                  {g.label} <span className="font-normal text-(--v3-text-2) tabular-nums">{g.items.length}</span>
                </h2>
                {g.note && (
                  <p className="text-[12px] leading-4 text-(--v3-text-2)">
                    <Rich text={g.note} muted />
                  </p>
                )}
              </div>
            </div>
            {g.items.map((p) => (
              <PluginRow key={p.id} api={api} p={p} />
            ))}
          </div>
        ))
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ 一行 */

function PluginRow({ api, p }: { api: AdminApi; p: AdminPlugin }) {
  const status = api.statusOf(p)
  const inactive = isInactive(status)
  const policy = api.policyOf(p)
  const draft = api.isDraft(p)
  const tint = draft && api.draftStyle === "tint"
  const selected = api.detail === p.id
  const notes = rowNotes(api, p)
  return (
    // 外框只管画法（悬停浅底、选中淡底、圆角 6），没有读屏语义（role none）：里面是这一行的 7 个单元格，行下说明另起紧跟的一行、一个跨 7 列的单元格——
    // 不再把说明当成同一行的第 8 个单元格（那样一行合计 14 列，超过表格的 aria-colcount 7，读屏报列位会错乱，复验 AP-10）
    <div
      role="none"
      data-admin-row={p.id}
      className={cn("relative rounded-[6px] px-2 py-3 transition-colors", selected || tint ? "bg-(--v3-accent-soft)" : "hover:bg-(--v3-card-hover)")}
    >
      {/* DS-95 未采纳的备选（alt-draft-tint）：草稿行铺强调色淡底 + 左侧 2px 强调色竖条（与选中行同一种底，采纳的画法不用） */}
      {tint && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-(--v3-accent)" />}
      <div role="row" className={cn(GRID, "items-start")}>
        <div role="cell" className="flex min-w-0 items-start gap-3">
          <Tile icon={p.icon} onCanvas dim={inactive || policy === "disabled"} />
          <div className="min-w-0">
            <div className="flex min-h-4 flex-wrap items-center gap-x-1.5">
              {/* rulings §4.25 DS-95：名称前 6px 强调色圆点（同「分享」按钮上待处理的圆点，DS-48）+ 版本与来源之后接「· 未保存」，不铺底、不画竖条 */}
              {draft && api.draftStyle === "dot" && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-(--v3-accent)" />}
              <span className="text-[12px] leading-4 font-medium text-(--v3-text)">{p.name}</span>
              {/* 「· 未保存」接在版本与来源后面、同一串（间距与前面的「·」一致） */}
              <span className="text-[12px] leading-4 text-(--v3-text-2)">
                {p.version} · {sourceLabel(p)}
                {draft && " · 未保存"}
              </span>
            </div>
            <p className="mt-0.5">
              <Code muted>{p.id}</Code>
            </p>
          </div>
        </div>
        <div role="cell" className="flex h-8 items-center">
          <ScopeText p={p} />
        </div>
        <div role="cell" className="flex h-8 items-center text-[12px] leading-4 whitespace-nowrap text-(--v3-text-2)">
          {NECESSITY_LABEL[p.necessity]}
        </div>
        <div role="cell" className="flex min-w-0 flex-col items-start gap-1">
          <PolicyControl api={api} p={p} />
        </div>
        <div role="cell" className="flex h-8 items-center">
          <StatusLabel status={status} />
        </div>
        <div role="cell" className="flex h-8 items-center justify-end text-[12px] leading-4 tabular-nums">
          <Failures api={api} p={p} />
        </div>
        <div role="cell" className="flex h-8 items-center justify-end">
          <Tip label="详情">
            <button
              type="button"
              aria-label={`查看「${p.name}」详情`}
              aria-haspopup="dialog"
              aria-expanded={selected}
              data-v3-anchor={detailAnchor(p.id)}
              onClick={() => api.openDetail(p.id)}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-[4px] text-(--v3-text-2) transition-colors hover:bg-(--v3-panel-2) hover:text-(--v3-text) aria-expanded:bg-(--v3-panel-2) aria-expanded:text-(--v3-text)"
            >
              <ChevronRight {...ICON} aria-hidden="true" />
            </button>
          </Tip>
        </div>
      </div>
      {notes.length > 0 && (
        <div role="row">
          <div role="cell" aria-colspan={COLS} className="mt-2 flex flex-col gap-1.5 pl-11">
            {notes}
          </div>
        </div>
      )}
    </div>
  )
}

export const detailAnchor = (id: string) => `admin-plugins.detail-${slug(id)}`
export const policyAnchor = (id: string) => `admin-plugins.policy-${slug(id)}`

/** 作用域：纯文字（一列一样的徽标是噪音）；部署把界面级升为内容级的写「内容级 · 部署指定」，后面一个可聚焦的说明图标（PM-02） */
function ScopeText({ p }: { p: AdminPlugin }) {
  if (!p.scopeUpgraded) return <span className="text-[12px] leading-4 whitespace-nowrap text-(--v3-text-2)">{scopeLabel(p)}</span>
  return (
    <span className="inline-flex items-center gap-1 text-[12px] leading-4 whitespace-nowrap text-(--v3-text-2)">
      {scopeLabel(p)}
      <Tip label="插件声明为界面级，部署声明文件把它升为内容级：全员统一，个人不能关闭" lines={["插件声明为界面级，部署声明文件把它升为内容级：", "全员统一，个人不能关闭"]}>
        <span tabIndex={0} role="img" aria-label="作用域说明：插件声明为界面级，部署声明文件把它升为内容级，全员统一，个人不能关闭" className="inline-flex rounded-[4px]">
          <Info {...SI} className="text-(--v3-text-2)" />
        </span>
      </Tip>
    </span>
  )
}

/** 近 24 h 失败会话数（PM-15）：非零加粗、主文字色（状态色只给图标，DS-41）；被拒与已声明（校验中，TB-119）的插件不进入会话，写「—」 */
function Failures({ api, p }: { api: AdminApi; p: AdminPlugin }) {
  if (isInactive(api.statusOf(p)))
    return (
      <span className="text-(--v3-text-2)">
        <span aria-hidden="true">—</span>
        <span className="sr-only">不适用</span>
      </span>
    )
  const n = p.failures ?? 0
  return <span className={n ? "font-semibold text-(--v3-text)" : "text-(--v3-text-2)"}>{n}</span>
}

/* ------------------------------------------------------------------ 策略控件（03-32 §5） */

const SEG = "w-[204px]"

/**
 * 策略的六种形态（03-32 §5.1 的五种 + rulings §4.24 TA-6 的「视同强制」）：
 * 1. 界面级、未锁定：三段（radiogroup，28 高；DS-35 安静分段）；选「用户选择」后下面多一行「用户默认：开 ▾」。
 * 2. 内容级（含部署指定）：同一三段，「用户选择」留在原位不可用（aria-disabled、可聚焦，工具提示写原因）。
 * 3. 内核必需、契约必需：锁形 +「强制启用 · 核心组件」，没有控件（可聚焦读出原因）。
 * 4. 声明文件 lockPolicy：锁形 +「强制启用 · 部署锁定」。
 * 5. 被拒：「无开关 · 需重新部署」（可聚焦读出原因）。
 * 6. 视同强制：界面级插件被启用中的内容级插件必需注入——「用户选择」「禁用」两段不可用，原因写依赖它的内容级插件。
 * 另：已声明（部署启动时的瞬时状态）同被拒行一样只读，写「校验中」（可聚焦读出原因；rulings §4.25 TB-119）。
 */
function PolicyControl({ api, p }: { api: AdminApi; p: AdminPlugin }) {
  const status = api.statusOf(p)
  if (isRejected(status))
    return (
      <Tip label={REJECTED_POLICY_TIP}>
        <span tabIndex={0} role="img" aria-label={`「${p.name}」没有开关，需重新部署：${REJECTED_POLICY_TIP}`} className="flex h-8 items-center rounded-[4px] text-[12px] leading-4 whitespace-nowrap text-(--v3-text-2)">
          无开关 · 需重新部署
        </span>
      </Tip>
    )
  if (status === "declared")
    return (
      <Tip label={DECLARED_POLICY_TIP}>
        <span tabIndex={0} role="img" aria-label={`「${p.name}」的策略：校验中，${DECLARED_POLICY_TIP}`} className="flex h-8 items-center rounded-[4px] text-[12px] leading-4 whitespace-nowrap text-(--v3-text-2)">
          校验中
        </span>
      </Tip>
    )
  if (p.lock) {
    const why = LOCK_REASON[p.lock]
    return (
      <Tip label={why}>
        <span tabIndex={0} role="img" aria-label={`「${p.name}」强制启用，已锁定：${why}`} className="flex h-8 items-center gap-1 rounded-[4px] text-[12px] leading-4 whitespace-nowrap text-(--v3-text)">
          <Lock {...SI} className="text-(--v3-text-2)" />
          强制启用
          <span className="text-(--v3-text-2)">· {LOCK_LABEL[p.lock]}</span>
        </span>
      </Tip>
    )
  }
  const forcedBy = api.forcedBy(p)
  const forcedWhy = forcedBy.length ? `被内容级插件${forcedBy.map((q) => `「${q.name}」`).join("")}必需注入，视同强制启用` : undefined
  const content = isContentLevel(p)
  const value = api.policyOf(p)
  return (
    <>
      <div className="flex h-8 items-center" data-v3-anchor={policyAnchor(p.id)}>
        <Segmented<Policy>
          role="radiogroup"
          aria={`「${p.name}」的策略`}
          value={value}
          onValueChange={(v) => api.requestPolicy(p, v)}
          className={SEG}
          options={[
            { value: "forced", label: "强制启用", text: "强制启用" },
            { value: "user-choice", label: "允许用户选择", text: "用户选择", disabled: content || !!forcedWhy, reason: content ? USER_CHOICE_CONTENT : forcedWhy },
            { value: "disabled", label: "禁用", text: "禁用", disabled: !!forcedWhy, reason: forcedWhy },
          ]}
        />
      </div>
      {value === "user-choice" && <UserDefaultMenu api={api} p={p} />}
    </>
  )
}

/** 「用户默认：开 ▾」（只在允许用户选择时出现，PM-03）：单选「默认开 / 默认关」，选了即收起，这一行进草稿 */
function UserDefaultMenu({ api, p }: { api: AdminApi; p: AdminPlugin }) {
  const v = api.defaultOf(p)
  return (
    <Menu
      defaultOpen={api.data.menu === p.id}
      label={`「${p.name}」的用户默认值`}
      items={[
        {
          type: "radio",
          id: "user-default",
          label: "用户默认",
          value: v,
          closeOnSelect: true,
          onValueChange: (x) => api.setDefault(p, x as UserDefault),
          options: [
            { value: "on", label: "默认开" },
            { value: "off", label: "默认关" },
          ],
        },
      ]}
      trigger={
        <button
          type="button"
          aria-label={`「${p.name}」的用户默认值：${v === "on" ? "默认开" : "默认关"}`}
          className="-ml-1 inline-flex h-6 items-center gap-0.5 rounded-[4px] px-1 text-[12px] leading-none text-(--v3-text-2) transition-colors hover:bg-(--v3-panel-2) hover:text-(--v3-text) data-[state=open]:bg-(--v3-panel-2) data-[state=open]:text-(--v3-text)"
        >
          用户默认：{v === "on" ? "开" : "关"}
          <ChevronDown size={12} strokeWidth={1.5} aria-hidden="true" />
        </button>
      }
    />
  )
}

/* ------------------------------------------------------------------ 行下说明（03-32 §4.1、§5.3、§5.4、§8） */

/**
 * 行下说明：缩进与名称对齐，12px；状态色只给图标，文字用主文字色或次级文字色（DS-41）。说明直接写原因，状态名与图标已在「部署状态」列，不重复（同第 2 批个人面板）：
 * 启动失败摘要（主文字色）· 等待依赖与「一并启用」· 被拒原因 · 未签名（M4，警告色盾牌）· 视同强制（TA-6）· 互斥（危险色图标，保存条随之阻止）。
 */
function rowNotes(api: AdminApi, p: AdminPlugin): ReactNode[] {
  const out: ReactNode[] = []
  const status = api.statusOf(p)
  if (status === "failed" && p.lastError)
    out.push(
      <Note key="failed" tone="text">
        近<Nowrap> 24 h </Nowrap>有 {p.failures} 个会话启动失败，最近错误码 <Code>{p.lastError.code}</Code>（阶段：{p.lastError.phase === "activate" ? "启动" : "贡献"}）；策略不变，重试由用户在本会话进行
      </Note>,
    )
  if (status === "pending") {
    const { providers, restoring } = api.pendingOn(p)
    const names = providers.map((q) => `「${q.name}」`).join("")
    if (restoring)
      // 与点之前那句同一个开头「依赖的「X」…」（两句在同一位置前后替换，读起来是同一件事的两个阶段）
      out.push(
        <Note key="pending">
          依赖的<Nowrap>{names}</Nowrap>已在草稿里改为强制启用，保存后这一行将从等待依赖恢复
        </Note>,
      )
    else
      out.push(
        <div key="pending" className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Note>
            依赖的<Nowrap>{names}</Nowrap>已停用；它启用后这一行自动恢复
          </Note>
          {providers.some((q) => !isInactive(q.status)) && (
            // 画布底上的次按钮一律 outline（rulings §4.25 TB-128，kit 约定；透明底的 secondary 在亮色画布上几乎看不出按钮，复验 XG-02）
            <Button
              variant="outline"
              onClick={() => {
                // 点了之后这个按钮换成「保存后这一行将从等待依赖恢复」的说明：先把焦点交给同一行策略里选中的那一项（不掉到 body，07 §2.4），变化经 polite 播报
                document.querySelector<HTMLElement>(`[data-v3-anchor="${policyAnchor(p.id)}"] [role=radio][aria-checked=true]`)?.focus({ preventScroll: true })
                api.enableDeps(p)
              }}
            >
              一并启用{names}
            </Button>
          )}
        </div>,
      )
  }
  if (isRejected(status) && p.reject)
    out.push(
      <Note key="reject">
        <Rich text={p.reject} muted />
      </Note>,
    )
  if (p.unsignedAllowed)
    out.push(
      <Note key="unsigned" icon={<ShieldAlert {...SI} className="text-(--v3-warning)" />}>
        未签名：非生产部署允许（<Code muted>plugins.allowUnsigned</Code>）
      </Note>,
    )
  const forcedBy = api.forcedBy(p)
  if (forcedBy.length)
    out.push(
      <Note key="forced" icon={<Link2 {...SI} />}>
        视同强制启用：内容级插件<Nowrap>{forcedBy.map((q) => `「${q.name}」`).join("")}</Nowrap>必需注入它提供的服务，「用户选择」与「禁用」不可用
      </Note>,
    )
  for (const m of api.mutexOf(p))
    out.push(
      <Note key={`mutex-${m.other.id}`} tone="text" icon={<CircleAlert {...SI} className="text-(--v3-danger)" />}>
        {/* 引号里的形状键也是代码串，等宽（同被拒原因「core.mutation「heatmap.setData」」，复验 AP-06） */}
        与<Nowrap>「{m.other.name}」</Nowrap>互斥：都注册 <Code>slide.shapeKind</Code>
        <Nowrap>
          「<Code>{m.key}</Code>」
        </Nowrap>
        ，不能同时启用；保存前请把其中一个设为禁用
      </Note>,
    )
  return out
}

/* ------------------------------------------------------------------ 加载失败 */

/**
 * 加载失败（03-32 §11.2，DS-53）：清单区换成居中的整块状态——危险色图标、标题、说明，「重试」是次按钮；筛选、表头与被拒横幅都不显示（数据未知）。
 * 整块状态落在画布底上，「重试」用 outline（TB-128：画布底上的次按钮一律 outline，与模板库、阻断页一致）
 */
function LoadError({ api }: { api: AdminApi }) {
  return (
    <PanelState
      className="mt-10"
      title="插件清单加载失败"
      action={
        <Button
          variant="outline"
          onClick={() => {
            // 「重试」随出错态卸载：焦点先交给主区（kit 的焦点兜底），不掉到 body；加载完成后清单出现
            document.querySelector<HTMLElement>('main[data-v3-anchor="canvas"]')?.focus({ preventScroll: true })
            api.retryLoad()
          }}
        >
          重试
        </Button>
      }
    >
      管理接口暂时不可用，未做任何更改
    </PanelState>
  )
}
