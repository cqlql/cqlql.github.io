import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  pollIntervalMs,
  resumeBackupTask,
  startBackup,
  watchTask,
} from '../src/features/backup/service.ts'
import type { BackupApi, WatchHooks } from '../src/features/backup/service.ts'
import type { BackupRunResult, BackupTask } from '../src/features/backup/types.ts'
import {
  canStart,
  componentLabel,
  confirmHint,
  needsConfirm,
  taskPhase,
} from '../src/features/backup/utils/format.ts'

/** 判定层与编排层都不碰 React / DOM，所以这里能直接塞假 api 跑。 */

function task(patch: Partial<BackupTask> = {}): BackupTask {
  return {
    running: false,
    done: true,
    mode: 'deploy',
    server: 'bk',
    component: 'all',
    exit_code: 0,
    log: '',
    next: 0,
    ...patch,
  }
}

const runResult: BackupRunResult = {
  started: true,
  mode: 'deploy',
  server: 'bk',
  component: 'all',
}

test('taskPhase：运行中 / 成功 / 失败 / 未运行', () => {
  assert.deepEqual(taskPhase(null), { text: '尚未运行', tone: 'default' })
  assert.equal(taskPhase(task({ running: true, done: false })).tone, 'processing')
  assert.equal(taskPhase(task({ done: true, exit_code: 0 })).tone, 'success')
  assert.match(taskPhase(task({ done: true, exit_code: 2 })).text, /退出码 2/)
  assert.equal(taskPhase(task({ done: true, exit_code: 2 })).tone, 'error')
})

test('canStart：没选机器或任务在跑都不能再发', () => {
  assert.equal(canStart(null, 'bk'), true)
  assert.equal(canStart(null, ''), false)
  assert.equal(canStart(task({ running: true, done: false }), 'bk'), false)
})

test('只有安装需要 yes；确认提示写清会改什么', () => {
  assert.equal(needsConfirm('deploy'), true)
  assert.equal(needsConfirm('preflight'), false)
  assert.equal(needsConfirm('verify'), false)
  const hint = confirmHint('deploy', 'bk-1', 'pg')
  assert.match(hint, /bk-1/)
  assert.match(hint, /PostgreSQL/)
  assert.match(hint, /crontab/)
  assert.match(hint, /预检/)
  assert.equal(componentLabel('minio'), 'MinIO')
  assert.equal(componentLabel('all'), '全部（pg + minio）')
})

test('watchTask：按 next 续传、拼增量日志、结束后停', async () => {
  const seen: number[] = []
  const chunks: string[] = []
  const sleeps: number[] = []
  const api: BackupApi = {
    run: async () => runResult,
    task: async (after) => {
      seen.push(after)
      if (after === 0) return task({ running: true, done: false, log: '第一行\n', next: 10 })
      if (after === 10) return task({ running: true, done: false, log: '第二行\n', next: 20 })
      return task({ running: false, done: true, log: '完成\n', next: 30 })
    },
  }
  const hooks: WatchHooks = {
    onChunk: (c) => chunks.push(c),
    onTask: () => {},
    sleep: async (ms) => {
      sleeps.push(ms)
    },
  }

  const last = await watchTask(api, hooks, 0)
  assert.deepEqual(seen, [0, 10, 20])
  assert.deepEqual(chunks, ['第一行\n', '第二行\n', '完成\n'])
  assert.deepEqual(sleeps, [pollIntervalMs, pollIntervalMs])
  assert.equal(last.done, true)
})

test('watchTask：shouldStop 为真就不再轮询（组件卸载 ≠ 停远端任务）', async () => {
  let calls = 0
  const api: BackupApi = {
    run: async () => runResult,
    task: async () => {
      calls++
      return task({ running: true, done: false, log: '还在跑\n', next: 8 })
    },
  }
  const hooks: WatchHooks = {
    onChunk: () => {},
    onTask: () => {},
    shouldStop: () => true,
    sleep: async () => {},
  }
  const last = await watchTask(api, hooks, 0)
  assert.equal(calls, 1)
  assert.equal(last.running, true)
})

test('startBackup：先提交请求，再从 0 开始追日志', async () => {
  const seen: number[] = []
  let submitted: unknown = null
  const api: BackupApi = {
    run: async (req) => {
      submitted = req
      return runResult
    },
    task: async (after) => {
      seen.push(after)
      return task({ log: '完成\n', next: 7 })
    },
  }
  const chunks: string[] = []
  const hooks: WatchHooks = { onChunk: (c) => chunks.push(c), onTask: () => {} }

  const last = await startBackup(
    api,
    { mode: 'deploy', name: 'bk', component: 'pg', confirm: 'yes', password: 'pw' },
    hooks,
  )
  assert.deepEqual(submitted, {
    mode: 'deploy',
    name: 'bk',
    component: 'pg',
    confirm: 'yes',
    password: 'pw',
  })
  assert.deepEqual(seen, [0])
  assert.deepEqual(chunks, ['完成\n'])
  assert.equal(last.exit_code, 0)
})

test('resumeBackupTask：没任务返回 null；已在跑的任务从 next 续上', async () => {
  const emptyApi: BackupApi = {
    run: async () => runResult,
    task: async () => task({ running: false, done: false, log: '', next: 0 }),
  }
  assert.equal(await resumeBackupTask(emptyApi, { onChunk: () => {}, onTask: () => {} }), null)

  const seen: number[] = []
  const chunks: string[] = []
  const api: BackupApi = {
    run: async () => runResult,
    task: async (after) => {
      seen.push(after)
      if (after === 0) return task({ running: true, done: false, log: '历史日志\n', next: 15 })
      return task({ running: false, done: true, log: '新日志\n', next: 27 })
    },
  }
  const hooks: WatchHooks = {
    onChunk: (c) => chunks.push(c),
    onTask: () => {},
    sleep: async () => {},
  }
  await resumeBackupTask(api, hooks)
  assert.deepEqual(seen, [0, 15])
  assert.deepEqual(chunks, ['历史日志\n', '新日志\n'])
})
