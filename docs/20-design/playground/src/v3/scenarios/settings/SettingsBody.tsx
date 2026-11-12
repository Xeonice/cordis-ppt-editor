import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { CircleAlert, CircleCheck, LoaderCircle, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, Checkbox, hasCjk, Menu, Phrases, Section, Segmented, SelectTrigger, userHasInteracted, useRevealAfterMount, type MenuSpec } from "../../kit"
import { COPIED_MS, DIAGNOSTICS_TEXT, LOCALE_NAMES, type Autosave, type Locale, type ReadingOrder, type SettingsUi, type Strings, type ThemePref, type Unit } from "./prefs"

/**
 * 偏好设置的正文（对话框与抽屉共用，03-23）：一条分组列表，节标题 12px 600 + 1px 分隔（同检查器 Section，不套卡片）；
 * 控件全按安静样式（分段、下拉、复选框，DS-35…DS-37；Switch 只给个人插件面板，04 §4.1c）。
 * layout：wide（对话框 480）每行左边是名称与说明、右边 200 宽的控件列，控件左缘对齐；stack（抽屉 320、手机底部面板）名称在上、控件占满一行（同检查器）。
 * 复选框行（通知、隐私与诊断）不进控件列，占整行：16 的框 + 名称 + 下一行说明（常规画法，g4-13）；说明经 aria-describedby 读出（g4-03）。
 * touch（手机底部面板，TB-118）：控件高 44（分段、下拉、按钮），复选框整行可点（命中区 ≥ 44），同仅查看形态的触控尺寸。
 * 集成方锁定的项是只读行：当前值 + 12px 锁形 +「由宿主应用设置」，各项各自写、不画禁用控件（03-23「集成方锁定态」，DS-15 的类比）。
 */

export type Layout = "wide" | "stack"

/**
 * 说明文字的折行（Q7：中文不断在词中间）：中文按标点分段，每段不折行、段与段之间才断（kit Phrases）；英文照常按词折行。
 * 抽屉 320 的上下排布局里说明要折成两行，「不含文 / 档内容」「不影响协作 / 者。」这类断法由它避免
 */
export function Says({ children }: { children: string }) {
  if (!hasCjk(children)) return <>{children}</>
  return <Phrases parts={children.split(/(?<=[，、。；：])/)} />
}

export interface BodyProps {
  ui: SettingsUi
  t: Strings
  layout: Layout
  /** 编辑器里打开：「关于」多「插件」一行（开始页没有 host 与本会话插件集，03-23 缺口⑥） */
  showPlugins: boolean
  /** 嵌入（SDK 单人 preset）：主题、语言被集成方锁定；多「编辑」组；没有通知、隐私与诊断 */
  embed: boolean
  /** 当前实际的主题（锁定时显示的值） */
  themeNow: "light" | "dark"
  telemetry: boolean
  dev: boolean
  /** 画「无障碍」一组（缺省 true；DS-116 未采纳的备选里没有这一组） */
  a11y?: boolean
  /** 手机底部面板（TB-118）：控件按触控尺寸 44 */
  touch?: boolean
  onTheme: (p: ThemePref) => void
  onLocale: (l: Locale) => void
  onUnit: (u: Unit) => void
  onOrder: (o: ReadingOrder) => void
  onAutosave: (a: Autosave) => void
  onNotifyJoin: (v: boolean) => void
  onErrorReports: (v: boolean) => void
  onUsage: (v: boolean) => void
  onCopied: (v: boolean) => void
  onPlugins: () => void
}

/** 一行：名称（12px 主文字色）+ 说明（12px 次级文字色）· 控件；wide 两列、stack 上下 */
function Row({ label, labelId, hint, hintId, layout, children, after }: { label: string; labelId: string; hint?: ReactNode; hintId?: string; layout: Layout; children: ReactNode; after?: ReactNode }) {
  const head = (
    <div className={cn("min-w-0", layout === "wide" && "py-1.5")}>
      <div id={labelId} className="text-[12px] leading-4 text-(--v3-text)">
        {label}
      </div>
      {hint && (
        <div id={hintId} className="mt-0.5 text-[12px] leading-4 text-(--v3-text-2)">
          {typeof hint === "string" ? <Says>{hint}</Says> : hint}
        </div>
      )}
    </div>
  )
  if (layout === "stack")
    return (
      <div className="flex flex-col gap-1.5">
        {head}
        <div className="flex min-w-0">{children}</div>
        {after}
      </div>
    )
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_200px] items-start gap-x-4">
        {head}
        <div className="flex min-h-7 min-w-0 items-center">{children}</div>
      </div>
      {after}
    </div>
  )
}

