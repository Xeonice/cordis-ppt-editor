import type { ReactNode } from "react"
import { AppWindow, CircleAlert, FileText, Info, ShieldAlert, TriangleAlert, Undo2, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog, ICON, Tag } from "../../kit"
import { Code, Note, Nowrap, Rich, SI, Tile, WarnBlock } from "./bits"
import { isContentLevel, POLICY_LABEL, scopeLabel, sourceLabel, type AdminPlugin, type Policy, type Trust } from "./data"
import { policyAnchor } from "./PluginTable"
import { useAdmin, type AdminApi } from "./store"

/**
 * 管理页的模态对话框（03-32 §7、50/03 §10.1；尺寸按 v3 三档 sm 360 / md 480）：
 * - 变更确认卡（检查并保存…）：md 480 普通对话框，合并列出本批变更与「影响与生效时机」，一次保存、整批生效或整批失败（PM-07、PM-08）；失败写在底栏（同个人插件面板「对话框里的结果写在底栏」，DS-56）。
 * - 禁用被依赖的插件、首次启用第三方（M4）：点击当下的模态确认，rulings §4.25 TB-120——模态 md 480（PRD PM-16「确认卡为模态对话框」，会波及别的插件，
 *   同第 1 批重置页一类），初始焦点「取消」，主按钮强调色（确认后只进草稿、还能放弃或改回；危险实底留给销毁，09 §3.3）；关闭后焦点回到三段控件（rulings §4.24 TA-2）。
 * - 有草稿时离开：sm 360 确认框「留下 / 仍要离开」，初始焦点在「留下」（rulings §4.25 DS-59；按钮文案同第 2 批离开确认）；离开会丢掉草稿，「仍要离开」是危险实底。
 * 说明文字每句以句号结尾（与第 1、2 批对话框同一口径）。
 */
export function AdminDialogs() {
  const api = useAdmin()
  return (
    <>
      {api.confirm && <ChangeConfirm api={api} />}
      {api.dep && <DepConfirm api={api} />}
      {api.first && <FirstEnable api={api} />}
      {api.leave && <LeaveGuard api={api} />}
    </>
  )
}

/* ------------------------------------------------------------------ 变更确认卡（03-32 §7.1） */

