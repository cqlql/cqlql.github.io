import type { BackupRunRequest, BackupRunResult, BackupTask } from '../backup/types.ts'
import { errText, resumeBackupTask, startBackup } from '../backup/service.ts'
import type { WatchHooks } from '../backup/service.ts'
import type { RestoreComponent, RestorePlan, RestoreSnapshot } from './types.ts'
import { normalizeRestorePlan, normalizeRestoreSnapshot } from './utils/format.ts'

/**
 * 编排层：只读快照 / 计划 + 复用 backup feature 的任务轮询。
 *
 * 🔴 不复制第二套 watchTask：恢复、备份、部署、装依赖、重启在 Go 侧共用
 *    `backupTask` 这一把锁与同一份增量日志（?after=），刷新页面不打断任务。
 *    这里只把 restore 的只读接口接进来，跨 feature 只依赖类型与纯函数。
 */
export type { WatchHooks }

export interface RestoreApi {
  run: (req: BackupRunRequest) => Promise<BackupRunResult>
  task: (after: number) => Promise<BackupTask>
}

export interface RestoreCandidatesApi {
  candidates: (name: string, component: RestoreComponent) => Promise<RestoreSnapshot>
}

export interface RestorePlanApi {
  plan: (p: {
    name: string
    component: RestoreComponent
    candidate: string
    db: string
    cronConfirmed: boolean
  }) => Promise<RestorePlan>
}

/** 连不上 / 配置没装也回完整空快照，页面不能白屏或猜一个生产端主机。 */
export async function fetchRestoreSnapshot(
  api: RestoreCandidatesApi,
  name: string,
  component: RestoreComponent,
): Promise<RestoreSnapshot> {
  return normalizeRestoreSnapshot(await api.candidates(name, component))
}

/** 动作计划由 Go 侧下发；这里只做防空归一化，不在前端算 available。 */
export async function fetchRestorePlan(
  api: RestorePlanApi,
  p: Parameters<RestorePlanApi['plan']>[0],
): Promise<RestorePlan> {
  return normalizeRestorePlan(await api.plan(p))
}

/** 发起一次只读预演 / 正式恢复，然后一路把日志追到结束。 */
export async function startRestore(
  api: RestoreApi,
  req: BackupRunRequest,
  hooks: WatchHooks,
): Promise<BackupTask> {
  return startBackup(api, req, hooks)
}

export { errText, resumeBackupTask }
