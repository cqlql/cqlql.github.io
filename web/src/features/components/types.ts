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

export interface Preflight {
  ready: boolean
  blockers: string[]
  warnings: string[]
}

/** 目标机上已导入的离线镜像（只读体检采集）。 */
export interface ImageInfo {
  reference: string
  id: string
  size: string
  created: string
}

/** 本机 backup/minio.env 的事实：只回布尔标记与非凭证的 URL，绝不回显凭证值。 */
export interface LocalFacts {
  minio_root_user_set: boolean
  minio_root_secret_set: boolean
  dest_url?: string
  dest_url_port?: string
}

export interface ComponentStatus {
  id: string
  name: string
  kind: string
  depends?: string
  phase: 'ready' | 'planned'
  /** 只有声明了离线镜像的组件（minio）才显示导入区与导入按钮。 */
  offline_image?: boolean
  state: ComponentState
  version: string
  checks: ComponentCheck[]
  collected: boolean
  error?: string
  /** 后端按组件算好的安装预检结论，前端不再自己拼一套判据。 */
  preflight?: Preflight
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
  /** 按组件 id 的预检；旧后端没有这个字段时回退到上面的 preflight。 */
  preflights?: Record<string, Preflight>
  images: ImageInfo[]
  local?: LocalFacts
}

/** 本轮写动作只开放 install；update / uninstall 尚未接入。 */
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
