import { useState } from "react"
import { ArchiveRestore, CircleAlert, CloudOff, FileQuestion, LayoutGrid, List, Pin } from "lucide-react"
import { Banner, BlockingPage, Button, DocumentCard, Drawer, ICON, IconButton, LayerClose, Section, StaticRow, Tag, Toast, Toasts, usePage, WANG, type DocCardData, type MenuSpec } from "../kit"
import { RECENT_DOCS } from "../data"

/**
 * _kit 场景第 3 批新件的示例（页面级宿主：documents / home / page / embed）：应用壳、文档卡片、阻断页、抽屉、横幅通道与轻提示。
 * 文案只为演示各插槽怎么用，正式画法与文案以各组场景为准（文档列表、账户菜单、登录与错误页、管理页、嵌入）。
 */

const SEP: MenuSpec = { type: "separator" }

/** 示例菜单（rulings §4.25 DS-81 的条目，只为演示 DocumentCard menu） */
const CARD_MENU: MenuSpec[] = [
  { id: "share", label: "分享…" },
  { id: "duplicate", label: "创建副本" },
  { id: "rename", label: "重命名" },
  SEP,
  { id: "pin", label: "固定" },
  { id: "remove-recent", label: "从最近移除" },
  SEP,
  { id: "trash", label: "移到回收站", danger: true },
]

/** 示例横幅（应用壳的横幅通道，DS-92）：警告浅底 + CloudOff，带按钮（DS-75 高 40） */
export function KitShellBanner() {
  return (
    <Banner tone="warning" icon={<CloudOff {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-warning)" />} title="离线" actions={<Button variant="secondary">立即重连</Button>}>
      示例横幅：只横跨主区，导航不动、标题不跳
    </Banner>
  )
}

/** 列表头（数量 · 网格 / 列表）+ 卡片网格；第一张卡片的「⋯」菜单按 data.menuOpen 一出现就打开 */
export function KitShellBody() {
  const { data } = usePage()
  const [view, setView] = useState<"grid" | "list">((data.view as "grid" | "list" | undefined) ?? "grid")
  const docs = RECENT_DOCS.slice(0, 8)
  return (
    <section aria-labelledby="kit-shell-list">
      <div className="flex h-7 items-center justify-between">
        <h2 id="kit-shell-list" className="text-[13px] leading-5 font-semibold">
          {docs.length} 份文档
        </h2>
        <div role="group" aria-label="显示方式" className="flex items-center gap-1">
          <IconButton label="网格" size={24} variant={view === "grid" ? "on" : "ghost"} pressed={view === "grid"} onClick={() => setView("grid")}>
            <LayoutGrid {...ICON} />
          </IconButton>
          <IconButton label="列表" size={24} variant={view === "list" ? "on" : "ghost"} pressed={view === "list"} onClick={() => setView("list")}>
            <List {...ICON} />
          </IconButton>
        </div>
      </div>
      <ul className={view === "grid" ? "mt-2 -mx-2 grid grid-cols-4" : "mt-2 -mx-2 flex flex-col"}>
        {docs.map((d, i) => (
          <DocumentCard key={d.id} doc={d} view={view} menu={CARD_MENU} menuOpen={i === 0 && !!data.menuOpen} />
        ))}
      </ul>
    </section>
  )
}

/** 应用壳的轻提示（主区底部居中，Toasts bottom 24：没有底部工具条） */
export function KitShellToasts() {
  return (
    <Toasts bottom={24}>
      <Toast>示例轻提示：已移到回收站</Toast>
    </Toasts>
  )
}

/** 文档卡片的各插槽：⋯ 菜单、封面左上小标、换掉右下（所有者头像 / 「恢复」）、不能打开（回收站）、没有封面的占位；网格与列表各一组 */
export function KitCardsBody() {
  const base = RECENT_DOCS
  // 第二行「编辑者 · 相对时间」不带「编辑」二字（rulings §4.25 DS-83，2026-10-22 改）；没有封面时是白纸面 + Presentation 占位（kit DocumentCard，DS-83 / 03-29 §2.3）
  const noCover: DocCardData = { id: "untitled", title: "未命名演示文稿", cover: null, editor: "我", when: "刚刚" }
  const variants = (view: "grid" | "list") => (
    <>
      <DocumentCard doc={base[0]!} view={view} menu={CARD_MENU} menuOpen={view === "grid"} />
      <DocumentCard doc={base[1]!} view={view} badge={<span className="flex size-5 items-center justify-center rounded-[4px] bg-(--v3-panel) text-(--v3-text-2) ring-1 ring-(--v3-border) ring-inset"><Pin size={12} strokeWidth={1.75} aria-label="已固定" /></span>} />
      <DocumentCard doc={{ ...base[2]!, shared: undefined }} view={view} trailing={<Tag>仅查看</Tag>} />
      <DocumentCard
        doc={{ ...base[3]!, shared: undefined }}
        view={view}
        inert
        meta={view === "grid" ? "9 天前移入回收站" : undefined}
        trailing={
          <Button variant="secondary">
            <ArchiveRestore {...ICON} />
            恢复
          </Button>
        }
      />
      <DocumentCard doc={noCover} view={view} />
    </>
  )
  return (
    <>
      <ul className="-mx-2 grid grid-cols-5">{variants("grid")}</ul>
      <ul className="mt-6 -mx-2 flex flex-col">{variants("list")}</ul>
    </>
  )
}

/** 阻断页的全部插槽（整屏 bare 宿主）：图标 · 上方一行 · 标题 · 说明 · 主按钮上方的内联错误 · 按钮 · 弱提示 */
export function KitBlockingBody() {
  return (
    <BlockingPage
      icon={<FileQuestion size={32} strokeWidth={1.5} aria-hidden="true" />}
      context="示例 · 上方一行"
      title="示例：阻断页的标题"
      notice={
        <p role="alert" className="flex items-center justify-center gap-1.5 text-(--v3-text)">
          <CircleAlert {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-danger)" />
          示例：主按钮上方的一行内联错误
        </p>
      }
      actions={
        <>
          <Button variant="primary">主按钮</Button>
          <Button variant="outline">次按钮</Button>
        </>
      }
      hint="示例：按钮下方的弱提示"
    >
      说明写在这里，最宽 420，放不下换行。阻断页替换整个工作区：登录页、错误页、编辑器的打开失败与嵌入里的阻断页都是这一份画法。
    </BlockingPage>
  )
}

/** 抽屉：右侧贴边整高，模态（遮罩）或非模态 */
export function KitDrawer({ modal = true }: { modal?: boolean }) {
  return (
    <Drawer
      title="现场投票"
      width={480}
      modal={modal}
      footer={
        <>
          <LayerClose>
            <Button variant="secondary">关闭</Button>
          </LayerClose>
        </>
      }
    >
      <Section title="详情">
        <StaticRow label="插件">现场投票</StaticRow>
        <StaticRow label="版本">0.9.1</StaticRow>
        <StaticRow label="来源">第三方 · Beta Labs</StaticRow>
        <StaticRow label="维护者">{WANG.name}</StaticRow>
      </Section>
      <p className="mt-3 text-[12px] leading-[18px] text-(--v3-text-2)">示例正文：抽屉宽 480、整高；{modal ? "模态：遮罩、焦点圈定在抽屉里" : "非模态：没有遮罩，背后的页面照常可用"}，Esc 与 × 关闭。</p>
    </Drawer>
  )
}
