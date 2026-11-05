import { LI, ME, WANG, ZHANG, toneOf, type Tone } from "../../kit"

/**
 * share 场景的示例数据：本部署的账号目录、各状态的成员表、访问申请与链接设置。
 * 固定人物（周明远 / 王小明 / 李雷 / 张三）沿用 data.ts 写死的身份色，第 1 批画面里他们就是这些色；
 * 其余人按用户 id 稳定取色（kit toneOf，PRD CO-03），同一个人在头像组、评论与这里是同一个色。
 */

/** 文档角色（PRD 03 §1）：链接只能授予 viewer / commenter（rulings §4.24 AL-1），owner 不在下拉里（转让所有权 P2，PRD 07 D5） */
export type Role = "editor" | "commenter" | "viewer"
export type MemberRole = Role | "owner"

/** 界面上的角色名（03-08：可编辑 / 可评审 / 可查看，所有者）；下拉里另写一句它能做什么 */
export const ROLE_LABEL: Record<MemberRole, string> = { owner: "所有者", editor: "可编辑", commenter: "可评审", viewer: "可查看" }
export const ROLE_HINT: Record<Role, string> = { editor: "编辑与评论", commenter: "查看与评论", viewer: "只能查看" }
export const ROLE_RANK: Record<MemberRole, number> = { viewer: 1, commenter: 2, editor: 3, owner: 4 }
export const ROLES: Role[] = ["editor", "commenter", "viewer"]

export interface Person {
  id: string
  name: string
  email: string
  tone: Tone
}

export interface Member extends Person {
  role: MemberRole
}

const person = (id: string, name: string, email: string, tone: Tone = toneOf(id)): Person => ({ id, name, email, tone })

/** 当前用户（账户菜单里的同一个人，邮箱同 editor/chrome.tsx 的 ME_EMAIL） */
export const SELF = person("u-zhoumy", ME.name, "zhou.mingyuan@example.com", ME.tone)
export const P_WANG = person("u-wangxm", WANG.name, "wang.xiaoming@example.com", WANG.tone)
export const P_LI = person("u-lilei", LI.name, "li.lei@example.com", LI.tone)
export const P_ZHANG = person("u-zhangsan", ZHANG.name, "zhang.san@example.com", ZHANG.tone)
export const P_CHEN = person("u-chen", "陈静", "chen.jing@example.com")
export const P_WANG_XY = person("u-wangxy", "王小雨", "wang.xiaoyu@example.com")
export const P_WEI = person("u-wei", "魏宁", "wei.ning@example.com")
export const P_ZHAO = person("u-zhao", "赵敏", "zhao.min@example.com")
export const P_ZHENG = person("u-zheng", "郑凯", "zheng.kai@example.com")
export const P_FENG = person("u-feng", "冯雪", "feng.xue@example.com")
export const P_HE = person("u-he", "何斌", "he.bin@example.com")
export const P_SUN = person("u-sunyue", "孙悦", "sun.yue@example.com")
export const P_LIU = person("u-liuyang", "刘洋", "liu.yang@example.com")

/** 「大量成员」状态里另外的 15 位同事 */
const MORE: Person[] = [
  person("u-qiancheng", "钱程", "qian.cheng@example.com"),
  person("u-linyue", "林悦", "lin.yue@example.com"),
  person("u-huanglei", "黄蕾", "huang.lei@example.com"),
  person("u-xuhang", "徐航", "xu.hang@example.com"),
  person("u-gaoyuan", "高远", "gao.yuan@example.com"),
  person("u-maxiao", "马骁", "ma.xiao@example.com"),
  person("u-hujingyi", "胡静怡", "hu.jingyi@example.com"),
  person("u-guotao", "郭涛", "guo.tao@example.com"),
  person("u-luochen", "罗晨", "luo.chen@example.com"),
  person("u-liangsi", "梁思", "liang.si@example.com"),
  person("u-songyu", "宋雨", "song.yu@example.com"),
  person("u-tangning", "唐宁", "tang.ning@example.com"),
  person("u-hanbing", "韩冰", "han.bing@example.com"),
  person("u-caoyang", "曹阳", "cao.yang@example.com"),
  person("u-dengjia", "邓佳", "deng.jia@example.com"),
]