/** 下拉（选择触发器外框 SELECT_FRAME + 单选菜单，选了即收起）；busy 时不可用并在当前值后转圈（语言切换中），菜单不再打开、焦点留在原处 */
function Select<T extends string>({
  value,
  options,
  onChange,
  labelId,
  hintId,
  busy,
  busyLabel,
  anchor,
  touch,
}: {
  value: T
  options: { value: T; label: string; hint?: string }[]
  onChange: (v: T) => void
  labelId: string
  hintId?: string
  busy?: boolean
  busyLabel?: string
  /** 浮层锚点名（data-v3-anchor）：命令面板「阅读顺序…」打开偏好设置后焦点落在这里 */
  anchor?: string
  /** 触控尺寸：高 44 */
  touch?: boolean
}) {
  const [open, setOpen] = useState(false)
  const triggerId = useId()
  const current = options.find((o) => o.value === value)?.label ?? value
  const items: MenuSpec[] = [
    {
      type: "radio",
      id: "options",
      value,
      closeOnSelect: true,
      options: options.map((o) => ({ value: o.value, label: o.label, hint: o.hint })),
      onValueChange: (v) => onChange(v as T),
    },
  ]
  return (
    <Menu
      open={open}
      onOpenChange={(v) => setOpen(busy ? false : v)}
      align="start"
      items={items}
      className="min-w-[200px]"
      trigger={
        // 读屏名「名称 + 当前值」（aria-labelledby 指向名称与按钮自己），说明经 aria-describedby
        <SelectTrigger
          id={triggerId}
          data-v3-anchor={anchor}
          aria-labelledby={`${labelId} ${triggerId}`}
          aria-describedby={hintId}
          aria-disabled={busy || undefined}
          aria-busy={busy || undefined}
          className={cn("w-full", touch && "h-11")}
        >
          <span className="truncate">{current}</span>
          {busy && <LoaderCircle size={14} strokeWidth={1.75} role="img" aria-label={busyLabel} className="shrink-0 text-(--v3-text-2) motion-safe:animate-spin" />}
        </SelectTrigger>
      }
    />
  )
}

/**
 * 复选框一行（占整行：16 的框 + 名称 + 下一行说明，g4-13）：框与名称首行对齐；名称是 label（读屏名），说明经 aria-describedby 读出（g4-03：
 * 隐私两项的说明是同意的依据，NF-11 / PD-10）。kit Checkbox 还不收 aria-describedby（交付说明请集成加 describedBy 属性），这里先把它写到 kit 的
 * role=checkbox 按钮上——React 不管这个属性，重渲染不会去掉。touch：整行可点（label 的 ::after 铺满整行、上下再各伸出 6，命中区 ≥ 44），排布与桌面相同
 */
function CheckSetting({ label, hint, checked, onChange, touch }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; touch?: boolean }) {
  const id = useId()
  const hintId = `${id}-hint`
  const wrap = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const box = wrap.current?.querySelector<HTMLElement>('[role="checkbox"]')
    if (!box) return
    if (hint) box.setAttribute("aria-describedby", hintId)
    else box.removeAttribute("aria-describedby")
  }, [hint, hintId])
  return (
    <div className={cn("flex items-start gap-2 py-1.5", touch && "relative")}>
      <span ref={wrap} className="flex h-4 items-center">
        <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      </span>
      <div className="min-w-0">
        <label htmlFor={id} className={cn("block text-[12px] leading-4 text-(--v3-text) select-none", touch && "after:absolute after:inset-x-0 after:-inset-y-1.5")}>
          {label}
        </label>
        {hint && (
          <p id={hintId} className="mt-0.5 text-[12px] leading-4 text-(--v3-text-2)">
            <Says>{hint}</Says>
          </p>
        )}
      </div>
    </div>
  )
}

