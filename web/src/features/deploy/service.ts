import type {
  DeployPlan,
  DeployReleaseRequest,
  DeployRunResult,
  DeployScope,
  DeployTask,
  ReleaseHistoryView,
} from './types.ts'
import { normalizeHistory, normalizePlan, normalizeTask } from './utils/format.ts'

/**
 * 编排层：启动发布任务 + 轮询增量日志与六阶段进度。
 *
 * 🔴 任务跑在 Go 侧后台 goroutine 里、不绑 HTTP 请求：刷新页面 / 切走标签页
 *    不会打断已经开始的发布；这里停掉的只是**轮询**。
 * 依赖（api / sleep / shouldStop）全部注入，`node --test` 不需要浏览器或定时器。
 */

export interface DeployApi {
  plan: (server: string, scope: DeployScope) => Promise<DeployPlan>
  releases: (server: string) => Promise<ReleaseHistoryView>
  release: (req: DeployReleaseRequest) => Promise<DeployRunResult>
  task: (after: number) => Promise<DeployTask>
}

export interface DeployWatchHooks {
  onChunk: (chunk: string) => void
  onTask: (t: DeployTask) => void
  shouldStop?: () => boolean
  sleep?: (ms: number) => Promise<void>
}

export const pollIntervalMs = 800

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** 只读数据一律过一层防空归一化：连不上 / 解析失败也不白屏。 */
export function fetchDeployPlan(api: DeployApi, server: string, scope: DeployScope): Promise<DeployPlan> {
  return api.plan(server, scope).then(normalizePlan)
}

export function fetchReleaseHistory(api: DeployApi, server: string): Promise<ReleaseHistoryView> {
  return api.releases(server).then(normalizeHistory)
}

/** 从 after 起追一个任务，直到它不再 running。 */
export async function watchDeployTask(
  api: DeployApi,
  hooks: DeployWatchHooks,
  after = 0,
): Promise<DeployTask> {
  const sleep = hooks.sleep ?? defaultSleep
  let cursor = after
  for (;;) {
    const raw = await api.task(cursor)
    const t = normalizeTask(raw)
    if (t.log) hooks.onChunk(t.log)
    hooks.onTask(t)
    if (!t.running) return t
    if (hooks.shouldStop?.()) return t
    await sleep(pollIntervalMs)
    if (hooks.shouldStop?.()) return t
    cursor = t.next
  }
}

/** 发起一次正式发布（门禁已过），然后一路把日志与阶段追到结束。 */
export async function startDeploy(
  api: DeployApi,
  req: DeployReleaseRequest,
  hooks: DeployWatchHooks,
): Promise<DeployTask> {
  await api.release(req)
  return watchDeployTask(api, hooks, 0)
}

/** 页面重新挂载时接回一个已经在跑的任务；没任务则原样返回 null。 */
export async function resumeDeployTask(
  api: DeployApi,
  hooks: DeployWatchHooks,
): Promise<DeployTask | null> {
  const first = normalizeTask(await api.task(0))
  if (!first.running && !first.done) return null
  if (first.log) hooks.onChunk(first.log)
  hooks.onTask(first)
  if (!first.running) return first
  if (hooks.shouldStop?.()) return first
  return watchDeployTask(api, hooks, first.next)
}

export function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
