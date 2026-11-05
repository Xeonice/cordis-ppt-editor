import { useEffect, useRef } from "react"
import { Info } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Person } from "../data"
import { useEditor } from "../editor/context"
import { Avatar, Button, ICON, TONE_BORDER } from "../ui"
import { CanvasHint, HintDivider } from "./FloatingPanel"
import { closeWithFocusBack } from "./layer"
import { useSceneState } from "./scene"

/**
 * 跟随（05 §4 编辑器里的跟随 + 03-11 放映里观众跟随主讲人，同一个件，rulings §4.25 DS-106「先跟随再放映」、DS-62「同一种状态只留一种画法」）——
 * 第 3 批转正时由 scenarios/present/follow.tsx 的 FollowBar / FollowFrame / EditorFollow 并入底座（kitRequest g3 K3），画法逐像素相同。
 *
 * 跟随条：画布 / 舞台顶部居中的状态胶囊——kit CanvasHint（36 高、圆角 12、panel 底、1px 边、浮层阴影，与跳页条、插入工具提示条同一外观；role=status、polite），
 * 内容：对方头像（20，身份色）· 一句状态 ┊ 一颗操作（ghost 文字按钮 28）。三种模式：
 * - following 跟随中：「正在跟随 王小明」┊「停止跟随」（rulings §4.25 TB-113：两处统一「停止跟随」）；
 * - free 自由浏览（只在放映里，03-11「观众手动翻页后自动退出跟随」）：「已停止跟随 王小明」┊「返回同步」（跳到主讲人当前页并重新跟随），常驻；
 * - lost 与主讲人失去连接（只在放映里）：中性信息图标 +「与主讲人失去连接，正在显示最后同步的页面」，没有按钮，常驻；本地翻页照常。
 * 在编辑器里同一时刻只放一条顶部提示：模式 / 操作提示（插入工具、格式刷…）出现时跟随条让位（README §9「画布顶部的提示条撞位」）。
 * hidden：放映里跟随中的跟随条随控制条一起显隐（DS-106：鼠标静止 3 秒后与控制条一起淡出）；自由浏览与失去连接常驻。
 */
export type FollowMode = "following" | "free" | "lost"

export function FollowBar({
  person,
  mode,
  onStop,
  onResync,
  hidden = false,
  touch = false,
}: {
  person: Person
  mode: FollowMode
  onStop?: () => void
  onResync?: () => void
  hidden?: boolean
  /** 触控尺寸（手机放映）：按钮 44 高的点按区 */
  touch?: boolean
}) {
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()
  return (
    // 包一层只为整体淡出（CanvasHint 自己是 absolute、pointer-events-auto）：隐藏时连同按钮都不接指针；点在跟随条上不算「单击翻页」
    <div
      onPointerDown={stop}
      onPointerUp={stop}
      onClick={stop}
      className={cn("transition-opacity duration-200 motion-reduce:transition-none", hidden && "opacity-0 [&_*]:pointer-events-none")}
    >
      <CanvasHint label="跟随">
        {mode === "lost" ? (
          <span className="flex items-center gap-2">
            <Info {...ICON} aria-hidden="true" className="shrink-0 text-(--v3-text-2)" />
            与主讲人失去连接，正在显示最后同步的页面
          </span>
        ) : (
          <>
            <span className="flex items-center gap-2">
              <Avatar name={person.name} tone={person.tone} size={20} />
              <span>
                {mode === "following" ? "正在跟随" : "已停止跟随"}
                <span className="ml-1 text-(--v3-text)">{person.name}</span>
              </span>
            </span>
            <HintDivider />
            <Button
              variant="ghost"
              onClick={mode === "following" ? onStop : onResync}
              className={cn("-mx-1.5 text-(--v3-text)", touch && "relative before:absolute before:-inset-y-2 before:inset-x-0 before:content-['']")}
            >
              {mode === "following" ? "停止跟随" : "返回同步"}
            </Button>
          </>
        )}
      </CanvasHint>
    </div>
  )
}

/**
 * 编辑器里跟随时画布列四周的 2px 外框，取对方的身份色（Figma 的跟随画法；身份色只标「谁」，质量门 Q3）：一眼看出「此刻的视口不是自己在操作」。
 * 放映里不画（放映追求沉浸，跟随条已说明）。
 */
export function FollowFrame({ person }: { person: Person }) {
  return <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 z-[19] border-2", TONE_BORDER[person.tone])} />
}

/**
 * 编辑器跟随的场景状态键（底座缺省）：值为正在跟随的人的姓名（null 为没在跟随）。头像组里他人的头像（底座 editor/chrome.tsx Collaborators，DS-106 起缺省就是「跟随 〈姓名〉」按钮，
 * 检查器协作行、网格与紧凑胶囊同一组头像）、跟随条与画布外框读写同一个键；初值取状态的 inspector.collaborators.following。
 */
export const FOLLOW_KEY = "v3.follow"

/**
 * 编辑器跟随（底座在画布列里常驻一份，跟的是谁读 key，缺省 FOLLOW_KEY）：跟随条 + 外框。跟随只同步「看什么」（当前页、视口），不同步选中与编辑（05 §4）；
 * 用户自己翻页（点缩略图、PageUp / PageDown…）即自动停止跟随、跟随条与外框消失，头像外圈随之复原（05 §4）；
 * 「停止跟随」后焦点交给画布（先交出焦点再卸载跟随条，不经过 body）；再点头像重新跟随（焦点留在头像上）。没在跟随时什么都不画。
 * 母版视图里不画（rulings §4.25 DS-157：母版视图里「跟随」不可用）：进入时宿主已停止跟随（DS-167），这里是兜底——跟随键里还留着人时也不画跟随条与外框。
 */
export function EditorFollow({ people, followKey = FOLLOW_KEY, init = null }: { people: Person[]; followKey?: string; init?: string | null }) {
  const ed = useEditor()
  const [who, setWho] = useSceneState<string | null>(followKey, init)
  const person = people.find((p) => p.name === who)
  const last = useRef(ed.slide)
  useEffect(() => {
    if (last.current === ed.slide) return
    last.current = ed.slide
    if (who) setWho(null)
  }, [ed.slide, who, setWho])
  if (!person || ed.masterView.on) return null
  return (
    <>
      <FollowFrame person={person} />
      <FollowBar
        person={person}
        mode="following"
        // 跟随条随停止卸载：焦点在条里时先交给画布再收起（kit closeWithFocusBack，不经过 body）
        onStop={() => closeWithFocusBack(() => setWho(null), null, document.querySelector('[role=status][aria-label="跟随"]'))}
      />
    </>
  )
}
