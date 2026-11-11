// 与 Go 侧 internal/deploy/{plan,deploy,uiapi}.go、internal/ui/deploy.go 逐字对齐。
// 只被 deploy 这一个 feature 用，不提到 shared/。

export type DeployScope = 'all' | 'infra' | 'ai' | 'backend' | 'web'
export type DeployBump = '' | 'major' | 'minor' | 'patch' | 'manual'
export type DeployStageStatus = 'wait' | 'running' | 'ok' | 'skip' | 'fail'

export interface DeployCheck {
  name: string
  ok: boolean
  value: string
  detail?: string
}

export interface DeployPreflight {
  collected: boolean
  host: string
  error?: string
  checks: DeployCheck[]
  env_line_ending: string
  blockers: string[]
  warnings: string[]
}

export interface DeployAlignment {
  ours: string
  theirs: string
  diff: string
}

export interface DeployCommand {
  phase: string
  cmd: string
  note?: string
}

/** GET /api/deploy/plan：P3a 只读预演的完整快照（失败也回完整空视图）。 */
export interface DeployPlan {
  server: string
  host: string
  scope: string
  remote_dir: string
  image_prefix: string
  image_tag: string
  preflight: DeployPreflight
  alignments: DeployAlignment[]
  commands: DeployCommand[]
  impact: string[]
  warnings: string[]
  blockers: string[]
  available: boolean
  note: string
  error?: string
}

/** 台账 append-only 的一行（P3b-2 的 ReleaseEvent）。 */
export interface ReleaseEvent {
  ts: string
  server: string
  scope: string
  kind: 'release' | 'rollback' | string
  online_version: string
  release_version: string
  bump: string
  note: string
  image_tag: string
  result: 'success' | 'failed' | string
  failed_stage: string
  task_id: string
}

/** GET /api/deploy/releases：items 恒为数组，失败另带 error。 */
export interface ReleaseHistoryView {
  items: ReleaseEvent[]
  server?: string
  error?: string
}

export interface DeployReleaseRequest {
  confirm: 'yes'
  server: string
  scope: DeployScope
  release_version: string
  release_note: string
  bump: DeployBump
  /** 三项发布前确认，服务端要求全 true。 */
  checks: [boolean, boolean, boolean]
}

export interface DeployRunResult {
  started: boolean
  task_id: string
  server: string
  scope: DeployScope | string
}

export interface DeployStage {
  name: string
  status: DeployStageStatus
  detail?: string
}

export interface DeployGate {
  name: string
  ok: boolean
  detail: string
}

/** 最终报告：completed / failed_stage 只认它，界面不拿事件自己算成功。 */
export interface DeployReport {
  server?: string
  scope?: string
  image_prefix?: string
  image_tag?: string
  release_version?: string
  release_note?: string
  online_version?: string
  completed: boolean
  failed_stage?: string
  error?: string
  note?: string
  ledger_recorded?: boolean
  ledger_error?: string
  duration_ms?: number
  gates?: { name: string; ok: boolean; detail: string }[]
  stages?: { name: string; ok: boolean; skipped: boolean; detail: string }[]
  warnings?: string[]
  images?: string[]
  log?: string[]
  env_line_ending?: string
  previous_tag?: string
}

/** GET /api/deploy/task：log 是 after 之后的增量，next 原样喂给下一次请求。 */
export interface DeployTask {
  running: boolean
  done: boolean
  mode: string
  server: string
  scope: string
  exit_code: number
  log: string
  next: number
  stages: DeployStage[]
  gates: DeployGate[]
  task_id: string
  report?: DeployReport
  error?: string
  started_at?: string
  ended_at?: string
}

/** /api/servers 在本能力里只需要这两个字段，不 import servers feature 的类型。 */
export interface ServerOption {
  name: string
  role?: string
}

export interface ServersListResponse {
  servers_file?: string
  default?: string
  servers: ServerOption[]
}

export const BUMP_OPTIONS: { value: DeployBump; label: string }[] = [
  { value: 'major', label: '版本升级' },
  { value: 'minor', label: '特性更新' },
  { value: 'patch', label: '修订补丁' },
  { value: 'manual', label: '手动填写' },
]

export const SCOPE_OPTIONS: { value: DeployScope; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'infra', label: '基础设施' },
  { value: 'ai', label: 'AI 服务' },
  { value: 'backend', label: '后端' },
  { value: 'web', label: '前端' },
]

export const CONFIRM_ITEMS = [
  '我已确认目标机是本次要发布的应用部署目标（不是备份服务器）',
  '我已人工核对 DB / Redis / MinIO 地址与凭证，没把测试值带进现网',
  '我确认这次是当次有效的明确授权，且发布过程中有人值守',
] as const

export const EMPTY_DEPLOY_PLAN: DeployPlan = {
  server: '', host: '—', scope: 'all', remote_dir: '—',
  image_prefix: '—', image_tag: '—',
  preflight: {
    collected: false, host: '—', checks: [], env_line_ending: 'unknown',
    blockers: [], warnings: [],
  },
  alignments: [], commands: [], impact: [], warnings: [], blockers: [],
  available: false,
  note: '还没做过只读预演。预演只读、不改远端，也不是执行凭证。',
}

export const EMPTY_DEPLOY_TASK: DeployTask = {
  running: false, done: false, mode: '', server: '', scope: '',
  exit_code: 0, log: '', next: 0, stages: [], gates: [], task_id: '',
}
