import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  fetchDeps,
  pollIntervalMs,
  resumeBackupTask,
  startBackup,
  watchTask,
} from '../src/features/backup/service.ts'
import type { BackupApi, WatchHooks } from '../src/features/backup/service.ts'
import type { BackupDepsView, BackupRunResult, BackupTask } from '../src/features/backup/types.ts'
import {
  canStart,
  componentLabel,
  confirmHint,
  depsHit,
  depsInstallEnabled,
  modeLabel,
  needsConfirm,
  normalizeDepsView,
  normalizePgMajorInput,
  normalizeUninstallPlan,
  pgMajorValue,
  taskPhase,
  uninstallButtonEnabled,
  uninstallSubmitEnabled,
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

test('deps 模式：文案、二次确认与「缺少依赖」日志提示', () => {
  assert.equal(modeLabel('deps'), '安装缺少依赖')
  assert.equal(needsConfirm('deps'), true)
  assert.equal(needsConfirm('preflight'), false)
  const hint = confirmHint('deps', 'bk-1', 'all')
  assert.match(hint, /bk-1/)
  assert.match(hint, /不上传脚本|只装包/)
  assert.match(hint, /预检/)
  assert.equal(depsHit('ERROR: 缺少依赖：mc, pg_restore'), true)
  assert.equal(depsHit('WARN: 缺少依赖：logrotate'), true)
  assert.equal(depsHit('预检通过，开始安装'), false)
})

test('PG 主版本只留数字；依赖数组防空、安装按钮门', () => {
  assert.equal(normalizePgMajorInput('1a6'), '16')
  assert.equal(normalizePgMajorInput('160'), '16')
  assert.equal(pgMajorValue(''), undefined)
  assert.equal(pgMajorValue('0'), undefined)
  assert.equal(pgMajorValue('16'), 16)

  const v = normalizeDepsView({
    server: 'bk', component: 'all', collected: true,
    missing: ['mc'], items: null, plan: null, docs: null,
  })
  assert.deepEqual(v.items, [])
  assert.deepEqual(v.plan, [])
  assert.deepEqual(v.docs, [])
  assert.equal(depsInstallEnabled(v, false, 'bk'), true)
  assert.equal(depsInstallEnabled(v, true, 'bk'), false, '任务在跑不放行')
  assert.equal(depsInstallEnabled(v, false, ''), false, '没选机器不放行')
  assert.equal(depsInstallEnabled(normalizeDepsView(null), false, 'bk'), false, '没采到不放行')
  assert.equal(depsInstallEnabled(normalizeDepsView({ collected: true, missing: [] }), false, 'bk'), false, '没缺项不放行')
})

test('fetchDeps：只读接口 + pg_major 透传 + 失败归一化', async () => {
  let got: { name: string; component: string; major?: number } | null = null
  const ok: BackupDepsView = {
    server: 'bk', component: 'pg', collected: true,
    items: [], missing: ['pg_restore'], optional: [], plan: ['装 postgresql-client'], docs: [],
    uninstall: { title: '确认卸载备份依赖', description: '', targets: [], impacts: [], submit_label: '确认卸载' },
  }
  const api = {
    deps: async (name: string, component: string, major?: number) => {
      got = { name, component, major }
      return ok
    },
  }
  const v = await fetchDeps(api, 'bk', 'pg', 16)
  assert.deepEqual(got, { name: 'bk', component: 'pg', major: 16 })
  assert.equal(v.missing[0], 'pg_restore')

  const broken = await fetchDeps({ deps: async () => ({ error: 'ssh 连不上' }) as unknown as BackupDepsView }, 'bk', 'all')
  assert.equal(broken.collected, false)
  assert.match(broken.error ?? '', /ssh 连不上/)
  assert.deepEqual(broken.items, [])
})

test('deps-uninstall：文案、确认门、卸载计划归一化与提交门', () => {
  assert.equal(modeLabel('deps-uninstall'), '卸载备份依赖')
  assert.equal(needsConfirm('deps-uninstall'), true)
  const hint = confirmHint('deps-uninstall', 'k4', 'all')
  assert.match(hint, /只删工具装的/)
  assert.match(hint, /预期结果/)

  const plan = normalizeUninstallPlan({
    title: '确认卸载备份依赖', description: '',
    targets: [
      { key: 'mc', label: '卸载 mc', help: '只删 /usr/local/bin/mc' },
      { key: 'pg_client', label: '卸载 PG 客户端', help: 'apt remove' },
    ],
    impacts: ['不卸系统基础包', '不 autoremove'],
    submit_label: '确认卸载',
  })
  assert.deepEqual(plan.targets.map((t) => t.key), ['mc', 'pg_client'])
  assert.equal(uninstallSubmitEnabled(plan, [], 'yes'), false, '一个都不勾不放行')
  assert.equal(uninstallSubmitEnabled(plan, ['cron'], 'yes'), false, '白名单外的目标不放行')
  assert.equal(uninstallSubmitEnabled(plan, ['mc'], 'no'), false, '没输 yes 不放行')
  assert.equal(uninstallSubmitEnabled(plan, ['mc', 'pg_client'], 'yes'), true)

  const view = normalizeDepsView({ collected: true, missing: [], uninstall: plan })
  assert.equal(uninstallButtonEnabled(view, false, 'k4'), true)
  assert.equal(uninstallButtonEnabled(view, true, 'k4'), false, '任务在跑不放行')
  assert.equal(uninstallButtonEnabled(normalizeDepsView(null), false, 'k4'), false, '没采到不放行')
  assert.deepEqual(normalizeUninstallPlan(null).targets, [])
  assert.deepEqual(normalizeDepsView(null).uninstall.impacts, [])
})