function ChangeConfirm({ api }: { api: AdminApi }) {
  const changes = api.changes
  const n = changes.length
  const err = api.saveError
  const content = changes.filter(isContentLevel)
  const ui = changes.filter((p) => !isContentLevel(p))
  const turnedOn = (p: AdminPlugin) => api.serverPolicyOf(p) === "disabled" && api.policyOf(p) !== "disabled"
  const turnedOff = (p: AdminPlugin) => api.serverPolicyOf(p) !== "disabled" && api.policyOf(p) === "disabled"
  // 依赖连带按最终草稿算、只列净结果（03-32 §13）
  const restored = changes.filter(turnedOn).flatMap((p) => api.dependentsOf(p.id).filter((d) => api.statusOf(d) === "pending" && api.pendingOn(d).restoring).map((d) => ({ dep: d, via: p })))
  const blocked = changes
    .filter(turnedOff)
    .flatMap((p) => api.dependentsOf(p.id).filter((d) => api.statusOf(d) === "enabled" && api.policyOf(d) !== "disabled").map((d) => ({ dep: d, via: p })))
  const itemErrors = err?.kind === "items" ? err.items : {}
  // 412 之后按新载入的原值重算：与新原值相同的项已移出草稿，在列表下写一句是哪几项（底栏只写结论，免得挤在按钮旁换三行）
  const dropped = err?.kind === "conflict" ? err.dropped.map((id) => api.find(id)).filter((p): p is AdminPlugin => !!p) : []
  return (
    <Dialog
      title={`保存 ${n} 项插件变更？`}
      description={<Rich text="同一批变更一起保存：任一项失败则全部不生效。每项写入审计 `plugin.policy_changed`。" />}
      onOpenChange={(v) => !v && api.setConfirm(false)}
      returnFocus="admin-plugins.save"
      // break-keep：中文只在标点与空格处换行（「重新加载」「保留」不断在两行，Q6）
      className="break-keep"
      bodyClassName="flex flex-col gap-4 p-4"
      footerStart={err ? <SaveResult api={api} /> : undefined}
      secondary={{ label: "取消" }}
      primary={{ label: `保存 ${n} 项变更`, onClick: api.save }}
    >
      {err?.kind === "conflict" && dropped.length > 0 && (
        <Note icon={<Info {...SI} />}>
          {dropped.map((p) => `「${p.name}」`).join("")}已被{err.by}改为{dropped.map((p) => POLICY_LABEL[api.serverPolicyOf(p)]).join("、")}，与你的变更相同，不再列出
        </Note>
      )}
      <ul aria-label="本批变更" className="-my-1.5 flex flex-col">
        {changes.map((p) => (
          <li key={p.id} className="flex items-start gap-3 py-1.5">
            <Tile icon={p.icon} size={28} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] leading-4 font-medium text-(--v3-text)">{p.name}</p>
              <p className="mt-0.5 text-[12px] leading-4 text-(--v3-text-2)">
                <ChangeText api={api} p={p} />
              </p>
              {itemErrors[p.id] && (
                // 原因里的代码串（如声明文件的 lockPolicy）用反引号标出、等宽（复验 AP-06）
                <Note tone="text" icon={<CircleAlert {...SI} className="text-(--v3-danger)" />} className="mt-1">
                  <Rich text={itemErrors[p.id]!} />
                </Note>
              )}
            </div>
            <span className="flex h-7 shrink-0 items-center text-[12px] leading-4 text-(--v3-text-2)">{scopeLabel(p)}</span>
          </li>
        ))}
      </ul>
      <section aria-labelledby="admin-impact">
        <h3 id="admin-impact" className="mb-2 text-[12px] leading-4 font-semibold text-(--v3-text)">
          影响与生效时机
        </h3>
        <ul className="flex flex-col gap-2">
          {content.length > 0 && (
            <Impact Icon={FileText} title={`内容级 ${content.length} 项 · 全员统一`}>
              在新打开的文档会话中生效；已打开的会话会在<Nowrap> 60 秒</Nowrap>内收到「重新加载」提示，不会被强制中断
              {content.some(turnedOff) && "；停用后，用到它的文档内容保留、以占位显示"}
            </Impact>
          )}
          {ui.length > 0 && (
            <Impact Icon={AppWindow} title={`界面级 ${ui.length} 项`}>
              在新会话中生效；已为自己关闭或打开它的用户不受默认值变化影响
              {ui.some((p) => api.serverPolicyOf(p) === "user-choice" && api.policyOf(p) === "forced") && "；改为强制启用时，个人选择暂时失效（保留记录）"}
              {/* 与强制启用那句对称（PM-03；TB-120）：禁用后自己打开过它的用户同样失去它 */}
              {ui.some(turnedOff) && "；改为禁用时，所有人都不再装配，个人选择暂时失效（保留记录）"}
            </Impact>
          )}
          {restored.map(({ dep, via }) => (
            <Impact key={dep.id} Icon={Undo2} tone="success" title={`「${dep.name}」将从等待依赖恢复`}>
              它依赖的<Nowrap>「{via.name}」</Nowrap>随本次保存启用
            </Impact>
          ))}
          {blocked.map(({ dep, via }) => (
            <Impact key={dep.id} Icon={TriangleAlert} tone="warning" title={`「${dep.name}」将进入等待依赖`}>
              它依赖的<Nowrap>「{via.name}」</Nowrap>随本次保存禁用
            </Impact>
          ))}
        </ul>
      </section>
    </Dialog>
  )
}

/** 「原策略 → 新策略」或「用户默认 关 → 开」：箭头对读屏读作「改为」，新值主文字色 500 */
function ChangeText({ api, p }: { api: AdminApi; p: AdminPlugin }) {
  const from = api.serverPolicyOf(p)
  const to = api.policyOf(p)
  const defChanged = api.serverDefaultOf(p) !== api.defaultOf(p) && to === "user-choice"
  const onOff = (v: "on" | "off") => (v === "on" ? "开" : "关")
  return (
    <>
      {from !== to && <Arrow from={POLICY_LABEL[from]} to={POLICY_LABEL[to]} />}
      {from !== to && defChanged && " · "}
      {defChanged && <Arrow from={`用户默认 ${onOff(api.serverDefaultOf(p))}`} to={onOff(api.defaultOf(p))} />}
    </>
  )
}

function Arrow({ from, to }: { from: string; to: string }) {
  return (
    <>
      {from}
      <span aria-hidden="true"> → </span>
      <span className="sr-only">改为</span>
      <span className="font-medium text-(--v3-text)">{to}</span>
    </>
  )
}

/** 影响的一条：16px 图标（中性；恢复用成功色、进入等待依赖用警告色，状态色只给图标，DS-41）+ 粗体标题 + 次级文字，不铺底 */
function Impact({ Icon, tone, title, children }: { Icon: LucideIcon; tone?: "success" | "warning"; title: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[12px] leading-[18px]">
      <span className={cn("flex h-[18px] shrink-0 items-center", tone === "success" ? "text-(--v3-success)" : tone === "warning" ? "text-(--v3-warning)" : "text-(--v3-text-2)")}>
        <Icon {...ICON} aria-hidden="true" />
      </span>
      <p className="min-w-0">
        <span className="font-medium text-(--v3-text)">{title}：</span>
        <span className="text-(--v3-text-2)">{children}</span>
      </p>
    </li>
  )
}

