/**
 * 母版、版式与主题的示例数据（与 v3 示例文档「2026 年 Q2 业绩汇报」6 页一致：
 * 第 1 页用「标题幻灯片」、第 2 页「标题和内容」、第 3–6 页「仅标题」，见 src/v3/data.ts）。
 * 文档有两个母版：Office（文档自带，关联文档自带的主题 Office）与「简约」（从开始页模板「简约」导入、尚无页面使用，关联内置主题「简约」）。
 * 内置主题 5 套（简约 / 商务 / 暗色 / 学术 / 活力）是开始页模板与编辑器主题画廊共用的唯一一份数据（rulings §4.25 DS-33，模板 = 主题 + 母版 + 版式包），
 * 每套 3 个色板变体（DS-32）；首页模板封面（CoverArt）与主题画廊的预览都按这里的配色与字体渲染。
 */

/**
 * 版式种类。content-caption 起的 4 种（内容与标题、图片与标题、标题和竖排文字、竖排标题与文本）2026-10-30 母版视图改版第二步加：只在新文档的缺省母版（NEW_DOC_MASTERS）里出现；
 * 最后 2 种（内容与图片、两栏内容与图片）2026-11-04 加：只在场景自带的母版里出现（text-edit 第 7 页用的两个版式，状态 data.mvMasters，见 mastersOfSet）。
 * 示例文档的 MASTERS 没有这 6 种（没写 mvMasters 的状态里版式画廊、检查器「版式」字段与母版视图都读 MASTERS，画面不变）
 */
export type LayoutKind =
  | "title"
  | "title-content"
  | "two-content"
  | "comparison"
  | "title-only"
  | "section"
  | "blank"
  | "content-caption"
  | "picture-caption"
  | "title-vertical"
  | "vertical-title"
  | "content-picture"
  | "two-content-picture"
export type MasterId = "office" | "simple"

export interface LayoutDef {
  id: string
  master: MasterId
  kind: LayoutKind
  name: string
  /** 使用此版式的页码 */
  pages: number[]
}

export interface MasterDef {
  id: MasterId
  name: string
  /** 合并 / 导入产生的母版带「导入」标记 */
  imported?: boolean
  /** 关联的主题 id（THEMES） */
  theme: ThemeId
  layouts: LayoutDef[]
}

/** 一个版式的定义：id 一律是「母版 id-种类」（场景自带的母版也用它拼，id 与示例文档的写法一致） */
export const layoutDef = (master: MasterId, kind: LayoutKind, name: string, pages: number[] = []): LayoutDef => ({ id: `${master}-${kind}`, master, kind, name, pages })
const L = layoutDef

export const MASTERS: MasterDef[] = [
  {
    id: "office",
    name: "Office",
    theme: "office",
    layouts: [
      L("office", "title", "标题幻灯片", [1]),
      L("office", "title-content", "标题和内容", [2]),
      L("office", "two-content", "两栏内容"),
      L("office", "comparison", "比较"),
      L("office", "title-only", "仅标题", [3, 4, 5, 6]),
      L("office", "section", "章节标题"),
      L("office", "blank", "空白"),
    ],
  },
  {
    id: "simple",
    name: "简约",
    imported: true,
    theme: "minimal",
    layouts: [L("simple", "title-content", "标题和内容"), L("simple", "title", "标题幻灯片"), L("simple", "blank", "空白"), L("simple", "title-only", "仅标题")],
  },
]

/**
 * 新文档的缺省母版（03-26 §6.7：新建的空白文档自带一个母版、11 个标准版式，多数没有页面使用，不做空状态插画）——母版视图的数据集 new-doc 用它（mv-state mastersOf）。
 * 母版 id 仍是 office、版式 id 仍是 office-<种类>，示例文档的页按版式名仍能对上（layoutOfSlide）；版式顺序同 PowerPoint 新建演示文稿。
 * 引用页由文档算（母版视图按 deck 现算用量），这里的 pages 一律留空。2026-10-30 母版视图改版第二步（规格 §3.2.8）
 */
