// 与 Go 侧的 shared.ServerInfo / ServerStatus 一一对应（internal/shared/servers.go）。
// 🔴 字段名就是 JSON 标签，改 Go 那边必须同步改这里 —— 没有代码生成，
//    因为整个界面只有三个接口，生成器比手写更重。
//
// 只被 servers 这一个能力用，所以留在 feature 内（types.ts），不提到顶层。

/** 免密 sudo 的检查结果；空串在 Go 侧被 omitempty 丢掉，所以这里是可选字段。 */
export type SudoState = 'ok' | 'need' | 'root' | 'disabled' | 'error'

/** SSH 可达性。 */
export type SSHState = 'ok' | 'fail'

/** 清单里的 sudo.mode。 */
export type SudoMode = 'nopasswd' | 'none' | 'root'

/** 最近一次检查的缓存（不是配置；没检查过时字段全空）。 */
export interface ServerStatus {
  ssh?: SSHState
  sudo?: SudoState
  detail?: string
  checked_at?: string
}

/** 对外展示的服务器：**绝不包含私钥路径**。 */
export interface ServerInfo {
  name: string
  role: string
  user: string
  host: string
  port: number
  sudo_mode: SudoMode
  has_key: boolean
  password_configured: boolean
  note?: string
  status: ServerStatus
}

export interface ServersResponse {
  servers_file: string
  default?: string
  servers: ServerInfo[]
  /**
   * 非空 = 配置 / 清单还读不出来。🔴 后端仍回 200（不是 503）：
   * 界面里本来就有「配置」页，页面要给出去补齐的入口，而不是一条红色报错。
   */
  setup_error?: string
}

/** POST /api/check 返回的一行：CLI 表格与界面共用同一份展示模型。 */
export interface CheckRow extends ServerStatus {
  name: string
  role: string
}

/** POST /api/apply-sudo 的结果。 */
export interface ApplySudoResult {
  message: string
  already_ok: boolean
  changed: boolean
  backup_path?: string
  status: ServerStatus
}

/**
 * POST /api/open-servers-file 的结果：本机动作，用编辑器打开清单。
 * `editor` 是**实际**拉起的程序名（找不到 VSCode 会回退系统默认），别在界面上写死「已用 VSCode 打开」。
 */
export interface OpenServersFileResult {
  editor: string
  path: string
}