/**
 * 保存的结果写在底栏左侧（确认卡不关；50/03 §10.1、50/02 §8）：
 * network 网络或 5xx——「保存失败，未做任何更改」，再点「保存 N 项变更」即重试 · conflict 412——设置已被其他管理员更新，已重新载入，变更列表按新的原值重算、草稿保留 ·
 * items 422 / 409——出错的那几项在列表里逐项写原因，整批都未生效。
 */
function SaveResult({ api }: { api: AdminApi }) {
  const err = api.saveError
  if (!err) return null
  const n = err.kind === "items" ? Object.keys(err.items).length : 0
  const msg =
    err.kind === "network"
      ? { title: "保存失败，未做任何更改", text: "网络连接中断，可以再试一次", danger: true }
      : err.kind === "conflict"
        ? { title: `设置已被${err.by}更新，已重新载入`, text: "变更已按新的设置重算，请核对后再保存", danger: false }
        : { title: `${n} 项未通过校验，整批都未生效`, text: "按标出的原因调整后再保存", danger: true }
  return (
    <div role={msg.danger ? "alert" : "status"} className="flex min-w-0 items-start gap-2 text-[12px] leading-4">
      {msg.danger ? (
        <CircleAlert {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-danger)" />
      ) : (
        <TriangleAlert {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-warning)" />
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-(--v3-text)">{msg.title}</span>
        <span className="text-(--v3-text-2)">{msg.text}</span>
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ 禁用被依赖的插件（03-32 §7.2） */

function DepConfirm({ api }: { api: AdminApi }) {
  const req = api.dep
  const p = req ? api.find(req.id) : undefined
  if (!req || !p) return null
  const deps = api.liveDependentsOf(p.id)
  // 只有一个依赖方时直接写它的名字（「它」只指被禁用的插件，免得读成被禁用的插件自己进入等待依赖，复验 AP-07）；多个时写「它们」（PRD 原文）
  const lead =
    deps.length === 1
      ? `「${deps[0]!.name}」依赖它，禁用后该插件将进入「等待依赖」，本部署的会话里不再装配。`
      : `${deps.length} 个插件依赖它，禁用后它们将进入「等待依赖」，本部署的会话里不再装配。`
  return (
    <Dialog
      variant="confirm"
      size="md"
      title={`禁用「${p.name}」？`}
      description={lead}
      onOpenChange={(v) => !v && api.setDep(null)}
      // 先落在安全项「取消」（TB-120，DS-40、50/10 规则 3）；关闭后焦点回到这一行的三段控件（TA-2）
      initialFocus="secondary"
      returnFocus={policyAnchor(p.id)}
      className="break-keep"
      bodyClassName="flex flex-col gap-3"
      secondary={{ label: "取消" }}
      // 主按钮强调色（TB-120）：确认后只进草稿，还要经保存条与变更确认卡才生效——危险实底留给销毁（09 §3.3），免得比真正生效的「保存 N 项变更」还重
      primary={{ label: "仍要禁用", onClick: () => api.setPolicy(p, req.to) }}
    >
      <ul aria-label="将进入等待依赖的插件" className="flex flex-col">
        {deps.map((d) => (
          <li key={d.id} className="flex items-center gap-3 py-1.5">
            <Tile icon={d.icon} size={28} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] leading-4 font-medium text-(--v3-text)">{d.name}</p>
              <p className="mt-0.5">
                <Code muted>{d.id}</Code>
              </p>
            </div>
            <span className="shrink-0 text-[12px] leading-4 whitespace-nowrap text-(--v3-text-2)">
              已启用<span aria-hidden="true"> → </span>
              <span className="sr-only">改为</span>
              <span className="text-(--v3-text)">等待依赖</span>
            </span>
          </li>
        ))}
      </ul>
      {p.absence && <WarnBlock title="缺席后果：">{p.absence}</WarnBlock>}
      <p className="text-[12px] leading-[18px] text-(--v3-text-2)">确认后只进入草稿；保存后在新打开的文档会话中生效，已打开的会话会收到重新加载提示。</p>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ 首次启用第三方（03-32 §7.3，M4） */

/** 信任来源的一句话（反引号里是指纹与摘要，bits.tsx Rich 渲染成等宽） */
export const trustText = (t: Trust) =>
  t.kind === "builtin"
    ? "镜像内置 · 随镜像 digest 与 SBOM 受信"
    : t.kind === "signature"
      ? `签名有效 · ${t.vendor} 发布公钥 \`${t.fingerprint}\``
      : t.kind === "review"
        ? `审核记录 · ${t.reviewer} ${t.date} · 钉住 SHA-256 \`${t.sha256}\``
        : "未找到有效签名或审核记录"

function FirstEnable({ api }: { api: AdminApi }) {
  const req = api.first
  const p = req ? api.find(req.id) : undefined
  if (!req || !p) return null
  const signed = p.trust.kind === "signature"
  return (
    <Dialog
      title={`首次启用第三方插件「${p.name}」`}
      description={
        // 标题下：28 图标块 + 一句说明（清单 description，TB-120；同变更确认卡、禁用确认卡列表行的 28 图标块）+ M4 标记，再一行来源 · 版本 · 信任来源
        // （M4 标记接在说明后面：放在第二行行首时，长的信任来源会被挤到下一行、标记独占一行）
        <span className="flex items-start gap-3">
          <Tile icon={p.icon} size={28} />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="text-(--v3-text)">{p.description}</span>
              <Tag>M4</Tag>
            </span>
            <span>
              {sourceLabel(p)} · {p.version} · <Rich text={trustText(p.trust)} muted />
            </span>
          </span>
        </span>
      }
      onOpenChange={(v) => !v && api.setFirst(null)}
      // 初始焦点「取消」（TB-120）；关闭后焦点回到这一行的三段控件（TA-2）
      initialFocus="secondary"
      returnFocus={policyAnchor(p.id)}
      className="break-keep"
      bodyClassName="flex flex-col gap-4 p-4"
      secondary={{ label: "取消" }}
      primary={{ label: "确认启用", onClick: api.confirmFirst }}
    >
      <section aria-labelledby="admin-first-contrib">
        <h3 id="admin-first-contrib" className="mb-1.5 text-[12px] leading-4 font-semibold text-(--v3-text)">
          将新增的贡献
        </h3>
        <CodeList items={p.contributes} />
      </section>
      <section aria-labelledby="admin-first-cap">
        <h3 id="admin-first-cap" className="mb-1.5 text-[12px] leading-4 font-semibold text-(--v3-text)">
          能力声明 <span className="font-normal text-(--v3-text-2)">· 仅展示，不做运行时限制</span>
        </h3>
        {p.capabilities?.length ? <CodeList items={p.capabilities} /> : <p className="text-[12px] leading-4 text-(--v3-text-2)">未声明额外能力</p>}
      </section>
      <WarnBlock icon={<ShieldAlert size={14} strokeWidth={1.75} aria-hidden="true" />} title="同源可信、无运行时沙箱：">
        启用即允许该插件以本应用身份运行，可读写它能访问到的文档与界面。它已通过部署时的{signed ? "签名" : "审核记录"}校验。
      </WarnBlock>
      <p className="text-[12px] leading-[18px] text-(--v3-text-2)">
        {isContentLevel(p) ? "内容级插件：确认后进入草稿，保存后在新会话生效，全员统一。" : "界面级插件：确认后进入草稿，保存后在新会话生效。"}
      </p>
    </Dialog>
  )
}

/** 贡献点、能力：等宽文字逐项列出，不画胶囊（Q4） */
export function CodeList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((c) => (
        <li key={c}>
          <Code>{c}</Code>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ 有草稿时离开（DS-59） */

function LeaveGuard({ api }: { api: AdminApi }) {
  const n = api.changes.length
  return (
    <Dialog
      variant="confirm"
      title={`离开将放弃 ${n} 项未保存的变更`}
      description="这些插件策略变更还只在本页的草稿里，离开后不会保存。"
      onOpenChange={(v) => !v && api.setLeave(false)}
      initialFocus="secondary"
      returnFocus="admin-plugins.back"
      className="break-keep"
      secondary={{ label: "留下" }}
      // 「仍要离开」：与第 2 批离开确认（offline-conflict.leave-confirm）、本批其余离开类确认同一种写法（复验 AP-05、XG-09）；草稿会丢，标题已写明「放弃」
      primary={{ label: "仍要离开", danger: true, onClick: api.goHome }}
    />
  )
}

/** 草稿的策略说明（详情头部「当前策略」随草稿同步，03-32 §9） */
export const draftPolicyText = (api: AdminApi, p: AdminPlugin): { text: string; draft: boolean } => {
  const v: Policy = api.policyOf(p)
  return { text: POLICY_LABEL[v], draft: v !== api.serverPolicyOf(p) }
}
