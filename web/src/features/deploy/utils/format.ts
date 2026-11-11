import type {
  DeployBump,
  DeployCommand,
  DeployPlan,
  DeployStageStatus,
  DeployTask,
  ReleaseEvent,
  ReleaseHistoryView,
} from '../types.ts'
import { EMPTY_DEPLOY_PLAN, EMPTY_DEPLOY_TASK } from '../types.ts'

/**
 * 纯函数：归一化 + 前端格式提示。**不碰 DOM、不 import react / antd**，
 * 所以 `node --test` 能直接跑。
 *
 * 🔴 判定一律以 Go 侧为准：这里的 releaseGate / releaseFormatValid 只决定
 *    「按钮能不能点 / 提示什么」，服务端还会逐字再验一遍（deploy.md §10.3）。
 * 🔴 空数组红线：Go 侧已挡一道，前端 normalize 再挡一道；
 *    null / 非数组一律当 []，页面不许白屏（ui.md §11.4-5 / §12.5-3）。
 */

type Obj = Record<string, unknown>

function obj(v: unknown): Obj {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {}
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function bool(v: unknown): boolean {
  return v === true
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function strings(v: unknown): string[] {
  return arr(v).filter((x): x is string => typeof x === 'string')
}

export function normalizePlan(raw: unknown): DeployPlan {
  const o = obj(raw)
  const pf = obj(o.preflight)
  return {
    ...EMPTY_DEPLOY_PLAN,
    server: str(o.server), host: str(o.host, '—'), scope: str(o.scope, 'all'),
    remote_dir: str(o.remote_dir, '—'), image_prefix: str(o.image_prefix, '—'),
    image_tag: str(o.image_tag, '—'),
    preflight: {
      collected: bool(pf.collected),
      host: str(pf.host, '—'),
      error: str(pf.error) || undefined,
      env_line_ending: str(pf.env_line_ending, 'unknown'),
      checks: arr(pf.checks).map((c) => {
        const x = obj(c)
        return { name: str(x.name), ok: bool(x.ok), value: str(x.value, '—'), detail: str(x.detail) }
      }),
      blockers: strings(pf.blockers),
      warnings: strings(pf.warnings),
    },
    alignments: arr(o.alignments).map((a) => {
      const x = obj(a)
      return { ours: str(x.ours), theirs: str(x.theirs), diff: str(x.diff) }
    }),
    commands: arr(o.commands).map((c): DeployCommand => {
      const x = obj(c)
      return { phase: str(x.phase), cmd: str(x.cmd), note: str(x.note) }
    }),
    impact: strings(o.impact),
    warnings: strings(o.warnings),
    blockers: strings(o.blockers),
    available: bool(o.available),
    note: str(o.note, EMPTY_DEPLOY_PLAN.note),
    error: str(o.error) || undefined,
  }
}

export function normalizeHistory(raw: unknown): ReleaseHistoryView {
  const o = obj(raw)
  const items = arr(o.items).map((it): ReleaseEvent => {
    const x = obj(it)
    return {
      ts: str(x.ts), server: str(x.server), scope: str(x.scope),
      kind: str(x.kind, 'release'),
      online_version: str(x.online_version) || '未采集',
      release_version: str(x.release_version), bump: str(x.bump),
      note: str(x.note), image_tag: str(x.image_tag),
      result: str(x.result), failed_stage: str(x.failed_stage),
      task_id: str(x.task_id),
    }
  })
  return { items, server: str(o.server) || undefined, error: str(o.error) || undefined }
}

export function normalizeTask(raw: unknown): DeployTask {
  const o = obj(raw)
  return {
    ...EMPTY_DEPLOY_TASK,
    running: bool(o.running), done: bool(o.done),
    mode: str(o.mode), server: str(o.server), scope: str(o.scope),
    exit_code: num(o.exit_code), log: str(o.log), next: num(o.next),
    task_id: str(o.task_id),
    stages: arr(o.stages).map((s) => {
      const x = obj(s)
      const status = str(x.status) as DeployStageStatus
      return {
        name: str(x.name),
        status: (['wait', 'running', 'ok', 'skip', 'fail'].includes(status) ? status : 'wait') as DeployStageStatus,
        detail: str(x.detail),
      }
    }),
    gates: arr(o.gates).map((g) => {
      const x = obj(g)
      return { name: str(x.name), ok: bool(x.ok), detail: str(x.detail) }
    }),
    report: o.report !== null && typeof o.report === 'object' ? (o.report as DeployTask['report']) : undefined,
    error: str(o.error) || undefined,
    started_at: str(o.started_at) || undefined,
    ended_at: str(o.ended_at) || undefined,
  }
}

/** 三段式校验只作前端格式提示；唯一判据是服务端 ValidateRelease。 */
export function releaseFormatValid(version: string): boolean {
  return /^v?\d+\.\d+\.\d+$/.test(version.trim())
}

export function releaseNoteValid(note: string): boolean {
  if (/[\r\n]/.test(note)) return false
  if ([...note].length > 200) return false
  // eslint-disable-next-line no-control-regex
  return !/[\u0000-\u001f\u007f]/.test(note)
}

/**
 * 版本号自动推算：只在「线上版本是三段式」时成立。
 * 🔴 线上未采集 / 非三段式一律不推算、不猜 1.0.0（硬约束 3 / deploy.md §10.1）。
 */
export function bumpVersion(online: string, bump: DeployBump): string {
  if (!bump || bump === 'manual') return ''
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(online.trim())
  if (!m) return ''
  const [x, y, z] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (bump === 'major') return `${x + 1}.0.0`
  if (bump === 'minor') return `${x}.${y + 1}.0`
  return `${x}.${y}.${z + 1}`
}

export function bumpLabel(bump: string): string {
  switch (bump) {
    case 'major': return '版本升级'
    case 'minor': return '特性更新'
    case 'patch': return '修订补丁'
    case 'manual': return '手动填写'
    default: return '未选择'
  }
}

/** 徽标按 kind 优先：回滚单列，不混进成功数（deploy.md §10.2）。 */
export function historyKindLabel(ev: ReleaseEvent): string {
  if (ev.kind === 'rollback') return '回滚'
  if (ev.result === 'success') return '成功'
  if (ev.result === 'failed') return '失败'
  return '未知'
}

export function scopeLabel(scope: string): string {
  switch (scope) {
    case 'infra': return '基础设施'
    case 'ai': return 'AI 服务'
    case 'backend': return '后端'
    case 'web': return '前端'
    default: return '全部'
  }
}

/**
 * 「正式发布」按钮默认不可用：必须选了目标机、预演通过、发版信息合法、没任务在跑。
 * 服务端另有六道门 + 服务端预检门，前端这层只是别让人误点。
 */
export function releaseGate(
  plan: DeployPlan,
  version: string,
  note: string,
  running: boolean,
  server: string,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (!server.trim()) reasons.push('请先选择目标机')
  if (!plan.available || plan.blockers.length > 0) reasons.push('只读预演未通过（或有全局阻塞）')
  if (!plan.preflight.collected) reasons.push('远端只读预检没采到（不猜）')
  if (!releaseFormatValid(version)) reasons.push('发版号必须是三段式，如 1.16.1')
  if (!releaseNoteValid(note)) reasons.push('备注须单行、≤200 字、无控制字符')
  if (running) reasons.push('已有发布任务在跑')
  return { ok: reasons.length === 0, reasons }
}

/** 二次确认弹窗：逐字 yes + 三项全勾（与服务端逐字再验同一口径）。 */
export function confirmEnabled(yes: string, checks: boolean[]): boolean {
  return yes === 'yes' && checks.length === 3 && checks.every(Boolean)
}

/** antd Steps 的 status 映射；前端不自己推断阶段，只翻译 Go 侧下发的 status。 */
export function antdStepStatus(status: DeployStageStatus): 'wait' | 'process' | 'finish' | 'error' {
  switch (status) {
    case 'running': return 'process'
    case 'ok':
    case 'skip': return 'finish'
    case 'fail': return 'error'
    default: return 'wait'
  }
}
