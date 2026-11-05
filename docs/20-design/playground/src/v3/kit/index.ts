/**
 * v3 样张共享底座的统一入口：场景文件只从这里（和 ../scenarios/types）导入。
 *   import { Popover, Menu, Dialog, Banner, NumberField, SelectionBox, inspectorSection, useEditor, deckWith } from "../../kit"
 * 组件用法见 src/v3/scenarios/README.md 与 src/v3/scenarios/_kit.scenario.tsx（每个组件一个示例状态）。
 */

// 浮层
export { Popover, PopoverTitle, POPOVER_SURFACE, type PopoverProps } from "./Popover"
export { Menu, MenuItems, readOnlyMenu, READONLY_MENU_NOTE, type MenuProps, type MenuSpec, type MenuItemSpec, type MenuCheckSpec, type MenuRadioSpec, type MenuSubSpec } from "./Menu"
export { ContextMenu, type ContextMenuProps } from "./ContextMenu"
export { Dialog, type DialogProps, type DialogAction } from "./Dialog"
// 浮层里的「关闭」「取消」等按钮：useLayerClose() 拿到最近一层 Popover / Dialog 的关闭函数；LayerClose 包住写在浮层外面的按钮（Dialog footer）；
// useEscapeThroughTooltip：自己画的非模态小卡（如链接悬停卡）让 Esc 不被自动弹出的工具提示吞掉
export { useLayerClose, LayerClose, useEscapeThroughTooltip, focusBack, focusSettledElsewhere, rescueFocus, canvasFocusTarget, overlayOpen, userHasInteracted, arrivedVia } from "./layer"
// 焦点与滚动的小工具（第 2 批）：keepMovedFocus 菜单关闭时不抢回已被新面板接走的焦点；scrollIntoPanel 只滚面板自己的滚动区（不用 scrollIntoView）；
// useDemoOpen 演示用的「一出现就展开、用户第一次点按或按键后收起」；holdFocusDuring 菜单打开面板时焦点不在 body 停留（直接交给面板的落点）；
// closeWithFocusBack 收起面板时先交出焦点再卸载（交回处随收起才挂上时同步提交后立即交过去）；
// useRevealAfterMount 播报区「先挂空、下一帧填内容」的读屏版（出现后两帧里内容挡在无障碍树外，外观不变；kit Toast 与 CanvasHint announce="next-frame" 用它）；
// useFocusBackOnClose 浮层关闭时在内容卸载的同一个任务里交还焦点（不在 body 停一帧；kit Dialog / ContextMenu / Menu / Popover、底座 V3Menu 与主菜单都用它）
export { keepMovedFocus, scrollIntoPanel, useDemoOpen, holdFocusDuring, closeWithFocusBack, useRevealAfterMount, useFocusBackOnClose } from "./layer"
// 画布浮动层（查找和替换面板、页导航提示条）在 Esc 逐层里的一级：母版视图的宿主在退出之前先问它们（2026-10-29 母版视图第一步修复第 3 轮）
export { useCanvasEscape } from "./layer"
// 底座命令（第 2 批）：文档菜单、主菜单「文件 › 导出… / 保真报告」「插件…」、「分享」、上一处 / 下一处评论选了之后交给场景（useEditorCommand 登记）
export { useEditorCommand, runEditorCommand, useRunCommand, COMMAND_ENTRY, type EditorCommand } from "./commands"
export { FloatingPanel, CanvasHint, HintDivider } from "./FloatingPanel"
export { Toast, Toasts, type ToastAction } from "./Toast"
export { Banner, BannerStack, OfflineBanner, OFFLINE_TEXT, PluginBanner, failedPluginsCopy } from "./Banner"
export { PaperScope } from "./paper"
export { PlaceholderIconBar, PH_ITEMS, PH_M2_ENABLED, PH_M3_ENABLED, phItemState, type PhKind, type PhItem } from "./PlaceholderBar"
export { TableGridPicker } from "./TableGridPicker"
// 检查器整栏面板（DS-26 先例，图表「编辑数据」）：EditorConfig.inspector.takeover 直接声明，或在 regions.inspector 里随场景状态开关
export { InspectorTakeover, useTakeoverOpen, type InspectorTakeoverProps } from "./InspectorTakeover"
// 身份色 12 色板（PRD CO-03）：按用户 id 稳定取色、同屏撞色顺延
export { TONES, toneOf, assignTones, fnv1a32 } from "./tone"