/** 集成方锁定的只读值：当前值 + 12px 锁形 +「由宿主应用设置」（03-23；不画禁用控件，同 DS-15「只读展示当前值」） */
function LockedValue({ value, t, layout }: { value: string; t: Strings; layout: Layout }) {
  return (
    <span className={cn("flex min-h-7 min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] leading-4", layout === "wide" && "px-2")}>
      <span className="text-(--v3-text)">{value}</span>
      <span className="flex items-center gap-1 text-(--v3-text-2)">
        <Lock size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
        {t.locked}
      </span>
    </span>
  )
}

/** 对话框里的反馈行（DS-56：模态遮罩会盖住画布轻提示，结果写在框里）：状态色只给图标，文字主文字色；自己是 polite 播报区，出现后两帧内容才进无障碍树（kit useRevealAfterMount） */
function InlineFeedback({ tone, children, className }: { tone: "error" | "success"; children: ReactNode; className?: string }) {
  const revealed = useRevealAfterMount()
  return (
    <p role="status" className={cn("flex items-start gap-1.5 text-[12px] leading-4 text-(--v3-text)", className)}>
      <span className="contents" aria-hidden={revealed ? undefined : true}>
        <span className="flex h-4 shrink-0 items-center">
          {tone === "error" ? (
            <CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" className="text-(--v3-danger)" />
          ) : (
            <CircleCheck size={14} strokeWidth={1.75} aria-hidden="true" className="text-(--v3-success)" />
          )}
        </span>
        <span className="min-w-0">{children}</span>
      </span>
    </p>
  )
}