export const NEW_DOC_MASTERS: MasterDef[] = [
  {
    id: "office",
    name: "Office",
    theme: "office",
    layouts: [
      L("office", "title", "标题幻灯片"),
      L("office", "title-content", "标题和内容"),
      L("office", "section", "章节标题"),
      L("office", "two-content", "两栏内容"),
      L("office", "comparison", "比较"),
      L("office", "title-only", "仅标题"),
      L("office", "blank", "空白"),
      L("office", "content-caption", "内容与标题"),
      L("office", "picture-caption", "图片与标题"),
      L("office", "title-vertical", "标题和竖排文字"),
      L("office", "vertical-title", "竖排标题与文本"),
    ],
  },
]

export const ALL_LAYOUTS: LayoutDef[] = MASTERS.flatMap((m) => m.layouts)

/** 场景母版数据的三个固定键：default 示例文档的两个母版 · new-doc 新文档的缺省母版（11 个版式）· single 只留首个母版 */
export type MasterSetKey = "default" | "new-doc" | "single"

/**
 * 场景的母版（状态 data.mvMasters）：三个固定键之一，或场景自带的一份母版清单（如 text-edit：第 7 页用的「内容与图片」「两栏内容与图片」只在它那一份里）；不写时是示例文档的 MASTERS。
 * 母版视图的数据集（mv-state datasetOf）与普通视图的版式画廊、检查器「版式」字段、按页认版式（LayoutGallery layoutOfSlide）读同一份，进入母版视图前后对得上
 */
export function mastersOfSet(set: MasterSetKey | readonly MasterDef[] | undefined): readonly MasterDef[] {
  if (typeof set === "object") return set
  if (set === "new-doc") return NEW_DOC_MASTERS
  if (set === "single") return MASTERS.slice(0, 1)
  return MASTERS
}

export const masterOf = (id: MasterId): MasterDef => MASTERS.find((m) => m.id === id) ?? MASTERS[0]!
/** 按 id 找版式：在 masters 的全部版式里找（缺省示例文档的母版；场景自带母版时传 mastersOfSet 的结果） */
export const layoutOf = (id: string, masters: readonly MasterDef[] = MASTERS): LayoutDef | undefined => masters.flatMap((m) => m.layouts).find((l) => l.id === id)
/** 母版的引用页数 = 其全部版式的引用页数之和 */
export const masterPages = (m: MasterDef): number[] => m.layouts.flatMap((l) => l.pages)

/* ------------------------------------------------------------------ 主题（03-28） */

/**
 * office：示例文档自带的主题（导入的 pptx，不在内置清单里，主题画廊里以首位「当前」卡出现，03-28 §1）；
 * 其余 5 个是内置主题，id 与开始页模板的封面 id 相同（CoverId）。
 */
export type BuiltinThemeId = "minimal" | "business" | "dark" | "academic" | "vibrant"
export type ThemeId = "office" | BuiltinThemeId

export interface ThemeSlot {
  key: string
  /** 产品化名称（不露 lt1 / accent1 这类标识，03-28 §2） */
  label: string
  hex: string
}

/**
 * 幻灯片内容 token（.v3-slide 的 --s-*）在这个主题下的取值：主题画廊的预览、套用后的左栏 / 网格 / 画布与开始页模板封面都读它。
 * bg 为页面底色（背景 1）；a2–a6 是强调色 2–6（模板封面用到的色块）。文字色（ink、body）对 bg 均 ≥ 4.5:1（03-28 §7 color-contrast）。
 */
export interface SlideTokens {
  bg: string
  ink: string
  body: string
  mute: string
  line: string
  card: string
  brand: string
  brandSoft: string
  brandMid: string
  note: string
  a2: string
  a3: string
  a4: string
  a5: string
  a6: string
}

export interface ThemeDef {
  id: ThemeId
  name: string
  heading: string
  body: string
  /** 深色文档主题（与编辑器界面的亮 / 暗无关，03-28 §5） */
  dark?: boolean
  /** 整页用衬线（学术：标题与正文都是思源宋体） */
  serif?: boolean
  /** 12 个色槽：背景 1、文字 1、背景 2、文字 2、强调色 1–6、超链接、已访问链接 */
  slots: ThemeSlot[]
  /** 每主题 3 个变体（色条显示的三个颜色，rulings §4.25 DS-32） */
  variants: [string, string, string][]
  /** 主题缩略（检查器主题卡）：上面一整块 + 下面四小块 */
  thumb: [string, string, string, string, string]
  /** 幻灯片内容 token；office 用 .v3-slide 的缺省值（v3.css），不写 */
  tokens?: SlideTokens
  /** 预览与套用的 CSS 类（由 THEME_CSS 生成，放在幻灯片外层或幻灯片本身）；office 是示例文档本身的配色，不加类 */
  className?: string
}