// 第 3 批（应用壳族）共享件：应用壳（首页那套左栏 + 顶栏 + 横幅通道）、文档卡片（首页最近 / 文档列表 / 回收站同一个）、阻断页（登录、错误页、打开失败同一画法）、
// 右侧贴边整高的抽屉（模态 / 非模态）；页面级宿主（PageHost.tsx）的上下文 usePage（状态数据、宿主）
export {
  ShellLayout, ShellRail, ShellNavButton, ShellDefaultActions, ShellSearch, ShellHelpMenu, shellHelpItems, shellNav, SHELL_NAV,
  type ShellLayoutProps, type ShellRailProps, type ShellNavItem,
} from "./ShellLayout"
export { DocumentCard, SharedAvatars, OwnerAvatar, defaultTrailing, cardLabel, useDocHref, type DocCardData, type DocumentCardProps } from "./DocumentCard"
// 文档库的公共件（第 3 批转正：卡片网格的列表头、切换与键盘、卡片菜单、列表操作、轻提示与浮层；由文档组并入）与拖入落区
export {
  ViewSwitch, ListHead, CardList, Quoted, EmptyBlock, docCardMenu, cardAnchor, openDoc, useLibraryOps, LibraryToasts, LibraryLayers, registerDocShareLayer,
  type Layout, type LibraryHandlers, type ToastSeed, type LibrarySeed, type DocShareLayerProps,
} from "./library"
export { DropOverlay } from "./DropOverlay"
export { BlockingPage, type BlockingPageProps } from "./BlockingPage"
export { Drawer, type DrawerProps } from "./Drawer"
// 2026-10-23 第 3 批评审修改（rulings §4.25 DS-140…DS-143、TB-179…TB-182）：「导入」对话框的底座接口（对话框本身由导入场景登记，页面宿主挂 ImportDialogLayer；
// 顶栏「导入 .pptx」与拖入落区经 useOpenImportDialog 打开）、手机的模态底部面板（由 settings/sheet.tsx 并入，偏好设置与导入两处用）、文件类型图标（Tabler，TB-182）
export {
  IMPORT_DIALOG_KEY, IMPORT_ENTRY, ImportDialogLayer, registerImportDialog, useImportDialogState, useOpenImportDialog,
  type ImportDialogPhase, type ImportDialogState,
} from "./importDialog"
export { BottomSheet, type BottomSheetProps } from "./BottomSheet"
export { FileTypeIcon, FILE_TYPE_ICON_SIZE, hasFileTypeIcon, type FileTypeIconType } from "./FileTypeIcon"
export { usePage, usePageMaybe, type PageCtx } from "../page/context"

// 第 3 批转正（2026-10-22，rulings §4.25 DS-79…DS-136 拍板后）并入底座的件：卡片网格的键盘模型（TB-107）、键位写法（TB-106）、跳到别的样张状态（g2 K4）、
// 页导航提示条（03-20 §7 与放映跳页同一个件，TB-104）、页级占位（DS-52）、放映舞台作用域（舞台 token 在 v3.css）、跟随条与画布外框（DS-106）
export { ROVING_ATTR, roving, rovingItemIn, useRovingGrid } from "./roving"
export { formatChord, joinAlternatives, type Platform } from "./chord"
export { useGoTo, stateHref, goToState, stateExists, firstState } from "./nav"
export { carryInteraction } from "./layer"
export { PageJumpHint, PageJumpInput } from "./PageJump"
export { PagePlaceholder, PAGE_PLACEHOLDER } from "./PagePlaceholder"
export { StageScope } from "./stage"
export { FollowBar, FollowFrame, EditorFollow, FOLLOW_KEY, type FollowMode } from "./Follow"
// 命令面板（DS-117：不加遮罩、层级 --layer-command-palette 盖过对话框；TB-106 / TB-117；由命令面板样张并入，受控：界面状态与命令清单由调用处给）
export { CommandPalette, searchPalette, type PaletteItem, type PaletteUi, type CommandPaletteProps } from "./CommandPalette"

