import { useEffect } from "react"
import { AccountMenuLayer, ME, SHARE_LATER } from "../../kit"
import { HomeBody } from "../../HomeBody"
import { SAVE_STATUS } from "../find-view-undo/chrome"
import { defineScenario } from "../types"
import { homeData } from "../home/HomeMain"
import { ProfileDialog, ProfileToast } from "./ProfileDialog"

/**
 * 账户菜单（PRD AS-06；开始页左栏用户行、编辑器右上自己的头像、文档列表三处同一份，DS-18）：第 3 批补齐条目并按角色、里程碑增减。
 * 宿主：开始页（从用户行打开，向上、左对齐、最小宽 220）；编辑器两态（从自己的头像打开，向下、与头像左缘对齐）。
 * 2026-10-22 拍板（rulings §4.25 DS-89、DS-90、DS-91）：条目就是底座的 accountMenuItems（editor/chrome.tsx，第 3 批转正时由本目录原 items.tsx 并入，三处同一份）；
 * 状态按角色 / 里程碑 / 嵌入给参数（ShellLayout accountMenu、AccountMenuLayer options），「偏好设置…」「键盘快捷键」「退出登录」经底座命令发出。
 * DS-91 采纳了原备选「M3 前不显示」：原 alt-profile-hidden 并入 member 后删除；原推荐（M2 原位不可用标 M3）改名 alt-profile-m2、标「未采纳」（DS-63）。
 */

/**
 * 演示「仍可聚焦」：菜单一出现就把焦点放到「个人资料…」上（铺 panel-2 高亮，读屏念「个人资料…，M3，不可用，后续版本提供」）。
 * 只为截图定格，用户第一次操作后照常。
 */
function FocusProfileItem() {
  useEffect(() => {
    const t = window.setTimeout(() => {
      const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) => el.textContent?.includes("个人资料"))
      item?.focus()
    }, 350)
    return () => window.clearTimeout(t)
  }, [])
  return null
}