const SLOT_LABELS = ["背景 1", "文字 1", "背景 2", "文字 2", "强调色 1", "强调色 2", "强调色 3", "强调色 4", "强调色 5", "强调色 6", "超链接", "已访问链接"]
const SLOT_KEYS = ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"]
const slots = (hex: string[]): ThemeSlot[] => SLOT_LABELS.map((label, i) => ({ key: SLOT_KEYS[i]!, label, hex: hex[i] ?? "#000000" }))

/** 示例文档自带的主题「Office」：配色即 v3.css 里 .v3-slide 的缺省 token。 */
export const OFFICE_THEME: ThemeDef = {
  id: "office",
  name: "Office",
  heading: "思源黑体",
  body: "思源黑体",
  slots: slots(["#FFFFFF", "#141B2D", "#F4F6FB", "#4B566B", "#3A5CE6", "#7F98F1", "#AFC0F8", "#1F2A5C", "#5E9684", "#F0A030", "#3A5CE6", "#6A4CFF"]),
  variants: [
    ["#3A5CE6", "#AFC0F8", "#141B2D"],
    ["#0F8B8D", "#9ED8D4", "#13263A"],
    ["#C2410C", "#F2C48D", "#2B1D12"],
  ],
  thumb: ["#3A5CE6", "#141B2D", "#8A93A6", "#AFC0F8", "#E8EDFD"],
}

/**
 * 内置主题 5 套（rulings §4.25 DS-33）：与开始页「从模板开始」的 5 个模板同名、同配色、同字体——模板封面（CoverArt）读 tokens 画，
 * 主题画廊的卡片用示例文档第 2 页套上同一组 tokens 预览。原 Office / 极简灰 / 暖色商务 / 深色科技 4 套作废。
 */
