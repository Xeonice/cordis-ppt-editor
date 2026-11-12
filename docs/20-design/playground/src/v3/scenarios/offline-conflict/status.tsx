import { CirclePause, CloudAlert, FileX2, KeyRound, Lock } from "lucide-react"
import { RailStatus } from "../../kit"
import { STATUS as BATCH1_STATUS } from "../main-states/bars"

/**
 * offline-conflict 场景的同步状态行（左栏文件名下方，03-02 §3.1；网格视图与紧凑形态跟在左上胶囊的文件名后）。
 * 第 1 批已拍板的各态（同步中、重连中、离线、降权）直接取 main-states/bars，不重画；这里只补 03-12 里第 1 批没有的状态行。
 * 口径（第 1 批定稿的同一行规则）：12px 图标 + 文字、text-2；本端有更改处在风险中时用警告色图标并写出条数——
 * 第 1 批的「离线 · N 项待同步」、这里的「未保存到服务器 N 项」（发起方）、「登录已过期 · N 项待同步」「协同已暂停 · N 项未同步」
 * （这两态的横幅都写着本地更改尚未同步 / 刷新会丢失，风险与离线相同，按用户实际面临的风险统一，rulings §4.25 DS-61）；
 * 其余（其余协作者的「服务器保存延迟」、只读各因）中性。
 */

const SI = { size: 12, strokeWidth: 1.75, "aria-hidden": true } as const

/*
 * 状态行里带悬停说明的文字（03-12「hover 说明」）用 kit RailStatus 的 hint：文字可聚焦（tabIndex 0），键盘用户聚焦即看到同一句说明；
 * 说明按句分行、向下展开（两行高，向右展开会盖住上一行的文件名；向下只暂时盖住「新建幻灯片」一行）。hintOpen：状态一出现就展开（kit useDemoOpen）。
 */

/** 发起方「未保存到服务器 N 项」的说明（03-12「服务器保存延迟」节）。 */
const UNSAVED_HINT = ["服务器存储暂时不可用，", "更改已暂存，恢复后自动保存"]
/** 其余协作者「服务器保存延迟」的说明（03-12 原文）。 */
const PEER_HINT = ["服务器存储暂时不可用，", "你看到的他人修改可能尚未保存"]

export const STATUS = {
  /** 第 1 批已拍板的各态（main-states/bars），原样复用 */
  ...BATCH1_STATUS,
  /** 发起方：本端有未获 db 确认的更改（03-12 INC-09）。横幅关闭后这一行保留警告指示，直到全部获确认 */
  unsaved: (
    <RailStatus icon={<CloudAlert {...SI} className="text-(--v3-warning)" />} hint={UNSAVED_HINT}>
      未保存到服务器 3 项
    </RailStatus>
  ),
  /** 同上，状态一出现就展开说明（横幅已关闭的演示） */
  unsavedHint: (
    <RailStatus icon={<CloudAlert {...SI} className="text-(--v3-warning)" />} hint={UNSAVED_HINT} hintOpen>
      未保存到服务器 3 项
    </RailStatus>
  ),
  /** 其余协作者：不出横幅，只在这一行弱提示（中性图标，03-02 §3.1 表末行） */
  peerDelay: (
    <RailStatus icon={<CloudAlert {...SI} />} hint={PEER_HINT} hintOpen>
      服务器保存延迟
    </RailStatus>
  ),
  /** 登录已过期（覆盖态 denied，50/07 §3.2）：连接已断开、写命令被拒，待重新登录；本地更改尚未同步，警告色图标 + 条数（同「离线 · N 项待同步」） */
  authExpired: <RailStatus icon={<KeyRound {...SI} className="text-(--v3-warning)" />}>登录已过期 · 3 项待同步</RailStatus>,
  /** 隔离态（关闭码 4409）：协同已暂停，刷新页面重新加入；未同步的更改刷新即丢，警告色图标 + 条数 */
  paused: <RailStatus icon={<CirclePause {...SI} className="text-(--v3-warning)" />}>协同已暂停 · 3 项未同步</RailStatus>,
  /** 名额已满以只读身份加入（readonly-degraded 之二）：「只读身份（名额已满）」与查看者的「仅查看」分开称呼（UX-19） */
  seatsFull: <RailStatus icon={<Lock {...SI} />}>只读 · 名额已满</RailStatus>,
  /** 重新登录回来的账号与原会话不同（UX-02）：按只读处理，直到横幅处理完 */
  identity: <RailStatus icon={<Lock {...SI} />}>只读 · 登录账号已变更</RailStatus>,
  /** 访问被撤销（备选画法：横幅留在编辑器上时） */
  revoked: <RailStatus icon={<Lock {...SI} />}>访问权限已变更</RailStatus>,
  /** 文档已被删除（4404）：会话结束，本地更改只能导出 */
  deleted: <RailStatus icon={<FileX2 {...SI} />}>文档已被删除</RailStatus>,
}
