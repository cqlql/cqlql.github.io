import type { RestoreComponent, RestorePlan, RestoreSnapshot } from '../types.ts'

/**
 * 本页所有「判定」都不在这里算：available / blockers / row_blockers / impact
 * 由 Go 侧下发，这里只做防空归一化、阶段条投影与**弹窗门禁**（服务端逐字再验）。
 * 纯函数，node --test 不需要浏览器。
 */

export const DEFAULT_TEST_DB = 'restore_test'
export const RESTORE_PHASES = ['预检', '预演', '传输 / 恢复', '验证', '报告'] as const
export type PhaseState = 'wait' | 'run' | 'done' | 'fail'

export const componentOptions: { label: string; value: RestoreComponent }[] = [
  { label: 'PostgreSQL', value: 'pg' },
  { label: 'MinIO', value: 'minio' },
]

export function componentLabel(c: string): string {
  return c === 'minio' ? 'MinIO' : c === 'pg' ? 'PostgreSQL' : c || '—'
}

const DASH = '—'

export const EMPTY_RESTORE_SNAPSHOT: RestoreSnapshot = {
  server: '', component: 'pg', checked_at: '', identity: DASH, host: DASH,
  collected: false, cron_status: '不采集（工具不读 crontab）', cron_note: '',
  heartbeat: DASH, disk_free: DASH, disk_free_kb: null,
  pg_root: DASH, pg_host: DASH, pg_port: DASH, pg_db: DASH,
  pg_container: DASH, pg_jobs: DASH,
  src_url: DASH, src_buckets: DASH, dest_url: DASH, dest_prefix: DASH,
  direction: DASH, scripts_ok: false,
  candidates: [], blockers: [], warnings: [],
}

export const EMPTY_RESTORE_PLAN: RestorePlan = {
  server: '', component: 'pg', candidate_id: '', db: DEFAULT_TEST_DB,
  collected: false, available: false, busy: false, cron_confirmed: false,
  target: DASH, impact: [], blockers: [], warnings: [], commands: [],
  row_blockers: [], note: '',
}

const str = (v: unknown, fallback = DASH) => (typeof v === 'string' && v.trim() !== '' ? v : fallback)
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** 后端可能回 ok=true + data.error，或某个字段缺失：一律补成字段齐全的快照。 */
export function normalizeRestoreSnapshot(v: unknown): RestoreSnapshot {
  const o = (v ?? {}) as Partial<RestoreSnapshot>
  const rawCandidates = Array.isArray(o.candidates) ? o.candidates : []
  return {
    ...EMPTY_RESTORE_SNAPSHOT,
    ...o,
    identity: str(o.identity), host: str(o.host),
    heartbeat: str(o.heartbeat), disk_free: str(o.disk_free),
    pg_root: str(o.pg_root), pg_host: str(o.pg_host), pg_port: str(o.pg_port),
    pg_db: str(o.pg_db), pg_container: str(o.pg_container), pg_jobs: str(o.pg_jobs),
    src_url: str(o.src_url), src_buckets: str(o.src_buckets),
    dest_url: str(o.dest_url), dest_prefix: str(o.dest_prefix),
    direction: str(o.direction),
    component: o.component === 'minio' ? 'minio' : 'pg',
    collected: o.collected === true,
    scripts_ok: o.scripts_ok === true,
    disk_free_kb: typeof o.disk_free_kb === 'number' ? o.disk_free_kb : null,
    candidates: rawCandidates.map((c) => {
      const x = (c ?? {}) as Partial<RestoreSnapshot['candidates'][number]>
      return {
        id: str(x.id, ''), label: str(x.label, ''), target: str(x.target, ''),
        time: str(x.time), size: str(x.size),
        size_bytes: typeof x.size_bytes === 'number' ? x.size_bytes : 0,
        grade: str(x.grade), checksum: str(x.checksum), archive: str(x.archive),
        freshness: str(x.freshness), objects: str(x.objects), synced: str(x.synced),
        selectable: x.selectable === true,
        row_blockers: arr(x.row_blockers),
      }
    }),
    blockers: arr(o.blockers), warnings: arr(o.warnings),
  }
}

