import { test } from 'node:test'
import assert from 'node:assert/strict'

import { EMPTY_DEPLOY_PLAN } from '../src/features/deploy/types.ts'
import type {
  DeployPlan, DeployReleaseRequest, DeployRunResult, DeployScope, DeployTask,
  ReleaseHistoryView,
} from '../src/features/deploy/types.ts'
import {
  fetchDeployPlan, fetchReleaseHistory, resumeDeployTask, startDeploy, watchDeployTask,
} from '../src/features/deploy/service.ts'
import type { DeployApi } from '../src/features/deploy/service.ts'
import {
  antdStepStatus, bumpVersion, bumpLabel, confirmEnabled, historyKindLabel,
  normalizeHistory, normalizePlan, normalizeTask, releaseFormatValid, releaseGate,
  releaseNoteValid, scopeLabel,
} from '../src/features/deploy/utils/format.ts'

/** P3b-3 判定层与轮询编排：不碰 DOM、不发真实请求。 */

const plan = (patch: Partial<DeployPlan> = {}): DeployPlan => ({
  ...EMPTY_DEPLOY_PLAN,
  server: 'k2', host: 'cql@k2:22', scope: 'all',
  preflight: { ...EMPTY_DEPLOY_PLAN.preflight, collected: true, checks: [{ name: 'docker', ok: true, value: '29.9.3' }] },
  available: true, blockers: [], warnings: [],
  commands: [{ phase: '拉起', cmd: 'docker compose up -d' }],
  impact: ['重建容器'],
  ...patch,
})

test('只读预演归一化：null / 缺字段都回完整空视图，数组恒 []', () => {
  const empty = normalizePlan(null)
  assert.equal(empty.available, false)
  assert.equal(empty.preflight.collected, false)
  assert.deepEqual(empty.commands, [])
  assert.deepEqual(empty.preflight.checks, [])
  assert.equal(empty.image_tag, '—')
  const p = normalizePlan({
    available: true, commands: null, warnings: ['w'],
    preflight: { collected: true, checks: null, blockers: null, warnings: 'not-array' },
  })
  assert.deepEqual(p.commands, [])
  assert.deepEqual(p.warnings, ['w'])
  assert.deepEqual(p.preflight.checks, [])
  assert.deepEqual(p.preflight.warnings, [])
})

test('发版历史归一化：接口失败回 items: []，不是 null', () => {
  assert.deepEqual(normalizeHistory(null).items, [])
  const v = normalizeHistory({ error: '台账第 4 行解析失败', items: null })
  assert.deepEqual(v.items, [])
  assert.match(v.error ?? '', /第 4 行/)
  const one = normalizeHistory({ items: [{ ts: '2026-11-11T22:00:00Z', server: 'k2', release_version: '1.16.1' }] })
  assert.equal(one.items[0].online_version, '未采集')
  assert.equal(one.items[0].kind, 'release')
})

test('任务快照归一化：stages / gates 恒 []，log 与 next 有默认', () => {
  const t = normalizeTask(null)
  assert.deepEqual(t.stages, [])
  assert.deepEqual(t.gates, [])
  assert.equal(t.log, '')
  assert.equal(t.next, 0)
  const running = normalizeTask({ running: true, stages: [{ name: '预检', status: 'running' }], gates: null, next: 12 })
  assert.equal(running.stages[0].status, 'running')
  assert.deepEqual(running.gates, [])
  assert.equal(running.next, 12)
})

test('发版信息：三段式 / 备注 / 更新类型推算都不猜值', () => {
  assert.equal(releaseFormatValid('1.16.1'), true)
  assert.equal(releaseFormatValid('v2.0.0'), true)
  assert.equal(releaseFormatValid('latest'), false)
  assert.equal(releaseFormatValid('1.16'), false)
  assert.equal(releaseNoteValid('修复若干问题'), true)
  assert.equal(releaseNoteValid('a\nb'), false)
  assert.equal(releaseNoteValid('x'.repeat(201)), false)
  assert.equal(releaseNoteValid('a\u0001b'), false)

  assert.equal(bumpVersion('1.16.0', 'patch'), '1.16.1')
  assert.equal(bumpVersion('1.16.0', 'minor'), '1.17.0')
  assert.equal(bumpVersion('1.16.0', 'major'), '2.0.0')
  assert.equal(bumpVersion('v1.2.3', 'patch'), '1.2.4')
  // 🔴 线上未采集 / 非三段式：不推算、不猜 1.0.0。
  assert.equal(bumpVersion('未采集', 'patch'), '')
  assert.equal(bumpVersion('—', 'minor'), '')
  assert.equal(bumpVersion('1.16.0', 'manual'), '')
  assert.equal(bumpVersion('1.16.0', ''), '')
  assert.equal(bumpLabel('rollback'), '未选择')
  assert.equal(scopeLabel('ai'), 'AI 服务')
})

test('正式发布按钮默认不可用：选机 / 预演 / 发版号 / 备注 / 任务锁缺一不可', () => {
  assert.equal(releaseGate(plan(), '1.16.1', '修复若干问题', false, 'k2').ok, true)
  assert.equal(releaseGate(plan(), '1.16.1', '备注', false, '').ok, false, '没选机')
  assert.equal(releaseGate(plan({ available: false, blockers: ['连不上'] }), '1.16.1', '', false, 'k2').ok, false)
  assert.equal(releaseGate(plan({ preflight: { ...plan().preflight, collected: false } }), '1.16.1', '', false, 'k2').ok, false)
  assert.equal(releaseGate(plan(), 'latest', '', false, 'k2').ok, false)
  assert.equal(releaseGate(plan(), '1.16.1', 'a\nb', false, 'k2').ok, false)
  assert.equal(releaseGate(plan(), '1.16.1', '', true, 'k2').ok, false, '任务在跑')
  const reasons = releaseGate(plan({ available: false }), 'latest', 'a\nb', true, '').reasons
  assert.ok(reasons.length >= 4)
})

