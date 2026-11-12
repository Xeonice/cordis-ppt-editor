import { useEffect, useRef, type ReactNode } from "react"
import { History, LoaderCircle, Lock } from "lucide-react"
import {
  Avatar, AvatarStack, Banner, BannerStack, Button, DeckSlideView, ICON, holdFocusDuring, LayerClose, LI, LoadingRow, ME, Menu, OfflineBanner, Popover, RailList, RailThumb, Tip, Toast, Toasts, WANG,
  slideOf, useBreakpoint, useEditor, useEditorCommand, useMasterEntryGuard, useRunCommand, withReason, type DeckSlide, type MenuSpec, type RegionDefaults,
} from "../../kit"
import { REJECTED_TEXT } from "../offline-conflict/banners"
import { callOf, namesOf, restoredVersions, sp, titleOf } from "./data"
import { focusPanel, focusPanelOnMount, focusRow, focusRowNow, landingOf } from "./HistoryPanel"
import { deckOf } from "./slides"
import { useVh, type Vh } from "./store"

/**
 * 版本历史打开期间编辑器其余部分的样子（regions 逃生口，场景级声明，各状态共用）：
 * - 画布（StageSwitch）：选中当前版本时是正在编辑的文档（底座 Stage，可照常编辑）；选中历史版本时换成该版本的只读预览（同一套画布几何：幻灯片 + 备注，备注只读），
 *   预览不影响当前会话、不广播给他人（03-07「协同中查看历史」）；快照较大时先显示加载中，列表照样可点。
 * - 左栏（RailSwitch）：结构照常，预览时缩略图换成该版本的页（取代原「缩略图迷你条」），不提供新建；面板开着时「单页 / 网格」不可用（网格视图没有检查器栏，放不下面板）。
 * - 工具条（ToolbarSwitch）：预览时收起（只读，没有可创建的东西；画布仍给它留位置，进出预览画布不跳动）。
 * - 横幅通道（PreviewBanner）：预览时一条信息横幅「正在查看〈时间〉的版本」+「返回当前版本」「恢复此版本」；它是模式横幅，和母版视图横幅一样常驻在上，
 *   离线等其余横幅按 03-12 优先级排在它下面（TB-14 的同一例外扩到版本预览，rulings §4.25 DS-39）。
 */

/* ------------------------------------------------------------------ 画布 */

export function StageSwitch({ d }: { d: RegionDefaults }) {
  const vh = useVh()
  const ed = vh.ed
  const deck = vh.previewing && vh.version ? deckOf(vh.version.deck, ed.deck) : vh.live !== "live" ? deckOf(vh.live, ed.deck) : null
  // 换到页数更少的版本时，当前页落到它的最后一页（左栏与画布同步）
  const missing = !!deck && !(vh.previewing && vh.previewLoading) && !deck.some((s) => s.n === ed.slide)
  useEffect(() => {
    if (missing && deck) ed.goTo(deck[deck.length - 1]!.n)
    // 只在「当前页不在这个版本里」变化时
  }, [missing])
  if (vh.previewing && vh.previewLoading) return <LoadingStage />
  if (!deck) return <>{d.stage()}</>
  return <PreviewStage deck={deck} preview={vh.previewing} />
}

const STAGE = "relative flex min-h-0 flex-1 items-center justify-center px-12 pt-10 pb-6 outline-none [container-type:size]"
const SLIDE_BOX = "relative w-[min(100cqw,calc(100cqh_*_16/9))] rounded-[4px]"

/** 某个版本的画布：与底座 Stage 同一几何（锚点 stage / slide / notes 也相同），内容只读、没有选中与远端光标 */
function PreviewStage({ deck, preview }: { deck: DeckSlide[]; preview: boolean }) {
  const ed = useEditor()
  const slide = slideOf(deck, ed.slide)
  return (
    <>
      <div data-v3-anchor="stage" tabIndex={-1} aria-label={preview ? "画布：历史版本预览，只读" : "画布"} role="group" className={STAGE}>
        <div data-v3-anchor="slide" className={`${SLIDE_BOX} shadow-(--v3-slide-shadow)`}>
          <DeckSlideView slide={slide} where="canvas" className="rounded-[4px]" />
        </div>
      </div>
      {ed.notes && (
        <NotesBox>
          {slide.notes ? <div className="text-(--v3-text)">{slide.notes}</div> : preview ? <span className="text-(--v3-text-2)">这一页没有演讲者备注</span> : "添加演讲者备注…"}
        </NotesBox>
      )}
    </>
  )
}