/**
 * 本部署已有账号（邀请只对已存在账号生效，rulings §4.17 D1）。邀请框的联想按显示名前缀匹配、至少 2 个字符；
 * 邮箱只做精确匹配且不回显（60/15 §3.2 GET /users?query=，防枚举）——所以联想行只有头像与姓名，输入完整邮箱命中时显示的是用户自己输入的那串邮箱。
 */
export const DIRECTORY: Person[] = [SELF, P_WANG, P_LI, P_ZHANG, P_CHEN, P_WANG_XY, P_WEI, P_ZHAO, P_ZHENG, P_FENG, P_HE, P_SUN, P_LIU, ...MORE]

const mem = (p: Person, role: MemberRole): Member => ({ ...p, role })

/** 缺省成员表（03-08 线框：我是所有者，王小明可编辑，李雷可评审） */
export const MEMBERS_DEFAULT: Member[] = [mem(SELF, "owner"), mem(P_WANG, "editor"), mem(P_LI, "commenter")]
/** 空：只有所有者一行（正常初始态，不画空状态插画） */
export const MEMBERS_EMPTY: Member[] = [mem(SELF, "owner")]
/** 非所有者打开：我是可编辑，张三是所有者（03-08「权限不足」线框） */
export const MEMBERS_READONLY: Member[] = [mem(SELF, "editor"), mem(P_ZHANG, "owner"), mem(P_WANG, "editor"), mem(P_LI, "commenter")]
/** 大量成员（超过约 20 人出搜索框，03-08 边界情况）：24 人 */
export const MEMBERS_MANY: Member[] = [
  mem(SELF, "owner"),
  mem(P_WANG, "editor"),
  mem(P_LI, "commenter"),
  mem(P_ZHANG, "editor"),
  mem(P_CHEN, "editor"),
  mem(P_ZHAO, "commenter"),
  mem(P_ZHENG, "viewer"),
  mem(P_FENG, "commenter"),
  mem(P_HE, "viewer"),
  ...MORE.map((p, i) => mem(p, (["viewer", "commenter", "editor"] as const)[i % 3]!)),
]

/** 访问申请（PRD 07 G-56；申请人从 03-02 open-failed-access / 03-12「访问权限已变更」点「申请访问」发出，可选留言 ≤ 200 字） */
export interface AccessRequest extends Person {
  message?: string
  when: string
  /** 批准时缺省给的角色 */
  role: Role
}

export const REQUESTS: AccessRequest[] = [{ ...P_WEI, message: "周五评审要用，麻烦开一下查看权限", when: "10 分钟前", role: "viewer" }]

/** 两条待处理的申请（share.request-pending：对话框关着时「分享」按钮带待处理提示，打开后顶部「访问申请 2」） */
export const REQUESTS_PENDING: AccessRequest[] = [
  ...REQUESTS,
  { ...P_ZHAO, message: "下周客户汇报要引用第 4 页的图表", when: "1 小时前", role: "viewer" },
]

/** 链接权限（03-08 表）：仅邀请的用户（缺省，链接不授予角色）/ 登录用户凭链接可查看 / 可评审；不提供「可编辑」（AL-1） */
export type LinkAccess = "invite" | "view" | "comment"
export const LINK_LABEL: Record<LinkAccess, string> = { invite: "仅邀请的用户可访问", view: "登录用户凭链接可查看", comment: "登录用户凭链接可评审" }
export const LINK_RANK: Record<LinkAccess, number> = { invite: 0, view: 1, comment: 2 }

/** 链接有效期（PRD SV-06「可设角色与过期」、07 G-61「7 天 / 30 天 / 永不」；后端 share_links.expires_at） */
export type Expiry = "never" | "7d" | "30d"
/** 下拉触发器与菜单选项同一个名字（「永久有效」，不是触发器「永久」、菜单「永久有效」两种写法） */
export const EXPIRY_LABEL: Record<Expiry, string> = { never: "永久有效", "7d": "7 天", "30d": "30 天" }
/** 示例的「今天」是 2026-10-08：7 天 / 30 天后的到期日 */
export const EXPIRY_DATE: Record<Exclude<Expiry, "never">, string> = { "7d": "10 月 15 日", "30d": "11 月 7 日" }

/** 文档地址（50/02 §11：分享链接是 {publicUrl}/documents/{docId}#share={token}，令牌在片段里、不进请求与日志） */
export const DOC_URL = "https://cordex.example.com/documents/q2"
export const SHARE_URL = `${DOC_URL}#share=Jx8fQ2v9TkLmR4pZ0sWcYb7nHd3eGa6uVq1oNiE5rKt`
