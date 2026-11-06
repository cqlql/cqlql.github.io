import { request } from '../../shared/api/http.ts'
import type {
  BackupRunRequest,
  BackupRunResult,
  BackupTask,
  ServersListResponse,
} from './types.ts'

/**
 * 只发请求，不写业务判断。
 *
 * `targets()` 打的是 /api/servers（与服务器管理同一个接口），但这里只声明
 * 本能力用到的最小投影 —— 两个 feature 之间不互相 import 类型，
 * 删掉任何一个都不会连带编译失败。
 */
export const backupApi = {
  targets: () => request<ServersListResponse>('/api/servers'),

  /** 启动预检 / 安装 / 自检；写操作，后端还会校验 confirm 与服务端预检门。 */
  run: (req: BackupRunRequest) =>
    request<BackupRunResult>('/api/backup/run', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  /** 轮询任务状态与增量日志；after 传上一次响应的 next。 */
  task: (after: number) => request<BackupTask>(`/api/backup/task?after=${after}`),
}
