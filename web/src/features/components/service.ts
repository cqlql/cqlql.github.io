import type {
  ComponentRunRequest,
  ComponentTask,
  ComponentsStatusView,
} from './types.ts'
import { normalizeStatusView } from './utils/format.ts'

/**
 * 编排层：只读状态 + 启动安装 + 轮询增量日志。
 *
 * 🔴 任务跑在 Go 侧的后台 goroutine 里，不绑 HTTP 请求：刷新页面不会打断
 *    已经开始的远端安装。组件卸载只停轮询，不停任务。
 * 🔴 与备份部署共用同一个后台任务锁，所以两边的日志端点读的是同一份状态。
 */

export interface TaskApi {
  task: (after: number) => Promise<ComponentTask>
}

export interface ComponentApi extends TaskApi {
  status: (name: string) => Promise<ComponentsStatusView>
  run: (req: ComponentRunRequest) => Promise<{ started: boolean }>
}

/** 离线镜像导入也走同一个任务端点 / 同一把后台任务锁。 */
export interface ImageUploadApi extends TaskApi {
  uploadImage: (form: FormData) => Promise<{ started: boolean }>
}

export interface WatchHooks {
  onChunk: (chunk: string) => void
  onTask: (t: ComponentTask) => void
  shouldStop?: () => boolean
  sleep?: (ms: number) => Promise<void>
}

export const pollIntervalMs = 800

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** 失败响应也可能是 ok=true + data.error，统一过一层防空数组归一化。 */
export async function fetchStatus(api: ComponentApi, name: string): Promise<ComponentsStatusView> {
  return normalizeStatusView(await api.status(name))
}

export async function watchComponentTask(
  api: TaskApi,
  hooks: WatchHooks,
  after = 0,
): Promise<ComponentTask> {
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

/** 三个写动词共用同一条链路：发请求 → 服务端 dry-run → 增量轮询同一个任务。 */
export async function startComponentRun(
  api: ComponentApi,
  req: ComponentRunRequest,
  hooks: WatchHooks,
): Promise<ComponentTask> {
  await api.run(req)
  return watchComponentTask(api, hooks, 0)
}

/** 兼容入口：安装只是 verb='install' 的一种。 */
export async function startComponentInstall(
  api: ComponentApi,
  req: ComponentRunRequest,
  hooks: WatchHooks,
): Promise<ComponentTask> {
  return startComponentRun(api, req, hooks)
}

/** 选好本机 .tar 后：上传 → 服务端 dry-run → docker load，日志增量回同一份任务。 */
export async function startImageLoad(
  api: ImageUploadApi,
  form: FormData,
  hooks: WatchHooks,
): Promise<ComponentTask> {
  await api.uploadImage(form)
  return watchComponentTask(api, hooks, 0)
}

/** 重新挂载时接回一个已经在跑的任务；首包 after=0 拿全量历史。 */
export async function resumeComponentTask(
  api: TaskApi,
  hooks: WatchHooks,
): Promise<ComponentTask | null> {
  const first = await api.task(0)
  if (!first.running && !first.done) return null
  if (first.log) hooks.onChunk(first.log)
  hooks.onTask(first)
  if (!first.running) return first
  if (hooks.shouldStop?.()) return first
  return watchComponentTask(api, hooks, first.next)
}

export function errText(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}