export default defineScenario({
  id: "account-menu",
  title: "账户菜单",
  specs: ["03-29", "03-02"],
  batch: 3,
  host: "home",
  summary: "三处同一份：主题三项 · 偏好设置 · 键盘快捷键 ·（管理员）管理 · 帮助中心 · 退出登录；个人资料 M3 起出现",
  page: { shell: { accountMenuOpen: true }, body: <HomeBody /> },
  states: [
    {
      id: "member",
      title: "普通成员（M2，开始页用户行）",
      note:
        "PRD AS-06 的全部条目，按 DS-18 的分组：头部（24px 头像 · 姓名 12px 600 · 邮箱 12px text-2，只是标识、不可聚焦）┊ 主题（小标题）浅色 / 深色 / 跟随系统 ┊ 偏好设置… ⌘, · 键盘快捷键 ⌘/ · 帮助中心 ↗ ┊ 退出登录。" +
        "rulings §4.25 DS-91（采纳原备选「M3 前不显示」，原 alt-profile-hidden 并入这一态）：M2 不显示「个人资料…」与它下面的分隔线，菜单从头部直接到主题；M3 起出现（见 admin、profile-dialog）；原推荐「M2 留在原位、不可用并标 M3」未采纳，见 alt-profile-m2。" +
        "DS-90：主题三项单选，与设置「外观 › 主题」同一偏好、同一组取值（出厂缺省「跟随系统」，03-23）；选了菜单不关、立即换肤（kit Menu 单选缺省不关）。「偏好设置…」打开偏好设置（开始页上叠在主区之上，settings.from-home）、「键盘快捷键」打开快捷键面板（开始页上浮在主区右上，DS-115），都经底座命令发出；" +
        "帮助中心按 DS-89 同一规则：集成方配置了才出现，新标签页打开、右侧 12px 外链图标（ExternalLink 方框加箭头，同帮助菜单）；没配置时这一项不出现、也不占位。头部头像是身份色首字（TB-123：头像一律身份色首字，avatar_url 只存不显示）。没有图标的列（只有「管理」带盾牌图标，管理员才有，见 admin）。" +
        "退出登录走 OIDC 登出（POST /auth/logout，有 endSessionUrl 时整页跳 IdP，否则回 /login，TB-41 清理本机缓存）；有未同步更改时的确认见 shell-pages（登录与错误页组，TB-122）",
      page: { data: homeData({ milestone: "M2" }) },
    },
    {
      id: "admin",
      title: "平台管理员（M3）",
      note: "AS-06、03-32 §1（rulings §4.23 PM-01、PM-06）：platformRole='admin' 时在「键盘快捷键」与「帮助中心」之间多一项「管理」——16px 盾牌图标 + 右侧弱化小字「插件」（text-2），点了直接进 /admin/plugins「管理 › 插件」（M3 管理面板只有这一页，不经中转页）；这一项带图标，同一面板里其余条目随之留出图标列（kit Menu 规则，文字左缘对齐）。M3 起「个人资料…」出现在头部与主题之间（rulings §4.25 DS-91，打开 profile-dialog）。普通成员不显示「管理」、也不占位（M3 的成员菜单见 home.admin-denied）",
      page: { shell: { accountMenu: { milestone: "M3", admin: true } }, data: homeData({ milestone: "M3" }) },
    },
    {
      id: "profile-dialog",
      title: "个人资料对话框（M3）",
      note: "rulings §4.25 DS-91 的 M3 形态：账户菜单「个人资料…」打开 kit Dialog md 480「个人资料」，正文三行（行的画法同偏好设置对话框：左名称 + 说明，右 200 宽控件列）：头像——身份色底 + 白色显示名首字，只读、随显示名实时预览（TB-123：头像一律身份色首字，AS-06、CO-03；avatar_url 照常按 IdP 刷新入库、只存不显示；没有头像上传端点，60/15 §3.2，不做上传）；显示名——可改（TextField，1–128 字，与 60-backend/09 ck_users_display_name、60/02 建号时裁到 128 字一致；空时行内报错「显示名不能为空」、超长「最多 128 个字」，「保存」不可用并写原因）；邮箱——只读，「由组织账号提供」。底栏「取消」·「保存」（PATCH /users/me/profile），保存失败写在底栏左侧不关对话框（DS-56），成功后关闭、轻提示「已更新个人资料」，菜单头部与协作者头像随之更新。改显示名可以在这里点着试",
      page: { shell: { accountMenuOpen: false, accountMenu: { milestone: "M3" } }, data: homeData({ milestone: "M3" }), layers: <ProfileDialog />, overlay: <ProfileToast /> },
    },
    {
      id: "editor",
      title: "在编辑器里打开",
      host: "editor",
      note: "DS-18：编辑器右上（检查器协作行）自己的头像打开同一份菜单——向下、与头像左缘对齐、落在检查器一侧，不盖画布；条目与开始页完全相同（M2 普通成员，rulings §4.25 DS-90、DS-91；2026-10-22 起第 1 批 main-states.account-menu 同一份）。键盘快捷键、帮助中心在编辑器里另在主菜单「帮助」，是第二入口、不替代这里的条目。也是设置入口（「偏好设置… ⌘,」）的对照态：标杆 Figma 主菜单 Preferences 见 benchmarks/batch3/settings 02；「分享」按 M2 留在原位、不可用，工具提示「分享 · 后续版本提供」（rulings §4.25 DS-137、TB-161：宿主传 shareUnavailable）",
      editor: { stage: { cursor: false }, inspector: { share: SHARE_LATER }, layers: <AccountMenuLayer /> },
    },
    {
      id: "embedded-logout",
      title: "嵌入：没配置登出回调",
      host: "editor",
      note:
        "嵌入形态与设置组 settings.embedded-locked 同一部署：SDK 嵌入的单人 preset（PRD EM-01 形态 A、EM-02 回调式保存；头像组只剩自己、文件名下「✓ 已保存」），集成方锁定了主题。" +
        "PRD AS-06：嵌入场景「退出登录」调集成方回调；集成方没配置回调时，这一项留在原位、不可用（FE-06：不隐藏），右侧写「由宿主应用管理登录」，读屏经 aria-describedby 念出原因。" +
        "与 rulings §4.25 DS-112「嵌入不渲染出口」不同：「返回首页」在 iframe 里没有对应的能力（没有首页可回），所以不渲染；「退出登录」是账户本身的操作，嵌入里照样有对应能力（集成方可以配置登出回调），只是这个部署没配置，所以按 FE-06 留在原位、不可用。iframe 嵌入（形态 E）同一规则按宿主在 cordex:init 的 intents 里声明的壳意图判断（rulings §4.25 TB-145）：声明了 sign-out 才可用并发 cordex:intent，没声明时就是这一态；声明了 navigate-back 才渲染「返回首页」（DS-112）。" +
        "主题被锁定时（03-23「集成方锁定态」，与设置「外观 › 主题」同一偏好，DS-90）：账户菜单的三项留在原位、不可用，勾着宿主定的那一套，组顶一行 12px 锁形 +「由宿主应用设置」（FE-06、TB-22：同一原因写一行、三项共用，读屏经 aria-describedby 念到；与设置里只读行同一句）——不能在账户菜单里绕过锁定。其余条目同普通成员",
      editor: {
        stage: { cursor: false },
        inspector: { collaborators: { people: [ME] } },
        rail: { status: SAVE_STATUS.saved },
        layers: <AccountMenuLayer options={{ embedded: true, themeLocked: true }} />,
      },
    },
    {
      id: "alt-theme-two",
      title: "未采纳 · 主题只有两项",
      note: "未采纳（DS-90 定为主题三项「浅色 / 深色 / 跟随系统」，见 member）：主题两项「浅色 / 深色」（AS-06、03-02 §7 的原写法），勾选当前实际生效的一套；在菜单里一选就把偏好固定成浅色或深色，「跟随系统」只能到设置里改回来——同一偏好在两处取值不同。其余条目同 member（DS-91：M2 不显示「个人资料…」）",
      page: { shell: { accountMenu: { themes: 2 } }, data: homeData({ milestone: "M2" }) },
    },
    {
      id: "alt-profile-m2",
      title: "未采纳 · 「个人资料…」在 M2 原位不可用、键盘停在这一项",
      note: "未采纳（DS-91 定为 M3 前不显示「个人资料…」，见 member；2026-10-22 由 profile-m2 改名）：拍板时的推荐——M2 的「个人资料…」留在原位、不可用（文字 text-3），标 M3、右侧写「后续版本提供」（text-2，可读信息；FE-06、DS-31 先例）；aria-disabled、仍可聚焦——这里键盘焦点停在这一项（panel-2 高亮），读屏念「个人资料…，M3，不可用，后续版本提供」（原因经 aria-describedby）；选了无效、菜单不关。M2 不提供只读对话框（与菜单头部内容重复）",
      page: { shell: { accountMenu: { profile: "disabled" } }, data: homeData({ milestone: "M2" }), layers: <FocusProfileItem /> },
    },
  ],
})
