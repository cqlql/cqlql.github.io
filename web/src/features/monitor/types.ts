/**
 * GET /api/monitor/status 的 TypeScript 投影，与 Go 侧 `monitor.Status`
 * / `internal/ui/monitorStatusView` 逐字对齐。
 *
 * 🔴 数值字段一律 `number | null`：`null` 是「没采到」，0 是「真的 0」。
 *    前端只格式化，不在这里（也不在页面里）复算 danger / 阈值 / 新鲜度
 *    —— 判据只在 Go 的 `assess()`，见 docs/backup-monitor.md §4。
 */

/** 本 feature 用到的最小投影，不 import servers 的 types.ts。 */
export interface MonitorTarget {
  name: string
  host?: string
  role?: string
}

/** /api/servers 的响应；配置缺失时仍是 200 + setup_error（硬约束 26 ④）。 */
export interface MonitorTargetsView {
  servers: MonitorTarget[]
  default?: string
  setup_error?: string
}

export interface MonitorProblem {
  level: 'danger' | 'warn' | string
  text: string
}

export interface MonitorConnection {
  ok: boolean
  latency_ms: number | null
  error: string
}

export interface PGStatus {
  collected: boolean
  has_success: boolean
  last_success_raw: string
  last_success_age_hours: number | null
  has_latest: boolean
  latest_path: string
  latest_size_mb: number | null
  latest_age_hours: number | null
  total_mb: number | null
}

export interface MinIOStatus {
  collected: boolean
  has_success: boolean
  last_success_raw: string
  last_success_age_hours: number | null
  log_size_mb: number | null
  data_size_mb: number | null
}

export interface DiskStatus {
  collected: boolean
  total_mb: number | null
  free_mb: number | null
  used_pct: number | null
}

export interface MonitorStatus {
  host: string
  checked_at: string
  remote_host: string
  connection: MonitorConnection
  pg: PGStatus
  minio: MinIOStatus
  disk: DiskStatus
  problems: MonitorProblem[]
}

/** 判定阈值只读展示：页面不改配置，只解释为什么 Go 侧报了 danger。 */
export interface MonitorThresholds {
  pg_stale_hours: number
  minio_stale_hours: number
  disk_warn_pct: number
}

export interface MonitorView {
  server: string
  status: MonitorStatus
  cached: boolean
  age_seconds: number
  notice?: string
  config_error?: string
  config_path?: string
  servers_file?: string
  thresholds: MonitorThresholds
}
