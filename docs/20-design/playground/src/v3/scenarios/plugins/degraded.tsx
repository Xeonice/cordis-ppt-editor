import { Puzzle } from "lucide-react"
import {
  ContextMenu, DEGRADED_MENU_AT, DegradedDetailButton, degradedMenuItems, degradedReadOnly, DegradedSelection, HitArea, ICON, openContextMenuFromKey, Phrases, ptOf, Section, StaticRow, useDegradedGeometry,
  useEditor, useSceneState, type Box, type DegradedInfo, type EditorCtx,
} from "../../kit"
import { Nowrap } from "./bits"
import { usePlugins } from "./store"

/**
 * 缺插件的元素被选中（PM-12「降级元素可选中、移动、删除，内部不可编辑」，03-09 §6.2；OF-13）：第 6 页的二维码占位。
 * 选中种类是底座的 degraded（第 2 批集成与保真降级统一，editor/inspector/degraded.tsx），检查器同一套分区：
 *   对象说明（与第 1 批图表「此类型仅支持查看」同一画法：中性 Info 图标 +「插件「二维码形状」不可用」+ 一句原因与「内容已原样保留」+「查看详情」打开个人插件面板；
 *   rulings §4.25 DS-52 改写，不再用警告色拼图、不再写「可以移动或删除，暂不能编辑内部」）→「位置与大小」（能移动；不能改大小、不能旋转，留在原位并写原因）→
 *   「缺少的插件」（插件、id、原因、所需版本）。
 * 画布上的选中框是底座的 DegradedSelection（与保真占位同一处决定手柄）：不能改大小，所以只有 1px 选中框与尺寸角标、没有缩放手柄（DS-52；
 * 能改大小是未采纳的另一种答案，见 alt-missing-resizable）。
 * 右键（DS-52「共用一套右键」）：与保真占位同一份菜单（底座 degradedMenuItems）——剪切 · 复制 · 粘贴 · 原位复制 ┊ 排列 · 组合 ┊ 编辑替代文本… · 添加评论 C ┊ 查看详情 ┊ 删除；
 * 「查看详情」打开个人插件面板（与检查器「查看详情」同一个去处），替代文本留在原位不可用（插件不可用时不能修改）；在占位上右键、或聚焦占位后按 ⇧F10 / 菜单键打开（落点同 plugins.missing-menu，见 QR_MENU_AT），
 * 关闭后焦点回到占位。评审、只读浏览与降权照常出这份菜单，编辑类命令不可用（rulings §4.25 DS-64，同保真占位，见 fidelity.degraded-menu-review）。
 * 三个占位都能点选（右键也先选中被点的那一个，03-05 §2）：选中框跟到哪一个，检查器「位置与大小」就写哪一个的数（底座 useDegradedGeometry，X 随列变，Y、W、H 相同）。
 */

/** 第 6 页三个二维码占位的位置（「扫码获取资料」：inset-x 13cqw、top 18.5cqw、三列间距 8cqw、正方形） */
const COL = (100 - 26 - 16) / 3
const QR_BOXES: Box[] = [0, 1, 2].map((i) => ({ x: 13 + i * (COL + 8), y: (18.5 / 56.25) * 100, w: COL, h: (COL / 56.25) * 100 }))
const QR_ANCHOR = "plugins.qr-"
const qrAnchor = (i: number) => `${QR_ANCHOR}${i + 1}`

/**
 * 菜单在二维码占位上的落点（静态样张 missing-menu 与 ⇧F10 / 菜单键同一处）：贴在占位右缘、向右展开（同评论钉的菜单贴在钉的右侧、不盖住钉）。
 * 二维码占位只有页宽的约 1/5，用底座落点 DEGRADED_MENU_AT（占位内 0.56）时菜单左缘压在选中框下方居中的尺寸角标上（只露出「186 × 1」）；
 * 保真占位约半页宽，仍用底座落点（fidelity.degraded-menu 不变）。纵向与底座同一处
 */
const QR_MENU_AT = { x: 1, y: DEGRADED_MENU_AT.y }

export const degradedOverlay = (ctx: EditorCtx) => (ctx.slide === 6 ? <MissingObjects /> : null)

