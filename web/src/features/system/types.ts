/** /api/health：唯一用途是拿这个进程实例的 boot_id。 */
export interface HealthInfo {
  ok: boolean
  boot_id: string
}

/** /api/restart 的视图：确认弹窗里逐条摊开的事实。 */
export interface RestartInfo {
  /** 绑「这个进程实例 + 当前端口 + 当前令牌」，页面陈旧就得重新确认。 */
  confirm_token: string
  impact: string[]
  build_command: string[]
  binary_stale: boolean
  stale_reason?: string
  log_path: string
  port: number
  exe: string
  exe_exists: boolean
  task_running: boolean
  /** 非空 = 现在不能重启（接手需要的凭据读不到 / exe 不在）。 */
  note?: string
}

/** POST /api/restart 的响应。它可能因为连接被切断而**收不到**，别当成功依据。 */
export interface RestartResult {
  restarting: boolean
  rebuild: boolean
  build_output: string
  boot_id: string
}
