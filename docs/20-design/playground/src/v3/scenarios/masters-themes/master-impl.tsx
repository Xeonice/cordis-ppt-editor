import { registerMasterView, useEditor, type EditorCtx, type MasterTarget, type MasterViewImpl, type SceneStore } from "../../kit"
import type { InspectorConfig, RailConfig, RegionDefaults } from "../types"
import "./master-sections"
import { MASTER_COMMENTS_TAB, MasterContextBar, MasterInspectorBody, MasterOverlay, MasterToolbar } from "./MasterChrome"
import { MasterPane, masterRailNewLayout } from "./MasterRail"
import { MasterStage } from "./MasterStage"
import {
  appliedOf, datasetOf, defaultLayoutOf, editsOf, findLayout, findMaster, kindFor, liveMasters, mastersAll, MV_KEYS, phMatch, placeholdersOf, removedOf, seedPaneOf, slideLayoutId, useMasterView,
  type MvData, type Scope,
} from "./mv-state"

/**
 * 母版视图的登记处（2026-10-30 母版视图改版第二步，规格 §2.4；原地重写第一步的适配层）：把第二步的母版件按 MasterViewImpl 登记给宿主（editor/master/registry.ts），
 * 宿主在母版视图里用它们画——左栏窗格（MasterRail）、画布（MasterStage）、检查器内容与工具条、上下文条、画布列里的轻提示与母版键位（MasterChrome）。
 * 宿主与两份契约（editor/master/types.ts、EditorCtx.masterView）不动；进入 / 退出 / Esc 的四个钩子在宿主的同一条路径上同步调用，直接读写场景仓里母版视图的运行时键（MV_KEYS）。
 * 仅演示、不迁移（40/10 §3a：第一步那一行登记的就是这个路径）。
 */

/**
 * 左栏：底座 240 左栏原样（主菜单、文档菜单、同步状态），换掉三处——母版窗格、「新建版式 ▾」、没有「单页 / 网格」；降权读宿主（会话级事实）。外框传进来的 over 先展开、母版自己的字段后写。
 * 主菜单的配置（rail.menu）不写：底座把这里给的对象与状态的 rail 浅合并（Editor.tsx railCfg），写了 menu 就把状态的 rail.menu 整份顶掉
 * （集成方没配帮助链接的 helpConfigured: false 等会丢，2026-10-31 core 修复 states-C2）。「视图 › 关闭母版视图」不靠它：
 * 底座主菜单在母版视图里一律按宿主的 masterView 给母版项（editor/master/mode.ts masterMenuOption：在母版视图里即 active），状态与外框的 menu 原样传下去
 */
function Rail({ base, over }: { base: RegionDefaults["leftRail"]; over?: RailConfig }) {
  const mv = useMasterView()
  const { readonlyDegraded } = useEditor()
  return (
    <>
      {base({
        ...over,
        list: <MasterPane />,
        newSlide: masterRailNewLayout(mv),
        viewToggle: false,
        readonlyDegraded,
      })}
    </>
  )
}

/**
 * 检查器：外框（协作行、页签行、缩放）是底座的，「设计」页签换成版式 / 母版 / 占位符属性，「评论」页签留在原位、不可用；同上先展开 over。
 * 状态声明的整栏面板（inspector.takeover：保真报告、插件面板的整栏形态等）在母版视图里不画（takeover: null）：宿主进入时只隐藏、不关，
 * 面板在场景仓里仍算开着，退出后照原样显示（rulings §4.25 DS-162）
 */
function Inspector({ base, over }: { base: RegionDefaults["inspector"]; over?: InspectorConfig }) {
  const mv = useMasterView()
  return <>{base({ ...over, takeover: null, body: <MasterInspectorBody />, commentsTab: MASTER_COMMENTS_TAB, readOnly: mv.readOnly })}</>
}

/** 工具条：整块是母版自己的工具条（「占位符 ▾」排第 2、其余创建工具同普通视图；对比场景里未采纳的备选 C 末端是模式段「母版视图 · 完成」） */
function Toolbar() {
  return <MasterToolbar />
}

