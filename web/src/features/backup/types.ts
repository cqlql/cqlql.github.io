// 与 Go 侧 internal/ui/backup.go 的 backupRunRequest / backupTaskView 逐字对齐。
// 只被 backup 这一个能力用，所以留在 feature 内，不提到 shared/。

export type BackupMode = 'preflight' | 'deploy' | 'verify' | 'deps' | 'deps-uninstall' | 'once' | 'once-dry'
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
  /** 仅 mode=deps：按 PGDG 官方仓库装 postgresql-client-<n>；省略走发行版仓库。 */
  pg_major?: number
  /** 仅 mode=deps-uninstall：要卸的目标（mc / pg_client），至少一个，服务端白名单再验一次。 */
  targets?: string[]
}

/** 卸载弹窗的可勾选项；计划与影响清单全部由 Go 侧下发。 */
export interface DepsUninstallTarget {
  key: string
  label: string
  help: string
}

export interface DepsUninstallPlan {
  title: string
  description: string
  targets: DepsUninstallTarget[]
  impacts: string[]
  submit_label: string
}

/** GET /api/backup/deps 的只读状态；判定与安装计划由 Go 侧算好，前端只渲染。 */
export interface DepItem {
  name: string
  label: string
  component: string
  installed: boolean
  version: string
  optional: boolean
  source: string
  doc: string
}

export interface DepDoc {
  label: string
  url: string
}

export interface BackupDepsView {
  server: string
  component: string
  collected: boolean
  error?: string
  items: DepItem[]
  missing: string[]
  optional: string[]
  plan: string[]
  docs: DepDoc[]
  pg_major?: number
  /** 卸载弹窗的标题 / 可勾选项 / 影响清单，前端只渲染。 */
  uninstall: DepsUninstallPlan
}

/** GET /api/backup/once/plan 下发的只读动作计划；判定全在 Go 侧，前端只渲染。 */
export interface OncePlanContext {
  cron_status: string
  cron_note: string
  direction: string
  identity: string
}

export interface OncePlan {
  server: string
  component: string
  order: string
  available: boolean
  blockers: string[]
  warnings: string[]
  impact: string[]
  commands: string[]
  context: OncePlanContext
}

/** GET /api/backup/once/source：只读回显备份机 backup.env 里的**非凭证**生产端字段。 */
export interface OnceSourceItem {
  key: string
  label: string
  value: string
}

export interface OnceSourceView {
  server: string
  component: string
  collected: boolean
  fetched_at?: string
  error?: string
  pg: OnceSourceItem[]
  minio: OnceSourceItem[]
  note: string
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