// 主菜单（统一条目）与缩放命令
export {
  mainMenuItems, MainMenuLayer, editItems, helpItems, FILE_ITEMS, fileItems, exportReasonOf, PASTE_VARIANTS, ZOOM_COMMANDS, INSERT_ITEMS, ARRANGE_ITEMS, pluginGroupLabel, gridGuideItems, gridGuideSub,
  GRID_GUIDE_DEFAULT,
  type MainMenuOptions, type EditMenuOptions, type GridGuidePrefs,
} from "./mainMenu"

// 场景内跨区域共享的状态
export { useSceneState, type SetSceneState } from "./scene"

// 锚点
export { ANCHORS, thumbAnchor, sectionAnchor, findAnchor, useAnchorElement, useTrackedRect, useMarkAnchorOpen, anchorPlacement, type Side, type Align, type Rect } from "./anchor"

// 检查器控件（新增）
export {
  NumberField, TextField, TextArea, ColorField, ColorChip, SwatchPicker, Slider, SliderField, Checkbox, CheckRow, RadioDot, RadioRow, Progress,
  FoldSection, FoldRow, PropRow, InspectorNotice, EmptyNote, LoadingRow, PanelState, Phrases, Switch, Tag, Kbd, KeyCap,
  type NumberFieldProps, type SwatchColor,
} from "./controls"

// 画布叠加件
export {
  SelectionBox, Marquee, HoverBox, Guide, SlideGrid, SizeTag, CanvasTag, FloatingBar, BarDivider, HitArea, RemoteCursor, PresenceTag, RemoteSelection, RemoteTextSelection, CommentPin, boxStyle, px, ptOf, type Box,
} from "./canvas"

// ui.tsx 已有的基础件（直接复用）
export {
  ICON, ICON_LG, hasCjk, Tip, IconButton, Button, V3Menu, MENU_CONTENT, MENU_ITEM, MENU_SEPARATOR, FIELD_FRAME, SELECT_FRAME, SEG_TRACK_FRAME, SEG_ON, TOGGLE_ON,
  Field, SelectTrigger, MenuField, Segmented, ToggleStrip, Swatch, Avatar, AvatarBadge, AvatarStack, Attribution, ownedLabel, Section, PanelTitle, Cols, TONE_BG, TONE_BORDER, TONE_SOFT, toneVar, reasonTip, withReason,
  type MenuEntry, type SegOption, type SwatchKey, type Tone,
} from "../ui"

// 底部工具条的公共件与评审 / 浏览形态（自定义工具条用这些拼，外观与底座一致）
export {
  ToolbarShell, SelectTool, ToolButton, MoreTool, ToolbarDivider, ToolbarLabel, CommentNav, ReviewToolbar, ViewerToolbar, HintToolbar, lockTools,
  CREATE_TOOLS, TOOLBAR_BAR, useWiredMenu, MORE_ALIAS_OUTSIDE_TEXT, type ToolId, type ToolKey, type ToolMenuId, type CommentNavWiring,
} from "../editor/Toolbar"
// 工具条插入菜单的条目（底座唯一的一份）与它们打开的面板登记（任何状态里点真实的工具条都能打开）
export { moreMenu, IMAGE_MENU, registerToolLayer, getToolLayer, type ToolLayerProps } from "../editor/insert-menus"
// 缩略图右键（左栏与网格同一份）
export { thumbMenu } from "../editor/thumb-menu"
// 编辑器外框小件（网格胶囊、母版视图左栏等自拼时用）
export {
  MainMenu, DocMenu, ViewToggle, Collaborators, ZoomMenu, AccountMenu, AccountMenuLayer, accountMenuItems, applyThemePref, ME_EMAIL, InspectorTopRow, ShareButton, PRESENT_TIP, PRESENT_KBD,
  type AccountMenuOptions, type CollaboratorsConfig, type PresencePerson,
} from "../editor/chrome"
// 「分享」按钮的宿主声明（rulings §4.25 TB-161；M2 写 inspector.share: SHARE_LATER，DS-137）
export { SHARE_LATER, SHARE_LATER_REASON, shareReasonOf, type ShareConfig } from "../editor/chrome"
// 「分享」按钮的待处理访问申请数（rulings §4.25 DS-48）：分享场景写、按钮读（场景仓 v3.share.pending，别的场景不写、缺省 0）
export { useSharePending, SHARE_PENDING_KEY } from "../editor/chrome"
// 检查器页签的受控接口（第 2 批：定位到某条评论时切到「评论」页签，01 §2.3）；「评论」页签的底座缺省内容由评论场景登记（registerCommentsBody，rulings §4.25 TB-82）
export { registerCommentsBody, useInspectorTab, type InspectorTab } from "../editor/Inspector"

