// 与 Go 侧 internal/ui/backup.go 的 backupRunRequest / backupTaskView 逐字对齐。
// 只被 backup 这一个能力用，所以留在 feature 内，不提到 shared/。

export type BackupMode = 'preflight' | 'deploy' | 'verify'
export type BackupComponent = 'all' | 'pg' | 'minio'

/** /api/servers 在本能力里只需要这两个字段，不 import servers feature 的类型。 */
export interface ServerOption {
  name: string
  role?: string
}

export interface ServersListResponse {
  servers_file: string
  default?: string
  servers: ServerOption[]
}

export interface BackupRunRequest {
  mode: BackupMode
  /** 只接受 servers.json 里的 name；后端用 404 挡未知主机。 */
  name: string
  component: BackupComponent
  /** 初始 sudo 密码：只在本次请求内存里，后端经子进程 stdin 交给 CLI。 */
  password?: string
  /** 安装必须是字面量 'yes'；后端会拒绝其它值。 */
  confirm?: string
}

export interface BackupRunResult {
  started: boolean
  mode: BackupMode
  server: string
  component: BackupComponent
}

/**
 * 一次任务的快照。`log` 是**从 after 之后的增量**，不是全量；
 * `next` 要原样喂给下一次请求（字节偏移，中文不会被切坏）。
 */
export interface BackupTask {
  running: boolean
  done: boolean
  mode: BackupMode | ''
  server: string
  component: string
  exit_code: number
  log: string
  next: number
  started_at?: string
  ended_at?: string
}