/** 第 6 页的三个缺插件占位：可点选（选中框画在选中的那一个上）、右键与 ⇧F10 / 菜单键打开同一份菜单 */
function MissingObjects() {
  const ctx = useEditor()
  const api = usePlugins()
  // 选中的是哪一个占位（右键也先选中被点的那一个，03-05 §2）；场景状态，换状态即复位。检查器「位置与大小」跟着它（底座 useDegradedGeometry）
  const [at, setAt] = useSceneState<number>("plugins.qr-selected", 0)
  const [, setGeometry] = useDegradedGeometry()
  const edit = ctx.mode === "edit"
  // 评审 / 只读浏览 / 降权：同一份菜单的只读形态（DS-64），编辑类命令不可用、顶部一行写原因；编辑模式没降权时 undefined
  const readOnly = degradedReadOnly(ctx)
  const pick = (i: number) => {
    setAt(i)
    setGeometry(ptOf(QR_BOXES[i] ?? QR_BOXES[0]!))
    ctx.setSelection("degraded")
  }
  const staticMenu = !!(ctx.data as { qrMenu?: boolean }).qrMenu
  // 「查看详情」：打开个人插件面板（与检查器「查看详情」同一个去处）；菜单随之卸载，面板关闭后焦点交回被右键的占位
  const items = degradedMenuItems({ detail: { label: "查看详情", icon: <Puzzle {...ICON} />, onSelect: () => api.openPanelFrom(qrAnchor(at)) }, altReason: "插件不可用时不能修改", readOnly })
  return (
    <>
      {QR_BOXES.map((b, i) => (
        <HitArea
          key={i}
          box={b}
          anchor={qrAnchor(i)}
          label={`二维码形状（占位，第 ${i + 1} 个）`}
          onClick={() => pick(i)}
          onKeyDown={(e) => {
            if (openContextMenuFromKey(e, QR_MENU_AT)) pick(i)
          }}
        />
      ))}
      {ctx.selection === "degraded" && <DegradedSelection box={QR_BOXES[at] ?? QR_BOXES[0]!} info={ctx.data.degraded as DegradedInfo | undefined} readOnly={!edit} />}
      <ContextMenu
        label="二维码形状（占位）"
        items={items}
        target={`${QR_ANCHOR}*`}
        at={staticMenu ? { anchor: qrAnchor(0), ...QR_MENU_AT } : undefined}
        defaultOpen={staticMenu}
        onTarget={(name) => pick(Math.max(0, Number(name.slice(QR_ANCHOR.length)) - 1))}
      />
    </>
  )
}

/** 「查看详情」：打开个人插件面板（「本文档缺少的插件」分组置顶）。底座 DegradedDetailButton：与保真占位「保真详情」、第 1 批图表「保真详情」同一颗（次按钮 + 外链图标，DS-52） */
function OpenPanelButton() {
  const api = usePlugins()
  return (
    <DegradedDetailButton onClick={api.openPanel}>
      查看详情
    </DegradedDetailButton>
  )
}

function MissingPluginSection() {
  return (
    <Section title="缺少的插件">
      <StaticRow label="插件">二维码形状</StaticRow>
      <StaticRow label="id">
        <code className="font-mono text-[11px] whitespace-nowrap">acme:qr-shape</code>
      </StaticRow>
      <StaticRow label="原因">管理员已停用</StaticRow>
      <StaticRow label="需要">≥ 1.0</StaticRow>
    </Section>
  )
}

/** 选中二维码占位时检查器的内容（data.degraded）；对象说明的图标由底座统一给（中性 Info），这里只写标题、一句说明与入口 */
export const QR_DEGRADED: DegradedInfo = {
  title: "二维码形状（占位）",
  about: {
    heading: (
      <span>
        插件<Nowrap>「二维码形状」</Nowrap>不可用
      </span>
    ),
    // 一句：原因 + 内容已保留（DS-52 改写）；能移动、删除、不能改大小由画布上的选中框（无缩放手柄）、右键菜单与「位置与大小」节末的原因表达
    text: <Phrases parts={["已被管理员停用，", "内容已原样保留。"]} />,
    action: <OpenPanelButton />,
  },
  // 第 1 个占位（缺省选中的那一个）的位置与大小，与画布同一个框换算（ptOf：125, 178, 186 × 186 pt）；点选另一个时换成它的（useDegradedGeometry）
  geometry: ptOf(QR_BOXES[0]!),
  // 不能改大小：W / H 留在原位不可用（工具提示写原因），节末说明写明，画布上不画缩放手柄（DegradedSelection）
  geometryProps: { ratio: false, sizeDisabled: "插件不可用时不能调整大小", note: <Phrases parts={["插件不可用时不能调整大小；", "此类对象不旋转、不翻转"]} /> },
  sections: <MissingPluginSection />,
}

/**
 * 未采纳的备选（DS-52 的另一种答案，DS-63 留作对照）：缺插件占位也能改大小——8 个缩放手柄、W / H 可改、带锁定比例，与保真占位相同。
 * 对象说明与推荐同一句（不再写「能做什么」）：能不能缩放只由画布手柄与「位置与大小」的 W / H 表达
 */
export const QR_DEGRADED_RESIZABLE: DegradedInfo = {
  ...QR_DEGRADED,
  geometryProps: undefined,
}