// 检查器分区（ui.inspectorSection）
export {
  inspectorSection, inspectorSections, inspectorPanel, sectionsFor, getInspectorSection, listInspectorSections,
  type InspectorSectionDef, type InspectorPanelDef, type InspectorCtx, type SelectionKind, type KnownSelectionKind,
} from "../editor/inspector/registry"
export {
  ColorRow, LayoutThumb, ThemeThumb, StaticRow, BackgroundControl, ShapeActionSection, QuickStyleSection, CARD_QUICK_STYLE, NEW_SHAPE_QUICK_STYLE,
  type BackgroundControlProps, type QuickStyleSectionProps, type QuickStyleId,
} from "../editor/inspector/builtin"
// 「无法显示的对象」（selectionKind degraded）的检查器内容：保真降级与缺插件元素共用的一套分区，场景在 data.degraded 里给内容（第 2 批集成）；
// 两种占位的右键菜单也是同一份（degradedMenuItems，落点 DEGRADED_MENU_AT，⇧F10 / 菜单键用 openContextMenuFromKey 打开；评审、只读浏览与降权传 readOnly: degradedReadOnly(ctx)，编辑类命令不可用，DS-64）；
// 同一页有几个同类占位时，选中的那一个的位置与大小用 useDegradedGeometry 写进来（检查器与画布尺寸角标读同一份）
// 纸面上的降级占位（DegradedPlaceholder：虚线框 + 类型图标 + 一行标题 + 一行原因）也是同一份：保真占位与缺插件占位共用（DS-52，第 1 批缺插件状态与第 2 批同一份）
export { DegradedSelection, DegradedPlaceholder, DegradedDetailButton, degradedResizable, degradedMenuItems, degradedReadOnly, DEGRADED_MENU_AT, openContextMenuFromKey, useDegradedGeometry, type DegradedInfo, type DegradedReadOnly } from "../editor/inspector/degraded"
// 「位置与大小」：所有对象共用的几何分区与长度单位（样张按 pt 书写、产品按设置的单位显示，rulings §4.25 DS-27；只在 geometry.tsx 定义）
export { GeometrySection, LENGTH_UNIT, len, type GeometryValue, type GeometryProps, type GeoKey } from "../editor/inspector/geometry"
// 版式（底座唯一的一份）：真实渲染 LayoutArt、版式画廊（新建幻灯片 / 更换版式共用，03-14 + 03-27）、画廊状态与重置确认
export { LayoutArt, layoutName, placeholdersFor, type PhDef, type PhType, type Target as LayoutTarget } from "../editor/layouts/LayoutArt"
// LayoutArt 第二步新增的两种画法（canvas / thumb）用到的数值表与参数类型（2026-10-30）；新建页内容占位符提示的数值表（SLIDE_BODY_PROMPT_META，2026-11-04）
export { LEVELS_META, PT_PER_CQW, SLIDE_BODY_PROMPT_META, artTextStyleOf, type ArtOverride, type ArtShape, type ArtTextStyle, type ArtTone, type ThumbFrames } from "../editor/layouts/LayoutArt"
// 「版式」节标题右侧的「编辑版式」（rulings §4.25 DS-147）：内置分区与状态私有的「版式」节变体同用 useEditLayoutAction（没有母版视图入口时整个动作位不画）
export { LayoutGallery, LayoutToasts, ResetDialog, layoutOfSlide, useEditLayoutAction, useLayoutPicker, type LayoutPickerData } from "../editor/layouts/LayoutGallery"
// 内置「文本」分区（03-16）的数据：场景用 data: { text: { ...TEXT_BODY_L2, … } } 换成别的段落
export { TEXT_TITLE, TEXT_BODY_L1, TEXT_BODY_L2, TEXT_NEW_BOX, BULLET_GLYPH, AlignDistributedIcon, type TextData } from "../editor/inspector/text"