const BUILTIN_DEFS: (Omit<ThemeDef, "id" | "className"> & { id: BuiltinThemeId })[] = [
  {
    id: "minimal",
    name: "简约",
    heading: "苹方",
    body: "苹方",
    slots: slots(["#FFFFFF", "#111111", "#F3F4F6", "#4B5563", "#111111", "#4B5563", "#8A8F9B", "#C7CBD2", "#2563EB", "#E5E7EB", "#2563EB", "#6D28D9"]),
    variants: [
      ["#111111", "#8A8F9B", "#F3F4F6"],
      ["#1F2937", "#9CA3AF", "#FFFFFF"],
      ["#4B5563", "#E5E7EB", "#2563EB"],
    ],
    thumb: ["#111111", "#4B5563", "#8A8F9B", "#C7CBD2", "#F3F4F6"],
    tokens: {
      bg: "#FFFFFF", ink: "#111111", body: "#4B5563", mute: "#8A8F9B", line: "#E5E7EB", card: "#F3F4F6",
      brand: "#111111", brandSoft: "#EDEDED", brandMid: "#9AA1AF", note: "#F3F4F6",
      a2: "#4B5563", a3: "#8A8F9B", a4: "#C7CBD2", a5: "#2563EB", a6: "#E5E7EB",
    },
  },
  {
    id: "business",
    name: "商务",
    heading: "思源黑体",
    body: "思源黑体",
    slots: slots(["#FFFFFF", "#14284B", "#F3F5F9", "#6B7280", "#4F7BFF", "#14284B", "#8FB0FF", "#C9D0DC", "#0F8B8D", "#F0A030", "#4F7BFF", "#6A4CFF"]),
    variants: [
      ["#4F7BFF", "#14284B", "#C9D0DC"],
      ["#0F8B8D", "#13263A", "#BFD9D6"],
      ["#C2410C", "#2B1D12", "#F2C48D"],
    ],
    thumb: ["#4F7BFF", "#14284B", "#8FB0FF", "#C9D0DC", "#F3F5F9"],
    tokens: {
      bg: "#FFFFFF", ink: "#14284B", body: "#6B7280", mute: "#9AA3B2", line: "#C9D0DC", card: "#F3F5F9",
      brand: "#4F7BFF", brandSoft: "#E5ECFF", brandMid: "#A8BEFF", note: "#EEF3FF",
      a2: "#14284B", a3: "#8FB0FF", a4: "#C9D0DC", a5: "#0F8B8D", a6: "#F0A030",
    },
  },
  {
    id: "dark",
    name: "暗色",
    heading: "Inter",
    body: "思源黑体",
    dark: true,
    slots: slots(["#0E1116", "#FFFFFF", "#1A1F29", "#8A93A5", "#5B7CFF", "#22D3EE", "#34D399", "#F472B6", "#FBBF24", "#8A93A5", "#7DD3FC", "#C4B5FD"]),
    variants: [
      ["#5B7CFF", "#22D3EE", "#0E1116"],
      ["#34D399", "#5B7CFF", "#0E1116"],
      ["#FBBF24", "#F472B6", "#0E1116"],
    ],
    thumb: ["#5B7CFF", "#0E1116", "#22D3EE", "#34D399", "#1A1F29"],
    tokens: {
      bg: "#0E1116", ink: "#FFFFFF", body: "#8A93A5", mute: "#6B7385", line: "#232A36", card: "#1A1F29",
      brand: "#5B7CFF", brandSoft: "#1E2640", brandMid: "#3F55B8", note: "#1A1F29",
      a2: "#22D3EE", a3: "#34D399", a4: "#F472B6", a5: "#FBBF24", a6: "#8A93A5",
    },
  },
  {
    id: "academic",
    name: "学术",
    heading: "思源宋体",
    body: "思源宋体",
    serif: true,
    slots: slots(["#F4EEE2", "#2B2622", "#EAE2D3", "#6B6258", "#7A2E22", "#2F4F6F", "#A47A3B", "#5E7A57", "#6B6258", "#C9B99A", "#2F4F6F", "#7A2E22"]),
    variants: [
      ["#7A2E22", "#2B2622", "#F4EEE2"],
      ["#2F4F6F", "#2B2622", "#F4EEE2"],
      ["#5E7A57", "#2B2622", "#EFE9DA"],
    ],
    thumb: ["#7A2E22", "#2B2622", "#2F4F6F", "#A47A3B", "#EAE2D3"],
    tokens: {
      bg: "#F4EEE2", ink: "#2B2622", body: "#6B6258", mute: "#9A8F82", line: "#D8CDB9", card: "#EAE2D3",
      brand: "#7A2E22", brandSoft: "#EBD9CE", brandMid: "#B8857A", note: "#EDE4D4",
      a2: "#2F4F6F", a3: "#A47A3B", a4: "#5E7A57", a5: "#6B6258", a6: "#C9B99A",
    },
  },
  {
    id: "vibrant",
    name: "活力",
    heading: "Inter",
    body: "苹方",
    slots: slots(["#FFFFFF", "#1B1B1F", "#FFF4EE", "#6B6F7A", "#FF6B4A", "#FFC83D", "#2BB8A5", "#5B6CFF", "#B455E0", "#1B1B1F", "#2B6CFF", "#B455E0"]),
    variants: [
      ["#FF6B4A", "#FFC83D", "#2BB8A5"],
      ["#5B6CFF", "#FF6B4A", "#FFC83D"],
      ["#B455E0", "#2BB8A5", "#FFC83D"],
    ],
    thumb: ["#FF6B4A", "#1B1B1F", "#FFC83D", "#2BB8A5", "#FFF4EE"],
    tokens: {
      bg: "#FFFFFF", ink: "#1B1B1F", body: "#6B6F7A", mute: "#9A9DA6", line: "#ECE7E3", card: "#FFF4EE",
      brand: "#FF6B4A", brandSoft: "#FFE6DE", brandMid: "#FFB09C", note: "#FFF1EA",
      a2: "#FFC83D", a3: "#2BB8A5", a4: "#5B6CFF", a5: "#B455E0", a6: "#1B1B1F",
    },
  },
]