export function normalizeRestorePlan(v: unknown): RestorePlan {
  const o = (v ?? {}) as Partial<RestorePlan>
  return {
    ...EMPTY_RESTORE_PLAN,
    ...o,
    component: o.component === 'minio' ? 'minio' : 'pg',
    db: str(o.db, DEFAULT_TEST_DB), target: str(o.target),
    collected: o.collected === true, available: o.available === true,
    busy: o.busy === true, cron_confirmed: o.cron_confirmed === true,
    impact: arr(o.impact), blockers: arr(o.blockers), warnings: arr(o.warnings),
    commands: arr(o.commands), row_blockers: arr(o.row_blockers), note: str(o.note, ''),
  }
}

/** 阶段条只从 CLI 日志里的 PHASE 标记投影；失败停在当前阶段，不许五格全绿。 */
export function restorePhases(
  log: string,
  done: boolean,
  exitCode: number,
): { name: string; state: PhaseState }[] {
  let max = 0
  for (const m of log.matchAll(/==> PHASE (\d)\/5/g)) {
    max = Math.max(max, Number(m[1]))
  }
  const failedMatch = /==> PHASE_FAILED (\d)/.exec(log)
  const failedAt = failedMatch ? Number(failedMatch[1]) : (done && exitCode !== 0 ? 3 : 0)
  return RESTORE_PHASES.map((name, i) => {
    const n = i + 1
    let state: PhaseState = 'wait'
    if (failedAt === n) state = 'fail'
    else if (n < max || (done && exitCode === 0 && n <= max)) state = 'done'
    else if (n === max) state = done && exitCode === 0 ? 'done' : 'run'
    return { name, state }
  })
}

export interface RestoreGateInput {
  component: RestoreComponent
  yes: string
  /** 计划里回显的目标库：执行时输入的库名必须与它逐字一致，否则重新取计划。 */
  planDb: string
  db: string
  db2: string
  minioConfirm: string
  checks: [boolean, boolean, boolean]
  coverProduction: boolean
  busy: boolean
}

export interface RestoreGateResult {
  ok: boolean
  needProd: boolean
  reason: string
}

/**
 * 确认弹窗门禁（与分册 §5.3 / 原型 fn-modal 一致）：
 * yes + PG 库名两次逐字比对 / MinIO 输入 YES + 三项前置全勾 + 覆盖生产额外勾。
 * 🔴 这是人的声明，不是工具验证；服务端 CLI 还会逐字再验一次。
 */
export function restoreGate(i: RestoreGateInput): RestoreGateResult {
  const db = i.db.trim()
  const needProd = i.component === 'minio' || (db !== '' && db !== DEFAULT_TEST_DB)
  const yesOK = i.yes.trim() === 'yes'
  const confirmOK = i.component === 'pg'
    ? db !== '' && db === i.db2.trim() && db === i.planDb.trim()
    : i.minioConfirm.trim() === 'YES'
  const checksOK = i.checks.every(Boolean)
  const prodOK = !needProd || i.coverProduction
  let reason = ''
  if (!yesOK) reason = '请输入 yes'
  else if (!confirmOK) reason = i.component === 'pg' ? '两次输入的目标库名要逐字一致，且等于计划里回显的库' : '请输入 YES'
  else if (!checksOK) reason = '三项前置确认要全部勾选'
  else if (!prodOK) reason = '目标是生产库 / 生产端桶，需额外勾「我确认覆盖生产」'
  else if (i.busy) reason = '已有任务在运行'
  return { ok: yesOK && confirmOK && checksOK && prodOK && !i.busy, needProd, reason }
}

/** 执行按钮门：服务端计划 available + 选中行可用 + 没有失败预演 + 不在忙。 */
export function restoreRunEnabled(
  plan: RestorePlan,
  snapshot: RestoreSnapshot,
  candidateId: string,
  busy: boolean,
  dryFailed: boolean,
): boolean {
  if (!plan.available || busy || dryFailed || !candidateId) return false
  return snapshot.candidates.some((c) => c.id === candidateId && c.selectable)
}
