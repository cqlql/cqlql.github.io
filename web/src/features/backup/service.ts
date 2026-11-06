import type { BackupRunRequest, BackupRunResult, BackupTask } from './types.ts'

/**
 * 编排层：启动任务 + 轮询增量日志。
 *
 * 🔴 任务跑在 Go 侧的后台 goroutine 里，**不绑 HTTP 请求**：
 * 刷新页面 / 切走标签页都不会打断已经开始的远端安装。
 * 所以这里要做两件事：把增量日志拼起来，以及组件卸载时停掉轮询（不是停掉任务）。
 *
 * 依赖（api / sleep / shouldStop）全部注入，`node --test` 不需要浏览器或定时器。
 */

/** 本 feature 用到的接口；测试时注入假实现。 */
export interface BackupApi {
  run: (req: BackupRunRequest) => Promise<BackupRunResult>
  task: (after: number) => Promise<BackupTask>
}

export interface WatchHooks {
  /** 一段新日志（增量），页面负责追加。 */
  onChunk: (chunk: string) => void
  /** 每次轮询到的任务快照，页面负责显示阶段 / 退出码。 */
  onTask: (t: BackupTask) => void
  /** 组件卸载后返回 true，让轮询自己退出；任务本身仍在服务端跑。 */
  shouldStop?: () => boolean
  sleep?: (ms: number) => Promise<void>
}

export const pollIntervalMs = 800

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * 从 after 开始追一个任务，直到它不再 running。
 * 初始 after 由调用方给：新任务从 0 开始，恢复一个已在跑的任务用首包 next。
 */
export async function watchTask(
  api: BackupApi,
  hooks: WatchHooks,
  after = 0,
): Promise<BackupTask> {
  const sleep = hooks.sleep ?? defaultSleep
  let cursor = after
  for (;;) {
    const t = await api.task(cursor)
    if (t.log) hooks.onChunk(t.log)
    hooks.onTask(t)
    if (!t.running) return t
    if (hooks.shouldStop?.()) return t
    await sleep(pollIntervalMs)
    if (hooks.shouldStop?.()) return t
    cursor = t.next
  }
}

/** 发起一次预检 / 安装 / 自检，然后一路把日志追到结束。 */
export async function startBackup(
  api: BackupApi,
  req: BackupRunRequest,
  hooks: WatchHooks,
): Promise<BackupTask> {
  await api.run(req)
  return watchTask(api, hooks, 0)
}

/**
 * 页面重新挂载（刷新 / 切回标签页）时接回一个**已经在跑**的任务。
 * 首包 after=0 拿全量历史，之后从 next 继续追增量；没任务则原样返回。
 */
export async function resumeBackupTask(
  api: BackupApi,
  hooks: WatchHooks,
): Promise<BackupTask | null> {
  const first = await api.task(0)
  if (!first.running && !first.done) return null
  hooks.onChunk(first.log)
  hooks.onTask(first)
  if (!first.running) return first
  if (hooks.shouldStop?.()) return first
  return watchTask(api, hooks, first.next)
}

/** 把任意异常变成一句人话；ApiError 的 message 已是后端给的中文。 */
export function errText(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}