export const BUILTIN_THEMES: ThemeDef[] = BUILTIN_DEFS.map((t) => ({ ...t, className: `mt-theme-${t.id}` }))

/** 全部主题：示例文档自带的 Office + 内置 5 套 */
export const THEMES: ThemeDef[] = [OFFICE_THEME, ...BUILTIN_THEMES]

export const themeOf = (id: ThemeId): ThemeDef => THEMES.find((t) => t.id === id) ?? THEMES[0]!
export const isBuiltinTheme = (id: ThemeId): id is BuiltinThemeId => BUILTIN_THEMES.some((t) => t.id === id)

/** 衬线字体栈（与 v3.css 的 .v3-serif 相同） */
const SERIF = 'Georgia, "Songti SC", "STSong", "Noto Serif CJK SC", serif'

/**
 * 内置主题的 CSS（文档内容的颜色，不是界面 token；Q3「文档内容颜色不受限」），由 V3Root 挂一次（ThemeStyles）。
 * 做法：在幻灯片外层（或幻灯片本身）加 mt-theme-<id> 类，改写 .v3-slide 上的 --s-* 内容 token 与底色；学术整页衬线。
 * 示例文档第 2、3、6 页全部引用 --s-*，所以能整页换色；第 1、4、5 页的部分图形用的是显式颜色，按 03-28 §5 保持不变。
 * 主题编辑面板里正在改的颜色（mt-live-*）与标题衬线预览（mt-font-serif）排在各主题之后，同权重时覆盖主题配色：只作为画布上的本地预览（不写文档、缩略图不变）。
 */
export const THEME_CSS: string = [
  ...BUILTIN_THEMES.map((t) => {
    const k = t.tokens!
    const decl = [
      `--s-ink:${k.ink}`, `--s-body:${k.body}`, `--s-mute:${k.mute}`, `--s-line:${k.line}`, `--s-card:${k.card}`,
      `--s-brand:${k.brand}`, `--s-brand-soft:${k.brandSoft}`, `--s-brand-mid:${k.brandMid}`, `--s-note:${k.note}`,
      `--s-a2:${k.a2}`, `--s-a3:${k.a3}`, `--s-a4:${k.a4}`, `--s-a5:${k.a5}`, `--s-a6:${k.a6}`,
      `background-color:${k.bg}`,
      ...(t.serif ? [`font-family:${SERIF}`, "letter-spacing:0"] : []),
    ].join(";")
    return `.${t.className} .v3-slide,.v3-slide.${t.className}{${decl}}`
  }),
  // 外层元素给出 --mt-a1 / --mt-dk1，浅色调随强调色派生
  ".mt-live-a1 .v3-slide{--s-brand:var(--mt-a1);--s-brand-soft:color-mix(in srgb,var(--mt-a1) 16%,white);--s-brand-mid:color-mix(in srgb,var(--mt-a1) 50%,white);--s-note:color-mix(in srgb,var(--mt-a1) 9%,white)}",
  ".mt-live-dk1 .v3-slide{--s-ink:var(--mt-dk1)}",
  // 标题字体映射到衬线（思源宋体）；正文字体不变
  `.mt-font-serif .v3-slide :is(h1,h2){font-family:${SERIF};letter-spacing:0}`,
].join("\n")

export const FONTS = ["思源黑体", "思源宋体", "苹方", "Inter", "Georgia"]

/** 颜色选择器（03-16 同款内容）：标准色与最近使用 */
export const STANDARD_COLORS = [
  { hex: "#C0392B", name: "深红" },
  { hex: "#E8553A", name: "橙红" },
  { hex: "#F0A030", name: "橙黄" },
  { hex: "#F5D547", name: "黄色" },
  { hex: "#5E9684", name: "青绿" },
  { hex: "#2E8B57", name: "绿色" },
  { hex: "#0F8B8D", name: "孔雀绿" },
  { hex: "#2D9CDB", name: "天蓝" },
  { hex: "#1F2A5C", name: "藏青" },
  { hex: "#6A4CFF", name: "紫色" },
]
export const RECENT_COLORS = [
  { hex: "#3A5CE6", name: "品牌蓝" },
  { hex: "#141B2D", name: "深墨" },
  { hex: "#AFC0F8", name: "品牌蓝 · 浅 50%" },
]
