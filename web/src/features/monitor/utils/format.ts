/**
 * 备份监控页的**展示层**纯函数：兜底、格式化、文案。
 *
 * 🔴 这里不算任何指标：danger / warn、超时阈值、新鲜度全在 Go 侧 `assess()`
 *    与 `Collect()` 里算好，页面只负责把 `null` 显示成 `—`、把 0 老老实实显示成 0。
 * 🔴 Go 的 nil slice 编成 JSON 是 `null`，前端 `.map` 会白屏（docs/ui.md §11.4），
 *    所以 problems / servers 一律在这里兜成 []。
 */

import type {
  DiskStatus,
  MinIOStatus,
  MonitorConnection,
  MonitorProblem,
  MonitorStatus,
  MonitorTargetsView,
  MonitorTarget,
  MonitorThresholds,
  MonitorView,
  PGStatus,
} from '../types.ts'

export function list<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function bool(v: unknown): boolean {
  return v === true
}

function int(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0
}

/** null / 非数字 / NaN 都是「没采到」；0 是真实值，绝不能被兜成 null。 */
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function normalizeConnection(raw: unknown): MonitorConnection {
  const v = obj(raw)
  return { ok: bool(v.ok), latency_ms: num(v.latency_ms), error: str(v.error) }
}

export function normalizePG(raw: unknown): PGStatus {
  const v = obj(raw)
  return {
    collected: bool(v.collected),
    has_success: bool(v.has_success),
    last_success_raw: str(v.last_success_raw),
    last_success_age_hours: num(v.last_success_age_hours),
    has_latest: bool(v.has_latest),
    latest_path: str(v.latest_path),
    latest_size_mb: num(v.latest_size_mb),
    latest_age_hours: num(v.latest_age_hours),
    total_mb: num(v.total_mb),
  }
}

export function normalizeMinIO(raw: unknown): MinIOStatus {
  const v = obj(raw)
  return {
    collected: bool(v.collected),
    has_success: bool(v.has_success),
    last_success_raw: str(v.last_success_raw),
    last_success_age_hours: num(v.last_success_age_hours),
    log_size_mb: num(v.log_size_mb),
    data_size_mb: num(v.data_size_mb),
  }
}

export function normalizeDisk(raw: unknown): DiskStatus {
  const v = obj(raw)
  return {
    collected: bool(v.collected),
    total_mb: num(v.total_mb),
    free_mb: num(v.free_mb),
    used_pct: num(v.used_pct),
  }
}

export function normalizeProblems(raw: unknown): MonitorProblem[] {
  return list<MonitorProblem>(raw).map((p) => ({
    level: typeof p?.level === 'string' ? p.level : 'warn',
    text: typeof p?.text === 'string' ? p.text : '',
  }))
}

export function normalizeThresholds(raw: unknown): MonitorThresholds {
  const v = obj(raw)
  return {
    pg_stale_hours: num(v.pg_stale_hours) ?? 0,
    minio_stale_hours: num(v.minio_stale_hours) ?? 0,
    disk_warn_pct: num(v.disk_warn_pct) ?? 0,
  }
}

export function normalizeStatus(raw: unknown): MonitorStatus {
  const v = obj(raw)
  return {
    host: str(v.host),
    checked_at: str(v.checked_at),
    remote_host: str(v.remote_host),
    connection: normalizeConnection(v.connection),
    pg: normalizePG(v.pg),
    minio: normalizeMinIO(v.minio),
    disk: normalizeDisk(v.disk),
    problems: normalizeProblems(v.problems),
  }
}

export function normalizeView(raw: unknown): MonitorView {
  const v = obj(raw)
  return {
    server: str(v.server),
    status: normalizeStatus(v.status),
    cached: bool(v.cached),
    age_seconds: int(v.age_seconds),
    notice: str(v.notice),
    config_error: str(v.config_error),
    config_path: str(v.config_path),
    servers_file: str(v.servers_file),
    thresholds: normalizeThresholds(v.thresholds),
  }
}

/** 没采到是 `—`；0.0 是真实值。单位 `%` 紧贴数字，其余留一个空格。 */
export function fmtValue(v: number | null | undefined, unit = '', digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  const n = v.toFixed(digits)
  if (unit === '%') return `${n}%`
  return unit ? `${n} ${unit}` : n
}

/** 问题清单的 Alert 类型：danger 红 / warn 黄，其它按普通提示。 */
export function problemTone(level: string): 'error' | 'warning' | 'info' {
  if (level === 'danger') return 'error'
  if (level === 'warn') return 'warning'
  return 'info'
}

export function collectedLabel(collected: boolean): string {
  return collected ? '已采集' : '没采到'
}

/**
 * 默认目标机与 CLI 的 `Resolve` 同一顺序：清单 default > 唯一 role=backup。
 * 都不满足就留空，要求人显式选一台 —— 不擅自挑第一台（可能根本不是备份机）。
 */
export function pickDefaultServer(view: MonitorTargetsView | null): string {
  if (!view) return ''
  const servers = list<MonitorTarget>(view.servers)
  if (view.default && servers.some((s) => s.name === view.default)) return view.default
  const backups = servers.filter((s) => s.role === 'backup')
  return backups.length === 1 ? backups[0].name : ''
}

export function cacheLabel(view: MonitorView): string {
  return view.cached ? `命中服务端缓存 · ${view.age_seconds} 秒前采集` : '刚刚采集'
}

export function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