/**
 * 主题画廊、主题颜色和字体与应用主题后的轻提示（普通视图与母版视图共用 masters.theme.*）：进出母版视图时收起，不跟到另一边。
 * 轻提示两边各画一份（普通视图的 ThemeToast、母版视图的 MasterOverlay），读同一个键：进入时清掉，母版视图里不会把普通视图那一条换个件再画出来；
 * 退出时清掉，母版视图里应用主题的那一条不带回普通视图（rulings §4.25 DS-158、TB-204）
 */
function closeTheme(scene: SceneStore) {
  scene.set("masters.theme.gallery", false)
  scene.set("masters.theme.editor", false)
  scene.set("masters.theme.live", null)
  scene.set("masters.theme.toast", null)
}

/** 进出母版视图时清掉的运行时键：多选、占位符 / 形状选中、提示文本编辑、改名、拖拽、「占位符」菜单、右键菜单、轻提示、删除确认 */
function resetRuntime(scene: SceneStore) {
  scene.set(MV_KEYS.multi, [])
  scene.set(MV_KEYS.ph, null)
  scene.set(MV_KEYS.shape, null)
  scene.set(MV_KEYS.caret, null)
  scene.set(MV_KEYS.rename, null)
  scene.set(MV_KEYS.drag, null)
  scene.set(MV_KEYS.phTool, false)
  scene.set(MV_KEYS.phMenu, false)
  scene.set(MV_KEYS.toast, null)
  scene.set(MV_KEYS.seedToastOff, true)
  scene.set(MV_KEYS.confirm, null)
  scene.set(MV_KEYS.ctx, null)
  closeTheme(scene)
}

/** 场景仓上的当前对象（钩子不在组件里，按 useMasterView 同一套规则算）：母版清单、窗格选中、范围、当前对象的占位符 */
function sceneView(scene: SceneStore, ed: EditorCtx) {
  const d = ed.data as MvData
  const edits = editsOf(scene)
  const all = mastersAll(d, edits)
  const removed = removedOf(d, edits)
  const masters = liveMasters(all, removed)
  const raw = scene.get(MV_KEYS.pane)
  const pane = typeof raw === "string" ? raw : ""
  const master = findMaster(pane, masters)
  const layout = master ? undefined : findLayout(pane, masters)
  const segment = d.mvVariant?.scope === "segment"
  const scope: Scope = master || !layout ? "master" : segment && scene.get(MV_KEYS.scope) === "master" ? "master" : "layout"
  const objectId = scope === "master" ? (master?.id ?? layout?.master ?? "") : (layout?.id ?? "")
  const seed = seedPaneOf(d, ed.current, appliedOf(scene, ed.slide), all, d.mvRemoved ?? [])
  return { d, masters, scope, objectId, placeholders: placeholdersOf(objectId, masters, d, seed, edits), seed }
}