test('二次确认：逐字 yes + 三项全勾；结果徽标按 kind 优先', () => {
  assert.equal(confirmEnabled('yes', [true, true, true]), true)
  assert.equal(confirmEnabled('YES', [true, true, true]), false)
  assert.equal(confirmEnabled('yes', [true, true, false]), false)
  assert.equal(confirmEnabled('yes', [true, true]), false)
  const base = { ts: '', server: 'k2', scope: 'all', online_version: '未采集', release_version: '1.16.1', bump: '', note: '', image_tag: '', failed_stage: '', task_id: '' }
  assert.equal(historyKindLabel({ ...base, kind: 'release', result: 'success' }), '成功')
  assert.equal(historyKindLabel({ ...base, kind: 'release', result: 'failed' }), '失败')
  assert.equal(historyKindLabel({ ...base, kind: 'rollback', result: 'success' }), '回滚')
  assert.equal(antdStepStatus('running'), 'process')
  assert.equal(antdStepStatus('fail'), 'error')
  assert.equal(antdStepStatus('skip'), 'finish')
  assert.equal(antdStepStatus('wait'), 'wait')
})

/** 假 API：按 after 返回一段增量日志，最后收尾。 */
function fakeApi(overrides: Partial<DeployApi> = {}): DeployApi & { calls: number[]; released: DeployReleaseRequest[] } {
  const state = { calls: [] as number[], released: [] as DeployReleaseRequest[] }
  const task = (after: number): DeployTask => {
    state.calls.push(after)
    const done = after >= 3
    return {
      running: !done, done, mode: 'deploy-release', server: 'k2', scope: 'all',
      exit_code: 0, log: after === 0 ? 'abc' : 'def', next: after === 0 ? 3 : 7,
      stages: [{ name: '预检', status: done ? 'ok' : 'running' }],
      gates: [], task_id: 'ui-1',
      report: done ? { completed: true, note: '报告只报脚本结果' } : undefined,
    }
  }
  return {
    calls: state.calls,
    released: state.released,
    plan: async () => plan(),
    releases: async (): Promise<ReleaseHistoryView> => ({ items: [], error: '台账文件不存在' }),
    release: async (req) => { state.released.push(req); return { started: true, task_id: 'ui-1', server: req.server, scope: req.scope } as DeployRunResult },
    task: async (after) => task(after),
    ...overrides,
  }
}

test('只读数据都过一层防空归一化', async () => {
  const api = fakeApi({
    plan: async () => null as unknown as DeployPlan,
    releases: async () => ({ error: '读不到', items: null }) as unknown as ReleaseHistoryView,
  })
  assert.equal((await fetchDeployPlan(api, 'k2', 'all')).available, false)
  assert.deepEqual((await fetchReleaseHistory(api, 'k2')).items, [])
})

test('轮询增量日志：从 next 继续、不重复、卸载后自己停', async () => {
  const api = fakeApi()
  const chunks: string[] = []
  const snaps: DeployTask[] = []
  const t = await watchDeployTask(api, {
    onChunk: (c) => chunks.push(c),
    onTask: (x) => snaps.push(x),
    sleep: async () => {},
  }, 0)
  assert.equal(t.done, true)
  assert.deepEqual(chunks, ['abc', 'def'])
  assert.deepEqual(api.calls, [0, 3])
  assert.equal(snaps.length, 2)

  const stopped = fakeApi()
  let n = 0
  await watchDeployTask(stopped, {
    onChunk: () => {}, onTask: () => {},
    shouldStop: () => ++n > 1,
    sleep: async () => {},
  }, 0)
  assert.deepEqual(stopped.calls, [0], 'shouldStop 后不再发下一轮')
})

test('启动发布带上 yes + 三项勾选，并追到任务结束', async () => {
  const api = fakeApi()
  const req: DeployReleaseRequest = {
    confirm: 'yes', server: 'k2', scope: 'all' as DeployScope,
    release_version: '1.16.1', release_note: '备注', bump: 'patch',
    checks: [true, true, true],
  }
  const t = await startDeploy(api, req, { onChunk: () => {}, onTask: () => {}, sleep: async () => {} })
  assert.equal(t.done, true)
  assert.equal(api.released.length, 1)
  assert.equal(api.released[0].confirm, 'yes')
  assert.deepEqual(api.released[0].checks, [true, true, true])
})

test('刷新页面能接回一个已在跑的任务；没任务返回 null', async () => {
  const api = fakeApi()
  const t = await resumeDeployTask(api, { onChunk: () => {}, onTask: () => {}, shouldStop: () => true, sleep: async () => {} })
  assert.equal(t?.running, true)
  assert.deepEqual(api.calls, [0])
  const idle = fakeApi({ task: async () => ({ ...EMPTY_DEPLOY_PLAN, running: false, done: false } as unknown as DeployTask) })
  assert.equal(await resumeDeployTask(idle, { onChunk: () => {}, onTask: () => {} }), null)
})
