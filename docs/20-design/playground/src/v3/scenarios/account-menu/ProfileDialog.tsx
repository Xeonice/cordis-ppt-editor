import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Dialog, ME, ME_EMAIL, TextField, TONE_BG, Toast, Toasts, useSceneState } from "../../kit"

/**
 * 个人资料对话框（M3 形态；rulings §4.25 DS-91：M2 不显示「个人资料…」，M3 起出现并打开它；PRD AS-06「个人资料…」，60/15 §3.2 PATCH /users/me/profile 是 M3）：kit Dialog md 480。
 * 正文三行，行的画法同偏好设置对话框（左：名称 12px + 说明 12px text-2；右：200 宽的控件列，控件左缘对齐）：
 * - 头像：身份色底 + 白色显示名首字，只读（rulings §4.25 TB-123：头像一律身份色首字，AS-06、CO-03；avatar_url 照常按 IdP 刷新入库、只存不显示；
 *   后端没有头像上传端点，60/15 §3.2）；随显示名实时预览；
 * - 显示名：可改，1–128 字（与 60-backend/09 ck_users_display_name、60/02 建号时裁到 128 字一致），不能为空（空时行内报错、「保存」不可用并写原因）；协作者在头像、光标名签与评论里看到它；
 * - 邮箱：只读，「由组织账号提供」（登录身份来自 OIDC，改邮箱在组织的账号系统里做）。
 * 底栏「取消」「保存」。保存失败写在底栏左侧（DS-56 对话框内错误的画法），不关对话框；成功后关闭，主区底部轻提示「已更新个人资料」，
 * 账户菜单头部与协作者看到的头像随之更新（经协同 awareness 广播，其他人不必刷新）。
 */

const MAX = 128
const OPEN_KEY = "account.profile-open"
const SAVED_KEY = "account.profile-saved"

function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_200px] items-start gap-x-4">
      <div className="min-w-0 py-1.5">
        <div className="text-[12px] leading-4 text-(--v3-text)">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] leading-4 text-(--v3-text-2)">{hint}</div>}
      </div>
      <div className="flex min-h-7 min-w-0 items-center">{children}</div>
    </div>
  )
}

/** 40px 头像（kit Avatar 只有 16 / 20 / 24 三档）：同一套身份色底 + 白色首字 */
function BigAvatar({ name }: { name: string }) {
  const ch = name.trim().slice(0, 1) || ME.name.slice(0, 1)
  return (
    <span aria-hidden="true" className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[16px] leading-none font-medium text-white select-none", TONE_BG[ME.tone])}>
      {ch}
    </span>
  )
}

/** 对话框本身（page.layers）；关闭后焦点回到主区（用户行的账户菜单触发器没有锚点名，并入 kit 的请求见交付说明） */
export function ProfileDialog() {
  const [open, setOpen] = useSceneState(OPEN_KEY, true)
  const [, setSaved] = useSceneState<string | null>(SAVED_KEY, null)
  const [name, setName] = useState(ME.name)
  const trimmed = name.trim()
  const fieldError = !trimmed ? "显示名不能为空" : trimmed.length > MAX ? `最多 ${MAX} 个字` : undefined
  return (
    <Dialog
      title="个人资料"
      size="md"
      open={open}
      onOpenChange={setOpen}
      returnFocus="canvas"
      closeOnAction={false}
      secondary={{ label: "取消", onClick: () => setOpen(false) }}
      primary={{
        label: "保存",
        disabled: !!fieldError,
        reason: fieldError,
        onClick: () => {
          if (fieldError) return
          setSaved(trimmed)
          setOpen(false)
        },
      }}
      bodyClassName="flex flex-col gap-3 p-4"
    >
      <Row label="头像" hint="身份色底与显示名首字，暂不支持上传">
        <BigAvatar name={name} />
      </Row>
      <Row label="显示名" hint="协作者在头像、光标名签与评论里看到它">
        <TextField aria="显示名" value={name} onChange={setName} error={fieldError} className="w-full" />
      </Row>
      <Row label="邮箱" hint="由组织账号提供">
        <span className="truncate text-[12px] leading-4 text-(--v3-text) select-text">{ME_EMAIL}</span>
      </Row>
    </Dialog>
  )
}

/** 保存成功的轻提示（page.overlay：主区底部居中、离底 24） */
export function ProfileToast() {
  const [saved, setSaved] = useSceneState<string | null>(SAVED_KEY, null)
  if (!saved) return null
  return (
    <Toasts bottom={24}>
      <Toast tone="success" onClose={() => setSaved(null)}>
        已更新个人资料
      </Toast>
    </Toasts>
  )
}
