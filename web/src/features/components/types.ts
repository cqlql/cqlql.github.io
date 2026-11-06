/** 本 feature 用到的最小投影；不 import 别的 feature 的类型。 */

export interface ServerOption {
  name: string
  host?: string
  role?: string
  note?: string
}

export interface ServersListResponse {
  servers: ServerOption[]
  default?: string
}

export type ComponentState = 'missing' | 'ok' | 'degraded' | 'unknown' | 'planned'
export type CheckState = 'ok' | 'warn' | 'err' | 'off'

export interface ComponentCheck {
  key: string
  label: string
  value: string
  state: CheckState
}

export interface ComponentStatus {
  id: string
  name: string
  kind: string
  depends?: string
  phase: 'ready' | 'planned'
  state: ComponentState
  version: string
  checks: ComponentCheck[]
  collected: boolean
  error?: string
}

export interface Preflight {
  ready: boolean
  blockers: string[]
  warnings: string[]
}

/** GET /api/components/status 的数据。失败时 ok=true + data.error，不抛 HTTP 错误。 */
export interface ComponentsStatusView {
  server: string
  collected: boolean
  error?: string
  components: ComponentStatus[]
  checks: ComponentCheck[]
  raw: Record<string, string>
  preflight: Preflight
}

/** 本轮只开放 install；update / uninstall 尚未接入。 */
export interface ComponentRunRequest {
  verb: 'install'
  component: string
  name: string
  confirm: 'yes'
  password?: string
}

export interface ComponentTask {
  running: boolean
  done: boolean
  mode: string
  server: string
  component: string
  exit_code: number
  log: string
  next: number
  started_at?: string
  ended_at?: string
}
