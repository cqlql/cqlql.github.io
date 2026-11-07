import { request } from '../../shared/api/http.ts'
import type { MonitorTargetsView, MonitorView } from './types.ts'

/**
 * 本能力的接口：只发请求，不写业务判断。
 * 两个都是 GET 只读；`force=1` 只是「人点了立即刷新」，最短间隔由 Go 侧限流。
 */
export const monitorApi = {
  /** 服务器清单（下拉候选）。配置缺失时后端回 200 + setup_error。 */
  targets: () => request<MonitorTargetsView>('/api/servers'),

  /** 只读快照。name 只认 servers.json 里的 name，未知 404。 */
  status: (name: string, force = false) => {
    const q = new URLSearchParams({ name })
    if (force) q.set('force', '1')
    return request<MonitorView>(`/api/monitor/status?${q.toString()}`)
  },
}