/** 大预览加载中，左栏与画布中央写同一句（DS-53：转圈 + 一句话） */
const LOADING_VERSION = "正在加载这个版本…"

/**
 * 大预览加载中（03-07、DS-53）：幻灯片位置是一块面板色的框 + 转圈与一句话（与左栏同一句、同一画法：转圈 14 + 12px text-2，同 kit LoadingRow），
 * 不画骨架条，也不留着切换前那个版本的页；列表照样可点。
 * 读屏：这一句只作显示、不是 live 区——「正在加载这个版本…」由左栏那一行（kit LoadingRow，role=status）播报一次，同一件事只走一条通道；
 * 画布自己的读屏名是「画布：正在加载历史版本」
 */
function LoadingStage() {
  const ed = useEditor()
  return (
    <>
      <div data-v3-anchor="stage" tabIndex={-1} aria-label="画布：正在加载历史版本" role="group" className={STAGE}>
        <div
          data-v3-anchor="slide"
          className={`${SLIDE_BOX} flex aspect-video items-center justify-center gap-2 border border-(--v3-border) bg-(--v3-panel) text-[12px] leading-4 text-(--v3-text-2)`}
        >
          <LoaderCircle size={14} strokeWidth={1.75} aria-hidden="true" className="shrink-0 motion-safe:animate-spin" />
          {LOADING_VERSION}
        </div>
      </div>
      {ed.notes && <NotesBox>{null}</NotesBox>}
    </>
  )
}