const impl: MasterViewImpl = {
  Rail,
  Stage: MasterStage,
  Inspector,
  Toolbar,
  Banner: MasterContextBar,
  Overlay: MasterOverlay,
  /**
   * 每次从普通视图进入：版式取 target.layout → 本页在画廊换过的（layouts.applied.<页>）→ 当前页所用的版式（按状态的数据集认，同普通视图；50/11 §2、R-05；已删的按改派）；
   * 占位符目标按 phMatch（类型族 + 索引）匹配；清掉上次留下的运行时键与主题弹层，按选中种类写编辑器的 selection。
   * 这一刻 ed 还是普通视图的上下文（宿主随后才进入），ed.current / ed.data / ed.slide 可用
   */
  onEnter(scene, ed, target: MasterTarget | null) {
    const d = ed.data as MvData
    const edits = editsOf(scene)
    const all = mastersAll(d, edits)
    const removed = removedOf(d, edits)
    const masters = liveMasters(all, removed)
    const asked = target?.layout && findLayout(target.layout, masters) ? target.layout : undefined
    const raw = asked ?? slideLayoutId(ed.current, appliedOf(scene, ed.slide), datasetOf(d.mvMasters))
    const id = findLayout(raw, masters) ? raw : defaultLayoutOf(raw, all, removed)
    const seed = seedPaneOf(d, ed.current, appliedOf(scene, ed.slide), all, d.mvRemoved ?? [])
    const ph = phMatch(target?.placeholder, placeholdersOf(id, masters, d, seed, edits))
    resetRuntime(scene)
    scene.set(MV_KEYS.pane, id)
    scene.set(MV_KEYS.scope, "layout")
    scene.set(MV_KEYS.ph, ph?.id ?? null)
    ed.setSelection(kindFor("layout", ph, 0))
  },
  /** 退出前：清同上的运行时键与主题弹层（宿主随后清空编辑器的选区、恢复位置、工具回到「选择」） */
  onExit(scene) {
    resetRuntime(scene)
  },
  /**
   * Esc 逐层里母版自己的一级（宿主先让浮层、抽屉、整栏面板与画布浮动层接，然后才问这里；接住返回 true，否则宿主退出母版视图）：
   *   ⓪ 窗格里正在拖拽重排（演示种子或指针按住）→ 取消拖拽、回弹（R-37）；
   *   ① 工具态（选了文本 / 形状…，或「占位符」工具）→ 回到「选择」（50/10 §7.4、对齐门 K2：选了工具后第一下 Esc 不越级退出）；
   *   ② 在编辑提示文本 → 退出文本编辑（占位符仍选中）；
   *   ③ 焦点在窗格 → 交给画布外框（D-07，dir §6 第 6 条）；
   *   ④ 选中了占位符或普通形状 → 取消选中；
   *   ⑤ 否则返回 false。
   */
  onEscape(scene, ed) {
    if (scene.get(MV_KEYS.drag)) {
      scene.set(MV_KEYS.drag, null)
      return true
    }
    if (ed.tool !== "select" || scene.get(MV_KEYS.phTool) === true) {
      scene.set(MV_KEYS.phTool, false)
      scene.set(MV_KEYS.phMenu, false)
      if (ed.tool !== "select") ed.setTool("select")
      return true
    }
    const v = sceneView(scene, ed)
    const ph = scene.get(MV_KEYS.ph)
    const caret = scene.get(MV_KEYS.caret) as { ph?: string } | null | undefined
    if (caret && caret.ph === ph) {
      scene.set(MV_KEYS.caret, null)
      return true
    }
    const a = document.activeElement
    if (a instanceof HTMLElement && a.closest('[role="listbox"][aria-label="母版与版式"]')) {
      const stage = document.querySelector<HTMLElement>('[data-v3-anchor="stage"]')
      if (stage) {
        stage.focus({ preventScroll: true })
        return true
      }
    }
    const shape = scene.get(MV_KEYS.shape)
    const phOn = typeof ph === "string" && v.placeholders.some((p) => p.id === ph)
    const shapeOn = typeof shape === "string" && v.objectId === v.seed && (v.d.mvShapes ?? []).some((s) => s.id === shape)
    if (!phOn && !shapeOn) return false
    scene.set(MV_KEYS.ph, null)
    scene.set(MV_KEYS.shape, null)
    scene.set(MV_KEYS.caret, null)
    const multi = scene.get(MV_KEYS.multi)
    ed.setSelection(kindFor(v.scope, undefined, Array.isArray(multi) ? multi.length : 0))
    return true
  },
  /**
   * 进入后焦点的落点（宿主在进入那一刻与提交之后各调一次）：「转到版式」带了占位符目标 → 画布上那个占位符的点选区（master-view.ph-<id>，
   * 点选区按百分比定位，进入那一次提交里就在）；否则窗格选中行；加载中或失败 → null（宿主交给画布）
   */
  entryFocus(scene, ed, target) {
    const d = ed.data as MvData
    if ((d.mvStatus ?? "ready") !== "ready") return null
    const ph = scene.get(MV_KEYS.ph)
    if (target?.placeholder && typeof ph === "string") {
      const el = document.querySelector<HTMLElement>(`[data-v3-anchor="master-view.ph-${CSS.escape(ph)}"]`)
      if (el) return el
    }
    return document.querySelector<HTMLElement>('[role="listbox"][aria-label="母版与版式"] [role="option"][aria-selected="true"]')
  },
}

registerMasterView(impl)
