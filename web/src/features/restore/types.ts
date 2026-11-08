// 与 Go 侧 internal/restore/types.go 的 Snapshot / Candidate / Plan 逐字对齐。
// 只被 restore 这一个能力用，所以留在 feature 内，不提到 shared/。

export type RestoreComponent = 'pg' | 'minio'

/** /api/servers 在本能力里只需要这两个字段，不 import servers feature 的类型。 */
export interface ServerOption {
  name: string
  role?: string
}

export interface ServersListResponse {
  default?: string
  servers: ServerOption[]
}

export interface RestoreCandidate {
  id: string
  label: string
  target: string
  time: string
  size: string
  size_bytes: number
  grade: string
  checksum: string
  archive: string
  freshness: string
  objects: string
  synced: string
  selectable: boolean
  row_blockers: string[]
}

/** GET /api/restore/candidates：连不上也回一份字段齐全的完整快照。 */
export interface RestoreSnapshot {
  server: string
  component: RestoreComponent
  checked_at: string
  identity: string
  host: string
  collected: boolean
  error?: string
  cron_status: string
  cron_note: string
  heartbeat: string
  disk_free: string
  /** 没采到是 null，不是 0（硬约束 3）。展示一律用 disk_free 的 —。 */
  disk_free_kb: number | null
  pg_root: string
  pg_host: string
  pg_port: string
  pg_db: string
  pg_container: string
  pg_jobs: string
  src_url: string
  src_buckets: string
  dest_url: string
  dest_prefix: string
  direction: string
  scripts_ok: boolean
  candidates: RestoreCandidate[]
  blockers: string[]
  warnings: string[]
}

/** GET /api/restore/plan：判定全在 Go 侧，前端只渲染。 */
export interface RestorePlan {
  server: string
  component: RestoreComponent
  candidate_id: string
  db: string
  collected: boolean
  available: boolean
  busy: boolean
  cron_confirmed: boolean
  target: string
  impact: string[]
  blockers: string[]
  warnings: string[]
  commands: string[]
  row_blockers: string[]
  note: string
}

/** 任务与 backup feature 共用同一把锁 / 同一套增量日志轮询。 */
export type { BackupRunRequest, BackupTask } from '../backup/types.ts'