// 编辑器上下文与文档（RegionDefaults：regions 插槽第二个参数的类型，也可从 ../scenarios/types 导入）
export { useEditor, useEditorMaybe, type EditorCtx } from "../editor/context"
// 母版视图是宿主的全局模式（2026-10-28，母版视图改版第一步；editor/master/）：模式接口（= useEditor().masterView）、场景组件声明「现在不能进入」的守卫、
// 母版实现的登记口（第一步是 masters-themes/master-impl.tsx 的适配层）与不可用原因的文案常量（由 narrow/data.ts 迁入）
export { useMasterViewMode, useMasterEntryGuard, MASTER_REASON, EMBED_MASTER_REASON, TABLET_MASTER_REASON } from "../editor/master/mode"
// 手机 / 平板仅查看外壳挂载期间按设备声明的守卫（第一步修复第 1 轮：collapse 的外壳也说明原因，03-26 §1.1）
export { useViewOnlyMasterGuard } from "../editor/master/mode"
// 进出母版视图时收起另一视图的浮动层（rulings §4.25 TB-204）：画布浮动层声明开着没有与怎么收起，宿主进出时各自收起
export { useDismissOnMasterToggle } from "../editor/master/mode"
export { registerMasterView } from "../editor/master/registry"
export type { MasterViewMode, MasterViewImpl, MasterEntry, MasterMemory, MasterTarget, MasterExitOptions, MasterVia } from "../editor/master/types"
// 母版视图改版第二步（2026-10-30）：母版视图的图标（上下文条、「编辑版式」、命令面板、背景「跟随母版」共用一处）。
export { MASTER_VIEW_ICON } from "../editor/master/mode"
// 场景仓的类型（MasterViewImpl 的 onEnter / onExit / onEscape 拿到的就是它；读写一般仍用 useSceneState）
export type { SceneStore } from "../editor/scene"
// 宿主缺省命令面板的登记口（命令面板样张登记，每个有编辑器外壳的状态原地打开）
export { registerPaletteHost } from "../editor/palette-host"
// 断点形态（desktop / compact / narrow，50/09 §6.3 detectBreakpoint 同源）
export { useBreakpoint, detectBreakpoint, type Breakpoint } from "../editor/breakpoint"
export type { RegionDefaults } from "../scenarios/types"
export { DEFAULT_DECK, deckWith, slideOf, DeckSlideView, type DeckSlide, type SlideRenderOpts } from "../editor/deck"
// 示例文档页上的评论钉（第 4 页 3 条，与检查器「评论」页签的示例评论同一批人）：EditorConfig.stage.commentPins 打开时底座画布照常画它们（DS-43「编辑模式照常显示评论钉」；
// rulings §4.25 TB-83 起缺省开）；钉与左栏、网格的评论角标读评论场景登记的线程数据（registerCommentPins，与 registerCommentsBody 同一做法）
export { DECK_PINS, DeckCommentPins, registerCommentPins, type CommentPinsSource, type DeckPin } from "../editor/deck"
export { SlideArt, SlideFrame, SlideTitle, SlideFooter, SLIDE_NAMES, CARD_POS, type SlideNo } from "../SlideArt"
export { RailList, RailThumb, RailStatus, type NewSlideOption, type ThumbComments } from "../editor/LeftRail"
export { DOC_TITLE, ME, WANG, LI, ZHANG, type Person } from "../data"
