import { request } from '../../shared/api/http.ts'
import type { BackupRunRequest, BackupRunResult, BackupTask } from '../backup/types.ts'
import type {
  RestoreComponent,
  RestorePlan,
  RestoreSnapshot,
  ServersListResponse,
} from './types.ts'

/**
 * 只发请求，不写业务判断。
 *
 * 🔴 写动作走 `POST /api/backup/run`、日志走 `GET /api/backup/task`：
 *    恢复与备份 / 部署 / 装依赖 / 重启共用**同一把**后台任务锁，不新开第二套轮询。
 *    candidates / plan 是纯只读接口，不占锁、不要 confirm、不写远端。
 */
export const restoreApi = {
  targets: () => request<ServersListResponse>('/api/servers'),

  /** 只读候选清单 + 恢复目标回显；连不上也回完整快照（collected=false）。 */
  candidates: (name: string, component: RestoreComponent) => {
    const q = new URLSearchParams({ name, component })
    return request<RestoreSnapshot>(`/api/restore/candidates?${q.toString()}`)
  },

  /** 换选中行 = 重新取一次计划；cron_confirmed 是本机表单状态，不是采集事实。 */
  plan: (p: {
    name: string
    component: RestoreComponent
    candidate: string
    db: string
    cronConfirmed: boolean
  }) => {
    const q = new URLSearchParams({
      name: p.name,
      component: p.component,
      candidate: p.candidate,
      db: p.db,
      cron_confirmed: p.cronConfirmed ? '1' : '0',
    })
    return request<RestorePlan>(`/api/restore/plan?${q.toString()}`)
  },

  /** mode=restore（写）/ restore-dry（只读预演）；服务端还会再验一次门禁。 */
  run: (req: BackupRunRequest) =>
    request<BackupRunResult>('/api/backup/run', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  /** 增量日志；after 传上一次响应的 next。 */
  task: (after: number) => request<BackupTask>(`/api/backup/task?after=${after}`),
}
