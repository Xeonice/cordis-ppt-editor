import { useState, type ReactNode } from "react"
import { FlipHorizontal2, FlipVertical2, Link2, RotateCcw, Unlink2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { NumberField, Tag } from "../../kit/controls"
import { Button, Cols, FIELD_FRAME, hasCjk, ICON, IconButton, Section, ToggleStrip, type Tone } from "../../ui"
import { StaticRow } from "./parts"

/**
 * 「位置与大小」：所有对象（形状、组合、图片、视频、表格、图表、占位符、母版占位符、多选、连接符）共用的一个几何分区。
 * 同一套字段网格（X / Y ┊ W / H + 锁定比例 ┊ 旋转 + 翻转）、同一种单位写法、缺省展开，用户在对象之间切换时可以对照。
 * 长度单位只在这里定义（LENGTH_UNIT）：rulings §4.25 DS-27（§4.22 SR-4 结案）——文档与样张的数值按 pt 书写（OOXML 坐标系 960 × 540 pt），
 * 产品按设置的度量单位显示（中文缺省 cm、英文缺省 in，设计 03-23）；表格、线宽、边距、网格间距等其他长度也读它。
 * 字号与段前、段后、固定行距不读它，始终为 pt（TB-33）；引用 OOXML / PowerPoint 默认值的数字保留原单位（TB-37）。
 * 只读（评审 / 浏览 / 降权，DS-15）：与其他分区同一种只读行（StaticRow：64px 标签列 + 值左对齐），不画字段外形。
 */
export const LENGTH_UNIT = "pt"

/** 一个长度值连单位：12 → "12 pt"（单位写法统一走这里） */
export const len = (v: number | string) => `${v} ${LENGTH_UNIT}`

export type GeoKey = "x" | "y" | "w" | "h"

/** 当前值：null 表示多选时「多个值」 */
export interface GeometryValue {
  x: number | string | null
  y: number | string | null
  w: number | string | null
  h: number | string | null
  /** 旋转（度），缺省 0 */
  rotate?: number | string | null
}

export interface GeometryProps {
  value: GeometryValue
  /** 只读展示（DS-15） */
  readOnly?: boolean
  /** 整节暂不可用的原因（已锁定移动、编辑权限被降级）：字段留在原位、aria-disabled、提示写原因 */
  disabled?: string
  /** 只有 W / H 不可用的原因（如表格改尺寸 M3 提供） */
  sizeDisabled?: string
  /** 旋转一行（缺省有）；表格、图表不能旋转，写 false 并在 note 里说明 */
  rotate?: boolean
  /** 翻转切换条（缺省跟 rotate；视频没有翻转） */
  flip?: boolean
  /** 锁定比例按钮（缺省有） */
  ratio?: boolean
  /** 锁定比例的初始状态（图片缺省锁定） */
  ratioLocked?: boolean
  /** 在本页改过的字段与它们的继承值：字段右端带「重置为〈来源〉值」（占位符逐项继承，03-16） */
  overrides?: Partial<Record<GeoKey, number | string>>
  /** 继承来源的名字，如「版式」「母版」 */
  overrideFrom?: string
  /** 节末说明（12px text-2），如「图表不旋转、不翻转」「继承自版式「…」」 */
  note?: ReactNode
  /** 远端覆盖了正在看的字段（02 §4.5、03-03）：by 的身份色边框 +「已更新」；mine 是本地未提交的输入，给出「应用远端值 / 保留我的输入」 */
  remote?: { key: GeoKey; by: string; tone: Tone; value: string; mine?: string }
  /** 分区锚点（section-<分区 id>） */
  anchor?: string
  /** 标题（缺省「位置与大小」） */
  title?: string
}

const NAMES: Record<GeoKey, string> = { x: "X 坐标", y: "Y 坐标", w: "宽度", h: "高度" }
const LETTER: Record<GeoKey, string> = { x: "X", y: "Y", w: "W", h: "H" }
const str = (v: number | string | null | undefined) => (v === null || v === undefined ? null : String(v))

/** 在本页改过的数值字段：与 NumberField 同一外观，右端带「重置为〈来源〉值」。 */
function ResettableField({ k, value, inherited, from }: { k: GeoKey; value: string; inherited: string; from: string }) {
  const label = LETTER[k]
  return (
    <label className={cn(FIELD_FRAME, "flex h-7 min-w-0 items-center gap-2 pl-2 transition-colors focus-within:ring-(--v3-accent) hover:bg-(--v3-field-fill-hover)")}>
      <span className={cn("shrink-0 leading-none text-(--v3-text-2)", hasCjk(label) ? "text-[12px]" : "text-[11px]")}>{label}</span>
      <input
        defaultValue={value}
        aria-label={`${NAMES[k]}（已在本页修改，${from}值 ${len(inherited)}）`}
        inputMode="decimal"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-[12px] leading-none text-(--v3-text) tabular-nums outline-none"
      />
      <span className="shrink-0 text-[11px] leading-none text-(--v3-text-2)">{LENGTH_UNIT}</span>
      <IconButton label={`重置为${from}值 ${len(inherited)}`} size={24} className="mr-0.5 -ml-1">
        <RotateCcw {...ICON} />
      </IconButton>
    </label>
  )
}

/** 协作者身份色的外圈（写成完整类名，Tailwind 才扫描得到） */
const TONE_RING: Record<Tone, string> = {
  slate: "ring-(--v3-tone-slate)",
  sand: "ring-(--v3-tone-sand)",
  sage: "ring-(--v3-tone-sage)",
  clay: "ring-(--v3-tone-clay)",
  mist: "ring-(--v3-tone-mist)",
  olive: "ring-(--v3-tone-olive)",
  iris: "ring-(--v3-tone-iris)",
  lake: "ring-(--v3-tone-lake)",
  rose: "ring-(--v3-tone-rose)",
  denim: "ring-(--v3-tone-denim)",
  plum: "ring-(--v3-tone-plum)",
  moss: "ring-(--v3-tone-moss)",
}

/** 远端刚改过的字段：协作者身份色 2px 外圈（隔 1px 面板底）；节末一行写谁改成了什么（03-03） */
function RemoteField({ k, value, tone }: { k: GeoKey; value: string; tone: Tone }) {
  return (
    <div className={cn("relative rounded-[4px] ring-2 ring-offset-1 ring-offset-(--v3-panel)", TONE_RING[tone])}>
      <NumberField key={value} label={LETTER[k]} defaultValue={value} unit={LENGTH_UNIT} aria={`${NAMES[k]}（刚被远端更新）`} />
    </div>
  )
}

export function GeometrySection({
  value,
  readOnly,
  disabled,
  sizeDisabled,
  rotate = true,
  flip,
  ratio = true,
  ratioLocked = false,
  overrides = {},
  overrideFrom = "版式",
  note,
  remote,
  anchor,
  title = "位置与大小",
}: GeometryProps) {
  const [locked, setLocked] = useState(ratioLocked)
  const showFlip = flip ?? rotate
  const rot = str(value.rotate) ?? "0"

  if (readOnly) {
    const pos = value.x === null || value.y === null ? "多个值" : `${value.x}, ${value.y} ${LENGTH_UNIT}`
    const size = value.w === null || value.h === null ? "多个值" : `${value.w} × ${value.h} ${LENGTH_UNIT}`
    return (
      <Section title={title} anchor={anchor} bodyClassName="gap-0">
        <StaticRow label="位置">
          <span className="tabular-nums">{pos}</span>
        </StaticRow>
        <StaticRow label="大小">
          <span className="tabular-nums">{size}</span>
        </StaticRow>
        {rotate && (
          <StaticRow label="旋转">
            <span className="tabular-nums">{value.rotate === null ? "多个值" : `${rot}°`}</span>
          </StaticRow>
        )}
        {note && <p className="pt-1 text-[12px] leading-[18px] text-(--v3-text-2)">{note}</p>}
      </Section>
    )
  }

  const field = (k: GeoKey) => {
    const v = str(value[k])
    const why = disabled ?? (k === "w" || k === "h" ? sizeDisabled : undefined)
    if (remote?.key === k && !why) return <RemoteField key={k} k={k} value={remote.mine ?? remote.value} tone={remote.tone} />
    const inherited = str(overrides[k])
    if (inherited !== null && v !== null && !why) return <ResettableField key={k} k={k} value={v} inherited={inherited} from={overrideFrom} />
    return (
      <NumberField
        key={`${k}:${v ?? "mixed"}`}
        label={LETTER[k]}
        defaultValue={v ?? undefined}
        mixed={v === null}
        unit={LENGTH_UNIT}
        aria={NAMES[k]}
        disabled={!!why}
        reason={why}
      />
    )
  }

  const sizeWhy = disabled ?? sizeDisabled
  return (
    <Section title={title} anchor={anchor}>
      <Cols>
        {field("x")}
        {field("y")}
      </Cols>
      {ratio ? (
        <div className="grid grid-cols-[1fr_1fr_28px] gap-2">
          {field("w")}
          {field("h")}
          {/* 锁定比例（rulings §4.25 DS-136，TB-58 第四项）：未锁是断开的链（Unlink2），锁定是相连的链 + 按下态——图形本身说明状态，不只靠淡底（同 Figma「约束比例」）；读屏名「锁定比例」+ aria-pressed 不变 */}
          <IconButton label="锁定比例" variant={locked && !sizeWhy ? "on" : "ghost"} pressed={locked} disabled={!!sizeWhy} reason={sizeWhy} onClick={() => setLocked((v) => !v)}>
            {locked ? <Link2 {...ICON} /> : <Unlink2 {...ICON} />}
          </IconButton>
        </div>
      ) : (
        <Cols>
          {field("w")}
          {field("h")}
        </Cols>
      )}
      {rotate && (
        <Cols>
          <NumberField key={`r:${rot}`} label="旋转" defaultValue={rot} unit="°" aria="旋转角度" mixed={value.rotate === null} disabled={!!disabled} reason={disabled} />
          {showFlip && (
            <ToggleStrip
              aria="翻转"
              defaultOn={[]}
              disabled={!!disabled}
              reason={disabled}
              options={[
                { value: "h", label: "水平翻转", icon: <FlipHorizontal2 {...ICON} /> },
                { value: "v", label: "垂直翻转", icon: <FlipVertical2 {...ICON} /> },
              ]}
            />
          )}
        </Cols>
      )}
      {remote && (
        <div className="flex flex-col gap-1.5" role="status">
          <p className="flex items-center gap-1.5 text-[12px] leading-[18px] text-(--v3-text-2)">
            <Tag>已更新</Tag>
            <span>
              {remote.by} 把 {LETTER[remote.key]} 改成了 <span className="tabular-nums">{len(remote.value)}</span>
              {remote.mine ? <>，你还有未提交的输入 <span className="tabular-nums">{len(remote.mine)}</span></> : null}
            </span>
          </p>
          {remote.mine && (
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1">
                应用远端值
              </Button>
              <Button variant="secondary" className="flex-1">
                保留我的输入
              </Button>
            </div>
          )}
        </div>
      )}
      {note && <p className="text-[12px] leading-[18px] text-(--v3-text-2)">{note}</p>}
    </Section>
  )
}
