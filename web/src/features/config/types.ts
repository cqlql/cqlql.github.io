// 与 Go 侧 internal/ui/config.go 的 configView 一一对应。
// 🔴 凭证字段的值**永远不在这里出现**：后端只给 configured 标记。

export type SudoMode = 'nopasswd' | 'none' | 'root'

export type BackupComponent = 'pg' | 'minio'

export interface ConfigServer {
  name: string
  role: string
  user: string
  host: string
  port: number
  sudo_mode: SudoMode
  has_key: boolean
  password_configured: boolean
  note?: string
  exec_chain: string
  /** P2+ 只读监控账号：用户名可回显；私钥路径只给布尔标记，绝不下发路径本身。 */
  monitor_user?: string
  monitor_key_configured?: boolean
  monitor_configured?: boolean
}

export interface EnvField {
  key: string
  label: string
  group: string
  /** 凭证字段恒为空串，只回显 configured。 */
  value: string
  secret: boolean
  configured: boolean
  /** 运行时默认值，只来自 env-schema.json；凭证与「留空即关闭」的键恒为空串。 */
  default: string
}

export interface EnvView {
  component: BackupComponent
  path: string
  exists: boolean
  fields: EnvField[]
}

export interface ConfigView {
  servers_file: string
  servers: ConfigServer[]
  envs: EnvView[]
  sync_enabled: boolean
  /** 非空 = ops.env / servers.json 还读不出来；配置页仍要能打开并新增服务器。 */
  setup_error?: string
}

export interface ServerSaveResult {
  changed: string[]
  user_changed: boolean
  sudo_mode_changed: boolean
  needs_sudo_reapply: boolean
}

export interface EnvSaveResult {
  changed: string[]
  component: BackupComponent
  /** 恒为 false：保存本机配置不会碰远端，必须再点同步。 */
  remote_synced: boolean
}

export interface SyncResult {
  synced: boolean
  exit_code: number
  log: string
  component?: BackupComponent
  server?: string
}

// ---- 远端值对照（GET /api/config/compare，只读） ----

export type CompareState = 'consistent' | 'changed' | 'remote-only' | 'local-only'

/**
 * 一行的对比结果。
 * 🔴 remote / local 对凭证字段都是**掩码**：服务端只回「已配置 · /ro…est」，
 * 页面永远拿不到明文；是否变化看 state，不看值。
 */
export interface CompareField {
  key: string
  label: string
  group: string
  remote: string
  local: string
  secret: boolean
  remote_configured: boolean
  local_configured: boolean
  state: CompareState
}

export interface CompareComponent {
  component: BackupComponent
  remote_path: string
  local_path: string
  fields: CompareField[]
}

export interface CompareView {
  components: CompareComponent[]
  /** 抓取失败的原因（HTTP 仍是 200：这是业务结果，不是请求失败）。 */
  error?: string
  fetched_at?: string
}