export function SettingsBody(p: BodyProps) {
  const uid = useId()
  const { ui, t, layout, touch } = p
  const id = (k: string) => `${uid}-${k}`
  /** 触控尺寸的按钮（手机底部面板）：高 44 */
  const btn = touch ? "h-11 px-4" : undefined
  const themeOptions = [
    { value: "light" as const, label: t.themeLight, text: t.themeLight },
    { value: "dark" as const, label: t.themeDark, text: t.themeDark },
    { value: "system" as const, label: t.themeSystem, text: t.themeSystem },
  ]

  // 「已复制到剪贴板」几秒后收起，回到说明文字；状态里一出现就是「已复制」的（settings.copied）定格到用户第一次点按或按键后才计时（同 kit useDemoOpen 的演示口径）
  useEffect(() => {
    if (!ui.copied) return
    let timer = 0
    const start = () => {
      timer = window.setTimeout(() => p.onCopied(false), COPIED_MS)
    }
    const go = () => {
      remove()
      start()
    }
    const remove = () => {
      document.removeEventListener("pointerdown", go, true)
      document.removeEventListener("keydown", go, true)
    }
    if (userHasInteracted()) start()
    else {
      document.addEventListener("pointerdown", go, true)
      document.addEventListener("keydown", go, true)
    }
    return () => {
      remove()
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.copied])

  const copy = () => {
    navigator.clipboard?.writeText(DIAGNOSTICS_TEXT).catch(() => undefined)
    p.onCopied(true)
  }

  return (
    <>
      <Section title={t.appearance}>
        <Row label={t.theme} labelId={id("theme")} layout={layout}>
          {p.embed ? (
            <LockedValue value={p.themeNow === "dark" ? t.themeDark : t.themeLight} t={t} layout={layout} />
          ) : (
            <Segmented role="radiogroup" aria={t.theme} value={ui.theme} onValueChange={p.onTheme} options={themeOptions} className={cn("w-full", touch && "h-11")} />
          )}
        </Row>
      </Section>

      <Section title={t.langUnits}>
        <Row
          label={t.language}
          labelId={id("lang")}
          layout={layout}
          after={
            ui.langError && (
              <InlineFeedback tone="error" className={cn("pb-0.5", layout === "wide" ? "mt-1" : "mt-0")}>
                {t.langFailed}
              </InlineFeedback>
            )
          }
        >
          {p.embed ? (
            <LockedValue value={LOCALE_NAMES[ui.locale]} t={t} layout={layout} />
          ) : (
            <Select<Locale>
              value={ui.pending ?? ui.locale}
              options={(["zh-CN", "en-US"] as const).map((l) => ({ value: l, label: LOCALE_NAMES[l] }))}
              onChange={p.onLocale}
              labelId={id("lang")}
              busy={!!ui.pending}
              busyLabel={t.langSwitching}
              touch={touch}
            />
          )}
        </Row>
        <Row label={t.unit} labelId={id("unit")} hint={t.unitHint} hintId={id("unit-hint")} layout={layout}>
          <Select<Unit>
            value={ui.unit}
            options={(["cm", "in", "pt", "px"] as const).map((u) => ({ value: u, label: t.units[u] }))}
            onChange={p.onUnit}
            labelId={id("unit")}
            hintId={id("unit-hint")}
            touch={touch}
          />
        </Row>
      </Section>

      {p.embed && (
        <Section title={t.editing}>
          <Row label={t.autosave} labelId={id("autosave")} hint={t.autosaveHint} hintId={id("autosave-hint")} layout={layout}>
            <Select<Autosave>
              value={ui.autosave}
              options={(["15", "30", "60", "off"] as const).map((a) => ({ value: a, label: t.autosaves[a] }))}
              onChange={p.onAutosave}
              labelId={id("autosave")}
              hintId={id("autosave-hint")}
            />
          </Row>
        </Section>
      )}

      {p.a11y !== false && (
        <Section title={t.a11y}>
          <Row label={t.order} labelId={id("order")} hint={t.orderHint} hintId={id("order-hint")} layout={layout}>
            <Select<ReadingOrder>
              value={ui.order}
              options={(["z", "placeholder"] as const).map((o) => ({ value: o, label: t.orders[o], hint: t.orderHints[o] }))}
              onChange={p.onOrder}
              labelId={id("order")}
              hintId={id("order-hint")}
              anchor="settings.reading-order"
              touch={touch}
            />
          </Row>
        </Section>
      )}

      {!p.embed && (
        <Section title={t.notify} bodyClassName="gap-0">
          <CheckSetting label={t.notifyJoin} hint={t.notifyJoinHint} checked={ui.notifyJoin} onChange={p.onNotifyJoin} touch={touch} />
        </Section>
      )}

      {!p.embed && (
        <Section title={t.privacy} bodyClassName="gap-0">
          <CheckSetting label={t.errorReports} hint={t.errorReportsHint} checked={ui.errorReports} onChange={p.onErrorReports} touch={touch} />
          {p.telemetry && <CheckSetting label={t.usage} hint={t.usageHint} checked={ui.usage} onChange={p.onUsage} touch={touch} />}
        </Section>
      )}

      <Section title={t.about}>
        {/* 版本值与下面几个按钮的外框同一条左缘（这一组全是按钮，不缩进去对下拉里的文字，g4-09） */}
        <Row label={t.version} labelId={id("version")} layout={layout}>
          <span className="flex min-h-7 items-center text-[12px] leading-4 text-(--v3-text) tabular-nums">{t.versionValue}</span>
        </Row>
        <Row
          label={t.diagnostics}
          labelId={id("diag")}
          hintId={id("diag-hint")}
          hint={ui.copied ? <InlineFeedback tone="success">{t.copied}</InlineFeedback> : t.diagnosticsHint}
          layout={layout}
        >
          <Button variant="secondary" aria-label={t.copyDiagnostics} aria-describedby={id("diag-hint")} onClick={copy} className={btn}>
            {t.copy}
          </Button>
        </Row>
        {p.showPlugins && (
          <Row label={t.plugins} labelId={id("plugins")} hint={t.pluginsHint} hintId={id("plugins-hint")} layout={layout}>
            <Button variant="secondary" aria-label={t.viewPlugins} aria-describedby={id("plugins-hint")} onClick={p.onPlugins} className={btn}>
              {t.view}
            </Button>
          </Row>
        )}
        {p.dev && (
          <Row label={t.devtools} labelId={id("dev")} hint={t.devtoolsHint} hintId={id("dev-hint")} layout={layout}>
            <Button variant="secondary" aria-label={t.openDevtools} aria-describedby={id("dev-hint")} className={btn}>
              {t.open}
            </Button>
          </Row>
        )}
      </Section>
    </>
  )
}

