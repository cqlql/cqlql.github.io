import { request } from '../../shared/api/http.ts'
import type {
  DeployPlan,
  DeployReleaseRequest,
  DeployRunResult,
  DeployScope,
  DeployTask,
  ReleaseHistoryView,
  ServersListResponse,
} from './types.ts'

/** 只发请求，不写业务判断；归一化与门禁在 service / utils / Go 侧。 */
export const deployApi = {
  targets: () => request<ServersListResponse>('/api/servers'),

  /** 只读预演：真实 ssh 只读预检 + 将执行的命令草案，不改远端。 */
  plan: (server: string, scope: DeployScope) => {
    const q = new URLSearchParams({ scope })
    if (server) q.set('server', server)
    return request<DeployPlan>(`/api/deploy/plan?${q.toString()}`)
  },

  /** 只读发版历史：本机台账；失败恒回 ok=true + items: []。 */
  releases: (server: string) => {
    const q = new URLSearchParams()
    if (server) q.set('server', server)
    const suffix = q.toString()
    return request<ReleaseHistoryView>(`/api/deploy/releases${suffix ? `?${suffix}` : ''}`)
  },

  /** 正式发布：六道门 + 服务端预检门 + 409；启动后立即返回，日志靠轮询。 */
  release: (req: DeployReleaseRequest) =>
    request<DeployRunResult>('/api/deploy/release', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  /** 增量日志 + 六阶段进度 + 最终报告；after 传上一次的 next。 */
  task: (after: number) => request<DeployTask>(`/api/deploy/task?after=${after}`),
}