/** 备注框：与底座同一几何（桌面形态上方是 16 高的把手位），预览时没有可拖的把手 */
function NotesBox({ children }: { children: ReactNode }) {
  const desktop = useBreakpoint() === "desktop"
  return (
    <div className="shrink-0 px-12">
      {desktop ? (
        <div className="mb-1 -mt-1.5">
          <div aria-hidden="true" className="mx-auto flex h-4 w-16 items-center justify-center">
            <span className="h-1 w-10 rounded-[2px] bg-(--v3-handle)" />
          </div>
        </div>
      ) : (
        <div className="mx-auto mb-2 h-1 w-10 rounded-[2px] bg-(--v3-handle)" aria-hidden="true" />
      )}
      <div data-v3-anchor="notes" className="h-[120px] overflow-y-auto rounded-[8px] border border-(--v3-border) bg-(--v3-panel) p-3 text-[12px] leading-[18px] text-(--v3-text-3)">
        {children}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 左栏与工具条 */

function VersionThumbs({ deck }: { deck: DeckSlide[] }) {
  const ed = useEditor()
  return (
    <RailList>
      {deck.map((s) => (
        <RailThumb key={s.n} slide={s} current={s.n === ed.slide} onPick={ed.goTo} />
      ))}
    </RailList>
  )
}

/**
 * 大预览加载中的左栏（DS-53 统一画法：转圈 + 一句话，kit LoadingRow 整块居中）：不再留着切换前的页（旧页还带当前文档的评论角标，
 * 看上去像是这个版本的页），列表区中央写「正在加载这个版本…」，加载完换成这个版本的页（aria-busy）。
 * 这一行是这件事唯一的 live 区（role=status，播报一次）；画布中央的同一句只作显示（LoadingStage）
 */
function RailLoading() {
  return (
    <nav aria-label="幻灯片" aria-busy="true" className="mt-3 flex min-h-0 flex-1 items-center justify-center px-2">
      <LoadingRow center>{LOADING_VERSION}</LoadingRow>
    </nav>
  )
}

export const VIEW_LOCK = { reason: "关闭版本历史后可用" }

export function RailSwitch({ d }: { d: RegionDefaults }) {
  const vh = useVh()
  const ed = vh.ed
  // 面板开着时「单页 / 网格」与主菜单「视图 › 网格视图」同一原因不可用（网格视图没有检查器栏，放不下面板）
  const lock = vh.open ? { viewToggle: VIEW_LOCK, menu: { gridReason: VIEW_LOCK.reason } } : null
  if (vh.previewing && vh.version) {
    return <>{d.leftRail({ list: vh.previewLoading ? <RailLoading /> : <VersionThumbs deck={deckOf(vh.version.deck, ed.deck)} />, newSlide: false, ...lock })}</>
  }
  return <>{d.leftRail({ ...(vh.live !== "live" ? { list: <VersionThumbs deck={deckOf(vh.live, ed.deck)} /> } : null), ...lock })}</>
}

export function ToolbarSwitch({ d }: { d: RegionDefaults }) {
  const vh = useVh()
  return vh.previewing ? null : <>{d.toolbar()}</>
}

/* ------------------------------------------------------------------ 横幅通道 */

/**
 * 预览横幅（信息色，History 图标）：粗体「正在查看〈时间〉的版本」+ 说明（命名版本的名称 / 自动版本的贡献者 · 仅你可见）；
 * 不再写「只读预览」：只读已由三处表达——工具条收起、左栏不提供新建、标题「正在查看…的版本」（标杆对照，03-07 与 50/08 §9 只要求预览不广播）。
 * 右侧「返回当前版本」「恢复此版本」（横幅按钮一律次按钮，DS-37）。恢复只在这里（Q2）；点了先弹锚在按钮下方的确认卡（非模态，03-07「内嵌确认卡片」）。
 * below：同时成立的另一条横幅（如离线），排在预览横幅下面。
 */
export function PreviewBanner({ below }: { below?: ReactNode }) {
  const vh = useVh()
  const bar = vh.previewing && vh.version ? <PreviewBar vh={vh} /> : null
  if (bar && below) return <BannerStack>{bar}{below}</BannerStack>
  return <>{bar ?? below ?? null}</>
}

function PreviewBar({ vh }: { vh: Vh }) {
  const v = vh.version!
  const what = v.kind === "named" ? `「${v.name}」` : v.kind === "auto" ? `自动版本 · ${namesOf(v.by)}` : titleOf(v)
  return (
    <Banner
      icon={<History {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />}
      title={`正在查看${sp(v.when)} 的版本`}
      actions={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              // 焦点先交给列表里的「当前版本」一行，再收起横幅（按钮随之卸载，焦点不经过 body）
              focusRowNow("current")
              vh.setSelected("current")
              vh.setConfirm(false)
            }}
          >
            返回当前版本
          </Button>
          <RestoreButton vh={vh} />
        </>
      }
    >
      {/* 大预览加载中不在横幅里再写「正在加载…」：左栏与画布中央已经在说，「恢复此版本」不可用也说明了状态 */}
      <span className="text-(--v3-text-2)">{what} · 仅你可见</span>
    </Banner>
  )
}

function RestoreButton({ vh }: { vh: Vh }) {
  const reason = vh.restoreReason
  if (reason && vh.data.tipOpen)
    // 演示「不可用的原因」：提示常开（编辑者：需要所有者权限）
    return (
      <Tip label={reason} open side="bottom">
        <Button variant="secondary" disabled aria-label={withReason("恢复此版本", reason)} data-v3-anchor="version-history.restore">
          恢复此版本
        </Button>
      </Tip>
    )
  return (
    <>
      <Button variant="secondary" disabled={!!reason} reason={reason} data-v3-anchor="version-history.restore" onClick={() => vh.setConfirm(true)}>
        恢复此版本
      </Button>
      {/* 备选 alt-confirm-dialog 里同一个开关打开的是模态确认框（alt.tsx AltRestoreDialog），从入口重开也是备选形态 */}
      {!reason && !vh.data.confirmDialog && <RestoreConfirm vh={vh} />}
    </>
  )
}

/** 恢复：在 Room 内以一个新事务写回所选版本（恢复不加锁、在线不断连，rulings §4.19 N1）；列表出现「恢复自『X』」与恢复前的自动版本，画布回到当前版本 */
export function restore(vh: Vh) {
  const v = vh.version
  if (!v) return
  // 第几次恢复（本场景里可以连着恢复几次）：第二次起新版本的 id 加序号，列表里不出同 id 的两行
  vh.setExtra((cur) => [...restoredVersions(v, [ME], cur.filter((x) => x.kind === "restore").length), ...cur])
  vh.setRestoredFrom(callOf(v))
  vh.setLive(v.deck)
  vh.setSelected("current")
  vh.setConfirm(false)
  vh.setToast("restored")
  focusRow("current")
}

/** 恢复时正在编辑的协作者（不含自己）：离线时在场信息消失，不提 */
const othersOf = (vh: Vh) => (vh.offline ? [] : [WANG, LI])

/** 确认卡的正文（确认卡与备选对话框共用）：03-07 文案 + 有协作者正在编辑时的提示（02-user-flows F8 边界） */
export function RestoreNote({ vh }: { vh: Vh }) {
  const others = othersOf(vh)
  if (!others.length) return null
  return (
    <div className="flex items-start gap-2">
      <span className="flex h-[18px] shrink-0 items-center">
        <AvatarStack people={others} />
      </span>
      <p className="text-[12px] leading-[18px] text-(--v3-text-2)">
        <span className="whitespace-nowrap">{namesOf(others)}正在编辑，</span>
        <span className="whitespace-nowrap">他们的画布会自动更新为恢复后的内容</span>
      </p>
    </div>
  )
}

/** 03-07 确认卡文案；按分句换行，不断在词中间 */
export const RESTORE_DESC = (
  <>
    <span className="whitespace-nowrap">将以这个版本的内容创建一个新版本，</span>
    <span className="whitespace-nowrap">当前更改不会丢失。</span>
  </>
)

/** 恢复确认卡：锚在横幅「恢复此版本」下方、右对齐的非模态弹层（不是浏览器 confirm，也不是模态对话框；Esc / 点外面 / 取消都关闭，焦点回按钮） */
function RestoreConfirm({ vh }: { vh: Vh }) {
  const v = vh.version!
  const title = `恢复到${callOf(v)}？`
  return (
    <Popover anchor="version-history.restore" open={vh.confirm} onOpenChange={vh.setConfirm} side="bottom" align="end" sideOffset={6} label={title} className="w-[320px] p-4">
      <h3 className="text-[13px] leading-4 font-semibold text-(--v3-text)">{title}</h3>
      <p className="mt-2 text-[12px] leading-[18px] text-(--v3-text-2)">{RESTORE_DESC}</p>
      <div className="mt-3 empty:hidden">
        <RestoreNote vh={vh} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <LayerClose>
          <Button variant="secondary">取消</Button>
        </LayerClose>
        <Button variant="primary" onClick={() => restore(vh)}>
          确认恢复
        </Button>
      </div>
    </Popover>
  )
}

/** 离线横幅（kit OfflineBanner：与 main-states.offline 同一条，警告色、不可关闭、立即重连）；两条同时成立时用 kit BannerStack 叠放 */
export const OFFLINE_BANNER = <OfflineBanner />

/**
 * 降权横幅（与 main-states.degraded 同一条画法）：正文取离线与冲突场景的同一份原文（REJECTED_TEXT，03-12 G-51 的新写法），与 offline-conflict.degraded-export、
 * master-degraded、too-large 一致（DS-58）；第 1 批 main-states.degraded 已换成同一句（原「3 项更改未被保存；导出后可另行申请编辑权限再重新应用」）
 */
export const DEGRADED_BANNER = (
  <Banner tone="error" icon={<Lock {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-danger)" />} title="你的权限已变更为「可评审」" actions={<Button variant="secondary">导出为本地副本</Button>}>
    {REJECTED_TEXT}
  </Banner>
)

/* ------------------------------------------------------------------ 控制器与提示 */

/**
 * 场景控制器（canvasOverlay，单页与网格视图都在）：面板收起后回到当前版本；接上底座文档菜单（左栏文件名 ▾ / 网格左上胶囊的文件名 ▾）的「版本历史」
 * （底座命令 doc.history，kit/commands.ts）；轻提示（命名、恢复、协作者收到恢复、彻底删除、上限）。状态出现时面板开不开由状态的 inspector.takeoverOpen 决定（入口、协作者视角为 false）。
 */
export function VhController() {
  const vh = useVh()
  const { ed, setOpen, setSelected, setConfirm, setNaming } = vh
  // 版本历史面板开着（含正在预览旧版本）时不能进入母版视图，原因与这时的「网格视图」同一句（rulings §4.25 DS-162）：
  // 主菜单「视图 › 母版视图」与命令面板写这句、⌥⌘M 只出轻提示。其他整栏面板进入时收起、退出后恢复由宿主做；
  // 母版视图里文档菜单与命令面板的「版本历史」不可用（DS-157），面板不会在母版视图里打开
  useMasterEntryGuard(vh.open ? VIEW_LOCK.reason : false)
  const was = useRef(vh.open)
  useEffect(() => {
    if (was.current && !vh.open) {
      setSelected("current")
      setConfirm(false)
      setNaming(false)
    }
    was.current = vh.open
  }, [vh.open])
  // 底座文档菜单「版本历史」：打开整栏面板（面板挂载后焦点落在选中的版本上，见 HistoryPanel）；面板已经开着时把焦点移进面板（选中的版本，加载失败时是「重试」）。
  // 网格视图没有检查器栏：先回单页（与「文件 › 保真报告」、网格里选创建工具同一做法），面板随检查器挂上后自己把焦点移进去；
  // 网格胶囊连同触发它的文件名随视图卸载，面板关闭后焦点交给单页里同一个文件名（returnFocus doc-menu），不静默无响应（ED-30）
  const live = useRef(vh)
  live.current = vh
  useEditorCommand("doc.history", () => {
    if (ed.view === "grid") {
      // 面板与检查器随视图在同一次提交里挂上：挂载时（布局阶段）直接把焦点交给落点（面板自己的挂载聚焦稍后再兜一次，落在同一处）。
      // 文档菜单先于视图切换收起（视图走 URL，晚几帧才提交）：这几帧里焦点交给画布列（两种视图共用的同一个 main），不在 body 上停留
      focusPanelOnMount()
      ed.setView("single")
      holdFocusDuring()
    } else {
      // 单页：面板在菜单还开着时就同步挂上（Radix 选中条目时同步渲染）；菜单随后收起、条目卸载，焦点要掉到 body 的那一刻就交给面板的落点——
      // 不经过 body，也不让菜单先把焦点还给文件名（读屏不会先念一遍文件名再念版本行）
      holdFocusDuring(1500, () => landingOf(live.current))
    }
    if (vh.open) focusPanel(vh)
    else setOpen(true)
  })
  return <VhToasts vh={vh} />
}

function VhToasts({ vh }: { vh: Vh }) {
  if (!vh.toast) return null
  const close = () => vh.setToast(null)
  // 最近一次命名的名称（新增的版本新的在前）
  const newName = vh.extra.find((v) => v.kind === "named")?.name ?? ""
  const body: Record<NonNullable<Vh["toast"]>, ReactNode> = {
    named: (
      <Toast tone="success" onClose={close}>
        已将当前版本命名为「{newName}」
      </Toast>
    ),
    "name-limit": (
      <Toast tone="error" onClose={close}>
        命名版本已达上限（每份文档 200 个）
      </Toast>
    ),
    restored: (
      <Toast tone="success" onClose={close}>
        已恢复到{vh.restoredFrom}
      </Toast>
    ),
    "restored-remote": (
      <Toast icon={<Avatar name={LI.name} tone={LI.tone} size={20} />} onClose={close}>
        <b className="font-semibold">李雷</b>已将文档恢复到「提案定稿」
      </Toast>
    ),
    purged: <Toast onClose={close}>已彻底删除 1 个元素</Toast>,
    copied: (
      <Toast tone="success" action="打开" onClose={close}>
        已创建副本「2026 年 Q2 业绩汇报（提案定稿）」
      </Toast>
    ),
  }
  return <Toasts key={vh.toast}>{body[vh.toast]}</Toasts>
}

/* ------------------------------------------------------------------ 文档菜单（静态打开） */

/**
 * 静态打开的文档菜单（锚在文件名上，与底座 DocMenu 同一位置、同一份条目，03-02 §2.3）：highlight 把某一项设为当前项（键盘高亮的外观）。
 * 底座的条目随角色：编辑 = 重命名 · 创建副本 ┊ 版本历史；评审者 / 查看者一项都没有、文件名不是菜单触发器（rulings §4.25 DS-82）；降权时三项都留在原位、不可用并写「需要编辑权限」（rulings §4.25 TB-138、DS-139）。
 */
export function DocMenuLayer({ items, highlight }: { items: MenuSpec[]; highlight?: string }) {
  useEffect(() => {
    if (!highlight) return
    let tries = 0
    let id = 0
    const find = () => {
      const hit = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((el) => el.textContent?.trim().startsWith(highlight))
      if (hit) hit.focus({ preventScroll: true })
      else if (tries++ < 20) id = requestAnimationFrame(find)
    }
    id = requestAnimationFrame(find)
    return () => cancelAnimationFrame(id)
  }, [highlight])
  // 菜单顶边贴住文件名下沿（sideOffset 0，与底座 DocMenu 同一处）：把下面的同步状态行整行盖住，不切在半行字上（标杆对照、质量门 Q7）
  return <Menu anchor="doc-menu" side="bottom" align="start" sideOffset={0} label="文档" items={items} />
}

/** 入口状态：编辑者的文档菜单，选「版本历史」打开整栏面板（与底座文档菜单同一条命令 doc.history：网格视图里同样先回单页，见 VhController） */
export function EntryMenu() {
  const run = useRunCommand()
  return (
    <DocMenuLayer
      highlight="版本历史"
      items={[{ id: "rename", label: "重命名" }, { id: "copy", label: "创建副本" }, { type: "separator" }, { id: "history", label: "版本历史", onSelect: () => void run("doc.history") }]}
    />
  )
}
